#!/usr/bin/env python3
"""
Agent Analyzer

Reads an existing Claude Code agent definition and produces structured
improvement recommendations across three axes:

- **missing_field** — frontmatter fields that would materially improve the
  agent (e.g. ``model``, ``maxTurns``, ``version``) but are not declared.
- **security** — findings surfaced by the existing ``security_scanner``
  translated into human-readable action items with severity.
- **context** — context-window and prompt-engineering optimizations
  (e.g. overlong description, duplicate workflow steps, missing sections,
  no explicit output format).

The module is deliberately a thin composition over the existing
validators (``syntax_validator``, ``security_scanner``,
``quality_scorer``). It adds only the **interpretation layer** that turns
raw scanner output into prioritized recommendations a user can act on,
so the underlying scanners remain the single source of truth for what
counts as a syntax error, a security finding, or a quality deficit.

Usage:
    python agent_analyzer.py path/to/agent.md
    python agent_analyzer.py path/to/agent.md --json
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from . import quality_scorer, security_scanner, syntax_validator
except ImportError:
    import quality_scorer  # type: ignore[import-not-found,no-redef]
    import security_scanner  # type: ignore[import-not-found,no-redef]
    import syntax_validator  # type: ignore[import-not-found,no-redef]


# Severity tiers — canonical order from highest to lowest so consumers
# can sort by ``IMPROVEMENT_SEVERITY_ORDER.index(severity)``.
IMPROVEMENT_SEVERITY_ORDER: tuple[str, ...] = ("critical", "high", "medium", "low")

# The three recommendation categories the feature calls out. Kept as a
# tuple constant so the public surface is discoverable and so tests can
# assert coverage without depending on a specific ordering.
IMPROVEMENT_CATEGORIES: tuple[str, ...] = ("missing_field", "security", "context")


# Frontmatter fields that are optional in Claude Code but significantly
# improve agent behavior when set. The wizard (interactive_prompts.py)
# guides users to these three; the analyzer nudges authors who skipped
# them to go back and fill them in.
_OPTIONAL_HIGH_VALUE_FIELDS: tuple[tuple[str, str, str], ...] = (
    (
        "model",
        "medium",
        (
            "Declaring ``model`` pins the agent to a specific tier "
            "(haiku/sonnet/opus) — without it, the agent inherits the "
            "parent session's model, which may under-serve complex reasoning tasks."
        ),
    ),
    (
        "maxTurns",
        "medium",
        (
            "Setting ``maxTurns`` caps runaway agent loops and makes cost "
            "predictable. Unbounded agents can burn tokens on pathological inputs."
        ),
    ),
    (
        "version",
        "low",
        (
            "Adding ``version: x.y.z`` lets the regeneration workflow detect "
            "breaking changes and produce changelogs. Without it, history "
            "tracking falls back to content hashes only."
        ),
    ),
)

# Sections whose absence almost always hurts an agent's effectiveness.
# The quality scorer already penalizes these, but the analyzer surfaces
# them as *actionable* items rather than scoring deductions.
_EXPECTED_SECTIONS: tuple[tuple[str, str], ...] = (
    ("examples", "Examples teach the agent what correct output looks like"),
    (
        "output format",
        "A dedicated Output Format section stops agents from returning free-form text",
    ),
)

# Claude Code limits ``description`` to 1024 characters. Beyond ~256
# tokens (~1024 chars) auto-delegation accuracy starts to degrade, so
# the analyzer warns well before the hard cap.
_DESCRIPTION_HARD_LIMIT = 1024
_DESCRIPTION_SOFT_LIMIT = 512


@dataclass
class AgentImprovement:
    """A single actionable improvement recommendation.

    Fields:
        category: One of ``IMPROVEMENT_CATEGORIES`` —
            ``"missing_field"``, ``"security"``, or ``"context"``.
        severity: One of ``IMPROVEMENT_SEVERITY_ORDER`` —
            ``"critical"``, ``"high"``, ``"medium"``, or ``"low"``.
        summary: One-line human-readable description of the issue.
        suggestion: Concrete action the author should take. Phrased as
            an imperative so the author knows what to do without
            re-reading the summary.
        evidence: Optional pointer to the specific line or scanner
            finding. Empty string when the recommendation applies to
            the agent as a whole rather than a specific location.
    """

    category: str
    severity: str
    summary: str
    suggestion: str
    evidence: str = ""

    def to_dict(self) -> dict[str, str]:
        """Serialize for JSON output."""
        return {
            "category": self.category,
            "severity": self.severity,
            "summary": self.summary,
            "suggestion": self.suggestion,
            "evidence": self.evidence,
        }


@dataclass
class AgentAnalysis:
    """Structured result of :func:`analyze_agent`.

    Exposes the raw validator outputs (``syntax_passed``, ``security_score``,
    ``quality_score``) alongside the list of actionable improvements so
    callers can render a brief summary or a full report without
    re-running the scanners.
    """

    path: str
    syntax_passed: bool
    security_score: float
    security_passed: bool
    quality_score: float
    quality_grade: str
    quality_passed: bool
    improvements: list[AgentImprovement] = field(default_factory=list)

    def improvements_by_category(self) -> dict[str, list[AgentImprovement]]:
        """Group improvements by category for rendering."""
        groups: dict[str, list[AgentImprovement]] = {c: [] for c in IMPROVEMENT_CATEGORIES}
        for imp in self.improvements:
            if imp.category in groups:
                groups[imp.category].append(imp)
        return groups

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON output."""
        return {
            "path": self.path,
            "syntax_passed": self.syntax_passed,
            "security_score": self.security_score,
            "security_passed": self.security_passed,
            "quality_score": self.quality_score,
            "quality_grade": self.quality_grade,
            "quality_passed": self.quality_passed,
            "improvements": [i.to_dict() for i in self.improvements],
        }


