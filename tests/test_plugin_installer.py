#!/usr/bin/env python3
"""Tests for :mod:`platxa_agent_generator.plugin_installer`.

Strategy: exercise the module's public surface with a stub ``claude``
binary so the tests don't depend on Claude Code being installed in
CI. The stub is a bash script on ``$PATH`` whose behavior is driven by
environment variables — each scenario (success, failure, timeout) is
covered by a different stub configuration. This matches how
``install_agent.py`` tests drive the real CLI via subprocess while
keeping the tests hermetic.

The alternative — patching :func:`subprocess.run` via ``monkeypatch`` —
was rejected because :func:`plugin_installer._resolve_claude_bin` uses
:func:`shutil.which` on the CLI name, and monkey-patching that too
would leave the subprocess call path untested. Running a real
subprocess against a stub gives real coverage of the full call path.
"""

from __future__ import annotations

import json
import os
import stat
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from platxa_agent_generator import plugin_installer
from platxa_agent_generator.plugin_installer import (
    CHECK_PLUGIN_INSTALL_PATH,
    CHECK_PLUGIN_MANIFEST,
    CHECK_PLUGIN_VERSION,
    KNOWN_REGISTRY_SCHEMA_VERSION,
    MARKETPLACE_NAME,
    PLUGIN_NAME,
    PLUGIN_VERIFICATION_CHECK_ORDER,
    SUPPORTED_SCOPES,
    CLIStep,
    InstallScope,
    PluginInstallResult,
    PluginStatus,
    PostInstallPluginVerification,
    _verify_plugin_installation,
    get_plugin_repo_root,
    install_plugin,
    plugin_status,
    uninstall_plugin,
    validate_plugin_source,
)

# ---------------------------------------------------------------------------
# Stub CLI helpers
# ---------------------------------------------------------------------------


def _make_stub_claude(
    bin_dir: Path,
    *,
    exit_code: int = 0,
    stdout: str = "ok",
    stderr: str = "",
) -> Path:
    """Create an executable stub named ``claude`` in ``bin_dir``.

    Returns the stub's path so tests can point ``claude_bin`` at it
    directly. The stub prints a deterministic line so assertions can
    verify it was actually invoked (and not some other ``claude`` on
    the developer's PATH)."""
    stub = bin_dir / "claude"
    escaped_stdout = stdout.replace("'", "'\\''")
    escaped_stderr = stderr.replace("'", "'\\''")
    stub.write_text(
        "#!/usr/bin/env bash\n"
        f"echo '{escaped_stdout}'\n"
        f"echo '{escaped_stderr}' >&2\n"
        f"exit {exit_code}\n"
    )
    stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return stub


def _write_installed_registry(
    home: Path,
    *,
    scope: str,
    install_path: Path,
    version: str,
    marketplace_location: str = "/repo/platxa-agent-generator",
) -> None:
    """Populate a realistic ``~/.claude/plugins/*.json`` pair.

    Mirrors the shape Claude Code itself writes after a successful
    ``claude plugin install`` so post-install verification
    (:func:`plugin_installer._verify_plugin_installation`) passes on a
    correctly-prepared test fixture. Separated from the stub claude
    because tests exercise both the "stub drives install" path and the
    "pre-existing install" path, and both need the same registry layout.
    """
    plugins_dir = home / ".claude" / "plugins"
    plugins_dir.mkdir(parents=True, exist_ok=True)
    (plugins_dir / "installed_plugins.json").write_text(
        json.dumps(
            {
                "version": 2,
                "plugins": {
                    f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [
                        {
                            "scope": scope,
                            "installPath": str(install_path),
                            "version": version,
                        }
                    ]
                },
            }
        )
    )
    (plugins_dir / "known_marketplaces.json").write_text(
        json.dumps({MARKETPLACE_NAME: {"installLocation": marketplace_location}})
    )


def _make_valid_plugin_cache(cache_root: Path, *, version: str) -> Path:
    """Create a minimal on-disk plugin cache that passes verification.

    The cache only needs a ``.claude-plugin/plugin.json`` with a matching
    ``version``; verification does not introspect any other files. Returns
    ``cache_root`` so tests can pass it into :func:`_write_installed_registry`.
    """
    manifest_dir = cache_root / ".claude-plugin"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "plugin.json").write_text(json.dumps({"name": PLUGIN_NAME, "version": version}))
    return cache_root


def _source_plugin_version() -> str:
    """Return the version in the repo's own ``.claude-plugin/plugin.json``.

    Read once per test so fixtures stay aligned with the source that
    :func:`_verify_plugin_installation` compares against."""
    return json.loads((get_plugin_repo_root() / ".claude-plugin" / "plugin.json").read_text())[
        "version"
    ]


def _make_install_simulating_stub(
    bin_dir: Path,
    *,
    home: Path,
    install_path: Path,
    version: str,
    marketplace_location: str | None = None,
) -> Path:
    """Create a ``claude`` stub that simulates the registry side-effects of
    a real install.

    Unlike :func:`_make_stub_claude`, this stub detects its subcommand
    (``plugin install`` vs ``plugin marketplace add``) and writes the
    corresponding ``~/.claude/plugins/*.json`` file to make
    :func:`plugin_installer.plugin_status` report a healthy post-install
    state. This is required for end-to-end tests of
    :func:`install_plugin` now that the return path runs
    :func:`plugin_installer._verify_plugin_installation`.

    We keep :func:`_make_stub_claude` separate (plain echo + exit) so
    failure-path tests can still use it without the registry-writing
    side effect interfering with their assertions."""
    stub = bin_dir / "claude"
    plugins_dir = home / ".claude" / "plugins"
    # The stub's shell body writes fully-formed JSON via heredocs. We
    # avoid ``jq`` or similar tools so the test suite has no extra
    # runtime dependencies.
    loc = marketplace_location if marketplace_location is not None else str(get_plugin_repo_root())
    installed_json = json.dumps(
        {
            "version": 2,
            "plugins": {
                f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [
                    {
                        "scope": "user",
                        "installPath": str(install_path),
                        "version": version,
                    }
                ]
            },
        }
    )
    marketplaces_json = json.dumps({MARKETPLACE_NAME: {"installLocation": loc}})
    stub.write_text(
        "#!/usr/bin/env bash\n"
        f'PLUGINS_DIR="{plugins_dir}"\n'
        'mkdir -p "$PLUGINS_DIR"\n'
        'echo "ok"\n'
        # Detect subcommand pattern by scanning argv. The real CLI's
        # argv shape for these two cases is deterministic; we match on
        # the meaningful positional tokens.
        'args="$*"\n'
        'case "$args" in\n'
        '  *"plugin install"*)\n'
        f"    cat > \"$PLUGINS_DIR/installed_plugins.json\" <<'INSTALLED_JSON_EOF'\n"
        f"{installed_json}\n"
        "INSTALLED_JSON_EOF\n"
        "    ;;\n"
        '  *"plugin marketplace add"*)\n'
        f"    cat > \"$PLUGINS_DIR/known_marketplaces.json\" <<'MARKET_JSON_EOF'\n"
        f"{marketplaces_json}\n"
        "MARKET_JSON_EOF\n"
        "    ;;\n"
        '  *"plugin uninstall"*)\n'
        # Uninstall simulates removal by clearing the plugin entry; the
        # marketplace entry survives (matches real CLI behavior).
        '    rm -f "$PLUGINS_DIR/installed_plugins.json"\n'
        "    ;;\n"
        "esac\n"
        "exit 0\n"
    )
    stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return stub


