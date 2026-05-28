# Migration Guide — Python → Claude Code Built-in Tools

This document is for contributors onboarding to `platxa-agent-generator` after the 2026 reduction sprint. Across 48 features (commits `098e6b0f` through `e864a64f`), ~20,400 lines of Python were eliminated or thinned by moving behavior into Claude Code's built-in tools (`Glob`, `Read`, `Write`, `Edit`, `Grep`, `Bash`, `Task`, `AskUserQuestion`), subagent definitions under `agents/*.md`, and skill reference files under `skills/platxa-agent-generator/references/*.md`.

If you are looking for a module that used to exist, this guide tells you where its behavior went and which feature retired it.

## Reading this guide

- **Phase headings** match the categories in `.claude/feature_list.json` so each row is traceable back to a feature with rationale, commit hash, and reviewer verdict.
- **"Replacement target"** is the file (or built-in tool) that took over each module's responsibility. Skill references live at `skills/platxa-agent-generator/references/<file>.md`; agent definitions live at `agents/<name>.md`.
- **"LOC"** is the line count of the original module before reduction; for partial reductions the column shows `before → after`.

## Phase 1 — Category-A Elimination (8 modules, 4,453 LOC removed)

Pure wrappers around file I/O or simple formatting. Claude Code's built-in tools do the same work without a Python layer.

| Feature | Module | LOC | Commit | Replacement target |
|---|---|---:|---|---|
| #1 | `agent_readme_generator.py` | 342 | `098e6b0f` | `Glob` + `Read` + `Write` (via skill ref `readme-generation.md`) |
| #2 | `claudemd_generator.py` | 803 | `f2af43d8` | `Write` (via skill ref `claudemd-generation.md`) |
| #3 | `command_generator.py` | 650 | `a26d0e09` | `Write` (via skill ref `command-generation.md`) |
| #4 | `generation_report.py` | 245 | `c7043ad2` | Inline reasoning in `agents/team-lead.md` (skill ref `generation-report.md`) |
| #5 | `interactive_prompts.py` | 819 | `f9f25823` | Built-in tool `AskUserQuestion` |
| #6 | `mcp_config_generator.py` | 865 | `0ff28e6a` | `Write` + `Bash` (via skill ref `mcp-server-templates.md`) |
| #7 | `targeted_reprompt.py` | 189 | `a4d2788d` | Inline markdown assembly in `agents/team-lead.md` (skill ref `regeneration-prompts.md`) |
| #8 | `tool_selector.py` | 540 | `be79d6d0` | Reasoning in `agents/architecture-subagent.md` (skill ref `tool-selection-tables.md`, completed in feature #34) |

## Phase 2 — Category-B Template Extraction (5 partial reductions + 6 deletions, ~9,600 LOC removed)

Modules that mixed template rendering with validation/orchestration logic. Templates moved to skill references; the remaining Python keeps validation, checksum, or pattern-selection responsibilities.

### Partial reductions (template extraction)

| Feature | Module | LOC before → after | Commit | Replacement target |
|---|---|---:|---|---|
| #9 | `hooks_generator.py` | 2,710 → 751 | `a6901945` | Skill ref `hooks-config-templates.md` + Python validation retained |
| #10 | `multiagent_generator.py` | 2,122 (**deferred**) | n/a | Skill ref `multiagent-system-templates.md` authored; Python reduction deferred to a follow-up sprint. Python module remains authoritative; `tests/test_patterns.py` continues to invoke it as a subprocess. |
| #11 | `prompt_generator.py` | 1,211 (**deferred**) | n/a | Skill ref `prompt-templates.md` authored; Python reduction deferred to a follow-up sprint. Python module remains authoritative; `tests/test_domain_docs.py` continues to invoke it as a subprocess. |
| #12 | `agent_export.py` | 1,761 → 1,275 | `a6901945` | Skill ref `export-templates.md` + `Write` + `Bash`; manifest/checksum retained |
| #13 | `agent_composer.py` | 1,575 → 977 | `a6901945` | Skill ref `composer-templates.md` + cross-agent validation retained |

