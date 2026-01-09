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
    version: str = "1.0.0"
    tools: list[str] = field(default_factory=list)
    pattern: str = "prompt-chaining"
    tags: list[str] = field(default_factory=list)
    author: str = "Platxa"
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
                "summary": {"type": "object", "properties": {
                    "files_reviewed": {"type": "integer"},
                    "total_lines": {"type": "integer"},
                    "quality_score": {"type": "number"},
                    "verdict": {"type": "string", "enum": ["approved", "approved_with_suggestions", "changes_required", "rejected"]},
                }},
                "critical_issues": {"type": "array", "items": {"type": "object", "properties": {
                    "file": {"type": "string"},
                    "line": {"type": "integer"},
                    "severity": {"type": "string"},
                    "confidence": {"type": "string"},
                    "description": {"type": "string"},
                    "suggestion": {"type": "string"},
                }}},
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
                "summary": {"type": "object", "properties": {
                    "tests_generated": {"type": "integer"},
                    "tests_passing": {"type": "integer"},
                    "coverage_before": {"type": "number"},
                    "coverage_after": {"type": "number"},
                }},
                "files_created": {"type": "array", "items": {"type": "string"}},
                "test_breakdown": {"type": "object", "properties": {
                    "unit_tests": {"type": "integer"},
                    "integration_tests": {"type": "integer"},
                    "e2e_tests": {"type": "integer"},
                }},
                "uncovered_paths": {"type": "array", "items": {"type": "string"}},
            },
        },
    ),
    "refactoring-agent": AgentTemplate(
        name="refactoring-agent",
        description="Identifies and performs code refactoring to improve structure, readability, and maintainability",
        category="code-quality",
        version="1.0.0",
        tools=["Read", "Write", "Edit", "Grep", "Glob"],
        pattern="evaluator-optimizer",
        tags=["refactor", "clean-code", "maintainability"],
        examples=[
            "Refactor this function to be more readable",
            "Extract common logic into a utility",
            "Simplify this complex method",
        ],
    ),
    # Documentation Agents
    "documentation-agent": AgentTemplate(
        name="documentation-agent",
        description="Generates and maintains documentation including README, API docs, and code comments",
        category="documentation",
        version="1.0.0",
        tools=["Read", "Write", "Grep", "Glob"],
        pattern="prompt-chaining",
        tags=["docs", "readme", "api-docs", "comments"],
        examples=[
            "Generate README for this project",
            "Document this API endpoint",
            "Add docstrings to this module",
        ],
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
        description="Conducts research on topics using web search, documentation analysis, and synthesis",
        category="research",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
        pattern="orchestrator-workers",
        tags=["research", "analysis", "web-search"],
        examples=[
            "Research best practices for authentication",
            "Find documentation for this library",
            "Compare different approaches to caching",
        ],
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
                "summary": {"type": "object", "properties": {
                    "files_scanned": {"type": "integer"},
                    "critical": {"type": "integer"},
                    "high": {"type": "integer"},
                    "medium": {"type": "integer"},
                }},
                "findings": {"type": "array"},
                "secrets_found": {"type": "array"},
                "vulnerable_dependencies": {"type": "array"},
            },
        },
    ),
    "dependency-auditor": AgentTemplate(
        name="dependency-auditor",
        description="Audits project dependencies for known vulnerabilities and outdated packages",
        category="security",
        version="1.0.0",
        tools=["Read", "Grep", "Glob", "Bash"],
        pattern="prompt-chaining",
        tags=["dependencies", "audit", "npm-audit", "pip-audit"],
        examples=[
            "Audit npm dependencies",
            "Check for vulnerable packages",
            "Find outdated dependencies",
        ],
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
    "git-helper": AgentTemplate(
        name="git-helper",
        description="Assists with git operations including commits, branches, rebasing, and conflict resolution",
        category="productivity",
        version="1.0.0",
        tools=["Read", "Bash", "Grep", "Glob"],
        pattern="routing",
        tags=["git", "version-control", "branches", "commits"],
        examples=[
            "Help resolve merge conflicts",
            "Create a feature branch",
            "Squash commits before merge",
        ],
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
}

# Category descriptions
CATEGORIES = {
    "code-quality": "Agents for code review, testing, and quality improvement",
    "documentation": "Agents for generating and maintaining documentation",
    "research": "Agents for research, analysis, and information gathering",
    "devops": "Agents for CI/CD, deployment, and infrastructure",
    "security": "Agents for security scanning and vulnerability detection",
    "productivity": "Agents for task automation and workflow optimization",
}


def list_agents(
    category: str | None = None,
    tags: list[str] | None = None,
) -> list[AgentTemplate]:
    """
    List agents from the catalog.

    Args:
        category: Filter by category
        tags: Filter by tags (any match)

    Returns:
        List of matching agent templates
    """
    agents = list(AGENT_CATALOG.values())

    if category:
        agents = [a for a in agents if a.category == category]

    if tags:
        tag_set = set(tags)
        agents = [a for a in agents if tag_set & set(a.tags)]

    return sorted(agents, key=lambda a: (a.category, a.name))


def search_agents(query: str) -> list[AgentTemplate]:
    """
    Search agents by query string.

    Args:
        query: Search query (matches name, description, tags)

    Returns:
        List of matching agent templates
    """
    query_lower = query.lower()
    results = []

    for agent in AGENT_CATALOG.values():
        # Check name
        if query_lower in agent.name.lower():
            results.append(agent)
            continue

        # Check description
        if query_lower in agent.description.lower():
            results.append(agent)
            continue

        # Check tags
        if any(query_lower in tag.lower() for tag in agent.tags):
            results.append(agent)
            continue

    return sorted(results, key=lambda a: a.name)


def get_agent(name: str) -> AgentTemplate | None:
    """Get an agent by name."""
    return AGENT_CATALOG.get(name)


def generate_agent_content(template: AgentTemplate) -> str:
    """
    Generate agent.md content from a template.

    Args:
        template: Agent template

    Returns:
        Generated agent.md content
    """
    tools_str = ", ".join(template.tools)
    tags_str = ", ".join(template.tags)

    # Build workflow section
    if template.workflow_steps:
        workflow_section = "## Workflow\n\n"
        workflow_section += f"This agent uses a **{template.pattern}** pattern for task execution.\n\n"
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

This agent uses a **{template.pattern}** pattern for task execution.

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

# {template.name.replace('-', ' ').title()}

## Overview

{template.description}

**Category:** {template.category}
**Version:** {template.version}
**Tags:** {tags_str}

{system_additions}{workflow_section}
{examples_section}## Tools

This agent has access to the following tools:

{chr(10).join(f"- **{tool}**: " + _get_tool_description(tool) for tool in template.tools)}

{security_section}{best_practices_section}{quality_section}{error_section}{output_section}---

*Generated from Platxa Agent Catalog v{template.version}*
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
    result: dict[str, Any] = {
        "name": template.name,
        "description": template.description,
        "category": template.category,
        "version": template.version,
        "tools": template.tools,
        "pattern": template.pattern,
        "tags": template.tags,
        "author": template.author,
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
    return result


def catalog_to_dict() -> dict[str, Any]:
    """Export catalog as dictionary."""
    return {
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "categories": CATEGORIES,
        "agents": {
            name: template_to_dict(template)
            for name, template in AGENT_CATALOG.items()
        },
    }


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Agent catalog for pre-built agents"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # List command
    list_parser = subparsers.add_parser("list", help="List available agents")
    list_parser.add_argument("--category", "-c", help="Filter by category")
    list_parser.add_argument("--tags", "-t", help="Filter by tags (comma-separated)")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search agents")
    search_parser.add_argument("query", help="Search query")
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
        tags = args.tags.split(",") if args.tags else None
        agents = list_agents(category=args.category, tags=tags)

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
        agents = search_agents(args.query)

        if args.json:
            print(json.dumps([template_to_dict(a) for a in agents], indent=2))
        else:
            print(f"\nSearch results for '{args.query}' ({len(agents)} found):")
            print("-" * 60)
            for agent in agents:
                print(f"  {agent.name} [{agent.category}]")
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
            print(f"\nExamples:")
            for ex in agent.examples:
                print(f"  - {ex}")
            print()

    elif args.command == "install":
        success, message, _ = install_from_catalog(
            args.name, scope=args.scope, force=args.force
        )
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
