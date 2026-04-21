#!/usr/bin/env python3
"""
test_install — sharded from test_generator.py.

Shards: 4 TestXxx classes.
Run with: pytest tests/test_install.py -v
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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

    # ------------------------------------------------------------------
    # Feature #20: pin file-state + error-JSON shape for flag combinations
    #
    # Prior coverage had only two happy-paths (install + list). The flag
    # branches below are the ones an operator actually hits — accidental
    # reinstall, --force overwrite, --no-backup, and a read-only target
    # filesystem. These tests pin the observable contract (target bytes,
    # backup file, JSON keys) so a refactor that silently drops a branch
    # fails loudly.
    # ------------------------------------------------------------------

    @staticmethod
    def _make_agent_file(path: Path, agent_name: str, body: str) -> Path:
        """Write a minimally valid agent .md file with the given name/body."""
        path.write_text(
            "---\n"
            f"name: {agent_name}\n"
            "description: Install flag test agent\n"
            "tools: Read, Write\n"
            "---\n"
            "\n"
            "# Flag Test Agent\n"
            "\n"
            "## Workflow\n"
            f"1. {body}\n",
            encoding="utf-8",
        )
        return path

    @staticmethod
    def _install(
        source: Path,
        project_dir: Path,
        *,
        force: bool = False,
        no_backup: bool = False,
    ) -> "subprocess.CompletedProcess[str]":
        """Invoke the CLI installer to project scope with --skip-validation."""
        argv: list[str] = [
            sys.executable,
            str(SCRIPTS_DIR / "install_agent.py"),
            "install",
            str(source),
            "--scope",
            "project",
            "--skip-validation",
            "--json",
        ]
        if force:
            argv.append("--force")
        if no_backup:
            argv.append("--no-backup")
        return subprocess.run(
            argv,
            capture_output=True,
            text=True,
            cwd=str(project_dir),
            check=False,
        )

    @staticmethod
    def _prep_project(tmp_path: Path) -> Path:
        """Create a fresh project/.claude/agents tree and return project dir."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        (project_dir / ".claude" / "agents").mkdir(parents=True)
        return project_dir

    def test_force_replaces_existing(self, tmp_path: Path) -> None:
        """``--force`` overwrites an existing installed agent with new body.

        Pins:
        - Second install succeeds (``success: true``, exit 0).
        - Target file bytes match the SECOND source (content was replaced,
          not silently kept).
        - ``installed_path`` in the JSON points at the expected location.
        """
        project_dir = self._prep_project(tmp_path)
        first = self._make_agent_file(tmp_path / "agent-v1.md", "force-agent", "first body")
        second = self._make_agent_file(tmp_path / "agent-v2.md", "force-agent", "second body")

        r1 = self._install(first, project_dir)
        assert r1.returncode == 0, r1.stderr
        out1 = json.loads(r1.stdout)
        assert out1["success"] is True, out1

        r2 = self._install(second, project_dir, force=True)
        assert r2.returncode == 0, r2.stderr
        out2 = json.loads(r2.stdout)
        assert out2["success"] is True, out2
        assert out2["agent_name"] == "force-agent"

        target = project_dir / ".claude" / "agents" / "force-agent.md"
        # The replaced target must contain the second source's body, not
        # the first's — otherwise the overwrite silently dropped the
        # update.
        target_bytes = target.read_bytes()
        assert b"second body" in target_bytes, target_bytes
        assert b"first body" not in target_bytes, target_bytes
        assert out2["installed_path"] == str(target)

    def test_backup_writes_bak_file(self, tmp_path: Path) -> None:
        """Default install path creates a timestamped backup on --force.

        Pins:
        - ``backup_path`` field is populated (non-null) in the JSON.
        - That file exists on disk with the ``.backup-{timestamp}.md``
          naming pattern.
        - The backup contents equal the ORIGINAL (pre-force) file, so a
          mistaken overwrite is recoverable.
        """
        project_dir = self._prep_project(tmp_path)
        first = self._make_agent_file(tmp_path / "agent-a.md", "backup-agent", "original")
        second = self._make_agent_file(tmp_path / "agent-b.md", "backup-agent", "replacement")

        self._install(first, project_dir)
        r2 = self._install(second, project_dir, force=True)
        assert r2.returncode == 0, r2.stderr
        out2 = json.loads(r2.stdout)

        assert out2["success"] is True
        assert out2["backup_path"] is not None, out2
        backup = Path(out2["backup_path"])
        assert backup.exists(), f"backup file missing: {backup}"
        # Naming pattern: <agent_name>.backup-<timestamp>.md
        assert backup.name.startswith("backup-agent.backup-"), backup.name
        assert backup.name.endswith(".md"), backup.name
        # Contents of the backup must match the ORIGINAL first install,
        # so recovery is possible after a clobber.
        backup_text = backup.read_text(encoding="utf-8")
        assert "original" in backup_text, backup_text
        assert "replacement" not in backup_text, backup_text

    def test_overwrite_without_force_errors(self, tmp_path: Path) -> None:
        """Reinstalling an existing agent without ``--force`` fails cleanly.

        Pins the error-JSON shape an operator sees when a naive reinstall
        hits an existing agent:
        - ``success: false``, CLI exit code 1.
        - ``message`` names 'already exists' AND points them at
          ``--force`` — the actionable remediation, not a stack trace.
        - ``agent_name`` is still populated so the caller knows which
          name collided, without reparsing the source.
        - The target file on disk is byte-identical to the first install
          (the failed second install MUST NOT have mutated it).
        """
        project_dir = self._prep_project(tmp_path)
        first = self._make_agent_file(tmp_path / "agent-a.md", "overwrite-agent", "first")
        second = self._make_agent_file(tmp_path / "agent-b.md", "overwrite-agent", "second")

        r1 = self._install(first, project_dir)
        assert r1.returncode == 0, r1.stderr
        target = project_dir / ".claude" / "agents" / "overwrite-agent.md"
        target_before = target.read_bytes()

        # Second install WITHOUT --force must fail.
        r2 = self._install(second, project_dir, force=False)
        assert r2.returncode == 1, (r2.stdout, r2.stderr)
        out2 = json.loads(r2.stdout)
        assert out2["success"] is False, out2
        assert out2["agent_name"] == "overwrite-agent"
        msg = out2["message"]
        assert "already exists" in msg, msg
        assert "--force" in msg, msg
        # No silent mutation — target bytes must be unchanged.
        assert target.read_bytes() == target_before

    def test_readonly_target_errors(self, tmp_path: Path) -> None:
        """Installing onto a read-only target file surfaces the OSError
        as a structured ``Failed to install`` JSON result.

        Pins the copy-path failure branch in ``install_agent``:
        ``shutil.copy2(source, target_path)`` raises PermissionError when
        ``target_path`` is read-only, and the caller converts it to a
        structured result rather than letting the traceback escape.

        The failure mode is root-dependent (root ignores chmod bits), so
        the test skips when running as uid 0 — the same pragmatic guard
        used across pytest suites that need real filesystem permissions.
        """
        if os.geteuid() == 0:
            pytest.skip("read-only file permissions are bypassed when running as root")
        project_dir = self._prep_project(tmp_path)
        first = self._make_agent_file(tmp_path / "agent-orig.md", "readonly-agent", "pre-freeze")
        # Seed the target, then freeze its permissions to r--r--r--.
        r1 = self._install(first, project_dir)
        assert r1.returncode == 0, r1.stderr
        target = project_dir / ".claude" / "agents" / "readonly-agent.md"
        original_bytes = target.read_bytes()
        os.chmod(target, 0o444)

        try:
            # --force ensures we reach the copy (past the "already
            # exists" gate); --no-backup avoids a separate failure mode
            # (backup creation) masking the one under test.
            second = self._make_agent_file(
                tmp_path / "agent-new.md", "readonly-agent", "post-freeze"
            )
            r2 = self._install(second, project_dir, force=True, no_backup=True)
            # CLI exit code must be 1 (installer failed), JSON must be
            # well-formed with the documented keys, and success=False.
            assert r2.returncode == 1, (r2.stdout, r2.stderr)
            out2 = json.loads(r2.stdout)
            assert out2["success"] is False, out2
            assert out2["agent_name"] == "readonly-agent"
            # Message must name the failure; the exact errno string is
            # OS-dependent but 'Failed to install' is the code-owned
            # prefix.
            assert "Failed to install" in out2["message"], out2["message"]
            # No silent mutation of the frozen target.
            assert target.read_bytes() == original_bytes
        finally:
            # Restore writability so pytest's tmp_path cleanup doesn't
            # fail on the read-only bit.
            os.chmod(target, 0o644)


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
        """Import install_agent from the installed package."""
        from platxa_agent_generator import install_agent

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

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
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
            "from platxa_agent_generator.install_agent import (\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
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
            "from platxa_agent_generator.install_agent import recommend_scope\n"
            "# Mentions linter (ruff) + language (python) + test_runner (pytest)\n"
            "# in a random order; result should follow dict declaration order\n"
            "rec = recommend_scope(content='ruff python pytest')\n"
            "cats = [s.split(':')[0] for s in rec.matched_signals]\n"
            "print(cats.index('language') < cats.index('test_runner'),\n"
            "      cats.index('test_runner') < cats.index('linter'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"


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

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
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
            "from platxa_agent_generator.install_agent import (\n"
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
            "from platxa_agent_generator.install_agent import verify_installation\n"
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
            "from platxa_agent_generator.install_agent import verify_installation\n"
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
            "from platxa_agent_generator.install_agent import verify_installation\n"
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
            "from platxa_agent_generator.install_agent import verify_installation\n"
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
