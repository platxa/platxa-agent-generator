---
name: platxa-agent-generator
description: Transform natural language descriptions into production-ready AI agents for Claude Code CLI. Uses orchestrator-workers pattern with specialized subagents for discovery, architecture, generation, and validation phases. Generates .claude/agents/*.md files that leverage Claude Code's native capabilities.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task, AskUserQuestion, TodoWrite
---

# Platxa Agent Generator

Transform natural language descriptions into production-ready AI agents for Claude Code CLI.

## Overview

This skill generates Claude Code agents from plain English descriptions. Unlike external frameworks (LangGraph, CrewAI, AutoGen), it creates agents that leverage Claude Code's built-in capabilities:

- **Task tool** for subagent orchestration
- **Skills** for reusable capabilities
- **Hooks** for automated compliance
- **MCP** for external integrations

The generator uses an orchestrator-workers pattern with specialized subagents for each phase.

## Workflow

### Phase 1: Discovery

**Input**: Natural language agent description

Use Task tool with `subagent_type="Explore"` to:
1. Parse NLP description to extract requirements
2. Identify agent type (simple, orchestrator, multi-agent)
3. Research domain patterns via web search
4. Analyze existing agents for reusable patterns
5. Determine tool requirements

**Output**: Domain knowledge JSON with agent_name, agent_type, required_tools, domain_knowledge

### Phase 2: Architecture

**Input**: Discovery output

Determine optimal workflow pattern:
- **Prompt Chaining**: Fixed sequential steps
- **Routing**: Input classification to handlers
- **Parallelization**: Independent concurrent subtasks
- **Orchestrator-Workers**: Dynamic task decomposition (most powerful)
- **Evaluator-Optimizer**: Iterative refinement with feedback

**Output**: Architecture blueprint with pattern, structure, tools, sections

### Phase 3: Generation

**Input**: Architecture blueprint

Create agent files:
1. `.claude/agents/{agent-name}.md` with YAML frontmatter
2. System prompt based on type and purpose
3. Helper scripts if needed (`.sh`, `.py`)
4. Slash commands if needed (`.claude/commands/`)

### Phase 4: Validation

**Input**: Generated files

Run quality checks:
- **Syntax**: YAML frontmatter, markdown structure
- **Security**: Dangerous patterns, tool combinations
- **Completeness**: Required fields, documentation
- **Quality Score**: Must be >= 7.0/10

### Phase 5: Installation

**Input**: Validated agent files

Install to target scope:
- **User**: `~/.claude/agents/` (available across projects)
- **Project**: `.claude/agents/` (version controlled)

## Examples

### Example 1: Simple Code Reviewer

```
User: Create an agent that reviews Python code for best practices
Assistant: [Discovery] Analyzing requirements... Agent type: Analyzer
Assistant: [Architecture] Pattern: Evaluator-Optimizer for iterative review
Assistant: [Generation] Creating .claude/agents/python-reviewer.md
Assistant: [Validation] Score: 8.2/10 - PASSED
Assistant: Install to ~/.claude/agents/? (y/n)
```

### Example 2: Multi-Agent Documentation System

```
User: Create a documentation agent that can analyze code, generate docs, and validate them
Assistant: [Discovery] Complex requirement detected - multi-agent system
Assistant: [Architecture] Pattern: Orchestrator-Workers with 3 subagents
  - code-analyzer: Extracts function signatures and structure
  - doc-generator: Creates markdown documentation
  - doc-validator: Checks completeness and accuracy
Assistant: [Generation] Creating orchestrator + 3 worker agents
Assistant: [Validation] Score: 7.8/10 - PASSED
```

### Example 3: Security Scanner

```
User: Create an agent that scans for OWASP Top 10 vulnerabilities
Assistant: [Discovery] Security domain - researching OWASP patterns...
Assistant: [Architecture] Pattern: Parallelization (concurrent file scanning)
Assistant: [Generation] Created security-scanner.md with OWASP checklist
Assistant: [Validation] Score: 8.5/10 - PASSED
```

## Agent Definition Format

Generated agents follow this structure:

```markdown
---
name: agent-name
description: What the agent does (max 1024 chars)
tools: Read, Write, Grep, Glob, Bash
---

# Agent Name

## Overview
Brief description of purpose and capabilities.

## Workflow
1. Step one
2. Step two
3. Step three

## Examples
### Example: Basic Usage
User: "Do something"
Agent: [Response]

## Output Format
Expected structure of agent output.
```

## Quality Scoring

| Criteria | Weight | Description |
|----------|--------|-------------|
| Clarity | 20% | System prompt is clear and specific |
| Completeness | 20% | All required sections present |
| Tool Design | 20% | Appropriate tools with proper permissions |
| Examples | 15% | Realistic usage examples included |
| Security | 15% | No dangerous patterns or permissions |
| Documentation | 10% | Usage instructions clear |

**Minimum passing score**: 7.0/10

## Output Checklist

When generating an agent, verify:

- [ ] `.claude/agents/{name}.md` exists with valid YAML frontmatter
- [ ] Name is hyphen-case, max 64 characters
- [ ] Description is max 1024 characters
- [ ] Tools list is minimal and appropriate
- [ ] Workflow section has clear steps
- [ ] Examples show realistic usage
- [ ] No hardcoded credentials or secrets
- [ ] No dangerous shell commands
- [ ] Quality score >= 7.0/10

## Patterns Reference

| Pattern | Use When | Trade-off |
|---------|----------|-----------|
| Prompt Chaining | Fixed sequential steps | Latency for accuracy |
| Routing | Distinct input categories | Complexity for specialization |
| Parallelization | Independent subtasks | Resources for speed |
| Orchestrator-Workers | Dynamic task scope | Overhead for flexibility |
| Evaluator-Optimizer | Iterative refinement | Time for quality |