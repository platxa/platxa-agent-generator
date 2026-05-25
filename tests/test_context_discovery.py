#!/usr/bin/env python3
"""Tests for context_discovery.py — ExistingAgent.line_ranges field (feature #66)."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from platxa_agent_generator.context_discovery import (
    ExistingAgent,
    discovery_report,
    scan_directory,
)


class TestExistingAgentLineRanges:
    """Validates the line_ranges field on ExistingAgent."""

    def test_field_defaults_to_empty_list(self) -> None:
        agent = ExistingAgent(
            name="test", description="d", tools=[], file_path="/f", scope="project"
        )
        assert agent.line_ranges == []

    def test_field_accepts_tuple_pairs(self) -> None:
        agent = ExistingAgent(
            name="test",
            description="d",
            tools=[],
            file_path="/f",
            scope="project",
            line_ranges=[(1, 5), (10, 20)],
        )
        assert agent.line_ranges == [(1, 5), (10, 20)]

    def test_asdict_round_trip(self) -> None:
        agent = ExistingAgent(
            name="test",
            description="d",
            tools=["Read"],
            file_path="/f",
            scope="project",
            line_ranges=[(1, 4)],
        )
        d = asdict(agent)
        assert "line_ranges" in d
        assert d["line_ranges"] == [(1, 4)]


class TestScanDirectoryLineRanges:
    """Validates that scan_directory populates line_ranges from frontmatter."""

    def test_scan_populates_frontmatter_range(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "my-agent.md"
        agent_file.write_text(
            "---\nname: my-agent\ndescription: A test agent\ntools: Read, Write\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        assert len(agents) == 1
        assert agents[0].line_ranges == [(1, 5)]

    def test_scan_no_frontmatter_gives_empty_ranges(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "bare.md"
        agent_file.write_text("# No frontmatter\nJust text.\n")
        agents = scan_directory(str(tmp_path), scope="project")
        assert agents == []

    def test_scan_multiline_frontmatter_range(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "big.md"
        agent_file.write_text(
            "---\nname: big\ndescription: Big agent\ntools: Read\nmodel: sonnet\nmaxTurns: 5\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        assert len(agents) == 1
        assert agents[0].line_ranges == [(1, 7)]


class TestDiscoveryReportLineRanges:
    """Validates that discovery_report() output includes line_ranges."""

    def test_report_includes_line_ranges(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "reporter.md"
        agent_file.write_text(
            "---\nname: reporter\ndescription: Reports\ntools: Bash\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        report = discovery_report(agents)
        assert report["agents_found"] == 1
        agent_entry = report["agents"][0]
        assert "line_ranges" in agent_entry
        assert agent_entry["line_ranges"] == [(1, 5)]
