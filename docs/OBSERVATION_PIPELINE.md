# Observation Pipeline

The observation pipeline captures structured behavioral data from agent
runs and feeds it into the continuous-learning loop. Observations are
the raw material from which instincts (learned behavioral patterns) are
distilled.

## Architecture: Stop-hook → Observer → Store

```
Agent finishes
      │
      ▼
┌─────────────────┐     SubagentStop hook
│  Claude Code    │────────────────────────┐
│  Stop event     │                        │
└─────────────────┘                        ▼
                                 ┌────────────────────┐
                                 │ observer-subagent   │
                                 │ (agents/observer-   │
                                 │  subagent.md)       │
                                 │                     │
                                 │ 1. Read transcript  │
                                 │ 2. Identify patterns│
                                 │ 3. Emit records     │
                                 └────────┬───────────┘
                                          │
                                          ▼
                                 ┌────────────────────┐
                                 │ observation_store   │
                                 │ (observation_       │
                                 │  store.py)          │
                                 │                     │
                                 │ Append-only JSONL   │
                                 │ with atomic writes  │
                                 └────────┬───────────┘
                                          │
                                          ▼
                                 ┌────────────────────┐
                                 │ instinct-promote    │
                                 │ (promotion_         │
                                 │  engine.py)         │
                                 │                     │
                                 │ Cluster → gate →    │
                                 │ write instinct .md  │
                                 └────────────────────┘
```

### Flow

1. **Trigger**: A Claude Code subagent finishes. The `SubagentStop` hook
   fires the observer dispatch script (see
   [`agents/observer-subagent.md`](../agents/observer-subagent.md) for
   the trigger contract).

2. **Observe**: The observer subagent reads the finished agent's
   transcript and identifies reusable patterns — tool sequences, decisions,
   problems, fixes. It emits one `ObservationRecord` per distinct pattern.
   The observer is strictly read-only (HE1 boundary).

3. **Store**: Records are appended to the JSONL observation log via
   [`observation_store.py`](../src/platxa_agent_generator/observation_store.py).
   Writes are atomic (temp file + `os.replace`) with `fcntl` file locking
   for cross-process safety.

4. **Promote**: The promotion engine clusters observations by
   `pattern_label`, gates on confidence thresholds, and writes instinct
   `.md` files to the instinct store.

## Observation Types

Each `ObservationRecord` carries a `type` field from the
`ObservationType` literal union (defined in `observation_store.py`).
There are **9** canonical types:

| Type | Description | Example |
|------|-------------|---------|
| `tool_use` | A tool invocation pattern worth remembering | "Agent used `Grep` before `Read` to narrow search scope — found the symbol in 2 calls instead of 5" |
| `decision` | An architectural or design choice | "Chose orchestrator-workers over prompt chaining because the task had dynamic subtask count" |
| `preference` | A user or project style preference | "User prefers `snake_case` for CLI flags, not `kebab-case`" |
| `milestone` | A significant project event | "First successful end-to-end agent generation with quality score 8.2/10" |
| `problem` | A recurring issue or anti-pattern | "Agent repeatedly tried to `Write` files it hadn't `Read` first, triggering Edit tool errors" |
| `bugfix` | A bug diagnosis and resolution | "Race condition in index writes — fixed by adding `fcntl.flock` before `os.replace`" |
| `feature` | A new capability added | "Added `--dry-run` flag to the promotion CLI to preview instinct writes without committing" |
| `refactor` | A structural improvement | "Extracted `_validate_component()` from three call sites into a shared helper" |
| `discovery` | New knowledge about the codebase or domain | "The `evaluation-criteria.yaml` file is the single source of truth for axis weights — agents must load it, not hardcode" |

## ObservationRecord Schema

Defined as a `@dataclass` in `observation_store.py`:

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `timestamp` | `str` | yes | — | ISO-8601 UTC |
| `tool` | `str` | yes | — | Tool or agent that was observed |
| `input_summary` | `str` | yes | — | What the tool/agent was asked to do |
| `project_id` | `str` | yes | — | Project identifier |
| `project_name` | `str` | yes | — | Human-readable project name |
| `session_id` | `str` | no | `""` | Claude Code session ID |
| `agent_name` | `str` | no | `""` | Observing agent name |
| `type` | `ObservationType` | no | `"tool_use"` | One of the 9 types above |
| `evidence` | `str` | no | `""` | Supporting evidence text |
| `examples` | `list[str]` | no | `[]` | Concrete usage examples |
| `outcome` | `str` | no | `""` | Result of the observed action |
| `confidence` | `float` | no | `1.0` | Confidence score in [0.0, 1.0] |
| `pattern_label` | `str \| None` | no | `None` | Clustering key for promotion |
| `promoted_to` | `str \| None` | no | `None` | Instinct name if promoted |

## Key Invariants

- The observer subagent is **read-only** — it never writes files or
  executes shells. This enforces the HE1 generator/evaluator boundary.
- The observation store uses **atomic append** — a temp file is written
  then `os.replace`'d into place, with `fcntl.flock` for concurrency.
- `pattern_label` must be `None` or a non-empty string (no empty strings).
- `confidence` must be in `[0.0, 1.0]`.
- The `type` field is validated against `OBSERVATION_TYPES` at
  construction time — unknown types raise `ObservationValidationError`.

## Source Files

| File | Role |
|------|------|
| [`agents/observer-subagent.md`](../agents/observer-subagent.md) | Observer agent definition (trigger contract, output format) |
| [`src/platxa_agent_generator/observation_store.py`](../src/platxa_agent_generator/observation_store.py) | `ObservationRecord`, `ObservationStore`, `ObservationType`, atomic JSONL persistence |
| [`src/platxa_agent_generator/promotion_engine.py`](../src/platxa_agent_generator/promotion_engine.py) | Downstream consumer — clusters observations into instinct candidates |
