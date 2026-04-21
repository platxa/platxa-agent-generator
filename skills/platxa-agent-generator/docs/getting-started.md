# Getting Started with Platxa Agent Generator

This guide walks you through setting up and using the Platxa Agent Generator to create AI agents for Claude Code CLI.

## Prerequisites

- Claude Code CLI installed and configured
- Python 3.10 or higher (for advanced features)
- Git (recommended for version control)

## Installation

### Method 1: As a Claude Code Skill

The agent generator is available as a skill in Claude Code:

```bash
# The skill is automatically available when installed in .claude/skills/
# Just invoke it with natural language
claude "Generate an agent that [your description]"
```

### Method 2: Standalone Python Package

```bash
# Clone the repository
git clone https://github.com/platxa/platxa-agent-generator.git

# Install dependencies
cd platxa-agent-generator
pip install -r requirements.txt

# Run the CLI
python -m scripts.cli generate "Your agent description"
```

## Your First Agent

### Step 1: Describe Your Agent

Think about what you want your agent to do. Be specific about:
- The primary task
- Input types it should handle
- Expected outputs
- Any tools it needs

### Step 2: Generate the Agent

```bash
# Using Claude Code
claude "Create an agent that checks Python files for type hints and suggests improvements"

# Using the CLI
python -m scripts.cli generate \
  --description "Check Python files for type hints and suggest improvements" \
  --name "type-hint-checker" \
  --pattern "prompt-chaining"
```

### Step 3: Review the Output

The generator creates:

```
.claude/
├── agents/
│   └── type-hint-checker.md    # Main agent definition
├── commands/
│   └── type-hint-checker.md    # Slash command (optional)
└── hooks/                      # Compliance hooks (optional)
```

### Step 4: Test Your Agent

```bash
# Dry run to preview
python -m scripts.cli dry-run --name "type-hint-checker"

# Test with actual input
claude --agent type-hint-checker "Check src/main.py"
```

### Step 5: Install for Use

```bash
# Install to user scope (available in all projects)
python -m scripts.cli install --scope user --name "type-hint-checker"

# Install to project scope (available in current project only)
python -m scripts.cli install --scope project --name "type-hint-checker"
```

## Understanding Agent Files

### Agent Definition Structure

```markdown
---
name: type-hint-checker
description: Checks Python files for type hints and suggests improvements
tools: Read, Grep, Glob
version: 1.0.0
---

# Type Hint Checker

## Overview
Brief description of what the agent does.

## Workflow
1. Find Python files in the target directory
2. Analyze each file for missing type hints
3. Generate suggestions for improvement
4. Report findings with file locations

## Examples
### Example 1: Check a Single File
**User:** "Check src/utils.py for type hints"
**Agent:** [Reads the file, analyzes functions, reports findings]

## Output Format
```json
{
  "files_checked": 5,
  "issues_found": 12,
  "suggestions": [...]
}
```
```

### Key Sections

| Section | Purpose |
|---------|---------|
| Frontmatter | Metadata (name, description, tools) |
| Overview | What the agent does |
| Workflow | Step-by-step process |
| Examples | Usage demonstrations |
| Output Format | Response structure |

## Configuration

### Project Configuration

Create `.claude/config.yaml` in your project:

```yaml
agent_generator:
  default_pattern: prompt-chaining
  quality_threshold: 7.0
  auto_install: false

  # Default tools for different agent types
  tool_presets:
    reader: [Read, Grep, Glob]
    writer: [Read, Write, Edit, Grep, Glob]
    researcher: [Read, WebSearch, WebFetch]
```

### User Configuration

Create `~/.claude/agent_generator.yaml`:

```yaml
# Personal defaults
author: "Your Name"
license: MIT
default_scope: user

# Quality preferences
strict_mode: true
require_examples: true
min_quality_score: 8.0
```

## Next Steps

- [Quick Tutorial](tutorial-quickstart.md) - Build a complete agent
- [Agent Patterns](patterns-overview.md) - Learn about different patterns
- [Best Practices](../references/best-practices.md) - Write better agents

## Troubleshooting

### Agent Not Found

```
Error: Agent 'my-agent' not found
```

**Solution:** Check the installation scope. User-scope agents are in `~/.claude/agents/`, project-scope in `.claude/agents/`.

### Low Quality Score

```
Warning: Quality score 5.2/10 below threshold 7.0
```

**Solution:** Add more examples, improve the workflow description, or add missing sections (Overview, Output Format).

### Tool Permission Denied

```
Error: Tool 'Bash' not permitted for this agent
```

**Solution:** Add the required tool to the frontmatter `tools` field.

## Getting Help

- Check the [FAQ](faq.md)
- Open an issue on GitHub
- Ask in the Claude Code community
