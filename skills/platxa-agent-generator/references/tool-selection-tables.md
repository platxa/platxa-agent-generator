# Tool Selection Reference Tables

Lookup tables for selecting Claude Code tools based on agent type, domain, and
capabilities. The architecture-subagent consults these when defining tool
permissions (Step 4 of its workflow).

## Available Tools

| Tool | Purpose |
|------|---------|
| Read | Read file contents |
| Write | Create new files |
| Edit | Modify existing files |
| Glob | Find files by pattern |
| Grep | Search file contents |
| Bash | Execute shell commands |
| WebSearch | Search the web |
| WebFetch | Fetch web page content |
| Task | Spawn subagent workers |
| AskUserQuestion | Ask user for input |
| TodoWrite | Track task progress |
| NotebookEdit | Edit Jupyter notebooks |
| LSP | Language server operations |
| Skill | Invoke Claude Code skills |

## Base Tools by Agent Type

| Agent Type | Base Tools |
|------------|------------|
| analyzer | Read, Glob, Grep |
| builder | Read, Write, Edit, Glob |
| automation | Read, Write, Bash, Glob |
| guide | Read, Glob, Grep, AskUserQuestion |
| validator | Read, Glob, Grep |
| orchestrator | Read, Glob, Grep, Task |

## Domain-Specific Tool Additions

| Domain | Additional Tools |
|--------|-----------------|
| security | Grep |
| documentation | Write, Edit |
| testing | Bash |
| code-review | Grep, LSP |
| refactoring | Edit, LSP |
| deployment | Bash |
| web | WebFetch, WebSearch |
| web-scraping | WebFetch |
| research | WebSearch, WebFetch |
| data-analysis | NotebookEdit, Bash |
| api | WebFetch |
| devops | Bash |
| data | NotebookEdit |

## Least-Privilege Rules

1. **Read-only agents** (analyzer, validator) never get Write, Edit, Bash, or NotebookEdit.
2. **Prefer Edit over Write** unless the purpose requires creating new files (keywords: create, generate, produce, scaffold, new file, new module, initialize, bootstrap).
3. **Remove Bash** unless the purpose explicitly requires shell execution (keywords: execute, run, command, script, install, build, test, deploy, compile, shell, terminal, process, pip, npm, git).
4. **Preserve dependencies**: Edit requires Read.

## Dangerous Combinations

| Combination | Warning |
|-------------|---------|
| Bash + WebFetch | Downloading and executing code can be dangerous |
| Write + Bash | Creating and executing files requires careful validation |
| Edit + Glob | Mass editing files can cause unintended changes |

## Tool Categories

| Category | Tools |
|----------|-------|
| file_read | Read, Glob, Grep |
| file_write | Write, Edit |
| file_all | Read, Write, Edit, Glob, Grep |
| search | Glob, Grep |
| web | WebSearch, WebFetch |
| shell | Bash |
| coordination | Task, TodoWrite |
| interaction | AskUserQuestion |
