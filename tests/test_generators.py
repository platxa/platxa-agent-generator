#!/usr/bin/env python3
"""
test_generators — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_generators.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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
