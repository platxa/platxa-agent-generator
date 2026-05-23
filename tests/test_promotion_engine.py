"""Tests for :mod:`platxa_agent_generator.promotion_engine`.

Verification criteria for feature #22:

* Promotion gate returns False at 2 occurrences
* Returns True at 3 occurrences with confidence=0.7 and success_count=1
* Env overrides via PLATXA_PROMOTION_THRESHOLDS are respected
* Edge cases: boundary values, zero thresholds, invalid config

Verification criteria for feature #23:

* Failed-trajectory observation produces cautionary template
* Successful-trajectory observation produces guiding template
* Templates are structurally distinct
"""

from __future__ import annotations

import json
from dataclasses import asdict

import pytest

from platxa_agent_generator.observation_store import ObservationRecord
from platxa_agent_generator.promotion_engine import (
    DEFAULT_CONFIDENCE,
    DEFAULT_OCCURRENCES,
    DEFAULT_SUCCESS_COUNT,
    PromotionConfigError,
    PromotionThresholds,
    distill_principle,
    promote,
)


class TestPromotionThresholds:
    """Unit tests for PromotionThresholds dataclass."""

    def test_defaults(self) -> None:
        t = PromotionThresholds()
        assert t.occurrences == 3
        assert t.confidence == 0.7
        assert t.success_count == 1

    def test_custom_values(self) -> None:
        t = PromotionThresholds(occurrences=5, confidence=0.9, success_count=3)
        assert t.occurrences == 5
        assert t.confidence == 0.9
        assert t.success_count == 3

    def test_frozen(self) -> None:
        t = PromotionThresholds()
        with pytest.raises(AttributeError):
            t.occurrences = 5  # type: ignore[misc]

    def test_negative_occurrences_rejected(self) -> None:
        with pytest.raises(PromotionConfigError, match="occurrences"):
            PromotionThresholds(occurrences=-1)

    def test_confidence_below_zero_rejected(self) -> None:
        with pytest.raises(PromotionConfigError, match="confidence"):
            PromotionThresholds(confidence=-0.1)

    def test_confidence_above_one_rejected(self) -> None:
        with pytest.raises(PromotionConfigError, match="confidence"):
            PromotionThresholds(confidence=1.1)

    def test_negative_success_count_rejected(self) -> None:
        with pytest.raises(PromotionConfigError, match="success_count"):
            PromotionThresholds(success_count=-1)

    def test_zero_thresholds_allowed(self) -> None:
        t = PromotionThresholds(occurrences=0, confidence=0.0, success_count=0)
        assert t.occurrences == 0
        assert t.confidence == 0.0
        assert t.success_count == 0

    def test_boundary_confidence_one(self) -> None:
        t = PromotionThresholds(confidence=1.0)
        assert t.confidence == 1.0


class TestThresholdsFromEnv:
    """Tests for PromotionThresholds.from_env()."""

    def test_unset_returns_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PLATXA_PROMOTION_THRESHOLDS", raising=False)
        t = PromotionThresholds.from_env()
        assert t == PromotionThresholds()

    def test_empty_string_returns_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", "")
        t = PromotionThresholds.from_env()
        assert t == PromotionThresholds()

    def test_whitespace_only_returns_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", "   ")
        t = PromotionThresholds.from_env()
        assert t == PromotionThresholds()

    def test_full_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 5, "confidence": 0.9, "success_count": 2}),
        )
        t = PromotionThresholds.from_env()
        assert t.occurrences == 5
        assert t.confidence == 0.9
        assert t.success_count == 2

    def test_partial_override_occurrences_only(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 10}),
        )
        t = PromotionThresholds.from_env()
        assert t.occurrences == 10
        assert t.confidence == DEFAULT_CONFIDENCE
        assert t.success_count == DEFAULT_SUCCESS_COUNT

    def test_invalid_json_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", "not-json")
        with pytest.raises(PromotionConfigError, match="not valid JSON"):
            PromotionThresholds.from_env()

    def test_non_object_json_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", "[1, 2, 3]")
        with pytest.raises(PromotionConfigError, match="must be a JSON object"):
            PromotionThresholds.from_env()

    def test_invalid_value_in_env_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"confidence": 2.0}),
        )
        with pytest.raises(PromotionConfigError, match="confidence"):
            PromotionThresholds.from_env()

    def test_non_numeric_occurrences_in_env_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", '{"occurrences": "abc"}')
        with pytest.raises(PromotionConfigError, match="unconvertible"):
            PromotionThresholds.from_env()

    def test_none_value_in_env_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", '{"success_count": null}')
        with pytest.raises(PromotionConfigError, match="unconvertible"):
            PromotionThresholds.from_env()


