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

import sys
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


# Maximum allowed depth for hierarchical composition (orchestrator → worker
# → sub-worker chains). A composition at this depth is still valid; anything
# strictly greater fails validation. Capped to keep generated agents
# debuggable and to prevent runaway recursion when one orchestrator
# composes another. Three levels matches the orchestrator-workers research
# guidance: a top-level coordinator, a layer of specialized workers, and
# at most one layer of helpers below each worker.
MAX_COMPOSITION_DEPTH: int = 3

# Depth at which a non-blocking warning is surfaced. Composing at this
# depth is allowed (it sits within MAX_COMPOSITION_DEPTH) but the
# composer flags it so the caller can reconsider whether the nesting
# is justified before pushing closer to the hard cap.
WARN_COMPOSITION_DEPTH: int = 2


def validate_composition_depth(depth: int) -> tuple[list[str], list[str]]:
    """Validate a hierarchical composition depth.

    Args:
        depth: The depth (1-indexed) of the composition being created.
            Top-level orchestrators are depth=1; an orchestrator whose
            workers are themselves orchestrators is depth=2; and so on.

    Returns:
        Tuple ``(errors, warnings)``:

        - ``errors``: Non-empty when ``depth > MAX_COMPOSITION_DEPTH`` or
          ``depth < 1``. Callers must treat a non-empty list as a
          composition failure.
        - ``warnings``: Non-empty when ``WARN_COMPOSITION_DEPTH <= depth
          <= MAX_COMPOSITION_DEPTH``. Non-blocking — surface to the user
          but allow composition to proceed.
    """
    errors: list[str] = []
    warnings: list[str] = []
    if depth < 1:
        errors.append(
            f"Composition depth must be >= 1 (top-level=1); got {depth}. "
            "Pass the orchestrator's own depth, not the depth of its workers."
        )
        return errors, warnings
    if depth > MAX_COMPOSITION_DEPTH:
        errors.append(
            f"Composition depth {depth} exceeds MAX_COMPOSITION_DEPTH="
            f"{MAX_COMPOSITION_DEPTH}. Hierarchies deeper than "
            f"{MAX_COMPOSITION_DEPTH} levels become hard to debug and "
            "are usually a signal to flatten the design (e.g. promote "
            "a sub-worker to a peer worker, or split into two pipelines)."
        )
        return errors, warnings
    if depth >= WARN_COMPOSITION_DEPTH:
        warnings.append(
            f"Composition depth {depth} is at or above "
            f"WARN_COMPOSITION_DEPTH={WARN_COMPOSITION_DEPTH}. Consider "
            "whether the nesting is essential before composing further "
            f"(hard limit is MAX_COMPOSITION_DEPTH={MAX_COMPOSITION_DEPTH})."
        )
    return errors, warnings


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


@dataclass
class DependencyGraph:
    """A computed dependency graph across a set of AgentSpecs.

    Captured separately from any rendering so the same graph can drive
    multiple outputs (Mermaid diagram, README section, CLI output) and
    so the cycle-detection results are inspectable by callers — not
    just bundled into the rendered string.

    Fields:
        edges: ``{agent_name: [dependency_names...]}`` keyed by every
            agent in the input set, including agents with no
            dependencies (whose value is ``[]``). The list preserves
            the order the dependencies were declared in the source
            ``AgentSpec.dependencies``.
        cycles: List of cycle paths as ``list[str]`` where the first
            and last elements are the same agent (closing the loop).
            Empty list means no cycles. Each cycle is reported once
            even when multiple traversal paths reach it.
        missing_dependencies: ``{agent_name: [missing_dep_names...]}``
            for entries declared as dependencies but not present in
            the input set. Empty dict means every dependency resolved.
            Reported separately from cycles because a missing-dep is
            a *naming* problem (typo, agent renamed) rather than a
            structural one.
        roots: Agents that nothing else depends on — the natural entry
            points for a top-down read of the graph.
    """

    edges: dict[str, list[str]] = field(default_factory=dict)
    cycles: list[list[str]] = field(default_factory=list)
    missing_dependencies: dict[str, list[str]] = field(default_factory=dict)
    roots: list[str] = field(default_factory=list)


