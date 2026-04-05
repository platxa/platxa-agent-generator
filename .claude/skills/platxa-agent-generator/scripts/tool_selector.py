#!/usr/bin/env python3
"""
Tool Selector for Platxa Agent Generator

Selects appropriate Claude Code tools based on agent type, purpose, and requirements.

Usage:
    python tool_selector.py --type analyzer --purpose "scan code for vulnerabilities"
    python tool_selector.py --json '{"type": "builder", "purpose": "generate docs", "capabilities": ["create files"]}'
"""

import json
from dataclasses import dataclass, field


@dataclass
class ToolSelection:
    """Result of tool selection."""

    tools: list[str]
    reasoning: dict[str, str]  # tool -> reason for inclusion
    warnings: list[str]


# Claude Code available tools
AVAILABLE_TOOLS = {
    # File operations
    "Read": "Read file contents",
    "Write": "Create new files",
    "Edit": "Modify existing files",
    "Glob": "Find files by pattern",
    "Grep": "Search file contents",
    # Shell operations
    "Bash": "Execute shell commands",
    # Web operations
    "WebSearch": "Search the web",
    "WebFetch": "Fetch web page content",
    # Agent operations
    "Task": "Spawn subagent workers",
    "AskUserQuestion": "Ask user for input",
    "TodoWrite": "Track task progress",
    # Notebook operations
    "NotebookEdit": "Edit Jupyter notebooks",
    # Code intelligence
    "LSP": "Language server operations",
}

# Tool categories for logical grouping
TOOL_CATEGORIES = {
    "file_read": ["Read", "Glob", "Grep"],
    "file_write": ["Write", "Edit"],
    "file_all": ["Read", "Write", "Edit", "Glob", "Grep"],
    "search": ["Glob", "Grep"],
    "web": ["WebSearch", "WebFetch"],
    "shell": ["Bash"],
    "coordination": ["Task", "TodoWrite"],
    "interaction": ["AskUserQuestion"],
    "notebook": ["NotebookEdit"],
    "code_intelligence": ["LSP"],
}

# Base tools by agent type
TYPE_BASE_TOOLS: dict[str, list[str]] = {
    "analyzer": ["Read", "Glob", "Grep"],
    "builder": ["Read", "Write", "Edit", "Glob"],
    "automation": ["Read", "Write", "Bash", "Glob"],
    "guide": ["Read", "Glob", "Grep", "AskUserQuestion"],
    "validator": ["Read", "Glob", "Grep"],
    "orchestrator": ["Read", "Glob", "Grep", "Task"],
}

# Domain-specific tool additions
DOMAIN_TOOLS: dict[str, list[str]] = {
    "security": ["Grep"],  # Pattern matching for vulnerabilities
    "documentation": ["Write", "Edit"],  # Creating docs
    "testing": ["Bash"],  # Running tests
    "code-review": ["Grep", "LSP"],  # Code analysis
    "refactoring": ["Edit", "LSP"],  # Code modification
    "deployment": ["Bash"],  # Shell operations
    "web": ["WebFetch", "WebSearch"],  # Web development
    "web-scraping": ["WebFetch"],  # Web content
    "research": ["WebSearch", "WebFetch"],  # Web research
    "data-analysis": ["NotebookEdit", "Bash"],  # Notebooks and scripts
    "api": ["WebFetch"],  # API integration
    "devops": ["Bash"],  # DevOps operations
    "data": ["NotebookEdit"],  # Data processing
}

