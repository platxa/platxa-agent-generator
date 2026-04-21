#!/usr/bin/env python3
"""
test_patterns — sharded from test_generator.py.

Shards: 6 TestXxx classes.
Run with: pytest tests/test_patterns.py -v
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent.parent / "src" / "platxa_agent_generator"


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
        assert output["passed"] is True, f"Validation failed: {output.get('errors', [])}"


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

        assert "Step 1: Generate Initial Output" in output
        assert "Step 2: Evaluate Quality" in output
        assert "Step 3: Optimize (Iterative)" in output
        assert "Step 4: Finalize & Report" in output
        assert "Evaluation Criteria (weighted):" in output
        # Feature 17: Iteration tracking
        assert "Iteration Configuration" in output
        assert "max_iterations" in output
        assert "improvement_threshold" in output


class TestMultiAgentRoutingPattern:
    """Tests for multi-agent routing pattern with classifier + handlers."""

    def test_routing_template_generates_classifier_and_handlers(self, tmp_path: Path) -> None:
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
        assert (tmp_path / "analysis-handler.md").exists(), "Analysis handler should exist"

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
            assert output["passed"] is True, (
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


class TestMultiAgentEvaluatorOptimizerPattern:
    """Tests for multi-agent evaluator-optimizer pattern with feedback loops."""

    def test_evaluator_optimizer_template_generates_all_agents(self, tmp_path: Path) -> None:
        """Evaluator-optimizer template should generate controller + 3 worker agents."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify controller agent
        controller_file = tmp_path / "feedback-loop-controller.md"
        assert controller_file.exists(), "Controller agent file should exist"

        # Verify worker agents
        assert (tmp_path / "content-generator.md").exists(), "Generator should exist"
        assert (tmp_path / "quality-evaluator.md").exists(), "Evaluator should exist"
        assert (tmp_path / "improvement-optimizer.md").exists(), "Optimizer should exist"

        # Verify manifest
        manifest_file = tmp_path / "evaluator-optimizer-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "evaluator-optimizer"

    def test_controller_contains_quality_criteria(self, tmp_path: Path) -> None:
        """Controller agent should contain quality criteria with thresholds."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        # Verify quality criteria section
        assert "Quality Criteria" in controller_content
        assert "Clarity" in controller_content
        assert "Completeness" in controller_content
        assert "Correctness" in controller_content
        assert "Threshold" in controller_content

    def test_controller_has_feedback_loop_workflow(self, tmp_path: Path) -> None:
        """Controller should have workflow steps for feedback loop."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        # Verify workflow steps
        assert "Step 1: Initialize" in controller_content
        assert "Step 2: Generate" in controller_content
        assert "Step 3: Evaluate" in controller_content
        assert "Step 4: Optimize" in controller_content
        assert "Step 5: Finalize" in controller_content

        # Verify decision point for loop
        assert "Decision Point" in controller_content

    def test_controller_includes_iteration_tracking(self, tmp_path: Path) -> None:
        """Controller should include iteration tracking mechanism."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        assert "Iteration Tracking" in controller_content
        assert "Iteration" in controller_content
        assert "Score" in controller_content

    def test_controller_includes_error_handling(self, tmp_path: Path) -> None:
        """Controller should include error handling for various failure modes."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        controller_content = (tmp_path / "feedback-loop-controller.md").read_text()

        assert "Error Handling" in controller_content
        assert "Generator failure" in controller_content
        assert "Evaluator failure" in controller_content
        assert "Max iterations" in controller_content

    def test_workers_have_specialized_roles(self, tmp_path: Path) -> None:
        """Each worker should have appropriate role and responsibilities."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        # Generator should create content
        generator_content = (tmp_path / "content-generator.md").read_text()
        assert "generator" in generator_content.lower()

        # Evaluator should assess quality
        evaluator_content = (tmp_path / "quality-evaluator.md").read_text()
        assert "evaluat" in evaluator_content.lower()

        # Optimizer should plan improvements
        optimizer_content = (tmp_path / "improvement-optimizer.md").read_text()
        assert "optimi" in optimizer_content.lower()

    def test_evaluator_optimizer_example_shows_controller(self) -> None:
        """Example command should show feedback loop controller markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "evaluator-optimizer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show controller content
        assert "Feedback Loop Controller" in output
        assert "Quality Criteria" in output
        assert "Evaluator-Optimizer" in output

    def test_generated_evaluator_optimizer_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated evaluator-optimizer agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "evaluator-optimizer",
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
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_evaluator_optimizer_cli_pattern_option(self) -> None:
        """Evaluator-optimizer should be available as a pattern option in CLI."""
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
        assert "evaluator-optimizer" in result.stdout


