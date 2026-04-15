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


# Canonical block names for the 4-block prompt structure
# (INSTRUCTIONS / CONTEXT / TASK / OUTPUT FORMAT). Mirrors
# ``PROMPT_BLOCK_NAMES`` in prompt_generator.py — duplicated here rather than
# imported to keep quality_scorer free of dependencies on the generator.
PROMPT_BLOCK_NAMES: tuple[str, ...] = ("INSTRUCTIONS", "CONTEXT", "TASK", "OUTPUT FORMAT")

# Matching XML tag names (lowercase, snake_case), same order.
PROMPT_BLOCK_XML_TAGS: tuple[str, ...] = ("instructions", "context", "task", "output_format")

# Nested XML sub-tags emitted INSIDE the 4-block structure when an agent
# uses ``structure_format == "xml"`` (mirrored from prompt_generator.py).
# ``<constraints>`` lives inside ``<instructions>``; ``<examples>`` lives
# inside ``<context>``. Detection is opt-in: a structured agent that omits
# constraints/examples is still complete; the nested tags are reported
# separately so callers can distinguish "uses XML" from "uses XML with
# nested sub-sections".
NESTED_XML_TAGS: tuple[str, ...] = ("constraints", "examples")


@dataclass
class PromptStructureReport:
    """Detection result for the 4-block prompt structure.

    The scorer uses this to decide whether a generated agent follows the
    INSTRUCTIONS / CONTEXT / TASK / OUTPUT FORMAT convention and, if so,
    whether the structure is complete. The report is also exposed as a
    public helper so other tools (dry-run previewer, syntax validator)
    can surface structure information without re-implementing detection.

    Fields:
        found_blocks: Canonical block names detected (uppercase, e.g.
            ``"INSTRUCTIONS"``).
        missing_blocks: Canonical block names not detected.
        format: ``"markdown"`` (detected via ``##`` headers),
            ``"xml"`` (detected via ``<instructions>...``), ``"mixed"``
            (both forms present — valid, usually because markdown rendered
            inside an XML tag), or ``"none"`` (agent uses legacy format
            without explicit 4-block structure).
        complete: ``True`` when all four canonical blocks were detected.
        nested_tags_found: Nested XML sub-tags detected inside the main
            blocks (subset of ``NESTED_XML_TAGS``: ``"constraints"``,
            ``"examples"``). Empty list when the agent uses markdown/legacy
            mode or omits both sub-sections. Reported separately from
            ``complete`` because nested sub-tags are opt-in.
    """

    found_blocks: list[str] = field(default_factory=list)
    missing_blocks: list[str] = field(default_factory=list)
    format: str = "none"
    complete: bool = False
    nested_tags_found: list[str] = field(default_factory=list)


