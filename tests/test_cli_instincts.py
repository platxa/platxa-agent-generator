"""Tests for the ``instincts`` CLI subcommand.

Verification criterion for feature #52: all four sub-actions (list, show,
prune, stats) work with a fixture instinct store; --project is respected;
--type filters correctly.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI
from platxa_agent_generator.instinct_store import InstinctStore


def _seed_store(tmp_path: Path, instincts: list[dict[str, str]]) -> Path:
    """Write instincts to a temp store and return the root path.

    Each dict must have keys: name, scope, type, content.
    Optionally: created, last_seen.
    """
    root = tmp_path / "instincts"
    store = InstinctStore(root=root)
    for inst in instincts:
        store.put(
            name=inst["name"],
            scope=inst["scope"],
            type_=inst["type"],
            content=inst["content"],
            created=inst.get("created", ""),
            last_seen=inst.get("last_seen", ""),
        )
    return root


def _make_content(name: str, description: str = "test", **extra: object) -> str:
    """Build minimal instinct markdown with frontmatter."""
    lines = [
        "---",
        f"name: {name}",
        f"description: {description}",
    ]
    for k, v in extra.items():
        lines.append(f"{k}: {v}")
    lines.append("---")
    lines.append(f"\n# {name}\n\nBody text.\n")
    return "\n".join(lines)


# --- list -----------------------------------------------------------------


class TestInstinctsList:
    """``platxa-agent instincts list`` sub-action."""

    def test_list_json_returns_entries(self, tmp_path: Path) -> None:
        root = _seed_store(
            tmp_path,
            [
                {"name": "a", "scope": "global", "type": "pattern", "content": _make_content("a")},
                {"name": "b", "scope": "proj-1", "type": "rule", "content": _make_content("b")},
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "instincts", "list", "--root", str(root)])
        assert rc == 0

    def test_list_json_schema(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [{"name": "x", "scope": "global", "type": "pattern", "content": _make_content("x")}],
        )
        cli = CLI()
        cli.run(["--json", "instincts", "list", "--root", str(root)])
        output = json.loads(capsys.readouterr().out)
        assert "total" in output
        assert "returned" in output
        assert "entries" in output
        assert isinstance(output["entries"], list)
        assert len(output["entries"]) == 1

    def test_list_respects_limit(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        instincts = [
            {
                "name": f"inst-{i}",
                "scope": "global",
                "type": "pattern",
                "content": _make_content(f"inst-{i}"),
            }
            for i in range(10)
        ]
        root = _seed_store(tmp_path, instincts)
        cli = CLI()
        cli.run(["--json", "instincts", "list", "-n", "3", "--root", str(root)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 10
        assert output["returned"] == 3

    def test_list_filter_by_project(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {"name": "a", "scope": "global", "type": "pattern", "content": _make_content("a")},
                {"name": "b", "scope": "proj-1", "type": "pattern", "content": _make_content("b")},
                {"name": "c", "scope": "proj-1", "type": "rule", "content": _make_content("c")},
            ],
        )
        cli = CLI()
        cli.run(["--json", "instincts", "list", "--project", "proj-1", "--root", str(root)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 2
        names = {e["name"] for e in output["entries"]}
        assert names == {"b", "c"}

    def test_list_filter_by_type(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [
                {"name": "a", "scope": "global", "type": "pattern", "content": _make_content("a")},
                {"name": "b", "scope": "global", "type": "rule", "content": _make_content("b")},
                {"name": "c", "scope": "proj-1", "type": "rule", "content": _make_content("c")},
            ],
        )
        cli = CLI()
        cli.run(["--json", "instincts", "list", "--type", "rule", "--root", str(root)])
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 2
        names = {e["name"] for e in output["entries"]}
        assert names == {"b", "c"}

    def test_list_combined_filters(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {"name": "a", "scope": "global", "type": "pattern", "content": _make_content("a")},
                {"name": "b", "scope": "proj-1", "type": "rule", "content": _make_content("b")},
                {"name": "c", "scope": "proj-1", "type": "pattern", "content": _make_content("c")},
            ],
        )
        cli = CLI()
        cli.run(
            [
                "--json",
                "instincts",
                "list",
                "--project",
                "proj-1",
                "--type",
                "rule",
                "--root",
                str(root),
            ]
        )
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 1
        assert output["entries"][0]["name"] == "b"

    def test_list_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = tmp_path / "empty-instincts"
        cli = CLI()
        rc = cli.run(["--json", "instincts", "list", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 0
        assert output["entries"] == []

    def test_list_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "my-inst",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("my-inst"),
                }
            ],
        )
        cli = CLI()
        rc = cli.run(["instincts", "list", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "1 total" in out
        assert "my-inst" in out


# --- show -----------------------------------------------------------------


class TestInstinctsShow:
    """``platxa-agent instincts show`` sub-action."""

    def test_show_json_valid_name(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        content = _make_content("my-inst", description="A test instinct")
        root = _seed_store(
            tmp_path,
            [{"name": "my-inst", "scope": "global", "type": "pattern", "content": content}],
        )
        cli = CLI()
        rc = cli.run(["--json", "instincts", "show", "my-inst", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["name"] == "my-inst"
        assert output["type"] == "pattern"
        assert output["scope"] == "global"
        assert output["content"] == content

    def test_show_not_found(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = tmp_path / "empty-instincts"
        cli = CLI()
        rc = cli.run(["--json", "instincts", "show", "nonexistent", "--root", str(root)])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output
        assert "nonexistent" in output["error"]

    def test_show_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        content = _make_content("test-rule", description="Rule for testing")
        root = _seed_store(
            tmp_path,
            [{"name": "test-rule", "scope": "proj-1", "type": "rule", "content": content}],
        )
        cli = CLI()
        rc = cli.run(["instincts", "show", "test-rule", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "test-rule" in out
        assert "rule" in out
        assert "proj-1" in out
        assert "Body text." in out


# --- prune ----------------------------------------------------------------


class TestInstinctsPrune:
    """``platxa-agent instincts prune`` sub-action."""

    def test_prune_dry_run_does_not_delete(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "old-inst",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("old-inst", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "instincts", "prune", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["dry_run"] is True
        assert "old-inst" in output["pruned"]
        store = InstinctStore(root=root)
        assert store.get_entry("old-inst") is not None

    def test_prune_deletes_expired(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "old-inst",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("old-inst", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
                {
                    "name": "new-inst",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("new-inst", usage_count=0),
                    "last_seen": "2099-01-01T00:00:00Z",
                },
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "instincts", "prune", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert "old-inst" in output["pruned"]
        assert output["retained_count"] >= 1
        store = InstinctStore(root=root)
        assert store.get_entry("old-inst") is None
        assert store.get_entry("new-inst") is not None

    def test_prune_respects_project_filter(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "proj1-old",
                    "scope": "proj-1",
                    "type": "pattern",
                    "content": _make_content("proj1-old", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
                {
                    "name": "global-old",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("global-old", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "instincts",
                "prune",
                "--project",
                "proj-1",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert "proj1-old" in output["pruned"]
        assert "global-old" not in output["pruned"]
        store = InstinctStore(root=root)
        assert store.get_entry("proj1-old") is None
        assert store.get_entry("global-old") is not None

    def test_prune_respects_type_filter(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "old-pattern",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("old-pattern", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
                {
                    "name": "old-rule",
                    "scope": "global",
                    "type": "rule",
                    "content": _make_content("old-rule", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
            ],
        )
        cli = CLI()
        rc = cli.run(
            [
                "--json",
                "instincts",
                "prune",
                "--type",
                "rule",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert "old-rule" in output["pruned"]
        assert "old-pattern" not in output["pruned"]
        store = InstinctStore(root=root)
        assert store.get_entry("old-rule") is None
        assert store.get_entry("old-pattern") is not None

    def test_prune_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = tmp_path / "empty-instincts"
        cli = CLI()
        rc = cli.run(["--json", "instincts", "prune", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["pruned_count"] == 0

    def test_prune_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "old-inst",
                    "scope": "global",
                    "type": "pattern",
                    "content": _make_content("old-inst", usage_count=0),
                    "last_seen": "2020-01-01T00:00:00Z",
                },
            ],
        )
        cli = CLI()
        rc = cli.run(["instincts", "prune", "--dry-run", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Would prune" in out
        assert "old-inst" in out


# --- stats ----------------------------------------------------------------


class TestInstinctsStats:
    """``platxa-agent instincts stats`` sub-action."""

    def test_stats_json_schema(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [
                {"name": "a", "scope": "global", "type": "pattern", "content": _make_content("a")},
                {"name": "b", "scope": "global", "type": "rule", "content": _make_content("b")},
                {"name": "c", "scope": "proj-1", "type": "pattern", "content": _make_content("c")},
            ],
        )
        cli = CLI()
        rc = cli.run(["--json", "instincts", "stats", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 3
        assert output["by_type"]["pattern"] == 2
        assert output["by_type"]["rule"] == 1
        assert output["by_scope"]["global"] == 2
        assert output["by_scope"]["proj-1"] == 1
        assert "total_size_bytes" in output
        assert output["total_size_bytes"] > 0

    def test_stats_empty_store(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = tmp_path / "empty-instincts"
        cli = CLI()
        rc = cli.run(["--json", "instincts", "stats", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["total"] == 0
        assert output["total_size_bytes"] == 0
        assert output["by_type"] == {}
        assert output["by_scope"] == {}

    def test_stats_human_readable(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [{"name": "x", "scope": "global", "type": "pattern", "content": _make_content("x")}],
        )
        cli = CLI()
        rc = cli.run(["instincts", "stats", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "1 entries" in out
        assert "pattern" in out
        assert "global" in out


# --- no action ------------------------------------------------------------


class TestInstinctsNoAction:
    """Missing or invalid sub-action prints usage."""

    def test_no_action_returns_error(self) -> None:
        cli = CLI()
        rc = cli.run(["instincts"])
        assert rc == 1

    def test_no_action_json(self, capsys: pytest.CaptureFixture[str]) -> None:
        cli = CLI()
        rc = cli.run(["--json", "instincts"])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output
