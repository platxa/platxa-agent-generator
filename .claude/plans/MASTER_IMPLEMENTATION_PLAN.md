# Master Implementation Plan: Platxa Odoo Website Generator

**Vision:** Build a lovable.dev-quality AI-powered Odoo website generator
**Status:** In Progress
**Created:** 2026-01-24

---

## Executive Summary

Platxa Website Studio is an AI-powered visual development environment for creating Odoo website themes. Like lovable.dev, users describe what they want in natural language, and the AI generates production-ready code with real-time preview.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATXA WEBSITE STUDIO                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Chat Panel │  │   Editor    │  │    Live Preview         │ │
│  │  (AI Input) │  │  (Monaco)   │  │    (Streaming)          │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Streaming Preview Provider                      ││
│  │   (Real-time parsing & preview during AI generation)        ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  AI Engine  │  │  File Store │  │   QWeb Runtime          │ │
│  │  (Ollama)   │  │  (Zustand)  │  │   (Template Simulator)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      ODOO SKILLS LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Theme   │ │ Snippet  │ │Validator │ │   i18n   │           │
│  │Generator │ │ Builder  │ │  (QWeb)  │ │ Support  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                      DEPLOYMENT LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Export  │ │   Git    │ │  Docker  │ │  Odoo    │           │
│  │  (ZIP)   │ │  Sync    │ │  Deploy  │ │  Connect │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tiers

### Tier 1: Core Experience (Critical Path)
*Must-have for MVP - lovable.dev parity*

| # | Feature | Priority | Status | Dependencies |
|---|---------|----------|--------|--------------|
| 1.1 | Streaming Preview Provider | P0 | ✅ Complete | - |
| 1.2 | Incremental QWeb Parser | P0 | ✅ Complete | 1.1 |
| 1.3 | Chat + Preview Integration | P0 | ✅ Complete | 1.1, 1.2 |
| 1.4 | Enhanced QWeb Runtime | P0 | ✅ Complete | 1.2 |
| 1.5 | Hot Reload System | P1 | ✅ Complete | 1.3 |
| 1.6 | Device Frames & Breakpoints | P1 | ✅ Complete | - |
| 1.7 | Element Inspector | P2 | ✅ Complete | 1.3 |
| 1.10 | Zoom Controls | P2 | ✅ Complete | - |
| 1.8 | Error Boundary & Recovery | P1 | ✅ Complete | 1.3 |
| 1.9 | Snippet Registry | P1 | ✅ Complete | 1.4 |

### Tier 2: Odoo Domain Expertise ✅ COMPLETE
*Skills that encode Odoo knowledge*

| # | Skill | Purpose | Status |
|---|-------|---------|--------|
| 2.1 | platxa-odoo-theme | Complete theme generation (11 industry presets) | ✅ Complete |
| 2.2 | platxa-odoo-snippet | Website builder snippets (20+ templates) | ✅ Complete |
| 2.3 | platxa-odoo-validator | QWeb/manifest/SCSS/JS validation | ✅ Complete |
| 2.4 | platxa-odoo-i18n | Multi-language support (25 languages, RTL) | ✅ Complete |
| 2.5 | platxa-odoo-ecommerce | E-commerce theming | ⏳ Pending |
| 2.6 | platxa-odoo-seo | SEO optimization | ⏳ Pending |

### Tier 3: Deployment & Integration ✅ COMPLETE
*Production-ready deployment*

| # | Feature | Purpose | Status |
|---|---------|---------|--------|
| 3.1 | ZIP Export | Download theme module (JSZip, DEFLATE) | ✅ Complete |
| 3.2 | Git Integration | In-memory version control | ✅ Complete |
| 3.3 | Odoo Connection | JSON-RPC client, module deployment | ✅ Complete |
| 3.4 | Docker Deploy | Containerized deployment | ⏳ Pending |
| 3.5 | Asset Management | Images, fonts, media upload | ✅ Complete |

### Tier 4: Collaboration & Polish ✅ COMPLETE
*Team features & UX polish*

| # | Feature | Purpose | Status |
|---|---------|---------|--------|
| 4.1 | Real-time Sync (Yjs) | Multi-user editing | ✅ Exists |
| 4.2 | Project Templates | 11 industry starters | ✅ Complete |
| 4.3 | Component Library | 8 categories, 10+ snippets | ✅ Complete |
| 4.4 | History & Undo | Version timeline, snapshots | ✅ Complete |
| 4.5 | Share & Embed | Links, invites, social, embeds | ✅ Complete |

---

## Phase 1: Streaming Preview (Current Focus)

