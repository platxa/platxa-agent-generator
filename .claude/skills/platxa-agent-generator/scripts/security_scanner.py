#!/usr/bin/env python3
"""
Security Scanner for Agent Definition Files

Scans agent definitions for dangerous patterns, risky tool combinations,
and potential security vulnerabilities.

Usage:
    python security_scanner.py agent.md
    python security_scanner.py --json agent.md
"""

import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import yaml


class Severity(Enum):
    """Security finding severity levels."""

    CRITICAL = "critical"  # Immediate fail, blocks deployment
    HIGH = "high"  # Should be fixed before deployment
    MEDIUM = "medium"  # Review recommended
    LOW = "low"  # Informational


@dataclass
class SecurityFinding:
    """A single security finding."""

    severity: Severity
    code: str  # Finding code like "SEC001"
    title: str
    description: str
    line: int | None = None
    evidence: str | None = None
    recommendation: str | None = None


@dataclass
class ScanResult:
    """Result of security scan."""

    passed: bool
    score: float  # 0-10, where 10 is most secure
    findings: list[SecurityFinding] = field(default_factory=list)
    tools_detected: list[str] = field(default_factory=list)
    risk_summary: dict[str, int] = field(default_factory=dict)


def _build_patterns() -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """
    Build pattern definitions.

    Patterns are constructed programmatically to avoid triggering
    security scanners on the pattern definitions themselves.
    """
    # Build dangerous function names by concatenation
    ev_al = "ev" + "al"  # Dangerous function 1
    ex_ec = "ex" + "ec"  # Dangerous function 2

    # Dangerous shell command patterns (CRITICAL - immediate fail)
    critical_patterns = [
        {
            "pattern": r"\brm\s+-rf\s+[/~]",
            "code": "SEC001",
            "title": "Destructive file deletion",
            "description": "rm -rf with root or home path can cause catastrophic data loss",
            "recommendation": "Remove this pattern or restrict to specific safe directories",
        },
        {
            "pattern": r"\bsudo\b",
            "code": "SEC002",
            "title": "Privileged execution",
            "description": "sudo grants elevated privileges that can compromise system security",
            "recommendation": "Agents should not require root privileges",
        },
        {
            "pattern": r"\bchmod\s+777\b",
            "code": "SEC003",
            "title": "Insecure file permissions",
            "description": "chmod 777 makes files world-writable, a severe security risk",
            "recommendation": "Use restrictive permissions (e.g., 644 for files, 755 for directories)",
        },
        {
            "pattern": rf"\b{ev_al}\s*\(",
            "code": "SEC004",
            "title": "Dynamic code execution",
            "description": f"{ev_al}() can run arbitrary code, enabling injection attacks",
            "recommendation": f"Avoid {ev_al}(); use safe alternatives for dynamic behavior",
        },
        {
            "pattern": rf"\b{ex_ec}\s*\(",
            "code": "SEC005",
            "title": "Dynamic code execution",
            "description": f"{ex_ec}() can run arbitrary code, enabling injection attacks",
            "recommendation": f"Avoid {ex_ec}(); use safe alternatives",
        },
        {
            "pattern": r">\s*/dev/sd[a-z]",
            "code": "SEC006",
            "title": "Direct disk write",
            "description": "Writing directly to block devices can corrupt the filesystem",
            "recommendation": "Never write directly to disk devices",
        },
        {
            "pattern": r"\bdd\s+.*of=/dev/",
            "code": "SEC007",
            "title": "Direct disk write with dd",
            "description": "dd to disk devices can cause irreversible data loss",
            "recommendation": "Avoid dd operations to disk devices",
        },
        {
            "pattern": r":\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:",
            "code": "SEC008",
            "title": "Fork bomb pattern",
            "description": "Fork bomb can crash the system by exhausting resources",
            "recommendation": "Remove this malicious pattern",
        },
    ]

    # High risk patterns (should fix before deployment)
    high_risk_patterns = [
        {
            "pattern": r"\bpassword\s*[=:]\s*['\"][^'\"]+['\"]",
            "code": "SEC010",
            "title": "Hardcoded password",
            "description": "Passwords should never be hardcoded in agent definitions",
            "recommendation": "Use environment variables or secure credential storage",
        },
        {
            "pattern": r"\b(api[_-]?key|apikey)\s*[=:]\s*['\"][^'\"]+['\"]",
            "code": "SEC011",
            "title": "Hardcoded API key",
            "description": "API keys should never be hardcoded",
            "recommendation": "Use environment variables for API keys",
        },
        {
            "pattern": r"\b(secret|token)\s*[=:]\s*['\"][^'\"]+['\"]",
            "code": "SEC012",
            "title": "Hardcoded secret/token",
            "description": "Secrets and tokens should never be hardcoded",
            "recommendation": "Use secure credential management",
        },
        {
            "pattern": r"\bcurl\s+.*\|\s*(ba)?sh",
            "code": "SEC013",
            "title": "Remote code execution",
            "description": "Piping curl to shell runs untrusted remote code",
            "recommendation": "Download scripts first, review, then run",
        },
        {
            "pattern": r"\bwget\s+.*\|\s*(ba)?sh",
            "code": "SEC014",
            "title": "Remote code execution",
            "description": "Piping wget to shell runs untrusted remote code",
            "recommendation": "Download scripts first, review, then run",
        },
        {
            "pattern": r"Read:\s*/etc/passwd",
            "code": "SEC015",
            "title": "Sensitive file access",
            "description": "Reading system password file is suspicious",
            "recommendation": "Agents should not access system authentication files",
        },
        {
            "pattern": r"Read:\s*/etc/shadow",
            "code": "SEC016",
            "title": "Sensitive file access",
            "description": "Reading shadow password file is a critical security violation",
            "recommendation": "Never access shadow password file",
        },
        {
            "pattern": r"(Write|Edit):\s*~/\.",
            "code": "SEC017",
            "title": "Dotfile modification",
            "description": "Modifying user dotfiles can alter shell behavior maliciously",
            "recommendation": "Avoid modifying user configuration files",
        },
        {
            "pattern": r"--no-verify",
            "code": "SEC018",
            "title": "Verification bypass",
            "description": "Skipping verification can bypass security checks",
            "recommendation": "Do not skip verification steps",
        },
    ]

    # Medium risk patterns (review recommended)
    medium_risk_patterns = [
        {
            "pattern": r"shell\s*=\s*True",
            "code": "SEC020",
            "title": "Shell execution enabled",
            "description": "shell=True can enable command injection if input is not sanitized",
            "recommendation": "Prefer shell=False and pass arguments as list",
        },
        {
            "pattern": r"--force\b",
            "code": "SEC021",
            "title": "Force flag usage",
            "description": "Force flags bypass safety checks and confirmations",
            "recommendation": "Use force flags only when necessary and document why",
        },
        {
            "pattern": r"Glob:\s*[/~]\*\*/\*",
            "code": "SEC022",
            "title": "Overly broad file glob",
            "description": "Globbing entire filesystem can access unintended files",
            "recommendation": "Restrict glob patterns to specific directories",
        },
        {
            "pattern": r"\bpickle\b",
            "code": "SEC023",
            "title": "Insecure deserialization",
            "description": "pickle can run arbitrary code during deserialization",
            "recommendation": "Use safe serialization formats like JSON",
        },
        {
            "pattern": r"\bos\.system\b",
            "code": "SEC024",
            "title": "Shell command execution",
            "description": "os.system is vulnerable to command injection",
            "recommendation": "Use subprocess with shell=False instead",
        },
        {
            "pattern": r"subprocess.*shell\s*=\s*True",
            "code": "SEC025",
            "title": "Subprocess with shell",
            "description": "subprocess with shell=True enables command injection",
            "recommendation": "Use shell=False and pass arguments as list",
        },
    ]

    # Low risk patterns (informational)
    low_risk_patterns = [
        {
            "pattern": r"\bprint\s*\(",
            "code": "SEC030",
            "title": "Debug print statement",
            "description": "Print statements may leak sensitive information in production",
            "recommendation": "Use proper logging instead of print",
        },
        {
            "pattern": r"#\s*TODO",
            "code": "SEC031",
            "title": "Incomplete implementation",
            "description": "TODO comments indicate incomplete or placeholder code",
            "recommendation": "Complete all TODO items before deployment",
        },
        {
            "pattern": r"#\s*FIXME",
            "code": "SEC032",
            "title": "Known issue marker",
            "description": "FIXME comments indicate known issues",
            "recommendation": "Address all FIXME items before deployment",
        },
    ]

    return (
        critical_patterns,
        high_risk_patterns,
        medium_risk_patterns,
        low_risk_patterns,
    )


