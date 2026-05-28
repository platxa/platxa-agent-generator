# Classification Rules Reference

Lookup tables and scoring rules for classifying an agent description into an
**architecture type** (simple / orchestrator / multi-agent / pipeline), an
**estimated complexity** (1-5), and a **suggested workflow pattern**. The
architecture-subagent consults this file during Step 1 of its workflow.

These rules absorb the keyword indicators and scoring algorithm that
previously lived in `type_classifier.py` (deleted in feature #21 / commit
`55aded37`). They are authoritative — the agent definition no longer carries
duplicate prose.

## Architecture Indicators

Each architecture type is matched against a list of `strong` and `moderate`
indicators. Indicators are matched case-insensitively as substrings against
the lowercased description; a few `moderate` indicators use `.*` as a regex
hint (denoted below) and are matched with `re.search` semantics.

### Orchestrator

| Strength | Indicators |
|----------|------------|
| strong | `orchestrat`, `coordinate`, `delegate`, `manage workers`, `spawn`, `distribute tasks`, `main agent`, `worker agents`, `decompos`, `break down`, `subtasks`, `subagents` |
| moderate | `multiple workers`, `team of`, `supervise`, `dispatch`, `fan out`, `parallelize`, `concurrent workers` |

> Prefixes like `orchestrat` and `decompos` deliberately catch conjugations
> (`orchestrating`, `decomposition`) without listing every form.

### Multi-Agent

| Strength | Indicators |
|----------|------------|
| strong | `multi-agent`, `multiple agents`, `agent team`, `collaborat`, `peer agents`, `independent agents`, `agent network`, `agents working together` |
| moderate | `several agents`, `different agents`, `specialized agents`, `agent roles`, `role-based`, `crew of` |

### Pipeline

| Strength | Indicators |
|----------|------------|
| strong | `pipeline`, `sequential`, `chain of`, `stages`, `step by step`, `phase by phase`, `workflow stages`, `processing chain`, `data pipeline`, `ETL` |
| moderate | `then`, `after that`, `followed by`, `next step`, `first.*then` (regex), `process.*transform.*output` (regex), `input.*process.*output` (regex) |

### Simple

| Strength | Indicators |
|----------|------------|
| strong | `single agent`, `simple`, `straightforward`, `direct`, `basic`, `one agent`, `standalone` |
| moderate | `just`, `only`, `simply`, `quick` |

## Type Scoring Algorithm

For each architecture type, compute a score against the description:

1. **Count strong matches** — each contributes **2 points**.
2. **Count moderate matches** — each contributes **1 point**. Regex
   indicators (those containing `.*`) are matched with `re.search` against
   the lowercased description; plain indicators are matched as substrings.
3. **Normalize** — divide the raw score by `6.0` and cap at `1.0`. This
   produces a value in `[0.0, 1.0]`.

```
raw_score = 2 × |strong matches| + 1 × |moderate matches|
normalized_score = min(raw_score / 6.0, 1.0)
```

### Picking the Winner

After scoring all four types:

1. Choose the type with the **highest normalized score**.
2. If the winning score is **< 0.15** (no indicator cleared the floor),
   override the winner to **Simple**, replace its `winner_score` with
   `0.5` (so downstream consumers see a non-zero placeholder), and skip
   the margin formula — confidence is fixed at `0.3`. This is the "we're
   guessing" fallback.
3. If the top score is **tied across two or more types and Simple is
   *not* among the tied types**, override the winner to **Simple** with
   confidence `0.3`. The margin formula can't disambiguate a tie among
   non-Simple types, so we surrender rather than picking arbitrarily.

   When Simple **is** among the tied types (a 2- or 3-way tie that
   includes Simple), Simple is chosen as the winner and the margin formula
   below runs as normal. In that case `max_other == winner_score`,
   `margin == 0`, and confidence resolves to `0.5` — *not* the `0.3`
   fallback.

### Confidence

When the winner is clear (not a low-confidence fallback):

```
max_other  = highest score among non-winning types
margin     = (winner_score − max_other) / winner_score
confidence = min(0.5 + 0.5 × margin, 1.0)
```

Round confidence to two decimal places. A clear winner therefore yields
confidence ≥ 0.5; a near-tie yields confidence near 0.5. A
low-confidence fallback (no matches, or a non-Simple-only tie) is fixed
at `0.3` so callers can gate on `< 0.5` to detect uncertainty.

