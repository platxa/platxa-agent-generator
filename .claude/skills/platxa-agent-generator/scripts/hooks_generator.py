#!/usr/bin/env python3
"""
Hooks Generator for Compliance and Logging

Generates Claude Code hooks configuration for agent events including:
- Compliance hooks (audit logging, policy enforcement)
- Logging hooks (event tracking, metrics collection)
- Security hooks (validation, sanitization)
- Performance hooks (timing, resource tracking)

Hook Events:
- SessionStart: When a Claude Code session begins
- SessionEnd/Stop: When a session ends
- PreToolUse: Before a tool is invoked
- PostToolUse: After a tool completes
- Notification: When notifications are sent
- SubagentStop: When a subagent completes
- PreCompact: Before context compaction

Usage:
    python hooks_generator.py --agent security-scanner --type compliance
    python hooks_generator.py --agent code-reviewer --type logging --events PreToolUse,PostToolUse
    python hooks_generator.py --json '{"agent": "my-agent", "hooks": ["audit", "metrics"]}'
"""

from __future__ import annotations

import json
import re
import shlex
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# Feature #1 (SECURITY CRITICAL): agent_name must match this pattern before it
# can be embedded into any generated shell command, filename, or script body.
# Restricts to [a-zA-Z0-9_-] so no shell metacharacters, path-traversal
# sequences, or whitespace survive interpolation. This is the root-cause fix
# for the remote-code-execution surface discovered in the 2026-04-20 review.
AGENT_NAME_PATTERN: re.Pattern[str] = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_agent_name(agent_name: str) -> str:
    """Validate agent_name for safe shell and filesystem interpolation.

    Every public function in this module that embeds ``agent_name`` into
    generated shell commands, filenames, or script bodies MUST call this
    helper at the API boundary before any downstream use.

    Args:
        agent_name: Candidate agent name.

    Returns:
        The validated agent name (unchanged on success).

    Raises:
        ValueError: If ``agent_name`` is empty or whitespace-only, or
            contains any character outside ``[a-zA-Z0-9_-]``. The message
            explicitly names the security reason so operators can
            distinguish this rejection from unrelated ``ValueError``
            raises elsewhere in the codebase.
    """
    if not agent_name or not agent_name.strip():
        raise ValueError(
            "agent_name must be a non-empty string; disallowed to prevent shell injection"
        )
    if not AGENT_NAME_PATTERN.match(agent_name):
        raise ValueError(
            f"agent_name must match ^[a-zA-Z0-9_-]+$ (got {agent_name!r}); "
            "disallowed to prevent shell injection"
        )
    return agent_name


# Valid hook event types in Claude Code
HOOK_EVENTS = {
    "SessionStart": "Triggered when a Claude Code session begins",
    "Stop": "Triggered when a session ends",
    "PreToolUse": "Triggered before a tool is invoked",
    "PostToolUse": "Triggered after a tool completes",
    "Notification": "Triggered when notifications are sent",
    "SubagentStart": "Triggered when a subagent is spawned",
    "SubagentStop": "Triggered when a subagent completes",
    "PreCompact": "Triggered before context compaction",
    "UserPromptSubmit": "Triggered when user submits a prompt",
    # Multi-agent team coordination events (no matcher support — fire unconditionally)
    "TeammateIdle": "Triggered when an agent team teammate is about to go idle",
    "TaskCreated": "Triggered when a task is created via TaskCreate",
    "TaskCompleted": "Triggered when a task is being marked as completed",
}

# Events that do not support matchers (per Claude Code hook spec)
NO_MATCHER_EVENTS = frozenset(
    {
        "UserPromptSubmit",
        "Stop",
        "TeammateIdle",
        "TaskCreated",
        "TaskCompleted",
    }
)

# Common tool matchers
TOOL_MATCHERS = {
    "write": "Write|Edit|MultiEdit",
    "read": "Read|Glob|Grep",
    "bash": "Bash",
    "task": "Task",
    "all_file_ops": "Write|Edit|MultiEdit|Read",
    "dangerous": "Write|Edit|MultiEdit|Bash",
}


@dataclass
class HookAction:
    """A single hook action."""

    type: str = "command"
    command: str = ""
    timeout_ms: int | None = None
    background: bool = False


@dataclass
class HookConfig:
    """Configuration for a hook on an event."""

    event: str
    matcher: str = ""
    hooks: list[HookAction] = field(default_factory=list)
    description: str = ""


@dataclass
class HooksDefinition:
    """Complete hooks definition for an agent.

    ``agent_name`` is validated in ``__post_init__`` so no path that
    constructs a ``HooksDefinition`` can bypass the injection guard.
    """

    agent_name: str
    hooks: list[HookConfig] = field(default_factory=list)
    description: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self) -> None:
        _validate_agent_name(self.agent_name)


def validate_event(event: str) -> tuple[bool, str]:
    """Validate hook event type."""
    if event not in HOOK_EVENTS:
        valid_events = ", ".join(HOOK_EVENTS.keys())
        return False, f"Invalid event '{event}'. Valid events: {valid_events}"
    return True, ""


def validate_command(command: str) -> tuple[bool, str]:
    """Validate hook command for security issues."""
    # Check for dangerous patterns
    dangerous_patterns = [
        ("rm -rf /", "Destructive root deletion"),
        ("rm -rf ~", "Destructive home deletion"),
        ("; rm ", "Command injection with rm"),
        ("| rm ", "Pipe to rm"),
        ("&& rm -rf", "Chained destructive deletion"),
        ("eval ", "Arbitrary code execution via eval"),
        ("$(curl", "Remote code execution via curl"),
        ("`curl", "Remote code execution via curl"),
        ("| sh", "Pipe to shell"),
        ("| bash", "Pipe to bash"),
    ]

    for pattern, reason in dangerous_patterns:
        if pattern in command:
            return False, f"Dangerous pattern detected: {reason}"

    # Check for shell injection characters without proper quoting
    if "$(" in command and "2>/dev/null" not in command:
        # Command substitution should have error handling
        pass  # Allow but warn

    return True, ""


def create_audit_hook(
    agent_name: str,
    event: str,
    log_file: str = "/tmp/claude-audit.log",
) -> HookConfig:
    """Create an audit logging hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    timestamp_cmd = "date -Iseconds"

    if event == "SessionStart":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SESSION_START user=$USER" >> {log_file}'
        )
    elif event == "Stop":
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) SESSION_END" >> {log_file}'
    elif event == "PreToolUse":
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) PRE_TOOL tool=$CLAUDE_TOOL_NAME" >> {log_file}'
    elif event == "PostToolUse":
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) POST_TOOL tool=$CLAUDE_TOOL_NAME" >> {log_file}'
    elif event == "SubagentStart":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SUBAGENT_START '
            f"agent_id=${{CLAUDE_AGENT_ID:-unknown}} "
            f'agent_type=${{CLAUDE_AGENT_TYPE:-unknown}}" >> {log_file}'
        )
    elif event == "SubagentStop":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SUBAGENT_STOP '
            f'agent_id=${{CLAUDE_AGENT_ID:-unknown}}" >> {log_file}'
        )
    else:
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) {event}" >> {log_file}'

    return HookConfig(
        event=event,
        matcher="",
        hooks=[HookAction(type="command", command=command)],
        description=f"Audit log for {event} events",
    )


def create_compliance_hook(
    agent_name: str,
    event: str,
    policy_script: str | None = None,
) -> HookConfig:
    """Create a compliance enforcement hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    if policy_script:
        command = f"{policy_script} --agent {quoted_name} --event {event}"
    else:
        # Default compliance check
        command = f"{quoted_name}-compliance-check --event {event} 2>/dev/null || true"

    return HookConfig(
        event=event,
        matcher="",
        hooks=[HookAction(type="command", command=command)],
        description=f"Compliance check for {event}",
    )


