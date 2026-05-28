"""Plugin-lifecycle subcommands: install-plugin, uninstall-plugin, plugin-status.

All three handlers delegate every state mutation to
:mod:`platxa_agent_generator.plugin_installer`, which wraps the
canonical ``claude plugin`` CLI. The handlers here own only:

- argparse wiring (shared scope/timeout flags),
- JSON-vs-text output rendering,
- exit-code mapping from ``PluginInstallResult.success``.
"""

from __future__ import annotations

import argparse
import json
from typing import Any, Callable

from .. import plugin_installer


def register_parser(subparsers: Any) -> None:
    """Register install-plugin, uninstall-plugin, and plugin-status parsers."""
    _add_install_plugin_command(subparsers)
    _add_uninstall_plugin_command(subparsers)
    _add_plugin_status_command(subparsers)


def _add_install_plugin_command(subparsers: Any) -> None:
    """Add the install-plugin subcommand.

    Registers the repo as a Claude Code marketplace and installs the
    plugin at the requested scope. Delegates all state mutation to
    :func:`plugin_installer.install_plugin`, which wraps the canonical
    ``claude plugin`` CLI — this subcommand never touches the plugin
    registry files directly.
    """
    install = subparsers.add_parser(
        "install-plugin",
        help="Install the platxa-agent-generator plugin into Claude Code",
    )
    install.add_argument(
        "-s",
        "--scope",
        choices=list(plugin_installer.SUPPORTED_SCOPES),
        default="user",
        help="Install scope: user (~/.claude), project, or local. Default: user.",
    )
    install.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Re-register the marketplace and reinstall the plugin even if present.",
    )
    install.add_argument(
        "--timeout",
        type=int,
        default=plugin_installer.DEFAULT_TIMEOUT_SECONDS,
        help=(
            f"Per-CLI-call timeout in seconds (default: {plugin_installer.DEFAULT_TIMEOUT_SECONDS})"
        ),
    )


def _add_uninstall_plugin_command(subparsers: Any) -> None:
    """Add the uninstall-plugin subcommand.

    Mirrors install-plugin for the reverse operation. The
    ``--remove-marketplace`` flag is opt-in because leaving the
    marketplace entry registered is cheap and makes reinstall fast;
    only set it when a full cleanup is desired.
    """
    uninstall = subparsers.add_parser(
        "uninstall-plugin",
        help="Uninstall the platxa-agent-generator plugin from Claude Code",
    )
    uninstall.add_argument(
        "-s",
        "--scope",
        choices=list(plugin_installer.SUPPORTED_SCOPES),
        default="user",
        help="Scope to uninstall from. Default: user.",
    )
    uninstall.add_argument(
        "--remove-marketplace",
        action="store_true",
        help="Also deregister the self-hosted marketplace entry.",
    )
    uninstall.add_argument(
        "--timeout",
        type=int,
        default=plugin_installer.DEFAULT_TIMEOUT_SECONDS,
        help=(
            f"Per-CLI-call timeout in seconds (default: {plugin_installer.DEFAULT_TIMEOUT_SECONDS})"
        ),
    )


def _add_plugin_status_command(subparsers: Any) -> None:
    """Add the plugin-status subcommand (read-only inspection)."""
    subparsers.add_parser(
        "plugin-status",
        help="Show install state of the platxa-agent-generator plugin",
    )


def handle_install_plugin(args: argparse.Namespace) -> int:
    """Execute install-plugin and render the result.

    Each CLI step is printed (or emitted as JSON) so the caller sees
    exactly which underlying ``claude plugin`` commands ran and
    whether any were skipped as no-ops. Exit code mirrors
    :attr:`PluginInstallResult.success`."""
    json_mode = bool(getattr(args, "json", False))
    result = plugin_installer.install_plugin(
        scope=args.scope,
        force=bool(args.force),
        timeout=int(args.timeout),
    )
    if json_mode:
        print(json.dumps(_plugin_result_to_dict(result), indent=2))
    else:
        _print_plugin_result(result, title="Plugin install")
    return 0 if result.success else 1


def handle_uninstall_plugin(args: argparse.Namespace) -> int:
    """Execute uninstall-plugin and render the result."""
    json_mode = bool(getattr(args, "json", False))
    result = plugin_installer.uninstall_plugin(
        scope=args.scope,
        remove_marketplace=bool(args.remove_marketplace),
        timeout=int(args.timeout),
    )
    if json_mode:
        print(json.dumps(_plugin_result_to_dict(result), indent=2))
    else:
        _print_plugin_result(result, title="Plugin uninstall")
    return 0 if result.success else 1


def handle_plugin_status(args: argparse.Namespace) -> int:
    """Execute plugin-status (read-only)."""
    json_mode = bool(getattr(args, "json", False))
    status = plugin_installer.plugin_status()
    if json_mode:
        print(
            json.dumps(
                {
                    "plugin_installed": status.plugin_installed,
                    "marketplace_registered": status.marketplace_registered,
                    "installed_scope": status.installed_scope,
                    "installed_version": status.installed_version,
                    "install_path": status.install_path,
                    "marketplace_path": status.marketplace_path,
                },
                indent=2,
            )
        )
    else:
        print("Plugin status")
        print("-" * 40)
        print(f"  Plugin installed:   {status.plugin_installed}")
        if status.plugin_installed:
            print(f"    Scope:            {status.installed_scope}")
            print(f"    Version:          {status.installed_version}")
            print(f"    Install path:     {status.install_path}")
        print(
            f"  Marketplace:        {'registered' if status.marketplace_registered else 'not registered'}"
        )
        if status.marketplace_registered:
            print(f"    Location:         {status.marketplace_path}")
    return 0


def _plugin_result_to_dict(result: "plugin_installer.PluginInstallResult") -> dict[str, Any]:
    """Convert a PluginInstallResult to a JSON-safe dict.

    Kept module-private so both install and uninstall handlers share
    the serialization shape — reviewers parsing machine output should
    not have to handle two variants."""
    return {
        "success": result.success,
        "message": result.message,
        "plugin_install_path": result.plugin_install_path,
        "marketplace_added": result.marketplace_added,
        "marketplace_already_present": result.marketplace_already_present,
        "plugin_already_installed": result.plugin_already_installed,
        "steps": [
            {
                "name": step.name,
                "command": list(step.command),
                "returncode": step.returncode,
                "stdout": step.stdout,
                "stderr": step.stderr,
                "skipped": step.skipped,
                "passed": step.passed,
            }
            for step in result.steps
        ],
    }


def _print_plugin_result(
    result: "plugin_installer.PluginInstallResult",
    *,
    title: str,
) -> None:
    """Human-readable renderer for plugin install/uninstall results."""
    flag = "✓" if result.success else "✗"
    print(f"{flag} {title}: {result.message}")
    if result.steps:
        print("  Steps:")
        for step in result.steps:
            marker = "•" if step.skipped else ("✓" if step.passed else "✗")
            print(f"    {marker} {step.name}" + (" (skipped)" if step.skipped else ""))
            if step.stderr.strip() and not step.passed:
                print(f"        stderr: {step.stderr.strip()[:200]}")
    if result.plugin_install_path:
        print(f"  Install path: {result.plugin_install_path}")


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "install-plugin": handle_install_plugin,
    "uninstall-plugin": handle_uninstall_plugin,
    "plugin-status": handle_plugin_status,
}
