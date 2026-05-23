"""Promotion gate for the continuous-learning pipeline.

Decides whether a candidate instinct has accumulated enough evidence
(occurrences, confidence, successful outcomes) to be promoted into a
reusable artifact (skill, command, agent, or template).

The three-gate threshold is read from ``PLATXA_PROMOTION_THRESHOLDS``
when set (JSON object), falling back to conservative defaults:
``occurrences >= 3``, ``confidence >= 0.7``, ``success_count >= 1``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

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


__all__ = [
    "DEFAULT_CONFIDENCE",
    "DEFAULT_OCCURRENCES",
    "DEFAULT_SUCCESS_COUNT",
    "PromotionConfigError",
    "PromotionResult",
    "PromotionThresholds",
    "promote",
]
