#!/usr/bin/env python3
"""
MCP Server Configuration Generator

Generates valid .mcp.json configurations for agents that need
Model Context Protocol (MCP) server integrations.

Supported server types:
- stdio: Local process-based servers (command + args)
- http: Remote HTTP API servers
- sse: Server-Sent Events servers

Usage:
    python mcp_config_generator.py --servers "playwright,github" --output .mcp.json
    python mcp_config_generator.py --json '{"servers": [{"name": "db", "type": "stdio", "command": "node", "args": ["db-server.js"]}]}'
    python mcp_config_generator.py --template database --output .mcp.json
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class MCPServer:
    """Configuration for a single MCP server."""

    name: str
    server_type: str = "stdio"  # stdio, http, sse
    command: str = ""  # For stdio type
    args: list[str] = field(default_factory=list)  # For stdio type
    url: str = ""  # For http/sse types
    headers: dict[str, str] = field(default_factory=dict)  # For http type
    env: dict[str, str] = field(default_factory=dict)  # Environment variables


@dataclass
class MCPConfig:
    """Complete MCP configuration."""

    servers: list[MCPServer] = field(default_factory=list)
    use_wrapper: bool = False  # Whether to use mcpServers wrapper


# Pre-defined server templates for common integrations
SERVER_TEMPLATES: dict[str, MCPServer] = {
    # Browser automation
    "playwright": MCPServer(
        name="playwright",
        server_type="stdio",
        command="npx",
        args=["@playwright/mcp@latest"],
    ),
    # Version control
    "github": MCPServer(
        name="github",
        server_type="http",
        url="https://api.githubcopilot.com/mcp/",
        headers={"Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"},
    ),
    "gitlab": MCPServer(
        name="gitlab",
        server_type="http",
        url="https://gitlab.com/api/v4/mcp",
    ),
    # Database servers
    "postgres": MCPServer(
        name="postgres",
        server_type="stdio",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-postgres"],
        env={"DATABASE_URL": "${DATABASE_URL}"},
    ),
    "sqlite": MCPServer(
        name="sqlite",
        server_type="stdio",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-sqlite", "${SQLITE_DB_PATH}"],
    ),
    # File system
    "filesystem": MCPServer(
        name="filesystem",
        server_type="stdio",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", "${ALLOWED_PATHS}"],
    ),
    # Web/Search
    "brave-search": MCPServer(
        name="brave-search",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-brave-search"],
        env={"BRAVE_API_KEY": "${BRAVE_API_KEY}"},
    ),
    "fetch": MCPServer(
        name="fetch",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-fetch"],
    ),
    # Memory/Knowledge
    "memory": MCPServer(
        name="memory",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-memory"],
    ),
    # Project management
    "asana": MCPServer(
        name="asana",
        server_type="sse",
        url="https://mcp.asana.com/sse",
    ),
    # Code analysis
    "repomix": MCPServer(
        name="repomix",
        server_type="stdio",
        command="npx",
        args=["-y", "repomix", "--mcp"],
    ),
    # AI/LLM
    "openai": MCPServer(
        name="openai",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-openai"],
        env={"OPENAI_API_KEY": "${OPENAI_API_KEY}"},
    ),
    # Slack
    "slack": MCPServer(
        name="slack",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-slack"],
        env={"SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"},
    ),
    # Google
    "google-drive": MCPServer(
        name="google-drive",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-google-drive"],
    ),
    # Time
    "time": MCPServer(
        name="time",
        server_type="stdio",
        command="npx",
        args=["-y", "@anthropic/mcp-server-time"],
    ),
}

# Category mappings for template groups
SERVER_CATEGORIES: dict[str, list[str]] = {
    "database": ["postgres", "sqlite"],
    "web": ["fetch", "brave-search"],
    "devtools": ["playwright", "github", "gitlab", "repomix"],
    "productivity": ["slack", "asana", "google-drive"],
    "ai": ["openai", "memory"],
    "core": ["filesystem", "time", "memory"],
}


# Domain keyword → MCP server recommendations.
# Each entry maps keywords found in agent description/name to relevant MCP servers.
DOMAIN_MCP_RECOMMENDATIONS: dict[str, dict[str, list[str]]] = {
    "database": {
        "keywords": [
            "database",
            "sql",
            "query",
            "postgres",
            "sqlite",
            "schema",
            "migration",
            "table",
            "record",
            "orm",
            "alembic",
        ],
        "servers": ["postgres", "sqlite"],
    },
    "git": {
        "keywords": [
            "git",
            "github",
            "gitlab",
            "commit",
            "branch",
            "pull request",
            "pr",
            "repository",
            "repo",
            "merge",
            "diff",
        ],
        "servers": ["github"],
    },
    "web": {
        "keywords": [
            "web",
            "browser",
            "scrape",
            "crawl",
            "screenshot",
            "selenium",
            "playwright",
            "e2e",
            "end-to-end",
        ],
        "servers": ["playwright", "fetch"],
    },
    "search": {
        "keywords": [
            "search",
            "lookup",
            "find online",
            "web search",
            "research",
        ],
        "servers": ["brave-search", "fetch"],
    },
    "filesystem": {
        "keywords": [
            "file",
            "directory",
            "folder",
            "path",
            "read file",
            "write file",
            "filesystem",
        ],
        "servers": ["filesystem"],
    },
    "reasoning": {
        "keywords": [
            "complex",
            "architect",
            "design",
            "plan",
            "analyze",
            "debug",
            "multi-step",
            "reasoning",
            "thinking",
        ],
        "servers": ["sequential-thinking"],
    },
    "communication": {
        "keywords": [
            "slack",
            "message",
            "notify",
            "chat",
            "channel",
        ],
        "servers": ["slack"],
    },
    "codebase": {
        "keywords": [
            "codebase",
            "code review",
            "code analysis",
            "repository analysis",
            "pack",
            "repomix",
        ],
        "servers": ["repomix"],
    },
    "memory": {
        "keywords": [
            "remember",
            "memory",
            "context",
            "persist",
            "knowledge",
        ],
        "servers": ["memory"],
    },
}


def recommend_mcp_servers(
    description: str,
    name: str = "",
    tools: list[str] | None = None,
) -> list[str]:
    """Recommend MCP servers based on agent description and name.

    Scans the agent description and name for domain keywords and returns
    a deduplicated, ordered list of recommended MCP server names.

    Args:
        description: Agent description text
        name: Agent name (optional, adds to keyword matching)
        tools: Agent tools list (optional, for context)

    Returns:
        List of recommended MCP server names, most relevant first.
    """
    combined = f"{name} {description}".lower()
    recommended: dict[str, int] = {}  # server -> match count for ranking

    for _domain, config in DOMAIN_MCP_RECOMMENDATIONS.items():
        for keyword in config["keywords"]:
            if keyword in combined:
                for server in config["servers"]:
                    recommended[server] = recommended.get(server, 0) + 1
                break  # One keyword match per domain is enough

    # Sort by match count (most relevant first), then alphabetically
    sorted_servers = sorted(recommended.keys(), key=lambda s: (-recommended[s], s))
    return sorted_servers


# Known MCP server tool names following mcp__<server>__<tool> convention.
# Used to generate allowedTools entries and tool documentation.
# Key: server name, Value: list of tool names (without prefix).
MCP_SERVER_TOOLS: dict[str, list[str]] = {
    "filesystem": [
        "read_file",
        "read_multiple_files",
        "write_file",
        "edit_file",
        "create_directory",
        "list_directory",
        "directory_tree",
        "move_file",
        "search_files",
        "get_file_info",
    ],
    "postgres": ["query", "list_tables", "describe_table"],
    "sqlite": ["query", "list_tables", "describe_table"],
    "playwright": [
        "browser_navigate",
        "browser_click",
        "browser_fill_form",
        "browser_snapshot",
        "browser_take_screenshot",
    ],
    "github": ["get_repo", "list_issues", "create_issue", "get_pull_request"],
    "brave-search": ["search"],
    "fetch": ["fetch_url"],
    "memory": ["store", "retrieve", "list_memories"],
    "slack": ["send_message", "list_channels", "read_messages"],
    "repomix": ["pack_codebase", "pack_remote_repository", "read_repomix_output"],
    "sequential-thinking": ["sequentialthinking"],
}


def get_mcp_tool_names(server_name: str) -> list[str]:
    """Get fully qualified MCP tool names for a server.

    Returns tool names in mcp__<server>__<tool> format.

    Args:
        server_name: MCP server name (e.g., 'filesystem', 'postgres')

    Returns:
        List of full tool names (e.g., ['mcp__filesystem__read_file', ...])
    """
    tools = MCP_SERVER_TOOLS.get(server_name, [])
    # Normalize server name: replace hyphens with underscores for tool naming
    safe_name = server_name.replace("-", "_")
    return [f"mcp__{safe_name}__{tool}" for tool in tools]


def get_mcp_wildcard_pattern(server_name: str) -> str:
    """Get wildcard allowedTools pattern for an MCP server.

    Claude Code supports wildcard patterns in allowedTools to allow
    all tools from a specific MCP server without listing each one.

    Args:
        server_name: MCP server name

    Returns:
        Wildcard pattern string (e.g., 'mcp__filesystem__*')
    """
    safe_name = server_name.replace("-", "_")
    return f"mcp__{safe_name}__*"


def get_mcp_tools_for_config(config: "MCPConfig") -> dict[str, list[str]]:
    """Get all MCP tool names organized by server for a config.

    Args:
        config: MCPConfig instance

    Returns:
        Dict mapping server name to list of full tool names
    """
    result: dict[str, list[str]] = {}
    for server in config.servers:
        tools = get_mcp_tool_names(server.name)
        if tools:
            result[server.name] = tools
        else:
            # Unknown server — provide wildcard pattern as guidance
            result[server.name] = [get_mcp_wildcard_pattern(server.name)]
    return result


def validate_server_name(name: str) -> tuple[bool, str]:
    """Validate MCP server name."""
    if not name:
        return False, "Server name cannot be empty"

    if len(name) > 64:
        return False, f"Server name too long ({len(name)} > 64 chars)"

    # Allow lowercase letters, numbers, hyphens
    valid_chars = set("abcdefghijklmnopqrstuvwxyz0123456789-")
    if not all(c in valid_chars for c in name):
        return False, "Server name must contain only lowercase letters, numbers, and hyphens"

    if name.startswith("-") or name.endswith("-"):
        return False, "Server name cannot start or end with hyphen"

    return True, ""


def validate_url(url: str) -> tuple[bool, str]:
    """Validate URL format."""
    if not url:
        return False, "URL cannot be empty"

    # Allow environment variable placeholders
    if url.startswith("${") and url.endswith("}"):
        return True, ""

    if not url.startswith(("http://", "https://")):
        return False, "URL must start with http:// or https://"

    return True, ""


def validate_command(command: str) -> tuple[bool, str]:
    """Validate command for stdio servers."""
    if not command:
        return False, "Command cannot be empty for stdio servers"

    # Common safe commands
    safe_commands = {
        "node",
        "npx",
        "npm",
        "python",
        "python3",
        "uvx",
        "uv",
        "php",
        "ruby",
        "deno",
        "bun",
    }

    # Check if command is in safe list or is an absolute path
    cmd_base = command.split("/")[-1] if "/" in command else command
    if cmd_base not in safe_commands and not command.startswith("/"):
        return False, f"Command '{command}' not in allowed list: {', '.join(sorted(safe_commands))}"

    return True, ""


def validate_server(server: MCPServer) -> tuple[bool, list[str]]:
    """Validate a single MCP server configuration."""
    errors: list[str] = []

    # Validate name
    valid, error = validate_server_name(server.name)
    if not valid:
        errors.append(f"Name: {error}")

    # Validate based on type
    if server.server_type == "stdio":
        valid, error = validate_command(server.command)
        if not valid:
            errors.append(f"Command: {error}")

    elif server.server_type in ("http", "sse"):
        valid, error = validate_url(server.url)
        if not valid:
            errors.append(f"URL: {error}")

    else:
        errors.append(f"Invalid server type: {server.server_type}")

    return len(errors) == 0, errors


def server_to_dict(server: MCPServer) -> dict[str, Any]:
    """Convert MCPServer to dictionary for JSON output."""
    result: dict[str, Any] = {}

    if server.server_type == "stdio":
        result["command"] = server.command
        if server.args:
            result["args"] = server.args
        if server.env:
            result["env"] = server.env

    elif server.server_type == "http":
        result["type"] = "http"
        result["url"] = server.url
        if server.headers:
            result["headers"] = server.headers

    elif server.server_type == "sse":
        result["type"] = "sse"
        result["url"] = server.url

    return result


def generate_config(config: MCPConfig) -> dict[str, Any]:
    """Generate MCP configuration dictionary."""
    servers_dict: dict[str, Any] = {}

    for server in config.servers:
        servers_dict[server.name] = server_to_dict(server)

    if config.use_wrapper:
        return {"mcpServers": servers_dict}

    return servers_dict


def create_server_from_dict(data: dict[str, Any]) -> MCPServer:
    """Create MCPServer from dictionary."""
    server_type = data.get("type", "stdio")

    # Determine type from structure if not explicit
    if "command" in data and server_type == "stdio":
        server_type = "stdio"
    elif "url" in data and "type" not in data:
        server_type = "http"

    return MCPServer(
        name=data.get("name", "unnamed"),
        server_type=server_type,
        command=data.get("command", ""),
        args=data.get("args", []),
        url=data.get("url", ""),
        headers=data.get("headers", {}),
        env=data.get("env", {}),
    )


def create_config_from_dict(data: dict[str, Any]) -> MCPConfig:
    """Create MCPConfig from dictionary."""
    servers: list[MCPServer] = []

    # Handle servers list format
    if "servers" in data:
        for server_data in data["servers"]:
            servers.append(create_server_from_dict(server_data))

    # Handle direct server definitions
    else:
        for name, server_data in data.items():
            if name == "mcpServers":
                # Nested format
                for nested_name, nested_data in server_data.items():
                    nested_data["name"] = nested_name
                    servers.append(create_server_from_dict(nested_data))
            elif isinstance(server_data, dict):
                server_data["name"] = name
                servers.append(create_server_from_dict(server_data))

    return MCPConfig(
        servers=servers,
        use_wrapper=data.get("use_wrapper", False),
    )


def get_servers_by_template(template: str) -> list[MCPServer]:
    """Get servers by template name or category."""
    servers: list[MCPServer] = []

    # Check if it's a category
    if template in SERVER_CATEGORIES:
        for server_name in SERVER_CATEGORIES[template]:
            if server_name in SERVER_TEMPLATES:
                servers.append(SERVER_TEMPLATES[server_name])

    # Check if it's a single server template
    elif template in SERVER_TEMPLATES:
        servers.append(SERVER_TEMPLATES[template])

    return servers


def get_servers_by_names(names: list[str]) -> list[MCPServer]:
    """Get servers by list of names."""
    servers: list[MCPServer] = []

    for name in names:
        name = name.strip().lower()
        if name in SERVER_TEMPLATES:
            servers.append(SERVER_TEMPLATES[name])
        elif name in SERVER_CATEGORIES:
            servers.extend(get_servers_by_template(name))

    return servers


def validate_path_safe(filepath: str) -> tuple[bool, str]:
    """Validate file path to prevent path traversal attacks."""
    import tempfile

    path = Path(filepath)

    try:
        resolved = path.resolve()
        cwd = Path.cwd().resolve()
        home = Path.home().resolve()
        temp = Path(tempfile.gettempdir()).resolve()

        allowed_roots = [str(cwd), str(home), str(temp)]
        if not any(str(resolved).startswith(root) for root in allowed_roots):
            return (
                False,
                "Path must be within current directory, home directory, or temp directory",
            )
    except (OSError, ValueError) as e:
        return False, f"Invalid path: {e}"

    # Check for suspicious patterns
    suspicious_patterns = ["$", "`", ";", "|", "&"]
    filepath_str = str(filepath)
    for pattern in suspicious_patterns:
        if pattern in filepath_str:
            return False, f"Suspicious pattern in path: {pattern}"

    return True, ""


def generate(
    servers: list[MCPServer] | None = None,
    server_names: list[str] | None = None,
    template: str | None = None,
    config_dict: dict[str, Any] | None = None,
    use_wrapper: bool = False,
    output_path: str | None = None,
    validate: bool = True,
) -> tuple[bool, str | dict[str, Any], str]:
    """
    Generate MCP configuration.

    Args:
        servers: List of MCPServer objects
        server_names: List of server names to include from templates
        template: Template category name
        config_dict: Dictionary with configuration
        use_wrapper: Whether to use mcpServers wrapper
        output_path: Output file path
        validate: Whether to validate configuration

    Returns:
        (success, config_or_error, output_path)
    """
    config_servers: list[MCPServer] = []

    # Collect servers from various sources
    if servers:
        config_servers.extend(servers)

    if server_names:
        config_servers.extend(get_servers_by_names(server_names))

    if template:
        config_servers.extend(get_servers_by_template(template))

    if config_dict:
        parsed_config = create_config_from_dict(config_dict)
        config_servers.extend(parsed_config.servers)
        use_wrapper = use_wrapper or parsed_config.use_wrapper

    if not config_servers:
        return False, "No servers specified", ""

    # Validate if requested
    if validate:
        all_errors: list[str] = []
        for server in config_servers:
            valid, errors = validate_server(server)
            if not valid:
                all_errors.append(f"Server '{server.name}': {'; '.join(errors)}")

        if all_errors:
            return False, "\n".join(all_errors), ""

    # Generate configuration
    config = MCPConfig(servers=config_servers, use_wrapper=use_wrapper)
    result = generate_config(config)

    # Write to file if output path specified
    output_file = ""
    if output_path:
        valid, error = validate_path_safe(output_path)
        if not valid:
            return False, f"Invalid output path: {error}", ""

        path = Path(output_path)
        if path.is_dir():
            path = path / ".mcp.json"

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        output_file = str(path)

    return True, result, output_file


def generate_mcp_json(
    server_names: list[str],
    output_dir: str | Path = ".",
) -> tuple[bool, str, str]:
    """Generate a .mcp.json project config file for Claude Code.

    Creates a .mcp.json file with the mcpServers wrapper format that
    Claude Code expects. This is the single source of truth for MCP
    server configuration in a project.

    The file uses ${VAR} syntax for environment variable references
    (e.g., ${DATABASE_URL}) so secrets are never hardcoded.

    Args:
        server_names: List of server names from SERVER_TEMPLATES
        output_dir: Directory to write .mcp.json to (default: current dir)

    Returns:
        (success, message, file_path)
    """
    # Resolve servers from templates
    servers: list[MCPServer] = []
    unknown: list[str] = []

    for name in server_names:
        if name in SERVER_TEMPLATES:
            servers.append(SERVER_TEMPLATES[name])
        else:
            unknown.append(name)

    if unknown:
        return False, f"Unknown MCP servers: {', '.join(unknown)}", ""

    if not servers:
        return False, "No servers specified", ""

    # Build the mcpServers config (Claude Code .mcp.json format)
    mcp_servers: dict[str, Any] = {}
    for server in servers:
        mcp_servers[server.name] = server_to_dict(server)

    config = {"mcpServers": mcp_servers}

    # Write to .mcp.json
    output_path = Path(output_dir) / ".mcp.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    return True, f"Generated {output_path} with {len(servers)} server(s)", str(output_path)


def list_templates() -> dict[str, Any]:
    """List available server templates and categories."""
    return {
        "servers": list(SERVER_TEMPLATES.keys()),
        "categories": {cat: servers for cat, servers in SERVER_CATEGORIES.items()},
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate MCP server configurations")
    parser.add_argument(
        "--servers",
        help="Comma-separated list of server names (e.g., 'playwright,github')",
    )
    parser.add_argument(
        "--template",
        help="Template category (e.g., 'database', 'web', 'devtools')",
    )
    parser.add_argument("--json", help="JSON input with server configurations")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument(
        "--use-wrapper",
        action="store_true",
        help="Use mcpServers wrapper in output",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Skip configuration validation",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available templates and categories",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Output to stdout instead of file",
    )

    args = parser.parse_args()

    # List templates
    if args.list:
        templates = list_templates()
        print("Available Server Templates:")
        print("-" * 40)
        for server in sorted(templates["servers"]):
            print(f"  {server}")
        print("")
        print("Categories:")
        print("-" * 40)
        for cat, servers in templates["categories"].items():
            print(f"  {cat}: {', '.join(servers)}")
        sys.exit(0)

    # Parse inputs
    server_names = None
    config_dict = None

    if args.servers:
        server_names = [s.strip() for s in args.servers.split(",")]

    if args.json:
        config_dict = json.loads(args.json)

    # Determine output
    output_path = None if args.stdout else args.output

    # Generate
    success, result, path = generate(
        server_names=server_names,
        template=args.template,
        config_dict=config_dict,
        use_wrapper=args.use_wrapper,
        output_path=output_path,
        validate=not args.skip_validation,
    )

    if not success:
        print(f"Error: {result}", file=sys.stderr)
        sys.exit(1)

    if args.stdout or not output_path:
        print(json.dumps(result, indent=2))
    else:
        print(f"Generated: {path}")


if __name__ == "__main__":
    main()
