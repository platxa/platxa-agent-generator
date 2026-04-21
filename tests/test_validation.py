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


class TestMcpConfigGenerator:
    """Tests for mcp_config_generator.py (feature #18).

    The 865-LOC ``mcp_config_generator`` module had zero tests before this
    class. It generates ``.mcp.json`` files that Claude Code will load at
    startup, so every validator is on the trust boundary — a URL, command,
    or path that slips through here ends up on the agent's tool surface.

    Coverage:
    - ``validate_server_name``: empty/length/charset/hyphen-edge rejection
    - ``validate_url``: scheme whitelist (http/https), env placeholders,
      javascript:/ftp:/empty rejected
    - ``validate_command``: safelist enforcement, basename parsing,
      traversal (``../../bin/sh``) rejected, metacharacter embedding
      rejected, absolute-path bypass pinned as current behavior
    - ``validate_path_safe``: cwd/home/tmp root enforcement,
      shell-metacharacter (``$`` ``;`` `` ` ``) rejection
    - ``.mcp.json`` emission via ``generate_mcp_json``: wrapped
      ``mcpServers`` format, unknown-server rejection, empty-list
      rejection, adversarial ``output_path`` rejection
    - Round-trip: ``server_to_dict`` ⇄ ``create_server_from_dict`` is
      lossless for stdio and http shapes
    - Duplicate handling: ``recommend_mcp_servers`` dedupes via count
      dict; ``generate_config`` collapses duplicate names to last-write-
      wins (pins current dict-based behavior)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    # ------------------------------------------------------------------
    # validate_server_name
    # ------------------------------------------------------------------

    def test_validate_server_name_empty_rejected(self) -> None:
        """Empty name is rejected with an explicit message."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_server_name\n"
            "ok, msg = validate_server_name('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_server_name_valid_alphanumeric_with_hyphen(self) -> None:
        """Lowercase alphanumeric + interior hyphen is accepted."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_server_name\n"
            "print(validate_server_name('brave-search-v2'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_server_name_uppercase_rejected(self) -> None:
        """Uppercase letters are rejected — spec allows only lowercase."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_server_name\n"
            "ok, msg = validate_server_name('GitHub')\n"
            "print(ok, 'lowercase' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_server_name_edge_hyphens_rejected(self) -> None:
        """Leading or trailing hyphen is rejected."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_server_name\n"
            "print(validate_server_name('-leading')[0],\n"
            "      validate_server_name('trailing-')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False False"

    # ------------------------------------------------------------------
    # validate_url — scheme whitelist
    # ------------------------------------------------------------------

    def test_validate_url_empty_rejected(self) -> None:
        """Empty URL is rejected."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "ok, msg = validate_url('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_url_https_accepted(self) -> None:
        """https:// URLs are accepted."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "print(validate_url('https://api.example.com/mcp'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_url_http_accepted(self) -> None:
        """http:// URLs are accepted (common for local dev)."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "print(validate_url('http://localhost:8080/mcp'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_url_ftp_rejected(self) -> None:
        """ftp:// is rejected — not in the http(s) scheme whitelist."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "ok, msg = validate_url('ftp://files.example.com/x')\n"
            "print(ok, 'http' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_url_javascript_scheme_rejected(self) -> None:
        """javascript: URI is rejected — protects against scheme injection."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "print(validate_url('javascript:alert(1)')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_validate_url_env_placeholder_accepted(self) -> None:
        """${VAR}-form placeholder is accepted (late binding via env)."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_url\n"
            "print(validate_url('${MCP_REMOTE_URL}'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    # ------------------------------------------------------------------
    # validate_command — traversal, empty, metachars
    # ------------------------------------------------------------------

    def test_validate_command_empty_rejected(self) -> None:
        """stdio servers require a non-empty command."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\n"
            "ok, msg = validate_command('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_command_safelisted_node_accepted(self) -> None:
        """'node' (bare safelist entry) is accepted."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\nprint(validate_command('node'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_command_unsafe_bare_rejected(self) -> None:
        """'rm' is rejected — not on the safe-command whitelist."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\n"
            "ok, msg = validate_command('rm')\n"
            "print(ok, 'allowed' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_command_relative_traversal_rejected(self) -> None:
        """``../../bin/sh`` is rejected — basename 'sh' not in safelist.

        Pins the traversal-rejection: a relative path escaping upward
        doesn't start with ``/``, and its basename isn't on the
        safelist, so both fallback branches fail.
        """
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\n"
            "print(validate_command('../../bin/sh')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_validate_command_metachar_embedded_rejected(self) -> None:
        """``node;rm -rf /`` is rejected — metachar-laced string is not the token 'node'."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\n"
            "print(validate_command('node;rm -rf /')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_validate_command_absolute_path_accepted(self) -> None:
        """Absolute paths are accepted (current permissive behavior).

        Pins an intentional design choice: an operator-provided absolute
        path bypasses the safelist. Worth pinning explicitly so any
        future tightening (e.g. requiring basename ∈ safelist even for
        absolute paths) shows up as a test failure rather than a silent
        behavior change.
        """
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_command\n"
            "print(validate_command('/usr/local/bin/node'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    # ------------------------------------------------------------------
    # validate_path_safe
    # ------------------------------------------------------------------

    def test_validate_path_safe_cwd_relative_accepted(self) -> None:
        """A plain relative path resolves under cwd and is accepted."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_path_safe\n"
            "print(validate_path_safe('./output.json'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_path_safe_outside_roots_rejected(self) -> None:
        """A path that resolves outside cwd/home/tmp is rejected."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('/etc/passwd')\n"
            "print(ok, 'within' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_dollar_rejected(self) -> None:
        """``$`` is treated as a suspicious shell metacharacter."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('./$PWD/out.json')\n"
            "print(ok, 'Suspicious' in msg and '$' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_semicolon_rejected(self) -> None:
        """``;`` (command separator) is rejected."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('./out.json;rm -rf .')\n"
            "print(ok, 'Suspicious' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_backtick_rejected(self) -> None:
        """Backtick (command substitution) is rejected."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import validate_path_safe\n"
            "ok, _ = validate_path_safe('./out`whoami`.json')\n"
            "print(ok)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    # ------------------------------------------------------------------
    # .mcp.json emission — adversarial inputs
    # ------------------------------------------------------------------

    def test_generate_mcp_json_writes_wrapped_format(self) -> None:
        """``generate_mcp_json`` writes a file with the mcpServers wrapper."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.mcp_config_generator import generate_mcp_json\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    ok, _msg, path = generate_mcp_json(['playwright'], td)\n"
            "    data = json.loads(Path(path).read_text())\n"
            "    print(ok,\n"
            "          'mcpServers' in data,\n"
            "          'playwright' in data['mcpServers'],\n"
            "          data['mcpServers']['playwright']['command'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True npx"

    def test_generate_mcp_json_unknown_server_rejected(self) -> None:
        """Unknown server names are rejected — no file is written."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.mcp_config_generator import generate_mcp_json\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    ok, msg, path = generate_mcp_json(['definitely-not-a-server'], td)\n"
            "    print(ok, 'Unknown' in msg, path, (Path(td) / '.mcp.json').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True  False"

    def test_generate_mcp_json_empty_rejected(self) -> None:
        """Empty server list is rejected before any filesystem work."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.mcp_config_generator import generate_mcp_json\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    ok, msg, path = generate_mcp_json([], td)\n"
            "    print(ok, 'No servers' in msg, (Path(td) / '.mcp.json').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True False"

    def test_generate_rejects_adversarial_output_path(self) -> None:
        """``generate`` refuses output paths containing shell metacharacters.

        Even when the servers validate cleanly, an output_path like
        ``./foo;rm -rf .`` must be rejected by ``validate_path_safe``
        before any file is written.
        """
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import generate, SERVER_TEMPLATES\n"
            "ok, msg, path = generate(\n"
            "    servers=[SERVER_TEMPLATES['playwright']],\n"
            "    output_path='./foo;rm -rf .',\n"
            ")\n"
            "print(ok, 'Invalid output path' in msg, repr(path))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True ''"

    # ------------------------------------------------------------------
    # Round-trip: server_to_dict ⇄ create_server_from_dict
    # ------------------------------------------------------------------

    def test_stdio_server_roundtrip_lossless(self) -> None:
        """A stdio MCPServer survives server_to_dict → create_server_from_dict."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import (\n"
            "    MCPServer, create_server_from_dict, server_to_dict,\n"
            ")\n"
            "orig = MCPServer(name='db', server_type='stdio', command='node',\n"
            "                 args=['server.js'], env={'PORT': '5432'})\n"
            "d = server_to_dict(orig)\n"
            "d['name'] = 'db'\n"
            "rt = create_server_from_dict(d)\n"
            "print(rt.name, rt.server_type, rt.command, rt.args, rt.env)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "db stdio node ['server.js'] {'PORT': '5432'}"

    def test_http_server_roundtrip_lossless(self) -> None:
        """An http MCPServer survives server_to_dict → create_server_from_dict."""
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import (\n"
            "    MCPServer, create_server_from_dict, server_to_dict,\n"
            ")\n"
            "orig = MCPServer(name='api', server_type='http',\n"
            "                 url='https://api.example.com/mcp',\n"
            "                 headers={'Authorization': 'Bearer X'})\n"
            "d = server_to_dict(orig)\n"
            "d['name'] = 'api'\n"
            "rt = create_server_from_dict(d)\n"
            "print(rt.name, rt.server_type, rt.url, rt.headers)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "api http https://api.example.com/mcp {'Authorization': 'Bearer X'}"
        )

    # ------------------------------------------------------------------
    # Duplicate handling
    # ------------------------------------------------------------------

    def test_recommend_dedupes_server_recommended_by_multiple_domains(self) -> None:
        """``recommend_mcp_servers`` returns a server once even when
        multiple domain keywords recommend it.

        'web' and 'search' domains both include ``fetch``; a description
        mentioning both should list 'fetch' exactly once and rank it
        first (highest match count).
        """
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import recommend_mcp_servers\n"
            "rec = recommend_mcp_servers(description='web search agent')\n"
            "print(rec.count('fetch'), rec[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 fetch"

    def test_generate_config_duplicate_names_last_wins(self) -> None:
        """Two servers with the same name collapse to one entry (last wins).

        Pins the current dict-based emission: ``generate_config`` writes
        ``servers_dict[server.name] = server_to_dict(server)`` in order,
        so duplicates silently overwrite. This is the de-facto rejection
        behavior — worth pinning so a future explicit-rejection change
        shows up as a test update rather than a silent behavior flip.
        """
        result = self._run_py(
            "from platxa_agent_generator.mcp_config_generator import MCPServer, MCPConfig, generate_config\n"
            "a = MCPServer(name='dup', server_type='stdio', command='node',\n"
            "              args=['first.js'])\n"
            "b = MCPServer(name='dup', server_type='stdio', command='node',\n"
            "              args=['second.js'])\n"
            "cfg = MCPConfig(servers=[a, b])\n"
            "out = generate_config(cfg)\n"
            "print(len(out), out['dup']['args'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 ['second.js']"