def _make_sleeping_stub(bin_dir: Path, *, sleep_seconds: int = 3) -> Path:
    """Create a ``claude`` stub that sleeps before exiting.

    Used by :class:`TestTimeoutPath` to drive the real
    :class:`subprocess.TimeoutExpired` branch of
    :func:`plugin_installer._run_claude`. Distinct from
    :func:`_make_stub_claude` so timeout tests don't accidentally reuse
    an ``exit_code``-driven stub (which would never trigger the timeout)
    and so the failure-path stubs stay free of ``sleep`` — a lurking
    sleep in a stub that's supposed to fail fast would silently slow the
    whole test suite."""
    stub = bin_dir / "claude"
    stub.write_text(f"#!/usr/bin/env bash\nsleep {sleep_seconds}\nexit 0\n")
    stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return stub


@pytest.fixture
def isolated_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """Redirect ``~/.claude`` to a tmp dir so tests don't touch real state.

    The installer reads ``~/.claude/plugins/installed_plugins.json`` and
    ``known_marketplaces.json``. Pointing :envvar:`HOME` at a clean tmp
    dir gives us a predictable empty initial state without having to
    patch every path-lookup function."""
    monkeypatch.setenv("HOME", str(tmp_path))
    yield tmp_path


# ---------------------------------------------------------------------------
# Validation + discovery
# ---------------------------------------------------------------------------


class TestValidation:
    """Tests for ``validate_plugin_source`` and repo-root discovery."""

    def test_get_plugin_repo_root_finds_manifest(self) -> None:
        """Repo root lookup resolves to the directory that has plugin.json."""
        root = get_plugin_repo_root()
        assert (root / ".claude-plugin" / "plugin.json").is_file()

    def test_validate_plugin_source_clean(self) -> None:
        """A well-formed repo produces zero errors."""
        assert validate_plugin_source() == []

    def test_validate_plugin_source_missing_manifest(self, tmp_path: Path) -> None:
        """Missing plugin.json surfaces as a precise error."""
        errors = validate_plugin_source(tmp_path)
        assert any("plugin manifest missing" in e for e in errors)

    def test_validate_plugin_source_wrong_name(self, tmp_path: Path) -> None:
        """Mismatched plugin name is flagged before install."""
        (tmp_path / ".claude-plugin").mkdir()
        (tmp_path / ".claude-plugin" / "plugin.json").write_text(
            json.dumps(
                {
                    "name": "wrong-name",
                    "version": "0.0.1",
                    "description": "stub",
                }
            )
        )
        (tmp_path / ".claude-plugin" / "marketplace.json").write_text(
            json.dumps(
                {
                    "name": MARKETPLACE_NAME,
                    "owner": {"name": "t"},
                    "plugins": [{"name": PLUGIN_NAME, "source": "./"}],
                }
            )
        )
        errors = validate_plugin_source(tmp_path)
        assert any("does not match expected" in e for e in errors)

    def test_validate_plugin_source_missing_in_marketplace(self, tmp_path: Path) -> None:
        """Plugin not listed in marketplace manifest is flagged."""
        (tmp_path / ".claude-plugin").mkdir()
        (tmp_path / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "0.0.1", "description": "s"})
        )
        (tmp_path / ".claude-plugin" / "marketplace.json").write_text(
            json.dumps(
                {
                    "name": "other-market",
                    "owner": {"name": "t"},
                    "plugins": [{"name": "something-else", "source": "./"}],
                }
            )
        )
        errors = validate_plugin_source(tmp_path)
        assert any("does not list plugin" in e for e in errors)


class TestValidatePluginSourceMalformedJSON:
    """JSONDecodeError-branch coverage for :func:`validate_plugin_source`
    (Feature #13, spec issue #11 of the 19).

    Before this class, only the structural failure paths of
    :func:`validate_plugin_source` were tested (missing manifest, wrong
    name, missing entry). The two ``json.loads`` calls — one for
    ``plugin.json`` (plugin_installer.py:348) and one for
    ``marketplace.json`` (plugin_installer.py:370) — each wrapped in a
    ``try/except json.JSONDecodeError`` that appends to the error list,
    had NO test coverage. That meant a regression removing either
    ``except`` (letting the exception propagate) would pass CI silently
    and break :func:`install_plugin`'s "structured result, never raise"
    contract at the first call site (install_plugin.py:711 reads
    ``validate_plugin_source`` as if it always returns cleanly).

    Each test isolates ONE malformed manifest while keeping the other
    well-formed, so the assertion can target exactly one branch at a
    time — otherwise a passing assertion would not prove *which*
    ``except`` caught the error."""

    def test_malformed_plugin_json(self, tmp_path: Path) -> None:
        """Success Criterion: an unparseable ``plugin.json`` produces an
        error list entry whose prefix pins the faulty file, and
        :func:`validate_plugin_source` does NOT let the
        :class:`json.JSONDecodeError` propagate.

        Setup: write bytes that are unambiguously non-JSON (``"{not
        json"``) — a missing closing brace is a parser-recognized
        failure on every platform's ``json`` module, not a locale- or
        version-dependent edge case. Marketplace manifest is kept
        well-formed so a failure of its branch cannot falsely satisfy
        the assertion."""
        (tmp_path / ".claude-plugin").mkdir()
        (tmp_path / ".claude-plugin" / "plugin.json").write_text("{not json")
        (tmp_path / ".claude-plugin" / "marketplace.json").write_text(
            json.dumps(
                {
                    "name": MARKETPLACE_NAME,
                    "owner": {"name": "t"},
                    "plugins": [{"name": PLUGIN_NAME, "source": "./"}],
                }
            )
        )

        # Must not raise — a propagated JSONDecodeError would break
        # install_plugin's "structured result" contract.
        errors = validate_plugin_source(tmp_path)

        assert any("plugin manifest is not valid JSON" in e for e in errors), (
            f"expected 'plugin manifest is not valid JSON' in errors, got {errors}"
        )
        # Sanity: marketplace branch did NOT also flag (kept it clean).
        assert not any("marketplace manifest is not valid JSON" in e for e in errors), (
            f"marketplace branch should not fire when marketplace.json is clean; errors={errors}"
        )

    def test_malformed_marketplace_json(self, tmp_path: Path) -> None:
        """Success Criterion: an unparseable ``marketplace.json`` produces
        an error list entry whose prefix pins the faulty file, and
        :func:`validate_plugin_source` does NOT let the
        :class:`json.JSONDecodeError` propagate.

        Plugin manifest is kept well-formed to isolate the marketplace
        branch — same reasoning as :meth:`test_malformed_plugin_json`
        but for the companion ``except`` at plugin_installer.py:371."""
        (tmp_path / ".claude-plugin").mkdir()
        (tmp_path / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "0.0.1", "description": "s"})
        )
        (tmp_path / ".claude-plugin" / "marketplace.json").write_text("][")

        errors = validate_plugin_source(tmp_path)

        assert any("marketplace manifest is not valid JSON" in e for e in errors), (
            f"expected 'marketplace manifest is not valid JSON' in errors, got {errors}"
        )
        # Sanity: plugin.json branch did NOT also flag.
        assert not any("plugin manifest is not valid JSON" in e for e in errors), (
            f"plugin branch should not fire when plugin.json is clean; errors={errors}"
        )


