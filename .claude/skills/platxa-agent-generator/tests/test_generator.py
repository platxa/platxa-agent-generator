#!/usr/bin/env python3
"""
Comprehensive Test Suite for Platxa Agent Generator

Real functional tests that exercise actual code paths.
Run with: pytest tests/test_generator.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


class TestSyntaxValidator:
    """Real tests for syntax_validator.py CLI."""

    def test_valid_agent_passes_validation(self, tmp_path: Path) -> None:
        """Create a real valid agent file and validate it."""
        agent_file = tmp_path / "valid-agent.md"
        agent_file.write_text("""---
name: test-agent
description: A test agent for validation
tools: Read, Write
---

# Test Agent

## Overview
This is a test agent.

## Workflow
1. Read files
2. Write output
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["valid"] is True
        assert len(output["errors"]) == 0

    def test_missing_frontmatter_fails(self, tmp_path: Path) -> None:
        """Real test: file without frontmatter should fail."""
        agent_file = tmp_path / "no-frontmatter.md"
        agent_file.write_text("""# Test Agent

No frontmatter in this file.
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["valid"] is False

    def test_missing_name_field_fails(self, tmp_path: Path) -> None:
        """Real test: missing required 'name' field should fail."""
        agent_file = tmp_path / "no-name.md"
        agent_file.write_text("""---
description: Missing name field
tools: Read
---

# Test
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["valid"] is False

    def test_invalid_yaml_syntax_fails(self, tmp_path: Path) -> None:
        """Real test: invalid YAML syntax should fail."""
        agent_file = tmp_path / "bad-yaml.md"
        agent_file.write_text("""---
name: test
description: [unclosed bracket
tools: Read
---

# Test
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["valid"] is False


class TestSecurityScanner:
    """Real tests for security_scanner.py CLI."""

    def test_clean_agent_passes(self, tmp_path: Path) -> None:
        """Real test: clean agent should pass security scan."""
        agent_file = tmp_path / "clean-agent.md"
        agent_file.write_text("""---
name: clean-agent
description: A clean safe agent
tools: Read, Glob, Grep
---

# Clean Agent

## Workflow
1. Read configuration files
2. Search for patterns
3. Report findings
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "security_scanner.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["passed"] is True
        assert output["score"] >= 5.0

    def test_dangerous_tools_detected(self, tmp_path: Path) -> None:
        """Real test: dangerous tool combinations should be flagged."""
        agent_file = tmp_path / "dangerous-agent.md"
        agent_file.write_text("""---
name: dangerous-agent
description: Agent with risky tool combination
tools: Bash, Write, WebFetch
---

# Dangerous Agent

## Workflow
1. Download external scripts
2. Execute downloaded code
3. Modify system files
""")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "security_scanner.py"),
                "--json",
                str(agent_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        # Should have warnings or lower score for dangerous combination
        assert len(output.get("warnings", [])) > 0 or output["score"] < 10.0


class TestWorkflowState:
    """Real tests for workflow_state.py CLI."""

    def test_create_new_workflow(self, tmp_path: Path) -> None:
        """Real test: create a new workflow state file."""
        state_file = tmp_path / "workflow.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--name",
                "test-agent",
                "--output",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert state_file.exists()

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"
        assert data["agent_name"] == "test-agent"

    def test_transition_through_phases(self, tmp_path: Path) -> None:
        """Real test: transition through all workflow phases."""
        state_file = tmp_path / "workflow.json"

        # Create workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Transition: idle -> discovery
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify state
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "discovery"

        # Transition: discovery -> architecture
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "architecture",
            ],
            capture_output=True,
        )
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "architecture"

    def test_invalid_transition_rejected(self, tmp_path: Path) -> None:
        """Real test: invalid transitions should be rejected."""
        state_file = tmp_path / "workflow.json"

        # Create workflow (starts at idle)
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Try invalid transition: idle -> generation (should fail)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "generation",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

        # State should still be idle
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"

    def test_reset_workflow(self, tmp_path: Path) -> None:
        """Real test: reset workflow back to idle."""
        state_file = tmp_path / "workflow.json"

        # Create and advance workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "transition",
                str(state_file),
                "discovery",
            ],
            capture_output=True,
        )

        # Reset
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "reset",
                str(state_file),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "idle"


