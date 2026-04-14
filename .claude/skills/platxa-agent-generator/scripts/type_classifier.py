#!/usr/bin/env python3
"""
Agent Architecture Type Classifier for Platxa Agent Generator

Classifies agent descriptions into architectural patterns:
- simple: Single agent, direct execution, no subagents
- orchestrator: Main agent coordinating worker subagents
- multi-agent: Multiple independent agents collaborating
- pipeline: Sequential chain of processing stages

Usage:
    python type_classifier.py "Create an agent that coordinates multiple workers"
    python type_classifier.py --json "Build a pipeline for data processing"
"""

import json
import re
import sys
from dataclasses import asdict, dataclass
from enum import Enum


class ArchitectureType(Enum):
    """Agent architectural patterns based on Anthropic's research."""

    SIMPLE = "simple"
    ORCHESTRATOR = "orchestrator"
    MULTI_AGENT = "multi-agent"
    PIPELINE = "pipeline"


@dataclass
class ClassificationResult:
    """Result of architectural classification."""

    architecture_type: str
    confidence: float
    reasoning: str
    suggested_pattern: str
    complexity_score: int  # 1-5 scale


# Pattern indicators for each architecture type
ARCHITECTURE_INDICATORS: dict[ArchitectureType, dict[str, list[str]]] = {
    ArchitectureType.ORCHESTRATOR: {
        "strong": [
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
        ],
        "moderate": [
            "multiple workers",
            "team of",
            "supervise",
            "dispatch",
            "fan out",
            "parallelize",
            "concurrent workers",
        ],
    },
    ArchitectureType.MULTI_AGENT: {
        "strong": [
            "multi-agent",
            "multiple agents",
            "agent team",
            "collaborate",
            "peer agents",
            "independent agents",
            "agent network",
            "agents working together",
            "agent collaboration",
        ],
        "moderate": [
            "several agents",
            "different agents",
            "specialized agents",
            "agent roles",
            "role-based",
            "crew of",
        ],
    },
    ArchitectureType.PIPELINE: {
        "strong": [
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
        ],
        "moderate": [
            "then",
            "after that",
            "followed by",
            "next step",
            "first.*then",
            "process.*transform.*output",
            "input.*process.*output",
        ],
    },
    ArchitectureType.SIMPLE: {
        "strong": [
            "single agent",
            "simple",
            "straightforward",
            "direct",
            "basic",
            "one agent",
            "standalone",
        ],
        "moderate": [
            "just",
            "only",
            "simply",
            "quick",
        ],
    },
}

# Complexity indicators
COMPLEXITY_INDICATORS = {
    "high": [
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
    ],
    "medium": [
        "moderate",
        "several",
        "some",
        "various",
        "configurable",
        "flexible",
        "extensible",
    ],
    "low": [
        "simple",
        "basic",
        "straightforward",
        "quick",
        "single",
        "one",
        "minimal",
        "lightweight",
    ],
}

# Workflow pattern mapping
ARCHITECTURE_TO_PATTERN = {
    ArchitectureType.SIMPLE: "prompt-chaining",
    ArchitectureType.ORCHESTRATOR: "orchestrator-workers",
    ArchitectureType.MULTI_AGENT: "parallelization",
    ArchitectureType.PIPELINE: "prompt-chaining",
}


def calculate_type_score(description: str, arch_type: ArchitectureType) -> tuple[float, list[str]]:
    """Calculate score for a specific architecture type."""
    desc_lower = description.lower()
    indicators = ARCHITECTURE_INDICATORS[arch_type]

    strong_matches: list[str] = []
    moderate_matches: list[str] = []

    # Check strong indicators
    for indicator in indicators.get("strong", []):
        if indicator in desc_lower:
            strong_matches.append(indicator)

    # Check moderate indicators (some use regex patterns)
    for indicator in indicators.get("moderate", []):
        if ".*" in indicator:
            # Treat as regex pattern
            if re.search(indicator, desc_lower):
                moderate_matches.append(indicator)
        elif indicator in desc_lower:
            moderate_matches.append(indicator)

    # Calculate score: strong matches worth 2, moderate worth 1
    score = len(strong_matches) * 2.0 + len(moderate_matches) * 1.0

    # Normalize to 0-1 range (assume max reasonable score is 6)
    normalized_score = min(score / 6.0, 1.0)

    matches = strong_matches + moderate_matches
    return normalized_score, matches


