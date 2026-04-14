#!/usr/bin/env python3
"""
Agent Composer for Combining Multiple Agents

Enables creation of composite agents that orchestrate multiple specialized agents.
Supports various composition patterns: sequential, parallel, conditional, and hierarchical.

Features:
- Combine agents into pipelines
- Create orchestrator agents from worker definitions
- Merge complementary agent capabilities
- Validate composition compatibility
- Generate composite agent definitions

Composition Patterns:
- Sequential: A → B → C (prompt-chaining)
- Parallel: A || B || C (parallelization)
- Conditional: if X then A else B (routing)
- Hierarchical: Orchestrator → Workers (orchestrator-workers)

Usage:
    from scripts.agent_composer import (
        compose_sequential,
        compose_parallel,
        compose_conditional,
        create_orchestrator,
    )

    # Sequential composition
    pipeline = compose_sequential([agent_a, agent_b, agent_c])

    # Parallel composition
    parallel = compose_parallel([analyzer_1, analyzer_2, analyzer_3])

    # Create orchestrator from workers
    orchestrator = create_orchestrator(
        name="feature-builder",
        workers=[code_writer, test_writer, doc_writer],
    )
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class CompositionPattern(Enum):
    """Supported composition patterns."""

    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"
    HIERARCHICAL = "hierarchical"


@dataclass
class AgentSpec:
    """Specification for an agent to be composed."""

    name: str
    description: str
    tools: list[str] = field(default_factory=list)
    pattern: str = "prompt-chaining"
    role: str = ""  # Role in composition (e.g., "worker", "evaluator")
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)


@dataclass
class CompositionResult:
    """Result of an agent composition operation."""

    success: bool
    composite_name: str
    pattern: CompositionPattern
    agent_content: str
    component_agents: list[str]
    tools_merged: list[str]
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class CompatibilityCheck:
    """Result of compatibility check between agents."""

    compatible: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


@dataclass
class RoutingRule:
    """A single routing rule for the router-agent generator.

    The router agent classifies an incoming request into a ``category``,
    then dispatches to ``handler_name`` (which must match one of the
    AgentSpec names passed to :func:`compose_router`).

    Fields:
        category: Short machine-friendly tag (e.g. ``"refactor"``,
            ``"bug-fix"``). Surfaces in the generated routing table so
            users can see categories at a glance.
        description: One-line human-readable explanation of when this
            rule fires. Becomes the rule's prose in the generated agent.
        handler_name: The AgentSpec.name to dispatch to.
        keywords: Optional list of substring matchers that bias the
            classifier. The generated agent uses these as hints; the
            actual classification still happens at runtime via Claude.
            Empty list means "no automatic hints — rely on description".
    """

    category: str
    description: str
    handler_name: str
    keywords: list[str] = field(default_factory=list)


# Sentinel header emitted into generated router agents above the routing
# table, so downstream parsers can locate the table without depending on
# heading text. Kept as a module constant rather than an inline string so
# the contract is one place and tests can assert on it.
ROUTER_TABLE_HEADER: str = "## Routing Table"

# Sentinel header for the fallback section. Same rationale as
# ROUTER_TABLE_HEADER.
ROUTER_FALLBACK_HEADER: str = "## Fallback Handler"


def check_compatibility(agents: list[AgentSpec]) -> CompatibilityCheck:
    """
    Check if agents are compatible for composition.

    Args:
        agents: List of agent specifications

    Returns:
        CompatibilityCheck with results
    """
    issues: list[str] = []
    suggestions: list[str] = []

    if len(agents) < 2:
        issues.append("At least 2 agents required for composition")
        return CompatibilityCheck(compatible=False, issues=issues)

    # Check for name conflicts
    names = [a.name for a in agents]
    if len(names) != len(set(names)):
        issues.append("Duplicate agent names found")

    # Check tool conflicts (some tools shouldn't be combined)
    all_tools: set[str] = set()
    for agent in agents:
        all_tools.update(agent.tools)

    # Check for potentially conflicting patterns
    patterns = {a.pattern for a in agents}
    if len(patterns) > 2:
        suggestions.append(
            "Multiple workflow patterns detected. Consider using hierarchical composition."
        )

    # Check dependency cycles
    dep_graph: dict[str, list[str]] = {a.name: a.dependencies for a in agents}
    if _has_cycle(dep_graph):
        issues.append("Circular dependencies detected between agents")

    # Validate I/O compatibility for sequential pipelines
    seq_issues = validate_sequential_io(agents)
    issues.extend(seq_issues)

    return CompatibilityCheck(
        compatible=len(issues) == 0,
        issues=issues,
        suggestions=suggestions,
    )


def _has_cycle(graph: dict[str, list[str]]) -> bool:
    """Check for cycles in dependency graph using DFS."""
    visited: set[str] = set()
    rec_stack: set[str] = set()

    def dfs(node: str) -> bool:
        visited.add(node)
        rec_stack.add(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True

        rec_stack.remove(node)
        return False

    for node in graph:
        if node not in visited:
            if dfs(node):
                return True
    return False


def _schema_fields(schema: dict[str, Any]) -> set[str]:
    """Extract top-level field names from a JSON-schema-like dict.

    Supports schemas with "properties" (JSON Schema) or plain key→type dicts.
    Returns an empty set for empty/missing schemas (treated as "any").
    """
    if not schema:
        return set()
    # Standard JSON Schema with "properties" key
    props = schema.get("properties")
    if isinstance(props, dict):
        return set(props.keys())
    # Plain {field: type_info} dict (simplified schema)
    return set(schema.keys()) - {"type", "description", "required"}


def _schemas_compatible(
    output_schema: dict[str, Any],
    input_schema: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Check if an output schema is compatible with an input schema.

    Compatibility rules:
    - If either schema is empty, they are compatible (untyped = "any").
    - If input has required fields, the output must provide them.
    - Extra output fields are always allowed (consumers may ignore them).

    Returns:
        (compatible, list_of_issues)
    """
    # Empty schemas are always compatible — untyped means "any"
    if not output_schema or not input_schema:
        return True, []

    out_fields = _schema_fields(output_schema)
    in_fields = _schema_fields(input_schema)

    # Determine required input fields
    required = set(input_schema.get("required", []))
    if not required:
        # If no explicit "required", treat all input fields as required
        required = in_fields

    missing = required - out_fields
    if missing:
        return False, [f"Output missing required fields: {', '.join(sorted(missing))}"]

    return True, []


