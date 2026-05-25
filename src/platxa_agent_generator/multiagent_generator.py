#!/usr/bin/env python3
"""
Multi-Agent System Generator

Generates coordinated multi-agent systems with orchestrator and worker agents.

Patterns:
    - Orchestrator-Workers: Central agent decomposes and delegates tasks
    - Pipeline: Sequential processing through specialized agents
    - Parallel: Concurrent execution with result aggregation

Usage:
    python multiagent_generator.py generate --name "code-review" --workers 3
    python multiagent_generator.py templates                     # List templates
    python multiagent_generator.py example pipeline              # Show example
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# Tools that modify files — workers with these need worktree isolation
# when running in parallel to avoid conflicts.
FILE_MODIFYING_TOOLS = {"Write", "Edit", "Bash"}


@dataclass
class AgentDefinition:
    """Definition for a single agent in the system."""

    name: str
    description: str
    role: str  # orchestrator, worker, aggregator
    tools: list[str]
    responsibilities: list[str]
    inputs: list[str] = field(default_factory=list)
    outputs: list[str] = field(default_factory=list)
    isolation: str | None = None  # "worktree" for parallel file-modifying workers
    # Optional pattern-specific metadata. hypothesis_focus tags an investigator
    # in the competing-hypothesis pattern with the theory it pursues (e.g.
    # "recent-change", "concurrency-timing"). Kept as a simple optional field
    # so other patterns can ignore it without change.
    hypothesis_focus: str | None = None

    def to_markdown(self) -> str:
        """Generate agent markdown definition with team compatibility.

        Workers include sections for standalone usage AND team coordination,
        making them usable both as independent subagents and as team teammates.
        """
        tools_str = ", ".join(self.tools)
        responsibilities = "\n".join(f"- {r}" for r in self.responsibilities)
        isolation_line = f"\nisolation: {self.isolation}" if self.isolation else ""

        content = f"""---
name: {self.name}
description: {self.description}
tools: {tools_str}{isolation_line}
---

# {self.name.replace("-", " ").title()}

## Role
{self.role.title()} agent in multi-agent system.

## Responsibilities
{responsibilities}

## Inputs
{chr(10).join(f"- {i}" for i in self.inputs) if self.inputs else "- Task assignment from orchestrator"}

## Outputs
{chr(10).join(f"- {o}" for o in self.outputs) if self.outputs else "- Task completion report"}

## Workflow

### Plan-First Mode (when orchestrator sends `plan_first: true`)
1. Receive task assignment
2. **Plan** — describe what you will do WITHOUT implementing:
   - Files to read/modify
   - Approach and tools to use
   - Expected output structure
   - Scope estimate (S/M/L)
3. Return plan to orchestrator for approval
4. Wait for approval before proceeding
5. **Implement** the approved plan
6. Report results back to orchestrator

### Direct Mode (default)
1. Receive task assignment
2. Execute specialized processing
3. Report results back to orchestrator

## File Ownership

When the orchestrator includes `owned_paths` in your prompt, **only write
to those paths**. You may read any file, but writes outside your owned
paths will conflict with other workers running in parallel.

- If you need to modify a file outside your ownership, report it back
  to the orchestrator instead of writing directly
- Check `owned_paths` before every Write/Edit operation

## Team Compatibility

This agent works both as a **standalone subagent** and as a **team teammate**.

### Standalone Mode
When invoked directly via the Task tool without an orchestrator:
1. Accept the full task description in the prompt
2. Execute all responsibilities independently
3. Return structured results directly to the caller

### Team Mode
When coordinated by an orchestrator as part of a multi-agent team:
1. Accept scoped subtask from orchestrator
2. Check shared context for teammate outputs (if applicable)
3. Execute assigned responsibilities
4. Report results in the team's expected format

### Teammate Discovery
To find available teammates at runtime:
```
Glob tool: .claude/agents/*.md
```
Parse each agent's frontmatter to identify compatible teammates by role and tools.

### Shared Task Patterns
When working in a team, follow the task claiming workflow:

**Step 1: Claim task** — Mark your assigned task as in_progress:
```
TodoWrite tool:
  tasks:
    - id: "<assigned-task-id>"
      status: "in_progress"
```

**Step 2: Execute** — Perform the work described in the task

**Step 3: Complete** — Mark task as completed with results summary:
```
TodoWrite tool:
  tasks:
    - id: "<assigned-task-id>"
      status: "completed"
```

**Step 4: Report** — Return results to orchestrator in structured format

### Task Capacity
Each worker should handle **5-6 tasks** per assignment for optimal throughput.
If assigned more, process them sequentially. If assigned fewer, request more
from the orchestrator.
"""
        return content

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        data: dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "role": self.role,
            "tools": self.tools,
            "responsibilities": self.responsibilities,
            "inputs": self.inputs,
            "outputs": self.outputs,
        }
        if self.isolation is not None:
            data["isolation"] = self.isolation
        if self.hypothesis_focus is not None:
            data["hypothesis_focus"] = self.hypothesis_focus
        return data


@dataclass
class MultiAgentSystem:
    """Complete multi-agent system definition."""

    name: str
    description: str
    pattern: str  # orchestrator-workers, pipeline, parallel
    orchestrator: AgentDefinition
    workers: list[AgentDefinition]
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def get_all_agents(self) -> list[AgentDefinition]:
        """Get all agents in the system."""
        return [self.orchestrator, *self.workers]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "pattern": self.pattern,
            "orchestrator": self.orchestrator.to_dict(),
            "workers": [w.to_dict() for w in self.workers],
            "created_at": self.created_at,
        }

    def generate_orchestrator_markdown(self) -> str:
        """Generate orchestrator agent with Task tool coordination."""
        worker_names = [w.name for w in self.workers]
        worker_list = "\n".join(f"- `{name}`: Specialized worker" for name in worker_names)
        worker_spawns = "\n".join(
            f"   - Spawn `{name}` for {self.workers[i].responsibilities[0] if self.workers[i].responsibilities else 'specialized task'}"
            for i, name in enumerate(worker_names)
        )

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Write, Glob, Grep
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Orchestrator agent that coordinates the {self.name} multi-agent system.
Uses the Task tool to spawn and coordinate specialized worker agents.

## Pattern
{self.pattern.replace("-", " ").title()}

## Worker Agents
{worker_list}

## Workflow

### Phase 1: Task Analysis
1. Receive and analyze the incoming task
2. Break down into subtasks suitable for workers
3. Identify dependencies between subtasks

### Phase 2: Worker Coordination
1. For each subtask:
{worker_spawns}
2. Monitor worker progress
3. Handle any failures with retry or fallback

### Phase 3: Result Aggregation
1. Collect results from all workers
2. Synthesize into final output
3. Report completion status

## Spawning Workers

Use the Task tool to spawn workers:

```
Task tool with:
- subagent_type: <worker-name>
- prompt: <specific task description>
- description: <brief summary>
```

## Plan Approval Workflow

Workers must plan before implementing. This prevents wasted work and ensures
alignment between the orchestrator's intent and the worker's execution.

### How It Works
1. **Orchestrator assigns task** with `plan_first: true` in the prompt
2. **Worker returns a plan** (not implementation) describing:
   - What files/resources will be read
   - What changes will be made
   - Expected output structure
   - Estimated scope (small/medium/large)
3. **Orchestrator reviews the plan** against:
   - Does it address the original requirement?
   - Is the scope appropriate (not too broad or narrow)?
   - Are there conflicts with other workers' plans?
4. **Orchestrator approves or requests revision**
   - Approved: worker proceeds with implementation
   - Rejected: worker revises plan with specific feedback
5. **Worker implements the approved plan**

### Approval Criteria
| Criterion | Pass When |
|-----------|-----------|
| Scope | Matches assigned subtask, no scope creep |
| Approach | Uses appropriate tools, follows patterns |
| Conflicts | No overlap with other workers' file ownership |
| Completeness | All requirements addressed in plan |

### Worker Prompt Template (Plan Phase)
```
Plan the following task WITHOUT implementing it yet:
  Task: <description>
  Constraints: <boundaries>

Return a plan with:
1. Files to read/modify
2. Approach description
3. Expected output
4. Scope estimate (S/M/L)
```

## Error Handling
- If a worker fails, analyze the error
- Attempt retry with modified parameters
- Fall back to alternative approach if needed
- Report unrecoverable errors with context

## Teammate Discovery
To dynamically discover available workers at runtime:
```
Glob tool: .claude/agents/*.md
```
Parse each file's YAML frontmatter to identify agents by name and tools.
This allows the orchestrator to adapt when workers are added or removed
without hardcoding agent names.

## Shared Task List

### Task Creation (Orchestrator)
After decomposing the work, create tasks for workers using TodoWrite:

1. **Plan tasks** — aim for 5-6 tasks per worker for optimal granularity
2. **Create task list** with clear descriptions and acceptance criteria:
```
TodoWrite tool:
  tasks:
    - id: "task-1"
      description: "Review auth module for SQL injection"
      status: "pending"
    - id: "task-2"
      description: "Check input validation on API endpoints"
      status: "pending"
```
3. **Assign tasks** by including task IDs in worker prompts
4. **Monitor progress** — poll task statuses, reassign stalled tasks

### Task Sizing Guidelines
| Workers | Tasks per Worker | Total Tasks |
|---------|-----------------|-------------|
| 2 | 5-6 | 10-12 |
| 3 | 5-6 | 15-18 |
| 4 | 5-6 | 20-24 |

Keep tasks atomic — each should take one focused action, not a multi-step workflow.

### Task Lifecycle
```
pending → in_progress → completed
                      → failed (with reason)
```

## Worker File Ownership

Each worker MUST own a non-overlapping set of files/directories to prevent
conflicts when running in parallel. The orchestrator assigns ownership
boundaries when dispatching tasks.

### Ownership Rules
1. **No shared writes** — two workers must never write to the same file
2. **Read is always safe** — any worker can read any file
3. **Directories as boundaries** — assign ownership at the directory level when possible
4. **Explicit in prompt** — include `owned_paths: [...]` in the worker prompt

### Assignment Strategy
When decomposing tasks, assign file ownership:
```
Worker 1 prompt:
  owned_paths: ["src/auth/", "tests/test_auth.py"]
  task: "Refactor authentication module"

Worker 2 prompt:
  owned_paths: ["src/api/", "tests/test_api.py"]
  task: "Update API endpoints"
```

### Conflict Detection
Before dispatching, check for overlapping ownership:
- If two workers need the same file, serialize their tasks (one after the other)
- If a shared config file needs updates, assign it to one worker and pass the result to the next
- Use `isolation: worktree` for workers that need true file-level isolation

### Ownership Table Example
| Worker | Owned Paths | Read-Only Access |
|--------|------------|-----------------|
| auth-worker | src/auth/, tests/test_auth* | src/config.py |
| api-worker | src/api/, tests/test_api* | src/config.py, src/auth/types.py |
| test-worker | tests/integration/ | src/**/* (all source) |

## Output Format
Provide structured summary including:
- Tasks completed successfully
- Any issues encountered
- Final aggregated results
"""
        return content

    def generate_classifier_markdown(self) -> str:
        """Generate classifier agent markdown for routing pattern."""
        handler_table = "\n".join(
            f"| {w.name} | {w.description} | {', '.join(w.tools)} |" for w in self.workers
        )

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Grep
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Classifier agent that analyzes incoming requests and routes them to
specialized handler agents based on request type and content.

