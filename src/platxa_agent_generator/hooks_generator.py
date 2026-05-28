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
    quoted_log = shlex.quote(log_file)
    timestamp_cmd = "date -Iseconds"

    if event == "SessionStart":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SESSION_START user=$USER" >> {quoted_log}'
        )
    elif event == "Stop":
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) SESSION_END" >> {quoted_log}'
    elif event == "PreToolUse":
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) PRE_TOOL tool=$CLAUDE_TOOL_NAME" >> {quoted_log}'
    elif event == "PostToolUse":
        fmt = (
            '{"timestamp":"%s","tool":"%s",'
            '"input_summary":"PostToolUse",'
            '"project_id":"%s","project_name":"%s",'
            f'"agent_name":"{quoted_name}",'
            '"session_id":"%s","type":"tool_use",'
            '"evidence":"","examples":[],'
            '"outcome":"","confidence":1.0,'
            '"promoted_to":null}\\n'
        )
        args = (
            f'"$({timestamp_cmd})" "$CLAUDE_TOOL_NAME"'
            ' "${CLAUDE_PROJECT_DIR:-unknown}"'
            ' "$(basename "${CLAUDE_PROJECT_DIR:-unknown}")"'
            ' "${CLAUDE_SESSION_ID:-}"'
        )
        command = f"printf '{fmt}' {args} >> {quoted_log}"
    elif event == "SubagentStart":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SUBAGENT_START '
            f"agent_id=${{CLAUDE_AGENT_ID:-unknown}} "
            f'agent_type=${{CLAUDE_AGENT_TYPE:-unknown}}" >> {quoted_log}'
        )
    elif event == "SubagentStop":
        command = (
            f'echo "[{quoted_name}] $({timestamp_cmd}) SUBAGENT_STOP '
            f'agent_id=${{CLAUDE_AGENT_ID:-unknown}}" >> {quoted_log}'
        )
    else:
        command = f'echo "[{quoted_name}] $({timestamp_cmd}) {event}" >> {quoted_log}'

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
        quoted_script = shlex.quote(policy_script)
        command = f"{quoted_script} --agent {quoted_name} --event {event}"
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
        quoted_endpoint = shlex.quote(metrics_endpoint)
        command = (
            f"curl -s -X POST {quoted_endpoint} "
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
    quoted_log = shlex.quote(log_file)

    # Structured JSON logging
    command = (
        f'echo \'{{"timestamp":"\'$(date -Iseconds)\'","level":"{log_level}",'
        f'"agent":"{quoted_name}","event":"{event}",'
        f'"tool":"\'$CLAUDE_TOOL_NAME\'"}}\' >> {quoted_log}'
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


if __name__ == "__main__":
    main()
