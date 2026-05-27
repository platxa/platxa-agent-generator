# Weight Sync — Evaluation Criteria Update Procedure

The evaluation criteria weights are defined in a single source of truth:
`src/platxa_agent_generator/templates/evaluation-criteria.yaml`. This
document describes the procedure for updating weights and ensuring all
consumers stay synchronized.

## Single Source of Truth

```
evaluation-criteria.yaml
        │
        ├──▶ EvaluationRubric.load_default()  (runtime)
        ├──▶ gan-axis-judge agents              (per-axis scoring)
        ├──▶ gan-evaluator orchestrator          (verdict aggregation)
        └──▶ weight_drift_check.py              (drift detection)
```

All axis names, weights, severities, and criteria descriptions are
defined in `evaluation-criteria.yaml`. No other file should hardcode
these values.

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

### Step 2: Run the drift check

```bash
python -m platxa_agent_generator.weight_drift_check
```

This compares the YAML weights against any hardcoded weight tables
in agent `.md` files. If drift is detected, the tool reports which
agents have stale weights and what the deltas are.

### Step 3: Update drifted agents

If any agent `.md` files embed weight tables (for documentation
purposes), update them to match the new YAML values. The drift
checker reports exact line locations and expected values.

### Step 4: Run tests

```bash
pytest tests/test_weight_drift_check.py -v
```

This verifies that:
- The YAML loads without errors
- Weights sum to 1.0
- No agent files have drifted weights
- The drift report structure is correct

### Step 5: Verify evaluation pipeline

```bash
pytest tests/test_validation_failure_context.py -v
```

The `build_validation_failure_context` function consumes axis weights
to construct per-axis regeneration prompts. Ensure the new weights
produce correct prompt formatting.

## What NOT to Do

- **Do not hardcode weights in Python code** — load via
  `EvaluationRubric.load_default()`.
- **Do not duplicate weight tables in agent `.md` files** without
  running the drift checker. If you must document weights in prose,
  cite the YAML as the source and run `weight_drift_check.py` in CI.
- **Do not change axis names** without updating all consumers — the
  axis name is the join key between the YAML, the evaluator agents,
  and the drift checker.

## CI Integration

The `.github/workflows/` CI pipeline runs `weight_drift_check.py`
on every PR that touches `evaluation-criteria.yaml` or any file under
`agents/`. This catches weight drift before it reaches main.
