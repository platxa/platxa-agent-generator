#!/usr/bin/env python3
"""
Agent File Generator for Platxa Agent Generator

Generates .claude/agents/*.md files with valid YAML frontmatter.

Usage:
    python agent_generator.py --name "security-scanner" --description "Scans code for vulnerabilities" --tools "Read,Grep,Glob"
    python agent_generator.py --json '{"name": "test-runner", "description": "Runs tests", "tools": ["Bash"]}'
    python agent_generator.py --blueprint blueprint.json --output .claude/agents/
"""

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AgentSection:
    """A section in the agent definition."""
    title: str
    content: str
    level: int = 2  # H2 by default


@dataclass
class WorkerDefinition:
    """A worker agent for orchestrator pattern."""
    name: str
    role: str
    tools: list[str]
    input_format: str = ""
    output_format: str = ""


@dataclass
class AgentDefinition:
    """Complete agent definition for file generation."""
    name: str
    description: str
    tools: list[str]
    sections: list[AgentSection] = field(default_factory=list)
    workers: list[WorkerDefinition] = field(default_factory=list)
    examples: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


# Valid Claude Code tools
VALID_TOOLS = {
    "Read", "Write", "Edit", "Grep", "Glob", "Bash",
    "WebSearch", "WebFetch", "Task", "AskUserQuestion",
    "TodoWrite", "NotebookEdit", "LSP", "Skill",
}

# Allowed directories for blueprint files
ALLOWED_BLUEPRINT_DIRS = [
    ".claude",
    ".claude/skills",
    ".claude/agents",
    "blueprints",
]


def validate_path_safe(filepath: str, allowed_extensions: list[str]) -> tuple[bool, str]:
    """Validate file path to prevent path traversal attacks."""
    path = Path(filepath)

    # Check for path traversal attempts
    try:
        resolved = path.resolve()
        # Ensure path doesn't escape current working directory or home
        cwd = Path.cwd().resolve()
        home = Path.home().resolve()

        if not (str(resolved).startswith(str(cwd)) or
                str(resolved).startswith(str(home))):
            return False, "Path must be within current directory or home directory"
    except (OSError, ValueError) as e:
        return False, f"Invalid path: {e}"

    # Check extension
    if allowed_extensions and path.suffix.lower() not in allowed_extensions:
        return False, f"Invalid extension. Allowed: {', '.join(allowed_extensions)}"

    # Check for suspicious patterns
    suspicious_patterns = ["..", "~", "$", "`", ";", "|", "&"]
    filepath_str = str(filepath)
    for pattern in suspicious_patterns:
        if pattern in filepath_str and pattern != "..":
            return False, f"Suspicious pattern in path: {pattern}"

    return True, ""


def validate_name(name: str) -> tuple[bool, str]:
    """Validate agent name format."""
    if not name:
        return False, "Name cannot be empty"

    if len(name) > 64:
        return False, f"Name too long ({len(name)} > 64 chars)"

    if not re.match(r'^[a-z][a-z0-9-]*[a-z0-9]$', name) and len(name) > 1:
        if not re.match(r'^[a-z][a-z0-9-]*$', name):
            return False, "Name must be hyphen-case (lowercase letters, numbers, hyphens)"

    if '--' in name:
        return False, "Name cannot contain consecutive hyphens"

    return True, ""


def validate_description(description: str) -> tuple[bool, str]:
    """Validate description format."""
    if not description:
        return False, "Description cannot be empty"

    if len(description) > 1024:
        return False, f"Description too long ({len(description)} > 1024 chars)"

    return True, ""


def validate_tools(tools: list[str]) -> tuple[bool, str, list[str]]:
    """Validate and normalize tool names."""
    if not tools:
        return False, "At least one tool required", []

    normalized = []
    invalid = []

    for tool in tools:
        tool_clean = tool.strip()
        # Check for MCP tools (mcp__*)
        if tool_clean.startswith("mcp__"):
            normalized.append(tool_clean)
        elif tool_clean in VALID_TOOLS:
            normalized.append(tool_clean)
        else:
            # Try case-insensitive match
            matched = False
            for valid in VALID_TOOLS:
                if tool_clean.lower() == valid.lower():
                    normalized.append(valid)
                    matched = True
                    break
            if not matched:
                invalid.append(tool_clean)

    if invalid:
        return False, f"Invalid tools: {', '.join(invalid)}", normalized

    return True, "", normalized


