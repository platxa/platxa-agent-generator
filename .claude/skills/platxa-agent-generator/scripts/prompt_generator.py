#!/usr/bin/env python3
"""
System Prompt Generator for Platxa Agent Generator

Generates clear, specific, and effective system prompts based on agent type and purpose.

Usage:
    python prompt_generator.py --type analyzer --domain security --purpose "scan code for vulnerabilities"
    python prompt_generator.py --json '{"type": "builder", "domain": "documentation", "purpose": "generate docs"}'
"""

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PromptConfig:
    """Configuration for prompt generation."""

    agent_type: str  # analyzer, builder, automation, guide, validator, orchestrator
    domain: str  # security, documentation, testing, etc.
    purpose: str  # specific purpose description
    tools: list[str]  # available tools
    constraints: list[str]  # specific constraints
    output_format: str  # expected output format
    # Prompt rendering mode: "legacy" (section-list, backwards compat),
    # "markdown" (4-block ## headers), or "xml" (4-block XML tags). The
    # 4-block modes follow standard prompt engineering practice: every
    # prompt opens with explicit INSTRUCTIONS, CONTEXT, TASK, and OUTPUT
    # FORMAT so the model can locate each concern unambiguously.
    structure_format: str = "legacy"
    # Whether this agent is expected to run long-horizon tasks (multi-phase
    # workflows, large file scans, deep code explorations) where the
    # tool-result history can pressure the context window. When True, the
    # CONTEXT block gains a Context Management subsection telling the agent
    # how to spot pressure and what to do about it (subagent delegation,
    # /clear, in-conversation summarization). Agents with low maxTurns or
    # narrow scope should leave this False to keep the prompt lean.
    long_running: bool = False


# Canonical ordering for the 4-block prompt structure. These are exported so
# quality_scorer and external validators can detect and grade them.
PROMPT_BLOCK_NAMES: tuple[str, ...] = ("INSTRUCTIONS", "CONTEXT", "TASK", "OUTPUT FORMAT")
# XML tag names (lowercase, snake_case) matching each block, in the same order.
PROMPT_BLOCK_XML_TAGS: tuple[str, ...] = ("instructions", "context", "task", "output_format")
# Valid values for PromptConfig.structure_format.
STRUCTURE_FORMATS: tuple[str, ...] = ("legacy", "markdown", "xml")

# Heading rendered above the context-management bullets when
# ``PromptConfig.long_running`` is True. Public so tests and quality
# scorers can locate the block by exact string.
CONTEXT_MANAGEMENT_HEADING: str = "**Context Management:**"

# Canonical context-management guidance injected into long-running agent
# prompts. Ordered by importance — host-side reminder injection truncates
# from the tail, so the most load-bearing rule (early detection) sits
# first. Each rule is a complete imperative, parseable as one bullet.
CONTEXT_MANAGEMENT_RULES: tuple[str, ...] = (
    "Monitor your tool-result history; once it exceeds ~50% of the "
    "context window, plan a compaction step before the next major "
    "tool call.",
    "Delegate heavy exploration (multi-file searches, deep code reads) "
    "to a subagent via the Task tool — the subagent runs in a fresh "
    "context and returns a single summary, keeping your context lean.",
    "Between unrelated sub-tasks, recommend the user run `/clear` to "
    "reset the conversation — partial state from a finished task is "
    "noise for the next one.",
    "When you must keep working in a long thread, summarize the "
    "exploration findings into a short note and continue from the "
    "summary rather than re-reading raw tool outputs.",
)


@dataclass
class PromptBlocks:
    """The 4-block prompt body, pre-rendered as strings ready for either
    markdown or XML serialization.

    Each field contains the inner content for that block — the block
    header/tag is emitted by the formatter, never by the block content
    itself, so the same PromptBlocks instance can be rendered in both
    markdown and XML form without double-wrapping.
    """

    instructions: str  # role statement + constraints
    context: str  # capabilities + tool guidance + domain
    task: str  # workflow steps
    output_format: str  # expected output description


