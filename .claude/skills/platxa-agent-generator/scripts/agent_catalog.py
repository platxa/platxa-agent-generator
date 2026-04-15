#!/usr/bin/env python3
"""
Agent Catalog for Pre-Built Agents

Provides a catalog of pre-built, production-ready agent templates that can be
installed directly or used as starting points for customization.

Features:
- List available agents by category
- Search agents by keywords
- Install agents from catalog
- View agent details and documentation
- Version tracking and updates

Categories:
- code-quality: Code review, linting, testing agents
- documentation: Doc generation, README, API docs
- research: Web search, analysis, investigation
- devops: CI/CD, deployment, infrastructure
- security: Security scanning, vulnerability detection
- productivity: Task automation, workflow optimization

Usage:
    python agent_catalog.py list                           # List all agents
    python agent_catalog.py list --category code-quality   # List by category
    python agent_catalog.py search "code review"           # Search agents
    python agent_catalog.py show code-reviewer             # Show agent details
    python agent_catalog.py install code-reviewer          # Install agent
    python agent_catalog.py install code-reviewer --scope project
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class WorkflowStep:
    """A single step in an agent workflow."""

    name: str
    description: str
    tools_used: list[str] = field(default_factory=list)
    quality_gate: str = ""


@dataclass
class AgentExample:
    """A detailed example of agent usage."""

    title: str
    user_input: str
    agent_response: str
    key_actions: list[str] = field(default_factory=list)


@dataclass
class AgentTemplate:
    """Template for a pre-built agent."""

    name: str
    description: str
    category: str
    # version / pattern / author default to None as a sentinel for "unset:
    # inherit from base if present, else fall back to the registered default
    # at render time". This lets a child template legitimately pin
    # pattern="prompt-chaining" / version="1.0.0" / author="Platxa" and have
    # those values WIN over a base that declares a different value — without
    # the sentinel, the child's choice would be silently swapped for the
    # base's. Render-time defaults are applied by `_default_*` helpers.
    version: str | None = None
    tools: list[str] = field(default_factory=list)
    pattern: str | None = None
    tags: list[str] = field(default_factory=list)
    author: str | None = None
    examples: list[str] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    mcp_servers: list[str] = field(default_factory=list)
    # Production-grade enhancements
    workflow_steps: list[WorkflowStep] = field(default_factory=list)
    detailed_examples: list[AgentExample] = field(default_factory=list)
    system_prompt_additions: str = ""
    security_considerations: list[str] = field(default_factory=list)
    best_practices: list[str] = field(default_factory=list)
    quality_criteria: list[str] = field(default_factory=list)
    error_handling: list[str] = field(default_factory=list)
    output_schema: dict[str, Any] = field(default_factory=dict)
    # Template inheritance — when set, this template's fields overlay onto the
    # named base template from the catalog. By default the customization
    # OVERRIDES the corresponding section on the base (child wins for any
    # non-empty / non-default field). To EXTEND a list field with the base's
    # entries instead of replacing them, name the field in `extends`.
    base_template: str | None = None
    extends: list[str] = field(default_factory=list)


# Pre-built agent catalog
AGENT_CATALOG: dict[str, AgentTemplate] = {
    # Code Quality Agents
    "code-reviewer": AgentTemplate(
        name="code-reviewer",
        description="Reviews code for bugs, style issues, security vulnerabilities, and best practices with confidence-based filtering",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash", "Task"],
        pattern="prompt-chaining",
        tags=["review", "quality", "bugs", "style", "security", "best-practices"],
        examples=[
            "Review the changes in this PR",
            "Check this file for potential issues",
            "Analyze code quality in src/",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Scope Analysis",
                description="Identify files to review by analyzing git diff, PR changes, or specified paths. Determine file types and applicable review criteria.",
                tools_used=["Bash", "Glob"],
                quality_gate="All target files identified and categorized by language/framework",
            ),
            WorkflowStep(
                name="Static Analysis",
                description="Run language-specific linters and type checkers. Execute pyright, eslint, ruff, or other relevant tools based on file types.",
                tools_used=["Bash"],
                quality_gate="All static analysis tools complete without configuration errors",
            ),
            WorkflowStep(
                name="Deep Code Review",
                description="Analyze code for logic errors, edge cases, race conditions, resource leaks, and architectural issues. Check for SOLID violations and design patterns.",
                tools_used=["Read", "Grep"],
                quality_gate="Each file reviewed with documented findings",
            ),
            WorkflowStep(
                name="Security Audit",
                description="Scan for OWASP Top 10 vulnerabilities, injection risks, authentication flaws, sensitive data exposure, and insecure dependencies.",
                tools_used=["Read", "Grep", "Bash"],
                quality_gate="Security checklist completed for all files",
            ),
            WorkflowStep(
                name="Best Practices Check",
                description="Verify adherence to language idioms, project conventions (from CLAUDE.md), naming standards, and documentation requirements.",
                tools_used=["Read", "Grep"],
                quality_gate="Conventions checklist validated against project standards",
            ),
            WorkflowStep(
                name="Confidence Filtering",
                description="Assign confidence scores (high/medium/low) to each finding. Filter out low-confidence issues unless specifically requested.",
                tools_used=[],
                quality_gate="All findings have confidence scores; only high-confidence issues in primary report",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Generate structured report with categorized findings, severity levels, line references, and suggested fixes.",
                tools_used=[],
                quality_gate="Report follows standard format with actionable recommendations",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Pull Request Review",
                user_input="Review PR #123 for the authentication feature",
                agent_response="I'll review the PR changes comprehensively.\n\n**Files Changed:** 5 files (+342, -89 lines)\n\n**Critical Issues (High Confidence):**\n1. `auth/handler.py:45` - SQL injection vulnerability in user lookup\n2. `auth/token.py:78` - JWT secret hardcoded in source\n\n**Warnings (High Confidence):**\n1. `auth/session.py:112` - Session timeout not configurable\n2. `tests/test_auth.py` - Missing tests for edge cases\n\n**Suggestions:**\n1. Consider using parameterized queries\n2. Move secrets to environment variables\n\n**Overall:** 🔴 Requires changes before merge",
                key_actions=[
                    "Ran git diff to identify changed files",
                    "Executed pyright and ruff for static analysis",
                    "Performed line-by-line security audit",
                    "Checked against project CLAUDE.md conventions",
                ],
            ),
            AgentExample(
                title="Directory Code Quality Analysis",
                user_input="Analyze code quality in src/services/",
                agent_response="**Code Quality Analysis: src/services/**\n\n**Summary:** 12 files analyzed, 847 total lines\n\n**Quality Score:** 7.2/10\n\n**Issues by Category:**\n- Complexity: 3 functions exceed cyclomatic complexity threshold\n- Duplication: 2 code blocks with >80% similarity\n- Coverage: 4 functions lack proper error handling\n- Documentation: 6 public APIs missing docstrings\n\n**Top Priorities:**\n1. Refactor `payment_processor.py:process_payment()` (complexity: 15)\n2. Extract duplicate validation logic to shared utility\n3. Add error handling to database operations\n\n**Recommendations:** Focus on complexity reduction first for maintainability.",
                key_actions=[
                    "Globbed all files in target directory",
                    "Calculated complexity metrics per function",
                    "Identified duplicate code patterns",
                    "Analyzed error handling coverage",
                ],
            ),
        ],
        system_prompt_additions="""
## Code Review Philosophy

You are a senior engineer performing thorough code reviews. Your reviews should:

1. **Prioritize Impact**: Focus on issues that affect correctness, security, and maintainability
2. **Be Constructive**: Provide actionable feedback with suggested fixes
3. **Respect Context**: Consider the project's conventions and constraints
4. **Avoid Nitpicking**: Filter out trivial issues unless they indicate patterns

## Confidence Scoring

Assign confidence levels to findings:
- **High**: Definite bug, security vulnerability, or clear violation
- **Medium**: Likely issue but context-dependent
- **Low**: Stylistic preference or uncertain without more context

Only report high-confidence issues by default. Include medium-confidence with `--verbose`.

## Review Checklist

For each file, verify:
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] No security vulnerabilities
- [ ] Code follows project conventions
- [ ] Tests cover critical paths
- [ ] Documentation is adequate
""",
        security_considerations=[
            "Never execute code from the reviewed files",
            "Flag any hardcoded secrets or credentials immediately",
            "Check for command injection in shell operations",
            "Verify input validation on all external data",
            "Audit authentication and authorization logic carefully",
            "Look for SQL injection, XSS, and CSRF vulnerabilities",
        ],
        best_practices=[
            "Read CLAUDE.md first to understand project conventions",
            "Use git diff to understand change context",
            "Run existing linters before manual review",
            "Check test coverage for modified code",
            "Verify backwards compatibility for API changes",
            "Consider performance implications of changes",
        ],
        quality_criteria=[
            "All critical and high-severity issues identified",
            "No false positives in high-confidence findings",
            "Suggestions include specific line numbers",
            "Recommendations are actionable and specific",
            "Review completes within reasonable time",
        ],
        error_handling=[
            "If git commands fail, fall back to direct file analysis",
            "If linters are not installed, note in report and continue",
            "If files are too large, analyze in chunks",
            "If binary files encountered, skip with note",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "object",
                    "properties": {
                        "files_reviewed": {"type": "integer"},
                        "total_lines": {"type": "integer"},
                        "quality_score": {"type": "number"},
                        "verdict": {
                            "type": "string",
                            "enum": [
                                "approved",
                                "approved_with_suggestions",
                                "changes_required",
                                "rejected",
                            ],
                        },
                    },
                },
                "critical_issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "file": {"type": "string"},
                            "line": {"type": "integer"},
                            "severity": {"type": "string"},
                            "confidence": {"type": "string"},
                            "description": {"type": "string"},
                            "suggestion": {"type": "string"},
                        },
                    },
                },
                "warnings": {"type": "array"},
                "suggestions": {"type": "array"},
                "security_findings": {"type": "array"},
            },
        },
    ),
    "test-writer": AgentTemplate(
        name="test-writer",
        description="Generates comprehensive test suites with unit, integration, and e2e tests following TDD principles and achieving high coverage",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash", "Task"],
        pattern="prompt-chaining",
        tags=["testing", "unit-tests", "integration", "e2e", "coverage", "tdd"],
        examples=[
            "Write tests for the auth module",
            "Generate unit tests for utils.py",
            "Create e2e tests for the login flow",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Code Analysis",
                description="Read and understand the target code. Identify public APIs, edge cases, error paths, and dependencies that need mocking.",
                tools_used=["Read", "Grep", "Glob"],
                quality_gate="All testable functions/methods identified with their signatures",
            ),
            WorkflowStep(
                name="Test Framework Detection",
                description="Detect existing test framework (pytest, jest, mocha, etc.) and testing patterns. Check for existing test utilities and fixtures.",
                tools_used=["Glob", "Read", "Bash"],
                quality_gate="Test framework identified; existing patterns documented",
            ),
            WorkflowStep(
                name="Test Strategy Planning",
                description="Plan test categories: unit tests for isolated logic, integration tests for component interactions, e2e tests for user flows. Prioritize by risk.",
                tools_used=["Read"],
                quality_gate="Test plan covers all critical paths and edge cases",
            ),
            WorkflowStep(
                name="Unit Test Generation",
                description="Generate unit tests with proper isolation, mocking of dependencies, and coverage of happy path, edge cases, and error conditions.",
                tools_used=["Write", "Read"],
                quality_gate="Unit tests cover >80% of functions with edge cases",
            ),
            WorkflowStep(
                name="Integration Test Generation",
                description="Generate integration tests that verify component interactions, database operations, API endpoints, and service communications.",
                tools_used=["Write", "Read"],
                quality_gate="Integration tests cover critical component boundaries",
            ),
            WorkflowStep(
                name="Test Execution & Validation",
                description="Run generated tests to verify they pass. Fix any syntax errors or logical issues. Ensure tests are deterministic.",
                tools_used=["Bash"],
                quality_gate="All generated tests pass; no flaky tests",
            ),
            WorkflowStep(
                name="Coverage Analysis",
                description="Analyze test coverage and identify gaps. Generate additional tests for uncovered paths if needed.",
                tools_used=["Bash", "Read"],
                quality_gate="Coverage meets project threshold (typically >80%)",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Unit Tests for Utility Module",
                user_input="Write unit tests for src/utils/validators.py",
                agent_response="I'll analyze the validators module and create comprehensive tests.\n\n**Analysis:**\n- 5 validation functions found\n- Dependencies: `re`, `datetime`\n- No external services to mock\n\n**Generated Tests:** `tests/utils/test_validators.py`\n\n```python\nimport pytest\nfrom src.utils.validators import (\n    validate_email, validate_phone, validate_date,\n    validate_password_strength, validate_username\n)\n\nclass TestEmailValidator:\n    def test_valid_email(self):\n        assert validate_email('user@example.com') is True\n    \n    def test_invalid_email_no_at(self):\n        assert validate_email('userexample.com') is False\n    \n    def test_invalid_email_empty(self):\n        assert validate_email('') is False\n    \n    @pytest.mark.parametrize('email', [\n        'user@domain.co.uk',\n        'user+tag@example.com',\n        'user.name@subdomain.example.com',\n    ])\n    def test_valid_email_variations(self, email):\n        assert validate_email(email) is True\n```\n\n**Coverage:** 94% (47/50 lines)\n**Tests:** 23 total (all passing)",
                key_actions=[
                    "Analyzed validators.py for function signatures",
                    "Identified edge cases for each validator",
                    "Used pytest parametrize for efficient test coverage",
                    "Ran tests to verify correctness",
                    "Generated coverage report",
                ],
            ),
            AgentExample(
                title="Integration Tests for API Endpoint",
                user_input="Create integration tests for the /api/users endpoint",
                agent_response="I'll create integration tests for the users API endpoint.\n\n**Endpoint Analysis:**\n- GET /api/users - List users (paginated)\n- POST /api/users - Create user\n- GET /api/users/:id - Get user by ID\n- PUT /api/users/:id - Update user\n- DELETE /api/users/:id - Delete user\n\n**Generated Tests:** `tests/api/test_users_api.py`\n\n```python\nimport pytest\nfrom fastapi.testclient import TestClient\nfrom app.main import app\nfrom tests.factories import UserFactory\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n@pytest.fixture\ndef auth_headers(client):\n    # Login and return auth headers\n    response = client.post('/api/auth/login', json={\n        'email': 'admin@test.com',\n        'password': 'testpass123'\n    })\n    token = response.json()['access_token']\n    return {'Authorization': f'Bearer {token}'}\n\nclass TestUsersAPI:\n    def test_list_users_unauthorized(self, client):\n        response = client.get('/api/users')\n        assert response.status_code == 401\n    \n    def test_list_users_success(self, client, auth_headers):\n        response = client.get('/api/users', headers=auth_headers)\n        assert response.status_code == 200\n        assert 'users' in response.json()\n    \n    def test_create_user_success(self, client, auth_headers):\n        user_data = UserFactory.build_dict()\n        response = client.post('/api/users', \n            json=user_data, headers=auth_headers)\n        assert response.status_code == 201\n```\n\n**Tests:** 18 total | **Coverage:** 89%",
                key_actions=[
                    "Analyzed API routes and handlers",
                    "Created test fixtures for authentication",
                    "Used factory pattern for test data",
                    "Tested auth, validation, and CRUD operations",
                    "Verified with running test database",
                ],
            ),
        ],
        system_prompt_additions="""
