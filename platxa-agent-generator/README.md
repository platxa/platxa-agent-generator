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

```bash
# Clone and install
git clone https://github.com/platxa/platxa-agent-generator.git
cd platxa-agent-generator
pip install -r requirements.txt
```

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

- [Getting Started](.claude/skills/platxa-agent-generator/docs/getting-started.md)
- [Patterns Overview](.claude/skills/platxa-agent-generator/docs/patterns-overview.md)
- [CLI Reference](.claude/skills/platxa-agent-generator/docs/cli-reference.md)
- [API Reference](.claude/skills/platxa-agent-generator/docs/api-reference.md)

## Project Structure

```
.claude/
├── agents/                    # Subagent definitions
└── skills/
    └── platxa-agent-generator/
        ├── scripts/           # 28 Python modules
        ├── tests/             # Test suite
        ├── docs/              # User documentation
        ├── references/        # Pattern documentation
        └── SKILL.md           # Skill entry point
```

## Development

```bash
# Run tests
pytest .claude/skills/platxa-agent-generator/tests/ -v

# Type checking
pyright .claude/skills/platxa-agent-generator/scripts/

# Linting
ruff check .claude/skills/platxa-agent-generator/scripts/
```

## License

Proprietary - Copyright (c) 2026 Platxa. All Rights Reserved.

See [LICENSE](LICENSE) for details.
