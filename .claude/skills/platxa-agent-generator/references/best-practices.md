# Agent Best Practices

Comprehensive guidelines for building effective AI agents with Claude Code CLI.

## Agent Definition Structure

### Essential Components

```yaml
---
name: agent-name          # kebab-case, unique identifier
description: Brief desc   # What the agent does (≤1024 chars)
tools: Read, Grep, Glob   # Comma-separated tool list
---

# Agent Name

## Overview
Expanded description of purpose and capabilities.

## Workflow
Step-by-step process the agent follows.

## Examples
Concrete usage examples with expected outcomes.

## Output Format
Structure of agent responses.
```

### Quality Checklist

- [ ] Name is descriptive and follows kebab-case
- [ ] Description clearly states purpose
- [ ] Tools are minimal but sufficient
- [ ] Workflow steps are clear and actionable
- [ ] Examples cover common use cases
- [ ] Output format is specified

## Tool Permission Strategies

### Principle of Least Privilege

Grant only the tools necessary for the task:

| Task Type | Recommended Tools |
|-----------|-------------------|
| Read-only analysis | Read, Grep, Glob |
| Code modification | Read, Write, Edit, Grep, Glob |
| System operations | Read, Bash, Grep, Glob |
| Research | Read, WebSearch, WebFetch |
| Multi-agent | Task + above as needed |

### Tool Categories

**File Operations:**
- `Read` - Read file contents
- `Write` - Create/overwrite files
- `Edit` - Modify existing files
- `Glob` - Find files by pattern
- `Grep` - Search file contents

**System Operations:**
- `Bash` - Execute shell commands

**Web Operations:**
- `WebSearch` - Search the internet
- `WebFetch` - Fetch web page content

**Agent Operations:**
- `Task` - Spawn subagents

## Error Handling Patterns

### Graceful Degradation

```markdown
## Error Handling

### File Not Found
- Check alternative locations
- Ask user for correct path
- Continue with partial results

### Permission Denied
- Report the limitation
- Suggest manual action
- Continue with accessible files

### Network Failure
- Retry once after delay
- Use cached results if available
- Report the limitation

### Tool Failure
- Log the error with context
- Try alternative approach
- Fail gracefully with clear message
```

### Error Response Format

```json
{
  "status": "error",
  "error_type": "file_not_found",
  "message": "Could not find config.yaml",
  "attempted_paths": ["./config.yaml", "../config.yaml"],
  "suggestions": ["Create config.yaml", "Specify path explicitly"],
  "partial_results": {...}
}
```

## Security Considerations

### Input Validation

```markdown
## Security

### Input Validation
- Sanitize file paths (no traversal)
- Validate user-provided patterns
- Reject obviously malicious input
- Limit scope to project directory

### Sensitive Data
- Never log credentials
- Redact secrets in output
- Warn on credential detection
- Use environment variables
```

### Safe Defaults

- Read-only by default
- No network access unless needed
- No shell execution unless necessary
- Explicit user confirmation for destructive actions

### Output Sanitization

```python
# Redact sensitive patterns
SENSITIVE_PATTERNS = [
    r'password\s*=\s*["\'].*["\']',
    r'api[_-]?key\s*=\s*["\'].*["\']',
    r'secret\s*=\s*["\'].*["\']',
]

def sanitize_output(text: str) -> str:
    for pattern in SENSITIVE_PATTERNS:
        text = re.sub(pattern, '[REDACTED]', text)
    return text
```

## Testing Approaches

### Unit Testing

Test individual agent components:

```python
def test_agent_classification():
    """Test that agent correctly classifies input."""
    result = classify_request("Review this PR")
    assert result.category == "code-review"
    assert result.confidence >= 0.8

def test_workflow_step():
    """Test a single workflow step."""
    input_data = {"file": "test.py"}
    result = analyze_file(input_data)
    assert result.is_valid
    assert "functions" in result.output
```

### Integration Testing

