"""Batch agent generation from a JSON ecosystem spec.

This module accepts a JSON file describing an entire agent ecosystem
(multiple ``BatchAgentDef`` entries plus shared configuration) and
generates every agent to ``.claude/agents/``. Cross-agent consistency is
validated before any agent is written so a single bad reference cannot
leave the output directory in a half-written state.

Public surface:

- :class:`BatchAgentDef` — one agent's inputs in the spec
- :class:`BatchSpec` — the whole ecosystem
- :class:`BatchPolicy` — unattended-run scoping (allowedTools, offline, path scope)
- :class:`BatchAgentResult` — per-agent outcome
- :class:`BatchResult` — per-run aggregate
- :func:`load_batch_spec` — parse JSON → BatchSpec
- :func:`validate_batch_spec` — cross-agent validation (duplicate names,
  unknown skill references, empty ecosystem)
- :func:`enforce_batch_policy` — pre-flight policy enforcement
  (allowedTools, offline, output path scope)
- :func:`generate_batch` — drive generation end-to-end, returning
  a :class:`BatchResult`
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

# Dual-import pattern: the scripts package is used both as an importable
# package (from . import batch_generator) and as a bare-module layout
# (tests cd into scripts/ and `import batch_generator`). Try relative
# first; fall back to bare import when no package context is available.
try:
    from .agent_generator import AgentDefinition, generate_frontmatter
except ImportError:
    from agent_generator import (  # type: ignore[import-not-found,no-redef]
        AgentDefinition,
        generate_frontmatter,
    )

# Default directory where batch-generated agent files land. Sourced from
# ``shared.constants`` so discovery (feature #72) and generation (this
# feature) cannot drift from the canonical ``.claude/agents`` convention.
try:
    from .shared.paths import DEFAULT_AGENTS_DIR as _DEFAULT_AGENTS_DIR
except ImportError:
    from shared.paths import (  # type: ignore[import-not-found,no-redef]
        DEFAULT_AGENTS_DIR as _DEFAULT_AGENTS_DIR,
    )
DEFAULT_BATCH_OUTPUT_DIR: str = _DEFAULT_AGENTS_DIR

# Extension used for generated agent files. Pinned as a constant so the
# writer and any downstream validators cannot drift.
BATCH_AGENT_FILE_EXTENSION: str = ".md"

# Default write-scope root for unattended batch runs. The output
# directory must resolve inside this prefix unless the caller
# explicitly overrides it via BatchPolicy.output_scope. Matches the
# verification criterion "Write restricted to .claude/ paths".
DEFAULT_OUTPUT_SCOPE: str = ".claude"

# Tools stripped from every agent when BatchPolicy.offline is True.
# Unattended runs with no network must not emit agents that silently
# rely on WebSearch/WebFetch during later execution. Listed as a
# constant so callers can introspect what "offline" means.
OFFLINE_DISABLED_TOOLS: tuple[str, ...] = ("WebSearch", "WebFetch")


@dataclass
class BatchAgentDef:
    """One agent to be generated as part of a batch.

    Mirrors the subset of AgentDefinition fields that are sensible for a
    JSON-driven ecosystem — long prose fields (examples, metadata) are
    omitted here so the spec file stays readable. Callers that need more
    control should generate agents individually via agent_generator.
    """

    name: str
    description: str
    tools: list[str] = field(default_factory=list)
    model: str | None = None
    user_invocable: bool = False
    skills: list[str] = field(default_factory=list)


@dataclass
class BatchSpec:
    """A batch/ecosystem specification loaded from JSON.

    Fields:
        name: Short ecosystem identifier (e.g. ``"review-team"``).
            Surfaces in the BatchResult so the caller can log which
            ecosystem was processed.
        description: Human-readable summary of what the ecosystem does.
        agents: The agents to generate. Must be non-empty; an empty
            list is rejected by :func:`validate_batch_spec` to catch
            mis-constructed specs early.
        shared_tools: Tools added to every agent's ``tools`` list
            (union, not replacement). Useful for giving the whole
            ecosystem access to a logging or observability tool.
    """

    name: str
    description: str
    agents: list[BatchAgentDef] = field(default_factory=list)
    shared_tools: list[str] = field(default_factory=list)


@dataclass
class BatchPolicy:
    """Tool- and path-scoping policy for unattended batch runs.

    Batch generation typically runs unattended (CI, cron, orchestrators
    invoking the CLI with --non-interactive). The policy restricts what
    the generator is allowed to emit so a malformed or adversarial spec
    cannot silently produce agents that rely on network tools
    (WebSearch), write outside the intended scope, or grant capabilities
    that the operator did not approve.

    Fields:
        allowed_tools: If non-empty, every agent's *effective* tool list
            (declared + shared_tools) must be a subset of this allowlist
            after offline scrubbing. Empty list means "no allowlist
            enforcement" — falls back to whatever the spec declares.
            Checked against tool names exactly as they appear in the
            spec (e.g. ``"Read"``, ``"Bash"``, ``"WebSearch"``).
        offline: When True, tools listed in :data:`OFFLINE_DISABLED_TOOLS`
            are stripped from every agent's effective tool list before
            the allowlist check runs. Scrubbing is non-fatal: each
            dropped tool is reported as a warning on the per-agent
            result so the caller can log what was removed.
        output_scope: Prefix the output directory must resolve inside.
            Defaults to :data:`DEFAULT_OUTPUT_SCOPE` (``.claude``) —
            matches the verification criterion "Write restricted to
            .claude/ paths". Pass an explicit override (e.g. an absolute
            path rooted in a test tempdir) to relax the check for
            tests or custom deployments.

    A policy with ``allowed_tools=[]`` and ``offline=False`` and the
    default scope still enforces the path prefix but otherwise behaves
    exactly like the pre-policy path, so callers can adopt the
    parameter without a behaviour change.
    """

    allowed_tools: list[str] = field(default_factory=list)
    offline: bool = False
    output_scope: str = DEFAULT_OUTPUT_SCOPE


@dataclass
class BatchAgentResult:
    """Outcome of generating a single agent in a batch.

    ``warnings`` carries non-fatal notes (e.g. tools stripped by
    BatchPolicy.offline). Fatal issues go in ``errors`` and cause
    ``success`` to be False. Kept separate so callers can log
    warnings without treating them as failures.
    """

    name: str
    success: bool
    output_path: str = ""
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class BatchResult:
    """Aggregate result of a batch generation run."""

    ecosystem: str
    success: bool
    agents: list[BatchAgentResult] = field(default_factory=list)
    cross_validation_errors: list[str] = field(default_factory=list)


def load_batch_spec(path: Path | str) -> BatchSpec:
    """Parse a batch-spec JSON file into a :class:`BatchSpec`.

    Expected JSON shape::

        {
          "name": "review-team",
          "description": "Code review ecosystem",
          "shared_tools": ["Read"],
          "agents": [
            {
              "name": "reviewer",
              "description": "Reviews code",
              "tools": ["Read", "Grep"],
              "user_invocable": true,
              "skills": ["security-checklist"]
            },
            ...
          ]
        }

    Raises ``FileNotFoundError`` for missing files and ``ValueError`` for
    malformed JSON or missing required top-level fields. Unknown fields
    on either the ecosystem or an individual agent are ignored — this
    keeps the parser forward-compatible without silently swallowing
    mistakes on required fields.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Batch spec not found: {p}")
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Batch spec {p} is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError(f"Batch spec {p} must be a JSON object at the top level.")

    missing = [field_name for field_name in ("name", "description") if field_name not in raw]
    if missing:
        raise ValueError(f"Batch spec {p} missing required field(s): {', '.join(missing)}")

    agents_raw = raw.get("agents", [])
    if not isinstance(agents_raw, list):
        raise ValueError(f"Batch spec {p}: 'agents' must be a list.")

    agents: list[BatchAgentDef] = []
    for idx, entry in enumerate(agents_raw):
        if not isinstance(entry, dict):
            raise ValueError(
                f"Batch spec {p}: agents[{idx}] must be an object, got {type(entry).__name__}"
            )
        missing_agent = [f for f in ("name", "description") if f not in entry]
        if missing_agent:
            raise ValueError(
                f"Batch spec {p}: agents[{idx}] missing field(s): {', '.join(missing_agent)}"
            )
        agents.append(
            BatchAgentDef(
                name=str(entry["name"]),
                description=str(entry["description"]),
                tools=list(entry.get("tools", [])),
                model=entry.get("model"),
                user_invocable=bool(entry.get("user_invocable", False)),
                skills=list(entry.get("skills", [])),
            )
        )

    return BatchSpec(
        name=str(raw["name"]),
        description=str(raw["description"]),
        agents=agents,
        shared_tools=list(raw.get("shared_tools", [])),
    )