def evaluate_prompt_structure(content: str) -> PromptStructureReport:
    """Detect the 4-block prompt structure (INSTRUCTIONS/CONTEXT/TASK/OUTPUT FORMAT).

    Accepts either markdown-style headers (``## INSTRUCTIONS``, case-insensitive)
    or XML-tagged blocks (``<instructions>...</instructions>``). Detection is
    per-block — an agent that labels three blocks correctly and skips the
    fourth is reported as incomplete rather than as ``"none"``.

    Args:
        content: Full file content (including frontmatter).

    Returns:
        A ``PromptStructureReport`` describing which blocks were found and
        in which format.
    """
    md_found: list[str] = []
    for name in PROMPT_BLOCK_NAMES:
        # Header line like "## INSTRUCTIONS" or "### OUTPUT FORMAT". Allow
        # 1–6 # signs (all markdown header levels), case-insensitive. The
        # name must stand alone — no trailing descriptive text — so the
        # regex anchors the name to end-of-line (optionally whitespace).
        header_pattern = rf"^#{{1,6}}\s*{re.escape(name)}\s*$"
        if re.search(header_pattern, content, re.IGNORECASE | re.MULTILINE):
            md_found.append(name)

    xml_found: list[str] = []
    for name, tag in zip(PROMPT_BLOCK_NAMES, PROMPT_BLOCK_XML_TAGS):
        # Opening tag with optional attributes. Matching closing tag is not
        # required for detection — a well-formed block should have one but
        # the scorer reports structure, not XML validity.
        if re.search(rf"<{re.escape(tag)}(?:\s[^>]*)?>", content, re.IGNORECASE):
            xml_found.append(name)

    found_set = set(md_found) | set(xml_found)
    # Preserve canonical order in output
    found = [name for name in PROMPT_BLOCK_NAMES if name in found_set]
    missing = [name for name in PROMPT_BLOCK_NAMES if name not in found_set]

    if md_found and xml_found:
        fmt = "mixed"
    elif md_found:
        fmt = "markdown"
    elif xml_found:
        fmt = "xml"
    else:
        fmt = "none"

    # Detect nested XML sub-tags (constraints, examples). These are opt-in
    # and only meaningful when the outer structure uses XML, but we scan
    # regardless so a "mixed" agent that uses XML sub-tags inside markdown
    # blocks still surfaces them.
    nested_found: list[str] = []
    for tag in NESTED_XML_TAGS:
        if re.search(rf"<{re.escape(tag)}(?:\s[^>]*)?>", content, re.IGNORECASE):
            nested_found.append(tag)

    return PromptStructureReport(
        found_blocks=found,
        missing_blocks=missing,
        format=fmt,
        complete=len(missing) == 0,
        nested_tags_found=nested_found,
    )


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

    # Check for redundant phrases (context efficiency)
    redundant_phrases = [
        r"\b(this agent|the agent) (is designed to|is responsible for|will)\b",
        r"\b(please note|note that|it should be noted)\b",
        r"\b(in order to|for the purpose of)\b",
        r"\b(as mentioned (above|earlier|previously))\b",
        r"\b(basically|essentially|fundamentally)\b",
    ]
    redundant_count = 0
    for pattern in redundant_phrases:
        redundant_count += len(re.findall(pattern, content, re.IGNORECASE))
    if redundant_count > 3:
        score -= 1.5
        findings.append(f"Found {redundant_count} redundant/filler phrases")
        suggestions.append(
            "Remove filler phrases ('in order to' -> 'to', 'this agent is designed to' -> direct verb)"
        )
    elif redundant_count > 0:
        score -= 0.5
        findings.append(f"Found {redundant_count} minor redundant phrase(s)")

    # Check for section content overlap (repeated instructions)
    section_values = [v.strip().lower() for v in sections.values() if v.strip()]
    for i, s1 in enumerate(section_values):
        for s2 in section_values[i + 1 :]:
            # Check for substantial overlap (>50 chars of shared text)
            words1 = set(s1.split())
            words2 = set(s2.split())
            if len(words1) > 10 and len(words2) > 10:
                overlap = words1 & words2
                overlap_ratio = len(overlap) / min(len(words1), len(words2))
                if overlap_ratio > 0.7:
                    score -= 1.0
                    suggestions.append(
                        "Sections have high content overlap — consolidate repeated instructions"
                    )
                    break

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

    # Description conciseness checks (Anthropic's "smallest set of high-signal tokens")
    description = frontmatter.get("description", "")
    if description:
        desc_len = len(description)
        desc_words = description.split()

        # Claude Code limits description to 1024 chars
        if desc_len > 1024:
            score -= 2.0
            suggestions.append(
                f"Description is {desc_len} chars — must be ≤1024. "
                "Cut filler words, keep only what Claude needs for auto-delegation."
            )
        elif desc_len > 512:
            score -= 0.5
            findings.append(f"Description is {desc_len} chars — consider trimming")

        # Action verb first — Claude auto-delegates better with verb-first descriptions
        action_verbs = {
            "analyze",
            "build",
            "check",
            "create",
            "debug",
            "deploy",
            "detect",
            "evaluate",
            "find",
            "fix",
            "generate",
            "implement",
            "inspect",
            "lint",
            "migrate",
            "monitor",
            "optimize",
            "parse",
            "refactor",
            "review",
            "run",
            "scan",
            "search",
            "test",
            "trace",
            "validate",
            "verify",
            "write",
        }
        first_word = desc_words[0].lower().rstrip("s") if desc_words else ""
        if first_word in action_verbs or first_word.rstrip("e") in action_verbs:
            findings.append("Description starts with action verb (good for delegation)")
        else:
            score -= 0.5
            suggestions.append(
                "Start description with an action verb (e.g., 'Analyzes...', 'Generates...') "
                "for better auto-delegation by Claude Code"
            )

        # Token estimate (4 chars per token heuristic)
        estimated_tokens = desc_len // 4
        if estimated_tokens > 256:
            findings.append(f"Description ~{estimated_tokens} tokens — consider reducing")

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