def build_dependency_graph(agents: list[AgentSpec]) -> DependencyGraph:
    """Compute the dependency graph for a list of agents.

    Walks each agent's ``dependencies`` list to build the adjacency
    map, then surfaces three pieces of derived information that
    callers commonly need:

    1. **Cycles** — found via DFS with an explicit traversal path so
       the cycle is reported as the actual ring of names rather than
       just a boolean. The ring closes on the first revisited node so
       the user can read the loop directly.
    2. **Missing dependencies** — names referenced from a
       ``dependencies`` list that don't match any agent in the input.
       Common when an agent is renamed without updating its consumers.
    3. **Roots** — agents that are not depended on by anyone. These
       are the natural starting points for documenting or executing
       the graph top-down.

    Args:
        agents: The agents whose dependency relationships should be
            analyzed. May be empty.

    Returns:
        :class:`DependencyGraph` with the four populated fields.
    """
    # Build adjacency map keyed by every agent name (so isolated
    # agents still appear in the graph).
    edges: dict[str, list[str]] = {a.name: list(a.dependencies) for a in agents}
    known_names = set(edges)

    # Surface unresolved dependency names. Don't drop them from the
    # adjacency map — keeping them lets the cycle detector still see
    # the declared edge, and the caller can render them as red nodes.
    missing: dict[str, list[str]] = {}
    for name, deps in edges.items():
        unresolved = [d for d in deps if d not in known_names]
        if unresolved:
            missing[name] = unresolved

    cycles = _find_dependency_cycles(edges)

    # Roots: nodes that no other node depends on. Order preserved from
    # input so the output is deterministic.
    referenced: set[str] = set()
    for deps in edges.values():
        for dep in deps:
            referenced.add(dep)
    roots = [name for name in edges if name not in referenced]

    return DependencyGraph(
        edges=edges,
        cycles=cycles,
        missing_dependencies=missing,
        roots=roots,
    )


def _find_dependency_cycles(edges: dict[str, list[str]]) -> list[list[str]]:
    """Find every distinct cycle in a directed dependency graph.

    Returns each cycle as a list of names ending where it began (so
    ``[a, b, c, a]`` reads as "a depends on b, b on c, c on a"). The
    closing element makes the loop visually obvious in CLI output and
    Mermaid diagrams without forcing the renderer to add it.

    Cycles are deduplicated by their normalized rotation: a single
    ring reached from two different start nodes is reported once.
    """
    cycles_found: list[list[str]] = []
    seen_signatures: set[tuple[str, ...]] = set()

    def dfs(node: str, path: list[str], visiting: set[str]) -> None:
        for neighbor in edges.get(node, []):
            if neighbor in visiting:
                # Slice the path from the first occurrence of neighbor
                # so the reported cycle is exactly the loop, not the
                # tail leading into it.
                start_idx = path.index(neighbor)
                cycle = path[start_idx:] + [neighbor]
                # Deduplicate by rotation. Normalize so the smallest
                # name is first; then the same ring entered from any
                # vertex hashes identically.
                ring = cycle[:-1]
                pivot = min(range(len(ring)), key=lambda i: ring[i])
                normalized = tuple(ring[pivot:] + ring[:pivot])
                if normalized not in seen_signatures:
                    seen_signatures.add(normalized)
                    cycles_found.append(cycle)
                continue
            if neighbor not in edges:
                continue  # Missing dep — handled separately
            visiting.add(neighbor)
            path.append(neighbor)
            dfs(neighbor, path, visiting)
            path.pop()
            visiting.remove(neighbor)

    for start in edges:
        dfs(start, [start], {start})

    return cycles_found


