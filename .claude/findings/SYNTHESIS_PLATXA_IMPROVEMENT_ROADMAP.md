# Platxa Improvement Roadmap - Research Synthesis

**Research Session:** research_20260127_145821_fb86
**Date:** 2026-01-27
**Sources Analyzed:** 7 (internal codebase + competitive + academic)
**Quality Score:** 9.0/10

---

## Executive Summary

Platxa has three powerful components that are currently **disconnected silos**:

1. **platxa-website-studio** — Next.js chat UI generating Odoo theme files via Handlebars templates
2. **platxa-frontend-agent** — Sophisticated multi-agent library (orchestrator, OKLCH palette, design tokens, accessibility, animations, 30+ test files)
3. **platxa-editor-sync** — Production-grade Yjs CRDT sidecar for real-time file collaboration

**The #1 finding:** These systems need to be wired together before any new features matter. The frontend-agent has capabilities that the website-studio doesn't use. The editor-sync has AI integration hooks that nothing calls. This is a $100M ARR gap (what Lovable achieved by having a unified system).

---

## Current State Analysis

### What Platxa Has (Strengths)
| Component | Capability | Maturity |
|-----------|-----------|----------|
| Website Studio | Chat interface, file explorer, preview with device frames | MVP |
| Website Studio | 5 AI tools (theme, page, snippet, style, menu) with Zod schemas | Production |
| Website Studio | Handlebars renderer → Odoo module files (__manifest__.py, SCSS) | Production |
| Frontend Agent | FrontendOrchestrator with 5-step pipeline | Library-ready |
| Frontend Agent | OKLCH palette generation, 11 industry presets | Library-ready |
| Frontend Agent | Multi-Agent Coordinator (5 distribution + 5 aggregation strategies) | Library-ready |
| Frontend Agent | Accessibility auditor, ESLint plugin, animation worker | Library-ready |
| Editor Sync | Yjs CRDT per-file WebSocket, debounced persistence, git commits | Production |
| Editor Sync | AI integration via `updateDocContent()` with `doc.transact()` | Foundation |

### What Platxa Is Missing (Gaps)

| Gap | Impact | Competitive Reference |
|-----|--------|----------------------|
| **System integration** — 3 components not wired together | Blocking | Lovable: unified pipeline |
| **Design token pipeline** — No W3C DTCG, no OKLCH scales, no dark mode | Brand quality | No competitor has this either |
| **Quality gates** — No automated validation of generated output | Production risk | SWE-Agent: 6-stage gates |
| **Visual editing** — No click-to-edit, no section-level regeneration | UX gap | Lovable: AST-based visual edits |
| **Agent intelligence** — No RAG, no self-correction, no multi-step planning | Output quality | Lovable Agent Mode, Devin |
| **Awareness protocol** — AI editing indicators not implemented | Collaboration UX | Cursor: multi-agent cursors |
| **Token enforcement** — Brand drift across multi-page generation | Consistency | No competitor solves this |

---

## Competitive Landscape

### Lovable.dev (Primary Benchmark)
- $100M ARR in 8 months
- Visual Edits via Vite plugin + AST (Babel/SWC) + HMR
- Agent Mode: Plan→Search→Read→Edit→Test autonomous cycle
- RAG for codebase understanding
- Cloud-hosted on Fly.io (4000+ instances)
- **Platxa advantage over Lovable:** Real backend (Odoo), real-time collaboration (Yjs), brand kit

### Bolt.new
- WebContainers (browser WASM Node.js) for sub-100ms preview
- Zero server cost for preview
- **Platxa advantage:** Odoo deployment target, not just prototyping

### v0 (Vercel)
- Component-level generation with shadcn/ui
- Strong Tailwind integration
- **Platxa advantage:** Full-stack Odoo themes, not just UI components

---

## 6-Tier Improvement Strategy