## Pattern
Routing (Classification → Handler Selection → Execution)

## Handler Agents
| Handler | Description | Tools |
|---------|-------------|-------|
{handler_table}

## Classification Rules

### Query Requests
Route to `query-handler` when request:
- Contains search/find/lookup keywords
- Asks for information retrieval
- Requests data queries

### Action Requests
Route to `action-handler` when request:
- Contains create/modify/update/delete keywords
- Requests file operations
- Asks for changes to be made

### Analysis Requests
Route to `analysis-handler` when request:
- Contains analyze/examine/inspect keywords
- Requests deep inspection
- Asks for reports or assessments

### Default Route
If classification is unclear, route to `analysis-handler` for initial assessment.

## Workflow

### Step 1: Classification
1. Parse incoming request
2. Extract key terms and intent
3. Match against classification rules
4. Determine target handler

### Step 2: Route
1. Prepare handler-specific prompt
2. Spawn handler using Task tool:
```
Task tool with:
  subagent_type: <handler-name>
  prompt: <request with context>
  description: "Handle <type> request"
```

### Step 3: Response
1. Receive handler result
2. Format response for user
3. Include handler attribution

## Error Handling
- Unknown request type → Route to analysis-handler
- Handler failure → Retry with alternative handler
- All handlers fail → Return error with suggestions
"""
        return content

    def generate_evaluator_orchestrator_markdown(self) -> str:
        """Generate feedback loop controller markdown for evaluator-optimizer pattern."""
        worker_table = "\n".join(f"| {w.name} | {w.role} | {w.description} |" for w in self.workers)

        def _first_by_role(role: str) -> AgentDefinition | None:
            return next((w for w in self.workers if w.role == role), None)

        generator = _first_by_role("generator")
        evaluator = _first_by_role("evaluator")
        optimizer = _first_by_role("optimizer")
        missing = [
            r
            for r, w in [
                ("generator", generator),
                ("evaluator", evaluator),
                ("optimizer", optimizer),
            ]
            if w is None
        ]
        if missing:
            raise ValueError(
                f"evaluator-optimizer system requires workers with roles "
                f"'generator', 'evaluator', 'optimizer'; missing: {missing}"
            )
        assert generator is not None
        assert evaluator is not None
        assert optimizer is not None
        generator_name = generator.name
        evaluator_name = evaluator.name
        optimizer_name = optimizer.name

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Write
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Feedback loop controller that orchestrates iterative content generation,
evaluation, and optimization until quality thresholds are met.

## Pattern
Evaluator-Optimizer (Generate → Evaluate → Optimize → Loop/Finalize)

## Worker Agents
| Agent | Role | Description |
|-------|------|-------------|
{worker_table}

## Quality Criteria
| Criterion | Weight | Threshold |
|-----------|--------|-----------|
| Clarity | 25% | ≥7.0/10 |
| Completeness | 25% | ≥7.0/10 |
| Correctness | 30% | ≥8.0/10 |
| Style | 20% | ≥6.0/10 |

**Overall threshold: ≥7.0/10 to finalize**

## Workflow

### Step 1: Initialize
1. Parse requirements and constraints
2. Set iteration limit (default: 5)
3. Initialize quality tracking

### Step 2: Generate
Spawn {generator_name}:
```
Task tool with:
  subagent_type: {generator_name}
  prompt: <requirements or improvement instructions>
  description: "Generate/improve content"
```

### Step 3: Evaluate
Spawn {evaluator_name}:
```
Task tool with:
  subagent_type: {evaluator_name}
  prompt: <generated content + criteria>
  description: "Evaluate content quality"
```

**Decision Point:**
- If score ≥ threshold → Proceed to Finalize
- If iterations exhausted → Proceed to Finalize with warning
- Otherwise → Proceed to Optimize

### Step 4: Optimize
Spawn {optimizer_name}:
```
Task tool with:
  subagent_type: {optimizer_name}
  prompt: <evaluation feedback>
  description: "Generate improvement plan"
```

Then loop back to Step 2 (Generate) with optimization instructions.

### Step 5: Finalize
1. Record final quality scores
2. Document iteration history
3. Return final content with quality report

## Iteration Tracking
```
Iteration | Score | Status
----------|-------|--------
1         | 5.2   | Continue
2         | 6.1   | Continue
3         | 7.4   | Finalized ✓
```

## Error Handling
- Generator failure → Retry with simplified requirements
- Evaluator failure → Use previous evaluation, flag for review
- Max iterations reached → Finalize with quality warning
- All workers fail → Return partial result with error report
"""
        return content

    def generate_writer_reviewer_orchestrator_markdown(self) -> str:
        """Generate orchestrator markdown for the writer-reviewer feedback pattern.

        The writer-reviewer pattern is a two-agent feedback loop:
        - A **writer** agent implements in an isolated worktree with full
          Write/Edit tooling, carrying the implementation context.
        - A **reviewer** agent reviews the writer's artifacts in a separate
          isolated worktree with read-only tools and NO access to the writer's
          reasoning — a fresh-context reviewer to avoid implementation bias
          (heuristic HE1: "generators don't evaluate themselves").

        The orchestrator coordinates the feedback loop: it dispatches the
        writer, captures artifacts (diff / changed files), hands those
        artifacts to the reviewer in a clean context, and then either
        finalizes (on APPROVE) or loops back to the writer with the
        reviewer's findings.
        """
        worker_table = "\n".join(f"| {w.name} | {w.role} | {w.description} |" for w in self.workers)
        writers = [w for w in self.workers if w.role == "writer"]
        reviewers = [w for w in self.workers if w.role == "reviewer"]
        writer_name = writers[0].name if writers else "writer"
        reviewer_name = reviewers[0].name if reviewers else "reviewer"

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Bash
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Writer-reviewer feedback loop orchestrator. Dispatches a **writer** agent to
implement, then dispatches a **reviewer** agent with a fresh context to
evaluate only the artifacts (diff / files), not the writer's reasoning. This
separation defeats the optimistic bias that self-reviewing generators exhibit.

