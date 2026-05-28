"""Health subcommand: learning-loop dashboard (eval, instincts, observations, drift).

Aggregates state from four sources — eval history JSON, the instinct
store, the observation store, and the agent-weight drift check — into
a single typed structure (:class:`HealthMetrics`) that renders as
either text or JSON depending on ``--json``.

The metric dataclasses (:class:`EvalPassRates`, :class:`HealthMetrics`)
are exported in case external callers need to construct or destructure
them; no test currently imports them by their pre-extraction private
names so no re-export shim is provided.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from .. import eval_runner, instinct_store, observation_store, quality_scorer


@dataclass(frozen=True)
class EvalPassRates:
    """Eval history pass/fail counts and rate.

    ``corrupt`` counts ``run-*.json`` files that failed to parse or
    lacked a recognizable ``verdict`` field. Surfacing the count keeps
    operators from reading an inflated pass rate when broken history
    rows are silently excluded from the denominator.
    """

    total: int
    passed: int
    failed: int
    pass_rate: float
    corrupt: int = 0


@dataclass(frozen=True)
class HealthMetrics:
    """Typed container for all seven health dashboard metrics."""

    eval_pass_rates: EvalPassRates
    instinct_count: int
    observation_count: int
    observation_promoted: int
    last_evolve_timestamp: str | None
    weight_drift_detected: bool
    weight_drift_divergences: int

    def to_dict(self) -> dict[str, object]:
        """Serialize to a JSON-safe dict."""
        return {
            "eval_pass_rates": asdict(self.eval_pass_rates),
            "instinct_count": self.instinct_count,
            "observation_count": self.observation_count,
            "observation_promoted": self.observation_promoted,
            "last_evolve_timestamp": self.last_evolve_timestamp,
            "weight_drift": {
                "has_drift": self.weight_drift_detected,
                "divergences": self.weight_drift_divergences,
            },
        }


def register_parser(subparsers: Any) -> None:
    """Register the health subparser."""
    health = subparsers.add_parser(
        "health",
        help="Show learning-loop health dashboard (eval, instincts, observations, drift)",
    )
    health.add_argument(
        "--history-dir",
        type=Path,
        default=Path(eval_runner.DEFAULT_HISTORY_DIR),
        dest="history_dir",
        help=f"Eval history directory (default: {eval_runner.DEFAULT_HISTORY_DIR})",
    )
    health.add_argument(
        "--instinct-root",
        type=Path,
        default=None,
        dest="instinct_root",
        help="Path to instinct store root (default: ~/.claude/instincts)",
    )
    health.add_argument(
        "--obs-file",
        type=Path,
        default=None,
        dest="obs_file",
        help="Path to observations JSONL file (default: .claude/observations.jsonl)",
    )


def handle_health(args: argparse.Namespace) -> int:
    """Render the learning-loop health dashboard."""
    json_mode = bool(getattr(args, "json", False))
    metrics = _collect_health_metrics(args)
    if json_mode:
        print(json.dumps(metrics.to_dict(), indent=2))
    else:
        _print_health_text(metrics)
    return 0


def _collect_health_metrics(args: argparse.Namespace) -> HealthMetrics:
    """Gather all seven health metrics into a single typed structure."""
    history_dir: Path = getattr(args, "history_dir", Path(eval_runner.DEFAULT_HISTORY_DIR))
    instinct_root: Path | None = getattr(args, "instinct_root", None)
    obs_file: Path | None = getattr(args, "obs_file", None)

    eval_rates = _eval_pass_rates(history_dir)
    inst_store = instinct_store.InstinctStore(root=instinct_root)
    obs_store = observation_store.ObservationStore(path=obs_file)
    obs_stats = obs_store.stats()
    drifted_agents = quality_scorer.check_agent_weight_tables()

    return HealthMetrics(
        eval_pass_rates=eval_rates,
        instinct_count=inst_store.count(),
        observation_count=obs_stats["total"]["count"],
        observation_promoted=obs_stats["promoted"]["count"],
        last_evolve_timestamp=_last_evolve_timestamp(inst_store),
        weight_drift_detected=len(drifted_agents) > 0,
        weight_drift_divergences=len(drifted_agents),
    )


def _eval_pass_rates(history_dir: Path) -> EvalPassRates:
    """Compute pass rates from eval history JSON files.

    Corrupt files (unparseable JSON, missing ``verdict`` field, or read
    errors) are counted in ``corrupt`` rather than silently skipped.
    Reporting them in the dashboard prevents the pass rate from looking
    artificially clean when history rows are unreadable.
    """
    if not history_dir.is_dir():
        return EvalPassRates(total=0, passed=0, failed=0, pass_rate=0.0)

    files = sorted(history_dir.glob("run-*.json"))
    total = 0
    passed = 0
    corrupt = 0

    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            corrupt += 1
            continue
        if isinstance(data, dict) and "verdict" in data:
            total += 1
            if data["verdict"] == "passed":
                passed += 1
        else:
            corrupt += 1

    failed = total - passed
    rate = passed / total if total else 0.0
    return EvalPassRates(total=total, passed=passed, failed=failed, pass_rate=rate, corrupt=corrupt)


def _last_evolve_timestamp(
    store: instinct_store.InstinctStore,
) -> str | None:
    """Find the most recent last_seen across all instinct entries."""
    entries = store.list_entries()
    if not entries:
        return None

    latest: str | None = None
    for entry in entries:
        if entry.last_seen and (latest is None or entry.last_seen > latest):
            latest = entry.last_seen
    return latest


def _print_health_text(metrics: HealthMetrics) -> None:
    """Render the health dashboard as human-readable text."""
    print("\n" + "=" * 50)
    print("  Learning Loop Health Dashboard")
    print("=" * 50)

    er = metrics.eval_pass_rates
    print(f"\n  Eval pass rate:      {er.passed}/{er.total} ({er.pass_rate:.0%})")
    if er.corrupt:
        print(f"  Corrupt history:     {er.corrupt} run-*.json file(s) unreadable or missing verdict")
    print(f"  Instinct count:      {metrics.instinct_count}")
    print(
        f"  Observations:        {metrics.observation_count} ({metrics.observation_promoted} promoted)"
    )
    print(f"  Last evolve:         {metrics.last_evolve_timestamp or '(never)'}")

    if metrics.weight_drift_detected:
        status = f"DRIFT DETECTED ({metrics.weight_drift_divergences} divergence(s))"
    else:
        status = "OK"
    print(f"  Weight drift:        {status}")
    print()


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "health": handle_health,
}
