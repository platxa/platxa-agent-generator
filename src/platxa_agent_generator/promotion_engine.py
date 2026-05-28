"""Promotion target classification for the continuous-learning pipeline.

The promotion **gate** (threshold comparison) and the **distillation**
of raw observations into instinct files both live elsewhere now:

* The three-gate threshold check (``occurrences >= 3``,
  ``confidence >= 0.7``, ``success_count >= 1``) is owned by the
  ``instinct-promoter`` subagent (``agents/instinct-promoter.md``).
  The CLI dispatches the agent via
  ``commands.evolve._dispatch_instinct_promoter`` and the agent
  enforces the floors.
* Distillation (observation → instinct frontmatter) is handled by the
  observer pipeline; ``promotion_engine`` no longer touches raw
  ``ObservationRecord`` rows.

What remains here is the **target-classification** helper —
``cluster_instincts`` — which groups already-distilled principles by
their promotion target (``skill`` / ``command`` / ``agent`` /
``template``). The CLI does not call it directly; it is retained as a
Python utility for the test suite (``tests/test_promotion_engine.py``)
and any future Python caller that wants the same classification logic
the agent uses internally.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

DistillOutcome = Literal["success", "failure"]

DEFAULT_OCCURRENCES: int = 3
DEFAULT_CONFIDENCE: float = 0.7
DEFAULT_SUCCESS_COUNT: int = 1


@dataclass(frozen=True)
class DistilledPrinciple:
    """A distilled principle ready for target classification.

    Fields align with the instinct frontmatter the observer pipeline
    writes. The dataclass is preserved to keep ``cluster_instincts``'s
    public signature stable for test consumers.
    """

    name: str
    description: str
    type: str
    confidence: float
    created: str
    last_seen: str
    action: str
    evidence: str
    examples: str
    occurrences: int
    success_count: int
    usage_count: int
    ttl_days: int
    project_scope: str
    outcome: DistillOutcome


PromotionTarget = Literal["skill", "command", "agent", "template"]

PROMOTION_TARGETS: frozenset[str] = frozenset(("skill", "command", "agent", "template"))


@dataclass(frozen=True)
class ClusterResult:
    """Instincts grouped by promotion target."""

    skill: tuple[DistilledPrinciple, ...]
    command: tuple[DistilledPrinciple, ...]
    agent: tuple[DistilledPrinciple, ...]
    template: tuple[DistilledPrinciple, ...]


_WORKFLOW_KEYWORDS: frozenset[str] = frozenset(
    (
        "workflow",
        "pipeline",
        "sequence",
        "multi-step",
        "orchestrat",
        "phase",
        "stage",
        "chain",
        "compose",
        "coordinate",
    )
)

_COMMAND_KEYWORDS: frozenset[str] = frozenset(
    (
        "run",
        "execute",
        "invoke",
        "call",
        "trigger",
        "launch",
        "check",
        "list",
        "show",
        "get",
        "set",
        "create",
        "delete",
        "update",
        "validate",
        "format",
        "lint",
        "build",
        "deploy",
    )
)

_AGENT_KEYWORDS: frozenset[str] = frozenset(
    (
        "agent",
        "subagent",
        "reviewer",
        "evaluator",
        "analyzer",
        "inspector",
        "auditor",
        "specialist",
        "role",
        "judge",
    )
)

_TEMPLATE_KEYWORDS: frozenset[str] = frozenset(
    (
        "template",
        "scaffold",
        "skeleton",
        "schema",
        "shape",
        "frontmatter",
        "rubric",
        "config",
        "layout",
        "structure",
    )
)

_WORKFLOW_TYPES: frozenset[str] = frozenset(
    (
        "discovery",
        "feature",
        "refactor",
    )
)

_COMMAND_TYPES: frozenset[str] = frozenset(
    (
        "tool_use",
        "preference",
    )
)

_AGENT_TYPES: frozenset[str] = frozenset(
    (
        "decision",
        "problem",
    )
)

_TEMPLATE_TYPES: frozenset[str] = frozenset(("milestone",))


def _keyword_score(text: str, keywords: frozenset[str]) -> int:
    """Count how many keywords appear as whole-word prefixes in lowered text."""
    lowered = text.lower()
    return sum(1 for kw in keywords if re.search(rf"\b{re.escape(kw)}", lowered))


def _classify_target(principle: DistilledPrinciple) -> PromotionTarget:
    """Classify a single instinct to its promotion target.

    Uses a two-pass strategy: first check type-based rules (strong
    signal), then fall back to keyword scoring across the principle's
    description and action text.
    """
    obs_type = principle.type

    if obs_type in _WORKFLOW_TYPES:
        return "skill"
    if obs_type in _COMMAND_TYPES:
        return "command"
    if obs_type in _AGENT_TYPES:
        return "agent"
    if obs_type in _TEMPLATE_TYPES:
        return "template"

    searchable = f"{principle.description} {principle.action} {principle.evidence}"

    scores: dict[PromotionTarget, int] = {
        "skill": _keyword_score(searchable, _WORKFLOW_KEYWORDS),
        "command": _keyword_score(searchable, _COMMAND_KEYWORDS),
        "agent": _keyword_score(searchable, _AGENT_KEYWORDS),
        "template": _keyword_score(searchable, _TEMPLATE_KEYWORDS),
    }

    best_target: PromotionTarget = max(scores, key=lambda t: scores[t])
    if scores[best_target] == 0:
        return "command"

    return best_target


def cluster_instincts(
    principles: list[DistilledPrinciple],
) -> ClusterResult:
    """Group instincts by promotion target using target-specific rules.

    Each target type has distinct classification criteria:
    - skill: workflow patterns (multi-step sequences by type)
    - command: verb-noun phrases (single-action operations)
    - agent: tool combinations (subagent/role patterns)
    - template: frontmatter shapes (structural scaffolds)

    Every principle is assigned to exactly one target — no cross-target
    leakage. The assignment is deterministic for the same input.
    """
    buckets: dict[PromotionTarget, list[DistilledPrinciple]] = {
        "skill": [],
        "command": [],
        "agent": [],
        "template": [],
    }

    for principle in principles:
        target = _classify_target(principle)
        buckets[target].append(principle)

    return ClusterResult(
        skill=tuple(buckets["skill"]),
        command=tuple(buckets["command"]),
        agent=tuple(buckets["agent"]),
        template=tuple(buckets["template"]),
    )


__all__ = [
    "ClusterResult",
    "DEFAULT_CONFIDENCE",
    "DEFAULT_OCCURRENCES",
    "DEFAULT_SUCCESS_COUNT",
    "DistillOutcome",
    "DistilledPrinciple",
    "PROMOTION_TARGETS",
    "PromotionTarget",
    "cluster_instincts",
]
