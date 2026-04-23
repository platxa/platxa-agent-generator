#!/usr/bin/env python3
"""
Platxa Agent Generator CLI

Production-grade command-line interface for standalone agent generation.

Commands:
    generate    Generate an agent from natural language description
    validate    Validate an existing agent definition
    catalog     Browse and use pre-built agent templates
    install     Install an agent to user or project scope
    analyze     Analyze complexity and get thinking recommendations
    preview     Preview agent generation without writing files
    status      Show current generation progress

Usage:
    python -m scripts.cli generate "Create a code review agent that..."
    python -m scripts.cli validate path/to/agent.md
    python -m scripts.cli catalog list
    python -m scripts.cli install agent.md --scope user
    python -m scripts.cli analyze "Design a distributed system..."
"""

from __future__ import annotations

import argparse
import json
import sys
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
        extended_thinking,
        install_agent,
        nlp_parser,
        plugin_installer,
        progress_tracker,
        quality_scorer,
        security_scanner,
        syntax_validator,
        tool_selector,
        type_classifier,
    )
except ImportError:
    # Standalone execution - type: ignore comments for pyright
    import agent_analyzer  # type: ignore[import-not-found,no-redef]
    import agent_catalog  # type: ignore[import-not-found,no-redef]
    import agent_generator  # type: ignore[import-not-found,no-redef]
    import agent_linter  # type: ignore[import-not-found,no-redef]
    import agent_upgrader  # type: ignore[import-not-found,no-redef]
    import dry_run  # type: ignore[import-not-found,no-redef]
    import extended_thinking  # type: ignore[import-not-found,no-redef]
    import install_agent  # type: ignore[import-not-found,no-redef]
    import nlp_parser  # type: ignore[import-not-found,no-redef]
    import plugin_installer  # type: ignore[import-not-found,no-redef]
    import progress_tracker  # type: ignore[import-not-found,no-redef]
    import quality_scorer  # type: ignore[import-not-found,no-redef]
    import security_scanner  # type: ignore[import-not-found,no-redef]
    import syntax_validator  # type: ignore[import-not-found,no-redef]
    import tool_selector  # type: ignore[import-not-found,no-redef]
    import type_classifier  # type: ignore[import-not-found,no-redef]


__version__ = "0.1.0"


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
        """Generate agent from description."""
        description: str = args.description

        if not description:
            print("Error: Description is required")
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

            # Phase 3: Generation
            tracker.update_phase("generation", 0, "Creating agent definition")
            agent_name = args.name or parsed.name

            # agent_generator.generate returns (success, content, error)
            success, agent_content, error_msg = agent_generator.generate(
                name=agent_name,
                description=parsed.description,
                tools=tool_list,
            )

            if not success:
                tracker.fail(f"Generation failed: {error_msg}")
                print(f"Error: {error_msg}")
                return 1

            tracker.update_phase("generation", 100)

            # Phase 4: Validation
            if not args.no_validate:
                tracker.update_phase("validation", 0, "Validating syntax")
                syntax_validator.validate_content(agent_content)
                tracker.update_phase("validation", 33, "Scanning security")

                security_scanner.scan_content(agent_content)
                tracker.update_phase("validation", 66, "Scoring quality")

                quality_result = quality_scorer.score_quality(agent_content)
                quality_score = quality_result.total_score
                tracker.update_phase("validation", 100)

                if quality_score < args.min_quality:
                    tracker.fail(
                        f"Quality score {quality_score:.1f} below minimum {args.min_quality}"
                    )
                    return 1

            # Phase 5: Write output
            output_dir = args.output or Path.cwd() / ".claude" / "agents"
            tracker.update_phase("installation", 0, "Writing files")

            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{agent_name}.md"
            output_path.write_text(agent_content, encoding="utf-8")
            tracker.update_phase("installation", 100)

            tracker.complete()

            if hasattr(args, "json") and args.json:
                result = {
                    "success": True,
                    "output_path": str(output_path),
                    "agent_name": agent_name,
                    "agent_type": agent_type_str,
                    "tools": tool_list,
                }
                if not args.no_validate:
                    result["quality_score"] = quality_score
                print(json.dumps(result, indent=2))
            else:
                print(tracker.render())
                print("\nAgent generated successfully!")
                print(f"Output: {output_path}")

            return 0

        except Exception as e:
            tracker.fail(str(e))
            print(f"Error: {e}")
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
