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

    def to_markdown(self) -> str:
        """Generate agent markdown definition."""
        tools_str = ", ".join(self.tools)
        responsibilities = "\n".join(f"- {r}" for r in self.responsibilities)

        content = f"""---
name: {self.name}
description: {self.description}
tools: {tools_str}
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
1. Receive task assignment
2. Execute specialized processing
3. Report results back to orchestrator
"""
        return content

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "role": self.role,
            "tools": self.tools,
            "responsibilities": self.responsibilities,
            "inputs": self.inputs,
            "outputs": self.outputs,
        }


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
            f'   - Spawn `{name}` for {self.workers[i].responsibilities[0] if self.workers[i].responsibilities else "specialized task"}'
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

## Error Handling
- If a worker fails, analyze the error
- Attempt retry with modified parameters
- Fall back to alternative approach if needed
- Report unrecoverable errors with context

## Output Format
Provide structured summary including:
- Tasks completed successfully
- Any issues encountered
- Final aggregated results
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
}


def create_agent_from_dict(data: dict[str, Any]) -> AgentDefinition:
    """Create AgentDefinition from dictionary."""
    return AgentDefinition(
        name=data["name"],
        description=data["description"],
        role=data["role"],
        tools=data["tools"],
        responsibilities=data["responsibilities"],
        inputs=data.get("inputs", []),
        outputs=data.get("outputs", []),
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
        worker = AgentDefinition(
            name=f"{name}-{role_name}",
            description=role_desc,
            role="worker",
            tools=role_tools,
            responsibilities=[f"Handle {role_name} tasks", "Report results to orchestrator"],
            outputs=[f"{role_name.title()} output"],
        )
        workers.append(worker)

    return MultiAgentSystem(
        name=name,
        description=description,
        pattern=pattern,
        orchestrator=orchestrator,
        workers=workers,
    )


def _get_worker_roles(
    domain: str, count: int
) -> list[tuple[str, str, list[str]]]:
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

    # Save orchestrator
    orchestrator_path = output_dir / f"{system.orchestrator.name}.md"
    orchestrator_path.write_text(
        system.generate_orchestrator_markdown(), encoding="utf-8"
    )
    created_files.append(orchestrator_path)

    # Save workers
    for worker in system.workers:
        worker_path = output_dir / f"{worker.name}.md"
        worker_path.write_text(worker.to_markdown(), encoding="utf-8")
        created_files.append(worker_path)

    # Save system manifest
    manifest_path = output_dir / f"{system.name}-manifest.json"
    manifest_path.write_text(
        json.dumps(system.to_dict(), indent=2), encoding="utf-8"
    )
    created_files.append(manifest_path)

    return created_files


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate coordinated multi-agent systems"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate multi-agent system")
    gen_parser.add_argument("--name", required=True, help="System name")
    gen_parser.add_argument("--description", default="", help="System description")
    gen_parser.add_argument(
        "--pattern",
        choices=["orchestrator-workers", "pipeline", "parallel"],
        default="orchestrator-workers",
        help="Workflow pattern",
    )
    gen_parser.add_argument(
        "--workers", type=int, default=3, help="Number of workers"
    )
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
        choices=["orchestrator-workers", "pipeline", "parallel"],
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
        # Show example orchestrator markdown
        if args.pattern == "orchestrator-workers":
            system = create_system_from_template("code-review")
        elif args.pattern == "pipeline":
            system = create_system_from_template("documentation")
        else:
            system = create_system_from_template("test-suite")

        if system:
            print(system.generate_orchestrator_markdown())

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