def validate_sequential_io(agents: list[AgentSpec]) -> list[str]:
    """Validate that sequential pipeline stages have compatible I/O.

    For each adjacent pair (stage N, stage N+1), checks that stage N's
    output_schema provides the fields required by stage N+1's input_schema.

    Args:
        agents: Ordered list of agents in the pipeline.

    Returns:
        List of incompatibility issues (empty = all compatible).
    """
    issues: list[str] = []

    for i in range(len(agents) - 1):
        producer = agents[i]
        consumer = agents[i + 1]

        compatible, stage_issues = _schemas_compatible(
            producer.output_schema, consumer.input_schema
        )
        if not compatible:
            for issue in stage_issues:
                issues.append(f"Stage {i + 1}→{i + 2} ({producer.name}→{consumer.name}): {issue}")

    return issues


def validate_parallel_outputs(agents: list[AgentSpec]) -> list[str]:
    """Validate that parallel agents produce merge-compatible outputs.

    For a merge aggregation to work, all agents with output schemas must
    not have conflicting field types for the same field name.

    Args:
        agents: List of agents to run in parallel.

    Returns:
        List of merge-compatibility issues (empty = all compatible).
    """
    issues: list[str] = []

    # Collect field→type from all output schemas
    field_sources: dict[str, list[tuple[str, Any]]] = {}
    for agent in agents:
        out_props = agent.output_schema.get("properties", agent.output_schema)
        if not out_props or not isinstance(out_props, dict):
            continue

        for field_name, field_def in out_props.items():
            if field_name in ("type", "description", "required"):
                continue
            field_type = (
                field_def.get("type", "unknown") if isinstance(field_def, dict) else str(field_def)
            )
            field_sources.setdefault(field_name, []).append((agent.name, field_type))

    # Check for conflicting types on the same field
    for field_name, sources in field_sources.items():
        types = {t for _, t in sources}
        if len(types) > 1:
            agents_str = ", ".join(f"{name}({t})" for name, t in sources)
            issues.append(f"Field '{field_name}' has conflicting types: {agents_str}")

    return issues


