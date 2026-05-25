"""Tests for team-lead orchestration patterns.

Covers the goal-loop state machine, iteration cap enforcement,
escalation on cap exhaustion, and completion-promise marker edge cases
(empty output, marker in middle, multiple markers, marker in code block).

Verification criteria for feature #75:

* All 4 completion-promise edge cases tested (empty, middle, multiple, code block)
* Goal loop transitions exercised via WorkflowState
* Iteration cap blocks retries when exhausted
* pytest tests/test_team_lead.py passes
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from platxa_agent_generator.hooks_generator import (
    generate_stop_hook_completion_check,
    generate_stop_hook_completion_check_config,
)
from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER
from platxa_agent_generator.workflow_state import WorkflowPhase, WorkflowState

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run_completion_script(
    tmp_path: Path,
    payload: dict,
    *,
    max_iterations: int = 5,
    agent_name: str = "team-lead",
) -> subprocess.CompletedProcess[str]:
    """Write the generated completion-check script and execute it."""
    script = generate_stop_hook_completion_check(agent_name, max_iterations)
    script_path = tmp_path / "completion-check.sh"
    script_path.write_text(script)
    script_path.chmod(0o755)
    return subprocess.run(
        ["bash", str(script_path)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(tmp_path),
        env=os.environ.copy(),
    )


# ===================================================================
# Goal loop — WorkflowState transition sequences
# ===================================================================


class TestGoalLoopTransitions:
    """Simulate the team-lead's VALIDATION → GENERATION retry loop."""

    def test_happy_path_no_retries(self) -> None:
        ws = WorkflowState(workflow_id="happy")
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.DISCOVERY
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.ARCHITECTURE
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.GENERATION
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.VALIDATION
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.INSTALLATION
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.LEARNING
        ok, _ = ws.advance()
        assert ok and ws.current_phase == WorkflowPhase.COMPLETE
        assert ws.is_complete()
        assert ws.retry_count == 0

    def test_single_retry_loop(self) -> None:
        ws = WorkflowState(workflow_id="retry1")
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION

        ok, _ = ws.transition_to(WorkflowPhase.GENERATION)
        assert ok
        assert ws.current_phase == WorkflowPhase.GENERATION
        assert ws.retry_count == 1

        ws.advance()  # → VALIDATION
        ws.advance()  # → INSTALLATION (pass this time)
        assert ws.current_phase == WorkflowPhase.INSTALLATION

    def test_multiple_retries_accumulate_count(self) -> None:
        ws = WorkflowState(workflow_id="multi", max_iterations=10)
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION

        for _ in range(3):
            ws.transition_to(WorkflowPhase.GENERATION)
            ws.advance()  # → VALIDATION
        assert ws.retry_count == 3

    @pytest.mark.parametrize("phase", [
        WorkflowPhase.DISCOVERY,
        WorkflowPhase.ARCHITECTURE,
        WorkflowPhase.GENERATION,
        WorkflowPhase.VALIDATION,
    ])
    def test_error_transition_from_any_phase(self, phase: WorkflowPhase) -> None:
        ws = WorkflowState(workflow_id=f"err-{phase.value}")
        ws.current_phase = phase
        ok, _ = ws.fail("something broke")
        assert ok
        assert ws.is_error()
        assert ws.error_message == "something broke"

    def test_reset_clears_retries_and_errors(self) -> None:
        ws = WorkflowState(workflow_id="reset")
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION
        ws.transition_to(WorkflowPhase.GENERATION)  # retry
        ws.fail("boom")

        ok, _ = ws.reset()
        assert ok
        assert ws.current_phase == WorkflowPhase.IDLE
        assert ws.retry_count == 0
        assert ws.error_message is None

    def test_progress_tracking(self) -> None:
        ws = WorkflowState(workflow_id="prog")
        completed, total = ws.get_progress()
        assert completed == 0
        assert total == 6  # 6 substantive phases

        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE (records DISCOVERY result)
        ws.advance()  # → GENERATION (records ARCHITECTURE result)
        completed, _ = ws.get_progress()
        assert completed == 2


# ===================================================================
# Iteration cap enforcement
# ===================================================================


class TestIterationCap:
    """WorkflowState must block retries when max_iterations is exhausted."""

    def test_retry_blocked_at_max_iterations(self) -> None:
        ws = WorkflowState(workflow_id="cap", max_iterations=2)
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION

        ws.transition_to(WorkflowPhase.GENERATION)  # retry 1
        ws.advance()  # → VALIDATION
        ws.transition_to(WorkflowPhase.GENERATION)  # retry 2
        ws.advance()  # → VALIDATION

        ok, msg = ws.transition_to(WorkflowPhase.GENERATION)
        assert not ok
        assert "Max iterations" in msg
        assert ws.current_phase == WorkflowPhase.VALIDATION

    def test_retry_allowed_below_cap(self) -> None:
        ws = WorkflowState(workflow_id="below", max_iterations=3)
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION

        ok, _ = ws.transition_to(WorkflowPhase.GENERATION)
        assert ok
        assert ws.retry_count == 1

    def test_cap_exact_boundary(self) -> None:
        ws = WorkflowState(workflow_id="boundary", max_iterations=1)
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION

        ws.transition_to(WorkflowPhase.GENERATION)  # retry 1
        ws.advance()  # → VALIDATION
        ok, _ = ws.transition_to(WorkflowPhase.GENERATION)
        assert not ok  # retry_count=1 >= max_iterations=1

    def test_default_max_iterations_is_five(self) -> None:
        ws = WorkflowState(workflow_id="defaults")
        assert ws.max_iterations == 5

    def test_max_iterations_serialized(self) -> None:
        ws = WorkflowState(workflow_id="ser", max_iterations=7)
        d = ws.to_dict()
        assert d["max_iterations"] == 7

        restored = WorkflowState.from_dict(d)
        assert restored.max_iterations == 7


