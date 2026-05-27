"""State persistence and checkpoint tests for the learning bridge.

Covers round-trip serialization of SessionState and checkpoint phase
validation.  Template-based hook tests (instinct injection, progress
restoration, workflow state resume) were removed when the corresponding
generate_session_start_context_script() template function moved to
skills/platxa-agent-generator/references/hooks-config-templates.md.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from platxa_agent_generator.state_persistence import (
    CHECKPOINT_PHASES,
    SessionState,
    StateMetadata,
    StatePersistence,
    save_checkpoint,
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
        state = SessionState(metadata=StateMetadata(session_id="v2"))
        with pytest.raises(ValueError, match="Unknown checkpoint phase"):
            save_checkpoint(state, "not-a-real-phase")
