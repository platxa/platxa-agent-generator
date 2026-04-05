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
class TemplateVariables:
    """Configurable template variables for agent customization.

    These variables can be overridden when generating agents to customize
    behavior, limits, and policies without modifying the generator code.
    """

    # Retry configuration
    max_retry_attempts: int = 3
    initial_delay_ms: int = 1000
    max_delay_ms: int = 30000
    backoff_multiplier: float = 2.0
    jitter_factor: float = 0.1

    # Circuit breaker configuration
    circuit_failure_threshold: int = 5
    circuit_success_threshold: int = 3
    circuit_timeout_seconds: int = 60

    # Resource limits
    max_file_lines: int = 10000
    max_files_per_invocation: int = 100
    max_recursion_depth: int = 10
    execution_timeout_seconds: int = 300

    # Security policies
    sensitive_file_patterns: list[str] = field(
        default_factory=lambda: [".env", "*_secret*", "credentials*", "*.key", "*.pem"]
    )
    blocked_commands: list[str] = field(
        default_factory=lambda: ["rm -rf", "format", "drop database", "truncate"]
    )
    allowed_domains: list[str] = field(
        default_factory=lambda: []  # Empty means no restriction
    )

    # Quality thresholds
    min_quality_score: float = 7.0
    min_examples_count: int = 3

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "retry": {
                "max_attempts": self.max_retry_attempts,
                "initial_delay_ms": self.initial_delay_ms,
                "max_delay_ms": self.max_delay_ms,
                "backoff_multiplier": self.backoff_multiplier,
                "jitter_factor": self.jitter_factor,
            },
            "circuit_breaker": {
                "failure_threshold": self.circuit_failure_threshold,
                "success_threshold": self.circuit_success_threshold,
                "timeout_seconds": self.circuit_timeout_seconds,
            },
            "limits": {
                "max_file_lines": self.max_file_lines,
                "max_files_per_invocation": self.max_files_per_invocation,
                "max_recursion_depth": self.max_recursion_depth,
                "execution_timeout_seconds": self.execution_timeout_seconds,
            },
            "security": {
                "sensitive_file_patterns": self.sensitive_file_patterns,
                "blocked_commands": self.blocked_commands,
                "allowed_domains": self.allowed_domains,
            },
            "quality": {
                "min_quality_score": self.min_quality_score,
                "min_examples_count": self.min_examples_count,
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TemplateVariables":
        """Create from dictionary."""
        vars_obj = cls()
        if "retry" in data:
            retry = data["retry"]
            vars_obj.max_retry_attempts = retry.get("max_attempts", vars_obj.max_retry_attempts)
            vars_obj.initial_delay_ms = retry.get("initial_delay_ms", vars_obj.initial_delay_ms)
            vars_obj.max_delay_ms = retry.get("max_delay_ms", vars_obj.max_delay_ms)
            vars_obj.backoff_multiplier = retry.get(
                "backoff_multiplier", vars_obj.backoff_multiplier
            )
            vars_obj.jitter_factor = retry.get("jitter_factor", vars_obj.jitter_factor)
        if "circuit_breaker" in data:
            cb = data["circuit_breaker"]
            vars_obj.circuit_failure_threshold = cb.get(
                "failure_threshold", vars_obj.circuit_failure_threshold
            )
            vars_obj.circuit_success_threshold = cb.get(
                "success_threshold", vars_obj.circuit_success_threshold
            )
            vars_obj.circuit_timeout_seconds = cb.get(
                "timeout_seconds", vars_obj.circuit_timeout_seconds
            )
        if "limits" in data:
            limits = data["limits"]
            vars_obj.max_file_lines = limits.get("max_file_lines", vars_obj.max_file_lines)
            vars_obj.max_files_per_invocation = limits.get(
                "max_files_per_invocation", vars_obj.max_files_per_invocation
            )
            vars_obj.max_recursion_depth = limits.get(
                "max_recursion_depth", vars_obj.max_recursion_depth
            )
            vars_obj.execution_timeout_seconds = limits.get(
                "execution_timeout_seconds", vars_obj.execution_timeout_seconds
            )
        if "security" in data:
            sec = data["security"]
            vars_obj.sensitive_file_patterns = sec.get(
                "sensitive_file_patterns", vars_obj.sensitive_file_patterns
            )
            vars_obj.blocked_commands = sec.get("blocked_commands", vars_obj.blocked_commands)
            vars_obj.allowed_domains = sec.get("allowed_domains", vars_obj.allowed_domains)
        if "quality" in data:
            qual = data["quality"]
            vars_obj.min_quality_score = qual.get("min_quality_score", vars_obj.min_quality_score)
            vars_obj.min_examples_count = qual.get(
                "min_examples_count", vars_obj.min_examples_count
            )
        return vars_obj


# Default template variables (can be overridden per-agent)
DEFAULT_TEMPLATE_VARS = TemplateVariables()


@dataclass
class AgentSection:
    """A section in the agent definition."""

    title: str
    content: str
    level: int = 2  # H2 by default


@dataclass
class ChainStep:
    """A step in a prompt-chaining workflow."""

    name: str
    description: str
    input_from: str = ""  # Previous step or "user_input"
    output_to: str = ""  # Next step or "final_output"
    tools: list[str] = field(default_factory=list)
    validation: str = ""  # Quality gate criteria


@dataclass
class WorkerDefinition:
    """A worker agent for orchestrator pattern."""

    name: str
    role: str
    tools: list[str]
    input_format: str = ""
    output_format: str = ""


# Valid model tiers for Claude Code agents.
# These are the model shorthand values accepted in agent frontmatter.
VALID_MODELS = {
    "haiku",  # Fast, cheap — validators, linters, simple lookups
    "sonnet",  # Balanced — standard agents, code review, analysis
    "opus",  # Most capable — complex orchestrators, architecture decisions
}

# Valid isolation modes for Claude Code agents
VALID_ISOLATION_MODES = {
    "worktree",  # Run in temporary git worktree for safe parallel file operations
}

# Valid effort levels for Claude Code agents (controls extended thinking intensity)
VALID_EFFORT_LEVELS = {
    "low",  # Minimal thinking — fast, cheap operations
    "medium",  # Balanced thinking — standard tasks
    "high",  # Deep thinking — complex reasoning
}

# Valid permission modes for Claude Code agents
VALID_PERMISSION_MODES = {
    "default",  # Standard permission prompts (recommended for most agents)
    "acceptEdits",  # Auto-approve file edits, prompt for Bash/MCP
    "bypassPermissions",  # Skip all permission prompts (use with caution)
    "dontAsk",  # Never prompt — denied tools silently skipped
}


@dataclass
class AgentDefinition:
    """Complete agent definition for file generation."""

    name: str
    description: str
    tools: list[str]
    permission_mode: str | None = None  # One of VALID_PERMISSION_MODES
    max_turns: int | None = None  # Positive integer, limits agent execution length
    model: str | None = None  # One of VALID_MODELS (haiku, sonnet, opus)
    disallowed_tools: list[str] = field(default_factory=list)  # Tools to explicitly deny
    isolation: str | None = None  # One of VALID_ISOLATION_MODES (worktree)
    effort: str | None = None  # One of VALID_EFFORT_LEVELS (low, medium, high)
    background: bool | None = None  # True to run without blocking main conversation
    color: str | None = None  # CSS color string for UI display (e.g. "red", "#ff0000")
    mcp_servers: dict[str, Any] = field(default_factory=dict)  # mcpServers frontmatter block
    recommended_hooks: dict[str, Any] = field(default_factory=dict)  # Companion hooks config
    sections: list[AgentSection] = field(default_factory=list)
    workers: list[WorkerDefinition] = field(default_factory=list)
    chain_steps: list[ChainStep] = field(default_factory=list)
    examples: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    template_vars: TemplateVariables = field(default_factory=TemplateVariables)


# Valid Claude Code tools
VALID_TOOLS = {
    "Read",
    "Write",
    "Edit",
    "Grep",
    "Glob",
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

# Allowed directories for blueprint files
ALLOWED_BLUEPRINT_DIRS = [
    ".claude",
    ".claude/skills",
    ".claude/agents",
    "blueprints",
]


def validate_path_safe(filepath: str, allowed_extensions: list[str]) -> tuple[bool, str]:
    """Validate file path to prevent path traversal attacks."""
    import tempfile

    path = Path(filepath)

    # Check for path traversal attempts
    try:
        resolved = path.resolve()
        # Ensure path is within allowed directories:
        # - Current working directory
        # - User home directory
        # - System temp directory (for testing)
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

    if not re.match(r"^[a-z][a-z0-9-]*[a-z0-9]$", name) and len(name) > 1:
        if not re.match(r"^[a-z][a-z0-9-]*$", name):
            return (
                False,
                "Name must be hyphen-case (lowercase letters, numbers, hyphens)",
            )

    if "--" in name:
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
    """Generate valid YAML frontmatter.

    Emits all Claude Code agent frontmatter fields that are set on the
    definition, in the canonical order: name, description, tools,
    permissionMode, then optional metadata fields.
    """
    lines = ["---"]
    lines.append(f"name: {definition.name}")

    # Escape description if it contains special characters
    desc = definition.description
    if ":" in desc or "\n" in desc or desc.startswith("{") or desc.startswith("["):
        # Use quoted string for complex descriptions
        desc_escaped = desc.replace('"', '\\"')
        lines.append(f'description: "{desc_escaped}"')
    else:
        lines.append(f"description: {desc}")

    # Tools as comma-separated list
    lines.append(f"tools: {', '.join(definition.tools)}")

    # Permission mode — only emit when explicitly set
    if definition.permission_mode and definition.permission_mode in VALID_PERMISSION_MODES:
        lines.append(f"permissionMode: {definition.permission_mode}")

    # Max turns — only emit when explicitly set and valid
    if definition.max_turns is not None and definition.max_turns > 0:
        lines.append(f"maxTurns: {definition.max_turns}")

    # Model tier — only emit when explicitly set
    if definition.model and definition.model in VALID_MODELS:
        lines.append(f"model: {definition.model}")

    # Disallowed tools — defense-in-depth complement to tools list
    if definition.disallowed_tools:
        lines.append(f"disallowedTools: {', '.join(definition.disallowed_tools)}")

    # Isolation mode — only emit when explicitly set
    if definition.isolation and definition.isolation in VALID_ISOLATION_MODES:
        lines.append(f"isolation: {definition.isolation}")

    # Effort level — controls extended thinking intensity
    if definition.effort and definition.effort in VALID_EFFORT_LEVELS:
        lines.append(f"effort: {definition.effort}")

    # Background mode — run without blocking main conversation
    if definition.background is True:
        lines.append("background: true")

    # Color — visual categorization in Claude Code UI
    if definition.color:
        lines.append(f"color: {definition.color}")

    # MCP servers — nested YAML block for external tool integrations
    # Format: mcpServers:\n  server-name:\n    command: ...\n    args: [...]
    if definition.mcp_servers:
        import yaml

        mcp_yaml = yaml.dump(
            {"mcpServers": definition.mcp_servers},
            default_flow_style=False,
            sort_keys=False,
        ).strip()
        lines.append(mcp_yaml)

    # Add metadata if present
    if definition.metadata:
        if "version" in definition.metadata:
            lines.append(f"version: {definition.metadata['version']}")
        if "author" in definition.metadata:
            lines.append(f"author: {definition.metadata['author']}")

    lines.append("---")
    return "\n".join(lines)


# Role-based hook recommendations.
# Maps description keywords to hook types and events.
# Used by recommend_hooks_for_agent() to auto-generate companion hooks config.
ROLE_HOOK_MAP: dict[str, dict[str, Any]] = {
    "security": {
        "hook_types": ["security", "audit"],
        "events": ["PreToolUse", "PostToolUse"],
        "description": "Security validation and audit logging for tool invocations",
    },
    "scanner": {
        "hook_types": ["security", "audit"],
        "events": ["PreToolUse", "PostToolUse"],
        "description": "Scan validation and audit trail",
    },
    "test": {
        "hook_types": ["logging"],
        "events": ["PostToolUse"],
        "description": "Post-execution linting and test result logging",
    },
    "linter": {
        "hook_types": ["logging"],
        "events": ["PostToolUse"],
        "description": "Post-execution lint result logging",
    },
    "reviewer": {
        "hook_types": ["audit", "logging"],
        "events": ["PreToolUse", "PostToolUse"],
        "description": "Audit trail for review actions",
    },
    "deployer": {
        "hook_types": ["audit", "compliance", "security"],
        "events": ["PreToolUse", "PostToolUse", "SessionStart", "Stop"],
        "description": "Full audit trail and compliance checks for deployments",
    },
    "generator": {
        "hook_types": ["logging"],
        "events": ["PostToolUse"],
        "description": "Generation result logging",
    },
    "monitor": {
        "hook_types": ["metrics", "logging"],
        "events": ["SessionStart", "Stop", "PreToolUse", "PostToolUse"],
        "description": "Metrics collection and structured logging",
    },
}


def recommend_hooks_for_agent(
    name: str,
    description: str,
    tools: list[str],
) -> dict[str, Any]:
    """Recommend Claude Code hooks configuration based on agent role.

    Analyzes agent name, description, and tools to determine which lifecycle
    hooks should be configured in settings.json for the agent.

    Claude Code hooks live in settings.json (not agent frontmatter), so this
    produces a companion configuration dict in settings.json hooks format.

    Args:
        name: Agent name (e.g. "security-scanner")
        description: Agent description text
        tools: List of tool names the agent uses

    Returns:
        Dict in Claude Code settings.json hooks format:
        {"PreToolUse": [{"matcher": "...", "hooks": [...]}], ...}
        Empty dict if no hooks recommended.
    """
    combined = f"{name} {description}".lower()

    # Collect all matching role hook configs
    matched_types: set[str] = set()
    matched_events: set[str] = set()

    for role_keyword, config in ROLE_HOOK_MAP.items():
        if role_keyword in combined:
            matched_types.update(config["hook_types"])
            matched_events.update(config["events"])

    # Agents with dangerous tools (Write, Edit, Bash) always get audit hooks
    dangerous_tools = {"Write", "Edit", "MultiEdit", "Bash"}
    if dangerous_tools & set(tools):
        matched_types.add("audit")
        matched_events.update({"PreToolUse", "PostToolUse"})

    if not matched_types:
        return {}

    # Build settings.json hooks format directly — no cross-module import needed.
    # Format: {"EventName": [{"matcher": "", "hooks": [{"type": "command", "command": "..."}]}]}
    hooks_by_event: dict[str, list[dict[str, Any]]] = {}

    for event in sorted(matched_events):
        entries: list[dict[str, Any]] = []

        if "audit" in matched_types:
            log_file = "/tmp/claude-audit.log"
            if event == "PreToolUse":
                cmd = f'echo "[{name}] $(date -Iseconds) PRE_TOOL tool=$CLAUDE_TOOL_NAME" >> {log_file}'
            elif event == "PostToolUse":
                cmd = f'echo "[{name}] $(date -Iseconds) POST_TOOL tool=$CLAUDE_TOOL_NAME" >> {log_file}'
            elif event == "SessionStart":
                cmd = f'echo "[{name}] $(date -Iseconds) SESSION_START user=$USER" >> {log_file}'
            elif event == "Stop":
                cmd = f'echo "[{name}] $(date -Iseconds) SESSION_END" >> {log_file}'
            else:
                cmd = f'echo "[{name}] $(date -Iseconds) {event}" >> {log_file}'
            entries.append(
                {
                    "matcher": "",
                    "hooks": [{"type": "command", "command": cmd}],
                }
            )

        if "security" in matched_types:
            if event == "PreToolUse":
                entries.append(
                    {
                        "matcher": "Write|Edit|MultiEdit|Bash",
                        "hooks": [
                            {
                                "type": "command",
                                "command": f'{name}-security-gate --tool "$CLAUDE_TOOL_NAME" 2>/dev/null || true',
                            }
                        ],
                    }
                )
            elif event == "PostToolUse":
                entries.append(
                    {
                        "matcher": "",
                        "hooks": [
                            {
                                "type": "command",
                                "command": f'{name}-security-audit --tool "$CLAUDE_TOOL_NAME" 2>/dev/null || true',
                            }
                        ],
                    }
                )

        if "logging" in matched_types:
            log_file = f"/tmp/{name}.log"
            cmd = (
                f'echo \'{{"timestamp":"\'$(date -Iseconds)\'","level":"INFO",'
                f'"agent":"{name}","event":"{event}",'
                f'"tool":"\'$CLAUDE_TOOL_NAME\'"}}\' >> {log_file}'
            )
            entries.append(
                {
                    "matcher": "",
                    "hooks": [{"type": "command", "command": cmd}],
                }
            )

        if "compliance" in matched_types:
            entries.append(
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "type": "command",
                            "command": f"{name}-compliance-check --event {event} 2>/dev/null || true",
                        }
                    ],
                }
            )

        if "metrics" in matched_types:
            cmd = (
                f'echo "{name},{event},$(date +%s)" >> /tmp/claude-metrics.csv 2>/dev/null || true'
            )
            entries.append(
                {
                    "matcher": "",
                    "hooks": [{"type": "command", "command": cmd}],
                }
            )

        if entries:
            hooks_by_event[event] = entries

    return hooks_by_event


