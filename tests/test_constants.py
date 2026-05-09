"""Tests for :mod:`platxa_agent_generator.shared.constants`.

Feature #3 verification:
    1. ``COMPLETION_PROMISE_MARKER`` is exported from ``shared.constants``.
    2. The literal value is exactly ``"<promise>COMPLETE</promise>"`` —
       any drift breaks the goal-loop completion contract that features
       #15 (ralph-orchestrator), #16 (team-lead), and #33
       (hooks_generator stop-hook completion check) will rely on.
    3. The constant is in ``__all__`` so ``from … import *`` callers see
       it.

The "referenced by all 3 surfaces" half of the verification criterion is
a forward dependency: those surfaces are scoped to features #15, #16,
and #33 and do not exist yet. Each of those features will add its own
test asserting the import path. The drift-detection invariant is the
*literal value* check below, which protects every consumer regardless of
when it lands.
"""

from __future__ import annotations


def test_completion_promise_marker_is_exported() -> None:
    from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER

    assert isinstance(COMPLETION_PROMISE_MARKER, str)
    assert COMPLETION_PROMISE_MARKER  # non-empty


def test_completion_promise_marker_literal_value() -> None:
    # The literal MUST stay byte-for-byte stable. Stop-hook scripts and
    # generator agents do substring matching against this string; any
    # whitespace or capitalisation change silently breaks the contract.
    from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER

    assert COMPLETION_PROMISE_MARKER == "<promise>COMPLETE</promise>"


def test_completion_promise_marker_in_all() -> None:
    from platxa_agent_generator.shared import constants

    assert "COMPLETION_PROMISE_MARKER" in constants.__all__


def test_default_agents_dir_still_exported() -> None:
    # Regression guard: adding the new constant must not displace the
    # existing DEFAULT_AGENTS_DIR export.
    from platxa_agent_generator.shared import constants

    assert "DEFAULT_AGENTS_DIR" in constants.__all__
    assert constants.DEFAULT_AGENTS_DIR == ".claude/agents"


def test_completion_promise_marker_wraps_complete_in_xmlish_tags() -> None:
    # Documents the structural contract for Stop-hook grep: the marker
    # opens with "<promise>" and closes with "</promise>", and contains
    # the uppercase token "COMPLETE" verbatim. If any of these break, a
    # corresponding stop-hook script needs to be regenerated.
    from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER

    assert COMPLETION_PROMISE_MARKER.startswith("<promise>")
    assert COMPLETION_PROMISE_MARKER.endswith("</promise>")
    assert "COMPLETE" in COMPLETION_PROMISE_MARKER
