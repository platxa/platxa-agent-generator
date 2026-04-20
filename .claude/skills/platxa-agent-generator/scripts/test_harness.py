#!/usr/bin/env python3
"""
Test Harness for Agent Invocation Testing

Provides a framework for testing agent definitions by:
1. Validating agent structure and syntax
2. Testing invocation patterns with mock inputs
3. Verifying response patterns match expectations
4. Running test suites for agent certification

Usage:
    python test_harness.py agent.md                    # Run all tests
    python test_harness.py agent.md --test-file tests.json
    python test_harness.py agent.md --quick            # Structure tests only
    python test_harness.py agent.md --live             # Include live 'claude -p' tests
    python test_harness.py --create-tests agent.md    # Generate test template
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TestCase:
    """A single test case for an agent."""

    name: str
    description: str
    input_prompt: str
    expected_patterns: list[str] = field(default_factory=list)
    forbidden_patterns: list[str] = field(default_factory=list)
    expected_tools: list[str] = field(default_factory=list)
    timeout_seconds: int = 30
    skip: bool = False
    skip_reason: str = ""


@dataclass
class TestResult:
    """Result of running a single test."""

    test_name: str
    passed: bool
    duration_ms: int = 0
    message: str = ""
    details: list[str] = field(default_factory=list)


@dataclass
class TestSuiteResult:
    """Result of running a test suite."""

    agent_name: str
    agent_path: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    results: list[TestResult] = field(default_factory=list)
    summary: str = ""


@dataclass
class AgentInfo:
    """Parsed agent information for testing."""

    name: str
    description: str
    tools: list[str]
    sections: dict[str, str]
    workflow_steps: list[str]
    examples: list[dict[str, str]]


def parse_agent_file(file_path: Path) -> AgentInfo | None:
    """Parse agent definition file for testing."""
    if not file_path.exists():
        return None

    content = file_path.read_text(encoding="utf-8")
    lines = content.split("\n")

    # Parse frontmatter
    if not lines or lines[0].strip() != "---":
        return None

    frontmatter: dict[str, str] = {}
    fm_end = -1
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            fm_end = i
            break
        if ":" in line:
            key, value = line.split(":", 1)
            frontmatter[key.strip()] = value.strip().strip('"').strip("'")

    if fm_end < 0:
        return None

    name = frontmatter.get("name", file_path.stem)
    description = frontmatter.get("description", "")
    tools_str = frontmatter.get("tools", "")
    tools = [t.strip() for t in tools_str.split(",") if t.strip()]

    # Parse sections
    sections: dict[str, str] = {}
    current_section = ""
    current_content: list[str] = []

    for line in lines[fm_end + 1 :]:
        if line.startswith("# "):
            if current_section:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = line[2:].strip()
            current_content = []
        elif line.startswith("## "):
            if current_section:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = line[3:].strip()
            current_content = []
        else:
            current_content.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_content).strip()

    # Extract workflow steps
    workflow_steps: list[str] = []
    workflow_content = ""
    for sec_name, sec_content in sections.items():
        if "workflow" in sec_name.lower():
            workflow_content = sec_content
            break

    if workflow_content:
        # Find numbered steps or ### subsections
        step_matches = re.findall(r"^\d+\.\s*\*?\*?([^*\n]+)", workflow_content, re.MULTILINE)
        workflow_steps.extend([m.strip() for m in step_matches])

        subsection_matches = re.findall(r"^###\s+(.+)$", workflow_content, re.MULTILINE)
        workflow_steps.extend([m.strip() for m in subsection_matches])

    # Extract examples
    examples: list[dict[str, str]] = []
    examples_content = ""
    for sec_name, sec_content in sections.items():
        if "example" in sec_name.lower():
            examples_content = sec_content
            break

    if examples_content:
        # Parse example blocks
        example_blocks = re.split(r"###\s+Example", examples_content, flags=re.IGNORECASE)
        for block in example_blocks[1:]:  # Skip first empty split
            example: dict[str, str] = {"title": "Example"}
            # Extract title
            title_match = re.match(r"\s*\d*:?\s*(.+?)(?:\n|$)", block)
            if title_match:
                example["title"] = title_match.group(1).strip()
            # Extract code blocks
            code_blocks = re.findall(r"```(?:\w+)?\n(.*?)```", block, re.DOTALL)
            if code_blocks:
                example["code"] = code_blocks[0].strip()

            # Extract User Request (from **User Request:** block)
            user_req_match = re.search(
                r"\*\*User Request:\*\*\s*```\s*\n(.*?)```",
                block,
                re.DOTALL,
            )
            if user_req_match:
                example["user_request"] = user_req_match.group(1).strip()

            # Extract Agent Actions (numbered list after **Agent Actions:**)
            actions_match = re.search(
                r"\*\*Agent Actions:\*\*\s*\n((?:\d+\..+\n?)+)",
                block,
            )
            if actions_match:
                actions_text = actions_match.group(1).strip()
                actions = re.findall(r"\d+\.\s*(.+)", actions_text)
                example["agent_actions"] = "; ".join(actions)

            # Extract Expected Output keywords from **Expected Output:** block
            output_match = re.search(
                r"\*\*Expected Output:\*\*\s*```(?:\w+)?\s*\n(.*?)```",
                block,
                re.DOTALL,
            )
            if output_match:
                example["expected_output"] = output_match.group(1).strip()

            examples.append(example)

    return AgentInfo(
        name=name,
        description=description,
        tools=tools,
        sections=sections,
        workflow_steps=workflow_steps,
        examples=examples,
    )


def create_structure_tests(agent: AgentInfo) -> list[TestCase]:
    """Create tests for agent structure validation."""
    tests: list[TestCase] = []

    # Test: Agent has name
    tests.append(
        TestCase(
            name="structure_has_name",
            description="Agent has a valid name",
            input_prompt="",
            expected_patterns=[r"^[a-z][a-z0-9-]*$"] if agent.name else [],
        )
    )

    # Test: Agent has description
    tests.append(
        TestCase(
            name="structure_has_description",
            description="Agent has a description",
            input_prompt="",
            expected_patterns=[r".{20,}"] if agent.description else [],
        )
    )

    # Test: Agent has tools
    tests.append(
        TestCase(
            name="structure_has_tools",
            description="Agent specifies at least one tool",
            input_prompt="",
            expected_patterns=["tool"] if agent.tools else [],
        )
    )

    # Test: Agent has workflow
    tests.append(
        TestCase(
            name="structure_has_workflow",
            description="Agent has workflow steps defined",
            input_prompt="",
            expected_patterns=["step"] if agent.workflow_steps else [],
        )
    )

    # Test: Agent has examples
    tests.append(
        TestCase(
            name="structure_has_examples",
            description="Agent has usage examples",
            input_prompt="",
            expected_patterns=["example"] if agent.examples else [],
        )
    )

    return tests


def create_invocation_tests(agent: AgentInfo) -> list[TestCase]:
    """Create tests for agent invocation patterns."""
    tests: list[TestCase] = []

    # Test: Task tool invocation format
    if "Task" in agent.tools:
        tests.append(
            TestCase(
                name="invocation_task_format",
                description="Agent can be invoked via Task tool",
                input_prompt=f"Invoke {agent.name} agent",
                expected_patterns=[
                    r"subagent_type",
                    r"prompt",
                ],
                expected_tools=["Task"],
            )
        )

    # Test: Tool usage in workflow
    for tool in agent.tools[:3]:  # Test first 3 tools
        tests.append(
            TestCase(
                name=f"invocation_uses_{tool.lower()}",
                description=f"Workflow references {tool} tool",
                input_prompt="",
                expected_patterns=[tool],
            )
        )

    return tests


def create_response_tests(agent: AgentInfo) -> list[TestCase]:
    """Create tests for expected response patterns."""
    tests: list[TestCase] = []

    # Test: Response mentions agent name or purpose
    tests.append(
        TestCase(
            name="response_identifies_agent",
            description="Response identifies the agent or its purpose",
            input_prompt=f"What does the {agent.name} agent do?",
            expected_patterns=[
                agent.name,
                *agent.description.split()[:3],  # First few words of description
            ],
        )
    )

    # Test: Response avoids dangerous patterns
    tests.append(
        TestCase(
            name="response_no_dangerous_patterns",
            description="Response avoids dangerous command patterns",
            input_prompt="Execute the agent workflow",
            forbidden_patterns=[
                r"rm\s+-rf\s+/",
                r"chmod\s+777",
                r">\s*/dev/sd",
                r"mkfs\.",
            ],
        )
    )

    return tests


def run_structure_test(test: TestCase, agent: AgentInfo) -> TestResult:
    """Run a structure validation test."""
    import time

    start = time.time()

    passed = True
    details: list[str] = []

    if test.name == "structure_has_name":
        if not agent.name:
            passed = False
            details.append("Agent name is missing")
        elif not re.match(r"^[a-z][a-z0-9-]*$", agent.name):
            passed = False
            details.append(f"Invalid name format: {agent.name}")
        else:
            details.append(f"Name: {agent.name}")

    elif test.name == "structure_has_description":
        if not agent.description:
            passed = False
            details.append("Description is missing")
        elif len(agent.description) < 20:
            passed = False
            details.append(f"Description too short: {len(agent.description)} chars")
        else:
            details.append(f"Description: {agent.description[:50]}...")

    elif test.name == "structure_has_tools":
        if not agent.tools:
            passed = False
            details.append("No tools specified")
        else:
            details.append(f"Tools: {', '.join(agent.tools)}")

    elif test.name == "structure_has_workflow":
        if not agent.workflow_steps:
            passed = False
            details.append("No workflow steps found")
        else:
            details.append(f"Workflow: {len(agent.workflow_steps)} steps")

    elif test.name == "structure_has_examples":
        if not agent.examples:
            passed = False
            details.append("No examples found")
        else:
            details.append(f"Examples: {len(agent.examples)}")

    duration = int((time.time() - start) * 1000)

    return TestResult(
        test_name=test.name,
        passed=passed,
        duration_ms=duration,
        message="PASS" if passed else "FAIL",
        details=details,
    )


def find_claude_binary() -> str | None:
    """Find the claude CLI binary in PATH.

    Returns the path to the claude binary, or None if not found.
    """
    import shutil

    return shutil.which("claude")


def run_live_test(
    test: TestCase,
    agent_path: Path,
    claude_binary: str | None = None,
) -> TestResult:
    """Run a live agent invocation test using 'claude -p'.

    Invokes the claude CLI in non-interactive print mode with the agent's
    prompt, captures output, and matches against expected/forbidden patterns.

    Args:
        test: Test case with input_prompt, expected_patterns, timeout
        agent_path: Path to the agent .md file
        claude_binary: Path to claude binary (auto-detected if None)

    Returns:
        TestResult with pass/fail and matched pattern details
    """
    import subprocess
    import time

    start = time.time()
    details: list[str] = []

    # Find claude binary
    binary = claude_binary or find_claude_binary()
    if not binary:
        return TestResult(
            test_name=test.name,
            passed=False,
            duration_ms=0,
            message="SKIP: claude CLI not found in PATH",
            details=["Install Claude Code CLI to run live tests"],
        )

    # Build command: claude -p --agent <agent-file> "<prompt>"
    cmd = [
        binary,
        "-p",
        "--agent",
        str(agent_path),
        test.input_prompt,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=test.timeout_seconds,
        )
        output = result.stdout + result.stderr
        duration = int((time.time() - start) * 1000)

        # Check expected patterns
        passed = True
        matched_patterns: list[str] = []
        missing_patterns: list[str] = []

        for pattern in test.expected_patterns:
            if re.search(pattern, output, re.IGNORECASE):
                matched_patterns.append(pattern)
            else:
                missing_patterns.append(pattern)
                passed = False

        # Check forbidden patterns
        found_forbidden: list[str] = []
        for pattern in test.forbidden_patterns:
            if re.search(pattern, output, re.IGNORECASE):
                found_forbidden.append(pattern)
                passed = False

        if matched_patterns:
            details.append(f"Matched patterns: {', '.join(matched_patterns)}")
        if missing_patterns:
            details.append(f"Missing patterns: {', '.join(missing_patterns)}")
        if found_forbidden:
            details.append(f"Found forbidden: {', '.join(found_forbidden)}")
        if result.returncode != 0:
            # OQ-4 resolved: any non-zero exit code unconditionally fails the
            # test regardless of pattern match. A matching pattern in output
            # does not override a process-level failure signal.
            details.append(f"Exit code: {result.returncode} (non-zero exit forces failure)")
            passed = False

        return TestResult(
            test_name=test.name,
            passed=passed,
            duration_ms=duration,
            message="PASS" if passed else "FAIL",
            details=details,
        )

    except subprocess.TimeoutExpired:
        duration = int((time.time() - start) * 1000)
        return TestResult(
            test_name=test.name,
            passed=False,
            duration_ms=duration,
            message=f"TIMEOUT after {test.timeout_seconds}s",
            details=[f"Agent did not respond within {test.timeout_seconds} seconds"],
        )
    except FileNotFoundError:
        return TestResult(
            test_name=test.name,
            passed=False,
            duration_ms=0,
            message="SKIP: claude binary not executable",
            details=[f"Binary path: {binary}"],
        )
    except OSError as e:
        return TestResult(
            test_name=test.name,
            passed=False,
            duration_ms=0,
            message=f"ERROR: {e}",
            details=[str(e)],
        )


def run_pattern_test(test: TestCase, content: str) -> TestResult:
    """Run a pattern matching test against content."""
    import time

    start = time.time()

    passed = True
    details: list[str] = []

    # Check expected patterns
    for pattern in test.expected_patterns:
        if not re.search(pattern, content, re.IGNORECASE):
            passed = False
            details.append(f"Missing expected pattern: {pattern}")

    # Check forbidden patterns
    for pattern in test.forbidden_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            passed = False
            details.append(f"Found forbidden pattern: {pattern}")

    if passed and not details:
        details.append("All patterns matched")

    duration = int((time.time() - start) * 1000)

    return TestResult(
        test_name=test.name,
        passed=passed,
        duration_ms=duration,
        message="PASS" if passed else "FAIL",
        details=details,
    )


def create_live_tests(agent: AgentInfo) -> list[TestCase]:
    """Create test cases for live agent invocation via 'claude -p'.

    These tests are only run when --live flag is passed. Each test
    invokes the agent through the claude CLI and validates output.
    """
    tests: list[TestCase] = []

    # Test: Basic live invocation
    tests.append(
        TestCase(
            name="live_basic_invocation",
            description="Agent responds to a basic prompt via claude -p",
            input_prompt=f"Use the {agent.name} agent: {agent.description}",
            expected_patterns=[],  # Just verify it runs without error
            timeout_seconds=60,
        )
    )

    # Test: Agent identifies itself in output
    if agent.description:
        # Use first significant word from description as pattern
        desc_words = [w for w in agent.description.split() if len(w) > 4]
        if desc_words:
            tests.append(
                TestCase(
                    name="live_output_relevant",
                    description="Agent output relates to its described purpose",
                    input_prompt=f"Briefly describe what you do as {agent.name}",
                    expected_patterns=[desc_words[0]],
                    timeout_seconds=60,
                )
            )

    # Test: Agent does not produce dangerous output
    tests.append(
        TestCase(
            name="live_no_dangerous_output",
            description="Live output contains no dangerous commands",
            input_prompt=f"Show me how {agent.name} handles a simple task",
            forbidden_patterns=[
                r"rm\s+-rf\s+/",
                r"chmod\s+777",
                r">\s*/dev/sd",
            ],
            timeout_seconds=60,
        )
    )

    return tests


def run_test_suite(
    agent_path: Path,
    test_cases: list[TestCase] | None = None,
    quick: bool = False,
    live: bool = False,
) -> TestSuiteResult:
    """Run a complete test suite for an agent.

    Args:
        agent_path: Path to agent .md file
        test_cases: Custom test cases (overrides auto-generation)
        quick: Only run structure tests
        live: Run live invocation tests via 'claude -p'
    """
    agent = parse_agent_file(agent_path)

    if agent is None:
        return TestSuiteResult(
            agent_name="unknown",
            agent_path=str(agent_path),
            total_tests=0,
            passed_tests=0,
            failed_tests=1,
            skipped_tests=0,
            results=[
                TestResult(
                    test_name="parse_agent",
                    passed=False,
                    message="Failed to parse agent file",
                )
            ],
            summary="Failed to parse agent file",
        )

    # Build test cases
    if test_cases is None:
        test_cases = []
        test_cases.extend(create_structure_tests(agent))
        if not quick:
            test_cases.extend(create_invocation_tests(agent))
            test_cases.extend(create_response_tests(agent))
        if live:
            test_cases.extend(create_live_tests(agent))

    # Read full content for pattern tests
    content = agent_path.read_text(encoding="utf-8")

    # Run tests
    results: list[TestResult] = []
    passed = 0
    failed = 0
    skipped = 0

    for test in test_cases:
        if test.skip:
            skipped += 1
            results.append(
                TestResult(
                    test_name=test.name,
                    passed=True,
                    message=f"SKIP: {test.skip_reason}",
                )
            )
            continue

        # Determine test type and run
        if test.name.startswith("structure_"):
            result = run_structure_test(test, agent)
        elif test.name.startswith("live_"):
            result = run_live_test(test, agent_path)
        else:
            result = run_pattern_test(test, content)

        results.append(result)
        if result.passed:
            passed += 1
        else:
            failed += 1

    # Generate summary
    total = len(test_cases)
    summary = f"{passed}/{total} tests passed"
    if failed > 0:
        summary += f", {failed} failed"
    if skipped > 0:
        summary += f", {skipped} skipped"

    return TestSuiteResult(
        agent_name=agent.name,
        agent_path=str(agent_path),
        total_tests=total,
        passed_tests=passed,
        failed_tests=failed,
        skipped_tests=skipped,
        results=results,
        summary=summary,
    )


def load_test_file(test_file: Path) -> list[TestCase]:
    """Load test cases from a JSON file."""
    if not test_file.exists():
        return []

    data = json.loads(test_file.read_text(encoding="utf-8"))
    tests: list[TestCase] = []

    for test_data in data.get("tests", []):
        tests.append(
            TestCase(
                name=test_data.get("name", "unnamed"),
                description=test_data.get("description", ""),
                input_prompt=test_data.get("input_prompt", ""),
                expected_patterns=test_data.get("expected_patterns", []),
                forbidden_patterns=test_data.get("forbidden_patterns", []),
                expected_tools=test_data.get("expected_tools", []),
                timeout_seconds=test_data.get("timeout_seconds", 30),
                skip=test_data.get("skip", False),
                skip_reason=test_data.get("skip_reason", ""),
            )
        )

    return tests


def create_test_template(agent: AgentInfo) -> dict[str, Any]:
    """Create a test template for an agent.

    Auto-generates test cases from the agent's Examples section:
    - User Request prompts become test input_prompt values
    - Agent Actions descriptions become expected_patterns
    - Expected Output keywords are extracted as additional patterns

    Falls back to generic tests if no parseable examples exist.
    """
    tests: list[dict[str, Any]] = []

    # Auto-generate tests from parsed examples
    for i, example in enumerate(agent.examples):
        user_request = example.get("user_request", "")
        agent_actions = example.get("agent_actions", "")
        expected_output = example.get("expected_output", "")
        title = example.get("title", f"Example {i + 1}")

        if user_request:
            # Build expected patterns from agent actions and output
            patterns: list[str] = []

            # Extract key action verbs as patterns
            if agent_actions:
                # Take first 2-3 significant words from each action
                for action in agent_actions.split(";")[:3]:
                    action = action.strip()
                    # Extract the main verb/noun phrase
                    words = [w for w in action.split() if len(w) > 3]
                    if words:
                        patterns.append(re.escape(words[0]))

            # Extract status pattern from expected output
            if expected_output:
                if '"status"' in expected_output:
                    patterns.append(r'"status"')
                if agent.name in expected_output:
                    patterns.append(re.escape(agent.name))

            tests.append(
                {
                    "name": f"example_{i + 1}_{_slugify(title)}",
                    "description": f"Test from example: {title}",
                    "input_prompt": user_request,
                    "expected_patterns": patterns,
                    "forbidden_patterns": [],
                    "timeout_seconds": 60,
                }
            )

    # Add generic fallback tests if no examples were parsed
    if not tests:
        tests.append(
            {
                "name": "basic_invocation",
                "description": "Test basic agent invocation",
                "input_prompt": f"Use {agent.name} to perform its primary task",
                "expected_patterns": [agent.name],
                "forbidden_patterns": [],
                "timeout_seconds": 30,
            }
        )

    # Always include workflow and error tests
    tests.append(
        {
            "name": "workflow_execution",
            "description": "Test that workflow steps are followed",
            "input_prompt": "Execute the full workflow",
            "expected_patterns": agent.workflow_steps[:2] if agent.workflow_steps else [],
            "forbidden_patterns": [],
            "timeout_seconds": 60,
        }
    )
    tests.append(
        {
            "name": "error_handling",
            "description": "Test error handling with invalid input",
            "input_prompt": "Handle an invalid or empty input",
            "expected_patterns": ["error", "invalid", "empty"],
            "forbidden_patterns": ["crash", "exception", "traceback"],
            "timeout_seconds": 30,
        }
    )

    return {
        "agent_name": agent.name,
        "description": f"Test suite for {agent.name} agent",
        "tests": tests,
    }


def _slugify(text: str) -> str:
    """Convert text to a slug suitable for test names."""
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower())
    return slug.strip("_")[:40]


def result_to_dict(result: TestSuiteResult) -> dict[str, Any]:
    """Convert test result to dictionary."""
    return {
        "agent_name": result.agent_name,
        "agent_path": result.agent_path,
        "total_tests": result.total_tests,
        "passed_tests": result.passed_tests,
        "failed_tests": result.failed_tests,
        "skipped_tests": result.skipped_tests,
        "summary": result.summary,
        "results": [
            {
                "test_name": r.test_name,
                "passed": r.passed,
                "duration_ms": r.duration_ms,
                "message": r.message,
                "details": r.details,
            }
            for r in result.results
        ],
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Test harness for agent invocation testing")
    parser.add_argument("agent_file", help="Agent definition file to test")
    parser.add_argument("--test-file", help="JSON file with test cases")
    parser.add_argument("--quick", action="store_true", help="Run structure tests only")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run live agent invocation tests via 'claude -p'",
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument(
        "--create-tests",
        action="store_true",
        help="Generate test template for agent",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")

    args = parser.parse_args()

    agent_path = Path(args.agent_file)

    if not agent_path.exists():
        print(f"Error: Agent file not found: {args.agent_file}", file=sys.stderr)
        sys.exit(1)

    # Create test template
    if args.create_tests:
        agent = parse_agent_file(agent_path)
        if agent is None:
            print("Error: Could not parse agent file", file=sys.stderr)
            sys.exit(1)

        template = create_test_template(agent)
        print(json.dumps(template, indent=2))
        sys.exit(0)

    # Load custom tests if provided
    test_cases = None
    if args.test_file:
        test_cases = load_test_file(Path(args.test_file))

    # Run test suite
    result = run_test_suite(agent_path, test_cases, quick=args.quick, live=args.live)

    if args.json:
        print(json.dumps(result_to_dict(result), indent=2))
    else:
        # Display results
        status = "✓ PASSED" if result.failed_tests == 0 else "✗ FAILED"
        print(f"\n{status}: {result.agent_name}")
        print(f"Path: {result.agent_path}")
        print(f"Summary: {result.summary}")
        print()

        # Show individual tests
        print("Test Results:")
        print("-" * 60)
        for test_result in result.results:
            icon = "✓" if test_result.passed else "✗"
            print(f"  {icon} {test_result.test_name}: {test_result.message}")

            if args.verbose or not test_result.passed:
                for detail in test_result.details:
                    print(f"      {detail}")

        print("-" * 60)
        print(f"  Total: {result.passed_tests} passed, {result.failed_tests} failed")
        print()

    # Exit code
    sys.exit(0 if result.failed_tests == 0 else 1)


if __name__ == "__main__":
    main()
