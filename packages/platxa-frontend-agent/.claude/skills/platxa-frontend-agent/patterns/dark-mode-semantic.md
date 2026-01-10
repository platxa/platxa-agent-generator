# Dark Mode with Semantic Tokens

Implement dark mode by swapping CSS variable values, not by adding conditional class names to components. This keeps components clean and theme-agnostic.

## The Semantic Approach

### ❌ Wrong: Class-Based Dark Mode

```typescript
// BAD: Component knows about dark mode
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <button className="bg-blue-500 dark:bg-blue-400 text-white">
    Click me
  </button>
</div>

// Problems:
// - Every component needs dark: variants
// - Class names are verbose and repetitive
// - Hard to maintain consistency
// - Difficult to add new themes
```

### ✅ Correct: Variable-Based Dark Mode

```typescript
// GOOD: Component is theme-agnostic
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
</div>

// CSS handles the mode switching
:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.15 0.02 250);
  --primary: oklch(0.6 0.2 250);
}

.dark {
  --background: oklch(0.12 0.02 250);
  --foreground: oklch(0.95 0 0);
  --primary: oklch(0.70 0.18 250);
}
```

## Implementation

### 1. Define Semantic Variables

```css
/* globals.css */
@layer base {
  :root {
    /* Light mode values */
    --background: oklch(0.98 0 0);
    --foreground: oklch(0.15 0.02 250);

    --card: oklch(0.99 0 0);
    --card-foreground: oklch(0.15 0.02 250);

    --popover: oklch(0.99 0 0);
    --popover-foreground: oklch(0.15 0.02 250);

    --primary: oklch(0.6 0.2 250);
    --primary-foreground: oklch(0.98 0 0);

    --secondary: oklch(0.95 0.02 250);
    --secondary-foreground: oklch(0.15 0.02 250);

    --muted: oklch(0.95 0.01 250);
    --muted-foreground: oklch(0.45 0.02 250);

    --accent: oklch(0.95 0.02 250);
    --accent-foreground: oklch(0.15 0.02 250);

    --destructive: oklch(0.55 0.22 25);
    --destructive-foreground: oklch(0.98 0 0);

    --border: oklch(0.90 0.01 250);
    --input: oklch(0.90 0.01 250);
    --ring: oklch(0.6 0.2 250);

    --radius: 0.5rem;
  }

  .dark {
    /* Dark mode values - same variable names, different values */
    --background: oklch(0.12 0.02 250);
    --foreground: oklch(0.95 0 0);

    --card: oklch(0.15 0.02 250);
    --card-foreground: oklch(0.95 0 0);

    --popover: oklch(0.15 0.02 250);
    --popover-foreground: oklch(0.95 0 0);

    --primary: oklch(0.70 0.18 250);
    --primary-foreground: oklch(0.10 0.02 250);

    --secondary: oklch(0.22 0.03 250);
    --secondary-foreground: oklch(0.95 0 0);

    --muted: oklch(0.22 0.02 250);
    --muted-foreground: oklch(0.65 0.02 250);

    --accent: oklch(0.22 0.03 250);
    --accent-foreground: oklch(0.95 0 0);

    --destructive: oklch(0.50 0.20 25);
    --destructive-foreground: oklch(0.98 0 0);

    --border: oklch(0.25 0.02 250);
    --input: oklch(0.25 0.02 250);
    --ring: oklch(0.70 0.18 250);
  }
}
```

### 2. Map to Tailwind

```css
@import "tailwindcss";

@theme {
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
}
```

### 3. Apply Theme Class

