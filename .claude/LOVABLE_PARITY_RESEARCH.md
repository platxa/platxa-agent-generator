# Lovable-Parity Research: Odoo AI Website Generator

**Research Date:** 2026-01-28
**Objective:** Build a Lovable.dev-like system for Odoo website generation
**Status:** Research Complete - Ready for Implementation

---

## Executive Summary

This research analyzes Lovable.dev's architecture and maps it against Platxa's existing capabilities to create a roadmap for achieving Lovable-parity in Odoo website generation.

### Key Finding

The #1 differentiator is the **self-correction loop**. Lovable achieves 90% error reduction through:
```
Generate → Validate → Fix → Repeat (max 5 iterations)
```

Platxa currently uses single-pass generation ("generate and hope").

---

## Lovable.dev Architecture Analysis

### Dual-Mode System

| Mode | Purpose | Capabilities |
|------|---------|--------------|
| **Plan Mode** | Decision-making | Explore options, ask questions, NO code changes |
| **Agent Mode** | Execution | Autonomous multi-step reasoning, self-debugging |

### Agent Mode Workflow (6 Steps)

1. **Interpret** - Parse user intent, identify goal
2. **Explore** - Search codebase, read relevant files
3. **Context** - Build understanding of existing code
4. **Execute** - Generate/edit across multiple files
5. **Test** - Run build, check errors, inspect logs
6. **Fix** - Auto-correct issues, loop if needed

### Tool-Based Architecture

Lovable uses **on-demand tools** rather than pre-loading codebases:

| Tool | Purpose |
|------|---------|
| `search_codebase` | Semantic code search |
| `read_file` | Load specific file content |
| `write_file` | Create/modify files |
| `inspect_logs` | Read build/runtime errors |
| `web_search` | Fetch external docs |
| `generate_image` | AI image creation |

### Real-Time Preview

- Vite HMR for sub-second updates
- Split-screen: Chat left, Preview right
- Instant code-to-preview synchronization

---

## Platxa Current State Analysis

### Existing Strengths

| Component | Location | Status |
|-----------|----------|--------|
| FrontendOrchestrator | `/packages/platxa-frontend-agent/` | 5-step pipeline exists |
| Coordinator | `/packages/platxa-frontend-agent/` | Multi-agent dispatch |
| Design Tokens | `/packages/platxa-frontend-agent/` | OKLCH, DTCG, Tailwind |
| Editor-Sync | `/platxa-editor-sync/` | Yjs real-time sync |
| Agent Bridge | `/platxa-website-studio/lib/agent-bridge/` | Partial integration |
| Quality Gates | Various | Accessibility, validation |
| Odoo Skills | `/platxa-website-studio/lib/odoo-skills/` | QWeb, snippets, i18n |

### Critical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| No self-correction loop | Unreliable generation | CRITICAL |
| No Plan Mode | User control missing | HIGH |
| No HMR preview | Slow feedback | HIGH |
| No autonomous debugging | Manual error fixing | HIGH |
| No click-to-select | No visual editing | MEDIUM |
| No codebase search tool | Limited context | MEDIUM |

---

## Architecture Design

### Proposed System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PLATXA STUDIO UI                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐    ┌─────────────────────────────────────────┐  │
│  │    CHAT PANEL      │    │           PREVIEW PANEL                  │  │
│  │                    │    │                                          │  │
│  │  [Plan Mode]       │    │  ┌────────────────────────────────────┐  │  │
│  │  [Agent Mode]      │    │  │     LIVE ODOO PREVIEW              │  │  │
│  │                    │    │  │     (QWeb + SCSS HMR)              │  │  │
│  │  Progress:         │    │  │                                    │  │  │
│  │  ├─ Planning...    │    │  │   Click-to-select enabled          │  │  │
│  │  ├─ Searching...   │    │  └────────────────────────────────────┘  │  │
│  │  ├─ Generating...  │    │                                          │  │
│  │  ├─ Testing...     │    │  ┌────────────────────────────────────┐  │  │
│  │  └─ Complete ✓     │    │  │     EDITOR PANEL                   │  │  │
│  └────────────────────┘    │  └────────────────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGENTIC CORE (New Component)                       │
├─────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌───────────┐   │
│   │ MODE ROUTER │──►│ PLAN ENGINE │──►│ AGENT ENGINE│──►│ SUMMARIZER│   │
│   └─────────────┘   └─────────────┘   └──────┬──────┘   └───────────┘   │
│                                              │                           │
│   ┌──────────────────────────────────────────┴───────────────────────┐  │
│   │                    TOOL EXECUTION ENGINE                          │  │
│   │  search | read | write | validate | compile | preview | logs      │  │
│   └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Engine Core Loop

```typescript
class AgentEngine {
  async execute(goal: string): Promise<AgentResult> {
    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      // Phase 1: Plan (or re-plan if errors)
      const plan = await this.planPhase();

      // Phase 2: Execute plan steps
      for (const step of plan.steps) {
        await this.executeStep(step);
        this.emitProgress(step);
      }

      // Phase 3: Validate results
      const validation = await this.validatePhase();

      if (validation.passed && validation.qualityScore >= 80) {
        return this.finalize();
      }

      // Phase 4: Self-correct
      await this.replanWithErrors(validation.errors);
      iteration++;
    }

    return this.finalizeWithWarnings();
  }
}
```

### Odoo-Specific Tools (10 Core Tools)

