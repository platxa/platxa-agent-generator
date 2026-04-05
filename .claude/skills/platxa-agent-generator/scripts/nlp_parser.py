#!/usr/bin/env python3
"""
NLP Parser for Platxa Agent Generator

Extracts agent requirements from natural language descriptions:
- Agent name (derived from description)
- Agent type (analyzer, builder, automation, etc.)
- Required tools
- Description summary

Usage:
    python nlp_parser.py "Create an agent that reviews code for security issues"
    python nlp_parser.py --json "Build a documentation generator"
"""

import json
import re
import sys
from dataclasses import asdict, dataclass


@dataclass
class AgentRequirements:
    """Extracted requirements from NLP description."""

    name: str
    agent_type: str
    description: str
    tools: list[str]
    patterns: list[str]
    confidence: float
    domains: list[str]


# Agent type classification keywords
AGENT_TYPES = {
    "analyzer": [
        "analyze",
        "review",
        "audit",
        "inspect",
        "check",
        "scan",
        "detect",
        "find",
        "identify",
        "assess",
        "evaluate",
        "examine",
        "validate",
    ],
    "builder": [
        "create",
        "build",
        "generate",
        "make",
        "produce",
        "construct",
        "develop",
        "write",
        "scaffold",
        "bootstrap",
        "initialize",
    ],
    "automation": [
        "automate",
        "run",
        "execute",
        "trigger",
        "schedule",
        "batch",
        "process",
        "transform",
        "convert",
        "migrate",
        "deploy",
    ],
    "guide": [
        "help",
        "guide",
        "explain",
        "teach",
        "show",
        "demonstrate",
        "walk through",
        "assist",
        "support",
        "advise",
    ],
    "validator": [
        "validate",
        "verify",
        "test",
        "ensure",
        "confirm",
        "assert",
        "check",
        "lint",
        "format",
        "enforce",
    ],
    "orchestrator": [
        "coordinate",
        "orchestrate",
        "manage",
        "delegate",
        "distribute",
        "multi-agent",
        "pipeline",
        "workflow",
        "chain",
    ],
}

# Tool detection patterns
TOOL_PATTERNS = {
    "Read": [
        "read",
        "file",
        "content",
        "source",
        "code",
        "examine",
        "inspect",
        "load",
        "parse",
        "extract",
    ],
    "Write": [
        "write",
        "create",
        "generate",
        "output",
        "save",
        "produce",
        "document",
        "report",
    ],
    "Edit": [
        "edit",
        "modify",
        "update",
        "change",
        "refactor",
        "fix",
        "patch",
        "replace",
        "transform",
    ],
    "Grep": [
        "search",
        "find",
        "grep",
        "pattern",
        "regex",
        "match",
        "locate",
        "scan",
        "query",
    ],
    "Glob": [
        "files",
        "directory",
        "folder",
        "path",
        "glob",
        "list",
        "tree",
        "structure",
        "navigate",
    ],
    "Bash": [
        "run",
        "execute",
        "command",
        "shell",
        "terminal",
        "script",
        "cli",
        "install",
        "build",
        "test",
        "deploy",
    ],
    "WebSearch": [
        "search",
        "web",
        "internet",
        "online",
        "research",
        "lookup",
        "find information",
        "documentation",
    ],
    "WebFetch": ["fetch", "download", "url", "api", "http", "request", "retrieve"],
    "Task": [
        "subagent",
        "delegate",
        "parallel",
        "concurrent",
        "multi",
        "orchestrate",
        "coordinate",
        "spawn",
    ],
}

