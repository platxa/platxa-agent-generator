"""Tests for :mod:`platxa_agent_generator.targeted_reprompt`.

Verification criteria for feature #30 (EVALUATION):
    Snapshot test: 6 axes × 3 severity levels = 18 cases produce
    expected prompt fragments.  Each case verifies axis name, severity
    label, finding summary, location reference, suggestion line, and
    BLOCKING/WARNING tier annotation.
"""

from __future__ import annotations

import pytest

from platxa_agent_generator.evaluation_criteria import (
    KNOWN_AXIS_NAMES,
    EvaluationAxis,
    EvaluationRubric,
)
from platxa_agent_generator.targeted_reprompt import (
    build_regeneration_prompt,
)


def _make_rubric() -> EvaluationRubric:
    """Build a deterministic rubric for testing without filesystem access."""
    axes = (
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
    return EvaluationRubric(axes=axes)


RUBRIC = _make_rubric()

SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM"]


def _make_finding(axis: str, severity: str) -> dict[str, str]:
    return {
        "axis": axis,
        "severity": severity,
        "summary": f"{axis} finding at {severity}",
        "location": f".claude/agents/test.md:{hash(axis) % 100}",
    }


# -----------------------------------------------------------------------
# Core: 6 axes × 3 severity levels = 18 parametrized snapshot cases
# -----------------------------------------------------------------------


@pytest.mark.parametrize("axis_name", sorted(KNOWN_AXIS_NAMES))
@pytest.mark.parametrize("severity", SEVERITY_LEVELS)
def test_single_axis_blocking_produces_expected_fragment(axis_name: str, severity: str) -> None:
    finding = _make_finding(axis_name, severity)
    result = build_regeneration_prompt(
        findings=[finding],
        blocking_axes=[axis_name],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert f"### {axis_name}" in result
    assert severity in result
    assert "BLOCKING" in result
    assert finding["summary"] in result
    assert str(finding["location"]) in result
    assert "**Suggestion:**" in result
    assert "## Prior iteration findings to address" in result


@pytest.mark.parametrize("axis_name", sorted(KNOWN_AXIS_NAMES))
@pytest.mark.parametrize("severity", SEVERITY_LEVELS)
def test_single_axis_warning_produces_expected_fragment(axis_name: str, severity: str) -> None:
    finding = _make_finding(axis_name, severity)
    result = build_regeneration_prompt(
        findings=[finding],
        blocking_axes=[],
        warning_axes=[axis_name],
        rubric=RUBRIC,
    )
    assert f"### {axis_name}" in result
    assert severity in result
    assert "WARNING" in result
    assert finding["summary"] in result
    assert "**Suggestion:**" in result


# -----------------------------------------------------------------------
# Ordering: blocking axes sorted by severity before warnings
# -----------------------------------------------------------------------


def test_blocking_axes_appear_before_warnings() -> None:
    result = build_regeneration_prompt(
        findings=[
            _make_finding("security", "CRITICAL"),
            _make_finding("documentation", "LOW"),
        ],
        blocking_axes=["security"],
        warning_axes=["documentation"],
        rubric=RUBRIC,
    )
    security_pos = result.index("### security")
    documentation_pos = result.index("### documentation")
    assert security_pos < documentation_pos


def test_blocking_axes_ordered_by_severity() -> None:
    result = build_regeneration_prompt(
        findings=[
            _make_finding("tool_design", "HIGH"),
            _make_finding("security", "CRITICAL"),
        ],
        blocking_axes=["tool_design", "security"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    security_pos = result.index("### security")
    tool_pos = result.index("### tool_design")
    assert security_pos < tool_pos


# -----------------------------------------------------------------------
# Multiple findings per axis
# -----------------------------------------------------------------------


def test_multiple_findings_per_axis_all_rendered() -> None:
    findings = [
        {
            "axis": "security",
            "severity": "CRITICAL",
            "summary": "First issue",
            "location": "a.md:1",
        },
        {"axis": "security", "severity": "HIGH", "summary": "Second issue", "location": "a.md:5"},
    ]
    result = build_regeneration_prompt(
        findings=findings,
        blocking_axes=["security"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert "First issue" in result
    assert "Second issue" in result
    assert result.count("### security") == 1


# -----------------------------------------------------------------------
# Edge cases
# -----------------------------------------------------------------------


def test_empty_axes_returns_empty_string() -> None:
    result = build_regeneration_prompt(
        findings=[],
        blocking_axes=[],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert result == ""


def test_finding_without_location_omits_backtick_reference() -> None:
    finding = {"axis": "clarity", "severity": "MEDIUM", "summary": "Vague wording", "location": ""}
    result = build_regeneration_prompt(
        findings=[finding],
        blocking_axes=["clarity"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert "Vague wording" in result
    assert "(`" not in result


def test_axis_in_warning_without_findings_uses_rubric_severity() -> None:
    result = build_regeneration_prompt(
        findings=[],
        blocking_axes=[],
        warning_axes=["documentation"],
        rubric=RUBRIC,
    )
    assert "### documentation" in result
    assert "LOW" in result


def test_output_ends_with_newline() -> None:
    result = build_regeneration_prompt(
        findings=[_make_finding("clarity", "MEDIUM")],
        blocking_axes=["clarity"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert result.endswith("\n")
    assert not result.endswith("\n\n")


# -----------------------------------------------------------------------
# _parse_finding validation
# -----------------------------------------------------------------------


def test_malformed_finding_missing_axis_raises_valueerror() -> None:
    with pytest.raises(ValueError, match="axis"):
        build_regeneration_prompt(
            findings=[{"severity": "HIGH", "summary": "x", "location": "y"}],
            blocking_axes=["clarity"],
            warning_axes=[],
            rubric=RUBRIC,
        )


def test_malformed_finding_invalid_severity_raises_valueerror() -> None:
    with pytest.raises(ValueError, match="severity"):
        build_regeneration_prompt(
            findings=[{"axis": "clarity", "severity": "EXTREME", "summary": "x", "location": "y"}],
            blocking_axes=["clarity"],
            warning_axes=[],
            rubric=RUBRIC,
        )


def test_malformed_finding_empty_summary_raises_valueerror() -> None:
    with pytest.raises(ValueError, match="summary"):
        build_regeneration_prompt(
            findings=[{"axis": "clarity", "severity": "HIGH", "summary": "", "location": "y"}],
            blocking_axes=["clarity"],
            warning_axes=[],
            rubric=RUBRIC,
        )


def test_finding_missing_location_omits_backtick() -> None:
    result = build_regeneration_prompt(
        findings=[{"axis": "clarity", "severity": "HIGH", "summary": "issue"}],
        blocking_axes=["clarity"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert "issue" in result
    assert "(`" not in result


# -----------------------------------------------------------------------
# Suggestion derivation (tested through public API)
# -----------------------------------------------------------------------


def test_suggestion_derived_from_rubric_criteria() -> None:
    result = build_regeneration_prompt(
        findings=[_make_finding("security", "CRITICAL")],
        blocking_axes=["security"],
        warning_axes=[],
        rubric=RUBRIC,
    )
    assert "Ensure:" in result
    assert "credential" in result.lower() or "destructive" in result.lower()


def test_unknown_axis_gets_generic_suggestion() -> None:
    result = build_regeneration_prompt(
        findings=[],
        blocking_axes=[],
        warning_axes=["nonexistent"],
        rubric=RUBRIC,
    )
    assert "nonexistent" in result
    assert "Address the nonexistent axis" in result


# -----------------------------------------------------------------------
# Full integration: snapshot of multi-axis output
# -----------------------------------------------------------------------


def test_full_multi_axis_snapshot() -> None:
    findings = [
        {
            "axis": "security",
            "severity": "CRITICAL",
            "summary": "Bash with no justification",
            "location": "agent.md:4",
        },
        {
            "axis": "tool_design",
            "severity": "HIGH",
            "summary": "WebFetch unused",
            "location": "agent.md:5",
        },
        {
            "axis": "clarity",
            "severity": "MEDIUM",
            "summary": "Vague role description",
            "location": "agent.md:10",
        },
    ]
    result = build_regeneration_prompt(
        findings=findings,
        blocking_axes=["security", "tool_design"],
        warning_axes=["clarity"],
        rubric=RUBRIC,
    )

    lines = result.split("\n")
    assert lines[0] == "## Prior iteration findings to address"

    assert "### security — CRITICAL (BLOCKING)" in result
    assert "### tool_design — HIGH (BLOCKING)" in result
    assert "### clarity — MEDIUM (WARNING)" in result

    sec_pos = result.index("### security")
    tool_pos = result.index("### tool_design")
    clar_pos = result.index("### clarity")
    assert sec_pos < tool_pos < clar_pos

    assert "Bash with no justification" in result
    assert "(`agent.md:4`)" in result
    assert "**Suggestion:** Ensure:" in result
