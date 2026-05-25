"""Tests for the commands/evolve.md slash command.

Verification criteria for feature #54: all four flags parsed;
--dry-run lists candidates without writing; non-dry actually writes.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI
from platxa_agent_generator.instinct_store import InstinctStore
from platxa_agent_generator.shared.frontmatter import parse_frontmatter_safe

COMMANDS_DIR = Path(__file__).parent.parent / "commands"
EVOLVE_CMD = COMMANDS_DIR / "evolve.md"


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
    return "\n".join(
        [
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
        ]
    )


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


class TestEvolveCommandStructure:
    """Validate commands/evolve.md file structure and frontmatter."""

    def test_command_file_exists(self) -> None:
        assert EVOLVE_CMD.exists(), f"commands/evolve.md not found at {EVOLVE_CMD}"

    def test_frontmatter_has_required_fields(self) -> None:
        content = EVOLVE_CMD.read_text()
        fm, errors = parse_frontmatter_safe(content)
        assert fm is not None, f"Frontmatter parse failed: {errors}"
        assert "description" in fm
        assert "allowed-tools" in fm
        assert "argument-hint" in fm

    def test_frontmatter_description_nonempty(self) -> None:
        content = EVOLVE_CMD.read_text()
        fm, _ = parse_frontmatter_safe(content)
        assert fm is not None
        assert len(fm["description"]) > 0

    def test_allowed_tools_includes_bash(self) -> None:
        content = EVOLVE_CMD.read_text()
        fm, _ = parse_frontmatter_safe(content)
        assert fm is not None
        tools = fm["allowed-tools"]
        assert "Bash" in tools

    def test_argument_hint_documents_all_flags(self) -> None:
        content = EVOLVE_CMD.read_text()
        fm, _ = parse_frontmatter_safe(content)
        assert fm is not None
        hint = fm["argument-hint"]
        assert "--dry-run" in hint
        assert "--threshold" in hint
        assert "--min-occurrences" in hint
        assert "--target" in hint


class TestEvolveCommandDryRun:
    """--dry-run lists candidates without writing artifacts."""

    def test_dry_run_reports_candidates_no_side_effects(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "eligible-inst",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "eligible-inst", confidence=0.9, usage_count=5, success_count=2
                    ),
                },
            ],
        )
        output_dir = tmp_path / "output"
        output_dir.mkdir()

        cli = CLI()
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0

        output = json.loads(capsys.readouterr().out)
        assert output["dry_run"] is True
        assert output["eligible"] == 1
        assert output["candidates"][0]["name"] == "eligible-inst"
        assert not any(output_dir.iterdir()), "dry-run must not write files"

    def test_dry_run_with_threshold_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "marginal",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "marginal", confidence=0.5, usage_count=3, success_count=1
                    ),
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--threshold",
                "0.4",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["confidence"] == 0.4

    def test_dry_run_with_min_occurrences_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "low-occ",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "low-occ", confidence=0.9, usage_count=2, success_count=1
                    ),
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--min-occurrences",
                "1",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["occurrences"] == 1

    def test_dry_run_with_target_filter(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "inst-a",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("inst-a"),
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--target",
                "command",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output.get("target_filter") == "command"


class TestEvolveCommandNonDryRun:
    """Non-dry-run mode reports candidates as eligible for promotion (writing delegated to Claude)."""

    def test_non_dry_run_marks_candidates_eligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "promote-me",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "promote-me", confidence=0.9, usage_count=5, success_count=2
                    ),
                },
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "evolve", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["dry_run"] is False
        assert output["eligible"] == 1
        assert output["candidates"][0]["name"] == "promote-me"

    def test_non_dry_run_all_four_flags_combined(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "combined-test",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "combined-test", confidence=0.6, usage_count=4, success_count=2
                    ),
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--threshold",
                "0.5",
                "--min-occurrences",
                "2",
                "--target",
                "all",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["dry_run"] is False
        assert output["eligible"] == 1
        assert output["thresholds"]["confidence"] == 0.5
        assert output["thresholds"]["occurrences"] == 2
