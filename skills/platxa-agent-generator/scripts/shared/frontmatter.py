"""Canonical YAML frontmatter parser for the generator suite.

Before feature #26 four call sites (``syntax_validator.py``,
``agent_composer.py``, and two blocks in ``security_scanner.py``) each
re-implemented delimiter detection + ``yaml.safe_load`` with subtly
different error handling — one raised ``SecurityFinding`` on a malformed
``---``, another returned ``None``, a third swallowed the error and
emitted a warning. Consolidating here means a single reviewed
implementation of:

- opening / closing ``---`` delimiter detection (errors E001 / E002)
- ``yaml.safe_load`` with ``MarkedYAMLError`` line reporting (error E003)
- type enforcement that the YAML root is a mapping (error E003 variant)

Callers that need extra work on top (normalization, field extraction)
build on top of ``parse_frontmatter_safe`` rather than duplicate the
parse. Callers that only need a dict or ``None`` consume the shape
directly. The function's return type is deliberately a two-tuple so the
caller can deconstruct without slicing — matches the feature-#26 spec.

``ValidationError`` lives here too so downstream modules (notably
``syntax_validator.py``, which re-exports it for backward compatibility
with ``agent_linter.py``) can speak one vocabulary.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import yaml

__all__ = ["ValidationError", "parse_frontmatter_safe"]


@dataclass
class ValidationError:
    """A single validation error produced during frontmatter parsing.

    Canonical shape reused across the generator suite: ``line`` is 1-based
    file line; ``column`` is 1-based (kept for cross-tool compatibility
    even though most frontmatter errors set it to ``1``); ``severity`` is
    ``"error"`` or ``"warning"``; ``code`` is a stable short identifier
    (``E001``/``E002``/``E003`` for the three parse failure modes);
    ``message`` is human-readable.
    """

    line: int
    column: int
    severity: str
    code: str
    message: str


def parse_frontmatter_safe(
    content: str,
) -> tuple[dict[str, Any] | None, list[ValidationError]]:
    """Parse YAML frontmatter from an agent/skill/command file's content.

    Contract (matches feature #26):
      - Success: returns ``(dict, [])`` — a valid mapping with no errors.
      - Failure: returns ``(None, [one or more ValidationError])`` — every
        failure mode populates ``errors`` with at least one entry; the
        caller never has to infer "parse failed" from a bare ``None``.

    Failure codes:
      - ``E001`` — missing opening ``---`` delimiter (content doesn't
        look like a frontmatter-prefixed file at all).
      - ``E002`` — opening delimiter present but no closing ``---``.
      - ``E003`` — YAML syntax error OR the YAML root is not a mapping
        (lists, bare scalars, and other non-dict shapes are rejected
        because the downstream schema assumes dict access).

    A YAML document that parses to ``None`` (empty frontmatter) is
    normalized to an empty dict and returned as a success — callers then
    hit the "missing required field" rules in their own validators,
    which is the appropriate layer for that policy decision.
    """
    errors: list[ValidationError] = []
    lines = content.split("\n")

    # Opening delimiter — must be the very first non-empty token.
    # We explicitly check lines[0] rather than scanning for the first
    # ``---`` because a frontmatter block that doesn't start at line 1
    # is not a valid frontmatter by the Claude Code convention.
    if not lines or lines[0].strip() != "---":
        errors.append(
            ValidationError(
                line=1,
                column=1,
                severity="error",
                code="E001",
                message="Missing frontmatter opening delimiter '---'",
            )
        )
        return None, errors

    # Closing delimiter. Note the 1-based line numbering in the iterator:
    # ``enumerate(lines[1:], start=2)`` means line 2 is the first line
    # AFTER the opening ``---`` in the original file, which is how the
    # ValidationError messages should reference positions.
    end_line = -1
    for i, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            end_line = i
            break

    if end_line == -1:
        errors.append(
            ValidationError(
                line=1,
                column=1,
                severity="error",
                code="E002",
                message="Missing frontmatter closing delimiter '---'",
            )
        )
        return None, errors

    # YAML parse. ``lines[1 : end_line - 1]`` yields everything strictly
    # between the two ``---`` delimiters — the -1 is because ``end_line``
    # is 1-based AFTER the ``start=2`` adjustment above, so the exclusive
    # stop index for slicing is ``end_line - 1``.
    yaml_content = "\n".join(lines[1 : end_line - 1])
    try:
        data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as exc:
        # Try to surface the real offending line by inspecting
        # MarkedYAMLError. Fall back to "first line of frontmatter"
        # (line 2 in file coordinates) if the exception has no mark.
        error_line = 2
        error_msg = str(exc)
        if isinstance(exc, yaml.MarkedYAMLError) and exc.problem_mark is not None:
            error_line = exc.problem_mark.line + 2
            error_msg = exc.problem if exc.problem else str(exc)

        errors.append(
            ValidationError(
                line=error_line,
                column=1,
                severity="error",
                code="E003",
                message=f"Invalid YAML syntax: {error_msg}",
            )
        )
        return None, errors

    # Normalize empty frontmatter to ``{}`` rather than ``None``. Callers
    # expect dict-shaped access; an empty mapping trips the same
    # "missing required field" policy as a mapping that literally has no
    # keys — the two are semantically identical from the schema layer's
    # perspective, so collapse them here.
    if data is None:
        data = {}

    if not isinstance(data, dict):
        errors.append(
            ValidationError(
                line=2,
                column=1,
                severity="error",
                code="E003",
                message=f"Frontmatter must be a YAML mapping, got {type(data).__name__}",
            )
        )
        return None, errors

    return data, errors
