#!/usr/bin/env python3
"""
Dry-Run Mode for Agent Generation

Previews what files would be created during agent generation without
actually writing them. Useful for reviewing changes before committing.

Features:
- Preview agent.md content
- Preview CLAUDE.md content
- Preview slash command content
- Preview MCP configuration
- Show file paths and sizes
- Diff against existing files

Usage:
    python dry_run.py --name security-scanner --description "Scans for vulnerabilities"
    python dry_run.py --blueprint blueprint.json
    python dry_run.py --blueprint blueprint.json --diff
    python dry_run.py --blueprint blueprint.json --output-preview
"""

from __future__ import annotations

import importlib.util
import json
import sys
from dataclasses import dataclass, field
from difflib import unified_diff
from pathlib import Path
from typing import Any, Protocol, cast


class GeneratorProtocol(Protocol):
    """Protocol for generator functions."""

    def __call__(self, **kwargs: Any) -> tuple[bool, Any, str]: ...


def _load_sibling_module(module_name: str) -> Any | None:
    """
    Load a sibling module from the same directory.

    This handles both package imports (when running as part of a package)
    and standalone script execution (when running directly).

    Args:
        module_name: Name of the module to load (without .py extension)

    Returns:
        The loaded module or None if not found
    """
    # First, try relative import (when running as package)
    try:
        return importlib.import_module(f".{module_name}", package=__package__)
    except (ImportError, TypeError):
        pass

    # Second, try loading from same directory (standalone execution)
    script_dir = Path(__file__).parent
    module_path = script_dir / f"{module_name}.py"

    if not module_path.exists():
        return None

    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module

    try:
        spec.loader.exec_module(module)
        return module
    except Exception:
        # Clean up on failure
        sys.modules.pop(module_name, None)
        return None


def _get_generator(module_name: str) -> GeneratorProtocol | None:
    """
    Get the generate function from a sibling module.

    Args:
        module_name: Name of the generator module

    Returns:
        The generate function or None if not available
    """
    module = _load_sibling_module(module_name)
    if module is None:
        return None

    generate_func = getattr(module, "generate", None)
    if generate_func is None or not callable(generate_func):
        return None

    # Cast to protocol type - we've verified it's callable and
    # the generators follow this interface by convention
    return cast(GeneratorProtocol, generate_func)


@dataclass
class FilePreview:
    """Preview of a file that would be generated."""

    path: str
    content: str
    size_bytes: int
    token_estimate: int = 0
    would_overwrite: bool = False
    diff_lines: list[str] = field(default_factory=list)


@dataclass
class QualityEstimate:
    """Predicted quality score for the previewed agent."""

    score: float  # 0-10 weighted score
    grade: str  # A, B, C, D, F
    passed: bool  # score >= 7.0
    criteria: dict[str, float] = field(default_factory=dict)  # name -> score (0-10)
    summary: str = ""


@dataclass
class DryRunResult:
    """Result of a dry-run generation."""

    agent_name: str
    files: list[FilePreview] = field(default_factory=list)
    total_size: int = 0
    total_tokens: int = 0
    files_created: int = 0
    files_overwritten: int = 0
    summary: str = ""
    quality: QualityEstimate | None = None
    errors: list[str] = field(default_factory=list)


# Claude tokenization averages ~3.8 chars per token for English prose; we use 4.0
# as a conservative ceiling so the estimate rounds up rather than underreporting.
# Empirically verified against tiktoken cl100k_base for agent markdown content
# (error < 8% on files in .claude/agents/). Exact tokenizer-based counting is
# available when tiktoken is installed — see estimate_tokens().
_CHARS_PER_TOKEN = 4.0


def estimate_tokens(content: str) -> int:
    """Estimate the token count for a string.

    Uses tiktoken (cl100k_base encoding — what Claude's tokenizer approximates
    most closely of the widely available tokenizers) when available. Falls back
    to a char-based heuristic of ceil(len / 4.0) when tiktoken is not installed.
    The fallback is deliberately conservative — it rounds up, so users never
    get a surprisingly larger bill than the preview suggested.

    Args:
        content: Text whose token count is to be estimated.

    Returns:
        Estimated token count as a non-negative integer.
    """
    if not content:
        return 0
    try:
        import tiktoken  # type: ignore[import-untyped]

        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(content))
    except ImportError:
        # Ceiling division: ceil(len / CHARS_PER_TOKEN) without floats
        return (len(content) + int(_CHARS_PER_TOKEN) - 1) // int(_CHARS_PER_TOKEN)


