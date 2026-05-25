#!/usr/bin/env python3
"""Tests for context_discovery.py."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from platxa_agent_generator.context_discovery import (
    ExistingAgent,
    check_name_conflict,
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


def _make_agent(name: str) -> ExistingAgent:
    return ExistingAgent(
        name=name, description="d", tools=[], file_path=f"/agents/{name}.md", scope="project"
    )


class TestSimilarityScores:
    """Validates similarity_scores field on ConflictCheck (#67)."""

    def test_field_defaults_to_empty_dict(self) -> None:
        result = check_name_conflict("brand-new", [])
        assert result.similarity_scores == {}

    def test_scores_in_zero_one_range(self) -> None:
        agents = [_make_agent(n) for n in ["code-reviewer", "test-generator", "plan-architect"]]
        result = check_name_conflict("code-explorer", agents)
        for score in result.similarity_scores.values():
            assert 0.0 <= score <= 1.0

    def test_exact_match_gets_score_one(self) -> None:
        agents = [_make_agent("my-agent"), _make_agent("other")]
        result = check_name_conflict("my-agent", agents)
        assert result.similarity_scores["my-agent"] == 1.0

    def test_case_insensitive_exact_match_gets_score_one(self) -> None:
        agents = [_make_agent("My-Agent")]
        result = check_name_conflict("my-agent", agents)
        assert result.similarity_scores["My-Agent"] == 1.0

    def test_top_five_limit(self) -> None:
        agents = [_make_agent(f"agent-{i}") for i in range(10)]
        result = check_name_conflict("agent-x", agents)
        assert len(result.similarity_scores) <= 5

    def test_similar_names_score_higher_than_dissimilar(self) -> None:
        agents = [_make_agent("code-reviewer"), _make_agent("xyz-unrelated")]
        result = check_name_conflict("code-review", agents)
        assert result.similarity_scores["code-reviewer"] > result.similarity_scores["xyz-unrelated"]

    def test_sorted_descending_by_score(self) -> None:
        agents = [_make_agent(n) for n in ["aaa", "code-reviewer", "code-review-helper"]]
        result = check_name_conflict("code-review", agents)
        scores = list(result.similarity_scores.values())
        assert scores == sorted(scores, reverse=True)

    def test_asdict_includes_similarity_scores(self) -> None:
        agents = [_make_agent("test-agent")]
        result = check_name_conflict("test-helper", agents)
        d = asdict(result)
        assert "similarity_scores" in d
        assert isinstance(d["similarity_scores"], dict)

    def test_discovery_report_includes_similarity_scores(self, tmp_path: Path) -> None:
        agent_file = tmp_path / "reviewer.md"
        agent_file.write_text(
            "---\nname: reviewer\ndescription: Reviews code\ntools: Read\n---\n\n# Body\n"
        )
        agents = scan_directory(str(tmp_path), scope="project")
        report = discovery_report(agents, proposed_name="review-helper")
        assert "similarity_scores" in report["conflict_check"]
        scores = report["conflict_check"]["similarity_scores"]
        assert "reviewer" in scores
        assert 0.0 <= scores["reviewer"] <= 1.0
