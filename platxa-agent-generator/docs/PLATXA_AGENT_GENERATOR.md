# Platxa Agent Generator

> **World-Class NLP-to-Agent System for Claude Code CLI**

Build production-ready AI agents from natural language descriptions using Anthropic's proven patterns and Claude Code's native capabilities.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Foundation](#research-foundation)
3. [Architecture Design](#architecture-design)
4. [Workflow Phases](#workflow-phases)
5. [Agent Patterns](#agent-patterns)
6. [Claude Code Integration](#claude-code-integration)
7. [Implementation Features](#implementation-features)
8. [Quality Assurance](#quality-assurance)
9. [Deployment Strategy](#deployment-strategy)
10. [Roadmap](#roadmap)
11. [References](#references)

---

## Executive Summary

### Vision

Platxa Agent Generator transforms natural language descriptions into production-ready AI agents that run natively in Claude Code CLI. Unlike external frameworks (LangGraph, CrewAI, AutoGen), it generates agents that leverage Claude Code's built-in capabilities: Task tool, subagents, skills, hooks, and MCP integration.

### Key Differentiators

| Feature | Platxa Agent Generator | External Frameworks |
|---------|----------------------|---------------------|
| **Integration** | Native Claude Code CLI | Requires separate runtime |
| **Input** | Natural Language | Code/Configuration |
| **Output** | `.claude/agents/*.md` | Python/YAML configs |
| **Validation** | Built-in quality gates | Manual testing |
| **Deployment** | One-command install | Complex setup |

### Core Capabilities

1. **NLP-to-Agent**: Describe what you want in plain English
2. **Pattern Selection**: Automatically choose optimal architecture
3. **Multi-Agent Systems**: Generate coordinated agent teams
4. **Production-Ready**: Built-in validation, security, and testing
5. **Composable**: Agents can invoke other agents as subagents

---

## Research Foundation

### Source Analysis

This system is built on comprehensive research from authoritative sources:

#### 1. Anthropic: Building Effective Agents

**Key Insight**: "Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs."

**Foundational Concepts**:
- **Workflows vs Agents**: Workflows use predefined code paths; agents dynamically direct their own processes
- **Augmented LLM**: Foundation combining retrieval, tools, and memory
- **Tool Design Principles**: Simplicity, natural representation, cognitive clarity

#### 2. Claude Cookbooks: Agent Patterns

**Reference Implementations**:
- Basic Workflows (prompt chaining, routing, parallelization)
- Orchestrator-Workers (dynamic task decomposition)
- Evaluator-Optimizer (iterative refinement)

**SDK Examples**:
- Research Agent: WebSearch + Read for autonomous research
- Chief of Staff Agent: Subagents, hooks, memory, commands
- Observability Agent: MCP server integration

#### 3. AI Agent Framework Landscape 2025

**Framework Comparison**:

| Framework | Architecture | Strength | Limitation |
|-----------|-------------|----------|------------|
| **LangGraph** | Graph-based DAG | Complex branching | Overhead for simple tasks |
| **CrewAI** | Role-based crews | Multi-agent collab | Ceiling at 6-12 months |
| **AutoGen** | Async conversations | Real-time concurrency | Event complexity |
| **Semantic Kernel** | Skill-based | Enterprise-ready | Abstraction learning curve |

**Critical Finding**: CrewAI users report hitting a ceiling when requirements grow beyond sequential/hierarchical task execution. LangGraph provides more tractability for branching logic.

#### 4. Claude Code Best Practices

**Production Patterns**:
- Subagents preserve context while delegating specialized tasks
- Extended thinking scales computation: think → think hard → ultrathink
- Headless mode (`-p` flag) enables CI/CD integration
- Fanning out: generate task lists, invoke Claude for each item

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PLATXA AGENT GENERATOR                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │  Discovery  │ → │ Architecture│ → │  Generation │ → │ Validation  │ │
│  │  Subagent   │   │  Subagent   │   │  Subagent   │   │  Subagent   │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│         │                 │                 │                 │         │
│         ▼                 ▼                 ▼                 ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     ORCHESTRATOR (Main Agent)                    │   │
│  │  • State Machine Management                                      │   │
│  │  • Subagent Coordination                                         │   │
│  │  • User Interaction                                              │   │
│  │  • Quality Gates                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                           OUTPUT ARTIFACTS                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ .claude/      │  │ .claude/      │  │ scripts/      │               │
│  │ agents/*.md   │  │ commands/*.md │  │ *.sh, *.py    │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### State Machine

```
┌────────┐     ┌──────────┐     ┌──────────────┐     ┌────────────┐
│  IDLE  │ ──▶ │ DISCOVERY│ ──▶ │ ARCHITECTURE │ ──▶ │ GENERATION │
└────────┘     └──────────┘     └──────────────┘     └────────────┘
                                                            │
┌──────────┐     ┌──────────────┐     ┌────────────┐       │
│ COMPLETE │ ◀── │ INSTALLATION │ ◀── │ VALIDATION │ ◀─────┘
└──────────┘     └──────────────┘     └────────────┘
```

### Subagent Architecture

Each subagent operates in its own context window, preventing pollution of the main conversation:

```yaml
# Discovery Subagent
Purpose: Research domain patterns and existing agents
Tools: WebSearch, WebFetch, Glob, Read
Output: Domain knowledge JSON

# Architecture Subagent
Purpose: Determine agent type and structure
Tools: Read, Grep
Output: Architecture blueprint JSON

# Generation Subagent
Purpose: Create agent definition files
Tools: Write, Read
Output: Agent files (.md, .sh, .py)

# Validation Subagent
Purpose: Quality checks and security scanning
Tools: Bash, Read, Grep
Output: Validation report with score
```

---

## Workflow Phases

### Phase 1: Discovery

**Input**: Natural language agent description

**Process**:
1. Parse NLP description to extract requirements
2. Identify agent type (simple, orchestrator, multi-agent)
3. Research domain patterns via web search
4. Analyze existing agents for reusable patterns
5. Determine tool requirements

**Output**:
```json
{
  "agent_name": "security-reviewer",
  "agent_type": "analyzer",
  "description": "Reviews code for security vulnerabilities",
  "required_tools": ["Read", "Grep", "Glob", "Bash"],
  "domain_knowledge": {
    "patterns": ["OWASP Top 10", "SAST", "Code scanning"],
    "existing_agents": ["code-reviewer"],
    "best_practices": ["Check for injection", "Validate inputs"]
  }
}
```

### Phase 2: Architecture

**Input**: Discovery output

**Process**:
1. Select optimal workflow pattern
2. Design subagent structure (if multi-agent)
3. Define tool permissions and restrictions
4. Plan MCP integrations (if needed)
5. Create architecture blueprint

**Output**:
```json
{
  "pattern": "evaluator-optimizer",
  "structure": {
    "main_agent": "security-reviewer",
    "subagents": [],
    "workflow": "iterative"
  },
  "tools": {
    "allowed": ["Read", "Grep", "Glob", "Bash"],
    "bash_permissions": ["git diff:*", "grep:*"]
  },
  "sections": [
    "Overview",
    "Security Checklist",
    "Review Process",
    "Output Format"
  ]
}
```

### Phase 3: Generation

**Input**: Architecture blueprint

**Process**:
1. Generate agent.md file with frontmatter
2. Create system prompt based on type and purpose
3. Build security checklist/guidelines
4. Generate helper scripts (if needed)
5. Create slash commands (if needed)

**Output Files**:
```
.claude/agents/security-reviewer.md
.claude/commands/security-review.md (optional)
scripts/security-scan.sh (optional)
```

### Phase 4: Validation

**Input**: Generated files

**Process**:
1. **Syntax Validation**: YAML frontmatter, markdown structure
2. **Security Scanning**: Dangerous patterns, tool combinations
3. **Completeness Check**: Required fields, documentation
4. **Quality Scoring**: 0-10 scale based on criteria
5. **Test Invocation**: Dry-run to verify loading

**Output**:
```json
{
  "passed": true,
  "score": 8.5,
  "checks": {
    "syntax": "PASS",
    "security": "PASS",
    "completeness": "PASS",
    "quality": "PASS"
  },
  "warnings": [],
  "errors": []
}
```

### Phase 5: Installation

**Input**: Validated agent files

**Process**:
1. Confirm installation scope (user vs project)
2. Copy files to target directory
3. Set permissions on scripts
4. Verify agent loads in Claude Code
5. Generate usage documentation

**Output**:
```
✓ Installed security-reviewer to ~/.claude/agents/
✓ Agent loads successfully
✓ Usage: claude "use security-reviewer agent to review this PR"
```

---

## Agent Patterns

### Pattern 1: Prompt Chaining

**Use Case**: Tasks decomposable into fixed sequential steps

**Architecture**:
```
[Input] → [Step 1] → [Step 2] → [Step 3] → [Output]
```

**Example**: Documentation Generator
```
[Code] → [Extract Functions] → [Generate Docstrings] → [Format Output]
```

**When to Use**:
- Fixed, predictable subtasks
- Each step depends on previous output
- Quality more important than speed

**Trade-off**: Latency for accuracy

---

### Pattern 2: Routing

**Use Case**: Different handling based on input classification

**Architecture**:
```
            ┌→ [Handler A]
[Input] → [Classifier] → [Handler B]
            └→ [Handler C]
```

**Example**: Customer Support Agent
```
            ┌→ [Refund Handler]
[Query] → [Intent Classifier] → [Technical Support]
            └→ [General FAQ]
```

**When to Use**:
- Distinct input categories
- Specialized handling per category
- Separation of concerns needed

---

### Pattern 3: Parallelization

**Use Case**: Independent subtasks that can run concurrently

**Architecture**:
```
           ┌→ [Worker 1] ─┐
[Input] → ├→ [Worker 2] ─┼→ [Aggregator] → [Output]
           └→ [Worker 3] ─┘
```

**Example**: Multi-file Refactoring
```
           ┌→ [Refactor file1.py] ─┐
[Task] → ├→ [Refactor file2.py] ─┼→ [Verify All] → [Commit]
           └→ [Refactor file3.py] ─┘
```

**When to Use**:
- Independent subtasks
- Speed critical
- Results can be combined

**Implementation**: Multiple Task tool calls in single message

---

### Pattern 4: Orchestrator-Workers

**Use Case**: Dynamic task decomposition based on input

**Architecture**:
```
┌─────────────────────────────────────────┐
│            ORCHESTRATOR                 │
│  1. Analyze task                        │
│  2. Decompose into subtasks             │
│  3. Spawn workers                       │
│  4. Synthesize results                  │
└─────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
   [Worker 1]  [Worker 2]  [Worker N]
```

**Example**: Code Review Agent
```
┌─────────────────────────────────────────┐
│         CODE REVIEW ORCHESTRATOR        │
│  1. Analyze PR scope                    │
│  2. Identify review areas               │
│  3. Spawn specialized reviewers         │
│  4. Compile final review                │
└─────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
   [Security]  [Performance]  [Style]
```

**When to Use**:
- Unpredictable task scope
- Subtasks emerge from analysis
- Complex multi-step workflows

**This is the MOST POWERFUL pattern**

---

### Pattern 5: Evaluator-Optimizer

**Use Case**: Iterative refinement with feedback loops

**Architecture**:
```
┌─────────────────────────────────────────┐
│                                         │
│  [Generator] → [Evaluator] → [Feedback] │
│       ▲                          │      │
│       └──────────────────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

**Example**: Test Generator
```
┌─────────────────────────────────────────┐
│                                         │
│  [Write Tests] → [Run Tests] → [Fix]    │
│       ▲              │           │      │
│       └──────────────┴───────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

**When to Use**:
- Clear evaluation criteria exist
- Iterative improvement is valuable
- Quality gates are important

---

## Claude Code Integration

### Native Capabilities

#### Task Tool

The Task tool launches specialized subagents with separate context windows:

```python
# Task tool parameters
{
    "subagent_type": "Explore",  # Agent type
    "description": "Find security patterns",  # 3-5 word summary
    "prompt": "Search for OWASP patterns in codebase",  # Instructions
    "run_in_background": false  # Async execution
}
```

**Best Practice**: Launch multiple agents concurrently for parallel execution.

#### Subagents

Custom subagents in `.claude/agents/`:

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
---

You are a security expert specialized in code review...
```

**Key Benefits**:
- Separate context window (no pollution)
- Customized system prompts
- Restricted tool access
- Reusable across projects

#### Skills

Reusable capabilities in `.claude/skills/`:

```markdown
---
name: owasp-checker
description: Check code against OWASP Top 10
allowed-tools:
  - Read
  - Grep
---

# OWASP Security Checker

## Workflow
1. Identify code to check
2. Run against OWASP checklist
3. Report findings
```

#### Hooks

Automated compliance and logging:

```python
# .claude/hooks/audit-log.py
def on_tool_call(tool_name, args):
    log_to_file(f"Tool: {tool_name}, Args: {args}")
```

#### Commands

User-friendly shortcuts in `.claude/commands/`:

```markdown
# security-review.md
Review the current codebase for security vulnerabilities using the security-reviewer agent.

Focus on: $ARGUMENTS
```

Usage: `/security-review authentication module`

#### Extended Thinking

Scale computation for complex decisions:

| Command | Intensity | Use Case |
|---------|-----------|----------|
| `think` | Baseline | Standard problems |
| `think hard` | Increased | Multi-step problems |
| `think harder` | High | Complex architecture |
| `ultrathink` | Maximum | Critical decisions |

---

## Implementation Features

### Feature Categories

#### Core (6 features)
- NLP parser for requirement extraction
- Agent type classifier
- Workflow state machine
- State persistence
- Progress tracking
- Extended thinking integration

#### Subagents (4 features)
- Discovery subagent
- Architecture subagent
- Generation subagent
- Validation subagent

#### Patterns (5 features)
- Prompt chaining generator
- Routing generator
- Parallelization generator
- Orchestrator-workers generator
- Evaluator-optimizer generator

#### Generation (4 features)
- Agent.md file generator
- System prompt generator
- Tool selection logic
- CLAUDE.md generator

#### Validation (4 features)
- Syntax validator
- Security scanner
- Completeness checker
- Quality scorer

#### Templates (6 features)
- Code reviewer template
- Research agent template
- Documentation agent template
- Test writer template
- Refactoring agent template
- Security scanner template

#### Integration (4 features)
- MCP server configuration
- Slash command generator
- Hooks generator
- CLI interface

### Feature Priority Matrix

| Priority | Count | Categories |
|----------|-------|------------|
| **High** | 18 | Core, Subagents, Key Generation, Validation |
| **Medium** | 22 | Patterns, Templates, Integration |
| **Low** | 8 | Advanced features, Documentation |

---

## Quality Assurance

### Validation Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Syntax    │ ──▶ │  Security   │ ──▶ │ Completeness│ ──▶ │   Quality   │
│  Validator  │     │   Scanner   │     │   Checker   │     │   Scorer    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
  YAML valid?       No dangerous        All required        Score ≥ 7.0?
  MD structure?     patterns?           fields present?
```

### Quality Scoring Criteria

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Clarity** | 20% | System prompt is clear and specific |
| **Completeness** | 20% | All required sections present |
| **Tool Design** | 20% | Appropriate tools with proper permissions |
| **Examples** | 15% | Realistic usage examples included |
| **Security** | 15% | No dangerous patterns or permissions |
| **Documentation** | 10% | Usage instructions clear |

**Minimum Score**: 7.0/10 to pass validation

### Security Checklist

- [ ] No shell injection vulnerabilities
- [ ] No unrestricted file system access
- [ ] No hardcoded credentials
- [ ] No dangerous command combinations
- [ ] Appropriate tool restrictions
- [ ] Input validation in scripts

---

## Deployment Strategy

### Installation Scopes

#### User Scope
```bash
~/.claude/agents/agent-name.md
```
- Available across all projects
- Personal customizations
- Not version controlled with project

#### Project Scope
```bash
.claude/agents/agent-name.md
```
- Shared with team via git
- Project-specific agents
- Version controlled

### Installation Process

```bash
# User installation
./scripts/install-agent.sh agent-name --user

# Project installation
./scripts/install-agent.sh agent-name --project

# Verification
claude "list available agents"
```

### CI/CD Integration

```yaml
# .github/workflows/validate-agents.yml
name: Validate Agents
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate agent definitions
        run: ./scripts/validate-all.sh .claude/agents/
```

---

## Roadmap

### Phase 1: Foundation (MVP)
- [ ] Core skill structure
- [ ] NLP parser
- [ ] Single agent generation
- [ ] Basic validation
- [ ] User installation

### Phase 2: Patterns
- [ ] All 5 Anthropic patterns
- [ ] Pattern selection logic
- [ ] Template library
- [ ] Enhanced validation

### Phase 3: Multi-Agent
- [ ] Orchestrator-workers generation
- [ ] Subagent coordination
- [ ] Parallel execution
- [ ] Agent composition

### Phase 4: Enterprise
- [ ] MCP integration
- [ ] Hooks generation
- [ ] Compliance features
- [ ] Advanced security

### Phase 5: Ecosystem
- [ ] Agent catalog
- [ ] Community templates
- [ ] Export/sharing
- [ ] Version management

---

## References

### Primary Sources

1. **Anthropic: Building Effective Agents**
   - URL: https://www.anthropic.com/engineering/building-effective-agents
   - Key: Workflow patterns, tool design, production best practices

2. **Claude Cookbooks: Agent Patterns**
   - URL: https://github.com/anthropics/claude-cookbooks/tree/main/patterns/agents
   - Key: Reference implementations, SDK examples

3. **Claude Code Best Practices**
   - URL: https://www.anthropic.com/engineering/claude-code-best-practices
   - Key: Subagents, extended thinking, headless mode

4. **Claude Code Subagent Documentation**
   - URL: https://code.claude.com/docs/en/sub-agents
   - Key: Context isolation, Task tool, orchestration

### Secondary Sources

5. **AI Agent Framework Comparison 2025**
   - URL: https://langfuse.com/blog/2025-03-19-ai-agent-comparison
   - Key: Framework strengths/weaknesses, architecture patterns

6. **Survey on Code Generation with LLM-based Agents**
   - URL: https://arxiv.org/html/2508.00083v1
   - Key: NL2Code patterns, multi-agent collaboration

---

## Appendix

### A. Agent Definition Format

```markdown
---
name: agent-name
description: What the agent does (≤1024 chars)
tools: Read, Write, Grep, Glob, Bash
---

# Agent Name

## Overview
Brief description of agent purpose and capabilities.

## Workflow
1. Step one
2. Step two
3. Step three

## Examples

### Example 1: Basic Usage
User: "Do something"
Agent: [Response description]

## Output Format
Describe expected output structure.
```

### B. Tool Reference

| Tool | Purpose | Example |
|------|---------|---------|
| Read | Read files | `Read file.py` |
| Write | Create files | `Write new-file.py` |
| Edit | Modify files | `Edit file.py` |
| Grep | Search content | `Grep "pattern"` |
| Glob | Find files | `Glob "*.py"` |
| Bash | Run commands | `Bash git status` |
| Task | Spawn subagents | `Task subagent_type=Explore` |
| WebSearch | Search web | `WebSearch "query"` |
| WebFetch | Fetch URL | `WebFetch url` |

### C. Quality Score Calculator

```python
def calculate_quality_score(agent):
    scores = {
        'clarity': assess_clarity(agent.system_prompt),  # 0-10
        'completeness': assess_completeness(agent.sections),  # 0-10
        'tool_design': assess_tools(agent.tools),  # 0-10
        'examples': assess_examples(agent.examples),  # 0-10
        'security': assess_security(agent),  # 0-10
        'documentation': assess_docs(agent.docs),  # 0-10
    }

    weights = {
        'clarity': 0.20,
        'completeness': 0.20,
        'tool_design': 0.20,
        'examples': 0.15,
        'security': 0.15,
        'documentation': 0.10,
    }

    return sum(scores[k] * weights[k] for k in scores)
```

---

*Built with research from Anthropic's Building Effective Agents guide and Claude Cookbooks.*

*Platxa | AI Research & Product Development | https://platxa.com*