def merge_tools(agents: list[AgentSpec]) -> list[str]:
    """
    Merge tools from multiple agents, removing duplicates.

    Args:
        agents: List of agent specifications

    Returns:
        Deduplicated list of tools
    """
    tools: list[str] = []
    seen: set[str] = set()

    for agent in agents:
        for tool in agent.tools:
            if tool not in seen:
                tools.append(tool)
                seen.add(tool)

    # Ensure Task is included for multi-agent compositions
    if "Task" not in seen and len(agents) > 1:
        tools.append("Task")

    return tools


def compose_sequential(
    agents: list[AgentSpec],
    name: str | None = None,
    description: str | None = None,
) -> CompositionResult:
    """
    Compose agents into a sequential pipeline (prompt-chaining pattern).

    Each agent's output becomes the next agent's input.

    Args:
        agents: Ordered list of agents for the pipeline
        name: Name for composite agent (auto-generated if None)
        description: Description (auto-generated if None)

    Returns:
        CompositionResult with the composite agent
    """
    # Validate
    compat = check_compatibility(agents)
    if not compat.compatible:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.SEQUENTIAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=compat.issues,
        )

    # Generate name and description
    composite_name = name or f"{agents[0].name}-to-{agents[-1].name}-pipeline"
    composite_desc = description or (f"Sequential pipeline: {' → '.join(a.name for a in agents)}")

    # Merge tools
    tools = merge_tools(agents)
    tools_str = ", ".join(tools)

    # Build workflow steps
    workflow_steps = ""
    for i, agent in enumerate(agents, 1):
        workflow_steps += f"""
### Step {i}: {agent.name}

{agent.description}

**Role:** {agent.role or "Processor"}
**Tools:** {", ".join(agent.tools) if agent.tools else "Inherited"}

"""

    # Generate content
    content = f"""---
name: {composite_name}
description: {composite_desc}
tools: {tools_str}
---

# {composite_name.replace("-", " ").title()}

## Overview

{composite_desc}

**Pattern:** Sequential (Prompt-Chaining)
**Components:** {len(agents)} agents

## Pipeline Flow

```
{" → ".join(a.name for a in agents)}
```

## Workflow
{workflow_steps}
## Execution

1. Receive input
2. Execute each step in order
3. Pass output to next step
4. Return final result

## Component Agents

{chr(10).join(f"- **{a.name}**: {a.description}" for a in agents)}

## Error Handling

- If any step fails, stop pipeline and report error
- Include which step failed and why
- Provide partial results if available

---

*Composite agent generated by Platxa Agent Composer*
"""

    return CompositionResult(
        success=True,
        composite_name=composite_name,
        pattern=CompositionPattern.SEQUENTIAL,
        agent_content=content,
        component_agents=[a.name for a in agents],
        tools_merged=tools,
        warnings=compat.suggestions,
    )