## Pattern
Writer-Reviewer (Implement → Review with clean context → Loop or Finalize)

## Agents
| Agent | Role | Description |
|-------|------|-------------|
{worker_table}

## Feedback Loop

### Step 1: Dispatch Writer
Spawn `{writer_name}` to implement the task. The writer runs in an isolated
worktree so its file edits do not collide with concurrent reviewers or future
iterations.

```
Task tool with:
  subagent_type: {writer_name}
  prompt: <requirements> (+ reviewer feedback on iterations 2+)
  description: "Implement task"
```

### Step 2: Capture Artifacts
After the writer returns, collect the artifacts for review:
- `git diff` in the writer's worktree
- List of changed files
- Summary of writer output (NOT the writer's internal reasoning)

Only these artifacts are forwarded to the reviewer.

### Step 3: Dispatch Reviewer (Clean Context)
Spawn `{reviewer_name}` in its own isolated worktree. The reviewer receives
ONLY the artifacts from Step 2 — never the writer's transcript — so it
evaluates the code fresh.

```
Task tool with:
  subagent_type: {reviewer_name}
  prompt: |
    Review the following artifacts. Do not assume any context from prior
    turns. Evaluate against the original requirements.

    Requirements: <original task>
    Diff: <git diff output>
    Changed files: <list>

    Return VERDICT: APPROVE or REQUEST_CHANGES with specific findings.
  description: "Review writer artifacts with clean context"
```

**Decision Point:**
- VERDICT: APPROVE → Proceed to Finalize
- VERDICT: REQUEST_CHANGES and iteration < max_iterations → Loop to Step 1
  with the reviewer's findings prepended to the writer prompt
- iteration ≥ max_iterations → Finalize with outstanding review warnings

### Step 4: Finalize
1. Merge the writer's worktree into the main workspace
2. Record the iteration history (writer output + reviewer verdict per round)
3. Return the final artifacts with the approved review report

## Clean-Context Invariants
The reviewer MUST NOT receive:
- The writer's internal reasoning, thought process, or draft outputs
- Prior reviewer verdicts (each review starts fresh)
- Conversation history from the orchestrator

The reviewer MUST receive only:
- The original task requirements
- The diff / changed files produced by the writer

These invariants prevent the reviewer from inheriting the writer's framing —
which is the entire point of this pattern.

## Iteration Tracking
```
Iteration | Writer output          | Reviewer verdict   | Action
----------|------------------------|--------------------|-----------
1         | Initial implementation | REQUEST_CHANGES    | Loop
2         | Addresses findings #1  | APPROVE            | Finalize ✓
```

## Error Handling
- Writer failure → Retry once, then escalate to user
- Reviewer failure → Retain writer output, flag review as unverified
- Max iterations reached → Finalize with outstanding findings documented
- Worktree merge conflict → Halt, report conflict, do not overwrite
"""
        return content

    def generate_competing_hypothesis_orchestrator_markdown(self) -> str:
        """Generate orchestrator markdown for the competing-hypothesis pattern.

        Coordinates N investigators (3-5) across three adversarial rounds:

        1. Investigation — each investigator independently gathers evidence
           for its assigned hypothesis (no peer information)
        2. Challenge — every investigator must cite at least one peer's
           finding and present counter-evidence or a failed falsification test
        3. Refinement — investigators update their hypothesis in response
           to challenges; hypotheses that cannot address challenges are
           marked falsified

        The orchestrator then selects the surviving hypothesis with the
        strongest evidence and fewest unaddressed challenges, or escalates
        ties to the user.
        """
        investigators = [w for w in self.workers if w.role == "investigator"]
        if not investigators:
            # The pattern is meaningless without investigators; emitting an
            # empty "Dispatch all 0 investigators" template would silently
            # ship a broken orchestrator. Fail loud at generation time.
            raise ValueError(
                "competing-hypothesis system has no workers with role='investigator'; "
                "use create_competing_hypothesis_system() or ensure each worker dict "
                "in the template declares role='investigator'"
            )
        investigator_count = len(investigators)
        investigator_table = "\n".join(
            f"| {w.name} | {w.hypothesis_focus or 'unspecified'} | {w.description} |"
            for w in investigators
        )
        dispatch_block = "\n".join(
            f"- `{w.name}` → hypothesis: **{w.hypothesis_focus or 'unspecified'}**"
            for w in investigators
        )

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Write, Bash
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Competing-hypothesis debugging orchestrator. Dispatches {investigator_count}
investigators — each pursuing a distinct theory about the bug — then forces
them to challenge each other's findings in an adversarial round. This
defeats confirmation bias: no single investigator's theory passes
unchallenged, and the root cause survives the strongest counter-evidence.

## Pattern
Competing-Hypothesis (Assign → Investigate in parallel → Challenge → Refine → Select)

## Investigators
| Agent | Hypothesis Focus | Description |
|-------|------------------|-------------|
{investigator_table}

## Adversarial Workflow

### Round 1: Independent Investigation
Dispatch all {investigator_count} investigators in **parallel** via the Task
tool, each with its assigned hypothesis focus and NO visibility into peer
hypotheses. Independent investigation prevents framing contagion.

```
Parallel Task dispatches:
{dispatch_block}
```

Each investigator returns:
- Evidence chain linking its hypothesis to the observed bug
- At least one falsification test attempted (even if it failed to falsify)
- Confidence score (0-10) with justification

### Round 2: Peer Challenge
Broadcast each investigator's round-1 findings to ALL peers. Dispatch each
investigator again with the challenge brief. Every investigator MUST cite
at least one peer finding and present either:
- Counter-evidence that contradicts the peer's evidence chain, OR
- A falsification test the peer did not run, OR
- A logical gap in the peer's reasoning

Passes without a challenge are rejected — the orchestrator re-dispatches the
investigator with an explicit "cite a specific peer finding and challenge it"
instruction. This enforces adversarial pressure; unchallenged hypotheses are
the failure mode this pattern exists to prevent.

### Round 3: Refinement
Forward every challenge each investigator received back to its author. Each
investigator must either:
- Address the challenge with new evidence or a counter-argument, OR
- Concede the challenge and mark its hypothesis as falsified

### Selection
Tally per hypothesis:
- Evidence strength (original + refinement)
- Count of unaddressed challenges
- Count of falsification tests survived

Select the hypothesis with the **strongest evidence AND fewest unaddressed
challenges**. Ties escalate to the user with both hypotheses + their
evidence summaries — do not pick arbitrarily.

### Degenerate Case: Unanimous Round-1 Agreement
If all investigators converge on the same hypothesis in round 1 with no
surfaced challenges, treat this as insufficient adversarial pressure and
require a second challenge round with an explicit instruction to each
investigator: "find the weakest evidence in the shared hypothesis and
challenge it." Genuine root causes survive this stress test; brittle
consensus does not.

## Iteration Tracking
```
Round | Investigator          | Hypothesis           | Evidence | Challenges
------|-----------------------|----------------------|----------|------------
1     | investigator-1        | recent-change        | strong   | —
1     | investigator-2        | concurrency-timing   | weak     | —
1     | investigator-3        | environment-dep      | medium   | —
2     | investigator-1        | (challenges peer 2)  | —        | 1 issued
2     | investigator-2        | (challenges peer 1)  | —        | 1 issued
3     | investigator-2        | falsified            | —        | unaddressed
```

## Error Handling
- Investigator failure → Retry once with the same brief; on second failure
  record the slot as empty and reduce challenge counts accordingly
- All investigators fail → Halt, report; do not select a hypothesis
- User escalation on tie → Present both hypotheses with full evidence
  chains, recommend which falsification test to run next
"""
        return content

    def generate_parallel_orchestrator_markdown(self) -> str:
        """Generate parallel orchestrator markdown with concurrent Task tool calls."""
        worker_table = "\n".join(
            f"| {w.name} | {w.description} | {', '.join(w.tools)} |" for w in self.workers
        )

        # Generate worker names for parallel call example
        worker_names = [w.name for w in self.workers]

        content = f"""---
name: {self.orchestrator.name}
description: {self.orchestrator.description}
tools: Task, Read, Write, Glob
---

# {self.orchestrator.name.replace("-", " ").title()}

## Overview
Parallel orchestrator that decomposes tasks and executes them concurrently
across multiple specialized worker agents, then aggregates results.

## Pattern
Parallelization (Decompose → Parallel Execute → Aggregate)

## Worker Agents
| Agent | Description | Tools |
|-------|-------------|-------|
{worker_table}

## Workflow

### Step 1: Decompose
1. Analyze incoming task for parallelizable components
2. Partition work into independent subtasks
3. Validate subtasks have no circular dependencies

### Step 2: Parallel Execution
**CRITICAL: Launch all independent tasks in a SINGLE message with multiple Task tool calls.**

Example parallel invocation:
```xml
<function_calls>
<invoke name="Task">
  <parameter name="subagent_type">{worker_names[0] if worker_names else "worker-1"}</parameter>
  <parameter name="prompt">Process partition 1</parameter>
  <parameter name="description">Handle first partition</parameter>
</invoke>
<invoke name="Task">
  <parameter name="subagent_type">{worker_names[1] if len(worker_names) > 1 else "worker-2"}</parameter>
  <parameter name="prompt">Process partition 2</parameter>
  <parameter name="description">Handle second partition</parameter>
</invoke>
</function_calls>
```

**Key Rules:**
- All independent Task calls MUST be in the same message
- Do NOT wait for one task before starting another
- Use `run_in_background: true` for long-running tasks

### Step 3: Aggregate
1. Collect results from all parallel workers
2. Merge/combine results based on task type:
   - **Union**: Combine all results (e.g., search results)
   - **Reduce**: Summarize/aggregate (e.g., statistics)
   - **Concatenate**: Join sequentially (e.g., reports)
3. Resolve any conflicts between worker outputs
4. Format final aggregated result

## Partition Strategy
| Task Type | Partition By | Example |
|-----------|--------------|---------|
| File processing | File chunks | 100 files → 4 workers × 25 files |
| Search | Directories | src/, tests/, docs/ |
| Analysis | Modules | auth, api, db |
| Generation | Components | header, body, footer |

## Error Handling
- **Worker timeout**: Mark partition as failed, continue with others
- **Worker error**: Log error, attempt reassignment to available worker
- **Partial success**: Return completed results with failure report
- **All failures**: Return error with diagnostic information

## Performance Considerations
- Optimal partition size: Balance overhead vs. parallelism
- Max concurrent workers: {len(self.workers)} (configured)
- Result aggregation: O(n) where n = number of partitions

## Output Format
```json
{{{{
  "status": "completed|partial|failed",
  "partitions_total": <number>,
  "partitions_completed": <number>,
  "results": [<aggregated results>],
  "errors": [<any errors encountered>]
}}}}
```
"""
        return content


# Pre-defined system templates
SYSTEM_TEMPLATES: dict[str, dict[str, Any]] = {
    "code-review": {
        "name": "code-review-system",
        "description": "Multi-agent code review system",
        "pattern": "orchestrator-workers",
        "orchestrator": {
            "name": "code-review-orchestrator",
            "description": "Coordinates comprehensive code review",
            "role": "orchestrator",
            "tools": ["Task", "Read", "Glob", "Grep"],
            "responsibilities": [
                "Analyze PR scope and files",
                "Delegate to specialized reviewers",
                "Aggregate review findings",
                "Generate final review report",
            ],
        },
        "workers": [
            {
                "name": "security-reviewer",
                "description": "Reviews code for security vulnerabilities",
                "role": "worker",
                "tools": ["Read", "Grep"],
                "responsibilities": [
                    "Scan for security vulnerabilities",
                    "Check for OWASP top 10 issues",
                    "Identify unsafe patterns",
                ],
                "outputs": ["Security findings report"],
            },
            {
                "name": "style-reviewer",
                "description": "Reviews code style and conventions",
                "role": "worker",
                "tools": ["Read", "Grep"],
                "responsibilities": [
                    "Check code style consistency",
                    "Verify naming conventions",
                    "Review documentation quality",
                ],
                "outputs": ["Style compliance report"],
            },
            {
                "name": "logic-reviewer",
                "description": "Reviews code logic and correctness",
                "role": "worker",
                "tools": ["Read", "Grep"],
                "responsibilities": [
                    "Analyze algorithm correctness",
                    "Check edge case handling",
                    "Verify error handling",
                ],
                "outputs": ["Logic review report"],
            },
        ],
    },
    "documentation": {
        "name": "documentation-system",
        "description": "Multi-agent documentation generator",
        "pattern": "pipeline",
        "orchestrator": {
            "name": "doc-orchestrator",
            "description": "Coordinates documentation generation",
            "role": "orchestrator",
            "tools": ["Task", "Read", "Write", "Glob"],
            "responsibilities": [
                "Analyze codebase structure",
                "Coordinate documentation workers",
                "Review and publish final docs",
            ],
        },
        "workers": [
            {
                "name": "api-documenter",
                "description": "Generates API documentation",
                "role": "worker",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Extract API signatures",
                    "Generate endpoint documentation",
                    "Create usage examples",
                ],
                "outputs": ["API documentation files"],
            },
            {
                "name": "readme-generator",
                "description": "Generates README and guides",
                "role": "worker",
                "tools": ["Read", "Write"],
                "responsibilities": [
                    "Create project README",
                    "Write getting started guide",
                    "Document configuration options",
                ],
                "outputs": ["README.md and guides"],
            },
        ],
    },
    "test-suite": {
        "name": "test-generation-system",
        "description": "Multi-agent test generation system",
        "pattern": "parallel",
        "orchestrator": {
            "name": "test-orchestrator",
            "description": "Coordinates test generation across modules",
            "role": "orchestrator",
            "tools": ["Task", "Read", "Glob", "Bash"],
            "responsibilities": [
                "Identify testable modules",
                "Assign test generation tasks",
                "Validate generated tests",
                "Run test suite",
            ],
        },
        "workers": [
            {
                "name": "unit-test-writer",
                "description": "Generates unit tests",
                "role": "worker",
                "tools": ["Read", "Write"],
                "responsibilities": [
                    "Analyze function signatures",
                    "Generate unit test cases",
                    "Include edge cases",
                ],
                "outputs": ["Unit test files"],
            },
            {
                "name": "integration-test-writer",
                "description": "Generates integration tests",
                "role": "worker",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Identify integration points",
                    "Generate integration tests",
                    "Test API interactions",
                ],
                "outputs": ["Integration test files"],
            },
        ],
    },
    "routing": {
        "name": "routing-system",
        "description": "Routing pattern with classifier and specialized handlers",
        "pattern": "routing",
        "orchestrator": {
            "name": "request-classifier",
            "description": "Classifies inputs and routes to appropriate handlers",
            "role": "classifier",
            "tools": ["Task", "Read", "Grep"],
            "responsibilities": [
                "Analyze incoming request type and content",
                "Classify request into appropriate category",
                "Route to specialized handler agent",
                "Aggregate handler responses",
            ],
        },
        "workers": [
            {
                "name": "query-handler",
                "description": "Handles query and search requests",
                "role": "handler",
                "tools": ["Read", "Grep", "Glob"],
                "responsibilities": [
                    "Process search and query requests",
                    "Execute lookups and searches",
                    "Return formatted query results",
                ],
                "inputs": ["Query request with search criteria"],
                "outputs": ["Query results in structured format"],
            },
            {
                "name": "action-handler",
                "description": "Handles action and modification requests",
                "role": "handler",
                "tools": ["Read", "Write", "Edit"],
                "responsibilities": [
                    "Process action and modification requests",
                    "Execute file operations safely",
                    "Return action completion status",
                ],
                "inputs": ["Action request with target and operation"],
                "outputs": ["Action result with status and details"],
            },
            {
                "name": "analysis-handler",
                "description": "Handles analysis and inspection requests",
                "role": "handler",
                "tools": ["Read", "Grep", "Glob"],
                "responsibilities": [
                    "Process analysis and inspection requests",
                    "Perform deep examination of targets",
                    "Return detailed analysis report",
                ],
                "inputs": ["Analysis request with target and scope"],
                "outputs": ["Analysis report with findings"],
            },
        ],
    },
    "evaluator-optimizer": {
        "name": "evaluator-optimizer-system",
        "description": "Iterative improvement system with feedback loops",
        "pattern": "evaluator-optimizer",
        # Evaluation configuration — drives the feedback loop
        "evaluation_config": {
            "max_iterations": 5,
            "quality_threshold": 7.0,
            "improvement_threshold": 0.5,
            "criteria": {
                "clarity": {"weight": 0.25, "threshold": 7.0},
                "completeness": {"weight": 0.25, "threshold": 7.0},
                "correctness": {"weight": 0.30, "threshold": 8.0},
                "style": {"weight": 0.20, "threshold": 6.0},
            },
            "convergence": {
                "min_improvement": 0.5,
                "plateau_count": 2,
                "description": (
                    "Stop when: overall score >= threshold, "
                    "max iterations reached, or "
                    "improvement < min_improvement for plateau_count consecutive iterations"
                ),
            },
        },
        "orchestrator": {
            "name": "feedback-loop-controller",
            "description": "Controls iterative generation and refinement cycle",
            "role": "orchestrator",
            "tools": ["Task", "Read", "Write"],
            "responsibilities": [
                "Initialize generation cycle with max_iterations=5",
                "Route between generator, evaluator, and optimizer",
                "Track iteration count and quality scores per dimension",
                "Stop when score >= 7.0 or improvement < 0.5 for 2 iterations",
                "Finalize with quality report and iteration history",
            ],
        },
        "workers": [
            {
                "name": "content-generator",
                "description": "Generates initial content and incorporates feedback-driven improvements",
                "role": "generator",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Generate initial content from requirements",
                    "Apply targeted improvements from optimizer feedback",
                    "Maintain consistency across iterations",
                    "Return content with change summary per iteration",
                ],
                "inputs": ["Requirements or improvement instructions"],
                "outputs": ["Generated or improved content"],
            },
            {
                "name": "quality-evaluator",
                "description": "Scores content against 4 weighted criteria with per-dimension thresholds",
                "role": "evaluator",
                "tools": ["Read", "Grep"],
                "responsibilities": [
                    "Score clarity (weight 25%, threshold 7.0)",
                    "Score completeness (weight 25%, threshold 7.0)",
                    "Score correctness (weight 30%, threshold 8.0)",
                    "Score style (weight 20%, threshold 6.0)",
                    "Compute weighted overall score",
                    "Identify top 3 improvement areas with specific evidence",
                ],
                "inputs": ["Content to evaluate"],
                "outputs": [
                    "Per-dimension scores (0-10)",
                    "Weighted overall score",
                    "Top 3 improvement suggestions with evidence",
                ],
            },
            {
                "name": "improvement-optimizer",
                "description": "Analyzes evaluation scores and generates targeted optimization instructions",
                "role": "optimizer",
                "tools": ["Read", "Grep"],
                "responsibilities": [
                    "Analyze evaluator feedback and per-dimension scores",
                    "Prioritize improvements by score gap (threshold - actual)",
                    "Generate actionable, specific optimization instructions",
                    "Track diminishing returns across iterations",
                ],
                "inputs": ["Evaluation feedback and scores"],
                "outputs": ["Prioritized improvement instructions"],
            },
        ],
    },
    "parallelization": {
        "name": "parallelization-system",
        "description": "Parallel execution system with concurrent workers",
        "pattern": "parallelization",
        "orchestrator": {
            "name": "parallel-orchestrator",
            "description": "Decomposes tasks and coordinates parallel execution",
            "role": "orchestrator",
            "tools": ["Task", "Read", "Write", "Glob"],
            "responsibilities": [
                "Decompose tasks into parallelizable partitions",
                "Launch multiple workers concurrently",
                "Monitor parallel execution progress",
                "Aggregate results from all workers",
            ],
        },
        "workers": [
            {
                "name": "partition-worker-1",
                "description": "Processes first partition of work",
                "role": "worker",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Process assigned partition",
                    "Report progress and results",
                    "Handle partition-specific errors",
                ],
                "inputs": ["Partition data and processing instructions"],
                "outputs": ["Processed partition results"],
            },
            {
                "name": "partition-worker-2",
                "description": "Processes second partition of work",
                "role": "worker",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Process assigned partition",
                    "Report progress and results",
                    "Handle partition-specific errors",
                ],
                "inputs": ["Partition data and processing instructions"],
                "outputs": ["Processed partition results"],
            },
            {
                "name": "partition-worker-3",
                "description": "Processes third partition of work",
                "role": "worker",
                "tools": ["Read", "Write", "Grep"],
                "responsibilities": [
                    "Process assigned partition",
                    "Report progress and results",
                    "Handle partition-specific errors",
                ],
                "inputs": ["Partition data and processing instructions"],
                "outputs": ["Processed partition results"],
            },
        ],
    },
    "competing-hypothesis": {
        "name": "competing-hypothesis-system",
        "description": (
            "Competing-hypothesis debugging system. Spawns 3-5 investigators that "
            "each pursue a distinct theory about the bug, then challenge each "
            "other's findings in an adversarial round to surface the root cause."
        ),
        "pattern": "competing-hypothesis",
        # Adversarial workflow configuration — drives the challenge rounds.
        # First-class field so tests and tooling can inspect semantics
        # without reverse-engineering the markdown.
        "adversarial_config": {
            "min_investigators": 3,
            "max_investigators": 5,
            "default_investigators": 3,
            "rounds": {
                "investigation": {
                    "order": 1,
                    "description": (
                        "Each investigator gathers evidence for its assigned "
                        "hypothesis independently, without seeing peers' findings."
                    ),
                },
                "challenge": {
                    "order": 2,
                    "description": (
                        "Every investigator must cite at least one peer's "
                        "finding and present counter-evidence or a failed "
                        "falsification test. No hypothesis passes unchallenged."
                    ),
                    "min_challenges_per_investigator": 1,
                },
                "refinement": {
                    "order": 3,
                    "description": (
                        "Each investigator updates its hypothesis and evidence "
                        "in response to challenges received. Hypotheses that "
                        "cannot address challenges are marked as falsified."
                    ),
                },
            },
            "convergence": {
                "criteria": (
                    "Orchestrator selects the hypothesis with the strongest "
                    "evidence AND the fewest unaddressed challenges. Ties "
                    "escalate to the user with both hypotheses presented."
                ),
                "reject_unanimous_agreement": (
                    "If all investigators converge on the same hypothesis in "
                    "round 1 with no challenges surfaced, the orchestrator "
                    "treats this as insufficient adversarial pressure and "
                    "requires a second challenge round."
                ),
            },
        },
        "orchestrator": {
            "name": "hypothesis-coordinator",
            "description": (
                "Coordinates 3-5 investigators across three adversarial rounds: "
                "independent investigation, peer challenge, and refinement."
            ),
            "role": "orchestrator",
            "tools": ["Task", "Read", "Write", "Bash"],
            "responsibilities": [
                "Assign a distinct hypothesis focus to each investigator",
                "Dispatch all investigators in parallel for round 1 (independent investigation)",
                "Broadcast each investigator's findings to peers for round 2 (challenge)",
                "Enforce min_challenges_per_investigator=1 — reject passes without citing a peer",
                "Collect refinements in round 3 and tally evidence strength + unaddressed challenges",
                "Select the surviving hypothesis or escalate ties to the user",
            ],
        },
        "workers": [
            {
                "name": "hypothesis-investigator-1",
                "description": (
                    "Investigates the recent-change hypothesis: the bug was "
                    "introduced by a recent commit, dependency bump, or config "
                    "change. Uses git log / git blame / recent diffs as evidence."
                ),
                "role": "investigator",
                "tools": ["Read", "Grep", "Glob", "Bash"],
                "isolation": "worktree",
                "hypothesis_focus": "recent-change",
                "responsibilities": [
                    "Enumerate commits since the last known-good state",
                    "Bisect or diff-walk to pinpoint suspect changes",
                    "Provide reproducible evidence linking change to failure",
                    "In round 2, challenge at least one peer's finding with counter-evidence",
                ],
                "inputs": ["Bug description", "Known-good reference (commit/tag)"],
                "outputs": ["Evidence chain", "Falsification tests", "Challenges to peers"],
            },
            {
                "name": "hypothesis-investigator-2",
                "description": (
                    "Investigates the concurrency / timing hypothesis: the bug "
                    "stems from race conditions, ordering, deadlocks, or "
                    "timing-sensitive code paths."
                ),
                "role": "investigator",
                "tools": ["Read", "Grep", "Glob", "Bash"],
                "isolation": "worktree",
                "hypothesis_focus": "concurrency-timing",
                "responsibilities": [
                    "Identify shared state, locks, and async boundaries",
                    "Construct stress / ordering reproductions",
                    "Distinguish timing-dependent failures from deterministic ones",
                    "In round 2, challenge at least one peer's finding with counter-evidence",
                ],
                "inputs": ["Bug description", "Observed failure frequency"],
                "outputs": ["Evidence chain", "Falsification tests", "Challenges to peers"],
            },
            {
                "name": "hypothesis-investigator-3",
                "description": (
                    "Investigates the environment / dependency hypothesis: the "
                    "bug is caused by version drift, missing env vars, OS/"
                    "platform differences, or external service behavior."
                ),
                "role": "investigator",
                "tools": ["Read", "Grep", "Glob", "Bash"],
                "isolation": "worktree",
                "hypothesis_focus": "environment-dependency",
                "responsibilities": [
                    "Compare failing environment to known-good environment",
                    "Check dependency versions, env vars, and external services",
                    "Attempt to reproduce in a clean environment",
                    "In round 2, challenge at least one peer's finding with counter-evidence",
                ],
                "inputs": ["Bug description", "Environment details"],
                "outputs": ["Evidence chain", "Falsification tests", "Challenges to peers"],
            },
        ],
    },
    "writer-reviewer": {
        "name": "writer-reviewer-system",
        "description": (
            "Writer-reviewer feedback loop. One agent implements, a second "
            "reviews with a fresh context to defeat implementation bias."
        ),
        "pattern": "writer-reviewer",
        # Feedback loop configuration — drives the writer→reviewer→writer cycle.
        # Documented as a first-class field so tooling and tests can inspect
        # the loop semantics without reverse-engineering the markdown.
        "feedback_loop_config": {
            "max_iterations": 3,
            "clean_context": {
                "reviewer_receives": [
                    "Original task requirements",
                    "Writer's diff (git diff)",
                    "List of changed files",
                ],
                "reviewer_never_receives": [
                    "Writer's internal reasoning or transcript",
                    "Prior reviewer verdicts",
                    "Orchestrator conversation history",
                ],
                "rationale": (
                    "Each review starts fresh so the reviewer evaluates "
                    "artifacts, not the writer's framing. See heuristic HE1: "
                    "'generators don't evaluate themselves'."
                ),
            },
            "termination": {
                "approve": "Reviewer returns VERDICT: APPROVE",
                "max_iterations": ("Loop hits max_iterations with outstanding REQUEST_CHANGES"),
                "writer_failure": "Writer agent fails twice in a row",
            },
        },
        "orchestrator": {
            "name": "writer-reviewer-coordinator",
            "description": (
                "Coordinates the writer-reviewer feedback loop, isolating "
                "the reviewer's context from the writer's reasoning."
            ),
            "role": "orchestrator",
            "tools": ["Task", "Read", "Bash"],
            "responsibilities": [
                "Dispatch the writer agent with requirements (plus prior review findings on retry)",
                "Capture writer artifacts (diff, changed files) without leaking writer reasoning",
                "Dispatch the reviewer agent in a clean context with artifacts only",
                "Parse reviewer verdict (APPROVE / REQUEST_CHANGES) and iteration-gate the loop",
                "Finalize on APPROVE or at max_iterations with findings documented",
            ],
        },
        "workers": [
            {
                "name": "writer",
                "description": (
                    "Implements the task in an isolated worktree, carrying "
                    "the full implementation context across iterations."
                ),
                "role": "writer",
                "tools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
                "isolation": "worktree",
                "responsibilities": [
                    "Implement the requirements in the assigned worktree",
                    "On iteration 2+, address specific reviewer findings",
                    "Return a summary of changes alongside the diff",
                ],
                "inputs": [
                    "Original requirements",
                    "Reviewer findings (iterations 2+)",
                ],
                "outputs": [
                    "Writer diff (git diff)",
                    "List of changed files",
                    "Change summary",
                ],
            },
            {
                "name": "reviewer",
                "description": (
                    "Reviews writer artifacts in a fresh worktree with "
                    "read-only tools and no access to the writer's reasoning."
                ),
                "role": "reviewer",
                "tools": ["Read", "Grep", "Glob"],
                "isolation": "worktree",
                "responsibilities": [
                    "Evaluate the writer's diff against the original requirements only",
                    "Return VERDICT: APPROVE or REQUEST_CHANGES with specific findings",
                    "Do not assume context from prior turns, reviewers, or writer reasoning",
                ],
                "inputs": [
                    "Original requirements",
                    "Writer diff",
                    "List of changed files",
                ],
                "outputs": [
                    "VERDICT: APPROVE | REQUEST_CHANGES",
                    "Specific findings list (when REQUEST_CHANGES)",
                ],
            },
        ],
    },
}