def create_metrics_hook(
    agent_name: str,
    event: str,
    metrics_endpoint: str | None = None,
) -> HookConfig:
    """Create a metrics collection hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    if metrics_endpoint:
        command = (
            f"curl -s -X POST {metrics_endpoint} "
            f'-d "agent={quoted_name}&event={event}&timestamp=$(date +%s)" '
            f"2>/dev/null || true"
        )
    else:
        # Default: log to metrics file
        command = (
            f'echo "{quoted_name},{event},$(date +%s)" '
            f">> /tmp/claude-metrics.csv 2>/dev/null || true"
        )

    return HookConfig(
        event=event,
        matcher="",
        hooks=[HookAction(type="command", command=command, background=True)],
        description=f"Metrics collection for {event}",
    )


def create_security_hook(
    agent_name: str,
    event: str,
    matcher: str = "",
) -> HookConfig:
    """Create a security validation hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    if event == "PreToolUse":
        # Validate before dangerous operations
        command = f'{quoted_name}-security-gate --tool "$CLAUDE_TOOL_NAME" 2>/dev/null || true'
        if not matcher:
            matcher = TOOL_MATCHERS["dangerous"]
    elif event == "PostToolUse":
        # Audit after operations
        command = f'{quoted_name}-security-audit --tool "$CLAUDE_TOOL_NAME" 2>/dev/null || true'
    else:
        command = f"{quoted_name}-security-check --event {event} 2>/dev/null || true"

    return HookConfig(
        event=event,
        matcher=matcher,
        hooks=[HookAction(type="command", command=command)],
        description=f"Security validation for {event}",
    )


def create_notification_hook(
    agent_name: str,
    title: str = "Claude Code",
    events: list[str] | None = None,
) -> list[HookConfig]:
    """Create notification hooks for important events."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    hooks = []
    target_events = events or ["SessionStart", "Stop"]

    for event in target_events:
        if event == "SessionStart":
            message = f"{quoted_name} session started"
        elif event == "Stop":
            message = f"{quoted_name} session ended"
        else:
            message = f"{quoted_name}: {event}"

        command = f'notify-send -i dialog-information "{title}" "{message}" 2>/dev/null || true'

        hooks.append(
            HookConfig(
                event=event,
                matcher="",
                hooks=[HookAction(type="command", command=command)],
                description=f"Desktop notification for {event}",
            )
        )

    return hooks


def create_logging_hook(
    agent_name: str,
    event: str,
    log_level: str = "INFO",
    log_file: str | None = None,
) -> HookConfig:
    """Create a structured logging hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    if log_file is None:
        log_file = f"/tmp/{quoted_name}.log"

    # Structured JSON logging
    command = (
        f'echo \'{{"timestamp":"\'$(date -Iseconds)\'","level":"{log_level}",'
        f'"agent":"{quoted_name}","event":"{event}",'
        f'"tool":"\'$CLAUDE_TOOL_NAME\'"}}\' >> {log_file}'
    )

    return HookConfig(
        event=event,
        matcher="",
        hooks=[HookAction(type="command", command=command)],
        description=f"Structured logging for {event}",
    )


def create_performance_hook(
    agent_name: str,
    event: str,
) -> HookConfig:
    """Create a performance timing hook."""
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    if event == "PreToolUse":
        # Record start time
        command = f"echo $(date +%s%N) > /tmp/{quoted_name}-timing-start 2>/dev/null || true"
    elif event == "PostToolUse":
        # Calculate and log duration
        command = (
            f"START=$(cat /tmp/{quoted_name}-timing-start 2>/dev/null || echo 0); "
            f"END=$(date +%s%N); "
            f"DURATION=$((($END - $START) / 1000000)); "
            f'echo "{quoted_name},$CLAUDE_TOOL_NAME,$DURATION" >> /tmp/{quoted_name}-perf.csv 2>/dev/null || true'
        )
    else:
        command = f'echo "{quoted_name},{event},$(date +%s%N)" >> /tmp/{quoted_name}-timing.csv'

    return HookConfig(
        event=event,
        matcher="",
        hooks=[HookAction(type="command", command=command)],
        description=f"Performance timing for {event}",
    )


def generate_hooks(
    agent_name: str,
    hook_types: list[str],
    events: list[str] | None = None,
    custom_config: dict[str, Any] | None = None,
) -> HooksDefinition:
    """
    Generate hooks configuration for an agent.

    Args:
        agent_name: Name of the agent
        hook_types: Types of hooks to generate (audit, compliance, metrics, security, logging, performance, notification)
        events: Specific events to hook (defaults to common events)
        custom_config: Additional configuration options

    Returns:
        HooksDefinition with all configured hooks
    """
    _validate_agent_name(agent_name)
    quoted_name = shlex.quote(agent_name)
    config = custom_config or {}
    target_events = events or ["SessionStart", "Stop", "PreToolUse", "PostToolUse"]

    definition = HooksDefinition(
        agent_name=agent_name,
        description=f"Generated hooks for {quoted_name} agent",
    )

    for hook_type in hook_types:
        hook_type = hook_type.lower()

        if hook_type == "audit":
            log_file = config.get("audit_log", "/tmp/claude-audit.log")
            for event in target_events:
                definition.hooks.append(create_audit_hook(agent_name, event, log_file))

        elif hook_type == "compliance":
            policy_script = config.get("policy_script")
            for event in target_events:
                definition.hooks.append(create_compliance_hook(agent_name, event, policy_script))

        elif hook_type == "metrics":
            endpoint = config.get("metrics_endpoint")
            for event in target_events:
                definition.hooks.append(create_metrics_hook(agent_name, event, endpoint))

        elif hook_type == "security":
            security_events = ["PreToolUse", "PostToolUse"]
            for event in security_events:
                if event in target_events or events is None:
                    definition.hooks.append(create_security_hook(agent_name, event))

        elif hook_type == "logging":
            log_file = config.get("log_file")
            log_level = config.get("log_level", "INFO")
            for event in target_events:
                definition.hooks.append(create_logging_hook(agent_name, event, log_level, log_file))

        elif hook_type == "performance":
            perf_events = ["PreToolUse", "PostToolUse"]
            for event in perf_events:
                if event in target_events or events is None:
                    definition.hooks.append(create_performance_hook(agent_name, event))

        elif hook_type == "notification":
            notify_events = config.get("notify_events", ["SessionStart", "Stop"])
            definition.hooks.extend(create_notification_hook(agent_name, events=notify_events))

        elif hook_type == "subagent-audit":
            # Register the same script on both SubagentStart and SubagentStop;
            # the script dispatches internally on hook_event_name.
            script_path = config.get(
                "audit_script_path",
                f".claude/hooks/{agent_name}-subagent-audit.sh",
            )
            for event in ("SubagentStart", "SubagentStop"):
                definition.hooks.append(
                    HookConfig(
                        event=event,
                        matcher="",
                        hooks=[HookAction(type="command", command=script_path)],
                        description=f"Subagent audit log for {event}",
                    )
                )

    return definition