def compose_parallel(
    agents: list[AgentSpec],
    name: str | None = None,
    description: str | None = None,
    aggregation_strategy: str = "merge",
) -> CompositionResult:
    """
    Compose agents for parallel execution (parallelization pattern).

    All agents run concurrently, results are aggregated.

    Args:
        agents: List of agents to run in parallel
        name: Name for composite agent
        description: Description
        aggregation_strategy: How to combine results (merge, vote, first)

    Returns:
        CompositionResult with the composite agent
    """
    compat = check_compatibility(agents)

    # Additional merge-compatibility check for parallel outputs
    if aggregation_strategy == "merge":
        merge_issues = validate_parallel_outputs(agents)
        compat.issues.extend(merge_issues)
        if merge_issues:
            compat.compatible = False

    if not compat.compatible:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.PARALLEL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=compat.issues,
        )

    composite_name = name or f"parallel-{'-'.join(a.name for a in agents[:3])}"
    composite_desc = description or (f"Parallel execution of: {', '.join(a.name for a in agents)}")

    tools = merge_tools(agents)
    tools_str = ", ".join(tools)

    # Build parallel tasks section
    parallel_tasks = ""
    for agent in agents:
        parallel_tasks += f"""
### {agent.name}

{agent.description}

**Tools:** {", ".join(agent.tools) if agent.tools else "Inherited"}

"""

    content = f"""---
name: {composite_name}
description: {composite_desc}
tools: {tools_str}
---

# {composite_name.replace("-", " ").title()}

## Overview

{composite_desc}

**Pattern:** Parallelization
**Components:** {len(agents)} agents
**Aggregation:** {aggregation_strategy}

## Parallel Tasks
{parallel_tasks}
## Execution

1. Spawn all component agents concurrently via Task tool
2. Collect results as they complete
3. Aggregate using {aggregation_strategy} strategy
4. Return combined result

## Aggregation Strategy: {aggregation_strategy.title()}

{"- **Merge**: Combine all results into unified output" if aggregation_strategy == "merge" else ""}
{"- **Vote**: Take majority consensus from results" if aggregation_strategy == "vote" else ""}
{"- **First**: Return first successful result" if aggregation_strategy == "first" else ""}

## Error Handling

- Continue execution if some tasks fail
- Report partial results with failed task list
- Indicate which results are missing

---

*Composite agent generated by Platxa Agent Composer*
"""

    return CompositionResult(
        success=True,
        composite_name=composite_name,
        pattern=CompositionPattern.PARALLEL,
        agent_content=content,
        component_agents=[a.name for a in agents],
        tools_merged=tools,
        warnings=compat.suggestions,
    )


def compose_conditional(
    agents: list[AgentSpec],
    routing_rules: dict[str, str],
    name: str | None = None,
    description: str | None = None,
) -> CompositionResult:
    """
    Compose agents with conditional routing (routing pattern).

    Input is classified and routed to appropriate agent.

    Args:
        agents: List of handler agents
        routing_rules: Map of condition -> agent_name
        name: Name for composite agent
        description: Description

    Returns:
        CompositionResult with the composite agent
    """
    compat = check_compatibility(agents)
    if not compat.compatible:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.CONDITIONAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=compat.issues,
        )

    composite_name = name or f"router-{agents[0].name}"
    composite_desc = description or (f"Routes requests to: {', '.join(a.name for a in agents)}")

    tools = merge_tools(agents)
    tools_str = ", ".join(tools)

    # Build routing rules section
    rules_section = ""
    for condition, agent_name in routing_rules.items():
        agent = next((a for a in agents if a.name == agent_name), None)
        desc = agent.description if agent else "Handler"
        rules_section += f"- **{condition}** → `{agent_name}`: {desc}\n"

    content = f"""---
name: {composite_name}
description: {composite_desc}
tools: {tools_str}
---

# {composite_name.replace("-", " ").title()}

## Overview

{composite_desc}

**Pattern:** Routing (Conditional)
**Components:** {len(agents)} handlers

## Routing Rules

{rules_section}

## Classification Process

1. Analyze input to determine category
2. Match against routing rules
3. Dispatch to appropriate handler
4. Return handler result

## Handlers

{chr(10).join(f"### {a.name}{chr(10)}{chr(10)}{a.description}{chr(10)}" for a in agents)}

## Fallback

If no rule matches:
1. Use default handler if defined
2. Otherwise, ask for clarification
3. Log unrouted requests for improvement

---

*Composite agent generated by Platxa Agent Composer*
"""

    return CompositionResult(
        success=True,
        composite_name=composite_name,
        pattern=CompositionPattern.CONDITIONAL,
        agent_content=content,
        component_agents=[a.name for a in agents],
        tools_merged=tools,
        warnings=compat.suggestions,
    )


