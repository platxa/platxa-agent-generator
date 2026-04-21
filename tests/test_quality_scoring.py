#!/usr/bin/env python3
"""
test_quality_scoring — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_quality_scoring.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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
                    ""
                    "from platxa_agent_generator.agent_generator import AgentDefinition, generate_error_handling_section; "
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
                    "import json, sys; "
                    "from platxa_agent_generator.agent_generator import estimate_context_budget; "
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
