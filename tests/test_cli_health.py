"""Tests for the ``health`` CLI subcommand.

Verification criteria for feature #57:
    * Output is a single dashboard with 5 metrics.
    * Non-zero baselines from fixture data.
    * JSON and text output modes both work.
    * Graceful when stores are empty.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI
from platxa_agent_generator.instinct_store import InstinctStore
from platxa_agent_generator.observation_store import ObservationRecord, ObservationStore


def _seed_eval_history(history_dir: Path, passed: int, failed: int) -> None:
    """Write run-trace JSON files to simulate eval history."""
    history_dir.mkdir(parents=True, exist_ok=True)
    for i in range(passed):
        trace = {
            "verdict": "passed",
            "prompt": f"test-{i}",
            "duration_ms": 100,
            "timestamp": f"2026-01-01T00:00:{i:02d}+00:00",
        }
        (history_dir / f"run-2026-01-01T00-00-{i:02d}p00-00.json").write_text(
            json.dumps(trace), encoding="utf-8"
        )
    for i in range(failed):
        trace = {
            "verdict": "failed",
            "prompt": f"fail-{i}",
            "duration_ms": 200,
            "timestamp": f"2026-01-02T00:00:{i:02d}+00:00",
        }
        (history_dir / f"run-2026-01-02T00-00-{i:02d}p00-00.json").write_text(
            json.dumps(trace), encoding="utf-8"
        )


def _seed_instincts(root: Path, count: int) -> None:
    """Write instinct entries via the store API."""
    store = InstinctStore(root=root)
    for i in range(count):
        content = (
            f"---\nname: inst-{i}\ndescription: test instinct {i}\n"
            f"confidence: 0.8\nusage_count: 5\nsuccess_count: 3\n---\n\nBody.\n"
        )
        store.put(
            name=f"inst-{i}",
            scope="global",
            type_="pattern",
            content=content,
            created="2026-01-01T00:00:00Z",
            last_seen=f"2026-05-{20 + i:02d}T12:00:00Z",
        )


def _seed_observations(obs_path: Path, count: int, promoted: int = 0) -> None:
    """Write observation records to a JSONL file."""
    store = ObservationStore(path=obs_path)
    for i in range(count):
        record = ObservationRecord(
            timestamp=f"2026-05-{10 + i:02d}T10:00:00Z",
            tool="Read",
            input_summary=f"observation {i}",
            project_id="proj-1",
            project_name="test-project",
            session_id="sess-1",
            agent_name="observer",
            type="tool_use",
            promoted_to=f"instinct-{i}" if i < promoted else None,
        )
        store.append(record)


def _no_drifted_agents(**_kw: object) -> list[Path]:
    return []


def _drifted_agents(**_kw: object) -> list[Path]:
    return [Path("agents/validation-subagent.md")]


@pytest.fixture(autouse=True)
def _stub_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default: stub check_agent_weight_tables to return no drifted agents."""
    monkeypatch.setattr(
        "platxa_agent_generator.quality_scorer.check_agent_weight_tables",
        _no_drifted_agents,
    )


# --- JSON output -----------------------------------------------------------


