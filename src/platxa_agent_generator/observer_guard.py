"""5-layer re-entrancy guard for the observer subagent.

Prevents exponential blow-up from observer triggering observer by checking
five independent conditions in order. First block wins — the reason string
is emitted on stderr and dispatch is skipped.

Layers:
    1. Env var PLATXA_OBSERVER_ACTIVE — set by the dispatch script before
       spawning the observer, checked on re-entry.
    2. Lockfile — non-blocking flock try on .observer.lock. If held,
       another observer instance is already running.
    3. stop_hook_active flag — if the hook payload contains this flag,
       a parent hook is already executing.
    4. Transcript source — if the SubagentStop event was fired by the
       observer itself, short-circuit.
    5. Min elapsed time — if less than 30 seconds since the last
       observer dispatch, skip to avoid rapid-fire re-dispatch.
"""

from __future__ import annotations

import fcntl
import os
import sys
import time
from pathlib import Path

OBSERVER_ACTIVE_ENV = "PLATXA_OBSERVER_ACTIVE"
OBSERVER_AGENT_NAME = "observer-subagent"
MIN_ELAPSED_SECONDS = 30
LOCK_FILENAME = ".observer.lock"
LAST_DISPATCH_FILENAME = ".observer-last-dispatch"


def check_observer_reentrancy(
    agent_name: str,
    lock_dir: Path,
    payload: dict | None = None,
) -> str | None:
    """Check all 5 re-entrancy layers. Returns reason if blocked, None if allowed.

    Args:
        agent_name: The agent name from the SubagentStop payload (the agent
            that just finished, NOT necessarily the observer).
        lock_dir: Directory for lockfile and timestamp file (typically
            ``.claude/hooks/``).
        payload: Parsed JSON payload from the SubagentStop hook stdin.
            If None, only env-var and lockfile layers are checked.

    Returns:
        None if observer dispatch is allowed, or a human-readable reason
        string explaining which layer blocked and why.
    """
    if payload is None:
        payload = {}

    reason = _check_env_var()
    if reason:
        return reason

    reason = _check_lockfile(lock_dir)
    if reason:
        return reason

    reason = _check_stop_hook_active(payload)
    if reason:
        return reason

    reason = _check_transcript_source(agent_name, payload)
    if reason:
        return reason

    reason = _check_min_elapsed(lock_dir)
    if reason:
        return reason

    return None


def record_dispatch(lock_dir: Path) -> int | None:
    """Record the current time and acquire the observer lock.

    Called immediately before dispatching the observer. Writes the
    timestamp file for layer 5 and acquires the lockfile for layer 2.
    The lock fd is intentionally kept open — it releases when the
    calling process exits (or when ``release_dispatch_lock`` is called).

    Returns the lock fd (for explicit release in tests), or None if
    lock acquisition failed (should not happen if guard passed).
    """
    lock_dir.mkdir(parents=True, exist_ok=True)
    ts_path = lock_dir / LAST_DISPATCH_FILENAME
    ts_path.write_text(str(time.time()), encoding="utf-8")

    lock_path = lock_dir / LOCK_FILENAME
    try:
        fd = os.open(str(lock_path), os.O_RDWR | os.O_CREAT)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        os.write(fd, f"{os.getpid()}\n{time.time()}\n".encode())
        return fd
    except (IOError, OSError):
        return None


def release_dispatch_lock(fd: int | None) -> None:
    """Release a lock fd returned by record_dispatch."""
    if fd is not None:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)
        except (IOError, OSError):
            pass


def _check_env_var() -> str | None:
    """Layer 1: Check if PLATXA_OBSERVER_ACTIVE is set."""
    if os.environ.get(OBSERVER_ACTIVE_ENV) == "1":
        return f"observer already active (env {OBSERVER_ACTIVE_ENV}=1)"
    return None


def _check_lockfile(lock_dir: Path) -> str | None:
    """Layer 2: Try non-blocking lock acquisition via direct flock."""
    lock_path = lock_dir / LOCK_FILENAME
    lock_dir.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(lock_path), os.O_RDWR | os.O_CREAT)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fcntl.flock(fd, fcntl.LOCK_UN)
            return None
        except (IOError, OSError):
            pid = _read_lock_pid(lock_path)
            pid_info = f" by PID {pid}" if pid else ""
            return f"observer lock held{pid_info}"
        finally:
            os.close(fd)
    except OSError as exc:
        return f"lock infrastructure unavailable: {exc}"


def _check_stop_hook_active(payload: dict) -> str | None:
    """Layer 3: Check for stop_hook_active flag in payload."""
    if payload.get("stop_hook_active") is True:
        return "stop_hook_active set in payload"
    return None


def _check_transcript_source(agent_name: str, payload: dict) -> str | None:
    """Layer 4: Block if the SubagentStop was fired by the observer itself."""
    source_agent = payload.get("agent", "") or agent_name
    if source_agent == OBSERVER_AGENT_NAME:
        return f"observer triggered by self ({source_agent})"
    return None


def _check_min_elapsed(lock_dir: Path) -> str | None:
    """Layer 5: Block if less than MIN_ELAPSED_SECONDS since last dispatch."""
    ts_path = lock_dir / LAST_DISPATCH_FILENAME
    try:
        last_ts = float(ts_path.read_text(encoding="utf-8").strip())
    except (FileNotFoundError, ValueError, OSError):
        return None

    elapsed = time.time() - last_ts
    if elapsed < MIN_ELAPSED_SECONDS:
        return f"last dispatch {elapsed:.1f}s ago (< {MIN_ELAPSED_SECONDS}s minimum)"
    return None


def _read_lock_pid(lock_path: Path) -> str | None:
    """Read PID from lock file content (written by FileLock.acquire)."""
    try:
        content = lock_path.read_text(encoding="utf-8")
        first_line = content.split("\n", 1)[0].strip()
        if first_line.isdigit():
            return first_line
    except (OSError, ValueError):
        pass
    return None


def guard_and_report(
    agent_name: str,
    lock_dir: Path,
    payload: dict | None = None,
) -> bool:
    """Run the guard and emit reason to stderr if blocked.

    Convenience wrapper for use in generated hook scripts. Returns True
    if dispatch is allowed, False if blocked.
    """
    reason = check_observer_reentrancy(agent_name, lock_dir, payload)
    if reason:
        sys.stderr.write(f"[observer-guard] blocked: {reason}\n")
        return False
    return True
