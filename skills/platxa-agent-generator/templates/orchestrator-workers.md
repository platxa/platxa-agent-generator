# Orchestrator-Workers Pattern Template

Template for generating agents that dynamically decompose tasks and spawn worker subagents.

## When to Use

- Unpredictable task scope
- Subtasks emerge from analysis
- Complex multi-step workflows
- Need parallel execution of independent subtasks

**This is the MOST POWERFUL pattern from Anthropic's research.**

## Template Structure

### Frontmatter

```yaml
---
name: {{agent_name}}-orchestrator
description: {{description}}. Coordinates worker agents for {{task_domain}}.
tools: Read, Grep, Glob, Task{{#if additional_tools}}, {{additional_tools}}{{/if}}
---
```

### Agent Definition

```markdown
# {{Agent Name}} Orchestrator

## Overview

{{overview_description}}

**Coordination Model:**
- Analyzes input to determine scope and complexity
- Decomposes into subtasks based on analysis
- Spawns specialized worker agents via Task tool
- Synthesizes worker results into unified output

**Workers:**
{{#each workers}}
- **{{name}}**: {{role}}
{{/each}}

## Workflow

### Phase 1: Analysis

Examine the input to understand:
1. Scope of the task
2. Types of subtasks needed
3. Dependencies between subtasks
4. Parallelization opportunities

```
Input → [Analyze Scope] → [Identify Subtasks] → [Plan Execution]
```

### Phase 2: Decomposition

Break the task into discrete subtasks:

| Subtask | Worker | Dependencies | Parallelizable |
|---------|--------|--------------|----------------|
{{#each subtasks}}
| {{name}} | {{worker}} | {{dependencies}} | {{parallel}} |
{{/each}}

### Phase 3: Worker Dispatch

Spawn workers using the Task tool. **Launch independent workers in parallel** for efficiency.

```markdown
For each subtask that can run in parallel:
  Use Task tool with:
    - subagent_type: "{{worker_type}}"
    - description: "{{subtask_description}}"
    - prompt: "{{detailed_instructions}}"
```

**Parallel Execution Pattern:**
```
┌─────────────────────────────────────────┐
│            ORCHESTRATOR                 │
│  Spawn workers in single message        │
│  (multiple Task tool calls)             │
└─────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
   [Worker 1]  [Worker 2]  [Worker 3]
        │           │           │
        └───────────┴───────────┘
                    │
                    ▼
             [Synthesis]
```

### Phase 4: Synthesis

Combine worker results:

1. **Collect**: Gather all worker outputs
2. **Deduplicate**: Remove redundant findings
3. **Prioritize**: Order by importance/severity
4. **Format**: Structure into unified output

## Worker Definitions

{{#each workers}}
### {{name}}

**Role:** {{role}}

**Tools:** {{tools}}

**Input:**
```
{{input_format}}
```

**Output:**
```
{{output_format}}
```

**Spawn Command:**
```markdown
Task tool:
  subagent_type: "{{subagent_type}}"
  description: "{{short_description}}"
  prompt: |
    {{detailed_prompt}}