def definition_to_settings_format(definition: HooksDefinition) -> dict[str, Any]:
    """Convert HooksDefinition to Claude Code settings.json hooks format."""
    hooks_by_event: dict[str, list[dict[str, Any]]] = {}

    for hook_config in definition.hooks:
        event = hook_config.event
        if event not in hooks_by_event:
            hooks_by_event[event] = []

        hook_entry = {
            "matcher": hook_config.matcher,
            "hooks": [
                {
                    "type": action.type,
                    "command": action.command,
                }
                for action in hook_config.hooks
            ],
        }

        # Add optional fields
        for action in hook_config.hooks:
            if action.timeout_ms:
                hook_entry["hooks"][-1]["timeout_ms"] = action.timeout_ms

        hooks_by_event[event].append(hook_entry)

    return hooks_by_event


def definition_to_dict(definition: HooksDefinition) -> dict[str, Any]:
    """Convert HooksDefinition to dictionary."""
    return {
        "agent_name": definition.agent_name,
        "description": definition.description,
        "created_at": definition.created_at,
        "hooks": [
            {
                "event": h.event,
                "matcher": h.matcher,
                "description": h.description,
                "actions": [
                    {
                        "type": a.type,
                        "command": a.command,
                        "timeout_ms": a.timeout_ms,
                        "background": a.background,
                    }
                    for a in h.hooks
                ],
            }
            for h in definition.hooks
        ],
    }


def merge_with_existing_settings(
    new_hooks: dict[str, Any],
    settings_path: Path,
) -> dict[str, Any]:
    """Merge new hooks with existing settings.json."""
    if settings_path.exists():
        existing = json.loads(settings_path.read_text(encoding="utf-8"))
    else:
        existing = {}

    existing_hooks = existing.get("hooks", {})

    # Merge hooks by event
    for event, hook_list in new_hooks.items():
        if event not in existing_hooks:
            existing_hooks[event] = []
        existing_hooks[event].extend(hook_list)

    existing["hooks"] = existing_hooks
    return existing


def generate(
    agent_name: str,
    hook_types: list[str] | None = None,
    events: list[str] | None = None,
    output_path: str | None = None,
    merge_settings: bool = False,
    custom_config: dict[str, Any] | None = None,
) -> tuple[bool, dict[str, Any] | str, str]:
    """
    Generate hooks configuration.

    Args:
        agent_name: Name of the agent
        hook_types: Types of hooks (audit, compliance, metrics, security, logging, performance, notification)
        events: Specific events to hook
        output_path: Output file path
        merge_settings: Whether to merge with existing settings.json
        custom_config: Additional configuration

    Returns:
        (success, result_dict_or_error, output_path)
    """
    _validate_agent_name(agent_name)
    # Defaults
    if hook_types is None:
        hook_types = ["audit", "logging"]

    # Validate events
    if events:
        for event in events:
            valid, error = validate_event(event)
            if not valid:
                return False, error, ""

    # Generate hooks
    definition = generate_hooks(
        agent_name=agent_name,
        hook_types=hook_types,
        events=events,
        custom_config=custom_config,
    )

    # Convert to settings format
    hooks_config = definition_to_settings_format(definition)

    # Write output if path specified
    output_file = ""
    if output_path:
        path = Path(output_path)

        if merge_settings and path.name == "settings.json":
            # Merge with existing settings
            merged = merge_with_existing_settings(hooks_config, path)
            content = json.dumps(merged, indent=2)
        else:
            # Write just the hooks configuration
            content = json.dumps(
                {
                    "agent": agent_name,
                    "hooks": hooks_config,
                    "metadata": {
                        "generated_at": definition.created_at,
                        "hook_types": hook_types,
                    },
                },
                indent=2,
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        output_file = str(path)

    return True, hooks_config, output_file


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate Claude Code hooks for compliance and logging"
    )
    parser.add_argument("--agent", required=True, help="Agent name")
    parser.add_argument(
        "--type",
        dest="hook_types",
        help="Hook types (comma-separated): audit, compliance, metrics, security, logging, performance, notification",
    )
    parser.add_argument(
        "--events",
        help="Events to hook (comma-separated): SessionStart, Stop, PreToolUse, PostToolUse, etc.",
    )
    parser.add_argument("--json", help="JSON input with full configuration")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge with existing settings.json",
    )
    parser.add_argument(
        "--settings-format",
        action="store_true",
        help="Output in Claude Code settings.json format",
    )
    parser.add_argument("--stdout", action="store_true", help="Output to stdout")

    args = parser.parse_args()

    # Parse configuration
    if args.json:
        config = json.loads(args.json)
        agent_name = config.get("agent", config.get("agent_name", args.agent))
        hook_types = config.get("hooks", config.get("hook_types"))
        events = config.get("events")
        custom_config = config.get("config", {})
    else:
        agent_name = args.agent
        hook_types = args.hook_types.split(",") if args.hook_types else None
        events = args.events.split(",") if args.events else None
        custom_config = {}

    # Determine output
    output_path = None if args.stdout else args.output

    # Generate
    success, result, path = generate(
        agent_name=agent_name,
        hook_types=hook_types,
        events=events,
        output_path=output_path,
        merge_settings=args.merge,
        custom_config=custom_config,
    )

    if not success:
        print(f"Error: {result}", file=sys.stderr)
        sys.exit(1)

    if args.stdout or not output_path:
        if args.settings_format:
            print(json.dumps({"hooks": result}, indent=2))
        else:
            print(json.dumps(result, indent=2))
    else:
        print(f"Generated: {path}")


# ─── PreToolUse Dangerous Command Blocking ────────────────────────────────────
# These patterns match the CRITICAL patterns from security_scanner.py (SEC001-SEC008).
# A PreToolUse hook script checks stdin (tool_input JSON) against these patterns.
# Exit code 2 = deny the tool call (Claude Code convention).

# Regex patterns for dangerous commands, aligned with security_scanner.py CRITICAL list.
# Each tuple is (pattern, code, description).
DANGEROUS_COMMAND_PATTERNS: list[tuple[str, str, str]] = [
    (r"rm\s+-rf\s+[/~]", "SEC001", "Destructive file deletion (rm -rf / or ~)"),
    (r"\bsudo\b", "SEC002", "Privileged execution (sudo)"),
    (r"chmod\s+777\b", "SEC003", "Insecure file permissions (chmod 777)"),
    (r"\beval\s*\(", "SEC004", "Dynamic code execution (eval)"),
    (r"\bexec\s*\(", "SEC005", "Dynamic code execution (exec)"),
    (r">\s*/dev/sd[a-z]", "SEC006", "Direct disk write (> /dev/sdX)"),
    (r"dd\s+.*of=/dev/", "SEC007", "Direct disk write with dd"),
    (r":\s*\(\)\s*\{", "SEC008", "Fork bomb pattern"),
]


