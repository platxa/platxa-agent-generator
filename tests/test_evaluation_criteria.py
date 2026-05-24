"""Tests for :mod:`platxa_agent_generator.evaluation_criteria`.

Verification criteria for feature #2 (EVALUATION):
    1. ``templates/evaluation-criteria.yaml`` is loadable into a typed
       model (``EvaluationRubric``) without errors.
    2. The sum of axis weights equals 1.0.
    3. All 6 expected axes are present, each with a valid severity.

Negative tests cover the hard invariants that protect downstream
readers (``quality_scorer.py``, ``validation-subagent``) from silently
consuming a drifted or malformed rubric.
"""

from __future__ import annotations

import math
import re
from collections.abc import Mapping
from pathlib import Path

import pytest
import yaml

from platxa_agent_generator.evaluation_criteria import (
    AXIS_COUNT,
    KNOWN_AXIS_NAMES,
    SEVERITIES,
    WEIGHT_SUM_TOLERANCE,
    EvaluationAxis,
    EvaluationRubric,
    EvaluationRubricValidationError,
    default_rubric_path,
)

# --------------------------------------------------------------------------
# Verification criteria 1–3 (the canonical templates/evaluation-criteria.yaml)
# --------------------------------------------------------------------------


def test_default_rubric_path_points_to_repo_template() -> None:
    path = default_rubric_path()
    assert path.name == "evaluation-criteria.yaml"
    assert path.parent.name == "templates"
    assert path.is_file(), f"canonical rubric missing at {path}"


def test_default_rubric_loads_into_typed_model() -> None:
    rubric = EvaluationRubric.load_default()
    assert isinstance(rubric, EvaluationRubric)
    assert len(rubric.axes) == AXIS_COUNT


def test_default_rubric_weights_sum_to_one() -> None:
    rubric = EvaluationRubric.load_default()
    total = math.fsum(a.weight for a in rubric.axes)
    assert math.isclose(total, 1.0, abs_tol=WEIGHT_SUM_TOLERANCE)


def test_default_rubric_all_six_axes_with_severity() -> None:
    rubric = EvaluationRubric.load_default()
    names = {a.name for a in rubric.axes}
    assert names == KNOWN_AXIS_NAMES
    for axis in rubric.axes:
        assert axis.severity_on_unmet in SEVERITIES, (
            f"axis {axis.name} has invalid severity {axis.severity_on_unmet!r}"
        )
        assert axis.criteria.strip(), f"axis {axis.name} has empty criteria description"


def test_default_rubric_weights_lookup() -> None:
    weights = EvaluationRubric.load_default().weights()
    assert set(weights.keys()) == KNOWN_AXIS_NAMES
    assert math.isclose(sum(weights.values()), 1.0, abs_tol=WEIGHT_SUM_TOLERANCE)


def test_axis_lookup_returns_matching_axis_or_keyerror() -> None:
    rubric = EvaluationRubric.load_default()
    a = rubric.axis("security")
    assert a.name == "security"
    with pytest.raises(KeyError):
        rubric.axis("nonexistent")


# --------------------------------------------------------------------------
# Negative tests — guard the invariants that downstream readers rely on
# --------------------------------------------------------------------------


def _good_axis_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "name": "clarity",
        "weight": 1.0,
        "severity_on_unmet": "MEDIUM",
        "criteria": "non-empty",
    }
    base.update(overrides)
    return base


def test_axis_rejects_unknown_name() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="unknown axis name"):
        EvaluationAxis(
            name="popularity",
            weight=0.5,
            severity_on_unmet="LOW",
            criteria="x",
        )


def test_axis_rejects_weight_out_of_range() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="weight"):
        EvaluationAxis(
            name="clarity",
            weight=0.0,
            severity_on_unmet="LOW",
            criteria="x",
        )
    with pytest.raises(EvaluationRubricValidationError, match="weight"):
        EvaluationAxis(
            name="clarity",
            weight=1.5,
            severity_on_unmet="LOW",
            criteria="x",
        )


def test_axis_rejects_invalid_severity() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="severity"):
        EvaluationAxis(
            name="clarity",
            weight=0.2,
            severity_on_unmet="URGENT",  # type: ignore[arg-type]
            criteria="x",
        )


