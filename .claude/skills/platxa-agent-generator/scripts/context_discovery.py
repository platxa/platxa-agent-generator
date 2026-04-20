#!/usr/bin/env python3
"""
Context-Aware Discovery for Agent Generation

Scans existing .claude/agents/ directories (project and user scope) to:
- Discover existing agents and parse their frontmatter
- Detect duplicate or conflicting agent names before generation
- Analyze tool patterns across existing agents for consistency
- Provide recommendations to maintain naming and tool conventions

Usage:
    python context_discovery.py scan                    # Scan all agent dirs
    python context_discovery.py scan --dir .claude/agents
    python context_discovery.py check "agent-name"      # Check for conflicts
    python context_discovery.py check "agent-name" --json
    python context_discovery.py patterns                # Show tool patterns
    python context_discovery.py patterns --json
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    from .shared.paths import get_project_agents_dir, get_user_agents_dir
except ImportError:
    from shared.paths import (  # type: ignore[import-not-found,no-redef]
        get_project_agents_dir,
        get_user_agents_dir,
    )


@dataclass
class ExistingAgent:
    """Parsed metadata from an existing agent file."""

    name: str
    description: str
    tools: list[str]
    file_path: str
    scope: str  # "project" or "user"


@dataclass
class ConflictCheck:
    """Result of checking a proposed agent name against existing agents."""

    has_conflict: bool
    exact_match: ExistingAgent | None = None
    similar_names: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


@dataclass
class ToolPatterns:
    """Analysis of tool usage patterns across existing agents."""

    total_agents: int
    tool_frequency: dict[str, int] = field(default_factory=dict)
    common_combinations: list[list[str]] = field(default_factory=list)
    recommended_base: list[str] = field(default_factory=list)


def _parse_frontmatter(content: str) -> dict[str, str]:
    """Parse YAML frontmatter from agent markdown content.

    Handles the --- delimited frontmatter block at the top of .md files.
    Returns a dict of key-value pairs. Only parses simple key: value lines.
    """
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}

    result: dict[str, str] = {}
    for line in match.group(1).split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        colon_idx = line.find(":")
        if colon_idx > 0:
            key = line[:colon_idx].strip()
            value = line[colon_idx + 1 :].strip()
            result[key] = value

    return result


def scan_directory(directory: str | Path, scope: str = "project") -> list[ExistingAgent]:
    """Scan a directory for existing agent definitions.

    Args:
        directory: Path to scan (e.g. ".claude/agents").
        scope: Label for the scope ("project" or "user").

    Returns:
        List of parsed ExistingAgent objects.
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        return []

    agents: list[ExistingAgent] = []
    for md_file in sorted(dir_path.glob("*.md")):
        try:
            content = md_file.read_text(encoding="utf-8")
        except OSError:
            continue

        fm = _parse_frontmatter(content)
        if not fm.get("name"):
            continue

        tools_str = fm.get("tools", "")
        tools = [t.strip() for t in tools_str.split(",") if t.strip()]

        agents.append(
            ExistingAgent(
                name=fm["name"],
                description=fm.get("description", ""),
                tools=tools,
                file_path=str(md_file),
                scope=scope,
            )
        )

    return agents


def scan_all_agents(
    project_dir: str | Path | None = None,
    user_dir: str | Path | None = None,
) -> list[ExistingAgent]:
    """Scan both project and user agent directories.

    Args:
        project_dir: Project agents dir (default: .claude/agents).
        user_dir: User agents dir (default: ~/.claude/agents).

    Returns:
        Combined list of all discovered agents.
    """
    agents: list[ExistingAgent] = []

    # Project scope
    proj = Path(project_dir) if project_dir else get_project_agents_dir()
    agents.extend(scan_directory(proj, scope="project"))

    # User scope
    usr = Path(user_dir) if user_dir else get_user_agents_dir()
    agents.extend(scan_directory(usr, scope="user"))

    return agents


def check_name_conflict(
    proposed_name: str,
    existing_agents: list[ExistingAgent],
) -> ConflictCheck:
    """Check if a proposed agent name conflicts with existing agents.

    Detects:
    - Exact name matches (case-insensitive)
    - Similar names (edit distance or prefix/suffix overlap)

    Args:
        proposed_name: The name to check.
        existing_agents: List of existing agents to check against.

    Returns:
        ConflictCheck with conflict details and suggestions.
    """
    proposed_lower = proposed_name.lower()
    exact_match: ExistingAgent | None = None
    similar: list[str] = []
    suggestions: list[str] = []

    for agent in existing_agents:
        agent_lower = agent.name.lower()

        # Exact match (case-insensitive)
        if agent_lower == proposed_lower:
            exact_match = agent
            continue

        # Similar name detection: shared prefix/suffix of 4+ chars
        # or one name is a substring of the other
        if (
            len(proposed_lower) >= 4
            and len(agent_lower) >= 4
            and (
                proposed_lower in agent_lower
                or agent_lower in proposed_lower
                or _common_prefix_len(proposed_lower, agent_lower) >= 4
                or _common_suffix_len(proposed_lower, agent_lower) >= 4
            )
        ):
            similar.append(agent.name)

    has_conflict = exact_match is not None

    if exact_match:
        suggestions.append(
            f"Agent '{proposed_name}' already exists at {exact_match.file_path} "
            f"({exact_match.scope} scope)"
        )
        suggestions.append(f"Consider: '{proposed_name}-v2' or a more specific name")

    if similar:
        suggestions.append(
            f"Similar agents exist: {', '.join(similar)}. Verify this is not a duplicate."
        )

    return ConflictCheck(
        has_conflict=has_conflict,
        exact_match=exact_match,
        similar_names=similar,
        suggestions=suggestions,
    )