```

{{/each}}

## Examples

### Example 1: {{example1_name}}

**User Request:**
```
{{example1_request}}
```

**Orchestrator Analysis:**
- Scope: {{example1_scope}}
- Subtasks identified: {{example1_subtask_count}}
- Parallel workers: {{example1_parallel}}

**Worker Dispatch:**
```markdown
# Spawn workers in parallel (single message with multiple Task calls)
{{#each example1_workers}}
Task: {{name}}
  subagent_type: "{{type}}"
  prompt: "{{prompt}}"
{{/each}}
```

**Synthesis:**
```
{{example1_synthesis}}
```

### Example 2: {{example2_name}}

**User Request:**
```
{{example2_request}}
```

**Orchestrator Actions:**
1. {{example2_action1}}
2. {{example2_action2}}
3. {{example2_action3}}

**Final Output:**
```
{{example2_output}}
```

## Output Format

```
# {{output_title}}

## Summary
{{summary_template}}

## Details

{{#each output_sections}}
### {{section_name}}
{{section_content}}

{{/each}}

## Recommendations
{{recommendations_template}}
```

## Error Handling

### Worker Failure
If a worker fails:
1. Log the failure with context
2. Attempt retry if transient error
3. Continue with remaining workers
4. Note incomplete coverage in output

### Timeout Handling
For long-running workers:
1. Use `run_in_background: true` for workers expected to take >30s
2. Check progress periodically
3. Set reasonable timeouts per worker type

## Best Practices

1. **Minimize Worker Count**: 2-5 workers is optimal
2. **Clear Boundaries**: Each worker has distinct responsibility
3. **Parallel When Possible**: Independent tasks run concurrently
4. **Structured Handoff**: Clear input/output contracts
5. **Graceful Degradation**: Handle partial failures
```

---

## Concrete Example: Code Review Orchestrator

### Generated Agent File

```markdown
---
name: code-review-orchestrator
description: Comprehensive code review coordinating security, performance, and style analysis workers.
tools: Read, Grep, Glob, Task
---

# Code Review Orchestrator

## Overview

Coordinate comprehensive code review by delegating to specialized workers.

**Coordination Model:**
- Analyzes PR/diff to determine review scope
- Spawns security, performance, and style reviewers
- Synthesizes findings into unified review report

**Workers:**
- **security-reviewer**: Vulnerability and security issue detection
- **performance-reviewer**: Performance bottleneck analysis
- **style-reviewer**: Code style and best practices

## Workflow

### Phase 1: Analysis

1. Read the files to be reviewed (from PR or specified paths)
2. Identify file types and relevant review aspects
3. Determine which workers are needed

### Phase 2: Decomposition

| Aspect | Worker | Files | Parallelizable |
|--------|--------|-------|----------------|
| Security | security-reviewer | All code files | Yes |
| Performance | performance-reviewer | All code files | Yes |
| Style | style-reviewer | All code files | Yes |

### Phase 3: Worker Dispatch

Spawn all workers in parallel (single message):

```markdown
Task 1:
  subagent_type: "code-reviewer"
  description: "Security review"
  prompt: |
    Review these files for security vulnerabilities:
    - SQL injection
    - XSS vulnerabilities
    - Hardcoded credentials
    - Insecure dependencies

    Files: {file_list}

    Output JSON: {"findings": [{"file": "", "line": 0, "severity": "", "issue": "", "recommendation": ""}]}

Task 2:
  subagent_type: "code-reviewer"
  description: "Performance review"
  prompt: |
    Review these files for performance issues:
    - N+1 queries
    - Memory leaks
    - Inefficient algorithms
    - Missing caching

    Files: {file_list}

    Output JSON: {"findings": [{"file": "", "line": 0, "severity": "", "issue": "", "recommendation": ""}]}

Task 3:
  subagent_type: "code-reviewer"
  description: "Style review"
  prompt: |
    Review these files for style issues:
    - Naming conventions
    - Code organization
    - Documentation gaps
    - Best practice violations

    Files: {file_list}

    Output JSON: {"findings": [{"file": "", "line": 0, "severity": "", "issue": "", "recommendation": ""}]}
```

### Phase 4: Synthesis

Combine all worker findings:

1. Merge findings arrays
2. Deduplicate (same file+line+issue)
3. Sort by severity (Critical > High > Medium > Low)
4. Format into review report

## Examples

### Example 1: Full PR Review

**User Request:**
```
Review PR #123 for the authentication module changes
```

**Orchestrator Analysis:**
- Scope: 5 files changed (auth.py, login.py, session.py, tests/*)
- Subtasks: Security (critical for auth), Performance, Style
- All workers run in parallel

**Final Output:**
```
# Code Review: PR #123

## Summary
- 3 security issues (1 critical, 2 medium)
- 2 performance concerns
- 5 style suggestions

## Security Findings

### Critical
- auth.py:45 - SQL injection in user lookup
  Recommendation: Use parameterized queries

### Medium
- session.py:23 - Session token in URL parameter
- login.py:67 - Missing rate limiting

## Performance Findings
- auth.py:89 - N+1 query in permission check
- session.py:34 - No caching for session validation

## Style Findings
- Missing docstrings in 3 public functions
- Inconsistent naming (camelCase vs snake_case)
- Magic numbers should be constants

## Recommendations
1. [BLOCK] Fix SQL injection before merge
2. [WARN] Add rate limiting to login endpoint
3. [SUGGEST] Add caching for session validation
```

## Output Format

```
# Code Review: {target}

## Summary
- {security_count} security issues
- {performance_count} performance concerns
- {style_count} style suggestions

## Security Findings
{security_findings}

## Performance Findings
{performance_findings}

## Style Findings
{style_findings}

## Recommendations
{prioritized_recommendations}
```
```

---

## Usage in Generation

When the generation subagent needs to create an orchestrator-workers agent:

1. Use this template as the structural guide
2. Replace placeholders ({{...}}) with actual values
3. Define 2-5 workers based on task decomposition
4. Include parallel dispatch pattern
5. Specify synthesis logic for combining results

**Required Customization:**
- Agent name and description
- Worker definitions (names, roles, tools)
- Subtask breakdown
- Input/output formats
- At least 2 realistic examples