def _parse_frontmatter(content: str) -> dict[str, str]:
    """Extract frontmatter as a flat ``{field: value}`` mapping.

    Mirrors the lightweight parser used by ``agent_export`` —
    duplicated here rather than imported so ``agent_analyzer`` has no
    dependency on export-side code.
    """
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    fields: dict[str, str] = {}
    for line in parts[1].split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip().strip("\"'")
    return fields


def _find_missing_field_improvements(
    frontmatter: dict[str, str],
) -> list[AgentImprovement]:
    """Flag optional-but-high-value frontmatter fields that are absent."""
    improvements: list[AgentImprovement] = []
    for name, severity, rationale in _OPTIONAL_HIGH_VALUE_FIELDS:
        if not frontmatter.get(name):
            improvements.append(
                AgentImprovement(
                    category="missing_field",
                    severity=severity,
                    summary=f"Frontmatter field '{name}' is not set",
                    suggestion=f"Add '{name}' to the frontmatter. {rationale}",
                    evidence=f"frontmatter.{name}=<unset>",
                )
            )
    return improvements


def _find_security_improvements(
    security_result: security_scanner.ScanResult,
) -> list[AgentImprovement]:
    """Translate security scanner findings into improvement items.

    Maps the scanner's ``Severity`` levels directly to our severity
    tiers. Each scanner finding becomes one improvement so the author
    can address them individually rather than chasing an aggregate score.
    """
    improvements: list[AgentImprovement] = []
    for finding in security_result.findings:
        severity_value = getattr(finding.severity, "value", str(finding.severity)).lower()
        # Scanner may surface "info" which we don't consider actionable.
        if severity_value == "info":
            continue
        if severity_value not in IMPROVEMENT_SEVERITY_ORDER:
            severity_value = "medium"
        evidence_parts: list[str] = []
        if finding.line is not None:
            evidence_parts.append(f"line {finding.line}")
        if finding.evidence:
            evidence_parts.append(finding.evidence)
        improvements.append(
            AgentImprovement(
                category="security",
                severity=severity_value,
                summary=finding.title,
                suggestion=(finding.recommendation or "Review the finding and update the agent."),
                evidence=": ".join(evidence_parts),
            )
        )
    return improvements


