"""Typed loader for ``templates/mutation-operators.yaml``.

The YAML at ``templates/mutation-operators.yaml`` is the single source of
truth for the 6 mutation operators used by the PromptBreeder-style
evolution pipeline (``agents/prompt-evolver.md``).  This module loads that
file into a strongly-typed dataclass tree with hard invariants enforced
in ``__post_init__`` so the prompt-evolver and any future consumer cannot
silently operate on malformed or drifted operator definitions.

The dataclass-with-validation pattern mirrors
:mod:`platxa_agent_generator.evaluation_criteria`.

Invariants enforced:
    * exactly :data:`OPERATOR_COUNT` operators (6)
    * operator names unique and ∈ :data:`KNOWN_OPERATOR_NAMES`
    * scope ∈ :data:`SCOPES`
    * description and rules are non-empty strings
"""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

Scope = Literal["additive", "subtractive", "neutral"]

SCOPES: frozenset[str] = frozenset(typing.get_args(Scope))

KNOWN_OPERATOR_NAMES: frozenset[str] = frozenset(
    {
        "synonym",
        "restructure",
        "contextualize",
        "simplify",
        "expand",
        "compress",
    }
)

OPERATOR_COUNT: int = 6


class MutationOperatorError(ValueError):
    """Raised when mutation-operators.yaml violates a hard invariant."""


@dataclass(frozen=True)
class MutationOperator:
    """One mutation operator from the registry."""

    name: str
    description: str
    scope: Scope
    rules: str

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name.strip():
            raise MutationOperatorError(
                f"operator name must be a non-empty string, got {self.name!r}"
            )
        if self.name not in KNOWN_OPERATOR_NAMES:
            raise MutationOperatorError(
                f"unknown operator name {self.name!r}; "
                f"must be one of {sorted(KNOWN_OPERATOR_NAMES)}"
            )
        if not isinstance(self.description, str) or not self.description.strip():
            raise MutationOperatorError(
                f"operator {self.name!r} description must be a non-empty string"
            )
        if self.scope not in SCOPES:
            raise MutationOperatorError(
                f"operator {self.name!r} scope must be one of {sorted(SCOPES)}, got {self.scope!r}"
            )
        if not isinstance(self.rules, str) or not self.rules.strip():
            raise MutationOperatorError(f"operator {self.name!r} rules must be a non-empty string")

    def describe(self) -> str:
        """Return a human-readable summary of the operator."""
        return f"{self.name} ({self.scope}): {self.description}"

    def apply(self, content: str) -> str:
        """Build a Task-dispatchable prompt for this mutation operator.

        Returns the prompt string a caller should pass as the ``prompt``
        field of a Task tool invocation.  The prompt instructs the
        subagent to apply this operator's rules to ``content`` and return
        the mutated result as a markdown code block.
        """
        return (
            f"Apply the **{self.name}** mutation operator to the agent "
            f"prompt body below.\n\n"
            f"## Operator rules\n\n{self.rules}\n\n"
            f"## Scope\n\n"
            f"This operator is **{self.scope}**.\n\n"
            f"## Instructions\n\n"
            f"Return the complete mutated agent file content as a single "
            f"markdown code block.  Preserve frontmatter `name`, "
            f"`description`, and `tools` fields exactly.  Mutate only "
            f"the prompt body according to the rules above.\n\n"
            f"## Agent content\n\n```markdown\n{content}\n```"
        )


@dataclass(frozen=True)
class MutationRegistry:
    """The full 6-operator mutation registry."""

    operators: tuple[MutationOperator, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not isinstance(self.operators, tuple) or not all(
            isinstance(op, MutationOperator) for op in self.operators
        ):
            raise MutationOperatorError("operators must be a tuple of MutationOperator instances")
        if len(self.operators) != OPERATOR_COUNT:
            raise MutationOperatorError(
                f"registry must contain exactly {OPERATOR_COUNT} operators, "
                f"got {len(self.operators)}"
            )
        names = [op.name for op in self.operators]
        if len(set(names)) != len(names):
            duplicates = sorted({n for n in names if names.count(n) > 1})
            raise MutationOperatorError(f"duplicate operator names: {duplicates}")
        missing = sorted(KNOWN_OPERATOR_NAMES - set(names))
        if missing:
            raise MutationOperatorError(f"registry is missing required operators: {missing}")

    def operator(self, name: str) -> MutationOperator:
        """Return the operator matching ``name`` or raise ``KeyError``."""
        for op in self.operators:
            if op.name == name:
                return op
        raise KeyError(name)

    def names(self) -> frozenset[str]:
        """Return the set of registered operator names."""
        return frozenset(op.name for op in self.operators)

    @classmethod
    def from_mapping(cls, data: Any) -> MutationRegistry:
        """Build a registry from a parsed YAML mapping.

        Raises :class:`MutationOperatorError` on any structural problem
        (missing keys, wrong types, unknown extra keys at the operator
        level).  Unknown top-level keys are tolerated so future schema
        additions do not break readers built against an older library.
        """
        if not isinstance(data, dict):
            raise MutationOperatorError(
                f"top-level YAML node must be a mapping, got {type(data).__name__}"
            )
        raw_operators = data.get("operators")
        if not isinstance(raw_operators, list) or not raw_operators:
            raise MutationOperatorError(
                "top-level mapping must contain a non-empty 'operators' list"
            )
        operators: list[MutationOperator] = []
        allowed_keys = {"name", "description", "scope", "rules"}
        for index, raw in enumerate(raw_operators):
            if not isinstance(raw, dict):
                raise MutationOperatorError(
                    f"operators[{index}] must be a mapping, got {type(raw).__name__}"
                )
            extra = set(raw.keys()) - allowed_keys
            if extra:
                raise MutationOperatorError(f"operators[{index}] has unknown keys: {sorted(extra)}")
            missing = allowed_keys - set(raw.keys())
            if missing:
                raise MutationOperatorError(
                    f"operators[{index}] is missing keys: {sorted(missing)}"
                )
            operators.append(
                MutationOperator(
                    name=raw["name"],
                    description=raw["description"],
                    scope=raw["scope"],
                    rules=raw["rules"],
                )
            )
        return cls(operators=tuple(operators))

    @classmethod
    def from_yaml(cls, path: Path | str) -> MutationRegistry:
        """Load and validate a registry from a YAML file path.

        Wraps :class:`yaml.YAMLError` in :class:`MutationOperatorError`
        so callers handle a single exception type for every
        parse-or-validate failure.
        """
        text = Path(path).read_text(encoding="utf-8")
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            raise MutationOperatorError(f"failed to parse {path!s} as YAML: {exc}") from exc
        return cls.from_mapping(data)

    @classmethod
    def load_default(cls) -> MutationRegistry:
        """Load the canonical ``templates/mutation-operators.yaml``."""
        return cls.from_yaml(default_operators_path())


def default_operators_path() -> Path:
    """Return the canonical path to ``templates/mutation-operators.yaml``.

    Resolves relative to ``__file__`` so both editable installs and
    site-packages installs work (same rationale as
    :func:`evaluation_criteria.default_rubric_path`).
    """
    return Path(__file__).resolve().parent / "templates" / "mutation-operators.yaml"
