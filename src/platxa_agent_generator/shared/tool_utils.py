"""Canonical ``tools`` string normalizer for the generator suite.

Before feature #27 the pattern
``[t.strip() for t in tools_str.split(",") if t.strip()]`` appeared in
over a dozen call sites (``agent_composer.py``, ``agent_generator.py``,
``syntax_validator.py``, ``quality_scorer.py``,
etc.) — each re-implementing the split/strip/drop-empty logic with
subtle variants. A few sites dropped the ``if t.strip()`` guard and so
produced lists containing empty strings whenever the raw value had a
trailing comma (``"Read, Write,"``) or a doubled comma (``"Read,, Write"``).

Consolidating here means a single reviewed implementation of:

- accepting ``None``, an empty string, or a list (already normalized) as
  input so callers do not need to special-case missing frontmatter keys
- splitting on ``,``, stripping whitespace, and dropping empty tokens
- preserving order (duplicates are NOT de-duplicated — that is a caller
  concern because some schemas treat duplicates as an authoring error)
"""

from __future__ import annotations

from typing import Iterable

__all__ = ["parse_tools_string"]


def parse_tools_string(raw: str | Iterable[str] | None) -> list[str]:
    """Normalize a ``tools`` frontmatter value into ``list[str]``.

    Contract (matches feature #27):

    - ``None`` or ``""`` → ``[]``
    - ``"Read"`` → ``["Read"]``
    - ``"Read, Write, Edit"`` → ``["Read", "Write", "Edit"]``
    - ``"  Read  ,  Write  "`` (pathological whitespace) → ``["Read", "Write"]``
    - ``"Read,, Write,"`` (empty segments from trailing/doubled commas)
      → ``["Read", "Write"]``
    - ``["Read", " Write "]`` (already a list) → ``["Read", "Write"]``
    - Non-string items in an iterable are coerced via ``str()`` so YAML
      lists that mix quoted/unquoted tokens still produce strings.

    The function never raises for ordinary input shapes; callers
    receive an empty list if the value is missing or whitespace-only.
    """
    if raw is None:
        return []

    if isinstance(raw, str):
        if not raw:
            return []
        return [token.strip() for token in raw.split(",") if token.strip()]

    # Iterable input (list, tuple, set, generator). Preserve iteration
    # order of the source — ``set`` callers accept non-deterministic
    # order by definition, so we do not impose sorting here.
    return [str(token).strip() for token in raw if str(token).strip()]
