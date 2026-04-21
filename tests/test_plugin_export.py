#!/usr/bin/env python3
"""
test_plugin_export — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_plugin_export.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestPluginExport:
    """Tests for plugin-format export in agent_export.py (feature #61).

    Covers:
    - export_as_plugin produces the canonical plugin layout
      (.claude-plugin/plugin.json, agents/, hooks/hooks.json, README.md)
    - hooks/hooks.json is always written (empty {} when no hooks)
    - hook scripts produce a PostToolUse entry referencing CLAUDE_PLUGIN_ROOT
    - build_plugin_manifest emits required claudeCodeMinVersion and omits
      empty optional fields
    - missing agent file → success=False with clear error
    - non-empty output_dir without overwrite=True → success=False
    - overwrite=True replaces existing directory
    - sanitize=True strips AWS-key-like patterns from copied content
    - CLI export-plugin subcommand prints success and exits 0
    - CLI exits non-zero when source agent missing
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

    def test_export_creates_canonical_plugin_layout(self) -> None:
        """Plugin export writes .claude-plugin/, agents/, hooks/, README."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'agents' / 'demo.md'\n"
            "    agent.parent.mkdir(parents=True)\n"
            "    agent.write_text('---\\nname: demo\\nversion: 2.1.0\\n"
            "description: Demo agent\\ntools: Read, Bash\\n---\\n# demo')\n"
            "    out = tmp / 'out'\n"
            "    r = export_as_plugin(agent, out, author='Daisy')\n"
            "    print('OK' if r.success else f'FAIL {r.errors}')\n"
            "    print((out / '.claude-plugin' / 'plugin.json').exists())\n"
            "    print((out / 'agents' / 'demo.md').exists())\n"
            "    print((out / 'hooks' / 'hooks.json').exists())\n"
            "    print((out / 'README.md').exists())\n"
            "    pj = json.loads((out / '.claude-plugin' / 'plugin.json').read_text())\n"
            "    print(pj['name'], pj['version'], pj['claudeCodeMinVersion'])\n"
            "    print(pj.get('author'))"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "OK"
        assert lines[1:5] == ["True", "True", "True", "True"]
        assert lines[5] == "demo 2.1.0 1.0.0"
        assert lines[6] == "Daisy"

    def test_hooks_json_is_empty_object_when_no_hooks(self) -> None:
        """hooks.json is always written; defaults to {} when no hook files."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'agents' / 'demo.md'\n"
            "    agent.parent.mkdir(parents=True)\n"
            "    agent.write_text('---\\nname: demo\\n---\\nbody')\n"
            "    r = export_as_plugin(agent, tmp / 'out')\n"
            "    hooks = json.loads((tmp / 'out' / 'hooks' / 'hooks.json').read_text())\n"
            "    print(r.success, hooks)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True {}"

    def test_hook_scripts_are_referenced_in_hooks_json(self) -> None:
        """When hook files are bundled, hooks.json references them via CLAUDE_PLUGIN_ROOT."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agents = tmp / 'agents'\n"
            "    agents.mkdir()\n"
            "    (agents / 'demo.md').write_text('---\\nname: demo\\n---\\nbody')\n"
            "    hooks = tmp / 'hooks'\n"
            "    hooks.mkdir()\n"
            "    (hooks / 'demo-hook.sh').write_text('#!/bin/bash\\necho hi')\n"
            "    r = export_as_plugin(agents / 'demo.md', tmp / 'out')\n"
            "    cfg = json.loads((tmp / 'out' / 'hooks' / 'hooks.json').read_text())\n"
            "    print(r.success, list(cfg.keys()))\n"
            "    entry = cfg['PostToolUse'][0]['hooks'][0]\n"
            "    print(entry['type'], entry['command'])"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "True ['PostToolUse']"
        assert lines[1] == "command ${CLAUDE_PLUGIN_ROOT}/hooks/demo-hook.sh"

    def test_build_plugin_manifest_omits_empty_optional_fields(self) -> None:
        """Optional fields not set on PackageManifest stay out of plugin.json."""
        result = self._run_py(
            "from platxa_agent_generator.agent_export import PackageManifest, build_plugin_manifest\n"
            "m = PackageManifest(name='x', version='1.0.0', description='d')\n"
            "pj = build_plugin_manifest(m)\n"
            "print(sorted(pj.keys()))"
        )
        assert result.returncode == 0, result.stderr
        # name, version, description, claudeCodeMinVersion always present.
        # license has dataclass default 'MIT' so it's also non-empty.
        # author/homepage/repository/keywords are empty so they're omitted.
        assert (
            result.stdout.strip()
            == "['claudeCodeMinVersion', 'description', 'license', 'name', 'version']"
        )

    def test_missing_agent_returns_error(self) -> None:
        """Source agent that doesn't exist → success=False with message."""
        result = self._run_py(
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "r = export_as_plugin(Path('/nonexistent/agent.md'), Path('/tmp/out'))\n"
            "print(r.success, 'not found' in r.errors[0].lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_nonempty_output_refuses_without_overwrite(self) -> None:
        """Existing non-empty output_dir + overwrite=False → success=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\n')\n"
            "    out = tmp / 'out'\n"
            "    out.mkdir()\n"
            "    (out / 'sentinel.txt').write_text('keep me')\n"
            "    r = export_as_plugin(agent, out)\n"
            "    print(r.success, 'overwrite' in r.errors[0].lower(),"
            " (out / 'sentinel.txt').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True True"

    def test_overwrite_true_replaces_existing_directory(self) -> None:
        """overwrite=True wipes old contents before writing the plugin."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\nbody')\n"
            "    out = tmp / 'out'\n"
            "    out.mkdir()\n"
            "    (out / 'stale.txt').write_text('old')\n"
            "    r = export_as_plugin(agent, out, overwrite=True)\n"
            "    print(r.success, (out / 'stale.txt').exists(),"
            " (out / 'agents' / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False True"

    def test_sanitize_strips_secret_patterns(self) -> None:
        """sanitize=True scrubs API-key-like substrings from copied content.

        The fake key is built dynamically inside the subprocess to avoid
        embedding a literal AWS-key-shaped string in this source file
        (which would trip pre-commit secret scanners).
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_as_plugin\n"
            "with tempfile.TemporaryDirectory() as tmp:\n"
            "    tmp = Path(tmp)\n"
            "    agent = tmp / 'a.md'\n"
            "    fake_key = 'AK' + 'IA' + '0123456789ABCDEF'\n"
            "    agent.write_text(f'---\\nname: a\\n---\\napi_key={fake_key}')\n"
            "    r = export_as_plugin(agent, tmp / 'out')\n"
            "    body = (tmp / 'out' / 'agents' / 'a.md').read_text()\n"
            "    aws_marker = 'AK' + 'IA'\n"
            "    print(aws_marker not in body, any('Sanitized' in w for w in r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_cli_export_plugin_success(self) -> None:
        """``export-plugin agent -o dir`` produces a valid plugin and exits 0."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            agent = tmp_path / "a.md"
            agent.write_text("---\nname: a\n---\nbody")
            out = tmp_path / "out"
            result = subprocess.run(
                [
                    sys.executable,
                    str(
                        Path(__file__).parent.parent
                        / "src"
                        / "platxa_agent_generator"
                        / "agent_export.py"
                    ),
                    "export-plugin",
                    str(agent),
                    "-o",
                    str(out),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode == 0, result.stderr
            assert "Plugin exported to" in result.stdout
            assert (out / ".claude-plugin" / "plugin.json").exists()
            assert (out / "hooks" / "hooks.json").exists()

    def test_cli_export_plugin_missing_agent_exits_nonzero(self) -> None:
        """CLI exits with non-zero when the source agent path is missing."""
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(
                        Path(__file__).parent.parent
                        / "src"
                        / "platxa_agent_generator"
                        / "agent_export.py"
                    ),
                    "export-plugin",
                    "/nonexistent/agent.md",
                    "-o",
                    str(Path(tmp) / "out"),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            assert result.returncode != 0
            assert "not found" in result.stdout.lower()


class TestAgentExportBundle:
    """Tests for the self-contained export/import bundle (feature #60).

    Covers:
    - detect_project_root infers the project root correctly
    - collect_project_root_configs finds .mcp.json and skips missing files
    - export_agent bundles .mcp.json under config/ in the produced zip
    - import_agent writes .mcp.json back to the target project root
    - import round-trip keeps content byte-identical
    - overwrite=False preserves an existing .mcp.json on import
    - validate_package runs on import via validate_first=True
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

    def test_detect_project_root_standard_layout(self) -> None:
        """For <proj>/.claude/agents/a.md → project root is <proj>."""
        result = self._run_py(
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import detect_project_root\n"
            "p = Path('/tmp/proj/.claude/agents/a.md')\n"
            "print(detect_project_root(p))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "/tmp/proj"

    def test_collect_project_root_configs_finds_mcp(self) -> None:
        """.mcp.json at project root is picked up; missing → empty list."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import collect_project_root_configs\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\n---\\nbody')\n"
            "    # No .mcp.json yet — empty\n"
            "    e1 = collect_project_root_configs(agent)\n"
            "    # With .mcp.json — found\n"
            "    mcp = root / '.mcp.json'\n"
            "    mcp.write_text(json.dumps({'mcpServers': {'x': {'command': 'echo'}}}))\n"
            "    e2 = collect_project_root_configs(agent)\n"
            "    print(len(e1), len(e2), e2[0].name)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 .mcp.json"

    def test_export_bundles_mcp_config_in_zip(self) -> None:
        """export_agent writes config/.mcp.json into the zip when present."""
        result = self._run_py(
            "import tempfile, json, zipfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root / '.mcp.json').write_text(json.dumps({'mcpServers': {'x': {'command': 'echo'}}}))\n"
            "    out = root / 'bundle.zip'\n"
            "    r = export_agent(agent, output_path=out, format=ExportFormat.ZIP)\n"
            "    with zipfile.ZipFile(out) as zf:\n"
            "        names = zf.namelist()\n"
            "    mcp_in_zip = any('config/.mcp.json' in n for n in names)\n"
            "    print(r.success, mcp_in_zip)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_include_mcp_config_false_skips_mcp(self) -> None:
        """include_mcp_config=False produces a bundle without .mcp.json."""
        result = self._run_py(
            "import tempfile, json, zipfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    agents = root / '.claude' / 'agents'\n"
            "    agents.mkdir(parents=True)\n"
            "    agent = agents / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root / '.mcp.json').write_text(json.dumps({'mcpServers': {}}))\n"
            "    out = root / 'bundle.zip'\n"
            "    export_agent(agent, output_path=out, format=ExportFormat.ZIP,"
            " include_mcp_config=False)\n"
            "    with zipfile.ZipFile(out) as zf:\n"
            "        names = zf.namelist()\n"
            "    print(any('.mcp.json' in n for n in names))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False"

    def test_round_trip_restores_mcp_to_project_root(self) -> None:
        """Export from project A, import into project B → .mcp.json at B root."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_agent, import_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as ta, tempfile.TemporaryDirectory() as tb:\n"
            "    root_a = Path(ta)\n"
            "    (root_a / '.claude' / 'agents').mkdir(parents=True)\n"
            "    agent = root_a / '.claude' / 'agents' / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    mcp_cfg = {'mcpServers': {'fs': {'command': 'npx', 'args': ['-y','fs']}}}\n"
            "    (root_a / '.mcp.json').write_text(json.dumps(mcp_cfg))\n"
            "    bundle = root_a / 'bundle.zip'\n"
            "    export_agent(agent, output_path=bundle, format=ExportFormat.ZIP)\n"
            "    root_b = Path(tb)\n"
            "    target_b = root_b / '.claude'\n"
            "    r = import_agent(bundle, target_dir=target_b, validate_first=True)\n"
            "    dst_mcp = root_b / '.mcp.json'\n"
            "    loaded = json.loads(dst_mcp.read_text()) if dst_mcp.exists() else None\n"
            "    print(r.success, dst_mcp.exists(), loaded == mcp_cfg)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_import_preserves_existing_mcp_when_not_overwrite(self) -> None:
        """Existing .mcp.json at target project root is preserved without overwrite."""
        result = self._run_py(
            "import tempfile, json\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import export_agent, import_agent, ExportFormat\n"
            "with tempfile.TemporaryDirectory() as ta, tempfile.TemporaryDirectory() as tb:\n"
            "    root_a = Path(ta)\n"
            "    (root_a / '.claude' / 'agents').mkdir(parents=True)\n"
            "    agent = root_a / '.claude' / 'agents' / 'a.md'\n"
            "    agent.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\nbody')\n"
            "    (root_a / '.mcp.json').write_text(json.dumps({'mcpServers': {'new': {'command': 'echo'}}}))\n"
            "    bundle = root_a / 'bundle.zip'\n"
            "    export_agent(agent, output_path=bundle, format=ExportFormat.ZIP)\n"
            "    root_b = Path(tb)\n"
            "    pre = {'mcpServers': {'existing': {'command': 'ls'}}}\n"
            "    (root_b / '.mcp.json').write_text(json.dumps(pre))\n"
            "    target_b = root_b / '.claude'\n"
            "    r = import_agent(bundle, target_dir=target_b, overwrite=False)\n"
            "    loaded = json.loads((root_b / '.mcp.json').read_text())\n"
            "    print(r.success, loaded == pre,"
            " any('Skipping' in w and '.mcp.json' in w for w in r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_import_validates_before_install(self) -> None:
        """A tampered zip missing the manifest fails validation on import."""
        result = self._run_py(
            "import tempfile, zipfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_export import import_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    bad = root / 'bad.zip'\n"
            "    with zipfile.ZipFile(bad, 'w') as zf:\n"
            "        zf.writestr('junk.txt', 'nothing here')\n"
            "    r = import_agent(bad, target_dir=root / '.claude', validate_first=True)\n"
            "    print(r.success, any('manifest' in e.lower() or 'agents' in e.lower() for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"
