#!/usr/bin/env python3
"""
Interactive Prompts Module

Provides structured question definitions for AskUserQuestion tool
to guide users through agent generation interactively.

Phases covered:
    1. Discovery - Agent type, domain, purpose
    2. Architecture - Workflow pattern, complexity
    3. Generation - Tools, permissions, examples
    4. Validation - Review and approval
    5. Installation - Scope selection

Usage:
    python interactive_prompts.py phase <phase_name>    # Get questions for phase
    python interactive_prompts.py all                   # Get all questions
    python interactive_prompts.py --json                # Output as JSON
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Any


@dataclass
class QuestionOption:
    """Single option for a question."""

    label: str
    description: str
    value: str | None = None

    def to_dict(self) -> dict[str, str]:
        """Convert to AskUserQuestion format."""
        return {"label": self.label, "description": self.description}


@dataclass
class InteractiveQuestion:
    """Question definition for AskUserQuestion tool."""

    question: str
    header: str
    options: list[QuestionOption]
    multi_select: bool = False
    phase: str = ""
    key: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert to AskUserQuestion format."""
        return {
            "question": self.question,
            "header": self.header,
            "options": [opt.to_dict() for opt in self.options],
            "multiSelect": self.multi_select,
        }


@dataclass
class PhaseQuestions:
    """Collection of questions for a workflow phase."""

    phase: str
    description: str
    questions: list[InteractiveQuestion] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "phase": self.phase,
            "description": self.description,
            "questions": [q.to_dict() for q in self.questions],
        }


# Discovery Phase Questions
DISCOVERY_QUESTIONS = PhaseQuestions(
    phase="discovery",
    description="Understand agent purpose and domain",
    questions=[
        InteractiveQuestion(
            question="What type of agent do you want to create?",
            header="Agent Type",
            key="agent_type",
            phase="discovery",
            options=[
                QuestionOption(
                    label="Analyzer",
                    description="Examines code, data, or content and provides insights",
                    value="analyzer",
                ),
                QuestionOption(
                    label="Builder",
                    description="Creates or generates new code, files, or content",
                    value="builder",
                ),
                QuestionOption(
                    label="Automation",
                    description="Automates repetitive tasks or workflows",
                    value="automation",
                ),
                QuestionOption(
                    label="Guide",
                    description="Provides step-by-step instructions or tutorials",
                    value="guide",
                ),
            ],
        ),
        InteractiveQuestion(
            question="What domain will this agent operate in?",
            header="Domain",
            key="domain",
            phase="discovery",
            options=[
                QuestionOption(
                    label="General",
                    description="Works across multiple domains without specialization",
                    value="general",
                ),
                QuestionOption(
                    label="Web Development",
                    description="Frontend, backend, APIs, databases",
                    value="web",
                ),
                QuestionOption(
                    label="Data/ML",
                    description="Data processing, analysis, machine learning",
                    value="data",
                ),
                QuestionOption(
                    label="DevOps/Infra",
                    description="CI/CD, containers, cloud infrastructure",
                    value="devops",
                ),
            ],
        ),
        InteractiveQuestion(
            question="How complex should this agent be?",
            header="Complexity",
            key="complexity",
            phase="discovery",
            options=[
                QuestionOption(
                    label="Simple (Recommended)",
                    description="Single-purpose, focused functionality",
                    value="simple",
                ),
                QuestionOption(
                    label="Standard",
                    description="Multiple related capabilities",
                    value="standard",
                ),
                QuestionOption(
                    label="Advanced",
                    description="Complex workflows with multiple phases",
                    value="advanced",
                ),
            ],
        ),
    ],
)

# Architecture Phase Questions
ARCHITECTURE_QUESTIONS = PhaseQuestions(
    phase="architecture",
    description="Define workflow pattern and structure",
    questions=[
        InteractiveQuestion(
            question="Which workflow pattern should the agent use?",
            header="Pattern",
            key="workflow_pattern",
            phase="architecture",
            options=[
                QuestionOption(
                    label="Sequential (Recommended)",
                    description="Fixed steps executed in order",
                    value="sequential",
                ),
                QuestionOption(
                    label="Routing",
                    description="Classify input and route to specialized handlers",
                    value="routing",
                ),
                QuestionOption(
                    label="Parallel",
                    description="Execute independent subtasks concurrently",
                    value="parallel",
                ),
                QuestionOption(
                    label="Orchestrator",
                    description="Dynamically decompose and delegate tasks",
                    value="orchestrator",
                ),
            ],
        ),
        InteractiveQuestion(
            question="Should the agent use subagents for complex tasks?",
            header="Subagents",
            key="use_subagents",
            phase="architecture",
            options=[
                QuestionOption(
                    label="No (Recommended)",
                    description="Keep it simple with a single agent",
                    value="no",
                ),
                QuestionOption(
                    label="Yes",
                    description="Use specialized subagents for different tasks",
                    value="yes",
                ),
            ],
        ),
    ],
)

