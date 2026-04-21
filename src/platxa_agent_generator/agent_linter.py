"""Fast structural lint for agent definition files.

Thin wrapper around :mod:`syntax_validator` that keeps only the errors
(not warnings) and produces a compact, pre-commit-friendly report. The
contract here is **fast feedback** — a single pass through the file with
no network, subprocess, or AST work beyond YAML frontmatter parsing.
Full quality scoring (rubric evaluation, prompt-structure checks, token
counting) belongs in :mod:`quality_scorer`, not here.

Public surface:

- :class:`LintFinding` — a single error with line + code + message
- :class:`LintReport` — aggregate for one file
- :func:`lint_agent_file` — lint a path → LintReport
- :func:`format_lint_report` — render to one-finding-per-line text
- :func:`lint_paths` — lint many files, aggregating into a list
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

try:
    from .syntax_validator import ValidationError, validate_file
except ImportError:
    from syntax_validator import (  # type: ignore[import-not-found,no-redef]
        ValidationError,
        validate_file,
    )

# Exit codes used by the CLI. 0 means clean, 1 means lint errors were
# found (suitable for pre-commit hooks). 2 is reserved for "I/O or
# unexpected failure" so callers can distinguish "your file has errors"
# from "the linter itself broke".
LINT_EXIT_OK: int = 0
LINT_EXIT_ERRORS: int = 1
LINT_EXIT_IO_FAILURE: int = 2


@dataclass
class LintFinding:
    """One lint error from a single agent file.

    Warnings are deliberately dropped by :func:`lint_agent_file` — the
    whole point of the linter is to give pre-commit hooks a hard
    pass/fail signal. Anything reported here is load-bearing enough
    that the agent should not be shipped until it's resolved.
    """

    line: int
    code: str
    message: str


@dataclass
class LintReport:
    """Aggregate lint report for one agent file."""

    path: str
    passed: bool
    findings: list[LintFinding] = field(default_factory=list)


def _finding_from_error(error: ValidationError) -> LintFinding:
    """Project a ValidationError into a LintFinding (drops column + severity)."""
    return LintFinding(line=error.line, code=error.code, message=error.message)


def lint_agent_file(path: Path | str) -> LintReport:
    """Lint a single agent definition file.

    Delegates to :func:`syntax_validator.validate_file`, filters out
    warnings, and returns a :class:`LintReport`. ``passed`` is True only
    when there are zero error-severity findings — warnings don't affect
    it, keeping pre-commit hook signal low-noise.
    """
    p = Path(path)
    result = validate_file(p)
    findings = [_finding_from_error(e) for e in result.errors if e.severity == "error"]
    return LintReport(
        path=str(p),
        passed=not findings,
        findings=findings,
    )


def format_lint_report(report: LintReport) -> str:
    """Render a single report as one line per finding (plus a header).

    Format::

        path/to/agent.md: FAIL (2 errors)
          L12 [E101] description cannot be empty
          L05 [E203] unknown tool 'FooBar'

    When the file passes, emits only the header (``… : PASS``) so
    pre-commit hooks can keep their output small on green runs.
    """
    if report.passed:
        return f"{report.path}: PASS"
    lines = [
        f"{report.path}: FAIL ({len(report.findings)} error"
        + ("s" if len(report.findings) != 1 else "")
        + ")"
    ]
    for finding in report.findings:
        lines.append(f"  L{finding.line:02d} [{finding.code}] {finding.message}")
    return "\n".join(lines)


def lint_paths(paths: list[Path | str]) -> list[LintReport]:
    """Lint multiple files. Order preserved; failures do not halt the batch.

    An I/O error on one file produces a failing report for that file
    (with a synthetic E000 finding) rather than aborting — so a
    pre-commit hook pass can still surface all errors in one go.
    """
    reports: list[LintReport] = []
    for raw in paths:
        p = Path(raw)
        try:
            reports.append(lint_agent_file(p))
        except OSError as exc:
            reports.append(
                LintReport(
                    path=str(p),
                    passed=False,
                    findings=[
                        LintFinding(
                            line=0,
                            code="E000",
                            message=f"I/O error while linting: {exc}",
                        )
                    ],
                )
            )
    return reports