def generate_frontmatter(definition: AgentDefinition) -> str:
    """Generate valid YAML frontmatter."""
    lines = ["---"]
    lines.append(f"name: {definition.name}")

    # Escape description if it contains special characters
    desc = definition.description
    if ':' in desc or '\n' in desc or desc.startswith('{') or desc.startswith('['):
        # Use quoted string for complex descriptions
        desc_escaped = desc.replace('"', '\\"')
        lines.append(f'description: "{desc_escaped}"')
    else:
        lines.append(f"description: {desc}")

    # Tools as comma-separated list
    lines.append(f"tools: {', '.join(definition.tools)}")

    # Add metadata if present
    if definition.metadata:
        if "version" in definition.metadata:
            lines.append(f"version: {definition.metadata['version']}")
        if "author" in definition.metadata:
            lines.append(f"author: {definition.metadata['author']}")

    lines.append("---")
    return "\n".join(lines)


def generate_title(name: str) -> str:
    """Generate H1 title from agent name."""
    # Convert hyphen-case to Title Case
    words = name.replace("-", " ").title()
    return f"# {words}"


def generate_overview_section(definition: AgentDefinition) -> str:
    """Generate Overview section."""
    lines = ["## Overview", ""]
    lines.append(definition.description)
    lines.append("")

    if definition.workers:
        lines.append("**Workers:**")
        for worker in definition.workers:
            lines.append(f"- **{worker.name}**: {worker.role}")
        lines.append("")

    return "\n".join(lines)


def generate_workflow_section(
    definition: AgentDefinition,
    pattern: str = "prompt-chaining"
) -> str:
    """Generate Workflow section based on pattern."""
    lines = ["## Workflow", ""]

    if pattern == "orchestrator-workers" and definition.workers:
        lines.append("### Phase 1: Analysis")
        lines.append("Examine input to determine scope and required workers.")
        lines.append("")
        lines.append("### Phase 2: Worker Dispatch")
        lines.append("Spawn workers in parallel using Task tool:")
        lines.append("")
        lines.append("```")
        for i, worker in enumerate(definition.workers, 1):
            lines.append(f"Task {i}:")
            lines.append(f'  subagent_type: "{worker.name}"')
            lines.append(f'  description: "{worker.role}"')
        lines.append("```")
        lines.append("")
        lines.append("### Phase 3: Synthesis")
        lines.append("Combine worker results into unified output.")
    else:
        lines.append("1. **Initialize**: Prepare for task execution")
        lines.append("2. **Execute**: Perform main task logic")
        lines.append("3. **Validate**: Verify results")
        lines.append("4. **Output**: Format and return results")

    lines.append("")
    return "\n".join(lines)


def generate_examples_section(definition: AgentDefinition) -> str:
    """Generate Examples section."""
    lines = ["## Examples", ""]

    if definition.examples:
        for i, example in enumerate(definition.examples, 1):
            title = example.get("title", f"Example {i}")
            lines.append(f"### {title}")
            lines.append("")

            if "request" in example:
                lines.append("**User Request:**")
                lines.append("```")
                lines.append(example["request"])
                lines.append("```")
                lines.append("")

            if "actions" in example:
                lines.append("**Agent Actions:**")
                for j, action in enumerate(example["actions"], 1):
                    lines.append(f"{j}. {action}")
                lines.append("")

            if "output" in example:
                lines.append("**Output:**")
                lines.append("```")
                lines.append(example["output"])
                lines.append("```")
                lines.append("")
    else:
        # Generate placeholder example
        lines.append("### Example 1: Basic Usage")
        lines.append("")
        lines.append("**User Request:**")
        lines.append("```")
        lines.append(f"Use {definition.name} to process the target")
        lines.append("```")
        lines.append("")
        lines.append("**Agent Actions:**")
        lines.append("1. Analyze input")
        lines.append("2. Execute task")
        lines.append("3. Return results")
        lines.append("")

    return "\n".join(lines)


