#!/usr/bin/env python3
"""
test_validation — sharded from test_generator.py.

Shards: 7 TestXxx classes.
Run with: pytest tests/test_validation.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestSyntaxValidator:
    """Real tests for syntax_validator.py CLI."""

    def test_valid_agent_passes_validation(self, tmp_path: Path) -> None:
        """Create a real valid agent file and validate it."""
        agent_file = tmp_path / "valid-agent.md"
        agent_file.write_text("""---
name: test-agent
description: A test agent for validation
tools: Read, Write
---

# Test Agent

## Overview
This is a test agent.

## Workflow
1. Read files
2. Write output
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        assert len(output["errors"]) == 0

    def test_missing_frontmatter_fails(self, tmp_path: Path) -> None:
        """Real test: file without frontmatter should fail."""
        agent_file = tmp_path / "no-frontmatter.md"
        agent_file.write_text("""# Test Agent

No frontmatter in this file.
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False

    def test_missing_name_field_fails(self, tmp_path: Path) -> None:
        """Real test: missing required 'name' field should fail."""
        agent_file = tmp_path / "no-name.md"
        agent_file.write_text("""---
description: Missing name field
tools: Read
---

# Test
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False

    def test_invalid_yaml_syntax_fails(self, tmp_path: Path) -> None:
        """Real test: invalid YAML syntax should fail."""
        agent_file = tmp_path / "bad-yaml.md"
        agent_file.write_text("""---
name: test
description: [unclosed bracket
tools: Read
---

# Test
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False

    def test_valid_permission_mode_passes(self, tmp_path: Path) -> None:
        """Agent with valid permissionMode should pass validation."""
        agent_file = tmp_path / "permission-agent.md"
        agent_file.write_text(
            "---\n"
            "name: safe-reader\n"
            "description: A read-only agent with explicit permission mode\n"
            "tools: Read, Grep, Glob\n"
            "permissionMode: default\n"
            "---\n"
            "\n"
            "# Safe Reader\n"
            "\n"
            "## Overview\n"
            "Read-only agent.\n"
            "\n"
            "## Workflow\n"
            "1. Read files\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        # No errors about permissionMode
        pm_errors = [e for e in output["errors"] if "permissionMode" in e.get("message", "")]
        assert len(pm_errors) == 0

    def test_invalid_permission_mode_fails(self, tmp_path: Path) -> None:
        """Agent with invalid permissionMode should produce error."""
        agent_file = tmp_path / "bad-permission.md"
        agent_file.write_text(
            "---\n"
            "name: bad-perms\n"
            "description: Agent with invalid permission mode\n"
            "tools: Read\n"
            "permissionMode: yolo\n"
            "---\n"
            "\n"
            "# Bad Perms\n"
            "\n"
            "## Overview\n"
            "Invalid mode.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        pm_errors = [e for e in output["errors"] if "E016" in e.get("code", "")]
        assert len(pm_errors) == 1

    def test_bypass_permissions_with_bash_warns(self, tmp_path: Path) -> None:
        """bypassPermissions with Bash should produce warning."""
        agent_file = tmp_path / "risky-perms.md"
        agent_file.write_text(
            "---\n"
            "name: risky-agent\n"
            "description: Agent with bypass and Bash\n"
            "tools: Bash, Read\n"
            "permissionMode: bypassPermissions\n"
            "---\n"
            "\n"
            "# Risky Agent\n"
            "\n"
            "## Overview\n"
            "Risky combo.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        # W016 is severity=warning, so it appears in the "warnings" key, not "errors"
        # Agent should still pass validation (warnings don't block)
        assert output["passed"] is True
        warnings = [w for w in output["warnings"] if "W016" in w.get("code", "")]
        assert len(warnings) == 1
        assert "bypassPermissions" in warnings[0]["message"]
        assert "Bash" in warnings[0]["message"]

    def test_valid_max_turns_passes(self, tmp_path: Path) -> None:
        """Agent with valid maxTurns should pass validation."""
        agent_file = tmp_path / "turns-agent.md"
        agent_file.write_text(
            "---\n"
            "name: bounded-agent\n"
            "description: Agent with execution limit\n"
            "tools: Read, Grep\n"
            "maxTurns: 25\n"
            "---\n"
            "\n"
            "# Bounded Agent\n"
            "\n"
            "## Overview\n"
            "Limited execution agent.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        mt_errors = [e for e in output["errors"] if "E017" in e.get("code", "")]
        assert len(mt_errors) == 0

    def test_zero_max_turns_fails(self, tmp_path: Path) -> None:
        """maxTurns=0 should produce error."""
        agent_file = tmp_path / "zero-turns.md"
        agent_file.write_text(
            "---\n"
            "name: zero-agent\n"
            "description: Agent with zero turns\n"
            "tools: Read\n"
            "maxTurns: 0\n"
            "---\n"
            "\n"
            "# Zero Agent\n"
            "\n"
            "## Overview\n"
            "Invalid turns.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        mt_errors = [e for e in output["errors"] if "E017" in e.get("code", "")]
        assert len(mt_errors) == 1

    def test_negative_max_turns_fails(self, tmp_path: Path) -> None:
        """Negative maxTurns should produce error."""
        agent_file = tmp_path / "neg-turns.md"
        agent_file.write_text(
            "---\n"
            "name: neg-agent\n"
            "description: Agent with negative turns\n"
            "tools: Read\n"
            "maxTurns: -5\n"
            "---\n"
            "\n"
            "# Neg Agent\n"
            "\n"
            "## Overview\n"
            "Invalid turns.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        mt_errors = [e for e in output["errors"] if "E017" in e.get("code", "")]
        assert len(mt_errors) == 1

    def test_excessive_max_turns_warns(self, tmp_path: Path) -> None:
        """maxTurns > 200 should produce warning but still pass."""
        agent_file = tmp_path / "high-turns.md"
        agent_file.write_text(
            "---\n"
            "name: high-turns-agent\n"
            "description: Agent with very high turns\n"
            "tools: Read\n"
            "maxTurns: 500\n"
            "---\n"
            "\n"
            "# High Turns Agent\n"
            "\n"
            "## Overview\n"
            "Excessive turns.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True  # Warning doesn't block
        warnings = [w for w in output["warnings"] if "W017" in w.get("code", "")]
        assert len(warnings) == 1
        assert "500" in warnings[0]["message"]


class TestModelValidation:
    """Tests for model frontmatter field validation."""

    def test_valid_model_sonnet_passes(self, tmp_path: Path) -> None:
        """Agent with valid model=sonnet should pass."""
        agent_file = tmp_path / "sonnet-agent.md"
        agent_file.write_text(
            "---\n"
            "name: sonnet-agent\n"
            "description: Standard agent using sonnet\n"
            "tools: Read, Grep\n"
            "model: sonnet\n"
            "---\n"
            "\n"
            "# Sonnet Agent\n"
            "\n"
            "## Overview\n"
            "Standard agent.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        model_errors = [e for e in output["errors"] if "E018" in e.get("code", "")]
        assert len(model_errors) == 0

    def test_valid_model_haiku_passes(self, tmp_path: Path) -> None:
        """Agent with model=haiku should pass."""
        agent_file = tmp_path / "haiku-agent.md"
        agent_file.write_text(
            "---\n"
            "name: haiku-linter\n"
            "description: Fast cheap validator\n"
            "tools: Read, Grep\n"
            "model: haiku\n"
            "---\n"
            "\n"
            "# Haiku Linter\n"
            "\n"
            "## Overview\n"
            "Quick validator.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True

    def test_invalid_model_fails(self, tmp_path: Path) -> None:
        """Agent with invalid model name should fail with E018."""
        agent_file = tmp_path / "bad-model.md"
        agent_file.write_text(
            "---\n"
            "name: bad-model-agent\n"
            "description: Agent with invalid model\n"
            "tools: Read\n"
            "model: gpt-4o\n"
            "---\n"
            "\n"
            "# Bad Model Agent\n"
            "\n"
            "## Overview\n"
            "Invalid model.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        model_errors = [e for e in output["errors"] if "E018" in e.get("code", "")]
        assert len(model_errors) == 1
        assert "gpt-4o" in model_errors[0]["message"]


class TestDisallowedToolsValidation:
    """Tests for disallowedTools frontmatter field validation."""

    def test_valid_disallowed_tools_passes(self, tmp_path: Path) -> None:
        """Agent with valid disallowedTools should pass."""
        agent_file = tmp_path / "disallow-agent.md"
        agent_file.write_text(
            "---\n"
            "name: safe-reader\n"
            "description: Read-only code analyzer\n"
            "tools: Read, Grep, Glob\n"
            "disallowedTools: Write, Edit, Bash\n"
            "---\n"
            "\n"
            "# Safe Reader\n"
            "\n"
            "## Overview\n"
            "Read-only analyzer.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        dt_errors = [e for e in output["errors"] if e.get("code", "").startswith("E01")]
        assert len(dt_errors) == 0

    def test_invalid_tool_in_disallowed_fails(self, tmp_path: Path) -> None:
        """Invalid tool name in disallowedTools should produce E019."""
        agent_file = tmp_path / "bad-disallow.md"
        agent_file.write_text(
            "---\n"
            "name: bad-disallow\n"
            "description: Agent with invalid disallowed tool\n"
            "tools: Read\n"
            "disallowedTools: FakeToolXyz\n"
            "---\n"
            "\n"
            "# Bad Disallow\n"
            "\n"
            "## Overview\n"
            "Invalid disallow.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        e019 = [e for e in output["errors"] if "E019" in e.get("code", "")]
        assert len(e019) == 1
        assert "FakeToolXyz" in e019[0]["message"]

    def test_overlap_with_tools_fails(self, tmp_path: Path) -> None:
        """Tool in both tools and disallowedTools should produce E020."""
        agent_file = tmp_path / "overlap-agent.md"
        agent_file.write_text(
            "---\n"
            "name: overlap-agent\n"
            "description: Agent with contradictory tool config\n"
            "tools: Read, Bash\n"
            "disallowedTools: Bash, Write\n"
            "---\n"
            "\n"
            "# Overlap Agent\n"
            "\n"
            "## Overview\n"
            "Contradictory config.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is False
        e020 = [e for e in output["errors"] if "E020" in e.get("code", "")]
        assert len(e020) == 1
        assert "Bash" in e020[0]["message"]

    def test_mcp_tool_in_disallowed_passes(self, tmp_path: Path) -> None:
        """MCP tool names in disallowedTools should be accepted."""
        agent_file = tmp_path / "mcp-disallow.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-safe\n"
            "description: Agent disallowing specific MCP tools\n"
            "tools: Read, Grep\n"
            "disallowedTools: mcp__github__push, mcp__db__write\n"
            "---\n"
            "\n"
            "# MCP Safe\n"
            "\n"
            "## Overview\n"
            "MCP tool restrictions.\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True


class TestDisallowedToolsRecommendation:
    """Tests for recommend_disallowed_tools() in security_scanner.py."""

    def test_read_only_agent_disallows_write_tools(self) -> None:
        """Read-only agent should recommend disallowing Write, Edit, Bash."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.security_scanner import recommend_disallowed_tools; "
                    "print(','.join(recommend_disallowed_tools("
                    "['Read', 'Grep', 'Glob'], description='read-only code analyzer')))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        recommended = set(result.stdout.strip().split(","))
        # read-only role should disallow Write, Edit, Bash, WebFetch, WebSearch
        assert "Write" in recommended
        assert "Edit" in recommended
        assert "Bash" in recommended

    def test_no_overlap_with_allowed_tools(self) -> None:
        """Recommendations should never include tools already in the allowed list."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.security_scanner import recommend_disallowed_tools; "
                    "r = recommend_disallowed_tools(['Read', 'Bash'], description='analyzer'); "
                    "print('Bash' not in r and 'Read' not in r)"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "True"

    def test_default_disallows_high_risk_not_in_tools(self) -> None:
        """Agent with no role keywords gets conservative default: disallow unused high-risk."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.security_scanner import recommend_disallowed_tools; "
                    "print(','.join(recommend_disallowed_tools("
                    "['Read', 'Grep'], description='some generic agent')))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        recommended = set(result.stdout.strip().split(","))
        # High-risk tools not in allowed list should be recommended
        assert "Bash" in recommended
        assert "Write" in recommended
        assert "Edit" in recommended
        assert "WebFetch" in recommended


class TestRemainingFrontmatterValidation:
    """Tests for isolation, effort, background, and color validation."""

    def _run_validator(self, agent_file: Path) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "syntax_validator.py"), "--json", str(agent_file)],
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    def _make_agent(self, tmp_path: Path, name: str, extra_fields: str) -> Path:
        agent_file = tmp_path / f"{name}.md"
        agent_file.write_text(
            f"---\nname: {name}\ndescription: Test agent\ntools: Read\n"
            f"{extra_fields}---\n\n# {name.title()}\n\n## Overview\nTest.\n"
        )
        return agent_file

    # --- isolation ---
    def test_valid_isolation_worktree_passes(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "iso-ok", "isolation: worktree\n")
        output = self._run_validator(f)
        assert output["passed"] is True

    def test_invalid_isolation_fails(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "iso-bad", "isolation: docker\n")
        output = self._run_validator(f)
        assert output["passed"] is False
        e021 = [e for e in output["errors"] if "E021" in e.get("code", "")]
        assert len(e021) == 1
        assert "docker" in e021[0]["message"]

    # --- effort ---
    def test_valid_effort_high_passes(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "eff-ok", "effort: high\n")
        output = self._run_validator(f)
        assert output["passed"] is True

    def test_invalid_effort_fails(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "eff-bad", "effort: ultrathink\n")
        output = self._run_validator(f)
        assert output["passed"] is False
        e022 = [e for e in output["errors"] if "E022" in e.get("code", "")]
        assert len(e022) == 1

    # --- background ---
    def test_valid_background_true_passes(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "bg-ok", "background: true\n")
        output = self._run_validator(f)
        assert output["passed"] is True

    def test_invalid_background_fails(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "bg-bad", "background: maybe\n")
        output = self._run_validator(f)
        assert output["passed"] is False
        e023 = [e for e in output["errors"] if "E023" in e.get("code", "")]
        assert len(e023) == 1

    # --- color ---
    def test_valid_named_color_passes(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "clr-name", "color: red\n")
        output = self._run_validator(f)
        assert output["passed"] is True

    def test_valid_hex_color_passes(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "clr-hex", "color: '#ff5500'\n")
        output = self._run_validator(f)
        assert output["passed"] is True

    def test_invalid_color_fails(self, tmp_path: Path) -> None:
        f = self._make_agent(tmp_path, "clr-bad", "color: rainbow\n")
        output = self._run_validator(f)
        assert output["passed"] is False
        e024 = [e for e in output["errors"] if "E024" in e.get("code", "")]
        assert len(e024) == 1
        assert "rainbow" in e024[0]["message"]

    # --- combined: agent with all fields valid ---
    def test_all_new_fields_valid_passes(self, tmp_path: Path) -> None:
        """Agent with every frontmatter field set correctly should pass."""
        f = self._make_agent(
            tmp_path,
            "full-agent",
            "permissionMode: default\nmaxTurns: 25\nmodel: sonnet\n"
            "disallowedTools: Bash, WebFetch\nisolation: worktree\n"
            "effort: high\nbackground: false\ncolor: blue\n",
        )
        output = self._run_validator(f)
        assert output["passed"] is True
        assert len(output["errors"]) == 0


