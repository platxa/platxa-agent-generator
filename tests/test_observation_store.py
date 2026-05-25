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
    DEFAULT_OBSERVATION_CAP,
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
        assert record.promoted_to is None

    @pytest.mark.parametrize("bad_value", ["", "   "])
    def test_promoted_to_empty_string_raises(self, bad_value: str) -> None:
        with pytest.raises(ObservationValidationError, match="promoted_to"):
            ObservationRecord(
                timestamp="t",
                tool="t",
                input_summary="t",
                project_id="t",
                project_name="t",
                promoted_to=bad_value,
            )

    def test_promoted_to_accepts_valid_instinct_id(self) -> None:
        record = ObservationRecord(
            timestamp="t",
            tool="t",
            input_summary="t",
            project_id="t",
            project_name="t",
            promoted_to="instinct-abc123",
        )
        assert record.promoted_to == "instinct-abc123"


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
        assert record.promoted_to is None

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


# --- mark_promoted (feature #25) -----------------------------------------


class TestMarkPromoted:
    """Verification: promoting observation O writes promoted_to=instinct_id back."""

    def _make_store(self, tmp_path: Path) -> ObservationStore:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s1",
                project_id="p",
                project_name="pn",
                session_id="sess-a",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Read",
                input_summary="s2",
                project_id="p",
                project_name="pn",
                session_id="sess-a",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t3",
                tool="Bash",
                input_summary="s3",
                project_id="p",
                project_name="pn",
                session_id="sess-b",
            )
        )
        return store

    def test_marks_matching_record(self, tmp_path: Path) -> None:
        store = self._make_store(tmp_path)
        updated = store.mark_promoted(
            "instinct-xyz",
            match=lambda r: r.timestamp == "t2",
        )
        assert updated == 1
        records = store.read_all()
        assert records[0].promoted_to is None
        assert records[1].promoted_to == "instinct-xyz"
        assert records[2].promoted_to is None

    def test_marks_multiple_matching_records(self, tmp_path: Path) -> None:
        store = self._make_store(tmp_path)
        updated = store.mark_promoted(
            "instinct-bulk",
            match=lambda r: r.tool == "Bash",
        )
        assert updated == 2
        records = store.read_all()
        assert records[0].promoted_to == "instinct-bulk"
        assert records[1].promoted_to is None
        assert records[2].promoted_to == "instinct-bulk"

    def test_skips_already_promoted_records(self, tmp_path: Path) -> None:
        store = self._make_store(tmp_path)
        store.mark_promoted("first", match=lambda r: r.timestamp == "t1")
        updated = store.mark_promoted("second", match=lambda r: r.timestamp == "t1")
        assert updated == 0
        records = store.read_all()
        assert records[0].promoted_to == "first"

    def test_returns_zero_on_no_match(self, tmp_path: Path) -> None:
        store = self._make_store(tmp_path)
        updated = store.mark_promoted("x", match=lambda r: r.timestamp == "nonexistent")
        assert updated == 0

    def test_returns_zero_on_missing_file(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "missing.jsonl")
        updated = store.mark_promoted("x", match=lambda _: True)
        assert updated == 0

    def test_preserves_malformed_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        good_line = json.dumps(
            {
                "timestamp": "t1",
                "tool": "t",
                "input_summary": "s",
                "project_id": "p",
                "project_name": "pn",
            }
        )
        path.write_text(good_line + "\nnot-json\n" + good_line.replace("t1", "t2") + "\n")
        store = ObservationStore(path=path)
        store.mark_promoted("inst", match=lambda r: r.timestamp == "t1")
        raw_lines = path.read_text().splitlines()
        assert len(raw_lines) == 3
        assert raw_lines[1] == "not-json"
        data = json.loads(raw_lines[0])
        assert data["promoted_to"] == "inst"

    def test_empty_instinct_id_raises(self, tmp_path: Path) -> None:
        store = self._make_store(tmp_path)
        with pytest.raises(ObservationValidationError, match="instinct_id"):
            store.mark_promoted("", match=lambda _: True)

    def test_preserves_non_dict_and_validation_failing_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        good = json.dumps(
            {
                "timestamp": "t1",
                "tool": "t",
                "input_summary": "s",
                "project_id": "p",
                "project_name": "pn",
            }
        )
        invalid_record = json.dumps(
            {
                "timestamp": "",
                "tool": "x",
                "input_summary": "x",
                "project_id": "x",
                "project_name": "x",
            }
        )
        path.write_text(
            good + "\n[1,2,3]\n\n" + invalid_record + "\n",
            encoding="utf-8",
        )
        store = ObservationStore(path=path)
        store.mark_promoted("inst", match=lambda _: True)
        raw_lines = path.read_text().splitlines()
        assert len(raw_lines) == 4
        assert raw_lines[1] == "[1,2,3]"
        assert raw_lines[2] == ""
        data = json.loads(raw_lines[0])
        assert data["promoted_to"] == "inst"
        invalid_data = json.loads(raw_lines[3])
        assert invalid_data["timestamp"] == ""

    def test_promoted_to_roundtrips_through_jsonl(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        record = ObservationRecord(
            timestamp="t",
            tool="t",
            input_summary="s",
            project_id="p",
            project_name="pn",
            promoted_to="instinct-roundtrip",
        )
        store.append(record)
        read_back = store.read_all()
        assert len(read_back) == 1
        assert read_back[0].promoted_to == "instinct-roundtrip"
        assert read_back[0] == record


# --- Observation throttling (feature #62) ---------------------------------


class TestObservationThrottling:
    """Session-scoped cap on observations to prevent memory explosion."""

    def _make_minimal(self, idx: int) -> ObservationRecord:
        return ObservationRecord(
            timestamp=f"t{idx}",
            tool="Bash",
            input_summary=f"obs {idx}",
            project_id="p",
            project_name="pn",
        )

    def test_default_cap_is_200(self) -> None:
        assert DEFAULT_OBSERVATION_CAP == 200

    def test_cap_drops_observations_past_limit(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "10")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(25):
            store.append(self._make_minimal(i))
        assert store.count() == 10

    def test_250_observations_capped_at_200(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PLATXA_OBSERVATION_CAP", raising=False)
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(250):
            store.append(self._make_minimal(i))
        assert store.count() == 200

    def test_env_override_respected(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "50")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(100):
            store.append(self._make_minimal(i))
        assert store.count() == 50

    def test_env_cap_zero_disables_throttling(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(300):
            store.append(self._make_minimal(i))
        assert store.count() == 300

    def test_append_many_respects_cap(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "15")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        batch = [self._make_minimal(i) for i in range(25)]
        store.append_many(batch)
        assert store.count() == 15

    def test_append_many_after_partial_append(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "20")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(12):
            store.append(self._make_minimal(i))
        batch = [self._make_minimal(100 + i) for i in range(15)]
        store.append_many(batch)
        assert store.count() == 20

    def test_append_many_at_cap_is_noop(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "5")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(5):
            store.append(self._make_minimal(i))
        store.append_many([self._make_minimal(99)])
        assert store.count() == 5

    def test_env_invalid_falls_back_to_default(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "not-a-number")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(210):
            store.append(self._make_minimal(i))
        assert store.count() == DEFAULT_OBSERVATION_CAP

    def test_env_empty_falls_back_to_default(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(210):
            store.append(self._make_minimal(i))
        assert store.count() == DEFAULT_OBSERVATION_CAP

    def test_env_negative_falls_back_to_default(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "-1")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(210):
            store.append(self._make_minimal(i))
        assert store.count() == DEFAULT_OBSERVATION_CAP


# --- Tail-sampling (feature #63) ------------------------------------------


class TestTailSampling:
    """Verification: 300 obs with cap=100 → first 50 + last 50 retained."""

    def _make_minimal(self, idx: int) -> ObservationRecord:
        return ObservationRecord(
            timestamp=f"t{idx}",
            tool="Bash",
            input_summary=f"obs {idx}",
            project_id="p",
            project_name="pn",
        )

    def _write_records(self, store: ObservationStore, n: int) -> list[ObservationRecord]:
        """Write n records directly to disk, bypassing session cap."""
        records = [self._make_minimal(i) for i in range(n)]
        store.path.parent.mkdir(parents=True, exist_ok=True)
        with store.path.open("w", encoding="utf-8") as fh:
            for r in records:
                fh.write(r.to_jsonl())
        return records

    def test_300_observations_cap_100(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 300)
        result = store.tail_sample(cap=100)
        assert len(result) == 100
        assert result[:50] == records[:50]
        assert result[50:] == records[-50:]

    def test_under_cap_returns_all(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 80)
        result = store.tail_sample(cap=100)
        assert result == records

    def test_exactly_at_cap_returns_all(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 100)
        result = store.tail_sample(cap=100)
        assert result == records

    def test_odd_cap_gives_extra_to_tail(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 50)
        result = store.tail_sample(cap=7)
        assert len(result) == 7
        assert result[:3] == records[:3]
        assert result[3:] == records[-4:]

    def test_cap_zero_returns_all(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 200)
        result = store.tail_sample(cap=0)
        assert result == records

    def test_cap_none_uses_store_cap(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "20")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 50)
        result = store.tail_sample()
        assert len(result) == 20
        assert result[:10] == records[:10]
        assert result[10:] == records[-10:]

    def test_empty_store(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        assert store.tail_sample(cap=100) == []

    def test_cap_1_keeps_last(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 10)
        result = store.tail_sample(cap=1)
        assert len(result) == 1
        assert result[0] == records[-1]

    def test_cap_2_keeps_first_and_last(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        records = self._write_records(store, 10)
        result = store.tail_sample(cap=2)
        assert len(result) == 2
        assert result[0] == records[0]
        assert result[1] == records[-1]

    def test_middle_is_dropped_not_head_or_tail(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PLATXA_OBSERVATION_CAP", "0")
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        self._write_records(store, 20)
        result = store.tail_sample(cap=10)
        expected_timestamps = [f"t{i}" for i in range(5)] + [f"t{i}" for i in range(15, 20)]
        actual_timestamps = [r.timestamp for r in result]
        assert actual_timestamps == expected_timestamps


# --- Migration (feature #71) ------------------------------------------------


class TestMigration:
    """Verification: non-destructive schema migration with backup."""

    def _make_minimal(self, idx: int) -> ObservationRecord:
        return ObservationRecord(
            timestamp=f"t{idx}",
            tool="Bash",
            input_summary=f"obs {idx}",
            project_id="p",
            project_name="pn",
        )

    def test_missing_file_returns_empty_report(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "missing.jsonl")
        result = store.migrate()
        assert result == {"migrated": 0, "total": 0, "backup_path": "", "output_path": ""}

    def test_legacy_rows_are_upgraded(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        legacy_row = json.dumps(
            {
                "timestamp": "2026-04-13T20:37:02Z",
                "tool": "Bash",
                "input_summary": "cmd: test",
                "project_id": "abc",
                "project_name": "proj",
            }
        )
        path.write_text(legacy_row + "\n", encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["migrated"] == 1
        assert result["total"] == 1
        output = Path(str(result["output_path"]))
        assert output.exists()
        upgraded = json.loads(output.read_text(encoding="utf-8").strip())
        assert upgraded["session_id"] == ""
        assert upgraded["type"] == "tool_use"
        assert upgraded["confidence"] == 1.0

    def test_already_complete_rows_not_counted_as_migrated(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        record = self._make_minimal(0)
        path.write_text(record.to_jsonl(), encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["migrated"] == 0
        assert result["total"] == 1

    def test_idempotent_second_run(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        record = self._make_minimal(0)
        path.write_text(record.to_jsonl(), encoding="utf-8")
        store = ObservationStore(path=path)
        first = store.migrate()
        second = store.migrate()
        assert first["total"] == second["total"]
        output_first = Path(str(first["output_path"])).read_bytes()
        output_second = Path(str(second["output_path"])).read_bytes()
        assert output_first == output_second

    def test_backup_created(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        original_content = self._make_minimal(0).to_jsonl()
        path.write_text(original_content, encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        backup = Path(str(result["backup_path"]))
        assert backup.exists()
        assert backup.read_text(encoding="utf-8") == original_content

    def test_original_file_untouched(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        original_content = self._make_minimal(0).to_jsonl()
        path.write_text(original_content, encoding="utf-8")
        store = ObservationStore(path=path)
        store.migrate()
        assert path.read_text(encoding="utf-8") == original_content

    def test_malformed_lines_preserved_verbatim(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        good = json.dumps(
            {
                "timestamp": "t1",
                "tool": "t",
                "input_summary": "s",
                "project_id": "p",
                "project_name": "pn",
            }
        )
        path.write_text(good + "\nnot-json-garbage\n", encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        output = Path(str(result["output_path"]))
        lines = output.read_text(encoding="utf-8").splitlines(keepends=True)
        assert any("not-json-garbage" in line for line in lines)
        assert result["total"] == 1

    def test_mixed_legacy_and_full_rows(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        legacy = json.dumps(
            {
                "timestamp": "t1",
                "tool": "Bash",
                "input_summary": "s",
                "project_id": "p",
                "project_name": "pn",
            }
        )
        full = self._make_minimal(2).to_jsonl().strip()
        path.write_text(legacy + "\n" + full + "\n", encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["total"] == 2
        assert result["migrated"] == 1

    def test_output_path_suffix(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        path.write_text(self._make_minimal(0).to_jsonl(), encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert str(result["output_path"]).endswith(".v2")
        assert str(result["backup_path"]).endswith(".v1.bak")

    def test_migrate_preserves_empty_lines_and_non_dict_json(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        good = self._make_minimal(0).to_jsonl().strip()
        path.write_text(
            good + "\n\n[1,2,3]\nnot-json\n" + good.replace("t0", "t1") + "\n",
            encoding="utf-8",
        )
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["total"] == 2
        output = Path(str(result["output_path"]))
        raw = output.read_text(encoding="utf-8")
        assert "\n\n" in raw or raw.count("\n") >= 4
        assert "[1,2,3]" in raw
        assert "not-json" in raw

    def test_migrate_preserves_validation_failing_rows(self, tmp_path: Path) -> None:
        path = tmp_path / "obs.jsonl"
        invalid_row = json.dumps(
            {
                "timestamp": "",
                "tool": "x",
                "input_summary": "x",
                "project_id": "x",
                "project_name": "x",
            }
        )
        good = self._make_minimal(0).to_jsonl().strip()
        path.write_text(invalid_row + "\n" + good + "\n", encoding="utf-8")
        store = ObservationStore(path=path)
        result = store.migrate()
        assert result["total"] == 1
        output = Path(str(result["output_path"]))
        lines = output.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 2
        assert json.loads(lines[0])["timestamp"] == ""


# --- Stats (feature #71) ----------------------------------------------------


class TestStats:
    """Verification: aggregate statistics over parseable records."""

    def test_empty_store(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        result = store.stats()
        assert result == {
            "total": {"count": 0},
            "promoted": {"count": 0},
            "by_type": {},
            "by_tool": {},
            "by_agent": {},
        }

    def test_by_type_aggregation(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                type="decision",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Read",
                input_summary="s",
                project_id="p",
                project_name="pn",
                type="decision",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t3",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                type="tool_use",
            )
        )
        result = store.stats()
        assert result["by_type"] == {"decision": 2, "tool_use": 1}

    def test_by_tool_aggregation(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t3",
                tool="Read",
                input_summary="s",
                project_id="p",
                project_name="pn",
            )
        )
        result = store.stats()
        assert result["by_tool"] == {"Bash": 2, "Read": 1}

    def test_by_agent_aggregation(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                agent_name="observer",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Read",
                input_summary="s",
                project_id="p",
                project_name="pn",
                agent_name="observer",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t3",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                agent_name="reviewer",
            )
        )
        result = store.stats()
        assert result["by_agent"] == {"observer": 2, "reviewer": 1}

    def test_unknown_agent_grouped(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                agent_name="",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Read",
                input_summary="s",
                project_id="p",
                project_name="pn",
            )
        )
        result = store.stats()
        assert result["by_agent"] == {"(unknown)": 2}

    def test_promoted_count(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Bash",
                input_summary="s",
                project_id="p",
                project_name="pn",
                promoted_to="instinct-a",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Read",
                input_summary="s",
                project_id="p",
                project_name="pn",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t3",
                tool="Grep",
                input_summary="s",
                project_id="p",
                project_name="pn",
                promoted_to="instinct-b",
            )
        )
        result = store.stats()
        assert result["promoted"] == {"count": 2}
        assert result["total"] == {"count": 3}

    def test_total_count(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        for i in range(5):
            store.append(
                ObservationRecord(
                    timestamp=f"t{i}",
                    tool="Bash",
                    input_summary="s",
                    project_id="p",
                    project_name="pn",
                )
            )
        result = store.stats()
        assert result["total"] == {"count": 5}

    def test_keys_sorted_alphabetically(self, tmp_path: Path) -> None:
        store = ObservationStore(path=tmp_path / "obs.jsonl")
        store.append(
            ObservationRecord(
                timestamp="t1",
                tool="Zzz",
                input_summary="s",
                project_id="p",
                project_name="pn",
                type="refactor",
            )
        )
        store.append(
            ObservationRecord(
                timestamp="t2",
                tool="Aaa",
                input_summary="s",
                project_id="p",
                project_name="pn",
                type="bugfix",
            )
        )
        result = store.stats()
        assert list(result["by_type"].keys()) == ["bugfix", "refactor"]
        assert list(result["by_tool"].keys()) == ["Aaa", "Zzz"]


# --- pattern_label validation (feature #71) ----------------------------------


class TestPatternLabelValidation:
    """Edge cases for the pattern_label optional field."""

    @pytest.mark.parametrize("bad_value", ["", "   "])
    def test_empty_or_whitespace_raises(self, bad_value: str) -> None:
        with pytest.raises(ObservationValidationError, match="pattern_label"):
            ObservationRecord(
                timestamp="t",
                tool="t",
                input_summary="t",
                project_id="t",
                project_name="t",
                pattern_label=bad_value,
            )

    def test_none_is_accepted(self) -> None:
        record = ObservationRecord(
            timestamp="t",
            tool="t",
            input_summary="t",
            project_id="t",
            project_name="t",
            pattern_label=None,
        )
        assert record.pattern_label is None

    def test_valid_string_accepted(self) -> None:
        record = ObservationRecord(
            timestamp="t",
            tool="t",
            input_summary="t",
            project_id="t",
            project_name="t",
            pattern_label="retry-on-failure",
        )
        assert record.pattern_label == "retry-on-failure"
