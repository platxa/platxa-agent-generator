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
from . import agent_generator
from . import claudemd_generator
from . import command_generator
from . import mcp_config_generator
from . import completeness_checker
from . import quality_scorer
from . import syntax_validator
from . import security_scanner
from . import test_harness
from . import dry_run
from . import nlp_parser
from . import type_classifier
from . import tool_selector
from . import prompt_generator
from . import workflow_state
from . import install_agent
from . import interactive_prompts
from . import multiagent_generator
from . import hooks_generator
from . import agent_catalog
from . import state_persistence
from . import progress_tracker
from . import extended_thinking
from . import cli
from . import agent_composer
from . import agent_versioning
from . import agent_export

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
]
