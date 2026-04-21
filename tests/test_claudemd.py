#!/usr/bin/env python3
"""
test_claudemd — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_claudemd.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
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
            "from platxa_agent_generator.claudemd_generator import"
            " SUBAGENT_DELEGATION_HEADING, DEFAULT_AGENTS_DIR\n"
            "print(SUBAGENT_DELEGATION_HEADING, '|', DEFAULT_AGENTS_DIR)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "## Subagent Delegation | .claude/agents"

    def test_available_agent_dataclass(self) -> None:
        """AvailableAgent has name, description, default-empty when_to_use."""
        result = self._run_py(
            "from platxa_agent_generator.claudemd_generator import AvailableAgent\n"
            "a = AvailableAgent(name='x', description='d')\n"
            "print(a.name, a.description, repr(a.when_to_use))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "x d ''"

    def test_context_available_agents_defaults_empty(self) -> None:
        """AgentContext.available_agents defaults to an empty list."""
        result = self._run_py(
            "from platxa_agent_generator.claudemd_generator import AgentContext\n"
            "c = AgentContext(name='a', description='d', tools=['Read'])\n"
            "print(c.available_agents)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_delegation_section_empty_when_no_agents(self) -> None:
        """Empty agents list → empty string."""
        result = self._run_py(
            "from platxa_agent_generator.claudemd_generator import generate_subagent_delegation_section\n"
            "print(repr(generate_subagent_delegation_section([])))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_delegation_section_renders_agents(self) -> None:
        """Each agent appears in the main list with name+description."""
        result = self._run_py(
            "from platxa_agent_generator.claudemd_generator import"
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
            "from platxa_agent_generator.claudemd_generator import"
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
            "from platxa_agent_generator.claudemd_generator import"
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
            "from platxa_agent_generator.claudemd_generator import"
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
            "from platxa_agent_generator.claudemd_generator import AgentContext, generate_claudemd\n"
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
            "from platxa_agent_generator.claudemd_generator import discover_available_agents\n"
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
            "from platxa_agent_generator.claudemd_generator import discover_available_agents\n"
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
            "from platxa_agent_generator.claudemd_generator import discover_available_agents\n"
            "print(discover_available_agents('/tmp/__definitely_no_agents_dir__'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"


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

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
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
            "from platxa_agent_generator.prompt_generator import (\n"
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
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_context_management_section\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json')\n"
            "print(repr(generate_context_management_section(cfg)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_section_renders_when_long_running(self) -> None:
        """Long-running agents get heading + every canonical rule."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
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
            "from platxa_agent_generator.prompt_generator import CONTEXT_MANAGEMENT_RULES\n"
            "first = CONTEXT_MANAGEMENT_RULES[0].lower()\n"
            "print('context' in first and ('window' in first or 'history' in first))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_rules_cover_subagent_and_clear(self) -> None:
        """Verification criteria require subagent delegation + /clear guidance."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import CONTEXT_MANAGEMENT_RULES\n"
            "joined = ' '.join(CONTEXT_MANAGEMENT_RULES).lower()\n"
            "print('subagent' in joined and 'task tool' in joined)\n"
            "print('/clear' in joined)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_blocks_omit_section_for_short_lived(self) -> None:
        """generate_prompt_blocks does not leak the section by default."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read'],[],'json')\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('Context Management' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_blocks_include_section_for_long_running(self) -> None:
        """generate_prompt_blocks injects the section into CONTEXT when opted in."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
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

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
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
            "from platxa_agent_generator.prompt_generator import (\n"
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
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_subagent_delegation_section\n"
            "cfg = PromptConfig('analyzer','security','x',['Bash','Write'],[],'json')\n"
            "print(repr(generate_subagent_delegation_section(cfg)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_section_emitted_when_read_tool_present(self) -> None:
        """A single trigger tool (Read) is enough to surface the section."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
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
            "from platxa_agent_generator.prompt_generator import SUBAGENT_DELEGATION_RULES\n"
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
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Bash','Write'],[],'json')\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "print('Subagent Delegation' in blocks.context)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_blocks_include_section_for_grep_agent(self) -> None:
        """generate_prompt_blocks injects the section into CONTEXT for Grep agents."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
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
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','x',['Read','Grep'],[],'json',\n"
            "                   long_running=True)\n"
            "blocks = generate_prompt_blocks(cfg)\n"
            "sub = blocks.context.find('**Subagent Delegation:**')\n"
            "ctx = blocks.context.find('**Context Management:**')\n"
            "print(sub != -1 and ctx != -1 and sub < ctx)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"