### Tier 1: Wire the System Together (P0 - Foundation)
**Why first:** Nothing else works until the 3 systems communicate. The frontend-agent's orchestrator, palette generator, and accessibility auditor are unusable from the website-studio UI.

**Key actions:**
- Create AgentBridge service connecting frontend-agent → website-studio
- Route all 5 AI tools through the frontend-agent orchestrator
- Inject brand kit tokens into AI system prompts
- Stream agent status to chat UI (plan/search/edit/test phases)
- Write generated files through editor-sync WebSocket

### Tier 2: Design Token Pipeline (P1 - Brand Differentiation)
**Why second:** This is Platxa's unique opportunity. NO competitor combines AI brand generation + W3C design tokens + AI code generation.

**Key actions:**
- Generate W3C DTCG format tokens (JSON with $value, $type)
- Create OKLCH-based 10-step color scales with dark mode derivation
- Implement fluid typography with clamp()
- Build token-to-SCSS transformer for Odoo
- Create compact token serializer for LLM context (<500 tokens)
- Add brand consistency scoring (0-100)

### Tier 3: Quality Gates (P1 - Production Readiness)
**Why third:** Without quality gates, generated output is unreliable. Users lose trust after 2-3 bad generations.

**Key actions:**
- Build 6-stage pipeline: Parse→Compile→Lint→A11y→Render→Visual
- Validate QWeb XML syntax and Odoo snippet structure
- Check SCSS compilation and WCAG contrast ratios
- Add Odoo module structure validation
- Create quality score aggregator with pass/fail thresholds

### Tier 4: Visual Editing (P2 - Lovable Parity)
**Why fourth:** Visual editing reduces AI costs by enabling precise human changes without AI intervention.

**Key actions:**
- Click-to-select snippet mapping in preview
- Direct style editing → SCSS variable updates
- Section-level regeneration (regenerate one snippet, keep rest)
- Awareness protocol for AI editing indicators
- Drag-and-drop section reordering

### Tier 5: Agent Intelligence (P2 - Competitive Edge)
**Why fifth:** Better agent architecture produces higher quality output with fewer iterations.

**Key actions:**
- Orchestrator-Workers with Evaluator-Optimizer feedback loop
- RAG for existing theme codebase understanding
- Multi-step Plan→Search→Read→Edit→Test cycle
- Self-correction from quality gate feedback
- Clarifying questions before ambiguous generation

### Tier 6: Odoo Deployment & Production (P1 - End-to-End Value)
**Why last of P1:** This is the end-to-end value proposition. Users must be able to deploy generated themes to real Odoo instances.

**Key actions:**
- Complete Odoo module packager with proper directory structure
- Theme marketplace metadata generation
- Multi-Odoo-version compatibility (16.0, 17.0, 18.0)
- One-click deploy to Odoo via XML-RPC
- Theme documentation generator

---

## Feature Count by Category

| Category | Count | Priority |
|----------|-------|----------|
| System Integration | 15 | P0 |
| Design Token Pipeline | 18 | P1 |
| Quality Assurance | 14 | P1 |
| Visual Editing & Preview | 16 | P2 |
| Agent Intelligence | 15 | P2 |
| Odoo Deployment | 12 | P1 |
| Developer Experience | 10 | P2 |
| **Total** | **100** | — |

---

## Key Insights

1. **Integration > Innovation**: The biggest improvement comes from connecting existing systems, not building new ones
2. **Brand kit is the moat**: No competitor has AI brand generation + design tokens + code generation in one pipeline
3. **Odoo is the unfair advantage**: Real backend, real business logic, real deployment — unlike Lovable's Supabase-only approach
4. **Section-level editing matches Odoo snippets**: The emerging best practice (section-level, not component or page) aligns perfectly with Odoo's snippet architecture
5. **Quality gates build trust**: Users abandon AI tools after 2-3 bad outputs; automated validation prevents this
6. **Visual editing reduces costs**: Simple changes shouldn't require AI intervention (Lovable's key insight)

---

*Generated from research session research_20260127_145821_fb86*
