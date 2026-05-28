"""Catalog + install subcommands.

``catalog [list|show|use]`` browses bundled agent templates and can
materialise one into a working agent file. ``install`` installs an
already-authored agent file at user or project scope, with optional
pre-flight syntax validation.

Both handlers delegate every state mutation to
:mod:`platxa_agent_generator.agent_catalog`,
:mod:`platxa_agent_generator.install_agent`, and
:mod:`platxa_agent_generator.syntax_validator`; this module owns only
argparse wiring, the output rendering, and exit codes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable

from .. import agent_catalog, install_agent, syntax_validator


def register_parser(subparsers: Any) -> None:
    """Register the catalog and install subparsers."""
    _add_catalog_command(subparsers)
    _add_install_command(subparsers)


def _add_catalog_command(subparsers: Any) -> None:
    """Add the catalog subcommand with list|show|use actions."""
    catalog = subparsers.add_parser("catalog", help="Browse agent templates")
    catalog_sub = catalog.add_subparsers(dest="catalog_action", metavar="ACTION")

    list_cmd = catalog_sub.add_parser("list", help="List templates")
    list_cmd.add_argument("-c", "--category", help="Filter by category")

    show_cmd = catalog_sub.add_parser("show", help="Show template details")
    show_cmd.add_argument("template_id", help="Template ID")

    use_cmd = catalog_sub.add_parser("use", help="Use template")
    use_cmd.add_argument("template_id", help="Template ID")
    use_cmd.add_argument("-o", "--output", type=Path)


def _add_install_command(subparsers: Any) -> None:
    """Add the install subcommand."""
    install = subparsers.add_parser("install", help="Install agent")
    install.add_argument("path", type=Path, help="Agent file path")
    install.add_argument("-s", "--scope", choices=["user", "project"], default="project")
    install.add_argument("--force", action="store_true")
    install.add_argument("--no-validate", action="store_true")


def handle_catalog(args: argparse.Namespace) -> int:
    """Handle the catalog command."""
    if args.catalog_action == "list":
        templates = agent_catalog.list_agents(category=args.category)

        if hasattr(args, "json") and args.json:
            print(json.dumps([agent_catalog.template_to_dict(t) for t in templates], indent=2))
        else:
            print("\n" + "=" * 60)
            print("Agent Template Catalog")
            print("=" * 60 + "\n")

            for template in templates:
                print(f"  [{template.category}] {template.name}")
                desc = (
                    template.description[:60]
                    if len(template.description) > 60
                    else template.description
                )
                print(f"      {desc}...")
                print()

    elif args.catalog_action == "show":
        template = agent_catalog.get_agent(args.template_id)
        if not template:
            print(f"Error: Template not found: {args.template_id}")
            return 1

        if hasattr(args, "json") and args.json:
            print(json.dumps(agent_catalog.template_to_dict(template), indent=2))
        else:
            print(f"\n{template.name}")
            print("=" * len(template.name))
            print(f"\nCategory: {template.category}")
            print(f"Version: {template.version}")
            print(f"Pattern: {template.pattern}")
            print(f"\nDescription:\n  {template.description}")
            print(f"\nTools: {', '.join(template.tools)}")

    elif args.catalog_action == "use":
        # install_from_catalog returns (success, message, path)
        success, message, path = agent_catalog.install_from_catalog(
            args.template_id,
            scope="user",
        )

        if success:
            print(f"Agent generated from template: {path}")
        else:
            print(f"Error: {message}")
            return 1

    else:
        print("Usage: platxa-agent catalog {list|show|use}")
        return 1

    return 0


def handle_install(args: argparse.Namespace) -> int:
    """Handle the install command."""
    if not args.path.exists():
        print(f"Error: File not found: {args.path}")
        return 1

    # Validate first unless skipped
    if not args.no_validate:
        content = args.path.read_text(encoding="utf-8")
        syntax_result = syntax_validator.validate_content(content)

        if not syntax_result.passed:
            print("Error: Agent definition has syntax errors")
            for error in syntax_result.errors:
                print(f"  - {error}")
            return 1

    # Install agent
    result = install_agent.install_agent(
        args.path,
        scope=args.scope,
        force=args.force,
    )

    if result.success:
        print(f"Agent installed to {args.scope} scope")
        print(f"Location: {result.installed_path}")
        return 0
    else:
        print(f"Error: {result.message or 'Installation failed'}")
        return 1


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "catalog": handle_catalog,
    "install": handle_install,
}
