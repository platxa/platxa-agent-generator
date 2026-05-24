"""Tests for feature #46: completion-promise marker convention in subagent files.

Verification criteria:
    1. All 4 subagent .md files (discovery, architecture, generation,
       validation) document the ``<promise>COMPLETE</promise>`` marker
       convention in their Output Format section.
    2. The syntax_validator passes for all 4 files.
    3. The documented marker matches the canonical constant in
       ``shared.constants``.
"""

from __future__ import annotations

import pathlib
import re

import pytest

from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER
from platxa_agent_generator.syntax_validator import validate_file

AGENTS_DIR = pathlib.Path(__file__).resolve().parent.parent / "agents"

SUBAGENT_FILES = [
    "discovery-subagent.md",
    "architecture-subagent.md",
    "generation-subagent.md",
    "validation-subagent.md",
]


@pytest.mark.parametrize("filename", SUBAGENT_FILES)
def test_subagent_documents_promise_marker(filename: str) -> None:
    """Each subagent file must contain the canonical promise marker."""
    path = AGENTS_DIR / filename
    content = path.read_text()
    assert COMPLETION_PROMISE_MARKER in content, (
        f"{filename} does not document the completion-promise marker"
    )


@pytest.mark.parametrize("filename", SUBAGENT_FILES)
def test_subagent_marker_in_output_format_section(filename: str) -> None:
    """The marker must appear within or after the Output Format section."""
    path = AGENTS_DIR / filename
    content = path.read_text()
    output_format_idx = content.find("## Output Format")
    assert output_format_idx != -1, f"{filename} missing '## Output Format' section"
    marker_idx = content.find(COMPLETION_PROMISE_MARKER, output_format_idx)
    assert marker_idx != -1, f"{filename}: marker not in Output Format section"


@pytest.mark.parametrize("filename", SUBAGENT_FILES)
def test_subagent_passes_syntax_validation(filename: str) -> None:
    """Syntax validator must pass after adding the marker convention."""
    path = AGENTS_DIR / filename
    result = validate_file(path)
    assert result.passed, f"{filename} failed syntax validation: {[str(e) for e in result.errors]}"


@pytest.mark.parametrize("filename", SUBAGENT_FILES)
def test_subagent_marker_matches_constant(filename: str) -> None:
    """The documented marker must be byte-identical to the shared constant."""
    path = AGENTS_DIR / filename
    content = path.read_text()
    matches = re.findall(r"<promise>.*?</promise>", content)
    assert matches, f"{filename}: no <promise>...</promise> pattern found"
    for match in matches:
        assert match == COMPLETION_PROMISE_MARKER, (
            f"{filename}: found '{match}' but expected '{COMPLETION_PROMISE_MARKER}'"
        )