def _needs_worktree_isolation(role: str, tools: list[str]) -> bool:
    """Determine if an agent needs worktree isolation.

    Workers with file-modifying tools (Write, Edit, Bash) need worktree
    isolation when running in parallel to avoid file conflicts.
    Orchestrators don't need isolation — they coordinate, not modify.
    """
    if role == "orchestrator":
        return False
    return bool(FILE_MODIFYING_TOOLS & set(tools))


def create_agent_from_dict(data: dict[str, Any]) -> AgentDefinition:
    """Create AgentDefinition from dictionary."""
    role = data["role"]
    tools = data["tools"]
    # Auto-set isolation for workers with file-modifying tools
    isolation = data.get("isolation") or (
        "worktree" if _needs_worktree_isolation(role, tools) else None
    )
    return AgentDefinition(
        name=data["name"],
        description=data["description"],
        role=role,
        tools=tools,
        responsibilities=data["responsibilities"],
        inputs=data.get("inputs", []),
        outputs=data.get("outputs", []),
        isolation=isolation,
        hypothesis_focus=data.get("hypothesis_focus"),
    )


def create_system_from_template(template_name: str) -> MultiAgentSystem | None:
    """Create MultiAgentSystem from a template."""
    template = SYSTEM_TEMPLATES.get(template_name)
    if template is None:
        return None

    orchestrator = create_agent_from_dict(template["orchestrator"])
    workers = [create_agent_from_dict(w) for w in template["workers"]]

    return MultiAgentSystem(
        name=template["name"],
        description=template["description"],
        pattern=template["pattern"],
        orchestrator=orchestrator,
        workers=workers,
    )


