#!/usr/bin/env python3
"""
test_composer — sharded from test_generator.py.

Shards: 1 TestXxx classes.
Run with: pytest tests/test_composer.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestAgentComposerScan:
    """Tests for agent_composer.load_agent_spec frontmatter narrowing (Feature #15).

    ``load_agent_spec`` previously caught every exception from
    ``yaml.safe_load`` with ``except Exception: return None``. When a
    directory of agents was scanned, a single malformed agent file
    would silently disappear from the result — no log line, no warning
    — making it indistinguishable from "file never existed". Operators
    adding a new agent and mistyping its YAML had no signal that the
    frontmatter was broken; the agent simply didn't appear.

    The fix narrows the catch to the three expected failure modes:

    - ``ImportError`` — PyYAML missing at runtime. Warrants its own
      except clause because Python evaluates the except-tuple classes
      eagerly; ``yaml.YAMLError`` in the same tuple would raise
      NameError when ``yaml`` isn't bound.
    - ``yaml.YAMLError`` — malformed YAML syntax in the frontmatter.
    - ``AttributeError`` — defensive catch for edge cases where the
      loader returns a non-dict that would crash the downstream
      ``frontmatter.get(...)`` calls.

    Both paths emit a stderr warning naming the offending agent file
    and the error class so operators can see which file is broken and
    why. Scanning still returns None for the bad file (callers are
    expected to filter None out of their list comprehensions), so
    valid agents around a broken one are preserved.
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        return subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )

    def test_malformed_agent_logged(self) -> None:
        """Scanning a directory with one malformed YAML agent and two
        valid ones must: (a) emit a stderr warning naming the broken
        file's path, (b) exclude the broken file from the result list
        (load_agent_spec returns None for it), and (c) preserve the
        valid agents in the result.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.agent_composer import load_agent_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    root = Path(td)\n"
            "    good_a = root / 'good_a.md'\n"
            "    bad = root / 'broken.md'\n"
            "    good_b = root / 'good_b.md'\n"
            # Valid frontmatter for both good agents.
            "    good_a.write_text('---\\nname: alpha\\n"
            "description: first good agent\\ntools: Read\\n---\\n"
            "# Alpha\\n', encoding='utf-8')\n"
            "    good_b.write_text('---\\nname: beta\\n"
            "description: second good agent\\ntools: Write\\n---\\n"
            "# Beta\\n', encoding='utf-8')\n"
            # Malformed YAML — unclosed quote triggers yaml.YAMLError.
            "    bad.write_text('---\\nname: \"unterminated\\n"
            "description: broken\\n---\\n# Broken\\n', "
            "encoding='utf-8')\n"
            "    results = [\n"
            "        load_agent_spec(good_a),\n"
            "        load_agent_spec(bad),\n"
            "        load_agent_spec(good_b),\n"
            "    ]\n"
            "    print('names:', '|'.join(\n"
            "        r.name if r is not None else 'NONE' for r in results\n"
            "    ))\n"
        )
        assert result.returncode == 0, result.stderr
        # Valid agents preserved, broken one became None.
        assert "names: alpha|NONE|beta" in result.stdout
        # Warning must name the broken file's path and the canonical
        # error code. Feature #26 replaced the pre-existing
        # ``type(e).__name__: e`` surface with the canonical
        # ``E001|E002|E003: <message>`` shape produced by
        # ``parse_frontmatter_safe`` — a malformed YAML body surfaces
        # as E003 regardless of which PyYAML subclass raised. Asserting
        # on ``E003`` (rather than the legacy ``Error`` substring) pins
        # the new canonical contract so a future refactor that reverts
        # to raw PyYAML class names breaks this test.
        assert "broken.md" in result.stderr
        assert "E003" in result.stderr
        # And must NOT name the valid files.
        assert "good_a.md" not in result.stderr
        assert "good_b.md" not in result.stderr

    def test_packaging_import_failure_propagates(self) -> None:
        """A packaging-level ImportError (e.g. PyYAML missing because the
        install is corrupt) must propagate as ImportError rather than be
        swallowed into a per-file "parse failure" warning.

        Rationale: silently treating a missing parser as "every agent
        file is unparseable" caused the composer CLI to produce empty
        composite agents marked as success — the install is broken but
        the operator sees no error. The fix moves the
        ``shared.frontmatter`` import to module scope so the
        ImportError surfaces at import time of agent_composer itself
        and the subprocess exits non-zero.
        """
        result = self._run_py(
            "import sys\n"
            # Pre-poison sys.modules so the module-level ``import yaml``
            # inside shared.frontmatter raises ImportError when
            # agent_composer is imported.
            "sys.modules.pop('yaml', None)\n"
            "sys.modules.pop('platxa_agent_generator.shared.frontmatter', None)\n"
            "sys.modules.pop('platxa_agent_generator.agent_composer', None)\n"
            "import builtins\n"
            "_real_import = builtins.__import__\n"
            "def _fake_import(name, *a, **k):\n"
            "    if name == 'yaml':\n"
            "        raise ImportError('No module named yaml')\n"
            "    return _real_import(name, *a, **k)\n"
            "builtins.__import__ = _fake_import\n"
            "try:\n"
            "    from platxa_agent_generator.agent_composer import load_agent_spec\n"
            "    print('UNEXPECTED: import succeeded')\n"
            "except ImportError as exc:\n"
            "    print(f'propagated: {exc}')\n"
        )
        assert result.returncode == 0, result.stderr
        # ImportError must propagate, naming yaml in the message.
        assert "propagated:" in result.stdout
        assert "yaml" in result.stdout
        assert "UNEXPECTED" not in result.stdout
