"""Eval-run subcommand: execute behavioural-eval scenarios and report pass@k.

Loads scenario YAML(s), invokes :func:`eval_runner.run_scenario` for
each, optionally persists per-run trace JSON to ``--history-dir``, and
emits a results summary as text or JSON. Exit code comes from
:func:`eval_runner.evaluate_exit`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable

from .. import eval_runner, eval_scenario


def register_parser(subparsers: Any) -> None:
    """Register the eval-run subparser."""
    eval_run = subparsers.add_parser(
        "eval-run",
        help="Run behavioural-eval scenarios and report pass@k metrics",
    )
    eval_run.add_argument(
        "scenario",
        nargs="?",
        type=Path,
        default=None,
        help="Path to a single scenario YAML file (omit when using --all)",
    )
    eval_run.add_argument(
        "--all",
        action="store_true",
        dest="run_all",
        help="Run every scenario found under --scenarios-dir",
    )
    eval_run.add_argument(
        "--k",
        type=int,
        default=1,
        help="Number of times to execute each scenario (default: 1)",
    )
    eval_run.add_argument(
        "--save-history",
        action="store_true",
        help="Persist each run trace as run-{timestamp}.json under --history-dir",
    )
    eval_run.add_argument(
        "--type",
        choices=["regression", "capability", "all"],
        default="all",
        dest="scenario_type",
        help="Filter scenarios by type (default: all)",
    )
    eval_run.add_argument(
        "--scenarios-dir",
        type=Path,
        default=Path(".claude/evals/scenarios"),
        dest="scenarios_dir",
        help="Directory to scan when --all is set (default: .claude/evals/scenarios)",
    )
    eval_run.add_argument(
        "--history-dir",
        type=Path,
        default=Path(eval_runner.DEFAULT_HISTORY_DIR),
        dest="history_dir",
        help=f"Directory for run trace files (default: {eval_runner.DEFAULT_HISTORY_DIR})",
    )


def handle_eval_run(args: argparse.Namespace) -> int:
    """Handle the eval-run subcommand."""
    json_mode = bool(getattr(args, "json", False))

    scenario_path: Path | None = getattr(args, "scenario", None)
    run_all: bool = getattr(args, "run_all", False)

    if not scenario_path and not run_all:
        msg = "Provide a scenario YAML path or use --all"
        _print_error(msg, json_mode)
        return 1

    if scenario_path and run_all:
        msg = "Cannot combine a scenario path with --all"
        _print_error(msg, json_mode)
        return 1

    k: int = getattr(args, "k", 1)
    if k < 1:
        _print_error("--k must be >= 1", json_mode)
        return 1

    save_history: bool = getattr(args, "save_history", False)
    type_filter: str = getattr(args, "scenario_type", "all")
    scenarios_dir: Path = getattr(args, "scenarios_dir", Path(".claude/evals/scenarios"))
    history_dir: Path = getattr(args, "history_dir", Path(eval_runner.DEFAULT_HISTORY_DIR))

    scenario_files = _collect_scenario_files(scenario_path, scenarios_dir, json_mode)
    if scenario_files is None:
        return 1

    results: list[eval_runner.ScenarioResult] = []
    errors: list[dict[str, str]] = []

    for path in scenario_files:
        try:
            sc = eval_scenario.EvalScenario.from_yaml(path)
        except eval_scenario.EvalScenarioValidationError as exc:
            errors.append({"path": str(path), "error": str(exc)})
            continue

        if type_filter != "all" and sc.type != type_filter:
            continue

        try:
            result = eval_runner.run_scenario(
                sc,
                k=k,
                save_history=save_history,
                history_dir=history_dir,
                scenario_path=str(path),
            )
            results.append(result)
        except eval_runner.EvalRunnerError as exc:
            errors.append({"path": str(path), "error": str(exc)})

    if not results and not errors:
        msg = "No scenarios matched the filters"
        if json_mode:
            print(json.dumps({"error": msg, "type_filter": type_filter}, indent=2))
        else:
            print(f"Error: {msg}")
        return 1

    if json_mode:
        _print_eval_run_json(results, errors, k, type_filter)
    else:
        _print_eval_run_text(results, errors, k, type_filter)

    if not results:
        return 1
    return eval_runner.evaluate_exit(results)


def _print_error(msg: str, json_mode: bool) -> None:
    """Print an error message in the active output mode."""
    if json_mode:
        print(json.dumps({"error": msg}, indent=2))
    else:
        print(f"Error: {msg}")


def _collect_scenario_files(
    scenario_path: Path | None,
    scenarios_dir: Path,
    json_mode: bool,
) -> list[Path] | None:
    """Collect scenario YAML files from a single path or directory scan."""
    if scenario_path:
        if not scenario_path.exists():
            _print_error(f"Scenario file not found: {scenario_path}", json_mode)
            return None
        return [scenario_path]

    if not scenarios_dir.is_dir():
        _print_error(f"Scenarios directory not found: {scenarios_dir}", json_mode)
        return None

    files = sorted(list(scenarios_dir.rglob("*.yaml")) + list(scenarios_dir.rglob("*.yml")))
    if not files:
        _print_error(f"No YAML files found in {scenarios_dir}", json_mode)
        return None

    return files


def _print_eval_run_json(
    results: list["eval_runner.ScenarioResult"],
    errors: list[dict[str, str]],
    k: int,
    type_filter: str,
) -> None:
    """Render eval-run results as JSON."""
    passed = sum(1 for r in results if r.verdict == "passed")
    payload = {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "pass_rate": passed / len(results) if results else 0.0,
        "k": k,
        "type_filter": type_filter,
        "results": [r.to_dict() for r in results],
        "errors": errors,
    }
    print(json.dumps(payload, indent=2))


def _print_eval_run_text(
    results: list["eval_runner.ScenarioResult"],
    errors: list[dict[str, str]],
    k: int,
    type_filter: str,
) -> None:
    """Render eval-run results as human-readable text."""
    passed = sum(1 for r in results if r.verdict == "passed")
    total = len(results)

    print(f"\nEval Run Results (k={k}, type={type_filter})")
    print("=" * 60)

    for r in results:
        flag = "PASS" if r.verdict == "passed" else "FAIL"
        path_label = r.scenario_path or "(inline)"
        print(f"  [{flag}] {path_label}  ({r.duration_ms}ms)")
        if r.error:
            print(f"         {r.error}")

    if errors:
        print(f"\nLoad errors ({len(errors)}):")
        for e in errors:
            print(f"  ! {e['path']}: {e['error'][:120]}")

    print(f"\nSummary: {passed}/{total} passed", end="")
    if total:
        print(f" ({passed / total:.0%})")
    else:
        print()


COMMANDS: dict[str, Callable[[argparse.Namespace], int]] = {
    "eval-run": handle_eval_run,
}
