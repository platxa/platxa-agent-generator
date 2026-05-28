"""Observations subcommand: list / show / stats / migrate.

CRUD-style access to the observation JSONL store. The handler delegates
all filtering, pagination, and persistence to
:class:`observation_store.ObservationStore`; this module owns only
argparse wiring, the JSON-vs-text output shape, and exit codes.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

from .. import observation_store


def register_parser(subparsers: Any) -> None:
    """Register the observations subparser with list|show|stats|migrate actions."""
    obs = subparsers.add_parser(
        "observations",
        help="Inspect and migrate the observation store",
    )
    obs_sub = obs.add_subparsers(dest="obs_action", metavar="ACTION")

    list_cmd = obs_sub.add_parser("list", help="List observation records")
    list_cmd.add_argument(
        "-n",
        "--limit",
        type=int,
        default=20,
        help="Maximum records to display (default: 20)",
    )
    list_cmd.add_argument("--type", dest="obs_type", help="Filter by observation type")
    list_cmd.add_argument("--tool", help="Filter by tool name")
    list_cmd.add_argument("--agent", help="Filter by agent name")
    list_cmd.add_argument(
        "-f",
        "--file",
        type=Path,
        dest="obs_file",
        help="Path to observations JSONL file (default: .claude/observations.jsonl)",
    )

    show_cmd = obs_sub.add_parser("show", help="Show a single observation by index")
    show_cmd.add_argument("index", type=int, help="Zero-based record index")
    show_cmd.add_argument(
        "-f",
        "--file",
        type=Path,
        dest="obs_file",
        help="Path to observations JSONL file",
    )

    stats_cmd = obs_sub.add_parser("stats", help="Show aggregate statistics")
    stats_cmd.add_argument(
        "-f",
        "--file",
        type=Path,
        dest="obs_file",
        help="Path to observations JSONL file",
    )

    migrate_cmd = obs_sub.add_parser(
        "migrate",
        help="Upgrade old 5-field rows to the full schema (idempotent)",
    )
    migrate_cmd.add_argument(
        "-f",
        "--file",
        type=Path,
        dest="obs_file",
        help="Path to observations JSONL file",
    )


def handle_observations(args: argparse.Namespace) -> int:
    """Dispatch the observations action to its handler."""
    json_mode = bool(getattr(args, "json", False))
    obs_file: Path | None = getattr(args, "obs_file", None)
    store = observation_store.ObservationStore(path=obs_file)

    if args.obs_action == "list":
        return _handle_list(args, store, json_mode)
    if args.obs_action == "show":
        return _handle_show(args, store, json_mode)
    if args.obs_action == "stats":
        return _handle_stats(store, json_mode)
    if args.obs_action == "migrate":
        return _handle_migrate(store, json_mode)

    if json_mode:
        print(json.dumps({"error": "Usage: platxa-agent observations {list|show|stats|migrate}"}))
    else:
        print("Usage: platxa-agent observations {list|show|stats|migrate}")
    return 1


def _handle_list(
    args: argparse.Namespace,
    store: "observation_store.ObservationStore",
    json_mode: bool,
) -> int:
    """List observation records with optional filters."""
    records = store.read_all()

    obs_type: str | None = getattr(args, "obs_type", None)
    tool_filter: str | None = getattr(args, "tool", None)
    agent_filter: str | None = getattr(args, "agent", None)

    if obs_type:
        records = [r for r in records if r.type == obs_type]
    if tool_filter:
        records = [r for r in records if r.tool == tool_filter]
    if agent_filter:
        records = [r for r in records if r.agent_name == agent_filter]

    total = len(records)
    limit: int = getattr(args, "limit", 20)
    records = records[:limit]

    if json_mode:
        print(
            json.dumps(
                {
                    "total": total,
                    "returned": len(records),
                    "records": [asdict(r) for r in records],
                },
                indent=2,
            )
        )
    else:
        print(f"Observations: {total} total, showing {len(records)}")
        print("-" * 60)
        for i, r in enumerate(records):
            agent = r.agent_name or "(unknown)"
            print(f"  [{i}] {r.timestamp}  {r.type:<12} {r.tool:<12} {agent}")
        if total > limit:
            print(f"  ... {total - limit} more (use --limit to see more)")

    return 0


def _handle_show(
    args: argparse.Namespace,
    store: "observation_store.ObservationStore",
    json_mode: bool,
) -> int:
    """Show a single observation record by index."""
    records = store.read_all()
    idx: int = args.index

    if not records:
        msg = "No observations found"
        if json_mode:
            print(json.dumps({"error": msg}, indent=2))
        else:
            print(f"Error: {msg}")
        return 1

    if idx < 0 or idx >= len(records):
        msg = f"Index {idx} out of range (0..{len(records) - 1})"
        if json_mode:
            print(json.dumps({"error": msg}, indent=2))
        else:
            print(f"Error: {msg}")
        return 1

    record = records[idx]

    if json_mode:
        print(json.dumps(asdict(record), indent=2))
    else:
        print(f"Observation #{idx}")
        print("=" * 40)
        print(f"  Timestamp:    {record.timestamp}")
        print(f"  Type:         {record.type}")
        print(f"  Tool:         {record.tool}")
        print(f"  Agent:        {record.agent_name or '(unknown)'}")
        print(f"  Session:      {record.session_id or '(none)'}")
        print(f"  Project:      {record.project_name} ({record.project_id})")
        print(f"  Summary:      {record.input_summary}")
        if record.evidence:
            print(f"  Evidence:     {record.evidence}")
        if record.outcome:
            print(f"  Outcome:      {record.outcome}")
        print(f"  Confidence:   {record.confidence}")
        if record.examples:
            print(f"  Examples:     {', '.join(record.examples)}")
        if record.promoted_to:
            print(f"  Promoted to:  {record.promoted_to}")

    return 0


def _handle_stats(
    store: "observation_store.ObservationStore",
    json_mode: bool,
) -> int:
    """Show aggregate statistics."""
    result = store.stats()

    if json_mode:
        print(json.dumps(result, indent=2))
    else:
        total = result["total"]["count"]
        promoted = result["promoted"]["count"]
        print(f"Observation Statistics ({total} records)")
        print("=" * 40)
        print(f"  Promoted: {promoted}")
        print()
        print("  By type:")
        for k, v in result["by_type"].items():
            print(f"    {k:<16} {v}")
        print()
        print("  By tool:")
        for k, v in result["by_tool"].items():
            print(f"    {k:<16} {v}")
        print()
        print("  By agent:")
        for k, v in result["by_agent"].items():
            print(f"    {k:<16} {v}")

    return 0


def _handle_migrate(
    store: "observation_store.ObservationStore",
    json_mode: bool,
) -> int:
    """Migrate old rows to the full schema with backup."""
    result = store.migrate()

    if json_mode:
        print(json.dumps(result, indent=2))
    else:
        migrated = result["migrated"]
        total = result["total"]
        if migrated:
            print(f"Migrated {migrated}/{total} observation(s) to the current schema.")
            print(f"  Backup: {result['backup_path']}")
            print(f"  Output: {result['output_path']}")
        elif total:
            print(f"All {total} observations already up to date.")
            print(f"  Backup: {result['backup_path']}")
            print(f"  Output: {result['output_path']}")
        else:
            print("No observations file found.")

    return 0


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "observations": handle_observations,
}