def generate_hooks_section(hooks_config: dict[str, Any], agent_name: str) -> str:
    """Generate a markdown section documenting recommended hooks.

    This section is appended to the agent definition file as documentation,
    showing the user which hooks to add to their settings.json.

    Args:
        hooks_config: Dict in Claude Code settings.json hooks format
        agent_name: Agent name for documentation

    Returns:
        Markdown string with hooks documentation section, or empty string
        if no hooks to document.
    """
    if not hooks_config:
        return ""

    import json

    lines = [
        "",
        "## Recommended Hooks",
        "",
        f"Add these lifecycle hooks to your `settings.json` for `{agent_name}`:",
        "",
        "```json",
        json.dumps({"hooks": hooks_config}, indent=2),
        "```",
        "",
        "Place in `~/.claude/settings.json` (user scope) "
        "or `.claude/settings.json` (project scope).",
        "",
    ]
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


def generate_workflow_section(definition: AgentDefinition, pattern: str = "prompt-chaining") -> str:
    """Generate Workflow section based on pattern."""
    lines = ["## Workflow", ""]

    if pattern == "orchestrator-workers" and definition.workers:
        lines.append(
            "This agent uses the **orchestrator-workers** pattern with supervisor coordination."
        )
        lines.append("")

        lines.append("### Phase 1: Task Analysis & Decomposition")
        lines.append("")
        lines.append("**Purpose:** Analyze input and decompose into worker subtasks")
        lines.append("")
        lines.append("The supervisor examines the input to:")
        lines.append("1. Identify the scope and complexity of the task")
        lines.append("2. Determine which workers are needed")
        lines.append("3. Define clear boundaries for each worker's responsibility")
        lines.append("4. Establish success criteria for worker outputs")
        lines.append("")

        lines.append("### Phase 2: Worker Dispatch (Parallel)")
        lines.append("")
        lines.append("**Purpose:** Spawn specialized workers with clear mandates")
        lines.append("")
        lines.append("```python")
        lines.append("# Supervisor dispatches workers in parallel")
        for i, worker in enumerate(definition.workers, 1):
            lines.append(f"task_{i} = Task(")
            lines.append(f'    subagent_type="{worker.name}",')
            lines.append(f'    description="{worker.role}",')
            lines.append('    prompt="Process assigned subset with criteria: {criteria}"')
            lines.append(")")
        lines.append("```")
        lines.append("")
        lines.append("**Worker Coordination Rules:**")
        lines.append("- Each worker operates independently on its assigned subset")
        lines.append("- Workers do not communicate directly with each other")
        lines.append("- All coordination flows through the supervisor")
        lines.append("- Workers return structured results for aggregation")
        lines.append("")

        lines.append("### Phase 3: Progress Monitoring")
        lines.append("")
        lines.append("**Purpose:** Track worker progress and handle failures")
        lines.append("")
        lines.append("```")
        lines.append("Supervisor Monitoring:")
        lines.append("  - Poll worker status at regular intervals")
        lines.append("  - Track completion percentage")
        lines.append("  - Detect stalled or failed workers")
        lines.append("  - Reassign work if worker fails (max 2 retries)")
        lines.append("  - Timeout: 5 minutes per worker task")
        lines.append("```")
        lines.append("")

        lines.append("### Phase 4: Result Synthesis")
        lines.append("")
        lines.append("**Purpose:** Aggregate and validate worker outputs")
        lines.append("")
        lines.append("The supervisor:")
        lines.append("1. Collects results from all workers")
        lines.append("2. Validates each result against expected schema")
        lines.append("3. Resolves conflicts between overlapping results")
        lines.append("4. Merges results into unified output")
        lines.append("5. Applies final quality checks")
        lines.append("")

        lines.append("### Data Flow Diagram")
        lines.append("")
        lines.append("```")
        lines.append("                    ┌─────────────┐")
        lines.append("                    │  Supervisor │")
        lines.append("                    │  (Analysis) │")
        lines.append("                    └──────┬──────┘")
        lines.append("                           │")
        lines.append("           ┌───────────────┼───────────────┐")
        lines.append("           ▼               ▼               ▼")
        worker_boxes = []
        for worker in definition.workers[:3]:  # Show max 3 workers
            worker_boxes.append(f"    [{worker.name[:12]}]")
        if len(definition.workers) > 3:
            worker_boxes.append("    [...]")
        lines.append("  " + "     ".join(worker_boxes) if worker_boxes else "    [Workers]")
        lines.append("           │               │               │")
        lines.append("           └───────────────┼───────────────┘")
        lines.append("                           ▼")
        lines.append("                    ┌─────────────┐")
        lines.append("                    │  Supervisor │")
        lines.append("                    │ (Synthesis) │")
        lines.append("                    └─────────────┘")
        lines.append("```")

    elif pattern == "prompt-chaining":
        # Generate proper prompt-chaining workflow
        lines.extend(_generate_prompt_chaining_workflow(definition))

    elif pattern == "routing":
        lines.append("### Step 1: Classification")
        lines.append("Analyze input to determine the appropriate handler.")
        lines.append("")
        lines.append("### Step 2: Route")
        lines.append("Direct to specialized processing based on classification:")
        lines.append("")
        lines.append("| Input Type | Handler | Tools |")
        lines.append("|------------|---------|-------|")
        lines.append("| Type A | Handler A | Read, Grep |")
        lines.append("| Type B | Handler B | Write, Edit |")
        lines.append("| Default | Fallback | Read |")
        lines.append("")
        lines.append("### Step 3: Process")
        lines.append("Execute the selected handler and return results.")

    elif pattern == "parallelization":
        lines.append("### Step 1: Decompose")
        lines.append("Break input into independent subtasks.")
        lines.append("")
        lines.append("### Step 2: Parallel Execution")
        lines.append("Execute subtasks concurrently using Task tool:")
        lines.append("")
        lines.append("```")
        lines.append("# Launch parallel tasks")
        lines.append("Task 1: { subtask_1 }")
        lines.append("Task 2: { subtask_2 }")
        lines.append("Task N: { subtask_n }")
        lines.append("```")
        lines.append("")
        lines.append("### Step 3: Aggregate")
        lines.append("Combine results from all parallel tasks.")

    elif pattern == "evaluator-optimizer":
        lines.append("This agent uses the **evaluator-optimizer** pattern with iteration tracking.")
        lines.append("")

        lines.append("### Iteration Configuration")
        lines.append("")
        lines.append("```")
        lines.append("Iteration Limits:")
        lines.append("  max_iterations: 5")
        lines.append("  min_quality_score: 8.0  # Out of 10")
        lines.append("  improvement_threshold: 0.5  # Minimum improvement per iteration")
        lines.append("  timeout_per_iteration: 60s")
        lines.append("")
        lines.append("Termination Conditions:")
        lines.append("  - Quality score >= min_quality_score")
        lines.append("  - Max iterations reached")
        lines.append("  - Improvement < threshold (plateau)")
        lines.append("  - Timeout exceeded")
        lines.append("```")
        lines.append("")

        lines.append("### Step 1: Generate Initial Output")
        lines.append("")
        lines.append("**Purpose:** Produce first-pass output based on input")
        lines.append("")
        lines.append("```")
        lines.append("iteration = 0")
        lines.append("output = generate(input)")
        lines.append("history = []  # Track all iterations")
        lines.append("```")
        lines.append("")

        lines.append("### Step 2: Evaluate Quality")
        lines.append("")
        lines.append("**Purpose:** Assess output against defined criteria")
        lines.append("")
        lines.append("```")
        lines.append("Evaluation Criteria (weighted):")
        lines.append("  - Correctness (30%): Does it meet requirements?")
        lines.append("  - Completeness (25%): Are all aspects addressed?")
        lines.append("  - Quality (25%): Does it meet standards?")
        lines.append("  - Efficiency (20%): Is the solution optimal?")
        lines.append("")
        lines.append("evaluation = evaluate(output)")
        lines.append("score = calculate_weighted_score(evaluation)")
        lines.append("history.append({iteration, output, score, evaluation})")
        lines.append("```")
        lines.append("")

        lines.append("### Step 3: Optimize (Iterative)")
        lines.append("")
        lines.append("**Purpose:** Refine output based on evaluation feedback")
        lines.append("")
        lines.append("```python")
        lines.append("while score < min_quality_score and iteration < max_iterations:")
        lines.append("    iteration += 1")
        lines.append("    ")
        lines.append("    # Generate improvement prompt from evaluation")
        lines.append("    feedback = format_feedback(evaluation)")
        lines.append("    improvement_hints = identify_weak_areas(evaluation)")
        lines.append("    ")
        lines.append("    # Optimize with targeted feedback")
        lines.append("    output = optimize(output, feedback, improvement_hints)")
        lines.append("    ")
        lines.append("    # Re-evaluate")
        lines.append("    evaluation = evaluate(output)")
        lines.append("    new_score = calculate_weighted_score(evaluation)")
        lines.append("    ")
        lines.append("    # Check for improvement plateau")
        lines.append("    if new_score - score < improvement_threshold:")
        lines.append("        break  # No significant improvement")
        lines.append("    ")
        lines.append("    score = new_score")
        lines.append("    history.append({iteration, output, score, evaluation})")
        lines.append("```")
        lines.append("")

        lines.append("### Step 4: Finalize & Report")
        lines.append("")
        lines.append("**Purpose:** Return best output with iteration summary")
        lines.append("")
        lines.append("```json")
        lines.append("{")
        lines.append('  "final_output": "...",')
        lines.append('  "final_score": 8.5,')
        lines.append('  "iterations_used": 3,')
        lines.append('  "improvement_history": [')
        lines.append('    {"iteration": 0, "score": 6.2},')
        lines.append('    {"iteration": 1, "score": 7.4},')
        lines.append('    {"iteration": 2, "score": 8.1},')
        lines.append('    {"iteration": 3, "score": 8.5}')
        lines.append("  ],")
        lines.append('  "termination_reason": "quality_threshold_met"')
        lines.append("}")
        lines.append("```")
        lines.append("")

        lines.append("### Feedback Loop Diagram")
        lines.append("")
        lines.append("```")
        lines.append("┌─────────────────────────────────────────────────────┐")
        lines.append("│                                                     │")
        lines.append("│   ┌──────────┐    ┌──────────┐    ┌──────────┐     │")
        lines.append("│   │ Generate │───▶│ Evaluate │───▶│ Quality  │     │")
        lines.append("│   └──────────┘    └──────────┘    │   OK?    │     │")
        lines.append("│        ▲                          └────┬─────┘     │")
        lines.append("│        │                               │           │")
        lines.append("│        │         ┌──────────┐     No   │  Yes      │")
        lines.append("│        └─────────│ Optimize │◀─────────┘   │       │")
        lines.append("│                  └──────────┘              ▼       │")
        lines.append("│                                       ┌────────┐   │")
        lines.append("│                                       │ Output │   │")
        lines.append("│                                       └────────┘   │")
        lines.append("└─────────────────────────────────────────────────────┘")
        lines.append("```")

    else:
        # Fallback for unknown patterns
        lines.append("1. **Initialize**: Prepare for task execution")
        lines.append("2. **Execute**: Perform main task logic")
        lines.append("3. **Validate**: Verify results")
        lines.append("4. **Output**: Format and return results")

    lines.append("")
    return "\n".join(lines)