def generate_output_section(definition: AgentDefinition) -> str:
    """Generate Output Format section based on agent definition."""
    lines = ["## Output Format", ""]

    # Customize output based on whether agent has workers
    if definition.workers:
        lines.append("```json")
        lines.append("{")
        lines.append('  "status": "success|error",')
        lines.append('  "worker_results": {')
        for i, worker in enumerate(definition.workers):
            comma = "," if i < len(definition.workers) - 1 else ""
            lines.append(f'    "{worker.name}": [...]' + comma)
        lines.append("  },")
        lines.append('  "synthesis": "...",')
        lines.append('  "summary": "..."')
        lines.append("}")
        lines.append("```")
    else:
        lines.append("```json")
        lines.append("{")
        lines.append('  "status": "success|error",')
        lines.append(f'  "agent": "{definition.name}",')
        lines.append('  "results": [...],')
        lines.append('  "summary": "..."')
        lines.append("}")
        lines.append("```")

    lines.append("")
    return "\n".join(lines)


def generate_workers_section(definition: AgentDefinition) -> str:
    """Generate Worker Definitions section for orchestrators."""
    if not definition.workers:
        return ""

    lines = ["## Worker Definitions", ""]

    for worker in definition.workers:
        lines.append(f"### {worker.name}")
        lines.append("")
        lines.append(f"**Role:** {worker.role}")
        lines.append("")
        lines.append(f"**Tools:** {', '.join(worker.tools)}")
        lines.append("")

        if worker.input_format:
            lines.append("**Input:**")
            lines.append("```")
            lines.append(worker.input_format)
            lines.append("```")
            lines.append("")

        if worker.output_format:
            lines.append("**Output:**")
            lines.append("```")
            lines.append(worker.output_format)
            lines.append("```")
            lines.append("")

    return "\n".join(lines)


def generate_agent_file(definition: AgentDefinition, pattern: str = "prompt-chaining") -> str:
    """Generate complete agent file content."""
    parts = []

    # Frontmatter
    parts.append(generate_frontmatter(definition))
    parts.append("")

    # Title
    parts.append(generate_title(definition.name))
    parts.append("")

    # Overview
    parts.append(generate_overview_section(definition))

    # Custom sections
    for section in definition.sections:
        heading = "#" * section.level + " " + section.title
        parts.append(heading)
        parts.append("")
        parts.append(section.content)
        parts.append("")

    # Workflow
    parts.append(generate_workflow_section(definition, pattern))

    # Workers (for orchestrator pattern)
    workers_section = generate_workers_section(definition)
    if workers_section:
        parts.append(workers_section)

    # Examples
    parts.append(generate_examples_section(definition))

    # Output Format
    parts.append(generate_output_section(definition))

    return "\n".join(parts)


def create_definition_from_dict(data: dict[str, Any]) -> AgentDefinition:
    """Create AgentDefinition from dictionary."""
    # Parse tools
    tools = data.get("tools", [])
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",")]

    # Parse workers
    workers = []
    for w in data.get("workers", []):
        worker_tools = w.get("tools", [])
        if isinstance(worker_tools, str):
            worker_tools = [t.strip() for t in worker_tools.split(",")]
        workers.append(WorkerDefinition(
            name=w.get("name", "worker"),
            role=w.get("role", ""),
            tools=worker_tools,
            input_format=w.get("input_format", ""),
            output_format=w.get("output_format", ""),
        ))

    # Parse sections
    sections = []
    for s in data.get("sections", []):
        sections.append(AgentSection(
            title=s.get("title", ""),
            content=s.get("content", ""),
            level=s.get("level", 2),
        ))

    return AgentDefinition(
        name=data.get("name", "unnamed-agent"),
        description=data.get("description", ""),
        tools=tools,
        sections=sections,
        workers=workers,
        examples=data.get("examples", []),
        metadata=data.get("metadata", {}),
    )


