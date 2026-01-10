# Platxa Frontend Agent

AI-powered frontend design agent that generates beautiful, production-ready UI components using cutting-edge tools and techniques.

## Overview

Platxa Frontend Agent transforms natural language descriptions into stunning React components with:

- **shadcn/ui + Radix UI** for accessible, customizable components
- **Tailwind CSS v4** with CSS-first theming and OKLCH colors
- **Framer Motion** for smooth animations and micro-interactions
- **TypeScript** with strict mode for type safety

## Features

- **85 Implementation Features** across 14 categories
- **Orchestrator-Workers Pattern** for complex UI decomposition
- **Design System Enforcement** (60-30-10 color rule, 8px grid, typography scale)
- **WCAG 2.2 Accessibility** built-in
- **Dark Mode** with semantic tokens

## Quick Start

```bash
# Use with Claude Code
claude "Create a beautiful pricing page with three tiers"

# Or use the skill directly
/platxa-frontend-agent "Build a dashboard with sidebar navigation"
```

## Architecture

```
User Request → Orchestrator Agent
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Design          Component       Animation
Analyzer        Generator       Worker
    ↓               ↓               ↓
    └───────────────┼───────────────┘
                    ↓
            Theme Worker → Accessibility Auditor
                    ↓
            Generated Components
```

## Categories

| Category | Features | Description |
|----------|----------|-------------|
| Core Architecture | 6 | Orchestrator and worker agents |
| Prompting System | 4 | Structured prompt templates |
| Component Generation | 5 | shadcn/ui, Radix, CVA patterns |
| Design System | 8 | Colors, typography, spacing |
| Theming | 5 | CSS variables, dark mode |
| Accessibility | 7 | WCAG 2.2 compliance |
| Animation | 8 | Framer Motion patterns |
| Modern CSS | 6 | Container queries, :has() |
| Component Library | 11 | Button, Card, Modal, etc. |
| Page Sections | 8 | Hero, Pricing, Dashboard |
| AI Features | 5 | Image analysis, AutoFix |
| Performance | 4 | INP optimization, lazy loading |
| Quality | 6 | Scoring, TypeScript strict |
| Developer Experience | 2 | Preview, hot reload |

## Tech Stack

- **React 18** + TypeScript
- **Tailwind CSS v4** with @theme directive
- **shadcn/ui** + Radix UI primitives
- **Framer Motion** for animations
- **CVA** (Class Variance Authority) for variants
- **clsx + tailwind-merge** via cn() utility

## Project Structure

```
platxa-frontend-agent/
├── .claude/
│   ├── agents/                    # Agent definitions
│   │   ├── frontend-orchestrator.md
│   │   ├── design-analyzer.md
│   │   ├── component-generator.md
│   │   ├── animation-worker.md
│   │   ├── theme-worker.md
│   │   └── accessibility-auditor.md
│   └── skills/
│       └── platxa-frontend-agent/
│           ├── SKILL.md           # Skill entry point
│           ├── scripts/           # Python/TypeScript utilities
│           ├── templates/         # Component templates
│           ├── docs/              # Documentation
│           └── references/        # Design system references
├── src/                           # Generated component output
├── tests/                         # Test suite
└── README.md
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Design System Reference](docs/design-system.md)
- [Component Patterns](docs/component-patterns.md)
- [Animation Guide](docs/animation-guide.md)

## License

Proprietary - Copyright (c) 2026 Platxa. All Rights Reserved.