# Capability keywords that imply specific tools
CAPABILITY_TOOL_MAP: dict[str, list[str]] = {
    # File operations
    "read": ["Read"],
    "examine": ["Read"],
    "analyze": ["Read", "Grep"],
    "scan": ["Glob", "Grep"],
    "search": ["Grep", "Glob"],
    "find": ["Glob", "Grep"],
    "discover": ["Glob"],
    "locate": ["Glob", "Grep"],
    # Write operations
    "create": ["Write"],
    "generate": ["Write"],
    "produce": ["Write"],
    "write": ["Write"],
    "output": ["Write"],
    # Edit operations
    "modify": ["Edit"],
    "update": ["Edit"],
    "change": ["Edit"],
    "fix": ["Edit"],
    "refactor": ["Edit"],
    "transform": ["Edit"],
    # Shell operations
    "execute": ["Bash"],
    "run": ["Bash"],
    "command": ["Bash"],
    "script": ["Bash"],
    "install": ["Bash"],
    "build": ["Bash"],
    "test": ["Bash"],
    "deploy": ["Bash"],
    # Web operations
    "fetch": ["WebFetch"],
    "download": ["WebFetch"],
    "web": ["WebFetch", "WebSearch"],
    "internet": ["WebSearch"],
    "online": ["WebSearch"],
    "lookup": ["WebSearch"],
    # Coordination
    "coordinate": ["Task"],
    "orchestrate": ["Task"],
    "delegate": ["Task"],
    "spawn": ["Task"],
    "parallel": ["Task"],
    "worker": ["Task"],
    # Interaction
    "ask": ["AskUserQuestion"],
    "prompt": ["AskUserQuestion"],
    "clarify": ["AskUserQuestion"],
    "confirm": ["AskUserQuestion"],
    # Progress tracking
    "track": ["TodoWrite"],
    "progress": ["TodoWrite"],
    "checklist": ["TodoWrite"],
}

# Dangerous tool combinations that should trigger warnings
DANGEROUS_COMBINATIONS = [
    (["Bash", "WebFetch"], "Downloading and executing code can be dangerous"),
    (["Write", "Bash"], "Creating and executing files requires careful validation"),
    (["Edit", "Glob"], "Mass editing files can cause unintended changes"),
]

# Tool dependency rules
TOOL_DEPENDENCIES: dict[str, list[str]] = {
    "Edit": ["Read"],  # Should read before editing
    "Write": ["Read"],  # Should often read context first
}

# Least-privilege: keywords that justify Write (creating new files)
# Without these, prefer Edit for file modifications
WRITE_JUSTIFICATION_KEYWORDS = {
    "create",
    "generate",
    "produce",
    "scaffold",
    "new file",
    "new module",
    "initialize",
    "bootstrap",
    "output file",
    "write file",
}

# Least-privilege: keywords that justify Bash (shell execution)
# Without these, Bash is excluded
BASH_JUSTIFICATION_KEYWORDS = {
    "execute",
    "run",
    "command",
    "script",
    "install",
    "build",
    "test",
    "deploy",
    "compile",
    "shell",
    "terminal",
    "process",
    "pip",
    "npm",
    "git",
}

# Read-only agent types — never get write/edit/bash tools
READ_ONLY_TYPES = {"analyzer", "validator"}

# Minimal base tools — the absolute minimum for any agent
MINIMAL_BASE_TOOLS = ["Read", "Glob", "Grep"]


def enforce_least_privilege(
    selected: dict[str, str],
    agent_type: str,
    purpose: str,
    capabilities: list[str] | None,
) -> tuple[dict[str, str], list[str]]:
    """Apply least-privilege constraints to tool selection.

    Rules:
    1. Read-only agents (analyzer, validator) lose Write/Edit/Bash
    2. Write is removed unless purpose justifies creating new files — Edit is preferred
    3. Bash is removed unless purpose explicitly requires shell execution
    4. Dependencies are preserved (Edit requires Read)

    Returns:
        Tuple of (filtered_tools, enforcement_notes)
    """
    notes: list[str] = []
    all_text = " ".join([purpose] + (capabilities or [])).lower()

    # Rule 1: Read-only agents lose all mutation tools
    if agent_type in READ_ONLY_TYPES:
        mutation_tools = {"Write", "Edit", "Bash", "NotebookEdit"}
        removed = [t for t in selected if t in mutation_tools]
        if removed:
            for t in removed:
                del selected[t]
            notes.append(
                f"Least-privilege: removed {', '.join(removed)} from read-only {agent_type} agent"
            )
        return selected, notes

    # Rule 2: Prefer Edit over Write unless creating new files
    if "Write" in selected:
        write_justified = any(kw in all_text for kw in WRITE_JUSTIFICATION_KEYWORDS)
        if not write_justified:
            # Downgrade Write to Edit
            reason = selected.pop("Write")
            if "Edit" not in selected:
                selected["Edit"] = f"Downgraded from Write (least-privilege): {reason}"
            notes.append(
                "Least-privilege: replaced Write with Edit (no file creation keywords detected)"
            )

    # Rule 3: Remove Bash unless explicitly justified
    if "Bash" in selected:
        bash_justified = any(kw in all_text for kw in BASH_JUSTIFICATION_KEYWORDS)
        if not bash_justified:
            del selected["Bash"]
            notes.append("Least-privilege: removed Bash (no shell execution keywords detected)")

    return selected, notes


