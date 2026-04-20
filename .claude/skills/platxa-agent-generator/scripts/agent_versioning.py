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

    # Prevent duplicate-version conflicts in the history catalog.
    # ``history.entries`` is append-only and downstream tooling keys
    # off ``entry.version`` as a unique identifier (rollback lookup,
    # changelog generation, diff indexing). Writing two entries with
    # the same version would corrupt those lookups — the entry that
    # "wins" depends on insertion order, which is not a contract we
    # want to rely on. Refuse cleanly instead. The conflict is
    # reachable when ``current_version`` and ``entries`` drift (e.g.
    # a partially-restored backup) or on concurrent bumps.
    if any(e.version == new_version_str for e in history.entries):
        return False, (
            f"version {new_version_str} already exists in history "
            f"(tag conflict); resolve the drift between current_version="
            f"{history.current_version!r} and entries before bumping"
        )

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

    # Refuse downgrades. apply_update is the forward-update path: a
    # remote catalog that claims a lower semver than the local install
    # either (a) is malformed, (b) is a malicious rollback attempt,
    # or (c) a legitimate rollback that should go through the
    # explicit ``rollback_to_version`` API instead. Silently writing
    # a lower-numbered version into the agent would corrupt the
    # semver-ordered history assumed by downstream tooling
    # (check_compatibility, generate_changelog, list_available_versions).
    try:
        if compare_versions(new_version, old_version) < 0:
            return UpdateResult(
                success=False,
                old_version=old_version,
                new_version=new_version,
                changes_applied=[],
                conflicts=[
                    f"Refusing downgrade: {old_version} -> {new_version}. "
                    f"Use rollback_to_version for intentional rollbacks."
                ],
            )
    except ValueError:
        # Malformed version strings fall through to the regular update
        # path; the downstream parsers will surface the parse error
        # with better context than we can here.
        pass

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
            selective_content = selective_update(old_content, new_content, preserve_sections or [])
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


@dataclass
class BreakingChangeSignal:
    """A single detected breaking change between two agent versions.

    Breaking changes here are things an *external* caller of the agent
    would notice and need to adapt to — tool removal, identity change,
    model change. Purely internal edits (rewording a capability bullet,
    reordering examples) are not breaking and do not appear here.

    Fields:
        category: Short machine-readable tag — ``"tools"``, ``"name"``,
            ``"model"``, or ``"description_shape"``.
        description: Human-readable sentence explaining the change,
            suitable for inclusion in a changelog.
    """

    category: str
    description: str


@dataclass
class RegenerationResult:
    """Outcome of :func:`regenerate_agent`.

    The workflow is atomic from the caller's perspective: on success,
    the agent file, version history, and archive are all consistent;
    on failure, the agent file is rolled back to the archived content
    and ``success`` is ``False``. Callers should inspect ``error``
    when ``success`` is ``False``.
    """

    success: bool
    old_version: str
    new_version: str
    bump_type: VersionBump
    breaking_changes: list[BreakingChangeSignal] = field(default_factory=list)
    changelog: str = ""
    archive_path: str | None = None
    history_path: str = ""
    error: str = ""


# Frontmatter fields that count toward breaking-change detection. Kept at
# module scope so callers and tests can see (and extend) the contract
# rather than it being an implementation detail inside the function.
_BREAKING_FRONTMATTER_FIELDS: tuple[str, ...] = ("name", "model")


def _parse_frontmatter_fields(content: str) -> dict[str, str]:
    """Extract frontmatter as a flat ``{field: value}`` mapping.

    Simpler than the full agent parser — only used by breaking-change
    detection to read ``name``, ``tools``, and ``model``. Returns empty
    dict when no frontmatter is present so callers don't have to branch.
    """
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    fields: dict[str, str] = {}
    for line in parts[1].split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip().strip("\"'")
    return fields


