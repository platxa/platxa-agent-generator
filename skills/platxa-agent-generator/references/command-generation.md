# Command Generation Reference

Templates for generating `.claude/commands/*.md` slash command files. The
generation-subagent renders these via Write.

## Command File Structure

```markdown
---
description: What the command does
allowed-tools: ["Read", "Grep", "Task"]
argument-hint: <description or query>
model: sonnet
---

# Command Name

## Overview

Brief description of what this command does.

## Workflow

1. Parse arguments from $ARGUMENTS
2. Invoke agent via Task tool
3. Process results
4. Report to user

## Agent Invocation

Use the Task tool to dispatch the agent:

- **subagent_type:** "{agent-name}"
- **description:** "Brief task description"
- **prompt:** Include $ARGUMENTS

## Argument Handling

### When $ARGUMENTS is provided
- Parse the input and pass to the agent
- Adjust behavior based on arguments

### When $ARGUMENTS is empty
- Use sensible defaults
- May prompt user via AskUserQuestion

## Usage Examples

### Basic
`/{command-name}`

### With Arguments
`/{command-name} {argument-hint}`

## Notes

Any additional guidance for users.
```

## Frontmatter Schema

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| description | yes | string | non-empty, ≤256 chars |
| allowed-tools | no | JSON array | valid tool names |
| argument-hint | no | string | short placeholder text |
| model | no | enum | `haiku`, `sonnet`, `opus` |

## Command Name Rules

- **Format:** kebab-case only (e.g., `review-code`)
- **Length:** ≤64 characters
- **No leading/trailing hyphens**
- **No double hyphens** (`--`)
- **No path traversal** characters (`.`, `/`, `\`)

## $ARGUMENTS Token

The body **must** contain `$ARGUMENTS` for argument forwarding. This token
is replaced at runtime with the user's input after the slash command name.

## Agent Invocation Template

```json
{
  "subagent_type": "{agent_name}",
  "description": "{Short task description}",
  "prompt": "User request: $ARGUMENTS\n\nExecute the task and return results."
}
```

## Companion Command Generation

Generate a companion command when:
- The agent definition has `user_invocable: true` (or equivalent)
- The agent is intended for direct user interaction

Skip when:
- The agent is a subagent only (dispatched by other agents)
- The agent is an internal pipeline component

## Validation Checklist

1. Frontmatter parses as valid YAML
2. `description` is non-empty and ≤256 chars
3. Command name is valid kebab-case
4. `$ARGUMENTS` appears in body
5. Task tool is referenced in agent invocation section
6. `allowed-tools` contains only valid tool names
