#!/usr/bin/env python3
"""
test_frontmatter_flags — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_frontmatter_flags.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestBackgroundFrontmatter:
    """Tests for background frontmatter emission via AgentDefinition."""

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

    def test_frontmatter_emits_background_when_true(self) -> None:
        """AgentDefinition(background=True) emits 'background: true' in YAML."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
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
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d_none = AgentDefinition(name='x', description='y', tools=['Read'])\n"
            "d_false = AgentDefinition(name='x', description='y', tools=['Read'],\n"
            "                          background=False)\n"
            "print('background' in generate_frontmatter(d_none))\n"
            "print('background' in generate_frontmatter(d_false))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False"]


class TestColorFrontmatter:
    """Tests for color frontmatter emission via AgentDefinition."""

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

    def test_frontmatter_emits_color(self) -> None:
        """AgentDefinition(color=...) emits 'color: <value>' in YAML."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='r', description='security review',\n"
            "                    tools=['Read'], color='red')\n"
            "print('color: red' in generate_frontmatter(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"
