# Self-Improvement Mechanism

The self-improvement system uses instincts, evolution, and promotion to
let the agent generator learn from its own runs and improve over time.

## Three Mechanisms

### 1. Instincts — Learned Behavioral Patterns

Instincts are `.md` files stored under `~/.claude/instincts/` with YAML
frontmatter carrying metadata (confidence, usage count, success rate).
They are injected into every session via the SessionStart hook.

**Default thresholds**:

| Parameter | Default | Env override |
|-----------|---------|-------------|
| Dedup accept threshold | 0.95 | — (constant in code) |
| Dedup ambiguous zone | [0.6, 0.95) | — (constant in code) |
| GC TTL | 30 days | — (constant in code) |
| Promotion occurrences | ≥ 3 | `PLATXA_PROMOTION_THRESHOLDS` |
| Promotion confidence | ≥ 0.7 | `PLATXA_PROMOTION_THRESHOLDS` |
| Promotion success_count | ≥ 1 | `PLATXA_PROMOTION_THRESHOLDS` |

See `docs/INSTINCTS.md` for the full lifecycle.

### 2. Evolution — Prompt Mutation

The `/evolve` skill (implemented in `mutation_registry.py`) applies
mutation operators to agent definitions:

| Operator | Effect |
|----------|--------|
| Synonym | Replace terms with domain-appropriate synonyms |
| Restructure | Reorder sections for better flow |
| Contextualize | Add project-specific context |
| Simplify | Remove redundant instructions |

Each mutation is evaluated against the existing quality score. Only
mutations that score strictly higher replace the original definition.
This prevents quality regression while allowing iterative improvement.

### 3. Promotion — Graduating Patterns

When instincts accumulate enough evidence, the promotion engine can
graduate them into more permanent artifacts:

| Target | When to promote |
|--------|----------------|
| **Skill** | A behavioral pattern that benefits from slash-command access |
| **Command** | A frequently-used tool sequence |
| **Agent** | A pattern complex enough to warrant its own agent definition |
| **Template** | A reusable structural pattern for new agents |

## Tuning Guide

### Making the system learn faster

Lower the promotion thresholds:

```bash
export PLATXA_PROMOTION_THRESHOLDS='{"occurrences": 2, "confidence": 0.5, "success_count": 1}'
```

**Risk**: Promotes noise — instincts with low evidence may encode
one-off patterns that don't generalize.

### Making the system more selective

Raise the promotion thresholds:

```bash
export PLATXA_PROMOTION_THRESHOLDS='{"occurrences": 5, "confidence": 0.8, "success_count": 3}'
```

**Risk**: Slow learning — useful patterns may never cross the threshold
in small projects.

### Preventing instinct bloat

Lower the GC TTL by modifying `DEFAULT_TTL_DAYS` in `instinct_store.py`,
or run `gc_expired_instincts()` more aggressively via the CLI.

### Monitoring health

```bash
# Check instinct count and store integrity
python -m platxa_agent_generator.cli instincts --list

# Check observation pipeline status
python -m platxa_agent_generator.cli observations --stats

# Check for weight drift
python -m platxa_agent_generator.weight_drift_check

# Run full health dashboard
python -m platxa_agent_generator.cli health --json
```

## Feedback Loop Diagram

```
                    ┌──────────────────────┐
                    │   Agent runs task     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Observer captures   │
                    │   ObservationRecords  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Promotion engine    │
                    │   gates + dedup       │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Instinct written    │
                    │   to store            │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Next session loads  │
                    │   instinct as context │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Agent behavior      │
                    │   improved            │◀──── loop
                    └──────────────────────┘
```
