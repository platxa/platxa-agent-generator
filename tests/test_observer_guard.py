"""Tests for the 5-layer observer re-entrancy guard (Feature #61).

Verifies that each layer independently blocks recursive observer dispatch,
and that the composite guard correctly no-ops with a reason on stderr.
"""

from __future__ import annotations

import fcntl
import time
from pathlib import Path

import pytest

from platxa_agent_generator.observer_guard import (
    LAST_DISPATCH_FILENAME,
    LOCK_FILENAME,
    MIN_ELAPSED_SECONDS,
    OBSERVER_ACTIVE_ENV,
    OBSERVER_AGENT_NAME,
    check_observer_reentrancy,
    guard_and_report,
    record_dispatch,
    release_dispatch_lock,
)


class TestLayer1EnvVar:
    """Layer 1: PLATXA_OBSERVER_ACTIVE env var blocks re-entry."""

    def test_blocks_when_env_set(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Observer dispatch blocked when PLATXA_OBSERVER_ACTIVE=1."""
        monkeypatch.setenv(OBSERVER_ACTIVE_ENV, "1")
        reason = check_observer_reentrancy("some-agent", tmp_path)
        assert reason is not None
        assert "already active" in reason
        assert OBSERVER_ACTIVE_ENV in reason

    def test_allows_when_env_unset(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Observer dispatch allowed when env var is not set."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        reason = check_observer_reentrancy("some-agent", tmp_path)
        assert reason is None

    def test_allows_when_env_set_to_zero(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Only value '1' blocks; '0' or other values do not."""
        monkeypatch.setenv(OBSERVER_ACTIVE_ENV, "0")
        reason = check_observer_reentrancy("some-agent", tmp_path)
        assert reason is None


class TestLayer2Lockfile:
    """Layer 2: Lockfile prevents concurrent observer instances."""

    def test_blocks_when_lock_held(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Observer dispatch blocked when .observer.lock is already held."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        lock_path = tmp_path / LOCK_FILENAME
        fd = open(lock_path, "w")
        fcntl.flock(fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            reason = check_observer_reentrancy("some-agent", tmp_path)
            assert reason is not None
            assert "lock held" in reason
        finally:
            fcntl.flock(fd.fileno(), fcntl.LOCK_UN)
            fd.close()

    def test_allows_when_lock_free(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Observer dispatch allowed when no lock is held."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        reason = check_observer_reentrancy("some-agent", tmp_path)
        assert reason is None


class TestLayer3StopHookActive:
    """Layer 3: stop_hook_active flag in payload blocks dispatch."""

    def test_blocks_when_flag_true(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Blocked when payload has stop_hook_active=true."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"stop_hook_active": True, "agent": "other-agent"}
        reason = check_observer_reentrancy("other-agent", tmp_path, payload)
        assert reason is not None
        assert "stop_hook_active" in reason

    def test_allows_when_flag_false(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Allowed when stop_hook_active is False or absent."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"stop_hook_active": False, "agent": "other-agent"}
        reason = check_observer_reentrancy("other-agent", tmp_path, payload)
        assert reason is None

    def test_allows_when_flag_absent(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Allowed when stop_hook_active key is missing."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": "other-agent"}
        reason = check_observer_reentrancy("other-agent", tmp_path, payload)
        assert reason is None


class TestLayer4TranscriptSource:
    """Layer 4: Block dispatch when observer triggered by itself."""

    def test_blocks_when_agent_is_observer(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Blocked when SubagentStop event came from observer-subagent."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": OBSERVER_AGENT_NAME}
        reason = check_observer_reentrancy(OBSERVER_AGENT_NAME, tmp_path, payload)
        assert reason is not None
        assert "triggered by self" in reason

    def test_allows_when_agent_is_other(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Allowed when SubagentStop came from a different agent."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": "validation-subagent"}
        reason = check_observer_reentrancy("validation-subagent", tmp_path, payload)
        assert reason is None

    def test_uses_agent_name_param_as_fallback(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """When payload.agent is empty, falls back to agent_name param."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": ""}
        reason = check_observer_reentrancy(OBSERVER_AGENT_NAME, tmp_path, payload)
        assert reason is not None
        assert "triggered by self" in reason


class TestLayer5MinElapsedTime:
    """Layer 5: Block if less than MIN_ELAPSED_SECONDS since last dispatch."""

    def test_blocks_when_dispatched_recently(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Blocked when last dispatch was less than 30s ago."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        ts_path = tmp_path / LAST_DISPATCH_FILENAME
        ts_path.write_text(str(time.time()), encoding="utf-8")
        payload = {"agent": "validation-subagent"}
        reason = check_observer_reentrancy("validation-subagent", tmp_path, payload)
        assert reason is not None
        assert "last dispatch" in reason
        assert f"< {MIN_ELAPSED_SECONDS}s" in reason

    def test_allows_when_enough_time_elapsed(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Allowed when last dispatch was more than 30s ago."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        ts_path = tmp_path / LAST_DISPATCH_FILENAME
        ts_path.write_text(str(time.time() - MIN_ELAPSED_SECONDS - 1), encoding="utf-8")
        payload = {"agent": "validation-subagent"}
        reason = check_observer_reentrancy("validation-subagent", tmp_path, payload)
        assert reason is None

    def test_allows_when_no_timestamp_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Allowed when .observer-last-dispatch does not exist (first run)."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": "validation-subagent"}
        reason = check_observer_reentrancy("validation-subagent", tmp_path, payload)
        assert reason is None


class TestRecordDispatch:
    """Tests for record_dispatch timestamp recording and lock acquisition."""

    def test_creates_timestamp_file(self, tmp_path: Path) -> None:
        """record_dispatch writes current timestamp to file."""
        fd = record_dispatch(tmp_path)
        try:
            ts_path = tmp_path / LAST_DISPATCH_FILENAME
            assert ts_path.exists()
            ts_value = float(ts_path.read_text(encoding="utf-8"))
            assert abs(ts_value - time.time()) < 2.0
        finally:
            release_dispatch_lock(fd)

    def test_creates_directory_if_missing(self, tmp_path: Path) -> None:
        """record_dispatch creates lock_dir if it doesn't exist."""
        nested = tmp_path / "deep" / "hooks"
        fd = record_dispatch(nested)
        try:
            assert (nested / LAST_DISPATCH_FILENAME).exists()
        finally:
            release_dispatch_lock(fd)

    def test_acquires_lockfile(self, tmp_path: Path) -> None:
        """record_dispatch holds .observer.lock so layer 2 blocks re-entry."""
        fd = record_dispatch(tmp_path)
        assert fd is not None
        try:
            reason = check_observer_reentrancy(
                "validation-subagent", tmp_path, {"agent": "validation-subagent"}
            )
            assert reason is not None
            assert "lock held" in reason
        finally:
            release_dispatch_lock(fd)

    def test_lock_released_after_release_call(self, tmp_path: Path) -> None:
        """After release_dispatch_lock, layer 2 no longer blocks."""
        fd = record_dispatch(tmp_path)
        release_dispatch_lock(fd)
        ts_path = tmp_path / LAST_DISPATCH_FILENAME
        ts_path.write_text(str(time.time() - MIN_ELAPSED_SECONDS - 1), encoding="utf-8")
        reason = check_observer_reentrancy(
            "validation-subagent", tmp_path, {"agent": "validation-subagent"}
        )
        assert reason is None


class TestGuardAndReport:
    """Tests for the convenience guard_and_report wrapper."""

    def test_returns_false_and_emits_stderr_when_blocked(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Recursive observer dispatch no-ops with reason in stderr."""
        monkeypatch.setenv(OBSERVER_ACTIVE_ENV, "1")
        result = guard_and_report(OBSERVER_AGENT_NAME, tmp_path)
        assert result is False
        captured = capsys.readouterr()
        assert "[observer-guard] blocked:" in captured.err
        assert "already active" in captured.err

    def test_returns_true_when_allowed(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Returns True when no layer blocks."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": "validation-subagent"}
        result = guard_and_report("validation-subagent", tmp_path, payload)
        assert result is True


class TestCompositeGuard:
    """Integration tests verifying multi-layer interaction."""

    def test_first_blocking_layer_wins(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """When multiple layers would block, the first one's reason is returned."""
        monkeypatch.setenv(OBSERVER_ACTIVE_ENV, "1")
        payload = {"agent": OBSERVER_AGENT_NAME, "stop_hook_active": True}
        reason = check_observer_reentrancy(OBSERVER_AGENT_NAME, tmp_path, payload)
        assert reason is not None
        assert "already active" in reason

    def test_recursive_dispatch_noop_with_stderr(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Recursive observer dispatch in test fixture: second invocation no-ops with reason in stderr."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)

        payload_first = {"agent": "validation-subagent"}
        result_first = guard_and_report("validation-subagent", tmp_path, payload_first)
        assert result_first is True

        fd = record_dispatch(tmp_path)
        try:
            payload_second = {"agent": "validation-subagent"}
            result_second = guard_and_report("validation-subagent", tmp_path, payload_second)
            assert result_second is False
            captured = capsys.readouterr()
            assert "[observer-guard] blocked:" in captured.err
        finally:
            release_dispatch_lock(fd)

    def test_full_reentrancy_scenario(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Simulate observer finishing and its SubagentStop trying to re-dispatch."""
        monkeypatch.delenv(OBSERVER_ACTIVE_ENV, raising=False)
        payload = {"agent": OBSERVER_AGENT_NAME, "event": "SubagentStop"}
        result = guard_and_report(OBSERVER_AGENT_NAME, tmp_path, payload)
        assert result is False
        captured = capsys.readouterr()
        assert "triggered by self" in captured.err