class TestMultiAgentParallelizationPattern:
    """Tests for multi-agent parallelization pattern with concurrent execution."""

    def test_parallelization_template_generates_orchestrator_and_workers(
        self, tmp_path: Path
    ) -> None:
        """Parallelization template should generate orchestrator + 3 partition workers."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0

        # Verify orchestrator agent
        orchestrator_file = tmp_path / "parallel-orchestrator.md"
        assert orchestrator_file.exists(), "Orchestrator agent file should exist"

        # Verify worker agents
        assert (tmp_path / "partition-worker-1.md").exists(), "Worker 1 should exist"
        assert (tmp_path / "partition-worker-2.md").exists(), "Worker 2 should exist"
        assert (tmp_path / "partition-worker-3.md").exists(), "Worker 3 should exist"

        # Verify manifest
        manifest_file = tmp_path / "parallelization-system-manifest.json"
        assert manifest_file.exists(), "Manifest should exist"

        manifest = json.loads(manifest_file.read_text())
        assert manifest["pattern"] == "parallelization"

    def test_orchestrator_contains_parallel_task_calls(self, tmp_path: Path) -> None:
        """Orchestrator should contain example of parallel Task tool calls."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Verify parallel Task call examples
        assert "CRITICAL" in orchestrator_content
        assert "SINGLE message" in orchestrator_content
        assert "multiple Task tool calls" in orchestrator_content
        assert "<invoke name=" in orchestrator_content
        assert "partition-worker-1" in orchestrator_content
        assert "partition-worker-2" in orchestrator_content

    def test_orchestrator_has_decompose_execute_aggregate_workflow(self, tmp_path: Path) -> None:
        """Orchestrator should have workflow steps for decompose, execute, aggregate."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Verify workflow steps
        assert "Step 1: Decompose" in orchestrator_content
        assert "Step 2: Parallel Execution" in orchestrator_content
        assert "Step 3: Aggregate" in orchestrator_content

    def test_orchestrator_includes_partition_strategy(self, tmp_path: Path) -> None:
        """Orchestrator should include partition strategy guidance."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        assert "Partition Strategy" in orchestrator_content
        assert "Task Type" in orchestrator_content

    def test_orchestrator_includes_error_handling(self, tmp_path: Path) -> None:
        """Orchestrator should include error handling for parallel execution."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        assert "Error Handling" in orchestrator_content
        assert "timeout" in orchestrator_content.lower()
        assert "Partial success" in orchestrator_content

    def test_orchestrator_includes_aggregation_strategies(self, tmp_path: Path) -> None:
        """Orchestrator should document different aggregation strategies."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
                "--output",
                str(tmp_path),
            ],
            capture_output=True,
        )

        orchestrator_content = (tmp_path / "parallel-orchestrator.md").read_text()

        # Should have aggregation strategies
        assert "Union" in orchestrator_content
        assert "Reduce" in orchestrator_content
        assert "Concatenate" in orchestrator_content

    def test_parallelization_example_shows_orchestrator(self) -> None:
        """Example command should show parallel orchestrator markdown."""
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "parallelization",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = result.stdout

        # Should show orchestrator content with parallel calls
        assert "Parallel Orchestrator" in output
        assert "Parallelization" in output
        assert "function_calls" in output

    def test_generated_parallelization_agents_pass_validation(self, tmp_path: Path) -> None:
        """All generated parallelization agents should pass syntax validation."""
        subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "parallelization",
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
            assert output["passed"] is True, (
                f"Validation failed for {md_file.name}: {output['errors']}"
            )

    def test_parallelization_cli_pattern_option(self) -> None:
        """Parallelization should be available as a pattern option in CLI."""
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
        assert "parallelization" in result.stdout