### Goal
Show live preview updates AS the AI generates code, not after completion.

### Components to Build

```
platxa-website-studio/
├── lib/
│   └── preview/
│       ├── streaming-preview-context.tsx  ← Provider
│       ├── incremental-qweb-parser.ts     ← Parser
│       ├── qweb-runtime.ts                ← Template engine
│       └── index.ts
├── hooks/
│   └── use-preview-hot-reload.ts          ← Hot reload
└── components/
    └── preview/
        ├── PreviewPanel.tsx               ← Enhanced
        ├── BreakpointIndicator.tsx        ← NEW
        ├── ElementInspector.tsx           ← NEW
        └── PreviewErrorBoundary.tsx       ← NEW
```

### Implementation Steps

1. **StreamingPreviewProvider** - React context for streaming state
2. **IncrementalQWebParser** - Parse incomplete QWeb templates
3. **ChatPanel Integration** - Feed streaming chunks to preview
4. **PreviewPanel Enhancement** - Consume streaming state
5. **Visual Polish** - Breakpoints, error handling, inspector

---

## Phase 2: Enhanced QWeb Rendering ✅ COMPLETE

### Goal
Improve QWeb template rendering accuracy for better preview fidelity.

### Key Features (All Implemented)
- ✅ t-foreach loop rendering with sample data (products, team, testimonials, etc.)
- ✅ t-if/t-else condition visualization with data attributes
- ✅ t-call template resolution with fallback placeholders
- ✅ t-esc/t-raw/t-out placeholder display with visual styling
- ✅ Odoo color class simulation (o_cc1-5) with CSS variables
- ✅ Snippet registry with 14 pre-built snippets (s_banner, s_testimonials, etc.)
- ✅ Enhanced preview placeholder styles for visual debugging
- ✅ Font Awesome icons support for snippets

---

## Phase 3: Hot Reload Integration ✅ COMPLETE

### Goal
Auto-refresh preview when files are saved in editor.

### Implementation (All Completed)
- ✅ `usePreviewHotReload` hook with debounced updates (300ms default)
- ✅ File change detection watching XML, HTML, SCSS, CSS, JS, PY files
- ✅ Smooth CSS transition animations (fade-in, flash, scale effects)
- ✅ `HotReloadIndicator` component showing pending/reloading/success states
- ✅ Status bar integration with reload count tracking
- ✅ Configurable watch patterns and callbacks

---

## Phase 4: Visual Enhancements ✅ COMPLETE

### Goal
Add lovable.dev-quality visual features.

### Features (All Implemented)
- ✅ Responsive breakpoint indicator (xs/sm/md/lg/xl/xxl)
- ✅ Element inspector overlay with hover highlighting
- ✅ CSS property inspector panel with:
  - Element path display
  - Box model visualization
  - Typography properties
  - Computed styles with copy-to-clipboard
  - Attribute inspection
- ✅ Preview error boundary with recovery
- ✅ Zoom controls (25%-200%) with presets
- ✅ Inspector toggle in toolbar
- ✅ Smooth animations for all interactions

---

## Phase 5: Odoo Snippet Simulation ✅ COMPLETE

### Goal
Render Odoo website builder snippets in standalone preview.

### Implementation (All Completed)
- ✅ Snippet registry with 14 common patterns (s_banner, s_three_columns, etc.)
- ✅ Snippet options system (colors, padding, alignment, animations)
- ✅ Placeholder image generator with SVG data URLs
- ✅ SnippetPalette component for UI with drag-and-drop
- ✅ Dynamic content placeholders with type detection
- ✅ Background gradients and shape dividers

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Streaming latency | <200ms | - |
| Hot reload time | <500ms | - |
| QWeb accuracy | >90% | - |
| Theme validation rate | >95% | - |
| Preview error recovery | 100% | - |

---

## File Structure (Current)