def generate_pretooluse_deny_script(agent_name: str) -> str:
    """Generate a bash script that denies dangerous commands in PreToolUse hooks.

    The script reads tool input from stdin (Claude Code passes tool_input JSON via stdin
    to PreToolUse hooks), checks the 'command' field against DANGEROUS_COMMAND_PATTERNS,
    _validate_agent_name(agent_name)
    and exits with code 2 (deny) if a match is found.

    Args:
        agent_name: Agent name for log messages

    Returns:
        Complete bash script as a string, ready to write to a file.
    """
    # Build grep pattern alternation from DANGEROUS_COMMAND_PATTERNS.
    # Only the regex is consumed here; the SEC code / description are embedded
    # in the generic stderr message written by the emitted script.
    grep_patterns = []
    for entry in DANGEROUS_COMMAND_PATTERNS:
        pattern = entry[0]
        # Escape single quotes for embedding in bash
        safe_pattern = pattern.replace("'", "'\\''")
        grep_patterns.append(f"    -e '{safe_pattern}'")

    grep_lines = " \\\n".join(grep_patterns)

    script = f"""#!/usr/bin/env bash
# PreToolUse deny hook for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# Blocks dangerous commands matching security_scanner.py CRITICAL patterns (SEC001-SEC008).
# Exit codes: 0 = allow, 2 = deny (Claude Code convention).
#
# Usage in settings.json:
#   "hooks": {{
#     "PreToolUse": [{{
#       "matcher": "Bash",
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-deny-dangerous.sh"
#       }}]
#     }}]
#   }}

set -euo pipefail

# Read tool input from stdin (Claude Code passes JSON via stdin to hooks)
TOOL_INPUT=$(cat)

# Only check Bash tool calls
if [ "${{CLAUDE_TOOL_NAME:-}}" != "Bash" ]; then
    exit 0
fi

# Extract the command field from the JSON input.
# Uses python for reliable JSON parsing; falls back to grep if unavailable.
COMMAND=""
if command -v python3 &>/dev/null; then
    COMMAND=$(echo "$TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "$TOOL_INPUT")
else
    COMMAND="$TOOL_INPUT"
fi

# Check against dangerous patterns (CRITICAL — SEC001-SEC008)
if echo "$COMMAND" | grep -qE \\
{grep_lines}; then
    echo "DENIED: {agent_name} blocked a dangerous command pattern" >&2
    echo "The command matches a CRITICAL security pattern (SEC001-SEC008)." >&2
    echo "Review security_scanner.py for details." >&2
    exit 2
fi

# Allow the tool call
exit 0
"""
    return script


def generate_pretooluse_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for dangerous command blocking.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the deny script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for PreToolUse.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


def generate_posttooluse_lint_script(agent_name: str) -> str:
    """Generate a bash script that runs language-appropriate linters after Write/Edit.

    The script reads tool input from stdin (Claude Code passes tool_input JSON via
    stdin to PostToolUse hooks), extracts the file_path, detects the language by
    _validate_agent_name(agent_name)
    extension, and runs the appropriate linter. Lint output is returned as
    additionalContext so Claude sees the violations inline.

    Supported linters:
    - Python (.py): ruff check
    - TypeScript/JavaScript (.ts, .tsx, .js, .jsx): eslint
    - Go (.go): golangci-lint run
    - Rust (.rs): cargo clippy (single file)

    Args:
        agent_name: Agent name for log messages

    Returns:
        Complete bash script as a string, ready to write to a file.
    """
    script = f"""#!/usr/bin/env bash
# PostToolUse auto-lint hook for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# After Write/Edit tool calls, detects file type and runs the appropriate linter.
# Lint output is printed to stdout as additionalContext for Claude.
# Exit code is always 0 (non-blocking) — lint output is advisory feedback.
#
# Usage in settings.json:
#   "hooks": {{
#     "PostToolUse": [{{
#       "matcher": "Write|Edit|MultiEdit",
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-auto-lint.sh"
#       }}]
#     }}]
#   }}

set -uo pipefail

# Read tool input from stdin (Claude Code passes JSON via stdin to hooks)
TOOL_INPUT=$(cat)

# Extract file_path from the JSON input
FILE_PATH=""
if command -v python3 &>/dev/null; then
    FILE_PATH=$(echo "$TOOL_INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('file_path', d.get('path', '')))" 2>/dev/null || echo "")
fi

# If no file path detected, nothing to lint
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Detect language by extension and run appropriate linter
EXT="${{FILE_PATH##*.}}"
LINT_OUTPUT=""

case "$EXT" in
    py)
        if command -v ruff &>/dev/null; then
            LINT_OUTPUT=$(ruff check --no-fix "$FILE_PATH" 2>&1 || true)
        fi
        ;;
    ts|tsx|js|jsx)
        if command -v eslint &>/dev/null; then
            LINT_OUTPUT=$(eslint --no-fix "$FILE_PATH" 2>&1 || true)
        fi
        ;;
    go)
        if command -v golangci-lint &>/dev/null; then
            LINT_OUTPUT=$(golangci-lint run "$FILE_PATH" 2>&1 || true)
        elif command -v go &>/dev/null; then
            LINT_OUTPUT=$(go vet "$FILE_PATH" 2>&1 || true)
        fi
        ;;
    rs)
        if command -v cargo &>/dev/null; then
            LINT_OUTPUT=$(cargo clippy --message-format=short 2>&1 | head -20 || true)
        fi
        ;;
esac

# Output lint results as additionalContext (Claude sees this inline)
if [ -n "$LINT_OUTPUT" ] && [ "$LINT_OUTPUT" != "All checks passed!" ]; then
    echo "[{agent_name}] Lint results for $FILE_PATH:"
    echo "$LINT_OUTPUT"
fi

# Always exit 0 — lint feedback is advisory, not blocking
exit 0
"""
    return script