def estimate_complexity(description: str) -> int:
    """Estimate complexity on 1-5 scale."""
    desc_lower = description.lower()

    high_count = sum(1 for ind in COMPLEXITY_INDICATORS["high"] if ind in desc_lower)
    medium_count = sum(1 for ind in COMPLEXITY_INDICATORS["medium"] if ind in desc_lower)
    low_count = sum(1 for ind in COMPLEXITY_INDICATORS["low"] if ind in desc_lower)

    # Word count also indicates complexity
    word_count = len(description.split())

    # Calculate base complexity
    if high_count >= 2 or word_count > 50:
        base = 4
    elif high_count >= 1 or medium_count >= 2:
        base = 3
    elif low_count >= 2:
        base = 1
    elif medium_count >= 1 or word_count > 20:
        base = 2
    else:
        base = 2  # Default to medium-low

    # Adjust based on specific patterns
    if any(word in desc_lower for word in ["orchestrat", "multi-agent", "pipeline"]):
        base = max(base, 3)

    return min(max(base, 1), 5)


def generate_reasoning(arch_type: ArchitectureType, matches: list[str], complexity: int) -> str:
    """Generate human-readable reasoning for classification."""
    if not matches:
        return f"Default classification to {arch_type.value} based on absence of complex patterns."

    match_str = ", ".join(f"'{m}'" for m in matches[:3])
    if len(matches) > 3:
        match_str += f" (+{len(matches) - 3} more)"

    complexity_desc = {
        1: "low",
        2: "medium-low",
        3: "medium",
        4: "high",
        5: "very high",
    }

    return (
        f"Classified as {arch_type.value} based on indicators: {match_str}. "
        f"Complexity: {complexity_desc.get(complexity, 'medium')}."
    )


def classify(description: str) -> ClassificationResult:
    """Classify agent description into architectural type."""
    # Calculate scores for each architecture type
    scores: dict[ArchitectureType, tuple[float, list[str]]] = {}

    for arch_type in ArchitectureType:
        score, matches = calculate_type_score(description, arch_type)
        scores[arch_type] = (score, matches)

    # Find the highest scoring type
    best_type = max(scores.keys(), key=lambda t: scores[t][0])
    best_score, best_matches = scores[best_type]

    # If no clear winner (score too low), default to SIMPLE
    if best_score < 0.15:
        best_type = ArchitectureType.SIMPLE
        best_score = 0.5
        best_matches = []

    # Calculate confidence
    # Higher if clear winner, lower if close race
    other_scores = [s for t, (s, _) in scores.items() if t != best_type]
    max_other = max(other_scores) if other_scores else 0

    if best_score > 0:
        margin = (best_score - max_other) / best_score
        confidence = min(0.5 + margin * 0.5, 1.0)
    else:
        confidence = 0.5

    # Round confidence
    confidence = round(confidence, 2)

    # Estimate complexity
    complexity = estimate_complexity(description)

    # Get suggested workflow pattern
    suggested_pattern = ARCHITECTURE_TO_PATTERN[best_type]

    # Adjust pattern based on specific indicators
    desc_lower = description.lower()
    if "parallel" in desc_lower or "concurrent" in desc_lower:
        suggested_pattern = "parallelization"
    elif "iterative" in desc_lower or "refine" in desc_lower or "feedback" in desc_lower:
        suggested_pattern = "evaluator-optimizer"
    elif "route" in desc_lower or "classify" in desc_lower or "categorize" in desc_lower:
        suggested_pattern = "routing"

    # Generate reasoning
    reasoning = generate_reasoning(best_type, best_matches, complexity)

    return ClassificationResult(
        architecture_type=best_type.value,
        confidence=confidence,
        reasoning=reasoning,
        suggested_pattern=suggested_pattern,
        complexity_score=complexity,
    )


# Recommended maxTurns by architecture type and complexity.
# These prevent runaway agents from consuming excessive tokens.
# Values are based on observed agent behavior in Claude Code:
#   - simple agents rarely need >10 tool calls
#   - orchestrators need turns for planning + delegation + synthesis
#   - multi-agent systems need room for inter-agent coordination
#   - pipelines need turns proportional to stage count
MAX_TURNS_BY_TYPE: dict[str, dict[str, int]] = {
    "simple": {
        "low": 10,  # Quick tasks: lint, format, single-file read
        "default": 15,  # Standard: read + analyze + report
        "high": 20,  # Complex single-agent: multi-file analysis
    },
    "orchestrator": {
        "low": 15,  # Few workers, simple delegation
        "default": 25,  # Typical: plan + delegate + synthesize
        "high": 40,  # Many workers, complex coordination
    },
    "multi-agent": {
        "low": 25,  # Small team, focused tasks
        "default": 50,  # Typical: spawn + coordinate + aggregate
        "high": 75,  # Large team, iterative collaboration
    },
    "pipeline": {
        "low": 15,  # 2-3 stages
        "default": 25,  # 4-5 stages with validation
        "high": 40,  # 6+ stages with quality gates
    },
}