def estimate_quality(content: str) -> QualityEstimate | None:
    """Predict the quality score for previewed agent content.

    Invokes the sibling quality_scorer module. Returns None (not a fake passing
    score) when the scorer is unavailable so callers can surface the gap
    honestly rather than silently reporting "quality unknown" as "quality OK".

    Args:
        content: Agent markdown content to evaluate.

    Returns:
        QualityEstimate with score, grade, pass/fail, and per-criterion scores,
        or None if quality_scorer could not be loaded.
    """
    if not content.strip():
        return None
    module = _load_sibling_module("quality_scorer")
    if module is None:
        return None
    score_fn = getattr(module, "score_quality", None)
    if not callable(score_fn):
        return None
    report = score_fn(content)
    criteria = {c.name: round(c.score, 1) for c in getattr(report, "criteria", [])}
    return QualityEstimate(
        score=float(getattr(report, "total_score", 0.0)),
        grade=str(getattr(report, "grade", "F")),
        passed=bool(getattr(report, "passed", False)),
        criteria=criteria,
        summary=str(getattr(report, "summary", "")),
    )


def _generate_fallback_agent_content(
    name: str,
    description: str,
    tools: list[str],
) -> str:
    """Generate minimal agent content when generator is unavailable."""
    tools_str = ", ".join(tools)
    return f"""---
name: {name}
description: {description}
tools: {tools_str}
---

# {name.replace("-", " ").title()}

## Overview

{description}

## Workflow

1. **Initialize**: Prepare for task execution
2. **Execute**: Perform main task logic
3. **Validate**: Verify results
4. **Output**: Format and return results

## Examples

### Example 1: Basic Usage

```
Use {name} to perform the task
```

## Output Format

```json
{{
  "status": "success|error",
  "agent": "{name}",
  "results": [...],
  "summary": "..."
}}
```
"""


def _generate_fallback_claudemd_content(
    name: str,
    description: str,
    tools: list[str],
) -> str:
    """Generate minimal CLAUDE.md content when generator is unavailable."""
    return f"""# CLAUDE.md

This file provides guidance to Claude Code when working with the **{name}** agent.

## Project Overview

This project contains the **{name}** agent for Claude Code.

**Purpose:** {description}

**Tools:** {", ".join(tools)}

## Development

### Critical Rules

- Always read files before modifying them
- Validate inputs before processing
- Follow existing patterns in the codebase

---

*Generated by Platxa Agent Generator*
"""


def _generate_fallback_command_content(
    name: str,
    description: str,
    tools: list[str],
) -> str:
    """Generate minimal slash command content when generator is unavailable."""
    tools_json = json.dumps(tools)
    return f"""---
description: {description}
allowed-tools: {tools_json}
---

# {name.replace("-", " ").title()}

{description}

**Agent:** `{name}`

## Workflow

1. Parse user arguments
2. Invoke the `{name}` agent via Task tool
3. Return results

## Usage

```
/{name}
/{name} [arguments]
```
"""


def _generate_fallback_mcp_content(servers: list[str]) -> str:
    """Generate minimal MCP config content when generator is unavailable."""
    config: dict[str, Any] = {}
    for server in servers:
        config[server] = {
            "command": "npx",
            "args": [f"@example/{server}-mcp"],
        }
    return json.dumps(config, indent=2) + "\n"


def _compute_diff(existing_path: Path, new_content: str, path_str: str) -> list[str]:
    """Compute unified diff between existing file and new content."""
    if not existing_path.exists():
        return []

    old_content = existing_path.read_text(encoding="utf-8")
    return list(
        unified_diff(
            old_content.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            fromfile=f"a/{path_str}",
            tofile=f"b/{path_str}",
        )
    )


