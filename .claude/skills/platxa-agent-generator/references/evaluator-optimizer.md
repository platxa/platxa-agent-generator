# Evaluator-Optimizer Pattern

Iterative refinement loop where output is evaluated and improved until quality criteria are met.

## When to Use

- **Quality critical**: Output must meet specific standards
- **Iterative improvement**: Multiple passes improve results
- **Clear criteria**: Can objectively evaluate quality
- **Refinement possible**: Output can be meaningfully improved

## Pattern Structure

```
                    ┌─────────────┐
                    │   Input     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
              ┌────▶│  Generator  │
              │     └──────┬──────┘
              │            │
              │            ▼
              │     ┌─────────────┐
              │     │  Evaluator  │◀──── Criteria
              │     └──────┬──────┘
              │            │
              │      Pass? │
              │            │
              │     ┌──────┴──────┐
              │     │             │
              │    Yes           No
              │     │             │
              │     ▼             │
              │ ┌────────┐        │
              │ │ Output │        │
              │ └────────┘        │
              │                   │
              │            ┌──────┴──────┐
              │            │  Optimizer  │
              │            │ (Feedback)  │
              │            └──────┬──────┘
              │                   │
              └───────────────────┘
```

## Implementation

### Agent Definition

```yaml
---
name: code-optimizer
description: Iteratively improves code quality through evaluation and refinement
tools: Read, Write, Edit, Grep, Glob, Bash
---

# Code Optimizer

## Components

### Generator
Creates initial output or applies improvements.

### Evaluator
Assesses output against quality criteria:
- Code correctness
- Style compliance
- Performance metrics
- Security standards

### Optimizer
Provides specific feedback for improvement:
- What's wrong
- How to fix it
- Priority of issues

## Workflow

### Iteration Loop

```
max_iterations = 5
current = generate_initial()

for i in range(max_iterations):
    evaluation = evaluate(current)

    if evaluation.passes_all_criteria:
        return current

    feedback = optimize(evaluation)
    current = apply_improvements(current, feedback)

return current  # Best effort after max iterations
```

## Example: Documentation Generator

```markdown
---
name: doc-optimizer
description: Generates and iteratively improves documentation
tools: Read, Write, Grep, Glob
---

# Documentation Optimizer

## Quality Criteria

1. **Completeness** (weight: 0.3)
   - All public APIs documented
   - Examples for complex functions
   - Error handling described

2. **Clarity** (weight: 0.3)
   - No jargon without explanation
   - Consistent terminology
   - Logical organization

3. **Accuracy** (weight: 0.4)
   - Code examples work
   - Descriptions match behavior
   - No outdated information

**Threshold:** 8.0/10 to pass

## Iteration Process

### Round 1: Initial Generation
- Generate documentation from code analysis
- Score: typically 5-6/10

### Round 2: Completeness Pass
- Add missing API documentation
- Include more examples
- Score: typically 7/10

### Round 3: Clarity Pass
- Simplify complex explanations
- Add glossary for terms
- Improve structure
- Score: typically 7.5/10

### Round 4: Accuracy Pass
- Test all code examples
- Verify descriptions
- Update outdated content
- Score: typically 8.5/10

## Termination Conditions

Stop when:
- Score >= 8.0 (success)
- Max iterations reached (5)
- No improvement in 2 rounds
- Critical error encountered
```

## Example: Refactoring with Tests

```markdown
---
name: safe-refactor
description: Refactors code with test-verified iterations
tools: Read, Write, Edit, Bash, Grep, Glob
---

# Safe Refactoring Agent

## Evaluation Criteria

1. **Tests Pass**: All existing tests must pass
2. **Behavior Preserved**: No functional changes
3. **Quality Improved**: Measurable metrics improvement
4. **Style Consistent**: Follows project conventions

## Iteration Loop

### Step 1: Apply Refactoring
Make a single, atomic refactoring change.

### Step 2: Run Tests
```bash
pytest tests/ -v
```

### Step 3: Evaluate
- Did tests pass? → Continue
- Tests failed? → Revert, try different approach

### Step 4: Measure Improvement
- Complexity reduced?
- Readability improved?
- Duplication decreased?

### Step 5: Decide
- Improvement significant? → Keep change
- No improvement? → Revert, try alternative
- Quality threshold met? → Stop

## Feedback Format

```json
{
  "iteration": 3,
  "tests_status": "passed",
  "metrics": {
    "complexity_before": 15,
    "complexity_after": 12,
    "improvement": "20%"
  },
  "issues_remaining": [
    "Long method in process_order (lines 45-90)"
  ],
  "next_action": "Extract calculate_totals method"
}
```
```

## Advantages

1. **Quality assurance**: Output meets defined standards
2. **Self-correction**: Fixes own mistakes
3. **Measurable**: Clear metrics for improvement
4. **Controllable**: Max iterations prevent infinite loops

## Disadvantages

1. **Latency**: Multiple iterations take time
2. **Cost**: Multiple LLM calls per output
3. **Criteria dependency**: Only as good as evaluation criteria
4. **Diminishing returns**: Later iterations improve less

## Best Practices

### 1. Clear Criteria

Define objective, measurable criteria:

```python
QUALITY_CRITERIA = {
    "completeness": {
        "weight": 0.3,
        "threshold": 0.9,
        "measure": "documented_apis / total_apis"
    },
    "accuracy": {
        "weight": 0.4,
        "threshold": 1.0,
        "measure": "working_examples / total_examples"
    },
    "style": {
        "weight": 0.3,
        "threshold": 0.8,
        "measure": "lint_score"
    }
}
```

### 2. Actionable Feedback

Evaluator should provide specific guidance:

❌ **Bad**: "Quality is low, improve it"
✅ **Good**: "Missing docstring for `process_order()` function, lines missing return type hints: 45, 67, 89"

### 3. Iteration Limits

Prevent infinite loops:

```markdown
## Termination Conditions

1. Quality threshold met (success)
2. Max iterations reached (5)
3. No improvement for 2 iterations (plateau)
4. Critical error (fail fast)
```

### 4. Progress Tracking

Show improvement over iterations:

```markdown
## Progress Report

| Iteration | Score | Improvement | Actions |
|-----------|-------|-------------|---------|
| 1         | 5.2   | -           | Initial |
| 2         | 6.8   | +1.6        | Added examples |
| 3         | 7.5   | +0.7        | Fixed errors |
| 4         | 8.2   | +0.7        | Style fixes |

**Final:** 8.2/10 (PASSED)
```

## Anti-Patterns

### Vague Criteria

❌ **Bad**: "Make the code better"
✅ **Good**: "Reduce cyclomatic complexity below 10"

### No Exit Condition

❌ **Bad**: Loop until perfect
✅ **Good**: Max 5 iterations or quality >= 8.0

### Destructive Optimization

❌ **Bad**: Each iteration may break previous fixes
✅ **Good**: Improvements are additive, verified

### Ignoring Plateaus

❌ **Bad**: Keep iterating even with no improvement
✅ **Good**: Stop if 2 iterations show no gain

## Comparison with Other Patterns

| Aspect | Evaluator-Optimizer | Prompt Chaining | Orchestrator |
|--------|---------------------|-----------------|--------------|
| Iterations | Multiple (loop) | Single pass | Varies |
| Focus | Quality refinement | Task sequence | Task distribution |
| Termination | Criteria-based | Fixed steps | Task completion |

## Template

See [templates/evaluator-optimizer.md](../templates/evaluator-optimizer.md) for the full generation template.
