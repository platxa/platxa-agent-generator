"""Tests for :mod:`platxa_agent_generator.eval_runner`.

Verification criteria for feature #27 (BEHAVIORAL_EVAL):
    1. Scenario fixture dispatches Task with correct prompt +
       tool restrictions.
    2. pass@k=5 with 3 success returns 0.6.

Additional coverage: ScenarioResult validation, history writing,
criteria evaluation, error handling.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import pytest

from platxa_agent_generator.eval_runner import (
    DEFAULT_HISTORY_DIR,
    EvalRunnerError,
    ScenarioResult,
    evaluate_exit,
    pass_at_k,
    run_scenario,
    write_run_history,
)
from platxa_agent_generator.eval_scenario import EvalScenario


def _make_scenario(**overrides: Any) -> EvalScenario:
    base: dict[str, Any] = {
        "prompt": "Implement add(a, b) returning a + b.",
        "success_criteria": ("module exposes add()",),
        "axis": "correctness",
        "type": "capability",
        "forbidden_tools": ("Edit", "Write"),
    }
    base.update(overrides)
    return EvalScenario(**base)


def _make_result(**overrides: Any) -> ScenarioResult:
    base: dict[str, Any] = {
        "scenario_path": None,
        "prompt": "test prompt",
        "verdict": "passed",
        "duration_ms": 100,
        "tool_calls": [],
        "result": "test output",
        "timestamp": "2026-05-24T12:00:00+00:00",
        "error": None,
        "axis": "correctness",
        "scenario_type": "capability",
    }
    base.update(overrides)
    return ScenarioResult(**base)


# --------------------------------------------------------------------------
# Verification criterion 1 — dispatches with correct prompt + tool restrictions
# --------------------------------------------------------------------------


class TestRunScenarioDispatch:
    """Verify executor receives the scenario's prompt and forbidden_tools."""

    def test_executor_receives_correct_prompt_and_forbidden_tools(self) -> None:
        scenario = _make_scenario()
        calls: list[tuple[str, tuple[str, ...]]] = []

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            calls.append((prompt, forbidden_tools))
            return "module exposes add()"

        run_scenario(scenario, executor=mock_executor)

        assert len(calls) == 1
        assert calls[0][0] == scenario.prompt
        assert calls[0][1] == scenario.forbidden_tools

    def test_executor_receives_empty_forbidden_tools_when_none_specified(self) -> None:
        scenario = _make_scenario(forbidden_tools=())
        calls: list[tuple[str, tuple[str, ...]]] = []

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            calls.append((prompt, forbidden_tools))
            return "module exposes add()"

        run_scenario(scenario, executor=mock_executor)

        assert calls[0][1] == ()

    def test_k_greater_than_one_calls_executor_k_times(self) -> None:
        scenario = _make_scenario()
        call_count = 0

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            nonlocal call_count
            call_count += 1
            return "module exposes add()"

        run_scenario(scenario, k=3, executor=mock_executor)
        assert call_count == 3

    def test_returns_last_result_when_k_greater_than_one(self) -> None:
        scenario = _make_scenario()
        outputs = iter(["module exposes add()", "no match", "module exposes add()"])

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return next(outputs)

        result = run_scenario(scenario, k=3, executor=mock_executor)
        assert result.verdict == "passed"

    def test_k_less_than_one_raises(self) -> None:
        scenario = _make_scenario()
        with pytest.raises(ValueError, match="k must be >= 1"):
            run_scenario(scenario, k=0, executor=lambda p, f: "")


# --------------------------------------------------------------------------
# Verification criterion 2 — pass@k=5 with 3 success returns 0.6
# --------------------------------------------------------------------------


class TestPassAtK:
    """Verify pass_at_k computes the correct pass rate."""

    def test_pass_at_k_5_with_3_success_returns_0_6(self) -> None:
        scenario = _make_scenario()
        verdicts = iter(["passed", "failed", "passed", "passed", "failed"])

        def gen(s: EvalScenario) -> ScenarioResult:
            return _make_result(verdict=next(verdicts))

        assert pass_at_k(scenario, 5, gen) == pytest.approx(0.6)

    def test_pass_at_k_all_pass(self) -> None:
        scenario = _make_scenario()

        def gen(s: EvalScenario) -> ScenarioResult:
            return _make_result(verdict="passed")

        assert pass_at_k(scenario, 3, gen) == pytest.approx(1.0)

    def test_pass_at_k_all_fail(self) -> None:
        scenario = _make_scenario()

        def gen(s: EvalScenario) -> ScenarioResult:
            return _make_result(verdict="failed", error="nope")

        assert pass_at_k(scenario, 3, gen) == pytest.approx(0.0)

    def test_pass_at_k_less_than_one_raises(self) -> None:
        scenario = _make_scenario()
        with pytest.raises(ValueError, match="k must be >= 1"):
            pass_at_k(scenario, 0, lambda s: _make_result())


# --------------------------------------------------------------------------
# ScenarioResult validation
# --------------------------------------------------------------------------


