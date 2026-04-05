#!/usr/bin/env python3
"""
Completeness Checker for Agent Definitions

Validates that agent definition files contain all required sections and
content for a production-ready agent. Goes beyond syntax validation to
check content quality and completeness.

Required Components:
- Frontmatter: name, description, tools
- Sections: Overview, Workflow, Examples, Error Handling, Verification, Output Format
- Content quality: descriptions, step details, example coverage

Usage:
    python completeness_checker.py agent.md
    python completeness_checker.py --json agent.md
    python completeness_checker.py --strict agent.md
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CheckResult:
    """Result of a single completeness check."""

    check_id: str
    category: str
    passed: bool
    message: str
    severity: str = "error"  # error, warning, info
    details: str = ""


@dataclass
class CompletenessReport:
    """Full completeness report for an agent definition."""

    file_path: str
    complete: bool
    score: float  # 0-10 completeness score
    checks: list[CheckResult] = field(default_factory=list)
    frontmatter: dict[str, str] = field(default_factory=dict)
    sections: dict[str, str] = field(default_factory=dict)
    summary: str = ""


# Required frontmatter fields
REQUIRED_FRONTMATTER = {
    "name": "Agent identifier (hyphen-case)",
    "description": "What the agent does (≤1024 chars)",
    "tools": "Comma-separated list of allowed tools",
}

# Optional frontmatter fields
OPTIONAL_FRONTMATTER = {
    "version": "Agent version number",
    "author": "Agent author",
}

# Required markdown sections
REQUIRED_SECTIONS = {
    "Overview": "Brief description of the agent's purpose",
    "Workflow": "Step-by-step execution process",
    "Examples": "Usage examples with input/output",
    "Error Handling": "How the agent handles failures and recovers from errors",
    "Verification": "How to verify the agent's output is correct",
    "Output Format": "Expected output structure and format",
}

# Recommended sections
RECOMMENDED_SECTIONS = {
    "Notes": "Additional usage notes or tips",
    "Prerequisites": "Required setup, permissions, or environment",
    "Related Agents": "Other agents that work well with this one",
}

# Minimum content lengths for quality
MIN_CONTENT_LENGTHS = {
    "description": 20,
    "overview": 50,
    "workflow_step": 10,
    "example": 30,
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


def parse_agent_file(content: str) -> tuple[dict[str, str], dict[str, str], list[str]]:
    """
    Parse agent file into frontmatter, sections, and raw lines.

    Returns:
        (frontmatter_dict, sections_dict, lines)
    """
    lines = content.split("\n")
    frontmatter: dict[str, str] = {}
    sections: dict[str, str] = {}

    # Parse frontmatter
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
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    frontmatter[key] = value

            # Parse sections from body
            body_start = fm_end + 1
            current_section = ""
            current_content: list[str] = []

            for line in lines[body_start:]:
                # H1 or H2 heading
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

            # Save last section
            if current_section:
                sections[current_section] = "\n".join(current_content).strip()

    return frontmatter, sections, lines


def check_frontmatter_completeness(frontmatter: dict[str, str]) -> list[CheckResult]:
    """Check frontmatter for required and optional fields."""
    results: list[CheckResult] = []

    # Check required fields
    for field_name, description in REQUIRED_FRONTMATTER.items():
        check_id = f"FM_{field_name.upper()}"
        if field_name not in frontmatter:
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="frontmatter",
                    passed=False,
                    message=f"Missing required field: {field_name}",
                    severity="error",
                    details=description,
                )
            )
        elif not frontmatter[field_name].strip():
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="frontmatter",
                    passed=False,
                    message=f"Empty required field: {field_name}",
                    severity="error",
                    details=description,
                )
            )
        else:
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="frontmatter",
                    passed=True,
                    message=f"Field present: {field_name}",
                    severity="info",
                )
            )

    # Check name format
    if "name" in frontmatter and frontmatter["name"]:
        name = frontmatter["name"]
        if not re.match(r"^[a-z][a-z0-9-]*$", name):
            results.append(
                CheckResult(
                    check_id="FM_NAME_FORMAT",
                    category="frontmatter",
                    passed=False,
                    message=f"Invalid name format: {name}",
                    severity="error",
                    details="Name must be hyphen-case (lowercase letters, numbers, hyphens)",
                )
            )
        elif len(name) > 64:
            results.append(
                CheckResult(
                    check_id="FM_NAME_LENGTH",
                    category="frontmatter",
                    passed=False,
                    message=f"Name too long: {len(name)} chars (max 64)",
                    severity="error",
                )
            )

    # Check description quality
    if "description" in frontmatter and frontmatter["description"]:
        desc = frontmatter["description"]
        if len(desc) < MIN_CONTENT_LENGTHS["description"]:
            results.append(
                CheckResult(
                    check_id="FM_DESC_QUALITY",
                    category="frontmatter",
                    passed=False,
                    message=f"Description too short: {len(desc)} chars (min {MIN_CONTENT_LENGTHS['description']})",
                    severity="warning",
                    details="Provide a meaningful description of what the agent does",
                )
            )
        elif len(desc) > 1024:
            results.append(
                CheckResult(
                    check_id="FM_DESC_LENGTH",
                    category="frontmatter",
                    passed=False,
                    message=f"Description too long: {len(desc)} chars (max 1024)",
                    severity="error",
                )
            )

    # Check tools validity
    if "tools" in frontmatter and frontmatter["tools"]:
        tools = [t.strip() for t in frontmatter["tools"].split(",")]
        invalid_tools = []
        for tool in tools:
            if tool and tool not in VALID_TOOLS and not tool.startswith("mcp__"):
                invalid_tools.append(tool)

        if invalid_tools:
            results.append(
                CheckResult(
                    check_id="FM_TOOLS_VALID",
                    category="frontmatter",
                    passed=False,
                    message=f"Invalid tools: {', '.join(invalid_tools)}",
                    severity="error",
                    details=f"Valid tools: {', '.join(sorted(VALID_TOOLS))}",
                )
            )

        if not tools or all(not t for t in tools):
            results.append(
                CheckResult(
                    check_id="FM_TOOLS_EMPTY",
                    category="frontmatter",
                    passed=False,
                    message="No tools specified",
                    severity="error",
                    details="At least one tool must be specified",
                )
            )

    # Check optional fields (info only)
    for field_name, description in OPTIONAL_FRONTMATTER.items():
        if field_name in frontmatter:
            results.append(
                CheckResult(
                    check_id=f"FM_{field_name.upper()}",
                    category="frontmatter",
                    passed=True,
                    message=f"Optional field present: {field_name}",
                    severity="info",
                )
            )

    return results


def check_section_completeness(sections: dict[str, str]) -> list[CheckResult]:
    """Check for required and recommended sections."""
    results: list[CheckResult] = []

    # Normalize section names for matching
    section_names_lower = {s.lower(): s for s in sections.keys()}

    # Check required sections
    for section_name, description in REQUIRED_SECTIONS.items():
        check_id = f"SEC_{section_name.upper().replace(' ', '_')}"
        section_lower = section_name.lower()

        if section_lower in section_names_lower:
            actual_name = section_names_lower[section_lower]
            content = sections[actual_name]

            if not content.strip():
                results.append(
                    CheckResult(
                        check_id=check_id,
                        category="sections",
                        passed=False,
                        message=f"Empty section: {section_name}",
                        severity="error",
                        details=description,
                    )
                )
            else:
                results.append(
                    CheckResult(
                        check_id=check_id,
                        category="sections",
                        passed=True,
                        message=f"Section present: {section_name}",
                        severity="info",
                    )
                )
        else:
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="sections",
                    passed=False,
                    message=f"Missing required section: {section_name}",
                    severity="error",
                    details=description,
                )
            )

    # Check recommended sections
    for section_name, description in RECOMMENDED_SECTIONS.items():
        check_id = f"SEC_{section_name.upper().replace(' ', '_')}"
        section_lower = section_name.lower()

        if section_lower in section_names_lower:
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="sections",
                    passed=True,
                    message=f"Recommended section present: {section_name}",
                    severity="info",
                )
            )
        else:
            results.append(
                CheckResult(
                    check_id=check_id,
                    category="sections",
                    passed=False,
                    message=f"Missing recommended section: {section_name}",
                    severity="warning",
                    details=description,
                )
            )

    return results


def check_workflow_quality(sections: dict[str, str]) -> list[CheckResult]:
    """Check workflow section for quality and completeness."""
    results: list[CheckResult] = []

    # Find workflow section
    workflow_content = ""
    for name, content in sections.items():
        if name.lower() == "workflow":
            workflow_content = content
            break

    if not workflow_content:
        return results  # Already reported as missing section

    # Check for numbered steps or subsections
    has_steps = bool(re.search(r"^\d+\.", workflow_content, re.MULTILINE))
    has_subsections = bool(re.search(r"^###\s+", workflow_content, re.MULTILINE))

    if not has_steps and not has_subsections:
        results.append(
            CheckResult(
                check_id="WF_STEPS",
                category="workflow",
                passed=False,
                message="Workflow lacks numbered steps or subsections",
                severity="warning",
                details="Use numbered steps (1., 2., 3.) or ### subsections for clarity",
            )
        )
    else:
        # Count steps
        step_count = len(re.findall(r"^\d+\.", workflow_content, re.MULTILINE))
        step_count += len(re.findall(r"^###\s+", workflow_content, re.MULTILINE))

        if step_count < 2:
            results.append(
                CheckResult(
                    check_id="WF_STEPS_COUNT",
                    category="workflow",
                    passed=False,
                    message=f"Too few workflow steps: {step_count}",
                    severity="warning",
                    details="Workflow should have at least 2 steps",
                )
            )
        else:
            results.append(
                CheckResult(
                    check_id="WF_STEPS",
                    category="workflow",
                    passed=True,
                    message=f"Workflow has {step_count} steps",
                    severity="info",
                )
            )

    # Check for tool references in workflow
    tool_mentions = re.findall(
        r"\b(Read|Write|Edit|Grep|Glob|Bash|Task|WebSearch|WebFetch)\b", workflow_content
    )
    if tool_mentions:
        results.append(
            CheckResult(
                check_id="WF_TOOLS",
                category="workflow",
                passed=True,
                message=f"Workflow references tools: {', '.join(set(tool_mentions))}",
                severity="info",
            )
        )

    return results


def check_examples_quality(sections: dict[str, str]) -> list[CheckResult]:
    """Check examples section for quality and completeness."""
    results: list[CheckResult] = []

    # Find examples section
    examples_content = ""
    for name, content in sections.items():
        if name.lower() == "examples":
            examples_content = content
            break

    if not examples_content:
        return results

    # Check for example subsections
    example_count = len(
        re.findall(r"^###\s+Example", examples_content, re.MULTILINE | re.IGNORECASE)
    )
    example_count += len(re.findall(r"^###\s+\d+\.", examples_content, re.MULTILINE))

    # Also count example patterns like "**Example 1:**"
    example_count += len(re.findall(r"\*\*Example\s*\d*:?\*\*", examples_content, re.IGNORECASE))

    if example_count == 0:
        # Check for any code blocks as implicit examples
        code_blocks = len(re.findall(r"```", examples_content))
        if code_blocks >= 2:  # At least one complete code block
            example_count = code_blocks // 2

    if example_count == 0:
        results.append(
            CheckResult(
                check_id="EX_COUNT",
                category="examples",
                passed=False,
                message="No examples found",
                severity="error",
                details="Add at least one usage example with input and expected output",
            )
        )
    elif example_count < 2:
        results.append(
            CheckResult(
                check_id="EX_COUNT",
                category="examples",
                passed=False,
                message=f"Only {example_count} example(s) found",
                severity="warning",
                details="Recommend at least 2 examples for clarity",
            )
        )
    else:
        results.append(
            CheckResult(
                check_id="EX_COUNT",
                category="examples",
                passed=True,
                message=f"Found {example_count} examples",
                severity="info",
            )
        )

    # Check for code blocks in examples
    has_code_blocks = "```" in examples_content
    if not has_code_blocks:
        results.append(
            CheckResult(
                check_id="EX_CODE",
                category="examples",
                passed=False,
                message="Examples lack code blocks",
                severity="warning",
                details="Use ``` code blocks to show example input/output",
            )
        )

    return results


def check_output_format(sections: dict[str, str]) -> list[CheckResult]:
    """Check output format section."""
    results: list[CheckResult] = []

    # Find output format section
    output_content = ""
    for name, content in sections.items():
        if "output" in name.lower() and "format" in name.lower():
            output_content = content
            break

    if not output_content:
        return results

    # Check for structured output definition
    has_json = "```json" in output_content or "{" in output_content
    has_structure = has_json or "```" in output_content

    if not has_structure:
        results.append(
            CheckResult(
                check_id="OUT_STRUCTURE",
                category="output",
                passed=False,
                message="Output format lacks structure definition",
                severity="warning",
                details="Show expected output structure using JSON or code blocks",
            )
        )
    else:
        results.append(
            CheckResult(
                check_id="OUT_STRUCTURE",
                category="output",
                passed=True,
                message="Output format has structure definition",
                severity="info",
            )
        )

    return results


def calculate_score(results: list[CheckResult]) -> float:
    """Calculate completeness score from check results."""
    if not results:
        return 0.0

    # Weight by severity
    weights = {"error": 3.0, "warning": 1.5, "info": 0.5}

    total_weight = 0.0
    earned_weight = 0.0

    for result in results:
        weight = weights.get(result.severity, 1.0)
        total_weight += weight
        if result.passed:
            earned_weight += weight

    if total_weight == 0:
        return 10.0

    return round((earned_weight / total_weight) * 10, 1)


def check_completeness(content: str, file_path: str = "") -> CompletenessReport:
    """
    Perform full completeness check on agent definition.

    Args:
        content: File content
        file_path: Optional file path for reporting

    Returns:
        CompletenessReport with all check results
    """
    frontmatter, sections, _ = parse_agent_file(content)

    all_results: list[CheckResult] = []

    # Run all checks
    all_results.extend(check_frontmatter_completeness(frontmatter))
    all_results.extend(check_section_completeness(sections))
    all_results.extend(check_workflow_quality(sections))
    all_results.extend(check_examples_quality(sections))
    all_results.extend(check_output_format(sections))

    # Calculate score and completeness
    score = calculate_score(all_results)
    errors = [r for r in all_results if not r.passed and r.severity == "error"]
    complete = len(errors) == 0

    # Generate summary
    passed_count = sum(1 for r in all_results if r.passed)
    total_count = len(all_results)
    error_count = len(errors)
    warning_count = sum(1 for r in all_results if not r.passed and r.severity == "warning")

    summary = f"{passed_count}/{total_count} checks passed, {error_count} errors, {warning_count} warnings"

    return CompletenessReport(
        file_path=file_path,
        complete=complete,
        score=score,
        checks=all_results,
        frontmatter=frontmatter,
        sections=sections,
        summary=summary,
    )


def check_file(file_path: str | Path) -> CompletenessReport:
    """Check completeness of an agent definition file."""
    path = Path(file_path)

    if not path.exists():
        return CompletenessReport(
            file_path=str(file_path),
            complete=False,
            score=0.0,
            checks=[
                CheckResult(
                    check_id="FILE_EXISTS",
                    category="file",
                    passed=False,
                    message=f"File not found: {file_path}",
                    severity="error",
                )
            ],
            summary="File not found",
        )

    content = path.read_text(encoding="utf-8")
    return check_completeness(content, str(file_path))


def report_to_dict(report: CompletenessReport) -> dict[str, Any]:
    """Convert report to dictionary for JSON output."""
    return {
        "file_path": report.file_path,
        "complete": report.complete,
        "score": report.score,
        "summary": report.summary,
        "checks": [
            {
                "check_id": c.check_id,
                "category": c.category,
                "passed": c.passed,
                "message": c.message,
                "severity": c.severity,
                "details": c.details,
            }
            for c in report.checks
        ],
        "frontmatter": report.frontmatter,
        "sections": list(report.sections.keys()),
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Check completeness of agent definitions")
    parser.add_argument("file", help="Agent definition file to check")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--strict", action="store_true", help="Require score >= 7.0 for success")
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show all checks including passed"
    )
    parser.add_argument(
        "--min-score", type=float, default=7.0, help="Minimum required score (default: 7.0)"
    )

    args = parser.parse_args()

    report = check_file(args.file)

    if args.json:
        print(json.dumps(report_to_dict(report), indent=2))
    else:
        # Header
        status = "✓ COMPLETE" if report.complete else "✗ INCOMPLETE"
        print(f"\n{status}: {report.file_path}")
        print(f"Score: {report.score}/10")
        print(f"Summary: {report.summary}")
        print()

        # Group checks by category
        categories: dict[str, list[CheckResult]] = {}
        for check in report.checks:
            if check.category not in categories:
                categories[check.category] = []
            categories[check.category].append(check)

        # Display checks
        for category, checks in categories.items():
            print(f"## {category.title()}")
            for check in checks:
                if args.verbose or not check.passed:
                    icon = "✓" if check.passed else ("✗" if check.severity == "error" else "⚠")
                    print(f"  {icon} [{check.check_id}] {check.message}")
                    if check.details and not check.passed:
                        print(f"    → {check.details}")
            print()

    # Exit code
    if not report.complete:
        sys.exit(1)
    if args.strict and report.score < args.min_score:
        print(f"Score {report.score} below minimum {args.min_score}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