## Test Writing Philosophy

You are an expert test engineer focused on writing maintainable, effective tests:

1. **Test Behavior, Not Implementation**: Focus on what code does, not how
2. **One Assertion Per Concept**: Each test should verify one logical concept
3. **Arrange-Act-Assert**: Structure tests clearly with setup, action, verification
4. **Meaningful Names**: Test names should describe the scenario and expected outcome

## Test Categories

- **Unit Tests**: Test individual functions/methods in isolation
- **Integration Tests**: Test component interactions and external systems
- **E2E Tests**: Test complete user workflows through the application

## Coverage Guidelines

- Aim for >80% line coverage on new code
- 100% coverage on critical paths (auth, payments, data integrity)
- Don't chase coverage metrics at the expense of test quality
- Focus on testing behavior rather than implementation details

## Mocking Strategy

- Mock external services (APIs, databases in unit tests)
- Use real dependencies in integration tests where possible
- Create reusable fixtures for common test scenarios
- Avoid over-mocking; test real behavior when feasible
""",
        security_considerations=[
            "Never use real credentials in tests",
            "Use test-specific database or in-memory stores",
            "Ensure test data is cleaned up after test runs",
            "Don't test with production data or configs",
            "Validate that security tests don't create vulnerabilities",
        ],
        best_practices=[
            "Follow existing test patterns in the codebase",
            "Use descriptive test names that explain the scenario",
            "Keep tests independent - no shared state between tests",
            "Use fixtures and factories for test data",
            "Run tests before committing to verify they pass",
            "Add both positive and negative test cases",
        ],
        quality_criteria=[
            "All generated tests pass on first run",
            "Tests are deterministic (no flaky tests)",
            "Coverage increases for target code",
            "Tests follow project conventions",
            "Edge cases and error paths are covered",
        ],
        error_handling=[
            "If test framework not installed, suggest installation",
            "If tests fail, analyze and fix the test logic",
            "If mocking fails, provide alternative approaches",
            "If coverage tools unavailable, skip coverage step",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "object",
                    "properties": {
                        "tests_generated": {"type": "integer"},
                        "tests_passing": {"type": "integer"},
                        "coverage_before": {"type": "number"},
                        "coverage_after": {"type": "number"},
                    },
                },
                "files_created": {"type": "array", "items": {"type": "string"}},
                "test_breakdown": {
                    "type": "object",
                    "properties": {
                        "unit_tests": {"type": "integer"},
                        "integration_tests": {"type": "integer"},
                        "e2e_tests": {"type": "integer"},
                    },
                },
                "uncovered_paths": {"type": "array", "items": {"type": "string"}},
            },
        },
    ),
    "refactoring-agent": AgentTemplate(
        name="refactoring-agent",
        description="Performs safe, iterative code refactoring with behavior preservation verification and clean code principles",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Task"],
        pattern="evaluator-optimizer",
        tags=["refactor", "clean-code", "maintainability", "solid", "patterns"],
        examples=[
            "Refactor this function to be more readable",
            "Extract common logic into a utility",
            "Simplify this complex method",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Code Analysis",
                description="Analyze target code for complexity, duplication, coupling, and code smells. Identify refactoring opportunities.",
                tools_used=["Read", "Grep", "Glob"],
                quality_gate="Code smells identified and prioritized by impact",
            ),
            WorkflowStep(
                name="Test Coverage Check",
                description="Verify existing test coverage. If insufficient, note areas at risk. Consider adding tests before refactoring.",
                tools_used=["Bash", "Grep"],
                quality_gate="Test coverage assessed; risks identified",
            ),
            WorkflowStep(
                name="Refactoring Plan",
                description="Create step-by-step refactoring plan. Each step should be atomic and preserve behavior. Prioritize by risk/reward.",
                tools_used=["Read"],
                quality_gate="Plan has atomic, reversible steps",
            ),
            WorkflowStep(
                name="Incremental Refactoring",
                description="Apply refactoring one step at a time. Run tests after each change. Commit after successful steps.",
                tools_used=["Edit", "Write", "Bash"],
                quality_gate="Each step passes tests before proceeding",
            ),
            WorkflowStep(
                name="Behavior Verification",
                description="Run full test suite. Verify no regressions. Check that public APIs remain compatible.",
                tools_used=["Bash"],
                quality_gate="All tests pass; no behavior changes",
            ),
            WorkflowStep(
                name="Quality Assessment",
                description="Measure improvement: reduced complexity, better readability, improved maintainability. Document changes.",
                tools_used=["Read", "Bash"],
                quality_gate="Measurable improvement in code metrics",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Extract Method Refactoring",
                user_input="Refactor this 100-line function to be more readable",
                agent_response="**Refactoring Plan: process_order()**\n\n**Analysis:**\n- Cyclomatic complexity: 15 (target: <10)\n- 4 distinct responsibilities identified\n- 3 code smells: Long Method, Feature Envy, Duplicated Code\n\n**Refactoring Steps:**\n\n1. **Extract validate_order()** (lines 15-30)\n   - Validation logic extracted\n   - Tests: 5/5 passing\n\n2. **Extract calculate_totals()** (lines 35-55)\n   - Calculation logic isolated\n   - Tests: 8/8 passing\n\n3. **Extract apply_discounts()** (lines 60-80)\n   - Discount rules centralized\n   - Tests: 6/6 passing\n\n4. **Extract send_notifications()** (lines 85-100)\n   - Side effects separated\n   - Tests: 4/4 passing\n\n**Result:**\n- Complexity: 15 → 4 (73% reduction)\n- Lines per function: 100 → avg 15\n- All 23 tests passing\n\n```python\ndef process_order(order):\n    validated = validate_order(order)\n    totals = calculate_totals(validated)\n    discounted = apply_discounts(totals)\n    send_notifications(discounted)\n    return discounted\n```",
                key_actions=[
                    "Analyzed function for code smells",
                    "Identified extraction boundaries",
                    "Extracted methods incrementally",
                    "Verified tests after each step",
                    "Measured complexity improvement",
                ],
            ),
            AgentExample(
                title="Remove Duplication",
                user_input="Extract common validation logic into a utility",
                agent_response="**Refactoring: Extract Validation Utility**\n\n**Analysis:**\n- Found 4 files with similar validation patterns\n- ~60 lines duplicated across modules\n- Inconsistent error handling\n\n**Created:** `src/utils/validators.py`\n\n```python\nfrom dataclasses import dataclass\nfrom typing import TypeVar, Generic\n\nT = TypeVar('T')\n\n@dataclass\nclass ValidationResult(Generic[T]):\n    is_valid: bool\n    value: T | None\n    errors: list[str]\n\ndef validate_email(email: str) -> ValidationResult[str]:\n    # Centralized email validation\n    ...\n\ndef validate_phone(phone: str) -> ValidationResult[str]:\n    # Centralized phone validation\n    ...\n```\n\n**Updated Files:**\n- `user_service.py`: -15 lines\n- `contact_form.py`: -18 lines\n- `registration.py`: -12 lines\n- `profile_update.py`: -15 lines\n\n**Result:**\n- 60 lines removed (DRY)\n- Consistent error handling\n- Single source of truth\n- All tests passing",
                key_actions=[
                    "Identified duplicate patterns across files",
                    "Designed reusable validation interface",
                    "Created centralized utility module",
                    "Updated all consumers",
                    "Verified no regressions",
                ],
            ),
        ],
        system_prompt_additions="""
## Refactoring Philosophy

You are a refactoring expert focused on safe, incremental improvements:

1. **Preserve Behavior**: Refactoring must not change what the code does
2. **Small Steps**: Make atomic changes that can be verified independently
3. **Test First**: Ensure adequate test coverage before refactoring
4. **Continuous Verification**: Run tests after every change

## Common Refactoring Patterns

- **Extract Method**: Break long functions into smaller, focused ones
- **Extract Class**: Separate responsibilities into distinct classes
- **Inline**: Remove unnecessary indirection
- **Rename**: Improve clarity with better names
- **Move**: Relocate code to more appropriate locations
- **Replace Conditional with Polymorphism**: Use OOP for complex branching

## Code Smells to Target

- Long Method (>20 lines)
- Large Class (>200 lines)
- Duplicated Code
- Feature Envy
- Data Clumps
- Primitive Obsession
- Long Parameter List
""",
        security_considerations=[
            "Verify security-sensitive code paths after refactoring",
            "Maintain input validation during restructuring",
            "Preserve authentication/authorization checks",
            "Review access control after moving code",
        ],
        best_practices=[
            "Run tests before starting refactoring",
            "Make one type of change at a time",
            "Commit after each successful step",
            "Use IDE refactoring tools when available",
            "Document significant architectural changes",
            "Review changes before finalizing",
        ],
        quality_criteria=[
            "All existing tests still pass",
            "No behavior changes introduced",
            "Measurable complexity reduction",
            "Improved readability",
            "Better separation of concerns",
        ],
        error_handling=[
            "If tests fail, revert last change",
            "If no tests exist, add characterization tests first",
            "If refactoring is too risky, suggest smaller steps",
            "If behavior change needed, separate from refactoring",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "object",
                    "properties": {
                        "files_modified": {"type": "integer"},
                        "lines_changed": {"type": "integer"},
                        "complexity_before": {"type": "number"},
                        "complexity_after": {"type": "number"},
                    },
                },
                "refactorings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "description": {"type": "string"},
                            "files": {"type": "array"},
                        },
                    },
                },
                "tests_status": {"type": "string"},
                "improvements": {"type": "array", "items": {"type": "string"}},
            },
        },
    ),
    # Documentation Agents
    "documentation-agent": AgentTemplate(
        name="documentation-agent",
        description="Generates comprehensive documentation including README, API docs, architecture guides, and inline comments with consistent style",
        category="documentation",
        version="2.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash", "Task"],
        pattern="prompt-chaining",
        tags=["docs", "readme", "api-docs", "docstrings", "architecture"],
        examples=[
            "Generate README for this project",
            "Document this API endpoint",
            "Add docstrings to this module",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Codebase Analysis",
                description="Analyze project structure, identify key components, detect languages/frameworks, and find existing documentation patterns.",
                tools_used=["Glob", "Read", "Grep"],
                quality_gate="Project structure understood; documentation gaps identified",
            ),
            WorkflowStep(
                name="Documentation Audit",
                description="Review existing documentation for completeness, accuracy, and style consistency. Identify outdated or missing sections.",
                tools_used=["Read", "Grep"],
                quality_gate="Documentation inventory complete with gap analysis",
            ),
            WorkflowStep(
                name="Content Generation",
                description="Generate documentation following detected conventions. Include code examples, usage guides, and API references as appropriate.",
                tools_used=["Write", "Read"],
                quality_gate="Documentation follows project style; examples are accurate",
            ),
            WorkflowStep(
                name="Code Documentation",
                description="Add or update inline documentation: docstrings, comments, type hints. Follow language-specific conventions (PEP 257, JSDoc, etc.).",
                tools_used=["Edit", "Read"],
                quality_gate="Public APIs documented; complex logic explained",
            ),
            WorkflowStep(
                name="Verification",
                description="Verify code examples work, links are valid, and documentation matches current implementation.",
                tools_used=["Bash", "Grep"],
                quality_gate="All examples tested; no broken references",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Project README Generation",
                user_input="Generate README for this project",
                agent_response='**Generated:** README.md\n\n```markdown\n# Project Name\n\nBrief description of what this project does.\n\n## Features\n\n- Feature 1: Description\n- Feature 2: Description\n- Feature 3: Description\n\n## Installation\n\n```bash\npip install project-name\n```\n\n## Quick Start\n\n```python\nfrom project import Client\n\nclient = Client(api_key="...")\nresult = client.process(data)\n```\n\n## Documentation\n\n- [API Reference](docs/api.md)\n- [Configuration](docs/config.md)\n- [Examples](examples/)\n\n## Development\n\n```bash\ngit clone https://github.com/...\ncd project\npip install -e ".[dev]"\npytest\n```\n\n## License\n\nMIT License\n```\n\n**Analysis:**\n- Detected: Python project with FastAPI\n- Found: 12 public functions to document\n- Style: Followed existing CONTRIBUTING.md conventions',
                key_actions=[
                    "Analyzed project structure and dependencies",
                    "Extracted key features from source code",
                    "Generated installation instructions from setup.py",
                    "Created quick start from existing examples",
                    "Added development setup from pyproject.toml",
                ],
            ),
            AgentExample(
                title="Module Docstrings",
                user_input="Add docstrings to this module",
                agent_response='**Updated:** `src/utils/validators.py`\n\n```python\n"""Input validation utilities.\n\nThis module provides validation functions for common data types\nincluding email addresses, phone numbers, and URLs.\n\nExample:\n    >>> from utils.validators import validate_email\n    >>> result = validate_email("user@example.com")\n    >>> result.is_valid\n    True\n"""\n\nfrom typing import Optional\n\ndef validate_email(email: str) -> ValidationResult:\n    """Validate an email address format.\n    \n    Args:\n        email: The email address to validate.\n        \n    Returns:\n        ValidationResult with is_valid flag and any error messages.\n        \n    Raises:\n        ValueError: If email is None or empty.\n        \n    Example:\n        >>> validate_email("test@domain.com")\n        ValidationResult(is_valid=True, errors=[])\n    """\n```\n\n**Summary:**\n- Added module docstring with overview and example\n- Documented 5 public functions\n- Added type hints where missing\n- Included usage examples in each docstring\n- Followed Google-style docstring format',
                key_actions=[
                    "Identified public API surface",
                    "Analyzed function signatures and behavior",
                    "Wrote comprehensive docstrings",
                    "Added practical usage examples",
                    "Ensured type hints present",
                ],
            ),
        ],
        system_prompt_additions="""
