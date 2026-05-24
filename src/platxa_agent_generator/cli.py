#!/usr/bin/env python3
"""Platxa Agent Generator CLI.

Production-grade command-line interface for standalone agent generation.

Run ``platxa-agent --help`` (or ``python -m platxa_agent_generator --help``)
for the authoritative, always-current subcommand list. The 19 subcommands
fall into six groups:

    Agent generation (11):
        generate, validate, catalog, install, analyze, analyze-agent,
        upgrade, lint, preview, status, batch
    Observation + instinct pipelines (2):
        observations, instincts
    Eval harness (1):
        eval-run
    Promotion (1):
        evolve
    Health (1):
        health
    Plugin lifecycle (3):
        install-plugin, uninstall-plugin, plugin-status

Keeping the inventory here (instead of per-command one-liners that drift
out of sync with argparse) means the parser remains the single source of
truth. Update the five groups above only when a subcommand is added or
removed; per-command help text lives on each ``add_parser`` call.

Usage examples:
    platxa-agent generate "Create a code review agent that..."
    platxa-agent validate path/to/agent.md
    platxa-agent catalog list
    platxa-agent install agent.md --scope user
    platxa-agent install-plugin --scope user
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, NoReturn

# Import all generator modules
try:
    from . import (
        agent_analyzer,
        agent_catalog,
        agent_generator,
        agent_linter,
        agent_upgrader,
        dry_run,
        eval_runner,
        eval_scenario,
        extended_thinking,
        install_agent,
        instinct_store,
        nlp_parser,
        observation_store,
        plugin_installer,
        progress_tracker,
        promotion_engine,
        quality_scorer,
        security_scanner,
        syntax_validator,
        tool_selector,
        type_classifier,
        weight_drift_check,
        workflow_state,
    )
except ImportError:
    # Standalone execution - type: ignore comments for pyright
    import agent_analyzer  # type: ignore[import-not-found,no-redef]
    import agent_catalog  # type: ignore[import-not-found,no-redef]
    import agent_generator  # type: ignore[import-not-found,no-redef]
    import agent_linter  # type: ignore[import-not-found,no-redef]
    import agent_upgrader  # type: ignore[import-not-found,no-redef]
    import dry_run  # type: ignore[import-not-found,no-redef]
    import eval_runner  # type: ignore[import-not-found,no-redef]
    import eval_scenario  # type: ignore[import-not-found,no-redef]
    import extended_thinking  # type: ignore[import-not-found,no-redef]
    import install_agent  # type: ignore[import-not-found,no-redef]
    import instinct_store  # type: ignore[import-not-found,no-redef]
    import nlp_parser  # type: ignore[import-not-found,no-redef]
    import observation_store  # type: ignore[import-not-found,no-redef]
    import plugin_installer  # type: ignore[import-not-found,no-redef]
    import progress_tracker  # type: ignore[import-not-found,no-redef]
    import promotion_engine  # type: ignore[import-not-found,no-redef]
    import quality_scorer  # type: ignore[import-not-found,no-redef]
    import security_scanner  # type: ignore[import-not-found,no-redef]
    import syntax_validator  # type: ignore[import-not-found,no-redef]
    import tool_selector  # type: ignore[import-not-found,no-redef]
    import type_classifier  # type: ignore[import-not-found,no-redef]
    import weight_drift_check  # type: ignore[import-not-found,no-redef]
    import workflow_state  # type: ignore[import-not-found,no-redef]


__version__ = "0.1.0"


@dataclass(frozen=True)
class _EvalPassRates:
    """Eval history pass/fail counts and rate."""

    total: int
    passed: int
    failed: int
    pass_rate: float


@dataclass(frozen=True)
class _HealthMetrics:
    """Typed container for all five health dashboard metrics."""

    eval_pass_rates: _EvalPassRates
    instinct_count: int
    observation_count: int
    observation_promoted: int
    last_evolve_timestamp: str | None
    weight_drift_detected: bool
    weight_drift_divergences: int

    def to_dict(self) -> dict[str, object]:
        """Serialize to a JSON-safe dict."""
        return {
            "eval_pass_rates": asdict(self.eval_pass_rates),
            "instinct_count": self.instinct_count,
            "observation_count": self.observation_count,
            "observation_promoted": self.observation_promoted,
            "last_evolve_timestamp": self.last_evolve_timestamp,
            "weight_drift": {
                "has_drift": self.weight_drift_detected,
                "divergences": self.weight_drift_divergences,
            },
        }


class CLI:
    """Main CLI application class."""

    def __init__(self) -> None:
        self.parser = self._create_parser()

    def _create_parser(self) -> argparse.ArgumentParser:
        """Create the argument parser with all subcommands."""
        parser = argparse.ArgumentParser(
            prog="platxa-agent",
            description="Platxa Agent Generator - Transform natural language into production-ready AI agents",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  %(prog)s generate "Create an agent that reviews code for security issues"
  %(prog)s generate --interactive
  %(prog)s validate ./agents/code-reviewer.md
  %(prog)s catalog list --category security
  %(prog)s install ./agents/code-reviewer.md --scope project
  %(prog)s analyze "Design a distributed microservices architecture"
            """,
        )

        parser.add_argument(
            "-V",
            "--version",
            action="version",
            version=f"%(prog)s {__version__}",
        )

        parser.add_argument(
            "-v",
            "--verbose",
            action="store_true",
            help="Enable verbose output",
        )

        parser.add_argument(
            "--json",
            action="store_true",
            help="Output results as JSON",
        )

        parser.add_argument(
            "--non-interactive",
            action="store_true",
            help="Non-interactive mode for CI/CD: forces JSON output, "
            "suppresses prompts and progress spinners, uses exit codes "
            "(0=success, 1=failure)",
        )

        subparsers = parser.add_subparsers(
            dest="command",
            title="commands",
            description="Available commands",
            metavar="COMMAND",
        )

        self._add_generate_command(subparsers)
        self._add_validate_command(subparsers)
        self._add_catalog_command(subparsers)
        self._add_install_command(subparsers)
        self._add_analyze_command(subparsers)
        self._add_analyze_agent_command(subparsers)
        self._add_upgrade_command(subparsers)
        self._add_lint_command(subparsers)
        self._add_preview_command(subparsers)
        self._add_status_command(subparsers)
        self._add_batch_command(subparsers)
        self._add_observations_command(subparsers)
        self._add_instincts_command(subparsers)
        self._add_eval_run_command(subparsers)
        self._add_evolve_command(subparsers)
        self._add_health_command(subparsers)
        self._add_install_plugin_command(subparsers)
        self._add_uninstall_plugin_command(subparsers)
        self._add_plugin_status_command(subparsers)

        return parser

    def _add_generate_command(self, subparsers: Any) -> None:
        """Add the generate subcommand."""
        generate = subparsers.add_parser(
            "generate",
            help="Generate an agent from natural language description",
        )
        generate.add_argument("description", nargs="?", help="Agent description")
        generate.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")
        generate.add_argument("-t", "--type", choices=["simple", "orchestrator", "multi-agent"])
        generate.add_argument("-o", "--output", type=Path, help="Output directory")
        generate.add_argument("-n", "--name", help="Agent name")
        generate.add_argument("--tools", nargs="+", help="Tools to include")
        generate.add_argument("--no-validate", action="store_true", help="Skip validation")
        generate.add_argument(
            "--min-quality", type=float, default=7.0, help="Minimum quality score"
        )
        generate.add_argument(
            "--max-iterations",
            type=int,
            default=5,
            help="Max generate-validate-reprompt cycles before ESCALATE (default: 5)",
        )

    def _add_validate_command(self, subparsers: Any) -> None:
        """Add the validate subcommand."""
        validate = subparsers.add_parser("validate", help="Validate agent definition")
        validate.add_argument("path", type=Path, help="Path to agent file")
        validate.add_argument("--syntax-only", action="store_true")
        validate.add_argument("--security-only", action="store_true")
        validate.add_argument("--quality-only", action="store_true")
        validate.add_argument("--min-quality", type=float, default=7.0)

    def _add_catalog_command(self, subparsers: Any) -> None:
        """Add the catalog subcommand."""
        catalog = subparsers.add_parser("catalog", help="Browse agent templates")
        catalog_sub = catalog.add_subparsers(dest="catalog_action", metavar="ACTION")

        list_cmd = catalog_sub.add_parser("list", help="List templates")
        list_cmd.add_argument("-c", "--category", help="Filter by category")

        show_cmd = catalog_sub.add_parser("show", help="Show template details")
        show_cmd.add_argument("template_id", help="Template ID")

        use_cmd = catalog_sub.add_parser("use", help="Use template")
        use_cmd.add_argument("template_id", help="Template ID")
        use_cmd.add_argument("-o", "--output", type=Path)

    def _add_install_command(self, subparsers: Any) -> None:
        """Add the install subcommand."""
        install = subparsers.add_parser("install", help="Install agent")
        install.add_argument("path", type=Path, help="Agent file path")
        install.add_argument("-s", "--scope", choices=["user", "project"], default="project")
        install.add_argument("--force", action="store_true")
        install.add_argument("--no-validate", action="store_true")

    def _add_analyze_command(self, subparsers: Any) -> None:
        """Add the analyze subcommand."""
        analyze = subparsers.add_parser("analyze", help="Analyze task complexity")
        analyze.add_argument("task", help="Task description")
        analyze.add_argument("--context", type=str, default="{}", help="JSON context")

    def _add_analyze_agent_command(self, subparsers: Any) -> None:
        """Add the analyze-agent subcommand.

        Distinct from ``analyze`` (which assesses task complexity for
        extended-thinking purposes). ``analyze-agent`` reads an existing
        agent file and produces missing-field, security, and context
        improvement recommendations via :mod:`agent_analyzer`.
        """
        analyze_agent = subparsers.add_parser(
            "analyze-agent",
            help="Analyze an existing agent file and surface improvements",
        )
        analyze_agent.add_argument(
            "path",
            type=Path,
            help="Path to the agent .md file",
        )

    def _add_upgrade_command(self, subparsers: Any) -> None:
        """Add the upgrade subcommand.

        Wraps :mod:`agent_upgrader` so users can upgrade an existing
        agent file to the latest format. Default is a dry-run that
        prints the planned changes; ``--apply`` writes them back
        (after creating a timestamped backup).
        """
        upgrade = subparsers.add_parser(
            "upgrade",
            help="Upgrade an existing agent to the latest format",
        )
        upgrade.add_argument("path", type=Path, help="Path to the agent .md file")
        upgrade.add_argument(
            "--apply",
            action="store_true",
            help="Write changes back to the file (dry-run is the default)",
        )

    def _add_lint_command(self, subparsers: Any) -> None:
        """Add the lint subcommand.

        Quick pre-commit-friendly structural check. Wraps
        :func:`agent_linter.lint_paths` and exits with :data:`LINT_EXIT_OK`
        (0) when every file is clean or :data:`LINT_EXIT_ERRORS` (1)
        when any file has at least one error-severity finding.
        """
        lint = subparsers.add_parser(
            "lint",
            help="Fast structural lint for agent definition files",
        )
        lint.add_argument(
            "paths",
            nargs="+",
            type=Path,
            help="One or more agent .md files to lint",
        )

    def _add_preview_command(self, subparsers: Any) -> None:
        """Add the preview subcommand."""
        preview = subparsers.add_parser("preview", help="Preview generation")
        preview.add_argument("description", help="Agent description")
        preview.add_argument("-t", "--type", choices=["simple", "orchestrator", "multi-agent"])
        preview.add_argument("--full", action="store_true", help="Show full content")

    def _add_status_command(self, subparsers: Any) -> None:
        """Add the status subcommand."""
        status = subparsers.add_parser("status", help="Show progress")
        status.add_argument("--compact", action="store_true")

    def _add_batch_command(self, subparsers: Any) -> None:
        """Add the batch subcommand for unattended ecosystem generation.

        The batch command runs in offline/unattended contexts (CI,
        scheduled orchestrators) where the generator's capabilities
        must be bounded ahead of time. Flags mirror BatchPolicy:

        - ``--allowedTools`` restricts which tools each generated agent
          may declare (repeatable/nargs="+").
        - ``--offline`` strips network tools (WebSearch/WebFetch) from
          every agent and prevents the generator itself from relying on
          them.
        - ``--output-scope`` enforces a filesystem prefix for all
          writes; default ``.claude`` satisfies the verification
          criterion "Write restricted to .claude/ paths".
        """
        batch = subparsers.add_parser(
            "batch",
            help="Generate an agent ecosystem from a JSON batch spec",
        )
        batch.add_argument(
            "spec_path",
            type=Path,
            help="Path to a batch-spec JSON file",
        )
        batch.add_argument(
            "-o",
            "--output",
            type=Path,
            default=None,
            help="Output directory (default: .claude/agents)",
        )
        batch.add_argument(
            "--allowedTools",
            dest="allowed_tools",
            nargs="+",
            default=None,
            help="Allowlist of tool names each generated agent may declare. "
            "Empty/omitted disables allowlist enforcement.",
        )
        batch.add_argument(
            "--offline",
            action="store_true",
            help="Strip WebSearch/WebFetch from every generated agent",
        )
        batch.add_argument(
            "--output-scope",
            dest="output_scope",
            default=None,
            help="Filesystem prefix the output directory must resolve "
            "inside (default: .claude). Unattended runs should leave "
            "this at the default; tests may override.",
        )

    def run(self, args: list[str] | None = None) -> int:
        """Run the CLI with given arguments."""
        parsed = self.parser.parse_args(args)

        # --non-interactive forces JSON output and disables interactive mode
        if getattr(parsed, "non_interactive", False):
            parsed.json = True
            if hasattr(parsed, "interactive"):
                parsed.interactive = False

        if not parsed.command:
            if getattr(parsed, "non_interactive", False):
                print(json.dumps({"error": "No command specified"}, indent=2))
                return 1
            self.parser.print_help()
            return 0

        handlers = {
            "generate": self._handle_generate,
            "validate": self._handle_validate,
            "catalog": self._handle_catalog,
            "install": self._handle_install,
            "analyze": self._handle_analyze,
            "analyze-agent": self._handle_analyze_agent,
            "upgrade": self._handle_upgrade,
            "lint": self._handle_lint,
            "preview": self._handle_preview,
            "status": self._handle_status,
            "batch": self._handle_batch,
            "observations": self._handle_observations,
            "instincts": self._handle_instincts,
            "eval-run": self._handle_eval_run,
            "evolve": self._handle_evolve,
            "health": self._handle_health,
            "install-plugin": self._handle_install_plugin,
            "uninstall-plugin": self._handle_uninstall_plugin,
            "plugin-status": self._handle_plugin_status,
        }

        handler = handlers.get(parsed.command)
        if handler:
            return handler(parsed)

        self.parser.print_help()
        return 1

    def _handle_generate(self, args: argparse.Namespace) -> int:
        """Handle the generate command."""
        non_interactive = getattr(args, "non_interactive", False)

        if not args.description and non_interactive:
            print(json.dumps({"error": "Description required in non-interactive mode"}, indent=2))
            return 1

        if args.interactive or (not args.description and not non_interactive):
            return self._generate_interactive(args)
        return self._generate_from_description(args)

    def _generate_interactive(self, args: argparse.Namespace) -> int:
        """Run interactive generation mode."""
        print("\n" + "=" * 60)
        print("  Platxa Agent Generator - Interactive Mode")
        print("=" * 60 + "\n")

        try:
            if args.description:
                description = args.description
            else:
                print("Describe the agent you want to create:\n")
                description = input("> ").strip()

            if not description:
                print("Error: Description is required")
                return 1

            print("\nAnalyzing description...")
            parsed = nlp_parser.parse(description)
            classification = type_classifier.classify(description)

            print(f"  Detected type: {classification.architecture_type}")
            print(f"  Extracted name: {parsed.name}")

            print("\nProceed with generation? [Y/n]: ", end="")
            confirm = input().strip().lower()
            if confirm == "n":
                print("Cancelled.")
                return 0

            args.description = description
            return self._generate_from_description(args)

        except KeyboardInterrupt:
            print("\n\nCancelled.")
            return 130

    def _generate_from_description(self, args: argparse.Namespace) -> int:
        """Generate agent from description with iteration-aware retry loop."""
        description: str = args.description

        if not description:
            print("Error: Description is required")
            return 1

        max_iterations: int = getattr(args, "max_iterations", 5)
        if max_iterations < 1:
            print("Error: --max-iterations must be >= 1")
            return 1

        tracker = progress_tracker.ProgressTracker()
        tracker.start(f"Generating agent: {description[:40]}...")

        quality_score: float = 0.0

        try:
            # Phase 1: Discovery
            tracker.update_phase("discovery", 0, "Parsing description")
            parsed = nlp_parser.parse(description)
            tracker.update_phase("discovery", 50, "Classifying agent type")

            classification = type_classifier.classify(description)
            agent_type_str = args.type or classification.architecture_type
            tracker.update_phase("discovery", 100)

            # Phase 2: Architecture
            tracker.update_phase("architecture", 0, "Selecting tools")
            if args.tools:
                tool_list = args.tools
            else:
                tool_selection = tool_selector.select_tools(
                    agent_type=parsed.agent_type,
                    purpose=parsed.description,
                )
                tool_list = tool_selection.tools
            tracker.update_phase("architecture", 100)

            # Phase 3: Generation with iteration-aware retry loop
            agent_name = args.name or parsed.name
            state = workflow_state.WorkflowState(
                workflow_id=f"cli-generate-{agent_name}",
                agent_name=agent_name,
                agent_description=parsed.description,
                max_iterations=max_iterations,
            )

            agent_content = ""
            reprompt_context = ""

            for iteration in range(max_iterations):
                tracker.update_phase(
                    "generation",
                    0,
                    f"Creating agent definition (iteration {iteration + 1}/{max_iterations})",
                )

                success, agent_content, error_msg = agent_generator.generate(
                    name=agent_name,
                    description=parsed.description,
                    tools=tool_list,
                    context_hint=reprompt_context,
                )

                if not success:
                    tracker.fail(f"Generation failed: {error_msg}")
                    print(f"Error: {error_msg}")
                    return 1

                tracker.update_phase("generation", 100)

                # Skip validation if requested
                if args.no_validate:
                    break

                # Validate
                tracker.update_phase(
                    "validation",
                    0,
                    f"Validating (iteration {iteration + 1}/{max_iterations})",
                )
                syntax_validator.validate_content(agent_content)
                tracker.update_phase("validation", 33, "Scanning security")

                security_scanner.scan_content(agent_content)
                tracker.update_phase("validation", 66, "Scoring quality")

                quality_result = quality_scorer.score_quality(agent_content)
                quality_score = quality_result.total_score
                tracker.update_phase("validation", 100)

                if quality_score >= args.min_quality:
                    break

                # Quality below threshold — build reprompt context for next iteration
                state.retry_count = iteration + 1
                reprompt_context = agent_generator.build_validation_failure_context(
                    quality_result, min_score=args.min_quality
                )

                if iteration + 1 >= max_iterations:
                    # Exhausted all iterations — ESCALATE
                    return self._escalate_verdict(
                        args,
                        tracker,
                        state,
                        quality_score,
                        agent_name,
                        agent_type_str,
                    )

                tracker.update_phase(
                    "generation",
                    0,
                    f"Score {quality_score:.1f} < {args.min_quality} — retrying with targeted reprompt",
                )

            # Phase 5: Write output
            output_dir = args.output or Path.cwd() / ".claude" / "agents"
            tracker.update_phase("installation", 0, "Writing files")

            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{agent_name}.md"
            output_path.write_text(agent_content, encoding="utf-8")
            tracker.update_phase("installation", 100)

            tracker.complete()

            if hasattr(args, "json") and args.json:
                result: dict[str, Any] = {
                    "success": True,
                    "output_path": str(output_path),
                    "agent_name": agent_name,
                    "agent_type": agent_type_str,
                    "tools": tool_list,
                    "iterations_used": state.retry_count + 1,
                    "max_iterations": max_iterations,
                }
                if not args.no_validate:
                    result["quality_score"] = quality_score
                print(json.dumps(result, indent=2))
            else:
                print(tracker.render())
                print("\nAgent generated successfully!")
                print(f"Output: {output_path}")
                if state.retry_count > 0:
                    print(f"Iterations used: {state.retry_count + 1}/{max_iterations}")

            return 0

        except Exception as e:
            tracker.fail(str(e))
            print(f"Error: {e}")
            return 1

    def _escalate_verdict(
        self,
        args: argparse.Namespace,
        tracker: progress_tracker.ProgressTracker,
        state: workflow_state.WorkflowState,
        quality_score: float,
        agent_name: str,
        agent_type_str: str,
    ) -> int:
        """Emit ESCALATE verdict when max iterations exhausted."""
        tracker.fail(
            f"ESCALATE: {state.max_iterations} iterations exhausted; "
            f"best score {quality_score:.1f} < {args.min_quality}"
        )

        if hasattr(args, "json") and args.json:
            result = {
                "success": False,
                "verdict": "ESCALATE",
                "agent_name": agent_name,
                "agent_type": agent_type_str,
                "iterations_used": state.max_iterations,
                "max_iterations": state.max_iterations,
                "best_quality_score": quality_score,
                "min_quality_required": args.min_quality,
                "message": (
                    f"Quality score {quality_score:.1f} remained below "
                    f"{args.min_quality} after {state.max_iterations} iterations"
                ),
            }
            print(json.dumps(result, indent=2))
        else:
            print(tracker.render())
            print(
                f"\nESCALATE: Quality score {quality_score:.1f} < {args.min_quality} "
                f"after {state.max_iterations} iterations."
            )
            print("Manual intervention required.")

        return 1

    def _handle_validate(self, args: argparse.Namespace) -> int:
        """Handle the validate command."""
        if not args.path.exists():
            if hasattr(args, "json") and args.json:
                print(json.dumps({"error": f"File not found: {args.path}"}, indent=2))
            else:
                print(f"Error: File not found: {args.path}")
            return 1

        content = args.path.read_text(encoding="utf-8")
        results: dict[str, Any] = {"path": str(args.path), "passed": True}
        exit_code = 0

        json_mode = hasattr(args, "json") and args.json

        # Syntax validation
        if not args.security_only and not args.quality_only:
            if not json_mode:
                print("Checking syntax...")
            syntax_result = syntax_validator.validate_content(content)
            results["syntax"] = {
                "passed": syntax_result.passed,
                "errors": [str(e) for e in syntax_result.errors],
            }
            if not syntax_result.passed:
                results["passed"] = False
                exit_code = 1

        # Security scan
        if not args.syntax_only and not args.quality_only:
            if not json_mode:
                print("Scanning security...")
            security_result = security_scanner.scan_content(content)
            results["security"] = {
                "score": security_result.score,
                "findings": len(security_result.findings),
                "passed": security_result.passed,
            }
            if not security_result.passed:
                results["passed"] = False
                exit_code = 1

        # Quality scoring
        if not args.syntax_only and not args.security_only:
            if not json_mode:
                print("Scoring quality...")
            quality_result = quality_scorer.score_quality(content)
            results["quality"] = {
                "score": quality_result.total_score,
                "grade": quality_result.grade,
                "passed": quality_result.passed,
            }
            if quality_result.total_score < args.min_quality:
                results["passed"] = False
                exit_code = 1

        if hasattr(args, "json") and args.json:
            print(json.dumps(results, indent=2))
        else:
            print("\n" + "=" * 40)
            print("Validation Results")
            print("=" * 40)

            if "syntax" in results:
                status = "✓ Valid" if results["syntax"]["passed"] else "✗ Invalid"
                print(f"Syntax: {status}")

            if "security" in results:
                findings = results["security"]["findings"]
                status = "✓ Clean" if findings == 0 else f"✗ {findings} issues"
                print(f"Security: {status} (score: {results['security']['score']})")

            if "quality" in results:
                score = results["quality"]["score"]
                status = "✓" if score >= args.min_quality else "✗"
                print(f"Quality: {status} {score:.1f}/10 ({results['quality']['grade']})")

            print("\n" + ("✓ PASSED" if results["passed"] else "✗ FAILED"))

        return exit_code

    def _handle_catalog(self, args: argparse.Namespace) -> int:
        """Handle the catalog command."""
        if args.catalog_action == "list":
            templates = agent_catalog.list_agents(category=args.category)

            if hasattr(args, "json") and args.json:
                print(json.dumps([agent_catalog.template_to_dict(t) for t in templates], indent=2))
            else:
                print("\n" + "=" * 60)
                print("Agent Template Catalog")
                print("=" * 60 + "\n")

                for template in templates:
                    print(f"  [{template.category}] {template.name}")
                    desc = (
                        template.description[:60]
                        if len(template.description) > 60
                        else template.description
                    )
                    print(f"      {desc}...")
                    print()

        elif args.catalog_action == "show":
            template = agent_catalog.get_agent(args.template_id)
            if not template:
                print(f"Error: Template not found: {args.template_id}")
                return 1

            if hasattr(args, "json") and args.json:
                print(json.dumps(agent_catalog.template_to_dict(template), indent=2))
            else:
                print(f"\n{template.name}")
                print("=" * len(template.name))
                print(f"\nCategory: {template.category}")
                print(f"Version: {template.version}")
                print(f"Pattern: {template.pattern}")
                print(f"\nDescription:\n  {template.description}")
                print(f"\nTools: {', '.join(template.tools)}")

        elif args.catalog_action == "use":
            # install_from_catalog returns (success, message, path)
            success, message, path = agent_catalog.install_from_catalog(
                args.template_id,
                scope="user",
            )

            if success:
                print(f"Agent generated from template: {path}")
            else:
                print(f"Error: {message}")
                return 1

        else:
            print("Usage: platxa-agent catalog {list|show|use}")
            return 1

        return 0

    def _handle_install(self, args: argparse.Namespace) -> int:
        """Handle the install command."""
        if not args.path.exists():
            print(f"Error: File not found: {args.path}")
            return 1

        # Validate first unless skipped
        if not args.no_validate:
            content = args.path.read_text(encoding="utf-8")
            syntax_result = syntax_validator.validate_content(content)

            if not syntax_result.passed:
                print("Error: Agent definition has syntax errors")
                for error in syntax_result.errors:
                    print(f"  - {error}")
                return 1

        # Install agent
        result = install_agent.install_agent(
            args.path,
            scope=args.scope,
            force=args.force,
        )

        if result.success:
            print(f"Agent installed to {args.scope} scope")
            print(f"Location: {result.installed_path}")
            return 0
        else:
            print(f"Error: {result.message or 'Installation failed'}")
            return 1

    def _handle_analyze(self, args: argparse.Namespace) -> int:
        """Handle the analyze command."""
        context = json.loads(args.context)
        integration = extended_thinking.ThinkingIntegration()
        recommendation = integration.analyze_complexity(args.task, context)

        if hasattr(args, "json") and args.json:
            print(json.dumps(recommendation.to_dict(), indent=2))
        else:
            print("\n" + "=" * 60)
            print("Complexity Analysis")
            print("=" * 60 + "\n")

            task_preview = args.task[:70] if len(args.task) > 70 else args.task
            print(f"Task: {task_preview}...")
            print(f"\nOverall Complexity: {recommendation.overall_complexity:.2f}")
            print(f"Use Extended Thinking: {recommendation.should_use_extended_thinking}")
            print(f"Recommended Intensity: {recommendation.intensity.trigger_phrase}")
            print(f"\nRationale: {recommendation.rationale}")
            print(f"\nBenefit: {recommendation.estimated_benefit}")

        return 0

    def _handle_analyze_agent(self, args: argparse.Namespace) -> int:
        """Handle the analyze-agent command.

        Reads the agent file, runs the full validation pipeline via
        ``agent_analyzer.analyze_agent`` and prints either a JSON
        serialization or the human-readable report. Exits non-zero only
        when the file is missing — a finding-laden report is still a
        successful invocation.
        """
        json_mode = bool(getattr(args, "json", False))
        try:
            analysis = agent_analyzer.analyze_agent(args.path)
        except FileNotFoundError as exc:
            if json_mode:
                print(json.dumps({"error": str(exc)}, indent=2))
            else:
                print(f"Error: {exc}")
            return 1

        if json_mode:
            print(json.dumps(analysis.to_dict(), indent=2))
        else:
            print(agent_analyzer.format_analysis_report(analysis))
        return 0

    def _handle_lint(self, args: argparse.Namespace) -> int:
        """Handle the lint command.

        Runs :func:`agent_linter.lint_paths` over the supplied files and
        prints one report per file. Exit code is :data:`LINT_EXIT_OK`
        (0) when all files pass and :data:`LINT_EXIT_ERRORS` (1) when
        any file has at least one error-severity finding — matching the
        contract pre-commit hooks expect.

        ``--json`` switches to a machine-readable report (one JSON
        object per file, plus a summary entry) so CI pipelines can parse
        results without scraping text.
        """
        json_mode = bool(getattr(args, "json", False))
        reports = agent_linter.lint_paths(list(args.paths))

        if json_mode:
            payload = {
                "reports": [
                    {
                        "path": r.path,
                        "passed": r.passed,
                        "findings": [
                            {"line": f.line, "code": f.code, "message": f.message}
                            for f in r.findings
                        ],
                    }
                    for r in reports
                ],
                "summary": {
                    "total": len(reports),
                    "passed": sum(1 for r in reports if r.passed),
                    "failed": sum(1 for r in reports if not r.passed),
                },
            }
            print(json.dumps(payload, indent=2))
        else:
            for report in reports:
                print(agent_linter.format_lint_report(report))

        return (
            agent_linter.LINT_EXIT_OK
            if all(r.passed for r in reports)
            else agent_linter.LINT_EXIT_ERRORS
        )

    def _handle_upgrade(self, args: argparse.Namespace) -> int:
        """Handle the upgrade command.

        Reads the agent file, runs the additive upgrade, and prints
        either the JSON serialization or the human-readable report.
        Exit code is 1 only on FileNotFoundError — a no-op upgrade
        (file already current) is still success.
        """
        json_mode = bool(getattr(args, "json", False))
        try:
            result = agent_upgrader.upgrade_agent(args.path, apply=args.apply)
        except FileNotFoundError as exc:
            if json_mode:
                print(json.dumps({"error": str(exc)}, indent=2))
            else:
                print(f"Error: {exc}")
            return 1

        if json_mode:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print(agent_upgrader.format_upgrade_report(result))
        return 0

    def _handle_preview(self, args: argparse.Namespace) -> int:
        """Handle the preview command."""
        # Parse description to get agent details
        parsed = nlp_parser.parse(args.description)

        # dry_run requires name, description, tools
        result = dry_run.dry_run(
            name=parsed.name,
            description=parsed.description,
            tools=parsed.tools or ["Read", "Write"],
            pattern=args.type or "prompt-chaining",
        )

        if hasattr(args, "json") and args.json:
            print(json.dumps(dry_run.result_to_dict(result), indent=2))
        else:
            print("\n" + "=" * 60)
            print("Generation Preview")
            print("=" * 60 + "\n")

            print(f"Would create {len(result.files)} file(s):")
            for file_preview in result.files:
                print(f"\n  {file_preview.path}")
                print(f"    Size: {dry_run.format_file_size(file_preview.size_bytes)}")
                if args.full:
                    content_preview = file_preview.content[:500]
                    print(f"    Content preview:\n{content_preview}...")

            print(f"\nTotal size: {dry_run.format_file_size(result.total_size)}")

        return 0

    def _handle_status(self, args: argparse.Namespace) -> int:
        """Handle the status command."""
        tracker = progress_tracker.ProgressTracker()

        if tracker.load_state():
            if hasattr(args, "json") and args.json:
                print(tracker.render_json())
            else:
                print(tracker.render(compact=args.compact))
        else:
            print("No active generation in progress.")

        return 0

    def _handle_batch(self, args: argparse.Namespace) -> int:
        """Handle the batch subcommand.

        Loads the JSON spec, builds a BatchPolicy from the CLI flags
        (only populating fields the user supplied — this keeps the
        policy-free default path available for callers that don't
        care about scoping), and returns 0 iff
        :func:`batch_generator.generate_batch` reports full success.

        Output format follows the CLI's existing convention: JSON when
        ``--json`` / ``--non-interactive`` is set, otherwise a compact
        human-readable summary with the per-agent warnings/errors.
        """
        try:
            from . import batch_generator as bg
        except ImportError:
            import batch_generator as bg  # type: ignore[import-not-found,no-redef]

        try:
            spec = bg.load_batch_spec(args.spec_path)
        except (FileNotFoundError, ValueError) as exc:
            msg = str(exc)
            if getattr(args, "json", False):
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        policy_kwargs: dict[str, Any] = {}
        if args.allowed_tools is not None:
            policy_kwargs["allowed_tools"] = list(args.allowed_tools)
        if args.offline:
            policy_kwargs["offline"] = True
        if args.output_scope is not None:
            policy_kwargs["output_scope"] = args.output_scope
        policy = bg.BatchPolicy(**policy_kwargs) if policy_kwargs else None

        output_dir = args.output or Path(bg.DEFAULT_BATCH_OUTPUT_DIR)
        result = bg.generate_batch(spec, output_dir, policy=policy)

        if getattr(args, "json", False):
            payload = {
                "ecosystem": result.ecosystem,
                "success": result.success,
                "cross_validation_errors": result.cross_validation_errors,
                "agents": [
                    {
                        "name": a.name,
                        "success": a.success,
                        "output_path": a.output_path,
                        "errors": a.errors,
                        "warnings": a.warnings,
                    }
                    for a in result.agents
                ],
            }
            print(json.dumps(payload, indent=2))
        else:
            status = "OK" if result.success else "FAILED"
            print(f"Batch '{result.ecosystem}': {status}")
            for err in result.cross_validation_errors:
                print(f"  ! {err}")
            for agent in result.agents:
                flag = "+" if agent.success else "-"
                print(f"  {flag} {agent.name} → {agent.output_path or '(not written)'}")
                for warning in agent.warnings:
                    print(f"      warning: {warning}")
                for err in agent.errors:
                    print(f"      error: {err}")
        return 0 if result.success else 1

    def _add_observations_command(self, subparsers: Any) -> None:
        """Add the observations subcommand with list|show|stats|migrate actions."""
        obs = subparsers.add_parser(
            "observations",
            help="Inspect and migrate the observation store",
        )
        obs_sub = obs.add_subparsers(dest="obs_action", metavar="ACTION")

        list_cmd = obs_sub.add_parser("list", help="List observation records")
        list_cmd.add_argument(
            "-n",
            "--limit",
            type=int,
            default=20,
            help="Maximum records to display (default: 20)",
        )
        list_cmd.add_argument("--type", dest="obs_type", help="Filter by observation type")
        list_cmd.add_argument("--tool", help="Filter by tool name")
        list_cmd.add_argument("--agent", help="Filter by agent name")
        list_cmd.add_argument(
            "-f",
            "--file",
            type=Path,
            dest="obs_file",
            help="Path to observations JSONL file (default: .claude/observations.jsonl)",
        )

        show_cmd = obs_sub.add_parser("show", help="Show a single observation by index")
        show_cmd.add_argument("index", type=int, help="Zero-based record index")
        show_cmd.add_argument(
            "-f",
            "--file",
            type=Path,
            dest="obs_file",
            help="Path to observations JSONL file",
        )

        stats_cmd = obs_sub.add_parser("stats", help="Show aggregate statistics")
        stats_cmd.add_argument(
            "-f",
            "--file",
            type=Path,
            dest="obs_file",
            help="Path to observations JSONL file",
        )

        migrate_cmd = obs_sub.add_parser(
            "migrate",
            help="Upgrade old 5-field rows to the full schema (idempotent)",
        )
        migrate_cmd.add_argument(
            "-f",
            "--file",
            type=Path,
            dest="obs_file",
            help="Path to observations JSONL file",
        )

    def _handle_observations(self, args: argparse.Namespace) -> int:
        """Handle the observations subcommand."""
        json_mode = bool(getattr(args, "json", False))
        obs_file: Path | None = getattr(args, "obs_file", None)
        store = observation_store.ObservationStore(path=obs_file)

        if args.obs_action == "list":
            return self._handle_observations_list(args, store, json_mode)
        if args.obs_action == "show":
            return self._handle_observations_show(args, store, json_mode)
        if args.obs_action == "stats":
            return self._handle_observations_stats(store, json_mode)
        if args.obs_action == "migrate":
            return self._handle_observations_migrate(store, json_mode)

        if json_mode:
            print(
                json.dumps({"error": "Usage: platxa-agent observations {list|show|stats|migrate}"})
            )
        else:
            print("Usage: platxa-agent observations {list|show|stats|migrate}")
        return 1

    def _handle_observations_list(
        self,
        args: argparse.Namespace,
        store: "observation_store.ObservationStore",
        json_mode: bool,
    ) -> int:
        """List observation records with optional filters."""
        from dataclasses import asdict

        records = store.read_all()

        obs_type: str | None = getattr(args, "obs_type", None)
        tool_filter: str | None = getattr(args, "tool", None)
        agent_filter: str | None = getattr(args, "agent", None)

        if obs_type:
            records = [r for r in records if r.type == obs_type]
        if tool_filter:
            records = [r for r in records if r.tool == tool_filter]
        if agent_filter:
            records = [r for r in records if r.agent_name == agent_filter]

        total = len(records)
        limit: int = getattr(args, "limit", 20)
        records = records[:limit]

        if json_mode:
            print(
                json.dumps(
                    {
                        "total": total,
                        "returned": len(records),
                        "records": [asdict(r) for r in records],
                    },
                    indent=2,
                )
            )
        else:
            print(f"Observations: {total} total, showing {len(records)}")
            print("-" * 60)
            for i, r in enumerate(records):
                agent = r.agent_name or "(unknown)"
                print(f"  [{i}] {r.timestamp}  {r.type:<12} {r.tool:<12} {agent}")
            if total > limit:
                print(f"  ... {total - limit} more (use --limit to see more)")

        return 0

    def _handle_observations_show(
        self,
        args: argparse.Namespace,
        store: "observation_store.ObservationStore",
        json_mode: bool,
    ) -> int:
        """Show a single observation record by index."""
        from dataclasses import asdict

        records = store.read_all()
        idx: int = args.index

        if not records:
            msg = "No observations found"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        if idx < 0 or idx >= len(records):
            msg = f"Index {idx} out of range (0..{len(records) - 1})"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        record = records[idx]

        if json_mode:
            print(json.dumps(asdict(record), indent=2))
        else:
            print(f"Observation #{idx}")
            print("=" * 40)
            print(f"  Timestamp:    {record.timestamp}")
            print(f"  Type:         {record.type}")
            print(f"  Tool:         {record.tool}")
            print(f"  Agent:        {record.agent_name or '(unknown)'}")
            print(f"  Session:      {record.session_id or '(none)'}")
            print(f"  Project:      {record.project_name} ({record.project_id})")
            print(f"  Summary:      {record.input_summary}")
            if record.evidence:
                print(f"  Evidence:     {record.evidence}")
            if record.outcome:
                print(f"  Outcome:      {record.outcome}")
            print(f"  Confidence:   {record.confidence}")
            if record.examples:
                print(f"  Examples:     {', '.join(record.examples)}")
            if record.promoted_to:
                print(f"  Promoted to:  {record.promoted_to}")

        return 0

    def _handle_observations_stats(
        self,
        store: "observation_store.ObservationStore",
        json_mode: bool,
    ) -> int:
        """Show aggregate statistics."""
        result = store.stats()

        if json_mode:
            print(json.dumps(result, indent=2))
        else:
            total = result["total"]["count"]
            promoted = result["promoted"]["count"]
            print(f"Observation Statistics ({total} records)")
            print("=" * 40)
            print(f"  Promoted: {promoted}")
            print()
            print("  By type:")
            for k, v in result["by_type"].items():
                print(f"    {k:<16} {v}")
            print()
            print("  By tool:")
            for k, v in result["by_tool"].items():
                print(f"    {k:<16} {v}")
            print()
            print("  By agent:")
            for k, v in result["by_agent"].items():
                print(f"    {k:<16} {v}")

        return 0

    def _handle_observations_migrate(
        self,
        store: "observation_store.ObservationStore",
        json_mode: bool,
    ) -> int:
        """Migrate old rows to the full schema with backup."""
        result = store.migrate()

        if json_mode:
            print(json.dumps(result, indent=2))
        else:
            migrated = result["migrated"]
            total = result["total"]
            if migrated:
                print(f"Migrated {migrated}/{total} observation(s) to the current schema.")
                print(f"  Backup: {result['backup_path']}")
                print(f"  Output: {result['output_path']}")
            elif total:
                print(f"All {total} observations already up to date.")
                print(f"  Backup: {result['backup_path']}")
                print(f"  Output: {result['output_path']}")
            else:
                print("No observations file found.")

        return 0

    # --- instincts subcommand ------------------------------------------------

    def _add_instincts_command(self, subparsers: Any) -> None:
        """Add the instincts subcommand with list|show|prune|stats actions."""
        inst = subparsers.add_parser(
            "instincts",
            help="Inspect, prune, and aggregate learned instincts",
        )
        inst_sub = inst.add_subparsers(dest="inst_action", metavar="ACTION")

        list_cmd = inst_sub.add_parser("list", help="List instinct entries")
        list_cmd.add_argument(
            "-n",
            "--limit",
            type=int,
            default=20,
            help="Maximum entries to display (default: 20)",
        )
        list_cmd.add_argument(
            "--project",
            dest="inst_project",
            help="Filter by project scope (exact match on scope field)",
        )
        list_cmd.add_argument(
            "--type",
            dest="inst_type",
            help="Filter by instinct type",
        )
        list_cmd.add_argument(
            "--root",
            type=Path,
            dest="inst_root",
            help="Path to instinct store root (default: ~/.claude/instincts)",
        )

        show_cmd = inst_sub.add_parser("show", help="Show a single instinct by name")
        show_cmd.add_argument("name", help="Instinct name")
        show_cmd.add_argument(
            "--root",
            type=Path,
            dest="inst_root",
            help="Path to instinct store root",
        )

        prune_cmd = inst_sub.add_parser(
            "prune",
            help="Remove expired instincts (last_seen > TTL and usage_count == 0)",
        )
        prune_cmd.add_argument(
            "--ttl-days",
            type=int,
            default=instinct_store.DEFAULT_TTL_DAYS,
            help=f"Days since last_seen before eligible for pruning (default: {instinct_store.DEFAULT_TTL_DAYS})",
        )
        prune_cmd.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be pruned without deleting",
        )
        prune_cmd.add_argument(
            "--project",
            dest="inst_project",
            help="Only prune instincts in this project scope",
        )
        prune_cmd.add_argument(
            "--type",
            dest="inst_type",
            help="Only prune instincts of this type",
        )
        prune_cmd.add_argument(
            "--root",
            type=Path,
            dest="inst_root",
            help="Path to instinct store root",
        )

        stats_cmd = inst_sub.add_parser("stats", help="Show aggregate statistics")
        stats_cmd.add_argument(
            "--root",
            type=Path,
            dest="inst_root",
            help="Path to instinct store root",
        )

    def _handle_instincts(self, args: argparse.Namespace) -> int:
        """Handle the instincts subcommand."""
        json_mode = bool(getattr(args, "json", False))
        inst_root: Path | None = getattr(args, "inst_root", None)
        store = instinct_store.InstinctStore(root=inst_root)

        if args.inst_action == "list":
            return self._handle_instincts_list(args, store, json_mode)
        if args.inst_action == "show":
            return self._handle_instincts_show(args, store, json_mode)
        if args.inst_action == "prune":
            return self._handle_instincts_prune(args, store, json_mode)
        if args.inst_action == "stats":
            return self._handle_instincts_stats(store, json_mode)

        if json_mode:
            print(json.dumps({"error": "Usage: platxa-agent instincts {list|show|prune|stats}"}))
        else:
            print("Usage: platxa-agent instincts {list|show|prune|stats}")
        return 1

    def _handle_instincts_list(
        self,
        args: argparse.Namespace,
        store: "instinct_store.InstinctStore",
        json_mode: bool,
    ) -> int:
        """List instinct entries with optional --project and --type filters."""
        from dataclasses import asdict

        entries = store.list_entries()

        project_filter: str | None = getattr(args, "inst_project", None)
        type_filter: str | None = getattr(args, "inst_type", None)

        if project_filter:
            entries = [e for e in entries if e.scope == project_filter]
        if type_filter:
            entries = [e for e in entries if e.type == type_filter]

        total = len(entries)
        limit: int = getattr(args, "limit", 20)
        entries = entries[:limit]

        if json_mode:
            print(
                json.dumps(
                    {
                        "total": total,
                        "returned": len(entries),
                        "entries": [asdict(e) for e in entries],
                    },
                    indent=2,
                )
            )
        else:
            print(f"Instincts: {total} total, showing {len(entries)}")
            print("-" * 60)
            for e in entries:
                print(f"  {e.name:<24} {e.type:<16} {e.scope:<16} {e.size}B")
            if total > limit:
                print(f"  ... {total - limit} more (use --limit to see more)")

        return 0

    def _handle_instincts_show(
        self,
        args: argparse.Namespace,
        store: "instinct_store.InstinctStore",
        json_mode: bool,
    ) -> int:
        """Show a single instinct by name."""
        name: str = args.name
        entry = store.get_entry(name)

        if entry is None:
            msg = f"Instinct {name!r} not found"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        content = store.get(name)

        if json_mode:
            from dataclasses import asdict

            payload = asdict(entry)
            payload["content"] = content
            print(json.dumps(payload, indent=2))
        else:
            print(f"Instinct: {entry.name}")
            print("=" * 40)
            print(f"  Type:       {entry.type}")
            print(f"  Scope:      {entry.scope}")
            print(f"  Size:       {entry.size}B")
            print(f"  Checksum:   {entry.checksum[:16]}...")
            print(f"  Created:    {entry.created or '(unknown)'}")
            print(f"  Last seen:  {entry.last_seen or '(unknown)'}")
            if content:
                print(f"\n--- Content ---\n{content}")

        return 0

    def _handle_instincts_prune(
        self,
        args: argparse.Namespace,
        store: "instinct_store.InstinctStore",
        json_mode: bool,
    ) -> int:
        """Prune expired instincts via gc_expired_instincts.

        When ``--project`` or ``--type`` filters are active, a dry-run
        pass identifies candidates first, the filter narrows the set,
        and only matching entries are deleted — entries outside the
        filter are never touched.
        """
        ttl_days: int = getattr(args, "ttl_days", instinct_store.DEFAULT_TTL_DAYS)
        dry_run_flag: bool = getattr(args, "dry_run", False)
        project_filter: str | None = getattr(args, "inst_project", None)
        type_filter: str | None = getattr(args, "inst_type", None)

        has_filter = bool(project_filter or type_filter)

        if not has_filter:
            result = instinct_store.gc_expired_instincts(
                store,
                ttl_days=ttl_days,
                dry_run=dry_run_flag,
            )
            pruned = result.pruned
            retained_count = len(result.retained)
            errors = result.errors
        else:
            candidates = instinct_store.gc_expired_instincts(
                store,
                ttl_days=ttl_days,
                dry_run=True,
            )
            entry_map = {e.name: e for e in store.list_entries()}
            pruned = []
            errors: list[str] = []
            skipped = 0
            for name in candidates.pruned:
                entry = entry_map.get(name)
                if entry is None:
                    continue
                if project_filter and entry.scope != project_filter:
                    skipped += 1
                    continue
                if type_filter and entry.type != type_filter:
                    skipped += 1
                    continue
                if not dry_run_flag:
                    if store.delete(name):
                        pruned.append(name)
                    else:
                        errors.append(name)
                else:
                    pruned.append(name)
            retained_count = len(candidates.retained) + skipped

        if json_mode:
            print(
                json.dumps(
                    {
                        "pruned": pruned,
                        "pruned_count": len(pruned),
                        "retained_count": retained_count,
                        "errors": errors,
                        "dry_run": dry_run_flag,
                        "ttl_days": ttl_days,
                    },
                    indent=2,
                )
            )
        else:
            verb = "Would prune" if dry_run_flag else "Pruned"
            print(f"{verb} {len(pruned)} instinct(s) (TTL: {ttl_days} days)")
            for name in pruned:
                print(f"  - {name}")
            if errors:
                print(f"Errors: {len(errors)}")
                for name in errors:
                    print(f"  ! {name}")
            print(f"Retained: {retained_count}")

        return 0

    def _handle_instincts_stats(
        self,
        store: "instinct_store.InstinctStore",
        json_mode: bool,
    ) -> int:
        """Show aggregate statistics over the instinct store."""
        entries = store.list_entries()

        by_type: dict[str, int] = {}
        by_scope: dict[str, int] = {}
        total_size = 0

        for e in entries:
            by_type[e.type] = by_type.get(e.type, 0) + 1
            by_scope[e.scope] = by_scope.get(e.scope, 0) + 1
            total_size += e.size

        result = {
            "total": len(entries),
            "total_size_bytes": total_size,
            "by_type": by_type,
            "by_scope": by_scope,
        }

        if json_mode:
            print(json.dumps(result, indent=2))
        else:
            print(f"Instinct Statistics ({len(entries)} entries, {total_size} bytes)")
            print("=" * 40)
            print()
            print("  By type:")
            for k, v in sorted(by_type.items()):
                print(f"    {k:<20} {v}")
            print()
            print("  By scope:")
            for k, v in sorted(by_scope.items()):
                print(f"    {k:<20} {v}")

        return 0

    # --- eval-run subcommand --------------------------------------------------

    def _add_eval_run_command(self, subparsers: Any) -> None:
        """Add the eval-run subcommand for running behavioural-eval scenarios."""
        eval_run = subparsers.add_parser(
            "eval-run",
            help="Run behavioural-eval scenarios and report pass@k metrics",
        )
        eval_run.add_argument(
            "scenario",
            nargs="?",
            type=Path,
            default=None,
            help="Path to a single scenario YAML file (omit when using --all)",
        )
        eval_run.add_argument(
            "--all",
            action="store_true",
            dest="run_all",
            help="Run every scenario found under --scenarios-dir",
        )
        eval_run.add_argument(
            "--k",
            type=int,
            default=1,
            help="Number of times to execute each scenario (default: 1)",
        )
        eval_run.add_argument(
            "--save-history",
            action="store_true",
            help="Persist each run trace as run-{timestamp}.json under --history-dir",
        )
        eval_run.add_argument(
            "--type",
            choices=["regression", "capability", "all"],
            default="all",
            dest="scenario_type",
            help="Filter scenarios by type (default: all)",
        )
        eval_run.add_argument(
            "--scenarios-dir",
            type=Path,
            default=Path(".claude/evals/scenarios"),
            dest="scenarios_dir",
            help="Directory to scan when --all is set (default: .claude/evals/scenarios)",
        )
        eval_run.add_argument(
            "--history-dir",
            type=Path,
            default=Path(eval_runner.DEFAULT_HISTORY_DIR),
            dest="history_dir",
            help=f"Directory for run trace files (default: {eval_runner.DEFAULT_HISTORY_DIR})",
        )

    def _handle_eval_run(self, args: argparse.Namespace) -> int:
        """Handle the eval-run subcommand."""
        json_mode = bool(getattr(args, "json", False))

        scenario_path: Path | None = getattr(args, "scenario", None)
        run_all: bool = getattr(args, "run_all", False)

        if not scenario_path and not run_all:
            msg = "Provide a scenario YAML path or use --all"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        if scenario_path and run_all:
            msg = "Cannot combine a scenario path with --all"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        k: int = getattr(args, "k", 1)
        if k < 1:
            msg = "--k must be >= 1"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        save_history: bool = getattr(args, "save_history", False)
        type_filter: str = getattr(args, "scenario_type", "all")
        scenarios_dir: Path = getattr(args, "scenarios_dir", Path(".claude/evals/scenarios"))
        history_dir: Path = getattr(args, "history_dir", Path(eval_runner.DEFAULT_HISTORY_DIR))

        scenario_files = self._collect_scenario_files(scenario_path, scenarios_dir, json_mode)
        if scenario_files is None:
            return 1

        results: list[eval_runner.ScenarioResult] = []
        errors: list[dict[str, str]] = []

        for path in scenario_files:
            try:
                sc = eval_scenario.EvalScenario.from_yaml(path)
            except eval_scenario.EvalScenarioValidationError as exc:
                errors.append({"path": str(path), "error": str(exc)})
                continue

            if type_filter != "all" and sc.type != type_filter:
                continue

            try:
                result = eval_runner.run_scenario(
                    sc,
                    k=k,
                    save_history=save_history,
                    history_dir=history_dir,
                    scenario_path=str(path),
                )
                results.append(result)
            except eval_runner.EvalRunnerError as exc:
                errors.append({"path": str(path), "error": str(exc)})

        if not results and not errors:
            msg = "No scenarios matched the filters"
            if json_mode:
                print(json.dumps({"error": msg, "type_filter": type_filter}, indent=2))
            else:
                print(f"Error: {msg}")
            return 1

        if json_mode:
            self._print_eval_run_json(results, errors, k, type_filter)
        else:
            self._print_eval_run_text(results, errors, k, type_filter)

        if not results:
            return 1
        return eval_runner.evaluate_exit(results)

    def _collect_scenario_files(
        self,
        scenario_path: Path | None,
        scenarios_dir: Path,
        json_mode: bool,
    ) -> list[Path] | None:
        """Collect scenario YAML files from a single path or directory scan."""
        if scenario_path:
            if not scenario_path.exists():
                msg = f"Scenario file not found: {scenario_path}"
                if json_mode:
                    print(json.dumps({"error": msg}, indent=2))
                else:
                    print(f"Error: {msg}")
                return None
            return [scenario_path]

        if not scenarios_dir.is_dir():
            msg = f"Scenarios directory not found: {scenarios_dir}"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return None

        files = sorted(list(scenarios_dir.rglob("*.yaml")) + list(scenarios_dir.rglob("*.yml")))
        if not files:
            msg = f"No YAML files found in {scenarios_dir}"
            if json_mode:
                print(json.dumps({"error": msg}, indent=2))
            else:
                print(f"Error: {msg}")
            return None

        return files

    def _print_eval_run_json(
        self,
        results: list["eval_runner.ScenarioResult"],
        errors: list[dict[str, str]],
        k: int,
        type_filter: str,
    ) -> None:
        """Render eval-run results as JSON."""
        passed = sum(1 for r in results if r.verdict == "passed")
        payload = {
            "total": len(results),
            "passed": passed,
            "failed": len(results) - passed,
            "pass_rate": passed / len(results) if results else 0.0,
            "k": k,
            "type_filter": type_filter,
            "results": [r.to_dict() for r in results],
            "errors": errors,
        }
        print(json.dumps(payload, indent=2))

    def _print_eval_run_text(
        self,
        results: list["eval_runner.ScenarioResult"],
        errors: list[dict[str, str]],
        k: int,
        type_filter: str,
    ) -> None:
        """Render eval-run results as human-readable text."""
        passed = sum(1 for r in results if r.verdict == "passed")
        total = len(results)

        print(f"\nEval Run Results (k={k}, type={type_filter})")
        print("=" * 60)

        for r in results:
            flag = "PASS" if r.verdict == "passed" else "FAIL"
            path_label = r.scenario_path or "(inline)"
            print(f"  [{flag}] {path_label}  ({r.duration_ms}ms)")
            if r.error:
                print(f"         {r.error}")

        if errors:
            print(f"\nLoad errors ({len(errors)}):")
            for e in errors:
                print(f"  ! {e['path']}: {e['error'][:120]}")

        print(f"\nSummary: {passed}/{total} passed", end="")
        if total:
            print(f" ({passed / total:.0%})")
        else:
            print()

    # --- evolve subcommand ---------------------------------------------------

    def _add_evolve_command(self, subparsers: Any) -> None:
        """Add the evolve subcommand for promotion-gate evaluation."""
        evolve = subparsers.add_parser(
            "evolve",
            help="Evaluate instincts for promotion eligibility",
        )
        evolve.add_argument(
            "--dry-run",
            action="store_true",
            help="List eligible candidates without writing artifacts",
        )
        evolve.add_argument(
            "--threshold",
            type=float,
            default=None,
            help=(
                "Override the confidence threshold "
                f"(default: {promotion_engine.DEFAULT_CONFIDENCE})"
            ),
        )
        evolve.add_argument(
            "--min-occurrences",
            type=int,
            default=None,
            help=(
                "Override the minimum occurrences threshold "
                f"(default: {promotion_engine.DEFAULT_OCCURRENCES})"
            ),
        )
        evolve.add_argument(
            "--min-success-count",
            type=int,
            default=None,
            help=(
                "Override the minimum success count threshold "
                f"(default: {promotion_engine.DEFAULT_SUCCESS_COUNT})"
            ),
        )
        evolve.add_argument(
            "--target",
            choices=["skill", "command", "agent", "template", "all"],
            default="all",
            help="Filter by promotion target type (default: all)",
        )
        evolve.add_argument(
            "--root",
            type=Path,
            dest="evolve_root",
            help="Path to instinct store root (default: ~/.claude/instincts)",
        )

    def _handle_evolve(self, args: argparse.Namespace) -> int:
        """Evaluate instincts against promotion gates and report candidates."""
        from .shared.frontmatter import parse_frontmatter_safe

        json_mode = bool(getattr(args, "json", False))
        dry_run_flag: bool = getattr(args, "dry_run", False)
        target_filter: str = getattr(args, "target", "all")
        evolve_root: Path | None = getattr(args, "evolve_root", None)

        store = instinct_store.InstinctStore(root=evolve_root)

        thresholds_kwargs: dict[str, int | float | str] = {}
        if args.threshold is not None:
            thresholds_kwargs["confidence"] = float(args.threshold)
        if args.min_occurrences is not None:
            thresholds_kwargs["occurrences"] = int(args.min_occurrences)
        if args.min_success_count is not None:
            thresholds_kwargs["success_count"] = int(args.min_success_count)

        if thresholds_kwargs:
            thresholds = promotion_engine.PromotionThresholds.from_dict(thresholds_kwargs)
        else:
            thresholds = promotion_engine.PromotionThresholds.from_env()

        entries = store.list_entries()
        if not entries:
            if json_mode:
                print(json.dumps({"candidates": [], "total_evaluated": 0, "eligible": 0}))
            else:
                print("No instincts found.")
            return 0

        candidates: list[dict[str, Any]] = []

        for entry in entries:
            content = store.get(entry.name)
            if not content:
                continue

            fm, errors = parse_frontmatter_safe(content)
            if fm is None or errors:
                continue

            confidence = _parse_float_field(fm, "confidence")
            usage_count = _parse_int_field_cli(fm, "usage_count")
            success_count = _parse_int_field_cli(fm, "success_count")

            result = promotion_engine.promote(
                occurrences=usage_count,
                confidence=confidence,
                success_count=success_count,
                thresholds=thresholds,
            )

            if result.eligible:
                candidates.append(
                    {
                        "name": entry.name,
                        "scope": entry.scope,
                        "type": entry.type,
                        "confidence": confidence,
                        "occurrences": usage_count,
                        "success_count": success_count,
                    }
                )

        if target_filter != "all":
            candidates = self._filter_by_target(candidates, target_filter, store)

        if json_mode:
            payload: dict[str, Any] = {
                "candidates": candidates,
                "total_evaluated": len(entries),
                "eligible": len(candidates),
                "dry_run": dry_run_flag,
                "thresholds": {
                    "confidence": thresholds.confidence,
                    "occurrences": thresholds.occurrences,
                    "success_count": thresholds.success_count,
                },
            }
            if target_filter != "all":
                payload["target_filter"] = target_filter
            print(json.dumps(payload, indent=2))
        else:
            verb = "Would promote" if dry_run_flag else "Eligible for promotion"
            print(f"{verb}: {len(candidates)} instinct(s)")
            print(
                f"Evaluated: {len(entries)} | Thresholds: "
                f"confidence>={thresholds.confidence}, "
                f"occurrences>={thresholds.occurrences}, "
                f"success_count>={thresholds.success_count}"
            )
            if target_filter != "all":
                print(f"Target filter: {target_filter}")
            print("-" * 60)
            for c in candidates:
                print(
                    f"  {c['name']:<30} conf={c['confidence']:.2f} "
                    f"occ={c['occurrences']} succ={c['success_count']}"
                )
            if not candidates:
                print("  (none)")

        return 0

    def _filter_by_target(
        self,
        candidates: list[dict[str, Any]],
        target: str,
        store: "instinct_store.InstinctStore",
    ) -> list[dict[str, Any]]:
        """Filter candidates by promotion target classification."""
        from .shared.frontmatter import parse_frontmatter_safe

        principles: list[promotion_engine.DistilledPrinciple] = []
        candidate_map: dict[str, dict[str, Any]] = {}

        for c in candidates:
            content = store.get(c["name"])
            if not content:
                continue
            fm, _ = parse_frontmatter_safe(content)
            if fm is None:
                continue

            principle = promotion_engine.DistilledPrinciple(
                name=c["name"],
                description=str(fm.get("description", c["name"])),
                type=c.get("type", "tool_use"),
                confidence=c["confidence"],
                created=str(fm.get("created", "")),
                last_seen=str(fm.get("last_seen", "")),
                action=str(fm.get("action", "")),
                evidence=str(fm.get("evidence", "")),
                examples="",
                occurrences=c["occurrences"],
                success_count=c["success_count"],
                usage_count=c["occurrences"],
                ttl_days=30,
                project_scope=c.get("scope", ""),
                outcome="success",
            )
            principles.append(principle)
            candidate_map[c["name"]] = c

        cluster = promotion_engine.cluster_instincts(principles)
        target_principles = getattr(cluster, target, ())

        return [candidate_map[p.name] for p in target_principles if p.name in candidate_map]

    # --- health subcommand ---------------------------------------------------

    def _add_health_command(self, subparsers: Any) -> None:
        """Add the health subcommand for learning-loop health dashboard."""
        health = subparsers.add_parser(
            "health",
            help="Show learning-loop health dashboard (eval, instincts, observations, drift)",
        )
        health.add_argument(
            "--history-dir",
            type=Path,
            default=Path(eval_runner.DEFAULT_HISTORY_DIR),
            dest="history_dir",
            help=f"Eval history directory (default: {eval_runner.DEFAULT_HISTORY_DIR})",
        )
        health.add_argument(
            "--instinct-root",
            type=Path,
            default=None,
            dest="instinct_root",
            help="Path to instinct store root (default: ~/.claude/instincts)",
        )
        health.add_argument(
            "--obs-file",
            type=Path,
            default=None,
            dest="obs_file",
            help="Path to observations JSONL file (default: .claude/observations.jsonl)",
        )

    def _handle_health(self, args: argparse.Namespace) -> int:
        """Render the learning-loop health dashboard."""
        json_mode = bool(getattr(args, "json", False))

        metrics = self._collect_health_metrics(args)

        if json_mode:
            print(json.dumps(metrics.to_dict(), indent=2))
        else:
            self._print_health_text(metrics)

        return 0

    def _collect_health_metrics(self, args: argparse.Namespace) -> _HealthMetrics:
        """Gather all five health metrics into a single typed structure."""
        history_dir: Path = getattr(args, "history_dir", Path(eval_runner.DEFAULT_HISTORY_DIR))
        instinct_root: Path | None = getattr(args, "instinct_root", None)
        obs_file: Path | None = getattr(args, "obs_file", None)

        eval_rates = self._eval_pass_rates(history_dir)
        inst_store = instinct_store.InstinctStore(root=instinct_root)
        obs_store = observation_store.ObservationStore(path=obs_file)
        obs_stats = obs_store.stats()
        drift_report = weight_drift_check.check_drift()

        return _HealthMetrics(
            eval_pass_rates=eval_rates,
            instinct_count=inst_store.count(),
            observation_count=obs_stats["total"]["count"],
            observation_promoted=obs_stats["promoted"]["count"],
            last_evolve_timestamp=self._last_evolve_timestamp(inst_store),
            weight_drift_detected=drift_report.has_drift,
            weight_drift_divergences=len(drift_report.divergences),
        )

    @staticmethod
    def _eval_pass_rates(history_dir: Path) -> _EvalPassRates:
        """Compute pass rates from eval history JSON files."""
        if not history_dir.is_dir():
            return _EvalPassRates(total=0, passed=0, failed=0, pass_rate=0.0)

        files = sorted(history_dir.glob("run-*.json"))
        total = 0
        passed = 0

        for path in files:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict) and "verdict" in data:
                    total += 1
                    if data["verdict"] == "passed":
                        passed += 1
            except (json.JSONDecodeError, OSError):
                continue

        failed = total - passed
        rate = passed / total if total else 0.0
        return _EvalPassRates(total=total, passed=passed, failed=failed, pass_rate=rate)

    @staticmethod
    def _last_evolve_timestamp(
        store: instinct_store.InstinctStore,
    ) -> str | None:
        """Find the most recent last_seen across all instinct entries."""
        entries = store.list_entries()
        if not entries:
            return None

        latest: str | None = None
        for entry in entries:
            if entry.last_seen and (latest is None or entry.last_seen > latest):
                latest = entry.last_seen
        return latest

    @staticmethod
    def _print_health_text(metrics: _HealthMetrics) -> None:
        """Render the health dashboard as human-readable text."""
        print("\n" + "=" * 50)
        print("  Learning Loop Health Dashboard")
        print("=" * 50)

        er = metrics.eval_pass_rates
        print(f"\n  Eval pass rate:      {er.passed}/{er.total} ({er.pass_rate:.0%})")
        print(f"  Instinct count:      {metrics.instinct_count}")
        print(
            f"  Observations:        {metrics.observation_count} ({metrics.observation_promoted} promoted)"
        )
        print(f"  Last evolve:         {metrics.last_evolve_timestamp or '(never)'}")

        if metrics.weight_drift_detected:
            status = f"DRIFT DETECTED ({metrics.weight_drift_divergences} divergence(s))"
        else:
            status = "OK"
        print(f"  Weight drift:        {status}")
        print()

    def _add_install_plugin_command(self, subparsers: Any) -> None:
        """Add the install-plugin subcommand.

        Registers the repo as a Claude Code marketplace and installs the
        plugin at the requested scope. Delegates all state mutation to
        :func:`plugin_installer.install_plugin`, which wraps the canonical
        ``claude plugin`` CLI — this subcommand never touches the plugin
        registry files directly.
        """
        install = subparsers.add_parser(
            "install-plugin",
            help="Install the platxa-agent-generator plugin into Claude Code",
        )
        install.add_argument(
            "-s",
            "--scope",
            choices=list(plugin_installer.SUPPORTED_SCOPES),
            default="user",
            help="Install scope: user (~/.claude), project, or local. Default: user.",
        )
        install.add_argument(
            "-f",
            "--force",
            action="store_true",
            help="Re-register the marketplace and reinstall the plugin even if present.",
        )
        install.add_argument(
            "--timeout",
            type=int,
            default=plugin_installer.DEFAULT_TIMEOUT_SECONDS,
            help=(
                "Per-CLI-call timeout in seconds "
                f"(default: {plugin_installer.DEFAULT_TIMEOUT_SECONDS})"
            ),
        )

    def _add_uninstall_plugin_command(self, subparsers: Any) -> None:
        """Add the uninstall-plugin subcommand.

        Mirrors install-plugin for the reverse operation. The
        ``--remove-marketplace`` flag is opt-in because leaving the
        marketplace entry registered is cheap and makes reinstall fast;
        only set it when a full cleanup is desired.
        """
        uninstall = subparsers.add_parser(
            "uninstall-plugin",
            help="Uninstall the platxa-agent-generator plugin from Claude Code",
        )
        uninstall.add_argument(
            "-s",
            "--scope",
            choices=list(plugin_installer.SUPPORTED_SCOPES),
            default="user",
            help="Scope to uninstall from. Default: user.",
        )
        uninstall.add_argument(
            "--remove-marketplace",
            action="store_true",
            help="Also deregister the self-hosted marketplace entry.",
        )
        uninstall.add_argument(
            "--timeout",
            type=int,
            default=plugin_installer.DEFAULT_TIMEOUT_SECONDS,
            help=(
                "Per-CLI-call timeout in seconds "
                f"(default: {plugin_installer.DEFAULT_TIMEOUT_SECONDS})"
            ),
        )

    def _add_plugin_status_command(self, subparsers: Any) -> None:
        """Add the plugin-status subcommand (read-only inspection)."""
        subparsers.add_parser(
            "plugin-status",
            help="Show install state of the platxa-agent-generator plugin",
        )

    def _handle_install_plugin(self, args: argparse.Namespace) -> int:
        """Execute install-plugin and render the result.

        Each CLI step is printed (or emitted as JSON) so the caller sees
        exactly which underlying ``claude plugin`` commands ran and
        whether any were skipped as no-ops. Exit code mirrors
        :attr:`PluginInstallResult.success`."""
        json_mode = bool(getattr(args, "json", False))
        result = plugin_installer.install_plugin(
            scope=args.scope,
            force=bool(args.force),
            timeout=int(args.timeout),
        )
        if json_mode:
            print(json.dumps(_plugin_result_to_dict(result), indent=2))
        else:
            _print_plugin_result(result, title="Plugin install")
        return 0 if result.success else 1

    def _handle_uninstall_plugin(self, args: argparse.Namespace) -> int:
        """Execute uninstall-plugin and render the result."""
        json_mode = bool(getattr(args, "json", False))
        result = plugin_installer.uninstall_plugin(
            scope=args.scope,
            remove_marketplace=bool(args.remove_marketplace),
            timeout=int(args.timeout),
        )
        if json_mode:
            print(json.dumps(_plugin_result_to_dict(result), indent=2))
        else:
            _print_plugin_result(result, title="Plugin uninstall")
        return 0 if result.success else 1

    def _handle_plugin_status(self, args: argparse.Namespace) -> int:
        """Execute plugin-status (read-only)."""
        json_mode = bool(getattr(args, "json", False))
        status = plugin_installer.plugin_status()
        if json_mode:
            print(
                json.dumps(
                    {
                        "plugin_installed": status.plugin_installed,
                        "marketplace_registered": status.marketplace_registered,
                        "installed_scope": status.installed_scope,
                        "installed_version": status.installed_version,
                        "install_path": status.install_path,
                        "marketplace_path": status.marketplace_path,
                    },
                    indent=2,
                )
            )
        else:
            print("Plugin status")
            print("-" * 40)
            print(f"  Plugin installed:   {status.plugin_installed}")
            if status.plugin_installed:
                print(f"    Scope:            {status.installed_scope}")
                print(f"    Version:          {status.installed_version}")
                print(f"    Install path:     {status.install_path}")
            print(
                f"  Marketplace:        {'registered' if status.marketplace_registered else 'not registered'}"
            )
            if status.marketplace_registered:
                print(f"    Location:         {status.marketplace_path}")
        return 0


