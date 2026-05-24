#!/usr/bin/env python3
"""
test_state — sharded from test_generator.py.

Shards: 5 TestXxx classes.
Run with: pytest tests/test_state.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestStateCheckpointRecovery:
    """Tests for state_persistence checkpoint/resume (feature #74).

    Covers:
    - CHECKPOINT_PHASES tuple defines the canonical phase order
    - Checkpoint dataclass (phase, completed_at, phase_data)
    - SessionState.checkpoints defaults to empty list
    - save_checkpoint appends; rejects unknown phase with ValueError
    - save_checkpoint shallow-copies phase_data (caller mutations don't bleed)
    - latest_checkpoint returns last appended or None
    - resume_phase returns next phase, or None when none/finished
    - clear_checkpoints empties the list (restart path)
    - Round-trip through save/load preserves checkpoints
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

    def test_checkpoint_phases_constant(self) -> None:
        """CHECKPOINT_PHASES is a 6-tuple in execution order."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import CHECKPOINT_PHASES\nprint(CHECKPOINT_PHASES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "('discovery', 'architecture', 'generation', 'validation', 'installation', 'learning')"
        )

    def test_checkpoint_dataclass(self) -> None:
        """Checkpoint exposes phase, auto-set completed_at, default-empty phase_data."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import Checkpoint\n"
            "c = Checkpoint(phase='discovery')\n"
            "print(c.phase, type(c.completed_at).__name__, c.phase_data)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "discovery str {}"

    def test_session_state_checkpoints_defaults_empty(self) -> None:
        """SessionState.checkpoints defaults to []."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import SessionState, StateMetadata\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(s.checkpoints)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_save_checkpoint_appends(self) -> None:
        """save_checkpoint appends a Checkpoint with phase + phase_data."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "cp = save_checkpoint(s, 'discovery', {'agents_found': 3})\n"
            "print(len(s.checkpoints), cp.phase, cp.phase_data['agents_found'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 discovery 3"

    def test_save_checkpoint_rejects_unknown_phase(self) -> None:
        """Unknown phase → ValueError naming the bad phase."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "try:\n"
            "    save_checkpoint(s, 'bogus-phase', {})\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'bogus-phase' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_save_checkpoint_isolates_phase_data(self) -> None:
        """Caller mutating phase_data after the call must not affect the checkpoint."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "data = {'k': 1}\n"
            "save_checkpoint(s, 'discovery', data)\n"
            "data['k'] = 999\n"
            "print(s.checkpoints[0].phase_data['k'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1"

    def test_latest_checkpoint(self) -> None:
        """latest_checkpoint returns the last appended; None when empty."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, latest_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(latest_checkpoint(s))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "save_checkpoint(s, 'architecture', {})\n"
            "print(latest_checkpoint(s).phase)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["None", "architecture"]

    def test_resume_phase_returns_next(self) -> None:
        """After 'discovery' checkpoint, resume_phase returns 'architecture'."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, resume_phase\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "architecture"

    def test_resume_phase_none_when_no_checkpoints(self) -> None:
        """No checkpoints → resume_phase returns None (start fresh)."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import SessionState, StateMetadata, resume_phase\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "None"

    def test_resume_phase_none_when_complete(self) -> None:
        """Last phase reached → resume_phase returns None (workflow done)."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, resume_phase\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'learning', {})\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "None"

    def test_clear_checkpoints(self) -> None:
        """clear_checkpoints empties the list (restart path)."""
        result = self._run_py(
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, clear_checkpoints\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "save_checkpoint(s, 'architecture', {})\n"
            "clear_checkpoints(s)\n"
            "print(s.checkpoints)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_round_trip_serialization_preserves_checkpoints(self) -> None:
        """save → load preserves checkpoint phase + phase_data."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.state_persistence import (\n"
            "    SessionState, StateMetadata, StatePersistence, save_checkpoint\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    persistence = StatePersistence(base_dir=Path(td))\n"
            "    s = SessionState(metadata=StateMetadata(session_id='roundtrip'))\n"
            "    save_checkpoint(s, 'discovery', {'a': 1})\n"
            "    save_checkpoint(s, 'architecture', {'b': 2})\n"
            "    persistence.save(s)\n"
            "    loaded = persistence.load()\n"
            "    print(\n"
            "        len(loaded.checkpoints),\n"
            "        loaded.checkpoints[0].phase,\n"
            "        loaded.checkpoints[0].phase_data['a'],\n"
            "        loaded.checkpoints[1].phase,\n"
            "        loaded.checkpoints[1].phase_data['b'],\n"
            "    )"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 discovery 1 architecture 2"


class TestStatePersistenceErrorHandling:
    """Tests for state_persistence broad-except narrowing (Feature #10).

    The module used to wrap ``update``, ``add_generation_record``, ``reset``,
    and ``_log_error`` in ``except Exception``, conflating environmental
    failures (OSError, json.JSONDecodeError, ValueError, IntegrityError) with
    programmer errors (AttributeError, TypeError, KeyError) and silently
    returning ``False``. That swallowed real bugs.

    The fix:
    - Narrow the except clauses to the environmental exception set only.
    - Return a structured ``(bool, str | None)`` tuple from the public
      mutation methods so callers can surface the failure reason.
    - Let programmer-error exceptions propagate naturally.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_update_returns_structured_error(self) -> None:
        """update() must return (bool, str | None).

        On success: ``(True, None)``.
        On a caught environmental error: ``(False, error_msg)``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # Success path\n"
            "    r1 = p.update(workflow_phase='discovery')\n"
            "    print('success_shape:', isinstance(r1, tuple), len(r1))\n"
            "    print('success_values:', r1[0], r1[1])\n"
            "    # Caught error path: OSError in _write_state propagates\n"
            "    # through transaction().__exit__ and is swallowed by update()\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=OSError('disk full'),\n"
            "    ):\n"
            "        r2 = p.update(workflow_phase='generation')\n"
            "    print('fail_shape:', isinstance(r2, tuple), len(r2))\n"
            "    print('fail_values:', r2[0], 'disk full' in (r2[1] or ''))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "success_shape: True 2" in result.stdout
        assert "success_values: True None" in result.stdout
        assert "fail_shape: True 2" in result.stdout
        assert "fail_values: False True" in result.stdout

    def test_programmer_error_propagates(self) -> None:
        """AttributeError (programmer error) must propagate, not be swallowed.

        The old broad ``except Exception`` swallowed AttributeError and returned
        ``False``, hiding real bugs. The narrowed except must let it out.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=AttributeError('bad attr access'),\n"
            "    ):\n"
            "        try:\n"
            "            p.update(workflow_phase='discovery')\n"
            "            print('swallowed')\n"
            "        except AttributeError as e:\n"
            "            print('propagated:', str(e))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "propagated: bad attr access" in result.stdout

    def test_add_generation_record_returns_structured_error(self) -> None:
        """add_generation_record() must also return (bool, str | None)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.state_persistence import (\n"
            "    StatePersistence, GenerationRecord\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    rec = GenerationRecord(\n"
            "        agent_name='demo', description='d', pattern='chaining',\n"
            "        tools=[], generated_at='2026-04-20T00:00:00',\n"
            "        output_path='/tmp/x', success=True,\n"
            "    )\n"
            "    r1 = p.add_generation_record(rec)\n"
            "    print('success_shape:', isinstance(r1, tuple), len(r1))\n"
            "    print('success_values:', r1[0], r1[1])\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=OSError('io fail'),\n"
            "    ):\n"
            "        r2 = p.add_generation_record(rec)\n"
            "    print('fail_shape:', isinstance(r2, tuple), len(r2))\n"
            "    print('fail_values:', r2[0], 'io fail' in (r2[1] or ''))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "success_shape: True 2" in result.stdout
        assert "success_values: True None" in result.stdout
        assert "fail_shape: True 2" in result.stdout
        assert "fail_values: False True" in result.stdout

    def test_reset_returns_structured_error(self) -> None:
        """reset() must also return (bool, str | None)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    r = p.reset()\n"
            "    print('shape:', isinstance(r, tuple), len(r))\n"
            "    print('values:', r[0], r[1])\n"
        )
        assert result.returncode == 0, result.stderr
        assert "shape: True 2" in result.stdout
        assert "values: True None" in result.stdout


class TestStatePersistenceConfig:
    """Tests for get_config/set_config corruption semantics (Feature #11).

    Previously get_config() returned ``{}`` for both "file does not exist"
    and "file is corrupt JSON", so set_config() would cheerfully overwrite
    a corrupt config with a fresh empty-plus-update dict — erasing the
    operator's intent on top of whatever had damaged it. The fix:

    - get_config() still returns ``{}`` for missing file.
    - get_config() now raises ConfigCorruptError when the file exists but
      contains invalid JSON (or parses to a non-object root).
    - set_config() no longer catches that error, so an overwrite is refused
      until the operator repairs or deletes the file.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_missing_file_returns_empty(self) -> None:
        """When the config file does not exist, get_config() returns ``{}``."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # config_file is under base_dir and does not exist yet\n"
            "    print('exists_before:', p.config_file.exists())\n"
            "    cfg = p.get_config()\n"
            "    print('returned:', cfg)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "exists_before: False" in result.stdout
        assert "returned: {}" in result.stdout

    def test_corrupt_file_raises(self) -> None:
        """Corrupt JSON in the config file raises ConfigCorruptError.

        Includes coverage for the non-dict root case (JSON parses but is
        not an object) — both are forms of config corruption the caller
        must not silently inherit as an empty dict.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.state_persistence import StatePersistence, ConfigCorruptError\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # Case A: malformed JSON\n"
            "    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text('{not valid json', encoding='utf-8')\n"
            "    try:\n"
            "        p.get_config()\n"
            "        print('A: swallowed')\n"
            "    except ConfigCorruptError as e:\n"
            "        print('A: raised')\n"
            "        print('A_msg_has_path:', str(p.config_file) in str(e))\n"
            "    # Case B: valid JSON but non-object root\n"
            '    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text(\'["not", "a", "dict"]\', encoding=\'utf-8\')\n'
            "    try:\n"
            "        p.get_config()\n"
            "        print('B: swallowed')\n"
            "    except ConfigCorruptError as e:\n"
            "        print('B: raised')\n"
            "        print('B_msg_has_type:', 'list' in str(e))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "A: raised" in result.stdout
        assert "A_msg_has_path: True" in result.stdout
        assert "B: raised" in result.stdout
        assert "B_msg_has_type: True" in result.stdout

    def test_set_config_refuses_corrupt(self) -> None:
        """set_config() must refuse to overwrite a corrupt config file.

        The previous implementation caught the parse error inside
        get_config(), got ``{}`` back, merged kwargs into that empty dict,
        and wrote it out — destroying whatever was in the corrupt file.
        After the fix, the ConfigCorruptError propagates from get_config()
        out through set_config() and the original file bytes stay intact.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.state_persistence import StatePersistence, ConfigCorruptError\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    original = '{not valid json'\n"
            "    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text(original, encoding='utf-8')\n"
            "    try:\n"
            "        p.set_config(new_key='new_value')\n"
            "        print('set: allowed')\n"
            "    except ConfigCorruptError:\n"
            "        print('set: refused')\n"
            "    # Original bytes must be unchanged\n"
            "    print('unchanged:',\n"
            "          p.config_file.read_text(encoding='utf-8') == original)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "set: refused" in result.stdout
        assert "unchanged: True" in result.stdout


class TestStatePersistenceWriteSurfacing:
    """Tests for state_persistence write/lock/CLI surfacing (Feature #12).

    Three silent-failure sites were hiding real environmental problems:

    - ``_save_to_history`` swallowed OSError with ``pass``, so a full disk
      or read-only agents_dir would quietly drop per-agent history without
      the operator ever learning the write didn't happen. The fix emits a
      stderr warning naming the target path and the error class.

    - ``FileLock.release`` swallowed OSError on ``fcntl.flock(..., LOCK_UN)``
      so a lock that failed to release looked successful, and the next
      acquirer could spin until timeout without any explanation of why.
      The fix emits a stderr warning naming the lock path and the error.

    - The CLI ``config --set KEY VALUE`` path silently coerced
      non-JSON values to plain strings. Operators typing
      ``--set port 8080`` expected the int; typing ``--set greeting hello``
      expected the string. Silently deciding means the operator can't tell
      which branch ran. The fix emits a stderr notice when the JSON parse
      falls back to string storage.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_oserror_on_save_prints_stderr(self) -> None:
        """OSError inside ``_save_to_history`` must emit a stderr warning
        that names the target history file and the error class.

        The previous ``except (json.JSONDecodeError, OSError): pass``
        hid the failure entirely. Operators lost per-agent history with
        zero diagnostic. The fix emits a warning to stderr without
        changing the swallow-and-continue contract (history is
        best-effort; the state update in ``add_generation_record``
        already succeeded by the time ``_save_to_history`` runs).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.state_persistence import StatePersistence, GenerationRecord\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    rec = GenerationRecord(\n"
            "        agent_name='demo', description='d', pattern='chaining',\n"
            "        tools=[], generated_at='2026-04-20T00:00:00',\n"
            "        output_path='/tmp/x', success=True,\n"
            "    )\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('no space left'),\n"
            "    ):\n"
            "        p._save_to_history(rec)\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path (by agent name) and the error class.
        assert "demo.json" in result.stderr
        assert "OSError" in result.stderr
        assert "no space left" in result.stderr

    def test_lock_release_failure_warns(self) -> None:
        """Lock release failure (flock LOCK_UN raising OSError) must emit a
        stderr warning that names the lock path and the error.

        The previous ``except (IOError, OSError): pass`` made a failing
        unlock indistinguishable from a clean one, which is the worst
        failure mode for a lock primitive — the caller sees "released"
        but the kernel state disagrees. The fix surfaces the failure
        while preserving the swallow (release is called from cleanup
        paths that cannot raise).
        """
        result = self._run_py(
            "import tempfile\n"
            "import fcntl\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.state_persistence import FileLock\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    lock_path = Path(td) / 'test.lock'\n"
            "    lock = FileLock(lock_path)\n"
            "    assert lock.acquire(), 'acquire failed'\n"
            "    original_flock = fcntl.flock\n"
            "    def fake_flock(fd, op):\n"
            "        if op == fcntl.LOCK_UN:\n"
            "            raise OSError('unlock failed')\n"
            "        return original_flock(fd, op)\n"
            "    with patch('state_persistence.fcntl.flock', fake_flock):\n"
            "        lock.release()\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the lock path and the error class/message.
        assert "test.lock" in result.stderr
        assert "OSError" in result.stderr
        assert "unlock failed" in result.stderr

    def test_cli_set_json_fallback_notice(self) -> None:
        """CLI ``config --set KEY VALUE`` must emit a stderr notice when the
        VALUE fails JSON parse and is stored as a plain string.

        Previously the fallback was silent — ``--set port 8080`` stored
        the int 8080, ``--set port eight-thousand`` stored the string
        "eight-thousand", and the operator had no way to tell which
        branch ran for any given invocation. The fix emits a one-line
        notice when the JSONDecodeError is caught.
        """
        import tempfile

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        script = scripts_dir / "state_persistence.py"
        with tempfile.TemporaryDirectory() as td:
            # `set_config` writes to .claude/config/generator.json; the
            # directory must exist before the CLI runs or the write fails
            # with an unrelated OSError that masks the fallback-notice path.
            (Path(td) / ".claude" / "config").mkdir(parents=True, exist_ok=True)
            result = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "config",
                    "--set",
                    "mykey",
                    "not_json_value",
                ],
                capture_output=True,
                text=True,
                cwd=td,
                check=False,
            )
        assert result.returncode == 0, result.stderr
        # Notice must name the key and flag the fallback.
        assert "mykey" in result.stderr
        assert "string" in result.stderr.lower()
        # And the set still succeeded on stdout.
        assert "Set mykey" in result.stdout


class TestSilentWriteSurfacing:
    """Tests for bundled state-write OSError surfacing (Feature #14).

    Two state-persistence helpers had symmetric silent-failure sites that
    were hiding environmental problems:

    - ``extended_thinking.ThinkingIntegration._save_usage_history``
      swallowed OSError with ``pass`` when writing the per-task usage log.
      A full disk or a read-only ``.claude/`` meant the log silently
      stopped growing — the operator had no way to tell a healthy
      "no new records yet" from a broken "every write is dropping on
      the floor".

    - ``progress_tracker.ProgressTracker._save_state`` had the same
      pattern for the cross-phase progress checkpoint. Silent drops here
      meant a failed resume anchor looked identical to a fresh start,
      which is the worst failure mode for a resume-on-crash primitive.

    The fix emits a stderr warning that names the target path and the
    error class in both sites, without changing the swallow-and-continue
    contract (both writes are best-effort; the caller already holds the
    live in-memory record).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_extended_thinking_oserror(self) -> None:
        """OSError inside ``_save_usage_history`` must emit a stderr warning
        that names the target usage log path and the error class.

        The previous ``except OSError: pass`` hid disk-full / permissions
        failures entirely. Operators lost their thinking-usage log with
        zero diagnostic. The fix emits a warning to stderr without
        changing the swallow-and-continue contract (records are captured
        in-memory by the caller before save).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log_path = Path(td) / 'thinking_usage.json'\n"
            "    integ = ThinkingIntegration(usage_log_path=log_path)\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('no space left'),\n"
            "    ):\n"
            "        integ._save_usage_history()\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path and the error class/message.
        assert "thinking_usage.json" in result.stderr
        assert "OSError" in result.stderr
        assert "no space left" in result.stderr

    def test_progress_tracker_oserror(self) -> None:
        """OSError inside ``_save_state`` must emit a stderr warning that
        names the target state file and the error class.

        The previous ``except OSError: pass`` hid resume-anchor write
        failures — a crashed run could not be distinguished from a run
        that never persisted its checkpoint. The fix surfaces the failure
        while preserving the best-effort contract (the caller holds the
        live ProgressState).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from platxa_agent_generator.progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    state_path = Path(td) / 'progress.json'\n"
            "    tracker = ProgressTracker(state_file=state_path)\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('disk full'),\n"
            "    ):\n"
            "        tracker.start('demo-task')\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path and the error class/message.
        assert "progress.json" in result.stderr
        assert "OSError" in result.stderr
        assert "disk full" in result.stderr


class TestWorkflowTransitions:
    """Tests for WorkflowPhase enum and VALID_TRANSITIONS including LEARNING phase."""

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR),
            check=False,
        )
        return result

    def test_learning_phase_exists(self) -> None:
        """WorkflowPhase.LEARNING has value 'learning'."""
        result = self._run_py(
            "from platxa_agent_generator.workflow_state import WorkflowPhase\n"
            "print(WorkflowPhase.LEARNING.value)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "learning"

    def test_learning_phase_order(self) -> None:
        """LEARNING appears between INSTALLATION and COMPLETE in enum members."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.workflow_state import WorkflowPhase\n"
            "members = [m.value for m in WorkflowPhase]\n"
            "print(json.dumps(members))"
        )
        assert result.returncode == 0, result.stderr
        import json
        members = json.loads(result.stdout.strip())
        install_idx = members.index("installation")
        learning_idx = members.index("learning")
        complete_idx = members.index("complete")
        assert install_idx < learning_idx < complete_idx

    def test_installation_transitions_to_learning(self) -> None:
        """INSTALLATION can transition to LEARNING (not directly to COMPLETE)."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.workflow_state import WorkflowPhase, VALID_TRANSITIONS\n"
            "targets = [t.value for t in VALID_TRANSITIONS[WorkflowPhase.INSTALLATION]]\n"
            "print(json.dumps(targets))"
        )
        assert result.returncode == 0, result.stderr
        import json
        targets = json.loads(result.stdout.strip())
        assert "learning" in targets
        assert "complete" not in targets

    def test_learning_transitions_to_complete(self) -> None:
        """LEARNING can transition to COMPLETE or ERROR."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.workflow_state import WorkflowPhase, VALID_TRANSITIONS\n"
            "targets = [t.value for t in VALID_TRANSITIONS[WorkflowPhase.LEARNING]]\n"
            "print(json.dumps(targets))"
        )
        assert result.returncode == 0, result.stderr
        import json
        targets = json.loads(result.stdout.strip())
        assert "complete" in targets
        assert "error" in targets

    def test_all_phases_have_transitions(self) -> None:
        """Every WorkflowPhase member has an entry in VALID_TRANSITIONS."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.workflow_state import WorkflowPhase, VALID_TRANSITIONS\n"
            "missing = [p.value for p in WorkflowPhase if p not in VALID_TRANSITIONS]\n"
            "print(json.dumps(missing))"
        )
        assert result.returncode == 0, result.stderr
        import json
        assert json.loads(result.stdout.strip()) == []

    def test_checkpoint_phases_includes_learning(self) -> None:
        """CHECKPOINT_PHASES includes 'learning' after 'installation'."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.state_persistence import CHECKPOINT_PHASES\n"
            "print(json.dumps(list(CHECKPOINT_PHASES)))"
        )
        assert result.returncode == 0, result.stderr
        import json
        phases = json.loads(result.stdout.strip())
        install_idx = phases.index("installation")
        learning_idx = phases.index("learning")
        assert learning_idx == install_idx + 1
