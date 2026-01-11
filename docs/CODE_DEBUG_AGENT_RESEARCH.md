# Production-Grade Multi-Language AI Debugging Agent

## Research Synthesis & Technical Specification

**Version:** 1.0.0
**Date:** January 11, 2026
**Quality Score:** 8.9/10
**Sources Analyzed:** 16 authoritative sources
**Features Generated:** 60 implementation tasks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Agent Architecture Patterns](#agent-architecture-patterns)
4. [Language-Specific Debugging](#language-specific-debugging)
5. [Root Cause Analysis Techniques](#root-cause-analysis-techniques)
6. [Automated Fix Generation](#automated-fix-generation)
7. [Claude Code Integration](#claude-code-integration)
8. [Multi-Language Orchestration](#multi-language-orchestration)
9. [Technical Architecture](#technical-architecture)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Tool Reference Matrix](#tool-reference-matrix)
12. [Source Analysis](#source-analysis)
13. [Appendices](#appendices)

---

## Executive Summary

This research synthesizes findings from 16 authoritative sources to design a **production-grade AI debugging agent** capable of handling:

- **Python** (exceptions, type errors, runtime debugging)
- **JavaScript/TypeScript** (runtime errors, type mismatches, async issues)
- **CSS/SCSS** (specificity conflicts, layout bugs, cascade issues)
- **Tailwind CSS** (purge issues, JIT conflicts, configuration errors)
- **HTML** (validation, accessibility, semantic errors)
- **Bootstrap** (framework conflicts, version issues)

### Key Insights

| # | Insight | Source | Impact |
|---|---------|--------|--------|
| 1 | **LDB Pattern**: Segment code into basic blocks, track intermediate variables for step-by-step verification | ACL'24 | Highest debugging accuracy |
| 2 | **Hybrid Approach**: Static analysis (precision) + LLM (comprehensiveness) outperforms either alone | arXiv 2502.06633 | RAG shows superior accuracy |
| 3 | **Multi-Agent Architecture**: Specialized agents prevent context pollution | Anthropic | 84% token reduction |
| 4 | **67% of developers** spend more time debugging AI code than writing manually | Harness 2025 | Validation is critical |
| 5 | **Current APR performance**: 15-45% correct patch rates on benchmarks | EmergentMind | Human review essential |

### Critical Success Factors

1. **Iterative debugging loops** with visual targets, test cases, or screenshots
2. **Subagent isolation** for verification without polluting main context
3. **RAG integration** with historical bug-fix database
4. **Multi-stage validation**: type checking → linting → test execution → semantic validation

---

## Research Methodology

### Research Parameters

| Parameter | Value |
|-----------|-------|
| **Total Sources** | 16 authoritative sources |
| **Quality Score** | 8.9/10 (weighted average) |
| **Search Queries** | 12 targeted queries |
| **Depth Level** | 3 (thorough) |
| **Max Sources** | 15 (exceeded: 16) |

### Subtopics Investigated

1. LLM Debugging Agent Architectures & Prompting Strategies
2. Python Debugging: Exception Handling & Type Error Analysis
3. JavaScript/TypeScript Debugging: Runtime & Type Errors
4. Web Technologies Debugging: CSS, SCSS, HTML Validation
5. Tailwind CSS & Bootstrap Debugging Patterns
6. Static Analysis Tool Integration (Linters, Type Checkers, AST)
7. Error Pattern Recognition & Root Cause Analysis
8. Automated Fix Generation & Validation

### Source Categories

| Category | Count | Examples |
|----------|-------|----------|
| Academic Papers | 3 | LDB (ACL'24), Hybrid LLM+SA (arXiv), APR Survey |
| Industry Research | 4 | Microsoft Debug-gym, Datadog RCA, Render Benchmark |
| Official Documentation | 3 | Anthropic Best Practices, Tailwind Docs, ESLint |
| Technical Guides | 6 | Addy Osmani, Smashing Magazine, LogRocket |

---

## Agent Architecture Patterns

### Pattern 1: LDB Framework (ACL'24)

The **Large Language Model Debugger (LDB)** implements a human-like debugging approach:

```
┌─────────────────────────────────────────────────────────────┐
│                    LDB Debugging Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Initial Execution ──► Run generated code                │
│           │                                                 │
│           ▼                                                 │
│  2. Block Analysis ──► Extract intermediate values          │
│           │              after each basic block             │
│           ▼                                                 │
│  3. Verification ──► Present block-by-block state to LLM    │
│           │                                                 │
│           ▼                                                 │
│  4. Error Localization ──► Identify buggy block             │
│           │                                                 │
│           ▼                                                 │
│  5. Code Refinement ──► Generate fix using context          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key APIs:**
- `ldb_debug(prompt, implementation, failed_tests, entry_point)` → structured debugging messages
- `ldb_generate(messages)` → improved code

**Debugging Granularity:**
- Line-level (most precise, highest overhead)
- Block-level (balanced, recommended)
- Function-level (fastest, least context)

**Source:** [LDB Framework (GitHub)](https://github.com/FloridSleeves/LLMDebugger)

---

### Pattern 2: Microsoft Debug-gym

A **text-based environment** teaching AI agents debugging methodologies:

```
┌─────────────────────────────────────────────────────────────┐
│                  Debug-gym Action Space                      │
├────────────┬────────────────────────────────────────────────┤
│ Action     │ Description                                    │
├────────────┼────────────────────────────────────────────────┤
│ eval       │ Execute code snippets                          │
│ view       │ Display file contents                          │
│ pdb        │ Interactive debugging (breakpoints, inspect)   │
│ rewrite    │ Modify source code                             │
│ listdir    │ Navigate directories                           │
└────────────┴────────────────────────────────────────────────┘
```

**Two-Model Architecture:**
1. **Info-seeking model**: Specialized in gathering necessary information
2. **Code generation model**: Creates fixes based on gathered evidence

**Observation Format:** Structured JSON for LLM parsing

**Key Insight:** Agents follow hypothesis-driven investigation:
1. Formulate hypothesis about bug
2. Gather evidence through tool execution
3. Examine variable states
4. Iterate until resolution

**Source:** [Microsoft Debug-gym](https://www.microsoft.com/en-us/research/blog/debug-gym-an-environment-for-ai-coding-tools-to-learn-how-to-debug-code-like-programmers/)

---

### Pattern 3: UniDebugger Multi-Agent Framework

**Three-level cognitive design:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Level 1: Perception                       │
│         (Error detection, symptom identification)            │
├─────────────────────────────────────────────────────────────┤
│                    Level 2: Diagnosis                        │
│         (Root cause analysis, hypothesis generation)         │
├─────────────────────────────────────────────────────────────┤
│                    Level 3: Repair                           │
│         (Fix synthesis, validation, refinement)              │
└─────────────────────────────────────────────────────────────┘
```

**Performance:** Fixes **1.25× to 2.56× more bugs** than alternatives on Defects4J benchmark

**Key Differentiator:** Agents specialized as components of developer cognitive process, not independent experts

**Source:** [UniDebugger (arXiv)](https://arxiv.org/abs/2404.17153)

---

## Language-Specific Debugging

### Python Debugging

#### Common Error Patterns

| Error Type | Pattern | Detection Method | Fix Strategy |
|------------|---------|------------------|--------------|
| `SyntaxError` | Unclosed strings, missing colons | Linters (pre-runtime) | Auto-formatters (Black) |
| `IndentationError` | Mixed tabs/spaces | IDE linters | Consistent auto-formatting |
| `NameError` | Undefined variables | Linters catch before runtime | Define before use |
| `TypeError` | Wrong operand types | Type checkers (Pyright/Mypy) | Verify types match |
| `AttributeError` | Missing methods | Static analysis | Consult object docs |
| `ValueError` | Invalid value for type | Runtime detection | Input validation |
| `ImportError` | Missing modules | Runtime during import | pip install, verify paths |
| `IndexError` | Out of bounds access | Runtime | Bounds checking |
| `KeyError` | Missing dict key | Runtime | `dict.get()` with defaults |

#### Static Analysis Tools

| Tool | Purpose | Speed | Capabilities |
|------|---------|-------|--------------|
| **Pyright** | Type checking | Fast (Microsoft) | Type inference, cross-file analysis |
| **Mypy** | Type checking | Standard | Mature ecosystem, comprehensive |
| **Ruff** | Linting + Formatting | 10-100x faster | Combines Flake8, isort, Black |
| **Pylint** | Comprehensive analysis | Slower | Quality scores, detailed reports |
| **Bandit** | Security scanning | Fast | Credentials, injection detection |

**Recommended Stack:**
```bash
# Type checking
pyright .

# Linting + formatting
ruff check . --fix
ruff format .

# Security
bandit -r src/
```

**Statistics:** 73% of Python developers use type hints in production (2025)

**Source:** [Better Stack Python Errors](https://betterstack.com/community/guides/scaling-python/python-errors/)

---

### JavaScript/TypeScript Debugging

#### Error Detection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   JS/TS Error Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Source Code ──► Parser (Espree/Acorn) ──► AST             │
│                          │                                  │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │    Analysis Layer     │                      │
│              ├───────────────────────┤                      │
│              │ ESLint (Style/Bugs)   │                      │
│              │ TSC (Type Safety)     │                      │
│              │ Semgrep (Security)    │                      │
│              │ DeepScan (Runtime)    │                      │
│              └───────────────────────┘                      │
│                          │                                  │
│                          ▼                                  │
│              Normalized Error Output                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Tool Capabilities

| Tool | Primary Function | AST Analysis | Cross-File | Real-Time |
|------|------------------|--------------|------------|-----------|
| **ESLint** | Style, bugs | Yes (Espree) | No | Yes (IDE) |
| **TypeScript** | Type safety | Yes (semantic) | Yes | Yes |
| **Semgrep** | Security patterns | Yes (custom rules) | Limited | Yes |
| **CodeQL** | Deep data flow | Query-based | Yes | No |
| **DeepScan** | Runtime issues | Control/data flow | Limited | Dashboard |

#### Source Map Debugging

**Production Stack Trace Challenge:**
> "Finding column 23912 in line 1 for minified code is extremely difficult"

**Solution: Source Map Resolution**

```javascript
// Using StackTrace.JS
StackTrace.fromError(error)
  .then(stackframes => {
    // stackframes now contain original source locations
    console.log(stackframes[0].fileName);    // original file
    console.log(stackframes[0].lineNumber);  // original line
  });
```

**Tools:**
- **StackTrace.JS**: Generate, parse, enhance stack traces
- **source-map**: Low-level parsing library
- **Bloomberg PASTA**: Extends source maps with function names
- **Sentry/Datadog**: Auto-decode with uploaded source maps

**Critical:** Always deploy source maps alongside minified code

**Source:** [StackTrace.JS](https://www.stacktracejs.com/)

---

### CSS/SCSS Debugging

#### Bug Categories

| Category | Symptoms | Detection | Solution |
|----------|----------|-----------|----------|
| **Content Overflow** | Unexpected scrollbars | `* { outline: 1px solid red; }` | `max-width: 100%`, check `box-sizing` |
| **Browser Inconsistencies** | Different rendering | Cross-browser testing | CSS resets, vendor prefixes |
| **Cascade Conflicts** | Styles overridden | DevTools specificity view | `@layer`, refactor selectors |
| **DOM Structure Changes** | Broken layouts | Visual regression testing | Flexible layouts with `gap` |

#### Specificity Debugging

```css
/* Specificity calculation: (ID, Class, Element) */

#header .nav a { }        /* (1, 1, 1) = 111 */
.nav-link.active { }      /* (0, 2, 0) = 020 */
nav ul li a { }           /* (0, 0, 4) = 004 */

/* !important breaks the cascade - avoid */
/* Use @layer for intentional precedence control */
@layer base, components, utilities;
```

#### Diagnostic Techniques

1. **Visual outline:** `* { outline: 1px solid red; }`
2. **DevTools Elements panel:** View computed styles, specificity
3. **Firefox overflow indicators:** Shows scrollable regions
4. **Lighthouse CLS:** Measures Cumulative Layout Shift

**Tools:** Stylelint, CSS Stats, webhint, Autoprefixer

**Source:** [Smashing Magazine CSS Debugging](https://www.smashingmagazine.com/2021/10/guide-debugging-css/)

---

### Tailwind CSS Debugging

#### Common Issues

| Issue | Cause | Detection | Solution |
|-------|-------|-----------|----------|
| **Missing styles in prod** | Purge misconfiguration | Test production build | Correct `content` paths |
| **Dynamic classes not applied** | JIT can't detect | Manual testing | `safelist` configuration |
| **Class conflicts** | Framework mixing | Visual inspection | Import order, specificity |
| **Build errors** | Plugin issues | Build output | Install missing plugins |

#### Configuration Debugging

```javascript
// tailwind.config.js

module.exports = {
  // Correct content paths for Next.js
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],

  // Safelist dynamic classes
  safelist: [
    'text-red-500',
    'text-blue-500',
    'text-green-500',
    // Pattern-based safelist
    {
      pattern: /bg-(red|blue|green)-(100|200|300)/,
    },
  ],

  // Use content instead of purge (v3+)
  // purge: [] // DEPRECATED
}
```

#### Dynamic Class Detection

**Problem:** JIT cannot detect dynamically constructed classes:

```jsx
// BAD - JIT won't detect these
const color = 'red';
<div className={`text-${color}-500`} />

// GOOD - Use complete class names
const colorClasses = {
  red: 'text-red-500',
  blue: 'text-blue-500',
};
<div className={colorClasses[color]} />
```

**Tools:**
- `@tailwindcss/debug-screens` plugin
- Tailwind CSS IntelliSense VS Code extension
- `postcss-reporter` for build analysis

**Source:** [LogRocket Tailwind Debugging](https://blog.logrocket.com/debugging-tailwind-css-next-js/)

---

## Root Cause Analysis Techniques

### Machine Learning Approaches

| Technique | Method | Use Case | Accuracy |
|-----------|--------|----------|----------|
| **Naïve Bayes** | Probabilistic classification | Issue categorization | Good for known patterns |
| **MEPFL** | Random Forests, KNN, MLP | Fault prediction | Microservices architecture |
| **DNNs** | Pattern learning | Fault localization | Requires training data |
| **GNN (Sleuth)** | Graph neural network | Trace analysis | Captures causal impact |
| **SBFL** | Spectrum-Based | Test coverage analysis | Java (Flacoco) |

### LLM as Semantic Oracle

```
┌─────────────────────────────────────────────────────────────┐
│                   LLM RCA Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Error/Logs ──► Parse & Extract Context                     │
│                          │                                  │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │    LLM Analysis       │                      │
│              │  ─────────────────    │                      │
│              │  • Analyze symptoms   │                      │
│              │  • Generate hypotheses│                      │
│              │  • Rank by likelihood │                      │
│              │  • Suggest fixes      │                      │
│              └───────────────────────┘                      │
│                          │                                  │
│                          ▼                                  │
│              Hypotheses with Confidence Scores              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Hybrid KBS + LBS Approach

**From arXiv 2502.06633:**

| Strategy | Method | Accuracy | Coverage |
|----------|--------|----------|----------|
| **DAT** | Data-Augmented Training | Moderate | ~50% rank-1 |
| **RAG** | Retrieval-Augmented Generation | **Superior** | Good |
| **NCO** | Naive Concatenation | Modest | Moderate |

**Key Finding:** "Hybrid strategies enhance relevance, completeness, and overall quality of review comments"

**Implementation:**
1. Run static analyzers (PMD, Checkstyle, ESLint, Pyright)
2. Inject results into LLM prompt (RAG approach)
3. LLM generates comprehensive analysis
4. Validate against static analysis findings

**Source:** [Hybrid LLM + Static Analysis (arXiv)](https://arxiv.org/html/2502.06633v1)

---

## Automated Fix Generation

### Generation-Validation Paradigm

```
┌─────────────────────────────────────────────────────────────┐
│                    APR Categories                            │
├────────────────┬────────────────────────────────────────────┤
│ Category       │ Approach                                   │
├────────────────┼────────────────────────────────────────────┤
│ Heuristic      │ Genetic programming, random mutation       │
│ Constraint     │ SMT solving, symbolic execution            │
│ Template       │ Pre-defined fix patterns                   │
│ Learning       │ LLM-guided, retrieval-augmented            │
└────────────────┴────────────────────────────────────────────┘
```

### State-of-the-Art Systems (2025)

| System | Approach | Performance |
|--------|----------|-------------|
| **SelRepair** | Dual retriever (semantic + AST) | Outperforms CodeLlama, DeepSeek |
| **PathFix** | Path-sensitive constraints + SMT + LLM | High precision |
| **Dafny Spec-Guided** | Formal specification + GPT-4o mini | 74.18% repair success |

### Patch Validation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  Validation Pipeline                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Generated Patch                                            │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐   FAIL                                     │
│  │ Type Check  │ ──────► Reject                             │
│  └─────────────┘                                            │
│         │ PASS                                              │
│         ▼                                                   │
│  ┌─────────────┐   FAIL                                     │
│  │ Lint Check  │ ──────► Reject                             │
│  └─────────────┘                                            │
│         │ PASS                                              │
│         ▼                                                   │
│  ┌─────────────┐   FAIL                                     │
│  │ Test Suite  │ ──────► Reject                             │
│  └─────────────┘                                            │
│         │ PASS                                              │
│         ▼                                                   │
│  ┌─────────────┐   FAIL                                     │
│  │ Regression  │ ──────► Reject                             │
│  └─────────────┘                                            │
│         │ PASS                                              │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ Human Review│ ──────► Accept/Reject                      │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Patch Overfitting Problem

**Definition:** Plausible but non-generalizable fixes from underspecified tests

**Mitigations:**
1. **Semantic validation**: Verify program invariants preserved
2. **Test augmentation**: Generate additional tests
3. **Entropy-based ranking**: Prefer natural-looking patches
4. **Cross-validation**: Test on held-out test cases

**Current Performance:** 15-45% correct patch rates on Defects4J benchmarks

**Source:** [Automated Program Repair](https://www.emergentmind.com/topics/automated-program-repair-apr)

---

## Claude Code Integration

### Best Practices from Anthropic

#### Context Management

```bash
# Keep context focused during long sessions
/clear

# Pipe logs directly for analysis
cat error.log | claude

# Terminal output capture
npm run test 2>&1 | tee output.log | claude
```

#### CLAUDE.md Configuration

```markdown
# CLAUDE.md - Debugging Configuration

## Project Structure
- src/ - Source code
- tests/ - Test files
- logs/ - Error logs

## Common Debugging Commands
- `pytest -v` - Run tests with verbose output
- `pyright .` - Type checking
- `ruff check .` - Linting

## Known Edge Cases
- API timeout after 30s on slow connections
- Unicode handling in file paths on Windows

## Debugging Workflow
1. Check error logs first
2. Run type checker
3. Execute relevant tests
4. Review recent git changes
```

#### Subagent Strategy

**Purpose:** Preserve main context while investigating details

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Agent Context                        │
├─────────────────────────────────────────────────────────────┤
│  User request: "Debug the authentication failure"           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Subagent 1: Investigate auth module                  │   │
│  │ (Isolated context - doesn't pollute main)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Subagent 2: Check database connections               │   │
│  │ (Isolated context - doesn't pollute main)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Results combined in main context for final analysis        │
└─────────────────────────────────────────────────────────────┘
```

**Benefit:** 84% token reduction with context editing

#### Interactive Debugging Loop

```
┌─────────────────────────────────────────────────────────────┐
│              Interactive Debugging Workflow                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Add Logging ──► Insert diagnostic print statements      │
│         │                                                   │
│         ▼                                                   │
│  2. Run Application ──► Execute with logging enabled        │
│         │                                                   │
│         ▼                                                   │
│  3. Capture Output ──► Collect logs and error traces        │
│         │                                                   │
│         ▼                                                   │
│  4. Analyze with Claude ──► Pipe output for analysis        │
│         │                                                   │
│         ▼                                                   │
│  5. Iterate ──► Add more specific logging if needed         │
│         │                                                   │
│         └─────────────────────── Loop back to 1             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Source:** [Anthropic Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

---

## Multi-Language Orchestration

### Framework Landscape (2025)

| Framework | Languages | Key Feature | Best For |
|-----------|-----------|-------------|----------|
| **OpenAI Agents SDK** | Python, TypeScript | Dual-language parity | Cross-platform agents |
| **Microsoft Agent Framework** | C#, Python, Java | AutoGen + Semantic Kernel | Enterprise |
| **Google ADK** | TypeScript | Code-first approach | JS/TS developers |
| **Claude Code** | Any (terminal) | Agentic search, deep reasoning | CLI workflows |

### Unified Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Language Router                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input ──► Language Detection ──► Route to Module           │
│                   │                                         │
│         ┌────────┼────────┬────────┬────────┐              │
│         ▼        ▼        ▼        ▼        ▼              │
│     ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│     │Python│ │JS/TS │ │ CSS  │ │Tailw.│ │ HTML │          │
│     │Module│ │Module│ │Module│ │Module│ │Module│          │
│     └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
│         │        │        │        │        │              │
│         └────────┴────────┴────────┴────────┘              │
│                          │                                  │
│                          ▼                                  │
│              Normalized Error Format                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Cross-Language Considerations

**From XL-CoGen Research:**
- LLMs show performance disparities across languages
- Python, JavaScript, PHP show superior generation quality
- Lower-resource languages require specialized handling

**Source:** [VS Code Multi-Agent Orchestration](https://visualstudiomagazine.com/articles/2025/12/12/vs-code-1-107-november-2025-update-expands-multi-agent-orchestration-model-management.aspx)

---

## Technical Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEBUGGING AGENT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ORCHESTRATOR AGENT                          │   │
│  │  • Routes errors to language modules                             │   │
│  │  • Coordinates multi-phase debugging                             │   │
│  │  • Manages context and subagent spawning                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                         │
│         ┌─────────────────────┼─────────────────────┐                  │
│         ▼                     ▼                     ▼                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│  │  ANALYSIS   │      │     FIX     │      │ VALIDATION  │            │
│  │   AGENT     │─────▶│ GENERATION  │─────▶│   AGENT     │            │
│  │             │      │   AGENT     │      │             │            │
│  └─────────────┘      └─────────────┘      └─────────────┘            │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LANGUAGE MODULES                              │   │
│  ├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤   │
│  │  Python  │  JS/TS   │   CSS    │ Tailwind │   HTML   │  SCSS   │   │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┼─────────┤   │
│  │ Pyright  │ ESLint   │ Stylelint│ JIT      │ Validator│ Stylelint│  │
│  │ Ruff     │ TSC      │ DevTools │ Safelist │ A11y     │ Sass    │   │
│  │ pdb      │ SourceMap│ Cascade  │ Content  │ Template │ Autopfx │   │
│  │ Bandit   │ Semgrep  │ Specif.  │ Purge    │ Semantic │         │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      SUPPORT SYSTEMS                             │   │
│  ├────────────────┬────────────────┬────────────────┬──────────────┤   │
│  │ Context Engine │  RCA Engine    │  RAG Database  │   Reporting  │   │
│  │ • AST parsing  │ • Hypothesis   │ • Bug fixes    │ • Diff view  │   │
│  │ • Dep graph    │ • Confidence   │ • Patterns     │ • Explain    │   │
│  │ • Git history  │ • Evidence     │ • Embeddings   │ • Confidence │   │
│  └────────────────┴────────────────┴────────────────┴──────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Orchestrator Agent

| Responsibility | Implementation |
|----------------|----------------|
| Error intake | Multi-format parser (exceptions, logs, stack traces) |
| Language detection | Extension + pattern analysis |
| Phase coordination | State machine for debug lifecycle |
| Context management | Automatic /clear triggers, subagent spawning |

#### 2. Analysis Agent

| Responsibility | Implementation |
|----------------|----------------|
| Static analysis | Integrate Pyright, ESLint, Stylelint |
| Dynamic analysis | pdb integration, runtime inspection |
| RCA | LLM hypothesis generation, confidence scoring |
| Evidence collection | Code structure, test coverage analysis |

#### 3. Fix Generation Agent

| Responsibility | Implementation |
|----------------|----------------|
| Template fixes | Pre-defined patterns for common bugs |
| RAG retrieval | Historical bug-fix database |
| LLM synthesis | Novel bug fix generation |
| Multi-candidate | Generate and rank alternatives |

#### 4. Validation Agent

| Responsibility | Implementation |
|----------------|----------------|
| Type validation | Pyright, TSC integration |
| Lint validation | Ruff, ESLint, Stylelint |
| Test execution | pytest, Jest runners |
| Regression detection | Before/after comparison |

---

## Implementation Roadmap

### Phase Breakdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION PHASES                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 0: Core Infrastructure (P0)                     [Weeks 1-2]     │
│  ├─ Error intake parser                                                │
│  ├─ Language detection                                                 │
│  ├─ Normalized error format                                            │
│  └─ Orchestrator skeleton                                              │
│                                                                         │
│  Phase 1: Python Module (P1)                           [Weeks 3-4]     │
│  ├─ Python error parser                                                │
│  ├─ Pyright integration                                                │
│  ├─ Ruff integration                                                   │
│  ├─ pdb integration                                                    │
│  └─ Import analyzer                                                    │
│                                                                         │
│  Phase 2: JavaScript/TypeScript Module (P2)            [Weeks 5-6]     │
│  ├─ JS/TS error parser                                                 │
│  ├─ ESLint integration                                                 │
│  ├─ TypeScript compiler integration                                    │
│  ├─ Source map resolver                                                │
│  └─ AST parser (tree-sitter)                                          │
│                                                                         │
│  Phase 3: CSS/Tailwind Module (P3)                     [Weeks 7-8]     │
│  ├─ CSS error parser                                                   │
│  ├─ Stylelint integration                                              │
│  ├─ Specificity calculator                                             │
│  ├─ Tailwind class validator                                           │
│  └─ Content path analyzer                                              │
│                                                                         │
│  Phase 4: RCA & Fix Generation (P4)                    [Weeks 9-10]    │
│  ├─ RCA hypothesis generator                                           │
│  ├─ Confidence scoring                                                 │
│  ├─ RAG system                                                         │
│  ├─ Template-based fixes                                               │
│  └─ LLM-guided synthesis                                               │
│                                                                         │
│  Phase 5: Validation & Reporting (P5)                  [Weeks 11-12]   │
│  ├─ Type checker validation                                            │
│  ├─ Lint validation                                                    │
│  ├─ Test execution runner                                              │
│  ├─ Human-readable explanations                                        │
│  └─ Diff visualizer                                                    │
│                                                                         │
│  Phase 6: Production Hardening (P6)                    [Weeks 13-14]   │
│  ├─ Performance caching                                                │
│  ├─ Parallel analysis                                                  │
│  ├─ Incremental analysis                                               │
│  ├─ CI/CD integration                                                  │
│  └─ Metrics dashboard                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Priority Matrix

| Priority | Category | Features | Dependencies |
|----------|----------|----------|--------------|
| **P0** | Core Architecture | 4 | None |
| **P1** | Python Module | 5 | P0 |
| **P2** | JS/TS Module | 6 | P0 |
| **P2** | CSS Module | 5 | P0 |
| **P2** | Tailwind Module | 4 | CSS Module |
| **P3** | Context Engine | 4 | P0 |
| **P3** | RCA Engine | 5 | Context Engine |
| **P4** | Fix Generation | 4 | RCA Engine |
| **P4** | Validation | 5 | Fix Generation |
| **P5** | Reporting | 4 | Validation |
| **P5** | Claude Integration | 6 | P0 |
| **P6** | Performance | 3 | All modules |
| **P6** | Integration | 3 | All modules |

---

## Tool Reference Matrix

### Complete Tool Inventory

| Language | Type Checking | Linting | Security | Runtime Debug | AST Analysis |
|----------|--------------|---------|----------|---------------|--------------|
| **Python** | Pyright, Mypy | Ruff, Pylint | Bandit, Dlint | pdb | tree-sitter |
| **JavaScript** | - | ESLint | Semgrep, Snyk | DevTools | Espree, Acorn |
| **TypeScript** | TSC | ESLint | Semgrep, Snyk | DevTools | TypeScript AST |
| **CSS** | - | Stylelint | - | DevTools | - |
| **SCSS** | - | Stylelint | - | DevTools | - |
| **Tailwind** | - | IntelliSense | - | debug-screens | - |
| **HTML** | - | webhint | - | DevTools | - |

### Integration Commands

```bash
# Python
pyright .                           # Type check
ruff check . --fix                  # Lint + autofix
ruff format .                       # Format
bandit -r src/                      # Security scan
python -m pytest -v                 # Run tests

# JavaScript/TypeScript
npx tsc --noEmit                    # Type check
npx eslint . --fix                  # Lint + autofix
npx prettier --write .              # Format

# CSS/SCSS
npx stylelint "**/*.css" --fix      # Lint + autofix

# Tailwind
npx tailwindcss build -o output.css # Build (catches config issues)
```

---

## Source Analysis

### Source 1: LDB Framework

| Attribute | Value |
|-----------|-------|
| **URL** | https://github.com/FloridSleeves/LLMDebugger |
| **Title** | LDB: Large Language Model Debugger Framework |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | Basic block segmentation, variable tracking |

**Key Points:**
- Segments programs into basic blocks and tracks intermediate variable values
- Implements step-by-step verification against task specifications
- Provides `ldb_debug()` and `ldb_generate()` APIs for structured debugging
- Supports line, block, or function-level debugging granularity
- Mimics human debugging by focusing on simpler code units within execution flow

---

### Source 2: Microsoft Debug-gym

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.microsoft.com/en-us/research/blog/debug-gym... |
| **Title** | Microsoft Debug-gym: Interactive Debugging Environment |
| **Relevance Score** | 9.5/10 |
| **Key Contribution** | Two-model architecture, hypothesis-driven investigation |

**Key Points:**
- Text-based environment teaching AI agents debugging methodologies
- Integrates pdb for setting breakpoints, navigating code, printing variables
- Actions include eval, view, pdb, rewrite, listdir
- Observations return as structured JSON for LLM parsing
- Two-model approach: info-seeking model + code generation model
- Agents formulate hypotheses, gather evidence, examine variable states iteratively

---

### Source 3: Addy Osmani's LLM Coding Workflow 2026

| Attribute | Value |
|-----------|-------|
| **URL** | https://addyosmani.com/blog/ai-coding-workflow/ |
| **Title** | Addy Osmani's LLM Coding Workflow 2026 |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | Practical development workflow with AI assistants |

**Key Points:**
- Start with detailed specs (spec.md) before coding - waterfall in 15 minutes
- Break tasks into small chunks, test after each iteration
- Supply extensive context: code snippets, API docs, constraints, examples
- Switch between models tactically if one gets stuck
- Write tests alongside generation, use secondary AI to critique first AI's work
- Commit after each small task for rollback capability
- Create CLAUDE.md with style preferences to reduce hallucinations
- Treat LLMs as over-confident and prone to mistakes - remain accountable engineer

---

### Source 4: Anthropic Claude Code Best Practices

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.anthropic.com/engineering/claude-code-best-practices |
| **Title** | Anthropic Official: Claude Code Debugging Best Practices |
| **Relevance Score** | 9.5/10 |
| **Key Contribution** | Official best practices for Claude-based debugging |

**Key Points:**
- Iterative debugging loop with visual targets, test cases, or screenshots
- Use /clear frequently to keep context focused during long sessions
- Document common debugging commands and edge cases in CLAUDE.md
- Use subagents for verification and investigation to preserve context
- Separate context: one Claude writes, another reviews for better results
- Pipe logs directly: `cat foo.txt | claude` for error trace analysis
- Search git history to understand when problematic code was introduced

---

### Source 5: Practical Guide to Debugging with Claude Code

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.eesel.ai/blog/debug-with-claude-code |
| **Title** | Practical Guide: Debugging with Claude Code |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | Step-by-step debugging workflows |

**Key Points:**
- Create CLAUDE.md with project structure, bash commands, utility functions, testing instructions
- Interactive debugging loop: add logging → run → capture output → analyze → iterate
- Pipe terminal output directly: `npm run test 2>&1 | tee outfile | claude`
- Use MCP Playwright for browser debugging, console logs, runtime errors
- Use VS Code extension for breakpoints, stepping through code, evaluating expressions
- TDD workflow: request tests first, confirm failure, then write passing code
- Context challenges: struggles with deep cross-file dependencies in massive codebases

---

### Source 6: Python Errors Guide (Better Stack)

| Attribute | Value |
|-----------|-------|
| **URL** | https://betterstack.com/community/guides/scaling-python/python-errors/ |
| **Title** | 15 Common Python Errors: Patterns & Detection Methods |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | Comprehensive Python error pattern reference |

**Key Points:**
- SyntaxError: Linters flag before execution, use auto-formatters like Black
- IndentationError: IDE linters highlight, use consistent auto-formatting
- NameError: Linters catch undefined references before runtime
- TypeError: Verify operand types, check function argument requirements
- AttributeError: Use type checkers like Mypy for static analysis detection
- ValueError/TypeError: Runtime detection, use try-except with validation
- IndexError/KeyError: Use bounds checking, dict.get() with defaults
- Production strategy: Centralized logging with aggregation and monitoring alerts

---

### Source 7: Python Static Analysis Tools 2025

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.in-com.com/blog/top-20-python-static-analysis-tools... |
| **Title** | 20 Python Static Analysis Tools for Automated Debugging |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | Tool comparison and integration strategies |

**Key Points:**
- Pylint: detects errors, enforces PEP 8, generates quality scores
- Mypy/Pyright: type mismatches before execution, Pyright faster for large codebases
- Bandit/Dlint: security-focused, detects hardcoded credentials and injection risks
- Vulture/Autoflake: identifies and removes unused code and dead imports
- Radon/McCabe: cyclomatic complexity analysis for refactoring focus
- Prospector: aggregates multiple linters into unified interface
- CI/CD integration: Jenkins, GitHub Actions, GitLab with quality gates
- Layered approach: Pylint for style, Bandit for security, Mypy for types, Radon for complexity

---

### Source 8: JavaScript/TypeScript Static Analysis 2025

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.in-com.com/blog/javascript-static-analysis... |
| **Title** | JavaScript/TypeScript Static Analysis Tools 2025 |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | JS/TS tool capabilities and limitations |

**Key Points:**
- ESLint: Rule-based linting with automatic code fixing, per-file AST analysis
- TypeScript Compiler: Compile-time type checking, cross-file semantic analysis
- Semgrep: Pattern-based AST analysis for security issues with custom YAML rules
- CodeQL: Deep data flow, control flow, function behavior analysis (query-based)
- SonarQube: Bugs, code smells, security vulns, PR integration
- DeepScan: Runtime issues, null dereferences, forgotten await statements
- Key insight: Most tools excel at syntax/type checking but lack cross-file data flow

---

### Source 9: CSS Debugging Guide (Smashing Magazine)

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.smashingmagazine.com/2021/10/guide-debugging-css/ |
| **Title** | CSS Debugging Guide: Techniques and Tools |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | CSS-specific debugging techniques |

**Key Points:**
- Four bug categories: content overflow, browser inconsistencies, cascade conflicts, DOM structure changes
- Diagnostic technique: `* { outline: 1px solid red; }` to visualize layout without affecting dimensions
- Firefox DevTools shows scrollable regions and overflow indicators
- Common overflow triggers: absolute widths, improper box-sizing, body margins
- Use @layer specification for intentional cascade precedence control
- DOM-resilient patterns: gap property, flex-basis with flex-shrink, min() function
- Automated tools: webhint, Autoprefixer, Lighthouse CLS metrics

---

### Source 10: Tailwind CSS Debugging (LogRocket)

| Attribute | Value |
|-----------|-------|
| **URL** | https://blog.logrocket.com/debugging-tailwind-css-next-js/ |
| **Title** | Tailwind CSS Debugging: Common Issues & Solutions |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | Tailwind-specific debugging patterns |

**Key Points:**
- Two issue categories: incorrect usage and improper configuration
- Use content instead of purge (Tailwind v3+) for file path configuration
- Dynamic class names not detected by JIT - use safelist for known patterns
- Ensure correct paths: pages/\*\*/\*.{js,ts,jsx,tsx}, components/\*\*/\*.{js,ts,jsx,tsx}
- Install Tailwind CSS IntelliSense VS Code extension for class autocomplete and error detection
- Framework conflicts: import Tailwind last, use !important when necessary, increase specificity
- Test production build locally (npm run build) before deployment to catch purge issues

---

### Source 11: Hybrid LLM + Static Analysis (arXiv)

| Attribute | Value |
|-----------|-------|
| **URL** | https://arxiv.org/html/2502.06633v1 |
| **Title** | Hybrid LLM + Static Analysis for Code Review |
| **Relevance Score** | 9.5/10 |
| **Key Contribution** | Research on combining static analysis with LLMs |

**Key Points:**
- Three integration strategies: Data-Augmented Training (DAT), RAG, Naive Concatenation (NCO)
- DAT: Enhance training data with synthetic data from both KBS and LBS systems
- RAG: Inject static analysis results into prompts during generation
- RAG demonstrated superior accuracy, grounding responses in coding standards
- DAT achieved strongest coverage, capturing nearly 50% of rank-1 reviews
- Static analyzers (PMD, Checkstyle) provide precision; LLMs provide comprehensiveness
- Hybrid strategies enhance relevance, completeness, and overall quality of review comments

---

### Source 12: Stack Trace Parsing (StackTrace.JS)

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.stacktracejs.com/ |
| **Title** | Stack Trace Parsing & Source Map Debugging |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | JavaScript stack trace handling |

**Key Points:**
- StackTrace.JS: Generate, parse, enhance JS stack traces using Error.stack mechanism
- Source map libraries: source-map (parsing), stacktrace-parser (structured objects)
- Bloomberg PASTA: Extends source maps with x_com_bloomberg_sourcesFunctionMappings for function names
- Production challenge: Finding column 23912 in line 1 for minified code is extremely difficult
- Sentry/Datadog/New Relic: Auto-decode stack traces when source maps uploaded during deployment
- Critical: Always deploy source maps alongside minified code to avoid mismatched decoding
- Error grouping: Errors auto-group by identical stack traces for impact analysis

---

### Source 13: AI Coding Assistants Comparison (Render)

| Attribute | Value |
|-----------|-------|
| **URL** | https://render.com/blog/ai-coding-agents-benchmark |
| **Title** | AI Coding Assistants Comparison 2025: Debugging Capabilities |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | Comparative analysis of AI coding tools |

**Key Points:**
- Cursor: Fork of VS Code with AI core, sees whole project, makes multi-file changes autonomously
- GitHub Copilot: IDE extension, smart autocomplete, doesn't understand entire codebase
- Claude Code: Terminal-first, agentic search scans full project, deep reasoning, multi-agent workflows
- All agents helpful for error research and resolution - useful even without code generation trust
- Copilot limitation: suggests imports from packages not in use, references non-existent functions
- Key insight: 67% of developers spend more time debugging AI code than writing manually
- Best practice: Match tool to task - Copilot for everyday, Cursor for complex, Aider for git terminal

---

### Source 14: Multi-Language Orchestration (VS Code Magazine)

| Attribute | Value |
|-----------|-------|
| **URL** | https://visualstudiomagazine.com/articles/2025/12/12/vs-code-1-107... |
| **Title** | Multi-Language Debugging Agent Orchestration 2025 |
| **Relevance Score** | 8.5/10 |
| **Key Contribution** | Framework landscape for multi-language agents |

**Key Points:**
- OpenAI Agents SDK: Equal features in Python and TypeScript/JavaScript with auto schema generation
- Microsoft unified Agent Framework: Merges AutoGen + Semantic Kernel, multi-language (C#, Python, Java)
- Google ADK for TypeScript: Open-source, code-first approach for AI agents
- VS Code 1.107: Multi-agent orchestration across local, background, cloud environments
- XL-CoGen: Multi-agent architecture for cross-language code generation with intermediate representation
- Key insight: LLMs show performance disparities across languages - Python/JS/PHP superior to lower-resource languages

---

### Source 15: Automated Root Cause Analysis (Datadog)

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.datadoghq.com/blog/datadog-watchdog-automated-root-cause-analysis/ |
| **Title** | Automated Root Cause Analysis Techniques 2025 |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | ML-based RCA techniques |

**Key Points:**
- Naïve Bayes ML for identifying root causes of newly reported software issues
- LLM module as semantic oracle: analyzes test outcomes/error logs, hypothesizes root causes, suggests patches
- MEPFL: Random Forests, KNN, MLP for predicting errors, fault locations, types in microservices
- DNNs trained on normal/faulty datasets learn patterns for fault localization
- Sleuth: Graph neural network captures causal impact of spans in traces
- Datadog Watchdog RCA: ML-based anomaly detection, identifies causal relationships across apps/infra
- Spectrum-Based Fault Localization (SBFL): Flacoco built on JaCoCo for Java programs

---

### Source 16: Automated Program Repair (EmergentMind)

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.emergentmind.com/topics/automated-program-repair-apr |
| **Title** | Automated Program Repair & Fix Validation 2025 |
| **Relevance Score** | 9.0/10 |
| **Key Contribution** | State-of-the-art in automated code repair |

**Key Points:**
- Generation-Validation (G&V) paradigm: heuristic, constraint, template, learning-based approaches
- SelRepair: Dual retriever (semantic + AST syntax) gathers bug-fix exemplars for LLM prompt
- PathFix: Path-sensitive constraints over symbolic paths, SMT solving with LLM guidance
- Dafny spec-guided repair: 89.6% fault localization, 74.18% repair success with GPT-4o mini
- Patch overfitting problem: Plausible but non-generalizable fixes from underspecified tests
- Mitigation: Semantic validation, test augmentation, naturalness/entropy-based patch ranking
- Current APR performance: 15-45% correct patch rates on Defects4J benchmarks

---

## Appendices

### Appendix A: Python Error Pattern Quick Reference

```python
# SyntaxError - Caught by linters before execution
def bad_syntax(
    print("missing paren")  # SyntaxError

# IndentationError - IDE highlights immediately
def bad_indent():
print("wrong indent")  # IndentationError

# NameError - Linters catch undefined variables
print(undefined_var)  # NameError

# TypeError - Type checkers identify
result = "hello" + 5  # TypeError

# AttributeError - Static analysis detects
[1, 2, 3].lower()  # AttributeError

# ValueError - Runtime, needs validation
int("not a number")  # ValueError

# KeyError - Use .get() for safety
data = {}
value = data["missing"]  # KeyError
value = data.get("missing", "default")  # Safe

# IndexError - Bounds check first
items = [1, 2, 3]
item = items[10]  # IndexError
if len(items) > 10:
    item = items[10]  # Safe
```

---

### Appendix B: Tailwind Configuration Template

```javascript
// tailwind.config.js - Production-ready configuration

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Content paths for class detection
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  // Safelist dynamic classes
  safelist: [
    // Explicit classes
    'bg-red-500',
    'text-blue-600',

    // Pattern-based
    {
      pattern: /bg-(red|green|blue)-(100|200|300|400|500)/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /text-(sm|base|lg|xl|2xl)/,
    },
  ],

  // Theme extensions
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
      },
    },
  },

  // Plugins
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],

  // Dark mode strategy
  darkMode: 'class',
}
```

---

### Appendix C: CLAUDE.md Template for Debugging

```markdown
# CLAUDE.md - Debugging Agent Configuration

## Project Overview
[Project name]: Multi-language web application
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Python FastAPI
- Database: PostgreSQL

## Directory Structure
```
src/
├── frontend/     # React components
├── backend/      # FastAPI routes
├── shared/       # Shared types
└── tests/        # Test files
```

## Common Debugging Commands

### Python
```bash
pyright .                    # Type check
ruff check . --fix          # Lint + fix
pytest -v                    # Run tests
pytest --pdb                 # Debug on failure
```

### TypeScript
```bash
npx tsc --noEmit            # Type check
npx eslint . --fix          # Lint + fix
npm test                     # Run tests
```

### CSS/Tailwind
```bash
npm run build               # Catch purge issues
npx stylelint "**/*.css"    # Lint CSS
```

## Known Edge Cases
- API timeout: 30s on slow connections
- File paths: Unicode issues on Windows
- Cache: Clear Redis after schema changes

## Error Log Locations
- Backend: logs/api.log
- Frontend: Browser console
- Build: .next/build-error.log

## Debugging Workflow
1. Check error type and language
2. Run appropriate static analysis
3. Execute relevant tests
4. Review recent git changes
5. Add logging if needed
6. Iterate until resolved

## Test Commands
```bash
# Run all tests
npm run test:all

# Run specific test
pytest tests/test_auth.py -v
npm test -- --grep "auth"
```
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Document Version** | 1.0.0 |
| **Created** | January 11, 2026 |
| **Research Quality Score** | 8.9/10 |
| **Total Sources** | 16 |
| **Total Features Generated** | 60 |
| **Primary Author** | Research Synthesis Agent |
| **Output Location** | `.claude/generated_features.json` |

---

*This document was generated through systematic research synthesis using extended thinking analysis. All sources have been verified and scored for relevance. Implementation features are available in the generated features file for use with the `/feature` command.*
