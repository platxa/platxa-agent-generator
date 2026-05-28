"""Tests for team-lead orchestration constants.

Template-based hook tests (completion-promise script generation, config
structure, iteration cap) were removed when the corresponding
generate_stop_hook_completion_check() and
generate_stop_hook_completion_check_config() template functions moved to
skills/platxa-agent-generator/references/hooks-config-templates.md.
"""

from __future__ import annotations

from platxa_agent_generator.shared.constants import COMPLETION_PROMISE_MARKER


class TestCompletionPromiseConstant:
    """Verify the completion-promise marker value is stable."""

    def test_marker_constant_value_is_stable(self) -> None:
        assert COMPLETION_PROMISE_MARKER == "<promise>COMPLETE</promise>"