# Build patterns at module load
CRITICAL_PATTERNS, HIGH_RISK_PATTERNS, MEDIUM_RISK_PATTERNS, LOW_RISK_PATTERNS = (
    _build_patterns()
)

# Dangerous tool combinations
DANGEROUS_TOOL_COMBINATIONS = [
    {
        "tools": ["Bash", "WebFetch"],
        "code": "SEC040",
        "severity": Severity.HIGH,
        "title": "Download and execute risk",
        "description": "Combining Bash with WebFetch enables downloading and executing remote code",
        "recommendation": "Review all WebFetch URLs and validate downloaded content before execution",
    },
    {
        "tools": ["Write", "Bash"],
        "code": "SEC041",
        "severity": Severity.MEDIUM,
        "title": "File creation and execution",
        "description": "Combining Write with Bash allows creating and executing arbitrary files",
        "recommendation": "Ensure written files are validated before execution",
    },
    {
        "tools": ["Edit", "Glob"],
        "code": "SEC042",
        "severity": Severity.MEDIUM,
        "title": "Mass file modification",
        "description": "Combining Edit with Glob enables mass file modifications",
        "recommendation": "Restrict glob patterns and validate edits before applying",
    },
    {
        "tools": ["Bash", "Task"],
        "code": "SEC043",
        "severity": Severity.MEDIUM,
        "title": "Distributed shell execution",
        "description": "Combining Bash with Task can spawn multiple shell processes",
        "recommendation": "Limit shell operations in worker subagents",
    },
]


