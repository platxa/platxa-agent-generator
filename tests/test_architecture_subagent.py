#!/usr/bin/env python3
"""Tests for architecture-subagent context_discovery input schema (#68)."""

from __future__ import annotations

from pathlib import Path

from platxa_agent_generator.context_discovery import (
    ExistingAgent,
    discovery_report,
    scan_directory,
)


def _make_agent(name: str, tools: list[str] | None = None) -> ExistingAgent:
    return ExistingAgent(
        name=name,
        description=f"Agent {name}",
        tools=tools or ["Read", "Grep"],
        file_path=f".claude/agents/{name}.md",
        scope="project",
        line_ranges=[(1, 5)],
    )


class TestContextDiscoverySchema:
    """Validates discovery_report() output matches architecture-subagent input."""

    def test_report_has_agents_found(self) -> None:
        agents = [_make_agent("a"), _make_agent("b")]
        report = discovery_report(agents)
        assert report["agents_found"] == 2

    def test_agent_entries_have_file_path(self) -> None:
        agents = [_make_agent("reviewer")]
        report = discovery_report(agents)
        assert report["agents"][0]["file_path"] == ".claude/agents/reviewer.md"

    def test_agent_entries_have_line_ranges(self) -> None:
        agents = [_make_agent("reviewer")]
        report = discovery_report(agents)
        assert report["agents"][0]["line_ranges"] == [(1, 5)]

    def test_agent_entries_have_tools(self) -> None:
        agents = [_make_agent("reviewer", tools=["Read", "Bash"])]
        report = discovery_report(agents)
        assert report["agents"][0]["tools"] == ["Read", "Bash"]

    def test_agent_entries_have_name(self) -> None:
        agents = [_make_agent("my-agent")]
        report = discovery_report(agents)
        assert report["agents"][0]["name"] == "my-agent"

    def test_report_has_patterns(self) -> None:
        agents = [_make_agent("a")]
        report = discovery_report(agents)
        assert "patterns" in report
        assert "tool_frequency" in report["patterns"]
        assert "recommended_base" in report["patterns"]

    def test_conflict_check_has_similarity_scores(self) -> None:
        agents = [_make_agent("code-reviewer")]
        report = discovery_report(agents, proposed_name="code-explorer")
        assert "conflict_check" in report
        assert "similarity_scores" in report["conflict_check"]
        scores = report["conflict_check"]["similarity_scores"]
        assert "code-reviewer" in scores
        assert 0.0 <= scores["code-reviewer"] <= 1.0

    def test_conflict_check_has_similar_names(self) -> None:
        agents = [_make_agent("code-reviewer")]
        report = discovery_report(agents, proposed_name="code-review")
        assert "similar_names" in report["conflict_check"]

    def test_conflict_check_has_has_conflict(self) -> None:
        agents = [_make_agent("my-agent")]
        report = discovery_report(agents, proposed_name="other-agent")
        assert report["conflict_check"]["has_conflict"] is False

    def test_no_conflict_check_without_proposed_name(self) -> None:
        agents = [_make_agent("a")]
        report = discovery_report(agents)
        assert "conflict_check" not in report


class TestContextDiscoveryFromScan:
    """Integration: scan_directory() → discovery_report() produces valid schema."""

    def test_scanned_report_has_context_discovery_fields(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text(
            "---\nname: test-agent\ndescription: A test\ntools: Read, Grep\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        report = discovery_report(agents, proposed_name="new-agent")

        assert report["agents_found"] == 1
        entry = report["agents"][0]
        assert "file_path" in entry
        assert "line_ranges" in entry
        assert "tools" in entry
        assert "name" in entry

        conflict = report["conflict_check"]
        assert "has_conflict" in conflict
        assert "similar_names" in conflict
        assert "similarity_scores" in conflict

    def test_scanned_line_ranges_are_populated(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "my-agent.md"
        agent_file.write_text(
            "---\nname: my-agent\ndescription: desc\ntools: Bash\nmodel: sonnet\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        report = discovery_report(agents)
        assert report["agents"][0]["line_ranges"] == [(1, 6)]

    def test_multiple_agents_all_have_schema_fields(self, tmp_path: Path) -> None:
        for name in ["alpha", "beta", "gamma"]:
            f = tmp_path / f"{name}.md"
            f.write_text(
                f"---\nname: {name}\ndescription: Agent {name}\ntools: Read\n---\n\n# {name}\n"
            )
        agents = scan_directory(str(tmp_path), scope="project")
        report = discovery_report(agents, proposed_name="delta")

        assert report["agents_found"] == 3
        for entry in report["agents"]:
            assert "file_path" in entry
            assert "line_ranges" in entry
            assert "tools" in entry
            assert "name" in entry
