#!/usr/bin/env python3
"""
test_composition — sharded from test_generator.py.

Shards: 3 TestXxx classes.
Run with: pytest tests/test_composition.py -v
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


class TestCompositionValidation:
    """Tests for Feature #66: Pipeline I/O composition validation."""

    def _run_composer(self, code: str) -> str:
        """Run Python code that imports from agent_composer and prints result."""
        full_code = f"from platxa_agent_generator.agent_composer import *; {code}"
        result = subprocess.run(
            [sys.executable, "-c", full_code],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, f"Composer code failed: {result.stderr}"
        return result.stdout.strip()

    def test_sequential_compatible_schemas_pass(self):
        """Sequential pipeline with compatible I/O schemas passes validation."""
        out = self._run_composer(
            "a = AgentSpec(name='analyzer', description='Analyze', "
            "output_schema={'properties': {'findings': {'type': 'array'}}}); "
            "b = AgentSpec(name='reporter', description='Report', "
            "input_schema={'properties': {'findings': {'type': 'array'}}}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues))"
        )
        assert out == "0", f"Expected 0 issues, got: {out}"

    def test_sequential_incompatible_schemas_flagged(self):
        """Sequential pipeline flags missing required fields between stages."""
        out = self._run_composer(
            "a = AgentSpec(name='analyzer', description='Analyze', "
            "output_schema={'properties': {'score': {'type': 'number'}}}); "
            "b = AgentSpec(name='reporter', description='Report', "
            "input_schema={'properties': {'findings': {'type': 'array'}}, "
            "'required': ['findings']}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "findings" in lines[1]
        assert "analyzer" in lines[1] and "reporter" in lines[1]

    def test_sequential_empty_schemas_compatible(self):
        """Empty schemas (untyped) are always compatible."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', output_schema={}); "
            "b = AgentSpec(name='b', description='B', input_schema={}); "
            "issues = validate_sequential_io([a, b]); "
            "print(len(issues))"
        )
        assert out == "0"

    def test_sequential_three_stage_middle_incompatible(self):
        """Three-stage pipeline flags the specific incompatible pair."""
        out = self._run_composer(
            "a = AgentSpec(name='fetch', description='Fetch', "
            "output_schema={'properties': {'data': {'type': 'object'}}}); "
            "b = AgentSpec(name='transform', description='Transform', "
            "input_schema={'properties': {'data': {'type': 'object'}}}, "
            "output_schema={'properties': {'result': {'type': 'string'}}}); "
            "c = AgentSpec(name='load', description='Load', "
            "input_schema={'properties': {'records': {'type': 'array'}}, "
            "'required': ['records']}); "
            "issues = validate_sequential_io([a, b, c]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "transform" in lines[1] and "load" in lines[1]
        assert "records" in lines[1]

    def test_parallel_compatible_merge(self):
        """Parallel agents with compatible output types pass merge validation."""
        out = self._run_composer(
            "a = AgentSpec(name='lint', description='Lint', "
            "output_schema={'properties': {'issues': {'type': 'array'}}}); "
            "b = AgentSpec(name='test', description='Test', "
            "output_schema={'properties': {'results': {'type': 'array'}}}); "
            "issues = validate_parallel_outputs([a, b]); "
            "print(len(issues))"
        )
        assert out == "0"

    def test_parallel_conflicting_types_flagged(self):
        """Parallel agents with conflicting field types are flagged."""
        out = self._run_composer(
            "a = AgentSpec(name='agent-a', description='A', "
            "output_schema={'properties': {'score': {'type': 'number'}}}); "
            "b = AgentSpec(name='agent-b', description='B', "
            "output_schema={'properties': {'score': {'type': 'string'}}}); "
            "issues = validate_parallel_outputs([a, b]); "
            "print(len(issues)); print(issues[0])"
        )
        lines = out.split("\n")
        assert lines[0] == "1"
        assert "score" in lines[1]
        assert "conflicting types" in lines[1]

    def test_compose_sequential_rejects_incompatible(self):
        """compose_sequential() returns success=False for incompatible I/O."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'x': {'type': 'string'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "input_schema={'properties': {'y': {'type': 'string'}}, "
            "'required': ['y']}); "
            "r = compose_sequential([a, b]); "
            "print(r.success); print(len(r.errors))"
        )
        lines = out.split("\n")
        assert lines[0] == "False"
        assert int(lines[1]) >= 1

    def test_compose_parallel_merge_rejects_conflicting(self):
        """compose_parallel(strategy='merge') rejects conflicting output types."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'integer'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'array'}}}); "
            "r = compose_parallel([a, b], aggregation_strategy='merge'); "
            "print(r.success)"
        )
        assert out == "False"

    def test_compose_parallel_vote_skips_merge_validation(self):
        """compose_parallel(strategy='vote') skips merge-type validation."""
        out = self._run_composer(
            "a = AgentSpec(name='a', description='A', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'integer'}}}); "
            "b = AgentSpec(name='b', description='B', tools=['Read'], "
            "output_schema={'properties': {'v': {'type': 'array'}}}); "
            "r = compose_parallel([a, b], aggregation_strategy='vote'); "
            "print(r.success)"
        )
        assert out == "True"

    def test_schemas_compatible_extra_output_fields_ok(self):
        """Output having extra fields beyond what input requires is fine."""
        out = self._run_composer(
            "from platxa_agent_generator.agent_composer import _schemas_compatible; "
            "ok, issues = _schemas_compatible("
            "{'properties': {'a': {'type': 'string'}, 'b': {'type': 'number'}}}, "
            "{'properties': {'a': {'type': 'string'}}, 'required': ['a']}); "
            "print(ok); print(len(issues))"
        )
        lines = out.split("\n")
        assert lines[0] == "True"
        assert lines[1] == "0"


class TestComposeRouter:
    """Tests for compose_router and RoutingRule in agent_composer.py (feature #67).

    Covers:
    - Generated router includes all categories in the routing table
    - Each handler is referenced in the Handlers section
    - Fallback section references fallback_handler.name when provided
    - Fallback section describes ask-for-clarification when fallback is omitted
    - Classification Hints emitted only when at least one rule has keywords
    - Validation: empty handlers, empty rules, rule → unknown handler,
      fallback_handler not in handlers list
    - Pattern is CompositionPattern.CONDITIONAL on success
    - Tools are merged from every handler
    - Module-level header constants ROUTER_TABLE_HEADER and
      ROUTER_FALLBACK_HEADER surface in the generated content
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

    _BUILD_HANDLERS = (
        "from platxa_agent_generator.agent_composer import AgentSpec, RoutingRule, compose_router\n"
        "refactor = AgentSpec(name='refactor-agent',"
        " description='Refactors code',"
        " tools=['Read', 'Edit'])\n"
        "bugfix = AgentSpec(name='bugfix-agent',"
        " description='Fixes bugs',"
        " tools=['Read', 'Bash'])\n"
        "docs = AgentSpec(name='docs-agent',"
        " description='Writes docs',"
        " tools=['Read', 'Write'])\n"
        "rules = [\n"
        "    RoutingRule(category='refactor',"
        " description='Improve structure',"
        " handler_name='refactor-agent',"
        " keywords=['refactor', 'rename']),\n"
        "    RoutingRule(category='bug-fix',"
        " description='Investigate and fix defects',"
        " handler_name='bugfix-agent'),\n"
        "]\n"
    )

    def test_router_includes_all_categories_in_table(self) -> None:
        """Every rule's category and handler appear in the routing table."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "print(r.success)\n"
            "print('refactor' in r.agent_content, 'bug-fix' in r.agent_content)\n"
            "print('refactor-agent' in r.agent_content, 'bugfix-agent' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        lines = result.stdout.strip().splitlines()
        assert lines == ["True", "True True", "True True"]

    def test_router_emits_section_headers(self) -> None:
        """ROUTER_TABLE_HEADER and ROUTER_FALLBACK_HEADER appear in content."""
        result = self._run_py(
            self._BUILD_HANDLERS
            + "from platxa_agent_generator.agent_composer import ROUTER_TABLE_HEADER, ROUTER_FALLBACK_HEADER\n"
            "r = compose_router([refactor, bugfix], rules)\n"
            "print(ROUTER_TABLE_HEADER in r.agent_content,"
            " ROUTER_FALLBACK_HEADER in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_fallback_with_handler_references_fallback_name(self) -> None:
        """fallback_handler present → its name is mentioned in fallback section."""
        result = self._run_py(
            self._BUILD_HANDLERS
            + "r = compose_router([refactor, bugfix, docs], rules, fallback_handler=docs)\n"
            "print(r.success, 'docs-agent' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_fallback_without_handler_describes_ask_protocol(self) -> None:
        """Without fallback_handler, agent instructed to ask for clarification."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "content = r.agent_content.lower()\n"
            "print(r.success, 'clarif' in content, 'unrouted' in content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True True"

    def test_classification_hints_emitted_when_keywords_present(self) -> None:
        """Hints section emitted because at least one rule has keywords."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "print('Classification Hints' in r.agent_content,"
            " '`refactor`' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_classification_hints_suppressed_without_keywords(self) -> None:
        """No keywords on any rule → no Classification Hints section."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "rules = [\n"
            "    RoutingRule(category='c1', description='desc', handler_name='a'),\n"
            "    RoutingRule(category='c2', description='desc', handler_name='b'),\n"
            "]\n"
            "r = compose_router([a, b], rules)\n"
            "print(r.success, 'Classification Hints' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True False"

    def test_pattern_is_conditional_on_success(self) -> None:
        """Successful compose_router produces pattern == CONDITIONAL."""
        result = self._run_py(
            self._BUILD_HANDLERS
            + "from platxa_agent_generator.agent_composer import CompositionPattern\n"
            "r = compose_router([refactor, bugfix], rules)\n"
            "print(r.success, r.pattern is CompositionPattern.CONDITIONAL)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_tools_merged_from_all_handlers(self) -> None:
        """tools_merged contains the union of every handler's tools."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "merged = set(r.tools_merged)\n"
            "print(r.success, {'Read', 'Edit', 'Bash'}.issubset(merged))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_empty_handlers_fails(self) -> None:
        """No handlers → success=False with explicit error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import RoutingRule, compose_router\n"
            "rules = [RoutingRule(category='c', description='d', handler_name='x')]\n"
            "r = compose_router([], rules)\n"
            "print(r.success, any('at least one handler' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_empty_rules_fails(self) -> None:
        """No routing rules → success=False with explicit error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "r = compose_router([a], [])\n"
            "print(r.success, any('routing rule' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_rule_references_unknown_handler_fails(self) -> None:
        """Rule.handler_name not in handlers → success=False with named error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "rules = [\n"
            "    RoutingRule(category='c1', description='d', handler_name='a'),\n"
            "    RoutingRule(category='c2', description='d', handler_name='ghost'),\n"
            "]\n"
            "r = compose_router([a, b], rules)\n"
            "print(r.success, any(\"'ghost'\" in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_fallback_not_in_handlers_fails(self) -> None:
        """fallback_handler must be in the handlers list."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, RoutingRule, compose_router\n"
            "a = AgentSpec(name='a', description='A', tools=['Read'])\n"
            "b = AgentSpec(name='b', description='B', tools=['Read'])\n"
            "external = AgentSpec(name='outside', description='X', tools=['Read'])\n"
            "rules = [RoutingRule(category='c', description='d', handler_name='a')]\n"
            "r = compose_router([a, b], rules, fallback_handler=external)\n"
            "print(r.success, any('outside' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_rule_order_preserved_in_table(self) -> None:
        """Rule order is preserved (first-match-wins priority)."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules)\n"
            "idx_refactor = r.agent_content.find('`refactor`')\n"
            "idx_bugfix = r.agent_content.find('`bug-fix`')\n"
            "print(r.success, idx_refactor < idx_bugfix)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_custom_name_and_description_applied(self) -> None:
        """Explicit name= and description= override defaults in frontmatter."""
        result = self._run_py(
            self._BUILD_HANDLERS + "r = compose_router([refactor, bugfix], rules,"
            " name='my-router', description='Custom desc')\n"
            "print(r.composite_name, 'name: my-router' in r.agent_content,"
            " 'Custom desc' in r.agent_content)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "my-router True True"


class TestCompositionDepthLimit:
    """Tests for hierarchical composition depth limit (feature #68).

    Verifies that agent_composer.py:
    - Exposes MAX_COMPOSITION_DEPTH=3 and WARN_COMPOSITION_DEPTH=2 constants
    - validate_composition_depth() returns (errors, warnings) tuples
    - create_orchestrator(depth=...) fails when depth > MAX
    - create_orchestrator(depth=2 or 3) emits a non-blocking warning
    - create_orchestrator(depth=1) is silent (no warnings)
    - depth < 1 fails loud
    - default depth (no kwarg) is treated as top-level (no warning)
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
        """MAX_COMPOSITION_DEPTH=3 and WARN_COMPOSITION_DEPTH=2 are public."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import MAX_COMPOSITION_DEPTH, WARN_COMPOSITION_DEPTH\n"
            "print(MAX_COMPOSITION_DEPTH, WARN_COMPOSITION_DEPTH)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "3 2"

    def test_validate_depth_valid_top_level(self) -> None:
        """depth=1 → no errors, no warnings."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(1)\n"
            "print(len(errs), len(warns))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 0"

    def test_validate_depth_warns_at_threshold(self) -> None:
        """depth=2 → no errors, one warning (at WARN_COMPOSITION_DEPTH)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(2)\n"
            "print(len(errs), len(warns), 'WARN_COMPOSITION_DEPTH' in warns[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1 True"

    def test_validate_depth_warns_at_max(self) -> None:
        """depth=3 (MAX) → no errors, one warning (still allowed)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(3)\n"
            "print(len(errs), len(warns))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "0 1"

    def test_validate_depth_errors_above_max(self) -> None:
        """depth=4 → one error (exceeds MAX_COMPOSITION_DEPTH), no warnings."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(4)\n"
            "print(len(errs), len(warns), 'exceeds' in errs[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 0 True"

    def test_validate_depth_errors_below_one(self) -> None:
        """depth=0 → one error (depth must be >= 1)."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import validate_composition_depth\n"
            "errs, warns = validate_composition_depth(0)\n"
            "print(len(errs), len(warns), '>= 1' in errs[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "1 0 True"

    def test_orchestrator_default_depth_is_top_level(self) -> None:
        """Calling create_orchestrator with no depth kwarg → success, no warning."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w])\n"
            "print(r.success, len(r.warnings))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True 0"

    def test_orchestrator_warning_at_depth_2(self) -> None:
        """create_orchestrator(depth=2) succeeds with a warning attached."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=2)\n"
            "print(r.success, len(r.warnings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_orchestrator_warning_at_depth_3_max(self) -> None:
        """create_orchestrator(depth=3) succeeds (at MAX) with warning."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=3)\n"
            "print(r.success, len(r.warnings) >= 1)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True True"

    def test_orchestrator_fails_above_max(self) -> None:
        """create_orchestrator(depth=4) fails with explicit error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=4)\n"
            "print(r.success, any('exceeds' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_orchestrator_fails_below_one(self) -> None:
        """create_orchestrator(depth=0) fails with depth-must-be-positive error."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import AgentSpec, create_orchestrator\n"
            "w = AgentSpec(name='w', description='Worker', tools=['Read'])\n"
            "r = create_orchestrator('orch', [w], depth=0)\n"
            "print(r.success, any('>= 1' in e for e in r.errors))"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False True"

    def test_orchestrator_depth_error_skips_worker_check(self) -> None:
        """Depth error short-circuits before the worker-count validation."""
        result = self._run_py(
            "from platxa_agent_generator.agent_composer import create_orchestrator\n"
            "r = create_orchestrator('orch', [], depth=4)\n"
            "print(r.success, len(r.errors), 'exceeds' in r.errors[0])"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "False 1 True"
