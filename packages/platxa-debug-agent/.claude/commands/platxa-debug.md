---
name: platxa-debug
description: Quick debugging - analyze errors and get fix suggestions
---

# Platxa Debug Command

Quickly analyze errors and get debugging assistance using the platxa-debug-agent.

## Usage

```
/platxa-debug [error message or description]
/platxa-debug              # Analyze current context or recent error
```

## Workflow

When invoked, perform these steps:

### Step 1: Determine Input

If an argument is provided, use it as the error to analyze.
If no argument, check for:
1. Recent error in the conversation context
2. Current file with syntax/type errors
3. Ask user what to debug

### Step 2: Invoke Debug Agent

Use the Task tool to invoke the debug-agent:

```
Task: debug-agent
Prompt: Analyze this error and provide fix suggestions:
[error content]

Context:
- Current file: $CURRENT_FILE (if available)
- Language: [detected from error/file]
```

### Step 3: Present Results

Display the analysis in this format:

```markdown
## 🔍 Error Analysis

**Type:** [error type]
**Language:** [language]
**Location:** [file:line if available]

### Root Cause
[Brief explanation of why the error occurred]

### Suggested Fixes

#### Fix 1 (Confidence: X.XX)
[Code change with before/after]

#### Fix 2 (Confidence: X.XX)
[Alternative fix if applicable]

### Next Steps
- [ ] Apply fix
- [ ] Run tests
- [ ] Verify fix
```

## Examples

### Example 1: Direct Error Input
```
User: /platxa-debug TypeError: Cannot read property 'map' of undefined
Agent: [Analyzes the error, identifies null/undefined access, suggests null checks]
```

### Example 2: Current File Analysis
```
User: /platxa-debug
Agent: [Checks current file for errors, analyzes any found issues]
```

### Example 3: Stack Trace Analysis
```
User: /platxa-debug
Traceback (most recent call last):
  File "app.py", line 42, in handler
    return process(data)
KeyError: 'user_id'

Agent: [Parses Python traceback, identifies missing key, suggests dict.get() or validation]
```

## Integration

This command integrates with:
- `platxa-debug analyze` CLI command
- debug-agent Task subagent
- Post-error hooks for automatic analysis

## Quick Actions

After analysis, you can:
- `/platxa-debug fix` - Apply the suggested fix
- `/platxa-debug rca` - Deep root cause analysis
- `/platxa-debug watch` - Monitor for similar errors
