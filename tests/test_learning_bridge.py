"""Cross-session integration tests for the learning bridge.

Simulates the session lifecycle: write state → "kill process" (close
references) → restart (run SessionStart hook) → verify state recovery,
instinct injection, and progress log restoration in additionalContext.

Verification criteria for feature #76:

* End-to-end: write state → kill process → restart → assert state matches
* Assert instincts in additionalContext
* Assert progress in additionalContext
* Assert workflow state restoration on resume
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from platxa_agent_generator.hooks_generator import generate_session_start_context_script
from platxa_agent_generator.state_persistence import (
    CHECKPOINT_PHASES,
    SessionState,
    StateMetadata,
    StatePersistence,
    save_checkpoint,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_instinct(instincts_dir: Path, name: str, content: str) -> Path:
    """Write an instinct .md file under the instincts directory."""
    path = instincts_dir / f"{name}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def _write_progress(progress_path: Path, lines: list[str]) -> None:
    """Write progress log entries."""
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    progress_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _run_session_start(
    tmp_path: Path,
    *,
    instincts_dir: str = ".claude/instincts",
    progress_file: str = ".claude/claude-progress.txt",
    state_dir: str = ".",
    source: str = "startup",
    max_chars: int = 10000,
) -> subprocess.CompletedProcess[str]:
    """Generate and run the SessionStart hook script."""
    script = generate_session_start_context_script(
        agent_name="test-bridge",
        instincts_dir=instincts_dir,
        progress_file=progress_file,
        max_chars=max_chars,
        state_dir=state_dir,
    )
    script_path = tmp_path / "session-start.sh"
    script_path.write_text(script)
    script_path.chmod(0o755)

    payload = json.dumps({"source": source})
    return subprocess.run(
        ["bash", str(script_path)],
        input=payload,
        capture_output=True,
        text=True,
        cwd=str(tmp_path),
        env=os.environ.copy(),
    )


# ===================================================================
# State persistence round-trip
# ===================================================================


class TestStatePersistenceRoundTrip:
    """Write state → close → reload → verify fields match."""

    def test_save_and_load_preserves_phase(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s1", agent_name="my-agent"),
            workflow_phase="generation",
        )
        assert sp.save(state)

        loaded = sp.load()
        assert loaded is not None
        assert loaded.workflow_phase == "generation"
        assert loaded.metadata.agent_name == "my-agent"

    def test_save_and_load_preserves_checkpoints(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s2"),
            workflow_phase="validation",
        )
        save_checkpoint(state, "discovery", {"domain": "code-review"})
        save_checkpoint(state, "architecture", {"pattern": "orchestrator"})
        assert sp.save(state)

        loaded = sp.load()
        assert loaded is not None
        assert len(loaded.checkpoints) == 2
        assert loaded.checkpoints[0].phase == "discovery"
        assert loaded.checkpoints[0].phase_data == {"domain": "code-review"}
        assert loaded.checkpoints[1].phase == "architecture"

    def test_save_and_load_preserves_workflow_data(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s3"),
            workflow_phase="generation",
            workflow_data={"agent_type": "reviewer", "tools": ["Read", "Grep"]},
        )
        assert sp.save(state)

        loaded = sp.load()
        assert loaded is not None
        assert loaded.workflow_data["agent_type"] == "reviewer"
        assert loaded.workflow_data["tools"] == ["Read", "Grep"]

    def test_missing_state_returns_none(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        assert sp.load() is None


# ===================================================================
# Instinct injection via SessionStart hook
# ===================================================================


class TestInstinctInjection:
    """Instinct .md files appear in additionalContext output."""

    def test_single_instinct_in_output(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(
            instincts_dir,
            "grep-first",
            (
                "---\nname: grep-first\ndescription: Always grep before reading\n---\n\n"
                "# grep-first\n\nUse grep to locate symbols.\n"
            ),
        )
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
        )
        assert result.returncode == 0
        assert "grep-first" in result.stdout
        assert "Use grep to locate symbols" in result.stdout
        assert "[instincts]" in result.stdout

    def test_multiple_instincts_sorted(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "z-last", "Z instinct content")
        _write_instinct(instincts_dir, "a-first", "A instinct content")
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
        )
        assert result.returncode == 0
        a_pos = result.stdout.index("A instinct content")
        z_pos = result.stdout.index("Z instinct content")
        assert a_pos < z_pos

    def test_no_instincts_no_output(self, tmp_path: Path) -> None:
        result = _run_session_start(tmp_path)
        assert result.returncode == 0
        assert result.stdout.strip() == ""

    def test_instincts_in_subdirectories(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        sub = instincts_dir / "patterns"
        sub.mkdir(parents=True)
        (sub / "deep.md").write_text("Deep nested instinct", encoding="utf-8")
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
        )
        assert result.returncode == 0
        assert "Deep nested instinct" in result.stdout


# ===================================================================
# Progress log restoration
# ===================================================================


class TestProgressLogRestoration:
    """Progress file content appears in additionalContext."""

    def test_progress_in_output(self, tmp_path: Path) -> None:
        progress_path = tmp_path / ".claude" / "claude-progress.txt"
        _write_progress(
            progress_path,
            [
                "PROGRESS Phase 1: Discovery completed",
                "PROGRESS Phase 2: Architecture designed",
            ],
        )
        result = _run_session_start(
            tmp_path,
            progress_file=str(progress_path),
        )
        assert result.returncode == 0
        assert "[progress]" in result.stdout
        assert "Discovery completed" in result.stdout

    def test_missing_progress_file_still_works(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "test", "test content")
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            progress_file=str(tmp_path / "nonexistent.txt"),
        )
        assert result.returncode == 0
        assert "[instincts]" in result.stdout

    def test_combined_instincts_and_progress(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "my-rule", "Rule content here")
        progress_path = tmp_path / ".claude" / "claude-progress.txt"
        _write_progress(progress_path, ["PROGRESS: feature #42 started"])
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            progress_file=str(progress_path),
        )
        assert result.returncode == 0
        assert "[instincts]" in result.stdout
        assert "[progress]" in result.stdout
        assert "Rule content here" in result.stdout
        assert "feature #42" in result.stdout


# ===================================================================
# Workflow state restoration on resume
# ===================================================================


class TestWorkflowStateResumeRestoration:
    """On source=resume, workflow state section appears in output."""

    def test_resume_includes_workflow_state_section(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s-resume", agent_name="gen-agent"),
            workflow_phase="generation",
        )
        save_checkpoint(state, "discovery", {"domain": "testing"})
        save_checkpoint(state, "architecture", {"pattern": "chain"})
        sp.save(state)

        result = _run_session_start(
            tmp_path,
            state_dir=str(tmp_path),
            source="resume",
        )
        assert result.returncode == 0
        assert "[workflow-state]" in result.stdout
        assert "generation" in result.stdout
        assert "Agent: gen-agent" in result.stdout

    def test_resume_shows_completed_phases(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s-phases"),
            workflow_phase="validation",
        )
        save_checkpoint(state, "discovery")
        save_checkpoint(state, "architecture")
        save_checkpoint(state, "generation")
        sp.save(state)

        result = _run_session_start(
            tmp_path,
            state_dir=str(tmp_path),
            source="resume",
        )
        assert result.returncode == 0
        assert "discovery" in result.stdout
        assert "architecture" in result.stdout
        assert "generation" in result.stdout

    def test_resume_shows_next_phase(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s-next"),
            workflow_phase="architecture",
        )
        save_checkpoint(state, "discovery")
        sp.save(state)

        result = _run_session_start(
            tmp_path,
            state_dir=str(tmp_path),
            source="resume",
        )
        assert result.returncode == 0
        assert "architecture" in result.stdout

    def test_startup_source_skips_workflow_state(self, tmp_path: Path) -> None:
        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="s-startup"),
            workflow_phase="generation",
        )
        sp.save(state)

        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "dummy", "filler")

        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            state_dir=str(tmp_path),
            source="startup",
        )
        assert result.returncode == 0
        assert "[workflow-state]" not in result.stdout

    def test_no_state_file_on_resume_still_works(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "fallback", "fallback content")
        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            state_dir=str(tmp_path),
            source="resume",
        )
        assert result.returncode == 0
        assert "[workflow-state]" not in result.stdout
        assert "fallback content" in result.stdout


# ===================================================================
# End-to-end: write → kill → restart → verify
# ===================================================================


class TestEndToEndSessionBridge:
    """Full lifecycle: write all state, then verify recovery via hook."""

    def test_full_lifecycle(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(
            instincts_dir,
            "prefer-grep",
            (
                "---\nname: prefer-grep\n"
                "description: Use grep before reading full files\n---\n\n"
                "Always grep first.\n"
            ),
        )
        _write_instinct(
            instincts_dir,
            "test-first",
            (
                "---\nname: test-first\n"
                "description: Write tests before implementation\n---\n\n"
                "Red-green-refactor.\n"
            ),
        )

        progress_path = tmp_path / ".claude" / "claude-progress.txt"
        _write_progress(
            progress_path,
            [
                "PROGRESS Phase 1: Discovery — identified 5 key files",
                "PROGRESS Phase 2: Architecture — chose orchestrator pattern",
                "PROGRESS Phase 3: Implementation — 3/5 files written",
            ],
        )

        sp = StatePersistence(base_dir=tmp_path)
        sp.initialize()
        state = SessionState(
            metadata=StateMetadata(session_id="e2e-1", agent_name="code-reviewer"),
            workflow_phase="generation",
            workflow_data={"pattern": "orchestrator-workers", "tools": ["Read", "Grep"]},
        )
        save_checkpoint(state, "discovery", {"files": ["src/main.py"]})
        save_checkpoint(state, "architecture", {"pattern": "orchestrator"})
        sp.save(state)

        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            progress_file=str(progress_path),
            state_dir=str(tmp_path),
            source="resume",
        )

        assert result.returncode == 0
        output = result.stdout

        assert "[workflow-state]" in output
        assert "generation" in output
        assert "code-reviewer" in output

        assert "[instincts]" in output
        assert "prefer-grep" in output
        assert "test-first" in output

        assert "[progress]" in output
        assert "Discovery" in output

    def test_truncation_preserves_instincts_over_progress(self, tmp_path: Path) -> None:
        instincts_dir = tmp_path / ".claude" / "instincts"
        _write_instinct(instincts_dir, "important", "IMPORTANT instinct content")

        progress_path = tmp_path / ".claude" / "claude-progress.txt"
        _write_progress(progress_path, ["x" * 500] * 20)

        result = _run_session_start(
            tmp_path,
            instincts_dir=str(instincts_dir),
            progress_file=str(progress_path),
            max_chars=500,
        )
        assert result.returncode == 0
        assert "IMPORTANT instinct content" in result.stdout


# ===================================================================
# Checkpoint phase validation
# ===================================================================


class TestCheckpointPhaseValidation:
    """Checkpoint phases are validated against the canonical list."""

    def test_valid_phases_accepted(self) -> None:
        state = SessionState(metadata=StateMetadata(session_id="v1"))
        for phase in CHECKPOINT_PHASES:
            save_checkpoint(state, phase)
        assert len(state.checkpoints) == len(CHECKPOINT_PHASES)

    def test_invalid_phase_rejected(self) -> None:
        import pytest

        state = SessionState(metadata=StateMetadata(session_id="v2"))
        with pytest.raises(ValueError, match="Unknown checkpoint phase"):
            save_checkpoint(state, "not-a-real-phase")
