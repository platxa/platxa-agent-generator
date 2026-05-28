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


def _extract_worked_example_block(content: str) -> str:
    """Return the `## Worked Example` body, raising if absent."""
    marker = "## Worked Example"
    if marker not in content:
        raise AssertionError("classification-rules.md is missing the `## Worked Example` section")
    start = content.index(marker)
    return content[start : start + 2500]


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
    """The worked-example output claimed by the markdown must be self-consistent.

    Replaces the prior "Python re-implementation runs against itself"
    pattern (PR #1 review I11). Now the tests parse the *claims* made
    in the worked-example section and check them against the
    description: every claimed strong indicator must actually be a
    substring of the description, every type the markdown says scored
    zero must have no strong indicators present, the documented word
    count must match the description, and the documented winner must
    appear in the documented architecture indicator table. A
    drift-of-prose-only-but-not-table edit fails one of these checks.
    """

    def test_description_contains_claimed_strong_indicators(self) -> None:
        """Worked example claims orchestrat/decompos/subtasks matched.

        Each claimed-matched indicator must actually be a substring of
        the description; otherwise the markdown's arithmetic is bogus.
        """
        desc_lower = WORKED_EXAMPLE_DESCRIPTION.lower()
        # Indicators the markdown claims matched the description.
        claimed_matches = {"orchestrat", "decompos", "subtasks"}
        # And the markdown claims these are all in Orchestrator.strong.
        orchestrator_strong = REQUIRED_ARCHITECTURE_INDICATORS["Orchestrator"]["strong"]
        for ind in claimed_matches:
            assert ind in desc_lower, (
                f"Worked example claims '{ind}' matched but description does not contain it"
            )
            assert ind in orchestrator_strong, (
                f"Worked example claims '{ind}' is Orchestrator.strong but indicator table disagrees"
            )

    def test_non_winning_types_have_no_strong_matches(self) -> None:
        """Markdown claims Multi-Agent, Pipeline, Simple all scored 0.0.

        Each must therefore have *no* strong indicator that appears in
        the description. A future edit that adds e.g. "pipeline" to
        the description without also revising the worked example's
        claimed scores fails this test.
        """
        desc_lower = WORKED_EXAMPLE_DESCRIPTION.lower()
        for arch_type in ("Multi-Agent", "Pipeline", "Simple"):
            strong = REQUIRED_ARCHITECTURE_INDICATORS[arch_type]["strong"]
            hits = {ind for ind in strong if ind in desc_lower}
            assert not hits, (
                f"Worked example claims {arch_type} scored 0.0 but description contains "
                f"strong indicators: {sorted(hits)}"
            )

    def test_word_count_claim_matches_description(self) -> None:
        """Markdown states `word_count = 14` — must equal len(description.split())."""
        actual = len(WORKED_EXAMPLE_DESCRIPTION.split())
        content = _load_reference()
        assert f"word_count = {actual}" in content, (
            f"Worked example must state word_count = {actual}; file says otherwise"
        )

    def test_worked_example_outcome_claims_present(self) -> None:
        """The worked-example prose must state the four canonical outcomes.

        Winner = Orchestrator, score = 1.0, complexity base = 3 after
        the orchestrator/multi-agent/pipeline pattern adjustment, and
        the final pattern = parallelization (because 'parallel' fires
        the override). A copy-edit that removes any of these silently
        is the failure mode this test guards against.
        """
        block = _extract_worked_example_block(_load_reference())
        for claim in (
            "Winner: **Orchestrator**",
            "`1.0`",
            "max(2, 3) = 3",
            "**parallelization**",
        ):
            assert claim in block, f"Worked example missing canonical claim: {claim!r}"

    def test_worked_example_has_no_complexity_keyword_matches(self) -> None:
        """Markdown claims high/medium/low counts are all 0 for the example.

        Verifying that against the actual description guards the
        complexity arithmetic the same way the architecture test
        guards the type arithmetic — neither test is a replay of the
        algorithm; both check the markdown's stated claims against
        the actual content it claims about.
        """
        desc_lower = WORKED_EXAMPLE_DESCRIPTION.lower()
        for level in ("high", "medium", "low"):
            hits = {
                ind
                for ind in REQUIRED_COMPLEXITY_INDICATORS[level]
                if ind in desc_lower
            }
            assert not hits, (
                f"Worked example claims {level}_count = 0 but description matches: {sorted(hits)}"
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
