# Parallelization Pattern

Concurrent execution of independent subtasks with result aggregation.

## When to Use

- **Independent subtasks**: Tasks don't depend on each other
- **Speed critical**: Parallel execution reduces total time
- **Batch processing**: Same operation on multiple items
- **Multi-perspective analysis**: Different views of same input

## Pattern Variants

### Sectioning

Divide work into independent sections:

```
         ┌─────────────┐
         │   Input     │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌───────┐  ┌───────┐  ┌───────┐
│Sect A │  │Sect B │  │Sect C │
└───┬───┘  └───┬───┘  └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │
                ▼
         ┌─────────────┐
         │  Aggregate  │
         └─────────────┘
```

### Voting

Multiple perspectives on same input:

```
         ┌─────────────┐
         │   Input     │
         │  (shared)   │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌───────┐  ┌───────┐  ┌───────┐
│View 1 │  │View 2 │  │View 3 │
└───┬───┘  └───┬───┘  └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │
                ▼
         ┌─────────────┐
         │   Voting/   │
         │  Consensus  │
         └─────────────┘
```

## Implementation

### Agent Definition

```yaml
---
name: parallel-analyzer
description: Analyzes code from multiple perspectives concurrently
tools: Read, Grep, Glob, Task
---

# Parallel Analyzer

## Concurrent Tasks

Launch these analyses in parallel:

1. **Security Analysis** (Task: security-scanner)
2. **Style Analysis** (Task: style-checker)
3. **Complexity Analysis** (Task: complexity-analyzer)
4. **Documentation Analysis** (Task: doc-checker)

## Workflow

### 1. Decompose
- Identify target files/scope
- Prepare shared context
- Define subtask parameters

### 2. Dispatch (Parallel)
- Launch all subtasks via Task tool
- Pass relevant context to each
- Don't wait between launches

### 3. Collect
- Gather results from all subtasks
- Handle partial failures gracefully
- Track completion status

### 4. Aggregate
- Combine results into unified report
- Resolve conflicts if voting
- Prioritize findings by severity
```

## Example: Multi-File Security Scan

```markdown
---
name: security-batch-scanner
description: Scans multiple files for security issues in parallel
tools: Read, Grep, Glob, Task
---

# Security Batch Scanner

## Workflow

### 1. File Discovery
```bash
# Find all scannable files
glob: "**/*.{py,js,ts,go}"
exclude: ["node_modules/**", "venv/**", "*.test.*"]
```

### 2. Batch Creation
- Group files by type/directory
- Create batches of ~10 files each
- Ensure balanced workload

### 3. Parallel Scanning
For each batch, spawn security-scanner:
```
Task(security-scanner, batch_N_files)
```

All batches run concurrently.

### 4. Result Aggregation
Combine findings:
- Deduplicate similar issues
- Sort by severity
- Group by category
- Calculate overall score

### Output
```json
{
  "files_scanned": 47,
  "batches": 5,
  "execution_time": "12.3s",
  "findings": {
    "critical": [...],
    "high": [...],
    "medium": [...],
    "low": [...]
  }
}
```
```

## Example: Voting Pattern

```markdown
---
name: code-quality-voter
description: Multiple quality perspectives with voting
tools: Read, Task
---

# Code Quality Voter

## Perspectives

1. **Readability Expert**
   - Focus: naming, structure, comments
   - Weight: 0.3

2. **Performance Expert**
   - Focus: complexity, efficiency
   - Weight: 0.3

3. **Security Expert**
   - Focus: vulnerabilities, best practices
   - Weight: 0.4

## Voting Process

### 1. Parallel Analysis
Each expert analyzes the same code independently.

### 2. Score Collection
```json
{
  "readability": {"score": 7.5, "issues": [...]},
  "performance": {"score": 8.0, "issues": [...]},
  "security": {"score": 6.5, "issues": [...]}
}
```

### 3. Weighted Aggregation
```
final_score = (7.5 * 0.3) + (8.0 * 0.3) + (6.5 * 0.4)
            = 2.25 + 2.4 + 2.6
            = 7.25
```

### 4. Consensus Report
- Combined issues from all perspectives
- Weighted final score
- Majority recommendations
```

## Advantages

1. **Speed**: N parallel tasks ≈ time of slowest task
2. **Thoroughness**: Multiple perspectives catch more issues
3. **Scalability**: Easy to add more parallel workers
4. **Resilience**: Partial failures don't block all results

## Disadvantages

1. **Resource intensive**: Multiple concurrent contexts
2. **Aggregation complexity**: Combining results can be tricky
3. **No cross-task learning**: Tasks can't inform each other
4. **Overhead**: Setup/teardown for each task

## Best Practices

### 1. True Independence

Ensure tasks are actually independent:
- No shared state modifications
- No order dependencies
- No resource conflicts

### 2. Balanced Workloads

Distribute work evenly:
- Similar batch sizes
- Similar complexity per task
- Avoid one task blocking aggregation

### 3. Graceful Degradation

Handle partial failures:
```markdown
### Error Handling

If a subtask fails:
1. Log the failure with details
2. Continue with other subtasks
3. Report partial results clearly
4. Indicate which analyses are missing
```

### 4. Result Normalization

Ensure comparable outputs:
```python
# All subtasks should return:
{
    "status": "success" | "error",
    "findings": [...],  # Normalized format
    "metadata": {...}
}
```

## Anti-Patterns

### Hidden Dependencies

❌ **Bad**: Task B reads file Task A modifies
✅ **Good**: All tasks read-only, or truly independent

### Unbalanced Batches

❌ **Bad**: 1 file vs 100 files per batch
✅ **Good**: Similar workload per batch

### No Aggregation Strategy

❌ **Bad**: Just concatenate all results
✅ **Good**: Deduplicate, prioritize, synthesize

## Comparison with Other Patterns

| Aspect | Parallelization | Prompt Chaining | Orchestrator |
|--------|-----------------|-----------------|--------------|
| Execution | Concurrent | Sequential | Dynamic |
| Dependencies | None | Each on previous | Determined at runtime |
| Best for | Batch ops, voting | Fixed workflows | Complex decomposition |

## Template

See [templates/parallelization.md](../templates/parallelization.md) for the full generation template.
