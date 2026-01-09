#!/usr/bin/env python3
"""
System Prompt Generator for Platxa Agent Generator

Generates clear, specific, and effective system prompts based on agent type and purpose.

Usage:
    python prompt_generator.py --type analyzer --domain security --purpose "scan code for vulnerabilities"
    python prompt_generator.py --json '{"type": "builder", "domain": "documentation", "purpose": "generate docs"}'
"""

import json
from dataclasses import dataclass
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


@dataclass
class GeneratedPrompt:
    """Generated system prompt components."""

    role_statement: str
    capabilities: list[str]
    workflow_steps: list[str]
    constraints: list[str]
    output_guidance: str
    full_prompt: str


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


def generate_full_prompt(config: PromptConfig) -> GeneratedPrompt:
    """Generate complete system prompt."""
    role = generate_role_statement(config)
    capabilities = generate_capabilities(config)
    workflow = generate_workflow(config)
    constraints = generate_constraints(config)
    output_guidance = generate_output_guidance(config)

    # Build full prompt
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

    full_prompt = "\n".join(sections)

    return GeneratedPrompt(
        role_statement=role,
        capabilities=capabilities,
        workflow_steps=workflow,
        constraints=constraints,
        output_guidance=output_guidance,
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
    parser.add_argument(
        "--domain", required=True, help="Domain (security, documentation, etc.)"
    )
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
