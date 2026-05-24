#!/usr/bin/env python3
"""
Workflow State Machine

Manages state transitions through agent generation phases:
    IDLE → DISCOVERY → ARCHITECTURE → GENERATION → VALIDATION → INSTALLATION → LEARNING → COMPLETE

Features:
    - Type-safe state enum
    - Validated transitions
    - Phase artifact storage
    - JSON persistence for resume capability

Usage:
    python workflow_state.py new                    # Create new workflow
    python workflow_state.py status                 # Show current state
    python workflow_state.py transition <state>     # Advance to next state
    python workflow_state.py reset                  # Reset to IDLE
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class WorkflowPhase(Enum):
    """Agent generation workflow phases."""

    IDLE = "idle"
    DISCOVERY = "discovery"
    ARCHITECTURE = "architecture"
    GENERATION = "generation"
    VALIDATION = "validation"
    INSTALLATION = "installation"
    LEARNING = "learning"
    COMPLETE = "complete"
    ERROR = "error"


# Valid state transitions (from -> list of valid next states)
VALID_TRANSITIONS: dict[WorkflowPhase, list[WorkflowPhase]] = {
    WorkflowPhase.IDLE: [WorkflowPhase.DISCOVERY],
    WorkflowPhase.DISCOVERY: [WorkflowPhase.ARCHITECTURE, WorkflowPhase.ERROR],
    WorkflowPhase.ARCHITECTURE: [WorkflowPhase.GENERATION, WorkflowPhase.ERROR],
    WorkflowPhase.GENERATION: [WorkflowPhase.VALIDATION, WorkflowPhase.ERROR],
    WorkflowPhase.VALIDATION: [
        WorkflowPhase.INSTALLATION,
        WorkflowPhase.GENERATION,  # Retry on validation failure
        WorkflowPhase.ERROR,
    ],
    WorkflowPhase.INSTALLATION: [WorkflowPhase.LEARNING, WorkflowPhase.ERROR],
    WorkflowPhase.LEARNING: [WorkflowPhase.COMPLETE, WorkflowPhase.ERROR],
    WorkflowPhase.COMPLETE: [WorkflowPhase.IDLE],  # Can restart
    WorkflowPhase.ERROR: [WorkflowPhase.IDLE],  # Can restart after error
}


@dataclass
class PhaseResult:
    """Result from a workflow phase."""

    phase: str
    success: bool
    timestamp: str
    duration_ms: int = 0
    artifacts: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class WorkflowState:
    """
    Manages workflow state machine for agent generation.

    Tracks current phase, history, and artifacts from each phase.
    Supports persistence to JSON for resume capability.
    """

    workflow_id: str
    current_phase: WorkflowPhase = WorkflowPhase.IDLE
    agent_name: str | None = None
    agent_description: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    phase_results: dict[str, PhaseResult] = field(default_factory=dict)
    error_message: str | None = None

    def can_transition_to(self, target: WorkflowPhase) -> bool:
        """Check if transition to target phase is valid."""
        valid_next = VALID_TRANSITIONS.get(self.current_phase, [])
        return target in valid_next

    def get_valid_transitions(self) -> list[WorkflowPhase]:
        """Get list of valid next phases from current state."""
        return VALID_TRANSITIONS.get(self.current_phase, [])

    def transition_to(
        self,
        target: WorkflowPhase,
        artifacts: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> tuple[bool, str]:
        """
        Attempt to transition to target phase.

        Args:
            target: Target phase to transition to
            artifacts: Optional artifacts from current phase
            error: Optional error message if transitioning to ERROR

        Returns:
            Tuple of (success, message)
        """
        if not self.can_transition_to(target):
            valid = [p.value for p in self.get_valid_transitions()]
            return (
                False,
                f"Invalid transition: {self.current_phase.value} → {target.value}. Valid: {valid}",
            )

        # Record result for current phase before transitioning
        if self.current_phase != WorkflowPhase.IDLE:
            self.phase_results[self.current_phase.value] = PhaseResult(
                phase=self.current_phase.value,
                success=target != WorkflowPhase.ERROR,
                timestamp=datetime.now().isoformat(),
                artifacts=artifacts or {},
                error=error,
            )

        # Perform transition
        previous = self.current_phase
        self.current_phase = target
        self.updated_at = datetime.now().isoformat()

        if target == WorkflowPhase.ERROR:
            self.error_message = error

        return True, f"Transitioned: {previous.value} → {target.value}"

    def advance(self, artifacts: dict[str, Any] | None = None) -> tuple[bool, str]:
        """
        Advance to the next logical phase.

        Returns:
            Tuple of (success, message)
        """
        valid_next = self.get_valid_transitions()

        # Filter out ERROR - we don't auto-advance to error
        valid_next = [p for p in valid_next if p != WorkflowPhase.ERROR]

        if not valid_next:
            return False, f"No valid transitions from {self.current_phase.value}"

        # Take the first valid transition (the "happy path")
        return self.transition_to(valid_next[0], artifacts=artifacts)

    def fail(self, error: str) -> tuple[bool, str]:
        """
        Transition to ERROR state.

        Args:
            error: Error message describing the failure

        Returns:
            Tuple of (success, message)
        """
        return self.transition_to(WorkflowPhase.ERROR, error=error)

    def reset(self) -> tuple[bool, str]:
        """
        Reset workflow to IDLE state.

        Returns:
            Tuple of (success, message)
        """
        self.current_phase = WorkflowPhase.IDLE
        self.phase_results = {}
        self.error_message = None
        self.updated_at = datetime.now().isoformat()
        return True, "Workflow reset to IDLE"

    def is_complete(self) -> bool:
        """Check if workflow has completed successfully."""
        return self.current_phase == WorkflowPhase.COMPLETE

    def is_error(self) -> bool:
        """Check if workflow is in error state."""
        return self.current_phase == WorkflowPhase.ERROR

    def get_progress(self) -> tuple[int, int]:
        """
        Get progress as (completed_phases, total_phases).

        Returns:
            Tuple of (completed, total)
        """
        phases = [
            WorkflowPhase.DISCOVERY,
            WorkflowPhase.ARCHITECTURE,
            WorkflowPhase.GENERATION,
            WorkflowPhase.VALIDATION,
            WorkflowPhase.INSTALLATION,
            WorkflowPhase.LEARNING,
        ]
        completed = sum(1 for p in phases if p.value in self.phase_results)
        return completed, len(phases)

    def to_dict(self) -> dict[str, Any]:
        """Serialize state to dictionary."""
        return {
            "workflow_id": self.workflow_id,
            "current_phase": self.current_phase.value,
            "agent_name": self.agent_name,
            "agent_description": self.agent_description,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "phase_results": {
                k: {
                    "phase": v.phase,
                    "success": v.success,
                    "timestamp": v.timestamp,
                    "duration_ms": v.duration_ms,
                    "artifacts": v.artifacts,
                    "error": v.error,
                }
                for k, v in self.phase_results.items()
            },
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WorkflowState:
        """Deserialize state from dictionary."""
        state = cls(
            workflow_id=data["workflow_id"],
            current_phase=WorkflowPhase(data["current_phase"]),
            agent_name=data.get("agent_name"),
            agent_description=data.get("agent_description"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            error_message=data.get("error_message"),
        )

        # Restore phase results
        for phase_name, result_data in data.get("phase_results", {}).items():
            state.phase_results[phase_name] = PhaseResult(
                phase=result_data["phase"],
                success=result_data["success"],
                timestamp=result_data["timestamp"],
                duration_ms=result_data.get("duration_ms", 0),
                artifacts=result_data.get("artifacts", {}),
                error=result_data.get("error"),
            )

        return state

    def save(self, path: Path | str) -> bool:
        """
        Save state to JSON file.

        Args:
            path: Path to save state file

        Returns:
            True if saved successfully
        """
        try:
            path = Path(path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
            return True
        except OSError:
            return False

    @classmethod
    def load(cls, path: Path | str) -> WorkflowState | None:
        """
        Load state from JSON file.

        Args:
            path: Path to state file

        Returns:
            WorkflowState if loaded successfully, None otherwise
        """
        try:
            path = Path(path)
            if not path.exists():
                return None
            data = json.loads(path.read_text(encoding="utf-8"))
            return cls.from_dict(data)
        except (OSError, json.JSONDecodeError, KeyError, ValueError):
            return None


def create_workflow(
    agent_name: str | None = None, agent_description: str | None = None
) -> WorkflowState:
    """
    Create a new workflow state.

    Args:
        agent_name: Optional name for the agent being generated
        agent_description: Optional NLP description of the agent

    Returns:
        New WorkflowState instance
    """
    workflow_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    return WorkflowState(
        workflow_id=workflow_id,
        agent_name=agent_name,
        agent_description=agent_description,
    )


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Workflow state machine for agent generation")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # New workflow command
    new_parser = subparsers.add_parser("new", help="Create new workflow")
    new_parser.add_argument("--name", help="Agent name")
    new_parser.add_argument("--description", help="Agent description")
    new_parser.add_argument("--output", "-o", help="Output file path")
    new_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show workflow status")
    status_parser.add_argument("file", help="Workflow state file")
    status_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Transition command
    trans_parser = subparsers.add_parser("transition", help="Transition to next state")
    trans_parser.add_argument("file", help="Workflow state file")
    trans_parser.add_argument(
        "target",
        nargs="?",
        help="Target phase (or 'advance' for next logical phase)",
    )
    trans_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Reset command
    reset_parser = subparsers.add_parser("reset", help="Reset workflow to IDLE")
    reset_parser.add_argument("file", help="Workflow state file")
    reset_parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.command == "new":
        state = create_workflow(agent_name=args.name, agent_description=args.description)

        if args.output:
            state.save(args.output)

        if args.json:
            print(json.dumps(state.to_dict(), indent=2))
        else:
            print(f"✓ Created workflow: {state.workflow_id}")
            print(f"  Phase: {state.current_phase.value}")
            if args.output:
                print(f"  Saved: {args.output}")

    elif args.command == "status":
        state = WorkflowState.load(args.file)
        if state is None:
            print(f"✗ Could not load workflow from: {args.file}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(state.to_dict(), indent=2))
        else:
            completed, total = state.get_progress()
            print(f"Workflow: {state.workflow_id}")
            print(f"  Phase: {state.current_phase.value}")
            print(f"  Progress: {completed}/{total}")
            if state.agent_name:
                print(f"  Agent: {state.agent_name}")
            if state.error_message:
                print(f"  Error: {state.error_message}")
            valid = [p.value for p in state.get_valid_transitions()]
            if valid:
                print(f"  Next: {valid}")

    elif args.command == "transition":
        state = WorkflowState.load(args.file)
        if state is None:
            print(f"✗ Could not load workflow from: {args.file}", file=sys.stderr)
            sys.exit(1)

        if args.target is None or args.target == "advance":
            success, message = state.advance()
        else:
            try:
                target = WorkflowPhase(args.target)
            except ValueError:
                phases = [p.value for p in WorkflowPhase]
                print(f"✗ Invalid phase: {args.target}", file=sys.stderr)
                print(f"  Valid phases: {phases}", file=sys.stderr)
                sys.exit(1)
            success, message = state.transition_to(target)

        if success:
            state.save(args.file)

        if args.json:
            print(
                json.dumps(
                    {
                        "success": success,
                        "message": message,
                        "current_phase": state.current_phase.value,
                    },
                    indent=2,
                )
            )
        else:
            if success:
                print(f"✓ {message}")
            else:
                print(f"✗ {message}", file=sys.stderr)
                sys.exit(1)

    elif args.command == "reset":
        state = WorkflowState.load(args.file)
        if state is None:
            print(f"✗ Could not load workflow from: {args.file}", file=sys.stderr)
            sys.exit(1)

        success, message = state.reset()
        state.save(args.file)

        if args.json:
            print(json.dumps({"success": success, "message": message}, indent=2))
        else:
            print(f"✓ {message}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