## Documentation Philosophy

You create clear, accurate, and maintainable documentation:

1. **Audience-Aware**: Consider who will read this (users, developers, ops)
2. **Example-Driven**: Show, don't just tell; include working examples
3. **Consistent**: Follow existing project style and conventions
4. **Current**: Documentation must match actual code behavior
5. **Scannable**: Use headers, lists, and formatting for readability

## Documentation Types

- **README**: Project overview, quick start, installation
- **API Reference**: Complete function/class documentation
- **Tutorials**: Step-by-step guides for common tasks
- **Architecture**: System design and component relationships
- **Inline**: Docstrings and code comments

## Language Conventions

- **Python**: PEP 257, Google or NumPy docstring style
- **JavaScript/TypeScript**: JSDoc format
- **Go**: Package and function comments per godoc
- **Rust**: /// and //! doc comments
""",
        security_considerations=[
            "Never include real credentials in examples",
            "Avoid exposing internal implementation details",
            "Review examples for security best practices",
            "Mark sensitive configuration appropriately",
        ],
        best_practices=[
            "Read existing documentation style first",
            "Include runnable code examples",
            "Document edge cases and error conditions",
            "Keep examples minimal but complete",
            "Update docs when code changes",
            "Add links to related documentation",
        ],
        quality_criteria=[
            "All public APIs documented",
            "Examples are tested and working",
            "Consistent formatting throughout",
            "No outdated or incorrect information",
            "Appropriate detail level for audience",
        ],
        error_handling=[
            "If existing style unclear, ask for preference",
            "If code behavior uncertain, verify before documenting",
            "If examples fail, fix or note the issue",
            "If project too large, prioritize critical paths",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "files_created": {"type": "array", "items": {"type": "string"}},
                "files_updated": {"type": "array", "items": {"type": "string"}},
                "documentation_coverage": {
                    "type": "object",
                    "properties": {
                        "public_apis": {"type": "integer"},
                        "documented": {"type": "integer"},
                        "coverage_percent": {"type": "number"},
                    },
                },
                "style_used": {"type": "string"},
            },
        },
    ),
    "api-documenter": AgentTemplate(
        name="api-documenter",
        description="Creates comprehensive API documentation with examples, schemas, and usage guides",
        category="documentation",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["api", "openapi", "swagger", "rest"],
        examples=[
            "Document the REST API endpoints",
            "Generate OpenAPI spec",
            "Create API usage examples",
        ],
    ),
    # Research Agents
    "research-agent": AgentTemplate(
        name="research-agent",
        description="Conducts comprehensive research using web search, documentation analysis, and multi-source synthesis with citation tracking",
        category="research",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "WebSearch", "WebFetch", "Task"],
        pattern="orchestrator-workers",
        tags=["research", "analysis", "web-search", "synthesis", "documentation"],
        examples=[
            "Research best practices for authentication",
            "Find documentation for this library",
            "Compare different approaches to caching",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Query Formulation",
                description="Parse research request into specific questions. Identify key terms, scope, and success criteria for the research.",
                tools_used=["Read"],
                quality_gate="Clear research questions defined with scope boundaries",
            ),
            WorkflowStep(
                name="Source Discovery",
                description="Search for relevant sources: official docs, academic papers, blog posts, Stack Overflow, GitHub repos. Prioritize authoritative sources.",
                tools_used=["WebSearch", "Glob"],
                quality_gate="Multiple high-quality sources identified per question",
            ),
            WorkflowStep(
                name="Content Extraction",
                description="Fetch and extract relevant content from discovered sources. Parse documentation, code examples, and technical specifications.",
                tools_used=["WebFetch", "Read", "Grep"],
                quality_gate="Key information extracted with source attribution",
            ),
            WorkflowStep(
                name="Analysis & Synthesis",
                description="Analyze findings across sources. Identify patterns, contradictions, and consensus. Synthesize into coherent understanding.",
                tools_used=["Task"],
                quality_gate="Cross-source analysis complete with noted agreements/conflicts",
            ),
            WorkflowStep(
                name="Comparison Building",
                description="For comparative research, build structured comparisons with pros/cons, use cases, and trade-offs for each option.",
                tools_used=[],
                quality_gate="Balanced comparison with objective criteria",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Generate comprehensive research report with executive summary, detailed findings, recommendations, and full citations.",
                tools_used=[],
                quality_gate="Report is actionable with proper source attribution",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Technology Comparison Research",
                user_input="Compare Redis vs Memcached for our caching needs",
                agent_response="**Research Report: Redis vs Memcached**\n\n**Executive Summary:**\nRedis is recommended for most use cases due to its richer data structures and persistence options. Memcached excels in simple, high-throughput scenarios.\n\n**Comparison:**\n\n| Criteria | Redis | Memcached |\n|----------|-------|------------|\n| Data Types | Strings, Lists, Sets, Hashes, Streams | Strings only |\n| Persistence | RDB/AOF options | None (memory only) |\n| Clustering | Native support | Client-side |\n| Memory Efficiency | Higher overhead | More efficient |\n| Max Value Size | 512MB | 1MB |\n\n**Use Case Recommendations:**\n- **Choose Redis** for: Session storage, real-time analytics, pub/sub, complex data\n- **Choose Memcached** for: Simple key-value, maximum throughput, memory efficiency\n\n**Sources:**\n1. redis.io/docs (Official)\n2. memcached.org/about (Official)\n3. AWS ElastiCache comparison guide\n4. StackOverflow discussions (5,000+ votes)",
                key_actions=[
                    "Searched official documentation for both technologies",
                    "Fetched AWS and cloud provider comparison guides",
                    "Analyzed benchmark data from multiple sources",
                    "Synthesized pros/cons based on use cases",
                ],
            ),
            AgentExample(
                title="Best Practices Research",
                user_input="Research best practices for API authentication",
                agent_response="**Research Report: API Authentication Best Practices**\n\n**Key Findings:**\n\n**1. Token-Based Authentication (Recommended)**\n- JWT for stateless auth\n- OAuth 2.0 for third-party access\n- API keys for server-to-server\n\n**2. Security Requirements:**\n- Always use HTTPS\n- Implement rate limiting\n- Use short-lived tokens with refresh\n- Validate tokens on every request\n\n**3. Implementation Patterns:**\n```\nAuthorization: Bearer <token>\n```\n\n**4. Common Mistakes to Avoid:**\n- Storing tokens in localStorage (use httpOnly cookies)\n- Long-lived tokens without rotation\n- Missing token revocation mechanism\n\n**Recommendations for Your Project:**\n1. Implement OAuth 2.0 with JWT\n2. Add refresh token rotation\n3. Use secure cookie storage\n\n**Sources:**\n- OWASP Authentication Cheatsheet\n- Auth0 Best Practices Guide\n- RFC 6749 (OAuth 2.0)\n- Google API Authentication docs",
                key_actions=[
                    "Searched OWASP security guidelines",
                    "Reviewed OAuth 2.0 specifications",
                    "Analyzed industry leader implementations",
                    "Compiled actionable recommendations",
                ],
            ),
        ],
        system_prompt_additions="""
## Research Philosophy

You are an expert researcher providing accurate, well-sourced information:

1. **Source Quality**: Prioritize official docs, RFCs, peer-reviewed content
2. **Multiple Perspectives**: Gather diverse viewpoints before synthesizing
3. **Citation Required**: Every claim should be traceable to a source
4. **Recency Matters**: Note publication dates; prefer recent sources
5. **Acknowledge Uncertainty**: Be clear about confidence levels

## Source Hierarchy

1. Official documentation
2. RFC/Standards documents
3. Peer-reviewed papers
4. Reputable tech blogs (engineering blogs from major companies)
5. Stack Overflow (high-vote answers)
6. Community discussions

## Research Output Structure

- **Executive Summary**: Key findings in 2-3 sentences
- **Detailed Findings**: Organized by topic/question
- **Recommendations**: Actionable next steps
- **Sources**: Full citations with links
""",
        security_considerations=[
            "Verify source authenticity before citing",
            "Be cautious of outdated security advice",
            "Cross-reference security claims with official sources",
            "Note when information may be version-specific",
        ],
        best_practices=[
            "Start with official documentation",
            "Use multiple search queries to find diverse sources",
            "Check publication dates for relevance",
            "Look for consensus across sources",
            "Note when sources disagree",
            "Provide actionable recommendations",
        ],
        quality_criteria=[
            "All claims have source citations",
            "Multiple authoritative sources consulted",
            "Findings directly address the research question",
            "Recommendations are actionable and specific",
            "Report is well-organized and scannable",
        ],
        error_handling=[
            "If web search fails, try alternative queries",
            "If sources conflict, present both views",
            "If topic is too broad, ask for clarification",
            "If sources are outdated, note the limitation",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "content": {"type": "string"},
                            "confidence": {"type": "string"},
                        },
                    },
                },
                "recommendations": {"type": "array", "items": {"type": "string"}},
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "url": {"type": "string"},
                            "type": {"type": "string"},
                            "date": {"type": "string"},
                        },
                    },
                },
            },
        },
    ),
    "codebase-explorer": AgentTemplate(
        name="codebase-explorer",
        description="Explores and maps codebases to understand architecture, dependencies, and patterns",
        category="research",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["exploration", "architecture", "dependencies"],
        examples=[
            "Map the architecture of this project",
            "Find all database queries",
            "Trace the authentication flow",
        ],
    ),
    # DevOps Agents
    "ci-cd-agent": AgentTemplate(
        name="ci-cd-agent",
        description="Creates and maintains CI/CD pipelines for various platforms (GitHub Actions, GitLab CI, etc.)",
        category="devops",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["ci-cd", "github-actions", "deployment"],
        examples=[
            "Create GitHub Actions workflow",
            "Set up automated testing pipeline",
            "Configure deployment workflow",
        ],
    ),
    "docker-agent": AgentTemplate(
        name="docker-agent",
        description="Creates and optimizes Docker configurations including Dockerfiles and compose files",
        category="devops",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["docker", "containers", "compose"],
        examples=[
            "Create a Dockerfile for this app",
            "Optimize the Docker image size",
            "Set up docker-compose for development",
        ],
    ),
    # Security Agents
    "security-scanner": AgentTemplate(
        name="security-scanner",
        description="Comprehensive security scanner detecting OWASP Top 10, secrets exposure, injection vulnerabilities, and insecure configurations",
        category="security",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash", "Task"],
        pattern="parallelization",
        tags=["security", "vulnerabilities", "owasp", "secrets", "sast", "injection"],
        examples=[
            "Scan this codebase for vulnerabilities",
            "Check for exposed secrets",
            "Analyze authentication security",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Scope Definition",
                description="Identify files to scan based on language, framework, and risk profile. Exclude test files and generated code unless specified.",
                tools_used=["Glob", "Read"],
                quality_gate="All scannable files identified; exclusions documented",
            ),
            WorkflowStep(
                name="Secrets Detection",
                description="Scan for exposed secrets: API keys, tokens, certificates, private keys. Check env files, configs, and source code.",
                tools_used=["Grep", "Read"],
                quality_gate="All potential secrets flagged with severity",
            ),
            WorkflowStep(
                name="Injection Analysis",
                description="Detect SQL injection, command injection, XSS, LDAP injection by tracing user input to dangerous sinks.",
                tools_used=["Read", "Grep"],
                quality_gate="All user input paths traced to potential injection points",
            ),
            WorkflowStep(
                name="Authentication Audit",
                description="Review auth mechanisms: credential storage, session management, token handling, MFA, access controls.",
                tools_used=["Read", "Grep"],
                quality_gate="Auth implementation reviewed against security checklist",
            ),
            WorkflowStep(
                name="Configuration Review",
                description="Check for insecure configs: debug modes, CORS policies, security headers, TLS settings.",
                tools_used=["Read", "Grep", "Bash"],
                quality_gate="Configuration files audited for security settings",
            ),
            WorkflowStep(
                name="Dependency Scan",
                description="Check dependencies for known CVEs using npm audit, pip-audit, or language-specific tools.",
                tools_used=["Bash", "Read"],
                quality_gate="All dependencies checked against vulnerability databases",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Compile findings into severity-ranked report with remediation guidance and CVE references.",
                tools_used=[],
                quality_gate="Report includes severity, location, description, and remediation",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Full Codebase Security Scan",
                user_input="Scan this codebase for security vulnerabilities",
                agent_response="**Security Scan Report**\n\n**Scope:** 127 files scanned\n\n**CRITICAL (2)**\n1. Hardcoded secret in config/settings.py:23\n2. SQL injection in api/users.py:45\n\n**HIGH (3)**\n1. Weak hashing algorithm\n2. Missing CSRF protection\n3. Verbose error messages exposed\n\n**MEDIUM (5)**\n- Missing rate limiting\n- Session timeout not configured\n- Debug mode enabled\n- Missing security headers\n- Outdated dependency with CVE\n\n**Summary:** 10 issues found",
                key_actions=[
                    "Scanned for hardcoded secrets",
                    "Traced user inputs to database queries",
                    "Reviewed authentication implementation",
                    "Checked HTTP security headers",
                    "Ran dependency vulnerability scan",
                ],
            ),
            AgentExample(
                title="Secrets Audit",
                user_input="Check for exposed secrets in the repository",
                agent_response="**Secrets Audit Report**\n\n**Files Scanned:** 234\n**Issues Found:** 7\n\n**CRITICAL:** 3 hardcoded credentials found\n**HIGH:** 2 weak secrets in test files\n\n**Recommendations:**\n1. Rotate exposed credentials\n2. Add .env to .gitignore\n3. Use secrets manager\n4. Add pre-commit hooks",
                key_actions=[
                    "Searched for API key patterns",
                    "Checked .env and docker configs",
                    "Scanned CI/CD workflows",
                    "Verified gitignore coverage",
                ],
            ),
        ],
        system_prompt_additions="""
