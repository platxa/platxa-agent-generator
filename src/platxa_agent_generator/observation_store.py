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
import typing
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterator, Literal

from .shared.paths import get_project_agents_dir
from .state_persistence import FileLock

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
        if self.promoted_to is not None and (
            not isinstance(self.promoted_to, str) or not self.promoted_to.strip()
        ):
            raise ObservationValidationError(
                "promoted_to must be None or a non-empty string"
            )

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

    def append(self, record: ObservationRecord) -> None:
        """Append one record to the JSONL file under an exclusive file lock."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(self.lock_path):
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(record.to_jsonl())

    def append_many(self, records: list[ObservationRecord]) -> None:
        """Append a batch of records under a single lock acquisition."""
        if not records:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with FileLock(self.lock_path):
            with self.path.open("a", encoding="utf-8") as fh:
                for record in records:
                    fh.write(record.to_jsonl())

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
            raise ObservationValidationError(
                "instinct_id must be a non-empty string"
            )
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
                    rewritten.append(
                        json.dumps(data, ensure_ascii=True, sort_keys=True) + "\n"
                    )
                    updated += 1
                else:
                    rewritten.append(raw)

            tmp = self.path.with_suffix(".tmp")
            tmp.write_text("".join(rewritten), encoding="utf-8")
            tmp.replace(self.path)

        return updated

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
    "OBSERVATION_TYPES",
    "REQUIRED_FIELDS",
    "ObservationRecord",
    "ObservationStore",
    "ObservationType",
    "ObservationValidationError",
]
