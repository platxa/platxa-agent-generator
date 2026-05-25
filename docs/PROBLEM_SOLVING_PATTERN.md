# Problem-Solving Pattern — Localize / Repair / Validate

The problem-solving subagent implements the three-phase pattern that
dominates the SWE-bench leaderboard: **Localize** the fault, **Repair**
it with a targeted fix, and **Validate** that the fix is correct and
introduces no regressions.

## Background: SWE-bench Analysis

The SWE-bench benchmark measures autonomous bug-fixing on real GitHub
issues. Leaderboard analysis shows that the highest-scoring agents
share a common structure:

1. **Localization first**: Top agents spend most tokens on narrowing
   the search space before generating any patch. Agents that jump to
   repair without localization waste context on wrong files.

2. **Targeted patches**: Successful patches are small and targeted.
   Agents that rewrite large sections introduce regressions. The
   "Agentless" approach (Xia et al., 2024) demonstrated that
   hierarchical localization + single-function repair outperforms
   whole-file rewrite strategies.

3. **Self-verification**: Agents that run tests after patching catch
   their own mistakes before submission. The validation phase is not
   optional — it is the primary source of repair-loop feedback.

## Phase Model

### Phase 1: Localize

**Goal**: Narrow the fault to a specific function or code block.

**Steps**:
1. **Reproduce** — Run the failing test or trigger the error to confirm
   the symptom exists and capture the exact error message.
2. **Search** — Use `Grep` and `Glob` to find relevant files. Start
   broad (error message, function name), then narrow (call sites,
   data flow).
3. **Read** — Use targeted `Read` with `offset` + `limit` on the
   top candidates. Never load full files unnecessarily.
4. **Rank** — Order candidates by relevance. The Spectrum-Based Fault
   Localization (SBFL) heuristic: code that executes in failing tests
   but not passing tests is the most likely fault site.

**Output**: 1–3 candidate locations with file path, line range, and
confidence score.

### Phase 2: Repair

**Goal**: Generate a minimal, correct fix.

**Steps**:
1. **Analyze** — Understand the root cause (not just the symptom).
   Ask: "Why does this code produce the wrong result?"
2. **Fix** — Apply the smallest change that addresses the root cause.
   Prefer `Edit` over `Write` to minimize blast radius.
3. **Scope** — Do not fix adjacent issues, refactor, or add features.
   One bug, one fix.

**Output**: A diff containing only the repair.

### Phase 3: Validate

**Goal**: Prove the fix is correct and regression-free.

**Steps**:
1. **Run failing test** — Confirm it now passes.
2. **Run related tests** — Confirm no regressions in the same module.
3. **Type check** — Run `pyright` (or language equivalent) to catch
   type errors introduced by the fix.
4. **Lint** — Run `ruff check` to catch style violations.

**Output**: All checks green, or a specific list of remaining failures
to feed back into Phase 2.

## Bounded Recovery Protocol

The problem-solving subagent enforces a bounded retry loop:

| Attempt | Action |
|---------|--------|
| 1 | Localize → Repair → Validate |
| 2 | Re-localize with new evidence → Repair → Validate |
| 3 | Escalate to user with diagnosis + evidence |

Maximum 3 attempts. If validation still fails after attempt 3, the
agent presents its findings (candidate locations, attempted fixes,
remaining failures) and asks the user to intervene.

## Mapping to Existing Primitives

| Phase | Primitive in this repo |
|-------|-----------------------|
| Reproduce | Bash tool (run test, capture error) |
| Search | `Grep`, `Glob` tools; `/jit-retrieval` skill |
| Read | `Read` with `offset` + `limit` |
| Fix | `Edit` tool (targeted replacement) |
| Validate | `/verify` skill (7-step deterministic loop) |
| Escalate | `AskUserQuestion` tool |