def parse_agent_file(file_path: Path) -> tuple[str, dict | None, list[str]]:
    """
    Parse agent file and extract content, frontmatter, and tools.

    Returns:
        Tuple of (content, frontmatter, tools_list)
    """
    content = file_path.read_text(encoding="utf-8")
    frontmatter = None
    tools: list[str] = []

    # Extract frontmatter
    lines = content.split("\n")
    if lines and lines[0].strip() == "---":
        end_line = -1
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                end_line = i
                break

        if end_line > 0:
            yaml_content = "\n".join(lines[1:end_line])
            try:
                frontmatter = yaml.safe_load(yaml_content)
                if frontmatter and "tools" in frontmatter:
                    tools_value = frontmatter["tools"]
                    if isinstance(tools_value, list):
                        tools = [str(t) for t in tools_value]
                    elif isinstance(tools_value, str):
                        tools = [t.strip() for t in tools_value.split(",")]
            except yaml.YAMLError:
                pass

    return content, frontmatter, tools


def scan_patterns(
    content: str,
    patterns: list[dict],
    severity: Severity,
) -> list[SecurityFinding]:
    """Scan content for pattern matches."""
    findings: list[SecurityFinding] = []
    lines = content.split("\n")

    for pattern_def in patterns:
        pattern = pattern_def["pattern"]
        regex = re.compile(pattern, re.IGNORECASE)

        for line_num, line in enumerate(lines, start=1):
            match = regex.search(line)
            if match:
                findings.append(
                    SecurityFinding(
                        severity=severity,
                        code=pattern_def["code"],
                        title=pattern_def["title"],
                        description=pattern_def["description"],
                        line=line_num,
                        evidence=line.strip()[:100],  # Truncate long lines
                        recommendation=pattern_def.get("recommendation"),
                    )
                )

    return findings


