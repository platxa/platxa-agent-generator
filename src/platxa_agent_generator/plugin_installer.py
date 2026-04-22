#!/usr/bin/env python3
"""Plugin-level installer for the platxa-agent-generator Claude Code plugin.

Where :mod:`install_agent` installs a single agent ``.md`` file into
``~/.claude/agents/``, this module installs (and uninstalls) the entire
plugin — the package that ships ``agents/``, ``skills/``, and the
``.claude-plugin/plugin.json`` manifest — via Claude Code's own plugin
system.

Design rationale
----------------

Claude Code exposes a ``claude plugin`` CLI (`claude plugin marketplace
add`, `claude plugin install`, etc.) which owns the installation state
(``~/.claude/plugins/installed_plugins.json`` and the on-disk plugin
cache). This module does **not** reach into that state directly — that
would be a workaround. Instead it drives the canonical CLI by
subprocess, letting Claude Code remain the single source of truth and
guaranteeing that installs created here are byte-identical to installs
created interactively by a user.

The repo itself acts as a single-plugin marketplace: the plugin content
sits at the repo root (``.claude-plugin/plugin.json``, ``agents/``,
``skills/``), and a companion ``.claude-plugin/marketplace.json``
declares the repo as a Claude Code marketplace whose only plugin is the
same root directory. That structure — not a separate staging area — is
what makes ``claude plugin marketplace add <repo>`` work.

Public entry points
-------------------

- :func:`install_plugin` — register the repo as a marketplace (if
  needed) and install the plugin at the requested scope. Idempotent.
- :func:`uninstall_plugin` — uninstall the plugin and optionally
  deregister the marketplace.
- :func:`plugin_status` — inspect the current install state without
  mutating anything; returns structured dataclasses.

All three return :class:`PluginInstallResult` / :class:`PluginStatus`
dataclasses with explicit success flags, so callers (the CLI, tests,
higher-level orchestrators) never have to scrape CLI stdout.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PLUGIN_NAME: str = "platxa-agent-generator"
"""Canonical plugin name — matches ``.claude-plugin/plugin.json`` ``name``."""

MARKETPLACE_NAME: str = "platxa-agent-generator"
"""Canonical marketplace name — matches ``.claude-plugin/marketplace.json``.

The plugin and marketplace share a name because the repo hosts a
single-plugin marketplace. Claude Code's install selector takes the form
``<plugin>@<marketplace>``; here both slots resolve to the same
identifier."""

DEFAULT_CLAUDE_BIN: str = "claude"
"""Default path/name of the Claude Code CLI binary. Callers can override
via the ``claude_bin`` keyword — useful in tests and in environments
where the binary isn't on ``$PATH``."""

DEFAULT_TIMEOUT_SECONDS: int = 120
"""Per-CLI-call timeout. The longest legitimate operation is the initial
``marketplace add`` which may clone a git repo; 120s covers slow network
conditions without masking a genuinely hung process."""

SUPPORTED_SCOPES: tuple[str, ...] = ("user", "project", "local")
"""Install scopes accepted by ``claude plugin install``. Kept aligned
with the CLI's ``--scope`` choices so a tighter validation error fires
here before a subprocess is spawned."""

InstallScope = Literal["user", "project", "local"]


# Verification check identifiers — surfaced via
# PostInstallPluginVerification.checks so tooling can reason about which
# checks ran independent of their pass/fail result. Deliberately public:
# tests pin both names AND ordering against these constants so a silent
# reorder or rename gets caught.
CHECK_PLUGIN_INSTALL_PATH: str = "install_path"
CHECK_PLUGIN_MANIFEST: str = "manifest"
CHECK_PLUGIN_VERSION: str = "version"