# Domain classification keywords — each domain maps to keywords that signal it.
# Multi-domain is supported: an input can match several domains simultaneously.
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "web": [
        "web",
        "frontend",
        "backend",
        "html",
        "css",
        "javascript",
        "typescript",
        "react",
        "vue",
        "angular",
        "next.js",
        "nextjs",
        "api",
        "rest",
        "graphql",
        "http",
        "endpoint",
        "browser",
        "dom",
        "spa",
        "ssr",
        "url",
    ],
    "mobile": [
        "mobile",
        "ios",
        "android",
        "react native",
        "flutter",
        "swift",
        "kotlin",
        "app store",
        "apk",
        "xcode",
        "cordova",
        "capacitor",
        "responsive",
        "touch",
        "gesture",
    ],
    "data": [
        "data",
        "database",
        "sql",
        "nosql",
        "postgres",
        "mysql",
        "mongodb",
        "redis",
        "etl",
        "pipeline",
        "warehouse",
        "analytics",
        "csv",
        "json",
        "parquet",
        "pandas",
        "spark",
        "bigquery",
        "schema",
        "migration",
        "orm",
        "query",
    ],
    "devops": [
        "devops",
        "docker",
        "kubernetes",
        "k8s",
        "ci/cd",
        "ci cd",
        "github actions",
        "gitlab ci",
        "jenkins",
        "terraform",
        "ansible",
        "helm",
        "deploy",
        "deployment",
        "infrastructure",
        "cloud",
        "aws",
        "gcp",
        "azure",
        "monitoring",
        "logging",
        "container",
    ],
    "security": [
        "security",
        "vulnerability",
        "auth",
        "authentication",
        "authorization",
        "oauth",
        "jwt",
        "token",
        "secret",
        "credential",
        "owasp",
        "injection",
        "xss",
        "csrf",
        "encrypt",
        "ssl",
        "tls",
        "certificate",
        "penetration",
        "audit",
        "compliance",
    ],
    "testing": [
        "test",
        "testing",
        "unittest",
        "pytest",
        "jest",
        "mocha",
        "coverage",
        "tdd",
        "bdd",
        "e2e",
        "integration test",
        "unit test",
        "mock",
        "fixture",
        "assertion",
        "spec",
        "playwright",
        "cypress",
        "selenium",
    ],
    "documentation": [
        "document",
        "documentation",
        "readme",
        "docstring",
        "jsdoc",
        "api doc",
        "wiki",
        "changelog",
        "guide",
        "tutorial",
        "reference",
        "openapi",
        "swagger",
        "markdown",
        "comment",
    ],
}

# Domain-specific tool mappings — used by detect_tools() and tool_selector.py
DOMAIN_TOOLS: dict[str, list[str]] = {
    "web": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    "mobile": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    "data": ["Read", "Grep", "Glob", "Bash"],
    "devops": ["Bash", "Read", "Write", "Grep", "Glob"],
    "security": ["Read", "Grep", "Glob", "Bash"],
    "testing": ["Read", "Bash", "Grep", "Glob"],
    "documentation": ["Read", "Write", "Glob", "Grep"],
    # Legacy domain keys kept for backward compatibility with tool_selector.py
    "refactoring": ["Read", "Edit", "Grep", "Glob"],
    "code review": ["Read", "Grep", "Glob"],
    "deployment": ["Bash", "Read", "Write"],
    "research": ["WebSearch", "WebFetch", "Read", "Write"],
    "analysis": ["Read", "Grep", "Glob"],
}


def _keyword_matches(keyword: str, text: str) -> bool:
    """Check if a keyword appears in text as a whole word/phrase.

    Uses word-boundary matching to avoid false positives like "rest"
    matching inside "interesting". Multi-word keywords (e.g. "react native")
    are matched as exact phrases with word boundaries on each end.
    """
    # Escape regex special chars in keyword, then wrap with word boundaries
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return bool(re.search(pattern, text))


def detect_domains(description: str) -> list[str]:
    """
    Detect applicable domains from description.

    Supports multi-domain detection — an input like "build a security testing
    tool for web APIs" would return ["web", "security", "testing"].

    Uses word-boundary matching to prevent substring false positives
    (e.g. "rest" inside "interesting").

    Returns:
        Sorted list of detected domain names. Empty list if no domain detected.
    """
    desc_lower = description.lower()
    detected: list[str] = []

    for domain, keywords in DOMAIN_KEYWORDS.items():
        # Count keyword matches using word-boundary matching
        matches = sum(1 for kw in keywords if _keyword_matches(kw, desc_lower))
        if matches > 0:
            detected.append(domain)

    return sorted(detected)


