"""
Platxa Agent Generator Scripts Package

This package contains all the generation, validation, and utility modules
for the Platxa Agent Generator system.

Modules:
    agent_generator: Core agent definition file generator
    claudemd_generator: CLAUDE.md context file generator
    command_generator: Slash command file generator
    mcp_config_generator: MCP server configuration generator
    completeness_checker: Agent completeness validation
    quality_scorer: Agent quality scoring
    test_harness: Agent testing framework
    dry_run: Preview mode for generation
    syntax_validator: YAML/Markdown syntax validation
    security_scanner: Security vulnerability detection
    nlp_parser: Natural language description parser
    type_classifier: Agent type classification
    tool_selector: Tool permission selection
    prompt_generator: System prompt generation
    workflow_state: Multi-phase workflow state management
    install_agent: Agent installation utilities
    interactive_prompts: Interactive CLI prompts
    multiagent_generator: Multi-agent system generator
    progress_tracker: Progress tracking and display system
    extended_thinking: Extended thinking integration for complex decisions
    cli: Command-line interface for standalone usage
"""

from __future__ import annotations

__version__ = "0.1.0"
__author__ = "Platxa"

# Import submodules for package access
# Using explicit imports to make modules available as package attributes
from . import (
    agent_analyzer,
    agent_catalog,
    agent_composer,
    agent_export,
    agent_generator,
    agent_versioning,
    claudemd_generator,
    cli,
    command_generator,
    completeness_checker,
    dry_run,
    extended_thinking,
    hooks_generator,
    install_agent,
    interactive_prompts,
    mcp_config_generator,
    multiagent_generator,
    nlp_parser,
    progress_tracker,
    prompt_generator,
    quality_scorer,
    security_scanner,
    state_persistence,
    syntax_validator,
    test_harness,
    tool_selector,
    type_classifier,
    workflow_state,
)

__all__ = [
    # Core generators
    "agent_generator",
    "claudemd_generator",
    "command_generator",
    "mcp_config_generator",
    # Validation
    "completeness_checker",
    "quality_scorer",
    "syntax_validator",
    "security_scanner",
    # Testing
    "test_harness",
    "dry_run",
    # Utilities
    "nlp_parser",
    "type_classifier",
    "tool_selector",
    "prompt_generator",
    "workflow_state",
    "install_agent",
    "interactive_prompts",
    "multiagent_generator",
    "hooks_generator",
    "agent_catalog",
    "state_persistence",
    "progress_tracker",
    "extended_thinking",
    "cli",
    "agent_composer",
    "agent_versioning",
    "agent_export",
    "agent_analyzer",
]
