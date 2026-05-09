"""Tests for :mod:`platxa_agent_generator.instinct_store`.

Verification criteria for feature #6:

* atomic JSON-backed index round-trips
* SHA-256 checksum stable + verify() catches mismatches
* file lock prevents interleaved appends across 10 concurrent writers
  (threads in this process AND processes via a multiprocessing variant)
"""

from __future__ import annotations

import json
import multiprocessing
import threading
from pathlib import Path

import pytest

from platxa_agent_generator.instinct_store import (
    INDEX_FILENAME,
    INDEX_LOCK_FILENAME,
    INDEX_SCHEMA_VERSION,
    InstinctChecksumMismatch,
    InstinctEntry,
    InstinctStore,
    InstinctValidationError,
)


def _instinct_md(name: str, n: int = 0) -> str:
    """Return a minimal instinct markdown body keyed by name + index."""
    return (
        "---\n"
        f'name: "{name}"\n'
        f'description: "instinct {name} #{n}"\n'
        'type: "behavior"\n'
        "confidence: 0.5\n"
        f'created: "2026-05-09T12:00:00Z"\n'
        f'last_seen: "2026-05-09T12:00:00Z"\n'
        "occurrences: 1\n"
        "success_count: 0\n"
        "usage_count: 0\n"
        "ttl_days: 30\n"
        'project_scope: "global"\n'
        "---\n\n"
        f"# {name}\n\nbody {n}\n"
    )


# --- Constants and module surface --------------------------------------


class TestInstinctStoreModuleSurface:
    def test_index_filenames_are_stable(self) -> None:
        assert INDEX_FILENAME == "index.json"
        assert INDEX_LOCK_FILENAME == "index.json.lock"

    def test_schema_version_is_int(self) -> None:
        assert isinstance(INDEX_SCHEMA_VERSION, int)
        assert INDEX_SCHEMA_VERSION >= 1


# --- InstinctEntry validation ------------------------------------------


class TestInstinctEntryValidation:
    def _good_kwargs(self) -> dict:
        return {
            "name": "my-instinct",
            "scope": "global",
            "type": "behavior",
            "path": "global/behavior/my-instinct.md",
            "checksum": "a" * 64,
            "size": 100,
        }

    def test_minimum_valid_entry(self) -> None:
        entry = InstinctEntry(**self._good_kwargs())
        assert entry.name == "my-instinct"
        assert entry.created == ""
        assert entry.last_seen == ""

    @pytest.mark.parametrize("field_name", ["name", "scope", "type"])
    def test_empty_component_rejected(self, field_name: str) -> None:
        kwargs = self._good_kwargs()
        kwargs[field_name] = ""
        with pytest.raises(InstinctValidationError, match=field_name):
            InstinctEntry(**kwargs)

    @pytest.mark.parametrize(
        "bad_name",
        [".hidden", "../escape", "a/b", "a\\b", "a\x00b", " leading-space"],
    )
    def test_path_traversal_components_rejected(self, bad_name: str) -> None:
        kwargs = self._good_kwargs()
        kwargs["name"] = bad_name
        with pytest.raises(InstinctValidationError):
            InstinctEntry(**kwargs)

    def test_short_checksum_rejected(self) -> None:
        kwargs = self._good_kwargs()
        kwargs["checksum"] = "abc"
        with pytest.raises(InstinctValidationError, match="checksum"):
            InstinctEntry(**kwargs)

    def test_negative_size_rejected(self) -> None:
        kwargs = self._good_kwargs()
        kwargs["size"] = -1
        with pytest.raises(InstinctValidationError, match="size"):
            InstinctEntry(**kwargs)


# --- Core write/read round-trip ----------------------------------------


