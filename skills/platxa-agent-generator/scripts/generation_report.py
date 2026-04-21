"""Generation summary report after a complete agent-generation workflow.

Produces both a human-readable markdown report and a machine-readable
JSON dict that aggregate every signal a caller might want to see at the
end of a run: the agent's name and quality score, an estimated token
count for the generated prompt, the tools the agent declared, security
scan findings (if any), and where the agent landed on disk.

Public surface:

- :class:`SecurityFindingSummary` — minimal projection of one finding
- :class:`QualityScoreSummary` — per-criterion scores + overall
- :class:`GenerationReport` — the whole report dataclass
- :func:`format_report_markdown` — render to markdown
- :func:`format_report_json` — render to JSON-serializable dict
- :func:`build_generation_report` — convenience constructor
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

# Section heading constants — pinned so generators and downstream
# parsers cannot drift on the literal text of a section title.
REPORT_HEADING: str = "# Agent Generation Report"
SECTION_OVERVIEW: str = "## Overview"
SECTION_QUALITY: str = "## Quality Score"
SECTION_TOKENS: str = "## Token Estimate"
SECTION_TOOLS: str = "## Tools"
SECTION_SECURITY: str = "## Security Findings"
SECTION_INSTALL: str = "## Install Location"

# Severity ordering for security findings — used by format_report_markdown
# to render highest-severity first. A canonical ordering also makes the
# report deterministic across runs.
SECURITY_SEVERITY_ORDER: tuple[str, ...] = ("critical", "high", "medium", "low", "info")


@dataclass
class SecurityFindingSummary:
    """Compact projection of a single security finding for the report.

    Mirrors the shape used by security_scanner but keeps only the fields
    a generation report needs to surface — full SecurityFinding objects
    carry remediation prose that belongs in the scanner output, not the
    summary report.
    """

    severity: str
    category: str
    message: str
    location: str = ""


@dataclass
class QualityScoreSummary:
    """Per-criterion + overall quality scores.

    The criteria dict mirrors the weighted rubric used elsewhere
    (clarity, completeness, tool_design, examples, security,
    documentation). Storing the criteria as a plain dict lets the
    rubric evolve without breaking the report shape.
    """

    overall: float
    criteria: dict[str, float] = field(default_factory=dict)


@dataclass
class GenerationReport:
    """Final report emitted at the end of a generation workflow."""

    agent_name: str
    description: str
    tools: list[str]
    quality: QualityScoreSummary
    token_estimate: int
    install_location: str
    security_findings: list[SecurityFindingSummary] = field(default_factory=list)


def build_generation_report(
    agent_name: str,
    description: str,
    tools: list[str],
    overall_score: float,
    criteria_scores: dict[str, float] | None = None,
    token_estimate: int = 0,
    install_location: str = "",
    security_findings: list[SecurityFindingSummary] | None = None,
) -> GenerationReport:
    """Convenience constructor that wraps QualityScoreSummary creation.

    Callers passing only an overall score still get a well-formed
    report; per-criterion detail is optional. ``token_estimate`` and
    ``install_location`` default to neutral values so the report is
    valid even when those signals weren't computed.

    Raises ValueError when ``overall_score`` is outside [0, 10] — the
    rubric's stated range. Out-of-range scores indicate a caller bug
    we'd rather catch loud than render a nonsensical report.
    """
    if not 0.0 <= overall_score <= 10.0:
        raise ValueError(
            f"overall_score must be in [0, 10]; got {overall_score}. "
            "Pass the rubric-normalized score, not a raw count."
        )
    if token_estimate < 0:
        raise ValueError(f"token_estimate cannot be negative; got {token_estimate}.")
    return GenerationReport(
        agent_name=agent_name,
        description=description,
        tools=list(tools),
        quality=QualityScoreSummary(
            overall=overall_score,
            criteria=dict(criteria_scores or {}),
        ),
        token_estimate=token_estimate,
        install_location=install_location,
        security_findings=list(security_findings or []),
    )


def _sort_findings(findings: list[SecurityFindingSummary]) -> list[SecurityFindingSummary]:
    """Sort findings by SECURITY_SEVERITY_ORDER, then category, then message.

    Findings with an unknown severity (not in the canonical order) sort
    after the known severities — they still appear in the report but
    don't push real findings off the top.
    """

    def sort_key(f: SecurityFindingSummary) -> tuple[int, str, str]:
        try:
            sev_idx = SECURITY_SEVERITY_ORDER.index(f.severity.lower())
        except ValueError:
            sev_idx = len(SECURITY_SEVERITY_ORDER)
        return (sev_idx, f.category, f.message)

    return sorted(findings, key=sort_key)


def format_report_markdown(report: GenerationReport) -> str:
    """Render the report as a polished markdown document.

    Sections always appear in the same order, and section headings are
    pulled from the module-level constants so downstream parsers can
    slice on them reliably.
    """
    lines: list[str] = [REPORT_HEADING, ""]

    # Overview
    lines.append(SECTION_OVERVIEW)
    lines.append("")
    lines.append(f"- **Agent:** {report.agent_name}")
    lines.append(f"- **Description:** {report.description}")
    lines.append("")

    # Quality
    lines.append(SECTION_QUALITY)
    lines.append("")
    lines.append(f"**Overall:** {report.quality.overall:.2f} / 10")
    lines.append("")
    if report.quality.criteria:
        lines.append("| Criterion | Score |")
        lines.append("|-----------|-------|")
        for name, score in sorted(report.quality.criteria.items()):
            lines.append(f"| {name} | {score:.2f} |")
        lines.append("")

    # Tokens
    lines.append(SECTION_TOKENS)
    lines.append("")
    lines.append(f"~{report.token_estimate} tokens")
    lines.append("")

    # Tools
    lines.append(SECTION_TOOLS)
    lines.append("")
    if report.tools:
        for tool in report.tools:
            lines.append(f"- {tool}")
    else:
        lines.append("_No tools declared._")
    lines.append("")

    # Security
    lines.append(SECTION_SECURITY)
    lines.append("")
    if report.security_findings:
        for finding in _sort_findings(report.security_findings):
            location = f" ({finding.location})" if finding.location else ""
            lines.append(
                f"- **[{finding.severity.upper()}] {finding.category}**: "
                f"{finding.message}{location}"
            )
    else:
        lines.append("_No security findings._")
    lines.append("")

    # Install location
    lines.append(SECTION_INSTALL)
    lines.append("")
    if report.install_location:
        lines.append(f"`{report.install_location}`")
    else:
        lines.append("_Not installed (dry-run or pre-install report)._")
    lines.append("")

    return "\n".join(lines)


def format_report_json(report: GenerationReport) -> dict[str, Any]:
    """Render the report as a JSON-serializable dict.

    The shape mirrors the dataclass so consumers can parse without
    knowledge of the markdown structure. Findings are sorted by
    severity for the same determinism reason as the markdown formatter.
    """
    return {
        "agent_name": report.agent_name,
        "description": report.description,
        "tools": list(report.tools),
        "quality": {
            "overall": report.quality.overall,
            "criteria": dict(report.quality.criteria),
        },
        "token_estimate": report.token_estimate,
        "install_location": report.install_location,
        "security_findings": [
            {
                "severity": f.severity,
                "category": f.category,
                "message": f.message,
                "location": f.location,
            }
            for f in _sort_findings(report.security_findings)
        ],
    }


def report_to_json_string(report: GenerationReport, indent: int = 2) -> str:
    """Convenience: format_report_json + json.dumps with stable ordering."""
    return json.dumps(format_report_json(report), indent=indent, sort_keys=True)
