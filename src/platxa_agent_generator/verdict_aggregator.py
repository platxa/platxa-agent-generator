"""Severity-floor verdict aggregation for the evaluator-subagent.

Implements the mechanical rule that determines the final evaluation verdict
from per-axis MET/UNMET results:

    APPROVE — all axes MET
    ITERATE — any axis UNMET with severity < CRITICAL
    REJECT  — any axis UNMET with severity == CRITICAL

The aggregation is deterministic and independent of axis weights (which
are informational scoring inputs, not verdict drivers). This separation
prevents judge subjectivity from leaking into the final disposition.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from platxa_agent_generator.evaluation_criteria import (
    EvaluationRubric,
    Severity,
)

Verdict = Literal["APPROVE", "ITERATE", "REJECT"]


@dataclass(frozen=True)
class AxisResult:
    """Per-axis evaluation outcome from a judge dispatch."""

    name: str
    met: bool
    severity: Severity


@dataclass(frozen=True)
class AggregatedVerdict:
    """The final verdict with the axes that drove it.

    ``blocking_axes`` always holds the axes that caused this specific
    verdict level (CRITICAL for REJECT, non-critical for ITERATE).
    ``warning_axes`` holds secondary unmet axes that did not escalate
    the verdict (only populated on REJECT when non-critical axes also failed).
    """

    verdict: Verdict
    blocking_axes: tuple[str, ...]
    warning_axes: tuple[str, ...]

    @property
    def passed(self) -> bool:
        """Whether the verdict allows forward progress without changes."""
        return self.verdict == "APPROVE"


def aggregate_verdict(
    axis_results: Sequence[AxisResult],
) -> AggregatedVerdict:
    """Compute the severity-floor verdict from per-axis outcomes.

    Parameters
    ----------
    axis_results:
        One ``AxisResult`` per evaluated axis. Axes marked ``met=True``
        contribute nothing to the verdict. Axes marked ``met=False``
        contribute their ``severity`` to the floor calculation.

    Returns
    -------
    AggregatedVerdict
        The computed verdict plus the axes that drove or influenced it.

    Raises
    ------
    ValueError
        If ``axis_results`` is empty.
    """
    if not axis_results:
        raise ValueError("axis_results must be non-empty")

    blocking: list[str] = []
    warning: list[str] = []

    for result in axis_results:
        if result.met:
            continue
        if result.severity == "CRITICAL":
            blocking.append(result.name)
        else:
            warning.append(result.name)

    if blocking:
        return AggregatedVerdict(
            verdict="REJECT",
            blocking_axes=tuple(sorted(blocking)),
            warning_axes=tuple(sorted(warning)),
        )

    if warning:
        return AggregatedVerdict(
            verdict="ITERATE",
            blocking_axes=tuple(sorted(warning)),
            warning_axes=(),
        )

    return AggregatedVerdict(
        verdict="APPROVE",
        blocking_axes=(),
        warning_axes=(),
    )


def aggregate_from_rubric(
    unmet_axes: Sequence[str],
    rubric: EvaluationRubric,
) -> AggregatedVerdict:
    """Compute verdict using axis names and the rubric's severity mapping.

    Convenience wrapper when the caller has only axis names (not full
    ``AxisResult`` objects) — severity is looked up from the rubric.

    Parameters
    ----------
    unmet_axes:
        Names of axes that were judged UNMET.
    rubric:
        The evaluation rubric (provides severity_on_unmet per axis).

    Returns
    -------
    AggregatedVerdict
        The computed verdict.
    """
    unmet_set = set(unmet_axes)
    all_axis_names = {a.name for a in rubric.axes}

    unknown = unmet_set - all_axis_names
    if unknown:
        raise ValueError(f"unknown axis names not in rubric: {sorted(unknown)}")

    results = [
        AxisResult(
            name=axis.name,
            met=axis.name not in unmet_set,
            severity=axis.severity_on_unmet,
        )
        for axis in rubric.axes
    ]
    return aggregate_verdict(results)
