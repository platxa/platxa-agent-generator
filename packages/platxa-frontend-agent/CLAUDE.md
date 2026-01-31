# CLAUDE.md - Platxa Frontend Agent

This file provides context for AI agents working on this project.

## Project Overview

**platxa-frontend-agent** is an AI-powered frontend design agent that generates beautiful, production-ready UI components using React 19, Tailwind CSS v4, and shadcn/ui patterns.

### Key Features
- Orchestrator-workers architecture with specialized agents
- Brand kit system with Radix UI 12-step color scales
- Multi-agent coordinator for parallel task processing
- Component generation with CVA variants
- Accessibility-first (WCAG 2.2 AA compliance)

## Architecture

```
src/
├── components/ui/       # Generated UI components
├── lib/
│   ├── react-agent/
│   │   ├── brand/       # Brand kit configuration system
│   │   │   ├── types.ts     # TypeScript interfaces
│   │   │   ├── config.ts    # Configuration utilities
│   │   │   └── index.ts     # Public exports
│   │   ├── coordinator/ # Multi-agent coordinator
│   │   │   └── coordinator.ts
│   │   └── theme/       # Theme generation
│   └── utils.ts         # Shared utilities (cn, generateId, etc.)
├── cli/                 # CLI tools (init, validate, generate)
├── test/                # Test utilities and mocks
│   ├── setup.ts         # Vitest setup with jest-dom
│   └── mocks/           # Test mocks (framer-motion)
└── styles/
    └── globals.css      # Tailwind v4 @theme configuration
```

## Agent System

### Orchestrator: `frontend-orchestrator`
- Analyzes design requests
- Decomposes into subtasks
- Routes to specialized workers

### Workers:
1. **design-analyzer** - Extracts visual requirements from descriptions
2. **component-generator** - Creates React 18+ TypeScript components
3. **theme-worker** - Manages Tailwind v4 @theme tokens
4. **animation-worker** - Adds Framer Motion animations
5. **accessibility-auditor** - Validates WCAG 2.2 compliance

## Commands

```bash
# Development
pnpm dev              # Start Vite dev server
pnpm build            # Build library
pnpm preview          # Preview built output

# Testing
pnpm test             # Run tests once
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report
pnpm test:e2e         # Playwright E2E tests

# Code Quality
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm lint:fix         # Auto-fix lint issues
pnpm validate         # Run all checks
```

## Code Patterns

### Component Structure (shadcn/ui pattern)
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Testing Pattern
```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { Button } from "./button"

// Mock framer-motion for animation tests
vi.mock("framer-motion", () => import("@/test/mocks/framer-motion"))

describe("Button", () => {
  it("renders with correct text", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument()
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    await user.click(screen.getByRole("button"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("applies variant classes correctly", () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-destructive")
  })
})
```

### Brand Kit Configuration
```typescript
import { defineBrandKit, defineFrontendConfig } from "platxa-frontend-agent/brand"

const brandKit = defineBrandKit({
  name: "My Brand",
  colors: {
    primitives: {
      gray: generateRadixScale("slate"),
      primary: generateRadixScale("blue"),
      // ... 12-step scales
    },
    semantic: {
      background: "gray.1",
      foreground: "gray.12",
      primary: "primary.9",
      // ...
    },
  },
})

const config = defineFrontendConfig({
  brandKit,
  output: {
    components: "./src/components/ui",
    styles: "./src/styles",
  },
})
```

## Conventions

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `unknown` over `any`

### Imports
- Use `@/` path alias for src/ directory
- Group imports: React > external > internal > types

### CSS
- Tailwind v4 with CSS-first configuration
- OKLCH color space for wide gamut displays
- Semantic color tokens via `--color-*` CSS variables
- 8px spacing grid

### Accessibility
- All interactive elements must be keyboard accessible
- Focus indicators: 2px ring with offset
- Respect `prefers-reduced-motion`
- Minimum 4.5:1 contrast ratio for text

### Testing
- Co-locate test files with source (`.test.tsx`)
- Use Testing Library queries in priority order
- Mock external dependencies (framer-motion, APIs)
- Test accessibility with role queries

## Environment

- **Node**: 20 LTS (see .nvmrc)
- **Package Manager**: pnpm 9.15+
- **React**: 19.x with React Compiler
- **TypeScript**: 5.7+
- **Tailwind**: 4.0 (CSS-first, no config file)
- **Vite**: 6.x

## Troubleshooting

### Build Issues
1. Ensure `@tailwindcss/vite` plugin is loaded
2. Check path aliases in `vite.config.ts`
3. Verify `tsconfig.node.json` includes vite config

### Test Issues
1. Import jest-dom matchers: `@testing-library/jest-dom/vitest`
2. Mock framer-motion for animation components
3. Use `cleanup()` after each test

### Type Errors
1. Run `pnpm typecheck` for full diagnostics
2. Check `tsconfig.json` includes all source files
3. Verify path alias `@/*` resolves correctly
