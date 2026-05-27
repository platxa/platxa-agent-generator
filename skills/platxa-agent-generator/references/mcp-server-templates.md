# MCP Server Templates Reference

Pre-defined MCP server configurations and domain-based recommendations. The
generation-subagent uses these templates when generating `.mcp.json` files.

## Server Templates

### stdio Servers

| Server | Command | Args | Env |
|--------|---------|------|-----|
| playwright | `npx` | `@playwright/mcp@latest` | — |
| filesystem | `npx` | `-y @modelcontextprotocol/server-filesystem ${ALLOWED_PATHS}` | — |
| postgres | `npx` | `-y @modelcontextprotocol/server-postgres` | `DATABASE_URL` |
| sqlite | `npx` | `-y @modelcontextprotocol/server-sqlite ${SQLITE_DB_PATH}` | — |
| brave-search | `npx` | `-y @anthropic/mcp-server-brave-search` | `BRAVE_API_KEY` |
| fetch | `npx` | `-y @anthropic/mcp-server-fetch` | — |
| memory | `npx` | `-y @anthropic/mcp-server-memory` | — |
| slack | `npx` | `-y @anthropic/mcp-server-slack` | `SLACK_BOT_TOKEN` |
| google-drive | `npx` | `-y @anthropic/mcp-server-google-drive` | — |
| openai | `npx` | `-y @anthropic/mcp-server-openai` | `OPENAI_API_KEY` |
| repomix | `npx` | `-y repomix --mcp` | — |
| time | `npx` | `-y @anthropic/mcp-server-time` | — |

### HTTP/SSE Servers

| Server | Type | URL | Headers |
|--------|------|-----|---------|
| github | http | `https://api.githubcopilot.com/mcp/` | `Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}` |
| gitlab | http | `https://gitlab.com/api/v4/mcp` | — |
| asana | sse | `https://mcp.asana.com/sse` | — |

## Server Categories

| Category | Servers |
|----------|---------|
| database | postgres, sqlite |
| web | fetch, brave-search |
| devtools | playwright, github, gitlab, repomix |
| productivity | slack, asana, google-drive |
| ai | openai, memory |
| core | filesystem, time, memory |

## Domain-Based Recommendations

| Keywords in Description | Recommended Servers |
|------------------------|---------------------|
| database, sql, query, schema, migration | postgres, sqlite |
| git, github, pr, commit, repo | github |
| web, scrape, crawl, page, url | fetch, brave-search |
| search, find, lookup, research | brave-search |
| filesystem, file, directory, path | filesystem |
| reasoning, thinking, planning | sequential-thinking |
| communication, message, notify | slack |
| codebase, code, project, analyze | repomix |
| memory, remember, context, history | memory |

## Tool Name Patterns

MCP tools follow the naming pattern: `mcp__{server}__{tool}`

### Key Server Tools

| Server | Tools |
|--------|-------|
| filesystem | `read_file`, `read_multiple_files`, `write_file`, `edit_file`, `create_directory`, `list_directory`, `directory_tree`, `move_file`, `search_files`, `get_file_info` |
| playwright | `browser_navigate`, `browser_click`, `browser_snapshot`, `browser_fill_form`, `browser_take_screenshot`, `browser_evaluate` |
| postgres | `query`, `list_tables`, `describe_table` |
| sqlite | `query`, `list_tables`, `describe_table` |

### Wildcard Pattern

For `allowed-tools` in agent frontmatter: `mcp__{server}__*`

## Output Format

```json
{
  "mcpServers": {
    "{server_name}": {
      "command": "{command}",
      "args": ["{args}"],
      "env": {
        "KEY": "${ENV_VAR}"
      }
    }
  }
}
```

### HTTP Server Format

```json
{
  "mcpServers": {
    "{server_name}": {
      "type": "http",
      "url": "{url}",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
```

## Validation Rules

| Field | Rule |
|-------|------|
| Server name | kebab-case, ≤64 chars |
| URL | must start with `http://` or `https://`; `${ENV}` placeholders allowed |
| Command | must be in safe list: `node`, `npx`, `npm`, `python`, `python3`, `uvx`, `deno`, `bun` or absolute path |
| Env values | use `${VAR}` syntax for environment variable references |
