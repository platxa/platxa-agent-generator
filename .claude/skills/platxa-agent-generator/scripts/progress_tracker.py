#!/usr/bin/env python3
"""
Progress Tracking and Display System

Production-grade progress tracking for multi-phase agent generation with:
- Real-time progress updates with ETA calculation
- Visual progress bars and spinners
- Phase transition tracking with timing metrics
- Nested task support for sub-operations
- Event-driven progress notifications
- JSON and human-readable output formats
- Integration with state persistence

Progress Flow:
    [Discovery 20%] → [Architecture 20%] → [Generation 30%] → [Validation 20%] → [Installation 10%]

Usage:
    python progress_tracker.py start "Generating security-scanner agent"
    python progress_tracker.py update --phase generation --percent 50
    python progress_tracker.py subtask "Validating frontmatter" --weight 10
    python progress_tracker.py complete
    python progress_tracker.py status
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable


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
class SubTask:
    """A subtask within a phase."""

    name: str
    weight: int  # Percentage of parent phase
    started_at: str
    completed_at: str | None = None
    progress_percent: int = 0
    status: str = "pending"  # pending, running, completed, failed
    message: str = ""


@dataclass
class PhaseProgress:
    """Progress tracking for a single phase."""

    phase: str
    started_at: str
    completed_at: str | None = None
    progress_percent: int = 0
    subtasks: list[SubTask] = field(default_factory=list)
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


class ProgressDisplay:
    """Visual progress display utilities."""

    # Progress bar characters
    BAR_FILLED = "█"
    BAR_PARTIAL = "▓"
    BAR_EMPTY = "░"
    BAR_WIDTH = 30

    # Spinner frames
    SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

    # Phase icons
    PHASE_ICONS = {
        "idle": "○",
        "discovery": "🔍",
        "architecture": "📐",
        "generation": "⚙️",
        "validation": "✓",
        "installation": "📦",
        "complete": "✅",
        "error": "❌",
    }

    @classmethod
    def render_progress_bar(
        cls,
        percent: int,
        width: int = BAR_WIDTH,
        show_percent: bool = True,
    ) -> str:
        """
        Render a visual progress bar.

        Args:
            percent: Progress percentage (0-100)
            width: Bar width in characters
            show_percent: Whether to show percentage number

        Returns:
            Formatted progress bar string
        """
        percent = max(0, min(100, percent))
        filled = int(width * percent / 100)
        partial = 1 if (width * percent / 100) - filled >= 0.5 else 0
        empty = width - filled - partial

        bar = cls.BAR_FILLED * filled + cls.BAR_PARTIAL * partial + cls.BAR_EMPTY * empty

        if show_percent:
            return f"[{bar}] {percent:3d}%"
        return f"[{bar}]"

    @classmethod
    def render_spinner(cls, frame_index: int) -> str:
        """Get spinner frame for animation."""
        return cls.SPINNER_FRAMES[frame_index % len(cls.SPINNER_FRAMES)]

    @classmethod
    def format_duration(cls, seconds: float) -> str:
        """Format duration in human-readable format."""
        if seconds < 60:
            return f"{seconds:.1f}s"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{minutes}m {secs}s"
        else:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            return f"{hours}h {minutes}m"

    @classmethod
    def format_eta(cls, seconds: float | None) -> str:
        """Format ETA in human-readable format."""
        if seconds is None:
            return "calculating..."
        if seconds <= 0:
            return "completing..."
        return f"~{cls.format_duration(seconds)} remaining"

    @classmethod
    def render_phase_status(cls, phase: str, status: str, percent: int = 0) -> str:
        """Render phase status with icon."""
        icon = cls.PHASE_ICONS.get(phase, "○")

        if status == "completed":
            return f"  {icon} {phase.title()}: ✓ Complete"
        elif status == "running":
            bar = cls.render_progress_bar(percent, width=15)
            return f"  {icon} {phase.title()}: {bar}"
        elif status == "failed":
            return f"  {icon} {phase.title()}: ❌ Failed"
        elif status == "skipped":
            return f"  {icon} {phase.title()}: ⊘ Skipped"
        else:
            return f"  {icon} {phase.title()}: ○ Pending"


_TODOWRITE_PHASE_ORDER: tuple[ProgressPhase, ...] = (
    ProgressPhase.DISCOVERY,
    ProgressPhase.ARCHITECTURE,
    ProgressPhase.GENERATION,
    ProgressPhase.VALIDATION,
    ProgressPhase.INSTALLATION,
)


# Per-phase TodoWrite labels: ``(content_label, active_label)``. The
# content label is the noun phrase the user sees when the item is
# pending or completed; the active label is the present-participle
# phrase shown while the item is in_progress (matching Claude Code's
# TodoWrite ``activeForm`` convention).
_TODOWRITE_PHASE_LABELS: dict[ProgressPhase, tuple[str, str]] = {
    ProgressPhase.DISCOVERY: ("Discovery", "Discovering"),
    ProgressPhase.ARCHITECTURE: ("Architecture", "Designing architecture"),
    ProgressPhase.GENERATION: ("Generation", "Generating files"),
    ProgressPhase.VALIDATION: ("Validation", "Validating"),
    ProgressPhase.INSTALLATION: ("Installation", "Installing"),
}


# Map phase status (PhaseProgress.status) → TodoWrite item status. A
# ``skipped`` phase is reported as ``completed`` because TodoWrite has
# no "skipped" state and the workflow has moved past it. A ``failed``
# phase stays ``in_progress`` so the user sees it as the active row
# that needs attention rather than silently ticking it off.
_TODOWRITE_STATUS_MAP: dict[str, str] = {
    "pending": "pending",
    "running": "in_progress",
    "completed": "completed",
    "skipped": "completed",
    "failed": "in_progress",
}


def _phase_to_todowrite_item(
    phase: ProgressPhase,
    phase_progress: PhaseProgress,
) -> dict[str, str]:
    """Convert one PhaseProgress into a single TodoWrite item.

    Status mapping mirrors the docstring on
    :meth:`ProgressTracker.to_todowrite_items`. Kept as a free function
    so the conversion can be unit-tested in isolation, without needing
    a full ProgressTracker / state file.
    """
    content_label, active_label = _TODOWRITE_PHASE_LABELS[phase]
    suffix = f" [{phase_progress.progress_percent}%]"
    todo_status = _TODOWRITE_STATUS_MAP.get(phase_progress.status, "pending")
    return {
        "content": content_label + suffix,
        "status": todo_status,
        "activeForm": active_label + suffix,
    }


class ProgressTracker:
    """
    Production-grade progress tracking for agent generation.

    Tracks progress through workflow phases with timing, ETA calculation,
    and visual display support.
    """

    def __init__(
        self,
        state_file: Path | str | None = None,
        on_progress: Callable[[ProgressState], None] | None = None,
    ):
        """
        Initialize progress tracker.

        Args:
            state_file: Path to persist progress state
            on_progress: Callback for progress updates
        """
        if state_file:
            self.state_file = Path(state_file)
        else:
            self.state_file = Path.cwd() / ".claude" / "state" / "progress.json"

        self.on_progress = on_progress
        self._state: ProgressState | None = None
        self._phase_start_time: float | None = None
        self._history: list[tuple[float, int]] = []  # (timestamp, percent) for ETA

    def start(self, task_name: str) -> ProgressState:
        """
        Start tracking a new task.

        Args:
            task_name: Name of the task being tracked

        Returns:
            Initial ProgressState
        """
        self._state = ProgressState(
            task_name=task_name,
            started_at=datetime.now().isoformat(),
            status="running",
        )
        self._history = [(time.time(), 0)]
        self._save_state()
        self._notify()
        return self._state

    def update_phase(
        self,
        phase: str | ProgressPhase,
        progress_percent: int = 0,
        message: str = "",
    ) -> ProgressState:
        """
        Update progress for a phase.

        Args:
            phase: Phase to update
            progress_percent: Progress within the phase (0-100)
            message: Optional status message

        Returns:
            Updated ProgressState
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
        self._notify()
        return self._state

    def add_subtask(
        self,
        name: str,
        weight: int = 10,
        phase: str | None = None,
    ) -> SubTask:
        """
        Add a subtask to the current or specified phase.

        Args:
            name: Subtask name
            weight: Percentage weight within the phase
            phase: Phase to add subtask to (defaults to current)

        Returns:
            Created SubTask
        """
        if self._state is None:
            raise ValueError("No active progress tracking. Call start() first.")

        target_phase = phase or self._state.current_phase
        if target_phase not in self._state.phases:
            raise ValueError(f"Invalid phase: {target_phase}")

        subtask = SubTask(
            name=name,
            weight=weight,
            started_at=datetime.now().isoformat(),
            status="running",
        )

        self._state.phases[target_phase].subtasks.append(subtask)
        self._save_state()
        return subtask

    def complete_subtask(
        self,
        subtask_name: str,
        phase: str | None = None,
        success: bool = True,
    ) -> None:
        """
        Mark a subtask as complete.

        Args:
            subtask_name: Name of subtask to complete
            phase: Phase containing the subtask
            success: Whether subtask completed successfully
        """
        if self._state is None:
            return

        target_phase = phase or self._state.current_phase
        if target_phase not in self._state.phases:
            return

        for subtask in self._state.phases[target_phase].subtasks:
            if subtask.name == subtask_name:
                subtask.completed_at = datetime.now().isoformat()
                subtask.status = "completed" if success else "failed"
                subtask.progress_percent = 100 if success else subtask.progress_percent
                break

        # Recalculate phase progress based on subtasks
        self._recalculate_phase_progress(target_phase)
        self._save_state()
        self._notify()

    def complete(self, success: bool = True, message: str = "") -> ProgressState:
        """
        Mark the entire task as complete.

        Args:
            success: Whether task completed successfully
            message: Completion message

        Returns:
            Final ProgressState
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
        self._notify()
        return self._state

    def fail(self, error_message: str) -> ProgressState:
        """
        Mark the task as failed.

        Args:
            error_message: Error description

        Returns:
            Final ProgressState
        """
        return self.complete(success=False, message=error_message)

    def get_state(self) -> ProgressState | None:
        """Get current progress state."""
        return self._state

    def load_state(self) -> ProgressState | None:
        """Load progress state from file."""
        if not self.state_file.exists():
            return None

        try:
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
            self._state = self._deserialize_state(data)
            return self._state
        except (json.JSONDecodeError, OSError):
            return None

    def render(self, compact: bool = False) -> str:
        """
        Render progress as string.

        Args:
            compact: Use compact single-line format

        Returns:
            Formatted progress string
        """
        if self._state is None:
            return "No active progress tracking."

        if compact:
            return self._render_compact()
        return self._render_full()

    def render_json(self) -> str:
        """Render progress as JSON string."""
        if self._state is None:
            return "{}"
        return json.dumps(self._serialize_state(self._state), indent=2)

    def to_todowrite_items(self) -> list[dict[str, str]]:
        """Render progress as a TodoWrite-compatible item list.

        Claude Code's TodoWrite tool consumes a list of items shaped as
        ``{"content", "status", "activeForm"}``. Each phase from the
        agent generation workflow becomes one item, in canonical order
        (discovery → architecture → generation → validation →
        installation), so the user sees exactly five rows that tick from
        pending → in_progress → completed as the workflow advances.

        Status mapping:

        - ``pending`` (phase has not started) → ``pending``
        - ``running`` (phase is in flight)   → ``in_progress``
        - ``completed`` (phase finished)     → ``completed``
        - ``skipped`` (phase deliberately skipped) → ``completed``
          (a skipped phase is "done" from the workflow's perspective)
        - ``failed`` → ``in_progress`` (kept active so the user sees
          it as the current row that needs attention; the failure
          appears in ``activeForm`` text)

        Content shape:

        - ``content``: imperative noun phrase shown when the item is
          ``pending`` / ``completed``, with the per-phase percentage
          appended in brackets (e.g. ``"Discovery [60%]"``).
        - ``activeForm``: present-participle phrase shown when the item
          is ``in_progress``, also with the percentage appended.

        Returns:
            List of TodoWrite item dicts in workflow order. Empty list
            when no tracking is active.
        """
        if self._state is None:
            return []

        items: list[dict[str, str]] = []
        for phase in _TODOWRITE_PHASE_ORDER:
            phase_progress = self._state.phases.get(phase.phase_name)
            if phase_progress is None:
                continue
            items.append(_phase_to_todowrite_item(phase, phase_progress))
        return items

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

    def _recalculate_phase_progress(self, phase_name: str) -> None:
        """Recalculate phase progress from subtasks."""
        if self._state is None or phase_name not in self._state.phases:
            return

        phase = self._state.phases[phase_name]
        if not phase.subtasks:
            return

        total_weight = sum(s.weight for s in phase.subtasks)
        if total_weight == 0:
            return

        completed_weight = sum(s.weight * s.progress_percent / 100 for s in phase.subtasks)

        phase.progress_percent = int(completed_weight / total_weight * 100)

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
        except OSError:
            pass

    def _notify(self) -> None:
        """Notify progress callback."""
        if self.on_progress and self._state:
            self.on_progress(self._state)

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
                    "subtasks": [
                        {
                            "name": s.name,
                            "weight": s.weight,
                            "started_at": s.started_at,
                            "completed_at": s.completed_at,
                            "progress_percent": s.progress_percent,
                            "status": s.status,
                            "message": s.message,
                        }
                        for s in p.subtasks
                    ],
                }
                for name, p in state.phases.items()
            },
            "eta_seconds": state.eta_seconds,
            "elapsed_seconds": state.elapsed_seconds,
            "status": state.status,
            "error_message": state.error_message,
        }

    def _deserialize_state(self, data: dict[str, Any]) -> ProgressState:
        """Deserialize progress state from dict."""
        phases = {}
        for name, p_data in data.get("phases", {}).items():
            subtasks = [
                SubTask(
                    name=s["name"],
                    weight=s["weight"],
                    started_at=s["started_at"],
                    completed_at=s.get("completed_at"),
                    progress_percent=s.get("progress_percent", 0),
                    status=s.get("status", "pending"),
                    message=s.get("message", ""),
                )
                for s in p_data.get("subtasks", [])
            ]
            phases[name] = PhaseProgress(
                phase=p_data["phase"],
                started_at=p_data["started_at"],
                completed_at=p_data.get("completed_at"),
                progress_percent=p_data.get("progress_percent", 0),
                subtasks=subtasks,
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

    def _render_compact(self) -> str:
        """Render compact progress line."""
        if self._state is None:
            return ""

        bar = ProgressDisplay.render_progress_bar(self._state.overall_percent, width=20)
        elapsed = ProgressDisplay.format_duration(self._state.elapsed_seconds)
        eta = ProgressDisplay.format_eta(self._state.eta_seconds)

        return f"{self._state.task_name}: {bar} | {elapsed} | {eta}"

    def _render_full(self) -> str:
        """Render full progress display."""
        if self._state is None:
            return ""

        lines = []
        lines.append(f"\n{'=' * 60}")
        lines.append(f"  {self._state.task_name}")
        lines.append(f"{'=' * 60}\n")

        # Overall progress
        bar = ProgressDisplay.render_progress_bar(self._state.overall_percent)
        lines.append(f"Overall Progress: {bar}")
        lines.append("")

        # Phase details
        lines.append("Phases:")
        for phase in ProgressPhase:
            if phase.phase_name in self._state.phases:
                p = self._state.phases[phase.phase_name]
                status_line = ProgressDisplay.render_phase_status(
                    phase.phase_name,
                    p.status,
                    p.progress_percent,
                )
                lines.append(status_line)

                # Show subtasks for current phase
                if p.status == "running" and p.subtasks:
                    for subtask in p.subtasks:
                        icon = "✓" if subtask.status == "completed" else "○"
                        lines.append(f"      {icon} {subtask.name}")

        lines.append("")

        # Timing info
        elapsed = ProgressDisplay.format_duration(self._state.elapsed_seconds)
        lines.append(f"Elapsed: {elapsed}")

        if self._state.status == "running":
            eta = ProgressDisplay.format_eta(self._state.eta_seconds)
            lines.append(f"ETA: {eta}")

        if self._state.error_message:
            lines.append(f"\nError: {self._state.error_message}")

        lines.append("")
        return "\n".join(lines)


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Progress tracking and display for agent generation"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Start command
    start_parser = subparsers.add_parser("start", help="Start tracking a task")
    start_parser.add_argument("task_name", help="Name of the task")

    # Update command
    update_parser = subparsers.add_parser("update", help="Update progress")
    update_parser.add_argument("--phase", required=True, help="Current phase")
    update_parser.add_argument("--percent", type=int, default=0, help="Progress percent")
    update_parser.add_argument("--message", default="", help="Status message")

    # Subtask command
    subtask_parser = subparsers.add_parser("subtask", help="Add a subtask")
    subtask_parser.add_argument("name", help="Subtask name")
    subtask_parser.add_argument("--weight", type=int, default=10, help="Weight percent")
    subtask_parser.add_argument("--complete", action="store_true", help="Mark as complete")

    # Complete command
    complete_parser = subparsers.add_parser("complete", help="Mark task complete")
    complete_parser.add_argument("--failed", action="store_true", help="Mark as failed")
    complete_parser.add_argument("--message", default="", help="Completion message")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show current progress")
    status_parser.add_argument("--compact", action="store_true", help="Compact output")
    status_parser.add_argument("--json", action="store_true", help="JSON output")

    # TodoWrite command — emits the current progress as a JSON list of
    # TodoWrite items so an orchestrator wrapper can pipe the output
    # straight into Claude Code's TodoWrite tool. This is the
    # integration point for showing per-phase progress to the user.
    subparsers.add_parser(
        "todowrite",
        help="Emit current progress as a JSON list of TodoWrite items",
    )

    # Demo command
    subparsers.add_parser("demo", help="Run demo progress display")

    args = parser.parse_args()
    tracker = ProgressTracker()

    if args.command == "start":
        state = tracker.start(args.task_name)
        print(f"Started tracking: {state.task_name}")

    elif args.command == "update":
        tracker.load_state()
        state = tracker.update_phase(args.phase, args.percent, args.message)
        print(tracker.render(compact=True))

    elif args.command == "subtask":
        tracker.load_state()
        if args.complete:
            tracker.complete_subtask(args.name)
            print(f"Completed subtask: {args.name}")
        else:
            subtask = tracker.add_subtask(args.name, args.weight)
            print(f"Added subtask: {subtask.name} (weight: {subtask.weight}%)")

    elif args.command == "complete":
        tracker.load_state()
        state = tracker.complete(success=not args.failed, message=args.message)
        print(tracker.render())

    elif args.command == "status":
        if tracker.load_state():
            if args.json:
                print(tracker.render_json())
            else:
                print(tracker.render(compact=args.compact))
        else:
            print("No active progress tracking.")

    elif args.command == "todowrite":
        # Print the JSON list to stdout. Empty array when no tracking
        # is active — callers can detect that without parsing.
        if tracker.load_state():
            print(json.dumps(tracker.to_todowrite_items(), indent=2))
        else:
            print("[]")

    elif args.command == "demo":
        # Run a demo progress display
        print("Running progress tracking demo...\n")
        tracker.start("Generating demo-agent")

        phases = [
            ("discovery", ["Parse description", "Research patterns", "Identify tools"]),
            ("architecture", ["Select pattern", "Design workflow", "Plan MCP"]),
            ("generation", ["Generate frontmatter", "Generate sections", "Generate examples"]),
            ("validation", ["Syntax check", "Security scan", "Quality score"]),
            ("installation", ["Write files", "Update registry"]),
        ]

        for phase_name, subtasks in phases:
            tracker.update_phase(phase_name, 0, f"Starting {phase_name}...")
            print(tracker.render(compact=True))

            for i, subtask_name in enumerate(subtasks):
                tracker.add_subtask(subtask_name, weight=100 // len(subtasks))
                time.sleep(0.3)
                tracker.complete_subtask(subtask_name)
                progress = int((i + 1) / len(subtasks) * 100)
                tracker.update_phase(phase_name, progress)
                print(f"\r{tracker.render(compact=True)}", end="", flush=True)

            print()

        tracker.complete()
        print(tracker.render())

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
