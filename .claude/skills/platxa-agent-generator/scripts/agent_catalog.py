#!/usr/bin/env python3
"""
Agent Catalog for Pre-Built Agents

Provides a catalog of pre-built, production-ready agent templates that can be
installed directly or used as starting points for customization.

Features:
- List available agents by category
- Search agents by keywords
- Install agents from catalog
- View agent details and documentation
- Version tracking and updates

Categories:
- code-quality: Code review, linting, testing agents
- documentation: Doc generation, README, API docs
- research: Web search, analysis, investigation
- devops: CI/CD, deployment, infrastructure
- security: Security scanning, vulnerability detection
- productivity: Task automation, workflow optimization

Usage:
    python agent_catalog.py list                           # List all agents
    python agent_catalog.py list --category code-quality   # List by category
    python agent_catalog.py search "code review"           # Search agents
    python agent_catalog.py show code-reviewer             # Show agent details
    python agent_catalog.py install code-reviewer          # Install agent
    python agent_catalog.py install code-reviewer --scope project
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class WorkflowStep:
    """A single step in an agent workflow."""

    name: str
    description: str
    tools_used: list[str] = field(default_factory=list)
    quality_gate: str = ""


@dataclass
class AgentExample:
    """A detailed example of agent usage."""

    title: str
    user_input: str
    agent_response: str
    key_actions: list[str] = field(default_factory=list)


@dataclass
class AgentTemplate:
    """Template for a pre-built agent."""

    name: str
    description: str
    category: str
    version: str = "1.0.0"
    tools: list[str] = field(default_factory=list)
    pattern: str = "prompt-chaining"
    tags: list[str] = field(default_factory=list)
    author: str = "Platxa"
    examples: list[str] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    mcp_servers: list[str] = field(default_factory=list)
    # Production-grade enhancements
    workflow_steps: list[WorkflowStep] = field(default_factory=list)
    detailed_examples: list[AgentExample] = field(default_factory=list)
    system_prompt_additions: str = ""
    security_considerations: list[str] = field(default_factory=list)
    best_practices: list[str] = field(default_factory=list)
    quality_criteria: list[str] = field(default_factory=list)
    error_handling: list[str] = field(default_factory=list)
    output_schema: dict[str, Any] = field(default_factory=dict)


# Pre-built agent catalog
AGENT_CATALOG: dict[str, AgentTemplate] = {
    # Code Quality Agents
    "code-reviewer": AgentTemplate(
        name="code-reviewer",
        description="Reviews code for bugs, style issues, security vulnerabilities, and best practices with confidence-based filtering",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash", "Task"],
        pattern="prompt-chaining",
        tags=["review", "quality", "bugs", "style", "security", "best-practices"],
        examples=[
            "Review the changes in this PR",
            "Check this file for potential issues",
            "Analyze code quality in src/",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Scope Analysis",
                description="Identify files to review by analyzing git diff, PR changes, or specified paths. Determine file types and applicable review criteria.",
                tools_used=["Bash", "Glob"],
                quality_gate="All target files identified and categorized by language/framework",
            ),
            WorkflowStep(
                name="Static Analysis",
                description="Run language-specific linters and type checkers. Execute pyright, eslint, ruff, or other relevant tools based on file types.",
                tools_used=["Bash"],
                quality_gate="All static analysis tools complete without configuration errors",
            ),
            WorkflowStep(
                name="Deep Code Review",
                description="Analyze code for logic errors, edge cases, race conditions, resource leaks, and architectural issues. Check for SOLID violations and design patterns.",
                tools_used=["Read", "Grep"],
                quality_gate="Each file reviewed with documented findings",
            ),
            WorkflowStep(
                name="Security Audit",
                description="Scan for OWASP Top 10 vulnerabilities, injection risks, authentication flaws, sensitive data exposure, and insecure dependencies.",
                tools_used=["Read", "Grep", "Bash"],
                quality_gate="Security checklist completed for all files",
            ),
            WorkflowStep(
                name="Best Practices Check",
                description="Verify adherence to language idioms, project conventions (from CLAUDE.md), naming standards, and documentation requirements.",
                tools_used=["Read", "Grep"],
                quality_gate="Conventions checklist validated against project standards",
            ),
            WorkflowStep(
                name="Confidence Filtering",
                description="Assign confidence scores (high/medium/low) to each finding. Filter out low-confidence issues unless specifically requested.",
                tools_used=[],
                quality_gate="All findings have confidence scores; only high-confidence issues in primary report",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Generate structured report with categorized findings, severity levels, line references, and suggested fixes.",
                tools_used=[],
                quality_gate="Report follows standard format with actionable recommendations",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Pull Request Review",
                user_input="Review PR #123 for the authentication feature",
                agent_response="I'll review the PR changes comprehensively.\n\n**Files Changed:** 5 files (+342, -89 lines)\n\n**Critical Issues (High Confidence):**\n1. `auth/handler.py:45` - SQL injection vulnerability in user lookup\n2. `auth/token.py:78` - JWT secret hardcoded in source\n\n**Warnings (High Confidence):**\n1. `auth/session.py:112` - Session timeout not configurable\n2. `tests/test_auth.py` - Missing tests for edge cases\n\n**Suggestions:**\n1. Consider using parameterized queries\n2. Move secrets to environment variables\n\n**Overall:** 🔴 Requires changes before merge",
                key_actions=[
                    "Ran git diff to identify changed files",
                    "Executed pyright and ruff for static analysis",
                    "Performed line-by-line security audit",
                    "Checked against project CLAUDE.md conventions",
                ],
            ),
            AgentExample(
                title="Directory Code Quality Analysis",
                user_input="Analyze code quality in src/services/",
                agent_response="**Code Quality Analysis: src/services/**\n\n**Summary:** 12 files analyzed, 847 total lines\n\n**Quality Score:** 7.2/10\n\n**Issues by Category:**\n- Complexity: 3 functions exceed cyclomatic complexity threshold\n- Duplication: 2 code blocks with >80% similarity\n- Coverage: 4 functions lack proper error handling\n- Documentation: 6 public APIs missing docstrings\n\n**Top Priorities:**\n1. Refactor `payment_processor.py:process_payment()` (complexity: 15)\n2. Extract duplicate validation logic to shared utility\n3. Add error handling to database operations\n\n**Recommendations:** Focus on complexity reduction first for maintainability.",
                key_actions=[
                    "Globbed all files in target directory",
                    "Calculated complexity metrics per function",
                    "Identified duplicate code patterns",
                    "Analyzed error handling coverage",
                ],
            ),
        ],
        system_prompt_additions="""
