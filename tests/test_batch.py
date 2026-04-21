#!/usr/bin/env python3
"""
test_batch — sharded from test_generator.py.

Shards: 2 TestXxx classes.
Run with: pytest tests/test_batch.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestBatchGeneration:
    """Tests for batch agent generation (feature #75).

    Covers:
    - BatchAgentDef / BatchSpec / BatchAgentResult / BatchResult dataclasses
    - load_batch_spec parses valid JSON, rejects missing fields and bad types
    - load_batch_spec raises FileNotFoundError / ValueError on errors
    - validate_batch_spec catches empty agents, duplicate names, broken
      ecosystem-local skill references
    - generate_batch short-circuits on validation errors (no files written)
    - generate_batch writes frontmatter files with merged shared_tools
    - generate_batch result reports success and output paths
    - DEFAULT_BATCH_OUTPUT_DIR / BATCH_AGENT_FILE_EXTENSION constants public
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_constants_exposed(self) -> None:
        """DEFAULT_BATCH_OUTPUT_DIR and BATCH_AGENT_FILE_EXTENSION are public."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import"
            " DEFAULT_BATCH_OUTPUT_DIR, BATCH_AGENT_FILE_EXTENSION\n"
            "print(DEFAULT_BATCH_OUTPUT_DIR, '|', BATCH_AGENT_FILE_EXTENSION)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude/agents | .md"

    def test_load_batch_spec_parses_valid(self) -> None:
        """load_batch_spec reads JSON and populates BatchSpec + BatchAgentDef."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'spec.json'\n"
            "    p.write_text(json.dumps({\n"
            "        'name': 'review-team',\n"
            "        'description': 'A review ecosystem',\n"
            "        'shared_tools': ['Read'],\n"
            "        'agents': [\n"
            "            {'name': 'reviewer', 'description': 'Reviews code',"
            " 'tools': ['Grep'], 'user_invocable': True},\n"
            "            {'name': 'scanner', 'description': 'Security scan',"
            " 'skills': ['security-checklist']},\n"
            "        ],\n"
            "    }))\n"
            "    spec = load_batch_spec(p)\n"
            "    print(spec.name, len(spec.agents),\n"
            "          spec.agents[0].name, spec.agents[0].user_invocable,\n"
            "          spec.agents[1].skills, spec.shared_tools)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == (
            "review-team 2 reviewer True ['security-checklist'] ['Read']"
        )

    def test_load_batch_spec_missing_file(self) -> None:
        """Missing file → FileNotFoundError."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import load_batch_spec\n"
            "try:\n"
            "    load_batch_spec('/tmp/__definitely_no_batch_spec__.json')\n"
            "    print('NO_RAISE')\n"
            "except FileNotFoundError as e:\n"
            "    print('RAISED', 'not found' in str(e).lower())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_load_batch_spec_invalid_json(self) -> None:
        """Malformed JSON → ValueError."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'bad.json'\n"
            "    p.write_text('not valid json {')\n"
            "    try:\n"
            "        load_batch_spec(p)\n"
            "        print('NO_RAISE')\n"
            "    except ValueError as e:\n"
            "        print('RAISED', 'not valid JSON' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_load_batch_spec_missing_fields(self) -> None:
        """Missing 'name' or 'description' → ValueError naming the field."""
        result = self._run_py(
            "import json, tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import load_batch_spec\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    p = Path(td) / 'incomplete.json'\n"
            "    p.write_text(json.dumps({'name': 'x'}))\n"
            "    try:\n"
            "        load_batch_spec(p)\n"
            "        print('NO_RAISE')\n"
            "    except ValueError as e:\n"
            "        print('RAISED', 'description' in str(e))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "RAISED True"

    def test_validate_rejects_empty_agents(self) -> None:
        """Empty agents list → validation error."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import BatchSpec, validate_batch_spec\n"
            "errors = validate_batch_spec(BatchSpec(name='eco', description='d'))\n"
            "print(len(errors), 'no agents' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_rejects_duplicate_names(self) -> None:
        """Duplicate agent names → validation error naming the duplicate."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, validate_batch_spec\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[\n"
            "        BatchAgentDef(name='dup', description='a'),\n"
            "        BatchAgentDef(name='dup', description='b'),\n"
            "    ],\n"
            ")\n"
            "errors = validate_batch_spec(spec)\n"
            "print(len(errors), 'dup' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_validate_ok_for_valid_spec(self) -> None:
        """Well-formed spec → no errors."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, validate_batch_spec\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "print(validate_batch_spec(spec))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "[]"

    def test_generate_batch_writes_files(self) -> None:
        """Valid spec → files written under output_dir with frontmatter."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d', shared_tools=['Read'],\n"
            "    agents=[\n"
            "        BatchAgentDef(name='a1', description='First',"
            " tools=['Grep']),\n"
            "        BatchAgentDef(name='a2', description='Second'),\n"
            "    ],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    a1 = (Path(td) / 'a1.md').read_text()\n"
            "    a2 = (Path(td) / 'a2.md').read_text()\n"
            "    print(result.success, len(result.agents),\n"
            "          'name: a1' in a1, 'tools: Grep, Read' in a1,\n"
            "          'name: a2' in a2, 'tools: Read' in a2)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 2 True True True True"

    def test_generate_batch_halts_on_validation(self) -> None:
        """Validation errors → no files written, success=False."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[\n"
            "        BatchAgentDef(name='dup', description='a'),\n"
            "        BatchAgentDef(name='dup', description='b'),\n"
            "    ],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    dup_written = (Path(td) / 'dup.md').exists()\n"
            "    print(result.success, len(result.agents),\n"
            "          len(result.cross_validation_errors), dup_written)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 0 1 False"

    def test_generate_batch_result_paths(self) -> None:
        """Each per-agent result includes the output_path."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='only', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)\n"
            "    r0 = result.agents[0]\n"
            "    print(r0.success, r0.name, r0.output_path.endswith('only.md'))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True only True"


class TestBatchPolicy:
    """Tests for BatchPolicy + enforce_batch_policy (feature #81).

    Covers the three verification criteria:
    - Batch mode respects --allowedTools flag (tools outside the allowlist
      trigger a policy violation with a helpful message).
    - WebSearch disabled in offline mode (scrubbed from every generated
      agent, per-agent warnings recorded, non-fatal).
    - Write restricted to .claude/ paths (output_dir outside the scope
      prefix blocks generation with cross_validation_errors populated).

    Also covers policy constants and backwards-compat (no policy = old
    behaviour).
    """

    def _run_py(self, code: str) -> "subprocess.CompletedProcess[str]":
        import subprocess

        scripts_dir = Path(__file__).parent.parent / "src" / "platxa_agent_generator"
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=str(scripts_dir),
            check=False,
        )
        return result

    def test_policy_constants_exposed(self) -> None:
        """DEFAULT_OUTPUT_SCOPE and OFFLINE_DISABLED_TOOLS are public."""
        result = self._run_py(
            "from platxa_agent_generator.batch_generator import DEFAULT_OUTPUT_SCOPE, OFFLINE_DISABLED_TOOLS\n"
            "print(DEFAULT_OUTPUT_SCOPE, '|',"
            " 'WebSearch' in OFFLINE_DISABLED_TOOLS,"
            " 'WebFetch' in OFFLINE_DISABLED_TOOLS)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == ".claude | True True"

    def test_allowed_tools_blocks_disallowed_agent(self) -> None:
        """Agent requesting tools outside allowlist → policy violation."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'Bash'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read', 'Grep'],\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success,\n"
            "          len(result.cross_validation_errors),\n"
            "          'Bash' in result.cross_validation_errors[0],\n"
            "          (Path(td) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True False"

    def test_allowed_tools_accepts_subset(self) -> None:
        """Agent within allowlist → succeeds, file written."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read', 'Grep'],\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success, (Path(td) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_offline_strips_websearch(self) -> None:
        """offline=True removes WebSearch/WebFetch from generated agents."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='net', description='x',\n"
            "        tools=['Read', 'WebSearch', 'WebFetch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(offline=True, output_scope=td)\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    body = (Path(td) / 'net.md').read_text()\n"
            "    warnings = result.agents[0].warnings\n"
            "    print(result.success,\n"
            "          'WebSearch' not in body,\n"
            "          'WebFetch' not in body,\n"
            "          'Read' in body,\n"
            "          any('WebSearch' in w for w in warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True True True"

    def test_offline_allowlist_passes_after_scrub(self) -> None:
        """Offline scrub runs BEFORE allowlist check — spec with WebSearch
        + allowlist not containing WebSearch still passes.
        """
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='n', description='x',\n"
            "        tools=['Read', 'WebSearch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    policy = BatchPolicy(\n"
            "        allowed_tools=['Read'],\n"
            "        offline=True,\n"
            "        output_scope=td,\n"
            "    )\n"
            "    result = generate_batch(spec, td, policy=policy)\n"
            "    print(result.success, len(result.cross_validation_errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_output_scope_blocks_outside_path(self) -> None:
        """Output dir outside scope → fatal policy violation, no files."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as outer:\n"
            "    with tempfile.TemporaryDirectory() as inner:\n"
            "        # scope = inner, but output_dir = outer — disjoint.\n"
            "        policy = BatchPolicy(output_scope=inner)\n"
            "        result = generate_batch(spec, outer, policy=policy)\n"
            "        print(result.success,\n"
            "              len(result.cross_validation_errors),\n"
            "              'outside' in result.cross_validation_errors[0],\n"
            "              (Path(outer) / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True False"

    def test_output_scope_allows_nested_path(self) -> None:
        """Output dir nested under scope → allowed."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x')],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    nested = Path(td) / 'sub' / 'agents'\n"
            "    policy = BatchPolicy(output_scope=td)\n"
            "    result = generate_batch(spec, nested, policy=policy)\n"
            "    print(result.success, (nested / 'a.md').exists())"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_enforce_policy_standalone(self) -> None:
        """enforce_batch_policy is a public helper with no side effects."""
        result = self._run_py(
            "import tempfile\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, BatchPolicy, enforce_batch_policy\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'Bash'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    errors = enforce_batch_policy(\n"
            "        spec,\n"
            "        BatchPolicy(allowed_tools=['Read'], output_scope=td),\n"
            "        td,\n"
            "    )\n"
            "    print(len(errors), 'Bash' in errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 True"

    def test_no_policy_preserves_old_behaviour(self) -> None:
        """Calling generate_batch without policy behaves identically to pre-#81."""
        result = self._run_py(
            "import tempfile\n"
            "from pathlib import Path\n"
            "from platxa_agent_generator.batch_generator import (\n"
            "    BatchSpec, BatchAgentDef, generate_batch\n"
            ")\n"
            "spec = BatchSpec(\n"
            "    name='eco', description='d',\n"
            "    agents=[BatchAgentDef(name='a', description='x',\n"
            "        tools=['Read', 'WebSearch'])],\n"
            ")\n"
            "with tempfile.TemporaryDirectory() as td:\n"
            "    result = generate_batch(spec, td)  # no policy arg\n"
            "    body = (Path(td) / 'a.md').read_text()\n"
            "    print(result.success,\n"
            "          'WebSearch' in body,\n"
            "          result.agents[0].warnings)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True []"
