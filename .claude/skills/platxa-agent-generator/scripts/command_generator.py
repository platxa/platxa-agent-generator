#!/usr/bin/env python3
"""
Slash Command Generator for Agent Invocation

Generates .claude/commands/*.md files that invoke agents with proper
frontmatter and instructions.

Usage:
    python command_generator.py --agent security-scanner --output .claude/commands/
    python command_generator.py --json '{"agent": "code-reviewer", "description": "Review code"}'
    python command_generator.py --agent-file .claude/agents/my-agent.md --output .claude/commands/
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CommandDefinition:
    """Definition for a slash command."""

    name: str
    description: str
    agent_name: str
    argument_hint: str = ""
    allowed_tools: list[str] = field(default_factory=list)
    model: str = ""  # Optional model override
    workflow_steps: list[str] = field(default_factory=list)
    examples: list[dict[str, str]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# Default tools commonly used by agents
DEFAULT_AGENT_TOOLS = ["Read", "Grep", "Glob", "Bash", "Task", "Write", "Edit"]

# Model options
VALID_MODELS = {"haiku", "sonnet", "opus"}


def validate_command_name(name: str) -> tuple[bool, str]:
    """Validate command name format."""
    if not name:
        return False, "Command name cannot be empty"

    if len(name) > 64:
        return False, f"Command name too long ({len(name)} > 64 chars)"

    # Allow lowercase letters, numbers, hyphens
    valid_chars = set("abcdefghijklmnopqrstuvwxyz0123456789-")
    if not all(c in valid_chars for c in name):
        return False, "Command name must contain only lowercase letters, numbers, and hyphens"

    if name.startswith("-") or name.endswith("-"):
        return False, "Command name cannot start or end with hyphen"

    if "--" in name:
        return False, "Command name cannot contain consecutive hyphens"

    return True, ""


def validate_description(description: str) -> tuple[bool, str]:
    """Validate description format."""
    if not description:
        return False, "Description cannot be empty"

    if len(description) > 256:
        return False, f"Description too long ({len(description)} > 256 chars)"

    return True, ""


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


def generate_frontmatter(definition: CommandDefinition) -> str:
    """Generate YAML frontmatter for command file."""
    lines = ["---"]

    # Description (required)
    desc = definition.description
    if '"' in desc or ":" in desc or "\n" in desc:
        desc_escaped = desc.replace('"', '\\"')
        lines.append(f'description: "{desc_escaped}"')
    else:
        lines.append(f"description: {desc}")

    # Argument hint (optional)
    if definition.argument_hint:
        lines.append(f"argument-hint: {definition.argument_hint}")

    # Allowed tools (optional but recommended)
    if definition.allowed_tools:
        tools_json = json.dumps(definition.allowed_tools)
        lines.append(f"allowed-tools: {tools_json}")

    # Model override (optional)
    if definition.model and definition.model in VALID_MODELS:
        lines.append(f"model: {definition.model}")

    lines.append("---")
    return "\n".join(lines)


def generate_title(definition: CommandDefinition) -> str:
    """Generate H1 title from command name."""
    # Convert hyphen-case to Title Case
    words = definition.name.replace("-", " ").title()
    return f"# {words}"


def generate_overview_section(definition: CommandDefinition) -> str:
    """Generate overview section."""
    lines = []
    lines.append(definition.description)
    lines.append("")
    lines.append(f"**Agent:** `{definition.agent_name}`")
    lines.append("")

    if definition.argument_hint:
        lines.append("**Arguments:** $ARGUMENTS")
        lines.append("")

    return "\n".join(lines)


def generate_workflow_section(definition: CommandDefinition) -> str:
    """Generate workflow instructions section."""
    lines = ["## Workflow", ""]

    if definition.workflow_steps:
        for i, step in enumerate(definition.workflow_steps, 1):
            lines.append(f"{i}. {step}")
    else:
        # Default workflow for agent invocation
        lines.append("1. **Parse Arguments**: Process any user-provided arguments")
        lines.append(
            f"2. **Invoke Agent**: Launch the `{definition.agent_name}` agent via Task tool"
        )
        lines.append("3. **Process Results**: Handle agent output and present to user")
        lines.append("4. **Report**: Summarize results and any recommended actions")

    lines.append("")
    return "\n".join(lines)


def generate_invocation_section(definition: CommandDefinition) -> str:
    """Generate agent invocation instructions."""
    lines = ["## Agent Invocation", ""]
    lines.append("Use the Task tool to invoke the agent:")
    lines.append("")
    lines.append("```json")
    lines.append("{")
    lines.append(f'  "subagent_type": "{definition.agent_name}",')
    lines.append(f'  "description": "{definition.description}",')
    lines.append('  "prompt": "User request: $ARGUMENTS\\n\\nExecute the task and return results."')
    lines.append("}")
    lines.append("```")
    lines.append("")

    # Add argument handling if hint provided
    if definition.argument_hint:
        lines.append("### Argument Handling")
        lines.append("")
        lines.append("When `$ARGUMENTS` is provided:")
        lines.append("- Parse the arguments to understand user intent")
        lines.append("- Pass relevant context to the agent")
        lines.append("- Adjust agent behavior based on flags/options")
        lines.append("")
        lines.append("When `$ARGUMENTS` is empty:")
        lines.append("- Use default behavior")
        lines.append("- May prompt user for required information")
        lines.append("")

    return "\n".join(lines)


def generate_examples_section(definition: CommandDefinition) -> str:
    """Generate usage examples section."""
    lines = ["## Usage Examples", ""]

    if definition.examples:
        for example in definition.examples:
            if "title" in example:
                lines.append(f"**{example['title']}:**")
            lines.append("```")
            if "command" in example:
                lines.append(example["command"])
            else:
                lines.append(f"/{definition.name}")
            lines.append("```")
            if "description" in example:
                lines.append(example["description"])
            lines.append("")
    else:
        # Default examples
        lines.append("**Basic usage:**")
        lines.append("```")
        lines.append(f"/{definition.name}")
        lines.append("```")
        lines.append("")

        if definition.argument_hint:
            lines.append("**With arguments:**")
            lines.append("```")
            lines.append(f"/{definition.name} {definition.argument_hint}")
            lines.append("```")
            lines.append("")

    return "\n".join(lines)


def generate_notes_section(definition: CommandDefinition) -> str:
    """Generate notes section if notes are provided."""
    if not definition.notes:
        return ""

    lines = ["## Notes", ""]
    for note in definition.notes:
        lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)


def generate_command_file(definition: CommandDefinition) -> str:
    """Generate complete command file content."""
    parts = []

    # Frontmatter
    parts.append(generate_frontmatter(definition))
    parts.append("")

    # Title
    parts.append(generate_title(definition))
    parts.append("")

    # Overview
    parts.append(generate_overview_section(definition))

    # Workflow
    parts.append(generate_workflow_section(definition))

    # Agent invocation
    parts.append(generate_invocation_section(definition))

    # Examples
    parts.append(generate_examples_section(definition))

    # Notes
    notes = generate_notes_section(definition)
    if notes:
        parts.append(notes)

    return "\n".join(parts)


def create_definition_from_dict(data: dict[str, Any]) -> CommandDefinition:
    """Create CommandDefinition from dictionary."""
    # Handle tools
    tools = data.get("allowed_tools", data.get("tools", DEFAULT_AGENT_TOOLS))
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",")]

    # Determine command name
    name = data.get("name", "")
    agent_name = data.get("agent_name", data.get("agent", ""))

    if not name and agent_name:
        # Default command name to agent name
        name = agent_name

    return CommandDefinition(
        name=name,
        description=data.get("description", f"Invoke the {agent_name} agent"),
        agent_name=agent_name,
        argument_hint=data.get("argument_hint", data.get("argument-hint", "")),
        allowed_tools=tools,
        model=data.get("model", ""),
        workflow_steps=data.get("workflow_steps", []),
        examples=data.get("examples", []),
        notes=data.get("notes", []),
    )


def create_definition_from_agent_file(agent_path: Path) -> CommandDefinition | None:
    """Create CommandDefinition by parsing an existing agent.md file."""
    if not agent_path.exists():
        return None

    content = agent_path.read_text(encoding="utf-8")
    lines = content.split("\n")

    # Parse frontmatter
    if not lines or lines[0].strip() != "---":
        return None

    frontmatter: dict[str, str] = {}
    in_frontmatter = True

    for line in lines[1:]:
        if line.strip() == "---":
            in_frontmatter = False
            continue

        if in_frontmatter and ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            frontmatter[key] = value

    agent_name = frontmatter.get("name", agent_path.stem)
    description = frontmatter.get("description", f"Invoke the {agent_name} agent")
    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",")] if tools_str else DEFAULT_AGENT_TOOLS

    return CommandDefinition(
        name=agent_name,
        description=description,
        agent_name=agent_name,
        argument_hint="[options]",
        allowed_tools=tools,
    )


def generate(
    name: str | None = None,
    agent_name: str | None = None,
    agent_file: str | Path | None = None,
    description: str | None = None,
    definition_dict: dict[str, Any] | None = None,
    output_path: str | None = None,
) -> tuple[bool, str, str]:
    """
    Generate a slash command file.

    Args:
        name: Command name (defaults to agent name)
        agent_name: Name of agent to invoke
        agent_file: Path to agent file to read configuration from
        description: Command description
        definition_dict: Dictionary with full definition
        output_path: Output file or directory path

    Returns:
        (success, content_or_error, output_path)
    """
    definition: CommandDefinition | None = None

    # Create definition from various sources
    if definition_dict:
        definition = create_definition_from_dict(definition_dict)

    elif agent_file:
        agent_path = Path(agent_file)
        if not agent_path.exists():
            return False, f"Agent file not found: {agent_file}", ""
        definition = create_definition_from_agent_file(agent_path)
        if not definition:
            return False, f"Could not parse agent file: {agent_file}", ""

    elif agent_name:
        # Try to find agent file
        for search_dir in [Path(".claude/agents"), Path.home() / ".claude/agents"]:
            agent_path = search_dir / f"{agent_name}.md"
            if agent_path.exists():
                definition = create_definition_from_agent_file(agent_path)
                break

        if not definition:
            # Create minimal definition from name
            definition = CommandDefinition(
                name=name or agent_name,
                description=description or f"Invoke the {agent_name} agent",
                agent_name=agent_name,
                argument_hint="[options]",
                allowed_tools=DEFAULT_AGENT_TOOLS,
            )

    else:
        return False, "Must provide agent_name, agent_file, or definition_dict", ""

    # Override name and description if provided
    if name:
        definition.name = name
    if description:
        definition.description = description

    # Validate
    valid, error = validate_command_name(definition.name)
    if not valid:
        return False, f"Invalid command name: {error}", ""

    valid, error = validate_description(definition.description)
    if not valid:
        return False, f"Invalid description: {error}", ""

    # Generate content
    content = generate_command_file(definition)

    # Write to file if output path specified
    output_file = ""
    if output_path:
        valid, error = validate_path_safe(output_path)
        if not valid:
            return False, f"Invalid output path: {error}", ""

        path = Path(output_path)
        if path.is_dir():
            path = path / f"{definition.name}.md"

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        output_file = str(path)

    return True, content, output_file


# Default project-scope commands directory. Kept here so the companion
# command writer and any downstream tools reference one source of truth.
DEFAULT_COMMANDS_DIR: str = ".claude/commands"


def command_definition_from_agent(definition: Any) -> CommandDefinition:
    """Translate an ``AgentDefinition`` into a ``CommandDefinition``.

    Kept out of agent_generator.py to avoid a module-level import cycle.
    Accepts ``Any`` so command_generator.py has no hard dependency on
    agent_generator — callers pass their AgentDefinition and we read only
    the attributes we need (name, description, tools).

    The generated command routes through the agent via the Task tool,
    wiring ``$ARGUMENTS`` into the agent prompt so users can invoke it
    with arbitrary instructions.
    """
    agent_name = getattr(definition, "name", "")
    description = getattr(definition, "description", f"Invoke the {agent_name} agent")
    tools = list(getattr(definition, "tools", []))
    if not tools:
        tools = list(DEFAULT_AGENT_TOOLS)
    return CommandDefinition(
        name=agent_name,
        description=description,
        agent_name=agent_name,
        argument_hint="[args]",
        allowed_tools=tools,
    )


def should_generate_companion_command(definition: Any) -> bool:
    """Opt-in: companion slash command is written only when the agent asks for it.

    Reads ``definition.user_invocable``. Returning False for agents that
    don't opt in keeps ``.claude/commands/`` focused on things users are
    actually supposed to run — internal agents that orchestrators call
    via Task shouldn't pollute the slash-command namespace.
    """
    return bool(getattr(definition, "user_invocable", False))


def write_companion_command(
    definition: Any,
    commands_dir: Path | str = DEFAULT_COMMANDS_DIR,
    force: bool = False,
) -> Path | None:
    """Write a ``.claude/commands/<name>.md`` wrapping the agent.

    Args:
        definition: AgentDefinition-shaped object. See
            :func:`command_definition_from_agent` for the required
            attribute shape.
        commands_dir: Destination directory. Defaults to
            :data:`DEFAULT_COMMANDS_DIR`. Parents are created as needed.
        force: When True, skip :func:`should_generate_companion_command`
            and always write. Useful when the caller has already made
            the decision (e.g. regeneration workflow).

    Returns:
        The written :class:`~pathlib.Path` on success, ``None`` when
        ``should_generate_companion_command`` returned False and
        ``force=False`` (no file written).
    """
    if not force and not should_generate_companion_command(definition):
        return None

    cmd_def = command_definition_from_agent(definition)
    content = generate_command_file(cmd_def)

    base = Path(commands_dir)
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"{cmd_def.name}.md"
    path.write_text(content, encoding="utf-8")
    return path


# Substring that MUST appear in a companion command file so the command
# forwards user input to the agent. Defined as a module constant so the
# writer and the validator can't drift — a failing validator error
# mentions the same token the generator emits.
REQUIRED_ARGUMENTS_TOKEN: str = "$ARGUMENTS"


def validate_command_file(path: Path | str) -> list[str]:
    """Return a list of error messages for a malformed companion command file.

    Checks:

    - File exists and is readable
    - Starts with ``---`` frontmatter
    - Frontmatter contains ``description:``
    - Body references ``$ARGUMENTS`` so the command forwards user input
    - Body references the agent (``subagent_type`` or an explicit
      ``Use the Task tool to invoke the agent``)

    An empty list means the file is well-formed.
    """
    errors: list[str] = []
    p = Path(path)
    if not p.exists():
        return [f"Command file does not exist: {p}"]
    try:
        text = p.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"Command file unreadable: {p} ({exc})"]
    if not text.startswith("---"):
        errors.append(f"Command file {p} missing YAML frontmatter (must start with '---').")
    else:
        try:
            end = text.index("\n---", 3)
        except ValueError:
            errors.append(f"Command file {p} has an unterminated frontmatter block.")
            end = -1
        frontmatter = text[3:end] if end > 0 else ""
        if "description:" not in frontmatter:
            errors.append(f"Command file {p} frontmatter missing 'description:'.")
    if REQUIRED_ARGUMENTS_TOKEN not in text:
        errors.append(
            f"Command file {p} does not reference '{REQUIRED_ARGUMENTS_TOKEN}' "
            "— commands must forward user input to the agent."
        )
    if "subagent_type" not in text and "Task tool" not in text:
        errors.append(
            f"Command file {p} does not invoke an agent via the Task tool "
            "(no 'subagent_type' or 'Task tool' reference in body)."
        )
    return errors


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate slash commands for agent invocation")
    parser.add_argument("--name", help="Command name (defaults to agent name)")
    parser.add_argument("--agent", help="Agent name to invoke")
    parser.add_argument("--agent-file", help="Path to agent.md file")
    parser.add_argument("--description", help="Command description")
    parser.add_argument("--argument-hint", help="Argument hint for command")
    parser.add_argument("--tools", help="Comma-separated list of allowed tools")
    parser.add_argument("--model", choices=["haiku", "sonnet", "opus"], help="Model override")
    parser.add_argument("--json", help="JSON input with full definition")
    parser.add_argument("--output", "-o", help="Output file or directory path")
    parser.add_argument("--stdout", action="store_true", help="Output to stdout")

    args = parser.parse_args()

    # Parse JSON input
    definition_dict = None
    if args.json:
        definition_dict = json.loads(args.json)
    elif args.agent or args.agent_file:
        definition_dict = {}
        if args.agent:
            definition_dict["agent"] = args.agent
        if args.name:
            definition_dict["name"] = args.name
        if args.description:
            definition_dict["description"] = args.description
        if args.argument_hint:
            definition_dict["argument_hint"] = args.argument_hint
        if args.tools:
            definition_dict["tools"] = args.tools
        if args.model:
            definition_dict["model"] = args.model

    # Determine output
    output_path = None if args.stdout else args.output

    # Generate
    success, result, path = generate(
        name=args.name,
        agent_name=args.agent,
        agent_file=args.agent_file,
        description=args.description,
        definition_dict=definition_dict if definition_dict else None,
        output_path=output_path,
    )

    if not success:
        print(f"Error: {result}", file=sys.stderr)
        sys.exit(1)

    if args.stdout or not output_path:
        print(result)
    else:
        print(f"Generated: {path}")


if __name__ == "__main__":
    main()