```
platxa-website-studio/
├── app/
│   ├── api/
│   │   ├── chat/route.ts
│   │   ├── export/route.ts        ← PENDING
│   │   ├── validate/route.ts      ← PENDING
│   │   └── deploy/route.ts        ← PENDING
│   └── studio/[projectId]/page.tsx
├── components/
│   ├── chat/
│   ├── editor/
│   ├── explorer/
│   ├── layout/
│   ├── preview/
│   │   ├── PreviewPanel.tsx       ✅ ENHANCED
│   │   ├── DeviceFrame.tsx
│   │   ├── BreakpointIndicator.tsx ✅ COMPLETE
│   │   ├── ElementInspector.tsx    ✅ COMPLETE
│   │   ├── ZoomControls.tsx        ✅ COMPLETE
│   │   ├── HotReloadIndicator.tsx  ✅ COMPLETE
│   │   ├── StreamingOverlay.tsx    ✅ COMPLETE
│   │   ├── SnippetPalette.tsx      ✅ COMPLETE
│   │   ├── PreviewErrorBoundary.tsx ✅ COMPLETE
│   │   └── index.ts
│   └── ui/
├── lib/
│   ├── ai/
│   ├── preview/                    ✅ COMPLETE
│   │   ├── streaming-preview-context.tsx
│   │   ├── incremental-qweb-parser.ts
│   │   ├── qweb-runtime.ts
│   │   ├── snippet-registry.ts
│   │   ├── snippet-options.ts      ✅ NEW
│   │   ├── placeholder-images.ts   ✅ NEW
│   │   └── index.ts
│   ├── hooks/
│   │   ├── use-preview-hot-reload.ts ✅ COMPLETE
│   │   └── index.ts
│   ├── odoo-skills/                ✅ NEW (Tier 2)
│   │   ├── types.ts                 ✅ Core type definitions
│   │   ├── theme-generator.ts       ✅ 11 industry presets
│   │   ├── snippet-builder.ts       ✅ 20+ snippet templates
│   │   ├── validator.ts             ✅ QWeb/manifest/SCSS validation
│   │   ├── i18n.ts                  ✅ 25 languages, RTL support
│   │   └── index.ts                 ✅ Public exports
│   ├── export/                      ✅ NEW (Tier 3)
│   │   └── index.ts                 ✅ JSZip export, validation
│   ├── git/                         ✅ NEW (Tier 3)
│   │   └── index.ts                 ✅ In-memory Git repository
│   ├── assets/                      ✅ NEW (Tier 3)
│   │   └── index.ts                 ✅ Asset management
│   ├── odoo-connect/                ✅ NEW (Tier 3)
│   │   └── index.ts                 ✅ Odoo JSON-RPC client
│   ├── templates/                    ✅ NEW (Tier 4)
│   │   └── project-templates.ts     ✅ 11 industry starters
│   ├── components/                   ✅ NEW (Tier 4)
│   │   └── snippet-library.ts       ✅ Pre-built snippets
│   ├── history/                      ✅ NEW (Tier 4)
│   │   └── index.ts                 ✅ Undo/redo, snapshots
│   ├── share/                        ✅ NEW (Tier 4)
│   │   └── index.ts                 ✅ Links, invites, embeds
│   ├── stores/
│   └── sync/
└── styles/
    └── globals.css                 ✅ ENHANCED
```

---

## Phase 6: Odoo Domain Skills ✅ COMPLETE

### Goal
Create production-grade TypeScript skills that encode Odoo domain expertise for AI-powered theme generation.

### Implementation (All Completed)
- ✅ **Theme Generator** (`lib/odoo-skills/theme-generator.ts`)
  - 11 industry presets (restaurant, technology, legal, healthcare, etc.)
  - Complete theme file generation (manifest, SCSS, XML, JS)
  - Typography and color palette configurations
  - Feature toggles (sticky header, mega menu, dark mode, etc.)

- ✅ **Snippet Builder** (`lib/odoo-skills/snippet-builder.ts`)
  - 20+ pre-built snippet templates by category
  - Options system for website builder customization
  - Dynamic content placeholders
  - Snippet XML generation

- ✅ **Validator** (`lib/odoo-skills/validator.ts`)
  - QWeb template validation (syntax, deprecated patterns, security)
  - Manifest validation (required fields, version format, license)
  - SCSS validation (brace matching, !important overuse)
  - JavaScript validation (Odoo module declaration, console statements)
  - File structure validation with asset reference checking

- ✅ **i18n Support** (`lib/odoo-skills/i18n.ts`)
  - 25 supported languages with full configurations
  - RTL language support (Arabic, Hebrew)
  - PO/POT file generation and parsing
  - String extraction from QWeb templates
  - Translation statistics and merge utilities

- ✅ **AI Integration** (`lib/ai/system-prompts.ts`)
  - Industry presets injected into system prompts
  - Snippet library documentation for AI context
  - Enhanced buildSystemPrompt with preset colors and typography
  - Helper functions for UI industry dropdowns

---

## Phase 7: Deployment & Integration ✅ COMPLETE

### Goal
Create production-grade deployment tools for exporting and deploying Odoo themes.

### Implementation (All Completed)
- ✅ **ZIP Export** (`lib/export/index.ts`)
  - JSZip-based ZIP creation with DEFLATE compression
  - Automatic README.md and .gitignore generation
  - Pre-export validation with error/warning reporting
  - JSON export format for API responses
  - Export statistics (file count, size, validation status)

