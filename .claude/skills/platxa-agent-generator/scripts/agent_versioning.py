"""
Agent Versioning and Update System

Production-grade versioning system for AI agents with:
- Semantic versioning (major.minor.patch)
- Version tracking and history
- Update detection and application
- Migration support between versions
- Changelog generation
- Backward compatibility checks
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any


class VersionBump(Enum):
    """Types of version increments."""

    MAJOR = "major"  # Breaking changes
    MINOR = "minor"  # New features, backward compatible
    PATCH = "patch"  # Bug fixes, backward compatible


class UpdateType(Enum):
    """Types of agent updates."""

    FULL = "full"  # Complete replacement
    MERGE = "merge"  # Merge changes preserving customizations
    SELECTIVE = "selective"  # Update specific sections only


@dataclass
class SemanticVersion:
    """Semantic version representation."""

    major: int = 1
    minor: int = 0
    patch: int = 0
    prerelease: str = ""
    build: str = ""

    def __str__(self) -> str:
        """Convert to string representation."""
        version = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            version += f"-{self.prerelease}"
        if self.build:
            version += f"+{self.build}"
        return version

    def __lt__(self, other: SemanticVersion) -> bool:
        """Compare versions."""
        if self.major != other.major:
            return self.major < other.major
        if self.minor != other.minor:
            return self.minor < other.minor
        if self.patch != other.patch:
            return self.patch < other.patch
        # Prerelease versions are lower than release
        if self.prerelease and not other.prerelease:
            return True
        if not self.prerelease and other.prerelease:
            return False
        return self.prerelease < other.prerelease

    def __eq__(self, other: object) -> bool:
        """Check version equality."""
        if not isinstance(other, SemanticVersion):
            return False
        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.prerelease == other.prerelease
        )

    def __le__(self, other: SemanticVersion) -> bool:
        return self < other or self == other

    def __gt__(self, other: SemanticVersion) -> bool:
        return not self <= other

    def __ge__(self, other: SemanticVersion) -> bool:
        return not self < other

    def bump(self, bump_type: VersionBump) -> SemanticVersion:
        """Create a new version with the specified bump."""
        if bump_type == VersionBump.MAJOR:
            return SemanticVersion(self.major + 1, 0, 0)
        elif bump_type == VersionBump.MINOR:
            return SemanticVersion(self.major, self.minor + 1, 0)
        else:
            return SemanticVersion(self.major, self.minor, self.patch + 1)

    @classmethod
    def parse(cls, version_str: str) -> SemanticVersion:
        """Parse a version string into SemanticVersion."""
        pattern = r"^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$"
        match = re.match(pattern, version_str.strip())
        if not match:
            raise ValueError(f"Invalid version string: {version_str}")

        return cls(
            major=int(match.group(1)),
            minor=int(match.group(2)),
            patch=int(match.group(3)),
            prerelease=match.group(4) or "",
            build=match.group(5) or "",
        )


@dataclass
class VersionEntry:
    """A single version history entry."""

    version: str
    timestamp: str
    changes: list[str]
    author: str = ""
    commit_hash: str = ""
    content_hash: str = ""
    breaking_changes: list[str] = field(default_factory=list)
    deprecations: list[str] = field(default_factory=list)


@dataclass
class VersionHistory:
    """Complete version history for an agent."""

    agent_name: str
    current_version: str
    created_at: str
    entries: list[VersionEntry] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "agent_name": self.agent_name,
            "current_version": self.current_version,
            "created_at": self.created_at,
            "entries": [
                {
                    "version": e.version,
                    "timestamp": e.timestamp,
                    "changes": e.changes,
                    "author": e.author,
                    "commit_hash": e.commit_hash,
                    "content_hash": e.content_hash,
                    "breaking_changes": e.breaking_changes,
                    "deprecations": e.deprecations,
                }
                for e in self.entries
            ],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> VersionHistory:
        """Create from dictionary."""
        entries = [
            VersionEntry(
                version=e["version"],
                timestamp=e["timestamp"],
                changes=e["changes"],
                author=e.get("author", ""),
                commit_hash=e.get("commit_hash", ""),
                content_hash=e.get("content_hash", ""),
                breaking_changes=e.get("breaking_changes", []),
                deprecations=e.get("deprecations", []),
            )
            for e in data.get("entries", [])
        ]
        return cls(
            agent_name=data["agent_name"],
            current_version=data["current_version"],
            created_at=data["created_at"],
            entries=entries,
        )


@dataclass
class UpdateResult:
    """Result of an agent update operation."""

    success: bool
    old_version: str
    new_version: str
    changes_applied: list[str]
    backup_path: str | None = None
    conflicts: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    rollback_available: bool = False


@dataclass
class CompatibilityReport:
    """Report on version compatibility."""

    compatible: bool
    source_version: str
    target_version: str
    breaking_changes: list[str] = field(default_factory=list)
    migration_steps: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_version(version_str: str) -> SemanticVersion:
    """Parse a version string into components."""
    return SemanticVersion.parse(version_str)


def compare_versions(v1: str, v2: str) -> int:
    """
    Compare two version strings.

    Returns:
        -1 if v1 < v2
        0 if v1 == v2
        1 if v1 > v2
    """
    ver1 = parse_version(v1)
    ver2 = parse_version(v2)

    if ver1 < ver2:
        return -1
    elif ver1 > ver2:
        return 1
    return 0


def compute_content_hash(content: str) -> str:
    """Compute a hash of agent content for change detection."""
    # Normalize whitespace for consistent hashing
    normalized = re.sub(r"\s+", " ", content.strip())
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def extract_version_from_frontmatter(content: str) -> str | None:
    """Extract version from agent frontmatter."""
    if not content.startswith("---"):
        return None

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None

    frontmatter = parts[1]
    match = re.search(r"^version:\s*[\"']?([^\s\"']+)[\"']?\s*$", frontmatter, re.MULTILINE)
    if match:
        return match.group(1)

    return None


def update_frontmatter_version(content: str, new_version: str) -> str:
    """Update the version in agent frontmatter."""
    if not content.startswith("---"):
        return content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return content

    frontmatter = parts[1]

    # Check if version exists
    if re.search(r"^version:", frontmatter, re.MULTILINE):
        # Update existing version
        new_frontmatter = re.sub(
            r"^version:\s*[\"']?[^\s\"']+[\"']?\s*$",
            f"version: {new_version}",
            frontmatter,
            flags=re.MULTILINE,
        )
    else:
        # Add version after name field
        if re.search(r"^name:", frontmatter, re.MULTILINE):
            new_frontmatter = re.sub(
                r"^(name:\s*[^\n]+)$",
                f"\\1\nversion: {new_version}",
                frontmatter,
                flags=re.MULTILINE,
            )
        else:
            # Add at the beginning
            new_frontmatter = f"\nversion: {new_version}" + frontmatter

    return f"---{new_frontmatter}---{parts[2]}"


def get_version_history_path(agent_path: Path) -> Path:
    """Get the path to the version history file for an agent."""
    agent_dir = agent_path.parent
    agent_name = agent_path.stem
    return agent_dir / ".versions" / f"{agent_name}.history.json"


def load_version_history(agent_path: Path) -> VersionHistory | None:
    """Load version history for an agent."""
    history_path = get_version_history_path(agent_path)
    if not history_path.exists():
        return None

    try:
        with open(history_path) as f:
            data = json.load(f)
        return VersionHistory.from_dict(data)
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


def save_version_history(agent_path: Path, history: VersionHistory) -> bool:
    """Save version history for an agent."""
    history_path = get_version_history_path(agent_path)
    history_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(history_path, "w") as f:
            json.dump(history.to_dict(), f, indent=2)
        return True
    except (OSError, IOError):
        return False


def create_initial_version(
    agent_path: Path,
    version: str = "1.0.0",
    changes: list[str] | None = None,
    author: str = "",
) -> VersionHistory:
    """Create initial version history for an agent."""
    agent_name = agent_path.stem
    content = agent_path.read_text() if agent_path.exists() else ""
    content_hash = compute_content_hash(content)
    timestamp = datetime.now(timezone.utc).isoformat()

    entry = VersionEntry(
        version=version,
        timestamp=timestamp,
        changes=changes or ["Initial version"],
        author=author,
        content_hash=content_hash,
    )

    history = VersionHistory(
        agent_name=agent_name,
        current_version=version,
        created_at=timestamp,
        entries=[entry],
    )

    # Update agent file with version
    if agent_path.exists():
        content = agent_path.read_text()
        updated_content = update_frontmatter_version(content, version)
        agent_path.write_text(updated_content)

    save_version_history(agent_path, history)
    return history


def bump_version(
    agent_path: Path,
    bump_type: VersionBump,
    changes: list[str],
    author: str = "",
    breaking_changes: list[str] | None = None,
    deprecations: list[str] | None = None,
) -> tuple[bool, str]:
    """
    Bump the version of an agent.

    Args:
        agent_path: Path to the agent file
        bump_type: Type of version bump
        changes: List of changes in this version
        author: Author of the changes
        breaking_changes: List of breaking changes (for major bumps)
        deprecations: List of deprecations

    Returns:
        Tuple of (success, new_version or error_message)
    """
    if not agent_path.exists():
        return False, f"Agent file not found: {agent_path}"

    history = load_version_history(agent_path)
    if history is None:
        # Create initial history
        history = create_initial_version(agent_path, author=author)

    # Parse current version and bump
    try:
        current = SemanticVersion.parse(history.current_version)
    except ValueError:
        current = SemanticVersion(1, 0, 0)

    new_version = current.bump(bump_type)
    new_version_str = str(new_version)

    # Read content and compute hash
    content = agent_path.read_text()
    content_hash = compute_content_hash(content)
    timestamp = datetime.now(timezone.utc).isoformat()

    # Create new entry
    entry = VersionEntry(
        version=new_version_str,
        timestamp=timestamp,
        changes=changes,
        author=author,
        content_hash=content_hash,
        breaking_changes=breaking_changes or [],
        deprecations=deprecations or [],
    )

    # Update history
    history.current_version = new_version_str
    history.entries.append(entry)

    # Update agent file
    updated_content = update_frontmatter_version(content, new_version_str)
    agent_path.write_text(updated_content)

    # Save history
    if not save_version_history(agent_path, history):
        return False, "Failed to save version history"

    return True, new_version_str


def check_for_updates(
    local_path: Path,
    remote_content: str,
) -> tuple[bool, str | None]:
    """
    Check if an update is available for an agent.

    Args:
        local_path: Path to local agent file
        remote_content: Content of the remote/newer version

    Returns:
        Tuple of (update_available, remote_version or None)
    """
    if not local_path.exists():
        return True, extract_version_from_frontmatter(remote_content)

    local_content = local_path.read_text()
    local_version = extract_version_from_frontmatter(local_content)
    remote_version = extract_version_from_frontmatter(remote_content)

    if local_version is None or remote_version is None:
        # Compare by content hash if no versions
        local_hash = compute_content_hash(local_content)
        remote_hash = compute_content_hash(remote_content)
        return local_hash != remote_hash, remote_version

    comparison = compare_versions(local_version, remote_version)
    return comparison < 0, remote_version


def create_backup(agent_path: Path) -> Path | None:
    """Create a backup of an agent before updating."""
    if not agent_path.exists():
        return None

    backup_dir = agent_path.parent / ".versions" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{agent_path.stem}_{timestamp}.md.bak"
    backup_path = backup_dir / backup_name

    try:
        shutil.copy2(agent_path, backup_path)
        return backup_path
    except (OSError, IOError):
        return None


def restore_from_backup(agent_path: Path, backup_path: Path) -> bool:
    """Restore an agent from a backup."""
    if not backup_path.exists():
        return False

    try:
        shutil.copy2(backup_path, agent_path)
        return True
    except (OSError, IOError):
        return False


def apply_update(
    agent_path: Path,
    new_content: str,
    update_type: UpdateType = UpdateType.FULL,
    preserve_sections: list[str] | None = None,
) -> UpdateResult:
    """
    Apply an update to an agent.

    Args:
        agent_path: Path to the agent file
        new_content: New agent content
        update_type: Type of update to apply
        preserve_sections: Sections to preserve during merge

    Returns:
        UpdateResult with details of the operation
    """
    old_version = "0.0.0"
    if agent_path.exists():
        old_content = agent_path.read_text()
        old_version = extract_version_from_frontmatter(old_content) or "0.0.0"
    else:
        old_content = ""

    new_version = extract_version_from_frontmatter(new_content) or "1.0.0"

    # Create backup
    backup_path = create_backup(agent_path) if agent_path.exists() else None

    conflicts: list[str] = []
    warnings: list[str] = []
    changes_applied: list[str] = []

    try:
        if update_type == UpdateType.FULL:
            # Complete replacement
            agent_path.write_text(new_content)
            changes_applied.append("Full content replacement")

        elif update_type == UpdateType.MERGE:
            # Merge preserving customizations
            merged_content, merge_conflicts = merge_agent_content(
                old_content, new_content, preserve_sections or []
            )
            conflicts.extend(merge_conflicts)
            agent_path.write_text(merged_content)
            changes_applied.append("Merged with preserved customizations")

        elif update_type == UpdateType.SELECTIVE:
            # Update only specific sections
            selective_content = selective_update(
                old_content, new_content, preserve_sections or []
            )
            agent_path.write_text(selective_content)
            changes_applied.append(f"Selective update preserving: {preserve_sections}")

        # Update version history
        history = load_version_history(agent_path)
        if history:
            timestamp = datetime.now(timezone.utc).isoformat()
            content_hash = compute_content_hash(new_content)
            entry = VersionEntry(
                version=new_version,
                timestamp=timestamp,
                changes=[f"Updated from {old_version} to {new_version}"],
                content_hash=content_hash,
            )
            history.current_version = new_version
            history.entries.append(entry)
            save_version_history(agent_path, history)

        return UpdateResult(
            success=True,
            old_version=old_version,
            new_version=new_version,
            changes_applied=changes_applied,
            backup_path=str(backup_path) if backup_path else None,
            conflicts=conflicts,
            warnings=warnings,
            rollback_available=backup_path is not None,
        )

    except Exception as e:
        # Attempt rollback on failure
        if backup_path:
            restore_from_backup(agent_path, backup_path)
        return UpdateResult(
            success=False,
            old_version=old_version,
            new_version=new_version,
            changes_applied=[],
            backup_path=str(backup_path) if backup_path else None,
            conflicts=[str(e)],
            warnings=["Update failed, rolled back to previous version"],
            rollback_available=False,
        )


def merge_agent_content(
    old_content: str,
    new_content: str,
    preserve_sections: list[str],
) -> tuple[str, list[str]]:
    """
    Merge old and new agent content, preserving specified sections.

    Returns:
        Tuple of (merged_content, conflicts)
    """
    conflicts: list[str] = []

    # Parse both contents into sections
    old_sections = parse_markdown_sections(old_content)
    new_sections = parse_markdown_sections(new_content)

    # Start with new content as base
    merged_sections = dict(new_sections)

    # Preserve specified sections from old content
    for section_name in preserve_sections:
        if section_name in old_sections:
            if section_name in new_sections:
                # Both have the section - potential conflict
                if old_sections[section_name] != new_sections[section_name]:
                    conflicts.append(f"Section '{section_name}' differs - preserved old version")
            merged_sections[section_name] = old_sections[section_name]

    # Reconstruct content
    merged_content = reconstruct_markdown(merged_sections, new_content)
    return merged_content, conflicts


def selective_update(
    old_content: str,
    new_content: str,
    sections_to_update: list[str],
) -> str:
    """
    Update only specific sections from new content.
    """
    old_sections = parse_markdown_sections(old_content)
    new_sections = parse_markdown_sections(new_content)

    # Start with old content
    merged_sections = dict(old_sections)

    # Update only specified sections
    for section_name in sections_to_update:
        if section_name in new_sections:
            merged_sections[section_name] = new_sections[section_name]

    return reconstruct_markdown(merged_sections, old_content)


def parse_markdown_sections(content: str) -> dict[str, str]:
    """Parse markdown content into sections by headers."""
    sections: dict[str, str] = {}

    # Handle frontmatter separately
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            sections["__frontmatter__"] = parts[1]
            content = parts[2]

    # Split by headers
    current_section = "__intro__"
    current_content: list[str] = []

    for line in content.split("\n"):
        header_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if header_match:
            # Save previous section
            if current_content:
                sections[current_section] = "\n".join(current_content)
            # Start new section
            current_section = header_match.group(2).strip()
            current_content = [line]
        else:
            current_content.append(line)

    # Save last section
    if current_content:
        sections[current_section] = "\n".join(current_content)

    return sections


def reconstruct_markdown(
    sections: dict[str, str],
    template_content: str,
) -> str:
    """Reconstruct markdown from sections using template for ordering."""
    # Get section order from template
    template_sections = parse_markdown_sections(template_content)
    ordered_keys = list(template_sections.keys())

    # Add any sections not in template
    for key in sections:
        if key not in ordered_keys:
            ordered_keys.append(key)

    # Build content
    parts: list[str] = []

    # Handle frontmatter first
    if "__frontmatter__" in sections:
        parts.append(f"---{sections['__frontmatter__']}---")

    # Add other sections
    for key in ordered_keys:
        if key == "__frontmatter__":
            continue
        if key in sections:
            parts.append(sections[key])

    return "\n".join(parts)


def check_compatibility(
    from_version: str,
    to_version: str,
    history: VersionHistory | None = None,
) -> CompatibilityReport:
    """
    Check compatibility between two versions.

    Args:
        from_version: Source version
        to_version: Target version
        history: Optional version history for detailed analysis

    Returns:
        CompatibilityReport with compatibility details
    """
    try:
        from_ver = SemanticVersion.parse(from_version)
        to_ver = SemanticVersion.parse(to_version)
    except ValueError as e:
        return CompatibilityReport(
            compatible=False,
            source_version=from_version,
            target_version=to_version,
            breaking_changes=[f"Invalid version format: {e}"],
        )

    breaking_changes: list[str] = []
    migration_steps: list[str] = []
    warnings: list[str] = []

    # Check for major version difference
    if to_ver.major > from_ver.major:
        breaking_changes.append(
            f"Major version upgrade ({from_ver.major} → {to_ver.major}) may include breaking changes"
        )

    # Check version history for specific breaking changes
    if history:
        for entry in history.entries:
            try:
                entry_ver = SemanticVersion.parse(entry.version)
                if from_ver < entry_ver <= to_ver:
                    breaking_changes.extend(entry.breaking_changes)
                    if entry.deprecations:
                        warnings.extend(
                            [f"Deprecated in {entry.version}: {d}" for d in entry.deprecations]
                        )
            except ValueError:
                continue

    # Determine if upgrade is compatible
    compatible = len(breaking_changes) == 0 or to_ver.major == from_ver.major

    # Generate migration steps
    if not compatible:
        migration_steps = [
            "Review breaking changes listed above",
            "Update agent configuration as needed",
            "Test agent functionality after update",
            "Update dependent agents if any",
        ]

    return CompatibilityReport(
        compatible=compatible,
        source_version=from_version,
        target_version=to_version,
        breaking_changes=breaking_changes,
        migration_steps=migration_steps,
        warnings=warnings,
    )


def generate_changelog(
    history: VersionHistory,
    from_version: str | None = None,
    to_version: str | None = None,
) -> str:
    """
    Generate a changelog from version history.

    Args:
        history: Version history
        from_version: Start version (exclusive, optional)
        to_version: End version (inclusive, optional)

    Returns:
        Formatted changelog string
    """
    lines = [
        f"# Changelog - {history.agent_name}",
        "",
        f"Current Version: {history.current_version}",
        "",
    ]

    # Filter entries by version range
    filtered_entries: list[VersionEntry] = []
    for entry in reversed(history.entries):  # Most recent first
        try:
            entry_ver = SemanticVersion.parse(entry.version)
            if from_version:
                from_ver = SemanticVersion.parse(from_version)
                if entry_ver <= from_ver:
                    continue
            if to_version:
                to_ver = SemanticVersion.parse(to_version)
                if entry_ver > to_ver:
                    continue
            filtered_entries.append(entry)
        except ValueError:
            continue

    # Generate changelog entries
    for entry in filtered_entries:
        lines.append(f"## [{entry.version}] - {entry.timestamp[:10]}")
        if entry.author:
            lines.append(f"*Author: {entry.author}*")
        lines.append("")

        if entry.breaking_changes:
            lines.append("### Breaking Changes")
            for change in entry.breaking_changes:
                lines.append(f"- {change}")
            lines.append("")

        if entry.changes:
            lines.append("### Changes")
            for change in entry.changes:
                lines.append(f"- {change}")
            lines.append("")

        if entry.deprecations:
            lines.append("### Deprecations")
            for dep in entry.deprecations:
                lines.append(f"- {dep}")
            lines.append("")

    return "\n".join(lines)


def list_available_versions(agent_path: Path) -> list[str]:
    """List all available versions for an agent."""
    history = load_version_history(agent_path)
    if not history:
        # Check frontmatter for current version
        if agent_path.exists():
            content = agent_path.read_text()
            version = extract_version_from_frontmatter(content)
            if version:
                return [version]
        return []

    return [entry.version for entry in history.entries]


def rollback_to_version(
    agent_path: Path,
    target_version: str,
) -> tuple[bool, str]:
    """
    Rollback an agent to a previous version.

    Args:
        agent_path: Path to agent file
        target_version: Version to rollback to

    Returns:
        Tuple of (success, message)
    """
    history = load_version_history(agent_path)
    if not history:
        return False, "No version history found"

    # Find the target version entry
    target_entry = None
    for entry in history.entries:
        if entry.version == target_version:
            target_entry = entry
            break

    if not target_entry:
        return False, f"Version {target_version} not found in history"

    # Check for backup
    backup_dir = agent_path.parent / ".versions" / "backups"
    backups = list(backup_dir.glob(f"{agent_path.stem}_*.md.bak")) if backup_dir.exists() else []

    # Find backup closest to target version timestamp
    target_backup = None
    for backup in backups:
        # Extract timestamp from backup name
        timestamp_match = re.search(r"_(\d{8}_\d{6})\.md\.bak$", backup.name)
        if timestamp_match:
            backup_ts = timestamp_match.group(1)
            # Compare with target entry timestamp
            entry_ts = target_entry.timestamp[:19].replace("-", "").replace(":", "").replace("T", "_")
            if backup_ts <= entry_ts:
                if target_backup is None or backup_ts > target_backup[0]:
                    target_backup = (backup_ts, backup)

    if target_backup is None:
        return False, f"No backup available for version {target_version}"

    # Restore from backup
    if restore_from_backup(agent_path, target_backup[1]):
        # Update history
        history.current_version = target_version
        timestamp = datetime.now(timezone.utc).isoformat()
        rollback_entry = VersionEntry(
            version=target_version,
            timestamp=timestamp,
            changes=[f"Rolled back to version {target_version}"],
            content_hash=compute_content_hash(agent_path.read_text()),
        )
        history.entries.append(rollback_entry)
        save_version_history(agent_path, history)
        return True, f"Successfully rolled back to version {target_version}"

    return False, "Failed to restore from backup"


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Agent Versioning System")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Version command
    version_parser = subparsers.add_parser("version", help="Show agent version")
    version_parser.add_argument("agent", help="Path to agent file")

    # Bump command
    bump_parser = subparsers.add_parser("bump", help="Bump agent version")
    bump_parser.add_argument("agent", help="Path to agent file")
    bump_parser.add_argument(
        "type", choices=["major", "minor", "patch"], help="Version bump type"
    )
    bump_parser.add_argument("-m", "--message", required=True, help="Change description")
    bump_parser.add_argument("-a", "--author", default="", help="Author name")

    # History command
    history_parser = subparsers.add_parser("history", help="Show version history")
    history_parser.add_argument("agent", help="Path to agent file")

    # Changelog command
    changelog_parser = subparsers.add_parser("changelog", help="Generate changelog")
    changelog_parser.add_argument("agent", help="Path to agent file")
    changelog_parser.add_argument("--from", dest="from_version", help="From version")
    changelog_parser.add_argument("--to", dest="to_version", help="To version")

    # Init command
    init_parser = subparsers.add_parser("init", help="Initialize versioning")
    init_parser.add_argument("agent", help="Path to agent file")
    init_parser.add_argument("-v", "--version", default="1.0.0", help="Initial version")

    args = parser.parse_args()

    if args.command == "version":
        agent_path = Path(args.agent)
        if agent_path.exists():
            content = agent_path.read_text()
            version = extract_version_from_frontmatter(content)
            print(f"Version: {version or 'Not versioned'}")
        else:
            print(f"Agent not found: {agent_path}")

    elif args.command == "bump":
        bump_type = VersionBump(args.type)
        success, result = bump_version(
            Path(args.agent),
            bump_type,
            changes=[args.message],
            author=args.author,
        )
        if success:
            print(f"Version bumped to {result}")
        else:
            print(f"Error: {result}")

    elif args.command == "history":
        history = load_version_history(Path(args.agent))
        if history:
            print(f"Agent: {history.agent_name}")
            print(f"Current: {history.current_version}")
            print(f"\nVersions:")
            for entry in history.entries:
                print(f"  {entry.version} ({entry.timestamp[:10]})")
                for change in entry.changes:
                    print(f"    - {change}")
        else:
            print("No version history found")

    elif args.command == "changelog":
        history = load_version_history(Path(args.agent))
        if history:
            changelog = generate_changelog(
                history,
                from_version=args.from_version,
                to_version=args.to_version,
            )
            print(changelog)
        else:
            print("No version history found")

    elif args.command == "init":
        history = create_initial_version(Path(args.agent), version=args.version)
        print(f"Initialized versioning for {history.agent_name} at v{history.current_version}")

    else:
        parser.print_help()
