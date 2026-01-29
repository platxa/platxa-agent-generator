# CSS Variables Theming System

Semantic CSS variables provide a flexible theming layer that enables dark mode, custom themes, and consistent color usage across components.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Theming Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Raw Colors (OKLCH)                                             │
│  └── oklch(0.6 0.2 250)                                         │
│                    │                                            │
│                    ▼                                            │
│  CSS Variables (Semantic)                                       │
│  └── --primary: oklch(0.6 0.2 250);                             │
│  └── --primary-foreground: oklch(0.98 0 0);                     │
│                    │                                            │
│                    ▼                                            │
│  Tailwind @theme (Utility Classes)                              │
│  └── --color-primary: var(--primary);                           │
│                    │                                            │
│                    ▼                                            │
│  Components                                                     │
│  └── className="bg-primary text-primary-foreground"             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Semantic Token Naming

### Naming Convention

```
--{category}[-{variant}][-{state}]
```

| Category | Purpose | Examples |
|----------|---------|----------|
| `background` | Surface colors | `--background`, `--card`, `--popover` |
| `foreground` | Text colors | `--foreground`, `--muted-foreground` |
| `primary` | Brand/action | `--primary`, `--primary-foreground` |
| `secondary` | Secondary UI | `--secondary`, `--secondary-foreground` |
| `accent` | Highlights | `--accent`, `--accent-foreground` |
| `muted` | Subdued elements | `--muted`, `--muted-foreground` |
| `destructive` | Danger actions | `--destructive`, `--destructive-foreground` |
| `border` | Borders | `--border`, `--input` |
| `ring` | Focus rings | `--ring` |

