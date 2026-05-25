# Memory Bridge — Cross-Session State

The memory bridge ensures state continuity between Claude Code sessions.
It manages three complementary persistence mechanisms, each suited to
different data shapes.

## Initializer / Coder Split

The learning pipeline separates concerns between two phases:

- **Initializer** (SessionStart hook): Loads persisted state —
  instincts, progress log, workflow state — and injects it as
  `additionalContext`. Read-only; never mutates state.

- **Coder** (active session): Generates code, runs tools, records
  observations. Writes to `claude-progress.txt` and the observation
  JSONL log. State mutations happen here.

This split prevents the observation pipeline from interfering with
the generation pipeline and ensures that session startup is always
non-blocking (exit 0).

## Persistence Mechanisms

### claude-progress.txt

Plain-text log of session milestones. Appended during active work.

- **Format**: One `PROGRESS` line per milestone, human-readable
- **Lifecycle**: Grows monotonically; truncated from the head when
  the character budget is exceeded at session start
- **Why text**: Progress entries are free-form narrative (phase
  transitions, decisions, blockers) — structured formats add overhead
  without queryability benefit

### observations.jsonl

Append-only JSONL log of structured `ObservationRecord` rows.

- **Format**: One JSON object per line, schema-validated via
  `ObservationRecord.__post_init__`
- **Lifecycle**: Capped at `DEFAULT_OBSERVATION_CAP` (200 records);
  oldest records evicted on overflow
- **Why JSONL**: Observations are machine-consumed (clustered by
  `pattern_label`, filtered by `type`, sorted by `confidence`) —
  line-delimited JSON supports both streaming append and efficient
  field-level queries

### .claude/state/ (StatePersistence)

Full workflow state with checkpoints, metadata, and generation records.

- **Format**: JSON with schema version, integrity checksums, and
  backup files
- **Lifecycle**: Overwritten atomically on each state transition;
  backup auto-created before each write
- **Why JSON**: Complex nested structure (checkpoints, generation
  records, workflow data) requires random-access reads and updates —
  JSON supports `transaction()` with rollback semantics

## JSON vs Markdown Decision Guide

| Signal | Use JSON | Use Markdown |
|--------|----------|-------------|
| Machine-consumed (clustering, filtering, aggregation) | Yes | |
| Human-consumed (session context, model prompts) | | Yes |
| Append-only log | Yes (JSONL) | |
| Key-value metadata (frontmatter) | | Yes |
| Needs atomic read-modify-write | Yes | |
| Injected into additionalContext | | Yes |
| Schema-validated fields | Yes | |
| Free-form narrative content | | Yes |

## Session Restart Flow

```
Previous session ends
        │
        ▼
┌─────────────────────┐
│ State persisted:     │
│ - .claude/state/     │
│ - observations.jsonl │
│ - claude-progress.txt│
│ - instincts/*.md     │
└─────────┬───────────┘
          │
          ▼ New session starts
┌─────────────────────┐
│ SessionStart hook    │
│                      │
│ 1. Load instincts    │
│ 2. Load progress     │
│ 3. On resume: load   │
│    workflow state    │
│ 4. Emit combined     │
│    additionalContext │
└─────────────────────┘
```
