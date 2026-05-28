"""Tests for :mod:`platxa_agent_generator.quality_scorer`.

Currently focused on the weight-integrity helpers that replaced the deleted
``weight_drift_check`` module:

* ``check_agent_weight_tables`` — greps ``agents/*.md`` for hardcoded weight
  tables and returns the list of offenders.
* ``check_criteria_weights_integrity`` — emits ``DeprecationWarning`` if the
  Python-side ``CRITERIA_WEIGHTS`` dict diverges from the YAML source.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import pytest

from platxa_agent_generator import quality_scorer


class TestCheckAgentWeightTables:
    """Drift detection across ``agents/*.md`` files."""

    def test_returns_empty_when_no_agent_files_have_weight_tables(self, tmp_path: Path) -> None:
        (tmp_path / "clean.md").write_text("# Clean\nNo weight table.", encoding="utf-8")
        assert quality_scorer.check_agent_weight_tables(tmp_path) == []

    def test_flags_agent_with_two_column_weight_table(self, tmp_path: Path) -> None:
        drifted = tmp_path / "drifted.md"
        drifted.write_text(
            "# Drifted\n| clarity | 0.25 |\n| security | 0.15 |\n",
            encoding="utf-8",
        )
        assert quality_scorer.check_agent_weight_tables(tmp_path) == [drifted]

    def test_ignores_mid_row_float_in_longer_table(self, tmp_path: Path) -> None:
        """``| param | no | 0.5 | description |`` must not register as drift."""
        (tmp_path / "params.md").write_text(
            "# Config\n| param | no | 0.5 | description |\n",
            encoding="utf-8",
        )
        assert quality_scorer.check_agent_weight_tables(tmp_path) == []

    def test_returns_empty_when_agents_dir_missing(self, tmp_path: Path) -> None:
        assert quality_scorer.check_agent_weight_tables(tmp_path / "absent") == []

    def test_real_agents_dir_is_currently_clean(self) -> None:
        """Guard against future drift sneaking into the live ``agents/`` tree."""
        assert quality_scorer.check_agent_weight_tables() == []


class TestCheckCriteriaWeightsIntegrity:
    """Python-side hardcoded-weight detection via DeprecationWarning."""

    def test_no_warning_when_weights_match_yaml(self) -> None:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            quality_scorer.check_criteria_weights_integrity()
        assert not any(issubclass(w.category, DeprecationWarning) for w in caught)

    def test_warns_when_weights_overridden(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(quality_scorer, "CRITERIA_WEIGHTS", {"bogus": 1.0})
        with pytest.warns(DeprecationWarning, match="CRITERIA_WEIGHTS"):
            quality_scorer.check_criteria_weights_integrity()