# Canonical debugging hypotheses used by the competing-hypothesis factory
# when the caller does not supply custom hypotheses. Ordered from most- to
# least-common root causes in real debugging sessions, so fewer-investigator
# runs still cover the highest-value theories.
DEFAULT_COMPETING_HYPOTHESES: list[dict[str, Any]] = [
    {
        "focus": "recent-change",
        "description": (
            "Investigates the recent-change hypothesis: the bug was introduced "
            "by a recent commit, dependency bump, or config change. Uses git "
            "log / git blame / recent diffs as evidence."
        ),
        "responsibilities": [
            "Enumerate commits since the last known-good state",
            "Bisect or diff-walk to pinpoint suspect changes",
            "Provide reproducible evidence linking change to failure",
        ],
        "inputs": ["Bug description", "Known-good reference (commit/tag)"],
    },
    {
        "focus": "concurrency-timing",
        "description": (
            "Investigates the concurrency / timing hypothesis: the bug stems "
            "from race conditions, ordering, deadlocks, or timing-sensitive "
            "code paths."
        ),
        "responsibilities": [
            "Identify shared state, locks, and async boundaries",
            "Construct stress / ordering reproductions",
            "Distinguish timing-dependent failures from deterministic ones",
        ],
        "inputs": ["Bug description", "Observed failure frequency"],
    },
    {
        "focus": "environment-dependency",
        "description": (
            "Investigates the environment / dependency hypothesis: the bug "
            "is caused by version drift, missing env vars, OS / platform "
            "differences, or external service behavior."
        ),
        "responsibilities": [
            "Compare failing environment to known-good environment",
            "Check dependency versions, env vars, and external services",
            "Attempt to reproduce in a clean environment",
        ],
        "inputs": ["Bug description", "Environment details"],
    },
    {
        "focus": "data-state",
        "description": (
            "Investigates the data / state hypothesis: the bug is triggered "
            "by specific input values, corrupted persisted state, or "
            "accumulated side effects from prior operations."
        ),
        "responsibilities": [
            "Enumerate input shapes / edge cases that trigger the failure",
            "Inspect persisted state, caches, and accumulators",
            "Reproduce from a clean-state baseline to isolate data dependency",
        ],
        "inputs": ["Bug description", "Input samples or state dump"],
    },
    {
        "focus": "integration-contract",
        "description": (
            "Investigates the integration-contract hypothesis: the bug "
            "results from a mismatch between system boundaries — API "
            "contract violations, schema drift, or protocol assumption "
            "failures between components."
        ),
        "responsibilities": [
            "Map the failing operation across component boundaries",
            "Diff expected vs actual payloads at each boundary",
            "Identify which side of the contract is non-conforming",
        ],
        "inputs": ["Bug description", "Component interaction trace"],
    },
]


