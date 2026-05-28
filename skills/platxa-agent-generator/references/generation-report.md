# Generation Report Reference

Templates for formatting agent generation summary reports. The team-lead
agent renders these inline after generation completes.

## Report Structure

```markdown
# Agent Generation Report

## Overview

- **Agent:** {name}
- **Description:** {description}
- **Pattern:** {workflow_pattern}
- **Tools:** {tool_count} tools granted

## Quality Score

**Overall:** {score} / 10

| Criterion | Score |
|-----------|-------|
| clarity | {score} |
| completeness | {score} |
| tool_design | {score} |
| examples | {score} |
| security | {score} |
| documentation | {score} |

## Token Estimate

~{token_count} tokens

## Tools

- {tool_1}
- {tool_2}
- ...

## Security Findings

- [{SEVERITY}] {category}: {message} ({location})
- ...

## Install Location

`{install_path}`
```

## Section Constants

| Section | Heading |
|---------|---------|
| Report title | `# Agent Generation Report` |
| Overview | `## Overview` |
| Quality | `## Quality Score` |
| Tokens | `## Token Estimate` |
| Tools | `## Tools` |
| Security | `## Security Findings` |
| Install | `## Install Location` |

## Security Severity Ordering

Findings are always sorted by severity (most severe first):

| Order | Severity | Action |
|-------|----------|--------|
| 1 | critical | Block generation |
| 2 | high | Block generation |
| 3 | medium | Warn, allow generation |
| 4 | low | Informational |
| 5 | info | Informational |

## Quality Score Validation

- Overall score must be in `[0, 10]`
- Minimum passing score: **7.0**
- Individual criterion scores: `[0, 10]`
- Token estimate cannot be negative

## JSON Export Format

```json
{
  "agent_name": "string",
  "description": "string",
  "tools": ["Read", "Grep"],
  "quality": {
    "overall": 8.5,
    "criteria": {
      "clarity": 8.5,
      "completeness": 9.0,
      "tool_design": 8.0,
      "examples": 8.0,
      "security": 9.0,
      "documentation": 8.5
    }
  },
  "token_estimate": 1500,
  "install_location": ".claude/agents/agent-name.md",
  "security_findings": [
    {
      "severity": "low",
      "category": "permissions",
      "message": "Agent has Bash access",
      "location": "frontmatter:tools"
    }
  ]
}
```
