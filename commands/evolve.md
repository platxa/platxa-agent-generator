---
description: Evaluate instincts for promotion eligibility and optionally write promoted artifacts
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
argument-hint: "[--dry-run] [--threshold N] [--min-occurrences N] [--target skill|command|agent|template|all]"
---

# Evolve — Promotion Gate Evaluation

Evaluate instincts against promotion thresholds and promote eligible candidates into reusable artifacts (skills, commands, agents, or templates).

## Arguments

Parse the following flags from `$ARGUMENTS`:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--dry-run` | boolean | false | List eligible candidates without writing artifacts |
| `--threshold` | float | 0.7 | Confidence threshold override |
| `--min-occurrences` | int | 3 | Minimum occurrences threshold override |
| `--target` | enum | all | Filter: `skill`, `command`, `agent`, `template`, or `all` |

## Execution

Run the promotion gate evaluation via the CLI:

```
platxa-agent evolve $ARGUMENTS
```

If `platxa-agent` is not on PATH, fall back to:

```
python -m platxa_agent_generator evolve $ARGUMENTS
```

Always append `--json` to the CLI invocation for structured output parsing.

## Workflow

1. **Run evaluation**: Execute `platxa-agent evolve --json $ARGUMENTS` and capture output
2. **Parse results**: Read the JSON response containing `candidates`, `total_evaluated`, `eligible`, and `thresholds`
3. **Report**: Present a summary table of eligible instincts with name, confidence, occurrences, and success count
4. **If NOT --dry-run AND candidates exist**:
   - For each eligible candidate, read the instinct file content
   - Use the `promotion_engine` classification to determine target type
   - Write the promoted artifact to the appropriate location:
     - `skill` → `skills/<name>/SKILL.md`
     - `command` → `commands/<name>.md`
     - `agent` → `agents/<name>.md`
     - `template` → `src/platxa_agent_generator/templates/<name>.md`
   - Report what was written

## Output Format

Present results as:

```
## Promotion Gate Results

Evaluated: <N> instincts | Thresholds: confidence>=<T>, occurrences>=<O>, success_count>=<S>
Target filter: <target>

### Eligible Candidates (<count>)

| Name | Confidence | Occurrences | Success Count |
|------|-----------|-------------|---------------|
| ...  | ...       | ...         | ...           |

[If --dry-run]: No artifacts written (dry run mode).
[If not --dry-run]: Wrote <N> artifacts.
```