| Tool | Purpose | Odoo-Specific |
|------|---------|---------------|
| `search_codebase` | Semantic search | Snippet/template patterns |
| `read_file` | Load file content | QWeb parsing |
| `write_file` | Create/modify | Yjs sync integration |
| `edit_file` | Targeted edits | SCSS variable updates |
| `validate_qweb` | Template validation | t-directive checking |
| `compile_scss` | Style compilation | Odoo SCSS structure |
| `preview_render` | Generate preview | QWeb + Bootstrap |
| `inspect_logs` | Debug errors | Sidecar logs |
| `web_search` | External docs | Odoo documentation |
| `test_odoo` | Docker testing | Module installation |

---

## Implementation Roadmap

### Phase Overview

| Phase | Name | Priority | Description |
|-------|------|----------|-------------|
| 1 | Agentic Core | CRITICAL | Agent Engine + Tools + Mode Router |
| 2 | Plan Mode | HIGH | Non-destructive exploration |
| 3 | HMR Preview | HIGH | Real-time visual feedback |
| 4 | Enhanced UI | MEDIUM | Progress, timeline, responsive |
| 5 | Self-Debugging | HIGH | Auto-fix pipeline |
| 6 | Integration | MEDIUM | Wire everything together |

### Critical Path

```
Phase 1 (Agentic Core)
    │
    ├──► Phase 5 (Self-Debugging)
    │         │
    │         ▼
    └──► Phase 3 (HMR Preview) ──► Phase 4 (UI) ──► Phase 6 (Integration)
              │
              └──► Phase 2 (Plan Mode)
```

### Phase 1: Agentic Core (Foundation)

**Deliverables:**
- `/lib/agentic-core/agent-engine.ts` - Self-correction loop
- `/lib/agentic-core/tool-executor.ts` - Tool invocation system
- `/lib/agentic-core/mode-router.ts` - Plan vs Agent detection
- `/lib/agentic-core/tools/*.ts` - 10 core tools

**Key Features:**
- Plan → Execute → Validate → Fix → Repeat cycle
- Max 5 iterations with quality scoring
- Event streaming for UI progress
- Tool result caching

### Phase 2: Plan Mode

**Deliverables:**
- `/lib/agentic-core/plan-engine.ts`
- `/components/chat/PlanModeUI.tsx`
- `/components/chat/OptionCard.tsx`
- `/components/chat/PlanPreview.tsx`

**Key Features:**
- 2-4 design options per request
- Pros/cons for each option
- Clarifying questions for ambiguity
- Approve → Execute handoff

### Phase 3: HMR Preview

**Deliverables:**
- `/lib/preview/hmr-preview-engine.ts`
- `/lib/preview/source-mapper.ts`
- `/lib/preview/iframe-runtime.ts`
- `/components/preview/ClickToSelect.tsx`
- `/components/preview/FloatingEditor.tsx`

**Key Features:**
- CSS injection without reload (<100ms)
- QWeb DOM morphing (preserves state)
- Bidirectional source mapping
- Click-to-select visual editing

### Phase 5: Self-Debugging

**Deliverables:**
- `/lib/agentic-core/log-inspector.ts`
- `/lib/agentic-core/error-analyzer.ts`
- `/lib/agentic-core/auto-fixer.ts`
- `/lib/agentic-core/error-patterns.ts`

**Key Features:**
- SCSS, QWeb, Odoo log aggregation
- Structured error parsing
- 50+ error pattern library
- Auto-fix generation and retry

---

## Success Metrics

| Metric | Lovable Baseline | Platxa Target |
|--------|------------------|---------------|
| Build error rate | 10% | ≤15% |
| First-gen quality | ~70% | ≥65% |
| Self-correction success | ~85% | ≥80% |
| Preview update latency | <500ms | <500ms |
| Full generation time | 15-45s | 20-60s |

---

## Leveraging Existing Assets

| Existing | Integration Point |
|----------|-------------------|
| FrontendOrchestrator | Agent Engine's generation step |
| Design Tokens | Agent context injection |
| Yjs Editor-Sync | Tool write operations |
| Quality Gates | Validation step |
| Agent Bridge | Expand to tool executor |
| SCSS Compiler | Preview + validation |
| QWeb Parser | Source mapping |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM hallucination | Structured output + validation gates |
| Preview performance | Incremental updates + caching |
| QWeb complexity | Extensive error pattern library |
| Token cost | Context pruning + tool caching |
| Odoo versions | Version-specific validators |

---

## Sources

- [Lovable - AI App Builder](https://lovable.dev/)
- [Lovable Modes Documentation](https://docs.lovable.dev/features/modes)
- [Agent Mode Beta Announcement](https://lovable.dev/blog/agent-mode-beta)
- [AWS Agentic AI Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/introduction.html)
- [Google Cloud Agentic Design Patterns](https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud)
- [Full-Stack AI Agent Architecture](https://www.pingcap.com/blog/ai-agent-that-builds-full-stack-apps/)

---

## Next Steps

1. **Immediate**: Create Agent Engine skeleton with single validation pass
2. **Week 1-2**: Implement full agentic loop with 5 iterations
3. **Week 3-4**: Add self-debugging pipeline
4. **Week 5-6**: Build HMR preview system
5. **Week 7+**: Plan Mode and UI enhancements

---

*Research conducted using deep analysis of Lovable.dev, Platxa codebase, and industry agentic AI patterns.*
