---
name: platxa-frontend-agent
description: AI-powered frontend design agent that generates beautiful, production-ready UI components using React, Tailwind CSS v4, shadcn/ui, and Framer Motion. Transforms natural language into stunning interfaces with WCAG 2.2 accessibility.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - TodoWrite
metadata:
  version: "1.0.0"
  author: "DJ Patel — Founder & CEO, Platxa | https://platxa.com"
  tags:
    - frontend
    - ui-generation
    - react
    - tailwind
    - shadcn-ui
    - design-system
    - accessibility
---

# Platxa Frontend Agent

Transform natural language descriptions into beautiful, production-ready frontend components.

## Overview

This skill generates stunning UI components from plain English descriptions using:

- **React 18 + TypeScript** for type-safe components
- **Tailwind CSS v4** with CSS-first theming
- **shadcn/ui + Radix UI** for accessible primitives
- **Framer Motion** for smooth animations
- **WCAG 2.2** accessibility compliance

## Workflow

### Phase 1: Request Analysis

**Input**: Natural language UI description

Use Task tool with `subagent_type="frontend-orchestrator"` to:
1. Parse UI request to identify component types
2. Extract layout requirements (grid, flex, responsive)
3. Determine styling needs (colors, typography, spacing)
4. Identify animation requirements
5. Decompose into subtasks for workers

**Output**: Decomposed task list with component specifications

### Phase 2: Design Analysis

**Input**: Component specifications

Use Task tool with `subagent_type="design-analyzer"` to:
1. Apply 60-30-10 color rule
2. Determine typography hierarchy
3. Calculate spacing using 8px grid
4. Select appropriate animations
5. Plan responsive breakpoints

**Output**: Design tokens and styling specifications

### Phase 3: Component Generation

**Input**: Design specifications

Use Task tool with `subagent_type="component-generator"` to:
1. Generate React TypeScript component
2. Apply shadcn/ui patterns with CVA
3. Implement Radix UI primitives for accessibility
4. Add proper TypeScript types and props
5. Include ref forwarding

**Output**: Complete React component files

### Phase 4: Animation Enhancement

**Input**: Generated components

Use Task tool with `subagent_type="animation-worker"` to:
1. Add Framer Motion animations
2. Implement hover/tap states
3. Add AnimatePresence for mount/unmount
4. Apply spring physics
5. Respect reduced motion preference

**Output**: Animated components

### Phase 5: Accessibility Audit

**Input**: Complete components

Use Task tool with `subagent_type="accessibility-auditor"` to:
1. Validate contrast ratios (4.5:1 minimum)
2. Check keyboard navigation
3. Verify ARIA labels
4. Test focus management
5. Ensure screen reader compatibility

**Output**: WCAG-compliant components with score

## Examples

### Example 1: Simple Button

```
User: Create a primary button with hover animation
Assistant: [Orchestrator] Analyzing request... Component: Button
Assistant: [Design] Primary color, scale animation on hover
Assistant: [Generator] Creating shadcn/ui button with CVA variants
Assistant: [Animation] Adding whileHover scale and whileTap
Assistant: [A11y] Validated - Score: 9.2/10
```

**Output:**
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const Button = motion(
  React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  )
)

// Usage with animation
<Button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Click me
</Button>
```

### Example 2: Dashboard Layout

```
User: Create a dashboard with collapsible sidebar
Assistant: [Orchestrator] Complex layout - decomposing into:
  - Sidebar component with collapse toggle
  - Header with breadcrumbs
  - Main content area with grid
Assistant: [Design] Dark sidebar, light content, 8px grid spacing
Assistant: [Generator] Creating layout components with Radix Collapsible
Assistant: [Animation] Sidebar slide animation, stagger for menu items
Assistant: [A11y] Navigation landmarks, skip links - Score: 8.8/10
```

### Example 3: Pricing Cards

```
User: Create a pricing section with 3 tiers, highlight the middle one
Assistant: [Orchestrator] Page section - Pricing grid with emphasis
Assistant: [Design] 60-30-10 colors, middle card elevated
Assistant: [Generator] Card components with feature lists
Assistant: [Animation] Hover lift, stagger entrance
Assistant: [A11y] Semantic headings, button labels - Score: 9.0/10
```

## Design System Reference

### Colors (OKLCH)
```css
@theme {
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.6 0.1 200);
  --color-accent: oklch(0.8 0.2 30);
  --color-background: oklch(0.98 0 0);
  --color-foreground: oklch(0.1 0 0);
}
```

### Typography Scale
```css
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;   /* 36px */
```

### Spacing (8px Grid)
```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
```

### Animation Presets
```typescript
const springPreset = { type: "spring", stiffness: 300, damping: 30 }
const hoverScale = { scale: 1.02 }
const tapScale = { scale: 0.98 }
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } }
const slideUp = { initial: { y: 20 }, animate: { y: 0 } }
```

## Quality Scoring

| Criteria | Weight | Description |
|----------|--------|-------------|
| Design | 25% | Color harmony, typography, spacing |
| Accessibility | 25% | WCAG 2.2 compliance |
| Code Quality | 20% | TypeScript, patterns, structure |
| Animation | 15% | Smoothness, appropriateness |
| Performance | 15% | Bundle size, rendering |

**Minimum passing score**: 7.0/10

## Output Checklist

When generating components, verify:

- [ ] React 18 TypeScript with strict types
- [ ] shadcn/ui pattern with CVA variants
- [ ] cn() utility for class composition
- [ ] Ref forwarding for form integration
- [ ] Framer Motion animations
- [ ] Reduced motion support
- [ ] WCAG 2.2 AA contrast ratios
- [ ] Keyboard navigation
- [ ] ARIA labels for icons/buttons
- [ ] Focus indicators (two-color)
- [ ] Quality score >= 7.0/10
