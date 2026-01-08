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
from dataclasses import dataclass, asdict
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
            "orchestrat", "coordinate", "delegate", "manage workers",
            "spawn", "distribute tasks", "main agent", "worker agents",
            "decompos", "break down", "subtasks", "subagents",
        ],
        "moderate": [
            "multiple workers", "team of", "supervise", "dispatch",
            "fan out", "parallelize", "concurrent workers",
        ],
    },
    ArchitectureType.MULTI_AGENT: {
        "strong": [
            "multi-agent", "multiple agents", "agent team", "collaborate",
            "peer agents", "independent agents", "agent network",
            "agents working together", "agent collaboration",
        ],
        "moderate": [
            "several agents", "different agents", "specialized agents",
            "agent roles", "role-based", "crew of",
        ],
    },
    ArchitectureType.PIPELINE: {
        "strong": [
            "pipeline", "sequential", "chain of", "stages",
            "step by step", "phase by phase", "workflow stages",
            "processing chain", "data pipeline", "ETL",
        ],
        "moderate": [
            "then", "after that", "followed by", "next step",
            "first.*then", "process.*transform.*output",
            "input.*process.*output",
        ],
    },
    ArchitectureType.SIMPLE: {
        "strong": [
            "single agent", "simple", "straightforward", "direct",
            "basic", "one agent", "standalone",
        ],
        "moderate": [
            "just", "only", "simply", "quick",
        ],
    },
}

# Complexity indicators
COMPLEXITY_INDICATORS = {
    "high": [
        "complex", "sophisticated", "advanced", "enterprise",
        "large-scale", "distributed", "scalable", "production",
        "multiple", "various", "different types", "comprehensive",
    ],
    "medium": [
        "moderate", "several", "some", "various",
        "configurable", "flexible", "extensible",
    ],
    "low": [
        "simple", "basic", "straightforward", "quick",
        "single", "one", "minimal", "lightweight",
    ],
}

# Workflow pattern mapping
ARCHITECTURE_TO_PATTERN = {
    ArchitectureType.SIMPLE: "prompt-chaining",
    ArchitectureType.ORCHESTRATOR: "orchestrator-workers",
    ArchitectureType.MULTI_AGENT: "parallelization",
    ArchitectureType.PIPELINE: "prompt-chaining",
}


def calculate_type_score(
    description: str,
    arch_type: ArchitectureType
) -> tuple[float, list[str]]:
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


def generate_reasoning(
    arch_type: ArchitectureType,
    matches: list[str],
    complexity: int
) -> str:
    """Generate human-readable reasoning for classification."""
    if not matches:
        return f"Default classification to {arch_type.value} based on absence of complex patterns."

    match_str = ", ".join(f"'{m}'" for m in matches[:3])
    if len(matches) > 3:
        match_str += f" (+{len(matches) - 3} more)"

    complexity_desc = {1: "low", 2: "medium-low", 3: "medium", 4: "high", 5: "very high"}

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