### Complete Token Set

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     SURFACES - Background colors for containers and cards
     ═══════════════════════════════════════════════════════════ */
  --background: oklch(0.98 0 0);           /* Page background */
  --foreground: oklch(0.15 0.02 250);      /* Default text */

  --card: oklch(0.99 0 0);                 /* Card surfaces */
  --card-foreground: oklch(0.15 0.02 250); /* Card text */

  --popover: oklch(0.99 0 0);              /* Dropdowns, tooltips */
  --popover-foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     PRIMARY - Main brand color, primary actions
     ═══════════════════════════════════════════════════════════ */
  --primary: oklch(0.6 0.2 250);           /* Primary buttons, links */
  --primary-foreground: oklch(0.98 0 0);   /* Text on primary */

  /* ═══════════════════════════════════════════════════════════
     SECONDARY - Secondary actions, less prominent UI
     ═══════════════════════════════════════════════════════════ */
  --secondary: oklch(0.95 0.02 250);       /* Secondary buttons */
  --secondary-foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     MUTED - Subdued backgrounds and text
     ═══════════════════════════════════════════════════════════ */
  --muted: oklch(0.95 0.01 250);           /* Muted backgrounds */
  --muted-foreground: oklch(0.45 0.02 250); /* Secondary text */

  /* ═══════════════════════════════════════════════════════════
     ACCENT - Hover states, subtle highlights
     ═══════════════════════════════════════════════════════════ */
  --accent: oklch(0.95 0.02 250);          /* Hover backgrounds */
  --accent-foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     DESTRUCTIVE - Danger, errors, delete actions
     ═══════════════════════════════════════════════════════════ */
  --destructive: oklch(0.55 0.22 25);      /* Error, delete */
  --destructive-foreground: oklch(0.98 0 0);

  /* ═══════════════════════════════════════════════════════════
     BORDERS & INPUTS
     ═══════════════════════════════════════════════════════════ */
  --border: oklch(0.90 0.01 250);          /* Default borders */
  --input: oklch(0.90 0.01 250);           /* Input borders */
  --ring: oklch(0.6 0.2 250);              /* Focus rings */

  /* ═══════════════════════════════════════════════════════════
     COMPONENT TOKENS
     ═══════════════════════════════════════════════════════════ */
  --radius: 0.5rem;                        /* Default border radius */

  /* ═══════════════════════════════════════════════════════════
     STATUS COLORS (Optional extension)
     ═══════════════════════════════════════════════════════════ */
  --success: oklch(0.65 0.2 145);
  --success-foreground: oklch(0.98 0 0);

  --warning: oklch(0.75 0.18 85);
  --warning-foreground: oklch(0.15 0.02 85);

  --info: oklch(0.65 0.15 230);
  --info-foreground: oklch(0.98 0 0);
}
```

## Dark Mode Implementation

### CSS Variable Overrides

```css
.dark {
  /* ═══════════════════════════════════════════════════════════
     SURFACES - Inverted for dark mode
     ═══════════════════════════════════════════════════════════ */
  --background: oklch(0.12 0.02 250);
  --foreground: oklch(0.95 0 0);

  --card: oklch(0.15 0.02 250);
  --card-foreground: oklch(0.95 0 0);

  --popover: oklch(0.15 0.02 250);
  --popover-foreground: oklch(0.95 0 0);

  /* ═══════════════════════════════════════════════════════════
     PRIMARY - Slightly lighter for dark backgrounds
     ═══════════════════════════════════════════════════════════ */
  --primary: oklch(0.70 0.18 250);
  --primary-foreground: oklch(0.10 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     SECONDARY - Dark variants
     ═══════════════════════════════════════════════════════════ */
  --secondary: oklch(0.22 0.03 250);
  --secondary-foreground: oklch(0.95 0 0);

  /* ═══════════════════════════════════════════════════════════
     MUTED - Dark subdued colors
     ═══════════════════════════════════════════════════════════ */
  --muted: oklch(0.22 0.02 250);
  --muted-foreground: oklch(0.65 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     ACCENT - Dark hover states
     ═══════════════════════════════════════════════════════════ */
  --accent: oklch(0.22 0.03 250);
  --accent-foreground: oklch(0.95 0 0);

  /* ═══════════════════════════════════════════════════════════
     DESTRUCTIVE - Adjusted for dark
     ═══════════════════════════════════════════════════════════ */
  --destructive: oklch(0.50 0.20 25);
  --destructive-foreground: oklch(0.98 0 0);

  /* ═══════════════════════════════════════════════════════════
     BORDERS - Darker for dark mode
     ═══════════════════════════════════════════════════════════ */
  --border: oklch(0.25 0.02 250);
  --input: oklch(0.25 0.02 250);
  --ring: oklch(0.70 0.18 250);

  /* ═══════════════════════════════════════════════════════════
     STATUS - Dark variants
     ═══════════════════════════════════════════════════════════ */
  --success: oklch(0.60 0.18 145);
  --warning: oklch(0.70 0.16 85);
  --info: oklch(0.60 0.13 230);
}
```

### Theme Switching

**FOWT Prevention Script (Flash of Wrong Theme):**

```html
<!-- Add to <head> before any stylesheets -->
<script>
  (function() {
    const theme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (theme === 'dark' || (!theme && systemDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  })();
</script>
```

**React Theme Provider:**

```typescript
"use client"

import * as React from "react"

type Theme = "dark" | "light" | "system"

interface ThemeProviderContext {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "dark" | "light"
}

const ThemeProviderContext = React.createContext<ThemeProviderContext | undefined>(
  undefined
)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme"
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<"dark" | "light">("light")

  // Initialize from storage
  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) {
      setThemeState(stored)
    }
  }, [storageKey])

  // Apply theme to DOM
  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    let resolved: "dark" | "light"

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      resolved = systemTheme
    } else {
      resolved = theme
    }

    root.classList.add(resolved)
    setResolvedTheme(resolved)
  }, [theme])

  // Listen for system theme changes
  React.useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handler = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement
      root.classList.remove("light", "dark")
      root.classList.add(e.matches ? "dark" : "light")
      setResolvedTheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [theme])

  const setTheme = React.useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme)
    setThemeState(newTheme)
  }, [storageKey])

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
```

**Theme Toggle Component:**

```typescript
"use client"

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
  )
}
```

## Using Variables in Components

### Direct CSS Variable Usage

```typescript
// In Tailwind classes (via @theme mapping)
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
</div>

// In inline styles (when needed)
<div style={{ backgroundColor: 'var(--background)' }}>
  <span style={{ color: 'var(--primary)' }}>Styled</span>
</div>

// In CSS modules or styled-components
const styles = {
  container: {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    color: 'var(--card-foreground)'
  }
}
```

### Component Patterns

```typescript
// Button using semantic tokens
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        // Base styles using semantic tokens
        "inline-flex items-center justify-center rounded-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",

        // Variant styles
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        variant === "outline" && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",

        className
      )}
      {...props}
    />
  )
)

