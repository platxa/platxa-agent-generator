"""Characterization tests for ProgressTracker ETA calculation.

These tests lock down the current behavior of ``_calculate_eta`` and the
``_calculate_overall_progress`` history bookkeeping before the
``progress_tracker.py`` reduction in feature #24, so the refactor cannot
silently change ETA math while we remove rendering and event-notification
code around it.

The ETA contract being pinned:

* History is a sliding window of ``(monotonic_time, overall_percent)``
  pairs, capped at the last 20 entries.
* ``_calculate_eta`` is ``None`` whenever ``len(history) < 2``, when the
  percentage has not advanced, or when no time has elapsed between the
  first and last history points.
* When progress is advancing, ``eta_seconds`` is
  ``(100 - last_percent) / rate`` where
  ``rate = percent_diff / time_diff``.
* ``complete()`` sets ``eta_seconds`` to ``0`` unconditionally, regardless
  of history state.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from platxa_agent_generator import progress_tracker
from platxa_agent_generator.progress_tracker import ProgressTracker


@pytest.fixture
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    """Replace ``progress_tracker.time.time`` with a controllable clock.

    The returned single-element list holds the current time; mutate
    ``clock[0]`` between tracker operations to advance the clock. Every
    call to ``time.time()`` from within ``progress_tracker`` returns the
    current value (so multiple calls inside one ``update_phase`` see the
    same instant — matching real wall-clock behavior at sub-millisecond
    resolution).
    """
    clock = [0.0]
    monkeypatch.setattr(progress_tracker.time, "time", lambda: clock[0])
    return clock


class TestProgressTrackerETA:
    """Pin ``_calculate_eta`` behavior before the reduction refactor."""

    def test_eta_is_none_when_percent_has_not_advanced(
        self, tmp_path: Path, fixed_clock: list[float]
    ) -> None:
        """history = [(0, 0), (10, 0)] → percent_diff == 0 → ETA None."""
        tracker = ProgressTracker(state_file=tmp_path / "p.json")
        fixed_clock[0] = 0.0
        tracker.start("test")

        fixed_clock[0] = 10.0
        state = tracker.update_phase("discovery", 0)

        assert state.eta_seconds is None

    def test_eta_is_none_when_no_time_has_elapsed(
        self, tmp_path: Path, fixed_clock: list[float]
    ) -> None:
        """history = [(0, 0), (0, 10)] → time_diff == 0 → ETA None."""
        tracker = ProgressTracker(state_file=tmp_path / "p.json")
        fixed_clock[0] = 0.0
        tracker.start("test")

        state = tracker.update_phase("architecture", 50)

        assert state.eta_seconds is None

    def test_eta_is_positive_when_progress_is_advancing(
        self, tmp_path: Path, fixed_clock: list[float]
    ) -> None:
        """0% at t=0 → 20% at t=10 → rate 2 %/s, remaining 80 → ETA 40s.

        Drives the public API:

        * ``start()`` seeds history with ``(0, 0)``.
        * ``update_phase("discovery", 0)`` at t=0 adds ``(0, 0)`` and
          marks discovery as running with 0% progress.
        * ``update_phase("architecture", 0)`` at t=10 auto-completes
          discovery (weight 20 → total 20%), appending ``(10, 20)``.

        ``_calculate_eta`` reads first and last history points only, so
        ``time_diff=10``, ``percent_diff=20``, ``rate=2``,
        ``remaining=80``, ``eta=40.0``.
        """
        tracker = ProgressTracker(state_file=tmp_path / "p.json")
        fixed_clock[0] = 0.0
        tracker.start("test")
        tracker.update_phase("discovery", 0)

        fixed_clock[0] = 10.0
        state = tracker.update_phase("architecture", 0)

        assert state.eta_seconds == pytest.approx(40.0, abs=0.01)

    def test_history_is_capped_at_twenty_entries(
        self, tmp_path: Path, fixed_clock: list[float]
    ) -> None:
        """``_calculate_overall_progress`` keeps the last 20 history points."""
        tracker = ProgressTracker(state_file=tmp_path / "p.json")
        fixed_clock[0] = 0.0
        tracker.start("test")

        for i in range(25):
            fixed_clock[0] = float(i + 1)
            tracker.update_phase("discovery", min(100, i * 4))

        assert len(tracker._history) == 20

    def test_complete_sets_eta_to_zero(self, tmp_path: Path, fixed_clock: list[float]) -> None:
        """``complete()`` hard-resets ``eta_seconds`` to 0 regardless of history."""
        tracker = ProgressTracker(state_file=tmp_path / "p.json")
        fixed_clock[0] = 0.0
        tracker.start("test")

        state = tracker.complete()

        assert state.eta_seconds == 0