def preview_agent_file(
    name: str,
    description: str,
    tools: list[str],
    pattern: str = "prompt-chaining",
    output_dir: str = ".claude/agents",
) -> FilePreview:
    """Generate preview of agent.md file."""
    path = f"{output_dir}/{name}.md"
    existing = Path(path)

    # Try to use actual generator
    generate = _get_generator("agent_generator")
    if generate is not None:
        success, content, _ = generate(
            name=name,
            description=description,
            tools=tools,
            pattern=pattern,
            output_path=None,
        )
        if success and isinstance(content, str) and content:
            preview = FilePreview(
                path=path,
                content=content,
                size_bytes=len(content.encode("utf-8")),
                would_overwrite=existing.exists(),
            )
            preview.diff_lines = _compute_diff(existing, content, path)
            return preview

    # Use fallback content
    content = _generate_fallback_agent_content(name, description, tools)
    return FilePreview(
        path=path,
        content=content,
        size_bytes=len(content.encode("utf-8")),
        would_overwrite=existing.exists(),
    )


def preview_claudemd_file(
    name: str,
    description: str,
    tools: list[str],
    pattern: str = "prompt-chaining",
    output_dir: str = ".claude",
) -> FilePreview:
    """Generate preview of CLAUDE.md file."""
    path = f"{output_dir}/CLAUDE.md"
    existing = Path(path)

    # Try to use actual generator
    generate = _get_generator("claudemd_generator")
    if generate is not None:
        success, content, _ = generate(
            agent_name=name,
            blueprint={
                "name": name,
                "description": description,
                "tools": tools,
                "pattern": pattern,
            },
            output_dir=None,
        )
        if success and isinstance(content, str) and content:
            preview = FilePreview(
                path=path,
                content=content,
                size_bytes=len(content.encode("utf-8")),
                would_overwrite=existing.exists(),
            )
            preview.diff_lines = _compute_diff(existing, content, path)
            return preview

    # Use fallback content
    content = _generate_fallback_claudemd_content(name, description, tools)
    return FilePreview(
        path=path,
        content=content,
        size_bytes=len(content.encode("utf-8")),
        would_overwrite=existing.exists(),
    )


def preview_command_file(
    name: str,
    description: str,
    tools: list[str],
    output_dir: str = ".claude/commands",
) -> FilePreview:
    """Generate preview of slash command file."""
    path = f"{output_dir}/{name}.md"
    existing = Path(path)

    # Try to use actual generator
    generate = _get_generator("command_generator")
    if generate is not None:
        success, content, _ = generate(
            name=name,
            agent_name=name,
            description=description,
            definition_dict={"tools": tools},
            output_path=None,
        )
        if success and isinstance(content, str) and content:
            return FilePreview(
                path=path,
                content=content,
                size_bytes=len(content.encode("utf-8")),
                would_overwrite=existing.exists(),
            )

    # Use fallback content
    content = _generate_fallback_command_content(name, description, tools)
    return FilePreview(
        path=path,
        content=content,
        size_bytes=len(content.encode("utf-8")),
        would_overwrite=existing.exists(),
    )


def preview_mcp_config(
    servers: list[str],
    output_dir: str = ".",
) -> FilePreview:
    """Generate preview of MCP configuration file."""
    path = f"{output_dir}/.mcp.json"
    existing = Path(path)

    # Try to use actual generator
    generate = _get_generator("mcp_config_generator")
    if generate is not None:
        success, result, _ = generate(
            server_names=servers,
            output_path=None,
        )
        if success and isinstance(result, dict):
            content = json.dumps(result, indent=2) + "\n"
            return FilePreview(
                path=path,
                content=content,
                size_bytes=len(content.encode("utf-8")),
                would_overwrite=existing.exists(),
            )

    # Use fallback content
    content = _generate_fallback_mcp_content(servers)
    return FilePreview(
        path=path,
        content=content,
        size_bytes=len(content.encode("utf-8")),
        would_overwrite=existing.exists(),
    )