def _find_context_improvements(
    content: str,
    frontmatter: dict[str, str],
    quality_result: quality_scorer.QualityReport,
) -> list[AgentImprovement]:
    """Surface description, section, and workflow-quality issues.

    These complement the security scanner's findings by focusing on the
    *prompt engineering* side of an agent — the parts that aren't
    security-sensitive but still affect how well Claude Code can
    auto-delegate to and steer the agent.
    """
    improvements: list[AgentImprovement] = []

    description = frontmatter.get("description", "")
    if description:
        desc_len = len(description)
        if desc_len > _DESCRIPTION_HARD_LIMIT:
            improvements.append(
                AgentImprovement(
                    category="context",
                    severity="high",
                    summary=(
                        f"Description is {desc_len} chars — exceeds the 1024-char "
                        "hard limit Claude Code applies for auto-delegation."
                    ),
                    suggestion=(
                        "Trim the description to the smallest set of high-signal tokens. "
                        "Remove filler adjectives and examples — the full prompt handles those."
                    ),
                    evidence=f"description length={desc_len}",
                )
            )
        elif desc_len > _DESCRIPTION_SOFT_LIMIT:
            improvements.append(
                AgentImprovement(
                    category="context",
                    severity="low",
                    summary=(
                        f"Description is {desc_len} chars — longer than the 512-char "
                        "soft target; trim to improve auto-delegation signal."
                    ),
                    suggestion=(
                        "Aim for ≤512 chars. Keep verb-first phrasing, drop redundant context."
                    ),
                    evidence=f"description length={desc_len}",
                )
            )
    else:
        improvements.append(
            AgentImprovement(
                category="context",
                severity="high",
                summary="Description is missing from frontmatter",
                suggestion=(
                    "Add a verb-first description explaining when Claude Code should delegate "
                    "to this agent. Without it, auto-delegation cannot match the agent."
                ),
                evidence="frontmatter.description=<unset>",
            )
        )

    # Expected sections — if the quality scorer already complained, echo
    # the finding in actionable form. Look at section names case-insensitively
    # so variations like 'OUTPUT FORMAT' and 'Output Format' both match.
    body_lower = content.lower()
    for section_name, rationale in _EXPECTED_SECTIONS:
        if section_name not in body_lower:
            improvements.append(
                AgentImprovement(
                    category="context",
                    severity="medium",
                    summary=f"No '{section_name.title()}' section found",
                    suggestion=f"Add a ## {section_name.title()} section. {rationale}.",
                    evidence=f"section '{section_name}' not detected in body",
                )
            )

    # Surface the quality scorer's top suggestions as context issues when
    # they aren't already covered by the sections check above. This keeps
    # the scorer's recommendations visible without re-implementing them.
    scorer_suggestion_seen: set[str] = {
        i.summary.lower() for i in improvements if i.category == "context"
    }
    for criterion in quality_result.criteria:
        # Only surface suggestions from criteria we haven't already fully
        # covered. Use top 1 per criterion to avoid noise.
        if not criterion.suggestions:
            continue
        suggestion = criterion.suggestions[0]
        if any(suggestion.lower() in seen for seen in scorer_suggestion_seen):
            continue
        improvements.append(
            AgentImprovement(
                category="context",
                severity="low",
                summary=f"Quality scorer suggestion: {criterion.name}",
                suggestion=suggestion,
                evidence=f"criterion={criterion.name} score={criterion.score:.1f}",
            )
        )
        scorer_suggestion_seen.add(suggestion.lower())

    return improvements


