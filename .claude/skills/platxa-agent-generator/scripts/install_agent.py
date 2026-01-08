#!/usr/bin/env python3
"""
Agent Installation Script for User Scope

Installs validated agent definition files to ~/.claude/agents/ for user-wide availability.

Usage:
    python install_agent.py install agent.md
    python install_agent.py install agent.md --force
    python install_agent.py uninstall agent-name
    python install_agent.py list
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class InstallResult:
    """Result of installation operation."""

    success: bool
    message: str
    installed_path: str | None = None
    backup_path: str | None = None
    agent_name: str | None = None


def get_user_agents_dir() -> Path:
    """Get the user-scope agents directory."""
    return Path.home() / ".claude" / "agents"


def ensure_agents_dir(agents_dir: Path) -> bool:
    """
    Ensure the agents directory exists.

    Returns:
        True if directory exists or was created, False on error
    """
    try:
        agents_dir.mkdir(parents=True, exist_ok=True)
        return True
    except OSError as e:
        print(f"Error creating agents directory: {e}", file=sys.stderr)
        return False


def extract_agent_name(file_path: Path) -> str | None:
    """Extract agent name from frontmatter."""
    try:
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")

        if not lines or lines[0].strip() != "---":
            return None

        for line in lines[1:]:
            if line.strip() == "---":
                break
            if line.startswith("name:"):
                name = line.split(":", 1)[1].strip()
                # Remove quotes if present
                if name.startswith('"') and name.endswith('"'):
                    name = name[1:-1]
                elif name.startswith("'") and name.endswith("'"):
                    name = name[1:-1]
                return name

        return None
    except OSError:
        return None


def create_backup(existing_path: Path, backup_dir: Path | None = None) -> Path | None:
    """
    Create a timestamped backup of an existing file.

    Args:
        existing_path: Path to the file to backup
        backup_dir: Optional directory for backups (defaults to same directory)

    Returns:
        Path to backup file, or None on error
    """
    if not existing_path.exists():
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{existing_path.stem}.backup-{timestamp}{existing_path.suffix}"

    if backup_dir:
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / backup_name
    else:
        backup_path = existing_path.parent / backup_name

    try:
        shutil.copy2(existing_path, backup_path)
        return backup_path
    except OSError as e:
        print(f"Warning: Could not create backup: {e}", file=sys.stderr)
        return None


def run_syntax_validation(source: Path) -> tuple[bool, list[str]]:
    """
    Run syntax validation on agent file via subprocess.

    Returns:
        Tuple of (is_valid, error_messages)
    """
    script_dir = Path(__file__).parent
    validator_script = script_dir / "syntax_validator.py"

    if not validator_script.exists():
        return False, ["Syntax validator script not found"]

    try:
        result = subprocess.run(
            [sys.executable, str(validator_script), "--json", str(source)],
            capture_output=True,
            text=True,
            timeout=30,
        )

        output = json.loads(result.stdout)
        if output.get("valid", False):
            return True, []

        errors = [e.get("message", "Unknown error") for e in output.get("errors", [])]
        return False, errors[:3]  # Limit to first 3 errors

    except subprocess.TimeoutExpired:
        return False, ["Syntax validation timed out"]
    except json.JSONDecodeError:
        return False, ["Failed to parse validation output"]
    except OSError as e:
        return False, [f"Failed to run validation: {e}"]


def run_security_scan(source: Path) -> tuple[bool, float]:
    """
    Run security scan on agent file via subprocess.

    Returns:
        Tuple of (passed, score)
    """
    script_dir = Path(__file__).parent
    scanner_script = script_dir / "security_scanner.py"

    if not scanner_script.exists():
        return False, 0.0

    try:
        result = subprocess.run(
            [sys.executable, str(scanner_script), "--json", str(source)],
            capture_output=True,
            text=True,
            timeout=30,
        )

        output = json.loads(result.stdout)
        passed = output.get("passed", False)
        score = output.get("score", 0.0)
        return passed, score

    except subprocess.TimeoutExpired:
        return False, 0.0
    except json.JSONDecodeError:
        return False, 0.0
    except OSError:
        return False, 0.0


def install_agent(
    source_path: str | Path,
    force: bool = False,
    backup: bool = True,
    skip_validation: bool = False,
    min_security_score: float = 5.0,
) -> InstallResult:
    """
    Install an agent definition file to user scope.

    Args:
        source_path: Path to the agent file to install
        force: Overwrite existing without prompt
        backup: Create backup of existing file before overwrite
        skip_validation: Skip syntax and security validation
        min_security_score: Minimum security score required (default 5.0)

    Returns:
        InstallResult with success status and details
    """
    source = Path(source_path)

    # Check source exists
    if not source.exists():
        return InstallResult(
            success=False,
            message=f"Source file not found: {source_path}",
        )

    # Check file extension
    if source.suffix != ".md":
        return InstallResult(
            success=False,
            message=f"Invalid file extension (expected .md): {source.suffix}",
        )

    # Extract agent name
    agent_name = extract_agent_name(source)
    if not agent_name:
        return InstallResult(
            success=False,
            message="Could not extract agent name from frontmatter",
        )

    # Validate syntax
    if not skip_validation:
        is_valid, errors = run_syntax_validation(source)
        if not is_valid:
            return InstallResult(
                success=False,
                message=f"Syntax validation failed: {'; '.join(errors)}",
                agent_name=agent_name,
            )

    # Security scan
    if not skip_validation:
        passed, score = run_security_scan(source)
        if not passed:
            return InstallResult(
                success=False,
                message=f"Security scan failed (score: {score}/10, minimum: {min_security_score})",
                agent_name=agent_name,
            )
        if score < min_security_score:
            return InstallResult(
                success=False,
                message=f"Security score too low: {score}/10 (minimum: {min_security_score})",
                agent_name=agent_name,
            )

    # Get target directory
    agents_dir = get_user_agents_dir()
    if not ensure_agents_dir(agents_dir):
        return InstallResult(
            success=False,
            message=f"Could not create agents directory: {agents_dir}",
            agent_name=agent_name,
        )

    # Determine target path
    target_path = agents_dir / f"{agent_name}.md"
    backup_path = None

    # Handle existing file
    if target_path.exists():
        if not force:
            return InstallResult(
                success=False,
                message=f"Agent already exists: {target_path}. Use --force to overwrite.",
                agent_name=agent_name,
            )

        if backup:
            backup_path = create_backup(target_path)

    # Copy file to target
    try:
        shutil.copy2(source, target_path)
    except OSError as e:
        return InstallResult(
            success=False,
            message=f"Failed to install agent: {e}",
            agent_name=agent_name,
        )

    return InstallResult(
        success=True,
        message=f"Successfully installed agent '{agent_name}' to user scope",
        installed_path=str(target_path),
        backup_path=str(backup_path) if backup_path else None,
        agent_name=agent_name,
    )


def uninstall_agent(agent_name: str, backup: bool = True) -> InstallResult:
    """
    Uninstall an agent from user scope.

    Args:
        agent_name: Name of the agent to uninstall
        backup: Create backup before removing

    Returns:
        InstallResult with success status
    """
    agents_dir = get_user_agents_dir()
    target_path = agents_dir / f"{agent_name}.md"

    if not target_path.exists():
        return InstallResult(
            success=False,
            message=f"Agent not found: {agent_name}",
            agent_name=agent_name,
        )

    backup_path = None
    if backup:
        backup_path = create_backup(target_path)

    try:
        target_path.unlink()
    except OSError as e:
        return InstallResult(
            success=False,
            message=f"Failed to uninstall agent: {e}",
            agent_name=agent_name,
        )

    return InstallResult(
        success=True,
        message=f"Successfully uninstalled agent '{agent_name}'",
        backup_path=str(backup_path) if backup_path else None,
        agent_name=agent_name,
    )


def list_installed_agents() -> list[dict]:
    """
    List all installed user-scope agents.

    Returns:
        List of agent info dictionaries
    """
    agents_dir = get_user_agents_dir()
    agents = []

    if not agents_dir.exists():
        return agents

    for agent_file in agents_dir.glob("*.md"):
        # Skip backup files
        if ".backup-" in agent_file.name:
            continue

        agent_name = extract_agent_name(agent_file)
        if agent_name:
            stat = agent_file.stat()
            agents.append({
                "name": agent_name,
                "path": str(agent_file),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    return sorted(agents, key=lambda a: a["name"])


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Install agent definitions to user scope (~/.claude/agents/)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Install command
    install_parser = subparsers.add_parser("install", help="Install an agent")
    install_parser.add_argument("file", help="Agent definition file to install")
    install_parser.add_argument(
        "--force", "-f", action="store_true", help="Overwrite existing agent"
    )
    install_parser.add_argument(
        "--no-backup", action="store_true", help="Don't create backup of existing"
    )
    install_parser.add_argument(
        "--skip-validation", action="store_true", help="Skip syntax and security validation"
    )
    install_parser.add_argument(
        "--min-score", type=float, default=5.0, help="Minimum security score (default: 5.0)"
    )
    install_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Uninstall command
    uninstall_parser = subparsers.add_parser("uninstall", help="Uninstall an agent")
    uninstall_parser.add_argument("name", help="Agent name to uninstall")
    uninstall_parser.add_argument(
        "--no-backup", action="store_true", help="Don't create backup before removing"
    )
    uninstall_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # List command
    list_parser = subparsers.add_parser("list", help="List installed agents")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Default to install if just a file is provided
    args, remaining = parser.parse_known_args()

    # Handle legacy usage: install_agent.py file.md
    if args.command is None and remaining:
        # Re-parse with install as default
        sys.argv.insert(1, "install")
        args = parser.parse_args()

    if args.command == "install":
        result = install_agent(
            args.file,
            force=args.force,
            backup=not args.no_backup,
            skip_validation=args.skip_validation,
            min_security_score=args.min_score,
        )

        if args.json:
            output = {
                "success": result.success,
                "message": result.message,
                "installed_path": result.installed_path,
                "backup_path": result.backup_path,
                "agent_name": result.agent_name,
            }
            print(json.dumps(output, indent=2))
        else:
            if result.success:
                print(f"✓ {result.message}")
                print(f"  Path: {result.installed_path}")
                if result.backup_path:
                    print(f"  Backup: {result.backup_path}")
            else:
                print(f"✗ {result.message}", file=sys.stderr)

        sys.exit(0 if result.success else 1)

    elif args.command == "uninstall":
        result = uninstall_agent(args.name, backup=not args.no_backup)

        if args.json:
            output = {
                "success": result.success,
                "message": result.message,
                "backup_path": result.backup_path,
                "agent_name": result.agent_name,
            }
            print(json.dumps(output, indent=2))
        else:
            if result.success:
                print(f"✓ {result.message}")
                if result.backup_path:
                    print(f"  Backup: {result.backup_path}")
            else:
                print(f"✗ {result.message}", file=sys.stderr)

        sys.exit(0 if result.success else 1)

    elif args.command == "list":
        agents = list_installed_agents()

        if args.json:
            print(json.dumps(agents, indent=2))
        else:
            if agents:
                print(f"Installed agents ({len(agents)}):")
                print("-" * 40)
                for agent in agents:
                    print(f"  {agent['name']}")
                    print(f"    Path: {agent['path']}")
                    print(f"    Modified: {agent['modified']}")
            else:
                print("No agents installed in user scope")

        sys.exit(0)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
