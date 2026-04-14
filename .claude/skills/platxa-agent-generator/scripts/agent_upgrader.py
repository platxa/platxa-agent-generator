#!/usr/bin/env python3
"""
Agent Upgrader

Upgrades existing Claude Code agent files to the latest format:

- Adds missing frontmatter fields with smart defaults (model, maxTurns,
  version) — derived from the agent's declared tool set and existing
  metadata rather than hardcoded, so an analyzer-heavy agent defaults
  to a different tier than a builder.
- Adds missing body sections (Examples, Output Format, Error Handling)
  using minimal stubs that an author can expand — never generates
  long-form prose that might be wrong.
- Preserves **every byte** of custom content: existing frontmatter
  values are never overwritten, existing sections are never rewritten.
  The upgrader is purely additive.

Related modules:
    agent_analyzer: Reports what's missing (no mutation).
    agent_upgrader: Applies the suggested fixes (this module).

Usage:
    python agent_upgrader.py path/to/agent.md                  # preview
    python agent_upgrader.py path/to/agent.md --apply          # write
    python agent_upgrader.py path/to/agent.md --json --apply
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Default frontmatter values keyed on the agent's declared tools. The
# upgrader picks the first table entry whose ``required_tools`` subset
# matches the agent's declared set, so more-specific profiles should come
# before broader ones.
#
# Rationale: the analyzer's missing_field check is tool-agnostic, but a
# "smart default" should reflect actual intent — an orchestrator-shaped
# agent (Task + Bash) deserves opus + long maxTurns; a read-only
# analyzer (Read + Grep) deserves sonnet + short maxTurns.
_SMART_DEFAULTS_PROFILES: tuple[dict[str, Any], ...] = (
    {
        "name": "orchestrator",
        "required_tools": frozenset({"Task"}),
        "fields": {"model": "opus", "maxTurns": 100, "version": "1.0.0"},
    },
    {
        "name": "builder",
        "required_tools": frozenset({"Write", "Edit"}),
        "fields": {"model": "sonnet", "maxTurns": 40, "version": "1.0.0"},
    },
    {
        "name": "automation",
        "required_tools": frozenset({"Bash"}),
        "fields": {"model": "sonnet", "maxTurns": 40, "version": "1.0.0"},
    },
    {
        "name": "analyzer",
        "required_tools": frozenset({"Read", "Grep"}),
        "fields": {"model": "sonnet", "maxTurns": 15, "version": "1.0.0"},
    },
)

# Fallback used when no profile matches (e.g. agent declares no tools or
# only rare tools). Conservative: sonnet + short budget.
_FALLBACK_DEFAULTS: dict[str, Any] = {
    "model": "sonnet",
    "maxTurns": 15,
    "version": "1.0.0",
}

# Body sections that the upgrader will append as stubs when missing. Stub
# text is deliberately terse — the author should expand it, not rely on
# the upgrader's guess. Order matches conventional agent layout.
_STUB_SECTIONS: tuple[tuple[str, str], ...] = (
    (
        "Examples",
        (
            "<!-- upgrader-stub: replace with 2-3 concrete invocations showing "
            "expected behavior. -->\n"
            "- Example 1: …\n"
            "- Example 2: …\n"
        ),
    ),
    (
        "Output Format",
        (
            "<!-- upgrader-stub: describe the expected return format so the "
            "agent doesn't emit free-form text. -->\n"
            "Describe the shape of the agent's final output here.\n"
        ),
    ),
    (
        "Error Handling",
        (
            "<!-- upgrader-stub: list failure modes the agent should catch "
            "and how to report them. -->\n"
            "- When a required input is missing: …\n"
            "- When a downstream call fails: …\n"
        ),
    ),
)


@dataclass
class UpgradeChange:
    """A single change the upgrader made (or would make in dry-run).

    Fields:
        category: ``"frontmatter"`` or ``"section"`` — tells the caller
            whether the change touches the YAML block or the body.
        field_or_section: The frontmatter key (``"model"``) or the
            section name (``"Examples"``) that was added.
        value: The value that was written (compact JSON-safe form).
        rationale: Why the upgrader chose this default. Surfaces the
            profile name (e.g. ``"smart-default via profile 'analyzer'"``).
    """

    category: str
    field_or_section: str
    value: str
    rationale: str

    def to_dict(self) -> dict[str, str]:
        """Serialize for JSON output."""
        return {
            "category": self.category,
            "field_or_section": self.field_or_section,
            "value": self.value,
            "rationale": self.rationale,
        }


@dataclass
class UpgradeResult:
    """Result of :func:`upgrade_agent`.

    Callers can use ``changes`` to preview a dry-run; when ``applied``
    is ``True`` the ``upgraded_content`` has already been written to
    ``path`` and the ``backup_path`` holds the pre-upgrade copy.
    """

    path: str
    applied: bool
    original_content: str
    upgraded_content: str
    changes: list[UpgradeChange] = field(default_factory=list)
    profile_used: str = ""
    backup_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON output."""
        return {
            "path": self.path,
            "applied": self.applied,
            "changes": [c.to_dict() for c in self.changes],
            "profile_used": self.profile_used,
            "backup_path": self.backup_path,
            # Do NOT serialize original/upgraded content to JSON — they
            # can be huge. The caller that wants them has the objects.
        }