def create_competing_hypothesis_system(
    investigator_count: int = 3,
    hypotheses: list[dict[str, Any]] | None = None,
    name: str = "competing-hypothesis-system",
) -> MultiAgentSystem:
    """Build a competing-hypothesis debugging system with N investigators.

    Each investigator pursues a distinct hypothesis focus and participates
    in the three-round adversarial workflow documented by the orchestrator
    (investigation → challenge → refinement). The factory exists so callers
    can choose the investigator count (3-5) and optionally supply custom
    hypotheses for domain-specific debugging sessions.

    Args:
        investigator_count: How many investigators to spawn. Must be in
            [3, 5]. Values outside this range raise ValueError — three is
            the floor for meaningful adversarial pressure, five is the
            ceiling before orchestration overhead dominates.
        hypotheses: Optional list of hypothesis dicts with keys `focus`
            (str), `description` (str), `responsibilities` (list[str]),
            and `inputs` (list[str]). When None, ``DEFAULT_COMPETING_
            HYPOTHESES`` is used. Duplicate focuses raise ValueError.
        name: System name (default ``competing-hypothesis-system``).

    Raises:
        ValueError: if ``investigator_count`` is outside [3, 5], if
            ``hypotheses`` is supplied but shorter than ``investigator_count``,
            or if hypothesis focuses are not distinct.

    Returns:
        MultiAgentSystem with an orchestrator and ``investigator_count``
        workers, each tagged with ``hypothesis_focus`` and pre-configured
        for the adversarial workflow.
    """
    if not 3 <= investigator_count <= 5:
        raise ValueError(
            f"investigator_count must be in [3, 5], got {investigator_count}; "
            "outside this range the adversarial pattern loses its value "
            "(too few = no pressure, too many = coordination overhead)"
        )

    selected = list(hypotheses) if hypotheses is not None else DEFAULT_COMPETING_HYPOTHESES
    if len(selected) < investigator_count:
        raise ValueError(
            f"need at least {investigator_count} hypotheses, got {len(selected)}; "
            "each investigator must have its own distinct theory"
        )

    selected = selected[:investigator_count]

    # Validate every hypothesis carries the required keys before agent
    # construction. Without this, malformed dicts surface as opaque KeyError
    # deep in agent construction; the caller cannot tell which hypothesis or
    # which key is the problem.
    required_keys = ("focus", "description", "responsibilities")
    for idx, hypothesis in enumerate(selected):
        if not isinstance(hypothesis, dict):
            raise ValueError(f"hypotheses[{idx}] must be a dict, got {type(hypothesis).__name__}")
        missing = [k for k in required_keys if k not in hypothesis]
        if missing:
            raise ValueError(
                f"hypotheses[{idx}] missing required key(s) {missing}; "
                "each hypothesis must declare focus, description, and responsibilities"
            )

    focuses = [h["focus"] for h in selected]
    if len(set(focuses)) != len(focuses):
        dupes = [f for f in focuses if focuses.count(f) > 1]
        raise ValueError(f"hypothesis focuses must be distinct; duplicates: {sorted(set(dupes))}")

    orchestrator = AgentDefinition(
        name="hypothesis-coordinator",
        description=(
            f"Coordinates {investigator_count} investigators across three "
            "adversarial rounds: independent investigation, peer challenge, "
            "and refinement."
        ),
        role="orchestrator",
        tools=["Task", "Read", "Write", "Bash"],
        responsibilities=[
            "Assign a distinct hypothesis focus to each investigator",
            "Dispatch all investigators in parallel for round 1 (independent investigation)",
            "Broadcast each investigator's findings to peers for round 2 (challenge)",
            "Enforce min_challenges_per_investigator=1 — reject passes without citing a peer",
            "Collect refinements in round 3 and tally evidence vs unaddressed challenges",
            "Select the surviving hypothesis or escalate ties to the user",
        ],
    )

    workers: list[AgentDefinition] = []
    for idx, hypothesis in enumerate(selected, start=1):
        workers.append(
            AgentDefinition(
                name=f"hypothesis-investigator-{idx}",
                description=hypothesis["description"],
                role="investigator",
                tools=["Read", "Grep", "Glob", "Bash"],
                isolation="worktree",
                hypothesis_focus=hypothesis["focus"],
                responsibilities=[
                    *hypothesis["responsibilities"],
                    "In round 2, challenge at least one peer's finding with counter-evidence",
                ],
                inputs=list(hypothesis.get("inputs", ["Bug description"])),
                outputs=[
                    "Evidence chain",
                    "Falsification tests",
                    "Challenges to peers",
                ],
            )
        )

    return MultiAgentSystem(
        name=name,
        description=(
            f"Competing-hypothesis debugging system with {investigator_count} "
            "investigators. Each investigator pursues a distinct theory; all "
            "must challenge peer findings before a root cause is selected."
        ),
        pattern="competing-hypothesis",
        orchestrator=orchestrator,
        workers=workers,
    )


