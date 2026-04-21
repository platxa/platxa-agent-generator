# Platxa Agent Generator

Transform natural language descriptions into production-ready AI agents for Claude Code CLI.

## Overview

Platxa Agent Generator is a comprehensive system that automatically creates AI agents from simple descriptions. Unlike external frameworks, it generates agents that leverage Claude Code's native capabilities: Task tool, subagents, skills, hooks, and MCP integration.

## Features

- **Natural Language Input**: Describe what you want, get a working agent
- **5 Agent Patterns**: Prompt-chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer
- **Production-Grade Output**: Validated agents with quality scores ≥7.0
- **Complete Tooling**: CLI, dry-run mode, versioning, export/import

## Quick Start

```bash
# Generate an agent from description
claude "Create an agent that reviews Python code for security vulnerabilities"

# Use the skill directly
/platxa-agent-generator "Build a documentation generator for TypeScript projects"
```

## Installation

This project is distributed as a [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins). The recommended install path is `/plugin add` from within Claude Code.

### Install with `/plugin add` (recommended)

```
/plugin add https://github.com/platxa/platxa-agent-generator
```

To install from a local checkout (useful for development):

```
/plugin add /path/to/platxa-agent-generator
```

The `github:owner/repo` shorthand may work on newer Claude Code versions, but the full URL form above is the portable one.

Claude Code reads `.claude-plugin/plugin.json` from the target, registers the skill under `skills/platxa-agent-generator/`, wires up the subagents in `agents/`, and makes the `/platxa-agent-generator` slash command available in the current session.

### Install for local development

```bash
git clone https://github.com/platxa/platxa-agent-generator.git
cd platxa-agent-generator
pip install -e ".[dev]"
```

The editable install exposes the `platxa-agent` CLI and keeps the Python source under `src/platxa_agent_generator/` live-reloadable.

## Architecture

```
User Description → NLP Parser → Type Classifier → Pattern Selector
                                      ↓
                              Architecture Blueprint
                                      ↓
                              Generation Phase
                                      ↓
                    Agent File + Commands + Hooks + Scripts
                                      ↓
                              Validation (Score ≥ 7.0)
                                      ↓
                              Installation
```

## Agent Patterns

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Prompt Chaining | Sequential fixed steps | Simple |
| Routing | Input classification | Medium |
| Parallelization | Concurrent independent tasks | Medium |
| Orchestrator-Workers | Dynamic task decomposition | Complex |
| Evaluator-Optimizer | Iterative refinement | Complex |

## Documentation

- [Getting Started](skills/platxa-agent-generator/docs/getting-started.md)
- [Patterns Overview](skills/platxa-agent-generator/docs/patterns-overview.md)
- [CLI Reference](skills/platxa-agent-generator/docs/cli-reference.md)
- [API Reference](skills/platxa-agent-generator/docs/api-reference.md)

## Project Structure

The repository follows the Claude Code plugin layout. All directories listed below are part of the plugin surface.

```
platxa-agent-generator/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name, version, author)
├── agents/                      # Subagent definitions (.md)
├── skills/
│   └── platxa-agent-generator/
│       ├── SKILL.md             # Skill entry point
│       ├── docs/                # User-facing documentation
│       ├── references/          # Pattern reference material
│       └── templates/           # Agent file templates
├── src/
│   └── platxa_agent_generator/  # Python source (40+ modules)
├── tests/                       # Test suite (shard-per-module)
├── .github/
│   └── workflows/               # CI pipelines
├── pyproject.toml               # Packaging and tool config
└── requirements.txt             # Mirrored dependency constraints
```

### What `/plugin add` picks up

`/plugin add` registers the contents of `.claude-plugin/`, `agents/`, and `skills/` as the active plugin surface. The `src/` tree is only loaded when the Python CLI is invoked directly (`pip install -e .`).

### Excluded from the plugin surface: `packages/*`

The repository also contains a top-level `packages/` directory used for workspace-local development of adjacent products (Monaco editor integration, brand-kit assets, a sibling frontend agent). **These packages are intentionally excluded from the plugin surface**:

- `plugin.json` does not enumerate any path under `packages/`.
- `/plugin add` does not load skills, agents, or commands from `packages/`.
- CI workflows (`.github/workflows/`) do not lint or test `packages/` as part of this plugin's gates.
- Editing any file under `packages/*` requires explicit sign-off (see `.claude/spec.md` "Ask first").

Anyone forking this repository as a plugin template should either delete `packages/` entirely or keep it gitignored; it is repo-private scaffolding, not shipped code.

## Development

```bash
# Install dev dependencies (mirrors pyproject.toml ceilings)
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Type checking
pyright src/platxa_agent_generator/

# Linting and formatting
ruff check src/
ruff format src/
```

Version ceilings on all dev dependencies and the `pyyaml` runtime dep are pinned in both `pyproject.toml` and `requirements.txt` — bumps across a major-version boundary require explicit sign-off.

## License

Proprietary - Copyright (c) 2026 Platxa. All Rights Reserved.

See [LICENSE](LICENSE) for details.