@dataclass
class ReminderPoint:
    """A documented place in the agent's workflow where a system-reminder
    should refresh critical rules mid-conversation.

    Long-running agents accumulate tool-result context that can push earlier
    rules out of the model's effective attention. Documenting explicit
    refresh points lets both the host harness (Claude Code) and downstream
    tooling know *where* and *what* to re-inject — it also tells the agent
    itself to expect the refresh and treat the rules as load-bearing.

    Fields:
        trigger: Machine-parseable name identifying when this point fires
            (e.g. "exploration_complete", "before_destructive",
            "phase_boundary", "security_decision").
        rules: The exact rules to be re-stated at this point. Ordered by
            importance — host injection may truncate to the first N rules
            if context is tight.
        rationale: Human-readable explanation of why this point exists.
            Shown in the prompt so the agent knows why it's being reminded.
        after_step: Optional 1-based workflow step index. When set, the
            point is documented as firing immediately after that step.
            None for "whenever-the-trigger-matches" points.
    """

    trigger: str
    rules: list[str] = field(default_factory=list)
    rationale: str = ""
    after_step: int | None = None


@dataclass
class GeneratedPrompt:
    """Generated system prompt components."""

    role_statement: str
    capabilities: list[str]
    workflow_steps: list[str]
    constraints: list[str]
    output_guidance: str
    full_prompt: str
    reminder_points: list[ReminderPoint] = field(default_factory=list)


# Agent type role statements
TYPE_ROLES = {
    "analyzer": "You are an expert {domain} analyzer specializing in {purpose}.",
    "builder": "You are a skilled {domain} builder that {purpose}.",
    "automation": "You are an automation specialist that {purpose} for {domain} workflows.",
    "guide": "You are a knowledgeable {domain} guide that helps users {purpose}.",
    "validator": "You are a rigorous {domain} validator that ensures {purpose}.",
    "orchestrator": "You are an intelligent orchestrator that coordinates {domain} tasks to {purpose}.",
}

# Agent type capabilities templates
TYPE_CAPABILITIES = {
    "analyzer": [
        "Systematically examine {domain} artifacts",
        "Identify issues, patterns, and anomalies",
        "Classify findings by severity and impact",
        "Provide actionable recommendations",
        "Generate comprehensive analysis reports",
    ],
    "builder": [
        "Create high-quality {domain} artifacts",
        "Follow established patterns and best practices",
        "Generate consistent, well-structured output",
        "Validate generated content before delivery",
        "Handle edge cases and error conditions",
    ],
    "automation": [
        "Execute {domain} tasks efficiently",
        "Handle batch operations reliably",
        "Monitor progress and report status",
        "Recover gracefully from errors",
        "Optimize for performance and resource usage",
    ],
    "guide": [
        "Explain {domain} concepts clearly",
        "Provide step-by-step instructions",
        "Offer examples and demonstrations",
        "Answer questions accurately",
        "Adapt explanations to user expertise level",
    ],
    "validator": [
        "Apply {domain} validation rules consistently",
        "Detect violations and non-compliance",
        "Provide clear pass/fail determinations",
        "Explain validation failures with context",
        "Suggest remediation steps",
    ],
    "orchestrator": [
        "Analyze tasks to determine scope and complexity",
        "Decompose work into appropriate subtasks",
        "Coordinate multiple workers efficiently",
        "Synthesize results from parallel operations",
        "Handle failures and partial results gracefully",
    ],
}

# Workflow templates by type
TYPE_WORKFLOWS = {
    "analyzer": [
        "Identify the target {domain} artifacts to analyze",
        "Apply {domain} analysis rules and heuristics",
        "Classify findings by severity (critical, high, medium, low)",
        "Generate detailed findings with locations and descriptions",
        "Compile summary with actionable recommendations",
    ],
    "builder": [
        "Understand requirements and constraints",
        "Design the structure and components",
        "Generate content following {domain} best practices",
        "Validate output against quality criteria",
        "Deliver formatted results with documentation",
    ],
    "automation": [
        "Parse input and validate parameters",
        "Execute {domain} operations in sequence",
        "Track progress and handle errors",
        "Verify completion and results",
        "Report final status with details",
    ],
    "guide": [
        "Assess user's current knowledge level",
        "Present information in logical progression",
        "Provide concrete examples and demonstrations",
        "Check understanding and clarify as needed",
        "Summarize key points and next steps",
    ],
    "validator": [
        "Load {domain} validation rules and criteria",
        "Scan target for compliance violations",
        "Record all findings with evidence",
        "Determine overall pass/fail status",
        "Generate validation report with recommendations",
    ],
    "orchestrator": [
        "Analyze input to determine required subtasks",
        "Allocate subtasks to appropriate workers",
        "Launch workers in parallel when possible",
        "Monitor progress and collect results",
        "Synthesize worker outputs into unified result",
    ],
}