## Code Review Philosophy

You are a senior engineer performing thorough code reviews. Your reviews should:

1. **Prioritize Impact**: Focus on issues that affect correctness, security, and maintainability
2. **Be Constructive**: Provide actionable feedback with suggested fixes
3. **Respect Context**: Consider the project's conventions and constraints
4. **Avoid Nitpicking**: Filter out trivial issues unless they indicate patterns

## Confidence Scoring

Assign confidence levels to findings:
- **High**: Definite bug, security vulnerability, or clear violation
- **Medium**: Likely issue but context-dependent
- **Low**: Stylistic preference or uncertain without more context

Only report high-confidence issues by default. Include medium-confidence with `--verbose`.

## Review Checklist

For each file, verify:
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] No security vulnerabilities
- [ ] Code follows project conventions
- [ ] Tests cover critical paths
- [ ] Documentation is adequate
""",
        security_considerations=[
            "Never execute code from the reviewed files",
            "Flag any hardcoded secrets or credentials immediately",
            "Check for command injection in shell operations",
            "Verify input validation on all external data",
            "Audit authentication and authorization logic carefully",
            "Look for SQL injection, XSS, and CSRF vulnerabilities",
        ],
        best_practices=[
            "Read CLAUDE.md first to understand project conventions",
            "Use git diff to understand change context",
            "Run existing linters before manual review",
            "Check test coverage for modified code",
            "Verify backwards compatibility for API changes",
            "Consider performance implications of changes",
        ],
        quality_criteria=[
            "All critical and high-severity issues identified",
            "No false positives in high-confidence findings",
            "Suggestions include specific line numbers",
            "Recommendations are actionable and specific",
            "Review completes within reasonable time",
        ],
        error_handling=[
            "If git commands fail, fall back to direct file analysis",
            "If linters are not installed, note in report and continue",
            "If files are too large, analyze in chunks",
            "If binary files encountered, skip with note",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {"type": "object", "properties": {
                    "files_reviewed": {"type": "integer"},
                    "total_lines": {"type": "integer"},
                    "quality_score": {"type": "number"},
                    "verdict": {"type": "string", "enum": ["approved", "approved_with_suggestions", "changes_required", "rejected"]},
                }},
                "critical_issues": {"type": "array", "items": {"type": "object", "properties": {
                    "file": {"type": "string"},
                    "line": {"type": "integer"},
                    "severity": {"type": "string"},
                    "confidence": {"type": "string"},
                    "description": {"type": "string"},
                    "suggestion": {"type": "string"},
                }}},
                "warnings": {"type": "array"},
                "suggestions": {"type": "array"},
                "security_findings": {"type": "array"},
            },
        },
    ),
    "test-writer": AgentTemplate(
        name="test-writer",
        description="Generates comprehensive test suites for code including unit, integration, and e2e tests",
        category="code-quality",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["testing", "unit-tests", "coverage"],
        examples=[
            "Write tests for the auth module",
            "Generate unit tests for utils.py",
            "Create e2e tests for the login flow",
        ],
    ),
    "refactoring-agent": AgentTemplate(
        name="refactoring-agent",
        description="Identifies and performs code refactoring to improve structure, readability, and maintainability",
        category="code-quality",
        version="1.0.0",
        tools=["Read", "Write", "Edit", "Grep", "Glob"],
        pattern="evaluator-optimizer",
        tags=["refactor", "clean-code", "maintainability"],
        examples=[
            "Refactor this function to be more readable",
            "Extract common logic into a utility",
            "Simplify this complex method",
        ],
    ),
    # Documentation Agents
    "documentation-agent": AgentTemplate(
        name="documentation-agent",
        description="Generates and maintains documentation including README, API docs, and code comments",
        category="documentation",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["docs", "readme", "api-docs", "comments"],
        examples=[
            "Generate README for this project",
            "Document this API endpoint",
            "Add docstrings to this module",
        ],
    ),
    "api-documenter": AgentTemplate(
        name="api-documenter",
        description="Creates comprehensive API documentation with examples, schemas, and usage guides",
        category="documentation",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["api", "openapi", "swagger", "rest"],
        examples=[
            "Document the REST API endpoints",
            "Generate OpenAPI spec",
            "Create API usage examples",
        ],
    ),
    # Research Agents
    "research-agent": AgentTemplate(
        name="research-agent",
        description="Conducts research on topics using web search, documentation analysis, and synthesis",
        category="research",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
        pattern="orchestrator-workers",
        tags=["research", "analysis", "web-search"],
        examples=[
            "Research best practices for authentication",
            "Find documentation for this library",
            "Compare different approaches to caching",
        ],
    ),
    "codebase-explorer": AgentTemplate(
        name="codebase-explorer",
        description="Explores and maps codebases to understand architecture, dependencies, and patterns",
        category="research",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["exploration", "architecture", "dependencies"],
        examples=[
            "Map the architecture of this project",
            "Find all database queries",
            "Trace the authentication flow",
        ],
    ),
    # DevOps Agents
    "ci-cd-agent": AgentTemplate(
        name="ci-cd-agent",
        description="Creates and maintains CI/CD pipelines for various platforms (GitHub Actions, GitLab CI, etc.)",
        category="devops",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["ci-cd", "github-actions", "deployment"],
        examples=[
            "Create GitHub Actions workflow",
            "Set up automated testing pipeline",
            "Configure deployment workflow",
        ],
    ),
    "docker-agent": AgentTemplate(
        name="docker-agent",
        description="Creates and optimizes Docker configurations including Dockerfiles and compose files",
        category="devops",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["docker", "containers", "compose"],
        examples=[
            "Create a Dockerfile for this app",
            "Optimize the Docker image size",
            "Set up docker-compose for development",
        ],
    ),
    # Security Agents
    "security-scanner": AgentTemplate(
        name="security-scanner",
        description="Scans code for security vulnerabilities, secrets, and OWASP top 10 issues",
        category="security",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="parallelization",
        tags=["security", "vulnerabilities", "owasp", "secrets"],
        examples=[
            "Scan this codebase for vulnerabilities",
            "Check for exposed secrets",
            "Analyze authentication security",
        ],
    ),
    "dependency-auditor": AgentTemplate(
        name="dependency-auditor",
        description="Audits project dependencies for known vulnerabilities and outdated packages",
        category="security",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["dependencies", "audit", "npm-audit", "pip-audit"],
        examples=[
            "Audit npm dependencies",
            "Check for vulnerable packages",
            "Find outdated dependencies",
        ],
    ),
    # Productivity Agents
    "task-automator": AgentTemplate(
        name="task-automator",
        description="Automates repetitive development tasks and creates helper scripts",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["automation", "scripts", "productivity"],
        examples=[
            "Create a script to rename files",
            "Automate the release process",
            "Set up pre-commit hooks",
        ],
    ),
    "git-helper": AgentTemplate(
        name="git-helper",
        description="Assists with git operations including commits, branches, rebasing, and conflict resolution",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Bash", "Grep", "Glob"],
        pattern="routing",
        tags=["git", "version-control", "branches", "commits"],
        examples=[
            "Help resolve merge conflicts",
            "Create a feature branch",
            "Squash commits before merge",
        ],
    ),
    "project-scaffolder": AgentTemplate(
        name="project-scaffolder",
        description="Scaffolds new projects with proper structure, configuration, and boilerplate",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Write", "Bash", "Glob"],
        pattern="prompt-chaining",
        tags=["scaffolding", "boilerplate", "setup"],
        examples=[
            "Create a new React project",
            "Scaffold a Python package",
            "Set up a FastAPI project",
        ],
    ),
}

# Category descriptions
CATEGORIES = {
    "code-quality": "Agents for code review, testing, and quality improvement",
    "documentation": "Agents for generating and maintaining documentation",
    "research": "Agents for research, analysis, and information gathering",
    "devops": "Agents for CI/CD, deployment, and infrastructure",
    "security": "Agents for security scanning and vulnerability detection",
    "productivity": "Agents for task automation and workflow optimization",
}


def list_agents(
    category: str | None = None,
    tags: list[str] | None = None,
) -> list[AgentTemplate]:
    """
    List agents from the catalog.

    Args:
        category: Filter by category
        tags: Filter by tags (any match)

    Returns:
        List of matching agent templates
    """
    agents = list(AGENT_CATALOG.values())

    if category:
        agents = [a for a in agents if a.category == category]

    if tags:
        tag_set = set(tags)
        agents = [a for a in agents if tag_set & set(a.tags)]

    return sorted(agents, key=lambda a: (a.category, a.name))


def search_agents(query: str) -> list[AgentTemplate]:
    """
    Search agents by query string.

    Args:
        query: Search query (matches name, description, tags)

    Returns:
        List of matching agent templates
    """
    query_lower = query.lower()
    results = []

    for agent in AGENT_CATALOG.values():
        # Check name
        if query_lower in agent.name.lower():
            results.append(agent)
            continue

        # Check description
        if query_lower in agent.description.lower():
            results.append(agent)
            continue

        # Check tags
        if any(query_lower in tag.lower() for tag in agent.tags):
            results.append(agent)
            continue

    return sorted(results, key=lambda a: a.name)


def get_agent(name: str) -> AgentTemplate | None:
    """Get an agent by name."""
    return AGENT_CATALOG.get(name)


def generate_agent_content(template: AgentTemplate) -> str:
    """
    Generate agent.md content from a template.

    Args:
        template: Agent template

    Returns:
        Generated agent.md content
    """
    tools_str = ", ".join(template.tools)
    tags_str = ", ".join(template.tags)

    # Build workflow section
    if template.workflow_steps:
        workflow_section = "## Workflow\n\n"
        workflow_section += f"This agent uses a **{template.pattern}** pattern for task execution.\n\n"
        workflow_section += "### Steps\n\n"
        for i, step in enumerate(template.workflow_steps, 1):
            workflow_section += f"#### {i}. {step.name}\n\n"
            workflow_section += f"{step.description}\n\n"
            if step.tools_used:
                workflow_section += f"**Tools:** {', '.join(step.tools_used)}\n\n"
            if step.quality_gate:
                workflow_section += f"**Quality Gate:** {step.quality_gate}\n\n"
    else:
        workflow_section = f"""## Workflow