def compose_router(
    handlers: list[AgentSpec],
    routing_rules: list[RoutingRule],
    fallback_handler: AgentSpec | None = None,
    name: str | None = None,
    description: str | None = None,
) -> CompositionResult:
    """Generate a router agent: classify input → dispatch to specialized handler.

    Distinct from :func:`compose_conditional` (which takes a flat
    ``{condition: agent_name}`` dict). This version:

    - Treats categories as **first-class** (each rule has a category tag,
      description, optional keyword hints).
    - Requires every rule's ``handler_name`` to match one of ``handlers``,
      so dangling references fail loud at compose time, not at runtime.
    - Emits an explicit ``Fallback Handler`` section either pointing at
      ``fallback_handler`` (when provided) or describing the
      ask-for-clarification protocol (when not).

    Args:
        handlers: AgentSpecs for every specialized handler. Must include
            ``fallback_handler`` if one is passed.
        routing_rules: Ordered list of :class:`RoutingRule`. Order is
            preserved in the generated table so authors can express
            priority (first match wins).
        fallback_handler: Optional handler to dispatch to when no rule
            matches. When omitted, the generated agent's fallback
            section instructs the agent to ask for clarification.
        name: Override for the composite agent's frontmatter ``name``.
            Defaults to ``router-{first-handler-name}``.
        description: Override for the composite agent's frontmatter
            ``description``. Defaults to a list of categories.

    Returns:
        :class:`CompositionResult`. ``success=False`` when handlers are
        empty, when a rule references an unknown handler, or when
        ``check_compatibility`` rejects the handler set.

    Raises:
        Never — all error conditions are reported via ``CompositionResult.errors``.
    """
    errors: list[str] = []

    if not handlers:
        errors.append("compose_router requires at least one handler")
    if not routing_rules:
        errors.append("compose_router requires at least one routing rule")

    handler_names = {h.name for h in handlers}
    for rule in routing_rules:
        if rule.handler_name not in handler_names:
            errors.append(
                f"Routing rule for category '{rule.category}' references unknown "
                f"handler '{rule.handler_name}' (handlers: {sorted(handler_names)})"
            )
    if fallback_handler and fallback_handler.name not in handler_names:
        errors.append(f"fallback_handler '{fallback_handler.name}' is not in the handlers list")

    if errors:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.CONDITIONAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=errors,
        )

    compat = check_compatibility(handlers)
    if not compat.compatible:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.CONDITIONAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=compat.issues,
        )

    composite_name = name or f"router-{handlers[0].name}"
    composite_desc = description or (
        f"Routes requests across categories: {', '.join(r.category for r in routing_rules)}"
    )

    tools = merge_tools(handlers)
    tools_str = ", ".join(tools)

    # Routing table — first column is category, second is handler, third
    # is one-line description. Markdown table so terminal renderers
    # display it cleanly while machine parsers can still pluck rows.
    table_lines: list[str] = [
        "| Category | Handler | When to use |",
        "|----------|---------|-------------|",
    ]
    for rule in routing_rules:
        table_lines.append(f"| `{rule.category}` | `{rule.handler_name}` | {rule.description} |")

    # Per-rule keyword hints — only emit the section when at least one
    # rule has hints, so simple agents stay terse.
    hint_section = ""
    if any(r.keywords for r in routing_rules):
        hint_lines = ["## Classification Hints", ""]
        for rule in routing_rules:
            if not rule.keywords:
                continue
            kw = ", ".join(f"`{k}`" for k in rule.keywords)
            hint_lines.append(f"- **{rule.category}**: {kw}")
        hint_section = "\n".join(hint_lines) + "\n"

    if fallback_handler is not None:
        fallback_body = (
            f"When no routing rule matches, dispatch to the **fallback handler**:\n\n"
            f"- **`{fallback_handler.name}`**: {fallback_handler.description}\n\n"
            "The fallback handler is responsible for either handling the request "
            "directly or surfacing a clear error explaining why no specialized "
            "handler applied."
        )
    else:
        fallback_body = (
            "When no routing rule matches:\n\n"
            "1. Ask the user a single clarifying question naming the "
            "available categories from the routing table above.\n"
            "2. If the user's reply matches a category, route accordingly.\n"
            "3. Otherwise, return an explicit `unrouted` response so the "
            "caller can decide whether to retry, escalate, or abort.\n\n"
            "Never fabricate a routing decision when uncertain — uncertainty "
            "must surface to the caller, not be silently absorbed."
        )

    handler_index = "\n".join(f"### `{h.name}`\n\n{h.description}\n" for h in handlers)

    content = f"""---
name: {composite_name}
description: {composite_desc}
tools: {tools_str}
---

# {composite_name.replace("-", " ").title()}

## Overview

{composite_desc}

**Pattern:** Routing (classifier + specialized handlers)
**Handlers:** {len(handlers)}
**Routing rules:** {len(routing_rules)}

## Classification Process

1. Read the incoming request.
2. Compare against each row of the routing table below in order — first match wins.
3. If a match is found, dispatch to the named handler with the original input.
4. If no rule matches, follow the {ROUTER_FALLBACK_HEADER.split("## ", 1)[1]} below.

{ROUTER_TABLE_HEADER}

{chr(10).join(table_lines)}

{hint_section}{ROUTER_FALLBACK_HEADER}

{fallback_body}

## Handlers

{handler_index}

---

*Composite router agent generated by Platxa Agent Composer*
"""

    return CompositionResult(
        success=True,
        composite_name=composite_name,
        pattern=CompositionPattern.CONDITIONAL,
        agent_content=content,
        component_agents=[h.name for h in handlers],
        tools_merged=tools,
        warnings=compat.suggestions,
    )