// Card using semantic tokens
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
)

// Input using semantic tokens
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
        "text-sm placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
```

## Custom Theme Creation

### Theme Generator

```typescript
interface ThemeColors {
  primary: string       // OKLCH value
  primaryHue?: number   // Hue for generating scale
}

function generateTheme(colors: ThemeColors): string {
  const { primary, primaryHue = 250 } = colors

  // Parse primary OKLCH
  const [L, C, H] = parseOKLCH(primary)

  return `
:root {
  /* Primary scale */
  --primary: ${primary};
  --primary-foreground: ${L > 0.6 ? 'oklch(0.15 0.02 ' + H + ')' : 'oklch(0.98 0 0)'};

  /* Generated semantic tokens */
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.15 0.02 ${H});

  --card: oklch(0.99 0 0);
  --card-foreground: oklch(0.15 0.02 ${H});

  --secondary: oklch(0.95 0.02 ${H});
  --secondary-foreground: oklch(0.15 0.02 ${H});

  --muted: oklch(0.95 0.01 ${H});
  --muted-foreground: oklch(0.45 0.02 ${H});

  --accent: oklch(0.95 0.02 ${H});
  --accent-foreground: oklch(0.15 0.02 ${H});

  --border: oklch(0.90 0.01 ${H});
  --input: oklch(0.90 0.01 ${H});
  --ring: ${primary};
}
  `.trim()
}
```

### Multiple Theme Support

```css
/* Default theme */
:root {
  --primary: oklch(0.6 0.2 250);
  /* ... other tokens */
}

/* Blue theme */
[data-theme="blue"] {
  --primary: oklch(0.55 0.2 240);
  --ring: oklch(0.55 0.2 240);
}

/* Green theme */
[data-theme="green"] {
  --primary: oklch(0.55 0.2 145);
  --ring: oklch(0.55 0.2 145);
}

/* Purple theme */
[data-theme="purple"] {
  --primary: oklch(0.55 0.22 300);
  --ring: oklch(0.55 0.22 300);
}

/* Each theme also needs dark mode variants */
[data-theme="blue"].dark {
  --primary: oklch(0.65 0.18 240);
  /* ... dark overrides */
}
```

## Tailwind Integration

### @theme Configuration

```css
@import "tailwindcss";

@theme {
  /* Map CSS variables to Tailwind */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Radius */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

## Validation Rules

```typescript
interface ThemeValidation {
  valid: boolean
  issues: ThemeIssue[]
}

function validateThemeUsage(component: string): ThemeValidation {
  const issues: ThemeIssue[] = []

  // Check for hardcoded colors
  const hardcodedColors = component.match(/(?:bg|text|border)-(?:gray|blue|red|green)-\d+/g)
  if (hardcodedColors) {
    for (const color of hardcodedColors) {
      issues.push({
        type: "hardcoded-color",
        value: color,
        suggestion: `Use semantic token instead (e.g., bg-muted, text-muted-foreground)`
      })
    }
  }

  // Check for inline color values
  const inlineColors = component.match(/(?:color|background(?:-color)?|border-color):\s*#[0-9a-fA-F]+/g)
  if (inlineColors) {
    for (const color of inlineColors) {
      issues.push({
        type: "inline-color",
        value: color,
        suggestion: "Use var(--token-name) instead"
      })
    }
  }

  // Check for missing foreground pairing
  const bgUsage = component.match(/bg-(primary|secondary|destructive|accent)/g)
  if (bgUsage) {
    for (const bg of bgUsage) {
      const colorName = bg.replace('bg-', '')
      if (!component.includes(`text-${colorName}-foreground`)) {
        issues.push({
          type: "missing-foreground",
          value: bg,
          suggestion: `Add text-${colorName}-foreground for contrast`
        })
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  }
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use semantic tokens (`bg-primary`) | Use hardcoded colors (`bg-blue-500`) |
| Pair background with foreground | Use mismatched color pairs |
| Define tokens in :root/.dark | Scatter definitions in components |
| Use var() for custom CSS | Duplicate token values |
| Test both light and dark modes | Assume one mode works for both |
| Use OKLCH for wide gamut | Stick to sRGB hex values |
