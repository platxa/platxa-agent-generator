"""Per-area CLI subcommand modules.

Each module in this package owns one group of subcommands and exports:

- ``register_parser(subparsers)`` — wires this module's subparsers onto
  the top-level argparse parser. Called once per module from
  :func:`platxa_agent_generator.cli.CLI._create_parser`.
- ``COMMANDS`` — a ``dict[str, Callable[..., int]]`` mapping each
  subcommand name (matching ``args.command``) to its handler.

Handlers accept ``args: argparse.Namespace`` and return an integer
exit code. The two evolve-related types (``PromoterExecutor``,
``PromotionDispatchError``) live in :mod:`.evolve` and are re-exported
from :mod:`platxa_agent_generator.cli` so test imports keep working.

Module groupings follow the six conceptual areas documented in
``cli.py``'s module docstring; co-locating helpers (e.g.
``_plugin_result_to_dict``) with their handlers avoids module-level
helper sprawl.
"""

from __future__ import annotations