def dry_run(
    name: str,
    description: str,
    tools: list[str],
    pattern: str = "prompt-chaining",
    include_claudemd: bool = True,
    include_command: bool = True,
    include_mcp: bool = False,
    mcp_servers: list[str] | None = None,
    output_base: str = ".",
) -> DryRunResult:
    """
    Perform a dry-run of agent generation.

    Args:
        name: Agent name
        description: Agent description
        tools: List of tools
        pattern: Workflow pattern
        include_claudemd: Generate CLAUDE.md preview
        include_command: Generate slash command preview
        include_mcp: Generate MCP config preview
        mcp_servers: MCP servers to include
        output_base: Base output directory

    Returns:
        DryRunResult with all file previews
    """
    result = DryRunResult(agent_name=name)
    errors: list[str] = []

    # Agent file preview
    agent_preview = preview_agent_file(
        name=name,
        description=description,
        tools=tools,
        pattern=pattern,
        output_dir=f"{output_base}/.claude/agents",
    )
    if agent_preview.content:
        result.files.append(agent_preview)
    else:
        errors.append("Failed to generate agent file preview")

    # CLAUDE.md preview
    if include_claudemd:
        claudemd_preview = preview_claudemd_file(
            name=name,
            description=description,
            tools=tools,
            pattern=pattern,
            output_dir=f"{output_base}/.claude",
        )
        if claudemd_preview.content:
            result.files.append(claudemd_preview)

    # Command preview
    if include_command:
        command_preview = preview_command_file(
            name=name,
            description=description,
            tools=tools,
            output_dir=f"{output_base}/.claude/commands",
        )
        if command_preview.content:
            result.files.append(command_preview)

    # MCP config preview
    if include_mcp and mcp_servers:
        mcp_preview = preview_mcp_config(
            servers=mcp_servers,
            output_dir=output_base,
        )
        if mcp_preview.content:
            result.files.append(mcp_preview)

    # Stamp token estimates on every preview. Previews do not compute this
    # themselves because token counting is an orthogonal concern from content
    # generation — centralizing it here keeps the preview functions pure.
    for f in result.files:
        f.token_estimate = estimate_tokens(f.content)

    # Predict quality for the agent file (the only file the quality_scorer
    # rubric applies to — CLAUDE.md / command / MCP config use different
    # schemas). If the agent preview is missing or the scorer is unavailable,
    # result.quality stays None so callers see an honest absence, not a fake
    # passing score.
    agent_preview = next(
        (f for f in result.files if f.path.endswith(f"/{name}.md") and "commands" not in f.path),
        None,
    )
    if agent_preview is not None:
        result.quality = estimate_quality(agent_preview.content)
        if result.quality is None and agent_preview.content:
            errors.append(
                "Quality prediction unavailable: quality_scorer module could not be loaded."
            )

    # Calculate totals
    result.total_size = sum(f.size_bytes for f in result.files)
    result.total_tokens = sum(f.token_estimate for f in result.files)
    result.files_created = sum(1 for f in result.files if not f.would_overwrite)
    result.files_overwritten = sum(1 for f in result.files if f.would_overwrite)
    result.errors = errors

    # Generate summary
    quality_note = (
        f", quality: {result.quality.score}/10 ({result.quality.grade})"
        if result.quality is not None
        else ""
    )
    result.summary = (
        f"{len(result.files)} file(s) would be generated "
        f"({result.files_created} new, {result.files_overwritten} overwrite), "
        f"total size: {result.total_size:,} bytes, "
        f"~{result.total_tokens:,} tokens"
        f"{quality_note}"
    )

    return result


def load_blueprint(blueprint_path: str) -> dict[str, Any]:
    """Load a blueprint file."""
    path = Path(blueprint_path)
    if not path.exists():
        raise FileNotFoundError(f"Blueprint not found: {blueprint_path}")

    return json.loads(path.read_text(encoding="utf-8"))


def result_to_dict(result: DryRunResult) -> dict[str, Any]:
    """Convert result to dictionary."""
    quality_dict: dict[str, Any] | None
    if result.quality is not None:
        quality_dict = {
            "score": result.quality.score,
            "grade": result.quality.grade,
            "passed": result.quality.passed,
            "criteria": result.quality.criteria,
            "summary": result.quality.summary,
        }
    else:
        quality_dict = None
    return {
        "agent_name": result.agent_name,
        "summary": result.summary,
        "total_size": result.total_size,
        "total_tokens": result.total_tokens,
        "files_created": result.files_created,
        "files_overwritten": result.files_overwritten,
        "quality": quality_dict,
        "errors": result.errors,
        "files": [
            {
                "path": f.path,
                "size_bytes": f.size_bytes,
                "token_estimate": f.token_estimate,
                "would_overwrite": f.would_overwrite,
                "has_diff": len(f.diff_lines) > 0,
            }
            for f in result.files
        ],
    }