# Default constraints by type
TYPE_CONSTRAINTS = {
    "analyzer": [
        "Do not modify any analyzed artifacts",
        "Report all findings, even minor ones",
        "Provide evidence (file, line number) for each finding",
        "Distinguish between certain issues and potential concerns",
    ],
    "builder": [
        "Follow existing project conventions when present",
        "Generate complete, working output (no placeholders)",
        "Include appropriate error handling",
        "Document generated code or artifacts",
    ],
    "automation": [
        "Validate inputs before processing",
        "Provide progress updates for long operations",
        "Handle errors gracefully without data loss",
        "Log important actions for debugging",
    ],
    "guide": [
        "Use clear, jargon-free language when possible",
        "Provide accurate, up-to-date information",
        "Acknowledge limitations in your knowledge",
        "Encourage questions and exploration",
    ],
    "validator": [
        "Apply rules consistently without exceptions",
        "Provide clear rationale for each finding",
        "Distinguish between blocking and advisory issues",
        "Never auto-fix validation failures",
    ],
    "orchestrator": [
        "Minimize the number of workers spawned",
        "Run independent tasks in parallel",
        "Handle worker failures gracefully",
        "Provide unified, coherent final output",
    ],
}

# Domain-specific enhancements
DOMAIN_ENHANCEMENTS = {
    "security": {
        "capabilities": [
            "Apply OWASP guidelines and security best practices",
            "Identify common vulnerability patterns (injection, XSS, etc.)",
        ],
        "constraints": [
            "Never execute potentially malicious code",
            "Flag any hardcoded credentials or secrets",
        ],
    },
    "documentation": {
        "capabilities": [
            "Generate clear, well-structured documentation",
            "Follow documentation standards (JSDoc, docstrings, etc.)",
        ],
        "constraints": [
            "Maintain consistency with existing documentation style",
            "Include usage examples for complex functionality",
        ],
    },
    "testing": {
        "capabilities": [
            "Generate comprehensive test cases",
            "Cover edge cases and error conditions",
        ],
        "constraints": [
            "Write isolated, repeatable tests",
            "Avoid testing implementation details",
        ],
    },
    "code-review": {
        "capabilities": [
            "Identify bugs, code smells, and maintainability issues",
            "Suggest improvements with concrete examples",
        ],
        "constraints": [
            "Focus on significant issues, not style preferences",
            "Provide constructive, actionable feedback",
        ],
    },
    "refactoring": {
        "capabilities": [
            "Identify refactoring opportunities",
            "Apply established refactoring patterns",
        ],
        "constraints": [
            "Preserve existing behavior (no functional changes)",
            "Make incremental, reviewable changes",
        ],
    },
    "deployment": {
        "capabilities": [
            "Automate deployment workflows",
            "Handle environment-specific configurations",
        ],
        "constraints": [
            "Never expose sensitive credentials",
            "Include rollback capabilities",
        ],
    },
}

# Tool usage guidance
TOOL_GUIDANCE = {
    "Read": "Use Read to examine file contents before processing.",
    "Write": "Use Write to create new files with generated content.",
    "Edit": "Use Edit for precise, targeted modifications to existing files.",
    "Grep": "Use Grep to search for patterns across the codebase.",
    "Glob": "Use Glob to discover files matching specific patterns.",
    "Bash": "Use Bash sparingly for operations that require shell execution.",
    "Task": "Use Task to spawn worker subagents for parallel processing.",
    "WebSearch": "Use WebSearch to find up-to-date information and best practices.",
}