def validate_batch_spec(spec: BatchSpec) -> list[str]:
    """Return a list of cross-agent validation errors; empty list means OK.

    Checks:

    - Ecosystem has at least one agent (empty spec is always a bug).
    - Agent names are unique (duplicates would overwrite each other).
    - Every ``skills`` entry references a name that exists either in the
      batch itself or in the broader skills catalog. We only validate
      the batch-local references here; discovery of already-installed
      skills lives in :mod:`agent_generator.discover_available_skills`
      and is not re-done here to keep this validator offline-friendly.

    Errors are descriptive enough that the caller can surface them
    verbatim without additional context.
    """
    errors: list[str] = []
    if not spec.agents:
        errors.append(f"Ecosystem '{spec.name}' has no agents — nothing to generate.")
        return errors

    names = [a.name for a in spec.agents]
    seen: set[str] = set()
    duplicates: list[str] = []
    for name in names:
        if name in seen and name not in duplicates:
            duplicates.append(name)
        seen.add(name)
    for dup in duplicates:
        errors.append(
            f"Duplicate agent name '{dup}' in ecosystem '{spec.name}' — "
            "each agent must have a unique name."
        )

    # Skill references: accept either a skill shipped in the batch
    # (rare but possible — some ecosystems define an agent that
    # companions another agent) OR a skill the caller will provide
    # externally. We can only flag obviously-broken cases: a skill
    # reference that looks like it should match a sibling agent but
    # doesn't. Intentionally conservative so we don't false-positive
    # on legitimate external skill references.
    agent_names = set(names)
    for agent in spec.agents:
        for skill in agent.skills:
            if skill.startswith(spec.name + "-") and skill not in agent_names:
                errors.append(
                    f"Agent '{agent.name}' references skill '{skill}' "
                    f"that looks ecosystem-local but no such agent exists in '{spec.name}'."
                )

    return errors


