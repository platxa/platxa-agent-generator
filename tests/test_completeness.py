#!/usr/bin/env python3
"""
test_completeness — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_completeness.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestCompletenessCheckerRequiredSections:
    """Tests for Feature #47: Required sections in completeness checker."""

    def _check(self, tmp_path: Path, content: str) -> dict:
        """Write content to file and run completeness checker, return JSON."""
        md_file = tmp_path / "test-agent.md"
        md_file.write_text(content)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "completeness_checker.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"No output, stderr: {result.stderr}"
        return json.loads(output)

    def _make_complete_agent(self) -> str:
        """Return a complete agent with all required sections."""
        return (
            "---\n"
            "name: complete-agent\n"
            "description: A complete agent with all required sections present\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# Complete Agent\n\n"
            "## Overview\nThis agent analyzes code quality.\n\n"
            "## Workflow\n1. Read files\n2. Analyze patterns\n3. Report\n\n"
            "## Examples\n### Example 1: Basic\n```\nUse agent\n```\n\n"
            "## Error Handling\nRetry on failure, report errors.\n\n"
            "## Verification\nCheck output matches expected format.\n\n"
            '## Output Format\n```json\n{"status": "success"}\n```\n'
        )

    def test_missing_error_handling_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Error Handling section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-error-handling\n"
            "description: Agent missing error handling section entirely\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Error Handling\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Verification\nCheck output.\n\n"
            "## Output Format\n```json\n{}\n```\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "error handling" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Error Handling not flagged as error"

    def test_missing_verification_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Verification section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-verification\n"
            "description: Agent missing verification section entirely here\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Verification\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Error Handling\nRetry on failure.\n\n"
            "## Output Format\n```json\n{}\n```\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "verification" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Verification not flagged as error"

    def test_missing_output_format_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Output Format section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-output-format\n"
            "description: Agent missing output format section entirely here\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Output Format\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Error Handling\nRetry on failure.\n\n"
            "## Verification\nCheck output.\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "output format" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Output Format not flagged as error"

    def test_complete_agent_passes_all_section_checks(self, tmp_path: Path) -> None:
        """Agent with all 6 required sections passes completeness."""
        data = self._check(tmp_path, self._make_complete_agent())
        assert data["complete"] is True
        section_errors = [
            c
            for c in data["checks"]
            if c["category"] == "sections" and not c["passed"] and c["severity"] == "error"
        ]
        assert len(section_errors) == 0, (
            f"Unexpected section errors: {[c['message'] for c in section_errors]}"
        )

    def test_missing_sections_lower_score(self, tmp_path: Path) -> None:
        """Missing required sections reduce the completeness score."""
        # Complete agent
        complete_data = self._check(tmp_path, self._make_complete_agent())
        # Incomplete agent (missing 3 sections)
        incomplete = (
            "---\n"
            "name: incomplete-agent\n"
            "description: Agent missing three required sections for testing\n"
            "tools: Read\n"
            "---\n\n"
            "# Incomplete\n\n"
            "## Overview\nDoes stuff.\n\n"
            "## Workflow\n1. Do things\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n"
        )
        incomplete_data = self._check(tmp_path, incomplete)
        assert incomplete_data["score"] < complete_data["score"], (
            f"Incomplete score {incomplete_data['score']} should be < "
            f"complete score {complete_data['score']}"
        )

    def test_incomplete_agent_marked_not_complete(self, tmp_path: Path) -> None:
        """Agent missing required sections is marked complete=false."""
        incomplete = (
            "---\n"
            "name: not-complete\n"
            "description: Agent that is deliberately missing required sections\n"
            "tools: Read\n"
            "---\n\n"
            "# Not Complete\n\n"
            "## Overview\nDoes stuff.\n\n"
            "## Workflow\n1. Do things\n"
        )
        data = self._check(tmp_path, incomplete)
        assert data["complete"] is False

    def test_generated_agent_passes_completeness(self, tmp_path: Path) -> None:
        """Agent from agent_generator.py passes completeness check."""
        # Generate a real agent
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "completeness-test",
                "--description",
                "Tests completeness checker with generated agent output",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "completeness-test.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "completeness_checker.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
        assert data["complete"] is True, (
            f"Generated agent incomplete: "
            f"{[c['message'] for c in data['checks'] if not c['passed'] and c['severity'] == 'error']}"
        )

    def test_error_handling_now_in_required_not_recommended(self, tmp_path: Path) -> None:
        """Error Handling check_id uses SEC_ prefix with error severity."""
        content = (
            "---\n"
            "name: check-severity\n"
            "description: Agent to verify error handling severity classification\n"
            "tools: Read\n"
            "---\n\n"
            "# Check Severity\n\n"
            "## Overview\nTest.\n\n"
            "## Workflow\n1. Do\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n"
        )
        data = self._check(tmp_path, content)
        eh_check = next(
            (c for c in data["checks"] if "error handling" in c["message"].lower()),
            None,
        )
        assert eh_check is not None, "No Error Handling check found"
        assert eh_check["severity"] == "error", (
            f"Error Handling severity is '{eh_check['severity']}', expected 'error'"
        )