def generate_posttooluse_lint_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for auto-linting after writes.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the lint script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for PostToolUse.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "PostToolUse": [
            {
                "matcher": "Write|Edit|MultiEdit",
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


def generate_stop_verification_script(agent_name: str) -> str:
    """Generate a bash script that blocks agent completion until verification passes.

    The Stop hook runs when Claude Code is about to end an agent session.
    It detects the project's test framework by checking for config files,
    runs the test suite, and blocks completion (exit 2) if tests fail.

    _validate_agent_name(agent_name)
    Detection order:
    1. pytest (pyproject.toml with [tool.pytest] or pytest.ini or conftest.py)
    2. vitest (vitest.config.ts or vite.config.ts with test)
    3. go test (go.mod present)
    4. No framework detected -> allow completion (exit 0)

    Exit codes per Claude Code convention:
    - 0: allow completion (tests pass or no framework detected)
    - 2: block completion (tests fail, with reason on stderr)

    Args:
        agent_name: Agent name for log messages

    Returns:
        Complete bash script as a string.
    """
    script = f"""#!/usr/bin/env bash
# Stop verification gate for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# Blocks agent completion until the test suite passes.
# Detects pytest, vitest, or go test by config file presence.
# Exit 0 = allow completion, exit 2 = block with reason.
#
# Usage in settings.json:
#   "hooks": {{
#     "Stop": [{{
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-verify-stop.sh"
#       }}]
#     }}]
#   }}

set -uo pipefail

REASON=""
EXIT_CODE=0

# --- Detect test framework and run tests ---

if [ -f "pyproject.toml" ] || [ -f "pytest.ini" ] || [ -f "conftest.py" ] || [ -d "tests" ]; then
    # Python project: run pytest
    if command -v pytest &>/dev/null; then
        echo "[{agent_name}] Running pytest verification gate..." >&2
        TEST_OUTPUT=$(pytest --tb=short -q 2>&1)
        TEST_EXIT=$?
        if [ $TEST_EXIT -ne 0 ]; then
            REASON="pytest failed (exit $TEST_EXIT). Fix failing tests before completion."
            EXIT_CODE=2
            echo "$TEST_OUTPUT" >&2
        fi
    fi

elif [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || [ -f "vitest.config.mts" ]; then
    # TypeScript/JavaScript project: run vitest
    if command -v vitest &>/dev/null; then
        echo "[{agent_name}] Running vitest verification gate..." >&2
        TEST_OUTPUT=$(vitest run --reporter=verbose 2>&1)
        TEST_EXIT=$?
        if [ $TEST_EXIT -ne 0 ]; then
            REASON="vitest failed (exit $TEST_EXIT). Fix failing tests before completion."
            EXIT_CODE=2
            echo "$TEST_OUTPUT" >&2
        fi
    elif command -v npx &>/dev/null; then
        echo "[{agent_name}] Running vitest via npx..." >&2
        TEST_OUTPUT=$(npx vitest run --reporter=verbose 2>&1)
        TEST_EXIT=$?
        if [ $TEST_EXIT -ne 0 ]; then
            REASON="vitest failed (exit $TEST_EXIT). Fix failing tests before completion."
            EXIT_CODE=2
            echo "$TEST_OUTPUT" >&2
        fi
    fi

elif [ -f "go.mod" ]; then
    # Go project: run go test
    if command -v go &>/dev/null; then
        echo "[{agent_name}] Running go test verification gate..." >&2
        TEST_OUTPUT=$(go test ./... 2>&1)
        TEST_EXIT=$?
        if [ $TEST_EXIT -ne 0 ]; then
            REASON="go test failed (exit $TEST_EXIT). Fix failing tests before completion."
            EXIT_CODE=2
            echo "$TEST_OUTPUT" >&2
        fi
    fi

fi

# --- Report result ---

if [ $EXIT_CODE -eq 2 ]; then
    echo "BLOCKED: {agent_name} verification gate failed." >&2
    echo "Reason: $REASON" >&2
    exit 2
fi

exit 0
"""
    return script


def generate_stop_verification_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for Stop verification gate.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the verification script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for Stop event.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "Stop": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


def _generate_event_script(agent_name: str, event: str, hook_config: HookConfig) -> str:
    """Generate a bash script for a single hook event.

    The script reads tool input JSON from stdin and executes the hook actions.
    For PreToolUse, a non-zero exit denies the tool call.

    Args:
        agent_name: Agent name for comments
        event: Hook event name (e.g. PreToolUse)
        hook_config: The hook configuration with actions

    Returns:
        Complete bash script as a string.
    """
    lines = [
        "#!/usr/bin/env bash",
        f"# {event} hook for {agent_name}",
        "# Generated by platxa-agent-generator hooks_generator.py",
        "#",
        f"# Event: {event} — {hook_config.description}",
        "# Exit 0 = allow, Exit 2 = deny (PreToolUse only)",
        "",
        "set -euo pipefail",
        "",
        "# Read tool input from stdin (Claude Code passes JSON via stdin)",
        'TOOL_INPUT=$(cat 2>/dev/null || echo "{}")',
        "",
    ]

    for action in hook_config.hooks:
        if action.timeout_ms:
            lines.append(f"# Timeout: {action.timeout_ms}ms")
        if action.background:
            lines.append(f"( {action.command} ) &")
        else:
            lines.append(action.command)
        lines.append("")

    lines.append("exit 0")
    return "\n".join(lines) + "\n"


def generate_hook_scripts(
    agent_name: str,
    hook_types: list[str] | None = None,
    events: list[str] | None = None,
    output_dir: str | Path = ".claude/hooks",
    custom_config: dict[str, Any] | None = None,
) -> tuple[list[Path], dict[str, Any]]:
    """Generate executable bash scripts and matching settings.json config.

    Creates one script per (event, hook_type) pair in output_dir, then returns
    a settings.json hooks config that references the script paths.

    Args:
        agent_name: Agent name
        hook_types: Types of hooks to generate
        events: Specific events to hook
        output_dir: Directory for script files (default: .claude/hooks)
        custom_config: Additional configuration

    Returns:
        Tuple of (list of created script Paths, settings.json hooks dict).
    """
    _validate_agent_name(agent_name)
    if hook_types is None:
        hook_types = ["audit", "logging"]

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    definition = generate_hooks(
        agent_name=agent_name,
        hook_types=hook_types,
        events=events,
        custom_config=custom_config,
    )

    created_scripts: list[Path] = []
    settings_hooks: dict[str, list[dict[str, Any]]] = {}

    for hook_config in definition.hooks:
        event = hook_config.event
        # Sanitize for filename: lowercase, replace non-alnum with dash
        hook_desc = hook_config.description.lower().replace(" ", "-")[:30]
        filename = f"{agent_name}-{event.lower()}-{hook_desc}.sh"
        script_path = output_path / filename

        # Generate and write the script
        script_content = _generate_event_script(agent_name, event, hook_config)
        script_path.write_text(script_content, encoding="utf-8")
        script_path.chmod(0o755)
        created_scripts.append(script_path)

        # Build settings.json entry pointing to this script
        if event not in settings_hooks:
            settings_hooks[event] = []
        settings_hooks[event].append(
            {
                "matcher": hook_config.matcher,
                "hooks": [
                    {
                        "type": "command",
                        "command": str(script_path.resolve()),
                    }
                ],
            }
        )

    return created_scripts, settings_hooks


# ─── Multi-Agent Team Coordination Hooks (Feature #40) ───────────────────────
# TeammateIdle / TaskCreated / TaskCompleted hooks for multi-agent quality
# gates. These events fire during agent-team coordination (see Claude Code
# agent-teams documentation). They do not support matchers.
#
# Exit code conventions:
#   0  = allow the default behavior (go idle / create task / mark completed)
#   2  = block the default behavior with reason on stderr (Claude Code convention)
# JSON  `{"continue": false, "stopReason": "..."}` on stdout stops the teammate
# entirely (matching Stop hook semantics).


def generate_teammate_idle_script(agent_name: str, team_name: str = "") -> str:
    """Generate a bash script for the TeammateIdle hook.

    Keeps a worker active when there is still pending work in the team's task
    list. Exit 2 prevents the teammate from going idle, giving it another turn
    to pick up unclaimed tasks. Exit 0 lets the teammate go idle normally.

    The script checks ``.claude/team-state/<team>/tasks.json`` (if present) for
    _validate_agent_name(agent_name)
    any tasks whose status is ``pending`` and not yet claimed by a teammate.
    If any are found, exits 2 with a message steering the teammate back to
    TaskList.

    Args:
        agent_name: Agent name for log messages.
        team_name: Optional team name. When empty, the script derives it from
            the ``CLAUDE_TEAM_NAME`` environment variable at runtime.

    Returns:
        Complete bash script as a string.
    """
    team_default = team_name or "${CLAUDE_TEAM_NAME:-default}"
    script = f"""#!/usr/bin/env bash
# TeammateIdle hook for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# Keeps the worker active while unclaimed tasks remain in the team's task list.
# Exit 0 = allow idle, Exit 2 = keep working (prevent idle).
#
# Usage in settings.json:
#   "hooks": {{
#     "TeammateIdle": [{{
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-teammate-idle.sh"
#       }}]
#     }}]
#   }}

set -uo pipefail

TEAM_NAME="{team_default}"
TASKS_FILE=".claude/team-state/${{TEAM_NAME}}/tasks.json"

# Read optional stdin JSON payload (teammate_name / team_name fields)
TOOL_INPUT=$(cat 2>/dev/null || echo "{{}}")

# If no task state file exists, allow idle (nothing to do)
if [ ! -f "$TASKS_FILE" ]; then
    exit 0
fi

# Count pending unclaimed tasks using python (falls back to grep if unavailable)
PENDING=0
if command -v python3 &>/dev/null; then
    PENDING=$(python3 -c "
import json, sys
try:
    with open('$TASKS_FILE') as f:
        data = json.load(f)
    tasks = data if isinstance(data, list) else data.get('tasks', [])
    pending = [
        t for t in tasks
        if t.get('status', 'pending') == 'pending' and not t.get('owner')
    ]
    print(len(pending))
except Exception:
    print(0)
" 2>/dev/null || echo 0)
else
    PENDING=$(grep -c '"status": *"pending"' "$TASKS_FILE" 2>/dev/null || echo 0)
fi

if [ "$PENDING" -gt 0 ]; then
    echo "[{agent_name}] TeammateIdle: $PENDING unclaimed task(s) remain — staying active." >&2
    echo "Run TaskList to pick up the next pending task in team '$TEAM_NAME'." >&2
    exit 2
fi

exit 0
"""
    return script


def generate_teammate_idle_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for the TeammateIdle gate.

    TeammateIdle does not support a matcher — it fires on every idle event.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the idle script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for TeammateIdle.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "TeammateIdle": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


def generate_task_created_script(agent_name: str) -> str:
    """Generate a bash script for the TaskCreated hook.

    Enforces team task conventions: rejects tasks with empty / whitespace-only
    subjects and tasks whose subject is shorter than a minimum length
    (configurable via ``CLAUDE_TASK_MIN_SUBJECT`` env var, default 8 chars).

    _validate_agent_name(agent_name)
    Input JSON from stdin (per Claude Code hook spec):
        {
          "task_id": "task-001",
          "task_subject": "...",
          "task_description": "...",
          "teammate_name": "implementer",
          "team_name": "my-project"
        }

    Exit codes:
        0 = allow task creation
        2 = deny task creation (stderr fed back to the model as feedback)

    Args:
        agent_name: Agent name for log messages.

    Returns:
        Complete bash script as a string.
    """
    script = f"""#!/usr/bin/env bash
# TaskCreated hook for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# Enforces minimum quality for tasks created by teammates.
# Exit 0 = allow task creation, Exit 2 = deny with reason on stderr.
#
# Usage in settings.json:
#   "hooks": {{
#     "TaskCreated": [{{
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-task-created.sh"
#       }}]
#     }}]
#   }}

set -uo pipefail

MIN_SUBJECT="${{CLAUDE_TASK_MIN_SUBJECT:-8}}"

TOOL_INPUT=$(cat 2>/dev/null || echo "{{}}")

SUBJECT=""
DESCRIPTION=""
if command -v python3 &>/dev/null; then
    PARSED=$(echo "$TOOL_INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    d = {{}}
print(d.get('task_subject', '') or '')
print(d.get('task_description', '') or '')
" 2>/dev/null || echo "")
    SUBJECT=$(echo "$PARSED" | sed -n '1p')
    DESCRIPTION=$(echo "$PARSED" | sed -n '2p')
fi

TRIMMED_SUBJECT=$(echo "$SUBJECT" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$TRIMMED_SUBJECT" ]; then
    echo "[{agent_name}] TaskCreated DENIED: task_subject is empty or missing." >&2
    echo "Provide an imperative, specific subject (e.g., 'Add rate limiting to /api/login')." >&2
    exit 2
fi

if [ "${{#TRIMMED_SUBJECT}}" -lt "$MIN_SUBJECT" ]; then
    echo "[{agent_name}] TaskCreated DENIED: task_subject too short (${{#TRIMMED_SUBJECT}} < $MIN_SUBJECT chars)." >&2
    echo "Subject: '$TRIMMED_SUBJECT'" >&2
    echo "Rewrite with a specific, actionable subject." >&2
    exit 2
fi

# Description is advisory (warn but allow)
if [ -z "$DESCRIPTION" ]; then
    echo "[{agent_name}] TaskCreated WARNING: task_description is empty." >&2
fi

exit 0
"""
    return script


def generate_task_created_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for the TaskCreated gate.

    TaskCreated does not support a matcher — it fires on every task creation.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the task-created script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for TaskCreated.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "TaskCreated": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


def generate_task_completed_script(agent_name: str) -> str:
    """Generate a bash script for the TaskCompleted hook.

    Validates deliverables before allowing a task to be marked completed.
    The script checks for a deliverable manifest at
    ``.claude/team-state/<team>/deliverables/<task_id>.json`` (or a plain
    ``<task_id>.done`` marker) and verifies that any referenced file paths
    exist on disk.

    The generated script denies completion (exit 2, stderr message, empty
    stdout) for every form of corrupt manifest: unreadable file, malformed
    JSON, non-object JSON root, non-list ``.files``, or any declared path
    missing from disk. Python owns the exit-code signaling — the script does
    not rely on command substitution to detect validator failure.

    Exit codes:
        0 = allow TaskCompleted
        2 = deny (deliverable missing or manifest corrupt) with reason on stderr

    Args:
        agent_name: Agent name for log messages.

    Raises:
        ValueError: if ``agent_name`` fails the standard name validator.

    Returns:
        Complete bash script as a string.
    """
    _validate_agent_name(agent_name)
    script = f"""#!/usr/bin/env bash
# TaskCompleted hook for {agent_name}
# Generated by platxa-agent-generator hooks_generator.py
#
# Validates that the task's declared deliverable exists before allowing the
# task to be marked completed.
# Exit 0 = allow, Exit 2 = deny with reason on stderr.
#
# Usage in settings.json:
#   "hooks": {{
#     "TaskCompleted": [{{
#       "hooks": [{{
#         "type": "command",
#         "command": "/path/to/{agent_name}-task-completed.sh"
#       }}]
#     }}]
#   }}

set -uo pipefail

# python3 is required to extract task_id and validate the deliverable manifest.
# Without it we cannot verify completion, so fail closed (deny) rather than
# silently skipping validation — matching the root-cause posture of the rest
# of this gate.
if ! command -v python3 &>/dev/null; then
    echo "[{agent_name}] TaskCompleted DENIED: python3 is required for manifest validation but was not found on PATH." >&2
    exit 2
fi

TEAM_NAME="${{CLAUDE_TEAM_NAME:-default}}"

TOOL_INPUT=$(cat 2>/dev/null || echo "{{}}")

TASK_ID=$(echo "$TOOL_INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    d = {{}}
print(d.get('task_id', '') or '')
" 2>/dev/null || echo "")

if [ -z "$TASK_ID" ]; then
    echo "[{agent_name}] TaskCompleted DENIED: no task_id in stdin payload." >&2
    echo "The TaskCompleted hook contract requires a task_id; refusing to mark complete." >&2
    echo "Check the teammate harness and ensure task_id is propagated to hook input." >&2
    exit 2
fi

BASE_DIR=".claude/team-state/${{TEAM_NAME}}/deliverables"
MANIFEST="$BASE_DIR/${{TASK_ID}}.json"
MARKER="$BASE_DIR/${{TASK_ID}}.done"

# Accept a simple marker file as valid
if [ -f "$MARKER" ]; then
    exit 0
fi

if [ ! -f "$MANIFEST" ]; then
    echo "[{agent_name}] TaskCompleted DENIED for task '$TASK_ID':" >&2
    echo "No deliverable manifest at $MANIFEST and no marker at $MARKER." >&2
    echo "Write the manifest or touch the marker before marking the task complete." >&2
    exit 2
fi

# Validate the manifest: JSON-parseable, JSON object at root, .files is a
# list of strings, every declared file exists. Python owns exit-code
# signaling so no form of corruption can silently pass — a previous version
# used `MISSING=$(python3 ...) || echo ""` which swallowed Python errors and
# let non-dict JSON bypass the gate. Any non-zero Python exit now propagates
# directly to the script's exit code.
MANIFEST_PATH="$MANIFEST" AGENT_NAME="{agent_name}" TASK_ID_ENV="$TASK_ID" \\
    python3 - <<'PYEOF'
import json
import os
import sys

manifest = os.environ.get("MANIFEST_PATH", "")
agent = os.environ.get("AGENT_NAME", "")
task_id = os.environ.get("TASK_ID_ENV", "")


def deny(reason):
    sys.stderr.write(
        f"[{{agent}}] TaskCompleted DENIED for task '{{task_id}}': {{reason}}\\n"
    )
    sys.exit(2)


try:
    with open(manifest) as f:
        data = json.load(f)
except OSError as e:
    deny(f"cannot read manifest at {{manifest}}: {{e}}")
except json.JSONDecodeError as e:
    deny(f"manifest parse error: {{e}}")

if not isinstance(data, dict):
    deny(f"manifest must be a JSON object, got {{type(data).__name__}}")

files = data.get("files", [])
if not isinstance(files, list):
    deny(f"manifest .files must be a list, got {{type(files).__name__}}")

missing = [p for p in files if not isinstance(p, str) or not os.path.exists(p)]
if missing:
    sys.stderr.write(
        f"[{{agent}}] TaskCompleted DENIED for task '{{task_id}}': "
        "declared deliverable files are missing:\\n"
    )
    for m in missing:
        sys.stderr.write(f"  {{m}}\\n")
    sys.exit(2)
PYEOF
PY_EXIT=$?
if [ "$PY_EXIT" -ne 0 ]; then
    exit "$PY_EXIT"
fi

exit 0
"""
    return script


def generate_task_completed_hook_config(agent_name: str, script_path: str) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for the TaskCompleted gate.

    TaskCompleted does not support a matcher — it fires on every completion.

    Args:
        agent_name: Agent name — validated for non-empty at the API boundary.
        script_path: Absolute path to the task-completed script.

    Raises:
        ValueError: if agent_name or script_path is empty / whitespace-only.

    Returns:
        Dict in settings.json hooks format for TaskCompleted.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")
    return {
        "TaskCompleted": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": script_path,
                    }
                ],
            }
        ]
    }


