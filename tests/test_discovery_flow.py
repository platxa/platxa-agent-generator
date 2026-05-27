#!/usr/bin/env python3
"""Tests for Feature #69: discovery → context injection → generation data flow."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from platxa_agent_generator.agent_generator import (
    AgentDefinition,
    generate,
    generate_related_agents_section,
)
from platxa_agent_generator.context_discovery import (
    ExistingAgent,
    discovery_report,
)


def _make_agent(name: str, tools: list[str] | None = None) -> ExistingAgent:
    return ExistingAgent(
        name=name,
        description=f"Agent {name}",
        tools=tools or ["Read", "Grep"],
        file_path=f".claude/agents/{name}.md",
        scope="project",
        line_ranges=[(1, 5)],
    )


def _make_discovery_ctx(
    agents: list[ExistingAgent] | None = None,
    proposed_name: str | None = None,
) -> dict[str, Any]:
    agents = agents or [_make_agent("reviewer"), _make_agent("builder", ["Read", "Write", "Bash"])]
    return discovery_report(agents, proposed_name=proposed_name)


class TestAgentDefinitionDiscoveryContext:
    """AgentDefinition.discovery_context field behavior."""

    def test_defaults_to_empty_dict(self) -> None:
        defn = AgentDefinition(name="test", description="test", tools=["Read"])
        assert defn.discovery_context == {}

    def test_accepts_full_report(self) -> None:
        ctx = _make_discovery_ctx()
        defn = AgentDefinition(
            name="test", description="test", tools=["Read"], discovery_context=ctx
        )
        assert defn.discovery_context["agents_found"] == 2
        assert "patterns" in defn.discovery_context


class TestDiscoveryToGenerationFlow:
    """generate() with discovery_context parameter."""

    def test_generate_with_discovery_context_succeeds(self) -> None:
        ctx = _make_discovery_ctx()
        success, content, _ = generate(
            name="test-agent",
            description="A test agent for analyzing code",
            tools=["Read", "Grep"],
            discovery_context=ctx,
        )
        assert success
        assert "test-agent" in content

    def test_generate_without_discovery_context_succeeds(self) -> None:
        success, content, _ = generate(
            name="test-agent",
            description="A test agent for analyzing code",
            tools=["Read", "Grep"],
        )
        assert success
        assert "test-agent" in content

    def test_discovery_context_appears_in_related_agents(self) -> None:
        ctx = _make_discovery_ctx()
        success, content, _ = generate(
            name="new-agent",
            description="A new agent",
            tools=["Read"],
            discovery_context=ctx,
        )
        assert success
        assert "Existing Agents in This Project" in content
        assert "reviewer" in content

    def test_conflict_warning_in_output(self) -> None:
        agents = [_make_agent("my-agent")]
        ctx = discovery_report(agents, proposed_name="my-agent")
        assert ctx["conflict_check"]["has_conflict"]

        success, content, _ = generate(
            name="my-agent",
            description="A conflicting agent",
            tools=["Read"],
            discovery_context=ctx,
        )
        assert success
        assert "Warning" in content
        assert "already exists" in content


class TestRelatedAgentsSectionWithDiscovery:
    """generate_related_agents_section() enhanced with discovery context."""

    def test_lists_discovered_agents(self) -> None:
        agents = [_make_agent("alpha"), _make_agent("beta"), _make_agent("gamma")]
        ctx = discovery_report(agents)
        defn = AgentDefinition(
            name="test", description="test", tools=["Read"], discovery_context=ctx
        )
        section = generate_related_agents_section(defn)
        assert "alpha" in section
        assert "beta" in section
        assert "gamma" in section

    def test_caps_at_five_agents(self) -> None:
        agents = [_make_agent(f"agent-{i}") for i in range(10)]
        ctx = discovery_report(agents)
        defn = AgentDefinition(
            name="test", description="test", tools=["Read"], discovery_context=ctx
        )
        section = generate_related_agents_section(defn)
        listed = section.count("- **agent-")
        assert listed == 5

    def test_shows_conflict_warning(self) -> None:
        agents = [_make_agent("my-agent")]
        ctx = discovery_report(agents, proposed_name="my-agent")
        defn = AgentDefinition(
            name="my-agent", description="test", tools=["Read"], discovery_context=ctx
        )
        section = generate_related_agents_section(defn)
        assert "Warning" in section
        assert "already exists" in section

    def test_shows_similar_names_note(self) -> None:
        agents = [_make_agent("code-reviewer")]
        ctx = discovery_report(agents, proposed_name="code-review")
        defn = AgentDefinition(
            name="code-review", description="test", tools=["Read"], discovery_context=ctx
        )
        section = generate_related_agents_section(defn)
        assert "Similar agents exist" in section or "Warning" in section

    def test_still_shows_complementary_agents(self) -> None:
        ctx = _make_discovery_ctx()
        defn = AgentDefinition(
            name="test", description="review code", tools=["Read"], discovery_context=ctx
        )
        section = generate_related_agents_section(defn)
        assert "Existing Agents in This Project" in section
        assert "Complementary Agents" in section

    def test_empty_discovery_falls_back(self) -> None:
        defn_with = AgentDefinition(
            name="test", description="analyze code", tools=["Read"], discovery_context={}
        )
        defn_without = AgentDefinition(name="test", description="analyze code", tools=["Read"])
        assert generate_related_agents_section(defn_with) == generate_related_agents_section(
            defn_without
        )


class TestDiscoveryPhaseOrdering:
    """Verify discovery is called before generation in cli.py."""

    @patch("platxa_agent_generator.cli.context_discovery")
    @patch("platxa_agent_generator.cli.agent_generator")
    @patch("platxa_agent_generator.cli.nlp_parser")
    @patch("platxa_agent_generator.cli.type_classifier")
    def test_discovery_called_before_generation(
        self,
        mock_classifier: MagicMock,
        mock_nlp: MagicMock,
        mock_gen: MagicMock,
        mock_cd: MagicMock,
    ) -> None:
        call_order: list[str] = []

        mock_nlp.parse.side_effect = lambda _d: (
            call_order.append("nlp_parse"),
            MagicMock(
                name="parsed-agent",
                agent_type="analyzer",
                description=_d,
                tools=["Read", "Grep"],
            ),
        )[1]

        mock_classifier.classify.side_effect = lambda _d: (
            call_order.append("classify"),
            MagicMock(architecture_type="simple"),
        )[1]

        mock_cd.scan_all_agents.side_effect = lambda: (
            call_order.append("scan_all_agents"),
            [],
        )[1]
        mock_cd.discovery_report.side_effect = lambda _agents, proposed_name=None: (
            call_order.append("discovery_report"),
            {"agents_found": 0, "agents": [], "patterns": {"recommended_base": []}},
        )[1]

        mock_gen.generate.side_effect = lambda **_kw: (
            call_order.append("generate"),
            (True, "content", ""),
        )[1]

        from platxa_agent_generator.cli import CLI

        cli = CLI()
        args = MagicMock()
        args.description = "Test agent"
        args.name = "test-agent"
        args.type = None
        args.tools = None
        args.output = None
        args.no_validate = True
        args.max_iterations = 1
        args.json = False

        cli._generate_from_description(args)

        scan_idx = call_order.index("scan_all_agents")
        report_idx = call_order.index("discovery_report")
        gen_idx = call_order.index("generate")

        assert scan_idx < report_idx
        assert report_idx < gen_idx

    @patch("platxa_agent_generator.cli.context_discovery")
    @patch("platxa_agent_generator.cli.agent_generator")
    @patch("platxa_agent_generator.cli.nlp_parser")
    @patch("platxa_agent_generator.cli.type_classifier")
    def test_recommended_base_merged_into_tools(
        self,
        mock_classifier: MagicMock,
        mock_nlp: MagicMock,
        mock_gen: MagicMock,
        mock_cd: MagicMock,
    ) -> None:
        mock_nlp.parse.return_value = MagicMock(
            name="test-agent",
            agent_type="builder",
            description="test",
            tools=["Read"],
        )
        mock_classifier.classify.return_value = MagicMock(architecture_type="simple")
        mock_cd.scan_all_agents.return_value = []
        mock_cd.discovery_report.return_value = {
            "agents_found": 0,
            "agents": [],
            "patterns": {"recommended_base": ["Glob", "Grep"]},
        }
        mock_gen.generate.return_value = (True, "content", "")

        from platxa_agent_generator.cli import CLI

        cli = CLI()
        args = MagicMock()
        args.description = "Test agent"
        args.name = "test-agent"
        args.type = None
        args.tools = None
        args.output = None
        args.no_validate = True
        args.max_iterations = 1
        args.json = False

        cli._generate_from_description(args)

        mock_gen.generate.assert_called_once()
        call_kwargs = mock_gen.generate.call_args
        tools_passed = call_kwargs.kwargs.get("tools")
        assert "Read" in tools_passed
        assert "Glob" in tools_passed
        assert "Grep" in tools_passed

    @patch("platxa_agent_generator.cli.context_discovery")
    @patch("platxa_agent_generator.cli.agent_generator")
    @patch("platxa_agent_generator.cli.nlp_parser")
    @patch("platxa_agent_generator.cli.type_classifier")
    def test_discovery_output_piped_to_generate(
        self,
        mock_classifier: MagicMock,
        mock_nlp: MagicMock,
        mock_gen: MagicMock,
        mock_cd: MagicMock,
    ) -> None:
        expected_ctx = {
            "agents_found": 2,
            "agents": [{"name": "a"}, {"name": "b"}],
            "patterns": {"recommended_base": ["Read"]},
        }

        mock_nlp.parse.return_value = MagicMock(
            name="test-agent",
            agent_type="builder",
            description="test",
            tools=["Read"],
        )
        mock_classifier.classify.return_value = MagicMock(architecture_type="simple")
        mock_cd.scan_all_agents.return_value = []
        mock_cd.discovery_report.return_value = expected_ctx
        mock_gen.generate.return_value = (True, "content", "")

        from platxa_agent_generator.cli import CLI

        cli = CLI()
        args = MagicMock()
        args.description = "Test agent"
        args.name = "test-agent"
        args.type = None
        args.tools = None
        args.output = None
        args.no_validate = True
        args.max_iterations = 1
        args.json = False

        cli._generate_from_description(args)

        mock_gen.generate.assert_called_once()
        call_kwargs = mock_gen.generate.call_args
        assert call_kwargs.kwargs.get("discovery_context") == expected_ctx
