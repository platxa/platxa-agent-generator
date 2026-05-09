"""Typed loader for ``templates/evaluation-criteria.yaml``.

The YAML at ``templates/evaluation-criteria.yaml`` is the single source of
truth for the 6-axis agent-quality rubric (clarity, completeness,
tool_design, examples, security, documentation). This module loads that
file into a strongly-typed dataclass tree with hard invariants enforced
in ``__post_init__`` so downstream readers (``quality_scorer.py`` and the
``validation-subagent`` codegen path) cannot silently consume malformed
or drifted criteria.

The dataclass-with-validation pattern mirrors
:mod:`platxa_agent_generator.observation_store` to keep the dependency
surface narrow — pyyaml is the only runtime addition. (pydantic is
present in some venvs transitively but is intentionally NOT a project
dependency; matching the in-repo dataclass style avoids an undeclared
import.)

Invariants enforced:
    * exactly :data:`AXIS_COUNT` axes (6)
    * axis names unique and ∈ :data:`KNOWN_AXIS_NAMES`
    * weights are floats in (0.0, 1.0] and sum to 1.0 within
      :data:`WEIGHT_SUM_TOLERANCE`
    * severity_on_unmet ∈ :data:`SEVERITIES`
    * criteria description is a non-empty string
"""

from __future__ import annotations

import math
import typing
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]

# Derived from the Literal so the runtime guard and the static type
# cannot drift. Same pattern as observation_store.OBSERVATION_TYPES.
SEVERITIES: frozenset[str] = frozenset(typing.get_args(Severity))

KNOWN_AXIS_NAMES: frozenset[str] = frozenset(
    {
        "clarity",
        "completeness",
        "tool_design",
        "examples",
        "security",
        "documentation",
    }
)

AXIS_COUNT: int = 6
WEIGHT_SUM_TOLERANCE: float = 1e-9


class EvaluationRubricValidationError(ValueError):
    """Raised when evaluation-criteria.yaml violates a hard invariant."""


@dataclass(frozen=True)
class EvaluationAxis:
    """One scoring axis from the rubric."""

    name: str
    weight: float
    severity_on_unmet: Severity
    criteria: str

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name.strip():
            raise EvaluationRubricValidationError(
                f"axis name must be a non-empty string, got {self.name!r}"
            )
        if self.name not in KNOWN_AXIS_NAMES:
            raise EvaluationRubricValidationError(
                f"unknown axis name {self.name!r}; must be one of {sorted(KNOWN_AXIS_NAMES)}"
            )
        if not isinstance(self.weight, (int, float)) or isinstance(self.weight, bool):
            raise EvaluationRubricValidationError(
                f"axis {self.name!r} weight must be numeric, got {self.weight!r}"
            )
        if not (0.0 < float(self.weight) <= 1.0):
            raise EvaluationRubricValidationError(
                f"axis {self.name!r} weight must be in (0.0, 1.0], got {self.weight!r}"
            )
        if self.severity_on_unmet not in SEVERITIES:
            raise EvaluationRubricValidationError(
                f"axis {self.name!r} severity_on_unmet must be one of "
                f"{sorted(SEVERITIES)}, got {self.severity_on_unmet!r}"
            )
        if not isinstance(self.criteria, str) or not self.criteria.strip():
            raise EvaluationRubricValidationError(
                f"axis {self.name!r} criteria must be a non-empty string"
            )


