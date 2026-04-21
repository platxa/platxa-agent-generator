#!/usr/bin/env python3
"""
test_readme — sharded from test_generator.py.

Shards: 1 TestXxx classes.
Run with: pytest tests/test_readme.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestAgentReadmeGenerator:
    """Tests for agent_readme_generator.py (feature #86).

    Covers the three verification criteria:
    - README lists all agents in .claude/agents/
    - Each has name, description, tools, usage example
    - Formatted as Markdown table

    Plus edge cases: empty dirs, missing frontmatter, existing README
    skipped, example-section extraction vs synthesis, table-cell
    escaping, stable alphabetical ordering.
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

    def test_constants_exposed(self) -> None:
        """DEFAULT_AGENTS_DIR, DEFAULT_README_FILENAME, EXAMPLE_SECTION_HEADINGS public."""
        result = self._run_py(
            "from platxa_agent_generator.agent_readme_generator import (\n"
            "    DEFAULT_AGENTS_DIR, DEFAULT_README_FILENAME,\n"
            "    EXAMPLE_SECTION_HEADINGS,\n"
            ")\n"
            "print(DEFAULT_AGENTS_DIR, '|', DEFAULT_README_FILENAME,\n"
            "      '|', '## Example' in EXAMPLE_SECTION_HEADINGS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/agents | README.md | True"

    def test_scan_agents_empty_dir(self) -> None:
        """Missing or empty dir returns []."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    print(scan_agents(td), scan_agents(Path(td) / 'missing'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[] []"

    def test_scan_agents_parses_frontmatter(self) -> None:
        """Agent files with valid frontmatter produce AgentSummary entries."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'reviewer.md').write_text(\n"
            "        '---\\n'\n"
            "        'name: reviewer\\n'\n"
            "        'description: Reviews code for quality\\n'\n"
            "        'tools: Read, Grep, Glob\\n'\n"
            "        '---\\n\\n'\n"
            "        '# Reviewer\\n\\n## Overview\\nReviews code.\\n'\n"
            "    )\n"
            "    summaries = scan_agents(td)\n"
            "    s = summaries[0]\n"
            "    print(len(summaries), s.name, s.description,\n"
            "          '|', s.tools)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "1 reviewer Reviews code for quality | ['Read', 'Grep', 'Glob']"
        )

    def test_scan_skips_malformed_files(self) -> None:
        """Files without frontmatter or without name are skipped."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'broken.md').write_text('no frontmatter here')\n"
            "    (Path(td) / 'valid.md').write_text(\n"
            "        '---\\nname: ok\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    summaries = scan_agents(td)\n"
            "    print(len(summaries), summaries[0].name)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 ok"

    def test_scan_sorts_alphabetically(self) -> None:
        """Output is alphabetised by agent name for stable READMEs."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    for nm in ('zebra', 'alpha', 'mango'):\n"
            "        (Path(td) / f'{nm}.md').write_text(\n"
            "            f'---\\nname: {nm}\\ndescription: d\\n---\\n'\n"
            "        )\n"
            "    print([s.name for s in scan_agents(td)])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['alpha', 'mango', 'zebra']"

    def test_scan_skips_readme_itself(self) -> None:
        """README.md in agents_dir is not treated as an agent."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'README.md').write_text(\n"
            "        '---\\nname: README\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    (Path(td) / 'real.md').write_text(\n"
            "        '---\\nname: real\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    print([s.name for s in scan_agents(td)])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "['real']"

    def test_example_section_extracted(self) -> None:
        """## Example section in body is used verbatim as the usage snippet."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'a.md').write_text(\n"
            "        '---\\nname: a\\ndescription: d\\n---\\n'\n"
            "        '\\n# A\\n\\n## Example\\n\\n"
            "Say hello to `a`.\\n\\n## Next Section\\n'\n"
            "    )\n"
            "    s = scan_agents(td)[0]\n"
            "    print('Say hello' in s.usage_example,\n"
            "          'Next Section' not in s.usage_example)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_example_synthesized_when_absent(self) -> None:
        """Without an example section, a Task snippet is synthesized."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import scan_agents\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'a.md').write_text(\n"
            "        '---\\nname: solo\\ndescription: d\\n---\\n'\n"
            "        '\\n# Solo\\n\\n## Overview\\nNo example.\\n'\n"
            "    )\n"
            "    s = scan_agents(td)[0]\n"
            "    print('subagent_type=\"solo\"' in s.usage_example,\n"
            "          '```python' in s.usage_example)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_format_readme_table(self) -> None:
        """Markdown output has a catalogue table with Name/Description/Tools header."""
        result = self._run_py(
            "from platxa_agent_generator.agent_readme_generator import AgentSummary, format_readme\n"
            "summaries = [\n"
            "    AgentSummary(name='a', description='First',\n"
            "                 tools=['Read'], usage_example='use a'),\n"
            "    AgentSummary(name='b', description='Second',\n"
            "                 tools=['Grep', 'Glob'], usage_example='use b'),\n"
            "]\n"
            "md = format_readme(summaries, title='Demo Agents')\n"
            "print('# Demo Agents' in md,\n"
            "      '| Name | Description | Tools |' in md,\n"
            "      '`a`' in md, 'First' in md,\n"
            "      'Grep, Glob' in md,\n"
            "      '### `a`' in md, 'use a' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True True True"

    def test_format_readme_escapes_pipe_in_description(self) -> None:
        """Pipes in descriptions are escaped so they don't break the table."""
        result = self._run_py(
            "from platxa_agent_generator.agent_readme_generator import AgentSummary, format_readme\n"
            "summaries = [\n"
            "    AgentSummary(name='weird',\n"
            "                 description='uses a | pipe char',\n"
            "                 tools=['Read'])\n"
            "]\n"
            "md = format_readme(summaries)\n"
            "# The data row has 4 structural pipes (outer+inner) plus one\n"
            "# escaped pipe in the description — total 5 pipe chars.\n"
            "# The escape sequence \\| must appear so Markdown renders\n"
            "# the description cell correctly.\n"
            "data_row = [l for l in md.splitlines()\n"
            "            if l.startswith('| `weird`')][0]\n"
            "print(data_row.count('|'), '\\\\|' in data_row)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "5 True"

    def test_format_readme_empty(self) -> None:
        """Empty summaries produce a valid 'No agents found.' README."""
        result = self._run_py(
            "from platxa_agent_generator.agent_readme_generator import format_readme\n"
            "md = format_readme([])\n"
            "print('# Agents' in md, 'No agents found.' in md)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_generate_writes_readme_next_to_agents(self) -> None:
        """generate_agent_readme defaults output to <dir>/README.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import generate_agent_readme\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    (Path(td) / 'x.md').write_text(\n"
            "        '---\\nname: x\\ndescription: Does x\\ntools: Read\\n---\\n'\n"
            "    )\n"
            "    out = generate_agent_readme(td)\n"
            "    content = out.read_text()\n"
            "    print(out.name, '| Name |' in content,\n"
            "          '`x`' in content, 'Does x' in content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "README.md True True True"

    def test_generate_respects_custom_output_path(self) -> None:
        """Explicit output_path overrides the default agents_dir/README.md."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_readme_generator import generate_agent_readme\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    agents = Path(td) / 'agents'\n"
            "    agents.mkdir()\n"
            "    (agents / 'y.md').write_text(\n"
            "        '---\\nname: y\\ndescription: d\\n---\\n'\n"
            "    )\n"
            "    target = Path(td) / 'docs' / 'AGENTS.md'\n"
            "    out = generate_agent_readme(agents, target, title='Custom')\n"
            "    print(out == target, target.exists(),\n"
            "          '# Custom' in target.read_text())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"