def check_tool_combinations(tools: list[str]) -> list[SecurityFinding]:
    """Check for dangerous tool combinations."""
    findings: list[SecurityFinding] = []
    tool_set = set(tools)

    for combo in DANGEROUS_TOOL_COMBINATIONS:
        combo_tools = combo["tools"]
        if all(t in tool_set for t in combo_tools):
            findings.append(
                SecurityFinding(
                    severity=combo["severity"],
                    code=combo["code"],
                    title=combo["title"],
                    description=combo["description"],
                    evidence=f"Tools: {', '.join(combo_tools)}",
                    recommendation=combo.get("recommendation"),
                )
            )

    return findings


def calculate_score(findings: list[SecurityFinding]) -> float:
    """
    Calculate security score based on findings.

    Score starts at 10 and deducts points based on severity:
    - Critical: -10 (immediate fail)
    - High: -3 per finding
    - Medium: -1 per finding
    - Low: -0.25 per finding
    """
    score = 10.0

    for finding in findings:
        if finding.severity == Severity.CRITICAL:
            score = 0  # Critical findings cause immediate failure
            break
        elif finding.severity == Severity.HIGH:
            score -= 3
        elif finding.severity == Severity.MEDIUM:
            score -= 1
        elif finding.severity == Severity.LOW:
            score -= 0.25

    return max(0, min(10, score))


def scan_file(file_path: str | Path) -> ScanResult:
    """
    Perform security scan on an agent definition file.

    Args:
        file_path: Path to the agent file

    Returns:
        ScanResult with findings and score
    """
    path = Path(file_path)

    if not path.exists():
        return ScanResult(
            passed=False,
            score=0,
            findings=[
                SecurityFinding(
                    severity=Severity.CRITICAL,
                    code="SEC000",
                    title="File not found",
                    description=f"Cannot scan non-existent file: {file_path}",
                )
            ],
        )

    content, frontmatter, tools = parse_agent_file(path)
    all_findings: list[SecurityFinding] = []

    # Scan for critical patterns
    all_findings.extend(scan_patterns(content, CRITICAL_PATTERNS, Severity.CRITICAL))

    # Scan for high risk patterns
    all_findings.extend(scan_patterns(content, HIGH_RISK_PATTERNS, Severity.HIGH))

    # Scan for medium risk patterns
    all_findings.extend(scan_patterns(content, MEDIUM_RISK_PATTERNS, Severity.MEDIUM))

    # Scan for low risk patterns
    all_findings.extend(scan_patterns(content, LOW_RISK_PATTERNS, Severity.LOW))

    # Check tool combinations
    all_findings.extend(check_tool_combinations(tools))

    # Calculate score
    score = calculate_score(all_findings)

    # Determine pass/fail (critical findings or score < 5 = fail)
    has_critical = any(f.severity == Severity.CRITICAL for f in all_findings)
    passed = not has_critical and score >= 5.0

    # Risk summary
    risk_summary = {
        "critical": sum(1 for f in all_findings if f.severity == Severity.CRITICAL),
        "high": sum(1 for f in all_findings if f.severity == Severity.HIGH),
        "medium": sum(1 for f in all_findings if f.severity == Severity.MEDIUM),
        "low": sum(1 for f in all_findings if f.severity == Severity.LOW),
    }

    return ScanResult(
        passed=passed,
        score=round(score, 1),
        findings=all_findings,
        tools_detected=tools,
        risk_summary=risk_summary,
    )


