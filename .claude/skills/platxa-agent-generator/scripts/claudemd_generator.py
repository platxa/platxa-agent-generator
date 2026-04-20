#!/usr/bin/env python3
"""
CLAUDE.md Generator for Agent-Specific Context

Generates CLAUDE.md files that provide useful project context for
generated agents, helping Claude Code understand how to work with
the agent within its deployment context.

Usage:
    python claudemd_generator.py --agent security-scanner --output .claude/
    python claudemd_generator.py --blueprint blueprint.json --output .claude/
    python claudemd_generator.py --json '{"name": "test-runner", "tools": ["Bash"]}'
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class AvailableAgent:
    """Metadata about a sibling agent available for subagent delegation.

    Surfaces in the generated CLAUDE.md so the primary agent knows which
    specialists it can dispatch via the Task tool and — crucially — *when*
    to dispatch each one. The ``when_to_use`` hint is the most important
    field: without it, generated CLAUDE.md just lists agent names and the
    primary agent has no decision criterion.
    """

    name: str
    description: str
    when_to_use: str = ""


@dataclass
class AgentContext:
    """Context information for CLAUDE.md generation."""

    name: str
    description: str
    tools: list[str]
    pattern: str = "prompt-chaining"
    domain: str = ""
    input_types: list[str] = field(default_factory=list)
    output_types: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    mcp_servers: list[str] = field(default_factory=list)
    custom_sections: dict[str, str] = field(default_factory=dict)
    available_agents: list[AvailableAgent] = field(default_factory=list)


# Tool categories for generating contextual guidance
TOOL_CATEGORIES = {
    "file_operations": ["Read", "Write", "Edit", "Glob"],
    "search": ["Grep", "Glob", "WebSearch"],
    "execution": ["Bash", "Task", "LSP"],
    "web": ["WebFetch", "WebSearch"],
    "interaction": ["AskUserQuestion", "TodoWrite"],
    "notebook": ["NotebookEdit"],
}

# Pattern descriptions for CLAUDE.md
PATTERN_DESCRIPTIONS = {
    "prompt-chaining": "Sequential steps where each output feeds the next input",
    "routing": "Classifies input and routes to specialized handlers",
    "parallelization": "Decomposes task into independent concurrent subtasks",
    "orchestrator-workers": "Dynamically spawns and coordinates worker subagents",
    "evaluator-optimizer": "Iterative refinement with feedback loops until quality met",
}

# Domain-specific guidance templates
DOMAIN_GUIDANCE = {
    "security": {
        "focus": "Security analysis and vulnerability detection",
        "considerations": [
            "Follow OWASP guidelines",
            "Check for injection vulnerabilities",
            "Validate input sanitization",
            "Review authentication and authorization",
        ],
        "references": ["OWASP Top 10", "CWE database", "Security best practices"],
    },
    "testing": {
        "focus": "Test creation, execution, and analysis",
        "considerations": [
            "Maintain test isolation",
            "Cover edge cases",
            "Check test determinism",
            "Ensure proper mocking",
        ],
        "references": ["pytest documentation", "Testing best practices"],
    },
    "documentation": {
        "focus": "Code documentation and explanation",
        "considerations": [
            "Follow docstring conventions",
            "Include usage examples",
            "Document parameters and returns",
            "Explain complex logic",
        ],
        "references": ["PEP 257", "Google Python Style Guide"],
    },
    "refactoring": {
        "focus": "Code improvement and restructuring",
        "considerations": [
            "Preserve existing behavior",
            "Maintain backward compatibility",
            "Follow existing patterns",
            "Keep changes focused",
        ],
        "references": ["Refactoring patterns", "SOLID principles"],
    },
    "analysis": {
        "focus": "Code analysis and insights",
        "considerations": [
            "Identify patterns and anti-patterns",
            "Assess code quality metrics",
            "Detect potential issues",
            "Provide actionable recommendations",
        ],
        "references": ["Code quality metrics", "Static analysis tools"],
    },
}


def infer_domain(name: str, description: str, tools: list[str]) -> str:
    """Infer the domain from agent name, description, and tools."""
    # Include tools in domain inference for more context
    combined = f"{name} {description} {' '.join(tools)}".lower()

    # Security domain
    if any(kw in combined for kw in ["security", "vulnerability", "scan", "audit", "owasp", "cve"]):
        return "security"

    # Testing domain
    if any(kw in combined for kw in ["test", "spec", "assert", "coverage", "pytest", "jest"]):
        return "testing"

    # Documentation domain
    if any(kw in combined for kw in ["document", "docstring", "readme", "comment", "explain"]):
        return "documentation"

    # Refactoring domain
    if any(kw in combined for kw in ["refactor", "restructure", "clean", "improve", "optimize"]):
        return "refactoring"

    # Analysis domain
    if any(kw in combined for kw in ["analyze", "review", "inspect", "examine", "audit"]):
        return "analysis"

    # Default to analysis for generic agents
    return "analysis"


def infer_input_output_types(description: str, tools: list[str]) -> tuple[list[str], list[str]]:
    """Infer input and output types from description and tools."""
    desc_lower = description.lower()
    inputs: list[str] = []
    outputs: list[str] = []

    # File-related tools suggest file I/O
    if any(t in tools for t in ["Read", "Glob", "Grep"]):
        inputs.append("Source files")
    if any(t in tools for t in ["Write", "Edit"]):
        outputs.append("Modified files")

    # Web tools suggest URL inputs
    if any(t in tools for t in ["WebFetch", "WebSearch"]):
        inputs.append("URLs or search queries")
        outputs.append("Web content analysis")

    # Bash suggests command execution
    if "Bash" in tools:
        outputs.append("Command output")

    # Task tool suggests structured output
    if "Task" in tools:
        outputs.append("Subagent results")

    # Description-based inference
    if "json" in desc_lower:
        outputs.append("JSON reports")
    if "markdown" in desc_lower or "report" in desc_lower:
        outputs.append("Markdown documentation")
    if any(kw in desc_lower for kw in ["code", "function", "class", "module"]):
        inputs.append("Code artifacts")

    # Default inputs/outputs if none inferred
    if not inputs:
        inputs.append("User request")
    if not outputs:
        outputs.append("Structured response")

    return inputs, outputs


def generate_project_overview(context: AgentContext) -> str:
    """Generate the Project Overview section."""
    lines = ["## Project Overview", ""]

    # Agent description
    lines.append(f"This project contains the **{context.name}** agent for Claude Code.")
    lines.append("")
    lines.append(f"**Purpose:** {context.description}")
    lines.append("")

    # Pattern description
    pattern_desc = PATTERN_DESCRIPTIONS.get(context.pattern, "Custom workflow pattern")
    lines.append(f"**Workflow Pattern:** {context.pattern.replace('-', ' ').title()}")
    lines.append(f"> {pattern_desc}")
    lines.append("")

    # Input/Output types
    if context.input_types:
        lines.append("**Inputs:**")
        for input_type in context.input_types:
            lines.append(f"- {input_type}")
        lines.append("")

    if context.output_types:
        lines.append("**Outputs:**")
        for output_type in context.output_types:
            lines.append(f"- {output_type}")
        lines.append("")

    return "\n".join(lines)


def generate_architecture_section(context: AgentContext) -> str:
    """Generate the Architecture section."""
    lines = ["## Architecture", ""]

    # Tool grouping
    tool_groups: dict[str, list[str]] = {}
    for tool in context.tools:
        for category, tools_in_cat in TOOL_CATEGORIES.items():
            if tool in tools_in_cat:
                if category not in tool_groups:
                    tool_groups[category] = []
                tool_groups[category].append(tool)
                break

    # Display tool capabilities
    lines.append("### Tool Capabilities")
    lines.append("")
    lines.append("| Category | Tools | Purpose |")
    lines.append("|----------|-------|---------|")

    category_purposes = {
        "file_operations": "Reading, writing, and modifying files",
        "search": "Finding files and content",
        "execution": "Running commands and spawning subagents",
        "web": "Fetching web content and searching online",
        "interaction": "User interaction and progress tracking",
        "notebook": "Jupyter notebook operations",
    }

    for category, tools in tool_groups.items():
        purpose = category_purposes.get(category, "General operations")
        lines.append(f"| {category.replace('_', ' ').title()} | {', '.join(tools)} | {purpose} |")

    lines.append("")

    # Pattern-specific architecture
    if context.pattern == "orchestrator-workers":
        lines.append("### Orchestrator-Workers Pattern")
        lines.append("")
        lines.append("```")
        lines.append("┌─────────────────────────────────────────┐")
        lines.append("│            ORCHESTRATOR                 │")
        lines.append("│  • Analyzes input                       │")
        lines.append("│  • Spawns workers via Task tool         │")
        lines.append("│  • Synthesizes results                  │")
        lines.append("└─────────────────────────────────────────┘")
        lines.append("       │           │           │")
        lines.append("       ▼           ▼           ▼")
        lines.append("  [Worker 1]  [Worker 2]  [Worker N]")
        lines.append("```")
        lines.append("")

    elif context.pattern == "prompt-chaining":
        lines.append("### Prompt-Chaining Pattern")
        lines.append("")
        lines.append("```")
        lines.append("[Input] → [Step 1] → [Step 2] → ... → [Output]")
        lines.append("           (gate)     (gate)          (gate)")
        lines.append("```")
        lines.append("")
        lines.append("Each step has a quality gate before proceeding.")
        lines.append("")

    elif context.pattern == "parallelization":
        lines.append("### Parallelization Pattern")
        lines.append("")
        lines.append("```")
        lines.append("         ┌─ [Task 1] ─┐")
        lines.append("[Input] ─┼─ [Task 2] ─┼─ [Aggregate] → [Output]")
        lines.append("         └─ [Task N] ─┘")
        lines.append("```")
        lines.append("")

    return "\n".join(lines)


def generate_development_section(context: AgentContext) -> str:
    """Generate the Development section with domain guidance."""
    lines = ["## Development", ""]

    # Domain-specific guidance
    domain_info = DOMAIN_GUIDANCE.get(context.domain, {})
    if domain_info:
        lines.append(f"### Focus Area: {domain_info.get('focus', context.domain.title())}")
        lines.append("")

        considerations = domain_info.get("considerations", [])
        if considerations:
            lines.append("### Key Considerations")
            lines.append("")
            for consideration in considerations:
                lines.append(f"- {consideration}")
            lines.append("")

    # Critical rules based on tools
    lines.append("### Critical Rules")
    lines.append("")

    if "Write" in context.tools or "Edit" in context.tools:
        lines.append("- **Read Before Write**: Always read files before modifying them")
        lines.append(
            "- **Preserve Behavior**: Maintain existing functionality unless explicitly changing it"
        )

    if "Bash" in context.tools:
        lines.append("- **Validate Commands**: Ensure commands are safe before execution")
        lines.append("- **Check Exit Codes**: Verify command success before proceeding")

    if "Task" in context.tools:
        lines.append("- **Subagent Isolation**: Each subagent has its own context window")
        lines.append("- **Result Synthesis**: Always aggregate and validate subagent outputs")

    if "WebFetch" in context.tools or "WebSearch" in context.tools:
        lines.append("- **URL Validation**: Only access trusted, user-provided URLs")
        lines.append("- **Content Verification**: Validate web content before processing")

    lines.append("")

    # Commands section
    lines.append("### Useful Commands")
    lines.append("")
    lines.append("```bash")
    lines.append(f"# Run the {context.name} agent")
    lines.append(f"claude --agent {context.name}")
    lines.append("")
    lines.append("# Run with specific input")
    lines.append(f'claude --agent {context.name} -p "your task here"')
    lines.append("```")
    lines.append("")

    return "\n".join(lines)


def generate_references_section(context: AgentContext) -> str:
    """Generate the References section."""
    lines = ["## References", ""]

    # Domain references
    domain_info = DOMAIN_GUIDANCE.get(context.domain, {})
    refs = domain_info.get("references", [])
    if refs:
        lines.append("### Domain Resources")
        lines.append("")
        for ref in refs:
            lines.append(f"- {ref}")
        lines.append("")

    # Standard references
    lines.append("### Agent Resources")
    lines.append("")
    lines.append(f"- **Agent Definition**: `.claude/agents/{context.name}.md`")

    if context.mcp_servers:
        lines.append("- **MCP Servers**: " + ", ".join(context.mcp_servers))

    if context.dependencies:
        lines.append("- **Dependencies**: " + ", ".join(context.dependencies))

    lines.append("")

    return "\n".join(lines)


# Default heading for the subagent-delegation section. Pinned to a constant
# so the generator and any downstream parsers/tests agree on the literal
# (changing the section title in one place would silently break the other).
SUBAGENT_DELEGATION_HEADING: str = "## Subagent Delegation"

# Default project-scope directory to scan when discovering sibling agents.
# Kept in sync with the companion skill/command generators so the three
# discoverers look in conventional Claude Code locations.
DEFAULT_AGENTS_DIR: str = ".claude/agents"


def generate_subagent_delegation_section(agents: list[AvailableAgent]) -> str:
    """Render a Subagent Delegation section listing sibling agents.

    Structure:

    ```
    ## Subagent Delegation

    Use specialized agents for focused tasks:
    - **agent-name**: description

    ### When to use
    - **agent-name**: when_to_use hint
    ```

    Agents without a ``when_to_use`` hint still appear in the main list
    but are skipped from the "When to use" subsection — printing an
    empty "use when:" line would be worse than leaving it out.

    Returns an empty string when ``agents`` is empty so the caller can
    conditionally append without checking.
    """
    if not agents:
        return ""
    lines: list[str] = [SUBAGENT_DELEGATION_HEADING, ""]
    lines.append("Use specialized agents for focused tasks:")
    lines.append("")
    for agent in agents:
        lines.append(f"- **{agent.name}**: {agent.description}")
    lines.append("")
    hinted = [a for a in agents if a.when_to_use]
    if hinted:
        lines.append("### When to use")
        lines.append("")
        for agent in hinted:
            lines.append(f"- **{agent.name}**: {agent.when_to_use}")
        lines.append("")
    return "\n".join(lines)


def discover_available_agents(agents_dir: Path | str = DEFAULT_AGENTS_DIR) -> list[AvailableAgent]:
    """Scan ``agents_dir`` for agent .md files and return AvailableAgent list.

    Reads YAML frontmatter for ``name`` and ``description`` (required) and
    ``when-to-use`` or ``when_to_use`` (optional). Skips files without
    frontmatter or with missing required fields — one malformed agent
    doesn't blind discovery to the rest (same reasoning as
    discover_available_skills in feature #69).

    Returns an empty list when ``agents_dir`` does not exist — treat
    "no agents available" as a normal state, not an error.

    Surfaces any skipped ``.md`` files as a single stderr summary line at
    end of scan (``skipped N malformed agents: <paths>``). The return
    value still omits malformed entries — the stderr line is purely
    additive so users can diagnose why an expected agent didn't appear.
    Non-``.md`` entries and subdirectories are not malformed and are not
    reported. Silent on stderr when every file parses cleanly.
    """
    base = Path(agents_dir)
    if not base.is_dir():
        return []
    results: list[AvailableAgent] = []
    skipped: list[Path] = []
    for child in sorted(base.iterdir()):
        if not child.is_file() or child.suffix != ".md":
            continue
        try:
            text = child.read_text(encoding="utf-8")
        except OSError:
            skipped.append(child)
            continue
        if not text.startswith("---"):
            skipped.append(child)
            continue
        try:
            end = text.index("\n---", 3)
        except ValueError:
            skipped.append(child)
            continue
        frontmatter = text[3:end]
        name: str | None = None
        description: str | None = None
        when_to_use = ""
        for line in frontmatter.splitlines():
            stripped = line.strip()
            if stripped.startswith("name:"):
                name = stripped.split(":", 1)[1].strip()
            elif stripped.startswith("description:"):
                description = stripped.split(":", 1)[1].strip()
            elif stripped.startswith("when-to-use:") or stripped.startswith("when_to_use:"):
                when_to_use = stripped.split(":", 1)[1].strip()
        if not name or not description:
            skipped.append(child)
            continue
        results.append(AvailableAgent(name=name, description=description, when_to_use=when_to_use))
    if skipped:
        paths = ", ".join(str(p) for p in skipped)
        print(
            f"skipped {len(skipped)} malformed agents: {paths}",
            file=sys.stderr,
        )
    return results


def generate_claudemd(context: AgentContext) -> str:
    """Generate complete CLAUDE.md content for an agent."""
    parts = []

    # Header
    parts.append("# CLAUDE.md")
    parts.append("")
    parts.append(
        "This file provides guidance to Claude Code when working with "
        f"the **{context.name}** agent."
    )
    parts.append("")

    # Main sections
    parts.append(generate_project_overview(context))
    parts.append(generate_architecture_section(context))
    parts.append(generate_development_section(context))
    parts.append(generate_references_section(context))

    # Subagent Delegation — emitted only when the context knows about peer
    # agents. Placed between development guidance and custom sections so
    # "what can this project dispatch?" lives with the rest of the
    # project-level guidance.
    delegation = generate_subagent_delegation_section(context.available_agents)
    if delegation:
        parts.append(delegation)

    # Custom sections
    for title, content in context.custom_sections.items():
        parts.append(f"## {title}")
        parts.append("")
        parts.append(content)
        parts.append("")

    # Footer with generation timestamp
    parts.append("---")
    parts.append("")
    parts.append(f"*Generated by Platxa Agent Generator on {datetime.now().strftime('%Y-%m-%d')}*")
    parts.append("")

    return "\n".join(parts)


def create_context_from_dict(data: dict[str, Any]) -> AgentContext:
    """Create AgentContext from dictionary."""
    tools = data.get("tools", [])
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",")]

    name = data.get("name", "unnamed-agent")
    description = data.get("description", "")

    # Infer domain if not provided
    domain = data.get("domain", "")
    if not domain:
        domain = infer_domain(name, description, tools)

    # Infer input/output types if not provided
    input_types = data.get("input_types", [])
    output_types = data.get("output_types", [])
    if not input_types or not output_types:
        inferred_inputs, inferred_outputs = infer_input_output_types(description, tools)
        input_types = input_types or inferred_inputs
        output_types = output_types or inferred_outputs

    return AgentContext(
        name=name,
        description=description,
        tools=tools,
        pattern=data.get("pattern", "prompt-chaining"),
        domain=domain,
        input_types=input_types,
        output_types=output_types,
        dependencies=data.get("dependencies", []),
        mcp_servers=data.get("mcp_servers", []),
        custom_sections=data.get("custom_sections", {}),
    )


def create_context_from_agent_file(agent_path: Path) -> AgentContext | None:
    """Create AgentContext by parsing an existing agent.md file."""
    if not agent_path.exists():
        return None

    content = agent_path.read_text(encoding="utf-8")
    lines = content.split("\n")

    # Parse frontmatter
    if not lines or lines[0].strip() != "---":
        return None

    frontmatter: dict[str, str] = {}
    in_frontmatter = True
    pattern = "prompt-chaining"

    for line in lines[1:]:
        if line.strip() == "---":
            in_frontmatter = False
            continue

        if in_frontmatter:
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                frontmatter[key] = value
        else:
            # Look for pattern in workflow section
            if "orchestrator" in line.lower():
                pattern = "orchestrator-workers"
            elif "routing" in line.lower():
                pattern = "routing"
            elif "parallel" in line.lower():
                pattern = "parallelization"
            elif "evaluator" in line.lower() or "optimizer" in line.lower():
                pattern = "evaluator-optimizer"

    name = frontmatter.get("name", agent_path.stem)
    description = frontmatter.get("description", "")
    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",")] if tools_str else []

    domain = infer_domain(name, description, tools)
    input_types, output_types = infer_input_output_types(description, tools)

    return AgentContext(
        name=name,
        description=description,
        tools=tools,
        pattern=pattern,
        domain=domain,
        input_types=input_types,
        output_types=output_types,
    )


def validate_path_safe(filepath: str) -> tuple[bool, str]:
    """Validate file path to prevent path traversal attacks."""
    import tempfile

    path = Path(filepath)

    try:
        resolved = path.resolve()
        cwd = Path.cwd().resolve()
        home = Path.home().resolve()
        temp = Path(tempfile.gettempdir()).resolve()

        allowed_roots = [str(cwd), str(home), str(temp)]
        if not any(str(resolved).startswith(root) for root in allowed_roots):
            return (
                False,
                "Path must be within current directory, home directory, or temp directory",
            )
    except (OSError, ValueError) as e:
        return False, f"Invalid path: {e}"

    # Check for suspicious patterns
    suspicious_patterns = ["$", "`", ";", "|", "&"]
    filepath_str = str(filepath)
    for pattern in suspicious_patterns:
        if pattern in filepath_str:
            return False, f"Suspicious pattern in path: {pattern}"

    return True, ""


def generate(
    agent_name: str | None = None,
    agent_file: str | Path | None = None,
    blueprint: dict[str, Any] | None = None,
    output_dir: str | Path | None = None,
) -> tuple[bool, str, str]:
    """
    Generate CLAUDE.md for an agent.

    Args:
        agent_name: Name of agent (used with agent_file or standalone)
        agent_file: Path to existing agent.md file to analyze
        blueprint: Dictionary with agent definition
        output_dir: Output directory for CLAUDE.md

    Returns:
        (success, content_or_error, output_path)
    """
    context: AgentContext | None = None

    # Determine context source
    if blueprint:
        context = create_context_from_dict(blueprint)
    elif agent_file:
        agent_path = Path(agent_file)
        if not agent_path.exists():
            return False, f"Agent file not found: {agent_file}", ""
        context = create_context_from_agent_file(agent_path)
        if not context:
            return False, f"Could not parse agent file: {agent_file}", ""
    elif agent_name:
        # Try to find agent file
        for search_dir in [Path(".claude/agents"), Path.home() / ".claude/agents"]:
            agent_path = search_dir / f"{agent_name}.md"
            if agent_path.exists():
                context = create_context_from_agent_file(agent_path)
                break

        if not context:
            # Create minimal context from name only
            context = AgentContext(
                name=agent_name,
                description=f"The {agent_name} agent",
                tools=["Read", "Grep", "Glob"],  # Default tools
            )
    else:
        return False, "Must provide agent_name, agent_file, or blueprint", ""

    # Generate content
    content = generate_claudemd(context)

    # Write to output if specified
    output_path = ""
    if output_dir:
        valid, error = validate_path_safe(str(output_dir))
        if not valid:
            return False, f"Invalid output path: {error}", ""

        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(out_dir / "CLAUDE.md")
        Path(output_path).write_text(content, encoding="utf-8")

    return True, content, output_path


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate CLAUDE.md for agent-specific context")
    parser.add_argument("--agent", help="Agent name to generate CLAUDE.md for")
    parser.add_argument("--agent-file", help="Path to existing agent.md file")
    parser.add_argument("--blueprint", help="Path to blueprint JSON file")
    parser.add_argument("--json", help="JSON input with agent definition")
    parser.add_argument("--output", help="Output directory for CLAUDE.md")
    parser.add_argument("--stdout", action="store_true", help="Output to stdout instead of file")

    args = parser.parse_args()

    # Parse input
    blueprint = None
    if args.json:
        blueprint = json.loads(args.json)
    elif args.blueprint:
        valid, error = validate_path_safe(args.blueprint)
        if not valid:
            print(f"Error: {error}", file=sys.stderr)
            sys.exit(1)

        bp_path = Path(args.blueprint)
        if not bp_path.exists():
            print(f"Error: Blueprint file not found: {args.blueprint}", file=sys.stderr)
            sys.exit(1)

        blueprint = json.loads(bp_path.read_text(encoding="utf-8"))

    # Determine output
    output_dir = None if args.stdout else args.output

    # Generate
    success, content, path = generate(
        agent_name=args.agent,
        agent_file=args.agent_file,
        blueprint=blueprint,
        output_dir=output_dir,
    )

    if not success:
        print(f"Error: {content}", file=sys.stderr)
        sys.exit(1)

    if args.stdout or not output_dir:
        print(content)
    else:
        print(f"Generated: {path}")


if __name__ == "__main__":
    main()