def extract_keywords(text: str) -> set[str]:
    """Extract relevant keywords from text."""
    text_lower = text.lower()
    keywords = set()

    for keyword in CAPABILITY_TOOL_MAP:
        if keyword in text_lower:
            keywords.add(keyword)

    return keywords


def select_tools(
    agent_type: str,
    purpose: str = "",
    domain: str = "",
    capabilities: list[str] | None = None,
    explicit_tools: list[str] | None = None,
    least_privilege: bool = True,
) -> ToolSelection:
    """
    Select appropriate tools based on agent requirements.

    When least_privilege=True (default), applies constraints:
    - Read-only agents (analyzer, validator) never get Write/Edit/Bash
    - Write is replaced with Edit unless purpose requires creating new files
    - Bash is removed unless purpose explicitly requires shell execution

    Args:
        agent_type: Type of agent (analyzer, builder, etc.)
        purpose: Natural language description of purpose
        domain: Domain area (security, documentation, etc.)
        capabilities: List of capability descriptions
        explicit_tools: Tools explicitly requested by user
        least_privilege: Apply least-privilege enforcement (default: True)

    Returns:
        ToolSelection with tools, reasoning, and warnings
    """
    selected: dict[str, str] = {}  # tool -> reason
    warnings: list[str] = []

    # 1. Start with type-based tools
    base_tools = TYPE_BASE_TOOLS.get(agent_type, ["Read", "Glob", "Grep"])
    for tool in base_tools:
        selected[tool] = f"Base tool for {agent_type} agents"

    # 2. Add domain-specific tools
    if domain:
        domain_tools = DOMAIN_TOOLS.get(domain, [])
        for tool in domain_tools:
            if tool not in selected:
                selected[tool] = f"Required for {domain} domain"

    # 3. Analyze purpose for additional tools
    if purpose:
        purpose_keywords = extract_keywords(purpose)
        for keyword in purpose_keywords:
            implied_tools = CAPABILITY_TOOL_MAP.get(keyword, [])
            for tool in implied_tools:
                if tool not in selected:
                    selected[tool] = f"Implied by '{keyword}' in purpose"

    # 4. Analyze capabilities for additional tools
    if capabilities:
        for capability in capabilities:
            cap_keywords = extract_keywords(capability)
            for keyword in cap_keywords:
                implied_tools = CAPABILITY_TOOL_MAP.get(keyword, [])
                for tool in implied_tools:
                    if tool not in selected:
                        selected[tool] = f"Implied by capability: {capability}"

    # 5. Add explicitly requested tools
    if explicit_tools:
        for tool in explicit_tools:
            if tool in AVAILABLE_TOOLS:
                if tool not in selected:
                    selected[tool] = "Explicitly requested"
            else:
                warnings.append(f"Unknown tool requested: {tool}")

    # 6. Add tool dependencies
    tools_to_add: dict[str, str] = {}
    for tool in selected:
        deps = TOOL_DEPENDENCIES.get(tool, [])
        for dep in deps:
            if dep not in selected and dep not in tools_to_add:
                tools_to_add[dep] = f"Dependency of {tool}"

    selected.update(tools_to_add)

    # 7. Apply least-privilege enforcement
    if least_privilege:
        selected, lp_notes = enforce_least_privilege(selected, agent_type, purpose, capabilities)
        for note in lp_notes:
            warnings.append(note)

    # 8. Check for dangerous combinations
    tool_set = set(selected.keys())
    for combo, warning_msg in DANGEROUS_COMBINATIONS:
        if all(t in tool_set for t in combo):
            warnings.append(f"Warning: {warning_msg} (tools: {', '.join(combo)})")

    # 8. Validate all tools exist
    final_tools = []
    for tool in selected:
        if tool in AVAILABLE_TOOLS:
            final_tools.append(tool)
        else:
            warnings.append(f"Invalid tool removed: {tool}")

    # Sort tools in a logical order
    tool_order = [
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "Bash",
        "WebSearch",
        "WebFetch",
        "Task",
        "AskUserQuestion",
        "TodoWrite",
        "NotebookEdit",
        "LSP",
    ]

    sorted_tools = sorted(
        final_tools, key=lambda t: tool_order.index(t) if t in tool_order else 999
    )

    return ToolSelection(
        tools=sorted_tools,
        reasoning={t: selected[t] for t in sorted_tools},
        warnings=warnings,
    )


