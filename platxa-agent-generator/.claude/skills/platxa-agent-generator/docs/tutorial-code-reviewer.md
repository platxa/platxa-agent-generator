# Tutorial: Building a Code Reviewer Agent

In this tutorial, you'll create a production-ready code reviewer agent that analyzes Python code for common issues, security vulnerabilities, and style violations.

**Time:** 15-20 minutes
**Difficulty:** Intermediate
**Pattern:** Prompt Chaining

## What You'll Build

A code reviewer agent that:
1. Scans Python files for issues
2. Checks for security vulnerabilities
3. Validates code style
4. Generates a structured report

## Prerequisites

- Platxa Agent Generator installed
- Basic understanding of agent patterns
- Familiarity with Python (for understanding the examples)

## Step 1: Plan Your Agent

Before generating, plan what your agent needs:

### Requirements
- Input: File paths or directory paths
- Output: Structured review report
- Tools needed: Read (files), Grep (search patterns), Glob (find files)

### Workflow Steps
1. Find Python files
2. Analyze for code issues
3. Check security patterns
4. Validate style
5. Generate report

## Step 2: Generate the Agent

### Using Natural Language

```bash
claude "Create a code reviewer agent for Python that:
- Finds all .py files in a directory
- Checks for common issues (unused imports, bare except, etc.)
- Scans for security vulnerabilities (SQL injection, hardcoded secrets)
- Validates PEP8 style compliance
- Generates a JSON report with severity levels"
```

### Using the CLI

```bash
python -m scripts.cli generate \
  --name "python-code-reviewer" \
  --description "Reviews Python code for issues, security, and style" \
  --pattern "prompt-chaining" \
  --tools "Read,Grep,Glob"
```

## Step 3: Review Generated Agent

The generator creates `.claude/agents/python-code-reviewer.md`:

```markdown
---
name: python-code-reviewer
description: Reviews Python code for issues, security vulnerabilities, and style compliance
tools: Read, Grep, Glob
version: 1.0.0
---

# Python Code Reviewer

## Overview

A comprehensive code review agent that analyzes Python codebases for:
- Code quality issues
- Security vulnerabilities
- Style compliance

## Workflow

### Phase 1: Discovery
1. Use Glob to find all `.py` files in the target directory
2. Filter out test files, migrations, and generated code
3. Build a file manifest for analysis

**Gate:** Verify at least one Python file found

### Phase 2: Code Quality Analysis
For each file:
1. Read file contents
2. Check for common issues:
   - Unused imports
   - Bare except clauses
   - Mutable default arguments
   - Global variable usage
3. Record findings with line numbers

**Gate:** Analysis completed for all files

### Phase 3: Security Scan
For each file:
1. Search for security patterns:
   - SQL string concatenation
   - Hardcoded credentials
   - Unsafe deserialization
   - Command injection risks
2. Classify severity (critical, high, medium, low)

**Gate:** Security scan completed

### Phase 4: Style Check
For each file:
1. Check PEP8 compliance indicators:
   - Line length
   - Naming conventions
   - Import ordering
2. Note style violations

### Phase 5: Report Generation
1. Aggregate all findings
2. Deduplicate similar issues
3. Sort by severity
4. Format as structured JSON

## Examples

### Example 1: Review a Directory

**User:** "Review the code in src/api/"

**Agent:**
1. Finds 12 Python files in src/api/
2. Analyzes each file for issues
3. Identifies 3 security concerns, 8 code quality issues
4. Returns structured report

**Output:**
```json
{
  "summary": {
    "files_reviewed": 12,
    "total_issues": 11,
    "critical": 1,
    "high": 2,
    "medium": 5,
    "low": 3
  },
  "findings": [
    {
      "file": "src/api/auth.py",
      "line": 45,
      "severity": "critical",
      "category": "security",
      "issue": "Hardcoded API key detected",
      "suggestion": "Use environment variable instead"
    }
  ]
}
```

### Example 2: Review Specific Files

**User:** "Check src/utils.py and src/helpers.py for issues"

**Agent:** Reviews only the specified files and returns findings.

## Output Format

```json
{
  "summary": {
    "files_reviewed": "<count>",
    "total_issues": "<count>",
    "critical": "<count>",
    "high": "<count>",
    "medium": "<count>",
    "low": "<count>"
  },
  "findings": [
    {
      "file": "<path>",
      "line": "<number>",
      "severity": "critical|high|medium|low",
      "category": "security|quality|style",
      "issue": "<description>",
      "suggestion": "<fix>"
    }
  ],
  "metadata": {
    "reviewed_at": "<timestamp>",
    "excluded_patterns": ["**/test_*", "**/*_test.py"]
  }
}
```

## Error Handling

### No Files Found
If no Python files are found:
```json
{
  "status": "no_files",
  "message": "No Python files found in the specified path",
  "searched_path": "<path>"
}
```

### Permission Denied
If files cannot be read:
```json
{
  "status": "partial",
  "message": "Some files could not be read",
  "accessible_files": 10,
  "inaccessible_files": 2
}
```
```

