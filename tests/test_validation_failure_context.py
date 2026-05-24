"""Tests for :func:`platxa_agent_generator.agent_generator.build_validation_failure_context`.

Verification criteria for feature #44 (EVALUATION):
    Failed validation triggers regeneration with per-criterion findings in
    additionalContext; regenerated prompt mentions specific failed axis.
"""

from __future__ import annotations

import pytest

from platxa_agent_generator.agent_generator import build_validation_failure_context
from platxa_agent_generator.evaluation_criteria import EvaluationAxis, EvaluationRubric
from platxa_agent_generator.quality_scorer import CriterionScore, QualityReport


def _make_rubric() -> EvaluationRubric:
    """Deterministic rubric for testing without filesystem access."""
    return EvaluationRubric(
        axes=(
            EvaluationAxis(
                name="clarity",
                weight=0.20,
                severity_on_unmet="MEDIUM",
                criteria="Clear and unambiguous prompt language.",
            ),
            EvaluationAxis(
                name="completeness",
                weight=0.20,
                severity_on_unmet="HIGH",
                criteria="All required agent components present.",
            ),
            EvaluationAxis(
                name="tool_design",
                weight=0.20,
                severity_on_unmet="HIGH",
                criteria="Minimal-necessary tool grants.",
            ),
            EvaluationAxis(
                name="examples",
                weight=0.15,
                severity_on_unmet="MEDIUM",
                criteria="At least one realistic input/output example.",
            ),
            EvaluationAxis(
                name="security",
                weight=0.15,
                severity_on_unmet="CRITICAL",
                criteria="No credential exposure or destructive actions.",
            ),
            EvaluationAxis(
                name="documentation",
                weight=0.10,
                severity_on_unmet="LOW",
                criteria="Inline comments explain non-obvious decisions.",
            ),
        )
    )


RUBRIC = _make_rubric()


def _make_passing_report() -> QualityReport:
    return QualityReport(
        file_path="test.md",
        total_score=8.5,
        grade="B",
        passed=True,
        criteria=[
            CriterionScore(name="clarity", weight=0.20, score=8.0, weighted_score=1.6),
            CriterionScore(name="completeness", weight=0.20, score=9.0, weighted_score=1.8),
            CriterionScore(name="tool_design", weight=0.20, score=8.0, weighted_score=1.6),
            CriterionScore(name="examples", weight=0.15, score=8.0, weighted_score=1.2),
            CriterionScore(name="security", weight=0.15, score=9.0, weighted_score=1.35),
            CriterionScore(name="documentation", weight=0.10, score=9.0, weighted_score=0.9),
        ],
        summary="Quality Score: 8.5/10 (Grade: B) - PASSED",
    )


def _make_failing_report(
    *,
    failing_axes: dict[str, tuple[float, list[str], list[str]]],
) -> QualityReport:
    """Build a failing report with specific axes below threshold.

    failing_axes maps axis_name -> (score, findings, suggestions).
    Non-failing axes get score 9.0.
    """
    all_axes = ["clarity", "completeness", "tool_design", "examples", "security", "documentation"]
    weights = {
        "clarity": 0.20,
        "completeness": 0.20,
        "tool_design": 0.20,
        "examples": 0.15,
        "security": 0.15,
        "documentation": 0.10,
    }
    criteria: list[CriterionScore] = []
    for axis in all_axes:
        if axis in failing_axes:
            score, findings, suggestions = failing_axes[axis]
            criteria.append(
                CriterionScore(
                    name=axis,
                    weight=weights[axis],
                    score=score,
                    weighted_score=score * weights[axis],
                    findings=findings,
                    suggestions=suggestions,
                )
            )
        else:
            criteria.append(
                CriterionScore(
                    name=axis,
                    weight=weights[axis],
                    score=9.0,
                    weighted_score=9.0 * weights[axis],
                )
            )

    total = sum(c.weighted_score for c in criteria)
    return QualityReport(
        file_path="test.md",
        total_score=round(total, 1),
        grade="D",
        passed=False,
        criteria=criteria,
        summary=f"Quality Score: {total:.1f}/10 - FAILED",
    )


