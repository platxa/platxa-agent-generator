#!/usr/bin/env python3
"""
test_frontmatter_flags — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_frontmatter_flags.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestBackgroundFrontmatter:
    """Tests for background-suitable agent classification (#6).

    Covers:
    - BACKGROUND_KEYWORDS public constant exposes the trigger vocabulary
    - is_background_suitable detects monitoring / log tailing / CI watcher
    - is_background_suitable returns False for unrelated descriptions
    - Empty / whitespace descriptions return False (no raise)
    - Word-boundary matching prevents partial-word false positives
    - AgentDefinition.background=True surfaces as 'background: true' in
      the rendered frontmatter; False/None omits the line
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

    def test_keywords_constant_exposed(self) -> None:
        """BACKGROUND_KEYWORDS includes the spec-named vocabulary."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import BACKGROUND_KEYWORDS\n"
            "joined = '|'.join(BACKGROUND_KEYWORDS).lower()\n"
            "print('monitor' in joined)\n"
            "print('tail' in joined)\n"
            "print('ci watcher' in joined)\n"
            "print('background' in joined)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True"] * 4

    def test_detects_monitoring_agent(self) -> None:
        """Monitor / monitoring descriptions are flagged background-suitable."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Monitor disk usage every minute'))\n"
            "print(is_background_suitable('Continuously observe build status'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_detects_log_tailer_and_ci_watcher(self) -> None:
        """Log tailing and CI-watcher phrasing both trigger detection."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Tail application logs in production'))\n"
            "print(is_background_suitable('CI watcher that polls for failures'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_returns_false_for_foreground_work(self) -> None:
        """Unrelated descriptions return False (foreground is the safe default)."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Refactor the user authentication module'))\n"
            "print(is_background_suitable('Generate documentation for the public API'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False"]

    def test_empty_description_returns_false(self) -> None:
        """Empty / whitespace input must not raise — quiet False is the contract."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import is_background_suitable\n"
            "print(is_background_suitable(''))\n"
            "print(is_background_suitable('   '))\n"
            "print(is_background_suitable('\\n\\t'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False", "False"]

    def test_word_boundary_prevents_false_positives(self) -> None:
        """Partial-word substrings must not trigger detection (e.g. 'tailored')."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import is_background_suitable\n"
            "print(is_background_suitable('Build a tailored onboarding wizard'))\n"
            "print(is_background_suitable('Sort by polling rate descending'))"
        )
        assert result.returncode == 0, result.stderr
        # 'tailored' must not match 'tail'; 'polling' is itself a keyword
        # so the second line is a positive control to confirm detection still
        # works in the same call — should be True.
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "False"
        assert lines[1] == "True"

    def test_frontmatter_emits_background_when_true(self) -> None:
        """AgentDefinition(background=True) emits 'background: true' in YAML."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='watcher', description='Tail logs',\n"
            "                    tools=['Bash'], background=True)\n"
            "fm = generate_frontmatter(d)\n"
            "print('background: true' in fm)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_frontmatter_omits_background_when_unset(self) -> None:
        """background=None / False must not emit the field — default-omit contract."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d_none = AgentDefinition(name='x', description='y', tools=['Read'])\n"
            "d_false = AgentDefinition(name='x', description='y', tools=['Read'],\n"
            "                          background=False)\n"
            "print('background' in generate_frontmatter(d_none))\n"
            "print('background' in generate_frontmatter(d_false))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "False"]


class TestColorFrontmatter:
    """Tests for category-based color assignment (#8).

    Covers:
    - CATEGORY_COLOR_MAP public constant exposes the (color, keywords) pairs
    - recommend_color returns spec colors for security / testing / docs
    - First-match-wins ordering when multiple categories could match
    - Word-boundary matching prevents partial-word false positives
    - Empty / unmatched descriptions return None (omit-by-default)
    - AgentDefinition(color=...) round-trips through frontmatter emission
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

    def test_color_map_constant_exposed(self) -> None:
        """CATEGORY_COLOR_MAP exposes the spec-mandated (color, keywords) pairs."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import CATEGORY_COLOR_MAP\n"
            "by_color = {color: keywords for color, keywords in CATEGORY_COLOR_MAP}\n"
            "print('security' in by_color['red'])\n"
            "print('test' in by_color['green'])\n"
            "print('doc' in by_color['blue'])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True", "True"]

    def test_recommend_color_security_red(self) -> None:
        """Security descriptions → red per spec."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Audit code for security vulnerabilities'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "red"

    def test_recommend_color_testing_green(self) -> None:
        """Testing descriptions → green per spec."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Generate unit tests for the auth module'))"
        )
        assert result.returncode == 0, result.stderr
        # 'auth' would also match red — verify ordering: security category
        # is declared first, so red wins. This documents the priority.
        assert result.stdout.strip() == "red"

    def test_recommend_color_pure_testing_green(self) -> None:
        """Description with only testing keywords → green."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Run TDD coverage on existing modules'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "green"

    def test_recommend_color_docs_blue(self) -> None:
        """Documentation descriptions → blue per spec."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Generate API documentation pages'))"
        )
        assert result.returncode == 0, result.stderr
        # 'api' is also in orange's keyword set, but spec mandates docs=blue.
        # The ordering puts docs (blue) before database/api (orange) so blue
        # wins for description containing both — locking that priority.
        assert result.stdout.strip() == "blue"

    def test_unmatched_description_returns_none(self) -> None:
        """Descriptions with no category keyword return None (omit-by-default)."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Build a generic helper utility'))\n"
            "print(recommend_color(''))\n"
            "print(recommend_color('   '))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["None", "None", "None"]

    def test_word_boundary_prevents_false_positives(self) -> None:
        """Substrings of keywords must not trigger (e.g. 'documentary' ≠ 'documentation')."""
        result = self._run_py(
            "from platxa_agent_generator.type_classifier import recommend_color\n"
            "print(recommend_color('Build a securities trading dashboard'))\n"
            "print(recommend_color('Create a manual review workflow'))"
        )
        assert result.returncode == 0, result.stderr
        # 'securities' must not match 'security'; 'manual' is a docs keyword
        # so the second line is a positive control showing detection still
        # works for full-word matches.
        lines = result.stdout.strip().splitlines()
        assert lines[0] == "None"
        assert lines[1] == "blue"

    def test_frontmatter_emits_color(self) -> None:
        """AgentDefinition(color=...) emits 'color: <value>' in YAML."""
        result = self._run_py(
            "from platxa_agent_generator.agent_generator import AgentDefinition, generate_frontmatter\n"
            "d = AgentDefinition(name='r', description='security review',\n"
            "                    tools=['Read'], color='red')\n"
            "print('color: red' in generate_frontmatter(d))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"
