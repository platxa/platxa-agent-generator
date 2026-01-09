# CLI Reference

Complete command-line interface documentation for the Platxa Agent Generator.

## Overview

```bash
python -m scripts.cli <command> [options]
```

## Commands

### generate

Generate a new agent from a description.

```bash
python -m scripts.cli generate [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--description` | `-d` | Agent description | Required |
| `--name` | `-n` | Agent name (kebab-case) | Auto-generated |
| `--pattern` | `-p` | Agent pattern | Auto-detected |
| `--tools` | `-t` | Comma-separated tools | Auto-selected |
| `--output` | `-o` | Output directory | `.claude/agents/` |
| `--dry-run` | | Preview without creating | False |

**Patterns:** `prompt-chaining`, `routing`, `parallelization`, `orchestrator-workers`, `evaluator-optimizer`

**Examples:**

```bash
# Basic generation
python -m scripts.cli generate -d "Review Python code for security issues"

# With specific options
python -m scripts.cli generate \
  -d "Review Python code for security issues" \
  -n "security-reviewer" \
  -p "prompt-chaining" \
  -t "Read,Grep,Glob"

# Dry run
python -m scripts.cli generate -d "..." --dry-run
```

---

### dry-run

Preview agent generation without creating files.

```bash
python -m scripts.cli dry-run [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--name` | `-n` | Agent name to preview |
| `--description` | `-d` | Description to preview |
| `--pattern` | `-p` | Pattern to use |
| `--verbose` | `-v` | Show detailed output |

**Example:**

```bash
python -m scripts.cli dry-run -n "my-agent" -d "Does something useful"
```

**Output:**

```
Dry Run Results
===============
Agent: my-agent
Pattern: prompt-chaining

Files to be created:
  .claude/agents/my-agent.md (1,234 bytes)
  .claude/commands/my-agent.md (256 bytes)

Quality Score: 7.8/10
  - Clarity: 8/10
  - Completeness: 7/10
  - Tool Design: 8/10
  - Examples: 7/10
  - Security: 9/10
  - Documentation: 7/10

Status: PASS (minimum 7.0)
```

---

### install

Install an agent to user or project scope.

```bash
python -m scripts.cli install [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--name` | `-n` | Agent name | Required |
| `--scope` | `-s` | Installation scope | `project` |
| `--source` | | Source directory | `.claude/agents/` |
| `--force` | `-f` | Overwrite existing | False |

**Scopes:**
- `user`: Install to `~/.claude/agents/` (available in all projects)
- `project`: Install to `.claude/agents/` (current project only)

**Example:**

```bash
# Install to project
python -m scripts.cli install -n "my-agent"

# Install to user scope
python -m scripts.cli install -n "my-agent" -s user

# Force overwrite
python -m scripts.cli install -n "my-agent" -f
```

---

### validate

Validate an agent definition.

```bash
python -m scripts.cli validate <agent-path>
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--strict` | | Fail on warnings |
| `--json` | | Output as JSON |

**Example:**

```bash
python -m scripts.cli validate .claude/agents/my-agent.md
```

**Output:**

```
Validation Results
==================
Agent: my-agent
Status: VALID

Checks:
  ✓ Frontmatter present
  ✓ Required fields (name, description, tools)
  ✓ Valid YAML syntax
  ✓ Required sections present
  ✓ No security issues detected

Warnings:
  - Consider adding more examples (currently 1, recommended 2-3)
```

---

### score

Calculate quality score for an agent.

```bash
python -m scripts.cli score <agent-path>
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--detailed` | `-d` | Show detailed breakdown |
| `--json` | | Output as JSON |

**Example:**

```bash
python -m scripts.cli score .claude/agents/my-agent.md --detailed
```

**Output:**

```
Quality Score: 8.2/10
Grade: B+
Status: PASS

Breakdown:
  Clarity:       8.5/10  (20% weight)
  Completeness:  8.0/10  (20% weight)
  Tool Design:   9.0/10  (20% weight)
  Examples:      7.5/10  (15% weight)
  Security:      8.0/10  (15% weight)
  Documentation: 8.0/10  (10% weight)

Suggestions:
  - Add another example showing error handling
  - Consider adding output schema validation
```

---

### catalog

Browse and use pre-built agent templates.

