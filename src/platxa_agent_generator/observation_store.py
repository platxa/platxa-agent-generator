"""Append-only structured observation store backed by JSONL.

Owns the on-disk shape of ``.claude/observations.jsonl`` for the
continuous-learning pipeline. ``ObservationRecord`` is a strict superset of
the existing 5-field telemetry shape (timestamp / tool / input_summary /
project_id / project_name) plus 7 new fields the observer subagent and
downstream promoters consume. Old rows continue to parse via
``ObservationRecord.from_dict``'s missing-field defaults.

All writes go through ``ObservationStore.append`` under a process-safe
``FileLock`` from :mod:`platxa_agent_generator.state_persistence`.

Backward-compat contract (sprint #1 deferral)
=============================================
``agent_name`` defaults to ``""`` even though it appears in the feature
spec's enumerated field list. Promoting it to a hard-required field would
reject every one of the 5223 historical telemetry rows in
``.claude/observations.jsonl``, which were written before the observer
subagent existed. The downstream observer subagent (later sprint feature)
is therefore the contract owner: it MUST set ``agent_name`` on every row
it writes. Rows missing ``agent_name`` are accepted only for legacy
compatibility — analytics that aggregate by agent must filter empties.
"""

from __future__ import annotations

import hashlib
import json
import os
import typing
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterator, Literal

try:
    from .shared.paths import get_project_agents_dir
    from .state_persistence import FileLock
except ImportError:
    from shared.paths import get_project_agents_dir  # type: ignore[import-not-found,no-redef]
    from state_persistence import FileLock  # type: ignore[import-not-found,no-redef]

DEFAULT_OBSERVATION_CAP: int = 200

ObservationType = Literal[
    "tool_use",
    "decision",
    "preference",
    "milestone",
    "problem",
    "bugfix",
    "feature",
    "refactor",
    "discovery",
]

# Derived from ``ObservationType`` so the runtime guard and the static
# type cannot drift apart when a new value is added to the Literal.
OBSERVATION_TYPES: frozenset[str] = frozenset(typing.get_args(ObservationType))

REQUIRED_FIELDS: tuple[str, ...] = (
    "timestamp",
    "tool",
    "input_summary",
    "project_id",
    "project_name",
)


class ObservationValidationError(ValueError):
    """Raised when an ObservationRecord violates a hard schema invariant."""


@dataclass
class ObservationRecord:
    """One row of the observation log.

    Required fields (the original telemetry shape) must be non-empty
    strings. Optional fields (the new observer-pipeline shape) carry
    defaults so old 5-field rows round-trip through ``from_dict`` without
    rewriting historical data.
    """

    timestamp: str
    tool: str
    input_summary: str
    project_id: str
    project_name: str
    session_id: str = ""
    agent_name: str = ""
    type: ObservationType = "tool_use"
    evidence: str = ""
    examples: list[str] = field(default_factory=list)
    outcome: str = ""
    confidence: float = 1.0
    pattern_label: str | None = None
    promoted_to: str | None = None

    def __post_init__(self) -> None:
        for name in REQUIRED_FIELDS:
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip():
                raise ObservationValidationError(
                    f"required field {name!r} must be a non-empty string"
                )
        if self.type not in OBSERVATION_TYPES:
            raise ObservationValidationError(
                f"type must be one of {sorted(OBSERVATION_TYPES)}, got {self.type!r}"
            )
        if not (0.0 <= self.confidence <= 1.0):
            raise ObservationValidationError(
                f"confidence must be in [0.0, 1.0], got {self.confidence!r}"
            )
        if not isinstance(self.examples, list) or not all(
            isinstance(e, str) for e in self.examples
        ):
            raise ObservationValidationError("examples must be a list of strings")
        if self.pattern_label is not None and (
            not isinstance(self.pattern_label, str) or not self.pattern_label.strip()
        ):
            raise ObservationValidationError("pattern_label must be None or a non-empty string")
        if self.promoted_to is not None and (
            not isinstance(self.promoted_to, str) or not self.promoted_to.strip()
        ):
            raise ObservationValidationError("promoted_to must be None or a non-empty string")

    def to_jsonl(self) -> str:
        """Serialize as one JSON line (terminating newline included)."""
        return json.dumps(asdict(self), ensure_ascii=True, sort_keys=True) + "\n"

    @classmethod
    def from_dict(cls, data: dict) -> ObservationRecord:
        """Construct from a dict, tolerating missing optional fields.

        Old 5-field telemetry rows produce a record with optional fields
        at their declared defaults, preserving backward compatibility.
        Unknown keys are ignored so future schema additions in callers
        do not break readers built against an older library version.
        """
        known = {
            "timestamp",
            "tool",
            "input_summary",
            "project_id",
            "project_name",
            "session_id",
            "agent_name",
            "type",
            "evidence",
            "examples",
            "outcome",
            "confidence",
            "pattern_label",
            "promoted_to",
        }
        kwargs = {k: v for k, v in data.items() if k in known}
        return cls(**kwargs)