_SUBAGENT_AUDIT_TEMPLATE = r"""#!/usr/bin/env bash
# SubagentStart/SubagentStop audit hook for __AGENT_NAME__
# Generated by platxa-agent-generator hooks_generator.py
#
# Appends one JSONL record per subagent start/stop event.
# SubagentStart fields: agent, event, agent_id, agent_type, timestamp
# SubagentStop  fields: agent, event, agent_id, last_assistant_message,
#                       duration_ms, timestamp
#
# Register on BOTH events in settings.json:
#   "hooks": {
#     "SubagentStart": [{"hooks": [{"type": "command",
#                                   "command": "/abs/path/__AGENT_NAME__-subagent-audit.sh"}]}],
#     "SubagentStop":  [{"hooks": [{"type": "command",
#                                   "command": "/abs/path/__AGENT_NAME__-subagent-audit.sh"}]}]
#   }

set -uo pipefail

LOG_FILE="__LOG_FILE__"
AGENT_NAME="__AGENT_NAME__"

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Read Claude Code hook JSON payload (fall back to "{}" when absent/invalid)
TOOL_INPUT=$(cat 2>/dev/null || echo "{}")

if ! command -v python3 >/dev/null 2>&1; then
    EV="${CLAUDE_HOOK_EVENT:-unknown}"
    AID="${CLAUDE_AGENT_ID:-unknown}"
    echo "{\"agent\":\"$AGENT_NAME\",\"event\":\"$EV\",\"agent_id\":\"$AID\"}" >> "$LOG_FILE"
    exit 0
fi

export TOOL_INPUT AGENT_NAME LOG_FILE
python3 - <<'PYEOF' || true
import json
import os
import sys
import time


# _warn surfaces failures on stderr without breaking the hook (always exit 0).
def _warn(msg):
    sys.stderr.write(f"[subagent-audit] {msg}\n")


agent_name = os.environ.get("AGENT_NAME", "")
log_file = os.environ.get("LOG_FILE", ".claude/audit.jsonl")
try:
    data = json.loads(os.environ.get("TOOL_INPUT") or "{}")
except Exception as e:
    _warn(f"stdin payload not valid JSON: {e}; falling back to env vars")
    data = {}

event = data.get("hook_event_name") or os.environ.get("CLAUDE_HOOK_EVENT", "")
agent_id = data.get("agent_id") or os.environ.get("CLAUDE_AGENT_ID", "")
agent_type = data.get("agent_type") or os.environ.get("CLAUDE_AGENT_TYPE", "")
last_msg = (
    data.get("last_assistant_message")
    or os.environ.get("CLAUDE_LAST_ASSISTANT_MESSAGE", "")
)

# Compose timing key from session_id + agent_id so concurrent subagents that
# happen to share an agent_id (e.g. across nested sessions) do not collide on
# the same /tmp file. session_id falls back to env var or "global" so the key
# is always deterministic for a Start/Stop pair within the same hook context.
session_id = (
    data.get("session_id")
    or os.environ.get("CLAUDE_SESSION_ID", "")
    or "global"
)
timing_key = f"{session_id}-{agent_id or 'unknown'}"
timing_file = f"/tmp/{agent_name}-subagent-{timing_key}-start"
timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

record = None
if event == "SubagentStart":
    try:
        with open(timing_file, "w", encoding="utf-8") as f:
            f.write(str(time.time_ns()))
    except OSError as e:
        _warn(f"could not write timing file {timing_file}: {e}")
    record = {
        "agent": agent_name,
        "event": "SubagentStart",
        "agent_id": agent_id,
        "agent_type": agent_type,
        "timestamp": timestamp,
    }
elif event == "SubagentStop":
    duration_ms = 0
    try:
        with open(timing_file, encoding="utf-8") as f:
            start_ns = int((f.read() or "0").strip())
        duration_ms = (time.time_ns() - start_ns) // 1_000_000
    except FileNotFoundError:
        _warn(
            f"no timing file {timing_file} for SubagentStop "
            f"(missing SubagentStart?); duration_ms=0"
        )
    except (ValueError, OSError) as e:
        _warn(f"could not read timing file {timing_file}: {e}; duration_ms=0")
    try:
        os.unlink(timing_file)
    except FileNotFoundError:
        pass
    except OSError as e:
        _warn(f"could not remove timing file {timing_file}: {e}")
    record = {
        "agent": agent_name,
        "event": "SubagentStop",
        "agent_id": agent_id,
        "last_assistant_message": last_msg,
        "duration_ms": duration_ms,
        "timestamp": timestamp,
    }
else:
    # Unknown / misconfigured event — emit a warning record so observability
    # systems see the misconfiguration instead of silently dropping it.
    _warn(f"unknown hook_event_name {event!r}; logging warning record")
    record = {
        "agent": agent_name,
        "event": "UnknownSubagentEvent",
        "received_event": event,
        "agent_id": agent_id,
        "timestamp": timestamp,
    }

if record is not None:
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except OSError as e:
        _warn(f"could not append to audit log {log_file}: {e}")
PYEOF

exit 0
"""