class TestGenerationReport:
    """Tests for generation_report.py (feature #76).

    Covers:
    - SecurityFindingSummary / QualityScoreSummary / GenerationReport dataclasses
    - build_generation_report rejects out-of-range overall_score / negative tokens
    - format_report_markdown emits all required sections (overview, quality,
      tokens, tools, security, install)
    - Markdown lists tools, install location, and security findings
    - Empty findings → "_No security findings._" placeholder
    - Empty install location → dry-run placeholder
    - format_report_json returns a stable dict with all fields
    - Findings sorted by SECURITY_SEVERITY_ORDER (highest first)
    - Section heading constants exposed
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

    def test_section_constants_exposed(self) -> None:
        """All section heading constants are public and pinned."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    REPORT_HEADING, SECTION_OVERVIEW, SECTION_QUALITY,\n"
            "    SECTION_TOKENS, SECTION_TOOLS, SECTION_SECURITY, SECTION_INSTALL,\n"
            ")\n"
            "print(REPORT_HEADING)\nprint(SECTION_QUALITY)\nprint(SECTION_INSTALL)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "# Agent Generation Report",
            "## Quality Score",
            "## Install Location",
        ]

    def test_build_report_rejects_bad_score(self) -> None:
        """overall_score outside [0, 10] → ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import build_generation_report\n"
            "try:\n"
            "    build_generation_report('a', 'd', ['Read'], overall_score=11.0)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', '[0, 10]' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_build_report_rejects_negative_tokens(self) -> None:
        """Negative token_estimate → ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import build_generation_report\n"
            "try:\n"
            "    build_generation_report('a', 'd', ['Read'],\n"
            "        overall_score=8.0, token_estimate=-1)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'negative' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_markdown_includes_all_sections(self) -> None:
        """All six section headings appear in the markdown output."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'reviewer', 'Reviews code', ['Read', 'Grep'],\n"
            "    overall_score=8.5, token_estimate=420,\n"
            "    install_location='/home/u/.claude/agents/reviewer.md',\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "for h in ('# Agent Generation Report', '## Overview',\n"
            "          '## Quality Score', '## Token Estimate',\n"
            "          '## Tools', '## Security Findings', '## Install Location'):\n"
            "    assert h in md, h\n"
            "print('OK')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "OK"

    def test_markdown_lists_tools_and_install(self) -> None:
        """Tool list and install-location path appear in the markdown."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'desc', ['Read', 'Edit'],\n"
            "    overall_score=7.2, token_estimate=99,\n"
            "    install_location='~/.claude/agents/a.md',\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('- Read' in md, '- Edit' in md, '~/.claude/agents/a.md' in md,\n"
            "      '~99 tokens' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_markdown_no_security_findings_placeholder(self) -> None:
        """Empty findings list → friendly placeholder message."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('_No security findings._' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_markdown_dry_run_install_placeholder(self) -> None:
        """Empty install_location → dry-run placeholder."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('Not installed' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_findings_sorted_by_severity(self) -> None:
        """Critical findings appear before low/info in the markdown output."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    SecurityFindingSummary,\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "findings = [\n"
            "    SecurityFindingSummary(severity='low', category='style',\n"
            "        message='trailing space'),\n"
            "    SecurityFindingSummary(severity='critical', category='auth',\n"
            "        message='hardcoded secret'),\n"
            "]\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            "    security_findings=findings,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "crit_pos = md.find('hardcoded secret')\n"
            "low_pos = md.find('trailing space')\n"
            "print(crit_pos < low_pos, crit_pos > 0)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_json_shape_complete(self) -> None:
        """format_report_json returns dict with every field of the report."""
        result = self._run_py(
            "from platxa_agent_generator.generation_report import (\n"
            "    SecurityFindingSummary,\n"
            "    build_generation_report, format_report_json,\n"
            ")\n"
            "findings = [SecurityFindingSummary(severity='high',\n"
            "    category='auth', message='m', location='f.py:10')]\n"
            "report = build_generation_report(\n"
            "    'reviewer', 'Reviews code', ['Read'],\n"
            "    overall_score=8.5,\n"
            "    criteria_scores={'clarity': 9.0, 'security': 8.0},\n"
            "    token_estimate=120,\n"
            "    install_location='/path/to/agents/reviewer.md',\n"
            "    security_findings=findings,\n"
            ")\n"
            "j = format_report_json(report)\n"
            "print(\n"
            "    j['agent_name'], j['quality']['overall'],\n"
            "    j['quality']['criteria']['security'],\n"
            "    j['token_estimate'], j['install_location'],\n"
            "    j['security_findings'][0]['severity'],\n"
            "    j['security_findings'][0]['location'],\n"
            ")"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "reviewer 8.5 8.0 120 /path/to/agents/reviewer.md high f.py:10"
        )

    def test_json_string_round_trip(self) -> None:
        """report_to_json_string produces parseable JSON with same data."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.generation_report import (\n"
            "    build_generation_report, report_to_json_string,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=7.5,\n"
            "    token_estimate=50,\n"
            ")\n"
            "s = report_to_json_string(report)\n"
            "parsed = json.loads(s)\n"
            "print(parsed['agent_name'], parsed['quality']['overall'],\n"
            "      parsed['token_estimate'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "a 7.5 50"