def extract_name(description: str) -> str:
    """Generate agent name from description."""
    # Remove common filler words and action verbs
    stopwords = {
        # Articles and conjunctions
        "a",
        "an",
        "the",
        "that",
        "which",
        "for",
        "to",
        "and",
        "or",
        "with",
        "from",
        "into",
        "onto",
        "upon",
        "about",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "between",
        "under",
        "over",
        # Common verbs used in descriptions
        "create",
        "build",
        "make",
        "agent",
        "can",
        "will",
        "should",
        "would",
        "want",
        "need",
        "like",
        "help",
        "use",
        "using",
        "used",
        # Request phrases
        "please",
        "could",
        "would",
        "might",
        "must",
    }

    words = re.findall(r"\b[a-z]+\b", description.lower())
    meaningful = [w for w in words if w not in stopwords and len(w) > 2]

    # Take first 2-3 meaningful words
    name_parts = meaningful[:3] if len(meaningful) >= 3 else meaningful[:2]

    if not name_parts:
        return "custom-agent"

    return "-".join(name_parts)


def classify_type(description: str) -> tuple[str, float]:
    """Classify agent type from description with confidence score."""
    desc_lower = description.lower()
    scores: dict[str, int] = {}

    for agent_type, keywords in AGENT_TYPES.items():
        score = sum(1 for kw in keywords if kw in desc_lower)
        if score > 0:
            scores[agent_type] = score

    if not scores:
        return "analyzer", 0.5  # Default type with low confidence

    best_type = max(scores, key=lambda k: scores[k])
    total_matches = sum(scores.values())
    confidence = min(scores[best_type] / max(total_matches, 1), 1.0)

    # Boost confidence for strong signals
    if scores[best_type] >= 3:
        confidence = min(confidence + 0.2, 1.0)

    return best_type, round(confidence, 2)


def detect_tools(description: str, domains: list[str] | None = None) -> list[str]:
    """Detect required tools from description and detected domains.

    Args:
        description: Natural language description.
        domains: Pre-detected domains (from detect_domains). If None, domain
            detection is skipped and only keyword/legacy matching is used.

    Returns:
        Sorted list of tool names.
    """
    desc_lower = description.lower()
    detected: set[str] = set()

    # Pattern-based detection
    for tool, patterns in TOOL_PATTERNS.items():
        if any(p in desc_lower for p in patterns):
            detected.add(tool)

    # Domain-based detection — use pre-detected domains when available
    if domains:
        for domain in domains:
            domain_tools = DOMAIN_TOOLS.get(domain, [])
            detected.update(domain_tools)

    # Legacy: also match domain keys directly in description text
    # (covers non-DOMAIN_KEYWORDS keys like "refactoring", "code review")
    for domain, tools in DOMAIN_TOOLS.items():
        if domain not in DOMAIN_KEYWORDS and domain in desc_lower:
            detected.update(tools)

    # Default minimum tools
    if not detected:
        detected = {"Read", "Grep", "Glob"}

    # Always include Read for code-related agents
    if any(word in desc_lower for word in ["code", "file", "source", "project"]):
        detected.add("Read")

    return sorted(detected)


def detect_patterns(description: str) -> list[str]:
    """Detect applicable workflow patterns."""
    desc_lower = description.lower()
    patterns: list[str] = []

    # Orchestrator-workers for multi-agent/complex
    if any(w in desc_lower for w in ["multi", "coordinate", "orchestrate", "complex", "pipeline"]):
        patterns.append("orchestrator-workers")

    # Parallelization for concurrent work
    if any(w in desc_lower for w in ["parallel", "concurrent", "multiple files", "batch"]):
        patterns.append("parallelization")

    # Evaluator-optimizer for iterative refinement
    if any(w in desc_lower for w in ["iterative", "improve", "optimize", "refine", "feedback"]):
        patterns.append("evaluator-optimizer")

    # Routing for classification
    if any(w in desc_lower for w in ["classify", "route", "categorize", "different types"]):
        patterns.append("routing")

    # Default to prompt-chaining for sequential
    if not patterns:
        patterns.append("prompt-chaining")

    return patterns