@dataclass(frozen=True)
class EvaluationRubric:
    """The full 6-axis evaluation rubric."""

    axes: tuple[EvaluationAxis, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not isinstance(self.axes, tuple) or not all(
            isinstance(a, EvaluationAxis) for a in self.axes
        ):
            raise EvaluationRubricValidationError(
                "axes must be a tuple of EvaluationAxis instances"
            )
        if len(self.axes) != AXIS_COUNT:
            raise EvaluationRubricValidationError(
                f"rubric must contain exactly {AXIS_COUNT} axes, got {len(self.axes)}"
            )
        names = [a.name for a in self.axes]
        if len(set(names)) != len(names):
            duplicates = sorted({n for n in names if names.count(n) > 1})
            raise EvaluationRubricValidationError(f"duplicate axis names: {duplicates}")
        missing = sorted(KNOWN_AXIS_NAMES - set(names))
        if missing:
            raise EvaluationRubricValidationError(f"rubric is missing required axes: {missing}")
        total = math.fsum(a.weight for a in self.axes)
        if not math.isclose(total, 1.0, abs_tol=WEIGHT_SUM_TOLERANCE):
            raise EvaluationRubricValidationError(
                f"sum of axis weights must equal 1.0 within {WEIGHT_SUM_TOLERANCE}, got {total!r}"
            )

    def axis(self, name: str) -> EvaluationAxis:
        """Return the axis matching ``name`` or raise ``KeyError``."""
        for a in self.axes:
            if a.name == name:
                return a
        raise KeyError(name)

    def weights(self) -> dict[str, float]:
        """Return ``{axis_name: weight}`` for downstream consumers."""
        return {a.name: a.weight for a in self.axes}

    @classmethod
    def from_mapping(cls, data: Any) -> EvaluationRubric:
        """Build a rubric from a parsed YAML mapping.

        Raises :class:`EvaluationRubricValidationError` on any structural
        problem (missing keys, wrong types, unknown extra keys at the axis
        level). Unknown top-level keys are tolerated so future schema
        additions do not break readers built against an older library.
        """
        if not isinstance(data, dict):
            raise EvaluationRubricValidationError(
                f"top-level YAML node must be a mapping, got {type(data).__name__}"
            )
        raw_axes = data.get("axes")
        if not isinstance(raw_axes, list) or not raw_axes:
            raise EvaluationRubricValidationError(
                "top-level mapping must contain a non-empty 'axes' list"
            )
        axes: list[EvaluationAxis] = []
        allowed_keys = {"name", "weight", "severity_on_unmet", "criteria"}
        for index, raw in enumerate(raw_axes):
            if not isinstance(raw, dict):
                raise EvaluationRubricValidationError(
                    f"axes[{index}] must be a mapping, got {type(raw).__name__}"
                )
            extra = set(raw.keys()) - allowed_keys
            if extra:
                raise EvaluationRubricValidationError(
                    f"axes[{index}] has unknown keys: {sorted(extra)}"
                )
            missing = allowed_keys - set(raw.keys())
            if missing:
                raise EvaluationRubricValidationError(
                    f"axes[{index}] is missing keys: {sorted(missing)}"
                )
            axes.append(
                EvaluationAxis(
                    name=raw["name"],
                    weight=raw["weight"],
                    severity_on_unmet=raw["severity_on_unmet"],
                    criteria=raw["criteria"],
                )
            )
        return cls(axes=tuple(axes))

    @classmethod
    def from_yaml(cls, path: Path | str) -> EvaluationRubric:
        """Load and validate a rubric from a YAML file path.

        Wraps :class:`yaml.YAMLError` in
        :class:`EvaluationRubricValidationError` so callers handle a single
        exception type for every parse-or-validate failure.
        """
        text = Path(path).read_text(encoding="utf-8")
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            raise EvaluationRubricValidationError(
                f"failed to parse {path!s} as YAML: {exc}"
            ) from exc
        return cls.from_mapping(data)

    @classmethod
    def load_default(cls) -> EvaluationRubric:
        """Load the canonical ``templates/evaluation-criteria.yaml``.

        Resolves the path relative to the project root (the directory two
        levels above this module: ``src/platxa_agent_generator/`` → repo).
        """
        return cls.from_yaml(default_rubric_path())


def default_rubric_path() -> Path:
    """Return the canonical path to ``templates/evaluation-criteria.yaml``.

    The YAML lives inside the package (``src/platxa_agent_generator/templates/``)
    so that wheel installs ship it alongside the Python module — a top-level
    ``templates/`` directory at the repo root is not included by hatch's default
    wheel target (``packages = ["src/platxa_agent_generator"]``) and would
    raise ``FileNotFoundError`` from :meth:`load_default` after a non-editable
    ``pip install``. Resolving relative to ``__file__`` keeps editable installs
    and site-packages installs both working.
    """
    return Path(__file__).resolve().parent / "templates" / "evaluation-criteria.yaml"
