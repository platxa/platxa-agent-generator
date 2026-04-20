#!/usr/bin/env python3
"""
Agent Installation Script

Installs validated agent definition files to user or project scope.

Scopes:
    user: ~/.claude/agents/ (available across all projects)
    project: .claude/agents/ (available only in current project)

Usage:
    python install_agent.py install agent.md                    # Install to user scope (default)
    python install_agent.py install agent.md --scope project    # Install to project scope
    python install_agent.py install agent.md --force            # Overwrite existing
    python install_agent.py uninstall agent-name                # Uninstall from user scope
    python install_agent.py uninstall agent-name --scope project
    python install_agent.py list                                # List user scope agents
    python install_agent.py list --scope project                # List project scope agents
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal

try:
    from .syntax_validator import parse_frontmatter, validate_file
except ImportError:
    from syntax_validator import (  # type: ignore[import-not-found,no-redef]
        parse_frontmatter,
        validate_file,
    )

try:
    from .shared.paths import DEFAULT_AGENTS_DIR
except ImportError:
    from shared.paths import DEFAULT_AGENTS_DIR  # type: ignore[import-not-found,no-redef]

# Default subdirectory layout for an installed agent's companion artifacts,
# rooted at the install scope (``~/.claude`` for user, ``<project>/.claude``
# for project). Public so callers (tests, custom installers) can override.
DEFAULT_SKILLS_SUBDIR: str = "skills"
SKILL_MANIFEST_FILENAME: str = "SKILL.md"

# Verification check identifiers — surfaced via PostInstallVerification.checks
# so tooling can reason about which checks ran independent of their result.
CHECK_SYNTAX: str = "syntax"
CHECK_SKILLS: str = "skills"
CHECK_MCP: str = "mcp_servers"

# Canonical order in which checks run during verify_installation. Constants
# above are deliberately public so tests can pin both names AND ordering.
VERIFICATION_CHECK_ORDER: tuple[str, ...] = (CHECK_SYNTAX, CHECK_SKILLS, CHECK_MCP)


@dataclass
class PostInstallVerification:
    """Result of post-install verification on an installed agent file.

    A verification is ``valid`` only when every check that *ran* passed.
    ``checks`` is the ordered list of check names that executed; ``findings``
    is the parallel list of human-readable failure messages (one per check
    that failed). An empty ``findings`` with a non-empty ``checks`` means
    every check passed — that's the success shape.
    """

    valid: bool
    checks: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)


@dataclass
class InstallResult:
    """Result of installation operation."""

    success: bool
    message: str
    installed_path: str | None = None
    backup_path: str | None = None
    agent_name: str | None = None
    verification: PostInstallVerification | None = None


# Tokens that, when present in an agent's description or body, indicate the
# agent is coupled to a specific language, framework, or project tooling —
# meaning it should live under ``project`` scope rather than be installed
# globally. Matching is case-insensitive and substring-based (intentional —
# see ``_scan_project_signals`` docstring for the rationale; tokens like
# ``src/`` and ``next.js`` don't play nicely with word-boundary regex).
#
# Grouped by reason for explainability: each match contributes a
# human-readable ``"<category>: <token>"`` entry to the recommendation's
# reasoning list so operators can trace why a given agent was flagged.
PROJECT_SCOPE_SIGNALS: dict[str, tuple[str, ...]] = {
    "language": (
        "python",
        "typescript",
        "javascript",
        "rust",
        "golang",
        "ruby",
    ),
    "framework": (
        "react",
        "next.js",
        "nextjs",
        "django",
        "fastapi",
        "flask",
        "vue",
        "svelte",
        "rails",
    ),
    "test_runner": (
        "pytest",
        "vitest",
        "jest",
        "mocha",
        "cargo test",
        "go test",
    ),
    "linter": (
        "ruff",
        "eslint",
        "pyright",
        "mypy",
        "prettier",
        "tsc",
        "rustfmt",
    ),
    "package_manager": (
        "npm",
        "pnpm",
        "yarn",
        "pip install",
        "cargo",
        "poetry",
    ),
    "project_path": (
        "src/",
        "packages/",
        "apps/",
        "tests/",
        "node_modules",
    ),
}


@dataclass
class ScopeRecommendation:
    """Suggested install scope for an agent, with explainable reasoning.

    Fields:
        scope: ``"user"`` or ``"project"``. ``"user"`` means the agent is
            generic enough to be useful across projects; ``"project"``
            means it references language/framework/tooling specifics
            that tie it to a particular codebase.
        reasons: Ordered list of human-readable reasons the recommendation
            came out this way. Always populated — even for a ``user``
            recommendation, reasons include "no project-specific signals
            detected" so the caller can always explain the choice.
        matched_signals: The raw token matches (``"<category>: <token>"``)
            that drove the recommendation. Empty for ``user``; non-empty
            for ``project``. Kept separate from ``reasons`` so
            programmatic consumers can enumerate matches without parsing
            prose.
    """

    scope: Literal["user", "project"]
    reasons: list[str] = field(default_factory=list)
    matched_signals: list[str] = field(default_factory=list)


def _read_agent_text(source: Path | str) -> str | None:
    """Return the text content of an agent file, or None on read failure.

    Centralised so the recommender can be used against both string
    content (tests, in-memory analysis) and on-disk files without each
    caller implementing its own I/O error handling.
    """
    try:
        return Path(source).read_text(encoding="utf-8")
    except OSError:
        return None


def _scan_project_signals(text: str) -> list[str]:
    """Return ``<category>: <token>`` matches for project-scope signals.

    Matching is case-insensitive and substring-based. Substring is
    intentional here (not word-boundary regex): signals like ``src/``,
    ``next.js``, and ``pip install`` contain punctuation that trips up
    naive word boundaries, and false positives on common English words
    are already mitigated by the deliberately technical token list.

    Order preserves the declaration order in :data:`PROJECT_SCOPE_SIGNALS`
    so the returned list is stable across runs.
    """
    matches: list[str] = []
    lower = text.lower()
    for category, tokens in PROJECT_SCOPE_SIGNALS.items():
        for token in tokens:
            if token.lower() in lower:
                matches.append(f"{category}: {token}")
    return matches


def recommend_scope(
    source: Path | str | None = None,
    *,
    content: str | None = None,
) -> ScopeRecommendation:
    """Recommend ``user`` vs ``project`` scope for an agent.

    Pass either ``source`` (filesystem path) *or* ``content`` (in-memory
    text). When both are given, ``content`` wins — useful for tests
    exercising the recommender without writing temp files.

    Decision rule:

    - If any token from :data:`PROJECT_SCOPE_SIGNALS` appears in the
      agent's frontmatter description or body, recommend
      ``"project"`` scope. These signals mean the agent understands or
      emits code tied to a specific stack, so it belongs in the
      project's ``.claude/agents/`` where that stack context lives.
    - Otherwise recommend ``"user"`` scope. A generic agent (e.g. a
      code-explorer that only uses Read/Grep/Glob) is reusable across
      projects and belongs in ``~/.claude/agents/``.

    The returned :class:`ScopeRecommendation` always carries a non-empty
    ``reasons`` list so the caller can explain the choice to the user
    without having to replicate the heuristic.

    Graceful degradation: if the source cannot be read (missing file,
    permission error), the function returns a ``user``-scope
    recommendation with a single "unable to read source" reason rather
    than raising — the CLI can still show something useful to the
    operator, who can then decide whether to override.
    """
    text = content if content is not None else _read_agent_text(source) if source else None
    if text is None:
        return ScopeRecommendation(
            scope="user",
            reasons=[
                "No source content available; defaulting to user scope "
                "(the safer choice — user-scope agents are always visible)."
            ],
        )

    matches = _scan_project_signals(text)
    if matches:
        return ScopeRecommendation(
            scope="project",
            reasons=[
                "Agent references project-specific tooling or stack "
                f"({len(matches)} signal{'s' if len(matches) != 1 else ''} matched).",
                "Install under project scope so the agent ships with the codebase "
                "that provides its context.",
            ],
            matched_signals=matches,
        )
    return ScopeRecommendation(
        scope="user",
        reasons=[
            "No project-specific tokens detected (no language, framework, "
            "linter, test runner, package manager, or project-path references).",
            "Install under user scope so the agent is reusable across all projects.",
        ],
    )


def get_user_agents_dir() -> Path:
    """Get the user-scope agents directory."""
    return Path.home() / DEFAULT_AGENTS_DIR


def get_project_root() -> Path | None:
    """
    Find the project root by looking for .claude directory or .git.

    Returns:
        Path to project root, or None if not in a project
    """
    current = Path.cwd()

    # Walk up the directory tree
    for parent in [current, *current.parents]:
        # Check for .claude directory (Claude Code project marker)
        if (parent / ".claude").is_dir():
            return parent
        # Check for .git directory (git repository root)
        if (parent / ".git").exists():
            return parent

    # No project root found, use current directory
    return None


def get_project_agents_dir() -> Path | None:
    """
    Get the project-scope agents directory.

    Returns:
        Path to .claude/agents/ in project root, or None if not in a project
    """
    project_root = get_project_root()
    if project_root is None:
        return None
    return project_root / DEFAULT_AGENTS_DIR


def get_agents_dir(scope: str) -> Path | None:
    """
    Get agents directory based on scope.

    Args:
        scope: "user" or "project"

    Returns:
        Path to agents directory, or None if project scope not available
    """
    if scope == "user":
        return get_user_agents_dir()
    elif scope == "project":
        return get_project_agents_dir()
    else:
        return None


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

        # Distinguish validator crash (returncode != 0) from invalid-agent
        # (returncode == 0 + valid=False in JSON). Without this check a
        # crashed validator's empty/garbled stdout would surface as a
        # JSONDecodeError or be misreported as a parsing failure rather
        # than a validator crash.
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()[:500]
            return False, [f"validator crashed (exit {result.returncode}): {stderr}"]

        output = json.loads(result.stdout)
        if output.get("valid", False):
            return True, []

        errors = [e.get("message", "Unknown error") for e in output.get("errors", [])]
        return False, errors[:3]  # Limit to first 3 errors

    except subprocess.TimeoutExpired:
        return False, ["Syntax validation timed out"]
    except json.JSONDecodeError:
        stderr = (result.stderr or "").strip()[:500]
        return False, [f"Failed to parse validation output; stderr: {stderr}"]
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

        # A crashed scanner (non-zero returncode) cannot have produced a
        # trustworthy JSON verdict; treat it as a hard fail rather than
        # attempting to parse a potentially empty or truncated stdout.
        # The return signature is (bool, float) with no error channel, so
        # we surface the crash reason to stderr — silently returning
        # (False, 0.0) would be indistinguishable from a clean scan that
        # flagged critical findings.
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()[:500]
            print(
                f"run_security_scan: scanner crashed (exit {result.returncode}): {stderr}",
                file=sys.stderr,
            )
            return False, 0.0

        output = json.loads(result.stdout)
        passed = output.get("passed", False)
        score = output.get("score", 0.0)
        return passed, score

    except subprocess.TimeoutExpired:
        print("run_security_scan: scanner timed out after 30s", file=sys.stderr)
        return False, 0.0
    except json.JSONDecodeError as exc:
        stderr = (result.stderr or "").strip()[:500]
        print(
            f"run_security_scan: failed to parse scanner output ({exc}); stderr: {stderr}",
            file=sys.stderr,
        )
        return False, 0.0
    except OSError as exc:
        print(f"run_security_scan: failed to run scanner: {exc}", file=sys.stderr)
        return False, 0.0


def _install_root_for_scope(scope: str) -> Path | None:
    """Return the ``.claude`` directory matching the install scope.

    For ``user`` scope this is ``~/.claude``; for ``project`` scope this
    walks up from the current working directory looking for the project
    marker (delegating to :func:`get_project_root`). Returns ``None``
    when the scope is invalid or no project is found.
    """
    if scope == "user":
        return Path.home() / ".claude"
    if scope == "project":
        root = get_project_root()
        return (root / ".claude") if root else None
    return None


def _check_skill_references(
    skills_field: object,
    install_root: Path,
) -> list[str]:
    """Return one finding per missing skill reference (empty list = all present).

    ``skills_field`` accepts either a comma-separated string (frontmatter
    scalar) or a YAML list — agents in the wild use both. Other types
    surface a finding rather than raising, since malformed frontmatter
    is the exact failure mode this verification is designed to catch.
    """
    if isinstance(skills_field, str):
        names = [name.strip() for name in skills_field.split(",") if name.strip()]
    elif isinstance(skills_field, list):
        names = [str(name).strip() for name in skills_field if str(name).strip()]
    else:
        return [f"unsupported 'skills' frontmatter type: {type(skills_field).__name__}"]

    skills_dir = install_root / DEFAULT_SKILLS_SUBDIR
    findings: list[str] = []
    for name in names:
        manifest = skills_dir / name / SKILL_MANIFEST_FILENAME
        if not manifest.is_file():
            findings.append(f"referenced skill '{name}' has no manifest at {manifest}")
    return findings


def _check_mcp_servers(mcp_block: object) -> list[str]:
    """Validate ``mcpServers`` frontmatter shape.

    Each entry must be a dict with at minimum a ``command`` key — that's
    what Claude Code's MCP loader requires to spawn the server. Missing
    ``command`` is the single most common deployment-time failure, so
    we surface it eagerly here rather than at first invocation.
    """
    if not isinstance(mcp_block, dict):
        return [f"'mcpServers' must be a mapping, got {type(mcp_block).__name__}"]
    findings: list[str] = []
    for name, server in mcp_block.items():
        if not isinstance(server, dict):
            findings.append(f"mcpServers.{name}: expected mapping, got {type(server).__name__}")
            continue
        if "command" not in server or not str(server.get("command", "")).strip():
            findings.append(f"mcpServers.{name}: missing required 'command' field")
    return findings


def verify_installation(
    installed_path: str | Path,
    scope: str = "user",
    install_root: Path | None = None,
) -> PostInstallVerification:
    """Verify an installed agent file is well-formed and self-consistent.

    Runs three checks in :data:`VERIFICATION_CHECK_ORDER`:

    1. **syntax**: re-parses the installed file with the project's
       :func:`syntax_validator.validate_file` (in-process, no subprocess).
       Catches truncated copies, file-system corruption, and any drift
       between the source and the installed copy.
    2. **skills**: every name listed in the agent's ``skills:`` frontmatter
       must resolve to ``<install_root>/skills/<name>/SKILL.md``.
    3. **mcp_servers**: every entry in the ``mcpServers:`` frontmatter
       block must be a mapping with a non-empty ``command`` field.

    ``install_root`` defaults to the ``.claude`` directory inferred from
    ``scope`` — pass it explicitly when verifying an agent that lives
    outside the standard layout (e.g., in tests).
    """
    path = Path(installed_path)
    checks: list[str] = []
    findings: list[str] = []

    if install_root is None:
        install_root = _install_root_for_scope(scope)
    # Resolved root may still be None if scope is invalid AND the caller
    # didn't supply an explicit root. We let skill/MCP checks early-return
    # (with a finding) rather than silently skipping them.

    # Check 1: syntax validation on the installed copy
    checks.append(CHECK_SYNTAX)
    syntax_result = validate_file(path)
    if not syntax_result.passed:
        for err in syntax_result.errors:
            if err.severity == "error":
                findings.append(f"syntax: L{err.line} [{err.code}] {err.message}")

    # Read frontmatter once for the remaining checks; if parsing fails we
    # already surfaced it as a syntax finding above, so skip cleanly.
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as exc:
        findings.append(f"could not read installed file for reference checks: {exc}")
        return PostInstallVerification(valid=False, checks=checks, findings=findings)

    frontmatter, _, _, raw_frontmatter = parse_frontmatter(content)
    # Prefer the raw (preserves nested structures like mcpServers) when present.
    fm: dict = raw_frontmatter if raw_frontmatter is not None else (frontmatter or {})

    # Check 2: referenced skills exist
    checks.append(CHECK_SKILLS)
    if "skills" in fm and fm["skills"]:
        if install_root is None:
            findings.append(
                "skills: cannot verify references — no install root resolved "
                f"for scope '{scope}' and no explicit install_root given"
            )
        else:
            findings.extend(_check_skill_references(fm["skills"], install_root))

    # Check 3: mcpServers structure
    checks.append(CHECK_MCP)
    if "mcpServers" in fm and fm["mcpServers"]:
        findings.extend(_check_mcp_servers(fm["mcpServers"]))

    return PostInstallVerification(
        valid=not findings,
        checks=checks,
        findings=findings,
    )


def install_agent(
    source_path: str | Path,
    scope: str = "user",
    force: bool = False,
    backup: bool = True,
    skip_validation: bool = False,
    min_security_score: float = 5.0,
) -> InstallResult:
    """
    Install an agent definition file to specified scope.

    Args:
        source_path: Path to the agent file to install
        scope: Installation scope ("user" or "project")
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

    # Get target directory based on scope
    agents_dir = get_agents_dir(scope)
    if agents_dir is None:
        return InstallResult(
            success=False,
            message=f"Invalid scope '{scope}' or not in a project (for project scope)",
            agent_name=agent_name,
        )
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

    # Post-install verification: re-validate the *installed* file (catches
    # truncated copies or filesystem corruption) and confirm any referenced
    # skills/MCP servers are present in the target environment. Verification
    # findings always travel back on the result so callers can surface them
    # even on success — matching the "fail loud, never silent" project rule.
    verification = verify_installation(target_path, scope=scope) if not skip_validation else None

    if verification is not None and not verification.valid:
        return InstallResult(
            success=False,
            message=(f"Post-install verification failed: {'; '.join(verification.findings[:3])}"),
            installed_path=str(target_path),
            backup_path=str(backup_path) if backup_path else None,
            agent_name=agent_name,
            verification=verification,
        )

    return InstallResult(
        success=True,
        message=f"Successfully installed agent '{agent_name}' to {scope} scope",
        installed_path=str(target_path),
        backup_path=str(backup_path) if backup_path else None,
        agent_name=agent_name,
        verification=verification,
    )