```bash
python -m scripts.cli catalog <subcommand>
```

**Subcommands:**

#### list

List available templates:

```bash
python -m scripts.cli catalog list [--category <category>]
```

**Categories:** `development`, `research`, `automation`, `analysis`

#### show

Show template details:

```bash
python -m scripts.cli catalog show <template-name>
```

#### create

Create agent from template:

```bash
python -m scripts.cli catalog create <template-name> [--name <name>]
```

**Example:**

```bash
# List all templates
python -m scripts.cli catalog list

# List by category
python -m scripts.cli catalog list --category development

# Show template details
python -m scripts.cli catalog show code-reviewer

# Create from template
python -m scripts.cli catalog create code-reviewer --name "my-reviewer"
```

---

### version

Manage agent versions.

```bash
python -m scripts.cli version <subcommand>
```

**Subcommands:**

#### show

Show current version:

```bash
python -m scripts.cli version show <agent-path>
```

#### bump

Bump version number:

```bash
python -m scripts.cli version bump <agent-path> <major|minor|patch> -m "message"
```

#### history

Show version history:

```bash
python -m scripts.cli version history <agent-path>
```

#### changelog

Generate changelog:

```bash
python -m scripts.cli version changelog <agent-path> [--from <version>] [--to <version>]
```

**Example:**

```bash
# Show version
python -m scripts.cli version show .claude/agents/my-agent.md

# Bump minor version
python -m scripts.cli version bump .claude/agents/my-agent.md minor -m "Added new feature"

# View history
python -m scripts.cli version history .claude/agents/my-agent.md
```

---

### export

Export agent for sharing.

```bash
python -m scripts.cli export <agent-path> [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--output` | `-o` | Output path | Auto-generated |
| `--format` | `-f` | Export format | `zip` |
| `--author` | `-a` | Package author | |
| `--no-sanitize` | | Skip sanitization | False |

**Formats:** `zip`, `tar.gz`, `directory`

**Example:**

```bash
# Export as zip
python -m scripts.cli export .claude/agents/my-agent.md -o my-agent.zip

# Export as tar.gz with author
python -m scripts.cli export .claude/agents/my-agent.md \
  -f tar.gz \
  -a "Your Name"
```

---

### import

Import agent from package.

```bash
python -m scripts.cli import <package-path> [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--target` | `-t` | Target directory | Auto |
| `--scope` | `-s` | Installation scope | `project` |
| `--overwrite` | | Overwrite existing | False |
| `--no-validate` | | Skip validation | False |

**Example:**

```bash
# Import to project
python -m scripts.cli import my-agent.zip

# Import to user scope
python -m scripts.cli import my-agent.zip -s user

# Import with overwrite
python -m scripts.cli import my-agent.zip --overwrite
```

---

### compose

Compose multiple agents together.

```bash
python -m scripts.cli compose [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--agents` | `-a` | Comma-separated agent names |
| `--pattern` | `-p` | Composition pattern |
| `--name` | `-n` | Output agent name |
| `--output` | `-o` | Output directory |

**Patterns:** `sequential`, `parallel`, `conditional`, `hierarchical`

**Example:**

```bash
# Sequential composition
python -m scripts.cli compose \
  -a "syntax-checker,security-scanner,style-linter" \
  -p sequential \
  -n "full-code-reviewer"

# Parallel composition
python -m scripts.cli compose \
  -a "js-analyzer,py-analyzer,go-analyzer" \
  -p parallel \
  -n "multi-lang-analyzer"
```

---

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--help` | Show help message |
| `--version` | Show version |
| `--verbose` | Verbose output |
| `--quiet` | Minimal output |
| `--config` | Config file path |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_AGENTS_DIR` | Default agents directory |
| `CLAUDE_QUALITY_THRESHOLD` | Minimum quality score |
| `CLAUDE_DEFAULT_PATTERN` | Default agent pattern |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Validation failed |
| 4 | File not found |
| 5 | Permission denied |

## Configuration File

Create `.claude/agent-generator.yaml`:

```yaml
defaults:
  pattern: prompt-chaining
  quality_threshold: 7.0
  tools:
    - Read
    - Grep
    - Glob

export:
  format: zip
  sanitize: true
  author: "Your Name"

install:
  default_scope: project
  overwrite: false
```
