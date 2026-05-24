"""Tests for the ``evolve`` CLI subcommand.

Verification criterion for feature #53: platxa-agent evolve --dry-run
produces same output as /evolve --dry-run (both surfaces call
promotion_engine.promote() with matching flags).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI
from platxa_agent_generator.instinct_store import InstinctStore


def _make_instinct_content(
    name: str,
    *,
    confidence: float = 0.8,
    usage_count: int = 5,
    success_count: int = 3,
    description: str = "test instinct",
    type_: str = "tool_use",
) -> str:
    """Build instinct markdown with promotion-relevant frontmatter fields."""
    return "\n".join([
        "---",
        f"name: {name}",
        f"description: {description}",
        f"confidence: {confidence}",
        f"usage_count: {usage_count}",
        f"success_count: {success_count}",
        f"type: {type_}",
        "created: 2026-05-01T00:00:00Z",
        "last_seen: 2026-05-25T00:00:00Z",
        "---",
        "",
        f"# {name}",
        "",
        "Body text.",
        "",
    ])


def _seed_store(tmp_path: Path, instincts: list[dict[str, object]]) -> Path:
    """Write instincts to a temp store and return the root path."""
    root = tmp_path / "instincts"
    store = InstinctStore(root=root)
    for inst in instincts:
        store.put(
            name=str(inst["name"]),
            scope=str(inst["scope"]),
            type_=str(inst["type"]),
            content=str(inst["content"]),
            created=str(inst.get("created", "")),
            last_seen=str(inst.get("last_seen", "")),
        )
    return root


class TestEvolveBasic:
    """Basic evolve subcommand behavior."""

    def test_evolve_no_instincts_returns_zero(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = tmp_path / "empty-instincts"
        root.mkdir()
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["candidates"] == []
        assert output["total_evaluated"] == 0

    def test_evolve_dry_run_json_reports_eligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "eligible-one",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "eligible-one", confidence=0.9, usage_count=5, success_count=2
                ),
            },
        ])
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["dry_run"] is True
        assert output["candidates"][0]["name"] == "eligible-one"

    def test_evolve_filters_ineligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "below-threshold",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "below-threshold", confidence=0.3, usage_count=1, success_count=0
                ),
            },
        ])
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 0
        assert output["total_evaluated"] == 1


class TestEvolveThresholdOverride:
    """--threshold and --min-occurrences flag behavior."""

    def test_threshold_override_lowers_bar(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "marginal",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "marginal", confidence=0.5, usage_count=3, success_count=1
                ),
            },
        ])
        cli = CLI()
        rc = cli.run([
            "--json", "evolve", "--dry-run",
            "--threshold", "0.4",
            "--root", str(root),
        ])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["confidence"] == 0.4

    def test_min_occurrences_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "low-occ",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "low-occ", confidence=0.9, usage_count=2, success_count=1
                ),
            },
        ])
        cli = CLI()
        # Default threshold is 3, so usage_count=2 would fail
        rc = cli.run([
            "--json", "evolve", "--dry-run",
            "--min-occurrences", "2",
            "--root", str(root),
        ])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["occurrences"] == 2

    def test_min_success_count_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "low-succ",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "low-succ", confidence=0.9, usage_count=5, success_count=0
                ),
            },
        ])
        cli = CLI()
        # Default success_count threshold is 1, so success_count=0 would fail
        rc = cli.run([
            "--json", "evolve", "--dry-run",
            "--min-success-count", "0",
            "--root", str(root),
        ])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["success_count"] == 0

    def test_threshold_override_raises_bar(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "was-eligible",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "was-eligible", confidence=0.8, usage_count=5, success_count=2
                ),
            },
        ])
        cli = CLI()
        rc = cli.run([
            "--json", "evolve", "--dry-run",
            "--threshold", "0.95",
            "--root", str(root),
        ])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 0


class TestEvolveTargetFilter:
    """--target flag filters by promotion target classification."""

    def test_target_all_returns_all_eligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "inst-a",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content("inst-a"),
            },
            {
                "name": "inst-b",
                "scope": "global",
                "type": "discovery",
                "content": _make_instinct_content("inst-b", type_="discovery"),
            },
        ])
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--target", "all", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 2

    def test_target_skill_filters_correctly(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "workflow-inst",
                "scope": "global",
                "type": "discovery",
                "content": _make_instinct_content(
                    "workflow-inst", type_="discovery",
                    description="multi-step workflow pipeline orchestration"
                ),
            },
            {
                "name": "cmd-inst",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content(
                    "cmd-inst", type_="tool_use",
                    description="run execute validate check"
                ),
            },
        ])
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--target", "skill", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["target_filter"] == "skill"
        # discovery type maps to skill target
        names = {c["name"] for c in output["candidates"]}
        assert "workflow-inst" in names


class TestEvolveHumanOutput:
    """Human-readable (non-JSON) output mode."""

    def test_dry_run_human_output(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "promoted-one",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content("promoted-one"),
            },
        ])
        cli = CLI()
        rc = cli.run(["evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Would promote" in out
        assert "promoted-one" in out

    def test_non_dry_run_human_output(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(tmp_path, [
            {
                "name": "ready-inst",
                "scope": "global",
                "type": "tool_use",
                "content": _make_instinct_content("ready-inst"),
            },
        ])
        cli = CLI()
        rc = cli.run(["evolve", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Eligible for promotion" in out
        assert "ready-inst" in out