def format_template(template: str, **kwargs: str) -> str:
    """Format a template string with provided values."""
    result = template
    for key, value in kwargs.items():
        result = result.replace("{" + key + "}", value)
    return result


def generate_role_statement(config: PromptConfig) -> str:
    """Generate the role statement based on agent type."""
    template = TYPE_ROLES.get(config.agent_type, TYPE_ROLES["analyzer"])
    return format_template(template, domain=config.domain, purpose=config.purpose)


def generate_capabilities(config: PromptConfig) -> list[str]:
    """Generate capabilities list based on type and domain."""
    # Start with type-specific capabilities
    base_caps = TYPE_CAPABILITIES.get(config.agent_type, [])
    capabilities = [format_template(cap, domain=config.domain) for cap in base_caps]

    # Add domain-specific capabilities
    domain_info = DOMAIN_ENHANCEMENTS.get(config.domain, {})
    capabilities.extend(domain_info.get("capabilities", []))

    return capabilities


def generate_workflow(config: PromptConfig) -> list[str]:
    """Generate workflow steps based on type."""
    base_workflow = TYPE_WORKFLOWS.get(config.agent_type, [])
    return [format_template(step, domain=config.domain) for step in base_workflow]


def generate_constraints(config: PromptConfig) -> list[str]:
    """Generate constraints based on type and domain."""
    # Start with type-specific constraints
    constraints = list(TYPE_CONSTRAINTS.get(config.agent_type, []))

    # Add domain-specific constraints
    domain_info = DOMAIN_ENHANCEMENTS.get(config.domain, {})
    constraints.extend(domain_info.get("constraints", []))

    # Add custom constraints
    constraints.extend(config.constraints)

    return constraints


def generate_tool_guidance(config: PromptConfig) -> str:
    """Generate tool usage guidance."""
    if not config.tools:
        return ""

    lines = ["**Tool Usage:**"]
    for tool in config.tools:
        if tool in TOOL_GUIDANCE:
            lines.append(f"- {TOOL_GUIDANCE[tool]}")

    return "\n".join(lines)


def generate_output_guidance(config: PromptConfig) -> str:
    """Generate output format guidance."""
    if config.output_format:
        return f"**Output Format:**\n{config.output_format}"

    # Default output guidance by type
    type_outputs = {
        "analyzer": "Report findings in a structured format with severity, location, description, and recommendations.",
        "builder": "Deliver complete, well-documented output that follows project conventions.",
        "automation": "Report status (success/failure), actions taken, and any issues encountered.",
        "guide": "Provide clear explanations with examples and actionable next steps.",
        "validator": "Return pass/fail status with detailed breakdown of validation results.",
        "orchestrator": "Synthesize worker results into a unified, comprehensive response.",
    }

    return f"**Output Format:**\n{type_outputs.get(config.agent_type, 'Provide clear, structured output.')}"


# Set of tools whose presence signals the agent performs exploration —
# long Read/Grep/Glob sequences that push earlier rules out of attention
# and warrant a post-exploration reminder.
_EXPLORATION_TOOLS: frozenset[str] = frozenset({"Read", "Grep", "Glob", "WebFetch", "WebSearch"})

# Set of tools whose presence signals the agent performs destructive or
# externally-visible operations (writes, execs, commits). A reminder
# immediately before these operations prevents rule-forgetting accidents.
_DESTRUCTIVE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit", "Bash"})

# Agent types that typically run long and benefit from phase-boundary
# reminders between workflow steps.
_LONG_RUNNING_TYPES: frozenset[str] = frozenset({"analyzer", "orchestrator", "validator"})

# Threshold below which the workflow is short enough that phase-boundary
# reminders are noise rather than signal. Agents with fewer steps than
# this don't get a per-step reminder injected.
_PHASE_BOUNDARY_MIN_STEPS = 5


