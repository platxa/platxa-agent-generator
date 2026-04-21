#!/usr/bin/env python3
"""
test_thinking — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_thinking.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestExtendedThinkingLoadHistory:
    """Tests for extended_thinking.py per-record load handling (Feature #13).

    ``_load_usage_history`` previously wrapped the entire per-record loop
    in one ``except (json.JSONDecodeError, OSError, KeyError)`` that caught
    and silently dropped the exception. When a single record in the file
    was malformed (missing a required key like ``task_id``), the KeyError
    aborted the loop, leaving only the records loaded before the bad one
    in memory. On the next ``_save_usage_history`` write, the file was
    rewritten from that partial in-memory list, silently destroying the
    valid records that appeared AFTER the bad one on disk.

    The fix:
    - Keep the outer try/except for whole-file failures (JSONDecodeError
      and OSError from the initial read).
    - Add a per-record try/except INSIDE the loop that catches KeyError
      (and re-catches JSONDecodeError for belt-and-suspenders), logs a
      stderr warning naming the record index, and ``continue``s so
      subsequent valid records still load.
    - Resulting ``_usage_records`` contains every well-formed record,
      regardless of where the bad ones sit in the file.
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

    def test_bad_record_skipped_not_drops(self) -> None:
        """A single bad record mid-file must not abort load of later records.

        Writes a 3-record file where record #2 is missing ``task_id``
        (forces KeyError inside ThinkingUsageRecord construction).
        Asserts:
        - Exactly 2 valid records are loaded (the first and third).
        - stderr contains a warning naming the failing record.
        - The file bytes on disk are unchanged (load does not rewrite).
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "good_1 = {\n"
            "    'task_id': 'task-1', 'task_description': 'first',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.3,\n"
            "    'started_at': '2026-04-20T00:00:00'}\n"
            "bad = {\n"
            "    'task_description': 'missing task_id',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.4,\n"
            "    'started_at': '2026-04-20T00:01:00'}\n"
            "good_3 = {\n"
            "    'task_id': 'task-3', 'task_description': 'third',\n"
            "    'intensity_used': 'think', 'complexity_score': 0.5,\n"
            "    'started_at': '2026-04-20T00:02:00'}\n"
            "payload = json.dumps({'schema_version': '1.0.0',\n"
            "    'last_updated': '2026-04-20T00:03:00',\n"
            "    'records': [good_1, bad, good_3]}, indent=2)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'thinking_usage.json'\n"
            "    path.write_text(payload, encoding='utf-8')\n"
            "    original_bytes = path.read_bytes()\n"
            "    integ = ThinkingIntegration(usage_log_path=path)\n"
            "    recs = integ._usage_records\n"
            "    ids = [r.task_id for r in recs]\n"
            "    print('count:', len(recs))\n"
            "    print('ids:', ','.join(ids))\n"
            "    # File on disk must be byte-identical after load\n"
            "    print('unchanged:', path.read_bytes() == original_bytes)\n"
        )
        assert result.returncode == 0, result.stderr
        assert "count: 2" in result.stdout
        assert "ids: task-1,task-3" in result.stdout
        assert "unchanged: True" in result.stdout
        # stderr must name the failing record index and the error class.
        assert "KeyError" in result.stderr or "task_id" in result.stderr
        # Some identifier of the record position should appear (index 1
        # == second record) so operators can find the bad entry.
        assert "1" in result.stderr or "record" in result.stderr.lower()

    def test_all_good_records_load(self) -> None:
        """Baseline: all-valid file loads every record with no stderr noise.

        Regression guard — if the per-record error path accidentally
        fires for well-formed records, this test catches it.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "records = [\n"
            "    {'task_id': f'task-{i}', 'task_description': f'desc-{i}',\n"
            "     'intensity_used': 'think', 'complexity_score': 0.1 * i,\n"
            "     'started_at': '2026-04-20T00:00:00'}\n"
            "    for i in range(1, 4)]\n"
            "payload = json.dumps({'schema_version': '1.0.0',\n"
            "    'last_updated': '2026-04-20T00:03:00',\n"
            "    'records': records}, indent=2)\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    path = Path(td) / 'thinking_usage.json'\n"
            "    path.write_text(payload, encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=path)\n"
            "    recs = integ._usage_records\n"
            "    print('count:', len(recs))\n"
            "    print('ids:', ','.join(r.task_id for r in recs))\n"
        )
        assert result.returncode == 0, result.stderr
        assert "count: 3" in result.stdout
        assert "ids: task-1,task-2,task-3" in result.stdout
        # No per-record warning should fire on a clean file.
        assert "KeyError" not in result.stderr


