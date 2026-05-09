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

# Sentinel string emitted by goal-loop generator agents (team-lead,
# ralph-orchestrator) and matched by their corresponding Stop-hook
# completion check (generated via hooks_generator) to signal "the goal
# loop has produced its final output and should not re-prompt."
#
# Matching protocol (CANONICAL — feature #33's stop-hook generator MUST
# implement this, not a naive substring grep):
#   1. Regex-extract the inner token with ``<promise>(.*?)</promise>``
#      (non-greedy, single match) from the agent's last assistant
#      message.
#   2. Compare the extracted inner token to the literal ``"COMPLETE"``
#      via byte-exact equality.
# This is the same shape the official ``ralph-loop`` plugin's
# ``stop-hook.sh`` already uses (Perl regex extract + bash string
# equality). A naive substring search for the full marker would
# false-positive on any agent prose that discusses the marker — this
# very source comment included.
#
# The pseudo-XML wrapping exists for the regex extraction; it is NOT a
# substring-collision guard. The inner ``COMPLETE`` token is uppercase
# only by convention and is documented by the structural test in
# ``tests/test_constants.py``.
#
# This constant is the SINGLE source of truth — feature #15
# (agents/ralph-orchestrator.md), feature #16 (agents/team-lead.md), and
# feature #33 (hooks_generator.generate_stop_hook_completion_check) MUST
# import this name rather than re-typing the literal. Drift between any
# two surfaces silently breaks the goal-loop completion contract; pinning
# the literal here is the only mechanism that prevents that.
COMPLETION_PROMISE_MARKER = "<promise>COMPLETE</promise>"


__all__ = ["DEFAULT_AGENTS_DIR", "COMPLETION_PROMISE_MARKER"]
