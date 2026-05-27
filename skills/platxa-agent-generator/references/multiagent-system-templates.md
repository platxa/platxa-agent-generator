# Multi-Agent System Templates

Pre-defined multi-agent system templates and composition patterns. The
architecture-subagent and generation-subagent consult these when building
coordinated agent teams.

## System Templates

| Template | Pattern | Workers | Description |
|----------|---------|---------|-------------|
| `code-review` | orchestrator-workers | 3 (security, style, logic) | Multi-agent code review system |
| `documentation` | pipeline | 2 (api-documenter, readme-generator) | Documentation generation pipeline |
| `test-suite` | parallel | 2 (unit-test, integration-test) | Parallel test generation |
| `routing` | routing | 3 (query, action, analysis handlers) | Classifier + specialized handlers |
| `evaluator-optimizer` | evaluator-optimizer | 3 (generator, evaluator, optimizer) | Iterative refinement with feedback loops |
| `parallelization` | parallelization | 3 (partition workers) | Concurrent execution with aggregation |
| `writer-reviewer` | writer-reviewer | 2 (writer, reviewer) | Feedback loop with clean-context review |
| `competing-hypothesis` | competing-hypothesis | 3 (investigators) | Adversarial debugging with 3-5 theories |

## Orchestrator Markdown Structure

```markdown
---
name: {system_name}-orchestrator
description: Orchestrates {pattern} workflow
tools: Task, Read, Write, Glob, Grep
---

# {System Name} Orchestrator

## Overview
Orchestrator agent that coordinates the {system_name} multi-agent system.

## Pattern
{Pattern Name}

## Worker Agents
- `{worker-1}`: Specialized worker
- `{worker-2}`: Specialized worker

## Workflow
### Phase 1: Task Analysis
### Phase 2: Worker Coordination
### Phase 3: Result Aggregation

## Error Handling
- If a worker fails, analyze the error
- Attempt retry with modified parameters
- Report unrecoverable errors with context
```

## Worker Markdown Structure

Workers include sections for both standalone and team usage:

```markdown
---
name: {worker-name}
description: {description}
tools: {tools}
isolation: worktree
---

# {Worker Name}

## Role
Worker agent in multi-agent system.

## Responsibilities
- {responsibility-1}
- {responsibility-2}

## Workflow
### Plan-First Mode (when orchestrator sends `plan_first: true`)
1. Receive task → Plan → Return plan → Wait for approval → Implement
### Direct Mode (default)
1. Receive task → Execute → Report results

## File Ownership
Only write to `owned_paths` assigned by orchestrator.

## Team Compatibility
Works both as standalone subagent and team teammate.
```

## Composition Patterns

| Pattern | Coordination | Worker Discovery | Error Strategy |
|---------|-------------|-----------------|----------------|
| Orchestrator-Workers | Dynamic task decomposition via Task tool | `Glob: .claude/agents/*.md` | Retry, fallback, escalate |
| Pipeline | Sequential steps, output chains to next | Fixed in agent definition | Stop pipeline, report partial |
| Parallel | Concurrent via multiple Task calls in ONE message | Fixed or dynamic | Continue on partial failure |
| Routing | Classifier dispatches to handler | Routing table in agent | Default handler, clarify |
| Evaluator-Optimizer | Generate-evaluate-optimize loop | Fixed roles | Max iterations, quality floor |
| Writer-Reviewer | Write-review loop with clean context | Fixed pair | Max iterations, finalize with warnings |
| Competing-Hypothesis | Adversarial investigation rounds | Fixed investigators | Escalate ties to user |

## Competing Hypothesis Defaults

5 default investigation focuses (ordered by frequency):

| Focus | Description |
|-------|-------------|
| `recent-change` | Bug from recent commit, dependency bump, or config change |
| `concurrency-timing` | Race conditions, ordering, deadlocks, timing-sensitive paths |
| `environment-dependency` | Version drift, missing env vars, OS/platform differences |
| `data-state` | Specific inputs, corrupted state, accumulated side effects |
| `integration-contract` | API contract violations, schema drift, protocol mismatches |

Investigator tools: `Read, Grep, Glob, Bash` with `isolation: worktree`.

## Worktree Isolation Rules

File-modifying tools that trigger `isolation: worktree`:

| Tool | Modifying | Isolation Required |
|------|-----------|-------------------|
| Write | Yes | Yes (for parallel workers) |
| Edit | Yes | Yes (for parallel workers) |
| Bash | Yes | Yes (for parallel workers) |
| Read | No | No |
| Grep | No | No |
| Glob | No | No |
| Task | No | No |

**Rule:** Workers with `Write`, `Edit`, or `Bash` in their tool list get
`isolation: worktree` when running in parallel. Orchestrators never need
isolation (they coordinate, not modify).

## Plan Approval Workflow

Workers support plan-first mode for orchestrator oversight:

| Criterion | Pass When |
|-----------|-----------|
| Scope | Matches assigned subtask, no scope creep |
| Approach | Uses appropriate tools, follows patterns |
| Conflicts | No overlap with other workers' file ownership |
| Completeness | All requirements addressed in plan |

## Task Sizing Guidelines

| Workers | Tasks per Worker | Total Tasks |
|---------|-----------------|-------------|
| 2 | 5-6 | 10-12 |
| 3 | 5-6 | 15-18 |
| 4 | 5-6 | 20-24 |

Task lifecycle: `pending` -> `in_progress` -> `completed` (or `failed`).

## Evaluator-Optimizer Quality Criteria

| Criterion | Weight | Threshold |
|-----------|--------|-----------|
| Clarity | 25% | 7.0/10 |
| Completeness | 25% | 7.0/10 |
| Correctness | 30% | 8.0/10 |
| Style | 20% | 6.0/10 |

Overall threshold: 7.0/10. Max iterations: 5. Convergence: stop when
improvement < 0.5 for 2 consecutive iterations.