def test_axis_rejects_empty_criteria() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="criteria"):
        EvaluationAxis(
            name="clarity",
            weight=0.2,
            severity_on_unmet="LOW",
            criteria="   ",
        )


def test_axis_rejects_bool_weight() -> None:
    # bool is a subclass of int — guard against truthy "weight: True".
    with pytest.raises(EvaluationRubricValidationError, match="numeric"):
        EvaluationAxis(
            name="clarity",
            weight=True,  # type: ignore[arg-type]
            severity_on_unmet="LOW",
            criteria="x",
        )


def _build_full_axes(
    overrides: Mapping[str, Mapping[str, object]] | None = None,
) -> tuple[EvaluationAxis, ...]:
    """Build the canonical 6-axis tuple, optionally overriding fields by name."""
    ovrs: Mapping[str, Mapping[str, object]] = overrides or {}
    spec: dict[str, tuple[float, str]] = {
        "clarity": (0.20, "MEDIUM"),
        "completeness": (0.20, "HIGH"),
        "tool_design": (0.20, "HIGH"),
        "examples": (0.15, "MEDIUM"),
        "security": (0.15, "CRITICAL"),
        "documentation": (0.10, "LOW"),
    }
    axes: list[EvaluationAxis] = []
    for name, (weight, severity) in spec.items():
        ovr = ovrs.get(name, {})
        raw_weight = ovr.get("weight", weight)
        if not isinstance(raw_weight, (int, float)):
            raise TypeError(
                f"override weight for {name!r} must be numeric, got {type(raw_weight).__name__}"
            )
        raw_name = ovr.get("name", name)
        raw_severity = ovr.get("severity_on_unmet", severity)
        raw_criteria = ovr.get("criteria", "non-empty criteria text")
        if not isinstance(raw_name, str):
            raise TypeError(f"override name for {name!r} must be str")
        if not isinstance(raw_severity, str):
            raise TypeError(f"override severity for {name!r} must be str")
        if not isinstance(raw_criteria, str):
            raise TypeError(f"override criteria for {name!r} must be str")
        axes.append(
            EvaluationAxis(
                name=raw_name,
                weight=float(raw_weight),
                severity_on_unmet=raw_severity,  # type: ignore[arg-type]
                criteria=raw_criteria,
            )
        )
    return tuple(axes)


def test_rubric_rejects_wrong_axis_count() -> None:
    full = _build_full_axes()
    with pytest.raises(EvaluationRubricValidationError, match="exactly 6 axes"):
        EvaluationRubric(axes=full[:5])


def test_rubric_rejects_weight_sum_drift() -> None:
    # Bump documentation from 0.10 to 0.11 so total = 1.01.
    overrides = {"documentation": {"weight": 0.11}}
    axes = _build_full_axes(overrides)
    with pytest.raises(EvaluationRubricValidationError, match="sum of axis weights"):
        EvaluationRubric(axes=axes)


def test_rubric_rejects_duplicate_axis_names() -> None:
    # Build a tuple where two axes share a name (shouldn't normally be
    # constructable since axis names are validated, but exercise the
    # dedup guard in EvaluationRubric.__post_init__ anyway).
    axes = _build_full_axes()
    duplicate = EvaluationAxis(
        name="clarity",
        weight=axes[-1].weight,  # preserve weight sum
        severity_on_unmet="LOW",
        criteria="dup",
    )
    bad = axes[:-1] + (duplicate,)
    with pytest.raises(EvaluationRubricValidationError, match="duplicate axis names"):
        EvaluationRubric(axes=bad)


def test_from_mapping_rejects_unknown_axis_keys() -> None:
    payload = {
        "axes": [
            _good_axis_payload(extra="boom"),
        ]
    }
    with pytest.raises(EvaluationRubricValidationError, match="unknown keys"):
        EvaluationRubric.from_mapping(payload)


def test_from_mapping_rejects_missing_axis_keys() -> None:
    payload = {"axes": [{"name": "clarity", "weight": 1.0}]}
    with pytest.raises(EvaluationRubricValidationError, match="missing keys"):
        EvaluationRubric.from_mapping(payload)


def test_from_mapping_rejects_non_mapping_top_level() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="mapping"):
        EvaluationRubric.from_mapping([1, 2, 3])  # type: ignore[arg-type]


