#!/usr/bin/env python3
"""
Syntax Validator for Agent Definition Files

Validates YAML frontmatter and markdown structure in Claude Code agent files.

Usage:
    python syntax_validator.py agent.md
    python syntax_validator.py --json agent.md
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class ValidationError:
    """A single validation error."""

    line: int
    column: int
    severity: str  # "error" or "warning"
    code: str  # error code like "E001"
    message: str


@dataclass
class ValidationResult:
    """Result of syntax validation."""

    passed: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)
    frontmatter: dict | None = None
    sections: list[str] = field(default_factory=list)


# Valid Claude Code tools
VALID_TOOLS = {
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
    "WebSearch",
    "WebFetch",
    "Task",
    "AskUserQuestion",
    "TodoWrite",
    "NotebookEdit",
    "LSP",
}

# Required frontmatter fields
REQUIRED_FIELDS = ["name", "description", "tools"]

# Valid permission modes for Claude Code agents
VALID_PERMISSION_MODES = {
    "default",
    "acceptEdits",
    "bypassPermissions",
    "dontAsk",
}

# Field constraints
FIELD_CONSTRAINTS = {
    "name": {"max_length": 64, "pattern": r"^[a-z][a-z0-9-]*$"},
    "description": {"max_length": 1024},
}


def parse_frontmatter(content: str) -> tuple[dict | None, list[ValidationError], int]:
    """
    Parse YAML frontmatter from content using PyYAML.

    Returns:
        Tuple of (parsed_dict, errors, end_line)
    """
    errors: list[ValidationError] = []
    lines = content.split("\n")

    # Check for opening delimiter
    if not lines or lines[0].strip() != "---":
        errors.append(
            ValidationError(
                line=1,
                column=1,
                severity="error",
                code="E001",
                message="Missing frontmatter opening delimiter '---'",
            )
        )
        return None, errors, 0

    # Find closing delimiter
    end_line = -1
    for i, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            end_line = i
            break

    if end_line == -1:
        errors.append(
            ValidationError(
                line=1,
                column=1,
                severity="error",
                code="E002",
                message="Missing frontmatter closing delimiter '---'",
            )
        )
        return None, errors, len(lines)

    # Extract YAML content between delimiters
    yaml_content = "\n".join(lines[1 : end_line - 1])

    # Parse YAML using PyYAML
    try:
        frontmatter = yaml.safe_load(yaml_content)
        if frontmatter is None:
            frontmatter = {}
        if not isinstance(frontmatter, dict):
            errors.append(
                ValidationError(
                    line=2,
                    column=1,
                    severity="error",
                    code="E003",
                    message=f"Frontmatter must be a YAML mapping, got {type(frontmatter).__name__}",
                )
            )
            return None, errors, end_line
    except yaml.YAMLError as e:
        # Extract line number and message from YAML error
        error_line = 2  # Default to first line of frontmatter
        error_msg = str(e)

        # MarkedYAMLError has problem_mark with line info
        if isinstance(e, yaml.MarkedYAMLError) and e.problem_mark is not None:
            error_line = e.problem_mark.line + 2  # Adjust for frontmatter start
            error_msg = e.problem if e.problem else str(e)

        errors.append(
            ValidationError(
                line=error_line,
                column=1,
                severity="error",
                code="E003",
                message=f"Invalid YAML syntax: {error_msg}",
            )
        )
        return None, errors, end_line

    # Convert all values to strings for consistent handling
    normalized: dict[str, str] = {}
    for key, value in frontmatter.items():
        if isinstance(value, list):
            # Handle YAML lists - convert to comma-separated string
            normalized[str(key)] = ", ".join(str(v) for v in value)
        elif value is None:
            normalized[str(key)] = ""
        else:
            normalized[str(key)] = str(value)

    return normalized, errors, end_line


def validate_frontmatter_fields(frontmatter: dict, start_line: int = 1) -> list[ValidationError]:
    """Validate frontmatter field values."""
    errors: list[ValidationError] = []

    # Check required fields
    for field_name in REQUIRED_FIELDS:
        if field_name not in frontmatter:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E010",
                    message=f"Missing required field: {field_name}",
                )
            )
        elif not frontmatter[field_name]:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E011",
                    message=f"Empty required field: {field_name}",
                )
            )

    # Validate name field
    if "name" in frontmatter and frontmatter["name"]:
        name = frontmatter["name"]
        constraints = FIELD_CONSTRAINTS["name"]

        if len(name) > constraints["max_length"]:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E012",
                    message=f"Name exceeds {constraints['max_length']} characters: {len(name)}",
                )
            )

        if not re.match(constraints["pattern"], name):
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E013",
                    message=f"Name must be hyphen-case (lowercase, hyphens, start with letter): {name}",
                )
            )

    # Validate description field
    if "description" in frontmatter and frontmatter["description"]:
        desc = frontmatter["description"]
        max_len = FIELD_CONSTRAINTS["description"]["max_length"]

        if len(desc) > max_len:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E014",
                    message=f"Description exceeds {max_len} characters: {len(desc)}",
                )
            )

    # Validate tools field
    if "tools" in frontmatter and frontmatter["tools"]:
        tools_str = frontmatter["tools"]
        tools = [t.strip() for t in tools_str.split(",")]

        for tool in tools:
            if tool and tool not in VALID_TOOLS:
                # Check for MCP tools (mcp__*)
                if not tool.startswith("mcp__"):
                    errors.append(
                        ValidationError(
                            line=start_line,
                            column=1,
                            severity="error",
                            code="E015",
                            message=f"Invalid tool name: {tool}",
                        )
                    )

    # Validate permissionMode field (optional)
    if "permissionMode" in frontmatter and frontmatter["permissionMode"]:
        mode = frontmatter["permissionMode"]
        if mode not in VALID_PERMISSION_MODES:
            errors.append(
                ValidationError(
                    line=start_line,
                    column=1,
                    severity="error",
                    code="E016",
                    message=(
                        f"Invalid permissionMode: {mode}. "
                        f"Must be one of: {', '.join(sorted(VALID_PERMISSION_MODES))}"
                    ),
                )
            )

        # Warn if bypassPermissions used with high-risk tools
        if mode == "bypassPermissions":
            tools_str = frontmatter.get("tools", "")
            tools = [t.strip() for t in tools_str.split(",")]
            high_risk = {"Bash", "Write", "Edit", "WebFetch"}
            risky = [t for t in tools if t in high_risk]
            if risky:
                errors.append(
                    ValidationError(
                        line=start_line,
                        column=1,
                        severity="warning",
                        code="W016",
                        message=(
                            f"bypassPermissions with high-risk tools ({', '.join(risky)}) "
                            "— consider using 'acceptEdits' or 'default' instead"
                        ),
                    )
                )

    return errors


def validate_markdown_structure(
    content: str, frontmatter_end: int
) -> tuple[list[ValidationError], list[str]]:
    """Validate markdown structure after frontmatter."""
    errors: list[ValidationError] = []
    sections: list[str] = []
    lines = content.split("\n")

    if frontmatter_end >= len(lines):
        return errors, sections

    # Content after frontmatter
    body_lines = lines[frontmatter_end:]
    body_start = frontmatter_end + 1

    # Track state
    in_code_block = False
    code_block_start = 0
    code_block_lang = ""
    h1_found = False
    h2_count = 0

    for i, line in enumerate(body_lines):
        line_num = body_start + i

        # Check for code blocks
        if line.strip().startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_block_start = line_num
                code_block_lang = line.strip()[3:].strip()
            else:
                in_code_block = False
            continue

        # Skip content inside code blocks
        if in_code_block:
            continue

        # Check for H1 heading
        if line.startswith("# "):
            if h1_found:
                errors.append(
                    ValidationError(
                        line=line_num,
                        column=1,
                        severity="warning",
                        code="W001",
                        message="Multiple H1 headings found (should have only one)",
                    )
                )
            h1_found = True
            sections.append(line[2:].strip())

        # Check for H2 heading
        elif line.startswith("## "):
            h2_count += 1
            sections.append(line[3:].strip())

    # Check for unclosed code block
    if in_code_block:
        errors.append(
            ValidationError(
                line=code_block_start,
                column=1,
                severity="error",
                code="E020",
                message=f"Unclosed code block starting at line {code_block_start}"
                + (f" (language: {code_block_lang})" if code_block_lang else ""),
            )
        )

    # Check for missing H1
    if not h1_found:
        errors.append(
            ValidationError(
                line=body_start,
                column=1,
                severity="error",
                code="E021",
                message="Missing H1 title after frontmatter",
            )
        )

    # Check for H2 sections
    if h2_count == 0:
        errors.append(
            ValidationError(
                line=body_start,
                column=1,
                severity="warning",
                code="W002",
                message="No H2 sections found (agents should have structured sections)",
            )
        )

    return errors, sections


def validate_content(content: str) -> ValidationResult:
    """
    Validate agent definition file content.

    Args:
        content: Full file content as string

    Returns:
        ValidationResult with errors, warnings, and parsed data
    """
    all_errors: list[ValidationError] = []
    all_warnings: list[ValidationError] = []

    # Parse frontmatter
    frontmatter, fm_errors, fm_end = parse_frontmatter(content)
    for err in fm_errors:
        if err.severity == "error":
            all_errors.append(err)
        else:
            all_warnings.append(err)

    # Validate frontmatter fields if parsed successfully
    if frontmatter is not None:
        field_errors = validate_frontmatter_fields(frontmatter)
        for err in field_errors:
            if err.severity == "error":
                all_errors.append(err)
            else:
                all_warnings.append(err)

    # Validate markdown structure
    md_errors, sections = validate_markdown_structure(content, fm_end)
    for err in md_errors:
        if err.severity == "error":
            all_errors.append(err)
        else:
            all_warnings.append(err)

    return ValidationResult(
        passed=len(all_errors) == 0,
        errors=all_errors,
        warnings=all_warnings,
        frontmatter=frontmatter,
        sections=sections,
    )


def validate_file(file_path: str | Path) -> ValidationResult:
    """
    Validate an agent definition file.

    Args:
        file_path: Path to the agent file

    Returns:
        ValidationResult
    """
    path = Path(file_path)

    if not path.exists():
        return ValidationResult(
            passed=False,
            errors=[
                ValidationError(
                    line=0,
                    column=0,
                    severity="error",
                    code="E000",
                    message=f"File not found: {file_path}",
                )
            ],
        )

    if not path.suffix == ".md":
        return ValidationResult(
            passed=False,
            errors=[
                ValidationError(
                    line=0,
                    column=0,
                    severity="error",
                    code="E000",
                    message=f"Invalid file extension (expected .md): {path.suffix}",
                )
            ],
        )

    content = path.read_text(encoding="utf-8")
    return validate_content(content)


def format_error(error: ValidationError, file_path: str = "") -> str:
    """Format error for display."""
    location = f"{file_path}:" if file_path else ""
    location += f"{error.line}:{error.column}"
    severity = "error" if error.severity == "error" else "warning"
    return f"{location}: {severity} [{error.code}] {error.message}"


def main() -> None:
    """CLI entry point."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Validate agent definition syntax")
    parser.add_argument("file", help="Agent definition file to validate")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")

    args = parser.parse_args()

    result = validate_file(args.file)

    if args.json:
        output = {
            "passed": result.passed and (not args.strict or len(result.warnings) == 0),
            "errors": [
                {
                    "line": e.line,
                    "column": e.column,
                    "severity": e.severity,
                    "code": e.code,
                    "message": e.message,
                }
                for e in result.errors
            ],
            "warnings": [
                {
                    "line": w.line,
                    "column": w.column,
                    "severity": w.severity,
                    "code": w.code,
                    "message": w.message,
                }
                for w in result.warnings
            ],
            "frontmatter": result.frontmatter,
            "sections": result.sections,
        }
        print(json.dumps(output, indent=2))
    else:
        # Print errors
        for error in result.errors:
            print(format_error(error, args.file))

        # Print warnings
        for warning in result.warnings:
            print(format_error(warning, args.file))

        # Summary
        error_count = len(result.errors)
        warning_count = len(result.warnings)

        if error_count == 0 and warning_count == 0:
            print(f"✓ {args.file}: Valid")
        else:
            print(f"\n{error_count} error(s), {warning_count} warning(s)")

    # Exit code
    if not result.passed:
        sys.exit(1)
    if args.strict and result.warnings:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
