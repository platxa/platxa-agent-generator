"""Evolve subcommand: promotion-gate evaluation via the instinct-promoter agent.

Owns the four evolve-related module symbols:

- :data:`DEFAULT_PROMOTER_TIMEOUT` — subprocess timeout in seconds.
- :data:`PromoterExecutor` — injectable callable signature for tests
  (``(payload_json, timeout) -> raw_stdout``).
- :class:`PromotionDispatchError` — raised when the agent dispatch
  fails (timeout, missing binary, malformed JSON).
- :func:`_default_promoter_executor` — production executor that shells
  out to ``claude -p``.

These are re-exported from :mod:`platxa_agent_generator.cli` to keep
the historical import path stable for test files.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from .. import instinct_store, promotion_engine

DEFAULT_PROMOTER_TIMEOUT: int = 300
"""Subprocess timeout (seconds) for the instinct-promoter agent dispatch.

The agent performs Glob+Read across the instinct store, so a longer
timeout than ``eval_runner._default_executor`` (120s) is appropriate.
"""

# Executor signature: ``(payload_json, timeout) -> raw_stdout``.
# Mirrors :func:`eval_runner._default_executor`'s injectable seam.
PromoterExecutor = Callable[[str, int], str]


class PromotionDispatchError(RuntimeError):
    """Raised when the instinct-promoter agent dispatch fails.

    Carries a human-readable message and is mapped to CLI exit code 1
    by :func:`handle_evolve`. Distinct from
    :class:`eval_runner.EvalRunnerError` because the recovery surface
    differs (no retry, no fallback executor).
    """


def _default_promoter_executor(payload_json: str, timeout: int) -> str:
    """Default subprocess executor for the instinct-promoter agent.

    Invokes ``claude -p <prompt>`` and returns stdout verbatim. Mirrors
    the pattern in :func:`eval_runner._default_executor`; the timeout is
    callable-scoped so tests can override without monkeypatching
    ``subprocess``.

    Raises:
        PromotionDispatchError: ``claude`` CLI is not installed, or the
            subprocess exceeds the timeout.
    """
    prompt = (
        "Run the instinct-promoter subagent with this input payload and "
        "return only the JSON object from its Output Format section "
        "(no surrounding prose):\n\n"
        f"{payload_json}"
    )
    try:
        completed = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise PromotionDispatchError(f"instinct-promoter agent timed out after {timeout}s") from exc
    except FileNotFoundError as exc:
        raise PromotionDispatchError(
            "claude CLI not found; install Claude Code or provide a custom executor"
        ) from exc
    return completed.stdout


def _resolve_promoter_thresholds(
    *,
    args: argparse.Namespace,
    env: "os._Environ[str] | dict[str, str]",
) -> dict[str, int | float]:
    """Build the agent's ``thresholds`` payload from CLI flags + env var.

    Resolution order: CLI flag > ``PLATXA_PROMOTION_THRESHOLDS`` env var
    (JSON object) > ``promotion_engine.DEFAULT_*`` constants. Mirrors the
    contract that ``PromotionThresholds.from_env`` / ``from_dict`` used
    to expose. Invalid env-var JSON is silently ignored (falls through
    to defaults) to preserve the deleted ``PromotionConfigError``
    behaviour at a CLI boundary.
    """
    resolved: dict[str, int | float] = {
        "occurrences": promotion_engine.DEFAULT_OCCURRENCES,
        "confidence": promotion_engine.DEFAULT_CONFIDENCE,
        "success_count": promotion_engine.DEFAULT_SUCCESS_COUNT,
    }

    env_raw = env.get("PLATXA_PROMOTION_THRESHOLDS", "").strip()
    if env_raw:
        try:
            env_obj = json.loads(env_raw)
        except json.JSONDecodeError:
            env_obj = None
        if isinstance(env_obj, dict):
            env_occ = env_obj.get("occurrences")
            if isinstance(env_occ, int) and not isinstance(env_occ, bool):
                resolved["occurrences"] = env_occ
            env_conf = env_obj.get("confidence")
            if isinstance(env_conf, (int, float)) and not isinstance(env_conf, bool):
                resolved["confidence"] = float(env_conf)
            env_sc = env_obj.get("success_count")
            if isinstance(env_sc, int) and not isinstance(env_sc, bool):
                resolved["success_count"] = env_sc

    if getattr(args, "threshold", None) is not None:
        resolved["confidence"] = float(args.threshold)
    if getattr(args, "min_occurrences", None) is not None:
        resolved["occurrences"] = int(args.min_occurrences)
    if getattr(args, "min_success_count", None) is not None:
        resolved["success_count"] = int(args.min_success_count)

    return resolved


def _dispatch_instinct_promoter(
    *,
    instincts_root: str,
    scope: str,
    thresholds: dict[str, int | float],
    name_to_scope: dict[str, str],
    executor: PromoterExecutor | None = None,
    timeout: int = DEFAULT_PROMOTER_TIMEOUT,
) -> tuple[list[dict[str, Any]], dict[str, int | float], str | None]:
    """Dispatch the instinct-promoter agent and map its output to CLI candidates.

    Returns a triple of ``(candidates, resolved_thresholds, skipped_reason)``.
    ``candidates`` matches the CLI's ``candidates[]`` shape (name, scope,
    type, confidence, occurrences, success_count) so existing
    ``--json`` output schemas stay backward-compatible. ``type`` is
    populated from the agent's ``target`` field
    (skill/command/agent/template). ``scope`` is resolved via
    ``name_to_scope`` lookup against the caller's pre-loaded store
    entries.

    Args:
        instincts_root: Filesystem path passed to the agent.
        scope: One of ``global`` or a project id.
        thresholds: Dict with ``occurrences``, ``confidence``,
            ``success_count`` keys (callers fill missing keys from
            ``DEFAULT_*`` constants before calling).
        name_to_scope: ``{instinct_name: scope}`` lookup map used to
            populate the ``scope`` field of each candidate.
        executor: Injectable callable for testing
            (``(payload_json, timeout) -> stdout``). Defaults to
            :func:`_default_promoter_executor`.
        timeout: Subprocess timeout in seconds.

    Raises:
        PromotionDispatchError: Agent returns non-JSON output, the
            subprocess fails, or ``claude`` is not installed.
    """
    _exec = executor if executor is not None else _default_promoter_executor

    payload = json.dumps(
        {
            "instincts_root": instincts_root,
            "scope": scope,
            "thresholds": dict(thresholds),
        }
    )

    raw = _exec(payload, timeout)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        excerpt = raw[:200] if raw else "<empty stdout>"
        raise PromotionDispatchError(
            f"instinct-promoter returned non-JSON output: {excerpt}"
        ) from exc

    if not isinstance(parsed, dict):
        raise PromotionDispatchError(
            f"instinct-promoter output is not a JSON object, got {type(parsed).__name__}"
        )

    resolved: dict[str, int | float] = dict(thresholds)
    parsed_thresholds = parsed.get("thresholds")
    if isinstance(parsed_thresholds, dict):
        occ_raw = parsed_thresholds.get("occurrences")
        if isinstance(occ_raw, int):
            resolved["occurrences"] = occ_raw
        conf_raw = parsed_thresholds.get("confidence")
        if isinstance(conf_raw, (int, float)) and not isinstance(conf_raw, bool):
            resolved["confidence"] = float(conf_raw)
        sc_raw = parsed_thresholds.get("success_count")
        if isinstance(sc_raw, int):
            resolved["success_count"] = sc_raw

    skipped_raw = parsed.get("skipped_reason")
    skipped_reason: str | None = skipped_raw if isinstance(skipped_raw, str) else None

    promotions_raw = parsed.get("promotions", [])
    promotions: list[object] = promotions_raw if isinstance(promotions_raw, list) else []

    candidates: list[dict[str, Any]] = []
    for p in promotions:
        if not isinstance(p, dict):
            continue
        name = p.get("name")
        if not isinstance(name, str):
            continue
        target_raw = p.get("target", "command")
        target_str = target_raw if isinstance(target_raw, str) else "command"
        conf_raw = p.get("confidence", 0.0)
        conf_val = (
            float(conf_raw)
            if isinstance(conf_raw, (int, float)) and not isinstance(conf_raw, bool)
            else 0.0
        )
        occ_raw = p.get("occurrences", 0)
        occ_val = occ_raw if isinstance(occ_raw, int) and not isinstance(occ_raw, bool) else 0
        sc_raw = p.get("success_count", 0)
        sc_val = sc_raw if isinstance(sc_raw, int) and not isinstance(sc_raw, bool) else 0
        candidates.append(
            {
                "name": name,
                "scope": name_to_scope.get(name, ""),
                "type": target_str,
                "confidence": conf_val,
                "occurrences": occ_val,
                "success_count": sc_val,
            }
        )

    return candidates, resolved, skipped_reason


def register_parser(subparsers: Any) -> None:
    """Register the evolve subparser."""
    evolve = subparsers.add_parser(
        "evolve",
        help="Evaluate instincts for promotion eligibility",
    )
    evolve.add_argument(
        "--dry-run",
        action="store_true",
        help="List eligible candidates without writing artifacts",
    )
    evolve.add_argument(
        "--threshold",
        type=float,
        default=None,
        help=(
            f"Override the confidence threshold (default: {promotion_engine.DEFAULT_CONFIDENCE})"
        ),
    )
    evolve.add_argument(
        "--min-occurrences",
        type=int,
        default=None,
        help=(
            "Override the minimum occurrences threshold "
            f"(default: {promotion_engine.DEFAULT_OCCURRENCES})"
        ),
    )
    evolve.add_argument(
        "--min-success-count",
        type=int,
        default=None,
        help=(
            "Override the minimum success count threshold "
            f"(default: {promotion_engine.DEFAULT_SUCCESS_COUNT})"
        ),
    )
    evolve.add_argument(
        "--target",
        choices=["skill", "command", "agent", "template", "all"],
        default="all",
        help="Filter by promotion target type (default: all)",
    )
    evolve.add_argument(
        "--root",
        type=Path,
        dest="evolve_root",
        help="Path to instinct store root (default: ~/.claude/instincts)",
    )
    evolve.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_PROMOTER_TIMEOUT,
        dest="promoter_timeout",
        help=(
            "Subprocess timeout (seconds) for the instinct-promoter agent "
            f"dispatch (default: {DEFAULT_PROMOTER_TIMEOUT})"
        ),
    )


def handle_evolve(
    args: argparse.Namespace,
    promoter_executor: PromoterExecutor | None = None,
) -> int:
    """Evaluate instincts against promotion gates and report candidates.

    Dispatches the ``instinct-promoter`` subagent via ``claude -p`` (or
    an injected ``promoter_executor``) and maps its ``promotions[]``
    output to the CLI's ``candidates[]`` shape. Threshold logic is owned
    by the agent — this function only resolves CLI flags / env vars
    into the agent's input payload and renders the response.
    """
    json_mode = bool(getattr(args, "json", False))
    dry_run_flag: bool = getattr(args, "dry_run", False)
    target_filter: str = getattr(args, "target", "all")
    evolve_root: Path | None = getattr(args, "evolve_root", None)
    timeout: int = int(getattr(args, "promoter_timeout", DEFAULT_PROMOTER_TIMEOUT))

    store = instinct_store.InstinctStore(root=evolve_root)

    thresholds: dict[str, int | float] = _resolve_promoter_thresholds(
        args=args,
        env=os.environ,
    )

    entries = store.list_entries()
    if not entries:
        if json_mode:
            print(json.dumps({"candidates": [], "total_evaluated": 0, "eligible": 0}))
        else:
            print("No instincts found.")
        return 0

    name_to_scope: dict[str, str] = {e.name: e.scope for e in entries}

    instincts_root = str(evolve_root) if evolve_root is not None else ""
    try:
        candidates, resolved, skipped_reason = _dispatch_instinct_promoter(
            instincts_root=instincts_root,
            scope="global",
            thresholds=thresholds,
            name_to_scope=name_to_scope,
            executor=promoter_executor,
            timeout=timeout,
        )
    except PromotionDispatchError as exc:
        message = str(exc)
        if json_mode:
            print(
                json.dumps(
                    {
                        "candidates": [],
                        "total_evaluated": len(entries),
                        "eligible": 0,
                        "error": message,
                    }
                )
            )
        else:
            print(f"instinct-promoter dispatch failed: {message}", file=sys.stderr)
        return 1

    if target_filter != "all":
        candidates = [c for c in candidates if c.get("type") == target_filter]

    conf_val = float(resolved.get("confidence", thresholds["confidence"]))
    occ_val = int(resolved.get("occurrences", thresholds["occurrences"]))
    sc_val = int(resolved.get("success_count", thresholds["success_count"]))

    if json_mode:
        payload: dict[str, Any] = {
            "candidates": candidates,
            "total_evaluated": len(entries),
            "eligible": len(candidates),
            "dry_run": dry_run_flag,
            "thresholds": {
                "confidence": conf_val,
                "occurrences": occ_val,
                "success_count": sc_val,
            },
        }
        if target_filter != "all":
            payload["target_filter"] = target_filter
        if skipped_reason is not None:
            payload["skipped_reason"] = skipped_reason
        print(json.dumps(payload, indent=2))
    else:
        verb = "Would promote" if dry_run_flag else "Eligible for promotion"
        print(f"{verb}: {len(candidates)} instinct(s)")
        print(
            f"Evaluated: {len(entries)} | Thresholds: "
            f"confidence>={conf_val}, "
            f"occurrences>={occ_val}, "
            f"success_count>={sc_val}"
        )
        if target_filter != "all":
            print(f"Target filter: {target_filter}")
        if skipped_reason is not None:
            print(f"Note: {skipped_reason}", file=sys.stderr)
        print("-" * 60)
        for c in candidates:
            conf = float(c.get("confidence", 0.0))
            occ = int(c.get("occurrences", 0))
            succ = int(c.get("success_count", 0))
            name_str = str(c.get("name", ""))
            print(f"  {name_str:<30} conf={conf:.2f} occ={occ} succ={succ}")
        if not candidates:
            print("  (none)")

    return 0