def generate_subagent_audit_script(
    agent_name: str,
    log_file: str = ".claude/audit.jsonl",
) -> str:
    """Generate a bash script for SubagentStart/SubagentStop audit logging.

    One script handles both events via ``hook_event_name`` dispatch. Reads the
    Claude Code hook JSON payload from stdin and appends a JSONL record to
    ``log_file`` per event, falling back to CLAUDE_HOOK_EVENT / CLAUDE_AGENT_ID
    / CLAUDE_AGENT_TYPE / CLAUDE_LAST_ASSISTANT_MESSAGE env vars when the
    corresponding stdin fields are absent.

    SubagentStart writes a nanosecond timestamp to ``/tmp/{agent}-subagent-
    {agent_id}-start`` so SubagentStop can compute ``duration_ms``. When the
    timing file is missing (out-of-order events, different host, etc.)
    ``duration_ms`` is 0.

    Args:
        agent_name: Agent name included in each JSONL record.
        log_file: Destination path for the JSONL audit log (default
            ``.claude/audit.jsonl``). The parent directory is created at
            runtime if missing.

    Raises:
        ValueError: if ``agent_name`` or ``log_file`` is empty / whitespace.

    Returns:
        Complete bash script as a string.
    """
    _validate_agent_name(agent_name)
    if not log_file or not log_file.strip():
        raise ValueError("log_file must be a non-empty string")
    return _SUBAGENT_AUDIT_TEMPLATE.replace("__AGENT_NAME__", agent_name).replace(
        "__LOG_FILE__", log_file
    )