class TestMcpServersValidation:
    """Tests for mcpServers frontmatter validation (E025)."""

    def _run_validator(self, agent_file: Path) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "syntax_validator.py"), "--json", str(agent_file)],
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    def test_valid_stdio_server_passes(self, tmp_path: Path) -> None:
        """Valid mcpServers with stdio transport (command field) should pass."""
        agent_file = tmp_path / "mcp-stdio.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-stdio\n"
            "description: Agent with MCP stdio server\n"
            "tools: Read\n"
            "mcpServers:\n"
            "  filesystem:\n"
            "    command: npx\n"
            "    args:\n"
            "      - '-y'\n"
            "      - '@modelcontextprotocol/server-filesystem'\n"
            "    env:\n"
            "      HOME: /home/user\n"
            "---\n\n"
            "# MCP Stdio Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is True

    def test_valid_http_server_passes(self, tmp_path: Path) -> None:
        """Valid mcpServers with http transport (url field) should pass."""
        agent_file = tmp_path / "mcp-http.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-http\n"
            "description: Agent with MCP http server\n"
            "tools: Read\n"
            "mcpServers:\n"
            "  remote-api:\n"
            "    url: https://api.example.com/mcp\n"
            "---\n\n"
            "# MCP HTTP Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is True

    def test_missing_command_and_url_fails(self, tmp_path: Path) -> None:
        """mcpServers entry without command or url should fail with E025."""
        agent_file = tmp_path / "mcp-bad.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-bad\n"
            "description: Agent with bad MCP config\n"
            "tools: Read\n"
            "mcpServers:\n"
            "  broken-server:\n"
            "    args:\n"
            "      - '--verbose'\n"
            "---\n\n"
            "# MCP Bad Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is False
        e025 = [e for e in output["errors"] if "E025" in e.get("code", "")]
        assert len(e025) >= 1
        assert "broken-server" in e025[0]["message"]

    def test_invalid_server_entry_type_fails(self, tmp_path: Path) -> None:
        """mcpServers entry that is not a mapping should fail with E025."""
        agent_file = tmp_path / "mcp-scalar.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-scalar\n"
            "description: Agent with scalar MCP entry\n"
            "tools: Read\n"
            "mcpServers:\n"
            "  bad-entry: just-a-string\n"
            "---\n\n"
            "# MCP Scalar Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is False
        e025 = [e for e in output["errors"] if "E025" in e.get("code", "")]
        assert len(e025) >= 1
        assert "bad-entry" in e025[0]["message"]

    def test_empty_command_fails(self, tmp_path: Path) -> None:
        """mcpServers entry with empty command string should fail with E025."""
        agent_file = tmp_path / "mcp-empty-cmd.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-empty-cmd\n"
            "description: Agent with empty command\n"
            "tools: Read\n"
            "mcpServers:\n"
            "  empty-cmd:\n"
            "    command: ''\n"
            "---\n\n"
            "# MCP Empty Cmd Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is False
        e025 = [e for e in output["errors"] if "E025" in e.get("code", "")]
        assert len(e025) >= 1

    def test_multiple_valid_servers_pass(self, tmp_path: Path) -> None:
        """Multiple valid mcpServers entries should all pass."""
        agent_file = tmp_path / "mcp-multi.md"
        agent_file.write_text(
            "---\n"
            "name: mcp-multi\n"
            "description: Agent with multiple MCP servers\n"
            "tools: Read, Bash\n"
            "mcpServers:\n"
            "  filesystem:\n"
            "    command: npx\n"
            "    args:\n"
            "      - '-y'\n"
            "      - '@modelcontextprotocol/server-filesystem'\n"
            "  thinking:\n"
            "    command: npx\n"
            "    args:\n"
            "      - '-y'\n"
            "      - '@modelcontextprotocol/server-sequential-thinking'\n"
            "  remote:\n"
            "    url: https://mcp.example.com/v1\n"
            "---\n\n"
            "# MCP Multi Agent\n\n## Overview\nTest.\n"
        )
        output = self._run_validator(agent_file)
        assert output["passed"] is True
