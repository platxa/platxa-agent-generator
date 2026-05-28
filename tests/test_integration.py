#!/usr/bin/env python3
"""
test_integration — sharded from test_generator.py.

Shards: 5 TestXxx classes.
Run with: pytest tests/test_integration.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestIntegration:
    """Integration tests that exercise multiple modules together."""

    def test_multiagent_to_validation_pipeline(self, tmp_path: Path) -> None:
        """Real integration test: generate multi-agent system and validate all files."""
        output_dir = tmp_path / "agents"

        # Generate multi-agent system
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "documentation",
                "--output",
                str(output_dir),
            ],
            capture_output=True,
        )

        # Validate all generated markdown files
        md_files = list(output_dir.glob("*.md"))
        assert len(md_files) >= 2

        for md_file in md_files:
            # Syntax validation
            syntax_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            syntax_output = json.loads(syntax_result.stdout)
            assert syntax_output["passed"] is True, f"Syntax failed: {md_file.name}"

            # Security scan
            security_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "security_scanner.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            security_output = json.loads(security_result.stdout)
            assert security_output["passed"] is True, f"Security failed: {md_file.name}"


class TestLiveAgentInvocation:
    """Tests for Feature #43: Live agent invocation via 'claude -p'."""

    def _create_agent_file(self, tmp_path: Path) -> Path:
        """Create a minimal valid agent file for testing."""
        agent_md = tmp_path / "test-agent.md"
        agent_md.write_text(
            "---\n"
            "name: test-agent\n"
            "description: A test agent that analyzes code quality metrics\n"
            "tools: Read, Grep, Glob\n"
            "---\n\n"
            "# Test Agent\n\n"
            "## Workflow\n"
            "1. Read target files\n"
            "2. Analyze quality\n"
            "3. Report findings\n\n"
            "## Examples\n"
            "### Example 1: Basic Usage\n"
            "```\nUse test-agent to review code\n```\n"
        )
        return agent_md

    def test_live_flag_in_help_output(self) -> None:
        """CLI --live flag is available in help output."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "--live" in result.stdout

    def test_live_tests_not_included_by_default(self, tmp_path: Path) -> None:
        """Without --live flag, no live_ tests are created."""
        agent_md = self._create_agent_file(tmp_path)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                str(agent_md),
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        live_tests = [r for r in data["results"] if r["test_name"].startswith("live_")]
        assert len(live_tests) == 0

    def test_live_flag_adds_live_tests(self, tmp_path: Path) -> None:
        """With --live flag, live_ test cases are added to the suite.

        Tests this by calling create_live_tests() directly to avoid
        triggering actual claude -p invocations which would time out.
        """
        agent_md = self._create_agent_file(tmp_path)
        test_script = tmp_path / "test_live_flag.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import parse_agent_file, create_live_tests\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(agent_md) + "'))\n"
            "tests = create_live_tests(agent)\n"
            "names = [t.name for t in tests]\n"
            "print(json.dumps({'count': len(tests), 'names': names}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 2, f"Expected ≥2 live tests, got {data['count']}"
        assert all(n.startswith("live_") for n in data["names"]), (
            f"Non-live test names: {data['names']}"
        )

    def test_live_test_graceful_when_claude_missing(self, tmp_path: Path) -> None:
        """Live tests report SKIP when claude binary is not found."""
        agent_md = self._create_agent_file(tmp_path)
        # Use a subprocess that tests run_live_test with a non-existent binary
        test_script = tmp_path / "test_live.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_test',\n"
            "    description='test',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=[],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='/nonexistent/claude')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert "not executable" in data["message"] or "SKIP" in data["message"]

    def test_live_test_timeout_handling(self, tmp_path: Path) -> None:
        """Live tests handle timeout correctly."""
        agent_md = self._create_agent_file(tmp_path)
        # Create a fake "claude" script that sleeps forever
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text("#!/bin/bash\nsleep 30\n")
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_timeout.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_timeout_test',\n"
            "    description='test timeout',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=[],\n"
            "    timeout_seconds=1,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert "TIMEOUT" in data["message"]

    def test_live_test_pattern_matching(self, tmp_path: Path) -> None:
        """Live tests match expected patterns in output."""
        agent_md = self._create_agent_file(tmp_path)
        # Create a fake "claude" script that echoes known output
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "Agent test-agent analyzing code quality"\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_pattern.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_pattern_test',\n"
            "    description='test patterns',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['test-agent', 'quality'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message, "
            "'details': result.details}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is True
        assert any("Matched" in d for d in data["details"])

    def test_live_test_forbidden_pattern_detection(self, tmp_path: Path) -> None:
        """Live tests detect forbidden patterns in output."""
        agent_md = self._create_agent_file(tmp_path)
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "rm -rf / is dangerous"\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_forbidden.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_forbidden_test',\n"
            "    description='test forbidden',\n"
            "    input_prompt='hello',\n"
            r"    forbidden_patterns=[r'rm\s+-rf\s+/']," + "\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'details': result.details}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert any("forbidden" in d.lower() for d in data["details"])

    def test_create_live_tests_generates_test_cases(self, tmp_path: Path) -> None:
        """create_live_tests() produces test cases with live_ prefix."""
        test_script = tmp_path / "test_create.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import create_live_tests, AgentInfo\n"
            "agent = AgentInfo(\n"
            "    name='scanner',\n"
            "    description='Scans code for security vulnerabilities and issues',\n"
            "    tools=['Read', 'Grep', 'Glob'],\n"
            "    sections={},\n"
            "    workflow_steps=['scan', 'report'],\n"
            "    examples=[],\n"
            ")\n"
            "tests = create_live_tests(agent)\n"
            "names = [t.name for t in tests]\n"
            "print(json.dumps({'count': len(tests), 'names': names, "
            "'all_live': all(n.startswith('live_') for n in names)}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 2
        assert data["all_live"] is True

    def test_find_claude_binary_returns_path_or_none(self, tmp_path: Path) -> None:
        """find_claude_binary() returns a string path or None."""
        test_script = tmp_path / "test_find.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import find_claude_binary\n"
            "result = find_claude_binary()\n"
            "print(json.dumps({'result': result, 'type': type(result).__name__}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["type"] in ("str", "NoneType")


class TestTestHarnessExitCode:
    """Tests for Feature #7: non-zero subprocess returncode always fails.

    OQ-4 resolved (always-fail): when the claude subprocess exits with a
    non-zero return code, run_live_test() must set passed=False regardless
    of whether expected_patterns matched. The exit code is surfaced in the
    result details. The zero-exit baseline (pattern-match only) is preserved.
    """

    def _create_agent_file(self, tmp_path: Path) -> Path:
        """Create a minimal valid agent file for testing."""
        agent_md = tmp_path / "exit-code-agent.md"
        agent_md.write_text(
            "---\n"
            "name: exit-code-agent\n"
            "description: Test agent used to verify exit-code handling\n"
            "tools: Read\n"
            "---\n\n"
            "# Exit Code Agent\n\n"
            "## Workflow\n"
            "1. Run\n\n"
            "## Examples\n"
            "### Example 1: Basic Usage\n"
            "```\nUse exit-code-agent\n```\n"
        )
        return agent_md

    def test_nonzero_exit_is_failure(self, tmp_path: Path) -> None:
        """Non-zero exit unconditionally fails even when patterns match.

        A fake claude that prints a matching pattern but exits with code 127
        (command-not-found style) must produce passed=False, and the exit
        code must appear in result.details.
        """
        agent_md = self._create_agent_file(tmp_path)
        # Fake claude: emits a string that matches expected_patterns, then
        # exits 127 (process-level failure signal).
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "exit-code-agent running analysis"\nexit 127\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_nonzero_exit.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_exit_127',\n"
            "    description='nonzero exit with matching pattern',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['exit-code-agent', 'analysis'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({\n"
            "    'passed': result.passed,\n"
            "    'message': result.message,\n"
            "    'details': result.details,\n"
            "}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False, (
            "Non-zero exit (127) must force failure even with matching patterns"
        )
        assert data["message"] == "FAIL"
        # Exit code must be surfaced in details (reproducibility requirement)
        assert any("127" in d for d in data["details"]), (
            f"Expected exit code 127 in details, got: {data['details']}"
        )
        assert any("non-zero exit forces failure" in d for d in data["details"]), (
            f"Expected failure reason in details, got: {data['details']}"
        )

    def test_zero_exit_unchanged_behavior(self, tmp_path: Path) -> None:
        """Zero-exit baseline preserved: pattern-match still determines pass.

        A fake claude that emits matching patterns and exits 0 must still
        pass, proving the fix only affects the non-zero branch.
        """
        agent_md = self._create_agent_file(tmp_path)
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "exit-code-agent completed analysis"\nexit 0\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_zero_exit.py"
        test_script.write_text(
            "import json, sys\n"
            ""
            "from platxa_agent_generator.test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_exit_0',\n"
            "    description='zero exit with matching pattern',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['exit-code-agent', 'analysis'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({\n"
            "    'passed': result.passed,\n"
            "    'message': result.message,\n"
            "    'details': result.details,\n"
            "}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is True, (
            "Zero exit with matching patterns must still pass (baseline preserved)"
        )
        assert data["message"] == "PASS"
        # No exit-code detail should be present on zero exit
        assert not any("Exit code:" in d for d in data["details"]), (
            f"Zero exit should not emit exit-code detail, got: {data['details']}"
        )


class TestGeneratorRegressionSuite:
    """Regression tests for Feature #46: Known NLP inputs produce expected structures.

    Each test provides a specific (name, description, tools) input and verifies
    the generated agent file contains all expected structural elements. These
    serve as golden-path regression tests — if any change to the generator
    breaks these assertions, we catch it immediately.
    """

    def _generate(self, tmp_path: Path, name: str, desc: str, tools: str) -> str:
        """Generate an agent and return its content."""
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

    def _validate(self, tmp_path: Path, name: str) -> dict:
        """Run syntax validator on generated file and return result."""
        md_file = tmp_path / f"{name}.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    # --- Analyzer type agents ---

    def test_security_scanner_agent(self, tmp_path: Path) -> None:
        """Security scanner: read-only tools, security keywords in output."""
        content = self._generate(
            tmp_path,
            "security-scanner",
            "Scans code for security vulnerabilities and OWASP issues",
            "Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "## Examples" in content
        assert "## Error Handling" in content
        assert "## Verification" in content
        assert "Read" in content.split("---")[1]  # In frontmatter
        validation = self._validate(tmp_path, "security-scanner")
        assert validation["passed"] is True

    def test_code_reviewer_agent(self, tmp_path: Path) -> None:
        """Code reviewer: read-only with Grep for pattern matching."""
        content = self._generate(
            tmp_path,
            "code-reviewer",
            "Reviews pull requests for code quality and best practices",
            "Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "## Examples" in content
        assert "Example 1: Basic Usage" in content
        assert "Example 3: Error Scenario" in content
        assert "Example 4: Edge Case" in content
        validation = self._validate(tmp_path, "code-reviewer")
        assert validation["passed"] is True

    # --- Builder type agents ---

    def test_doc_generator_agent(self, tmp_path: Path) -> None:
        """Doc generator: needs Write for creating files."""
        content = self._generate(
            tmp_path,
            "doc-generator",
            "Generates comprehensive API documentation from source code",
            "Read,Write,Glob,Grep",
        )
        assert "## Workflow" in content
        assert "Write" in content.split("---")[1]
        assert "## Prerequisites" in content
        validation = self._validate(tmp_path, "doc-generator")
        assert validation["passed"] is True

    def test_scaffolder_agent(self, tmp_path: Path) -> None:
        """Scaffolder: creates new files and directories."""
        content = self._generate(
            tmp_path,
            "project-scaffolder",
            "Creates new project structures with boilerplate files",
            "Write,Read,Bash,Glob",
        )
        assert "## Workflow" in content
        assert "Write" in content.split("---")[1]
        assert "Bash" in content.split("---")[1]
        validation = self._validate(tmp_path, "project-scaffolder")
        assert validation["passed"] is True

    # --- Automation type agents ---

    def test_test_runner_agent(self, tmp_path: Path) -> None:
        """Test runner: Bash-heavy for executing commands."""
        content = self._generate(
            tmp_path,
            "test-runner",
            "Runs test suites and reports results with coverage data",
            "Bash,Read,Glob",
        )
        assert "## Workflow" in content
        assert "Bash" in content.split("---")[1]
        assert "exit code" in content.lower() or "Exit code" in content
        validation = self._validate(tmp_path, "test-runner")
        assert validation["passed"] is True

    def test_ci_pipeline_agent(self, tmp_path: Path) -> None:
        """CI pipeline: Bash + Write for build artifacts."""
        content = self._generate(
            tmp_path,
            "ci-pipeline",
            "Runs continuous integration pipeline with build, test, deploy steps",
            "Bash,Read,Write,Glob",
        )
        assert "## Workflow" in content
        assert "## Error Handling" in content
        validation = self._validate(tmp_path, "ci-pipeline")
        assert validation["passed"] is True

    # --- Orchestrator type agents ---

    def test_orchestrator_agent(self, tmp_path: Path) -> None:
        """Orchestrator: uses Task tool to coordinate workers."""
        content = self._generate(
            tmp_path,
            "review-orchestrator",
            "Coordinates multiple review agents for comprehensive analysis",
            "Task,Read,Glob,Grep",
        )
        assert "## Workflow" in content
        assert "Task" in content.split("---")[1]
        assert "subagent" in content.lower() or "worker" in content.lower()
        validation = self._validate(tmp_path, "review-orchestrator")
        assert validation["passed"] is True

    # --- Web-enabled agents ---

    def test_research_agent(self, tmp_path: Path) -> None:
        """Research agent: WebSearch + WebFetch for information gathering."""
        content = self._generate(
            tmp_path,
            "research-agent",
            "Researches best practices and documentation from web sources",
            "WebSearch,WebFetch,Read",
        )
        assert "## Workflow" in content
        assert "WebSearch" in content.split("---")[1]
        assert "WebFetch" in content.split("---")[1]
        validation = self._validate(tmp_path, "research-agent")
        assert validation["passed"] is True

    # --- Interactive agents ---

    def test_guided_setup_agent(self, tmp_path: Path) -> None:
        """Guided setup: uses AskUserQuestion for interaction."""
        content = self._generate(
            tmp_path,
            "guided-setup",
            "Guides users through project configuration with interactive prompts",
            "AskUserQuestion,Read,Write,Glob",
        )
        assert "## Workflow" in content
        assert "AskUserQuestion" in content.split("---")[1]
        validation = self._validate(tmp_path, "guided-setup")
        assert validation["passed"] is True

    # --- Edit-focused agents ---

    def test_refactoring_agent(self, tmp_path: Path) -> None:
        """Refactoring agent: Edit-focused for modifying existing code."""
        content = self._generate(
            tmp_path,
            "code-refactorer",
            "Refactors code to improve readability and reduce complexity",
            "Edit,Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "Edit" in content.split("---")[1]
        assert "## Verification" in content
        validation = self._validate(tmp_path, "code-refactorer")
        assert validation["passed"] is True

    # --- Structure consistency across all types ---

    def test_all_agents_have_14_standard_sections(self, tmp_path: Path) -> None:
        """Every generated agent has all standard sections."""
        agents = [
            ("section-check-1", "Analyzes code patterns", "Read,Grep"),
            ("section-check-2", "Creates test files", "Write,Read,Bash"),
            ("section-check-3", "Orchestrates workers", "Task,Read,Glob"),
        ]
        required_sections = [
            "## Workflow",
            "## Examples",
            "## Error Handling",
            "## Verification",
            "## Output Format",
        ]
        for name, desc, tools in agents:
            content = self._generate(tmp_path, name, desc, tools)
            for section in required_sections:
                assert section in content, f"Agent {name} missing section: {section}"

    def test_all_agents_pass_syntax_validation(self, tmp_path: Path) -> None:
        """Every generated agent passes syntax validation."""
        agents = [
            ("val-analyzer", "Validates input data quality", "Read,Grep"),
            ("val-builder", "Creates API endpoint stubs", "Write,Read,Glob"),
            ("val-runner", "Executes deployment scripts", "Bash,Read"),
            ("val-searcher", "Finds relevant documentation", "WebSearch,WebFetch,Read"),
        ]
        for name, desc, tools in agents:
            self._generate(tmp_path, name, desc, tools)
            result = self._validate(tmp_path, name)
            assert result["passed"] is True, (
                f"Agent {name} failed validation: {result.get('errors', [])}"
            )


class TestEndToEndGeneration:
    """Tests for Feature #83: Full 5-phase pipeline end-to-end tests.

    Each test provides an NLP description, runs the full pipeline
    (parse → classify → select tools → generate → validate → score),
    and verifies the output agent passes quality gates.
    """

    VALIDATOR_SCRIPT = str(SCRIPTS_DIR / "syntax_validator.py")
    SCORER_SCRIPT = str(SCRIPTS_DIR / "quality_scorer.py")

    def _generate_and_validate(self, description: str, tmp_path: Path) -> dict:
        """Run full generation pipeline and return combined results.

        Returns dict with keys: generate_result, agent_content,
        syntax_passed, quality_score.
        """
        # Phase 1-3: Generate via CLI invoked through the documented
        # package entry point (matches the ``platxa-agent`` console
        # script defined in pyproject.toml). Using ``python -m`` keeps
        # the package import path intact so cli.py reaches its sibling
        # modules and the ``commands`` subpackage without needing a
        # standalone-script fallback.
        gen_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "platxa_agent_generator.cli",
                "--non-interactive",
                "generate",
                description,
                "--no-validate",
                "-o",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert gen_result.returncode == 0, (
            f"Generation failed: {gen_result.stdout} {gen_result.stderr}"
        )
        gen_data = json.loads(gen_result.stdout)

        # Read generated agent content
        agent_path = Path(gen_data["output_path"])
        assert agent_path.exists(), f"Agent file not created: {agent_path}"
        agent_content = agent_path.read_text(encoding="utf-8")

        # Phase 4: Syntax validation
        val_result = subprocess.run(
            [sys.executable, self.VALIDATOR_SCRIPT, str(agent_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        val_data = json.loads(val_result.stdout)

        # Phase 5: Quality scoring
        score_result = subprocess.run(
            [sys.executable, self.SCORER_SCRIPT, str(agent_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        score_data = json.loads(score_result.stdout)

        return {
            "generate": gen_data,
            "content": agent_content,
            "syntax_passed": val_data["passed"],
            "syntax_errors": val_data.get("errors", []),
            "quality_score": score_data.get("total_score", 0),
            "quality_grade": score_data.get("grade", "F"),
        }

    def test_e2e_simple_code_reviewer(self, tmp_path):
        """E2E: Simple code review agent from NLP description."""
        result = self._generate_and_validate(
            "Create an agent that reviews Python code for bugs and style issues",
            tmp_path,
        )

        # Verify generation succeeded
        assert result["generate"]["success"] is True
        assert result["generate"]["agent_name"]

        # Verify syntax is valid
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"

        # Verify quality meets minimum threshold
        assert result["quality_score"] >= 7.0, (
            f"Quality {result['quality_score']:.1f} < 7.0 (grade: {result['quality_grade']})"
        )

        # Verify content has essential sections
        content = result["content"]
        assert "---" in content  # frontmatter
        assert "## Overview" in content
        assert "## Workflow" in content

    def test_e2e_read_only_security_scanner(self, tmp_path):
        """E2E: Read-only security scanner (no Write/Bash tools)."""
        result = self._generate_and_validate(
            "Create an agent that analyzes code for security vulnerabilities",
            tmp_path,
        )

        assert result["generate"]["success"] is True
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"
        assert result["quality_score"] >= 7.0, f"Quality {result['quality_score']:.1f} < 7.0"

        # Verify it's analysis-oriented (Read should be in tools)
        tools = result["generate"]["tools"]
        assert "Read" in tools, f"Read not in tools: {tools}"

    def test_e2e_documentation_generator(self, tmp_path):
        """E2E: Documentation generator agent with Write tool."""
        result = self._generate_and_validate(
            "Build an agent that generates API documentation from source code",
            tmp_path,
        )

        assert result["generate"]["success"] is True
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"
        assert result["quality_score"] >= 7.0, f"Quality {result['quality_score']:.1f} < 7.0"

        # Doc generator should have Write capability
        tools = result["generate"]["tools"]
        assert "Write" in tools or "Edit" in tools, f"No write capability in tools: {tools}"

    def test_e2e_output_file_is_valid_markdown(self, tmp_path):
        """E2E: Generated file is valid markdown with proper frontmatter."""
        result = self._generate_and_validate(
            "Create a test runner agent that executes pytest suites",
            tmp_path,
        )

        content = result["content"]

        # Must start with frontmatter
        assert content.startswith("---\n"), "Agent must start with frontmatter delimiter"

        # Must have closing frontmatter delimiter
        second_delim = content.index("---", 4)
        assert second_delim > 4, "Missing closing frontmatter delimiter"

        # Frontmatter must contain required fields
        frontmatter = content[4:second_delim]
        assert "name:" in frontmatter
        assert "description:" in frontmatter
        assert "tools:" in frontmatter

    def test_e2e_different_descriptions_produce_different_agents(self, tmp_path):
        """E2E: Different NLP inputs produce distinct agents."""
        dir_a = tmp_path / "a"
        dir_b = tmp_path / "b"
        dir_a.mkdir()
        dir_b.mkdir()

        result_a = self._generate_and_validate(
            "Create a code linting agent for JavaScript",
            dir_a,
        )
        result_b = self._generate_and_validate(
            "Build a database migration planning agent",
            dir_b,
        )

        # Different names
        assert result_a["generate"]["agent_name"] != result_b["generate"]["agent_name"]

        # Different tool sets (at least partially)
        tools_a = set(result_a["generate"]["tools"])
        tools_b = set(result_b["generate"]["tools"])
        # They shouldn't be identical (different domains)
        assert tools_a != tools_b or result_a["content"] != result_b["content"]
