# CLAUDE.md Generation Reference

Templates for generating CLAUDE.md project context files for agents. The
generation-subagent reads these patterns and renders via Write.

## Section Order

A generated CLAUDE.md follows this section sequence:

1. Project Overview
2. Architecture
3. Development
4. References
5. Subagent Delegation *(if agent has subagents)*
6. Custom Sections *(domain-specific)*

## Project Overview Section

```markdown
# {Agent Name}

## Project Overview

**Agent:** {name}
**Description:** {description}
**Pattern:** {workflow_pattern} — {pattern_description}

### Input/Output

- **Accepts:** {input_types}
- **Produces:** {output_types}
```

### Pattern Descriptions

| Pattern | Description |
|---------|-------------|
| prompt-chaining | Fixed sequential steps with quality gates between each |
| routing | Input classification directing to specialized handlers |
| parallelization | Independent concurrent subtasks with result aggregation |
| orchestrator-workers | Dynamic task decomposition with adaptive coordination |
| evaluator-optimizer | Iterative refinement cycles with measurable improvement |

## Architecture Section

### Tool Grouping by Category

| Category | Tools |
|----------|-------|
| file_operations | Read, Write, Edit, Glob |
| search | Grep, Glob, WebSearch |
| execution | Bash, Task, LSP |
| web | WebSearch, WebFetch |
| interaction | AskUserQuestion, TodoWrite |
| notebook | NotebookEdit |

### Pattern-Specific Diagrams

**Orchestrator-Workers:**
```
┌─────────────────────────────┐
│        Orchestrator         │
│  ┌───────┐ ┌───────┐       │
│  │Worker1│ │Worker2│ ...   │
│  └───────┘ └───────┘       │
└─────────────────────────────┘
```

**Sequential Chain:**
```
[Input] → [Step 1] → [Gate] → [Step 2] → [Gate] → [Output]
```

**Parallelization:**
```
         ┌─[Task A]─┐
[Input]──┼─[Task B]─┼──[Aggregate]──[Output]
         └─[Task C]─┘
```

## Development Section

### Domain Guidance

| Domain | Focus Areas |
|--------|-------------|
| security | OWASP Top 10, injection prevention, auth/authz checks, secrets scanning |
| testing | Test isolation, edge cases, determinism, mocking strategies |
| documentation | PEP 257 docstrings, parameter/return docs, usage examples |
| refactoring | Behavior preservation, backward compatibility, design patterns |
| analysis | Code patterns, metrics collection, issue categorization, recommendations |

### Domain Inference Keywords

| Keywords in Description | Inferred Domain |
|------------------------|-----------------|
| security, vulnerability, audit, CVE, OWASP | security |
| test, spec, coverage, assertion, fixture | testing |
| document, docstring, readme, guide, tutorial | documentation |
| refactor, rename, extract, restructure, clean | refactoring |
| analyze, metric, pattern, review, inspect | analysis |

### Input/Output Type Inference

| Tool in Grant | Inferred Input | Inferred Output |
|---------------|----------------|-----------------|
| Read, Glob | Source files | — |
| Write | — | Generated files |
| Edit | — | Modified files |
| Bash | — | Command output |
| WebFetch | — | Web content |
| Task | — | Subagent results |
| Grep | Search queries | — |

## References Section

```markdown
## References

- [Agent Definition]({agent_path})
- [Pattern Reference](references/{pattern}.md)
- [Best Practices](references/best-practices.md)
```

## Subagent Delegation Section

Only include when the agent has `Task` in its tool grant:

```markdown
## Subagent Delegation

- **{subagent_name}**: {description}
- **{subagent_name}**: {description}

### When to Delegate

- {guidance for when to use each subagent}
```