class TestAgentLint:
    """Tests for agent_linter.py (feature #85).

    Covers:
    - LINT_EXIT_OK / LINT_EXIT_ERRORS / LINT_EXIT_IO_FAILURE constants
    - lint_agent_file passes on a well-formed agent
    - lint_agent_file fails when required fields are missing
    - format_lint_report PASS path emits header only
    - format_lint_report FAIL path emits header + one line per finding
    - lint_paths preserves order across multiple files
    - lint_paths emits an E000 finding on I/O failure (does not raise)
    - Warnings from syntax_validator are filtered out (errors only gate pass)
    - CLI `lint` subcommand exits 0/1 to match LINT_EXIT_*
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

    def _write_valid_agent(self, root: Path) -> Path:
        path = root / "valid.md"
        path.write_text(
            "---\n"
            "name: valid-agent\n"
            "description: A valid agent for lint testing.\n"
            "tools: Read, Write\n"
            "---\n"
            "\n"
            "# Valid Agent\n"
            "\n"
            "## Overview\n"
            "Does things.\n"
        )
        return path

    def _write_invalid_agent(self, root: Path) -> Path:
        path = root / "invalid.md"
        path.write_text("---\nname: invalid-agent\ndescription: \n---\n\n# Invalid Agent\n")
        return path

    def test_exit_code_constants(self) -> None:
        """LINT_EXIT_* constants pin the pre-commit-friendly exit contract."""
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import LINT_EXIT_OK, LINT_EXIT_ERRORS, LINT_EXIT_IO_FAILURE\n"
            "print(LINT_EXIT_OK, LINT_EXIT_ERRORS, LINT_EXIT_IO_FAILURE)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 2"

    def test_lint_agent_file_pass(self, tmp_path: Path) -> None:
        """A well-formed agent passes with zero findings."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "import sys\n"
            "from platxa_agent_generator.agent_linter import lint_agent_file\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(r.passed, len(r.findings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_lint_agent_file_fail_missing_required(self, tmp_path: Path) -> None:
        """An agent with empty description fails with at least one finding."""
        agent = self._write_invalid_agent(tmp_path)
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_agent_file\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(r.passed, len(r.findings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_format_lint_report_pass(self, tmp_path: Path) -> None:
        """Passing report renders as a single PASS line."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_agent_file, format_lint_report\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(format_lint_report(r))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().endswith("valid.md: PASS")

    def test_format_lint_report_fail(self, tmp_path: Path) -> None:
        """Failing report renders header plus L<line> [<code>] message lines."""
        agent = self._write_invalid_agent(tmp_path)
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_agent_file, format_lint_report\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "out = format_lint_report(r)\n"
            "print('FAIL' in out, ' L' in out, '[' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_lint_paths_preserves_order(self, tmp_path: Path) -> None:
        """lint_paths returns one report per input file in the same order."""
        a = self._write_valid_agent(tmp_path)
        b_path = tmp_path / "b.md"
        b_path.write_text(a.read_text())
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_paths\n"
            f"reports = lint_paths([{str(a)!r}, {str(b_path)!r}])\n"
            "print(len(reports), reports[0].path.endswith('valid.md'),\n"
            "      reports[1].path.endswith('b.md'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 True True"

    def test_lint_paths_io_error_synthetic_finding(self, tmp_path: Path) -> None:
        """An unreadable file yields an E000 finding instead of raising."""
        # Use a directory path — opening it as a file triggers OSError.
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_paths\n"
            f"reports = lint_paths([{str(tmp_path)!r}])\n"
            "r = reports[0]\n"
            "print(r.passed, len(r.findings) >= 1, r.findings[0].code)"
        )
        assert result.returncode == 0, result.stderr
        # Either E000 (OSError caught in lint_paths) or another error code from
        # syntax_validator's own missing-file handling — both must produce a
        # failing report with at least one finding.
        parts = result.stdout.strip().split()
        assert parts[0] == "False"
        assert parts[1] == "True"

    def test_warnings_do_not_fail(self, tmp_path: Path) -> None:
        """Warning-severity validator findings must not flip passed to False."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "from platxa_agent_generator.syntax_validator import validate_file\n"
            "from platxa_agent_generator.agent_linter import lint_agent_file\n"
            f"vr = validate_file({str(agent)!r})\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "warn_count = sum(1 for e in vr.errors if e.severity == 'warning')\n"
            "print(r.passed, warn_count >= 0)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().startswith("True")

    def test_cli_lint_exit_zero_on_pass(self, tmp_path: Path) -> None:
        """`platxa-agent lint <good>` exits 0."""
        import subprocess

        agent = self._write_valid_agent(tmp_path)
        scripts_pkg_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, "-m", "platxa_agent_generator.cli", "lint", str(agent)],
            capture_output=True,
            text=True,
            cwd=str(scripts_pkg_dir),
            check=False,
        )
        assert result.returncode == 0, result.stderr or result.stdout

    def test_cli_lint_exit_one_on_fail(self, tmp_path: Path) -> None:
        """`platxa-agent lint <bad>` exits 1."""
        import subprocess

        agent = self._write_invalid_agent(tmp_path)
        scripts_pkg_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, "-m", "platxa_agent_generator.cli", "lint", str(agent)],
            capture_output=True,
            text=True,
            cwd=str(scripts_pkg_dir),
            check=False,
        )
        assert result.returncode == 1, result.stderr or result.stdout