def _resolve_output_scope(scope: str) -> Path:
    """Resolve a scope string to an absolute Path without requiring it exist.

    ``Path.resolve()`` on a non-existent path still normalises segments;
    we don't pass ``strict=True`` because the scope directory is allowed
    to not yet exist at policy-check time (it's created later by
    ``generate_batch``).
    """
    return Path(scope).resolve()


def _path_is_within(candidate: Path, scope: Path) -> bool:
    """Return True iff ``candidate`` resolves inside ``scope`` (inclusive).

    Uses ``Path.is_relative_to`` on 3.9+. Needed instead of a string
    ``startswith`` check because ``/.claude-evil`` would pass a naive
    prefix match against ``/.claude``.
    """
    try:
        return candidate == scope or candidate.is_relative_to(scope)
    except AttributeError:  # pragma: no cover — Python <3.9 fallback
        try:
            candidate.relative_to(scope)
            return True
        except ValueError:
            return False


def _apply_offline_scrub(
    tools: list[str],
) -> tuple[list[str], list[str]]:
    """Return (kept, dropped) after removing OFFLINE_DISABLED_TOOLS.

    Preserves input order for kept tools so the resulting frontmatter
    stays stable across runs (easier to diff in review).
    """
    disabled = set(OFFLINE_DISABLED_TOOLS)
    kept: list[str] = []
    dropped: list[str] = []
    for tool in tools:
        if tool in disabled:
            if tool not in dropped:
                dropped.append(tool)
        else:
            kept.append(tool)
    return kept, dropped


def enforce_batch_policy(
    spec: BatchSpec,
    policy: BatchPolicy,
    output_dir: Path | str,
) -> list[str]:
    """Return a list of policy violations; empty list means policy is satisfied.

    Checks are ordered from cheapest to most thorough so callers that
    short-circuit on the first batch of errors still surface the most
    obvious misconfigurations first:

    1. **Output path scope**: ``output_dir`` must resolve inside
       ``policy.output_scope`` (also resolved). Violating this is a
       blocking error because it can silently write generated agents
       outside the expected tree — the primary concern called out in
       the verification criterion.
    2. **allowedTools allowlist**: each agent's *effective* tools (its
       own declared tools + ``shared_tools``, after offline scrubbing
       when ``policy.offline`` is True) must be a subset of
       ``policy.allowed_tools``. An empty allowlist disables this
       check — use case: operators who want only offline scrubbing and
       path scoping without enumerating tools.

    The function does not mutate ``spec`` — scrubbing is simulated here
    and re-applied by :func:`_batch_agent_to_definition` when the
    policy is threaded through to :func:`generate_batch`.
    """
    violations: list[str] = []

    scope = _resolve_output_scope(policy.output_scope)
    resolved_out = Path(output_dir).resolve()
    if not _path_is_within(resolved_out, scope):
        violations.append(
            f"Output path '{resolved_out}' is outside the allowed scope '{scope}' — "
            f"batch generation restricted to '{policy.output_scope}' by policy."
        )

    if policy.allowed_tools:
        allowed = set(policy.allowed_tools)
        for agent in spec.agents:
            effective: list[str] = list(agent.tools)
            for tool in spec.shared_tools:
                if tool not in effective:
                    effective.append(tool)
            if policy.offline:
                effective, _ = _apply_offline_scrub(effective)
            disallowed = sorted(t for t in effective if t not in allowed)
            if disallowed:
                violations.append(
                    f"Agent '{agent.name}' requests tools not in --allowedTools "
                    f"allowlist: {', '.join(disallowed)}. Allowed: "
                    f"{', '.join(sorted(allowed))}."
                )

    return violations