def generate_custom_system(
    name: str,
    description: str,
    pattern: str,
    worker_count: int,
    domain: str = "general",
) -> MultiAgentSystem:
    """
    Generate a custom multi-agent system.

    Args:
        name: System name
        description: System description
        pattern: Workflow pattern (orchestrator-workers, pipeline, parallel)
        worker_count: Number of worker agents
        domain: Domain specialization

    Returns:
        MultiAgentSystem instance
    """
    # Create orchestrator
    orchestrator = AgentDefinition(
        name=f"{name}-orchestrator",
        description=f"Orchestrator for {name} system",
        role="orchestrator",
        tools=["Task", "Read", "Write", "Glob", "Grep"],
        responsibilities=[
            "Analyze incoming tasks",
            "Delegate to specialized workers",
            "Aggregate results",
            "Report final output",
        ],
    )

    # Create workers based on domain
    workers: list[AgentDefinition] = []
    worker_roles = _get_worker_roles(domain, worker_count)

    for role_name, role_desc, role_tools in worker_roles:
        # Auto-set worktree isolation for workers with file-modifying tools
        isolation = "worktree" if _needs_worktree_isolation("worker", role_tools) else None
        worker = AgentDefinition(
            name=f"{name}-{role_name}",
            description=role_desc,
            role="worker",
            tools=role_tools,
            responsibilities=[
                f"Handle {role_name} tasks",
                "Report results to orchestrator",
            ],
            outputs=[f"{role_name.title()} output"],
            isolation=isolation,
        )
        workers.append(worker)

    return MultiAgentSystem(
        name=name,
        description=description,
        pattern=pattern,
        orchestrator=orchestrator,
        workers=workers,
    )


