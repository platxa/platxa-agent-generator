# Research-Based Feature Proposals for platxa-debug-agent

Based on the research synthesis conducted January 12, 2026, this document proposes new features derived from state-of-the-art AI debugging research.

## High Priority Features

### 1. Self-Debugging Loop Engine
**Research Basis:** Self-Debug (ICLR 2024), CodeAct, RECODE (2025)

**Description:** Implement iterative self-debugging with configurable retry limits and diminishing returns detection.

**Key Components:**
- Rubber duck debugging mode (explain code to identify mistakes)
- Execution feedback integration
- Maximum 5 iteration limit (research shows diminishing returns after)
- Progress tracking between iterations

**Implementation:**
```typescript
interface SelfDebugConfig {
  maxIterations: number;  // Default: 5
  enableExplanation: boolean;
  earlyTerminationThreshold: number;  // Stop if improvement < threshold
}

class SelfDebugLoop {
  iterate(code: string, error: NormalizedError): DebugIteration[];
  explainCode(code: string): string;  // Rubber duck mode
  detectDiminishingReturns(iterations: DebugIteration[]): boolean;
}
```

---

### 2. CFG-Based In-Execution Debugger
**Research Basis:** RECODE (2025)

**Description:** Track variable states during execution by decomposing code into basic blocks.

**Key Components:**
- Basic block extraction from source
- Variable state snapshots at block boundaries
- Execution trace correlation with source locations

**Implementation:**
```typescript
interface BasicBlock {
  id: string;
  statements: Statement[];
  entryVariables: Map<string, unknown>;
  exitVariables: Map<string, unknown>;
}

class CFGDebugger {
  extractBasicBlocks(code: string): BasicBlock[];
  traceExecution(blocks: BasicBlock[], inputs: unknown[]): ExecutionTrace;
  correlateErrorToBlock(error: Error, trace: ExecutionTrace): BasicBlock;
}
```

---

### 3. LLM Taint Specification Inference
**Research Basis:** IRIS (arXiv:2405.17238)

**Description:** Automatically infer data flow specifications (sources, sinks, propagators) for APIs using LLM analysis.

**Key Components:**
- API signature extraction
- CWE-aware prompting
- JSON-formatted specification output
- Batch processing (20-30 APIs per request)

**Implementation:**
```typescript
interface TaintSpecification {
  api: string;
  classification: 'source' | 'sink' | 'propagator' | 'safe';
  confidence: number;
  cweTypes?: string[];  // e.g., ['CWE-79', 'CWE-89']
}

class TaintInferencer {
  inferSpecs(apis: APISignature[]): Promise<TaintSpecification[]>;
  batchProcess(apis: APISignature[], batchSize?: number): Promise<TaintSpecification[]>;
  generateQLPredicate(specs: TaintSpecification[]): string;
}
```

---

### 4. Bug Reproduction Test Generator
**Research Basis:** Google BRT Agent (arXiv:2502.01821)

**Description:** Generate failing tests from bug reports that fail on buggy code and pass on fixed code.

**Key Components:**
- Bug report parsing
- Dual-mode generation (reasoning + code editing)
- Test validation pipeline
- Plausibility checking

**Implementation:**
```typescript
interface BugReproductionTest {
  testCode: string;
  bugReportId: string;
  failsOnBuggy: boolean;
  passesOnFixed: boolean;
  plausibility: 'candidate' | 'plausible' | 'invalid';
}

class BRTGenerator {
  generateFromReport(report: BugReport): Promise<BugReproductionTest[]>;
  validateTest(test: BugReproductionTest, buggyCode: string, fixedCode: string): boolean;
  rankByPlausibility(tests: BugReproductionTest[]): BugReproductionTest[];
}
```

---

### 5. Mutation-Guided Fault Targeting
**Research Basis:** Meta ACH System

**Description:** Generate targeted mutations based on natural language fault descriptions, then create tests to catch those faults.

**Key Components:**
- Natural language fault description parser
- Realistic mutation generation
- Guaranteed-catch test generation
- Compliance domain support (privacy, security)

**Implementation:**
```typescript
interface FaultDescription {
  description: string;  // Natural language
  domain: 'privacy' | 'security' | 'logic' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface Mutant {
  originalCode: string;
  mutatedCode: string;
  faultType: string;
  location: SourceLocation;
}

class MutationTargeter {
  parseDescription(description: string): FaultDescription;
  generateMutants(code: string, fault: FaultDescription): Mutant[];
  generateCatchingTest(mutant: Mutant): string;
}
```

---

## Medium Priority Features

### 6. Multi-Modal Root Cause Analyzer
**Research Basis:** PyRCA, Comprehensive RCA Survey (2024)

**Description:** Integrate multiple data sources (metrics, traces, logs) for holistic root cause analysis.

**Key Components:**
- Time series metric analysis
- Causal graph construction
- Hypothesis testing engine
- Domain knowledge integration (YAML constraints)

**Implementation:**
```typescript
interface RCAInput {
  metrics: TimeSeries[];
  traces: ExecutionTrace[];
  logs: LogEntry[];
  constraints?: DomainConstraints;
}

interface RootCause {
  component: string;
  probability: number;
  evidence: Evidence[];
  propagationPath: string[];
}

class MultiModalRCA {
  constructCausalGraph(input: RCAInput): CausalGraph;
  runHypothesisTests(graph: CausalGraph): RootCause[];
  incorporateDomainKnowledge(graph: CausalGraph, constraints: DomainConstraints): CausalGraph;
}
```