def _split_tools(tools_value: str) -> set[str]:
    """Split a frontmatter ``tools`` value into a canonical set.

    The tools field is comma-separated in Claude Code's agent format.
    Empty entries and surrounding whitespace are stripped so
    ``"Read, Write, "`` and ``"Read,Write"`` compare equal.
    """
    return {token.strip() for token in tools_value.split(",") if token.strip()}


def detect_breaking_changes(old_content: str, new_content: str) -> list[BreakingChangeSignal]:
    """Detect breaking changes between two agent versions.

    The contract is deliberately narrow: only changes that would make an
    *external* caller's existing integration fail or behave differently
    are reported. This keeps the minor-version bump meaningful — every
    signal here represents a real change in the agent's contract.

    Detection rules (in canonical order so output is deterministic):

    1. **name** — frontmatter ``name`` changed (identity breaking).
    2. **model** — frontmatter ``model`` changed (runtime environment
       changes; output behavior may differ even for identical prompts).
    3. **tools** — any tool that was previously declared has been
       *removed*. Adding tools is additive and not breaking.

    Args:
        old_content: The previous agent file content (including frontmatter).
        new_content: The regenerated agent file content.

    Returns:
        Ordered list of detected signals. Empty list means the change is
        backwards-compatible and only merits a patch bump.
    """
    old_fm = _parse_frontmatter_fields(old_content)
    new_fm = _parse_frontmatter_fields(new_content)

    signals: list[BreakingChangeSignal] = []

    # 1+2. Single-value frontmatter fields whose change is breaking.
    # Iterating over the module-level tuple keeps the contract in one
    # place: to add a new breaking field (e.g. "role"), extend
    # ``_BREAKING_FRONTMATTER_FIELDS`` — no changes here required.
    for field_name in _BREAKING_FRONTMATTER_FIELDS:
        old_value = old_fm.get(field_name, "")
        new_value = new_fm.get(field_name, "")
        if old_value and new_value and old_value != new_value:
            signals.append(
                BreakingChangeSignal(
                    category=field_name,
                    description=(
                        f"{field_name.capitalize()} changed from '{old_value}' to '{new_value}'"
                    ),
                )
            )

    # 3. Tool removal (capability shrinkage)
    old_tools = _split_tools(old_fm.get("tools", ""))
    new_tools = _split_tools(new_fm.get("tools", ""))
    removed = sorted(old_tools - new_tools)
    for tool in removed:
        signals.append(
            BreakingChangeSignal(
                category="tools",
                description=f"Tool removed from declared set: {tool}",
            )
        )

    return signals


@dataclass
class AgentDiff:
    """Comprehensive diff between two agent versions for human review.

    Sibling to :class:`BreakingChangeSignal` but broader: this captures
    *every* observable difference (additions, removals, modifications)
    across frontmatter, tools, and markdown sections — not just changes
    that break external callers. It is the data model behind the
    ``versions diff`` CLI command and is rendered by
    :func:`format_agent_diff` for terminal output.

    Tool changes are reported separately from the rest of the
    frontmatter because tools are list-valued (set semantics: order does
    not matter, additions and removals are independent) and rendering
    them as a single "before/after" string would obscure the actual
    capability shift the reviewer cares about.

    Section changes are ordered by markdown header text. The header
    itself is the section identifier — bodies are compared verbatim
    (whitespace-insensitive) to decide whether a section changed.

    Fields:
        frontmatter_added: ``{field: new_value}`` for fields present in
            the new version but absent in the old. ``tools`` is excluded
            (handled by ``tools_added`` / ``tools_removed``).
        frontmatter_removed: ``{field: old_value}`` for fields present
            in the old version but absent in the new. ``tools``
            excluded.
        frontmatter_changed: ``{field: (old_value, new_value)}`` for
            fields present in both versions whose value changed.
            ``tools`` excluded.
        tools_added: Tool names declared in the new version but not the
            old, sorted alphabetically for deterministic output.
        tools_removed: Tool names declared in the old version but not
            the new, sorted alphabetically.
        sections_added: Markdown header text for sections present only
            in the new version, in the order they appear in that
            version.
        sections_removed: Markdown header text for sections present
            only in the old version, in the order they appeared there.
        sections_changed: Markdown header text for sections present in
            both versions whose body content (whitespace-normalized)
            differs.
    """

    frontmatter_added: dict[str, str] = field(default_factory=dict)
    frontmatter_removed: dict[str, str] = field(default_factory=dict)
    frontmatter_changed: dict[str, tuple[str, str]] = field(default_factory=dict)
    tools_added: list[str] = field(default_factory=list)
    tools_removed: list[str] = field(default_factory=list)
    sections_added: list[str] = field(default_factory=list)
    sections_removed: list[str] = field(default_factory=list)
    sections_changed: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        """``True`` when no observable difference exists between the versions.

        Useful for short-circuiting renderers (skip the "no changes"
        boilerplate when called from a CLI that pipes output) and for
        regression tests asserting that round-tripping does not
        introduce phantom diffs.
        """
        return (
            not self.frontmatter_added
            and not self.frontmatter_removed
            and not self.frontmatter_changed
            and not self.tools_added
            and not self.tools_removed
            and not self.sections_added
            and not self.sections_removed
            and not self.sections_changed
        )