def _sort_improvements(improvements: list[AgentImprovement]) -> list[AgentImprovement]:
    """Sort by severity (highest first), then category, then summary."""
    severity_index = {s: i for i, s in enumerate(IMPROVEMENT_SEVERITY_ORDER)}
    category_index = {c: i for i, c in enumerate(IMPROVEMENT_CATEGORIES)}
    return sorted(
        improvements,
        key=lambda imp: (
            severity_index.get(imp.severity, len(IMPROVEMENT_SEVERITY_ORDER)),
            category_index.get(imp.category, len(IMPROVEMENT_CATEGORIES)),
            imp.summary,
        ),
    )


def analyze_agent(path: str | Path) -> AgentAnalysis:
    """Analyze an existing agent file and produce improvement recommendations.

    Runs the full validation pipeline (syntax + security + quality) and
    then interprets the results into three categories of improvements:
    ``missing_field``, ``security``, and ``context``. Always returns an
    :class:`AgentAnalysis` — raises only if the file does not exist, so
    the caller can distinguish "broken input" from "agent has issues".

    Args:
        path: Path to the ``.md`` agent definition file.

    Returns:
        Populated :class:`AgentAnalysis`.

    Raises:
        FileNotFoundError: If ``path`` does not exist.
    """
    agent_path = Path(path)
    if not agent_path.exists():
        raise FileNotFoundError(f"Agent file not found: {agent_path}")

    content = agent_path.read_text(encoding="utf-8")
    frontmatter = _parse_frontmatter(content)

    syntax_result = syntax_validator.validate_content(content)
    security_result = security_scanner.scan_content(content)
    quality_result = quality_scorer.score_quality(content, str(agent_path))

    improvements: list[AgentImprovement] = []
    improvements.extend(_find_missing_field_improvements(frontmatter))
    improvements.extend(_find_security_improvements(security_result))
    improvements.extend(_find_context_improvements(content, frontmatter, quality_result))

    return AgentAnalysis(
        path=str(agent_path),
        syntax_passed=syntax_result.passed,
        security_score=security_result.score,
        security_passed=security_result.passed,
        quality_score=quality_result.total_score,
        quality_grade=quality_result.grade,
        quality_passed=quality_result.passed,
        improvements=_sort_improvements(improvements),
    )


def format_analysis_report(analysis: AgentAnalysis) -> str:
    """Render a human-readable report for terminal output."""
    lines = [
        f"Agent Analysis: {analysis.path}",
        "=" * 60,
        "",
        f"Syntax:   {'PASS' if analysis.syntax_passed else 'FAIL'}",
        f"Security: {analysis.security_score:.1f}/10 "
        f"({'PASS' if analysis.security_passed else 'FAIL'})",
        f"Quality:  {analysis.quality_score:.1f}/10 (grade {analysis.quality_grade}) "
        f"({'PASS' if analysis.quality_passed else 'FAIL'})",
        "",
    ]

    groups = analysis.improvements_by_category()
    if not analysis.improvements:
        lines.append("No improvement recommendations — agent looks good.")
        return "\n".join(lines)

    lines.append(f"Improvement Recommendations ({len(analysis.improvements)}):")
    lines.append("-" * 60)
    for category in IMPROVEMENT_CATEGORIES:
        items = groups.get(category, [])
        if not items:
            continue
        lines.append("")
        lines.append(f"[{category.upper()}] ({len(items)})")
        for imp in items:
            lines.append(f"  • {imp.severity.upper():<8} {imp.summary}")
            lines.append(f"    → {imp.suggestion}")
            if imp.evidence:
                lines.append(f"    evidence: {imp.evidence}")

    return "\n".join(lines)


def main() -> int:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze an agent file for improvements")
    parser.add_argument("path", help="Path to agent .md file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    try:
        analysis = analyze_agent(args.path)
    except FileNotFoundError as exc:
        if args.json:
            print(json.dumps({"error": str(exc)}, indent=2))
        else:
            print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(analysis.to_dict(), indent=2))
    else:
        print(format_analysis_report(analysis))
    return 0


if __name__ == "__main__":
    sys.exit(main())
