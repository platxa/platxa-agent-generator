#!/usr/bin/env python3
"""
test_workflow — sharded from test_generator.py.

Shards: 5 TestXxx classes.
Run with: pytest tests/test_workflow.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestWorkflowState:
    """Real tests for workflow_state.py CLI."""

    def test_create_new_workflow(self, tmp_path: Path) -> None:
        """Real test: create a new workflow state file."""
        state_file = tmp_path / "workflow.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--name",
                "test-agent",
                "--output",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert state_file.exists()

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"
        assert data["agent_name"] == "test-agent"

    def test_transition_through_phases(self, tmp_path: Path) -> None:
        """Real test: transition through all workflow phases."""
        state_file = tmp_path / "workflow.json"

        # Create workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Transition: idle -> discovery
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify state
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "discovery"

        # Transition: discovery -> architecture
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "architecture",
            ],
            capture_output=True,
        )
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "architecture"

    def test_invalid_transition_rejected(self, tmp_path: Path) -> None:
        """Real test: invalid transitions should be rejected."""
        state_file = tmp_path / "workflow.json"

        # Create workflow (starts at idle)
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Try invalid transition: idle -> generation (should fail)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "generation",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

        # State should still be idle
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"

    def test_reset_workflow(self, tmp_path: Path) -> None:
        """Real test: reset workflow back to idle."""
        state_file = tmp_path / "workflow.json"

        # Create and advance workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
        )

        # Reset
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "reset",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"


class TestNonInteractiveMode:
    """Tests for Feature #80: Non-interactive CLI mode for CI/CD."""

    def _run_cli(self, *args: str, cwd: str | None = None) -> subprocess.CompletedProcess[str]:
        """Run CLI with given args."""
        return subprocess.run(
            [sys.executable, "-m", "platxa_agent_generator", *args],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=cwd,
        )

    def test_non_interactive_flag_in_help(self):
        """--non-interactive flag appears in CLI help output."""
        result = self._run_cli("--help")
        assert result.returncode == 0
        assert "--non-interactive" in result.stdout

    def test_non_interactive_forces_json_output(self, tmp_path):
        """--non-interactive forces JSON output even without --json flag."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a simple code analyzer",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["success"] is True
        assert "agent_name" in data
        assert "output_path" in data

    def test_non_interactive_missing_description_returns_error_json(self):
        """Missing description in non-interactive mode returns JSON error with exit 1."""
        result = self._run_cli("--non-interactive", "generate")
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert "error" in data
        assert "description" in data["error"].lower()

    def test_non_interactive_no_command_returns_error_json(self):
        """No command in non-interactive mode returns JSON error with exit 1."""
        result = self._run_cli("--non-interactive")
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert "error" in data

    def test_non_interactive_exit_code_0_on_success(self, tmp_path):
        """Successful generation returns exit code 0."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Build a test runner agent",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0

    def test_non_interactive_output_is_valid_json(self, tmp_path):
        """All output in non-interactive mode is valid JSON (no mixed text)."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a documentation generator",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        # Must parse as JSON without error — no progress spinners mixed in
        data = json.loads(result.stdout)
        assert isinstance(data, dict)

    def test_non_interactive_generate_creates_file(self, tmp_path):
        """Non-interactive generate actually writes the agent file."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a security scanner",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        output_path = Path(data["output_path"])
        assert output_path.exists(), f"Agent file not created at {output_path}"
        content = output_path.read_text(encoding="utf-8")
        assert "---" in content  # Has frontmatter

    def test_non_interactive_includes_tools_in_output(self, tmp_path):
        """JSON output includes detected tools list."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a web API security scanner",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "tools" in data
        assert isinstance(data["tools"], list)
        assert len(data["tools"]) >= 1

    def test_non_interactive_catalog_list_json(self):
        """--non-interactive with catalog list outputs valid JSON."""
        result = self._run_cli("--non-interactive", "catalog", "list")
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_non_interactive_validate_json(self, tmp_path):
        """--non-interactive with validate outputs JSON results."""
        # Create a minimal agent file to validate
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text(
            "---\nname: test-agent\ndescription: Test\ntools: Read\n---\n\n"
            "# Test Agent\n\n## Overview\nTest.\n",
            encoding="utf-8",
        )
        result = self._run_cli(
            "--non-interactive",
            "validate",
            str(agent_file),
        )
        # May pass or fail validation, but output must be JSON
        data = json.loads(result.stdout)
        assert "passed" in data


class TestIterationAwareRetryLoop:
    """Tests for Feature #45: --max-iterations CLI override with iteration-aware loop."""

    def _run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "platxa_agent_generator", *args],
            capture_output=True,
            text=True,
            timeout=60,
        )

    def test_max_iterations_cli_arg_default(self) -> None:
        """--max-iterations defaults to 5."""
        result = self._run_cli("generate", "--help")
        assert result.returncode == 0
        assert "--max-iterations" in result.stdout
        assert "default: 5" in result.stdout

    def test_max_iterations_respected_escalate(self, tmp_path: Path) -> None:
        """5 failed iterations (min-quality impossible) → ESCALATE verdict."""
        result = self._run_cli(
            "--json",
            "generate",
            "A test agent for iteration checks",
            "--max-iterations",
            "5",
            "--min-quality",
            "11.0",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert data["verdict"] == "ESCALATE"
        assert data["iterations_used"] == 5
        assert data["max_iterations"] == 5

    def test_max_iterations_override_to_10(self, tmp_path: Path) -> None:
        """--max-iterations=10 is respected in ESCALATE output."""
        result = self._run_cli(
            "--json",
            "generate",
            "A test agent",
            "--max-iterations",
            "10",
            "--min-quality",
            "11.0",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert data["verdict"] == "ESCALATE"
        assert data["iterations_used"] == 10
        assert data["max_iterations"] == 10

    def test_iteration_count_visible_in_success_output(self, tmp_path: Path) -> None:
        """Successful generation reports iterations_used and max_iterations."""
        result = self._run_cli(
            "--json",
            "generate",
            "A code review agent",
            "--max-iterations",
            "3",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["success"] is True
        assert data["iterations_used"] == 1
        assert data["max_iterations"] == 3

    def test_context_hint_accepted_by_generate(self) -> None:
        """agent_generator.generate() accepts context_hint and produces valid output."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.agent_generator import generate\n"
                "ok, content, _ = generate(\n"
                "    name='retry-test',\n"
                "    description='A test agent',\n"
                "    tools=['Read'],\n"
                "    context_hint='Improve examples section with 3 concrete examples',\n"
                ")\n"
                "assert ok, content\n"
                "assert 'retry-test' in content\n"
                "print('OK')\n",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "OK"

    def test_workflow_state_tracks_iterations(self) -> None:
        """WorkflowState exposes retry_count and max_iterations in serialization."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.workflow_state import WorkflowState\n"
                "import json\n"
                "s = WorkflowState(workflow_id='t', max_iterations=7)\n"
                "s.retry_count = 4\n"
                "d = s.to_dict()\n"
                "print(d['retry_count'], d['max_iterations'])\n",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "4 7"
