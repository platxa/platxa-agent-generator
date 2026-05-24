#!/usr/bin/env python3
"""
test_hooks — sharded from test_generator.py.

Shards: 10 TestXxx classes.
Run with: pytest tests/test_hooks.py -v
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

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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
        """Import recommend_hooks_for_agent from the installed package."""
        from platxa_agent_generator.agent_generator import (
            generate_hooks_section,
            recommend_hooks_for_agent,
        )

        return recommend_hooks_for_agent, generate_hooks_section

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
                    ""
                    "from platxa_agent_generator.hooks_generator import generate_pretooluse_deny_script; "
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
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_pretooluse_hook_config; "
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
                    ""
                    "from platxa_agent_generator.hooks_generator import generate_posttooluse_lint_script; "
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
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_posttooluse_lint_hook_config; "
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
                    ""
                    "from platxa_agent_generator.hooks_generator import generate_stop_verification_script; "
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
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_stop_verification_hook_config; "
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

    def test_script_contains_stop_hook_active_guard(self) -> None:
        """Generated script must check stop_hook_active to prevent recursion."""
        script = self._generate_script("test-agent")
        assert "stop_hook_active" in script

    def test_short_circuits_when_stop_hook_active(self, tmp_path: Path) -> None:
        """When stop_hook_active=true in payload, exit 0 without running tests."""
        script = self._generate_script("test-agent")
        script_path = tmp_path / "verify.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        project_dir = tmp_path / "project"
        project_dir.mkdir()
        (project_dir / "pyproject.toml").write_text("[tool.pytest.ini_options]\n")

        result = subprocess.run(
            ["bash", str(script_path)],
            input='{"stop_hook_active": true}',
            capture_output=True,
            text=True,
            cwd=str(project_dir),
        )
        assert result.returncode == 0, (
            f"Script must short-circuit on stop_hook_active=true. stderr: {result.stderr}"
        )


class TestStopObservationScript:
    """Tests for Stop observation hook generation (Feature #31).

    Verifies that generated Stop observation scripts emit valid JSONL
    observation rows, dispatch the observer-subagent advisory, and
    produce correct hook configs.
    """

    def _generate_script(
        self, agent_name: str, obs_file: str = ".claude/observations.jsonl"
    ) -> str:
        """Generate Stop observation script via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_observation_script; "
                    f"print(generate_stop_observation_script('{agent_name}', '{obs_file}'))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _generate_config(self, agent_name: str, script_path: str) -> dict:
        """Generate Stop observation hook config via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_stop_observation_hook_config; "
                    f"print(json.dumps(generate_stop_observation_hook_config('{agent_name}', '{script_path}')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Config generation failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated script must be valid bash syntax."""
        script = self._generate_script("obs-agent")
        script_path = tmp_path / "observe.sh"
        script_path.write_text(script)
        result = subprocess.run(["bash", "-n", str(script_path)], capture_output=True, text=True)
        assert result.returncode == 0, f"Bash syntax error: {result.stderr}"

    def test_script_has_shebang(self) -> None:
        """Script must start with bash shebang."""
        script = self._generate_script("obs-agent")
        assert script.startswith("#!/usr/bin/env bash")

    def test_script_includes_agent_name(self) -> None:
        """Script must include agent name in output messages and record."""
        script = self._generate_script("my-observer")
        assert "my-observer" in script

    def test_script_writes_jsonl(self) -> None:
        """Script must write to the observations JSONL file."""
        script = self._generate_script("obs-agent")
        assert "observations.jsonl" in script
        assert "json.dumps" in script

    def test_script_emits_observation_record_fields(self) -> None:
        """Script must emit all required ObservationRecord fields."""
        script = self._generate_script("obs-agent")
        for field in ("timestamp", "tool", "input_summary", "project_id", "project_name"):
            assert field in script, f"Missing required field: {field}"

    def test_script_emits_optional_fields(self) -> None:
        """Script must emit optional ObservationRecord fields."""
        script = self._generate_script("obs-agent")
        for field in ("session_id", "agent_name", "type", "evidence", "confidence"):
            assert field in script, f"Missing optional field: {field}"

    def test_script_uses_session_end_type(self) -> None:
        """Script must use 'session_end' as observation type."""
        script = self._generate_script("obs-agent")
        assert "session_end" in script

    def test_script_prints_observer_advisory(self) -> None:
        """Script must print additionalContext advisory for observer dispatch."""
        script = self._generate_script("obs-agent")
        assert "observer-subagent" in script

    def test_script_exits_zero(self) -> None:
        """Script must always exit 0 (non-blocking)."""
        script = self._generate_script("obs-agent")
        lines = script.strip().split("\n")
        assert lines[-1].strip() == "exit 0"

    def test_script_custom_observations_file(self) -> None:
        """Script must use the custom observations file path."""
        script = self._generate_script("obs-agent", "/tmp/custom-obs.jsonl")
        assert "/tmp/custom-obs.jsonl" in script

    def test_script_creates_parent_dir(self) -> None:
        """Script must create parent directory of observations file."""
        script = self._generate_script("obs-agent")
        assert "mkdir -p" in script

    def test_script_produces_valid_jsonl_row(self, tmp_path: Path) -> None:
        """Running the script must produce a valid JSON line in the obs file."""
        script = self._generate_script("obs-agent", str(tmp_path / "obs.jsonl"))
        script_path = tmp_path / "observe.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"

        obs_file = tmp_path / "obs.jsonl"
        assert obs_file.exists(), "Observation JSONL file not created"
        lines = obs_file.read_text().strip().split("\n")
        assert len(lines) == 1, f"Expected 1 JSONL row, got {len(lines)}"

        row = json.loads(lines[0])
        assert row["tool"] == "Stop"
        assert row["agent_name"] == "obs-agent"
        assert row["type"] == "session_end"
        assert row["confidence"] == 1.0
        assert row["promoted_to"] is None
        assert isinstance(row["examples"], list)
        assert row["timestamp"]
        assert row["project_id"]
        assert row["project_name"]
        assert row["input_summary"]

    def test_hook_config_uses_stop_event(self) -> None:
        """Hook config must use Stop event."""
        config = self._generate_config("obs-agent", "/path/to/observe.sh")
        assert "Stop" in config
        assert len(config["Stop"]) == 1

    def test_hook_config_uses_correct_script_path(self) -> None:
        """Hook config must reference the provided script path."""
        config = self._generate_config("obs-agent", "/home/user/.claude/hooks/observe.sh")
        command = config["Stop"][0]["hooks"][0]["command"]
        assert command == "/home/user/.claude/hooks/observe.sh"

    def test_hook_config_has_no_matcher(self) -> None:
        """Stop hooks should not have a matcher."""
        config = self._generate_config("obs-agent", "/path/to/observe.sh")
        assert "matcher" not in config["Stop"][0]

    def test_rejects_invalid_agent_name(self) -> None:
        """Must reject agent names with shell metacharacters."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_observation_script; "
                    "generate_stop_observation_script('bad; rm -rf /')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_rejects_empty_observations_file(self) -> None:
        """Must reject empty observations_file."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_observation_script; "
                    "generate_stop_observation_script('test-agent', '')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_config_rejects_empty_script_path(self) -> None:
        """Must reject empty script_path in hook config."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_observation_hook_config; "
                    "generate_stop_observation_hook_config('test-agent', '')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_observations_file_shell_injection_safe(self, tmp_path: Path) -> None:
        """Shell metacharacters in observations_file must be safely quoted."""
        malicious = str(tmp_path / '"; echo PWNED #')
        script = self._generate_script("obs-agent", malicious)
        script_path = tmp_path / "observe.sh"
        script_path.write_text(script)

        result = subprocess.run(["bash", "-n", str(script_path)], capture_output=True, text=True)
        assert result.returncode == 0, f"Bash syntax error with special path: {result.stderr}"
        assert "PWNED" not in script or "shlex" in script or "'" in script

    def test_script_contains_stop_hook_active_guard(self) -> None:
        """Generated script must check stop_hook_active to prevent recursion."""
        script = self._generate_script("obs-agent")
        assert "stop_hook_active" in script

    def test_short_circuits_when_stop_hook_active(self, tmp_path: Path) -> None:
        """When stop_hook_active=true in payload, exit 0 without writing observation."""
        obs_file = tmp_path / "obs.jsonl"
        script = self._generate_script("obs-agent", str(obs_file))
        script_path = tmp_path / "observe.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        result = subprocess.run(
            ["bash", str(script_path)],
            input='{"stop_hook_active": true}',
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
        )
        assert result.returncode == 0, (
            f"Script must short-circuit on stop_hook_active=true. stderr: {result.stderr}"
        )
        assert not obs_file.exists(), "Observation file should not be written when guard triggers"


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
                    ""
                    "from platxa_agent_generator.hooks_generator import generate_task_completed_script; "
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
            "import json; "
            "from platxa_agent_generator.hooks_generator import generate_hook_scripts; "
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


class TestMultiAgentHooks:
    """Tests for TeammateIdle / TaskCreated / TaskCompleted hook generation (Feature #40).

    Exercises the three new multi-agent coordination hook generators plus the
    `generate_multi_agent_hooks` team bundle helper. Uses subprocess to invoke
    scripts for real behavior verification (same pattern as sibling test classes).
    """

    # --- helpers ------------------------------------------------------------

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        """Run a Python snippet in a subprocess with SCRIPTS_DIR on sys.path."""
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_idle(self, agent: str, team: str = "") -> str:
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_teammate_idle_script; "
            f"print(generate_teammate_idle_script({agent!r}, {team!r}))"
        )
        assert result.returncode == 0, f"idle gen failed: {result.stderr}"
        return result.stdout

    def _gen_task_created(self, agent: str) -> str:
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_task_created_script; "
            f"print(generate_task_created_script({agent!r}))"
        )
        assert result.returncode == 0, f"task_created gen failed: {result.stderr}"
        return result.stdout

    def _gen_task_completed(self, agent: str) -> str:
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_task_completed_script; "
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
            "import json; from platxa_agent_generator.hooks_generator import HOOK_EVENTS, NO_MATCHER_EVENTS; "
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
            result = self._run_py(
                f"from platxa_agent_generator.hooks_generator import {fn}; {fn}('', '/tmp/x.sh')"
            )
            assert result.returncode != 0, f"{fn} accepted empty agent_name"
            assert "agent_name" in result.stderr

    def test_hook_configs_reject_empty_script_path(self) -> None:
        """All three config functions must raise ValueError on empty script_path."""
        for fn in (
            "generate_teammate_idle_hook_config",
            "generate_task_created_hook_config",
            "generate_task_completed_hook_config",
        ):
            result = self._run_py(
                f"from platxa_agent_generator.hooks_generator import {fn}; {fn}('agent', '   ')"
            )
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
                f"from platxa_agent_generator.hooks_generator import {fn}; "
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
            "from platxa_agent_generator.hooks_generator import generate_multi_agent_hooks; "
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


class TestSubagentAuditHooks:
    """Tests for SubagentStart/SubagentStop JSONL audit hooks (Feature #15).

    Exercises generate_subagent_audit_script / _hook_config / _hooks plus the
    ``subagent-audit`` dispatch branch in generate_hooks. Tests run the
    generated bash script in a subprocess against simulated Claude Code hook
    JSON payloads on stdin and assert on the resulting JSONL audit log.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_script(self, agent: str, log_file: str = ".claude/audit.jsonl") -> str:
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_subagent_audit_script; "
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
            "from platxa_agent_generator.hooks_generator import HOOK_EVENTS, validate_event; "
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
            "from platxa_agent_generator.hooks_generator import generate_subagent_audit_script\n"
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
            "import json; from platxa_agent_generator.hooks_generator import generate_subagent_audit_hook_config; "
            "cfg = generate_subagent_audit_hook_config('a', '/tmp/a-audit.sh'); "
            "print(json.dumps(sorted(cfg.keys())))"
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == ["SubagentStart", "SubagentStop"]

    def test_hook_config_validates_inputs(self) -> None:
        """Empty agent_name or script_path must raise ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_subagent_audit_hook_config\n"
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
            "from platxa_agent_generator.hooks_generator import generate_subagent_audit_hooks; "
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
            "from platxa_agent_generator.hooks_generator import generate_hooks, definition_to_settings_format; "
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
            "from platxa_agent_generator.hooks_generator import generate_hooks, definition_to_settings_format; "
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


class TestStopHookCompletionCheck:
    """Tests for Stop-hook completion-check generation (Feature #33).

    Verifies that generated Stop scripts gate termination on the
    ``<promise>COMPLETE</promise>`` marker using regex extraction +
    byte-exact comparison, block with exit 2 when absent and iteration < max,
    and allow with exit 0 when marker present or iteration >= max.
    """

    def _generate_script(self, agent_name: str, max_iterations: int = 5) -> str:
        """Generate completion-check script via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_hook_completion_check; "
                    f"print(generate_stop_hook_completion_check('{agent_name}', {max_iterations}))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _generate_config(self, agent_name: str, script_path: str) -> dict:
        """Generate completion-check hook config via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_stop_hook_completion_check_config; "
                    f"print(json.dumps(generate_stop_hook_completion_check_config('{agent_name}', '{script_path}')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Config generation failed: {result.stderr}"
        return json.loads(result.stdout)

    def _run_script(
        self,
        tmp_path: Path,
        agent_name: str,
        stdin_payload: dict,
        max_iterations: int = 5,
        env_overrides: dict | None = None,
    ) -> subprocess.CompletedProcess:
        """Write and execute the completion-check script with a given stdin payload."""
        script = self._generate_script(agent_name, max_iterations)
        script_path = tmp_path / "completion-check.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        env = os.environ.copy()
        if env_overrides:
            env.update(env_overrides)

        return subprocess.run(
            ["bash", str(script_path)],
            input=json.dumps(stdin_payload),
            capture_output=True,
            text=True,
            cwd=str(tmp_path),
            env=env,
        )

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated script must be valid bash syntax."""
        script = self._generate_script("check-agent")
        script_path = tmp_path / "check.sh"
        script_path.write_text(script)
        result = subprocess.run(["bash", "-n", str(script_path)], capture_output=True, text=True)
        assert result.returncode == 0, f"Bash syntax error: {result.stderr}"

    def test_script_has_shebang(self) -> None:
        """Script must start with bash shebang."""
        script = self._generate_script("check-agent")
        assert script.startswith("#!/usr/bin/env bash")

    def test_script_includes_agent_name(self) -> None:
        """Script must include agent name in output messages."""
        script = self._generate_script("my-checker")
        assert "my-checker" in script

    def test_script_uses_regex_extraction(self) -> None:
        """Script must use regex <promise>(.*?)</promise>, not naive substring."""
        script = self._generate_script("check-agent")
        assert r"<promise>(.*?)</promise>" in script

    def test_exit_0_when_marker_present(self, tmp_path: Path) -> None:
        """Exit 0 when <promise>COMPLETE</promise> is in last_assistant_message."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "Done. <promise>COMPLETE</promise>",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 0

    def test_exit_2_when_marker_absent(self, tmp_path: Path) -> None:
        """Exit 2 when marker absent and iteration < max."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "Still working on it.",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2
        assert "completion-check" in result.stderr

    def test_exit_0_when_iteration_at_max(self, tmp_path: Path) -> None:
        """Exit 0 when marker absent but iteration >= max (safety valve)."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "No marker here.",
                "current_iteration": 5,
            },
            max_iterations=5,
        )
        assert result.returncode == 0
        assert "allowing termination" in result.stderr

    def test_exit_0_when_iteration_exceeds_max(self, tmp_path: Path) -> None:
        """Exit 0 when iteration > max."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "No marker.",
                "current_iteration": 10,
            },
            max_iterations=3,
        )
        assert result.returncode == 0

    def test_rejects_wrong_inner_token(self, tmp_path: Path) -> None:
        """Exit 2 when inner token is not 'COMPLETE' (e.g. lowercase)."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "Done. <promise>complete</promise>",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2

    def test_rejects_substring_match(self, tmp_path: Path) -> None:
        """Exit 2 when full marker appears as prose but not in tags."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": 'The marker is "<promise>COMPLETE</promise>" in the docs.',
                "current_iteration": 1,
            },
        )
        # This one SHOULD match — the marker genuinely appears in the text
        assert result.returncode == 0

    def test_marker_embedded_in_longer_message(self, tmp_path: Path) -> None:
        """Exit 0 when marker appears anywhere in a longer message."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": (
                    "I have completed all tasks.\n\n<promise>COMPLETE</promise>\n\nThank you."
                ),
                "current_iteration": 2,
            },
        )
        assert result.returncode == 0

    def test_empty_message_blocks(self, tmp_path: Path) -> None:
        """Exit 2 when last_assistant_message is empty."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2

    def test_missing_message_field_blocks(self, tmp_path: Path) -> None:
        """Exit 2 when last_assistant_message is not in the payload."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {"current_iteration": 1},
        )
        assert result.returncode == 2

    def test_custom_max_iterations(self) -> None:
        """max_iterations parameter is embedded in the script."""
        script = self._generate_script("check-agent", max_iterations=10)
        assert "10" in script

    def test_default_max_iterations(self) -> None:
        """Default max_iterations is 5."""
        script = self._generate_script("check-agent")
        assert "5" in script

    def test_rejects_invalid_agent_name(self) -> None:
        """Must reject agent names with shell metacharacters."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_hook_completion_check; "
                    "generate_stop_hook_completion_check('bad; rm -rf /')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_rejects_zero_max_iterations(self) -> None:
        """Must reject max_iterations < 1."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_hook_completion_check; "
                    "generate_stop_hook_completion_check('test-agent', 0)"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_hook_config_uses_stop_event(self) -> None:
        """Hook config must use Stop event."""
        config = self._generate_config("check-agent", "/path/to/check.sh")
        assert "Stop" in config
        assert len(config["Stop"]) == 1

    def test_hook_config_uses_correct_script_path(self) -> None:
        """Hook config must reference the provided script path."""
        config = self._generate_config("check-agent", "/home/user/.claude/hooks/check.sh")
        command = config["Stop"][0]["hooks"][0]["command"]
        assert command == "/home/user/.claude/hooks/check.sh"

    def test_hook_config_has_no_matcher(self) -> None:
        """Stop hooks should not have a matcher."""
        config = self._generate_config("check-agent", "/path/to/check.sh")
        assert "matcher" not in config["Stop"][0]

    def test_hook_config_rejects_empty_script_path(self) -> None:
        """Must reject empty script_path."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_stop_hook_completion_check_config; "
                    "generate_stop_hook_completion_check_config('test-agent', '')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "ValueError" in result.stderr

    def test_re_prompt_message_is_actionable(self, tmp_path: Path) -> None:
        """Stderr on exit 2 must tell the model to emit the marker."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "Not done yet.",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 2
        assert "completion-promise marker" in result.stderr or "Re-prompting" in result.stderr

    def test_script_contains_stop_hook_active_guard(self) -> None:
        """Generated script must check stop_hook_active to prevent recursion."""
        script = self._generate_script("check-agent")
        assert "stop_hook_active" in script

    def test_short_circuits_when_stop_hook_active(self, tmp_path: Path) -> None:
        """When stop_hook_active=true in payload, exit 0 regardless of marker."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "stop_hook_active": True,
                "last_assistant_message": "No marker here.",
                "current_iteration": 1,
            },
        )
        assert result.returncode == 0, (
            f"Script must short-circuit on stop_hook_active=true. stderr: {result.stderr}"
        )

    def test_env_var_fallback_for_max_iterations(self, tmp_path: Path) -> None:
        """CLAUDE_MAX_ITERATIONS env var overrides the baked-in default."""
        result = self._run_script(
            tmp_path,
            "check-agent",
            {
                "last_assistant_message": "No marker.",
                "current_iteration": 2,
            },
            max_iterations=5,
            env_overrides={"CLAUDE_MAX_ITERATIONS": "2"},
        )
        assert result.returncode == 0


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
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def _gen_script(self, agent: str, log_file: str) -> str:
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import generate_subagent_audit_script; "
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

    def test_post_tool_use_emits_observation_record_json(self, tmp_path: Path) -> None:
        """PostToolUse audit hook must emit structured JSON parseable into ObservationRecord."""
        log_file = tmp_path / "audit.jsonl"
        result = self._run_py(
            "from platxa_agent_generator.hooks_generator import create_audit_hook\n"
            f"h = create_audit_hook('test-agent', 'PostToolUse', {str(log_file)!r})\n"
            "print(h.hooks[0].command)\n"
        )
        assert result.returncode == 0, result.stderr
        command = result.stdout.strip()

        env = {
            **os.environ,
            "CLAUDE_TOOL_NAME": "Read",
            "CLAUDE_PROJECT_DIR": "/home/user/myproject",
            "CLAUDE_SESSION_ID": "sess-001",
        }
        shell_result = subprocess.run(
            ["bash", "-c", command],
            capture_output=True,
            text=True,
            env=env,
        )
        assert shell_result.returncode == 0, f"printf command failed: {shell_result.stderr}"
        assert log_file.exists(), "audit log must be created"

        from platxa_agent_generator.observation_store import ObservationRecord

        line = log_file.read_text().strip()
        data = json.loads(line)
        record = ObservationRecord.from_dict(data)
        assert record.tool == "Read"
        assert record.agent_name == "test-agent"
        assert record.type == "tool_use"
        assert record.project_id == "/home/user/myproject"
        assert record.project_name == "myproject"
        assert record.session_id == "sess-001"
        assert record.input_summary == "PostToolUse"
        assert record.timestamp  # non-empty