class TestToolSelector:
    """Real tests for tool_selector.py CLI."""

    def test_analyzer_type_tools(self) -> None:
        """Real test: analyzer type should get read/search tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "analyzer",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Read" in tools
        assert "Grep" in tools
        assert "Glob" in tools

    def test_builder_type_tools(self) -> None:
        """Real test: builder type should get write/edit tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "builder",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Write" in tools
        assert "Edit" in tools

    def test_automation_type_tools(self) -> None:
        """Real test: automation type should get bash tool."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "automation",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        assert "Bash" in tools

    def test_domain_enhancement(self) -> None:
        """Real test: web domain should add web tools."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "tool_selector.py"),
                "--type",
                "analyzer",
                "--domain",
                "web",
                "--json-output",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        tools = output["tools"]
        # Web domain should include web-related tools
        assert "WebFetch" in tools or "WebSearch" in tools


class TestInteractivePrompts:
    """Real tests for interactive_prompts.py CLI."""

    def test_list_all_phases(self) -> None:
        """Real test: list all phases and questions."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "all",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert len(output) == 5  # 5 phases

        phase_names = [p["phase"] for p in output]
        assert "discovery" in phase_names
        assert "architecture" in phase_names
        assert "generation" in phase_names
        assert "validation" in phase_names
        assert "installation" in phase_names

    def test_get_discovery_phase(self) -> None:
        """Real test: get discovery phase questions."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "phase",
                "discovery",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["phase"] == "discovery"
        assert len(output["questions"]) >= 2

        # Check question format matches AskUserQuestion
        for q in output["questions"]:
            assert "question" in q
            assert "header" in q
            assert "options" in q
            assert len(q["options"]) >= 2

    def test_get_question_by_key(self) -> None:
        """Real test: lookup specific question by key."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "interactive_prompts.py"),
                "--key",
                "agent_type",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["header"] == "Agent Type"
        assert len(output["options"]) >= 3


class TestMultiAgentGenerator:
    """Real tests for multiagent_generator.py CLI."""

    def test_list_templates(self) -> None:
        """Real test: list available templates."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "multiagent_generator.py"), "templates"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "code-review" in result.stdout
        assert "documentation" in result.stdout
        assert "test-suite" in result.stdout

    def test_generate_custom_system(self) -> None:
        """Real test: generate custom multi-agent system."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--name",
                "test-system",
                "--workers",
                "2",
                "--domain",
                "data",
                "--json",
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["name"] == "test-system"
        assert len(output["workers"]) == 2
        assert output["orchestrator"]["name"] == "test-system-orchestrator"

    def test_generate_from_template(self, tmp_path: Path) -> None:
        """Real test: generate system from template to files."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "code-review",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify files were created
        files = list(tmp_path.glob("*.md"))
        assert len(files) >= 3  # orchestrator + 3 workers

        # Verify manifest exists
        manifest = tmp_path / "code-review-system-manifest.json"
        assert manifest.exists()

    def test_generated_agents_pass_validation(self, tmp_path: Path) -> None:
        """Real test: generated agent files should pass syntax validation."""
        # Generate system
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "code-review",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Validate each generated .md file
        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["valid"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )


class TestPromptGenerator:
    """Real tests for prompt_generator.py CLI."""

    def test_generate_analyzer_prompt(self) -> None:
        """Real test: generate prompt for analyzer type."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "analyzer",
                "--domain",
                "code",
                "--purpose",
                "Analyzes code quality and patterns",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        # Prompt should contain relevant content
        prompt = result.stdout.lower()
        assert "analy" in prompt  # analyze/analysis/analytical

    def test_generate_builder_prompt(self) -> None:
        """Real test: generate prompt for builder type."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "builder",
                "--domain",
                "features",
                "--purpose",
                "Builds new features and components",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        prompt = result.stdout.lower()
        assert "creat" in prompt or "build" in prompt or "generat" in prompt

    def test_different_types_produce_different_prompts(self) -> None:
        """Real test: different agent types should produce different prompts."""
        analyzer_result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "analyzer",
                "--domain",
                "general",
                "--purpose",
                "General purpose",
            ],
            capture_output=True,
            text=True,
        )
        builder_result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "prompt_generator.py"),
                "--type",
                "builder",
                "--domain",
                "general",
                "--purpose",
                "General purpose",
            ],
            capture_output=True,
            text=True,
        )
        assert analyzer_result.stdout != builder_result.stdout