def _get_tool_call_example(tool: str, step_name: str) -> str:
    """Generate contextual tool call example for a workflow step."""
    step_lower = step_name.lower()

    examples = {
        "Read": {
            "discovery": 'Read(file_path="src/main.py")  # Load source file',
            "research": 'Read(file_path="docs/api.md")  # Read documentation',
            "load": 'Read(file_path="data/input.json")  # Load input data',
            "diagnose": 'Read(file_path="logs/error.log")  # Examine logs',
            "default": 'Read(file_path="target/file.py")  # Read target file',
        },
        "Grep": {
            "discovery": 'Grep(pattern="class.*:", path="src/")  # Find classes',
            "search": 'Grep(pattern="TODO|FIXME", path=".")  # Find todos',
            "diagnose": 'Grep(pattern="error|exception", path="logs/")  # Find errors',
            "default": 'Grep(pattern="pattern", path="src/")  # Search content',
        },
        "Glob": {
            "discovery": 'Glob(pattern="**/*.py")  # Find Python files',
            "scope": 'Glob(pattern="src/**/*.ts")  # Find TypeScript files',
            "setup": 'Glob(pattern="**/test_*.py")  # Find test files',
            "default": 'Glob(pattern="**/*.py")  # Find matching files',
        },
        "Bash": {
            "execute": 'Bash(command="pytest tests/ -v")  # Run tests',
            "verify": 'Bash(command="pyright .")  # Type check',
            "setup": 'Bash(command="pip install -r requirements.txt")  # Install deps',
            "default": 'Bash(command="echo $PWD")  # Execute command',
        },
        "Write": {
            "generate": 'Write(file_path="output/report.md", content="...")  # Create file',
            "output": 'Write(file_path="results.json", content="...")  # Write results',
            "default": 'Write(file_path="output.txt", content="...")  # Create file',
        },
        "Edit": {
            "implement": 'Edit(file_path="src/main.py", old_string="...", new_string="...")',
            "transform": 'Edit(file_path="config.json", old_string="...", new_string="...")',
            "default": 'Edit(file_path="file.py", old_string="old", new_string="new")',
        },
        "Task": {
            "default": 'Task(subagent_type="specialist", prompt="Analyze...")',
        },
        "WebSearch": {
            "research": 'WebSearch(query="best practices for...")  # Find info',
            "default": 'WebSearch(query="topic documentation 2024")',
        },
        "WebFetch": {
            "research": 'WebFetch(url="https://docs.example.com", prompt="Extract...")',
            "default": 'WebFetch(url="https://example.com", prompt="Summarize")',
        },
    }

    if tool in examples:
        tool_examples = examples[tool]
        # Find matching step or use default
        for key in tool_examples:
            if key in step_lower:
                return tool_examples[key]
        return tool_examples.get("default", f"{tool}(...)  # Execute {tool}")

    return f"{tool}(...)  # Execute {tool} operation"


