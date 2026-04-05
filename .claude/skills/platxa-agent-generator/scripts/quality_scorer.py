#!/usr/bin/env python3
"""
Quality Scorer for Generated Agents

Evaluates agent definition files against quality criteria and produces
an objective score from 0-10.

Quality Criteria (from project spec):
- Clarity: 20% - Clear language, well-organized, easy to understand
- Completeness: 20% - All required components present and filled
- Tool Design: 20% - Appropriate tool selection, proper usage patterns
- Examples: 15% - Quality and coverage of usage examples
- Security: 15% - Security considerations, safe patterns
- Documentation: 10% - Inline documentation, comments, references

Usage:
    python quality_scorer.py agent.md
    python quality_scorer.py --json agent.md
    python quality_scorer.py --detailed agent.md
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CriterionScore:
    """Score for a single quality criterion."""

    name: str
    weight: float
    score: float  # 0-10
    weighted_score: float  # score * weight
    findings: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


@dataclass
class QualityReport:
    """Complete quality assessment report."""

    file_path: str
    total_score: float  # 0-10 weighted score
    grade: str  # A, B, C, D, F
    criteria: list[CriterionScore] = field(default_factory=list)
    passed: bool = False  # Score >= 7.0
    summary: str = ""


# Quality criteria weights (must sum to 1.0)
# Updated based on research: Examples and Documentation increased for production-grade agents
CRITERIA_WEIGHTS = {
    "clarity": 0.15,
    "completeness": 0.15,
    "tool_design": 0.15,
    "examples": 0.20,  # Increased from 0.15 - examples critical for LLM understanding
    "security": 0.15,
    "documentation": 0.20,  # Increased from 0.10 - production requires comprehensive docs
}

# Valid Claude Code tools
VALID_TOOLS = {
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
    "WebSearch",
    "WebFetch",
    "Task",
    "AskUserQuestion",
    "TodoWrite",
    "NotebookEdit",
    "LSP",
    "Skill",
}

# High-risk tools that need security consideration
HIGH_RISK_TOOLS = {"Bash", "Write", "Edit", "WebFetch"}

# Security-related keywords
SECURITY_KEYWORDS = [
    "security",
    "safe",
    "validate",
    "sanitize",
    "escape",
    "permission",
    "authorization",
    "authentication",
    "trust",
    "injection",
    "xss",
    "csrf",
    "sensitive",
    "credential",
]

# Clarity indicators - positive
CLARITY_POSITIVE = [
    r"^#{1,3}\s+\w+",  # Well-structured headings
    r"^\d+\.\s+",  # Numbered lists
    r"^[-*]\s+",  # Bullet lists
    r"\*\*[^*]+\*\*",  # Bold emphasis
    r"```\w+",  # Code blocks with language
]

# Clarity indicators - negative
CLARITY_NEGATIVE = [
    r"(?:etc\.?|and so on|stuff|things)",  # Vague language
    r"(?:maybe|probably|might|perhaps)",  # Uncertain language
    r"(?:TODO|FIXME|XXX|HACK)",  # Incomplete markers
]


def parse_agent_file(content: str) -> tuple[dict[str, str], dict[str, str], str]:
    """
    Parse agent file into frontmatter, sections, and body.

    Returns:
        (frontmatter, sections, body_content)
    """
    lines = content.split("\n")
    frontmatter: dict[str, str] = {}
    sections: dict[str, str] = {}
    body_content = ""

    if lines and lines[0].strip() == "---":
        fm_end = -1
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == "---":
                fm_end = i
                break

        if fm_end > 0:
            for line in lines[1:fm_end]:
                if ":" in line:
                    key, value = line.split(":", 1)
                    frontmatter[key.strip()] = value.strip().strip('"').strip("'")

            body_start = fm_end + 1
            body_content = "\n".join(lines[body_start:])

            # Parse sections
            current_section = ""
            current_content: list[str] = []

            for line in lines[body_start:]:
                if line.startswith("# "):
                    if current_section:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = line[2:].strip()
                    current_content = []
                elif line.startswith("## "):
                    if current_section:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = line[3:].strip()
                    current_content = []
                else:
                    current_content.append(line)

            if current_section:
                sections[current_section] = "\n".join(current_content).strip()

    return frontmatter, sections, body_content


def score_clarity(content: str, sections: dict[str, str]) -> CriterionScore:
    """
    Score clarity of the agent definition.

    Evaluates:
    - Clear, unambiguous language
    - Well-organized structure
    - Proper formatting
    - Absence of vague terms
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0  # Start at max, deduct for issues

    # Check for positive clarity indicators
    positive_count = 0
    for pattern in CLARITY_POSITIVE:
        matches = len(re.findall(pattern, content, re.MULTILINE))
        positive_count += min(matches, 5)  # Cap contribution

    if positive_count >= 15:
        findings.append(f"Good structure with {positive_count} formatting elements")
    elif positive_count >= 8:
        findings.append(f"Adequate structure ({positive_count} formatting elements)")
    else:
        score -= 2.0
        suggestions.append("Add more structure: headings, lists, code blocks")

    # Check for negative clarity indicators
    negative_count = 0
    for pattern in CLARITY_NEGATIVE:
        matches = re.findall(pattern, content, re.IGNORECASE)
        negative_count += len(matches)

    if negative_count > 0:
        score -= min(negative_count * 0.5, 2.0)
        findings.append(f"Found {negative_count} vague/uncertain terms")
        suggestions.append("Replace vague language with specific terms")

    # Check section organization
    if len(sections) >= 4:
        findings.append(f"Well-organized with {len(sections)} sections")
    elif len(sections) >= 2:
        score -= 1.0
        findings.append(f"Basic organization ({len(sections)} sections)")
    else:
        score -= 2.5
        suggestions.append("Add more sections for better organization")

    # Check for consistent formatting
    heading_styles = set()
    for line in content.split("\n"):
        if line.startswith("#"):
            heading_styles.add(len(line) - len(line.lstrip("#")))

    if len(heading_styles) <= 3:
        findings.append("Consistent heading hierarchy")
    else:
        score -= 0.5
        suggestions.append("Use consistent heading levels")

    # Check average sentence length (approximation)
    sentences = re.split(r"[.!?]+", content)
    avg_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
    if avg_length > 30:
        score -= 1.0
        suggestions.append("Consider shorter sentences for clarity")

    return CriterionScore(
        name="Clarity",
        weight=CRITERIA_WEIGHTS["clarity"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["clarity"],
        findings=findings,
        suggestions=suggestions,
    )


def score_completeness(frontmatter: dict[str, str], sections: dict[str, str]) -> CriterionScore:
    """
    Score completeness of required components.

    Evaluates:
    - All required frontmatter fields present
    - All required sections present
    - Content in each section (not empty)
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0

    # Required frontmatter
    required_fm = ["name", "description", "tools"]
    for field_name in required_fm:
        if field_name in frontmatter and frontmatter[field_name]:
            findings.append(f"✓ {field_name} field present")
        else:
            score -= 2.0
            suggestions.append(f"Add required field: {field_name}")

    # Required sections
    required_sections = ["overview", "workflow", "examples"]
    section_names_lower = {s.lower(): s for s in sections.keys()}

    for section in required_sections:
        if section in section_names_lower:
            actual = section_names_lower[section]
            if sections[actual].strip():
                findings.append(f"✓ {section.title()} section present")
            else:
                score -= 1.5
                suggestions.append(f"Add content to {section.title()} section")
        else:
            score -= 2.0
            suggestions.append(f"Add required section: {section.title()}")

    # Recommended sections
    recommended = ["output format", "notes"]
    for section in recommended:
        section_found = any(section in s.lower() for s in sections.keys())
        if section_found:
            findings.append(f"✓ {section.title()} section present")
        else:
            score -= 0.5
            suggestions.append(f"Consider adding: {section.title()}")

    return CriterionScore(
        name="Completeness",
        weight=CRITERIA_WEIGHTS["completeness"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["completeness"],
        findings=findings,
        suggestions=suggestions,
    )


def score_tool_design(frontmatter: dict[str, str], content: str) -> CriterionScore:
    """
    Score tool selection and usage patterns.

    Evaluates:
    - Appropriate tools for the task
    - Not over-permissioned
    - Tools referenced in workflow
    - MCP tools properly specified
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0

    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",")] if tools_str else []

    if not tools:
        score -= 5.0
        suggestions.append("No tools specified")
        return CriterionScore(
            name="Tool Design",
            weight=CRITERIA_WEIGHTS["tool_design"],
            score=max(0, score),
            weighted_score=max(0, score) * CRITERIA_WEIGHTS["tool_design"],
            findings=findings,
            suggestions=suggestions,
        )

    # Check for valid tools
    invalid = [t for t in tools if t and t not in VALID_TOOLS and not t.startswith("mcp__")]
    if invalid:
        score -= len(invalid) * 1.0
        suggestions.append(f"Invalid tools: {', '.join(invalid)}")

    valid_count = len(tools) - len(invalid)
    findings.append(f"{valid_count} valid tools specified")

    # Check for over-permissioning
    if len(tools) > 8:
        score -= 1.0
        suggestions.append("Consider reducing tool count (principle of least privilege)")

    # Check for high-risk tools
    high_risk_used = [t for t in tools if t in HIGH_RISK_TOOLS]
    if high_risk_used:
        findings.append(f"High-risk tools: {', '.join(high_risk_used)}")
        # Check if there's security mention in content
        has_security_mention = any(kw in content.lower() for kw in SECURITY_KEYWORDS[:5])
        if not has_security_mention:
            score -= 1.0
            suggestions.append("Document security considerations for high-risk tools")

    # Check if tools are referenced in workflow
    tools_mentioned = 0
    for tool in tools:
        if tool and tool in content:
            tools_mentioned += 1

    if tools_mentioned == 0:
        score -= 2.0
        suggestions.append("Reference tools in workflow section")
    elif tools_mentioned < len(tools) / 2:
        score -= 1.0
        suggestions.append("Reference more tools in workflow")
    else:
        findings.append(f"{tools_mentioned}/{len(tools)} tools referenced in content")

    # Check for Task tool usage with subagent patterns
    if "Task" in tools:
        if "subagent" in content.lower() or "worker" in content.lower():
            findings.append("Task tool properly documented for subagent use")
        else:
            score -= 0.5
            suggestions.append("Document Task tool subagent patterns")

    return CriterionScore(
        name="Tool Design",
        weight=CRITERIA_WEIGHTS["tool_design"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["tool_design"],
        findings=findings,
        suggestions=suggestions,
    )


def score_examples(sections: dict[str, str]) -> CriterionScore:
    """
    Score quality and coverage of examples.

    Evaluates:
    - Number of examples (minimum 3 required for production-grade agents)
    - Examples have input/output
    - Code blocks present
    - Variety of use cases (basic, advanced, edge case)
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0

    # Minimum examples required for production-grade agents
    MIN_EXAMPLES_REQUIRED = 3

    # Find examples section
    examples_content = ""
    for name, content in sections.items():
        if "example" in name.lower():
            examples_content = content
            break

    if not examples_content:
        score -= 6.0  # Increased penalty - examples are critical
        suggestions.append("Add Examples section with at least 3 examples")
        return CriterionScore(
            name="Examples",
            weight=CRITERIA_WEIGHTS["examples"],
            score=max(0, score),
            weighted_score=max(0, score) * CRITERIA_WEIGHTS["examples"],
            findings=findings,
            suggestions=suggestions,
        )

    # Count examples
    example_patterns = [
        r"###\s+Example",
        r"\*\*Example\s*\d*:?\*\*",
        r"^Example\s*\d+:",
    ]
    example_count = 0
    for pattern in example_patterns:
        example_count += len(re.findall(pattern, examples_content, re.MULTILINE | re.IGNORECASE))

    if example_count == 0:
        # Count code blocks as implicit examples
        code_blocks = examples_content.count("```")
        example_count = code_blocks // 2

    # Stricter scoring: require 3+ examples for production-grade agents
    if example_count >= MIN_EXAMPLES_REQUIRED:
        findings.append(f"Production-grade example coverage: {example_count} examples")
        # Bonus for having more than minimum
        if example_count >= 5:
            findings.append("Excellent example variety")
    elif example_count == 2:
        score -= 2.5  # Increased penalty
        findings.append(
            f"Insufficient examples: {example_count} (minimum {MIN_EXAMPLES_REQUIRED} required)"
        )
        suggestions.append(
            f"Add at least {MIN_EXAMPLES_REQUIRED - example_count} more examples (basic, advanced, edge case)"
        )
    elif example_count == 1:
        score -= 4.0  # Increased penalty
        findings.append(
            f"Critical: Only {example_count} example (minimum {MIN_EXAMPLES_REQUIRED} required)"
        )
        suggestions.append("Add examples: basic usage, advanced orchestration, edge case handling")
    else:
        score -= 6.0  # Severe penalty
        suggestions.append(
            "Add 3 required examples: basic usage, advanced orchestration, edge case handling"
        )

    # Check for code blocks
    has_code_blocks = "```" in examples_content
    if has_code_blocks:
        findings.append("Examples include code blocks")
    else:
        score -= 2.0
        suggestions.append("Add code blocks to examples")

    # Check for input/output patterns
    has_input = any(kw in examples_content.lower() for kw in ["input", "request", "user"])
    has_output = any(kw in examples_content.lower() for kw in ["output", "result", "response"])

    if has_input and has_output:
        findings.append("Examples show input/output")
    else:
        score -= 1.5
        suggestions.append("Show both input and expected output in examples")

    # Check example variety
    if len(examples_content) > 500:
        findings.append("Detailed examples provided")
    elif len(examples_content) > 200:
        pass  # Acceptable
    else:
        score -= 1.0
        suggestions.append("Expand examples with more detail")

    return CriterionScore(
        name="Examples",
        weight=CRITERIA_WEIGHTS["examples"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["examples"],
        findings=findings,
        suggestions=suggestions,
    )


def score_security(frontmatter: dict[str, str], content: str) -> CriterionScore:
    """
    Score security considerations.

    Evaluates:
    - Security mentioned for high-risk operations
    - Input validation patterns
    - Safe defaults
    - No dangerous patterns
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0

    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",")]

    # Check for high-risk tools
    high_risk = [t for t in tools if t in HIGH_RISK_TOOLS]

    if high_risk:
        # Must have security considerations
        security_mentions = sum(1 for kw in SECURITY_KEYWORDS if kw in content.lower())

        if security_mentions >= 3:
            findings.append(f"Good security awareness ({security_mentions} mentions)")
        elif security_mentions >= 1:
            findings.append(f"Basic security awareness ({security_mentions} mentions)")
            score -= 1.5
        else:
            score -= 3.0
            suggestions.append("Add security considerations for high-risk tools")

        # Check for specific patterns
        if "Bash" in high_risk:
            if any(kw in content.lower() for kw in ["validate", "sanitize", "escape"]):
                findings.append("Input validation mentioned for Bash")
            else:
                score -= 1.5
                suggestions.append("Document input validation for Bash commands")

        if "Write" in high_risk or "Edit" in high_risk:
            if any(kw in content.lower() for kw in ["path", "file", "permission"]):
                findings.append("File safety considerations present")
            else:
                score -= 1.0
                suggestions.append("Document file path safety")

    else:
        # No high-risk tools, baseline security is fine
        findings.append("No high-risk tools (lower security concern)")
        score = 9.0  # Still good, but not perfect without explicit security

    # Evaluate permissionMode appropriateness
    permission_mode = frontmatter.get("permissionMode", "")
    if permission_mode:
        valid_modes = {"default", "acceptEdits", "bypassPermissions", "dontAsk"}
        if permission_mode in valid_modes:
            findings.append(f"Explicit permissionMode set: {permission_mode}")
            # Penalize overly permissive modes with high-risk tools
            if permission_mode == "bypassPermissions" and high_risk:
                score -= 2.0
                suggestions.append(
                    "bypassPermissions with high-risk tools is dangerous "
                    "— consider 'acceptEdits' or 'default'"
                )
            elif permission_mode == "dontAsk" and high_risk:
                score -= 1.0
                suggestions.append(
                    "dontAsk silently skips denied tools — ensure tool "
                    "restrictions via disallowedTools are sufficient"
                )
            elif permission_mode == "acceptEdits" and "Bash" not in high_risk:
                # Good: acceptEdits on file-only agents is appropriate
                findings.append("Good: acceptEdits appropriate for file-editing agent")
                score = min(score + 0.5, 10.0)
        else:
            score -= 1.5
            suggestions.append(f"Invalid permissionMode: {permission_mode}")
    elif high_risk:
        # No permissionMode set but has high-risk tools — suggest setting one
        suggestions.append(
            "Consider setting permissionMode explicitly for agents with "
            f"high-risk tools ({', '.join(high_risk)})"
        )

    # Check for dangerous patterns
    dangerous_patterns = [
        r"rm\s+-rf",
        r"chmod\s+777",
        r"eval\s*\(",
        r"exec\s*\(",
        r"\$\{.*\}.*\|.*sh",
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, content):
            score -= 2.0
            suggestions.append(f"Review dangerous pattern: {pattern}")

    return CriterionScore(
        name="Security",
        weight=CRITERIA_WEIGHTS["security"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["security"],
        findings=findings,
        suggestions=suggestions,
    )


def score_documentation(content: str, sections: dict[str, str]) -> CriterionScore:
    """
    Score documentation quality.

    Evaluates:
    - Inline explanations
    - References provided
    - Error handling documented
    - Edge cases mentioned
    """
    findings: list[str] = []
    suggestions: list[str] = []
    score = 10.0

    # Check for explanatory content
    explanation_patterns = [
        r"(?:because|since|therefore|this is|note that)",
        r"(?:important|caution|warning|tip):",
    ]

    explanation_count = 0
    for pattern in explanation_patterns:
        explanation_count += len(re.findall(pattern, content, re.IGNORECASE))

    if explanation_count >= 5:
        findings.append("Good inline documentation")
    elif explanation_count >= 2:
        findings.append("Basic explanations present")
        score -= 1.0
    else:
        score -= 2.0
        suggestions.append("Add more explanatory notes")

    # Check for error handling documentation
    error_keywords = ["error", "fail", "exception", "handle", "catch"]
    error_mentions = sum(1 for kw in error_keywords if kw in content.lower())

    if error_mentions >= 3:
        findings.append("Error handling documented")
    elif error_mentions >= 1:
        findings.append("Basic error handling mentioned")
        score -= 1.0
    else:
        score -= 2.0
        suggestions.append("Document error handling")

    # Check for edge cases
    edge_keywords = ["edge case", "corner case", "special case", "if empty", "if missing"]
    edge_mentions = sum(1 for kw in edge_keywords if kw in content.lower())

    if edge_mentions >= 2:
        findings.append("Edge cases documented")
    elif edge_mentions >= 1:
        findings.append("Some edge cases mentioned")
    else:
        score -= 1.0
        suggestions.append("Consider documenting edge cases")

    # Check for references section
    has_references = any("reference" in s.lower() or "note" in s.lower() for s in sections.keys())
    if has_references:
        findings.append("References/notes section present")
    else:
        score -= 1.0
        suggestions.append("Consider adding references or notes section")

    # Check content length (proxy for documentation depth)
    if len(content) > 2000:
        findings.append("Comprehensive documentation")
    elif len(content) > 1000:
        findings.append("Adequate documentation length")
    else:
        score -= 1.0
        suggestions.append("Expand documentation")

    return CriterionScore(
        name="Documentation",
        weight=CRITERIA_WEIGHTS["documentation"],
        score=max(0, min(10, score)),
        weighted_score=max(0, min(10, score)) * CRITERIA_WEIGHTS["documentation"],
        findings=findings,
        suggestions=suggestions,
    )


def calculate_grade(score: float) -> str:
    """Convert numeric score to letter grade."""
    if score >= 9.0:
        return "A"
    elif score >= 8.0:
        return "B"
    elif score >= 7.0:
        return "C"
    elif score >= 6.0:
        return "D"
    else:
        return "F"


def score_quality(content: str, file_path: str = "") -> QualityReport:
    """
    Perform complete quality scoring on agent definition.

    Args:
        content: File content
        file_path: Optional file path for reporting

    Returns:
        QualityReport with all criterion scores
    """
    frontmatter, sections, _ = parse_agent_file(content)

    criteria: list[CriterionScore] = []

    # Score each criterion
    criteria.append(score_clarity(content, sections))
    criteria.append(score_completeness(frontmatter, sections))
    criteria.append(score_tool_design(frontmatter, content))
    criteria.append(score_examples(sections))
    criteria.append(score_security(frontmatter, content))
    criteria.append(score_documentation(content, sections))

    # Calculate total weighted score
    total_score = sum(c.weighted_score for c in criteria)
    total_score = round(total_score, 1)

    # Determine grade and pass/fail
    grade = calculate_grade(total_score)
    passed = total_score >= 7.0

    # Generate summary
    summary = f"Quality Score: {total_score}/10 (Grade: {grade})"
    if passed:
        summary += " - PASSED"
    else:
        summary += " - FAILED (minimum 7.0 required)"

    return QualityReport(
        file_path=file_path,
        total_score=total_score,
        grade=grade,
        criteria=criteria,
        passed=passed,
        summary=summary,
    )


def score_file(file_path: str | Path) -> QualityReport:
    """Score quality of an agent definition file."""
    path = Path(file_path)

    if not path.exists():
        return QualityReport(
            file_path=str(file_path),
            total_score=0.0,
            grade="F",
            passed=False,
            summary=f"File not found: {file_path}",
        )

    content = path.read_text(encoding="utf-8")
    return score_quality(content, str(file_path))


def report_to_dict(report: QualityReport) -> dict[str, Any]:
    """Convert report to dictionary for JSON output."""
    return {
        "file_path": report.file_path,
        "total_score": report.total_score,
        "grade": report.grade,
        "passed": report.passed,
        "summary": report.summary,
        "criteria": [
            {
                "name": c.name,
                "weight": c.weight,
                "score": c.score,
                "weighted_score": round(c.weighted_score, 2),
                "findings": c.findings,
                "suggestions": c.suggestions,
            }
            for c in report.criteria
        ],
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Score quality of agent definitions")
    parser.add_argument("file", help="Agent definition file to score")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--detailed", "-d", action="store_true", help="Show detailed findings")
    parser.add_argument("--min-score", type=float, default=7.0, help="Minimum required score")

    args = parser.parse_args()

    report = score_file(args.file)

    if args.json:
        print(json.dumps(report_to_dict(report), indent=2))
    else:
        # Header
        status = "✓ PASSED" if report.passed else "✗ FAILED"
        print(f"\n{status}: {report.file_path}")
        print(f"Score: {report.total_score}/10 (Grade: {report.grade})")
        print()

        # Criteria breakdown
        print("Criteria Breakdown:")
        print("-" * 60)
        for criterion in report.criteria:
            bar_filled = int(criterion.score)
            bar_empty = 10 - bar_filled
            bar = "█" * bar_filled + "░" * bar_empty
            print(f"  {criterion.name:15} [{bar}] {criterion.score:4.1f} (x{criterion.weight:.0%})")

            if args.detailed:
                for finding in criterion.findings:
                    print(f"    ✓ {finding}")
                for suggestion in criterion.suggestions:
                    print(f"    → {suggestion}")

        print("-" * 60)
        print(f"  {'TOTAL':15} {' ' * 12} {report.total_score:4.1f}/10")
        print()

        # Suggestions summary
        if not args.detailed:
            all_suggestions = []
            for c in report.criteria:
                all_suggestions.extend(c.suggestions)
            if all_suggestions:
                print("Top Suggestions:")
                for suggestion in all_suggestions[:5]:
                    print(f"  → {suggestion}")
                print()

    # Exit code
    if not report.passed or report.total_score < args.min_score:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
