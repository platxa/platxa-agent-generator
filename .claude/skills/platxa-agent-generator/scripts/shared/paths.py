"""Path constructors for the generator suite.

Provides ``get_project_agents_dir()`` (cwd-relative ``.claude/agents``),
``get_user_agents_dir()`` (``~/.claude/agents``), and the convenience
selector ``get_agents_dir(user=False)`` so the scripts that need the
directory do not each re-derive it from the ``DEFAULT_AGENTS_DIR``
literal.

The constant is re-exported from this module so callers can do a single
``from shared.paths import DEFAULT_AGENTS_DIR`` when they need the raw
string alongside a path call.
"""

from __future__ import annotations

from pathlib import Path

try:
    # Package-mode import (from ``scripts.shared.paths`` when scripts is a
    # package — e.g. pytest subprocess tests that do ``from scripts.X import Y``).
    from .constants import DEFAULT_AGENTS_DIR
except ImportError:  # pragma: no cover - exercised only in direct-script mode
    # Direct-script invocation: ``python scripts/foo.py`` adds scripts/ to
    # sys.path, so ``shared`` is discoverable as a top-level package.
    from shared.constants import DEFAULT_AGENTS_DIR  # type: ignore[no-redef]


__all__ = [
    "DEFAULT_AGENTS_DIR",
    "get_agents_dir",
    "get_project_agents_dir",
    "get_user_agents_dir",
]


def get_project_agents_dir() -> Path:
    """Return the project-scope agents directory (``.claude/agents``).

    The returned path is relative to the current working directory, matching
    the behavior of the pre-refactor literal ``Path(".claude/agents")``
    sites. Callers that want a project-root-walking variant (follow parent
    directories until a ``.claude/`` or ``.git/`` marker is found) should
    keep doing that themselves — the name of this helper deliberately
    promises only cwd-relative semantics.
    """
    return Path(DEFAULT_AGENTS_DIR)


def get_user_agents_dir() -> Path:
    """Return the user-scope agents directory (``~/.claude/agents``)."""
    return Path.home() / DEFAULT_AGENTS_DIR


def get_agents_dir(user: bool = False) -> Path:
    """Return the agents directory for the chosen scope.

    Args:
        user: ``True`` → user-scope (``~/.claude/agents``);
              ``False`` (default) → project-scope (``.claude/agents``).

    Returns:
        A :class:`pathlib.Path` for the requested scope.
    """
    return get_user_agents_dir() if user else get_project_agents_dir()
