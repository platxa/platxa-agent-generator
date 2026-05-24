"""Tests for :mod:`platxa_agent_generator.verdict_aggregator`.

Verification criteria for feature #42 (EVALUATION):
    1. All axes MET → APPROVE
    2. One MEDIUM UNMET → ITERATE
    3. One CRITICAL UNMET → REJECT
"""

from __future__ import annotations

import pytest

from platxa_agent_generator.evaluation_criteria import EvaluationRubric
from platxa_agent_generator.verdict_aggregator import (
    AxisResult,
    aggregate_from_rubric,
    aggregate_verdict,
)


class TestAggregateVerdict:
    """Core severity-floor verdict logic."""

    def test_all_met_returns_approve(self) -> None:
        results = [
            AxisResult(name="clarity", met=True, severity="MEDIUM"),
            AxisResult(name="completeness", met=True, severity="HIGH"),
            AxisResult(name="security", met=True, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "APPROVE"
        assert verdict.blocking_axes == ()
        assert verdict.warning_axes == ()
        assert verdict.passed is True

    def test_one_medium_unmet_returns_iterate(self) -> None:
        results = [
            AxisResult(name="clarity", met=False, severity="MEDIUM"),
            AxisResult(name="completeness", met=True, severity="HIGH"),
            AxisResult(name="security", met=True, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "ITERATE"
        assert verdict.blocking_axes == ("clarity",)
        assert verdict.warning_axes == ()
        assert verdict.passed is False

    def test_one_high_unmet_returns_iterate(self) -> None:
        results = [
            AxisResult(name="completeness", met=False, severity="HIGH"),
            AxisResult(name="clarity", met=True, severity="MEDIUM"),
            AxisResult(name="security", met=True, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "ITERATE"
        assert verdict.blocking_axes == ("completeness",)

    def test_one_low_unmet_returns_iterate(self) -> None:
        results = [
            AxisResult(name="documentation", met=False, severity="LOW"),
            AxisResult(name="security", met=True, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "ITERATE"
        assert verdict.blocking_axes == ("documentation",)

    def test_one_critical_unmet_returns_reject(self) -> None:
        results = [
            AxisResult(name="clarity", met=True, severity="MEDIUM"),
            AxisResult(name="security", met=False, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "REJECT"
        assert verdict.blocking_axes == ("security",)
        assert verdict.warning_axes == ()
        assert verdict.passed is False

    def test_critical_plus_medium_unmet_returns_reject(self) -> None:
        results = [
            AxisResult(name="clarity", met=False, severity="MEDIUM"),
            AxisResult(name="security", met=False, severity="CRITICAL"),
            AxisResult(name="completeness", met=True, severity="HIGH"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "REJECT"
        assert verdict.blocking_axes == ("security",)
        assert verdict.warning_axes == ("clarity",)

    def test_multiple_critical_unmet_all_blocking(self) -> None:
        results = [
            AxisResult(name="security", met=False, severity="CRITICAL"),
            AxisResult(name="completeness", met=False, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "REJECT"
        assert verdict.blocking_axes == ("completeness", "security")

    def test_multiple_non_critical_unmet_returns_iterate(self) -> None:
        results = [
            AxisResult(name="clarity", met=False, severity="MEDIUM"),
            AxisResult(name="documentation", met=False, severity="LOW"),
            AxisResult(name="completeness", met=False, severity="HIGH"),
            AxisResult(name="security", met=True, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.verdict == "ITERATE"
        assert verdict.blocking_axes == ("clarity", "completeness", "documentation")
        assert verdict.warning_axes == ()

    def test_empty_results_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            aggregate_verdict([])

    def test_blocking_axes_are_sorted(self) -> None:
        results = [
            AxisResult(name="zebra_axis", met=False, severity="CRITICAL"),
            AxisResult(name="alpha_axis", met=False, severity="CRITICAL"),
        ]
        verdict = aggregate_verdict(results)
        assert verdict.blocking_axes == ("alpha_axis", "zebra_axis")


class TestAggregateFromRubric:
    """Convenience wrapper using rubric severity lookup."""

    @pytest.fixture
    def rubric(self) -> EvaluationRubric:
        return EvaluationRubric.load_default()

    def test_no_unmet_returns_approve(self, rubric: EvaluationRubric) -> None:
        verdict = aggregate_from_rubric([], rubric)
        assert verdict.verdict == "APPROVE"
        assert verdict.passed is True

    def test_security_unmet_returns_reject(self, rubric: EvaluationRubric) -> None:
        assert rubric.axis("security").severity_on_unmet == "CRITICAL"
        verdict = aggregate_from_rubric(["security"], rubric)
        assert verdict.verdict == "REJECT"
        assert "security" in verdict.blocking_axes

    def test_clarity_unmet_returns_iterate(self, rubric: EvaluationRubric) -> None:
        assert rubric.axis("clarity").severity_on_unmet != "CRITICAL"
        verdict = aggregate_from_rubric(["clarity"], rubric)
        assert verdict.verdict == "ITERATE"
        assert "clarity" in verdict.blocking_axes

    def test_completeness_unmet_returns_iterate(self, rubric: EvaluationRubric) -> None:
        verdict = aggregate_from_rubric(["completeness"], rubric)
        assert verdict.verdict == "ITERATE"

    def test_documentation_unmet_returns_iterate(self, rubric: EvaluationRubric) -> None:
        verdict = aggregate_from_rubric(["documentation"], rubric)
        assert verdict.verdict == "ITERATE"

    def test_security_plus_clarity_unmet_returns_reject(self, rubric: EvaluationRubric) -> None:
        verdict = aggregate_from_rubric(["security", "clarity"], rubric)
        assert verdict.verdict == "REJECT"
        assert "security" in verdict.blocking_axes
        assert "clarity" in verdict.warning_axes

    def test_unknown_axis_raises_value_error(self, rubric: EvaluationRubric) -> None:
        with pytest.raises(ValueError, match="unknown axis"):
            aggregate_from_rubric(["nonexistent_axis"], rubric)

    def test_all_non_critical_unmet_returns_iterate(self, rubric: EvaluationRubric) -> None:
        non_critical = [a.name for a in rubric.axes if a.severity_on_unmet != "CRITICAL"]
        verdict = aggregate_from_rubric(non_critical, rubric)
        assert verdict.verdict == "ITERATE"
        assert len(verdict.blocking_axes) == len(non_critical)
