"""Tests for :mod:`platxa_agent_generator.weight_drift_check`.

Verification criteria for feature #48 (META):
    1. When weights diverge, report names criterion + delta + source files.
    2. CI fails (exit code 1) if drift detected.
    3. No false positives when all sources agree.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

import pytest

from platxa_agent_generator.weight_drift_check import (
    DriftReport,
    WeightDivergence,
    check_drift,
    main,
    parse_agent_weights,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_YAML = dedent("""\
    axes:
      - name: clarity
        weight: 0.20
        severity_on_unmet: MEDIUM
        criteria: Clear prompt language.
      - name: completeness
        weight: 0.20
        severity_on_unmet: HIGH
        criteria: All required sections present.
      - name: tool_design
        weight: 0.20
        severity_on_unmet: HIGH
        criteria: Minimal-necessary tool grants.
      - name: examples
        weight: 0.15
        severity_on_unmet: MEDIUM
        criteria: Realistic examples.
      - name: security
        weight: 0.15
        severity_on_unmet: CRITICAL
        criteria: No credential exposure.
      - name: documentation
        weight: 0.10
        severity_on_unmet: LOW
        criteria: Inline comments explain decisions.
""")


@pytest.fixture()
def yaml_path(tmp_path: Path) -> Path:
    """Write a valid evaluation-criteria.yaml to a temp dir."""
    p = tmp_path / "evaluation-criteria.yaml"
    p.write_text(VALID_YAML, encoding="utf-8")
    return p


@pytest.fixture()
def agent_no_weights(tmp_path: Path) -> Path:
    """Agent file that correctly defers to the YAML (no weight table)."""
    p = tmp_path / "validation-subagent.md"
    p.write_text(
        dedent("""\
            # Validation Subagent

            > **Source of truth — do not edit weights here.**
            > Read evaluation-criteria.yaml for axis weights.
        """),
        encoding="utf-8",
    )
    return p


@pytest.fixture()
def agent_with_matching_weights(tmp_path: Path) -> Path:
    """Agent file with a weight table that matches the YAML."""
    p = tmp_path / "validation-subagent.md"
    p.write_text(
        dedent("""\
            # Validation Subagent

            | Axis | Weight |
            |------|--------|
            | clarity | 0.20 |
            | completeness | 0.20 |
            | tool_design | 0.20 |
            | examples | 0.15 |
            | security | 0.15 |
            | documentation | 0.10 |
        """),
        encoding="utf-8",
    )
    return p


@pytest.fixture()
def agent_with_drifted_weights(tmp_path: Path) -> Path:
    """Agent file with weights that diverge from the YAML."""
    p = tmp_path / "validation-subagent.md"
    p.write_text(
        dedent("""\
            # Validation Subagent

            | Axis | Weight |
            |------|--------|
            | clarity | 0.25 |
            | completeness | 0.20 |
            | tool_design | 0.15 |
            | examples | 0.15 |
            | security | 0.15 |
            | documentation | 0.10 |
        """),
        encoding="utf-8",
    )
    return p


# ---------------------------------------------------------------------------
# WeightDivergence
# ---------------------------------------------------------------------------


class TestWeightDivergence:
    """Unit tests for the WeightDivergence dataclass."""

    def test_delta_calculation(self) -> None:
        d = WeightDivergence("clarity", "a.yaml", "b.py", 0.20, 0.25)
        assert abs(d.delta - 0.05) < 1e-9

    def test_delta_symmetric(self) -> None:
        d = WeightDivergence("clarity", "a.yaml", "b.py", 0.25, 0.20)
        assert abs(d.delta - 0.05) < 1e-9


# ---------------------------------------------------------------------------
# DriftReport
# ---------------------------------------------------------------------------


class TestDriftReport:
    """Unit tests for the DriftReport dataclass."""

    def test_no_divergences_means_no_drift(self) -> None:
        report = DriftReport(yaml_path="y", scorer_module="s", agent_path="a")
        assert not report.has_drift

    def test_with_divergences_means_drift(self) -> None:
        report = DriftReport(
            yaml_path="y",
            scorer_module="s",
            agent_path="a",
            divergences=[WeightDivergence("clarity", "y", "s", 0.20, 0.25)],
        )
        assert report.has_drift

    def test_to_dict_serialisable(self) -> None:
        report = DriftReport(
            yaml_path="y",
            scorer_module="s",
            agent_path="a",
            divergences=[WeightDivergence("clarity", "y", "s", 0.20, 0.25)],
        )
        d = report.to_dict()
        assert d["has_drift"] is True
        divs = d["divergences"]
        assert isinstance(divs, list)
        assert len(divs) == 1
        assert isinstance(divs[0], dict)
        assert divs[0]["criterion"] == "clarity"

    def test_summary_no_drift(self) -> None:
        report = DriftReport(yaml_path="y", scorer_module="s", agent_path="a")
        assert "No weight drift" in report.summary()

    def test_summary_with_drift(self) -> None:
        report = DriftReport(
            yaml_path="y",
            scorer_module="s",
            agent_path="a",
            divergences=[WeightDivergence("clarity", "y", "s", 0.20, 0.25)],
        )
        summary = report.summary()
        assert "clarity" in summary
        assert "0.05" in summary


# ---------------------------------------------------------------------------
# parse_agent_weights
# ---------------------------------------------------------------------------


class TestParseAgentWeights:
    """Tests for markdown weight-table extraction."""

    def test_no_weight_table(self, agent_no_weights: Path) -> None:
        assert parse_agent_weights(agent_no_weights) == {}

    def test_matching_weight_table(self, agent_with_matching_weights: Path) -> None:
        weights = parse_agent_weights(agent_with_matching_weights)
        assert weights["clarity"] == 0.20
        assert weights["completeness"] == 0.20
        assert len(weights) == 6

    def test_drifted_weight_table(self, agent_with_drifted_weights: Path) -> None:
        weights = parse_agent_weights(agent_with_drifted_weights)
        assert weights["clarity"] == 0.25
        assert weights["tool_design"] == 0.15

    def test_missing_file(self, tmp_path: Path) -> None:
        assert parse_agent_weights(tmp_path / "nonexistent.md") == {}


# ---------------------------------------------------------------------------
# check_drift — integration with real YAML
# ---------------------------------------------------------------------------


class TestCheckDriftWithRealYAML:
    """Integration tests using the actual evaluation-criteria.yaml."""

    def test_no_drift_with_current_sources(self) -> None:
        """Current repo state should show no drift (all sources unified)."""
        report = check_drift()
        assert not report.has_drift, report.summary()

    def test_agent_without_weights_no_drift(self, yaml_path: Path, agent_no_weights: Path) -> None:
        report = check_drift(yaml_path=yaml_path, agent_path=agent_no_weights)
        assert not report.has_drift

    def test_agent_with_matching_weights_no_drift(
        self, yaml_path: Path, agent_with_matching_weights: Path
    ) -> None:
        report = check_drift(yaml_path=yaml_path, agent_path=agent_with_matching_weights)
        assert not report.has_drift

    def test_agent_with_drifted_weights_detects_drift(
        self, yaml_path: Path, agent_with_drifted_weights: Path
    ) -> None:
        report = check_drift(yaml_path=yaml_path, agent_path=agent_with_drifted_weights)
        assert report.has_drift
        criteria_with_drift = {d.criterion for d in report.divergences}
        assert "clarity" in criteria_with_drift
        assert "tool_design" in criteria_with_drift

    def test_drift_report_includes_delta(
        self, yaml_path: Path, agent_with_drifted_weights: Path
    ) -> None:
        report = check_drift(yaml_path=yaml_path, agent_path=agent_with_drifted_weights)
        clarity_div = next(d for d in report.divergences if d.criterion == "clarity")
        assert abs(clarity_div.delta - 0.05) < 1e-9

    def test_drift_report_includes_source_files(
        self, yaml_path: Path, agent_with_drifted_weights: Path
    ) -> None:
        report = check_drift(yaml_path=yaml_path, agent_path=agent_with_drifted_weights)
        div = report.divergences[0]
        assert str(yaml_path) in div.source_a
        assert str(agent_with_drifted_weights) in div.source_b

    def test_agent_unknown_axis_detected(self, yaml_path: Path, tmp_path: Path) -> None:
        """An axis in the agent that doesn't exist in the YAML is flagged."""
        agent = tmp_path / "validation-subagent.md"
        agent.write_text(
            "| bogus_axis | 0.10 |\n",
            encoding="utf-8",
        )
        report = check_drift(yaml_path=yaml_path, agent_path=agent)
        assert report.has_drift
        assert any(d.criterion == "bogus_axis" for d in report.divergences)


# ---------------------------------------------------------------------------
# main() CLI
# ---------------------------------------------------------------------------


class TestMain:
    """Tests for the CLI entry point."""

    def test_exit_zero_no_drift(self, capsys: pytest.CaptureFixture[str]) -> None:
        assert main([]) == 0
        captured = capsys.readouterr()
        assert "No weight drift" in captured.out

    def test_exit_zero_json(self, capsys: pytest.CaptureFixture[str]) -> None:
        code = main(["--json"])
        assert code == 0
        import json

        data = json.loads(capsys.readouterr().out)
        assert data["has_drift"] is False