def generate_reminder_points(
    config: PromptConfig, workflow_steps: list[str]
) -> list[ReminderPoint]:
    """Produce the list of mid-conversation reminder points for this agent.

    A ReminderPoint is a machine-parseable marker that tells:
    - the agent author / reviewer: where the generated prompt expects
      rules to be refreshed mid-conversation;
    - the host harness (Claude Code): where to inject a system-reminder
      message if it wishes to refresh rules proactively;
    - the agent itself: that these are load-bearing checkpoints where
      it must re-consult the constraints before continuing.

    Points are emitted only when the agent is long-running enough to
    benefit — short (< ``_PHASE_BOUNDARY_MIN_STEPS``) workflows without
    destructive tools and without security-sensitive constraints produce
    zero points, which is the correct behavior for simple agents that
    don't accumulate enough context for rule-forgetting to be a risk.

    Args:
        config: The PromptConfig driving generation.
        workflow_steps: The already-generated workflow steps, used to
            attach ``after_step`` indices to phase-boundary reminders.

    Returns:
        List of ReminderPoint instances in the order they fire during
        the agent's run. Empty list when no reminders are warranted.
    """
    tools = set(config.tools)
    has_exploration = bool(_EXPLORATION_TOOLS & tools)
    has_destructive = bool(_DESTRUCTIVE_TOOLS & tools)
    is_long_running = config.agent_type in _LONG_RUNNING_TYPES
    is_security_domain = config.domain.lower() == "security"

    # Construct the set of rules to refresh. Order matters because the
    # injection may truncate to the top-N under context pressure: the
    # user's own custom constraints (``config.constraints``) are the most
    # specific and MUST survive truncation, so they come first. Type- and
    # domain-default constraints follow as the broader baseline.
    # `generate_constraints` returns type+domain+custom; we reorder here
    # rather than dropping the call so the full list remains available if
    # a caller wants it unsliced.
    all_constraints = list(generate_constraints(config))
    custom_rules = list(config.constraints)
    default_rules = [c for c in all_constraints if c not in custom_rules]
    constraint_rules = custom_rules + default_rules

    points: list[ReminderPoint] = []

    # 1. Exploration-complete reminder — fires after the agent finishes
    # a long read/search phase. Prevents rule-forgetting after a large
    # tool-result block pushes the role/constraints out of attention.
    if has_exploration and (is_long_running or has_destructive):
        points.append(
            ReminderPoint(
                trigger="exploration_complete",
                rules=constraint_rules[:5],
                rationale=(
                    "After an extended read/search phase the original constraints "
                    "may have been pushed out of attention by tool-result context. "
                    "Re-read the constraints before making the next decision."
                ),
            )
        )

    # 2. Before-destructive reminder — fires immediately before any
    # Write/Edit/Bash operation. These are irreversible in practice and
    # benefit from a final constraint check.
    if has_destructive:
        destructive_rules = list(constraint_rules)
        # Prepend an explicit "verify before mutating" rule so it's
        # first in the re-injection even when the caller truncates.
        destructive_rules.insert(
            0,
            "Verify the target file and intent match the user request before writing.",
        )
        points.append(
            ReminderPoint(
                trigger="before_destructive",
                rules=destructive_rules[:5],
                rationale=(
                    "Destructive tools (Write/Edit/Bash) produce externally-visible "
                    "side effects. Refresh the constraints and verify the change is "
                    "intended before invoking them."
                ),
            )
        )

    # 3. Phase-boundary reminders — for long workflows (5+ steps),
    # emit one reminder between each pair of steps to keep the role and
    # output format fresh through the full run.
    if len(workflow_steps) >= _PHASE_BOUNDARY_MIN_STEPS:
        role_and_output = [
            f"Role: {config.agent_type} in the {config.domain} domain.",
            f"Purpose: {config.purpose}",
        ]
        for idx in range(1, len(workflow_steps)):
            # Emits boundary N→N+1 for every step except the last.
            points.append(
                ReminderPoint(
                    trigger="phase_boundary",
                    rules=role_and_output,
                    rationale=(
                        f"Transitioning from step {idx} to step {idx + 1}. Long "
                        "workflows accumulate context; re-anchor on role and purpose."
                    ),
                    after_step=idx,
                )
            )

    # 4. Security decision reminder — for security-domain agents OR any
    # agent with Bash, an explicit reminder before high-risk decisions.
    if is_security_domain or "Bash" in tools:
        security_rules: list[str] = []
        if is_security_domain:
            security_rules.append(
                "Default to least privilege; reject any action that broadens access."
            )
        if "Bash" in tools:
            security_rules.append(
                "Bash commands touching /etc, /var, sudo, or curl require explicit user confirmation."
            )
        security_rules.extend(constraint_rules[:3])
        points.append(
            ReminderPoint(
                trigger="security_decision",
                rules=security_rules,
                rationale=(
                    "Security-sensitive agents must re-check least-privilege and "
                    "escalation rules before any impactful decision."
                ),
            )
        )

    return points