Test full agent workflows:

```python
def test_code_review_workflow():
    """Test complete code review workflow."""
    agent = CodeReviewerAgent()
    result = agent.run("Review src/utils.py")

    assert result.status == "success"
    assert len(result.findings) > 0
    assert all(f.has_line_number for f in result.findings)
```

### Smoke Testing

Quick validation that agent loads and responds:

```python
def test_agent_responds():
    """Test that agent produces any response."""
    agent = load_agent("code-reviewer")
    response = agent.process("Hello")
    assert response is not None
    assert len(response) > 0
```

## Performance Optimization

### Token Efficiency

- Use concise prompts
- Avoid redundant context
- Summarize long outputs
- Use structured formats

### Latency Reduction

- Parallelize independent operations
- Cache repeated lookups
- Use appropriate model for task
- Minimize tool call round-trips

### Cost Management

- Use cheaper models for simple tasks
- Batch similar operations
- Implement caching strategies
- Monitor and limit iterations

## Documentation Standards

### Inline Documentation

```python
def process_files(
    files: list[str],
    pattern: str | None = None,
) -> ProcessResult:
    """
    Process files matching the given criteria.

    Args:
        files: List of file paths to process
        pattern: Optional glob pattern to filter files

    Returns:
        ProcessResult with status and processed file data

    Raises:
        FileNotFoundError: If no matching files found
        PermissionError: If files cannot be read

    Example:
        >>> result = process_files(["src/*.py"])
        >>> print(result.file_count)
        15
    """
```

### Agent Documentation

Each agent should document:
- Purpose and use cases
- Required inputs
- Expected outputs
- Limitations and edge cases
- Examples with realistic scenarios

## Common Patterns

### Configuration Handling

```markdown
## Configuration

### Sources (priority order)
1. Command-line arguments
2. Environment variables
3. Project config file (.claude/config.yaml)
4. User config file (~/.claude/config.yaml)
5. Default values

### Example Config
```yaml
agent:
  max_iterations: 5
  timeout_seconds: 300
  verbose: false
```
```

### Progress Reporting

```markdown
## Progress Updates

Report after each major step:
- What was completed
- Key findings/results
- What comes next
- Estimated remaining work
```

### Result Aggregation

```python
def aggregate_results(results: list[StepResult]) -> FinalResult:
    """Combine results from multiple steps/workers."""
    return FinalResult(
        status="success" if all(r.success for r in results) else "partial",
        findings=deduplicate(chain(r.findings for r in results)),
        summary=synthesize_summary(results),
        metadata={
            "steps_completed": len([r for r in results if r.success]),
            "steps_failed": len([r for r in results if not r.success]),
        }
    )
```

## Anti-Patterns to Avoid

### Over-Engineering

❌ Complex multi-agent system for simple task
✅ Use simplest pattern that works

### Under-Specification

❌ Vague instructions hoping AI figures it out
✅ Clear, specific workflow with examples

### No Error Handling

❌ Assume everything succeeds
✅ Handle failures gracefully at each step

### Unbounded Operations

❌ Process unlimited files/iterations
✅ Set reasonable limits with clear termination

### Security Blindness

❌ Trust all inputs, expose all outputs
✅ Validate inputs, sanitize outputs

## Quality Scoring

### Criteria

| Category | Weight | Description |
|----------|--------|-------------|
| Clarity | 20% | Is the purpose clear? |
| Completeness | 20% | Are all components present? |
| Tool Design | 20% | Are tools appropriate? |
| Examples | 15% | Are examples realistic? |
| Security | 15% | Are security concerns addressed? |
| Documentation | 10% | Is it well documented? |

### Score Interpretation

- **9-10**: Excellent, production-ready
- **7-8**: Good, minor improvements possible
- **5-6**: Acceptable, needs work
- **3-4**: Poor, significant issues
- **1-2**: Unusable, fundamental problems

**Minimum acceptable score: 7.0**