def render_dependency_diagram(graph: DependencyGraph) -> str:
    """Render a DependencyGraph as a Mermaid flowchart.

    Mermaid is the de-facto standard for Markdown-embedded diagrams
    (GitHub, GitLab, and most documentation pipelines render it
    natively), so the output drops straight into a README without any
    extra tooling. The diagram uses ``graph TD`` (top-down) so root
    agents appear at the top and leaves at the bottom, matching how
    most readers walk a dependency tree.

    The rendering deliberately surfaces structural problems visually:

    - Missing dependencies render as nodes with the prefix
      ``MISSING:`` so they stand out in the diagram.
    - Cycle edges are tagged as ``-.->`` (dotted) so a reader sees the
      cycle without needing to cross-reference the ``cycles`` field.

    Args:
        graph: The dependency graph to render.

    Returns:
        A complete Mermaid diagram block, including the fenced-code
        wrapper Markdown renderers expect (``" ```mermaid ... ``` "``).
        Empty graph returns the wrapper with just the directive line so
        downstream parsers always see a valid Mermaid block.
    """
    lines: list[str] = ["```mermaid", "graph TD"]

    if not graph.edges:
        lines.append("```")
        return "\n".join(lines)

    # Track edges that participate in a cycle so they can be rendered
    # with the dotted arrow style. Build a set of (from, to) pairs by
    # walking each cycle path.
    cycle_edges: set[tuple[str, str]] = set()
    for cycle in graph.cycles:
        for i in range(len(cycle) - 1):
            cycle_edges.add((cycle[i], cycle[i + 1]))

    # Emit every node first so isolated agents (no dependencies, not
    # depended on) still appear in the diagram.
    for name in graph.edges:
        safe = _mermaid_id(name)
        lines.append(f"    {safe}[{name}]")

    # Emit edges. Mermaid uses ``A --> B`` for "A depends on B" — we
    # follow the dependency direction (depender → dependency) so the
    # arrow visually points at what each agent needs.
    for name, deps in graph.edges.items():
        src = _mermaid_id(name)
        for dep in deps:
            dst = _mermaid_id(dep)
            arrow = "-.->" if (name, dep) in cycle_edges else "-->"
            if dep in graph.missing_dependencies.get(name, []):
                # Inline-declare the missing node with a MISSING: prefix
                # so it stands out from regular agents.
                lines.append(f"    {src} {arrow} {dst}[MISSING: {dep}]")
            else:
                lines.append(f"    {src} {arrow} {dst}")

    lines.append("```")
    return "\n".join(lines)


def _mermaid_id(name: str) -> str:
    """Convert an agent name to a Mermaid-safe node identifier.

    Mermaid identifiers cannot contain hyphens or special characters,
    so we substitute underscores. The original name is preserved as
    the node label (in square brackets) so the diagram still reads
    naturally.
    """
    return "".join(c if c.isalnum() else "_" for c in name)