class TestExtendedThinking:
    """Tests for extended_thinking.py public surface (feature #19).

    The 955-LOC ``extended_thinking`` module previously had coverage
    only for the narrow per-record load path (``TestExtendedThinkingLoadHistory``,
    feature #13) and a single save-OSError case (``TestSilentWriteSurfacing``,
    feature #14). The rest of the module — the ComplexityAnalyzer that
    every agent-generation path consults to pick thinking intensity,
    the ``analyze_for_agent_generation`` convenience entry point, the
    ``intensity_to_effort`` mapping that flows into agent frontmatter,
    and the start/complete/save round-trip used by the thinking
    session tracker — was untested.

    Coverage:
    - ComplexityAnalyzer scoring: base-score bands (0/1/2+ high matches,
      1/2+ medium matches), dimension context boosts (file_count,
      integration_count, handles_auth), weighted overall-complexity
      aggregation, empty-input zero, confidence reporting.
    - ``analyze_complexity`` ⇒ ThinkingRecommendation: should_use
      threshold (0.35), intensity selection at each threshold band
      (0.25 / 0.45 / 0.65 / 0.85).
    - ``analyze_for_agent_generation``: simple/orchestrator/multi-agent
      context injection, ``has_mcp_integrations`` → integration_count
      pass-through.
    - ``intensity_to_effort`` + ``INTENSITY_TO_EFFORT``: all four
      intensities map to the documented effort level, table
      completeness pin, unknown trigger falls back to 'medium'.
    - Usage history round-trip: start/complete session flow,
      save-then-reload preserves records and intensity enum, unknown
      intensity in file falls back to STANDARD, malformed record is
      skipped without aborting the surrounding records (pins #13
      behavior from the public-API angle, not the internal error path).
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

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — base-score bands
    # ------------------------------------------------------------------

    def test_analyzer_no_matches_gives_baseline_score(self) -> None:
        """A task with no matching patterns scores 0.1 on every dimension.

        Pins the ``else: base_score = 0.1`` fallback in
        ``_score_dimension``. If the baseline shifts, every downstream
        intensity decision shifts with it.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import ComplexityAnalyzer\n"
            "scores = ComplexityAnalyzer().analyze('hello world')\n"
            "print(all(round(s.score, 2) == 0.1 for s in scores))\n"
            "print(all(round(s.confidence, 2) == 0.3 for s in scores))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_analyzer_single_high_pattern_scores_0_7(self) -> None:
        """One matching high-complexity pattern yields base score 0.7.

        Pins the ``elif high_matches == 1: base_score = 0.7`` branch —
        the tier that pushes a task across the HIGH intensity threshold
        (0.65) when combined with confidence weighting.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze('please architect this')\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.7"

    def test_analyzer_two_high_patterns_scores_0_9(self) -> None:
        """Two high-complexity pattern matches saturate at 0.9.

        Pins the ``if high_matches >= 2: base_score = 0.9`` top band —
        the tier that reliably crosses MAXIMUM intensity (0.85).
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # Both 'architect' and 'design.*system' match architectural-high.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'architect and design this system thoroughly')\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.9"

    def test_analyzer_single_medium_pattern_scores_0_3(self) -> None:
        """One medium-pattern-only match yields base score 0.3."""
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # 'debug' matches DEBUGGING medium.
            "scores = ComplexityAnalyzer().analyze('please debug this')\n"
            "dbg = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.DEBUGGING][0]\n"
            "print(round(dbg.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_two_medium_patterns_score_0_5(self) -> None:
        """Two medium-pattern matches (with zero high matches) yield 0.5.

        Pins the ``elif medium_matches >= 2: base_score = 0.5`` band —
        the mid-tier that nudges a task into the INCREASED intensity
        (0.45) range.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            # 'debug' + 'fix bug' both match DEBUGGING medium patterns.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'debug and fix bug in module')\n"
            "dbg = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.DEBUGGING][0]\n"
            "print(round(dbg.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.5"

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — dimension context boosts
    # ------------------------------------------------------------------

    def test_analyzer_file_count_boosts_architectural_over_10(self) -> None:
        """``file_count > 10`` adds +0.2 to the architectural dimension.

        Baseline score is 0.1; with a 15-file context the score lifts
        to 0.3 (clamped to 1.0 ceiling). Pins the upper-tier branch.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'plain text', context={'file_count': 15})\n"
            "arch = [s for s in scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_handles_auth_boosts_security(self) -> None:
        """``handles_auth=True`` adds +0.2 to the security dimension.

        Pins that security context signals stack: a plain description
        with an auth context yields 0.1 (baseline) + 0.2 = 0.3.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'plain text', context={'handles_auth': True})\n"
            "sec = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.SECURITY][0]\n"
            "print(round(sec.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.3"

    def test_analyzer_handles_auth_and_pii_stacks_security_boost(self) -> None:
        """``handles_auth`` and ``handles_pii`` both trigger +0.2 each."""
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ComplexityAnalyzer, ComplexityDimension,\n"
            ")\n"
            "scores = ComplexityAnalyzer().analyze('plain text',\n"
            "    context={'handles_auth': True, 'handles_pii': True})\n"
            "sec = [s for s in scores\n"
            "       if s.dimension == ComplexityDimension.SECURITY][0]\n"
            "print(round(sec.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        # 0.1 baseline + 0.2 auth + 0.2 pii = 0.5
        assert result.stdout.strip() == "0.5"

    # ------------------------------------------------------------------
    # ComplexityAnalyzer — overall complexity aggregation
    # ------------------------------------------------------------------

    def test_calculate_overall_complexity_empty_returns_zero(self) -> None:
        """An empty score list returns 0.0 (guards div-by-zero).

        Pins the ``if total_weight == 0: return 0.0`` early-exit.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import ComplexityAnalyzer\n"
            "print(ComplexityAnalyzer().calculate_overall_complexity([]))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.0"

    def test_calculate_overall_complexity_weights_by_confidence(self) -> None:
        """Overall complexity multiplies per-dimension weight by confidence.

        Checks the invariant: a high-score/high-confidence dimension
        dominates a low-score/low-confidence one even when their raw
        dimension weights are close. Confidence scaling is the
        difference between 'flagged one word as serious' and 'this
        task is definitely serious'.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import ComplexityAnalyzer\n"
            # Two high architectural patterns -> 0.9 score, 0.7 confidence.
            "scores = ComplexityAnalyzer().analyze(\n"
            "    'architect and design this system')\n"
            "overall = ComplexityAnalyzer().calculate_overall_complexity(scores)\n"
            # Must be clearly above the baseline 0.1 that a no-match
            # task would produce.
            "print(overall > 0.15)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    # ------------------------------------------------------------------
    # ThinkingIntegration.analyze_complexity — end-to-end
    # ------------------------------------------------------------------

    def test_analyze_complexity_below_threshold_disables_extended(self) -> None:
        """Overall complexity below 0.35 sets should_use_extended_thinking=False.

        Pins the ``EXTENDED_THINKING_THRESHOLD = 0.35`` gate — the
        cost/benefit line below which baseline thinking suffices.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity('hello world')\n"
            "    print(rec.should_use_extended_thinking)\n"
            "    print(rec.intensity.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "think"]

    def test_analyze_complexity_high_complexity_triggers_extended(self) -> None:
        """A task with strong architectural cues crosses the 0.35 threshold
        that flips ``should_use_extended_thinking`` to True.

        Pins that a multi-high-pattern description reliably trips the
        extended-thinking gate; the exact intensity tier above the gate
        depends on cross-dimension scoring and is covered separately by
        ``test_select_intensity_threshold_bands``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect and design distributed microservice system')\n"
            "    print(rec.should_use_extended_thinking)\n"
            "    print(rec.overall_complexity > 0.35)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    def test_select_intensity_threshold_bands(self) -> None:
        """Each INTENSITY_THRESHOLDS band maps to the documented intensity.

        Pins the ordered dict iteration behavior: the loop returns the
        FIRST intensity whose threshold the complexity meets, so the
        thresholds must stay in descending order (MAXIMUM 0.85, HIGH
        0.65, INCREASED 0.45, STANDARD 0.25). A future refactor that
        re-orders the dict would silently flip intensity selection for
        every task.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    # _select_intensity is the private slot under test.\n"
            "    for c in (0.90, 0.70, 0.50, 0.30, 0.10):\n"
            "        print(integ._select_intensity(c).trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "ultrathink",
            "think harder",
            "think hard",
            "think",
            "think",
        ]

    # ------------------------------------------------------------------
    # analyze_for_agent_generation — convenience entry point
    # ------------------------------------------------------------------

    def test_analyze_for_agent_generation_simple_is_standard(self) -> None:
        """A trivial ``simple`` agent description lands at STANDARD intensity.

        Pins the convenience-function contract: a throwaway agent
        description should not trip extended thinking.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import analyze_for_agent_generation\n"
            "rec = analyze_for_agent_generation(\n"
            "    'echo the input', agent_type='simple', tool_count=1)\n"
            "print(rec.should_use_extended_thinking)\n"
            "print(rec.intensity.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["False", "think"]

    def test_analyze_for_agent_generation_multi_agent_boosts_architectural(
        self,
    ) -> None:
        """``multi-agent`` type injects ``file_count=10`` which hits the
        ``file_count > 5`` architectural boost branch (+0.1).

        Pins the branch: ``if file_count > 10`` is False for 10 but
        the ``elif file_count > 5`` is True. A future change that
        tightens the boundary to ``>=`` would silently lose the
        multi-agent boost.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='multi-agent')\n"
            "arch = [s for s in rec.dimension_scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            # 0.1 baseline + 0.1 boost
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0.2"

    def test_analyze_for_agent_generation_orchestrator_no_boost_at_5(
        self,
    ) -> None:
        """``orchestrator`` sets ``file_count=5``, which hits NEITHER boost.

        Pins current behavior: both ``> 10`` and ``> 5`` are strict
        inequalities, so file_count=5 does not trigger the +0.1 bump.
        An operator reading the code who assumes ``>=`` semantics and
        writes code relying on orchestrator-type-boosts-architectural
        will find this test keeping them honest.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='orchestrator')\n"
            "arch = [s for s in rec.dimension_scores\n"
            "        if s.dimension == ComplexityDimension.ARCHITECTURAL][0]\n"
            "print(round(arch.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        # 0.1 baseline, no boost at exactly 5 files.
        assert result.stdout.strip() == "0.1"

    def test_analyze_for_agent_generation_mcp_flag_passes_integration_count(
        self,
    ) -> None:
        """``has_mcp_integrations=True`` passes ``integration_count=1``
        into the analyzer context.

        At integration_count=1 the INTEGRATION boost is 0 (both
        context branches need >1), but the context value must flow
        through unchanged so future tightening (``> 0``) lights up
        automatically.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    analyze_for_agent_generation, ComplexityDimension,\n"
            ")\n"
            "rec_with = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='simple',\n"
            "    has_mcp_integrations=True)\n"
            "rec_without = analyze_for_agent_generation(\n"
            "    'plain text', agent_type='simple',\n"
            "    has_mcp_integrations=False)\n"
            # The integration-dim score is identical at this boost tier,
            # but dimension_scores length and the other fields must match,
            # proving the mcp flag does not crash or mutate surrounding
            # dimensions.
            "print(len(rec_with.dimension_scores) ==\n"
            "      len(rec_without.dimension_scores))\n"
            "int_with = [s for s in rec_with.dimension_scores\n"
            "    if s.dimension == ComplexityDimension.INTEGRATION][0]\n"
            "int_without = [s for s in rec_without.dimension_scores\n"
            "    if s.dimension == ComplexityDimension.INTEGRATION][0]\n"
            "print(round(int_with.score, 2) ==\n"
            "      round(int_without.score, 2))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    # ------------------------------------------------------------------
    # INTENSITY_TO_EFFORT mapping + intensity_to_effort()
    # ------------------------------------------------------------------

    def test_intensity_to_effort_standard_is_low(self) -> None:
        """STANDARD (``think``) maps to effort='low'."""
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.STANDARD))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "low"

    def test_intensity_to_effort_increased_is_medium(self) -> None:
        """INCREASED (``think hard``) maps to effort='medium'."""
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.INCREASED))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "medium"

    def test_intensity_to_effort_high_is_high(self) -> None:
        """HIGH (``think harder``) maps to effort='high'."""
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.HIGH))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "high"

    def test_intensity_to_effort_maximum_capped_at_high(self) -> None:
        """MAXIMUM (``ultrathink``) is capped at effort='high'.

        Claude Code's ``effort`` frontmatter has only three tiers
        (low/medium/high); the module caps ultrathink at 'high' rather
        than inventing an unsupported 'max' level. Pins that cap
        explicitly so a future change to add a fourth tier has to
        update this test first.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntensity, intensity_to_effort,\n"
            ")\n"
            "print(intensity_to_effort(ThinkingIntensity.MAXIMUM))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "high"

    def test_intensity_to_effort_table_covers_all_four(self) -> None:
        """INTENSITY_TO_EFFORT contains exactly one entry per intensity.

        Completeness pin: if someone adds a fifth ThinkingIntensity
        without wiring it into the effort map, this test blows up
        before any generated agent ships with a missing effort level.
        """
        result = self._run_py(
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntensity, INTENSITY_TO_EFFORT,\n"
            ")\n"
            "enum_phrases = {i.trigger_phrase for i in ThinkingIntensity}\n"
            "table_phrases = set(INTENSITY_TO_EFFORT.keys())\n"
            "print(enum_phrases == table_phrases)\n"
            "print(len(INTENSITY_TO_EFFORT) == 4)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "True"]

    # ------------------------------------------------------------------
    # Usage-history round-trip
    # ------------------------------------------------------------------

    def test_start_thinking_session_appends_record(self) -> None:
        """``start_thinking_session`` adds an in-memory ThinkingUsageRecord."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    rec = integ.analyze_complexity('plain text')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-A', 'plain text', rec)\n"
            "    print(len(integ._usage_records))\n"
            "    print(session.task_id)\n"
            "    print(session.completed_at is None)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["1", "task-A", "True"]

    def test_complete_thinking_session_persists_and_reloads(self) -> None:
        """Completing a session writes the record to disk AND reloads cleanly.

        End-to-end round-trip: start session → complete session (which
        saves) → new ThinkingIntegration with same path → verify the
        record round-tripped with the right intensity enum and the
        completion fields.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect distributed system')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-B', 'architect', rec)\n"
            "    integ.complete_thinking_session(\n"
            "        session, outcome_quality=0.8,\n"
            "        tokens_used=1234, notes='ok')\n"
            "    # Round-trip: new integration reloads from disk.\n"
            "    integ2 = ThinkingIntegration(usage_log_path=log)\n"
            "    assert len(integ2._usage_records) == 1\n"
            "    loaded = integ2._usage_records[0]\n"
            "    print(loaded.task_id)\n"
            "    print(loaded.outcome_quality)\n"
            "    print(loaded.tokens_used)\n"
            "    print(loaded.notes)\n"
            "    print(isinstance(loaded.intensity_used, ThinkingIntensity))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "task-B",
            "0.8",
            "1234",
            "ok",
            "True",
        ]

    def test_round_trip_preserves_intensity_enum(self) -> None:
        """Save a MAXIMUM-intensity record and reload: intensity stays MAXIMUM.

        Pins the ``trigger_phrase`` string as the stable on-disk
        identifier. If the enum's trigger_phrase were ever renamed
        without migrating the file format, every loaded record would
        silently fall back to STANDARD.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [{\n"
            "            'task_id': 'max-task',\n"
            "            'task_description': 'deep', \n"
            "            'intensity_used': 'ultrathink',\n"
            "            'complexity_score': 0.9,\n"
            "            'started_at': '2026-04-21T00:00:00'}]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    r = integ._usage_records[0]\n"
            "    print(r.intensity_used is ThinkingIntensity.MAXIMUM)\n"
            "    print(r.intensity_used.trigger_phrase)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "ultrathink"]

    def test_load_unknown_intensity_falls_back_to_standard(self) -> None:
        """A record with an unrecognized ``intensity_used`` phrase loads
        as STANDARD rather than raising.

        Pins the defensive default in ``_load_usage_history``:
        ``intensity = ThinkingIntensity.STANDARD`` is the initial value
        that only gets overwritten if a phrase match is found. This
        lets the loader survive future intensity additions / renames
        without corrupting the run.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import (\n"
            "    ThinkingIntegration, ThinkingIntensity,\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [{\n"
            "            'task_id': 'unknown',\n"
            "            'task_description': 'x',\n"
            "            'intensity_used': 'telepathy',\n"
            "            'complexity_score': 0.5,\n"
            "            'started_at': '2026-04-21T00:00:00'}]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    r = integ._usage_records[0]\n"
            "    print(r.intensity_used is ThinkingIntensity.STANDARD)\n"
            "    print(r.task_id)\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["True", "unknown"]

    def test_round_trip_skips_malformed_record(self) -> None:
        """A malformed record between two valid ones is skipped; valid
        ones still load. Pins #13 behavior from the public-API angle.

        This complements ``TestExtendedThinkingLoadHistory`` (which
        pins the warning on stderr and byte-identical file) by
        asserting the end-to-end public-API contract: a corrupt log
        on disk does not crash the session tracker, and valid records
        before and after the bad one survive.
        """
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    log = Path(td) / 'usage.json'\n"
            "    good1 = {'task_id': 'g1', 'task_description': 'a',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.1,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    bad = {'task_description': 'missing id',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.2,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    good2 = {'task_id': 'g2', 'task_description': 'b',\n"
            "        'intensity_used': 'think', 'complexity_score': 0.3,\n"
            "        'started_at': '2026-04-21T00:00:00'}\n"
            "    payload = {'schema_version': '1.0.0',\n"
            "        'last_updated': '2026-04-21T00:00:00',\n"
            "        'records': [good1, bad, good2]}\n"
            "    log.write_text(json.dumps(payload), encoding='utf-8')\n"
            "    integ = ThinkingIntegration(usage_log_path=log)\n"
            "    ids = [r.task_id for r in integ._usage_records]\n"
            "    print(len(integ._usage_records))\n"
            "    print(','.join(ids))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == ["2", "g1,g2"]

    def test_get_usage_statistics_reports_counts(self) -> None:
        """``get_usage_statistics`` reports per-intensity counts and
        averages after records accumulate.

        Pins the statistics shape: callers (CLI ``stats`` subcommand,
        future dashboards) depend on the keys ``total_sessions``,
        ``average_complexity``, ``average_quality``, ``completed_sessions``,
        and ``intensity_distribution``.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.extended_thinking import ThinkingIntegration\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    integ = ThinkingIntegration(\n"
            "        usage_log_path=Path(td)/'usage.json')\n"
            "    # Empty state first.\n"
            "    empty = integ.get_usage_statistics()\n"
            "    print(empty['total_sessions'])\n"
            "    print(empty['average_complexity'])\n"
            "    # One completed session at MAXIMUM intensity.\n"
            "    rec = integ.analyze_complexity(\n"
            "        'architect and design distributed microservice system')\n"
            "    session = integ.start_thinking_session(\n"
            "        'task-C', 'architect', rec)\n"
            "    integ.complete_thinking_session(\n"
            "        session, outcome_quality=0.75)\n"
            "    stats = integ.get_usage_statistics()\n"
            "    print(stats['total_sessions'])\n"
            "    print(stats['completed_sessions'])\n"
            "    print(stats['average_quality'])\n"
            "    print(sum(stats['intensity_distribution'].values()))\n"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip().splitlines() == [
            "0",
            "0.0",
            "1",
            "1",
            "0.75",
            "1",
        ]