> **Note**: the score-clamp in the `< 0.15` fallback (replacing
> `winner_score` with `0.5`) only affects what a consumer reading the
> blueprint's score field would see. The classification itself is Simple
> with confidence `0.3`. Treat `confidence` as authoritative; do not
> compare `winner_score` against `0.15` after the fact.

## Complexity Indicators

Complexity is estimated on a **1-5 scale** using a separate keyword
catalogue plus description length.

| Strength | Indicators |
|----------|------------|
| high | `complex`, `sophisticated`, `advanced`, `enterprise`, `large-scale`, `distributed`, `scalable`, `production`, `multiple`, `various`, `different types`, `comprehensive` |
| medium | `moderate`, `several`, `some`, `various`, `configurable`, `flexible`, `extensible` |
| low | `simple`, `basic`, `straightforward`, `quick`, `single`, `one`, `minimal`, `lightweight` |

### Complexity Algorithm

Let `high_count`, `medium_count`, `low_count` be the number of matched
high/medium/low keywords (substring, case-insensitive). Let `word_count`
be `len(description.split())`.

1. **Base score**:
   - `high_count ≥ 2` **or** `word_count > 50` → base = **4**
   - `high_count ≥ 1` **or** `medium_count ≥ 2` → base = **3**
   - `low_count ≥ 2` → base = **1**
   - `medium_count ≥ 1` **or** `word_count > 20` → base = **2**
   - otherwise → base = **2** (medium-low default)

2. **Pattern adjustment** — if any of `orchestrat`, `multi-agent`, or
   `pipeline` appear in the description, bump the base to at least **3**.

3. **Clamp** the final value to the inclusive range `[1, 5]`.

## Architecture → Pattern Mapping

| Architecture Type | Default Workflow Pattern |
|-------------------|--------------------------|
| Simple | prompt-chaining |
| Orchestrator | orchestrator-workers |
| Multi-Agent | parallelization |
| Pipeline | prompt-chaining |

### Pattern Adjustments

After looking up the default, override based on description keywords. The
first matching rule wins:

| Description contains | Override pattern |
|----------------------|------------------|
| `parallel` or `concurrent` | parallelization |
| `iterative`, `refine`, or `feedback` | evaluator-optimizer |
| `route`, `classify`, or `categorize` | routing |

If none of the override keywords match, keep the default from the
architecture → pattern table.

## Reasoning Output

After classification, emit a one-sentence reasoning string of the form:

```
Classified as <type> based on indicators: 'orchestrat', 'spawn', 'decompos'
(+2 more). Complexity: medium.
```

Where the complexity label is:

| Score | Label |
|-------|-------|
| 1 | low |
| 2 | medium-low |
| 3 | medium |
| 4 | high |
| 5 | very high |

If no indicators matched, the reasoning is `Default classification to
<type> based on absence of complex patterns.` and the complexity label is
omitted.

## Worked Example

Description: *"Build an orchestrator that decomposes user requests into
parallel subtasks and synthesises worker results."*

1. **Type scoring**
   - Orchestrator: strong matches `orchestrat`, `decompos`, `subtasks` →
     `2×3 = 6`; moderate match `parallelize` (no, "parallel" alone is not
     in moderate list) → `+0`. Normalized: `min(6/6, 1.0) = 1.0`.
   - Multi-Agent: no strong matches; no moderate matches. Normalized:
     `0.0`.
   - Pipeline: no strong matches; no moderate matches. Normalized: `0.0`.
   - Simple: no matches. Normalized: `0.0`.
   - Winner: **Orchestrator** with score `1.0`.

2. **Confidence**: `max_other = 0.0`, `margin = (1.0 − 0.0) / 1.0 = 1.0`,
   `confidence = min(0.5 + 0.5 × 1.0, 1.0) = 1.0`.

3. **Complexity**: `high_count = 0`, `medium_count = 0`, `low_count = 0`,
   `word_count = 14`. Base = `2` (default). Pattern adjustment fires
   (`orchestrat` present), so base = `max(2, 3) = 3`.

4. **Pattern**: default for Orchestrator is `orchestrator-workers`. The
   description contains `parallel`, so the override fires and the final
   pattern is **parallelization**.

5. **Reasoning**: `Classified as orchestrator based on indicators:
   'orchestrat', 'decompos', 'subtasks'. Complexity: medium.`
