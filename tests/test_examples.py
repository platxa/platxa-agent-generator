#!/usr/bin/env python3
"""
test_examples — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_examples.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestVerificationSectionGeneration:
    """Tests for Feature #26: Verification criteria section generation."""

    def test_verification_heading_present(self, tmp_path: Path) -> None:
        """Generated agent file includes ## Verification heading."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-verifier",
                "--description",
                "Verifies code quality",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "test-verifier.md").read_text()
        assert "## Verification" in content

    def test_success_criteria_present(self, tmp_path: Path) -> None:
        """Verification section includes Success Criteria subsection."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-checker",
                "--description",
                "Checks things",
                "--tools",
                "Read,Bash",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "test-checker.md").read_text()
        assert "### Success Criteria" in content
        assert "All requested tasks completed" in content
        assert "No security violations" in content

    def test_bash_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Bash tool agents get exit code verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "bash-agent",
                "--description",
                "Runs shell commands",
                "--tools",
                "Bash,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "bash-agent.md").read_text()
        assert "exit code 0" in content.lower() or "exited with code 0" in content

    def test_write_edit_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Write/Edit tool agents get file modification verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "writer-agent",
                "--description",
                "Writes files",
                "--tools",
                "Write,Edit,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "writer-agent.md").read_text()
        assert "syntax validation" in content.lower() or "syntax" in content.lower()
        assert "unintended files" in content.lower()
        assert "git diff" in content

    def test_task_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Task tool agents get subagent result verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "orchestrator-agent",
                "--description",
                "Orchestrates subagents",
                "--tools",
                "Task,Read,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "orchestrator-agent.md").read_text()
        assert "subagent" in content.lower()

    def test_verification_commands_for_write_agents(self, tmp_path: Path) -> None:
        """Write agents get git diff verification commands."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "file-writer",
                "--description",
                "Creates new files",
                "--tools",
                "Write,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "file-writer.md").read_text()
        assert "### Verification Commands" in content
        assert "git diff --name-only" in content

    def test_expected_output_structure(self, tmp_path: Path) -> None:
        """Verification section includes expected output structure."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "output-agent",
                "--description",
                "Produces structured output",
                "--tools",
                "Read,Grep",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "output-agent.md").read_text()
        assert "### Expected Output" in content
        assert "Status summary" in content
        assert "Action log" in content
        assert "Next steps" in content

    def test_read_only_agent_no_git_diff_commands(self, tmp_path: Path) -> None:
        """Read-only agents should not get git diff verification commands."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "reader-agent",
                "--description",
                "Reads and analyzes code",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "reader-agent.md").read_text()
        assert "git diff --name-only" not in content

    def test_quality_scorer_verification_check(self, tmp_path: Path) -> None:
        """Quality scorer checks for verification section presence."""
        # Agent with verification section (generated by agent_generator)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "scored-agent",
                "--description",
                "Agent with verification section for scoring",
                "--tools",
                "Read,Grep,Bash",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Score it
        md_file = tmp_path / "scored-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "quality_scorer.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"Scorer produced no output, stderr: {result.stderr}"
        score_data = json.loads(output)
        # Documentation criterion should mention verification
        doc_criterion = next(
            (c for c in score_data["criteria"] if c["name"] == "Documentation"),
            None,
        )
        assert doc_criterion is not None
        all_findings = " ".join(doc_criterion["findings"])
        assert "verification" in all_findings.lower()


class TestEnhancedExampleGeneration:
    """Tests for Feature #27: Enhanced example generation with diversity."""

    def _generate_agent(self, tmp_path: Path, name: str, desc: str, tools: str) -> str:
        """Helper to generate an agent and return its content."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                name,
                "--description",
                desc,
                "--tools",
                tools,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return (tmp_path / f"{name}.md").read_text()

    def test_minimum_four_examples_generated(self, tmp_path: Path) -> None:
        """Generated agents have at least 4 examples (basic, advanced, error, edge)."""
        content = self._generate_agent(
            tmp_path, "example-agent", "Analyzes code quality", "Read,Grep,Glob"
        )
        example_headings = [line for line in content.split("\n") if line.startswith("### Example")]
        assert len(example_headings) >= 4, (
            f"Expected ≥4 examples, got {len(example_headings)}: {example_headings}"
        )

    def test_basic_usage_example_present(self, tmp_path: Path) -> None:
        """Example 1 covers basic/happy path usage."""
        content = self._generate_agent(
            tmp_path, "basic-agent", "Searches for patterns", "Read,Grep"
        )
        assert "Basic Usage" in content

    def test_error_scenario_example_present(self, tmp_path: Path) -> None:
        """Example 3 covers an error scenario."""
        content = self._generate_agent(
            tmp_path, "error-agent", "Writes configuration files", "Write,Edit,Read"
        )
        assert "Error Scenario" in content

    def test_edge_case_example_present(self, tmp_path: Path) -> None:
        """Example 4 covers edge case handling."""
        content = self._generate_agent(tmp_path, "edge-agent", "Processes data files", "Read,Glob")
        assert "Edge Case" in content

    def test_error_example_shows_error_status(self, tmp_path: Path) -> None:
        """Error scenario example includes error status in output."""
        content = self._generate_agent(
            tmp_path, "err-status-agent", "Runs shell commands", "Bash,Read"
        )
        assert '"status": "error"' in content

    def test_error_example_tool_specific_bash(self, tmp_path: Path) -> None:
        """Bash agents get permission-related error scenario."""
        content = self._generate_agent(
            tmp_path, "bash-err-agent", "Executes build commands", "Bash,Read"
        )
        assert "permission" in content.lower() or "elevated" in content.lower()

    def test_error_example_tool_specific_write(self, tmp_path: Path) -> None:
        """Write agents get read-only file error scenario."""
        content = self._generate_agent(
            tmp_path, "write-err-agent", "Creates new modules", "Write,Edit,Read"
        )
        assert "read-only" in content.lower()

    def test_error_example_tool_specific_web(self, tmp_path: Path) -> None:
        """WebFetch agents get unreachable endpoint error scenario."""
        content = self._generate_agent(
            tmp_path, "web-err-agent", "Fetches API docs", "WebFetch,Read"
        )
        assert "unreachable" in content.lower()

    def test_error_example_tool_specific_task(self, tmp_path: Path) -> None:
        """Task agents get subagent failure error scenario."""
        content = self._generate_agent(
            tmp_path, "task-err-agent", "Orchestrates workers", "Task,Read,Glob"
        )
        assert "subagent" in content.lower() and "fail" in content.lower()

    def test_scorer_validates_diversity(self, tmp_path: Path) -> None:
        """Quality scorer recognizes full example diversity."""
        self._generate_agent(tmp_path, "diverse-agent", "Analyzes security", "Read,Grep,Bash")
        md_file = tmp_path / "diverse-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "quality_scorer.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"Scorer produced no output, stderr: {result.stderr}"
        score_data = json.loads(output)
        examples_criterion = next(
            (c for c in score_data["criteria"] if c["name"] == "Examples"),
            None,
        )
        assert examples_criterion is not None
        all_findings = " ".join(examples_criterion["findings"])
        assert "diversity" in all_findings.lower()


class TestAutoGenerateTestsFromExamples:
    """Tests for Feature #44: Auto-generate test cases from agent examples."""

    def _generate_and_create_tests(self, tmp_path: Path) -> dict:
        """Generate an agent then run --create-tests on it, return JSON."""
        # Generate agent
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "auto-test-agent",
                "--description",
                "Scans code for security vulnerabilities and issues",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"

        # Create tests from generated agent
        md_file = tmp_path / "auto-test-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--create-tests",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"create-tests failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_create_tests_extracts_user_requests_as_inputs(self, tmp_path: Path) -> None:
        """User Request prompts from examples become test input_prompt values."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        assert len(example_tests) >= 3, f"Expected ≥3 example tests, got {len(example_tests)}"
        # Each example test should have a non-empty input_prompt
        for t in example_tests:
            assert t["input_prompt"], f"Test {t['name']} has empty input_prompt"

    def test_create_tests_extracts_expected_patterns(self, tmp_path: Path) -> None:
        """Agent Actions descriptions become expected_patterns."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        # At least some example tests should have expected_patterns
        tests_with_patterns = [t for t in example_tests if t.get("expected_patterns")]
        assert len(tests_with_patterns) >= 1, "No example tests have expected_patterns"

    def test_create_tests_includes_workflow_and_error_tests(self, tmp_path: Path) -> None:
        """Template always includes workflow_execution and error_handling tests."""
        data = self._generate_and_create_tests(tmp_path)
        test_names = [t["name"] for t in data["tests"]]
        assert "workflow_execution" in test_names
        assert "error_handling" in test_names

    def test_create_tests_names_are_slugified(self, tmp_path: Path) -> None:
        """Example test names are slugified from titles."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        for t in example_tests:
            # Names should be lowercase with underscores, no spaces
            assert " " not in t["name"], f"Space in test name: {t['name']}"
            assert t["name"] == t["name"].lower(), f"Uppercase in test name: {t['name']}"

    def test_create_tests_input_contains_agent_name(self, tmp_path: Path) -> None:
        """User request inputs reference the agent name."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        # At least one example should mention agent name in input
        inputs_with_name = [t for t in example_tests if "auto-test-agent" in t["input_prompt"]]
        assert len(inputs_with_name) >= 1, "No example test inputs contain agent name"

    def test_parser_extracts_user_request_field(self, tmp_path: Path) -> None:
        """Parser extracts user_request from **User Request:** blocks."""
        test_script = tmp_path / "test_parse.py"
        # Generate agent first
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "parse-test-agent",
                "--description",
                "Analyzes code quality metrics and reports findings",
                "--tools",
                "Read,Grep",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "parse-test-agent.md"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import parse_agent_file\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(md_file) + "'))\n"
            "user_reqs = [e.get('user_request', '') for e in agent.examples]\n"
            "agent_acts = [e.get('agent_actions', '') for e in agent.examples]\n"
            "print(json.dumps({'user_requests': user_reqs, "
            "'agent_actions': agent_acts, 'count': len(agent.examples)}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 4, f"Expected ≥4 examples, got {data['count']}"
        # At least first example should have user_request
        non_empty_reqs = [r for r in data["user_requests"] if r]
        assert len(non_empty_reqs) >= 3, (
            f"Expected ≥3 user_request fields, got {len(non_empty_reqs)}"
        )

    def test_parser_extracts_agent_actions_field(self, tmp_path: Path) -> None:
        """Parser extracts agent_actions from **Agent Actions:** blocks."""
        test_script = tmp_path / "test_actions.py"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "actions-agent",
                "--description",
                "Builds documentation from source code analysis",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "actions-agent.md"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import parse_agent_file\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(md_file) + "'))\n"
            "actions = [e.get('agent_actions', '') for e in agent.examples]\n"
            "non_empty = [a for a in actions if a]\n"
            "print(json.dumps({'count': len(non_empty), "
            "'sample': non_empty[0] if non_empty else ''}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 3, f"Expected ≥3 agent_actions, got {data['count']}"
        # Actions should contain semicolons (joined steps)
        assert ";" in data["sample"], f"Actions not joined with semicolons: {data['sample']}"

    def test_no_examples_falls_back_to_generic(self, tmp_path: Path) -> None:
        """Agent with no parseable examples gets generic fallback tests."""
        # Create a minimal agent with no examples section
        md_file = tmp_path / "bare-agent.md"
        md_file.write_text(
            "---\n"
            "name: bare-agent\n"
            "description: A minimal agent with no examples section at all\n"
            "tools: Read\n"
            "---\n\n"
            "# Bare Agent\n\n"
            "## Workflow\n"
            "1. Read files\n"
            "2. Process data\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--create-tests",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        test_names = [t["name"] for t in data["tests"]]
        assert "basic_invocation" in test_names
        assert "workflow_execution" in test_names
        assert "error_handling" in test_names
