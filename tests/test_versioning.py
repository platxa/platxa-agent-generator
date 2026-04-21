#!/usr/bin/env python3
"""
test_versioning — sharded from test_generator.py.

Shards: 5 TestXxx classes.
Run with: pytest tests/test_versioning.py -v
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestAgentDiffComparison:
    """Tests for agent diff comparison in agent_versioning.py (feature #59).

    Covers:
    - diff_agents detects frontmatter additions / removals / changes
      (excluding tools, which are handled separately)
    - diff_agents detects tool additions and removals as sorted lists
    - diff_agents detects section additions / removals / modifications
    - whitespace-only section changes do not count as modified
    - is_empty() returns True for identical content, False otherwise
    - format_agent_diff renders human-readable output with +/-/~ symbols
    - format_agent_diff returns "No changes." for empty diff
    - format_agent_diff omits empty subsections (no "Tools:" header when
      no tool changes)
    - CLI ``diff`` subcommand prints expected output and exits 0
    - CLI ``diff`` exits non-zero when a path is missing
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_diff_detects_frontmatter_changes(self) -> None:
        """Frontmatter add/remove/change populate the right buckets."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: a\\nmodel: sonnet\\nold_field: x\\n---\\n'\n"
            "new = '---\\nname: b\\nmodel: sonnet\\nnew_field: y\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(sorted(d.frontmatter_added), sorted(d.frontmatter_removed),"
            " sorted(d.frontmatter_changed))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['new_field'] ['old_field'] ['name']"

    def test_diff_detects_tool_changes(self) -> None:
        """Tool additions and removals are sorted lists, set semantics."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read, Grep, WebFetch\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash, Edit\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.tools_added, d.tools_removed)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Bash', 'Edit'] ['Grep', 'WebFetch']"

    def test_diff_excludes_tools_from_frontmatter_diff(self) -> None:
        """Changing tools must not appear in frontmatter_changed."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Bash\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print('FM_CHANGED' if d.frontmatter_changed else 'FM_OK',"
            " 'TOOLS_OK' if d.tools_added and d.tools_removed else 'TOOLS_BAD')"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "FM_OK TOOLS_OK"

    def test_diff_detects_section_add_remove_change(self) -> None:
        """Sections added, removed, and modified land in correct buckets."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\n---\\n## Overview\\nold body\\n## Removed Sec\\nbye'\n"
            "new = '---\\nname: x\\n---\\n## Overview\\nNEW body\\n## Added Sec\\nhi'\n"
            "d = diff_agents(old, new)\n"
            "print(d.sections_added, d.sections_removed, d.sections_changed)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Added Sec'] ['Removed Sec'] ['Overview']"

    def test_diff_ignores_whitespace_only_section_changes(self) -> None:
        """Bodies differing only in trailing space / blank lines are equal."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\n---\\n## Sec\\nbody line\\n'\n"
            "new = '---\\nname: x\\n---\\n## Sec\\nbody line   \\n\\n\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.sections_changed, d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[] True"

    def test_diff_is_empty_for_identical_content(self) -> None:
        """Identical content yields an empty diff."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "c = '---\\nname: x\\ntools: Read\\n---\\n## A\\nbody'\n"
            "d = diff_agents(c, c)\n"
            "print(d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_diff_is_empty_returns_false_when_any_change(self) -> None:
        """Adding a single tool flips is_empty to False."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash\\n---\\n'\n"
            "d = diff_agents(old, new)\n"
            "print(d.is_empty())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_format_renders_human_readable_with_symbols(self) -> None:
        """Output uses +/-/~ markers and segregates frontmatter/tools/sections."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents, format_agent_diff\n"
            "old = '---\\nname: a\\ntools: Read, WebFetch\\n---\\n## A\\nold'\n"
            "new = '---\\nname: b\\ntools: Read, Bash\\n---\\n## A\\nnew\\n## B\\nhi'\n"
            "out = format_agent_diff(diff_agents(old, new))\n"
            "checks = [\n"
            "    'Agent Diff' in out,\n"
            "    'Frontmatter:' in out,\n"
            "    'Tools:' in out,\n"
            "    'Sections:' in out,\n"
            "    \"~ name: 'a' -> 'b'\" in out,\n"
            "    '+ Added: Bash' in out,\n"
            "    '- Removed: WebFetch' in out,\n"
            "    '~ Changed: A' in out,\n"
            "    '+ Added: B' in out,\n"
            "]\n"
            "print(all(checks), checks.count(False))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_format_returns_no_changes_for_empty_diff(self) -> None:
        """Empty diff renders as a stable single-line marker."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import AgentDiff, format_agent_diff\n"
            "print(repr(format_agent_diff(AgentDiff())))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "'No changes.\\n'"

    def test_format_omits_empty_subsections(self) -> None:
        """Diff with only tool changes omits Frontmatter and Sections headings."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import diff_agents, format_agent_diff\n"
            "old = '---\\nname: x\\ntools: Read\\n---\\n'\n"
            "new = '---\\nname: x\\ntools: Read, Bash\\n---\\n'\n"
            "out = format_agent_diff(diff_agents(old, new))\n"
            "print('Tools:' in out, 'Frontmatter:' not in out, 'Sections:' not in out)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_cli_diff_command_prints_diff_and_exits_zero(self) -> None:
        """``versions diff old new`` prints the formatted diff and exits 0."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            old_path = Path(tmp) / "old.md"
            new_path = Path(tmp) / "new.md"
            old_path.write_text("---\nname: a\ntools: Read\n---\n## A\nold\n")
            new_path.write_text("---\nname: b\ntools: Read\n---\n## A\nold\n")
            result = subprocess.run(
                [
                    sys.executable,
                    str(
                        Path(__file__).parent.parent
                        / "src"
                        / "platxa_agent_generator"
                        / "agent_versioning.py"
                    ),
                    "diff",
                    str(old_path),
                    str(new_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode == 0, result.stderr
            assert "Agent Diff" in result.stdout
            assert "~ name: 'a' -> 'b'" in result.stdout

    def test_cli_diff_command_exits_nonzero_on_missing_file(self) -> None:
        """Missing path causes the CLI to exit with non-zero status."""
        import subprocess

        result = subprocess.run(
            [
                sys.executable,
                str(
                    Path(__file__).parent.parent
                    / "src"
                    / "platxa_agent_generator"
                    / "agent_versioning.py"
                ),
                "diff",
                "/nonexistent/old.md",
                "/nonexistent/new.md",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode != 0
        assert "not found" in result.stdout.lower()


class TestAgentVersioning:
    """Tests for agent_versioning version-mutation paths (feature #23).

    Prior coverage (``TestAgentDiffComparison``, ``TestAgentRegenerationWorkflow``)
    exercised diff and regeneration. The three mutation paths that actually
    write the version catalog were untested, which is the highest-blast-radius
    gap in the module — a regression here corrupts the on-disk version
    history that downstream tooling (rollback, changelog, compatibility
    checks) keys off.

    Pins:
    - ``bump_version(PATCH)``: the Z coordinate increments, the agent
      frontmatter reflects the new version, and a new history entry is
      appended.
    - Tag conflict: bumping to a version that already lives in
      ``history.entries`` is refused cleanly (``success=False`` +
      diagnostic message), rather than silently appending a duplicate
      entry that would corrupt the catalog.
    - Downgrade: ``apply_update`` refuses incoming content whose
      version is lower than the installed version. Legitimate rollback
      goes through ``rollback_to_version``; ``apply_update`` is the
      forward path only.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    @staticmethod
    def _agent_md(version: str = "1.0.0") -> str:
        """Minimal valid agent file with a version frontmatter field."""
        return (
            "---\n"
            "name: version-test\n"
            f"version: {version}\n"
            "description: Agent for version tests\n"
            "tools: Read\n"
            "---\n"
            "\n"
            "# Version Test Agent\n"
        )

    def test_patch_bump_increments_z(self) -> None:
        """``bump_version(PATCH)`` on 1.0.0 produces 1.0.1 in both the
        returned value, the file frontmatter, and the appended history
        entry.

        Pins the full write-path: (a) return tuple ``(True, '1.0.1')``,
        (b) file frontmatter rewritten to ``version: 1.0.1``, (c)
        ``history.json`` ``current_version`` updated and a new entry
        with ``version: '1.0.1'`` appended.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import (\n"
            "    VersionBump, bump_version, load_version_history,\n"
            "    extract_version_from_frontmatter,\n"
            ")\n" + "md = '''" + self._agent_md("1.0.0") + "'''\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'agent.md'\n"
            "    path.write_text(md, encoding='utf-8')\n"
            "    ok, new_ver = bump_version(\n"
            "        path, VersionBump.PATCH, changes=['fix typo'],\n"
            "    )\n"
            "    history = load_version_history(path)\n"
            "    fm_ver = extract_version_from_frontmatter(\n"
            "        path.read_text(encoding='utf-8')\n"
            "    )\n"
            "    print(json.dumps({\n"
            "        'ok': ok,\n"
            "        'returned_version': new_ver,\n"
            "        'frontmatter_version': fm_ver,\n"
            "        'history_current': history.current_version if history else None,\n"
            "        'history_entries': [e.version for e in history.entries] if history else [],\n"
            "    }))\n"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["ok"] is True
        assert data["returned_version"] == "1.0.1"
        assert data["frontmatter_version"] == "1.0.1"
        assert data["history_current"] == "1.0.1"
        # The new patch version is present in the entries list.
        assert "1.0.1" in data["history_entries"], data["history_entries"]

    def test_tag_conflict_errors(self) -> None:
        """Bumping when the computed version already lives in history
        is refused with ``(False, message)`` — no duplicate entry
        written, no frontmatter mutation.

        The attack shape: drift between ``current_version`` and
        ``entries`` (e.g. a partially-restored backup). Without the
        guard, ``bump_version`` would happily append a duplicate
        ``1.0.1`` entry, corrupting the catalog. The guard returns
        cleanly; operators see the conflict and can resolve the drift
        deliberately.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import (\n"
            "    VersionBump, bump_version, load_version_history,\n"
            "    save_version_history, VersionEntry, VersionHistory,\n"
            "    extract_version_from_frontmatter,\n"
            ")\n" + "md = '''" + self._agent_md("1.0.0") + "'''\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'agent.md'\n"
            "    path.write_text(md, encoding='utf-8')\n"
            "    # Seed a history where 1.0.1 ALREADY exists in entries,\n"
            "    # but current_version is still 1.0.0 — the exact drift\n"
            "    # that a partial rollback or concurrent bump produces.\n"
            "    hist = VersionHistory(\n"
            "        agent_name='version-test',\n"
            "        current_version='1.0.0',\n"
            "        created_at='2026-04-21T00:00:00+00:00',\n"
            "        entries=[\n"
            "            VersionEntry(version='1.0.0',\n"
            "                timestamp='2026-04-21T00:00:00+00:00',\n"
            "                changes=['seed'], content_hash='a'),\n"
            "            VersionEntry(version='1.0.1',\n"
            "                timestamp='2026-04-21T00:01:00+00:00',\n"
            "                changes=['seed conflict'], content_hash='b'),\n"
            "        ])\n"
            "    save_version_history(path, hist)\n"
            "    # bump PATCH from 1.0.0 would compute 1.0.1 -> collide.\n"
            "    ok, msg = bump_version(\n"
            "        path, VersionBump.PATCH, changes=['fix']\n"
            "    )\n"
            "    # Reload to prove no duplicate append happened.\n"
            "    reloaded = load_version_history(path)\n"
            "    fm_ver = extract_version_from_frontmatter(\n"
            "        path.read_text(encoding='utf-8')\n"
            "    )\n"
            "    dup_count = sum(\n"
            "        1 for e in reloaded.entries if e.version == '1.0.1'\n"
            "    ) if reloaded else 0\n"
            "    print(json.dumps({\n"
            "        'ok': ok,\n"
            "        'msg': msg,\n"
            "        'frontmatter_version': fm_ver,\n"
            "        'dup_count': dup_count,\n"
            "        'history_current': reloaded.current_version if reloaded else None,\n"
            "    }))\n"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["ok"] is False, data
        assert "1.0.1" in data["msg"], data["msg"]
        assert "exists" in data["msg"].lower() or "conflict" in data["msg"].lower()
        # File frontmatter MUST NOT have been rewritten — the guard runs
        # before the write.
        assert data["frontmatter_version"] == "1.0.0", data
        # History must still have exactly ONE 1.0.1 entry (the seeded
        # one) — not two.
        assert data["dup_count"] == 1, data
        # current_version must not have advanced to the conflicting tag.
        assert data["history_current"] == "1.0.0", data

    def test_downgrade_rejected(self) -> None:
        """``apply_update`` refuses content whose version is lower
        than the installed version and reports the refusal in the
        structured result.

        Pins the UpdateResult shape for the refusal path:
        ``success=False``, ``old_version=installed``, ``new_version=incoming``,
        ``conflicts`` names the refusal. The file on disk is NOT
        rewritten (hash unchanged), so a rejected downgrade is truly
        a no-op, not a partial mutation.
        """
        result = self._run_py(
            "import hashlib, json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import apply_update\n"
            + "installed = '''"
            + self._agent_md("2.0.0")
            + "'''\n"
            + "incoming = '''"
            + self._agent_md("1.0.0")
            + "'''\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'agent.md'\n"
            "    path.write_text(installed, encoding='utf-8')\n"
            "    hash_before = hashlib.sha256(path.read_bytes()).hexdigest()\n"
            "    r = apply_update(path, incoming)\n"
            "    hash_after = hashlib.sha256(path.read_bytes()).hexdigest()\n"
            "    print(json.dumps({\n"
            "        'success': r.success,\n"
            "        'old_version': r.old_version,\n"
            "        'new_version': r.new_version,\n"
            "        'conflicts': r.conflicts,\n"
            "        'unchanged': hash_before == hash_after,\n"
            "    }))\n"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["success"] is False, data
        assert data["old_version"] == "2.0.0"
        assert data["new_version"] == "1.0.0"
        # The file bytes on disk must be unchanged — refusal is a no-op,
        # not a partial write.
        assert data["unchanged"] is True, data
        # The conflicts list must explain WHY (operator-visible).
        assert any(
            "downgrade" in c.lower() or "rollback" in c.lower() for c in data["conflicts"]
        ), data["conflicts"]


class TestAgentRegenerationWorkflow:
    """Tests for the regeneration workflow in agent_versioning.py (feature #58).

    Covers:
    - detect_breaking_changes: tool removal, name change, model change, none
    - regenerate_agent: patch bump on non-breaking, minor bump on breaking
    - regenerate_agent: archive path written, history updated, changelog produced
    - regenerate_agent: first-time generation path (no prior file)
    - regenerate_agent: force_bump override works
    - rollback-on-failure contract: bump failure restores archive
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    # -- detect_breaking_changes ------------------------------------------

    def test_detect_no_breaking_when_only_body_changed(self) -> None:
        """Pure body edits produce zero signals."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read\\n---\\nOld body'\n"
            "new = '---\\nname: a\\ntools: Read\\n---\\nNew body'\n"
            "print(len(detect_breaking_changes(old, new)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_detect_tool_removal_is_breaking(self) -> None:
        """Removing a declared tool produces a 'tools' signal."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "new = '---\\nname: a\\ntools: Read, Bash\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category, 'Write' in sigs[0].description)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 tools True"

    def test_detect_tool_addition_is_not_breaking(self) -> None:
        """Adding tools is additive — no signal."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\ntools: Read\\n---\\nBody'\n"
            "new = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "print(len(detect_breaking_changes(old, new)))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_detect_name_change_is_breaking(self) -> None:
        """Agent rename is breaking (identity change)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: old-name\\ntools: Read\\n---\\nBody'\n"
            "new = '---\\nname: new-name\\ntools: Read\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 name"

    def test_detect_model_change_is_breaking(self) -> None:
        """Model change alters runtime behavior — breaking."""
        result = self._run_py(
            "from platxa_agent_generator.agent_versioning import detect_breaking_changes\n"
            "old = '---\\nname: a\\nmodel: sonnet\\n---\\nBody'\n"
            "new = '---\\nname: a\\nmodel: opus\\n---\\nBody'\n"
            "sigs = detect_breaking_changes(old, new)\n"
            "print(len(sigs), sigs[0].category)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 model"

    # -- regenerate_agent --------------------------------------------------

    def test_regenerate_first_time_creates_initial_version(self) -> None:
        """First-time generation writes file and initializes history."""
        result = self._run_py(
            "import tempfile, os\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    content = '---\\nname: a\\ntools: Read\\n---\\nInitial'\n"
            "    r = regenerate_agent(p, content, changes=['Initial gen'])\n"
            "    print(r.success, r.old_version, r.new_version, r.archive_path is None,"
            " p.exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True  1.0.0 True True"

    def test_regenerate_non_breaking_bumps_patch(self) -> None:
        """Body-only change → patch bump."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    first = '---\\nname: a\\ntools: Read\\n---\\nBody v1'\n"
            "    regenerate_agent(p, first, changes=['init'])\n"
            "    second = '---\\nname: a\\ntools: Read\\n---\\nBody v2 reworded'\n"
            "    r = regenerate_agent(p, second, changes=['reword'])\n"
            "    print(r.success, r.bump_type == VersionBump.PATCH,"
            " r.old_version, r.new_version, len(r.breaking_changes))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 1.0.0 1.0.1 0"

    def test_regenerate_breaking_bumps_minor(self) -> None:
        """Tool removal triggers minor bump per feature spec."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    first = '---\\nname: a\\ntools: Read, Write, Bash\\n---\\nBody'\n"
            "    regenerate_agent(p, first, changes=['init'])\n"
            "    second = '---\\nname: a\\ntools: Read, Bash\\n---\\nBody changed'\n"
            "    r = regenerate_agent(p, second, changes=['remove tool'])\n"
            "    print(r.success, r.bump_type == VersionBump.MINOR,"
            " r.old_version, r.new_version, len(r.breaking_changes))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 1.0.0 1.1.0 1"

    def test_regenerate_archives_previous_version(self) -> None:
        """Previous version file is archived under .versions/backups/."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['init'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['update'])\n"
            "    archive = Path(r.archive_path)\n"
            "    print(archive.exists(),'backups' in str(archive),"
            " 'v1' in archive.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_regenerate_writes_changelog_and_history(self) -> None:
        """Changelog text includes the new version entry and history has 2 entries."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['initial'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['reword'])\n"
            "    hist = json.loads(Path(r.history_path).read_text())\n"
            "    print(len(hist['entries']), hist['current_version'],"
            " '1.0.1' in r.changelog, 'reword' in r.changelog)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "2 1.0.1 True True"

    def test_force_bump_overrides_automatic_choice(self) -> None:
        """Passing force_bump=MAJOR wins even for non-breaking changes."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_versioning import regenerate_agent, VersionBump\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv1', ['init'])\n"
            "    r = regenerate_agent(p, '---\\nname: a\\ntools: Read\\n---\\nv2', ['x'],"
            " force_bump=VersionBump.MAJOR)\n"
            "    print(r.success, r.bump_type == VersionBump.MAJOR, r.new_version)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True 2.0.0"


class TestAgentUpgrader:
    """Tests for agent_upgrader.py and the ``upgrade`` CLI command (feature #64).

    Covers:
    - Smart-default profile selection per declared tools
    - Missing frontmatter fields are added with chosen defaults
    - Existing frontmatter values are NEVER overwritten
    - Missing body sections (Examples / Output Format / Error Handling) are stubbed
    - Existing sections are NEVER rewritten
    - Custom body content is preserved byte-for-byte
    - Dry-run does not modify the file; --apply does and writes a backup
    - No-op upgrade (already current) creates no changes and no backup
    - smart_defaults_override forces specific values
    - CLI: 'upgrade path' returns 0 in dry-run, 0 with --apply
    - CLI: missing path returns 1
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_profile_selection_orchestrator(self) -> None:
        """Tools containing Task → orchestrator profile (opus, maxTurns 100)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Task, Read\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(r.profile_used, fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "orchestrator opus 100"

    def test_profile_selection_analyzer(self) -> None:
        """Read+Grep → analyzer profile (sonnet, maxTurns 15)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read, Grep\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(r.profile_used, fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "analyzer sonnet 15"

    def test_existing_frontmatter_preserved(self) -> None:
        """If model is already set, the upgrader must NOT overwrite it."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\nmodel: opus\\n---\\n# A')\n"
            "    r = upgrade_agent(p)\n"
            "    fm_changes = [c.field_or_section for c in r.changes if c.category == 'frontmatter']\n"
            "    print('model' not in fm_changes, 'model: opus' in r.upgraded_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_missing_sections_stubbed(self) -> None:
        """Missing Examples/Output Format/Error Handling become stub sections."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nbody')\n"
            "    r = upgrade_agent(p)\n"
            "    sections = [c.field_or_section for c in r.changes if c.category == 'section']\n"
            "    print(sorted(sections))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['Error Handling', 'Examples', 'Output Format']"

    def test_existing_sections_preserved(self) -> None:
        """Existing ## Examples is not duplicated; user content stays intact."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "custom = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Examples\\n- my custom example'\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(custom)\n"
            "    r = upgrade_agent(p)\n"
            "    section_changes = [c.field_or_section for c in r.changes if c.category == 'section']\n"
            "    # Examples should NOT be in the changes (already present)\n"
            "    # User's content should still appear in upgraded_content\n"
            "    print('Examples' not in section_changes,"
            " 'my custom example' in r.upgraded_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_dry_run_does_not_modify_file(self) -> None:
        """Without --apply the file content is unchanged on disk."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    r = upgrade_agent(p, apply=False)\n"
            "    print(r.applied, p.read_text() == original, r.backup_path is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True True"

    def test_apply_writes_file_and_creates_backup(self) -> None:
        """With --apply the file is written and a backup exists."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    r = upgrade_agent(p, apply=True)\n"
            "    backup_exists = r.backup_path is not None and Path(r.backup_path).exists()\n"
            "    backup_content = Path(r.backup_path).read_text() if backup_exists else ''\n"
            "    print(r.applied, p.read_text() != original, backup_exists, backup_content == original)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_idempotent_upgrade_no_changes(self) -> None:
        """Upgrading an already-upgraded file produces zero changes and no backup."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "complete = (\n"
            "    '---\\nname: a\\ndescription: d\\ntools: Read\\n'\n"
            "    'model: sonnet\\nmaxTurns: 15\\nversion: 1.0.0\\n---\\n'\n"
            "    '# A\\n## Examples\\n- ex\\n## Output Format\\nfmt\\n## Error Handling\\nh'\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(complete)\n"
            "    r = upgrade_agent(p, apply=True)\n"
            "    print(len(r.changes), r.applied, r.backup_path is None)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 False True"

    def test_smart_defaults_override_forces_values(self) -> None:
        """smart_defaults_override wins over the profile-selected defaults."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A')\n"
            "    r = upgrade_agent(p, smart_defaults_override={'model': 'haiku', 'maxTurns': 5})\n"
            "    fm = {c.field_or_section: c.value for c in r.changes if c.category == 'frontmatter'}\n"
            "    print(fm.get('model'), fm.get('maxTurns'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "haiku 5"

    def test_file_not_found_raises(self) -> None:
        """Missing file → FileNotFoundError."""
        result = self._run_py(
            "from platxa_agent_generator.agent_upgrader import upgrade_agent\n"
            "try:\n"
            "    upgrade_agent('/tmp/__definitely_not_an_agent__.md')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_cli_upgrade_dry_run(self) -> None:
        """`platxa-agent upgrade path` returns 0 and prints the report (dry-run)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    rc = CLI().run(['upgrade', str(p)])\n"
            "    print('RC=', rc, 'unchanged=', p.read_text() == original)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 0" in result.stdout
        assert "unchanged= True" in result.stdout

    def test_cli_upgrade_apply_modifies_file(self) -> None:
        """`upgrade path --apply` modifies the file."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    original = '---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A'\n"
            "    p.write_text(original)\n"
            "    rc = CLI().run(['upgrade', str(p), '--apply'])\n"
            "    print('RC=', rc, 'changed=', p.read_text() != original)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 0" in result.stdout
        assert "changed= True" in result.stdout

    def test_cli_upgrade_missing_returns_1(self) -> None:
        """Missing file → exit 1."""
        result = self._run_py(
            "from platxa_agent_generator.cli import CLI\nrc = CLI().run(['upgrade', '/tmp/__nope__.md'])\nprint('RC=', rc)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 1" in result.stdout


class TestVersionBump:
    """Tests for Feature #28: pyproject.toml + PLATXA_GENERATOR_VERSION bump.

    Pins the coupled version constants that advance in lockstep at the end
    of a hardening sprint. Two invariants:

    - ``pyproject.toml`` ``[project].version`` matches the expected patch.
    - ``agent_generator.PLATXA_GENERATOR_VERSION`` matches ``pyproject.toml``
      so the attribution footer emitted into every generated agent file
      stays consistent with the package version on PyPI.

    Drift between these two strings has surfaced in the past as footer
    metadata pointing to a package version that doesn't exist — so this
    class enforces equality rather than spot-checking each in isolation.
    """

    # Expected post-bump version. Hard-coded (rather than read from
    # pyproject.toml) so the test itself is the oracle: if a future
    # refactor regresses the pyproject version, ``test_pyproject_version``
    # breaks before ``test_constant_matches`` obscures the failure by
    # also reading from the same drifted source.
    EXPECTED_VERSION: str = "1.0.1"

    @staticmethod
    def _project_root() -> Path:
        """Resolve the repo root.

        ``SCRIPTS_DIR`` is ``src/platxa_agent_generator/``; its grandparent
        is the repo root (``platxa-agent-generator``). Computed lazily so
        the helper stays usable even if the module moves.
        """
        return SCRIPTS_DIR.parent.parent

    def test_pyproject_version(self) -> None:
        """pyproject.toml ``[project].version`` equals the expected patch."""
        pyproject = self._project_root() / "pyproject.toml"
        assert pyproject.exists(), f"pyproject.toml missing at {pyproject}"
        content = pyproject.read_text(encoding="utf-8")
        # Match the ``version = "X.Y.Z"`` line under ``[project]`` without
        # pulling in tomllib — the regex is intentionally specific so a
        # ``version`` key under a different TOML table (e.g. a build-system
        # dependency) does not false-positive.
        match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        assert match is not None, (
            'pyproject.toml must declare a top-level ``version = "X.Y.Z"`` line; none found'
        )
        assert match.group(1) == self.EXPECTED_VERSION, (
            f"pyproject.toml version {match.group(1)!r} != expected {self.EXPECTED_VERSION!r}"
        )

    def test_constant_matches(self) -> None:
        """agent_generator.PLATXA_GENERATOR_VERSION equals pyproject version.

        Drift between these two strings means the footer emitted into
        generated agents claims a package version that does not match the
        installed distribution. Enforced in a subprocess so the test
        reads the constant as the running generator would, not the source
        file text.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.agent_generator import "
                    "PLATXA_GENERATOR_VERSION; print(PLATXA_GENERATOR_VERSION)"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"PLATXA_GENERATOR_VERSION import failed: {result.stderr}"
        assert result.stdout.strip() == self.EXPECTED_VERSION, (
            f"PLATXA_GENERATOR_VERSION {result.stdout.strip()!r} != expected "
            f"{self.EXPECTED_VERSION!r}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