class TestInstallAgent:
    """Real tests for install_agent.py CLI."""

    def test_install_to_project_scope(self, tmp_path: Path) -> None:
        """Real test: install agent to project scope directory."""
        # Create a valid agent file
        agent_file = tmp_path / "test-agent.md"
        agent_file.write_text("""---
name: install-test-agent
description: Test agent for installation
tools: Read, Write
---

# Install Test Agent

## Workflow
1. Test step
""")
        # Create project structure
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        (project_dir / ".claude").mkdir()

        # Install to project scope (need to run from project dir)
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "install_agent.py"),
                "install",
                str(agent_file),
                "--scope",
                "project",
                "--skip-validation",
                "--json",
            ],
            capture_output=True,
            text=True,
            cwd=str(project_dir),
        )
        output = json.loads(result.stdout)
        assert output["success"] is True
        assert "install-test-agent" in output["agent_name"]

    def test_list_command(self) -> None:
        """Real test: list command runs without error."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "install_agent.py"), "list", "--json"],
            capture_output=True,
            text=True,
        )
        # Should return valid JSON (empty list or list of agents)
        output = json.loads(result.stdout)
        assert isinstance(output, list)


class TestIntegration:
    """Integration tests that exercise multiple modules together."""

    def test_full_workflow_cycle(self, tmp_path: Path) -> None:
        """Real integration test: complete workflow from start to finish."""
        state_file = tmp_path / "workflow.json"

        # Create workflow
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "workflow_state.py"),
                "new",
                "--name",
                "integration-test",
                "--output",
                str(state_file),
            ],
            capture_output=True,
        )

        # Walk through all phases
        phases = [
            "discovery",
            "architecture",
            "generation",
            "validation",
            "installation",
            "complete",
        ]
        for phase in phases:
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "workflow_state.py"),
                    "transition",
                    str(state_file),
                    phase,
                ],
                capture_output=True,
            )
            assert result.returncode == 0, f"Failed transition to {phase}"

        # Verify final state
        data = json.loads(state_file.read_text())
        assert data["current_phase"] == "complete"

    def test_multiagent_to_validation_pipeline(self, tmp_path: Path) -> None:
        """Real integration test: generate multi-agent system and validate all files."""
        output_dir = tmp_path / "agents"

        # Generate multi-agent system
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "documentation",
                "--output",
                str(output_dir),
            ],
            capture_output=True,
        )

        # Validate all generated markdown files
        md_files = list(output_dir.glob("*.md"))
        assert len(md_files) >= 2

        for md_file in md_files:
            # Syntax validation
            syntax_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            syntax_output = json.loads(syntax_result.stdout)
            assert syntax_output["valid"] is True, f"Syntax failed: {md_file.name}"

            # Security scan
            security_result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "security_scanner.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            security_output = json.loads(security_result.stdout)
            assert security_output["passed"] is True, f"Security failed: {md_file.name}"


class TestPromptChainingPattern:
    """Tests for prompt-chaining pattern template generator."""

    def test_analyzer_generates_discovery_analysis_synthesis_steps(self) -> None:
        """Analyzer agents should generate Discovery -> Analysis -> Synthesis workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-analyzer",
                "--description",
                "Analyzes code for quality issues",
                "--tools",
                "Read,Grep,Glob",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Verify sequential steps
        assert "Step 1: Discovery" in output
        assert "Step 2: Analysis" in output
        assert "Step 3: Synthesis" in output

        # Verify data flow
        assert "Data Flow" in output
        assert "[Input]" in output
        assert "[Discovery]" in output
        assert "[Output]" in output

        # Verify quality gates
        assert "Quality Gate" in output

    def test_generator_produces_research_design_generate_validate_steps(self) -> None:
        """Generator agents should produce Research -> Design -> Generate -> Validate workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "doc-generator",
                "--description",
                "Generates documentation from code",
                "--tools",
                "Read,Write,Grep",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Research" in output
        assert "Step 2: Design" in output
        assert "Step 3: Generate" in output
        assert "Step 4: Validate" in output

    def test_transformer_produces_load_transform_output_steps(self) -> None:
        """Transformer agents should produce Load -> Transform -> Output workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "format-converter",
                "--description",
                "Transforms JSON to YAML format",
                "--tools",
                "Read,Write",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Load" in output
        assert "Step 2: Transform" in output
        assert "Step 3: Output" in output

    def test_tester_produces_setup_execute_report_steps(self) -> None:
        """Test agents should produce Setup -> Execute -> Report workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "test-runner",
                "--description",
                "Validates code against test cases",
                "--tools",
                "Read,Bash,Glob",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Setup" in output
        assert "Step 2: Execute" in output
        assert "Step 3: Report" in output

    def test_search_agent_produces_scope_search_filter_present_steps(self) -> None:
        """Search agents should produce Scope -> Search -> Filter -> Present workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-finder",
                "--description",
                "Searches codebase for patterns and functions",
                "--tools",
                "Grep,Glob,Read",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Scope" in output
        assert "Step 2: Search" in output
        assert "Step 3: Filter" in output
        assert "Step 4: Present" in output

    def test_fixer_produces_diagnose_plan_implement_verify_steps(self) -> None:
        """Fixer agents should produce Diagnose -> Plan -> Implement -> Verify workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "bug-fixer",
                "--description",
                "Fixes bugs and resolves issues in code",
                "--tools",
                "Read,Edit,Bash",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Diagnose" in output
        assert "Step 2: Plan" in output
        assert "Step 3: Implement" in output
        assert "Step 4: Verify" in output

    def test_custom_chain_steps_from_json(self) -> None:
        """Custom chain_steps should be used when provided via JSON."""
        json_input = json.dumps(
            {
                "name": "custom-workflow",
                "description": "Agent with custom workflow steps",
                "tools": ["Read", "Write"],
                "chain_steps": [
                    {
                        "name": "Fetch",
                        "description": "Retrieve data from source",
                        "tools": ["Read"],
                        "validation": "Data retrieved successfully",
                    },
                    {
                        "name": "Process",
                        "description": "Transform the data",
                        "validation": "Transformation complete",
                    },
                    {
                        "name": "Store",
                        "description": "Save processed data",
                        "tools": ["Write"],
                        "validation": "Data stored correctly",
                    },
                ],
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--json",
                json_input,
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Verify custom steps are used
        assert "Step 1: Fetch" in output
        assert "Step 2: Process" in output
        assert "Step 3: Store" in output

        # Verify custom descriptions
        assert "Retrieve data from source" in output
        assert "Transform the data" in output
        assert "Save processed data" in output

        # Verify custom validation
        assert "Data retrieved successfully" in output

    def test_tools_assigned_to_steps(self) -> None:
        """Tools should be properly assigned to relevant steps."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "full-analyzer",
                "--description",
                "Analyzes and reports on code",
                "--tools",
                "Read,Grep,Glob,Write",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Read tools should appear in discovery/analysis steps
        assert "**Tools:**" in output

    def test_data_flow_diagram_generated(self) -> None:
        """Data flow diagram should always be generated."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "flow-test",
                "--description",
                "Test agent for data flow",
                "--tools",
                "Read",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "### Data Flow" in output
        assert "[Input]" in output
        assert "[Output]" in output
        assert "→" in output

    def test_quality_gates_include_validation_criteria(self) -> None:
        """Each step should have quality gate with validation criteria."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "quality-test",
                "--description",
                "Analyzes quality metrics",
                "--tools",
                "Read,Grep",
                "--pattern",
                "prompt-chaining",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should have quality gates
        assert "**Quality Gate:**" in output
        assert "Check completeness" in output
        assert "Verify format" in output
        assert "Confirm no errors" in output

    def test_generated_agent_passes_syntax_validation(self, tmp_path: Path) -> None:
        """Generated prompt-chaining agent should pass syntax validation."""
        output_file = tmp_path / "test-agent.md"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "validated-agent",
                "--description",
                "Agent for validation test",
                "--tools",
                "Read,Write",
                "--pattern",
                "prompt-chaining",
                "--output",
                str(output_file),
            ],
            capture_output=True,
        )

        # Validate the generated file
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "syntax_validator.py"),
                "--json",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )
        output = json.loads(result.stdout)
        assert output["valid"] is True, f"Validation failed: {output.get('errors', [])}"


