# Interactive Phase Reference

Six-phase wizard structure for guided agent generation. Each phase maps to
an AskUserQuestion invocation. The generation-subagent uses these phases
when running in interactive mode.

## Phase Sequence

| # | Phase | Purpose |
|---|-------|---------|
| 1 | Discovery | Identify agent type, domain, and complexity |
| 2 | Architecture | Select workflow pattern and subagent needs |
| 3 | Generation | Choose tools and example inclusion |
| 4 | Frontmatter | Map user intent to agent frontmatter fields |
| 5 | Validation | Configure failure handling and quality threshold |
| 6 | Installation | Set scope and overwrite behavior |

## Phase 1: Discovery

| Question | Options | Default |
|----------|---------|---------|
| Agent Type | analyzer, builder, automation, guide | — |
| Domain | general, web, data/ML, devops/infra | general |
| Complexity | simple, standard, advanced | simple |

## Phase 2: Architecture

| Question | Options | Default |
|----------|---------|---------|
| Workflow Pattern | sequential, routing, parallel, orchestrator | sequential |
| Use Subagents? | no, yes | no |

## Phase 3: Generation

| Question | Options | Default | Multi-select |
|----------|---------|---------|-------------|
| Tool Categories | files, search/navigate, execute commands, web access | files | yes |
| Include Examples? | yes, no | yes | no |

## Phase 4: Frontmatter Field Mappings

### Security Posture → permissionMode

| User Choice | permissionMode Value |
|-------------|---------------------|
| Restrictive (plan only) | `plan` |
| Balanced (default) | *(omitted)* |
| Trusted (auto-accept) | `acceptEdits` |

### Model Complexity → model

| User Choice | model Value |
|-------------|-------------|
| Low (fast) | `haiku` |
| Standard | `sonnet` |
| High (deep analysis) | `opus` |

### Task Duration → maxTurns

| User Choice | maxTurns Value |
|-------------|---------------|
| Short (<5 min) | 15 |
| Medium (5–20 min) | 40 |
| Long (>20 min) | 100 |

## Phase 5: Validation

| Question | Options | Default |
|----------|---------|---------|
| On Failure | auto-fix, manual review, skip | auto-fix |
| Min Quality Score | 7.0, 8.0, 5.0 | 7.0 |

## Phase 6: Installation

| Question | Options | Default |
|----------|---------|---------|
| Install Scope | user (~/.claude/agents/), project (.claude/agents/), none | user |
| Overwrite Behavior | backup & replace, skip existing, force replace | backup & replace |

## AskUserQuestion Format

Each phase question maps to this tool invocation structure:

```json
{
  "question": "Which workflow pattern should this agent use?",
  "header": "Pattern",
  "options": [
    {"label": "Sequential (Recommended)", "description": "Fixed steps with quality gates"},
    {"label": "Routing", "description": "Input classification to specialized handlers"},
    {"label": "Parallel", "description": "Independent concurrent subtasks"},
    {"label": "Orchestrator", "description": "Dynamic task decomposition"}
  ],
  "multiSelect": false
}
```

## Answer Resolution

The frontmatter mapping accepts both label names and canonical values:

- `"Restrictive (plan only)"` → `plan`
- `"plan"` → `plan`
- `"Low (fast)"` → `haiku`
- `"haiku"` → `haiku`