- ✅ **Git Integration** (`lib/git/index.ts`)
  - In-memory Git repository simulation (browser-compatible)
  - Commit history with conventional commit support
  - Branch management (create, checkout, list)
  - File staging and status tracking
  - Export/import for state persistence

- ✅ **Odoo Connection** (`lib/odoo-connect/index.ts`)
  - JSON-RPC 2.0 client for Odoo API
  - Secure token provider pattern (no stored credentials)
  - Module management (install, upgrade, uninstall)
  - Theme deployment with validation
  - Version compatibility checking (17.0+)

- ✅ **Asset Management** (`lib/assets/index.ts`)
  - File upload with type validation
  - Image optimization (resize, compress, format conversion)
  - Folder organization with default structure
  - Search and tagging system
  - Base64 and File API support
  - Placeholder image generation

### API Routes
- `POST /api/export` - Export theme as ZIP download
- `GET /api/export` - Export endpoint documentation
- `POST /api/validate` - Validate theme files
- `GET /api/validate` - Validation rules documentation

---

## Phase 8: Collaboration & Polish ✅ COMPLETE

### Goal
Add team collaboration features and polish the user experience for production readiness.

### Implementation (All Completed)
- ✅ **Project Templates** (`lib/templates/project-templates.ts`)
  - 11 industry-specific starters (restaurant, tech, legal, healthcare, etc.)
  - Template categories for easy filtering
  - Template-to-ThemeConfig conversion
  - Full Odoo color palette and typography presets

- ✅ **Component Library** (`lib/components/snippet-library.ts`)
  - 8 snippet categories (hero, features, testimonials, pricing, CTA, contact, footer, stats)
  - 10+ production-ready snippets with QWeb templates
  - Snippet variants and options system
  - SCSS styles included with each snippet
  - Search and category filtering

- ✅ **History & Undo System** (`lib/history/index.ts`)
  - Full undo/redo with action recording
  - Named snapshots and auto-snapshots
  - Timeline view grouped by time periods
  - Diff comparison between versions
  - Keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
  - Branch support for experimental changes
  - Export/import for persistence

- ✅ **Share & Embed** (`lib/share/index.ts`)
  - Share links with permissions (view, comment, edit, admin)
  - Link expiration and usage limits
  - Collaboration invites with email
  - Embed code generation (iframe, script, React, Vue)
  - Social sharing URLs (Twitter, Facebook, LinkedIn, etc.)
  - Open Graph meta tag generation
  - Clipboard utilities

---

## Next Steps

1. ✅ Create this master plan
2. ✅ Implement Phase 1: Streaming Preview (Complete)
   - StreamingPreviewProvider
   - IncrementalQWebParser
   - Chat Integration
   - Preview Enhancement
3. ✅ Implement Phase 2: Enhanced QWeb Runtime (Complete)
   - QWebRuntime class with full directive support
   - Snippet registry with 14 templates
   - Sample data generators
   - Visual preview placeholders
4. ✅ Implement Phase 3: Hot Reload System (Complete)
   - usePreviewHotReload hook
   - Debounced file change detection
   - Smooth transition animations
   - HotReloadIndicator component
5. ✅ Implement Phase 4: Visual Enhancements (Complete)
   - Element inspector with CSS property panel
   - Zoom controls (25%-200%)
   - Box model visualization
   - Inspector toggle in toolbar
6. ✅ Implement Phase 5: Odoo Snippet Simulation (Complete)
   - Snippet options (colors, padding, alignment)
   - Placeholder image generator
   - SnippetPalette component
   - Image URL replacement with SVG placeholders
7. ✅ Implement Phase 6: Odoo Domain Skills (Complete)
   - Theme generator with 11 industry presets
   - Snippet builder with 20+ templates
   - Production-grade validation
   - Multi-language i18n support (25 languages)
   - AI system prompt integration
8. ✅ Implement Tier 3: Deployment & Integration (Complete)
   - ZIP Export with JSZip (DEFLATE compression)
   - Git integration (in-memory repository)
   - Odoo JSON-RPC connection
   - Asset management system
9. ✅ Implement Tier 4: Collaboration & Polish (Complete)
   - Project templates (11 industry starters)
   - Component library (8 categories, 10+ snippets)
   - History & undo system with snapshots
   - Share & embed functionality
10. ⏳ Test & iterate
11. ⏳ Remaining features: E-commerce theming, SEO optimization, Docker deploy

---

*Last Updated: 2026-01-24 (Tier 4 Complete)*
*Author: Claude Code*
