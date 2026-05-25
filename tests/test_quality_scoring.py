#!/usr/bin/env python3
"""
test_quality_scoring — sharded from test_generator.py.

Shards: 4 TestXxx classes.
Run with: pytest tests/test_quality_scoring.py -v
"""

from __future__ import annotations

import ast
import json
import subprocess
import sys
import warnings
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


class TestCriteriaWeightsFromYAML:
    """Tests for YAML-loaded CRITERIA_WEIGHTS (Feature #39)."""

    def test_weights_loaded_from_yaml(self) -> None:
        """CRITERIA_WEIGHTS must match the canonical evaluation-criteria.yaml."""
        from platxa_agent_generator.evaluation_criteria import EvaluationRubric
        from platxa_agent_generator.quality_scorer import CRITERIA_WEIGHTS

        yaml_weights = EvaluationRubric.load_default().weights()
        assert CRITERIA_WEIGHTS == yaml_weights

    def test_weights_sum_to_one(self) -> None:
        """Loaded weights must sum to 1.0."""
        from platxa_agent_generator.quality_scorer import CRITERIA_WEIGHTS

        total = sum(CRITERIA_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"

    def test_weights_have_all_six_axes(self) -> None:
        """CRITERIA_WEIGHTS must contain exactly the 6 canonical axes."""
        from platxa_agent_generator.quality_scorer import CRITERIA_WEIGHTS

        expected = {
            "clarity",
            "completeness",
            "tool_design",
            "examples",
            "security",
            "documentation",
        }
        assert set(CRITERIA_WEIGHTS.keys()) == expected

    def test_no_hardcoded_weights_in_source(self) -> None:
        """Source code must not contain a hard-coded dict literal for CRITERIA_WEIGHTS."""
        source_path = SCRIPTS_DIR / "quality_scorer.py"
        tree = ast.parse(source_path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Assign)
                and any(
                    isinstance(t, ast.Name) and t.id == "CRITERIA_WEIGHTS" for t in node.targets
                )
                and isinstance(node.value, ast.Dict)
            ):
                raise AssertionError(
                    "CRITERIA_WEIGHTS is assigned a dict literal in source. "
                    "Weights must be loaded from templates/evaluation-criteria.yaml "
                    "via EvaluationRubric.load_default().weights(). "
                    "See feature #39."
                )

    def test_deprecation_warning_on_weight_override(self) -> None:
        """check_criteria_weights_integrity() must warn when weights are overridden."""
        import platxa_agent_generator.quality_scorer as qs

        original = qs.CRITERIA_WEIGHTS.copy()
        try:
            qs.CRITERIA_WEIGHTS = {
                "clarity": 0.99,
                "completeness": 0.01,
                "tool_design": 0.0,
                "examples": 0.0,
                "security": 0.0,
                "documentation": 0.0,
            }
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                qs.check_criteria_weights_integrity()
                assert len(w) == 1
                assert issubclass(w[0].category, DeprecationWarning)
                assert "hard-coded weights are deprecated" in str(w[0].message).lower()
        finally:
            qs.CRITERIA_WEIGHTS = original

    def test_no_warning_when_weights_match_yaml(self) -> None:
        """check_criteria_weights_integrity() must not warn when weights match YAML."""
        from platxa_agent_generator.quality_scorer import check_criteria_weights_integrity

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            check_criteria_weights_integrity()
            deprecation_warnings = [x for x in w if issubclass(x.category, DeprecationWarning)]
            assert len(deprecation_warnings) == 0

    def test_score_quality_uses_yaml_weights(self) -> None:
        """score_quality() must produce weighted scores consistent with YAML weights."""
        from platxa_agent_generator.evaluation_criteria import EvaluationRubric
        from platxa_agent_generator.quality_scorer import score_quality

        yaml_weights = EvaluationRubric.load_default().weights()
        content = (
            "---\nname: test-agent\ndescription: Analyzes code\ntools: Read, Grep\n---\n\n"
            "# Test Agent\n\n## Overview\nAnalyzes code.\n\n## Workflow\n"
            "1. Read files with Read\n2. Search with Grep\n\n## Examples\n"
            "### Example 1: Basic Usage\nUser: Analyze code\nAgent: Reads and greps\n"
        )
        report = score_quality(content)
        for criterion in report.criteria:
            name_key = criterion.name.lower().replace(" ", "_")
            if name_key in yaml_weights:
                assert criterion.weight == yaml_weights[name_key], (
                    f"{criterion.name} weight {criterion.weight} != "
                    f"YAML weight {yaml_weights[name_key]}"
                )


class TestJudgeEntrypoint:
    """Per-axis isolation tests for the public judge() entrypoint."""

    SAMPLE_AGENT = (
        "---\nname: test-agent\ndescription: Analyzes code for quality\n"
        "tools: Read, Grep, Bash\n---\n\n"
        "# Test Agent\n\n## Overview\nAnalyzes code for quality issues.\n\n"
        "## Workflow\n1. Read target files with Read\n2. Search for patterns with Grep\n"
        "3. Run linters via Bash\n\n"
        "## Examples\n### Example 1: Lint a file\n"
        "User: Check main.py for issues\n"
        "Agent: Reads main.py, runs ruff check, reports findings\n\n"
        "## Output Format\nStructured list of findings with severity.\n"
    )

    def test_judge_clarity_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("clarity", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "clarity"
        assert 0.0 <= result.score <= 10.0

    def test_judge_completeness_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("completeness", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "completeness"
        assert 0.0 <= result.score <= 10.0

    def test_judge_tool_design_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("tool_design", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "tool_design"
        assert 0.0 <= result.score <= 10.0

    def test_judge_examples_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("examples", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "examples"
        assert 0.0 <= result.score <= 10.0

    def test_judge_security_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("security", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "security"
        assert 0.0 <= result.score <= 10.0

    def test_judge_documentation_returns_criterion_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CriterionScore, judge

        result = judge("documentation", self.SAMPLE_AGENT)
        assert isinstance(result, CriterionScore)
        assert result.name.lower().replace(" ", "_") == "documentation"
        assert 0.0 <= result.score <= 10.0

    def test_judge_invalid_criterion_raises_valueerror(self) -> None:
        import pytest

        from platxa_agent_generator.quality_scorer import judge

        with pytest.raises(ValueError, match="Unknown criterion"):
            judge("nonexistent", self.SAMPLE_AGENT)

    def test_judge_populates_findings_and_suggestions(self) -> None:
        from platxa_agent_generator.quality_scorer import judge

        result = judge("clarity", self.SAMPLE_AGENT)
        assert isinstance(result.findings, list)
        assert isinstance(result.suggestions, list)

    def test_judge_weighted_score_matches_weight_times_score(self) -> None:
        from platxa_agent_generator.quality_scorer import CRITERIA_WEIGHTS, judge

        result = judge("clarity", self.SAMPLE_AGENT)
        expected_weighted = result.score * CRITERIA_WEIGHTS["clarity"]
        assert abs(result.weighted_score - expected_weighted) < 0.01

    def test_judge_matches_score_quality_per_axis(self) -> None:
        """judge() must produce identical scores to score_quality() for each axis."""
        from platxa_agent_generator.quality_scorer import judge, score_quality

        report = score_quality(self.SAMPLE_AGENT)
        for criterion in report.criteria:
            name_key = criterion.name.lower().replace(" ", "_")
            isolated = judge(name_key, self.SAMPLE_AGENT)
            assert isolated.score == criterion.score, (
                f"{name_key}: judge()={isolated.score} != score_quality()={criterion.score}"
            )
