#!/usr/bin/env python3
"""NLP Parser — structured output definitions for agent requirements.

Provides dataclasses and a thin ``parse()`` entry point that returns
minimal defaults. Full natural-language understanding (agent type
classification, tool selection, domain detection, constraint extraction,
complexity estimation) is delegated to Claude's native reasoning via the
discovery-subagent.

Usage:
    python nlp_parser.py "Create an agent that reviews code for security issues"
    python nlp_parser.py --json "Build a documentation generator"
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass, field


@dataclass
class ExtractedConstraints:
    """Constraints extracted from the description text.

    Constraints are authoring signals that restrict or scope the generated
    agent — e.g. "read-only", "Python only". The discovery-subagent
    populates these via Claude's native understanding.
    """

    read_only: bool = False
    disallowed_tools: list[str] = field(default_factory=list)
    file_patterns: list[str] = field(default_factory=list)
    constraint_phrases: list[str] = field(default_factory=list)


@dataclass
class ComplexityEstimate:
    """Complexity classification for an agent description.

    Drives pattern selection and maxTurns budget. The discovery-subagent
    classifies complexity via Claude's reasoning.

    Fields:
        tier: "simple" | "moderate" | "complex".
        max_turns: Recommended ``maxTurns`` frontmatter value.
        signals: Classification cues (for observability).
    """

    tier: str
    max_turns: int
    signals: dict[str, str] = field(default_factory=dict)


@dataclass
class AgentRequirements:
    """Structured agent requirements from a natural language description."""

    name: str
    agent_type: str
    description: str
    tools: list[str]
    patterns: list[str]
    confidence: float
    domains: list[str]
    disallowed_tools: list[str] = field(default_factory=list)
    file_patterns: list[str] = field(default_factory=list)
    constraint_phrases: list[str] = field(default_factory=list)
    complexity: str = "simple"
    max_turns: int = 5
    complexity_signals: dict[str, str] = field(default_factory=dict)


COMPLEXITY_TIERS: tuple[str, ...] = ("simple", "moderate", "complex")

_DEFAULT_TOOLS: list[str] = ["Bash", "Edit", "Glob", "Grep", "Read", "Write"]


def extract_name(description: str) -> str:
    """Generate a kebab-case agent name slug from a description."""
    stopwords = {
        "a",
        "an",
        "the",
        "that",
        "which",
        "for",
        "to",
        "and",
        "or",
        "with",
        "from",
        "into",
        "onto",
        "upon",
        "about",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "between",
        "under",
        "over",
        "create",
        "build",
        "make",
        "agent",
        "can",
        "will",
        "should",
        "would",
        "want",
        "need",
        "like",
        "help",
        "use",
        "using",
        "used",
        "please",
        "could",
        "might",
        "must",
    }

    words = re.findall(r"\b[a-z]+\b", description.lower())
    meaningful = [w for w in words if w not in stopwords and len(w) > 2]

    name_parts = meaningful[:3] if len(meaningful) >= 3 else meaningful[:2]

    if not name_parts:
        return "custom-agent"

    return "-".join(name_parts)


def _sanitize_description(description: str) -> str:
    """Collapse whitespace and truncate for safe YAML frontmatter embedding.

    Newlines in the description would let a crafted input escape YAML
    frontmatter (``---`` on its own line). Collapsing all whitespace
    to single spaces eliminates the attack vector.
    """
    desc = re.sub(r"\s+", " ", description).strip()
    if desc:
        desc = desc[0].upper() + desc[1:]
    if len(desc) > 1024:
        desc = desc[:1021] + "..."
    return desc


def parse(description: str) -> AgentRequirements:
    """Parse a natural language description into agent requirements.

    Returns structured defaults — full NL understanding (type classification,
    tool selection, domain detection, constraint extraction, complexity
    estimation) is delegated to the discovery-subagent via Claude's native
    reasoning.
    """
    name = extract_name(description)
    desc = _sanitize_description(description)

    return AgentRequirements(
        name=name,
        agent_type="analyzer",
        description=desc,
        tools=list(_DEFAULT_TOOLS),
        patterns=["prompt-chaining"],
        confidence=0.5,
        domains=[],
    )


def main() -> None:
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: nlp_parser.py [--json] <description>", file=sys.stderr)
        sys.exit(1)

    json_output = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--json"]

    if not args:
        print("Error: No description provided", file=sys.stderr)
        sys.exit(1)

    description = " ".join(args)
    result = parse(description)

    if json_output:
        print(json.dumps(asdict(result), indent=2))
    else:
        print(f"Name:        {result.name}")
        print(f"Type:        {result.agent_type}")
        print(f"Description: {result.description}")
        print(f"Tools:       {', '.join(result.tools)}")
        print(f"Patterns:    {', '.join(result.patterns)}")
        print(f"Complexity:  {result.complexity} (maxTurns={result.max_turns})")
        print(f"Confidence:  {result.confidence:.0%}")


if __name__ == "__main__":
    main()
