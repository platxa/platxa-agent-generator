"""Tests for :mod:`platxa_agent_generator.progress_log`.

Verification criterion for feature #64: after 5 phase transitions,
``.jsonl`` has 5 valid JSON rows; ``.txt`` still appended for human
readability.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.progress_log import (
    ProgressEvent,
    ProgressLog,
)

# --- ProgressEvent dataclass ---


class TestProgressEvent:
    """ProgressEvent construction, serialization, and round-trip."""

    def test_to_txt_line_full(self) -> None:
        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="abc123",
            agent="feature-skill",
            feature_id=64,
            message="PROGRESS Phase 1: Classify",
        )
        line = event.to_txt_line()
        assert line == (
            "[2026-05-25T12:00:00Z] [session=abc123] [agent=feature-skill] "
            "[feature=#64] PROGRESS Phase 1: Classify"
        )

    def test_to_txt_line_no_feature(self) -> None:
        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="abc123",
            agent="user",
            feature_id=None,
            message="Session started",
        )
        line = event.to_txt_line()
        assert "[feature=" not in line
        assert "[agent=user]" in line

    def test_to_jsonl_line_valid_json(self) -> None:
        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="s1",
            agent="a",
            feature_id=1,
            message="msg",
        )
        line = event.to_jsonl_line()
        assert line.endswith("\n")
        data = json.loads(line)
        assert data["timestamp"] == "2026-05-25T12:00:00Z"
        assert data["feature_id"] == 1

    def test_jsonl_sorted_keys(self) -> None:
        event = ProgressEvent(timestamp="t", session_id="s", agent="a", feature_id=1, message="m")
        data = json.loads(event.to_jsonl_line())
        assert list(data.keys()) == sorted(data.keys())

    def test_from_dict_round_trip(self) -> None:
        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="abc",
            agent="bot",
            feature_id=42,
            message="done",
        )
        data = json.loads(event.to_jsonl_line())
        restored = ProgressEvent.from_dict(data)
        assert restored == event

    def test_from_dict_missing_optional_fields(self) -> None:
        data = {"timestamp": "2026-01-01T00:00:00Z"}
        event = ProgressEvent.from_dict(data)
        assert event.session_id == ""
        assert event.agent == ""
        assert event.feature_id is None
        assert event.message == ""

    def test_frozen(self) -> None:
        event = ProgressEvent(timestamp="t", session_id="s", agent="a", feature_id=1, message="m")
        with pytest.raises(AttributeError):
            event.message = "changed"  # type: ignore[misc]


# --- ProgressLog dual-write ---


class TestProgressLogDualWrite:
    """Dual-write to .txt and .jsonl files."""

    def test_log_creates_both_files(self, tmp_path: Path) -> None:
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="s1",
            agent="a",
            feature_id=1,
            message="first",
        )
        log.log(event)

        assert txt.exists()
        assert jsonl.exists()

    def test_txt_line_matches_format(self, tmp_path: Path) -> None:
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="abc",
            agent="feature-skill",
            feature_id=10,
            message="PROGRESS Phase 1: Classify",
        )
        log.log(event)

        content = txt.read_text()
        assert "[2026-05-25T12:00:00Z]" in content
        assert "[session=abc]" in content
        assert "[feature=#10]" in content
        assert content.endswith("\n")

    def test_jsonl_line_valid_json(self, tmp_path: Path) -> None:
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = ProgressEvent(
            timestamp="2026-05-25T12:00:00Z",
            session_id="s1",
            agent="a",
            feature_id=5,
            message="test",
        )
        log.log(event)

        lines = jsonl.read_text().strip().split("\n")
        assert len(lines) == 1
        data = json.loads(lines[0])
        assert data["feature_id"] == 5
        assert data["message"] == "test"

    def test_five_phase_transitions(self, tmp_path: Path) -> None:
        """Verification criterion: after 5 phase transitions, .jsonl has 5 valid
        JSON rows and .txt still appended for human readability."""
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        phases = [
            "Phase 1: Classify",
            "Phase 2: Pre-Implementation",
            "Phase 3: Implementation",
            "Phase 4: Post-Implementation",
            "Phase 5: Pass Gate",
        ]

        for i, phase in enumerate(phases):
            log.log_phase(
                phase=phase,
                session_id=f"sess-{i}",
                agent="feature-skill",
                feature_id=64,
            )

        # .jsonl has 5 valid JSON rows
        jsonl_lines = [line for line in jsonl.read_text().strip().split("\n") if line.strip()]
        assert len(jsonl_lines) == 5
        for line in jsonl_lines:
            data = json.loads(line)
            assert "timestamp" in data
            assert "message" in data
            assert data["feature_id"] == 64

        # .txt still appended with human-readable lines
        txt_lines = [line for line in txt.read_text().strip().split("\n") if line.strip()]
        assert len(txt_lines) == 5
        for line in txt_lines:
            assert line.startswith("[")
            assert "PROGRESS" in line

    def test_appends_to_existing_txt(self, tmp_path: Path) -> None:
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        txt.write_text("existing line\n")
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = ProgressEvent(timestamp="t", session_id="s", agent="a", feature_id=1, message="new")
        log.log(event)

        content = txt.read_text()
        assert content.startswith("existing line\n")
        assert "[agent=a]" in content

    def test_creates_parent_dirs(self, tmp_path: Path) -> None:
        txt = tmp_path / "deep" / "nested" / "progress.txt"
        jsonl = tmp_path / "deep" / "nested" / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = ProgressEvent(
            timestamp="t", session_id="s", agent="a", feature_id=None, message="m"
        )
        log.log(event)

        assert txt.exists()
        assert jsonl.exists()


# --- ProgressLog.log_phase convenience ---


class TestProgressLogPhase:
    """The log_phase convenience method."""

    def test_log_phase_builds_message(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_phase(
            phase="Phase 1",
            session_id="s",
            agent="bot",
            feature_id=10,
            detail="starting",
        )

        assert event.message == "PROGRESS Phase 1: starting"
        data = json.loads(jsonl.read_text().strip())
        assert data["message"] == "PROGRESS Phase 1: starting"

    def test_log_phase_no_detail(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_phase(phase="Phase 2", session_id="s", agent="a")
        assert event.message == "PROGRESS Phase 2"

    def test_log_phase_returns_event(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_phase(phase="X", session_id="s", agent="a", feature_id=1)
        assert isinstance(event, ProgressEvent)
        assert event.feature_id == 1


# --- ProgressLog.read_events ---


class TestProgressLogIterEvents:
    """Reading events back from the .jsonl file."""

    def test_read_events_empty(self, tmp_path: Path) -> None:
        log = ProgressLog(txt_path=tmp_path / "p.txt", jsonl_path=tmp_path / "p.jsonl")
        assert log.read_events() == []

    def test_read_events_round_trip(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        for i in range(3):
            log.log_phase(
                phase=f"Phase {i}",
                session_id="s",
                agent="a",
                feature_id=i,
            )

        events = log.read_events()
        assert len(events) == 3
        assert events[0].feature_id == 0
        assert events[2].feature_id == 2

    def test_read_events_skips_malformed_lines(self, tmp_path: Path) -> None:
        jsonl = tmp_path / "p.jsonl"
        jsonl.write_text(
            '{"timestamp":"t","session_id":"s","agent":"a","feature_id":1,"message":"ok"}\n'
            "not valid json\n"
            '{"timestamp":"t2","session_id":"s","agent":"a","feature_id":2,"message":"ok2"}\n'
        )
        log = ProgressLog(txt_path=tmp_path / "p.txt", jsonl_path=jsonl)
        events = log.read_events()
        assert len(events) == 2

    def test_read_events_skips_non_dict_json(self, tmp_path: Path) -> None:
        jsonl = tmp_path / "p.jsonl"
        jsonl.write_text(
            "[1, 2, 3]\n"
            '{"timestamp":"t","session_id":"s","agent":"a","feature_id":1,"message":"ok"}\n'
            "42\n"
            '"just a string"\n'
        )
        log = ProgressLog(txt_path=tmp_path / "p.txt", jsonl_path=jsonl)
        events = log.read_events()
        assert len(events) == 1

    def test_read_events_skips_blank_lines(self, tmp_path: Path) -> None:
        jsonl = tmp_path / "p.jsonl"
        jsonl.write_text(
            '{"timestamp":"t","session_id":"s","agent":"a","feature_id":1,"message":"ok"}\n'
            "\n"
            "\n"
            '{"timestamp":"t2","session_id":"s","agent":"a","feature_id":2,"message":"ok2"}\n'
        )
        log = ProgressLog(txt_path=tmp_path / "p.txt", jsonl_path=jsonl)
        events = log.read_events()
        assert len(events) == 2


# --- ProgressLog.log_dispatch convenience ---


class TestProgressLogDispatch:
    """The log_dispatch convenience method."""

    def test_log_dispatch_builds_message(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_dispatch(
            subagent="code-reviewer",
            session_id="s1",
            agent="feature-skill",
            feature_id=65,
            detail="cold-read review",
        )

        assert event.message == "DISPATCH code-reviewer: cold-read review"
        data = json.loads(jsonl.read_text().strip())
        assert data["message"] == "DISPATCH code-reviewer: cold-read review"

    def test_log_dispatch_no_detail(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_dispatch(
            subagent="plan-architect",
            session_id="s1",
            agent="feature-skill",
        )
        assert event.message == "DISPATCH plan-architect"

    def test_log_dispatch_returns_event(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        event = log.log_dispatch(
            subagent="explorer",
            session_id="s",
            agent="a",
            feature_id=42,
        )
        assert isinstance(event, ProgressEvent)
        assert event.feature_id == 42

    def test_log_dispatch_txt_contains_dispatch(self, tmp_path: Path) -> None:
        txt = tmp_path / "p.txt"
        jsonl = tmp_path / "p.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        log.log_dispatch(
            subagent="security-gate",
            session_id="s1",
            agent="feature-skill",
            feature_id=65,
        )

        content = txt.read_text()
        assert "DISPATCH security-gate" in content
        assert "[session=s1]" in content


# --- Combined phase + dispatch verification ---


class TestProgressLogCombined:
    """Verification criterion for feature #65: after 5 transitions + 3
    dispatches, both files have 8 entries each with consistent format."""

    def test_five_transitions_three_dispatches(self, tmp_path: Path) -> None:
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        phases = [
            "Phase 1: Classify",
            "Phase 2: Pre-Implementation",
            "Phase 3: Implementation",
            "Phase 4: Post-Implementation",
            "Phase 5: Pass Gate",
        ]
        dispatches = [
            "code-explorer",
            "code-reviewer",
            "plan-architect",
        ]

        for phase in phases:
            log.log_phase(
                phase=phase,
                session_id="sess-65",
                agent="feature-skill",
                feature_id=65,
            )

        for subagent in dispatches:
            log.log_dispatch(
                subagent=subagent,
                session_id="sess-65",
                agent="feature-skill",
                feature_id=65,
            )

        # .jsonl has 8 valid JSON rows
        jsonl_lines = [line for line in jsonl.read_text().strip().split("\n") if line.strip()]
        assert len(jsonl_lines) == 8
        for line in jsonl_lines:
            data = json.loads(line)
            assert "timestamp" in data
            assert "message" in data
            assert data["feature_id"] == 65

        # .txt has 8 human-readable lines
        txt_lines = [line for line in txt.read_text().strip().split("\n") if line.strip()]
        assert len(txt_lines) == 8

        # First 5 are PROGRESS, last 3 are DISPATCH
        for line in txt_lines[:5]:
            assert "PROGRESS" in line
        for line in txt_lines[5:]:
            assert "DISPATCH" in line

    def test_interleaved_phase_and_dispatch(self, tmp_path: Path) -> None:
        """Phase and dispatch events can be interleaved."""
        txt = tmp_path / "progress.txt"
        jsonl = tmp_path / "progress.jsonl"
        log = ProgressLog(txt_path=txt, jsonl_path=jsonl)

        log.log_phase(phase="Phase 1", session_id="s", agent="a", feature_id=1)
        log.log_dispatch(subagent="explorer", session_id="s", agent="a", feature_id=1)
        log.log_phase(phase="Phase 2", session_id="s", agent="a", feature_id=1)
        log.log_dispatch(subagent="reviewer", session_id="s", agent="a", feature_id=1)

        events = log.read_events()
        assert len(events) == 4
        assert "PROGRESS" in events[0].message
        assert "DISPATCH" in events[1].message
        assert "PROGRESS" in events[2].message
        assert "DISPATCH" in events[3].message
