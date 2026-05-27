#!/usr/bin/env python3
"""Agent composer for combining multiple agents into composite patterns."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

try:
    from .shared.paths import get_project_agents_dir
except ImportError:
    from shared.paths import get_project_agents_dir  # type: ignore[import-not-found,no-redef]

try:
    from .shared.tool_utils import parse_tools_string
except ImportError:
    from shared.tool_utils import (  # type: ignore[import-not-found,no-redef]
        parse_tools_string,
    )


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
    """A single routing rule mapping a category to a handler agent."""

    category: str
    description: str
    handler_name: str
    keywords: list[str] = field(default_factory=list)


ROUTER_TABLE_HEADER: str = "## Routing Table"
ROUTER_FALLBACK_HEADER: str = "## Fallback Handler"

# Max depth for hierarchical composition (orchestrator chains).
MAX_COMPOSITION_DEPTH: int = 3
# Depth at which a non-blocking warning is surfaced.
WARN_COMPOSITION_DEPTH: int = 2


def validate_composition_depth(depth: int) -> tuple[list[str], list[str]]:
    """Validate hierarchical depth. Returns ``(errors, warnings)``."""
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
    """Computed dependency graph with edges, cycles, missing deps, and roots."""

    edges: dict[str, list[str]] = field(default_factory=dict)
    cycles: list[list[str]] = field(default_factory=list)
    missing_dependencies: dict[str, list[str]] = field(default_factory=dict)
    roots: list[str] = field(default_factory=list)


def build_dependency_graph(agents: list[AgentSpec]) -> DependencyGraph:
    """Compute edges, cycles, missing deps, and roots for agent dependencies."""
    edges: dict[str, list[str]] = {a.name: list(a.dependencies) for a in agents}
    known_names = set(edges)

    missing: dict[str, list[str]] = {}
    for name, deps in edges.items():
        unresolved = [d for d in deps if d not in known_names]
        if unresolved:
            missing[name] = unresolved

    cycles = _find_dependency_cycles(edges)

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
    """Find every distinct cycle in a directed dependency graph."""
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
    """Render a DependencyGraph as a Mermaid flowchart."""
    lines: list[str] = ["```mermaid", "graph TD"]

    if not graph.edges:
        lines.append("```")
        return "\n".join(lines)

    cycle_edges: set[tuple[str, str]] = set()
    for cycle in graph.cycles:
        for i in range(len(cycle) - 1):
            cycle_edges.add((cycle[i], cycle[i + 1]))

    for name in graph.edges:
        safe = _mermaid_id(name)
        lines.append(f"    {safe}[{name}]")

    for name, deps in graph.edges.items():
        src = _mermaid_id(name)
        for dep in deps:
            dst = _mermaid_id(dep)
            arrow = "-.->" if (name, dep) in cycle_edges else "-->"
            if dep in graph.missing_dependencies.get(name, []):
                lines.append(f"    {src} {arrow} {dst}[MISSING: {dep}]")
            else:
                lines.append(f"    {src} {arrow} {dst}")

    lines.append("```")
    return "\n".join(lines)


def _mermaid_id(name: str) -> str:
    """Convert an agent name to a Mermaid-safe node identifier."""
    return "".join(c if c.isalnum() else "_" for c in name)


def render_dependency_readme_section(graph: DependencyGraph) -> str:
    """Render the dependency graph as a README-ready Markdown section."""
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
    """Extract top-level field names from a JSON-schema-like dict."""
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
    """Check if an output schema is compatible with an input schema."""
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
    """Validate that adjacent pipeline stages have compatible I/O schemas."""
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
    """Validate that parallel agents produce merge-compatible output schemas."""
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


def _render_frontmatter(
    name: str,
    description: str,
    tools: list[str],
    pattern: str,
    components: list[AgentSpec] | None = None,
) -> str:
    """Render minimal agent frontmatter. Full templates live in skill references."""
    tools_str = ", ".join(tools)
    lines = [
        f"---\nname: {name}\ndescription: {description}\n"
        f"tools: {tools_str}\n---\n\n"
        f"# {name.replace('-', ' ').title()}\n\n"
        f"**Pattern:** {pattern}\n",
    ]
    if components:
        lines.append("\n## Components\n")
        for c in components:
            lines.append(f"- **{c.name}**: {c.description}\n")
    return "".join(lines)


def compose_sequential(
    agents: list[AgentSpec],
    name: str | None = None,
    description: str | None = None,
) -> CompositionResult:
    """Compose agents into a sequential pipeline (prompt-chaining pattern)."""
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

    composite_name = name or f"{agents[0].name}-to-{agents[-1].name}-pipeline"
    composite_desc = description or (f"Sequential pipeline: {' → '.join(a.name for a in agents)}")
    tools = merge_tools(agents)

    # Minimal frontmatter — full template content is in skill references.
    content = _render_frontmatter(composite_name, composite_desc, tools, "sequential", agents)

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
    """Compose agents for parallel execution (parallelization pattern)."""
    compat = check_compatibility(agents)

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

    content = _render_frontmatter(composite_name, composite_desc, tools, "parallel", agents)

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
    """Compose agents with conditional routing (routing pattern)."""
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

    content = _render_frontmatter(composite_name, composite_desc, tools, "conditional", agents)
    rules_section = "\n## Routing Rules\n\n"
    for condition, agent_name in routing_rules.items():
        agent = next((a for a in agents if a.name == agent_name), None)
        desc = agent.description if agent else "Handler"
        rules_section += f"- **{condition}** → `{agent_name}`: {desc}\n"
    content += rules_section

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
    """Generate a router agent: classify input then dispatch to a handler."""
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

    table_lines: list[str] = [
        "| Category | Handler | When to use |",
        "|----------|---------|-------------|",
    ]
    for rule in routing_rules:
        table_lines.append(f"| `{rule.category}` | `{rule.handler_name}` | {rule.description} |")

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

    content = (
        f"---\nname: {composite_name}\ndescription: {composite_desc}\n"
        f"tools: {tools_str}\n---\n\n"
        f"# {composite_name.replace('-', ' ').title()}\n\n"
        f"**Pattern:** Routing (classifier + specialized handlers)\n"
        f"**Handlers:** {len(handlers)}\n"
        f"**Routing rules:** {len(routing_rules)}\n\n"
        f"## Classification Process\n\n"
        f"1. Read the incoming request.\n"
        f"2. Compare against each row of the routing table below in order — first match wins.\n"
        f"3. If a match is found, dispatch to the named handler with the original input.\n"
        f"4. If no rule matches, follow the "
        f"{ROUTER_FALLBACK_HEADER.split('## ', 1)[1]} below.\n\n"
        f"{ROUTER_TABLE_HEADER}\n\n"
        f"{chr(10).join(table_lines)}\n\n"
        f"{hint_section}{ROUTER_FALLBACK_HEADER}\n\n"
        f"{fallback_body}\n\n"
        f"## Handlers\n\n"
        f"{handler_index}\n"
    )

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
    """Create an orchestrator agent from worker specifications."""
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
    tools = ["Read", "Grep", "Glob", "Task"]

    content = _render_frontmatter(name, composite_desc, tools, "orchestrator", workers)
    content += f"\n**Decomposition:** {decomposition_strategy}\n"

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
    output_dir: Path | str | None = None,
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

    # None sentinel → source the project-scope agents directory from
    # ``shared.paths`` so this callsite cannot drift from the other
    # seven migrated sites that key off the same helper.
    output_path = Path(output_dir) if output_dir is not None else get_project_agents_dir()
    output_path.mkdir(parents=True, exist_ok=True)

    file_path = output_path / f"{result.composite_name}.md"
    file_path.write_text(result.agent_content, encoding="utf-8")

    return True, f"Saved to {file_path}"


def load_agent_spec(file_path: Path | str) -> AgentSpec | None:
    """Load an agent specification from a markdown file."""
    path = Path(file_path)
    if not path.exists():
        return None

    content = path.read_text(encoding="utf-8")

    try:
        try:
            from .shared.frontmatter import parse_frontmatter_safe
        except ImportError:
            from shared.frontmatter import (  # type: ignore[import-not-found,no-redef]
                parse_frontmatter_safe,
            )
    except ImportError as e:
        print(
            f"warning: agent_composer failed to parse frontmatter "
            f"in {path}: {type(e).__name__}: {e}",
            file=sys.stderr,
        )
        return None

    frontmatter, errors = parse_frontmatter_safe(content)
    if frontmatter is None:
        first_error = errors[0] if errors else None
        error_summary = (
            f"{first_error.code}: {first_error.message}" if first_error else "unknown parse failure"
        )
        print(
            f"warning: agent_composer failed to parse frontmatter in {path}: {error_summary}",
            file=sys.stderr,
        )
        return None

    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")
    tools = parse_tools_string(frontmatter.get("tools", ""))

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