def score_prompt_structure(content: str) -> CriterionScore:
    """Score the 4-block prompt structure as a dedicated criterion.

    This is an **opt-in** check: agents using the legacy section-list format
    (no block headers at all) are reported as ``format="none"`` and given a
    neutral 7.0 — they are not penalized for declining to adopt the
    structured form. Once at least one block marker is detected the agent
    is held to the full standard: all four blocks must be present for a
    perfect score, and each missing block subtracts from the score.

    The criterion does **not** get its own weight in ``CRITERIA_WEIGHTS``
    (which must sum to 1.0). It is exposed as a public helper so callers
    (dry-run preview, held-out evaluators, test suites) can inspect the
    structure independently of the weighted quality total.

    Returns:
        A ``CriterionScore`` with ``weight=0.0`` (advisory) and a 0–10
        ``score`` reflecting structure completeness.
    """
    report = evaluate_prompt_structure(content)
    findings: list[str] = []
    suggestions: list[str] = []

    if report.format == "none":
        # Legacy agents: neutral score, one suggestion, no penalty.
        score = 7.0
        findings.append(
            "Agent uses legacy section-list format "
            "(4-block INSTRUCTIONS/CONTEXT/TASK/OUTPUT FORMAT structure not detected)"
        )
        suggestions.append(
            "Consider adopting the 4-block prompt structure "
            "(INSTRUCTIONS / CONTEXT / TASK / OUTPUT FORMAT) for clearer role separation"
        )
    else:
        # Opt-in: graded on completeness. Each of the 4 blocks is worth
        # 2.5 points; score scales linearly with block count.
        score = 2.5 * len(report.found_blocks)
        findings.append(
            f"4-block structure detected ({report.format} format): "
            + ", ".join(report.found_blocks)
        )
        if report.missing_blocks:
            suggestions.append("Add missing blocks: " + ", ".join(report.missing_blocks))
        if report.complete:
            findings.append("All 4 blocks present (structure complete)")

    return CriterionScore(
        name="Prompt Structure",
        weight=0.0,  # advisory — not part of the weighted total
        score=max(0.0, min(10.0, score)),
        weighted_score=0.0,
        findings=findings,
        suggestions=suggestions,
    )


