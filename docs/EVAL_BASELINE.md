# Eval Baseline — Agent Generation Quality

This document captures the methodology, threshold, and procedure for the agent-generation quality benchmark. It is the canonical reference for the verification criterion of feature #48: *"Eval pass rate ≥ baseline; quality scores ≥ baseline across all scenarios."*

## What "baseline" means here

The Python code reduction sprint (features #1–#43, commits `098e6b0f` → `4c715ed7`) eliminated ~14k lines of Python by delegating template rendering and structural reasoning to Claude Code's native tools (Read, Write, Glob, Grep, Bash, Task). The sprint did **not** capture a pre-reduction snapshot of eval pass rates. As a result:

- There is no historical pass rate to compare against.
- The verification criterion "≥ baseline" is unsatisfiable on the literal reading.
- Feature #48 was re-scoped (with user approval) to **record the current (post-reduction) state as the v1 baseline** rather than perform an impossible comparison.

The first official baseline lives at `.claude/evals/baseline-2026-05-28.json`. Future runs are compared against it.

## Threshold

**Pass criterion: ≥ 80% of executed scenarios PASS.**

Why 80% and not 100%? All 60 in-tree scenarios are `type: capability` (see `src/platxa_agent_generator/eval_scenario.py`). Per `eval_runner.evaluate_exit()`, capability failures are advisory — they emit a warning and exit 0. The 80% threshold imposes an explicit quality floor on top of that advisory machinery without re-typing every scenario to `regression` (which would require capturing `regression_baseline` output hashes for each, a separate larger initiative).

The threshold applies to whatever subset is run. The v1 baseline ran 6 of 60 scenarios and achieved 6/6 (100%).

## Methodology

### What gets run

For each scenario YAML under `.claude/evals/scenarios/<category>/<axis>_NN.yaml`:

1. Read the scenario's `prompt`, `success_criteria`, and `forbidden_tools`.
2. Invoke an executor with `(prompt, forbidden_tools) → output`.
3. Case-insensitive substring-match the output against every entry in `success_criteria`. All criteria must match for the scenario to PASS.
4. Record a `ScenarioResult` (schema: `eval_runner.ScenarioResult.to_dict()`) to `.claude/evals/history/run-{timestamp}.json` (gitignored — local only).
5. Aggregate counts into a baseline JSON file (committed).

### Executor — two paths

**External (authoritative)** — run from a normal shell, not from inside a Claude Code session:

```bash
python -m platxa_agent_generator.cli --json eval-run --all --save-history \
  > .claude/evals/baseline-external-$(date -u +%Y-%m-%d).json
```

`--json` is a top-level parent-parser flag (see `src/platxa_agent_generator/cli.py`) and must come **before** the `eval-run` subcommand; placing it after produces an argparse error. Scenarios are loaded from `--scenarios-dir` (default `.claude/evals/scenarios/`).

This invokes the default `claude -p <prompt>` subprocess executor (`eval_runner._default_executor`). One `claude` process per scenario, 120-second per-scenario timeout. Wall time ~20–40 min for all 60 scenarios. Token cost: one full generation per scenario.

**In-session (this baseline)** — Task-tool dispatch. The `claude -p` subprocess hangs when spawned from inside Claude Code (the parent process holds locks the child needs to start; this is by design of the host CLI, not a bug). The eval_runner module's docstring explicitly anticipates this: *"the executor is injectable — defaults to subprocess-based `claude -p` invocation but accepts any callable for testing and alternative dispatch mechanisms (e.g. the Claude Code Task tool in agent context)."*

The v1 baseline used a Task-tool dispatch (`subagent_type: general-purpose`) and substring-checked the returned text. This is suitable for an in-session smoke test but is **not** apples-to-apples with the external executor — the Task subagent has slightly richer context (CLAUDE.md, available skills/agents) than a bare `claude -p` invocation, so the in-session pass rate may be inflated. Re-running externally is recommended to capture the authoritative figure.

### Scenario inventory

Six **categories**: `analyzer`, `automation`, `builder`, `guide`, `orchestrator`, `validator` — each at `.claude/evals/scenarios/<category>/`.

Seven **axes** appear across the suite: `clarity`, `completeness`, `correctness`, `robustness`, `scope_adherence`, `security`, `tool_design`.

Every category contains the same ten YAML files (so axis ≠ file count — three axes have two slots each):

```
clarity_01, completeness_01, correctness_01, correctness_02,
robustness_01, robustness_02, scope_adherence_01, security_01,
tool_design_01, tool_design_02
```

Six categories × ten files = **sixty** `type: capability` scenarios. The v1 baseline sampled one per category (`correctness_01`).

## v1 Baseline (2026-05-28)

| Category      | Scenario              | Verdict | Produced Agent                |
|---------------|-----------------------|---------|-------------------------------|
| analyzer      | correctness_01        | PASS    | python-security-auditor       |
| automation    | correctness_01        | PASS    | ci-pipeline-runner            |
| builder       | correctness_01        | PASS    | react-component-scaffolder    |
| guide         | correctness_01        | PASS    | git-rebase-guide              |
| orchestrator  | correctness_01        | PASS    | code-review-orchestrator      |
| validator     | correctness_01        | PASS    | json-schema-validator         |

**6 / 6 = 100% PASS**, threshold met (≥80%).

Full record: `.claude/evals/baseline-2026-05-28.json`.

## Re-run cadence

- After any change to an agent definition under `agents/*.md`.
- After any change to a skill reference under `skills/platxa-agent-generator/references/`.
- After any change to a prompt template under `src/platxa_agent_generator/templates/`.
- Once per sprint as a routine drift check (run the external authoritative path).
- After a Claude model upgrade.

Diff against the previous baseline JSON. Any verdict regression (PASS → FAIL) is a hard finding; any pass-rate drop below 80% blocks merge. Enforcement is currently manual in PR review (no CI gate is wired — `eval_runner.evaluate_exit()` always exits 0 for capability scenarios, so the merge block must come from a reviewer or a future workflow that parses the baseline JSON). When a *legitimate* improvement raises the floor (e.g. a new harder scenario is added and produces 92%), update this doc's v1 table and the threshold rationale rather than weakening the threshold.

## Known deferral — axis coverage gap

The v1 baseline covers **6 of 60 scenarios on a single axis** (`correctness`). The remaining 54 scenarios distributed across six axes (`clarity`, `completeness`, `robustness`, `scope_adherence`, `security`, `tool_design`) are **not yet baselined**.

This matters because the 2026 reduction sprint moved ~20,400 lines of Python into agent definitions and skill references — exactly the surfaces those axes evaluate. Until the deferred axes are baselined, an agent prompt edit silently degrading completeness or security scoring will not be detected by `python -m platxa_agent_generator.cli health` or CI.

### Closure criteria

The deferral is considered closed when **all** of the following hold:

1. The external authoritative executor (see *Methodology → External*) has been run end-to-end against all 60 scenarios from outside a Claude Code session.
2. The result has been committed at `.claude/evals/baseline-external-2026-05-28.json` (or a later dated equivalent).
3. The pass rate on each of the six deferred axes meets the ≥80% threshold.
4. This document's *v1 Baseline (2026-05-28)* table has been expanded into an axis × category matrix so future drift surfaces at axis granularity.

Until then, treat the v1 figure as a smoke test, not a regression floor. Hard-blocking on the 80% threshold for non-`correctness` axes is **not yet supported** by the data.

## Future work

1. **Capture the authoritative 60-scenario baseline** by running the external executor path from outside a Claude Code session. (Closes the deferral above.)
2. **Promote stable scenarios to `type: regression`** with `regression_baseline` hashes so the runner's `evaluate_exit()` hard-fails on regression.
3. **Replace substring matching with an LLM-as-judge axis grader** for the non-structural axes (clarity, robustness, scope_adherence, security) — substring matching is reliable only for the structural axes (correctness, completeness, tool_design).