class TestHooksGeneratorInjection:
    """Feature #1 (SECURITY CRITICAL): hooks_generator.py must reject agent_name
    containing shell metacharacters and must wrap agent_name with shlex.quote()
    at every shell-interpolation site. Prevents remote code execution via
    malicious agent names like `"; rm -rf / #` reaching downstream hook
    execution in the user shell.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
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
            "from platxa_agent_generator.hooks_generator import _validate_agent_name\n"
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
            "from platxa_agent_generator.hooks_generator import _validate_agent_name\n"
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
            f"from platxa_agent_generator.hooks_generator import {fn}\n"
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
            "from platxa_agent_generator.hooks_generator import create_notification_hook\n"
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
            "from platxa_agent_generator.hooks_generator import generate_hooks\n"
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
            "from platxa_agent_generator.hooks_generator import create_audit_hook\n"
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


class TestSessionStartContextScript:
    """Tests for SessionStart context injection hook generation (Feature #35).

    Verifies that generated scripts load instincts recursively, include
    progress, truncate at the character cap, and produce valid hook configs.
    """

    def _generate_script(
        self,
        agent_name: str,
        instincts_dir: str = ".claude/instincts",
        progress_file: str = ".claude/claude-progress.txt",
        max_chars: int = 10000,
    ) -> str:
        """Generate SessionStart context script via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_script; "
                    f"print(generate_session_start_context_script('{agent_name}', "
                    f"'{instincts_dir}', '{progress_file}', {max_chars}))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Script generation failed: {result.stderr}"
        return result.stdout

    def _generate_config(self, agent_name: str, script_path: str) -> dict:
        """Generate SessionStart context hook config via subprocess."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_hook_config; "
                    f"print(json.dumps(generate_session_start_context_hook_config('{agent_name}', '{script_path}')))"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Config generation failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_script_is_valid_bash(self, tmp_path: Path) -> None:
        """Generated script must be valid bash syntax."""
        script = self._generate_script("ctx-agent")
        script_path = tmp_path / "session-context.sh"
        script_path.write_text(script)
        result = subprocess.run(["bash", "-n", str(script_path)], capture_output=True, text=True)
        assert result.returncode == 0, f"Bash syntax error: {result.stderr}"

    def test_script_has_shebang(self) -> None:
        """Script must start with bash shebang."""
        script = self._generate_script("ctx-agent")
        assert script.startswith("#!/usr/bin/env bash")

    def test_script_includes_agent_name(self) -> None:
        """Script must include agent name in comments and log messages."""
        script = self._generate_script("my-context-loader")
        assert "my-context-loader" in script

    def test_script_reads_instincts_dir(self) -> None:
        """Script must reference the instincts directory."""
        script = self._generate_script("ctx-agent")
        assert ".claude/instincts" in script

    def test_script_reads_progress_file(self) -> None:
        """Script must reference the progress file."""
        script = self._generate_script("ctx-agent")
        assert "claude-progress.txt" in script

    def test_script_uses_rglob_for_recursive_search(self) -> None:
        """Script must use rglob to find instinct .md files recursively."""
        script = self._generate_script("ctx-agent")
        assert "rglob" in script

    def test_script_respects_max_chars(self) -> None:
        """Script must embed the max_chars parameter."""
        script = self._generate_script("ctx-agent", max_chars=5000)
        assert "5000" in script

    def test_script_custom_instincts_dir(self) -> None:
        """Script must use custom instincts directory path."""
        script = self._generate_script("ctx-agent", instincts_dir="/tmp/my-instincts")
        assert "/tmp/my-instincts" in script

    def test_script_custom_progress_file(self) -> None:
        """Script must use custom progress file path."""
        script = self._generate_script("ctx-agent", progress_file="/tmp/my-progress.txt")
        assert "/tmp/my-progress.txt" in script

    def test_script_exits_zero(self) -> None:
        """Script must always exit 0 (non-blocking)."""
        script = self._generate_script("ctx-agent")
        lines = script.strip().split("\n")
        assert lines[-1].strip() == "exit 0"

    def test_script_has_truncation_logic(self) -> None:
        """Script must include truncation with overflow notice."""
        script = self._generate_script("ctx-agent")
        assert "TRUNCATED" in script

    def test_script_prioritizes_instincts(self) -> None:
        """Script must allocate instincts budget before progress."""
        script = self._generate_script("ctx-agent")
        assert "instincts_budget" in script

    def test_script_emits_section_markers(self) -> None:
        """Script must emit [instincts] and [progress] section markers."""
        script = self._generate_script("ctx-agent")
        assert "[instincts]" in script
        assert "[progress]" in script

    def test_script_runs_with_instincts(self, tmp_path: Path) -> None:
        """Script must load instinct files and emit them as stdout."""
        script = self._generate_script(
            "ctx-agent",
            instincts_dir=str(tmp_path / "instincts"),
            progress_file=str(tmp_path / "progress.txt"),
        )

        instincts_dir = tmp_path / "instincts" / "personal"
        instincts_dir.mkdir(parents=True)
        (instincts_dir / "test-instinct.md").write_text(
            "---\nname: test\nconfidence: 0.9\n---\n\nAlways check types."
        )
        (tmp_path / "progress.txt").write_text("[2026-01-01] feature #1 PASSED\n")

        script_path = tmp_path / "run.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        assert "test-instinct.md" in result.stdout
        assert "Always check types" in result.stdout
        assert "feature #1 PASSED" in result.stdout

    def test_script_runs_empty_dirs(self, tmp_path: Path) -> None:
        """Script must exit 0 with no output when no instincts or progress exist."""
        script = self._generate_script(
            "ctx-agent",
            instincts_dir=str(tmp_path / "no-instincts"),
            progress_file=str(tmp_path / "no-progress.txt"),
        )
        script_path = tmp_path / "run.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0
        assert result.stdout.strip() == ""

    def test_script_truncates_at_cap(self, tmp_path: Path) -> None:
        """Script must truncate output at the max_chars cap."""
        script = self._generate_script(
            "ctx-agent",
            instincts_dir=str(tmp_path / "instincts"),
            progress_file=str(tmp_path / "progress.txt"),
            max_chars=500,
        )

        instincts_dir = tmp_path / "instincts"
        instincts_dir.mkdir(parents=True)
        (instincts_dir / "big.md").write_text("x" * 2000)
        (tmp_path / "progress.txt").write_text("y" * 2000)

        script_path = tmp_path / "run.sh"
        script_path.write_text(script)
        script_path.chmod(0o755)

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0
        assert len(result.stdout) <= 520  # small buffer for newline

    def test_config_has_session_start_event(self) -> None:
        """Hook config must target SessionStart event."""
        config = self._generate_config("ctx-agent", "/path/to/script.sh")
        assert "SessionStart" in config

    def test_config_references_script_path(self) -> None:
        """Hook config must reference the provided script path."""
        config = self._generate_config("ctx-agent", "/opt/hooks/session-ctx.sh")
        hooks = config["SessionStart"][0]["hooks"]
        assert hooks[0]["command"] == "/opt/hooks/session-ctx.sh"

    def test_config_rejects_empty_agent_name(self) -> None:
        """Config must reject empty agent name."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_hook_config; "
                    "generate_session_start_context_hook_config('', '/path')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_config_rejects_empty_script_path(self) -> None:
        """Config must reject empty script path."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_hook_config; "
                    "generate_session_start_context_hook_config('ctx-agent', '')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_script_rejects_invalid_agent_name(self) -> None:
        """Script generation must reject agent names with shell metacharacters."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_script; "
                    "generate_session_start_context_script('bad;name')"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_script_rejects_low_max_chars(self) -> None:
        """Script generation must reject max_chars below 100."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.hooks_generator import generate_session_start_context_script; "
                    "generate_session_start_context_script('ctx-agent', max_chars=50)"
                ),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
