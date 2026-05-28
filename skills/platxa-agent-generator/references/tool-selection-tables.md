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

## Capability Keyword → Tool Mapping

When the agent purpose contains these keywords, add the corresponding tools:

| Keywords | Tools |
|----------|-------|
| read, examine | Read |
| analyze | Read, Grep |
| scan | Glob, Grep |
| search, find, locate | Glob, Grep |
| discover | Glob |
| create, generate, produce, write, output | Write |
| modify, update, change, fix, refactor, transform | Edit |
| execute, run, command, script, install, build, test, deploy | Bash |
| fetch, download | WebFetch |
| web | WebSearch, WebFetch |
| internet, online, lookup | WebSearch |
| coordinate, orchestrate, delegate, spawn, parallel, worker | Task |
| ask, prompt, clarify, confirm | AskUserQuestion |
| track, progress, checklist | TodoWrite |

## Dangerous Combinations

| Combination | Warning |
|-------------|---------|
| Bash + WebFetch | Downloading and executing code can be dangerous |
| Write + Bash | Creating and executing files requires careful validation |
| Edit + Glob | Mass editing files can cause unintended changes |

## Tool Dependencies

When a tool is selected, also include any tools listed as its dependencies.
This matches the runtime behaviour previously enforced by `tool_selector.py`
(deleted in feature #8 / commit `be79d6d0`).

| Tool | Required Dependencies |
|------|------------------------|
| Edit | Read (must read a file before editing it) |
| Write | Read (should typically read surrounding context first) |

Dependencies are added even when the agent purpose did not explicitly imply
them. Mark them with the reason `"Dependency of <tool>"` in the selection
output.

## Selection Algorithm

The architecture-subagent walks this 8-step algorithm in order. Each step
either adds tools to a working set or removes/replaces them; steps never
reorder earlier decisions except where explicitly noted.

1. **Base tools by agent type** — look up `Base Tools by Agent Type` for
   the resolved agent type (`analyzer`, `builder`, `automation`, `guide`,
   `validator`, `orchestrator`). Default to `[Read, Glob, Grep]` for an
   unknown type.
2. **Recommended base** — merge any tools from the discovery output's
   `tool_patterns.recommended_base` field that aren't already included.
   Mark them with reason `"Recommended by existing agent patterns"`.
3. **Domain additions** — if a domain is given, append tools from
   `Domain-Specific Tool Additions` for that domain.
4. **Purpose keywords** — tokenize the agent purpose, lowercase, and look
   each token up in `Capability Keyword → Tool Mapping`. Add any implied
   tools that aren't already in the set.
5. **Capability keywords** — repeat step 4 for each entry in the
   `capabilities` list (when the input provides one).
6. **Explicit tools** — add tools the user listed by name. Warn if a name
   is not in `Available Tools`.
7. **Tool dependencies** — for every tool currently selected, add any
   entries from `Tool Dependencies`.
8. **Least-privilege enforcement** — apply `Least-Privilege Rules` to
   remove or substitute tools (read-only types lose Write/Edit/Bash/
   NotebookEdit; Write is replaced with Edit unless the purpose contains a
   write-justification keyword; Bash is removed unless the purpose
   contains a shell-justification keyword). Then check the result against
   `Dangerous Combinations` and emit a warning per match — do **not**
   remove the tools; the warning surfaces in the architecture blueprint.

After step 8, sort the final tool list using this canonical order so
generated agent definitions are stable:

```
Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, Task,
AskUserQuestion, TodoWrite, NotebookEdit, LSP
```

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
| notebook | NotebookEdit |
| code_intelligence | LSP |
| skill_invocation | Skill |
