#!/usr/bin/env python3
"""
Production-Grade State Persistence for Agent Generation

Enterprise-level state management with:
- Atomic file operations preventing corruption
- File locking for concurrent access safety
- Automatic backup and recovery mechanisms
- Schema versioning with migration support
- Integrity verification via checksums
- Transaction-like commit/rollback semantics
- Garbage collection for old state files
- Session management and history tracking

Architecture:
    .claude/
    ├── state/
    │   ├── current.json         # Current workflow state
    │   ├── current.json.lock    # Lock file for concurrency
    │   ├── current.json.backup  # Automatic backup
    │   └── checksum.sha256      # Integrity verification
    ├── history/
    │   ├── session_YYYYMMDD_HHMMSS.json
    │   └── ...
    ├── agents/
    │   └── generated/           # Generated agent records
    └── config/
        └── generator.json       # Generator configuration

Usage:
    python state_persistence.py init                    # Initialize state directory
    python state_persistence.py save --key value       # Save state
    python state_persistence.py load                    # Load current state
    python state_persistence.py history                 # Show history
    python state_persistence.py gc --keep 10           # Garbage collect old states
    python state_persistence.py verify                  # Verify integrity
    python state_persistence.py recover                 # Recover from backup
"""

from __future__ import annotations

import fcntl
import gzip
import hashlib
import json
import os
import shutil
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Generator, TypeVar

T = TypeVar("T")

# Schema version for migration support
SCHEMA_VERSION = "1.0.0"

# Default directories relative to .claude/
STATE_DIR = "state"
HISTORY_DIR = "history"
AGENTS_DIR = "agents/generated"
CONFIG_DIR = "config"

# File names
CURRENT_STATE_FILE = "current.json"
LOCK_FILE = "current.json.lock"
BACKUP_FILE = "current.json.backup"
CHECKSUM_FILE = "checksum.sha256"
CONFIG_FILE = "generator.json"

# Retention settings
DEFAULT_HISTORY_RETENTION_DAYS = 30
DEFAULT_MAX_HISTORY_FILES = 100


class LockError(Exception):
    """Raised when unable to acquire file lock."""


class IntegrityError(Exception):
    """Raised when state file integrity check fails."""


class MigrationError(Exception):
    """Raised when schema migration fails."""


class StateNotFoundError(Exception):
    """Raised when state file doesn't exist."""


class ConfigCorruptError(Exception):
    """Raised when the generator configuration file exists but is not valid JSON.

    Distinct from a missing file (which ``get_config`` treats as empty config).
    Callers must decide whether to surface the error, recover, or bail out —
    the previous behavior of silently returning ``{}`` on corruption masked
    real configuration drift and let ``set_config`` overwrite the corrupt
    file, destroying whatever intent the user had typed.
    """


class PersistenceMode(Enum):
    """Persistence operation modes."""

    NORMAL = "normal"
    COMPRESSED = "compressed"
    ENCRYPTED = "encrypted"  # Future: encryption support


@dataclass
class StateMetadata:
    """Metadata for persisted state."""

    schema_version: str = SCHEMA_VERSION
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    checksum: str = ""
    mode: str = PersistenceMode.NORMAL.value
    session_id: str = ""
    agent_name: str | None = None


@dataclass
class GenerationRecord:
    """Record of a generated agent."""

    agent_name: str
    description: str
    pattern: str
    tools: list[str]
    generated_at: str
    output_path: str
    success: bool
    quality_score: float | None = None
    validation_errors: list[str] = field(default_factory=list)


# Canonical phases of the agent-generation workflow, in execution order.
# Used by save_checkpoint to validate phase names and by resume_phase to
# decide which phase to run next after a successful checkpoint. Pinned as
# a tuple so callers cannot mutate it; ordering is load-bearing.
CHECKPOINT_PHASES: tuple[str, ...] = (
    "discovery",
    "architecture",
    "generation",
    "validation",
    "installation",
    "learning",
)


@dataclass
class Checkpoint:
    """A successful workflow phase boundary persisted to disk.

    Each checkpoint records the phase that just completed, when it
    completed, and any phase-specific output data the next phase needs
    (e.g. discovery output → architecture input). The list of checkpoints
    on a SessionState is append-only during a normal run; restart wipes
    it via :func:`clear_checkpoints`.
    """

    phase: str
    completed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    phase_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class SessionState:
    """Complete session state for persistence."""

    metadata: StateMetadata
    workflow_phase: str = "idle"
    workflow_data: dict[str, Any] = field(default_factory=dict)
    generation_records: list[GenerationRecord] = field(default_factory=list)
    configuration: dict[str, Any] = field(default_factory=dict)
    error_log: list[dict[str, Any]] = field(default_factory=list)
    checkpoints: list[Checkpoint] = field(default_factory=list)


