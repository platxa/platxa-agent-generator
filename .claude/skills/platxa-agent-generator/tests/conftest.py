"""Pytest configuration and shared fixtures for Platxa Agent Generator tests.

Provides reusable agent content fixtures with comprehensive frontmatter fields
(permissionMode, model, maxTurns, hooks, mcpServers, isolation, effort, etc.)
for thorough test coverage across all generator modules.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Add scripts directory to path for imports
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


# ---------------------------------------------------------------------------
# Full frontmatter agent fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def full_frontmatter_agent() -> str:
    """Agent content with ALL supported frontmatter fields populated.

    Includes: name, description, tools, permissionMode, model, maxTurns,
    isolation, effort, background, color, disallowedTools, mcpServers.
    """
    return (
        "---\n"
        "name: full-featured-agent\n"
        "description: Agent with every frontmatter field for testing\n"
        "tools: Read, Write, Edit, Grep, Glob, Bash, Task\n"
        "permissionMode: bypassPermissions\n"
        "model: sonnet\n"
        "maxTurns: 25\n"
        "isolation: worktree\n"
        "effort: high\n"
        "background: true\n"
        "color: '#4a90d9'\n"
        "disallowedTools: WebSearch, WebFetch\n"
        "mcpServers:\n"
        "  filesystem:\n"
        "    command: npx\n"
        "    args:\n"
        "      - -y\n"
        "      - '@modelcontextprotocol/server-filesystem'\n"
        "---\n\n"
        "# Full Featured Agent\n\n"
        "## Overview\n\n"
        "Agent with every supported frontmatter field populated for testing.\n\n"
        "## Workflow\n\n"
        "1. Read project context\n"
        "2. Analyze code patterns\n"
        "3. Generate recommendations\n"
        "4. Validate output\n\n"
        "## Examples\n\n"
        "### Example 1: Basic Usage\n\n"
        "**User Request:** Analyze the codebase for security issues\n\n"
        "**Agent Actions:**\n"
        "1. Scan all source files with Grep\n"
        "2. Check for common vulnerability patterns\n"
        "3. Report findings with severity\n\n"
        "**Expected Output:** Security report with categorized findings\n\n"
        "### Example 2: Advanced Usage\n\n"
        "**User Request:** Deep analysis of authentication module\n\n"
        "**Agent Actions:**\n"
        "1. Read auth module files\n"
        "2. Trace data flow for credentials\n"
        "3. Identify OWASP violations\n\n"
        "**Expected Output:** Detailed auth security audit\n\n"
        "### Example 3: Error Scenario\n\n"
        "**User Request:** Scan binary files for secrets\n\n"
        "**Agent Actions:**\n"
        "1. Attempt to read binary files\n"
        "2. Handle encoding errors gracefully\n"
        "3. Report which files could not be scanned\n\n"
        "**Expected Output:** Partial results with error list\n\n"
        "## Error Handling\n\n"
        "- File read failures: skip and report\n"
        "- Timeout: return partial results\n"
        "- Permission denied: log and continue\n\n"
        "## Verification\n\n"
        "### Success Criteria\n"
        "- All source files scanned\n"
        "- No false negatives on known patterns\n\n"
        "### Verification Commands\n"
        "```bash\npython -m pytest tests/ -v\n```\n\n"
        "### Expected Output Structure\n"
        '```json\n{"findings": [], "score": 0}\n```\n\n'
        "## Output Format\n\n"
        "```json\n"
        '{"status": "success", "findings": [], "score": 10.0}\n'
        "```\n"
    )


@pytest.fixture()
def minimal_agent() -> str:
    """Agent content with only required frontmatter fields (name, description, tools)."""
    return (
        "---\n"
        "name: minimal-agent\n"
        "description: Minimal agent with required fields only\n"
        "tools: Read\n"
        "---\n\n"
        "# Minimal Agent\n\n"
        "## Overview\nMinimal agent for testing.\n\n"
        "## Workflow\n1. Read files\n\n"
        "## Examples\n### Example 1\n```\nbasic usage\n```\n"
    )


@pytest.fixture()
def agent_with_hooks_config() -> str:
    """Agent content with recommended hooks configuration in metadata."""
    return (
        "---\n"
        "name: hook-aware-agent\n"
        "description: Agent with companion hooks for pre/post tool auditing\n"
        "tools: Read, Write, Bash\n"
        "permissionMode: acceptEdits\n"
        "model: opus\n"
        "maxTurns: 15\n"
        "---\n\n"
        "# Hook-Aware Agent\n\n"
        "## Overview\n\n"
        "Agent designed to work with Claude Code hooks for audit logging.\n\n"
        "## Workflow\n1. Read context\n2. Write output\n3. Validate\n\n"
        "## Examples\n### Example 1\nBasic write operation with audit.\n\n"
        "## Error Handling\n- Hook failures logged but non-blocking\n\n"
        "## Verification\n### Success Criteria\n- Hooks fire on Write/Bash\n\n"
        '## Output Format\n```json\n{"status": "ok"}\n```\n'
    )


@pytest.fixture()
def agent_with_mcp_servers() -> str:
    """Agent content with mcpServers frontmatter block."""
    return (
        "---\n"
        "name: mcp-agent\n"
        "description: Agent using MCP servers for enhanced capabilities\n"
        "tools: Read, Grep, Glob\n"
        "model: haiku\n"
        "maxTurns: 10\n"
        "mcpServers:\n"
        "  sequential-thinking:\n"
        "    command: npx\n"
        "    args:\n"
        "      - -y\n"
        "      - '@modelcontextprotocol/server-sequential-thinking'\n"
        "  filesystem:\n"
        "    command: npx\n"
        "    args:\n"
        "      - -y\n"
        "      - '@modelcontextprotocol/server-filesystem'\n"
        "      - /tmp\n"
        "---\n\n"
        "# MCP Agent\n\n"
        "## Overview\nAgent leveraging MCP servers.\n\n"
        "## Workflow\n1. Use sequential thinking for planning\n"
        "2. Access filesystem via MCP\n\n"
        "## Examples\n### Example 1\nStructured analysis.\n\n"
        "## Error Handling\n- MCP connection failures: fallback to direct tools\n\n"
        "## Verification\n### Success Criteria\n- MCP servers reachable\n\n"
        '## Output Format\n```json\n{"result": "ok"}\n```\n'
    )


# ---------------------------------------------------------------------------
# Edge case / invalid frontmatter fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def agent_missing_name() -> str:
    """Agent content missing the required 'name' field."""
    return (
        "---\n"
        "description: Agent without a name field\n"
        "tools: Read\n"
        "---\n\n"
        "# Unnamed Agent\n\n## Overview\nNo name.\n"
    )


@pytest.fixture()
def agent_missing_description() -> str:
    """Agent content missing the required 'description' field."""
    return (
        "---\n"
        "name: no-description-agent\n"
        "tools: Read\n"
        "---\n\n"
        "# No Description Agent\n\n## Overview\nMissing description.\n"
    )


@pytest.fixture()
def agent_missing_tools() -> str:
    """Agent content missing the required 'tools' field."""
    return (
        "---\n"
        "name: no-tools-agent\n"
        "description: Agent without tools field\n"
        "---\n\n"
        "# No Tools Agent\n\n## Overview\nMissing tools.\n"
    )


@pytest.fixture()
def agent_invalid_model() -> str:
    """Agent content with an invalid model value."""
    return (
        "---\n"
        "name: bad-model-agent\n"
        "description: Agent with invalid model\n"
        "tools: Read\n"
        "model: gpt-4\n"
        "---\n\n"
        "# Bad Model Agent\n\n## Overview\nInvalid model.\n"
    )


@pytest.fixture()
def agent_invalid_permission_mode() -> str:
    """Agent content with an invalid permissionMode value."""
    return (
        "---\n"
        "name: bad-perms-agent\n"
        "description: Agent with invalid permission mode\n"
        "tools: Read\n"
        "permissionMode: godMode\n"
        "---\n\n"
        "# Bad Perms Agent\n\n## Overview\nInvalid permission mode.\n"
    )


@pytest.fixture()
def agent_negative_max_turns() -> str:
    """Agent content with a negative maxTurns value."""
    return (
        "---\n"
        "name: negative-turns-agent\n"
        "description: Agent with negative maxTurns\n"
        "tools: Read\n"
        "maxTurns: -5\n"
        "---\n\n"
        "# Negative Turns Agent\n\n## Overview\nInvalid maxTurns.\n"
    )


@pytest.fixture()
def agent_empty_frontmatter() -> str:
    """Agent content with empty frontmatter block."""
    return "---\n---\n\n# Empty Frontmatter\n\n## Overview\nNothing defined.\n"


@pytest.fixture()
def agent_no_frontmatter() -> str:
    """Agent content with no frontmatter at all."""
    return "# No Frontmatter\n\n## Overview\nNo YAML block.\n"


# ---------------------------------------------------------------------------
# Agent file fixtures (write to tmp_path)
# ---------------------------------------------------------------------------


@pytest.fixture()
def full_agent_file(tmp_path: Path, full_frontmatter_agent: str) -> Path:
    """Write full frontmatter agent to a temp .md file."""
    path = tmp_path / "full-featured-agent.md"
    path.write_text(full_frontmatter_agent, encoding="utf-8")
    return path


@pytest.fixture()
def minimal_agent_file(tmp_path: Path, minimal_agent: str) -> Path:
    """Write minimal agent to a temp .md file."""
    path = tmp_path / "minimal-agent.md"
    path.write_text(minimal_agent, encoding="utf-8")
    return path


@pytest.fixture()
def agents_dir(tmp_path: Path, full_frontmatter_agent: str, minimal_agent: str) -> Path:
    """Create a temp directory with multiple agent files for discovery tests."""
    agents = tmp_path / "agents"
    agents.mkdir()
    (agents / "full-featured-agent.md").write_text(full_frontmatter_agent, encoding="utf-8")
    (agents / "minimal-agent.md").write_text(minimal_agent, encoding="utf-8")
    return agents