def render_dependency_readme_section(graph: DependencyGraph) -> str:
    """Render the dependency graph as a README-ready Markdown section.

    Combines the Mermaid diagram with prose summaries the diagram
    cannot convey: a roots list (entry points for top-down reading), a
    cycle warning when applicable, and a missing-dependency callout.
    Always emits the same heading (``## Agent Dependencies``) so the
    section can be located and replaced by automated documentation
    pipelines.
    """
    lines: list[str] = ["## Agent Dependencies", ""]

    if not graph.edges:
        lines.append("_No agents to document._")
        lines.append("")
        return "\n".join(lines)

    lines.append(render_dependency_diagram(graph))
    lines.append("")

    if graph.roots:
        lines.append("**Entry points:** " + ", ".join(f"`{r}`" for r in graph.roots))
        lines.append("")

    if graph.cycles:
        lines.append("> **Warning:** Circular dependencies detected:")
        lines.append("")
        for cycle in graph.cycles:
            arrow_chain = " → ".join(cycle)
            lines.append(f"> - {arrow_chain}")
        lines.append("")

    if graph.missing_dependencies:
        lines.append("> **Warning:** Missing dependencies (referenced but not defined):")
        lines.append("")
        for name, missing in graph.missing_dependencies.items():
            for m in missing:
                lines.append(f"> - `{name}` → `{m}`")
        lines.append("")

    return "\n".join(lines)


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
    depth: int = 1,
) -> CompositionResult:
    """
    Create an orchestrator agent from worker specifications.

    Implements the orchestrator-workers pattern.

    Args:
        name: Orchestrator name
        workers: List of worker agent specifications
        description: Description
        decomposition_strategy: How to decompose tasks (dynamic, fixed, hybrid)
        depth: 1-indexed depth of this orchestrator in a hierarchical
            composition. Top-level orchestrators use ``depth=1`` (the
            default). When this orchestrator's workers are themselves
            orchestrators, callers should pass ``depth=2`` for the
            outer orchestrator, ``depth=3`` for the next layer, etc.
            Validation fails when ``depth > MAX_COMPOSITION_DEPTH`` and
            a warning is emitted when ``depth >= WARN_COMPOSITION_DEPTH``.

    Returns:
        CompositionResult with the orchestrator agent
    """
    depth_errors, depth_warnings = validate_composition_depth(depth)
    if depth_errors:
        return CompositionResult(
            success=False,
            composite_name="",
            pattern=CompositionPattern.HIERARCHICAL,
            agent_content="",
            component_agents=[],
            tools_merged=[],
            errors=depth_errors,
        )

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
        warnings=depth_warnings,
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
    except ImportError as e:
        # PyYAML missing at runtime means we cannot parse any agent
        # frontmatter. The previous broad ``except Exception: return None``
        # hid this environmental failure so every composition call
        # silently treated every agent as invalid. Surface the path and
        # error class so operators can see which dependency is missing.
        # Python evaluates except-tuple classes eagerly, so ImportError
        # cannot share a tuple with ``yaml.YAMLError`` (the latter would
        # raise NameError when ``yaml`` isn't bound); the two paths live
        # in separate except clauses.
        print(
            f"warning: agent_composer failed to parse frontmatter "
            f"in {path}: {type(e).__name__}: {e}",
            file=sys.stderr,
        )
        return None
    except (yaml.YAMLError, AttributeError) as e:
        # yaml.YAMLError: malformed YAML syntax in the frontmatter block
        # (e.g. unclosed quote, bad indentation).
        # AttributeError: defensive catch for edge cases where yaml's
        # loader returns a non-dict (bare string, list) that lacks the
        # attribute access the downstream ``frontmatter.get(...)`` calls
        # expect — kept INSIDE the narrowed except so the warning names
        # this specific agent file rather than dying with a traceback
        # in the caller.
        print(
            f"warning: agent_composer failed to parse frontmatter "
            f"in {path}: {type(e).__name__}: {e}",
            file=sys.stderr,
        )
        return None

    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")
    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",") if t.strip()]

    # Dependencies may be declared as a YAML list (``dependencies: [a, b]``)
    # or as a comma-separated string (``dependencies: "a, b"``). Accept both
    # so authors can use whichever feels natural; downstream code only sees
    # the parsed list.
    deps_raw = frontmatter.get("dependencies", [])
    if isinstance(deps_raw, str):
        dependencies = [d.strip() for d in deps_raw.split(",") if d.strip()]
    elif isinstance(deps_raw, list):
        dependencies = [str(d).strip() for d in deps_raw if str(d).strip()]
    else:
        dependencies = []

    return AgentSpec(
        name=name,
        description=description,
        tools=tools,
        dependencies=dependencies,
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

    # Dependency-graph command — renders the dependency graph as a
    # Mermaid diagram (default) or full README section. Exits non-zero
    # when circular dependencies are detected so CI pipelines can gate
    # on graph health.
    deps_parser = subparsers.add_parser(
        "deps",
        help="Render agent dependency graph (Mermaid diagram + cycle detection)",
    )
    deps_parser.add_argument("agents", nargs="+", help="Agent files to analyze")
    deps_parser.add_argument(
        "--format",
        choices=["mermaid", "readme"],
        default="mermaid",
        help="Output format (default: mermaid diagram only)",
    )

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

    elif args.command == "deps":
        agents = [load_agent_spec(f) for f in args.agents]
        agents = [a for a in agents if a is not None]
        graph = build_dependency_graph(agents)
        if args.format == "readme":
            print(render_dependency_readme_section(graph))
        else:
            print(render_dependency_diagram(graph))
        # Exit non-zero on cycles so CI pipelines can fail closed.
        if graph.cycles:
            raise SystemExit(2)

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