class TestThresholdsFromDict:
    """Tests for PromotionThresholds.from_dict()."""

    def test_empty_dict_returns_defaults(self) -> None:
        t = PromotionThresholds.from_dict({})
        assert t == PromotionThresholds()

    def test_full_dict(self) -> None:
        t = PromotionThresholds.from_dict({"occurrences": 7, "confidence": 0.8, "success_count": 3})
        assert t.occurrences == 7
        assert t.confidence == 0.8
        assert t.success_count == 3

    def test_partial_dict(self) -> None:
        t = PromotionThresholds.from_dict({"success_count": 5})
        assert t.occurrences == DEFAULT_OCCURRENCES
        assert t.confidence == DEFAULT_CONFIDENCE
        assert t.success_count == 5

    def test_non_numeric_value_in_from_dict_raises(self) -> None:
        with pytest.raises(PromotionConfigError, match="unconvertible"):
            PromotionThresholds.from_dict({"occurrences": "abc"})


class TestPromote:
    """Tests for the promote() gate function."""

    def test_below_occurrences_threshold(self) -> None:
        result = promote(
            occurrences=2,
            confidence=0.7,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is False
        assert len(result.failing_gates) == 1
        assert "occurrences=2" in result.failing_gates[0]

    def test_at_exact_thresholds_passes(self) -> None:
        result = promote(
            occurrences=3,
            confidence=0.7,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is True
        assert result.failing_gates == ()

    def test_above_thresholds_passes(self) -> None:
        result = promote(
            occurrences=10,
            confidence=0.95,
            success_count=5,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is True
        assert result.failing_gates == ()

    def test_below_confidence_threshold(self) -> None:
        result = promote(
            occurrences=3,
            confidence=0.5,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is False
        assert any("confidence" in g for g in result.failing_gates)

    def test_zero_success_count_fails_default(self) -> None:
        result = promote(
            occurrences=3,
            confidence=0.7,
            success_count=0,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is False
        assert any("success_count" in g for g in result.failing_gates)

    def test_multiple_failing_gates(self) -> None:
        result = promote(
            occurrences=1,
            confidence=0.1,
            success_count=0,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is False
        assert len(result.failing_gates) == 3

    def test_result_carries_input_values(self) -> None:
        thresholds = PromotionThresholds(occurrences=5, confidence=0.8, success_count=2)
        result = promote(
            occurrences=6,
            confidence=0.9,
            success_count=3,
            thresholds=thresholds,
        )
        assert result.occurrences == 6
        assert result.confidence == 0.9
        assert result.success_count == 3
        assert result.thresholds is thresholds

    def test_env_override_respected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 1, "confidence": 0.1, "success_count": 0}),
        )
        result = promote(occurrences=1, confidence=0.1, success_count=0)
        assert result.eligible is True

    def test_env_override_tightened(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 10}),
        )
        result = promote(occurrences=3, confidence=0.7, success_count=1)
        assert result.eligible is False
        assert "occurrences=3" in result.failing_gates[0]

    def test_explicit_thresholds_override_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 100}),
        )
        result = promote(
            occurrences=3,
            confidence=0.7,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        assert result.eligible is True

    def test_result_is_frozen(self) -> None:
        result = promote(
            occurrences=3,
            confidence=0.7,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        with pytest.raises(AttributeError):
            result.eligible = False  # type: ignore[misc]


class TestPromotionResultShape:
    """Verify PromotionResult fields and types."""

    def test_fields_present(self) -> None:
        result = promote(
            occurrences=3,
            confidence=0.7,
            success_count=1,
            thresholds=PromotionThresholds(),
        )
        assert isinstance(result.eligible, bool)
        assert isinstance(result.occurrences, int)
        assert isinstance(result.confidence, float)
        assert isinstance(result.success_count, int)
        assert isinstance(result.thresholds, PromotionThresholds)
        assert isinstance(result.failing_gates, tuple)


# -- helpers for distill_principle tests ------------------------------------


def _obs(
    *,
    tool: str = "Read",
    type_: str = "tool_use",
    input_summary: str = "read config file",
    outcome: str = "",
    confidence: float = 0.8,
    evidence: str = "observed three times",
    examples: list[str] | None = None,
    project_id: str = "proj-abc",
) -> ObservationRecord:
    return ObservationRecord(
        timestamp="2026-05-24T10:00:00Z",
        tool=tool,
        input_summary=input_summary,
        project_id=project_id,
        project_name="test-project",
        session_id="sess-1",
        agent_name="test-agent",
        type=type_,  # type: ignore[arg-type]
        evidence=evidence,
        examples=examples if examples is not None else ["example-1"],
        outcome=outcome,
        confidence=confidence,
    )


class TestDistillPrincipleGuiding:
    """Success-trajectory observations produce guiding principles."""

    def test_success_outcome_sets_guiding_action(self) -> None:
        result = distill_principle(_obs(), "success")
        assert "Prefer this approach" in result.action
        assert "successful outcome" in result.action

    def test_success_sets_success_count_one(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.success_count == 1

    def test_success_description_starts_with_guiding(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.description.startswith("Guiding:")

    def test_success_outcome_field(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.outcome == "success"


class TestDistillPrincipleCautionary:
    """Failed-trajectory observations produce cautionary principles."""

    def test_failure_outcome_sets_cautionary_action(self) -> None:
        result = distill_principle(_obs(), "failure")
        assert "Avoid this approach" in result.action
        assert "negative outcome" in result.action

    def test_failure_includes_redirect(self) -> None:
        result = distill_principle(_obs(), "failure")
        assert "Consider alternative" in result.action

    def test_failure_sets_success_count_zero(self) -> None:
        result = distill_principle(_obs(), "failure")
        assert result.success_count == 0

    def test_failure_description_starts_with_cautionary(self) -> None:
        result = distill_principle(_obs(), "failure")
        assert result.description.startswith("Cautionary:")

    def test_failure_outcome_field(self) -> None:
        result = distill_principle(_obs(), "failure")
        assert result.outcome == "failure"


class TestDistillPrincipleAsymmetry:
    """Guiding and cautionary templates are structurally distinct."""

    def test_templates_produce_different_actions(self) -> None:
        obs = _obs()
        guiding = distill_principle(obs, "success")
        cautionary = distill_principle(obs, "failure")
        assert guiding.action != cautionary.action

    def test_templates_produce_different_descriptions(self) -> None:
        obs = _obs()
        guiding = distill_principle(obs, "success")
        cautionary = distill_principle(obs, "failure")
        assert guiding.description != cautionary.description

    def test_success_count_differs(self) -> None:
        obs = _obs()
        guiding = distill_principle(obs, "success")
        cautionary = distill_principle(obs, "failure")
        assert guiding.success_count == 1
        assert cautionary.success_count == 0

    def test_cautionary_action_is_longer(self) -> None:
        obs = _obs()
        guiding = distill_principle(obs, "success")
        cautionary = distill_principle(obs, "failure")
        assert len(cautionary.action) > len(guiding.action)


class TestDistillPrincipleFields:
    """Verify field mapping from ObservationRecord to DistilledPrinciple."""

    def test_name_within_length_limit(self) -> None:
        result = distill_principle(_obs(), "success")
        assert len(result.name) <= 64

    def test_name_is_hyphen_case(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.name == result.name.lower()
        assert " " not in result.name

    def test_description_within_length_limit(self) -> None:
        long_summary = "x" * 600
        result = distill_principle(_obs(input_summary=long_summary), "success")
        assert len(result.description) <= 512

    def test_type_inherited_from_observation(self) -> None:
        result = distill_principle(_obs(type_="decision"), "success")
        assert result.type == "decision"

    def test_confidence_inherited_from_observation(self) -> None:
        result = distill_principle(_obs(confidence=0.42), "failure")
        assert result.confidence == 0.42

    def test_timestamps_from_observation(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.created == "2026-05-24T10:00:00Z"
        assert result.last_seen == "2026-05-24T10:00:00Z"

    def test_project_scope_from_project_id(self) -> None:
        result = distill_principle(_obs(project_id="my-proj"), "success")
        assert result.project_scope == "my-proj"

    def test_occurrences_starts_at_one(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.occurrences == 1

    def test_usage_count_starts_at_zero(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.usage_count == 0

    def test_ttl_days_default(self) -> None:
        result = distill_principle(_obs(), "success")
        assert result.ttl_days == 30

    def test_evidence_from_observation(self) -> None:
        result = distill_principle(_obs(evidence="saw it twice"), "success")
        assert result.evidence == "saw it twice"

    def test_examples_formatted_as_markdown_list(self) -> None:
        result = distill_principle(_obs(examples=["a", "b"]), "success")
        assert "- a" in result.examples
        assert "- b" in result.examples

    def test_empty_examples_yields_empty_string(self) -> None:
        result = distill_principle(_obs(examples=[]), "success")
        assert result.examples == ""

    def test_outcome_detail_included_when_present(self) -> None:
        result = distill_principle(_obs(outcome="cache hit rate improved"), "success")
        assert "cache hit rate improved" in result.action

    def test_outcome_detail_absent_when_empty(self) -> None:
        result = distill_principle(_obs(outcome=""), "success")
        assert " — " not in result.action

    def test_context_includes_tool_and_type(self) -> None:
        result = distill_principle(_obs(tool="Grep", type_="discovery"), "success")
        assert "Grep" in result.action
        assert "discovery" in result.action

    def test_frozen_dataclass(self) -> None:
        result = distill_principle(_obs(), "success")
        with pytest.raises(AttributeError):
            result.action = "changed"  # type: ignore[misc]

    def test_asdict_roundtrip(self) -> None:
        result = distill_principle(_obs(), "success")
        d = asdict(result)
        assert d["name"] == result.name
        assert d["action"] == result.action
        assert d["outcome"] == "success"

    def test_same_observation_different_outcomes_different_names(self) -> None:
        obs = _obs()
        g = distill_principle(obs, "success")
        c = distill_principle(obs, "failure")
        assert g.name != c.name
