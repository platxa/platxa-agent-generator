"""Behavioural-eval scenario runner.

Executes eval scenarios against agents and computes pass@k metrics.
The executor is injectable — defaults to subprocess-based ``claude -p``
invocation but accepts any callable for testing and alternative
dispatch mechanisms (e.g. the Claude Code Task tool in agent context).

The run-trace schema matches the contract documented in
``agents/cluster-failures.md`` so ``cluster_failures`` can read traces
written by this module without a version adapter.

Public surface:
    * :class:`ScenarioResult` — one execution of a scenario
    * :func:`run_scenario` — execute a scenario k times, return the last result
    * :func:`pass_at_k` — compute pass@k metric via a generator callable
    * :func:`write_run_history` — persist a run trace to the history directory
"""

from __future__ import annotations

import json
import subprocess
import time
import typing
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from .eval_scenario import EvalScenario

VerdictType = Literal["passed", "failed"]
VERDICTS: frozenset[str] = frozenset(typing.get_args(VerdictType))

DEFAULT_HISTORY_DIR = ".claude/evals/history"

__all__ = [
    "DEFAULT_HISTORY_DIR",
    "EvalRunnerError",
    "ScenarioResult",
    "VERDICTS",
    "VerdictType",
    "pass_at_k",
    "run_scenario",
    "write_run_history",
]


class EvalRunnerError(RuntimeError):
    """Raised when scenario execution fails unrecoverably."""


@dataclass
class ScenarioResult:
    """One execution of a scenario through the eval runner.

    Field names match the run-trace schema from
    ``agents/cluster-failures.md`` so traces round-trip without
    translation.
    """

    scenario_path: str | None
    prompt: str
    verdict: VerdictType
    duration_ms: int
    tool_calls: list[str]
    result: str
    timestamp: str
    error: str | None
    axis: str
    scenario_type: str

    def __post_init__(self) -> None:
        if self.verdict not in VERDICTS:
            raise ValueError(f"verdict must be one of {sorted(VERDICTS)}, got {self.verdict!r}")
        if self.duration_ms < 0:
            raise ValueError(f"duration_ms must be non-negative, got {self.duration_ms}")
        if not isinstance(self.timestamp, str) or not self.timestamp.strip():
            raise ValueError("timestamp must be a non-empty ISO-8601 string")
        if self.scenario_type not in ("regression", "capability"):
            raise ValueError(
                f"scenario_type must be 'regression' or 'capability', got {self.scenario_type!r}"
            )

    def to_dict(self) -> dict[str, object]:
        """Serialize to a dict matching the run-trace JSON schema."""
        return asdict(self)


def _default_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
    """Execute a scenario prompt via ``claude -p`` subprocess."""
    cmd: list[str] = ["claude", "-p", prompt]
    for tool in forbidden_tools:
        cmd.extend(["--disallowedTools", tool])
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return completed.stdout
    except subprocess.TimeoutExpired as exc:
        raise EvalRunnerError("scenario execution timed out after 120s") from exc
    except FileNotFoundError as exc:
        raise EvalRunnerError(
            "claude CLI not found; install Claude Code or provide a custom executor"
        ) from exc


def _check_criteria(scenario: EvalScenario, output: str) -> tuple[bool, str | None]:
    """Check output against all success_criteria via substring matching.

    Returns ``(passed, error_message)``.  Uses case-insensitive
    substring matching as a baseline evaluator.
    """
    lower_output = output.lower()
    for criterion in scenario.success_criteria:
        if criterion.lower() not in lower_output:
            return False, f"criterion not met: {criterion!r}"
    return True, None


def run_scenario(
    scenario: EvalScenario,
    *,
    k: int = 1,
    save_history: bool = False,
    executor: Callable[[str, tuple[str, ...]], str] | None = None,
    history_dir: str | Path = DEFAULT_HISTORY_DIR,
    scenario_path: str | None = None,
) -> ScenarioResult:
    """Execute a scenario and return the result.

    Runs the scenario *k* times; returns the last
    :class:`ScenarioResult`.  When *save_history* is ``True``, each
    run trace is written to *history_dir* in the schema
    ``cluster_failures`` expects.

    Args:
        scenario: The eval scenario to run.
        k: Number of times to execute.  Returns the last result.
        save_history: Write run traces to disk.
        executor: ``Callable(prompt, forbidden_tools) → output``.
            Defaults to subprocess ``claude -p``.
        history_dir: Directory for run trace JSON files.
        scenario_path: Optional path to the source YAML file.

    Raises:
        EvalRunnerError: On unrecoverable execution failure.
        ValueError: If *k* < 1.
    """
    if k < 1:
        raise ValueError(f"k must be >= 1, got {k}")

    if executor is None:
        executor = _default_executor

    prompt = scenario.prompt
    last_result: ScenarioResult | None = None

    for _ in range(k):
        start = time.monotonic()
        error_msg: str | None = None
        output = ""

        try:
            output = executor(prompt, scenario.forbidden_tools)
            passed, error_msg = _check_criteria(scenario, output)
        except EvalRunnerError:
            raise
        except Exception as exc:
            passed = False
            error_msg = str(exc)

        elapsed_ms = int((time.monotonic() - start) * 1000)
        timestamp = datetime.now(timezone.utc).isoformat()

        last_result = ScenarioResult(
            scenario_path=scenario_path,
            prompt=prompt,
            verdict="passed" if passed else "failed",
            duration_ms=elapsed_ms,
            tool_calls=[],
            result=output,
            timestamp=timestamp,
            error=error_msg,
            axis=scenario.axis,
            scenario_type=scenario.type,
        )

        if save_history:
            write_run_history(last_result, history_dir)

    assert last_result is not None  # k >= 1 guaranteed above
    return last_result


def write_run_history(
    result: ScenarioResult, history_dir: str | Path = DEFAULT_HISTORY_DIR
) -> Path:
    """Write a single run trace to the history directory.

    Persists *result* as ``run-{timestamp}.json`` under *history_dir*,
    creating intermediate directories as needed.  The JSON schema
    matches the contract consumed by ``cluster_failures``.

    Returns the path to the written file.
    """
    dir_path = Path(history_dir)
    dir_path.mkdir(parents=True, exist_ok=True)

    timestamp_slug = result.timestamp.replace(":", "-").replace("+", "p")
    filename = f"run-{timestamp_slug}.json"
    trace_path = dir_path / filename

    trace_path.write_text(
        json.dumps(result.to_dict(), indent=2) + "\n",
        encoding="utf-8",
    )
    return trace_path


def pass_at_k(
    scenario: EvalScenario,
    k: int,
    generator_fn: Callable[[EvalScenario], ScenarioResult],
) -> float:
    """Compute the pass@k metric for a scenario.

    Calls ``generator_fn(scenario)`` *k* times and returns the
    fraction of runs with verdict ``"passed"``.

    Raises:
        ValueError: If *k* < 1.
    """
    if k < 1:
        raise ValueError(f"k must be >= 1, got {k}")

    passed_count = sum(1 for _ in range(k) if generator_fn(scenario).verdict == "passed")
    return passed_count / k
