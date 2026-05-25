"""Dual-write progress log: human-readable .txt + structured .jsonl companion.

Owns the on-disk shape of ``.claude/claude-progress.jsonl`` alongside the
existing ``.claude/claude-progress.txt``. Every call to
:meth:`ProgressLog.log` appends one line to each file atomically under a
process-safe ``FileLock``. The ``.txt`` line preserves the existing format
for human readers; the ``.jsonl`` line adds a queryable JSON object with
the same fields for agent consumption.

The companion JSONL file is purely additive — it never modifies or replaces
the existing ``.txt`` log. If the ``.txt`` path doesn't exist yet, both
files are created on first write.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .state_persistence import FileLock

__all__ = [
    "DEFAULT_JSONL_PATH",
    "DEFAULT_TXT_PATH",
    "ProgressEvent",
    "ProgressLog",
]

DEFAULT_TXT_PATH = ".claude/claude-progress.txt"
DEFAULT_JSONL_PATH = ".claude/claude-progress.jsonl"


@dataclass(frozen=True)
class ProgressEvent:
    """One structured progress event.

    Fields mirror the bracketed tokens in the existing ``.txt`` format:
    ``[timestamp] [session=X] [agent=Y] [feature=#Z] MESSAGE``.
    """

    timestamp: str
    session_id: str
    agent: str
    feature_id: int | None
    message: str

    def to_txt_line(self) -> str:
        """Format as the existing human-readable text line."""
        parts = [
            f"[{self.timestamp}]",
            f"[session={self.session_id}]",
            f"[agent={self.agent}]",
        ]
        if self.feature_id is not None:
            parts.append(f"[feature=#{self.feature_id}]")
        parts.append(self.message)
        return " ".join(parts)

    def to_jsonl_line(self) -> str:
        """Serialize as one JSON line (terminating newline included)."""
        return json.dumps(asdict(self), ensure_ascii=True, sort_keys=True) + "\n"

    @classmethod
    def from_dict(cls, data: dict) -> ProgressEvent:
        """Construct from a dict, tolerating missing optional fields."""
        return cls(
            timestamp=data["timestamp"],
            session_id=data.get("session_id", ""),
            agent=data.get("agent", ""),
            feature_id=data.get("feature_id"),
            message=data.get("message", ""),
        )


def _default_txt_path() -> Path:
    """Resolve the default .txt progress log path."""
    return Path(DEFAULT_TXT_PATH)


def _default_jsonl_path() -> Path:
    """Resolve the default .jsonl progress log path."""
    return Path(DEFAULT_JSONL_PATH)


def _now_iso() -> str:
    """Return current UTC time in ISO 8601 format."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class ProgressLog:
    """Dual-write progress logger: ``.txt`` for humans, ``.jsonl`` for agents.

    Every :meth:`log` call atomically appends one line to each file under
    a shared file lock, so concurrent writers from multiple processes
    cannot interleave bytes within a single record.
    """

    def __init__(
        self,
        txt_path: Path | str | None = None,
        jsonl_path: Path | str | None = None,
    ) -> None:
        self.txt_path: Path = Path(txt_path) if txt_path else _default_txt_path()
        self.jsonl_path: Path = Path(jsonl_path) if jsonl_path else _default_jsonl_path()
        self.lock_path: Path = self.jsonl_path.with_suffix(".jsonl.lock")

    def log(self, event: ProgressEvent) -> None:
        """Append one progress event to both .txt and .jsonl files."""
        txt_line = event.to_txt_line() + "\n"
        jsonl_line = event.to_jsonl_line()

        self.txt_path.parent.mkdir(parents=True, exist_ok=True)
        self.jsonl_path.parent.mkdir(parents=True, exist_ok=True)

        with FileLock(self.lock_path):
            with self.txt_path.open("a", encoding="utf-8") as fh:
                fh.write(txt_line)
            with self.jsonl_path.open("a", encoding="utf-8") as fh:
                fh.write(jsonl_line)

    def log_phase(
        self,
        *,
        phase: str,
        session_id: str = "",
        agent: str = "",
        feature_id: int | None = None,
        detail: str = "",
    ) -> ProgressEvent:
        """Convenience: log a phase transition event.

        Builds the message from ``phase`` and optional ``detail``, creates
        a :class:`ProgressEvent`, writes it, and returns the event.
        """
        message = f"PROGRESS {phase}"
        if detail:
            message = f"{message}: {detail}"
        event = ProgressEvent(
            timestamp=_now_iso(),
            session_id=session_id,
            agent=agent,
            feature_id=feature_id,
            message=message,
        )
        self.log(event)
        return event

    def log_dispatch(
        self,
        *,
        subagent: str,
        session_id: str = "",
        agent: str = "",
        feature_id: int | None = None,
        detail: str = "",
    ) -> ProgressEvent:
        """Convenience: log a subagent dispatch event.

        Builds a ``DISPATCH <subagent>`` message, writes it to both files,
        and returns the event.
        """
        message = f"DISPATCH {subagent}"
        if detail:
            message = f"{message}: {detail}"
        event = ProgressEvent(
            timestamp=_now_iso(),
            session_id=session_id,
            agent=agent,
            feature_id=feature_id,
            message=message,
        )
        self.log(event)
        return event

    def read_events(self) -> list[ProgressEvent]:
        """Read all events from the .jsonl file.

        Tolerant of malformed rows — they are silently skipped.
        """
        events: list[ProgressEvent] = []
        if not self.jsonl_path.exists():
            return events
        with self.jsonl_path.open("r", encoding="utf-8") as fh:
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
                    events.append(ProgressEvent.from_dict(data))
                except (KeyError, TypeError):
                    continue
        return events