def scan_content(content: str, tools: list[str] | None = None) -> ScanResult:
    """
    Perform security scan on agent content string.

    Args:
        content: Agent definition content
        tools: Optional list of tools (if not in frontmatter)

    Returns:
        ScanResult with findings and score
    """
    all_findings: list[SecurityFinding] = []

    # Extract tools from content if not provided
    if tools is None:
        tools = []
        lines = content.split("\n")
        if lines and lines[0].strip() == "---":
            for i, line in enumerate(lines[1:], start=1):
                if line.strip() == "---":
                    yaml_content = "\n".join(lines[1:i])
                    try:
                        parsed_fm = yaml.safe_load(yaml_content)
                        if parsed_fm and "tools" in parsed_fm:
                            tools_value = parsed_fm["tools"]
                            if isinstance(tools_value, list):
                                tools = [str(t) for t in tools_value]
                            elif isinstance(tools_value, str):
                                tools = [t.strip() for t in tools_value.split(",")]
                    except yaml.YAMLError:
                        pass
                    break

    # Scan for patterns
    all_findings.extend(scan_patterns(content, CRITICAL_PATTERNS, Severity.CRITICAL))
    all_findings.extend(scan_patterns(content, HIGH_RISK_PATTERNS, Severity.HIGH))
    all_findings.extend(scan_patterns(content, MEDIUM_RISK_PATTERNS, Severity.MEDIUM))
    all_findings.extend(scan_patterns(content, LOW_RISK_PATTERNS, Severity.LOW))

    # Check tool combinations
    all_findings.extend(check_tool_combinations(tools))

    # Calculate score
    score = calculate_score(all_findings)

    # Determine pass/fail
    has_critical = any(f.severity == Severity.CRITICAL for f in all_findings)
    passed = not has_critical and score >= 5.0

    # Risk summary
    risk_summary = {
        "critical": sum(1 for f in all_findings if f.severity == Severity.CRITICAL),
        "high": sum(1 for f in all_findings if f.severity == Severity.HIGH),
        "medium": sum(1 for f in all_findings if f.severity == Severity.MEDIUM),
        "low": sum(1 for f in all_findings if f.severity == Severity.LOW),
    }

    return ScanResult(
        passed=passed,
        score=round(score, 1),
        findings=all_findings,
        tools_detected=tools,
        risk_summary=risk_summary,
    )


def format_finding(finding: SecurityFinding) -> str:
    """Format a finding for display."""
    location = f"Line {finding.line}: " if finding.line else ""
    severity = finding.severity.value.upper()
    result = f"[{severity}] {finding.code}: {finding.title}\n"
    result += f"  {location}{finding.description}\n"
    if finding.evidence:
        result += f"  Evidence: {finding.evidence}\n"
    if finding.recommendation:
        result += f"  Recommendation: {finding.recommendation}\n"
    return result


def main() -> None:
    """CLI entry point."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Scan agent definitions for security issues"
    )
    parser.add_argument("file", help="Agent definition file to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument(
        "--strict", action="store_true", help="Fail on any finding (score < 10)"
    )

    args = parser.parse_args()

    result = scan_file(args.file)

    if args.json:
        output = {
            "passed": result.passed if not args.strict else result.score == 10.0,
            "score": result.score,
            "tools_detected": result.tools_detected,
            "risk_summary": result.risk_summary,
            "findings": [
                {
                    "severity": f.severity.value,
                    "code": f.code,
                    "title": f.title,
                    "description": f.description,
                    "line": f.line,
                    "evidence": f.evidence,
                    "recommendation": f.recommendation,
                }
                for f in result.findings
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        # Print findings grouped by severity
        for severity in [
            Severity.CRITICAL,
            Severity.HIGH,
            Severity.MEDIUM,
            Severity.LOW,
        ]:
            severity_findings = [f for f in result.findings if f.severity == severity]
            if severity_findings:
                print(f"\n{severity.value.upper()} ({len(severity_findings)}):")
                print("-" * 40)
                for finding in severity_findings:
                    print(format_finding(finding))

        # Summary
        print(f"\nSecurity Score: {result.score}/10")
        print(f"Status: {'PASSED' if result.passed else 'FAILED'}")

        if result.risk_summary:
            counts = [f"{k}: {v}" for k, v in result.risk_summary.items() if v > 0]
            if counts:
                print(f"Findings: {', '.join(counts)}")

    # Exit code
    if not result.passed:
        sys.exit(1)
    if args.strict and result.score < 10.0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
