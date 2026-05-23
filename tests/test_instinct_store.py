"""Tests for :mod:`platxa_agent_generator.instinct_store`.

Verification criteria for feature #6:

* atomic JSON-backed index round-trips
* SHA-256 checksum stable + verify() catches mismatches
* file lock prevents interleaved appends across 10 concurrent writers
  (threads in this process AND processes via a multiprocessing variant)

Verification criteria for feature #7:

* ``resolve_instinct_scope`` returns distinct paths for the same instinct
  ``name`` under two different ``project_id`` values
* the global scope (``project_id=None``) is shared — calling with
  ``project_id=None`` from any caller yields the same path
* ``project_id="global"`` is rejected to protect the reserved scope token
"""

from __future__ import annotations

import json
import multiprocessing
import threading
from pathlib import Path

import pytest

from platxa_agent_generator.instinct_store import (
    DEDUP_FAST_ACCEPT,
    DEDUP_FAST_MAYBE,
    GLOBAL_SCOPE,
    INDEX_FILENAME,
    INDEX_LOCK_FILENAME,
    INDEX_SCHEMA_VERSION,
    InstinctChecksumMismatch,
    InstinctEntry,
    InstinctStore,
    InstinctValidationError,
    dedup_instinct,
    resolve_instinct_scope,
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


# --- resolve_instinct_scope (feature #7) -------------------------------


class TestResolveInstinctScope:
    """Verification of feature #7: project-scoped vs global path resolution."""

    def test_global_scope_when_project_id_is_none(self, tmp_path: Path) -> None:
        path = resolve_instinct_scope(
            name="alpha", type_="behavior", project_id=None, root=tmp_path
        )
        assert path == tmp_path / GLOBAL_SCOPE / "behavior" / "alpha.md"

    def test_project_scope_uses_project_id_segment(self, tmp_path: Path) -> None:
        path = resolve_instinct_scope(
            name="alpha", type_="behavior", project_id="proj-1", root=tmp_path
        )
        assert path == tmp_path / "proj-1" / "behavior" / "alpha.md"

    def test_same_name_two_project_ids_produces_distinct_paths(self, tmp_path: Path) -> None:
        # Verification criterion: same instinct name under two project_ids
        # MUST resolve to distinct on-disk paths.
        a = resolve_instinct_scope(
            name="shared-name",
            type_="behavior",
            project_id="proj-a",
            root=tmp_path,
        )
        b = resolve_instinct_scope(
            name="shared-name",
            type_="behavior",
            project_id="proj-b",
            root=tmp_path,
        )
        assert a != b
        assert a.parent != b.parent
        assert a.name == b.name == "shared-name.md"

    def test_global_scope_is_shared_across_callers(self, tmp_path: Path) -> None:
        # Verification criterion: the global scope is shared across
        # projects — two None-project resolutions for the same name MUST
        # collide on disk, AND must differ from any project-scoped path.
        from_project_a = resolve_instinct_scope(
            name="shared-name",
            type_="behavior",
            project_id=None,
            root=tmp_path,
        )
        from_project_b = resolve_instinct_scope(
            name="shared-name",
            type_="behavior",
            project_id=None,
            root=tmp_path,
        )
        scoped = resolve_instinct_scope(
            name="shared-name",
            type_="behavior",
            project_id="proj-a",
            root=tmp_path,
        )
        assert from_project_a == from_project_b
        assert from_project_a != scoped

    def test_default_root_is_user_instincts_dir(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_home = Path("/tmp/_resolve_test_home_does_not_need_to_exist")
        monkeypatch.setattr(
            "platxa_agent_generator.instinct_store.get_user_agents_dir",
            lambda: fake_home / ".claude" / "agents",
        )
        path = resolve_instinct_scope(name="alpha", type_="behavior")
        assert path == fake_home / ".claude" / "instincts" / GLOBAL_SCOPE / "behavior" / "alpha.md"

    def test_returns_pathlib_path(self, tmp_path: Path) -> None:
        path = resolve_instinct_scope(
            name="alpha", type_="behavior", project_id="proj", root=tmp_path
        )
        assert isinstance(path, Path)

    @pytest.mark.parametrize("bad_name", ["", "  ", "../escape", "with/slash", ".hidden"])
    def test_invalid_name_rejected(self, tmp_path: Path, bad_name: str) -> None:
        with pytest.raises(InstinctValidationError):
            resolve_instinct_scope(
                name=bad_name, type_="behavior", project_id="proj", root=tmp_path
            )

    @pytest.mark.parametrize("bad_type", ["", "../t", "a/b", ".dot"])
    def test_invalid_type_rejected(self, tmp_path: Path, bad_type: str) -> None:
        with pytest.raises(InstinctValidationError):
            resolve_instinct_scope(name="alpha", type_=bad_type, project_id="proj", root=tmp_path)

    @pytest.mark.parametrize("bad_pid", ["", "../escape", "with/slash", ".hidden"])
    def test_invalid_project_id_rejected(self, tmp_path: Path, bad_pid: str) -> None:
        with pytest.raises(InstinctValidationError):
            resolve_instinct_scope(
                name="alpha", type_="behavior", project_id=bad_pid, root=tmp_path
            )

    def test_project_id_global_token_is_reserved(self, tmp_path: Path) -> None:
        # Reserving "global" prevents a malicious or accidental
        # project_id="global" from colliding with the shared global scope.
        with pytest.raises(InstinctValidationError) as exc_info:
            resolve_instinct_scope(
                name="alpha",
                type_="behavior",
                project_id=GLOBAL_SCOPE,
                root=tmp_path,
            )
        assert "reserved" in str(exc_info.value).lower()


# --- dedup_instinct (feature #20) ----------------------------------------


def _instinct_md_with_desc(name: str, description: str, action: str = "Do the thing.") -> str:
    """Return instinct markdown with a specific description for dedup testing."""
    return (
        "---\n"
        f'name: "{name}"\n'
        f'description: "{description}"\n'
        'type: "pattern"\n'
        "confidence: 0.8\n"
        'created: "2026-05-24T12:00:00Z"\n'
        'last_seen: "2026-05-24T12:00:00Z"\n'
        "occurrences: 1\n"
        "success_count: 0\n"
        "usage_count: 0\n"
        "ttl_days: 30\n"
        'project_scope: "global"\n'
        "---\n\n"
        f"# {name}\n\n## Action\n\n{action}\n\n## Evidence\n\nnone\n\n## Examples\n\nnone\n"
    )


class TestDedupInstinctExactMatch:
    """Identical instincts deduped without Task call."""

    def test_exact_name_match_is_duplicate(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="use-grep-first",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc(
                "use-grep-first", "Always grep before reading whole files"
            ),
        )
        result = dedup_instinct(
            name="use-grep-first",
            description="Always grep before reading whole files",
            store=store,
        )
        assert result.is_duplicate is True
        assert result.matched_name == "use-grep-first"
        assert result.similarity_score == 1.0
        assert result.method == "exact"

    def test_identical_description_high_score_is_duplicate(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="grep-before-read",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc(
                "grep-before-read",
                "Always use grep to locate symbols before reading entire files",
            ),
        )
        result = dedup_instinct(
            name="grep-first-pattern",
            description="Always use grep to locate symbols before reading entire files",
            store=store,
        )
        assert result.is_duplicate is True
        assert result.similarity_score >= DEDUP_FAST_ACCEPT
        assert result.method == "fast"


class TestDedupInstinctLlmFallback:
    """Semantically-equivalent instincts deduped via LLM judge callback."""

    def test_similar_description_triggers_llm_and_dedupes(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        existing_desc = "Use grep to search for identifiers before loading full file contents"
        store.put(
            name="grep-before-read",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc("grep-before-read", existing_desc),
        )
        judge_calls: list[tuple[str, str]] = []
        candidate_desc = "Use grep to find symbols before reading full file contents"

        def mock_judge(candidate: str, existing: str) -> bool:
            judge_calls.append((candidate, existing))
            return True

        result = dedup_instinct(
            name="search-then-read",
            description=candidate_desc,
            store=store,
            llm_judge=mock_judge,
        )
        assert result.is_duplicate is True
        assert result.method == "llm"
        assert len(judge_calls) == 1
        assert result.matched_name == "grep-before-read"

    def test_llm_judge_says_distinct_preserves(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        existing_desc = "Use grep to search for identifiers before loading full file contents"
        store.put(
            name="grep-before-read",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc("grep-before-read", existing_desc),
        )
        candidate_desc = "Use grep to find symbols before reading full file contents"

        def mock_judge(_candidate: str, _existing: str) -> bool:
            return False

        result = dedup_instinct(
            name="search-then-read",
            description=candidate_desc,
            store=store,
            llm_judge=mock_judge,
        )
        assert result.is_duplicate is False
        assert result.method == "llm"
        assert result.matched_name is None

    def test_no_llm_judge_in_ambiguous_zone_is_conservative(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        existing_desc = "Use grep to search for identifiers before loading full file contents"
        store.put(
            name="grep-before-read",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc("grep-before-read", existing_desc),
        )
        candidate_desc = "Use grep to find symbols before reading full file contents"
        result = dedup_instinct(
            name="search-then-read",
            description=candidate_desc,
            store=store,
            llm_judge=None,
        )
        assert result.is_duplicate is False
        assert result.method == "none"


class TestDedupInstinctDistinct:
    """Truly distinct instincts preserved."""

    def test_completely_different_instincts_are_not_duplicates(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="grep-before-read",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc(
                "grep-before-read",
                "Use grep to search for identifiers before loading full file contents",
            ),
        )
        result = dedup_instinct(
            name="run-tests-first",
            description="Always run the test suite before committing code changes",
            store=store,
        )
        assert result.is_duplicate is False
        assert result.similarity_score < DEDUP_FAST_MAYBE
        assert result.method == "fast"

    def test_empty_store_returns_not_duplicate(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        result = dedup_instinct(
            name="new-instinct",
            description="A brand new instinct",
            store=store,
        )
        assert result.is_duplicate is False
        assert result.matched_name is None
        assert result.similarity_score == 0.0
        assert result.method == "none"

    def test_multiple_instincts_picks_best_match(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="use-typescript",
            scope="global",
            type_="convention",
            content=_instinct_md_with_desc(
                "use-typescript", "Always write frontend code in TypeScript"
            ),
        )
        store.put(
            name="prefer-python",
            scope="global",
            type_="convention",
            content=_instinct_md_with_desc("prefer-python", "Always write backend code in Python"),
        )
        result = dedup_instinct(
            name="write-backend-python",
            description="Backend services should be written in Python",
            store=store,
        )
        assert result.matched_name == "prefer-python" or result.similarity_score < DEDUP_FAST_MAYBE


class TestDedupInstinctEdgeCases:
    def test_instinct_with_corrupt_frontmatter_skipped(self, tmp_path: Path) -> None:
        store = InstinctStore(root=tmp_path)
        store.put(
            name="corrupt-one",
            scope="global",
            type_="pattern",
            content="not valid frontmatter at all",
        )
        store.put(
            name="valid-one",
            scope="global",
            type_="pattern",
            content=_instinct_md_with_desc("valid-one", "A valid instinct description"),
        )
        result = dedup_instinct(
            name="valid-one",
            description="A valid instinct description",
            store=store,
        )
        assert result.is_duplicate is True
        assert result.matched_name == "valid-one"

    def test_dedup_thresholds_are_sane(self) -> None:
        assert 0.0 < DEDUP_FAST_MAYBE < DEDUP_FAST_ACCEPT <= 1.0


# --- Module-level imports stable ---------------------------------------


def test_unused_import_anchor_is_kept_in_sync() -> None:
    """``InstinctChecksumMismatch`` is a public symbol — keep it importable."""
    assert issubclass(InstinctChecksumMismatch, RuntimeError)