class TestHealthJson:
    """``platxa-agent health --json`` output shape and metrics."""

    def test_all_five_metrics_present(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        history_dir = tmp_path / "history"
        inst_root = tmp_path / "instincts"
        obs_path = tmp_path / "obs.jsonl"

        _seed_eval_history(history_dir, passed=3, failed=1)
        _seed_instincts(inst_root, count=5)
        _seed_observations(obs_path, count=7)

        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(history_dir),
                "--instinct-root",
                str(inst_root),
                "--obs-file",
                str(obs_path),
            ]
        )
        assert rc == 0

        output = json.loads(capsys.readouterr().out)
        assert "eval_pass_rates" in output
        assert "instinct_count" in output
        assert "observation_count" in output
        assert "observation_promoted" in output
        assert "last_evolve_timestamp" in output
        assert "weight_drift" in output

    def test_nonzero_baselines(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        history_dir = tmp_path / "history"
        inst_root = tmp_path / "instincts"
        obs_path = tmp_path / "obs.jsonl"

        _seed_eval_history(history_dir, passed=4, failed=2)
        _seed_instincts(inst_root, count=3)
        _seed_observations(obs_path, count=10, promoted=2)

        cli = CLI()
        cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(history_dir),
                "--instinct-root",
                str(inst_root),
                "--obs-file",
                str(obs_path),
            ]
        )

        output = json.loads(capsys.readouterr().out)
        assert output["eval_pass_rates"]["total"] == 6
        assert output["eval_pass_rates"]["passed"] == 4
        assert output["eval_pass_rates"]["failed"] == 2
        assert output["eval_pass_rates"]["pass_rate"] == pytest.approx(4 / 6)
        assert output["instinct_count"] == 3
        assert output["observation_count"] == 10
        assert output["observation_promoted"] == 2
        assert output["last_evolve_timestamp"] is not None

    def test_last_evolve_picks_most_recent(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        inst_root = tmp_path / "instincts"
        _seed_instincts(inst_root, count=3)

        cli = CLI()
        cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(inst_root),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )

        output = json.loads(capsys.readouterr().out)
        assert output["last_evolve_timestamp"] == "2026-05-22T12:00:00Z"

    def test_weight_drift_detected(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            "platxa_agent_generator.quality_scorer.check_agent_weight_tables",
            _drifted_agents,
        )

        cli = CLI()
        cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(tmp_path / "inst"),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )

        output = json.loads(capsys.readouterr().out)
        assert output["weight_drift"]["has_drift"] is True
        assert output["weight_drift"]["divergences"] == 1

    def test_no_weight_drift(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(tmp_path / "inst"),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )

        output = json.loads(capsys.readouterr().out)
        assert output["weight_drift"]["has_drift"] is False
        assert output["weight_drift"]["divergences"] == 0


# --- empty stores -----------------------------------------------------------


class TestHealthEmpty:
    """Dashboard renders gracefully when all stores are empty."""

    def test_empty_stores_json(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(tmp_path / "inst"),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )
        assert rc == 0

        output = json.loads(capsys.readouterr().out)
        assert output["eval_pass_rates"]["total"] == 0
        assert output["eval_pass_rates"]["pass_rate"] == 0.0
        assert output["instinct_count"] == 0
        assert output["observation_count"] == 0
        assert output["observation_promoted"] == 0
        assert output["last_evolve_timestamp"] is None

    def test_empty_stores_text(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        rc = cli.run(
            [
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(tmp_path / "inst"),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )
        assert rc == 0

        text = capsys.readouterr().out
        assert "Learning Loop Health Dashboard" in text
        assert "(never)" in text


# --- text output ------------------------------------------------------------


class TestHealthText:
    """Human-readable text output."""

    def test_text_contains_all_sections(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        history_dir = tmp_path / "history"
        inst_root = tmp_path / "instincts"
        obs_path = tmp_path / "obs.jsonl"

        _seed_eval_history(history_dir, passed=2, failed=1)
        _seed_instincts(inst_root, count=4)
        _seed_observations(obs_path, count=6, promoted=1)

        cli = CLI()
        rc = cli.run(
            [
                "health",
                "--history-dir",
                str(history_dir),
                "--instinct-root",
                str(inst_root),
                "--obs-file",
                str(obs_path),
            ]
        )
        assert rc == 0

        text = capsys.readouterr().out
        assert "Learning Loop Health Dashboard" in text
        assert "Eval pass rate:" in text
        assert "Instinct count:" in text
        assert "Observations:" in text
        assert "Last evolve:" in text
        assert "Weight drift:" in text
        assert "OK" in text

    def test_text_shows_drift_warning(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            "platxa_agent_generator.quality_scorer.check_agent_weight_tables",
            _drifted_agents,
        )

        cli = CLI()
        cli.run(
            [
                "health",
                "--history-dir",
                str(tmp_path / "empty"),
                "--instinct-root",
                str(tmp_path / "inst"),
                "--obs-file",
                str(tmp_path / "none.jsonl"),
            ]
        )

        text = capsys.readouterr().out
        assert "DRIFT DETECTED" in text
        assert "1 divergence" in text