## Security Scanner Philosophy

1. **Assume Breach Mentality**: Look for exploitable vulnerabilities
2. **Defense in Depth**: Check multiple security layers
3. **Least Privilege**: Flag overly permissive access controls
4. **Secure by Default**: Identify insecure configurations

## OWASP Top 10 Checklist

- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable Components
- A07: Authentication Failures
- A08: Software/Data Integrity Failures
- A09: Security Logging Failures
- A10: Server-Side Request Forgery

## Severity Levels

- **CRITICAL**: Immediate exploitation risk
- **HIGH**: Significant vulnerability
- **MEDIUM**: Security weakness
- **LOW**: Best practice violation
""",
        security_considerations=[
            "Never log or display full secret values",
            "Redact sensitive data in reports",
            "Do not execute suspicious code during analysis",
            "Report findings securely",
        ],
        best_practices=[
            "Start with automated scanning then manual review",
            "Focus on user input paths and trust boundaries",
            "Check both frontend and backend code",
            "Review third-party integrations",
            "Verify secrets are not in git history",
        ],
        quality_criteria=[
            "All OWASP Top 10 categories checked",
            "No false negatives on critical issues",
            "Minimal false positives",
            "Clear remediation guidance provided",
        ],
        error_handling=[
            "If security tools not installed, use grep-based detection",
            "If files too large, scan in chunks",
            "If binary files found, skip with note",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "object",
                    "properties": {
                        "files_scanned": {"type": "integer"},
                        "critical": {"type": "integer"},
                        "high": {"type": "integer"},
                        "medium": {"type": "integer"},
                    },
                },
                "findings": {"type": "array"},
                "secrets_found": {"type": "array"},
                "vulnerable_dependencies": {"type": "array"},
            },
        },
    ),
    "dependency-updater": AgentTemplate(
        name="dependency-updater",
        description="Audits, updates, and manages project dependencies across Python, Node.js, Go, and Rust with vulnerability scanning and compatibility checking",
        category="security",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=[
            "dependencies",
            "audit",
            "update",
            "npm-audit",
            "pip-audit",
            "vulnerabilities",
        ],
        examples=[
            "Update all outdated dependencies",
            "Check for vulnerable packages",
            "Migrate to latest major version of React",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Dependency Discovery",
                description="Identify all dependency files: package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml. Parse current versions and constraints.",
                tools_used=["Glob", "Read"],
                quality_gate="All dependency manifests identified and parsed",
            ),
            WorkflowStep(
                name="Vulnerability Scan",
                description="Run language-specific audit tools (npm audit, pip-audit, govulncheck, cargo audit). Identify CVEs with severity levels.",
                tools_used=["Bash"],
                quality_gate="All dependencies checked against vulnerability databases",
            ),
            WorkflowStep(
                name="Outdated Analysis",
                description="Check for outdated packages. Compare current vs latest versions. Identify major/minor/patch updates available.",
                tools_used=["Bash", "Read"],
                quality_gate="Complete update matrix generated with version comparisons",
            ),
            WorkflowStep(
                name="Compatibility Check",
                description="Analyze changelog and breaking changes for major updates. Check peer dependency compatibility. Verify engine/runtime requirements.",
                tools_used=["Read", "Grep", "Bash"],
                quality_gate="Breaking changes documented for all major updates",
            ),
            WorkflowStep(
                name="Update Execution",
                description="Apply updates in priority order: critical security fixes first, then minor/patch, then major. Run tests after each batch.",
                tools_used=["Bash"],
                quality_gate="All updates applied with passing tests",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Generate update report with before/after versions, CVEs fixed, breaking changes addressed, and test results.",
                tools_used=[],
                quality_gate="Report includes all changes with migration notes",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Full Dependency Audit and Update",
                user_input="Update all outdated dependencies and fix vulnerabilities",
                agent_response="**Dependency Update Report**\n\n**Scanned:** 3 manifests (package.json, requirements.txt, pyproject.toml)\n\n**Vulnerabilities Fixed:** 4\n- CVE-2024-1234: lodash prototype pollution (CRITICAL)\n- CVE-2024-5678: express path traversal (HIGH)\n- CVE-2024-9012: pillow buffer overflow (HIGH)\n- CVE-2024-3456: requests SSRF (MEDIUM)\n\n**Updates Applied:**\n| Package | From | To | Type |\n|---------|------|----|------|\n| lodash | 4.17.20 | 4.17.21 | patch |\n| express | 4.18.0 | 4.19.2 | minor |\n| react | 18.2.0 | 18.3.1 | minor |\n| pillow | 9.5.0 | 10.2.0 | major |\n\n**Tests:** All 142 tests passing after updates\n**Breaking Changes:** pillow 10.x removed Image.ANTIALIAS (replaced with Image.LANCZOS)",
                key_actions=[
                    "Scanned all dependency manifests",
                    "Ran npm audit and pip-audit",
                    "Applied security patches first",
                    "Verified tests pass after each update batch",
                ],
            ),
            AgentExample(
                title="Major Version Migration",
                user_input="Migrate from React 17 to React 18",
                agent_response="**Migration Report: React 17 → 18**\n\n**Breaking Changes Addressed:**\n1. createRoot API migration (from ReactDOM.render)\n2. Automatic batching behavior changes\n3. Strict mode double-rendering in development\n4. Removed legacy context API usage\n\n**Files Modified:** 12\n**Tests Updated:** 8\n**All Tests Passing:** Yes\n\n**Migration Checklist:**\n- [x] Updated react and react-dom to 18.3.1\n- [x] Migrated entry point to createRoot\n- [x] Updated test utilities to use act()\n- [x] Verified Suspense boundaries work correctly",
                key_actions=[
                    "Read React 18 migration guide",
                    "Identified all ReactDOM.render calls",
                    "Updated test setup for React 18",
                    "Ran full test suite after migration",
                ],
            ),
            AgentExample(
                title="Vulnerability-Only Fix",
                user_input="Fix only the critical and high severity vulnerabilities",
                agent_response="**Security Fix Report**\n\n**Scanned:** package.json (87 deps), requirements.txt (23 deps)\n\n**Fixed:** 3 vulnerabilities\n- CRITICAL: prototype pollution in minimist → updated 1.2.5 → 1.2.8\n- HIGH: ReDoS in semver → updated 7.5.3 → 7.5.4\n- HIGH: path traversal in tar → updated 6.1.11 → 6.2.0\n\n**Skipped:** 2 low-severity issues (no exploit path)\n**Tests:** All passing, no breaking changes",
                key_actions=[
                    "Ran npm audit --json to get structured results",
                    "Filtered for critical and high severity only",
                    "Applied minimal version bumps for fixes",
                    "Verified no breaking changes introduced",
                ],
            ),
        ],
        system_prompt_additions="""
## Dependency Management Philosophy

1. **Security First**: Always fix critical/high vulnerabilities before feature updates
2. **Minimal Changes**: Prefer smallest version bump that fixes the issue
3. **Test After Each Batch**: Never apply all updates blindly
4. **Document Breaking Changes**: Every major update needs migration notes
5. **Lock Files Matter**: Always update lock files alongside manifests

## Update Priority Order

1. Critical security vulnerabilities
2. High security vulnerabilities
3. Minor/patch updates with security fixes
4. Outdated dependencies (minor/patch)
5. Major version updates (require explicit approval)
""",
        security_considerations=[
            "Verify package authenticity before updating",
            "Check for typosquatting in package names",
            "Review changelogs for suspicious changes",
            "Do not auto-update in production without CI/CD validation",
        ],
        best_practices=[
            "Run full test suite after each update batch",
            "Update lock files alongside manifests",
            "Pin major versions, allow minor/patch updates",
            "Keep separate PRs for security fixes vs feature updates",
        ],
        quality_criteria=[
            "All critical/high vulnerabilities resolved",
            "No test regressions after updates",
            "Lock files updated and consistent",
            "Breaking changes documented with migration path",
        ],
        error_handling=[
            "If audit tool not installed, suggest installation command",
            "If update breaks tests, revert and report incompatibility",
            "If conflicting version requirements, report resolution options",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "manifests_scanned": {"type": "integer"},
                "vulnerabilities_fixed": {"type": "integer"},
                "updates_applied": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "package": {"type": "string"},
                            "from_version": {"type": "string"},
                            "to_version": {"type": "string"},
                            "update_type": {"type": "string"},
                        },
                    },
                },
                "tests_passing": {"type": "boolean"},
                "breaking_changes": {"type": "array"},
            },
        },
    ),
    # Productivity Agents
    "task-automator": AgentTemplate(
        name="task-automator",
        description="Automates repetitive development tasks and creates helper scripts",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["automation", "scripts", "productivity"],
        examples=[
            "Create a script to rename files",
            "Automate the release process",
            "Set up pre-commit hooks",
        ],
    ),
    "git-workflow": AgentTemplate(
        name="git-workflow",
        description="Manages git workflows including branching strategies, conflict resolution, commit hygiene, release tagging, and interactive rebase planning",
        category="productivity",
        version="2.0.0",
        tools=["Read", "Bash", "Grep", "Glob"],
        pattern="routing",
        tags=[
            "git",
            "version-control",
            "branches",
            "commits",
            "merge",
            "rebase",
            "release",
        ],
        examples=[
            "Help resolve merge conflicts",
            "Create a release branch and tag",
            "Clean up commit history before PR",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Context Analysis",
                description="Analyze current git state: branch, uncommitted changes, remote tracking, merge status. Determine the appropriate workflow.",
                tools_used=["Bash"],
                quality_gate="Current git state fully understood; no hidden uncommitted work",
            ),
            WorkflowStep(
                name="Strategy Selection",
                description="Route to the correct workflow based on request: branching, merging, rebasing, conflict resolution, release tagging, or commit cleanup.",
                tools_used=["Bash"],
                quality_gate="Correct strategy selected with user confirmation for destructive ops",
            ),
            WorkflowStep(
                name="Pre-flight Checks",
                description="Verify preconditions: clean working tree for rebase, no diverged history for fast-forward, correct base branch for feature work.",
                tools_used=["Bash"],
                quality_gate="All preconditions met or user warned about risks",
            ),
            WorkflowStep(
                name="Execution",
                description="Execute the git operations. For destructive operations (force push, reset), confirm with user first. Create backup branches before rebasing.",
                tools_used=["Bash"],
                quality_gate="Operations complete; backup branch created for destructive ops",
            ),
            WorkflowStep(
                name="Verification",
                description="Verify results: check log, diff, status. Ensure no lost commits, correct merge resolution, clean history.",
                tools_used=["Bash", "Grep"],
                quality_gate="Post-operation state matches expected outcome",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Merge Conflict Resolution",
                user_input="Help resolve the merge conflicts in this branch",
                agent_response='**Merge Conflict Analysis**\n\n**Conflicting Files:** 3\n1. `src/auth/handler.py` — Both branches modified login logic\n2. `src/models/user.py` — Field additions on both sides\n3. `tests/test_auth.py` — New tests on both sides\n\n**Resolution Strategy:**\n- `handler.py`: Keep feature branch login flow, integrate main\'s rate limiting\n- `user.py`: Accept both field additions (no semantic conflict)\n- `test_auth.py`: Keep all tests from both branches\n\n**Result:** All 3 conflicts resolved. Tests passing.\n\n```\ngit add src/auth/handler.py src/models/user.py tests/test_auth.py\ngit commit -m "Merge main into feature/auth with conflict resolution"\n```',
                key_actions=[
                    "Ran git status to identify conflicting files",
                    "Read each conflicting file to understand both sides",
                    "Applied semantic merge for each conflict",
                    "Verified tests pass after resolution",
                ],
            ),
            AgentExample(
                title="Commit History Cleanup",
                user_input="Clean up the last 5 commits before creating a PR",
                agent_response="**Commit History Analysis**\n\n**Current commits (oldest first):**\n1. `abc1234` feat: add user model\n2. `def5678` fix: typo in user model\n3. `ghi9012` feat: add user API endpoint\n4. `jkl3456` fix: endpoint response format\n5. `mno7890` chore: update tests\n\n**Proposed squash plan:**\n- Squash 1+2 → `feat: add user model`\n- Squash 3+4 → `feat: add user API endpoint`\n- Keep 5 → `test: add user model and API tests`\n\n**Result:** 5 commits → 3 clean commits\nBackup branch created: `backup/feature-user-20240315`",
                key_actions=[
                    "Analyzed commit messages and diffs",
                    "Created backup branch before rebase",
                    "Planned logical squash groupings",
                    "Executed interactive rebase with fixup",
                ],
            ),
            AgentExample(
                title="Release Tagging",
                user_input="Create a release for version 2.1.0",
                agent_response="**Release Preparation: v2.1.0**\n\n**Changelog since v2.0.0:**\n- feat: Add OAuth2 support (#123)\n- feat: Add rate limiting (#125)\n- fix: Memory leak in connection pool (#128)\n- fix: Timezone handling in scheduler (#130)\n\n**Actions Taken:**\n1. Created release branch `release/2.1.0` from main\n2. Updated version in pyproject.toml\n3. Generated CHANGELOG.md entry\n4. Created annotated tag `v2.1.0`\n\n**Next Steps:**\n- Review changelog and push tag\n- CI will create GitHub release automatically",
                key_actions=[
                    "Generated changelog from git log since last tag",
                    "Created release branch from main",
                    "Updated version files",
                    "Created annotated tag with changelog summary",
                ],
            ),
        ],
        system_prompt_additions="""
## Git Workflow Philosophy

