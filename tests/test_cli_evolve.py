"""Tests for the ``evolve`` CLI subcommand.

After feature #25, ``cli._handle_evolve`` dispatches the
``instinct-promoter`` subagent via an injectable executor instead of
running ``promotion_engine.promote`` directly. Tests inject a fake
executor (mirroring the ``eval_runner._default_executor`` pattern)
that returns a canned agent JSON payload and, when needed, captures
the payload the CLI sent so threshold-routing assertions still hold.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from platxa_agent_generator.cli import CLI, PromoterExecutor, PromotionDispatchError
from platxa_agent_generator.instinct_store import InstinctStore


def _make_instinct_content(
    name: str,
    *,
    confidence: float = 0.8,
    usage_count: int = 5,
    success_count: int = 3,
    description: str = "test instinct",
    type_: str = "tool_use",
) -> str:
    """Build instinct markdown with promotion-relevant frontmatter fields."""
    return "\n".join(
        [
            "---",
            f"name: {name}",
            f"description: {description}",
            f"confidence: {confidence}",
            f"usage_count: {usage_count}",
            f"success_count: {success_count}",
            f"type: {type_}",
            "created: 2026-05-01T00:00:00Z",
            "last_seen: 2026-05-25T00:00:00Z",
            "---",
            "",
            f"# {name}",
            "",
            "Body text.",
            "",
        ]
    )


def _seed_store(tmp_path: Path, instincts: list[dict[str, object]]) -> Path:
    """Write instincts to a temp store and return the root path."""
    root = tmp_path / "instincts"
    store = InstinctStore(root=root)
    for inst in instincts:
        store.put(
            name=str(inst["name"]),
            scope=str(inst["scope"]),
            type_=str(inst["type"]),
            content=str(inst["content"]),
            created=str(inst.get("created", "")),
            last_seen=str(inst.get("last_seen", "")),
        )
    return root


def _promotion(
    name: str,
    *,
    target: str = "command",
    confidence: float = 0.9,
    occurrences: int = 5,
    success_count: int = 2,
) -> dict[str, object]:
    """Build one promotion entry shaped per agents/instinct-promoter.md."""
    return {
        "target": target,
        "name": name,
        "description": f"description of {name}",
        "draft_path": f"commands/{name}.md",
        "source_instincts": [name],
        "occurrences": occurrences,
        "confidence": confidence,
        "success_count": success_count,
        "rationale": "test promotion",
        "examples": ["example"],
    }


def _make_executor(
    *,
    promotions: list[dict[str, object]] | None = None,
    skipped_reason: str | None = None,
    thresholds: dict[str, int | float] | None = None,
    captured: list[dict[str, object]] | None = None,
) -> PromoterExecutor:
    """Build a fake executor that returns canned agent JSON.

    When ``captured`` is supplied, the executor appends the decoded
    payload to it on every call so tests can assert on what the CLI
    sent. The default behaviour ignores the payload and returns the
    canned response.
    """

    payload_promotions = promotions if promotions is not None else []
    payload_thresholds = (
        thresholds
        if thresholds is not None
        else {
            "occurrences": 3,
            "confidence": 0.7,
            "success_count": 1,
        }
    )

    def _exec(payload_json: str, _timeout: int) -> str:
        if captured is not None:
            captured.append(json.loads(payload_json))
        return json.dumps(
            {
                "promotions": payload_promotions,
                "skipped_clusters": [],
                "thresholds": payload_thresholds,
                "scope": "global",
                "skipped_reason": skipped_reason,
            }
        )

    return _exec


class TestEvolveBasic:
    """Basic evolve subcommand behavior."""

    def test_evolve_no_instincts_returns_zero(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = tmp_path / "empty-instincts"
        root.mkdir()
        cli = CLI(promoter_executor=_make_executor())
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["candidates"] == []
        assert output["total_evaluated"] == 0

    def test_evolve_dry_run_json_reports_eligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "eligible-one",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "eligible-one", confidence=0.9, usage_count=5, success_count=2
                    ),
                },
            ],
        )
        cli = CLI(promoter_executor=_make_executor(promotions=[_promotion("eligible-one")]))
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["dry_run"] is True
        assert output["candidates"][0]["name"] == "eligible-one"

    def test_evolve_filters_ineligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "below-threshold",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "below-threshold", confidence=0.3, usage_count=1, success_count=0
                    ),
                },
            ],
        )
        # Agent filters out the ineligible instinct → returns empty promotions
        cli = CLI(promoter_executor=_make_executor(promotions=[]))
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 0
        assert output["total_evaluated"] == 1


class TestEvolveThresholdOverride:
    """--threshold and --min-occurrences flag behavior.

    After delegation to the agent, the CLI is responsible for resolving
    flags into the agent's ``thresholds`` payload field. These tests
    capture the payload sent to the executor and assert the resolved
    threshold appears in both the payload and the JSON output.
    """

    def test_threshold_override_lowers_bar(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "marginal",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "marginal", confidence=0.5, usage_count=3, success_count=1
                    ),
                },
            ],
        )
        captured: list[dict[str, object]] = []
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[_promotion("marginal", confidence=0.5)],
                thresholds={"occurrences": 3, "confidence": 0.4, "success_count": 1},
                captured=captured,
            )
        )
        rc = cli.run(["--json", "evolve", "--dry-run", "--threshold", "0.4", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["confidence"] == 0.4
        assert len(captured) == 1
        sent_thresholds = captured[0]["thresholds"]
        assert isinstance(sent_thresholds, dict)
        assert sent_thresholds["confidence"] == 0.4

    def test_min_occurrences_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "low-occ",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "low-occ", confidence=0.9, usage_count=2, success_count=1
                    ),
                },
            ],
        )
        captured: list[dict[str, object]] = []
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[_promotion("low-occ", occurrences=2)],
                thresholds={"occurrences": 2, "confidence": 0.7, "success_count": 1},
                captured=captured,
            )
        )
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--min-occurrences",
                "2",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["occurrences"] == 2
        sent_thresholds = captured[0]["thresholds"]
        assert isinstance(sent_thresholds, dict)
        assert sent_thresholds["occurrences"] == 2

    def test_min_success_count_override(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "low-succ",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "low-succ", confidence=0.9, usage_count=5, success_count=0
                    ),
                },
            ],
        )
        captured: list[dict[str, object]] = []
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[_promotion("low-succ", success_count=0)],
                thresholds={"occurrences": 3, "confidence": 0.7, "success_count": 0},
                captured=captured,
            )
        )
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--min-success-count",
                "0",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 1
        assert output["thresholds"]["success_count"] == 0
        sent_thresholds = captured[0]["thresholds"]
        assert isinstance(sent_thresholds, dict)
        assert sent_thresholds["success_count"] == 0

    def test_threshold_override_raises_bar(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "was-eligible",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "was-eligible", confidence=0.8, usage_count=5, success_count=2
                    ),
                },
            ],
        )
        # Agent enforces the higher floor → returns empty promotions
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[],
                thresholds={"occurrences": 3, "confidence": 0.95, "success_count": 1},
            )
        )
        rc = cli.run(
            [
                "--json",
                "evolve",
                "--dry-run",
                "--threshold",
                "0.95",
                "--root",
                str(root),
            ]
        )
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 0


class TestEvolveTargetFilter:
    """--target flag filters by promotion target classification."""

    def test_target_all_returns_all_eligible(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "inst-a",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("inst-a"),
                },
                {
                    "name": "inst-b",
                    "scope": "global",
                    "type": "discovery",
                    "content": _make_instinct_content("inst-b", type_="discovery"),
                },
            ],
        )
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[
                    _promotion("inst-a", target="command"),
                    _promotion("inst-b", target="skill"),
                ]
            )
        )
        rc = cli.run(["--json", "evolve", "--dry-run", "--target", "all", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["eligible"] == 2

    def test_target_skill_filters_correctly(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "workflow-inst",
                    "scope": "global",
                    "type": "discovery",
                    "content": _make_instinct_content(
                        "workflow-inst",
                        type_="discovery",
                        description="multi-step workflow pipeline orchestration",
                    ),
                },
                {
                    "name": "cmd-inst",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content(
                        "cmd-inst", type_="tool_use", description="run execute validate check"
                    ),
                },
            ],
        )
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[
                    _promotion("workflow-inst", target="skill"),
                    _promotion("cmd-inst", target="command"),
                ]
            )
        )
        rc = cli.run(["--json", "evolve", "--dry-run", "--target", "skill", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["target_filter"] == "skill"
        names = {c["name"] for c in output["candidates"]}
        assert "workflow-inst" in names
        assert "cmd-inst" not in names


class TestEvolveHumanOutput:
    """Human-readable (non-JSON) output mode."""

    def test_dry_run_human_output(self, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "promoted-one",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("promoted-one"),
                },
            ],
        )
        cli = CLI(promoter_executor=_make_executor(promotions=[_promotion("promoted-one")]))
        rc = cli.run(["evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Would promote" in out
        assert "promoted-one" in out

    def test_non_dry_run_human_output(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "ready-inst",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("ready-inst"),
                },
            ],
        )
        cli = CLI(promoter_executor=_make_executor(promotions=[_promotion("ready-inst")]))
        rc = cli.run(["evolve", "--root", str(root)])
        assert rc == 0
        out = capsys.readouterr().out
        assert "Eligible for promotion" in out
        assert "ready-inst" in out


class TestEvolveDispatchErrors:
    """Failure modes for the agent dispatch."""

    def test_malformed_json_returns_exit_one(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "any",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("any"),
                },
            ],
        )

        def _bad_json_exec(_payload: str, _timeout: int) -> str:
            return "not valid JSON {{{"

        cli = CLI(promoter_executor=_bad_json_exec)
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 1
        output = json.loads(capsys.readouterr().out)
        assert "error" in output
        assert "non-JSON" in output["error"]

    def test_dispatch_error_propagates_exit_one(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "any",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("any"),
                },
            ],
        )

        def _failing_exec(_payload: str, _timeout: int) -> str:
            raise PromotionDispatchError("claude CLI not found; install Claude Code")

        cli = CLI(promoter_executor=_failing_exec)
        rc = cli.run(["evolve", "--root", str(root)])
        assert rc == 1
        captured = capsys.readouterr()
        assert "dispatch failed" in captured.err
        assert "claude CLI not found" in captured.err

    def test_skipped_reason_surfaces_in_json_output(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "any",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("any"),
                },
            ],
        )
        cli = CLI(
            promoter_executor=_make_executor(
                promotions=[], skipped_reason="store had no clustered entries"
            )
        )
        rc = cli.run(["--json", "evolve", "--root", str(root)])
        assert rc == 0
        output = json.loads(capsys.readouterr().out)
        assert output["skipped_reason"] == "store had no clustered entries"
        assert output["eligible"] == 0


class TestEvolveEnvVarThresholds:
    """``PLATXA_PROMOTION_THRESHOLDS`` env var feeds the agent payload."""

    def test_env_var_overrides_defaults(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "from-env",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("from-env"),
                },
            ],
        )
        monkeypatch.setenv(
            "PLATXA_PROMOTION_THRESHOLDS",
            json.dumps({"occurrences": 5, "confidence": 0.85, "success_count": 2}),
        )
        captured: list[dict[str, object]] = []
        cli = CLI(promoter_executor=_make_executor(captured=captured))
        rc = cli.run(["--json", "evolve", "--dry-run", "--root", str(root)])
        assert rc == 0
        capsys.readouterr()  # drain
        sent_thresholds = captured[0]["thresholds"]
        assert isinstance(sent_thresholds, dict)
        assert sent_thresholds["occurrences"] == 5
        assert sent_thresholds["confidence"] == 0.85
        assert sent_thresholds["success_count"] == 2

    def test_cli_flag_overrides_env_var(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        root = _seed_store(
            tmp_path,
            [
                {
                    "name": "any",
                    "scope": "global",
                    "type": "tool_use",
                    "content": _make_instinct_content("any"),
                },
            ],
        )
        monkeypatch.setenv("PLATXA_PROMOTION_THRESHOLDS", json.dumps({"confidence": 0.85}))
        captured: list[dict[str, object]] = []
        cli = CLI(promoter_executor=_make_executor(captured=captured))
        rc = cli.run(["--json", "evolve", "--threshold", "0.5", "--root", str(root)])
        assert rc == 0
        capsys.readouterr()  # drain
        sent_thresholds = captured[0]["thresholds"]
        assert isinstance(sent_thresholds, dict)
        assert sent_thresholds["confidence"] == 0.5