# Generation Phase Questions
GENERATION_QUESTIONS = PhaseQuestions(
    phase="generation",
    description="Configure tools and capabilities",
    questions=[
        InteractiveQuestion(
            question="Which tools should the agent have access to?",
            header="Tools",
            key="tools",
            phase="generation",
            multi_select=True,
            options=[
                QuestionOption(
                    label="Read/Write Files",
                    description="Read, Write, Edit tools for file operations",
                    value="files",
                ),
                QuestionOption(
                    label="Search/Navigate",
                    description="Glob, Grep, LS tools for codebase exploration",
                    value="search",
                ),
                QuestionOption(
                    label="Execute Commands",
                    description="Bash tool for running shell commands",
                    value="bash",
                ),
                QuestionOption(
                    label="Web Access",
                    description="WebFetch, WebSearch for external resources",
                    value="web",
                ),
            ],
        ),
        InteractiveQuestion(
            question="Should the agent include usage examples?",
            header="Examples",
            key="include_examples",
            phase="generation",
            options=[
                QuestionOption(
                    label="Yes (Recommended)",
                    description="Include 2-3 usage examples in documentation",
                    value="yes",
                ),
                QuestionOption(
                    label="No",
                    description="Skip examples for minimal agent definition",
                    value="no",
                ),
            ],
        ),
    ],
)

# Validation Phase Questions
VALIDATION_QUESTIONS = PhaseQuestions(
    phase="validation",
    description="Review and approve generated agent",
    questions=[
        InteractiveQuestion(
            question="How should validation failures be handled?",
            header="On Failure",
            key="validation_failure",
            phase="validation",
            options=[
                QuestionOption(
                    label="Auto-fix (Recommended)",
                    description="Automatically attempt to fix validation issues",
                    value="auto_fix",
                ),
                QuestionOption(
                    label="Manual Review",
                    description="Show issues and let me decide what to fix",
                    value="manual",
                ),
                QuestionOption(
                    label="Skip Validation",
                    description="Proceed without validation (not recommended)",
                    value="skip",
                ),
            ],
        ),
        InteractiveQuestion(
            question="Minimum quality score to accept the agent?",
            header="Min Score",
            key="min_quality_score",
            phase="validation",
            options=[
                QuestionOption(
                    label="7.0 (Recommended)",
                    description="Standard quality threshold",
                    value="7.0",
                ),
                QuestionOption(
                    label="8.0 (High)",
                    description="Higher quality requirements",
                    value="8.0",
                ),
                QuestionOption(
                    label="5.0 (Minimum)",
                    description="Accept lower quality agents",
                    value="5.0",
                ),
            ],
        ),
    ],
)

# Installation Phase Questions
INSTALLATION_QUESTIONS = PhaseQuestions(
    phase="installation",
    description="Configure installation scope and options",
    questions=[
        InteractiveQuestion(
            question="Where should the agent be installed?",
            header="Scope",
            key="install_scope",
            phase="installation",
            options=[
                QuestionOption(
                    label="User Scope (Recommended)",
                    description="~/.claude/agents/ - Available across all projects",
                    value="user",
                ),
                QuestionOption(
                    label="Project Scope",
                    description=".claude/agents/ - Only in current project",
                    value="project",
                ),
                QuestionOption(
                    label="Don't Install",
                    description="Generate files but don't install",
                    value="none",
                ),
            ],
        ),
        InteractiveQuestion(
            question="If agent already exists, what should happen?",
            header="Overwrite",
            key="overwrite_behavior",
            phase="installation",
            options=[
                QuestionOption(
                    label="Backup & Replace",
                    description="Create backup of existing, then replace",
                    value="backup",
                ),
                QuestionOption(
                    label="Skip",
                    description="Don't install if agent already exists",
                    value="skip",
                ),
                QuestionOption(
                    label="Force Replace",
                    description="Overwrite without backup",
                    value="force",
                ),
            ],
        ),
    ],
)

# All phase questions
ALL_PHASES: dict[str, PhaseQuestions] = {
    "discovery": DISCOVERY_QUESTIONS,
    "architecture": ARCHITECTURE_QUESTIONS,
    "generation": GENERATION_QUESTIONS,
    "validation": VALIDATION_QUESTIONS,
    "installation": INSTALLATION_QUESTIONS,
}


