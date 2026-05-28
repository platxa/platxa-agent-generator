#!/usr/bin/env python3
"""Platxa Agent Generator CLI.

Production-grade command-line interface for standalone agent generation.

Run ``platxa-agent --help`` (or ``python -m platxa_agent_generator --help``)
for the authoritative, always-current subcommand list. The 13 subcommands
fall into six groups:

    Agent generation (5):
        generate, validate, catalog, install, lint
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

Removed subcommands (Phase 2 Category B / Phase 3 Claude Reasoning):
    analyze        -- replaced by Claude's native thinking intensity (Phase 3)
    analyze-agent  -- replaced by validation-subagent + Bash(pytest/pyright)
    upgrade        -- replaced by Edit tool + skill reference rules
    preview        -- replaced by Read+Bash(diff) in team-lead
    status         -- replaced by Read/Write JSON in team-lead
    batch          -- replaced by Read JSON spec + Task fan-out

Keeping the inventory here (instead of per-command one-liners that drift
out of sync with argparse) means the parser remains the single source of
truth. Update the six groups above only when a subcommand is added or
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
from pathlib import Path
from typing import Any, NoReturn

from . import (
    agent_generator,
    agent_linter,
    nlp_parser,
    progress_tracker,
    quality_scorer,
    security_scanner,
    syntax_validator,
)
from .commands import catalog as _catalog_cmd
from .commands import eval_run as _eval_run_cmd
from .commands import evolve as _evolve_cmd
from .commands import health as _health_cmd
from .commands import instincts as _instincts_cmd
from .commands import observations as _observations_cmd
from .commands import plugin as _plugin_cmd
from .commands.evolve import (
    DEFAULT_PROMOTER_TIMEOUT,
    PromoterExecutor,
    PromotionDispatchError,
)

__version__ = "1.1.0"

# Re-exports of evolve symbols: tests predating the commands/ package
# import ``PromoterExecutor`` and ``PromotionDispatchError`` directly
# from this module, so we list them in __all__ to mark the public
# import path as intentional (silences ruff F401 on a load-bearing
# re-export).
__all__ = [
    "CLI",
    "DEFAULT_PROMOTER_TIMEOUT",
    "PromoterExecutor",
    "PromotionDispatchError",
    "main",
]


class CLI:
    """Main CLI application class."""

    def __init__(self, *, promoter_executor: PromoterExecutor | None = None) -> None:
        self.parser = self._create_parser()
        self._promoter_executor = promoter_executor

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
        _catalog_cmd.register_parser(subparsers)
        self._add_lint_command(subparsers)
        _observations_cmd.register_parser(subparsers)
        _instincts_cmd.register_parser(subparsers)
        _eval_run_cmd.register_parser(subparsers)
        _evolve_cmd.register_parser(subparsers)
        _health_cmd.register_parser(subparsers)
        _plugin_cmd.register_parser(subparsers)

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
            **_catalog_cmd.COMMANDS,
            "lint": self._handle_lint,
            **_observations_cmd.COMMANDS,
            **_instincts_cmd.COMMANDS,
            **_eval_run_cmd.COMMANDS,
            "evolve": lambda args: _evolve_cmd.handle_evolve(
                args, promoter_executor=self._promoter_executor
            ),
            **_health_cmd.COMMANDS,
            **_plugin_cmd.COMMANDS,
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

            print(f"  Detected type: {parsed.agent_type}")
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

            agent_type_str = args.type or parsed.agent_type
            agent_name = args.name or parsed.name

            tracker.update_phase("discovery", 100)

            # Phase 2: Architecture
            tracker.update_phase("architecture", 0, "Selecting tools")
            if args.tools:
                tool_list = args.tools
            else:
                tool_list = list(parsed.tools)
            tracker.update_phase("architecture", 100)

            # Phase 3: Generation with iteration-aware retry loop
            retry_count = 0

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
                    discovery_context=None,
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
                retry_count = iteration + 1
                reprompt_context = agent_generator.build_validation_failure_context(
                    quality_result, min_score=args.min_quality
                )

                if iteration + 1 >= max_iterations:
                    # Exhausted all iterations — ESCALATE
                    return self._escalate_verdict(
                        args,
                        tracker,
                        max_iterations,
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
                    "iterations_used": retry_count + 1,
                    "max_iterations": max_iterations,
                }
                if not args.no_validate:
                    result["quality_score"] = quality_score
                print(json.dumps(result, indent=2))
            else:
                print("\nAgent generated successfully!")
                print(f"Output: {output_path}")
                if retry_count > 0:
                    print(f"Iterations used: {retry_count + 1}/{max_iterations}")

            return 0

        except Exception as e:
            import traceback

            traceback.print_exc(file=sys.stderr)
            tracker.fail(str(e))
            print(f"Error: {e}")
            return 1

    def _escalate_verdict(
        self,
        args: argparse.Namespace,
        tracker: progress_tracker.ProgressTracker,
        max_iterations: int,
        quality_score: float,
        agent_name: str,
        agent_type_str: str,
    ) -> int:
        """Emit ESCALATE verdict when max iterations exhausted."""
        tracker.fail(
            f"ESCALATE: {max_iterations} iterations exhausted; "
            f"best score {quality_score:.1f} < {args.min_quality}"
        )

        if hasattr(args, "json") and args.json:
            result = {
                "success": False,
                "verdict": "ESCALATE",
                "agent_name": agent_name,
                "agent_type": agent_type_str,
                "iterations_used": max_iterations,
                "max_iterations": max_iterations,
                "best_quality_score": quality_score,
                "min_quality_required": args.min_quality,
                "message": (
                    f"Quality score {quality_score:.1f} remained below "
                    f"{args.min_quality} after {max_iterations} iterations"
                ),
            }
            print(json.dumps(result, indent=2))
        else:
            print(
                f"\nESCALATE: Quality score {quality_score:.1f} < {args.min_quality} "
                f"after {max_iterations} iterations."
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


def main() -> NoReturn:
    """Main entry point."""
    cli = CLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
