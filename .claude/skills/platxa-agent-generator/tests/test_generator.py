#!/usr/bin/env python3
"""
Comprehensive Test Suite for Platxa Agent Generator

Real functional tests that exercise actual code paths.
Run with: pytest tests/test_generator.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


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


class TestTypeClassifierMaxTurns:
    """Tests for recommend_max_turns() in type_classifier.py."""

    def test_simple_low_complexity(self) -> None:
        """Simple agent with low complexity gets 10 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_max_turns; print(recommend_max_turns('simple', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "10"

    def test_orchestrator_default_complexity(self) -> None:
        """Orchestrator with medium complexity gets 25 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_max_turns; print(recommend_max_turns('orchestrator', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "25"

    def test_multi_agent_high_complexity(self) -> None:
        """Multi-agent with high complexity gets 75 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_max_turns; print(recommend_max_turns('multi-agent', 5))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "75"

    def test_pipeline_default_complexity(self) -> None:
        """Pipeline with medium complexity gets 25 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_max_turns; print(recommend_max_turns('pipeline', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "25"

    def test_unknown_type_falls_back_to_simple(self) -> None:
        """Unknown architecture type falls back to simple defaults."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_max_turns; print(recommend_max_turns('unknown', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "15"  # simple default


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


class TestModelRouting:
    """Tests for recommend_model() in type_classifier.py."""

    def test_simple_low_gets_haiku(self) -> None:
        """Simple agent with low complexity gets haiku (cheapest)."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_model; print(recommend_model('simple', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "haiku"

    def test_orchestrator_default_gets_sonnet(self) -> None:
        """Orchestrator with medium complexity gets sonnet."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_model; print(recommend_model('orchestrator', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "sonnet"

    def test_orchestrator_high_gets_opus(self) -> None:
        """Orchestrator with high complexity gets opus (most capable)."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_model; print(recommend_model('orchestrator', 5))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "opus"

    def test_multi_agent_default_gets_opus(self) -> None:
        """Multi-agent with medium complexity gets opus."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_model; print(recommend_model('multi-agent', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "opus"

    def test_pipeline_low_gets_haiku(self) -> None:
        """Pipeline with low complexity gets haiku."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from scripts.type_classifier import recommend_model; print(recommend_model('pipeline', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "haiku"


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
                    "from scripts.security_scanner import recommend_disallowed_tools; "
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
                    "from scripts.security_scanner import recommend_disallowed_tools; "
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
                    "from scripts.security_scanner import recommend_disallowed_tools; "
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


class TestHooksRecommendation:
    """Tests for hooks recommendation integration (Feature #11)."""

    def _run_generator(self, *args: str) -> dict:
        """Run agent_generator.py via subprocess."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "agent_generator.py"), *args],
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout) if result.stdout.strip() else {}

    def _import_recommend(self) -> tuple:
        """Import recommend_hooks_for_agent from scripts dir."""
        import importlib
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "agent_generator",
            SCRIPTS_DIR / "agent_generator.py",
        )
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.recommend_hooks_for_agent, mod.generate_hooks_section

    def test_security_agent_gets_pretooluse_hooks(self) -> None:
        """Security agents should get PreToolUse validation hooks."""
        recommend, _ = self._import_recommend()
        result = recommend(
            "security-scanner",
            "Scans code for security vulnerabilities",
            ["Read", "Grep", "Glob"],
        )
        assert "PreToolUse" in result
        pre_hooks = result["PreToolUse"]
        has_security_gate = any("security-gate" in h["hooks"][0]["command"] for h in pre_hooks)
        assert has_security_gate, "Security agent should have PreToolUse security-gate hook"

    def test_security_agent_gets_audit_hooks(self) -> None:
        """Security agents should get audit logging hooks."""
        recommend, _ = self._import_recommend()
        result = recommend(
            "security-scanner",
            "Scans for vulnerabilities",
            ["Read", "Grep"],
        )
        assert "PreToolUse" in result
        has_audit = any(
            "claude-audit.log" in h["hooks"][0]["command"] for h in result["PreToolUse"]
        )
        assert has_audit, "Security agent should have audit hooks"

    def test_test_agent_gets_posttooluse_logging(self) -> None:
        """Test agents should get PostToolUse logging hooks."""
        recommend, _ = self._import_recommend()
        result = recommend("test-runner", "Runs test suites", ["Read", "Bash"])
        assert "PostToolUse" in result
        post_hooks = result["PostToolUse"]
        has_logging = any("test-runner.log" in h["hooks"][0]["command"] for h in post_hooks)
        assert has_logging, "Test agent should have PostToolUse logging hook"

    def test_readonly_agent_gets_no_hooks(self) -> None:
        """Plain read-only agents should get no hooks."""
        recommend, _ = self._import_recommend()
        result = recommend("data-reader", "Reads data files", ["Read", "Glob"])
        assert result == {}, f"Read-only agent should have no hooks, got: {list(result.keys())}"

    def test_dangerous_tools_get_audit_hooks(self) -> None:
        """Agents with Write/Edit/Bash always get audit hooks."""
        recommend, _ = self._import_recommend()
        result = recommend("code-writer", "Writes code", ["Read", "Write"])
        assert "PreToolUse" in result or "PostToolUse" in result
        all_commands = [h["hooks"][0]["command"] for hooks in result.values() for h in hooks]
        has_audit = any("claude-audit.log" in cmd for cmd in all_commands)
        assert has_audit, "Agents with dangerous tools should have audit hooks"

    def test_deployer_gets_compliance_hooks(self) -> None:
        """Deployer agents should get compliance + security + audit hooks."""
        recommend, _ = self._import_recommend()
        result = recommend("auto-deployer", "Deploys code to production", ["Bash", "Write"])
        assert "SessionStart" in result, "Deployer should have SessionStart hook"
        assert "Stop" in result, "Deployer should have Stop hook"
        all_commands = [h["hooks"][0]["command"] for hooks in result.values() for h in hooks]
        has_compliance = any("compliance-check" in cmd for cmd in all_commands)
        assert has_compliance, "Deployer should have compliance hooks"

    def test_generate_hooks_section_produces_markdown(self) -> None:
        """generate_hooks_section should produce valid markdown with JSON."""
        recommend, gen_section = self._import_recommend()
        hooks = recommend("security-agent", "Security scanning", ["Read", "Grep"])
        section = gen_section(hooks, "security-agent")
        assert "## Recommended Hooks" in section
        assert "settings.json" in section
        assert "```json" in section
        assert "security-agent" in section

    def test_generate_hooks_section_empty_for_no_hooks(self) -> None:
        """generate_hooks_section should return empty string for no hooks."""
        _, gen_section = self._import_recommend()
        assert gen_section({}, "no-hooks") == ""

    def test_hooks_output_valid_settings_format(self) -> None:
        """Hook output must be valid Claude Code settings.json structure."""
        recommend, _ = self._import_recommend()
        result = recommend("security-scanner", "Security scanner", ["Read", "Grep"])
        # Each event must map to a list of hook entries
        for event, entries in result.items():
            assert event in {
                "SessionStart",
                "Stop",
                "PreToolUse",
                "PostToolUse",
                "Notification",
                "SubagentStop",
                "PreCompact",
                "UserPromptSubmit",
            }, f"Invalid event: {event}"
            assert isinstance(entries, list), f"Entries for {event} must be a list"
            for entry in entries:
                assert "hooks" in entry, "Entry missing 'hooks' key"
                assert isinstance(entry["hooks"], list)
                for hook in entry["hooks"]:
                    assert "type" in hook, "Hook missing 'type'"
                    assert "command" in hook, "Hook missing 'command'"
                    assert hook["type"] == "command"


class TestPreToolUseDenyScript:
    """Tests for PreToolUse dangerous command blocking (Feature #12).

    Uses subprocess to invoke hooks_generator.py, avoiding fragile importlib
    issues with `from __future__ import annotations` + dataclass resolution.
    """

    def _generate_deny_script(self, agent_name: str, tmp_path: Path) -> Path:
        """Generate deny script via subprocess and write to tmp_path."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_pretooluse_deny_script; "
                    f"print(generate_pretooluse_deny_script('{agent_name}'))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        script_path = tmp_path / f"{agent_name}-deny.sh"
        script_path.write_text(result.stdout)
        script_path.chmod(0o755)
        return script_path

    def _run_deny_script(
        self, script_path: Path, command: str, tool_name: str = "Bash"
    ) -> subprocess.CompletedProcess:
        """Run the deny script with mock tool input."""
        import os

        env = {**os.environ, "CLAUDE_TOOL_NAME": tool_name}
        return subprocess.run(
            ["bash", str(script_path)],
            input=f'{{"command": "{command}"}}',
            capture_output=True,
            text=True,
            env=env,
        )

    def test_script_contains_all_8_critical_patterns(self, tmp_path: Path) -> None:
        """Generated script must contain all 8 SEC001-SEC008 patterns."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        content = script_path.read_text()
        # These are the 8 CRITICAL patterns from security_scanner.py
        expected_patterns = [
            r"rm\s+-rf\s+[/~]",  # SEC001
            r"\bsudo\b",  # SEC002
            r"chmod\s+777\b",  # SEC003
            r"\beval\s*\(",  # SEC004
            r"\bexec\s*\(",  # SEC005
            r">\s*/dev/sd[a-z]",  # SEC006
            r"dd\s+.*of=/dev/",  # SEC007
            r":\s*\(\)\s*\{",  # SEC008
        ]
        for pattern in expected_patterns:
            assert pattern in content, f"Pattern missing from script: {pattern}"

    def test_script_has_correct_exit_codes(self, tmp_path: Path) -> None:
        """Script must use exit 2 for deny and exit 0 for allow."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        content = script_path.read_text()
        assert "exit 2" in content, "Script must exit 2 to deny"
        assert "exit 0" in content, "Script must exit 0 to allow"

    def test_script_blocks_rm_rf(self, tmp_path: Path) -> None:
        """Script must block rm -rf / with exit code 2."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "rm -rf /home")
        assert result.returncode == 2

    def test_script_blocks_sudo(self, tmp_path: Path) -> None:
        """Script must block sudo commands with exit code 2."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "sudo apt install malware")
        assert result.returncode == 2

    def test_script_blocks_chmod_777(self, tmp_path: Path) -> None:
        """Script must block chmod 777 with exit code 2."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "chmod 777 /etc/passwd")
        assert result.returncode == 2

    def test_script_blocks_dd_devwrite(self, tmp_path: Path) -> None:
        """Script must block dd to /dev/ with exit code 2."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "dd if=/dev/zero of=/dev/sda")
        assert result.returncode == 2

    def test_script_allows_safe_commands(self, tmp_path: Path) -> None:
        """Script must allow safe commands with exit code 0."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "git status")
        assert result.returncode == 0

    def test_script_allows_non_bash_tools(self, tmp_path: Path) -> None:
        """Script must skip checking non-Bash tools (exit 0)."""
        script_path = self._generate_deny_script("test-agent", tmp_path)
        result = self._run_deny_script(script_path, "rm -rf /", tool_name="Read")
        assert result.returncode == 0

    def test_hook_config_format(self) -> None:
        """Hook config must use correct settings.json format."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys, json; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_pretooluse_hook_config; "
                    "print(json.dumps(generate_pretooluse_hook_config("
                    "'my-agent', '/path/to/deny.sh')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        config = json.loads(result.stdout)
        assert "PreToolUse" in config
        entries = config["PreToolUse"]
        assert len(entries) == 1
        assert entries[0]["matcher"] == "Bash"
        assert entries[0]["hooks"][0]["type"] == "command"
        assert entries[0]["hooks"][0]["command"] == "/path/to/deny.sh"


class TestHookScriptGeneration:
    """Tests for hook script file generation (Feature #16)."""

    def _run_generate(self, agent_name: str, hook_types: str, output_dir: str) -> dict:
        """Run generate_hook_scripts via subprocess, return JSON result."""
        code = (
            "import sys, json; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
            "from hooks_generator import generate_hook_scripts; "
            f"scripts, config = generate_hook_scripts("
            f"'{agent_name}', "
            f"hook_types={hook_types!r}.split(','), "
            f"output_dir='{output_dir}'); "
            "print(json.dumps({"
            "'scripts': [str(s) for s in scripts], "
            "'config': config"
            "}))"
        )
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script gen failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_creates_script_files(self, tmp_path: Path) -> None:
        """generate_hook_scripts must create .sh files in output directory."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit", str(hooks_dir))
        assert len(result["scripts"]) > 0
        for script_path in result["scripts"]:
            p = Path(script_path)
            assert p.exists(), f"Script not created: {script_path}"
            assert p.suffix == ".sh"

    def test_scripts_are_executable(self, tmp_path: Path) -> None:
        """Generated scripts must have executable permission."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit", str(hooks_dir))
        import os

        for script_path in result["scripts"]:
            assert os.access(script_path, os.X_OK), f"Not executable: {script_path}"

    def test_scripts_have_shebang(self, tmp_path: Path) -> None:
        """Generated scripts must start with #!/usr/bin/env bash."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "logging", str(hooks_dir))
        for script_path in result["scripts"]:
            content = Path(script_path).read_text()
            assert content.startswith("#!/usr/bin/env bash"), f"Missing shebang: {script_path}"

    def test_scripts_read_stdin(self, tmp_path: Path) -> None:
        """Generated scripts must read TOOL_INPUT from stdin."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit", str(hooks_dir))
        for script_path in result["scripts"]:
            content = Path(script_path).read_text()
            assert "TOOL_INPUT" in content, f"Script doesn't read stdin: {script_path}"

    def test_config_references_script_paths(self, tmp_path: Path) -> None:
        """Returned settings config must reference the created script paths."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit", str(hooks_dir))
        config = result["config"]
        all_commands = [
            h["command"]
            for event_hooks in config.values()
            for entry in event_hooks
            for h in entry["hooks"]
        ]
        for script_path in result["scripts"]:
            assert any(script_path in cmd for cmd in all_commands), (
                f"Config doesn't reference {script_path}"
            )

    def test_naming_convention(self, tmp_path: Path) -> None:
        """Script filenames must follow <agent>-<event>-<desc>.sh pattern."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("sec-agent", "security", str(hooks_dir))
        for script_path in result["scripts"]:
            name = Path(script_path).name
            assert name.startswith("sec-agent-"), f"Bad naming: {name}"
            assert name.endswith(".sh"), f"Not .sh: {name}"

    def test_multiple_hook_types(self, tmp_path: Path) -> None:
        """Multiple hook types should produce multiple scripts."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit,logging", str(hooks_dir))
        # audit + logging on default 4 events = 8 scripts
        assert len(result["scripts"]) >= 4

    def test_scripts_are_valid_bash(self, tmp_path: Path) -> None:
        """Generated scripts must pass bash -n syntax check."""
        hooks_dir = tmp_path / "hooks"
        result = self._run_generate("my-agent", "audit", str(hooks_dir))
        for script_path in result["scripts"]:
            check = subprocess.run(
                ["bash", "-n", script_path],
                capture_output=True,
                text=True,
            )
            assert check.returncode == 0, f"Syntax error in {script_path}: {check.stderr}"


class TestSecurityScanner:
    """Real tests for security_scanner.py CLI."""

    def test_clean_agent_passes(self, tmp_path: Path) -> None:
        """Real test: clean agent should pass security scan."""
        agent_file = tmp_path / "clean-agent.md"
        agent_file.write_text("""---
name: clean-agent
description: A clean safe agent
tools: Read, Glob, Grep
---

# Clean Agent

## Workflow
1. Read configuration files
2. Search for patterns
3. Report findings
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "security_scanner.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        assert output["score"] >= 5.0

    def test_dangerous_tools_detected(self, tmp_path: Path) -> None:
        """Real test: dangerous tool combinations should be flagged."""
        agent_file = tmp_path / "dangerous-agent.md"
        agent_file.write_text("""---
name: dangerous-agent
description: Agent with risky tool combination
tools: Bash, Write, WebFetch
---

# Dangerous Agent

## Workflow
1. Download external scripts
2. Execute downloaded code
3. Modify system files
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "security_scanner.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        # Should have warnings or lower score for dangerous combination
        assert len(output.get("warnings", [])) > 0 or output["score"] < 10.0


class TestWorkflowState:
    """Real tests for workflow_state.py CLI."""

    def test_create_new_workflow(self, tmp_path: Path) -> None:
        """Real test: create a new workflow state file."""
        state_file = tmp_path / "workflow.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--name",
                "test-agent",
                "--output",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert state_file.exists()

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"
        assert data["agent_name"] == "test-agent"

    def test_transition_through_phases(self, tmp_path: Path) -> None:
        """Real test: transition through all workflow phases."""
        state_file = tmp_path / "workflow.json"

        # Create workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Transition: idle -> discovery
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify state
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "discovery"

        # Transition: discovery -> architecture
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "architecture",
            ],
            capture_output=True,
        )
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "architecture"

    def test_invalid_transition_rejected(self, tmp_path: Path) -> None:
        """Real test: invalid transitions should be rejected."""
        state_file = tmp_path / "workflow.json"

        # Create workflow (starts at idle)
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Try invalid transition: idle -> generation (should fail)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "generation",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

        # State should still be idle
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"

    def test_reset_workflow(self, tmp_path: Path) -> None:
        """Real test: reset workflow back to idle."""
        state_file = tmp_path / "workflow.json"

        # Create and advance workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
        )

        # Reset
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "reset",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"


class TestToolSelector:
    """Real tests for tool_selector.py CLI."""

    def test_analyzer_type_tools(self) -> None:
        """Real test: analyzer type should get read/search tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "analyzer",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Read" in tools
        assert "Grep" in tools
        assert "Glob" in tools

    def test_builder_type_tools(self) -> None:
        """Real test: builder type should get write/edit tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "builder",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Write" in tools
        assert "Edit" in tools

    def test_automation_type_tools(self) -> None:
        """Real test: automation type should get bash tool."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "automation",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Bash" in tools

    def test_domain_enhancement(self) -> None:
        """Real test: web domain should add web tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "analyzer",
                "--domain",
                "web",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        # Web domain should include web-related tools
        assert "WebFetch" in tools or "WebSearch" in tools


class TestInteractivePrompts:
    """Real tests for interactive_prompts.py CLI."""

    def test_list_all_phases(self) -> None:
        """Real test: list all phases and questions."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "all",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert len(output) == 5  # 5 phases

        phase_names = [p["phase"] for p in output]
        assert "discovery" in phase_names
        assert "architecture" in phase_names
        assert "generation" in phase_names
        assert "validation" in phase_names
        assert "installation" in phase_names

    def test_get_discovery_phase(self) -> None:
        """Real test: get discovery phase questions."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "phase",
                "discovery",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["phase"] == "discovery"
        assert len(output["questions"]) >= 2

        # Check question format matches AskUserQuestion
        for q in output["questions"]:
            assert "question" in q
            assert "header" in q
            assert "options" in q
            assert len(q["options"]) >= 2

    def test_get_question_by_key(self) -> None:
        """Real test: lookup specific question by key."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "--key",
                "agent_type",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["header"] == "Agent Type"
        assert len(output["options"]) >= 3


class TestMultiAgentGenerator:
    """Real tests for multiagent_generator.py CLI."""

    def test_list_templates(self) -> None:
        """Real test: list available templates."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "templates"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "code-review" in result.stdout
        assert "documentation" in result.stdout
        assert "test-suite" in result.stdout

    def test_generate_custom_system(self) -> None:
        """Real test: generate custom multi-agent system."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                "test-system",
                "--workers",
                "2",
                "--domain",
                "data",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["name"] == "test-system"
        assert len(output["workers"]) == 2
        assert output["orchestrator"]["name"] == "test-system-orchestrator"

    def test_generate_from_template(self, tmp_path: Path) -> None:
        """Real test: generate system from template to files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "code-review",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify files were created
        files = list(tmp_path.glob("*.md"))
        assert len(files) >= 3  # orchestrator + 3 workers

        # Verify manifest exists
        manifest = tmp_path / "code-review-system-manifest.json"
        assert manifest.exists()

    def test_generated_agents_pass_validation(self, tmp_path: Path) -> None:
        """Real test: generated agent files should pass syntax validation."""
        # Generate system
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "code-review",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Validate each generated .md file
        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )


class TestPromptGenerator:
    """Real tests for prompt_generator.py CLI."""

    def test_generate_analyzer_prompt(self) -> None:
        """Real test: generate prompt for analyzer type."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "analyzer",
                "--domain",
                "code",
                "--purpose",
                "Analyzes code quality and patterns",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        # Prompt should contain relevant content
        prompt = result.stdout.lower()
        assert "analy" in prompt  # analyze/analysis/analytical

    def test_generate_builder_prompt(self) -> None:
        """Real test: generate prompt for builder type."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "builder",
                "--domain",
                "features",
                "--purpose",
                "Builds new features and components",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        prompt = result.stdout.lower()
        assert "creat" in prompt or "build" in prompt or "generat" in prompt

    def test_different_types_produce_different_prompts(self) -> None:
        """Real test: different agent types should produce different prompts."""
        analyzer_result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "analyzer",
                "--domain",
                "general",
                "--purpose",
                "General purpose",
            ],
            capture_output=True,
            text=True,
        )
        builder_result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "builder",
                "--domain",
                "general",
                "--purpose",
                "General purpose",
            ],
            capture_output=True,
            text=True,
        )
        assert analyzer_result.stdout != builder_result.stdout


class TestInstallAgent:
    """Real tests for install_agent.py CLI."""

    def test_install_to_project_scope(self, tmp_path: Path) -> None:
        """Real test: install agent to project scope directory."""
        # Create a valid agent file
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text("""---
name: install-test-agent
description: Test agent for installation
tools: Read, Write
---

# Install Test Agent

## Workflow
1. Test step
""")
        # Create project structure
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        (project_dir / ".claude").mkdir()

        # Install to project scope (need to run from project dir)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "install_agent.py"),
                "install",
                str(agent_file),
                "--scope",
                "project",
                "--skip-validation",
                "--json",
            ],
            capture_output=True,
            text=True,
            cwd=str(project_dir),
        )
        output = json.loads(result.stdout)
        assert output["success"] is True
        assert "install-test-agent" in output["agent_name"]

    def test_list_command(self) -> None:
        """Real test: list command runs without error."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "install_agent.py"), "list", "--json"],
            capture_output=True,
            text=True,
        )
        # Should return valid JSON (empty list or list of agents)
        output = json.loads(result.stdout)
        assert isinstance(output, list)


class TestIntegration:
    """Integration tests that exercise multiple modules together."""

    def test_full_workflow_cycle(self, tmp_path: Path) -> None:
        """Real integration test: complete workflow from start to finish."""
        state_file = tmp_path / "workflow.json"

        # Create workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--name",
                "integration-test",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Walk through all phases
        phases = [
            "discovery",
            "architecture",
            "generation",
            "validation",
            "installation",
            "complete",
        ]
        for phase in phases:
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "workflow_state.py"),
                    "transition",
                    str(state_file),
                    phase,
                ],
                capture_output=True,
            )
            assert result.returncode == 0, f"Failed transition to {phase}"

        # Verify final state
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "complete"

    def test_multiagent_to_validation_pipeline(self, tmp_path: Path) -> None:
        """Real integration test: generate multi-agent system and validate all files."""
        output_dir = tmp_path / "agents"

        # Generate multi-agent system
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "documentation",
                "--output",
                str(output_dir),
            ],
            capture_output=True,
        )

        # Validate all generated markdown files
        md_files = list(output_dir.glob("*.md"))
        assert len(md_files) >= 2

        for md_file in md_files:
            # Syntax validation
            syntax_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            syntax_output = json.loads(syntax_result.stdout)
            assert syntax_output["passed"] is True, f"Syntax failed: {md_file.name}"

            # Security scan
            security_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "security_scanner.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            security_output = json.loads(security_result.stdout)
            assert security_output["passed"] is True, f"Security failed: {md_file.name}"