def format_reminder_points_section(points: list[ReminderPoint]) -> str:
    """Render the reminder-points section for inclusion in the full prompt.

    Returns the markdown block that documents every point. The block is
    stable (sorted by trigger name for secondary ordering so test assertions
    don't depend on dict iteration). Empty string when no points exist —
    short agents don't get a noisy empty section.
    """
    if not points:
        return ""

    lines = [
        "**Mid-Conversation Refresh Points:**",
        (
            "The following points are documented so the host harness (Claude Code) "
            "can inject a system-reminder at each, refreshing critical rules that "
            "may have been pushed out of attention by accumulated tool results. "
            "The agent should treat each point as load-bearing and re-read the "
            "listed rules before proceeding."
        ),
        "",
    ]
    for point in points:
        header = f"- [{point.trigger}]"
        if point.after_step is not None:
            header += f" (after workflow step {point.after_step})"
        lines.append(header)
        lines.append(f"    rationale: {point.rationale}")
        if point.rules:
            lines.append("    rules to refresh:")
            for rule in point.rules:
                lines.append(f"      - {rule}")
    return "\n".join(lines)


def generate_context_management_section(config: PromptConfig) -> str:
    """Render the Context Management subsection for long-running agents.

    Returns the empty string when ``config.long_running`` is False — that
    keeps the section opt-in so short-lived agents don't carry irrelevant
    guidance. When True, emits :data:`CONTEXT_MANAGEMENT_HEADING` followed
    by every rule in :data:`CONTEXT_MANAGEMENT_RULES` as a markdown bullet.
    """
    if not config.long_running:
        return ""
    lines: list[str] = [CONTEXT_MANAGEMENT_HEADING]
    for rule in CONTEXT_MANAGEMENT_RULES:
        lines.append(f"- {rule}")
    return "\n".join(lines)


def generate_prompt_blocks(config: PromptConfig) -> PromptBlocks:
    """Assemble the 4-block prompt body from the component generators.

    Each block's inner content is fully rendered here (bullet lists,
    numbered workflow, tool guidance paragraph). The formatter functions
    (``format_blocks_markdown`` / ``format_blocks_xml``) only wrap the
    result in headers or tags — they never reshape the content.
    """
    role = generate_role_statement(config)
    capabilities = generate_capabilities(config)
    workflow = generate_workflow(config)
    constraints = generate_constraints(config)
    output_guidance = generate_output_guidance(config)

    # INSTRUCTIONS: role statement + constraints. The role is the single
    # sentence defining what the agent is; constraints are the hard rules
    # the agent must obey. Both belong in INSTRUCTIONS because they are
    # non-negotiable directives rather than background information.
    instructions_lines: list[str] = [role]
    if constraints:
        instructions_lines.append("")
        instructions_lines.append("**Constraints:**")
        for constraint in constraints:
            instructions_lines.append(f"- {constraint}")
    instructions_body = "\n".join(instructions_lines)

    # CONTEXT: capabilities + tool guidance. These describe the agent's
    # environment and available resources rather than imperatives.
    context_lines: list[str] = ["**Capabilities:**"]
    for cap in capabilities:
        context_lines.append(f"- {cap}")
    tool_guidance = generate_tool_guidance(config)
    if tool_guidance:
        context_lines.append("")
        context_lines.append(tool_guidance)
    # Long-running agents need explicit guidance on context window pressure;
    # the section is opt-in (gated by ``config.long_running``) so short-lived
    # agents stay terse. Appended to CONTEXT (not INSTRUCTIONS) because it's
    # environment-aware advice rather than a hard rule.
    context_management = generate_context_management_section(config)
    if context_management:
        context_lines.append("")
        context_lines.append(context_management)
    context_body = "\n".join(context_lines)

    # TASK: the numbered workflow. This is *what the agent actually does*
    # when invoked — distinct from the capabilities (what it *can* do).
    task_lines: list[str] = ["**Workflow:**"]
    for i, step in enumerate(workflow, 1):
        task_lines.append(f"{i}. {step}")
    task_body = "\n".join(task_lines)

    # OUTPUT FORMAT: strip the "**Output Format:**\n" prefix emitted by
    # ``generate_output_guidance`` — the block header/tag replaces it, and
    # leaving the prefix in would produce redundant "## OUTPUT FORMAT /
    # **Output Format:**" headers.
    output_body = output_guidance
    legacy_prefix = "**Output Format:**\n"
    if output_body.startswith(legacy_prefix):
        output_body = output_body[len(legacy_prefix) :]

    return PromptBlocks(
        instructions=instructions_body,
        context=context_body,
        task=task_body,
        output_format=output_body,
    )


