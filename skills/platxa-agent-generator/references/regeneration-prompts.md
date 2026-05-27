# Regeneration Prompt Reference

Templates for building targeted regeneration prompts from evaluation
findings. The team-lead agent uses these to construct per-axis feedback
when an iteration receives ITERATE from the GAN evaluator.

## Prompt Structure

```markdown
## Prior iteration findings to address

### {axis_name} — {SEVERITY} ({tier})

- {finding_summary} ({location})
- {finding_summary} ({location})

**Suggestion:** {action_from_rubric}

### {axis_name} — {SEVERITY} ({tier})

- {finding_summary} ({location})

**Suggestion:** {action_from_rubric}
```

## Severity Ordering

Findings are grouped by tier and sorted by severity within each tier:

| Order | Severity | Tier Label |
|-------|----------|------------|
| 0 | CRITICAL | BLOCKING |
| 1 | HIGH | BLOCKING |
| 2 | MEDIUM | WARNING |
| 3 | LOW | WARNING |

## Tier Labels

| Tier | Severities | Meaning |
|------|-----------|---------|
| BLOCKING | critical, high | Must fix before generation can pass |
| WARNING | medium, low | Should fix for quality improvement |

## Finding Fields

Each finding in the regeneration prompt contains:

| Field | Description |
|-------|-------------|
| axis | Evaluation axis (correctness, robustness, craft, etc.) |
| severity | CRITICAL / HIGH / MEDIUM / LOW |
| summary | One-line description of the issue |
| location | Where in the agent file (e.g., `frontmatter:tools`, `## Workflow:step3`) |

## Suggestion Derivation

The suggestion line pulls from the evaluation rubric criteria for the
failing axis:

```
**Suggestion:** Ensure: {criteria_description_from_rubric}.
```

Source of truth for criteria: `src/platxa_agent_generator/templates/evaluation-criteria.yaml`

## Rendering Rules

1. Group findings by axis
2. Sort axes by their highest-severity finding (CRITICAL first)
3. Within each axis block, list findings in severity order
4. Include location in parentheses after each finding
5. End each axis block with the **Suggestion** line
6. Separate axis blocks with a blank line

## Example Output

```markdown
## Prior iteration findings to address

### correctness — CRITICAL (BLOCKING)

- Agent references non-existent tool "WebCrawl" (frontmatter:tools)
- Workflow step 3 has no error handling path (## Workflow:step3)

**Suggestion:** Ensure: all tool references resolve to valid Claude Code tools; workflow steps include failure recovery.

### craft — MEDIUM (WARNING)

- Agent description exceeds 1024 character limit (frontmatter:description)

**Suggestion:** Ensure: frontmatter fields conform to schema constraints.
```
