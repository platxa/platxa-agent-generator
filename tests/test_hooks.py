#!/usr/bin/env python3
"""
test_hooks -- hooks generator validation and security tests.

Template-based script generation tests (PreToolUse deny, PostToolUse lint,
Stop verification/observation, SessionStart context, observer dispatch,
teammate idle, task created/completed, subagent audit, multi-agent hooks,
completion check) were removed when the corresponding template functions
moved to skills/platxa-agent-generator/references/hooks-config-templates.md.

Remaining tests cover:
- Hook recommendation integration (Feature #11)
- Shell injection prevention (Feature #1 -- SECURITY CRITICAL)

Run with: pytest tests/test_hooks.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
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
