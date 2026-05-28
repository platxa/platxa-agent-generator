# Failure Modes Catalog

Known failure modes in the agent generation and continuous-learning
pipeline, with detection strategies and mitigations.

## 1. Observer Re-entrancy

**Description**: The observer subagent is dispatched on SubagentStop,
but the observer itself is a subagent. If the SubagentStop hook fires
for the observer's own completion, it triggers an infinite dispatch loop.

**Detection**: `stop_hook_active` guard in the generated script checks
for recursion and short-circuits with exit 0.

**Mitigation**: The observer dispatch script includes a recursion guard
that checks `stop_hook_active` in the hook payload. The `observer_guard.py`
module enforces additional checks: env var gate, lockfile, minimum elapsed
time, and transcript source validation.

## 2. Memory Explosion

**Description**: Instinct files accumulate without bounds. Over months of
use, the instinct store grows large enough to exceed the `additionalContext`
character budget, causing truncation that drops recent instincts.

**Detection**: Monitor instinct count via `InstinctStore.count()` and
total file size. The SessionStart script's `max_chars` cap triggers
truncation with an overflow notice.

**Mitigation**: `gc_expired_instincts()` prunes instincts where
`(now - last_seen) > ttl_days AND usage_count == 0`. Default TTL: 30 days.
Dedup prevents near-duplicate instincts from accumulating.

## 3. Self-Grading Bias

**Description**: An agent that generates output also evaluates its own
output. This violates the HE1 principle (generators must not self-evaluate)
and produces inflated quality scores.

**Detection**: Code review for `disallowedTools: Write, Edit` on evaluator
agents. The `gan-axis-judge` agents are read-only by design.

**Mitigation**: Strict role separation — generators (generation-subagent)
never score their own output. Evaluators (gan-evaluator, gan-axis-judge)
have `disallowedTools: Write, Edit` and run in isolated contexts.

## 4. Observation-Instinct Drift

**Description**: Observations accumulate in JSONL but the promotion engine
never fires, so the observation log fills to its cap (200) and old
observations are evicted before they can be promoted.

**Detection**: Compare `observation_store.stats()["total"]` against
promotion counts. If total approaches cap with zero promotions, the
pipeline is drifting.

**Mitigation**: Post-pass observer hook fires after every feature pass-gate.
The `/evolve` skill triggers promotion checks. Regular use prevents backlog.

## 5. Weight Drift

**Description**: Evaluation criteria weights hardcoded in agent `.md` files
diverge from the source-of-truth YAML. Agents score against stale weights,
producing inconsistent evaluations.

**Detection**: `quality_scorer.check_agent_weight_tables()` greps every agent
`.md` file for table rows of the form `| <axis> | <float> |` and returns the
list of offenders. The same check runs in CI via
`.github/workflows/weight-drift-check.yml`.

**Mitigation**: CI pipeline fails on any match; the `platxa-agent health`
dashboard surfaces drift between releases. See `docs/WEIGHT_SYNC.md` for the
full update procedure.

## 6. Completion-Promise False Positive

**Description**: An agent emits the `<promise>COMPLETE</promise>` marker
inside a code block or documentation example. The regex-based Stop hook
cannot distinguish this from a genuine completion signal.

**Detection**: The Stop hook uses regex extraction (`<promise>(.*?)</promise>`)
+ byte-exact comparison. It does not understand markdown structure.

**Mitigation**: Agent prompts must not include the literal marker string in
code examples. Use escaped or partial forms when documenting the marker.

## 7. Concurrent Index Corruption

**Description**: Multiple processes or threads writing to the instinct
store's `index.json` simultaneously produce torn writes (partial JSON).

**Detection**: `InstinctStore.verify()` compares on-disk SHA-256 against
the index-stored checksum. Torn writes produce checksum mismatches.

**Mitigation**: Two-layer locking — process-local `threading.Lock` keyed
by resolved root path, plus `fcntl.flock` on a permanent lock file. The
lock file is never unlinked (prevents TOCTOU race on inode reuse).

## 8. Stale Session State on Resume

**Description**: A session resumes after significant codebase changes.
The persisted workflow state references files, phases, or checkpoints
that no longer reflect reality.

**Detection**: The SessionStart hook injects `[workflow-state]` section.
The model must verify checkpoint data against current code before acting.

**Mitigation**: Resume state is advisory, not prescriptive. The workflow
state shows completed phases and next-phase recommendation, but the model
should validate before continuing.

## 9. Promotion Threshold Misconfiguration

**Description**: The `PLATXA_PROMOTION_THRESHOLDS` env var is set to
values that are too low (promoting noise) or too high (blocking all
promotions).

**Detection**: `PromotionThresholds.__post_init__` validates ranges
(`occurrences >= 0`, `confidence in [0.0, 1.0]`, `success_count >= 0`).
Zero-value thresholds are technically valid but promote everything.

**Mitigation**: Conservative defaults (`occurrences >= 3`,
`confidence >= 0.7`, `success_count >= 1`). The `/evolve` skill's
dry-run mode previews what would be promoted before committing.
