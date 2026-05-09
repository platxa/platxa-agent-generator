"""Atomic on-disk store for learned instincts.

Owns the layout under ``~/.claude/instincts/``:

* ``index.json``                            — JSON-backed metadata index
* ``index.json.lock``                       — permanent fcntl lock file
* ``{scope}/{type}/{name}.md``              — one rendered instinct per file
  where ``scope`` is ``global`` or a ``project_id``, ``type`` is the instinct
  type, and ``name`` is the unique instinct name.

Two layers of mutual exclusion gate every write:

1. A process-local :class:`threading.Lock` keyed by the resolved store
   ``root``. Required because ``fcntl.flock`` is process-level — two
   threads in the same process holding flock on the same FD do not
   block each other, so threads alone need a Python-level lock.
2. A direct :func:`fcntl.flock` exclusive lock on a permanent lock file
   (``index.json.lock``). The file is created once with ``O_RDWR | O_CREAT``
   and is never unlinked, which is critical: unlinking the lock file
   between acquire and release of two concurrent processes would let
   them flock different inodes and proceed in parallel (the classic
   lock-file TOCTOU race).

Both must be held during a put/delete: the threading lock first (cheap,
intra-process), then the file lock (kernel-level, cross-process).

Markdown content is treated as opaque bytes by this module — schema
validation of frontmatter (``name`` ≤ 64, ``description`` ≤ 512,
``confidence`` ∈ [0, 1], type enum) is owned by the syntax_validator
extension (feature #8). The store only enforces:

* ``name``, ``scope``, and ``type_`` are non-empty strings
* ``content`` is a ``str``
* on-disk SHA-256 matches the index entry's recorded checksum

The module-level :func:`resolve_instinct_scope` helper returns the
absolute filesystem path for an instinct given its ``name``, ``type_``,
and optional ``project_id`` (``None`` ⇒ shared global scope). The
:class:`InstinctStore` class still derives its own paths internally via
:meth:`InstinctStore._relative_path`; the helper is for callers that
need to address an instinct file without instantiating a store.
"""

from __future__ import annotations

import contextlib
import fcntl
import hashlib
import json
import os
import re
import tempfile
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Generator, Iterator

from .shared.paths import get_user_agents_dir

INDEX_FILENAME: str = "index.json"
INDEX_LOCK_FILENAME: str = "index.json.lock"
INDEX_SCHEMA_VERSION: int = 1

# Regex for safe path components — disallow path separators, NUL, and
# leading dots (which would create hidden files or escape the store root).
_SAFE_COMPONENT_RE = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*$")


class InstinctValidationError(ValueError):
    """Raised when an instinct argument violates a hard invariant."""


class InstinctChecksumMismatch(RuntimeError):
    """Raised when on-disk checksum disagrees with the index record."""


# Per-root threading locks. Keyed by ``str(root.resolve())`` so two
# ``InstinctStore`` instances pointing at the same directory share a
# lock. A module-level mutex guards the dict itself.
_thread_locks: dict[str, threading.Lock] = {}
_thread_locks_guard = threading.Lock()


def _get_thread_lock(root: Path) -> threading.Lock:
    """Return the process-local threading lock for ``root``."""
    key = str(root.resolve())
    with _thread_locks_guard:
        lock = _thread_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _thread_locks[key] = lock
        return lock


def _default_instincts_root() -> Path:
    """Resolve ``~/.claude/instincts/`` from the user agents dir parent."""
    return get_user_agents_dir().parent / "instincts"


GLOBAL_SCOPE: str = "global"


