# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platxa Agent Generator is a system that transforms natural language descriptions into production-ready AI agents for Claude Code CLI. Unlike external frameworks (LangGraph, CrewAI, AutoGen), it generates agents that leverage Claude Code's built-in capabilities: Task tool, subagents, skills, hooks, and MCP integration.

**Output Artifacts:**
- `.claude/agents/*.md` - Agent definitions
- `.claude/commands/*.md` - Slash commands
- `scripts/*.sh, *.py` - Helper scripts

## Architecture

### Multi-Phase Workflow

```
NLP Description → Discovery → Architecture → Generation → Validation → Deployment
```

**Phases:**
1. **Discovery**: Parse NLP description, identify agent type, research domain patterns
2. **Architecture**: Select workflow pattern, define tool permissions, plan MCP integrations
3. **Generation**: Create agent.md files, system prompts, helper scripts
4. **Validation**: Syntax validation, security scanning, quality scoring (minimum 7.0/10)
5. **Installation**: Deploy to user (`~/.claude/agents/`) or project (`.claude/agents/`) scope

### Agent Patterns (from Anthropic research)

| Pattern | Use Case |
|---------|----------|
| **Prompt Chaining** | Fixed sequential steps, quality over speed |
| **Routing** | Input classification to specialized handlers |
| **Parallelization** | Independent concurrent subtasks |
| **Orchestrator-Workers** | Dynamic task decomposition (most powerful) |
| **Evaluator-Optimizer** | Iterative refinement with feedback loops |

### Subagent Architecture

Each subagent operates in its own context window:
- **Discovery Subagent**: WebSearch, WebFetch, Glob, Read → Domain knowledge JSON
- **Architecture Subagent**: Read, Grep → Architecture blueprint JSON
- **Generation Subagent**: Write, Read → Agent files
- **Validation Subagent**: Bash, Read, Grep → Validation report with score

## Agent Definition Format

```markdown
---
name: agent-name
description: What the agent does (≤1024 chars)
tools: Read, Write, Grep, Glob, Bash
---

# Agent Name

## Overview
Brief description.

## Workflow
1. Step one
2. Step two

## Examples
### Example 1: Basic Usage
User: "Do something"
Agent: [Response]

## Output Format
Expected structure.
```

## Quality Scoring Criteria

| Criteria | Weight |
|----------|--------|
| Clarity | 20% |
| Completeness | 20% |
| Tool Design | 20% |
| Examples | 15% |
| Security | 15% |
| Documentation | 10% |

## Key References

- **Primary**: docs/PLATXA_AGENT_GENERATOR.md - Full specification
- **Research**: docs/RESEARCH_SYNTHESIS.md - Source analysis
- **Features**: .claude/generated_features.json - 48 planned features

## MCP Server Configuration

This project uses MCP servers for enhanced capabilities. Create `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {
        "DISABLE_THOUGHT_LOGGING": "false"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/this/project",
        "~/.claude/agents",
        "~/.claude/commands"
      ],
      "env": {}
    }
  }
}
```

**Servers:**
- **sequential-thinking**: Structured problem-solving with revision and branching capabilities
- **filesystem**: Safe file operations for agent generation and deployment

## Development Notes

- This project generates Claude Code agents, not a traditional codebase
- Follow Anthropic's "Building Effective Agents" patterns
- Generated agents must pass validation with score ≥7.0
- Prefer simple, composable patterns over complex frameworks