# Canonical order in which checks run during _verify_plugin_installation.
# The three checks are ordered from cheapest/most-fundamental to most
# specific — if the install directory doesn't exist, neither the manifest
# nor version check can meaningfully run.
PLUGIN_VERIFICATION_CHECK_ORDER: tuple[str, ...] = (
    CHECK_PLUGIN_INSTALL_PATH,
    CHECK_PLUGIN_MANIFEST,
    CHECK_PLUGIN_VERSION,
)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class CLIStep:
    """One invocation of the ``claude`` CLI, captured for auditability.

    Every step the installer takes ends up in
    :attr:`PluginInstallResult.steps` so callers can reconstruct exactly
    what happened — including CLI stdout/stderr when debugging a failed
    install. ``skipped`` distinguishes "we chose not to run this because
    the desired state was already present" from "we ran it and it
    succeeded"; both are success outcomes but tell different stories.
    """

    name: str
    command: tuple[str, ...]
    returncode: int
    stdout: str = ""
    stderr: str = ""
    skipped: bool = False

    @property
    def passed(self) -> bool:
        """Return True when the step succeeded or was deliberately skipped."""
        return self.skipped or self.returncode == 0


@dataclass
class PostInstallPluginVerification:
    """Result of post-install verification on an installed plugin cache.

    Mirrors :class:`install_agent.PostInstallVerification` field-for-field
    so callers can treat plugin and agent verifications uniformly. A
    verification is ``valid`` only when every check that *ran* passed.
    ``checks`` is the ordered list of check names that executed (always a
    subset of :data:`PLUGIN_VERIFICATION_CHECK_ORDER`); ``findings`` is
    the parallel list of human-readable failure messages, one per check
    that failed. An empty ``findings`` with a non-empty ``checks`` means
    every check passed — that's the success shape.
    """

    valid: bool
    checks: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)


@dataclass
class PluginInstallResult:
    """Aggregate result of :func:`install_plugin` / :func:`uninstall_plugin`.

    ``success`` is the single boolean callers gate on. ``steps`` lets
    tooling inspect per-step outcomes without re-parsing CLI output, and
    ``plugin_install_path`` (populated after a successful install) gives
    the on-disk cache location where Claude Code expanded the plugin —
    useful for follow-up verification checks.

    ``verification`` carries the post-install ``_verify_plugin_installation``
    result when :func:`install_plugin` reached the verification step. It
    is ``None`` on early-exit failures (bad scope, missing manifest,
    CLI not found, subprocess error) where the verification never ran;
    callers inspect ``verification.findings`` for the specific reason
    a verified install was marked unsuccessful."""

    success: bool
    message: str
    steps: list[CLIStep] = field(default_factory=list)
    plugin_install_path: str | None = None
    marketplace_added: bool = False
    marketplace_already_present: bool = False
    plugin_already_installed: bool = False
    verification: PostInstallPluginVerification | None = None


@dataclass
class PluginStatus:
    """Snapshot of plugin + marketplace registration state.

    Populated by :func:`plugin_status` from ``installed_plugins.json`` and
    ``known_marketplaces.json``. Absent fields (``None``) mean "not
    registered"; present-but-empty strings are an installer bug, not a
    legitimate state."""

    plugin_installed: bool
    marketplace_registered: bool
    installed_scope: str | None = None
    installed_version: str | None = None
    install_path: str | None = None
    marketplace_path: str | None = None


# ---------------------------------------------------------------------------
# Repo-root discovery
# ---------------------------------------------------------------------------


def get_plugin_repo_root() -> Path:
    """Return the absolute path of the plugin's source repository root.

    The root is identified by the presence of ``.claude-plugin/plugin.json``
    — the only file whose location is guaranteed by the Claude Code plugin
    spec. Walking upward from this module's location is robust to editable
    installs (``pip install -e``), wheel installs, and direct-script use,
    because in every case the module's parent hierarchy includes the repo
    root.

    Raises :class:`FileNotFoundError` rather than returning ``None`` — a
    missing manifest means the codebase is mis-shipped and every caller
    would have to check anyway. Failing loudly here gives a precise error
    message instead of a confusing downstream subprocess failure.
    """
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        manifest = parent / ".claude-plugin" / "plugin.json"
        if manifest.is_file():
            return parent
    raise FileNotFoundError(
        "Could not locate plugin repo root: no ancestor directory of "
        f"{here} contains .claude-plugin/plugin.json. This indicates the "
        "package was installed detached from its source repo — install "
        "with `pip install -e .` from the repo root to fix."
    )


