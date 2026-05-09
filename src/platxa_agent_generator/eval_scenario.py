"""Typed loader for behavioural-eval scenario YAML files.

Each YAML file under ``templates/eval-scenarios/`` (and any user-supplied
path) describes one held-out or capability scenario for the agent-eval
harness. This module is the single source of truth for the scenario
schema; downstream readers (the eval CLI, ``cluster_failures``, the
``gan-evaluator``) consume it through the typed model below so a drifted
field cannot silently corrupt a run.

The dataclass-with-validation pattern mirrors
:mod:`platxa_agent_generator.evaluation_criteria` and
:mod:`platxa_agent_generator.observation_store` to keep the dependency
surface narrow — pyyaml is the only runtime addition. (pydantic is
present in some venvs transitively but is intentionally NOT a project
dependency; matching the in-repo dataclass style avoids an undeclared
import. The feature spec phrase "Pydantic model" describes the
*behaviour* — strongly-typed validation that rejects malformed input —
not the implementation library.)

The "binary criterion" rule from the Demystifying Evals article is
encoded structurally: ``success_criteria`` MUST be a non-empty tuple of
strings, each of which is meant to be checked as PASS / FAIL by the
grader. Numeric or graded criteria belong in the rubric
(:mod:`platxa_agent_generator.evaluation_criteria`), not here.

Invariants enforced:
    * ``prompt`` is a non-empty string
    * ``forbidden_tools`` is a tuple of non-empty strings (may be empty)
    * ``success_criteria`` is a non-empty tuple of non-empty strings
    * ``axis`` is a non-empty string (NOT constrained to the 6-axis
      rubric — capability scenarios may target axes such as
      ``correctness`` / ``robustness`` that live outside that rubric)
    * ``type`` ∈ :data:`SCENARIO_TYPES` (``regression`` | ``capability``)
    * ``regression_baseline`` is required (non-empty string) when
      ``type == "regression"``; optional otherwise
"""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

ScenarioType = Literal["regression", "capability"]

# Derived from the Literal so the runtime guard and the static type
# cannot drift. Same pattern as observation_store.OBSERVATION_TYPES and
# evaluation_criteria.SEVERITIES.
SCENARIO_TYPES: frozenset[str] = frozenset(typing.get_args(ScenarioType))


class EvalScenarioValidationError(ValueError):
    """Raised when a scenario YAML violates a hard invariant."""


@dataclass(frozen=True)
class EvalScenario:
    """One behavioural-eval scenario loaded from a YAML file.

    Construct directly to validate an in-memory payload, or use
    :meth:`from_mapping` / :meth:`from_yaml` to load from a parsed dict
    or file path.
    """

    prompt: str
    success_criteria: tuple[str, ...]
    axis: str
    type: ScenarioType
    forbidden_tools: tuple[str, ...] = field(default_factory=tuple)
    regression_baseline: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.prompt, str) or not self.prompt.strip():
            raise EvalScenarioValidationError(
                f"prompt must be a non-empty string, got {self.prompt!r}"
            )

        if not isinstance(self.forbidden_tools, tuple) or not all(
            isinstance(t, str) for t in self.forbidden_tools
        ):
            raise EvalScenarioValidationError(
                "forbidden_tools must be a tuple of strings, "
                f"got {type(self.forbidden_tools).__name__}"
            )
        for tool in self.forbidden_tools:
            if not tool.strip():
                raise EvalScenarioValidationError(
                    "forbidden_tools entries must be non-empty strings"
                )

        if not isinstance(self.success_criteria, tuple) or not all(
            isinstance(c, str) for c in self.success_criteria
        ):
            raise EvalScenarioValidationError(
                "success_criteria must be a tuple of strings, "
                f"got {type(self.success_criteria).__name__}"
            )
        if not self.success_criteria:
            raise EvalScenarioValidationError(
                "success_criteria must contain at least one binary check; "
                "scenarios without binary criteria are rejected by the "
                "two-domain-experts-must-agree rule (Demystifying Evals)"
            )
        for criterion in self.success_criteria:
            if not criterion.strip():
                raise EvalScenarioValidationError(
                    "success_criteria entries must be non-empty strings"
                )

        if not isinstance(self.axis, str) or not self.axis.strip():
            raise EvalScenarioValidationError(f"axis must be a non-empty string, got {self.axis!r}")

        if self.type not in SCENARIO_TYPES:
            raise EvalScenarioValidationError(
                f"type must be one of {sorted(SCENARIO_TYPES)}, got {self.type!r}"
            )

        if self.regression_baseline is not None and not isinstance(self.regression_baseline, str):
            raise EvalScenarioValidationError(
                "regression_baseline must be a string or None, "
                f"got {type(self.regression_baseline).__name__}"
            )
        if self.type == "regression":
            if not self.regression_baseline or not self.regression_baseline.strip():
                raise EvalScenarioValidationError(
                    "regression scenarios require a non-empty regression_baseline "
                    "(output hash); use type='capability' for scenarios without a "
                    "known baseline"
                )

    @classmethod
    def from_mapping(cls, data: Any) -> EvalScenario:
        """Build a scenario from a parsed YAML mapping.

        Raises :class:`EvalScenarioValidationError` on any structural
        problem (wrong top-level type, missing required keys, unknown
        extra keys). Strict-key handling matches
        :meth:`evaluation_criteria.EvaluationRubric.from_mapping` so the
        two loaders behave consistently.
        """
        if not isinstance(data, dict):
            raise EvalScenarioValidationError(
                f"top-level YAML node must be a mapping, got {type(data).__name__}"
            )

        required_keys = {"prompt", "success_criteria", "axis", "type"}
        optional_keys = {"forbidden_tools", "regression_baseline"}
        allowed_keys = required_keys | optional_keys

        missing = required_keys - set(data.keys())
        if missing:
            raise EvalScenarioValidationError(
                f"scenario is missing required keys: {sorted(missing)}"
            )
        extra = set(data.keys()) - allowed_keys
        if extra:
            raise EvalScenarioValidationError(f"scenario has unknown keys: {sorted(extra)}")

        raw_forbidden = data.get("forbidden_tools", [])
        if not isinstance(raw_forbidden, list):
            raise EvalScenarioValidationError(
                f"forbidden_tools must be a YAML list, got {type(raw_forbidden).__name__}"
            )
        raw_criteria = data["success_criteria"]
        if not isinstance(raw_criteria, list):
            raise EvalScenarioValidationError(
                f"success_criteria must be a YAML list, got {type(raw_criteria).__name__}"
            )

        return cls(
            prompt=data["prompt"],
            success_criteria=tuple(raw_criteria),
            axis=data["axis"],
            type=data["type"],
            forbidden_tools=tuple(raw_forbidden),
            regression_baseline=data.get("regression_baseline"),
        )

    @classmethod
    def from_yaml(cls, path: Path | str) -> EvalScenario:
        """Load and validate a scenario from a YAML file path.

        Wraps :class:`yaml.YAMLError` in
        :class:`EvalScenarioValidationError` so callers handle a single
        exception type for every parse-or-validate failure.
        """
        text = Path(path).read_text(encoding="utf-8")
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            raise EvalScenarioValidationError(f"failed to parse {path!s} as YAML: {exc}") from exc
        return cls.from_mapping(data)