1. **Safety First**: Always create backup branches before destructive operations
2. **Clean History**: Prefer squash/rebase for clean linear history
3. **Conventional Commits**: Use feat/fix/chore/docs/test prefixes
4. **Never Force Push Main**: Protect shared branches at all costs
5. **Confirm Destructive Ops**: Always ask before force push, reset --hard, branch -D

## Branching Strategy

- `main` — production-ready code (protected)
- `develop` — integration branch (optional)
- `feature/*` — new features
- `fix/*` — bug fixes
- `release/*` — release preparation
- `hotfix/*` — emergency production fixes
""",
        security_considerations=[
            "Never include secrets in commit messages",
            "Verify remote URLs before pushing to prevent credential theft",
            "Create backup branches before destructive operations",
            "Do not force push to shared branches without team agreement",
        ],
        best_practices=[
            "Write meaningful commit messages with conventional format",
            "Keep commits atomic — one logical change per commit",
            "Rebase feature branches on main before creating PR",
            "Use signed commits for release tags",
        ],
        quality_criteria=[
            "No lost commits after rebase or merge",
            "Clean linear history where possible",
            "All conflicts resolved semantically (not just textually)",
            "Backup branches created for destructive operations",
        ],
        error_handling=[
            "If rebase has conflicts, pause and show resolution options",
            "If push rejected, check for diverged history before force pushing",
            "If branch not found, list available branches and suggest closest match",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "operation": {"type": "string"},
                "branch": {"type": "string"},
                "commits_affected": {"type": "integer"},
                "backup_branch": {"type": "string"},
                "status": {"type": "string", "enum": ["success", "conflict", "error"]},
                "conflicts": {"type": "array"},
            },
        },
    ),
    "project-scaffolder": AgentTemplate(
        name="project-scaffolder",
        description="Scaffolds new projects with proper structure, configuration, and boilerplate",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Write", "Bash", "Glob"],
        pattern="prompt-chaining",
        tags=["scaffolding", "boilerplate", "setup"],
        examples=[
            "Create a new React project",
            "Scaffold a Python package",
            "Set up a FastAPI project",
        ],
    ),
    # Performance Agents
    "performance-profiler": AgentTemplate(
        name="performance-profiler",
        description="Profiles code for performance bottlenecks, measures execution time, identifies memory leaks, detects N+1 queries, and suggests optimizations across Python, Node.js, and Go",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=[
            "performance",
            "profiling",
            "optimization",
            "memory",
            "cpu",
            "n+1",
            "benchmarks",
        ],
        examples=[
            "Profile the API endpoint for slow response times",
            "Find memory leaks in the data processing pipeline",
            "Identify N+1 queries in the ORM layer",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Hotspot Identification",
                description="Analyze code structure to identify likely performance hotspots: loops, database queries, I/O operations, large data transformations, recursive calls.",
                tools_used=["Read", "Grep", "Glob"],
                quality_gate="All potential hotspots cataloged with risk assessment",
            ),
            WorkflowStep(
                name="Static Analysis",
                description="Detect algorithmic complexity issues (O(n²) patterns), unbounded allocations, missing caching, eager loading vs lazy loading problems.",
                tools_used=["Read", "Grep"],
                quality_gate="Complexity analysis complete for all hotspots",
            ),
            WorkflowStep(
                name="Query Analysis",
                description="Identify N+1 queries, missing indexes, full table scans, unnecessary joins. Analyze ORM usage for hidden query generation.",
                tools_used=["Read", "Grep", "Glob"],
                quality_gate="All database access patterns documented with query counts",
            ),
            WorkflowStep(
                name="Profiling Execution",
                description="Run language-specific profilers: cProfile/py-spy (Python), clinic/0x (Node.js), pprof (Go). Capture CPU and memory profiles.",
                tools_used=["Bash"],
                quality_gate="Profile data captured with clear flame graph or hotspot listing",
            ),
            WorkflowStep(
                name="Memory Analysis",
                description="Check for memory leaks: growing collections, unclosed resources, circular references, large object retention. Use tracemalloc/heapdump as needed.",
                tools_used=["Bash", "Read"],
                quality_gate="Memory allocation patterns analyzed; leaks identified if present",
            ),
            WorkflowStep(
                name="Optimization Recommendations",
                description="Prioritize optimizations by impact. Suggest specific code changes with expected improvement. Recommend caching, batching, indexing, or algorithmic improvements.",
                tools_used=[],
                quality_gate="Each recommendation includes expected impact and implementation effort",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="API Endpoint Profiling",
                user_input="The /api/orders endpoint takes 3 seconds to respond",
                agent_response="**Performance Analysis: /api/orders**\n\n**Root Cause:** N+1 query pattern\n\n**Findings:**\n1. **N+1 Queries** (CRITICAL): Loading 100 orders generates 101 SQL queries\n   - 1 query for orders\n   - 100 queries for order.customer (one per order)\n   - Fix: Add `select_related('customer')` → 2 queries total\n\n2. **Missing Index** (HIGH): Full table scan on `orders.created_at`\n   - Fix: Add index on `created_at` column\n\n3. **Serialization** (MEDIUM): JSON serialization of 100 objects takes 200ms\n   - Fix: Use `orjson` instead of `json.dumps`\n\n**Expected Improvement:**\n- Current: 3,000ms\n- After N+1 fix: 400ms (87% reduction)\n- After index: 150ms (95% reduction)\n- After serialization: 80ms (97% reduction)",
                key_actions=[
                    "Traced request handler to identify query patterns",
                    "Counted SQL queries with query logging enabled",
                    "Checked database indexes on queried columns",
                    "Profiled serialization with cProfile",
                ],
            ),
            AgentExample(
                title="Memory Leak Detection",
                user_input="Our worker process memory grows to 2GB after a few hours",
                agent_response="**Memory Leak Analysis**\n\n**Leak Found:** Event listener accumulation in WebSocket handler\n\n**Details:**\n- `ws_handler.py:67` — New listener added on each connection but never removed on disconnect\n- After 10,000 connections: 10,000 stale listeners holding references to connection objects\n- Each listener retains ~200KB of connection context\n\n**Growth Rate:** ~50MB/hour at current connection rate\n\n**Fix:**\n```python\n# Before (leaky):\ndef on_connect(ws):\n    event_bus.add_listener('update', ws.send)\n\n# After (fixed):\ndef on_connect(ws):\n    handler = ws.send\n    event_bus.add_listener('update', handler)\n    ws.on_close(lambda: event_bus.remove_listener('update', handler))\n```\n\n**Verification:** Memory stable at 256MB after 24h test run",
                key_actions=[
                    "Analyzed tracemalloc snapshots over time",
                    "Identified growing object counts by type",
                    "Traced reference chains to root cause",
                    "Verified fix with extended runtime test",
                ],
            ),
            AgentExample(
                title="Batch Processing Optimization",
                user_input="CSV import of 1M rows takes 4 hours",
                agent_response="**Performance Analysis: CSV Import**\n\n**Current:** 4 hours (70 rows/second)\n**Bottlenecks:**\n\n1. **Row-by-row INSERT** (CRITICAL): Individual INSERT per row\n   - Fix: Batch INSERT with 1000-row chunks → 50x speedup\n\n2. **Eager validation** (HIGH): Validating each row against DB\n   - Fix: Bulk validation with IN clause → 20x speedup\n\n3. **Auto-commit** (MEDIUM): COMMIT after each INSERT\n   - Fix: Single transaction with periodic commits\n\n**Optimized Pipeline:**\n- Read CSV in 10K chunks (pandas)\n- Validate in bulk (batch SELECT)\n- Insert in 1K batches (executemany)\n- Commit every 10K rows\n\n**Expected:** 1M rows in ~5 minutes (3,300 rows/second)",
                key_actions=[
                    "Profiled import loop with cProfile",
                    "Identified database round-trips as bottleneck",
                    "Tested batch sizes for optimal throughput",
                    "Verified data integrity after optimization",
                ],
            ),
        ],
        system_prompt_additions="""
## Performance Analysis Philosophy

1. **Measure First**: Never optimize without profiling data
2. **80/20 Rule**: Focus on the top bottleneck first
3. **Algorithmic Over Micro**: Prefer O(n) → O(log n) over loop unrolling
4. **Trade-offs**: Document memory vs CPU vs latency trade-offs
5. **Regression Prevention**: Suggest benchmarks to prevent regressions

## Common Performance Patterns

- N+1 queries → Batch/eager loading
- Missing indexes → Add targeted indexes
- Synchronous I/O → Async/concurrent
- Large allocations → Streaming/chunking
- Repeated computation → Caching/memoization
""",
        security_considerations=[
            "Do not expose profiling data containing user information",
            "Disable profiling in production after analysis",
            "Be cautious with memory dumps that may contain secrets",
            "Do not run CPU-intensive profilers on production systems",
        ],
        best_practices=[
            "Profile in environment matching production (data size, load)",
            "Compare before/after with reproducible benchmarks",
            "Focus on user-facing latency, not internal metrics",
            "Consider P95/P99 latency, not just averages",
        ],
        quality_criteria=[
            "Root cause identified with evidence",
            "Impact quantified in measurable terms",
            "Recommendations ordered by impact/effort ratio",
            "Before/after comparison provided or estimated",
        ],
        error_handling=[
            "If profiler not installed, suggest installation and use static analysis",
            "If code too complex to profile, focus on hot path analysis",
            "If no obvious bottleneck, report as within acceptable range",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "hotspots": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string"},
                            "severity": {"type": "string"},
                            "description": {"type": "string"},
                            "current_metric": {"type": "string"},
                            "expected_improvement": {"type": "string"},
                        },
                    },
                },
                "recommendations": {"type": "array"},
                "estimated_improvement": {"type": "string"},
            },
        },
    ),
    # Migration Agents
    "migration-planner": AgentTemplate(
        name="migration-planner",
        description="Plans and executes database migrations, framework upgrades, language version bumps, and large-scale codebase migrations with rollback strategies",
        category="devops",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash", "Write"],
        pattern="prompt-chaining",
        tags=[
            "migration",
            "database",
            "upgrade",
            "schema",
            "framework",
            "rollback",
        ],
        examples=[
            "Plan database migration for new schema",
            "Migrate from Django 4.x to 5.x",
            "Create rollback plan for the schema change",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Impact Assessment",
                description="Analyze current state: database schema, framework version, dependency graph. Identify all components affected by the migration.",
                tools_used=["Read", "Grep", "Glob", "Bash"],
                quality_gate="Complete dependency graph mapped; all affected components listed",
            ),
            WorkflowStep(
                name="Breaking Change Analysis",
                description="Review changelogs, migration guides, and deprecation notices. Catalog every breaking change relevant to the codebase.",
                tools_used=["Read", "Grep"],
                quality_gate="Every breaking change documented with affected code locations",
            ),
            WorkflowStep(
                name="Migration Plan Generation",
                description="Create step-by-step migration plan with ordering based on dependencies. Include pre-migration checks, migration steps, and post-migration validation.",
                tools_used=["Read"],
                quality_gate="Ordered plan with no circular dependencies; each step is atomic",
            ),
            WorkflowStep(
                name="Rollback Strategy",
                description="Design rollback procedure for each migration step. Ensure data can be restored without loss. Create backup scripts.",
                tools_used=["Write", "Bash"],
                quality_gate="Every migration step has a tested rollback procedure",
            ),
            WorkflowStep(
                name="Migration Execution",
                description="Execute migration steps in order. Run validation after each step. Stop and rollback on failure.",
                tools_used=["Bash", "Read"],
                quality_gate="Each step validated before proceeding to next",
            ),
            WorkflowStep(
                name="Post-Migration Validation",
                description="Run full test suite, verify data integrity, check application functionality. Compare pre/post metrics.",
                tools_used=["Bash", "Grep"],
                quality_gate="All tests pass; data integrity verified; no functionality regression",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Database Schema Migration",
                user_input="Plan migration to split the users table into users and profiles",
                agent_response="**Migration Plan: Split users → users + profiles**\n\n**Impact Assessment:**\n- 15 files reference `users` table directly\n- 8 ORM models have foreign keys to users\n- 3 API endpoints return user+profile data\n\n**Migration Steps:**\n1. Create `profiles` table with FK to `users`\n2. Migrate profile columns (bio, avatar, settings) to `profiles`\n3. Create backward-compatible view `users_with_profile`\n4. Update ORM models to use new schema\n5. Update API serializers\n6. Drop backward-compatible view\n7. Remove old columns from `users`\n\n**Rollback Plan:**\n- Steps 1-3: DROP profiles table, no data loss\n- Steps 4-5: Revert code changes, view still works\n- Steps 6-7: Restore from pre-migration backup\n\n**Estimated Duration:** 2 hours (with 30min validation)\n**Risk Level:** MEDIUM — data transformation required",
                key_actions=[
                    "Analyzed all foreign key references to users table",
                    "Mapped ORM model dependencies",
                    "Generated migration SQL with data copy",
                    "Created rollback scripts for each step",
                ],
            ),
            AgentExample(
                title="Framework Version Upgrade",
                user_input="Migrate from Django 4.2 to Django 5.0",
                agent_response="**Migration Plan: Django 4.2 → 5.0**\n\n**Breaking Changes Found:** 7\n1. `DEFAULT_AUTO_FIELD` must be explicitly set\n2. `django.utils.timezone.utc` removed (use `datetime.timezone.utc`)\n3. `HttpResponse.headers` is now case-insensitive\n4. `PickleSerializer` removed from sessions\n5. CSRF token format changed\n6. `TestCase.setUpClass()` behavior change\n7. Dropped Python 3.8/3.9 support\n\n**Files Affected:** 23\n\n**Ordered Steps:**\n1. Update Python to 3.10+ (if needed)\n2. Fix deprecation warnings on 4.2 first\n3. Update Django to 5.0 in requirements\n4. Fix each breaking change (7 items)\n5. Run test suite and fix failures\n6. Update CI/CD configuration\n\n**Risk:** LOW — No data migration required",
                key_actions=[
                    "Read Django 5.0 release notes for breaking changes",
                    "Searched codebase for each deprecated API",
                    "Verified Python version compatibility",
                    "Created ordered migration checklist",
                ],
            ),
            AgentExample(
                title="Migration Failure Recovery",
                user_input="The migration failed halfway through, help me recover",
                agent_response="**Migration Recovery Analysis**\n\n**Current State:**\n- Migration 0042_add_indexes: APPLIED\n- Migration 0043_split_address: FAILED at step 3/5\n- Database has partial schema changes\n\n**Recovery Plan:**\n1. Check which steps of 0043 completed:\n   - Step 1 (create table): DONE\n   - Step 2 (copy data): DONE\n   - Step 3 (add constraints): FAILED — duplicate key violation\n\n2. Root cause: 47 rows with duplicate address_id\n3. Fix: Deduplicate before adding constraint\n\n**Commands:**\n```sql\n-- Fix duplicates\nDELETE FROM addresses a USING addresses b\nWHERE a.id > b.id AND a.address_id = b.address_id;\n-- Retry constraint\nALTER TABLE addresses ADD CONSTRAINT unique_address_id UNIQUE (address_id);\n-- Mark migration as applied\npython manage.py migrate --fake myapp 0043\n```\n\n**Verification:** Run `python manage.py check` and full test suite",
                key_actions=[
                    "Checked migration state with showmigrations",
                    "Identified which steps completed vs failed",
                    "Diagnosed root cause of constraint violation",
                    "Provided targeted fix without full rollback",
                ],
            ),
        ],
        system_prompt_additions="""
