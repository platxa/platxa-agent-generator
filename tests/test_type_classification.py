#!/usr/bin/env python3
"""
test_type_classification — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_type_classification.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestTypeClassifier:
    """Behavioral tests for classify() covering all 4 ArchitectureType values + 2 negative cases.

    Each test asserts BOTH the architecture_type AND the suggested_pattern the
    classifier derives from it, since downstream tool selection (architecture-subagent,
    catalog seeding) keys off the pattern string — not just the type.
    """

    @staticmethod
    def _classify(description: str) -> dict:  # type: ignore[type-arg]
        """Invoke classify() via subprocess for isolation from test-process state."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json, dataclasses; "
                    "from platxa_agent_generator.type_classifier import classify; "
                    f"print(json.dumps(dataclasses.asdict(classify({description!r}))))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"classify() failed: {result.stderr}"
        return json.loads(result.stdout.strip())

    def test_simple_type_classification(self) -> None:
        """'wrap an HTTP call' has no orchestrator/pipeline/multi-agent signal → SIMPLE."""
        r = self._classify("wrap an HTTP call")
        assert r["architecture_type"] == "simple"
        assert r["suggested_pattern"] == "prompt-chaining"

    def test_orchestrator_type_classification(self) -> None:
        """Explicit delegation + worker fan-out language → ORCHESTRATOR."""
        r = self._classify("delegate to workers, fan out subtasks")
        assert r["architecture_type"] == "orchestrator"
        assert r["suggested_pattern"] == "orchestrator-workers"

    def test_multi_agent_type_classification(self) -> None:
        """Agent-collaboration language with peer framing → MULTI_AGENT."""
        r = self._classify("agents collaborating as peers")
        assert r["architecture_type"] == "multi-agent"
        assert r["suggested_pattern"] == "parallelization"

    def test_pipeline_type_classification(self) -> None:
        """Sequential-stage language with explicit ordering → PIPELINE."""
        r = self._classify("sequential stages: fetch -> parse -> emit")
        assert r["architecture_type"] == "pipeline"
        assert r["suggested_pattern"] == "prompt-chaining"

    def test_ambiguous_defaults_to_simple(self) -> None:
        """Generic input with no architectural signal → SIMPLE with confidence < 0.5."""
        r = self._classify("do a thing")
        assert r["architecture_type"] == "simple"
        assert r["suggested_pattern"] == "prompt-chaining"
        assert r["confidence"] < 0.5, (
            f"Ambiguous default should report low confidence, got {r['confidence']}"
        )

    def test_mixed_signals_tie_breaks_to_simple(self) -> None:
        """Equal-weight indicators for two non-SIMPLE types → tie-break to SIMPLE."""
        # 'delegate' (orchestrator strong=2.0) tied with 'pipeline' (pipeline strong=2.0).
        r = self._classify("delegate pipeline")
        assert r["architecture_type"] == "simple", (
            f"Tied non-SIMPLE scores must tie-break to SIMPLE, got {r['architecture_type']}"
        )
        assert r["suggested_pattern"] == "prompt-chaining"


class TestTypeClassifierMaxTurns:
    """Tests for recommend_max_turns() in type_classifier.py."""

    def test_simple_low_complexity(self) -> None:
        """Simple agent with low complexity gets 10 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_max_turns; print(recommend_max_turns('simple', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "10"

    def test_orchestrator_default_complexity(self) -> None:
        """Orchestrator with medium complexity gets 25 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_max_turns; print(recommend_max_turns('orchestrator', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "25"

    def test_multi_agent_high_complexity(self) -> None:
        """Multi-agent with high complexity gets 75 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_max_turns; print(recommend_max_turns('multi-agent', 5))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "75"

    def test_pipeline_default_complexity(self) -> None:
        """Pipeline with medium complexity gets 25 turns."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_max_turns; print(recommend_max_turns('pipeline', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "25"

    def test_unknown_type_falls_back_to_simple(self) -> None:
        """Unknown architecture type falls back to simple defaults."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_max_turns; print(recommend_max_turns('unknown', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "15"  # simple default


class TestModelRouting:
    """Tests for recommend_model() in type_classifier.py."""

    def test_simple_low_gets_haiku(self) -> None:
        """Simple agent with low complexity gets haiku (cheapest)."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_model; print(recommend_model('simple', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "haiku"

    def test_orchestrator_default_gets_sonnet(self) -> None:
        """Orchestrator with medium complexity gets sonnet."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_model; print(recommend_model('orchestrator', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "sonnet"

    def test_orchestrator_high_gets_opus(self) -> None:
        """Orchestrator with high complexity gets opus (most capable)."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_model; print(recommend_model('orchestrator', 5))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "opus"

    def test_multi_agent_default_gets_opus(self) -> None:
        """Multi-agent with medium complexity gets opus."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_model; print(recommend_model('multi-agent', 3))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "opus"

    def test_pipeline_low_gets_haiku(self) -> None:
        """Pipeline with low complexity gets haiku."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from platxa_agent_generator.type_classifier import recommend_model; print(recommend_model('pipeline', 1))",
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.stdout.strip() == "haiku"
