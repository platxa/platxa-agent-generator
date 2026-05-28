# Agent Pattern Reference Documentation

Comprehensive reference documentation for agent patterns based on Anthropic's "Building Effective Agents" research.

## Pattern References

| Pattern | Complexity | Use Case | Key Strength |
|---------|------------|----------|--------------|
| [Prompt Chaining](prompt-chaining.md) | Low | Sequential workflows | Reliability |
| [Routing](routing.md) | Low | Input classification | Specialization |
| [Parallelization](parallelization.md) | Medium | Independent subtasks | Speed |
| [Orchestrator-Workers](orchestrator-workers.md) | High | Dynamic decomposition | Flexibility |
| [Evaluator-Optimizer](evaluator-optimizer.md) | High | Iterative refinement | Quality |

## Generation References

| Reference | Purpose |
|-----------|---------|
| [Tool Selection Tables](tool-selection-tables.md) | Base tools, domain tools, least-privilege rules |
| [README Generation](readme-generation.md) | Agent catalogue README structure and extraction |
| [CLAUDE.md Generation](claudemd-generation.md) | Project context file sections and domain guidance |
| [Command Generation](command-generation.md) | Slash command file structure and frontmatter schema |
| [Generation Report](generation-report.md) | Quality report format and severity ordering |
| [Interactive Phases](interactive-phases.md) | Six-phase wizard and frontmatter field mappings |
| [MCP Server Templates](mcp-server-templates.md) | Pre-defined server configs and domain recommendations |
| [Regeneration Prompts](regeneration-prompts.md) | Per-axis feedback format for ITERATE verdicts |
| [Hook Config Templates](hooks-config-templates.md) | Hook events, matchers, script templates, security patterns |
| [Multi-Agent System Templates](multiagent-system-templates.md) | Predefined system patterns, orchestrator/worker structures |
| [Prompt Templates](prompt-templates.md) | Type roles, capabilities, workflows, domain enhancements |
| [Export Templates](export-templates.md) | Package/plugin README, manifest schema, archive formats |
| [Composer Templates](composer-templates.md) | Sequential, parallel, routing, orchestrator composition patterns |

## Pattern Selection Guide

### Start Simple

> "The most successful implementations start with simple, composable patterns."
> — Anthropic Research

1. **Can the task be solved with a single LLM call?** → Use direct prompting
2. **Is the workflow predictable and sequential?** → Use Prompt Chaining
3. **Do different inputs need different handling?** → Use Routing
4. **Are subtasks independent?** → Use Parallelization
5. **Is task scope unpredictable?** → Use Orchestrator-Workers
6. **Does output need iterative improvement?** → Use Evaluator-Optimizer

### Complexity Trade-offs

```
Simple                                              Complex
  |                                                    |
  v                                                    v
Direct → Prompt Chaining → Routing → Parallel → Orchestrator → Evaluator
         [Most Common]                [Most Powerful]   [Highest Quality]
```

## Core Principles

### 1. Agentic Loops

All patterns leverage the fundamental agentic loop:

```
User Request → LLM → Tool Call → Result → LLM → ... → Final Response
```

### 2. Tool Design

Effective agents require well-designed tools:

- **Clear descriptions**: LLM must understand when to use each tool
- **Appropriate granularity**: Neither too atomic nor too broad
- **Error handling**: Tools should return actionable error messages
- **Composability**: Tools should work well together

### 3. Context Management

Each subagent operates in its own context window:

- Share only necessary context between agents
- Use structured outputs for clean handoffs
- Consider token limits in design

## Implementation with Claude Code

### Task Tool Integration

Claude Code's Task tool enables multi-agent patterns:

```markdown
tools: Read, Grep, Task  # Task enables subagent spawning
```

### Subagent Types

Available specialized agents:

- `Explore` - Codebase exploration
- `Plan` - Implementation planning
- `Bash` - Command execution
- `general-purpose` - Flexible tasks

## Best Practices

See [best-practices.md](best-practices.md) for detailed guidance on:

- Agent definition structure
- Tool permission strategies
- Error handling patterns
- Testing approaches
- Security considerations

## Quick Reference

### Minimal Agent Definition

```yaml
---
name: agent-name
description: What this agent does
tools: Read, Grep, Glob
---

# Agent Name

## Overview
Brief description.

## Workflow
1. Step one
2. Step two

## Examples
### Example: Basic Usage
User: "Do something"
Agent: [Description of response]
```

### Pattern Selection Flowchart

```
                    ┌─────────────────┐
                    │ Task Analysis   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        Sequential?    Classification?  Independent
              │              │          Subtasks?
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐   ┌──────────┐   ┌────────────┐
        │ Prompt  │   │ Routing  │   │ Parallel   │
        │Chaining │   │          │   │            │
        └─────────┘   └──────────┘   └────────────┘
              │
              │ Dynamic scope?
              ▼
        ┌─────────────┐
        │Orchestrator │
        │  Workers    │
        └─────────────┘
              │
              │ Needs refinement?
              ▼
        ┌─────────────┐
        │ Evaluator   │
        │ Optimizer   │
        └─────────────┘
```

## Resources

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Agent SDK Reference](https://docs.anthropic.com/agent-sdk)
