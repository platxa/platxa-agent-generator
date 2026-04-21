#!/usr/bin/env python3
"""
test_security_analysis — sharded from test_generator.py.

Shards: 4 TestXxx classes.
Run with: pytest tests/test_security_analysis.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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
        """The Bash+Write+WebFetch triple must fire the SEC046 rule
        specifically — not just "some warning, somewhere, somehow".

        Prior assertion was ``len(warnings) > 0 or score < 10.0``, which
        silently kept passing even if the specific dangerous-combo rule
        were deleted: (a) ``"warnings"`` is not a JSON key the scanner
        emits (it emits ``"findings"``), so the first clause was always
        False; (b) ``score < 10.0`` can be triggered by ANY other rule
        (missing description, long line, etc.), so the SEC046 rule
        could vanish and this test would still pass on some other
        penalty — exactly the regression shape the feature spec
        called out as a mutation-test blind spot.

        Tightened to mutation-detectable form:
        - Finding list contains ``code == "SEC046"`` (the
          ``WebFetch + Bash + Write`` triple, severity CRITICAL,
          title "Remote code execution chain").
        - Its ``evidence`` names all three tools so an operator
          reading the report knows WHY the rule fired.
        - Severity is CRITICAL, not demoted.

        Mutation guarantee: delete the SEC046 entry from
        ``DANGEROUS_TOOL_COMBINATIONS`` in security_scanner.py and this
        test MUST fail (no finding will have code=SEC046).
        """
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
        findings = output.get("findings", [])
        # Mutation-sensitive assertion: the SPECIFIC rule for this
        # triple must fire — not just any rule that happens to drop
        # the score.
        sec046 = next((f for f in findings if f.get("code") == "SEC046"), None)
        assert sec046 is not None, (
            "SEC046 (WebFetch+Bash+Write remote-code-execution-chain rule) "
            "did not fire. Finding codes present: "
            f"{sorted({f.get('code') for f in findings})}"
        )
        # Evidence must name all three tools so the report is actionable.
        evidence = sec046.get("evidence") or ""
        assert "Bash" in evidence, f"evidence missing 'Bash': {evidence!r}"
        assert "Write" in evidence, f"evidence missing 'Write': {evidence!r}"
        assert "WebFetch" in evidence, f"evidence missing 'WebFetch': {evidence!r}"
        # Severity pin: this rule is defined CRITICAL in the combo
        # table; a silent demotion (e.g. to MEDIUM) would weaken the
        # gate and must show up as a test failure.
        assert sec046.get("severity") == "critical", (
            f"SEC046 severity demoted: {sec046.get('severity')!r}"
        )


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