## Step 4: Customize the Agent

### Add More Security Patterns

Edit the agent to add custom security checks:

```markdown
### Phase 3: Security Scan (Enhanced)

Check for additional patterns:
- `eval()` or `exec()` usage
- `pickle.loads()` with untrusted data
- `subprocess.call(shell=True)`
- `os.system()` calls
- JWT without signature verification
```

### Add Custom Rules

Create a rules file `.claude/rules/python-review.yaml`:

```yaml
rules:
  - name: no-print-statements
    pattern: "^\\s*print\\("
    severity: low
    message: "Avoid print statements in production code"
    suggestion: "Use logging module instead"

  - name: no-star-imports
    pattern: "from .+ import \\*"
    severity: medium
    message: "Star imports can cause namespace pollution"
    suggestion: "Import specific names"
```

## Step 5: Test Your Agent

### Dry Run

```bash
python -m scripts.cli dry-run --name "python-code-reviewer"
```

Output:
```
Dry Run: python-code-reviewer
Files to be created:
  - .claude/agents/python-code-reviewer.md (2,450 bytes)
  - .claude/commands/python-code-reviewer.md (320 bytes)
Quality Score: 8.2/10
```

### Test with Sample Code

Create a test file `test_sample.py`:

```python
import os
import sys  # unused

def process_data(items=[]):  # mutable default
    password = "secret123"  # hardcoded secret
    for item in items:
        query = "SELECT * FROM users WHERE id=" + item  # SQL injection
        try:
            execute(query)
        except:  # bare except
            pass
```

Run the agent:
```bash
claude --agent python-code-reviewer "Review test_sample.py"
```

Expected output identifies:
- Unused import (sys)
- Mutable default argument
- Hardcoded credential
- SQL injection vulnerability
- Bare except clause

## Step 6: Install and Use

### Install to Project

```bash
python -m scripts.cli install --scope project --name "python-code-reviewer"
```

### Create Slash Command

The generator also creates `.claude/commands/python-code-reviewer.md`:

```markdown
---
name: review-python
description: Review Python code for issues
---

Review the following Python code for:
- Code quality issues
- Security vulnerabilities
- Style compliance

Target: $ARGUMENTS
```

Usage:
```bash
/review-python src/
```

## Step 7: Version and Share

### Version Your Agent

```bash
python -m scripts.agent_versioning bump \
  .claude/agents/python-code-reviewer.md \
  minor \
  -m "Added JWT security checks"
```

### Export for Sharing

```bash
python -m scripts.agent_export export \
  .claude/agents/python-code-reviewer.md \
  -o python-code-reviewer-v1.1.0.zip \
  --author "Your Name"
```

## Summary

You've created a production-ready code reviewer agent that:

- Uses the prompt-chaining pattern
- Performs multi-phase analysis
- Generates structured reports
- Handles errors gracefully
- Can be versioned and shared

## Next Steps

- Add more security patterns
- Create custom rule sets
- Build a multi-language reviewer (using routing pattern)
- Add an evaluator-optimizer loop for iterative improvement

## Related Tutorials

- [Research Agent Tutorial](tutorial-research-agent.md)
- [Multi-Agent Tutorial](tutorial-multi-agent.md)
- [Best Practices](../references/best-practices.md)
