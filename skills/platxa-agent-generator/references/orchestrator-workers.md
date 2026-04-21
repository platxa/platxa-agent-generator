# Orchestrator-Workers Pattern

Dynamic task decomposition where a central orchestrator spawns specialized workers based on runtime analysis.

## When to Use

- **Unpredictable scope**: Can't know subtasks in advance
- **Complex decomposition**: Subtasks emerge from analysis
- **Heterogeneous work**: Different subtasks need different capabilities
- **Adaptive execution**: Strategy changes based on intermediate results

> **This is the MOST POWERFUL pattern from Anthropic's research.**

## Pattern Structure

```
                    ┌─────────────────┐
                    │   Orchestrator  │
                    │  (Coordinates)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │ Analyze      │ Spawn        │
              │ & Decompose  │ Workers      │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Worker A │  │ Worker B │  │ Worker C │
        │ (Task 1) │  │ (Task 2) │  │ (Task 3) │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │ Results
                            ▼
                    ┌─────────────────┐
                    │   Orchestrator  │
                    │  (Synthesize)   │
                    └─────────────────┘
```

## Implementation

### Orchestrator Agent

```yaml
---
name: feature-orchestrator
description: Coordinates feature implementation across multiple workers
tools: Read, Grep, Glob, Task
---

# Feature Orchestrator

## Overview

Analyzes feature requests, decomposes into implementation tasks,
spawns specialized workers, and synthesizes results.

## Workers Available

- **code-architect**: Designs implementation approach
- **code-writer**: Implements code changes
- **test-writer**: Creates test coverage
- **documentation-agent**: Updates documentation

## Workflow

### Phase 1: Analysis

1. Read feature request
2. Explore relevant codebase areas
3. Identify affected components
4. Assess complexity and scope

### Phase 2: Decomposition

Based on analysis, determine required tasks:

```
Feature Request
    │
    ├── Need new API? → spawn code-architect
    ├── Need code changes? → spawn code-writer (per file)
    ├── Need tests? → spawn test-writer
    └── Need docs? → spawn documentation-agent
```

### Phase 3: Execution

1. Spawn workers with specific contexts
2. Coordinate dependencies (architect before writer)
3. Handle worker failures gracefully
4. Collect results progressively

### Phase 4: Synthesis

1. Combine worker outputs
2. Verify integration points
3. Run final validation
4. Generate summary report

## Example Decomposition

Request: "Add user authentication to the API"

Analysis reveals:
- Need auth middleware
- Need user model updates
- Need login/logout endpoints
- Need session management
- Need tests for all above

Spawned workers:
1. code-architect → Design auth flow
2. code-writer → Implement middleware
3. code-writer → Update user model
4. code-writer → Add endpoints
5. test-writer → Create auth tests
6. documentation-agent → Update API docs
```

## Worker Design

### Worker Interface

Each worker should:
- Accept focused task description
- Have appropriate tool access
- Return structured result
- Handle errors gracefully

### Example Worker

```yaml
---
name: code-writer
description: Implements code changes based on specifications
tools: Read, Write, Edit, Grep, Glob
---

# Code Writer

## Input Format
```json
{
  "task": "Implement auth middleware",
  "files": ["src/middleware/auth.py"],
  "specifications": {...},
  "context": {...}
}
```

## Output Format
```json
{
  "status": "success",
  "files_modified": ["src/middleware/auth.py"],
  "changes_summary": "Added JWT validation middleware",
  "tests_needed": ["test_auth_middleware"]
}
```
```

## Advantages

1. **Flexibility**: Adapts to any task complexity
2. **Power**: Can handle arbitrarily complex requests
3. **Specialization**: Each worker optimized for its role
4. **Scalability**: Add workers as needed

## Disadvantages

1. **Complexity**: Most complex pattern to implement
2. **Overhead**: Orchestration adds latency
3. **Debugging**: Harder to trace issues
4. **Cost**: Multiple LLM calls

## Best Practices

### 1. Smart Decomposition

Don't over-decompose:
- Group related tasks for same worker
- Avoid creating too many tiny tasks
- Consider dependencies when splitting

### 2. Clear Worker Contracts

Define explicit interfaces:
```markdown
### Worker: code-writer

**Input:**
- task_description: string
- target_files: list[string]
- context: dict

**Output:**
- status: success | error
- files_modified: list[string]
- summary: string
```

### 3. Dependency Management

Track and enforce dependencies:
```
code-architect ──→ code-writer ──→ test-writer
                                      │
                                      ▼
                            documentation-agent
```

### 4. Progress Tracking

Keep user informed:
```markdown
### Progress Updates

After each worker completes:
- Report which task finished
- Show intermediate results
- Indicate remaining work
- Estimate completion
```

### 5. Error Recovery

Handle worker failures:
```markdown
### Error Handling

If worker fails:
1. Assess impact on other tasks
2. Retry if transient error
3. Skip if non-critical
4. Fail fast if critical
5. Report clear status
```

## Anti-Patterns

### Over-Orchestration

❌ **Bad**: Orchestrator for every simple task
✅ **Good**: Use simpler patterns when appropriate

### Chatty Workers

❌ **Bad**: Workers constantly check with orchestrator
✅ **Good**: Workers operate autonomously, report at end

### Monolithic Orchestrator

❌ **Bad**: Orchestrator does work instead of delegating
✅ **Good**: Orchestrator only coordinates, workers do work

### No Synthesis

❌ **Bad**: Just return raw worker outputs
✅ **Good**: Combine, validate, and synthesize results

## Advanced: Hierarchical Orchestration

For very complex tasks, orchestrators can spawn sub-orchestrators:

```
Main Orchestrator
    │
    ├── Backend Orchestrator
    │       ├── API Worker
    │       ├── DB Worker
    │       └── Auth Worker
    │
    └── Frontend Orchestrator
            ├── Component Worker
            ├── State Worker
            └── Style Worker
```

## Comparison with Other Patterns

| Aspect | Orchestrator | Parallelization | Prompt Chaining |
|--------|--------------|-----------------|-----------------|
| Decomposition | Dynamic | Fixed | Fixed |
| Dependencies | Managed | None | Sequential |
| Flexibility | Highest | Medium | Lowest |
| Complexity | Highest | Medium | Lowest |

## Template

See [templates/orchestrator-workers.md](../templates/orchestrator-workers.md) for the full generation template.