def generate_description(original: str, agent_type: str) -> str:
    """Generate a concise agent description with type-appropriate verb."""
    desc = original.strip()

    # Phase 1: Remove request prefixes (patterns that include "agent")
    agent_prefixes = [
        r"^create\s+(an?\s+)?agent\s+(that\s+)?(can\s+)?",
        r"^build\s+(an?\s+)?agent\s+(that\s+)?(can\s+)?",
        r"^make\s+(an?\s+)?agent\s+(that\s+)?(can\s+)?",
        r"^i\s+want\s+(an?\s+)?agent\s+(that\s+)?(can\s+)?",
        r"^i\s+need\s+(an?\s+)?agent\s+(that\s+)?(can\s+)?",
        r"^an?\s+agent\s+(that\s+)?(can\s+)?",
    ]

    for prefix in agent_prefixes:
        desc = re.sub(prefix, "", desc, flags=re.IGNORECASE)

    # Phase 2: Remove standalone action verbs at start (build a X, create a Y)
    action_verb_pattern = r"^(create|build|make|generate|write|develop)\s+(an?\s+)?"
    desc = re.sub(action_verb_pattern, "", desc, flags=re.IGNORECASE)

    # Phase 3: Remove "that can" / "to" prefixes that might remain
    desc = re.sub(r"^(that\s+)?(can\s+|will\s+|to\s+)?", "", desc, flags=re.IGNORECASE)

    # Phase 4: Remove articles at the start
    desc = re.sub(r"^(a|an|the)\s+", "", desc, flags=re.IGNORECASE)

    # Phase 4b: Handle tool-noun patterns (e.g., "documentation generator" → "documentation")
    # When user says "build a X generator", they want an agent that generates X
    tool_noun_pattern = r"^(\w+)\s+(generator|builder|creator|analyzer|scanner|validator|checker|runner|writer|reviewer)(\s+|$)"
    tool_noun_match = re.match(tool_noun_pattern, desc, flags=re.IGNORECASE)
    if tool_noun_match:
        # Extract the subject (e.g., "documentation" from "documentation generator")
        subject = tool_noun_match.group(1)
        tool_noun = tool_noun_match.group(2).lower()
        rest = desc[tool_noun_match.end() :].strip()

        # Map tool noun to verb and whether subject needs pluralization
        tool_noun_mapping = {
            "generator": ("Generates", False),
            "builder": ("Builds", False),
            "creator": ("Creates", False),
            "analyzer": ("Analyzes", False),
            "scanner": ("Scans", False),
            "validator": ("Validates", False),
            "checker": ("Checks", False),
            "runner": ("Runs", True),  # "test runner" → "Runs tests"
            "writer": ("Writes", False),
            "reviewer": ("Reviews", False),
        }

        verb, pluralize_subject = tool_noun_mapping.get(tool_noun, ("Generates", False))

        # Pluralize subject if needed (simple English pluralization)
        subject_lower = subject.lower()
        if pluralize_subject and not subject_lower.endswith("s"):
            if subject_lower.endswith(("s", "x", "z", "ch", "sh")):
                subject_lower += "es"
            elif subject_lower.endswith("y") and subject_lower[-2] not in "aeiou":
                subject_lower = subject_lower[:-1] + "ies"
            else:
                subject_lower += "s"

        desc = f"{verb} {subject_lower} {rest}".strip()

    # Phase 5: Handle verb-starting descriptions
    # Common base verbs that might start descriptions (infinitive form)
    base_verbs_to_third_person = {
        "review": "Reviews",
        "reviews": "Reviews",
        "reviewing": "Reviews",
        "analyze": "Analyzes",
        "analyzes": "Analyzes",
        "analyzing": "Analyzes",
        "validate": "Validates",
        "validates": "Validates",
        "validating": "Validates",
        "verify": "Verifies",
        "verifies": "Verifies",
        "verifying": "Verifies",
        "check": "Checks",
        "checks": "Checks",
        "checking": "Checks",
        "scan": "Scans",
        "scans": "Scans",
        "scanning": "Scans",
        "detect": "Detects",
        "detects": "Detects",
        "detecting": "Detects",
        "find": "Finds",
        "finds": "Finds",
        "finding": "Finds",
        "search": "Searches",
        "searches": "Searches",
        "searching": "Searches",
        "generate": "Generates",
        "generates": "Generates",
        "generating": "Generates",
        "create": "Creates",
        "creates": "Creates",
        "creating": "Creates",
        "build": "Builds",
        "builds": "Builds",
        "building": "Builds",
        "write": "Writes",
        "writes": "Writes",
        "writing": "Writes",
        "produce": "Produces",
        "produces": "Produces",
        "producing": "Produces",
        "automate": "Automates",
        "automates": "Automates",
        "automating": "Automates",
        "run": "Runs",
        "runs": "Runs",
        "running": "Runs",
        "execute": "Executes",
        "executes": "Executes",
        "executing": "Executes",
        "process": "Processes",
        "processes": "Processes",
        "processing": "Processes",
        "transform": "Transforms",
        "transforms": "Transforms",
        "transforming": "Transforms",
        "convert": "Converts",
        "converts": "Converts",
        "converting": "Converts",
        "orchestrate": "Orchestrates",
        "orchestrates": "Orchestrates",
        "orchestrating": "Orchestrates",
        "coordinate": "Coordinates",
        "coordinates": "Coordinates",
        "coordinating": "Coordinates",
        "manage": "Manages",
        "manages": "Manages",
        "managing": "Manages",
        "help": "Helps",
        "helps": "Helps",
        "helping": "Helps",
        "guide": "Guides",
        "guides": "Guides",
        "guiding": "Guides",
        "test": "Tests",
        "tests": "Tests",
        "testing": "Tests",
        "deploy": "Deploys",
        "deploys": "Deploys",
        "deploying": "Deploys",
        "monitor": "Monitors",
        "monitors": "Monitors",
        "monitoring": "Monitors",
        "audit": "Audits",
        "audits": "Audits",
        "auditing": "Audits",
        "inspect": "Inspects",
        "inspects": "Inspects",
        "inspecting": "Inspects",
        "examine": "Examines",
        "examines": "Examines",
        "examining": "Examines",
        "fix": "Fixes",
        "fixes": "Fixes",
        "fixing": "Fixes",
        "refactor": "Refactors",
        "refactors": "Refactors",
        "refactoring": "Refactors",
        "optimize": "Optimizes",
        "optimizes": "Optimizes",
        "optimizing": "Optimizes",
        "improve": "Improves",
        "improves": "Improves",
        "improving": "Improves",
    }

    # Check if description starts with a known verb
    words = desc.split()
    if words:
        first_word_lower = words[0].lower()
        if first_word_lower in base_verbs_to_third_person:
            # Replace verb with third-person form
            words[0] = base_verbs_to_third_person[first_word_lower]
            desc = " ".join(words)
        else:
            # Description starts with noun phrase - add type-appropriate verb
            type_verbs = {
                "analyzer": "Analyzes",
                "builder": "Generates",
                "automation": "Automates",
                "guide": "Guides through",
                "validator": "Validates",
                "orchestrator": "Orchestrates",
            }
            if agent_type in type_verbs:
                desc_lower = desc[0].lower() + desc[1:] if desc else ""
                desc = f"{type_verbs[agent_type]} {desc_lower}"

    # Final cleanup: ensure first letter is capitalized
    if desc:
        desc = desc[0].upper() + desc[1:]

    # Truncate to 1024 chars (Claude Code limit)
    if len(desc) > 1024:
        desc = desc[:1021] + "..."

    return desc


