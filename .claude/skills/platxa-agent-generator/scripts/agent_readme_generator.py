"""Generate a human-readable README.md for a directory of deployed agents.

Given a ``.claude/agents/`` directory full of agent definition files (each
a Markdown file with YAML frontmatter), produce a single README.md that
makes it easy for a human operator to see:

1. Every agent that ships with the project, in a sortable Markdown table
   (name | description | tools).
2. A usage example for each agent — either the first ``## Example``
   section from the agent body, or a synthesized Task-tool snippet when
   the agent file doesn't include one.

Public surface:

- :class:`AgentSummary` — one parsed agent's README-relevant fields
- :func:`scan_agents` — walk a directory → list[AgentSummary]
- :func:`format_readme` — render summaries as Markdown
- :func:`generate_agent_readme` — scan + format + write

Kept deliberately small: README generation is a read-only survey of an
already-generated ``.claude/agents/`` tree. It does not mutate the
agent files or regenerate their frontmatter — that's what
``agent_generator.py`` is for.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    from .syntax_validator import parse_frontmatter
except ImportError:
    from syntax_validator import parse_frontmatter  # type: ignore[import-not-found,no-redef]


# Default directory the scanner looks in. Matches
# batch_generator.DEFAULT_BATCH_OUTPUT_DIR and the agent_export conventions
# so all tooling agrees on where deployed agents live.
DEFAULT_AGENTS_DIR: str = ".claude/agents"

# Default filename for the generated README. Lives alongside the agents
# it documents so a project reader can discover the agent catalogue
# from the same directory as the agent definitions.
DEFAULT_README_FILENAME: str = "README.md"

# Heading that delimits a usage example inside an agent body. Any of
# these headings counts; the first match wins. Order matters — more
# specific headings come first.
EXAMPLE_SECTION_HEADINGS: tuple[str, ...] = (
    "## Usage Example",
    "## Example",
    "## Examples",
    "### Example",
)


@dataclass
class AgentSummary:
    """A single agent's README-relevant fields.

    Attributes:
        name: Agent name from frontmatter ``name:`` field. Used as the
            table row key and as the per-agent section heading.
        description: Agent description from frontmatter ``description:``
            field. Rendered verbatim into the table and the detail
            section. Empty string if the field was absent or blank.
        tools: Tools declared in the frontmatter ``tools:`` field,
            split on commas and stripped. Order is preserved so the
            README reads the same as the source file.
        usage_example: Markdown snippet extracted from the agent body
            (the first ``## Example`` section, if any) or a synthesized
            ``Task(...)`` snippet when the agent file doesn't ship an
            example. Either way it's already Markdown-safe; the caller
            does not escape it further.
        source_path: Absolute path to the agent file, useful in error
            messages and test assertions.
    """

    name: str
    description: str = ""
    tools: list[str] = field(default_factory=list)
    usage_example: str = ""
    source_path: str = ""


def _split_tools(raw: str) -> list[str]:
    """Split a comma-separated tools string, trimming and dropping empties.

    The frontmatter stores tools as ``Read, Write, Bash`` (a single
    string). The README reproduces that ordering so operators see the
    same surface the agent exposes at runtime.
    """
    if not raw:
        return []
    return [tool.strip() for tool in raw.split(",") if tool.strip()]


def _extract_example(body: str, agent_name: str) -> str:
    """Return a usage example for ``agent_name`` derived from ``body``.

    Strategy:

    1. Scan ``body`` for any of :data:`EXAMPLE_SECTION_HEADINGS`. If one
       is found, return all lines from that heading down to the next
       top-level (``## `` or ``# ``) heading or end of body, whichever
       comes first. The heading itself is dropped; the README will
       supply its own section heading.
    2. If no example section is present, synthesize a minimal snippet
       showing how to dispatch the agent via the Task tool. This is
       intentionally generic — the agent's own documentation should
       still be the authoritative reference.

    The synthesized snippet uses fenced code blocks so the README
    renders cleanly on GitHub / in IDEs.
    """
    headings_pattern = "|".join(re.escape(h) for h in EXAMPLE_SECTION_HEADINGS)
    match = re.search(
        rf"^({headings_pattern})\s*$",
        body,
        flags=re.MULTILINE,
    )
    if match:
        start = match.end()
        remainder = body[start:]
        # Stop at the next top-level heading (either ## or #, not ###+).
        stop = re.search(r"^(#{1,2})\s", remainder, flags=re.MULTILINE)
        extracted = remainder[: stop.start()] if stop else remainder
        extracted = extracted.strip()
        if extracted:
            return extracted

    return (
        "```python\n"
        f'Task(subagent_type="{agent_name}",\n'
        '     description="...",\n'
        '     prompt="...")\n'
        "```"
    )


def _parse_agent_file(path: Path) -> AgentSummary | None:
    """Parse a single agent file into an :class:`AgentSummary`.

    Returns ``None`` when the file has no parseable frontmatter or no
    ``name`` field. Callers skip these rather than failing the whole
    scan — a malformed agent file should not block README generation
    for the rest of the catalogue.
    """
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return None

    frontmatter, _errors, end_line, _raw = parse_frontmatter(content)
    if frontmatter is None or "name" not in frontmatter:
        return None

    body_lines = content.split("\n")[end_line:]
    body = "\n".join(body_lines)

    name = str(frontmatter.get("name", "")).strip()
    if not name:
        return None

    description = str(frontmatter.get("description", "")).strip()
    tools = _split_tools(str(frontmatter.get("tools", "")))
    usage_example = _extract_example(body, name)

    return AgentSummary(
        name=name,
        description=description,
        tools=tools,
        usage_example=usage_example,
        source_path=str(path),
    )


def scan_agents(agents_dir: Path | str = DEFAULT_AGENTS_DIR) -> list[AgentSummary]:
    """Walk ``agents_dir`` and return one :class:`AgentSummary` per parseable file.

    Only ``*.md`` files are considered; any file without parseable
    frontmatter is skipped (see :func:`_parse_agent_file`). Results are
    sorted alphabetically by agent name so the generated README is
    stable across runs (important for diff review and CI).

    A missing or empty directory returns an empty list — the caller
    decides whether that's a configuration error or just a project
    with no agents yet.

    Surfaces any skipped agent files as a single stderr summary line at
    end of scan (``skipped N malformed agents: <paths>``). The returned
    list still omits malformed entries — the stderr line is purely
    additive so operators can diagnose why an expected agent didn't
    appear in the generated README. The project's ``README.md`` output
    is an artifact, not an agent, and is not counted as malformed.
    Silent on stderr when every file parses cleanly.
    """
    path = Path(agents_dir)
    if not path.exists() or not path.is_dir():
        return []

    summaries: list[AgentSummary] = []
    skipped: list[Path] = []
    for file in sorted(path.glob("*.md")):
        # Skip the README itself if it happens to live in the agents
        # directory — it's an output, not an agent definition.
        if file.name == DEFAULT_README_FILENAME:
            continue
        parsed = _parse_agent_file(file)
        if parsed is not None:
            summaries.append(parsed)
        else:
            skipped.append(file)
    summaries.sort(key=lambda a: a.name)
    if skipped:
        paths = ", ".join(str(p) for p in skipped)
        print(
            f"skipped {len(skipped)} malformed agents: {paths}",
            file=sys.stderr,
        )
    return summaries


def _escape_table_cell(text: str) -> str:
    """Escape characters that would break a Markdown table cell.

    Pipes and newlines are the two offenders — a raw ``|`` closes the
    cell early, and a newline breaks the row layout. We replace pipes
    with the HTML entity and collapse newlines to spaces so the cell
    stays on one line.
    """
    return text.replace("|", "\\|").replace("\r\n", " ").replace("\n", " ")


def format_readme(
    summaries: list[AgentSummary],
    title: str = "Agents",
) -> str:
    """Render a list of summaries as a Markdown README.

    Structure:

    - ``# {title}``
    - One-line count summary
    - ``## Agent Catalogue`` — table with columns Name | Description | Tools
    - ``## Agent Details`` — one subsection per agent with the
      description repeated (for anchor linking) and the usage example

    The table + detail layout lets readers either scan the catalogue
    at a glance (table) or drill into a specific agent (details).

    An empty ``summaries`` list still produces a valid README — just
    with a "No agents found." notice — so the caller can use this
    function in CI as a regression check without special-casing the
    zero-agent path.
    """
    lines: list[str] = [f"# {title}", ""]

    if not summaries:
        lines.extend(
            [
                "No agents found.",
                "",
                f"Populate `{DEFAULT_AGENTS_DIR}/` with agent definitions and re-run "
                "README generation.",
                "",
            ]
        )
        return "\n".join(lines)

    lines.extend(
        [
            f"This project ships **{len(summaries)}** agent{'s' if len(summaries) != 1 else ''}.",
            "",
            "## Agent Catalogue",
            "",
            "| Name | Description | Tools |",
            "| --- | --- | --- |",
        ]
    )
    for agent in summaries:
        tools_cell = ", ".join(agent.tools) if agent.tools else "—"
        lines.append(
            f"| `{_escape_table_cell(agent.name)}` "
            f"| {_escape_table_cell(agent.description)} "
            f"| {_escape_table_cell(tools_cell)} |"
        )

    lines.extend(["", "## Agent Details", ""])
    for agent in summaries:
        lines.extend(
            [
                f"### `{agent.name}`",
                "",
                agent.description or "_(no description provided)_",
                "",
                "**Tools:** " + (", ".join(f"`{t}`" for t in agent.tools) or "_(none)_"),
                "",
                "**Usage:**",
                "",
                agent.usage_example,
                "",
            ]
        )

    return "\n".join(lines)


def generate_agent_readme(
    agents_dir: Path | str = DEFAULT_AGENTS_DIR,
    output_path: Path | str | None = None,
    title: str = "Agents",
) -> Path:
    """Scan ``agents_dir``, format the README, write it, and return the path.

    ``output_path`` defaults to ``<agents_dir>/README.md`` so the
    documentation ends up next to the agents it documents. Callers can
    pass an absolute path to put the README somewhere else (e.g. the
    project root).

    Returns the resolved output path so the caller can log or test
    against it without re-deriving the default.
    """
    agents_path = Path(agents_dir)
    if output_path is None:
        resolved_output = agents_path / DEFAULT_README_FILENAME
    else:
        resolved_output = Path(output_path)

    summaries = scan_agents(agents_path)
    content = format_readme(summaries, title=title)

    resolved_output.parent.mkdir(parents=True, exist_ok=True)
    resolved_output.write_text(content, encoding="utf-8")
    return resolved_output
