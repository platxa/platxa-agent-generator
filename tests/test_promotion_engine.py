"""Tests for :mod:`platxa_agent_generator.promotion_engine`.

After feature #25 the module is reduced to the target-classification
helper ``cluster_instincts``. The threshold gate
(``promote`` / ``PromotionThresholds``) now lives in the
``instinct-promoter`` subagent and is exercised by
``tests/test_cli_evolve.py``; the observation-distillation helper
(``distill_principle``) was orphan code with no production callers
and has been removed entirely.

Surviving coverage:

* Type-based routing — every ``observation.type`` lands in the
  expected target.
* Keyword fallback — unrecognised types resolve via keyword scoring.
* No cross-target leakage — every principle is assigned to exactly
  one target.
* Edge cases — empty input, frozen result, deterministic output.
"""

from __future__ import annotations

import pytest

from platxa_agent_generator.promotion_engine import (
    ClusterResult,
    DistilledPrinciple,
    cluster_instincts,
)


def _principle(
    *,
    type_: str = "tool_use",
    description: str = "read config file",
    action: str = "Prefer this approach",
    evidence: str = "observed",
    name: str = "test-principle",
) -> DistilledPrinciple:
    return DistilledPrinciple(
        name=name,
        description=description,
        type=type_,
        confidence=0.8,
        created="2026-05-24T10:00:00Z",
        last_seen="2026-05-24T10:00:00Z",
        action=action,
        evidence=evidence,
        examples="- example-1",
        occurrences=3,
        success_count=2,
        usage_count=1,
        ttl_days=30,
        project_scope="proj-abc",
        outcome="success",
    )


class TestClusterInstinctsTypeRouting:
    """Type-based routing sends instincts to the correct target."""

    def test_discovery_type_routes_to_skill(self) -> None:
        result = cluster_instincts([_principle(type_="discovery")])
        assert len(result.skill) == 1
        assert len(result.command) == 0
        assert len(result.agent) == 0
        assert len(result.template) == 0

    def test_feature_type_routes_to_skill(self) -> None:
        result = cluster_instincts([_principle(type_="feature")])
        assert len(result.skill) == 1

    def test_refactor_type_routes_to_skill(self) -> None:
        result = cluster_instincts([_principle(type_="refactor")])
        assert len(result.skill) == 1

    def test_tool_use_type_routes_to_command(self) -> None:
        result = cluster_instincts([_principle(type_="tool_use")])
        assert len(result.command) == 1

    def test_preference_type_routes_to_command(self) -> None:
        result = cluster_instincts([_principle(type_="preference")])
        assert len(result.command) == 1

    def test_decision_type_routes_to_agent(self) -> None:
        result = cluster_instincts([_principle(type_="decision")])
        assert len(result.agent) == 1

    def test_problem_type_routes_to_agent(self) -> None:
        result = cluster_instincts([_principle(type_="problem")])
        assert len(result.agent) == 1

    def test_milestone_type_routes_to_template(self) -> None:
        result = cluster_instincts([_principle(type_="milestone")])
        assert len(result.template) == 1


class TestClusterInstinctsKeywordFallback:
    """Unrecognised types fall back to keyword scoring."""

    def test_workflow_keywords_route_to_skill(self) -> None:
        p = _principle(
            type_="bugfix",
            description="multi-step workflow pipeline",
            action="orchestrate the sequence",
        )
        result = cluster_instincts([p])
        assert len(result.skill) == 1

    def test_command_keywords_route_to_command(self) -> None:
        p = _principle(
            type_="bugfix",
            description="run validate and format",
            action="execute the build check",
        )
        result = cluster_instincts([p])
        assert len(result.command) == 1

    def test_agent_keywords_route_to_agent(self) -> None:
        p = _principle(
            type_="bugfix",
            description="subagent reviewer evaluator",
            action="the agent role specialist",
        )
        result = cluster_instincts([p])
        assert len(result.agent) == 1

    def test_template_keywords_route_to_template(self) -> None:
        p = _principle(
            type_="bugfix",
            description="template scaffold structure",
            action="frontmatter schema shape",
        )
        result = cluster_instincts([p])
        assert len(result.template) == 1

    def test_no_keywords_defaults_to_command(self) -> None:
        p = _principle(
            type_="bugfix",
            description="something generic",
            action="do a thing",
            evidence="none",
        )
        result = cluster_instincts([p])
        assert len(result.command) == 1


class TestClusterInstinctsNoCrossTargetLeakage:
    """Same instinct cluster routes to different targets; no leakage."""

    def test_mixed_types_no_leakage(self) -> None:
        principles = [
            _principle(type_="discovery", name="p1"),
            _principle(type_="tool_use", name="p2"),
            _principle(type_="decision", name="p3"),
            _principle(type_="milestone", name="p4"),
        ]
        result = cluster_instincts(principles)
        assert len(result.skill) == 1
        assert len(result.command) == 1
        assert len(result.agent) == 1
        assert len(result.template) == 1
        all_names = (
            [p.name for p in result.skill]
            + [p.name for p in result.command]
            + [p.name for p in result.agent]
            + [p.name for p in result.template]
        )
        assert len(all_names) == len(set(all_names))

    def test_total_count_preserved(self) -> None:
        principles = [
            _principle(type_="discovery", name="p1"),
            _principle(type_="discovery", name="p2"),
            _principle(type_="tool_use", name="p3"),
            _principle(type_="decision", name="p4"),
            _principle(type_="decision", name="p5"),
            _principle(type_="milestone", name="p6"),
        ]
        result = cluster_instincts(principles)
        total = len(result.skill) + len(result.command) + len(result.agent) + len(result.template)
        assert total == 6

    def test_each_principle_appears_exactly_once(self) -> None:
        principles = [_principle(type_="feature", name=f"p{i}") for i in range(5)]
        result = cluster_instincts(principles)
        all_principles = (
            list(result.skill) + list(result.command) + list(result.agent) + list(result.template)
        )
        assert len(all_principles) == 5
        assert all(p in all_principles for p in principles)


class TestClusterInstinctsEdgeCases:
    """Edge cases: empty input, single item, all-same-target."""

    def test_empty_input(self) -> None:
        result = cluster_instincts([])
        assert result == ClusterResult(skill=(), command=(), agent=(), template=())

    def test_single_principle(self) -> None:
        result = cluster_instincts([_principle(type_="decision")])
        assert len(result.agent) == 1
        assert len(result.skill) == 0
        assert len(result.command) == 0
        assert len(result.template) == 0

    def test_all_same_target(self) -> None:
        principles = [_principle(type_="tool_use", name=f"p{i}") for i in range(4)]
        result = cluster_instincts(principles)
        assert len(result.command) == 4
        assert len(result.skill) == 0
        assert len(result.agent) == 0
        assert len(result.template) == 0

    def test_result_is_frozen(self) -> None:
        result = cluster_instincts([])
        with pytest.raises(AttributeError):
            result.skill = ()  # type: ignore[misc]

    def test_deterministic_across_calls(self) -> None:
        principles = [
            _principle(type_="discovery", name="p1"),
            _principle(type_="tool_use", name="p2"),
            _principle(type_="decision", name="p3"),
        ]
        r1 = cluster_instincts(principles)
        r2 = cluster_instincts(principles)
        assert r1 == r2
