#!/usr/bin/env python3
"""
test_analyzer — sharded from test_generator.py.

Shards: 1 TestXxx classes.
Run with: pytest tests/test_analyzer.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestAgentAnalyzer:
    """Tests for agent_analyzer.py and the ``analyze-agent`` CLI command (feature #63).

    Covers:
    - analyze_agent runs syntax + security + quality on the file
    - missing_field improvements detect absent model/maxTurns/version
    - context improvements catch missing description and overlong description
    - missing Examples section is surfaced as a context issue
    - improvements_by_category groups correctly
    - Sort order: critical → high → medium → low
    - File-not-found raises FileNotFoundError
    - format_analysis_report renders categories and severities
    - CLI: 'analyze-agent path' returns 0 and prints report
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

    def test_analyze_runs_full_pipeline(self) -> None:
        """analyze_agent populates syntax/security/quality fields."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: Analyzes code for issues\\ntools: Read, Grep\\n---\\n# Agent\\n## Overview\\nDoes things.\\n## Workflow\\n1. step\\n## Examples\\n- ex1')\n"
            "    r = analyze_agent(p)\n"
            "    print(isinstance(r.syntax_passed, bool),"
            " isinstance(r.security_score, (int, float)),"
            " isinstance(r.quality_score, (int, float)),"
            " r.path == str(p))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_missing_optional_fields_flagged(self) -> None:
        """Absent model/maxTurns/version each become missing_field improvements."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nx')\n"
            "    r = analyze_agent(p)\n"
            "    cats = [i.category for i in r.improvements]\n"
            "    summaries = [i.summary for i in r.improvements]\n"
            "    print('missing_field' in cats,"
            " any('model' in s for s in summaries),"
            " any('maxTurns' in s for s in summaries),"
            " any('version' in s for s in summaries))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True"

    def test_overlong_description_flagged(self) -> None:
        """Description >1024 chars produces a high-severity context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "long_desc = 'x' * 1500\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text(f'---\\nname: a\\ndescription: {long_desc}\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    ctx = [i for i in r.improvements if i.category == 'context']\n"
            "    print(any(i.severity == 'high' and 'exceeds' in i.summary for i in ctx))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_missing_description_flagged_high(self) -> None:
        """No description produces a high-severity context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    print(any(i.category == 'context' and i.severity == 'high'"
            " and 'description' in i.summary.lower() for i in r.improvements))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_missing_examples_section_flagged(self) -> None:
        """No Examples section surfaces a context improvement."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Overview\\nbody')\n"
            "    r = analyze_agent(p)\n"
            "    print(any(i.category == 'context' and 'Examples' in i.summary"
            " for i in r.improvements))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_improvements_by_category_grouping(self) -> None:
        """improvements_by_category returns all 3 keys, with correct grouping."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent, IMPROVEMENT_CATEGORIES\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    g = r.improvements_by_category()\n"
            "    print(set(g.keys()) == set(IMPROVEMENT_CATEGORIES),"
            " all(i.category == c for c, items in g.items() for i in items))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_severity_sort_order(self) -> None:
        """Improvements are sorted by severity (critical → high → medium → low)."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent, IMPROVEMENT_SEVERITY_ORDER\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    severities = [i.severity for i in r.improvements]\n"
            "    indices = [IMPROVEMENT_SEVERITY_ORDER.index(s) for s in severities]\n"
            "    print(indices == sorted(indices))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_file_not_found_raises(self) -> None:
        """analyze_agent raises FileNotFoundError on missing file."""
        result = self._run_py(
            "from platxa_agent_generator.agent_analyzer import analyze_agent\n"
            "try:\n"
            "    analyze_agent('/tmp/__definitely_not_a_real_agent__.md')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_format_analysis_report_includes_sections(self) -> None:
        """Human-readable report includes the category headers when issues exist."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_analyzer import analyze_agent, format_analysis_report\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ntools: Read\\n---\\n# A')\n"
            "    r = analyze_agent(p)\n"
            "    text = format_analysis_report(r)\n"
            "    print('Agent Analysis' in text,"
            " '[MISSING_FIELD]' in text or '[CONTEXT]' in text,"
            " 'Improvement Recommendations' in text)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_cli_analyze_agent_runs(self) -> None:
        """`platxa-agent analyze-agent path` returns 0 and prints the report."""
        result = self._run_py(
            "import tempfile, sys\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.cli import CLI\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'a.md'\n"
            "    p.write_text('---\\nname: a\\ndescription: d\\ntools: Read\\n---\\n# A\\n## Examples\\n- e')\n"
            "    rc = CLI().run(['analyze-agent', str(p)])\n"
            "    print(rc)"
        )
        assert result.returncode == 0, result.stderr
        # First line should be "0" (return code); the analyzer's report goes to stdout above it.
        lines = [line for line in result.stdout.strip().split("\n") if line]
        assert lines[-1] == "0"

    def test_cli_analyze_agent_missing_returns_1(self) -> None:
        """Missing file → return code 1, error printed."""
        result = self._run_py(
            "from platxa_agent_generator.cli import CLI\n"
            "rc = CLI().run(['analyze-agent', '/tmp/__nope__.md'])\n"
            "print('RC=', rc)"
        )
        assert result.returncode == 0, result.stderr
        assert "RC= 1" in result.stdout
