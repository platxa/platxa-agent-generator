"""Promotion gate for the continuous-learning pipeline.

Decides whether a candidate instinct has accumulated enough evidence
(occurrences, confidence, successful outcomes) to be promoted into a
reusable artifact (skill, command, agent, or template).

The three-gate threshold is read from ``PLATXA_PROMOTION_THRESHOLDS``
when set (JSON object), falling back to conservative defaults:
``occurrences >= 3``, ``confidence >= 0.7``, ``success_count >= 1``.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from typing import Literal

from .observation_store import ObservationRecord

DistillOutcome = Literal["success", "failure"]

_ENV_KEY: str = "PLATXA_PROMOTION_THRESHOLDS"

DEFAULT_OCCURRENCES: int = 3
DEFAULT_CONFIDENCE: float = 0.7
DEFAULT_SUCCESS_COUNT: int = 1


class PromotionConfigError(ValueError):
    """Raised when ``PLATXA_PROMOTION_THRESHOLDS`` contains invalid JSON or values."""


@dataclass(frozen=True)
class PromotionThresholds:
    """Resolved promotion gate thresholds.

    All three gates use inclusive ``>=`` comparison.
    """

    occurrences: int = DEFAULT_OCCURRENCES
    confidence: float = DEFAULT_CONFIDENCE
    success_count: int = DEFAULT_SUCCESS_COUNT

    def __post_init__(self) -> None:
        if not isinstance(self.occurrences, int) or self.occurrences < 0:
            raise PromotionConfigError(
                f"occurrences must be a non-negative int, got {self.occurrences!r}"
            )
        if not isinstance(self.confidence, (int, float)) or not (0.0 <= self.confidence <= 1.0):
            raise PromotionConfigError(
                f"confidence must be a float in [0.0, 1.0], got {self.confidence!r}"
            )
        if not isinstance(self.success_count, int) or self.success_count < 0:
            raise PromotionConfigError(
                f"success_count must be a non-negative int, got {self.success_count!r}"
            )

    @classmethod
    def from_env(cls) -> PromotionThresholds:
        """Build thresholds from ``PLATXA_PROMOTION_THRESHOLDS`` env var.

        When the env var is unset or empty, returns the defaults. When
        set, the value must be a JSON object with zero or more of the
        three threshold keys — missing keys fall back to defaults.
        """
        raw = os.environ.get(_ENV_KEY, "").strip()
        if not raw:
            return cls()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise PromotionConfigError(f"{_ENV_KEY} is not valid JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise PromotionConfigError(
                f"{_ENV_KEY} must be a JSON object, got {type(data).__name__}"
            )
        try:
            occ = int(data["occurrences"]) if "occurrences" in data else DEFAULT_OCCURRENCES
            conf = float(data["confidence"]) if "confidence" in data else DEFAULT_CONFIDENCE
            sc = int(data["success_count"]) if "success_count" in data else DEFAULT_SUCCESS_COUNT
        except (ValueError, TypeError) as exc:
            raise PromotionConfigError(
                f"{_ENV_KEY} contains an unconvertible value: {exc}"
            ) from exc
        return cls(occurrences=occ, confidence=conf, success_count=sc)

    @classmethod
    def from_dict(cls, data: dict[str, int | float]) -> PromotionThresholds:
        """Build thresholds from a dict (e.g. orchestrator payload)."""
        try:
            occ = int(data["occurrences"]) if "occurrences" in data else DEFAULT_OCCURRENCES
            conf = float(data["confidence"]) if "confidence" in data else DEFAULT_CONFIDENCE
            sc = int(data["success_count"]) if "success_count" in data else DEFAULT_SUCCESS_COUNT
        except (ValueError, TypeError) as exc:
            raise PromotionConfigError(f"unconvertible threshold value: {exc}") from exc
        return cls(occurrences=occ, confidence=conf, success_count=sc)


@dataclass(frozen=True)
class PromotionResult:
    """Outcome of a single promotion gate check."""

    eligible: bool
    occurrences: int
    confidence: float
    success_count: int
    thresholds: PromotionThresholds
    failing_gates: tuple[str, ...]


def promote(
    *,
    occurrences: int,
    confidence: float,
    success_count: int,
    thresholds: PromotionThresholds | None = None,
) -> PromotionResult:
    """Evaluate whether a candidate crosses all three promotion gates.

    Returns a :class:`PromotionResult` with ``eligible=True`` only when
    all three gates pass simultaneously (inclusive ``>=``).

    When ``thresholds`` is ``None``, resolves from the environment via
    :meth:`PromotionThresholds.from_env`.
    """
    resolved = thresholds if thresholds is not None else PromotionThresholds.from_env()

    failing: list[str] = []
    if occurrences < resolved.occurrences:
        failing.append(f"occurrences={occurrences} below threshold of {resolved.occurrences}")
    if confidence < resolved.confidence:
        failing.append(f"confidence={confidence} below threshold of {resolved.confidence}")
    if success_count < resolved.success_count:
        failing.append(f"success_count={success_count} below threshold of {resolved.success_count}")

    return PromotionResult(
        eligible=len(failing) == 0,
        occurrences=occurrences,
        confidence=confidence,
        success_count=success_count,
        thresholds=resolved,
        failing_gates=tuple(failing),
    )


_NAME_MAX_LEN: int = 64
_DESC_MAX_LEN: int = 512
_DEFAULT_TTL_DAYS: int = 30


def _slugify(text: str, max_len: int = 48) -> str:
    """Convert arbitrary text to a hyphen-case slug safe for instinct names."""
    lowered = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug[:max_len]


def _short_hash(text: str) -> str:
    """Return an 8-char hex digest for uniqueness in instinct names."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


