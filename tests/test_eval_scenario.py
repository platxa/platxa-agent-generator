"""Tests for :mod:`platxa_agent_generator.eval_scenario`.

Verification criteria for feature #5 (BEHAVIORAL_EVAL):
    1. The typed model rejects scenarios without binary criteria
       (empty ``success_criteria``).
    2. Valid scenarios load via :meth:`EvalScenario.from_mapping`
       and :meth:`EvalScenario.from_yaml`.
    3. The ``type`` field is constrained to the
       ``regression`` / ``capability`` enum.

Negative tests cover the invariants downstream readers (the eval CLI,
``cluster_failures``, the ``gan-evaluator``) rely on so a drifted
scenario file cannot silently corrupt a run.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from platxa_agent_generator.eval_scenario import (
    SCENARIO_TYPES,
    EvalScenario,
    EvalScenarioValidationError,
)


def _good_payload(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "prompt": "Implement add(a, b) returning a + b.",
        "success_criteria": [
            "module exposes add()",
            "add(2, 3) returns 5",
        ],
        "axis": "correctness",
        "type": "capability",
        "forbidden_tools": ["Edit", "Write"],
    }
    base.update(overrides)
    return base


# --------------------------------------------------------------------------
# Verification criterion 2 — valid scenarios load
# --------------------------------------------------------------------------


def test_from_mapping_loads_valid_capability_scenario() -> None:
    scenario = EvalScenario.from_mapping(_good_payload())
    assert scenario.prompt.startswith("Implement add")
    assert scenario.success_criteria == (
        "module exposes add()",
        "add(2, 3) returns 5",
    )
    assert scenario.axis == "correctness"
    assert scenario.type == "capability"
    assert scenario.forbidden_tools == ("Edit", "Write")
    assert scenario.regression_baseline is None


def test_from_mapping_loads_valid_regression_scenario() -> None:
    scenario = EvalScenario.from_mapping(
        _good_payload(type="regression", regression_baseline="sha256:abc123")
    )
    assert scenario.type == "regression"
    assert scenario.regression_baseline == "sha256:abc123"


def test_forbidden_tools_defaults_to_empty_when_omitted() -> None:
    payload = _good_payload()
    del payload["forbidden_tools"]
    scenario = EvalScenario.from_mapping(payload)
    assert scenario.forbidden_tools == ()


def test_from_yaml_loads_valid_scenario(tmp_path: Path) -> None:
    yaml_path = tmp_path / "scenario.yaml"
    yaml_path.write_text(
        "prompt: Implement add(a, b) returning a + b.\n"
        "success_criteria:\n"
        "  - module exposes add()\n"
        "  - add(2, 3) returns 5\n"
        "axis: correctness\n"
        "type: capability\n"
        "forbidden_tools:\n"
        "  - Edit\n",
        encoding="utf-8",
    )
    scenario = EvalScenario.from_yaml(yaml_path)
    assert scenario.axis == "correctness"
    assert scenario.forbidden_tools == ("Edit",)


# --------------------------------------------------------------------------
# Verification criterion 1 — reject scenarios without binary criteria
# --------------------------------------------------------------------------


def test_from_mapping_rejects_empty_success_criteria() -> None:
    with pytest.raises(EvalScenarioValidationError, match="binary check"):
        EvalScenario.from_mapping(_good_payload(success_criteria=[]))


def test_direct_construction_rejects_empty_success_criteria() -> None:
    with pytest.raises(EvalScenarioValidationError, match="binary check"):
        EvalScenario(
            prompt="x",
            success_criteria=(),
            axis="correctness",
            type="capability",
        )


def test_rejects_blank_string_in_success_criteria() -> None:
    with pytest.raises(EvalScenarioValidationError, match="non-empty"):
        EvalScenario.from_mapping(_good_payload(success_criteria=["valid", "   "]))


# --------------------------------------------------------------------------
# Verification criterion 3 — type enum constraint
# --------------------------------------------------------------------------


def test_rejects_unknown_type() -> None:
    with pytest.raises(EvalScenarioValidationError, match="type must be one of"):
        EvalScenario.from_mapping(_good_payload(type="benchmark"))


def test_scenario_types_matches_literal() -> None:
    assert SCENARIO_TYPES == frozenset({"regression", "capability"})


# --------------------------------------------------------------------------
# Other invariants
# --------------------------------------------------------------------------


def test_rejects_empty_prompt() -> None:
    with pytest.raises(EvalScenarioValidationError, match="prompt"):
        EvalScenario.from_mapping(_good_payload(prompt=""))


def test_rejects_whitespace_only_prompt() -> None:
    with pytest.raises(EvalScenarioValidationError, match="prompt"):
        EvalScenario.from_mapping(_good_payload(prompt="   "))


def test_rejects_empty_axis() -> None:
    with pytest.raises(EvalScenarioValidationError, match="axis"):
        EvalScenario.from_mapping(_good_payload(axis=""))


def test_rejects_blank_string_in_forbidden_tools() -> None:
    with pytest.raises(EvalScenarioValidationError, match="non-empty"):
        EvalScenario.from_mapping(_good_payload(forbidden_tools=["Edit", " "]))


def test_regression_type_requires_baseline() -> None:
    with pytest.raises(EvalScenarioValidationError, match="regression_baseline"):
        EvalScenario.from_mapping(_good_payload(type="regression"))


def test_regression_type_rejects_blank_baseline() -> None:
    with pytest.raises(EvalScenarioValidationError, match="regression_baseline"):
        EvalScenario.from_mapping(_good_payload(type="regression", regression_baseline="   "))


def test_capability_type_allows_missing_baseline() -> None:
    scenario = EvalScenario.from_mapping(_good_payload(type="capability"))
    assert scenario.regression_baseline is None


def test_regression_baseline_must_be_string_when_provided() -> None:
    with pytest.raises(EvalScenarioValidationError, match="regression_baseline"):
        EvalScenario(
            prompt="x",
            success_criteria=("c",),
            axis="correctness",
            type="capability",
            regression_baseline=123,  # type: ignore[arg-type]
        )


# --------------------------------------------------------------------------
# Structural / mapping-level invariants
# --------------------------------------------------------------------------


def test_from_mapping_rejects_non_dict_top_level() -> None:
    with pytest.raises(EvalScenarioValidationError, match="mapping"):
        EvalScenario.from_mapping(["not", "a", "dict"])


def test_from_mapping_rejects_missing_required_keys() -> None:
    payload = _good_payload()
    del payload["axis"]
    with pytest.raises(EvalScenarioValidationError, match="missing required keys"):
        EvalScenario.from_mapping(payload)


def test_from_mapping_rejects_unknown_keys() -> None:
    with pytest.raises(EvalScenarioValidationError, match="unknown keys"):
        EvalScenario.from_mapping(_good_payload(unexpected="boom"))


def test_from_mapping_rejects_non_list_success_criteria() -> None:
    with pytest.raises(EvalScenarioValidationError, match="success_criteria"):
        EvalScenario.from_mapping(_good_payload(success_criteria="not a list"))


def test_from_mapping_rejects_non_list_forbidden_tools() -> None:
    with pytest.raises(EvalScenarioValidationError, match="forbidden_tools"):
        EvalScenario.from_mapping(_good_payload(forbidden_tools="Edit"))


# --------------------------------------------------------------------------
# YAML-level error wrapping
# --------------------------------------------------------------------------


def test_from_yaml_wraps_yaml_parse_errors(tmp_path: Path) -> None:
    bad = tmp_path / "bad.yaml"
    bad.write_text("prompt: [unbalanced\n", encoding="utf-8")
    with pytest.raises(EvalScenarioValidationError, match="failed to parse"):
        EvalScenario.from_yaml(bad)


def test_from_yaml_propagates_validation_errors(tmp_path: Path) -> None:
    bad = tmp_path / "empty_criteria.yaml"
    bad.write_text(
        "prompt: x\nsuccess_criteria: []\naxis: correctness\ntype: capability\n",
        encoding="utf-8",
    )
    with pytest.raises(EvalScenarioValidationError, match="binary check"):
        EvalScenario.from_yaml(bad)


# --------------------------------------------------------------------------
# Frozen-dataclass invariant
# --------------------------------------------------------------------------


def test_eval_scenario_is_frozen() -> None:
    scenario = EvalScenario.from_mapping(_good_payload())
    with pytest.raises(Exception):  # FrozenInstanceError is a dataclass.FrozenInstanceError
        scenario.prompt = "mutated"  # type: ignore[misc]