## Migration Philosophy

1. **Backward Compatible First**: Deploy code that works with old AND new schema
2. **Small Steps**: Break large migrations into reversible atomic steps
3. **Always Rollback**: Every migration needs a tested rollback path
4. **Data Preservation**: Never delete data without a backup
5. **Validate Early**: Check preconditions before starting migration

## Migration Safety Checklist

- [ ] Backup created and verified
- [ ] Rollback procedure documented and tested
- [ ] Breaking changes cataloged
- [ ] Affected code paths identified
- [ ] Test suite updated for new schema/API
- [ ] Monitoring/alerts configured for migration
""",
        security_considerations=[
            "Backup database before any schema migration",
            "Do not log sensitive data during migration",
            "Verify permissions before modifying production schemas",
            "Use transactions for atomicity where supported",
        ],
        best_practices=[
            "Test migrations on a copy of production data",
            "Deploy code changes before schema changes (expand-contract)",
            "Monitor error rates during and after migration",
            "Keep migration files version-controlled",
        ],
        quality_criteria=[
            "Every step has a rollback procedure",
            "No data loss during migration",
            "All tests pass after migration",
            "Backward compatibility maintained during transition",
        ],
        error_handling=[
            "If migration fails midway, assess partial state and provide recovery steps",
            "If rollback fails, provide manual SQL recovery commands",
            "If data integrity check fails, halt and report affected records",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "migration_type": {"type": "string"},
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "order": {"type": "integer"},
                            "description": {"type": "string"},
                            "rollback": {"type": "string"},
                            "risk": {"type": "string"},
                        },
                    },
                },
                "affected_files": {"type": "integer"},
                "breaking_changes": {"type": "integer"},
                "estimated_duration": {"type": "string"},
                "risk_level": {"type": "string"},
            },
        },
    ),
    # Accessibility Agents
    "accessibility-checker": AgentTemplate(
        name="accessibility-checker",
        description="Audits web applications for WCAG 2.1 AA/AAA compliance, ARIA correctness, keyboard navigation, color contrast, screen reader compatibility, and semantic HTML",
        category="code-quality",
        version="2.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=[
            "accessibility",
            "a11y",
            "wcag",
            "aria",
            "screen-reader",
            "keyboard",
            "contrast",
        ],
        examples=[
            "Audit this page for WCAG 2.1 AA compliance",
            "Check all forms for accessible labels",
            "Verify keyboard navigation works correctly",
        ],
        workflow_steps=[
            WorkflowStep(
                name="Component Discovery",
                description="Identify all UI components, pages, and interactive elements. Catalog forms, buttons, links, images, tables, and dynamic content.",
                tools_used=["Glob", "Grep", "Read"],
                quality_gate="Complete inventory of interactive and content elements",
            ),
            WorkflowStep(
                name="Semantic HTML Audit",
                description="Check for proper HTML5 landmarks, heading hierarchy, list structure, table headers, and meaningful element choices (button vs div).",
                tools_used=["Read", "Grep"],
                quality_gate="All semantic violations cataloged with WCAG criterion reference",
            ),
            WorkflowStep(
                name="ARIA Validation",
                description="Verify ARIA roles, states, and properties. Check for redundant ARIA on semantic elements. Validate aria-labelledby/describedby references exist.",
                tools_used=["Read", "Grep"],
                quality_gate="All ARIA usage validated; orphaned references identified",
            ),
            WorkflowStep(
                name="Keyboard Navigation Check",
                description="Verify all interactive elements are focusable. Check tab order, focus trapping in modals, skip links, and keyboard shortcuts.",
                tools_used=["Read", "Grep"],
                quality_gate="All interactive elements reachable and operable via keyboard",
            ),
            WorkflowStep(
                name="Color and Contrast Analysis",
                description="Check color contrast ratios against WCAG AA (4.5:1 normal, 3:1 large) and AAA (7:1, 4.5:1). Verify information not conveyed by color alone.",
                tools_used=["Read", "Grep", "Bash"],
                quality_gate="All color combinations meet minimum contrast ratio",
            ),
            WorkflowStep(
                name="Report Generation",
                description="Generate compliance report organized by WCAG principle (Perceivable, Operable, Understandable, Robust) with severity, location, and fix suggestions.",
                tools_used=[],
                quality_gate="Report covers all four POUR principles with actionable fixes",
            ),
        ],
        detailed_examples=[
            AgentExample(
                title="Full WCAG Audit",
                user_input="Audit the login page for WCAG 2.1 AA compliance",
                agent_response='**Accessibility Audit: Login Page**\n\n**Compliance: 72% (11/15 criteria passing)**\n\n**CRITICAL (Must Fix):**\n1. `login-form.tsx:23` — Email input missing `<label>` element\n   - WCAG 1.3.1: Info and Relationships\n   - Fix: Add `<label htmlFor="email">Email</label>`\n\n2. `login-form.tsx:45` — Error messages not announced to screen readers\n   - WCAG 4.1.3: Status Messages\n   - Fix: Add `role="alert"` to error container\n\n**HIGH:**\n3. `login-button.tsx:12` — Submit button has insufficient contrast (3.2:1)\n   - WCAG 1.4.3: Contrast (Minimum) requires 4.5:1\n   - Fix: Darken button text from #767676 to #595959\n\n4. `login-page.tsx:8` — No skip link to main content\n   - WCAG 2.4.1: Bypass Blocks\n   - Fix: Add skip link as first focusable element\n\n**ADVISORY:**\n5. Password field placeholder used as only label\n6. Focus style removed with `outline: none`\n\n**Summary:** 4 issues to fix for AA compliance',
                key_actions=[
                    "Scanned all form inputs for associated labels",
                    "Verified ARIA roles and live regions",
                    "Checked color contrast ratios on all text",
                    "Tested focus order through interactive elements",
                ],
            ),
            AgentExample(
                title="Form Accessibility Review",
                user_input="Check all forms in the app for accessible labels and error handling",
                agent_response="**Form Accessibility Report**\n\n**Forms Found:** 8 across 12 files\n\n**Results by Form:**\n\n| Form | Labels | Errors | Tab Order | Score |\n|------|--------|--------|-----------|-------|\n| Login | 1 issue | 2 issues | OK | 60% |\n| Register | OK | 1 issue | OK | 85% |\n| Profile | 2 issues | OK | OK | 75% |\n| Search | OK | OK | OK | 100% |\n| Checkout | OK | 3 issues | 1 issue | 50% |\n| Settings | 1 issue | OK | OK | 85% |\n| Contact | OK | OK | OK | 100% |\n| Feedback | OK | 1 issue | OK | 90% |\n\n**Common Issues:**\n1. Using `placeholder` as label (3 forms)\n2. Error messages not linked to inputs via `aria-describedby` (4 forms)\n3. Required fields not indicated programmatically (2 forms)\n\n**Overall Score: 78%** — 3 forms need immediate fixes",
                key_actions=[
                    "Found all form components with Glob pattern",
                    "Checked each input for label association",
                    "Verified error handling uses aria-describedby",
                    "Checked required field indicators",
                ],
            ),
            AgentExample(
                title="Keyboard Navigation Audit",
                user_input="Verify keyboard navigation works for the modal dialogs",
                agent_response="**Keyboard Navigation Audit: Modal Dialogs**\n\n**Modals Found:** 5 (confirm, alert, form, image gallery, settings)\n\n**Issues Found:**\n\n1. **Confirm Modal** — Focus not trapped inside modal\n   - WCAG 2.4.3: Focus Order\n   - Tab key moves focus behind modal to page content\n   - Fix: Add focus trap with first/last element cycling\n\n2. **Image Gallery Modal** — No Escape key to close\n   - WCAG 2.1.1: Keyboard\n   - Fix: Add `onKeyDown` handler for Escape key\n\n3. **All Modals** — Focus not returned to trigger on close\n   - WCAG 2.4.3: Focus Order\n   - Fix: Save trigger reference, restore focus on close\n\n**Passing:**\n- Alert and Form modals have proper focus management\n- Settings modal has correct ARIA attributes\n\n**Overall:** 3 of 5 modals need keyboard fixes",
                key_actions=[
                    "Identified all modal components",
                    "Checked focus trap implementation",
                    "Verified Escape key handling",
                    "Checked focus restoration on close",
                ],
            ),
        ],
        system_prompt_additions="""
## Accessibility Philosophy

1. **POUR Principles**: Perceivable, Operable, Understandable, Robust
2. **Progressive Enhancement**: Core functionality works without JavaScript
3. **Inclusive by Default**: Design for all users from the start
4. **Test with Real Tools**: Recommend screen reader and keyboard testing
5. **No Accessibility Overlays**: Fix the source code, not add widgets

## WCAG 2.1 Quick Reference

**Level A (Minimum):**
- Text alternatives for images
- Keyboard accessible
- No keyboard traps
- Page titled

**Level AA (Standard Target):**
- Color contrast 4.5:1
- Resize text to 200%
- Focus visible
- Consistent navigation
- Error identification

