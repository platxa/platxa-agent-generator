"""Tests for :mod:`platxa_agent_generator.observation_store`.

The verification criterion for feature #1 is round-trip serialization of
100 random ObservationRecord instances with a stable checksum and all
required fields enforced. Concurrent-write safety is also exercised so the
FileLock contract from :mod:`state_persistence` is covered at this layer
rather than only in state_persistence's own tests.
"""

from __future__ import annotations

import json
import multiprocessing
import random
import string
from pathlib import Path
from typing import Any, cast

import pytest

from platxa_agent_generator.observation_store import (
    OBSERVATION_TYPES,
    REQUIRED_FIELDS,
    ObservationRecord,
    ObservationStore,
    ObservationType,
    ObservationValidationError,
)


def _rand_str(length: int = 12, seed: random.Random | None = None) -> str:
    rng = seed or random
    return "".join(rng.choices(string.ascii_letters + string.digits, k=length))


def _make_record(seed: random.Random) -> ObservationRecord:
    """Construct a fully populated ObservationRecord from a seeded RNG."""
    chosen_type = cast(ObservationType, seed.choice(sorted(OBSERVATION_TYPES)))
    return ObservationRecord(
        timestamp=f"2026-05-09T{seed.randint(0, 23):02d}:00:00Z",
        tool=_rand_str(seed=seed),
        input_summary=_rand_str(20, seed=seed),
        project_id=_rand_str(8, seed=seed),
        project_name=_rand_str(seed=seed),
        session_id=_rand_str(seed=seed),
        agent_name=_rand_str(seed=seed),
        type=chosen_type,
        evidence=_rand_str(30, seed=seed),
        examples=[_rand_str(seed=seed) for _ in range(seed.randint(0, 4))],
        outcome=seed.choice(["success", "failure", ""]),
        confidence=round(seed.random(), 4),
    )


# --- ObservationRecord schema -------------------------------------------


class TestObservationRecordSchema:
    """Hard schema invariants enforced at construction time."""

    def test_required_fields_listed(self) -> None:
        assert REQUIRED_FIELDS == (
            "timestamp",
            "tool",
            "input_summary",
            "project_id",
            "project_name",
        )

    @pytest.mark.parametrize("field_name", REQUIRED_FIELDS)
    def test_required_field_missing_raises(self, field_name: str) -> None:
        kwargs: dict[str, Any] = {f: "x" for f in REQUIRED_FIELDS}
        kwargs[field_name] = ""
        with pytest.raises(ObservationValidationError, match=field_name):
            ObservationRecord(**kwargs)

    @pytest.mark.parametrize("field_name", REQUIRED_FIELDS)
    def test_required_field_whitespace_only_raises(self, field_name: str) -> None:
        kwargs: dict[str, Any] = {f: "x" for f in REQUIRED_FIELDS}
        kwargs[field_name] = "   "
        with pytest.raises(ObservationValidationError, match=field_name):
            ObservationRecord(**kwargs)

    def test_unknown_type_raises(self) -> None:
        with pytest.raises(ObservationValidationError, match="type"):
            ObservationRecord(
                timestamp="t",
                tool="t",
                input_summary="t",
                project_id="t",
                project_name="t",
                type="unknown",  # type: ignore[arg-type]
            )

    @pytest.mark.parametrize("bad_confidence", [-0.1, 1.5, 2.0])
    def test_confidence_out_of_range_raises(self, bad_confidence: float) -> None:
        with pytest.raises(ObservationValidationError, match="confidence"):
            ObservationRecord(
                timestamp="t",
                tool="t",
                input_summary="t",
                project_id="t",
                project_name="t",
                confidence=bad_confidence,
            )

    def test_examples_must_be_list_of_strings(self) -> None:
        with pytest.raises(ObservationValidationError, match="examples"):
            ObservationRecord(
                timestamp="t",
                tool="t",
                input_summary="t",
                project_id="t",
                project_name="t",
                examples=[1, 2, 3],  # type: ignore[list-item]
            )

    def test_defaults_are_safe_for_minimal_record(self) -> None:
        record = ObservationRecord(
            timestamp="t",
            tool="t",
            input_summary="t",
            project_id="t",
            project_name="t",
        )
        assert record.session_id == ""
        assert record.agent_name == ""
        assert record.type == "tool_use"
        assert record.evidence == ""
        assert record.examples == []
        assert record.outcome == ""
        assert record.confidence == 1.0


# --- Backward compatibility (existing 5-field rows must still parse) ----


class TestObservationRecordBackwardCompat:
    """Old 5-field telemetry rows must round-trip without rewriting."""

    def test_legacy_5_field_row_parses(self) -> None:
        legacy = {
            "timestamp": "2026-04-13T20:37:02Z",
            "tool": "Bash",
            "input_summary": "cmd: platxa-code-agent spec-status --json 2>&1",
            "project_id": "ba5f552eae53",
            "project_name": "platxa-agent-generator",
        }
        record = ObservationRecord.from_dict(legacy)
        assert record.tool == "Bash"
        assert record.session_id == ""
        assert record.type == "tool_use"
        assert record.confidence == 1.0

    def test_unknown_keys_are_ignored(self) -> None:
        future_shape = {
            "timestamp": "t",
            "tool": "t",
            "input_summary": "t",
            "project_id": "t",
            "project_name": "t",
            "future_unknown_field": {"nested": True},
        }
        record = ObservationRecord.from_dict(future_shape)
        assert record.tool == "t"


# --- Round-trip + checksum (verification criterion) ---------------------


