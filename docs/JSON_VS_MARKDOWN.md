# JSON vs Markdown — Format Selection Guide

This project uses both JSON and Markdown for different persistence needs.
This guide captures when to use each and why.

## Decision Matrix

| Criterion | JSON | Markdown |
|-----------|------|----------|
| Primary consumer | Machine (code, queries, aggregation) | Human (model context, documentation) |
| Schema enforcement | Strong (`dataclass.__post_init__`, `json.loads`) | Weak (frontmatter parsing, best-effort) |
| Append pattern | JSONL (one object per line) | Free-form text append |
| Random access | Field-level reads/updates | Full-file read |
| Atomicity | `tempfile + os.replace` (safe) | `tempfile + os.replace` (safe) |
| Context injection | Requires serialization step | Directly injectable as `additionalContext` |
| Diffability | Poor (reformatting noise) | Good (line-level diffs) |
| Nesting | Native (objects, arrays) | Frontmatter only (flat key-value) |

## Examples in This Project

### JSON files

| File | Why JSON |
|------|----------|
| `index.json` (instinct store) | Machine-queried metadata index; needs atomic read-modify-write; field-level access to checksums, paths, timestamps |
| `observations.jsonl` | Machine-consumed log; clustered by `pattern_label`, filtered by `type`; JSONL supports streaming append |
| `.claude/state/current.json` | Complex nested state (checkpoints, generation records); requires `transaction()` with rollback |
| `.claude/feature_list.json` | Structured backlog with stats, dependencies, agent runs; programmatic status updates |
| `evaluation-criteria.yaml` | Schema-validated axis definitions; loaded by `EvaluationRubric.load_default()` at runtime |

### Markdown files

| File | Why Markdown |
|------|-------------|
| `instincts/*.md` | Injected into model context as `additionalContext`; frontmatter for metadata, body for behavioral guidance |
| `claude-progress.txt` | Free-form narrative progress entries; human-readable in session context |
| `agents/*.md` | Agent definitions consumed by Claude Code's native agent system; frontmatter + prose |
| `CLAUDE.md` | Project instructions loaded by Claude Code; must be Markdown |

### Hybrid: YAML frontmatter in Markdown

Instinct files use YAML frontmatter for structured metadata
(`name`, `description`, `confidence`, `usage_count`) with a Markdown
body for free-form content. This gives:

- Machine-queryable metadata (parsed by `parse_frontmatter_safe()`)
- Human-readable body (injected as context)
- Single file per instinct (no JSON sidecar needed)

## Rules of Thumb

1. **If code reads specific fields** → JSON
2. **If a model reads the whole thing** → Markdown
3. **If you need append-only logging** → JSONL
4. **If you need atomic read-modify-write** → JSON with file locking
5. **If it goes into `additionalContext`** → Markdown (or plain text)
6. **If it has >2 levels of nesting** → JSON
7. **If humans review diffs in PRs** → Markdown