def generate_subagent_audit_hook_config(
    agent_name: str,
    script_path: str,
) -> dict[str, Any]:
    """Generate Claude Code settings.json hook config for subagent audit.

    Registers ``script_path`` on both SubagentStart and SubagentStop events
    without a matcher. The same script handles both events via internal
    ``hook_event_name`` dispatch.

    Args:
        agent_name: Agent name — validated non-empty at the API boundary.
        script_path: Absolute path to the audit script.

    Raises:
        ValueError: if ``agent_name`` or ``script_path`` is empty / whitespace.

    Returns:
        Dict in settings.json hooks format containing both SubagentStart and
        SubagentStop registrations pointing at ``script_path``.
    """
    _validate_agent_name(agent_name)
    if not script_path or not script_path.strip():
        raise ValueError("script_path must be a non-empty string")

    def _entry() -> dict[str, Any]:
        return {
            "hooks": [
                {
                    "type": "command",
                    "command": script_path,
                }
            ],
        }

    return {
        "SubagentStart": [_entry()],
        "SubagentStop": [_entry()],
    }


def generate_subagent_audit_hooks(
    agent_name: str,
    output_dir: str | Path = ".claude/hooks",
    log_file: str = ".claude/audit.jsonl",
) -> tuple[list[Path], dict[str, Any]]:
    """Generate the subagent audit script and settings.json fragment.

    Writes ``{output_dir}/{agent_name}-subagent-audit.sh`` (chmod 0755) and
    returns its path along with the settings.json hook config that registers
    the same script on SubagentStart and SubagentStop.

    Args:
        agent_name: Agent name used in the filename and in each JSONL record.
        output_dir: Directory where the script is written
            (default ``.claude/hooks``).
        log_file: Destination path for the JSONL audit log
            (default ``.claude/audit.jsonl``).

    Returns:
        Tuple of (list with the single created Path, settings.json hooks dict).
    """
    _validate_agent_name(agent_name)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    script_content = generate_subagent_audit_script(agent_name, log_file)
    script_file = output_path / f"{agent_name}-subagent-audit.sh"
    script_file.write_text(script_content, encoding="utf-8")
    script_file.chmod(0o755)

    settings_hooks = generate_subagent_audit_hook_config(agent_name, str(script_file.resolve()))
    return [script_file], settings_hooks


def generate_multi_agent_hooks(
    agent_name: str,
    team_name: str = "",
    output_dir: str | Path = ".claude/hooks",
) -> tuple[list[Path], dict[str, Any]]:
    """Generate all three multi-agent coordination hook scripts for a team.

    Produces TeammateIdle, TaskCreated, and TaskCompleted scripts in
    ``output_dir`` and returns the combined settings.json hook config.

    Args:
        agent_name: Agent name used in filenames and script messages.
        team_name: Optional team name baked into the TeammateIdle script.
            When empty, the script derives it from CLAUDE_TEAM_NAME at runtime.
        output_dir: Directory where scripts will be written.

    Returns:
        Tuple of (list of created script Paths, merged settings.json hooks dict).
    """
    _validate_agent_name(agent_name)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    specs: list[tuple[str, str, Any]] = [
        (
            "teammate-idle",
            generate_teammate_idle_script(agent_name, team_name),
            generate_teammate_idle_hook_config,
        ),
        (
            "task-created",
            generate_task_created_script(agent_name),
            generate_task_created_hook_config,
        ),
        (
            "task-completed",
            generate_task_completed_script(agent_name),
            generate_task_completed_hook_config,
        ),
    ]

    created: list[Path] = []
    settings_hooks: dict[str, list[dict[str, Any]]] = {}

    for suffix, script_content, config_fn in specs:
        script_file = output_path / f"{agent_name}-{suffix}.sh"
        script_file.write_text(script_content, encoding="utf-8")
        script_file.chmod(0o755)
        created.append(script_file)

        entry = config_fn(agent_name, str(script_file.resolve()))
        for event, hook_list in entry.items():
            settings_hooks.setdefault(event, []).extend(hook_list)

    return created, settings_hooks


if __name__ == "__main__":
    main()
