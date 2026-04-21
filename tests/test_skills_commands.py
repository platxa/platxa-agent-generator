#!/usr/bin/env python3
"""
test_skills_commands — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_skills_commands.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestSkillsFrontmatter:
    """Tests for the skills frontmatter field + discovery (feature #69).

    Covers:
    - AgentDefinition.skills emits a `skills:` line in frontmatter
    - Empty skills list → no `skills:` line emitted
    - discover_available_skills scans SKILL.md frontmatter for {name: description}
    - Subdirectory without SKILL.md is skipped silently
    - SKILL.md with malformed frontmatter is skipped (one bad skill ≠ blind catalog)
    - Non-existent skills_dir → empty dict (no error)
    - recommend_skills_for_agent ranks by token overlap, ties broken by name
    - Stop-words ('the', 'and', ...) don't pollute matches
    - limit <= 0 raises ValueError
    - Empty description or empty catalog → empty list
    - validate_skills_exist returns empty list when all skills present
    - validate_skills_exist returns one error per missing skill, naming it
    - DEFAULT_SKILLS_DIR / SKILL_MANIFEST_FILENAME / DEFAULT_SKILL_RECOMMENDATION_LIMIT exposed
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
        """Module-level constants for skill discovery are public."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    DEFAULT_SKILLS_DIR,\n"
            "    SKILL_MANIFEST_FILENAME,\n"
            "    DEFAULT_SKILL_RECOMMENDATION_LIMIT,\n"
            ")\n"
            "print(DEFAULT_SKILLS_DIR, SKILL_MANIFEST_FILENAME,"
            " DEFAULT_SKILL_RECOMMENDATION_LIMIT)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/skills SKILL.md 5"

    def test_frontmatter_emits_skills_when_set(self) -> None:
        """`skills:` line appears in frontmatter when AgentDefinition.skills is non-empty."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='a', description='Agent',"
            " tools=['Read'], skills=['skill-one', 'skill-two'])\n"
            "fm = generate_frontmatter(d)\n"
            "print('skills: skill-one, skill-two' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_frontmatter_omits_skills_when_empty(self) -> None:
        """No `skills:` line when AgentDefinition.skills is the default empty list."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='a', description='Agent', tools=['Read'])\n"
            "fm = generate_frontmatter(d)\n"
            "print('skills:' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_discover_skills_parses_frontmatter(self) -> None:
        """discover_available_skills returns {name: description} for each SKILL.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    one = base / 'skill-one'\n"
            "    one.mkdir()\n"
            "    (one / 'SKILL.md').write_text(\n"
            "        '---\\nname: skill-one\\ndescription: First skill\\n---\\nbody'\n"
            "    )\n"
            "    two = base / 'skill-two'\n"
            "    two.mkdir()\n"
            "    (two / 'SKILL.md').write_text(\n"
            "        '---\\nname: skill-two\\ndescription: Second skill\\n---\\nbody'\n"
            "    )\n"
            "    found = discover_available_skills(base)\n"
            "    print(sorted(found.items()))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "[('skill-one', 'First skill'), ('skill-two', 'Second skill')]"
        )

    def test_discover_skips_dir_without_manifest(self) -> None:
        """Subdirectory without SKILL.md is silently skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    (base / 'no-manifest').mkdir()\n"
            "    found = discover_available_skills(base)\n"
            "    print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{}"

    def test_discover_skips_malformed_manifest(self) -> None:
        """One broken SKILL.md does not blind the discoverer to the rest."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import discover_available_skills\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    bad = base / 'bad'\n"
            "    bad.mkdir()\n"
            "    (bad / 'SKILL.md').write_text('not-yaml-frontmatter\\n')\n"
            "    good = base / 'good'\n"
            "    good.mkdir()\n"
            "    (good / 'SKILL.md').write_text(\n"
            "        '---\\nname: good\\ndescription: Good skill\\n---\\nbody'\n"
            "    )\n"
            "    found = discover_available_skills(base)\n"
            "    print(sorted(found.keys()))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['good']"

    def test_discover_missing_dir_returns_empty(self) -> None:
        """Non-existent skills_dir → empty dict (no error)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import discover_available_skills\n"
            "found = discover_available_skills('/tmp/__definitely_no_such_dir__')\n"
            "print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{}"

    def test_recommend_ranks_by_overlap(self) -> None:
        """Higher token overlap with description → higher rank."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import recommend_skills_for_agent\n"
            "available = {\n"
            "    'security-audit': 'Security audit and vulnerability scanning',\n"
            "    'pdf-tool': 'Generate PDF reports',\n"
            "    'security-checklist': 'OWASP security checklist for review',\n"
            "}\n"
            "ranked = recommend_skills_for_agent('Run a security audit on the auth code', available)\n"
            "print(ranked)"
        )
        assert result.returncode == 0, result.stderr
        # security-audit has 2 token overlap (security, audit); security-checklist has 1
        # (security); pdf-tool has 0.
        assert result.stdout.strip() == "['security-audit', 'security-checklist']"

    def test_recommend_drops_stop_words(self) -> None:
        """Stop-words alone in description should not match anything."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import recommend_skills_for_agent\n"
            "available = {'foo': 'foo bar baz'}\n"
            "ranked = recommend_skills_for_agent('the and for with', available)\n"
            "print(ranked)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_recommend_zero_limit_raises(self) -> None:
        """limit <= 0 raises ValueError (callers asking for 'no skills' should not call)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import recommend_skills_for_agent\n"
            "try:\n"
            "    recommend_skills_for_agent('x', {'a': 'a'}, limit=0)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'positive' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_recommend_empty_inputs_return_empty(self) -> None:
        """Empty description or empty catalog → empty list, no error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import recommend_skills_for_agent\n"
            "print(recommend_skills_for_agent('', {'a': 'b'}))\n"
            "print(recommend_skills_for_agent('abc', {}))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["[]", "[]"]

    def test_recommend_respects_limit(self) -> None:
        """When more skills overlap than limit allows, the top N are returned."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import recommend_skills_for_agent\n"
            "available = {f'skill-{i}': 'security audit review' for i in range(10)}\n"
            "ranked = recommend_skills_for_agent('security audit review', available, limit=3)\n"
            "print(len(ranked))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3"

    def test_validate_skills_exist_all_present(self) -> None:
        """Empty error list when every skill resolves on disk."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import validate_skills_exist\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    s = base / 'present-skill'\n"
            "    s.mkdir()\n"
            "    (s / 'SKILL.md').write_text(\n"
            "        '---\\nname: present-skill\\ndescription: Here\\n---\\nbody'\n"
            "    )\n"
            "    errors = validate_skills_exist(['present-skill'], base)\n"
            "    print(errors)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_validate_skills_exist_reports_missing(self) -> None:
        """One error per missing skill, naming the missing skill."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import validate_skills_exist\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    base = Path(td)\n"
            "    s = base / 'present-skill'\n"
            "    s.mkdir()\n"
            "    (s / 'SKILL.md').write_text(\n"
            "        '---\\nname: present-skill\\ndescription: Here\\n---\\nbody'\n"
            "    )\n"
            "    errors = validate_skills_exist(\n"
            "        ['present-skill', 'ghost-skill', 'phantom'], base\n"
            "    )\n"
            "    print(len(errors),"
            " 'ghost-skill' in errors[0],"
            " 'phantom' in errors[1])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 True True"

    def test_validate_empty_skills_returns_empty(self) -> None:
        """No skills to check → no errors, no disk access."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import validate_skills_exist\n"
            "print(validate_skills_exist([], '/tmp/__no_such_dir__'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"


class TestCompanionSkillGeneration:
    """Tests for companion skill generation (feature #70).

    Covers:
    - should_generate_companion_skill: True for multi-section / orchestrator
      / chained agents; False for trivial single-purpose agents
    - generate_companion_skill_content emits valid SKILL.md frontmatter
      (name, description, allowed-tools)
    - write_companion_skill creates .claude/skills/<agent-name>/SKILL.md
    - write_companion_skill appends agent.name to definition.skills (idempotent)
    - write_companion_skill returns None for simple agents (no file written)
    - force=True overrides the should-generate predicate
    - COMPANION_SKILL_MIN_SECTIONS / COMPANION_SKILL_FILENAME exposed
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
        """COMPANION_SKILL_MIN_SECTIONS and COMPANION_SKILL_FILENAME are public."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import"
            " COMPANION_SKILL_MIN_SECTIONS, COMPANION_SKILL_FILENAME\n"
            "print(COMPANION_SKILL_MIN_SECTIONS, COMPANION_SKILL_FILENAME)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3 SKILL.md"

    def test_should_generate_for_multi_section_agent(self) -> None:
        """≥3 sections triggers companion skill generation."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, AgentSection, should_generate_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title='A', content='x'),\n"
            "        AgentSection(title='B', content='y'),\n"
            "        AgentSection(title='C', content='z')]\n"
            "d = AgentDefinition(name='a', description='Agent',"
            " tools=['Read'], sections=secs)\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_should_not_generate_for_simple_agent(self) -> None:
        """Trivial agent (0-2 sections, no workers/chain) → no companion skill."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import"
            " AgentDefinition, should_generate_companion_skill\n"
            "d = AgentDefinition(name='a', description='Agent', tools=['Read'])\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_should_generate_for_orchestrator(self) -> None:
        """Agent with workers (orchestrator pattern) triggers generation."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, WorkerDefinition, should_generate_companion_skill\n"
            ")\n"
            "w = WorkerDefinition(name='worker-a', role='does work',"
            " tools=['Read'])\n"
            "d = AgentDefinition(name='orch', description='Orchestrator',"
            " tools=['Task'], workers=[w])\n"
            "print(should_generate_companion_skill(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_skill_content_includes_frontmatter(self) -> None:
        """SKILL.md content has name + description + allowed-tools frontmatter."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import"
            " AgentDefinition, generate_companion_skill_content\n"
            "d = AgentDefinition(name='my-agent', description='Does X',"
            " tools=['Read', 'Write'])\n"
            "c = generate_companion_skill_content(d)\n"
            "print('name: my-agent' in c,"
            " 'description: Does X' in c,"
            " 'allowed-tools:' in c,"
            " '- Read' in c,"
            " '- Write' in c)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True"

    def test_write_creates_file_in_skills_dir(self) -> None:
        """write_companion_skill creates <skills_dir>/<name>/SKILL.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='alpha', description='A',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = write_companion_skill(d, td)\n"
            "    expected = Path(td) / 'alpha' / 'SKILL.md'\n"
            "    print(path == expected, path.exists(),"
            " 'name: alpha' in path.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_write_appends_skill_to_definition(self) -> None:
        """After write_companion_skill, definition.skills contains the agent name."""
        result = self._run_py(
            "import tempfile\n"
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='beta', description='B',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    print(d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['beta']"

    def test_write_is_idempotent_on_skills_list(self) -> None:
        """Calling write twice does not duplicate the skill name in the list."""
        result = self._run_py(
            "import tempfile\n"
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, AgentSection, write_companion_skill\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='gamma', description='G',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    write_companion_skill(d, td)\n"
            "    print(d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['gamma']"

    def test_write_returns_none_for_simple_agent(self) -> None:
        """Simple agent → None returned, no file written, skills untouched."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition, write_companion_skill\n"
            "d = AgentDefinition(name='simple', description='S', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = write_companion_skill(d, td)\n"
            "    file_exists = (Path(td) / 'simple' / 'SKILL.md').exists()\n"
            "    print(result is None, file_exists, d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False []"

    def test_force_overrides_predicate(self) -> None:
        """force=True writes even when should_generate would say False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition, write_companion_skill\n"
            "d = AgentDefinition(name='forced', description='F', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = write_companion_skill(d, td, force=True)\n"
            "    print(path is not None, path.exists(), d.skills)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True ['forced']"

    def test_round_trip_with_discover_available_skills(self) -> None:
        """A written companion skill is found by discover_available_skills."""
        result = self._run_py(
            "import tempfile\n"
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, AgentSection,\n"
            "    write_companion_skill, discover_available_skills,\n"
            ")\n"
            "secs = [AgentSection(title=f's{i}', content='x') for i in range(3)]\n"
            "d = AgentDefinition(name='roundtrip', description='RT',"
            " tools=['Read'], sections=secs)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    write_companion_skill(d, td)\n"
            "    found = discover_available_skills(td)\n"
            "    print(found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "{'roundtrip': 'RT'}"


class TestCompanionCommandGeneration:
    """Tests for companion command generation (feature #71).

    Covers:
    - AgentDefinition.user_invocable (default False)
    - should_generate_companion_command returns True only when user_invocable=True
    - command_definition_from_agent wires agent name, description, tools
    - write_companion_command writes .claude/commands/<name>.md when opted in
    - write_companion_command returns None when not opted in
    - force=True overrides the predicate
    - validate_command_file catches: missing file, missing frontmatter,
      missing description, missing $ARGUMENTS, missing agent invocation
    - REQUIRED_ARGUMENTS_TOKEN / DEFAULT_COMMANDS_DIR constants exposed
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
        """DEFAULT_COMMANDS_DIR and REQUIRED_ARGUMENTS_TOKEN are public."""
        result = self._run_py(
            "from platxa_agent_generator.command_generator import"
            " DEFAULT_COMMANDS_DIR, REQUIRED_ARGUMENTS_TOKEN\n"
            "print(DEFAULT_COMMANDS_DIR, REQUIRED_ARGUMENTS_TOKEN)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/commands $ARGUMENTS"

    def test_user_invocable_default_false(self) -> None:
        """AgentDefinition.user_invocable defaults to False."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "d = AgentDefinition(name='a', description='A', tools=['Read'])\n"
            "print(d.user_invocable)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_should_generate_requires_opt_in(self) -> None:
        """should_generate_companion_command returns True only for user_invocable=True."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import should_generate_companion_command\n"
            "d_off = AgentDefinition(name='a', description='A', tools=['Read'])\n"
            "d_on = AgentDefinition(name='b', description='B',"
            " tools=['Read'], user_invocable=True)\n"
            "print(should_generate_companion_command(d_off),"
            " should_generate_companion_command(d_on))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_command_definition_from_agent_wires_fields(self) -> None:
        """command_definition_from_agent copies name, description, tools."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import command_definition_from_agent\n"
            "d = AgentDefinition(name='my-agent', description='Does X',"
            " tools=['Read', 'Write'])\n"
            "cd = command_definition_from_agent(d)\n"
            "print(cd.name, cd.agent_name, cd.description,"
            " cd.allowed_tools, cd.argument_hint)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ("my-agent my-agent Does X ['Read', 'Write'] [args]")

    def test_command_definition_falls_back_to_default_tools(self) -> None:
        """Empty agent tools → command uses DEFAULT_AGENT_TOOLS."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import (\n"
            "    command_definition_from_agent, DEFAULT_AGENT_TOOLS\n"
            ")\n"
            "d = AgentDefinition(name='a', description='A', tools=[])\n"
            "cd = command_definition_from_agent(d)\n"
            "print(cd.allowed_tools == DEFAULT_AGENT_TOOLS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_write_creates_file_for_opted_in_agent(self) -> None:
        """user_invocable=True → write_companion_command writes file."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import write_companion_command\n"
            "d = AgentDefinition(name='alpha', description='A',"
            " tools=['Read'], user_invocable=True)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td)\n"
            "    expected = Path(td) / 'alpha.md'\n"
            "    print(p == expected, p.exists(),"
            " '$ARGUMENTS' in p.read_text(),"
            " 'alpha' in p.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_write_returns_none_without_opt_in(self) -> None:
        """user_invocable=False → None, no file, no directory created."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import write_companion_command\n"
            "d = AgentDefinition(name='beta', description='B', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = write_companion_command(d, td)\n"
            "    file_exists = (Path(td) / 'beta.md').exists()\n"
            "    print(result is None, file_exists)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False"

    def test_write_force_overrides_predicate(self) -> None:
        """force=True writes even when user_invocable=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import write_companion_command\n"
            "d = AgentDefinition(name='forced', description='F', tools=['Read'])\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td, force=True)\n"
            "    print(p is not None, p.exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_validate_passes_for_generator_output(self) -> None:
        """Files produced by write_companion_command pass validate_command_file."""
        result = self._run_py(
            "import tempfile\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition\n"
            "from platxa_agent_generator.command_generator import write_companion_command, validate_command_file\n"
            "d = AgentDefinition(name='valid', description='V',"
            " tools=['Read'], user_invocable=True)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = write_companion_command(d, td)\n"
            "    errors = validate_command_file(p)\n"
            "    print(errors)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_validate_missing_file(self) -> None:
        """Missing file → single 'does not exist' error."""
        result = self._run_py(
            "from platxa_agent_generator.command_generator import validate_command_file\n"
            "errors = validate_command_file('/tmp/__no_such_cmd_file__.md')\n"
            "print(len(errors), 'does not exist' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_missing_frontmatter(self) -> None:
        """File without `---` frontmatter fails validation."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('no frontmatter here\\nbody with $ARGUMENTS and Task tool')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('frontmatter' in e for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_validate_missing_arguments_token(self) -> None:
        """Missing $ARGUMENTS → explicit error mentioning the token."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('---\\ndescription: x\\n---\\n"
            "body with subagent_type but no arg token')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('$ARGUMENTS' in e for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_validate_missing_agent_invocation(self) -> None:
        """No subagent_type or Task tool reference → validation error."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.command_generator import validate_command_file\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.md'\n"
            "    p.write_text('---\\ndescription: x\\n---\\n"
            "body with $ARGUMENTS but nothing that launches an agent')\n"
            "    errors = validate_command_file(p)\n"
            "    print(any('agent' in e.lower() for e in errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"