def format_blocks_markdown(blocks: PromptBlocks) -> str:
    """Render the 4-block structure as Markdown `##` sections.

    Headers use the canonical names from ``PROMPT_BLOCK_NAMES`` in the
    canonical order so downstream parsers can rely on the structure.
    """
    parts = [
        f"## {PROMPT_BLOCK_NAMES[0]}",
        "",
        blocks.instructions,
        "",
        f"## {PROMPT_BLOCK_NAMES[1]}",
        "",
        blocks.context,
        "",
        f"## {PROMPT_BLOCK_NAMES[2]}",
        "",
        blocks.task,
        "",
        f"## {PROMPT_BLOCK_NAMES[3]}",
        "",
        blocks.output_format,
    ]
    return "\n".join(parts)


def format_blocks_xml(blocks: PromptBlocks) -> str:
    """Render the 4-block structure as XML tags.

    XML tag names come from ``PROMPT_BLOCK_XML_TAGS`` in the canonical
    order. Claude is specifically trained to respect XML-tagged regions,
    so this form is preferred for agents driven by the Anthropic API.
    """
    tags = PROMPT_BLOCK_XML_TAGS
    return (
        f"<{tags[0]}>\n{blocks.instructions}\n</{tags[0]}>\n\n"
        f"<{tags[1]}>\n{blocks.context}\n</{tags[1]}>\n\n"
        f"<{tags[2]}>\n{blocks.task}\n</{tags[2]}>\n\n"
        f"<{tags[3]}>\n{blocks.output_format}\n</{tags[3]}>"
    )


