#!/usr/bin/env python3
"""
Syntax Validator for Agent Definition Files

Validates YAML frontmatter and markdown structure in Claude Code agent files.

Usage:
    python syntax_validator.py agent.md
    python syntax_validator.py --json agent.md
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

# ValidationError is sourced from the shared canonical parser
# (feature #26) so agent_linter and the new shared.frontmatter module
# speak the same vocabulary. The re-export below preserves backward
# compatibility for callers that still do ``from syntax_validator
# import ValidationError``.
try:
    from .shared.frontmatter import ValidationError, parse_frontmatter_safe
except ImportError:
    from shared.frontmatter import (  # type: ignore[import-not-found,no-redef]
        ValidationError,
        parse_frontmatter_safe,
    )

__all__ = [
    "INSTINCT_FIELD_CONSTRAINTS",
    "INSTINCT_REQUIRED_FIELDS",
    "INSTINCT_TYPES",
    "InstinctSchemaError",
    "ValidationError",
    "assert_valid_instinct_frontmatter",
    "validate_instinct_frontmatter",
]


@dataclass
class ValidationResult:
    """Result of syntax validation."""

    passed: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)
    frontmatter: dict | None = None
    sections: list[str] = field(default_factory=list)


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
}

# Required frontmatter fields
REQUIRED_FIELDS = ["name", "description", "tools"]

# Valid permission modes for Claude Code agents
VALID_PERMISSION_MODES = {
    "default",
    "acceptEdits",
    "bypassPermissions",
    "dontAsk",
}

# Valid model tiers for Claude Code agents
VALID_MODELS = {
    "haiku",
    "sonnet",
    "opus",
}

# Valid isolation modes
VALID_ISOLATION_MODES = {
    "worktree",
}

# Valid effort levels (extended thinking intensity)
VALID_EFFORT_LEVELS = {
    "low",
    "medium",
    "high",
}

# Valid background values (YAML booleans that parse to string)
VALID_BOOLEAN_STRINGS = {"true", "false", "True", "False", "yes", "no"}

# Color validation: CSS named colors + hex pattern
CSS_HEX_COLOR_PATTERN = r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
CSS_NAMED_COLORS = {
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "pink",
    "cyan",
    "magenta",
    "white",
    "black",
    "gray",
    "grey",
    "brown",
    "teal",
    "navy",
    "lime",
    "indigo",
    "violet",
    "coral",
    "salmon",
    "gold",
    "silver",
    "crimson",
    "turquoise",
}

# Field constraints
FIELD_CONSTRAINTS = {
    "name": {"max_length": 64, "pattern": r"^[a-z][a-z0-9-]*$"},
    "description": {"max_length": 1024},
}


def parse_frontmatter(
    content: str,
) -> tuple[dict | None, list[ValidationError], int, dict | None]:
    """Parse YAML frontmatter and return the tuple this module's callers expect.

    Delegates the delimiter + YAML load + type check to
    ``shared.frontmatter.parse_frontmatter_safe`` so there is a single
    reviewed implementation across the whole suite (feature #26). The
    4-tuple return shape is kept for backward compatibility: the extra
    ``end_line`` and ``raw_frontmatter`` slots are used by this module's
    downstream line-numbered validators.
    """
    # Delegate the core parse. ``parse_frontmatter_safe`` emits
    # ValidationError(E001/E002/E003) so this function only needs to
    # compute the accompanying end_line + raw_frontmatter slots.
    frontmatter, errors = parse_frontmatter_safe(content)

    if frontmatter is None:
        # Determine end_line for the failure-mode return shape. The
        # 4-tuple contract is unchanged: callers that depend on
        # ``end_line`` after a failure (e.g. to anchor subsequent
        # warnings) still get the same numbers they got pre-refactor.
        lines = content.split("\n")
        if errors and errors[0].code == "E001":
            fallback_end_line = 0
        elif errors and errors[0].code == "E002":
            fallback_end_line = len(lines)
        else:
            # E003 — we successfully found both delimiters; recompute
            # end_line here because parse_frontmatter_safe doesn't
            # return it (spec pins the 2-tuple shape).
            fallback_end_line = -1
            for i, line in enumerate(lines[1:], start=2):
                if line.strip() == "---":
                    fallback_end_line = i
                    break
        return None, errors, fallback_end_line, None

    # Find closing delimiter's line number for downstream message
    # anchoring. parse_frontmatter_safe already proved one exists, so
    # this linear scan is guaranteed to find it.
    end_line = -1
    lines = content.split("\n")
    for i, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            end_line = i
            break

    # Keep raw frontmatter for nested structure validation (mcpServers, hooks)
    raw_frontmatter = dict(frontmatter)

    # Convert all values to strings for consistent handling of scalar fields
    normalized: dict[str, str] = {}
    for key, value in frontmatter.items():
        if isinstance(value, list):
            # Handle YAML lists - convert to comma-separated string
            normalized[str(key)] = ", ".join(str(v) for v in value)
        elif isinstance(value, dict):
            # Preserve nested dicts as marker string; use raw_frontmatter for deep validation
            normalized[str(key)] = f"<nested:{key}>"
        elif value is None:
            normalized[str(key)] = ""
        else:
            normalized[str(key)] = str(value)

    return normalized, errors, end_line, raw_frontmatter


def validate_frontmatter_fields(frontmatter: dict, start_line: int = 1) -> list[ValidationError]:
    """Validate frontmatter field values."""
    errors: list[ValidationError] = []

    # Check required fields
    for field_name in REQUIRED_FIELDS:
        if field_name not in frontmatter:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E010",
                    message=f"Missing required field: {field_name}",
                )
            )
        elif not frontmatter[field_name]:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E011",
                    message=f"Empty required field: {field_name}",
                )
            )

    # Validate name field
    if "name" in frontmatter and frontmatter["name"]:
        name = frontmatter["name"]
        constraints = FIELD_CONSTRAINTS["name"]

        if len(name) > constraints["max_length"]:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E012",
                    message=f"Name exceeds {constraints['max_length']} characters: {len(name)}",
                )
            )

        if not re.match(constraints["pattern"], name):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E013",
                    message=f"Name must be hyphen-case (lowercase, hyphens, start with letter): {name}",
                )
            )

    # Validate description field
    if "description" in frontmatter and frontmatter["description"]:
        desc = frontmatter["description"]
        max_len = FIELD_CONSTRAINTS["description"]["max_length"]

        if len(desc) > max_len:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E014",
                    message=f"Description exceeds {max_len} characters: {len(desc)}",
                )
            )

        # W029: Description should start with action verb for auto-delegation
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
        first_word = desc.split()[0].lower().rstrip("s") if desc.split() else ""
        # Also match verbs ending in -e that got stripped (e.g. "generates" -> "generat")
        verb_match = (
            first_word in action_verbs
            or first_word.rstrip("e") in action_verbs
            or first_word + "e" in action_verbs
        )
        if not verb_match:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="warning",
                    code="W029",
                    message=(
                        f"Description starts with '{desc.split()[0]}' — "
                        "start with an action verb (e.g., 'Analyzes', 'Generates', 'Scans') "
                        "for better Claude Code auto-delegation."
                    ),
                )
            )

        # W030: Description too vague for delegation
        vague_descriptions = [
            r"^(a|an|the)\s+(simple|basic|generic)\s+agent",
            r"^agent\s+(that|which|for)",
            r"^(does|handles|manages)\s+",
            r"^(helper|utility|tool)\s+(for|that|which)",
        ]
        for pattern in vague_descriptions:
            if re.match(pattern, desc, re.IGNORECASE):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="warning",
                        code="W030",
                        message=(
                            "Description is too vague for auto-delegation. "
                            "Be specific about what the agent does, not what it is. "
                            "Example: 'Scans Python code for OWASP vulnerabilities' "
                            "instead of 'A simple agent that handles security'."
                        ),
                    )
                )
                break

    # Validate tools field
    if "tools" in frontmatter and frontmatter["tools"]:
        tools_str = frontmatter["tools"]
        tools = [t.strip() for t in tools_str.split(",")]

        for tool in tools:
            if tool and tool not in VALID_TOOLS:
                # Check for MCP tools (mcp__*)
                if not tool.startswith("mcp__"):
                    errors.append(
                        ValidationError(
                            line=start_line,
                            column=1,
                            severity="error",
                            code="E015",
                            message=f"Invalid tool name: {tool}",
                        )
                    )

    # Validate permissionMode field (optional)
    if "permissionMode" in frontmatter and frontmatter["permissionMode"]:
        mode = frontmatter["permissionMode"]
        if mode not in VALID_PERMISSION_MODES:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E016",
                    message=(
                        f"Invalid permissionMode: {mode}. "
                        f"Must be one of: {', '.join(sorted(VALID_PERMISSION_MODES))}"
                    ),
                )
            )

        # Warn if bypassPermissions used with high-risk tools
        if mode == "bypassPermissions":
            tools_str = frontmatter.get("tools", "")
            tools = [t.strip() for t in tools_str.split(",")]
            high_risk = {"Bash", "Write", "Edit", "WebFetch"}
            risky = [t for t in tools if t in high_risk]
            if risky:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="warning",
                        code="W016",
                        message=(
                            f"bypassPermissions with high-risk tools ({', '.join(risky)}) "
                            "— consider using 'acceptEdits' or 'default' instead"
                        ),
                    )
                )

    # Validate maxTurns field (optional)
    if "maxTurns" in frontmatter and frontmatter["maxTurns"]:
        raw_value = frontmatter["maxTurns"]
        try:
            max_turns = int(raw_value)
            if max_turns <= 0:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E017",
                        message=f"maxTurns must be a positive integer, got: {max_turns}",
                    )
                )
            elif max_turns > 200:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="warning",
                        code="W017",
                        message=(
                            f"maxTurns={max_turns} is very high — agents with >200 turns "
                            "risk excessive token consumption and context degradation"
                        ),
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E017",
                    message=f"maxTurns must be a positive integer, got: {raw_value}",
                )
            )

    # Validate model field (optional)
    if "model" in frontmatter and frontmatter["model"]:
        model = frontmatter["model"]
        if model not in VALID_MODELS:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E018",
                    message=(
                        f"Invalid model: {model}. Must be one of: {', '.join(sorted(VALID_MODELS))}"
                    ),
                )
            )

    # Validate disallowedTools field (optional)
    if "disallowedTools" in frontmatter and frontmatter["disallowedTools"]:
        disallowed_str = frontmatter["disallowedTools"]
        disallowed = [t.strip() for t in disallowed_str.split(",")]
        tools_str = frontmatter.get("tools", "")
        allowed_tools = {t.strip() for t in tools_str.split(",") if t.strip()}

        for tool in disallowed:
            if not tool:
                continue
            # Validate tool name (same rules as tools field)
            if tool not in VALID_TOOLS and not tool.startswith("mcp__"):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E019",
                        message=f"Invalid tool name in disallowedTools: {tool}",
                    )
                )
            # Check for overlap with allowed tools — contradictory config
            if tool in allowed_tools:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E020",
                        message=(
                            f"Tool '{tool}' is in both tools and disallowedTools "
                            "— this is contradictory. Remove from one list."
                        ),
                    )
                )

    # Validate isolation field (optional)
    if "isolation" in frontmatter and frontmatter["isolation"]:
        isolation = frontmatter["isolation"]
        if isolation not in VALID_ISOLATION_MODES:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E021",
                    message=(
                        f"Invalid isolation mode: {isolation}. "
                        f"Must be one of: {', '.join(sorted(VALID_ISOLATION_MODES))}"
                    ),
                )
            )
        elif isolation == "worktree" and tools:
            # Warn if isolation: worktree is set but no file-modifying tools present
            file_modifying_tools = {"Write", "Edit", "Bash"}
            if not file_modifying_tools & set(tools):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="warning",
                        code="W021",
                        message=(
                            "isolation: worktree is set but agent has no file-modifying "
                            "tools (Write, Edit, Bash). Worktree isolation is only useful "
                            "for agents that modify files in parallel."
                        ),
                    )
                )

    # Validate effort field (optional)
    if "effort" in frontmatter and frontmatter["effort"]:
        effort = frontmatter["effort"]
        if effort not in VALID_EFFORT_LEVELS:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E022",
                    message=(
                        f"Invalid effort level: {effort}. "
                        f"Must be one of: {', '.join(sorted(VALID_EFFORT_LEVELS))}"
                    ),
                )
            )

    # Validate background field (optional) — must be a boolean value
    if "background" in frontmatter and frontmatter["background"]:
        bg_value = frontmatter["background"]
        if bg_value not in VALID_BOOLEAN_STRINGS:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E023",
                    message=f"Invalid background value: {bg_value}. Must be true or false.",
                )
            )

    # Validate color field (optional) — CSS named color or hex
    if "color" in frontmatter and frontmatter["color"]:
        color = frontmatter["color"]
        is_named = color.lower() in CSS_NAMED_COLORS
        is_hex = bool(re.match(CSS_HEX_COLOR_PATTERN, color))
        if not is_named and not is_hex:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E024",
                    message=(
                        f"Invalid color: {color}. "
                        "Must be a CSS named color (red, blue, green...) "
                        "or hex (#rgb or #rrggbb)"
                    ),
                )
            )

    return errors


def validate_mcp_servers(raw_frontmatter: dict, start_line: int = 1) -> list[ValidationError]:
    """Validate mcpServers frontmatter field structure.

    Each MCP server must have either 'command' (for stdio transport)
    or 'url' (for http/sse transport). Server names must be non-empty strings.

    Error codes:
        E025: Invalid mcpServers structure (not a dict, missing command/url,
              invalid server entry)
    """
    errors: list[ValidationError] = []

    if "mcpServers" not in raw_frontmatter:
        return errors

    servers = raw_frontmatter["mcpServers"]

    # mcpServers must be a mapping
    if not isinstance(servers, dict):
        errors.append(
            ValidationError(
                line=start_line,
                column=1,
                severity="error",
                code="E025",
                message=f"mcpServers must be a YAML mapping, got {type(servers).__name__}",
            )
        )
        return errors

    for server_name, server_config in servers.items():
        # Server name must be a non-empty string
        if not isinstance(server_name, str) or not server_name.strip():
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E025",
                    message="mcpServers key must be a non-empty string",
                )
            )
            continue

        # Each server entry must be a mapping
        if not isinstance(server_config, dict):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E025",
                    message=(
                        f"mcpServers.{server_name} must be a YAML mapping, "
                        f"got {type(server_config).__name__}"
                    ),
                )
            )
            continue

        # Must have either 'command' (stdio) or 'url' (http/sse)
        has_command = "command" in server_config
        has_url = "url" in server_config

        if not has_command and not has_url:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E025",
                    message=(
                        f"mcpServers.{server_name} must have either 'command' "
                        "(stdio transport) or 'url' (http/sse transport)"
                    ),
                )
            )

        # If 'command' is present, it must be a non-empty string
        if has_command:
            cmd = server_config["command"]
            if not isinstance(cmd, str) or not cmd.strip():
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E025",
                        message=f"mcpServers.{server_name}.command must be a non-empty string",
                    )
                )

        # If 'url' is present, it must be a non-empty string
        if has_url:
            url = server_config["url"]
            if not isinstance(url, str) or not url.strip():
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E025",
                        message=f"mcpServers.{server_name}.url must be a non-empty string",
                    )
                )

        # If 'args' is present, it must be a list
        if "args" in server_config:
            args = server_config["args"]
            if not isinstance(args, list):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E025",
                        message=(
                            f"mcpServers.{server_name}.args must be a list, "
                            f"got {type(args).__name__}"
                        ),
                    )
                )

        # If 'env' is present, it must be a mapping
        if "env" in server_config:
            env = server_config["env"]
            if not isinstance(env, dict):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E025",
                        message=(
                            f"mcpServers.{server_name}.env must be a YAML mapping, "
                            f"got {type(env).__name__}"
                        ),
                    )
                )

    return errors


# ---------------------------------------------------------------------------
# Instinct frontmatter schema (feature #8)
#
# The instinct.md.j2 template (feature #4) renders these fields and the
# InstinctStore (feature #6) writes the rendered file as opaque bytes,
# deferring schema validation here. The validator surface is sibling to
# ``validate_frontmatter_fields`` (agents) and ``validate_mcp_servers``
# (MCP block) — same dataclass-collector pattern, distinct error-code
# range so failures from the two shapes never collide.
#
# Verification (per spec): "Invalid frontmatter (oversized name, bad
# confidence, unknown type) raises ValidationError with specific field
# name." The collector returns ValidationError dataclass entries whose
# ``message`` always starts with ``Field 'X'`` so the field name is
# structurally visible. ``assert_valid_instinct_frontmatter`` is the
# raise-on-error wrapper that satisfies the literal "raises" wording —
# its ``InstinctSchemaError`` (a ``ValueError`` subclass) carries every
# offending field name in its message.
# ---------------------------------------------------------------------------

# The 8-value vocabulary is owned by feature #8. Downstream features
# (observer #10, instinct-promoter #14, dedup #20, distill_principle
# #23, cluster_instincts #24) depend on this set being stable, so any
# future expansion goes through a separate spec feature.
INSTINCT_TYPES: frozenset[str] = frozenset(
    {
        "pattern",
        "preference",
        "pitfall",
        "workflow",
        "convention",
        "tool_use",
        "heuristic",
        "anti_pattern",
    }
)

# Required at write time. ``occurrences`` is intentionally absent —
# the template defaults it to 1 when omitted, so an instinct file on
# disk may legitimately render without an explicit value.
INSTINCT_REQUIRED_FIELDS: tuple[str, ...] = (
    "name",
    "description",
    "type",
    "confidence",
)

# Reuses the agent name pattern (lowercase, hyphen-case, must start
# with a letter). The same regex underpins
# ``InstinctStore._validate_component`` so paths and frontmatter agree.
INSTINCT_FIELD_CONSTRAINTS: dict[str, dict[str, object]] = {
    "name": {"max_length": 64, "pattern": r"^[a-z][a-z0-9-]*$"},
    "description": {"max_length": 512},
}


class InstinctSchemaError(ValueError):
    """Raised when instinct frontmatter violates the feature #8 schema.

    The exception message concatenates every offending field's error so a
    single ``raise`` surfaces all violations to the caller. ``ValueError``
    base class keeps it consistent with the rest of the package's
    exception hierarchy (``InstinctValidationError`` in
    ``instinct_store.py`` is also a ``ValueError`` subclass).
    """


def validate_instinct_frontmatter(
    frontmatter: dict,
    raw_frontmatter: dict | None = None,
    start_line: int = 1,
) -> list[ValidationError]:
    """Validate an instinct file's frontmatter against the feature #8 schema.

    Required fields (``name``, ``description``, ``type``, ``confidence``)
    must be present and non-empty. ``occurrences`` is optional but, if
    provided, must be a non-negative integer. ``type`` must be a member
    of :data:`INSTINCT_TYPES`. ``name`` enforces the same hyphen-case +
    64-char ceiling used elsewhere in the package; ``description`` is
    capped at 512.

    The collector pattern (returns a list rather than raising) matches
    ``validate_frontmatter_fields`` and ``validate_mcp_servers`` so the
    three validators compose uniformly inside ``validate_content``.

    Args:
        frontmatter: Normalized string-keyed dict (e.g., from
            ``parse_frontmatter``). Used as a fallback when
            ``raw_frontmatter`` is None.
        raw_frontmatter: Original typed dict (with int/float values
            preserved). Preferred when available so numeric fields can
            be checked without lossy stringification.
        start_line: 1-based line number used for ``ValidationError.line``.

    Returns:
        Zero-or-more ``ValidationError`` entries. Each entry's
        ``message`` names its offending field (``Field 'X' …``) so
        downstream tooling can attribute errors structurally.
    """
    errors: list[ValidationError] = []

    # Prefer typed values when available — confidence/occurrences need
    # to compare as numbers, not strings.
    source: dict = raw_frontmatter if raw_frontmatter is not None else frontmatter

    # ---- Required-field presence ----------------------------------------
    for field_name in INSTINCT_REQUIRED_FIELDS:
        if field_name not in source:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E026",
                    message=f"Field {field_name!r}: missing required instinct field",
                )
            )
            continue
        value = source[field_name]
        # An explicit None or whitespace-only string is treated as
        # missing; numeric 0 is fine for confidence (handled below).
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E026",
                    message=f"Field {field_name!r}: empty required instinct field",
                )
            )

    # ---- name: max 64, hyphen-case --------------------------------------
    if "name" in source and source["name"] not in (None, ""):
        name = str(source["name"])
        constraints = INSTINCT_FIELD_CONSTRAINTS["name"]
        max_length = int(constraints["max_length"])  # type: ignore[arg-type]
        pattern = str(constraints["pattern"])
        if len(name) > max_length:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E027",
                    message=(f"Field 'name': exceeds {max_length} characters (got {len(name)})"),
                )
            )
        if not re.match(pattern, name):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E027",
                    message=(
                        f"Field 'name': must be hyphen-case (lowercase, "
                        f"hyphens, start with letter), got {name!r}"
                    ),
                )
            )

    # ---- description: max 512 -------------------------------------------
    if "description" in source and source["description"] not in (None, ""):
        desc = str(source["description"])
        max_len = int(INSTINCT_FIELD_CONSTRAINTS["description"]["max_length"])  # type: ignore[arg-type]
        if len(desc) > max_len:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E028",
                    message=(
                        f"Field 'description': exceeds {max_len} characters (got {len(desc)})"
                    ),
                )
            )

    # ---- confidence: float in [0, 1] ------------------------------------
    if "confidence" in source and source["confidence"] not in (None, ""):
        raw = source["confidence"]
        # Reject bool explicitly — bool is a subclass of int in Python,
        # but ``True``/``False`` are not valid confidence inputs.
        if isinstance(raw, bool):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E029",
                    message=(f"Field 'confidence': must be a number, got bool {raw!r}"),
                )
            )
        else:
            try:
                confidence = float(raw)
            except (TypeError, ValueError):
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E029",
                        message=f"Field 'confidence': must be a number, got {raw!r}",
                    )
                )
            else:
                if not (0.0 <= confidence <= 1.0):
                    errors.append(
                        ValidationError(
                            line=start_line,
                            column=1,
                            severity="error",
                            code="E029",
                            message=(f"Field 'confidence': must be in [0.0, 1.0], got {raw!r}"),
                        )
                    )

    # ---- occurrences: optional int ≥ 0 ----------------------------------
    if "occurrences" in source and source["occurrences"] not in (None, ""):
        raw = source["occurrences"]
        # ``int`` accepts floats via ``int(1.5) == 1`` — guard against
        # silent truncation by rejecting non-integer numerics outright.
        if isinstance(raw, bool):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E030",
                    message=f"Field 'occurrences': must be an integer, got bool {raw!r}",
                )
            )
        elif isinstance(raw, int):
            if raw < 0:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="error",
                        code="E030",
                        message=f"Field 'occurrences': must be >= 0, got {raw}",
                    )
                )
        else:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E030",
                    message=(f"Field 'occurrences': must be an integer, got {raw!r}"),
                )
            )

    # ---- type: must be in INSTINCT_TYPES --------------------------------
    if "type" in source and source["type"] not in (None, ""):
        type_value = str(source["type"])
        if type_value not in INSTINCT_TYPES:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E031",
                    message=(
                        f"Field 'type': must be one of {sorted(INSTINCT_TYPES)}, got {type_value!r}"
                    ),
                )
            )

    return errors


def assert_valid_instinct_frontmatter(
    frontmatter: dict,
    raw_frontmatter: dict | None = None,
) -> None:
    """Raise :class:`InstinctSchemaError` if frontmatter fails the schema.

    Thin wrapper around :func:`validate_instinct_frontmatter`. Every
    error message in the raised exception names the offending field, so
    callers ``except InstinctSchemaError as e: ...`` can surface a
    specific field-attributable error to the user.

    Returns ``None`` when the frontmatter is valid, mirroring the
    ``assert_X`` naming convention used elsewhere in the codebase.
    """
    errors = validate_instinct_frontmatter(frontmatter, raw_frontmatter)
    if errors:
        # Concatenate all violations into one exception message — the
        # collector deliberately gathers every problem so the user sees
        # them all in a single failure rather than one-at-a-time.
        message = "; ".join(e.message for e in errors)
        raise InstinctSchemaError(message)


def validate_markdown_structure(
    content: str, frontmatter_end: int
) -> tuple[list[ValidationError], list[str]]:
    """Validate markdown structure after frontmatter."""
    errors: list[ValidationError] = []
    sections: list[str] = []
    lines = content.split("\n")

    if frontmatter_end >= len(lines):
        return errors, sections

    # Content after frontmatter
    body_lines = lines[frontmatter_end:]
    body_start = frontmatter_end + 1

    # Track state
    in_code_block = False
    code_block_start = 0
    code_block_lang = ""
    h1_found = False
    h2_count = 0

    for i, line in enumerate(body_lines):
        line_num = body_start + i

        # Check for code blocks
        if line.strip().startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_block_start = line_num
                code_block_lang = line.strip()[3:].strip()
            else:
                in_code_block = False
            continue

        # Skip content inside code blocks
        if in_code_block:
            continue

        # Check for H1 heading
        if line.startswith("# "):
            if h1_found:
                errors.append(
                    ValidationError(
                        line=line_num,
                        column=1,
                        severity="warning",
                        code="W001",
                        message="Multiple H1 headings found (should have only one)",
                    )
                )
            h1_found = True
            sections.append(line[2:].strip())

        # Check for H2 heading
        elif line.startswith("## "):
            h2_count += 1
            sections.append(line[3:].strip())

    # Check for unclosed code block
    if in_code_block:
        errors.append(
            ValidationError(
                line=code_block_start,
                column=1,
                severity="error",
                code="E020",
                message=f"Unclosed code block starting at line {code_block_start}"
                + (f" (language: {code_block_lang})" if code_block_lang else ""),
            )
        )

    # Check for missing H1
    if not h1_found:
        errors.append(
            ValidationError(
                line=body_start,
                column=1,
                severity="error",
                code="E021",
                message="Missing H1 title after frontmatter",
            )
        )

    # Check for H2 sections
    if h2_count == 0:
        errors.append(
            ValidationError(
                line=body_start,
                column=1,
                severity="warning",
                code="W002",
                message="No H2 sections found (agents should have structured sections)",
            )
        )

    return errors, sections


def validate_content(content: str) -> ValidationResult:
    """
    Validate agent definition file content.

    Args:
        content: Full file content as string

    Returns:
        ValidationResult with errors, warnings, and parsed data
    """
    all_errors: list[ValidationError] = []
    all_warnings: list[ValidationError] = []

    # Parse frontmatter
    frontmatter, fm_errors, fm_end, raw_fm = parse_frontmatter(content)
    for err in fm_errors:
        if err.severity == "error":
            all_errors.append(err)
        else:
            all_warnings.append(err)

    # Validate frontmatter fields if parsed successfully
    if frontmatter is not None:
        field_errors = validate_frontmatter_fields(frontmatter)
        for err in field_errors:
            if err.severity == "error":
                all_errors.append(err)
            else:
                all_warnings.append(err)

    # Validate mcpServers using raw frontmatter (preserves nested dicts)
    if raw_fm is not None:
        mcp_errors = validate_mcp_servers(raw_fm)
        for err in mcp_errors:
            if err.severity == "error":
                all_errors.append(err)
            else:
                all_warnings.append(err)

    # Validate markdown structure
    md_errors, sections = validate_markdown_structure(content, fm_end)
    for err in md_errors:
        if err.severity == "error":
            all_errors.append(err)
        else:
            all_warnings.append(err)

    return ValidationResult(
        passed=len(all_errors) == 0,
        errors=all_errors,
        warnings=all_warnings,
        frontmatter=frontmatter,
        sections=sections,
    )


def validate_file(file_path: str | Path) -> ValidationResult:
    """
    Validate an agent definition file.

    Args:
        file_path: Path to the agent file

    Returns:
        ValidationResult
    """
    path = Path(file_path)

    if not path.exists():
        return ValidationResult(
            passed=False,
            errors=[
                ValidationError(
                    line=0,
                    column=0,
                    severity="error",
                    code="E000",
                    message=f"File not found: {file_path}",
                )
            ],
        )

    if not path.suffix == ".md":
        return ValidationResult(
            passed=False,
            errors=[
                ValidationError(
                    line=0,
                    column=0,
                    severity="error",
                    code="E000",
                    message=f"Invalid file extension (expected .md): {path.suffix}",
                )
            ],
        )

    content = path.read_text(encoding="utf-8")
    return validate_content(content)


def format_error(error: ValidationError, file_path: str = "") -> str:
    """Format error for display."""
    location = f"{file_path}:" if file_path else ""
    location += f"{error.line}:{error.column}"
    severity = "error" if error.severity == "error" else "warning"
    return f"{location}: {severity} [{error.code}] {error.message}"


def main() -> None:
    """CLI entry point."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Validate agent definition syntax")
    parser.add_argument("file", help="Agent definition file to validate")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")

    args = parser.parse_args()

    result = validate_file(args.file)

    if args.json:
        output = {
            "passed": result.passed and (not args.strict or len(result.warnings) == 0),
            "errors": [
                {
                    "line": e.line,
                    "column": e.column,
                    "severity": e.severity,
                    "code": e.code,
                    "message": e.message,
                }
                for e in result.errors
            ],
            "warnings": [
                {
                    "line": w.line,
                    "column": w.column,
                    "severity": w.severity,
                    "code": w.code,
                    "message": w.message,
                }
                for w in result.warnings
            ],
            "frontmatter": result.frontmatter,
            "sections": result.sections,
        }
        print(json.dumps(output, indent=2))
    else:
        # Print errors
        for error in result.errors:
            print(format_error(error, args.file))

        # Print warnings
        for warning in result.warnings:
            print(format_error(warning, args.file))

        # Summary
        error_count = len(result.errors)
        warning_count = len(result.warnings)

        if error_count == 0 and warning_count == 0:
            print(f"✓ {args.file}: Valid")
        else:
            print(f"\n{error_count} error(s), {warning_count} warning(s)")

    # Exit code
    if not result.passed:
        sys.exit(1)
    if args.strict and result.warnings:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