# Background-suitability indicators. Background agents are those whose
# work doesn't block the main conversation: monitors, watchers, log
# tailers, CI pollers, scheduled audits. Public so callers (NLP parser,
# generation report) can reuse the same vocabulary and tests can pin it.
#
# Ordered conceptually: explicit "background" → continuous-observation
# verbs → CI/scheduled-execution patterns. Word-boundary matching keeps
# "monitoring" from firing on "monitorial" or unrelated substrings.
BACKGROUND_KEYWORDS: tuple[str, ...] = (
    "background",
    "monitor",
    "monitoring",
    "watch",
    "watcher",
    "watching",
    "tail",
    "tailing",
    "poll",
    "polling",
    "log tailer",
    "log tailing",
    "ci watcher",
    "ci poller",
    "scheduled",
    "cron",
    "long-running",
    "long running",
    "non-blocking",
    "non blocking",
    "observe continuously",
    "continuously observe",
)

# Compiled once at module load — re.escape handles spaces and punctuation,
# \b boundaries prevent partial-word false positives.
_BACKGROUND_PATTERN = re.compile(
    r"\b(?:" + "|".join(re.escape(k) for k in BACKGROUND_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


# Category → color mapping for the agent frontmatter `color:` field.
# Colors are CSS named colors so they render uniformly across light/dark
# Claude Code UI themes. Categories are matched by keyword on the
# description; the first category whose keywords match wins. Public so
# tests, the CLI catalog, and downstream tooling share one source of truth.
#
# Color choices are intentional: red signals risk (security work),
# green signals validation (testing), blue signals reference (docs),
# orange signals data flow (database/API), purple signals coordination
# (orchestration), cyan signals analysis (review/audit). The default
# (no match) returns None so callers can leave the field unset.
CATEGORY_COLOR_MAP: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("red", ("security", "auth", "credential", "vulnerability", "threat", "exploit")),
    ("green", ("test", "testing", "tdd", "coverage", "validation", "validator")),
    ("blue", ("doc", "docs", "documentation", "manual", "reference")),
    ("orange", ("database", "schema", "migration", "sql", "api", "endpoint")),
    ("purple", ("orchestrat", "coordinate", "delegate", "multi-agent", "workflow")),
    ("cyan", ("review", "audit", "analyze", "lint", "inspect")),
)

# Compile keyword patterns once. Each color has its own pattern so callers
# can ask "did this category match?" cheaply, and the first-match-wins
# rule above gives a deterministic answer per description.
_CATEGORY_COLOR_PATTERNS: tuple[tuple[str, "re.Pattern[str]"], ...] = tuple(
    (
        color,
        re.compile(
            r"\b(?:" + "|".join(re.escape(k) for k in keywords) + r")\b",
            re.IGNORECASE,
        ),
    )
    for color, keywords in CATEGORY_COLOR_MAP
)


def recommend_color(description: str) -> str | None:
    """Return a CSS color string recommended for the agent's frontmatter.

    Walks :data:`CATEGORY_COLOR_MAP` in declaration order and returns the
    color of the first category whose keywords appear in ``description``
    with word-boundary matching. Returns ``None`` when no category matches
    so the caller can omit the ``color:`` field — a missing color is the
    correct default rather than a fallback (e.g. "gray") that would look
    intentional but isn't.

    Empty / whitespace input returns None for the same reason
    :func:`is_background_suitable` does: callers commonly pass partial
    descriptions during prompt drafting.
    """
    if not description or not description.strip():
        return None
    for color, pattern in _CATEGORY_COLOR_PATTERNS:
        if pattern.search(description):
            return color
    return None


def is_background_suitable(description: str) -> bool:
    """Return True when the description names work that should run in background mode.

    Background-suitable agents typically observe state without acting on
    the main conversation (log tailers, CI watchers, monitoring loops,
    scheduled audits). The check is keyword-based and intentionally
    conservative — false negatives are safer than false positives because
    a missed flag just means the agent runs in the foreground (the safe
    default), whereas a false positive would silently background work the
    user expected to see.

    Empty or whitespace-only descriptions return False rather than raising;
    callers commonly pass partially-built descriptions during prompt
    drafting and a hard error there would be noisier than a quiet False.
    """
    if not description or not description.strip():
        return False
    return _BACKGROUND_PATTERN.search(description) is not None


def recommend_max_turns(architecture_type: str, complexity_score: int) -> int:
    """Recommend maxTurns based on architecture type and complexity.

    Args:
        architecture_type: One of 'simple', 'orchestrator', 'multi-agent', 'pipeline'
        complexity_score: 1-5 scale from estimate_complexity()

    Returns:
        Recommended maxTurns value (positive integer)
    """
    type_config = MAX_TURNS_BY_TYPE.get(architecture_type, MAX_TURNS_BY_TYPE["simple"])

    if complexity_score <= 2:
        return type_config["low"]
    elif complexity_score >= 4:
        return type_config["high"]
    else:
        return type_config["default"]


# Model routing by architecture type and complexity.
# Optimizes cost: cheap models for cheap decisions, capable models for hard ones.
# Based on Anthropic's guidance: "use cheap models for cheap decisions."
MODEL_BY_TYPE: dict[str, dict[str, str]] = {
    "simple": {
        "low": "haiku",  # Validators, linters, single-file reads
        "default": "sonnet",  # Standard analysis, code review
        "high": "sonnet",  # Complex single-agent tasks
    },
    "orchestrator": {
        "low": "sonnet",  # Simple delegation
        "default": "sonnet",  # Standard orchestration
        "high": "opus",  # Complex multi-worker coordination
    },
    "multi-agent": {
        "low": "sonnet",  # Small focused teams
        "default": "opus",  # Multi-agent coordination
        "high": "opus",  # Large-scale agent collaboration
    },
    "pipeline": {
        "low": "haiku",  # Simple 2-3 stage pipelines
        "default": "sonnet",  # Standard pipeline orchestration
        "high": "sonnet",  # Complex pipelines with quality gates
    },
}


# Effort levels by architecture type.
# Maps extended thinking intensity needs to Claude Code effort frontmatter values.
# - "low": minimal thinking — validators, linters, simple lookups
# - "medium": balanced thinking — standard agents, code review
# - "high": deep thinking — complex orchestrators, architecture decisions
EFFORT_BY_TYPE: dict[str, dict[str, str]] = {
    "simple": {"low": "low", "default": "low", "high": "medium"},
    "orchestrator": {"low": "medium", "default": "medium", "high": "high"},
    "multi-agent": {"low": "medium", "default": "high", "high": "high"},
    "pipeline": {"low": "low", "default": "medium", "high": "high"},
}


def recommend_effort(architecture_type: str, complexity_score: int) -> str:
    """Recommend effort level based on architecture type and complexity.

    Maps the complexity analysis to Claude Code's effort frontmatter field,
    which controls extended thinking intensity per agent.

    Args:
        architecture_type: One of 'simple', 'orchestrator', 'multi-agent', 'pipeline'
        complexity_score: 1-5 scale from estimate_complexity()

    Returns:
        Recommended effort level ('low', 'medium', or 'high')
    """
    type_config = EFFORT_BY_TYPE.get(architecture_type, EFFORT_BY_TYPE["simple"])

    if complexity_score <= 2:
        return type_config["low"]
    elif complexity_score >= 4:
        return type_config["high"]
    else:
        return type_config["default"]


def recommend_model(architecture_type: str, complexity_score: int) -> str:
    """Recommend model tier based on architecture type and complexity.

    Args:
        architecture_type: One of 'simple', 'orchestrator', 'multi-agent', 'pipeline'
        complexity_score: 1-5 scale from estimate_complexity()

    Returns:
        Recommended model tier ('haiku', 'sonnet', or 'opus')
    """
    type_config = MODEL_BY_TYPE.get(architecture_type, MODEL_BY_TYPE["simple"])

    if complexity_score <= 2:
        return type_config["low"]
    elif complexity_score >= 4:
        return type_config["high"]
    else:
        return type_config["default"]


def main() -> None:
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: type_classifier.py [--json] <description>", file=sys.stderr)
        sys.exit(1)

    json_output = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--json"]

    if not args:
        print("Error: No description provided", file=sys.stderr)
        sys.exit(1)

    description = " ".join(args)
    result = classify(description)

    if json_output:
        print(json.dumps(asdict(result), indent=2))
    else:
        print(f"Architecture:  {result.architecture_type}")
        print(f"Confidence:    {result.confidence:.0%}")
        print(f"Complexity:    {result.complexity_score}/5")
        print(f"Pattern:       {result.suggested_pattern}")
        print(f"Reasoning:     {result.reasoning}")


if __name__ == "__main__":
    main()
