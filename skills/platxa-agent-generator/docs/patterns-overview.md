# Agent Patterns Overview

The Platxa Agent Generator supports five agent patterns based on Anthropic's research on building effective AI agents. Each pattern is suited for different types of tasks.

## Pattern Selection Guide

```
                    Is the task decomposition known upfront?
                            /                    \
                          Yes                    No
                          /                        \
                   Fixed steps?              Dynamic breakdown?
                    /        \                      |
                  Yes        No               Orchestrator-Workers
                  /            \
          Prompt Chaining    Need iteration?
                              /          \
                            Yes          No
                            /              \
                  Evaluator-Optimizer    Are subtasks independent?
                                          /              \
                                        Yes              No
                                        /                  \
                              Parallelization           Routing
```

## Pattern Comparison

| Pattern | Complexity | Speed | Use When |
|---------|------------|-------|----------|
| Prompt Chaining | Low | Medium | Fixed sequential steps |
| Routing | Low | Fast | Input classification needed |
| Parallelization | Medium | Fast | Independent concurrent tasks |
| Orchestrator-Workers | High | Varies | Dynamic task breakdown |
| Evaluator-Optimizer | High | Slow | Quality refinement needed |

---

## 1. Prompt Chaining

**Best for:** Sequential tasks with fixed steps where each step builds on the previous.

### How It Works

```
Input → Step 1 → Step 2 → Step 3 → Output
              ↓         ↓
           (gate)    (gate)
```

Each step passes its output to the next. Optional "gates" can validate before proceeding.

### Example Use Cases

- Code review pipelines (parse → analyze → report)
- Document processing (extract → transform → format)
- Data validation (check syntax → validate schema → verify values)

### When to Use

- Task has clear, predictable steps
- Each step's output is the next step's input
- Order matters
- You need checkpoints/validation between steps

### Generated Structure

```markdown
## Workflow

1. **Parse Input**
   - Extract code from provided files
   - Gate: Verify files exist and are readable

2. **Analyze Code**
   - Check for common issues
   - Gate: Ensure analysis completed

3. **Generate Report**
   - Format findings as structured output
   - Gate: Validate report schema
```

---

## 2. Routing

**Best for:** Directing inputs to specialized handlers based on classification.

### How It Works

```
Input → Classifier → Route A → Handler A
                  → Route B → Handler B
                  → Route C → Handler C
```

A classifier examines the input and routes to the appropriate specialized handler.

### Example Use Cases

- Multi-language code review
- Support ticket categorization
- Document type handling

### When to Use

- Inputs vary significantly in type
- Different handlers needed for different inputs
- Classification is straightforward
- Handlers are independent

### Generated Structure

```markdown
## Routing Rules

### Classification Criteria
- **Python Code**: Files with .py extension or Python syntax
- **JavaScript Code**: Files with .js/.ts extension
- **Configuration**: Files with .yaml/.json/.toml extension

### Routes
1. **Python Handler**: Static analysis, type checking, PEP8
2. **JavaScript Handler**: ESLint rules, TypeScript validation
3. **Config Handler**: Schema validation, security checks
```

---

## 3. Parallelization

**Best for:** Independent tasks that can run concurrently.

### How It Works

```
Input → Splitter → [Task 1] ←┐
                → [Task 2]   ├→ Aggregator → Output
                → [Task 3] ←─┘
```

Tasks run in parallel, and results are aggregated.

### Variants

- **Sectioning**: Split input into independent sections
- **Voting**: Multiple models answer, take majority
- **Validation**: Different validators check different aspects

### Example Use Cases

- Multi-file code analysis
- Parallel test execution
- Multi-aspect document review

### When to Use

- Tasks are truly independent
- Speed is important
- Results can be meaningfully combined
- Resources support parallelism

### Generated Structure

```markdown
## Parallel Execution

### Task Distribution
Split files into independent analysis tasks.

### Workers
- Worker 1: Syntax analysis
- Worker 2: Security scan
- Worker 3: Performance check

### Aggregation Strategy
Merge findings, deduplicate, sort by severity.
```

---

## 4. Orchestrator-Workers

**Best for:** Complex tasks requiring dynamic decomposition and coordination.

### How It Works

```
Input → Orchestrator → Plan → [Worker 1] ←┐
              ↑               [Worker 2]   ├→ Synthesize → Output
              └─ Adapt ←───── [Worker 3] ←─┘
```

The orchestrator analyzes the task, creates a plan, delegates to workers, and adapts based on results.

### Example Use Cases

- Full codebase refactoring
- Complex research tasks
- Multi-component system analysis

### When to Use

- Task complexity is unknown upfront
- Subtasks emerge during execution
- Coordination between workers needed
- Results require synthesis

### Generated Structure

```markdown
## Orchestration

### Planning Phase
1. Analyze input to determine scope
2. Identify required subtasks
3. Assign workers to subtasks

### Execution Phase
- Launch workers in optimal order
- Monitor progress
- Handle dependencies between workers

### Synthesis Phase
- Collect all worker outputs
- Resolve conflicts
- Generate unified result
```

---

## 5. Evaluator-Optimizer

**Best for:** Tasks requiring iterative refinement with feedback loops.

### How It Works

```
Input → Generator → Output → Evaluator → Feedback
              ↑                    ↓
              └──── Refinement ←───┘
```

Generate output, evaluate quality, refine based on feedback, repeat until quality threshold met.

### Example Use Cases

- Code quality improvement
- Documentation refinement
- Test coverage enhancement

### When to Use

- Quality can be objectively measured
- Iterative improvement is valuable
- Clear evaluation criteria exist
- Diminishing returns are acceptable

### Generated Structure

```markdown
## Iteration Loop

### Generation
Create initial output based on requirements.

### Evaluation
Score output against criteria:
- Correctness: Does it work?
- Completeness: All requirements met?
- Quality: Follows best practices?

### Refinement
Based on evaluation feedback:
- Address identified issues
- Improve weak areas
- Maintain passing criteria

### Termination
Stop when:
- Quality score ≥ threshold
- Max iterations reached
- No improvement in N iterations
```

---

## Choosing the Right Pattern

### Decision Matrix

| Requirement | Recommended Pattern |
|-------------|---------------------|
| Fixed steps, quality gates | Prompt Chaining |
| Input classification | Routing |
| Independent parallel tasks | Parallelization |
| Dynamic task breakdown | Orchestrator-Workers |
| Quality refinement | Evaluator-Optimizer |

### Hybrid Approaches

Patterns can be combined:

- **Routing + Prompt Chaining**: Route to specialized pipelines
- **Orchestrator + Parallelization**: Orchestrator spawns parallel workers
- **Prompt Chaining + Evaluator**: Add evaluation loop to pipeline

### Starting Simple

> Start with the simplest pattern that could work.
> Only add complexity when you hit limitations.

1. Try **Prompt Chaining** first
2. Add **Routing** if inputs vary
3. Add **Parallelization** if speed is critical
4. Graduate to **Orchestrator-Workers** for complex adaptive tasks
5. Add **Evaluator-Optimizer** when quality iteration is needed

## Further Reading

- [Prompt Chaining Details](../references/prompt-chaining.md)
- [Routing Details](../references/routing.md)
- [Parallelization Details](../references/parallelization.md)
- [Orchestrator-Workers Details](../references/orchestrator-workers.md)
- [Evaluator-Optimizer Details](../references/evaluator-optimizer.md)