def _generate_prompt_chaining_workflow(definition: AgentDefinition) -> list[str]:
    """Generate prompt-chaining workflow with proper step sequencing and data flow."""
    lines: list[str] = []

    if definition.chain_steps:
        # Use defined chain steps
        lines.append("This agent uses a **prompt-chaining** pattern where each step's output")
        lines.append("becomes the input for the next step, ensuring quality at each stage.")
        lines.append("")

        for i, step in enumerate(definition.chain_steps, 1):
            lines.append(f"### Step {i}: {step.name}")
            lines.append("")
            lines.append(f"**Purpose:** {step.description}")
            lines.append("")

            # Input specification
            if i == 1:
                input_source = step.input_from or "User request"
            else:
                input_source = step.input_from or f"Output from Step {i - 1}"
            lines.append(f"**Input:** {input_source}")

            # Tools used in this step
            if step.tools:
                lines.append(f"**Tools:** {', '.join(step.tools)}")

            # Output specification
            if i == len(definition.chain_steps):
                output_dest = step.output_to or "Final result"
            else:
                output_dest = step.output_to or f"Input to Step {i + 1}"
            lines.append(f"**Output:** {output_dest}")
            lines.append("")

            # Quality gate
            if step.validation:
                lines.append(f"**Quality Gate:** {step.validation}")
                lines.append("")
                lines.append("```")
                lines.append("IF validation fails:")
                lines.append("  - Log issue")
                lines.append("  - Retry with adjusted parameters")
                lines.append("  - Escalate if retry limit reached")
                lines.append("```")
                lines.append("")

        # Add data flow diagram
        lines.append("### Data Flow")
        lines.append("")
        lines.append("```")
        flow_parts = ["[Input]"]
        for step in definition.chain_steps:
            flow_parts.append(f"[{step.name}]")
        flow_parts.append("[Output]")
        lines.append(" → ".join(flow_parts))
        lines.append("```")

    else:
        # Generate default prompt-chaining workflow based on agent description
        lines.append("This agent uses a **prompt-chaining** pattern for sequential task execution.")
        lines.append("")

        # Analyze description to generate appropriate steps
        default_steps = _infer_chain_steps_from_description(
            definition.description, definition.tools
        )

        for i, (step_name, step_desc, step_tools) in enumerate(default_steps, 1):
            lines.append(f"### Step {i}: {step_name}")
            lines.append("")
            lines.append(f"**Purpose:** {step_desc}")
            lines.append("")

            if i == 1:
                lines.append("**Input:** User request and context")
            else:
                lines.append(f"**Input:** Output from Step {i - 1}")

            if step_tools:
                lines.append(f"**Tools:** {', '.join(step_tools)}")

            if i == len(default_steps):
                lines.append("**Output:** Final formatted result")
            else:
                lines.append(f"**Output:** Processed data for Step {i + 1}")

            lines.append("")

            # Add example tool calls for this step
            if step_tools:
                lines.append("**Example Tool Calls:**")
                lines.append("```")
                for tool in step_tools[:2]:  # Show max 2 examples
                    example = _get_tool_call_example(tool, step_name)
                    lines.append(example)
                lines.append("```")
                lines.append("")

            # Add quality gate for each step
            lines.append("**Quality Gate:**")
            lines.append("```")
            lines.append(f"Validate {step_name.lower()} output before proceeding:")
            lines.append("  - Check completeness")
            lines.append("  - Verify format")
            lines.append("  - Confirm no errors")
            lines.append("```")
            lines.append("")

        # Data flow diagram
        lines.append("### Data Flow")
        lines.append("")
        lines.append("```")
        flow_parts = ["[Input]"] + [f"[{s[0]}]" for s in default_steps] + ["[Output]"]
        lines.append(" → ".join(flow_parts))
        lines.append("```")

    return lines


def _infer_chain_steps_from_description(
    description: str, tools: list[str]
) -> list[tuple[str, str, list[str]]]:
    """Infer chain steps from agent description and tools."""
    desc_lower = description.lower()
    steps: list[tuple[str, str, list[str]]] = []

    # Categorize tools for step assignment
    read_tools = [t for t in tools if t in {"Read", "Grep", "Glob", "WebFetch", "WebSearch"}]
    write_tools = [t for t in tools if t in {"Write", "Edit", "NotebookEdit"}]
    exec_tools = [t for t in tools if t in {"Bash", "Task", "LSP"}]

    # Analysis/research agents
    if any(word in desc_lower for word in ["analyze", "review", "examine", "inspect", "audit"]):
        steps.append(
            (
                "Discovery",
                "Gather relevant files and context",
                read_tools or ["Read", "Glob"],
            )
        )
        steps.append(
            (
                "Analysis",
                "Perform detailed examination of gathered data",
                read_tools or ["Read", "Grep"],
            )
        )
        steps.append(("Synthesis", "Compile findings into structured report", []))

    # Generator/builder agents
    elif any(word in desc_lower for word in ["generate", "create", "build", "produce", "write"]):
        steps.append(
            (
                "Research",
                "Understand requirements and existing patterns",
                read_tools or ["Read", "Grep"],
            )
        )
        steps.append(("Design", "Plan the structure and approach", []))
        steps.append(("Generate", "Create the output artifact", write_tools or ["Write"]))
        steps.append(("Validate", "Verify output meets requirements", read_tools or ["Read"]))

    # Transformer/processor agents
    elif any(
        word in desc_lower for word in ["transform", "convert", "process", "migrate", "refactor"]
    ):
        steps.append(("Load", "Read and parse input data", read_tools or ["Read"]))
        steps.append(("Transform", "Apply transformations to data", []))
        steps.append(("Output", "Write transformed result", write_tools or ["Write"]))

    # Test/validation agents
    elif any(word in desc_lower for word in ["test", "validate", "verify", "check"]):
        steps.append(
            (
                "Setup",
                "Prepare test environment and gather targets",
                read_tools or ["Read", "Glob"],
            )
        )
        steps.append(("Execute", "Run validation checks", exec_tools or ["Bash"]))
        steps.append(("Report", "Format and return results", []))

    # Search/find agents
    elif any(word in desc_lower for word in ["search", "find", "locate", "discover"]):
        steps.append(("Scope", "Define search parameters and boundaries", []))
        steps.append(("Search", "Execute search across targets", read_tools or ["Grep", "Glob"]))
        steps.append(("Filter", "Refine and rank results", []))
        steps.append(("Present", "Format results for user", []))

    # Fix/repair/debug agents
    elif any(word in desc_lower for word in ["fix", "repair", "debug", "resolve", "correct"]):
        steps.append(
            (
                "Diagnose",
                "Identify the root cause of the issue",
                read_tools or ["Read", "Grep"],
            )
        )
        steps.append(("Plan", "Design the fix approach", []))
        steps.append(("Implement", "Apply the fix", write_tools or ["Edit"]))
        steps.append(("Verify", "Confirm the fix resolves the issue", exec_tools or ["Bash"]))

    # Default generic workflow
    else:
        steps.append(
            (
                "Initialize",
                "Prepare context and validate inputs",
                read_tools[:1] if read_tools else [],
            )
        )
        steps.append(("Process", "Execute main task logic", exec_tools[:1] if exec_tools else []))
        steps.append(("Validate", "Verify results meet requirements", []))
        steps.append(
            (
                "Finalize",
                "Format and return output",
                write_tools[:1] if write_tools else [],
            )
        )

    return steps