> **Deferred rows (#10, #11)**: the skill references were authored under feature #30 but the corresponding Python reductions never landed. Until they do, `multiagent_generator.py` and `prompt_generator.py` are the source of truth and the skill references serve as design-intent documentation only. Closing the deferral is tracked as a post-sprint follow-up; see issue tracker for the planned reduction PRs.

### Outright deletions (Phase-2 cohort)

| Feature | Module | LOC | Commit | Replacement target |
|---|---|---:|---|---|
| #14 | `context_discovery.py` | 429 | `a6901945` | `Glob` + `Grep` + `Read` in `agents/discovery-subagent.md` |
| #15 | `dry_run.py` | 837 | `a6901945` | `Read` + `Bash(diff)` orchestrated by `agents/team-lead.md` |
| #16 | `workflow_state.py` | 484 | `a6901945` | `Read` + `Write` on JSON state files, managed by `agents/team-lead.md` |
| #17 | `batch_generator.py` | 544 | `a6901945` | `Read` JSON spec + `Task` fan-out to `agents/generation-subagent.md` |
| #18 | `agent_upgrader.py` | 450 | `a6901945` | Built-in `Edit` tool (rules encoded in skill references) |
| #19 | `agent_analyzer.py` | 482 | `a6901945` | `Bash` (pytest/pyright) dispatched by `agents/validation-subagent.md` |

## Phase 3 — Claude Reasoning Delegation (8 modules, ~4,560 LOC removed)

Modules that implemented heuristics (regex parsing, scoring tables, classification rules) which Claude's native reasoning handles better. Most became zero-line agent-definition responsibilities; two retained a thin Python layer for serialization or ETA math.

| Feature | Module | LOC | Commit | Replacement target |
|---|---|---:|---|---|
| #20 | `extended_thinking.py` | 999 | `9a8db281` | Claude's native thinking budget — no Python replacement needed |
| #21 | `type_classifier.py` | 631 | `55aded37` | Reasoning in `agents/architecture-subagent.md` (skill ref `classification-rules.md`, completed in #34) |
| #22 | `completeness_checker.py` | 740 | `adc63176` | Reasoning in `agents/validation-subagent.md` + `agents/evaluator-subagent.md` (completed in #33) |
| #23 | `nlp_parser.py` (reduced) | 1,262 → ~200 | `22b2b454` | Claude's NL understanding replaces regex; ~200-line output formatter retained |
| #24 | `progress_tracker.py` (reduced) | 969 → 407 | `234a942f` | Claude Code hooks fire on lifecycle events; ETA calculation retained |
| #25 | `promotion_engine.py` (reduced) | 467 → 257 | `24a4d89d` | Threshold reasoning in `agents/instinct-promoter.md`; serialization retained |
| #26 | `weight_drift_check.py` | 206 | `9ad5838f` | Replaced by 30-line `check_agent_weight_tables()` in `quality_scorer.py` + shell-grep CI |
| #27 | `verdict_aggregator.py` | 151 | `8d81f063` | 30-line `_partition_unmet_axes()` inlined in `agent_generator.py`; severity-floor policy lives in `agents/gan-evaluator.md` |

## Phase 4 — CLI Thinning (1 module, 1,828 LOC removed)

| Feature | Module | LOC before → after | Commit | Replacement target |
|---|---|---:|---|---|
| #28 | `cli.py` | 2,453 → 625 | `8f14dc3d` | Per-area modules under `src/platxa_agent_generator/commands/` (`catalog.py`, `eval_run.py`, `evolve.py`, `health.py`, `instincts.py`, `observations.py`, `plugin.py`) |

Long-form generation and review subcommands dispatch through agents; pure-Python data subcommands (catalog reads, eval runs, instinct/observation queries, plugin install) stay in-process. See feature #28 in `feature_list.json` for the full rationale behind the per-area split.

## Enabling features (#29–#34, no module deletion)

Several features performed no deletion themselves but built the destinations that the deletion features in Phases 1–3 redirected to. They are listed here so a contributor searching `git log` for a feature ID lands on the right context:

| Feature | Scope | Commit |
|---|---|---|
| #29 | Created Category-A skill references (covers replacements for #1–#8) | `951231a9` |
| #30 | Created Category-B skill references (covers replacements for #9–#19) | `a6901945` |
| #31 | Updated `agents/generation-subagent.md` to read templates via skill references | `a6901945` |
| #32 | Updated `agents/discovery-subagent.md` to absorb `context_discovery.py` (#14) | `a6901945` |
| #33 | Updated `agents/validation-subagent.md` to absorb `completeness_checker.py` (#22) | `f1d79974` |
| #34 | Updated `agents/architecture-subagent.md` to absorb `type_classifier.py` (#21) and `tool_selector.py` (#8); also produced `classification-rules.md` and `tool-selection-tables.md` | `3062ed2c` |

## Phase 5 — Test Migration (8 features, no new source files)

Tests for eliminated modules were either deleted alongside the source (when the test covered Python-only mechanics now gone) or repointed at the agent that absorbed the behavior. Feature IDs #35 through #42 in `feature_list.json` track each test-file disposition; the `bookkeeping-reconciliation` verdict on each lists the exact commit and reasoning.

## Phase 6 — Cleanup

| Feature | Scope | Commit |
|---|---|---|
| #43 | Drop orphan `jinja2` dep + delete dead `instinct.md.j2` artifact | `4c715ed7` |
| #44 | Refresh CLAUDE.md layout + correct subagent tool grants | `ba52e418` |
| #45 | This migration guide | _(see git log)_ |
| #46 | Full pytest run (1,438 tests pass) at `4c715ed7` | _verification-only_ |
| #47 | Full pyright run (0 errors) at `4c715ed7` | _verification-only_ |
| #48 | Post-reduction eval baseline (6/6 representative scenarios pass) | `e864a64f` |

## How to find a replacement at runtime

If you encounter a code reference to a module not in the source tree:

1. **Search `feature_list.json`** for the module name — the `description`, `rationale`, and `agent_runs` fields explain the elimination.
2. **Check `git log --diff-filter=D --oneline -- src/platxa_agent_generator/<module>.py`** to confirm the deletion commit.
3. **Look up the replacement target** in the tables above and read the corresponding `agents/*.md` or `skills/platxa-agent-generator/references/*.md` file.
4. **For Phase-2 partial reductions**, the original module still exists at a smaller size — open it and the validation/checksum logic that remained is the post-reduction surface.

## References

- `.claude/feature_list.json` — authoritative per-feature record (description, rationale, commit hash, reviewer verdict)
- `CLAUDE.md` § _Source module roles_ — current module inventory grouped by responsibility
- `CLAUDE.md` § _Subagent Architecture_ — the 14 agents and their tool grants
- `docs/EVAL_BASELINE.md` — post-reduction eval results (v1 baseline)
- `docs/PLATXA_AGENT_GENERATOR.md` — full specification (predates reduction sprint)