```typescript
// Theme is controlled by a single class on <html>
// Light mode: <html>
// Dark mode:  <html class="dark">

// Theme switching script (prevents flash)
const themeScript = `
  (function() {
    function getTheme() {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const theme = getTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
  })();
`;

// In your HTML <head>
<script dangerouslySetInnerHTML={{ __html: themeScript }} />
```

## Component Examples

### Theme-Agnostic Components

```typescript
// Button - NO dark: prefixes
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium",
        "transition-colors focus-visible:ring-2 focus-visible:ring-ring",

        // Variants use semantic tokens ONLY
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "destructive" && "bg-destructive text-destructive-foreground",
        variant === "outline" && "border border-input bg-background hover:bg-accent",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
        variant === "link" && "text-primary underline-offset-4 hover:underline",

        className
      )}
      {...props}
    />
  )
)
```

```typescript
// Card - NO dark: prefixes
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

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
```

```typescript
// Input - NO dark: prefixes
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
        "text-sm ring-offset-background",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
```

## Comparison

### Before: Class-Based (Wrong)

```typescript
// 47 characters of class names for ONE element
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
  <h2 className="text-slate-900 dark:text-white">Title</h2>
  <p className="text-slate-600 dark:text-slate-400">Description</p>
  <button className="bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600">
    Action
  </button>
</div>
```

### After: Variable-Based (Correct)

```typescript
// Clean, semantic, maintainable
<div className="bg-card text-card-foreground border border-border">
  <h2>Title</h2>
  <p className="text-muted-foreground">Description</p>
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Action
  </button>
</div>
```

## Dark Mode Adjustments

### Lightness Inversion Rules

| Light Mode | Dark Mode | Adjustment |
|------------|-----------|------------|
| L: 0.98 (background) | L: 0.12 | Invert |
| L: 0.15 (foreground) | L: 0.95 | Invert |
| L: 0.60 (primary) | L: 0.70 | Lighten 10-15% |
| L: 0.90 (border) | L: 0.25 | Invert |
| L: 0.45 (muted text) | L: 0.65 | Lighten 20% |

### Contrast Preservation

```css
/* Ensure WCAG contrast in both modes */
:root {
  /* Light: dark text on light bg */
  --foreground: oklch(0.15 0.02 250);  /* ~4.5:1 on 0.98 */
  --muted-foreground: oklch(0.45 0.02 250);  /* ~4.5:1 on 0.98 */
}

.dark {
  /* Dark: light text on dark bg */
  --foreground: oklch(0.95 0 0);  /* ~4.5:1 on 0.12 */
  --muted-foreground: oklch(0.65 0.02 250);  /* ~4.5:1 on 0.12 */
}
```

### Primary Color Adjustment

```css
:root {
  /* Primary needs to be visible on light background */
  --primary: oklch(0.6 0.2 250);
  /* White text on primary needs contrast */
  --primary-foreground: oklch(0.98 0 0);
}

.dark {
  /* Primary needs to be visible on dark background */
  --primary: oklch(0.70 0.18 250);  /* Lighter */
  /* Dark text might work better on lighter primary */
  --primary-foreground: oklch(0.10 0.02 250);
}
```

## Theme Provider

```typescript
"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  // Initialize from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored) setTheme(stored)
  }, [])

  // Apply theme
  React.useEffect(() => {
    const root = document.documentElement
    let resolved: "light" | "dark"

    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    } else {
      resolved = theme
    }

    // Toggle the dark class - this swaps all variable values
    root.classList.toggle("dark", resolved === "dark")
    setResolvedTheme(resolved)
  }, [theme])

  // Listen for system changes
  React.useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches)
      setResolvedTheme(e.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [theme])

  const handleSetTheme = React.useCallback((newTheme: Theme) => {
    localStorage.setItem("theme", newTheme)
    setTheme(newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
```

## Validation

### Component Audit

```typescript
function auditDarkModeUsage(component: string): AuditResult {
  const issues: Issue[] = []

  // Check for dark: prefixes (anti-pattern)
  const darkPrefixes = component.match(/dark:[a-z-]+/g)
  if (darkPrefixes) {
    issues.push({
      type: "error",
      message: `Found ${darkPrefixes.length} dark: prefixes. Use semantic tokens instead.`,
      matches: darkPrefixes,
      fix: "Replace dark:bg-gray-900 with bg-background"
    })
  }

  // Check for hardcoded colors
  const hardcodedColors = component.match(/(?:bg|text|border)-(?:gray|slate|zinc|neutral)-\d+/g)
  if (hardcodedColors) {
    issues.push({
      type: "warning",
      message: `Found ${hardcodedColors.length} hardcoded colors.`,
      matches: hardcodedColors,
      fix: "Use semantic tokens like bg-muted, text-muted-foreground"
    })
  }

  return {
    valid: issues.filter(i => i.type === "error").length === 0,
    issues
  }
}
```

## Quick Reference

### Allowed (Semantic)

```
bg-background, bg-foreground
bg-card, text-card-foreground
bg-primary, text-primary-foreground
bg-secondary, text-secondary-foreground
bg-muted, text-muted-foreground
bg-accent, text-accent-foreground
bg-destructive, text-destructive-foreground
border-border, border-input
ring-ring
```

### Not Allowed (Hardcoded)

```
bg-white, bg-black
bg-gray-100, bg-gray-900
text-gray-600, text-gray-400
dark:bg-*, dark:text-*, dark:border-*
```

## Benefits

| Aspect | Class-Based | Variable-Based |
|--------|-------------|----------------|
| Bundle size | Larger (2x classes) | Smaller |
| Maintainability | Hard (scattered) | Easy (centralized) |
| Theme additions | Change every component | Add new :root block |
| Component complexity | High | Low |
| Consistency | Prone to drift | Guaranteed |
| Debugging | Check every class | Check variables |