class TestOtherPatternTemplates:
    """Tests for routing, parallelization, and evaluator-optimizer patterns."""

    def test_routing_pattern_generates_classification_route_process(self) -> None:
        """Routing pattern should generate Classification -> Route -> Process workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "request-router",
                "--description",
                "Routes requests to handlers",
                "--tools",
                "Read,Task",
                "--pattern",
                "routing",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Classification" in output
        assert "Step 2: Route" in output
        assert "Step 3: Process" in output
        assert "| Input Type | Handler |" in output

    def test_parallelization_pattern_generates_decompose_parallel_aggregate(
        self,
    ) -> None:
        """Parallelization pattern should generate Decompose -> Parallel -> Aggregate workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "parallel-processor",
                "--description",
                "Processes items in parallel",
                "--tools",
                "Read,Task",
                "--pattern",
                "parallelization",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Decompose" in output
        assert "Step 2: Parallel Execution" in output
        assert "Step 3: Aggregate" in output
        assert "Task 1:" in output

    def test_evaluator_optimizer_generates_generate_evaluate_optimize_finalize(
        self,
    ) -> None:
        """Evaluator-optimizer should generate Generate -> Evaluate -> Optimize -> Finalize workflow."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "agent_generator.py"),
                "--name",
                "code-optimizer",
                "--description",
                "Optimizes code iteratively",
                "--tools",
                "Read,Edit",
                "--pattern",
                "evaluator-optimizer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        assert "Step 1: Generate" in output
        assert "Step 2: Evaluate" in output
        assert "Step 3: Optimize" in output
        assert "Step 4: Finalize" in output
        assert "Evaluation Criteria:" in output


class TestMultiAgentRoutingPattern:
    """Tests for multi-agent routing pattern with classifier + handlers."""

    def test_routing_template_generates_classifier_and_handlers(
        self, tmp_path: Path
    ) -> None:
        """Routing template should generate classifier + 3 handler agents."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify classifier agent
        classifier_file = tmp_path / "request-classifier.md"
        assert classifier_file.exists(), "Classifier agent file should exist"

        # Verify handler agents
        assert (tmp_path / "query-handler.md").exists(), "Query handler should exist"
        assert (tmp_path / "action-handler.md").exists(), "Action handler should exist"
        assert (tmp_path / "analysis-handler.md").exists(), (
            "Analysis handler should exist"
        )

        # Verify manifest
        manifest_file = tmp_path / "routing-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "routing"

    def test_classifier_contains_classification_rules(self, tmp_path: Path) -> None:
        """Classifier agent should contain classification rules for routing."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        # Verify classification rules
        assert "Classification Rules" in classifier_content
        assert "Query Requests" in classifier_content
        assert "Action Requests" in classifier_content
        assert "Analysis Requests" in classifier_content
        assert "Default Route" in classifier_content

        # Verify handler table
        assert "Handler | Description | Tools" in classifier_content
        assert "query-handler" in classifier_content
        assert "action-handler" in classifier_content
        assert "analysis-handler" in classifier_content

    def test_classifier_has_workflow_with_routing_steps(self, tmp_path: Path) -> None:
        """Classifier should have workflow steps for classification, routing, response."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        assert "Step 1: Classification" in classifier_content
        assert "Step 2: Route" in classifier_content
        assert "Step 3: Response" in classifier_content

    def test_classifier_includes_error_handling(self, tmp_path: Path) -> None:
        """Classifier should include error handling strategies."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        classifier_content = (tmp_path / "request-classifier.md").read_text()

        assert "Error Handling" in classifier_content
        assert "Handler failure" in classifier_content

    def test_handlers_have_correct_tools(self, tmp_path: Path) -> None:
        """Each handler should have appropriate tools for its role."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Query handler should have search tools
        query_content = (tmp_path / "query-handler.md").read_text()
        assert "Grep" in query_content or "Read" in query_content

        # Action handler should have write/edit tools
        action_content = (tmp_path / "action-handler.md").read_text()
        assert "Write" in action_content or "Edit" in action_content

        # Analysis handler should have read tools
        analysis_content = (tmp_path / "analysis-handler.md").read_text()
        assert "Read" in analysis_content

    def test_routing_example_command_shows_classifier(self) -> None:
        """Example routing command should show classifier markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "routing",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show classifier content, not orchestrator
        assert "Classification Rules" in output
        assert "Handler Agents" in output
        assert "Routing" in output

    def test_generated_routing_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated routing pattern agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "routing",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        for md_file in tmp_path.glob("*.md"):
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS_DIR / "syntax_validator.py"),
                    "--json",
                    str(md_file),
                ],
                capture_output=True,
                text=True,
            )
            output = json.loads(result.stdout)
            assert output["valid"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_routing_cli_pattern_option(self) -> None:
        """Routing should be available as a pattern option in CLI."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "generate",
                "--help",
            ],
            capture_output=True,
            text=True,
        )
        assert "routing" in result.stdout


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