This agent uses a **{template.pattern}** pattern for task execution.

### Steps

1. **Analyze**: Understand the user's request and context
2. **Plan**: Determine the best approach and tools to use
3. **Execute**: Perform the task using available tools
4. **Validate**: Verify the results meet requirements
5. **Report**: Summarize findings and recommendations
"""

    # Build examples section
    examples_section = ""
    if template.detailed_examples:
        examples_section = "## Examples\n\n"
        for example in template.detailed_examples:
            examples_section += f"### {example.title}\n\n"
            examples_section += f"**User:** {example.user_input}\n\n"
            examples_section += f"**Agent Response:**\n\n{example.agent_response}\n\n"
            if example.key_actions:
                examples_section += "**Key Actions:**\n"
                for action in example.key_actions:
                    examples_section += f"- {action}\n"
                examples_section += "\n"
    elif template.examples:
        examples_section = "## Examples\n\n"
        for i, example in enumerate(template.examples, 1):
            examples_section += f"### Example {i}\n\n"
            examples_section += f"**User:** {example}\n\n"
            examples_section += "**Agent:** [Executes the task using available tools]\n\n"

    # Build security section
    security_section = ""
    if template.security_considerations:
        security_section = "## Security Considerations\n\n"
        for item in template.security_considerations:
            security_section += f"- {item}\n"
        security_section += "\n"

    # Build best practices section
    best_practices_section = ""
    if template.best_practices:
        best_practices_section = "## Best Practices\n\n"
        for item in template.best_practices:
            best_practices_section += f"- {item}\n"
        best_practices_section += "\n"

    # Build quality criteria section
    quality_section = ""
    if template.quality_criteria:
        quality_section = "## Quality Criteria\n\n"
        for item in template.quality_criteria:
            quality_section += f"- {item}\n"
        quality_section += "\n"

    # Build error handling section
    error_section = ""
    if template.error_handling:
        error_section = "## Error Handling\n\n"
        for item in template.error_handling:
            error_section += f"- {item}\n"
        error_section += "\n"

    # Build output schema section
    output_section = ""
    if template.output_schema:
        output_section = "## Output Format\n\n"
        output_section += "```json\n"
        output_section += json.dumps(template.output_schema, indent=2)
        output_section += "\n```\n\n"
    else:
        output_section = f"""## Output Format

