# Platxa Agent Generator Documentation

Transform natural language descriptions into production-ready AI agents for Claude Code CLI.

## Quick Start

```bash
# Generate an agent from description
claude "Create an agent that reviews Python code for security vulnerabilities"

# Use the skill directly
/platxa-agent-generator "Build a documentation generator for TypeScript projects"
```

## Documentation Index

### Getting Started
- [Installation Guide](getting-started.md) - Setup and configuration
- [Quick Tutorial](tutorial-quickstart.md) - Create your first agent in 5 minutes

### Core Concepts
- [Agent Patterns](patterns-overview.md) - Understanding the 5 agent patterns
- [Tool Permissions](tool-permissions.md) - Configuring agent capabilities
- [Quality Scoring](quality-scoring.md) - How agents are validated

### Tutorials
- [Tutorial: Code Reviewer](tutorial-code-reviewer.md) - Build a code review agent
- [Tutorial: Research Agent](tutorial-research-agent.md) - Build a web research agent
- [Tutorial: Multi-Agent System](tutorial-multi-agent.md) - Orchestrate multiple agents

### Reference
- [API Reference](api-reference.md) - Complete API documentation
- [CLI Reference](cli-reference.md) - Command-line interface
- [Configuration](configuration.md) - Configuration options

### Advanced Topics
- [Agent Composition](advanced-composition.md) - Combining multiple agents
- [Versioning](advanced-versioning.md) - Version control for agents
- [Export & Sharing](advanced-export.md) - Share agents with others

## Architecture Overview

```
User Description → NLP Parser → Type Classifier → Pattern Selector
                                      ↓
                              Architecture Blueprint
                                      ↓
                              Generation Phase
                                      ↓
                    Agent File + Commands + Hooks + Scripts
                                      ↓
                              Validation Phase
                                      ↓
                              Quality Score ≥ 7.0
                                      ↓
                              Installation
```

## Supported Agent Patterns

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Prompt Chaining | Sequential fixed steps | Simple |
| Routing | Input classification | Medium |
| Parallelization | Concurrent independent tasks | Medium |
| Orchestrator-Workers | Dynamic task decomposition | Complex |
| Evaluator-Optimizer | Iterative refinement | Complex |

## Example Agents

### Simple: Code Formatter
```
"Create an agent that formats Python files using Black"
```

### Medium: Documentation Generator
```
"Build an agent that generates API documentation from TypeScript source files"
```

### Complex: Full-Stack Reviewer
```
"Create a multi-agent system that reviews frontend React code, backend Python APIs, and database queries, then synthesizes findings"
```

## Quality Standards

All generated agents must achieve:
- **Minimum Score**: 7.0/10
- **Required Sections**: Overview, Workflow, Examples, Output Format
- **Security**: No hardcoded secrets, proper input validation
- **Completeness**: All workflow steps documented

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Adding new agent patterns
- Improving generation quality
- Expanding the agent catalog
