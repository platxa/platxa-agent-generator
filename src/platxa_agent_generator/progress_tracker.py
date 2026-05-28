"""Progress state for multi-phase agent generation.

Maintains a serializable :class:`ProgressState` with per-phase progress and
ETA, persisted to ``.claude/state/progress.json`` so an external consumer
(Claude Code's TodoWrite, a hook, an orchestrator wrapper) can read the
current progress without owning the producer.

Rendering, event-notification callbacks, and the standalone ``__main__``
CLI live elsewhere: Claude Code's harness handles user-visible progress,
so this module is pure data + ETA math.
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class ProgressPhase(Enum):
    """Agent generation workflow phases with weights."""

    IDLE = ("idle", 0, 0)
    DISCOVERY = ("discovery", 1, 20)
    ARCHITECTURE = ("architecture", 2, 20)
    GENERATION = ("generation", 3, 30)
    VALIDATION = ("validation", 4, 20)
    INSTALLATION = ("installation", 5, 10)
    COMPLETE = ("complete", 6, 100)
    ERROR = ("error", -1, 0)

    def __init__(self, phase_name: str, order: int, cumulative_percent: int):
        self.phase_name = phase_name
        self.order = order
        self.cumulative_percent = cumulative_percent

    @classmethod
    def from_name(cls, name: str) -> ProgressPhase:
        """Get phase by name."""
        for phase in cls:
            if phase.phase_name == name.lower():
                return phase
        return cls.IDLE

    @classmethod
    def get_weight(cls, phase: ProgressPhase) -> int:
        """Get the weight (percentage) for a phase."""
        weights = {
            cls.DISCOVERY: 20,
            cls.ARCHITECTURE: 20,
            cls.GENERATION: 30,
            cls.VALIDATION: 20,
            cls.INSTALLATION: 10,
        }
        return weights.get(phase, 0)


@dataclass
class PhaseProgress:
    """Progress tracking for a single phase."""

    phase: str
    started_at: str
    completed_at: str | None = None
    progress_percent: int = 0
    status: str = "pending"  # pending, running, completed, failed, skipped
    message: str = ""
    duration_ms: int = 0


@dataclass
class ProgressState:
    """Complete progress state for tracking."""

    task_name: str
    started_at: str
    completed_at: str | None = None
    current_phase: str = "idle"
    overall_percent: int = 0
    phases: dict[str, PhaseProgress] = field(default_factory=dict)
    eta_seconds: float | None = None
    elapsed_seconds: float = 0
    status: str = "pending"  # pending, running, completed, failed
    error_message: str | None = None

    def __post_init__(self) -> None:
        """Initialize phases if not provided."""
        if not self.phases:
            for phase in ProgressPhase:
                if phase not in (ProgressPhase.IDLE, ProgressPhase.COMPLETE, ProgressPhase.ERROR):
                    self.phases[phase.phase_name] = PhaseProgress(
                        phase=phase.phase_name,
                        started_at="",
                    )


class ProgressTracker:
    """Track progress through agent generation phases with ETA calculation.

    Stores serializable state to ``state_file``; no UI rendering. Callers
    that want a user-visible progress bar should read the state file (or
    use Claude Code's TodoWrite tool directly).
    """

    def __init__(self, state_file: Path | str | None = None):
        """Initialize progress tracker.

        Args:
            state_file: Path to persist progress state.
        """
        if state_file:
            self.state_file = Path(state_file)
        else:
            self.state_file = Path.cwd() / ".claude" / "state" / "progress.json"

        self._state: ProgressState | None = None
        self._phase_start_time: float | None = None
        self._history: list[tuple[float, int]] = []  # (timestamp, percent) for ETA

    def start(self, task_name: str) -> ProgressState:
        """Start tracking a new task.

        Args:
            task_name: Name of the task being tracked.

        Returns:
            Initial ProgressState.
        """
        self._state = ProgressState(
            task_name=task_name,
            started_at=datetime.now().isoformat(),
            status="running",
        )
        self._history = [(time.time(), 0)]
        self._save_state()
        return self._state

    def update_phase(
        self,
        phase: str | ProgressPhase,
        progress_percent: int = 0,
        message: str = "",
    ) -> ProgressState:
        """Update progress for a phase.

        Args:
            phase: Phase to update.
            progress_percent: Progress within the phase (0-100).
            message: Optional status message.

        Returns:
            Updated ProgressState.
        """
        if self._state is None:
            raise ValueError("No active progress tracking. Call start() first.")

        if isinstance(phase, ProgressPhase):
            phase_name = phase.phase_name
        else:
            phase_name = phase.lower()

        # Check if phase is changing
        if self._state.current_phase != phase_name:
            # Complete previous phase
            if self._state.current_phase in self._state.phases:
                prev_phase = self._state.phases[self._state.current_phase]
                if prev_phase.status == "running":
                    prev_phase.status = "completed"
                    prev_phase.completed_at = datetime.now().isoformat()
                    prev_phase.progress_percent = 100
                    if self._phase_start_time:
                        prev_phase.duration_ms = int((time.time() - self._phase_start_time) * 1000)

            # Start new phase
            self._state.current_phase = phase_name
            self._phase_start_time = time.time()

            if phase_name in self._state.phases:
                current_phase = self._state.phases[phase_name]
                current_phase.status = "running"
                current_phase.started_at = datetime.now().isoformat()

        # Update phase progress
        if phase_name in self._state.phases:
            self._state.phases[phase_name].progress_percent = progress_percent
            if message:
                self._state.phases[phase_name].message = message

        # Calculate overall progress
        self._calculate_overall_progress()

        # Calculate ETA
        self._calculate_eta()

        # Update elapsed time
        start_time = datetime.fromisoformat(self._state.started_at)
        self._state.elapsed_seconds = (datetime.now() - start_time).total_seconds()

        self._save_state()
        return self._state

    def complete(self, success: bool = True, message: str = "") -> ProgressState:
        """Mark the entire task as complete.

        Args:
            success: Whether task completed successfully.
            message: Completion message.

        Returns:
            Final ProgressState.
        """
        if self._state is None:
            raise ValueError("No active progress tracking.")

        # Complete current phase
        if self._state.current_phase in self._state.phases:
            phase = self._state.phases[self._state.current_phase]
            if phase.status == "running":
                phase.status = "completed" if success else "failed"
                phase.completed_at = datetime.now().isoformat()
                phase.progress_percent = 100 if success else phase.progress_percent

        # Update overall state
        self._state.completed_at = datetime.now().isoformat()
        self._state.status = "completed" if success else "failed"
        self._state.overall_percent = 100 if success else self._state.overall_percent
        self._state.current_phase = "complete" if success else "error"
        self._state.eta_seconds = 0

        if not success and message:
            self._state.error_message = message

        # Calculate final elapsed time
        start_time = datetime.fromisoformat(self._state.started_at)
        self._state.elapsed_seconds = (datetime.now() - start_time).total_seconds()

        self._save_state()
        return self._state

    def fail(self, error_message: str) -> ProgressState:
        """Mark the task as failed.

        Args:
            error_message: Error description.

        Returns:
            Final ProgressState.
        """
        return self.complete(success=False, message=error_message)

    def get_state(self) -> ProgressState | None:
        """Get current progress state."""
        return self._state

    def load_state(self) -> ProgressState | None:
        """Load progress state from file.

        Returns ``None`` when no state exists yet *or* when the persisted
        file is unreadable. Distinguishes "absent" from "unreadable" by
        emitting a stderr warning in the latter case — symmetric with
        :meth:`_save_state`, so an operator resuming a long-running
        generation never loses the resume anchor with zero diagnostic.
        """
        if not self.state_file.exists():
            return None

        try:
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
            self._state = self._deserialize_state(data)
            return self._state
        except (json.JSONDecodeError, OSError) as e:
            print(
                f"warning: progress_tracker failed to load state "
                f"{self.state_file}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )
            return None

    # Private methods

    def _calculate_overall_progress(self) -> None:
        """Calculate overall progress from phase progress."""
        if self._state is None:
            return

        total = 0
        for phase in ProgressPhase:
            if phase.phase_name in self._state.phases:
                phase_progress = self._state.phases[phase.phase_name]
                weight = ProgressPhase.get_weight(phase)
                if phase_progress.status == "completed":
                    total += weight
                elif phase_progress.status == "running":
                    total += int(weight * phase_progress.progress_percent / 100)

        self._state.overall_percent = min(100, total)
        self._history.append((time.time(), total))

        # Keep last 20 history points for ETA calculation
        self._history = self._history[-20:]

    def _calculate_eta(self) -> None:
        """Calculate estimated time to completion."""
        if self._state is None:
            return

        if len(self._history) < 2:
            self._state.eta_seconds = None
            return

        # Calculate progress rate from history
        first_time, first_percent = self._history[0]
        last_time, last_percent = self._history[-1]

        time_diff = last_time - first_time
        percent_diff = last_percent - first_percent

        if time_diff <= 0 or percent_diff <= 0:
            self._state.eta_seconds = None
            return

        # Rate: percent per second
        rate = percent_diff / time_diff
        remaining_percent = 100 - last_percent

        if rate > 0:
            self._state.eta_seconds = remaining_percent / rate
        else:
            self._state.eta_seconds = None

    def _save_state(self) -> None:
        """Save progress state to file."""
        if self._state is None:
            return

        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            data = self._serialize_state(self._state)
            self.state_file.write_text(
                json.dumps(data, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            # Progress state is best-effort (the caller holds the live
            # ProgressState in memory), but silently dropping the write
            # meant a disk-full or read-only filesystem looked identical
            # to a successful save — operators lost their cross-session
            # resume anchor with zero diagnostic. Surface the path and
            # error class so the failure is visible without changing the
            # swallow-and-continue contract.
            print(
                f"warning: progress_tracker failed to write state "
                f"{self.state_file}: {type(e).__name__}: {e}",
                file=sys.stderr,
            )

    def _serialize_state(self, state: ProgressState) -> dict[str, Any]:
        """Serialize progress state to dict."""
        return {
            "task_name": state.task_name,
            "started_at": state.started_at,
            "completed_at": state.completed_at,
            "current_phase": state.current_phase,
            "overall_percent": state.overall_percent,
            "phases": {
                name: {
                    "phase": p.phase,
                    "started_at": p.started_at,
                    "completed_at": p.completed_at,
                    "progress_percent": p.progress_percent,
                    "status": p.status,
                    "message": p.message,
                    "duration_ms": p.duration_ms,
                }
                for name, p in state.phases.items()
            },
            "eta_seconds": state.eta_seconds,
            "elapsed_seconds": state.elapsed_seconds,
            "status": state.status,
            "error_message": state.error_message,
        }

    def _deserialize_state(self, data: dict[str, Any]) -> ProgressState:
        """Deserialize progress state from dict.

        State files written before feature #24 included a ``subtasks``
        array per phase. We accept that key for backward compatibility
        but ignore its contents — the subtask data model was removed
        with the rendering and event-notification code.
        """
        phases = {}
        for name, p_data in data.get("phases", {}).items():
            phases[name] = PhaseProgress(
                phase=p_data["phase"],
                started_at=p_data["started_at"],
                completed_at=p_data.get("completed_at"),
                progress_percent=p_data.get("progress_percent", 0),
                status=p_data.get("status", "pending"),
                message=p_data.get("message", ""),
                duration_ms=p_data.get("duration_ms", 0),
            )

        return ProgressState(
            task_name=data["task_name"],
            started_at=data["started_at"],
            completed_at=data.get("completed_at"),
            current_phase=data.get("current_phase", "idle"),
            overall_percent=data.get("overall_percent", 0),
            phases=phases,
            eta_seconds=data.get("eta_seconds"),
            elapsed_seconds=data.get("elapsed_seconds", 0),
            status=data.get("status", "pending"),
            error_message=data.get("error_message"),
        )