def get_marketplace_manifest_path(repo_root: Path | None = None) -> Path:
    """Return the path where the self-hosted marketplace manifest lives."""
    root = repo_root or get_plugin_repo_root()
    return root / ".claude-plugin" / "marketplace.json"


def get_plugin_manifest_path(repo_root: Path | None = None) -> Path:
    """Return the path where the plugin manifest lives."""
    root = repo_root or get_plugin_repo_root()
    return root / ".claude-plugin" / "plugin.json"


# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------


def _resolve_claude_bin(claude_bin: str) -> str:
    """Return an absolute path to the Claude CLI, or raise if unavailable.

    ``shutil.which`` returns ``None`` when the binary is missing — we
    translate that into a precise :class:`FileNotFoundError` so the CLI
    subcommand can surface a helpful "install Claude Code first" message
    rather than a cryptic ``FileNotFoundError: [Errno 2]`` from the
    subprocess layer."""
    resolved = shutil.which(claude_bin)
    if resolved is None:
        raise FileNotFoundError(
            f"Claude Code CLI not found on $PATH (looked for '{claude_bin}'). "
            "Install Claude Code and ensure the `claude` binary is available, "
            "or pass an explicit path via the `claude_bin` argument."
        )
    return resolved


def validate_plugin_source(repo_root: Path | None = None) -> list[str]:
    """Return a list of validation errors for the on-disk plugin source.

    Checks performed:

    1. ``.claude-plugin/plugin.json`` exists, parses as JSON, and has
       the required ``name`` / ``version`` / ``description`` fields.
    2. The plugin ``name`` matches :data:`PLUGIN_NAME` — mismatch means
       the installer would register a differently-named plugin than the
       caller expects.
    3. ``.claude-plugin/marketplace.json`` exists and lists the plugin
       (the repo's self-hosting contract).

    The list is empty when the source is well-formed. Callers treat a
    non-empty list as a hard failure — :func:`install_plugin` aborts
    before touching Claude Code state."""
    errors: list[str] = []
    root = repo_root or get_plugin_repo_root()

    plugin_manifest = get_plugin_manifest_path(root)
    if not plugin_manifest.is_file():
        errors.append(f"plugin manifest missing: {plugin_manifest}")
    else:
        try:
            data = json.loads(plugin_manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"plugin manifest is not valid JSON: {exc}")
        else:
            for required in ("name", "version", "description"):
                if not data.get(required):
                    errors.append(f"plugin manifest missing required field '{required}'")
            if data.get("name") and data["name"] != PLUGIN_NAME:
                errors.append(
                    f"plugin manifest name '{data['name']}' does not match "
                    f"expected '{PLUGIN_NAME}' — the installer and manifest "
                    "must agree on the plugin identifier."
                )

    mkt_manifest = get_marketplace_manifest_path(root)
    if not mkt_manifest.is_file():
        errors.append(
            f"marketplace manifest missing: {mkt_manifest} — without it "
            "the repo cannot be registered as a Claude Code marketplace."
        )
    else:
        try:
            mkt = json.loads(mkt_manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"marketplace manifest is not valid JSON: {exc}")
        else:
            plugins = mkt.get("plugins") or []
            names = [p.get("name") for p in plugins if isinstance(p, dict)]
            if PLUGIN_NAME not in names:
                errors.append(
                    f"marketplace manifest does not list plugin '{PLUGIN_NAME}' "
                    f"(found: {names or '[]'})."
                )
    return errors


# ---------------------------------------------------------------------------
# Claude-CLI-backed state queries
# ---------------------------------------------------------------------------


