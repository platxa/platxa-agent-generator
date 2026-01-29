# Routing Pattern

Classification-based dispatch where input is analyzed and routed to specialized handlers.

## When to Use

- **Distinct input categories**: Different inputs need different handling
- **Specialized handlers**: Each category has optimized processing
- **Clear classification**: Inputs can be reliably categorized
- **Efficiency matters**: Avoid running all handlers for every input

## Pattern Structure

```
                    ┌─────────────┐
                    │   Router    │
                    │ (Classify)  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Handler A  │  │ Handler B  │  │ Handler C  │
    │ (Type A)   │  │ (Type B)   │  │ (Type C)   │
    └────────────┘  └────────────┘  └────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Output    │
                    └─────────────┘
```

## Implementation

### Router Agent

```yaml
---
name: request-router
description: Routes requests to specialized handlers based on classification
tools: Read, Grep, Task
---

# Request Router

## Classification Rules

1. **Code Review** → code-reviewer agent
   - Keywords: "review", "check", "audit"
   - File types: .py, .js, .ts

2. **Documentation** → documentation-agent
   - Keywords: "document", "readme", "docstring"
   - File types: .md, .rst

3. **Testing** → test-writer agent
   - Keywords: "test", "coverage", "spec"
   - Patterns: test_*, *_test.py

4. **Research** → research-agent
   - Keywords: "find", "search", "compare"
   - No specific files

## Workflow

### 1. Analyze Request
- Extract keywords and intent
- Identify mentioned files/paths
- Detect implicit category

### 2. Classify
- Match against classification rules
- Assign confidence score
- Handle ambiguous cases

### 3. Route
- Spawn appropriate handler via Task tool
- Pass relevant context
- Await result

### 4. Return
- Format handler output
- Add routing metadata if verbose
```

## Classification Strategies

### Keyword-Based

```python
CLASSIFICATION_RULES = {
    "code-review": ["review", "check", "audit", "pr"],
    "testing": ["test", "coverage", "spec", "unit"],
    "documentation": ["document", "readme", "docs"],
    "research": ["find", "search", "compare", "analyze"],
}
```

### LLM-Based

```markdown
Classify the following request into one of these categories:
- code-review: Code quality and bug checking
- testing: Test creation and coverage
- documentation: Documentation generation
- research: Information gathering

Request: {user_request}

Classification:
```

### Hybrid

1. Try keyword matching first (fast)
2. Fall back to LLM classification (accurate)
3. Use confidence thresholds

## Example: Support Ticket Router

```markdown
---
name: ticket-router
description: Routes support tickets to appropriate teams
tools: Read, Task
---

# Support Ticket Router

## Categories

### Technical Issues
- Keywords: error, bug, crash, not working
- Handler: technical-support agent
- Priority: Based on severity keywords

### Billing Questions
- Keywords: charge, invoice, payment, subscription
- Handler: billing-support agent
- Priority: Normal

### Feature Requests
- Keywords: wish, would be nice, suggestion, could you add
- Handler: feature-request agent
- Priority: Low

### Account Issues
- Keywords: login, password, access, permission
- Handler: account-support agent
- Priority: High (security-related)

## Ambiguity Handling

When classification is unclear:
1. Ask clarifying question
2. Route to general-support with context
3. Flag for human review
```

## Advantages

1. **Specialization**: Each handler optimized for its category
2. **Efficiency**: Only relevant processing runs
3. **Scalability**: Easy to add new categories
4. **Maintainability**: Handlers are independent

## Disadvantages

1. **Classification errors**: Wrong routing = wrong handling
2. **Edge cases**: Some inputs don't fit categories
3. **Overhead**: Classification step adds latency
4. **Rigid categories**: Hard to handle novel inputs

## Best Practices

### 1. Clear Categories

Categories should be:
- Mutually exclusive when possible
- Comprehensive (cover all expected inputs)
- Well-defined with examples

### 2. Confidence Scoring

```markdown
### Classification Output

- Category: {category}
- Confidence: {high|medium|low}
- Reasoning: {brief explanation}

If confidence is low, consider:
- Asking for clarification
- Using default handler
- Human escalation
```

### 3. Fallback Handling

```markdown
### Default Handler

When no category matches with high confidence:
1. Log the unclassified request
2. Use general-purpose handler
3. Learn from outcomes to improve classification
```

### 4. Multi-Label Support

Some inputs may need multiple handlers:

```markdown
### Multi-Category Routing

If request spans categories:
1. Identify primary category
2. Note secondary categories
3. Route to primary, mention secondary aspects
4. Or: parallel route to multiple handlers
```

## Anti-Patterns

### Too Many Categories

❌ **Bad**: 20+ fine-grained categories
✅ **Good**: 3-7 clear categories with subcategories

### Overlapping Categories

❌ **Bad**: "Bug fixing" and "Code review" both handle bugs
✅ **Good**: Clear boundaries, one owner per input type

### No Default

❌ **Bad**: Fails on unclassified input
✅ **Good**: Always has fallback handling

## Comparison with Other Patterns

| Aspect | Routing | Prompt Chaining | Parallelization |
|--------|---------|-----------------|-----------------|
| Input handling | Classified | All same | All same |
| Handler count | One selected | All sequential | All concurrent |
| Best for | Varied inputs | Fixed workflow | Independent tasks |

## Template

See [templates/routing.md](../templates/routing.md) for the full generation template.