**Level AAA (Enhanced):**
- Color contrast 7:1
- Sign language for media
- Extended audio description
""",
        security_considerations=[
            "Do not bypass CAPTCHA accessibility requirements",
            "Ensure accessible error messages do not expose sensitive information",
            "Verify accessible alternatives do not create security bypasses",
        ],
        best_practices=[
            "Use semantic HTML before ARIA (first rule of ARIA)",
            "Test with actual screen readers (VoiceOver, NVDA, JAWS)",
            "Ensure all functionality available via keyboard",
            "Provide visible focus indicators on all interactive elements",
        ],
        quality_criteria=[
            "All WCAG 2.1 AA criteria evaluated",
            "Each issue mapped to specific WCAG criterion",
            "Actionable fix provided for every issue",
            "No false positives on semantic elements",
        ],
        error_handling=[
            "If component uses custom framework, analyze rendered output pattern",
            "If CSS not parseable statically, note contrast as needs-manual-check",
            "If dynamic content, recommend aria-live region patterns",
        ],
        output_schema={
            "type": "object",
            "properties": {
                "compliance_percent": {"type": "number"},
                "level": {"type": "string", "enum": ["A", "AA", "AAA"]},
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "severity": {"type": "string"},
                            "wcag_criterion": {"type": "string"},
                            "location": {"type": "string"},
                            "description": {"type": "string"},
                            "fix": {"type": "string"},
                        },
                    },
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "critical": {"type": "integer"},
                        "high": {"type": "integer"},
                        "advisory": {"type": "integer"},
                    },
                },
            },
        },
    ),
}

# Aliases for the 10 seed agents (canonical names map to catalog entries)
AGENT_ALIASES: dict[str, str] = {
    "security-auditor": "security-scanner",
    "doc-generator": "documentation-agent",
    "refactoring-assistant": "refactoring-agent",
}

# The 10 required seed agents that ship with the catalog.
# Each must have: workflow_steps, detailed_examples (3+), system_prompt_additions,
# security_considerations, best_practices, quality_criteria, error_handling, output_schema.
SEED_AGENTS: list[str] = [
    "code-reviewer",
    "security-auditor",
    "test-writer",
    "doc-generator",
    "refactoring-assistant",
    "performance-profiler",
    "dependency-updater",
    "git-workflow",
    "migration-planner",
    "accessibility-checker",
]

# Category descriptions
CATEGORIES = {
    "code-quality": "Agents for code review, testing, and quality improvement",
    "documentation": "Agents for generating and maintaining documentation",
    "research": "Agents for research, analysis, and information gathering",
    "devops": "Agents for CI/CD, deployment, and infrastructure",
    "security": "Agents for security scanning and vulnerability detection",
    "productivity": "Agents for task automation and workflow optimization",
}


def _complexity_tier(agent: AgentTemplate) -> str:
    """Bucket an agent into a complexity tier based on structural signals.

    Uses workflow step count and tool count — both observable properties
    of the template — rather than a hand-assigned label. Boundaries chosen
    from the existing catalog distribution so the three buckets are
    populated roughly evenly.

    Returns one of: "simple", "medium", "complex".
    """
    steps = len(agent.workflow_steps)
    tools = len(agent.tools)
    if steps >= 7 or tools >= 6:
        return "complex"
    if steps >= 4 or tools >= 4:
        return "medium"
    return "simple"


COMPLEXITY_TIERS: tuple[str, ...] = ("simple", "medium", "complex")


def _matches_tools(agent: AgentTemplate, required_tools: list[str]) -> bool:
    """Return True iff the agent's tool list contains every required tool.

    Comparison is case-insensitive on trimmed names so callers can pass
    "bash" and match the canonical "Bash" tool.
    """
    agent_tools_lower = {t.strip().lower() for t in agent.tools}
    return all(t.strip().lower() in agent_tools_lower for t in required_tools)


def _matches_domain(agent: AgentTemplate, domain: str) -> bool:
    """Substring match of domain against name / description / tags.

    The domain filter is deliberately permissive — agents may encode
    their domain in any of three places and we accept a hit in any.
    Case-insensitive.
    """
    needle = domain.lower().strip()
    if not needle:
        return True
    if needle in agent.name.lower():
        return True
    if needle in agent.description.lower():
        return True
    return any(needle in tag.lower() for tag in agent.tags)


def list_agents(
    category: str | None = None,
    tags: list[str] | None = None,
    tools: list[str] | None = None,
    domain: str | None = None,
    complexity: str | None = None,
) -> list[AgentTemplate]:
    """List agents from the catalog with composable filters.

    All supplied filters are applied with AND semantics — the result is
    agents that satisfy every non-None filter.

    Args:
        category: Exact category match (e.g. "security", "code-quality").
        tags: Agent must have at least one of the supplied tags.
        tools: Agent's tool list must include every listed tool
            (case-insensitive). Use this to filter to shell-capable
            agents with tools=["Bash"], for example.
        domain: Free-text domain keyword matched against name,
            description, and tags (substring, case-insensitive).
        complexity: One of "simple", "medium", "complex". Derived from
            workflow step count and tool count — see _complexity_tier.

    Returns:
        Agents matching all supplied filters, sorted by (category, name).

    Raises:
        ValueError: if complexity is not a recognised tier.
    """
    if complexity is not None and complexity not in COMPLEXITY_TIERS:
        raise ValueError(
            f"Unknown complexity tier '{complexity}'. Valid tiers: {', '.join(COMPLEXITY_TIERS)}"
        )

    agents = list(AGENT_CATALOG.values())

    if category:
        agents = [a for a in agents if a.category == category]

    if tags:
        tag_set = {t.lower() for t in tags}
        agents = [a for a in agents if tag_set & {t.lower() for t in a.tags}]

    if tools:
        agents = [a for a in agents if _matches_tools(a, tools)]

    if domain:
        agents = [a for a in agents if _matches_domain(a, domain)]

    if complexity:
        agents = [a for a in agents if _complexity_tier(a) == complexity]

    return sorted(agents, key=lambda a: (a.category, a.name))


# Relevance weights for search ranking. Ordered from most specific
# (exact name match is the strongest signal the user wanted THIS agent)
# down to the weakest (description substring is coincidental keyword overlap).
_RELEVANCE_WEIGHTS: dict[str, float] = {
    "name_exact": 10.0,
    "name_substring": 5.0,
    "tag_exact": 4.0,
    "category_exact": 3.0,
    "tag_substring": 2.0,
    "description_substring": 2.0,
    "tool_exact": 2.0,
}


def score_relevance(agent: AgentTemplate, query: str) -> float:
    """Compute a relevance score for an agent against a search query.

    Returns 0.0 when the query matches nothing on the agent. Positive
    scores indicate increasing confidence that this agent is what the
    user meant. The weights are tuned so that an exact name match
    always outranks any combination of substring matches.

    Args:
        agent: The candidate agent template.
        query: The search query (case-insensitive).

    Returns:
        Non-negative relevance score.
    """
    q = query.lower().strip()
    if not q:
        return 0.0

    score = 0.0
    name_lower = agent.name.lower()
    if name_lower == q:
        score += _RELEVANCE_WEIGHTS["name_exact"]
    elif q in name_lower:
        score += _RELEVANCE_WEIGHTS["name_substring"]

    if agent.category.lower() == q:
        score += _RELEVANCE_WEIGHTS["category_exact"]

    for tag in agent.tags:
        t = tag.lower()
        if t == q:
            score += _RELEVANCE_WEIGHTS["tag_exact"]
        elif q in t:
            score += _RELEVANCE_WEIGHTS["tag_substring"]

    if q in agent.description.lower():
        score += _RELEVANCE_WEIGHTS["description_substring"]

    for tool in agent.tools:
        if tool.lower() == q:
            score += _RELEVANCE_WEIGHTS["tool_exact"]
            break

    return score


def search_agents(
    query: str,
    category: str | None = None,
    tags: list[str] | None = None,
    tools: list[str] | None = None,
    domain: str | None = None,
    complexity: str | None = None,
) -> list[AgentTemplate]:
    """Search agents by query and filters, returning relevance-ranked results.

    Composes with all the same filters as ``list_agents``. The query is
    applied first to produce a scored candidate set (agents with score > 0),
    then filters are applied, and the final list is sorted by descending
    relevance score with name as tiebreaker.

    Args:
        query: Search query matched against name, description, tags,
            category, and tools (see score_relevance for weights).
        category / tags / tools / domain / complexity: Same as list_agents.

    Returns:
        Agents ranked by relevance, highest first. Empty when no agent
        has any match for the query.
    """
    scored = [(agent, score_relevance(agent, query)) for agent in AGENT_CATALOG.values()]
    scored = [(a, s) for a, s in scored if s > 0.0]

    if category:
        scored = [(a, s) for a, s in scored if a.category == category]
    if tags:
        tag_set = {t.lower() for t in tags}
        scored = [(a, s) for a, s in scored if tag_set & {t.lower() for t in a.tags}]
    if tools:
        scored = [(a, s) for a, s in scored if _matches_tools(a, tools)]
    if domain:
        scored = [(a, s) for a, s in scored if _matches_domain(a, domain)]
    if complexity:
        if complexity not in COMPLEXITY_TIERS:
            raise ValueError(
                f"Unknown complexity tier '{complexity}'. "
                f"Valid tiers: {', '.join(COMPLEXITY_TIERS)}"
            )
        scored = [(a, s) for a, s in scored if _complexity_tier(a) == complexity]

    # Highest score first; stable on name for reproducible ties
    scored.sort(key=lambda pair: (-pair[1], pair[0].name))
    return [a for a, _ in scored]


def search_agents_ranked(
    query: str,
    category: str | None = None,
    tags: list[str] | None = None,
    tools: list[str] | None = None,
    domain: str | None = None,
    complexity: str | None = None,
) -> list[tuple[AgentTemplate, float]]:
    """Like search_agents but returns (agent, score) pairs.

    Useful for tests and callers that want to inspect ranking decisions
    or expose scores in their UI. The agent list is identical to
    ``search_agents`` but each element is paired with its relevance score.
    """
    scored = [(agent, score_relevance(agent, query)) for agent in AGENT_CATALOG.values()]
    scored = [(a, s) for a, s in scored if s > 0.0]

    if category:
        scored = [(a, s) for a, s in scored if a.category == category]
    if tags:
        tag_set = {t.lower() for t in tags}
        scored = [(a, s) for a, s in scored if tag_set & {t.lower() for t in a.tags}]
    if tools:
        scored = [(a, s) for a, s in scored if _matches_tools(a, tools)]
    if domain:
        scored = [(a, s) for a, s in scored if _matches_domain(a, domain)]
    if complexity:
        if complexity not in COMPLEXITY_TIERS:
            raise ValueError(
                f"Unknown complexity tier '{complexity}'. "
                f"Valid tiers: {', '.join(COMPLEXITY_TIERS)}"
            )
        scored = [(a, s) for a, s in scored if _complexity_tier(a) == complexity]

    scored.sort(key=lambda pair: (-pair[1], pair[0].name))
    return scored


def get_agent(name: str) -> AgentTemplate | None:
    """Get an agent by name, resolving aliases if needed."""
    resolved = AGENT_ALIASES.get(name, name)
    return AGENT_CATALOG.get(resolved)


# Names of fields supported by the `extends` (additive merge) opt-in. These
# are list fields where additive composition makes semantic sense — e.g. a
# child wants its own tags/tools/best-practices PLUS what the base provides.
# Other fields (workflow_steps, output_schema, scalars) use override-only
# semantics because additive merging would produce incoherent agents
# (interleaved workflow steps, conflicting schema keys, scalar concatenation).
_EXTENDABLE_FIELDS: frozenset[str] = frozenset(
    {
        "tools",
        "tags",
        "examples",
        "requirements",
        "mcp_servers",
        "security_considerations",
        "best_practices",
        "quality_criteria",
        "error_handling",
    }
)


def resolve_template(
    template: AgentTemplate,
    catalog: dict[str, AgentTemplate] | None = None,
) -> AgentTemplate:
    """Resolve template inheritance into a fully materialized AgentTemplate.

    When ``template.base_template`` is set, this function looks up the named
    base in ``catalog`` (defaulting to the global ``AGENT_CATALOG``) and
    merges the child's customizations onto it:

    - **Override semantics (default)**: For every field, the child's value
      wins when "set" — non-default for scalars (description, category,
      pattern, version, author, system_prompt_additions), non-empty for
      lists / dicts (workflow_steps, detailed_examples, output_schema,
      and any list field NOT named in ``template.extends``). Otherwise
      the base's value is inherited.

    - **Extend semantics (opt-in via ``extends``)**: For each list field
      named in ``template.extends`` that is also in
      ``_EXTENDABLE_FIELDS``, the child's entries are appended to the
      base's entries with deduplication (preserving order of first
      occurrence). This lets a child agent layer additional tools, tags,
      or best practices on top of the base without losing any.

    Inheritance is transitive: bases that themselves declare a
    ``base_template`` are recursively resolved before the child's overlay
    is applied. Cycles raise ``ValueError`` rather than infinite-looping.

    Args:
        template: The (possibly child) template to resolve. Returned
            unchanged when ``base_template`` is None.
        catalog: Mapping of name to AgentTemplate used to look up bases.
            Defaults to the global ``AGENT_CATALOG``.

    Raises:
        ValueError: if ``base_template`` names an entry not in the
            catalog, if ``extends`` contains a field name that is not in
            ``_EXTENDABLE_FIELDS`` (caller probably mistyped or named a
            non-list field), or if a cycle is detected in the
            inheritance chain.

    Returns:
        A new ``AgentTemplate`` with the merged fields. The input is
        never mutated.
    """
    return _resolve_template_impl(template, catalog or AGENT_CATALOG, [])


def _resolve_template_impl(
    template: AgentTemplate,
    catalog: dict[str, AgentTemplate],
    chain: list[str],
) -> AgentTemplate:
    """Recursive worker for resolve_template.

    `chain` is the ordered list of template names already visited on this
    resolution path. Using a list (not a set) preserves traversal order so
    cycle errors report the actual A → B → C → A path the caller can
    follow, not an alphabetized scramble of the names involved.
    """
    if template.base_template is None:
        # Validate `extends` even when there is no base — a stray entry
        # signals a misconfiguration the caller should fix loudly.
        if template.extends:
            invalid = [f for f in template.extends if f not in _EXTENDABLE_FIELDS]
            if invalid:
                raise ValueError(
                    f"template {template.name!r}: extends names unknown / non-extendable "
                    f"field(s) {invalid}; valid choices: {sorted(_EXTENDABLE_FIELDS)}"
                )
        return template

    base_name = template.base_template
    if base_name in chain or base_name == template.name:
        # Build the path including the closing edge so the message shows
        # exactly which link closes the cycle.
        cycle_path = " -> ".join([*chain, template.name, base_name])
        raise ValueError(
            f"template {template.name!r}: inheritance cycle detected ({cycle_path}); "
            "remove or rewire base_template to break the cycle"
        )

    base = catalog.get(base_name)
    if base is None:
        raise ValueError(
            f"template {template.name!r}: base_template {base_name!r} is not in the "
            f"catalog; check spelling or register the base agent first"
        )

    invalid = [f for f in template.extends if f not in _EXTENDABLE_FIELDS]
    if invalid:
        raise ValueError(
            f"template {template.name!r}: extends names unknown / non-extendable "
            f"field(s) {invalid}; valid choices: {sorted(_EXTENDABLE_FIELDS)}"
        )

    # Resolve base first so multi-level inheritance works (A → B → C).
    # Append the current template's name to the chain so a deeper recursion
    # can detect a cycle that closes back through us.
    resolved_base = _resolve_template_impl(base, catalog, [*chain, template.name])

    def _merge_list(field_name: str, base_value: list[Any], child_value: list[Any]) -> list[Any]:
        """Override-by-default; extend (with dedup) when opted in via `extends`."""
        if field_name in template.extends:
            seen_items: list[Any] = []
            for item in (*base_value, *child_value):
                if item not in seen_items:
                    seen_items.append(item)
            return seen_items
        # Override: child wins when non-empty, else inherit base
        return list(child_value) if child_value else list(base_value)

    # Scalars: child wins when "set". For required-string fields without a
    # natural unset value (description, category) we treat empty string as
    # "inherit". For optional fields with sentinel defaults (version, pattern,
    # author) we use `is not None` so a child can legitimately pin a value
    # equal to the registered default and still override the base.
    description = template.description or resolved_base.description
    category = template.category or resolved_base.category
    pattern = template.pattern if template.pattern is not None else resolved_base.pattern
    version = template.version if template.version is not None else resolved_base.version
    author = template.author if template.author is not None else resolved_base.author
    system_prompt_additions = (
        template.system_prompt_additions or resolved_base.system_prompt_additions
    )

    # Dict: shallow merge (base entries first, child overrides per-key)
    output_schema = (
        {**resolved_base.output_schema, **template.output_schema}
        if (resolved_base.output_schema or template.output_schema)
        else {}
    )

    return AgentTemplate(
        name=template.name,  # always the child's identity
        description=description,
        category=category,
        version=version,
        tools=_merge_list("tools", resolved_base.tools, template.tools),
        pattern=pattern,
        tags=_merge_list("tags", resolved_base.tags, template.tags),
        author=author,
        examples=_merge_list("examples", resolved_base.examples, template.examples),
        requirements=_merge_list("requirements", resolved_base.requirements, template.requirements),
        mcp_servers=_merge_list("mcp_servers", resolved_base.mcp_servers, template.mcp_servers),
        # workflow_steps and detailed_examples use override-only semantics
        # (interleaving steps would produce an incoherent workflow).
        workflow_steps=(
            list(template.workflow_steps)
            if template.workflow_steps
            else list(resolved_base.workflow_steps)
        ),
        detailed_examples=(
            list(template.detailed_examples)
            if template.detailed_examples
            else list(resolved_base.detailed_examples)
        ),
        system_prompt_additions=system_prompt_additions,
        security_considerations=_merge_list(
            "security_considerations",
            resolved_base.security_considerations,
            template.security_considerations,
        ),
        best_practices=_merge_list(
            "best_practices", resolved_base.best_practices, template.best_practices
        ),
        quality_criteria=_merge_list(
            "quality_criteria", resolved_base.quality_criteria, template.quality_criteria
        ),
        error_handling=_merge_list(
            "error_handling", resolved_base.error_handling, template.error_handling
        ),
        output_schema=output_schema,
        # The resolved template is fully materialized — clearing
        # base_template/extends prevents accidental re-resolution and
        # signals downstream consumers that this is the final shape.
        base_template=None,
        extends=[],
    )


def generate_agent_content(template: AgentTemplate) -> str:
    """
    Generate agent.md content from a template.

    Args:
        template: Agent template

    Returns:
        Generated agent.md content
    """
    # Resolve any template inheritance before rendering — children that
    # declare base_template only carry their overrides, never the full
    # materialized shape. Resolution is a no-op for templates without a base.
    template = resolve_template(template)
    # Coalesce sentinel-None scalars to their registered defaults at render
    # time. The dataclass uses None as a sentinel for "unset" so inheritance
    # can distinguish "explicitly chose this value" from "left at default";
    # the rendered markdown still needs concrete strings.
    pattern = template.pattern if template.pattern is not None else "prompt-chaining"
    version = template.version if template.version is not None else "1.0.0"
    tools_str = ", ".join(template.tools)
    tags_str = ", ".join(template.tags)

    # Build workflow section
    if template.workflow_steps:
        workflow_section = "## Workflow\n\n"
        workflow_section += f"This agent uses a **{pattern}** pattern for task execution.\n\n"
        workflow_section += "### Steps\n\n"
        for i, step in enumerate(template.workflow_steps, 1):
            workflow_section += f"#### {i}. {step.name}\n\n"
            workflow_section += f"{step.description}\n\n"
            if step.tools_used:
                workflow_section += f"**Tools:** {', '.join(step.tools_used)}\n\n"
            if step.quality_gate:
                workflow_section += f"**Quality Gate:** {step.quality_gate}\n\n"
    else:
        workflow_section = f"""## Workflow