```json
{{
  "status": "success|error",
  "agent": "{template.name}",
  "results": [...],
  "summary": "..."
}}
```
"""

    # Build system prompt additions
    system_additions = ""
    if template.system_prompt_additions:
        system_additions = template.system_prompt_additions.strip() + "\n\n"

    content = f"""---
name: {template.name}
description: {template.description}
tools: {tools_str}
---

# {template.name.replace('-', ' ').title()}

## Overview

{template.description}

**Category:** {template.category}
**Version:** {template.version}
**Tags:** {tags_str}

{system_additions}{workflow_section}
{examples_section}## Tools

This agent has access to the following tools:

{chr(10).join(f"- **{tool}**: " + _get_tool_description(tool) for tool in template.tools)}

{security_section}{best_practices_section}{quality_section}{error_section}{output_section}---

*Generated from Platxa Agent Catalog v{template.version}*
"""
    return content


def _get_tool_description(tool: str) -> str:
    """Get description for a tool."""
    descriptions = {
        "Read": "Read file contents",
        "Write": "Write files",
        "Edit": "Edit existing files",
        "Grep": "Search file contents",
        "Glob": "Find files by pattern",
        "Bash": "Execute shell commands",
        "WebSearch": "Search the web",
        "WebFetch": "Fetch web content",
        "Task": "Spawn subagents",
    }
    return descriptions.get(tool, "Tool for specialized operations")


def install_from_catalog(
    name: str,
    scope: str = "user",
    force: bool = False,
) -> tuple[bool, str, str]:
    """
    Install an agent from the catalog.

    Args:
        name: Agent name from catalog
        scope: Installation scope (user or project)
        force: Overwrite existing

    Returns:
        (success, message, installed_path)
    """
    template = get_agent(name)
    if template is None:
        return False, f"Agent '{name}' not found in catalog", ""

    # Generate content
    content = generate_agent_content(template)

    # Determine installation path
    if scope == "user":
        install_dir = Path.home() / ".claude" / "agents"
    else:
        install_dir = Path.cwd() / ".claude" / "agents"

    install_path = install_dir / f"{name}.md"

    # Check existing
    if install_path.exists() and not force:
        return False, f"Agent already exists at {install_path}. Use --force to overwrite.", ""

    # Install
    install_dir.mkdir(parents=True, exist_ok=True)
    install_path.write_text(content, encoding="utf-8")

    return True, f"Installed {name} to {install_path}", str(install_path)


def template_to_dict(template: AgentTemplate) -> dict[str, Any]:
    """Convert template to dictionary."""
    result: dict[str, Any] = {
        "name": template.name,
        "description": template.description,
        "category": template.category,
        "version": template.version,
        "tools": template.tools,
        "pattern": template.pattern,
        "tags": template.tags,
        "author": template.author,
        "examples": template.examples,
        "requirements": template.requirements,
        "mcp_servers": template.mcp_servers,
    }
    # Include production-grade fields if present
    if template.workflow_steps:
        result["workflow_steps"] = [
            {
                "name": s.name,
                "description": s.description,
                "tools_used": s.tools_used,
                "quality_gate": s.quality_gate,
            }
            for s in template.workflow_steps
        ]
    if template.detailed_examples:
        result["detailed_examples"] = [
            {
                "title": e.title,
                "user_input": e.user_input,
                "agent_response": e.agent_response,
                "key_actions": e.key_actions,
            }
            for e in template.detailed_examples
        ]
    if template.system_prompt_additions:
        result["system_prompt_additions"] = template.system_prompt_additions
    if template.security_considerations:
        result["security_considerations"] = template.security_considerations
    if template.best_practices:
        result["best_practices"] = template.best_practices
    if template.quality_criteria:
        result["quality_criteria"] = template.quality_criteria
    if template.error_handling:
        result["error_handling"] = template.error_handling
    if template.output_schema:
        result["output_schema"] = template.output_schema
    return result


def catalog_to_dict() -> dict[str, Any]:
    """Export catalog as dictionary."""
    return {
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "categories": CATEGORIES,
        "agents": {
            name: template_to_dict(template)
            for name, template in AGENT_CATALOG.items()
        },
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Agent catalog for pre-built agents"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # List command
    list_parser = subparsers.add_parser("list", help="List available agents")
    list_parser.add_argument("--category", "-c", help="Filter by category")
    list_parser.add_argument("--tags", "-t", help="Filter by tags (comma-separated)")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search agents")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Show command
    show_parser = subparsers.add_parser("show", help="Show agent details")
    show_parser.add_argument("name", help="Agent name")
    show_parser.add_argument("--json", action="store_true", help="Output as JSON")
    show_parser.add_argument("--content", action="store_true", help="Show generated content")

    # Install command
    install_parser = subparsers.add_parser("install", help="Install agent from catalog")
    install_parser.add_argument("name", help="Agent name")
    install_parser.add_argument("--scope", choices=["user", "project"], default="user")
    install_parser.add_argument("--force", "-f", action="store_true", help="Overwrite existing")

    # Categories command
    subparsers.add_parser("categories", help="List categories")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export catalog as JSON")
    export_parser.add_argument("--output", "-o", help="Output file")

    args = parser.parse_args()

    if args.command == "list":
        tags = args.tags.split(",") if args.tags else None
        agents = list_agents(category=args.category, tags=tags)

        if args.json:
            print(json.dumps([template_to_dict(a) for a in agents], indent=2))
        else:
            if args.category:
                print(f"\nAgents in '{args.category}' category ({len(agents)}):")
            else:
                print(f"\nAll available agents ({len(agents)}):")
            print("-" * 60)

            current_cat = ""
            for agent in agents:
                if agent.category != current_cat:
                    current_cat = agent.category
                    print(f"\n  [{current_cat.upper()}]")

                print(f"    {agent.name}")
                print(f"      {agent.description[:60]}...")
                print(f"      Tags: {', '.join(agent.tags)}")
            print()

    elif args.command == "search":
        agents = search_agents(args.query)

        if args.json:
            print(json.dumps([template_to_dict(a) for a in agents], indent=2))
        else:
            print(f"\nSearch results for '{args.query}' ({len(agents)} found):")
            print("-" * 60)
            for agent in agents:
                print(f"  {agent.name} [{agent.category}]")
                print(f"    {agent.description}")
            print()

    elif args.command == "show":
        agent = get_agent(args.name)
        if agent is None:
            print(f"Error: Agent '{args.name}' not found", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(template_to_dict(agent), indent=2))
        elif args.content:
            print(generate_agent_content(agent))
        else:
            print(f"\n{agent.name}")
            print("=" * len(agent.name))
            print(f"\n{agent.description}\n")
            print(f"Category:  {agent.category}")
            print(f"Version:   {agent.version}")
            print(f"Pattern:   {agent.pattern}")
            print(f"Tools:     {', '.join(agent.tools)}")
            print(f"Tags:      {', '.join(agent.tags)}")
            print(f"\nExamples:")
            for ex in agent.examples:
                print(f"  - {ex}")
            print()

    elif args.command == "install":
        success, message, _ = install_from_catalog(
            args.name, scope=args.scope, force=args.force
        )
        if success:
            print(message)
        else:
            print(f"Error: {message}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "categories":
        print("\nAvailable categories:")
        print("-" * 60)
        for cat, desc in CATEGORIES.items():
            count = len([a for a in AGENT_CATALOG.values() if a.category == cat])
            print(f"  {cat} ({count} agents)")
            print(f"    {desc}")
        print()

    elif args.command == "export":
        catalog = catalog_to_dict()
        if args.output:
            Path(args.output).write_text(json.dumps(catalog, indent=2), encoding="utf-8")
            print(f"Exported catalog to {args.output}")
        else:
            print(json.dumps(catalog, indent=2))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