---

### 7. Contextual False Positive Filter
**Research Basis:** IRIS Alert Triaging

**Description:** Filter static analysis alerts using LLM-based contextual analysis.

**Key Components:**
- Context window extraction (±5 lines around findings)
- Path encoding for LLM prompts
- Confidence-weighted filtering
- Model-appropriate strategies (larger models benefit more)

**Implementation:**
```typescript
interface AlertContext {
  alert: StaticAnalysisAlert;
  surroundingCode: string;  // ±5 lines
  dataFlowPath: string[];
  projectContext?: string;  // README, docs
}

class FalsePositiveFilter {
  extractContext(alert: StaticAnalysisAlert, codebase: Codebase): AlertContext;
  classifyAlert(context: AlertContext): { isTruePositive: boolean; confidence: number };
  batchFilter(alerts: StaticAnalysisAlert[]): StaticAnalysisAlert[];
}
```

---

### 8. Dual-LLM Debugging Architecture
**Research Basis:** Google BRT Agent

**Description:** Separate reasoning (general LLM) from code editing (specialized/fine-tuned LLM).

**Key Components:**
- Reasoning agent for planning and action selection
- Code editing agent for actual modifications
- Natural language change description bridge
- Action history management

**Implementation:**
```typescript
interface DualLLMConfig {
  reasoningModel: string;  // e.g., 'gpt-4'
  codeEditingModel: string;  // e.g., 'codellama-fine-tuned'
  maxSteps: number;
}

interface ChangeDescription {
  intent: string;  // Natural language
  targetFile: string;
  modificationScope: 'function' | 'class' | 'file';
}

class DualLLMDebugger {
  reason(state: DebugState): Action;
  describeChange(action: Action): ChangeDescription;
  generateEdit(description: ChangeDescription): CodeEdit;
  orchestrate(error: NormalizedError): DebugResult;
}
```

---

### 9. Ensemble Pass Rate (EPR) Fix Selector
**Research Basis:** Google BRT Agent Fix Selection

**Description:** Rank and select fixes using ensemble of generated tests.

**Key Components:**
- Multiple BRT generation
- Cross-validation through test ensemble
- Threshold-based selection (0.1 EPR = 0.9 precision)
- Precision/recall tradeoff configuration

**Implementation:**
```typescript
interface FixCandidate {
  code: string;
  passedTests: string[];
  failedTests: string[];
  epr: number;  // Ensemble Pass Rate
}

class EPRSelector {
  generateTestEnsemble(bug: Bug, count: number): Test[];
  calculateEPR(fix: FixCandidate, tests: Test[]): number;
  selectFix(candidates: FixCandidate[], threshold?: number): FixCandidate | null;
  rankByEPR(candidates: FixCandidate[]): FixCandidate[];
}
```

---

## Lower Priority Features

### 10. Multi-Language Generalization
**Research Basis:** Google BRT Agent (6 languages), Survey findings

**Key Languages:**
- Python, JavaScript/TypeScript (current)
- Java, Go, Kotlin, C++ (to add)

**Implementation:**
```typescript
interface LanguageAdapter {
  language: SupportedLanguage;
  parseAST(code: string): AST;
  extractSymbols(ast: AST): Symbol[];
  runTests(testFile: string): TestResult;
}
```

---

### 11. Explanation-Aware Debug Training
**Research Basis:** Amazon NeurIPS 2024

**Description:** Generate debugging explanations alongside fixes, not just code changes.

**Key Components:**
- Explanation quality scoring
- SFT + RL training pipeline design
- Explanation-fix consistency checking

---

### 12. Knowledge Graph-Enhanced Debugging
**Research Basis:** KGCompass (46% pass@1)

**Description:** Use knowledge graphs to guide retrieval and context selection during debugging.

---

## Implementation Roadmap

### Phase 1: Core Debugging Loops (Q1)
1. Self-Debugging Loop Engine
2. CFG-Based In-Execution Debugger
3. Dual-LLM Debugging Architecture

### Phase 2: Test Generation (Q2)
4. Bug Reproduction Test Generator
5. Mutation-Guided Fault Targeting
6. EPR Fix Selector

### Phase 3: Analysis Integration (Q3)
7. LLM Taint Specification Inference
8. Contextual False Positive Filter
9. Multi-Modal Root Cause Analyzer

### Phase 4: Extension (Q4)
10. Multi-Language Generalization
11. Knowledge Graph Integration
12. Explanation-Aware Training

## Metrics for Success

Based on research benchmarks, target metrics:

| Feature | Metric | Target |
|---------|--------|--------|
| Self-Debug Loop | Pass@1 improvement | +15% |
| BRT Generator | Plausible rate | 25%+ |
| Taint Inference | Recall vs manual specs | 85%+ |
| FP Filter | Precision improvement | 5%+ |
| EPR Selector | Top-1 precision | 70%+ |
| Multi-Modal RCA | Recall@1 | 95%+ |

## Research References

- [LLM-based APR Survey](https://arxiv.org/html/2506.23749v1)
- [Google BRT Agent](https://arxiv.org/html/2502.01821v2)
- [IRIS Static Analysis](https://arxiv.org/html/2405.17238v2)
- [Self-Debug Paper](https://arxiv.org/abs/2304.05128)
- [Meta ACH Blog](https://engineering.fb.com/2025/02/05/security/revolutionizing-software-testing-llm-powered-bug-catchers-meta-ach/)
- [PyRCA Library](https://github.com/salesforce/PyRCA)
