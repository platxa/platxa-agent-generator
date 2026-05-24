"""Weight drift detector across evaluation-criteria.yaml, quality_scorer.py, and validation-subagent.md.

Compares criteria weights from three sources and emits a structured drift
report. Designed as a CI gate: exits non-zero when drift is detected.

Usage:
    python -m platxa_agent_generator.weight_drift_check
    python -m platxa_agent_generator.weight_drift_check --json
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

from platxa_agent_generator.evaluation_criteria import EvaluationRubric, default_rubric_path


@dataclass(frozen=True)
class WeightDivergence:
    """A single criterion whose weight differs between two sources."""

    criterion: str
    source_a: str
    source_b: str
    weight_a: float
    weight_b: float

    @property
    def delta(self) -> float:
        """Absolute difference between the two weights."""
        return abs(self.weight_a - self.weight_b)


@dataclass
class DriftReport:
    """Structured drift report across all weight sources."""

    yaml_path: str
    scorer_module: str
    agent_path: str
    divergences: list[WeightDivergence] = field(default_factory=list)

    @property
    def has_drift(self) -> bool:
        """True when at least one divergence was detected."""
        return len(self.divergences) > 0

    def to_dict(self) -> dict[str, object]:
        """Serialise for JSON output."""
        return {
            "yaml_path": self.yaml_path,
            "scorer_module": self.scorer_module,
            "agent_path": self.agent_path,
            "has_drift": self.has_drift,
            "divergences": [asdict(d) for d in self.divergences],
        }

    def summary(self) -> str:
        """Human-readable summary."""
        if not self.has_drift:
            return "No weight drift detected across all sources."
        lines = [f"Weight drift detected — {len(self.divergences)} divergence(s):"]
        for d in self.divergences:
            lines.append(
                f"  {d.criterion}: {d.source_a}={d.weight_a} vs {d.source_b}={d.weight_b} "
                f"(delta={d.delta:.4f})"
            )
        return "\n".join(lines)


def _resolve_agent_path() -> Path:
    """Locate ``agents/validation-subagent.md`` relative to the repo root."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    return repo_root / "agents" / "validation-subagent.md"


_WEIGHT_PATTERN = re.compile(
    r"\|\s*(?P<axis>\w+)\s*\|\s*(?P<weight>\d+\.\d+)\s*\|",
)


def parse_agent_weights(path: Path) -> dict[str, float]:
    """Extract hard-coded weight values from a markdown table in the agent file.

    Returns an empty dict when the agent correctly defers to the YAML
    (no weight table found).
    """
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    weights: dict[str, float] = {}
    for match in _WEIGHT_PATTERN.finditer(text):
        axis = match.group("axis").lower()
        weight_str = match.group("weight")
        try:
            weights[axis] = float(weight_str)
        except ValueError:
            continue
    return weights


def _load_scorer_weights() -> dict[str, float]:
    """Import ``CRITERIA_WEIGHTS`` from quality_scorer at call time."""
    from platxa_agent_generator.quality_scorer import CRITERIA_WEIGHTS

    return dict(CRITERIA_WEIGHTS)


def check_drift(
    *,
    yaml_path: Path | None = None,
    agent_path: Path | None = None,
) -> DriftReport:
    """Compare weights across the three canonical sources.

    Parameters
    ----------
    yaml_path:
        Override for ``templates/evaluation-criteria.yaml``.
    agent_path:
        Override for ``agents/validation-subagent.md``.
    """
    yaml_path = yaml_path or default_rubric_path()
    agent_path = agent_path or _resolve_agent_path()

    rubric = EvaluationRubric.from_yaml(yaml_path)
    yaml_weights = rubric.weights()
    scorer_weights = _load_scorer_weights()
    agent_weights = parse_agent_weights(agent_path)

    report = DriftReport(
        yaml_path=str(yaml_path),
        scorer_module="platxa_agent_generator.quality_scorer.CRITERIA_WEIGHTS",
        agent_path=str(agent_path),
    )

    for criterion, yaml_w in sorted(yaml_weights.items()):
        scorer_w = scorer_weights.get(criterion)
        if scorer_w is not None and scorer_w != yaml_w:
            report.divergences.append(
                WeightDivergence(
                    criterion=criterion,
                    source_a=str(yaml_path),
                    source_b="quality_scorer.CRITERIA_WEIGHTS",
                    weight_a=yaml_w,
                    weight_b=scorer_w,
                )
            )

        if criterion in agent_weights and agent_weights[criterion] != yaml_w:
            report.divergences.append(
                WeightDivergence(
                    criterion=criterion,
                    source_a=str(yaml_path),
                    source_b=str(agent_path),
                    weight_a=yaml_w,
                    weight_b=agent_weights[criterion],
                )
            )

    for criterion in sorted(set(scorer_weights) - set(yaml_weights)):
        report.divergences.append(
            WeightDivergence(
                criterion=criterion,
                source_a=str(yaml_path),
                source_b="quality_scorer.CRITERIA_WEIGHTS",
                weight_a=0.0,
                weight_b=scorer_weights[criterion],
            )
        )

    for criterion in sorted(set(agent_weights) - set(yaml_weights)):
        report.divergences.append(
            WeightDivergence(
                criterion=criterion,
                source_a=str(yaml_path),
                source_b=str(agent_path),
                weight_a=0.0,
                weight_b=agent_weights[criterion],
            )
        )

    return report


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns 0 on no drift, 1 on drift."""
    args = argv if argv is not None else sys.argv[1:]
    use_json = "--json" in args

    report = check_drift()

    if use_json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(report.summary())

    return 1 if report.has_drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