def create_orchestrator(
    name: str,
    workers: list[AgentSpec],
    description: str | None = None,
    decomposition_strategy: str = "dynamic",
) -> CompositionResult:
    """
    Create an orchestrator agent from worker specifications.

    Implements the orchestrator-workers pattern.

    Args:
        name: Orchestrator name
        workers: List of worker agent specifications
        description: Description
        decomposition_strategy: How to decompose tasks (dynamic, fixed, hybrid)

    Returns:
        CompositionResult with the orchestrator agent
    """
    if len(workers) < 1:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.HIERARCHICAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=["At least 1 worker required for orchestrator"],
        )

    composite_desc = description or (f"Orchestrates: {', '.join(w.name for w in workers)}")

    # Orchestrator needs Task tool plus analysis tools
    tools = ["Read", "Grep", "Glob", "Task"]
    tools_str = ", ".join(tools)

    # Build workers section
    workers_section = ""
    for worker in workers:
        workers_section += f"""
### {worker.name}

**Role:** {worker.role or "Worker"}
**Description:** {worker.description}
**Tools:** {", ".join(worker.tools) if worker.tools else "Specialized"}

"""

    content = f"""---
name: {name}
description: {composite_desc}
tools: {tools_str}
---

# {name.replace("-", " ").title()}

## Overview

{composite_desc}

**Pattern:** Orchestrator-Workers
**Workers:** {len(workers)}
**Decomposition:** {decomposition_strategy}

## Available Workers
{workers_section}
## Workflow

### Phase 1: Analysis

1. Receive and analyze the request
2. Identify required capabilities
3. Determine which workers are needed

### Phase 2: Decomposition

Strategy: **{decomposition_strategy.title()}**

{"- Analyze task at runtime to determine subtasks" if decomposition_strategy == "dynamic" else ""}
{"- Use predefined decomposition rules" if decomposition_strategy == "fixed" else ""}
{"- Combine predefined and dynamic decomposition" if decomposition_strategy == "hybrid" else ""}

### Phase 3: Execution

1. Spawn workers via Task tool
2. Manage dependencies between workers
3. Handle worker failures gracefully
4. Collect results progressively

### Phase 4: Synthesis

1. Combine worker outputs
2. Verify integration points
3. Generate unified result

## Worker Coordination

- Workers are spawned as needed
- Dependencies are respected
- Failed workers can be retried
- Partial results are preserved

## Error Handling

- If critical worker fails, report error
- If optional worker fails, continue with others
- Always provide status of each worker

---

*Composite agent generated by Platxa Agent Composer*
"""

    return CompositionResult(
        success=True,
        composite_name=name,
        pattern=CompositionPattern.HIERARCHICAL,
        agent_content=content,
        component_agents=[w.name for w in workers],
        tools_merged=tools,
    )


def save_composite_agent(
    result: CompositionResult,
    output_dir: Path | str = Path(".claude/agents"),
) -> tuple[bool, str]:
    """
    Save a composite agent to file.

    Args:
        result: Composition result
        output_dir: Directory to save to

    Returns:
        (success, message)
    """
    if not result.success:
        return False, f"Cannot save failed composition: {result.errors}"

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    file_path = output_path / f"{result.composite_name}.md"
    file_path.write_text(result.agent_content, encoding="utf-8")

    return True, f"Saved to {file_path}"