def _installed_plugins_path() -> Path:
    """Location of Claude Code's installed-plugins registry."""
    return Path.home() / ".claude" / "plugins" / "installed_plugins.json"


def _known_marketplaces_path() -> Path:
    """Location of Claude Code's known-marketplaces registry."""
    return Path.home() / ".claude" / "plugins" / "known_marketplaces.json"


def _read_json_if_present(path: Path) -> dict | None:
    """Return parsed JSON, ``None`` if the file is missing, raise on malformed.

    Missing registry files are the *expected* state on a fresh Claude
    Code install — we return ``None`` so the caller can distinguish
    "nothing registered yet" from "registry corrupted" (the latter
    propagates as :class:`json.JSONDecodeError`)."""
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def plugin_status() -> PluginStatus:
    """Return current install + registration state from Claude's registries.

    Purely read-only — safe to call any time. The function reads Claude
    Code's JSON registries directly because there is no ``claude plugin
    status`` subcommand; driving ``claude plugin list`` and scraping its
    output would be strictly worse (locale-dependent, unstable format).
    The registry files are Claude-owned, but reading them is idiomatic
    and done by several third-party plugin managers."""
    installed = _read_json_if_present(_installed_plugins_path())
    plugins = (installed or {}).get("plugins", {}) if isinstance(installed, dict) else {}
    key = f"{PLUGIN_NAME}@{MARKETPLACE_NAME}"
    entries = plugins.get(key, []) if isinstance(plugins, dict) else []
    entry = entries[0] if isinstance(entries, list) and entries else None

    markets = _read_json_if_present(_known_marketplaces_path()) or {}
    market_entry = markets.get(MARKETPLACE_NAME) if isinstance(markets, dict) else None

    return PluginStatus(
        plugin_installed=entry is not None,
        marketplace_registered=market_entry is not None,
        installed_scope=(entry or {}).get("scope"),
        installed_version=(entry or {}).get("version"),
        install_path=(entry or {}).get("installPath"),
        marketplace_path=(market_entry or {}).get("installLocation"),
    )


