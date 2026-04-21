#!/usr/bin/env python3
"""
test_dryrun — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_dryrun.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestDryRunPreviewEnhancements:
    """Tests for dry-run mode token count + quality prediction (Feature #45).

    Validates the feature's three new guarantees layered on the existing
    preview behavior:
    - complete preview (frontmatter + body) is returned
    - token estimate is computed per file and aggregated
    - quality estimate is predicted for the agent file
    - NO files are written to disk at any point
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    # --- token estimation --------------------------------------------------

    def test_estimate_tokens_empty_string_is_zero(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.dry_run import estimate_tokens; print(estimate_tokens(''))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0"

    def test_estimate_tokens_scales_with_content_length(self) -> None:
        """Longer content must yield a larger token estimate."""
        result = self._run_py(
            "from platxa_agent_generator.dry_run import estimate_tokens; "
            "short = estimate_tokens('hi'); "
            "long = estimate_tokens('x' * 1000); "
            "print(f'{short} {long}')"
        )
        assert result.returncode == 0, result.stderr
        short, long = map(int, result.stdout.split())
        assert short < long
        assert short >= 1
        assert long >= 100

    def test_estimate_tokens_is_non_negative(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.dry_run import estimate_tokens; "
            "vals = [estimate_tokens(s) for s in "
            "['', 'a', 'hello world', '### heading\\n\\ntext']]; "
            "print(all(v >= 0 for v in vals))"
        )
        assert result.stdout.strip() == "True"

    # --- quality estimation ------------------------------------------------

    def test_estimate_quality_returns_none_for_empty(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.dry_run import estimate_quality; print(estimate_quality('') is None)"
        )
        assert result.stdout.strip() == "True"

    def test_estimate_quality_returns_structured_report(self) -> None:
        """Valid agent content must produce a QualityEstimate with score+grade+criteria."""
        agent_md = (
            "---\n"
            "name: demo-agent\n"
            "description: A demonstration agent used by dry-run tests\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# Demo Agent\n\n"
            "## Overview\nDemonstrates dry-run quality scoring.\n\n"
            "## Workflow\n1. Read\n2. Grep\n3. Report\n\n"
            "## Examples\n### Example 1\nSearch for TODO comments.\n\n"
            '## Output Format\n```json\n{"status": "ok"}\n```\n'
        )
        code = (
            "import json\n"
            "from platxa_agent_generator.dry_run import estimate_quality\n"
            f"q = estimate_quality({agent_md!r})\n"
            "print(json.dumps({"
            "'has_score': q is not None and 0.0 <= q.score <= 10.0, "
            "'grade': q.grade if q else '', "
            "'criteria_count': len(q.criteria) if q else 0, "
            "'passed_is_bool': isinstance(q.passed, bool) if q else False"
            "}))"
        )
        result = self._run_py(code)
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["has_score"]
        assert data["grade"] in ("A", "B", "C", "D", "F")
        assert data["criteria_count"] >= 4
        assert data["passed_is_bool"]

    # --- end-to-end dry_run ------------------------------------------------

    def test_dry_run_writes_no_files_to_disk(self, tmp_path: Path) -> None:
        """The whole point of dry-run: no files appear on disk."""
        result = self._run_py(
            "from platxa_agent_generator.dry_run import dry_run; "
            "r = dry_run(name='x-agent', description='X agent for tests', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r}); "
            "print(len(r.files))"
        )
        assert result.returncode == 0, result.stderr
        assert int(result.stdout.strip()) >= 1
        leaf_files = [p for p in tmp_path.rglob("*") if p.is_file()]
        assert leaf_files == [], f"dry-run created files: {leaf_files}"

    def test_dry_run_includes_complete_preview_content(self, tmp_path: Path) -> None:
        """Each FilePreview must carry the actual file content (frontmatter + body)."""
        code = (
            "from platxa_agent_generator.dry_run import dry_run\n"
            "r = dry_run(name='complete-agent', description='Full preview test', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r})\n"
            "agent = next(f for f in r.files if f.path.endswith('complete-agent.md') "
            "and 'commands' not in f.path)\n"
            "print('FRONTMATTER:', agent.content.startswith('---'))\n"
            "print('HAS_NAME:', 'name: complete-agent' in agent.content)\n"
            "print('HAS_BODY:', '## Overview' in agent.content "
            "or '## Workflow' in agent.content)"
        )
        result = self._run_py(code)
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert all("True" in ln for ln in lines), result.stdout

    def test_dry_run_stamps_token_estimate_on_every_preview(self, tmp_path: Path) -> None:
        """Every FilePreview in the result must carry a positive token_estimate."""
        result = self._run_py(
            "from platxa_agent_generator.dry_run import dry_run\n"
            "r = dry_run(name='token-agent', description='Token estimate test', "
            f"tools=['Read','Grep'], output_base={str(tmp_path)!r})\n"
            "print(all(f.token_estimate > 0 for f in r.files))\n"
            "print(r.total_tokens == sum(f.token_estimate for f in r.files))\n"
            "print(r.total_tokens > 0)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True", "True"]

    def test_dry_run_produces_quality_estimate_for_agent(self, tmp_path: Path) -> None:
        """result.quality must be a QualityEstimate when an agent file is previewed."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.dry_run import dry_run\n"
            "r = dry_run(name='quality-agent', description='Quality prediction test', "
            f"tools=['Read','Grep','Glob'], output_base={str(tmp_path)!r})\n"
            "q = r.quality\n"
            "print(json.dumps({"
            "'present': q is not None, "
            "'score_in_range': q is not None and 0.0 <= q.score <= 10.0, "
            "'grade_valid': q is not None and q.grade in ('A','B','C','D','F'), "
            "'criteria_count': len(q.criteria) if q else 0"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["present"]
        assert data["score_in_range"]
        assert data["grade_valid"]
        assert data["criteria_count"] >= 4

    def test_result_to_dict_exposes_tokens_and_quality(self, tmp_path: Path) -> None:
        """Serialized result must include total_tokens, quality, and per-file token_estimate."""
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.dry_run import dry_run, result_to_dict\n"
            "r = dry_run(name='dict-agent', description='Dict serialization test', "
            f"tools=['Read'], output_base={str(tmp_path)!r})\n"
            "d = result_to_dict(r)\n"
            "print(json.dumps({"
            "'has_total_tokens': 'total_tokens' in d and d['total_tokens'] > 0, "
            "'has_quality': 'quality' in d and d['quality'] is not None, "
            "'per_file_tokens': all('token_estimate' in f for f in d['files'])"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["has_total_tokens"]
        assert data["has_quality"]
        assert data["per_file_tokens"]

    def test_cli_text_output_includes_tokens_and_quality(self, tmp_path: Path) -> None:
        """CLI text output must surface token totals and quality verdict."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "dry_run.py"),
                "--name",
                "cli-agent",
                "--description",
                "CLI test of dry-run output",
                "--tools",
                "Read,Grep",
                "--output-base",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        out = result.stdout
        assert "tokens" in out.lower()
        assert "Quality prediction" in out
        assert list(tmp_path.rglob("*.md")) == []

    def test_cli_json_output_carries_quality_block(self, tmp_path: Path) -> None:
        """--output-json must include `quality` and `total_tokens` keys."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "dry_run.py"),
                "--name",
                "json-agent",
                "--description",
                "JSON test of dry-run output",
                "--tools",
                "Read",
                "--output-json",
                "--output-base",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert "total_tokens" in data
        assert data["total_tokens"] > 0
        assert "quality" in data
        assert data["quality"] is not None
        assert "score" in data["quality"]
        assert "grade" in data["quality"]


class TestDryRunImportBroken:
    """Tests for dry_run._load_sibling_module narrowing (Feature #16).

    Previously ``_load_sibling_module`` caught every exception raised by
    ``spec.loader.exec_module`` with ``except Exception: return None``,
    and the first-try relative import caught ``(ImportError, TypeError)``
    to paper over a call that was fundamentally wrong when
    ``__package__`` was not a real package. When a generator module
    (e.g. ``agent_generator.py``) developed a ``SyntaxError`` in its
    body, the broad except silently converted it to ``None`` and
    ``--dry-run`` quietly fell back to the embedded fallback templates —
    users saw output that looked correct and never learned their
    generator was broken.

    The fix has two parts:

    - **First-try guard.** The relative import ``importlib.import_module(".mod",
      package=__package__)`` is only meaningful when ``__package__`` is
      a non-empty string. Otherwise it raises ``TypeError`` ("the
      'package' argument is required to perform a relative import") on
      Python 3.12, which the old code silently swallowed. Guarding with
      ``if __package__`` eliminates the TypeError path at its source,
      so the narrowed ``except ImportError`` is sufficient for the real
      failure mode (sibling missing inside a real package).
    - **Second-try narrowing.** The exec_module catch is narrowed to
      ``except ImportError`` so ``SyntaxError``, ``RuntimeError``, and
      any other programmer error surfaces to the caller. The partial
      registration in ``sys.modules`` is popped on both the
      ImportError path and the propagation path to avoid leaving stale
      state that would mask a retry.

    Baseline preserved: a sibling that simply does not exist on disk
    still returns ``None`` — that is the legitimate "module not
    available" signal, not a bug indicator.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_missing_module_returns_none(self, tmp_path: Path) -> None:
        """When the sibling module file does not exist on disk,
        ``_load_sibling_module`` must return ``None`` — the baseline
        "module not available" signal.

        Exercises the disk-lookup branch end-to-end: we relocate the
        ``__file__`` of dry_run to an empty tmp dir so the script-dir
        path search finds nothing, then assert None is returned without
        raising. This must not regress after the narrowing.
        """
        result = self._run_py(
            "import sys\n"
            ""
            "from platxa_agent_generator import dry_run\n"
            # Redirect the script dir to an empty tmp path so the disk
            # lookup finds nothing.
            f"dry_run.__file__ = {str(tmp_path / 'dry_run.py')!r}\n"
            "result = dry_run._load_sibling_module('nonexistent_sibling_abc123')\n"
            "print('result_is_none:', result is None)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "result_is_none: True" in result.stdout

    def test_syntax_error_propagates(self, tmp_path: Path) -> None:
        """A sibling module whose body contains a ``SyntaxError`` must
        raise that SyntaxError up to the caller — not be silently
        swallowed and converted to ``None``.

        This is the bug the narrowing fixes: under the old
        ``except Exception`` clause, a broken generator disabled
        ``--dry-run`` with no signal. Now the SyntaxError propagates
        so the user sees the real problem in the real file.
        """
        # Write a sibling module with invalid Python syntax into a tmp
        # dir, then point dry_run.__file__ at that dir so the script-dir
        # lookup finds and attempts to exec it.
        broken = tmp_path / "broken_sibling.py"
        broken.write_text("def foo(\n    # unterminated parameter list\n", encoding="utf-8")
        fake_script = tmp_path / "dry_run.py"
        fake_script.touch()

        result = self._run_py(
            "import sys\n"
            ""
            "from platxa_agent_generator import dry_run\n"
            f"dry_run.__file__ = {str(fake_script)!r}\n"
            # Purge any prior registration so exec_module is actually
            # invoked against our broken file.
            "sys.modules.pop('broken_sibling', None)\n"
            "try:\n"
            "    dry_run._load_sibling_module('broken_sibling')\n"
            "    print('outcome: silently_returned')\n"
            "except SyntaxError as e:\n"
            "    print('outcome: syntax_error_raised')\n"
            # sys.modules must be cleaned up on the propagation path so
            # a retry does not see stale state.
            "    print('sys_modules_clean:', 'broken_sibling' not in sys.modules)\n"
            "except BaseException as e:\n"
            "    print(f'outcome: unexpected_{type(e).__name__}')\n"
        )
        assert result.returncode == 0, result.stderr
        assert "outcome: syntax_error_raised" in result.stdout, result.stdout
        assert "sys_modules_clean: True" in result.stdout, result.stdout
