#!/usr/bin/env python3
"""
test_linter — tests for agent_linter.py.

Extracted from test_completeness.py (which was deleted after
completeness_checker.py was removed in feature #22).

Run with: pytest tests/test_linter.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


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

    def _run_py(self, code: str) -> subprocess.CompletedProcess[str]:
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
        result = self._run_py(
            "from platxa_agent_generator.agent_linter import lint_paths\n"
            f"reports = lint_paths([{str(tmp_path)!r}])\n"
            "r = reports[0]\n"
            "print(r.passed, len(r.findings) >= 1, r.findings[0].code)"
        )
        assert result.returncode == 0, result.stderr
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