def uninstall_agent(agent_name: str, scope: str = "user", backup: bool = True) -> InstallResult:
    """
    Uninstall an agent from specified scope.

    Args:
        agent_name: Name of the agent to uninstall
        scope: Installation scope ("user" or "project")
        backup: Create backup before removing

    Returns:
        InstallResult with success status
    """
    agents_dir = get_agents_dir(scope)
    if agents_dir is None:
        return InstallResult(
            success=False,
            message=f"Invalid scope '{scope}' or not in a project (for project scope)",
            agent_name=agent_name,
        )

    target_path = agents_dir / f"{agent_name}.md"

    if not target_path.exists():
        return InstallResult(
            success=False,
            message=f"Agent not found in {scope} scope: {agent_name}",
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
        message=f"Successfully uninstalled agent '{agent_name}' from {scope} scope",
        backup_path=str(backup_path) if backup_path else None,
        agent_name=agent_name,
    )


def list_installed_agents(scope: str = "user") -> list[dict]:
    """
    List all installed agents in specified scope.

    Args:
        scope: Installation scope ("user" or "project")

    Returns:
        List of agent info dictionaries
    """
    agents_dir = get_agents_dir(scope)
    agents: list[dict] = []

    if agents_dir is None or not agents_dir.exists():
        return agents

    for agent_file in agents_dir.glob("*.md"):
        # Skip backup files
        if ".backup-" in agent_file.name:
            continue

        agent_name = extract_agent_name(agent_file)
        if agent_name:
            stat = agent_file.stat()
            agents.append(
                {
                    "name": agent_name,
                    "path": str(agent_file),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }
            )

    return sorted(agents, key=lambda a: a["name"])


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Install agent definitions to user or project scope"
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
        "--skip-validation",
        action="store_true",
        help="Skip syntax and security validation",
    )
    install_parser.add_argument(
        "--min-score",
        type=float,
        default=5.0,
        help="Minimum security score (default: 5.0)",
    )
    install_parser.add_argument("--json", action="store_true", help="Output as JSON")
    install_parser.add_argument(
        "--scope",
        choices=["user", "project"],
        default="user",
        help="Installation scope: user (~/.claude/agents/) or project (.claude/agents/)",
    )

    # Uninstall command
    uninstall_parser = subparsers.add_parser("uninstall", help="Uninstall an agent")
    uninstall_parser.add_argument("name", help="Agent name to uninstall")
    uninstall_parser.add_argument(
        "--no-backup", action="store_true", help="Don't create backup before removing"
    )
    uninstall_parser.add_argument("--json", action="store_true", help="Output as JSON")
    uninstall_parser.add_argument(
        "--scope",
        choices=["user", "project"],
        default="user",
        help="Scope to uninstall from: user or project",
    )

    # List command
    list_parser = subparsers.add_parser("list", help="List installed agents")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")
    list_parser.add_argument(
        "--scope",
        choices=["user", "project"],
        default="user",
        help="Scope to list agents from: user or project",
    )

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
            scope=args.scope,
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
        result = uninstall_agent(args.name, scope=args.scope, backup=not args.no_backup)

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
        agents = list_installed_agents(scope=args.scope)

        if args.json:
            print(json.dumps(agents, indent=2))
        else:
            if agents:
                print(f"Installed agents in {args.scope} scope ({len(agents)}):")
                print("-" * 40)
                for agent in agents:
                    print(f"  {agent['name']}")
                    print(f"    Path: {agent['path']}")
                    print(f"    Modified: {agent['modified']}")
            else:
                print(f"No agents installed in {args.scope} scope")

        sys.exit(0)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