def _parse_float_field(fm: dict[str, object], key: str) -> float:
    """Extract a float field from frontmatter, defaulting to 0.0."""
    raw = fm.get(key, 0.0)
    if isinstance(raw, float):
        return raw
    if isinstance(raw, int):
        return float(raw)
    try:
        return float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _parse_int_field_cli(fm: dict[str, object], key: str) -> int:
    """Extract an integer field from frontmatter, defaulting to 0."""
    raw = fm.get(key, 0)
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0


def _plugin_result_to_dict(result: "plugin_installer.PluginInstallResult") -> dict[str, Any]:
    """Convert a PluginInstallResult to a JSON-safe dict.

    Kept at module scope so both install and uninstall handlers share
    the serialization shape — reviewers parsing machine output should
    not have to handle two variants."""
    return {
        "success": result.success,
        "message": result.message,
        "plugin_install_path": result.plugin_install_path,
        "marketplace_added": result.marketplace_added,
        "marketplace_already_present": result.marketplace_already_present,
        "plugin_already_installed": result.plugin_already_installed,
        "steps": [
            {
                "name": step.name,
                "command": list(step.command),
                "returncode": step.returncode,
                "stdout": step.stdout,
                "stderr": step.stderr,
                "skipped": step.skipped,
                "passed": step.passed,
            }
            for step in result.steps
        ],
    }


def _print_plugin_result(
    result: "plugin_installer.PluginInstallResult",
    *,
    title: str,
) -> None:
    """Human-readable renderer for plugin install/uninstall results."""
    flag = "✓" if result.success else "✗"
    print(f"{flag} {title}: {result.message}")
    if result.steps:
        print("  Steps:")
        for step in result.steps:
            marker = "•" if step.skipped else ("✓" if step.passed else "✗")
            print(f"    {marker} {step.name}" + (" (skipped)" if step.skipped else ""))
            if step.stderr.strip() and not step.passed:
                print(f"        stderr: {step.stderr.strip()[:200]}")
    if result.plugin_install_path:
        print(f"  Install path: {result.plugin_install_path}")


def main() -> NoReturn:
    """Main entry point."""
    cli = CLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