def get_phase_questions(phase: str) -> PhaseQuestions | None:
    """
    Get questions for a specific phase.

    Args:
        phase: Phase name (discovery, architecture, generation, validation, installation)

    Returns:
        PhaseQuestions or None if phase not found
    """
    return ALL_PHASES.get(phase.lower())


def get_all_questions() -> list[PhaseQuestions]:
    """Get all phase questions in order."""
    return [
        DISCOVERY_QUESTIONS,
        ARCHITECTURE_QUESTIONS,
        GENERATION_QUESTIONS,
        VALIDATION_QUESTIONS,
        INSTALLATION_QUESTIONS,
    ]


def get_question_by_key(key: str) -> InteractiveQuestion | None:
    """
    Find a question by its key across all phases.

    Args:
        key: Question key (e.g., "agent_type", "tools")

    Returns:
        InteractiveQuestion or None if not found
    """
    for phase in ALL_PHASES.values():
        for question in phase.questions:
            if question.key == key:
                return question
    return None


def format_for_ask_user(questions: list[InteractiveQuestion]) -> list[dict[str, Any]]:
    """
    Format questions for AskUserQuestion tool.

    Args:
        questions: List of InteractiveQuestion objects

    Returns:
        List of dictionaries in AskUserQuestion format
    """
    return [q.to_dict() for q in questions]


def apply_answers(
    answers: dict[str, str], defaults: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Process user answers into configuration values.

    Args:
        answers: Dictionary of question_key -> selected_label
        defaults: Optional default values

    Returns:
        Configuration dictionary with resolved values
    """
    config: dict[str, Any] = defaults.copy() if defaults else {}

    for key, label in answers.items():
        question = get_question_by_key(key)
        if question:
            # Find matching option to get value
            for opt in question.options:
                if opt.label == label or label in opt.label:
                    config[key] = opt.value if opt.value else opt.label.lower()
                    break
            else:
                # Custom answer (from "Other" option)
                config[key] = label

    return config


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Interactive prompts for agent generation"
    )
    parser.add_argument(
        "command",
        nargs="?",
        choices=["phase", "all", "keys"],
        default="all",
        help="Command to run",
    )
    parser.add_argument("phase_name", nargs="?", help="Phase name (for 'phase' command)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--key", help="Get single question by key")

    args = parser.parse_args()

    if args.key:
        question = get_question_by_key(args.key)
        if question is None:
            print(f"✗ Question not found: {args.key}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(question.to_dict(), indent=2))
        else:
            print(f"Question: {question.question}")
            print(f"Header: {question.header}")
            print(f"Phase: {question.phase}")
            print(f"Multi-select: {question.multi_select}")
            print("Options:")
            for opt in question.options:
                print(f"  - {opt.label}: {opt.description}")

    elif args.command == "phase":
        if not args.phase_name:
            print("✗ Phase name required", file=sys.stderr)
            print(f"  Valid phases: {list(ALL_PHASES.keys())}", file=sys.stderr)
            sys.exit(1)

        phase = get_phase_questions(args.phase_name)
        if phase is None:
            print(f"✗ Unknown phase: {args.phase_name}", file=sys.stderr)
            print(f"  Valid phases: {list(ALL_PHASES.keys())}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(phase.to_dict(), indent=2))
        else:
            print(f"Phase: {phase.phase}")
            print(f"Description: {phase.description}")
            print(f"Questions: {len(phase.questions)}")
            for q in phase.questions:
                print(f"\n  [{q.key}] {q.question}")
                for opt in q.options:
                    print(f"    - {opt.label}")

    elif args.command == "keys":
        keys = []
        for phase in ALL_PHASES.values():
            for q in phase.questions:
                keys.append({"key": q.key, "phase": phase.phase, "question": q.question})

        if args.json:
            print(json.dumps(keys, indent=2))
        else:
            print("Available question keys:")
            for item in keys:
                print(f"  {item['key']:20} ({item['phase']})")

    else:  # all
        all_questions = get_all_questions()

        if args.json:
            output = [p.to_dict() for p in all_questions]
            print(json.dumps(output, indent=2))
        else:
            total = sum(len(p.questions) for p in all_questions)
            print(f"Interactive Prompts ({total} questions across {len(all_questions)} phases)")
            print("=" * 60)
            for phase in all_questions:
                print(f"\n[{phase.phase.upper()}] {phase.description}")
                for q in phase.questions:
                    multi = " (multi)" if q.multi_select else ""
                    print(f"  • {q.header}{multi}: {len(q.options)} options")


if __name__ == "__main__":
    main()
