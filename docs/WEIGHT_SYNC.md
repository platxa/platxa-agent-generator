# Weight Sync — Evaluation Criteria Update Procedure

The evaluation criteria weights are defined in a single source of truth:
`src/platxa_agent_generator/templates/evaluation-criteria.yaml`. This
document describes the procedure for updating weights and ensuring all
consumers stay synchronized.

## Single Source of Truth

```
evaluation-criteria.yaml
        │
        ├──▶ EvaluationRubric.load_default()           (runtime)
        ├──▶ gan-axis-judge agents                     (per-axis scoring)
        ├──▶ gan-evaluator orchestrator                (verdict aggregation)
        ├──▶ quality_scorer.CRITERIA_WEIGHTS           (loaded from YAML)
        └──▶ .github/workflows/weight-drift-check.yml  (grep guard against agent
                                                         .md weight tables)
```

All axis names, weights, severities, and criteria descriptions are
defined in `evaluation-criteria.yaml`. No other file should hardcode
these values. `quality_scorer.CRITERIA_WEIGHTS` loads from the YAML
at module init; the CI workflow uses `grep` to ensure no agent `.md`
file reintroduces a hardcoded weight table.

## Update Procedure

### Step 1: Modify the YAML

Edit `src/platxa_agent_generator/templates/evaluation-criteria.yaml`:

```yaml
axes:
  correctness:
    weight: 0.25        # ← change weight here
    severity_on_unmet: REJECT
    criteria: "..."
```

**Constraints**:
- All axis weights must sum to 1.0
- Each weight must be in (0.0, 1.0]
- Axis names must match the `severity_on_unmet` keys

### Step 2: Confirm no agent `.md` weight tables

```bash
grep -EHn '^\|[[:space:]]*[A-Za-z_]+[[:space:]]*\|[[:space:]]*[0-9]+\.[0-9]+[[:space:]]*\|' agents/*.md
```

Empty output (exit 1 from grep) means every agent correctly defers
to the YAML. Any match is drift and must be removed — agent files
should cite the YAML, not duplicate its values.

The same check runs in CI via
`.github/workflows/weight-drift-check.yml`.

### Step 3: Verify evaluation pipeline

```bash
pytest tests/test_validation_failure_context.py -v
```

The `build_validation_failure_context` function consumes axis weights
to construct per-axis regeneration prompts. Ensure the new weights
produce correct prompt formatting.

## What NOT to Do

- **Do not hardcode weights in Python code** — load via
  `EvaluationRubric.load_default()`. If you must override
  `CRITERIA_WEIGHTS` in a test, call
  `quality_scorer.check_criteria_weights_integrity()` to surface a
  `DeprecationWarning`.
- **Do not duplicate weight tables in agent `.md` files**. The CI
  `weight-drift-check.yml` workflow greps for `| <axis> | <float> |`
  table rows and fails the build on any match.
- **Do not change axis names** without updating all consumers — the
  axis name is the join key between the YAML, the evaluator agents,
  and `CRITERIA_WEIGHTS`.

## CI Integration

The `.github/workflows/weight-drift-check.yml` workflow runs `grep`
against `agents/*.md` on every push to `main`/`develop` and every PR
to `main`, failing the build if any agent file contains a hardcoded
weight table. The `platxa-agent health` command surfaces the same
check via `quality_scorer.check_agent_weight_tables()` so the
learning-loop dashboard reports drift between releases.