# ===================================================================
# Escalation
# ===================================================================


class TestEscalation:
    """When iterations are exhausted, the system escalates (blocks further retries)."""

    def test_escalation_message_mentions_max(self) -> None:
        ws = WorkflowState(workflow_id="esc", max_iterations=1)
        ws.advance()  # → DISCOVERY
        ws.advance()  # → ARCHITECTURE
        ws.advance()  # → GENERATION
        ws.advance()  # → VALIDATION
        ws.transition_to(WorkflowPhase.GENERATION)  # use the one retry
        ws.advance()  # → VALIDATION

        ok, msg = ws.transition_to(WorkflowPhase.GENERATION)
        assert not ok
        assert "1" in msg  # max_iterations value appears

    def test_escalation_does_not_mutate_state(self) -> None:
        ws = WorkflowState(workflow_id="nomut", max_iterations=1)
        ws.advance()
        ws.advance()
        ws.advance()
        ws.advance()  # → VALIDATION
        ws.transition_to(WorkflowPhase.GENERATION)
        ws.advance()  # → VALIDATION

        retry_before = ws.retry_count
        phase_before = ws.current_phase
        ws.transition_to(WorkflowPhase.GENERATION)

        assert ws.retry_count == retry_before
        assert ws.current_phase == phase_before

    def test_can_still_advance_after_escalation(self) -> None:
        ws = WorkflowState(workflow_id="after", max_iterations=1)
        ws.advance()
        ws.advance()
        ws.advance()
        ws.advance()  # → VALIDATION
        ws.transition_to(WorkflowPhase.GENERATION)
        ws.advance()  # → VALIDATION

        ws.transition_to(WorkflowPhase.GENERATION)  # blocked
        ok, _ = ws.advance()  # → INSTALLATION (happy path still works)
        assert ok
        assert ws.current_phase == WorkflowPhase.INSTALLATION


# ===================================================================
# Completion-promise edge cases
# ===================================================================


class TestCompletionPromiseEdgeCases:
    """The 4 edge cases from feature #75's verification criteria.

    Each test runs the generated Stop-hook script via bash and checks
    the exit code against the regex-extract + byte-exact protocol.
    """

    def test_empty_output_blocks(self, tmp_path: Path) -> None:
        """Edge case 1: empty last_assistant_message → exit 2."""
        result = _run_completion_script(
            tmp_path,
            {"last_assistant_message": "", "current_iteration": 1},
        )
        assert result.returncode == 2

    def test_marker_in_middle_of_text_allows(self, tmp_path: Path) -> None:
        """Edge case 2: marker embedded in running text → exit 0."""
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": (
                    "I have finished all the work.\n\n"
                    f"{COMPLETION_PROMISE_MARKER}\n\n"
                    "Summary of changes:\n- Added tests\n- Fixed bugs"
                ),
                "current_iteration": 2,
            },
        )
        assert result.returncode == 0

    def test_multiple_markers_allows(self, tmp_path: Path) -> None:
        """Edge case 3: multiple <promise>COMPLETE</promise> markers → exit 0.

        The regex is non-greedy and finds the first match, so multiple
        markers must not confuse the script or cause a false negative.
        """
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": (
                    f"First marker: {COMPLETION_PROMISE_MARKER}\n"
                    f"Second marker: {COMPLETION_PROMISE_MARKER}\n"
                ),
                "current_iteration": 1,
            },
        )
        assert result.returncode == 0

    def test_marker_in_code_block_matches(self, tmp_path: Path) -> None:
        """Edge case 4: marker inside a markdown code block → exit 0.

        The regex extraction does not understand markdown structure, so
        a marker inside backticks still matches. This is the documented
        behavior: the matching protocol is purely regex-based, not
        AST-aware. Teams relying on this must avoid emitting the marker
        string inside code examples in their agent prompts.
        """
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": (
                    "Here is an example:\n\n"
                    "```\n"
                    f"{COMPLETION_PROMISE_MARKER}\n"
                    "```\n"
                ),
                "current_iteration": 1,
            },
        )
        assert result.returncode == 0


class TestCompletionPromiseAdditional:
    """Additional completion-promise tests beyond the 4 required edge cases."""

    def test_wrong_inner_token_blocks(self, tmp_path: Path) -> None:
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": "<promise>DONE</promise>",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2

    def test_partial_marker_blocks(self, tmp_path: Path) -> None:
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": "<promise>COMPLE",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2

    def test_case_sensitive_token(self, tmp_path: Path) -> None:
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": "<promise>complete</promise>",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2

    def test_iteration_cap_overrides_missing_marker(self, tmp_path: Path) -> None:
        result = _run_completion_script(
            tmp_path,
            {
                "last_assistant_message": "No marker here.",
                "current_iteration": 5,
            },
            max_iterations=5,
        )
        assert result.returncode == 0
        assert "allowing termination" in result.stderr

    def test_marker_constant_value_is_stable(self) -> None:
        assert COMPLETION_PROMISE_MARKER == "<promise>COMPLETE</promise>"

    def test_config_structure(self) -> None:
        config = generate_stop_hook_completion_check_config(
            "team-lead", "/path/to/script.sh"
        )
        assert "Stop" in config
        hooks = config["Stop"][0]["hooks"]
        assert len(hooks) == 1
        assert hooks[0]["command"] == "/path/to/script.sh"

    def test_stop_hook_active_short_circuits(self, tmp_path: Path) -> None:
        result = _run_completion_script(
            tmp_path,
            {
                "stop_hook_active": True,
                "last_assistant_message": "No marker.",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 0