def generate(
    name: str,
    description: str,
    tools: list[str],
    pattern: str = "prompt-chaining",
    output_path: str | None = None,
    **kwargs: Any,
) -> tuple[bool, str, str]:
    """
    Generate an agent file.

    Returns:
        (success, content_or_error, output_path)
    """
    # Validate inputs
    valid, error = validate_name(name)
    if not valid:
        return False, f"Invalid name: {error}", ""

    valid, error = validate_description(description)
    if not valid:
        return False, f"Invalid description: {error}", ""

    valid, error, normalized_tools = validate_tools(tools)
    if not valid:
        return False, f"Invalid tools: {error}", ""

    # Create definition
    definition = AgentDefinition(
        name=name,
        description=description,
        tools=normalized_tools,
        sections=kwargs.get("sections", []),
        workers=kwargs.get("workers", []),
        examples=kwargs.get("examples", []),
        metadata=kwargs.get("metadata", {}),
    )

    # Generate content
    content = generate_agent_file(definition, pattern)

    # Write to file if output path specified
    if output_path:
        # Validate output path
        valid, error = validate_path_safe(output_path, [".md", ""])
        if not valid:
            return False, f"Invalid output path: {error}", ""

        path = Path(output_path)
        if path.is_dir():
            path = path / f"{name}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return True, content, str(path)

    return True, content, ""


def load_blueprint_file(filepath: str) -> dict[str, Any]:
    """Safely load a blueprint JSON file."""
    # Validate path
    valid, error = validate_path_safe(filepath, [".json"])
    if not valid:
        raise ValueError(f"Invalid blueprint path: {error}")

    path = Path(filepath).resolve()

    # Additional check: ensure file exists
    if not path.exists():
        raise FileNotFoundError(f"Blueprint file not found: {filepath}")

    if not path.is_file():
        raise ValueError(f"Blueprint path is not a file: {filepath}")

    # Read and parse JSON
    content = path.read_text(encoding="utf-8")
    return json.loads(content)


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate Claude Code agent files")
    parser.add_argument("--name", help="Agent name (hyphen-case)")
    parser.add_argument("--description", help="Agent description")
    parser.add_argument("--tools", help="Comma-separated tool list")
    parser.add_argument("--pattern", default="prompt-chaining",
                       choices=["prompt-chaining", "orchestrator-workers", "routing",
                               "parallelization", "evaluator-optimizer"],
                       help="Workflow pattern")
    parser.add_argument("--json", help="JSON input with all parameters")
    parser.add_argument("--blueprint", help="Path to blueprint JSON file")
    parser.add_argument("--output", help="Output file or directory path")
    parser.add_argument("--validate-only", action="store_true",
                       help="Only validate inputs, don't generate")

    args = parser.parse_args()

    # Parse input
    if args.json:
        data = json.loads(args.json)
    elif args.blueprint:
        try:
            data = load_blueprint_file(args.blueprint)
        except (ValueError, FileNotFoundError) as e:
            print(f"Error loading blueprint: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.name and args.description and args.tools:
        data = {
            "name": args.name,
            "description": args.description,
            "tools": args.tools.split(","),
        }
    else:
        parser.print_help()
        sys.exit(1)

    # Add pattern
    data["pattern"] = args.pattern

    # Validate only
    if args.validate_only:
        definition = create_definition_from_dict(data)
        valid, error = validate_name(definition.name)
        if not valid:
            print(f"FAIL: {error}", file=sys.stderr)
            sys.exit(1)
        valid, error = validate_description(definition.description)
        if not valid:
            print(f"FAIL: {error}", file=sys.stderr)
            sys.exit(1)
        valid, error, _ = validate_tools(definition.tools)
        if not valid:
            print(f"FAIL: {error}", file=sys.stderr)
            sys.exit(1)
        print("PASS: All validations passed")
        sys.exit(0)

    # Generate
    definition = create_definition_from_dict(data)
    success, content, path = generate(
        name=definition.name,
        description=definition.description,
        tools=definition.tools,
        pattern=data.get("pattern", "prompt-chaining"),
        output_path=args.output,
        sections=definition.sections,
        workers=definition.workers,
        examples=definition.examples,
        metadata=definition.metadata,
    )

    if not success:
        print(f"Error: {content}", file=sys.stderr)
        sys.exit(1)

    if path:
        print(f"Generated: {path}")
    else:
        print(content)


if __name__ == "__main__":
    main()
