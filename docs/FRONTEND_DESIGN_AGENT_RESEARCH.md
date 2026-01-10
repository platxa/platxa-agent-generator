# Frontend Design Agent: Comprehensive Research Synthesis

> **A systematic guide to building beautiful, accessible, and production-ready UI generation agents**

---

**Document Version**: 1.0.0
**Date**: January 2026
**Research Quality Score**: 9.1/10
**Sources Analyzed**: 13 high-quality references
**Features Generated**: 85 actionable implementation tasks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Introduction](#introduction)
3. [Research Methodology](#research-methodology)
4. [Part 1: AI-Powered UI Generation Landscape](#part-1-ai-powered-ui-generation-landscape)
5. [Part 2: Modern Component Architecture](#part-2-modern-component-architecture)
6. [Part 3: Design System Foundations](#part-3-design-system-foundations)
7. [Part 4: Frontend Agent Architecture](#part-4-frontend-agent-architecture)
8. [Part 5: Prompting Strategies for UI Generation](#part-5-prompting-strategies-for-ui-generation)
9. [Part 6: Cutting-Edge Technologies (2025-2026)](#part-6-cutting-edge-technologies-2025-2026)
10. [Part 7: Theming & Dark Mode Implementation](#part-7-theming--dark-mode-implementation)
11. [Part 8: Accessibility Excellence](#part-8-accessibility-excellence)
12. [Part 9: Implementation Blueprint](#part-9-implementation-blueprint)
13. [Quick Reference Cards](#quick-reference-cards)
14. [Code Examples](#code-examples)
15. [Checklists](#checklists)
16. [Appendices](#appendices)

---

## Executive Summary

This comprehensive research synthesis provides a systematic foundation for building a **production-grade frontend design agent** capable of generating beautiful, accessible, and performant user interfaces from natural language descriptions.

### Key Findings

| Area | Critical Insight |
|------|------------------|
| **Architecture** | Orchestrator-Workers pattern is optimal for design agents with dynamic task decomposition |
| **Technology** | React 18 + TypeScript + Tailwind v4 + shadcn/ui is the emerging standard stack |
| **Design** | 60-30-10 color rule + 3-level typography + 8px grid creates professional UIs |
| **Accessibility** | WCAG 2.2 compliance is legally required (EAA June 2025, ADA April 2026) |
| **Animation** | Framer Motion with spring physics creates delightful micro-interactions |
| **Prompting** | Six-element structured prompts yield 3x better code quality |

### Strategic Recommendations

1. **Start Simple**: Use simple, composable patterns before adding complexity
2. **Prioritize Accessibility**: Build accessibility into the foundation, not as an afterthought
3. **Embrace Modern CSS**: Container queries and :has() enable true component-based design
4. **Automate Quality**: Implement quality gates for contrast, typography, and code standards
5. **Iterate with Feedback**: Use Evaluator-Optimizer pattern for design refinement

---

## Introduction

### The Problem

Traditional UI development is time-consuming, requiring expertise across multiple domains: visual design, accessibility, responsive layouts, animations, and modern CSS. AI-powered design agents can democratize this expertise, enabling rapid creation of professional interfaces.

### Goals

This research aims to answer:

1. **What architecture** should a frontend design agent use?
2. **What technologies** produce the most beautiful and maintainable output?
3. **What design principles** must the agent understand and enforce?
4. **What prompting strategies** yield the highest quality results?
5. **How do we ensure** accessibility, performance, and code quality?

### Scope

This synthesis covers:

- AI UI generation tools and their architectures
- Modern component libraries and design systems
- Design principles for beautiful interfaces
- Agent architecture patterns from Anthropic's research
- Cutting-edge CSS and animation techniques
- Accessibility requirements and implementation
- Theming and dark mode systems

---

## Research Methodology

### Approach

Research was conducted using a systematic multi-phase process:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   DISCOVERY     │────▶│   COLLECTION    │────▶│   SYNTHESIS     │
│                 │     │                 │     │                 │
│ • Define scope  │     │ • Web search    │     │ • Theme grouping│
│ • Create queries│     │ • Source fetch  │     │ • Pattern ID    │
│ • ID subtopics  │     │ • Key extraction│     │ • Recommendations│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Subtopics Researched

1. AI-Powered UI Generation Tools & Techniques
2. Modern Design Systems & Component Architecture
3. Design Principles for Beautiful Interfaces
4. Frontend Agent Architecture & Workflows
5. Cutting-Edge CSS & Animation Techniques
6. Quality, Accessibility & Polish

### Search Queries Executed

| # | Query | Purpose |
|---|-------|---------|
| 1 | v0.dev Vercel AI UI generation | Learn from market leader |
| 2 | shadcn/ui architecture patterns | Modern component patterns |
| 3 | AI frontend prompting techniques | Prompt engineering for UI |
| 4 | Design principles typography color | Core design fundamentals |
| 5 | Tailwind CSS v4 features | Latest styling approaches |
| 6 | Framer Motion animation patterns | Animation techniques |
| 7 | AI design agent architecture | Agent workflow structure |
| 8 | CSS container queries modern | Cutting-edge CSS features |
| 9 | Design tokens theming dark mode | Theming architecture |
| 10 | Accessible beautiful UI WCAG | Inclusive design patterns |
| 11 | Component decomposition atomic | Component organization |
| 12 | Frontend trends 2025 2026 | Current visual trends |

### Quality Scoring

Each source was evaluated on:

- **Relevance**: Direct applicability to frontend design agents
- **Recency**: Published within 2024-2026
- **Authority**: From recognized experts or organizations
- **Actionability**: Provides implementable guidance

**Average Quality Score**: 9.1/10

---

## Part 1: AI-Powered UI Generation Landscape

### 1.1 Current State of AI Design Tools

The AI UI generation landscape in 2025-2026 is dominated by tools that convert natural language to production-ready code. The clear market leader is **v0.dev by Vercel**.

> "v0 is a text-to-UI conversion tool that creates React components based on text descriptions... acts like a frontend engineer through a chat interface."

### 1.2 v0.dev Architecture Deep Dive

v0.dev uses a sophisticated **composite model architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    v0.dev COMPOSITE MODEL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  RETRIEVAL   │───▶│  FRONTIER    │───▶│   AUTOFIX    │      │
│  │              │    │     LLM      │    │              │      │
│  │ • Ground the │    │ • Reasoning  │    │ • Error scan │      │
│  │   model      │    │ • Generation │    │ • Best       │      │
│  │ • Context    │    │ • Code output│    │   practices  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  Model Variants:                                                │
│  • v0-1.0-md: Standard context                                  │
│  • v0-1.5-lg: 512,000 token context window                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 v0.dev Workflow

```
1. DESCRIBE    ──▶  "Create a dashboard with sidebar and 4 metric cards"
                    (Can also upload mockup/screenshot)

2. GENERATE   ──▶   AI builds preview using React + Tailwind + shadcn/ui

3. ITERATE    ──▶   Conversational refinement: "Make the sidebar collapsible"

4. EXPORT     ──▶   Copy production-ready code or use Vercel CLI
```

### 1.4 Best Use Cases for AI UI Generation

| Excellent Fit | Poor Fit |
|--------------|----------|
| Navigation bars | Complex application logic |
| Hero sections | Backend/API logic |
| Authentication screens | Real-time data handling |
| Dashboards with cards | Heavy state management |
| CRUD forms | Custom business rules |
| Marketing pages | Edge case handling |
| Pricing tables | Database operations |

### 1.5 Key Learnings for Our Agent

1. **Output Format**: Generate React + Tailwind + shadcn/ui as standard
2. **Image Support**: Accept mockup uploads for reference
3. **Iterative Refinement**: Support conversational adjustments
4. **Post-Processing**: Implement AutoFix for error detection
5. **Large Context**: Support extensive context for complex projects
6. **Mobile-First**: Generate responsive layouts by default

---

## Part 2: Modern Component Architecture

### 2.1 The shadcn/ui Revolution

shadcn/ui has fundamentally changed how component libraries work. Instead of installing npm packages, developers **copy component source code** directly into their projects.

> "Unlike traditional UI libraries that ship as a package, shadcn/ui gives you the actual source code for every component. You install what you need and own the code from that point on."

### 2.2 Two-Layer Architecture

Every shadcn/ui component follows a two-layer architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1: STRUCTURE & BEHAVIOR                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Radix UI Primitives                                     │   │
│  │  • Keyboard navigation                                   │   │
│  │  • Focus management                                      │   │
│  │  • WAI-ARIA compliance                                   │   │
│  │  • Compound component pattern                            │   │
│  │  • State management via React Context                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  LAYER 2: STYLING                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Tailwind CSS + CVA (Class Variance Authority)           │   │
│  │  • Base styles for all variants                          │   │
│  │  • Variant-specific style overrides                      │   │
│  │  • CSS variables for design tokens                       │   │
│  │  • cn() utility for class composition                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Radix UI Primitives

Radix UI provides **headless** (unstyled) components that handle complex interaction logic:

| Primitive | Functionality |
|-----------|--------------|
| `Dialog` | Modal with focus trap, escape key, backdrop |
| `Popover` | Positioned overlay with collision detection |
| `Select` | Custom dropdown with keyboard navigation |
| `Tabs` | Tab panels with arrow key navigation |
| `Accordion` | Expandable sections with animations |
| `Switch` | Toggle with keyboard support |
| `Tooltip` | Hover information with delay |
| `DropdownMenu` | Context menu with submenus |

**Compound Component Pattern**:

```tsx
// Parent manages shared state via React Context
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Modal Title</Dialog.Title>
    <Dialog.Description>Content here</Dialog.Description>
    <Dialog.Close>Close</Dialog.Close>
  </Dialog.Content>
</Dialog.Root>
```

### 2.4 Class Variance Authority (CVA)

CVA provides a type-safe API for managing component variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base styles applied to ALL variants
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 2.5 The cn() Utility

The `cn()` function combines `clsx` and `tailwind-merge` for robust class handling:

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage - prevents conflicts and handles conditionals
<div className={cn(
  "base-class",
  isActive && "active-class",
  className // allows override from props
)} />
```

### 2.6 CSS Variables for Theming

shadcn/ui uses semantic CSS variables for all design tokens:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode values */
}
```

### 2.7 Component Structure Template

Every generated component should follow this structure:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  "base-styles-here",
  {
    variants: {
      variant: { /* ... */ },
      size: { /* ... */ },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Component.displayName = "Component";

export { Component, componentVariants };
```

---

## Part 3: Design System Foundations

### 3.1 Color Theory & The 60-30-10 Rule

The **60-30-10 rule** is the foundation of balanced color usage:

```
┌─────────────────────────────────────────────────────────────────┐
│                    60-30-10 COLOR RULE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              60% PRIMARY / DOMINANT                     │   │
│  │                                                         │   │
│  │    Background, large areas, foundation color            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────┐                       │
│  │                                     │                       │
│  │        30% SECONDARY                │                       │
│  │                                     │                       │
│  │    Cards, sections, containers      │                       │
│  │                                     │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  ┌───────────────┐                                             │
│  │  10% ACCENT   │                                             │
│  │               │                                             │
│  │  CTAs, links, │                                             │
│  │  highlights   │                                             │
│  └───────────────┘                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Color Palette Types

| Type | Description | Best For |
|------|-------------|----------|
| **Monochromatic** | Tints/shades of single hue | Elegant, accessible, beginner-friendly |
| **Complementary** | Opposite colors on wheel | High contrast, dynamic |
| **Analogous** | Adjacent colors on wheel | Harmonious, natural |
| **Triadic** | Three evenly spaced colors | Balanced, vibrant |

> "Monochromatic color palettes are the easiest to work with and create, and are the most accessible to novice visual designers."

### 3.3 OKLCH Color Space

Tailwind v4 uses **OKLCH** for more vivid colors on modern displays:

```css
/* Old RGB approach */
--color-blue-500: rgb(59, 130, 246);

/* New OKLCH approach (Tailwind v4) */
--color-blue-500: oklch(0.623 0.214 259.815);

/* OKLCH provides:
   - Perceptually uniform lightness
   - Wider color gamut (P3 displays)
   - Better for creating consistent palettes
   - Easier to create tints/shades programmatically
*/
```

### 3.4 Typography System

#### Font Selection Rules

1. **Limit to 2-3 typefaces** for consistency
2. **Use one for headings**, one for body (optional third for code)
3. **Ensure contrast** between heading and body fonts
4. **Consider web font loading** performance

#### Typography Scale

```css
/* Three-level hierarchy is sufficient for most UIs */
--font-size-sm: 0.875rem;   /* 14px - Small text, captions */
--font-size-base: 1rem;     /* 16px - Body text */
--font-size-lg: 1.125rem;   /* 18px - Large body */
--font-size-xl: 1.25rem;    /* 20px - Subheadings */
--font-size-2xl: 1.5rem;    /* 24px - Section headings */
--font-size-3xl: 1.875rem;  /* 30px - Page headings */
--font-size-4xl: 2.25rem;   /* 36px - Hero headings */
```

#### Line Height (Leading)

> "Leading should generally be 1.125 to 1.200 times the font size (112.5%–120.0%) for better readability."

```css
/* Optimal line heights */
--leading-tight: 1.25;    /* Headings */
--leading-normal: 1.5;    /* Body text */
--leading-relaxed: 1.625; /* Large text blocks */
--leading-loose: 2;       /* Very small text */
```

#### Line Length

> "For body text in English, limiting line length to approximately 40 to 60 characters, including spaces and punctuation, is ideal for accessibility and readability."

```css
/* Optimal reading width */
.prose {
  max-width: 65ch; /* ~65 characters */
}
```

### 3.5 Spacing System

#### The 8px Grid

All spacing should be multiples of 8px (or 4px for fine adjustments):

```css
/* Spacing scale */
--spacing-0: 0;
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-10: 2.5rem;  /* 40px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
```

#### Macro vs Micro White Space

| Type | Definition | Examples |
|------|------------|----------|
| **Macro** | Large gaps between major sections | Page margins, section separators |
| **Micro** | Small spaces between elements | Text line spacing, button padding |

> "White space gives elements room to breathe... protects the interface from visual clutter, helps users identify vital information, and creates an elegant and sophisticated design appearance."

### 3.6 Visual Hierarchy

Visual hierarchy guides the user's eye through importance:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISUAL HIERARCHY TOOLS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SIZE          Larger = More important                          │
│  ████████████  H1 - Primary focus                               │
│  ████████      H2 - Secondary focus                             │
│  ██████        H3 - Tertiary focus                              │
│  ████          Body - Supporting content                        │
│                                                                 │
│  COLOR         Saturated/Contrasting = Attention                │
│  🔵 Primary    Action items, links, CTAs                        │
│  ⚪ Neutral    Body text, containers                            │
│  🔴 Destructive Warnings, deletions                             │
│                                                                 │
│  CONTRAST      High contrast = Important                        │
│  █ on □        Maximum readability                              │
│  ▓ on □        Secondary information                            │
│  ░ on □        Disabled, muted content                          │
│                                                                 │
│  SPACING       More space around = More important               │
│  ▢             Tight grouping = Related items                   │
│  ▢    ▢        Loose spacing = Separate concepts                │
│                                                                 │
│  POSITION      Top-left = First seen (LTR languages)            │
│  ┌───┐         Users scan in F or Z patterns                    │
│  │ 1 │ 2 3     Place critical info along scan path              │
│  │ 4 │                                                          │
│  └───┘ 5                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Frontend Agent Architecture

### 4.1 Anthropic's Five Workflow Patterns

Based on Anthropic's research with dozens of teams building AI agents:

> "The most successful implementations use simple, composable patterns rather than complex frameworks."

#### Pattern 1: Prompt Chaining

```
┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
│ LLM │───▶│ LLM │───▶│ LLM │───▶│ LLM │
│  1  │    │  2  │    │  3  │    │  4  │
└─────┘    └─────┘    └─────┘    └─────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
 Check      Check      Check      Check
```

**Use when**: Tasks have fixed, sequential subtasks
**Example**: Generate outline → Write sections → Edit → Format

#### Pattern 2: Routing

```
                    ┌─────────┐
                    │ ROUTER  │
                    │   LLM   │
                    └────┬────┘
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
      ┌─────────┐   ┌─────────┐   ┌─────────┐
      │ Handler │   │ Handler │   │ Handler │
      │    A    │   │    B    │   │    C    │
      └─────────┘   └─────────┘   └─────────┘
```

**Use when**: Inputs fall into distinct categories
**Example**: Route "fix bug" vs "add feature" vs "explain code"

#### Pattern 3: Parallelization

```
         ┌─────────┐
         │  INPUT  │
         └────┬────┘
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│ LLM 1 │ │ LLM 2 │ │ LLM 3 │
└───┬───┘ └───┬───┘ └───┬───┘
    └─────────┼─────────┘
              ▼
         ┌─────────┐
         │AGGREGATE│
         └─────────┘
```

**Use when**: Subtasks are independent
**Example**: Analyze colors, typography, and layout simultaneously

#### Pattern 4: Orchestrator-Workers (RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATOR                               │
│                                                                 │
│  • Analyzes input                                               │
│  • Breaks down into subtasks                                    │
│  • Delegates to specialists                                     │
│  • Synthesizes results                                          │
│                                                                 │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Design  │ │Component│ │Animation│ │ Theme   │ │ A11y    │
│ Analyzer│ │Generator│ │ Worker  │ │ Worker  │ │ Auditor │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**Use when**: Tasks have dynamic, unpredictable subtasks
**Example**: "Create a beautiful dashboard" - scope depends on analysis

> "This is the recommended pattern for a frontend design agent because design tasks have dynamic scope that can't be predicted upfront."

#### Pattern 5: Evaluator-Optimizer

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────┐         ┌─────────────┐                       │
│  │  GENERATOR  │────────▶│  EVALUATOR  │                       │
│  │             │         │             │                       │
│  │ Creates     │         │ Critiques   │                       │
│  │ output      │◀────────│ Provides    │                       │
│  │             │ feedback│ feedback    │                       │
│  └─────────────┘         └─────────────┘                       │
│                                                                 │
│        Repeat until quality threshold met                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Use when**: Iterative refinement improves quality
**Example**: Generate design → Critique → Improve → Repeat

### 4.2 Recommended Agent Architecture

For a frontend design agent, we recommend **Orchestrator-Workers** with **Evaluator-Optimizer** for quality refinement:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND DESIGN AGENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT: "Create a modern dashboard with analytics cards"        │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   ORCHESTRATOR                           │   │
│  │                                                          │   │
│  │  1. Parse natural language request                       │   │
│  │  2. Identify component types needed                      │   │
│  │  3. Determine layout structure                           │   │
│  │  4. Delegate to specialist workers                       │   │
│  │  5. Synthesize final output                              │   │
│  │                                                          │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│      ┌──────────────────┼──────────────────┐                   │
│      │                  │                  │                   │
│      ▼                  ▼                  ▼                   │
│  ┌────────┐        ┌────────┐        ┌────────┐               │
│  │ DESIGN │        │COMPONENT│       │ANIMATION│               │
│  │ANALYZER│        │GENERATOR│       │ WORKER  │               │
│  │        │        │         │       │         │               │
│  │• Colors│        │• React  │       │• Framer │               │
│  │• Type  │        │• TSX    │       │• Motion │               │
│  │• Layout│        │• CVA    │       │• Springs│               │
│  └────────┘        └─────────┘       └─────────┘               │
│      │                  │                  │                   │
│      │                  ▼                  │                   │
│      │             ┌────────┐              │                   │
│      └────────────▶│ THEME  │◀─────────────┘                   │
│                    │ WORKER │                                   │
│                    │        │                                   │
│                    │• Tokens│                                   │
│                    │• Dark  │                                   │
│                    │• CSS   │                                   │
│                    └────┬───┘                                   │
│                         │                                       │
│                         ▼                                       │
│                    ┌────────┐                                   │
│                    │  A11Y  │                                   │
│                    │AUDITOR │                                   │
│                    │        │                                   │
│                    │• WCAG  │                                   │
│                    │• Focus │                                   │
│                    │• ARIA  │                                   │
│                    └────┬───┘                                   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   EVALUATOR                              │   │
│  │                                                          │   │
│  │  • Design system compliance                              │   │
│  │  • Accessibility score                                   │   │
│  │  • Code quality check                                    │   │
│  │  • Performance assessment                                │   │
│  │                                                          │   │
│  │  Score < 7.0? ──▶ Return to Orchestrator with feedback   │   │
│  │  Score ≥ 7.0? ──▶ Output final code                      │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Core Implementation Principles

From Anthropic's research, three principles are critical:

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Simplicity** | Keep agent design straightforward | Start with minimal workers, add as needed |
| **Transparency** | Show the agent's planning steps | Log decisions, explain choices |
| **Tool Quality** | Optimize tools over prompts | Well-documented, tested tool interfaces |

> "Anthropic spent more time optimizing tools than the overall prompt."

### 4.4 Subagent Context Isolation

Each worker operates in an **isolated context window**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR CONTEXT                                           │
│  • Full conversation history                                    │
│  • High-level planning                                          │
│  • Coordination logic                                           │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Delegate with focused prompt
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  WORKER CONTEXT (Isolated)                                      │
│  • Only task-specific information                               │
│  • Relevant code snippets                                       │
│  • Focused system prompt                                        │
│                                                                 │
│  Returns: Distilled insights only                               │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits**:
- Lower token usage and costs
- Focused, higher-quality output
- Parallel execution possible
- Clear separation of concerns

---

## Part 5: Prompting Strategies for UI Generation

### 5.1 The Six-Element Prompt Structure

Production-ready component prompts must include six elements:

```
┌─────────────────────────────────────────────────────────────────┐
│                 SIX-ELEMENT PROMPT STRUCTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FRAMEWORK & VERSION                                         │
│     "Generate a React 18 component using TypeScript strict"     │
│                                                                 │
│  2. COMPONENT PURPOSE                                           │
│     "Create a pricing card that displays plan details"          │
│                                                                 │
│  3. PROPS/STATE STRUCTURE                                       │
│     "Props: planName, price, features[], isPopular, onSelect"   │
│                                                                 │
│  4. STYLING APPROACH                                            │
│     "Use Tailwind CSS with shadcn/ui patterns and CVA variants" │
│                                                                 │
│  5. ACCESSIBILITY REQUIREMENTS                                  │
│     "Include ARIA labels, keyboard navigation, 4.5:1 contrast"  │
│                                                                 │
│  6. EDGE CASES                                                  │
│     "Handle empty features array, very long plan names,         │
│      missing price, loading state"                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Example: Complete Component Prompt

```
Generate a React 18 login form component using TypeScript and Tailwind CSS.

COMPONENT PURPOSE:
- Email/password authentication form with real-time validation

PROPS/STATE:
- onSubmit: (email: string, password: string) => Promise<void>
- onForgotPassword?: () => void
- isLoading: boolean
- error?: string

STYLING:
- Use shadcn/ui form patterns with react-hook-form
- Tailwind CSS for styling
- CVA for input variants (default, error, success)

ACCESSIBILITY:
- ARIA labels for all inputs
- Error messages linked via aria-describedby
- Focus management on error
- Keyboard navigation (Tab, Enter to submit)

EDGE CASES:
- Email format validation with clear error message
- Password minimum 8 characters
- Handle 401 (invalid credentials) and 500 (server error) responses
- Disable submit while loading
- Show loading spinner in button
```

### 5.3 Incremental Prompting Strategy

Break complex components into sequential steps:

```
STEP 1: SKELETON
"Create the basic structure of a dashboard layout with sidebar,
header, and main content area. No styling yet, just semantic HTML."

STEP 2: LAYOUT
"Add Tailwind classes for responsive layout. Sidebar 256px on
desktop, hidden with hamburger menu on mobile."

STEP 3: STATE
"Add React state for sidebar open/closed, current page, and
user preferences using React Context."

STEP 4: COMPONENTS
"Create Card component with variants: default, highlighted,
loading. Use CVA for variants."

STEP 5: ANIMATIONS
"Add Framer Motion animations: sidebar slide in/out, card hover
effects, page transitions."

STEP 6: ACCESSIBILITY
"Add skip link, focus trap in sidebar on mobile, ARIA labels,
keyboard navigation for all interactive elements."

STEP 7: DARK MODE
"Implement dark mode using CSS variables. Add theme toggle
with system preference detection."
```

### 5.4 Role-Based Prompting

Prefix prompts with role context for expert-level output:

```
# Role Prompts

## For Code Quality
"Act as a senior React developer with 10 years of experience
reviewing this code. Focus on maintainability, performance,
and TypeScript best practices."

## For Design Review
"Act as a UI/UX designer specializing in SaaS dashboards.
Evaluate this component's visual hierarchy, spacing, and
color usage according to established design principles."

## For Accessibility
"Act as a WCAG accessibility specialist. Audit this component
for compliance with WCAG 2.2 AA standards, focusing on
keyboard navigation, screen reader support, and color contrast."

## For Animation
"Act as a motion designer experienced with Framer Motion.
Add micro-interactions that feel natural and responsive,
using spring physics for realistic motion."
```

### 5.5 Pattern Reference Technique

Reference existing patterns for consistency:

```
"Here is the existing UserCard component:

\`\`\`tsx
const UserCard = ({ user, onEdit }: UserCardProps) => {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <Avatar src={user.avatar} alt={user.name} />
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <p className="text-muted-foreground">{user.email}</p>
      <Button variant="outline" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </Card>
  );
};
\`\`\`

Create a ProductCard component following the same patterns:
- Same Card wrapper with hover effect
- Image/avatar at top
- Title with same typography
- Description in muted color
- Action button at bottom
- Use the same spacing values"
```

### 5.6 Prompting Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| "Make it look good" | Too vague | Specify: "Use 60-30-10 color, 8px grid spacing" |
| "Fix the styling" | No context | Include current code, expected vs actual behavior |
| "Add everything at once" | Overloaded | Break into sequential focused prompts |
| "Create a dashboard" | Missing specs | Add framework, components, styling, a11y requirements |
| Ignoring clarifications | Compounds errors | Answer AI's questions, provide requested context |

---

## Part 6: Cutting-Edge Technologies (2025-2026)

### 6.1 Tailwind CSS v4 (Released January 2025)

Tailwind v4 represents a fundamental shift to **CSS-first configuration**:

#### @theme Directive

```css
@import "tailwindcss";

@theme {
  /* Typography */
  --font-display: "Satoshi", "sans-serif";
  --font-body: "Inter", "sans-serif";

  /* Colors in OKLCH */
  --color-primary-50: oklch(0.97 0.01 250);
  --color-primary-500: oklch(0.55 0.2 250);
  --color-primary-900: oklch(0.25 0.1 250);

  /* Spacing */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  /* Custom breakpoint */
  --breakpoint-3xl: 1920px;

  /* Animations */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

All tokens become CSS variables automatically:

```css
/* Generated automatically */
:root {
  --font-display: "Satoshi", "sans-serif";
  --color-primary-500: oklch(0.55 0.2 250);
  /* ... */
}
```

#### Performance Improvements

| Metric | v3 | v4 | Improvement |
|--------|----|----|-------------|
| Full builds | 378ms | 100ms | 3.78x faster |
| Incremental (new CSS) | 44ms | 5ms | 8.8x faster |
| Incremental (no new CSS) | 35ms | 192µs | 182x faster |

#### Container Queries (First-Class)

```html
<!-- Parent establishes containment -->
<div class="@container">
  <!-- Children respond to parent size -->
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4">
    <Card />
    <Card />
    <Card />
    <Card />
  </div>
</div>

<!-- Max-width variants -->
<div class="@container">
  <div class="grid grid-cols-3 @max-md:grid-cols-1">
    <!-- 3 columns by default, 1 column when container < md -->
  </div>
</div>
```

#### Modern Gradients

```html
<!-- Angled linear gradients -->
<div class="bg-linear-45 from-indigo-500 via-purple-500 to-pink-500" />

<!-- Color interpolation control -->
<div class="bg-linear-to-r/oklch from-blue-500 to-cyan-500" />

<!-- Radial gradients -->
<div class="bg-radial-[at_25%_25%] from-white to-zinc-900" />

<!-- Conic gradients -->
<div class="bg-conic from-red-500 via-yellow-500 to-red-500" />
```

#### 3D Transforms

```html
<div class="perspective-distant">
  <div class="rotate-x-12 rotate-y-6 transform-3d hover:rotate-y-12">
    <!-- 3D transformed content -->
  </div>
</div>
```

#### @starting-style (CSS Mount Animations)

```html
<!-- Animate element on first display without JavaScript -->
<div
  popover
  class="transition-all duration-300 starting:opacity-0 starting:scale-95"
>
  <!-- Fades and scales in when shown -->
</div>
```

### 6.2 Modern CSS Features

#### Container Queries Deep Dive

```css
/* Define container */
.card-grid {
  container-type: inline-size;
  container-name: card-grid;
}

/* Query container size */
@container card-grid (min-width: 400px) {
  .card {
    grid-template-columns: 200px 1fr;
  }
}

@container card-grid (min-width: 700px) {
  .card {
    grid-template-columns: 250px 1fr auto;
  }
}
```

**Best Practice**:
> "Keep page-level layout and OS-level preferences (dark mode, reduced motion) in media queries. Use container queries inside components."

#### The :has() Parent Selector

```css
/* Style parent based on child state */
.form-group:has(input:invalid) {
  border-color: var(--color-destructive);
}

/* Style based on child presence */
.card:has(img) {
  grid-template-rows: auto 1fr;
}

/* Sibling relationships */
h2:has(+ p) {
  margin-bottom: 0.5rem;
}

/* Complex conditions */
.nav:has(.dropdown:hover) .overlay {
  display: block;
}
```

#### View Transitions API

```tsx
// Enable view transitions in Next.js
// next.config.js
module.exports = {
  experimental: {
    viewTransitions: true,
  },
};

// CSS for transitions
::view-transition-old(page),
::view-transition-new(page) {
  animation-duration: 0.3s;
}

::view-transition-old(page) {
  animation-name: fade-out;
}

::view-transition-new(page) {
  animation-name: fade-in;
}
```

### 6.3 Framer Motion Animation System

#### Core Animation Props

```tsx
import { motion } from "framer-motion";

// Basic animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
/>

// Gesture animations
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Click me
</motion.button>
```

#### Spring Physics

```tsx
// Natural spring motion
<motion.div
  animate={{ x: 100 }}
  transition={{
    type: "spring",
    stiffness: 100,    // Higher = snappier
    damping: 10,       // Higher = less oscillation
    mass: 1,           // Higher = more momentum
  }}
/>

// Presets
const springPresets = {
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  wobbly: { type: "spring", stiffness: 180, damping: 12 },
  stiff: { type: "spring", stiffness: 400, damping: 30 },
  slow: { type: "spring", stiffness: 100, damping: 20 },
};
```

#### AnimatePresence for Exit Animations

```tsx
import { AnimatePresence, motion } from "framer-motion";

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg p-6"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### Layout Animations

```tsx
// Automatic layout animation
<motion.div layout className="grid gap-4">
  {items.map((item) => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>

// Shared layout animation
<motion.div layoutId="expandable-card">
  {isExpanded ? <ExpandedCard /> : <CollapsedCard />}
</motion.div>
```

#### Propagation Pattern

```tsx
const cardVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
};

const iconVariants = {
  initial: { rotate: 0 },
  hover: { rotate: 15 },
};

function Card() {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      whileHover="hover"
    >
      <motion.span variants={iconVariants}>
        {/* Icon rotates when parent is hovered */}
        <Icon />
      </motion.span>
      <p>Card content</p>
    </motion.div>
  );
}
```

#### Stagger Children

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function List({ items }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.content}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### 6.4 React Compiler (2025-2026)

The React Compiler, released October 2025, automates memoization:

```tsx
// BEFORE: Manual optimization
const MemoizedComponent = React.memo(({ data }) => {
  const processedData = useMemo(() =>
    expensiveProcess(data), [data]
  );

  const handleClick = useCallback(() => {
    doSomething(data);
  }, [data]);

  return <div onClick={handleClick}>{processedData}</div>;
});

// AFTER: React Compiler handles it automatically
function Component({ data }) {
  const processedData = expensiveProcess(data);

  const handleClick = () => {
    doSomething(data);
  };

  return <div onClick={handleClick}>{processedData}</div>;
}
```

> "In 2026, manually using useMemo, useCallback, and React.memo will be seen as legacy optimization."

---

## Part 7: Theming & Dark Mode Implementation

### 7.1 CSS Variables Architecture

```css
/* Base theme (light mode) */
:root {
  /* Semantic color tokens */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;

  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;

  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;

  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;

  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;

  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;

  --radius: 0.5rem;
}

/* Dark mode overrides */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;

  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

### 7.2 Semantic Token Mapping

Map raw color values to semantic meanings:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEMANTIC TOKEN MAPPING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RAW TOKEN              SEMANTIC TOKEN                          │
│  ──────────────────────────────────────────────────────────────│
│  neutral-900      ───▶  --foreground (text)                    │
│  neutral-50       ───▶  --background (page)                    │
│  neutral-100      ───▶  --muted (subtle backgrounds)           │
│  neutral-500      ───▶  --muted-foreground (secondary text)    │
│  blue-600         ───▶  --primary (brand color)                │
│  white            ───▶  --primary-foreground (on brand)        │
│  red-500          ───▶  --destructive (errors)                 │
│  neutral-200      ───▶  --border (dividers)                    │
│  neutral-300      ───▶  --input (form borders)                 │
│  blue-500         ───▶  --ring (focus indicator)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 FOWT Prevention (Flash of Wrong Theme)

Apply theme **before** React hydration using a blocking script:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    // Runs synchronously before page render
    (function() {
      // Check localStorage first
      const stored = localStorage.getItem('theme');

      // Then system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Determine theme
      const theme = stored || (prefersDark ? 'dark' : 'light');

      // Apply immediately
      document.documentElement.classList.toggle('dark', theme === 'dark');
    })();
  </script>
  <!-- Rest of head -->
</head>
```

### 7.4 Theme Context Provider

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Get stored preference
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Resolve system preference
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    const resolved = theme === "system" ? systemTheme : theme;
    setResolvedTheme(resolved);

    // Apply theme
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

### 7.5 Theme Toggle Component

```tsx
"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {resolvedTheme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Part 8: Accessibility Excellence

### 8.1 WCAG 2.2 Requirements

#### Contrast Ratios

| Level | Normal Text | Large Text | UI Components |
|-------|-------------|------------|---------------|
| **AA** | 4.5:1 | 3:1 | 3:1 |
| **AAA** | 7:1 | 4.5:1 | Not specified |

> "Low contrast text was found on 79.1% of home pages, making it the most common accessibility failure for the fifth consecutive year."

#### Large Text Definition
- 18pt (24px) regular weight, OR
- 14pt (18.5px) bold weight

### 8.2 Focus Indicators

WCAG 2.2 requires visible focus indicators:

```css
/* Two-color focus ring pattern */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  /* Inner border for contrast on all backgrounds */
  box-shadow: 0 0 0 4px var(--background);
}

/* Ensure 3:1 contrast against adjacent colors */
.dark :focus-visible {
  outline-color: var(--ring);
  box-shadow: 0 0 0 4px var(--background);
}
```

### 8.3 Keyboard Navigation Patterns

| Element | Keys | Behavior |
|---------|------|----------|
| **Buttons** | Enter, Space | Activate |
| **Links** | Enter | Navigate |
| **Tabs** | Arrow keys | Switch tabs |
| **Menus** | Arrows, Enter, Esc | Navigate, select, close |
| **Modals** | Tab, Shift+Tab, Esc | Cycle focus, close |
| **Forms** | Tab | Move between fields |

### 8.4 ARIA Patterns

```tsx
// Accessible button with loading state
<button
  aria-busy={isLoading}
  aria-disabled={isLoading}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <span className="sr-only">Loading</span>
      <Spinner aria-hidden="true" />
    </>
  ) : (
    "Submit"
  )}
</button>

// Form with error handling
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
  />
  {errors.email && (
    <p id="email-error" role="alert" className="text-destructive">
      {errors.email.message}
    </p>
  )}
</div>

// Icon button with label
<button aria-label="Close dialog">
  <X className="h-4 w-4" aria-hidden="true" />
</button>
```

### 8.5 Reduced Motion

```css
/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// Framer Motion integration
import { useReducedMotion } from "framer-motion";

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

### 8.6 Legal Compliance Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                 ACCESSIBILITY LEGAL TIMELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2025                                                           │
│  ────                                                           │
│  June 28, 2025     European Accessibility Act (EAA)             │
│                    • E-commerce platforms                       │
│                    • Mobile apps                                │
│                    • Electronic banking                         │
│                    • Public sector websites                     │
│                                                                 │
│  2026                                                           │
│  ────                                                           │
│  April 2026        ADA Title II Enforcement (USA)               │
│                    • State and local government websites        │
│                    • Higher education institutions              │
│                                                                 │
│  Ongoing                                                        │
│  ───────                                                        │
│  Lawsuits up 37% in 2025                                        │
│  Average settlement: $25,000 - $100,000+                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.7 Accessibility Testing Checklist

```markdown
## Manual Testing
- [ ] Navigate entire page with keyboard only
- [ ] Test with screen reader (VoiceOver, NVDA)
- [ ] Verify focus is visible on all interactive elements
- [ ] Check color contrast with browser devtools
- [ ] Test at 200% zoom level
- [ ] Disable CSS and verify content order
- [ ] Test with prefers-reduced-motion enabled

## Automated Testing
- [ ] Run axe-core browser extension
- [ ] Run Lighthouse accessibility audit
- [ ] Check WAVE extension report
- [ ] Validate HTML with W3C validator

## Assistive Technology
- [ ] VoiceOver (macOS/iOS)
- [ ] NVDA (Windows, free)
- [ ] JAWS (Windows)
- [ ] TalkBack (Android)
```

---

## Part 9: Implementation Blueprint

### 9.1 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Framework** | React | 18+ | Industry standard, TypeScript support |
| **Language** | TypeScript | 5.0+ | 78% adoption, type safety |
| **Styling** | Tailwind CSS | 4.0+ | CSS-first config, fastest builds |
| **Components** | shadcn/ui | Latest | Copy-paste, accessible, CVA |
| **Primitives** | Radix UI | Latest | Headless, ARIA-compliant |
| **Animation** | Framer Motion | 11+ | Spring physics, gestures |
| **Forms** | react-hook-form + Zod | Latest | Type-safe validation |
| **Icons** | Lucide React | Latest | Consistent, customizable |

### 9.2 Project Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── sections/              # Page sections (organisms)
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   └── ...
│   └── layout/               # Layout components
│       ├── header.tsx
│       ├── sidebar.tsx
│       └── footer.tsx
├── lib/
│   ├── utils.ts              # cn() utility
│   └── validators.ts         # Zod schemas
├── hooks/
│   ├── use-theme.ts
│   └── use-media-query.ts
├── styles/
│   └── globals.css           # @theme tokens, base styles
└── app/
    ├── layout.tsx
    └── page.tsx
```

### 9.3 Quality Gates

Every generated component must pass:

```
┌─────────────────────────────────────────────────────────────────┐
│                      QUALITY GATES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ACCESSIBILITY (Required)                                       │
│  ├── [ ] Contrast ratio ≥ 4.5:1 (text)                         │
│  ├── [ ] Contrast ratio ≥ 3:1 (UI components)                  │
│  ├── [ ] All interactive elements keyboard accessible           │
│  ├── [ ] Focus indicators visible (3:1 contrast)               │
│  ├── [ ] ARIA labels on icon buttons                           │
│  └── [ ] Form errors linked via aria-describedby               │
│                                                                 │
│  DESIGN SYSTEM (Required)                                       │
│  ├── [ ] Uses semantic CSS variables                           │
│  ├── [ ] Spacing follows 8px grid                              │
│  ├── [ ] Typography uses defined scale                         │
│  ├── [ ] Colors follow 60-30-10 distribution                   │
│  └── [ ] Responsive at all breakpoints                         │
│                                                                 │
│  CODE QUALITY (Required)                                        │
│  ├── [ ] TypeScript strict mode, no `any`                      │
│  ├── [ ] Props interface defined                               │
│  ├── [ ] Ref forwarding implemented                            │
│  ├── [ ] CVA for variants                                      │
│  └── [ ] ESLint/Prettier passing                               │
│                                                                 │
│  PERFORMANCE (Recommended)                                      │
│  ├── [ ] No unnecessary re-renders                             │
│  ├── [ ] Images lazy loaded                                    │
│  ├── [ ] Animations use transform/opacity                      │
│  └── [ ] Bundle size reasonable                                │
│                                                                 │
│  ANIMATION (When applicable)                                    │
│  ├── [ ] Spring physics for motion                             │
│  ├── [ ] AnimatePresence for exits                             │
│  ├── [ ] Respects prefers-reduced-motion                       │
│  └── [ ] Timing feels natural (not too fast/slow)              │
│                                                                 │
│  MINIMUM SCORE: 7.0/10                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 Development Phases

```
PHASE 1: FOUNDATION (Week 1-2)
├── Core agent architecture (Orchestrator + Workers)
├── shadcn/ui integration
├── Tailwind v4 @theme setup
├── Basic component generation (Button, Input, Card)
└── Quality scoring system

PHASE 2: DESIGN SYSTEM (Week 3-4)
├── Color system with 60-30-10 enforcement
├── Typography scale implementation
├── Spacing grid validator
├── Theme system with dark mode
└── FOWT prevention

PHASE 3: COMPONENTS (Week 5-6)
├── Full shadcn/ui component library
├── Page sections (Hero, Features, Pricing)
├── Layout components (Dashboard, Sidebar)
├── Form components with validation
└── Animation integration

PHASE 4: AI FEATURES (Week 7-8)
├── Image-to-code analysis
├── Design critique system
├── Pattern matching and consistency
├── AutoFix post-processor
└── Iterative refinement loop

PHASE 5: POLISH (Week 9-10)
├── Accessibility audit system
├── Performance optimization
├── Documentation generation
├── Testing integration
└── Production hardening
```

---

## Quick Reference Cards

### Color System Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLOR QUICK REFERENCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  60-30-10 RULE                                                  │
│  60% ████████████████████████  Primary (background)             │
│  30% ████████████              Secondary (cards, sections)      │
│  10% ████                      Accent (CTAs, links)             │
│                                                                 │
│  CONTRAST REQUIREMENTS                                          │
│  4.5:1  Normal text (AA)                                        │
│  3:1    Large text, UI components (AA)                          │
│  7:1    Normal text (AAA)                                       │
│                                                                 │
│  CSS VARIABLE PATTERN                                           │
│  --{semantic}-{variant}                                         │
│  --primary                                                      │
│  --primary-foreground                                           │
│  --destructive                                                  │
│  --muted-foreground                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Typography Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                  TYPOGRAPHY QUICK REFERENCE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HIERARCHY (3 levels sufficient)                                │
│  H1  text-4xl font-bold      36px  Hero titles                 │
│  H2  text-2xl font-semibold  24px  Section headings            │
│  H3  text-xl font-medium     20px  Subheadings                 │
│  P   text-base               16px  Body text                   │
│  SM  text-sm                 14px  Captions, labels            │
│                                                                 │
│  LINE HEIGHT                                                    │
│  Headings:  leading-tight    1.25                              │
│  Body:      leading-normal   1.5                               │
│  Large:     leading-relaxed  1.625                             │
│                                                                 │
│  LINE LENGTH                                                    │
│  Optimal:   40-60 characters (max-w-prose)                     │
│  Max:       75 characters                                      │
│                                                                 │
│  FONTS                                                          │
│  Limit:     2-3 typefaces maximum                              │
│  Pairing:   Serif heading + Sans body (or vice versa)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Spacing Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                   SPACING QUICK REFERENCE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  8px GRID SCALE                                                 │
│  0     0px    None                                              │
│  1     4px    Hairline (icons, tight text)                     │
│  2     8px    Compact (related elements)                       │
│  3     12px   Default (form elements)                          │
│  4     16px   Standard (paragraphs)                            │
│  6     24px   Generous (card padding)                          │
│  8     32px   Large (section spacing)                          │
│  12    48px   Extra large (page sections)                      │
│  16    64px   Huge (hero sections)                             │
│                                                                 │
│  COMMON PATTERNS                                                │
│  Button padding:    px-4 py-2 (16px 8px)                       │
│  Card padding:      p-6 (24px)                                 │
│  Section margin:    my-12 (48px)                               │
│  Grid gap:          gap-4 (16px) or gap-6 (24px)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Animation Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                  ANIMATION QUICK REFERENCE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SPRING PRESETS                                                 │
│  Gentle:  { stiffness: 120, damping: 14 }  Smooth, calm        │
│  Default: { stiffness: 200, damping: 20 }  Balanced            │
│  Snappy:  { stiffness: 400, damping: 30 }  Quick, responsive   │
│  Bouncy:  { stiffness: 180, damping: 12 }  Playful             │
│                                                                 │
│  COMMON ANIMATIONS                                              │
│  Hover:   scale: 1.02-1.05, shadow increase                    │
│  Tap:     scale: 0.95-0.98                                     │
│  Enter:   opacity 0→1, y 20→0                                  │
│  Exit:    opacity 1→0, y 0→-20                                 │
│                                                                 │
│  FRAMER MOTION ESSENTIALS                                       │
│  whileHover    Hover state                                     │
│  whileTap      Active/pressed state                            │
│  initial       Starting state                                  │
│  animate       Target state                                    │
│  exit          Unmount state (needs AnimatePresence)           │
│  layout        Enable layout animations                        │
│  layoutId      Shared element transitions                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Examples

### Complete Button Component

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, children, ...props }, ref) => {
    const Comp = asChild ? Slot : motion.button;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        disabled={isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### Complete Card with Animations

```tsx
import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const cardVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.02, y: -4 },
};

const contentVariants = {
  initial: { opacity: 0.9 },
  hover: { opacity: 1 },
};

interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, children, ...props }, ref) => {
    if (interactive) {
      return (
        <motion.div
          ref={ref}
          variants={cardVariants}
          initial="initial"
          whileHover="hover"
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md",
            className
          )}
          {...props}
        >
          <motion.div variants={contentVariants}>{children}</motion.div>
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

### Accessible Modal with Animations

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} asChild {...props}>
    <motion.div
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        className
      )}
    />
  </DialogPrimitive.Overlay>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} asChild {...props}>
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
          className
        )}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </motion.div>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

---

## Checklists

### Component Generation Checklist

```markdown
## Pre-Generation
- [ ] Clear understanding of component purpose
- [ ] Props interface defined
- [ ] Variants identified (if any)
- [ ] Accessibility requirements listed
- [ ] Edge cases documented

## Generation
- [ ] TypeScript strict mode
- [ ] CVA for variants
- [ ] Ref forwarding implemented
- [ ] cn() for className composition
- [ ] Semantic CSS variables used
- [ ] Responsive design included

## Post-Generation
- [ ] Contrast ratios validated
- [ ] Keyboard navigation tested
- [ ] ARIA attributes present
- [ ] Focus indicators visible
- [ ] Animation respects reduced-motion
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

## Quality Score
- [ ] Score ≥ 7.0/10
```

### Design System Compliance Checklist

```markdown
## Colors
- [ ] Primary, secondary, accent colors defined
- [ ] 60-30-10 distribution followed
- [ ] Contrast ratios meet WCAG AA
- [ ] Dark mode variant exists

## Typography
- [ ] Using defined type scale
- [ ] No more than 3 font sizes used
- [ ] Line height appropriate for content type
- [ ] Line length ≤ 75 characters

## Spacing
- [ ] All spacing on 8px grid
- [ ] Consistent padding within components
- [ ] Appropriate white space between sections
- [ ] Responsive spacing adjustments

## Components
- [ ] Using design system primitives
- [ ] Consistent border radius
- [ ] Shadow scale followed
- [ ] Interactive states defined
```

### Accessibility Audit Checklist

```markdown
## Visual
- [ ] Color contrast ≥ 4.5:1 (text)
- [ ] Color contrast ≥ 3:1 (UI components)
- [ ] Focus indicators visible
- [ ] No color-only information

## Keyboard
- [ ] All interactive elements focusable
- [ ] Tab order logical
- [ ] No keyboard traps
- [ ] Focus visible on all elements

## Screen Readers
- [ ] Semantic HTML used
- [ ] ARIA labels on icons/buttons
- [ ] Form errors announced
- [ ] Landmarks present

## Motion
- [ ] prefers-reduced-motion respected
- [ ] No auto-playing animations
- [ ] Animation duration reasonable

## Forms
- [ ] Labels associated with inputs
- [ ] Error messages descriptive
- [ ] Required fields indicated
- [ ] Validation messages accessible
```

---

## Appendices

### Appendix A: Complete Source List

| # | Title | URL | Quality |
|---|-------|-----|---------|
| 1 | v0.dev - Vercel AI UI Generator | https://v0.app/ | 9.2 |
| 2 | shadcn/ui Architecture Deep Dive | https://manupa.dev/blog/anatomy-of-shadcn-ui | 9.5 |
| 3 | React UI Libraries Comparison 2025 | https://makersden.io/blog/react-ui-libs-2025 | 8.5 |
| 4 | Prompt Engineering Playbook | https://addyo.substack.com/p/the-prompt-engineering-playbook | 9.3 |
| 5 | NNGroup Visual Design Principles | https://www.nngroup.com/articles/good-visual-design/ | 9.0 |
| 6 | Tailwind CSS v4.0 Features | https://tailwindcss.com/blog/tailwindcss-v4 | 9.8 |
| 7 | Building Effective Agents - Anthropic | https://www.anthropic.com/research/building-effective-agents | 9.7 |
| 8 | Advanced Framer Motion Patterns | https://blog.maximeheckel.com/posts/advanced-animation-patterns | 9.2 |
| 9 | Modern CSS Container Queries | https://developer.mozilla.org/en-US/docs/Web/CSS | 9.0 |
| 10 | Dark Mode Theming 2025 | https://medium.com/design-bootcamp/dark-mode-2025 | 8.8 |
| 11 | WCAG 2.2 Accessibility Guidelines | https://www.wcag.com/resource/ux-quick-tips | 9.0 |
| 12 | Atomic Design Methodology | https://atomicdesign.bradfrost.com/chapter-2/ | 8.5 |
| 13 | Frontend Trends 2025-2026 | https://blog.logrocket.com/8-trends-web-dev-2026/ | 9.1 |

### Appendix B: Feature Matrix

Total features generated: **85**

| Category | Count | High Priority |
|----------|-------|---------------|
| Core Architecture | 6 | 5 |
| Prompting System | 4 | 2 |
| Component Generation | 5 | 4 |
| Design System | 8 | 4 |
| Theming | 5 | 2 |
| Accessibility | 7 | 5 |
| Animation | 8 | 3 |
| Modern CSS | 6 | 1 |
| Component Library | 11 | 5 |
| Page Sections | 8 | 3 |
| AI Features | 5 | 2 |
| Performance | 4 | 0 |
| Quality | 6 | 3 |
| Developer Experience | 2 | 0 |

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| **CVA** | Class Variance Authority - TypeScript library for managing component variants |
| **FOWT** | Flash of Wrong Theme - visual glitch when wrong theme shows before correct one |
| **HSL** | Hue, Saturation, Lightness - color format used in CSS |
| **INP** | Interaction to Next Paint - Core Web Vital measuring responsiveness |
| **OKLCH** | Oklab Lightness, Chroma, Hue - perceptually uniform color space |
| **Radix UI** | Headless component library providing accessible primitives |
| **shadcn/ui** | Copy-paste component library built on Radix + Tailwind |
| **Spring Physics** | Animation approach using mass, stiffness, damping for natural motion |
| **WCAG** | Web Content Accessibility Guidelines |

---

## Document Information

**Created**: January 2026
**Research Quality Score**: 9.1/10
**Total Sources**: 13
**Features Generated**: 85
**Pages**: ~50

---

*This document was generated through systematic research using extended thinking methodology, synthesizing insights from 13 high-quality sources into a comprehensive guide for building beautiful, accessible, and production-ready frontend design agents.*