This agent uses a **{pattern}** pattern for task execution.

### Steps

1. **Analyze**: Understand the user's request and context
2. **Plan**: Determine the best approach and tools to use
3. **Execute**: Perform the task using available tools
4. **Validate**: Verify the results meet requirements
5. **Report**: Summarize findings and recommendations
"""

    # Build examples section
    examples_section = ""
    if template.detailed_examples:
        examples_section = "## Examples\n\n"
        for example in template.detailed_examples:
            examples_section += f"### {example.title}\n\n"
            examples_section += f"**User:** {example.user_input}\n\n"
            examples_section += f"**Agent Response:**\n\n{example.agent_response}\n\n"
            if example.key_actions:
                examples_section += "**Key Actions:**\n"
                for action in example.key_actions:
                    examples_section += f"- {action}\n"
                examples_section += "\n"
    elif template.examples:
        examples_section = "## Examples\n\n"
        for i, example in enumerate(template.examples, 1):
            examples_section += f"### Example {i}\n\n"
            examples_section += f"**User:** {example}\n\n"
            examples_section += "**Agent:** [Executes the task using available tools]\n\n"

    # Build security section
    security_section = ""
    if template.security_considerations:
        security_section = "## Security Considerations\n\n"
        for item in template.security_considerations:
            security_section += f"- {item}\n"
        security_section += "\n"

    # Build best practices section
    best_practices_section = ""
    if template.best_practices:
        best_practices_section = "## Best Practices\n\n"
        for item in template.best_practices:
            best_practices_section += f"- {item}\n"
        best_practices_section += "\n"

    # Build quality criteria section
    quality_section = ""
    if template.quality_criteria:
        quality_section = "## Quality Criteria\n\n"
        for item in template.quality_criteria:
            quality_section += f"- {item}\n"
        quality_section += "\n"

    # Build error handling section
    error_section = ""
    if template.error_handling:
        error_section = "## Error Handling\n\n"
        for item in template.error_handling:
            error_section += f"- {item}\n"
        error_section += "\n"

    # Build output schema section
    output_section = ""
    if template.output_schema:
        output_section = "## Output Format\n\n"
        output_section += "```json\n"
        output_section += json.dumps(template.output_schema, indent=2)
        output_section += "\n```\n\n"
    else:
        output_section = f"""## Output Format

```json
{{
  "status": "success|error",
  "agent": "{template.name}",
  "results": [...],
  "summary": "..."
}}
```
"""

    # Build system prompt additions
    system_additions = ""
    if template.system_prompt_additions:
        system_additions = template.system_prompt_additions.strip() + "\n\n"

    content = f"""---
name: {template.name}
description: {template.description}
tools: {tools_str}
---

# {template.name.replace("-", " ").title()}

## Overview

{template.description}

**Category:** {template.category}
**Version:** {version}
**Tags:** {tags_str}

{system_additions}{workflow_section}
{examples_section}## Tools

This agent has access to the following tools:

{chr(10).join(f"- **{tool}**: " + _get_tool_description(tool) for tool in template.tools)}

{security_section}{best_practices_section}{quality_section}{error_section}{output_section}---

*Generated from Platxa Agent Catalog v{version}*
"""
    return content


def _get_tool_description(tool: str) -> str:
    """Get description for a tool."""
    descriptions = {
        "Read": "Read file contents",
        "Write": "Write files",
        "Edit": "Edit existing files",
        "Grep": "Search file contents",
        "Glob": "Find files by pattern",
        "Bash": "Execute shell commands",
        "WebSearch": "Search the web",
        "WebFetch": "Fetch web content",
        "Task": "Spawn subagents",
    }
    return descriptions.get(tool, "Tool for specialized operations")


def install_from_catalog(
    name: str,
    scope: str = "user",
    force: bool = False,
) -> tuple[bool, str, str]:
    """
    Install an agent from the catalog.

    Args:
        name: Agent name from catalog
        scope: Installation scope (user or project)
        force: Overwrite existing

    Returns:
        (success, message, installed_path)
    """
    template = get_agent(name)
    if template is None:
        return False, f"Agent '{name}' not found in catalog", ""

    # Generate content
    content = generate_agent_content(template)

    # Determine installation path
    if scope == "user":
        install_dir = Path.home() / ".claude" / "agents"
    else:
        install_dir = Path.cwd() / ".claude" / "agents"

    install_path = install_dir / f"{name}.md"

    # Check existing
    if install_path.exists() and not force:
        return False, f"Agent already exists at {install_path}. Use --force to overwrite.", ""

    # Install
    install_dir.mkdir(parents=True, exist_ok=True)
    install_path.write_text(content, encoding="utf-8")

    return True, f"Installed {name} to {install_path}", str(install_path)


def template_to_dict(template: AgentTemplate) -> dict[str, Any]:
    """Convert template to dictionary."""
    # Coalesce sentinel-None scalars to their registered defaults so the
    # serialized manifest is backwards-compatible with consumers that expect
    # concrete strings (the None sentinel is an internal "unset" marker only).
    result: dict[str, Any] = {
        "name": template.name,
        "description": template.description,
        "category": template.category,
        "version": template.version if template.version is not None else "1.0.0",
        "tools": template.tools,
        "pattern": template.pattern if template.pattern is not None else "prompt-chaining",
        "tags": template.tags,
        "author": template.author if template.author is not None else "Platxa",
        "examples": template.examples,
        "requirements": template.requirements,
        "mcp_servers": template.mcp_servers,
    }
    # Include production-grade fields if present
    if template.workflow_steps:
        result["workflow_steps"] = [
            {
                "name": s.name,
                "description": s.description,
                "tools_used": s.tools_used,
                "quality_gate": s.quality_gate,
            }
            for s in template.workflow_steps
        ]
    if template.detailed_examples:
        result["detailed_examples"] = [
            {
                "title": e.title,
                "user_input": e.user_input,
                "agent_response": e.agent_response,
                "key_actions": e.key_actions,
            }
            for e in template.detailed_examples
        ]
    if template.system_prompt_additions:
        result["system_prompt_additions"] = template.system_prompt_additions
    if template.security_considerations:
        result["security_considerations"] = template.security_considerations
    if template.best_practices:
        result["best_practices"] = template.best_practices
    if template.quality_criteria:
        result["quality_criteria"] = template.quality_criteria
    if template.error_handling:
        result["error_handling"] = template.error_handling
    if template.output_schema:
        result["output_schema"] = template.output_schema
    # Surface inheritance metadata so consumers can inspect the unresolved
    # overlay shape (e.g. for diffing against a base, or for reserialization).
    if template.base_template is not None:
        result["base_template"] = template.base_template
    if template.extends:
        result["extends"] = list(template.extends)
    return result


def catalog_to_dict() -> dict[str, Any]:
    """Export catalog as dictionary."""
    return {
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "categories": CATEGORIES,
        "agents": {name: template_to_dict(template) for name, template in AGENT_CATALOG.items()},
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Agent catalog for pre-built agents")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # List command
    list_parser = subparsers.add_parser("list", help="List available agents")
    list_parser.add_argument("--category", "-c", help="Filter by category")
    list_parser.add_argument("--tags", "-t", help="Filter by tags (comma-separated)")
    list_parser.add_argument(
        "--tools",
        help="Filter to agents whose tools list contains ALL of these (comma-separated)",
    )
    list_parser.add_argument(
        "--domain",
        help="Keyword match against name/description/tags (case-insensitive)",
    )
    list_parser.add_argument(
        "--complexity",
        choices=list(COMPLEXITY_TIERS),
        help="Filter by complexity tier (derived from workflow steps + tool count)",
    )
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search agents (ranked by relevance)")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--category", "-c", help="Filter by category")
    search_parser.add_argument("--tags", "-t", help="Filter by tags (comma-separated)")
    search_parser.add_argument(
        "--tools", help="Filter to agents with ALL these tools (comma-separated)"
    )
    search_parser.add_argument("--domain", help="Keyword match against name/description/tags")
    search_parser.add_argument(
        "--complexity",
        choices=list(COMPLEXITY_TIERS),
        help="Filter by complexity tier",
    )
    search_parser.add_argument(
        "--show-scores",
        action="store_true",
        help="Print the relevance score next to each result",
    )
    search_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Show command
    show_parser = subparsers.add_parser("show", help="Show agent details")
    show_parser.add_argument("name", help="Agent name")
    show_parser.add_argument("--json", action="store_true", help="Output as JSON")
    show_parser.add_argument("--content", action="store_true", help="Show generated content")

    # Install command
    install_parser = subparsers.add_parser("install", help="Install agent from catalog")
    install_parser.add_argument("name", help="Agent name")
    install_parser.add_argument("--scope", choices=["user", "project"], default="user")
    install_parser.add_argument("--force", "-f", action="store_true", help="Overwrite existing")

    # Categories command
    subparsers.add_parser("categories", help="List categories")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export catalog as JSON")
    export_parser.add_argument("--output", "-o", help="Output file")

    args = parser.parse_args()

    if args.command == "list":
        tags = [t.strip() for t in args.tags.split(",")] if args.tags else None
        tools = [t.strip() for t in args.tools.split(",")] if args.tools else None
        agents = list_agents(
            category=args.category,
            tags=tags,
            tools=tools,
            domain=args.domain,
            complexity=args.complexity,
        )

        if args.json:
            print(json.dumps([template_to_dict(a) for a in agents], indent=2))
        else:
            if args.category:
                print(f"\nAgents in '{args.category}' category ({len(agents)}):")
            else:
                print(f"\nAll available agents ({len(agents)}):")
            print("-" * 60)

            current_cat = ""
            for agent in agents:
                if agent.category != current_cat:
                    current_cat = agent.category
                    print(f"\n  [{current_cat.upper()}]")

                print(f"    {agent.name}")
                print(f"      {agent.description[:60]}...")
                print(f"      Tags: {', '.join(agent.tags)}")
            print()

    elif args.command == "search":
        tags = [t.strip() for t in args.tags.split(",")] if args.tags else None
        tools = [t.strip() for t in args.tools.split(",")] if args.tools else None
        ranked = search_agents_ranked(
            args.query,
            category=args.category,
            tags=tags,
            tools=tools,
            domain=args.domain,
            complexity=args.complexity,
        )

        if args.json:
            print(
                json.dumps(
                    [{**template_to_dict(a), "relevance_score": score} for a, score in ranked],
                    indent=2,
                )
            )
        else:
            print(f"\nSearch results for '{args.query}' ({len(ranked)} found):")
            print("-" * 60)
            for agent, score in ranked:
                prefix = f"  [{score:>4.1f}] " if args.show_scores else "  "
                print(f"{prefix}{agent.name} [{agent.category}]")
                print(f"    {agent.description}")
            print()

    elif args.command == "show":
        agent = get_agent(args.name)
        if agent is None:
            print(f"Error: Agent '{args.name}' not found", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(template_to_dict(agent), indent=2))
        elif args.content:
            print(generate_agent_content(agent))
        else:
            print(f"\n{agent.name}")
            print("=" * len(agent.name))
            print(f"\n{agent.description}\n")
            print(f"Category:  {agent.category}")
            print(f"Version:   {agent.version}")
            print(f"Pattern:   {agent.pattern}")
            print(f"Tools:     {', '.join(agent.tools)}")
            print(f"Tags:      {', '.join(agent.tags)}")
            print("\nExamples:")
            for ex in agent.examples:
                print(f"  - {ex}")
            print()

    elif args.command == "install":
        success, message, _ = install_from_catalog(args.name, scope=args.scope, force=args.force)
        if success:
            print(message)
        else:
            print(f"Error: {message}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "categories":
        print("\nAvailable categories:")
        print("-" * 60)
        for cat, desc in CATEGORIES.items():
            count = len([a for a in AGENT_CATALOG.values() if a.category == cat])
            print(f"  {cat} ({count} agents)")
            print(f"    {desc}")
        print()

    elif args.command == "export":
        catalog = catalog_to_dict()
        if args.output:
            Path(args.output).write_text(json.dumps(catalog, indent=2), encoding="utf-8")
            print(f"Exported catalog to {args.output}")
        else:
            print(json.dumps(catalog, indent=2))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