class TestPassingReportReturnsEmpty:
    def test_passing_report_returns_empty_string(self) -> None:
        report = _make_passing_report()
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert result == ""


class TestSingleAxisFailure:
    def test_single_failing_axis_appears_in_output(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "clarity": (4.0, ["Found 5 vague terms", "Inconsistent heading hierarchy"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "### clarity" in result
        assert "Found 5 vague terms" in result
        assert "Inconsistent heading hierarchy" in result

    def test_severity_from_rubric_used(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "security": (3.0, ["Credentials exposed in example"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "CRITICAL" in result
        assert "### security" in result

    def test_suggestions_included_with_prefix(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "completeness": (
                    5.0,
                    ["Missing overview section"],
                    ["Add required section: Overview"],
                ),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "[suggestion] Add required section: Overview" in result

    def test_heading_present(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "examples": (2.0, ["No examples found"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "## Prior iteration findings to address" in result


class TestMultiAxisFailure:
    def test_multiple_failing_axes_all_appear(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "clarity": (4.0, ["Vague language"], []),
                "tool_design": (3.0, ["Overly broad tool grants"], []),
                "security": (2.0, ["Credential leak"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "### clarity" in result
        assert "### tool_design" in result
        assert "### security" in result

    def test_critical_axis_marked_blocking(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "security": (2.0, ["Credential leak"], []),
                "documentation": (5.0, ["No inline comments"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "BLOCKING" in result


class TestEdgeCases:
    def test_no_findings_but_low_score_still_produces_output(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "clarity": (4.0, [], ["Improve structure"]),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "### clarity" in result
        assert "[suggestion] Improve structure" in result

    def test_axis_not_in_rubric_is_skipped(self) -> None:
        report = QualityReport(
            file_path="test.md",
            total_score=5.0,
            grade="D",
            passed=False,
            criteria=[
                CriterionScore(
                    name="unknown_axis",
                    weight=0.5,
                    score=3.0,
                    weighted_score=1.5,
                    findings=["Something wrong"],
                ),
                CriterionScore(
                    name="clarity",
                    weight=0.5,
                    score=3.0,
                    weighted_score=1.5,
                    findings=["Vague language"],
                ),
            ],
            summary="FAILED",
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "unknown_axis" not in result
        assert "### clarity" in result

    def test_all_criteria_above_threshold_returns_empty(self) -> None:
        report = QualityReport(
            file_path="test.md",
            total_score=6.5,
            grade="D",
            passed=False,
            criteria=[
                CriterionScore(name="clarity", weight=0.20, score=7.5, weighted_score=1.5),
                CriterionScore(name="completeness", weight=0.20, score=7.0, weighted_score=1.4),
                CriterionScore(name="tool_design", weight=0.20, score=7.0, weighted_score=1.4),
                CriterionScore(name="examples", weight=0.15, score=7.0, weighted_score=1.05),
                CriterionScore(name="security", weight=0.15, score=7.0, weighted_score=1.05),
                CriterionScore(name="documentation", weight=0.10, score=7.0, weighted_score=0.7),
            ],
            summary="FAILED",
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert result == ""

    def test_custom_min_score_threshold(self) -> None:
        report = _make_failing_report(
            failing_axes={
                "clarity": (6.5, ["Mild vagueness"], []),
            }
        )
        result_default = build_validation_failure_context(report, rubric=RUBRIC)
        assert "### clarity" in result_default

        result_lower = build_validation_failure_context(report, min_score=6.0, rubric=RUBRIC)
        assert result_lower == ""


class TestSuggestionRendering:
    @pytest.mark.parametrize(
        "axis_name",
        sorted(["clarity", "completeness", "tool_design", "examples", "security", "documentation"]),
    )
    def test_suggestion_line_present_for_each_axis(self, axis_name: str) -> None:
        report = _make_failing_report(
            failing_axes={
                axis_name: (3.0, ["A problem"], []),
            }
        )
        result = build_validation_failure_context(report, rubric=RUBRIC)
        assert "**Suggestion:**" in result
