#!/usr/bin/env python3
"""
test_conftest_check — sharded from test_generator.py.

Shards: 1 TestXxx classes.
Run with: pytest tests/test_conftest_check.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestConftestFixtures:
    """Tests for Feature #82: Comprehensive conftest.py fixtures with full frontmatter."""

    VALIDATOR_SCRIPT = str(SCRIPTS_DIR / "syntax_validator.py")
    SCORER_SCRIPT = str(SCRIPTS_DIR / "quality_scorer.py")

    def _validate(self, tmp_path, content: str) -> dict:
        """Run syntax_validator on content and return JSON result.

        Note: validator returns exit code 1 for invalid agents — that is
        correct behavior, not a crash. We only check stderr for real errors.
        """
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text(content, encoding="utf-8")
        result = subprocess.run(
            [sys.executable, self.VALIDATOR_SCRIPT, str(agent_file), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        # Validator outputs JSON on stdout even for invalid files (exit 1).
        # Only assert no stderr crash output.
        assert result.stdout.strip(), f"Validator produced no output: {result.stderr}"
        return json.loads(result.stdout)

    def test_full_frontmatter_agent_passes_validation(self, tmp_path, full_frontmatter_agent):
        """Full frontmatter agent passes syntax validation."""
        data = self._validate(tmp_path, full_frontmatter_agent)
        assert data["passed"] is True, f"Full agent invalid: {data.get('errors')}"

    def test_full_frontmatter_has_all_fields(self, full_frontmatter_agent):
        """Full frontmatter fixture contains all supported frontmatter fields."""
        required_fields = [
            "name:",
            "description:",
            "tools:",
            "permissionMode:",
            "model:",
            "maxTurns:",
            "isolation:",
            "effort:",
            "background:",
            "color:",
            "disallowedTools:",
            "mcpServers:",
        ]
        for field in required_fields:
            assert field in full_frontmatter_agent, f"Missing field: {field}"

    def test_minimal_agent_passes_validation(self, tmp_path, minimal_agent):
        """Minimal agent with only required fields passes syntax validation."""
        data = self._validate(tmp_path, minimal_agent)
        assert data["passed"] is True, f"Minimal agent invalid: {data.get('errors')}"

    def test_agent_missing_name_detected(self, tmp_path, agent_missing_name):
        """Agent without name field is detected by validator."""
        data = self._validate(tmp_path, agent_missing_name)
        assert data["passed"] is False

    def test_agent_missing_description_detected(self, tmp_path, agent_missing_description):
        """Agent without description field is detected."""
        data = self._validate(tmp_path, agent_missing_description)
        assert data["passed"] is False

    def test_agent_missing_tools_detected(self, tmp_path, agent_missing_tools):
        """Agent without tools field is detected."""
        data = self._validate(tmp_path, agent_missing_tools)
        assert data["passed"] is False

    def test_empty_frontmatter_detected(self, tmp_path, agent_empty_frontmatter):
        """Agent with empty frontmatter block is detected as invalid."""
        data = self._validate(tmp_path, agent_empty_frontmatter)
        assert data["passed"] is False

    def test_no_frontmatter_detected(self, tmp_path, agent_no_frontmatter):
        """Agent with no frontmatter at all is detected as invalid."""
        data = self._validate(tmp_path, agent_no_frontmatter)
        assert data["passed"] is False

    def test_full_agent_has_mcp_in_frontmatter(self, full_frontmatter_agent):
        """Full agent fixture includes mcpServers block."""
        assert "mcpServers:" in full_frontmatter_agent
        assert "filesystem:" in full_frontmatter_agent
        assert "@modelcontextprotocol/server-filesystem" in full_frontmatter_agent

    def test_mcp_agent_fixture_has_two_servers(self, agent_with_mcp_servers):
        """MCP agent fixture defines two MCP servers."""
        assert "sequential-thinking:" in agent_with_mcp_servers
        assert "filesystem:" in agent_with_mcp_servers

    def test_hooks_agent_has_permission_and_model(self, agent_with_hooks_config):
        """Hooks agent fixture has permissionMode and model fields."""
        assert "permissionMode: acceptEdits" in agent_with_hooks_config
        assert "model: opus" in agent_with_hooks_config
