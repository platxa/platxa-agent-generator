"""Builder that serializes per-axis failure evidence into regeneration prompts.

Consumed by the ``team-lead`` orchestrator on an ITERATE verdict from
``gan-evaluator``.  Each unmet axis is rendered with its severity, the
sub-judge evidence, and a one-line suggestion derived from the rubric
criteria.  The output is a markdown fragment appended to the next
generation dispatch so the generator knows exactly what to fix.

Design constraints:
    * Pure function — no I/O, no side effects.
    * Deterministic output for a given input (sorted by severity tier).
    * Rubric is injected, not loaded internally, so callers can test
      without touching the filesystem.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from platxa_agent_generator.evaluation_criteria import (
    SEVERITIES,
    EvaluationRubric,
    Severity,
)

SEVERITY_ORDER: dict[str, int] = {
    "CRITICAL": 0,
    "HIGH": 1,
    "MEDIUM": 2,
    "LOW": 3,
}

assert set(SEVERITY_ORDER.keys()) == SEVERITIES, (
    f"SEVERITY_ORDER drifted from SEVERITIES: "
    f"extra={set(SEVERITY_ORDER.keys()) - SEVERITIES}, "
    f"missing={SEVERITIES - set(SEVERITY_ORDER.keys())}"
)

_HEADING = "## Prior iteration findings to address"


@dataclass(frozen=True)
class Finding:
    """One finding from the gan-evaluator output."""

    axis: str
    severity: Severity
    summary: str
    location: str


def _parse_finding(raw: dict[str, object]) -> Finding:
    """Coerce a raw dict into a ``Finding``, raising ``ValueError`` on bad data."""
    axis = raw.get("axis")
    if not isinstance(axis, str) or not axis.strip():
        raise ValueError(f"finding missing or empty 'axis': {raw!r}")
    severity = raw.get("severity")
    if severity not in SEVERITIES:
        raise ValueError(
            f"finding has invalid severity {severity!r}; must be one of {sorted(SEVERITIES)}"
        )
    summary = raw.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError(f"finding missing or empty 'summary': {raw!r}")
    location = raw.get("location", "")
    if not isinstance(location, str):
        raise ValueError(f"finding 'location' must be a string, got {type(location).__name__}")
    return Finding(
        axis=axis.strip(),
        severity=severity,  # type: ignore[arg-type]
        summary=summary.strip(),
        location=location.strip(),
    )


def _suggestion_for_axis(axis_name: str, rubric: EvaluationRubric) -> str:
    """Derive a one-line suggestion from the rubric criteria for *axis_name*."""
    try:
        axis = rubric.axis(axis_name)
    except KeyError:
        return f"Address the {axis_name} axis."
    criteria = axis.criteria.strip()
    if criteria.endswith("."):
        criteria = criteria[:-1]
    return f"Ensure: {criteria}."


def _render_axis_block(
    axis_name: str,
    severity: str,
    findings: list[Finding],
    suggestion: str,
) -> str:
    """Render the markdown block for a single axis."""
    lines: list[str] = []
    lines.append(f"### {axis_name} — {severity}")
    lines.append("")
    for f in findings:
        loc = f" (`{f.location}`)" if f.location else ""
        lines.append(f"- {f.summary}{loc}")
    lines.append("")
    lines.append(f"**Suggestion:** {suggestion}")
    return "\n".join(lines)


def build_regeneration_prompt(
    findings: Sequence[dict[str, object]],
    blocking_axes: Sequence[str],
    warning_axes: Sequence[str],
    rubric: EvaluationRubric | None = None,
) -> str:
    """Serialize per-axis failure evidence into a structured regeneration prompt.

    Parameters
    ----------
    findings:
        The ``findings`` array from the gan-evaluator Structured Result
        JSON.  Each element is a dict with keys ``axis``, ``severity``,
        ``summary``, and ``location``.
    blocking_axes:
        Axis names that drove the ITERATE/REJECT verdict (typically
        CRITICAL or HIGH severity).
    warning_axes:
        Other unmet axes that did not drive the verdict but should still
        be improved.
    rubric:
        The evaluation rubric used to derive per-axis suggestions.  When
        ``None``, the default rubric is loaded via
        ``EvaluationRubric.load_default()``.

    Returns
    -------
    str
        A markdown fragment suitable for appending to a generation prompt.

    Raises
    ------
    ValueError
        If any finding dict is malformed (missing required keys, invalid
        severity).
    """
    if rubric is None:
        rubric = EvaluationRubric.load_default()

    parsed = [_parse_finding(f) for f in findings]

    blocking_set = frozenset(blocking_axes)
    warning_set = frozenset(warning_axes)

    by_axis: dict[str, list[Finding]] = {}
    for f in parsed:
        by_axis.setdefault(f.axis, []).append(f)

    all_axes = sorted(
        blocking_set | warning_set,
        key=lambda a: SEVERITY_ORDER.get(_max_severity(by_axis.get(a, []), rubric, a), 99),
    )

    if not all_axes:
        return ""

    sections: list[str] = [_HEADING, ""]

    for axis_name in all_axes:
        axis_findings = by_axis.get(axis_name, [])
        severity = _max_severity(axis_findings, rubric, axis_name)
        tier = "BLOCKING" if axis_name in blocking_set else "WARNING"
        suggestion = _suggestion_for_axis(axis_name, rubric)
        block = _render_axis_block(axis_name, f"{severity} ({tier})", axis_findings, suggestion)
        sections.append(block)
        sections.append("")

    return "\n".join(sections).rstrip("\n") + "\n"


def _max_severity(
    findings: list[Finding],
    rubric: EvaluationRubric,
    axis_name: str,
) -> str:
    """Return the highest severity among *findings*, falling back to rubric default."""
    if not findings:
        try:
            return rubric.axis(axis_name).severity_on_unmet
        except KeyError:
            return "MEDIUM"
    severities = [f.severity for f in findings]
    return min(severities, key=lambda s: SEVERITY_ORDER.get(s, 99))