def _parse_frontmatter(content: str) -> tuple[dict[str, str], str, str]:
    """Split content into (frontmatter_map, frontmatter_block, body).

    Returns empty frontmatter + whole content as body when the file
    doesn't start with a ``---`` delimiter. The caller uses this to
    decide whether to prepend a new frontmatter block or edit the
    existing one.
    """
    if not content.startswith("---"):
        return {}, "", content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, "", content
    frontmatter_block = parts[1]
    body = parts[2]
    fields: dict[str, str] = {}
    for line in frontmatter_block.split("\n"):
        if ":" in line and not line.strip().startswith("#"):
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip().strip("\"'")
    return fields, frontmatter_block, body


def _split_tools(tools_value: str) -> set[str]:
    """Parse the comma-separated ``tools`` frontmatter value into a set."""
    return {token.strip() for token in tools_value.split(",") if token.strip()}


def _select_profile(declared_tools: set[str]) -> tuple[str, dict[str, Any]]:
    """Pick the smart-default profile best matching ``declared_tools``.

    Returns the profile name and its ``fields`` dict. Falls back to
    ``_FALLBACK_DEFAULTS`` when no profile matches.
    """
    for profile in _SMART_DEFAULTS_PROFILES:
        required = profile["required_tools"]
        if required and required.issubset(declared_tools):
            return profile["name"], dict(profile["fields"])
    return "fallback", dict(_FALLBACK_DEFAULTS)


def _section_present(body: str, section_name: str) -> bool:
    """True when the body already contains ``## {section_name}``.

    Case-insensitive match against the section header line. Substring
    match in plain text does NOT count — the body must have a proper
    markdown header so the analyzer and quality scorer agree.
    """
    target = f"## {section_name}".lower()
    for line in body.split("\n"):
        if line.strip().lower().startswith(target):
            return True
    return False


def _build_upgraded_frontmatter(
    existing: dict[str, str],
    existing_block: str,
    defaults: dict[str, Any],
) -> tuple[str, list[UpgradeChange]]:
    """Produce the new frontmatter block and the list of field changes.

    **Only adds missing keys** — existing keys are preserved byte-for-byte.
    The new keys are appended at the end of the frontmatter block so the
    diff is minimal and the original order is preserved.
    """
    changes: list[UpgradeChange] = []
    # Strip trailing newlines once so our appends don't accumulate blank lines.
    block_lines = existing_block.rstrip("\n").split("\n") if existing_block else []

    for field_name, default_value in defaults.items():
        if field_name in existing and existing[field_name]:
            continue
        rendered = str(default_value)
        block_lines.append(f"{field_name}: {rendered}")
        changes.append(
            UpgradeChange(
                category="frontmatter",
                field_or_section=field_name,
                value=rendered,
                rationale="smart-default",
            )
        )

    # Preserve leading newline convention (``---\n...\n---``) by joining
    # with ``\n`` and wrapping. The split/join above already handles the
    # leading blank line that appears after ``---``.
    new_block = "\n".join(block_lines) + "\n"
    return new_block, changes


def _build_upgraded_body(body: str) -> tuple[str, list[UpgradeChange]]:
    """Append missing section stubs to the body.

    Existing sections (detected by ``_section_present``) are never
    rewritten. Missing sections are appended in canonical order so the
    resulting document has a predictable shape regardless of which
    sections the original was missing.
    """
    changes: list[UpgradeChange] = []
    # Ensure exactly one trailing newline before appending new sections
    # so the rendered markdown doesn't mash the stub into existing text.
    new_body = body.rstrip("\n") + "\n"

    for section_name, stub in _STUB_SECTIONS:
        if _section_present(body, section_name):
            continue
        new_body += f"\n## {section_name}\n\n{stub}"
        changes.append(
            UpgradeChange(
                category="section",
                field_or_section=section_name,
                value="<stub>",
                rationale="missing-section",
            )
        )

    return new_body, changes