def test_from_mapping_rejects_empty_axes_list() -> None:
    with pytest.raises(EvaluationRubricValidationError, match="non-empty 'axes'"):
        EvaluationRubric.from_mapping({"axes": []})


def test_from_mapping_tolerates_unknown_top_level_keys() -> None:
    # Forward-compatibility: extra top-level keys (e.g. a future
    # "version: 2") must not break older readers.
    canonical = yaml.safe_load(default_rubric_path().read_text(encoding="utf-8"))
    canonical["version"] = "2"
    canonical["meta"] = {"author": "platxa"}
    rubric = EvaluationRubric.from_mapping(canonical)
    assert len(rubric.axes) == AXIS_COUNT


def test_from_yaml_wraps_parse_errors(tmp_path: Path) -> None:
    # Malformed YAML must surface as EvaluationRubricValidationError so
    # callers do not need to catch yaml.YAMLError separately.
    bad = tmp_path / "broken.yaml"
    bad.write_text("axes:\n  - name: clarity\n    weight: [unclosed\n", encoding="utf-8")
    with pytest.raises(EvaluationRubricValidationError, match="failed to parse"):
        EvaluationRubric.from_yaml(bad)


def test_from_yaml_round_trips_default(tmp_path: Path) -> None:
    # Re-write the canonical YAML to a temp path and confirm it loads
    # identically — guards against the loader caring about absolute path.
    src_text = default_rubric_path().read_text(encoding="utf-8")
    target = tmp_path / "evaluation-criteria.yaml"
    target.write_text(src_text, encoding="utf-8")
    a = EvaluationRubric.from_yaml(target)
    b = EvaluationRubric.load_default()
    assert a.weights() == b.weights()
    assert {x.severity_on_unmet for x in a.axes} == {x.severity_on_unmet for x in b.axes}


# --------------------------------------------------------------------------
# Weight-drift guard — docs that reference the rubric must not hard-code
# weights (features #40, #41).
# --------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[1]

_WEIGHT_GUARDED_FILES = (
    _REPO_ROOT / "agents" / "validation-subagent.md",
    _REPO_ROOT / "CLAUDE.md",
    _REPO_ROOT / "docs" / "PLATXA_AGENT_GENERATOR.md",
)

_HARDCODED_WEIGHT_RE = re.compile(
    r"""
    (?:                         # match either …
      ['"]\w+['"]:\s*0\.\d+     # 'axis': 0.NN or "axis": 0.NN
    | \|\s*\w+\s*\|\s*\d+%     # | Axis | NN%   (markdown table cell)
    )
    """,
    re.VERBOSE,
)


@pytest.mark.parametrize("path", _WEIGHT_GUARDED_FILES, ids=lambda p: p.name)
def test_no_hardcoded_weights(path: Path) -> None:
    """Guard against weight drift: docs must reference the YAML."""
    text = path.read_text(encoding="utf-8")
    matches = _HARDCODED_WEIGHT_RE.findall(text)
    assert not matches, (
        f"{path.name} still contains hard-coded weights: {matches}. "
        "Weights must only live in templates/evaluation-criteria.yaml."
    )


_EVALUATOR_AGENT_FILES = (
    _REPO_ROOT / "agents" / "evaluator-subagent.md",
    _REPO_ROOT / "agents" / "gan-evaluator.md",
    _REPO_ROOT / "agents" / "gan-axis-judge.md",
)


@pytest.mark.parametrize("path", _EVALUATOR_AGENT_FILES, ids=lambda p: p.name)
def test_evaluator_agents_reference_yaml(path: Path) -> None:
    """Evaluator agents must reference the YAML rubric, not rely on hard-coded tables."""
    text = path.read_text(encoding="utf-8")
    assert "evaluation-criteria.yaml" in text, (
        f"{path.name} does not reference evaluation-criteria.yaml. "
        "Evaluator agents must read weights from the canonical YAML."
    )
    weight_table_re = re.compile(
        r"^\|[^|]*\|\s*0\.\d+\s*\|",
        re.MULTILINE,
    )
    matches = weight_table_re.findall(text)
    assert not matches, (
        f"{path.name} contains a hard-coded weight table: {matches}. "
        "Reference tables must be removed; only example outputs may "
        "contain illustrative weight values."
    )
