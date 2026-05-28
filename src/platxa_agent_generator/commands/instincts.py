"""Instincts subcommand: list / show / prune / stats.

CRUD-style access to the instinct store (markdown files with YAML
frontmatter). The handler delegates all filesystem operations and
GC logic to :class:`instinct_store.InstinctStore` and
:func:`instinct_store.gc_expired_instincts`; this module owns only
argparse wiring, output rendering, and exit codes.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

from .. import instinct_store


def register_parser(subparsers: Any) -> None:
    """Register the instincts subparser with list|show|prune|stats actions."""
    inst = subparsers.add_parser(
        "instincts",
        help="Inspect, prune, and aggregate learned instincts",
    )
    inst_sub = inst.add_subparsers(dest="inst_action", metavar="ACTION")

    list_cmd = inst_sub.add_parser("list", help="List instinct entries")
    list_cmd.add_argument(
        "-n",
        "--limit",
        type=int,
        default=20,
        help="Maximum entries to display (default: 20)",
    )
    list_cmd.add_argument(
        "--project",
        dest="inst_project",
        help="Filter by project scope (exact match on scope field)",
    )
    list_cmd.add_argument(
        "--type",
        dest="inst_type",
        help="Filter by instinct type",
    )
    list_cmd.add_argument(
        "--root",
        type=Path,
        dest="inst_root",
        help="Path to instinct store root (default: ~/.claude/instincts)",
    )

    show_cmd = inst_sub.add_parser("show", help="Show a single instinct by name")
    show_cmd.add_argument("name", help="Instinct name")
    show_cmd.add_argument(
        "--root",
        type=Path,
        dest="inst_root",
        help="Path to instinct store root",
    )

    prune_cmd = inst_sub.add_parser(
        "prune",
        help="Remove expired instincts (last_seen > TTL and usage_count == 0)",
    )
    prune_cmd.add_argument(
        "--ttl-days",
        type=int,
        default=instinct_store.DEFAULT_TTL_DAYS,
        help=f"Days since last_seen before eligible for pruning (default: {instinct_store.DEFAULT_TTL_DAYS})",
    )
    prune_cmd.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be pruned without deleting",
    )
    prune_cmd.add_argument(
        "--project",
        dest="inst_project",
        help="Only prune instincts in this project scope",
    )
    prune_cmd.add_argument(
        "--type",
        dest="inst_type",
        help="Only prune instincts of this type",
    )
    prune_cmd.add_argument(
        "--root",
        type=Path,
        dest="inst_root",
        help="Path to instinct store root",
    )

    stats_cmd = inst_sub.add_parser("stats", help="Show aggregate statistics")
    stats_cmd.add_argument(
        "--root",
        type=Path,
        dest="inst_root",
        help="Path to instinct store root",
    )


def handle_instincts(args: argparse.Namespace) -> int:
    """Dispatch the instincts action to its handler."""
    json_mode = bool(getattr(args, "json", False))
    inst_root: Path | None = getattr(args, "inst_root", None)
    store = instinct_store.InstinctStore(root=inst_root)

    if args.inst_action == "list":
        return _handle_list(args, store, json_mode)
    if args.inst_action == "show":
        return _handle_show(args, store, json_mode)
    if args.inst_action == "prune":
        return _handle_prune(args, store, json_mode)
    if args.inst_action == "stats":
        return _handle_stats(store, json_mode)

    if json_mode:
        print(json.dumps({"error": "Usage: platxa-agent instincts {list|show|prune|stats}"}))
    else:
        print("Usage: platxa-agent instincts {list|show|prune|stats}")
    return 1


def _handle_list(
    args: argparse.Namespace,
    store: "instinct_store.InstinctStore",
    json_mode: bool,
) -> int:
    """List instinct entries with optional --project and --type filters."""
    entries = store.list_entries()

    project_filter: str | None = getattr(args, "inst_project", None)
    type_filter: str | None = getattr(args, "inst_type", None)

    if project_filter:
        entries = [e for e in entries if e.scope == project_filter]
    if type_filter:
        entries = [e for e in entries if e.type == type_filter]

    total = len(entries)
    limit: int = getattr(args, "limit", 20)
    entries = entries[:limit]

    if json_mode:
        print(
            json.dumps(
                {
                    "total": total,
                    "returned": len(entries),
                    "entries": [asdict(e) for e in entries],
                },
                indent=2,
            )
        )
    else:
        print(f"Instincts: {total} total, showing {len(entries)}")
        print("-" * 60)
        for e in entries:
            print(f"  {e.name:<24} {e.type:<16} {e.scope:<16} {e.size}B")
        if total > limit:
            print(f"  ... {total - limit} more (use --limit to see more)")

    return 0


def _handle_show(
    args: argparse.Namespace,
    store: "instinct_store.InstinctStore",
    json_mode: bool,
) -> int:
    """Show a single instinct by name."""
    name: str = args.name
    entry = store.get_entry(name)

    if entry is None:
        msg = f"Instinct {name!r} not found"
        if json_mode:
            print(json.dumps({"error": msg}, indent=2))
        else:
            print(f"Error: {msg}")
        return 1

    content = store.get(name)

    if json_mode:
        payload = asdict(entry)
        payload["content"] = content
        print(json.dumps(payload, indent=2))
    else:
        print(f"Instinct: {entry.name}")
        print("=" * 40)
        print(f"  Type:       {entry.type}")
        print(f"  Scope:      {entry.scope}")
        print(f"  Size:       {entry.size}B")
        print(f"  Checksum:   {entry.checksum[:16]}...")
        print(f"  Created:    {entry.created or '(unknown)'}")
        print(f"  Last seen:  {entry.last_seen or '(unknown)'}")
        if content:
            print(f"\n--- Content ---\n{content}")

    return 0


def _handle_prune(
    args: argparse.Namespace,
    store: "instinct_store.InstinctStore",
    json_mode: bool,
) -> int:
    """Prune expired instincts via gc_expired_instincts.

    When ``--project`` or ``--type`` filters are active, a dry-run
    pass identifies candidates first, the filter narrows the set,
    and only matching entries are deleted — entries outside the
    filter are never touched.
    """
    ttl_days: int = getattr(args, "ttl_days", instinct_store.DEFAULT_TTL_DAYS)
    dry_run_flag: bool = getattr(args, "dry_run", False)
    project_filter: str | None = getattr(args, "inst_project", None)
    type_filter: str | None = getattr(args, "inst_type", None)

    has_filter = bool(project_filter or type_filter)

    if not has_filter:
        result = instinct_store.gc_expired_instincts(
            store,
            ttl_days=ttl_days,
            dry_run=dry_run_flag,
        )
        pruned = result.pruned
        retained_count = len(result.retained)
        errors = result.errors
    else:
        candidates = instinct_store.gc_expired_instincts(
            store,
            ttl_days=ttl_days,
            dry_run=True,
        )
        entry_map = {e.name: e for e in store.list_entries()}
        pruned = []
        errors: list[str] = []
        skipped = 0
        for name in candidates.pruned:
            entry = entry_map.get(name)
            if entry is None:
                continue
            if project_filter and entry.scope != project_filter:
                skipped += 1
                continue
            if type_filter and entry.type != type_filter:
                skipped += 1
                continue
            if not dry_run_flag:
                if store.delete(name):
                    pruned.append(name)
                else:
                    errors.append(name)
            else:
                pruned.append(name)
        retained_count = len(candidates.retained) + skipped

    if json_mode:
        print(
            json.dumps(
                {
                    "pruned": pruned,
                    "pruned_count": len(pruned),
                    "retained_count": retained_count,
                    "errors": errors,
                    "dry_run": dry_run_flag,
                    "ttl_days": ttl_days,
                },
                indent=2,
            )
        )
    else:
        verb = "Would prune" if dry_run_flag else "Pruned"
        print(f"{verb} {len(pruned)} instinct(s) (TTL: {ttl_days} days)")
        for name in pruned:
            print(f"  - {name}")
        if errors:
            print(f"Errors: {len(errors)}")
            for name in errors:
                print(f"  ! {name}")
        print(f"Retained: {retained_count}")

    return 0


def _handle_stats(
    store: "instinct_store.InstinctStore",
    json_mode: bool,
) -> int:
    """Show aggregate statistics over the instinct store."""
    entries = store.list_entries()

    by_type: dict[str, int] = {}
    by_scope: dict[str, int] = {}
    total_size = 0

    for e in entries:
        by_type[e.type] = by_type.get(e.type, 0) + 1
        by_scope[e.scope] = by_scope.get(e.scope, 0) + 1
        total_size += e.size

    result = {
        "total": len(entries),
        "total_size_bytes": total_size,
        "by_type": by_type,
        "by_scope": by_scope,
    }

    if json_mode:
        print(json.dumps(result, indent=2))
    else:
        print(f"Instinct Statistics ({len(entries)} entries, {total_size} bytes)")
        print("=" * 40)
        print()
        print("  By type:")
        for k, v in sorted(by_type.items()):
            print(f"    {k:<20} {v}")
        print()
        print("  By scope:")
        for k, v in sorted(by_scope.items()):
            print(f"    {k:<20} {v}")

    return 0


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "instincts": handle_instincts,
}
