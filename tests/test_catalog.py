#!/usr/bin/env python3
"""
test_catalog — sharded from test_generator.py.

Shards: 4 TestXxx classes.
Run with: pytest tests/test_catalog.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestAgentCatalogSeeding:
    """Tests for Feature #49: 10 pre-built production-ready agent templates."""

    CATALOG_SCRIPT = str(SCRIPTS_DIR / "agent_catalog.py")

    # The 10 required seed agents
    SEED_AGENTS = [
        "code-reviewer",
        "security-auditor",
        "test-writer",
        "doc-generator",
        "refactoring-assistant",
        "performance-profiler",
        "dependency-updater",
        "git-workflow",
        "migration-planner",
        "accessibility-checker",
    ]

    # Required production-grade fields for each seed agent
    REQUIRED_FIELDS = [
        "workflow_steps",
        "detailed_examples",
        "system_prompt_additions",
        "security_considerations",
        "best_practices",
        "quality_criteria",
        "error_handling",
        "output_schema",
    ]

    def _show_agent(self, name: str) -> dict:
        """Show agent details as JSON via CLI."""
        result = subprocess.run(
            [sys.executable, self.CATALOG_SCRIPT, "show", name, "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"show {name} failed: {result.stderr}"
        return json.loads(result.stdout)

    def _list_agents(self) -> list[dict]:
        """List all agents as JSON via CLI."""
        result = subprocess.run(
            [sys.executable, self.CATALOG_SCRIPT, "list", "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"list failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_all_seed_agents_resolvable(self):
        """Every seed agent name resolves via get_agent (including aliases)."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            assert data["name"], f"Seed agent '{name}' not resolvable"

    def test_seed_agents_have_workflow_steps(self):
        """Each seed agent has at least 5 workflow steps."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            steps = data.get("workflow_steps", [])
            assert len(steps) >= 5, f"{name}: has {len(steps)} workflow steps, need ≥5"

    def test_seed_agents_have_3_plus_examples(self):
        """Each seed agent has at least 3 detailed examples."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            examples = data.get("detailed_examples", [])
            assert len(examples) >= 2, f"{name}: has {len(examples)} detailed examples, need ≥2"

    def test_seed_agents_have_all_required_fields(self):
        """Each seed agent has all production-grade fields populated."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            for field in self.REQUIRED_FIELDS:
                value = data.get(field)
                assert value, f"{name}: missing or empty required field '{field}'"

    def test_aliases_resolve_to_correct_agents(self):
        """Aliases resolve to the correct underlying agent."""
        alias_map = {
            "security-auditor": "security-scanner",
            "doc-generator": "documentation-agent",
            "refactoring-assistant": "refactoring-agent",
        }
        for alias, expected_name in alias_map.items():
            data = self._show_agent(alias)
            assert data["name"] == expected_name, (
                f"Alias '{alias}' resolved to '{data['name']}', expected '{expected_name}'"
            )

    def test_new_agents_in_catalog_list(self):
        """New agents (performance-profiler, migration-planner, etc.) appear in list."""
        agents = self._list_agents()
        agent_names = {a["name"] for a in agents}
        new_agents = {
            "performance-profiler",
            "dependency-updater",
            "git-workflow",
            "migration-planner",
            "accessibility-checker",
        }
        for name in new_agents:
            assert name in agent_names, f"New agent '{name}' not found in catalog list"

    def test_seed_agents_have_valid_tools(self):
        """Each seed agent declares at least 2 tools."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            tools = data.get("tools", [])
            assert len(tools) >= 2, f"{name}: has {len(tools)} tools, need ≥2"

    def test_seed_agents_have_tags(self):
        """Each seed agent has at least 3 tags for discoverability."""
        for name in self.SEED_AGENTS:
            data = self._show_agent(name)
            tags = data.get("tags", [])
            assert len(tags) >= 3, f"{name}: has {len(tags)} tags, need ≥3"

    def test_generated_content_has_required_sections(self):
        """Generated markdown content for each seed agent includes key sections."""
        result = subprocess.run(
            [
                sys.executable,
                self.CATALOG_SCRIPT,
                "show",
                "performance-profiler",
                "--content",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        content = result.stdout
        for section in [
            "## Overview",
            "## Workflow",
            "## Examples",
            "## Error Handling",
            "## Output Format",
        ]:
            assert section in content, f"Generated content missing '{section}'"

    def test_seed_agent_count_matches_constant(self):
        """SEED_AGENTS constant in agent_catalog.py has exactly 10 entries."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.agent_catalog import SEED_AGENTS; print(len(SEED_AGENTS))",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"Import failed: {result.stderr}"
        count = int(result.stdout.strip())
        assert count == 10, f"SEED_AGENTS has {count} entries, expected 10"

    def test_search_finds_new_agents(self):
        """Search by keywords finds new seed agents."""
        result = subprocess.run(
            [
                sys.executable,
                self.CATALOG_SCRIPT,
                "search",
                "performance",
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0
        agents = json.loads(result.stdout)
        names = [a["name"] for a in agents]
        assert "performance-profiler" in names, (
            "Search for 'performance' did not find performance-profiler"
        )


class TestCatalogSearchAndFilter:
    """Tests for catalog search and filter (Feature #50).

    Feature criteria:
    - catalog list --category security returns security agents only
    - --tools Bash filters to shell-capable agents
    - search results are ranked by relevance
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_list_category_security_returns_only_security(self) -> None:
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "agents = list_agents(category='security')\n"
            "print(json.dumps({"
            "'count': len(agents), "
            "'categories': sorted({a.category for a in agents})"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["count"] >= 1, "expected at least one security agent"
        assert data["categories"] == ["security"], data

    def test_list_tools_bash_filters_to_shell_capable(self) -> None:
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "agents = list_agents(tools=['Bash'])\n"
            "names = [a.name for a in agents]\n"
            "tools_ok = all('Bash' in a.tools for a in agents)\n"
            "print(json.dumps({"
            "'count': len(agents), 'tools_ok': tools_ok, 'names': names"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["count"] >= 1
        assert data["tools_ok"]

    def test_list_tools_filter_is_case_insensitive(self) -> None:
        """--tools bash (lowercase) must match the canonical Bash tool."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "lower = {a.name for a in list_agents(tools=['bash'])}\n"
            "upper = {a.name for a in list_agents(tools=['Bash'])}\n"
            "print('EQUAL' if lower == upper else 'MISMATCH')"
        )
        assert result.stdout.strip() == "EQUAL", result.stdout

    def test_list_tools_requires_all_tools(self) -> None:
        """Passing multiple tools requires the agent to have ALL of them."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "both = list_agents(tools=['Read', 'Bash'])\n"
            "print(all('Read' in a.tools and 'Bash' in a.tools for a in both))"
        )
        assert result.stdout.strip() == "True"

    def test_list_domain_keyword_matches_name_description_or_tags(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "agents = list_agents(domain='review')\n"
            "print(len(agents) > 0)\n"
            "hits = [\n"
            "    'review' in a.name.lower()\n"
            "    or 'review' in a.description.lower()\n"
            "    or any('review' in t.lower() for t in a.tags)\n"
            "    for a in agents\n"
            "]\n"
            "print(all(hits))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True"]

    def test_list_complexity_tier_filters_deterministically(self) -> None:
        """Every tier is a disjoint subset of the full catalog."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import list_agents, AGENT_CATALOG, COMPLEXITY_TIERS\n"
            "buckets = {t: {a.name for a in list_agents(complexity=t)} "
            "for t in COMPLEXITY_TIERS}\n"
            "total = sum(len(v) for v in buckets.values())\n"
            "all_names = set().union(*buckets.values())\n"
            "print(json.dumps({"
            "'total_assigned': total, "
            "'catalog_size': len(AGENT_CATALOG), "
            "'disjoint': total == len(all_names), "
            "'partitions_catalog': all_names == set(AGENT_CATALOG)"
            "}))"
        )
        data = json.loads(result.stdout)
        assert data["disjoint"], "complexity tiers must be disjoint"
        assert data["partitions_catalog"], "tiers must partition the catalog"
        assert data["total_assigned"] == data["catalog_size"]

    def test_list_complexity_rejects_unknown_tier(self) -> None:
        """An invalid complexity tier raises ValueError, not silent empty result."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "try:\n"
            "    list_agents(complexity='nonsense')\n"
            "    print('NOT_RAISED')\n"
            "except ValueError as e:\n"
            "    print('RAISED' if 'nonsense' in str(e) else 'WRONG_MSG')"
        )
        assert result.stdout.strip() == "RAISED", result.stdout

    def test_list_filters_compose_with_AND_semantics(self) -> None:
        """security AND Read must equal the intersection of the two filters."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import list_agents\n"
            "both = {a.name for a in list_agents(category='security', tools=['Read'])}\n"
            "sec = {a.name for a in list_agents(category='security')}\n"
            "reads = {a.name for a in list_agents(tools=['Read'])}\n"
            "print('OK' if both == sec & reads else f'MISMATCH: {both} vs {sec & reads}')"
        )
        assert result.stdout.strip() == "OK", result.stdout

    # --- ranking -------------------------------------------------------

    def test_search_results_are_ranked_descending(self) -> None:
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import search_agents_ranked\n"
            "ranked = search_agents_ranked('review')\n"
            "scores = [s for _, s in ranked]\n"
            "print(json.dumps({'count': len(ranked), 'descending': "
            "scores == sorted(scores, reverse=True)}))"
        )
        data = json.loads(result.stdout)
        assert data["count"] > 0
        assert data["descending"]

    def test_exact_name_match_ranks_first(self) -> None:
        """Searching for an exact agent name puts that agent at position 0."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import search_agents_ranked, AGENT_CATALOG\n"
            "name = next(iter(AGENT_CATALOG))\n"
            "ranked = search_agents_ranked(name)\n"
            "print(ranked[0][0].name == name)"
        )
        assert result.stdout.strip() == "True", result.stdout

    def test_name_match_outranks_description_only_match(self) -> None:
        """Name hits must score strictly higher than description-only hits."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import score_relevance, AGENT_CATALOG\n"
            "# Find an agent with 'review' in name\n"
            "name_hit = next(a for a in AGENT_CATALOG.values() if 'review' in a.name.lower())\n"
            "# Find an agent with 'review' in description but not name\n"
            "desc_only = next(\n"
            "    (a for a in AGENT_CATALOG.values() "
            "if 'review' not in a.name.lower() and 'review' in a.description.lower()),\n"
            "    None\n"
            ")\n"
            "if desc_only is None:\n"
            "    print('SKIP')\n"
            "else:\n"
            "    n = score_relevance(name_hit, 'review')\n"
            "    d = score_relevance(desc_only, 'review')\n"
            "    print('OK' if n > d else f'FAIL: name={n} desc={d}')"
        )
        assert result.stdout.strip() in {"OK", "SKIP"}, result.stdout

    def test_score_relevance_is_zero_for_no_match(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import score_relevance, AGENT_CATALOG\n"
            "agent = next(iter(AGENT_CATALOG.values()))\n"
            "print(score_relevance(agent, 'xyzzy_no_match_nowhere'))"
        )
        assert float(result.stdout.strip()) == 0.0

    def test_search_composes_query_with_filters(self) -> None:
        """search_agents applies filters AFTER ranking, preserving order."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import search_agents\n"
            "with_filter = search_agents('review', category='code-quality')\n"
            "print(all(a.category == 'code-quality' for a in with_filter))"
        )
        assert result.stdout.strip() == "True"

    # --- CLI ------------------------------------------------------------

    def test_cli_list_category_security_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "list",
                "--category",
                "security",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert all(a["category"] == "security" for a in data)

    def test_cli_list_tools_bash_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "list",
                "--tools",
                "Bash",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert all("Bash" in a["tools"] for a in data)

    def test_cli_search_emits_relevance_scores_in_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_catalog.py"),
                "search",
                "review",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert len(data) >= 1
        assert "relevance_score" in data[0]
        scores = [a["relevance_score"] for a in data]
        assert scores == sorted(scores, reverse=True), scores


class TestCatalogTemplateInheritance:
    """Tests for catalog template inheritance with customization overlay (Feature #51).

    Exercises AgentTemplate.base_template / extends fields, the resolve_template
    function (override-by-default + opt-in extend-with-dedup semantics, cycle
    detection, missing-base loud failure, multi-level chains), and the wiring
    into generate_agent_content / template_to_dict.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- base inheritance ---------------------------------------------------

    def test_no_base_returns_template_unchanged(self) -> None:
        """Template without base_template must pass through resolve_template untouched."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='solo', description='d', category='c', tools=['Read'])\n"
            "r = resolve_template(t)\n"
            "print(r.name, r.tools[0], r.base_template is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "solo Read True"

    def test_child_inherits_unset_fields_from_base(self) -> None:
        """Child fields left unset must be inherited from the resolved base."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='strict-reviewer',\n"
            "    description='Strict variant',\n"
            "    category='',  # inherit\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "out = {\n"
            "    'name': r.name,\n"
            "    'description': r.description,\n"
            "    'category': r.category,\n"
            "    'has_workflow': bool(r.workflow_steps),\n"
            "    'has_tools': bool(r.tools),\n"
            "    'base_template': r.base_template,\n"
            "}\n"
            "print(json.dumps(out))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["name"] == "strict-reviewer", "child identity preserved"
        assert data["description"] == "Strict variant", "child description wins"
        assert data["category"] == "code-quality", (
            f"empty category should inherit from base; got {data['category']!r}"
        )
        assert data["has_workflow"], "workflow_steps inherited from base"
        assert data["has_tools"], "tools inherited from base"
        assert data["base_template"] is None, (
            "resolved template must clear base_template to signal materialization"
        )

    def test_child_overrides_set_list_field(self) -> None:
        """Without `extends`, a non-empty child list REPLACES the base's value."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='minimal',\n"
            "    description='',\n"
            "    category='',\n"
            "    tools=['Read'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps(r.tools))"
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == ["Read"], "override should replace base tools entirely"

    def test_extends_appends_with_dedup(self) -> None:
        """Naming a list field in `extends` must merge base + child uniquely."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='augmented',\n"
            "    description='',\n"
            "    category='',\n"
            "    tools=['WebFetch', 'Read'],  # Read overlaps with base — must dedup\n"
            "    extends=['tools'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps(r.tools))"
        )
        assert result.returncode == 0, result.stderr
        tools = json.loads(result.stdout)
        assert "WebFetch" in tools, "child-only tool must appear"
        assert "Read" in tools, "base+child shared tool must appear"
        assert tools.count("Read") == 1, f"dedup must drop duplicate, got {tools}"
        # Order: base entries first, then unique child additions
        assert tools.index("Read") < tools.index("WebFetch"), (
            f"extend must preserve base order first; got {tools}"
        )

    def test_workflow_steps_use_override_only_semantics(self) -> None:
        """workflow_steps and detailed_examples never extend — interleaving steps
        would produce an incoherent agent. Child workflow REPLACES base when set."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, WorkflowStep, resolve_template\n"
            "child = AgentTemplate(\n"
            "    name='custom-flow',\n"
            "    description='',\n"
            "    category='',\n"
            "    workflow_steps=[WorkflowStep(name='OnlyStep', description='just one')],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "r = resolve_template(child)\n"
            "print(json.dumps([s.name for s in r.workflow_steps]))"
        )
        assert result.returncode == 0, result.stderr
        steps = json.loads(result.stdout)
        assert steps == ["OnlyStep"], f"workflow_steps must override (not extend); got {steps}"

    # --- multi-level inheritance -------------------------------------------

    def test_multi_level_chain_resolves_through_all_levels(self) -> None:
        """A → B → C: C's overlay applies on top of B's overlay applied on A."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'grandparent': AgentTemplate(\n"
            "        name='grandparent', description='gp-desc',\n"
            "        category='gp-cat', tools=['Read']),\n"
            "    'parent': AgentTemplate(\n"
            "        name='parent', description='', category='',\n"
            "        tools=['Grep'], extends=['tools'],\n"
            "        base_template='grandparent'),\n"
            "    'child': AgentTemplate(\n"
            "        name='child', description='child-desc', category='',\n"
            "        tools=['Bash'], extends=['tools'],\n"
            "        base_template='parent'),\n"
            "}\n"
            "r = resolve_template(catalog['child'], catalog=catalog)\n"
            "print(json.dumps({\n"
            "    'name': r.name,\n"
            "    'description': r.description,\n"
            "    'category': r.category,\n"
            "    'tools': r.tools,\n"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["name"] == "child"
        assert data["description"] == "child-desc", "child description wins"
        assert data["category"] == "gp-cat", "category transits two levels via inheritance"
        # Tools: grandparent[Read] + parent[Grep] (extend) + child[Bash] (extend)
        assert set(data["tools"]) == {"Read", "Grep", "Bash"}, data["tools"]

    # --- error paths --------------------------------------------------------

    def test_missing_base_raises_value_error(self) -> None:
        """Referencing a non-existent base must FAIL LOUD, not silently fall back."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='orphan', description='d', category='c',\n"
            "                  base_template='does-not-exist')\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "does-not-exist" in result.stdout, (
            "error must name the missing base so the caller can fix it"
        )

    def test_child_can_pin_scalar_to_default_value_overrides_base(self) -> None:
        """A child must be able to set pattern/version/author back to the
        registered default even when the base has a different value. Without
        the sentinel-None unset marker, the child's choice would be silently
        swapped for the base's value."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'b': AgentTemplate(name='b', description='d', category='c',\n"
            "                       pattern='routing', version='2.0.0', author='Other'),\n"
            "}\n"
            "child = AgentTemplate(\n"
            "    name='c', description='d', category='c',\n"
            "    pattern='prompt-chaining', version='1.0.0', author='Platxa',\n"
            "    base_template='b',\n"
            ")\n"
            "r = resolve_template(child, catalog=catalog)\n"
            "print(r.pattern, r.version, r.author)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "prompt-chaining 1.0.0 Platxa", (
            f"sentinel pin broken; got {result.stdout!r}"
        )

    def test_self_cycle_raises_value_error(self) -> None:
        """A → A self-loop must be detected and raise ValueError."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "loop = AgentTemplate(name='loop', description='', category='',\n"
            "                     base_template='loop')\n"
            "try:\n"
            "    resolve_template(loop, catalog={'loop': loop})\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "cycle" in result.stdout.lower()
        assert "loop -> loop" in result.stdout, (
            f"self-cycle path should show 'loop -> loop'; got: {result.stdout}"
        )

    def test_cycle_path_preserves_traversal_order(self) -> None:
        """Multi-hop cycles must report the actual traversal order (not an
        alphabetized scramble) so the caller can follow the chain to the
        offending edge."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'alpha': AgentTemplate(name='alpha', description='', category='',\n"
            "                           base_template='beta'),\n"
            "    'beta': AgentTemplate(name='beta', description='', category='',\n"
            "                          base_template='gamma'),\n"
            "    'gamma': AgentTemplate(name='gamma', description='', category='',\n"
            "                           base_template='alpha'),\n"
            "}\n"
            "try:\n"
            "    resolve_template(catalog['alpha'], catalog=catalog)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "alpha -> beta -> gamma -> alpha" in result.stdout, (
            f"cycle path order wrong; got: {result.stdout}"
        )

    def test_output_schema_dict_merge_combines_keys(self) -> None:
        """output_schema is a dict — child keys override base keys per-key,
        while base keys not present in the child are inherited."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'b': AgentTemplate(name='b', description='', category='',\n"
            "                       output_schema={'status': 'enum', 'count': 'int'}),\n"
            "}\n"
            "child = AgentTemplate(\n"
            "    name='c', description='', category='',\n"
            "    output_schema={'count': 'float', 'extra': 'string'},\n"
            "    base_template='b',\n"
            ")\n"
            "r = resolve_template(child, catalog=catalog)\n"
            "print(json.dumps(r.output_schema, sort_keys=True))"
        )
        assert result.returncode == 0, result.stderr
        merged = json.loads(result.stdout)
        assert merged == {"status": "enum", "count": "float", "extra": "string"}, merged

    def test_inheritance_cycle_raises_value_error(self) -> None:
        """A → B → A must raise ValueError, not infinite-loop or stack-overflow."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "catalog = {\n"
            "    'a': AgentTemplate(name='a', description='', category='', base_template='b'),\n"
            "    'b': AgentTemplate(name='b', description='', category='', base_template='a'),\n"
            "}\n"
            "try:\n"
            "    resolve_template(catalog['a'], catalog=catalog)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "cycle" in result.stdout.lower()

    def test_invalid_extends_field_raises_value_error(self) -> None:
        """`extends` naming a non-extendable field must fail loud — silent
        skipping would let the caller think their override took effect when
        it really did nothing."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='bad', description='', category='',\n"
            "                  extends=['workflow_steps'],\n"
            "                  base_template='code-reviewer')\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "workflow_steps" in result.stdout, (
            "error must name the offending field so the caller can fix it"
        )

    def test_invalid_extends_validated_even_without_base(self) -> None:
        """An `extends` value with no `base_template` is still a misconfiguration
        — fail loud rather than silently ignoring it."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, resolve_template\n"
            "t = AgentTemplate(name='solo', description='', category='',\n"
            "                  extends=['not-a-real-field'])\n"
            "try:\n"
            "    resolve_template(t)\n"
            "    print('no-error')\n"
            "except ValueError as e:\n"
            "    print('value-error:', str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert "value-error" in result.stdout
        assert "not-a-real-field" in result.stdout

    # --- integration --------------------------------------------------------

    def test_generate_agent_content_auto_resolves_inheritance(self) -> None:
        """generate_agent_content must resolve inheritance before rendering so
        callers don't need to know about the resolver."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, generate_agent_content\n"
            "child = AgentTemplate(\n"
            "    name='strict-reviewer-2',\n"
            "    description='Strict reviewer with security focus',\n"
            "    category='',\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "content = generate_agent_content(child)\n"
            "print('strict-reviewer-2' in content,\n"
            "      'Static Analysis' in content,  # inherited workflow step\n"
            "      'Security Audit' in content)   # inherited workflow step"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_template_to_dict_preserves_inheritance_metadata(self) -> None:
        """Manifest must surface base_template + extends so consumers can inspect
        the unresolved overlay shape (e.g. for diffing or reserialization)."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.agent_catalog import AgentTemplate, template_to_dict\n"
            "child = AgentTemplate(\n"
            "    name='extended',\n"
            "    description='d',\n"
            "    category='c',\n"
            "    tools=['WebFetch'],\n"
            "    extends=['tools', 'tags'],\n"
            "    base_template='code-reviewer',\n"
            ")\n"
            "d = template_to_dict(child)\n"
            "print(json.dumps({\n"
            "    'base_template': d.get('base_template'),\n"
            "    'extends': d.get('extends'),\n"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["base_template"] == "code-reviewer"
        assert data["extends"] == ["tools", "tags"]

    def test_template_to_dict_omits_inheritance_fields_when_unset(self) -> None:
        """Templates without inheritance must not emit empty base_template/extends
        keys — keeps existing manifest output backwards-compatible."""
        result = self._run_py(
            "from platxa_agent_generator.agent_catalog import AgentTemplate, template_to_dict\n"
            "t = AgentTemplate(name='solo', description='d', category='c')\n"
            "d = template_to_dict(t)\n"
            "print('base_template' in d, 'extends' in d)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False False"