def _default_observations_path() -> Path:
    """Resolve ``.claude/observations.jsonl`` from the project agents dir."""
    return get_project_agents_dir().parent / "observations.jsonl"


class ObservationStore:
    """Append-only JSONL store with process-safe locking.

    Reads are lock-free and tolerant of malformed rows (skipped with no
    exception). Writes acquire an exclusive ``FileLock`` for the duration
    of the append, so concurrent writers from multiple processes (or
    multiple hooks firing in parallel) cannot interleave bytes within a
    single record.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path: Path = path if path is not None else _default_observations_path()
        self.lock_path: Path = self.path.with_suffix(self.path.suffix + ".lock")
        self._session_count: int = 0
        raw = os.environ.get("PLATXA_OBSERVATION_CAP", "")
        try:
            parsed = int(raw) if raw.strip() else -1
        except ValueError:
            parsed = -1
        self._cap: int = parsed if parsed >= 0 else DEFAULT_OBSERVATION_CAP

    def append(self, record: ObservationRecord) -> None:
        """Append one record to the JSONL file under an exclusive file lock.

        Silently drops the record when the session cap has been reached.
        """
        if self._cap > 0 and self._session_count >= self._cap:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(self.lock_path):
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(record.to_jsonl())
        self._session_count += 1

    def append_many(self, records: list[ObservationRecord]) -> None:
        """Append a batch of records under a single lock acquisition.

        Only appends up to remaining session capacity when a cap is active.
        """
        if not records:
            return
        if self._cap > 0:
            remaining = self._cap - self._session_count
            if remaining <= 0:
                return
            records = records[:remaining]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(self.lock_path):
            with self.path.open("a", encoding="utf-8") as fh:
                for record in records:
                    fh.write(record.to_jsonl())
        self._session_count += len(records)

    def iter_records(self) -> Iterator[ObservationRecord]:
        """Yield records from disk, skipping rows that fail to parse.

        Tolerant by design — a single corrupted line should not block
        the rest of the log from being processed. We catch
        ``ObservationValidationError`` for our own invariants AND
        ``TypeError`` / ``ValueError`` for type-level corruption that
        ``__post_init__`` does not coerce (e.g. a future writer that
        emits ``confidence: "0.5"`` as a string would otherwise crash
        the iterator on the ``0.0 <= self.confidence <= 1.0`` compare).
        """
        if not self.path.exists():
            return
        with self.path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(data, dict):
                    continue
                try:
                    yield ObservationRecord.from_dict(data)
                except (ObservationValidationError, TypeError, ValueError):
                    continue

    def read_all(self) -> list[ObservationRecord]:
        """Return all parseable records as a list."""
        return list(self.iter_records())

    def count(self) -> int:
        """Count parseable records on disk (cheap; iterates lazily)."""
        return sum(1 for _ in self.iter_records())

    def mark_promoted(
        self,
        instinct_id: str,
        *,
        match: typing.Callable[[ObservationRecord], bool],
    ) -> int:
        """Set ``promoted_to`` on every record matched by *match*.

        Rewrites the entire JSONL file under an exclusive lock. Lines that
        fail to parse are preserved verbatim so the rewrite is non-lossy.
        Returns the number of records updated.
        """
        if not instinct_id or not instinct_id.strip():
            raise ObservationValidationError("instinct_id must be a non-empty string")
        if not self.path.exists():
            return 0

        updated = 0
        rewritten: list[str] = []

        with FileLock(self.lock_path):
            raw_lines = self.path.read_text(encoding="utf-8").splitlines(keepends=True)
            for raw in raw_lines:
                line = raw.strip()
                if not line:
                    rewritten.append(raw)
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    rewritten.append(raw)
                    continue
                if not isinstance(data, dict):
                    rewritten.append(raw)
                    continue
                try:
                    record = ObservationRecord.from_dict(data)
                except (ObservationValidationError, TypeError, ValueError):
                    rewritten.append(raw)
                    continue

                if match(record) and record.promoted_to is None:
                    data["promoted_to"] = instinct_id
                    rewritten.append(json.dumps(data, ensure_ascii=True, sort_keys=True) + "\n")
                    updated += 1
                else:
                    rewritten.append(raw)

            tmp = self.path.with_suffix(".tmp")
            tmp.write_text("".join(rewritten), encoding="utf-8")
            tmp.replace(self.path)

        return updated

    def migrate(self) -> dict[str, int | str]:
        """Non-destructive schema migration with backup.

        Backs up the original file to ``{path}.v1.bak``, then writes
        every row (upgraded to the full schema) to ``{path}.v2``. The
        original file is left untouched. Already-complete rows are
        serialized identically so a second run produces a byte-identical
        ``.v2``. Malformed lines are preserved verbatim.

        Returns a dict with keys ``migrated`` (count of upgraded rows),
        ``total`` (total parseable rows), ``backup_path``, and
        ``output_path``.
        """
        if not self.path.exists():
            return {"migrated": 0, "total": 0, "backup_path": "", "output_path": ""}

        backup_path = Path(str(self.path) + ".v1.bak")
        output_path = Path(str(self.path) + ".v2")

        migrated = 0
        total = 0
        rewritten: list[str] = []

        with FileLock(self.lock_path):
            raw_bytes = self.path.read_bytes()
            backup_path.write_bytes(raw_bytes)

            raw_lines = raw_bytes.decode("utf-8").splitlines(keepends=True)
            for raw in raw_lines:
                line = raw.strip()
                if not line:
                    rewritten.append(raw)
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    rewritten.append(raw)
                    continue
                if not isinstance(data, dict):
                    rewritten.append(raw)
                    continue
                try:
                    record = ObservationRecord.from_dict(data)
                except (ObservationValidationError, TypeError, ValueError):
                    rewritten.append(raw)
                    continue

                total += 1
                canonical = record.to_jsonl()
                if canonical.strip() != line:
                    migrated += 1
                rewritten.append(canonical)

            output_path.write_text("".join(rewritten), encoding="utf-8")

        return {
            "migrated": migrated,
            "total": total,
            "backup_path": str(backup_path),
            "output_path": str(output_path),
        }

    def tail_sample(self, cap: int | None = None) -> list[ObservationRecord]:
        """Return a tail-sampled subset of on-disk observations.

        When the total record count exceeds *cap*, retains the first
        ``cap // 2`` records (session-boot signals) and the last
        ``cap - cap // 2`` records (completion signals), dropping the
        middle entirely.  When *cap* is ``None`` the store's configured
        session cap is used; when *cap* is 0 or negative, all records
        are returned unsampled.
        """
        all_records = self.read_all()
        effective_cap = cap if cap is not None else self._cap
        if effective_cap <= 0 or len(all_records) <= effective_cap:
            return all_records
        head_size = effective_cap // 2
        tail_size = effective_cap - head_size
        return all_records[:head_size] + all_records[-tail_size:]

    def stats(self) -> dict[str, dict[str, int]]:
        """Compute aggregate statistics over parseable records.

        Returns a dict with keys ``by_type``, ``by_tool``, ``by_agent``,
        ``promoted``, and ``total``.
        """
        by_type: dict[str, int] = {}
        by_tool: dict[str, int] = {}
        by_agent: dict[str, int] = {}
        promoted_count = 0
        total = 0

        for record in self.iter_records():
            total += 1
            by_type[record.type] = by_type.get(record.type, 0) + 1
            by_tool[record.tool] = by_tool.get(record.tool, 0) + 1
            agent_key = record.agent_name or "(unknown)"
            by_agent[agent_key] = by_agent.get(agent_key, 0) + 1
            if record.promoted_to is not None:
                promoted_count += 1

        return {
            "total": {"count": total},
            "promoted": {"count": promoted_count},
            "by_type": dict(sorted(by_type.items())),
            "by_tool": dict(sorted(by_tool.items())),
            "by_agent": dict(sorted(by_agent.items())),
        }

    def checksum(self) -> str:
        """SHA-256 hex digest of the file's bytes (empty if file absent)."""
        if not self.path.exists():
            return hashlib.sha256(b"").hexdigest()
        h = hashlib.sha256()
        with self.path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()


__all__ = [
    "DEFAULT_OBSERVATION_CAP",
    "OBSERVATION_TYPES",
    "REQUIRED_FIELDS",
    "ObservationRecord",
    "ObservationStore",
    "ObservationType",
    "ObservationValidationError",
]
