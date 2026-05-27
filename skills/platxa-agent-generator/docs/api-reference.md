# API Reference

Complete API documentation for the Platxa Agent Generator Python modules.

## Module Overview

```python
from scripts import (
    agent_generator,      # Core agent generation
    nlp_parser,           # Natural language parsing
    type_classifier,      # Agent type classification
    prompt_generator,     # System prompt generation
    quality_scorer,       # Quality scoring
    syntax_validator,     # Syntax validation
    security_scanner,     # Security scanning
    agent_catalog,        # Pre-built templates
    agent_composer,       # Agent composition
    agent_versioning,     # Version management
    agent_export,         # Export/import
    dry_run,              # Preview mode
    install_agent,        # Installation
    workflow_state,       # State management
)
```

---

## agent_generator

Core module for generating agent definition files.

### generate_agent()

```python
def generate_agent(
    name: str,
    description: str,
    tools: list[str] | None = None,
    pattern: str = "prompt-chaining",
    output_dir: Path | None = None,
    **kwargs
) -> GenerationResult
```

Generate a complete agent definition.

**Parameters:**
- `name`: Agent name (kebab-case)
- `description`: Agent description
- `tools`: List of tool names
- `pattern`: Agent pattern to use
- `output_dir`: Output directory

**Returns:** `GenerationResult` with generated files

**Example:**
```python
from scripts.agent_generator import generate_agent

result = generate_agent(
    name="code-reviewer",
    description="Reviews Python code for issues",
    tools=["Read", "Grep", "Glob"],
    pattern="prompt-chaining"
)

print(f"Created: {result.agent_path}")
print(f"Quality: {result.quality_score}")
```

### GenerationResult

```python
@dataclass
class GenerationResult:
    success: bool
    agent_path: str
    agent_content: str
    command_path: str | None
    command_content: str | None
    quality_score: float
    warnings: list[str]
    errors: list[str]
```

---

## nlp_parser

Parse natural language descriptions into structured requirements.

### parse_description()

```python
def parse_description(description: str) -> ParsedDescription
```

Extract agent requirements from natural language.

**Parameters:**
- `description`: Natural language agent description

**Returns:** `ParsedDescription` with extracted components

**Example:**
```python
from scripts.nlp_parser import parse_description

result = parse_description(
    "Create an agent that reviews Python code for security vulnerabilities "
    "and generates a detailed report with severity levels"
)

print(f"Name: {result.suggested_name}")
print(f"Type: {result.agent_type}")
print(f"Tools: {result.suggested_tools}")
print(f"Keywords: {result.keywords}")
```

### ParsedDescription

```python
@dataclass
class ParsedDescription:
    suggested_name: str
    suggested_description: str
    agent_type: str
    suggested_tools: list[str]
    keywords: list[str]
    input_types: list[str]
    output_types: list[str]
    complexity: str  # "simple", "medium", "complex"
    confidence: float
```

---

## type_classifier

Classify agents into types based on requirements.

### classify_agent()

```python
def classify_agent(
    description: str,
    parsed: ParsedDescription | None = None
) -> ClassificationResult
```

Determine the appropriate agent type.

**Parameters:**
- `description`: Agent description
- `parsed`: Optional pre-parsed description

**Returns:** `ClassificationResult` with type and confidence

**Example:**
```python
from scripts.type_classifier import classify_agent

result = classify_agent(
    "An orchestrator that coordinates multiple specialist agents"
)

print(f"Type: {result.agent_type}")
print(f"Pattern: {result.recommended_pattern}")
print(f"Confidence: {result.confidence}")
```

### ClassificationResult

```python
@dataclass
class ClassificationResult:
    agent_type: str  # "simple", "orchestrator", "multi-agent", "pipeline"
    recommended_pattern: str
    confidence: float
    reasoning: str
    alternative_patterns: list[str]
```

---

## quality_scorer

Score agent quality against criteria.

### score_quality()

```python
def score_quality(content: str) -> QualityResult
```

Calculate quality score for an agent definition.

**Parameters:**
- `content`: Agent definition content

**Returns:** `QualityResult` with scores and feedback

**Example:**
```python
from scripts.quality_scorer import score_quality

content = Path(".claude/agents/my-agent.md").read_text()
result = score_quality(content)

print(f"Score: {result.total_score}/10")
print(f"Grade: {result.grade}")
print(f"Passed: {result.passed}")
```

### QualityResult

```python
@dataclass
class QualityResult:
    total_score: float
    grade: str  # A+, A, B+, B, C, D, F
    passed: bool  # score >= 7.0
    breakdown: dict[str, float]
    suggestions: list[str]
    issues: list[str]
```

### Scoring Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Clarity | 20% | Purpose is clear |
| Completeness | 20% | All sections present |
| Tool Design | 20% | Appropriate tools |
| Examples | 15% | Realistic examples |
| Security | 15% | No vulnerabilities |
| Documentation | 10% | Well documented |

---

## security_scanner

Scan agents for security issues.

### scan_security()

```python
def scan_security(content: str) -> SecurityResult
```

Scan agent definition for security issues.

**Parameters:**
- `content`: Agent definition content

**Returns:** `SecurityResult` with findings

**Example:**
```python
from scripts.security_scanner import scan_security

result = scan_security(content)

for issue in result.issues:
    print(f"[{issue.severity}] {issue.description}")
```

### SecurityResult

```python
@dataclass
class SecurityResult:
    passed: bool
    issues: list[SecurityIssue]
    warnings: list[str]
    risk_score: float  # 0-10, lower is better

@dataclass
class SecurityIssue:
    severity: str  # "critical", "high", "medium", "low"
    category: str
    description: str
    line_number: int | None
    recommendation: str
```