# ---------------------------------------------------------------------------
# Status reads
# ---------------------------------------------------------------------------


class TestPluginStatus:
    """Tests for :func:`plugin_status`."""

    def test_status_when_nothing_installed(self, isolated_home: Path) -> None:
        """With no registry files present, status reports clean state."""
        status = plugin_status()
        assert status == PluginStatus(
            plugin_installed=False,
            marketplace_registered=False,
        )

    def test_status_when_installed(self, isolated_home: Path) -> None:
        """Populated registry files map to the expected dataclass fields."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps(
                {
                    "version": 2,
                    "plugins": {
                        f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [
                            {
                                "scope": "user",
                                "installPath": "/cache/platxa/1.0.1",
                                "version": "1.0.1",
                            }
                        ]
                    },
                }
            )
        )
        (plugins_dir / "known_marketplaces.json").write_text(
            json.dumps(
                {
                    MARKETPLACE_NAME: {
                        "installLocation": "/repo/platxa-agent-generator",
                    }
                }
            )
        )
        status = plugin_status()
        assert status.plugin_installed is True
        assert status.marketplace_registered is True
        assert status.installed_scope == "user"
        assert status.installed_version == "1.0.1"
        assert status.install_path == "/cache/platxa/1.0.1"
        assert status.marketplace_path == "/repo/platxa-agent-generator"


# ---------------------------------------------------------------------------
# install_plugin / uninstall_plugin with a stub CLI
# ---------------------------------------------------------------------------


class TestInstallPlugin:
    """Behavior of :func:`install_plugin` against a stub CLI."""

    def test_invalid_scope_rejected(self) -> None:
        """Unsupported scope value short-circuits before any subprocess runs."""
        result = install_plugin(scope="nope")  # type: ignore[arg-type]
        assert result.success is False
        assert "Unsupported scope" in result.message
        assert result.steps == []

    def test_successful_install_runs_both_steps(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Fresh state → both marketplace add and plugin install execute.

        Feature #2 gates ``success`` on ``verification.valid``, so this
        test uses an install-simulating stub that writes a realistic
        registry entry + cache (mirroring what real ``claude plugin
        install`` does). Verification then sees a healthy post-install
        state and the end-to-end ``success=True`` contract holds."""
        version = _source_plugin_version()
        cache_root = _make_valid_plugin_cache(tmp_path / "cache", version=version)
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_install_simulating_stub(
            bin_dir,
            home=isolated_home,
            install_path=cache_root,
            version=version,
        )

        result = install_plugin(scope="user", claude_bin=str(stub))

        assert result.success is True, result.message
        assert [s.name for s in result.steps] == ["marketplace add", "plugin install"]
        assert all(not s.skipped for s in result.steps)
        # Verification must have run and must have passed end-to-end.
        assert result.verification is not None
        assert result.verification.valid is True, result.verification.findings

    def test_marketplace_add_failure_aborts_install(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """If marketplace add fails, the plugin install step must not run."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir, exit_code=1, stderr="marketplace exists")
        result = install_plugin(scope="user", claude_bin=str(stub))
        assert result.success is False
        # Only the marketplace step should have executed.
        assert len(result.steps) == 1
        assert result.steps[0].name == "marketplace add"
        assert result.steps[0].returncode == 1

    def test_already_installed_is_idempotent(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Re-running install on a healthy state skips both CLI steps.

        Feature #2 now runs verification even on the skip path, so this
        test must provide a realistic cache (manifest + matching version)
        or the end-to-end ``success=True`` assertion will correctly fail
        against an unverified-install state."""
        version = _source_plugin_version()
        cache_root = _make_valid_plugin_cache(tmp_path / "cache", version=version)
        _write_installed_registry(
            isolated_home,
            scope="user",
            install_path=cache_root,
            version=version,
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir, stdout="should not run")
        result = install_plugin(scope="user", claude_bin=str(stub))
        assert result.success is True, result.message
        assert all(step.skipped for step in result.steps)
        assert result.plugin_already_installed is True
        assert result.marketplace_already_present is True
        # Verification must have run on the skip path too.
        assert result.verification is not None
        assert result.verification.valid is True

    def test_missing_claude_bin_surfaces_helpful_error(self) -> None:
        """A missing ``claude`` binary produces a FileNotFoundError-shaped message."""
        result = install_plugin(
            scope="user",
            claude_bin="/nonexistent/path/to/claude-XYZ-not-real",
        )
        assert result.success is False
        assert "not found on $PATH" in result.message

    def test_supported_scopes_enum_matches_literal(self) -> None:
        """The SUPPORTED_SCOPES tuple must stay in sync with the Literal type.

        The CLI ``--scope`` argparse choices are built from this tuple;
        drift between the two would let the argparse layer accept a
        value the installer then rejects."""
        assert set(SUPPORTED_SCOPES) == {"user", "project", "local"}


class TestForceReinstallScope:
    """End-to-end coverage of the Feature #3 force-reinstall scope fix:
    the force-uninstall CLIStep MUST use ``status.installed_scope``, not
    the caller-requested ``scope``. Duplicate registry entries from the
    prior buggy behaviour are a silent data hazard — caught here.

    Feature #11 (TESTING) depends on #3 and extends this class with
    additional scenarios. The canonical Success Criterion #7 test lives
    here because #3's verification is gated on it passing."""

    def test_uninstall_uses_installed_scope(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Success Criterion #7: ``force=True`` with a caller-requested
        scope that differs from ``status.installed_scope`` must issue
        ``plugin uninstall --scope <installed_scope>``, not
        ``--scope <caller-scope>``.

        Setup: registry shows plugin installed at scope=project with a
        non-existent cache path (we don't care about the install step's
        verification result — we're asserting on the argv of the
        uninstall CLIStep). Caller requests ``install_plugin(scope="user",
        force=True)``. Before the fix, the uninstall argv contained
        ``--scope user`` (wrong); after the fix it contains ``--scope
        project``."""
        _write_installed_registry(
            isolated_home,
            scope="project",
            install_path=tmp_path / "old-cache",  # deliberately absent
            version=_source_plugin_version(),
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = install_plugin(scope="user", force=True, claude_bin=str(stub))

        # Locate the force-uninstall step by its fixed name.
        uninstall_steps = [s for s in result.steps if s.name == "plugin uninstall (force)"]
        assert len(uninstall_steps) == 1, (
            f"expected exactly one 'plugin uninstall (force)' step, "
            f"got {[s.name for s in result.steps]!r}"
        )
        cmd = uninstall_steps[0].command
        # argv shape: (claude_bin, 'plugin', 'uninstall', PLUGIN_NAME, '--scope', <scope>)
        assert "--scope" in cmd, f"missing --scope in uninstall argv: {cmd!r}"
        scope_idx = cmd.index("--scope")
        assert cmd[scope_idx + 1] == "project", (
            f"force-uninstall used wrong scope: expected 'project' "
            f"(status.installed_scope), got {cmd[scope_idx + 1]!r}"
        )

    def test_no_uninstall_step_when_not_installed(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Feature #11 extension: ``force=True`` on a fresh HOME must NOT
        emit a ``plugin uninstall (force)`` step.

        Pins the short-circuit at ``plugin_installer.py:767``:
        ``if status.plugin_installed and force:``. When the registry has no
        entry for PLUGIN_NAME, there is nothing to uninstall — emitting a
        force-uninstall against a non-existent install would surface as a
        confusing failure to operators and risk tearing down unrelated
        state on a concurrent install. The gate MUST trip on
        ``plugin_installed=False`` regardless of the ``force`` flag.

        Without this assertion, a future refactor that hoisted the
        uninstall step above the ``plugin_installed`` check would pass
        the canonical scope-correctness test (it uses installed_scope)
        but still regress by invoking uninstall on a missing install."""
        # No _write_installed_registry call — the isolated HOME starts
        # without installed_plugins.json, so status.plugin_installed is
        # False.
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)

        result = install_plugin(scope="user", force=True, claude_bin=str(stub))

        # The force-uninstall step's canonical name — same sentinel used
        # by the scope-correctness test above, so a future rename has to
        # update both places (and this comment) in one edit.
        uninstall_steps = [s for s in result.steps if s.name == "plugin uninstall (force)"]
        assert uninstall_steps == [], (
            f"force-uninstall must not run when plugin is not installed, "
            f"found {[s.name for s in result.steps]!r}"
        )


class TestCorruptedRegistry:
    """End-to-end coverage of the Feature #5 silent-failure fix:
    :func:`plugin_status` must translate a malformed registry JSON file
    into ``PluginStatus(registry_corrupted=True)`` instead of letting
    ``json.JSONDecodeError`` propagate out to callers.

    Before this feature, ``install_plugin`` called ``plugin_status()``
    on line 621 as its first non-trivial step — an unparseable
    ``installed_plugins.json`` raised ``JSONDecodeError`` from there,
    breaking the "always returns a ``PluginInstallResult``" contract
    every caller relies on.

    Feature #11 (TESTING) depends on this feature and extends the class
    with additional scenarios (corrupted ``known_marketplaces.json``,
    partial JSON, etc.). The canonical Success Criterion #9 test lives
    here because #5's verification is gated on it passing."""

    def test_invalid_json(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Success Criterion #9: when ``installed_plugins.json`` contains
        bytes that don't parse as JSON, :func:`plugin_status` returns
        ``PluginStatus(registry_corrupted=True)`` and :func:`install_plugin`
        returns a ``PluginInstallResult`` — neither raises
        ``JSONDecodeError``.

        Setup: write raw non-JSON bytes (``"not json {"``) to
        ``~/.claude/plugins/installed_plugins.json`` under the isolated
        HOME. The file exists on disk (so ``_read_json_if_present``
        can't short-circuit it with the "missing file" path) but is
        unparseable. Then assert both the direct ``plugin_status()``
        call and the indirect call inside ``install_plugin`` survive
        the malformed bytes."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text("not json {")

        status = plugin_status()
        assert status.registry_corrupted is True, (
            f"expected registry_corrupted=True on malformed JSON, got {status!r}"
        )
        # Other fields must remain at their "nothing registered" defaults
        # — callers that check registry_corrupted before plugin_installed
        # must not see a stale True from a previous parse.
        assert status.plugin_installed is False
        assert status.marketplace_registered is False
        assert status.installed_scope is None
        assert status.installed_version is None
        assert status.install_path is None
        assert status.marketplace_path is None

        # install_plugin calls plugin_status() as its first non-trivial
        # step (see plugin_installer.py:621). Without the fix, the
        # JSONDecodeError would propagate here and break the
        # isinstance() assertion.
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = install_plugin(scope="user", claude_bin=str(stub))
        assert isinstance(result, PluginInstallResult), (
            f"install_plugin must return PluginInstallResult on corrupted "
            f"registry; got {type(result).__name__}"
        )

    def test_corrupted_known_marketplaces(
        self,
        isolated_home: Path,
    ) -> None:
        """Feature #11 extension: a malformed ``known_marketplaces.json``
        must also yield ``registry_corrupted=True``, not propagate the
        ``JSONDecodeError``.

        The fix at ``plugin_installer.py:429-444`` wraps *both* registry
        reads in the same try/except — installed_plugins AND known
        marketplaces. The canonical ``test_invalid_json`` only exercises
        the first file; this scenario exercises the second, closing the
        symmetric failure path.

        Setup: ``installed_plugins.json`` is absent (``_read_json_if_present``
        returns None, no parse attempted), but ``known_marketplaces.json``
        contains unparseable bytes. The try/except catches the
        JSONDecodeError from the marketplaces read and the function
        returns the same structured failure as the installed-plugins
        path."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        # installed_plugins.json deliberately absent — exercises the
        # path where _read_json_if_present returns None before markets
        # is read. If a future refactor re-orders the reads (markets
        # first, installed second), this test still catches corruption
        # of either.
        (plugins_dir / "known_marketplaces.json").write_text("}{ garbage")

        status = plugin_status()

        # Same contract as the canonical invalid-JSON test: corruption
        # on either registry file collapses to registry_corrupted=True
        # with all other fields at their "nothing registered" defaults.
        assert status.registry_corrupted is True, (
            f"expected registry_corrupted=True on malformed marketplaces JSON, got {status!r}"
        )
        assert status.plugin_installed is False
        assert status.marketplace_registered is False
        assert status.installed_scope is None


class TestSchemaVersionWarning:
    """Coverage of the Feature #6 unknown-schema-version observability fix:
    :func:`plugin_status` must surface the registry's ``version`` integer
    on :attr:`PluginStatus.schema_version` and log a WARNING whenever
    that integer diverges from :data:`KNOWN_REGISTRY_SCHEMA_VERSION`.

    Before this feature, an unknown schema would silently parse
    best-effort with no operator signal — a shifted layout could strip
    fields from :class:`PluginStatus` without any trace. Logging and
    exposing the version lets operators correlate surprising status
    output with a registry upgrade."""

    def test_unknown_version_logs_warning(
        self,
        isolated_home: Path,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Success Criterion #15: registry JSON with an unknown
        ``version`` integer (here ``99``) surfaces on
        ``PluginStatus.schema_version`` and emits a WARNING log whose
        message includes ``schema_version``.

        Setup: write a minimal registry with ``"version": 99`` under the
        isolated HOME. Capture logs at WARNING or above via caplog at
        the module logger's name; assert the field carries 99 and at
        least one captured record matches the expected shape."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps({"version": 99, "plugins": {}})
        )

        with caplog.at_level("WARNING", logger="platxa_agent_generator.plugin_installer"):
            status = plugin_status()

        assert status.schema_version == 99, (
            f"expected schema_version=99 from registry, got {status.schema_version!r}"
        )
        # Emit at least one WARNING-level record whose message mentions
        # schema_version so operators can grep the phrase directly in
        # their log aggregator (criterion asserts "'schema_version'" in
        # the message, not in the logger name).
        warning_records = [
            r
            for r in caplog.records
            if r.levelname == "WARNING" and "schema_version" in r.getMessage()
        ]
        assert warning_records, (
            f"expected at least one WARNING record mentioning 'schema_version'; "
            f"got {[(r.levelname, r.getMessage()) for r in caplog.records]!r}"
        )

    def test_known_version_does_not_warn(
        self,
        isolated_home: Path,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """A registry file at the canonical :data:`KNOWN_REGISTRY_SCHEMA_VERSION`
        must NOT emit any schema_version warning — otherwise operators
        would see a false-positive every time status is queried on a
        healthy install."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps({"version": KNOWN_REGISTRY_SCHEMA_VERSION, "plugins": {}})
        )

        with caplog.at_level("WARNING", logger="platxa_agent_generator.plugin_installer"):
            status = plugin_status()

        assert status.schema_version == KNOWN_REGISTRY_SCHEMA_VERSION
        warning_records = [r for r in caplog.records if "schema_version" in r.getMessage()]
        assert not warning_records, (
            f"known schema_version must not warn; got {[r.getMessage() for r in warning_records]!r}"
        )


class TestUninstallPlugin:
    """Behavior of :func:`uninstall_plugin` against a stub CLI."""

    def test_uninstall_when_not_installed_is_noop(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Uninstall on clean state returns success with a skipped step."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = uninstall_plugin(scope="user", claude_bin=str(stub))
        assert result.success is True
        assert result.steps[0].skipped is True

    def test_uninstall_runs_when_installed(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Uninstall with an installed plugin runs the real CLI step."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps(
                {
                    "plugins": {
                        f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [{"scope": "user", "version": "1.0.1"}]
                    }
                }
            )
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = uninstall_plugin(scope="user", claude_bin=str(stub))
        assert result.success is True
        assert any(s.name == "plugin uninstall" and not s.skipped for s in result.steps)

    def test_remove_marketplace_opt_in(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """``remove_marketplace=True`` adds the marketplace-remove step."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "known_marketplaces.json").write_text(
            json.dumps({MARKETPLACE_NAME: {"installLocation": "/repo"}})
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = uninstall_plugin(
            scope="user",
            remove_marketplace=True,
            claude_bin=str(stub),
        )
        assert result.success is True
        step_names = [s.name for s in result.steps]
        assert "marketplace remove" in step_names


# ---------------------------------------------------------------------------
# CLIStep type invariants
# ---------------------------------------------------------------------------


class TestCLIStep:
    """CLIStep.passed must track both success and skip correctly."""

    def test_passed_on_success(self) -> None:
        step = CLIStep(name="x", command=("claude",), returncode=0)
        assert step.passed is True

    def test_passed_on_skip(self) -> None:
        # Feature #7 invariant: skipped steps must carry returncode==0
        # (the legacy ``returncode=99, skipped=True`` shape is now a
        # construction error — see TestCLIStepInvariant below).
        step = CLIStep(name="x", command=("claude",), returncode=0, skipped=True)
        assert step.passed is True

    def test_failed_on_nonzero_exit(self) -> None:
        step = CLIStep(name="x", command=("claude",), returncode=1)
        assert step.passed is False


class TestCLIStepInvariant:
    """Feature #7 (issue #6 sub-fix A): CLIStep enforces the invariant
    that ``skipped=True`` implies ``returncode == 0``. Before the
    invariant, a caller could construct a logically impossible step
    (skipped but with a non-zero exit code) which :attr:`CLIStep.passed`
    would short-circuit to ``True`` via its ``skipped or returncode == 0``
    rule — silently masking real construction bugs. The invariant makes
    the invalid state unrepresentable."""

    def test_skipped_nonzero_raises(self) -> None:
        """Success Criterion #10: ``CLIStep(skipped=True, returncode=1)``
        must raise ``ValueError`` at construction time."""
        with pytest.raises(ValueError, match="skipped=True.*requires returncode==0"):
            CLIStep(name="x", command=("claude",), returncode=1, skipped=True)

    def test_skipped_zero_constructs(self) -> None:
        """The valid skipped shape (returncode==0) still constructs cleanly."""
        step = CLIStep(name="x", command=("claude",), returncode=0, skipped=True)
        assert step.skipped is True
        assert step.returncode == 0
        assert step.passed is True

    def test_unskipped_nonzero_constructs(self) -> None:
        """A non-skipped failed step is unaffected by the invariant —
        the invariant only fires on the (skipped, non-zero) combination."""
        step = CLIStep(name="x", command=("claude",), returncode=99, skipped=False)
        assert step.passed is False


class TestSupportedScopes:
    """Feature #7 (issue #6 sub-fix B): :data:`SUPPORTED_SCOPES` is
    derived from :data:`InstallScope` via :func:`typing.get_args`. This
    eliminates the silent-drift hazard the previous duplicate-literal
    definition created — the static type and the runtime tuple now share
    a single source of truth."""

    def test_derived_from_literal(self) -> None:
        """Success Criterion #11: ``set(SUPPORTED_SCOPES)`` equals
        ``set(typing.get_args(InstallScope))`` — derivation is structural,
        not a copy that could drift."""
        import typing

        assert set(SUPPORTED_SCOPES) == set(typing.get_args(InstallScope))


class TestCLISubprocessOutput:
    """Structured-result contract for :func:`plugin_installer._run_claude`
    under OS-level failures (Feature #4, spec issue #3).

    Before this feature, ``_run_claude`` only caught ``TimeoutExpired``;
    an ``OSError`` (including ``PermissionError`` and ``BrokenPipeError``)
    propagated and broke the "every failure returns a CLIStep" contract.
    The test uses a real non-executable file on disk — not a monkeypatch
    on :func:`subprocess.run` — per Boundaries rule #12 ("use a stub
    claude binary ... to exercise the actual error branches").

    Feature #12 (TESTING) extends this class with subprocess-level
    ``--json`` output-shape and exit-code assertions for the three
    plugin CLI subcommands. Keeping the OSError test here (rather than
    in a one-off class) lets the class accumulate the full subprocess
    coverage surface in one place."""

    def test_oserror_returns_structured_result(self, tmp_path: Path) -> None:
        """Success Criterion #8: when the OS cannot spawn the child
        process, ``_run_claude`` returns ``CLIStep(returncode=-2,
        stderr="subprocess spawn failed: ...")`` instead of letting the
        ``OSError`` propagate.

        Setup: create an executable file whose shebang points to a
        nonexistent interpreter. ``shutil.which`` accepts the file
        (exists + executable) so ``_resolve_claude_bin`` passes, but the
        kernel's ``execve`` fails when it tries to load the missing
        interpreter — ``subprocess.run`` raises ``FileNotFoundError``
        (an ``OSError`` subclass) before any child process starts. This
        exercises the real error branch — not a patched one — per
        Boundaries rule #12 ("use a stub claude binary ... to exercise
        the actual error branches")."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = bin_dir / "claude"
        # Nonexistent interpreter — kernel-level exec failure, not a
        # post-exec exit code. This path triggers the OSError branch in
        # _run_claude; a normal shebang (#!/usr/bin/env bash) would
        # succeed and hit the success path instead.
        stub.write_text("#!/nonexistent/interpreter-xyz\n")
        stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        step = plugin_installer._run_claude(
            ["plugin", "status"],
            claude_bin=str(stub),
        )

        assert step.returncode == -2, (
            f"expected returncode=-2 (spawn failure), got {step.returncode}"
        )
        assert step.stderr.startswith("subprocess spawn failed:"), (
            f"expected stderr to start with 'subprocess spawn failed:', got {step.stderr!r}"
        )
        assert step.stdout == "", f"expected empty stdout on spawn failure, got {step.stdout!r}"
        # Name derivation still runs on the failure path so callers can
        # identify the step in PluginInstallResult.steps by fixed name.
        assert step.name == "plugin status"

    # ---- Feature #12: --json output-shape + exit-code assertions ----
    #
    # These tests drive the CLI end-to-end (``CLI().run([...])``) with a
    # stub ``claude`` on PATH so the subprocess layer executes for real
    # but against a known binary. We do NOT monkey-patch
    # :func:`subprocess.run` or :func:`shutil.which` — the whole point of
    # :func:`plugin_installer._resolve_claude_bin` is to route through
    # ``shutil.which``, and a patch there would mask any regression in
    # that path. Prepending the stub's directory to ``$PATH`` gives real
    # coverage of the resolution + spawn pipeline (Boundaries rule #12).

    _INSTALL_RESULT_KEYS: frozenset[str] = frozenset(
        {
            "success",
            "message",
            "plugin_install_path",
            "marketplace_added",
            "marketplace_already_present",
            "plugin_already_installed",
            "steps",
        }
    )
    _STEP_KEYS: frozenset[str] = frozenset(
        {"name", "command", "returncode", "stdout", "stderr", "skipped", "passed"}
    )
    _STATUS_KEYS: frozenset[str] = frozenset(
        {
            "plugin_installed",
            "marketplace_registered",
            "installed_scope",
            "installed_version",
            "install_path",
            "marketplace_path",
        }
    )

    def _run_cli(
        self,
        argv: list[str],
        *,
        capsys: pytest.CaptureFixture[str],
    ) -> tuple[int, dict[str, Any]]:
        """Invoke ``CLI().run(argv)`` and return ``(exit_code, parsed_json)``.

        Kept as a helper (not a fixture) so each test's setup — stub on
        PATH, registry state — is visible inline. The helper only handles
        the two pieces every JSON-output test needs: dispatching the CLI
        and parsing captured stdout. Imports happen at the callsite level
        because :class:`CLI` is a heavy module and the rest of this test
        file does not need it."""
        from platxa_agent_generator.cli import CLI

        rc = CLI().run(argv)
        captured = capsys.readouterr()
        assert captured.out, (
            f"CLI {argv!r} produced no stdout — --json mode must always emit JSON. "
            f"stderr={captured.err!r}"
        )
        payload = json.loads(captured.out)
        return rc, payload

    def test_install_plugin_json_shape_on_success(
        self,
        isolated_home: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """``install-plugin --json`` success path emits the full
        :func:`cli._plugin_result_to_dict` schema and returns exit 0.

        Uses :func:`_make_install_simulating_stub` so post-install
        verification sees a healthy registry and the end-to-end
        ``success=True`` contract holds (same pattern as
        :meth:`TestInstallPlugin.test_successful_install_runs_both_steps`).
        Asserts every top-level key defined in
        :data:`_INSTALL_RESULT_KEYS` and every step key in
        :data:`_STEP_KEYS` is present — drift in either schema would be
        a breaking change for machine-readable consumers."""
        version = _source_plugin_version()
        cache_root = _make_valid_plugin_cache(tmp_path / "cache", version=version)
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        _make_install_simulating_stub(
            bin_dir,
            home=isolated_home,
            install_path=cache_root,
            version=version,
        )
        monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

        rc, payload = self._run_cli(
            ["--json", "install-plugin", "--scope", "user"],
            capsys=capsys,
        )

        assert rc == 0, f"expected exit 0 on success, got {rc}; payload={payload}"
        assert set(payload.keys()) == self._INSTALL_RESULT_KEYS, (
            f"top-level schema drift; diff={set(payload.keys()) ^ self._INSTALL_RESULT_KEYS}"
        )
        assert payload["success"] is True, payload["message"]
        assert isinstance(payload["steps"], list) and payload["steps"], (
            "success path must record at least one CLIStep"
        )
        for step in payload["steps"]:
            assert set(step.keys()) == self._STEP_KEYS, (
                f"step schema drift; diff={set(step.keys()) ^ self._STEP_KEYS}"
            )

    def test_install_plugin_exit_code_maps_failure_to_one(
        self,
        isolated_home: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """``install-plugin --json`` with a failing stub returns rc=1 and
        ``payload["success"] is False`` — the CLI contract is ``0 if
        result.success else 1``.

        Stub exits with code 1 on the marketplace-add step, which aborts
        the install. The important assertion is the exit-code → success
        mapping: a rc=0 here would silently mask failures for CI
        consumers."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        _make_stub_claude(bin_dir, exit_code=1, stderr="marketplace exists")
        monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

        rc, payload = self._run_cli(
            ["--json", "install-plugin", "--scope", "user"],
            capsys=capsys,
        )

        assert rc == 1, f"expected exit 1 on failure, got {rc}; payload={payload}"
        assert payload["success"] is False
        # Schema must hold on the failure path too — callers parse it
        # either way.
        assert set(payload.keys()) == self._INSTALL_RESULT_KEYS

    def test_uninstall_plugin_json_shape_on_success(
        self,
        isolated_home: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """``uninstall-plugin --json`` success path emits the full
        :func:`cli._plugin_result_to_dict` schema and returns exit 0.

        Pre-populates the registry so the uninstall step actually runs
        (the no-op path skips the step and wouldn't exercise the full
        schema for a real subprocess call)."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps(
                {
                    "plugins": {
                        f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [{"scope": "user", "version": "1.0.1"}]
                    }
                }
            )
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        _make_stub_claude(bin_dir)
        monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

        rc, payload = self._run_cli(
            ["--json", "uninstall-plugin", "--scope", "user"],
            capsys=capsys,
        )

        assert rc == 0, f"expected exit 0 on success, got {rc}; payload={payload}"
        assert set(payload.keys()) == self._INSTALL_RESULT_KEYS
        assert payload["success"] is True
        assert any(
            step["name"] == "plugin uninstall" and not step["skipped"] for step in payload["steps"]
        ), "uninstall path must have run the plugin uninstall CLIStep"
        for step in payload["steps"]:
            assert set(step.keys()) == self._STEP_KEYS

    def test_uninstall_plugin_exit_code_maps_failure_to_one(
        self,
        isolated_home: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """``uninstall-plugin --json`` with a failing stub returns rc=1."""
        plugins_dir = isolated_home / ".claude" / "plugins"
        plugins_dir.mkdir(parents=True)
        (plugins_dir / "installed_plugins.json").write_text(
            json.dumps(
                {
                    "plugins": {
                        f"{PLUGIN_NAME}@{MARKETPLACE_NAME}": [{"scope": "user", "version": "1.0.1"}]
                    }
                }
            )
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        _make_stub_claude(bin_dir, exit_code=1, stderr="uninstall failed")
        monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")

        rc, payload = self._run_cli(
            ["--json", "uninstall-plugin", "--scope", "user"],
            capsys=capsys,
        )

        assert rc == 1, f"expected exit 1 on failure, got {rc}; payload={payload}"
        assert payload["success"] is False

    def test_plugin_status_json_shape(
        self,
        isolated_home: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        """``plugin-status --json`` emits the :class:`PluginStatus`-shaped
        dict and always returns exit 0.

        Pre-populates the registry so every optional field is non-null
        (scope, version, install_path, marketplace_path) and the full
        schema surface is asserted — a ``plugin-status`` on a clean
        system would leave several fields as ``None`` and weaker-cover
        the shape. No stub claude is needed: :func:`plugin_status` is
        pure-read against the JSON registries and never spawns a
        subprocess."""
        install_path = isolated_home / "cache"
        install_path.mkdir()
        _write_installed_registry(
            isolated_home,
            scope="user",
            install_path=install_path,
            version="1.0.1",
        )

        rc, payload = self._run_cli(["--json", "plugin-status"], capsys=capsys)

        assert rc == 0, f"plugin-status always returns 0; got {rc}"
        assert set(payload.keys()) == self._STATUS_KEYS, (
            f"status schema drift; diff={set(payload.keys()) ^ self._STATUS_KEYS}"
        )
        assert payload["plugin_installed"] is True
        assert payload["marketplace_registered"] is True
        assert payload["installed_scope"] == "user"
        assert payload["installed_version"] == "1.0.1"


class TestTimeoutPath:
    """Structured-result contract for :func:`plugin_installer._run_claude`
    under a :class:`subprocess.TimeoutExpired` exception (Feature #12,
    spec issue #9 of the 19).

    Complements :class:`TestCLISubprocessOutput` — which covers the
    ``OSError`` (returncode=-2) and normal-exit branches — by exercising
    the third and final branch of the ``try/except/except/return`` shape
    in :func:`_run_claude`. Without this test the timeout branch has no
    coverage, so a regression that, say, forgets to prefix ``stderr``
    with "timed out" or that sets ``returncode=None`` would go
    unnoticed. Kept in its own class (rather than added to
    :class:`TestCLISubprocessOutput`) because the setup is
    sleep-dependent and this isolation keeps the non-timeout tests fast.
    """

    def test_timeout_returns_step(self, tmp_path: Path) -> None:
        """Success Criterion #16: :func:`_run_claude` catches
        :class:`subprocess.TimeoutExpired` and returns
        ``CLIStep(returncode=-1, stderr="timed out after Ns: ...")``
        instead of letting the exception propagate.

        Drives the branch with a real stub that sleeps 3s while the
        caller sets timeout=1s. A shorter gap (e.g., sleep=1, timeout=1)
        is racy on loaded CI runners; 3x headroom is enough to be
        deterministic without slowing the suite noticeably."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_sleeping_stub(bin_dir, sleep_seconds=3)

        step = plugin_installer._run_claude(
            ["plugin", "status"],
            claude_bin=str(stub),
            timeout=1,
        )

        assert step.returncode == -1, (
            f"expected returncode=-1 (timeout), got {step.returncode}; stderr={step.stderr!r}"
        )
        assert "timed out" in step.stderr, f"expected 'timed out' in stderr, got {step.stderr!r}"
        # Name derivation must also hold on the timeout branch so
        # callers can identify the step in PluginInstallResult.steps.
        assert step.name == "plugin status"


class TestPluginInstallResult:
    """Smoke tests on the aggregate result dataclass defaults."""

    def test_defaults(self) -> None:
        result = PluginInstallResult(success=True, message="ok")
        assert result.steps == []
        assert result.plugin_install_path is None
        assert result.marketplace_added is False
        assert result.marketplace_already_present is False
        assert result.plugin_already_installed is False


class TestPostInstallVerification:
    """End-to-end coverage of the Feature #2 verification gate: ``install_plugin``
    must map ``verification.valid=False`` to ``result.success=False``.

    Complements :class:`TestPostInstallPluginVerification` which unit-tests
    the verification function in isolation — this class tests that the
    result is actually wired into the return path of ``install_plugin``,
    which is Success Criterion #6."""

    def test_missing_install_path(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """install_plugin returns success=False + verification.valid=False
        when the registry points at an install_path that doesn't exist
        on disk (Success Criterion #6).

        Setup: register the plugin as already-installed at the requested
        scope, but with an install_path pointing to a path that was
        never created. The CLI is short-circuited (skipped=True for both
        steps), so verification is the ONLY thing that can distinguish
        healthy from corrupt — exactly the silent-success hazard the
        feature targets."""
        ghost = tmp_path / "does-not-exist"
        _write_installed_registry(
            isolated_home,
            scope="user",
            install_path=ghost,
            version=_source_plugin_version(),
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = install_plugin(scope="user", claude_bin=str(stub))
        assert result.success is False, result.message
        assert result.verification is not None
        assert result.verification.valid is False
        # The specific failing check must be install_path, not something else.
        assert any(
            f.startswith(f"{CHECK_PLUGIN_INSTALL_PATH}:") for f in result.verification.findings
        ), f"expected install_path finding, got {result.verification.findings!r}"

    def test_valid_install_sets_verification_valid_true(
        self,
        isolated_home: Path,
        tmp_path: Path,
    ) -> None:
        """Counterpart to the failure case: when the cache is healthy the
        gate lets ``success=True`` through and ``verification.valid`` is
        True. Covers the happy path of the same gate so we know the
        `False` above isn't a vacuous always-fail."""
        version = _source_plugin_version()
        cache_root = _make_valid_plugin_cache(tmp_path / "cache", version=version)
        _write_installed_registry(
            isolated_home,
            scope="user",
            install_path=cache_root,
            version=version,
        )
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        stub = _make_stub_claude(bin_dir)
        result = install_plugin(scope="user", claude_bin=str(stub))
        assert result.success is True, result.message
        assert result.verification is not None
        assert result.verification.valid is True
        assert result.verification.findings == []


class TestPluginInstallResultVerificationField:
    """The new ``verification`` field on :class:`PluginInstallResult` must
    default to ``None`` for early-exit return paths (bad scope, missing
    CLI, etc.) so callers can distinguish "verification ran and failed"
    from "verification never got a chance to run"."""

    def test_default_is_none(self) -> None:
        result = PluginInstallResult(success=True, message="ok")
        assert result.verification is None

    def test_early_exit_leaves_verification_none(self) -> None:
        """Unsupported scope short-circuits before verification runs."""
        result = install_plugin(scope="nope")  # type: ignore[arg-type]
        assert result.success is False
        assert result.verification is None, (
            "verification must stay None when the install exits before "
            "reaching the post-install check"
        )


class TestPostInstallPluginVerification:
    """Structural parity with ``install_agent.PostInstallVerification``
    plus smoke coverage of the three ``_verify_plugin_installation``
    checks. Feature #2 wires this dataclass into ``install_plugin``'s
    return path — if the field set here drifts from the agent variant,
    that downstream gate breaks. Pin the shape and the check ordering."""

    def test_fields_match_spec(self) -> None:
        """One-line ``dataclass.fields()`` check — the spec's
        structural-parity criterion (`PostInstallPluginVerification` must
        mirror `PostInstallVerification` name-for-name, type-for-type)."""
        import dataclasses

        from platxa_agent_generator.install_agent import PostInstallVerification

        plugin_fields = {f.name: f.type for f in dataclasses.fields(PostInstallPluginVerification)}
        agent_fields = {f.name: f.type for f in dataclasses.fields(PostInstallVerification)}
        assert plugin_fields == agent_fields, (
            f"field drift: plugin={plugin_fields} agent={agent_fields}"
        )

    def test_check_order_is_canonical(self) -> None:
        """Check names and ordering are part of the public contract —
        tooling (tests, future status renderers) indexes on them."""
        assert PLUGIN_VERIFICATION_CHECK_ORDER == (
            CHECK_PLUGIN_INSTALL_PATH,
            CHECK_PLUGIN_MANIFEST,
            CHECK_PLUGIN_VERSION,
        )

    def test_defaults_empty_lists(self) -> None:
        """Constructing only ``valid`` must yield empty, independent lists
        (no shared mutable default across instances)."""
        a = PostInstallPluginVerification(valid=True)
        b = PostInstallPluginVerification(valid=True)
        assert a.checks == [] and a.findings == []
        a.checks.append("x")
        assert b.checks == [], "default_factory must produce independent lists"

    def test_verify_missing_install_path(self) -> None:
        """Registry entry with no ``install_path`` → install_path check
        fails; remaining checks still run so callers see the full picture."""
        status = PluginStatus(
            plugin_installed=True,
            marketplace_registered=True,
            installed_scope="user",
            installed_version="1.0.1",
            install_path=None,
            marketplace_path=None,
        )
        result = _verify_plugin_installation(status)
        assert result.valid is False
        assert result.checks == list(PLUGIN_VERIFICATION_CHECK_ORDER)
        assert any(CHECK_PLUGIN_INSTALL_PATH in f for f in result.findings)

    def test_verify_install_path_not_a_directory(self, tmp_path: Path) -> None:
        """Registry points at a non-existent path → install_path finding
        surfaces with the concrete path in the message."""
        ghost = tmp_path / "nope"
        status = PluginStatus(
            plugin_installed=True,
            marketplace_registered=True,
            installed_scope="user",
            installed_version="1.0.1",
            install_path=str(ghost),
            marketplace_path=None,
        )
        result = _verify_plugin_installation(status)
        assert result.valid is False
        assert any(CHECK_PLUGIN_INSTALL_PATH in f and str(ghost) in f for f in result.findings)

    def test_verify_missing_manifest(self, tmp_path: Path) -> None:
        """Install dir exists but no ``.claude-plugin/plugin.json`` →
        manifest check fails (distinct from install_path failure)."""
        status = PluginStatus(
            plugin_installed=True,
            marketplace_registered=True,
            installed_scope="user",
            installed_version="1.0.1",
            install_path=str(tmp_path),
            marketplace_path=None,
        )
        result = _verify_plugin_installation(status)
        assert result.valid is False
        assert any(CHECK_PLUGIN_MANIFEST in f for f in result.findings)

    def test_verify_version_mismatch(self, tmp_path: Path) -> None:
        """Cache present + manifest present + version differs from source →
        only the version check fails."""
        # Build a fake installed cache mirroring the on-disk layout.
        cache_root = tmp_path / "cache"
        (cache_root / ".claude-plugin").mkdir(parents=True)
        (cache_root / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "0.0.1"}),
            encoding="utf-8",
        )
        # Fake "source" repo with a newer version.
        source_root = tmp_path / "source"
        (source_root / ".claude-plugin").mkdir(parents=True)
        (source_root / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "9.9.9"}),
            encoding="utf-8",
        )
        status = PluginStatus(
            plugin_installed=True,
            marketplace_registered=True,
            installed_scope="user",
            installed_version="0.0.1",
            install_path=str(cache_root),
            marketplace_path=None,
        )
        result = _verify_plugin_installation(status, repo_root=source_root)
        assert result.valid is False
        findings_by_check = {
            check: [f for f in result.findings if f.startswith(check)]
            for check in PLUGIN_VERIFICATION_CHECK_ORDER
        }
        assert findings_by_check[CHECK_PLUGIN_INSTALL_PATH] == []
        assert findings_by_check[CHECK_PLUGIN_MANIFEST] == []
        assert findings_by_check[CHECK_PLUGIN_VERSION], (
            f"expected a version finding, got {result.findings!r}"
        )

    def test_verify_all_checks_pass(self, tmp_path: Path) -> None:
        """Happy path: install dir + manifest + matching version → valid=True."""
        cache_root = tmp_path / "cache"
        (cache_root / ".claude-plugin").mkdir(parents=True)
        (cache_root / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "1.2.3"}),
            encoding="utf-8",
        )
        source_root = tmp_path / "source"
        (source_root / ".claude-plugin").mkdir(parents=True)
        (source_root / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": PLUGIN_NAME, "version": "1.2.3"}),
            encoding="utf-8",
        )
        status = PluginStatus(
            plugin_installed=True,
            marketplace_registered=True,
            installed_scope="user",
            installed_version="1.2.3",
            install_path=str(cache_root),
            marketplace_path=None,
        )
        result = _verify_plugin_installation(status, repo_root=source_root)
        assert result.valid is True, f"unexpected findings: {result.findings}"
        assert result.findings == []
        assert result.checks == list(PLUGIN_VERIFICATION_CHECK_ORDER)


# Guard: ensure the isolated_home fixture can never touch the real
# home directory — a mis-wired fixture would be a silent data-loss hazard.
def test_isolated_home_is_not_real_home(isolated_home: Path) -> None:
    # HOME was actually redirected to the fixture's tmp_path.
    assert str(isolated_home) == os.environ["HOME"]
    # And that tmp_path is genuinely not a real user home. Compare
    # canonical paths so symlink-resolved equivalents (macOS /private/...)
    # do not produce false negatives.
    assert Path(os.environ["HOME"]).resolve() != Path("/home").resolve()
    # Sanity: ``Path.home()`` consults HOME, so it now resolves inside
    # tmp. Anything downstream that calls ``Path.home()`` during the
    # test therefore stays inside the sandbox.
    assert str(Path.home()).startswith(str(isolated_home))
    # Module-import health under the redirected HOME: plugin_installer
    # must still expose its public surface (import did not blow up on
    # any implicit HOME-touching computation). Use a public callable
    # rather than a string constant so a successful assertion proves
    # the module *functionally* survives, not just that a top-level
    # literal was bound.
    assert callable(plugin_installer.install_plugin)
    assert callable(plugin_installer.plugin_status)
    # Repo-root discovery is HOME-independent and must still resolve
    # to the source checkout — the directory containing the canonical
    # ``.claude-plugin/plugin.json`` manifest. If someone accidentally
    # rewires repo-root lookup to depend on HOME, this assertion fails
    # inside the isolated fixture even though the manifest-targeted
    # ``test_get_plugin_repo_root_finds_manifest`` would still pass
    # outside the fixture. That is the bug class this guard is for.
    repo_root = get_plugin_repo_root()
    assert (repo_root / ".claude-plugin" / "plugin.json").is_file(), (
        f"get_plugin_repo_root() resolved to {repo_root!r} which does not "
        f"contain .claude-plugin/plugin.json under isolated HOME "
        f"{isolated_home!r}"
    )