class TestScenarioResult:
    """Verify ScenarioResult enforces its invariants."""

    def test_valid_result_creates_successfully(self) -> None:
        result = _make_result()
        assert result.verdict == "passed"
        assert result.duration_ms == 100

    def test_rejects_invalid_verdict(self) -> None:
        with pytest.raises(ValueError, match="verdict"):
            _make_result(verdict="unknown")

    def test_rejects_negative_duration(self) -> None:
        with pytest.raises(ValueError, match="duration_ms"):
            _make_result(duration_ms=-1)

    def test_rejects_empty_timestamp(self) -> None:
        with pytest.raises(ValueError, match="timestamp"):
            _make_result(timestamp="")

    def test_rejects_whitespace_timestamp(self) -> None:
        with pytest.raises(ValueError, match="timestamp"):
            _make_result(timestamp="   ")

    def test_rejects_invalid_scenario_type(self) -> None:
        with pytest.raises(ValueError, match="scenario_type"):
            _make_result(scenario_type="benchmark")

    def test_to_dict_round_trips(self) -> None:
        result = _make_result()
        d = result.to_dict()
        assert d["verdict"] == "passed"
        assert d["duration_ms"] == 100
        assert d["scenario_type"] == "capability"
        assert d["scenario_path"] is None
        assert d["error"] is None


# --------------------------------------------------------------------------
# History writing
# --------------------------------------------------------------------------


class TestSaveHistory:
    """Verify run traces are written to disk when save_history=True."""

    def test_save_history_writes_trace_file(self, tmp_path: Path) -> None:
        scenario = _make_scenario()
        history_dir = tmp_path / "evals" / "history"

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "module exposes add()"

        result = run_scenario(
            scenario,
            executor=mock_executor,
            save_history=True,
            history_dir=history_dir,
        )

        traces = list(history_dir.glob("run-*.json"))
        assert len(traces) == 1

        data = json.loads(traces[0].read_text(encoding="utf-8"))
        assert data["verdict"] == result.verdict
        assert data["prompt"] == scenario.prompt
        assert data["axis"] == scenario.axis
        assert data["scenario_type"] == scenario.type

    def test_save_history_false_writes_no_file(self, tmp_path: Path) -> None:
        scenario = _make_scenario()
        history_dir = tmp_path / "evals" / "history"

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "module exposes add()"

        run_scenario(
            scenario,
            executor=mock_executor,
            save_history=False,
            history_dir=history_dir,
        )

        assert not history_dir.exists()

    def test_save_history_k_3_writes_three_traces(self, tmp_path: Path) -> None:
        scenario = _make_scenario()
        history_dir = tmp_path / "evals" / "history"

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "module exposes add()"

        run_scenario(
            scenario,
            k=3,
            executor=mock_executor,
            save_history=True,
            history_dir=history_dir,
        )

        traces = list(history_dir.glob("run-*.json"))
        assert len(traces) == 3


# --------------------------------------------------------------------------
# Criteria evaluation
# --------------------------------------------------------------------------


class TestCriteriaEvaluation:
    """Verify output is checked against success_criteria."""

    def test_passes_when_all_criteria_in_output(self) -> None:
        scenario = _make_scenario(
            success_criteria=("module exposes add()", "returns 5"),
        )

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "The module exposes add() and returns 5 when called"

        result = run_scenario(scenario, executor=mock_executor)
        assert result.verdict == "passed"

    def test_fails_when_criterion_missing_from_output(self) -> None:
        scenario = _make_scenario(
            success_criteria=("module exposes add()", "returns 5"),
        )

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "module exposes add() but nothing else"

        result = run_scenario(scenario, executor=mock_executor)
        assert result.verdict == "failed"
        assert result.error is not None
        assert "returns 5" in result.error

    def test_criteria_check_is_case_insensitive(self) -> None:
        scenario = _make_scenario(
            success_criteria=("MODULE EXPOSES ADD()",),
        )

        def mock_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            return "module exposes add()"

        result = run_scenario(scenario, executor=mock_executor)
        assert result.verdict == "passed"


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------


class TestErrorHandling:
    """Verify error propagation and graceful failure."""

    def test_executor_exception_produces_failed_result(self) -> None:
        scenario = _make_scenario()

        def failing_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            raise RuntimeError("connection failed")

        result = run_scenario(scenario, executor=failing_executor)
        assert result.verdict == "failed"
        assert result.error is not None
        assert "connection failed" in result.error

    def test_eval_runner_error_propagates(self) -> None:
        scenario = _make_scenario()

        def timeout_executor(prompt: str, forbidden_tools: tuple[str, ...]) -> str:
            raise EvalRunnerError("timed out")

        with pytest.raises(EvalRunnerError, match="timed out"):
            run_scenario(scenario, executor=timeout_executor)


# --------------------------------------------------------------------------
# write_run_history — Feature #28
# --------------------------------------------------------------------------

REQUIRED_KEYS = frozenset(
    {
        "scenario_path",
        "prompt",
        "verdict",
        "duration_ms",
        "tool_calls",
        "result",
        "timestamp",
        "error",
        "axis",
        "scenario_type",
    }
)