def _verify_plugin_installation(
    status: PluginStatus,
    repo_root: Path | None = None,
) -> PostInstallPluginVerification:
    """Verify a plugin's on-disk cache matches its registry entry.

    Runs three checks in :data:`PLUGIN_VERIFICATION_CHECK_ORDER`:

    1. **install_path**: :attr:`PluginStatus.install_path` is non-empty
       and resolves to an existing directory on disk. Catches the silent
       hazard where Claude Code's registry lists the plugin as installed
       but the expanded cache has been deleted or never materialized.
    2. **manifest**: that directory contains ``.claude-plugin/plugin.json``.
       An install whose cache exists but lacks the manifest is corrupt —
       Claude Code's own loader will fail when it tries to read the
       plugin, so surfacing it here lets the installer abort cleanly.
    3. **version**: the registry's ``installed_version`` matches the
       source ``plugin.json`` version at ``repo_root``. Detects the
       "install ran, then source was upgraded" state where the cache is
       stale relative to the repo.

    ``repo_root`` defaults to the detected plugin repo root; pass it
    explicitly in tests where :func:`get_plugin_repo_root` would resolve
    to the wrong checkout.
    """
    checks: list[str] = []
    findings: list[str] = []

    # Check 1: install_path exists as a directory
    checks.append(CHECK_PLUGIN_INSTALL_PATH)
    install_path_str = status.install_path
    install_path: Path | None = None
    if not install_path_str:
        findings.append(
            f"{CHECK_PLUGIN_INSTALL_PATH}: registry has no install_path "
            f"for {PLUGIN_NAME}@{MARKETPLACE_NAME}"
        )
    else:
        install_path = Path(install_path_str)
        if not install_path.is_dir():
            findings.append(
                f"{CHECK_PLUGIN_INSTALL_PATH}: install_path does not exist "
                f"or is not a directory: {install_path}"
            )

    # Check 2: manifest present in install_path
    checks.append(CHECK_PLUGIN_MANIFEST)
    manifest_path: Path | None = None
    if install_path is not None and install_path.is_dir():
        manifest_path = install_path / ".claude-plugin" / "plugin.json"
        if not manifest_path.is_file():
            findings.append(
                f"{CHECK_PLUGIN_MANIFEST}: missing .claude-plugin/plugin.json in {install_path}"
            )
            manifest_path = None
    # If install_path check already failed we don't re-report manifest —
    # the install_path finding is the root cause.

    # Check 3: installed version matches source
    checks.append(CHECK_PLUGIN_VERSION)
    source_root = repo_root if repo_root is not None else get_plugin_repo_root()
    source_manifest = get_plugin_manifest_path(source_root)
    try:
        source_data = json.loads(source_manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        findings.append(
            f"{CHECK_PLUGIN_VERSION}: could not read source manifest {source_manifest}: {exc}"
        )
        source_data = None

    if source_data is not None:
        source_version = source_data.get("version") if isinstance(source_data, dict) else None
        installed_version = status.installed_version
        if source_version is None:
            findings.append(f"{CHECK_PLUGIN_VERSION}: source manifest has no 'version' field")
        elif installed_version is None:
            findings.append(
                f"{CHECK_PLUGIN_VERSION}: registry has no installed_version "
                f"for {PLUGIN_NAME}@{MARKETPLACE_NAME}"
            )
        elif installed_version != source_version:
            findings.append(
                f"{CHECK_PLUGIN_VERSION}: installed={installed_version!r} "
                f"does not match source={source_version!r}"
            )

    return PostInstallPluginVerification(
        valid=not findings,
        checks=checks,
        findings=findings,
    )


# ---------------------------------------------------------------------------
# Subprocess runner
# ---------------------------------------------------------------------------


def _run_claude(
    args: list[str],
    *,
    claude_bin: str = DEFAULT_CLAUDE_BIN,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> CLIStep:
    """Invoke the Claude CLI and package the result as a :class:`CLIStep`.

    Uses an absolute path resolved via :func:`shutil.which` so that
    :class:`FileNotFoundError` (missing binary) surfaces as a clean
    Python exception the caller can translate into a user-facing
    message, rather than as a failed :class:`subprocess.run` call whose
    error message varies by platform."""
    resolved = _resolve_claude_bin(claude_bin)
    cmd = (resolved, *args)
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        # ``TimeoutExpired.stdout`` is typed ``bytes | None`` even with
        # ``text=True`` because the exception is defined independently of
        # the encoding mode. Decode defensively so CLIStep.stdout is
        # always a str — matches the success path's typing and avoids
        # forcing every consumer to handle both shapes.
        raw_stdout = exc.stdout
        if isinstance(raw_stdout, bytes):
            decoded = raw_stdout.decode("utf-8", errors="replace")
        else:
            decoded = raw_stdout or ""
        return CLIStep(
            name=" ".join(args[:2]) if len(args) >= 2 else " ".join(args),
            command=cmd,
            returncode=-1,
            stdout=decoded,
            stderr=f"timed out after {timeout}s: {exc}",
        )
    except OSError as exc:
        # Preserve the "every failure returns a CLIStep" contract when the
        # OS rejects the spawn itself (PermissionError on a non-executable
        # binary, BrokenPipeError, ENOMEM, etc.) — these are OSError
        # subclasses that ``subprocess.run`` raises before any child
        # process starts. Without this branch the exception propagates and
        # breaks every caller's assumption that _run_claude returns
        # structured output. Returncode -2 distinguishes spawn failures
        # from the timeout branch (-1) and from real CLI exit codes (>=0).
        return CLIStep(
            name=" ".join(args[:2]) if len(args) >= 2 else " ".join(args),
            command=cmd,
            returncode=-2,
            stdout="",
            stderr=f"subprocess spawn failed: {exc}",
        )
    return CLIStep(
        name=" ".join(args[:2]) if len(args) >= 2 else " ".join(args),
        command=cmd,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )


# ---------------------------------------------------------------------------
# Install / uninstall orchestration
# ---------------------------------------------------------------------------


def install_plugin(
    scope: InstallScope = "user",
    *,
    force: bool = False,
    claude_bin: str = DEFAULT_CLAUDE_BIN,
    repo_root: Path | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> PluginInstallResult:
    """Install the plugin at the given scope via the canonical Claude CLI.

    Workflow (each step produces an entry in ``result.steps``):

    1. **Validate** the plugin + marketplace manifests on disk (cheap,
       catches obvious mis-ships without spawning subprocesses).
    2. **Resolve** the ``claude`` binary so a missing CLI fails fast.
    3. **Register marketplace** (``claude plugin marketplace add <repo>``)
       — skipped when already registered unless ``force=True``.
    4. **Install plugin** (``claude plugin install <name>@<marketplace>
       --scope <scope>``) — skipped when already installed at the same
       scope unless ``force=True`` (in which case the plugin is
       uninstalled first, then reinstalled, to mimic
       ``claude plugin update`` semantics without depending on the
       update subcommand's still-stabilizing behavior). The force-
       uninstall step runs against ``status.installed_scope`` — the
       scope the plugin currently lives in — not the caller-requested
       ``scope``. This is load-bearing when the caller uses ``force=True``
       to *change* scope (e.g., project → user): uninstalling at the new
       scope would silently uninstall nothing and leave duplicate
       registry entries in both scopes.

    The function is idempotent: invoking it twice on a healthy install
    is a no-op that returns ``success=True`` with both "already
    present" flags set.

    Args:
        scope: Where to install — ``"user"`` (default, ``~/.claude``),
            ``"project"`` (current project's ``.claude/``), or
            ``"local"`` (the installing invocation's working dir).
        force: Re-register the marketplace and reinstall the plugin even
            when they appear to already exist. Use when you suspect
            registry drift or want to pin the install to a fresh cache.
        claude_bin: Override for the ``claude`` CLI path (tests, custom
            deployments).
        repo_root: Override for the plugin source root (tests). Defaults
            to :func:`get_plugin_repo_root`.
        timeout: Per-subprocess timeout in seconds.
    """
    if scope not in SUPPORTED_SCOPES:
        return PluginInstallResult(
            success=False,
            message=(f"Unsupported scope '{scope}'. Choose one of: {', '.join(SUPPORTED_SCOPES)}."),
        )

    root = repo_root or get_plugin_repo_root()

    # Step 0: validate manifests before touching any external state.
    validation_errors = validate_plugin_source(root)
    if validation_errors:
        return PluginInstallResult(
            success=False,
            message="Plugin source is not installable: " + "; ".join(validation_errors),
        )

    # Step 0b: ensure the CLI is even available.
    try:
        _resolve_claude_bin(claude_bin)
    except FileNotFoundError as exc:
        return PluginInstallResult(success=False, message=str(exc))

    steps: list[CLIStep] = []
    status = plugin_status()

    # Step 1: register the self-hosted marketplace if absent.
    if status.marketplace_registered and not force:
        steps.append(
            CLIStep(
                name="marketplace add",
                command=(claude_bin, "plugin", "marketplace", "add", str(root)),
                returncode=0,
                skipped=True,
                stdout=f"marketplace '{MARKETPLACE_NAME}' already registered at "
                f"{status.marketplace_path}",
            )
        )
        marketplace_already_present = True
    else:
        step = _run_claude(
            ["plugin", "marketplace", "add", str(root)],
            claude_bin=claude_bin,
            timeout=timeout,
        )
        step.name = "marketplace add"
        steps.append(step)
        marketplace_already_present = False
        if not step.passed:
            return PluginInstallResult(
                success=False,
                message=(
                    "Failed to register marketplace "
                    f"'{MARKETPLACE_NAME}' ({root}): "
                    f"{step.stderr.strip() or step.stdout.strip() or 'non-zero exit'}"
                ),
                steps=steps,
            )

    # Step 2: uninstall-first when forcing, so the new install lands fresh.
    #
    # Scope gotcha: the uninstall MUST run against the scope where the
    # plugin currently lives (``status.installed_scope``), NOT the scope
    # the caller requested for the reinstall. If the caller flips scope
    # with ``force=True`` (e.g., moving an install from ``project`` to
    # ``user``), passing the new scope to uninstall would silently uninstall
    # nothing from the old scope, then install into the new scope — leaving
    # duplicate registry entries in both scopes. We fall back to the caller-
    # requested scope only when the registry has no installed_scope (defensive
    # — ``status.plugin_installed`` is True here, so this branch is rare).
    if status.plugin_installed and force:
        uninstall_scope = status.installed_scope or scope
        uninstall_step = _run_claude(
            ["plugin", "uninstall", PLUGIN_NAME, "--scope", uninstall_scope],
            claude_bin=claude_bin,
            timeout=timeout,
        )
        uninstall_step.name = "plugin uninstall (force)"
        steps.append(uninstall_step)
        if not uninstall_step.passed:
            return PluginInstallResult(
                success=False,
                message=(
                    "Force uninstall failed before reinstall: "
                    f"{uninstall_step.stderr.strip() or uninstall_step.stdout.strip()}"
                ),
                steps=steps,
            )
        status = plugin_status()

    # Step 3: install (skipped when already present at same scope unless force).
    plugin_already_installed = status.plugin_installed and status.installed_scope == scope
    if plugin_already_installed and not force:
        steps.append(
            CLIStep(
                name="plugin install",
                command=(
                    claude_bin,
                    "plugin",
                    "install",
                    f"{PLUGIN_NAME}@{MARKETPLACE_NAME}",
                    "--scope",
                    scope,
                ),
                returncode=0,
                skipped=True,
                stdout=f"plugin '{PLUGIN_NAME}' already installed at "
                f"scope '{scope}' (version {status.installed_version})",
            )
        )
    else:
        step = _run_claude(
            [
                "plugin",
                "install",
                f"{PLUGIN_NAME}@{MARKETPLACE_NAME}",
                "--scope",
                scope,
            ],
            claude_bin=claude_bin,
            timeout=timeout,
        )
        step.name = "plugin install"
        steps.append(step)
        if not step.passed:
            return PluginInstallResult(
                success=False,
                message=(
                    f"Failed to install plugin '{PLUGIN_NAME}' at scope "
                    f"'{scope}': {step.stderr.strip() or step.stdout.strip() or 'non-zero exit'}"
                ),
                steps=steps,
                marketplace_added=not marketplace_already_present,
                marketplace_already_present=marketplace_already_present,
            )

    # Refresh state for the return value — we want the post-install
    # install path, not the pre-install snapshot.
    final_status = plugin_status()

    # Gate success on post-install verification. The CLI reporting exit
    # code 0 is necessary but not sufficient — the silent hazard we
    # guard against is a "succeeded" install whose on-disk cache is
    # missing, manifest-less, or version-mismatched against the source.
    # See ``_verify_plugin_installation`` for the three checks. Callers
    # must inspect ``result.verification.valid`` (not just
    # ``result.success``) when they need the specific failure reason.
    verification = _verify_plugin_installation(final_status, repo_root=root)
    installed = (
        f"Plugin '{PLUGIN_NAME}' installed at scope '{scope}' "
        f"(version {final_status.installed_version or 'unknown'})."
        if not plugin_already_installed or force
        else f"Plugin '{PLUGIN_NAME}' already installed at scope '{scope}'."
    )
    if verification.valid:
        message = installed
    else:
        message = (
            f"{installed} Post-install verification failed "
            f"(verification.valid={verification.valid}): " + "; ".join(verification.findings)
        )

    return PluginInstallResult(
        success=verification.valid,
        message=message,
        steps=steps,
        plugin_install_path=final_status.install_path,
        marketplace_added=not marketplace_already_present,
        marketplace_already_present=marketplace_already_present,
        plugin_already_installed=plugin_already_installed,
        verification=verification,
    )


def uninstall_plugin(
    scope: InstallScope = "user",
    *,
    remove_marketplace: bool = False,
    claude_bin: str = DEFAULT_CLAUDE_BIN,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> PluginInstallResult:
    """Uninstall the plugin (and optionally remove the marketplace).

    Removing the marketplace is opt-in because the marketplace entry in
    Claude Code's registry is cheap and harmless — leaving it in place
    means a subsequent :func:`install_plugin` skips the registration
    step entirely. Only pass ``remove_marketplace=True`` when the caller
    genuinely wants to erase all traces (e.g. uninstall scripts, CI
    cleanup)."""
    try:
        _resolve_claude_bin(claude_bin)
    except FileNotFoundError as exc:
        return PluginInstallResult(success=False, message=str(exc))

    steps: list[CLIStep] = []
    status = plugin_status()

    if not status.plugin_installed:
        steps.append(
            CLIStep(
                name="plugin uninstall",
                command=(
                    claude_bin,
                    "plugin",
                    "uninstall",
                    PLUGIN_NAME,
                    "--scope",
                    scope,
                ),
                returncode=0,
                skipped=True,
                stdout=f"plugin '{PLUGIN_NAME}' is not installed; nothing to do",
            )
        )
    else:
        step = _run_claude(
            ["plugin", "uninstall", PLUGIN_NAME, "--scope", scope],
            claude_bin=claude_bin,
            timeout=timeout,
        )
        step.name = "plugin uninstall"
        steps.append(step)
        if not step.passed:
            return PluginInstallResult(
                success=False,
                message=(
                    f"Failed to uninstall plugin '{PLUGIN_NAME}' at scope "
                    f"'{scope}': {step.stderr.strip() or step.stdout.strip()}"
                ),
                steps=steps,
            )

    if remove_marketplace:
        if not status.marketplace_registered:
            steps.append(
                CLIStep(
                    name="marketplace remove",
                    command=(
                        claude_bin,
                        "plugin",
                        "marketplace",
                        "remove",
                        MARKETPLACE_NAME,
                    ),
                    returncode=0,
                    skipped=True,
                    stdout=f"marketplace '{MARKETPLACE_NAME}' not registered; nothing to do",
                )
            )
        else:
            step = _run_claude(
                ["plugin", "marketplace", "remove", MARKETPLACE_NAME],
                claude_bin=claude_bin,
                timeout=timeout,
            )
            step.name = "marketplace remove"
            steps.append(step)
            if not step.passed:
                return PluginInstallResult(
                    success=False,
                    message=(
                        f"Plugin was uninstalled but marketplace removal failed: "
                        f"{step.stderr.strip() or step.stdout.strip()}"
                    ),
                    steps=steps,
                )

    return PluginInstallResult(
        success=True,
        message=(
            f"Plugin '{PLUGIN_NAME}' uninstalled from scope '{scope}'"
            + (
                f"; marketplace '{MARKETPLACE_NAME}' removed."
                if remove_marketplace
                else f"; marketplace '{MARKETPLACE_NAME}' retained."
            )
        ),
        steps=steps,
    )


__all__ = [
    "PLUGIN_NAME",
    "MARKETPLACE_NAME",
    "DEFAULT_CLAUDE_BIN",
    "DEFAULT_TIMEOUT_SECONDS",
    "SUPPORTED_SCOPES",
    "CLIStep",
    "PluginInstallResult",
    "PluginStatus",
    "get_plugin_repo_root",
    "get_marketplace_manifest_path",
    "get_plugin_manifest_path",
    "validate_plugin_source",
    "plugin_status",
    "install_plugin",
    "uninstall_plugin",
]