def _get_worker_roles(domain: str, count: int) -> list[tuple[str, str, list[str]]]:
    """Get worker role definitions based on domain."""
    domain_roles: dict[str, list[tuple[str, str, list[str]]]] = {
        "general": [
            ("analyzer", "Analyzes input data", ["Read", "Grep"]),
            ("processor", "Processes and transforms data", ["Read", "Write"]),
            ("validator", "Validates outputs", ["Read", "Grep"]),
            ("reporter", "Generates reports", ["Read", "Write"]),
        ],
        "web": [
            ("frontend-worker", "Handles frontend tasks", ["Read", "Write", "Glob"]),
            ("backend-worker", "Handles backend tasks", ["Read", "Write", "Grep"]),
            ("api-worker", "Handles API tasks", ["Read", "Write", "WebFetch"]),
            ("test-worker", "Handles testing tasks", ["Read", "Write", "Bash"]),
        ],
        "data": [
            ("extractor", "Extracts data from sources", ["Read", "Grep"]),
            ("transformer", "Transforms data formats", ["Read", "Write"]),
            ("loader", "Loads data to destinations", ["Read", "Write", "Bash"]),
            ("validator", "Validates data quality", ["Read", "Grep"]),
        ],
        "devops": [
            ("build-worker", "Handles build tasks", ["Bash", "Read"]),
            ("deploy-worker", "Handles deployment", ["Bash", "Read", "Write"]),
            ("monitor-worker", "Handles monitoring", ["Bash", "Read", "Grep"]),
            ("config-worker", "Handles configuration", ["Read", "Write", "Glob"]),
        ],
    }

    roles = domain_roles.get(domain, domain_roles["general"])
    # Cycle through roles if more workers needed
    return [roles[i % len(roles)] for i in range(count)]


def save_system(system: MultiAgentSystem, output_dir: Path) -> list[Path]:
    """
    Save multi-agent system to files.

    Args:
        system: MultiAgentSystem to save
        output_dir: Directory to save files

    Returns:
        List of created file paths
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    created_files: list[Path] = []

    # Save orchestrator/classifier/controller based on pattern
    orchestrator_path = output_dir / f"{system.orchestrator.name}.md"
    if system.pattern == "routing":
        orchestrator_path.write_text(system.generate_classifier_markdown(), encoding="utf-8")
    elif system.pattern == "evaluator-optimizer":
        orchestrator_path.write_text(
            system.generate_evaluator_orchestrator_markdown(), encoding="utf-8"
        )
    elif system.pattern == "parallelization":
        orchestrator_path.write_text(
            system.generate_parallel_orchestrator_markdown(), encoding="utf-8"
        )
    elif system.pattern == "writer-reviewer":
        orchestrator_path.write_text(
            system.generate_writer_reviewer_orchestrator_markdown(), encoding="utf-8"
        )
    elif system.pattern == "competing-hypothesis":
        orchestrator_path.write_text(
            system.generate_competing_hypothesis_orchestrator_markdown(), encoding="utf-8"
        )
    else:
        orchestrator_path.write_text(system.generate_orchestrator_markdown(), encoding="utf-8")
    created_files.append(orchestrator_path)

    # Save workers
    for worker in system.workers:
        worker_path = output_dir / f"{worker.name}.md"
        worker_path.write_text(worker.to_markdown(), encoding="utf-8")
        created_files.append(worker_path)

    # Save system manifest
    manifest_path = output_dir / f"{system.name}-manifest.json"
    manifest_path.write_text(json.dumps(system.to_dict(), indent=2), encoding="utf-8")
    created_files.append(manifest_path)

    return created_files


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate coordinated multi-agent systems")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate multi-agent system")
    gen_parser.add_argument("--name", required=True, help="System name")
    gen_parser.add_argument("--description", default="", help="System description")
    gen_parser.add_argument(
        "--pattern",
        choices=[
            "orchestrator-workers",
            "pipeline",
            "parallel",
            "routing",
            "evaluator-optimizer",
            "parallelization",
            "writer-reviewer",
            "competing-hypothesis",
        ],
        default="orchestrator-workers",
        help="Workflow pattern",
    )
    gen_parser.add_argument("--workers", type=int, default=3, help="Number of workers")
    gen_parser.add_argument(
        "--domain",
        choices=["general", "web", "data", "devops"],
        default="general",
        help="Domain specialization",
    )
    gen_parser.add_argument("--output", "-o", help="Output directory")
    gen_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Template command
    tmpl_parser = subparsers.add_parser("template", help="Use predefined template")
    tmpl_parser.add_argument(
        "name",
        choices=list(SYSTEM_TEMPLATES.keys()),
        help="Template name",
    )
    tmpl_parser.add_argument("--output", "-o", help="Output directory")
    tmpl_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # List templates
    subparsers.add_parser("templates", help="List available templates")

    # Example command
    ex_parser = subparsers.add_parser("example", help="Show example system")
    ex_parser.add_argument(
        "pattern",
        nargs="?",
        choices=[
            "orchestrator-workers",
            "pipeline",
            "parallel",
            "routing",
            "evaluator-optimizer",
            "parallelization",
            "writer-reviewer",
            "competing-hypothesis",
        ],
        default="orchestrator-workers",
        help="Pattern to show",
    )

    args = parser.parse_args()

    if args.command == "generate":
        desc = args.description or f"Multi-agent system for {args.name}"
        system = generate_custom_system(
            name=args.name,
            description=desc,
            pattern=args.pattern,
            worker_count=args.workers,
            domain=args.domain,
        )

        if args.output:
            files = save_system(system, Path(args.output))
            print(f"Generated {len(files)} files:")
            for f in files:
                print(f"  - {f}")
        elif args.json:
            print(json.dumps(system.to_dict(), indent=2))
        else:
            print(f"System: {system.name}")
            print(f"Pattern: {system.pattern}")
            print(f"Orchestrator: {system.orchestrator.name}")
            print(f"Workers ({len(system.workers)}):")
            for w in system.workers:
                print(f"  - {w.name}: {w.description}")

    elif args.command == "template":
        system = create_system_from_template(args.name)
        if system is None:
            print(f"Template not found: {args.name}", file=sys.stderr)
            sys.exit(1)

        if args.output:
            files = save_system(system, Path(args.output))
            print(f"Generated {len(files)} files from template '{args.name}':")
            for f in files:
                print(f"  - {f}")
        elif args.json:
            print(json.dumps(system.to_dict(), indent=2))
        else:
            print(f"Template: {args.name}")
            print(f"System: {system.name}")
            print(f"Pattern: {system.pattern}")
            print(f"Orchestrator: {system.orchestrator.name}")
            print(f"Workers ({len(system.workers)}):")
            for w in system.workers:
                print(f"  - {w.name}: {w.description}")

    elif args.command == "templates":
        print("Available templates:")
        print("-" * 40)
        for name, tmpl in SYSTEM_TEMPLATES.items():
            workers = len(tmpl["workers"])
            print(f"  {name}")
            print(f"    Pattern: {tmpl['pattern']}")
            print(f"    Workers: {workers}")
            print(f"    {tmpl['description']}")
            print()

    elif args.command == "example":
        # Show example orchestrator/classifier/controller markdown
        if args.pattern == "orchestrator-workers":
            system = create_system_from_template("code-review")
        elif args.pattern == "pipeline":
            system = create_system_from_template("documentation")
        elif args.pattern == "routing":
            system = create_system_from_template("routing")
        elif args.pattern == "evaluator-optimizer":
            system = create_system_from_template("evaluator-optimizer")
        elif args.pattern == "parallelization":
            system = create_system_from_template("parallelization")
        elif args.pattern == "writer-reviewer":
            system = create_system_from_template("writer-reviewer")
        else:
            system = create_system_from_template("test-suite")

        if system:
            if system.pattern == "routing":
                print(system.generate_classifier_markdown())
            elif system.pattern == "evaluator-optimizer":
                print(system.generate_evaluator_orchestrator_markdown())
            elif system.pattern == "parallelization":
                print(system.generate_parallel_orchestrator_markdown())
            elif system.pattern == "writer-reviewer":
                print(system.generate_writer_reviewer_orchestrator_markdown())
            else:
                print(system.generate_orchestrator_markdown())

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
