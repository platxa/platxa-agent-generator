# Prompt Chaining Pattern

Sequential workflow where each step's output feeds into the next step's input.

## When to Use

- **Predictable workflows**: Steps are known in advance
- **Quality over speed**: Each step can be optimized independently
- **Gate-keeping needed**: Intermediate validation between steps
- **Clear dependencies**: Step N requires output from Step N-1

## Pattern Structure

```
Input → Step 1 → Gate → Step 2 → Gate → Step 3 → Output
            ↓         ↓         ↓
         Validate  Validate  Validate
```

## Implementation

### Agent Definition

```yaml
---
name: sequential-processor
description: Processes tasks through defined sequential steps
tools: Read, Write, Grep, Glob
---
```

### Workflow Structure

```markdown
## Workflow

### Step 1: Input Analysis
- Parse and validate input
- Extract key parameters
- **Gate**: Proceed only if input is valid

### Step 2: Data Collection
- Gather required information
- Read relevant files
- **Gate**: Proceed only if data is complete

### Step 3: Processing
- Apply transformations
- Execute core logic
- **Gate**: Proceed only if processing succeeds

### Step 4: Output Generation
- Format results
- Validate output
- Return to user
```

## Gate Functions

Gates validate step outputs before proceeding:

```python
def validate_step(output: StepOutput) -> bool:
    """
    Gate function for step validation.

    Returns:
        True to proceed, False to stop/retry
    """
    if not output.is_complete:
        return False
    if output.has_errors:
        return False
    return True
```

## Example: Code Documentation Pipeline

```markdown
---
name: doc-pipeline
description: Generate documentation through sequential analysis
tools: Read, Write, Grep, Glob
---

# Documentation Pipeline

## Workflow

### 1. File Discovery
- Glob for source files
- Filter by file type
- **Gate**: At least one file found

### 2. Code Analysis
- Parse each file
- Extract public APIs
- Identify documentation gaps
- **Gate**: Analysis complete for all files

### 3. Documentation Generation
- Generate docstrings
- Create module summaries
- Build README sections
- **Gate**: All sections generated

### 4. Quality Check
- Validate markdown syntax
- Check example code
- Verify links
- **Gate**: Quality score > 7.0

### 5. Output
- Write documentation files
- Report summary
```

## Advantages

1. **Reliability**: Each step is isolated and testable
2. **Debuggability**: Failures are localized to specific steps
3. **Quality control**: Gates prevent bad data propagation
4. **Simplicity**: Easy to understand and maintain

## Disadvantages

1. **Sequential bottleneck**: Can't parallelize independent work
2. **Latency**: Multiple LLM calls add up
3. **Rigidity**: Hard to adapt to unexpected inputs

## Best Practices

### 1. Clear Step Boundaries

Each step should have:
- Single responsibility
- Defined input format
- Defined output format
- Clear success criteria

### 2. Meaningful Gates

Gates should check:
- Data completeness
- Format validity
- Business rules
- Quality thresholds

### 3. Error Recovery

```markdown
### Error Handling

- If Step N fails, report specific error
- Include context for debugging
- Suggest remediation if possible
```

### 4. Progress Reporting

```markdown
### Progress Updates

After each step, report:
- Step completed
- Key outputs
- Next step preview
```

## Anti-Patterns

### Too Many Steps

❌ **Bad**: 10+ steps for simple task
✅ **Good**: 3-5 well-defined steps

### No Gates

❌ **Bad**: Steps flow without validation
✅ **Good**: Each step validates before proceeding

### Monolithic Steps

❌ **Bad**: Single step does everything
✅ **Good**: Steps have focused responsibilities

## Comparison with Other Patterns

| Aspect | Prompt Chaining | Parallelization | Orchestrator |
|--------|-----------------|-----------------|--------------|
| Execution | Sequential | Concurrent | Dynamic |
| Complexity | Low | Medium | High |
| Flexibility | Low | Medium | High |
| Reliability | High | Medium | Medium |

## Template

See [templates/prompt-chaining.md](../templates/prompt-chaining.md) for the full generation template.
