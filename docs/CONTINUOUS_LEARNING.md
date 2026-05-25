# Continuous Learning Loop

The continuous-learning pipeline transforms raw agent behavior into
reusable knowledge that improves future sessions. The loop has four
themes, each building on the previous.

## Full Loop

```
Theme 1: Capture          Theme 2: Extract           Theme 3: Promote          Theme 4: Apply
─────────────────         ──────────────────         ──────────────────         ──────────────
                                                                                
Agent runs               Observer analyzes          Promotion engine           SessionStart hook
     │                   transcript                 evaluates candidates       loads instincts
     ▼                        │                          │                          │
SubagentStop             ObservationRecord(s)       Three-gate check           additionalContext
hook fires                    │                          │                     injection
     │                        ▼                          ▼                          │
     ▼                   observations.jsonl         Instinct .md files         Model uses
observer-subagent             │                     written to store           learned patterns
dispatched                    ▼                          │                          │
                         Pattern labels             Dedup prevents              GC prunes
                         assigned                   redundancy                 stale instincts
```

## Theme 1: Capture (Observation)

**Owner**: `agents/observer-subagent.md`

The observer watches other agents finish and extracts structured
observations. It is strictly read-only (HE1 boundary).

**Key files**:
- `agents/observer-subagent.md` — observer agent definition
- `observation_store.py` — `ObservationRecord` schema + JSONL store
- `observer_guard.py` — re-entrancy guards

**Output**: `ObservationRecord` rows in `observations.jsonl`

See `docs/OBSERVATION_PIPELINE.md` for the capture taxonomy and the
9 observation types.

## Theme 2: Extract (Pattern Recognition)

**Owner**: `observation_store.py` + promotion engine

Observations are clustered by `pattern_label` — a short string that
groups related observations across sessions. The clustering is done by
the observer at capture time (it assigns labels), and refined by the
promotion engine which groups by label for threshold evaluation.

**Key files**:
- `observation_store.py` — `stats()`, `migrate()`, pattern queries
- `promotion_engine.py` — clustering + threshold evaluation

**Output**: Candidate instincts with occurrence counts, confidence
scores, and success counts.

## Theme 3: Promote (Gate + Write)

**Owner**: `promotion_engine.py`

The three-gate threshold determines which candidates become instincts:

| Gate | Default | Meaning |
|------|---------|---------|
| `occurrences >= 3` | Pattern seen at least 3 times |
| `confidence >= 0.7` | Observer's confidence in the pattern |
| `success_count >= 1` | Pattern led to at least 1 successful outcome |

Candidates that pass all three gates are deduplicated against the
existing instinct store, then written as `.md` files with YAML
frontmatter.

**Key files**:
- `promotion_engine.py` — `promote()`, `PromotionThresholds`
- `instinct_store.py` — `put()`, `dedup_instinct()`

**Output**: Instinct `.md` files in `~/.claude/instincts/`

See `docs/INSTINCTS.md` for the full instinct lifecycle.

## Theme 4: Apply (Use + Prune)

**Owner**: `hooks_generator.generate_session_start_context_script()`

At each new session, the SessionStart hook loads instinct files and
injects them as `additionalContext`. The model reads these patterns
and applies them during the session. Usage is tracked via
`increment_instinct_usage()`.

Instincts that are not used within the TTL window (default 30 days)
and have `usage_count == 0` are pruned by `gc_expired_instincts()`.

**Key files**:
- `hooks_generator.py` — SessionStart context script
- `instinct_store.py` — `gc_expired_instincts()`, `increment_instinct_usage()`

**Output**: Improved agent behavior; stale instincts pruned.

## Cross-Theme Invariants

1. **HE1 boundary**: Generators never evaluate their own output.
   Observers never write files. Evaluators never generate code.
2. **Atomic persistence**: All writes (observations, instincts, state)
   use temp file + `os.replace` for crash safety.
3. **Dedup at write time**: The instinct store prevents duplicates at
   the point of write, not after the fact.
4. **Conservative defaults**: When in doubt, the system keeps instincts
   (dedup without LLM → treat as distinct; GC without `last_seen` →
   retain).