def _common_prefix_len(a: str, b: str) -> int:
    """Return length of common prefix between two strings."""
    length = 0
    for ca, cb in zip(a, b):
        if ca != cb:
            break
        length += 1
    return length


def _common_suffix_len(a: str, b: str) -> int:
    """Return length of common suffix between two strings."""
    return _common_prefix_len(a[::-1], b[::-1])


def analyze_tool_patterns(existing_agents: list[ExistingAgent]) -> ToolPatterns:
    """Analyze tool usage patterns across existing agents.

    Provides:
    - Frequency of each tool across all agents
    - Most common tool combinations
    - Recommended base tool set

    Args:
        existing_agents: List of existing agents.

    Returns:
        ToolPatterns with analysis results.
    """
    if not existing_agents:
        return ToolPatterns(
            total_agents=0,
            recommended_base=["Read", "Grep", "Glob"],
        )

    # Count tool frequency
    tool_counter: Counter[str] = Counter()
    for agent in existing_agents:
        tool_counter.update(agent.tools)

    # Find common combinations (tool sets that appear in 2+ agents)
    combo_counter: Counter[tuple[str, ...]] = Counter()
    for agent in existing_agents:
        if agent.tools:
            combo_key = tuple(sorted(agent.tools))
            combo_counter[combo_key] += 1

    common_combos = [list(combo) for combo, count in combo_counter.most_common(5) if count >= 2]

    # Recommended base: tools used by >50% of agents
    threshold = len(existing_agents) / 2
    recommended = [tool for tool, count in tool_counter.most_common() if count >= threshold]
    if not recommended:
        recommended = ["Read", "Grep", "Glob"]

    return ToolPatterns(
        total_agents=len(existing_agents),
        tool_frequency=dict(tool_counter.most_common()),
        common_combinations=common_combos,
        recommended_base=recommended,
    )


def discovery_report(
    existing_agents: list[ExistingAgent],
    proposed_name: str | None = None,
) -> dict[str, Any]:
    """Generate a full discovery report.

    Args:
        existing_agents: Discovered agents.
        proposed_name: Optional name to check for conflicts.

    Returns:
        Dict with agents, patterns, and optional conflict check.
    """
    report: dict[str, Any] = {
        "agents_found": len(existing_agents),
        "agents": [asdict(a) for a in existing_agents],
        "patterns": asdict(analyze_tool_patterns(existing_agents)),
    }

    if proposed_name:
        conflict = check_name_conflict(proposed_name, existing_agents)
        report["conflict_check"] = {
            "proposed_name": proposed_name,
            "has_conflict": conflict.has_conflict,
            "exact_match": asdict(conflict.exact_match) if conflict.exact_match else None,
            "similar_names": conflict.similar_names,
            "suggestions": conflict.suggestions,
        }

    return report


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Context-aware agent discovery")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Scan command
    scan_parser = subparsers.add_parser("scan", help="Scan for existing agents")
    scan_parser.add_argument("--dir", help="Directory to scan")
    scan_parser.add_argument("--json", action="store_true", help="JSON output")

    # Check command
    check_parser = subparsers.add_parser("check", help="Check name for conflicts")
    check_parser.add_argument("name", help="Proposed agent name")
    check_parser.add_argument("--dir", help="Agent directory to scan")
    check_parser.add_argument("--json", action="store_true", help="JSON output")

    # Patterns command
    patterns_parser = subparsers.add_parser("patterns", help="Analyze tool patterns")
    patterns_parser.add_argument("--dir", help="Agent directory to scan")
    patterns_parser.add_argument("--json", action="store_true", help="JSON output")

    args = parser.parse_args()

    if args.command == "scan":
        if args.dir:
            agents = scan_directory(args.dir)
        else:
            agents = scan_all_agents()

        if args.json:
            print(json.dumps([asdict(a) for a in agents], indent=2))
        else:
            print(f"\nFound {len(agents)} existing agents:")
            for agent in agents:
                print(f"  [{agent.scope}] {agent.name}: {agent.description[:60]}")
                print(f"    Tools: {', '.join(agent.tools)}")
            print()

    elif args.command == "check":
        if args.dir:
            agents = scan_directory(args.dir)
        else:
            agents = scan_all_agents()

        conflict = check_name_conflict(args.name, agents)

        if args.json:
            result = {
                "proposed_name": args.name,
                "has_conflict": conflict.has_conflict,
                "exact_match": asdict(conflict.exact_match) if conflict.exact_match else None,
                "similar_names": conflict.similar_names,
                "suggestions": conflict.suggestions,
            }
            print(json.dumps(result, indent=2))
        else:
            if conflict.has_conflict:
                print(f"CONFLICT: '{args.name}' already exists!")
            else:
                print(f"OK: '{args.name}' has no conflicts")
            if conflict.similar_names:
                print(f"Similar: {', '.join(conflict.similar_names)}")
            for suggestion in conflict.suggestions:
                print(f"  → {suggestion}")

    elif args.command == "patterns":
        if args.dir:
            agents = scan_directory(args.dir)
        else:
            agents = scan_all_agents()

        patterns = analyze_tool_patterns(agents)

        if args.json:
            print(json.dumps(asdict(patterns), indent=2))
        else:
            print(f"\nTool patterns across {patterns.total_agents} agents:")
            print("\nFrequency:")
            for tool, count in patterns.tool_frequency.items():
                print(f"  {tool}: {count}")
            print(f"\nRecommended base: {', '.join(patterns.recommended_base)}")
            print()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
