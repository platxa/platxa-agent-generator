"""Tests for the instinct-frontmatter validator (feature #8).

The instinct.md.j2 template (feature #4) renders a defined frontmatter shape and
the InstinctStore (feature #6) writes those rendered files as opaque bytes,
deferring schema validation to syntax_validator. Feature #8 owns that schema:
it enforces ``name`` ≤ 64, ``description`` ≤ 512, ``confidence`` in [0, 1],
``occurrences`` ≥ 0, and a fixed ``type`` enum.

Tests exercise both the collector API (``validate_instinct_frontmatter`` returns
``list[ValidationError]`` consistent with the rest of the module) and the
raise-on-error wrapper (``assert_valid_instinct_frontmatter`` raises
``InstinctSchemaError`` with the offending field name in the message — the
literal contract the feature's verification clause requires).
"""

from __future__ import annotations

import pytest

from platxa_agent_generator.syntax_validator import (
    INSTINCT_FIELD_CONSTRAINTS,
    INSTINCT_REQUIRED_FIELDS,
    INSTINCT_TYPES,
    InstinctSchemaError,
    ValidationError,
    assert_valid_instinct_frontmatter,
    validate_instinct_frontmatter,
)


def _valid_frontmatter(**overrides: object) -> dict[str, object]:
    """Build a baseline valid instinct frontmatter dict for tests."""
    base: dict[str, object] = {
        "name": "always-validate-yaml",
        "description": "Run yaml.safe_load on every user-provided frontmatter",
        "type": "pattern",
        "confidence": 0.85,
        "occurrences": 12,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Constants surface
# ---------------------------------------------------------------------------


class TestInstinctValidationConstants:
    """The constants surface is part of the public contract."""

    def test_instinct_types_is_frozenset_of_eight_values(self) -> None:
        assert isinstance(INSTINCT_TYPES, frozenset)
        assert len(INSTINCT_TYPES) == 8

    def test_instinct_types_contains_locked_vocabulary(self) -> None:
        expected = {
            "pattern",
            "preference",
            "pitfall",
            "workflow",
            "convention",
            "tool_use",
            "heuristic",
            "anti_pattern",
        }
        assert INSTINCT_TYPES == expected

    def test_required_fields_includes_core_four(self) -> None:
        # The verification clause names name, description, type, confidence
        # explicitly. occurrences is bounded but optional (defaults exist
        # in the template).
        assert set(INSTINCT_REQUIRED_FIELDS) == {
            "name",
            "description",
            "type",
            "confidence",
        }

    def test_field_constraints_pin_known_limits(self) -> None:
        assert INSTINCT_FIELD_CONSTRAINTS["name"]["max_length"] == 64
        assert INSTINCT_FIELD_CONSTRAINTS["description"]["max_length"] == 512


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


class TestInstinctValidationHappyPath:
    def test_valid_frontmatter_yields_no_errors(self) -> None:
        errors = validate_instinct_frontmatter(_valid_frontmatter())
        assert errors == []

    def test_assert_returns_none_on_valid_frontmatter(self) -> None:
        # Function returns None implicitly; calling it must not raise.
        assert assert_valid_instinct_frontmatter(_valid_frontmatter()) is None

    @pytest.mark.parametrize("type_value", sorted(INSTINCT_TYPES))
    def test_each_enum_value_is_accepted(self, type_value: str) -> None:
        errors = validate_instinct_frontmatter(_valid_frontmatter(type=type_value))
        assert errors == []

    def test_occurrences_zero_is_accepted(self) -> None:
        errors = validate_instinct_frontmatter(_valid_frontmatter(occurrences=0))
        assert errors == []

    def test_occurrences_omitted_is_accepted(self) -> None:
        # Optional field — defaulted by the template at render time.
        fm = _valid_frontmatter()
        del fm["occurrences"]
        errors = validate_instinct_frontmatter(fm)
        assert errors == []

    def test_confidence_at_boundaries_is_accepted(self) -> None:
        for value in (0.0, 1.0, 0, 1):
            errors = validate_instinct_frontmatter(_valid_frontmatter(confidence=value))
            assert errors == [], f"confidence={value!r} should be accepted"


# ---------------------------------------------------------------------------
# Required-field rejection
# ---------------------------------------------------------------------------


class TestInstinctValidationRequiredFields:
    @pytest.mark.parametrize("missing", sorted(INSTINCT_REQUIRED_FIELDS))
    def test_missing_required_field_raises_with_field_name(self, missing: str) -> None:
        fm = _valid_frontmatter()
        del fm[missing]
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        # The verification clause requires the offending field name in the
        # raised exception message.
        assert missing in str(exc_info.value)

    @pytest.mark.parametrize("missing", sorted(INSTINCT_REQUIRED_FIELDS))
    def test_missing_required_field_collects_e026(self, missing: str) -> None:
        fm = _valid_frontmatter()
        del fm[missing]
        errors = validate_instinct_frontmatter(fm)
        codes = {e.code for e in errors}
        assert "E026" in codes
        assert any(missing in e.message for e in errors)

    def test_empty_string_required_field_is_rejected(self) -> None:
        # An empty string must be treated as "missing" — the template
        # never renders empty required fields, so an empty value indicates
        # a writer-side bug, not a valid edge case.
        fm = _valid_frontmatter(name="")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E026" and "name" in e.message for e in errors)


# ---------------------------------------------------------------------------
# Field-shape rejection (the verification clauses)
# ---------------------------------------------------------------------------


class TestInstinctValidationFieldShape:
    def test_oversized_name_raises_with_field_name(self) -> None:
        # Per spec verification: "oversized name … raises ValidationError
        # with specific field name".
        fm = _valid_frontmatter(name="a" + "b" * 64)  # 65 chars
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        assert "name" in str(exc_info.value)

    def test_oversized_name_emits_e027(self) -> None:
        fm = _valid_frontmatter(name="x" * 65)
        # x*65 is too long AND is invalid hyphen-case (lowercase only OK,
        # but the spec also requires starting with letter — 'x' qualifies,
        # so only the length error should fire here).
        errors = validate_instinct_frontmatter(fm)
        codes = [e.code for e in errors]
        assert "E027" in codes

    def test_name_not_hyphen_case_emits_e027(self) -> None:
        fm = _valid_frontmatter(name="HasUppercase")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E027" and "name" in e.message for e in errors)

    def test_name_starting_with_digit_emits_e027(self) -> None:
        fm = _valid_frontmatter(name="1bad-name")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E027" and "name" in e.message for e in errors)

    def test_oversized_description_emits_e028(self) -> None:
        fm = _valid_frontmatter(description="x" * 513)
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E028" and "description" in e.message for e in errors)

    def test_description_exactly_at_limit_is_accepted(self) -> None:
        fm = _valid_frontmatter(description="x" * 512)
        errors = validate_instinct_frontmatter(fm)
        assert errors == []

    def test_oversized_description_raises_with_field_name(self) -> None:
        fm = _valid_frontmatter(description="x" * 513)
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        assert "description" in str(exc_info.value)

    @pytest.mark.parametrize("bad_value", [-0.01, 1.01, 2.0, -1.0])
    def test_confidence_out_of_range_emits_e029(self, bad_value: float) -> None:
        fm = _valid_frontmatter(confidence=bad_value)
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E029" and "confidence" in e.message for e in errors)

    def test_confidence_non_numeric_emits_e029(self) -> None:
        fm = _valid_frontmatter(confidence="not-a-number")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E029" and "confidence" in e.message for e in errors)

    def test_bad_confidence_raises_with_field_name(self) -> None:
        # Per spec verification: "bad confidence … raises ValidationError
        # with specific field name".
        fm = _valid_frontmatter(confidence=2.0)
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        assert "confidence" in str(exc_info.value)

    @pytest.mark.parametrize("bad_value", [-1, -100])
    def test_negative_occurrences_emits_e030(self, bad_value: int) -> None:
        fm = _valid_frontmatter(occurrences=bad_value)
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E030" and "occurrences" in e.message for e in errors)

    def test_occurrences_non_integer_emits_e030(self) -> None:
        fm = _valid_frontmatter(occurrences="three")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E030" and "occurrences" in e.message for e in errors)

    def test_unknown_type_emits_e031(self) -> None:
        fm = _valid_frontmatter(type="unrecognized")
        errors = validate_instinct_frontmatter(fm)
        assert any(e.code == "E031" and "type" in e.message for e in errors)

    def test_unknown_type_raises_with_field_name(self) -> None:
        # Per spec verification: "unknown type … raises ValidationError
        # with specific field name".
        fm = _valid_frontmatter(type="totally-made-up")
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        assert "type" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Multi-error collection (the validator is not fail-fast)
# ---------------------------------------------------------------------------


class TestInstinctValidationCollection:
    def test_multiple_violations_are_all_collected(self) -> None:
        fm = _valid_frontmatter(
            name="X" * 99,
            description="y" * 600,
            confidence=5.0,
            occurrences=-3,
            type="not-real",
        )
        errors = validate_instinct_frontmatter(fm)
        codes = {e.code for e in errors}
        # All five distinct violation codes must appear in one pass — a
        # fail-fast validator would surface only the first.
        assert {"E027", "E028", "E029", "E030", "E031"}.issubset(codes)

    def test_returned_objects_are_validation_error_dataclass(self) -> None:
        fm = _valid_frontmatter(name="X" * 99)
        errors = validate_instinct_frontmatter(fm)
        assert errors
        assert all(isinstance(e, ValidationError) for e in errors)
        # Field positional + line/column are populated for editor jump-to.
        assert all(e.line >= 1 and e.column >= 1 for e in errors)
        assert all(e.severity == "error" for e in errors)

    def test_assert_concatenates_all_violations(self) -> None:
        fm = _valid_frontmatter(confidence=5.0, type="not-real", description="x" * 9999)
        with pytest.raises(InstinctSchemaError) as exc_info:
            assert_valid_instinct_frontmatter(fm)
        message = str(exc_info.value)
        # Each violation's field name appears so a downstream user can
        # see all problems in one pass, not just the first.
        assert "confidence" in message
        assert "type" in message
        assert "description" in message