def generate_examples_section(definition: AgentDefinition) -> str:
    """Generate Examples section with 3 examples: basic, advanced, edge case."""
    lines = ["## Examples", ""]

    if definition.examples and len(definition.examples) >= 3:
        # Use provided examples
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
        # Generate 3 comprehensive examples based on agent description and tools
        examples = _generate_three_examples(definition)
        for title, content in examples:
            lines.append(f"### {title}")
            lines.append("")
            lines.extend(content)
            lines.append("")

    return "\n".join(lines)


def _generate_three_examples(
    definition: AgentDefinition,
) -> list[tuple[str, list[str]]]:
    """Generate three examples: basic usage, advanced orchestration, edge case handling."""
    examples: list[tuple[str, list[str]]] = []
    desc_lower = definition.description.lower()
    tools = definition.tools

    # Determine agent category for contextual examples
    is_analysis = any(w in desc_lower for w in ["analyze", "review", "examine", "inspect", "audit"])
    is_generator = any(w in desc_lower for w in ["generate", "create", "build", "produce", "write"])
    is_search = any(w in desc_lower for w in ["search", "find", "locate", "discover"])
    is_fix = any(w in desc_lower for w in ["fix", "repair", "debug", "resolve"])

    # Example 1: Basic Usage
    basic_content: list[str] = []
    basic_content.append("**User Request:**")
    basic_content.append("```")
    if is_analysis:
        basic_content.append(f"Use {definition.name} to review the authentication module")
    elif is_generator:
        basic_content.append(f"Use {definition.name} to create a user validation component")
    elif is_search:
        basic_content.append(f"Use {definition.name} to find all API endpoint definitions")
    elif is_fix:
        basic_content.append(f"Use {definition.name} to debug the failing login test")
    else:
        basic_content.append(f"Use {definition.name} to process the target file")
    basic_content.append("```")
    basic_content.append("")
    basic_content.append("**Agent Actions:**")
    if "Read" in tools or "Glob" in tools:
        basic_content.append("1. Scan target directory for relevant files")
    else:
        basic_content.append("1. Analyze input parameters")
    basic_content.append("2. Execute primary task logic")
    basic_content.append("3. Validate results against requirements")
    basic_content.append("4. Return structured output")
    basic_content.append("")
    basic_content.append("**Expected Output:**")
    basic_content.append("```json")
    basic_content.append("{")
    basic_content.append('  "status": "success",')
    basic_content.append(f'  "agent": "{definition.name}",')
    basic_content.append('  "files_processed": 3,')
    basic_content.append('  "results": ["item1", "item2", "item3"],')
    basic_content.append('  "summary": "Completed successfully"')
    basic_content.append("}")
    basic_content.append("```")
    examples.append(("Example 1: Basic Usage", basic_content))

    # Example 2: Advanced Orchestration (multi-file or complex scenario)
    advanced_content: list[str] = []
    advanced_content.append("**User Request:**")
    advanced_content.append("```")
    if is_analysis:
        advanced_content.append(
            f"Use {definition.name} to perform a comprehensive security audit "
            "across all modules with dependency analysis"
        )
    elif is_generator:
        advanced_content.append(
            f"Use {definition.name} to create a complete CRUD API "
            "with validation, error handling, and tests"
        )
    elif is_search:
        advanced_content.append(
            f"Use {definition.name} to find all usages of deprecated APIs "
            "and suggest modern alternatives"
        )
    elif is_fix:
        advanced_content.append(
            f"Use {definition.name} to identify and fix all memory leaks "
            "in the data processing pipeline"
        )
    else:
        advanced_content.append(
            f"Use {definition.name} to process multiple interconnected targets "
            "with full dependency resolution"
        )
    advanced_content.append("```")
    advanced_content.append("")
    advanced_content.append("**Agent Actions:**")
    advanced_content.append("1. Map all target components and their dependencies")
    advanced_content.append("2. Create execution plan with proper ordering")
    if "Task" in tools:
        advanced_content.append("3. Spawn parallel workers for independent subtasks")
        advanced_content.append("4. Coordinate results from all workers")
    else:
        advanced_content.append("3. Process each component in dependency order")
        advanced_content.append("4. Cross-reference results for consistency")
    advanced_content.append("5. Generate comprehensive report with recommendations")
    advanced_content.append("")
    advanced_content.append("**Expected Output:**")
    advanced_content.append("```json")
    advanced_content.append("{")
    advanced_content.append('  "status": "success",')
    advanced_content.append(f'  "agent": "{definition.name}",')
    advanced_content.append('  "components_analyzed": 12,')
    advanced_content.append('  "issues_found": 3,')
    advanced_content.append('  "recommendations": [')
    advanced_content.append('    "Refactor module A for better separation",')
    advanced_content.append('    "Add input validation to handler B",')
    advanced_content.append('    "Consider caching for performance"')
    advanced_content.append("  ],")
    advanced_content.append('  "execution_time_ms": 4523')
    advanced_content.append("}")
    advanced_content.append("```")
    examples.append(("Example 2: Advanced Orchestration", advanced_content))

    # Example 3: Edge Case Handling
    edge_content: list[str] = []
    edge_content.append("**User Request:**")
    edge_content.append("```")
    edge_content.append(f"Use {definition.name} on an empty directory with no matching files")
    edge_content.append("```")
    edge_content.append("")
    edge_content.append("**Agent Actions:**")
    edge_content.append("1. Attempt to locate target files")
    edge_content.append("2. Detect empty result set")
    edge_content.append("3. Apply graceful degradation strategy")
    edge_content.append("4. Return informative response without error")
    edge_content.append("")
    edge_content.append("**Expected Output:**")
    edge_content.append("```json")
    edge_content.append("{")
    edge_content.append('  "status": "success",')
    edge_content.append(f'  "agent": "{definition.name}",')
    edge_content.append('  "files_processed": 0,')
    edge_content.append('  "results": [],')
    edge_content.append('  "message": "No matching files found in target directory",')
    edge_content.append('  "suggestions": [')
    edge_content.append('    "Verify the target path is correct",')
    edge_content.append('    "Check file extension filters",')
    edge_content.append('    "Ensure files are not in .gitignore"')
    edge_content.append("  ]")
    edge_content.append("}")
    edge_content.append("```")
    examples.append(("Example 3: Edge Case Handling", edge_content))

    return examples


def generate_prerequisites_section(definition: AgentDefinition) -> str:
    """Generate Prerequisites section with dependencies, permissions, and environment requirements."""
    lines = ["## Prerequisites", ""]

    # Analyze tools to determine prerequisites
    tools = definition.tools
    has_bash = "Bash" in tools
    has_write = "Write" in tools or "Edit" in tools
    has_web = "WebSearch" in tools or "WebFetch" in tools
    has_task = "Task" in tools

    lines.append("### Required Permissions")
    lines.append("")
    if has_bash:
        lines.append("- **Bash execution**: Shell command access required")
    if has_write:
        lines.append(
            "- **File write access**: Ability to create/modify files in target directories"
        )
    if has_web:
        lines.append("- **Network access**: Internet connectivity for web searches/fetches")
    if has_task:
        lines.append("- **Subagent spawning**: Permission to launch Task subagents")
    if not any([has_bash, has_write, has_web, has_task]):
        lines.append("- **Read access**: Ability to read files in target directories")
    lines.append("")

    lines.append("### Environment Requirements")
    lines.append("")
    lines.append("- Claude Code CLI installed and configured")
    lines.append("- Valid API key with sufficient quota")
    if has_bash:
        lines.append("- Target system has required CLI tools available")
    lines.append("")

    lines.append("### Dependencies")
    lines.append("")
    lines.append("- No external dependencies required")
    if has_task:
        lines.append("- Subagent definitions must be accessible")
    lines.append("")

    return "\n".join(lines)


