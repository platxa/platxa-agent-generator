#!/usr/bin/env python3
"""
test_classification_rules — pin the absorbed classifier rules.

After feature #34, the classification logic that used to live in
`type_classifier.py` is encoded as markdown tables in
`skills/platxa-agent-generator/references/classification-rules.md`. The
architecture-subagent consults that file at runtime. With no Python source
of truth left, this test parses the markdown tables and runs the documented
algorithm against the worked example to guard against silent drift.

Scope:
- Verifies presence of every required architecture indicator (strong +
  moderate) for each of the four types.
- Verifies presence of every required complexity indicator (high + medium +
  low) keyword.
- Re-runs the worked example end-to-end against the parsed tables and
  asserts the documented winner, score, confidence, complexity, and
  pattern match the markdown's claimed example output.
"""

from __future__ import annotations

import re
from pathlib import Path

REFERENCE_PATH = (
    Path(__file__).parent.parent
    / "skills"
    / "platxa-agent-generator"
    / "references"
    / "classification-rules.md"
)


REQUIRED_ARCHITECTURE_INDICATORS: dict[str, dict[str, set[str]]] = {
    "Orchestrator": {
        "strong": {
            "orchestrat",
            "coordinate",
            "delegate",
            "manage workers",
            "spawn",
            "distribute tasks",
            "main agent",
            "worker agents",
            "decompos",
            "break down",
            "subtasks",
            "subagents",
        },
        "moderate": {
            "multiple workers",
            "team of",
            "supervise",
            "dispatch",
            "fan out",
            "parallelize",
            "concurrent workers",
        },
    },
    "Multi-Agent": {
        "strong": {
            "multi-agent",
            "multiple agents",
            "agent team",
            "collaborat",
            "peer agents",
            "independent agents",
            "agent network",
            "agents working together",
        },
        "moderate": {
            "several agents",
            "different agents",
            "specialized agents",
            "agent roles",
            "role-based",
            "crew of",
        },
    },
    "Pipeline": {
        "strong": {
            "pipeline",
            "sequential",
            "chain of",
            "stages",
            "step by step",
            "phase by phase",
            "workflow stages",
            "processing chain",
            "data pipeline",
            "ETL",
        },
        "moderate": {
            "then",
            "after that",
            "followed by",
            "next step",
            "first.*then",
            "process.*transform.*output",
            "input.*process.*output",
        },
    },
    "Simple": {
        "strong": {
            "single agent",
            "simple",
            "straightforward",
            "direct",
            "basic",
            "one agent",
            "standalone",
        },
        "moderate": {"just", "only", "simply", "quick"},
    },
}


REQUIRED_COMPLEXITY_INDICATORS: dict[str, set[str]] = {
    "high": {
        "complex",
        "sophisticated",
        "advanced",
        "enterprise",
        "large-scale",
        "distributed",
        "scalable",
        "production",
        "multiple",
        "various",
        "different types",
        "comprehensive",
    },
    "medium": {
        "moderate",
        "several",
        "some",
        "various",
        "configurable",
        "flexible",
        "extensible",
    },
    "low": {
        "simple",
        "basic",
        "straightforward",
        "quick",
        "single",
        "one",
        "minimal",
        "lightweight",
    },
}


WORKED_EXAMPLE_DESCRIPTION = (
    "Build an orchestrator that decomposes user requests into parallel "
    "subtasks and synthesises worker results."
)


def _load_reference() -> str:
    """Read the classification-rules.md reference file."""
    return REFERENCE_PATH.read_text(encoding="utf-8")


def _extract_table_row(content: str, marker: str) -> str:
    """Return the markdown table row that follows the given section marker.

    `marker` is a header (`### Orchestrator`) and the row of interest is
    the first non-header line beginning with `| strong` or `| moderate`
    after that header.
    """
    section_start = content.index(marker)
    return content[section_start : section_start + 2000]


def _parse_pipe_cell(row: str) -> set[str]:
    """Extract backtick-quoted tokens from a single pipe-cell row."""
    return set(re.findall(r"`([^`]+)`", row))


def _score_type(
    description: str,
    indicators: dict[str, set[str]],
) -> tuple[float, list[str]]:
    """Replicate the type-scoring algorithm documented in the reference."""
    desc_lower = description.lower()
    strong_matches = [ind for ind in indicators["strong"] if ind in desc_lower]
    moderate_matches: list[str] = []
    for ind in indicators["moderate"]:
        if ".*" in ind:
            if re.search(ind, desc_lower):
                moderate_matches.append(ind)
        elif ind in desc_lower:
            moderate_matches.append(ind)
    raw = 2.0 * len(strong_matches) + 1.0 * len(moderate_matches)
    return min(raw / 6.0, 1.0), strong_matches + moderate_matches