class TestWriteRunHistory:
    """Verify write_run_history persists traces with all required keys."""

    def test_writes_file_with_all_required_keys(self, tmp_path: Path) -> None:
        result = _make_result(
            scenario_path="scenarios/test.yaml",
            tool_calls=["Read", "Grep"],
        )
        trace_path = write_run_history(result, tmp_path)

        assert trace_path.exists()
        assert trace_path.name.startswith("run-")
        assert trace_path.suffix == ".json"

        data = json.loads(trace_path.read_text(encoding="utf-8"))
        assert REQUIRED_KEYS <= set(data.keys())

    def test_tool_calls_list_matches_result(self, tmp_path: Path) -> None:
        tools = ["Read", "Grep", "Bash"]
        result = _make_result(tool_calls=tools)
        trace_path = write_run_history(result, tmp_path)

        data = json.loads(trace_path.read_text(encoding="utf-8"))
        assert data["tool_calls"] == tools

    def test_creates_intermediate_directories(self, tmp_path: Path) -> None:
        nested = tmp_path / "a" / "b" / "c"
        result = _make_result()
        trace_path = write_run_history(result, nested)

        assert trace_path.exists()
        assert nested.is_dir()

    def test_uses_default_history_dir(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        result = _make_result()
        trace_path = write_run_history(result)

        assert trace_path.exists()
        assert str(trace_path.resolve()).startswith(str((tmp_path / DEFAULT_HISTORY_DIR).resolve()))

    def test_returns_path_object(self, tmp_path: Path) -> None:
        result = _make_result()
        trace_path = write_run_history(result, tmp_path)
        assert isinstance(trace_path, Path)

    def test_verdict_and_prompt_round_trip(self, tmp_path: Path) -> None:
        result = _make_result(verdict="failed", prompt="do something", error="oops")
        trace_path = write_run_history(result, tmp_path)

        data = json.loads(trace_path.read_text(encoding="utf-8"))
        assert data["verdict"] == "failed"
        assert data["prompt"] == "do something"
        assert data["error"] == "oops"

    def test_multiple_writes_produce_distinct_files(self, tmp_path: Path) -> None:
        r1 = _make_result(timestamp="2026-05-24T12:00:00+00:00")
        r2 = _make_result(timestamp="2026-05-24T12:00:01+00:00")
        p1 = write_run_history(r1, tmp_path)
        p2 = write_run_history(r2, tmp_path)

        assert p1 != p2
        assert len(list(tmp_path.glob("run-*.json"))) == 2


# --------------------------------------------------------------------------
# evaluate_exit — Feature #29 (regression vs capability split)
# --------------------------------------------------------------------------


class TestEvaluateExit:
    """Verify regression failures exit 1; capability failures exit 0 + warning."""

    def test_regression_failure_returns_exit_1(self) -> None:
        results = [
            _make_result(verdict="failed", scenario_type="regression", error="hash mismatch"),
        ]
        assert evaluate_exit(results, stderr=io.StringIO()) == 1

    def test_capability_failure_returns_exit_0(self) -> None:
        results = [
            _make_result(verdict="failed", scenario_type="capability", error="criterion not met"),
        ]
        assert evaluate_exit(results, stderr=io.StringIO()) == 0

    def test_capability_failure_emits_warning_to_stderr(self) -> None:
        buf = io.StringIO()
        results = [
            _make_result(
                verdict="failed",
                scenario_type="capability",
                prompt="implement add()",
                error="criterion not met: 'returns 5'",
            ),
        ]
        evaluate_exit(results, stderr=buf)
        warning = buf.getvalue()
        assert "capability scenario warning" in warning
        assert "implement add()" in warning
        assert "criterion not met" in warning

    def test_all_passed_returns_exit_0(self) -> None:
        results = [
            _make_result(verdict="passed", scenario_type="regression"),
            _make_result(verdict="passed", scenario_type="capability"),
        ]
        assert evaluate_exit(results, stderr=io.StringIO()) == 0

    def test_mixed_regression_failure_dominates(self) -> None:
        results = [
            _make_result(verdict="passed", scenario_type="regression"),
            _make_result(verdict="failed", scenario_type="regression", error="broke"),
            _make_result(verdict="failed", scenario_type="capability", error="weak"),
        ]
        assert evaluate_exit(results, stderr=io.StringIO()) == 1

    def test_capability_warning_without_error_field(self) -> None:
        buf = io.StringIO()
        results = [
            _make_result(verdict="failed", scenario_type="capability", error=None),
        ]
        evaluate_exit(results, stderr=buf)
        warning = buf.getvalue()
        assert "capability scenario warning" in warning
        assert " — " not in warning

    def test_empty_results_raises(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            evaluate_exit([], stderr=io.StringIO())

    def test_defaults_stderr_to_sys_stderr(self) -> None:
        results = [_make_result(verdict="passed", scenario_type="capability")]
        assert evaluate_exit(results) == 0
