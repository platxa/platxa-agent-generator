"""Tests for the ``observations`` CLI subcommand.

Verification criterion for feature #50: all four sub-actions (list, show,
stats, migrate) exit 0 with expected output schemas; migrate is idempotent.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI
from platxa_agent_generator.observation_store import ObservationRecord, ObservationStore


def _minimal_record(**overrides: object) -> ObservationRecord:
    """Build a minimal valid record with optional field overrides."""
    defaults: dict[str, object] = {
        "timestamp": "2026-05-24T10:00:00Z",
        "tool": "Bash",
        "input_summary": "test summary",
        "project_id": "proj-1",
        "project_name": "platxa",
    }
    defaults.update(overrides)
    return ObservationRecord(**defaults)  # type: ignore[arg-type]


def _seed_store(tmp_path: Path, records: list[ObservationRecord]) -> Path:
    """Write records to a temp JSONL file and return the path."""
    path = tmp_path / "obs.jsonl"
    store = ObservationStore(path=path)
    store.append_many(records)
    return path


class TestObservationsList:
    """``platxa-agent observations list`` sub-action."""

    def test_list_json_returns_records(self, tmp_path: Path) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(timestamp="t1", tool="Bash"),
                _minimal_record(timestamp="t2", tool="Read"),
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "observations", "list", "-f", str(obs_file)])
        assert rc == 0

    def test_list_json_schema(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(tmp_path, [_minimal_record()])
        cli = CLI()
        cli.run(["--json", "observations", "list", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert "total" in output
        assert "returned" in output
        assert "records" in output
        assert isinstance(output["records"], list)
        assert len(output["records"]) == 1

    def test_list_respects_limit(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        records = [_minimal_record(timestamp=f"t{i}") for i in range(10)]
        obs_file = _seed_store(tmp_path, records)
        cli = CLI()
        cli.run(["--json", "observations", "list", "-n", "3", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 10
        assert output["returned"] == 3

    def test_list_filter_by_type(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(type="tool_use"),
                _minimal_record(type="decision"),
                _minimal_record(type="tool_use"),
            ],
        )
        cli = CLI()
        cli.run(["--json", "observations", "list", "--type", "decision", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 1

    def test_list_filter_by_tool(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(tool="Bash"),
                _minimal_record(tool="Read"),
            ],
        )
        cli = CLI()
        cli.run(["--json", "observations", "list", "--tool", "Read", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 1
        assert output["records"][0]["tool"] == "Read"

    def test_list_filter_by_agent(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(agent_name="code-reviewer"),
                _minimal_record(agent_name="observer"),
            ],
        )
        cli = CLI()
        cli.run(["--json", "observations", "list", "--agent", "observer", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 1
        assert output["records"][0]["agent_name"] == "observer"

    def test_list_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = tmp_path / "empty.jsonl"
        cli = CLI()
        rc = cli.run(["--json", "observations", "list", "-f", str(obs_file)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 0
        assert output["records"] == []

    def test_list_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(tmp_path, [_minimal_record(tool="Bash")])
        cli = CLI()
        rc = cli.run(["observations", "list", "-f", str(obs_file)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "1 total" in out
        assert "Bash" in out


class TestObservationsShow:
    """``platxa-agent observations show`` sub-action."""

    def test_show_json_valid_index(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(timestamp="t1"),
                _minimal_record(timestamp="t2", tool="Read", evidence="found bug"),
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "observations", "show", "1", "-f", str(obs_file)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["timestamp"] == "t2"
        assert output["tool"] == "Read"
        assert output["evidence"] == "found bug"

    def test_show_json_schema_matches_record(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        record = _minimal_record(agent_name="test-agent", confidence=0.9)
        obs_file = _seed_store(tmp_path, [record])
        cli = CLI()
        cli.run(["--json", "observations", "show", "0", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output == asdict(record)

    def test_show_out_of_range(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(tmp_path, [_minimal_record()])
        cli = CLI()
        rc = cli.run(["--json", "observations", "show", "5", "-f", str(obs_file)])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output

    def test_show_negative_index(self, tmp_path: Path) -> None:
        obs_file = _seed_store(tmp_path, [_minimal_record()])
        cli = CLI()
        rc = cli.run(["--json", "observations", "show", "-1", "-f", str(obs_file)])
        assert rc != 0

    def test_show_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = tmp_path / "empty.jsonl"
        cli = CLI()
        rc = cli.run(["--json", "observations", "show", "0", "-f", str(obs_file)])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output
        assert "No observations" in output["error"]

    def test_show_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(tool="Bash", evidence="stack trace", promoted_to="instinct-abc"),
            ],
        )
        cli = CLI()
        rc = cli.run(["observations", "show", "0", "-f", str(obs_file)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Bash" in out
        assert "stack trace" in out
        assert "instinct-abc" in out


class TestObservationsStats:
    """``platxa-agent observations stats`` sub-action."""

    def test_stats_json_schema(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(type="tool_use", tool="Bash", agent_name="observer"),
                _minimal_record(type="decision", tool="Read", agent_name="reviewer"),
                _minimal_record(type="tool_use", tool="Bash", agent_name="observer"),
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "observations", "stats", "-f", str(obs_file)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"]["count"] == 3
        assert output["by_type"]["tool_use"] == 2
        assert output["by_type"]["decision"] == 1
        assert output["by_tool"]["Bash"] == 2
        assert output["by_agent"]["observer"] == 2
        assert output["promoted"]["count"] == 0

    def test_stats_with_promoted(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(
            tmp_path,
            [
                _minimal_record(promoted_to="instinct-1"),
                _minimal_record(),
            ],
        )
        cli = CLI()
        cli.run(["--json", "observations", "stats", "-f", str(obs_file)])
        output = json.loads(capsys.readouterr().out)
        assert output["promoted"]["count"] == 1

    def test_stats_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = tmp_path / "empty.jsonl"
        cli = CLI()
        rc = cli.run(["--json", "observations", "stats", "-f", str(obs_file)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"]["count"] == 0

    def test_stats_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = _seed_store(tmp_path, [_minimal_record(type="decision")])
        cli = CLI()
        rc = cli.run(["observations", "stats", "-f", str(obs_file)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "1 records" in out
        assert "decision" in out


class TestObservationsMigrate:
    """``platxa-agent observations migrate`` sub-action."""

    def test_migrate_upgrades_old_rows(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        path = tmp_path / "obs.jsonl"
        old_row = json.dumps(
            {
                "timestamp": "2026-01-01T00:00:00Z",
                "tool": "Bash",
                "input_summary": "ls -la",
                "project_id": "p1",
                "project_name": "test",
            }
        )
        path.write_text(old_row + "\n", encoding="utf-8")

        cli = CLI()
        rc = cli.run(["--json", "observations", "migrate", "-f", str(path)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["migrated"] == 1
        assert output["total"] == 1

        v2_path = Path(str(path) + ".v2")
        data = json.loads(v2_path.read_text(encoding="utf-8").strip())
        assert "session_id" in data
        assert "agent_name" in data
        assert "pattern_label" in data
        assert data["type"] == "tool_use"
        assert data["confidence"] == 1.0
        assert data["pattern_label"] is None

    def test_migrate_idempotent_v2_output(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        path = tmp_path / "obs.jsonl"
        old_row = json.dumps(
            {
                "timestamp": "t1",
                "tool": "Bash",
                "input_summary": "cmd",
                "project_id": "p",
                "project_name": "pn",
            }
        )
        path.write_text(old_row + "\n", encoding="utf-8")

        cli = CLI()
        cli.run(["--json", "observations", "migrate", "-f", str(path)])
        capsys.readouterr()

        v2_path = Path(str(path) + ".v2")
        first_v2 = v2_path.read_text(encoding="utf-8")

        cli.run(["--json", "observations", "migrate", "-f", str(path)])
        capsys.readouterr()

        assert v2_path.read_text(encoding="utf-8") == first_v2

    def test_migrate_preserves_malformed_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        good = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        path.write_text(good + "\nnot-json\n" + good.replace('"t"', '"t2"') + "\n")

        cli = CLI()
        rc = cli.run(["--json", "observations", "migrate", "-f", str(path)])
        assert rc == 0

        v2_path = Path(str(path) + ".v2")
        lines = v2_path.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 3
        assert lines[1] == "not-json"

    def test_migrate_missing_file(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        obs_file = tmp_path / "nonexistent.jsonl"
        cli = CLI()
        rc = cli.run(["--json", "observations", "migrate", "-f", str(obs_file)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["migrated"] == 0

    def test_migrate_creates_backup(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        path = tmp_path / "obs.jsonl"
        old_row = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        original = old_row + "\n"
        path.write_text(original, encoding="utf-8")

        cli = CLI()
        cli.run(["--json", "observations", "migrate", "-f", str(path)])
        capsys.readouterr()

        backup = Path(str(path) + ".v1.bak")
        assert backup.exists()
        assert backup.read_text(encoding="utf-8") == original
        assert path.read_text(encoding="utf-8") == original

    def test_migrate_human_readable(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        path = tmp_path / "obs.jsonl"
        old_row = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        path.write_text(old_row + "\n", encoding="utf-8")

        cli = CLI()
        rc = cli.run(["observations", "migrate", "-f", str(path)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Migrated 1" in out
        assert "Backup:" in out
        assert "Output:" in out


class TestObservationsNoAction:
    """Missing or invalid sub-action prints usage."""

    def test_no_action_returns_error(self) -> None:
        cli = CLI()
        rc = cli.run(["observations"])
        assert rc == 1

    def test_no_action_json(self, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        rc = cli.run(["--json", "observations"])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output


class TestObservationStoreStats:
    """Unit tests for ``ObservationStore.stats()``."""

    def test_stats_empty_store(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "empty.jsonl")
        result = store.stats()
        assert result["total"]["count"] == 0
        assert result["promoted"]["count"] == 0
        assert result["by_type"] == {}
        assert result["by_tool"] == {}
        assert result["by_agent"] == {}

    def test_stats_groups_correctly(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append_many(
            [
                _minimal_record(type="tool_use", tool="Bash", agent_name="a1"),
                _minimal_record(type="decision", tool="Read", agent_name="a2"),
                _minimal_record(type="tool_use", tool="Bash", agent_name="a1"),
                _minimal_record(type="tool_use", tool="Write"),
            ]
        )
        result = store.stats()
        assert result["total"]["count"] == 4
        assert result["by_type"]["tool_use"] == 3
        assert result["by_type"]["decision"] == 1
        assert result["by_tool"]["Bash"] == 2
        assert result["by_agent"]["a1"] == 2
        assert result["by_agent"]["(unknown)"] == 1

    def test_stats_counts_promoted(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append_many(
            [
                _minimal_record(promoted_to="inst-1"),
                _minimal_record(promoted_to="inst-2"),
                _minimal_record(),
            ]
        )
        result = store.stats()
        assert result["promoted"]["count"] == 2


class TestObservationStoreMigrate:
    """Unit tests for ``ObservationStore.migrate()``."""

    def test_migrate_returns_result_dict(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        old = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        path.write_text(old + "\n" + old.replace('"t"', '"t2"') + "\n")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["migrated"] == 2
        assert result["total"] == 2
        assert result["backup_path"] == str(path) + ".v1.bak"
        assert result["output_path"] == str(path) + ".v2"

    def test_migrate_creates_backup_and_v2(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        old = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        original_content = old + "\n"
        path.write_text(original_content, encoding="utf-8")
        store = ObservationStore(path=path)
        store.migrate()

        backup = Path(str(path) + ".v1.bak")
        output = Path(str(path) + ".v2")
        assert backup.read_text(encoding="utf-8") == original_content
        assert output.exists()
        assert path.read_text(encoding="utf-8") == original_content

        v2_data = json.loads(output.read_text(encoding="utf-8").strip())
        assert "session_id" in v2_data
        assert "pattern_label" in v2_data
        assert v2_data["pattern_label"] is None

    def test_migrate_idempotent_output(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        old = json.dumps(
            {
                "timestamp": "t",
                "tool": "t",
                "input_summary": "t",
                "project_id": "t",
                "project_name": "t",
            }
        )
        path.write_text(old + "\n")
        store = ObservationStore(path=path)
        store.migrate()
        first_v2 = Path(str(path) + ".v2").read_text(encoding="utf-8")
        store.migrate()
        second_v2 = Path(str(path) + ".v2").read_text(encoding="utf-8")
        assert first_v2 == second_v2

    def test_migrate_missing_file(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "missing.jsonl")
        result = store.migrate()
        assert result["migrated"] == 0
        assert result["total"] == 0