def parse(description: str) -> AgentRequirements:
    """Parse natural language description into agent requirements."""
    name = extract_name(description)
    agent_type, confidence = classify_type(description)
    domains = detect_domains(description)
    tools = detect_tools(description, domains=domains)
    patterns = detect_patterns(description)
    clean_desc = generate_description(description, agent_type)

    return AgentRequirements(
        name=name,
        agent_type=agent_type,
        description=clean_desc,
        tools=tools,
        patterns=patterns,
        confidence=confidence,
        domains=domains,
    )


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: nlp_parser.py [--json] <description>", file=sys.stderr)
        sys.exit(1)

    json_output = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--json"]

    if not args:
        print("Error: No description provided", file=sys.stderr)
        sys.exit(1)

    description = " ".join(args)
    result = parse(description)

    if json_output:
        print(json.dumps(asdict(result), indent=2))
    else:
        print(f"Name:        {result.name}")
        print(f"Type:        {result.agent_type}")
        print(f"Description: {result.description}")
        print(f"Domains:     {', '.join(result.domains) if result.domains else '(none)'}")
        print(f"Tools:       {', '.join(result.tools)}")
        print(f"Patterns:    {', '.join(result.patterns)}")
        print(f"Confidence:  {result.confidence:.0%}")


if __name__ == "__main__":
    main()
