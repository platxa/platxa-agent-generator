"""Tests for :mod:`platxa_agent_generator.mutation_registry`.

Verification criteria for feature #70 (META):
    1. All 6 operators registered in ``templates/mutation-operators.yaml``.
    2. Each operator has ``describe()`` and ``apply(content)`` interface.
    3. Registry loads without errors via ``load_default()``.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from platxa_agent_generator.mutation_registry import (
    KNOWN_OPERATOR_NAMES,
    OPERATOR_COUNT,
    SCOPES,
    MutationOperator,
    MutationOperatorError,
    MutationRegistry,
    default_operators_path,
)

# --------------------------------------------------------------------------
# Verification criteria 1–3 (the canonical templates/mutation-operators.yaml)
# --------------------------------------------------------------------------


def test_default_operators_path_points_to_repo_template() -> None:
    path = default_operators_path()
    assert path.name == "mutation-operators.yaml"
    assert path.parent.name == "templates"
    assert path.is_file(), f"canonical operators missing at {path}"


def test_default_registry_loads_into_typed_model() -> None:
    registry = MutationRegistry.load_default()
    assert isinstance(registry, MutationRegistry)
    assert len(registry.operators) == OPERATOR_COUNT


def test_default_registry_all_six_operators_present() -> None:
    registry = MutationRegistry.load_default()
    names = {op.name for op in registry.operators}
    assert names == KNOWN_OPERATOR_NAMES


def test_default_registry_all_operators_have_valid_scope() -> None:
    registry = MutationRegistry.load_default()
    for op in registry.operators:
        assert op.scope in SCOPES, f"operator {op.name} has invalid scope {op.scope!r}"
        assert op.description.strip(), f"operator {op.name} has empty description"
        assert op.rules.strip(), f"operator {op.name} has empty rules"


def test_default_registry_names_lookup() -> None:
    registry = MutationRegistry.load_default()
    assert registry.names() == KNOWN_OPERATOR_NAMES


def test_operator_lookup_returns_matching_operator_or_keyerror() -> None:
    registry = MutationRegistry.load_default()
    op = registry.operator("synonym")
    assert op.name == "synonym"
    with pytest.raises(KeyError):
        registry.operator("nonexistent")


# --------------------------------------------------------------------------
# describe() interface
# --------------------------------------------------------------------------


def test_describe_returns_name_scope_and_description() -> None:
    registry = MutationRegistry.load_default()
    for op in registry.operators:
        desc = op.describe()
        assert op.name in desc
        assert op.scope in desc
        assert isinstance(desc, str)
        assert len(desc) > 0


# --------------------------------------------------------------------------
# apply(content) interface
# --------------------------------------------------------------------------


def test_apply_returns_task_dispatchable_prompt() -> None:
    registry = MutationRegistry.load_default()
    content = "---\nname: test-agent\n---\n\n# Test Agent\n\nDo things."
    for op in registry.operators:
        prompt = op.apply(content)
        assert isinstance(prompt, str)
        assert op.name in prompt
        assert op.rules in prompt
        assert content in prompt
        assert "markdown" in prompt


def test_apply_includes_scope_in_prompt() -> None:
    registry = MutationRegistry.load_default()
    op = registry.operator("simplify")
    prompt = op.apply("some content")
    assert "subtractive" in prompt


def test_apply_preserves_frontmatter_instruction() -> None:
    registry = MutationRegistry.load_default()
    op = registry.operator("contextualize")
    prompt = op.apply("some content")
    assert "frontmatter" in prompt.lower()
    assert "name" in prompt
    assert "description" in prompt
    assert "tools" in prompt


# --------------------------------------------------------------------------
# from_mapping — structural validation
# --------------------------------------------------------------------------


def test_from_mapping_rejects_non_dict_top_level() -> None:
    with pytest.raises(MutationOperatorError, match="top-level YAML node must be a mapping"):
        MutationRegistry.from_mapping("not a dict")


def test_from_mapping_rejects_missing_operators_key() -> None:
    with pytest.raises(MutationOperatorError, match="non-empty 'operators' list"):
        MutationRegistry.from_mapping({"other": "stuff"})


def test_from_mapping_rejects_empty_operators_list() -> None:
    with pytest.raises(MutationOperatorError, match="non-empty 'operators' list"):
        MutationRegistry.from_mapping({"operators": []})


def test_from_mapping_rejects_non_list_operators() -> None:
    with pytest.raises(MutationOperatorError, match="non-empty 'operators' list"):
        MutationRegistry.from_mapping({"operators": "not a list"})


def test_from_mapping_rejects_non_dict_operator_entry() -> None:
    with pytest.raises(MutationOperatorError, match=r"operators\[0\] must be a mapping"):
        MutationRegistry.from_mapping({"operators": ["not a dict"]})


def test_from_mapping_rejects_unknown_keys_in_operator() -> None:
    op = {
        "name": "synonym",
        "description": "desc",
        "scope": "neutral",
        "rules": "rules",
        "extra": "bad",
    }
    with pytest.raises(MutationOperatorError, match="unknown keys"):
        MutationRegistry.from_mapping({"operators": [op]})


def test_from_mapping_rejects_missing_keys_in_operator() -> None:
    op = {"name": "synonym", "description": "desc"}
    with pytest.raises(MutationOperatorError, match="missing keys"):
        MutationRegistry.from_mapping({"operators": [op]})


# --------------------------------------------------------------------------
# MutationOperator — field validation
# --------------------------------------------------------------------------


def test_operator_rejects_empty_name() -> None:
    with pytest.raises(MutationOperatorError, match="non-empty string"):
        MutationOperator(name="", description="d", scope="neutral", rules="r")


def test_operator_rejects_unknown_name() -> None:
    with pytest.raises(MutationOperatorError, match="unknown operator name"):
        MutationOperator(name="unknown", description="d", scope="neutral", rules="r")


def test_operator_rejects_invalid_scope() -> None:
    with pytest.raises(MutationOperatorError, match="scope must be one of"):
        MutationOperator(name="synonym", description="d", scope="invalid", rules="r")  # type: ignore[arg-type]


def test_operator_rejects_empty_description() -> None:
    with pytest.raises(MutationOperatorError, match="description must be a non-empty"):
        MutationOperator(name="synonym", description="", scope="neutral", rules="r")


def test_operator_rejects_empty_rules() -> None:
    with pytest.raises(MutationOperatorError, match="rules must be a non-empty"):
        MutationOperator(name="synonym", description="d", scope="neutral", rules="")


# --------------------------------------------------------------------------
# MutationRegistry — invariant enforcement
# --------------------------------------------------------------------------


def _make_op(name: str) -> MutationOperator:
    """Build a minimal valid operator for testing registry invariants."""
    return MutationOperator(
        name=name,
        description=f"Test {name}",
        scope="neutral",
        rules=f"Rules for {name}",
    )


def test_registry_rejects_wrong_operator_count() -> None:
    ops = tuple(_make_op(n) for n in list(KNOWN_OPERATOR_NAMES)[:3])
    with pytest.raises(MutationOperatorError, match="exactly 6 operators"):
        MutationRegistry(operators=ops)


def test_registry_rejects_duplicate_names() -> None:
    names = list(KNOWN_OPERATOR_NAMES)
    names[0] = names[1]
    ops = tuple(
        MutationOperator(name=n, description=f"d{i}", scope="neutral", rules=f"r{i}")
        for i, n in enumerate(names)
    )
    with pytest.raises(MutationOperatorError, match="duplicate operator names"):
        MutationRegistry(operators=ops)


def test_registry_rejects_missing_required_operator() -> None:
    names = sorted(KNOWN_OPERATOR_NAMES)
    names[0] = names[1]
    ops = tuple(
        MutationOperator(name=n, description=f"d{i}", scope="neutral", rules=f"r{i}")
        for i, n in enumerate(names)
    )
    with pytest.raises(MutationOperatorError, match="(duplicate|missing)"):
        MutationRegistry(operators=ops)


def test_registry_rejects_non_tuple_operators() -> None:
    with pytest.raises(MutationOperatorError, match="tuple of MutationOperator"):
        MutationRegistry(operators=[])  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# from_yaml — file-level loading
# --------------------------------------------------------------------------


def test_from_yaml_loads_valid_file(tmp_path: Path) -> None:
    data = {
        "operators": [
            {"name": n, "description": f"d {n}", "scope": "neutral", "rules": f"r {n}"}
            for n in sorted(KNOWN_OPERATOR_NAMES)
        ]
    }
    path = tmp_path / "ops.yaml"
    path.write_text(yaml.dump(data), encoding="utf-8")
    registry = MutationRegistry.from_yaml(path)
    assert len(registry.operators) == OPERATOR_COUNT


def test_from_yaml_wraps_yaml_error(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text(":\n  :\n    - {[invalid", encoding="utf-8")
    with pytest.raises(MutationOperatorError, match="failed to parse"):
        MutationRegistry.from_yaml(path)


# --------------------------------------------------------------------------
# Frozen immutability
# --------------------------------------------------------------------------


def test_operator_is_frozen() -> None:
    op = _make_op("synonym")
    with pytest.raises(AttributeError):
        op.name = "other"  # type: ignore[misc]


def test_registry_is_frozen() -> None:
    registry = MutationRegistry.load_default()
    with pytest.raises(AttributeError):
        registry.operators = ()  # type: ignore[misc]