def save_checkpoint(
    state: SessionState,
    phase: str,
    phase_data: dict[str, Any] | None = None,
) -> Checkpoint:
    """Append a successful-phase checkpoint to ``state.checkpoints``.

    Args:
        state: The session state being mutated. Modified in place.
        phase: One of :data:`CHECKPOINT_PHASES`. Other values raise
            ``ValueError`` rather than silently accepting unknown phases
            (a typo in the phase name would defeat the resume logic).
        phase_data: Phase-specific output to hand to the next phase.
            Stored by value (shallow-copied) so subsequent caller
            mutations don't bleed into the persisted checkpoint.

    Returns:
        The :class:`Checkpoint` just appended.

    Raises:
        ValueError: ``phase`` is not in :data:`CHECKPOINT_PHASES`.
    """
    if phase not in CHECKPOINT_PHASES:
        raise ValueError(
            f"Unknown checkpoint phase '{phase}'. Valid phases: {', '.join(CHECKPOINT_PHASES)}"
        )
    cp = Checkpoint(phase=phase, phase_data=dict(phase_data or {}))
    state.checkpoints.append(cp)
    return cp


def latest_checkpoint(state: SessionState) -> Checkpoint | None:
    """Return the most recently saved checkpoint, or ``None`` if none exist."""
    return state.checkpoints[-1] if state.checkpoints else None


def resume_phase(state: SessionState) -> str | None:
    """Return the next phase to run after the latest checkpoint.

    Returns ``None`` when:

    - No checkpoints exist (start from the first phase via the caller's
      normal entry path)
    - The latest checkpoint is the final phase (workflow complete)

    The function does not mutate ``state``; it just reads
    ``checkpoints`` and computes the next-step phase from
    :data:`CHECKPOINT_PHASES`. This is deliberate — callers may want
    to inspect the next phase before deciding whether to resume or
    restart.
    """
    cp = latest_checkpoint(state)
    if cp is None:
        return None
    try:
        idx = CHECKPOINT_PHASES.index(cp.phase)
    except ValueError:
        # An unknown phase landed in checkpoints somehow — treat as
        # incoherent state and force restart by signalling no resume.
        return None
    next_idx = idx + 1
    if next_idx >= len(CHECKPOINT_PHASES):
        return None
    return CHECKPOINT_PHASES[next_idx]


def clear_checkpoints(state: SessionState) -> None:
    """Wipe all checkpoints (used when the user chooses to restart)."""
    state.checkpoints.clear()


class FileLock:
    """
    Reentrant file locking with timeout support.

    Uses fcntl on Unix systems for advisory locking.
    Supports reentrant acquisition - same thread can acquire multiple times.
    Provides context manager interface for safe lock acquisition/release.
    """

    # Class-level tracking of locks held by current process.
    # Guarded by _class_lock to prevent races between threads.
    _class_lock: threading.Lock = threading.Lock()
    _held_locks: dict[str, int] = {}
    _lock_files: dict[str, Any] = {}

    def __init__(self, lock_path: Path, timeout: float = 10.0):
        self.lock_path = lock_path
        self.lock_key = str(lock_path.resolve())
        self.timeout = timeout

    def acquire(self) -> bool:
        """
        Acquire the file lock with timeout.

        Supports reentrant locking - if this process already holds the lock,
        increments the hold count without blocking.

        Returns:
            True if lock acquired, False if timeout
        """
        with FileLock._class_lock:
            if self.lock_key in FileLock._held_locks:
                FileLock._held_locks[self.lock_key] += 1
                return True

        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        lock_file = open(self.lock_path, "w")

        start_time = time.time()
        while time.time() - start_time < self.timeout:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with FileLock._class_lock:
                    FileLock._held_locks[self.lock_key] = 1
                    FileLock._lock_files[self.lock_key] = lock_file
                # Write PID and timestamp for debugging
                lock_file.write(f"{os.getpid()}\n{datetime.now().isoformat()}")
                lock_file.flush()
                return True
            except (IOError, OSError):
                time.sleep(0.1)

        lock_file.close()
        return False

    def release(self) -> None:
        """
        Release the file lock.

        For reentrant locks, decrements hold count. Only actually releases
        when count reaches zero. Does NOT unlink the lock file — unlinking
        between acquire and release of concurrent processes lets them flock
        different inodes and proceed in parallel (classic TOCTOU race).
        """
        with FileLock._class_lock:
            if self.lock_key not in FileLock._held_locks:
                return

            FileLock._held_locks[self.lock_key] -= 1

            if FileLock._held_locks[self.lock_key] > 0:
                return

            del FileLock._held_locks[self.lock_key]
            lock_file = FileLock._lock_files.pop(self.lock_key, None)

        if lock_file is not None:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
                lock_file.close()
            except (IOError, OSError) as e:
                print(
                    f"warning: failed to release lock {self.lock_path}: {type(e).__name__}: {e}",
                    file=sys.stderr,
                )

    @property
    def is_held(self) -> bool:
        """Check if this lock is currently held by this process."""
        with FileLock._class_lock:
            return self.lock_key in FileLock._held_locks

    @property
    def hold_count(self) -> int:
        """Get current hold count for this lock."""
        with FileLock._class_lock:
            return FileLock._held_locks.get(self.lock_key, 0)

    def __enter__(self) -> FileLock:
        if not self.acquire():
            raise LockError(f"Failed to acquire lock: {self.lock_path}")
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> bool:
        """
        Release lock on context exit.

        Args:
            exc_type: Exception type if an exception occurred
            exc_val: Exception value if an exception occurred
            exc_tb: Exception traceback if an exception occurred

        Returns:
            False to propagate any exceptions
        """
        self.release()

        # Log exception details if one occurred while holding lock
        if exc_type is not None and exc_val is not None:
            # Could add logging here for debugging lock-related issues
            # For now, we just ensure the lock is released
            _ = exc_tb  # Available for stack trace if needed
        return False  # Never suppress exceptions


