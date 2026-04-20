#!/usr/bin/env python3
"""
Extended Thinking Integration for Complex Decisions

Production-grade integration with Claude's extended thinking capabilities for:
- Complexity analysis to determine when extended thinking is needed
- Configurable thinking intensity levels (think, think hard, think harder, ultrathink)
- Decision tracking and optimization
- Integration with agent generation workflow

Extended Thinking Triggers:
- Complex architectural decisions
- Multi-file refactoring analysis
- System design problems
- Debugging multi-system issues
- Performance optimization analysis
- Security vulnerability assessment

Usage:
    from scripts.extended_thinking import ThinkingIntegration, ThinkingIntensity

    integration = ThinkingIntegration()
    recommendation = integration.analyze_complexity(task_description, context)

    if recommendation.should_use_extended_thinking:
        prompt = integration.format_thinking_prompt(
            task_description,
            recommendation.intensity
        )
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class ThinkingIntensity(Enum):
    """
    Extended thinking intensity levels.

    Maps to Claude's thinking budget allocation:
    - STANDARD: Baseline thinking for typical problems
    - INCREASED: More computation for multi-step problems
    - HIGH: Significant computation for complex architecture
    - MAXIMUM: Full thinking budget for critical decisions
    """

    STANDARD = ("think", 1.0, "Standard problems requiring basic reasoning")
    INCREASED = ("think hard", 2.0, "Multi-step problems with moderate complexity")
    HIGH = ("think harder", 3.0, "Complex architecture and system design")
    MAXIMUM = ("ultrathink", 4.0, "Critical decisions requiring deep analysis")

    def __init__(self, trigger_phrase: str, budget_multiplier: float, description: str):
        self.trigger_phrase = trigger_phrase
        self.budget_multiplier = budget_multiplier
        self._description = description

    @property
    def description(self) -> str:
        """Get intensity description."""
        return self._description


# Mapping from ThinkingIntensity to Claude Code effort frontmatter values.
# Used by agent_generator.py to set effort based on complexity analysis.
INTENSITY_TO_EFFORT: dict[str, str] = {
    "think": "low",  # STANDARD → low effort
    "think hard": "medium",  # INCREASED → medium effort
    "think harder": "high",  # HIGH → high effort
    "ultrathink": "high",  # MAXIMUM → high effort (capped at high)
}


def intensity_to_effort(intensity: ThinkingIntensity) -> str:
    """Map a ThinkingIntensity to Claude Code effort frontmatter value.

    Args:
        intensity: ThinkingIntensity enum value

    Returns:
        Effort level string: 'low', 'medium', or 'high'
    """
    return INTENSITY_TO_EFFORT.get(intensity.trigger_phrase, "medium")


class ComplexityDimension(Enum):
    """Dimensions for complexity analysis."""

    ARCHITECTURAL = "architectural"  # System design, patterns, structure
    TEMPORAL = "temporal"  # Multi-step, sequential dependencies
    INTEGRATION = "integration"  # Cross-system, API boundaries
    SECURITY = "security"  # Vulnerability analysis, threat modeling
    PERFORMANCE = "performance"  # Optimization, resource analysis
    DEBUGGING = "debugging"  # Root cause analysis, trace following
    AMBIGUITY = "ambiguity"  # Unclear requirements, multiple interpretations


@dataclass
class ComplexityScore:
    """Detailed complexity scoring for a task."""

    dimension: ComplexityDimension
    score: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    indicators: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "dimension": self.dimension.value,
            "score": self.score,
            "confidence": self.confidence,
            "indicators": self.indicators,
        }


@dataclass
class ThinkingRecommendation:
    """Recommendation for extended thinking usage."""

    should_use_extended_thinking: bool
    intensity: ThinkingIntensity
    overall_complexity: float
    dimension_scores: list[ComplexityScore]
    rationale: str
    estimated_benefit: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "should_use_extended_thinking": self.should_use_extended_thinking,
            "intensity": self.intensity.trigger_phrase,
            "overall_complexity": self.overall_complexity,
            "dimension_scores": [s.to_dict() for s in self.dimension_scores],
            "rationale": self.rationale,
            "estimated_benefit": self.estimated_benefit,
        }


@dataclass
class ThinkingUsageRecord:
    """Record of extended thinking usage for optimization."""

    task_id: str
    task_description: str
    intensity_used: ThinkingIntensity
    complexity_score: float
    started_at: str
    completed_at: str | None = None
    outcome_quality: float | None = None  # 0.0 to 1.0
    tokens_used: int | None = None
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "task_id": self.task_id,
            "task_description": self.task_description,
            "intensity_used": self.intensity_used.trigger_phrase,
            "complexity_score": self.complexity_score,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "outcome_quality": self.outcome_quality,
            "tokens_used": self.tokens_used,
            "notes": self.notes,
        }


class ComplexityAnalyzer:
    """
    Analyzes task complexity across multiple dimensions.

    Uses pattern matching and heuristics to determine the complexity
    of a given task and recommend appropriate thinking intensity.
    """

    # Complexity indicators by dimension
    INDICATORS: dict[ComplexityDimension, dict[str, list[str]]] = {
        ComplexityDimension.ARCHITECTURAL: {
            "high": [
                r"design.*system",
                r"architect",
                r"refactor.*entire",
                r"restructure",
                r"microservice",
                r"distributed",
                r"scalab",
                r"pattern.*select",
                r"trade.?off",
                r"orchestrat",
            ],
            "medium": [
                r"component.*design",
                r"module.*structure",
                r"interface.*design",
                r"api.*design",
                r"class.*hierarch",
            ],
        },
        ComplexityDimension.TEMPORAL: {
            "high": [
                r"multi.?step",
                r"sequential.*depend",
                r"workflow",
                r"pipeline",
                r"state.*machine",
                r"async.*orchestr",
                r"transaction",
            ],
            "medium": [
                r"step.*by.*step",
                r"phase",
                r"stage",
                r"sequence",
            ],
        },
        ComplexityDimension.INTEGRATION: {
            "high": [
                r"cross.?system",
                r"integrat.*multiple",
                r"api.*boundar",
                r"service.*mesh",
                r"event.*driven",
                r"message.*queue",
                r"webhook",
            ],
            "medium": [
                r"connect.*to",
                r"integrat",
                r"external.*api",
                r"third.?party",
            ],
        },
        ComplexityDimension.SECURITY: {
            "high": [
                r"vulnerabil",
                r"threat.*model",
                r"penetr",
                r"exploit",
                r"injection",
                r"authenti.*flow",
                r"authoriz.*model",
                r"encrypt.*scheme",
                r"zero.?trust",
            ],
            "medium": [
                r"secur",
                r"permission",
                r"access.*control",
                r"sanitiz",
                r"validat.*input",
            ],
        },
        ComplexityDimension.PERFORMANCE: {
            "high": [
                r"optimi.*algorithm",
                r"complexity.*analys",
                r"bottleneck",
                r"profil",
                r"memory.*leak",
                r"concurren.*issue",
                r"race.*condition",
                r"deadlock",
            ],
            "medium": [
                r"perform",
                r"speed.*up",
                r"efficien",
                r"cache",
                r"lazy.*load",
            ],
        },
        ComplexityDimension.DEBUGGING: {
            "high": [
                r"root.*cause",
                r"intermittent",
                r"heisenbug",
                r"race.*condition",
                r"memory.*corrupt",
                r"stack.*trace.*analys",
                r"debug.*multi",
                r"reproduc.*issue",
            ],
            "medium": [
                r"debug",
                r"fix.*bug",
                r"error.*handl",
                r"exception",
                r"troubleshoot",
            ],
        },
        ComplexityDimension.AMBIGUITY: {
            "high": [
                r"unclear",
                r"ambiguous",
                r"multiple.*interpret",
                r"trade.?off",
                r"best.*approach",
                r"recommend",
                r"should.*i",
                r"which.*option",
            ],
            "medium": [
                r"consider",
                r"option",
                r"alternative",
                r"decide",
            ],
        },
    }

    # Weights for each dimension in overall complexity
    DIMENSION_WEIGHTS: dict[ComplexityDimension, float] = {
        ComplexityDimension.ARCHITECTURAL: 0.20,
        ComplexityDimension.TEMPORAL: 0.15,
        ComplexityDimension.INTEGRATION: 0.15,
        ComplexityDimension.SECURITY: 0.15,
        ComplexityDimension.PERFORMANCE: 0.10,
        ComplexityDimension.DEBUGGING: 0.15,
        ComplexityDimension.AMBIGUITY: 0.10,
    }

    def analyze(
        self,
        task_description: str,
        context: dict[str, Any] | None = None,
    ) -> list[ComplexityScore]:
        """
        Analyze task complexity across all dimensions.

        Args:
            task_description: The task to analyze
            context: Additional context (file count, scope, etc.)

        Returns:
            List of complexity scores for each dimension
        """
        context = context or {}
        scores: list[ComplexityScore] = []

        # Normalize text for matching
        text = task_description.lower()

        for dimension, patterns in self.INDICATORS.items():
            score, confidence, indicators = self._score_dimension(
                text, patterns, dimension, context
            )
            scores.append(
                ComplexityScore(
                    dimension=dimension,
                    score=score,
                    confidence=confidence,
                    indicators=indicators,
                )
            )

        return scores

    def _score_dimension(
        self,
        text: str,
        patterns: dict[str, list[str]],
        dimension: ComplexityDimension,
        context: dict[str, Any],
    ) -> tuple[float, float, list[str]]:
        """Score a single complexity dimension."""
        indicators: list[str] = []
        high_matches = 0
        medium_matches = 0

        # Check high complexity patterns
        for pattern in patterns.get("high", []):
            if re.search(pattern, text, re.IGNORECASE):
                high_matches += 1
                indicators.append(f"[HIGH] {pattern}")

        # Check medium complexity patterns
        for pattern in patterns.get("medium", []):
            if re.search(pattern, text, re.IGNORECASE):
                medium_matches += 1
                indicators.append(f"[MED] {pattern}")

        # Context-based adjustments
        context_boost = self._get_context_boost(dimension, context)

        # Calculate score (0.0 to 1.0)
        if high_matches >= 2:
            base_score = 0.9
        elif high_matches == 1:
            base_score = 0.7
        elif medium_matches >= 2:
            base_score = 0.5
        elif medium_matches == 1:
            base_score = 0.3
        else:
            base_score = 0.1

        score = min(1.0, base_score + context_boost)

        # Confidence based on number of matches
        total_matches = high_matches + medium_matches
        if total_matches >= 3:
            confidence = 0.9
        elif total_matches >= 2:
            confidence = 0.7
        elif total_matches >= 1:
            confidence = 0.5
        else:
            confidence = 0.3

        return score, confidence, indicators

    def _get_context_boost(
        self,
        dimension: ComplexityDimension,
        context: dict[str, Any],
    ) -> float:
        """Get context-based score adjustment for a dimension."""
        boost = 0.0

        # File count boost for architectural complexity
        if dimension == ComplexityDimension.ARCHITECTURAL:
            file_count = context.get("file_count", 0)
            if file_count > 10:
                boost += 0.2
            elif file_count > 5:
                boost += 0.1

        # Integration count boost
        if dimension == ComplexityDimension.INTEGRATION:
            integration_count = context.get("integration_count", 0)
            if integration_count > 3:
                boost += 0.2
            elif integration_count > 1:
                boost += 0.1

        # Security context boost
        if dimension == ComplexityDimension.SECURITY:
            if context.get("handles_auth", False):
                boost += 0.2
            if context.get("handles_pii", False):
                boost += 0.2

        return boost

    def calculate_overall_complexity(
        self,
        dimension_scores: list[ComplexityScore],
    ) -> float:
        """Calculate weighted overall complexity score."""
        total = 0.0
        total_weight = 0.0

        for score in dimension_scores:
            weight = self.DIMENSION_WEIGHTS.get(score.dimension, 0.1)
            # Weight by confidence
            effective_weight = weight * score.confidence
            total += score.score * effective_weight
            total_weight += effective_weight

        if total_weight == 0:
            return 0.0

        return total / total_weight


class ThinkingIntegration:
    """
    Main integration class for extended thinking capabilities.

    Provides complexity analysis, thinking recommendations, and
    prompt formatting for optimal extended thinking usage.
    """

    # Thresholds for thinking intensity selection
    INTENSITY_THRESHOLDS = {
        ThinkingIntensity.MAXIMUM: 0.85,
        ThinkingIntensity.HIGH: 0.65,
        ThinkingIntensity.INCREASED: 0.45,
        ThinkingIntensity.STANDARD: 0.25,
    }

    # Minimum complexity for extended thinking
    EXTENDED_THINKING_THRESHOLD = 0.35

    def __init__(self, usage_log_path: Path | str | None = None):
        """
        Initialize thinking integration.

        Args:
            usage_log_path: Path to store usage records for optimization
        """
        self.analyzer = ComplexityAnalyzer()

        if usage_log_path:
            self.usage_log_path = Path(usage_log_path)
        else:
            self.usage_log_path = Path.cwd() / ".claude" / "thinking_usage.json"

        self._usage_records: list[ThinkingUsageRecord] = []
        self._load_usage_history()

    def analyze_complexity(
        self,
        task_description: str,
        context: dict[str, Any] | None = None,
    ) -> ThinkingRecommendation:
        """
        Analyze task complexity and recommend thinking intensity.

        Args:
            task_description: Description of the task
            context: Additional context for analysis

        Returns:
            ThinkingRecommendation with intensity and rationale
        """
        # Get dimension scores
        dimension_scores = self.analyzer.analyze(task_description, context)

        # Calculate overall complexity
        overall = self.analyzer.calculate_overall_complexity(dimension_scores)

        # Determine if extended thinking should be used
        should_use = overall >= self.EXTENDED_THINKING_THRESHOLD

        # Select intensity level
        intensity = self._select_intensity(overall)

        # Generate rationale
        rationale = self._generate_rationale(dimension_scores, overall)

        # Estimate benefit
        benefit = self._estimate_benefit(dimension_scores, intensity)

        return ThinkingRecommendation(
            should_use_extended_thinking=should_use,
            intensity=intensity,
            overall_complexity=overall,
            dimension_scores=dimension_scores,
            rationale=rationale,
            estimated_benefit=benefit,
        )

    def format_thinking_prompt(
        self,
        task_description: str,
        intensity: ThinkingIntensity,
        additional_context: str = "",
    ) -> str:
        """
        Format a prompt with appropriate thinking trigger.

        Args:
            task_description: The task to perform
            intensity: Thinking intensity to use
            additional_context: Additional context to include

        Returns:
            Formatted prompt with thinking trigger
        """
        trigger = intensity.trigger_phrase

        prompt_parts = [f"{trigger}:"]

        if additional_context:
            prompt_parts.append(f"\nContext: {additional_context}")

        prompt_parts.append(f"\n\nTask: {task_description}")

        # Add intensity-specific guidance
        if intensity == ThinkingIntensity.MAXIMUM:
            prompt_parts.append(
                "\n\nThis is a critical decision. Consider all implications, "
                "trade-offs, and edge cases thoroughly."
            )
        elif intensity == ThinkingIntensity.HIGH:
            prompt_parts.append(
                "\n\nThis requires careful analysis. Consider architectural "
                "patterns and system-wide impacts."
            )
        elif intensity == ThinkingIntensity.INCREASED:
            prompt_parts.append(
                "\n\nBreak this down into clear steps and consider dependencies between components."
            )

        return "\n".join(prompt_parts)

    def start_thinking_session(
        self,
        task_id: str,
        task_description: str,
        recommendation: ThinkingRecommendation,
    ) -> ThinkingUsageRecord:
        """
        Start tracking a thinking session.

        Args:
            task_id: Unique identifier for the task
            task_description: Description of the task
            recommendation: The thinking recommendation being used

        Returns:
            ThinkingUsageRecord for the session
        """
        record = ThinkingUsageRecord(
            task_id=task_id,
            task_description=task_description,
            intensity_used=recommendation.intensity,
            complexity_score=recommendation.overall_complexity,
            started_at=datetime.now().isoformat(),
        )

        self._usage_records.append(record)
        return record

    def complete_thinking_session(
        self,
        record: ThinkingUsageRecord,
        outcome_quality: float | None = None,
        tokens_used: int | None = None,
        notes: str = "",
    ) -> None:
        """
        Complete a thinking session with results.

        Args:
            record: The usage record to complete
            outcome_quality: Quality score of the outcome (0.0 to 1.0)
            tokens_used: Number of tokens used
            notes: Additional notes about the session
        """
        record.completed_at = datetime.now().isoformat()
        record.outcome_quality = outcome_quality
        record.tokens_used = tokens_used
        record.notes = notes

        self._save_usage_history()

    def get_usage_statistics(self) -> dict[str, Any]:
        """
        Get statistics on extended thinking usage.

        Returns:
            Dictionary with usage statistics
        """
        if not self._usage_records:
            return {
                "total_sessions": 0,
                "average_complexity": 0.0,
                "average_quality": 0.0,
                "intensity_distribution": {},
            }

        total = len(self._usage_records)

        # Complexity stats
        complexities = [r.complexity_score for r in self._usage_records]
        avg_complexity = sum(complexities) / total

        # Quality stats (only for completed sessions)
        qualities = [
            r.outcome_quality for r in self._usage_records if r.outcome_quality is not None
        ]
        avg_quality = sum(qualities) / len(qualities) if qualities else 0.0

        # Intensity distribution
        intensity_counts: dict[str, int] = {}
        for record in self._usage_records:
            key = record.intensity_used.trigger_phrase
            intensity_counts[key] = intensity_counts.get(key, 0) + 1

        return {
            "total_sessions": total,
            "average_complexity": round(avg_complexity, 3),
            "average_quality": round(avg_quality, 3),
            "intensity_distribution": intensity_counts,
            "completed_sessions": len(qualities),
        }

    def _select_intensity(self, complexity: float) -> ThinkingIntensity:
        """Select thinking intensity based on complexity score."""
        for intensity, threshold in self.INTENSITY_THRESHOLDS.items():
            if complexity >= threshold:
                return intensity
        return ThinkingIntensity.STANDARD

    def _generate_rationale(
        self,
        dimension_scores: list[ComplexityScore],
        overall: float,
    ) -> str:
        """Generate human-readable rationale for recommendation."""
        # Find top contributing dimensions
        sorted_scores = sorted(
            dimension_scores,
            key=lambda s: s.score * s.confidence,
            reverse=True,
        )

        top_dimensions = [s for s in sorted_scores[:3] if s.score >= 0.4]

        if not top_dimensions:
            return (
                f"Overall complexity score: {overall:.2f}. "
                "No significant complexity indicators detected."
            )

        dimension_names = [d.dimension.value for d in top_dimensions]

        return (
            f"Overall complexity score: {overall:.2f}. "
            f"Primary complexity dimensions: {', '.join(dimension_names)}. "
            f"Highest score: {top_dimensions[0].dimension.value} "
            f"({top_dimensions[0].score:.2f})."
        )

    def _estimate_benefit(
        self,
        dimension_scores: list[ComplexityScore],
        intensity: ThinkingIntensity,
    ) -> str:
        """Estimate the benefit of using extended thinking."""
        benefits: list[str] = []

        for score in dimension_scores:
            if score.score >= 0.6:
                if score.dimension == ComplexityDimension.ARCHITECTURAL:
                    benefits.append("better architectural decisions")
                elif score.dimension == ComplexityDimension.SECURITY:
                    benefits.append("more thorough security analysis")
                elif score.dimension == ComplexityDimension.PERFORMANCE:
                    benefits.append("deeper performance optimization")
                elif score.dimension == ComplexityDimension.DEBUGGING:
                    benefits.append("more accurate root cause identification")
                elif score.dimension == ComplexityDimension.AMBIGUITY:
                    benefits.append("clearer requirement interpretation")

        if not benefits:
            return "Standard analysis should be sufficient."

        return f"Using {intensity.trigger_phrase} will likely provide: {', '.join(benefits)}."

    def _load_usage_history(self) -> None:
        """Load usage history from file.

        Per-record failures (KeyError from a malformed record missing a
        required field) are caught inside the loop so one bad record
        does not abort load of the rest. The previous behavior wrapped
        the entire loop in a single ``except`` clause: the first bad
        record aborted iteration, the in-memory list held only the
        records before it, and the next ``_save_usage_history`` rewrote
        the file from that partial list — silently deleting every
        valid record that appeared AFTER the bad one on disk.

        Whole-file errors (OSError opening the path, JSONDecodeError
        on the top-level parse) still abort load as a whole — there is
        nothing to recover from at that point.
        """
        if not self.usage_log_path.exists():
            return

        try:
            data = json.loads(self.usage_log_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(
                f"warning: extended_thinking failed to read usage log "
                f"{self.usage_log_path}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )
            return

        for index, record_data in enumerate(data.get("records", [])):
            try:
                intensity = ThinkingIntensity.STANDARD
                for i in ThinkingIntensity:
                    if i.trigger_phrase == record_data.get("intensity_used"):
                        intensity = i
                        break

                record = ThinkingUsageRecord(
                    task_id=record_data["task_id"],
                    task_description=record_data["task_description"],
                    intensity_used=intensity,
                    complexity_score=record_data["complexity_score"],
                    started_at=record_data["started_at"],
                    completed_at=record_data.get("completed_at"),
                    outcome_quality=record_data.get("outcome_quality"),
                    tokens_used=record_data.get("tokens_used"),
                    notes=record_data.get("notes", ""),
                )
                self._usage_records.append(record)
            except (KeyError, TypeError, AttributeError) as e:
                # KeyError: missing required field.
                # TypeError/AttributeError: record_data is not a dict.
                # Log the index and skip so later valid records still load.
                print(
                    f"warning: extended_thinking skipping malformed "
                    f"record #{index} in {self.usage_log_path}: "
                    f"{type(e).__name__}: {e}",
                    file=sys.stderr,
                )
                continue

    def _save_usage_history(self) -> None:
        """Save usage history to file."""
        try:
            self.usage_log_path.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "schema_version": "1.0.0",
                "last_updated": datetime.now().isoformat(),
                "records": [r.to_dict() for r in self._usage_records],
            }
            self.usage_log_path.write_text(
                json.dumps(data, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass


def analyze_for_agent_generation(
    agent_description: str,
    agent_type: str,
    tool_count: int = 0,
    has_mcp_integrations: bool = False,
) -> ThinkingRecommendation:
    """
    Convenience function to analyze complexity for agent generation tasks.

    Args:
        agent_description: Natural language description of the agent
        agent_type: Type of agent (simple, orchestrator, multi-agent)
        tool_count: Number of tools the agent will use
        has_mcp_integrations: Whether MCP integrations are involved

    Returns:
        ThinkingRecommendation for the agent generation task
    """
    context = {
        "agent_type": agent_type,
        "tool_count": tool_count,
        "has_mcp_integrations": has_mcp_integrations,
        "integration_count": 1 if has_mcp_integrations else 0,
    }

    # Boost complexity for certain agent types
    if agent_type == "orchestrator":
        context["file_count"] = 5  # Multiple worker definitions
    elif agent_type == "multi-agent":
        context["file_count"] = 10

    integration = ThinkingIntegration()
    return integration.analyze_complexity(agent_description, context)


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Extended thinking integration for complex decisions"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze task complexity")
    analyze_parser.add_argument("task", help="Task description to analyze")
    analyze_parser.add_argument(
        "--context",
        type=str,
        default="{}",
        help="JSON context string",
    )
    analyze_parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON",
    )

    # Format command
    format_parser = subparsers.add_parser("format", help="Format thinking prompt")
    format_parser.add_argument("task", help="Task description")
    format_parser.add_argument(
        "--intensity",
        choices=["think", "think hard", "think harder", "ultrathink"],
        default="think",
        help="Thinking intensity",
    )

    # Stats command
    subparsers.add_parser("stats", help="Show usage statistics")

    # Demo command
    subparsers.add_parser("demo", help="Run demonstration")

    args = parser.parse_args()
    integration = ThinkingIntegration()

    if args.command == "analyze":
        context = json.loads(args.context)
        recommendation = integration.analyze_complexity(args.task, context)

        if args.json:
            print(json.dumps(recommendation.to_dict(), indent=2))
        else:
            print(f"\n{'=' * 60}")
            print("Extended Thinking Analysis")
            print(f"{'=' * 60}\n")
            print(f"Task: {args.task[:80]}...")
            print(f"\nOverall Complexity: {recommendation.overall_complexity:.2f}")
            print(f"Recommended Intensity: {recommendation.intensity.trigger_phrase}")
            print(f"Use Extended Thinking: {recommendation.should_use_extended_thinking}")
            print(f"\nRationale: {recommendation.rationale}")
            print(f"\nEstimated Benefit: {recommendation.estimated_benefit}")

            print("\nDimension Scores:")
            for score in recommendation.dimension_scores:
                bar = "█" * int(score.score * 10) + "░" * (10 - int(score.score * 10))
                print(f"  {score.dimension.value:15} [{bar}] {score.score:.2f}")

    elif args.command == "format":
        # Map string to enum
        intensity_map = {
            "think": ThinkingIntensity.STANDARD,
            "think hard": ThinkingIntensity.INCREASED,
            "think harder": ThinkingIntensity.HIGH,
            "ultrathink": ThinkingIntensity.MAXIMUM,
        }
        intensity = intensity_map.get(args.intensity, ThinkingIntensity.STANDARD)

        prompt = integration.format_thinking_prompt(args.task, intensity)
        print(prompt)

    elif args.command == "stats":
        stats = integration.get_usage_statistics()
        print("\n" + "=" * 40)
        print("Extended Thinking Usage Statistics")
        print("=" * 40 + "\n")
        print(f"Total Sessions: {stats['total_sessions']}")
        print(f"Completed Sessions: {stats['completed_sessions']}")
        print(f"Average Complexity: {stats['average_complexity']}")
        print(f"Average Quality: {stats['average_quality']}")
        print("\nIntensity Distribution:")
        for intensity, count in stats["intensity_distribution"].items():
            print(f"  {intensity}: {count}")

    elif args.command == "demo":
        print("\n" + "=" * 60)
        print("Extended Thinking Integration Demo")
        print("=" * 60)

        test_cases = [
            ("Fix the typo in README.md", {}),
            ("Implement user authentication with OAuth2 and JWT tokens", {}),
            (
                "Design a distributed microservices architecture for the "
                "e-commerce platform with event-driven communication",
                {"file_count": 15, "integration_count": 5},
            ),
            (
                "Debug the intermittent race condition in the concurrent "
                "transaction processing system",
                {},
            ),
        ]

        for task, context in test_cases:
            recommendation = integration.analyze_complexity(task, context)

            print(f"\nTask: {task[:60]}...")
            print(f"  Complexity: {recommendation.overall_complexity:.2f}")
            print(f"  Intensity: {recommendation.intensity.trigger_phrase}")
            print(f"  Use Extended Thinking: {recommendation.should_use_extended_thinking}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
