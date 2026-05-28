# Harness Review — Quarterly Audit Checklist

The agent harness (hooks, subagents, skills, evaluation pipeline)
accumulates scaffolding over time. This checklist drives a quarterly
review to prune dead code, validate assumptions, and recalibrate
thresholds.

## Quarterly Review Checklist

### 1. Hook Audit

- [ ] List all registered hooks in `settings.json`
- [ ] For each hook: confirm the script still exists at the registered path
- [ ] For each hook: confirm the trigger event is still relevant
- [ ] Remove hooks for deprecated features
- [ ] Check hook execution time — any over 5s should be investigated

### 2. Agent Inventory

- [ ] List all `.md` files in `agents/`
- [ ] For each agent: confirm it is dispatched somewhere (grep for the name)
- [ ] For each agent: confirm the tool grants match current needs
- [ ] Remove agents that are no longer dispatched
- [ ] Check for agents with overlapping responsibilities

### 3. Evaluation Pipeline

- [ ] Run all eval scenarios: `pytest tests/test_eval_*.py -v`
- [ ] Check pass rates against baseline — flag any >10% regression
- [ ] Review held-out scenarios for staleness
- [ ] Calibrate grader across model tiers (use `/eval-calibrate`)
- [ ] Update axis weights if project priorities have shifted

### 4. Instinct Health

- [ ] Run `gc_expired_instincts()` with `dry_run=True` — review candidates
- [ ] Check instinct count — if >50, review for redundancy
- [ ] Run dedup check across all instincts
- [ ] Verify `usage_count` distribution — unused instincts may need pruning
- [ ] Review instincts with `confidence < 0.5` — promote or prune

### 5. Observation Pipeline

- [ ] Check `observations.jsonl` size — if near cap (200), review eviction
- [ ] Verify observer subagent is still being dispatched on SubagentStop
- [ ] Review `pattern_label` distribution — consolidate sparse labels
- [ ] Check promotion pipeline — any candidates stuck below threshold?

### 6. Weight Drift

- [ ] Run `grep -EHn '^\|[[:space:]]*[A-Za-z_]+[[:space:]]*\|[[:space:]]*[0-9]+\.[0-9]+[[:space:]]*\|' agents/*.md` (empty output = clean)
- [ ] Fix any detected drift between YAML and agent files
- [ ] Review whether axis weights still reflect project priorities

### 7. Documentation

- [ ] Verify `CLAUDE.md` agent list is current
- [ ] Verify `plugin.json` surfaces match actual commands/agents
- [ ] Check that all docs/*.md files reference current file paths

## Review Schedule

| Quarter | Month | Focus Areas |
|---------|-------|-------------|
| Q1 | January | Full audit + threshold recalibration |
| Q2 | April | Hook + agent pruning |
| Q3 | July | Eval pipeline + instinct health |
| Q4 | October | Full audit + year-end cleanup |

## Reminder

After completing the quarterly review, update this file's "Last
reviewed" field and commit. This creates a git-trail of review cadence.

**Last reviewed**: Not yet reviewed (initial creation 2026-05-26)