def generate_error_handling_section(
    definition: AgentDefinition,
) -> str:
    """Generate Error Handling section with failure modes, recovery strategies, and retry patterns.

    Uses template variables for configurable values.
    """
    tv = definition.template_vars
    lines = ["## Error Handling", ""]

    lines.append("### Failure Modes")
    lines.append("")
    lines.append("| Error Type | Cause | Recovery Strategy |")
    lines.append("|------------|-------|-------------------|")
    lines.append("| File not found | Target path invalid | Validate path, suggest alternatives |")
    lines.append(
        "| Permission denied | Insufficient access | Report and skip, continue with accessible files |"
    )
    lines.append("| Timeout | Operation took too long | Retry with smaller scope |")
    lines.append("| Invalid input | Malformed request | Return validation errors with examples |")
    lines.append("| Rate limit | API quota exceeded | Exponential backoff with jitter |")
    lines.append("| Service unavailable | External dependency down | Circuit breaker pattern |")
    lines.append("")

    lines.append("### Retry Strategy (Exponential Backoff with Jitter)")
    lines.append("")
    lines.append("```")
    lines.append("Retry Configuration:")
    lines.append(f"  max_attempts: {tv.max_retry_attempts}")
    lines.append(f"  initial_delay_ms: {tv.initial_delay_ms}")
    lines.append(f"  max_delay_ms: {tv.max_delay_ms}")
    lines.append(f"  backoff_multiplier: {tv.backoff_multiplier}")
    lines.append(
        f"  jitter_factor: {tv.jitter_factor}  # ±{int(tv.jitter_factor * 100)}% randomization"
    )
    lines.append("  ")
    lines.append("Retry Logic:")
    lines.append("  1. Catch transient error (timeout, 5xx, network)")
    lines.append("  2. Check if error is retryable (not 4xx client errors)")
    lines.append("  3. Calculate delay:")
    lines.append("     base_delay = min(initial_delay * (backoff ^ attempt), max_delay)")
    lines.append("     jitter = base_delay * jitter_factor * random(-1, 1)")
    lines.append("     actual_delay = base_delay + jitter")
    lines.append("  4. Wait for actual_delay")
    lines.append("  5. Retry operation")
    lines.append("  6. If max_attempts reached, trigger circuit breaker")
    lines.append("```")
    lines.append("")

    lines.append("### Circuit Breaker Pattern")
    lines.append("")
    lines.append("Prevents cascading failures by stopping requests to failing services.")
    lines.append("")
    lines.append("```")
    lines.append("Circuit Breaker Configuration:")
    lines.append(
        f"  failure_threshold: {tv.circuit_failure_threshold}      # Failures before opening circuit"
    )
    lines.append(
        f"  success_threshold: {tv.circuit_success_threshold}      # Successes before closing circuit"
    )
    lines.append(
        f"  timeout_seconds: {tv.circuit_timeout_seconds}       # Time before attempting recovery"
    )
    lines.append("  half_open_max_calls: 3    # Test calls in half-open state")
    lines.append("")
    lines.append("States:")
    lines.append("  CLOSED (normal operation)")
    lines.append("    │")
    lines.append("    │ failure_count >= failure_threshold")
    lines.append("    ▼")
    lines.append("  OPEN (rejecting requests)")
    lines.append("    │")
    lines.append("    │ timeout_seconds elapsed")
    lines.append("    ▼")
    lines.append("  HALF-OPEN (testing recovery)")
    lines.append("    │")
    lines.append("    ├─ success_count >= success_threshold → CLOSED")
    lines.append("    └─ any failure → OPEN")
    lines.append("")
    lines.append("Behavior by State:")
    lines.append("  CLOSED:    Execute normally, track failures")
    lines.append("  OPEN:      Fail fast, return cached/default response")
    lines.append("  HALF-OPEN: Allow limited test requests")
    lines.append("```")
    lines.append("")

    lines.append("### Graceful Degradation")
    lines.append("")
    lines.append("When partial failures occur:")
    lines.append("1. Complete all successful operations")
    lines.append("2. Log failed operations with reasons")
    lines.append("3. Return partial results with clear failure indicators")
    lines.append("4. Provide actionable suggestions for failed items")
    lines.append("5. Cache successful results for potential retry")
    lines.append("")

    lines.append("### Fallback Strategies")
    lines.append("")
    lines.append("| Scenario | Primary | Fallback |")
    lines.append("|----------|---------|----------|")
    lines.append("| External API down | Live API call | Cached response |")
    lines.append("| File inaccessible | Read file | Report and skip |")
    lines.append("| Search timeout | Full search | Partial results |")
    lines.append("| Subagent failure | Delegate task | Handle locally |")
    lines.append("")

    return "\n".join(lines)


def generate_edge_cases_section(definition: AgentDefinition) -> str:
    """Generate Edge Cases section documenting boundary conditions and special scenarios."""
    lines = ["## Edge Cases", ""]

    desc_lower = definition.description.lower()

    lines.append("### Boundary Conditions")
    lines.append("")
    lines.append("| Scenario | Expected Behavior |")
    lines.append("|----------|-------------------|")
    lines.append("| Empty input | Return success with empty results and helpful message |")
    lines.append("| Single item | Process normally, skip aggregation logic |")
    lines.append(
        "| Very large input (>1000 items) | Process in batches, provide progress updates |"
    )
    lines.append("| Deeply nested structures | Apply recursion limit (max 10 levels) |")
    lines.append("| Circular references | Detect and break cycles, report affected items |")
    lines.append("")

    lines.append("### Special Scenarios")
    lines.append("")

    # Context-aware edge cases
    if any(w in desc_lower for w in ["file", "read", "code", "source"]):
        lines.append("- **Binary files**: Skip with warning, do not attempt to process")
        lines.append("- **Symlinks**: Follow by default, detect cycles")
        lines.append("- **Hidden files**: Include unless explicitly excluded")
    if any(w in desc_lower for w in ["api", "web", "network", "fetch"]):
        lines.append("- **Slow responses**: Apply timeout, retry with backoff")
        lines.append("- **Redirects**: Follow up to 5 hops, then fail")
        lines.append("- **SSL errors**: Report clearly, do not bypass")
    if any(w in desc_lower for w in ["generate", "create", "write"]):
        lines.append("- **Existing files**: Prompt before overwrite (unless --force)")
        lines.append("- **Invalid characters**: Sanitize filenames automatically")
        lines.append("- **Disk full**: Fail fast with clear error message")

    # Default edge cases
    lines.append("- **Unicode content**: Handle UTF-8 encoding properly")
    lines.append("- **Concurrent access**: Use file locking where appropriate")
    lines.append("- **Interrupted operation**: Support resume from checkpoint")
    lines.append("")

    return "\n".join(lines)


def generate_security_section(definition: AgentDefinition) -> str:
    """Generate Security Considerations section with threat model for high-risk tools."""
    lines = ["## Security Considerations", ""]

    tools = definition.tools
    has_bash = "Bash" in tools
    has_write = "Write" in tools or "Edit" in tools
    has_web = "WebSearch" in tools or "WebFetch" in tools

    lines.append("### Threat Model")
    lines.append("")

    if has_bash:
        lines.append("#### Command Injection Prevention")
        lines.append("")
        lines.append("- **NEVER** interpolate user input directly into shell commands")
        lines.append("- Use parameterized commands where possible")
        lines.append("- Validate and sanitize all inputs before execution")
        lines.append("- Avoid shell metacharacters: `; | & $ \\` \\ ( ) { } [ ] < >`")
        lines.append("")

    if has_write:
        lines.append("#### Path Traversal Prevention")
        lines.append("")
        lines.append("- Validate all file paths against allowed directories")
        lines.append("- Reject paths containing `..` or absolute paths outside sandbox")
        lines.append("- Use allowlist for file extensions when applicable")
        lines.append("- Never write to system directories or config files")
        lines.append("")

    if has_web:
        lines.append("#### SSRF Prevention")
        lines.append("")
        lines.append("- Validate URLs against allowlist of domains")
        lines.append("- Block requests to internal/private IP ranges")
        lines.append("- Do not follow redirects to disallowed hosts")
        lines.append("- Sanitize response content before processing")
        lines.append("")

    lines.append("### Sensitive Data Handling")
    lines.append("")
    lines.append("- **NEVER** log or output credentials, API keys, or secrets")
    lines.append("- Mask sensitive fields in all outputs (e.g., `****` for passwords)")
    lines.append("- Skip files matching sensitive patterns: `.env`, `*_secret*`, `credentials*`")
    lines.append("- Do not include file contents in error messages")
    lines.append("")

    lines.append("### Input Validation")
    lines.append("")
    lines.append("All inputs must pass validation:")
    lines.append("1. **Schema validation**: Correct structure and types")
    lines.append("2. **Syntax validation**: Valid format (e.g., valid JSON, valid paths)")
    lines.append("3. **Semantic validation**: Values within expected ranges")
    lines.append("")

    return "\n".join(lines)


def generate_boundaries_section(
    definition: AgentDefinition,
) -> str:
    """Generate Boundaries section specifying what agent should NEVER do.

    Includes Human-in-the-Loop (HITL) markers for high-stakes operations.
    """
    tools = definition.tools
    lines = ["## Boundaries", ""]

    lines.append("### This Agent MUST NOT")
    lines.append("")
    lines.append("1. **Modify system files** - Never touch `/etc`, `/usr`, `~/.bashrc`, etc.")
    lines.append("2. **Execute destructive commands** - No `rm -rf`, `format`, `drop database`")
    lines.append("3. **Access credentials** - Never read or expose `.env`, SSH keys, API tokens")
    lines.append("4. **Make network requests to arbitrary URLs** - Only approved domains")
    lines.append("5. **Exceed scope** - Stay within the defined task boundaries")
    lines.append("6. **Bypass user confirmation** - Always confirm destructive operations")
    lines.append("")

    lines.append("### Scope Limitations")
    lines.append("")
    lines.append("- **File access**: Only within project directory and explicitly allowed paths")
    lines.append("- **Network access**: Only to documented external services")
    lines.append("- **Resource usage**: Respect timeout and memory limits")
    lines.append("- **Autonomy level**: Pause and ask for confirmation on ambiguous requests")
    lines.append("")

    lines.append("### Escalation Triggers")
    lines.append("")
    lines.append("Immediately stop and request human intervention when:")
    lines.append("- Detecting potential security vulnerabilities in user code")
    lines.append("- Encountering requests that violate boundaries")
    lines.append("- Facing ambiguous instructions with high-stakes outcomes")
    lines.append("- Discovering sensitive data in unexpected locations")
    lines.append("")

    # Generate Human-in-the-Loop markers based on tools
    lines.append("### Human-in-the-Loop (HITL) Requirements")
    lines.append("")
    lines.append("The following operations require explicit user confirmation:")
    lines.append("")
    lines.append("| Operation | Risk Level | HITL Marker |")
    lines.append("|-----------|------------|-------------|")

    # Add HITL markers based on tools used
    if "Bash" in tools:
        lines.append("| Shell command execution | HIGH | `[HITL:CONFIRM]` |")
    if "Write" in tools:
        lines.append("| File creation/overwrite | MEDIUM | `[HITL:CONFIRM]` |")
    if "Edit" in tools:
        lines.append("| Config file modification | MEDIUM | `[HITL:CONFIRM]` |")
    if "WebFetch" in tools:
        lines.append("| External URL fetch | MEDIUM | `[HITL:CONFIRM]` |")
    if "Task" in tools:
        lines.append("| Spawn >3 concurrent subagents | LOW | `[HITL:NOTIFY]` |")

    # Always include critical operations
    lines.append("| Database modifications | CRITICAL | `[HITL:APPROVE]` |")
    lines.append("| Credential handling | CRITICAL | `[HITL:BLOCK]` |")
    lines.append("| Production deployment | CRITICAL | `[HITL:APPROVE]` |")
    lines.append("")

    lines.append("**HITL Marker Legend:**")
    lines.append("")
    lines.append("- `[HITL:NOTIFY]` - Inform user, proceed if no objection within timeout")
    lines.append('- `[HITL:CONFIRM]` - Wait for explicit "yes" confirmation before proceeding')
    lines.append("- `[HITL:APPROVE]` - Require detailed approval with documented reason")
    lines.append("- `[HITL:BLOCK]` - Never proceed automatically, always escalate to human")
    lines.append("")

    lines.append("**Implementation Pattern:**")
    lines.append("")
    lines.append("```")
    lines.append("Before high-stakes operation:")
    lines.append("  1. Identify operation type and risk level from table above")
    lines.append("  2. Check HITL requirement marker")
    lines.append("  3. Use AskUserQuestion with clear context:")
    lines.append('     - WHAT: "About to execute: rm -rf ./build/"')
    lines.append('     - WHY: "Cleaning build artifacts as requested"')
    lines.append('     - RISK: "Directory contents will be permanently deleted"')
    lines.append('     - OPTIONS: ["Proceed", "Skip", "Show files first"]')
    lines.append("  4. Wait for explicit user response")
    lines.append("  5. Log decision with timestamp and proceed only if approved")
    lines.append("```")
    lines.append("")

    return "\n".join(lines)


