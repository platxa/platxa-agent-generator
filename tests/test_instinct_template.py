"""Tests for skills/platxa-agent-generator/templates/instinct.md.j2 (feature #4).

The template is the canonical Jinja2 source for instinct markdown files. It is
rendered by the future `InstinctStore` (feature #6) and the rendered output is
schema-validated by the future `syntax_validator` instinct extension (feature #8).
This test file pins the template's contract before either consumer lands so a
mismatched schema fails here, not silently in production.

jinja2 is not yet declared in pyproject runtime deps (it is added in feature #6
when InstinctStore needs it at runtime). Until then the test skips on environments
without jinja2 — `importorskip` is the standard pytest pattern for optional-dep
tests, not a workaround for a missing dependency.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
import yaml

jinja2 = pytest.importorskip("jinja2")

if TYPE_CHECKING:
    import jinja2 as _jinja2_types  # noqa: F401  (alias used only in annotations)


REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = REPO_ROOT / "skills" / "platxa-agent-generator" / "templates" / "instinct.md.j2"

REQUIRED_FRONTMATTER_FIELDS = {
    "name",
    "description",
    "type",
    "confidence",
    "created",
    "last_seen",
    "occurrences",
    "success_count",
    "usage_count",
    "ttl_days",
    "project_scope",
}

REQUIRED_SECTIONS = ("Action", "Evidence", "Examples")


def _make_env() -> "_jinja2_types.Environment":
    """Build the canonical Jinja2 environment used to render the template.

    Mirrors the configuration the future InstinctStore will use: autoescape off
    (output is markdown, not HTML) and trailing newline preserved (so the file
    ends with a newline as POSIX expects).
    """
    return jinja2.Environment(
        autoescape=False,
        keep_trailing_newline=True,
    )


def _render(**overrides: object) -> str:
    """Render the instinct template with sane defaults plus per-test overrides."""
    env = _make_env()
    template = env.from_string(TEMPLATE_PATH.read_text(encoding="utf-8"))
    context: dict[str, object] = {
        "name": "always-validate-yaml",
        "description": "Always run yaml.safe_load on user-provided frontmatter",
        "type": "pattern",
        "confidence": 0.85,
        "created": "2026-05-09T12:00:00Z",
        "last_seen": "2026-05-09T15:00:00Z",
        "action": "Call yaml.safe_load on every frontmatter dict.",
        "evidence": "Observed in 12/12 plugin_installer.install_plugin invocations.",
        "examples": "- Bug fix in feature #2\n- Test fix in feature #3",
    }
    context.update(overrides)
    return template.render(**context)


def _frontmatter(rendered: str) -> dict[str, object]:
    """Extract and parse the YAML frontmatter from a rendered instinct file."""
    match = re.match(r"^---\n(.*?)\n---\n", rendered, re.DOTALL)
    assert match is not None, (
        "Rendered output must start with '---\\n...\\n---\\n' frontmatter delimiters; "
        f"got first 80 chars: {rendered[:80]!r}"
    )
    parsed = yaml.safe_load(match.group(1))
    assert isinstance(parsed, dict), (
        f"Frontmatter must parse as a YAML mapping, got {type(parsed).__name__}"
    )
    return parsed


def test_template_file_exists() -> None:
    assert TEMPLATE_PATH.is_file(), f"Template not found at {TEMPLATE_PATH}"


def test_template_renders_without_error() -> None:
    rendered = _render()
    assert rendered.startswith("---\n")
    assert "\n---\n" in rendered


def test_rendered_frontmatter_parses_as_yaml() -> None:
    rendered = _render()
    fm = _frontmatter(rendered)
    assert fm  # non-empty mapping


def test_rendered_frontmatter_has_all_required_fields() -> None:
    fm = _frontmatter(_render())
    missing = REQUIRED_FRONTMATTER_FIELDS - set(fm)
    assert not missing, f"Missing required frontmatter fields: {sorted(missing)}"


def test_required_field_value_types_and_ranges() -> None:
    """Per-spec constraints: name ≤64, description ≤512, confidence in [0,1], counts ≥ 0, ttl_days > 0."""
    fm = _frontmatter(_render())

    assert isinstance(fm["name"], str) and 1 <= len(fm["name"]) <= 64
    assert isinstance(fm["description"], str) and 1 <= len(fm["description"]) <= 512
    assert isinstance(fm["type"], str) and fm["type"]
    assert isinstance(fm["confidence"], (int, float))
    assert 0.0 <= float(fm["confidence"]) <= 1.0
    assert isinstance(fm["created"], str) and fm["created"]
    assert isinstance(fm["last_seen"], str) and fm["last_seen"]
    assert isinstance(fm["occurrences"], int) and fm["occurrences"] >= 0
    assert isinstance(fm["success_count"], int) and fm["success_count"] >= 0
    assert isinstance(fm["usage_count"], int) and fm["usage_count"] >= 0
    assert isinstance(fm["ttl_days"], int) and fm["ttl_days"] > 0
    assert isinstance(fm["project_scope"], str) and fm["project_scope"]


def test_optional_fields_use_defaults_when_omitted() -> None:
    """occurrences, success_count, usage_count, ttl_days, project_scope must default cleanly."""
    env = _make_env()
    template = env.from_string(TEMPLATE_PATH.read_text(encoding="utf-8"))
    rendered = template.render(
        name="default-test",
        description="Verify defaults render cleanly",
        type="pattern",
        confidence=0.5,
        created="2026-05-09T00:00:00Z",
        last_seen="2026-05-09T00:00:00Z",
        action="N/A",
        evidence="N/A",
        examples="N/A",
    )
    fm = _frontmatter(rendered)
    assert fm["occurrences"] == 1
    assert fm["success_count"] == 0
    assert fm["usage_count"] == 0
    assert fm["ttl_days"] == 30
    assert fm["project_scope"] == "global"


def test_required_sections_present() -> None:
    rendered = _render()
    for section in REQUIRED_SECTIONS:
        assert f"\n## {section}\n" in rendered, f"Missing required section: {section}"


def test_h1_title_uses_instinct_name() -> None:
    rendered = _render(name="lock-files-on-shared-state")
    assert "\n# lock-files-on-shared-state\n" in rendered


def test_special_characters_in_description_render_safely() -> None:
    """Strings with YAML-significant characters (quotes, colons) must round-trip cleanly."""
    tricky = 'He said: "yes" — and added: yes:no'
    fm = _frontmatter(_render(description=tricky))
    assert fm["description"] == tricky


def test_section_bodies_pass_through_markdown() -> None:
    """Action/Evidence/Examples bodies are rendered verbatim — no Jinja2 mangling of markdown lists."""
    rendered = _render(
        action="- bullet one\n- bullet two",
        evidence="```py\nassert True\n```",
        examples="**bold** then _italic_",
    )
    assert "- bullet one\n- bullet two" in rendered
    assert "```py\nassert True\n```" in rendered
    assert "**bold** then _italic_" in rendered


def test_numeric_overrides_render_as_yaml_numbers() -> None:
    """Counts/ttl_days must render as YAML ints, not quoted strings (so consumers can compare numerically)."""
    fm = _frontmatter(_render(occurrences=5, success_count=4, usage_count=3, ttl_days=14))
    assert fm["occurrences"] == 5
    assert fm["success_count"] == 4
    assert fm["usage_count"] == 3
    assert fm["ttl_days"] == 14