def resolve_instinct_scope(
    *,
    name: str,
    type_: str,
    project_id: str | None = None,
    root: Path | None = None,
) -> Path:
    """Return the absolute filesystem path for an instinct.

    Layout:

    * ``project_id is None`` ⇒ ``{root}/global/{type_}/{name}.md``
      (shared across projects)
    * ``project_id`` is a string ⇒ ``{root}/{project_id}/{type_}/{name}.md``
      (one tree per project; same ``name`` under two distinct
      ``project_id`` values resolves to distinct paths)

    ``root`` defaults to ``~/.claude/instincts/`` (resolved via
    :func:`_default_instincts_root`) so ``Path``-only callers can address
    an instinct file without instantiating an :class:`InstinctStore`.

    All components are validated with the same component regex used by
    the store, and ``project_id`` may not be the literal string
    ``"global"`` — that token is reserved for the shared scope so that
    a malicious or accidental ``project_id="global"`` cannot collide
    with global instincts on disk.
    """
    _validate_component(name, label="name")
    _validate_component(type_, label="type")
    if project_id is None:
        scope = GLOBAL_SCOPE
    else:
        _validate_component(project_id, label="project_id")
        if project_id == GLOBAL_SCOPE:
            raise InstinctValidationError(
                f"project_id may not be the reserved scope name "
                f"{GLOBAL_SCOPE!r}; use project_id=None for the global scope"
            )
        scope = project_id
    base = root if root is not None else _default_instincts_root()
    return base / scope / type_ / f"{name}.md"


@contextlib.contextmanager
def _index_flock(lock_path: Path) -> Generator[None, None, None]:
    """Acquire an exclusive ``fcntl.flock`` on a permanent lock file.

    The lock file is created with ``O_RDWR | O_CREAT`` (never truncated,
    never unlinked) so concurrent processes always flock the same inode.
    Truncating or unlinking the lock file between acquire and release
    introduces a TOCTOU race: two processes can end up holding flock on
    distinct inodes and run their critical sections in parallel.

    The call to :func:`fcntl.flock` blocks until the lock is granted —
    callers that want a timeout should wrap this in their own poll loop.
    """
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


def _validate_component(value: str, *, label: str) -> None:
    """Reject empty or path-traversal-prone component strings."""
    if not isinstance(value, str) or not value.strip():
        raise InstinctValidationError(f"{label} must be a non-empty string")
    if not _SAFE_COMPONENT_RE.match(value):
        raise InstinctValidationError(
            f"{label} {value!r} must match {_SAFE_COMPONENT_RE.pattern} "
            "(no path separators, no leading dot)"
        )


def _sha256_hex(data: bytes) -> str:
    """Return the SHA-256 hex digest of ``data``."""
    return hashlib.sha256(data).hexdigest()


@dataclass
class InstinctEntry:
    """One row of the index, mirroring an on-disk markdown file.

    Fields are deliberately flat-strings-and-ints so the JSON index
    round-trips through ``json.dump``/``json.load`` with no custom
    encoder and so future readers built against an older schema do not
    have to know about nested objects.
    """

    name: str
    scope: str
    type: str
    path: str  # POSIX-style relative path under the store root
    checksum: str
    size: int
    created: str = ""
    last_seen: str = ""

    def __post_init__(self) -> None:
        _validate_component(self.name, label="name")
        _validate_component(self.scope, label="scope")
        _validate_component(self.type, label="type")
        if not isinstance(self.path, str) or not self.path.strip():
            raise InstinctValidationError("path must be a non-empty string")
        if not isinstance(self.checksum, str) or len(self.checksum) != 64:
            raise InstinctValidationError("checksum must be a 64-char SHA-256 hex digest")
        if not isinstance(self.size, int) or self.size < 0:
            raise InstinctValidationError("size must be a non-negative int")


