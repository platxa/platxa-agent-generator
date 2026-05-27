#!/usr/bin/env python3
"""
test_prompt_structure — sharded from test_generator.py.

Shards: 4 TestXxx classes.
Run with: pytest tests/test_prompt_structure.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestPromptReminderPoints:
    """Tests for system-reminder injection points (Feature #55).

    Feature criteria:
    - Long-running agents include reminder points after exploration phases
    - Critical rules are re-stated at decision points
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_exploration_complete_fires_for_long_running_with_read_tools(self) -> None:
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', "
            "purpose='audit', tools=['Read','Grep','Glob'])\n"
            "triggers = sorted({p.trigger for p in r.reminder_points})\n"
            "print(json.dumps(triggers))"
        )
        triggers = json.loads(result.stdout)
        assert "exploration_complete" in triggers

    def test_before_destructive_fires_when_write_tools_present(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='builder', domain='general', purpose='x', "
            "tools=['Read','Write','Edit'])\n"
            "print('before_destructive' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_no_destructive_reminder_when_no_write_tools(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='general', purpose='x', "
            "tools=['Read','Grep'])\n"
            "print('before_destructive' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "False"

    def test_security_domain_gets_security_decision_reminder(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='validator', domain='security', "
            "purpose='audit', tools=['Read','Grep'])\n"
            "print('security_decision' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_bash_tool_gets_security_decision_even_without_security_domain(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='automation', domain='devops', "
            "purpose='deploy', tools=['Read','Bash'])\n"
            "print('security_decision' in {p.trigger for p in r.reminder_points})"
        )
        assert result.stdout.strip() == "True"

    def test_phase_boundary_fires_between_every_step_pair(self) -> None:
        """For a workflow with >= _PHASE_BOUNDARY_MIN_STEPS, boundaries fire between each step pair."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='general', purpose='x', "
            "tools=['Read'])\n"
            "boundaries = [p for p in r.reminder_points if p.trigger == 'phase_boundary']\n"
            "steps = sorted(p.after_step for p in boundaries)\n"
            "print(json.dumps({'count': len(boundaries), 'steps': steps, "
            "'workflow_len': len(r.workflow_steps)}))"
        )
        data = json.loads(result.stdout)
        assert data["count"] == data["workflow_len"] - 1
        assert data["steps"] == list(range(1, data["workflow_len"]))

    def test_reminder_section_in_full_prompt_when_points_exist(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep','Bash'])\n"
            "print('Mid-Conversation Refresh Points' in r.full_prompt)\n"
            "print('exploration_complete' in r.full_prompt)\n"
            "print('before_destructive' in r.full_prompt)"
        )
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True", "True"]

    def test_format_section_suppressed_when_no_points(self) -> None:
        """format_reminder_points_section returns empty string when no points."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import format_reminder_points_section\n"
            "print(repr(format_reminder_points_section([])))"
        )
        assert result.stdout.strip() == "''"

    def test_reminder_rules_include_constraints(self) -> None:
        """Rules at reminder points must include the agent's constraints."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep'], constraints=['custom rule A', 'custom rule B'])\n"
            "expl = next(p for p in r.reminder_points if p.trigger == 'exploration_complete')\n"
            "all_rules = ' '.join(expl.rules)\n"
            "print('custom rule A' in all_rules or 'custom rule B' in all_rules)"
        )
        assert result.stdout.strip() == "True"

    def test_before_destructive_prepends_verify_rule(self) -> None:
        """The before-destructive reminder must lead with a verify-before-mutating rule."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='builder', domain='general', purpose='x', "
            "tools=['Write','Edit'])\n"
            "pts = [p for p in r.reminder_points if p.trigger == 'before_destructive']\n"
            "print(pts[0].rules[0] if pts else 'NONE')"
        )
        first_rule = result.stdout.strip()
        assert "Verify" in first_rule or "verify" in first_rule

    def test_reminder_points_have_rationale(self) -> None:
        """Every emitted reminder point must carry a non-empty rationale."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate(agent_type='analyzer', domain='security', purpose='audit', "
            "tools=['Read','Grep','Bash'])\n"
            "print(all(p.rationale.strip() for p in r.reminder_points))"
        )
        assert result.stdout.strip() == "True"


class TestFourBlockPromptStructure:
    """Tests for the 4-block prompt structure (feature #56).

    Covers:
    - generate_prompt_blocks() returns all four blocks with expected content
    - format_blocks_markdown() emits canonical headers in canonical order
    - format_blocks_xml() emits canonical tags in canonical order
    - generate_full_prompt() with structure_format="markdown" / "xml"
    - invalid structure_format raises ValueError (no silent fallback)
    - legacy format still works (backwards compatibility)
    - quality_scorer.evaluate_prompt_structure() detects all three modes
    - quality_scorer.score_prompt_structure() neutral-scores legacy agents
      and grades structured agents on block completeness
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

    def test_generate_prompt_blocks_returns_all_four_blocks(self) -> None:
        """generate_prompt_blocks populates instructions/context/task/output_format."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_prompt_blocks\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read','Grep'],[],'JSON')\n"
            "b = generate_prompt_blocks(cfg)\n"
            "print('I' if b.instructions else 'NO_I')\n"
            "print('C' if b.context else 'NO_C')\n"
            "print('T' if b.task else 'NO_T')\n"
            "print('O' if b.output_format else 'NO_O')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["I", "C", "T", "O"]

    def test_markdown_format_emits_canonical_headers(self) -> None:
        """format_blocks_markdown emits ## INSTRUCTIONS etc in canonical order."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate('analyzer','security','audit',['Read'],[],'JSON')\n"
            "# legacy default — should not have block headers\n"
            "print('NOHEADER' if '## INSTRUCTIONS' not in r.full_prompt else 'HEADER')\n"
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i = p.find('## INSTRUCTIONS')\n"
            "c = p.find('## CONTEXT')\n"
            "t = p.find('## TASK')\n"
            "o = p.find('## OUTPUT FORMAT')\n"
            "print('ORDER_OK' if 0 <= i < c < t < o else f'ORDER_BAD {i} {c} {t} {o}')"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "NOHEADER"
        assert lines[1] == "ORDER_OK"

    def test_xml_format_emits_canonical_tags(self) -> None:
        """format_blocks_xml emits <instructions>..<output_format> in canonical order."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i = p.find('<instructions>')\n"
            "c = p.find('<context>')\n"
            "t = p.find('<task>')\n"
            "o = p.find('<output_format>')\n"
            "print('ORDER_OK' if 0 <= i < c < t < o else 'ORDER_BAD')\n"
            "# closing tags present\n"
            "has_close = all(x in p for x in ['</instructions>','</context>','</task>','</output_format>'])\n"
            "print('CLOSED' if has_close else 'UNCLOSED')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["ORDER_OK", "CLOSED"]

    def test_invalid_structure_format_raises(self) -> None:
        """Unknown structure_format raises ValueError — no silent fallback."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],'JSON','bogus')\n"
            "try:\n"
            "    generate_full_prompt(cfg)\n"
            "    print('NO_RAISE')\n"
            "except ValueError as e:\n"
            "    print('RAISED', 'bogus' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_legacy_format_unchanged(self) -> None:
        """Legacy format still produces the historical section list (no block headers)."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import generate\n"
            "r = generate('analyzer','security','audit',['Read','Grep'],[],'JSON')\n"
            "p = r.full_prompt\n"
            "# legacy uses **Capabilities:** and **Workflow:** bold markers,\n"
            "# NOT ## block headers.\n"
            "print('BOLD' if '**Capabilities:**' in p and '**Workflow:**' in p else 'NO_BOLD')\n"
            "print('NO_BLOCKS' if '## INSTRUCTIONS' not in p and '<instructions>' not in p else 'HAS_BLOCKS')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_BLOCKS"]

    def test_evaluate_prompt_structure_markdown(self) -> None:
        """evaluate_prompt_structure detects markdown-style 4-block content."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "md = '## INSTRUCTIONS\\nfoo\\n## CONTEXT\\nbar\\n## TASK\\nbaz\\n## OUTPUT FORMAT\\nqux'\n"
            "r = evaluate_prompt_structure(md)\n"
            "print(r.format, len(r.found_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown 4 True"

    def test_evaluate_prompt_structure_xml(self) -> None:
        """evaluate_prompt_structure detects XML-tagged 4-block content."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "xml = '<instructions>a</instructions>\\n<context>b</context>\\n<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(xml)\n"
            "print(r.format, len(r.found_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml 4 True"

    def test_evaluate_prompt_structure_partial(self) -> None:
        """Partial markdown structure is reported incomplete, format still 'markdown'."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "md = '## INSTRUCTIONS\\nfoo\\n## CONTEXT\\nbar'\n"
            "r = evaluate_prompt_structure(md)\n"
            "print(r.format, len(r.found_blocks), len(r.missing_blocks), r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown 2 2 False"

    def test_evaluate_prompt_structure_none(self) -> None:
        """Legacy format (no block markers) reports format='none'."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "legacy = '# Some Agent\\n\\n**Capabilities:**\\n- x\\n\\n**Workflow:**\\n1. y'\n"
            "r = evaluate_prompt_structure(legacy)\n"
            "print(r.format, len(r.found_blocks))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "none 0"

    def test_score_prompt_structure_legacy_neutral(self) -> None:
        """Legacy content scores a neutral 7.0 with no penalty."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import score_prompt_structure\n"
            "legacy = '# Agent\\n\\n## Overview\\nfoo'\n"
            "s = score_prompt_structure(legacy)\n"
            "print(round(s.score,1), s.weight, 'adopting' in ' '.join(s.suggestions).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "7.0 0.0 True"

    def test_score_prompt_structure_complete_wins(self) -> None:
        """Complete 4-block structure scores 10.0 (all four blocks)."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import score_prompt_structure\n"
            "md = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb\\n## TASK\\nc\\n## OUTPUT FORMAT\\nd'\n"
            "s = score_prompt_structure(md)\n"
            "print(round(s.score,1))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "10.0"

    def test_score_prompt_structure_partial_scales_linearly(self) -> None:
        """2 of 4 blocks scores 5.0; complete is strictly higher than partial."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import score_prompt_structure\n"
            "two = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb'\n"
            "three = '## INSTRUCTIONS\\na\\n## CONTEXT\\nb\\n## TASK\\nc'\n"
            "print(round(score_prompt_structure(two).score,1),"
            " round(score_prompt_structure(three).score,1))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "5.0 7.5"

    def test_round_trip_markdown_scores_complete(self) -> None:
        """Agent generated with structure_format='markdown' scores complete via scorer."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "cfg = PromptConfig('builder','documentation','write docs',"
            "['Read','Write'],[],'Markdown docs','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "r = evaluate_prompt_structure(p)\n"
            "print(r.format, r.complete)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "markdown True"


class TestXmlNestedTagStructure:
    """Tests for nested XML sub-tags inside the 4-block structure (feature #57).

    Covers:
    - xml mode renders constraints inside ``<constraints>...</constraints>``
      nested within ``<instructions>...</instructions>``
    - markdown / legacy modes render constraints under ``**Constraints:**``
      bold heading (no nested tag)
    - xml mode renders examples inside ``<examples><example>...</example>``
      nested within ``<context>...</context>``
    - markdown / legacy modes render examples under ``**Examples:**`` bullet
      list (no nested tag)
    - quality_scorer.evaluate_prompt_structure detects nested tags and
      populates ``nested_tags_found``
    - nested tags are properly contained within parent block boundaries
    - PromptConfig.examples defaults to empty list (backwards compat)
    - empty examples list suppresses the section in xml mode (no empty
      ``<examples>`` tag emitted)
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

    def test_xml_mode_wraps_constraints_in_nested_tag(self) -> None:
        """xml mode emits <constraints>...</constraints> instead of bold heading."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['must scan all files','no destructive ops'],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OPEN' if '<constraints>' in p else 'NO_OPEN')\n"
            "print('CLOSE' if '</constraints>' in p else 'NO_CLOSE')\n"
            "print('NO_BOLD' if '**Constraints:**' not in p else 'BOLD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["OPEN", "CLOSE", "NO_BOLD"]

    def test_markdown_mode_uses_bold_heading_for_constraints(self) -> None:
        """markdown mode keeps **Constraints:** bold heading, no XML tags."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['must scan all'],'JSON','markdown')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Constraints:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<constraints>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_xml_mode_wraps_examples_in_nested_tags(self) -> None:
        """xml mode emits <examples><example>...</example></examples>."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "cfg.examples = ['Input: foo / Output: bar', 'Input: baz / Output: qux']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OUTER_OPEN' if '<examples>' in p else 'NO_OUTER_OPEN')\n"
            "print('OUTER_CLOSE' if '</examples>' in p else 'NO_OUTER_CLOSE')\n"
            "print('INNER_OPEN' if '<example>' in p else 'NO_INNER_OPEN')\n"
            "print('INNER_CLOSE' if '</example>' in p else 'NO_INNER_CLOSE')\n"
            "print('TWO' if p.count('<example>') == 2 else 'WRONG_COUNT')\n"
            "print('NO_BOLD' if '**Examples:**' not in p else 'BOLD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "OUTER_OPEN",
            "OUTER_CLOSE",
            "INNER_OPEN",
            "INNER_CLOSE",
            "TWO",
            "NO_BOLD",
        ]

    def test_markdown_mode_uses_bullet_list_for_examples(self) -> None:
        """markdown mode emits **Examples:** bullet list, no XML tags."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.examples = ['Input: foo / Output: bar']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Examples:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<examples>' not in p and '<example>' not in p"
            " else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_empty_examples_list_suppresses_section_in_xml(self) -> None:
        """Empty examples list does not emit an empty <examples></examples>."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('NO_EXAMPLES_TAG' if '<examples>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NO_EXAMPLES_TAG"

    def test_nested_constraints_tag_inside_instructions_block(self) -> None:
        """<constraints> opening tag falls between <instructions> open and close."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['no destructive ops'],'JSON','xml')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "i_open = p.find('<instructions>')\n"
            "i_close = p.find('</instructions>')\n"
            "c_open = p.find('<constraints>')\n"
            "c_close = p.find('</constraints>')\n"
            "ok = 0 <= i_open < c_open < c_close < i_close\n"
            "print('NESTED_OK' if ok else f'BAD {i_open} {c_open} {c_close} {i_close}')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NESTED_OK"

    def test_nested_examples_tag_inside_context_block(self) -> None:
        """<examples> opening tag falls between <context> open and close."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','xml')\n"
            "cfg.examples = ['demo']\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "c_open = p.find('<context>')\n"
            "c_close = p.find('</context>')\n"
            "e_open = p.find('<examples>')\n"
            "e_close = p.find('</examples>')\n"
            "ok = 0 <= c_open < e_open < e_close < c_close\n"
            "print('NESTED_OK' if ok else f'BAD {c_open} {e_open} {e_close} {c_close}')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "NESTED_OK"

    def test_legacy_mode_uses_bold_heading_for_constraints(self) -> None:
        """legacy structure_format keeps the historic **Constraints:** heading."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig, generate_full_prompt\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],"
            "['hard rule'],'JSON','legacy')\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('BOLD' if '**Constraints:**' in p else 'NO_BOLD')\n"
            "print('NO_TAG' if '<constraints>' not in p else 'TAG')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["BOLD", "NO_TAG"]

    def test_evaluate_prompt_structure_detects_nested_constraints(self) -> None:
        """evaluate_prompt_structure populates nested_tags_found with 'constraints'."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>foo\\n<constraints>- a</constraints>"
            "\\n</instructions>\\n<context>b</context>\\n<task>c</task>"
            "\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.format, 'constraints' in r.nested_tags_found,"
            " 'examples' in r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml True False"

    def test_evaluate_prompt_structure_detects_nested_examples(self) -> None:
        """evaluate_prompt_structure populates nested_tags_found with 'examples'."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>a</instructions>\\n<context>b\\n"
            "<examples><example>e1</example></examples></context>\\n"
            "<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.format, 'constraints' in r.nested_tags_found,"
            " 'examples' in r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "xml False True"

    def test_evaluate_prompt_structure_no_nested_tags_when_absent(self) -> None:
        """nested_tags_found is empty list when neither sub-tag is present."""
        result = self._run_py(
            "from platxa_agent_generator.quality_scorer import evaluate_prompt_structure\n"
            "x = '<instructions>a</instructions>\\n<context>b</context>"
            "\\n<task>c</task>\\n<output_format>d</output_format>'\n"
            "r = evaluate_prompt_structure(x)\n"
            "print(r.nested_tags_found)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_promptconfig_examples_defaults_to_empty_list(self) -> None:
        """Backwards compat: PromptConfig.examples defaults to empty list."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig\n"
            "cfg = PromptConfig('a','cat','desc',['Read'],[],'JSON')\n"
            "print(cfg.examples == [], type(cfg.examples).__name__)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True list"


class TestCompetingHypothesisTemplate:
    """Tests for the competing-hypothesis multi-agent template (Feature #41).

    Exercises template registration, adversarial_config semantics, the
    configurable `create_competing_hypothesis_system` factory (3-5
    investigators with distinct hypothesis focuses and input validation),
    and the generated orchestrator markdown (adversarial workflow steps).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- template registration ---------------------------------------------

    def test_template_is_registered(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print('competing-hypothesis' in SYSTEM_TEMPLATES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_template_declares_competing_hypothesis_pattern(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print(SYSTEM_TEMPLATES['competing-hypothesis']['pattern'])"
        )
        assert result.stdout.strip() == "competing-hypothesis"

    def test_adversarial_config_documents_rounds_and_convergence(self) -> None:
        """adversarial_config must declare investigator bounds, three rounds,
        and convergence criteria — downstream tooling inspects this field."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print(json.dumps(SYSTEM_TEMPLATES['competing-hypothesis']['adversarial_config']))"
        )
        assert result.returncode == 0, result.stderr
        cfg = json.loads(result.stdout)
        assert cfg["min_investigators"] == 3
        assert cfg["max_investigators"] == 5
        assert cfg["default_investigators"] == 3
        rounds = cfg["rounds"]
        assert set(rounds.keys()) == {"investigation", "challenge", "refinement"}
        assert rounds["challenge"]["min_challenges_per_investigator"] >= 1
        assert "criteria" in cfg["convergence"]
        assert "reject_unanimous_agreement" in cfg["convergence"]

    def test_template_default_has_three_investigators_with_distinct_focus(self) -> None:
        """create_system_from_template must yield 3 investigators with
        distinct hypothesis_focus values."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps([(w.name, w.hypothesis_focus) for w in invs]))"
        )
        assert result.returncode == 0, result.stderr
        pairs = json.loads(result.stdout)
        assert len(pairs) == 3
        focuses = [focus for _, focus in pairs]
        assert len(set(focuses)) == 3, f"focuses not distinct: {focuses}"
        assert all(f for f in focuses), "every investigator must have a non-empty focus"

    def test_investigators_are_worktree_isolated(self) -> None:
        """Parallel investigators must run in isolated worktrees so their
        evidence-gathering doesn't collide with each other."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps([w.isolation for w in invs]))"
        )
        assert result.returncode == 0, result.stderr
        isolations = json.loads(result.stdout)
        assert all(i == "worktree" for i in isolations), (
            f"all investigators must have worktree isolation; got {isolations}"
        )

    # --- factory: configurable investigator count --------------------------

    def test_factory_produces_configurable_count(self) -> None:
        """Factory must support 3, 4, and 5 investigators, each with a
        distinct hypothesis focus drawn from DEFAULT_COMPETING_HYPOTHESES."""
        for n in (3, 4, 5):
            result = self._run_py(
                "import json; "
                "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system; "
                f"sys_ = create_competing_hypothesis_system(investigator_count={n}); "
                "invs = [w for w in sys_.workers if w.role == 'investigator']; "
                "print(json.dumps([w.hypothesis_focus for w in invs]))"
            )
            assert result.returncode == 0, f"n={n}: {result.stderr}"
            focuses = json.loads(result.stdout)
            assert len(focuses) == n, f"n={n}: got {len(focuses)} investigators"
            assert len(set(focuses)) == n, f"n={n}: focuses not distinct: {focuses}"

    def test_factory_rejects_count_below_three(self) -> None:
        """count < 3 has no adversarial pressure — must raise ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=2)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, result.stdout
        assert "3" in result.stdout or "5" in result.stdout

    def test_factory_rejects_count_above_five(self) -> None:
        """count > 5 exceeds coordination budget — must raise ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=6)\n"
            "    print('no-error')\n"
            "except ValueError:\n"
            "    print('value-error')"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout

    def test_factory_rejects_duplicate_focuses(self) -> None:
        """Hypothesis focuses must be distinct — duplicates defeat the pattern."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "dup = [{'focus': 'x', 'description': 'd', "
            "        'responsibilities': ['r'], 'inputs': ['i']}] * 3\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=dup)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "distinct" in result.stdout.lower() or "duplicate" in result.stdout.lower()

    def test_factory_rejects_malformed_hypothesis_dict(self) -> None:
        """Hypothesis dicts missing required keys must raise ValueError with
        actionable message — not the opaque KeyError the caller would otherwise
        see surfacing from inside agent construction."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "bad = [\n"
            "  {'focus': 'a', 'description': 'd', 'responsibilities': ['r']},\n"
            "  {'focus': 'b', 'responsibilities': ['r']},\n"
            "  {'focus': 'c', 'description': 'd', 'responsibilities': ['r']},\n"
            "]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=bad)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))\n"
            "except KeyError as e:\n"
            "    print('key-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, (
            f"factory must raise ValueError (not KeyError) for malformed hypothesis "
            f"so the caller knows which key is missing; got: {result.stdout}"
        )
        assert "description" in result.stdout, (
            "error message must name the missing key so the caller can fix it"
        )
        assert "hypotheses[1]" in result.stdout, (
            "error message must name the offending hypothesis index"
        )

    def test_factory_rejects_non_dict_hypothesis(self) -> None:
        """Non-dict entries in hypotheses must raise ValueError with type info."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "bad = [\n"
            "  {'focus': 'a', 'description': 'd', 'responsibilities': ['r']},\n"
            "  'not-a-dict',\n"
            "  {'focus': 'c', 'description': 'd', 'responsibilities': ['r']},\n"
            "]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=3, hypotheses=bad)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "str" in result.stdout, "must report the actual offending type"

    def test_orchestrator_markdown_rejects_no_investigators(self) -> None:
        """Generating the orchestrator markdown for a competing-hypothesis
        system with zero investigators must fail loud — silently emitting
        'Dispatch all 0 investigators' would ship a broken orchestrator."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import (\n"
            "    AgentDefinition, MultiAgentSystem,\n"
            ")\n"
            "orch = AgentDefinition(name='c', description='d',\n"
            "                       role='orchestrator', tools=['Task'],\n"
            "                       responsibilities=['r'])\n"
            "broken = MultiAgentSystem(name='broken', description='d',\n"
            "                          pattern='competing-hypothesis',\n"
            "                          orchestrator=orch, workers=[])\n"
            "try:\n"
            "    broken.generate_competing_hypothesis_orchestrator_markdown()\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout, (
            f"empty-investigators must fail loud; got: {result.stdout}"
        )
        assert "investigator" in result.stdout, (
            "error must explain what is missing so the caller can fix it"
        )

    def test_cli_generate_pattern_choices_include_competing_hypothesis(self) -> None:
        """`generate --pattern` choices must include competing-hypothesis so
        users discovering patterns via --help see it (consistency with
        writer-reviewer being added to all CLI surfaces)."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "generate", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        assert "competing-hypothesis" in result.stdout, (
            f"--pattern choices missing competing-hypothesis: {result.stdout}"
        )

    def test_cli_example_pattern_choices_include_competing_hypothesis(self) -> None:
        """`example` subcommand pattern choices must include competing-hypothesis."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "example", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        assert "competing-hypothesis" in result.stdout, (
            f"example pattern choices missing competing-hypothesis: {result.stdout}"
        )

    def test_factory_rejects_too_few_hypotheses(self) -> None:
        """Supplying fewer hypotheses than investigators must raise ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system\n"
            "short = [{'focus': 'a', 'description': 'd', 'responsibilities': ['r'], "
            "          'inputs': ['i']}]\n"
            "try:\n"
            "    create_competing_hypothesis_system(investigator_count=4, hypotheses=short)\n"
            "    print('no-error')\n"
            "except ValueError:\n"
            "    print('value-error')"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout

    def test_factory_accepts_custom_hypotheses(self) -> None:
        """Caller-supplied hypotheses must propagate to investigator metadata."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system; "
            "custom = ["
            "  {'focus': 'cache-corruption', 'description': 'cache-focused', "
            "   'responsibilities': ['check caches'], 'inputs': ['bug']},"
            "  {'focus': 'memory-leak', 'description': 'memory-focused', "
            "   'responsibilities': ['profile memory'], 'inputs': ['bug']},"
            "  {'focus': 'serialization', 'description': 'ser-focused', "
            "   'responsibilities': ['diff payloads'], 'inputs': ['bug']}"
            "]; "
            "sys_ = create_competing_hypothesis_system("
            "  investigator_count=3, hypotheses=custom); "
            "invs = [w for w in sys_.workers if w.role == 'investigator']; "
            "print(json.dumps(sorted([w.hypothesis_focus for w in invs])))"
        )
        assert result.returncode == 0, result.stderr
        focuses = json.loads(result.stdout)
        assert focuses == ["cache-corruption", "memory-leak", "serialization"]

    # --- orchestrator markdown ---------------------------------------------

    def test_orchestrator_markdown_documents_three_adversarial_rounds(self, tmp_path: Path) -> None:
        """save_system must render the competing-hypothesis markdown with
        all three rounds + convergence + degenerate-case handling."""
        out_dir = tmp_path / "ch"
        result = self._run_py(
            "from pathlib import Path; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch_files = list(Path(out_dir).glob("*coordinator*.md"))
        assert orch_files, f"no coordinator markdown in {out_dir}"
        content = orch_files[0].read_text()
        assert "Round 1: Independent Investigation" in content
        assert "Round 2: Peer Challenge" in content
        assert "Round 3: Refinement" in content
        assert "Selection" in content
        assert "Competing-Hypothesis" in content or "competing-hypothesis" in content
        # Must spell out the adversarial invariant (no unchallenged hypothesis)
        assert "cite" in content.lower() and "peer" in content.lower()
        # Must cover the degenerate case
        assert "Unanimous" in content or "unanimous" in content

    def test_orchestrator_markdown_lists_distinct_hypothesis_focuses(self, tmp_path: Path) -> None:
        """The investigator table must surface each distinct focus so
        the orchestrator can assign them without ambiguity."""
        out_dir = tmp_path / "ch2"
        result = self._run_py(
            "from pathlib import Path; "
            "from platxa_agent_generator.multiagent_generator import create_competing_hypothesis_system, save_system; "
            "sys_ = create_competing_hypothesis_system(investigator_count=5); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch_files = list(Path(out_dir).glob("*coordinator*.md"))
        content = orch_files[0].read_text()
        # The default 5 focuses should all appear in the investigator table
        for focus in (
            "recent-change",
            "concurrency-timing",
            "environment-dependency",
            "data-state",
            "integration-contract",
        ):
            assert focus in content, f"focus {focus!r} missing from orchestrator markdown"

    def test_manifest_preserves_hypothesis_focus(self, tmp_path: Path) -> None:
        """save_system's JSON manifest must preserve hypothesis_focus so
        downstream tools can inspect it without re-running the factory."""
        out_dir = tmp_path / "ch3"
        result = self._run_py(
            "from pathlib import Path; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('competing-hypothesis'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        manifest_files = list(Path(out_dir).glob("*-manifest.json"))
        assert manifest_files, "no manifest JSON written"
        manifest = json.loads(manifest_files[0].read_text())
        workers = [w for w in manifest["workers"] if w["role"] == "investigator"]
        assert workers, "no investigators in manifest"
        focuses = [w.get("hypothesis_focus") for w in workers]
        assert all(f for f in focuses), f"manifest dropped hypothesis_focus: {focuses}"
        assert len(set(focuses)) == len(focuses), "manifest focuses not distinct"


class TestContextManagementSection:
    """Tests for context-management guidance in long-running agent prompts (#89)."""

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR),
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
        """First rule must address context-pressure detection."""
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
    """Tests for subagent-delegation guidance in agent prompts (#90)."""

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR),
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
        assert lines[1] == "5"
        assert lines[2] == "1000 2000"
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