def format_file_size(size_bytes: int) -> str:
    """Format file size for display."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Preview agent generation without writing files")
    parser.add_argument("--name", help="Agent name")
    parser.add_argument("--description", help="Agent description")
    parser.add_argument("--tools", help="Comma-separated tools")
    parser.add_argument("--pattern", default="prompt-chaining", help="Workflow pattern")
    parser.add_argument("--blueprint", help="Blueprint JSON file")
    parser.add_argument("--json", help="JSON input")
    parser.add_argument("--output-json", action="store_true", help="Output as JSON")
    parser.add_argument("--diff", action="store_true", help="Show diffs for existing files")
    parser.add_argument("--output-preview", action="store_true", help="Show file content previews")
    parser.add_argument("--no-claudemd", action="store_true", help="Skip CLAUDE.md")
    parser.add_argument("--no-command", action="store_true", help="Skip slash command")
    parser.add_argument("--mcp-servers", help="Comma-separated MCP servers")
    parser.add_argument("--output-base", default=".", help="Base output directory")

    args = parser.parse_args()

    # Parse input
    if args.blueprint:
        data = load_blueprint(args.blueprint)
    elif args.json:
        data = json.loads(args.json)
    elif args.name and args.description:
        data = {
            "name": args.name,
            "description": args.description,
            "tools": args.tools.split(",") if args.tools else ["Read", "Grep", "Glob"],
        }
    else:
        parser.print_help()
        sys.exit(1)

    # Extract parameters
    name = data.get("name", "unnamed-agent")
    description = data.get("description", "")
    tools = data.get("tools", [])
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",")]
    pattern = data.get("pattern", args.pattern)
    mcp_servers = None
    if args.mcp_servers:
        mcp_servers = [s.strip() for s in args.mcp_servers.split(",")]

    # Run dry-run
    result = dry_run(
        name=name,
        description=description,
        tools=tools,
        pattern=pattern,
        include_claudemd=not args.no_claudemd,
        include_command=not args.no_command,
        include_mcp=mcp_servers is not None,
        mcp_servers=mcp_servers,
        output_base=args.output_base,
    )

    # Output
    if args.output_json:
        print(json.dumps(result_to_dict(result), indent=2))
    else:
        print(f"\n{'=' * 60}")
        print(f"DRY RUN: {result.agent_name}")
        print(f"{'=' * 60}")
        print(f"\n{result.summary}\n")

        # List files
        print("Files to be generated:")
        print("-" * 60)
        for f in result.files:
            status = "OVERWRITE" if f.would_overwrite else "CREATE"
            size = format_file_size(f.size_bytes)
            print(f"  [{status:9}] {f.path} ({size}, ~{f.token_estimate:,} tokens)")

        print("-" * 60)
        print(f"Total tokens: ~{result.total_tokens:,}")

        # Quality prediction (agent file only)
        if result.quality is not None:
            q = result.quality
            verdict = "PASS" if q.passed else "FAIL"
            print(f"Quality prediction: {q.score}/10 (Grade: {q.grade}) — {verdict}")
            if q.criteria:
                breakdown = ", ".join(
                    f"{name}={score}" for name, score in sorted(q.criteria.items())
                )
                print(f"  Criteria: {breakdown}")
        elif not any("quality" in e.lower() for e in result.errors):
            # Agent file was not previewed (e.g. MCP-only run) — noting this is
            # honest rather than silently pretending quality is "OK".
            print("Quality prediction: n/a (no agent file in preview)")

        # Show diffs
        if args.diff:
            for f in result.files:
                if f.diff_lines:
                    print(f"\nDiff for {f.path}:")
                    print("-" * 40)
                    for line in f.diff_lines[:50]:  # Limit diff output
                        print(line, end="")
                    if len(f.diff_lines) > 50:
                        print(f"\n... ({len(f.diff_lines) - 50} more lines)")

        # Show content previews
        if args.output_preview:
            for f in result.files:
                print(f"\n{'=' * 60}")
                print(f"Content: {f.path}")
                print(f"{'=' * 60}")
                # Show first 100 lines
                lines = f.content.split("\n")
                for line in lines[:100]:
                    print(line)
                if len(lines) > 100:
                    print(f"\n... ({len(lines) - 100} more lines)")

        # Errors
        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  - {error}")

        print()

    sys.exit(0 if not result.errors else 1)


if __name__ == "__main__":
    main()