class StatePersistence:
    """
    Production-grade state persistence manager.

    Provides atomic operations, integrity verification, and recovery
    for agent generation workflow state.
    """

    def __init__(
        self,
        base_dir: Path | str | None = None,
        mode: PersistenceMode = PersistenceMode.NORMAL,
    ):
        """
        Initialize state persistence.

        Args:
            base_dir: Base directory for .claude/ (defaults to cwd)
            mode: Persistence mode (normal, compressed, encrypted)
        """
        if base_dir is None:
            base_dir = Path.cwd()
        self.base_dir = Path(base_dir)
        self.claude_dir = self.base_dir / ".claude"
        self.mode = mode

        # Directory paths
        self.state_dir = self.claude_dir / STATE_DIR
        self.history_dir = self.claude_dir / HISTORY_DIR
        self.agents_dir = self.claude_dir / AGENTS_DIR
        self.config_dir = self.claude_dir / CONFIG_DIR

        # File paths
        self.state_file = self.state_dir / CURRENT_STATE_FILE
        self.lock_file = self.state_dir / LOCK_FILE
        self.backup_file = self.state_dir / BACKUP_FILE
        self.checksum_file = self.state_dir / CHECKSUM_FILE
        self.config_file = self.config_dir / CONFIG_FILE

        # Session ID for this instance
        self._session_id = (
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.getpid()}_{os.urandom(4).hex()}"
        )

    def initialize(self) -> bool:
        """
        Initialize the state directory structure.

        Creates all necessary directories and initial state if not exists.

        Returns:
            True if initialized successfully
        """
        try:
            # Create directory structure
            for directory in [
                self.state_dir,
                self.history_dir,
                self.agents_dir,
                self.config_dir,
            ]:
                directory.mkdir(parents=True, exist_ok=True)

            # Create initial state if not exists
            if not self.state_file.exists():
                initial_state = SessionState(metadata=StateMetadata(session_id=self._session_id))
                self._write_state(initial_state)

            # Create default config if not exists
            if not self.config_file.exists():
                default_config = {
                    "schema_version": SCHEMA_VERSION,
                    "history_retention_days": DEFAULT_HISTORY_RETENTION_DAYS,
                    "max_history_files": DEFAULT_MAX_HISTORY_FILES,
                    "compression_enabled": False,
                    "auto_backup": True,
                    "integrity_check": True,
                }
                self.config_file.write_text(
                    json.dumps(default_config, indent=2),
                    encoding="utf-8",
                )

            return True
        except OSError as e:
            self._log_error("initialization", str(e))
            return False

    @contextmanager
    def transaction(self) -> Generator[SessionState, None, None]:
        """
        Context manager for transactional state modifications.

        Provides commit/rollback semantics. If an exception occurs,
        the state is rolled back to its previous value.

        Yields:
            Current SessionState for modification

        Example:
            with persistence.transaction() as state:
                state.workflow_phase = "generation"
                # If exception here, state is rolled back
        """
        with FileLock(self.lock_file):
            # Load current state
            current_state = self.load()
            if current_state is None:
                current_state = SessionState(metadata=StateMetadata(session_id=self._session_id))

            # Create backup before modification
            backup_data = self._serialize_state(current_state)

            try:
                yield current_state
                # Commit: save the modified state
                self._write_state(current_state)
            except Exception:
                # Rollback: restore from backup
                self._write_raw(backup_data)
                raise

    def load(self) -> SessionState | None:
        """
        Load current state with integrity verification.

        Returns:
            SessionState if exists and valid, None otherwise
        """
        if not self.state_file.exists():
            return None

        try:
            with FileLock(self.lock_file):
                # Verify integrity if checksum exists
                if self.checksum_file.exists():
                    if not self._verify_integrity():
                        # Try to recover from backup
                        if self._recover_from_backup():
                            return self.load()
                        raise IntegrityError("State file corrupted and recovery failed")

                # Load state
                content = self._read_raw()
                return self._deserialize_state(content)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            self._log_error("load", str(e))
            return None

    def save(self, state: SessionState) -> bool:
        """
        Save state with atomic write and integrity protection.

        Args:
            state: SessionState to persist

        Returns:
            True if saved successfully
        """
        try:
            with FileLock(self.lock_file):
                self._write_state(state)
            return True
        except (OSError, LockError) as e:
            self._log_error("save", str(e))
            return False

    def update(self, **kwargs: Any) -> tuple[bool, str | None]:
        """
        Update specific fields in the current state.

        Args:
            **kwargs: Fields to update

        Returns:
            ``(True, None)`` on success, ``(False, error_msg)`` when an
            environmental failure (OSError, json.JSONDecodeError, ValueError,
            IntegrityError) was caught. Programmer errors (AttributeError,
            TypeError, KeyError, etc.) propagate unchanged so bugs are not
            silently swallowed as they were by the previous ``except
            Exception`` wrapper.
        """
        try:
            with self.transaction() as state:
                for key, value in kwargs.items():
                    if hasattr(state, key):
                        setattr(state, key, value)
                    elif hasattr(state.metadata, key):
                        setattr(state.metadata, key, value)
                    else:
                        state.workflow_data[key] = value
                state.metadata.updated_at = datetime.now().isoformat()
            return True, None
        # json.JSONDecodeError is a ValueError subclass; both listed for clarity.
        except (OSError, json.JSONDecodeError, ValueError, IntegrityError) as e:
            self._log_error("update", str(e))
            return False, str(e)

    def add_generation_record(self, record: GenerationRecord) -> tuple[bool, str | None]:
        """
        Add a generation record to the state.

        Args:
            record: GenerationRecord to add

        Returns:
            ``(True, None)`` on success, ``(False, error_msg)`` when an
            environmental failure was caught. Programmer errors propagate.
        """
        try:
            with self.transaction() as state:
                state.generation_records.append(record)
                state.metadata.updated_at = datetime.now().isoformat()

            # Also save to history
            self._save_to_history(record)
            return True, None
        # json.JSONDecodeError is a ValueError subclass; both listed for clarity.
        except (OSError, json.JSONDecodeError, ValueError, IntegrityError) as e:
            self._log_error("add_generation_record", str(e))
            return False, str(e)

    def get_generation_history(
        self,
        limit: int = 50,
        agent_name: str | None = None,
    ) -> list[GenerationRecord]:
        """
        Get generation history, optionally filtered by agent name.

        Args:
            limit: Maximum number of records to return
            agent_name: Filter by agent name

        Returns:
            List of GenerationRecord
        """
        records: list[GenerationRecord] = []

        # Load from current state
        state = self.load()
        if state:
            records.extend(state.generation_records)

        # Load from history files
        history_files = sorted(
            self.history_dir.glob("session_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        for history_file in history_files[:limit]:
            try:
                data = json.loads(history_file.read_text(encoding="utf-8"))
                if "generation_records" in data:
                    for rec_data in data["generation_records"]:
                        records.append(self._dict_to_record(rec_data))
            except (json.JSONDecodeError, OSError):
                continue

        # Filter by agent name
        if agent_name:
            records = [r for r in records if r.agent_name == agent_name]

        # Sort by timestamp and limit
        records.sort(key=lambda r: r.generated_at, reverse=True)
        return records[:limit]

    def archive_session(self) -> str | None:
        """
        Archive current session to history.

        Returns:
            Archive file path if successful, None otherwise
        """
        state = self.load()
        if state is None:
            return None

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            archive_path = self.history_dir / f"session_{timestamp}.json"

            content = self._serialize_state(state)
            if self.mode == PersistenceMode.COMPRESSED:
                archive_path = archive_path.with_suffix(".json.gz")
                with gzip.open(archive_path, "wt", encoding="utf-8") as f:
                    f.write(content)
            else:
                archive_path.write_text(content, encoding="utf-8")

            return str(archive_path)
        except OSError as e:
            self._log_error("archive_session", str(e))
            return None

    def garbage_collect(
        self,
        keep_count: int = DEFAULT_MAX_HISTORY_FILES,
        max_age_days: int = DEFAULT_HISTORY_RETENTION_DAYS,
    ) -> int:
        """
        Clean up old history files.

        Args:
            keep_count: Minimum number of files to keep
            max_age_days: Maximum age in days for files

        Returns:
            Number of files deleted
        """
        deleted = 0
        cutoff_date = datetime.now() - timedelta(days=max_age_days)

        history_files = sorted(
            self.history_dir.glob("session_*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        for i, history_file in enumerate(history_files):
            # Always keep minimum count
            if i < keep_count:
                continue

            # Delete if older than max age
            mtime = datetime.fromtimestamp(history_file.stat().st_mtime)
            if mtime < cutoff_date:
                try:
                    history_file.unlink()
                    deleted += 1
                except OSError:
                    pass

        return deleted

    def verify_integrity(self) -> tuple[bool, str]:
        """
        Verify state file integrity.

        Returns:
            (is_valid, message)
        """
        if not self.state_file.exists():
            return False, "State file does not exist"

        if not self.checksum_file.exists():
            return True, "No checksum file (integrity check skipped)"

        try:
            stored_checksum = self.checksum_file.read_text(encoding="utf-8").strip()
            actual_checksum = self._compute_checksum(self.state_file)

            if stored_checksum == actual_checksum:
                return True, "Integrity verified"
            else:
                return (
                    False,
                    f"Checksum mismatch: expected {stored_checksum[:16]}..., got {actual_checksum[:16]}...",
                )
        except OSError as e:
            return False, f"Error verifying integrity: {e}"

    def recover(self) -> bool:
        """
        Attempt to recover state from backup.

        Returns:
            True if recovered successfully
        """
        return self._recover_from_backup()

    def reset(self) -> tuple[bool, str | None]:
        """
        Reset state to initial values.

        Returns:
            ``(True, None)`` on success, ``(False, error_msg)`` when an
            environmental failure was caught. Programmer errors propagate.
        """
        try:
            # Archive current state first
            self.archive_session()

            # Create fresh state
            initial_state = SessionState(metadata=StateMetadata(session_id=self._session_id))
            if self.save(initial_state):
                return True, None
            # save() already surfaced the real cause via _log_error — the error
            # log has the OSError/LockError detail the CLI caller cannot see.
            return False, "save returned False after reset (see error log for details)"
        # json.JSONDecodeError is a ValueError subclass; both listed for clarity.
        except (OSError, json.JSONDecodeError, ValueError, IntegrityError) as e:
            self._log_error("reset", str(e))
            return False, str(e)

    def get_config(self) -> dict[str, Any]:
        """Get generator configuration.

        Returns an empty dict when the config file does not exist. Raises
        :class:`ConfigCorruptError` when the file exists but contains invalid
        JSON — callers must decide how to handle corruption rather than
        receiving a silent empty-dict fallback that masks the damage.

        Raises:
            ConfigCorruptError: when the config file is present but malformed.
            OSError: when the file exists but cannot be read (permissions,
                I/O failure, etc.). Reading a configuration the user owns is
                best surfaced to the caller rather than silently swallowed.
        """
        if not self.config_file.exists():
            return {}
        raw = self.config_file.read_text(encoding="utf-8")
        try:
            loaded = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ConfigCorruptError(
                f"config file {self.config_file} is not valid JSON: {e}"
            ) from e
        if not isinstance(loaded, dict):
            raise ConfigCorruptError(
                f"config file {self.config_file} must be a JSON object, got {type(loaded).__name__}"
            )
        return loaded

    def set_config(self, **kwargs: Any) -> bool:
        """Update generator configuration.

        Refuses to overwrite a corrupt config file — ``get_config`` will
        raise :class:`ConfigCorruptError` before any write occurs, preventing
        the previous silent-overwrite pattern from destroying the user's
        original configuration on top of whatever damaged it.

        Returns:
            True on successful write. False on filesystem error (OSError).

        Raises:
            ConfigCorruptError: when the existing config file is corrupt.
                The write is refused so the operator can inspect the
                original file before it is overwritten.
        """
        # get_config raises ConfigCorruptError on malformed JSON; propagate.
        config = self.get_config()
        config.update(kwargs)
        try:
            self.config_file.write_text(
                json.dumps(config, indent=2),
                encoding="utf-8",
            )
            return True
        except OSError:
            return False

    # Private methods

    def _write_state(self, state: SessionState) -> None:
        """Write state with atomic operation and backup."""
        # Update metadata
        state.metadata.updated_at = datetime.now().isoformat()
        state.metadata.session_id = self._session_id

        # Serialize
        content = self._serialize_state(state)

        # Create backup of current state
        if self.state_file.exists():
            shutil.copy2(self.state_file, self.backup_file)

        # Atomic write using temp file
        self._write_raw(content)

        # Update checksum
        checksum = self._compute_checksum(self.state_file)
        self.checksum_file.write_text(checksum, encoding="utf-8")

    def _write_raw(self, content: str) -> None:
        """Atomic write using temp file."""
        self.state_dir.mkdir(parents=True, exist_ok=True)

        # Write to temp file first
        fd, temp_path = tempfile.mkstemp(
            dir=self.state_dir,
            prefix=".state_",
            suffix=".tmp",
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())

            # Atomic rename
            os.replace(temp_path, self.state_file)
        except Exception:
            # Clean up temp file on error
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            raise

    def _read_raw(self) -> str:
        """Read state file content."""
        return self.state_file.read_text(encoding="utf-8")

    def _serialize_state(self, state: SessionState) -> str:
        """Serialize state to JSON string."""
        data = {
            "schema_version": SCHEMA_VERSION,
            "metadata": {
                "schema_version": state.metadata.schema_version,
                "created_at": state.metadata.created_at,
                "updated_at": state.metadata.updated_at,
                "checksum": state.metadata.checksum,
                "mode": state.metadata.mode,
                "session_id": state.metadata.session_id,
                "agent_name": state.metadata.agent_name,
            },
            "workflow_phase": state.workflow_phase,
            "workflow_data": state.workflow_data,
            "generation_records": [self._record_to_dict(r) for r in state.generation_records],
            "configuration": state.configuration,
            "error_log": state.error_log,
            "checkpoints": [
                {
                    "phase": cp.phase,
                    "completed_at": cp.completed_at,
                    "phase_data": cp.phase_data,
                }
                for cp in state.checkpoints
            ],
        }
        return json.dumps(data, indent=2, sort_keys=True)

    def _deserialize_state(self, content: str) -> SessionState:
        """Deserialize JSON string to state."""
        data = json.loads(content)

        # Check schema version for migrations
        file_version = data.get("schema_version", "1.0.0")
        if file_version != SCHEMA_VERSION:
            data = self._migrate_schema(data, file_version, SCHEMA_VERSION)

        metadata = StateMetadata(
            schema_version=data["metadata"]["schema_version"],
            created_at=data["metadata"]["created_at"],
            updated_at=data["metadata"]["updated_at"],
            checksum=data["metadata"].get("checksum", ""),
            mode=data["metadata"].get("mode", PersistenceMode.NORMAL.value),
            session_id=data["metadata"].get("session_id", ""),
            agent_name=data["metadata"].get("agent_name"),
        )

        records = [self._dict_to_record(r) for r in data.get("generation_records", [])]

        checkpoints = [
            Checkpoint(
                phase=cp["phase"],
                completed_at=cp.get("completed_at", datetime.now().isoformat()),
                phase_data=cp.get("phase_data", {}),
            )
            for cp in data.get("checkpoints", [])
        ]

        return SessionState(
            metadata=metadata,
            workflow_phase=data.get("workflow_phase", "idle"),
            workflow_data=data.get("workflow_data", {}),
            generation_records=records,
            configuration=data.get("configuration", {}),
            error_log=data.get("error_log", []),
            checkpoints=checkpoints,
        )

    def _record_to_dict(self, record: GenerationRecord) -> dict[str, Any]:
        """Convert GenerationRecord to dict."""
        return {
            "agent_name": record.agent_name,
            "description": record.description,
            "pattern": record.pattern,
            "tools": record.tools,
            "generated_at": record.generated_at,
            "output_path": record.output_path,
            "success": record.success,
            "quality_score": record.quality_score,
            "validation_errors": record.validation_errors,
        }

    def _dict_to_record(self, data: dict[str, Any]) -> GenerationRecord:
        """Convert dict to GenerationRecord."""
        return GenerationRecord(
            agent_name=data["agent_name"],
            description=data.get("description", ""),
            pattern=data.get("pattern", ""),
            tools=data.get("tools", []),
            generated_at=data.get("generated_at", ""),
            output_path=data.get("output_path", ""),
            success=data.get("success", False),
            quality_score=data.get("quality_score"),
            validation_errors=data.get("validation_errors", []),
        )

    def _compute_checksum(self, file_path: Path) -> str:
        """Compute SHA-256 checksum of file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _verify_integrity(self) -> bool:
        """Verify state file checksum."""
        if not self.checksum_file.exists():
            return True

        stored = self.checksum_file.read_text(encoding="utf-8").strip()
        actual = self._compute_checksum(self.state_file)
        return stored == actual

    def _recover_from_backup(self) -> bool:
        """Recover state from backup file."""
        if not self.backup_file.exists():
            return False

        try:
            shutil.copy2(self.backup_file, self.state_file)
            # Update checksum
            checksum = self._compute_checksum(self.state_file)
            self.checksum_file.write_text(checksum, encoding="utf-8")
            return True
        except OSError:
            return False

    def _save_to_history(self, record: GenerationRecord) -> None:
        """Save individual record to history."""
        history_file = self.agents_dir / f"{record.agent_name}.json"

        try:
            if history_file.exists():
                data = json.loads(history_file.read_text(encoding="utf-8"))
                records = data.get("records", [])
            else:
                records = []

            records.append(self._record_to_dict(record))

            # Keep last 100 records per agent
            records = records[-100:]

            history_file.parent.mkdir(parents=True, exist_ok=True)
            history_file.write_text(
                json.dumps({"records": records}, indent=2),
                encoding="utf-8",
            )
        except (json.JSONDecodeError, OSError) as e:
            # History is best-effort — the state mutation in
            # add_generation_record has already committed by the time we
            # get here. But silently dropping the per-agent record meant
            # operators lost diagnostic history with zero indication.
            # Surface the path and error class so the failure is visible
            # without changing the swallow-and-continue contract.
            print(
                f"warning: state_persistence failed to write history file "
                f"{history_file}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )

    def _migrate_schema(
        self,
        data: dict[str, Any],
        from_version: str,
        to_version: str,
    ) -> dict[str, Any]:
        """Migrate state data between schema versions.

        ``from_version`` is currently informational — there is only one
        live schema version — but it's recorded into the migrated payload
        so future migrations can branch on the source version without
        having to reverse-engineer it from the data.
        """
        if from_version == to_version:
            return data
        data["schema_version"] = to_version
        data["_migrated_from"] = from_version
        return data

    def _log_error(self, operation: str, message: str) -> None:
        """Log error to state error log.

        Swallows only environmental failures — programmer errors still
        propagate so the original caller sees them. The error-logging
        path itself must never mask bugs.
        """
        try:
            state = self.load()
            if state:
                state.error_log.append(
                    {
                        "timestamp": datetime.now().isoformat(),
                        "operation": operation,
                        "message": message,
                    }
                )
                # Keep last 100 errors
                state.error_log = state.error_log[-100:]
                self._write_state(state)
        # json.JSONDecodeError is a ValueError subclass; both listed for clarity.
        except (OSError, json.JSONDecodeError, ValueError, IntegrityError):
            pass  # Don't fail on environmental error-logging issues


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Production-grade state persistence for agent generation"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Init command
    subparsers.add_parser("init", help="Initialize state directory")

    # Save command
    save_parser = subparsers.add_parser("save", help="Save state")
    save_parser.add_argument("--phase", help="Workflow phase")
    save_parser.add_argument("--agent", help="Agent name")
    save_parser.add_argument("--data", help="JSON data to save")

    # Load command
    load_parser = subparsers.add_parser("load", help="Load current state")
    load_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # History command
    history_parser = subparsers.add_parser("history", help="Show generation history")
    history_parser.add_argument("--limit", type=int, default=10, help="Number of records")
    history_parser.add_argument("--agent", help="Filter by agent name")
    history_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # GC command
    gc_parser = subparsers.add_parser("gc", help="Garbage collect old states")
    gc_parser.add_argument("--keep", type=int, default=100, help="Files to keep")
    gc_parser.add_argument("--max-age", type=int, default=30, help="Max age in days")

    # Verify command
    subparsers.add_parser("verify", help="Verify state integrity")

    # Recover command
    subparsers.add_parser("recover", help="Recover from backup")

    # Reset command
    subparsers.add_parser("reset", help="Reset state")

    # Archive command
    subparsers.add_parser("archive", help="Archive current session")

    # Config command
    config_parser = subparsers.add_parser("config", help="Manage configuration")
    config_parser.add_argument("--get", help="Get config value")
    config_parser.add_argument("--set", nargs=2, metavar=("KEY", "VALUE"), help="Set config value")
    config_parser.add_argument("--list", action="store_true", help="List all config")

    args = parser.parse_args()
    persistence = StatePersistence()

    if args.command == "init":
        if persistence.initialize():
            print(f"Initialized state directory at {persistence.claude_dir}")
        else:
            print("Failed to initialize state directory", file=sys.stderr)
            sys.exit(1)

    elif args.command == "save":
        updates: dict[str, Any] = {}
        if args.phase:
            updates["workflow_phase"] = args.phase
        if args.agent:
            updates["agent_name"] = args.agent
        if args.data:
            updates["workflow_data"] = json.loads(args.data)

        ok, err = persistence.update(**updates)
        if ok:
            print("State saved successfully")
        else:
            print(f"Failed to save state: {err}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "load":
        state = persistence.load()
        if state is None:
            print("No state found (run 'init' first)", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(persistence._serialize_state(state))
        else:
            print("\nCurrent State")
            print("=" * 40)
            print(f"Session:  {state.metadata.session_id}")
            print(f"Phase:    {state.workflow_phase}")
            print(f"Agent:    {state.metadata.agent_name or 'N/A'}")
            print(f"Updated:  {state.metadata.updated_at}")
            print(f"Records:  {len(state.generation_records)}")
            print()

    elif args.command == "history":
        records = persistence.get_generation_history(
            limit=args.limit,
            agent_name=args.agent,
        )

        if args.json:
            print(
                json.dumps(
                    [persistence._record_to_dict(r) for r in records],
                    indent=2,
                )
            )
        else:
            print(f"\nGeneration History ({len(records)} records)")
            print("-" * 60)
            for record in records:
                status = "✓" if record.success else "✗"
                score = f" [{record.quality_score:.1f}]" if record.quality_score else ""
                print(f"  {status} {record.agent_name}{score}")
                print(f"    {record.generated_at} | {record.pattern}")
            print()

    elif args.command == "gc":
        deleted = persistence.garbage_collect(
            keep_count=args.keep,
            max_age_days=args.max_age,
        )
        print(f"Deleted {deleted} old history files")

    elif args.command == "verify":
        valid, message = persistence.verify_integrity()
        if valid:
            print(f"✓ {message}")
        else:
            print(f"✗ {message}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "recover":
        if persistence.recover():
            print("State recovered from backup")
        else:
            print("No backup available or recovery failed", file=sys.stderr)
            sys.exit(1)

    elif args.command == "reset":
        ok, err = persistence.reset()
        if ok:
            print("State reset successfully")
        else:
            print(f"Failed to reset state: {err}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "archive":
        path = persistence.archive_session()
        if path:
            print(f"Session archived to: {path}")
        else:
            print("Failed to archive session", file=sys.stderr)
            sys.exit(1)

    elif args.command == "config":
        # Catch ConfigCorruptError for the whole subcommand so the CLI exits
        # cleanly with exit code 1 and a readable message instead of dumping
        # a Python traceback for the very scenario this feature protects.
        try:
            if args.list:
                config = persistence.get_config()
                print(json.dumps(config, indent=2))
            elif args.get:
                config = persistence.get_config()
                value = config.get(args.get)
                if value is not None:
                    print(value)
                else:
                    print(f"Config key '{args.get}' not found", file=sys.stderr)
                    sys.exit(1)
            elif args.set:
                key, value = args.set
                # Try to parse as JSON, fall back to string. Surface the
                # fallback on stderr so the operator can tell which branch
                # ran — ``--set port 8080`` stores int 8080, but
                # ``--set port eight-thousand`` silently stores a string,
                # and the difference changes how downstream consumers read
                # the config. The notice makes the coercion observable.
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    print(
                        f"notice: value for '{key}' is not valid JSON; storing as string",
                        file=sys.stderr,
                    )
                if persistence.set_config(**{key: value}):
                    print(f"Set {key} = {value}")
                else:
                    print("Failed to set config", file=sys.stderr)
                    sys.exit(1)
            else:
                print(json.dumps(persistence.get_config(), indent=2))
        except ConfigCorruptError as e:
            print(f"Config file is corrupt: {e}", file=sys.stderr)
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