def generate_notes_section(
    definition: AgentDefinition,
) -> str:
    """Generate Notes & Limitations section with caveats and known issues.

    Uses template variables for configurable limits.
    """
    tv = definition.template_vars
    lines = ["## Notes & Limitations", ""]

    lines.append("### Current Limitations")
    lines.append("")
    lines.append(
        f"- **Context window**: May struggle with very large files (>{tv.max_file_lines} lines)"
    )
    lines.append("- **Binary files**: Cannot process binary or encoded content")
    lines.append("- **Real-time data**: Cannot access live systems or databases directly")
    lines.append("- **External services**: Dependent on third-party API availability")
    lines.append("")

    lines.append("### Performance Characteristics")
    lines.append("")
    lines.append(
        f"- **Best for**: Small to medium-sized projects (<{tv.max_files_per_invocation * 10} files)"
    )
    lines.append(f"- **Optimal input size**: 10-{tv.max_files_per_invocation} files per invocation")
    lines.append(f"- **Execution timeout**: {tv.execution_timeout_seconds} seconds")
    lines.append(f"- **Max recursion depth**: {tv.max_recursion_depth} levels")
    lines.append("")

    lines.append("### Resource Limits")
    lines.append("")
    lines.append("```")
    lines.append("Configurable Limits:")
    lines.append(f"  max_file_lines: {tv.max_file_lines}")
    lines.append(f"  max_files_per_invocation: {tv.max_files_per_invocation}")
    lines.append(f"  max_recursion_depth: {tv.max_recursion_depth}")
    lines.append(f"  execution_timeout_seconds: {tv.execution_timeout_seconds}")
    lines.append("```")
    lines.append("")

    lines.append("### Known Issues")
    lines.append("")
    lines.append("- None documented at this time")
    lines.append("")

    lines.append("### Future Improvements")
    lines.append("")
    lines.append("- [ ] Streaming output for long-running operations")
    lines.append("- [ ] Checkpoint/resume for interrupted tasks")
    lines.append("- [ ] Caching for repeated operations")
    lines.append("")

    return "\n".join(lines)


def generate_related_agents_section(definition: AgentDefinition) -> str:
    """Generate Related Agents section for composition patterns."""
    lines = ["## Related Agents", ""]

    desc_lower = definition.description.lower()

    lines.append("### Complementary Agents")
    lines.append("")

    # Suggest related agents based on description
    if any(w in desc_lower for w in ["review", "analyze", "audit"]):
        lines.append("- **test-runner**: Execute tests after code review findings")
        lines.append("- **fix-applier**: Automatically apply suggested fixes")
        lines.append("- **report-generator**: Create detailed analysis reports")
    elif any(w in desc_lower for w in ["generate", "create", "build"]):
        lines.append("- **code-reviewer**: Review generated code for quality")
        lines.append("- **test-generator**: Create tests for generated code")
        lines.append("- **documentation-writer**: Document generated artifacts")
    elif any(w in desc_lower for w in ["test", "validate"]):
        lines.append("- **coverage-analyzer**: Measure test coverage")
        lines.append("- **bug-reporter**: File issues for failing tests")
        lines.append("- **fix-suggester**: Propose fixes for test failures")
    else:
        lines.append("- **code-reviewer**: Review outputs for quality")
        lines.append("- **documentation-writer**: Document results")
        lines.append("- **notification-sender**: Alert on completion")
    lines.append("")

    lines.append("### Composition Pattern")
    lines.append("")
    lines.append("```")
    lines.append(f"[User Request] → [{definition.name}] → [code-reviewer] → [Output]")
    lines.append("                     ↓")
    lines.append("              [test-generator]")
    lines.append("```")
    lines.append("")

    lines.append("### Orchestration Example")
    lines.append("")
    lines.append("```")
    lines.append(f'Task(subagent_type="{definition.name}", prompt="...")')
    lines.append('  → on_success → Task(subagent_type="code-reviewer", prompt="Review changes")')
    lines.append('  → on_failure → Task(subagent_type="error-handler", prompt="Handle error")')
    lines.append("```")
    lines.append("")

    return "\n".join(lines)


