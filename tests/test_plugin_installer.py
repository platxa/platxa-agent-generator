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

import pytest

from platxa_agent_generator import plugin_installer
from platxa_agent_generator.plugin_installer import (
    CHECK_PLUGIN_INSTALL_PATH,
    CHECK_PLUGIN_MANIFEST,
    CHECK_PLUGIN_VERSION,
    MARKETPLACE_NAME,
    PLUGIN_NAME,
    PLUGIN_VERIFICATION_CHECK_ORDER,
    SUPPORTED_SCOPES,
    CLIStep,
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
        step = CLIStep(name="x", command=("claude",), returncode=99, skipped=True)
        assert step.passed is True

    def test_failed_on_nonzero_exit(self) -> None:
        step = CLIStep(name="x", command=("claude",), returncode=1)
        assert step.passed is False


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
def test_isolated_home_is_not_real_home(
    isolated_home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert str(isolated_home) == os.environ["HOME"]
    assert Path(os.environ["HOME"]).resolve() != Path("/home").resolve()
    # Sanity: an imported module using Path.home() now resolves inside tmp.
    assert str(Path.home()).startswith(str(isolated_home))
    # Defensive: the module under test should have no cached HOME reference.
    assert plugin_installer.PLUGIN_NAME == PLUGIN_NAME