def format_tools_string(tools: list[str]) -> str:
    """Format tool list as comma-separated string for frontmatter."""
    return ", ".join(tools)


def get_tool_guidance(tools: list[str]) -> list[str]:
    """Get usage guidance for selected tools."""
    guidance = []

    tool_guidance_map = {
        "Read": "Use Read to examine file contents before processing or modifying.",
        "Write": "Use Write to create new files with generated content.",
        "Edit": "Use Edit for precise, targeted modifications to existing files.",
        "Glob": "Use Glob to discover files matching specific patterns.",
        "Grep": "Use Grep to search for patterns across the codebase.",
        "Bash": "Use Bash sparingly for operations requiring shell execution.",
        "WebSearch": "Use WebSearch to find up-to-date information and best practices.",
        "WebFetch": "Use WebFetch to retrieve specific web page content.",
        "Task": "Use Task to spawn worker subagents for parallel processing.",
        "AskUserQuestion": "Use AskUserQuestion to clarify requirements when needed.",
        "TodoWrite": "Use TodoWrite to track progress on multi-step tasks.",
        "NotebookEdit": "Use NotebookEdit to modify Jupyter notebook cells.",
        "LSP": "Use LSP for code intelligence (definitions, references, hover).",
    }

    for tool in tools:
        if tool in tool_guidance_map:
            guidance.append(tool_guidance_map[tool])

    return guidance


@dataclass
class SelectionRequest:
    """Request for tool selection."""

    agent_type: str
    purpose: str = ""
    domain: str = ""
    capabilities: list[str] = field(default_factory=list)
    explicit_tools: list[str] = field(default_factory=list)


def select_from_request(request: SelectionRequest) -> ToolSelection:
    """Select tools from a structured request."""
    return select_tools(
        agent_type=request.agent_type,
        purpose=request.purpose,
        domain=request.domain,
        capabilities=request.capabilities,
        explicit_tools=request.explicit_tools,
    )


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Select tools for an agent")
    parser.add_argument(
        "--type",
        required=True,
        choices=[
            "analyzer",
            "builder",
            "automation",
            "guide",
            "validator",
            "orchestrator",
        ],
        help="Agent type",
    )
    parser.add_argument("--purpose", default="", help="Agent purpose description")
    parser.add_argument("--domain", default="", help="Domain (security, documentation, etc.)")
    parser.add_argument("--capabilities", help="Comma-separated capabilities")
    parser.add_argument("--tools", help="Comma-separated explicit tools")
    parser.add_argument("--json", help="JSON input with all parameters")
    parser.add_argument("--json-output", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Parse input
    if args.json:
        data = json.loads(args.json)
        agent_type = data.get("type", args.type)
        purpose = data.get("purpose", "")
        domain = data.get("domain", "")
        capabilities = data.get("capabilities", [])
        explicit_tools = data.get("tools", [])
    else:
        agent_type = args.type
        purpose = args.purpose
        domain = args.domain
        capabilities = args.capabilities.split(",") if args.capabilities else []
        explicit_tools = args.tools.split(",") if args.tools else []

    # Select tools
    result = select_tools(
        agent_type=agent_type,
        purpose=purpose,
        domain=domain,
        capabilities=capabilities,
        explicit_tools=explicit_tools,
    )

    # Output
    if args.json_output:
        output = {
            "tools": result.tools,
            "tools_string": format_tools_string(result.tools),
            "reasoning": result.reasoning,
            "warnings": result.warnings,
            "guidance": get_tool_guidance(result.tools),
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"Tools: {format_tools_string(result.tools)}")
        print()
        print("Reasoning:")
        for tool, reason in result.reasoning.items():
            print(f"  - {tool}: {reason}")
        if result.warnings:
            print()
            print("Warnings:")
            for warning in result.warnings:
                print(f"  ! {warning}")


if __name__ == "__main__":
    main()