def _batch_agent_to_definition(
    batch_agent: BatchAgentDef,
    shared_tools: list[str],
    policy: BatchPolicy | None = None,
) -> tuple[AgentDefinition, list[str]]:
    """Translate a BatchAgentDef + shared tools into an AgentDefinition.

    Shared tools are merged via set union so the agent's own declared
    tools take precedence for ordering (agent tools first, shared tools
    appended) but no tool is listed twice.

    When ``policy.offline`` is True, tools in
    :data:`OFFLINE_DISABLED_TOOLS` are removed from the merged list and
    returned separately as per-agent warnings so the caller can
    surface what was dropped without treating scrubbing as a failure.
    """
    merged_tools: list[str] = list(batch_agent.tools)
    for tool in shared_tools:
        if tool not in merged_tools:
            merged_tools.append(tool)

    warnings: list[str] = []
    if policy is not None and policy.offline:
        merged_tools, dropped = _apply_offline_scrub(merged_tools)
        if dropped:
            warnings.append(
                f"Offline mode: stripped tools {dropped} from agent "
                f"'{batch_agent.name}' — unattended run cannot reach the network."
            )

    return (
        AgentDefinition(
            name=batch_agent.name,
            description=batch_agent.description,
            tools=merged_tools,
            model=batch_agent.model,
            user_invocable=batch_agent.user_invocable,
            skills=list(batch_agent.skills),
        ),
        warnings,
    )


def generate_batch(
    spec: BatchSpec,
    output_dir: Path | str = DEFAULT_BATCH_OUTPUT_DIR,
    policy: BatchPolicy | None = None,
) -> BatchResult:
    """Generate every agent in ``spec`` under ``output_dir``.

    Workflow:

    1. Call :func:`validate_batch_spec`. If cross-validation produces any
       errors, no files are written and the returned BatchResult has
       ``success=False`` and ``cross_validation_errors`` populated.
    2. Ensure ``output_dir`` exists (``mkdir(parents=True)``).
    3. For each agent, render the frontmatter-only agent file and write
       it to ``<output_dir>/<name>.md``. Per-agent write failures are
       recorded in :class:`BatchAgentResult.errors` but don't halt the
       batch — the caller sees a partial success and can retry only
       the failed agents.

    The agent body is intentionally frontmatter-only. Batch generation
    is a scaffolding operation; prose (examples, error handling) is
    left to a follow-up hand-edit or to the full agent_generator
    pipeline invoked per agent.

    Returns a :class:`BatchResult` whose ``success`` is True only when
    cross-validation passed AND every agent wrote successfully.

    When ``policy`` is not None, :func:`enforce_batch_policy` runs after
    structural validation. Policy violations are fatal — they populate
    ``cross_validation_errors`` and short-circuit the write loop exactly
    like duplicate-name errors. Per-agent offline-scrub notes land on
    each :class:`BatchAgentResult.warnings` list without affecting
    ``success``.
    """
    errors = validate_batch_spec(spec)
    if errors:
        return BatchResult(
            ecosystem=spec.name,
            success=False,
            cross_validation_errors=errors,
        )

    if policy is not None:
        policy_errors = enforce_batch_policy(spec, policy, output_dir)
        if policy_errors:
            return BatchResult(
                ecosystem=spec.name,
                success=False,
                cross_validation_errors=policy_errors,
            )

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    results: list[BatchAgentResult] = []
    all_succeeded = True
    for batch_agent in spec.agents:
        definition, warnings = _batch_agent_to_definition(batch_agent, spec.shared_tools, policy)
        frontmatter = generate_frontmatter(definition)
        body = f"\n# {definition.name}\n\n## Overview\n\n{definition.description}\n"
        content = frontmatter + "\n" + body
        path = out / f"{definition.name}{BATCH_AGENT_FILE_EXTENSION}"
        try:
            path.write_text(content, encoding="utf-8")
        except OSError as exc:
            all_succeeded = False
            results.append(
                BatchAgentResult(
                    name=definition.name,
                    success=False,
                    errors=[f"Failed to write {path}: {exc}"],
                    warnings=warnings,
                )
            )
            continue
        results.append(
            BatchAgentResult(
                name=definition.name,
                success=True,
                output_path=str(path),
                warnings=warnings,
            )
        )

    return BatchResult(
        ecosystem=spec.name,
        success=all_succeeded,
        agents=results,
    )
