#!/usr/bin/env python3
"""
test_domain_docs — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_domain_docs.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestDomainKnowledgeImports:
    """Tests for CLAUDE.md @import support in prompt_generator.py (feature #73).

    Covers:
    - estimate_tokens uses ~4 chars/token heuristic; empty → 0; tiny → 1
    - total_domain_knowledge_tokens sums across entries
    - should_use_domain_knowledge_imports: empty → False; under threshold
      → False; equal to threshold → False (strict greater-than); over → True
    - format_domain_knowledge_block: empty input → empty string
    - Inline mode: emits content under section heading with optional title
    - Import mode: emits @path references when content exceeds threshold
    - Per-entry title surfaced in both modes
    - Generated agent: small corpus → content inlined in CONTEXT
    - Generated agent: large corpus → @import paths in CONTEXT, content NOT
      inlined (verifies the actual size-driven switch)
    - PromptConfig.domain_knowledge defaults to empty list (backwards compat)
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

    def test_estimate_tokens_basic_cases(self) -> None:
        """Empty → 0, tiny → 1, ~4 chars per token approximation."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import estimate_tokens\n"
            "print(estimate_tokens(''))\n"
            "print(estimate_tokens('x'))\n"
            "# 400 chars → ~100 tokens (4 chars/token heuristic)\n"
            "print(estimate_tokens('a' * 400))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["0", "1", "100"]

    def test_total_tokens_sums_across_entries(self) -> None:
        """total_domain_knowledge_tokens aggregates the per-entry estimate."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import DomainKnowledge, total_domain_knowledge_tokens\n"
            "items = [DomainKnowledge(import_path='a', content='a' * 400),\n"
            "         DomainKnowledge(import_path='b', content='b' * 800)]\n"
            "print(total_domain_knowledge_tokens(items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "300"

    def test_should_use_imports_threshold_behavior(self) -> None:
        """Empty/under/at/over the threshold all map to expected booleans."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import DomainKnowledge, should_use_domain_knowledge_imports\n"
            "empty = []\n"
            "# 100 chars → 25 tokens, well under threshold of 50\n"
            "small = [DomainKnowledge(import_path='a', content='a' * 100)]\n"
            "# Exactly 50 tokens (200 chars / 4) → at threshold\n"
            "at = [DomainKnowledge(import_path='b', content='b' * 200)]\n"
            "# 60 tokens (240 chars / 4) → over threshold\n"
            "over = [DomainKnowledge(import_path='c', content='c' * 240)]\n"
            "print(should_use_domain_knowledge_imports(empty, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(small, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(at, threshold_tokens=50),"
            " should_use_domain_knowledge_imports(over, threshold_tokens=50))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False False False True"

    def test_format_block_empty_returns_empty_string(self) -> None:
        """Empty list → empty string so the caller can suppress the section."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import format_domain_knowledge_block\n"
            "print(repr(format_domain_knowledge_block([])))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "''"

    def test_format_block_inline_mode_below_threshold(self) -> None:
        """Small corpus inlines content under the section heading."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
            "    DOMAIN_KNOWLEDGE_HEADING, DomainKnowledge, format_domain_knowledge_block\n"
            ")\n"
            "items = [DomainKnowledge(import_path='ctx.md', "
            "content='Important fact', title='Background')]\n"
            "out = format_domain_knowledge_block(items, threshold_tokens=2000)\n"
            "print(DOMAIN_KNOWLEDGE_HEADING in out)\n"
            "print('### Background' in out)\n"
            "print('Important fact' in out)\n"
            "print('@ctx.md' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True", "True"]

    def test_format_block_import_mode_above_threshold(self) -> None:
        """Large corpus emits @import refs and OMITS the inline content."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
            "    DOMAIN_KNOWLEDGE_HEADING, DomainKnowledge, format_domain_knowledge_block\n"
            ")\n"
            "# 12000 chars → ~3000 tokens, well over default 2000 threshold\n"
            "big = 'X' * 12000\n"
            "items = [DomainKnowledge(import_path='.claude/big.md', "
            "content=big, title='Big Reference')]\n"
            "out = format_domain_knowledge_block(items)\n"
            "print(DOMAIN_KNOWLEDGE_HEADING in out)\n"
            "print('@.claude/big.md' in out)\n"
            "print('Big Reference' in out)\n"
            "# Content must NOT be inlined when @import is used\n"
            "print('XXXXXX' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True", "True"]

    def test_format_block_handles_missing_title(self) -> None:
        """Entries without a title still render in both modes."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import DomainKnowledge, format_domain_knowledge_block\n"
            "# Inline path: no title means no '### ' heading\n"
            "small = [DomainKnowledge(import_path='a.md', content='body', title='')]\n"
            "inline = format_domain_knowledge_block(small, threshold_tokens=2000)\n"
            "print('### ' not in inline, 'body' in inline)\n"
            "# Import path: no title means '- @path' not '- title: @path'\n"
            "big = [DomainKnowledge(import_path='b.md', content='X' * 12000, title='')]\n"
            "imports = format_domain_knowledge_block(big)\n"
            "print('- @b.md' in imports, ': @' not in imports)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True True", "True True"]

    def test_generate_full_prompt_inlines_small_domain_knowledge(self) -> None:
        """Small corpus appears verbatim inside the generated agent prompt."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
            "    DomainKnowledge, PromptConfig, generate_full_prompt\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.domain_knowledge = [DomainKnowledge(\n"
            "    import_path='.claude/notes.md',\n"
            "    content='OWASP Top 10 — focus on injection.',\n"
            "    title='Reference Notes',\n"
            ")]\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('OWASP Top 10' in p)\n"
            "print('@.claude/notes.md' not in p)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_generate_full_prompt_uses_imports_for_large_domain_knowledge(self) -> None:
        """Above threshold: prompt cites @paths and omits the source content."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import (\n"
            "    DomainKnowledge, PromptConfig, generate_full_prompt\n"
            ")\n"
            "cfg = PromptConfig('analyzer','security','audit',['Read'],[],"
            "'JSON','markdown')\n"
            "cfg.domain_knowledge = [DomainKnowledge(\n"
            "    import_path='.claude/big-context.md',\n"
            "    content='SECRET-MARKER ' * 1500,  # ~6000 tokens\n"
            "    title='Comprehensive Reference',\n"
            ")]\n"
            "p = generate_full_prompt(cfg).full_prompt\n"
            "print('@.claude/big-context.md' in p)\n"
            "# Content must not be inlined when @import is used\n"
            "print('SECRET-MARKER' not in p)\n"
            "# Title still appears as the @import label\n"
            "print('Comprehensive Reference' in p)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_promptconfig_domain_knowledge_defaults_to_empty(self) -> None:
        """Backwards compat: domain_knowledge defaults to []."""
        result = self._run_py(
            "from platxa_agent_generator.prompt_generator import PromptConfig\n"
            "cfg = PromptConfig('a','cat','desc',['Read'],[],'JSON')\n"
            "print(cfg.domain_knowledge == [], type(cfg.domain_knowledge).__name__)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True list"


class TestAgentDependencyDocumentation:
    """Tests for agent dependency documentation in agent_composer.py (feature #78).

    Covers:
    - build_dependency_graph: edges keyed by every agent (incl. isolated)
    - build_dependency_graph: roots = agents nothing else depends on
    - build_dependency_graph: detects missing dependencies (typos, renames)
    - build_dependency_graph: detects simple 2-cycle
    - build_dependency_graph: detects longer cycle (3-node)
    - Cycle deduplication: same ring entered from two starts reported once
    - render_dependency_diagram: emits Mermaid ``graph TD`` with all nodes
    - render_dependency_diagram: cycle edges use dotted ``-.->`` arrows
    - render_dependency_diagram: missing deps tagged with ``MISSING:`` prefix
    - render_dependency_readme_section: includes heading + diagram + roots
    - render_dependency_readme_section: cycle warning when cycles present
    - CLI ``deps`` exits non-zero on cycles (CI gate behavior)
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

    def test_build_graph_edges_include_isolated_agents(self) -> None:
        """Agents with no dependencies still appear in the edges map."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='loner', description='', dependencies=[]),\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=[]),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "print(sorted(g.edges))\n"
            "print(g.edges['loner'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["['a', 'b', 'loner']", "[]"]

    def test_build_graph_identifies_roots(self) -> None:
        """Roots are agents nobody depends on."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['mid']),\n"
            "    AgentSpec(name='mid', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "print(g.roots)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['top']"

    def test_build_graph_detects_missing_dependencies(self) -> None:
        """Names referenced but not defined go into missing_dependencies."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [AgentSpec(name='a', description='', "
            "dependencies=['nonexistent', 'also_missing'])]\n"
            "g = build_dependency_graph(agents)\n"
            "print(sorted(g.missing_dependencies['a']))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['also_missing', 'nonexistent']"

    def test_build_graph_detects_simple_cycle(self) -> None:
        """A → B → A cycle is reported with closing element."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "# Exactly one cycle, length 3 (a, b, a) — closing element\n"
            "print(len(g.cycles), len(g.cycles[0]) if g.cycles else 0)\n"
            "# First and last names match (closing the loop)\n"
            "print(g.cycles[0][0] == g.cycles[0][-1] if g.cycles else False)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["1 3", "True"]

    def test_build_graph_detects_three_node_cycle(self) -> None:
        """A → B → C → A forms one cycle, not three."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['c']),\n"
            "    AgentSpec(name='c', description='', dependencies=['a']),\n"
            "]\n"
            "g = build_dependency_graph(agents)\n"
            "# Cycle deduped by rotation: only one ring even though entered\n"
            "# from three different start nodes during DFS.\n"
            "print(len(g.cycles))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1"

    def test_render_diagram_emits_mermaid_block(self) -> None:
        """Mermaid output starts with ```mermaid + graph TD and lists all nodes."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "print(out.startswith('```mermaid'))\n"
            "print('graph TD' in out)\n"
            "print('top[top]' in out, 'leaf[leaf]' in out)\n"
            "print('top --> leaf' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == [
            "True",
            "True",
            "True True",
            "True",
        ]

    def test_render_diagram_marks_cycle_edges_with_dotted_arrow(self) -> None:
        """Edges participating in a cycle render as -.-> instead of -->."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "# Both cycle edges should be dotted; no solid --> arrows\n"
            "print('-.->' in out)\n"
            "print(' --> ' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_render_diagram_marks_missing_dependencies(self) -> None:
        """Missing-dep targets render with the MISSING: label prefix."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_diagram\n"
            "agents = [AgentSpec(name='a', description='', dependencies=['ghost'])]\n"
            "out = render_dependency_diagram(build_dependency_graph(agents))\n"
            "print('MISSING: ghost' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_render_readme_section_includes_diagram_and_roots(self) -> None:
        """Full README section has heading, Mermaid block, and entry points."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_readme_section\n"
            "agents = [\n"
            "    AgentSpec(name='top', description='', dependencies=['leaf']),\n"
            "    AgentSpec(name='leaf', description='', dependencies=[]),\n"
            "]\n"
            "out = render_dependency_readme_section(build_dependency_graph(agents))\n"
            "print('## Agent Dependencies' in out)\n"
            "print('```mermaid' in out)\n"
            "print('Entry points' in out and '`top`' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_render_readme_section_warns_on_cycles(self) -> None:
        """README section calls out circular dependencies in a warning block."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, build_dependency_graph,"
            " render_dependency_readme_section\n"
            "agents = [\n"
            "    AgentSpec(name='a', description='', dependencies=['b']),\n"
            "    AgentSpec(name='b', description='', dependencies=['a']),\n"
            "]\n"
            "out = render_dependency_readme_section(build_dependency_graph(agents))\n"
            "print('Circular dependencies' in out)\n"
            "print('a → b → a' in out or 'b → a → b' in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True"]

    def test_cli_deps_exits_nonzero_on_cycles(self) -> None:
        """CI-friendly: ``deps`` subcommand exits 2 when cycles are detected."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            agents_dir = tmp_path / "agents"
            agents_dir.mkdir()
            # Two agents that depend on each other
            (agents_dir / "a.md").write_text(
                "---\nname: a\ndescription: Agent a\ndependencies: [b]\n---\nbody"
            )
            (agents_dir / "b.md").write_text(
                "---\nname: b\ndescription: Agent b\ndependencies: [a]\n---\nbody"
            )
            scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
            result = subprocess.run(
                [
                    sys.executable,
                    str(scripts_dir / "agent_composer.py"),
                    "deps",
                    str(agents_dir / "a.md"),
                    str(agents_dir / "b.md"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            # Mermaid still printed before the SystemExit(2)
            assert "```mermaid" in result.stdout
            assert result.returncode == 2


class TestGenerationAttributionFooter:
    """Tests for inline generation comments in agent_generator.py (feature #79).

    Covers:
    - PLATXA_GENERATOR_VERSION constant exists and is non-empty
    - GENERATION_FOOTER_MARKER opens the footer (locatable by parsers)
    - Footer is HTML comment (invisible in rendered Markdown)
    - Footer includes generator version, timestamp, score, parameters
    - Pinned timestamp produces deterministic output (tests can assert)
    - Quality score formats as N.NN/10 when provided
    - Quality score reports "not measured" when None
    - Empty tools list renders as "(none)"
    - generate_agent_file appends footer as the last block
    - Pre-existing 14 sections still present (regression check)
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

    def test_version_constant_is_set(self) -> None:
        """PLATXA_GENERATOR_VERSION exists and is non-empty."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import PLATXA_GENERATOR_VERSION\n"
            "print(bool(PLATXA_GENERATOR_VERSION), '.' in PLATXA_GENERATOR_VERSION)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_footer_marker_is_locatable(self) -> None:
        """GENERATION_FOOTER_MARKER opens the footer block."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, GENERATION_FOOTER_MARKER,\n"
            "    generate_attribution_footer,\n"
            ")\n"
            "d = AgentDefinition(name='x', description='d', tools=['Read'])\n"
            "footer = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print(footer.startswith(GENERATION_FOOTER_MARKER))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_footer_is_html_comment(self) -> None:
        """Footer wraps in <!-- ... --> so it's invisible in rendered markdown."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "footer = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print(footer.startswith('<!--'), footer.endswith('-->'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_footer_includes_required_metadata(self) -> None:
        """Footer contains version, timestamp, score, name, pattern, model, tools."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, PLATXA_GENERATOR_VERSION,\n"
            "    generate_attribution_footer,\n"
            ")\n"
            "d = AgentDefinition(name='scanner', description='d', tools=['Read', 'Grep'],"
            " model='sonnet')\n"
            "f = generate_attribution_footer(d, pattern='orchestrator-workers',"
            " quality_score=8.42, timestamp='2026-04-15T10:30:00Z')\n"
            "print('v' + PLATXA_GENERATOR_VERSION in f)\n"
            "print('2026-04-15T10:30:00Z' in f)\n"
            "print('8.42/10' in f)\n"
            "print('scanner' in f)\n"
            "print('orchestrator-workers' in f)\n"
            "print('sonnet' in f)\n"
            "print('Read, Grep' in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True"] * 7

    def test_pinned_timestamp_produces_deterministic_output(self) -> None:
        """Same definition + same pinned timestamp → identical footer."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=['Read'])\n"
            "ts = '2026-04-15T12:00:00Z'\n"
            "f1 = generate_attribution_footer(d, timestamp=ts)\n"
            "f2 = generate_attribution_footer(d, timestamp=ts)\n"
            "print(f1 == f2)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_quality_score_omitted_renders_not_measured(self) -> None:
        """Score=None reports 'not measured' instead of fabricating a 0."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d, quality_score=None,"
            " timestamp='2026-04-15T10:00:00Z')\n"
            "print('not measured' in f, '0.00/10' not in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_empty_tools_renders_as_none(self) -> None:
        """An agent with no tools shows '(none)' rather than an empty string."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d, timestamp='2026-04-15T10:00:00Z')\n"
            "print('(none)' in f)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_generated_file_ends_with_footer(self) -> None:
        """generate_agent_file appends the footer as the last block."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import (\n"
            "    AgentDefinition, GENERATION_FOOTER_MARKER, generate_agent_file,\n"
            ")\n"
            "d = AgentDefinition(name='demo', description='d', tools=['Read'])\n"
            "out = generate_agent_file(d, quality_score=9.5, "
            "timestamp='2026-04-15T11:00:00Z')\n"
            "# Footer marker present and it appears in the last few lines\n"
            "print(GENERATION_FOOTER_MARKER in out)\n"
            "tail = out.rstrip().splitlines()[-10:]\n"
            "print(any(GENERATION_FOOTER_MARKER in line for line in tail))\n"
            "# Footer is the final ``-->`` line\n"
            "print(out.rstrip().endswith('-->'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().split("\n") == ["True", "True", "True"]

    def test_default_timestamp_is_iso8601_utc(self) -> None:
        """Default (no timestamp arg) emits ISO-8601 UTC with trailing Z."""
        result = self._run_py(
            "import re\n"
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_attribution_footer\n"
            "d = AgentDefinition(name='x', description='d', tools=[])\n"
            "f = generate_attribution_footer(d)\n"
            "# Footer should contain a Z-suffixed ISO-8601 timestamp\n"
            "m = re.search(r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z', f)\n"
            "print(m is not None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_existing_sections_preserved(self) -> None:
        """Adding the footer didn't break any of the 14 pre-existing sections."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_agent_file\n"
            "d = AgentDefinition(name='demo', description='d', tools=['Read'])\n"
            "out = generate_agent_file(d, timestamp='2026-04-15T11:00:00Z')\n"
            "# Spot-check that the canonical headings still appear\n"
            "for h in ['## Overview', '## Workflow', '## Examples',\n"
            "         '## Error Handling', '## Output Format', '## Verification']:\n"
            "    assert h in out, f'missing: {h}'\n"
            "print('OK')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "OK"
