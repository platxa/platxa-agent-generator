"""Tests for the ``eval-run`` CLI subcommand.

Verification criteria for feature #56:
    * All flags work (--all, --k, --save-history, --type).
    * --save-history writes run-{timestamp}.json.
    * --type filters scenarios.
    * --all runs full corpus.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import yaml

from platxa_agent_generator import eval_runner
from platxa_agent_generator.cli import CLI


def _mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
    """Return output that satisfies the default scenario criteria."""
    return "module exposes add() and exit code equals 0"


@pytest.fixture(autouse=True)
def _patch_executor(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace the subprocess executor with a fast mock for all tests."""
    monkeypatch.setattr(eval_runner, "_default_executor", _mock_executor)


def _write_scenario(path: Path, overrides: dict[str, Any] | None = None) -> Path:
    """Write a minimal valid scenario YAML and return its path."""
    base: dict[str, Any] = {
        "prompt": "Implement add(a, b) returning a + b.",
        "success_criteria": ["module exposes add()"],
        "axis": "correctness",
        "type": "capability",
        "forbidden_tools": ["Edit"],
    }
    if overrides:
        base.update(overrides)
    path.write_text(yaml.dump(base), encoding="utf-8")
    return path


def _seed_scenarios_dir(tmp_path: Path) -> Path:
    """Create a scenarios directory with two scenarios (one capability, one regression)."""
    scenarios_dir = tmp_path / "scenarios"
    scenarios_dir.mkdir()
    _write_scenario(scenarios_dir / "cap.yaml")
    _write_scenario(
        scenarios_dir / "reg.yaml",
        {
            "type": "regression",
            "regression_baseline": "abc123",
            "prompt": "Check regression baseline.",
            "success_criteria": ["exit code equals 0"],
        },
    )
    return scenarios_dir


# --- single scenario file ---------------------------------------------------


class TestEvalRunSingleScenario:
    """``platxa-agent eval-run scenario.yaml`` with a single file."""

    def test_runs_single_scenario_json(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(sc_path)])
        output = json.loads(capsys.readouterr().out)
        assert rc == 0
        assert output["total"] == 1
        assert output["passed"] == 1
        assert len(output["results"]) == 1

    def test_runs_single_scenario_text(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        cli = CLI()
        rc = cli.run(["eval-run", str(sc_path)])
        out = capsys.readouterr().out
        assert rc == 0
        assert "PASS" in out
        assert "1/1 passed" in out

    def test_missing_scenario_file_returns_1(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(tmp_path / "missing.yaml")])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output

    def test_invalid_yaml_reports_error(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        bad = tmp_path / "bad.yaml"
        bad.write_text("prompt: ''\nsuccess_criteria: []\naxis: x\ntype: capability\n")
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(bad)])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert output["errors"]


# --- --all flag --------------------------------------------------------------


class TestEvalRunAll:
    """``platxa-agent eval-run --all`` runs every scenario in the directory."""

    def test_all_runs_full_corpus(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        scenarios_dir = _seed_scenarios_dir(tmp_path)
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", "--all",
            "--scenarios-dir", str(scenarios_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 2
        assert len(output["results"]) == 2
        assert rc == 0

    def test_all_with_missing_dir_returns_1(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", "--all",
            "--scenarios-dir", str(tmp_path / "nonexistent"),
        ])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output

    def test_all_with_empty_dir_returns_1(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", "--all",
            "--scenarios-dir", str(empty_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output

    def test_cannot_combine_path_and_all(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(sc_path), "--all"])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "Cannot combine" in output["error"]


# --- --k flag ----------------------------------------------------------------


class TestEvalRunK:
    """``--k N`` runs each scenario N times."""

    def test_k_3_runs_scenario_three_times(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(sc_path), "--k", "3"])
        output = json.loads(capsys.readouterr().out)
        assert rc == 0
        assert output["k"] == 3
        assert output["total"] == 1

    def test_k_less_than_one_returns_1(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        cli = CLI()
        rc = cli.run(["--json", "eval-run", str(sc_path), "--k", "0"])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output


# --- --save-history flag -----------------------------------------------------


class TestEvalRunSaveHistory:
    """``--save-history`` writes run-{timestamp}.json trace files."""

    def test_save_history_writes_trace_file(self, tmp_path: Path) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        history_dir = tmp_path / "history"
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", str(sc_path),
            "--save-history",
            "--history-dir", str(history_dir),
        ])
        assert rc == 0
        traces = list(history_dir.glob("run-*.json"))
        assert len(traces) == 1
        data = json.loads(traces[0].read_text(encoding="utf-8"))
        assert data["verdict"] == "passed"

    def test_save_history_with_k_3_writes_three_traces(self, tmp_path: Path) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        history_dir = tmp_path / "history"
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", str(sc_path),
            "--save-history", "--k", "3",
            "--history-dir", str(history_dir),
        ])
        assert rc == 0
        traces = list(history_dir.glob("run-*.json"))
        assert len(traces) == 3

    def test_no_save_history_writes_no_files(self, tmp_path: Path) -> None:
        sc_path = _write_scenario(tmp_path / "test.yaml")
        history_dir = tmp_path / "history"
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", str(sc_path),
            "--history-dir", str(history_dir),
        ])
        assert rc == 0
        assert not history_dir.exists()


# --- --type filter -----------------------------------------------------------


class TestEvalRunTypeFilter:
    """``--type`` filters scenarios by regression or capability."""

    def test_type_capability_filters_regression(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        scenarios_dir = _seed_scenarios_dir(tmp_path)
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", "--all",
            "--type", "capability",
            "--scenarios-dir", str(scenarios_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert rc == 0
        assert output["total"] == 1
        assert output["type_filter"] == "capability"
        assert all(r["scenario_type"] == "capability" for r in output["results"])

    def test_type_regression_filters_capability(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        scenarios_dir = _seed_scenarios_dir(tmp_path)
        cli = CLI()
        cli.run([
            "--json", "eval-run", "--all",
            "--type", "regression",
            "--scenarios-dir", str(scenarios_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 1
        assert all(r["scenario_type"] == "regression" for r in output["results"])

    def test_type_all_returns_both(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        scenarios_dir = _seed_scenarios_dir(tmp_path)
        cli = CLI()
        cli.run([
            "--json", "eval-run", "--all",
            "--type", "all",
            "--scenarios-dir", str(scenarios_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 2

    def test_type_filter_no_matches_returns_1(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        scenarios_dir = tmp_path / "scenarios"
        scenarios_dir.mkdir()
        _write_scenario(scenarios_dir / "cap.yaml")
        cli = CLI()
        rc = cli.run([
            "--json", "eval-run", "--all",
            "--type", "regression",
            "--scenarios-dir", str(scenarios_dir),
        ])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output


# --- no args -----------------------------------------------------------------


class TestEvalRunNoArgs:
    """``platxa-agent eval-run`` with no scenario and no --all."""

    def test_no_args_returns_1(self, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        rc = cli.run(["--json", "eval-run"])
        output = json.loads(capsys.readouterr().out)
        assert rc == 1
        assert "error" in output
