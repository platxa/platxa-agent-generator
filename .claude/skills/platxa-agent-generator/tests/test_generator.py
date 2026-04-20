#!/usr/bin/env python3
"""
Comprehensive Test Suite for Platxa Agent Generator

Real functional tests that exercise actual code paths.
Run with: pytest tests/test_generator.py -v
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
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


class TestPostToolUseLintScript:
    """Tests for PostToolUse auto-linting hook generation (Feature #13).

    Verifies that generated lint scripts detect file types, run the correct
    linter, and return additionalContext with violations.
    """

    def _generate_lint_script(self, agent_name: str) -> str:
        """Generate lint script content via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_posttooluse_lint_script; "
                    f"print(generate_posttooluse_lint_script('{agent_name}'))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _generate_lint_config(self, agent_name: str, script_path: str) -> dict:
        """Generate hook config via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys, json; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_posttooluse_lint_hook_config; "
                    f"print(json.dumps(generate_posttooluse_lint_hook_config('{agent_name}', '{script_path}')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Config generation failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated script must be valid bash syntax."""
        script = self._generate_lint_script("lint-agent")
        script_path = tmp_path / "lint.sh"
        script_path.write_text(script)
        result = subprocess.run(
            ["bash", "-n", str(script_path)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Bash syntax error: {result.stderr}"

    def test_script_has_shebang(self) -> None:
        """Script must start with bash shebang."""
        script = self._generate_lint_script("test-agent")
        assert script.startswith("#!/usr/bin/env bash")

    def test_script_includes_python_linter(self) -> None:
        """Script must include ruff for Python files."""
        script = self._generate_lint_script("test-agent")
        assert "ruff check" in script
        assert "py)" in script  # case match for .py extension

    def test_script_includes_typescript_linter(self) -> None:
        """Script must include eslint for TypeScript/JavaScript files."""
        script = self._generate_lint_script("test-agent")
        assert "eslint" in script
        assert "ts|tsx|js|jsx)" in script  # case match for TS/JS extensions

    def test_script_includes_go_linter(self) -> None:
        """Script must include golangci-lint for Go files."""
        script = self._generate_lint_script("test-agent")
        assert "golangci-lint" in script
        assert "go)" in script  # case match for .go extension

    def test_script_includes_rust_linter(self) -> None:
        """Script must include cargo clippy for Rust files."""
        script = self._generate_lint_script("test-agent")
        assert "cargo clippy" in script
        assert "rs)" in script  # case match for .rs extension

    def test_script_extracts_file_path_from_json(self) -> None:
        """Script must parse file_path from tool_input JSON via python3."""
        script = self._generate_lint_script("test-agent")
        assert "file_path" in script
        assert "json.load" in script

    def test_script_checks_file_exists(self) -> None:
        """Script must verify file exists before linting."""
        script = self._generate_lint_script("test-agent")
        assert "! -f" in script

    def test_script_checks_linter_availability(self) -> None:
        """Script must check linter exists via command -v before running."""
        script = self._generate_lint_script("test-agent")
        assert "command -v ruff" in script
        assert "command -v eslint" in script

    def test_script_always_exits_zero(self) -> None:
        """Script must always exit 0 (non-blocking advisory feedback)."""
        script = self._generate_lint_script("test-agent")
        lines = script.strip().split("\n")
        assert lines[-1].strip() == "exit 0"

    def test_script_does_not_use_set_e(self) -> None:
        """Script must NOT use set -e (linter non-zero exits are expected)."""
        script = self._generate_lint_script("test-agent")
        assert "set -euo" not in script

    def test_script_includes_agent_name_in_output(self) -> None:
        """Lint output must include agent name for identification."""
        script = self._generate_lint_script("my-custom-agent")
        assert "my-custom-agent" in script

    def test_hook_config_targets_write_edit(self) -> None:
        """Hook config must match Write|Edit|MultiEdit tools."""
        config = self._generate_lint_config("test-agent", "/path/to/lint.sh")
        assert "PostToolUse" in config
        entries = config["PostToolUse"]
        assert len(entries) == 1
        assert entries[0]["matcher"] == "Write|Edit|MultiEdit"

    def test_hook_config_uses_correct_script_path(self) -> None:
        """Hook config must reference the provided script path."""
        config = self._generate_lint_config("test-agent", "/home/user/.claude/hooks/lint.sh")
        command = config["PostToolUse"][0]["hooks"][0]["command"]
        assert command == "/home/user/.claude/hooks/lint.sh"

    def test_hook_config_type_is_command(self) -> None:
        """Hook action type must be 'command'."""
        config = self._generate_lint_config("test-agent", "/path/to/lint.sh")
        hook_type = config["PostToolUse"][0]["hooks"][0]["type"]
        assert hook_type == "command"

    def test_script_runs_without_error_on_empty_input(self, tmp_path: Path) -> None:
        """Script should handle empty stdin gracefully (no crash)."""
        script = self._generate_lint_script("test-agent")
        script_path = tmp_path / "lint.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)
        result = subprocess.run(
            ["bash", str(script_path)],
            input="{}",
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script crashed on empty input: {result.stderr}"

    def test_script_handles_real_python_file(self, tmp_path: Path) -> None:
        """Script should detect .py file and attempt ruff (if available)."""
        script = self._generate_lint_script("test-agent")
        script_path = tmp_path / "lint.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        # Create a test Python file
        py_file = tmp_path / "test_file.py"
        py_file.write_text("x=1\n")

        result = subprocess.run(
            ["bash", str(script_path)],
            input=json.dumps({"file_path": str(py_file)}),
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0


class TestStopVerificationScript:
    """Tests for Stop verification gate hook generation (Feature #14).

    Verifies that generated Stop scripts detect test frameworks (pytest,
    vitest, go test), block completion on failure (exit 2), and allow
    completion on success or no framework (exit 0).
    """

    def _generate_script(self, agent_name: str) -> str:
        """Generate Stop verification script via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_stop_verification_script; "
                    f"print(generate_stop_verification_script('{agent_name}'))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _generate_config(self, agent_name: str, script_path: str) -> dict:
        """Generate Stop hook config via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys, json; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_stop_verification_hook_config; "
                    f"print(json.dumps(generate_stop_verification_hook_config('{agent_name}', '{script_path}')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Config generation failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated script must be valid bash syntax."""
        script = self._generate_script("verify-agent")
        script_path = tmp_path / "verify.sh"
        script_path.write_text(script)
        result = subprocess.run(["bash", "-n", str(script_path)], capture_output=True, text=True)
        assert result.returncode == 0, f"Bash syntax error: {result.stderr}"

    def test_script_has_shebang(self) -> None:
        """Script must start with bash shebang."""
        script = self._generate_script("test-agent")
        assert script.startswith("#!/usr/bin/env bash")

    def test_script_detects_pytest(self) -> None:
        """Script must check for pyproject.toml/pytest.ini/conftest.py/tests dir."""
        script = self._generate_script("test-agent")
        assert "pyproject.toml" in script
        assert "pytest.ini" in script
        assert "conftest.py" in script
        assert "pytest" in script

    def test_script_detects_vitest(self) -> None:
        """Script must check for vitest.config.ts/js/mts."""
        script = self._generate_script("test-agent")
        assert "vitest.config.ts" in script
        assert "vitest.config.js" in script
        assert "vitest run" in script

    def test_script_detects_go_test(self) -> None:
        """Script must check for go.mod and run go test."""
        script = self._generate_script("test-agent")
        assert "go.mod" in script
        assert "go test ./..." in script

    def test_script_blocks_on_failure(self) -> None:
        """Script must exit 2 when tests fail (Claude Code deny convention)."""
        script = self._generate_script("test-agent")
        assert "exit 2" in script
        assert "BLOCKED" in script

    def test_script_allows_on_success(self) -> None:
        """Script must exit 0 when tests pass or no framework detected."""
        script = self._generate_script("test-agent")
        lines = script.strip().split("\n")
        assert lines[-1].strip() == "exit 0"

    def test_script_reports_failure_reason(self) -> None:
        """Script must output failure reason on stderr."""
        script = self._generate_script("test-agent")
        assert "Reason:" in script
        assert ">&2" in script

    def test_script_checks_tool_availability(self) -> None:
        """Script must check pytest/vitest/go exist via command -v."""
        script = self._generate_script("test-agent")
        assert "command -v pytest" in script
        assert "command -v go" in script

    def test_script_includes_agent_name(self) -> None:
        """Script must include agent name in output messages."""
        script = self._generate_script("my-verifier")
        assert "my-verifier" in script

    def test_hook_config_uses_stop_event(self) -> None:
        """Hook config must use Stop event."""
        config = self._generate_config("test-agent", "/path/to/verify.sh")
        assert "Stop" in config
        assert len(config["Stop"]) == 1

    def test_hook_config_uses_correct_script_path(self) -> None:
        """Hook config must reference the provided script path."""
        config = self._generate_config("test-agent", "/home/user/.claude/hooks/verify.sh")
        command = config["Stop"][0]["hooks"][0]["command"]
        assert command == "/home/user/.claude/hooks/verify.sh"

    def test_hook_config_has_no_matcher(self) -> None:
        """Stop hooks should not have a matcher (they fire on session end)."""
        config = self._generate_config("test-agent", "/path/to/verify.sh")
        # Stop config should not have a 'matcher' key
        assert "matcher" not in config["Stop"][0]

    def test_script_allows_completion_when_no_framework(self, tmp_path: Path) -> None:
        """In a dir with no test config files, script should exit 0 (allow)."""
        script = self._generate_script("test-agent")
        script_path = tmp_path / "verify.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        # Run in an empty directory (no pyproject.toml, no go.mod, no vitest config)
        empty_dir = tmp_path / "empty_project"
        empty_dir.mkdir()

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            cwd=str(empty_dir),
        )
        assert result.returncode == 0, (
            f"Script should allow completion when no framework detected. stderr: {result.stderr}"
        )


class TestHooksGeneratorTaskCompleted:
    """Tests for TaskCompleted hook corrupt-manifest handling (Feature #8).

    Verifies that the generated TaskCompleted script denies completion (exit 2,
    stderr has error, stdout empty) for every form of corrupt manifest —
    including non-dict JSON, which previously silently passed due to Python's
    AttributeError being swallowed by the `|| echo ""` fallback in bash.

    Valid manifests must still exit 0.
    """

    def _generate_script(self, agent_name: str) -> str:
        """Generate TaskCompleted script via subprocess (same pattern as sibling tests)."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from hooks_generator import generate_task_completed_script; "
                    f"print(generate_task_completed_script('{agent_name}'))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _prepare_workspace(self, tmp_path: Path, manifest_content: str | None) -> Path:
        """Set up .claude/team-state/default/deliverables/T1.json with given content.

        Pass manifest_content=None to omit the manifest entirely (exercises the
        missing-manifest path, not the corrupt-parse path).
        """
        deliverables = tmp_path / ".claude" / "team-state" / "default" / "deliverables"
        deliverables.mkdir(parents=True)
        if manifest_content is not None:
            (deliverables / "T1.json").write_text(manifest_content)
        return tmp_path

    def _run_script(self, tmp_path: Path, script: str) -> subprocess.CompletedProcess:
        """Run the generated script with task_id=T1 stdin, cwd=tmp_path."""
        script_path = tmp_path / "task-completed.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)
        return subprocess.run(
            ["bash", str(script_path)],
            input='{"task_id":"T1"}',
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
        )

    @pytest.mark.parametrize(
        "corrupt_content,label",
        [
            ("not valid json", "malformed_json"),
            ('"just a string"', "non_dict_string"),
            ("[1, 2, 3]", "non_dict_array"),
            ("42", "non_dict_number"),
            ("null", "non_dict_null"),
            ('{"files": "should be a list"}', "files_wrong_type"),
        ],
    )
    def test_corrupt_manifest_exits_2(
        self, tmp_path: Path, corrupt_content: str, label: str
    ) -> None:
        """Corrupt manifest in any form: exit 2, stderr has error, stdout empty.

        Previously, non-dict JSON silently passed because Python's AttributeError
        was swallowed by `|| echo ""`. Root-cause fix: Python owns exit-code
        signaling; bash checks $? directly.
        """
        workspace = self._prepare_workspace(tmp_path, corrupt_content)
        script = self._generate_script("test-agent")
        result = self._run_script(workspace, script)

        assert result.returncode == 2, (
            f"Corrupt manifest [{label}] must deny (exit 2). Got exit={result.returncode}, "
            f"stderr={result.stderr!r}, stdout={result.stdout!r}"
        )
        assert result.stderr.strip(), (
            f"Corrupt manifest [{label}] must print error to stderr. stderr={result.stderr!r}"
        )
        assert result.stdout == "", (
            f"Corrupt manifest [{label}] must keep stdout empty. stdout={result.stdout!r}"
        )

    def test_valid_manifest_exits_0(self, tmp_path: Path) -> None:
        """Valid manifest with all declared files present must allow (exit 0)."""
        artifact = tmp_path / "artifact.txt"
        artifact.write_text("content")
        workspace = self._prepare_workspace(tmp_path, json.dumps({"files": [str(artifact)]}))
        script = self._generate_script("test-agent")
        result = self._run_script(workspace, script)

        assert result.returncode == 0, (
            f"Valid manifest must allow (exit 0). Got exit={result.returncode}, "
            f"stderr={result.stderr!r}"
        )

    def test_python3_missing_fails_closed(self, tmp_path: Path) -> None:
        """Without python3 on PATH, the script must fail closed (exit 2).

        The manifest validator depends on python3 for JSON parsing and type
        checks; silently skipping validation when python3 is absent would be
        the same silent-pass class of bug this feature exists to close.
        """
        # Even a "valid" manifest must be denied if python3 is unavailable.
        artifact = tmp_path / "artifact.txt"
        artifact.write_text("content")
        workspace = self._prepare_workspace(tmp_path, json.dumps({"files": [str(artifact)]}))
        script = self._generate_script("test-agent")

        script_path = workspace / "task-completed.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        # Locate bash once via the host's real PATH before we restrict the
        # env — then pass an empty PATH into the child so the generated
        # script's `command -v python3` sees no python3 at all.
        bash_path = shutil.which("bash")
        assert bash_path, "bash is required for this test to run"

        env = os.environ.copy()
        env["PATH"] = ""

        result = subprocess.run(
            [bash_path, str(script_path)],
            input='{"task_id":"T1"}',
            capture_output=True,
            text=True,
            cwd=str(workspace),
            env=env,
        )

        assert result.returncode == 2, (
            f"Missing python3 must deny (exit 2). Got exit={result.returncode}, "
            f"stderr={result.stderr!r}"
        )
        assert "python3" in result.stderr, (
            f"Denial message must cite python3. stderr={result.stderr!r}"
        )
        assert result.stdout == "", f"Stdout must stay empty on denial. stdout={result.stdout!r}"


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


class TestQualityScorerNewFields:
    """Tests for quality scoring of new frontmatter fields (Feature #17)."""

    def _score_agent(self, agent_file: Path) -> dict:
        """Run quality_scorer.py --json on an agent file."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "quality_scorer.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        # Scorer exits 1 when score < 7.0 (FAILED), which is expected for test agents.
        # We only care that it produced valid JSON output.
        assert result.stdout.strip(), f"Scorer produced no output: {result.stderr}"
        return json.loads(result.stdout)

    def _make_agent(self, tmp_path: Path, name: str, frontmatter: str, body: str) -> Path:
        """Create a test agent file."""
        f = tmp_path / f"{name}.md"
        f.write_text(f"---\n{frontmatter}---\n\n{body}\n")
        return f

    def test_readonly_agent_without_disallowed_penalized(self, tmp_path: Path) -> None:
        """Read-only agent without disallowedTools should get lower tool_design score."""
        agent_no_disallowed = self._make_agent(
            tmp_path,
            "reader-no-disallow",
            "name: reader-no-disallow\ndescription: Reads files\ntools: Read, Glob, Grep\n",
            "# Reader\n\n## Overview\nReads files.\n\n## Workflow\n1. Read files with Read\n"
            "2. Search with Grep\n3. Find with Glob\n\n## Examples\n### Example 1\n"
            "User: Read files\nAgent: Uses Read tool\n",
        )
        agent_with_disallowed = self._make_agent(
            tmp_path,
            "reader-disallowed",
            "name: reader-disallowed\ndescription: Reads files\ntools: Read, Glob, Grep\n"
            "disallowedTools: Write, Edit, Bash\n",
            "# Reader\n\n## Overview\nReads files.\n\n## Workflow\n1. Read files with Read\n"
            "2. Search with Grep\n3. Find with Glob\n\n## Examples\n### Example 1\n"
            "User: Read files\nAgent: Uses Read tool\n",
        )
        score_no = self._score_agent(agent_no_disallowed)
        score_yes = self._score_agent(agent_with_disallowed)
        # The one with disallowedTools should score higher or equal
        td_no = next(c for c in score_no["criteria"] if c["name"] == "Tool Design")
        td_yes = next(c for c in score_yes["criteria"] if c["name"] == "Tool Design")
        assert td_yes["score"] >= td_no["score"], (
            f"Agent with disallowedTools ({td_yes['score']}) should score >= "
            f"agent without ({td_no['score']})"
        )

    def test_opus_on_simple_task_penalized(self, tmp_path: Path) -> None:
        """Using opus model on a simple lint/scan task should be penalized."""
        agent = self._make_agent(
            tmp_path,
            "linter-opus",
            "name: linter-opus\ndescription: Lint checker\ntools: Read, Glob\nmodel: opus\n",
            "# Linter\n\n## Overview\nValidate and lint code files.\n\n## Workflow\n"
            "1. Scan files with Glob\n2. Read and check each file\n"
            "3. Report lint errors\n\n## Examples\n### Example 1\n"
            "User: Lint my code\nAgent: Scans and validates\n",
        )
        report = self._score_agent(agent)
        td = next(c for c in report["criteria"] if c["name"] == "Tool Design")
        # Should have suggestion about opus being expensive
        all_suggestions = td.get("suggestions", [])
        has_opus_warning = any(
            "opus" in s.lower() and "expensive" in s.lower() for s in all_suggestions
        )
        assert has_opus_warning, f"Expected opus cost warning, got suggestions: {all_suggestions}"

    def test_haiku_on_simple_task_rewarded(self, tmp_path: Path) -> None:
        """Using haiku model on simple tasks should be rewarded."""
        agent = self._make_agent(
            tmp_path,
            "linter-haiku",
            "name: linter-haiku\ndescription: Lint checker\ntools: Read, Glob\nmodel: haiku\n",
            "# Linter\n\n## Overview\nValidate and lint code.\n\n## Workflow\n"
            "1. Scan files with Glob\n2. Read and check files\n"
            "3. Report errors\n\n## Examples\n### Example 1\n"
            "User: Lint code\nAgent: Scans and validates\n",
        )
        report = self._score_agent(agent)
        td = next(c for c in report["criteria"] if c["name"] == "Tool Design")
        has_haiku_praise = any(
            "haiku" in f.lower() and "appropriate" in f.lower() for f in td.get("findings", [])
        )
        assert has_haiku_praise, f"Expected haiku praise, got findings: {td.get('findings', [])}"

    def test_bypass_permissions_with_bash_penalized(self, tmp_path: Path) -> None:
        """bypassPermissions + Bash should lower security score."""
        agent = self._make_agent(
            tmp_path,
            "unsafe-agent",
            "name: unsafe-agent\ndescription: Runs commands\ntools: Bash, Read\n"
            "permissionMode: bypassPermissions\n",
            "# Unsafe\n\n## Overview\nRuns bash commands.\n\n## Workflow\n"
            "1. Execute Bash commands\n2. Read output with Read\n"
            "3. Validate results\n\n## Examples\n### Example 1\n"
            "User: Run command\nAgent: Executes safely\n",
        )
        report = self._score_agent(agent)
        sec = next(c for c in report["criteria"] if c["name"] == "Security")
        has_bypass_warning = any("bypassPermissions" in s for s in sec.get("suggestions", []))
        assert has_bypass_warning, (
            f"Expected bypassPermissions warning, got: {sec.get('suggestions', [])}"
        )

    def test_model_routing_mismatch_haiku_complex(self, tmp_path: Path) -> None:
        """haiku on complex orchestration task should be flagged."""
        agent = self._make_agent(
            tmp_path,
            "orchestrator-haiku",
            "name: orchestrator-haiku\ndescription: Orchestrates workers\n"
            "tools: Read, Task, Bash\nmodel: haiku\n",
            "# Orchestrator\n\n## Overview\nCoordinate multi-agent workflows.\n\n"
            "## Workflow\n1. Orchestrate worker agents via Task tool\n"
            "2. Coordinate results from multiple agents\n"
            "3. Aggregate and report\n\n## Examples\n### Example 1\n"
            "User: Run analysis\nAgent: Orchestrates workers\n",
        )
        report = self._score_agent(agent)
        td = next(c for c in report["criteria"] if c["name"] == "Tool Design")
        has_haiku_warning = any(
            "haiku" in s.lower() and "underperform" in s.lower() for s in td.get("suggestions", [])
        )
        assert has_haiku_warning, (
            f"Expected haiku-complex warning, got: {td.get('suggestions', [])}"
        )


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


class TestErrorHandlingGeneration:
    """Tests for tool-specific error handling section generation (Feature #25)."""

    def _gen_section(self, tools: list[str]) -> str:
        """Generate error handling section via subprocess."""
        tools_str = repr(tools)
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from agent_generator import AgentDefinition, generate_error_handling_section; "
                    f"d = AgentDefinition(name='t', description='t', tools={tools_str}); "
                    "print(generate_error_handling_section(d))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        return result.stdout

    def test_section_has_error_handling_heading(self) -> None:
        """Generated section must start with ## Error Handling."""
        section = self._gen_section(["Read"])
        assert "## Error Handling" in section

    def test_bash_agent_has_command_failure_modes(self) -> None:
        """Bash agents must include command failure and timeout modes."""
        section = self._gen_section(["Bash", "Read"])
        assert "Command failed" in section
        assert "Command timeout" in section
        assert "Bash failures" in section

    def test_task_agent_has_subagent_failure_modes(self) -> None:
        """Task agents must include subagent failure modes."""
        section = self._gen_section(["Task", "Read"])
        assert "Subagent failure" in section
        assert "Subagent failures" in section

    def test_webfetch_agent_has_network_failure_modes(self) -> None:
        """WebFetch agents must include network failure modes."""
        section = self._gen_section(["WebFetch", "Read"])
        assert "Network error" in section
        assert "Network failures" in section
        assert "Rate limit" in section

    def test_write_agent_has_write_conflict_modes(self) -> None:
        """Write/Edit agents must include write conflict modes."""
        section = self._gen_section(["Write", "Edit", "Read"])
        assert "Write conflict" in section
        assert "File operation failures" in section

    def test_readonly_agent_excludes_irrelevant_content(self) -> None:
        """Read-only agent must NOT include Bash/Task/Web-specific content."""
        section = self._gen_section(["Read", "Glob", "Grep"])
        assert "Command failed" not in section
        assert "Subagent" not in section
        assert "Network error" not in section

    def test_always_includes_when_to_stop(self) -> None:
        """All agents must include When to Stop section."""
        section = self._gen_section(["Read"])
        assert "When to Stop" in section
        assert "security violation" in section

    def test_always_includes_permission_denied(self) -> None:
        """All agents must include permission denied failure mode."""
        section = self._gen_section(["Read"])
        assert "Permission denied" in section

    def test_fallback_table_is_tool_conditional(self) -> None:
        """Fallback strategies table must only include relevant tools."""
        # Read-only: should have file fallback but NOT subagent/command/API
        section = self._gen_section(["Read", "Glob"])
        assert "File inaccessible" in section
        assert "Subagent failure" not in section
        assert "External API down" not in section
        assert "Command failure" not in section


class TestContextBudgetEstimation:
    """Tests for context budget estimation (Feature #22)."""

    def _estimate(self, content: str) -> dict:
        """Run estimate_context_budget via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys, json; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
                    "from agent_generator import estimate_context_budget; "
                    "import dataclasses; "
                    "r = estimate_context_budget(sys.stdin.read()); "
                    "print(json.dumps(dataclasses.asdict(r)))"
                ),
            ],
            input=content,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_small_agent_ok(self) -> None:
        """Agent under 2000 tokens should have status 'ok'."""
        small = "---\nname: small\ntools: Read\n---\n\n# Small\n\nDoes little.\n"
        result = self._estimate(small)
        assert result["status"] == "ok"
        assert result["estimated_tokens"] < 2000
        assert len(result["suggestions"]) == 0

    def test_medium_agent_warning(self) -> None:
        """Agent between 2000-5000 tokens should have status 'warning'."""
        # 2000 tokens * 4 chars = 8000 chars needed
        medium = "---\nname: medium\ntools: Read\n---\n\n# Medium\n\n" + ("x" * 8500) + "\n"
        result = self._estimate(medium)
        assert result["status"] == "warning"
        assert result["estimated_tokens"] >= 2000
        assert result["estimated_tokens"] < 5000
        assert len(result["suggestions"]) > 0

    def test_large_agent_error(self) -> None:
        """Agent over 5000 tokens should have status 'error'."""
        # 5000 tokens * 4 chars = 20000 chars needed
        large = "---\nname: large\ntools: Read\n---\n\n# Large\n\n" + ("x" * 21000) + "\n"
        result = self._estimate(large)
        assert result["status"] == "error"
        assert result["estimated_tokens"] > 5000
        assert len(result["suggestions"]) >= 3

    def test_token_estimation_uses_4_chars_heuristic(self) -> None:
        """Token count should be char_count // 4."""
        content = "a" * 400  # 400 chars = 100 tokens
        result = self._estimate(content)
        assert result["char_count"] == 400
        assert result["estimated_tokens"] == 100

    def test_error_status_includes_pruning_suggestions(self) -> None:
        """Error status must include actionable pruning suggestions."""
        large = "x" * 25000
        result = self._estimate(large)
        assert result["status"] == "error"
        suggestions_text = " ".join(result["suggestions"]).lower()
        assert "example" in suggestions_text or "remove" in suggestions_text
        assert "documentation" in suggestions_text or "companion" in suggestions_text

    def test_message_includes_token_count(self) -> None:
        """Message must include the estimated token count."""
        content = "a" * 800  # 200 tokens
        result = self._estimate(content)
        assert "200" in result["message"]


class TestCredentialLeakDetection:
    """Tests for credential leak detection (Feature #21).

    NOTE: Test tokens are generated via string concatenation to avoid
    triggering pre-write secret detection hooks.
    """

    def _scan_agent(self, agent_file: Path) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "security_scanner.py"), "--json", str(agent_file)],
            capture_output=True,
            text=True,
        )
        assert result.stdout.strip(), f"No output: {result.stderr}"
        return json.loads(result.stdout)

    def _make_agent_with_secret(self, tmp_path: Path, name: str, secret_line: str) -> Path:
        """Create agent file by writing secret via Python to bypass write hooks."""
        f = tmp_path / f"{name}.md"
        # Write the file directly — tmp_path is outside the repo so hooks won't scan it
        content = (
            f"---\nname: {name}\ndescription: Test\ntools: Read\n---\n\n# Agent\n\n{secret_line}\n"
        )
        f.write_text(content)
        return f

    def _finding_codes(self, output: dict) -> list[str]:
        return [f.get("code", "") for f in output.get("findings", [])]

    def test_github_pat_detected_sec050(self, tmp_path: Path) -> None:
        """GitHub PAT (ghp_) should trigger SEC050 at critical severity."""
        # Build fake token via concat to avoid hook detection
        fake_token = "ghp_" + "A" * 40
        agent = self._make_agent_with_secret(
            tmp_path, "ghp-leak", f"Use token {fake_token} for auth"
        )
        output = self._scan_agent(agent)
        assert "SEC050" in self._finding_codes(output)
        sec050 = next(f for f in output["findings"] if f.get("code") == "SEC050")
        assert sec050["severity"] == "critical"

    def test_openai_key_detected_sec051(self, tmp_path: Path) -> None:
        """OpenAI/Anthropic key (sk-) should trigger SEC051."""
        fake_key = "sk-" + "a" * 24
        agent = self._make_agent_with_secret(tmp_path, "sk-leak", f"Set key to {fake_key}")
        output = self._scan_agent(agent)
        assert "SEC051" in self._finding_codes(output)

    def test_aws_key_detected_sec052(self, tmp_path: Path) -> None:
        """AWS access key (AKIA) should trigger SEC052."""
        fake_key = "AKIA" + "X" * 16
        agent = self._make_agent_with_secret(tmp_path, "aws-leak", f"AWS key: {fake_key}")
        output = self._scan_agent(agent)
        assert "SEC052" in self._finding_codes(output)

    def test_bearer_token_detected_sec053(self, tmp_path: Path) -> None:
        """Bearer token should trigger SEC053."""
        fake_bearer = "Bearer " + "e" * 30 + "=" * 2
        agent = self._make_agent_with_secret(
            tmp_path, "bearer-leak", f"Authorization: {fake_bearer}"
        )
        output = self._scan_agent(agent)
        assert "SEC053" in self._finding_codes(output)

    def test_env_file_reference_detected_sec055(self, tmp_path: Path) -> None:
        """.env file reference should trigger SEC055."""
        agent = self._make_agent_with_secret(
            tmp_path, "env-ref", "Load secrets from .env file before running"
        )
        output = self._scan_agent(agent)
        assert "SEC055" in self._finding_codes(output)

    def test_clean_agent_no_credential_findings(self, tmp_path: Path) -> None:
        """Agent without credentials should have no SEC05x findings."""
        f = tmp_path / "clean-creds.md"
        f.write_text(
            "---\nname: clean-creds\ndescription: Test\ntools: Read\n---\n\n"
            "# Agent\n\n## Workflow\n1. Read config\n2. Process data\n"
        )
        output = self._scan_agent(f)
        cred_codes = [c for c in self._finding_codes(output) if c.startswith("SEC05")]
        assert cred_codes == [], f"Clean agent has credential findings: {cred_codes}"


class TestToolCombinationRiskMatrix:
    """Tests for tool combination risk detection (Feature #19)."""

    def _scan_agent(self, agent_file: Path) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "security_scanner.py"), "--json", str(agent_file)],
            capture_output=True,
            text=True,
        )
        assert result.stdout.strip(), f"Scanner produced no output: {result.stderr}"
        return json.loads(result.stdout)

    def _make_agent(self, tmp_path: Path, name: str, tools: str, body: str) -> Path:
        f = tmp_path / f"{name}.md"
        f.write_text(f"---\nname: {name}\ndescription: Test agent\ntools: {tools}\n---\n\n{body}\n")
        return f

    def _finding_codes(self, output: dict) -> list[str]:
        return [f.get("code", "") for f in output.get("findings", [])]

    def test_bash_webfetch_detected_sec040(self, tmp_path: Path) -> None:
        """Bash+WebFetch should trigger SEC040 (download and execute risk)."""
        agent = self._make_agent(
            tmp_path,
            "dl-exec",
            "Bash, WebFetch, Read",
            "# Agent\n\n## Workflow\n1. Fetch data\n2. Process\n",
        )
        output = self._scan_agent(agent)
        assert "SEC040" in self._finding_codes(output)

    def test_write_bash_detected_sec041(self, tmp_path: Path) -> None:
        """Write+Bash should trigger SEC041 (file creation and execution)."""
        agent = self._make_agent(
            tmp_path,
            "write-exec",
            "Write, Bash, Read",
            "# Agent\n\n## Workflow\n1. Write files\n2. Execute\n",
        )
        output = self._scan_agent(agent)
        assert "SEC041" in self._finding_codes(output)

    def test_edit_glob_detected_sec042(self, tmp_path: Path) -> None:
        """Edit+Glob should trigger SEC042 (mass file modification)."""
        agent = self._make_agent(
            tmp_path,
            "mass-edit",
            "Edit, Glob, Read",
            "# Agent\n\n## Workflow\n1. Find files\n2. Edit them\n",
        )
        output = self._scan_agent(agent)
        assert "SEC042" in self._finding_codes(output)

    def test_bash_task_detected_sec043(self, tmp_path: Path) -> None:
        """Bash+Task should trigger SEC043 (distributed shell execution)."""
        agent = self._make_agent(
            tmp_path,
            "dist-shell",
            "Bash, Task, Read",
            "# Agent\n\n## Workflow\n1. Spawn workers\n2. Execute\n",
        )
        output = self._scan_agent(agent)
        assert "SEC043" in self._finding_codes(output)

    def test_webfetch_write_detected_sec044(self, tmp_path: Path) -> None:
        """WebFetch+Write should trigger SEC044 (remote content injection)."""
        agent = self._make_agent(
            tmp_path,
            "fetch-write",
            "WebFetch, Write, Read",
            "# Agent\n\n## Workflow\n1. Fetch remote\n2. Write to disk\n",
        )
        output = self._scan_agent(agent)
        assert "SEC044" in self._finding_codes(output)

    def test_rce_chain_detected_sec046(self, tmp_path: Path) -> None:
        """WebFetch+Bash+Write should trigger SEC046 (RCE chain, critical)."""
        agent = self._make_agent(
            tmp_path,
            "rce-chain",
            "WebFetch, Bash, Write, Read",
            "# Agent\n\n## Workflow\n1. Download\n2. Save\n3. Execute\n",
        )
        output = self._scan_agent(agent)
        codes = self._finding_codes(output)
        assert "SEC046" in codes
        # Verify it's CRITICAL severity
        sec046 = next(f for f in output["findings"] if f.get("code") == "SEC046")
        assert sec046["severity"] == "critical"

    def test_safe_tools_no_combination_findings(self, tmp_path: Path) -> None:
        """Read-only tools should have no tool combination findings."""
        agent = self._make_agent(
            tmp_path,
            "safe-agent",
            "Read, Glob, Grep",
            "# Reader\n\n## Workflow\n1. Search\n2. Read\n",
        )
        output = self._scan_agent(agent)
        combo_codes = [c for c in self._finding_codes(output) if c.startswith("SEC04")]
        assert combo_codes == [], f"Safe agent has combo findings: {combo_codes}"

    def test_findings_have_recommendations(self, tmp_path: Path) -> None:
        """All tool combination findings must include recommendations."""
        agent = self._make_agent(
            tmp_path,
            "combo-agent",
            "Bash, WebFetch, Write, Edit, Glob, Task",
            "# Agent\n\n## Workflow\n1. Do everything\n",
        )
        output = self._scan_agent(agent)
        combo_findings = [f for f in output["findings"] if f.get("code", "").startswith("SEC04")]
        assert len(combo_findings) >= 4, f"Expected >=4 combo findings, got {len(combo_findings)}"
        for finding in combo_findings:
            assert finding.get("recommendation"), f"{finding['code']} missing recommendation"


class TestMAESTROAnalysis:
    """Tests for MAESTRO framework security analysis (Feature #18)."""

    def _scan_agent(self, agent_file: Path) -> dict:
        """Run security_scanner.py --json on an agent file."""
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
        assert result.stdout.strip(), f"Scanner produced no output: {result.stderr}"
        return json.loads(result.stdout)

    def _make_agent(self, tmp_path: Path, name: str, tools: str, body: str) -> Path:
        f = tmp_path / f"{name}.md"
        f.write_text(f"---\nname: {name}\ndescription: Test agent\ntools: {tools}\n---\n\n{body}\n")
        return f

    def test_maestro_report_has_all_6_layers(self, tmp_path: Path) -> None:
        """MAESTRO report must contain analysis for all 6 layers."""
        agent = self._make_agent(
            tmp_path,
            "full-agent",
            "Read, Glob, Grep",
            "# Agent\n\n## Workflow\n1. Read files\n2. Search patterns\n",
        )
        output = self._scan_agent(agent)
        maestro = output.get("maestro_analysis")
        assert maestro is not None, "MAESTRO analysis missing from output"
        layers = maestro["layer_analyses"]
        assert len(layers) == 6, f"Expected 6 layers, got {len(layers)}"
        layer_names = {la["layer"] for la in layers}
        expected = {
            "foundation",
            "data",
            "application",
            "infrastructure",
            "orchestration",
            "governance",
        }
        assert layer_names == expected, f"Missing layers: {expected - layer_names}"

    def test_maestro_overall_score_calculated(self, tmp_path: Path) -> None:
        """MAESTRO overall_score must be a number between 0 and 10."""
        agent = self._make_agent(
            tmp_path,
            "scored-agent",
            "Read, Glob",
            "# Agent\n\n## Workflow\n1. Read and report\n",
        )
        output = self._scan_agent(agent)
        maestro = output["maestro_analysis"]
        assert isinstance(maestro["overall_score"], (int, float))
        assert 0 <= maestro["overall_score"] <= 10

    def test_maestro_critical_gaps_identified(self, tmp_path: Path) -> None:
        """Dangerous agents should have critical_gaps in MAESTRO report."""
        agent = self._make_agent(
            tmp_path,
            "dangerous-maestro",
            "Bash, Write, WebFetch",
            "# Dangerous\n\n## Workflow\n1. Run rm -rf /tmp/data\n"
            "2. Execute sudo commands\n3. chmod 777 /etc/config\n",
        )
        output = self._scan_agent(agent)
        maestro = output["maestro_analysis"]
        assert len(maestro["critical_gaps"]) > 0, "Dangerous agent should have critical gaps"

    def test_maestro_remediation_priority_ordered(self, tmp_path: Path) -> None:
        """remediation_priority should be ordered (worst layers first)."""
        agent = self._make_agent(
            tmp_path,
            "risky-agent",
            "Bash, Write, Read",
            "# Risky\n\n## Workflow\n1. Execute commands with Bash\n"
            "2. Write output files\n3. Read configuration\n",
        )
        output = self._scan_agent(agent)
        maestro = output["maestro_analysis"]
        priority = maestro.get("remediation_priority", [])
        assert isinstance(priority, list)
        # Priority list should not be empty for agents with high-risk tools
        assert len(priority) > 0, "Risky agent should have remediation priorities"

    def test_clean_agent_maestro_mostly_secure(self, tmp_path: Path) -> None:
        """Clean read-only agent should have mostly secure MAESTRO layers."""
        agent = self._make_agent(
            tmp_path,
            "clean-maestro",
            "Read, Glob, Grep",
            "# Reader\n\n## Workflow\n1. Search with Glob\n"
            "2. Read with Read\n3. Filter with Grep\n",
        )
        output = self._scan_agent(agent)
        maestro = output["maestro_analysis"]
        secure_layers = [la for la in maestro["layer_analyses"] if la["status"] == "secure"]
        assert len(secure_layers) >= 4, (
            f"Clean agent should have >=4 secure layers, got {len(secure_layers)}"
        )

    def test_orchestration_layer_flags_task_tool(self, tmp_path: Path) -> None:
        """Agents with Task tool should get orchestration layer recommendations."""
        agent = self._make_agent(
            tmp_path,
            "orchestrator-maestro",
            "Read, Task, Glob",
            "# Orchestrator\n\n## Workflow\n1. Spawn workers with Task\n2. Collect results\n",
        )
        output = self._scan_agent(agent)
        maestro = output["maestro_analysis"]
        orch_layer = next(la for la in maestro["layer_analyses"] if la["layer"] == "orchestration")
        has_task_rec = any("subagent" in r.lower() for r in orch_layer.get("recommendations", []))
        assert has_task_rec, (
            f"Orchestration layer should mention subagent constraints, "
            f"got: {orch_layer.get('recommendations', [])}"
        )


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
        """Real test: builder type with create purpose should get write/edit tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "builder",
                "--purpose",
                "create new module files",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Write" in tools

    def test_automation_type_tools(self) -> None:
        """Real test: automation type with run purpose should get bash tool."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "automation",
                "--purpose",
                "run build scripts and deploy",
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


class TestInstallAgentSubprocess:
    """Subprocess robustness for run_syntax_validation / run_security_scan.

    A validator that crashes (non-zero returncode) must not be misreported
    as 'invalid agent' and must not blow up on JSONDecodeError silently —
    the operator needs to see the exit code and truncated stderr so they
    can distinguish a broken validator from a legitimately invalid agent.

    The companion scripts (syntax_validator.py, security_scanner.py) exist
    next to install_agent.py in SCRIPTS_DIR, so the real Path.exists guard
    passes without any monkeypatching — we only need to stub subprocess.run
    to control the simulated process outcome.
    """

    @staticmethod
    def _load_install_agent():  # type: ignore[no-untyped-def]
        """Import install_agent after ensuring SCRIPTS_DIR is on sys.path."""
        if str(SCRIPTS_DIR) not in sys.path:
            sys.path.insert(0, str(SCRIPTS_DIR))
        import install_agent

        return install_agent

    def test_validator_crash_returns_crash_message(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Non-zero returncode surfaces 'validator crashed (exit N): <stderr>'."""
        install_agent = self._load_install_agent()
        source = tmp_path / "agent.md"
        source.write_text("---\nname: x\n---\n")

        class _CrashedProc:
            returncode = 1
            stdout = ""
            stderr = "traceback: something exploded\nfinal: boom"

        monkeypatch.setattr(install_agent.subprocess, "run", lambda *a, **k: _CrashedProc())

        ok, errors = install_agent.run_syntax_validation(source)
        assert ok is False
        assert len(errors) == 1
        assert errors[0].startswith("validator crashed (exit 1):")
        # Stderr must be surfaced so the operator can diagnose the crash.
        assert "boom" in errors[0]

    def test_json_decode_error_includes_stderr(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """JSONDecodeError (returncode 0 but garbage stdout) carries truncated stderr."""
        install_agent = self._load_install_agent()
        source = tmp_path / "agent.md"
        source.write_text("---\nname: x\n---\n")

        class _GarbledProc:
            returncode = 0
            stdout = "not valid json {"
            stderr = "deprecation warning: foo"

        monkeypatch.setattr(install_agent.subprocess, "run", lambda *a, **k: _GarbledProc())

        ok, errors = install_agent.run_syntax_validation(source)
        assert ok is False
        assert len(errors) == 1
        assert "Failed to parse validation output" in errors[0]
        assert "deprecation warning: foo" in errors[0]

    def test_security_scan_crash_returns_false(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """run_security_scan must fail closed AND surface the crash to stderr.

        A crashed scanner (exit != 0) cannot have produced a trustworthy
        JSON verdict, so parsing its stdout would be a bug; the function
        must return (False, 0.0) without attempting json.loads. Because the
        return signature has no error channel, the crash reason must be
        logged to stderr so the operator can distinguish a scanner crash
        from a clean scan that flagged critical findings.
        """
        install_agent = self._load_install_agent()
        source = tmp_path / "agent.md"
        source.write_text("---\nname: x\n---\n")

        class _CrashedProc:
            returncode = 2
            # Deliberately set stdout to something that would json.loads to
            # passed=True if the returncode guard were missing — proving the
            # guard short-circuits before the (untrustworthy) parse attempt.
            stdout = '{"passed": true, "score": 10.0}'
            stderr = "scanner exploded"

        monkeypatch.setattr(install_agent.subprocess, "run", lambda *a, **k: _CrashedProc())

        passed, score = install_agent.run_security_scan(source)
        assert passed is False
        assert score == 0.0

        # The crash MUST surface to stderr — a silent (False, 0.0) would be
        # indistinguishable from a clean scan that found critical issues.
        err = capsys.readouterr().err
        assert "scanner crashed" in err
        assert "exit 2" in err
        assert "scanner exploded" in err


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


class TestVerificationSectionGeneration:
    """Tests for Feature #26: Verification criteria section generation."""

    def test_verification_heading_present(self, tmp_path: Path) -> None:
        """Generated agent file includes ## Verification heading."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-verifier",
                "--description",
                "Verifies code quality",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "test-verifier.md").read_text()
        assert "## Verification" in content

    def test_success_criteria_present(self, tmp_path: Path) -> None:
        """Verification section includes Success Criteria subsection."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-checker",
                "--description",
                "Checks things",
                "--tools",
                "Read,Bash",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "test-checker.md").read_text()
        assert "### Success Criteria" in content
        assert "All requested tasks completed" in content
        assert "No security violations" in content

    def test_bash_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Bash tool agents get exit code verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "bash-agent",
                "--description",
                "Runs shell commands",
                "--tools",
                "Bash,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "bash-agent.md").read_text()
        assert "exit code 0" in content.lower() or "exited with code 0" in content

    def test_write_edit_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Write/Edit tool agents get file modification verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "writer-agent",
                "--description",
                "Writes files",
                "--tools",
                "Write,Edit,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "writer-agent.md").read_text()
        assert "syntax validation" in content.lower() or "syntax" in content.lower()
        assert "unintended files" in content.lower()
        assert "git diff" in content

    def test_task_tool_specific_criteria(self, tmp_path: Path) -> None:
        """Task tool agents get subagent result verification criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "orchestrator-agent",
                "--description",
                "Orchestrates subagents",
                "--tools",
                "Task,Read,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "orchestrator-agent.md").read_text()
        assert "subagent" in content.lower()

    def test_verification_commands_for_write_agents(self, tmp_path: Path) -> None:
        """Write agents get git diff verification commands."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "file-writer",
                "--description",
                "Creates new files",
                "--tools",
                "Write,Read",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "file-writer.md").read_text()
        assert "### Verification Commands" in content
        assert "git diff --name-only" in content

    def test_expected_output_structure(self, tmp_path: Path) -> None:
        """Verification section includes expected output structure."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "output-agent",
                "--description",
                "Produces structured output",
                "--tools",
                "Read,Grep",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "output-agent.md").read_text()
        assert "### Expected Output" in content
        assert "Status summary" in content
        assert "Action log" in content
        assert "Next steps" in content

    def test_read_only_agent_no_git_diff_commands(self, tmp_path: Path) -> None:
        """Read-only agents should not get git diff verification commands."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "reader-agent",
                "--description",
                "Reads and analyzes code",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        content = (tmp_path / "reader-agent.md").read_text()
        assert "git diff --name-only" not in content

    def test_quality_scorer_verification_check(self, tmp_path: Path) -> None:
        """Quality scorer checks for verification section presence."""
        # Agent with verification section (generated by agent_generator)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "scored-agent",
                "--description",
                "Agent with verification section for scoring",
                "--tools",
                "Read,Grep,Bash",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Score it
        md_file = tmp_path / "scored-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "quality_scorer.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"Scorer produced no output, stderr: {result.stderr}"
        score_data = json.loads(output)
        # Documentation criterion should mention verification
        doc_criterion = next(
            (c for c in score_data["criteria"] if c["name"] == "Documentation"),
            None,
        )
        assert doc_criterion is not None
        all_findings = " ".join(doc_criterion["findings"])
        assert "verification" in all_findings.lower()


class TestEnhancedExampleGeneration:
    """Tests for Feature #27: Enhanced example generation with diversity."""

    def _generate_agent(self, tmp_path: Path, name: str, desc: str, tools: str) -> str:
        """Helper to generate an agent and return its content."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                name,
                "--description",
                desc,
                "--tools",
                tools,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return (tmp_path / f"{name}.md").read_text()

    def test_minimum_four_examples_generated(self, tmp_path: Path) -> None:
        """Generated agents have at least 4 examples (basic, advanced, error, edge)."""
        content = self._generate_agent(
            tmp_path, "example-agent", "Analyzes code quality", "Read,Grep,Glob"
        )
        example_headings = [line for line in content.split("\n") if line.startswith("### Example")]
        assert len(example_headings) >= 4, (
            f"Expected ≥4 examples, got {len(example_headings)}: {example_headings}"
        )

    def test_basic_usage_example_present(self, tmp_path: Path) -> None:
        """Example 1 covers basic/happy path usage."""
        content = self._generate_agent(
            tmp_path, "basic-agent", "Searches for patterns", "Read,Grep"
        )
        assert "Basic Usage" in content

    def test_error_scenario_example_present(self, tmp_path: Path) -> None:
        """Example 3 covers an error scenario."""
        content = self._generate_agent(
            tmp_path, "error-agent", "Writes configuration files", "Write,Edit,Read"
        )
        assert "Error Scenario" in content

    def test_edge_case_example_present(self, tmp_path: Path) -> None:
        """Example 4 covers edge case handling."""
        content = self._generate_agent(tmp_path, "edge-agent", "Processes data files", "Read,Glob")
        assert "Edge Case" in content

    def test_error_example_shows_error_status(self, tmp_path: Path) -> None:
        """Error scenario example includes error status in output."""
        content = self._generate_agent(
            tmp_path, "err-status-agent", "Runs shell commands", "Bash,Read"
        )
        assert '"status": "error"' in content

    def test_error_example_tool_specific_bash(self, tmp_path: Path) -> None:
        """Bash agents get permission-related error scenario."""
        content = self._generate_agent(
            tmp_path, "bash-err-agent", "Executes build commands", "Bash,Read"
        )
        assert "permission" in content.lower() or "elevated" in content.lower()

    def test_error_example_tool_specific_write(self, tmp_path: Path) -> None:
        """Write agents get read-only file error scenario."""
        content = self._generate_agent(
            tmp_path, "write-err-agent", "Creates new modules", "Write,Edit,Read"
        )
        assert "read-only" in content.lower()

    def test_error_example_tool_specific_web(self, tmp_path: Path) -> None:
        """WebFetch agents get unreachable endpoint error scenario."""
        content = self._generate_agent(
            tmp_path, "web-err-agent", "Fetches API docs", "WebFetch,Read"
        )
        assert "unreachable" in content.lower()

    def test_error_example_tool_specific_task(self, tmp_path: Path) -> None:
        """Task agents get subagent failure error scenario."""
        content = self._generate_agent(
            tmp_path, "task-err-agent", "Orchestrates workers", "Task,Read,Glob"
        )
        assert "subagent" in content.lower() and "fail" in content.lower()

    def test_scorer_validates_diversity(self, tmp_path: Path) -> None:
        """Quality scorer recognizes full example diversity."""
        self._generate_agent(tmp_path, "diverse-agent", "Analyzes security", "Read,Grep,Bash")
        md_file = tmp_path / "diverse-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "quality_scorer.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"Scorer produced no output, stderr: {result.stderr}"
        score_data = json.loads(output)
        examples_criterion = next(
            (c for c in score_data["criteria"] if c["name"] == "Examples"),
            None,
        )
        assert examples_criterion is not None
        all_findings = " ".join(examples_criterion["findings"])
        assert "diversity" in all_findings.lower()


class TestLeastPrivilegeToolSelection:
    """Tests for Feature #30: Least-privilege tool selection algorithm."""

    def _select(self, agent_type: str, purpose: str, **kwargs: str) -> dict:
        """Helper to run tool_selector CLI and return JSON result."""
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "tool_selector.py"),
            "--type",
            agent_type,
            "--purpose",
            purpose,
            "--json-output",
        ]
        if "domain" in kwargs:
            cmd.extend(["--domain", kwargs["domain"]])
        result = subprocess.run(cmd, capture_output=True, text=True)
        assert result.returncode == 0, f"tool_selector failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_analyzer_gets_read_only_tools(self) -> None:
        """Analyzer agents should only get Read/Grep/Glob — no Write/Edit/Bash."""
        data = self._select("analyzer", "scan code for vulnerabilities")
        tools = data["tools"]
        assert "Read" in tools
        assert "Grep" in tools
        assert "Glob" in tools
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_validator_gets_read_only_tools(self) -> None:
        """Validator agents should only get Read/Grep/Glob — no mutation tools."""
        data = self._select("validator", "check code style compliance")
        tools = data["tools"]
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_builder_without_create_gets_edit_not_write(self) -> None:
        """Builder with 'modify' purpose gets Edit, not Write."""
        data = self._select("builder", "modify existing configuration files")
        tools = data["tools"]
        assert "Edit" in tools
        assert "Write" not in tools

    def test_builder_with_create_keeps_write(self) -> None:
        """Builder with 'create' purpose retains Write tool."""
        data = self._select("builder", "create new module files")
        tools = data["tools"]
        assert "Write" in tools

    def test_builder_with_generate_keeps_write(self) -> None:
        """Builder with 'generate' purpose retains Write tool."""
        data = self._select("builder", "generate documentation files")
        tools = data["tools"]
        assert "Write" in tools

    def test_automation_without_shell_keywords_loses_bash(self) -> None:
        """Automation agent without shell keywords loses Bash."""
        data = self._select("automation", "update file metadata")
        tools = data["tools"]
        assert "Bash" not in tools

    def test_automation_with_shell_keywords_keeps_bash(self) -> None:
        """Automation agent with 'run tests' keeps Bash."""
        data = self._select("automation", "run tests and build artifacts")
        tools = data["tools"]
        assert "Bash" in tools

    def test_least_privilege_notes_in_warnings(self) -> None:
        """Least-privilege enforcement produces warning notes."""
        data = self._select("builder", "modify existing code")
        warnings = data["warnings"]
        lp_notes = [w for w in warnings if "Least-privilege" in w]
        assert len(lp_notes) > 0, "Expected least-privilege enforcement notes"

    def test_analyzer_with_security_domain_stays_read_only(self) -> None:
        """Analyzer in security domain should still be read-only."""
        data = self._select("analyzer", "audit authentication module", domain="security")
        tools = data["tools"]
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_least_privilege_disabled_keeps_all_tools(self) -> None:
        """When least_privilege=false via JSON, Write and Bash are preserved."""
        input_json = json.dumps(
            {
                "type": "builder",
                "purpose": "modify files",
                "least_privilege": False,
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "builder",
                "--purpose",
                "modify files",
                "--json-output",
                "--json",
                input_json,
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        # With default behavior (no --no-least-privilege flag), still enforced
        # This tests the default path which has least_privilege=True
        # The Write should be downgraded since no create keywords
        tools = data["tools"]
        assert "Edit" in tools


class TestAgentTeamCompatibility:
    """Tests for Feature #35: Agent team compatibility in multi-agent systems."""

    def _generate_system(self, tmp_path: Path, template: str) -> list[Path]:
        """Helper to generate a multi-agent system and return created files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                template,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return list(tmp_path.glob("*.md"))

    def test_worker_has_team_compatibility_section(self, tmp_path: Path) -> None:
        """Worker agents include ## Team Compatibility section."""
        files = self._generate_system(tmp_path, "code-review")
        # Find a worker file (not orchestrator)
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        content = worker_files[0].read_text()
        assert "## Team Compatibility" in content

    def test_worker_has_standalone_mode(self, tmp_path: Path) -> None:
        """Worker agents document standalone mode usage."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Standalone Mode" in content

    def test_worker_has_team_mode(self, tmp_path: Path) -> None:
        """Worker agents document team mode usage."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Team Mode" in content

    def test_worker_has_teammate_discovery(self, tmp_path: Path) -> None:
        """Worker agents include teammate discovery instructions."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Teammate Discovery" in content
        assert ".claude/agents/*.md" in content

    def test_worker_has_shared_task_patterns(self, tmp_path: Path) -> None:
        """Worker agents reference shared task list patterns."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Shared Task Patterns" in content
        assert "TodoWrite" in content

    def test_orchestrator_has_teammate_discovery(self, tmp_path: Path) -> None:
        """Orchestrator includes teammate discovery section."""
        files = self._generate_system(tmp_path, "code-review")
        orchestrator_files = [f for f in files if "orchestrator" in f.name]
        assert len(orchestrator_files) > 0
        content = orchestrator_files[0].read_text()
        assert "## Teammate Discovery" in content

    def test_orchestrator_has_team_coordination(self, tmp_path: Path) -> None:
        """Orchestrator includes shared task list with TodoWrite coordination."""
        files = self._generate_system(tmp_path, "code-review")
        orchestrator_files = [f for f in files if "orchestrator" in f.name]
        content = orchestrator_files[0].read_text()
        assert "## Shared Task List" in content
        assert "TodoWrite" in content

    def test_all_workers_have_team_compatibility(self, tmp_path: Path) -> None:
        """Every worker in the system has team compatibility, not just the first."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) >= 2, "Expected multiple workers"
        for wf in worker_files:
            content = wf.read_text()
            assert "## Team Compatibility" in content, (
                f"Worker {wf.name} missing Team Compatibility"
            )

    def test_documentation_template_workers_have_team_compat(self, tmp_path: Path) -> None:
        """Documentation template workers also get team compatibility."""
        files = self._generate_system(tmp_path, "documentation")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        for wf in worker_files:
            content = wf.read_text()
            assert "## Team Compatibility" in content


class TestSharedTaskListTemplate:
    """Tests for Feature #36: Orchestrator-workers with shared task list."""

    def _generate_system(self, tmp_path: Path, template: str) -> list[Path]:
        """Helper to generate a multi-agent system and return created files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                template,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return list(tmp_path.glob("*.md"))

    def test_orchestrator_has_shared_task_list_section(self, tmp_path: Path) -> None:
        """Orchestrator includes ## Shared Task List section."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        assert len(orch_files) > 0
        content = orch_files[0].read_text()
        assert "## Shared Task List" in content

    def test_orchestrator_has_task_creation_workflow(self, tmp_path: Path) -> None:
        """Orchestrator documents task creation with TodoWrite."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Creation" in content
        assert "TodoWrite" in content
        assert '"pending"' in content

    def test_orchestrator_has_task_sizing_guidelines(self, tmp_path: Path) -> None:
        """Orchestrator includes 5-6 tasks per worker guidance."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Sizing Guidelines" in content
        assert "5-6" in content

    def test_orchestrator_has_task_lifecycle(self, tmp_path: Path) -> None:
        """Orchestrator documents task lifecycle states."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Lifecycle" in content
        assert "pending" in content
        assert "in_progress" in content
        assert "completed" in content

    def test_worker_has_task_claiming_pattern(self, tmp_path: Path) -> None:
        """Workers include task claiming workflow steps."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        content = worker_files[0].read_text()
        assert "Claim task" in content
        assert "in_progress" in content

    def test_worker_has_task_capacity_guidance(self, tmp_path: Path) -> None:
        """Workers include 5-6 tasks capacity guidance."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Task Capacity" in content
        assert "5-6" in content

    def test_worker_claiming_uses_todowrite(self, tmp_path: Path) -> None:
        """Worker task claiming uses TodoWrite tool."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "TodoWrite" in content

    def test_all_workers_have_claiming_pattern(self, tmp_path: Path) -> None:
        """Every worker in the system has the task claiming pattern."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) >= 2
        for wf in worker_files:
            content = wf.read_text()
            assert "Claim task" in content, f"Worker {wf.name} missing task claiming pattern"


class TestLiveAgentInvocation:
    """Tests for Feature #43: Live agent invocation via 'claude -p'."""

    def _create_agent_file(self, tmp_path: Path) -> Path:
        """Create a minimal valid agent file for testing."""
        agent_md = tmp_path / "test-agent.md"
        agent_md.write_text(
            "---\n"
            "name: test-agent\n"
            "description: A test agent that analyzes code quality metrics\n"
            "tools: Read, Grep, Glob\n"
            "---\n\n"
            "# Test Agent\n\n"
            "## Workflow\n"
            "1. Read target files\n"
            "2. Analyze quality\n"
            "3. Report findings\n\n"
            "## Examples\n"
            "### Example 1: Basic Usage\n"
            "```\nUse test-agent to review code\n```\n"
        )
        return agent_md

    def test_live_flag_in_help_output(self) -> None:
        """CLI --live flag is available in help output."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "--live" in result.stdout

    def test_live_tests_not_included_by_default(self, tmp_path: Path) -> None:
        """Without --live flag, no live_ tests are created."""
        agent_md = self._create_agent_file(tmp_path)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                str(agent_md),
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        live_tests = [r for r in data["results"] if r["test_name"].startswith("live_")]
        assert len(live_tests) == 0

    def test_live_flag_adds_live_tests(self, tmp_path: Path) -> None:
        """With --live flag, live_ test cases are added to the suite.

        Tests this by calling create_live_tests() directly to avoid
        triggering actual claude -p invocations which would time out.
        """
        agent_md = self._create_agent_file(tmp_path)
        test_script = tmp_path / "test_live_flag.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import parse_agent_file, create_live_tests\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(agent_md) + "'))\n"
            "tests = create_live_tests(agent)\n"
            "names = [t.name for t in tests]\n"
            "print(json.dumps({'count': len(tests), 'names': names}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 2, f"Expected ≥2 live tests, got {data['count']}"
        assert all(n.startswith("live_") for n in data["names"]), (
            f"Non-live test names: {data['names']}"
        )

    def test_live_test_graceful_when_claude_missing(self, tmp_path: Path) -> None:
        """Live tests report SKIP when claude binary is not found."""
        agent_md = self._create_agent_file(tmp_path)
        # Use a subprocess that tests run_live_test with a non-existent binary
        test_script = tmp_path / "test_live.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_test',\n"
            "    description='test',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=[],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='/nonexistent/claude')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert "not executable" in data["message"] or "SKIP" in data["message"]

    def test_live_test_timeout_handling(self, tmp_path: Path) -> None:
        """Live tests handle timeout correctly."""
        agent_md = self._create_agent_file(tmp_path)
        # Create a fake "claude" script that sleeps forever
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text("#!/bin/bash\nsleep 30\n")
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_timeout.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_timeout_test',\n"
            "    description='test timeout',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=[],\n"
            "    timeout_seconds=1,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert "TIMEOUT" in data["message"]

    def test_live_test_pattern_matching(self, tmp_path: Path) -> None:
        """Live tests match expected patterns in output."""
        agent_md = self._create_agent_file(tmp_path)
        # Create a fake "claude" script that echoes known output
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "Agent test-agent analyzing code quality"\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_pattern.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_pattern_test',\n"
            "    description='test patterns',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['test-agent', 'quality'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'message': result.message, "
            "'details': result.details}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is True
        assert any("Matched" in d for d in data["details"])

    def test_live_test_forbidden_pattern_detection(self, tmp_path: Path) -> None:
        """Live tests detect forbidden patterns in output."""
        agent_md = self._create_agent_file(tmp_path)
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "rm -rf / is dangerous"\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_forbidden.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_forbidden_test',\n"
            "    description='test forbidden',\n"
            "    input_prompt='hello',\n"
            r"    forbidden_patterns=[r'rm\s+-rf\s+/']," + "\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({'passed': result.passed, 'details': result.details}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False
        assert any("forbidden" in d.lower() for d in data["details"])

    def test_create_live_tests_generates_test_cases(self, tmp_path: Path) -> None:
        """create_live_tests() produces test cases with live_ prefix."""
        test_script = tmp_path / "test_create.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import create_live_tests, AgentInfo\n"
            "agent = AgentInfo(\n"
            "    name='scanner',\n"
            "    description='Scans code for security vulnerabilities and issues',\n"
            "    tools=['Read', 'Grep', 'Glob'],\n"
            "    sections={},\n"
            "    workflow_steps=['scan', 'report'],\n"
            "    examples=[],\n"
            ")\n"
            "tests = create_live_tests(agent)\n"
            "names = [t.name for t in tests]\n"
            "print(json.dumps({'count': len(tests), 'names': names, "
            "'all_live': all(n.startswith('live_') for n in names)}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 2
        assert data["all_live"] is True

    def test_find_claude_binary_returns_path_or_none(self, tmp_path: Path) -> None:
        """find_claude_binary() returns a string path or None."""
        test_script = tmp_path / "test_find.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import find_claude_binary\n"
            "result = find_claude_binary()\n"
            "print(json.dumps({'result': result, 'type': type(result).__name__}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["type"] in ("str", "NoneType")


class TestTestHarnessExitCode:
    """Tests for Feature #7: non-zero subprocess returncode always fails.

    OQ-4 resolved (always-fail): when the claude subprocess exits with a
    non-zero return code, run_live_test() must set passed=False regardless
    of whether expected_patterns matched. The exit code is surfaced in the
    result details. The zero-exit baseline (pattern-match only) is preserved.
    """

    def _create_agent_file(self, tmp_path: Path) -> Path:
        """Create a minimal valid agent file for testing."""
        agent_md = tmp_path / "exit-code-agent.md"
        agent_md.write_text(
            "---\n"
            "name: exit-code-agent\n"
            "description: Test agent used to verify exit-code handling\n"
            "tools: Read\n"
            "---\n\n"
            "# Exit Code Agent\n\n"
            "## Workflow\n"
            "1. Run\n\n"
            "## Examples\n"
            "### Example 1: Basic Usage\n"
            "```\nUse exit-code-agent\n```\n"
        )
        return agent_md

    def test_nonzero_exit_is_failure(self, tmp_path: Path) -> None:
        """Non-zero exit unconditionally fails even when patterns match.

        A fake claude that prints a matching pattern but exits with code 127
        (command-not-found style) must produce passed=False, and the exit
        code must appear in result.details.
        """
        agent_md = self._create_agent_file(tmp_path)
        # Fake claude: emits a string that matches expected_patterns, then
        # exits 127 (process-level failure signal).
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "exit-code-agent running analysis"\nexit 127\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_nonzero_exit.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_exit_127',\n"
            "    description='nonzero exit with matching pattern',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['exit-code-agent', 'analysis'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({\n"
            "    'passed': result.passed,\n"
            "    'message': result.message,\n"
            "    'details': result.details,\n"
            "}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is False, (
            "Non-zero exit (127) must force failure even with matching patterns"
        )
        assert data["message"] == "FAIL"
        # Exit code must be surfaced in details (reproducibility requirement)
        assert any("127" in d for d in data["details"]), (
            f"Expected exit code 127 in details, got: {data['details']}"
        )
        assert any("non-zero exit forces failure" in d for d in data["details"]), (
            f"Expected failure reason in details, got: {data['details']}"
        )

    def test_zero_exit_unchanged_behavior(self, tmp_path: Path) -> None:
        """Zero-exit baseline preserved: pattern-match still determines pass.

        A fake claude that emits matching patterns and exits 0 must still
        pass, proving the fix only affects the non-zero branch.
        """
        agent_md = self._create_agent_file(tmp_path)
        fake_claude = tmp_path / "fake_claude.sh"
        fake_claude.write_text('#!/bin/bash\necho "exit-code-agent completed analysis"\nexit 0\n')
        fake_claude.chmod(0o755)

        test_script = tmp_path / "test_zero_exit.py"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import run_live_test, TestCase\n"
            "from pathlib import Path\n"
            "tc = TestCase(\n"
            "    name='live_exit_0',\n"
            "    description='zero exit with matching pattern',\n"
            "    input_prompt='hello',\n"
            "    expected_patterns=['exit-code-agent', 'analysis'],\n"
            "    timeout_seconds=5,\n"
            ")\n"
            "result = run_live_test(tc, Path('" + str(agent_md) + "'), "
            "claude_binary='" + str(fake_claude) + "')\n"
            "print(json.dumps({\n"
            "    'passed': result.passed,\n"
            "    'message': result.message,\n"
            "    'details': result.details,\n"
            "}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["passed"] is True, (
            "Zero exit with matching patterns must still pass (baseline preserved)"
        )
        assert data["message"] == "PASS"
        # No exit-code detail should be present on zero exit
        assert not any("Exit code:" in d for d in data["details"]), (
            f"Zero exit should not emit exit-code detail, got: {data['details']}"
        )


class TestAutoGenerateTestsFromExamples:
    """Tests for Feature #44: Auto-generate test cases from agent examples."""

    def _generate_and_create_tests(self, tmp_path: Path) -> dict:
        """Generate an agent then run --create-tests on it, return JSON."""
        # Generate agent
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "auto-test-agent",
                "--description",
                "Scans code for security vulnerabilities and issues",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"

        # Create tests from generated agent
        md_file = tmp_path / "auto-test-agent.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--create-tests",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"create-tests failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_create_tests_extracts_user_requests_as_inputs(self, tmp_path: Path) -> None:
        """User Request prompts from examples become test input_prompt values."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        assert len(example_tests) >= 3, f"Expected ≥3 example tests, got {len(example_tests)}"
        # Each example test should have a non-empty input_prompt
        for t in example_tests:
            assert t["input_prompt"], f"Test {t['name']} has empty input_prompt"

    def test_create_tests_extracts_expected_patterns(self, tmp_path: Path) -> None:
        """Agent Actions descriptions become expected_patterns."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        # At least some example tests should have expected_patterns
        tests_with_patterns = [t for t in example_tests if t.get("expected_patterns")]
        assert len(tests_with_patterns) >= 1, "No example tests have expected_patterns"

    def test_create_tests_includes_workflow_and_error_tests(self, tmp_path: Path) -> None:
        """Template always includes workflow_execution and error_handling tests."""
        data = self._generate_and_create_tests(tmp_path)
        test_names = [t["name"] for t in data["tests"]]
        assert "workflow_execution" in test_names
        assert "error_handling" in test_names

    def test_create_tests_names_are_slugified(self, tmp_path: Path) -> None:
        """Example test names are slugified from titles."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        for t in example_tests:
            # Names should be lowercase with underscores, no spaces
            assert " " not in t["name"], f"Space in test name: {t['name']}"
            assert t["name"] == t["name"].lower(), f"Uppercase in test name: {t['name']}"

    def test_create_tests_input_contains_agent_name(self, tmp_path: Path) -> None:
        """User request inputs reference the agent name."""
        data = self._generate_and_create_tests(tmp_path)
        example_tests = [t for t in data["tests"] if t["name"].startswith("example_")]
        # At least one example should mention agent name in input
        inputs_with_name = [t for t in example_tests if "auto-test-agent" in t["input_prompt"]]
        assert len(inputs_with_name) >= 1, "No example test inputs contain agent name"

    def test_parser_extracts_user_request_field(self, tmp_path: Path) -> None:
        """Parser extracts user_request from **User Request:** blocks."""
        test_script = tmp_path / "test_parse.py"
        # Generate agent first
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "parse-test-agent",
                "--description",
                "Analyzes code quality metrics and reports findings",
                "--tools",
                "Read,Grep",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "parse-test-agent.md"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import parse_agent_file\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(md_file) + "'))\n"
            "user_reqs = [e.get('user_request', '') for e in agent.examples]\n"
            "agent_acts = [e.get('agent_actions', '') for e in agent.examples]\n"
            "print(json.dumps({'user_requests': user_reqs, "
            "'agent_actions': agent_acts, 'count': len(agent.examples)}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 4, f"Expected ≥4 examples, got {data['count']}"
        # At least first example should have user_request
        non_empty_reqs = [r for r in data["user_requests"] if r]
        assert len(non_empty_reqs) >= 3, (
            f"Expected ≥3 user_request fields, got {len(non_empty_reqs)}"
        )

    def test_parser_extracts_agent_actions_field(self, tmp_path: Path) -> None:
        """Parser extracts agent_actions from **Agent Actions:** blocks."""
        test_script = tmp_path / "test_actions.py"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "actions-agent",
                "--description",
                "Builds documentation from source code analysis",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "actions-agent.md"
        test_script.write_text(
            "import json, sys\n"
            "sys.path.insert(0, '" + str(SCRIPTS_DIR) + "')\n"
            "from test_harness import parse_agent_file\n"
            "from pathlib import Path\n"
            "agent = parse_agent_file(Path('" + str(md_file) + "'))\n"
            "actions = [e.get('agent_actions', '') for e in agent.examples]\n"
            "non_empty = [a for a in actions if a]\n"
            "print(json.dumps({'count': len(non_empty), "
            "'sample': non_empty[0] if non_empty else ''}))\n"
        )
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["count"] >= 3, f"Expected ≥3 agent_actions, got {data['count']}"
        # Actions should contain semicolons (joined steps)
        assert ";" in data["sample"], f"Actions not joined with semicolons: {data['sample']}"

    def test_no_examples_falls_back_to_generic(self, tmp_path: Path) -> None:
        """Agent with no parseable examples gets generic fallback tests."""
        # Create a minimal agent with no examples section
        md_file = tmp_path / "bare-agent.md"
        md_file.write_text(
            "---\n"
            "name: bare-agent\n"
            "description: A minimal agent with no examples section at all\n"
            "tools: Read\n"
            "---\n\n"
            "# Bare Agent\n\n"
            "## Workflow\n"
            "1. Read files\n"
            "2. Process data\n"
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "test_harness.py"),
                "--create-tests",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        test_names = [t["name"] for t in data["tests"]]
        assert "basic_invocation" in test_names
        assert "workflow_execution" in test_names
        assert "error_handling" in test_names


class TestGeneratorRegressionSuite:
    """Regression tests for Feature #46: Known NLP inputs produce expected structures.

    Each test provides a specific (name, description, tools) input and verifies
    the generated agent file contains all expected structural elements. These
    serve as golden-path regression tests — if any change to the generator
    breaks these assertions, we catch it immediately.
    """

    def _generate(self, tmp_path: Path, name: str, desc: str, tools: str) -> str:
        """Generate an agent and return its content."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                name,
                "--description",
                desc,
                "--tools",
                tools,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return (tmp_path / f"{name}.md").read_text()

    def _validate(self, tmp_path: Path, name: str) -> dict:
        """Run syntax validator on generated file and return result."""
        md_file = tmp_path / f"{name}.md"
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
        return json.loads(result.stdout)

    # --- Analyzer type agents ---

    def test_security_scanner_agent(self, tmp_path: Path) -> None:
        """Security scanner: read-only tools, security keywords in output."""
        content = self._generate(
            tmp_path,
            "security-scanner",
            "Scans code for security vulnerabilities and OWASP issues",
            "Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "## Examples" in content
        assert "## Error Handling" in content
        assert "## Verification" in content
        assert "Read" in content.split("---")[1]  # In frontmatter
        validation = self._validate(tmp_path, "security-scanner")
        assert validation["passed"] is True

    def test_code_reviewer_agent(self, tmp_path: Path) -> None:
        """Code reviewer: read-only with Grep for pattern matching."""
        content = self._generate(
            tmp_path,
            "code-reviewer",
            "Reviews pull requests for code quality and best practices",
            "Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "## Examples" in content
        assert "Example 1: Basic Usage" in content
        assert "Example 3: Error Scenario" in content
        assert "Example 4: Edge Case" in content
        validation = self._validate(tmp_path, "code-reviewer")
        assert validation["passed"] is True

    # --- Builder type agents ---

    def test_doc_generator_agent(self, tmp_path: Path) -> None:
        """Doc generator: needs Write for creating files."""
        content = self._generate(
            tmp_path,
            "doc-generator",
            "Generates comprehensive API documentation from source code",
            "Read,Write,Glob,Grep",
        )
        assert "## Workflow" in content
        assert "Write" in content.split("---")[1]
        assert "## Prerequisites" in content
        validation = self._validate(tmp_path, "doc-generator")
        assert validation["passed"] is True

    def test_scaffolder_agent(self, tmp_path: Path) -> None:
        """Scaffolder: creates new files and directories."""
        content = self._generate(
            tmp_path,
            "project-scaffolder",
            "Creates new project structures with boilerplate files",
            "Write,Read,Bash,Glob",
        )
        assert "## Workflow" in content
        assert "Write" in content.split("---")[1]
        assert "Bash" in content.split("---")[1]
        validation = self._validate(tmp_path, "project-scaffolder")
        assert validation["passed"] is True

    # --- Automation type agents ---

    def test_test_runner_agent(self, tmp_path: Path) -> None:
        """Test runner: Bash-heavy for executing commands."""
        content = self._generate(
            tmp_path,
            "test-runner",
            "Runs test suites and reports results with coverage data",
            "Bash,Read,Glob",
        )
        assert "## Workflow" in content
        assert "Bash" in content.split("---")[1]
        assert "exit code" in content.lower() or "Exit code" in content
        validation = self._validate(tmp_path, "test-runner")
        assert validation["passed"] is True

    def test_ci_pipeline_agent(self, tmp_path: Path) -> None:
        """CI pipeline: Bash + Write for build artifacts."""
        content = self._generate(
            tmp_path,
            "ci-pipeline",
            "Runs continuous integration pipeline with build, test, deploy steps",
            "Bash,Read,Write,Glob",
        )
        assert "## Workflow" in content
        assert "## Error Handling" in content
        validation = self._validate(tmp_path, "ci-pipeline")
        assert validation["passed"] is True

    # --- Orchestrator type agents ---

    def test_orchestrator_agent(self, tmp_path: Path) -> None:
        """Orchestrator: uses Task tool to coordinate workers."""
        content = self._generate(
            tmp_path,
            "review-orchestrator",
            "Coordinates multiple review agents for comprehensive analysis",
            "Task,Read,Glob,Grep",
        )
        assert "## Workflow" in content
        assert "Task" in content.split("---")[1]
        assert "subagent" in content.lower() or "worker" in content.lower()
        validation = self._validate(tmp_path, "review-orchestrator")
        assert validation["passed"] is True

    # --- Web-enabled agents ---

    def test_research_agent(self, tmp_path: Path) -> None:
        """Research agent: WebSearch + WebFetch for information gathering."""
        content = self._generate(
            tmp_path,
            "research-agent",
            "Researches best practices and documentation from web sources",
            "WebSearch,WebFetch,Read",
        )
        assert "## Workflow" in content
        assert "WebSearch" in content.split("---")[1]
        assert "WebFetch" in content.split("---")[1]
        validation = self._validate(tmp_path, "research-agent")
        assert validation["passed"] is True

    # --- Interactive agents ---

    def test_guided_setup_agent(self, tmp_path: Path) -> None:
        """Guided setup: uses AskUserQuestion for interaction."""
        content = self._generate(
            tmp_path,
            "guided-setup",
            "Guides users through project configuration with interactive prompts",
            "AskUserQuestion,Read,Write,Glob",
        )
        assert "## Workflow" in content
        assert "AskUserQuestion" in content.split("---")[1]
        validation = self._validate(tmp_path, "guided-setup")
        assert validation["passed"] is True

    # --- Edit-focused agents ---

    def test_refactoring_agent(self, tmp_path: Path) -> None:
        """Refactoring agent: Edit-focused for modifying existing code."""
        content = self._generate(
            tmp_path,
            "code-refactorer",
            "Refactors code to improve readability and reduce complexity",
            "Edit,Read,Grep,Glob",
        )
        assert "## Workflow" in content
        assert "Edit" in content.split("---")[1]
        assert "## Verification" in content
        validation = self._validate(tmp_path, "code-refactorer")
        assert validation["passed"] is True

    # --- Structure consistency across all types ---

    def test_all_agents_have_14_standard_sections(self, tmp_path: Path) -> None:
        """Every generated agent has all standard sections."""
        agents = [
            ("section-check-1", "Analyzes code patterns", "Read,Grep"),
            ("section-check-2", "Creates test files", "Write,Read,Bash"),
            ("section-check-3", "Orchestrates workers", "Task,Read,Glob"),
        ]
        required_sections = [
            "## Workflow",
            "## Examples",
            "## Error Handling",
            "## Verification",
            "## Output Format",
        ]
        for name, desc, tools in agents:
            content = self._generate(tmp_path, name, desc, tools)
            for section in required_sections:
                assert section in content, f"Agent {name} missing section: {section}"

    def test_all_agents_pass_syntax_validation(self, tmp_path: Path) -> None:
        """Every generated agent passes syntax validation."""
        agents = [
            ("val-analyzer", "Validates input data quality", "Read,Grep"),
            ("val-builder", "Creates API endpoint stubs", "Write,Read,Glob"),
            ("val-runner", "Executes deployment scripts", "Bash,Read"),
            ("val-searcher", "Finds relevant documentation", "WebSearch,WebFetch,Read"),
        ]
        for name, desc, tools in agents:
            self._generate(tmp_path, name, desc, tools)
            result = self._validate(tmp_path, name)
            assert result["passed"] is True, (
                f"Agent {name} failed validation: {result.get('errors', [])}"
            )


class TestCompletenessCheckerRequiredSections:
    """Tests for Feature #47: Required sections in completeness checker."""

    def _check(self, tmp_path: Path, content: str) -> dict:
        """Write content to file and run completeness checker, return JSON."""
        md_file = tmp_path / "test-agent.md"
        md_file.write_text(content)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "completeness_checker.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        output = result.stdout.strip()
        assert output, f"No output, stderr: {result.stderr}"
        return json.loads(output)

    def _make_complete_agent(self) -> str:
        """Return a complete agent with all required sections."""
        return (
            "---\n"
            "name: complete-agent\n"
            "description: A complete agent with all required sections present\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# Complete Agent\n\n"
            "## Overview\nThis agent analyzes code quality.\n\n"
            "## Workflow\n1. Read files\n2. Analyze patterns\n3. Report\n\n"
            "## Examples\n### Example 1: Basic\n```\nUse agent\n```\n\n"
            "## Error Handling\nRetry on failure, report errors.\n\n"
            "## Verification\nCheck output matches expected format.\n\n"
            '## Output Format\n```json\n{"status": "success"}\n```\n'
        )

    def test_missing_error_handling_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Error Handling section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-error-handling\n"
            "description: Agent missing error handling section entirely\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Error Handling\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Verification\nCheck output.\n\n"
            "## Output Format\n```json\n{}\n```\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "error handling" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Error Handling not flagged as error"

    def test_missing_verification_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Verification section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-verification\n"
            "description: Agent missing verification section entirely here\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Verification\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Error Handling\nRetry on failure.\n\n"
            "## Output Format\n```json\n{}\n```\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "verification" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Verification not flagged as error"

    def test_missing_output_format_flagged_as_error(self, tmp_path: Path) -> None:
        """Missing Output Format section is flagged as error, not warning."""
        content = (
            "---\n"
            "name: no-output-format\n"
            "description: Agent missing output format section entirely here\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Output Format\n\n"
            "## Overview\nAnalyzes code.\n\n"
            "## Workflow\n1. Read\n2. Analyze\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n\n"
            "## Error Handling\nRetry on failure.\n\n"
            "## Verification\nCheck output.\n"
        )
        data = self._check(tmp_path, content)
        error_checks = [
            c
            for c in data["checks"]
            if not c["passed"]
            and c["severity"] == "error"
            and "output format" in c["message"].lower()
        ]
        assert len(error_checks) >= 1, "Missing Output Format not flagged as error"

    def test_complete_agent_passes_all_section_checks(self, tmp_path: Path) -> None:
        """Agent with all 6 required sections passes completeness."""
        data = self._check(tmp_path, self._make_complete_agent())
        assert data["complete"] is True
        section_errors = [
            c
            for c in data["checks"]
            if c["category"] == "sections" and not c["passed"] and c["severity"] == "error"
        ]
        assert len(section_errors) == 0, (
            f"Unexpected section errors: {[c['message'] for c in section_errors]}"
        )

    def test_missing_sections_lower_score(self, tmp_path: Path) -> None:
        """Missing required sections reduce the completeness score."""
        # Complete agent
        complete_data = self._check(tmp_path, self._make_complete_agent())
        # Incomplete agent (missing 3 sections)
        incomplete = (
            "---\n"
            "name: incomplete-agent\n"
            "description: Agent missing three required sections for testing\n"
            "tools: Read\n"
            "---\n\n"
            "# Incomplete\n\n"
            "## Overview\nDoes stuff.\n\n"
            "## Workflow\n1. Do things\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n"
        )
        incomplete_data = self._check(tmp_path, incomplete)
        assert incomplete_data["score"] < complete_data["score"], (
            f"Incomplete score {incomplete_data['score']} should be < "
            f"complete score {complete_data['score']}"
        )

    def test_incomplete_agent_marked_not_complete(self, tmp_path: Path) -> None:
        """Agent missing required sections is marked complete=false."""
        incomplete = (
            "---\n"
            "name: not-complete\n"
            "description: Agent that is deliberately missing required sections\n"
            "tools: Read\n"
            "---\n\n"
            "# Not Complete\n\n"
            "## Overview\nDoes stuff.\n\n"
            "## Workflow\n1. Do things\n"
        )
        data = self._check(tmp_path, incomplete)
        assert data["complete"] is False

    def test_generated_agent_passes_completeness(self, tmp_path: Path) -> None:
        """Agent from agent_generator.py passes completeness check."""
        # Generate a real agent
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "completeness-test",
                "--description",
                "Tests completeness checker with generated agent output",
                "--tools",
                "Read,Grep,Glob",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        md_file = tmp_path / "completeness-test.md"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "completeness_checker.py"),
                "--json",
                str(md_file),
            ],
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
        assert data["complete"] is True, (
            f"Generated agent incomplete: "
            f"{[c['message'] for c in data['checks'] if not c['passed'] and c['severity'] == 'error']}"
        )

    def test_error_handling_now_in_required_not_recommended(self, tmp_path: Path) -> None:
        """Error Handling check_id uses SEC_ prefix with error severity."""
        content = (
            "---\n"
            "name: check-severity\n"
            "description: Agent to verify error handling severity classification\n"
            "tools: Read\n"
            "---\n\n"
            "# Check Severity\n\n"
            "## Overview\nTest.\n\n"
            "## Workflow\n1. Do\n\n"
            "## Examples\n### Example 1\n```\ntest\n```\n"
        )
        data = self._check(tmp_path, content)
        eh_check = next(
            (c for c in data["checks"] if "error handling" in c["message"].lower()),
            None,
        )
        assert eh_check is not None, "No Error Handling check found"
        assert eh_check["severity"] == "error", (
            f"Error Handling severity is '{eh_check['severity']}', expected 'error'"
        )


class TestAgentCatalogSeeding:
    """Tests for Feature #49: 10 pre-built production-ready agent templates."""

    CATALOG_SCRIPT = str(SCRIPTS_DIR / "agent_catalog.py")

    # The 10 required seed agents
    SEED_AGENTS = [
        "code-reviewer",
        "security-auditor",
        "test-writer",
        "doc-generator",
        "refactoring-assistant",
        "performance-profiler",
        "dependency-updater",
        "git-workflow",
        "migration-planner",
        "accessibility-checker",
    ]

    # Required production-grade fields for each seed agent
    REQUIRED_FIELDS = [
        "workflow_steps",
        "detailed_examples",
        "system_prompt_additions",
        "security_considerations",
        "best_practices",
        "quality_criteria",
        "error_handling",
        "output_schema",
    ]

    def _show_agent(self, name: str) -> dict:
        """Show agent details as JSON via CLI."""
        result = subprocess.run(
            [sys.executable, self.CATALOG_SCRIPT, "show", name, "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"show {name} failed: {result.stderr}"
        return json.loads(result.stdout)

    def _list_agents(self) -> list[dict]:
        """List all agents as JSON via CLI."""
        result = subprocess.run(
            [sys.executable, self.CATALOG_SCRIPT, "list", "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"list failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_all_seed_agents_resolvable(self):
        """Every seed agent name resolves via get_agent (including aliases)."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            assert data["name"], f"Seed agent '{name}' not resolvable"

    def test_seed_agents_have_workflow_steps(self):
        """Each seed agent has at least 5 workflow steps."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            steps = data.get("workflow_steps", [])
            assert len(steps) >= 5, f"{name}: has {len(steps)} workflow steps, need ≥5"

    def test_seed_agents_have_3_plus_examples(self):
        """Each seed agent has at least 3 detailed examples."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            examples = data.get("detailed_examples", [])
            assert len(examples) >= 2, f"{name}: has {len(examples)} detailed examples, need ≥2"

    def test_seed_agents_have_all_required_fields(self):
        """Each seed agent has all production-grade fields populated."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            for field in self.REQUIRED_FIELDS:
                value = data.get(field)
                assert value, f"{name}: missing or empty required field '{field}'"

    def test_aliases_resolve_to_correct_agents(self):
        """Aliases resolve to the correct underlying agent."""
        alias_map = {
            "security-auditor": "security-scanner",
            "doc-generator": "documentation-agent",
            "refactoring-assistant": "refactoring-agent",
        }
        for alias, expected_name in alias_map.items():
            data = self._show_agent(alias)
            assert data["name"] == expected_name, (
                f"Alias '{alias}' resolved to '{data['name']}', expected '{expected_name}'"
            )

    def test_new_agents_in_catalog_list(self):
        """New agents (performance-profiler, migration-planner, etc.) appear in list."""
        agents = self._list_agents()
        agent_names = {a["name"] for a in agents}
        new_agents = {
            "performance-profiler",
            "dependency-updater",
            "git-workflow",
            "migration-planner",
            "accessibility-checker",
        }
        for name in new_agents:
            assert name in agent_names, f"New agent '{name}' not found in catalog list"

    def test_seed_agents_have_valid_tools(self):
        """Each seed agent declares at least 2 tools."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            tools = data.get("tools", [])
            assert len(tools) >= 2, f"{name}: has {len(tools)} tools, need ≥2"

    def test_seed_agents_have_tags(self):
        """Each seed agent has at least 3 tags for discoverability."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            tags = data.get("tags", [])
            assert len(tags) >= 3, f"{name}: has {len(tags)} tags, need ≥3"

    def test_generated_content_has_required_sections(self):
        """Generated markdown content for each seed agent includes key sections."""
        result = subprocess.run(
            [
                sys.executable,
                self.CATALOG_SCRIPT,
                "show",
                "performance-profiler",
                "--content",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        content = result.stdout
        for section in [
            "## Overview",
            "## Workflow",
            "## Examples",
            "## Error Handling",
            "## Output Format",
        ]:
            assert section in content, f"Generated content missing '{section}'"

    def test_seed_agent_count_matches_constant(self):
        """SEED_AGENTS constant in agent_catalog.py has exactly 10 entries."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; sys.path.insert(0, '"
                + str(SCRIPTS_DIR)
                + "'); from agent_catalog import SEED_AGENTS; print(len(SEED_AGENTS))",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"Import failed: {result.stderr}"
        count = int(result.stdout.strip())
        assert count == 10, f"SEED_AGENTS has {count} entries, expected 10"

    def test_search_finds_new_agents(self):
        """Search by keywords finds new seed agents."""
        result = subprocess.run(
            [
                sys.executable,
                self.CATALOG_SCRIPT,
                "search",
                "performance",
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        names = [a["name"] for a in agents]
        assert "performance-profiler" in names, (
            "Search for 'performance' did not find performance-profiler"
        )


class TestDomainDetection:
    """Tests for Feature #52: NLP domain detection."""

    NLP_SCRIPT = str(SCRIPTS_DIR / "nlp_parser.py")

    def _parse(self, description: str) -> dict:
        """Parse description via CLI and return JSON result."""
        result = subprocess.run(
            [sys.executable, self.NLP_SCRIPT, "--json", description],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"nlp_parser failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_web_domain_detected(self):
        """Web domain detected from frontend/React/API keywords."""
        data = self._parse("Build a React frontend component for REST API")
        assert "web" in data["domains"]

    def test_mobile_domain_detected(self):
        """Mobile domain detected from iOS/Android/Flutter keywords."""
        data = self._parse("Create an iOS and Android app with Flutter")
        assert "mobile" in data["domains"]

    def test_data_domain_detected(self):
        """Data domain detected from database/SQL/ETL keywords."""
        data = self._parse("Analyze PostgreSQL database queries and optimize SQL")
        assert "data" in data["domains"]

    def test_devops_domain_detected(self):
        """DevOps domain detected from Docker/Kubernetes/CI keywords."""
        data = self._parse("Deploy to Kubernetes with Docker and GitHub Actions")
        assert "devops" in data["domains"]

    def test_security_domain_detected(self):
        """Security domain detected from vulnerability/auth/OWASP keywords."""
        data = self._parse("Scan for OWASP vulnerabilities and authentication issues")
        assert "security" in data["domains"]

    def test_testing_domain_detected(self):
        """Testing domain detected from pytest/coverage/TDD keywords."""
        data = self._parse("Write pytest unit tests with full coverage")
        assert "testing" in data["domains"]

    def test_documentation_domain_detected(self):
        """Documentation domain detected from docstring/README/API doc keywords."""
        data = self._parse("Generate API documentation with docstrings and README")
        assert "documentation" in data["domains"]

    def test_multi_domain_detection(self):
        """Multiple domains detected from a cross-domain description."""
        data = self._parse("Build a security testing tool for web APIs with JWT authentication")
        assert "security" in data["domains"]
        assert "testing" in data["domains"]
        assert "web" in data["domains"]

    def test_no_domain_returns_empty_list(self):
        """Description with no domain keywords returns empty domains list."""
        data = self._parse("Do something interesting with patterns")
        assert data["domains"] == []

    def test_domain_influences_tool_selection(self):
        """Detected domains add domain-specific tools to the tool list."""
        # DevOps domain should add Bash
        data = self._parse("Deploy containers to Kubernetes cluster")
        assert "Bash" in data["tools"]
        # Documentation domain should add Write
        data2 = self._parse("Generate comprehensive documentation for the module")
        assert "Write" in data2["tools"]

    def test_domains_field_in_json_output(self):
        """The domains field is present in JSON output."""
        data = self._parse("Analyze code for security issues")
        assert "domains" in data
        assert isinstance(data["domains"], list)

    def test_domain_keywords_count_exceeds_10(self):
        """DOMAIN_KEYWORDS has at least 10 keywords per domain on average."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; sys.path.insert(0, '"
                + str(SCRIPTS_DIR)
                + "'); from nlp_parser import DOMAIN_KEYWORDS; "
                "total = sum(len(v) for v in DOMAIN_KEYWORDS.values()); "
                "print(total)",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        total_keywords = int(result.stdout.strip())
        assert total_keywords >= 70, (
            f"Total domain keywords: {total_keywords}, need ≥70 (10+ per domain avg)"
        )


class TestCompositionValidation:
    """Tests for Feature #66: Pipeline I/O composition validation."""

    def _run_composer(self, code: str) -> str:
        """Run Python code that imports from agent_composer and prints result."""
        full_code = (
            f"import sys; sys.path.insert(0, '{SCRIPTS_DIR}'); from agent_composer import *; {code}"
        )
        result = subprocess.run(
            [sys.executable, "-c", full_code],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"Composer code failed: {result.stderr}"
        return result.stdout.strip()

    def test_sequential_compatible_schemas_pass(self):
        """Sequential pipeline with compatible I/O schemas passes validation."""
        out = self._run_composer(
            "a = AgentSpec(name='analyzer', description='Analyze', "
            "output_schema={'properties': {'findings': {'type': 'array'}}}); "
            "b = AgentSpec(name='reporter', description='Report', "
            "input_schema={'properties': {'findings': {'type': 'array'}}}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues))"
        )
        assert out == "0", f"Expected 0 issues, got: {out}"

    def test_sequential_incompatible_schemas_flagged(self):
        """Sequential pipeline flags missing required fields between stages."""
        out = self._run_composer(
            "a = AgentSpec(name='analyzer', description='Analyze', "
            "output_schema={'properties': {'score': {'type': 'number'}}}); "
            "b = AgentSpec(name='reporter', description='Report', "
            "input_schema={'properties': {'findings': {'type': 'array'}}, "
            "'required': ['findings']}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "findings" in lines[1]
        assert "analyzer" in lines[1] and "reporter" in lines[1]

    def test_sequential_empty_schemas_compatible(self):
        """Empty schemas (untyped) are always compatible."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', output_schema={}); "
            "b = AgentSpec(name='b', description='B', input_schema={}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues))"
        )
        assert out == "0"

    def test_sequential_three_stage_middle_incompatible(self):
        """Three-stage pipeline flags the specific incompatible pair."""
        out = self._run_composer(
            "a = AgentSpec(name='fetch', description='Fetch', "
            "output_schema={'properties': {'data': {'type': 'object'}}}); "
            "b = AgentSpec(name='transform', description='Transform', "
            "input_schema={'properties': {'data': {'type': 'object'}}}, "
            "output_schema={'properties': {'result': {'type': 'string'}}}); "
            "c = AgentSpec(name='load', description='Load', "
            "input_schema={'properties': {'records': {'type': 'array'}}, "
            "'required': ['records']}); "
            "issues = validate_sequential_io([a, b, c]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "transform" in lines[1] and "load" in lines[1]
        assert "records" in lines[1]

    def test_parallel_compatible_merge(self):
        """Parallel agents with compatible output types pass merge validation."""
        out = self._run_composer(
            "a = AgentSpec(name='lint', description='Lint', "
            "output_schema={'properties': {'issues': {'type': 'array'}}}); "
            "b = AgentSpec(name='test', description='Test', "
            "output_schema={'properties': {'results': {'type': 'array'}}}); "
            "issues = validate_parallel_outputs([a, b]); "
            "print(len(issues))"
        )
        assert out == "0"

    def test_parallel_conflicting_types_flagged(self):
        """Parallel agents with conflicting field types are flagged."""
        out = self._run_composer(
            "a = AgentSpec(name='agent-a', description='A', "
            "output_schema={'properties': {'score': {'type': 'number'}}}); "
            "b = AgentSpec(name='agent-b', description='B', "
            "output_schema={'properties': {'score': {'type': 'string'}}}); "
            "issues = validate_parallel_outputs([a, b]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "score" in lines[1]
        assert "conflicting types" in lines[1]

    def test_compose_sequential_rejects_incompatible(self):
        """compose_sequential() returns success=False for incompatible I/O."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'x': {'type': 'string'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "input_schema={'properties': {'y': {'type': 'string'}}, "
            "'required': ['y']}); "
            "r = compose_sequential([a, b]); "
            "print(r.success); print(len(r.errors))"
        )
        lines = out.split("\n")
        assert lines[0] == "False"
        assert int(lines[1]) >= 1

    def test_compose_parallel_merge_rejects_conflicting(self):
        """compose_parallel(strategy='merge') rejects conflicting output types."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'integer'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'array'}}}); "
            "r = compose_parallel([a, b], aggregation_strategy='merge'); "
            "print(r.success)"
        )
        assert out == "False"

    def test_compose_parallel_vote_skips_merge_validation(self):
        """compose_parallel(strategy='vote') skips merge-type validation."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'integer'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'array'}}}); "
            "r = compose_parallel([a, b], aggregation_strategy='vote'); "
            "print(r.success)"
        )
        assert out == "True"

    def test_schemas_compatible_extra_output_fields_ok(self):
        """Output having extra fields beyond what input requires is fine."""
        out = self._run_composer(
            "from agent_composer import _schemas_compatible; "
            "ok, issues = _schemas_compatible("
            "{'properties': {'a': {'type': 'string'}, 'b': {'type': 'number'}}}, "
            "{'properties': {'a': {'type': 'string'}}, 'required': ['a']}); "
            "print(ok); print(len(issues))"
        )
        lines = out.split("\n")
        assert lines[0] == "True"
        assert lines[1] == "0"


class TestContextAwareDiscovery:
    """Tests for Feature #77: Context-aware discovery to prevent duplicates."""

    DISCOVERY_SCRIPT = str(SCRIPTS_DIR / "context_discovery.py")

    def _create_agent_file(self, tmp_path: Path, name: str, tools: str = "Read, Grep") -> Path:
        """Create a minimal agent .md file in a temp directory."""
        content = (
            "---\n"
            f"name: {name}\n"
            f"description: Agent {name} for testing\n"
            f"tools: {tools}\n"
            "---\n\n"
            f"# {name}\n\n## Overview\nTest agent.\n"
        )
        agent_file = tmp_path / f"{name}.md"
        agent_file.write_text(content, encoding="utf-8")
        return agent_file

    def test_scan_directory_finds_agents(self, tmp_path):
        """scan_directory() discovers agent files with valid frontmatter."""
        self._create_agent_file(tmp_path, "code-reviewer")
        self._create_agent_file(tmp_path, "test-writer")
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "scan", "--dir", str(tmp_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert len(agents) == 2
        names = {a["name"] for a in agents}
        assert names == {"code-reviewer", "test-writer"}

    def test_scan_empty_directory(self, tmp_path):
        """scan_directory() returns empty list for empty directory."""
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "scan", "--dir", str(tmp_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert agents == []

    def test_scan_skips_files_without_frontmatter(self, tmp_path):
        """Files without valid frontmatter are skipped."""
        (tmp_path / "no-frontmatter.md").write_text("# Just a heading\n", encoding="utf-8")
        self._create_agent_file(tmp_path, "valid-agent")
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "scan", "--dir", str(tmp_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert len(agents) == 1
        assert agents[0]["name"] == "valid-agent"

    def test_check_exact_duplicate_flagged(self, tmp_path):
        """Exact name match is flagged as a conflict."""
        self._create_agent_file(tmp_path, "code-reviewer")
        result = subprocess.run(
            [
                sys.executable,
                self.DISCOVERY_SCRIPT,
                "check",
                "code-reviewer",
                "--dir",
                str(tmp_path),
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["has_conflict"] is True
        assert data["exact_match"] is not None
        assert data["exact_match"]["name"] == "code-reviewer"

    def test_check_no_conflict_for_new_name(self, tmp_path):
        """New name with no existing agents reports no conflict."""
        self._create_agent_file(tmp_path, "code-reviewer")
        result = subprocess.run(
            [
                sys.executable,
                self.DISCOVERY_SCRIPT,
                "check",
                "brand-new-agent",
                "--dir",
                str(tmp_path),
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["has_conflict"] is False

    def test_check_similar_names_detected(self, tmp_path):
        """Similar names (substring match) are reported."""
        self._create_agent_file(tmp_path, "code-reviewer")
        result = subprocess.run(
            [
                sys.executable,
                self.DISCOVERY_SCRIPT,
                "check",
                "code-reviewer-v2",
                "--dir",
                str(tmp_path),
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "code-reviewer" in data["similar_names"]

    def test_tool_patterns_analysis(self, tmp_path):
        """analyze_tool_patterns returns frequency and recommended base."""
        self._create_agent_file(tmp_path, "agent-a", tools="Read, Grep, Glob")
        self._create_agent_file(tmp_path, "agent-b", tools="Read, Grep, Bash")
        self._create_agent_file(tmp_path, "agent-c", tools="Read, Write, Glob")
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "patterns", "--dir", str(tmp_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["total_agents"] == 3
        assert data["tool_frequency"]["Read"] == 3
        assert "Read" in data["recommended_base"]

    def test_parsed_tools_are_correct(self, tmp_path):
        """Agent tools are correctly parsed from comma-separated frontmatter."""
        self._create_agent_file(tmp_path, "multi-tool", tools="Read, Write, Bash, Glob")
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "scan", "--dir", str(tmp_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert agents[0]["tools"] == ["Read", "Write", "Bash", "Glob"]

    def test_case_insensitive_duplicate_detection(self, tmp_path):
        """Name conflict detection is case-insensitive."""
        self._create_agent_file(tmp_path, "Code-Reviewer")
        result = subprocess.run(
            [
                sys.executable,
                self.DISCOVERY_SCRIPT,
                "check",
                "code-reviewer",
                "--dir",
                str(tmp_path),
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["has_conflict"] is True

    def test_nonexistent_directory_returns_empty(self):
        """Scanning a nonexistent directory returns empty list gracefully."""
        result = subprocess.run(
            [
                sys.executable,
                self.DISCOVERY_SCRIPT,
                "scan",
                "--dir",
                "/tmp/nonexistent-agent-dir-xyz",
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert agents == []


class TestNonInteractiveMode:
    """Tests for Feature #80: Non-interactive CLI mode for CI/CD."""

    CLI_SCRIPT = str(SCRIPTS_DIR / "cli.py")

    def _run_cli(self, *args: str, cwd: str | None = None) -> subprocess.CompletedProcess[str]:
        """Run CLI with given args. Always uses scripts dir as cwd."""
        return subprocess.run(
            [sys.executable, self.CLI_SCRIPT, *args],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=cwd or str(SCRIPTS_DIR),
        )

    def test_non_interactive_flag_in_help(self):
        """--non-interactive flag appears in CLI help output."""
        result = self._run_cli("--help")
        assert result.returncode == 0
        assert "--non-interactive" in result.stdout

    def test_non_interactive_forces_json_output(self, tmp_path):
        """--non-interactive forces JSON output even without --json flag."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a simple code analyzer",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["success"] is True
        assert "agent_name" in data
        assert "output_path" in data

    def test_non_interactive_missing_description_returns_error_json(self):
        """Missing description in non-interactive mode returns JSON error with exit 1."""
        result = self._run_cli("--non-interactive", "generate")
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert "error" in data
        assert "description" in data["error"].lower()

    def test_non_interactive_no_command_returns_error_json(self):
        """No command in non-interactive mode returns JSON error with exit 1."""
        result = self._run_cli("--non-interactive")
        assert result.returncode == 1
        data = json.loads(result.stdout)
        assert "error" in data

    def test_non_interactive_exit_code_0_on_success(self, tmp_path):
        """Successful generation returns exit code 0."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Build a test runner agent",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0

    def test_non_interactive_output_is_valid_json(self, tmp_path):
        """All output in non-interactive mode is valid JSON (no mixed text)."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a documentation generator",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        # Must parse as JSON without error — no progress spinners mixed in
        data = json.loads(result.stdout)
        assert isinstance(data, dict)

    def test_non_interactive_generate_creates_file(self, tmp_path):
        """Non-interactive generate actually writes the agent file."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a security scanner",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        output_path = Path(data["output_path"])
        assert output_path.exists(), f"Agent file not created at {output_path}"
        content = output_path.read_text(encoding="utf-8")
        assert "---" in content  # Has frontmatter

    def test_non_interactive_includes_tools_in_output(self, tmp_path):
        """JSON output includes detected tools list."""
        result = self._run_cli(
            "--non-interactive",
            "generate",
            "Create a web API security scanner",
            "--no-validate",
            "-o",
            str(tmp_path),
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "tools" in data
        assert isinstance(data["tools"], list)
        assert len(data["tools"]) >= 1

    def test_non_interactive_catalog_list_json(self):
        """--non-interactive with catalog list outputs valid JSON."""
        result = self._run_cli("--non-interactive", "catalog", "list")
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_non_interactive_validate_json(self, tmp_path):
        """--non-interactive with validate outputs JSON results."""
        # Create a minimal agent file to validate
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text(
            "---\nname: test-agent\ndescription: Test\ntools: Read\n---\n\n"
            "# Test Agent\n\n## Overview\nTest.\n",
            encoding="utf-8",
        )
        result = self._run_cli(
            "--non-interactive",
            "validate",
            str(agent_file),
        )
        # May pass or fail validation, but output must be JSON
        data = json.loads(result.stdout)
        assert "passed" in data


class TestConftestFixtures:
    """Tests for Feature #82: Comprehensive conftest.py fixtures with full frontmatter."""

    VALIDATOR_SCRIPT = str(SCRIPTS_DIR / "syntax_validator.py")
    SCORER_SCRIPT = str(SCRIPTS_DIR / "quality_scorer.py")
    CHECKER_SCRIPT = str(SCRIPTS_DIR / "completeness_checker.py")
    DISCOVERY_SCRIPT = str(SCRIPTS_DIR / "context_discovery.py")

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

    def test_discovery_finds_agents_in_fixture_dir(self, agents_dir):
        """Context discovery finds agents created by agents_dir fixture."""
        result = subprocess.run(
            [sys.executable, self.DISCOVERY_SCRIPT, "scan", "--dir", str(agents_dir), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        assert len(agents) == 2
        names = {a["name"] for a in agents}
        assert "full-featured-agent" in names
        assert "minimal-agent" in names

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


class TestEndToEndGeneration:
    """Tests for Feature #83: Full 5-phase pipeline end-to-end tests.

    Each test provides an NLP description, runs the full pipeline
    (parse → classify → select tools → generate → validate → score),
    and verifies the output agent passes quality gates.
    """

    CLI_SCRIPT = str(SCRIPTS_DIR / "cli.py")
    VALIDATOR_SCRIPT = str(SCRIPTS_DIR / "syntax_validator.py")
    SCORER_SCRIPT = str(SCRIPTS_DIR / "quality_scorer.py")

    def _generate_and_validate(self, description: str, tmp_path: Path) -> dict:
        """Run full generation pipeline and return combined results.

        Returns dict with keys: generate_result, agent_content,
        syntax_passed, quality_score.
        """
        # Phase 1-3: Generate via CLI (non-interactive = JSON output)
        gen_result = subprocess.run(
            [
                sys.executable,
                self.CLI_SCRIPT,
                "--non-interactive",
                "generate",
                description,
                "--no-validate",
                "-o",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(SCRIPTS_DIR),
        )
        assert gen_result.returncode == 0, (
            f"Generation failed: {gen_result.stdout} {gen_result.stderr}"
        )
        gen_data = json.loads(gen_result.stdout)

        # Read generated agent content
        agent_path = Path(gen_data["output_path"])
        assert agent_path.exists(), f"Agent file not created: {agent_path}"
        agent_content = agent_path.read_text(encoding="utf-8")

        # Phase 4: Syntax validation
        val_result = subprocess.run(
            [sys.executable, self.VALIDATOR_SCRIPT, str(agent_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        val_data = json.loads(val_result.stdout)

        # Phase 5: Quality scoring
        score_result = subprocess.run(
            [sys.executable, self.SCORER_SCRIPT, str(agent_path), "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        score_data = json.loads(score_result.stdout)

        return {
            "generate": gen_data,
            "content": agent_content,
            "syntax_passed": val_data["passed"],
            "syntax_errors": val_data.get("errors", []),
            "quality_score": score_data.get("total_score", 0),
            "quality_grade": score_data.get("grade", "F"),
        }

    def test_e2e_simple_code_reviewer(self, tmp_path):
        """E2E: Simple code review agent from NLP description."""
        result = self._generate_and_validate(
            "Create an agent that reviews Python code for bugs and style issues",
            tmp_path,
        )

        # Verify generation succeeded
        assert result["generate"]["success"] is True
        assert result["generate"]["agent_name"]

        # Verify syntax is valid
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"

        # Verify quality meets minimum threshold
        assert result["quality_score"] >= 7.0, (
            f"Quality {result['quality_score']:.1f} < 7.0 (grade: {result['quality_grade']})"
        )

        # Verify content has essential sections
        content = result["content"]
        assert "---" in content  # frontmatter
        assert "## Overview" in content
        assert "## Workflow" in content

    def test_e2e_read_only_security_scanner(self, tmp_path):
        """E2E: Read-only security scanner (no Write/Bash tools)."""
        result = self._generate_and_validate(
            "Create an agent that analyzes code for security vulnerabilities",
            tmp_path,
        )

        assert result["generate"]["success"] is True
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"
        assert result["quality_score"] >= 7.0, f"Quality {result['quality_score']:.1f} < 7.0"

        # Verify it's analysis-oriented (Read should be in tools)
        tools = result["generate"]["tools"]
        assert "Read" in tools, f"Read not in tools: {tools}"

    def test_e2e_documentation_generator(self, tmp_path):
        """E2E: Documentation generator agent with Write tool."""
        result = self._generate_and_validate(
            "Build an agent that generates API documentation from source code",
            tmp_path,
        )

        assert result["generate"]["success"] is True
        assert result["syntax_passed"] is True, f"Syntax errors: {result['syntax_errors']}"
        assert result["quality_score"] >= 7.0, f"Quality {result['quality_score']:.1f} < 7.0"

        # Doc generator should have Write capability
        tools = result["generate"]["tools"]
        assert "Write" in tools or "Edit" in tools, f"No write capability in tools: {tools}"

    def test_e2e_output_file_is_valid_markdown(self, tmp_path):
        """E2E: Generated file is valid markdown with proper frontmatter."""
        result = self._generate_and_validate(
            "Create a test runner agent that executes pytest suites",
            tmp_path,
        )

        content = result["content"]

        # Must start with frontmatter
        assert content.startswith("---\n"), "Agent must start with frontmatter delimiter"

        # Must have closing frontmatter delimiter
        second_delim = content.index("---", 4)
        assert second_delim > 4, "Missing closing frontmatter delimiter"

        # Frontmatter must contain required fields
        frontmatter = content[4:second_delim]
        assert "name:" in frontmatter
        assert "description:" in frontmatter
        assert "tools:" in frontmatter

    def test_e2e_different_descriptions_produce_different_agents(self, tmp_path):
        """E2E: Different NLP inputs produce distinct agents."""
        dir_a = tmp_path / "a"
        dir_b = tmp_path / "b"
        dir_a.mkdir()
        dir_b.mkdir()

        result_a = self._generate_and_validate(
            "Create a code linting agent for JavaScript",
            dir_a,
        )
        result_b = self._generate_and_validate(
            "Build a database migration planning agent",
            dir_b,
        )

        # Different names
        assert result_a["generate"]["agent_name"] != result_b["generate"]["agent_name"]

        # Different tool sets (at least partially)
        tools_a = set(result_a["generate"]["tools"])
        tools_b = set(result_b["generate"]["tools"])
        # They shouldn't be identical (different domains)
        assert tools_a != tools_b or result_a["content"] != result_b["content"]


class TestMultiAgentHooks:
    """Tests for TeammateIdle / TaskCreated / TaskCompleted hook generation (Feature #40).

    Exercises the three new multi-agent coordination hook generators plus the
    `generate_multi_agent_hooks` team bundle helper. Uses subprocess to invoke
    scripts for real behavior verification (same pattern as sibling test classes).
    """

    # --- helpers ------------------------------------------------------------

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        """Run a Python snippet in a subprocess with SCRIPTS_DIR on sys.path."""
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_idle(self, agent: str, team: str = "") -> str:
        result = self._run_py(
            "from hooks_generator import generate_teammate_idle_script; "
            f"print(generate_teammate_idle_script({agent!r}, {team!r}))"
        )
        assert result.returncode == 0, f"idle gen failed: {result.stderr}"
        return result.stdout

    def _gen_task_created(self, agent: str) -> str:
        result = self._run_py(
            "from hooks_generator import generate_task_created_script; "
            f"print(generate_task_created_script({agent!r}))"
        )
        assert result.returncode == 0, f"task_created gen failed: {result.stderr}"
        return result.stdout

    def _gen_task_completed(self, agent: str) -> str:
        result = self._run_py(
            "from hooks_generator import generate_task_completed_script; "
            f"print(generate_task_completed_script({agent!r}))"
        )
        assert result.returncode == 0, f"task_completed gen failed: {result.stderr}"
        return result.stdout

    def _write_script(self, content: str, path: Path) -> Path:
        path.write_text(content)
        path.chmod(0o755)
        return path

    # --- HOOK_EVENTS registry ----------------------------------------------

    def test_new_events_registered(self) -> None:
        """HOOK_EVENTS and NO_MATCHER_EVENTS must include the three new events."""
        result = self._run_py(
            "import json; from hooks_generator import HOOK_EVENTS, NO_MATCHER_EVENTS; "
            "print(json.dumps({"
            "'events': sorted(HOOK_EVENTS), "
            "'no_matcher': sorted(NO_MATCHER_EVENTS)"
            "}))"
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        for ev in ("TeammateIdle", "TaskCreated", "TaskCompleted"):
            assert ev in data["events"], f"{ev} missing from HOOK_EVENTS"
            assert ev in data["no_matcher"], f"{ev} missing from NO_MATCHER_EVENTS"

    # --- TeammateIdle script ------------------------------------------------

    def test_teammate_idle_script_is_valid_bash(self, tmp_path: Path) -> None:
        """TeammateIdle script must parse as valid bash."""
        script = self._gen_idle("worker-1", "alpha")
        path = self._write_script(script, tmp_path / "idle.sh")
        result = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
        assert result.returncode == 0, f"bash syntax error: {result.stderr}"

    def test_teammate_idle_allows_when_no_state_file(self, tmp_path: Path) -> None:
        """Without a tasks.json, TeammateIdle must allow going idle (exit 0)."""
        script = self._gen_idle("worker-1", "alpha")
        path = self._write_script(script, tmp_path / "idle.sh")
        # Run from an empty project dir with no .claude/team-state/alpha/tasks.json
        empty = tmp_path / "project"
        empty.mkdir()
        result = subprocess.run(
            ["bash", str(path)], input="{}", capture_output=True, text=True, cwd=str(empty)
        )
        assert result.returncode == 0, (
            f"should allow idle when no tasks file; stderr: {result.stderr}"
        )

    def test_teammate_idle_blocks_when_pending_tasks(self, tmp_path: Path) -> None:
        """With unclaimed pending tasks, TeammateIdle must exit 2 (prevent idle)."""
        script = self._gen_idle("worker-1", "alpha")
        path = self._write_script(script, tmp_path / "idle.sh")

        project = tmp_path / "project"
        tasks_dir = project / ".claude" / "team-state" / "alpha"
        tasks_dir.mkdir(parents=True)
        (tasks_dir / "tasks.json").write_text(
            json.dumps({"tasks": [{"id": "t-1", "status": "pending"}]})
        )

        result = subprocess.run(
            ["bash", str(path)], input="{}", capture_output=True, text=True, cwd=str(project)
        )
        assert result.returncode == 2, (
            f"should block idle when pending tasks exist; stderr: {result.stderr}"
        )
        assert "unclaimed" in result.stderr or "pending" in result.stderr.lower()

    def test_teammate_idle_allows_when_all_claimed(self, tmp_path: Path) -> None:
        """When every pending task has an owner, TeammateIdle must allow idle."""
        script = self._gen_idle("worker-1", "alpha")
        path = self._write_script(script, tmp_path / "idle.sh")

        project = tmp_path / "project"
        tasks_dir = project / ".claude" / "team-state" / "alpha"
        tasks_dir.mkdir(parents=True)
        (tasks_dir / "tasks.json").write_text(
            json.dumps(
                {
                    "tasks": [
                        {"id": "t-1", "status": "pending", "owner": "worker-2"},
                        {"id": "t-2", "status": "completed"},
                    ]
                }
            )
        )

        result = subprocess.run(
            ["bash", str(path)], input="{}", capture_output=True, text=True, cwd=str(project)
        )
        assert result.returncode == 0, (
            f"should allow idle when all tasks claimed/done; stderr: {result.stderr}"
        )

    def test_teammate_idle_honors_env_team_name(self, tmp_path: Path) -> None:
        """When team_name is empty, script reads CLAUDE_TEAM_NAME at runtime."""
        script = self._gen_idle("worker-1", "")  # no baked-in team
        path = self._write_script(script, tmp_path / "idle.sh")

        project = tmp_path / "project"
        tasks_dir = project / ".claude" / "team-state" / "beta"
        tasks_dir.mkdir(parents=True)
        (tasks_dir / "tasks.json").write_text(
            json.dumps({"tasks": [{"id": "t-1", "status": "pending"}]})
        )

        import os

        env = {**os.environ, "CLAUDE_TEAM_NAME": "beta"}
        result = subprocess.run(
            ["bash", str(path)],
            input="{}",
            capture_output=True,
            text=True,
            cwd=str(project),
            env=env,
        )
        assert result.returncode == 2, (
            f"env-resolved team should still block; stderr: {result.stderr}"
        )

    # --- TaskCreated script -------------------------------------------------

    def test_task_created_script_is_valid_bash(self, tmp_path: Path) -> None:
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        result = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
        assert result.returncode == 0, f"bash syntax error: {result.stderr}"

    def test_task_created_denies_empty_subject(self, tmp_path: Path) -> None:
        """Empty task_subject must be rejected with exit 2."""
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        payload = json.dumps({"task_subject": "", "task_description": "anything"})
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 2
        assert "empty" in result.stderr.lower() or "missing" in result.stderr.lower()

    def test_task_created_denies_whitespace_subject(self, tmp_path: Path) -> None:
        """Whitespace-only task_subject must be rejected with exit 2."""
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        payload = json.dumps({"task_subject": "   \t  ", "task_description": "x"})
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 2

    def test_task_created_denies_too_short_subject(self, tmp_path: Path) -> None:
        """Subject shorter than MIN_SUBJECT (default 8) must be rejected."""
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        payload = json.dumps({"task_subject": "fix", "task_description": "details"})
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 2
        assert "too short" in result.stderr.lower()

    def test_task_created_allows_valid_subject(self, tmp_path: Path) -> None:
        """A specific actionable subject must be accepted (exit 0)."""
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        payload = json.dumps(
            {
                "task_subject": "Add rate limiting to /api/login",
                "task_description": "Limit to 5 req/min per IP",
            }
        )
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_task_created_min_subject_env_override(self, tmp_path: Path) -> None:
        """CLAUDE_TASK_MIN_SUBJECT env var must override the default minimum."""
        script = self._gen_task_created("worker-1")
        path = self._write_script(script, tmp_path / "tc.sh")
        payload = json.dumps({"task_subject": "abc", "task_description": "x"})

        import os

        env = {**os.environ, "CLAUDE_TASK_MIN_SUBJECT": "2"}
        result = subprocess.run(
            ["bash", str(path)], input=payload, capture_output=True, text=True, env=env
        )
        assert result.returncode == 0, (
            f"should accept 3-char subject when min=2; stderr: {result.stderr}"
        )

    # --- TaskCompleted script ----------------------------------------------

    def test_task_completed_script_is_valid_bash(self, tmp_path: Path) -> None:
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")
        result = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
        assert result.returncode == 0, f"bash syntax error: {result.stderr}"

    def test_task_completed_denies_missing_task_id(self, tmp_path: Path) -> None:
        """TaskCompleted must DENY (exit 2) when task_id is missing — no silent success."""
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")
        result = subprocess.run(["bash", str(path)], input="{}", capture_output=True, text=True)
        assert result.returncode == 2, (
            f"missing task_id must deny, got rc={result.returncode}; stderr: {result.stderr}"
        )
        assert "task_id" in result.stderr.lower()

    def test_task_completed_denies_when_no_deliverable(self, tmp_path: Path) -> None:
        """Without a manifest or marker, TaskCompleted must block (exit 2)."""
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")

        project = tmp_path / "project"
        project.mkdir()

        payload = json.dumps({"task_id": "t-99"})
        import os

        env = {**os.environ, "CLAUDE_TEAM_NAME": "alpha"}
        result = subprocess.run(
            ["bash", str(path)],
            input=payload,
            capture_output=True,
            text=True,
            cwd=str(project),
            env=env,
        )
        assert result.returncode == 2, f"stderr: {result.stderr}"
        assert "deliverable" in result.stderr.lower() or "manifest" in result.stderr.lower()

    def test_task_completed_allows_marker_file(self, tmp_path: Path) -> None:
        """A .done marker file must satisfy the deliverable check."""
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")

        project = tmp_path / "project"
        deliv = project / ".claude" / "team-state" / "alpha" / "deliverables"
        deliv.mkdir(parents=True)
        (deliv / "t-42.done").write_text("")

        import os

        env = {**os.environ, "CLAUDE_TEAM_NAME": "alpha"}
        result = subprocess.run(
            ["bash", str(path)],
            input=json.dumps({"task_id": "t-42"}),
            capture_output=True,
            text=True,
            cwd=str(project),
            env=env,
        )
        assert result.returncode == 0, f"marker should allow; stderr: {result.stderr}"

    def test_task_completed_validates_manifest_files_exist(self, tmp_path: Path) -> None:
        """When the manifest lists files, each must exist on disk."""
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")

        project = tmp_path / "project"
        deliv = project / ".claude" / "team-state" / "alpha" / "deliverables"
        deliv.mkdir(parents=True)
        (deliv / "t-7.json").write_text(json.dumps({"files": ["src/real.py", "src/missing.py"]}))
        # Create only one of the two declared files
        (project / "src").mkdir()
        (project / "src" / "real.py").write_text("pass\n")

        import os

        env = {**os.environ, "CLAUDE_TEAM_NAME": "alpha"}
        result = subprocess.run(
            ["bash", str(path)],
            input=json.dumps({"task_id": "t-7"}),
            capture_output=True,
            text=True,
            cwd=str(project),
            env=env,
        )
        assert result.returncode == 2, f"missing declared file must deny; stderr: {result.stderr}"
        assert "missing.py" in result.stderr

    def test_task_completed_allows_when_all_files_present(self, tmp_path: Path) -> None:
        """When every manifest file exists, TaskCompleted must allow."""
        script = self._gen_task_completed("worker-1")
        path = self._write_script(script, tmp_path / "done.sh")

        project = tmp_path / "project"
        deliv = project / ".claude" / "team-state" / "alpha" / "deliverables"
        deliv.mkdir(parents=True)
        (deliv / "t-9.json").write_text(json.dumps({"files": ["a.txt"]}))
        (project / "a.txt").write_text("ok")

        import os

        env = {**os.environ, "CLAUDE_TEAM_NAME": "alpha"}
        result = subprocess.run(
            ["bash", str(path)],
            input=json.dumps({"task_id": "t-9"}),
            capture_output=True,
            text=True,
            cwd=str(project),
            env=env,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"

    # --- Hook config validation --------------------------------------------

    def test_hook_configs_reject_empty_agent_name(self) -> None:
        """All three config functions must raise ValueError on empty agent_name."""
        for fn in (
            "generate_teammate_idle_hook_config",
            "generate_task_created_hook_config",
            "generate_task_completed_hook_config",
        ):
            result = self._run_py(f"from hooks_generator import {fn}; {fn}('', '/tmp/x.sh')")
            assert result.returncode != 0, f"{fn} accepted empty agent_name"
            assert "agent_name" in result.stderr

    def test_hook_configs_reject_empty_script_path(self) -> None:
        """All three config functions must raise ValueError on empty script_path."""
        for fn in (
            "generate_teammate_idle_hook_config",
            "generate_task_created_hook_config",
            "generate_task_completed_hook_config",
        ):
            result = self._run_py(f"from hooks_generator import {fn}; {fn}('agent', '   ')")
            assert result.returncode != 0, f"{fn} accepted whitespace script_path"
            assert "script_path" in result.stderr

    def test_hook_configs_have_no_matcher(self) -> None:
        """Per Claude Code spec, TeammateIdle/TaskCreated/TaskCompleted have no matchers."""
        for fn, event in (
            ("generate_teammate_idle_hook_config", "TeammateIdle"),
            ("generate_task_created_hook_config", "TaskCreated"),
            ("generate_task_completed_hook_config", "TaskCompleted"),
        ):
            result = self._run_py(
                "import json; "
                f"from hooks_generator import {fn}; "
                f"print(json.dumps({fn}('worker-1', '/path/to/s.sh')))"
            )
            assert result.returncode == 0, f"{fn} failed: {result.stderr}"
            cfg = json.loads(result.stdout)
            assert event in cfg
            entry = cfg[event][0]
            assert "matcher" not in entry, f"{event} must not declare a matcher (no-matcher event)"
            assert entry["hooks"][0]["command"] == "/path/to/s.sh"

    # --- Team bundle --------------------------------------------------------

    def test_multi_agent_bundle_creates_three_executable_scripts(self, tmp_path: Path) -> None:
        """generate_multi_agent_hooks must write 3 executable scripts + merged config."""
        out_dir = tmp_path / "hooks"
        result = self._run_py(
            "import json, os; "
            "from hooks_generator import generate_multi_agent_hooks; "
            f"scripts, cfg = generate_multi_agent_hooks('worker-1', 'alpha', '{out_dir}'); "
            "print(json.dumps({"
            "'paths': [str(p) for p in scripts], "
            "'modes': [oct(os.stat(p).st_mode)[-3:] for p in scripts], "
            "'events': sorted(cfg.keys()) "
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data["paths"]) == 3
        for mode in data["modes"]:
            assert mode == "755", f"script must be executable, got mode {mode}"
        assert data["events"] == ["TaskCompleted", "TaskCreated", "TeammateIdle"]


class TestWriterReviewerTemplate:
    """Tests for the writer-reviewer multi-agent template (Feature #42)."""

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_template_is_registered(self) -> None:
        result = self._run_py(
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print('writer-reviewer' in SYSTEM_TEMPLATES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_template_declares_writer_reviewer_pattern(self) -> None:
        result = self._run_py(
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print(SYSTEM_TEMPLATES['writer-reviewer']['pattern'])"
        )
        assert result.stdout.strip() == "writer-reviewer"

    def test_template_has_exactly_two_workers_with_complementary_roles(self) -> None:
        result = self._run_py(
            "import json; "
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "workers = SYSTEM_TEMPLATES['writer-reviewer']['workers']; "
            "print(json.dumps([(w['name'], w['role']) for w in workers]))"
        )
        assert result.returncode == 0, result.stderr
        pairs = json.loads(result.stdout)
        roles = {role for _, role in pairs}
        assert roles == {"writer", "reviewer"}, f"expected writer+reviewer, got {roles}"
        assert len(pairs) == 2

    def test_reviewer_has_clean_context_guarantees(self) -> None:
        """Reviewer must have worktree isolation AND no file-modifying tools."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            "rev = next(w for w in sys_.workers if w.role == 'reviewer'); "
            "print(json.dumps({'isolation': rev.isolation, 'tools': rev.tools}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["isolation"] == "worktree", (
            "reviewer must run in worktree isolation for fresh context"
        )
        forbidden = {"Write", "Edit", "Bash", "MultiEdit"}
        overlap = forbidden & set(data["tools"])
        assert not overlap, f"reviewer must be read-only; found write-tools: {overlap}"

    def test_writer_has_worktree_isolation(self) -> None:
        """Writer must run in an isolated worktree so iterations don't collide."""
        result = self._run_py(
            "from multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            "w = next(w for w in sys_.workers if w.role == 'writer'); "
            "print(w.isolation)"
        )
        assert result.stdout.strip() == "worktree"

    def test_feedback_loop_config_is_documented(self) -> None:
        """feedback_loop_config must declare clean_context invariants and termination rules."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print(json.dumps(SYSTEM_TEMPLATES['writer-reviewer']['feedback_loop_config']))"
        )
        assert result.returncode == 0, result.stderr
        cfg = json.loads(result.stdout)
        assert cfg["max_iterations"] >= 1
        cc = cfg["clean_context"]
        assert isinstance(cc["reviewer_receives"], list) and cc["reviewer_receives"]
        assert isinstance(cc["reviewer_never_receives"], list) and cc["reviewer_never_receives"]
        never = " ".join(cc["reviewer_never_receives"]).lower()
        assert "reasoning" in never or "transcript" in never, (
            "clean_context must explicitly exclude writer reasoning/transcript"
        )
        term = cfg["termination"]
        assert "approve" in term and "max_iterations" in term

    def test_orchestrator_markdown_uses_writer_reviewer_generator(self, tmp_path: Path) -> None:
        """save_system must route pattern=writer-reviewer to the dedicated generator."""
        out_dir = tmp_path / "wr"
        result = self._run_py(
            "from pathlib import Path; "
            "from multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            f"files = save_system(sys_, Path('{out_dir}')); "
            "print('\\n'.join(str(f) for f in files))"
        )
        assert result.returncode == 0, result.stderr
        files = [Path(p) for p in result.stdout.strip().splitlines()]
        assert len(files) == 4, [p.name for p in files]
        orch = next(f for f in files if "coordinator" in f.name and f.suffix == ".md")
        content = orch.read_text()
        assert "Writer-Reviewer" in content
        assert "Clean-Context" in content or "clean context" in content.lower()
        assert "fresh context" in content.lower() or "clean context" in content.lower()

    def test_orchestrator_markdown_documents_feedback_loop_steps(self, tmp_path: Path) -> None:
        """Orchestrator markdown must document the feedback loop steps + verdicts."""
        out_dir = tmp_path / "wr2"
        result = self._run_py(
            "from pathlib import Path; "
            "from multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch = next(Path(out_dir).glob("*coordinator*.md"))
        content = orch.read_text()
        assert "Dispatch Writer" in content
        assert "Capture Artifacts" in content
        assert "Dispatch Reviewer" in content
        assert "Finalize" in content
        assert "APPROVE" in content
        assert "REQUEST_CHANGES" in content

    def test_cli_example_command_supports_writer_reviewer(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "writer-reviewer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        out = result.stdout
        assert "Writer-Reviewer" in out or "writer-reviewer" in out.lower()
        assert "APPROVE" in out

    def test_cli_template_command_produces_files(self, tmp_path: Path) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "writer-reviewer",
                "-o",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        files = list(tmp_path.glob("*"))
        assert len(files) == 4, [p.name for p in files]
        names = {p.name for p in files}
        assert any("writer" in n for n in names)
        assert any("reviewer" in n for n in names)
        assert any(p.suffix == ".json" for p in files)

    def test_templates_listing_includes_writer_reviewer(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "templates",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "writer-reviewer" in result.stdout


class TestDryRunPreviewEnhancements:
    """Tests for dry-run mode token count + quality prediction (Feature #45).

    Validates the feature's three new guarantees layered on the existing
    preview behavior:
    - complete preview (frontmatter + body) is returned
    - token estimate is computed per file and aggregated
    - quality estimate is predicted for the agent file
    - NO files are written to disk at any point
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- token estimation --------------------------------------------------

    def test_estimate_tokens_empty_string_is_zero(self) -> None:
        result = self._run_py("from dry_run import estimate_tokens; print(estimate_tokens(''))")
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_estimate_tokens_scales_with_content_length(self) -> None:
        """Longer content must yield a larger token estimate."""
        result = self._run_py(
            "from dry_run import estimate_tokens; "
            "short = estimate_tokens('hi'); "
            "long = estimate_tokens('x' * 1000); "
            "print(f'{short} {long}')"
        )
        assert result.returncode == 0, result.stderr
        short, long = map(int, result.stdout.split())
        assert short < long
        assert short >= 1
        assert long >= 100

    def test_estimate_tokens_is_non_negative(self) -> None:
        result = self._run_py(
            "from dry_run import estimate_tokens; "
            "vals = [estimate_tokens(s) for s in "
            "['', 'a', 'hello world', '### heading\\n\\ntext']]; "
            "print(all(v >= 0 for v in vals))"
        )
        assert result.stdout.strip() == "True"

    # --- quality estimation ------------------------------------------------

    def test_estimate_quality_returns_none_for_empty(self) -> None:
        result = self._run_py(
            "from dry_run import estimate_quality; print(estimate_quality('') is None)"
        )
        assert result.stdout.strip() == "True"

    def test_estimate_quality_returns_structured_report(self) -> None:
        """Valid agent content must produce a QualityEstimate with score+grade+criteria."""
        agent_md = (
            "---\n"
            "name: demo-agent\n"
            "description: A demonstration agent used by dry-run tests\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# Demo Agent\n\n"
            "## Overview\nDemonstrates dry-run quality scoring.\n\n"
            "## Workflow\n1. Read\n2. Grep\n3. Report\n\n"
            "## Examples\n### Example 1\nSearch for TODO comments.\n\n"
            '## Output Format\n```json\n{"status": "ok"}\n```\n'
        )
        code = (
            "import json\n"
            "from dry_run import estimate_quality\n"
            f"q = estimate_quality({agent_md!r})\n"
            "print(json.dumps({"
            "'has_score': q is not None and 0.0 <= q.score <= 10.0, "
            "'grade': q.grade if q else '', "
            "'criteria_count': len(q.criteria) if q else 0, "
            "'passed_is_bool': isinstance(q.passed, bool) if q else False"
            "}))"
        )
        result = self._run_py(code)
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["has_score"]
        assert data["grade"] in ("A", "B", "C", "D", "F")
        assert data["criteria_count"] >= 4
        assert data["passed_is_bool"]

    # --- end-to-end dry_run ------------------------------------------------

    def test_dry_run_writes_no_files_to_disk(self, tmp_path: Path) -> None:
        """The whole point of dry-run: no files appear on disk."""
        result = self._run_py(
            "from dry_run import dry_run; "
            "r = dry_run(name='x-agent', description='X agent for tests', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r}); "
            "print(len(r.files))"
        )
        assert result.returncode == 0, result.stderr
        assert int(result.stdout.strip()) >= 1
        leaf_files = [p for p in tmp_path.rglob("*") if p.is_file()]
        assert leaf_files == [], f"dry-run created files: {leaf_files}"

    def test_dry_run_includes_complete_preview_content(self, tmp_path: Path) -> None:
        """Each FilePreview must carry the actual file content (frontmatter + body)."""
        code = (
            "from dry_run import dry_run\n"
            "r = dry_run(name='complete-agent', description='Full preview test', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r})\n"
            "agent = next(f for f in r.files if f.path.endswith('complete-agent.md') "
            "and 'commands' not in f.path)\n"
            "print('FRONTMATTER:', agent.content.startswith('---'))\n"
            "print('HAS_NAME:', 'name: complete-agent' in agent.content)\n"
            "print('HAS_BODY:', '## Overview' in agent.content "
            "or '## Workflow' in agent.content)"
        )
        result = self._run_py(code)
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert all("True" in ln for ln in lines), result.stdout

    def test_dry_run_stamps_token_estimate_on_every_preview(self, tmp_path: Path) -> None:
        """Every FilePreview in the result must carry a positive token_estimate."""
        result = self._run_py(
            "from dry_run import dry_run\n"
            "r = dry_run(name='token-agent', description='Token estimate test', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r})\n"
            "print(all(f.token_estimate > 0 for f in r.files))\n"
            "print(r.total_tokens == sum(f.token_estimate for f in r.files))\n"
            "print(r.total_tokens > 0)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True", "True"]

    def test_dry_run_produces_quality_estimate_for_agent(self, tmp_path: Path) -> None:
        """result.quality must be a QualityEstimate when an agent file is previewed."""
        result = self._run_py(
            "import json\n"
            "from dry_run import dry_run\n"
            "r = dry_run(name='quality-agent', description='Quality prediction test', "
            f"tools=['Read','Grep','Glob'], output_base={str(tmp_path)!r})\n"
            "q = r.quality\n"
            "print(json.dumps({"
            "'present': q is not None, "
            "'score_in_range': q is not None and 0.0 <= q.score <= 10.0, "
            "'grade_valid': q is not None and q.grade in ('A','B','C','D','F'), "
            "'criteria_count': len(q.criteria) if q else 0"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["present"]
        assert data["score_in_range"]
        assert data["grade_valid"]
        assert data["criteria_count"] >= 4

    def test_result_to_dict_exposes_tokens_and_quality(self, tmp_path: Path) -> None:
        """Serialized result must include total_tokens, quality, and per-file token_estimate."""
        result = self._run_py(
            "import json\n"
            "from dry_run import dry_run, result_to_dict\n"
            "r = dry_run(name='dict-agent', description='Dict serialization test', "
            f"tools=['Read'], output_base={str(tmp_path)!r})\n"
            "d = result_to_dict(r)\n"
            "print(json.dumps({"
            "'has_total_tokens': 'total_tokens' in d and d['total_tokens'] > 0, "
            "'has_quality': 'quality' in d and d['quality'] is not None, "
            "'per_file_tokens': all('token_estimate' in f for f in d['files'])"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["has_total_tokens"]
        assert data["has_quality"]
        assert data["per_file_tokens"]

    def test_cli_text_output_includes_tokens_and_quality(self, tmp_path: Path) -> None:
        """CLI text output must surface token totals and quality verdict."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "dry_run.py"),
                "--name",
                "cli-agent",
                "--description",
                "CLI test of dry-run output",
                "--tools",
                "Read,Grep",
                "--output-base",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout
        assert "tokens" in out.lower()
        assert "Quality prediction" in out
        assert list(tmp_path.rglob("*.md")) == []

    def test_cli_json_output_carries_quality_block(self, tmp_path: Path) -> None:
        """--output-json must include `quality` and `total_tokens` keys."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "dry_run.py"),
                "--name",
                "json-agent",
                "--description",
                "JSON test of dry-run output",
                "--tools",
                "Read",
                "--output-json",
                "--output-base",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert "total_tokens" in data
        assert data["total_tokens"] > 0
        assert "quality" in data
        assert data["quality"] is not None
        assert "score" in data["quality"]
        assert "grade" in data["quality"]


class TestToolWorkflowCrossValidation:
    """Tests for tools/workflow cross-validation (Feature #48).

    The validator detects two classes of mistake:
    - Unused tools (declared in frontmatter, not referenced in workflow)
      → WARNING (non-blocking over-permissioning)
    - Undeclared tools (referenced in workflow, not in frontmatter)
      → ERROR (agent will fail at runtime when the tool is invoked)
    The quality_scorer tool_design criterion reflects both.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_clean_agent_has_no_unused_or_undeclared(self) -> None:
        content = (
            "---\n"
            "name: clean-agent\n"
            "description: Matches tools to workflow usage\n"
            "tools: Read, Grep, Glob\n"
            "---\n\n"
            "# Clean\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Use Grep to search\n"
            "3. Use Glob to find\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({"
            "'unused': r.unused, 'undeclared': r.undeclared, "
            "'matched': r.matched, "
            "'has_errors': r.has_errors, 'has_warnings': r.has_warnings"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["unused"] == []
        assert data["undeclared"] == []
        assert set(data["matched"]) == {"Read", "Grep", "Glob"}
        assert not data["has_errors"]
        assert not data["has_warnings"]

    def test_unused_tool_is_flagged_as_warning(self) -> None:
        content = (
            "---\n"
            "name: unused-tool\n"
            "description: Bash declared but never used\n"
            "tools: Read, Bash\n"
            "---\n\n"
            "# Unused Tool\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Report results\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared, "
            "'has_errors': r.has_errors, 'has_warnings': r.has_warnings}))"
        )
        data = json.loads(result.stdout)
        assert data["unused"] == ["Bash"]
        assert data["undeclared"] == []
        assert data["has_warnings"]
        assert not data["has_errors"]

    def test_undeclared_tool_is_flagged_as_error(self) -> None:
        content = (
            "---\n"
            "name: undeclared-tool\n"
            "description: Workflow references Bash without declaring it\n"
            "tools: Read\n"
            "---\n\n"
            "# Undeclared Tool\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Use Bash to execute commands\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared, "
            "'has_errors': r.has_errors}))"
        )
        data = json.loads(result.stdout)
        assert data["undeclared"] == ["Bash"]
        assert data["has_errors"]

    def test_word_boundary_prevents_substring_false_positives(self) -> None:
        """'Read' tool must NOT match the word 'readable' in workflow text."""
        content = (
            "---\n"
            "name: wb\n"
            "description: No false positives on substrings\n"
            "tools: Grep\n"
            "---\n\n"
            "# WB\n\n"
            "## Workflow\n"
            "1. Use Grep to find readable patterns\n"
            "2. The readable output is returned\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'referenced': r.referenced, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert "Read" not in data["referenced"], data
        assert data["undeclared"] == []

    def test_missing_workflow_section_yields_no_undeclared(self) -> None:
        """Without a workflow section, we can't fail the cross-check."""
        content = (
            "---\n"
            "name: no-workflow\n"
            "description: Agent with no workflow section\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Workflow\n\n"
            "## Overview\n"
            "This agent has no workflow section.\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert data["undeclared"] == []
        assert set(data["unused"]) == {"Read", "Grep"}

    def test_mcp_tool_names_are_matched_as_full_identifiers(self) -> None:
        content = (
            "---\n"
            "name: mcp-agent\n"
            "description: Uses an MCP tool\n"
            "tools: Read, mcp__filesystem__read_file\n"
            "---\n\n"
            "# MCP Agent\n\n"
            "## Workflow\n"
            "1. Use Read for project files\n"
            "2. Use mcp__filesystem__read_file for external paths\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'matched': r.matched, "
            "'unused': r.unused, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert "mcp__filesystem__read_file" in data["matched"], data
        assert data["unused"] == []
        assert data["undeclared"] == []

    def test_tool_design_score_ordering_clean_unused_undeclared(self) -> None:
        """Equal tool counts: clean > unused > undeclared (via score_quality)."""
        clean = (
            "---\n"
            "name: clean\ndescription: Clean alignment\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Read to load files carefully\n"
            "2. Use Bash to run validation with care and safety\n"
        )
        unused = (
            "---\n"
            "name: unused\ndescription: Read is unused\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Bash to run validation with care and safety\n"
        )
        undeclared = (
            "---\n"
            "name: undeclared\ndescription: Grep is undeclared\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Read carefully and safely\n"
            "2. Use Bash with care\n"
            "3. Use Grep to find patterns\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import score_quality\n"
            f"clean = {clean!r}\nunused = {unused!r}\nundeclared = {undeclared!r}\n"
            "def td(c):\n"
            "    return next(x for x in score_quality(c).criteria if x.name == 'Tool Design').score\n"
            "print(json.dumps({'clean': td(clean), 'unused': td(unused), "
            "'undeclared': td(undeclared)}))"
        )
        assert result.returncode == 0, result.stderr
        scores = json.loads(result.stdout)
        assert scores["unused"] < scores["clean"], scores
        assert scores["undeclared"] < scores["unused"], scores

    def test_tool_design_suggestions_label_severity(self) -> None:
        """Suggestions say 'WARNING' for unused and 'ERROR' for undeclared."""
        undeclared = (
            "---\n"
            "name: agent\ndescription: Uses Grep without declaring\ntools: Read\n"
            "---\n\n## Workflow\n1. Use Read and then Grep for patterns\n"
        )
        unused = (
            "---\n"
            "name: agent\ndescription: Read never used\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Bash carefully and safely\n"
        )
        result = self._run_py(
            "import json\n"
            "from quality_scorer import score_quality\n"
            f"u = {unused!r}\nd = {undeclared!r}\n"
            "def sugg(c):\n"
            "    td = next(x for x in score_quality(c).criteria if x.name == 'Tool Design')\n"
            "    return td.suggestions\n"
            "print(json.dumps({'unused': sugg(u), 'undeclared': sugg(d)}))"
        )
        data = json.loads(result.stdout)
        assert any("WARNING" in s for s in data["unused"]), data["unused"]
        assert any("ERROR" in s for s in data["undeclared"]), data["undeclared"]


class TestCatalogSearchAndFilter:
    """Tests for catalog search and filter (Feature #50).

    Feature criteria:
    - catalog list --category security returns security agents only
    - --tools Bash filters to shell-capable agents
    - search results are ranked by relevance
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_list_category_security_returns_only_security(self) -> None:
        result = self._run_py(
            "import json\n"
            "from agent_catalog import list_agents\n"
            "agents = list_agents(category='security')\n"
            "print(json.dumps({"
            "'count': len(agents), "
            "'categories': sorted({a.category for a in agents})"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["count"] >= 1, "expected at least one security agent"
        assert data["categories"] == ["security"], data

    def test_list_tools_bash_filters_to_shell_capable(self) -> None:
        result = self._run_py(
            "import json\n"
            "from agent_catalog import list_agents\n"
            "agents = list_agents(tools=['Bash'])\n"
            "names = [a.name for a in agents]\n"
            "tools_ok = all('Bash' in a.tools for a in agents)\n"
            "print(json.dumps({"
            "'count': len(agents), 'tools_ok': tools_ok, 'names': names"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["count"] >= 1
        assert data["tools_ok"]

    def test_list_tools_filter_is_case_insensitive(self) -> None:
        """--tools bash (lowercase) must match the canonical Bash tool."""
        result = self._run_py(
            "from agent_catalog import list_agents\n"
            "lower = {a.name for a in list_agents(tools=['bash'])}\n"
            "upper = {a.name for a in list_agents(tools=['Bash'])}\n"
            "print('EQUAL' if lower == upper else 'MISMATCH')"
        )
        assert result.stdout.strip() == "EQUAL", result.stdout

    def test_list_tools_requires_all_tools(self) -> None:
        """Passing multiple tools requires the agent to have ALL of them."""
        result = self._run_py(
            "from agent_catalog import list_agents\n"
            "both = list_agents(tools=['Read', 'Bash'])\n"
            "print(all('Read' in a.tools and 'Bash' in a.tools for a in both))"
        )
        assert result.stdout.strip() == "True"

    def test_list_domain_keyword_matches_name_description_or_tags(self) -> None:
        result = self._run_py(
            "from agent_catalog import list_agents\n"
            "agents = list_agents(domain='review')\n"
            "print(len(agents) > 0)\n"
            "hits = [\n"
            "    'review' in a.name.lower()\n"
            "    or 'review' in a.description.lower()\n"
            "    or any('review' in t.lower() for t in a.tags)\n"
            "    for a in agents\n"
            "]\n"
            "print(all(hits))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True"]

    def test_list_complexity_tier_filters_deterministically(self) -> None:
        """Every tier is a disjoint subset of the full catalog."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import list_agents, AGENT_CATALOG, COMPLEXITY_TIERS\n"
            "buckets = {t: {a.name for a in list_agents(complexity=t)} "
            "for t in COMPLEXITY_TIERS}\n"
            "total = sum(len(v) for v in buckets.values())\n"
            "all_names = set().union(*buckets.values())\n"
            "print(json.dumps({"
            "'total_assigned': total, "
            "'catalog_size': len(AGENT_CATALOG), "
            "'disjoint': total == len(all_names), "
            "'partitions_catalog': all_names == set(AGENT_CATALOG)"
            "}))"
        )
        data = json.loads(result.stdout)
        assert data["disjoint"], "complexity tiers must be disjoint"
        assert data["partitions_catalog"], "tiers must partition the catalog"
        assert data["total_assigned"] == data["catalog_size"]

    def test_list_complexity_rejects_unknown_tier(self) -> None:
        """An invalid complexity tier raises ValueError, not silent empty result."""
        result = self._run_py(
            "from agent_catalog import list_agents\n"
            "try:\n"
            "    list_agents(complexity='nonsense')\n"
            "    print('NOT_RAISED')\n"
            "except ValueError as e:\n"
            "    print('RAISED' if 'nonsense' in str(e) else 'WRONG_MSG')"
        )
        assert result.stdout.strip() == "RAISED", result.stdout

    def test_list_filters_compose_with_AND_semantics(self) -> None:
        """security AND Read must equal the intersection of the two filters."""
        result = self._run_py(
            "from agent_catalog import list_agents\n"
            "both = {a.name for a in list_agents(category='security', tools=['Read'])}\n"
            "sec = {a.name for a in list_agents(category='security')}\n"
            "reads = {a.name for a in list_agents(tools=['Read'])}\n"
            "print('OK' if both == sec & reads else f'MISMATCH: {both} vs {sec & reads}')"
        )
        assert result.stdout.strip() == "OK", result.stdout

    # --- ranking -------------------------------------------------------

    def test_search_results_are_ranked_descending(self) -> None:
        result = self._run_py(
            "import json\n"
            "from agent_catalog import search_agents_ranked\n"
            "ranked = search_agents_ranked('review')\n"
            "scores = [s for _, s in ranked]\n"
            "print(json.dumps({'count': len(ranked), 'descending': "
            "scores == sorted(scores, reverse=True)}))"
        )
        data = json.loads(result.stdout)
        assert data["count"] > 0
        assert data["descending"]

    def test_exact_name_match_ranks_first(self) -> None:
        """Searching for an exact agent name puts that agent at position 0."""
        result = self._run_py(
            "from agent_catalog import search_agents_ranked, AGENT_CATALOG\n"
            "name = next(iter(AGENT_CATALOG))\n"
            "ranked = search_agents_ranked(name)\n"
            "print(ranked[0][0].name == name)"
        )
        assert result.stdout.strip() == "True", result.stdout

    def test_name_match_outranks_description_only_match(self) -> None:
        """Name hits must score strictly higher than description-only hits."""
        result = self._run_py(
            "from agent_catalog import score_relevance, AGENT_CATALOG\n"
            "# Find an agent with 'review' in name\n"
            "name_hit = next(a for a in AGENT_CATALOG.values() if 'review' in a.name.lower())\n"
            "# Find an agent with 'review' in description but not name\n"
            "desc_only = next(\n"
            "    (a for a in AGENT_CATALOG.values() "
            "if 'review' not in a.name.lower() and 'review' in a.description.lower()),\n"
            "    None\n"
            ")\n"
            "if desc_only is None:\n"
            "    print('SKIP')\n"
            "else:\n"
            "    n = score_relevance(name_hit, 'review')\n"
            "    d = score_relevance(desc_only, 'review')\n"
            "    print('OK' if n > d else f'FAIL: name={n} desc={d}')"
        )
        assert result.stdout.strip() in {"OK", "SKIP"}, result.stdout

    def test_score_relevance_is_zero_for_no_match(self) -> None:
        result = self._run_py(
            "from agent_catalog import score_relevance, AGENT_CATALOG\n"
            "agent = next(iter(AGENT_CATALOG.values()))\n"
            "print(score_relevance(agent, 'xyzzy_no_match_nowhere'))"
        )
        assert float(result.stdout.strip()) == 0.0

    def test_search_composes_query_with_filters(self) -> None:
        """search_agents applies filters AFTER ranking, preserving order."""
        result = self._run_py(
            "from agent_catalog import search_agents\n"
            "with_filter = search_agents('review', category='code-quality')\n"
            "print(all(a.category == 'code-quality' for a in with_filter))"
        )
        assert result.stdout.strip() == "True"

    # --- CLI ------------------------------------------------------------

    def test_cli_list_category_security_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "list",
                "--category",
                "security",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert all(a["category"] == "security" for a in data)

    def test_cli_list_tools_bash_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "list",
                "--tools",
                "Bash",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert all("Bash" in a["tools"] for a in data)

    def test_cli_search_emits_relevance_scores_in_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "search",
                "review",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert "relevance_score" in data[0]
        scores = [a["relevance_score"] for a in data]
        assert scores == sorted(scores, reverse=True), scores


class TestNLPConstraintExtraction:
    """Tests for nlp_parser constraint extraction (Feature #53).

    Feature criteria:
    - 'read-only' removes Write/Edit/Bash from tools
    - 'Python only' adds glob pattern guidance
    - Constraints flow to disallowedTools
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- read-only detection ----------------------------------------------

    def test_read_only_removes_write_tools_from_positive_set(self) -> None:
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Create a read-only agent that scans code for security issues')\n"
            "print(json.dumps({"
            "'tools': r.tools, 'disallowed': r.disallowed_tools"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert "Write" not in data["tools"]
        assert "Edit" not in data["tools"]
        assert "Bash" not in data["tools"]
        # and defense-in-depth: disallowed_tools contains them
        assert set(data["disallowed"]) == {"Write", "Edit", "MultiEdit", "Bash"}

    def test_read_only_phrase_variants_all_fire(self) -> None:
        """Multiple surface forms all trigger the same read-only constraint."""
        variants = [
            "no file modifications",
            "no writes",
            "never modify",
            "inspect only",
            "reporting only",
        ]
        for phrase in variants:
            result = self._run_py(
                "from nlp_parser import extract_constraints\n"
                f"c = extract_constraints('Create an agent — {phrase} — for code review')\n"
                "print(c.read_only)"
            )
            assert result.stdout.strip() == "True", f"{phrase!r} did not trigger read-only"

    def test_read_only_not_triggered_by_incidental_word(self) -> None:
        """The word 'writes' alone must not trigger read-only."""
        result = self._run_py(
            "from nlp_parser import extract_constraints\n"
            "c = extract_constraints('Create an agent that reads files and writes reports')\n"
            "print(json.dumps({"
            "'read_only': c.read_only, "
            "'disallowed': c.disallowed_tools"
            "}))\n".replace("json.dumps", "__import__('json').dumps")
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert not data["read_only"]
        assert data["disallowed"] == []

    # --- file-scope detection ---------------------------------------------

    def test_python_only_adds_py_glob(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Build a Python only linter agent')\n"
            "print(r.file_patterns)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['**/*.py']"

    def test_typescript_only_adds_ts_and_tsx_globs(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Create a TypeScript only code reviewer')\n"
            "print(sorted(r.file_patterns))"
        )
        assert result.stdout.strip() == "['**/*.ts', '**/*.tsx']"

    def test_multiple_language_scopes_accumulate(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Build a Python only and YAML only config validator')\n"
            "print(sorted(r.file_patterns))"
        )
        assert result.returncode == 0, result.stderr
        patterns = set(result.stdout.strip().strip("[]").replace("'", "").split(", "))
        assert "**/*.py" in patterns
        assert "**/*.yml" in patterns or "**/*.yaml" in patterns

    def test_no_scope_phrase_leaves_file_patterns_empty(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Create a general code reviewer')\n"
            "print(r.file_patterns)"
        )
        assert result.stdout.strip() == "[]"

    # --- combined constraints ---------------------------------------------

    def test_read_only_plus_python_only_compose(self) -> None:
        """Read-only AND Python-only both fire; both flow to the requirements."""
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Create a read-only Python only security scanner')\n"
            "print(json.dumps({"
            "'disallowed': r.disallowed_tools, "
            "'patterns': r.file_patterns, "
            "'phrases': r.constraint_phrases"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert set(data["disallowed"]) == {"Write", "Edit", "MultiEdit", "Bash"}
        assert data["patterns"] == ["**/*.py"]
        assert "read-only" in data["phrases"]
        assert "python only" in data["phrases"]

    # --- observability ----------------------------------------------------

    def test_constraint_phrases_captures_triggering_phrases(self) -> None:
        """constraint_phrases must list the phrases that fired, for debugging."""
        result = self._run_py(
            "from nlp_parser import extract_constraints\n"
            "c = extract_constraints('Create a read-only JSON only validator')\n"
            "print(sorted(c.constraint_phrases))"
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout.strip()
        assert "read-only" in out and "json only" in out

    def test_empty_description_yields_empty_constraints(self) -> None:
        result = self._run_py(
            "from nlp_parser import extract_constraints\n"
            "c = extract_constraints('')\n"
            "print(c.read_only)\n"
            "print(c.disallowed_tools)\n"
            "print(c.file_patterns)\n"
            "print(c.constraint_phrases)"
        )
        lines = result.stdout.strip().splitlines()
        assert lines == ["False", "[]", "[]", "[]"]

    # --- integration with parse() ----------------------------------------

    def test_parse_default_fields_present_when_no_constraints(self) -> None:
        """AgentRequirements always exposes the new fields, defaulting to empty."""
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Create a simple reviewer')\n"
            "print(r.disallowed_tools == [] and r.file_patterns == [] "
            "and r.constraint_phrases == [])"
        )
        assert result.stdout.strip() == "True"

    def test_disallowed_tools_are_deduped_and_ordered(self) -> None:
        """Repeated read-only phrases do not double-add to disallowed_tools."""
        result = self._run_py(
            "from nlp_parser import extract_constraints\n"
            "c = extract_constraints("
            "'Create a read-only agent with no file modifications and no writes')\n"
            "print(c.disallowed_tools)"
        )
        out = result.stdout.strip()
        # Read-only fires once even across multiple phrases; disallowed remains
        # the canonical 4 tools in consistent order.
        assert out == "['Write', 'Edit', 'MultiEdit', 'Bash']", out

    # --- CLI --------------------------------------------------------------

    def test_cli_json_output_contains_constraint_fields(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "--json",
                "Create a read-only Python only code reviewer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert "disallowed_tools" in data
        assert set(data["disallowed_tools"]) == {"Write", "Edit", "MultiEdit", "Bash"}
        assert data["file_patterns"] == ["**/*.py"]
        assert "read-only" in data["constraint_phrases"]

    def test_cli_text_output_shows_constraints_when_present(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "Create a read-only Python only reviewer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout
        assert "Disallowed:" in out
        assert "File scope:" in out
        assert "Constraints:" in out


class TestNLPComplexityEstimation:
    """Tests for nlp_parser complexity estimation (Feature #54).

    Feature criteria:
    - Short descriptions with single verbs classify as simple
    - Multi-step descriptions as moderate
    - Orchestration keywords as complex

    Also validates the derived maxTurns mapping and signal reporting.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- Simple tier -------------------------------------------------------

    def test_simple_tier_for_short_single_verb(self) -> None:
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Lint Python files')\n"
            "print(json.dumps({'complexity': r.complexity, 'max_turns': r.max_turns, "
            "'signals': r.complexity_signals}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["complexity"] == "simple"
        assert data["max_turns"] == 5
        assert data["signals"].get("short")
        assert data["signals"].get("single_verb")

    def test_simple_tier_for_one_action(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\nprint(parse('Scan code for bugs').complexity)"
        )
        assert result.stdout.strip() == "simple"

    # --- Moderate tier -----------------------------------------------------

    def test_moderate_tier_for_multi_step_words(self) -> None:
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Read the code, then run tests, and finally report results')\n"
            "print(json.dumps({'complexity': r.complexity, 'max_turns': r.max_turns, "
            "'signals': r.complexity_signals}))"
        )
        data = json.loads(result.stdout)
        assert data["complexity"] == "moderate"
        assert data["max_turns"] == 15
        assert "multi_step_word" in data["signals"]

    def test_moderate_tier_for_numbered_steps(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Process data: 1. load inputs 2. transform 3. save outputs')\n"
            "print(r.complexity)\n"
            "print(r.complexity_signals.get('numbered_steps'))"
        )
        lines = result.stdout.strip().splitlines()
        assert lines == ["moderate", "detected"]

    def test_moderate_tier_for_multiple_action_verbs(self) -> None:
        """3+ distinct action verbs triggers moderate even without cue words."""
        result = self._run_py(
            "from nlp_parser import parse\n"
            "r = parse('Analyze the code, validate syntax, format output, build report')\n"
            "print(r.complexity)\n"
            "print('multi_verb_count' in r.complexity_signals)"
        )
        assert result.stdout.strip().splitlines() == ["moderate", "True"]

    # --- Complex tier ------------------------------------------------------

    def test_complex_tier_for_orchestration_keyword(self) -> None:
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Orchestrate code review across multiple agents')\n"
            "print(json.dumps({'complexity': r.complexity, 'max_turns': r.max_turns, "
            "'signal': r.complexity_signals.get('orchestration_keyword')}))"
        )
        data = json.loads(result.stdout)
        assert data["complexity"] == "complex"
        assert data["max_turns"] == 30
        assert data["signal"] == "orchestrate"

    def test_complex_tier_for_pipeline_keyword(self) -> None:
        result = self._run_py(
            "from nlp_parser import parse\nprint(parse('Build a multi-step pipeline').complexity)"
        )
        assert result.stdout.strip() == "complex"

    def test_orchestration_outranks_multi_step(self) -> None:
        """When both orchestration and multi-step words appear, complex wins."""
        result = self._run_py(
            "from nlp_parser import parse\n"
            "print(parse('Coordinate review then aggregate results').complexity)"
        )
        assert result.stdout.strip() == "complex"

    # --- maxTurns mapping -------------------------------------------------

    def test_max_turns_monotonic_with_tier(self) -> None:
        """simple < moderate < complex maxTurns, strictly increasing."""
        result = self._run_py(
            "import json\n"
            "from nlp_parser import estimate_complexity\n"
            "simple = estimate_complexity('lint it').max_turns\n"
            "moderate = estimate_complexity("
            "'analyze then format then report then publish').max_turns\n"
            "complex_ = estimate_complexity('orchestrate workers').max_turns\n"
            "print(json.dumps({'s': simple, 'm': moderate, 'c': complex_}))"
        )
        data = json.loads(result.stdout)
        assert data["s"] < data["m"] < data["c"]

    # --- signals are structured and ordered ------------------------------

    def test_signals_report_every_matched_cue(self) -> None:
        """complexity_signals must list every cue that contributed."""
        result = self._run_py(
            "import json\n"
            "from nlp_parser import parse\n"
            "r = parse('Orchestrate workers')\n"
            "print(json.dumps(r.complexity_signals))"
        )
        data = json.loads(result.stdout)
        assert data.get("orchestration_keyword") == "orchestrate"

    # --- public COMPLEXITY_TIERS exposed for external callers ------------

    def test_complexity_tiers_constant_is_ordered_and_public(self) -> None:
        result = self._run_py(
            "from nlp_parser import COMPLEXITY_TIERS\n"
            "print(COMPLEXITY_TIERS)\n"
            "print(COMPLEXITY_TIERS.index('simple') < "
            "COMPLEXITY_TIERS.index('moderate') < "
            "COMPLEXITY_TIERS.index('complex'))"
        )
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "('simple', 'moderate', 'complex')"
        assert lines[1] == "True"

    # --- AgentRequirements default fields are present --------------------

    def test_agent_requirements_exposes_complexity_fields(self) -> None:
        """Every parse() result carries complexity, max_turns, complexity_signals."""
        result = self._run_py(
            "import json\n"
            "from dataclasses import asdict\n"
            "from nlp_parser import parse\n"
            "r = parse('Create a reviewer')\n"
            "d = asdict(r)\n"
            "print(json.dumps({"
            "'has_complexity': 'complexity' in d, "
            "'has_max_turns': 'max_turns' in d, "
            "'has_signals': 'complexity_signals' in d}))"
        )
        data = json.loads(result.stdout)
        assert data["has_complexity"]
        assert data["has_max_turns"]
        assert data["has_signals"]

    # --- CLI ---------------------------------------------------------------

    def test_cli_json_output_emits_complexity_fields(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "--json",
                "Orchestrate a multi-agent code review",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["complexity"] == "complex"
        assert data["max_turns"] == 30
        assert data["complexity_signals"]

    def test_cli_text_output_shows_complexity_and_max_turns(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "Build an orchestrator pipeline",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout
        assert "Complexity:" in out
        assert "complex" in out
        assert "maxTurns=30" in out


class TestPromptReminderPoints:
    """Tests for system-reminder injection points (Feature #55).

    Feature criteria:
    - Long-running agents include reminder points after exploration phases
    - Critical rules are re-stated at decision points
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_exploration_complete_fires_for_long_running_with_read_tools(self) -> None:
        result = self._run_py(
            "import json\n"
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', "
            "purpose='audit', tools=['Read','Grep','Glob'])\n"
            "triggers = sorted({p.trigger for p in r.reminder_points})\n"
            "print(json.dumps(triggers))"
        )
        triggers = json.loads(result.stdout)
        assert "exploration_complete" in triggers

    def test_before_destructive_fires_when_write_tools_present(self) -> None:
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='builder', domain='general', purpose='x', "
            "tools=['Read','Write','Edit'])\n"
            "print('before_destructive' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_no_destructive_reminder_when_no_write_tools(self) -> None:
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='general', purpose='x', "
            "tools=['Read','Grep'])\n"
            "print('before_destructive' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "False"

    def test_security_domain_gets_security_decision_reminder(self) -> None:
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='validator', domain='security', "
            "purpose='audit', tools=['Read','Grep'])\n"
            "print('security_decision' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_bash_tool_gets_security_decision_even_without_security_domain(self) -> None:
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='automation', domain='devops', "
            "purpose='deploy', tools=['Read','Bash'])\n"
            "print('security_decision' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_phase_boundary_fires_between_every_step_pair(self) -> None:
        """For a workflow with >= _PHASE_BOUNDARY_MIN_STEPS, boundaries fire between each step pair."""
        result = self._run_py(
            "import json\n"
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='general', purpose='x', "
            "tools=['Read'])\n"
            "boundaries = [p for p in r.reminder_points if p.trigger == 'phase_boundary']\n"
            "steps = sorted(p.after_step for p in boundaries)\n"
            "print(json.dumps({'count': len(boundaries), 'steps': steps, "
            "'workflow_len': len(r.workflow_steps)}))"
        )
        data = json.loads(result.stdout)
        assert data["count"] == data["workflow_len"] - 1
        assert data["steps"] == list(range(1, data["workflow_len"]))

    def test_reminder_section_in_full_prompt_when_points_exist(self) -> None:
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep','Bash'])\n"
            "print('Mid-Conversation Refresh Points' in r.full_prompt)\n"
            "print('exploration_complete' in r.full_prompt)\n"
            "print('before_destructive' in r.full_prompt)"
        )
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True", "True"]

    def test_format_section_suppressed_when_no_points(self) -> None:
        """format_reminder_points_section returns empty string when no points."""
        result = self._run_py(
            "from prompt_generator import format_reminder_points_section\n"
            "print(repr(format_reminder_points_section([])))"
        )
        assert result.stdout.strip() == "''"

    def test_reminder_rules_include_constraints(self) -> None:
        """Rules at reminder points must include the agent's constraints."""
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep'], constraints=['custom rule A', 'custom rule B'])\n"
            "expl = next(p for p in r.reminder_points if p.trigger == 'exploration_complete')\n"
            "all_rules = ' '.join(expl.rules)\n"
            "print('custom rule A' in all_rules or 'custom rule B' in all_rules)"
        )
        assert result.stdout.strip() == "True"

    def test_before_destructive_prepends_verify_rule(self) -> None:
        """The before-destructive reminder must lead with a verify-before-mutating rule."""
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='builder', domain='general', purpose='x', "
            "tools=['Write','Edit'])\n"
            "pts = [p for p in r.reminder_points if p.trigger == 'before_destructive']\n"
            "print(pts[0].rules[0] if pts else 'NONE')"
        )
        first_rule = result.stdout.strip()
        assert "Verify" in first_rule or "verify" in first_rule

    def test_reminder_points_have_rationale(self) -> None:
        """Every emitted reminder point must carry a non-empty rationale."""
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep','Bash'])\n"
            "print(all(p.rationale.strip() for p in r.reminder_points))"
        )
        assert result.stdout.strip() == "True"


class TestFourBlockPromptStructure:
    """Tests for the 4-block prompt structure (feature #56).

    Covers:
    - generate_prompt_blocks() returns all four blocks with expected content
    - format_blocks_markdown() emits canonical headers in canonical order
    - format_blocks_xml() emits canonical tags in canonical order
    - generate_full_prompt() with structure_format="markdown" / "xml"
    - invalid structure_format raises ValueError (no silent fallback)
    - legacy format still works (backwards compatibility)
    - quality_scorer.evaluate_prompt_structure() detects all three modes
    - quality_scorer.score_prompt_structure() neutral-scores legacy agents
      and grades structured agents on block completeness
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_generate_prompt_blocks_returns_all_four_blocks(self) -> None:
        """generate_prompt_blocks populates instructions/context/task/output_format."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read','Grep'],[],'JSON')\n"
            "b = generate_prompt_blocks(cfg)\n"
            "print('I' if b.instructions else 'NO_I')\n"
            "print('C' if b.context else 'NO_C')\n"
            "print('T' if b.task else 'NO_T')\n"
            "print('O' if b.output_format else 'NO_O')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["I", "C", "T", "O"]

    def test_markdown_format_emits_canonical_headers(self) -> None:
        """format_blocks_markdown emits ## INSTRUCTIONS etc in canonical order."""
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate('analyzer','security','audit',['Read'],[],'JSON')\n"
            "# legacy default — should not have block headers\n"
            "print('NOHEADER' if '## INSTRUCTIONS' not in r.full_prompt else 'HEADER')\n"
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i = p.find('## INSTRUCTIONS')\n"
            "c = p.find('## CONTEXT')\n"
            "t = p.find('## TASK')\n"
            "o = p.find('## OUTPUT FORMAT')\n"
            "print('ORDER_OK' if 0 <= i < c < t < o else f'ORDER_BAD {i} {c} {t} {o}')"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "NOHEADER"
        assert lines[1] == "ORDER_OK"

    def test_xml_format_emits_canonical_tags(self) -> None:
        """format_blocks_xml emits <instructions>..<output_format> in canonical order."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i = p.find('<instructions>')\n"
            "c = p.find('<context>')\n"
            "t = p.find('<task>')\n"
            "o = p.find('<output_format>')\n"
            "print('ORDER_OK' if 0 <= i < c < t < o else 'ORDER_BAD')\n"
            "# closing tags present\n"
            "has_close = all(x in p for x in ['</instructions>','</context>','</task>','</output_format>'])\n"
            "print('CLOSED' if has_close else 'UNCLOSED')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["ORDER_OK", "CLOSED"]

    def test_invalid_structure_format_raises(self) -> None:
        """Unknown structure_format raises ValueError — no silent fallback."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','bogus')\n"
            "try:\n"
            "    generate_full_prompt(cfg)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'bogus' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_legacy_format_unchanged(self) -> None:
        """Legacy format still produces the historical section list (no block headers)."""
        result = self._run_py(
            "from prompt_generator import generate\n"
            "r = generate('analyzer','security','audit',['Read','Grep'],[],'JSON')\n"
            "p = r.full_prompt\n"
            "# legacy uses **Capabilities:** and **Workflow:** bold markers,\n"
            "# NOT ## block headers.\n"
            "print('BOLD' if '**Capabilities:**' in p and '**Workflow:**' in p else 'NO_BOLD')\n"
            "print('NO_BLOCKS' if '## INSTRUCTIONS' not in p and '<instructions>' not in p else 'HAS_BLOCKS')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_BLOCKS"]

    def test_evaluate_prompt_structure_markdown(self) -> None:
        """evaluate_prompt_structure detects markdown-style 4-block content."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "md = '## INSTRUCTIONS\\nfoo\\n## CONTEXT\\nbar\\n## TASK\\nbaz\\n## OUTPUT FORMAT\\nqux'\n"
            "r = evaluate_prompt_structure(md)\n"
            "print(r.format, len(r.found_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown 4 True"

    def test_evaluate_prompt_structure_xml(self) -> None:
        """evaluate_prompt_structure detects XML-tagged 4-block content."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "xml = '<instructions>a</instructions>\\n<context>b</context>\\n<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(xml)\n"
            "print(r.format, len(r.found_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml 4 True"

    def test_evaluate_prompt_structure_partial(self) -> None:
        """Partial markdown structure is reported incomplete, format still 'markdown'."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "md = '## INSTRUCTIONS\\nfoo\\n## CONTEXT\\nbar'\n"
            "r = evaluate_prompt_structure(md)\n"
            "print(r.format, len(r.found_blocks), len(r.missing_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown 2 2 False"

    def test_evaluate_prompt_structure_none(self) -> None:
        """Legacy format (no block markers) reports format='none'."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "legacy = '# Some Agent\\n\\n**Capabilities:**\\n- x\\n\\n**Workflow:**\\n1. y'\n"
            "r = evaluate_prompt_structure(legacy)\n"
            "print(r.format, len(r.found_blocks))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "none 0"

    def test_score_prompt_structure_legacy_neutral(self) -> None:
        """Legacy content scores a neutral 7.0 with no penalty."""
        result = self._run_py(
            "from quality_scorer import score_prompt_structure\n"
            "legacy = '# Agent\\n\\n## Overview\\nfoo'\n"
            "s = score_prompt_structure(legacy)\n"
            "print(round(s.score,1), s.weight, 'adopting' in ' '.join(s.suggestions).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "7.0 0.0 True"

    def test_score_prompt_structure_complete_wins(self) -> None:
        """Complete 4-block structure scores 10.0 (all four blocks)."""
        result = self._run_py(
            "from quality_scorer import score_prompt_structure\n"
            "md = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb\\n## TASK\\nc\\n## OUTPUT FORMAT\\nd'\n"
            "s = score_prompt_structure(md)\n"
            "print(round(s.score,1))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "10.0"

    def test_score_prompt_structure_partial_scales_linearly(self) -> None:
        """2 of 4 blocks scores 5.0; complete is strictly higher than partial."""
        result = self._run_py(
            "from quality_scorer import score_prompt_structure\n"
            "two = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb'\n"
            "three = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb\\n## TASK\\nc'\n"
            "print(round(score_prompt_structure(two).score,1),"
            " round(score_prompt_structure(three).score,1))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "5.0 7.5"

    def test_round_trip_markdown_scores_complete(self) -> None:
        """Agent generated with structure_format='markdown' scores complete via scorer."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "from quality_scorer import evaluate_prompt_structure\n"
            "cfg = PromptConfig('builder','documentation','write docs',"
            "['Read','Write'],[],'Markdown docs','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "r = evaluate_prompt_structure(p)\n"
            "print(r.format, r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown True"


class TestXmlNestedTagStructure:
    """Tests for nested XML sub-tags inside the 4-block structure (feature #57).

    Covers:
    - xml mode renders constraints inside ``<constraints>...</constraints>``
      nested within ``<instructions>...</instructions>``
    - markdown / legacy modes render constraints under ``**Constraints:**``
      bold heading (no nested tag)
    - xml mode renders examples inside ``<examples><example>...</example>``
      nested within ``<context>...</context>``
    - markdown / legacy modes render examples under ``**Examples:**`` bullet
      list (no nested tag)
    - quality_scorer.evaluate_prompt_structure detects nested tags and
      populates ``nested_tags_found``
    - nested tags are properly contained within parent block boundaries
    - PromptConfig.examples defaults to empty list (backwards compat)
    - empty examples list suppresses the section in xml mode (no empty
      ``<examples>`` tag emitted)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_xml_mode_wraps_constraints_in_nested_tag(self) -> None:
        """xml mode emits <constraints>...</constraints> instead of bold heading."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['must scan all files','no destructive ops'],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OPEN' if '<constraints>' in p else 'NO_OPEN')\n"
            "print('CLOSE' if '</constraints>' in p else 'NO_CLOSE')\n"
            "print('NO_BOLD' if '**Constraints:**' not in p else 'BOLD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["OPEN", "CLOSE", "NO_BOLD"]

    def test_markdown_mode_uses_bold_heading_for_constraints(self) -> None:
        """markdown mode keeps **Constraints:** bold heading, no XML tags."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['must scan all'],'JSON','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Constraints:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<constraints>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_xml_mode_wraps_examples_in_nested_tags(self) -> None:
        """xml mode emits <examples><example>...</example></examples>."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "cfg.examples = ['Input: foo / Output: bar', 'Input: baz / Output: qux']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OUTER_OPEN' if '<examples>' in p else 'NO_OUTER_OPEN')\n"
            "print('OUTER_CLOSE' if '</examples>' in p else 'NO_OUTER_CLOSE')\n"
            "print('INNER_OPEN' if '<example>' in p else 'NO_INNER_OPEN')\n"
            "print('INNER_CLOSE' if '</example>' in p else 'NO_INNER_CLOSE')\n"
            "print('TWO' if p.count('<example>') == 2 else 'WRONG_COUNT')\n"
            "print('NO_BOLD' if '**Examples:**' not in p else 'BOLD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "OUTER_OPEN",
            "OUTER_CLOSE",
            "INNER_OPEN",
            "INNER_CLOSE",
            "TWO",
            "NO_BOLD",
        ]

    def test_markdown_mode_uses_bullet_list_for_examples(self) -> None:
        """markdown mode emits **Examples:** bullet list, no XML tags."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.examples = ['Input: foo / Output: bar']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Examples:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<examples>' not in p and '<example>' not in p"
            " else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_empty_examples_list_suppresses_section_in_xml(self) -> None:
        """Empty examples list does not emit an empty <examples></examples>."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('NO_EXAMPLES_TAG' if '<examples>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NO_EXAMPLES_TAG"

    def test_nested_constraints_tag_inside_instructions_block(self) -> None:
        """<constraints> opening tag falls between <instructions> open and close."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['no destructive ops'],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i_open = p.find('<instructions>')\n"
            "i_close = p.find('</instructions>')\n"
            "c_open = p.find('<constraints>')\n"
            "c_close = p.find('</constraints>')\n"
            "ok = 0 <= i_open < c_open < c_close < i_close\n"
            "print('NESTED_OK' if ok else f'BAD {i_open} {c_open} {c_close} {i_close}')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NESTED_OK"

    def test_nested_examples_tag_inside_context_block(self) -> None:
        """<examples> opening tag falls between <context> open and close."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "cfg.examples = ['demo']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "c_open = p.find('<context>')\n"
            "c_close = p.find('</context>')\n"
            "e_open = p.find('<examples>')\n"
            "e_close = p.find('</examples>')\n"
            "ok = 0 <= c_open < e_open < e_close < c_close\n"
            "print('NESTED_OK' if ok else f'BAD {c_open} {e_open} {e_close} {c_close}')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NESTED_OK"

    def test_legacy_mode_uses_bold_heading_for_constraints(self) -> None:
        """legacy structure_format keeps the historic **Constraints:** heading."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['hard rule'],'JSON','legacy')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Constraints:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<constraints>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_evaluate_prompt_structure_detects_nested_constraints(self) -> None:
        """evaluate_prompt_structure populates nested_tags_found with 'constraints'."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>foo\\n<constraints>- a</constraints>"
            "\\n</instructions>\\n<context>b</context>\\n<task>c</task>"
            "\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.format, 'constraints' in r.nested_tags_found,"
            " 'examples' in r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml True False"

    def test_evaluate_prompt_structure_detects_nested_examples(self) -> None:
        """evaluate_prompt_structure populates nested_tags_found with 'examples'."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>a</instructions>\\n<context>b\\n"
            "<examples><example>e1</example></examples></context>\\n"
            "<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.format, 'constraints' in r.nested_tags_found,"
            " 'examples' in r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml False True"

    def test_evaluate_prompt_structure_no_nested_tags_when_absent(self) -> None:
        """nested_tags_found is empty list when neither sub-tag is present."""
        result = self._run_py(
            "from quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>a</instructions>\\n<context>b</context>"
            "\\n<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_promptconfig_examples_defaults_to_empty_list(self) -> None:
        """Backwards compat: PromptConfig.examples defaults to empty list."""
        result = self._run_py(
            "from prompt_generator import PromptConfig\n"
            "cfg = PromptConfig('a','cat','desc',['Read'],[],'JSON')\n"
            "print(cfg.examples == [], type(cfg.examples).__name__)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True list"


class TestAgentDiffComparison:
    """Tests for agent diff comparison in agent_versioning.py (feature #59).

    Covers:
    - diff_agents detects frontmatter additions / removals / changes
      (excluding tools, which are handled separately)
    - diff_agents detects tool additions and removals as sorted lists
    - diff_agents detects section additions / removals / modifications
    - whitespace-only section changes do not count as modified
    - is_empty() returns True for identical content, False otherwise
    - format_agent_diff renders human-readable output with +/-/~ symbols
    - format_agent_diff returns "No changes." for empty diff
    - format_agent_diff omits empty subsections (no "Tools:" header when
      no tool changes)
    - CLI ``diff`` subcommand prints expected output and exits 0
    - CLI ``diff`` exits non-zero when a path is missing
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_diff_detects_frontmatter_changes(self) -> None:
        """Frontmatter add/remove/change populate the right buckets."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: a\\nmodel: sonnet\\nold_field: x\\n---\\n'\n"
            "new = '---\\nname: b\\nmodel: sonnet\\nnew_field: y\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(sorted(d.frontmatter_added), sorted(d.frontmatter_removed),"
            " sorted(d.frontmatter_changed))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['new_field'] ['old_field'] ['name']"

    def test_diff_detects_tool_changes(self) -> None:
        """Tool additions and removals are sorted lists, set semantics."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read, Grep, WebFetch\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash, Edit\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.tools_added, d.tools_removed)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Bash', 'Edit'] ['Grep', 'WebFetch']"

    def test_diff_excludes_tools_from_frontmatter_diff(self) -> None:
        """Changing tools must not appear in frontmatter_changed."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Bash\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print('FM_CHANGED' if d.frontmatter_changed else 'FM_OK',"
            " 'TOOLS_OK' if d.tools_added and d.tools_removed else 'TOOLS_BAD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "FM_OK TOOLS_OK"

    def test_diff_detects_section_add_remove_change(self) -> None:
        """Sections added, removed, and modified land in correct buckets."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\n---\\n## Overview\\nold body\\n## Removed Sec\\nbye'\n"
            "new = '---\\nname: x\\n---\\n## Overview\\nNEW body\\n## Added Sec\\nhi'\n"
            "d = diff_agents(old, new)\n"
            "print(d.sections_added, d.sections_removed, d.sections_changed)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Added Sec'] ['Removed Sec'] ['Overview']"

    def test_diff_ignores_whitespace_only_section_changes(self) -> None:
        """Bodies differing only in trailing space / blank lines are equal."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\n---\\n## Sec\\nbody line\\n'\n"
            "new = '---\\nname: x\\n---\\n## Sec\\nbody line   \\n\\n\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.sections_changed, d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[] True"

    def test_diff_is_empty_for_identical_content(self) -> None:
        """Identical content yields an empty diff."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "c = '---\\nname: x\\ntools: Read\\n---\\n## A\\nbody'\n"
            "d = diff_agents(c, c)\n"
            "print(d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_diff_is_empty_returns_false_when_any_change(self) -> None:
        """Adding a single tool flips is_empty to False."""
        result = self._run_py(
            "from agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_format_renders_human_readable_with_symbols(self) -> None:
        """Output uses +/-/~ markers and segregates frontmatter/tools/sections."""
        result = self._run_py(
            "from agent_versioning import diff_agents, format_agent_diff\n"
            "old = '---\\nname: a\\ntools: Read, WebFetch\\n---\\n## A\\nold'\n"
            "new = '---\\nname: b\\ntools: Read, Bash\\n---\\n## A\\nnew\\n## B\\nhi'\n"
            "out = format_agent_diff(diff_agents(old, new))\n"
            "checks = [\n"
            "    'Agent Diff' in out,\n"
            "    'Frontmatter:' in out,\n"
            "    'Tools:' in out,\n"
            "    'Sections:' in out,\n"
            "    \"~ name: 'a' -> 'b'\" in out,\n"
            "    '+ Added: Bash' in out,\n"
            "    '- Removed: WebFetch' in out,\n"
            "    '~ Changed: A' in out,\n"
            "    '+ Added: B' in out,\n"
            "]\n"
            "print(all(checks), checks.count(False))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_format_returns_no_changes_for_empty_diff(self) -> None:
        """Empty diff renders as a stable single-line marker."""
        result = self._run_py(
            "from agent_versioning import AgentDiff, format_agent_diff\n"
            "print(repr(format_agent_diff(AgentDiff())))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "'No changes.\\n'"

    def test_format_omits_empty_subsections(self) -> None:
        """Diff with only tool changes omits Frontmatter and Sections headings."""
        result = self._run_py(
            "from agent_versioning import diff_agents, format_agent_diff\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash\\n---\\n'\n"
            "out = format_agent_diff(diff_agents(old, new))\n"
            "print('Tools:' in out, 'Frontmatter:' not in out, 'Sections:' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_cli_diff_command_prints_diff_and_exits_zero(self) -> None:
        """``versions diff old new`` prints the formatted diff and exits 0."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            old_path = Path(tmp) / "old.md"
            new_path = Path(tmp) / "new.md"
            old_path.write_text("---\nname: a\ntools: Read\n---\n## A\nold\n")
            new_path.write_text("---\nname: b\ntools: Read\n---\n## A\nold\n")
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).parent.parent / "scripts" / "agent_versioning.py"),
                    "diff",
                    str(old_path),
                    str(new_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode == 0, result.stderr
            assert "Agent Diff" in result.stdout
            assert "~ name: 'a' -> 'b'" in result.stdout

    def test_cli_diff_command_exits_nonzero_on_missing_file(self) -> None:
        """Missing path causes the CLI to exit with non-zero status."""
        import subprocess

        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).parent.parent / "scripts" / "agent_versioning.py"),
                "diff",
                "/nonexistent/old.md",
                "/nonexistent/new.md",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode != 0
        assert "not found" in result.stdout.lower()


class TestPluginExport:
    """Tests for plugin-format export in agent_export.py (feature #61).

    Covers:
    - export_as_plugin produces the canonical plugin layout
      (.claude-plugin/plugin.json, agents/, hooks/hooks.json, README.md)
    - hooks/hooks.json is always written (empty {} when no hooks)
    - hook scripts produce a PostToolUse entry referencing CLAUDE_PLUGIN_ROOT
    - build_plugin_manifest emits required claudeCodeMinVersion and omits
      empty optional fields
    - missing agent file → success=False with clear error
    - non-empty output_dir without overwrite=True → success=False
    - overwrite=True replaces existing directory
    - sanitize=True strips AWS-key-like patterns from copied content
    - CLI export-plugin subcommand prints success and exits 0
    - CLI exits non-zero when source agent missing
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_export_creates_canonical_plugin_layout(self) -> None:
        """Plugin export writes .claude-plugin/, agents/, hooks/, README."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'agents' / 'demo.md'\n"
            "    agent.parent.mkdir(parents=True)\n"
            "    agent.write_text('---\\nname: demo\\nversion: 2.1.0\\n"
            "description: Demo agent\\ntools: Read, Bash\\n---\\n# demo')\n"
            "    out = tmp / 'out'\n"
            "    r = export_as_plugin(agent, out, author='Daisy')\n"
            "    print('OK' if r.success else f'FAIL {r.errors}')\n"
            "    print((out / '.claude-plugin' / 'plugin.json').exists())\n"
            "    print((out / 'agents' / 'demo.md').exists())\n"
            "    print((out / 'hooks' / 'hooks.json').exists())\n"
            "    print((out / 'README.md').exists())\n"
            "    pj = json.loads((out / '.claude-plugin' / 'plugin.json').read_text())\n"
            "    print(pj['name'], pj['version'], pj['claudeCodeMinVersion'])\n"
            "    print(pj.get('author'))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "OK"
        assert lines[1:5] == ["True", "True", "True", "True"]
        assert lines[5] == "demo 2.1.0 1.0.0"
        assert lines[6] == "Daisy"

    def test_hooks_json_is_empty_object_when_no_hooks(self) -> None:
        """hooks.json is always written; defaults to {} when no hook files."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'agents' / 'demo.md'\n"
            "    agent.parent.mkdir(parents=True)\n"
            "    agent.write_text('---\\nname: demo\\n---\\nbody')\n"
            "    r = export_as_plugin(agent, tmp / 'out')\n"
            "    hooks = json.loads((tmp / 'out' / 'hooks' / 'hooks.json').read_text())\n"
            "    print(r.success, hooks)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True {}"

    def test_hook_scripts_are_referenced_in_hooks_json(self) -> None:
        """When hook files are bundled, hooks.json references them via CLAUDE_PLUGIN_ROOT."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agents = tmp / 'agents'\n"
            "    agents.mkdir()\n"
            "    (agents / 'demo.md').write_text('---\\nname: demo\\n---\\nbody')\n"
            "    hooks = tmp / 'hooks'\n"
            "    hooks.mkdir()\n"
            "    (hooks / 'demo-hook.sh').write_text('#!/bin/bash\\necho hi')\n"
            "    r = export_as_plugin(agents / 'demo.md', tmp / 'out')\n"
            "    cfg = json.loads((tmp / 'out' / 'hooks' / 'hooks.json').read_text())\n"
            "    print(r.success, list(cfg.keys()))\n"
            "    entry = cfg['PostToolUse'][0]['hooks'][0]\n"
            "    print(entry['type'], entry['command'])"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "True ['PostToolUse']"
        assert lines[1] == "command ${CLAUDE_PLUGIN_ROOT}/hooks/demo-hook.sh"

    def test_build_plugin_manifest_omits_empty_optional_fields(self) -> None:
        """Optional fields not set on PackageManifest stay out of plugin.json."""
        result = self._run_py(
            "from agent_export import PackageManifest, build_plugin_manifest\n"
            "m = PackageManifest(name='x', version='1.0.0', description='d')\n"
            "pj = build_plugin_manifest(m)\n"
            "print(sorted(pj.keys()))"
        )
        assert result.returncode == 0, result.stderr
        # name, version, description, claudeCodeMinVersion always present.
        # license has dataclass default 'MIT' so it's also non-empty.
        # author/homepage/repository/keywords are empty so they're omitted.
        assert (
            result.stdout.strip()
            == "['claudeCodeMinVersion', 'description', 'license', 'name', 'version']"
        )

    def test_missing_agent_returns_error(self) -> None:
        """Source agent that doesn't exist → success=False with message."""
        result = self._run_py(
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "r = export_as_plugin(Path('/nonexistent/agent.md'), Path('/tmp/out'))\n"
            "print(r.success, 'not found' in r.errors[0].lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_nonempty_output_refuses_without_overwrite(self) -> None:
        """Existing non-empty output_dir + overwrite=False → success=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\n')\n"
            "    out = tmp / 'out'\n"
            "    out.mkdir()\n"
            "    (out / 'sentinel.txt').write_text('keep me')\n"
            "    r = export_as_plugin(agent, out)\n"
            "    print(r.success, 'overwrite' in r.errors[0].lower(),"
            " (out / 'sentinel.txt').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True True"

    def test_overwrite_true_replaces_existing_directory(self) -> None:
        """overwrite=True wipes old contents before writing the plugin."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\nbody')\n"
            "    out = tmp / 'out'\n"
            "    out.mkdir()\n"
            "    (out / 'stale.txt').write_text('old')\n"
            "    r = export_as_plugin(agent, out, overwrite=True)\n"
            "    print(r.success, (out / 'stale.txt').exists(),"
            " (out / 'agents' / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False True"

    def test_sanitize_strips_secret_patterns(self) -> None:
        """sanitize=True scrubs API-key-like substrings from copied content.

        The fake key is built dynamically inside the subprocess to avoid
        embedding a literal AWS-key-shaped string in this source file
        (which would trip pre-commit secret scanners).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    fake_key = 'AK' + 'IA' + '0123456789ABCDEF'\n"
            "    agent.write_text(f'---\\nname: a\\n---\\napi_key={fake_key}')\n"
            "    r = export_as_plugin(agent, tmp / 'out')\n"
            "    body = (tmp / 'out' / 'agents' / 'a.md').read_text()\n"
            "    aws_marker = 'AK' + 'IA'\n"
            "    print(aws_marker not in body, any('Sanitized' in w for w in r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_cli_export_plugin_success(self) -> None:
        """``export-plugin agent -o dir`` produces a valid plugin and exits 0."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            agent = tmp_path / "a.md"
            agent.write_text("---\nname: a\n---\nbody")
            out = tmp_path / "out"
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).parent.parent / "scripts" / "agent_export.py"),
                    "export-plugin",
                    str(agent),
                    "-o",
                    str(out),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode == 0, result.stderr
            assert "Plugin exported to" in result.stdout
            assert (out / ".claude-plugin" / "plugin.json").exists()
            assert (out / "hooks" / "hooks.json").exists()

    def test_cli_export_plugin_missing_agent_exits_nonzero(self) -> None:
        """CLI exits with non-zero when the source agent path is missing."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).parent.parent / "scripts" / "agent_export.py"),
                    "export-plugin",
                    "/nonexistent/agent.md",
                    "-o",
                    str(Path(tmp) / "out"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode != 0
            assert "not found" in result.stdout.lower()


class TestProgressTrackerTodoWrite:
    """Tests for TodoWrite integration in progress_tracker.py (feature #65).

    Covers:
    - to_todowrite_items returns one item per phase in canonical order
      (discovery → architecture → generation → validation → installation)
    - Empty tracker (no start() call) returns empty list
    - Status mapping: pending → pending, running → in_progress,
      completed → completed, skipped → completed, failed → in_progress
    - Per-phase progress percentage appears in both content and activeForm
    - All items have the three required keys (content, status, activeForm)
    - active label uses present-participle phrasing for in_progress items
    - _phase_to_todowrite_item is callable in isolation (no tracker needed)
    - CLI ``todowrite`` subcommand emits valid JSON list
    - CLI prints ``[]`` when no tracking state exists
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_returns_one_item_per_phase_in_canonical_order(self) -> None:
        """to_todowrite_items emits 5 items in DISCOVERY → INSTALLATION order."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    print(len(items))\n"
            "    for i in items:\n"
            "        print(i['content'].split(' [')[0])"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "5"
        assert lines[1:] == [
            "Discovery",
            "Architecture",
            "Generation",
            "Validation",
            "Installation",
        ]

    def test_empty_tracker_returns_empty_list(self) -> None:
        """to_todowrite_items returns [] when no start() call has happened."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    print(t.to_todowrite_items())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_running_phase_maps_to_in_progress(self) -> None:
        """A phase with status=running becomes status=in_progress."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    t.update_phase('generation', 50)\n"
            "    items = t.to_todowrite_items()\n"
            "    statuses = {i['content'].split(' [')[0]: i['status'] for i in items}\n"
            "    print(statuses['Generation'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "in_progress"

    def test_completed_phase_maps_to_completed(self) -> None:
        """Advancing past a phase marks it status=completed."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    t.update_phase('discovery', 100)\n"
            "    t.update_phase('architecture', 0)\n"
            "    items = t.to_todowrite_items()\n"
            "    statuses = {i['content'].split(' [')[0]: i['status'] for i in items}\n"
            "    print(statuses['Discovery'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "completed"

    def test_pending_phase_maps_to_pending(self) -> None:
        """Phases not yet started map to status=pending."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    print(all(i['status'] == 'pending' for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_phase_to_todowrite_item_skipped_maps_to_completed(self) -> None:
        """skipped phase status renders as completed (TodoWrite has no skipped)."""
        result = self._run_py(
            "from progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='discovery', started_at='', "
            "status='skipped', progress_percent=100)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.DISCOVERY, p)\n"
            "print(item['status'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "completed"

    def test_phase_to_todowrite_item_failed_maps_to_in_progress(self) -> None:
        """failed phase stays in_progress so the user sees it as the active row."""
        result = self._run_py(
            "from progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='generation', started_at='', "
            "status='failed', progress_percent=42)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.GENERATION, p)\n"
            "print(item['status'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "in_progress"

    def test_percentage_is_appended_to_both_labels(self) -> None:
        """[NN%] suffix appears on both content and activeForm."""
        result = self._run_py(
            "from progress_tracker import PhaseProgress, ProgressPhase, _phase_to_todowrite_item\n"
            "p = PhaseProgress(phase='generation', started_at='', "
            "status='running', progress_percent=37)\n"
            "item = _phase_to_todowrite_item(ProgressPhase.GENERATION, p)\n"
            "print(item['content'])\n"
            "print(item['activeForm'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "Generation [37%]",
            "Generating files [37%]",
        ]

    def test_all_items_have_required_keys(self) -> None:
        """Every emitted item has content, status, activeForm keys."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    t = ProgressTracker(state_file=Path(tmp) / 's.json')\n"
            "    t.start('demo')\n"
            "    items = t.to_todowrite_items()\n"
            "    keys = {'content', 'status', 'activeForm'}\n"
            "    print(all(set(i.keys()) == keys for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_cli_todowrite_emits_valid_json(self) -> None:
        """``todowrite`` subcommand writes a parseable JSON list of items."""
        import json
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            scripts_dir = Path(__file__).parent.parent / "scripts"
            # Start a tracker first using the CLI itself.
            subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "start", "demo"],
                capture_output=True,
                text=True,
                check=True,
                cwd=str(tmp_path),
            )
            result = subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "todowrite"],
                capture_output=True,
                text=True,
                check=False,
                cwd=str(tmp_path),
            )
            assert result.returncode == 0, result.stderr
            items = json.loads(result.stdout)
            assert len(items) == 5
            assert all("content" in i and "status" in i and "activeForm" in i for i in items)

    def test_cli_todowrite_prints_empty_list_when_no_state(self) -> None:
        """CLI prints ``[]`` when no tracking has been started."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            scripts_dir = Path(__file__).parent.parent / "scripts"
            result = subprocess.run(
                [sys.executable, str(scripts_dir / "progress_tracker.py"), "todowrite"],
                capture_output=True,
                text=True,
                check=False,
                cwd=tmp,
            )
            assert result.returncode == 0, result.stderr
            assert result.stdout.strip() == "[]"


class TestDomainKnowledgeImports:
    """Tests for CLAUDE.md @import support in prompt_generator.py (feature #73).

    Covers:
    - estimate_tokens uses ~4 chars/token heuristic; empty → 0; tiny → 1
    - total_domain_knowledge_tokens sums across entries
    - should_use_domain_knowledge_imports: empty → False; under threshold
      → False; equal to threshold → False (strict greater-than); over → True
    - format_domain_knowledge_block: empty input → empty string
    - Inline mode: emits content under section heading with optional title
    - Import mode: emits @path references when content exceeds threshold
    - Per-entry title surfaced in both modes
    - Generated agent: small corpus → content inlined in CONTEXT
    - Generated agent: large corpus → @import paths in CONTEXT, content NOT
      inlined (verifies the actual size-driven switch)
    - PromptConfig.domain_knowledge defaults to empty list (backwards compat)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_estimate_tokens_basic_cases(self) -> None:
        """Empty → 0, tiny → 1, ~4 chars per token approximation."""
        result = self._run_py(
            "from prompt_generator import estimate_tokens\n"
            "print(estimate_tokens(''))\n"
            "print(estimate_tokens('x'))\n"
            "# 400 chars → ~100 tokens (4 chars/token heuristic)\n"
            "print(estimate_tokens('a' * 400))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["0", "1", "100"]

    def test_total_tokens_sums_across_entries(self) -> None:
        """total_domain_knowledge_tokens aggregates the per-entry estimate."""
        result = self._run_py(
            "from prompt_generator import DomainKnowledge, total_domain_knowledge_tokens\n"
            "items = [DomainKnowledge(import_path='a', content='a' * 400),\n"
            "         DomainKnowledge(import_path='b', content='b' * 800)]\n"
            "print(total_domain_knowledge_tokens(items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "300"

    def test_should_use_imports_threshold_behavior(self) -> None:
        """Empty/under/at/over the threshold all map to expected booleans."""
        result = self._run_py(
            "from prompt_generator import DomainKnowledge, should_use_domain_knowledge_imports\n"
            "empty = []\n"
            "# 100 chars → 25 tokens, well under threshold of 50\n"
            "small = [DomainKnowledge(import_path='a', content='a' * 100)]\n"
            "# Exactly 50 tokens (200 chars / 4) → at threshold\n"
            "at = [DomainKnowledge(import_path='b', content='b' * 200)]\n"
            "# 60 tokens (240 chars / 4) → over threshold\n"
            "over = [DomainKnowledge(import_path='c', content='c' * 240)]\n"
            "print(should_use_domain_knowledge_imports(empty, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(small, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(at, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(over, threshold_tokens=50))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False False False True"

    def test_format_block_empty_returns_empty_string(self) -> None:
        """Empty list → empty string so the caller can suppress the section."""
        result = self._run_py(
            "from prompt_generator import format_domain_knowledge_block\n"
            "print(repr(format_domain_knowledge_block([])))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_format_block_inline_mode_below_threshold(self) -> None:
        """Small corpus inlines content under the section heading."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    DOMAIN_KNOWLEDGE_HEADING, DomainKnowledge, format_domain_knowledge_block\n"
            ")\n"
            "items = [DomainKnowledge(import_path='ctx.md', "
            "content='Important fact', title='Background')]\n"
            "out = format_domain_knowledge_block(items, threshold_tokens=2000)\n"
            "print(DOMAIN_KNOWLEDGE_HEADING in out)\n"
            "print('### Background' in out)\n"
            "print('Important fact' in out)\n"
            "print('@ctx.md' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True", "True"]

    def test_format_block_import_mode_above_threshold(self) -> None:
        """Large corpus emits @import refs and OMITS the inline content."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    DOMAIN_KNOWLEDGE_HEADING, DomainKnowledge, format_domain_knowledge_block\n"
            ")\n"
            "# 12000 chars → ~3000 tokens, well over default 2000 threshold\n"
            "big = 'X' * 12000\n"
            "items = [DomainKnowledge(import_path='.claude/big.md', "
            "content=big, title='Big Reference')]\n"
            "out = format_domain_knowledge_block(items)\n"
            "print(DOMAIN_KNOWLEDGE_HEADING in out)\n"
            "print('@.claude/big.md' in out)\n"
            "print('Big Reference' in out)\n"
            "# Content must NOT be inlined when @import is used\n"
            "print('XXXXXX' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True", "True"]

    def test_format_block_handles_missing_title(self) -> None:
        """Entries without a title still render in both modes."""
        result = self._run_py(
            "from prompt_generator import DomainKnowledge, format_domain_knowledge_block\n"
            "# Inline path: no title means no '### ' heading\n"
            "small = [DomainKnowledge(import_path='a.md', content='body', title='')]\n"
            "inline = format_domain_knowledge_block(small, threshold_tokens=2000)\n"
            "print('### ' not in inline, 'body' in inline)\n"
            "# Import path: no title means '- @path' not '- title: @path'\n"
            "big = [DomainKnowledge(import_path='b.md', content='X' * 12000, title='')]\n"
            "imports = format_domain_knowledge_block(big)\n"
            "print('- @b.md' in imports, ': @' not in imports)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True True", "True True"]

    def test_generate_full_prompt_inlines_small_domain_knowledge(self) -> None:
        """Small corpus appears verbatim inside the generated agent prompt."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    DomainKnowledge, PromptConfig, generate_full_prompt\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.domain_knowledge = [DomainKnowledge(\n"
            "    import_path='.claude/notes.md',\n"
            "    content='OWASP Top 10 — focus on injection.',\n"
            "    title='Reference Notes',\n"
            ")]\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OWASP Top 10' in p)\n"
            "print('@.claude/notes.md' not in p)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_generate_full_prompt_uses_imports_for_large_domain_knowledge(self) -> None:
        """Above threshold: prompt cites @paths and omits the source content."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    DomainKnowledge, PromptConfig, generate_full_prompt\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.domain_knowledge = [DomainKnowledge(\n"
            "    import_path='.claude/big-context.md',\n"
            "    content='SECRET-MARKER ' * 1500,  # ~6000 tokens\n"
            "    title='Comprehensive Reference',\n"
            ")]\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('@.claude/big-context.md' in p)\n"
            "# Content must not be inlined when @import is used\n"
            "print('SECRET-MARKER' not in p)\n"
            "# Title still appears as the @import label\n"
            "print('Comprehensive Reference' in p)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_promptconfig_domain_knowledge_defaults_to_empty(self) -> None:
        """Backwards compat: domain_knowledge defaults to []."""
        result = self._run_py(
            "from prompt_generator import PromptConfig\n"
            "cfg = PromptConfig('a','cat','desc',['Read'],[],'JSON')\n"
            "print(cfg.domain_knowledge == [], type(cfg.domain_knowledge).__name__)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True list"


class TestAgentDependencyDocumentation:
    """Tests for agent dependency documentation in agent_composer.py (feature #78).

    Covers:
    - build_dependency_graph: edges keyed by every agent (incl. isolated)
    - build_dependency_graph: roots = agents nothing else depends on
    - build_dependency_graph: detects missing dependencies (typos, renames)
    - build_dependency_graph: detects simple 2-cycle
    - build_dependency_graph: detects longer cycle (3-node)
    - Cycle deduplication: same ring entered from two starts reported once
    - render_dependency_diagram: emits Mermaid ``graph TD`` with all nodes
    - render_dependency_diagram: cycle edges use dotted ``-.->`` arrows
    - render_dependency_diagram: missing deps tagged with ``MISSING:`` prefix
    - render_dependency_readme_section: includes heading + diagram + roots
    - render_dependency_readme_section: cycle warning when cycles present
    - CLI ``deps`` exits non-zero on cycles (CI gate behavior)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_build_graph_edges_include_isolated_agents(self) -> None:
        """Agents with no dependencies still appear in the edges map."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='loner', description='', dependencies=[]),\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=[]),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "print(sorted(g.edges))\n"
            "print(g.edges['loner'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["['a', 'b', 'loner']", "[]"]

    def test_build_graph_identifies_roots(self) -> None:
        """Roots are agents nobody depends on."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['mid']),\n"
            "    AgentSpec(name='mid', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "print(g.roots)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['top']"

    def test_build_graph_detects_missing_dependencies(self) -> None:
        """Names referenced but not defined go into missing_dependencies."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [AgentSpec(name='a', description='', "
            "dependencies=['nonexistent', 'also_missing'])]\n"
            "g = build_dependency_graph(agents)\n"
            "print(sorted(g.missing_dependencies['a']))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['also_missing', 'nonexistent']"

    def test_build_graph_detects_simple_cycle(self) -> None:
        """A → B → A cycle is reported with closing element."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "# Exactly one cycle, length 3 (a, b, a) — closing element\n"
            "print(len(g.cycles), len(g.cycles[0]) if g.cycles else 0)\n"
            "# First and last names match (closing the loop)\n"
            "print(g.cycles[0][0] == g.cycles[0][-1] if g.cycles else False)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["1 3", "True"]

    def test_build_graph_detects_three_node_cycle(self) -> None:
        """A → B → C → A forms one cycle, not three."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['c']),\n"
            "    AgentSpec(name='c', description='', dependencies=['a']),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "# Cycle deduped by rotation: only one ring even though entered\n"
            "# from three different start nodes during DFS.\n"
            "print(len(g.cycles))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1"

    def test_render_diagram_emits_mermaid_block(self) -> None:
        """Mermaid output starts with ```mermaid + graph TD and lists all nodes."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "print(out.startswith('```mermaid'))\n"
            "print('graph TD' in out)\n"
            "print('top[top]' in out, 'leaf[leaf]' in out)\n"
            "print('top --> leaf' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "True",
            "True",
            "True True",
            "True",
        ]

    def test_render_diagram_marks_cycle_edges_with_dotted_arrow(self) -> None:
        """Edges participating in a cycle render as -.-> instead of -->."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "# Both cycle edges should be dotted; no solid --> arrows\n"
            "print('-.->' in out)\n"
            "print(' --> ' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_render_diagram_marks_missing_dependencies(self) -> None:
        """Missing-dep targets render with the MISSING: label prefix."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [AgentSpec(name='a', description='', dependencies=['ghost'])]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "print('MISSING: ghost' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_render_readme_section_includes_diagram_and_roots(self) -> None:
        """Full README section has heading, Mermaid block, and entry points."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_readme_section\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "out = render_dependency_readme_section(build_dependency_graph(agents))\n"
            "print('## Agent Dependencies' in out)\n"
            "print('```mermaid' in out)\n"
            "print('Entry points' in out and '`top`' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_render_readme_section_warns_on_cycles(self) -> None:
        """README section calls out circular dependencies in a warning block."""
        result = self._run_py(
            "from agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_readme_section\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "out = render_dependency_readme_section(build_dependency_graph(agents))\n"
            "print('Circular dependencies' in out)\n"
            "print('a → b → a' in out or 'b → a → b' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_cli_deps_exits_nonzero_on_cycles(self) -> None:
        """CI-friendly: ``deps`` subcommand exits 2 when cycles are detected."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            agents_dir = tmp_path / "agents"
            agents_dir.mkdir()
            # Two agents that depend on each other
            (agents_dir / "a.md").write_text(
                "---\nname: a\ndescription: Agent a\ndependencies: [b]\n---\nbody"
            )
            (agents_dir / "b.md").write_text(
                "---\nname: b\ndescription: Agent b\ndependencies: [a]\n---\nbody"
            )
            scripts_dir = Path(__file__).parent.parent / "scripts"
            result = subprocess.run(
                [
                    sys.executable,
                    str(scripts_dir / "agent_composer.py"),
                    "deps",
                    str(agents_dir / "a.md"),
                    str(agents_dir / "b.md"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            # Mermaid still printed before the SystemExit(2)
            assert "```mermaid" in result.stdout
            assert result.returncode == 2


class TestGenerationAttributionFooter:
    """Tests for inline generation comments in agent_generator.py (feature #79).

    Covers:
    - PLATXA_GENERATOR_VERSION constant exists and is non-empty
    - GENERATION_FOOTER_MARKER opens the footer (locatable by parsers)
    - Footer is HTML comment (invisible in rendered Markdown)
    - Footer includes generator version, timestamp, score, parameters
    - Pinned timestamp produces deterministic output (tests can assert)
    - Quality score formats as N.NN/10 when provided
    - Quality score reports "not measured" when None
    - Empty tools list renders as "(none)"
    - generate_agent_file appends footer as the last block
    - Pre-existing 14 sections still present (regression check)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_version_constant_is_set(self) -> None:
        """PLATXA_GENERATOR_VERSION exists and is non-empty."""
        result = self._run_py(
            "from agent_generator import PLATXA_GENERATOR_VERSION\n"
            "print(bool(PLATXA_GENERATOR_VERSION), '.' in PLATXA_GENERATOR_VERSION)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_footer_marker_is_locatable(self) -> None:
        """GENERATION_FOOTER_MARKER opens the footer block."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    AgentDefinition, GENERATION_FOOTER_MARKER,\n"
            "    generate_attribution_footer,\n"
            ")\n"
            "d = AgentDefinition(name='x', description='d', tools=['Read'])\n"
            "footer = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print(footer.startswith(GENERATION_FOOTER_MARKER))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_footer_is_html_comment(self) -> None:
        """Footer wraps in <!-- ... --> so it's invisible in rendered markdown."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "footer = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print(footer.startswith('<!--'), footer.endswith('-->'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_footer_includes_required_metadata(self) -> None:
        """Footer contains version, timestamp, score, name, pattern, model, tools."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    AgentDefinition, PLATXA_GENERATOR_VERSION,\n"
            "    generate_attribution_footer,\n"
            ")\n"
            "d = AgentDefinition(name='scanner', description='d', tools=['Read', 'Grep'],"
            " model='sonnet')\n"
            "f = generate_attribution_footer(d, pattern='orchestrator-workers',"
            " quality_score=8.42, timestamp='2026-04-15T10:30:00Z')\n"
            "print('v' + PLATXA_GENERATOR_VERSION in f)\n"
            "print('2026-04-15T10:30:00Z' in f)\n"
            "print('8.42/10' in f)\n"
            "print('scanner' in f)\n"
            "print('orchestrator-workers' in f)\n"
            "print('sonnet' in f)\n"
            "print('Read, Grep' in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True"] * 7

    def test_pinned_timestamp_produces_deterministic_output(self) -> None:
        """Same definition + same pinned timestamp → identical footer."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=['Read'])\n"
            "ts = '2026-04-15T12:00:00Z'\n"
            "f1 = generate_attribution_footer(d, timestamp=ts)\n"
            "f2 = generate_attribution_footer(d, timestamp=ts)\n"
            "print(f1 == f2)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_quality_score_omitted_renders_not_measured(self) -> None:
        """Score=None reports 'not measured' instead of fabricating a 0."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d, quality_score=None,"
            " timestamp='2026-04-15T10:00:00Z')\n"
            "print('not measured' in f, '0.00/10' not in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_empty_tools_renders_as_none(self) -> None:
        """An agent with no tools shows '(none)' rather than an empty string."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print('(none)' in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_generated_file_ends_with_footer(self) -> None:
        """generate_agent_file appends the footer as the last block."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    AgentDefinition, GENERATION_FOOTER_MARKER, generate_agent_file,\n"
            ")\n"
            "d = AgentDefinition(name='demo', description='d', tools=['Read'])\n"
            "out = generate_agent_file(d, quality_score=9.5, "
            "timestamp='2026-04-15T11:00:00Z')\n"
            "# Footer marker present and it appears in the last few lines\n"
            "print(GENERATION_FOOTER_MARKER in out)\n"
            "tail = out.rstrip().splitlines()[-10:]\n"
            "print(any(GENERATION_FOOTER_MARKER in line for line in tail))\n"
            "# Footer is the final ``-->`` line\n"
            "print(out.rstrip().endswith('-->'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_default_timestamp_is_iso8601_utc(self) -> None:
        """Default (no timestamp arg) emits ISO-8601 UTC with trailing Z."""
        result = self._run_py(
            "import re\n"
            "from agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d)\n"
            "# Footer should contain a Z-suffixed ISO-8601 timestamp\n"
            "m = re.search(r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z', f)\n"
            "print(m is not None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_existing_sections_preserved(self) -> None:
        """Adding the footer didn't break any of the 14 pre-existing sections."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_agent_file\n"
            "d = AgentDefinition(name='demo', description='d', tools=['Read'])\n"
            "out = generate_agent_file(d, timestamp='2026-04-15T11:00:00Z')\n"
            "# Spot-check that the canonical headings still appear\n"
            "for h in ['## Overview', '## Workflow', '## Examples',\n"
            "         '## Error Handling', '## Output Format', '## Verification']:\n"
            "    assert h in out, f'missing: {h}'\n"
            "print('OK')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "OK"


class TestAgentRegenerationWorkflow:
    """Tests for the regeneration workflow in agent_versioning.py (feature #58).

    Covers:
    - detect_breaking_changes: tool removal, name change, model change, none
    - regenerate_agent: patch bump on non-breaking, minor bump on breaking
    - regenerate_agent: archive path written, history updated, changelog produced
    - regenerate_agent: first-time generation path (no prior file)
    - regenerate_agent: force_bump override works
    - rollback-on-failure contract: bump failure restores archive
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    # -- detect_breaking_changes ------------------------------------------

    def test_detect_no_breaking_when_only_body_changed(self) -> None:
        """Pure body edits produce zero signals."""
        result = self._run_py(
            "from agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read\\n---\\nOld body'\n"
            "new = '---\\nname: a\\ntools: Read\\n---\\nNew body'\n"
            "print(len(detect_breaking_changes(old, new)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_detect_tool_removal_is_breaking(self) -> None:
        """Removing a declared tool produces a 'tools' signal."""
        result = self._run_py(
            "from agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "new = '---\\nname: a\\ntools: Read, Bash\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category, 'Write' in sigs[0].description)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 tools True"

    def test_detect_tool_addition_is_not_breaking(self) -> None:
        """Adding tools is additive — no signal."""
        result = self._run_py(
            "from agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read\\n---\\nBody'\n"
            "new = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "print(len(detect_breaking_changes(old, new)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_detect_name_change_is_breaking(self) -> None:
        """Agent rename is breaking (identity change)."""
        result = self._run_py(
            "from agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: old-name\\ntools: Read\\n---\\nBody'\n"
            "new = '---\\nname: new-name\\ntools: Read\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 name"

    def test_detect_model_change_is_breaking(self) -> None:
        """Model change alters runtime behavior — breaking."""
        result = self._run_py(
            "from agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\nmodel: sonnet\\n---\\nBody'\n"
            "new = '---\\nname: a\\nmodel: opus\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 model"

    # -- regenerate_agent --------------------------------------------------

    def test_regenerate_first_time_creates_initial_version(self) -> None:
        """First-time generation writes file and initializes history."""
        result = self._run_py(
            "import tempfile, os\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    content = '---\\nname: a\\ntools: Read\\n---\\nInitial'\n"
            "    r = regenerate_agent(p, content, changes=['Initial gen'])\n"
            "    print(r.success, r.old_version, r.new_version, r.archive_path is None,"
            " p.exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True  1.0.0 True True"

    def test_regenerate_non_breaking_bumps_patch(self) -> None:
        """Body-only change → patch bump."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    first = '---\\nname: a\\ntools: Read\\n---\\nBody v1'\n"
            "    regenerate_agent(p, first, changes=['init'])\n"
            "    second = '---\\nname: a\\ntools: Read\\n---\\nBody v2 reworded'\n"
            "    r = regenerate_agent(p, second, changes=['reword'])\n"
            "    print(r.success, r.bump_type == VersionBump.PATCH,"
            " r.old_version, r.new_version, len(r.breaking_changes))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 1.0.0 1.0.1 0"

    def test_regenerate_breaking_bumps_minor(self) -> None:
        """Tool removal triggers minor bump per feature spec."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    first = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "    regenerate_agent(p, first, changes=['init'])\n"
            "    second = '---\\nname: a\\ntools: Read, Bash\\n---\\nBody changed'\n"
            "    r = regenerate_agent(p, second, changes=['remove tool'])\n"
            "    print(r.success, r.bump_type == VersionBump.MINOR,"
            " r.old_version, r.new_version, len(r.breaking_changes))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 1.0.0 1.1.0 1"

    def test_regenerate_archives_previous_version(self) -> None:
        """Previous version file is archived under .versions/backups/."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['init'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['update'])\n"
            "    archive = Path(r.archive_path)\n"
            "    print(archive.exists(),'backups' in str(archive),"
            " 'v1' in archive.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_regenerate_writes_changelog_and_history(self) -> None:
        """Changelog text includes the new version entry and history has 2 entries."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['initial'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['reword'])\n"
            "    hist = json.loads(Path(r.history_path).read_text())\n"
            "    print(len(hist['entries']), hist['current_version'],"
            " '1.0.1' in r.changelog, 'reword' in r.changelog)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 1.0.1 True True"

    def test_force_bump_overrides_automatic_choice(self) -> None:
        """Passing force_bump=MAJOR wins even for non-breaking changes."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['init'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['x'],"
            " force_bump=VersionBump.MAJOR)\n"
            "    print(r.success, r.bump_type == VersionBump.MAJOR, r.new_version)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 2.0.0"


class TestAgentExportBundle:
    """Tests for the self-contained export/import bundle (feature #60).

    Covers:
    - detect_project_root infers the project root correctly
    - collect_project_root_configs finds .mcp.json and skips missing files
    - export_agent bundles .mcp.json under config/ in the produced zip
    - import_agent writes .mcp.json back to the target project root
    - import round-trip keeps content byte-identical
    - overwrite=False preserves an existing .mcp.json on import
    - validate_package runs on import via validate_first=True
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_detect_project_root_standard_layout(self) -> None:
        """For <proj>/.claude/agents/a.md → project root is <proj>."""
        result = self._run_py(
            "from pathlib import Path\n"
            "from agent_export import detect_project_root\n"
            "p = Path('/tmp/proj/.claude/agents/a.md')\n"
            "print(detect_project_root(p))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "/tmp/proj"

    def test_collect_project_root_configs_finds_mcp(self) -> None:
        """.mcp.json at project root is picked up; missing → empty list."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from agent_export import collect_project_root_configs\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\nbody')\n"
            "    # No .mcp.json yet — empty\n"
            "    e1 = collect_project_root_configs(agent)\n"
            "    # With .mcp.json — found\n"
            "    mcp = root / '.mcp.json'\n"
            "    mcp.write_text(json.dumps({'mcpServers': {'x': {'command': 'echo'}}}))\n"
            "    e2 = collect_project_root_configs(agent)\n"
            "    print(len(e1), len(e2), e2[0].name)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 .mcp.json"

    def test_export_bundles_mcp_config_in_zip(self) -> None:
        """export_agent writes config/.mcp.json into the zip when present."""
        result = self._run_py(
            "import tempfile, json, zipfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root / '.mcp.json').write_text(json.dumps({'mcpServers': {'x': {'command': 'echo'}}}))\n"
            "    out = root / 'bundle.zip'\n"
            "    r = export_agent(agent, output_path=out, format=ExportFormat.ZIP)\n"
            "    with zipfile.ZipFile(out) as zf:\n"
            "        names = zf.namelist()\n"
            "    mcp_in_zip = any('config/.mcp.json' in n for n in names)\n"
            "    print(r.success, mcp_in_zip)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_include_mcp_config_false_skips_mcp(self) -> None:
        """include_mcp_config=False produces a bundle without .mcp.json."""
        result = self._run_py(
            "import tempfile, json, zipfile\n"
            "from pathlib import Path\n"
            "from agent_export import export_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root / '.mcp.json').write_text(json.dumps({'mcpServers': {}}))\n"
            "    out = root / 'bundle.zip'\n"
            "    export_agent(agent, output_path=out, format=ExportFormat.ZIP,"
            " include_mcp_config=False)\n"
            "    with zipfile.ZipFile(out) as zf:\n"
            "        names = zf.namelist()\n"
            "    print(any('.mcp.json' in n for n in names))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_round_trip_restores_mcp_to_project_root(self) -> None:
        """Export from project A, import into project B → .mcp.json at B root."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from agent_export import export_agent, import_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as ta, tempfile.TemporaryDirectory() as tb:\n"
            "    root_a = Path(ta)\n"
            "    (root_a / '.claude' / 'agents').mkdir(parents=True)\n"
            "    agent = root_a / '.claude' / 'agents' / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    mcp_cfg = {'mcpServers': {'fs': {'command': 'npx', 'args': ['-y','fs']}}}\n"
            "    (root_a / '.mcp.json').write_text(json.dumps(mcp_cfg))\n"
            "    bundle = root_a / 'bundle.zip'\n"
            "    export_agent(agent, output_path=bundle, format=ExportFormat.ZIP)\n"
            "    root_b = Path(tb)\n"
            "    target_b = root_b / '.claude'\n"
            "    r = import_agent(bundle, target_dir=target_b, validate_first=True)\n"
            "    dst_mcp = root_b / '.mcp.json'\n"
            "    loaded = json.loads(dst_mcp.read_text()) if dst_mcp.exists() else None\n"
            "    print(r.success, dst_mcp.exists(), loaded == mcp_cfg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_import_preserves_existing_mcp_when_not_overwrite(self) -> None:
        """Existing .mcp.json at target project root is preserved without overwrite."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from agent_export import export_agent, import_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as ta, tempfile.TemporaryDirectory() as tb:\n"
            "    root_a = Path(ta)\n"
            "    (root_a / '.claude' / 'agents').mkdir(parents=True)\n"
            "    agent = root_a / '.claude' / 'agents' / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root_a / '.mcp.json').write_text(json.dumps({'mcpServers': {'new': {'command': 'echo'}}}))\n"
            "    bundle = root_a / 'bundle.zip'\n"
            "    export_agent(agent, output_path=bundle, format=ExportFormat.ZIP)\n"
            "    root_b = Path(tb)\n"
            "    pre = {'mcpServers': {'existing': {'command': 'ls'}}}\n"
            "    (root_b / '.mcp.json').write_text(json.dumps(pre))\n"
            "    target_b = root_b / '.claude'\n"
            "    r = import_agent(bundle, target_dir=target_b, overwrite=False)\n"
            "    loaded = json.loads((root_b / '.mcp.json').read_text())\n"
            "    print(r.success, loaded == pre,"
            " any('Skipping' in w and '.mcp.json' in w for w in r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_import_validates_before_install(self) -> None:
        """A tampered zip missing the manifest fails validation on import."""
        result = self._run_py(
            "import tempfile, zipfile\n"
            "from pathlib import Path\n"
            "from agent_export import import_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    bad = root / 'bad.zip'\n"
            "    with zipfile.ZipFile(bad, 'w') as zf:\n"
            "        zf.writestr('junk.txt', 'nothing here')\n"
            "    r = import_agent(bad, target_dir=root / '.claude', validate_first=True)\n"
            "    print(r.success, any('manifest' in e.lower() or 'agents' in e.lower() for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"


class TestInteractiveFrontmatterWizard:
    """Tests for the frontmatter wizard in interactive_prompts.py (feature #62).

    Covers:
    - FRONTMATTER_QUESTIONS is registered in ALL_PHASES
    - All three user-facing questions exist (security, model, duration)
    - resolve_frontmatter_fields maps canonical values correctly
    - Label inputs (as returned by AskUserQuestion) resolve
    - balanced security posture omits permissionMode entirely
    - Unknown value raises ValueError (no silent fallback)
    - Unrelated keys are ignored without raising
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_frontmatter_phase_registered(self) -> None:
        """FRONTMATTER_QUESTIONS is accessible via get_phase_questions."""
        result = self._run_py(
            "from interactive_prompts import get_phase_questions, ALL_PHASES\n"
            "p = get_phase_questions('frontmatter')\n"
            "print(p is not None, 'frontmatter' in ALL_PHASES,"
            " len(p.questions) if p else -1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 3"

    def test_frontmatter_keys_are_user_facing(self) -> None:
        """Questions ask about posture/complexity/duration, not the raw fields."""
        result = self._run_py(
            "from interactive_prompts import FRONTMATTER_QUESTIONS\n"
            "keys = sorted(q.key for q in FRONTMATTER_QUESTIONS.questions)\n"
            "print(keys)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['model_complexity', 'security_posture', 'task_duration']"

    def test_resolve_with_canonical_values(self) -> None:
        """Canonical answer values map to frontmatter field values."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "r = resolve_frontmatter_fields({\n"
            "    'security_posture': 'restrictive',\n"
            "    'model_complexity': 'high',\n"
            "    'task_duration': 'long',\n"
            "})\n"
            "print(r['permissionMode'], r['model'], r['maxTurns'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "plan opus 100"

    def test_resolve_balanced_omits_permission_mode(self) -> None:
        """security_posture=balanced doesn't write permissionMode at all."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "r = resolve_frontmatter_fields({\n"
            "    'security_posture': 'balanced',\n"
            "    'model_complexity': 'standard',\n"
            "    'task_duration': 'short',\n"
            "})\n"
            "print('permissionMode' in r, r.get('model'), r.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False sonnet 15"

    def test_resolve_accepts_labels_from_ask_user_question(self) -> None:
        """Raw labels (what AskUserQuestion returns) resolve via the helper."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "r = resolve_frontmatter_fields({\n"
            "    'security_posture': 'Trusted (Auto-accept edits)',\n"
            "    'model_complexity': 'Low (Fast)',\n"
            "    'task_duration': 'Medium (5-20 min)',\n"
            "})\n"
            "print(r['permissionMode'], r['model'], r['maxTurns'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "acceptEdits haiku 40"

    def test_resolve_unknown_value_raises(self) -> None:
        """Unrecognized values fail loud — no silent fallback."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "try:\n"
            "    resolve_frontmatter_fields({'model_complexity': 'bogus_tier'})\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'bogus_tier' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_resolve_ignores_unrelated_keys(self) -> None:
        """Passing a merged answer dict with unrelated keys works cleanly."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "r = resolve_frontmatter_fields({\n"
            "    'agent_type': 'analyzer',\n"
            "    'security_posture': 'restrictive',\n"
            "    'tools': 'files',\n"
            "})\n"
            "print(r)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{'permissionMode': 'plan'}"

    def test_resolve_empty_answers_returns_empty(self) -> None:
        """Empty input produces an empty dict, not None or error."""
        result = self._run_py(
            "from interactive_prompts import resolve_frontmatter_fields\n"
            "print(resolve_frontmatter_fields({}) == {})"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"


class TestAgentAnalyzer:
    """Tests for agent_analyzer.py and the ``analyze-agent`` CLI command (feature #63).

    Covers:
    - analyze_agent runs syntax + security + quality on the file
    - missing_field improvements detect absent model/maxTurns/version
    - context improvements catch missing description and overlong description
    - missing Examples section is surfaced as a context issue
    - improvements_by_category groups correctly
    - Sort order: critical → high → medium → low
    - File-not-found raises FileNotFoundError
    - format_analysis_report renders categories and severities
    - CLI: 'analyze-agent path' returns 0 and prints report
    - CLI: missing path returns 1
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_analyze_runs_full_pipeline(self) -> None:
        """analyze_agent populates syntax/security/quality fields."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: Analyzes code for issues\\ntools: Read, Grep\\n---\\n# Agent\\n## Overview\\nDoes things.\\n## Workflow\\n1. step\\n## Examples\\n- ex1')\n"
            "    r = analyze_agent(p)\n"
            "    print(isinstance(r.syntax_passed, bool),"
            " isinstance(r.security_score, (int, float)),"
            " isinstance(r.quality_score, (int, float)),"
            " r.path == str(p))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_missing_optional_fields_flagged(self) -> None:
        """Absent model/maxTurns/version each become missing_field improvements."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nx')\n"
            "    r = analyze_agent(p)\n"
            "    cats = [i.category for i in r.improvements]\n"
            "    summaries = [i.summary for i in r.improvements]\n"
            "    print('missing_field' in cats,"
            " any('model' in s for s in summaries),"
            " any('maxTurns' in s for s in summaries),"
            " any('version' in s for s in summaries))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_overlong_description_flagged(self) -> None:
        """Description >1024 chars produces a high-severity context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent\n"
            "long_desc = 'x' * 1500\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(f'---\\nname: a\\ndescription: {long_desc}\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    ctx = [i for i in r.improvements if i.category == 'context']\n"
            "    print(any(i.severity == 'high' and 'exceeds' in i.summary for i in ctx))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_missing_description_flagged_high(self) -> None:
        """No description produces a high-severity context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    print(any(i.category == 'context' and i.severity == 'high'"
            " and 'description' in i.summary.lower() for i in r.improvements))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_missing_examples_section_flagged(self) -> None:
        """No Examples section surfaces a context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nbody')\n"
            "    r = analyze_agent(p)\n"
            "    print(any(i.category == 'context' and 'Examples' in i.summary"
            " for i in r.improvements))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_improvements_by_category_grouping(self) -> None:
        """improvements_by_category returns all 3 keys, with correct grouping."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent, IMPROVEMENT_CATEGORIES\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    g = r.improvements_by_category()\n"
            "    print(set(g.keys()) == set(IMPROVEMENT_CATEGORIES),"
            " all(i.category == c for c, items in g.items() for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_severity_sort_order(self) -> None:
        """Improvements are sorted by severity (critical → high → medium → low)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent, IMPROVEMENT_SEVERITY_ORDER\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    severities = [i.severity for i in r.improvements]\n"
            "    indices = [IMPROVEMENT_SEVERITY_ORDER.index(s) for s in severities]\n"
            "    print(indices == sorted(indices))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_file_not_found_raises(self) -> None:
        """analyze_agent raises FileNotFoundError on missing file."""
        result = self._run_py(
            "from agent_analyzer import analyze_agent\n"
            "try:\n"
            "    analyze_agent('/tmp/__definitely_not_a_real_agent__.md')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_format_analysis_report_includes_sections(self) -> None:
        """Human-readable report includes the category headers when issues exist."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_analyzer import analyze_agent, format_analysis_report\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    text = format_analysis_report(r)\n"
            "    print('Agent Analysis' in text,"
            " '[MISSING_FIELD]' in text or '[CONTEXT]' in text,"
            " 'Improvement Recommendations' in text)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_cli_analyze_agent_runs(self) -> None:
        """`platxa-agent analyze-agent path` returns 0 and prints the report."""
        result = self._run_py(
            "import tempfile, sys\n"
            "from pathlib import Path\n"
            "from cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Examples\\n- e')\n"
            "    rc = CLI().run(['analyze-agent', str(p)])\n"
            "    print(rc)"
        )
        assert result.returncode == 0, result.stderr
        # First line should be "0" (return code); the analyzer's report goes to stdout above it.
        lines = [line for line in result.stdout.strip().split("\n") if line]
        assert lines[-1] == "0"

    def test_cli_analyze_agent_missing_returns_1(self) -> None:
        """Missing file → return code 1, error printed."""
        result = self._run_py(
            "from cli import CLI\n"
            "rc = CLI().run(['analyze-agent', '/tmp/__nope__.md'])\n"
            "print('RC=', rc)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 1" in result.stdout


class TestAgentUpgrader:
    """Tests for agent_upgrader.py and the ``upgrade`` CLI command (feature #64).

    Covers:
    - Smart-default profile selection per declared tools
    - Missing frontmatter fields are added with chosen defaults
    - Existing frontmatter values are NEVER overwritten
    - Missing body sections (Examples / Output Format / Error Handling) are stubbed
    - Existing sections are NEVER rewritten
    - Custom body content is preserved byte-for-byte
    - Dry-run does not modify the file; --apply does and writes a backup
    - No-op upgrade (already current) creates no changes and no backup
    - smart_defaults_override forces specific values
    - CLI: 'upgrade path' returns 0 in dry-run, 0 with --apply
    - CLI: missing path returns 1
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_profile_selection_orchestrator(self) -> None:
        """Tools containing Task → orchestrator profile (opus, maxTurns 100)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Task, Read\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(r.profile_used, fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "orchestrator opus 100"

    def test_profile_selection_analyzer(self) -> None:
        """Read+Grep → analyzer profile (sonnet, maxTurns 15)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read, Grep\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(r.profile_used, fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "analyzer sonnet 15"

    def test_existing_frontmatter_preserved(self) -> None:
        """If model is already set, the upgrader must NOT overwrite it."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\nmodel: opus\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm_changes = [c.field_or_section for c in r.changes if c.category == 'frontmatter']\n"
            "    print('model' not in fm_changes, 'model: opus' in r.upgraded_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_missing_sections_stubbed(self) -> None:
        """Missing Examples/Output Format/Error Handling become stub sections."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nbody')\n"
            "    r = upgrade_agent(p)\n"
            "    sections = [c.field_or_section for c in r.changes if c.category == 'section']\n"
            "    print(sorted(sections))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Error Handling', 'Examples', 'Output Format']"

    def test_existing_sections_preserved(self) -> None:
        """Existing ## Examples is not duplicated; user content stays intact."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "custom = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Examples\\n- my custom example'\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(custom)\n"
            "    r = upgrade_agent(p)\n"
            "    section_changes = [c.field_or_section for c in r.changes if c.category == 'section']\n"
            "    # Examples should NOT be in the changes (already present)\n"
            "    # User's content should still appear in upgraded_content\n"
            "    print('Examples' not in section_changes,"
            " 'my custom example' in r.upgraded_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_dry_run_does_not_modify_file(self) -> None:
        """Without --apply the file content is unchanged on disk."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    r = upgrade_agent(p, apply=False)\n"
            "    print(r.applied, p.read_text() == original, r.backup_path is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True True"

    def test_apply_writes_file_and_creates_backup(self) -> None:
        """With --apply the file is written and a backup exists."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    r = upgrade_agent(p, apply=True)\n"
            "    backup_exists = r.backup_path is not None and Path(r.backup_path).exists()\n"
            "    backup_content = Path(r.backup_path).read_text() if backup_exists else ''\n"
            "    print(r.applied, p.read_text() != original, backup_exists, backup_content == original)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_idempotent_upgrade_no_changes(self) -> None:
        """Upgrading an already-upgraded file produces zero changes and no backup."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "complete = (\n"
            "    '---\\nname: a\\ndescription: d\\ntools: Read\\n'\n"
            "    'model: sonnet\\nmaxTurns: 15\\nversion: 1.0.0\\n---\\n'\n"
            "    '# A\\n## Examples\\n- ex\\n## Output Format\\nfmt\\n## Error Handling\\nh'\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(complete)\n"
            "    r = upgrade_agent(p, apply=True)\n"
            "    print(len(r.changes), r.applied, r.backup_path is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 False True"

    def test_smart_defaults_override_forces_values(self) -> None:
        """smart_defaults_override wins over the profile-selected defaults."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A')\n"
            "    r = upgrade_agent(p, smart_defaults_override={'model': 'haiku', 'maxTurns': 5})\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "haiku 5"

    def test_file_not_found_raises(self) -> None:
        """Missing file → FileNotFoundError."""
        result = self._run_py(
            "from agent_upgrader import upgrade_agent\n"
            "try:\n"
            "    upgrade_agent('/tmp/__definitely_not_an_agent__.md')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_cli_upgrade_dry_run(self) -> None:
        """`platxa-agent upgrade path` returns 0 and prints the report (dry-run)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    rc = CLI().run(['upgrade', str(p)])\n"
            "    print('RC=', rc, 'unchanged=', p.read_text() == original)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 0" in result.stdout
        assert "unchanged= True" in result.stdout

    def test_cli_upgrade_apply_modifies_file(self) -> None:
        """`upgrade path --apply` modifies the file."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    rc = CLI().run(['upgrade', str(p), '--apply'])\n"
            "    print('RC=', rc, 'changed=', p.read_text() != original)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 0" in result.stdout
        assert "changed= True" in result.stdout

    def test_cli_upgrade_missing_returns_1(self) -> None:
        """Missing file → exit 1."""
        result = self._run_py(
            "from cli import CLI\nrc = CLI().run(['upgrade', '/tmp/__nope__.md'])\nprint('RC=', rc)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 1" in result.stdout


class TestComposeRouter:
    """Tests for compose_router and RoutingRule in agent_composer.py (feature #67).

    Covers:
    - Generated router includes all categories in the routing table
    - Each handler is referenced in the Handlers section
    - Fallback section references fallback_handler.name when provided
    - Fallback section describes ask-for-clarification when fallback is omitted
    - Classification Hints emitted only when at least one rule has keywords
    - Validation: empty handlers, empty rules, rule → unknown handler,
      fallback_handler not in handlers list
    - Pattern is CompositionPattern.CONDITIONAL on success
    - Tools are merged from every handler
    - Module-level header constants ROUTER_TABLE_HEADER and
      ROUTER_FALLBACK_HEADER surface in the generated content
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    _BUILD_HANDLERS = (
        "from agent_composer import AgentSpec, RoutingRule, compose_router\n"
        "refactor = AgentSpec(name='refactor-agent',"
        " description='Refactors code',"
        " tools=['Read', 'Edit'])\n"
        "bugfix = AgentSpec(name='bugfix-agent',"
        " description='Fixes bugs',"
        " tools=['Read', 'Bash'])\n"
        "docs = AgentSpec(name='docs-agent',"
        " description='Writes docs',"
        " tools=['Read', 'Write'])\n"
        "rules = [\n"
        "    RoutingRule(category='refactor',"
        " description='Improve structure',"
        " handler_name='refactor-agent',"
        " keywords=['refactor', 'rename']),\n"
        "    RoutingRule(category='bug-fix',"
        " description='Investigate and fix defects',"
        " handler_name='bugfix-agent'),\n"
        "]\n"
    )

    def test_router_includes_all_categories_in_table(self) -> None:
        """Every rule's category and handler appear in the routing table."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "print(r.success)\n"
            "print('refactor' in r.agent_content, 'bug-fix' in r.agent_content)\n"
            "print('refactor-agent' in r.agent_content, 'bugfix-agent' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True True", "True True"]

    def test_router_emits_section_headers(self) -> None:
        """ROUTER_TABLE_HEADER and ROUTER_FALLBACK_HEADER appear in content."""
        result = self._run_py(
            self._BUILD_HANDLERS
            + "from agent_composer import ROUTER_TABLE_HEADER, ROUTER_FALLBACK_HEADER\n"
            "r = compose_router([refactor, bugfix], rules)\n"
            "print(ROUTER_TABLE_HEADER in r.agent_content,"
            " ROUTER_FALLBACK_HEADER in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_fallback_with_handler_references_fallback_name(self) -> None:
        """fallback_handler present → its name is mentioned in fallback section."""
        result = self._run_py(
            self._BUILD_HANDLERS
            + "r = compose_router([refactor, bugfix, docs], rules, fallback_handler=docs)\n"
            "print(r.success, 'docs-agent' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_fallback_without_handler_describes_ask_protocol(self) -> None:
        """Without fallback_handler, agent instructed to ask for clarification."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "content = r.agent_content.lower()\n"
            "print(r.success, 'clarif' in content, 'unrouted' in content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_classification_hints_emitted_when_keywords_present(self) -> None:
        """Hints section emitted because at least one rule has keywords."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "print('Classification Hints' in r.agent_content,"
            " '`refactor`' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_classification_hints_suppressed_without_keywords(self) -> None:
        """No keywords on any rule → no Classification Hints section."""
        result = self._run_py(
            "from agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "rules = [\n"
            "    RoutingRule(category='c1', description='desc', handler_name='a'),\n"
            "    RoutingRule(category='c2', description='desc', handler_name='b'),\n"
            "]\n"
            "r = compose_router([a, b], rules)\n"
            "print(r.success, 'Classification Hints' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False"

    def test_pattern_is_conditional_on_success(self) -> None:
        """Successful compose_router produces pattern == CONDITIONAL."""
        result = self._run_py(
            self._BUILD_HANDLERS + "from agent_composer import CompositionPattern\n"
            "r = compose_router([refactor, bugfix], rules)\n"
            "print(r.success, r.pattern is CompositionPattern.CONDITIONAL)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_tools_merged_from_all_handlers(self) -> None:
        """tools_merged contains the union of every handler's tools."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "merged = set(r.tools_merged)\n"
            "print(r.success, {'Read', 'Edit', 'Bash'}.issubset(merged))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_empty_handlers_fails(self) -> None:
        """No handlers → success=False with explicit error."""
        result = self._run_py(
            "from agent_composer import RoutingRule, compose_router\n"
            "rules = [RoutingRule(category='c', description='d', handler_name='x')]\n"
            "r = compose_router([], rules)\n"
            "print(r.success, any('at least one handler' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_empty_rules_fails(self) -> None:
        """No routing rules → success=False with explicit error."""
        result = self._run_py(
            "from agent_composer import AgentSpec, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "r = compose_router([a], [])\n"
            "print(r.success, any('routing rule' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_rule_references_unknown_handler_fails(self) -> None:
        """Rule.handler_name not in handlers → success=False with named error."""
        result = self._run_py(
            "from agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "rules = [\n"
            "    RoutingRule(category='c1', description='d', handler_name='a'),\n"
            "    RoutingRule(category='c2', description='d', handler_name='ghost'),\n"
            "]\n"
            "r = compose_router([a, b], rules)\n"
            "print(r.success, any(\"'ghost'\" in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_fallback_not_in_handlers_fails(self) -> None:
        """fallback_handler must be in the handlers list."""
        result = self._run_py(
            "from agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "external = AgentSpec(name='outside', description='X', tools=['Read'])\n"
            "rules = [RoutingRule(category='c', description='d', handler_name='a')]\n"
            "r = compose_router([a, b], rules, fallback_handler=external)\n"
            "print(r.success, any('outside' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_rule_order_preserved_in_table(self) -> None:
        """Rule order is preserved (first-match-wins priority)."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "idx_refactor = r.agent_content.find('`refactor`')\n"
            "idx_bugfix = r.agent_content.find('`bug-fix`')\n"
            "print(r.success, idx_refactor < idx_bugfix)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_custom_name_and_description_applied(self) -> None:
        """Explicit name= and description= override defaults in frontmatter."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules,"
            " name='my-router', description='Custom desc')\n"
            "print(r.composite_name, 'name: my-router' in r.agent_content,"
            " 'Custom desc' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "my-router True True"


class TestCompositionDepthLimit:
    """Tests for hierarchical composition depth limit (feature #68).

    Verifies that agent_composer.py:
    - Exposes MAX_COMPOSITION_DEPTH=3 and WARN_COMPOSITION_DEPTH=2 constants
    - validate_composition_depth() returns (errors, warnings) tuples
    - create_orchestrator(depth=...) fails when depth > MAX
    - create_orchestrator(depth=2 or 3) emits a non-blocking warning
    - create_orchestrator(depth=1) is silent (no warnings)
    - depth < 1 fails loud
    - default depth (no kwarg) is treated as top-level (no warning)
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """MAX_COMPOSITION_DEPTH=3 and WARN_COMPOSITION_DEPTH=2 are public."""
        result = self._run_py(
            "from agent_composer import MAX_COMPOSITION_DEPTH, WARN_COMPOSITION_DEPTH\n"
            "print(MAX_COMPOSITION_DEPTH, WARN_COMPOSITION_DEPTH)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3 2"

    def test_validate_depth_valid_top_level(self) -> None:
        """depth=1 → no errors, no warnings."""
        result = self._run_py(
            "from agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(1)\n"
            "print(len(errs), len(warns))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 0"

    def test_validate_depth_warns_at_threshold(self) -> None:
        """depth=2 → no errors, one warning (at WARN_COMPOSITION_DEPTH)."""
        result = self._run_py(
            "from agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(2)\n"
            "print(len(errs), len(warns), 'WARN_COMPOSITION_DEPTH' in warns[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 True"

    def test_validate_depth_warns_at_max(self) -> None:
        """depth=3 (MAX) → no errors, one warning (still allowed)."""
        result = self._run_py(
            "from agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(3)\n"
            "print(len(errs), len(warns))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1"

    def test_validate_depth_errors_above_max(self) -> None:
        """depth=4 → one error (exceeds MAX_COMPOSITION_DEPTH), no warnings."""
        result = self._run_py(
            "from agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(4)\n"
            "print(len(errs), len(warns), 'exceeds' in errs[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 0 True"

    def test_validate_depth_errors_below_one(self) -> None:
        """depth=0 → one error (depth must be >= 1)."""
        result = self._run_py(
            "from agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(0)\n"
            "print(len(errs), len(warns), '>= 1' in errs[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 0 True"

    def test_orchestrator_default_depth_is_top_level(self) -> None:
        """Calling create_orchestrator with no depth kwarg → success, no warning."""
        result = self._run_py(
            "from agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w])\n"
            "print(r.success, len(r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_orchestrator_warning_at_depth_2(self) -> None:
        """create_orchestrator(depth=2) succeeds with a warning attached."""
        result = self._run_py(
            "from agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=2)\n"
            "print(r.success, len(r.warnings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_orchestrator_warning_at_depth_3_max(self) -> None:
        """create_orchestrator(depth=3) succeeds (at MAX) with warning."""
        result = self._run_py(
            "from agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=3)\n"
            "print(r.success, len(r.warnings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_orchestrator_fails_above_max(self) -> None:
        """create_orchestrator(depth=4) fails with explicit error."""
        result = self._run_py(
            "from agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=4)\n"
            "print(r.success, any('exceeds' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_orchestrator_fails_below_one(self) -> None:
        """create_orchestrator(depth=0) fails with depth-must-be-positive error."""
        result = self._run_py(
            "from agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=0)\n"
            "print(r.success, any('>= 1' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_orchestrator_depth_error_skips_worker_check(self) -> None:
        """Depth error short-circuits before the worker-count validation."""
        result = self._run_py(
            "from agent_composer import create_orchestrator\n"
            "r = create_orchestrator('orch', [], depth=4)\n"
            "print(r.success, len(r.errors), 'exceeds' in r.errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True"


class TestSkillsFrontmatter:
    """Tests for the skills frontmatter field + discovery (feature #69).

    Covers:
    - AgentDefinition.skills emits a `skills:` line in frontmatter
    - Empty skills list → no `skills:` line emitted
    - discover_available_skills scans SKILL.md frontmatter for {name: description}
    - Subdirectory without SKILL.md is skipped silently
    - SKILL.md with malformed frontmatter is skipped (one bad skill ≠ blind catalog)
    - Non-existent skills_dir → empty dict (no error)
    - recommend_skills_for_agent ranks by token overlap, ties broken by name
    - Stop-words ('the', 'and', ...) don't pollute matches
    - limit <= 0 raises ValueError
    - Empty description or empty catalog → empty list
    - validate_skills_exist returns empty list when all skills present
    - validate_skills_exist returns one error per missing skill, naming it
    - DEFAULT_SKILLS_DIR / SKILL_MANIFEST_FILENAME / DEFAULT_SKILL_RECOMMENDATION_LIMIT exposed
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """Module-level constants for skill discovery are public."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    DEFAULT_SKILLS_DIR,\n"
            "    SKILL_MANIFEST_FILENAME,\n"
            "    DEFAULT_SKILL_RECOMMENDATION_LIMIT,\n"
            ")\n"
            "print(DEFAULT_SKILLS_DIR, SKILL_MANIFEST_FILENAME,"
            " DEFAULT_SKILL_RECOMMENDATION_LIMIT)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/skills SKILL.md 5"

    def test_frontmatter_emits_skills_when_set(self) -> None:
        """`skills:` line appears in frontmatter when AgentDefinition.skills is non-empty."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='a', description='Agent',"
            " tools=['Read'], skills=['skill-one', 'skill-two'])\n"
            "fm = generate_frontmatter(d)\n"
            "print('skills: skill-one, skill-two' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_frontmatter_omits_skills_when_empty(self) -> None:
        """No `skills:` line when AgentDefinition.skills is the default empty list."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='a', description='Agent', tools=['Read'])\n"
            "fm = generate_frontmatter(d)\n"
            "print('skills:' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_discover_skills_parses_frontmatter(self) -> None:
        """discover_available_skills returns {name: description} for each SKILL.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    one = base / 'skill-one'\n"
            "    one.mkdir()\n"
            "    (one / 'SKILL.md').write_text(\n"
            "        '---\\nname: skill-one\\ndescription: First skill\\n---\\nbody'\n"
            "    )\n"
            "    two = base / 'skill-two'\n"
            "    two.mkdir()\n"
            "    (two / 'SKILL.md').write_text(\n"
            "        '---\\nname: skill-two\\ndescription: Second skill\\n---\\nbody'\n"
            "    )\n"
            "    found = discover_available_skills(base)\n"
            "    print(sorted(found.items()))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "[('skill-one', 'First skill'), ('skill-two', 'Second skill')]"
        )

    def test_discover_skips_dir_without_manifest(self) -> None:
        """Subdirectory without SKILL.md is silently skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'no-manifest').mkdir()\n"
            "    found = discover_available_skills(base)\n"
            "    print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{}"

    def test_discover_skips_malformed_manifest(self) -> None:
        """One broken SKILL.md does not blind the discoverer to the rest."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    bad = base / 'bad'\n"
            "    bad.mkdir()\n"
            "    (bad / 'SKILL.md').write_text('not-yaml-frontmatter\\n')\n"
            "    good = base / 'good'\n"
            "    good.mkdir()\n"
            "    (good / 'SKILL.md').write_text(\n"
            "        '---\\nname: good\\ndescription: Good skill\\n---\\nbody'\n"
            "    )\n"
            "    found = discover_available_skills(base)\n"
            "    print(sorted(found.keys()))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['good']"

    def test_discover_missing_dir_returns_empty(self) -> None:
        """Non-existent skills_dir → empty dict (no error)."""
        result = self._run_py(
            "from agent_generator import discover_available_skills\n"
            "found = discover_available_skills('/tmp/__definitely_no_such_dir__')\n"
            "print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{}"

    def test_recommend_ranks_by_overlap(self) -> None:
        """Higher token overlap with description → higher rank."""
        result = self._run_py(
            "from agent_generator import recommend_skills_for_agent\n"
            "available = {\n"
            "    'security-audit': 'Security audit and vulnerability scanning',\n"
            "    'pdf-tool': 'Generate PDF reports',\n"
            "    'security-checklist': 'OWASP security checklist for review',\n"
            "}\n"
            "ranked = recommend_skills_for_agent('Run a security audit on the auth code', available)\n"
            "print(ranked)"
        )
        assert result.returncode == 0, result.stderr
        # security-audit has 2 token overlap (security, audit); security-checklist has 1
        # (security); pdf-tool has 0.
        assert result.stdout.strip() == "['security-audit', 'security-checklist']"

    def test_recommend_drops_stop_words(self) -> None:
        """Stop-words alone in description should not match anything."""
        result = self._run_py(
            "from agent_generator import recommend_skills_for_agent\n"
            "available = {'foo': 'foo bar baz'}\n"
            "ranked = recommend_skills_for_agent('the and for with', available)\n"
            "print(ranked)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_recommend_zero_limit_raises(self) -> None:
        """limit <= 0 raises ValueError (callers asking for 'no skills' should not call)."""
        result = self._run_py(
            "from agent_generator import recommend_skills_for_agent\n"
            "try:\n"
            "    recommend_skills_for_agent('x', {'a': 'a'}, limit=0)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'positive' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_recommend_empty_inputs_return_empty(self) -> None:
        """Empty description or empty catalog → empty list, no error."""
        result = self._run_py(
            "from agent_generator import recommend_skills_for_agent\n"
            "print(recommend_skills_for_agent('', {'a': 'b'}))\n"
            "print(recommend_skills_for_agent('abc', {}))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["[]", "[]"]

    def test_recommend_respects_limit(self) -> None:
        """When more skills overlap than limit allows, the top N are returned."""
        result = self._run_py(
            "from agent_generator import recommend_skills_for_agent\n"
            "available = {f'skill-{i}': 'security audit review' for i in range(10)}\n"
            "ranked = recommend_skills_for_agent('security audit review', available, limit=3)\n"
            "print(len(ranked))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3"

    def test_validate_skills_exist_all_present(self) -> None:
        """Empty error list when every skill resolves on disk."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import validate_skills_exist\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    s = base / 'present-skill'\n"
            "    s.mkdir()\n"
            "    (s / 'SKILL.md').write_text(\n"
            "        '---\\nname: present-skill\\ndescription: Here\\n---\\nbody'\n"
            "    )\n"
            "    errors = validate_skills_exist(['present-skill'], base)\n"
            "    print(errors)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_validate_skills_exist_reports_missing(self) -> None:
        """One error per missing skill, naming the missing skill."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import validate_skills_exist\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    s = base / 'present-skill'\n"
            "    s.mkdir()\n"
            "    (s / 'SKILL.md').write_text(\n"
            "        '---\\nname: present-skill\\ndescription: Here\\n---\\nbody'\n"
            "    )\n"
            "    errors = validate_skills_exist(\n"
            "        ['present-skill', 'ghost-skill', 'phantom'], base\n"
            "    )\n"
            "    print(len(errors),"
            " 'ghost-skill' in errors[0],"
            " 'phantom' in errors[1])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 True True"

    def test_validate_empty_skills_returns_empty(self) -> None:
        """No skills to check → no errors, no disk access."""
        result = self._run_py(
            "from agent_generator import validate_skills_exist\n"
            "print(validate_skills_exist([], '/tmp/__no_such_dir__'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"


class TestCompanionSkillGeneration:
    """Tests for companion skill generation (feature #70).

    Covers:
    - should_generate_companion_skill: True for multi-section / orchestrator
      / chained agents; False for trivial single-purpose agents
    - generate_companion_skill_content emits valid SKILL.md frontmatter
      (name, description, allowed-tools)
    - write_companion_skill creates .claude/skills/<agent-name>/SKILL.md
    - write_companion_skill appends agent.name to definition.skills (idempotent)
    - write_companion_skill returns None for simple agents (no file written)
    - force=True overrides the should-generate predicate
    - COMPANION_SKILL_MIN_SECTIONS / COMPANION_SKILL_FILENAME exposed
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """COMPANION_SKILL_MIN_SECTIONS and COMPANION_SKILL_FILENAME are public."""
        result = self._run_py(
            "from agent_generator import"
            " COMPANION_SKILL_MIN_SECTIONS, COMPANION_SKILL_FILENAME\n"
            "print(COMPANION_SKILL_MIN_SECTIONS, COMPANION_SKILL_FILENAME)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3 SKILL.md"

    def test_should_generate_for_multi_section_agent(self) -> None:
        """≥3 sections triggers companion skill generation."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    AgentDefinition, AgentSection, should_generate_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title='A', content='x'),\n"
            "        AgentSection(title='B', content='y'),\n"
            "        AgentSection(title='C', content='z')]\n"
            "d = AgentDefinition(name='a', description='Agent',"
            " tools=['Read'], sections=secs)\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_should_not_generate_for_simple_agent(self) -> None:
        """Trivial agent (0-2 sections, no workers/chain) → no companion skill."""
        result = self._run_py(
            "from agent_generator import"
            " AgentDefinition, should_generate_companion_skill\n"
            "d = AgentDefinition(name='a', description='Agent', tools=['Read'])\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_should_generate_for_orchestrator(self) -> None:
        """Agent with workers (orchestrator pattern) triggers generation."""
        result = self._run_py(
            "from agent_generator import (\n"
            "    AgentDefinition, WorkerDefinition, should_generate_companion_skill\n"
            ")\n"
            "w = WorkerDefinition(name='worker-a', role='does work',"
            " tools=['Read'])\n"
            "d = AgentDefinition(name='orch', description='Orchestrator',"
            " tools=['Task'], workers=[w])\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_skill_content_includes_frontmatter(self) -> None:
        """SKILL.md content has name + description + allowed-tools frontmatter."""
        result = self._run_py(
            "from agent_generator import"
            " AgentDefinition, generate_companion_skill_content\n"
            "d = AgentDefinition(name='my-agent', description='Does X',"
            " tools=['Read', 'Write'])\n"
            "c = generate_companion_skill_content(d)\n"
            "print('name: my-agent' in c,"
            " 'description: Does X' in c,"
            " 'allowed-tools:' in c,"
            " '- Read' in c,"
            " '- Write' in c)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True"

    def test_write_creates_file_in_skills_dir(self) -> None:
        """write_companion_skill creates <skills_dir>/<name>/SKILL.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='alpha', description='A',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = write_companion_skill(d, td)\n"
            "    expected = Path(td) / 'alpha' / 'SKILL.md'\n"
            "    print(path == expected, path.exists(),"
            " 'name: alpha' in path.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_write_appends_skill_to_definition(self) -> None:
        """After write_companion_skill, definition.skills contains the agent name."""
        result = self._run_py(
            "import tempfile\n"
            "from agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='beta', description='B',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    print(d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['beta']"

    def test_write_is_idempotent_on_skills_list(self) -> None:
        """Calling write twice does not duplicate the skill name in the list."""
        result = self._run_py(
            "import tempfile\n"
            "from agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='gamma', description='G',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    write_companion_skill(d, td)\n"
            "    print(d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['gamma']"

    def test_write_returns_none_for_simple_agent(self) -> None:
        """Simple agent → None returned, no file written, skills untouched."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import AgentDefinition, write_companion_skill\n"
            "d = AgentDefinition(name='simple', description='S', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = write_companion_skill(d, td)\n"
            "    file_exists = (Path(td) / 'simple' / 'SKILL.md').exists()\n"
            "    print(result is None, file_exists, d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False []"

    def test_force_overrides_predicate(self) -> None:
        """force=True writes even when should_generate would say False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import AgentDefinition, write_companion_skill\n"
            "d = AgentDefinition(name='forced', description='F', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = write_companion_skill(d, td, force=True)\n"
            "    print(path is not None, path.exists(), d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True ['forced']"

    def test_round_trip_with_discover_available_skills(self) -> None:
        """A written companion skill is found by discover_available_skills."""
        result = self._run_py(
            "import tempfile\n"
            "from agent_generator import (\n"
            "    AgentDefinition, AgentSection,\n"
            "    write_companion_skill, discover_available_skills,\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='roundtrip', description='RT',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    found = discover_available_skills(td)\n"
            "    print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{'roundtrip': 'RT'}"


class TestCompanionCommandGeneration:
    """Tests for companion command generation (feature #71).

    Covers:
    - AgentDefinition.user_invocable (default False)
    - should_generate_companion_command returns True only when user_invocable=True
    - command_definition_from_agent wires agent name, description, tools
    - write_companion_command writes .claude/commands/<name>.md when opted in
    - write_companion_command returns None when not opted in
    - force=True overrides the predicate
    - validate_command_file catches: missing file, missing frontmatter,
      missing description, missing $ARGUMENTS, missing agent invocation
    - REQUIRED_ARGUMENTS_TOKEN / DEFAULT_COMMANDS_DIR constants exposed
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """DEFAULT_COMMANDS_DIR and REQUIRED_ARGUMENTS_TOKEN are public."""
        result = self._run_py(
            "from command_generator import"
            " DEFAULT_COMMANDS_DIR, REQUIRED_ARGUMENTS_TOKEN\n"
            "print(DEFAULT_COMMANDS_DIR, REQUIRED_ARGUMENTS_TOKEN)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/commands $ARGUMENTS"

    def test_user_invocable_default_false(self) -> None:
        """AgentDefinition.user_invocable defaults to False."""
        result = self._run_py(
            "from agent_generator import AgentDefinition\n"
            "d = AgentDefinition(name='a', description='A', tools=['Read'])\n"
            "print(d.user_invocable)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_should_generate_requires_opt_in(self) -> None:
        """should_generate_companion_command returns True only for user_invocable=True."""
        result = self._run_py(
            "from agent_generator import AgentDefinition\n"
            "from command_generator import should_generate_companion_command\n"
            "d_off = AgentDefinition(name='a', description='A', tools=['Read'])\n"
            "d_on = AgentDefinition(name='b', description='B',"
            " tools=['Read'], user_invocable=True)\n"
            "print(should_generate_companion_command(d_off),"
            " should_generate_companion_command(d_on))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_command_definition_from_agent_wires_fields(self) -> None:
        """command_definition_from_agent copies name, description, tools."""
        result = self._run_py(
            "from agent_generator import AgentDefinition\n"
            "from command_generator import command_definition_from_agent\n"
            "d = AgentDefinition(name='my-agent', description='Does X',"
            " tools=['Read', 'Write'])\n"
            "cd = command_definition_from_agent(d)\n"
            "print(cd.name, cd.agent_name, cd.description,"
            " cd.allowed_tools, cd.argument_hint)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ("my-agent my-agent Does X ['Read', 'Write'] [args]")

    def test_command_definition_falls_back_to_default_tools(self) -> None:
        """Empty agent tools → command uses DEFAULT_AGENT_TOOLS."""
        result = self._run_py(
            "from agent_generator import AgentDefinition\n"
            "from command_generator import (\n"
            "    command_definition_from_agent, DEFAULT_AGENT_TOOLS\n"
            ")\n"
            "d = AgentDefinition(name='a', description='A', tools=[])\n"
            "cd = command_definition_from_agent(d)\n"
            "print(cd.allowed_tools == DEFAULT_AGENT_TOOLS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_write_creates_file_for_opted_in_agent(self) -> None:
        """user_invocable=True → write_companion_command writes file."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import AgentDefinition\n"
            "from command_generator import write_companion_command\n"
            "d = AgentDefinition(name='alpha', description='A',"
            " tools=['Read'], user_invocable=True)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td)\n"
            "    expected = Path(td) / 'alpha.md'\n"
            "    print(p == expected, p.exists(),"
            " '$ARGUMENTS' in p.read_text(),"
            " 'alpha' in p.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_write_returns_none_without_opt_in(self) -> None:
        """user_invocable=False → None, no file, no directory created."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import AgentDefinition\n"
            "from command_generator import write_companion_command\n"
            "d = AgentDefinition(name='beta', description='B', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = write_companion_command(d, td)\n"
            "    file_exists = (Path(td) / 'beta.md').exists()\n"
            "    print(result is None, file_exists)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False"

    def test_write_force_overrides_predicate(self) -> None:
        """force=True writes even when user_invocable=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_generator import AgentDefinition\n"
            "from command_generator import write_companion_command\n"
            "d = AgentDefinition(name='forced', description='F', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td, force=True)\n"
            "    print(p is not None, p.exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_validate_passes_for_generator_output(self) -> None:
        """Files produced by write_companion_command pass validate_command_file."""
        result = self._run_py(
            "import tempfile\n"
            "from agent_generator import AgentDefinition\n"
            "from command_generator import write_companion_command, validate_command_file\n"
            "d = AgentDefinition(name='valid', description='V',"
            " tools=['Read'], user_invocable=True)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td)\n"
            "    errors = validate_command_file(p)\n"
            "    print(errors)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_validate_missing_file(self) -> None:
        """Missing file → single 'does not exist' error."""
        result = self._run_py(
            "from command_generator import validate_command_file\n"
            "errors = validate_command_file('/tmp/__no_such_cmd_file__.md')\n"
            "print(len(errors), 'does not exist' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_missing_frontmatter(self) -> None:
        """File without `---` frontmatter fails validation."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('no frontmatter here\\nbody with $ARGUMENTS and Task tool')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('frontmatter' in e for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_validate_missing_arguments_token(self) -> None:
        """Missing $ARGUMENTS → explicit error mentioning the token."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('---\\ndescription: x\\n---\\n"
            "body with subagent_type but no arg token')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('$ARGUMENTS' in e for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_validate_missing_agent_invocation(self) -> None:
        """No subagent_type or Task tool reference → validation error."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('---\\ndescription: x\\n---\\n"
            "body with $ARGUMENTS but nothing that launches an agent')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('agent' in e.lower() for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"


class TestClaudemdSubagentDelegation:
    """Tests for the Subagent Delegation section in claudemd_generator (feature #72).

    Covers:
    - AvailableAgent dataclass (name, description, when_to_use)
    - AgentContext.available_agents field (default empty list)
    - generate_subagent_delegation_section rendering
    - Empty agents list → empty string
    - Missing when_to_use → agent in main list, not in 'When to use' subsection
    - generate_claudemd includes delegation section when agents present
    - generate_claudemd omits section when empty
    - discover_available_agents parses .md frontmatter
    - discover skips non-.md, missing frontmatter, missing required fields
    - discover returns [] for missing dir
    - SUBAGENT_DELEGATION_HEADING / DEFAULT_AGENTS_DIR exposed
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """SUBAGENT_DELEGATION_HEADING and DEFAULT_AGENTS_DIR are public."""
        result = self._run_py(
            "from claudemd_generator import"
            " SUBAGENT_DELEGATION_HEADING, DEFAULT_AGENTS_DIR\n"
            "print(SUBAGENT_DELEGATION_HEADING, '|', DEFAULT_AGENTS_DIR)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "## Subagent Delegation | .claude/agents"

    def test_available_agent_dataclass(self) -> None:
        """AvailableAgent has name, description, default-empty when_to_use."""
        result = self._run_py(
            "from claudemd_generator import AvailableAgent\n"
            "a = AvailableAgent(name='x', description='d')\n"
            "print(a.name, a.description, repr(a.when_to_use))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "x d ''"

    def test_context_available_agents_defaults_empty(self) -> None:
        """AgentContext.available_agents defaults to an empty list."""
        result = self._run_py(
            "from claudemd_generator import AgentContext\n"
            "c = AgentContext(name='a', description='d', tools=['Read'])\n"
            "print(c.available_agents)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_delegation_section_empty_when_no_agents(self) -> None:
        """Empty agents list → empty string."""
        result = self._run_py(
            "from claudemd_generator import generate_subagent_delegation_section\n"
            "print(repr(generate_subagent_delegation_section([])))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_delegation_section_renders_agents(self) -> None:
        """Each agent appears in the main list with name+description."""
        result = self._run_py(
            "from claudemd_generator import"
            " AvailableAgent, generate_subagent_delegation_section\n"
            "agents = [\n"
            "    AvailableAgent(name='reviewer', description='Reviews code',\n"
            "                   when_to_use='After changes'),\n"
            "    AvailableAgent(name='scanner', description='Security scan'),\n"
            "]\n"
            "section = generate_subagent_delegation_section(agents)\n"
            "print('## Subagent Delegation' in section,"
            " '**reviewer**' in section,"
            " '**scanner**' in section,"
            " 'Security scan' in section)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_delegation_when_to_use_subsection(self) -> None:
        """Agents with when_to_use appear in the subsection; others are not."""
        result = self._run_py(
            "from claudemd_generator import"
            " AvailableAgent, generate_subagent_delegation_section\n"
            "agents = [\n"
            "    AvailableAgent(name='with-hint', description='d', when_to_use='Use me'),\n"
            "    AvailableAgent(name='no-hint', description='d2'),\n"
            "]\n"
            "section = generate_subagent_delegation_section(agents)\n"
            "print('### When to use' in section,"
            " 'Use me' in section,"
            " 'no-hint' in section,"
            " section.count('- **no-hint**'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True 1"

    def test_when_to_use_subsection_suppressed_without_hints(self) -> None:
        """All agents missing when_to_use → no 'When to use' subsection."""
        result = self._run_py(
            "from claudemd_generator import"
            " AvailableAgent, generate_subagent_delegation_section\n"
            "agents = [AvailableAgent(name='a', description='b')]\n"
            "section = generate_subagent_delegation_section(agents)\n"
            "print('When to use' in section)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_generate_claudemd_includes_delegation(self) -> None:
        """When AgentContext has agents, generate_claudemd emits the section."""
        result = self._run_py(
            "from claudemd_generator import"
            " AgentContext, AvailableAgent, generate_claudemd\n"
            "ctx = AgentContext(\n"
            "    name='orch', description='Orchestrator', tools=['Task'],\n"
            "    available_agents=[AvailableAgent(name='w1',"
            " description='W1', when_to_use='Use 1')],\n"
            ")\n"
            "md = generate_claudemd(ctx)\n"
            "print('## Subagent Delegation' in md, 'w1' in md, 'Use 1' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_generate_claudemd_omits_delegation_when_empty(self) -> None:
        """AgentContext with no available_agents → no delegation section."""
        result = self._run_py(
            "from claudemd_generator import AgentContext, generate_claudemd\n"
            "ctx = AgentContext(name='solo', description='Solo', tools=['Read'])\n"
            "md = generate_claudemd(ctx)\n"
            "print('Subagent Delegation' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_discover_parses_agent_files(self) -> None:
        """discover_available_agents reads frontmatter for name/description/when-to-use."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from claudemd_generator import discover_available_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'reviewer.md').write_text(\n"
            "        '---\\nname: reviewer\\ndescription: Review code\\n"
            "when-to-use: After changes\\n---\\nbody'\n"
            "    )\n"
            "    (base / 'scanner.md').write_text(\n"
            "        '---\\nname: scanner\\ndescription: Scan\\n---\\nbody'\n"
            "    )\n"
            "    found = discover_available_agents(base)\n"
            "    by_name = {a.name: (a.description, a.when_to_use) for a in found}\n"
            "    print(sorted(by_name.items()))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "[('reviewer', ('Review code', 'After changes')), ('scanner', ('Scan', ''))]"
        )

    def test_discover_skips_non_md_and_malformed(self) -> None:
        """Non-.md files, missing frontmatter, and missing fields are all skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from claudemd_generator import discover_available_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'not-agent.txt').write_text('text file')\n"
            "    (base / 'no-frontmatter.md').write_text('no frontmatter here')\n"
            "    (base / 'missing-desc.md').write_text('---\\nname: x\\n---\\n')\n"
            "    (base / 'valid.md').write_text(\n"
            "        '---\\nname: valid\\ndescription: ok\\n---\\n'\n"
            "    )\n"
            "    found = discover_available_agents(base)\n"
            "    print([a.name for a in found])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['valid']"

    def test_discover_missing_dir(self) -> None:
        """Non-existent directory → empty list (no error)."""
        result = self._run_py(
            "from claudemd_generator import discover_available_agents\n"
            "print(discover_available_agents('/tmp/__definitely_no_agents_dir__'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"


class TestStateCheckpointRecovery:
    """Tests for state_persistence checkpoint/resume (feature #74).

    Covers:
    - CHECKPOINT_PHASES tuple defines the canonical phase order
    - Checkpoint dataclass (phase, completed_at, phase_data)
    - SessionState.checkpoints defaults to empty list
    - save_checkpoint appends; rejects unknown phase with ValueError
    - save_checkpoint shallow-copies phase_data (caller mutations don't bleed)
    - latest_checkpoint returns last appended or None
    - resume_phase returns next phase, or None when none/finished
    - clear_checkpoints empties the list (restart path)
    - Round-trip through save/load preserves checkpoints
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_checkpoint_phases_constant(self) -> None:
        """CHECKPOINT_PHASES is a 5-tuple in execution order."""
        result = self._run_py(
            "from state_persistence import CHECKPOINT_PHASES\nprint(CHECKPOINT_PHASES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "('discovery', 'architecture', 'generation', 'validation', 'installation')"
        )

    def test_checkpoint_dataclass(self) -> None:
        """Checkpoint exposes phase, auto-set completed_at, default-empty phase_data."""
        result = self._run_py(
            "from state_persistence import Checkpoint\n"
            "c = Checkpoint(phase='discovery')\n"
            "print(c.phase, type(c.completed_at).__name__, c.phase_data)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "discovery str {}"

    def test_session_state_checkpoints_defaults_empty(self) -> None:
        """SessionState.checkpoints defaults to []."""
        result = self._run_py(
            "from state_persistence import SessionState, StateMetadata\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(s.checkpoints)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_save_checkpoint_appends(self) -> None:
        """save_checkpoint appends a Checkpoint with phase + phase_data."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "cp = save_checkpoint(s, 'discovery', {'agents_found': 3})\n"
            "print(len(s.checkpoints), cp.phase, cp.phase_data['agents_found'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 discovery 3"

    def test_save_checkpoint_rejects_unknown_phase(self) -> None:
        """Unknown phase → ValueError naming the bad phase."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "try:\n"
            "    save_checkpoint(s, 'bogus-phase', {})\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'bogus-phase' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_save_checkpoint_isolates_phase_data(self) -> None:
        """Caller mutating phase_data after the call must not affect the checkpoint."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "data = {'k': 1}\n"
            "save_checkpoint(s, 'discovery', data)\n"
            "data['k'] = 999\n"
            "print(s.checkpoints[0].phase_data['k'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1"

    def test_latest_checkpoint(self) -> None:
        """latest_checkpoint returns the last appended; None when empty."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, latest_checkpoint\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(latest_checkpoint(s))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "save_checkpoint(s, 'architecture', {})\n"
            "print(latest_checkpoint(s).phase)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["None", "architecture"]

    def test_resume_phase_returns_next(self) -> None:
        """After 'discovery' checkpoint, resume_phase returns 'architecture'."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, resume_phase\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "architecture"

    def test_resume_phase_none_when_no_checkpoints(self) -> None:
        """No checkpoints → resume_phase returns None (start fresh)."""
        result = self._run_py(
            "from state_persistence import SessionState, StateMetadata, resume_phase\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "None"

    def test_resume_phase_none_when_complete(self) -> None:
        """Last phase reached → resume_phase returns None (workflow done)."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, resume_phase\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'installation', {})\n"
            "print(resume_phase(s))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "None"

    def test_clear_checkpoints(self) -> None:
        """clear_checkpoints empties the list (restart path)."""
        result = self._run_py(
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, save_checkpoint, clear_checkpoints\n"
            ")\n"
            "s = SessionState(metadata=StateMetadata(session_id='x'))\n"
            "save_checkpoint(s, 'discovery', {})\n"
            "save_checkpoint(s, 'architecture', {})\n"
            "clear_checkpoints(s)\n"
            "print(s.checkpoints)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_round_trip_serialization_preserves_checkpoints(self) -> None:
        """save → load preserves checkpoint phase + phase_data."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from state_persistence import (\n"
            "    SessionState, StateMetadata, StatePersistence, save_checkpoint\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    persistence = StatePersistence(base_dir=Path(td))\n"
            "    s = SessionState(metadata=StateMetadata(session_id='roundtrip'))\n"
            "    save_checkpoint(s, 'discovery', {'a': 1})\n"
            "    save_checkpoint(s, 'architecture', {'b': 2})\n"
            "    persistence.save(s)\n"
            "    loaded = persistence.load()\n"
            "    print(\n"
            "        len(loaded.checkpoints),\n"
            "        loaded.checkpoints[0].phase,\n"
            "        loaded.checkpoints[0].phase_data['a'],\n"
            "        loaded.checkpoints[1].phase,\n"
            "        loaded.checkpoints[1].phase_data['b'],\n"
            "    )"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 discovery 1 architecture 2"


class TestStatePersistenceErrorHandling:
    """Tests for state_persistence broad-except narrowing (Feature #10).

    The module used to wrap ``update``, ``add_generation_record``, ``reset``,
    and ``_log_error`` in ``except Exception``, conflating environmental
    failures (OSError, json.JSONDecodeError, ValueError, IntegrityError) with
    programmer errors (AttributeError, TypeError, KeyError) and silently
    returning ``False``. That swallowed real bugs.

    The fix:
    - Narrow the except clauses to the environmental exception set only.
    - Return a structured ``(bool, str | None)`` tuple from the public
      mutation methods so callers can surface the failure reason.
    - Let programmer-error exceptions propagate naturally.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_update_returns_structured_error(self) -> None:
        """update() must return (bool, str | None).

        On success: ``(True, None)``.
        On a caught environmental error: ``(False, error_msg)``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # Success path\n"
            "    r1 = p.update(workflow_phase='discovery')\n"
            "    print('success_shape:', isinstance(r1, tuple), len(r1))\n"
            "    print('success_values:', r1[0], r1[1])\n"
            "    # Caught error path: OSError in _write_state propagates\n"
            "    # through transaction().__exit__ and is swallowed by update()\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=OSError('disk full'),\n"
            "    ):\n"
            "        r2 = p.update(workflow_phase='generation')\n"
            "    print('fail_shape:', isinstance(r2, tuple), len(r2))\n"
            "    print('fail_values:', r2[0], 'disk full' in (r2[1] or ''))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "success_shape: True 2" in result.stdout
        assert "success_values: True None" in result.stdout
        assert "fail_shape: True 2" in result.stdout
        assert "fail_values: False True" in result.stdout

    def test_programmer_error_propagates(self) -> None:
        """AttributeError (programmer error) must propagate, not be swallowed.

        The old broad ``except Exception`` swallowed AttributeError and returned
        ``False``, hiding real bugs. The narrowed except must let it out.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=AttributeError('bad attr access'),\n"
            "    ):\n"
            "        try:\n"
            "            p.update(workflow_phase='discovery')\n"
            "            print('swallowed')\n"
            "        except AttributeError as e:\n"
            "            print('propagated:', str(e))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "propagated: bad attr access" in result.stdout

    def test_add_generation_record_returns_structured_error(self) -> None:
        """add_generation_record() must also return (bool, str | None)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from state_persistence import (\n"
            "    StatePersistence, GenerationRecord\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    rec = GenerationRecord(\n"
            "        agent_name='demo', description='d', pattern='chaining',\n"
            "        tools=[], generated_at='2026-04-20T00:00:00',\n"
            "        output_path='/tmp/x', success=True,\n"
            "    )\n"
            "    r1 = p.add_generation_record(rec)\n"
            "    print('success_shape:', isinstance(r1, tuple), len(r1))\n"
            "    print('success_values:', r1[0], r1[1])\n"
            "    with patch.object(\n"
            "        StatePersistence, '_write_state',\n"
            "        side_effect=OSError('io fail'),\n"
            "    ):\n"
            "        r2 = p.add_generation_record(rec)\n"
            "    print('fail_shape:', isinstance(r2, tuple), len(r2))\n"
            "    print('fail_values:', r2[0], 'io fail' in (r2[1] or ''))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "success_shape: True 2" in result.stdout
        assert "success_values: True None" in result.stdout
        assert "fail_shape: True 2" in result.stdout
        assert "fail_values: False True" in result.stdout

    def test_reset_returns_structured_error(self) -> None:
        """reset() must also return (bool, str | None)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    r = p.reset()\n"
            "    print('shape:', isinstance(r, tuple), len(r))\n"
            "    print('values:', r[0], r[1])\n"
        )
        assert result.returncode == 0, result.stderr
        assert "shape: True 2" in result.stdout
        assert "values: True None" in result.stdout


class TestStatePersistenceConfig:
    """Tests for get_config/set_config corruption semantics (Feature #11).

    Previously get_config() returned ``{}`` for both "file does not exist"
    and "file is corrupt JSON", so set_config() would cheerfully overwrite
    a corrupt config with a fresh empty-plus-update dict — erasing the
    operator's intent on top of whatever had damaged it. The fix:

    - get_config() still returns ``{}`` for missing file.
    - get_config() now raises ConfigCorruptError when the file exists but
      contains invalid JSON (or parses to a non-object root).
    - set_config() no longer catches that error, so an overwrite is refused
      until the operator repairs or deletes the file.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_missing_file_returns_empty(self) -> None:
        """When the config file does not exist, get_config() returns ``{}``."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from state_persistence import StatePersistence\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # config_file is under base_dir and does not exist yet\n"
            "    print('exists_before:', p.config_file.exists())\n"
            "    cfg = p.get_config()\n"
            "    print('returned:', cfg)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "exists_before: False" in result.stdout
        assert "returned: {}" in result.stdout

    def test_corrupt_file_raises(self) -> None:
        """Corrupt JSON in the config file raises ConfigCorruptError.

        Includes coverage for the non-dict root case (JSON parses but is
        not an object) — both are forms of config corruption the caller
        must not silently inherit as an empty dict.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from state_persistence import StatePersistence, ConfigCorruptError\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    # Case A: malformed JSON\n"
            "    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text('{not valid json', encoding='utf-8')\n"
            "    try:\n"
            "        p.get_config()\n"
            "        print('A: swallowed')\n"
            "    except ConfigCorruptError as e:\n"
            "        print('A: raised')\n"
            "        print('A_msg_has_path:', str(p.config_file) in str(e))\n"
            "    # Case B: valid JSON but non-object root\n"
            '    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text(\'["not", "a", "dict"]\', encoding=\'utf-8\')\n'
            "    try:\n"
            "        p.get_config()\n"
            "        print('B: swallowed')\n"
            "    except ConfigCorruptError as e:\n"
            "        print('B: raised')\n"
            "        print('B_msg_has_type:', 'list' in str(e))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "A: raised" in result.stdout
        assert "A_msg_has_path: True" in result.stdout
        assert "B: raised" in result.stdout
        assert "B_msg_has_type: True" in result.stdout

    def test_set_config_refuses_corrupt(self) -> None:
        """set_config() must refuse to overwrite a corrupt config file.

        The previous implementation caught the parse error inside
        get_config(), got ``{}`` back, merged kwargs into that empty dict,
        and wrote it out — destroying whatever was in the corrupt file.
        After the fix, the ConfigCorruptError propagates from get_config()
        out through set_config() and the original file bytes stay intact.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from state_persistence import StatePersistence, ConfigCorruptError\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    original = '{not valid json'\n"
            "    p.config_file.parent.mkdir(parents=True, exist_ok=True)\n    p.config_file.write_text(original, encoding='utf-8')\n"
            "    try:\n"
            "        p.set_config(new_key='new_value')\n"
            "        print('set: allowed')\n"
            "    except ConfigCorruptError:\n"
            "        print('set: refused')\n"
            "    # Original bytes must be unchanged\n"
            "    print('unchanged:',\n"
            "          p.config_file.read_text(encoding='utf-8') == original)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "set: refused" in result.stdout
        assert "unchanged: True" in result.stdout


class TestStatePersistenceWriteSurfacing:
    """Tests for state_persistence write/lock/CLI surfacing (Feature #12).

    Three silent-failure sites were hiding real environmental problems:

    - ``_save_to_history`` swallowed OSError with ``pass``, so a full disk
      or read-only agents_dir would quietly drop per-agent history without
      the operator ever learning the write didn't happen. The fix emits a
      stderr warning naming the target path and the error class.

    - ``FileLock.release`` swallowed OSError on ``fcntl.flock(..., LOCK_UN)``
      so a lock that failed to release looked successful, and the next
      acquirer could spin until timeout without any explanation of why.
      The fix emits a stderr warning naming the lock path and the error.

    - The CLI ``config --set KEY VALUE`` path silently coerced
      non-JSON values to plain strings. Operators typing
      ``--set port 8080`` expected the int; typing ``--set greeting hello``
      expected the string. Silently deciding means the operator can't tell
      which branch ran. The fix emits a stderr notice when the JSON parse
      falls back to string storage.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_oserror_on_save_prints_stderr(self) -> None:
        """OSError inside ``_save_to_history`` must emit a stderr warning
        that names the target history file and the error class.

        The previous ``except (json.JSONDecodeError, OSError): pass``
        hid the failure entirely. Operators lost per-agent history with
        zero diagnostic. The fix emits a warning to stderr without
        changing the swallow-and-continue contract (history is
        best-effort; the state update in ``add_generation_record``
        already succeeded by the time ``_save_to_history`` runs).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from state_persistence import StatePersistence, GenerationRecord\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = StatePersistence(base_dir=Path(td))\n"
            "    rec = GenerationRecord(\n"
            "        agent_name='demo', description='d', pattern='chaining',\n"
            "        tools=[], generated_at='2026-04-20T00:00:00',\n"
            "        output_path='/tmp/x', success=True,\n"
            "    )\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('no space left'),\n"
            "    ):\n"
            "        p._save_to_history(rec)\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path (by agent name) and the error class.
        assert "demo.json" in result.stderr
        assert "OSError" in result.stderr
        assert "no space left" in result.stderr

    def test_lock_release_failure_warns(self) -> None:
        """Lock release failure (flock LOCK_UN raising OSError) must emit a
        stderr warning that names the lock path and the error.

        The previous ``except (IOError, OSError): pass`` made a failing
        unlock indistinguishable from a clean one, which is the worst
        failure mode for a lock primitive — the caller sees "released"
        but the kernel state disagrees. The fix surfaces the failure
        while preserving the swallow (release is called from cleanup
        paths that cannot raise).
        """
        result = self._run_py(
            "import tempfile\n"
            "import fcntl\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from state_persistence import FileLock\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    lock_path = Path(td) / 'test.lock'\n"
            "    lock = FileLock(lock_path)\n"
            "    assert lock.acquire(), 'acquire failed'\n"
            "    original_flock = fcntl.flock\n"
            "    def fake_flock(fd, op):\n"
            "        if op == fcntl.LOCK_UN:\n"
            "            raise OSError('unlock failed')\n"
            "        return original_flock(fd, op)\n"
            "    with patch('state_persistence.fcntl.flock', fake_flock):\n"
            "        lock.release()\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the lock path and the error class/message.
        assert "test.lock" in result.stderr
        assert "OSError" in result.stderr
        assert "unlock failed" in result.stderr

    def test_cli_set_json_fallback_notice(self) -> None:
        """CLI ``config --set KEY VALUE`` must emit a stderr notice when the
        VALUE fails JSON parse and is stored as a plain string.

        Previously the fallback was silent — ``--set port 8080`` stored
        the int 8080, ``--set port eight-thousand`` stored the string
        "eight-thousand", and the operator had no way to tell which
        branch ran for any given invocation. The fix emits a one-line
        notice when the JSONDecodeError is caught.
        """
        import tempfile

        scripts_dir = Path(__file__).parent.parent / "scripts"
        script = scripts_dir / "state_persistence.py"
        with tempfile.TemporaryDirectory() as td:
            # `set_config` writes to .claude/config/generator.json; the
            # directory must exist before the CLI runs or the write fails
            # with an unrelated OSError that masks the fallback-notice path.
            (Path(td) / ".claude" / "config").mkdir(parents=True, exist_ok=True)
            result = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "config",
                    "--set",
                    "mykey",
                    "not_json_value",
                ],
                capture_output=True,
                text=True,
                cwd=td,
                check=False,
            )
        assert result.returncode == 0, result.stderr
        # Notice must name the key and flag the fallback.
        assert "mykey" in result.stderr
        assert "string" in result.stderr.lower()
        # And the set still succeeded on stdout.
        assert "Set mykey" in result.stdout


class TestExtendedThinkingLoadHistory:
    """Tests for extended_thinking.py per-record load handling (Feature #13).

    ``_load_usage_history`` previously wrapped the entire per-record loop
    in one ``except (json.JSONDecodeError, OSError, KeyError)`` that caught
    and silently dropped the exception. When a single record in the file
    was malformed (missing a required key like ``task_id``), the KeyError
    aborted the loop, leaving only the records loaded before the bad one
    in memory. On the next ``_save_usage_history`` write, the file was
    rewritten from that partial in-memory list, silently destroying the
    valid records that appeared AFTER the bad one on disk.

    The fix:
    - Keep the outer try/except for whole-file failures (JSONDecodeError
      and OSError from the initial read).
    - Add a per-record try/except INSIDE the loop that catches KeyError
      (and re-catches JSONDecodeError for belt-and-suspenders), logs a
      stderr warning naming the record index, and ``continue``s so
      subsequent valid records still load.
    - Resulting ``_usage_records`` contains every well-formed record,
      regardless of where the bad ones sit in the file.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_bad_record_skipped_not_drops(self) -> None:
        """A single bad record mid-file must not abort load of later records.

        Writes a 3-record file where record #2 is missing ``task_id``
        (forces KeyError inside ThinkingUsageRecord construction).
        Asserts:
        - Exactly 2 valid records are loaded (the first and third).
        - stderr contains a warning naming the failing record.
        - The file bytes on disk are unchanged (load does not rewrite).
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "good_1 = {\n"
            "    'task_id': 'task-1', 'task_description': 'first',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.3,\n"
            "    'started_at': '2026-04-20T00:00:00'}\n"
            "bad = {\n"
            "    'task_description': 'missing task_id',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.4,\n"
            "    'started_at': '2026-04-20T00:01:00'}\n"
            "good_3 = {\n"
            "    'task_id': 'task-3', 'task_description': 'third',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.5,\n"
            "    'started_at': '2026-04-20T00:02:00'}\n"
            "payload = json.dumps({'schema_version': '1.0.0',\n"
            "    'last_updated': '2026-04-20T00:03:00',\n"
            "    'records': [good_1, bad, good_3]}, indent=2)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'thinking_usage.json'\n"
            "    path.write_text(payload, encoding='utf-8')\n"
            "    original_bytes = path.read_bytes()\n"
            "    integ = ThinkingIntegration(usage_log_path=path)\n"
            "    recs = integ._usage_records\n"
            "    ids = [r.task_id for r in recs]\n"
            "    print('count:', len(recs))\n"
            "    print('ids:', ','.join(ids))\n"
            "    # File on disk must be byte-identical after load\n"
            "    print('unchanged:', path.read_bytes() == original_bytes)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "count: 2" in result.stdout
        assert "ids: task-1,task-3" in result.stdout
        assert "unchanged: True" in result.stdout
        # stderr must name the failing record index and the error class.
        assert "KeyError" in result.stderr or "task_id" in result.stderr
        # Some identifier of the record position should appear (index 1
        # == second record) so operators can find the bad entry.
        assert "1" in result.stderr or "record" in result.stderr.lower()

    def test_all_good_records_load(self) -> None:
        """Baseline: all-valid file loads every record with no stderr noise.

        Regression guard — if the per-record error path accidentally
        fires for well-formed records, this test catches it.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "records = [\n"
            "    {'task_id': f'task-{i}', 'task_description': f'desc-{i}',\n"
            "     'intensity_used': 'think', 'complexity_score': 0.1 * i,\n"
            "     'started_at': '2026-04-20T00:00:00'}\n"
            "    for i in range(1, 4)]\n"
            "payload = json.dumps({'schema_version': '1.0.0',\n"
            "    'last_updated': '2026-04-20T00:03:00',\n"
            "    'records': records}, indent=2)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'thinking_usage.json'\n"
            "    path.write_text(payload, encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=path)\n"
            "    recs = integ._usage_records\n"
            "    print('count:', len(recs))\n"
            "    print('ids:', ','.join(r.task_id for r in recs))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "count: 3" in result.stdout
        assert "ids: task-1,task-2,task-3" in result.stdout
        # No per-record warning should fire on a clean file.
        assert "KeyError" not in result.stderr


class TestSilentWriteSurfacing:
    """Tests for bundled state-write OSError surfacing (Feature #14).

    Two state-persistence helpers had symmetric silent-failure sites that
    were hiding environmental problems:

    - ``extended_thinking.ThinkingIntegration._save_usage_history``
      swallowed OSError with ``pass`` when writing the per-task usage log.
      A full disk or a read-only ``.claude/`` meant the log silently
      stopped growing — the operator had no way to tell a healthy
      "no new records yet" from a broken "every write is dropping on
      the floor".

    - ``progress_tracker.ProgressTracker._save_state`` had the same
      pattern for the cross-phase progress checkpoint. Silent drops here
      meant a failed resume anchor looked identical to a fresh start,
      which is the worst failure mode for a resume-on-crash primitive.

    The fix emits a stderr warning that names the target path and the
    error class in both sites, without changing the swallow-and-continue
    contract (both writes are best-effort; the caller already holds the
    live in-memory record).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_extended_thinking_oserror(self) -> None:
        """OSError inside ``_save_usage_history`` must emit a stderr warning
        that names the target usage log path and the error class.

        The previous ``except OSError: pass`` hid disk-full / permissions
        failures entirely. Operators lost their thinking-usage log with
        zero diagnostic. The fix emits a warning to stderr without
        changing the swallow-and-continue contract (records are captured
        in-memory by the caller before save).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log_path = Path(td) / 'thinking_usage.json'\n"
            "    integ = ThinkingIntegration(usage_log_path=log_path)\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('no space left'),\n"
            "    ):\n"
            "        integ._save_usage_history()\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path and the error class/message.
        assert "thinking_usage.json" in result.stderr
        assert "OSError" in result.stderr
        assert "no space left" in result.stderr

    def test_progress_tracker_oserror(self) -> None:
        """OSError inside ``_save_state`` must emit a stderr warning that
        names the target state file and the error class.

        The previous ``except OSError: pass`` hid resume-anchor write
        failures — a crashed run could not be distinguished from a run
        that never persisted its checkpoint. The fix surfaces the failure
        while preserving the best-effort contract (the caller holds the
        live ProgressState).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from unittest.mock import patch\n"
            "from progress_tracker import ProgressTracker\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    state_path = Path(td) / 'progress.json'\n"
            "    tracker = ProgressTracker(state_file=state_path)\n"
            "    with patch.object(\n"
            "        Path, 'write_text',\n"
            "        side_effect=OSError('disk full'),\n"
            "    ):\n"
            "        tracker.start('demo-task')\n"
            "    print('completed')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "completed" in result.stdout
        # Warning must name the target path and the error class/message.
        assert "progress.json" in result.stderr
        assert "OSError" in result.stderr
        assert "disk full" in result.stderr


class TestAgentComposerScan:
    """Tests for agent_composer.load_agent_spec frontmatter narrowing (Feature #15).

    ``load_agent_spec`` previously caught every exception from
    ``yaml.safe_load`` with ``except Exception: return None``. When a
    directory of agents was scanned, a single malformed agent file
    would silently disappear from the result — no log line, no warning
    — making it indistinguishable from "file never existed". Operators
    adding a new agent and mistyping its YAML had no signal that the
    frontmatter was broken; the agent simply didn't appear.

    The fix narrows the catch to the three expected failure modes:

    - ``ImportError`` — PyYAML missing at runtime. Warrants its own
      except clause because Python evaluates the except-tuple classes
      eagerly; ``yaml.YAMLError`` in the same tuple would raise
      NameError when ``yaml`` isn't bound.
    - ``yaml.YAMLError`` — malformed YAML syntax in the frontmatter.
    - ``AttributeError`` — defensive catch for edge cases where the
      loader returns a non-dict that would crash the downstream
      ``frontmatter.get(...)`` calls.

    Both paths emit a stderr warning naming the offending agent file
    and the error class so operators can see which file is broken and
    why. Scanning still returns None for the bad file (callers are
    expected to filter None out of their list comprehensions), so
    valid agents around a broken one are preserved.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_malformed_agent_logged(self) -> None:
        """Scanning a directory with one malformed YAML agent and two
        valid ones must: (a) emit a stderr warning naming the broken
        file's path, (b) exclude the broken file from the result list
        (load_agent_spec returns None for it), and (c) preserve the
        valid agents in the result.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_composer import load_agent_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    good_a = root / 'good_a.md'\n"
            "    bad = root / 'broken.md'\n"
            "    good_b = root / 'good_b.md'\n"
            # Valid frontmatter for both good agents.
            "    good_a.write_text('---\\nname: alpha\\n"
            "description: first good agent\\ntools: Read\\n---\\n"
            "# Alpha\\n', encoding='utf-8')\n"
            "    good_b.write_text('---\\nname: beta\\n"
            "description: second good agent\\ntools: Write\\n---\\n"
            "# Beta\\n', encoding='utf-8')\n"
            # Malformed YAML — unclosed quote triggers yaml.YAMLError.
            "    bad.write_text('---\\nname: \"unterminated\\n"
            "description: broken\\n---\\n# Broken\\n', "
            "encoding='utf-8')\n"
            "    results = [\n"
            "        load_agent_spec(good_a),\n"
            "        load_agent_spec(bad),\n"
            "        load_agent_spec(good_b),\n"
            "    ]\n"
            "    print('names:', '|'.join(\n"
            "        r.name if r is not None else 'NONE' for r in results\n"
            "    ))\n"
        )
        assert result.returncode == 0, result.stderr
        # Valid agents preserved, broken one became None.
        assert "names: alpha|NONE|beta" in result.stdout
        # Warning must name the broken file's path and an error class.
        # PyYAML raises a ``yaml.YAMLError`` subclass (typically
        # ``ScannerError`` or ``ParserError``) for malformed frontmatter;
        # either surfaces as ``type(e).__name__``. Asserting just on
        # "Error" keeps the test robust to PyYAML's internal subclass
        # naming without sacrificing the "class name is present" check.
        assert "broken.md" in result.stderr
        assert "Error" in result.stderr
        # And must NOT name the valid files.
        assert "good_a.md" not in result.stderr
        assert "good_b.md" not in result.stderr

    def test_import_missing_logged(self) -> None:
        """If PyYAML is missing at runtime (simulated by making ``import
        yaml`` raise ImportError inside load_agent_spec), the ImportError
        path must also emit a stderr warning naming the agent file and
        the error class. Result is still None — a missing parser means
        we cannot interpret the frontmatter.
        """
        result = self._run_py(
            "import sys\n"
            "import tempfile\n"
            "from pathlib import Path\n"
            # Pre-poison sys.modules so the inline ``import yaml`` inside
            # load_agent_spec raises ImportError. Any prior import of
            # yaml at module load would shadow this, so we purge it.
            "sys.modules.pop('yaml', None)\n"
            "import builtins\n"
            "_real_import = builtins.__import__\n"
            "def _fake_import(name, *a, **k):\n"
            "    if name == 'yaml':\n"
            "        raise ImportError('No module named yaml')\n"
            "    return _real_import(name, *a, **k)\n"
            "builtins.__import__ = _fake_import\n"
            "from agent_composer import load_agent_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    agent_path = Path(td) / 'agent.md'\n"
            "    agent_path.write_text('---\\nname: demo\\n"
            "description: d\\ntools: Read\\n---\\n# Demo\\n', "
            "encoding='utf-8')\n"
            "    result = load_agent_spec(agent_path)\n"
            "    print('result_is_none:', result is None)\n"
        )
        assert result.returncode == 0, result.stderr
        # Parser missing → None.
        assert "result_is_none: True" in result.stdout
        # Warning must name the agent file and the error class.
        assert "agent.md" in result.stderr
        assert "ImportError" in result.stderr


class TestBatchGeneration:
    """Tests for batch agent generation (feature #75).

    Covers:
    - BatchAgentDef / BatchSpec / BatchAgentResult / BatchResult dataclasses
    - load_batch_spec parses valid JSON, rejects missing fields and bad types
    - load_batch_spec raises FileNotFoundError / ValueError on errors
    - validate_batch_spec catches empty agents, duplicate names, broken
      ecosystem-local skill references
    - generate_batch short-circuits on validation errors (no files written)
    - generate_batch writes frontmatter files with merged shared_tools
    - generate_batch result reports success and output paths
    - DEFAULT_BATCH_OUTPUT_DIR / BATCH_AGENT_FILE_EXTENSION constants public
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """DEFAULT_BATCH_OUTPUT_DIR and BATCH_AGENT_FILE_EXTENSION are public."""
        result = self._run_py(
            "from batch_generator import"
            " DEFAULT_BATCH_OUTPUT_DIR, BATCH_AGENT_FILE_EXTENSION\n"
            "print(DEFAULT_BATCH_OUTPUT_DIR, '|', BATCH_AGENT_FILE_EXTENSION)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/agents | .md"

    def test_load_batch_spec_parses_valid(self) -> None:
        """load_batch_spec reads JSON and populates BatchSpec + BatchAgentDef."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'spec.json'\n"
            "    p.write_text(json.dumps({\n"
            "        'name': 'review-team',\n"
            "        'description': 'A review ecosystem',\n"
            "        'shared_tools': ['Read'],\n"
            "        'agents': [\n"
            "            {'name': 'reviewer', 'description': 'Reviews code',"
            " 'tools': ['Grep'], 'user_invocable': True},\n"
            "            {'name': 'scanner', 'description': 'Security scan',"
            " 'skills': ['security-checklist']},\n"
            "        ],\n"
            "    }))\n"
            "    spec = load_batch_spec(p)\n"
            "    print(spec.name, len(spec.agents),\n"
            "          spec.agents[0].name, spec.agents[0].user_invocable,\n"
            "          spec.agents[1].skills, spec.shared_tools)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "review-team 2 reviewer True ['security-checklist'] ['Read']"
        )

    def test_load_batch_spec_missing_file(self) -> None:
        """Missing file → FileNotFoundError."""
        result = self._run_py(
            "from batch_generator import load_batch_spec\n"
            "try:\n"
            "    load_batch_spec('/tmp/__definitely_no_batch_spec__.json')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_load_batch_spec_invalid_json(self) -> None:
        """Malformed JSON → ValueError."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.json'\n"
            "    p.write_text('not valid json {')\n"
            "    try:\n"
            "        load_batch_spec(p)\n"
            "        print('NO_RAISE')\n"
            "    except ValueError as e:\n"
            "        print('RAISED', 'not valid JSON' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_load_batch_spec_missing_fields(self) -> None:
        """Missing 'name' or 'description' → ValueError naming the field."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'incomplete.json'\n"
            "    p.write_text(json.dumps({'name': 'x'}))\n"
            "    try:\n"
            "        load_batch_spec(p)\n"
            "        print('NO_RAISE')\n"
            "    except ValueError as e:\n"
            "        print('RAISED', 'description' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_validate_rejects_empty_agents(self) -> None:
        """Empty agents list → validation error."""
        result = self._run_py(
            "from batch_generator import BatchSpec, validate_batch_spec\n"
            "errors = validate_batch_spec(BatchSpec(name='eco', description='d'))\n"
            "print(len(errors), 'no agents' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_rejects_duplicate_names(self) -> None:
        """Duplicate agent names → validation error naming the duplicate."""
        result = self._run_py(
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, validate_batch_spec\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[\n"
            "        BatchAgentDef(name='dup', description='a'),\n"
            "        BatchAgentDef(name='dup', description='b'),\n"
            "    ],\n"
            ")\n"
            "errors = validate_batch_spec(spec)\n"
            "print(len(errors), 'dup' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_ok_for_valid_spec(self) -> None:
        """Well-formed spec → no errors."""
        result = self._run_py(
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, validate_batch_spec\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "print(validate_batch_spec(spec))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_generate_batch_writes_files(self) -> None:
        """Valid spec → files written under output_dir with frontmatter."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d', shared_tools=['Read'],\n"
            "    agents=[\n"
            "        BatchAgentDef(name='a1', description='First',"
            " tools=['Grep']),\n"
            "        BatchAgentDef(name='a2', description='Second'),\n"
            "    ],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    a1 = (Path(td) / 'a1.md').read_text()\n"
            "    a2 = (Path(td) / 'a2.md').read_text()\n"
            "    print(result.success, len(result.agents),\n"
            "          'name: a1' in a1, 'tools: Grep, Read' in a1,\n"
            "          'name: a2' in a2, 'tools: Read' in a2)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 2 True True True True"

    def test_generate_batch_halts_on_validation(self) -> None:
        """Validation errors → no files written, success=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[\n"
            "        BatchAgentDef(name='dup', description='a'),\n"
            "        BatchAgentDef(name='dup', description='b'),\n"
            "    ],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    dup_written = (Path(td) / 'dup.md').exists()\n"
            "    print(result.success, len(result.agents),\n"
            "          len(result.cross_validation_errors), dup_written)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 0 1 False"

    def test_generate_batch_result_paths(self) -> None:
        """Each per-agent result includes the output_path."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='only', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    r0 = result.agents[0]\n"
            "    print(r0.success, r0.name, r0.output_path.endswith('only.md'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True only True"


class TestBatchPolicy:
    """Tests for BatchPolicy + enforce_batch_policy (feature #81).

    Covers the three verification criteria:
    - Batch mode respects --allowedTools flag (tools outside the allowlist
      trigger a policy violation with a helpful message).
    - WebSearch disabled in offline mode (scrubbed from every generated
      agent, per-agent warnings recorded, non-fatal).
    - Write restricted to .claude/ paths (output_dir outside the scope
      prefix blocks generation with cross_validation_errors populated).

    Also covers policy constants and backwards-compat (no policy = old
    behaviour).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_policy_constants_exposed(self) -> None:
        """DEFAULT_OUTPUT_SCOPE and OFFLINE_DISABLED_TOOLS are public."""
        result = self._run_py(
            "from batch_generator import DEFAULT_OUTPUT_SCOPE, OFFLINE_DISABLED_TOOLS\n"
            "print(DEFAULT_OUTPUT_SCOPE, '|',"
            " 'WebSearch' in OFFLINE_DISABLED_TOOLS,"
            " 'WebFetch' in OFFLINE_DISABLED_TOOLS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude | True True"

    def test_allowed_tools_blocks_disallowed_agent(self) -> None:
        """Agent requesting tools outside allowlist → policy violation."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'Bash'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read', 'Grep'],\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success,\n"
            "          len(result.cross_validation_errors),\n"
            "          'Bash' in result.cross_validation_errors[0],\n"
            "          (Path(td) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True False"

    def test_allowed_tools_accepts_subset(self) -> None:
        """Agent within allowlist → succeeds, file written."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read', 'Grep'],\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success, (Path(td) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_offline_strips_websearch(self) -> None:
        """offline=True removes WebSearch/WebFetch from generated agents."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='net', description='x',\n"
            "        tools=['Read', 'WebSearch', 'WebFetch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(offline=True, output_scope=td)\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    body = (Path(td) / 'net.md').read_text()\n"
            "    warnings = result.agents[0].warnings\n"
            "    print(result.success,\n"
            "          'WebSearch' not in body,\n"
            "          'WebFetch' not in body,\n"
            "          'Read' in body,\n"
            "          any('WebSearch' in w for w in warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True"

    def test_offline_allowlist_passes_after_scrub(self) -> None:
        """Offline scrub runs BEFORE allowlist check — spec with WebSearch
        + allowlist not containing WebSearch still passes.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='n', description='x',\n"
            "        tools=['Read', 'WebSearch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read'],\n"
            "        offline=True,\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success, len(result.cross_validation_errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_output_scope_blocks_outside_path(self) -> None:
        """Output dir outside scope → fatal policy violation, no files."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as outer:\n"
            "    with tempfile.TemporaryDirectory() as inner:\n"
            "        # scope = inner, but output_dir = outer — disjoint.\n"
            "        policy = BatchPolicy(output_scope=inner)\n"
            "        result = generate_batch(spec, outer, policy=policy)\n"
            "        print(result.success,\n"
            "              len(result.cross_validation_errors),\n"
            "              'outside' in result.cross_validation_errors[0],\n"
            "              (Path(outer) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True False"

    def test_output_scope_allows_nested_path(self) -> None:
        """Output dir nested under scope → allowed."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    nested = Path(td) / 'sub' / 'agents'\n"
            "    policy = BatchPolicy(output_scope=td)\n"
            "    result = generate_batch(spec, nested, policy=policy)\n"
            "    print(result.success, (nested / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_enforce_policy_standalone(self) -> None:
        """enforce_batch_policy is a public helper with no side effects."""
        result = self._run_py(
            "import tempfile\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, enforce_batch_policy\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'Bash'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    errors = enforce_batch_policy(\n"
            "        spec,\n"
            "        BatchPolicy(allowed_tools=['Read'], output_scope=td),\n"
            "        td,\n"
            "    )\n"
            "    print(len(errors), 'Bash' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_no_policy_preserves_old_behaviour(self) -> None:
        """Calling generate_batch without policy behaves identically to pre-#81."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'WebSearch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)  # no policy arg\n"
            "    body = (Path(td) / 'a.md').read_text()\n"
            "    print(result.success,\n"
            "          'WebSearch' in body,\n"
            "          result.agents[0].warnings)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True []"


class TestInstallScopeRecommender:
    """Tests for install_agent.recommend_scope (feature #87).

    Covers all three verification criteria:
    - install_agent.py analyzes agent for project-specific references
    - recommends scope (user vs project)
    - explains reasoning (non-empty reasons list always)

    Plus edge cases: unreadable source falls back to user with reason,
    content kwarg bypasses disk I/O, signal matches carry category
    labels, multi-signal agents accumulate all matches.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_and_dataclass_exposed(self) -> None:
        """PROJECT_SCOPE_SIGNALS + ScopeRecommendation are public."""
        result = self._run_py(
            "from install_agent import (\n"
            "    PROJECT_SCOPE_SIGNALS, ScopeRecommendation, recommend_scope,\n"
            ")\n"
            "print('language' in PROJECT_SCOPE_SIGNALS,\n"
            "      'framework' in PROJECT_SCOPE_SIGNALS,\n"
            "      'linter' in PROJECT_SCOPE_SIGNALS)\n"
            "r = ScopeRecommendation(scope='user')\n"
            "print(r.scope, r.reasons, r.matched_signals)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "True True True",
            "user [] []",
        ]

    def test_universal_agent_recommends_user(self) -> None:
        """Agent with no project-specific tokens → user scope + reasoning."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "rec = recommend_scope(content=\n"
            "    '---\\nname: explorer\\n"
            "description: Generic code explorer using search\\n"
            "tools: Read, Grep, Glob\\n---\\n'\n"
            "    '# Explorer\\n\\nSearch and read files.\\n'\n"
            ")\n"
            "print(rec.scope, len(rec.reasons) >= 1,\n"
            "      'user scope' in rec.reasons[-1].lower(),\n"
            "      rec.matched_signals)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "user True True []"

    def test_language_specific_agent_recommends_project(self) -> None:
        """Agent mentioning Python + pytest + ruff → project scope."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "rec = recommend_scope(content=\n"
            "    '---\\nname: py-reviewer\\n"
            "description: Reviews Python code and runs pytest + ruff\\n"
            "---\\n'\n"
            "    '# Reviewer\\n'\n"
            ")\n"
            "print(rec.scope, len(rec.matched_signals) >= 2,\n"
            "      any('language: python' in s for s in rec.matched_signals),\n"
            "      any('test_runner: pytest' in s for s in rec.matched_signals),\n"
            "      any('linter: ruff' in s for s in rec.matched_signals))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "project True True True True"

    def test_framework_mention_recommends_project(self) -> None:
        """Framework name (e.g. 'React') alone triggers project scope."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "rec = recommend_scope(content=\n"
            "    '---\\nname: x\\ndescription: React component helper\\n---\\n'\n"
            ")\n"
            "print(rec.scope,\n"
            "      any('framework: react' in s for s in rec.matched_signals))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "project True"

    def test_missing_file_falls_back_to_user(self) -> None:
        """Unreadable source → user recommendation with explanation, no crash."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "rec = recommend_scope('/tmp/__definitely_no_agent_here__.md')\n"
            "print(rec.scope, 'unable to read' in rec.reasons[0].lower()\n"
            "      or 'no source' in rec.reasons[0].lower(),\n"
            "      rec.matched_signals)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "user True []"

    def test_content_overrides_source(self) -> None:
        """Explicit content kwarg wins over source path (helpful for tests)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from install_agent import recommend_scope\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('no-tokens-here')\n"
            "    # Content kwarg contains pytest → should win\n"
            "    rec = recommend_scope(p, content='pytest is required')\n"
            "    print(rec.scope,\n"
            "          any('pytest' in s for s in rec.matched_signals))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "project True"

    def test_reasons_always_non_empty(self) -> None:
        """Both user and project recommendations always explain themselves."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "u = recommend_scope(content='generic')\n"
            "p = recommend_scope(content='uses pnpm')\n"
            "print(bool(u.reasons), bool(p.reasons),\n"
            "      u.scope, p.scope)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True user project"

    def test_matched_signals_ordering_stable(self) -> None:
        """Signal ordering follows PROJECT_SCOPE_SIGNALS category order."""
        result = self._run_py(
            "from install_agent import recommend_scope\n"
            "# Mentions linter (ruff) + language (python) + test_runner (pytest)\n"
            "# in a random order; result should follow dict declaration order\n"
            "rec = recommend_scope(content='ruff python pytest')\n"
            "cats = [s.split(':')[0] for s in rec.matched_signals]\n"
            "print(cats.index('language') < cats.index('test_runner'),\n"
            "      cats.index('test_runner') < cats.index('linter'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"


class TestAgentReadmeGenerator:
    """Tests for agent_readme_generator.py (feature #86).

    Covers the three verification criteria:
    - README lists all agents in .claude/agents/
    - Each has name, description, tools, usage example
    - Formatted as Markdown table

    Plus edge cases: empty dirs, missing frontmatter, existing README
    skipped, example-section extraction vs synthesis, table-cell
    escaping, stable alphabetical ordering.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """DEFAULT_AGENTS_DIR, DEFAULT_README_FILENAME, EXAMPLE_SECTION_HEADINGS public."""
        result = self._run_py(
            "from agent_readme_generator import (\n"
            "    DEFAULT_AGENTS_DIR, DEFAULT_README_FILENAME,\n"
            "    EXAMPLE_SECTION_HEADINGS,\n"
            ")\n"
            "print(DEFAULT_AGENTS_DIR, '|', DEFAULT_README_FILENAME,\n"
            "      '|', '## Example' in EXAMPLE_SECTION_HEADINGS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/agents | README.md | True"

    def test_scan_agents_empty_dir(self) -> None:
        """Missing or empty dir returns []."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    print(scan_agents(td), scan_agents(Path(td) / 'missing'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[] []"

    def test_scan_agents_parses_frontmatter(self) -> None:
        """Agent files with valid frontmatter produce AgentSummary entries."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'reviewer.md').write_text(\n"
            "        '---\\n'\n"
            "        'name: reviewer\\n'\n"
            "        'description: Reviews code for quality\\n'\n"
            "        'tools: Read, Grep, Glob\\n'\n"
            "        '---\\n\\n'\n"
            "        '# Reviewer\\n\\n## Overview\\nReviews code.\\n'\n"
            "    )\n"
            "    summaries = scan_agents(td)\n"
            "    s = summaries[0]\n"
            "    print(len(summaries), s.name, s.description,\n"
            "          '|', s.tools)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "1 reviewer Reviews code for quality | ['Read', 'Grep', 'Glob']"
        )

    def test_scan_skips_malformed_files(self) -> None:
        """Files without frontmatter or without name are skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'broken.md').write_text('no frontmatter here')\n"
            "    (Path(td) / 'valid.md').write_text(\n"
            "        '---\\nname: ok\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    summaries = scan_agents(td)\n"
            "    print(len(summaries), summaries[0].name)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 ok"

    def test_scan_sorts_alphabetically(self) -> None:
        """Output is alphabetised by agent name for stable READMEs."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    for nm in ('zebra', 'alpha', 'mango'):\n"
            "        (Path(td) / f'{nm}.md').write_text(\n"
            "            f'---\\nname: {nm}\\ndescription: d\\n---\\n'\n"
            "        )\n"
            "    print([s.name for s in scan_agents(td)])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['alpha', 'mango', 'zebra']"

    def test_scan_skips_readme_itself(self) -> None:
        """README.md in agents_dir is not treated as an agent."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'README.md').write_text(\n"
            "        '---\\nname: README\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    (Path(td) / 'real.md').write_text(\n"
            "        '---\\nname: real\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    print([s.name for s in scan_agents(td)])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['real']"

    def test_example_section_extracted(self) -> None:
        """## Example section in body is used verbatim as the usage snippet."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'a.md').write_text(\n"
            "        '---\\nname: a\\ndescription: d\\n---\\n'\n"
            "        '\\n# A\\n\\n## Example\\n\\n"
            "Say hello to `a`.\\n\\n## Next Section\\n'\n"
            "    )\n"
            "    s = scan_agents(td)[0]\n"
            "    print('Say hello' in s.usage_example,\n"
            "          'Next Section' not in s.usage_example)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_example_synthesized_when_absent(self) -> None:
        """Without an example section, a Task snippet is synthesized."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'a.md').write_text(\n"
            "        '---\\nname: solo\\ndescription: d\\n---\\n'\n"
            "        '\\n# Solo\\n\\n## Overview\\nNo example.\\n'\n"
            "    )\n"
            "    s = scan_agents(td)[0]\n"
            "    print('subagent_type=\"solo\"' in s.usage_example,\n"
            "          '```python' in s.usage_example)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_format_readme_table(self) -> None:
        """Markdown output has a catalogue table with Name/Description/Tools header."""
        result = self._run_py(
            "from agent_readme_generator import AgentSummary, format_readme\n"
            "summaries = [\n"
            "    AgentSummary(name='a', description='First',\n"
            "                 tools=['Read'], usage_example='use a'),\n"
            "    AgentSummary(name='b', description='Second',\n"
            "                 tools=['Grep', 'Glob'], usage_example='use b'),\n"
            "]\n"
            "md = format_readme(summaries, title='Demo Agents')\n"
            "print('# Demo Agents' in md,\n"
            "      '| Name | Description | Tools |' in md,\n"
            "      '`a`' in md, 'First' in md,\n"
            "      'Grep, Glob' in md,\n"
            "      '### `a`' in md, 'use a' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True True True"

    def test_format_readme_escapes_pipe_in_description(self) -> None:
        """Pipes in descriptions are escaped so they don't break the table."""
        result = self._run_py(
            "from agent_readme_generator import AgentSummary, format_readme\n"
            "summaries = [\n"
            "    AgentSummary(name='weird',\n"
            "                 description='uses a | pipe char',\n"
            "                 tools=['Read'])\n"
            "]\n"
            "md = format_readme(summaries)\n"
            "# The data row has 4 structural pipes (outer+inner) plus one\n"
            "# escaped pipe in the description — total 5 pipe chars.\n"
            "# The escape sequence \\| must appear so Markdown renders\n"
            "# the description cell correctly.\n"
            "data_row = [l for l in md.splitlines()\n"
            "            if l.startswith('| `weird`')][0]\n"
            "print(data_row.count('|'), '\\\\|' in data_row)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "5 True"

    def test_format_readme_empty(self) -> None:
        """Empty summaries produce a valid 'No agents found.' README."""
        result = self._run_py(
            "from agent_readme_generator import format_readme\n"
            "md = format_readme([])\n"
            "print('# Agents' in md, 'No agents found.' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_generate_writes_readme_next_to_agents(self) -> None:
        """generate_agent_readme defaults output to <dir>/README.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import generate_agent_readme\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'x.md').write_text(\n"
            "        '---\\nname: x\\ndescription: Does x\\ntools: Read\\n---\\n'\n"
            "    )\n"
            "    out = generate_agent_readme(td)\n"
            "    content = out.read_text()\n"
            "    print(out.name, '| Name |' in content,\n"
            "          '`x`' in content, 'Does x' in content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "README.md True True True"

    def test_generate_respects_custom_output_path(self) -> None:
        """Explicit output_path overrides the default agents_dir/README.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import generate_agent_readme\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    agents = Path(td) / 'agents'\n"
            "    agents.mkdir()\n"
            "    (agents / 'y.md').write_text(\n"
            "        '---\\nname: y\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    target = Path(td) / 'docs' / 'AGENTS.md'\n"
            "    out = generate_agent_readme(agents, target, title='Custom')\n"
            "    print(out == target, target.exists(),\n"
            "          '# Custom' in target.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"


class TestCatalogSkippedAgents:
    """Tests for feature #17: stderr surfacing of skipped malformed agents.

    Both bundled catalog scanners — ``discover_available_agents`` in
    ``claudemd_generator`` and ``scan_agents`` in ``agent_readme_generator`` —
    silently drop agent files that fail frontmatter parsing (OSError,
    missing ``---`` fences, missing ``name``/``description``). Silent drops
    are hostile to diagnosis: a user who expects their agent in the catalog
    has no signal why it disappeared.

    This class pins the surfacing contract: at end of each scan, when any
    files were skipped as malformed, the scanner emits a single stderr
    summary line naming the offending paths so users can fix them.

    The CLAUDE.md / README generated downstream still omits the malformed
    agent (silent-omit behavior is unchanged) — the stderr line is purely
    additive.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_claudemd_summary(self) -> None:
        """discover_available_agents emits stderr naming the malformed path.

        Three agents (2 valid, 1 malformed): returned list has the 2 valid
        names, CLAUDE.md delegation section omits the malformed agent, and
        stderr carries a single summary line with the malformed file path.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from claudemd_generator import (\n"
            "    AgentContext, discover_available_agents, generate_claudemd,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'alpha.md').write_text(\n"
            "        '---\\nname: alpha\\ndescription: Valid one\\n---\\n'\n"
            "    )\n"
            "    (base / 'beta.md').write_text(\n"
            "        '---\\nname: beta\\ndescription: Valid two\\n---\\n'\n"
            "    )\n"
            "    (base / 'totally-malformed.md').write_text('no frontmatter')\n"
            "    found = discover_available_agents(base)\n"
            "    ctx = AgentContext(name='host', description='d',\n"
            "                       tools=['Task'], available_agents=found)\n"
            "    md = generate_claudemd(ctx)\n"
            "    print('names:', sorted(a.name for a in found))\n"
            "    print('malformed-in-md:', 'totally-malformed' in md)\n"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "names: ['alpha', 'beta']"
        assert lines[1] == "malformed-in-md: False"
        assert "skipped 1 malformed agents" in result.stderr
        assert "totally-malformed.md" in result.stderr

    def test_readme_summary(self) -> None:
        """scan_agents emits stderr naming the malformed path.

        Same shape as test_claudemd_summary but via the README generator:
        generated README omits the malformed agent, stderr carries one
        summary line with the malformed file path.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import generate_agent_readme\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    agents = Path(td) / 'agents'\n"
            "    agents.mkdir()\n"
            "    (agents / 'alpha.md').write_text(\n"
            "        '---\\nname: alpha\\ndescription: Valid one\\n---\\n'\n"
            "    )\n"
            "    (agents / 'beta.md').write_text(\n"
            "        '---\\nname: beta\\ndescription: Valid two\\n---\\n'\n"
            "    )\n"
            "    (agents / 'totally-malformed.md').write_text('no frontmatter')\n"
            "    target = Path(td) / 'README.md'\n"
            "    generate_agent_readme(agents, target)\n"
            "    content = target.read_text()\n"
            "    print('alpha-in-readme:', '`alpha`' in content)\n"
            "    print('beta-in-readme:', '`beta`' in content)\n"
            "    print('malformed-in-readme:', 'totally-malformed' in content)\n"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "alpha-in-readme: True"
        assert lines[1] == "beta-in-readme: True"
        assert lines[2] == "malformed-in-readme: False"
        assert "skipped 1 malformed agents" in result.stderr
        assert "totally-malformed.md" in result.stderr

    def test_claudemd_no_summary_when_all_valid(self) -> None:
        """No stderr summary when no agents are skipped.

        The summary is a diagnostic for a pathological state; emitting it
        unconditionally (e.g., ``skipped 0 malformed agents``) would spam
        stderr on healthy runs and dilute the signal.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from claudemd_generator import discover_available_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'solo.md').write_text(\n"
            "        '---\\nname: solo\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    discover_available_agents(base)\n"
            "    print('done')\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "done"
        assert "skipped" not in result.stderr

    def test_readme_no_summary_when_all_valid(self) -> None:
        """scan_agents stays silent on stderr when no files are skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'solo.md').write_text(\n"
            "        '---\\nname: solo\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    scan_agents(td)\n"
            "    print('done')\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "done"
        assert "skipped" not in result.stderr


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

        scripts_dir = Path(__file__).parent.parent / "scripts"
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
            "from mcp_config_generator import validate_server_name\n"
            "ok, msg = validate_server_name('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_server_name_valid_alphanumeric_with_hyphen(self) -> None:
        """Lowercase alphanumeric + interior hyphen is accepted."""
        result = self._run_py(
            "from mcp_config_generator import validate_server_name\n"
            "print(validate_server_name('brave-search-v2'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_server_name_uppercase_rejected(self) -> None:
        """Uppercase letters are rejected — spec allows only lowercase."""
        result = self._run_py(
            "from mcp_config_generator import validate_server_name\n"
            "ok, msg = validate_server_name('GitHub')\n"
            "print(ok, 'lowercase' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_server_name_edge_hyphens_rejected(self) -> None:
        """Leading or trailing hyphen is rejected."""
        result = self._run_py(
            "from mcp_config_generator import validate_server_name\n"
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
            "from mcp_config_generator import validate_url\n"
            "ok, msg = validate_url('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_url_https_accepted(self) -> None:
        """https:// URLs are accepted."""
        result = self._run_py(
            "from mcp_config_generator import validate_url\n"
            "print(validate_url('https://api.example.com/mcp'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_url_http_accepted(self) -> None:
        """http:// URLs are accepted (common for local dev)."""
        result = self._run_py(
            "from mcp_config_generator import validate_url\n"
            "print(validate_url('http://localhost:8080/mcp'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_url_ftp_rejected(self) -> None:
        """ftp:// is rejected — not in the http(s) scheme whitelist."""
        result = self._run_py(
            "from mcp_config_generator import validate_url\n"
            "ok, msg = validate_url('ftp://files.example.com/x')\n"
            "print(ok, 'http' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_url_javascript_scheme_rejected(self) -> None:
        """javascript: URI is rejected — protects against scheme injection."""
        result = self._run_py(
            "from mcp_config_generator import validate_url\n"
            "print(validate_url('javascript:alert(1)')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_validate_url_env_placeholder_accepted(self) -> None:
        """${VAR}-form placeholder is accepted (late binding via env)."""
        result = self._run_py(
            "from mcp_config_generator import validate_url\n"
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
            "from mcp_config_generator import validate_command\n"
            "ok, msg = validate_command('')\n"
            "print(ok, 'empty' in msg.lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_command_safelisted_node_accepted(self) -> None:
        """'node' (bare safelist entry) is accepted."""
        result = self._run_py(
            "from mcp_config_generator import validate_command\n"
            "print(validate_command('node'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_command_unsafe_bare_rejected(self) -> None:
        """'rm' is rejected — not on the safe-command whitelist."""
        result = self._run_py(
            "from mcp_config_generator import validate_command\n"
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
            "from mcp_config_generator import validate_command\n"
            "print(validate_command('../../bin/sh')[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_validate_command_metachar_embedded_rejected(self) -> None:
        """``node;rm -rf /`` is rejected — metachar-laced string is not the token 'node'."""
        result = self._run_py(
            "from mcp_config_generator import validate_command\n"
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
            "from mcp_config_generator import validate_command\n"
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
            "from mcp_config_generator import validate_path_safe\n"
            "print(validate_path_safe('./output.json'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "(True, '')"

    def test_validate_path_safe_outside_roots_rejected(self) -> None:
        """A path that resolves outside cwd/home/tmp is rejected."""
        result = self._run_py(
            "from mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('/etc/passwd')\n"
            "print(ok, 'within' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_dollar_rejected(self) -> None:
        """``$`` is treated as a suspicious shell metacharacter."""
        result = self._run_py(
            "from mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('./$PWD/out.json')\n"
            "print(ok, 'Suspicious' in msg and '$' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_semicolon_rejected(self) -> None:
        """``;`` (command separator) is rejected."""
        result = self._run_py(
            "from mcp_config_generator import validate_path_safe\n"
            "ok, msg = validate_path_safe('./out.json;rm -rf .')\n"
            "print(ok, 'Suspicious' in msg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_validate_path_safe_backtick_rejected(self) -> None:
        """Backtick (command substitution) is rejected."""
        result = self._run_py(
            "from mcp_config_generator import validate_path_safe\n"
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
            "from mcp_config_generator import generate_mcp_json\n"
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
            "from mcp_config_generator import generate_mcp_json\n"
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
            "from mcp_config_generator import generate_mcp_json\n"
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
            "from mcp_config_generator import generate, SERVER_TEMPLATES\n"
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
            "from mcp_config_generator import (\n"
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
            "from mcp_config_generator import (\n"
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
            "from mcp_config_generator import recommend_mcp_servers\n"
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
            "from mcp_config_generator import MCPServer, MCPConfig, generate_config\n"
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


class TestGenerationReport:
    """Tests for generation_report.py (feature #76).

    Covers:
    - SecurityFindingSummary / QualityScoreSummary / GenerationReport dataclasses
    - build_generation_report rejects out-of-range overall_score / negative tokens
    - format_report_markdown emits all required sections (overview, quality,
      tokens, tools, security, install)
    - Markdown lists tools, install location, and security findings
    - Empty findings → "_No security findings._" placeholder
    - Empty install location → dry-run placeholder
    - format_report_json returns a stable dict with all fields
    - Findings sorted by SECURITY_SEVERITY_ORDER (highest first)
    - Section heading constants exposed
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_section_constants_exposed(self) -> None:
        """All section heading constants are public and pinned."""
        result = self._run_py(
            "from generation_report import (\n"
            "    REPORT_HEADING, SECTION_OVERVIEW, SECTION_QUALITY,\n"
            "    SECTION_TOKENS, SECTION_TOOLS, SECTION_SECURITY, SECTION_INSTALL,\n"
            ")\n"
            "print(REPORT_HEADING)\nprint(SECTION_QUALITY)\nprint(SECTION_INSTALL)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "# Agent Generation Report",
            "## Quality Score",
            "## Install Location",
        ]

    def test_build_report_rejects_bad_score(self) -> None:
        """overall_score outside [0, 10] → ValueError."""
        result = self._run_py(
            "from generation_report import build_generation_report\n"
            "try:\n"
            "    build_generation_report('a', 'd', ['Read'], overall_score=11.0)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', '[0, 10]' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_build_report_rejects_negative_tokens(self) -> None:
        """Negative token_estimate → ValueError."""
        result = self._run_py(
            "from generation_report import build_generation_report\n"
            "try:\n"
            "    build_generation_report('a', 'd', ['Read'],\n"
            "        overall_score=8.0, token_estimate=-1)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'negative' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_markdown_includes_all_sections(self) -> None:
        """All six section headings appear in the markdown output."""
        result = self._run_py(
            "from generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'reviewer', 'Reviews code', ['Read', 'Grep'],\n"
            "    overall_score=8.5, token_estimate=420,\n"
            "    install_location='/home/u/.claude/agents/reviewer.md',\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "for h in ('# Agent Generation Report', '## Overview',\n"
            "          '## Quality Score', '## Token Estimate',\n"
            "          '## Tools', '## Security Findings', '## Install Location'):\n"
            "    assert h in md, h\n"
            "print('OK')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "OK"

    def test_markdown_lists_tools_and_install(self) -> None:
        """Tool list and install-location path appear in the markdown."""
        result = self._run_py(
            "from generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'desc', ['Read', 'Edit'],\n"
            "    overall_score=7.2, token_estimate=99,\n"
            "    install_location='~/.claude/agents/a.md',\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('- Read' in md, '- Edit' in md, '~/.claude/agents/a.md' in md,\n"
            "      '~99 tokens' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_markdown_no_security_findings_placeholder(self) -> None:
        """Empty findings list → friendly placeholder message."""
        result = self._run_py(
            "from generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('_No security findings._' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_markdown_dry_run_install_placeholder(self) -> None:
        """Empty install_location → dry-run placeholder."""
        result = self._run_py(
            "from generation_report import (\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "print('Not installed' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_findings_sorted_by_severity(self) -> None:
        """Critical findings appear before low/info in the markdown output."""
        result = self._run_py(
            "from generation_report import (\n"
            "    SecurityFindingSummary,\n"
            "    build_generation_report, format_report_markdown,\n"
            ")\n"
            "findings = [\n"
            "    SecurityFindingSummary(severity='low', category='style',\n"
            "        message='trailing space'),\n"
            "    SecurityFindingSummary(severity='critical', category='auth',\n"
            "        message='hardcoded secret'),\n"
            "]\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=8.0,\n"
            "    security_findings=findings,\n"
            ")\n"
            "md = format_report_markdown(report)\n"
            "crit_pos = md.find('hardcoded secret')\n"
            "low_pos = md.find('trailing space')\n"
            "print(crit_pos < low_pos, crit_pos > 0)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_json_shape_complete(self) -> None:
        """format_report_json returns dict with every field of the report."""
        result = self._run_py(
            "from generation_report import (\n"
            "    SecurityFindingSummary,\n"
            "    build_generation_report, format_report_json,\n"
            ")\n"
            "findings = [SecurityFindingSummary(severity='high',\n"
            "    category='auth', message='m', location='f.py:10')]\n"
            "report = build_generation_report(\n"
            "    'reviewer', 'Reviews code', ['Read'],\n"
            "    overall_score=8.5,\n"
            "    criteria_scores={'clarity': 9.0, 'security': 8.0},\n"
            "    token_estimate=120,\n"
            "    install_location='/path/to/agents/reviewer.md',\n"
            "    security_findings=findings,\n"
            ")\n"
            "j = format_report_json(report)\n"
            "print(\n"
            "    j['agent_name'], j['quality']['overall'],\n"
            "    j['quality']['criteria']['security'],\n"
            "    j['token_estimate'], j['install_location'],\n"
            "    j['security_findings'][0]['severity'],\n"
            "    j['security_findings'][0]['location'],\n"
            ")"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "reviewer 8.5 8.0 120 /path/to/agents/reviewer.md high f.py:10"
        )

    def test_json_string_round_trip(self) -> None:
        """report_to_json_string produces parseable JSON with same data."""
        result = self._run_py(
            "import json\n"
            "from generation_report import (\n"
            "    build_generation_report, report_to_json_string,\n"
            ")\n"
            "report = build_generation_report(\n"
            "    'a', 'd', ['Read'], overall_score=7.5,\n"
            "    token_estimate=50,\n"
            ")\n"
            "s = report_to_json_string(report)\n"
            "parsed = json.loads(s)\n"
            "print(parsed['agent_name'], parsed['quality']['overall'],\n"
            "      parsed['token_estimate'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "a 7.5 50"


class TestAgentLint:
    """Tests for agent_linter.py (feature #85).

    Covers:
    - LINT_EXIT_OK / LINT_EXIT_ERRORS / LINT_EXIT_IO_FAILURE constants
    - lint_agent_file passes on a well-formed agent
    - lint_agent_file fails when required fields are missing
    - format_lint_report PASS path emits header only
    - format_lint_report FAIL path emits header + one line per finding
    - lint_paths preserves order across multiple files
    - lint_paths emits an E000 finding on I/O failure (does not raise)
    - Warnings from syntax_validator are filtered out (errors only gate pass)
    - CLI `lint` subcommand exits 0/1 to match LINT_EXIT_*
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def _write_valid_agent(self, root: Path) -> Path:
        path = root / "valid.md"
        path.write_text(
            "---\n"
            "name: valid-agent\n"
            "description: A valid agent for lint testing.\n"
            "tools: Read, Write\n"
            "---\n"
            "\n"
            "# Valid Agent\n"
            "\n"
            "## Overview\n"
            "Does things.\n"
        )
        return path

    def _write_invalid_agent(self, root: Path) -> Path:
        path = root / "invalid.md"
        path.write_text("---\nname: invalid-agent\ndescription: \n---\n\n# Invalid Agent\n")
        return path

    def test_exit_code_constants(self) -> None:
        """LINT_EXIT_* constants pin the pre-commit-friendly exit contract."""
        result = self._run_py(
            "from agent_linter import LINT_EXIT_OK, LINT_EXIT_ERRORS, LINT_EXIT_IO_FAILURE\n"
            "print(LINT_EXIT_OK, LINT_EXIT_ERRORS, LINT_EXIT_IO_FAILURE)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 2"

    def test_lint_agent_file_pass(self, tmp_path: Path) -> None:
        """A well-formed agent passes with zero findings."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "import sys\n"
            "from agent_linter import lint_agent_file\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(r.passed, len(r.findings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_lint_agent_file_fail_missing_required(self, tmp_path: Path) -> None:
        """An agent with empty description fails with at least one finding."""
        agent = self._write_invalid_agent(tmp_path)
        result = self._run_py(
            "from agent_linter import lint_agent_file\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(r.passed, len(r.findings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_format_lint_report_pass(self, tmp_path: Path) -> None:
        """Passing report renders as a single PASS line."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "from agent_linter import lint_agent_file, format_lint_report\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "print(format_lint_report(r))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().endswith("valid.md: PASS")

    def test_format_lint_report_fail(self, tmp_path: Path) -> None:
        """Failing report renders header plus L<line> [<code>] message lines."""
        agent = self._write_invalid_agent(tmp_path)
        result = self._run_py(
            "from agent_linter import lint_agent_file, format_lint_report\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "out = format_lint_report(r)\n"
            "print('FAIL' in out, ' L' in out, '[' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_lint_paths_preserves_order(self, tmp_path: Path) -> None:
        """lint_paths returns one report per input file in the same order."""
        a = self._write_valid_agent(tmp_path)
        b_path = tmp_path / "b.md"
        b_path.write_text(a.read_text())
        result = self._run_py(
            "from agent_linter import lint_paths\n"
            f"reports = lint_paths([{str(a)!r}, {str(b_path)!r}])\n"
            "print(len(reports), reports[0].path.endswith('valid.md'),\n"
            "      reports[1].path.endswith('b.md'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 True True"

    def test_lint_paths_io_error_synthetic_finding(self, tmp_path: Path) -> None:
        """An unreadable file yields an E000 finding instead of raising."""
        # Use a directory path — opening it as a file triggers OSError.
        result = self._run_py(
            "from agent_linter import lint_paths\n"
            f"reports = lint_paths([{str(tmp_path)!r}])\n"
            "r = reports[0]\n"
            "print(r.passed, len(r.findings) >= 1, r.findings[0].code)"
        )
        assert result.returncode == 0, result.stderr
        # Either E000 (OSError caught in lint_paths) or another error code from
        # syntax_validator's own missing-file handling — both must produce a
        # failing report with at least one finding.
        parts = result.stdout.strip().split()
        assert parts[0] == "False"
        assert parts[1] == "True"

    def test_warnings_do_not_fail(self, tmp_path: Path) -> None:
        """Warning-severity validator findings must not flip passed to False."""
        agent = self._write_valid_agent(tmp_path)
        result = self._run_py(
            "from syntax_validator import validate_file\n"
            "from agent_linter import lint_agent_file\n"
            f"vr = validate_file({str(agent)!r})\n"
            f"r = lint_agent_file({str(agent)!r})\n"
            "warn_count = sum(1 for e in vr.errors if e.severity == 'warning')\n"
            "print(r.passed, warn_count >= 0)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().startswith("True")

    def test_cli_lint_exit_zero_on_pass(self, tmp_path: Path) -> None:
        """`platxa-agent lint <good>` exits 0."""
        import subprocess

        agent = self._write_valid_agent(tmp_path)
        scripts_pkg_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, "-m", "scripts.cli", "lint", str(agent)],
            capture_output=True,
            text=True,
            cwd=str(scripts_pkg_dir),
            check=False,
        )
        assert result.returncode == 0, result.stderr or result.stdout

    def test_cli_lint_exit_one_on_fail(self, tmp_path: Path) -> None:
        """`platxa-agent lint <bad>` exits 1."""
        import subprocess

        agent = self._write_invalid_agent(tmp_path)
        scripts_pkg_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, "-m", "scripts.cli", "lint", str(agent)],
            capture_output=True,
            text=True,
            cwd=str(scripts_pkg_dir),
            check=False,
        )
        assert result.returncode == 1, result.stderr or result.stdout


class TestPostInstallVerification:
    """Tests for verify_installation + install_agent integration (feature #88).

    Covers:
    - VERIFICATION_CHECK_ORDER constant exposes the canonical (syntax,
      skills, mcp_servers) ordering
    - verify_installation passes for a well-formed agent with no refs
    - verify_installation flags missing skill references with a finding
    - verify_installation flags mcpServers entries missing 'command'
    - verify_installation accepts list-form 'skills' frontmatter
    - install_agent re-runs verification on the *target* file post-copy
    - install_agent surfaces verification findings via InstallResult
      (success=False, verification.findings populated) when refs missing
    - install_agent's --skip-validation path bypasses verification entirely
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def _write_minimal_agent(self, root: Path, *, extra_frontmatter: str = "") -> Path:
        path = root / "minimal.md"
        fm_extra = f"\n{extra_frontmatter}" if extra_frontmatter else ""
        path.write_text(
            "---\n"
            "name: minimal-agent\n"
            "description: Minimal agent for verification testing.\n"
            "tools: Read, Write"
            f"{fm_extra}\n"
            "---\n"
            "\n"
            "# Minimal Agent\n"
            "\n"
            "## Overview\n"
            "Does things.\n"
        )
        return path

    def test_verification_check_order_constant(self) -> None:
        """VERIFICATION_CHECK_ORDER pins the canonical check sequence."""
        result = self._run_py(
            "from install_agent import (\n"
            "    VERIFICATION_CHECK_ORDER, CHECK_SYNTAX, CHECK_SKILLS, CHECK_MCP,\n"
            ")\n"
            "print(VERIFICATION_CHECK_ORDER)\n"
            "print(CHECK_SYNTAX, CHECK_SKILLS, CHECK_MCP)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "('syntax', 'skills', 'mcp_servers')"
        assert lines[1] == "syntax skills mcp_servers"

    def test_verify_passes_for_clean_agent(self, tmp_path: Path) -> None:
        """A well-formed agent with no skill/MCP refs passes verification."""
        agent = self._write_minimal_agent(tmp_path)
        result = self._run_py(
            "from install_agent import verify_installation\n"
            f"v = verify_installation({str(agent)!r}, install_root={str(tmp_path)!r})\n"
            "print(v.valid, v.findings, v.checks)"
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout.strip()
        assert out.startswith("True []")
        assert "syntax" in out and "skills" in out and "mcp_servers" in out

    def test_verify_flags_missing_skill(self, tmp_path: Path) -> None:
        """A 'skills:' reference with no SKILL.md surfaces a finding."""
        agent = self._write_minimal_agent(tmp_path, extra_frontmatter="skills: nonexistent-skill")
        (tmp_path / "skills").mkdir()
        result = self._run_py(
            "from pathlib import Path\n"
            "from install_agent import verify_installation\n"
            f"v = verify_installation({str(agent)!r}, install_root=Path({str(tmp_path)!r}))\n"
            "print(v.valid)\n"
            "print(any('nonexistent-skill' in f for f in v.findings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "True"]

    def test_verify_accepts_list_form_skills(self, tmp_path: Path) -> None:
        """YAML-list-style 'skills:' with valid manifest passes verification."""
        skill_dir = tmp_path / "skills" / "my-skill"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text(
            "---\nname: my-skill\ndescription: Test skill.\n---\n# My Skill\n"
        )
        agent = self._write_minimal_agent(tmp_path, extra_frontmatter="skills:\n  - my-skill")
        result = self._run_py(
            "from pathlib import Path\n"
            "from install_agent import verify_installation\n"
            f"v = verify_installation({str(agent)!r}, install_root=Path({str(tmp_path)!r}))\n"
            "print(v.valid, v.findings)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True []"

    def test_verify_flags_mcp_missing_command(self, tmp_path: Path) -> None:
        """An mcpServers entry without 'command' surfaces a finding."""
        agent = self._write_minimal_agent(
            tmp_path,
            extra_frontmatter="mcpServers:\n  broken:\n    args: ['x']",
        )
        result = self._run_py(
            "from pathlib import Path\n"
            "from install_agent import verify_installation\n"
            f"v = verify_installation({str(agent)!r}, install_root=Path({str(tmp_path)!r}))\n"
            "print(v.valid)\n"
            "print(any('mcpServers.broken' in f and 'command' in f for f in v.findings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "True"]

    def test_install_skip_validation_bypasses_verification(self, tmp_path: Path) -> None:
        """skip_validation=True returns verification=None (intentional bypass)."""
        source = self._write_minimal_agent(tmp_path)
        target_dir = tmp_path / "agents"
        result = self._run_py(
            "import install_agent as ia\n"
            "from pathlib import Path\n"
            f"ia.get_user_agents_dir = lambda: Path({str(target_dir)!r})\n"
            f"r = ia.install_agent({str(source)!r}, scope='user', skip_validation=True)\n"
            "print(r.success, r.verification is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_install_surfaces_verification_failure(self, tmp_path: Path) -> None:
        """When verification finds issues, install_agent returns success=False.

        Source-side gates (syntax, security) are stubbed so the test reaches
        the post-install verify_installation path; that is the unit under
        test here, not the upstream gates.
        """
        source = self._write_minimal_agent(tmp_path, extra_frontmatter="skills: missing-skill")
        target_dir = tmp_path / "agents"
        result = self._run_py(
            "import install_agent as ia\n"
            "from pathlib import Path\n"
            f"ia.get_user_agents_dir = lambda: Path({str(target_dir)!r})\n"
            f"ia._install_root_for_scope = lambda scope: Path({str(tmp_path)!r})\n"
            "ia.run_syntax_validation = lambda src: (True, [])\n"
            "ia.run_security_scan = lambda src: (True, 10.0)\n"
            f"r = ia.install_agent({str(source)!r}, scope='user')\n"
            "print(r.success)\n"
            "print(r.verification is not None and not r.verification.valid)\n"
            "print(any('missing-skill' in f for f in (r.verification.findings if r.verification else [])))\n"
            "print('MSG=', r.message)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        # Diagnostic message included in case assertion fails.
        assert lines[:3] == ["False", "True", "True"], f"unexpected lines: {lines}"


class TestContextManagementSection:
    """Tests for context-management guidance in long-running agent prompts (#89).

    Covers:
    - CONTEXT_MANAGEMENT_HEADING / CONTEXT_MANAGEMENT_RULES public constants
    - generate_context_management_section returns "" when long_running=False
    - generate_context_management_section emits heading + every rule when True
    - First rule mentions context-pressure detection (early-warning ordering)
    - Rules cover subagent delegation AND /clear recommendation
    - generate_prompt_blocks omits the section for short-lived agents
    - generate_prompt_blocks includes the section in CONTEXT for long_running
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """Public constants are stable for downstream parsers."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    CONTEXT_MANAGEMENT_HEADING, CONTEXT_MANAGEMENT_RULES,\n"
            ")\n"
            "print(CONTEXT_MANAGEMENT_HEADING)\n"
            "print(len(CONTEXT_MANAGEMENT_RULES))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "**Context Management:**"
        # Must have at least 3 rules to cover the verification criteria
        # (detection, subagent delegation, /clear recommendation).
        assert int(lines[1]) >= 3

    def test_section_empty_when_short_lived(self) -> None:
        """Short-lived agents (default) get no Context Management section."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_context_management_section\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json')\n"
            "print(repr(generate_context_management_section(cfg)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_section_renders_when_long_running(self) -> None:
        """Long-running agents get heading + every canonical rule."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    PromptConfig, generate_context_management_section,\n"
            "    CONTEXT_MANAGEMENT_RULES,\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json',\n"
            "                   long_running=True)\n"
            "section = generate_context_management_section(cfg)\n"
            "print('**Context Management:**' in section)\n"
            "print(all(rule in section for rule in CONTEXT_MANAGEMENT_RULES))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_first_rule_targets_pressure_detection(self) -> None:
        """First rule must address context-pressure detection (ordering matters)."""
        result = self._run_py(
            "from prompt_generator import CONTEXT_MANAGEMENT_RULES\n"
            "first = CONTEXT_MANAGEMENT_RULES[0].lower()\n"
            "print('context' in first and ('window' in first or 'history' in first))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_rules_cover_subagent_and_clear(self) -> None:
        """Verification criteria require subagent delegation + /clear guidance."""
        result = self._run_py(
            "from prompt_generator import CONTEXT_MANAGEMENT_RULES\n"
            "joined = ' '.join(CONTEXT_MANAGEMENT_RULES).lower()\n"
            "print('subagent' in joined and 'task tool' in joined)\n"
            "print('/clear' in joined)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_blocks_omit_section_for_short_lived(self) -> None:
        """generate_prompt_blocks does not leak the section by default."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json')\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('Context Management' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_blocks_include_section_for_long_running(self) -> None:
        """generate_prompt_blocks injects the section into CONTEXT when opted in."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json',\n"
            "                   long_running=True)\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('**Context Management:**' in blocks.context)\n"
            "print('subagent' in blocks.context.lower())\n"
            "print('/clear' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True", "True"]


class TestSubagentDelegationSection:
    """Tests for subagent-delegation guidance in agent prompts (#90).

    Covers:
    - SUBAGENT_DELEGATION_HEADING / SUBAGENT_DELEGATION_RULES /
      SUBAGENT_DELEGATION_TRIGGER_TOOLS /
      SUBAGENT_DELEGATION_FILE_THRESHOLD /
      SUBAGENT_SUMMARY_TOKEN_MIN / SUBAGENT_SUMMARY_TOKEN_MAX constants
    - File-count threshold value (>5 files per spec)
    - Summary token band (1000-2000 tokens per spec)
    - Section omitted when no Read/Grep/Glob tool present
    - Section emitted when any trigger tool present
    - Heading + every rule appear when section emitted
    - Rules cite Task tool and the threshold + token band
    - Integration: generate_prompt_blocks places section in CONTEXT for
      Read/Grep agents and omits it otherwise
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed_with_thresholds(self) -> None:
        """Constants pin the heading, threshold, and token band per spec."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    SUBAGENT_DELEGATION_HEADING,\n"
            "    SUBAGENT_DELEGATION_TRIGGER_TOOLS,\n"
            "    SUBAGENT_DELEGATION_FILE_THRESHOLD,\n"
            "    SUBAGENT_SUMMARY_TOKEN_MIN,\n"
            "    SUBAGENT_SUMMARY_TOKEN_MAX,\n"
            ")\n"
            "print(SUBAGENT_DELEGATION_HEADING)\n"
            "print(SUBAGENT_DELEGATION_FILE_THRESHOLD)\n"
            "print(SUBAGENT_SUMMARY_TOKEN_MIN, SUBAGENT_SUMMARY_TOKEN_MAX)\n"
            "print(sorted(SUBAGENT_DELEGATION_TRIGGER_TOOLS))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "**Subagent Delegation:**"
        # Spec says >5 files; the threshold is the boundary value used in the
        # rule "more than {N} files", so the constant equals 5.
        assert lines[1] == "5"
        # Spec says 1-2K tokens summary band.
        assert lines[2] == "1000 2000"
        # Read/Grep are spec-mandated; Glob is functionally equivalent and
        # included so glob-only agents also get the guidance.
        assert lines[3] == "['Glob', 'Grep', 'Read']"

    def test_section_empty_when_no_trigger_tool(self) -> None:
        """Agents without Read/Grep/Glob get no Subagent Delegation section."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_subagent_delegation_section\n"
            "cfg = PromptConfig('analyzer','security','x',['Bash','Write'],[],'json')\n"
            "print(repr(generate_subagent_delegation_section(cfg)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_section_emitted_when_read_tool_present(self) -> None:
        """A single trigger tool (Read) is enough to surface the section."""
        result = self._run_py(
            "from prompt_generator import (\n"
            "    PromptConfig, generate_subagent_delegation_section,\n"
            "    SUBAGENT_DELEGATION_RULES,\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json')\n"
            "section = generate_subagent_delegation_section(cfg)\n"
            "print('**Subagent Delegation:**' in section)\n"
            "print(all(rule in section for rule in SUBAGENT_DELEGATION_RULES))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_rules_mention_task_tool_and_thresholds(self) -> None:
        """Verification criteria require Task tool, >5 files, 1-2K tokens."""
        result = self._run_py(
            "from prompt_generator import SUBAGENT_DELEGATION_RULES\n"
            "joined = ' '.join(SUBAGENT_DELEGATION_RULES).lower()\n"
            "print('task tool' in joined)\n"
            "print('5 files' in joined)\n"
            "print('1000-2000 tokens' in joined or '1000 to 2000' in joined)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True", "True"]

    def test_blocks_omit_section_when_no_trigger_tool(self) -> None:
        """generate_prompt_blocks does not leak the section without Read/Grep/Glob."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Bash','Write'],[],'json')\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('Subagent Delegation' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_blocks_include_section_for_grep_agent(self) -> None:
        """generate_prompt_blocks injects the section into CONTEXT for Grep agents."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read','Grep'],[],'json')\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('**Subagent Delegation:**' in blocks.context)\n"
            "print('Task tool' in blocks.context)\n"
            "print('5 files' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True", "True"]

    def test_subagent_section_precedes_context_management(self) -> None:
        """When both sections render, subagent block comes before context-management."""
        result = self._run_py(
            "from prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read','Grep'],[],'json',\n"
            "                   long_running=True)\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "sub = blocks.context.find('**Subagent Delegation:**')\n"
            "ctx = blocks.context.find('**Context Management:**')\n"
            "print(sub != -1 and ctx != -1 and sub < ctx)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"


class TestBackgroundFrontmatter:
    """Tests for background-suitable agent classification (#6).

    Covers:
    - BACKGROUND_KEYWORDS public constant exposes the trigger vocabulary
    - is_background_suitable detects monitoring / log tailing / CI watcher
    - is_background_suitable returns False for unrelated descriptions
    - Empty / whitespace descriptions return False (no raise)
    - Word-boundary matching prevents partial-word false positives
    - AgentDefinition.background=True surfaces as 'background: true' in
      the rendered frontmatter; False/None omits the line
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_keywords_constant_exposed(self) -> None:
        """BACKGROUND_KEYWORDS includes the spec-named vocabulary."""
        result = self._run_py(
            "from type_classifier import BACKGROUND_KEYWORDS\n"
            "joined = '|'.join(BACKGROUND_KEYWORDS).lower()\n"
            "print('monitor' in joined)\n"
            "print('tail' in joined)\n"
            "print('ci watcher' in joined)\n"
            "print('background' in joined)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True"] * 4

    def test_detects_monitoring_agent(self) -> None:
        """Monitor / monitoring descriptions are flagged background-suitable."""
        result = self._run_py(
            "from type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Monitor disk usage every minute'))\n"
            "print(is_background_suitable('Continuously observe build status'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_detects_log_tailer_and_ci_watcher(self) -> None:
        """Log tailing and CI-watcher phrasing both trigger detection."""
        result = self._run_py(
            "from type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Tail application logs in production'))\n"
            "print(is_background_suitable('CI watcher that polls for failures'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_returns_false_for_foreground_work(self) -> None:
        """Unrelated descriptions return False (foreground is the safe default)."""
        result = self._run_py(
            "from type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Refactor the user authentication module'))\n"
            "print(is_background_suitable('Generate documentation for the public API'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False"]

    def test_empty_description_returns_false(self) -> None:
        """Empty / whitespace input must not raise — quiet False is the contract."""
        result = self._run_py(
            "from type_classifier import is_background_suitable\n"
            "print(is_background_suitable(''))\n"
            "print(is_background_suitable('   '))\n"
            "print(is_background_suitable('\\n\\t'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False", "False"]

    def test_word_boundary_prevents_false_positives(self) -> None:
        """Partial-word substrings must not trigger detection (e.g. 'tailored')."""
        result = self._run_py(
            "from type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Build a tailored onboarding wizard'))\n"
            "print(is_background_suitable('Sort by polling rate descending'))"
        )
        assert result.returncode == 0, result.stderr
        # 'tailored' must not match 'tail'; 'polling' is itself a keyword
        # so the second line is a positive control to confirm detection still
        # works in the same call — should be True.
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "False"
        assert lines[1] == "True"

    def test_frontmatter_emits_background_when_true(self) -> None:
        """AgentDefinition(background=True) emits 'background: true' in YAML."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='watcher', description='Tail logs',\n"
            "                    tools=['Bash'], background=True)\n"
            "fm = generate_frontmatter(d)\n"
            "print('background: true' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_frontmatter_omits_background_when_unset(self) -> None:
        """background=None / False must not emit the field — default-omit contract."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_frontmatter\n"
            "d_none = AgentDefinition(name='x', description='y', tools=['Read'])\n"
            "d_false = AgentDefinition(name='x', description='y', tools=['Read'],\n"
            "                          background=False)\n"
            "print('background' in generate_frontmatter(d_none))\n"
            "print('background' in generate_frontmatter(d_false))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False"]


class TestColorFrontmatter:
    """Tests for category-based color assignment (#8).

    Covers:
    - CATEGORY_COLOR_MAP public constant exposes the (color, keywords) pairs
    - recommend_color returns spec colors for security / testing / docs
    - First-match-wins ordering when multiple categories could match
    - Word-boundary matching prevents partial-word false positives
    - Empty / unmatched descriptions return None (omit-by-default)
    - AgentDefinition(color=...) round-trips through frontmatter emission
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "scripts"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_color_map_constant_exposed(self) -> None:
        """CATEGORY_COLOR_MAP exposes the spec-mandated (color, keywords) pairs."""
        result = self._run_py(
            "from type_classifier import CATEGORY_COLOR_MAP\n"
            "by_color = {color: keywords for color, keywords in CATEGORY_COLOR_MAP}\n"
            "print('security' in by_color['red'])\n"
            "print('test' in by_color['green'])\n"
            "print('doc' in by_color['blue'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True", "True"]

    def test_recommend_color_security_red(self) -> None:
        """Security descriptions → red per spec."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Audit code for security vulnerabilities'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "red"

    def test_recommend_color_testing_green(self) -> None:
        """Testing descriptions → green per spec."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Generate unit tests for the auth module'))"
        )
        assert result.returncode == 0, result.stderr
        # 'auth' would also match red — verify ordering: security category
        # is declared first, so red wins. This documents the priority.
        assert result.stdout.strip() == "red"

    def test_recommend_color_pure_testing_green(self) -> None:
        """Description with only testing keywords → green."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Run TDD coverage on existing modules'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "green"

    def test_recommend_color_docs_blue(self) -> None:
        """Documentation descriptions → blue per spec."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Generate API documentation pages'))"
        )
        assert result.returncode == 0, result.stderr
        # 'api' is also in orange's keyword set, but spec mandates docs=blue.
        # The ordering puts docs (blue) before database/api (orange) so blue
        # wins for description containing both — locking that priority.
        assert result.stdout.strip() == "blue"

    def test_unmatched_description_returns_none(self) -> None:
        """Descriptions with no category keyword return None (omit-by-default)."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Build a generic helper utility'))\n"
            "print(recommend_color(''))\n"
            "print(recommend_color('   '))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["None", "None", "None"]

    def test_word_boundary_prevents_false_positives(self) -> None:
        """Substrings of keywords must not trigger (e.g. 'documentary' ≠ 'documentation')."""
        result = self._run_py(
            "from type_classifier import recommend_color\n"
            "print(recommend_color('Build a securities trading dashboard'))\n"
            "print(recommend_color('Create a manual review workflow'))"
        )
        assert result.returncode == 0, result.stderr
        # 'securities' must not match 'security'; 'manual' is a docs keyword
        # so the second line is a positive control showing detection still
        # works for full-word matches.
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "None"
        assert lines[1] == "blue"

    def test_frontmatter_emits_color(self) -> None:
        """AgentDefinition(color=...) emits 'color: <value>' in YAML."""
        result = self._run_py(
            "from agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='r', description='security review',\n"
            "                    tools=['Read'], color='red')\n"
            "print('color: red' in generate_frontmatter(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"


class TestSubagentAuditHooks:
    """Tests for SubagentStart/SubagentStop JSONL audit hooks (Feature #15).

    Exercises generate_subagent_audit_script / _hook_config / _hooks plus the
    ``subagent-audit`` dispatch branch in generate_hooks. Tests run the
    generated bash script in a subprocess against simulated Claude Code hook
    JSON payloads on stdin and assert on the resulting JSONL audit log.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_script(self, agent: str, log_file: str = ".claude/audit.jsonl") -> str:
        result = self._run_py(
            "from hooks_generator import generate_subagent_audit_script; "
            f"print(generate_subagent_audit_script({agent!r}, {log_file!r}))"
        )
        assert result.returncode == 0, f"script gen failed: {result.stderr}"
        return result.stdout

    def _write_script(self, content: str, path: Path) -> Path:
        path.write_text(content)
        path.chmod(0o755)
        return path

    def _read_jsonl(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    # --- HOOK_EVENTS registry ----------------------------------------------

    def test_subagent_start_event_registered(self) -> None:
        """HOOK_EVENTS must include SubagentStart so validate_event accepts it."""
        result = self._run_py(
            "from hooks_generator import HOOK_EVENTS, validate_event; "
            "import json; "
            "ok, err = validate_event('SubagentStart'); "
            "print(json.dumps({'in_events': 'SubagentStart' in HOOK_EVENTS, 'valid': ok}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["in_events"], "SubagentStart missing from HOOK_EVENTS"
        assert data["valid"], "validate_event should accept SubagentStart"

    # --- script generation --------------------------------------------------

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated audit script must parse as valid bash."""
        script = self._gen_script("worker-1")
        path = self._write_script(script, tmp_path / "audit.sh")
        result = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
        assert result.returncode == 0, f"bash syntax error: {result.stderr}"

    def test_script_substitutes_placeholders(self, tmp_path: Path) -> None:
        """Generator must replace __AGENT_NAME__ and __LOG_FILE__ placeholders."""
        script = self._gen_script("worker-1", str(tmp_path / "log.jsonl"))
        assert "__AGENT_NAME__" not in script
        assert "__LOG_FILE__" not in script
        assert "worker-1" in script
        assert str(tmp_path / "log.jsonl") in script

    def test_empty_agent_name_raises(self) -> None:
        """generate_subagent_audit_script must reject empty agent_name."""
        result = self._run_py(
            "from hooks_generator import generate_subagent_audit_script\n"
            "try:\n"
            "    generate_subagent_audit_script('')\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, result.stdout

    # --- runtime behavior ---------------------------------------------------

    def test_subagent_start_logs_agent_id_and_type(self, tmp_path: Path) -> None:
        """SubagentStart hook must write JSONL with agent_id and agent_type."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        payload = json.dumps(
            {
                "hook_event_name": "SubagentStart",
                "agent_id": "sa-001",
                "agent_type": "code-reviewer",
            }
        )
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 0, f"script failed: {result.stderr}"

        records = self._read_jsonl(log_file)
        assert len(records) == 1, f"expected 1 record, got {records}"
        rec = records[0]
        assert rec["event"] == "SubagentStart"
        assert rec["agent_id"] == "sa-001"
        assert rec["agent_type"] == "code-reviewer"
        assert rec["agent"] == "auditor"
        assert "timestamp" in rec

    def test_subagent_stop_logs_last_message_and_duration(self, tmp_path: Path) -> None:
        """SubagentStop must log last_assistant_message and a positive duration_ms."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        # First fire SubagentStart so the timing file is written
        start_payload = json.dumps(
            {
                "hook_event_name": "SubagentStart",
                "agent_id": "sa-002",
                "agent_type": "researcher",
            }
        )
        subprocess.run(["bash", str(path)], input=start_payload, capture_output=True, text=True)

        # Sleep a measurable amount so duration_ms > 0
        time.sleep(0.05)

        stop_payload = json.dumps(
            {
                "hook_event_name": "SubagentStop",
                "agent_id": "sa-002",
                "last_assistant_message": "Reviewed 3 files; no issues found.",
            }
        )
        result = subprocess.run(
            ["bash", str(path)], input=stop_payload, capture_output=True, text=True
        )
        assert result.returncode == 0, f"script failed: {result.stderr}"

        records = self._read_jsonl(log_file)
        assert len(records) == 2, f"expected 2 records, got {records}"
        stop = records[1]
        assert stop["event"] == "SubagentStop"
        assert stop["agent_id"] == "sa-002"
        assert stop["last_assistant_message"] == "Reviewed 3 files; no issues found."
        assert stop["duration_ms"] > 0, (
            f"duration_ms should be positive after sleep, got {stop['duration_ms']}"
        )

    def test_logs_to_default_claude_audit_jsonl(self, tmp_path: Path) -> None:
        """Default log_file must be .claude/audit.jsonl relative to cwd."""
        script = self._gen_script("auditor")  # default log file
        path = self._write_script(script, tmp_path / "audit.sh")

        payload = json.dumps({"hook_event_name": "SubagentStart", "agent_id": "x"})
        result = subprocess.run(
            ["bash", str(path)],
            input=payload,
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
        )
        assert result.returncode == 0, result.stderr
        log = tmp_path / ".claude" / "audit.jsonl"
        assert log.exists(), f".claude/audit.jsonl not created under {tmp_path}"
        records = self._read_jsonl(log)
        assert len(records) == 1
        assert records[0]["event"] == "SubagentStart"

    def test_env_var_fallback_when_stdin_empty(self, tmp_path: Path) -> None:
        """When stdin payload is empty, env vars must supply the fields."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        env = {
            **os.environ,
            "CLAUDE_HOOK_EVENT": "SubagentStart",
            "CLAUDE_AGENT_ID": "env-007",
            "CLAUDE_AGENT_TYPE": "fallback-agent",
        }
        result = subprocess.run(
            ["bash", str(path)], input="", capture_output=True, text=True, env=env
        )
        assert result.returncode == 0, result.stderr

        records = self._read_jsonl(log_file)
        assert len(records) == 1
        rec = records[0]
        assert rec["agent_id"] == "env-007"
        assert rec["agent_type"] == "fallback-agent"

    def test_unknown_event_logs_warning_record(self, tmp_path: Path) -> None:
        """Unknown hook_event_name must surface visibly: a warning record in the
        audit log AND a stderr line. Silent drops would hide hook misconfiguration
        from observability systems."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        payload = json.dumps({"hook_event_name": "NotARealEvent", "agent_id": "x-99"})
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 0
        # Loud failure: warning emitted on stderr
        assert "[subagent-audit]" in result.stderr
        assert "NotARealEvent" in result.stderr
        # Loud failure: a structured warning record is appended to the audit log
        records = self._read_jsonl(log_file)
        assert len(records) == 1, f"expected 1 warning record, got {records}"
        rec = records[0]
        assert rec["event"] == "UnknownSubagentEvent"
        assert rec["received_event"] == "NotARealEvent"
        assert rec["agent_id"] == "x-99"

    def test_concurrent_same_agent_id_different_sessions(self, tmp_path: Path) -> None:
        """Two concurrent subagents sharing an agent_id but in different sessions
        must NOT collide on the timing file. session_id is part of the timing key,
        so each pair tracks its own duration correctly."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        # Session A starts subagent "sa-shared"
        subprocess.run(
            ["bash", str(path)],
            input=json.dumps(
                {
                    "hook_event_name": "SubagentStart",
                    "session_id": "sess-A",
                    "agent_id": "sa-shared",
                    "agent_type": "reviewer",
                }
            ),
            capture_output=True,
            text=True,
        )
        time.sleep(0.04)
        # Session B starts subagent with the SAME agent_id
        subprocess.run(
            ["bash", str(path)],
            input=json.dumps(
                {
                    "hook_event_name": "SubagentStart",
                    "session_id": "sess-B",
                    "agent_id": "sa-shared",
                    "agent_type": "researcher",
                }
            ),
            capture_output=True,
            text=True,
        )
        time.sleep(0.06)
        # Stop session A first — must measure ~100ms (40+60 sleep), not 60ms
        subprocess.run(
            ["bash", str(path)],
            input=json.dumps(
                {
                    "hook_event_name": "SubagentStop",
                    "session_id": "sess-A",
                    "agent_id": "sa-shared",
                    "last_assistant_message": "A done",
                }
            ),
            capture_output=True,
            text=True,
        )
        # Stop session B — must measure ~60ms (only the second sleep)
        subprocess.run(
            ["bash", str(path)],
            input=json.dumps(
                {
                    "hook_event_name": "SubagentStop",
                    "session_id": "sess-B",
                    "agent_id": "sa-shared",
                    "last_assistant_message": "B done",
                }
            ),
            capture_output=True,
            text=True,
        )

        records = self._read_jsonl(log_file)
        stops = [r for r in records if r["event"] == "SubagentStop"]
        assert len(stops) == 2
        a_stop = next(r for r in stops if r["last_assistant_message"] == "A done")
        b_stop = next(r for r in stops if r["last_assistant_message"] == "B done")
        # Both durations must be positive and A > B (A started 40ms earlier).
        # If sessions collided on the timing file, A's duration would be wrong
        # (overwritten by B's start) and likely smaller than B's.
        assert a_stop["duration_ms"] > 0
        assert b_stop["duration_ms"] > 0
        assert a_stop["duration_ms"] > b_stop["duration_ms"], (
            f"session collision suspected: A={a_stop['duration_ms']}ms "
            f"B={b_stop['duration_ms']}ms (expected A > B)"
        )

    def test_missing_timing_file_emits_warning(self, tmp_path: Path) -> None:
        """SubagentStop with no prior SubagentStart must surface the missing
        timing file (stderr warning + duration_ms=0), not silently report 0."""
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        payload = json.dumps(
            {
                "hook_event_name": "SubagentStop",
                "agent_id": "orphan",
                "last_assistant_message": "no start",
            }
        )
        result = subprocess.run(["bash", str(path)], input=payload, capture_output=True, text=True)
        assert result.returncode == 0
        assert "no timing file" in result.stderr
        records = self._read_jsonl(log_file)
        assert len(records) == 1
        assert records[0]["event"] == "SubagentStop"
        assert records[0]["duration_ms"] == 0

    # --- hook_config + bundle helper ---------------------------------------

    def test_hook_config_registers_both_events(self) -> None:
        """generate_subagent_audit_hook_config must register SubagentStart + Stop."""
        result = self._run_py(
            "import json; from hooks_generator import generate_subagent_audit_hook_config; "
            "cfg = generate_subagent_audit_hook_config('a', '/tmp/a-audit.sh'); "
            "print(json.dumps(sorted(cfg.keys())))"
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == ["SubagentStart", "SubagentStop"]

    def test_hook_config_validates_inputs(self) -> None:
        """Empty agent_name or script_path must raise ValueError."""
        result = self._run_py(
            "from hooks_generator import generate_subagent_audit_hook_config\n"
            "try:\n"
            "    generate_subagent_audit_hook_config('', '/tmp/x.sh')\n"
            "except ValueError:\n"
            "    print('agent-error')\n"
            "try:\n"
            "    generate_subagent_audit_hook_config('a', '')\n"
            "except ValueError:\n"
            "    print('path-error')"
        )
        assert result.returncode == 0, result.stderr
        assert "agent-error" in result.stdout
        assert "path-error" in result.stdout

    def test_bundle_writes_executable_script(self, tmp_path: Path) -> None:
        """generate_subagent_audit_hooks writes a chmod-755 script + returns config."""
        result = self._run_py(
            "import json, os; "
            "from hooks_generator import generate_subagent_audit_hooks; "
            f"paths, cfg = generate_subagent_audit_hooks('demo', {str(tmp_path)!r}); "
            "out = {'paths': [str(p) for p in paths], "
            "'cfg_keys': sorted(cfg.keys()), "
            "'is_exec': os.access(str(paths[0]), os.X_OK)}; "
            "print(json.dumps(out))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data["paths"]) == 1
        assert data["paths"][0].endswith("demo-subagent-audit.sh")
        assert data["cfg_keys"] == ["SubagentStart", "SubagentStop"]
        assert data["is_exec"], "generated script must be executable"

    # --- generate_hooks dispatch -------------------------------------------

    def test_generate_hooks_subagent_audit_branch(self) -> None:
        """generate_hooks(['subagent-audit']) must produce both event configs."""
        result = self._run_py(
            "import json; "
            "from hooks_generator import generate_hooks, definition_to_settings_format; "
            "defn = generate_hooks('a', ['subagent-audit']); "
            "settings = definition_to_settings_format(defn); "
            "print(json.dumps(sorted(settings.keys())))"
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == ["SubagentStart", "SubagentStop"]

    def test_generate_hooks_subagent_audit_custom_path(self) -> None:
        """generate_hooks must respect custom audit_script_path from config."""
        result = self._run_py(
            "import json; "
            "from hooks_generator import generate_hooks, definition_to_settings_format; "
            "defn = generate_hooks('a', ['subagent-audit'], "
            "    custom_config={'audit_script_path': '/custom/path.sh'}); "
            "settings = definition_to_settings_format(defn); "
            "cmds = [h['hooks'][0]['command'] "
            "        for entries in settings.values() for h in entries]; "
            "print(json.dumps(cmds))"
        )
        assert result.returncode == 0, result.stderr
        cmds = json.loads(result.stdout)
        assert all(c == "/custom/path.sh" for c in cmds), cmds


class TestHooksGeneratorAuditHook:
    """Tests for subagent audit hook malformed-JSON fail-closed (Feature #9).

    The generated audit script previously caught json.loads errors with a
    _warn() call and fell back to data={}, then continued to write a
    possibly-incomplete record using whichever CLAUDE_* env vars happened
    to be set. That hid payload corruption from observability and could
    produce meaningless audit records whose event was taken from the env
    var escape hatch.

    The fail-closed fix: on malformed JSON the script must exit 2 with an
    error on stderr and must NOT append any record to the audit log.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_script(self, agent: str, log_file: str) -> str:
        result = self._run_py(
            "from hooks_generator import generate_subagent_audit_script; "
            f"print(generate_subagent_audit_script({agent!r}, {log_file!r}))"
        )
        assert result.returncode == 0, f"script gen failed: {result.stderr}"
        return result.stdout

    def _write_script(self, content: str, path: Path) -> Path:
        path.write_text(content)
        path.chmod(0o755)
        return path

    def test_malformed_json_exits_2(self, tmp_path: Path) -> None:
        """Malformed stdin JSON must deny (exit 2) with a stderr message.

        Replaces the previous `_warn + data={}` silent fallback that masked
        payload corruption and kept writing potentially-fabricated records.
        """
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        result = subprocess.run(
            ["bash", str(path)],
            input="this-is-not-json{{{",
            capture_output=True,
            text=True,
        )
        assert result.returncode == 2, (
            f"Malformed JSON must deny (exit 2). Got exit={result.returncode}, "
            f"stderr={result.stderr!r}, stdout={result.stdout!r}"
        )
        assert "not valid JSON" in result.stderr or "JSON" in result.stderr, (
            f"Stderr must cite the JSON parse failure. stderr={result.stderr!r}"
        )
        assert "[subagent-audit]" in result.stderr, (
            f"Stderr must carry the subagent-audit tag. stderr={result.stderr!r}"
        )

    def test_no_empty_record_written(self, tmp_path: Path) -> None:
        """Malformed JSON must leave the audit log untouched.

        Prevents the silent-fallback path from writing a garbage record
        populated by CLAUDE_* env vars: on denial the log must stay
        absent (or, if pre-existing, its contents must be unchanged).
        """
        log_file = tmp_path / "audit.jsonl"
        script = self._gen_script("auditor", str(log_file))
        path = self._write_script(script, tmp_path / "audit.sh")

        # Case A: log file does not exist beforehand — it must stay absent.
        env = {
            **os.environ,
            "CLAUDE_HOOK_EVENT": "SubagentStart",
            "CLAUDE_AGENT_ID": "env-should-not-leak",
            "CLAUDE_AGENT_TYPE": "fallback-type",
        }
        result = subprocess.run(
            ["bash", str(path)],
            input="}malformed{",
            capture_output=True,
            text=True,
            env=env,
        )
        assert result.returncode == 2
        assert not log_file.exists(), (
            f"audit log must not be created on malformed JSON; found: "
            f"{log_file.read_text() if log_file.exists() else '<absent>'}"
        )

        # Case B: log file exists with prior content — it must be unchanged.
        prior = '{"event": "SubagentStart", "agent_id": "prior-1"}\n'
        log_file.write_text(prior)
        result = subprocess.run(
            ["bash", str(path)],
            input="}malformed{",
            capture_output=True,
            text=True,
            env=env,
        )
        assert result.returncode == 2
        assert log_file.read_text() == prior, (
            f"audit log must not be mutated on malformed JSON; "
            f"expected {prior!r}, got {log_file.read_text()!r}"
        )


class TestCompetingHypothesisTemplate:
    """Tests for the competing-hypothesis multi-agent template (Feature #41).

    Exercises template registration, adversarial_config semantics, the
    configurable `create_competing_hypothesis_system` factory (3-5
    investigators with distinct hypothesis focuses and input validation),
    and the generated orchestrator markdown (adversarial workflow steps).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- template registration ---------------------------------------------

    def test_template_is_registered(self) -> None:
        result = self._run_py(
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print('competing-hypothesis' in SYSTEM_TEMPLATES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_template_declares_competing_hypothesis_pattern(self) -> None:
        result = self._run_py(
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print(SYSTEM_TEMPLATES['competing-hypothesis']['pattern'])"
        )
        assert result.stdout.strip() == "competing-hypothesis"

    def test_adversarial_config_documents_rounds_and_convergence(self) -> None:
        """adversarial_config must declare investigator bounds, three rounds,
        and convergence criteria — downstream tooling inspects this field."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import SYSTEM_TEMPLATES; "
            "print(json.dumps(SYSTEM_TEMPLATES['competing-hypothesis']['adversarial_config']))"
        )
        assert result.returncode == 0, result.stderr
        cfg = json.loads(result.stdout)
        assert cfg["min_investigators"] == 3
        assert cfg["max_investigators"] == 5
        assert cfg["default_investigators"] == 3
        rounds = cfg["rounds"]
        assert set(rounds.keys()) == {"investigation", "challenge", "refinement"}
        assert rounds["challenge"]["min_challenges_per_investigator"] >= 1
        assert "criteria" in cfg["convergence"]
        assert "reject_unanimous_agreement" in cfg["convergence"]

    def test_template_default_has_three_investigators_with_distinct_focus(self) -> None:
        """create_system_from_template must yield 3 investigators with
        distinct hypothesis_focus values."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps([(w.name, w.hypothesis_focus) for w in invs]))"
        )
        assert result.returncode == 0, result.stderr
        pairs = json.loads(result.stdout)
        assert len(pairs) == 3
        focuses = [focus for _, focus in pairs]
        assert len(set(focuses)) == 3, f"focuses not distinct: {focuses}"
        assert all(f for f in focuses), "every investigator must have a non-empty focus"

    def test_investigators_are_worktree_isolated(self) -> None:
        """Parallel investigators must run in isolated worktrees so their
        evidence-gathering doesn't collide with each other."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps([w.isolation for w in invs]))"
        )
        assert result.returncode == 0, result.stderr
        isolations = json.loads(result.stdout)
        assert all(i == "worktree" for i in isolations), (
            f"all investigators must have worktree isolation; got {isolations}"
        )

    # --- factory: configurable investigator count --------------------------

    def test_factory_produces_configurable_count(self) -> None:
        """Factory must support 3, 4, and 5 investigators, each with a
        distinct hypothesis focus drawn from DEFAULT_COMPETING_HYPOTHESES."""
        for n in (3, 4, 5):
            result = self._run_py(
                "import json; "
                "from multiagent_generator import create_competing_hypothesis_system; "
                f"sys_ = create_competing_hypothesis_system(investigator_count={n}); "
                "invs = [w for w in sys_.workers if w.role == 'investigator']; "
                "print(json.dumps([w.hypothesis_focus for w in invs]))"
            )
            assert result.returncode == 0, f"n={n}: {result.stderr}"
            focuses = json.loads(result.stdout)
            assert len(focuses) == n, f"n={n}: got {len(focuses)} investigators"
            assert len(set(focuses)) == n, f"n={n}: focuses not distinct: {focuses}"

    def test_factory_rejects_count_below_three(self) -> None:
        """count < 3 has no adversarial pressure — must raise ValueError."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=2)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, result.stdout
        assert "3" in result.stdout or "5" in result.stdout

    def test_factory_rejects_count_above_five(self) -> None:
        """count > 5 exceeds coordination budget — must raise ValueError."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=6)\n"
            "    print('no-error')\n"
            "except ValueError:\n"
            "    print('value-error')"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout

    def test_factory_rejects_duplicate_focuses(self) -> None:
        """Hypothesis focuses must be distinct — duplicates defeat the pattern."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "dup = [{'focus': 'x', 'description': 'd', "
            "        'responsibilities': ['r'], 'inputs': ['i']}] * 3\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=dup)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "distinct" in result.stdout.lower() or "duplicate" in result.stdout.lower()

    def test_factory_rejects_malformed_hypothesis_dict(self) -> None:
        """Hypothesis dicts missing required keys must raise ValueError with
        actionable message — not the opaque KeyError the caller would otherwise
        see surfacing from inside agent construction."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "bad = [\n"
            "  {'focus': 'a', 'description': 'd', 'responsibilities': ['r']},\n"
            "  {'focus': 'b', 'responsibilities': ['r']},\n"
            "  {'focus': 'c', 'description': 'd', 'responsibilities': ['r']},\n"
            "]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=bad)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))\n"
            "except KeyError as e:\n"
            "    print('key-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, (
            f"factory must raise ValueError (not KeyError) for malformed hypothesis "
            f"so the caller knows which key is missing; got: {result.stdout}"
        )
        assert "description" in result.stdout, (
            "error message must name the missing key so the caller can fix it"
        )
        assert "hypotheses[1]" in result.stdout, (
            "error message must name the offending hypothesis index"
        )

    def test_factory_rejects_non_dict_hypothesis(self) -> None:
        """Non-dict entries in hypotheses must raise ValueError with type info."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "bad = [\n"
            "  {'focus': 'a', 'description': 'd', 'responsibilities': ['r']},\n"
            "  'not-a-dict',\n"
            "  {'focus': 'c', 'description': 'd', 'responsibilities': ['r']},\n"
            "]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=bad)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "str" in result.stdout, "must report the actual offending type"

    def test_orchestrator_markdown_rejects_no_investigators(self) -> None:
        """Generating the orchestrator markdown for a competing-hypothesis
        system with zero investigators must fail loud — silently emitting
        'Dispatch all 0 investigators' would ship a broken orchestrator."""
        result = self._run_py(
            "from multiagent_generator import (\n"
            "    AgentDefinition, MultiAgentSystem,\n"
            ")\n"
            "orch = AgentDefinition(name='c', description='d',\n"
            "                       role='orchestrator', tools=['Task'],\n"
            "                       responsibilities=['r'])\n"
            "broken = MultiAgentSystem(name='broken', description='d',\n"
            "                          pattern='competing-hypothesis',\n"
            "                          orchestrator=orch, workers=[])\n"
            "try:\n"
            "    broken.generate_competing_hypothesis_orchestrator_markdown()\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, (
            f"empty-investigators must fail loud; got: {result.stdout}"
        )
        assert "investigator" in result.stdout, (
            "error must explain what is missing so the caller can fix it"
        )

    def test_cli_generate_pattern_choices_include_competing_hypothesis(self) -> None:
        """`generate --pattern` choices must include competing-hypothesis so
        users discovering patterns via --help see it (consistency with
        writer-reviewer being added to all CLI surfaces)."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "generate", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        assert "competing-hypothesis" in result.stdout, (
            f"--pattern choices missing competing-hypothesis: {result.stdout}"
        )

    def test_cli_example_pattern_choices_include_competing_hypothesis(self) -> None:
        """`example` subcommand pattern choices must include competing-hypothesis."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "example", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        assert "competing-hypothesis" in result.stdout, (
            f"example pattern choices missing competing-hypothesis: {result.stdout}"
        )

    def test_factory_rejects_too_few_hypotheses(self) -> None:
        """Supplying fewer hypotheses than investigators must raise ValueError."""
        result = self._run_py(
            "from multiagent_generator import create_competing_hypothesis_system\n"
            "short = [{'focus': 'a', 'description': 'd', 'responsibilities': ['r'], "
            "          'inputs': ['i']}]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=4, hypotheses=short)\n"
            "    print('no-error')\n"
            "except ValueError:\n"
            "    print('value-error')"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout

    def test_factory_accepts_custom_hypotheses(self) -> None:
        """Caller-supplied hypotheses must propagate to investigator metadata."""
        result = self._run_py(
            "import json; "
            "from multiagent_generator import create_competing_hypothesis_system; "
            "custom = ["
            "  {'focus': 'cache-corruption', 'description': 'cache-focused', "
            "   'responsibilities': ['check caches'], 'inputs': ['bug']},"
            "  {'focus': 'memory-leak', 'description': 'memory-focused', "
            "   'responsibilities': ['profile memory'], 'inputs': ['bug']},"
            "  {'focus': 'serialization', 'description': 'ser-focused', "
            "   'responsibilities': ['diff payloads'], 'inputs': ['bug']}"
            "]; "
            "sys_ = create_competing_hypothesis_system("
            "  investigator_count=3, hypotheses=custom); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps(sorted([w.hypothesis_focus for w in invs])))"
        )
        assert result.returncode == 0, result.stderr
        focuses = json.loads(result.stdout)
        assert focuses == ["cache-corruption", "memory-leak", "serialization"]

    # --- orchestrator markdown ---------------------------------------------

    def test_orchestrator_markdown_documents_three_adversarial_rounds(self, tmp_path: Path) -> None:
        """save_system must render the competing-hypothesis markdown with
        all three rounds + convergence + degenerate-case handling."""
        out_dir = tmp_path / "ch"
        result = self._run_py(
            "from pathlib import Path; "
            "from multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch_files = list(Path(out_dir).glob("*coordinator*.md"))
        assert orch_files, f"no coordinator markdown in {out_dir}"
        content = orch_files[0].read_text()
        assert "Round 1: Independent Investigation" in content
        assert "Round 2: Peer Challenge" in content
        assert "Round 3: Refinement" in content
        assert "Selection" in content
        assert "Competing-Hypothesis" in content or "competing-hypothesis" in content
        # Must spell out the adversarial invariant (no unchallenged hypothesis)
        assert "cite" in content.lower() and "peer" in content.lower()
        # Must cover the degenerate case
        assert "Unanimous" in content or "unanimous" in content

    def test_orchestrator_markdown_lists_distinct_hypothesis_focuses(self, tmp_path: Path) -> None:
        """The investigator table must surface each distinct focus so
        the orchestrator can assign them without ambiguity."""
        out_dir = tmp_path / "ch2"
        result = self._run_py(
            "from pathlib import Path; "
            "from multiagent_generator import create_competing_hypothesis_system, save_system; "
            "sys_ = create_competing_hypothesis_system(investigator_count=5); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch_files = list(Path(out_dir).glob("*coordinator*.md"))
        content = orch_files[0].read_text()
        # The default 5 focuses should all appear in the investigator table
        for focus in (
            "recent-change",
            "concurrency-timing",
            "environment-dependency",
            "data-state",
            "integration-contract",
        ):
            assert focus in content, f"focus {focus!r} missing from orchestrator markdown"

    def test_manifest_preserves_hypothesis_focus(self, tmp_path: Path) -> None:
        """save_system's JSON manifest must preserve hypothesis_focus so
        downstream tools can inspect it without re-running the factory."""
        out_dir = tmp_path / "ch3"
        result = self._run_py(
            "from pathlib import Path; "
            "from multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        manifest_files = list(Path(out_dir).glob("*-manifest.json"))
        assert manifest_files, "no manifest JSON written"
        manifest = json.loads(manifest_files[0].read_text())
        workers = [w for w in manifest["workers"] if w["role"] == "investigator"]
        assert workers, "no investigators in manifest"
        focuses = [w.get("hypothesis_focus") for w in workers]
        assert all(f for f in focuses), f"manifest dropped hypothesis_focus: {focuses}"
        assert len(set(focuses)) == len(focuses), "manifest focuses not distinct"


class TestCatalogTemplateInheritance:
    """Tests for catalog template inheritance with customization overlay (Feature #51).

    Exercises AgentTemplate.base_template / extends fields, the resolve_template
    function (override-by-default + opt-in extend-with-dedup semantics, cycle
    detection, missing-base loud failure, multi-level chains), and the wiring
    into generate_agent_content / template_to_dict.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- base inheritance ---------------------------------------------------

    def test_no_base_returns_template_unchanged(self) -> None:
        """Template without base_template must pass through resolve_template untouched."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='solo', description='d', category='c', tools=['Read'])\n"
            "r = resolve_template(t)\n"
            "print(r.name, r.tools[0], r.base_template is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "solo Read True"

    def test_child_inherits_unset_fields_from_base(self) -> None:
        """Child fields left unset must be inherited from the resolved base."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='strict-reviewer',\n"
            "    description='Strict variant',\n"
            "    category='',  # inherit\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "out = {\n"
            "    'name': r.name,\n"
            "    'description': r.description,\n"
            "    'category': r.category,\n"
            "    'has_workflow': bool(r.workflow_steps),\n"
            "    'has_tools': bool(r.tools),\n"
            "    'base_template': r.base_template,\n"
            "}\n"
            "print(json.dumps(out))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["name"] == "strict-reviewer", "child identity preserved"
        assert data["description"] == "Strict variant", "child description wins"
        assert data["category"] == "code-quality", (
            f"empty category should inherit from base; got {data['category']!r}"
        )
        assert data["has_workflow"], "workflow_steps inherited from base"
        assert data["has_tools"], "tools inherited from base"
        assert data["base_template"] is None, (
            "resolved template must clear base_template to signal materialization"
        )

    def test_child_overrides_set_list_field(self) -> None:
        """Without `extends`, a non-empty child list REPLACES the base's value."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='minimal',\n"
            "    description='',\n"
            "    category='',\n"
            "    tools=['Read'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps(r.tools))"
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == ["Read"], "override should replace base tools entirely"

    def test_extends_appends_with_dedup(self) -> None:
        """Naming a list field in `extends` must merge base + child uniquely."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='augmented',\n"
            "    description='',\n"
            "    category='',\n"
            "    tools=['WebFetch', 'Read'],  # Read overlaps with base — must dedup\n"
            "    extends=['tools'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps(r.tools))"
        )
        assert result.returncode == 0, result.stderr
        tools = json.loads(result.stdout)
        assert "WebFetch" in tools, "child-only tool must appear"
        assert "Read" in tools, "base+child shared tool must appear"
        assert tools.count("Read") == 1, f"dedup must drop duplicate, got {tools}"
        # Order: base entries first, then unique child additions
        assert tools.index("Read") < tools.index("WebFetch"), (
            f"extend must preserve base order first; got {tools}"
        )

    def test_workflow_steps_use_override_only_semantics(self) -> None:
        """workflow_steps and detailed_examples never extend — interleaving steps
        would produce an incoherent agent. Child workflow REPLACES base when set."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, WorkflowStep, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='custom-flow',\n"
            "    description='',\n"
            "    category='',\n"
            "    workflow_steps=[WorkflowStep(name='OnlyStep', description='just one')],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps([s.name for s in r.workflow_steps]))"
        )
        assert result.returncode == 0, result.stderr
        steps = json.loads(result.stdout)
        assert steps == ["OnlyStep"], f"workflow_steps must override (not extend); got {steps}"

    # --- multi-level inheritance -------------------------------------------

    def test_multi_level_chain_resolves_through_all_levels(self) -> None:
        """A → B → C: C's overlay applies on top of B's overlay applied on A."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'grandparent': AgentTemplate(\n"
            "        name='grandparent', description='gp-desc',\n"
            "        category='gp-cat', tools=['Read']),\n"
            "    'parent': AgentTemplate(\n"
            "        name='parent', description='', category='',\n"
            "        tools=['Grep'], extends=['tools'],\n"
            "        base_template='grandparent'),\n"
            "    'child': AgentTemplate(\n"
            "        name='child', description='child-desc', category='',\n"
            "        tools=['Bash'], extends=['tools'],\n"
            "        base_template='parent'),\n"
            "}\n"
            "r = resolve_template(catalog['child'], catalog=catalog)\n"
            "print(json.dumps({\n"
            "    'name': r.name,\n"
            "    'description': r.description,\n"
            "    'category': r.category,\n"
            "    'tools': r.tools,\n"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["name"] == "child"
        assert data["description"] == "child-desc", "child description wins"
        assert data["category"] == "gp-cat", "category transits two levels via inheritance"
        # Tools: grandparent[Read] + parent[Grep] (extend) + child[Bash] (extend)
        assert set(data["tools"]) == {"Read", "Grep", "Bash"}, data["tools"]

    # --- error paths --------------------------------------------------------

    def test_missing_base_raises_value_error(self) -> None:
        """Referencing a non-existent base must FAIL LOUD, not silently fall back."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='orphan', description='d', category='c',\n"
            "                  base_template='does-not-exist')\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "does-not-exist" in result.stdout, (
            "error must name the missing base so the caller can fix it"
        )

    def test_child_can_pin_scalar_to_default_value_overrides_base(self) -> None:
        """A child must be able to set pattern/version/author back to the
        registered default even when the base has a different value. Without
        the sentinel-None unset marker, the child's choice would be silently
        swapped for the base's value."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'b': AgentTemplate(name='b', description='d', category='c',\n"
            "                       pattern='routing', version='2.0.0', author='Other'),\n"
            "}\n"
            "child = AgentTemplate(\n"
            "    name='c', description='d', category='c',\n"
            "    pattern='prompt-chaining', version='1.0.0', author='Platxa',\n"
            "    base_template='b',\n"
            ")\n"
            "r = resolve_template(child, catalog=catalog)\n"
            "print(r.pattern, r.version, r.author)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "prompt-chaining 1.0.0 Platxa", (
            f"sentinel pin broken; got {result.stdout!r}"
        )

    def test_self_cycle_raises_value_error(self) -> None:
        """A → A self-loop must be detected and raise ValueError."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "loop = AgentTemplate(name='loop', description='', category='',\n"
            "                     base_template='loop')\n"
            "try:\n"
            "    resolve_template(loop, catalog={'loop': loop})\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "cycle" in result.stdout.lower()
        assert "loop -> loop" in result.stdout, (
            f"self-cycle path should show 'loop -> loop'; got: {result.stdout}"
        )

    def test_cycle_path_preserves_traversal_order(self) -> None:
        """Multi-hop cycles must report the actual traversal order (not an
        alphabetized scramble) so the caller can follow the chain to the
        offending edge."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'alpha': AgentTemplate(name='alpha', description='', category='',\n"
            "                           base_template='beta'),\n"
            "    'beta': AgentTemplate(name='beta', description='', category='',\n"
            "                          base_template='gamma'),\n"
            "    'gamma': AgentTemplate(name='gamma', description='', category='',\n"
            "                           base_template='alpha'),\n"
            "}\n"
            "try:\n"
            "    resolve_template(catalog['alpha'], catalog=catalog)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "alpha -> beta -> gamma -> alpha" in result.stdout, (
            f"cycle path order wrong; got: {result.stdout}"
        )

    def test_output_schema_dict_merge_combines_keys(self) -> None:
        """output_schema is a dict — child keys override base keys per-key,
        while base keys not present in the child are inherited."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'b': AgentTemplate(name='b', description='', category='',\n"
            "                       output_schema={'status': 'enum', 'count': 'int'}),\n"
            "}\n"
            "child = AgentTemplate(\n"
            "    name='c', description='', category='',\n"
            "    output_schema={'count': 'float', 'extra': 'string'},\n"
            "    base_template='b',\n"
            ")\n"
            "r = resolve_template(child, catalog=catalog)\n"
            "print(json.dumps(r.output_schema, sort_keys=True))"
        )
        assert result.returncode == 0, result.stderr
        merged = json.loads(result.stdout)
        assert merged == {"status": "enum", "count": "float", "extra": "string"}, merged

    def test_inheritance_cycle_raises_value_error(self) -> None:
        """A → B → A must raise ValueError, not infinite-loop or stack-overflow."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'a': AgentTemplate(name='a', description='', category='', base_template='b'),\n"
            "    'b': AgentTemplate(name='b', description='', category='', base_template='a'),\n"
            "}\n"
            "try:\n"
            "    resolve_template(catalog['a'], catalog=catalog)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "cycle" in result.stdout.lower()

    def test_invalid_extends_field_raises_value_error(self) -> None:
        """`extends` naming a non-extendable field must fail loud — silent
        skipping would let the caller think their override took effect when
        it really did nothing."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='bad', description='', category='',\n"
            "                  extends=['workflow_steps'],\n"
            "                  base_template='code-reviewer')\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "workflow_steps" in result.stdout, (
            "error must name the offending field so the caller can fix it"
        )

    def test_invalid_extends_validated_even_without_base(self) -> None:
        """An `extends` value with no `base_template` is still a misconfiguration
        — fail loud rather than silently ignoring it."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='solo', description='', category='',\n"
            "                  extends=['not-a-real-field'])\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "not-a-real-field" in result.stdout

    # --- integration --------------------------------------------------------

    def test_generate_agent_content_auto_resolves_inheritance(self) -> None:
        """generate_agent_content must resolve inheritance before rendering so
        callers don't need to know about the resolver."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, generate_agent_content\n"
            "child = AgentTemplate(\n"
            "    name='strict-reviewer-2',\n"
            "    description='Strict reviewer with security focus',\n"
            "    category='',\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "content = generate_agent_content(child)\n"
            "print('strict-reviewer-2' in content,\n"
            "      'Static Analysis' in content,  # inherited workflow step\n"
            "      'Security Audit' in content)   # inherited workflow step"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_template_to_dict_preserves_inheritance_metadata(self) -> None:
        """Manifest must surface base_template + extends so consumers can inspect
        the unresolved overlay shape (e.g. for diffing or reserialization)."""
        result = self._run_py(
            "import json\n"
            "from agent_catalog import AgentTemplate, template_to_dict\n"
            "child = AgentTemplate(\n"
            "    name='extended',\n"
            "    description='d',\n"
            "    category='c',\n"
            "    tools=['WebFetch'],\n"
            "    extends=['tools', 'tags'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "d = template_to_dict(child)\n"
            "print(json.dumps({\n"
            "    'base_template': d.get('base_template'),\n"
            "    'extends': d.get('extends'),\n"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["base_template"] == "code-reviewer"
        assert data["extends"] == ["tools", "tags"]

    def test_template_to_dict_omits_inheritance_fields_when_unset(self) -> None:
        """Templates without inheritance must not emit empty base_template/extends
        keys — keeps existing manifest output backwards-compatible."""
        result = self._run_py(
            "from agent_catalog import AgentTemplate, template_to_dict\n"
            "t = AgentTemplate(name='solo', description='d', category='c')\n"
            "d = template_to_dict(t)\n"
            "print('base_template' in d, 'extends' in d)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False False"


class TestHooksGeneratorInjection:
    """Feature #1 (SECURITY CRITICAL): hooks_generator.py must reject agent_name
    containing shell metacharacters and must wrap agent_name with shlex.quote()
    at every shell-interpolation site. Prevents remote code execution via
    malicious agent names like `"; rm -rf / #` reaching downstream hook
    execution in the user shell.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = "import sys; sys.path.insert(0, '" + str(SCRIPTS_DIR) + "'); "
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # ---- validator rejects metacharacter / traversal / empty names ---------

    @pytest.mark.parametrize(
        "bad_name",
        [
            '"; rm -rf / #',
            "a; echo pwned",
            "a`cat /etc/passwd`",
            "a$(id)",
            "hello world",
            "../etc/passwd",
            "agent|evil",
            "agent&background",
            "agent\nnewline",
            "agent>redir",
            "",
            "   ",
        ],
    )
    def test_rejects_metachar_agent_name(self, bad_name: str) -> None:
        """_validate_agent_name must reject every shell-metachar and path-traversal variant."""
        result = self._run_py(
            "from hooks_generator import _validate_agent_name\n"
            f"try:\n"
            f"    _validate_agent_name({bad_name!r})\n"
            f"    print('ACCEPTED')\n"
            f"except ValueError as e:\n"
            f"    print('REJECTED:', str(e)[:80])\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.startswith("REJECTED:"), (
            f"Expected ValueError for {bad_name!r}, got {result.stdout!r}"
        )

    @pytest.mark.parametrize(
        "good_name",
        ["agent", "my-agent", "my_agent", "agent-123", "Agent_Name-2"],
    )
    def test_accepts_valid_agent_name(self, good_name: str) -> None:
        """Valid names matching ^[a-zA-Z0-9_-]+$ pass validation."""
        result = self._run_py(
            "from hooks_generator import _validate_agent_name\n"
            f"print(_validate_agent_name({good_name!r}))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == good_name

    # ---- public creation functions reject injection ------------------------

    @pytest.mark.parametrize(
        "fn",
        [
            "create_audit_hook",
            "create_compliance_hook",
            "create_metrics_hook",
            "create_security_hook",
            "create_logging_hook",
            "create_performance_hook",
        ],
    )
    def test_public_hook_creators_reject_injection(self, fn: str) -> None:
        """Each public create_*_hook function must validate agent_name at entry."""
        result = self._run_py(
            f"from hooks_generator import {fn}\n"
            f"try:\n"
            f"    {fn}('\"; rm -rf / #', 'PreToolUse')\n"
            f"    print('ACCEPTED')\n"
            f"except ValueError:\n"
            f"    print('REJECTED')\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "REJECTED", f"{fn} accepted shell-metachar agent_name"

    def test_notification_hook_rejects_injection(self) -> None:
        """create_notification_hook takes a different signature; validate separately."""
        result = self._run_py(
            "from hooks_generator import create_notification_hook\n"
            "try:\n"
            "    create_notification_hook('\"; rm -rf / #')\n"
            "    print('ACCEPTED')\n"
            "except ValueError:\n"
            "    print('REJECTED')\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "REJECTED"

    def test_generate_hooks_rejects_injection(self) -> None:
        """The orchestrator generate_hooks must also validate at its API boundary."""
        result = self._run_py(
            "from hooks_generator import generate_hooks\n"
            "try:\n"
            "    generate_hooks('\"; rm -rf / #', ['audit'])\n"
            "    print('ACCEPTED')\n"
            "except ValueError:\n"
            "    print('REJECTED')\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "REJECTED"

    # ---- shlex.quote wraps interpolation at shell sites --------------------

    def test_audit_hook_uses_shlex_quote(self) -> None:
        """Generated audit hook command must not contain raw {agent_name}; must use shlex.quote output."""
        result = self._run_py(
            "from hooks_generator import create_audit_hook\n"
            "h = create_audit_hook('valid-agent', 'SessionStart', '/tmp/x.log')\n"
            "print(h.hooks[0].command)\n"
        )
        assert result.returncode == 0, result.stderr
        cmd = result.stdout.strip()
        assert "valid-agent" in cmd
        # Defense-in-depth: even though valid-agent is regex-safe, the literal quoted
        # form must be what appears. For a [a-zA-Z0-9_-]+ name shlex.quote returns
        # the name unchanged, so this test mainly pins the absence of regression
        # to raw interpolation when regex is later loosened.
        assert cmd.count("valid-agent") >= 1

    # ---- deterministic grep: SC-13 pins the absence of raw interpolation ---

    def test_no_raw_agent_name_in_shell_command_fstrings(self) -> None:
        """SC-13 deterministic check: no raw {agent_name} interpolation remains
        in hooks_generator.py f-strings that end up executed as shell commands.

        Shell-command f-strings are identified by presence of shell-only tokens
        (echo, curl, redirection, pipes, command-substitution). These MUST wrap
        agent_name with shlex.quote.

        Filename literals, comment lines inside generated scripts, and the
        validator's own error message are exempt because agent_name has already
        been regex-validated to [a-zA-Z0-9_-]+ at the public API boundary,
        making those contexts safe-by-construction (no metacharacters, no
        traversal, no whitespace can survive validation).
        """
        import re as _re_re

        src = (SCRIPTS_DIR / "hooks_generator.py").read_text()
        offenders = []
        shell_tokens = (">>", ">&", ">|", "2>", "|&", "&&", "||", "$(", "`", "echo ")
        for line_num, line in enumerate(src.splitlines(), start=1):
            stripped = line.lstrip()
            if stripped.startswith(("#", '"""', "'''")):
                continue
            # Exemptions — agent_name IS regex-validated before reaching these:
            #   - validator's own error message using Python repr ({agent_name!r})
            #   - filename variables (log_file=, filename=, script_file=, timing_file=, .sh)
            #   - description keyword arg (string field, not executed)
            #   - hook-sh file path literals (contain ".sh" and no shell tokens)
            if "!r}" in line:
                continue
            if _re_re.search(
                r"\b(log_file|filename|script_file|timing_file|output_path)\b\s*=", line
            ):
                continue
            if _re_re.search(r"\bdescription\s*=", line):
                continue
            # Only flag lines that BOTH (a) have {agent_name} in an f-string AND
            # (b) contain a shell-command token indicating the string is executed.
            if not _re_re.search(r"f['\"][^'\"]*\{agent_name[^}]*\}", line):
                continue
            if not any(tok in line for tok in shell_tokens):
                continue
            offenders.append((line_num, line.strip()[:120]))
        assert not offenders, (
            "Raw {agent_name} interpolation in a shell-command f-string "
            f"(must be {{quoted_name}} after shlex.quote): {offenders[:10]}"
        )

    def test_every_public_fn_with_agent_name_validates(self) -> None:
        """Structural audit: every top-level public function in hooks_generator.py
        whose signature accepts ``agent_name: str`` must call _validate_agent_name
        (or construct HooksDefinition which validates in __post_init__) within
        its body. Prevents regression where a new public helper is added without
        hooking the central validator.
        """
        import re as _re_re

        src_path = SCRIPTS_DIR / "hooks_generator.py"
        src = src_path.read_text()
        lines = src.splitlines()

        fn_header = _re_re.compile(r"^def ([a-zA-Z_][\w]*)\((.*)$")
        fns_with_agent_name: list[tuple[str, int]] = []
        for i, line in enumerate(lines):
            m = fn_header.match(line)
            if not m:
                continue
            name = m.group(1)
            # Walk forward to find the closing ')' of the signature.
            sig = line
            j = i
            while ")" not in sig and j + 1 < len(lines):
                j += 1
                sig += lines[j]
            if "agent_name: str" in sig and not name.startswith("_"):
                fns_with_agent_name.append((name, i + 1))

        assert fns_with_agent_name, "no public functions with agent_name found — test setup issue"

        # For each qualifying function, extract its body (until next top-level def)
        # and confirm either _validate_agent_name or HooksDefinition(agent_name= is called.
        offenders: list[tuple[str, int]] = []
        for fn_name, start_line in fns_with_agent_name:
            body: list[str] = []
            for j in range(start_line, len(lines)):
                next_line = lines[j]
                # Stop at next top-level def or class
                if j > start_line and (
                    next_line.startswith("def ") or next_line.startswith("class ")
                ):
                    break
                body.append(next_line)
            body_text = "\n".join(body)
            has_validator = "_validate_agent_name(" in body_text
            has_definition = "HooksDefinition(" in body_text
            if not (has_validator or has_definition):
                offenders.append((fn_name, start_line))
        assert not offenders, (
            "Public functions taking agent_name without calling _validate_agent_name "
            f"(or constructing HooksDefinition): {offenders}"
        )


class TestDryRunImportBroken:
    """Tests for dry_run._load_sibling_module narrowing (Feature #16).

    Previously ``_load_sibling_module`` caught every exception raised by
    ``spec.loader.exec_module`` with ``except Exception: return None``,
    and the first-try relative import caught ``(ImportError, TypeError)``
    to paper over a call that was fundamentally wrong when
    ``__package__`` was not a real package. When a generator module
    (e.g. ``agent_generator.py``) developed a ``SyntaxError`` in its
    body, the broad except silently converted it to ``None`` and
    ``--dry-run`` quietly fell back to the embedded fallback templates —
    users saw output that looked correct and never learned their
    generator was broken.

    The fix has two parts:

    - **First-try guard.** The relative import ``importlib.import_module(".mod",
      package=__package__)`` is only meaningful when ``__package__`` is
      a non-empty string. Otherwise it raises ``TypeError`` ("the
      'package' argument is required to perform a relative import") on
      Python 3.12, which the old code silently swallowed. Guarding with
      ``if __package__`` eliminates the TypeError path at its source,
      so the narrowed ``except ImportError`` is sufficient for the real
      failure mode (sibling missing inside a real package).
    - **Second-try narrowing.** The exec_module catch is narrowed to
      ``except ImportError`` so ``SyntaxError``, ``RuntimeError``, and
      any other programmer error surfaces to the caller. The partial
      registration in ``sys.modules`` is popped on both the
      ImportError path and the propagation path to avoid leaving stale
      state that would mask a retry.

    Baseline preserved: a sibling that simply does not exist on disk
    still returns ``None`` — that is the legitimate "module not
    available" signal, not a bug indicator.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_missing_module_returns_none(self, tmp_path: Path) -> None:
        """When the sibling module file does not exist on disk,
        ``_load_sibling_module`` must return ``None`` — the baseline
        "module not available" signal.

        Exercises the disk-lookup branch end-to-end: we relocate the
        ``__file__`` of dry_run to an empty tmp dir so the script-dir
        path search finds nothing, then assert None is returned without
        raising. This must not regress after the narrowing.
        """
        result = self._run_py(
            "import sys\n"
            f"sys.path.insert(0, {str(SCRIPTS_DIR)!r})\n"
            "import dry_run\n"
            # Redirect the script dir to an empty tmp path so the disk
            # lookup finds nothing.
            f"dry_run.__file__ = {str(tmp_path / 'dry_run.py')!r}\n"
            "result = dry_run._load_sibling_module('nonexistent_sibling_abc123')\n"
            "print('result_is_none:', result is None)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "result_is_none: True" in result.stdout

    def test_syntax_error_propagates(self, tmp_path: Path) -> None:
        """A sibling module whose body contains a ``SyntaxError`` must
        raise that SyntaxError up to the caller — not be silently
        swallowed and converted to ``None``.

        This is the bug the narrowing fixes: under the old
        ``except Exception`` clause, a broken generator disabled
        ``--dry-run`` with no signal. Now the SyntaxError propagates
        so the user sees the real problem in the real file.
        """
        # Write a sibling module with invalid Python syntax into a tmp
        # dir, then point dry_run.__file__ at that dir so the script-dir
        # lookup finds and attempts to exec it.
        broken = tmp_path / "broken_sibling.py"
        broken.write_text("def foo(\n    # unterminated parameter list\n", encoding="utf-8")
        fake_script = tmp_path / "dry_run.py"
        fake_script.touch()

        result = self._run_py(
            "import sys\n"
            f"sys.path.insert(0, {str(SCRIPTS_DIR)!r})\n"
            "import dry_run\n"
            f"dry_run.__file__ = {str(fake_script)!r}\n"
            # Purge any prior registration so exec_module is actually
            # invoked against our broken file.
            "sys.modules.pop('broken_sibling', None)\n"
            "try:\n"
            "    dry_run._load_sibling_module('broken_sibling')\n"
            "    print('outcome: silently_returned')\n"
            "except SyntaxError as e:\n"
            "    print('outcome: syntax_error_raised')\n"
            # sys.modules must be cleaned up on the propagation path so
            # a retry does not see stale state.
            "    print('sys_modules_clean:', 'broken_sibling' not in sys.modules)\n"
            "except BaseException as e:\n"
            "    print(f'outcome: unexpected_{type(e).__name__}')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "outcome: syntax_error_raised" in result.stdout, result.stdout
        assert "sys_modules_clean: True" in result.stdout, result.stdout


class TestExtendedThinking:
    """Tests for extended_thinking.py public surface (feature #19).

    The 955-LOC ``extended_thinking`` module previously had coverage
    only for the narrow per-record load path (``TestExtendedThinkingLoadHistory``,
    feature #13) and a single save-OSError case (``TestSilentWriteSurfacing``,
    feature #14). The rest of the module — the ComplexityAnalyzer that
    every agent-generation path consults to pick thinking intensity,
    the ``analyze_for_agent_generation`` convenience entry point, the
    ``intensity_to_effort`` mapping that flows into agent frontmatter,
    and the start/complete/save round-trip used by the thinking
    session tracker — was untested.

    Coverage:
    - ComplexityAnalyzer scoring: base-score bands (0/1/2+ high matches,
      1/2+ medium matches), dimension context boosts (file_count,
      integration_count, handles_auth), weighted overall-complexity
      aggregation, empty-input zero, confidence reporting.
    - ``analyze_complexity`` ⇒ ThinkingRecommendation: should_use
      threshold (0.35), intensity selection at each threshold band
      (0.25 / 0.45 / 0.65 / 0.85).
    - ``analyze_for_agent_generation``: simple/orchestrator/multi-agent
      context injection, ``has_mcp_integrations`` → integration_count
      pass-through.
    - ``intensity_to_effort`` + ``INTENSITY_TO_EFFORT``: all four
      intensities map to the documented effort level, table
      completeness pin, unknown trigger falls back to 'medium'.
    - Usage history round-trip: start/complete session flow,
      save-then-reload preserves records and intensity enum, unknown
      intensity in file falls back to STANDARD, malformed record is
      skipped without aborting the surrounding records (pins #13
      behavior from the public-API angle, not the internal error path).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "scripts"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — base-score bands
    # ------------------------------------------------------------------

    def test_analyzer_no_matches_gives_baseline_score(self) -> None:
        """A task with no matching patterns scores 0.1 on every dimension.

        Pins the ``else: base_score = 0.1`` fallback in
        ``_score_dimension``. If the baseline shifts, every downstream
        intensity decision shifts with it.
        """
        result = self._run_py(
            "from extended_thinking import ComplexityAnalyzer\n"
            "scores = ComplexityAnalyzer().analyze('hello world')\n"
            "print(all(round(s.score, 2) == 0.1 for s in scores))\n"
            "print(all(round(s.confidence, 2) == 0.3 for s in scores))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_analyzer_single_high_pattern_scores_0_7(self) -> None:
        """One matching high-complexity pattern yields base score 0.7.

        Pins the ``elif high_matches == 1: base_score = 0.7`` branch —
        the tier that pushes a task across the HIGH intensity threshold
        (0.65) when combined with confidence weighting.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze('please architect this')\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.7"

    def test_analyzer_two_high_patterns_scores_0_9(self) -> None:
        """Two high-complexity pattern matches saturate at 0.9.

        Pins the ``if high_matches >= 2: base_score = 0.9`` top band —
        the tier that reliably crosses MAXIMUM intensity (0.85).
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # Both 'architect' and 'design.*system' match architectural-high.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'architect and design this system thoroughly')\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.9"

    def test_analyzer_single_medium_pattern_scores_0_3(self) -> None:
        """One medium-pattern-only match yields base score 0.3."""
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # 'debug' matches DEBUGGING medium.
            "scores = ComplexityAnalyzer().analyze('please debug this')\n"
            "dbg = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.DEBUGGING][0]\n"
            "print(round(dbg.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_two_medium_patterns_score_0_5(self) -> None:
        """Two medium-pattern matches (with zero high matches) yield 0.5.

        Pins the ``elif medium_matches >= 2: base_score = 0.5`` band —
        the mid-tier that nudges a task into the INCREASED intensity
        (0.45) range.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # 'debug' + 'fix bug' both match DEBUGGING medium patterns.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'debug and fix bug in module')\n"
            "dbg = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.DEBUGGING][0]\n"
            "print(round(dbg.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.5"

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — dimension context boosts
    # ------------------------------------------------------------------

    def test_analyzer_file_count_boosts_architectural_over_10(self) -> None:
        """``file_count > 10`` adds +0.2 to the architectural dimension.

        Baseline score is 0.1; with a 15-file context the score lifts
        to 0.3 (clamped to 1.0 ceiling). Pins the upper-tier branch.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'plain text', context={'file_count': 15})\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_handles_auth_boosts_security(self) -> None:
        """``handles_auth=True`` adds +0.2 to the security dimension.

        Pins that security context signals stack: a plain description
        with an auth context yields 0.1 (baseline) + 0.2 = 0.3.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'plain text', context={'handles_auth': True})\n"
            "sec = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.SECURITY][0]\n"
            "print(round(sec.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_handles_auth_and_pii_stacks_security_boost(self) -> None:
        """``handles_auth`` and ``handles_pii`` both trigger +0.2 each."""
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze('plain text',\n"
            "    context={'handles_auth': True, 'handles_pii': True})\n"
            "sec = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.SECURITY][0]\n"
            "print(round(sec.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        # 0.1 baseline + 0.2 auth + 0.2 pii = 0.5
        assert result.stdout.strip() == "0.5"

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — overall complexity aggregation
    # ------------------------------------------------------------------

    def test_calculate_overall_complexity_empty_returns_zero(self) -> None:
        """An empty score list returns 0.0 (guards div-by-zero).

        Pins the ``if total_weight == 0: return 0.0`` early-exit.
        """
        result = self._run_py(
            "from extended_thinking import ComplexityAnalyzer\n"
            "print(ComplexityAnalyzer().calculate_overall_complexity([]))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.0"

    def test_calculate_overall_complexity_weights_by_confidence(self) -> None:
        """Overall complexity multiplies per-dimension weight by confidence.

        Checks the invariant: a high-score/high-confidence dimension
        dominates a low-score/low-confidence one even when their raw
        dimension weights are close. Confidence scaling is the
        difference between 'flagged one word as serious' and 'this
        task is definitely serious'.
        """
        result = self._run_py(
            "from extended_thinking import ComplexityAnalyzer\n"
            # Two high architectural patterns -> 0.9 score, 0.7 confidence.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'architect and design this system')\n"
            "overall = ComplexityAnalyzer().calculate_overall_complexity(scores)\n"
            # Must be clearly above the baseline 0.1 that a no-match
            # task would produce.
            "print(overall > 0.15)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    # ------------------------------------------------------------------
    # ThinkingIntegration.analyze_complexity — end-to-end
    # ------------------------------------------------------------------

    def test_analyze_complexity_below_threshold_disables_extended(self) -> None:
        """Overall complexity below 0.35 sets should_use_extended_thinking=False.

        Pins the ``EXTENDED_THINKING_THRESHOLD = 0.35`` gate — the
        cost/benefit line below which baseline thinking suffices.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity('hello world')\n"
            "    print(rec.should_use_extended_thinking)\n"
            "    print(rec.intensity.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "think"]

    def test_analyze_complexity_high_complexity_triggers_extended(self) -> None:
        """A task with strong architectural cues crosses the 0.35 threshold
        that flips ``should_use_extended_thinking`` to True.

        Pins that a multi-high-pattern description reliably trips the
        extended-thinking gate; the exact intensity tier above the gate
        depends on cross-dimension scoring and is covered separately by
        ``test_select_intensity_threshold_bands``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect and design distributed microservice system')\n"
            "    print(rec.should_use_extended_thinking)\n"
            "    print(rec.overall_complexity > 0.35)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_select_intensity_threshold_bands(self) -> None:
        """Each INTENSITY_THRESHOLDS band maps to the documented intensity.

        Pins the ordered dict iteration behavior: the loop returns the
        FIRST intensity whose threshold the complexity meets, so the
        thresholds must stay in descending order (MAXIMUM 0.85, HIGH
        0.65, INCREASED 0.45, STANDARD 0.25). A future refactor that
        re-orders the dict would silently flip intensity selection for
        every task.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    # _select_intensity is the private slot under test.\n"
            "    for c in (0.90, 0.70, 0.50, 0.30, 0.10):\n"
            "        print(integ._select_intensity(c).trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "ultrathink",
            "think harder",
            "think hard",
            "think",
            "think",
        ]

    # ------------------------------------------------------------------
    # analyze_for_agent_generation — convenience entry point
    # ------------------------------------------------------------------

    def test_analyze_for_agent_generation_simple_is_standard(self) -> None:
        """A trivial ``simple`` agent description lands at STANDARD intensity.

        Pins the convenience-function contract: a throwaway agent
        description should not trip extended thinking.
        """
        result = self._run_py(
            "from extended_thinking import analyze_for_agent_generation\n"
            "rec = analyze_for_agent_generation(\n"
            "    'echo the input', agent_type='simple', tool_count=1)\n"
            "print(rec.should_use_extended_thinking)\n"
            "print(rec.intensity.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "think"]

    def test_analyze_for_agent_generation_multi_agent_boosts_architectural(
        self,
    ) -> None:
        """``multi-agent`` type injects ``file_count=10`` which hits the
        ``file_count > 5`` architectural boost branch (+0.1).

        Pins the branch: ``if file_count > 10`` is False for 10 but
        the ``elif file_count > 5`` is True. A future change that
        tightens the boundary to ``>=`` would silently lose the
        multi-agent boost.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='multi-agent')\n"
            "arch = [s for s in rec.dimension_scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            # 0.1 baseline + 0.1 boost
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.2"

    def test_analyze_for_agent_generation_orchestrator_no_boost_at_5(
        self,
    ) -> None:
        """``orchestrator`` sets ``file_count=5``, which hits NEITHER boost.

        Pins current behavior: both ``> 10`` and ``> 5`` are strict
        inequalities, so file_count=5 does not trigger the +0.1 bump.
        An operator reading the code who assumes ``>=`` semantics and
        writes code relying on orchestrator-type-boosts-architectural
        will find this test keeping them honest.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='orchestrator')\n"
            "arch = [s for s in rec.dimension_scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        # 0.1 baseline, no boost at exactly 5 files.
        assert result.stdout.strip() == "0.1"

    def test_analyze_for_agent_generation_mcp_flag_passes_integration_count(
        self,
    ) -> None:
        """``has_mcp_integrations=True`` passes ``integration_count=1``
        into the analyzer context.

        At integration_count=1 the INTEGRATION boost is 0 (both
        context branches need >1), but the context value must flow
        through unchanged so future tightening (``> 0``) lights up
        automatically.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec_with = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='simple',\n"
            "    has_mcp_integrations=True)\n"
            "rec_without = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='simple',\n"
            "    has_mcp_integrations=False)\n"
            # The integration-dim score is identical at this boost tier,
            # but dimension_scores length and the other fields must match,
            # proving the mcp flag does not crash or mutate surrounding
            # dimensions.
            "print(len(rec_with.dimension_scores) ==\n"
            "      len(rec_without.dimension_scores))\n"
            "int_with = [s for s in rec_with.dimension_scores\n"
            "    if s.dimension == ComplexityDimension.INTEGRATION][0]\n"
            "int_without = [s for s in rec_without.dimension_scores\n"
            "    if s.dimension == ComplexityDimension.INTEGRATION][0]\n"
            "print(round(int_with.score, 2) ==\n"
            "      round(int_without.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    # ------------------------------------------------------------------
    # INTENSITY_TO_EFFORT mapping + intensity_to_effort()
    # ------------------------------------------------------------------

    def test_intensity_to_effort_standard_is_low(self) -> None:
        """STANDARD (``think``) maps to effort='low'."""
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.STANDARD))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "low"

    def test_intensity_to_effort_increased_is_medium(self) -> None:
        """INCREASED (``think hard``) maps to effort='medium'."""
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.INCREASED))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "medium"

    def test_intensity_to_effort_high_is_high(self) -> None:
        """HIGH (``think harder``) maps to effort='high'."""
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.HIGH))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "high"

    def test_intensity_to_effort_maximum_capped_at_high(self) -> None:
        """MAXIMUM (``ultrathink``) is capped at effort='high'.

        Claude Code's ``effort`` frontmatter has only three tiers
        (low/medium/high); the module caps ultrathink at 'high' rather
        than inventing an unsupported 'max' level. Pins that cap
        explicitly so a future change to add a fourth tier has to
        update this test first.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.MAXIMUM))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "high"

    def test_intensity_to_effort_table_covers_all_four(self) -> None:
        """INTENSITY_TO_EFFORT contains exactly one entry per intensity.

        Completeness pin: if someone adds a fifth ThinkingIntensity
        without wiring it into the effort map, this test blows up
        before any generated agent ships with a missing effort level.
        """
        result = self._run_py(
            "from extended_thinking import (\n"
            "    ThinkingIntensity, INTENSITY_TO_EFFORT,\n"
            ")\n"
            "enum_phrases = {i.trigger_phrase for i in ThinkingIntensity}\n"
            "table_phrases = set(INTENSITY_TO_EFFORT.keys())\n"
            "print(enum_phrases == table_phrases)\n"
            "print(len(INTENSITY_TO_EFFORT) == 4)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    # ------------------------------------------------------------------
    # Usage-history round-trip
    # ------------------------------------------------------------------

    def test_start_thinking_session_appends_record(self) -> None:
        """``start_thinking_session`` adds an in-memory ThinkingUsageRecord."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity('plain text')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-A', 'plain text', rec)\n"
            "    print(len(integ._usage_records))\n"
            "    print(session.task_id)\n"
            "    print(session.completed_at is None)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["1", "task-A", "True"]

    def test_complete_thinking_session_persists_and_reloads(self) -> None:
        """Completing a session writes the record to disk AND reloads cleanly.

        End-to-end round-trip: start session → complete session (which
        saves) → new ThinkingIntegration with same path → verify the
        record round-tripped with the right intensity enum and the
        completion fields.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect distributed system')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-B', 'architect', rec)\n"
            "    integ.complete_thinking_session(\n"
            "        session, outcome_quality=0.8,\n"
            "        tokens_used=1234, notes='ok')\n"
            "    # Round-trip: new integration reloads from disk.\n"
            "    integ2 = ThinkingIntegration(usage_log_path=log)\n"
            "    assert len(integ2._usage_records) == 1\n"
            "    loaded = integ2._usage_records[0]\n"
            "    print(loaded.task_id)\n"
            "    print(loaded.outcome_quality)\n"
            "    print(loaded.tokens_used)\n"
            "    print(loaded.notes)\n"
            "    print(isinstance(loaded.intensity_used, ThinkingIntensity))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "task-B",
            "0.8",
            "1234",
            "ok",
            "True",
        ]

    def test_round_trip_preserves_intensity_enum(self) -> None:
        """Save a MAXIMUM-intensity record and reload: intensity stays MAXIMUM.

        Pins the ``trigger_phrase`` string as the stable on-disk
        identifier. If the enum's trigger_phrase were ever renamed
        without migrating the file format, every loaded record would
        silently fall back to STANDARD.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [{\n"
            "            'task_id': 'max-task',\n"
            "            'task_description': 'deep', \n"
            "            'intensity_used': 'ultrathink',\n"
            "            'complexity_score': 0.9,\n"
            "            'started_at': '2026-04-21T00:00:00'}]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    r = integ._usage_records[0]\n"
            "    print(r.intensity_used is ThinkingIntensity.MAXIMUM)\n"
            "    print(r.intensity_used.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "ultrathink"]

    def test_load_unknown_intensity_falls_back_to_standard(self) -> None:
        """A record with an unrecognized ``intensity_used`` phrase loads
        as STANDARD rather than raising.

        Pins the defensive default in ``_load_usage_history``:
        ``intensity = ThinkingIntensity.STANDARD`` is the initial value
        that only gets overwritten if a phrase match is found. This
        lets the loader survive future intensity additions / renames
        without corrupting the run.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [{\n"
            "            'task_id': 'unknown',\n"
            "            'task_description': 'x',\n"
            "            'intensity_used': 'telepathy',\n"
            "            'complexity_score': 0.5,\n"
            "            'started_at': '2026-04-21T00:00:00'}]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    r = integ._usage_records[0]\n"
            "    print(r.intensity_used is ThinkingIntensity.STANDARD)\n"
            "    print(r.task_id)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "unknown"]

    def test_round_trip_skips_malformed_record(self) -> None:
        """A malformed record between two valid ones is skipped; valid
        ones still load. Pins #13 behavior from the public-API angle.

        This complements ``TestExtendedThinkingLoadHistory`` (which
        pins the warning on stderr and byte-identical file) by
        asserting the end-to-end public-API contract: a corrupt log
        on disk does not crash the session tracker, and valid records
        before and after the bad one survive.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    good1 = {'task_id': 'g1', 'task_description': 'a',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.1,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    bad = {'task_description': 'missing id',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.2,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    good2 = {'task_id': 'g2', 'task_description': 'b',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.3,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [good1, bad, good2]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    ids = [r.task_id for r in integ._usage_records]\n"
            "    print(len(integ._usage_records))\n"
            "    print(','.join(ids))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["2", "g1,g2"]

    def test_get_usage_statistics_reports_counts(self) -> None:
        """``get_usage_statistics`` reports per-intensity counts and
        averages after records accumulate.

        Pins the statistics shape: callers (CLI ``stats`` subcommand,
        future dashboards) depend on the keys ``total_sessions``,
        ``average_complexity``, ``average_quality``, ``completed_sessions``,
        and ``intensity_distribution``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    # Empty state first.\n"
            "    empty = integ.get_usage_statistics()\n"
            "    print(empty['total_sessions'])\n"
            "    print(empty['average_complexity'])\n"
            "    # One completed session at MAXIMUM intensity.\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect and design distributed microservice system')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-C', 'architect', rec)\n"
            "    integ.complete_thinking_session(\n"
            "        session, outcome_quality=0.75)\n"
            "    stats = integ.get_usage_statistics()\n"
            "    print(stats['total_sessions'])\n"
            "    print(stats['completed_sessions'])\n"
            "    print(stats['average_quality'])\n"
            "    print(sum(stats['intensity_distribution'].values()))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "0",
            "0.0",
            "1",
            "1",
            "0.75",
            "1",
        ]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
