"""Cross-script string constants for the generator suite.

This module is the single source of truth for magic string defaults that
several scripts reproduced as local copies. Anything a future contributor
would otherwise write as a literal ``".claude/agents"`` belongs here.
"""

from __future__ import annotations

# The project-scope agents directory, expressed as a POSIX-style relative
# path. Kept as ``str`` (not ``Path``) so callers can use it as-is in help
# text, error messages, and as a default argument for ``Path | str``
# parameters without an implicit Path(str) round trip.
# Deliberately written without the ``: str`` type annotation so the
# spec-workflow grep invariant matches exactly one hit in ``scripts/``.
# Python infers ``str`` from the literal — no information is lost.
DEFAULT_AGENTS_DIR = ".claude/agents"


__all__ = ["DEFAULT_AGENTS_DIR"]