def _write_backup(path: Path, original_content: str) -> Path:
    """Write the pre-upgrade content to a ``.bak`` sibling file.

    The backup is plain-text and timestamped so multiple upgrades don't
    collide. Returns the backup path so the caller can surface it in
    :class:`UpgradeResult`.
    """
    # Use a monotonic-ish suffix: seconds since epoch, not wall-clock
    # formatting. Wall-clock formatting varies by locale; seconds is
    # unambiguous and sort-stable.
    import time

    backup = path.with_suffix(path.suffix + f".bak.{int(time.time())}")
    backup.write_text(original_content, encoding="utf-8")
    return backup


def upgrade_agent(
    path: str | Path,
    apply: bool = False,
    smart_defaults_override: dict[str, Any] | None = None,
) -> UpgradeResult:
    """Upgrade an agent file to the latest format.

    The upgrader is **purely additive**: every byte of existing content
    is preserved. Missing frontmatter fields are added with smart
    defaults chosen from the agent's tool set; missing body sections
    are added as stubs the author should expand.

    Args:
        path: Path to the agent ``.md`` file.
        apply: When ``True``, write the upgraded content back to the
            file (after writing a backup). When ``False`` (default),
            return the upgraded content without touching disk.
        smart_defaults_override: Optional mapping to force specific
            frontmatter values regardless of the profile match. Useful
            when a caller already knows the intended model/maxTurns.

    Returns:
        An :class:`UpgradeResult` describing the changes.

    Raises:
        FileNotFoundError: If ``path`` does not exist.
    """
    agent_path = Path(path)
    if not agent_path.exists():
        raise FileNotFoundError(f"Agent file not found: {agent_path}")

    original_content = agent_path.read_text(encoding="utf-8")
    existing_fm, existing_block, body = _parse_frontmatter(original_content)

    declared_tools = _split_tools(existing_fm.get("tools", ""))
    profile_name, defaults = _select_profile(declared_tools)

    if smart_defaults_override:
        defaults.update(smart_defaults_override)

    new_block, fm_changes = _build_upgraded_frontmatter(existing_fm, existing_block, defaults)
    # Annotate frontmatter changes with the chosen profile so the user
    # can see why "model: sonnet" was selected.
    for change in fm_changes:
        change.rationale = f"{change.rationale} via profile '{profile_name}'"

    new_body, section_changes = _build_upgraded_body(body)

    if existing_block:
        upgraded_content = f"---{new_block}---{new_body}"
    else:
        # No frontmatter before — synthesize a fresh block from defaults.
        # This path is unusual (agent files almost always have frontmatter)
        # but we handle it rather than silently producing an invalid file.
        synthesized = "\n".join(f"{k}: {v}" for k, v in defaults.items()) + "\n"
        upgraded_content = f"---\n{synthesized}---\n{new_body}"
        # Record the synthesized frontmatter as changes so the caller
        # knows what happened — these aren't captured by the add-missing loop.
        for field_name, value in defaults.items():
            fm_changes.append(
                UpgradeChange(
                    category="frontmatter",
                    field_or_section=field_name,
                    value=str(value),
                    rationale=(f"synthesized (no prior frontmatter) via profile '{profile_name}'"),
                )
            )

    changes = fm_changes + section_changes
    backup_path: str | None = None

    if apply and changes:
        backup = _write_backup(agent_path, original_content)
        agent_path.write_text(upgraded_content, encoding="utf-8")
        backup_path = str(backup)
    elif apply and not changes:
        # Nothing to apply — don't create a pointless backup.
        pass

    return UpgradeResult(
        path=str(agent_path),
        applied=apply and bool(changes),
        original_content=original_content,
        upgraded_content=upgraded_content,
        changes=changes,
        profile_used=profile_name,
        backup_path=backup_path,
    )


def format_upgrade_report(result: UpgradeResult) -> str:
    """Render a human-readable report for terminal output."""
    lines = [
        f"Agent Upgrade: {result.path}",
        "=" * 60,
        f"Profile: {result.profile_used}",
        f"Applied: {'yes' if result.applied else 'no (dry-run)'}",
    ]
    if result.backup_path:
        lines.append(f"Backup:  {result.backup_path}")
    lines.append("")
    if not result.changes:
        lines.append("No changes — agent is already up to date.")
        return "\n".join(lines)

    lines.append(f"Changes ({len(result.changes)}):")
    lines.append("-" * 60)
    for change in result.changes:
        lines.append(
            f"  [{change.category}] {change.field_or_section}: {change.value} ({change.rationale})"
        )
    return "\n".join(lines)


def main() -> int:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Upgrade an agent file to the latest format")
    parser.add_argument("path", help="Path to agent .md file")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes back to the file (dry-run is the default)",
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    try:
        result = upgrade_agent(args.path, apply=args.apply)
    except FileNotFoundError as exc:
        if args.json:
            print(json.dumps({"error": str(exc)}, indent=2))
        else:
            print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(format_upgrade_report(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