@dataclass
class _Index:
    """In-memory shape of ``index.json``."""

    schema_version: int = INDEX_SCHEMA_VERSION
    instincts: dict[str, InstinctEntry] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "schema_version": self.schema_version,
            "instincts": {name: asdict(entry) for name, entry in self.instincts.items()},
        }

    @classmethod
    def from_dict(cls, data: dict) -> _Index:
        version = data.get("schema_version", INDEX_SCHEMA_VERSION)
        raw = data.get("instincts", {})
        if not isinstance(raw, dict):
            raise InstinctValidationError("index 'instincts' must be a dict")
        entries: dict[str, InstinctEntry] = {}
        for name, payload in raw.items():
            if not isinstance(payload, dict):
                continue
            try:
                entry = InstinctEntry(
                    **{
                        k: v
                        for k, v in payload.items()
                        if k
                        in {
                            "name",
                            "scope",
                            "type",
                            "path",
                            "checksum",
                            "size",
                            "created",
                            "last_seen",
                        }
                    }
                )
            except (TypeError, InstinctValidationError):
                continue
            if entry.name == name:
                entries[name] = entry
        return cls(schema_version=int(version), instincts=entries)


class InstinctStore:
    """Atomic JSON-index + per-instinct markdown files.

    Reads (``get``, ``get_entry``, ``list_entries``, ``checksum``,
    ``index_checksum``, ``verify``) are lock-free — they observe a
    snapshot consistent with the last completed write. Writes (``put``,
    ``delete``) acquire both the per-root threading lock and the direct
    ``fcntl.flock`` on ``index.json.lock`` for the duration of the
    index update, then atomically swap files via :func:`os.replace`.

    The 10-thread / multi-process concurrent-write contract is verified
    by ``tests/test_instinct_store.py``.
    """

    def __init__(self, root: Path | None = None) -> None:
        self.root: Path = root if root is not None else _default_instincts_root()
        self.index_path: Path = self.root / INDEX_FILENAME
        self.lock_path: Path = self.root / INDEX_LOCK_FILENAME

    # --- Path helpers -----------------------------------------------------

    def _relative_path(self, *, scope: str, type_: str, name: str) -> str:
        """Return ``{scope}/{type_}/{name}.md`` as a POSIX-style string."""
        _validate_component(scope, label="scope")
        _validate_component(type_, label="type")
        _validate_component(name, label="name")
        return f"{scope}/{type_}/{name}.md"

    def _absolute_path(self, relative: str) -> Path:
        """Resolve a relative store path to an absolute filesystem path."""
        return self.root / relative

    # --- Index I/O --------------------------------------------------------

    def _read_index(self) -> _Index:
        """Load the index from disk. Missing/corrupt → empty index."""
        if not self.index_path.exists():
            return _Index()
        try:
            raw = self.index_path.read_text(encoding="utf-8")
            data = json.loads(raw)
        except (OSError, json.JSONDecodeError):
            return _Index()
        if not isinstance(data, dict):
            return _Index()
        try:
            return _Index.from_dict(data)
        except InstinctValidationError:
            return _Index()

    def _write_index_atomic(self, index: _Index) -> None:
        """Write index via ``tempfile + os.replace`` for atomicity."""
        self.root.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            index.to_dict(),
            ensure_ascii=True,
            indent=2,
            sort_keys=True,
        )
        # NamedTemporaryFile in the same directory so os.replace stays
        # atomic across the same filesystem.
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=self.root,
            prefix=".index-",
            suffix=".tmp",
            delete=False,
        ) as fh:
            tmp_path = Path(fh.name)
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, self.index_path)

    def _write_file_atomic(self, target: Path, content: str) -> int:
        """Write ``content`` to ``target`` atomically; return byte length."""
        target.parent.mkdir(parents=True, exist_ok=True)
        encoded = content.encode("utf-8")
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=target.parent,
            prefix=".instinct-",
            suffix=".tmp",
            delete=False,
        ) as fh:
            tmp_path = Path(fh.name)
            fh.write(encoded)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, target)
        return len(encoded)

    # --- Public write API -------------------------------------------------

    def put(
        self,
        *,
        name: str,
        scope: str,
        type_: str,
        content: str,
        created: str = "",
        last_seen: str = "",
    ) -> InstinctEntry:
        """Write an instinct file and update the index atomically.

        Returns the resulting :class:`InstinctEntry`. Existing entries
        with the same ``name`` are overwritten (the index is the unique
        key — collisions across scopes are caller-disallowed).
        """
        relative = self._relative_path(scope=scope, type_=type_, name=name)
        target = self._absolute_path(relative)

        encoded = content.encode("utf-8")
        checksum = _sha256_hex(encoded)

        thread_lock = _get_thread_lock(self.root)
        result: InstinctEntry
        with thread_lock:
            with _index_flock(self.lock_path):
                size = self._write_file_atomic(target, content)
                index = self._read_index()
                result = InstinctEntry(
                    name=name,
                    scope=scope,
                    type=type_,
                    path=relative,
                    checksum=checksum,
                    size=size,
                    created=created,
                    last_seen=last_seen,
                )
                index.instincts[name] = result
                self._write_index_atomic(index)
        return result

    def delete(self, name: str) -> bool:
        """Remove the instinct file and its index entry.

        Returns ``True`` if an entry was removed, ``False`` if no entry
        with that name was present.
        """
        _validate_component(name, label="name")
        thread_lock = _get_thread_lock(self.root)
        removed: bool = False
        with thread_lock:
            with _index_flock(self.lock_path):
                index = self._read_index()
                entry = index.instincts.pop(name, None)
                if entry is not None:
                    target = self._absolute_path(entry.path)
                    try:
                        target.unlink(missing_ok=True)
                    except OSError:
                        # File removal is best-effort; the index drop is
                        # the source of truth for "no longer exists".
                        pass
                    self._write_index_atomic(index)
                    removed = True
        return removed

    # --- Public read API --------------------------------------------------

    def get(self, name: str) -> str | None:
        """Return the markdown content of an instinct, or ``None``."""
        _validate_component(name, label="name")
        entry = self.get_entry(name)
        if entry is None:
            return None
        target = self._absolute_path(entry.path)
        try:
            return target.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return None

    def get_entry(self, name: str) -> InstinctEntry | None:
        """Return the index entry for ``name``, or ``None``."""
        _validate_component(name, label="name")
        return self._read_index().instincts.get(name)

    def list_entries(self) -> list[InstinctEntry]:
        """Return all index entries sorted by ``name``."""
        index = self._read_index()
        return sorted(index.instincts.values(), key=lambda e: e.name)

    def iter_entries(self) -> Iterator[InstinctEntry]:
        """Iterate index entries in name-sorted order."""
        return iter(self.list_entries())

    def count(self) -> int:
        """Return the number of indexed instincts."""
        return len(self._read_index().instincts)

    def checksum(self, name: str) -> str | None:
        """Return SHA-256 hex of the on-disk file, or ``None``."""
        entry = self.get_entry(name)
        if entry is None:
            return None
        target = self._absolute_path(entry.path)
        if not target.exists():
            return None
        try:
            data = target.read_bytes()
        except OSError:
            return None
        return _sha256_hex(data)

    def verify(self, name: str) -> bool:
        """Compare on-disk SHA-256 to the index-stored checksum."""
        entry = self.get_entry(name)
        if entry is None:
            return False
        actual = self.checksum(name)
        return actual == entry.checksum

    def index_checksum(self) -> str:
        """SHA-256 hex of the raw index.json bytes (empty file ⇒ empty bytes)."""
        if not self.index_path.exists():
            return _sha256_hex(b"")
        try:
            data = self.index_path.read_bytes()
        except OSError:
            return _sha256_hex(b"")
        return _sha256_hex(data)


__all__ = [
    "GLOBAL_SCOPE",
    "INDEX_FILENAME",
    "INDEX_LOCK_FILENAME",
    "INDEX_SCHEMA_VERSION",
    "InstinctChecksumMismatch",
    "InstinctEntry",
    "InstinctStore",
    "InstinctValidationError",
    "resolve_instinct_scope",
]