@dataclass(frozen=True)
class DistilledPrinciple:
    """A distilled principle ready for instinct template rendering.

    Fields align with the ``instinct.md.j2`` template inputs so callers
    can pass ``dataclasses.asdict(principle)`` directly to Jinja2.
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


_GUIDING_ACTION = (
    "Prefer this approach when {context}: {summary}. "
    "This pattern produced a successful outcome{outcome_detail}."
)

_CAUTIONARY_ACTION = (
    "Avoid this approach when {context}: {summary}. "
    "This pattern led to a negative outcome{outcome_detail}. "
    "Consider alternative strategies before proceeding."
)

_GUIDING_DESC = "Guiding: {summary}"
_CAUTIONARY_DESC = "Cautionary: {summary}"


def distill_principle(
    observation: ObservationRecord,
    outcome: DistillOutcome,
) -> DistilledPrinciple:
    """Transform an observation into a distilled principle with success/failure asymmetry.

    Guiding principles (``outcome="success"``) are forward-looking and
    prescriptive — they encourage repeating the observed pattern.
    Cautionary principles (``outcome="failure"``) are warning-focused and
    include a redirect toward alternatives.

    The two templates are structurally distinct per EvolveR research:
    unified distillation underperforms separate success/failure templates.
    """
    context = f"using {observation.tool} for {observation.type}"
    summary = observation.input_summary
    outcome_detail = f" — {observation.outcome}" if observation.outcome else ""

    if outcome == "success":
        action = _GUIDING_ACTION.format(
            context=context,
            summary=summary,
            outcome_detail=outcome_detail,
        )
        raw_desc = _GUIDING_DESC.format(summary=summary)
    else:
        action = _CAUTIONARY_ACTION.format(
            context=context,
            summary=summary,
            outcome_detail=outcome_detail,
        )
        raw_desc = _CAUTIONARY_DESC.format(summary=summary)

    tool_slug = _slugify(observation.tool, max_len=16)
    type_slug = _slugify(observation.type, max_len=12)
    content_hash = _short_hash(observation.input_summary + observation.timestamp + outcome)
    name = f"{type_slug}-{tool_slug}-{content_hash}"[:_NAME_MAX_LEN]

    examples_text = (
        "\n".join(f"- {ex}" for ex in observation.examples) if observation.examples else ""
    )

    return DistilledPrinciple(
        name=name,
        description=raw_desc[:_DESC_MAX_LEN],
        type=observation.type,
        confidence=observation.confidence,
        created=observation.timestamp,
        last_seen=observation.timestamp,
        action=action,
        evidence=observation.evidence,
        examples=examples_text,
        occurrences=1,
        success_count=1 if outcome == "success" else 0,
        usage_count=0,
        ttl_days=_DEFAULT_TTL_DAYS,
        project_scope=observation.project_id,
        outcome=outcome,
    )


__all__ = [
    "DEFAULT_CONFIDENCE",
    "DEFAULT_OCCURRENCES",
    "DEFAULT_SUCCESS_COUNT",
    "DistillOutcome",
    "DistilledPrinciple",
    "PromotionConfigError",
    "PromotionResult",
    "PromotionThresholds",
    "distill_principle",
    "promote",
]