def load_agent_spec(file_path: Path | str) -> AgentSpec | None:
    """
    Load an agent specification from a markdown file.

    Args:
        file_path: Path to agent .md file

    Returns:
        AgentSpec or None if invalid
    """
    path = Path(file_path)
    if not path.exists():
        return None

    content = path.read_text(encoding="utf-8")

    # Parse frontmatter
    if not content.startswith("---"):
        return None

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None

    try:
        import yaml

        frontmatter = yaml.safe_load(parts[1])
    except Exception:
        return None

    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")
    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",") if t.strip()]

    return AgentSpec(
        name=name,
        description=description,
        tools=tools,
    )


def composition_to_dict(result: CompositionResult) -> dict[str, Any]:
    """Convert composition result to dictionary."""
    return {
        "success": result.success,
        "composite_name": result.composite_name,
        "pattern": result.pattern.value,
        "component_agents": result.component_agents,
        "tools_merged": result.tools_merged,
        "warnings": result.warnings,
        "errors": result.errors,
        "content_length": len(result.agent_content),
    }


def main() -> None:
    """CLI entry point for agent composer."""
    import argparse

    parser = argparse.ArgumentParser(description="Compose multiple agents into composite agents")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Sequential command
    seq_parser = subparsers.add_parser("sequential", help="Create sequential pipeline")
    seq_parser.add_argument("agents", nargs="+", help="Agent files to compose")
    seq_parser.add_argument("--name", help="Composite agent name")
    seq_parser.add_argument("--output", "-o", help="Output directory")

    # Parallel command
    par_parser = subparsers.add_parser("parallel", help="Create parallel composition")
    par_parser.add_argument("agents", nargs="+", help="Agent files to compose")
    par_parser.add_argument("--name", help="Composite agent name")
    par_parser.add_argument("--strategy", choices=["merge", "vote", "first"], default="merge")
    par_parser.add_argument("--output", "-o", help="Output directory")

    # Orchestrator command
    orch_parser = subparsers.add_parser("orchestrator", help="Create orchestrator")
    orch_parser.add_argument("--name", required=True, help="Orchestrator name")
    orch_parser.add_argument("workers", nargs="+", help="Worker agent files")
    orch_parser.add_argument("--output", "-o", help="Output directory")

    # Check command
    check_parser = subparsers.add_parser("check", help="Check compatibility")
    check_parser.add_argument("agents", nargs="+", help="Agent files to check")

    args = parser.parse_args()

    if args.command == "sequential":
        agents = [load_agent_spec(f) for f in args.agents]
        agents = [a for a in agents if a is not None]
        result = compose_sequential(agents, name=args.name)
        if result.success:
            output = args.output or ".claude/agents"
            _, msg = save_composite_agent(result, output)
            print(msg)
        else:
            print(f"Error: {result.errors}")

    elif args.command == "parallel":
        agents = [load_agent_spec(f) for f in args.agents]
        agents = [a for a in agents if a is not None]
        result = compose_parallel(agents, name=args.name, aggregation_strategy=args.strategy)
        if result.success:
            output = args.output or ".claude/agents"
            _, msg = save_composite_agent(result, output)
            print(msg)
        else:
            print(f"Error: {result.errors}")

    elif args.command == "orchestrator":
        workers = [load_agent_spec(f) for f in args.workers]
        workers = [w for w in workers if w is not None]
        result = create_orchestrator(args.name, workers)
        if result.success:
            output = args.output or ".claude/agents"
            _, msg = save_composite_agent(result, output)
            print(msg)
        else:
            print(f"Error: {result.errors}")

    elif args.command == "check":
        agents = [load_agent_spec(f) for f in args.agents]
        agents = [a for a in agents if a is not None]
        compat = check_compatibility(agents)
        print(f"Compatible: {compat.compatible}")
        if compat.issues:
            print("Issues:")
            for issue in compat.issues:
                print(f"  - {issue}")
        if compat.suggestions:
            print("Suggestions:")
            for suggestion in compat.suggestions:
                print(f"  - {suggestion}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
