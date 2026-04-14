"""
Agent Export System for Sharing

Production-grade export system for sharing AI agents with:
- Multiple export formats (zip, tar.gz, directory)
- Package metadata generation
- Dependency bundling
- Configuration sanitization
- Import validation and installation
- Registry-compatible manifests
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any


class ExportFormat(Enum):
    """Supported export formats."""

    ZIP = "zip"
    TAR_GZ = "tar.gz"
    DIRECTORY = "directory"


class ImportSource(Enum):
    """Types of import sources."""

    FILE = "file"
    URL = "url"
    REGISTRY = "registry"
    DIRECTORY = "directory"


@dataclass
class PackageManifest:
    """Package manifest for exported agents."""

    name: str
    version: str
    description: str
    author: str = ""
    license: str = "MIT"
    homepage: str = ""
    repository: str = ""
    keywords: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    min_claude_code_version: str = "1.0.0"
    created_at: str = ""
    checksum: str = ""
    files: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "license": self.license,
            "homepage": self.homepage,
            "repository": self.repository,
            "keywords": self.keywords,
            "tools": self.tools,
            "dependencies": self.dependencies,
            "min_claude_code_version": self.min_claude_code_version,
            "created_at": self.created_at,
            "checksum": self.checksum,
            "files": self.files,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PackageManifest:
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            version=data.get("version", "1.0.0"),
            description=data.get("description", ""),
            author=data.get("author", ""),
            license=data.get("license", "MIT"),
            homepage=data.get("homepage", ""),
            repository=data.get("repository", ""),
            keywords=data.get("keywords", []),
            tools=data.get("tools", []),
            dependencies=data.get("dependencies", []),
            min_claude_code_version=data.get("min_claude_code_version", "1.0.0"),
            created_at=data.get("created_at", ""),
            checksum=data.get("checksum", ""),
            files=data.get("files", []),
        )


@dataclass
class ExportResult:
    """Result of an export operation."""

    success: bool
    export_path: str
    manifest: PackageManifest | None = None
    files_exported: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    size_bytes: int = 0


@dataclass
class ImportResult:
    """Result of an import operation."""

    success: bool
    agent_name: str
    installed_path: str = ""
    manifest: PackageManifest | None = None
    files_installed: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    """Result of package validation."""

    valid: bool
    manifest: PackageManifest | None = None
    issues: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# Project-root files that must travel with a shared agent bundle. Unlike
# agent-local files (agents/, hooks/, scripts/) these live *above* the
# .claude/ directory so the export/import round-trip must track them
# separately. Currently only ``.mcp.json`` (project MCP server config) —
# add new entries here when bundling gains more project-root artifacts.
PROJECT_ROOT_CONFIG_FILES: tuple[str, ...] = (".mcp.json",)

# In-bundle directory that receives the project-root config files. Named
# ``config`` rather than ``root`` so the intent is self-documenting when a
# human inspects an extracted bundle.
BUNDLE_CONFIG_DIR: str = "config"


# Sensitive patterns to sanitize during export
SENSITIVE_PATTERNS = [
    r"api[_-]?key\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+[\"']?",
    r"secret\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+[\"']?",
    r"password\s*[:=]\s*[\"']?[^\s\"']+[\"']?",
    r"token\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+[\"']?",
    r"AKIA[0-9A-Z]{16}",  # AWS access key
    r"sk-[a-zA-Z0-9]{48}",  # OpenAI API key pattern
]


def extract_agent_metadata(content: str) -> dict[str, Any]:
    """Extract metadata from agent file content."""
    metadata: dict[str, Any] = {}

    if not content.startswith("---"):
        return metadata

    parts = content.split("---", 2)
    if len(parts) < 3:
        return metadata

    frontmatter = parts[1]

    # Parse YAML-like frontmatter
    for line in frontmatter.strip().split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip().strip("\"'")

            # Handle comma-separated lists
            if "," in value and key in ("tools", "keywords"):
                value = [v.strip() for v in value.split(",")]

            metadata[key] = value

    return metadata


def sanitize_content(content: str, preserve_placeholders: bool = True) -> str:
    """
    Sanitize content by removing sensitive information.

    Args:
        content: Content to sanitize
        preserve_placeholders: If True, replace with placeholders; if False, remove entirely

    Returns:
        Sanitized content
    """
    sanitized = content

    for pattern in SENSITIVE_PATTERNS:
        if preserve_placeholders:
            # Replace with placeholder
            sanitized = re.sub(
                pattern,
                lambda m: re.sub(r"[:=]\s*[\"']?[^\"'\s]+[\"']?", ": [REDACTED]", m.group(0)),
                sanitized,
                flags=re.IGNORECASE,
            )
        else:
            # Remove entirely
            sanitized = re.sub(pattern, "", sanitized, flags=re.IGNORECASE)

    return sanitized


def compute_checksum(file_paths: list[Path]) -> str:
    """Compute combined checksum of multiple files."""
    hasher = hashlib.sha256()

    for path in sorted(file_paths):
        if path.exists() and path.is_file():
            hasher.update(path.read_bytes())

    return hasher.hexdigest()[:32]


def detect_project_root(agent_path: Path) -> Path:
    """Infer the project root for a given agent file.

    Claude Code agent files typically live at ``<project>/.claude/agents/*.md``,
    so the project root is the parent of the ``.claude/`` directory. Two
    fallbacks cover non-standard layouts without raising:

    - If ``.claude/`` is missing, return ``agent_path.parent.parent`` so
      callers still get a directory two levels up (matching the standard
      layout structurally).
    - If the path is so shallow that two parents would escape the
      filesystem, return the highest available parent.

    This helper is deliberately lenient rather than validating — it's used
    during export to locate ``.mcp.json`` and should never fail on an
    unusual directory layout.
    """
    candidate = agent_path
    for _ in range(6):  # bounded walk — prevents infinite loops on symlinks
        if candidate.parent.name == ".claude":
            return candidate.parent.parent
        candidate = candidate.parent
        if candidate == candidate.parent:
            break
    # Fallback: standard layout structure, even if names don't match.
    if agent_path.parent.parent.exists():
        return agent_path.parent.parent
    return agent_path.parent


def collect_project_root_configs(agent_path: Path) -> list[Path]:
    """Find project-root config files that should ship with a bundle.

    These are files living at the project root (above ``.claude/``) that a
    receiving project needs to recreate the agent's runtime environment —
    currently only ``.mcp.json``. Non-existent files are silently omitted
    so a project without MCP servers still produces a valid bundle.

    Args:
        agent_path: Path to the agent's ``.md`` file. The project root is
            inferred via :func:`detect_project_root`.

    Returns:
        Ordered list of existing project-root config files. Empty list
        when no configured files exist at the root.
    """
    project_root = detect_project_root(agent_path)
    configs: list[Path] = []
    for filename in PROJECT_ROOT_CONFIG_FILES:
        candidate = project_root / filename
        if candidate.exists() and candidate.is_file():
            configs.append(candidate)
    return configs


def collect_agent_files(
    agent_path: Path,
    include_related: bool = True,
) -> list[Path]:
    """
    Collect all files related to an agent.

    Args:
        agent_path: Path to main agent file
        include_related: Include related files (commands, hooks, etc.)

    Returns:
        List of file paths to include in export
    """
    files: list[Path] = [agent_path]
    agent_name = agent_path.stem
    agent_dir = agent_path.parent

    if not include_related:
        return files

    # Check for related command file
    commands_dir = agent_dir.parent / "commands"
    if commands_dir.exists():
        command_file = commands_dir / f"{agent_name}.md"
        if command_file.exists():
            files.append(command_file)

    # Check for related hooks
    hooks_dir = agent_dir.parent / "hooks"
    if hooks_dir.exists():
        for hook_file in hooks_dir.glob(f"*{agent_name}*"):
            files.append(hook_file)

    # Check for version history
    versions_dir = agent_dir / ".versions"
    if versions_dir.exists():
        history_file = versions_dir / f"{agent_name}.history.json"
        if history_file.exists():
            files.append(history_file)

    # Check for agent-specific scripts
    scripts_dir = agent_dir.parent / "scripts"
    if scripts_dir.exists():
        for script in scripts_dir.glob(f"{agent_name}*"):
            files.append(script)

    return files


def create_manifest(
    agent_path: Path,
    files: list[Path],
    author: str = "",
    license_type: str = "MIT",
    homepage: str = "",
    repository: str = "",
    keywords: list[str] | None = None,
) -> PackageManifest:
    """
    Create a package manifest for an agent.

    Args:
        agent_path: Path to main agent file
        files: List of files to include
        author: Package author
        license_type: License type
        homepage: Homepage URL
        repository: Repository URL
        keywords: Package keywords

    Returns:
        PackageManifest instance
    """
    content = agent_path.read_text()
    metadata = extract_agent_metadata(content)

    # Extract tools from frontmatter
    tools = metadata.get("tools", [])
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",")]

    # Get version from frontmatter or default
    version = metadata.get("version", "1.0.0")

    # Compute checksum
    checksum = compute_checksum(files)

    # Relative file paths for manifest
    base_dir = agent_path.parent
    relative_files = []
    for f in files:
        try:
            relative_files.append(str(f.relative_to(base_dir.parent)))
        except ValueError:
            relative_files.append(str(f.name))

    return PackageManifest(
        name=metadata.get("name", agent_path.stem),
        version=version,
        description=metadata.get("description", ""),
        author=author,
        license=license_type,
        homepage=homepage,
        repository=repository,
        keywords=keywords or [],
        tools=tools,
        dependencies=[],  # Could be extracted from agent content
        min_claude_code_version="1.0.0",
        created_at=datetime.now(timezone.utc).isoformat(),
        checksum=checksum,
        files=relative_files,
    )


def export_agent(
    agent_path: Path,
    output_path: Path | None = None,
    format: ExportFormat = ExportFormat.ZIP,
    include_related: bool = True,
    sanitize: bool = True,
    author: str = "",
    license_type: str = "MIT",
    include_mcp_config: bool = True,
) -> ExportResult:
    """
    Export an agent as a shareable package.

    Args:
        agent_path: Path to agent file
        output_path: Output path (optional, auto-generated if not provided)
        format: Export format
        include_related: Include related files
        sanitize: Sanitize sensitive information
        author: Package author
        license_type: License type

    Returns:
        ExportResult with details
    """
    if not agent_path.exists():
        return ExportResult(
            success=False,
            export_path="",
            errors=[f"Agent file not found: {agent_path}"],
        )

    warnings: list[str] = []
    errors: list[str] = []

    # Collect files to export
    files = collect_agent_files(agent_path, include_related)

    # Collect project-root config files (.mcp.json etc). These live *above*
    # .claude/ so they're tracked separately and routed to config/ in the
    # bundle — independent from hooks/scripts/.versions which come from
    # within the agent's .claude/ directory.
    project_configs = collect_project_root_configs(agent_path) if include_mcp_config else []

    # Create manifest
    manifest = create_manifest(
        agent_path,
        files,
        author=author,
        license_type=license_type,
    )

    # Determine output path
    if output_path is None:
        ext = (
            ".zip"
            if format == ExportFormat.ZIP
            else ".tar.gz"
            if format == ExportFormat.TAR_GZ
            else ""
        )
        output_path = agent_path.parent / f"{manifest.name}-{manifest.version}{ext}"

    # Create temporary directory for packaging
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        package_dir = temp_path / manifest.name

        # Create package structure
        agents_dir = package_dir / "agents"
        agents_dir.mkdir(parents=True, exist_ok=True)

        files_exported: list[str] = []

        # Copy and optionally sanitize files
        for src_file in files:
            if not src_file.exists():
                warnings.append(f"File not found, skipping: {src_file}")
                continue

            # Determine destination
            if "commands" in str(src_file):
                dest_dir = package_dir / "commands"
            elif "hooks" in str(src_file):
                dest_dir = package_dir / "hooks"
            elif "scripts" in str(src_file):
                dest_dir = package_dir / "scripts"
            elif ".versions" in str(src_file):
                dest_dir = package_dir / "versions"
            else:
                dest_dir = agents_dir

            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_file = dest_dir / src_file.name

            # Read and optionally sanitize content
            if src_file.suffix in (".md", ".py", ".sh", ".yaml", ".yml", ".json"):
                content = src_file.read_text()
                if sanitize:
                    original_content = content
                    content = sanitize_content(content)
                    if content != original_content:
                        warnings.append(f"Sanitized sensitive data in: {src_file.name}")
                dest_file.write_text(content)
            else:
                shutil.copy2(src_file, dest_file)

            files_exported.append(str(dest_file.relative_to(package_dir)))

        # Copy project-root config files (.mcp.json) to ``config/`` in the
        # bundle. Kept out of the main ``files`` loop because these live
        # above .claude/ and have a dedicated extraction target on import.
        if project_configs:
            config_dst = package_dir / BUNDLE_CONFIG_DIR
            config_dst.mkdir(parents=True, exist_ok=True)
            for config_src in project_configs:
                if not config_src.exists():
                    warnings.append(f"Project config not found, skipping: {config_src}")
                    continue
                dest_config = config_dst / config_src.name
                content = config_src.read_text()
                if sanitize:
                    original = content
                    content = sanitize_content(content)
                    if content != original:
                        warnings.append(f"Sanitized sensitive data in: {config_src.name}")
                dest_config.write_text(content)
                files_exported.append(str(dest_config.relative_to(package_dir)))

        # Write manifest
        manifest.files = files_exported
        manifest_path = package_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest.to_dict(), f, indent=2)

        # Write README
        readme_content = generate_package_readme(manifest)
        readme_path = package_dir / "README.md"
        readme_path.write_text(readme_content)

        # Create package
        try:
            if format == ExportFormat.ZIP:
                output_path = Path(str(output_path).rstrip(".zip") + ".zip")
                with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    for file in package_dir.rglob("*"):
                        if file.is_file():
                            arcname = file.relative_to(temp_path)
                            zf.write(file, arcname)

            elif format == ExportFormat.TAR_GZ:
                output_path = Path(str(output_path).rstrip(".tar.gz") + ".tar.gz")
                with tarfile.open(output_path, "w:gz") as tf:
                    tf.add(package_dir, arcname=manifest.name)

            elif format == ExportFormat.DIRECTORY:
                if output_path.exists():
                    shutil.rmtree(output_path)
                shutil.copytree(package_dir, output_path)

        except Exception as e:
            return ExportResult(
                success=False,
                export_path="",
                errors=[f"Failed to create package: {e}"],
            )

        # Get package size
        if output_path.is_file():
            size_bytes = output_path.stat().st_size
        else:
            size_bytes = sum(f.stat().st_size for f in output_path.rglob("*") if f.is_file())

        return ExportResult(
            success=True,
            export_path=str(output_path),
            manifest=manifest,
            files_exported=files_exported,
            warnings=warnings,
            errors=errors,
            size_bytes=size_bytes,
        )


def generate_package_readme(manifest: PackageManifest) -> str:
    """Generate README content for a package."""
    lines = [
        f"# {manifest.name}",
        "",
        manifest.description or "An AI agent for Claude Code CLI.",
        "",
        "## Installation",
        "",
        "```bash",
        "# Import the agent package",
        f"claude-agent import {manifest.name}-{manifest.version}.zip",
        "```",
        "",
        "## Details",
        "",
        f"- **Version**: {manifest.version}",
        f"- **Author**: {manifest.author or 'Unknown'}",
        f"- **License**: {manifest.license}",
        "",
    ]

    if manifest.tools:
        lines.extend(
            [
                "## Required Tools",
                "",
                ", ".join(manifest.tools),
                "",
            ]
        )

    if manifest.keywords:
        lines.extend(
            [
                "## Keywords",
                "",
                ", ".join(manifest.keywords),
                "",
            ]
        )

    if manifest.homepage:
        lines.extend(
            [
                "## Links",
                "",
                f"- [Homepage]({manifest.homepage})",
            ]
        )
        if manifest.repository:
            lines.append(f"- [Repository]({manifest.repository})")
        lines.append("")

    lines.extend(
        [
            "## Files",
            "",
        ]
    )

    for file in manifest.files:
        lines.append(f"- `{file}`")

    return "\n".join(lines)


def validate_package(package_path: Path) -> ValidationResult:
    """
    Validate an agent package before import.

    Args:
        package_path: Path to package file or directory

    Returns:
        ValidationResult with details
    """
    issues: list[str] = []
    warnings: list[str] = []
    manifest: PackageManifest | None = None

    # Extract or read package contents
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        try:
            if package_path.is_dir():
                # Directory package
                package_dir = package_path
            elif package_path.suffix == ".zip":
                with zipfile.ZipFile(package_path, "r") as zf:
                    zf.extractall(temp_path)
                # Find the package directory
                dirs = list(temp_path.iterdir())
                package_dir = dirs[0] if dirs else temp_path
            elif str(package_path).endswith(".tar.gz"):
                with tarfile.open(package_path, "r:gz") as tf:
                    tf.extractall(temp_path)
                dirs = list(temp_path.iterdir())
                package_dir = dirs[0] if dirs else temp_path
            else:
                return ValidationResult(
                    valid=False,
                    issues=[f"Unsupported package format: {package_path.suffix}"],
                )
        except Exception as e:
            return ValidationResult(
                valid=False,
                issues=[f"Failed to extract package: {e}"],
            )

        # Check for manifest
        manifest_path = package_dir / "manifest.json"
        if not manifest_path.exists():
            issues.append("Missing manifest.json")
        else:
            try:
                with open(manifest_path) as f:
                    manifest_data = json.load(f)
                manifest = PackageManifest.from_dict(manifest_data)

                # Validate manifest fields
                if not manifest.name:
                    issues.append("Manifest missing 'name' field")
                if not manifest.version:
                    issues.append("Manifest missing 'version' field")
                if not manifest.description:
                    warnings.append("Manifest missing 'description' field")

            except json.JSONDecodeError as e:
                issues.append(f"Invalid manifest.json: {e}")
            except Exception as e:
                issues.append(f"Error reading manifest: {e}")

        # Check for agent files
        agents_dir = package_dir / "agents"
        if not agents_dir.exists():
            issues.append("Missing 'agents' directory")
        else:
            agent_files = list(agents_dir.glob("*.md"))
            if not agent_files:
                issues.append("No agent files found in 'agents' directory")

        # Validate agent files
        for agent_file in agents_dir.glob("*.md") if agents_dir.exists() else []:
            content = agent_file.read_text()

            # Check frontmatter
            if not content.startswith("---"):
                issues.append(f"Agent file missing frontmatter: {agent_file.name}")
                continue

            parts = content.split("---", 2)
            if len(parts) < 3:
                issues.append(f"Agent file has invalid frontmatter: {agent_file.name}")
                continue

            # Check for required fields
            metadata = extract_agent_metadata(content)
            if not metadata.get("name"):
                warnings.append(f"Agent missing 'name' in frontmatter: {agent_file.name}")
            if not metadata.get("description"):
                warnings.append(f"Agent missing 'description' in frontmatter: {agent_file.name}")

        # Verify checksum if provided
        if manifest and manifest.checksum:
            # Collect files and compute checksum
            package_files = [
                f
                for f in package_dir.rglob("*")
                if f.is_file() and f.name not in ("manifest.json", "README.md")
            ]
            computed_checksum = compute_checksum(package_files)
            if computed_checksum != manifest.checksum:
                warnings.append(
                    f"Checksum mismatch (expected {manifest.checksum}, got {computed_checksum})"
                )

    return ValidationResult(
        valid=len(issues) == 0,
        manifest=manifest,
        issues=issues,
        warnings=warnings,
    )


def import_agent(
    package_path: Path,
    target_dir: Path | None = None,
    scope: str = "project",
    overwrite: bool = False,
    validate_first: bool = True,
) -> ImportResult:
    """
    Import an agent from a package.

    Args:
        package_path: Path to package file or directory
        target_dir: Target installation directory (optional)
        scope: Installation scope ('user' or 'project')
        overwrite: Overwrite existing files
        validate_first: Validate package before importing

    Returns:
        ImportResult with details
    """
    warnings: list[str] = []
    errors: list[str] = []

    # Validate package
    if validate_first:
        validation = validate_package(package_path)
        if not validation.valid:
            return ImportResult(
                success=False,
                agent_name="",
                errors=validation.issues,
                warnings=validation.warnings,
            )
        warnings.extend(validation.warnings)

    # Determine target directory
    if target_dir is None:
        if scope == "user":
            target_dir = Path.home() / ".claude"
        else:
            target_dir = Path.cwd() / ".claude"

    # Extract package
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        try:
            if package_path.is_dir():
                package_dir = package_path
            elif package_path.suffix == ".zip":
                with zipfile.ZipFile(package_path, "r") as zf:
                    zf.extractall(temp_path)
                dirs = list(temp_path.iterdir())
                package_dir = dirs[0] if dirs else temp_path
            elif str(package_path).endswith(".tar.gz"):
                with tarfile.open(package_path, "r:gz") as tf:
                    tf.extractall(temp_path)
                dirs = list(temp_path.iterdir())
                package_dir = dirs[0] if dirs else temp_path
            else:
                return ImportResult(
                    success=False,
                    agent_name="",
                    errors=[f"Unsupported format: {package_path.suffix}"],
                )
        except Exception as e:
            return ImportResult(
                success=False,
                agent_name="",
                errors=[f"Failed to extract package: {e}"],
            )

        # Read manifest
        manifest_path = package_dir / "manifest.json"
        manifest: PackageManifest | None = None
        if manifest_path.exists():
            with open(manifest_path) as f:
                manifest = PackageManifest.from_dict(json.load(f))

        agent_name = manifest.name if manifest else package_dir.name

        # Copy files to target
        files_installed: list[str] = []

        # Copy agents
        agents_src = package_dir / "agents"
        agents_dst = target_dir / "agents"
        if agents_src.exists():
            agents_dst.mkdir(parents=True, exist_ok=True)
            for agent_file in agents_src.glob("*.md"):
                dst_file = agents_dst / agent_file.name
                if dst_file.exists() and not overwrite:
                    warnings.append(f"Skipping existing file: {dst_file}")
                    continue
                shutil.copy2(agent_file, dst_file)
                files_installed.append(str(dst_file))

        # Copy commands
        commands_src = package_dir / "commands"
        commands_dst = target_dir / "commands"
        if commands_src.exists():
            commands_dst.mkdir(parents=True, exist_ok=True)
            for cmd_file in commands_src.glob("*.md"):
                dst_file = commands_dst / cmd_file.name
                if dst_file.exists() and not overwrite:
                    warnings.append(f"Skipping existing file: {dst_file}")
                    continue
                shutil.copy2(cmd_file, dst_file)
                files_installed.append(str(dst_file))

        # Copy hooks
        hooks_src = package_dir / "hooks"
        hooks_dst = target_dir / "hooks"
        if hooks_src.exists():
            hooks_dst.mkdir(parents=True, exist_ok=True)
            for hook_file in hooks_src.glob("*"):
                dst_file = hooks_dst / hook_file.name
                if dst_file.exists() and not overwrite:
                    warnings.append(f"Skipping existing file: {dst_file}")
                    continue
                shutil.copy2(hook_file, dst_file)
                files_installed.append(str(dst_file))

        # Copy scripts
        scripts_src = package_dir / "scripts"
        scripts_dst = target_dir / "scripts"
        if scripts_src.exists():
            scripts_dst.mkdir(parents=True, exist_ok=True)
            for script_file in scripts_src.glob("*"):
                dst_file = scripts_dst / script_file.name
                if dst_file.exists() and not overwrite:
                    warnings.append(f"Skipping existing file: {dst_file}")
                    continue
                shutil.copy2(script_file, dst_file)
                # Make scripts executable
                if dst_file.suffix in (".sh", ".py"):
                    os.chmod(dst_file, 0o755)
                files_installed.append(str(dst_file))

        # Restore project-root config files (.mcp.json). target_dir is the
        # ``.claude/`` directory, so ``target_dir.parent`` is the project
        # root — where the receiving project expects these files to live.
        # Refusal-to-overwrite keeps existing MCP configs intact unless the
        # caller passes ``overwrite=True``.
        config_src = package_dir / BUNDLE_CONFIG_DIR
        if config_src.exists():
            project_root = target_dir.parent
            project_root.mkdir(parents=True, exist_ok=True)
            for config_file in config_src.iterdir():
                if not config_file.is_file():
                    continue
                dst_config = project_root / config_file.name
                if dst_config.exists() and not overwrite:
                    warnings.append(f"Skipping existing project config: {dst_config}")
                    continue
                shutil.copy2(config_file, dst_config)
                files_installed.append(str(dst_config))

        installed_path = str(agents_dst / f"{agent_name}.md") if files_installed else ""

        return ImportResult(
            success=True,
            agent_name=agent_name,
            installed_path=installed_path,
            manifest=manifest,
            files_installed=files_installed,
            warnings=warnings,
            errors=errors,
        )


def list_exportable_agents(
    search_dir: Path | None = None,
) -> list[dict[str, Any]]:
    """
    List agents that can be exported.

    Args:
        search_dir: Directory to search (defaults to current .claude)

    Returns:
        List of agent info dictionaries
    """
    if search_dir is None:
        search_dir = Path.cwd() / ".claude" / "agents"

    agents: list[dict[str, Any]] = []

    if not search_dir.exists():
        return agents

    for agent_file in search_dir.glob("*.md"):
        content = agent_file.read_text()
        metadata = extract_agent_metadata(content)

        agents.append(
            {
                "name": metadata.get("name", agent_file.stem),
                "version": metadata.get("version", "1.0.0"),
                "description": metadata.get("description", ""),
                "path": str(agent_file),
                "size_bytes": agent_file.stat().st_size,
            }
        )

    return agents


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Agent Export/Import System")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export an agent")
    export_parser.add_argument("agent", help="Path to agent file")
    export_parser.add_argument("-o", "--output", help="Output path")
    export_parser.add_argument(
        "-f",
        "--format",
        choices=["zip", "tar.gz", "directory"],
        default="zip",
        help="Export format",
    )
    export_parser.add_argument("--no-sanitize", action="store_true", help="Skip sanitization")
    export_parser.add_argument("-a", "--author", default="", help="Package author")

    # Import command
    import_parser = subparsers.add_parser("import", help="Import an agent package")
    import_parser.add_argument("package", help="Path to package")
    import_parser.add_argument("-t", "--target", help="Target directory")
    import_parser.add_argument(
        "-s",
        "--scope",
        choices=["user", "project"],
        default="project",
        help="Installation scope",
    )
    import_parser.add_argument("--overwrite", action="store_true", help="Overwrite existing")

    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate a package")
    validate_parser.add_argument("package", help="Path to package")

    # List command
    list_parser = subparsers.add_parser("list", help="List exportable agents")
    list_parser.add_argument("-d", "--directory", help="Directory to search")

    args = parser.parse_args()

    if args.command == "export":
        format_map = {
            "zip": ExportFormat.ZIP,
            "tar.gz": ExportFormat.TAR_GZ,
            "directory": ExportFormat.DIRECTORY,
        }
        result = export_agent(
            Path(args.agent),
            output_path=Path(args.output) if args.output else None,
            format=format_map[args.format],
            sanitize=not args.no_sanitize,
            author=args.author,
        )

        if result.success:
            print(f"Exported to: {result.export_path}")
            print(f"Files: {len(result.files_exported)}")
            print(f"Size: {result.size_bytes:,} bytes")
            if result.warnings:
                print("\nWarnings:")
                for w in result.warnings:
                    print(f"  - {w}")
        else:
            print("Export failed:")
            for e in result.errors:
                print(f"  - {e}")

    elif args.command == "import":
        result = import_agent(
            Path(args.package),
            target_dir=Path(args.target) if args.target else None,
            scope=args.scope,
            overwrite=args.overwrite,
        )

        if result.success:
            print(f"Imported agent: {result.agent_name}")
            print(f"Installed to: {result.installed_path}")
            print(f"Files: {len(result.files_installed)}")
            if result.warnings:
                print("\nWarnings:")
                for w in result.warnings:
                    print(f"  - {w}")
        else:
            print("Import failed:")
            for e in result.errors:
                print(f"  - {e}")

    elif args.command == "validate":
        result = validate_package(Path(args.package))

        if result.valid:
            print("Package is valid!")
            if result.manifest:
                print(f"\nAgent: {result.manifest.name} v{result.manifest.version}")
                print(f"Description: {result.manifest.description}")
        else:
            print("Package validation failed:")
            for issue in result.issues:
                print(f"  - {issue}")

        if result.warnings:
            print("\nWarnings:")
            for w in result.warnings:
                print(f"  - {w}")

    elif args.command == "list":
        search_dir = Path(args.directory) if args.directory else None
        agents = list_exportable_agents(search_dir)

        if agents:
            print("Exportable agents:")
            for agent in agents:
                print(f"  {agent['name']} v{agent['version']}")
                print(
                    f"    {agent['description'][:60]}..."
                    if len(agent["description"]) > 60
                    else f"    {agent['description']}"
                )
                print(f"    Path: {agent['path']}")
        else:
            print("No agents found")

    else:
        parser.print_help()