class TestInstinctStoreRoundTrip:
    def test_put_writes_file_and_index(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        content = _instinct_md("alpha")
        entry = store.put(
            name="alpha",
            scope="global",
            type_="behavior",
            content=content,
            created="2026-05-09T12:00:00Z",
            last_seen="2026-05-09T12:00:00Z",
        )

        # File written at expected path
        target = tmp_path / "global" / "behavior" / "alpha.md"
        assert target.exists()
        assert target.read_text(encoding="utf-8") == content

        # Index written with this entry
        index_payload = json.loads((tmp_path / INDEX_FILENAME).read_text(encoding="utf-8"))
        assert index_payload["schema_version"] == INDEX_SCHEMA_VERSION
        assert "alpha" in index_payload["instincts"]

        # Returned entry agrees with disk
        assert entry.path == "global/behavior/alpha.md"
        assert entry.size == len(content.encode("utf-8"))
        assert len(entry.checksum) == 64

    def test_get_returns_content(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        content = _instinct_md("beta")
        store.put(name="beta", scope="global", type_="behavior", content=content)
        assert store.get("beta") == content

    def test_get_missing_returns_none(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        assert store.get("nope") is None
        assert store.get_entry("nope") is None

    def test_overwrite_same_name_replaces_entry(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="gamma",
            scope="global",
            type_="behavior",
            content=_instinct_md("gamma", 0),
        )
        first_entry = store.get_entry("gamma")
        assert first_entry is not None
        first_checksum = first_entry.checksum

        store.put(
            name="gamma",
            scope="global",
            type_="behavior",
            content=_instinct_md("gamma", 1),
        )
        second_entry = store.get_entry("gamma")
        assert second_entry is not None
        assert second_entry.checksum != first_checksum
        assert store.count() == 1  # still one entry

    def test_delete_removes_file_and_entry(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="delta",
            scope="global",
            type_="behavior",
            content=_instinct_md("delta"),
        )
        target = tmp_path / "global" / "behavior" / "delta.md"
        assert target.exists()

        assert store.delete("delta") is True
        assert not target.exists()
        assert store.get_entry("delta") is None

    def test_delete_missing_returns_false(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        assert store.delete("never-was-here") is False

    def test_list_entries_sorted_by_name(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        for name in ["zeta", "alpha", "mu"]:
            store.put(
                name=name,
                scope="global",
                type_="behavior",
                content=_instinct_md(name),
            )
        names = [e.name for e in store.list_entries()]
        assert names == ["alpha", "mu", "zeta"]

    def test_iter_entries_matches_list(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        for name in ["one", "two", "three"]:
            store.put(
                name=name,
                scope="global",
                type_="behavior",
                content=_instinct_md(name),
            )
        assert list(store.iter_entries()) == store.list_entries()


# --- Checksum invariants ------------------------------------------------


class TestInstinctStoreChecksums:
    def test_checksum_matches_after_put(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="cksum",
            scope="global",
            type_="behavior",
            content=_instinct_md("cksum"),
        )
        entry = store.get_entry("cksum")
        assert entry is not None
        assert store.checksum("cksum") == entry.checksum
        assert store.verify("cksum") is True

    def test_verify_detects_on_disk_mutation(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="tamper",
            scope="global",
            type_="behavior",
            content=_instinct_md("tamper"),
        )
        target = tmp_path / "global" / "behavior" / "tamper.md"
        target.write_text("CORRUPTED\n", encoding="utf-8")
        assert store.verify("tamper") is False

    def test_verify_missing_entry_is_false(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        assert store.verify("never") is False

    def test_index_checksum_changes_after_put(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        empty_chk = store.index_checksum()
        store.put(
            name="x",
            scope="global",
            type_="behavior",
            content=_instinct_md("x"),
        )
        after_chk = store.index_checksum()
        assert empty_chk != after_chk
        assert len(after_chk) == 64

    def test_index_checksum_stable_across_reads(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="x",
            scope="global",
            type_="behavior",
            content=_instinct_md("x"),
        )
        a = store.index_checksum()
        b = store.index_checksum()
        assert a == b


# --- Index recovery -----------------------------------------------------


class TestInstinctStoreIndexRecovery:
    def test_corrupt_index_treated_as_empty(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        # Pre-populate with a corrupt index
        tmp_path.mkdir(parents=True, exist_ok=True)
        (tmp_path / INDEX_FILENAME).write_text("not json", encoding="utf-8")
        # Read still succeeds (treats as empty)
        assert store.list_entries() == []
        # And a put recovers the file shape
        store.put(
            name="recover",
            scope="global",
            type_="behavior",
            content=_instinct_md("recover"),
        )
        assert store.count() == 1

    def test_index_with_garbage_entry_skips_it(self, tmp_path: Path) -> None:
        tmp_path.mkdir(parents=True, exist_ok=True)
        # One valid + one malformed entry
        (tmp_path / INDEX_FILENAME).write_text(
            json.dumps(
                {
                    "schema_version": INDEX_SCHEMA_VERSION,
                    "instincts": {
                        "good": {
                            "name": "good",
                            "scope": "global",
                            "type": "behavior",
                            "path": "global/behavior/good.md",
                            "checksum": "a" * 64,
                            "size": 10,
                            "created": "",
                            "last_seen": "",
                        },
                        "bad": "not-a-dict",
                        "mismatched-key": {
                            "name": "different-name",
                            "scope": "global",
                            "type": "behavior",
                            "path": "x.md",
                            "checksum": "b" * 64,
                            "size": 1,
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        store = InstinctStore(root=tmp_path)
        names = [e.name for e in store.list_entries()]
        assert names == ["good"]


# --- Concurrency (10 threads — primary verification criterion) ---------


def _thread_worker(
    store: InstinctStore,
    worker_id: int,
    n_per_worker: int,
    barrier: threading.Barrier,
    errors: list[BaseException],
) -> None:
    """Wait at the barrier so all threads start the put burst together."""
    try:
        barrier.wait(timeout=10.0)
        for i in range(n_per_worker):
            name = f"w{worker_id}-i{i:03d}"
            store.put(
                name=name,
                scope="global",
                type_="behavior",
                content=_instinct_md(name, i),
            )
    except BaseException as exc:  # pragma: no cover - error captured in list
        errors.append(exc)


class TestInstinctStoreThreadConcurrency:
    """The primary verification gate from feature #6."""

    def test_ten_threads_no_corruption_or_loss(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        n_workers = 10
        n_per_worker = 5
        barrier = threading.Barrier(n_workers)
        errors: list[BaseException] = []
        threads = [
            threading.Thread(
                target=_thread_worker,
                args=(store, wid, n_per_worker, barrier, errors),
                name=f"instinct-writer-{wid}",
            )
            for wid in range(n_workers)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30.0)
            assert not t.is_alive(), f"thread {t.name} hung past timeout"

        assert errors == [], f"thread errors: {errors!r}"

        # Exactly one index entry per (worker, i) pair
        expected_count = n_workers * n_per_worker
        assert store.count() == expected_count

        # Every on-disk file matches its index checksum (no torn writes)
        for entry in store.list_entries():
            assert store.verify(entry.name), f"checksum mismatch for {entry.name}"

        # The index itself parses as valid JSON (no torn index writes)
        index_payload = json.loads((tmp_path / INDEX_FILENAME).read_text(encoding="utf-8"))
        assert index_payload["schema_version"] == INDEX_SCHEMA_VERSION
        assert len(index_payload["instincts"]) == expected_count


# --- Concurrency across processes (file-lock contract) ----------------


def _process_worker(args: tuple[str, int, int]) -> None:
    """Worker process: re-imports the store and appends N records."""
    root_str, worker_id, n = args
    from platxa_agent_generator.instinct_store import InstinctStore

    store = InstinctStore(root=Path(root_str))
    for i in range(n):
        name = f"p{worker_id}-i{i:03d}"
        store.put(
            name=name,
            scope="global",
            type_="behavior",
            content=_instinct_md(name, i),
        )


class TestInstinctStoreProcessConcurrency:
    """File lock contract: cross-process writers must not interleave bytes."""

    def test_no_interleaved_writes_across_processes(self, tmp_path: Path) -> None:
        n_workers = 4
        n_per_worker = 5
        ctx = multiprocessing.get_context("spawn")
        with ctx.Pool(n_workers) as pool:
            pool.map(
                _process_worker,
                [(str(tmp_path), wid, n_per_worker) for wid in range(n_workers)],
            )

        store = InstinctStore(root=tmp_path)
        expected_count = n_workers * n_per_worker
        assert store.count() == expected_count

        # The final on-disk index parses (no torn writes)
        index_payload = json.loads((tmp_path / INDEX_FILENAME).read_text(encoding="utf-8"))
        assert len(index_payload["instincts"]) == expected_count

        # Every entry's on-disk file matches its checksum
        for entry in store.list_entries():
            assert store.verify(entry.name)


# --- Module-level imports stable ---------------------------------------


def test_unused_import_anchor_is_kept_in_sync() -> None:
    """``InstinctChecksumMismatch`` is a public symbol — keep it importable."""
    assert issubclass(InstinctChecksumMismatch, RuntimeError)
