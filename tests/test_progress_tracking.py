#!/usr/bin/env python3
"""
test_progress_tracking — sharded from test_generator.py.

Shards: 1 TestXxx classes.
Run with: pytest tests/test_progress_tracking.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestProgressTrackerTodoWrite:
    """Tests for TodoWrite integration in progress_tracker.py (feature #65).

    Covers:
    - to_todowrite_items returns one item per phase in canonical order
      (discovery → architecture → generation → validation → installation)
    - Empty tracker (no start() call) returns empty list
    - Status mapping: pending → pending, running → in_progress,
      completed → completed, skipped → completed, failed → in_progress
    - Per-phase progress percentage appears in both content and activeForm
    - All items have the three required keys (content, status, activeForm)
    - active label uses present-participle phrasing for in_progress items
    - _phase_to_todowrite_item is callable in isolation (no tracker needed)
    - CLI ``todowrite`` subcommand emits valid JSON list
    - CLI prints ``[]`` when no tracking state exists
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_returns_one_item_per_phase_in_canonical_order(self) -> None:
        """to_todowrite_items emits 5 items in DISCOVERY → INSTALLATION order."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    print(len(items))\n"
            "    for i in items:\n"
            "        print(i['content'].split(' [')[0])"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "5"
        assert lines[1:] == [
            "Discovery",
            "Architecture",
            "Generation",
            "Validation",
            "Installation",
        ]

    def test_empty_tracker_returns_empty_list(self) -> None:
        """to_todowrite_items returns [] when no start() call has happened."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    print(t.to_todowrite_items())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_running_phase_maps_to_in_progress(self) -> None:
        """A phase with status=running becomes status=in_progress."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    t.update_phase('generation', 50)\n"
            "    items = t.to_todowrite_items()\n"
            "    statuses = {i['content'].split(' [')[0]: i['status'] for i in items}\n"
            "    print(statuses['Generation'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "in_progress"

    def test_completed_phase_maps_to_completed(self) -> None:
        """Advancing past a phase marks it status=completed."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    t.update_phase('discovery', 100)\n"
            "    t.update_phase('architecture', 0)\n"
            "    items = t.to_todowrite_items()\n"
            "    statuses = {i['content'].split(' [')[0]: i['status'] for i in items}\n"
            "    print(statuses['Discovery'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "completed"

    def test_pending_phase_maps_to_pending(self) -> None:
        """Phases not yet started map to status=pending."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    print(all(i['status'] == 'pending' for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_phase_to_todowrite_item_skipped_maps_to_completed(self) -> None:
        """skipped phase status renders as completed (TodoWrite has no skipped)."""
        result = self._run_py(
            "from platxa_agent_generator.progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='discovery', started_at='', "
            "status='skipped', progress_percent=100)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.DISCOVERY, p)\n"
            "print(item['status'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "completed"

    def test_phase_to_todowrite_item_failed_maps_to_in_progress(self) -> None:
        """failed phase stays in_progress so the user sees it as the active row."""
        result = self._run_py(
            "from platxa_agent_generator.progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='generation', started_at='', "
            "status='failed', progress_percent=42)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.GENERATION, p)\n"
            "print(item['status'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "in_progress"

    def test_percentage_is_appended_to_both_labels(self) -> None:
        """[NN%] suffix appears on both content and activeForm."""
        result = self._run_py(
            "from platxa_agent_generator.progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='generation', started_at='', "
            "status='running', progress_percent=37)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.GENERATION, p)\n"
            "print(item['content'])\n"
            "print(item['activeForm'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "Generation [37%]",
            "Generating files [37%]",
        ]

    def test_all_items_have_required_keys(self) -> None:
        """Every emitted item has content, status, activeForm keys."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    keys = {'content', 'status', 'activeForm'}\n"
            "    print(all(set(i.keys()) == keys for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_cli_todowrite_emits_valid_json(self) -> None:
        """``todowrite`` subcommand writes a parseable JSON list of items."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
            # Start a tracker first using the CLI itself.
            subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "start", "demo"],
                capture_output=True,
                text=True,
                check=True,
                cwd=str(tmp_path),
            )
            result = subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "todowrite"],
                capture_output=True,
                text=True,
                check=False,
                cwd=str(tmp_path),
            )
            assert result.returncode == 0, result.stderr
            items = json.loads(result.stdout)
            assert len(items) == 5
            assert all("content" in i and "status" in i and "activeForm" in i for i in items)

    def test_cli_todowrite_prints_empty_list_when_no_state(self) -> None:
        """CLI prints ``[]`` when no tracking has been started."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
            result = subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "todowrite"],
                capture_output=True,
                text=True,
                check=False,
                cwd=tmp,
            )
            assert result.returncode == 0, result.stderr
            assert result.stdout.strip() == "[]"
