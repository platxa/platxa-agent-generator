# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platxa Agent Generator is a system that transforms natural language descriptions into production-ready AI agents for Claude Code CLI. Unlike external frameworks (LangGraph, CrewAI, AutoGen), it generates agents that leverage Claude Code's built-in capabilities: Task tool, subagents, skills, hooks, and MCP integration.

The repository is itself a Claude Code plugin — installable via `/plugin add https://github.com/platxa/platxa-agent-generator` — and its layout follows the plugin specification.

**Output Artifacts** (what the generator writes into a target project):
- `.claude/agents/*.md` — Agent definitions
- `.claude/commands/*.md` — Slash commands
- Helper scripts installed alongside generated agents

## Repository Layout (plugin surface)

```
platxa-agent-generator/
├── .claude-plugin/plugin.json   # Plugin manifest — what /plugin add reads
├── agents/                      # Subagent definitions (.md)
├── skills/platxa-agent-generator/
│   ├── SKILL.md                 # Skill entry point
│   ├── docs/                    # User-facing documentation
│   ├── references/              # Pattern reference material
│   └── templates/               # Agent file templates
├── src/platxa_agent_generator/  # Python source — CLI, generators, validators
├── tests/                       # Test suite (one shard per source module)
├── .github/workflows/           # CI (ruff, pyright, pytest, plugin validate)
├── pyproject.toml               # Packaging + tool config with <major version ceilings
└── requirements.txt             # Mirrored constraint file
```

Anything outside these paths (excluding `LICENSE`, top-level `README.md`, `CLAUDE.md`, `docs/`) is either tooling scaffolding or explicitly out of scope — see the `packages/*` note below.

### `packages/*` is NOT part of the plugin

The top-level `packages/` directory hosts workspace-local sibling products (Monaco editor integration, brand-kit assets, a sibling frontend agent). It is **intentionally excluded** from the plugin surface:

- `.claude-plugin/plugin.json` does not enumerate any path under `packages/`.
- `/plugin add` does NOT load skills, agents, commands, or hooks from `packages/`.
- CI gates for this plugin do NOT lint, type-check, or test `packages/`.
- Editing any file under `packages/*` requires explicit sign-off per `.claude/spec.md` "Ask first" rules.

When reading or editing this repo, treat `packages/` as a foreign product. Do not reach into it to resolve imports, reuse helpers, or satisfy test fixtures.

## Installation and Invocation

| Path | Command | When to use |
|------|---------|-------------|
| Plugin install | `/plugin add https://github.com/platxa/platxa-agent-generator` | End users consuming the skill/agents |
| Local plugin install | `/plugin add /path/to/platxa-agent-generator` | Plugin development against a local checkout |
| Editable Python install | `pip install -e ".[dev]"` | Python contributors working on `src/` |

The `/platxa-agent-generator` slash command is the primary user entry point once the plugin is installed.

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

Each subagent operates in its own context window. The definitions live in the top-level `agents/` directory:
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

> **Source of truth**: `src/platxa_agent_generator/templates/evaluation-criteria.yaml`
>
> Axis names, weights, severities, and criteria descriptions are defined
> there. Do not duplicate weights here — load via
> `EvaluationRubric.load_default()` at runtime.

## Key References

- **Primary**: `docs/PLATXA_AGENT_GENERATOR.md` — Full specification
- **Research**: `docs/RESEARCH_SYNTHESIS.md` — Source analysis
- **Active spec**: `.claude/spec.md` — Current sprint goals and criteria
- **Features**: `.claude/generated_features.json` — Decomposed feature list

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
- Dependency ceilings are capped at the next major version above the currently-tested one (see `pyproject.toml`); raising a ceiling beyond a major-version bump is an "Ask first" action per `.claude/spec.md`