class TestObservationStoreRoundTrip:
    """Verification criterion: 100 random instances written and read."""

    def test_100_random_records_roundtrip(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        rng = random.Random(20260509)
        records = [_make_record(rng) for _ in range(100)]

        for record in records:
            store.append(record)

        read_back = store.read_all()
        assert len(read_back) == 100
        for original, parsed in zip(records, read_back):
            assert original == parsed

    def test_checksum_stable_across_reads(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        rng = random.Random(20260510)
        for _ in range(50):
            store.append(_make_record(rng))

        checksum_first = store.checksum()
        checksum_second = store.checksum()
        assert checksum_first == checksum_second
        assert len(checksum_first) == 64

    def test_checksum_changes_after_append(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        rng = random.Random(20260511)
        store.append(_make_record(rng))
        before = store.checksum()
        store.append(_make_record(rng))
        after = store.checksum()
        assert before != after

    def test_count_matches_appended(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        rng = random.Random(20260512)
        for _ in range(7):
            store.append(_make_record(rng))
        assert store.count() == 7

    def test_append_many_under_single_lock(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        rng = random.Random(20260513)
        records = [_make_record(rng) for _ in range(10)]
        store.append_many(records)
        assert store.read_all() == records

    def test_empty_append_many_no_op(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append_many([])
        assert not store.path.exists()
        assert store.read_all() == []

    def test_iter_skips_malformed_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        path.write_text(
            json.dumps(
                {
                    "timestamp": "t",
                    "tool": "t",
                    "input_summary": "t",
                    "project_id": "t",
                    "project_name": "t",
                }
            )
            + "\n"
            + "not-json-at-all\n"
            + "\n"
            + "[1, 2, 3]\n"
            + json.dumps(
                {
                    "timestamp": "t2",
                    "tool": "t2",
                    "input_summary": "t2",
                    "project_id": "t2",
                    "project_name": "t2",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        store = ObservationStore(path=path)
        records = store.read_all()
        assert len(records) == 2
        assert records[0].tool == "t"
        assert records[1].tool == "t2"

    def test_iter_skips_records_failing_validation(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        path.write_text(
            json.dumps(
                {
                    "timestamp": "",
                    "tool": "x",
                    "input_summary": "x",
                    "project_id": "x",
                    "project_name": "x",
                }
            )
            + "\n"
            + json.dumps(
                {
                    "timestamp": "ok",
                    "tool": "x",
                    "input_summary": "x",
                    "project_id": "x",
                    "project_name": "x",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        store = ObservationStore(path=path)
        records = store.read_all()
        assert len(records) == 1
        assert records[0].timestamp == "ok"

    def test_iter_skips_records_with_wrong_typed_confidence(self, tmp_path: Path) -> None:
        """A future writer emitting `confidence` as a string must not crash the iterator.

        Without the broadened except in iter_records, the comparison
        ``0.0 <= "0.5" <= 1.0`` in ``__post_init__`` raises ``TypeError``
        and aborts iteration, losing every subsequent valid row.
        """
        path = tmp_path / "obs.jsonl"
        path.write_text(
            json.dumps(
                {
                    "timestamp": "bad",
                    "tool": "x",
                    "input_summary": "x",
                    "project_id": "x",
                    "project_name": "x",
                    "confidence": "0.5",  # str — TypeError in __post_init__ compare
                }
            )
            + "\n"
            + json.dumps(
                {
                    "timestamp": "good",
                    "tool": "x",
                    "input_summary": "x",
                    "project_id": "x",
                    "project_name": "x",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        store = ObservationStore(path=path)
        records = store.read_all()
        assert len(records) == 1
        assert records[0].timestamp == "good"

    def test_observation_types_derived_from_literal(self) -> None:
        """The runtime guard frozenset must stay in sync with the static Literal."""
        import typing as _t

        from platxa_agent_generator.observation_store import (
            OBSERVATION_TYPES as _types,
        )
        from platxa_agent_generator.observation_store import (
            ObservationType as _T,
        )

        assert _types == frozenset(_t.get_args(_T))


# --- Concurrent write safety -------------------------------------------


def _worker_append(args: tuple[str, int, int]) -> None:
    """Worker process that appends N records to shared store."""
    path_str, worker_id, n = args
    # Deferred import so multiprocessing pickling stays portable.
    from platxa_agent_generator.observation_store import (
        ObservationRecord,
        ObservationStore,
    )

    store = ObservationStore(path=Path(path_str))
    for i in range(n):
        record = ObservationRecord(
            timestamp=f"w{worker_id}",
            tool=f"t{worker_id}",
            input_summary=f"row {i} of worker {worker_id}",
            project_id="proj",
            project_name="platxa",
            agent_name=f"worker-{worker_id}",
        )
        store.append(record)


class TestObservationStoreConcurrency:
    """FileLock contract: concurrent writers must not interleave bytes."""

    def test_no_interleaved_lines_across_processes(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        n_workers = 4
        n_per_worker = 25
        ctx = multiprocessing.get_context("spawn")
        with ctx.Pool(n_workers) as pool:
            pool.map(
                _worker_append,
                [(str(path), wid, n_per_worker) for wid in range(n_workers)],
            )

        store = ObservationStore(path=path)
        records = store.read_all()
        assert len(records) == n_workers * n_per_worker
        # Every line must be valid — no torn writes.
        for raw in path.read_text(encoding="utf-8").splitlines():
            data = json.loads(raw)
            assert "timestamp" in data
            assert "tool" in data