def generate_tool_reference_section(definition: AgentDefinition) -> str:
    """Generate Tool Reference section with usage guidance for each tool.

    Documents when to use, when NOT to use, and validation requirements.
    """
    lines = ["## Tool Reference", ""]

    tools = definition.tools
    if not tools:
        return ""

    # Tool documentation templates with comprehensive validation
    tool_docs = {
        "Read": {
            "purpose": "Read file contents from the filesystem",
            "when_to_use": [
                "Loading source code for analysis",
                "Reading configuration files",
                "Examining log files for debugging",
            ],
            "when_not_to_use": [
                "Binary files (images, executables)",
                "Very large files (>10K lines) without offset/limit",
                "Sensitive files (.env, credentials)",
            ],
            "validation": {
                "schema": "file_path: string (required, absolute path)",
                "syntax": "Path must not contain null bytes or shell metacharacters",
                "semantic": "File must exist, be readable, and within allowed directories",
            },
            "example": 'Read(file_path="/src/main.py")',
        },
        "Write": {
            "purpose": "Create or overwrite files on the filesystem",
            "when_to_use": [
                "Creating new source files",
                "Generating configuration files",
                "Writing output reports",
            ],
            "when_not_to_use": [
                "System files (/etc, /usr)",
                "Files outside project directory",
                "Without user confirmation for existing files",
            ],
            "validation": {
                "schema": "file_path: string (required), content: string (required)",
                "syntax": "Path must be absolute, content must be valid UTF-8",
                "semantic": "Directory must exist, path within allowed directories, no overwrite without confirmation",
            },
            "example": 'Write(file_path="/output/report.md", content="...")',
        },
        "Edit": {
            "purpose": "Make targeted changes to existing files",
            "when_to_use": [
                "Fixing bugs in source code",
                "Updating configuration values",
                "Refactoring specific code sections",
            ],
            "when_not_to_use": [
                "Creating new files (use Write instead)",
                "Large-scale refactoring (may need multiple edits)",
                "Without reading the file first",
            ],
            "validation": {
                "schema": "file_path: string, old_string: string, new_string: string",
                "syntax": "old_string must be non-empty, new_string must differ from old_string",
                "semantic": "File must exist, old_string must appear exactly once (unless replace_all=true)",
            },
            "example": 'Edit(file_path="...", old_string="...", new_string="...")',
        },
        "Grep": {
            "purpose": "Search for patterns in file contents",
            "when_to_use": [
                "Finding function definitions",
                "Locating string occurrences",
                "Searching for TODO/FIXME comments",
            ],
            "when_not_to_use": [
                "Finding files by name (use Glob instead)",
                "Simple file existence checks",
                "Binary file content",
            ],
            "validation": {
                "schema": "pattern: string (required), path: string (optional)",
                "syntax": "Pattern must be valid regex, escape special chars: . * + ? [ ] ( ) { } | \\ ^",
                "semantic": "Path must exist and be searchable, pattern must not be overly broad",
            },
            "example": 'Grep(pattern="def.*test", path="/src/")',
        },
        "Glob": {
            "purpose": "Find files matching patterns",
            "when_to_use": [
                "Finding all files of a type (*.py, *.ts)",
                "Discovering project structure",
                "Locating configuration files",
            ],
            "when_not_to_use": [
                "Searching file contents (use Grep instead)",
                "When exact path is known (use Read directly)",
            ],
            "validation": {
                "schema": "pattern: string (required), path: string (optional)",
                "syntax": "Valid glob pattern with wildcards: *, **, ?",
                "semantic": "Avoid patterns returning >1000 matches, path must be within allowed directories",
            },
            "example": 'Glob(pattern="**/*.py", path="/src/")',
        },
        "Bash": {
            "purpose": "Execute shell commands",
            "when_to_use": [
                "Running tests (pytest, npm test)",
                "Building projects (make, npm build)",
                "Git operations",
            ],
            "when_not_to_use": [
                "Reading files (use Read instead)",
                "Searching files (use Grep/Glob instead)",
                "Destructive commands without confirmation",
            ],
            "validation": {
                "schema": "command: string (required), timeout: number (optional)",
                "syntax": "NEVER interpolate user input directly, no shell metachar injection",
                "semantic": "Command must be on allowlist, no destructive operations without confirmation",
            },
            "example": 'Bash(command="pytest tests/ -v")',
        },
        "WebSearch": {
            "purpose": "Search the web for information",
            "when_to_use": [
                "Finding documentation",
                "Researching error messages",
                "Looking up API references",
            ],
            "when_not_to_use": [
                "When local documentation exists",
                "For internal/private information",
                "Excessive searches in a single session",
            ],
            "validation": {
                "schema": "query: string (required, min 2 chars)",
                "syntax": "Query must not contain injection attempts or special operators",
                "semantic": "Results must be from trusted domains, verify freshness of info",
            },
            "example": 'WebSearch(query="Python asyncio best practices 2024")',
        },
        "WebFetch": {
            "purpose": "Fetch and process web page content",
            "when_to_use": [
                "Reading documentation pages",
                "Fetching API specifications",
                "Analyzing web content",
            ],
            "when_not_to_use": [
                "Internal network URLs",
                "URLs requiring authentication",
                "Downloading large files",
            ],
            "validation": {
                "schema": "url: string (required, valid URL), prompt: string (required)",
                "syntax": "URL must be HTTPS, valid format, no internal IPs (10.*, 192.168.*, 127.*)",
                "semantic": "Domain must be on allowlist, follow max 5 redirects, timeout after 30s",
            },
            "example": 'WebFetch(url="https://docs.example.com", prompt="...")',
        },
        "Task": {
            "purpose": "Spawn subagent for specialized tasks",
            "when_to_use": [
                "Delegating to specialized agents",
                "Parallel task execution",
                "Complex multi-step operations",
            ],
            "when_not_to_use": [
                "Simple operations that don't need delegation",
                "When context sharing is critical",
                "Excessive parallelization",
            ],
            "validation": {
                "schema": "subagent_type: string (required), prompt: string (required)",
                "syntax": "subagent_type must be valid identifier, prompt non-empty",
                "semantic": "Subagent must exist and have required capabilities, limit concurrent tasks",
            },
            "example": 'Task(subagent_type="code-reviewer", prompt="...")',
        },
        "AskUserQuestion": {
            "purpose": "Request clarification from the user",
            "when_to_use": [
                "Ambiguous requirements",
                "Multiple valid approaches exist",
                "Confirmation for destructive operations",
            ],
            "when_not_to_use": [
                "When instructions are clear",
                "For trivial decisions",
                "Excessive questioning",
            ],
            "validation": {
                "schema": "questions: array (1-4 questions), each with header, question, options",
                "syntax": "Options must have 2-4 choices, headers max 12 chars",
                "semantic": "Questions must be clear and actionable, avoid leading questions",
            },
            "example": "AskUserQuestion(questions=[...])",
        },
        "TodoWrite": {
            "purpose": "Track task progress and planning",
            "when_to_use": [
                "Multi-step task planning",
                "Progress tracking",
                "Complex task breakdown",
            ],
            "when_not_to_use": [
                "Single simple tasks",
                "Tasks that don't benefit from tracking",
            ],
            "validation": {
                "schema": "todos: array of {content: string, status: enum, activeForm: string}",
                "syntax": "status must be: pending|in_progress|completed",
                "semantic": "Only one task should be in_progress at a time, content must be actionable",
            },
            "example": 'TodoWrite(todos=[{"content": "...", "status": "in_progress", "activeForm": "..."}])',
        },
    }

    for tool in tools:
        if tool in tool_docs:
            doc = tool_docs[tool]
            lines.append(f"### {tool}")
            lines.append("")
            lines.append(f"**Purpose:** {doc['purpose']}")
            lines.append("")

            lines.append("**When to Use:**")
            for use in doc["when_to_use"]:
                lines.append(f"- {use}")
            lines.append("")

            lines.append("**When NOT to Use:**")
            for no_use in doc["when_not_to_use"]:
                lines.append(f"- {no_use}")
            lines.append("")

            # Render validation - support both string and dict formats
            validation = doc["validation"]
            if isinstance(validation, dict):
                lines.append("**Input Validation:**")
                lines.append("")
                lines.append("| Level | Requirement |")
                lines.append("|-------|-------------|")
                if "schema" in validation:
                    lines.append(f"| Schema | {validation['schema']} |")
                if "syntax" in validation:
                    lines.append(f"| Syntax | {validation['syntax']} |")
                if "semantic" in validation:
                    lines.append(f"| Semantic | {validation['semantic']} |")
            else:
                lines.append(f"**Validation:** {validation}")
            lines.append("")

            lines.append("**Example Call:**")
            lines.append("```")
            lines.append(doc["example"])
            lines.append("```")
            lines.append("")
        elif tool.startswith("mcp__"):
            # MCP tool - generic documentation
            lines.append(f"### {tool}")
            lines.append("")
            lines.append("**Purpose:** MCP server-provided tool")
            lines.append("")
            lines.append("**When to Use:**")
            lines.append("- As specified by the MCP server documentation")
            lines.append("")
            lines.append("**Validation:** Follow MCP server-specific requirements")
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
    """Generate complete agent file content with 13 sections.

    Sections (in order):
    1. Overview - Brief description and purpose
    2. Prerequisites - Dependencies, permissions, environment
    3. Workflow - Step-by-step execution flow
    4. Workers (if orchestrator) - Worker definitions
    5. Examples (x3) - Basic, advanced, edge case
    6. Error Handling - Failure modes, recovery, retries
    7. Edge Cases - Boundary conditions, special scenarios
    8. Security Considerations - Threat model, input validation
    9. Boundaries - What agent MUST NOT do
    10. Notes & Limitations - Caveats, known issues
    11. Tool Reference - When to use/not use each tool
    12. Output Format - Expected response structure
    13. Related Agents - Composition patterns
    """
    parts = []

    # Frontmatter
    parts.append(generate_frontmatter(definition))
    parts.append("")

    # Title
    parts.append(generate_title(definition.name))
    parts.append("")

    # 1. Overview
    parts.append(generate_overview_section(definition))

    # 2. Prerequisites
    parts.append(generate_prerequisites_section(definition))

    # Custom sections (if any)
    for section in definition.sections:
        heading = "#" * section.level + " " + section.title
        parts.append(heading)
        parts.append("")
        parts.append(section.content)
        parts.append("")

    # 3. Workflow
    parts.append(generate_workflow_section(definition, pattern))

    # 4. Workers (for orchestrator pattern)
    workers_section = generate_workers_section(definition)
    if workers_section:
        parts.append(workers_section)

    # 5. Examples (3 examples: basic, advanced, edge case)
    parts.append(generate_examples_section(definition))

    # 6. Error Handling
    parts.append(generate_error_handling_section(definition))

    # 7. Edge Cases
    parts.append(generate_edge_cases_section(definition))

    # 8. Security Considerations
    parts.append(generate_security_section(definition))

    # 9. Boundaries
    parts.append(generate_boundaries_section(definition))

    # 10. Notes & Limitations
    parts.append(generate_notes_section(definition))

    # 11. Tool Reference (when to use, when not to use)
    tool_ref = generate_tool_reference_section(definition)
    if tool_ref:
        parts.append(tool_ref)

    # 12. Output Format
    parts.append(generate_output_section(definition))

    # 13. Related Agents
    parts.append(generate_related_agents_section(definition))

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
        workers.append(
            WorkerDefinition(
                name=w.get("name", "worker"),
                role=w.get("role", ""),
                tools=worker_tools,
                input_format=w.get("input_format", ""),
                output_format=w.get("output_format", ""),
            )
        )

    # Parse sections
    sections = []
    for s in data.get("sections", []):
        sections.append(
            AgentSection(
                title=s.get("title", ""),
                content=s.get("content", ""),
                level=s.get("level", 2),
            )
        )

    # Parse chain_steps for prompt-chaining pattern
    chain_steps = []
    for cs in data.get("chain_steps", []):
        step_tools = cs.get("tools", [])
        if isinstance(step_tools, str):
            step_tools = [t.strip() for t in step_tools.split(",")]
        chain_steps.append(
            ChainStep(
                name=cs.get("name", "Step"),
                description=cs.get("description", ""),
                input_from=cs.get("input_from", ""),
                output_to=cs.get("output_to", ""),
                tools=step_tools,
                validation=cs.get("validation", ""),
            )
        )

    # Parse template variables
    template_vars = TemplateVariables()
    if "template_vars" in data:
        template_vars = TemplateVariables.from_dict(data["template_vars"])

    return AgentDefinition(
        name=data.get("name", "unnamed-agent"),
        description=data.get("description", ""),
        tools=tools,
        sections=sections,
        workers=workers,
        chain_steps=chain_steps,
        examples=data.get("examples", []),
        metadata=data.get("metadata", {}),
        template_vars=template_vars,
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
    template_vars = kwargs.get("template_vars", TemplateVariables())
    if isinstance(template_vars, dict):
        template_vars = TemplateVariables.from_dict(template_vars)

    definition = AgentDefinition(
        name=name,
        description=description,
        tools=normalized_tools,
        sections=kwargs.get("sections", []),
        workers=kwargs.get("workers", []),
        chain_steps=kwargs.get("chain_steps", []),
        examples=kwargs.get("examples", []),
        metadata=kwargs.get("metadata", {}),
        template_vars=template_vars,
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
    parser.add_argument(
        "--pattern",
        default="prompt-chaining",
        choices=[
            "prompt-chaining",
            "orchestrator-workers",
            "routing",
            "parallelization",
            "evaluator-optimizer",
        ],
        help="Workflow pattern",
    )
    parser.add_argument("--json", help="JSON input with all parameters")
    parser.add_argument("--blueprint", help="Path to blueprint JSON file")
    parser.add_argument("--output", help="Output file or directory path")
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate inputs, don't generate",
    )

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
        chain_steps=definition.chain_steps,
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