@dataclass
class ToolValidationReport:
    """Cross-validation result between declared tools and workflow references.

    Used by score_tool_design to adjust the tool_design criterion score and
    by external validators (syntax_validator, dry_run) to surface errors and
    warnings with explicit severity.

    Fields:
        declared: Tool names from the frontmatter ``tools:`` field.
        referenced: Tool names mentioned in the Workflow section.
        unused: declared - referenced. Each entry is a WARNING (non-blocking).
        undeclared: referenced - declared. Each entry is an ERROR (blocking).
        matched: Intersection — tools both declared and used.
    """

    declared: list[str] = field(default_factory=list)
    referenced: list[str] = field(default_factory=list)
    unused: list[str] = field(default_factory=list)
    undeclared: list[str] = field(default_factory=list)
    matched: list[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        """True when any undeclared tool references are present."""
        return bool(self.undeclared)

    @property
    def has_warnings(self) -> bool:
        """True when any declared tools are unused in the workflow."""
        return bool(self.unused)


# Tool names in Claude Code are CamelCase single words (e.g. Read, Grep,
# MultiEdit, WebFetch). MCP tools follow the pattern ``mcp__server__tool``.
# We match with explicit boundaries:
#   - for standard tools: ``\bToolName\b``
#   - for MCP tools: the full ``mcp__server__tool`` string (underscores are
#     part of a single logical identifier so \b on both sides still works).
#
# Case-sensitive on purpose: "read the file" must NOT match the Read tool.
_TOOL_BOUNDARY_RE_CACHE: dict[str, re.Pattern[str]] = {}


def _tool_reference_pattern(tool: str) -> re.Pattern[str]:
    """Return a compiled, cached word-boundary regex for a tool name."""
    if tool not in _TOOL_BOUNDARY_RE_CACHE:
        _TOOL_BOUNDARY_RE_CACHE[tool] = re.compile(rf"\b{re.escape(tool)}\b")
    return _TOOL_BOUNDARY_RE_CACHE[tool]


def _extract_workflow_text(sections: dict[str, str]) -> str:
    """Return the combined text of any workflow-related sections.

    Matches 'Workflow', 'Workflows', and any heading ending in ' Workflow'
    (e.g. 'Implementation Workflow'). Case-insensitive on the heading.
    Returns an empty string if no workflow section is present.
    """
    parts: list[str] = []
    for name, body in sections.items():
        lowered = name.lower().strip()
        if lowered == "workflow" or lowered == "workflows" or lowered.endswith(" workflow"):
            parts.append(body)
    return "\n\n".join(parts)


def cross_validate_tools_vs_workflow(
    frontmatter: dict[str, str],
    sections: dict[str, str],
) -> ToolValidationReport:
    """Cross-validate the declared tools list against workflow references.

    Compares the tools declared in the frontmatter ``tools:`` field against
    the tools actually mentioned in the Workflow section(s) of the agent's
    body. Used to catch two common authoring mistakes:

    * Declared-but-unused tools — the frontmatter grants permission to a
      tool the workflow never references. Over-permissioning violates the
      principle of least privilege, but does not break the agent. Reported
      as WARNINGs.
    * Referenced-but-undeclared tools — the workflow tells the agent to
      call a tool that is not in the frontmatter tools list. This is a
      runtime failure waiting to happen because Claude Code will refuse
      the undeclared call. Reported as ERRORs.

    Detection rules:
    * Tool references are matched with word boundaries — "Read" matches the
      Read tool but not the word "readable".
    * MCP tool names (``mcp__server__tool``) are matched as full identifiers.
    * Only tools in the VALID_TOOLS set (or matching the ``mcp__`` prefix)
      count as "references" — this prevents the algorithm from flagging
      every capitalised word in the workflow as an undeclared tool.

    Args:
        frontmatter: Parsed frontmatter dict (as returned by parse_agent_file).
        sections: Parsed sections dict.

    Returns:
        ToolValidationReport with declared / referenced / unused / undeclared
        / matched tool lists populated. When no workflow section exists,
        ``referenced`` and ``undeclared`` are empty — you can't fail the
        cross-check on a section that isn't there.
    """
    declared_raw = [t.strip() for t in frontmatter.get("tools", "").split(",") if t.strip()]
    declared_set = set(declared_raw)

    workflow_text = _extract_workflow_text(sections)

    # Build the set of candidate tool names the workflow might reference.
    # Candidates = every standard tool (from VALID_TOOLS) + every MCP tool
    # actually declared in the frontmatter. We don't try to invent MCP tool
    # names from workflow text — MCP tool names are arbitrary, so the only
    # way a workflow can reference an undeclared MCP tool is by spelling out
    # one that was already declared, which isn't a bug.
    candidate_tools: set[str] = set(VALID_TOOLS)
    candidate_tools.update(t for t in declared_raw if t.startswith("mcp__"))

    referenced_set: set[str] = set()
    if workflow_text:
        for tool in candidate_tools:
            if _tool_reference_pattern(tool).search(workflow_text):
                referenced_set.add(tool)

    unused = sorted(declared_set - referenced_set)
    # An undeclared reference means the workflow names a tool the frontmatter
    # never authorised. Only meaningful when a workflow exists.
    undeclared = sorted(referenced_set - declared_set) if workflow_text else []
    matched = sorted(declared_set & referenced_set)

    return ToolValidationReport(
        declared=sorted(declared_set),
        referenced=sorted(referenced_set),
        unused=unused,
        undeclared=undeclared,
        matched=matched,
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

    # Cross-validate the tools list against the Workflow section.
    # Unused tools are WARNINGs (over-permissioned but non-breaking).
    # Undeclared references are ERRORs (workflow calls a tool the agent
    # lacks permission for — runtime failure waiting to happen).
    parsed_frontmatter, parsed_sections, *_ = parse_agent_file(content)
    tool_validation = cross_validate_tools_vs_workflow(parsed_frontmatter, parsed_sections)

    if tool_validation.matched:
        findings.append(f"{len(tool_validation.matched)}/{len(tools)} tools referenced in workflow")
    elif not tool_validation.referenced and not tool_validation.declared:
        # No declared tools AND no workflow references — already penalised above.
        pass
    elif not tool_validation.matched and tool_validation.declared:
        # Workflow exists but references none of the declared tools.
        score -= 2.0
        suggestions.append("Reference declared tools in the Workflow section")

    if tool_validation.undeclared:
        # ERROR per criterion: undeclared tool references are broken agents.
        # -2.0 per undeclared tool, capped at -4.0 so a workflow with many
        # errors still leaves room for other signals to contribute.
        penalty = min(len(tool_validation.undeclared) * 2.0, 4.0)
        score -= penalty
        suggestions.append(
            "ERROR: workflow references undeclared tools: "
            f"{', '.join(tool_validation.undeclared)} — add to frontmatter tools"
        )

    if tool_validation.unused:
        # WARNING per criterion: declared but unused tools are over-permissioning.
        # -0.5 per unused tool, capped at -2.0.
        penalty = min(len(tool_validation.unused) * 0.5, 2.0)
        score -= penalty
        suggestions.append(
            "WARNING: declared tools never used in workflow: "
            f"{', '.join(tool_validation.unused)} — remove or reference them"
        )

    # Check for Task tool usage with subagent patterns
    if "Task" in tools:
        if "subagent" in content.lower() or "worker" in content.lower():
            findings.append("Task tool properly documented for subagent use")
        else:
            score -= 0.5
            suggestions.append("Document Task tool subagent patterns")

    # Check for Tool Reference section with per-tool documentation
    content_lower = content.lower()
    has_tool_ref = "## tool reference" in content_lower or "## tool usage" in content_lower
    if has_tool_ref:
        findings.append("Tool Reference section present with per-tool guidance")
    elif len(tools) >= 3:
        score -= 1.0
        suggestions.append(
            "Add a Tool Reference section documenting when to use and when NOT to use each tool"
        )

    # Evaluate disallowedTools completeness
    disallowed_str = frontmatter.get("disallowedTools", "")
    disallowed = [t.strip() for t in disallowed_str.split(",") if t.strip()]

    # Read-only agents (no Write/Edit/Bash) should deny dangerous tools
    write_tools = {"Write", "Edit", "MultiEdit", "Bash"}
    has_write_tools = bool(write_tools & set(tools))
    if not has_write_tools and not disallowed:
        score -= 1.0
        suggestions.append(
            "Read-only agent should set disallowedTools to deny Write, Edit, Bash "
            "(defense-in-depth)"
        )
    elif disallowed:
        findings.append(f"disallowedTools configured: {', '.join(disallowed)}")
        # Check for overlap (allowed + disallowed)
        overlap = set(tools) & set(disallowed)
        if overlap:
            score -= 1.5
            suggestions.append(
                f"Tools in both tools and disallowedTools: {', '.join(overlap)} — "
                "remove from one list"
            )

    # Evaluate model cost-efficiency
    model = frontmatter.get("model", "")
    if model:
        content_lower = content.lower()
        # Detect agent complexity from content signals.
        # Use multi-word phrases or suffixed forms to avoid false positives
        # from tool names (e.g. "Read" tool matching "read").
        simple_signals = [
            "lint ",
            "linter",
            "linting",
            "formatter",
            "formatting",
            "validator",
            "validat",
            "scanner",
            "scanning",
            "checker",
            "checking",
            "single file",
            "simple",
            "lightweight",
        ]
        complex_signals = [
            "orchestrat",
            "architect",
            "refactor",
            "multi-agent",
            "coordinate",
            "decompos",
            "cross-cutting",
            "distributed",
        ]
        is_simple = any(kw in content_lower for kw in simple_signals)
        is_complex = any(kw in content_lower for kw in complex_signals)

        if model == "opus" and is_simple and not is_complex:
            score -= 1.5
            suggestions.append(
                "Model 'opus' is expensive for simple tasks — consider 'sonnet' or 'haiku'"
            )
        elif model == "haiku" and is_complex and not is_simple:
            score -= 1.0
            suggestions.append(
                "Model 'haiku' may underperform for complex tasks — consider 'sonnet'"
            )
        elif model == "haiku" and is_simple:
            findings.append("Good: haiku model appropriate for simple/cheap tasks")
            score = min(score + 0.5, 10.0)
        elif model == "opus" and is_complex:
            findings.append("Good: opus model appropriate for complex orchestration")
        elif model == "sonnet":
            findings.append("Model 'sonnet' — balanced cost/capability")

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

    # Check example diversity — require happy path, error, and edge case coverage
    content_lower = examples_content.lower()
    diversity_labels = {
        "happy_path": any(
            kw in content_lower for kw in ["basic usage", "happy path", "basic example"]
        ),
        "error_scenario": any(
            kw in content_lower
            for kw in ["error scenario", "error handling", "failure", '"status": "error"']
        ),
        "edge_case": any(
            kw in content_lower
            for kw in ["edge case", "empty directory", "no matching", "boundary"]
        ),
    }
    diversity_count = sum(diversity_labels.values())
    if diversity_count >= 3:
        findings.append("Full example diversity: happy path, error, edge case")
    elif diversity_count == 2:
        missing = [k for k, v in diversity_labels.items() if not v]
        findings.append(f"Partial example diversity (missing: {', '.join(missing)})")
        score -= 1.0
        suggestions.append(f"Add example covering: {', '.join(missing).replace('_', ' ')}")
    elif diversity_count == 1:
        missing = [k for k, v in diversity_labels.items() if not v]
        score -= 2.0
        suggestions.append(f"Add diverse examples covering: {', '.join(missing).replace('_', ' ')}")
    else:
        score -= 2.5
        suggestions.append(
            "Add labeled examples: basic usage (happy path), error scenario, edge case"
        )

    # Check example depth
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

    # Check for verification section
    has_verification = any("verification" in s.lower() for s in sections.keys())
    if has_verification:
        findings.append("Verification section present")
        # Check for concrete verification criteria
        verification_keywords = ["success criteria", "verification command", "expected output"]
        verification_mentions = sum(1 for kw in verification_keywords if kw in content.lower())
        if verification_mentions >= 2:
            findings.append("Concrete verification criteria documented")
        elif verification_mentions >= 1:
            findings.append("Some verification criteria present")
            score -= 0.5
            suggestions.append(
                "Add more concrete verification criteria (success criteria, commands, expected output)"
            )
        else:
            score -= 1.0
            suggestions.append("Add concrete verification criteria with testable checks")
    else:
        score -= 1.5
        suggestions.append(
            "Add ## Verification section with success criteria, verification commands, and expected output"
        )

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