def generate_full_prompt(config: PromptConfig) -> GeneratedPrompt:
    """Generate complete system prompt.

    Respects ``config.structure_format``:

    - ``"legacy"`` (default) — backwards-compatible section list used by
      existing generated agents; sections are stacked in the historical
      order (role, capabilities, workflow, tools, constraints, output).
    - ``"markdown"`` — renders the 4-block INSTRUCTIONS/CONTEXT/TASK/
      OUTPUT FORMAT structure using ``##`` headers.
    - ``"xml"`` — same 4-block structure using XML tags.

    An invalid value raises ``ValueError`` rather than silently falling
    back to legacy, so callers don't ship typos undetected.
    """
    if config.structure_format not in STRUCTURE_FORMATS:
        raise ValueError(
            f"structure_format must be one of {STRUCTURE_FORMATS}, got {config.structure_format!r}"
        )

    role = generate_role_statement(config)
    capabilities = generate_capabilities(config)
    workflow = generate_workflow(config)
    constraints = generate_constraints(config)
    output_guidance = generate_output_guidance(config)
    reminder_points = generate_reminder_points(config, workflow)

    if config.structure_format in ("markdown", "xml"):
        blocks = generate_prompt_blocks(config)
        if config.structure_format == "markdown":
            body = format_blocks_markdown(blocks)
        else:
            body = format_blocks_xml(blocks)

        reminder_section = format_reminder_points_section(reminder_points)
        full_prompt = body if not reminder_section else f"{body}\n\n{reminder_section}"

        return GeneratedPrompt(
            role_statement=role,
            capabilities=capabilities,
            workflow_steps=workflow,
            constraints=constraints,
            output_guidance=output_guidance,
            reminder_points=reminder_points,
            full_prompt=full_prompt,
        )

    # Legacy section-list rendering
    sections = []

    # Role statement
    sections.append(role)
    sections.append("")

    # Capabilities
    sections.append("**Capabilities:**")
    for cap in capabilities:
        sections.append(f"- {cap}")
    sections.append("")

    # Workflow
    sections.append("**Workflow:**")
    for i, step in enumerate(workflow, 1):
        sections.append(f"{i}. {step}")
    sections.append("")

    # Tool guidance
    tool_guidance = generate_tool_guidance(config)
    if tool_guidance:
        sections.append(tool_guidance)
        sections.append("")

    # Constraints
    sections.append("**Constraints:**")
    for constraint in constraints:
        sections.append(f"- {constraint}")
    sections.append("")

    # Output guidance
    sections.append(output_guidance)

    # Mid-conversation refresh points — only emitted when warranted.
    # Short / simple agents produce an empty section and skip it entirely.
    reminder_section = format_reminder_points_section(reminder_points)
    if reminder_section:
        sections.append("")
        sections.append(reminder_section)

    full_prompt = "\n".join(sections)

    return GeneratedPrompt(
        role_statement=role,
        capabilities=capabilities,
        workflow_steps=workflow,
        constraints=constraints,
        output_guidance=output_guidance,
        reminder_points=reminder_points,
        full_prompt=full_prompt,
    )


def generate(
    agent_type: str,
    domain: str,
    purpose: str,
    tools: list[str] | None = None,
    constraints: list[str] | None = None,
    output_format: str = "",
) -> GeneratedPrompt:
    """Generate a system prompt with the given configuration."""
    config = PromptConfig(
        agent_type=agent_type,
        domain=domain,
        purpose=purpose,
        tools=tools or [],
        constraints=constraints or [],
        output_format=output_format,
    )

    return generate_full_prompt(config)


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate agent system prompts")
    parser.add_argument(
        "--type",
        required=True,
        choices=[
            "analyzer",
            "builder",
            "automation",
            "guide",
            "validator",
            "orchestrator",
        ],
        help="Agent type",
    )
    parser.add_argument("--domain", required=True, help="Domain (security, documentation, etc.)")
    parser.add_argument("--purpose", required=True, help="Specific purpose description")
    parser.add_argument("--tools", help="Comma-separated tool list")
    parser.add_argument("--constraints", help="Comma-separated custom constraints")
    parser.add_argument("--output-format", help="Expected output format description")
    parser.add_argument("--json", help="JSON input with all parameters")
    parser.add_argument("--json-output", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Parse input
    if args.json:
        data: dict[str, Any] = json.loads(args.json)
        agent_type = data.get("type", "analyzer")
        domain = data.get("domain", "general")
        purpose = data.get("purpose", "")
        tools = data.get("tools", [])
        constraints = data.get("constraints", [])
        output_format = data.get("output_format", "")
    else:
        agent_type = args.type
        domain = args.domain
        purpose = args.purpose
        tools = args.tools.split(",") if args.tools else []
        constraints = args.constraints.split(",") if args.constraints else []
        output_format = args.output_format or ""

    # Generate prompt
    result = generate(
        agent_type=agent_type,
        domain=domain,
        purpose=purpose,
        tools=tools,
        constraints=constraints,
        output_format=output_format,
    )

    # Output
    if args.json_output:
        output = {
            "role_statement": result.role_statement,
            "capabilities": result.capabilities,
            "workflow_steps": result.workflow_steps,
            "constraints": result.constraints,
            "output_guidance": result.output_guidance,
            "full_prompt": result.full_prompt,
        }
        print(json.dumps(output, indent=2))
    else:
        print(result.full_prompt)


if __name__ == "__main__":
    main()