class TestPromptChainingPattern:
    """Tests for prompt-chaining pattern template generator."""

    def test_analyzer_generates_discovery_analysis_synthesis_steps(self) -> None:
        """Analyzer agents should generate Discovery -> Analysis -> Synthesis workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-analyzer",
                "--description",
                "Analyzes code for quality issues",
                "--tools",
                "Read,Grep,Glob",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Verify sequential steps
        assert "Step 1: Discovery" in output
        assert "Step 2: Analysis" in output
        assert "Step 3: Synthesis" in output

        # Verify data flow
        assert "Data Flow" in output
        assert "[Input]" in output
        assert "[Discovery]" in output
        assert "[Output]" in output

        # Verify quality gates
        assert "Quality Gate" in output

    def test_generator_produces_research_design_generate_validate_steps(self) -> None:
        """Generator agents should produce Research -> Design -> Generate -> Validate workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "doc-generator",
                "--description",
                "Generates documentation from code",
                "--tools",
                "Read,Write,Grep",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Research" in output
        assert "Step 2: Design" in output
        assert "Step 3: Generate" in output
        assert "Step 4: Validate" in output

    def test_transformer_produces_load_transform_output_steps(self) -> None:
        """Transformer agents should produce Load -> Transform -> Output workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "format-converter",
                "--description",
                "Transforms JSON to YAML format",
                "--tools",
                "Read,Write",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Load" in output
        assert "Step 2: Transform" in output
        assert "Step 3: Output" in output

    def test_tester_produces_setup_execute_report_steps(self) -> None:
        """Test agents should produce Setup -> Execute -> Report workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-runner",
                "--description",
                "Validates code against test cases",
                "--tools",
                "Read,Bash,Glob",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Setup" in output
        assert "Step 2: Execute" in output
        assert "Step 3: Report" in output

    def test_search_agent_produces_scope_search_filter_present_steps(self) -> None:
        """Search agents should produce Scope -> Search -> Filter -> Present workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-finder",
                "--description",
                "Searches codebase for patterns and functions",
                "--tools",
                "Grep,Glob,Read",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Scope" in output
        assert "Step 2: Search" in output
        assert "Step 3: Filter" in output
        assert "Step 4: Present" in output

    def test_fixer_produces_diagnose_plan_implement_verify_steps(self) -> None:
        """Fixer agents should produce Diagnose -> Plan -> Implement -> Verify workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "bug-fixer",
                "--description",
                "Fixes bugs and resolves issues in code",
                "--tools",
                "Read,Edit,Bash",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Diagnose" in output
        assert "Step 2: Plan" in output
        assert "Step 3: Implement" in output
        assert "Step 4: Verify" in output

    def test_custom_chain_steps_from_json(self) -> None:
        """Custom chain_steps should be used when provided via JSON."""
        json_input = json.dumps(
            {
                "name": "custom-workflow",
                "description": "Agent with custom workflow steps",
                "tools": ["Read", "Write"],
                "chain_steps": [
                    {
                        "name": "Fetch",
                        "description": "Retrieve data from source",
                        "tools": ["Read"],
                        "validation": "Data retrieved successfully",
                    },
                    {
                        "name": "Process",
                        "description": "Transform the data",
                        "validation": "Transformation complete",
                    },
                    {
                        "name": "Store",
                        "description": "Save processed data",
                        "tools": ["Write"],
                        "validation": "Data stored correctly",
                    },
                ],
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--json",
                json_input,
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Verify custom steps are used
        assert "Step 1: Fetch" in output
        assert "Step 2: Process" in output
        assert "Step 3: Store" in output

        # Verify custom descriptions
        assert "Retrieve data from source" in output
        assert "Transform the data" in output
        assert "Save processed data" in output

        # Verify custom validation
        assert "Data retrieved successfully" in output

    def test_tools_assigned_to_steps(self) -> None:
        """Tools should be properly assigned to relevant steps."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "full-analyzer",
                "--description",
                "Analyzes and reports on code",
                "--tools",
                "Read,Grep,Glob,Write",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Read tools should appear in discovery/analysis steps
        assert "**Tools:**" in output

    def test_data_flow_diagram_generated(self) -> None:
        """Data flow diagram should always be generated."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "flow-test",
                "--description",
                "Test agent for data flow",
                "--tools",
                "Read",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "### Data Flow" in output
        assert "[Input]" in output
        assert "[Output]" in output
        assert "→" in output

    def test_quality_gates_include_validation_criteria(self) -> None:
        """Each step should have quality gate with validation criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "quality-test",
                "--description",
                "Analyzes quality metrics",
                "--tools",
                "Read,Grep",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should have quality gates
        assert "**Quality Gate:**" in output
        assert "Check completeness" in output
        assert "Verify format" in output
        assert "Confirm no errors" in output

    def test_generated_agent_passes_syntax_validation(self, tmp_path: Path) -> None:
        """Generated prompt-chaining agent should pass syntax validation."""
        output_file = tmp_path / "test-agent.md"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "validated-agent",
                "--description",
                "Agent for validation test",
                "--tools",
                "Read,Write",
                "--pattern",
                "prompt-chaining",
                "--output",
                str(output_file),
            ],
            capture_output=True,
        )

        # Validate the generated file
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True, f"Validation failed: {output.get('errors', [])}"


class TestOtherPatternTemplates:
    """Tests for routing, parallelization, and evaluator-optimizer patterns."""

    def test_routing_pattern_generates_classification_route_process(self) -> None:
        """Routing pattern should generate Classification -> Route -> Process workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "request-router",
                "--description",
                "Routes requests to handlers",
                "--tools",
                "Read,Task",
                "--pattern",
                "routing",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Classification" in output
        assert "Step 2: Route" in output
        assert "Step 3: Process" in output
        assert "| Input Type | Handler |" in output

    def test_parallelization_pattern_generates_decompose_parallel_aggregate(
        self,
    ) -> None:
        """Parallelization pattern should generate Decompose -> Parallel -> Aggregate workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "parallel-processor",
                "--description",
                "Processes items in parallel",
                "--tools",
                "Read,Task",
                "--pattern",
                "parallelization",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Decompose" in output
        assert "Step 2: Parallel Execution" in output
        assert "Step 3: Aggregate" in output
        assert "Task 1:" in output

    def test_evaluator_optimizer_generates_generate_evaluate_optimize_finalize(
        self,
    ) -> None:
        """Evaluator-optimizer should generate Generate -> Evaluate -> Optimize -> Finalize workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-optimizer",
                "--description",
                "Optimizes code iteratively",
                "--tools",
                "Read,Edit",
                "--pattern",
                "evaluator-optimizer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Generate Initial Output" in output
        assert "Step 2: Evaluate Quality" in output
        assert "Step 3: Optimize (Iterative)" in output
        assert "Step 4: Finalize & Report" in output
        assert "Evaluation Criteria (weighted):" in output
        # Feature 17: Iteration tracking
        assert "Iteration Configuration" in output
        assert "max_iterations" in output
        assert "improvement_threshold" in output


class TestMultiAgentRoutingPattern:
    """Tests for multi-agent routing pattern with classifier + handlers."""

    def test_routing_template_generates_classifier_and_handlers(self, tmp_path: Path) -> None:
        """Routing template should generate classifier + 3 handler agents."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify classifier agent
        classifier_file = tmp_path / "request-classifier.md"
        assert classifier_file.exists(), "Classifier agent file should exist"

        # Verify handler agents
        assert (tmp_path / "query-handler.md").exists(), "Query handler should exist"
        assert (tmp_path / "action-handler.md").exists(), "Action handler should exist"
        assert (tmp_path / "analysis-handler.md").exists(), "Analysis handler should exist"

        # Verify manifest
        manifest_file = tmp_path / "routing-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "routing"

    def test_classifier_contains_classification_rules(self, tmp_path: Path) -> None:
        """Classifier agent should contain classification rules for routing."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        # Verify classification rules
        assert "Classification Rules" in classifier_content
        assert "Query Requests" in classifier_content
        assert "Action Requests" in classifier_content
        assert "Analysis Requests" in classifier_content
        assert "Default Route" in classifier_content

        # Verify handler table
        assert "Handler | Description | Tools" in classifier_content
        assert "query-handler" in classifier_content
        assert "action-handler" in classifier_content
        assert "analysis-handler" in classifier_content

    def test_classifier_has_workflow_with_routing_steps(self, tmp_path: Path) -> None:
        """Classifier should have workflow steps for classification, routing, response."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        assert "Step 1: Classification" in classifier_content
        assert "Step 2: Route" in classifier_content
        assert "Step 3: Response" in classifier_content

    def test_classifier_includes_error_handling(self, tmp_path: Path) -> None:
        """Classifier should include error handling strategies."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        assert "Error Handling" in classifier_content
        assert "Handler failure" in classifier_content

    def test_handlers_have_correct_tools(self, tmp_path: Path) -> None:
        """Each handler should have appropriate tools for its role."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Query handler should have search tools
        query_content = (tmp_path / "query-handler.md").read_text()
        assert "Grep" in query_content or "Read" in query_content

        # Action handler should have write/edit tools
        action_content = (tmp_path / "action-handler.md").read_text()
        assert "Write" in action_content or "Edit" in action_content

        # Analysis handler should have read tools
        analysis_content = (tmp_path / "analysis-handler.md").read_text()
        assert "Read" in analysis_content

    def test_routing_example_command_shows_classifier(self) -> None:
        """Example routing command should show classifier markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "routing",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show classifier content, not orchestrator
        assert "Classification Rules" in output
        assert "Handler Agents" in output
        assert "Routing" in output

    def test_generated_routing_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated routing pattern agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_routing_cli_pattern_option(self) -> None:
        """Routing should be available as a pattern option in CLI."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "routing" in result.stdout


class TestMultiAgentEvaluatorOptimizerPattern:
    """Tests for multi-agent evaluator-optimizer pattern with feedback loops."""

    def test_evaluator_optimizer_template_generates_all_agents(self, tmp_path: Path) -> None:
        """Evaluator-optimizer template should generate controller + 3 worker agents."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify controller agent
        controller_file = tmp_path / "feedback-loop-controller.md"
        assert controller_file.exists(), "Controller agent file should exist"

        # Verify worker agents
        assert (tmp_path / "content-generator.md").exists(), "Generator should exist"
        assert (tmp_path / "quality-evaluator.md").exists(), "Evaluator should exist"
        assert (tmp_path / "improvement-optimizer.md").exists(), "Optimizer should exist"

        # Verify manifest
        manifest_file = tmp_path / "evaluator-optimizer-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "evaluator-optimizer"

    def test_controller_contains_quality_criteria(self, tmp_path: Path) -> None:
        """Controller agent should contain quality criteria with thresholds."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        # Verify quality criteria section
        assert "Quality Criteria" in controller_content
        assert "Clarity" in controller_content
        assert "Completeness" in controller_content
        assert "Correctness" in controller_content
        assert "Threshold" in controller_content

    def test_controller_has_feedback_loop_workflow(self, tmp_path: Path) -> None:
        """Controller should have workflow steps for feedback loop."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        # Verify workflow steps
        assert "Step 1: Initialize" in controller_content
        assert "Step 2: Generate" in controller_content
        assert "Step 3: Evaluate" in controller_content
        assert "Step 4: Optimize" in controller_content
        assert "Step 5: Finalize" in controller_content

        # Verify decision point for loop
        assert "Decision Point" in controller_content

    def test_controller_includes_iteration_tracking(self, tmp_path: Path) -> None:
        """Controller should include iteration tracking mechanism."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        assert "Iteration Tracking" in controller_content
        assert "Iteration" in controller_content
        assert "Score" in controller_content

    def test_controller_includes_error_handling(self, tmp_path: Path) -> None:
        """Controller should include error handling for various failure modes."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        assert "Error Handling" in controller_content
        assert "Generator failure" in controller_content
        assert "Evaluator failure" in controller_content
        assert "Max iterations" in controller_content

    def test_workers_have_specialized_roles(self, tmp_path: Path) -> None:
        """Each worker should have appropriate role and responsibilities."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Generator should create content
        generator_content = (tmp_path / "content-generator.md").read_text()
        assert "generator" in generator_content.lower()

        # Evaluator should assess quality
        evaluator_content = (tmp_path / "quality-evaluator.md").read_text()
        assert "evaluat" in evaluator_content.lower()

        # Optimizer should plan improvements
        optimizer_content = (tmp_path / "improvement-optimizer.md").read_text()
        assert "optimi" in optimizer_content.lower()

    def test_evaluator_optimizer_example_shows_controller(self) -> None:
        """Example command should show feedback loop controller markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "evaluator-optimizer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show controller content
        assert "Feedback Loop Controller" in output
        assert "Quality Criteria" in output
        assert "Evaluator-Optimizer" in output

    def test_generated_evaluator_optimizer_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated evaluator-optimizer agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_evaluator_optimizer_cli_pattern_option(self) -> None:
        """Evaluator-optimizer should be available as a pattern option in CLI."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "evaluator-optimizer" in result.stdout


class TestMultiAgentParallelizationPattern:
    """Tests for multi-agent parallelization pattern with concurrent execution."""

    def test_parallelization_template_generates_orchestrator_and_workers(
        self, tmp_path: Path
    ) -> None:
        """Parallelization template should generate orchestrator + 3 partition workers."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify orchestrator agent
        orchestrator_file = tmp_path / "parallel-orchestrator.md"
        assert orchestrator_file.exists(), "Orchestrator agent file should exist"

        # Verify worker agents
        assert (tmp_path / "partition-worker-1.md").exists(), "Worker 1 should exist"
        assert (tmp_path / "partition-worker-2.md").exists(), "Worker 2 should exist"
        assert (tmp_path / "partition-worker-3.md").exists(), "Worker 3 should exist"

        # Verify manifest
        manifest_file = tmp_path / "parallelization-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "parallelization"

    def test_orchestrator_contains_parallel_task_calls(self, tmp_path: Path) -> None:
        """Orchestrator should contain example of parallel Task tool calls."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Verify parallel Task call examples
        assert "CRITICAL" in orchestrator_content
        assert "SINGLE message" in orchestrator_content
        assert "multiple Task tool calls" in orchestrator_content
        assert "<invoke name=" in orchestrator_content
        assert "partition-worker-1" in orchestrator_content
        assert "partition-worker-2" in orchestrator_content

    def test_orchestrator_has_decompose_execute_aggregate_workflow(self, tmp_path: Path) -> None:
        """Orchestrator should have workflow steps for decompose, execute, aggregate."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Verify workflow steps
        assert "Step 1: Decompose" in orchestrator_content
        assert "Step 2: Parallel Execution" in orchestrator_content
        assert "Step 3: Aggregate" in orchestrator_content

    def test_orchestrator_includes_partition_strategy(self, tmp_path: Path) -> None:
        """Orchestrator should include partition strategy guidance."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        assert "Partition Strategy" in orchestrator_content
        assert "Task Type" in orchestrator_content

    def test_orchestrator_includes_error_handling(self, tmp_path: Path) -> None:
        """Orchestrator should include error handling for parallel execution."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        assert "Error Handling" in orchestrator_content
        assert "timeout" in orchestrator_content.lower()
        assert "Partial success" in orchestrator_content

    def test_orchestrator_includes_aggregation_strategies(self, tmp_path: Path) -> None:
        """Orchestrator should document different aggregation strategies."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Should have aggregation strategies
        assert "Union" in orchestrator_content
        assert "Reduce" in orchestrator_content
        assert "Concatenate" in orchestrator_content

    def test_parallelization_example_shows_orchestrator(self) -> None:
        """Example command should show parallel orchestrator markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "parallelization",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show orchestrator content with parallel calls
        assert "Parallel Orchestrator" in output
        assert "Parallelization" in output
        assert "function_calls" in output

    def test_generated_parallelization_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated parallelization agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_parallelization_cli_pattern_option(self) -> None:
        """Parallelization should be available as a pattern option in CLI."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "parallelization" in result.stdout


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