# Section keys produced by ``parse_markdown_sections`` that are not actual
# user-facing sections. ``__frontmatter__`` is handled by the frontmatter
# diff; ``__intro__`` is the implicit pre-header content (often empty)
# whose changes are surfaced via the frontmatter or first-real-section
# diff. Excluding them keeps the section diff focused on named headings.
_SECTION_DIFF_EXCLUDE_KEYS: frozenset[str] = frozenset({"__frontmatter__", "__intro__"})


def _normalize_section_body(body: str) -> str:
    """Collapse whitespace inside a section body for comparison.

    Two sections that differ only in trailing whitespace, blank-line
    count, or line-ending style should not be reported as changed. This
    matches the reviewer's intuition: "did anything substantive change
    in this section?" — not "is the byte content identical?".

    Tabs are preserved (they may be load-bearing inside fenced code
    blocks); only runs of spaces and blank lines are collapsed.
    """
    # Strip trailing whitespace per line, then collapse runs of blank
    # lines into a single blank line, then strip leading/trailing
    # whitespace on the whole body.
    lines = [line.rstrip() for line in body.split("\n")]
    collapsed: list[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if prev_blank:
                continue
            prev_blank = True
        else:
            prev_blank = False
        collapsed.append(line)
    return "\n".join(collapsed).strip()


def diff_agents(old_content: str, new_content: str) -> AgentDiff:
    """Compute a comprehensive diff between two agent file contents.

    The diff is symmetric in structure but directional in meaning: every
    "added" / "removed" label is from the perspective of the *new*
    version (added = present in new but not old; removed = present in
    old but not new). This matches how a reviewer reads a PR: "what did
    this change introduce or take away?".

    Three independent diffs are computed and packaged into one
    :class:`AgentDiff`:

    1. **Frontmatter** — every field except ``tools`` is treated as a
       single string value; differences are categorized as added,
       removed, or changed. Quotes are stripped during parsing so
       ``name: "x"`` and ``name: x`` compare equal.
    2. **Tools** — split into a set with :func:`_split_tools` so order
       and whitespace are normalized; reported as alphabetically sorted
       added / removed lists. A tool that exists in both with the same
       name is unchanged (there is no "tool body" to diff).
    3. **Sections** — markdown bodies are parsed by
       :func:`parse_markdown_sections` and compared with whitespace
       normalization. The internal ``__frontmatter__`` and ``__intro__``
       keys are filtered out because they are not user-facing sections.

    Args:
        old_content: The previous agent file content (with frontmatter).
        new_content: The new agent file content (with frontmatter).

    Returns:
        An :class:`AgentDiff` populated with every observed difference.
        Use :meth:`AgentDiff.is_empty` to check for "no changes".
    """
    old_fm = _parse_frontmatter_fields(old_content)
    new_fm = _parse_frontmatter_fields(new_content)

    # Frontmatter diff (excluding tools — handled separately because
    # set-valued comparison gives a more useful signal than string
    # comparison would).
    diff = AgentDiff()
    old_keys = set(old_fm) - {"tools"}
    new_keys = set(new_fm) - {"tools"}
    for key in sorted(new_keys - old_keys):
        diff.frontmatter_added[key] = new_fm[key]
    for key in sorted(old_keys - new_keys):
        diff.frontmatter_removed[key] = old_fm[key]
    for key in sorted(old_keys & new_keys):
        if old_fm[key] != new_fm[key]:
            diff.frontmatter_changed[key] = (old_fm[key], new_fm[key])

    # Tools diff — set-valued. A tool absent from the frontmatter parses
    # as the empty string, which ``_split_tools`` correctly returns as
    # an empty set; that means "agent had no tools field" and "agent
    # had an empty tools field" are treated identically (correct: both
    # mean the agent declared no tools).
    old_tools = _split_tools(old_fm.get("tools", ""))
    new_tools = _split_tools(new_fm.get("tools", ""))
    diff.tools_added = sorted(new_tools - old_tools)
    diff.tools_removed = sorted(old_tools - new_tools)

    # Section diff. parse_markdown_sections returns a dict whose
    # iteration order matches source order in Python 3.7+, so iterating
    # the new sections preserves the order a reviewer reads.
    old_sections = parse_markdown_sections(old_content)
    new_sections = parse_markdown_sections(new_content)
    old_section_keys = [k for k in old_sections if k not in _SECTION_DIFF_EXCLUDE_KEYS]
    new_section_keys = [k for k in new_sections if k not in _SECTION_DIFF_EXCLUDE_KEYS]
    old_section_set = set(old_section_keys)
    new_section_set = set(new_section_keys)

    diff.sections_added = [k for k in new_section_keys if k not in old_section_set]
    diff.sections_removed = [k for k in old_section_keys if k not in new_section_set]
    for key in new_section_keys:
        if key in old_section_set:
            old_body = _normalize_section_body(old_sections[key])
            new_body = _normalize_section_body(new_sections[key])
            if old_body != new_body:
                diff.sections_changed.append(key)

    return diff


# Symbols used in formatted diff output. Centralized so the rendering
# stays consistent across CLI, logs, and any embedding (e.g., changelog
# entries). Mirrors the standard +/-/~ convention used by ``diff`` and
# ``git`` so reviewers don't have to learn a new language.
_DIFF_SYMBOL_ADDED: str = "+"
_DIFF_SYMBOL_REMOVED: str = "-"
_DIFF_SYMBOL_CHANGED: str = "~"


def format_agent_diff(diff: AgentDiff) -> str:
    """Render an :class:`AgentDiff` as a human-readable plain-text report.

    Output structure (sections appear only when non-empty so the report
    stays focused on actual changes):

    ::

        Agent Diff
        ==========

        Frontmatter:
          ~ name: 'old' -> 'new'
          + new_field: 'value'
          - removed_field: 'value'

        Tools:
          + Added: Bash, Edit
          - Removed: WebFetch

        Sections:
          + Added: ## New Section
          - Removed: ## Old Section
          ~ Changed: ## Workflow

    The ``+`` / ``-`` / ``~`` symbols match git's diff convention so
    reviewers can read the output without a key. When the diff is empty
    a single ``"No changes."`` line is returned — non-empty so callers
    that pipe to other tools always see a definite signal.

    Args:
        diff: Result of :func:`diff_agents`.

    Returns:
        Plain-text report. Always has a trailing newline so concatenating
        multiple diffs produces clean blocks.
    """
    if diff.is_empty():
        return "No changes.\n"

    lines: list[str] = ["Agent Diff", "=========="]

    if diff.frontmatter_added or diff.frontmatter_removed or diff.frontmatter_changed:
        lines.append("")
        lines.append("Frontmatter:")
        # Order: changed (most common), added, removed. Within each
        # bucket sort by field name for deterministic output.
        for key in sorted(diff.frontmatter_changed):
            old_val, new_val = diff.frontmatter_changed[key]
            lines.append(f"  {_DIFF_SYMBOL_CHANGED} {key}: '{old_val}' -> '{new_val}'")
        for key in sorted(diff.frontmatter_added):
            lines.append(f"  {_DIFF_SYMBOL_ADDED} {key}: '{diff.frontmatter_added[key]}'")
        for key in sorted(diff.frontmatter_removed):
            lines.append(f"  {_DIFF_SYMBOL_REMOVED} {key}: '{diff.frontmatter_removed[key]}'")

    if diff.tools_added or diff.tools_removed:
        lines.append("")
        lines.append("Tools:")
        if diff.tools_added:
            lines.append(f"  {_DIFF_SYMBOL_ADDED} Added: {', '.join(diff.tools_added)}")
        if diff.tools_removed:
            lines.append(f"  {_DIFF_SYMBOL_REMOVED} Removed: {', '.join(diff.tools_removed)}")

    if diff.sections_added or diff.sections_removed or diff.sections_changed:
        lines.append("")
        lines.append("Sections:")
        for key in diff.sections_added:
            lines.append(f"  {_DIFF_SYMBOL_ADDED} Added: {key}")
        for key in diff.sections_removed:
            lines.append(f"  {_DIFF_SYMBOL_REMOVED} Removed: {key}")
        for key in diff.sections_changed:
            lines.append(f"  {_DIFF_SYMBOL_CHANGED} Changed: {key}")

    lines.append("")
    return "\n".join(lines)


def regenerate_agent(
    agent_path: Path,
    new_content: str,
    changes: list[str] | None = None,
    author: str = "",
    force_bump: VersionBump | None = None,
) -> RegenerationResult:
    """Apply the regeneration workflow to ``agent_path``.

    Steps (atomic on success, rolled back on failure):

    1. If the agent does not yet exist, treat this as first generation —
       write the content and create the initial version history at 1.0.0.
    2. Otherwise, detect breaking changes between the current file and
       ``new_content`` via :func:`detect_breaking_changes`.
    3. Archive the current file into ``.versions/backups/`` so the
       previous version is preserved and rollback is possible.
    4. Decide the bump type. ``force_bump`` wins if set; otherwise MINOR
       when any breaking change is detected and PATCH for a purely
       non-breaking regeneration. **Note:** this matches the feature spec
       (breaking → minor). Strict semver would bump MAJOR for breaking
       changes; callers needing that behavior pass ``force_bump=MAJOR``.
    5. Write ``new_content`` and call :func:`bump_version` to update
       both the frontmatter version and the history log.
    6. Generate a changelog covering the new entry and return it.

    On any failure after archival, the agent file is restored from the
    archive so the caller never observes a half-written regeneration.

    Args:
        agent_path: Path to the agent file being regenerated.
        new_content: The regenerated content (its frontmatter may or may
            not contain a ``version:`` line — the workflow rewrites it).
        changes: Human-readable change descriptions for the changelog.
            Defaults to ``["Regenerated agent"]`` if omitted.
        author: Author name for the version history entry.
        force_bump: Override the automatic bump decision. Useful when
            the caller knows the change warrants MAJOR or when a
            non-breaking cosmetic edit should be PATCH even though the
            detector would otherwise flag it.

    Returns:
        A :class:`RegenerationResult` describing the outcome.
    """
    if not agent_path.exists():
        # First-time generation — no prior version to archive or compare.
        agent_path.parent.mkdir(parents=True, exist_ok=True)
        agent_path.write_text(new_content)
        history = create_initial_version(
            agent_path,
            author=author,
            changes=changes or ["Initial generation"],
        )
        return RegenerationResult(
            success=True,
            old_version="",
            new_version=history.current_version,
            bump_type=VersionBump.PATCH,
            breaking_changes=[],
            changelog=generate_changelog(history),
            archive_path=None,
            history_path=str(get_version_history_path(agent_path)),
        )

    old_content = agent_path.read_text()
    old_version = extract_version_from_frontmatter(old_content) or "1.0.0"

    breaking_signals = detect_breaking_changes(old_content, new_content)

    # Bump selection: explicit > breaking-detected > default patch.
    if force_bump is not None:
        bump_type = force_bump
    elif breaking_signals:
        bump_type = VersionBump.MINOR
    else:
        bump_type = VersionBump.PATCH

    # Archive before any mutation so rollback is always possible.
    archive_path = create_backup(agent_path)
    if archive_path is None:
        return RegenerationResult(
            success=False,
            old_version=old_version,
            new_version=old_version,
            bump_type=bump_type,
            breaking_changes=breaking_signals,
            changelog="",
            archive_path=None,
            history_path="",
            error="Failed to archive previous version before regeneration",
        )

    # Write new content; bump_version will then rewrite the version line.
    agent_path.write_text(new_content)

    change_entries = list(changes) if changes else ["Regenerated agent"]
    breaking_descriptions = [s.description for s in breaking_signals]
    if breaking_descriptions:
        change_entries.extend(f"Breaking: {desc}" for desc in breaking_descriptions)

    success, bump_result = bump_version(
        agent_path,
        bump_type,
        changes=change_entries,
        author=author,
        breaking_changes=breaking_descriptions,
    )

    if not success:
        # bump_version failed — restore from archive so the agent file
        # is back to its previous content; the caller gets a clean failure.
        restore_from_backup(agent_path, archive_path)
        return RegenerationResult(
            success=False,
            old_version=old_version,
            new_version=old_version,
            bump_type=bump_type,
            breaking_changes=breaking_signals,
            changelog="",
            archive_path=str(archive_path),
            history_path="",
            error=bump_result,
        )

    history = load_version_history(agent_path)
    changelog = generate_changelog(history) if history else ""

    return RegenerationResult(
        success=True,
        old_version=old_version,
        new_version=bump_result,
        bump_type=bump_type,
        breaking_changes=breaking_signals,
        changelog=changelog,
        archive_path=str(archive_path),
        history_path=str(get_version_history_path(agent_path)),
    )


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
            entry_ts = (
                target_entry.timestamp[:19].replace("-", "").replace(":", "").replace("T", "_")
            )
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
    bump_parser.add_argument("type", choices=["major", "minor", "patch"], help="Version bump type")
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

    # Diff command — compare two agent files (paths) and print the
    # human-readable diff. Useful for code review and changelog drafting.
    diff_parser = subparsers.add_parser(
        "diff",
        help="Diff two agent versions and print human-readable changes",
    )
    diff_parser.add_argument("old", help="Path to the old agent file")
    diff_parser.add_argument("new", help="Path to the new agent file")

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
            print("\nVersions:")
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

    elif args.command == "diff":
        old_path = Path(args.old)
        new_path = Path(args.new)
        if not old_path.exists():
            print(f"Old agent not found: {old_path}")
            raise SystemExit(1)
        if not new_path.exists():
            print(f"New agent not found: {new_path}")
            raise SystemExit(1)
        diff = diff_agents(old_path.read_text(), new_path.read_text())
        # ``end=""`` because format_agent_diff already terminates with
        # a newline; print() would add a second one, distorting downstream
        # piping (e.g. into changelog generation).
        print(format_agent_diff(diff), end="")

    else:
        parser.print_help()