---

## agent_catalog

Access pre-built agent templates.

### list_agents()

```python
def list_agents(category: str | None = None) -> list[AgentTemplate]
```

List available agent templates.

**Example:**
```python
from scripts.agent_catalog import list_agents

# All templates
templates = list_agents()

# By category
dev_templates = list_agents(category="development")

for t in dev_templates:
    print(f"{t.name}: {t.description}")
```

### get_agent()

```python
def get_agent(name: str) -> AgentTemplate | None
```

Get a specific template by name.

### generate_agent_content()

```python
def generate_agent_content(template: AgentTemplate) -> str
```

Generate full agent content from template.

---

## agent_composer

Compose multiple agents together.

### compose_sequential()

```python
def compose_sequential(
    agents: list[AgentSpec],
    name: str,
    description: str
) -> CompositionResult
```

Compose agents in sequence.

**Example:**
```python
from scripts.agent_composer import compose_sequential, AgentSpec

agents = [
    AgentSpec(name="parser", tools=["Read"]),
    AgentSpec(name="analyzer", tools=["Grep"]),
    AgentSpec(name="reporter", tools=["Write"]),
]

result = compose_sequential(
    agents=agents,
    name="full-pipeline",
    description="Parse, analyze, and report"
)
```

### compose_parallel()

```python
def compose_parallel(
    agents: list[AgentSpec],
    name: str,
    description: str,
    aggregation_strategy: str = "merge"
) -> CompositionResult
```

Compose agents for parallel execution.

### create_orchestrator()

```python
def create_orchestrator(
    name: str,
    workers: list[AgentSpec],
    description: str
) -> CompositionResult
```

Create an orchestrator with worker agents.

---

## agent_versioning

Manage agent versions.

### bump_version()

```python
def bump_version(
    agent_path: Path,
    bump_type: VersionBump,
    changes: list[str],
    author: str = ""
) -> tuple[bool, str]
```

Bump agent version.

**Example:**
```python
from scripts.agent_versioning import bump_version, VersionBump

success, new_version = bump_version(
    agent_path=Path(".claude/agents/my-agent.md"),
    bump_type=VersionBump.MINOR,
    changes=["Added new feature"],
    author="Your Name"
)

print(f"New version: {new_version}")
```

### generate_changelog()

```python
def generate_changelog(
    history: VersionHistory,
    from_version: str | None = None,
    to_version: str | None = None
) -> str
```

Generate changelog from version history.

---

## agent_export

Export and import agent packages.

### export_agent()

```python
def export_agent(
    agent_path: Path,
    output_path: Path | None = None,
    format: ExportFormat = ExportFormat.ZIP,
    include_related: bool = True,
    sanitize: bool = True
) -> ExportResult
```

Export agent as shareable package.

**Example:**
```python
from scripts.agent_export import export_agent, ExportFormat

result = export_agent(
    agent_path=Path(".claude/agents/my-agent.md"),
    format=ExportFormat.ZIP,
    sanitize=True
)

print(f"Exported to: {result.export_path}")
print(f"Size: {result.size_bytes} bytes")
```

### import_agent()

```python
def import_agent(
    package_path: Path,
    target_dir: Path | None = None,
    scope: str = "project",
    overwrite: bool = False
) -> ImportResult
```

Import agent from package.

---

## dry_run

Preview agent generation.

### dry_run()

```python
def dry_run(
    name: str,
    description: str,
    tools: list[str] | None = None,
    pattern: str = "prompt-chaining"
) -> DryRunResult
```

Preview without creating files.

**Example:**
```python
from scripts.dry_run import dry_run

result = dry_run(
    name="my-agent",
    description="Does something useful",
    pattern="prompt-chaining"
)

print(f"Would create {len(result.files)} files")
print(f"Total size: {result.total_size} bytes")
print(f"Quality score: {result.quality_score}")
```

### DryRunResult

```python
@dataclass
class DryRunResult:
    agent_name: str
    files: list[FilePreview]
    total_size: int
    quality_score: float
    validation_passed: bool
    warnings: list[str]
```

---

## workflow_state

Manage generation workflow state.

### WorkflowState

```python
class WorkflowState:
    def __init__(self, agent_name: str)

    def advance_phase(self) -> bool
    def record_output(self, phase: str, data: Any) -> None
    def get_output(self, phase: str) -> Any
    def save(self) -> bool
    def load(self) -> bool
```

**Example:**
```python
from scripts.workflow_state import WorkflowState, WorkflowPhase

state = WorkflowState("my-agent")
state.start()

# Discovery phase
state.advance_phase()
state.record_output("discovery", {"keywords": ["code", "review"]})

# Architecture phase
state.advance_phase()
state.record_output("architecture", {"pattern": "prompt-chaining"})

# Save state
state.save()
```

---

## Error Handling

All modules use consistent error handling:

```python
from scripts.exceptions import (
    AgentGeneratorError,    # Base exception
    ValidationError,        # Validation failures
    GenerationError,        # Generation failures
    SecurityError,          # Security issues
    ConfigurationError,     # Configuration issues
)

try:
    result = generate_agent(...)
except ValidationError as e:
    print(f"Validation failed: {e.issues}")
except GenerationError as e:
    print(f"Generation failed: {e}")
```

---

## Type Definitions

Common types used across modules:

```python
from scripts.types import (
    AgentType,          # Literal["simple", "orchestrator", "multi-agent", "pipeline"]
    PatternType,        # Literal["prompt-chaining", "routing", ...]
    ToolName,           # Literal["Read", "Write", "Grep", ...]
    Severity,           # Literal["critical", "high", "medium", "low"]
    Scope,              # Literal["user", "project"]
)
```
