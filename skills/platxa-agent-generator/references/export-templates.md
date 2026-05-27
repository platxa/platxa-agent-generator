# Export Templates

Templates for packaging and sharing agents as share bundles or Claude Code
plugins. The generation-subagent uses these when exporting agents via the
Write and Bash tools.

## Package README Template

For share bundles (zip/tar.gz/directory export):

```markdown
# {name}

{description}

## Installation

```bash
claude-agent import {name}-{version}.zip
```

## Details

- **Version**: {version}
- **Author**: {author}
- **License**: {license}

## Required Tools

{tools}

## Files

- `agents/{name}.md`
- `commands/{name}.md`
- `hooks/{name}-*.sh`
```

## Plugin README Template

For Claude Code plugins (`/plugin install`):

```markdown
# {name}

{description}

## Installation

Install via Claude Code's plugin command:

```
/plugin install {name}
```

Or add the plugin directory to a marketplace.

## Details

- **Version**: {version}
- **Author**: {author}
- **License**: {license}
- **Min Claude Code Version**: {min_claude_code_version}

## Required Tools

{tools}

## Files

- `.claude-plugin/plugin.json`
- `agents/{name}.md`
```

## Plugin Directory Structure

| Directory | Purpose | Required |
|-----------|---------|----------|
| `.claude-plugin/` | Plugin manifest directory | Yes |
| `.claude-plugin/plugin.json` | Marketplace metadata (gate-required) | Yes |
| `agents/` | Agent definition `.md` files | Yes (at least one) |
| `commands/` | Slash command `.md` files | No |
| `hooks/` | Hook scripts and `hooks.json` | Yes (`hooks.json` always present) |
| `hooks/hooks.json` | Hook event configuration | Yes (empty `{}` when no hooks) |
| `scripts/` | Helper scripts | No |
| `README.md` | Plugin documentation | Yes |

## Share Bundle Structure

| Directory | Purpose |
|-----------|---------|
| `agents/` | Agent definition `.md` files |
| `commands/` | Slash command `.md` files |
| `hooks/` | Hook scripts |
| `scripts/` | Helper scripts |
| `versions/` | Version history JSON |
| `config/` | Project-root configs (`.mcp.json`) |
| `manifest.json` | Package metadata |
| `README.md` | Package documentation |

## Sensitive Pattern Regexes

Content sanitization patterns applied during export:

| Pattern | What It Catches |
|---------|----------------|
| `api[_-]?key\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+` | API keys |
| `secret\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+` | Secrets |
| `password\s*[:=]\s*[\"']?[^\s\"']+` | Passwords |
| `token\s*[:=]\s*[\"']?[a-zA-Z0-9_-]+` | Tokens |
| `AKIA[0-9A-Z]{16}` | AWS access keys |
| `sk-[a-zA-Z0-9]{48}` | OpenAI API keys |

Sanitized values are replaced with `[REDACTED]` when `preserve_placeholders=True`,
or removed entirely when `False`.

## Export Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| `zip` | `.zip` | Sharing via file transfer |
| `tar.gz` | `.tar.gz` | Unix/Linux distribution |
| `directory` | (none) | Local development, plugin layout |

## Manifest Schema (PackageManifest)

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | string | Yes | (agent stem name) |
| `version` | string | Yes | `1.0.0` |
| `description` | string | Yes | `""` |
| `author` | string | No | `""` |
| `license` | string | No | `MIT` |
| `homepage` | string | No | `""` |
| `repository` | string | No | `""` |
| `keywords` | string[] | No | `[]` |
| `tools` | string[] | No | `[]` |
| `dependencies` | string[] | No | `[]` |
| `min_claude_code_version` | string | No | `1.0.0` |
| `created_at` | ISO 8601 | Auto | (generation time) |
| `checksum` | string | Auto | SHA-256 first 32 chars |
| `files` | string[] | Auto | (relative paths) |

## Plugin Manifest Schema (plugin.json)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Plugin identifier |
| `version` | string | Yes | Semver |
| `description` | string | Yes | Marketplace listing text |
| `claudeCodeMinVersion` | string | Yes | Gate field; marketplace refuses install without it |
| `author` | string | No | Omitted when empty (not blank) |
| `license` | string | No | Omitted when empty |
| `homepage` | string | No | Omitted when empty |
| `repository` | string | No | Omitted when empty |
| `keywords` | string[] | No | Marketplace search tags |

## Plugin Hooks Config (hooks.json)

Default: `PostToolUse` with matcher `"*"` for each hook script:

```json
{
  "PostToolUse": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/{script-name}.sh"
        }
      ]
    }
  ]
}
```

`${CLAUDE_PLUGIN_ROOT}` is resolved by Claude Code at runtime to the
installed plugin directory.

## Archive Safety Rules

Extraction validates every member before writing any file:

| Check | Rejects |
|-------|---------|
| Absolute paths | `/etc/...`, `C:\...`, UNC paths |
| Path traversal | `../` components resolving outside destination |
| Symlinks | Symlink members (can re-anchor writes outside dest) |
| Hardlinks | Hardlink members (privilege escalation vector) |
| Device nodes | CHRTYPE, BLKTYPE, FIFOTYPE members |

Validation runs to completion before any extraction; a single malicious
member aborts the whole operation.
