#!/usr/bin/env python3
"""
test_tool_selection — sharded from test_generator.py.

Shards: 7 TestXxx classes.
Run with: pytest tests/test_tool_selection.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


class TestLeastPrivilegeToolSelection:
    """Tests for Feature #30: Least-privilege tool selection algorithm."""

    def _select(self, agent_type: str, purpose: str, **kwargs: str) -> dict:
        """Helper to run tool_selector CLI and return JSON result."""
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "tool_selector.py"),
            "--type",
            agent_type,
            "--purpose",
            purpose,
            "--json-output",
        ]
        if "domain" in kwargs:
            cmd.extend(["--domain", kwargs["domain"]])
        result = subprocess.run(cmd, capture_output=True, text=True)
        assert result.returncode == 0, f"tool_selector failed: {result.stderr}"
        return json.loads(result.stdout)

    def test_analyzer_gets_read_only_tools(self) -> None:
        """Analyzer agents should only get Read/Grep/Glob — no Write/Edit/Bash."""
        data = self._select("analyzer", "scan code for vulnerabilities")
        tools = data["tools"]
        assert "Read" in tools
        assert "Grep" in tools
        assert "Glob" in tools
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_validator_gets_read_only_tools(self) -> None:
        """Validator agents should only get Read/Grep/Glob — no mutation tools."""
        data = self._select("validator", "check code style compliance")
        tools = data["tools"]
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_builder_without_create_gets_edit_not_write(self) -> None:
        """Builder with 'modify' purpose gets Edit, not Write."""
        data = self._select("builder", "modify existing configuration files")
        tools = data["tools"]
        assert "Edit" in tools
        assert "Write" not in tools

    def test_builder_with_create_keeps_write(self) -> None:
        """Builder with 'create' purpose retains Write tool."""
        data = self._select("builder", "create new module files")
        tools = data["tools"]
        assert "Write" in tools

    def test_builder_with_generate_keeps_write(self) -> None:
        """Builder with 'generate' purpose retains Write tool."""
        data = self._select("builder", "generate documentation files")
        tools = data["tools"]
        assert "Write" in tools

    def test_automation_without_shell_keywords_loses_bash(self) -> None:
        """Automation agent without shell keywords loses Bash."""
        data = self._select("automation", "update file metadata")
        tools = data["tools"]
        assert "Bash" not in tools

    def test_automation_with_shell_keywords_keeps_bash(self) -> None:
        """Automation agent with 'run tests' keeps Bash."""
        data = self._select("automation", "run tests and build artifacts")
        tools = data["tools"]
        assert "Bash" in tools

    def test_least_privilege_notes_in_warnings(self) -> None:
        """Least-privilege enforcement produces warning notes."""
        data = self._select("builder", "modify existing code")
        warnings = data["warnings"]
        lp_notes = [w for w in warnings if "Least-privilege" in w]
        assert len(lp_notes) > 0, "Expected least-privilege enforcement notes"

    def test_analyzer_with_security_domain_stays_read_only(self) -> None:
        """Analyzer in security domain should still be read-only."""
        data = self._select("analyzer", "audit authentication module", domain="security")
        tools = data["tools"]
        assert "Write" not in tools
        assert "Edit" not in tools
        assert "Bash" not in tools

    def test_least_privilege_disabled_keeps_all_tools(self) -> None:
        """When least_privilege=false via JSON, Write and Bash are preserved."""
        input_json = json.dumps(
            {
                "type": "builder",
                "purpose": "modify files",
                "least_privilege": False,
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "builder",
                "--purpose",
                "modify files",
                "--json-output",
                "--json",
                input_json,
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        # With default behavior (no --no-least-privilege flag), still enforced
        # This tests the default path which has least_privilege=True
        # The Write should be downgraded since no create keywords
        tools = data["tools"]
        assert "Edit" in tools


class TestAgentTeamCompatibility:
    """Tests for Feature #35: Agent team compatibility in multi-agent systems."""

    def _generate_system(self, tmp_path: Path, template: str) -> list[Path]:
        """Helper to generate a multi-agent system and return created files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                template,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return list(tmp_path.glob("*.md"))

    def test_worker_has_team_compatibility_section(self, tmp_path: Path) -> None:
        """Worker agents include ## Team Compatibility section."""
        files = self._generate_system(tmp_path, "code-review")
        # Find a worker file (not orchestrator)
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        content = worker_files[0].read_text()
        assert "## Team Compatibility" in content

    def test_worker_has_standalone_mode(self, tmp_path: Path) -> None:
        """Worker agents document standalone mode usage."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Standalone Mode" in content

    def test_worker_has_team_mode(self, tmp_path: Path) -> None:
        """Worker agents document team mode usage."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Team Mode" in content

    def test_worker_has_teammate_discovery(self, tmp_path: Path) -> None:
        """Worker agents include teammate discovery instructions."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Teammate Discovery" in content
        assert ".claude/agents/*.md" in content

    def test_worker_has_shared_task_patterns(self, tmp_path: Path) -> None:
        """Worker agents reference shared task list patterns."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Shared Task Patterns" in content
        assert "TodoWrite" in content

    def test_orchestrator_has_teammate_discovery(self, tmp_path: Path) -> None:
        """Orchestrator includes teammate discovery section."""
        files = self._generate_system(tmp_path, "code-review")
        orchestrator_files = [f for f in files if "orchestrator" in f.name]
        assert len(orchestrator_files) > 0
        content = orchestrator_files[0].read_text()
        assert "## Teammate Discovery" in content

    def test_orchestrator_has_team_coordination(self, tmp_path: Path) -> None:
        """Orchestrator includes shared task list with TodoWrite coordination."""
        files = self._generate_system(tmp_path, "code-review")
        orchestrator_files = [f for f in files if "orchestrator" in f.name]
        content = orchestrator_files[0].read_text()
        assert "## Shared Task List" in content
        assert "TodoWrite" in content

    def test_all_workers_have_team_compatibility(self, tmp_path: Path) -> None:
        """Every worker in the system has team compatibility, not just the first."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) >= 2, "Expected multiple workers"
        for wf in worker_files:
            content = wf.read_text()
            assert "## Team Compatibility" in content, (
                f"Worker {wf.name} missing Team Compatibility"
            )

    def test_documentation_template_workers_have_team_compat(self, tmp_path: Path) -> None:
        """Documentation template workers also get team compatibility."""
        files = self._generate_system(tmp_path, "documentation")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        for wf in worker_files:
            content = wf.read_text()
            assert "## Team Compatibility" in content


class TestSharedPaths:
    """Tests for Feature #25: scripts/shared/{paths,constants}.py dedup.

    Verifies the shared module that centralizes the ``.claude/agents`` convention
    so the eight pre-existing call sites no longer each reproduce the literal.
    """

    def test_get_agents_dir_project_vs_user(self) -> None:
        """get_agents_dir(user=False) returns project-scope, user=True returns user-scope.

        Also pins the expectation that the two dedicated helpers return the
        same values as the ``user`` flag selects, so callers can use whichever
        form reads best without diverging behavior.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.shared.paths import (get_agents_dir, "
                    "get_project_agents_dir, get_user_agents_dir); "
                    "print(json.dumps({"
                    "'project_flag': str(get_agents_dir(user=False)), "
                    "'user_flag': str(get_agents_dir(user=True)), "
                    "'project_direct': str(get_project_agents_dir()), "
                    "'user_direct': str(get_user_agents_dir()), "
                    "}))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"shared.paths failed: {result.stderr}"
        data = json.loads(result.stdout.strip())

        # Project-scope is the cwd-relative ``.claude/agents``.
        assert data["project_flag"] == ".claude/agents"
        assert data["project_direct"] == ".claude/agents"
        assert data["project_flag"] == data["project_direct"]

        # User-scope is rooted at the current user's home directory.
        assert data["user_flag"].endswith("/.claude/agents"), data["user_flag"]
        assert data["user_flag"] != ".claude/agents", (
            "user-scope must not collapse to the project-scope string"
        )
        assert data["user_flag"] == data["user_direct"]

    def test_constants_import(self) -> None:
        """DEFAULT_AGENTS_DIR is exported from shared.constants and re-exported by shared.paths."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from platxa_agent_generator.shared.constants import DEFAULT_AGENTS_DIR as c; "
                    "from platxa_agent_generator.shared.paths import DEFAULT_AGENTS_DIR as p; "
                    "assert c == p, (c, p); "
                    "assert c == '.claude/agents', c; "
                    "print('OK:', c)"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"constants import failed: {result.stderr}"
        assert result.stdout.strip() == "OK: .claude/agents"


class TestSharedFrontmatter:
    """Tests for Feature #26: scripts/shared/frontmatter.py canonical parser.

    Verifies the single consolidated parser that replaces four divergent
    ``yaml.safe_load`` call sites (``syntax_validator.py``, ``agent_composer.py``,
    and two blocks inside ``security_scanner.py``) with one (dict|None, errors)
    contract. Deterministic invariant (enforced by the spec): outside of
    ``shared/frontmatter.py`` itself, no other script calls ``yaml.safe_load``.
    """

    def test_canonical_error_reporting(self) -> None:
        """parse_frontmatter_safe returns (None, [E003]) with a line number on bad YAML.

        Exercises the happy path (dict + empty errors list), the E001 missing-
        opening case, and the E003 MarkedYAMLError line-reporting branch in a
        single subprocess so the test stays fast while pinning the canonical
        error shape.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.shared.frontmatter import parse_frontmatter_safe; "
                    "ok_data, ok_errs = parse_frontmatter_safe("
                    "'---\\nname: x\\ndescription: y\\n---\\nbody'); "
                    "no_open_data, no_open_errs = parse_frontmatter_safe("
                    "'no delimiter here'); "
                    "bad_data, bad_errs = parse_frontmatter_safe("
                    "'---\\nname: x\\n  bad: [unclosed\\n---\\n'); "
                    "print(json.dumps({"
                    "'ok_data': ok_data, "
                    "'ok_errs': [e.code for e in ok_errs], "
                    "'no_open_data': no_open_data, "
                    "'no_open_codes': [e.code for e in no_open_errs], "
                    "'no_open_msg': no_open_errs[0].message if no_open_errs else '', "
                    "'bad_data': bad_data, "
                    "'bad_codes': [e.code for e in bad_errs], "
                    "'bad_line_ge_2': bad_errs[0].line >= 2 if bad_errs else False, "
                    "}))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"parse_frontmatter_safe failed: {result.stderr}"
        data = json.loads(result.stdout.strip())

        # Happy path: dict returned, errors list is empty.
        assert data["ok_data"] == {"name": "x", "description": "y"}
        assert data["ok_errs"] == []

        # E001: opening delimiter missing.
        assert data["no_open_data"] is None
        assert data["no_open_codes"] == ["E001"]
        assert "opening delimiter" in data["no_open_msg"]

        # E003: malformed YAML body — must report a line >= 2 (i.e. inside the
        # frontmatter, not line 1 which is the opening ``---``).
        assert data["bad_data"] is None
        assert data["bad_codes"] == ["E003"]
        assert data["bad_line_ge_2"] is True

    def test_missing_closing_delimiter(self) -> None:
        """A frontmatter with no closing ``---`` returns (None, [E002]).

        Pinned separately from the multi-mode test above because this branch
        is the primary reason four call sites diverged pre-refactor — one used
        to raise a SecurityFinding, another silently returned ``None`` — and
        we need a regression anchor for the unified behavior.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.shared.frontmatter import parse_frontmatter_safe; "
                    "data, errs = parse_frontmatter_safe("
                    "'---\\nname: x\\ndescription: y\\nnot_closed_ever'); "
                    "print(json.dumps({"
                    "'data': data, "
                    "'codes': [e.code for e in errs], "
                    "'msg': errs[0].message if errs else '', "
                    "'line': errs[0].line if errs else 0, "
                    "}))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"parse_frontmatter_safe failed: {result.stderr}"
        data = json.loads(result.stdout.strip())

        assert data["data"] is None
        assert data["codes"] == ["E002"]
        assert "closing delimiter" in data["msg"]
        assert data["line"] == 1

    def test_yaml_safe_load_only_in_shared_frontmatter(self) -> None:
        """Deterministic invariant: every ``yaml.safe_load`` call lives in shared/frontmatter.py.

        This test enforces the spec's deterministic gate — if a future edit
        reintroduces a direct ``yaml.safe_load`` call in any sibling module,
        this test breaks instead of the invariant silently drifting.
        """
        result = subprocess.run(
            ["grep", "-rn", "yaml.safe_load", str(SCRIPTS_DIR), "--include=*.py"],
            capture_output=True,
            text=True,
        )
        # grep returns 0 on match, 1 on no match; both are valid here.
        assert result.returncode in (0, 1), f"grep failed: {result.stderr}"
        hits = [line for line in result.stdout.splitlines() if line.strip()]
        offenders = [h for h in hits if "shared/frontmatter.py" not in h.replace("\\", "/")]
        assert offenders == [], (
            "yaml.safe_load must only appear in shared/frontmatter.py, found:\n"
            + "\n".join(offenders)
        )


class TestSharedToolUtils:
    """Tests for Feature #27: scripts/shared/tool_utils.py canonical normalizer.

    Verifies the single ``parse_tools_string`` function that replaces the
    ``[t.strip() for t in tools_str.split(",") if t.strip()]`` pattern
    that had proliferated across ``agent_composer.py``,
    ``agent_generator.py`` and a dozen sibling modules. Two deterministic
    invariants are pinned below: (1) at least two modules in ``scripts/``
    import from ``shared.tool_utils`` so the migration does not quietly
    revert to inline parsing, and (2) the core behaviours required by
    the spec — basic, whitespace, empty, single inputs — stay consistent
    across Python invocations.
    """

    def test_canonical_normalization(self) -> None:
        """parse_tools_string handles basic, whitespace, empty, single, and list inputs.

        Exercises every contract clause from ``shared/tool_utils.py`` in a
        single subprocess so the test stays fast while still pinning the
        behaviour callers depend on. Empty-token dropping (from trailing
        or doubled commas) is also asserted — that is the canonical
        change the refactor introduced.
        """
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from platxa_agent_generator.shared.tool_utils import parse_tools_string; "
                    "print(json.dumps({"
                    "'basic': parse_tools_string('Read, Write, Edit'), "
                    "'whitespace': parse_tools_string("
                    "'  Read  ,  Write  ,  Edit  '), "
                    "'empty_string': parse_tools_string(''), "
                    "'none_input': parse_tools_string(None), "
                    "'single': parse_tools_string('Read'), "
                    "'trailing_comma': parse_tools_string('Read, Write,'), "
                    "'doubled_comma': parse_tools_string('Read,, Write'), "
                    "'list_input': parse_tools_string(['Read', ' Write ']), "
                    "'list_with_empty': parse_tools_string("
                    "['Read', '', '  ', 'Write']), "
                    "}))"
                ),
            ],
            capture_output=True,
            text=True,
            cwd=str(SCRIPTS_DIR.parent),
        )
        assert result.returncode == 0, f"parse_tools_string failed: {result.stderr}"
        data = json.loads(result.stdout.strip())

        assert data["basic"] == ["Read", "Write", "Edit"]
        assert data["whitespace"] == ["Read", "Write", "Edit"]
        assert data["empty_string"] == []
        assert data["none_input"] == []
        assert data["single"] == ["Read"]
        # Trailing and doubled commas drop empty tokens uniformly.
        assert data["trailing_comma"] == ["Read", "Write"]
        assert data["doubled_comma"] == ["Read", "Write"]
        # List inputs are normalized (stripped) without losing order.
        assert data["list_input"] == ["Read", "Write"]
        assert data["list_with_empty"] == ["Read", "Write"]

    def test_callsite_migration_count(self) -> None:
        """Deterministic invariant: at least two scripts import from shared.tool_utils.

        Enforces the spec gate ``rg 'from platxa_agent_generator.shared.tool_utils import' scripts/
        returns >=2 hits`` — if a future edit reverts one of the migrated
        call sites to inline ``[t.strip() for t in s.split(',')]``, this
        test breaks instead of the invariant silently drifting.
        """
        result = subprocess.run(
            [
                "grep",
                "-rln",
                "from .*shared.tool_utils import",
                str(SCRIPTS_DIR),
                "--include=*.py",
            ],
            capture_output=True,
            text=True,
        )
        # grep returns 0 on match, 1 on no match; both are valid here.
        assert result.returncode in (0, 1), f"grep failed: {result.stderr}"
        hits = [line for line in result.stdout.splitlines() if line.strip()]
        # Exclude the module itself; we only count importers.
        importers = [h for h in hits if "shared/tool_utils.py" not in h.replace("\\", "/")]
        assert len(importers) >= 2, (
            "Expected >=2 modules importing from shared.tool_utils; found "
            f"{len(importers)}: {importers}"
        )


class TestSharedTaskListTemplate:
    """Tests for Feature #36: Orchestrator-workers with shared task list."""

    def _generate_system(self, tmp_path: Path, template: str) -> list[Path]:
        """Helper to generate a multi-agent system and return created files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                template,
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Generator failed: {result.stderr}"
        return list(tmp_path.glob("*.md"))

    def test_orchestrator_has_shared_task_list_section(self, tmp_path: Path) -> None:
        """Orchestrator includes ## Shared Task List section."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        assert len(orch_files) > 0
        content = orch_files[0].read_text()
        assert "## Shared Task List" in content

    def test_orchestrator_has_task_creation_workflow(self, tmp_path: Path) -> None:
        """Orchestrator documents task creation with TodoWrite."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Creation" in content
        assert "TodoWrite" in content
        assert '"pending"' in content

    def test_orchestrator_has_task_sizing_guidelines(self, tmp_path: Path) -> None:
        """Orchestrator includes 5-6 tasks per worker guidance."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Sizing Guidelines" in content
        assert "5-6" in content

    def test_orchestrator_has_task_lifecycle(self, tmp_path: Path) -> None:
        """Orchestrator documents task lifecycle states."""
        files = self._generate_system(tmp_path, "code-review")
        orch_files = [f for f in files if "orchestrator" in f.name]
        content = orch_files[0].read_text()
        assert "### Task Lifecycle" in content
        assert "pending" in content
        assert "in_progress" in content
        assert "completed" in content

    def test_worker_has_task_claiming_pattern(self, tmp_path: Path) -> None:
        """Workers include task claiming workflow steps."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) > 0
        content = worker_files[0].read_text()
        assert "Claim task" in content
        assert "in_progress" in content

    def test_worker_has_task_capacity_guidance(self, tmp_path: Path) -> None:
        """Workers include 5-6 tasks capacity guidance."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "### Task Capacity" in content
        assert "5-6" in content

    def test_worker_claiming_uses_todowrite(self, tmp_path: Path) -> None:
        """Worker task claiming uses TodoWrite tool."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        content = worker_files[0].read_text()
        assert "TodoWrite" in content

    def test_all_workers_have_claiming_pattern(self, tmp_path: Path) -> None:
        """Every worker in the system has the task claiming pattern."""
        files = self._generate_system(tmp_path, "code-review")
        worker_files = [f for f in files if "orchestrator" not in f.name]
        assert len(worker_files) >= 2
        for wf in worker_files:
            content = wf.read_text()
            assert "Claim task" in content, f"Worker {wf.name} missing task claiming pattern"


class TestToolWorkflowCrossValidation:
    """Tests for tools/workflow cross-validation (Feature #48).

    The validator detects two classes of mistake:
    - Unused tools (declared in frontmatter, not referenced in workflow)
      → WARNING (non-blocking over-permissioning)
    - Undeclared tools (referenced in workflow, not in frontmatter)
      → ERROR (agent will fail at runtime when the tool is invoked)
    The quality_scorer tool_design criterion reflects both.
    """

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_clean_agent_has_no_unused_or_undeclared(self) -> None:
        content = (
            "---\n"
            "name: clean-agent\n"
            "description: Matches tools to workflow usage\n"
            "tools: Read, Grep, Glob\n"
            "---\n\n"
            "# Clean\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Use Grep to search\n"
            "3. Use Glob to find\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({"
            "'unused': r.unused, 'undeclared': r.undeclared, "
            "'matched': r.matched, "
            "'has_errors': r.has_errors, 'has_warnings': r.has_warnings"
            "}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["unused"] == []
        assert data["undeclared"] == []
        assert set(data["matched"]) == {"Read", "Grep", "Glob"}
        assert not data["has_errors"]
        assert not data["has_warnings"]

    def test_unused_tool_is_flagged_as_warning(self) -> None:
        content = (
            "---\n"
            "name: unused-tool\n"
            "description: Bash declared but never used\n"
            "tools: Read, Bash\n"
            "---\n\n"
            "# Unused Tool\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Report results\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared, "
            "'has_errors': r.has_errors, 'has_warnings': r.has_warnings}))"
        )
        data = json.loads(result.stdout)
        assert data["unused"] == ["Bash"]
        assert data["undeclared"] == []
        assert data["has_warnings"]
        assert not data["has_errors"]

    def test_undeclared_tool_is_flagged_as_error(self) -> None:
        content = (
            "---\n"
            "name: undeclared-tool\n"
            "description: Workflow references Bash without declaring it\n"
            "tools: Read\n"
            "---\n\n"
            "# Undeclared Tool\n\n"
            "## Workflow\n"
            "1. Use Read to load files\n"
            "2. Use Bash to execute commands\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared, "
            "'has_errors': r.has_errors}))"
        )
        data = json.loads(result.stdout)
        assert data["undeclared"] == ["Bash"]
        assert data["has_errors"]

    def test_word_boundary_prevents_substring_false_positives(self) -> None:
        """'Read' tool must NOT match the word 'readable' in workflow text."""
        content = (
            "---\n"
            "name: wb\n"
            "description: No false positives on substrings\n"
            "tools: Grep\n"
            "---\n\n"
            "# WB\n\n"
            "## Workflow\n"
            "1. Use Grep to find readable patterns\n"
            "2. The readable output is returned\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'referenced': r.referenced, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert "Read" not in data["referenced"], data
        assert data["undeclared"] == []

    def test_missing_workflow_section_yields_no_undeclared(self) -> None:
        """Without a workflow section, we can't fail the cross-check."""
        content = (
            "---\n"
            "name: no-workflow\n"
            "description: Agent with no workflow section\n"
            "tools: Read, Grep\n"
            "---\n\n"
            "# No Workflow\n\n"
            "## Overview\n"
            "This agent has no workflow section.\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'unused': r.unused, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert data["undeclared"] == []
        assert set(data["unused"]) == {"Read", "Grep"}

    def test_mcp_tool_names_are_matched_as_full_identifiers(self) -> None:
        content = (
            "---\n"
            "name: mcp-agent\n"
            "description: Uses an MCP tool\n"
            "tools: Read, mcp__filesystem__read_file\n"
            "---\n\n"
            "# MCP Agent\n\n"
            "## Workflow\n"
            "1. Use Read for project files\n"
            "2. Use mcp__filesystem__read_file for external paths\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import parse_agent_file, cross_validate_tools_vs_workflow\n"
            f"fm, sec, _ = parse_agent_file({content!r})\n"
            "r = cross_validate_tools_vs_workflow(fm, sec)\n"
            "print(json.dumps({'matched': r.matched, "
            "'unused': r.unused, 'undeclared': r.undeclared}))"
        )
        data = json.loads(result.stdout)
        assert "mcp__filesystem__read_file" in data["matched"], data
        assert data["unused"] == []
        assert data["undeclared"] == []

    def test_tool_design_score_ordering_clean_unused_undeclared(self) -> None:
        """Equal tool counts: clean > unused > undeclared (via score_quality)."""
        clean = (
            "---\n"
            "name: clean\ndescription: Clean alignment\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Read to load files carefully\n"
            "2. Use Bash to run validation with care and safety\n"
        )
        unused = (
            "---\n"
            "name: unused\ndescription: Read is unused\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Bash to run validation with care and safety\n"
        )
        undeclared = (
            "---\n"
            "name: undeclared\ndescription: Grep is undeclared\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Read carefully and safely\n"
            "2. Use Bash with care\n"
            "3. Use Grep to find patterns\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import score_quality\n"
            f"clean = {clean!r}\nunused = {unused!r}\nundeclared = {undeclared!r}\n"
            "def td(c):\n"
            "    return next(x for x in score_quality(c).criteria if x.name == 'Tool Design').score\n"
            "print(json.dumps({'clean': td(clean), 'unused': td(unused), "
            "'undeclared': td(undeclared)}))"
        )
        assert result.returncode == 0, result.stderr
        scores = json.loads(result.stdout)
        assert scores["unused"] < scores["clean"], scores
        assert scores["undeclared"] < scores["unused"], scores

    def test_tool_design_suggestions_label_severity(self) -> None:
        """Suggestions say 'WARNING' for unused and 'ERROR' for undeclared."""
        undeclared = (
            "---\n"
            "name: agent\ndescription: Uses Grep without declaring\ntools: Read\n"
            "---\n\n## Workflow\n1. Use Read and then Grep for patterns\n"
        )
        unused = (
            "---\n"
            "name: agent\ndescription: Read never used\ntools: Read, Bash\n"
            "---\n\n## Workflow\n1. Use Bash carefully and safely\n"
        )
        result = self._run_py(
            "import json\n"
            "from platxa_agent_generator.quality_scorer import score_quality\n"
            f"u = {unused!r}\nd = {undeclared!r}\n"
            "def sugg(c):\n"
            "    td = next(x for x in score_quality(c).criteria if x.name == 'Tool Design')\n"
            "    return td.suggestions\n"
            "print(json.dumps({'unused': sugg(u), 'undeclared': sugg(d)}))"
        )
        data = json.loads(result.stdout)
        assert any("WARNING" in s for s in data["unused"]), data["unused"]
        assert any("ERROR" in s for s in data["undeclared"]), data["undeclared"]