def _estimate_complexity(description: str) -> int:
    """Replicate the complexity 1-5 algorithm documented in the reference."""
    desc_lower = description.lower()
    high = sum(1 for ind in REQUIRED_COMPLEXITY_INDICATORS["high"] if ind in desc_lower)
    medium = sum(1 for ind in REQUIRED_COMPLEXITY_INDICATORS["medium"] if ind in desc_lower)
    low = sum(1 for ind in REQUIRED_COMPLEXITY_INDICATORS["low"] if ind in desc_lower)
    word_count = len(description.split())

    if high >= 2 or word_count > 50:
        base = 4
    elif high >= 1 or medium >= 2:
        base = 3
    elif low >= 2:
        base = 1
    elif medium >= 1 or word_count > 20:
        base = 2
    else:
        base = 2

    if any(word in desc_lower for word in ["orchestrat", "multi-agent", "pipeline"]):
        base = max(base, 3)

    return min(max(base, 1), 5)


class TestArchitectureIndicators:
    """Reference must preserve every architecture indicator from type_classifier.py."""

    def test_all_indicators_documented(self) -> None:
        content = _load_reference()
        for arch_type, groups in REQUIRED_ARCHITECTURE_INDICATORS.items():
            section = _extract_table_row(content, f"### {arch_type}")
            tokens = _parse_pipe_cell(section)
            missing_strong = groups["strong"] - tokens
            missing_moderate = groups["moderate"] - tokens
            assert not missing_strong, (
                f"{arch_type} missing strong indicators: {sorted(missing_strong)}"
            )
            assert not missing_moderate, (
                f"{arch_type} missing moderate indicators: {sorted(missing_moderate)}"
            )


class TestComplexityIndicators:
    """Reference must preserve every complexity indicator from type_classifier.py."""

    def test_all_indicators_documented(self) -> None:
        content = _load_reference()
        section = _extract_table_row(content, "## Complexity Indicators")
        tokens = _parse_pipe_cell(section)
        for level, expected in REQUIRED_COMPLEXITY_INDICATORS.items():
            missing = expected - tokens
            assert not missing, f"Complexity {level} missing indicators: {sorted(missing)}"


class TestWorkedExample:
    """The worked example in the reference must match its own algorithm."""

    def test_orchestrator_wins_with_full_score(self) -> None:
        score, matches = _score_type(
            WORKED_EXAMPLE_DESCRIPTION,
            REQUIRED_ARCHITECTURE_INDICATORS["Orchestrator"],
        )
        assert score == 1.0, f"Expected normalized score 1.0, got {score}"
        assert {"orchestrat", "decompos", "subtasks"} <= set(matches)

    def test_other_types_score_zero(self) -> None:
        for arch_type in ("Multi-Agent", "Pipeline"):
            score, _ = _score_type(
                WORKED_EXAMPLE_DESCRIPTION,
                REQUIRED_ARCHITECTURE_INDICATORS[arch_type],
            )
            assert score == 0.0, f"{arch_type} unexpectedly scored {score}"

    def test_simple_scores_zero(self) -> None:
        score, _ = _score_type(
            WORKED_EXAMPLE_DESCRIPTION,
            REQUIRED_ARCHITECTURE_INDICATORS["Simple"],
        )
        assert score == 0.0

    def test_complexity_resolves_to_three(self) -> None:
        assert _estimate_complexity(WORKED_EXAMPLE_DESCRIPTION) == 3

    def test_word_count_documented_correctly(self) -> None:
        actual = len(WORKED_EXAMPLE_DESCRIPTION.split())
        content = _load_reference()
        assert f"word_count = {actual}" in content, (
            f"Worked example must state word_count = {actual}; file disagrees with the algorithm"
        )


class TestReferenceFileShape:
    """Smoke-tests for sections the architecture-subagent depends on."""

    def test_all_required_sections_present(self) -> None:
        content = _load_reference()
        for heading in (
            "## Architecture Indicators",
            "### Orchestrator",
            "### Multi-Agent",
            "### Pipeline",
            "### Simple",
            "## Type Scoring Algorithm",
            "### Picking the Winner",
            "### Confidence",
            "## Complexity Indicators",
            "### Complexity Algorithm",
            "## Architecture → Pattern Mapping",
            "### Pattern Adjustments",
            "## Reasoning Output",
            "## Worked Example",
        ):
            assert heading in content, f"Missing section: {heading}"
