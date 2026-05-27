#!/usr/bin/env python3
"""
test_nlp — tests for nlp_parser thin interface.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_nlp.py -v
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestNlpParserThinInterface:
    """Tests for the retained thin interface after regex delegation removal.

    Covers: dataclass construction, extract_name slug generation, parse()
    defaults, COMPLEXITY_TIERS constant, CLI entry point.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
        )

    def test_parse_returns_agent_requirements_with_defaults(self) -> None:
        result = self._run_py(
            "import json\n"
            "from dataclasses import asdict\n"
            "from platxa_agent_generator.nlp_parser import parse\n"
            "r = parse('Create an agent that reviews code')\n"
            "print(json.dumps(asdict(r)))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["agent_type"] == "analyzer"
        assert data["tools"] == ["Bash", "Edit", "Glob", "Grep", "Read", "Write"]
        assert data["patterns"] == ["prompt-chaining"]
        assert data["confidence"] == 0.5
        assert data["domains"] == []
        assert data["disallowed_tools"] == []
        assert data["file_patterns"] == []
        assert data["constraint_phrases"] == []
        assert "complexity" in data
        assert "max_turns" in data
        assert "complexity_signals" in data

    def test_extract_name_produces_kebab_slug(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.nlp_parser import extract_name\n"
            "print(extract_name('Create an agent that reviews security issues'))"
        )
        assert result.returncode == 0, result.stderr
        name = result.stdout.strip()
        assert re.match(r"^[a-z][a-z0-9-]*$", name), f"bad slug: {name!r}"
        assert "create" not in name
        assert "agent" not in name

    def test_extract_name_fallback_for_empty(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.nlp_parser import extract_name\nprint(extract_name(''))"
        )
        assert result.stdout.strip() == "custom-agent"

    def test_parse_sanitizes_description_whitespace(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.nlp_parser import parse\n"
            "r = parse('hello\\n\\tworld\\n')\n"
            "print(repr(r.description))"
        )
        assert result.returncode == 0, result.stderr
        assert "\\n" not in result.stdout
        assert "\\t" not in result.stdout

    def test_parse_truncates_long_descriptions(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.nlp_parser import parse\n"
            "r = parse('x ' * 1000)\n"
            "print(len(r.description))"
        )
        length = int(result.stdout.strip())
        assert length <= 1024

    def test_complexity_tiers_constant_is_ordered(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.nlp_parser import COMPLEXITY_TIERS\n"
            "print(COMPLEXITY_TIERS)\n"
            "print(COMPLEXITY_TIERS.index('simple') < "
            "COMPLEXITY_TIERS.index('moderate') < "
            "COMPLEXITY_TIERS.index('complex'))"
        )
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "('simple', 'moderate', 'complex')"
        assert lines[1] == "True"

    def test_cli_json_output(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "--json",
                "Build a documentation generator",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert "name" in data
        assert "agent_type" in data
        assert "tools" in data
        assert "description" in data

    def test_cli_text_output(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "nlp_parser.py"),
                "Scan code for vulnerabilities",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout
        assert "Name:" in out
        assert "Type:" in out
        assert "Tools:" in out
        assert "Complexity:" in out

    def test_cli_no_args_exits_with_error(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "nlp_parser.py")],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0


class TestNlpParserMalformedInput:
    """Tests for nlp_parser.parse() hostile / malformed input (feature #22).

    ``nlp_parser.parse`` is the CI ``--non-interactive`` entry point — every
    generated agent flows through it at least once. The contract is that
    the parser either rejects its input with ``ValueError`` or returns a
    sanitized ``AgentRequirements`` object with safe frontmatter fields;
    it MUST NOT raise an unhandled exception (that would crash the
    generator) and MUST NOT return un-sanitized fields that get embedded
    into the emitted frontmatter (that would let a crafted description
    inject YAML keys or newlines into the target agent file).

    The 6 cases below pin that contract for:
    - empty string
    - whitespace-only
    - Unicode (emoji / kanji)
    - RTL scripts (Hebrew / Arabic)
    - oversized (> 10 KB) prompt
    - YAML-injection via newline-laden description
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
            check=False,
        )

    _NAME_PATTERN = r"^[a-z][a-z0-9_-]*$"

    def _assert_sanitized_or_rejected(
        self,
        probe_code: str,
        *,
        max_description_chars: int = 2048,
    ) -> None:
        """Shared assertion: parser either raises ValueError, or returns a
        result whose emitted fields are safe to embed in agent frontmatter.
        """
        result = self._run_py(probe_code)
        assert result.returncode == 0, (
            f"parse crashed with unhandled exception:\n"
            f"stdout={result.stdout!r}\nstderr={result.stderr!r}"
        )
        out = result.stdout.strip()
        if out.startswith("VE:"):
            return

        data = json.loads(out)
        assert re.match(self._NAME_PATTERN, data["name"]), (
            f"parser returned unsanitized name {data['name']!r} — would break frontmatter"
        )
        desc = data["description"]
        assert isinstance(desc, str)
        assert "\n---\n" not in desc, (
            f"description contains ``---`` delimiter — YAML-inject risk: {desc!r}"
        )
        assert len(desc) <= max_description_chars, (
            f"description length {len(desc)} exceeds cap — unbounded output "
            f"lets a huge prompt flood the emitted frontmatter"
        )
        assert isinstance(data["tools"], list)
        assert all(isinstance(t, str) for t in data["tools"])
        for tool in data["tools"]:
            assert re.match(r"^[A-Za-z][A-Za-z0-9_-]*$", tool), (
                f"tool {tool!r} is not a safe identifier"
            )

    _EMIT_JSON = (
        "import json, sys\n"
        "from platxa_agent_generator.nlp_parser import parse\n"
        "try:\n"
        "    r = parse(desc)\n"
        "except ValueError as e:\n"
        "    print('VE:' + str(e))\n"
        "    sys.exit(0)\n"
        "print(json.dumps({\n"
        "    'name': r.name,\n"
        "    'description': r.description,\n"
        "    'tools': r.tools,\n"
        "    'disallowed_tools': r.disallowed_tools,\n"
        "}))\n"
    )

    def test_empty_string_input(self) -> None:
        self._assert_sanitized_or_rejected("desc = ''\n" + self._EMIT_JSON)

    def test_whitespace_only_input(self) -> None:
        self._assert_sanitized_or_rejected("desc = '   \\n\\t  '\n" + self._EMIT_JSON)

    def test_unicode_emoji_kanji_input(self) -> None:
        self._assert_sanitized_or_rejected(
            "desc = '\U0001f680 日本語 agent that handles files'\n" + self._EMIT_JSON
        )

    def test_rtl_script_input(self) -> None:
        self._assert_sanitized_or_rejected("desc = 'وكيل يدير الملفات'\n" + self._EMIT_JSON)

    def test_oversized_prompt_10kb(self) -> None:
        self._assert_sanitized_or_rejected(
            "desc = 'Agent that reads files. ' * 600\n" + self._EMIT_JSON,
            max_description_chars=2048,
        )

    def test_yaml_injection_via_description(self) -> None:
        self._assert_sanitized_or_rejected(
            "desc = 'Reader agent\\n---\\nname: evil\\n"
            "tools: Bash, Write\\ndescription: pwned\\n---\\ntrailing'\n" + self._EMIT_JSON
        )