class TestWriterReviewerTemplate:
    """Tests for the writer-reviewer multi-agent template (Feature #42)."""

    def _run_py(self, code: str) -> subprocess.CompletedProcess:
        prologue = ""
        return subprocess.run(
            [sys.executable, "-c", prologue + code],
            capture_output=True,
            text=True,
        )

    def test_template_is_registered(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print('writer-reviewer' in SYSTEM_TEMPLATES)"
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "True"

    def test_template_declares_writer_reviewer_pattern(self) -> None:
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print(SYSTEM_TEMPLATES['writer-reviewer']['pattern'])"
        )
        assert result.stdout.strip() == "writer-reviewer"

    def test_template_has_exactly_two_workers_with_complementary_roles(self) -> None:
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "workers = SYSTEM_TEMPLATES['writer-reviewer']['workers']; "
            "print(json.dumps([(w['name'], w['role']) for w in workers]))"
        )
        assert result.returncode == 0, result.stderr
        pairs = json.loads(result.stdout)
        roles = {role for _, role in pairs}
        assert roles == {"writer", "reviewer"}, f"expected writer+reviewer, got {roles}"
        assert len(pairs) == 2

    def test_reviewer_has_clean_context_guarantees(self) -> None:
        """Reviewer must have worktree isolation AND no file-modifying tools."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            "rev = next(w for w in sys_.workers if w.role == 'reviewer'); "
            "print(json.dumps({'isolation': rev.isolation, 'tools': rev.tools}))"
        )
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert data["isolation"] == "worktree", (
            "reviewer must run in worktree isolation for fresh context"
        )
        forbidden = {"Write", "Edit", "Bash", "MultiEdit"}
        overlap = forbidden & set(data["tools"])
        assert not overlap, f"reviewer must be read-only; found write-tools: {overlap}"

    def test_writer_has_worktree_isolation(self) -> None:
        """Writer must run in an isolated worktree so iterations don't collide."""
        result = self._run_py(
            "from platxa_agent_generator.multiagent_generator import create_system_from_template; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            "w = next(w for w in sys_.workers if w.role == 'writer'); "
            "print(w.isolation)"
        )
        assert result.stdout.strip() == "worktree"

    def test_feedback_loop_config_is_documented(self) -> None:
        """feedback_loop_config must declare clean_context invariants and termination rules."""
        result = self._run_py(
            "import json; "
            "from platxa_agent_generator.multiagent_generator import SYSTEM_TEMPLATES; "
            "print(json.dumps(SYSTEM_TEMPLATES['writer-reviewer']['feedback_loop_config']))"
        )
        assert result.returncode == 0, result.stderr
        cfg = json.loads(result.stdout)
        assert cfg["max_iterations"] >= 1
        cc = cfg["clean_context"]
        assert isinstance(cc["reviewer_receives"], list) and cc["reviewer_receives"]
        assert isinstance(cc["reviewer_never_receives"], list) and cc["reviewer_never_receives"]
        never = " ".join(cc["reviewer_never_receives"]).lower()
        assert "reasoning" in never or "transcript" in never, (
            "clean_context must explicitly exclude writer reasoning/transcript"
        )
        term = cfg["termination"]
        assert "approve" in term and "max_iterations" in term

    def test_orchestrator_markdown_uses_writer_reviewer_generator(self, tmp_path: Path) -> None:
        """save_system must route pattern=writer-reviewer to the dedicated generator."""
        out_dir = tmp_path / "wr"
        result = self._run_py(
            "from pathlib import Path; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            f"files = save_system(sys_, Path('{out_dir}')); "
            "print('\\n'.join(str(f) for f in files))"
        )
        assert result.returncode == 0, result.stderr
        files = [Path(p) for p in result.stdout.strip().splitlines()]
        assert len(files) == 4, [p.name for p in files]
        orch = next(f for f in files if "coordinator" in f.name and f.suffix == ".md")
        content = orch.read_text()
        assert "Writer-Reviewer" in content
        assert "Clean-Context" in content or "clean context" in content.lower()
        assert "fresh context" in content.lower() or "clean context" in content.lower()

    def test_orchestrator_markdown_documents_feedback_loop_steps(self, tmp_path: Path) -> None:
        """Orchestrator markdown must document the feedback loop steps + verdicts."""
        out_dir = tmp_path / "wr2"
        result = self._run_py(
            "from pathlib import Path; "
            "from platxa_agent_generator.multiagent_generator import create_system_from_template, save_system; "
            "sys_ = create_system_from_template('writer-reviewer'); "
            f"save_system(sys_, Path('{out_dir}'))"
        )
        assert result.returncode == 0, result.stderr
        orch = next(Path(out_dir).glob("*coordinator*.md"))
        content = orch.read_text()
        assert "Dispatch Writer" in content
        assert "Capture Artifacts" in content
        assert "Dispatch Reviewer" in content
        assert "Finalize" in content
        assert "APPROVE" in content
        assert "REQUEST_CHANGES" in content

    def test_cli_example_command_supports_writer_reviewer(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "example",
                "writer-reviewer",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        out = result.stdout
        assert "Writer-Reviewer" in out or "writer-reviewer" in out.lower()
        assert "APPROVE" in out

    def test_cli_template_command_produces_files(self, tmp_path: Path) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "template",
                "writer-reviewer",
                "-o",
                str(tmp_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"stderr: {result.stderr}"
        files = list(tmp_path.glob("*"))
        assert len(files) == 4, [p.name for p in files]
        names = {p.name for p in files}
        assert any("writer" in n for n in names)
        assert any("reviewer" in n for n in names)
        assert any(p.suffix == ".json" for p in files)

    def test_templates_listing_includes_writer_reviewer(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS_DIR / "multiagent_generator.py"),
                "templates",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "writer-reviewer" in result.stdout
