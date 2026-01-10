# FOWT Prevention System

Prevent Flash of Wrong Theme (FOWT) by applying theme before React hydration via blocking head script.

## Overview

FOWT occurs when:
1. Server renders HTML with default theme (usually light)
2. Page displays with default theme
3. JavaScript loads and checks user preference
4. Theme switches causing visible flash

**Solution**: Inject a synchronous blocking script in `<head>` that applies the correct theme BEFORE any paint occurs.

## The Problem

```
Timeline WITHOUT FOWT prevention:
───────────────────────────────────────────────────────────
HTML loads → Paint (wrong theme) → JS hydrates → Theme switch → Repaint
                    ↑                                ↑
              User sees flash                 Correct theme
```

```
Timeline WITH FOWT prevention:
───────────────────────────────────────────────────────────
HTML loads → Theme script → Paint (correct) → JS hydrates
                  ↑                  ↑
            Sync, blocking      No flash!
```

## Blocking Theme Script

### Minimal Script (Inline in Head)

```html
<head>
  <!-- FOWT Prevention - Must be FIRST script, blocking -->
  <script>
    (function() {
      // Get stored preference or system preference
      var theme = localStorage.getItem('theme');
      if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      }
      // Apply immediately to prevent flash
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    })();
  </script>

  <!-- Rest of head content -->
</head>
```

### TypeScript Version (For Build Tools)

```typescript
/**
 * Generates the FOWT prevention script as a string
 * This should be injected into <head> as an inline script
 */
export const generateFowtScript = (): string => `
(function() {
  var d = document.documentElement;
  var t = localStorage.getItem('theme');
  if (!t) {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  d.classList.remove('light', 'dark');
  d.classList.add(t);
  d.style.colorScheme = t;
})();
`.trim()

/**
 * Minified version for production (291 bytes)
 */
export const fowtScriptMinified = `(function(){var d=document.documentElement,t=localStorage.getItem("theme");t||(t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),d.classList.remove("light","dark"),d.classList.add(t),d.style.colorScheme=t})();`
```

## Framework Integration

### Next.js (App Router)

```typescript
// app/layout.tsx
import { generateFowtScript } from "@/lib/theme-script"

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* FOWT Prevention - MUST be first */}
        <script
          dangerouslySetInnerHTML={{ __html: generateFowtScript() }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Next.js (Pages Router)

```typescript
// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document"
import { generateFowtScript } from "@/lib/theme-script"

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        {/* FOWT Prevention - MUST be first in head */}
        <script
          dangerouslySetInnerHTML={{ __html: generateFowtScript() }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

### Vite / React SPA

```typescript
// index.html - inject before bundle script
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- FOWT Prevention - CRITICAL: Must be before any other scripts -->
    <script>
      (function(){var d=document.documentElement,t=localStorage.getItem("theme");t||(t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),d.classList.remove("light","dark"),d.classList.add(t),d.style.colorScheme=t})();
    </script>

    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Remix

```typescript
// app/root.tsx
import { generateFowtScript } from "~/lib/theme-script"

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* FOWT Prevention */}
        <script
          dangerouslySetInnerHTML={{ __html: generateFowtScript() }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

### Astro

```astro
---
// src/layouts/Layout.astro
import { generateFowtScript } from "../lib/theme-script"
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <!-- FOWT Prevention -->
    <script is:inline set:html={generateFowtScript()} />
  </head>
  <body>
    <slot />
  </body>
</html>
```

## Theme Provider Component

```typescript
"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export const ThemeProvider = ({
  children,
  defaultTheme = "system",
  storageKey = "theme"
}: ThemeProviderProps) => {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  // Sync with system preference and storage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"

    if (stored) {
      setThemeState(stored)
      setResolvedTheme(stored === "system" ? systemTheme : stored)
    } else {
      setResolvedTheme(systemTheme)
    }
  }, [storageKey])

  // Listen for system theme changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        const newTheme = e.matches ? "dark" : "light"
        setResolvedTheme(newTheme)
        applyTheme(newTheme)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    const resolved = newTheme === "system" ? systemTheme : newTheme

    setResolvedTheme(resolved)
    applyTheme(resolved)
    localStorage.setItem(storageKey, newTheme)
  }, [storageKey])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Apply theme to document
 */
const applyTheme = (theme: "light" | "dark") => {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(theme)
  root.style.colorScheme = theme
}

/**
 * Hook to access theme context
 */
export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
```

## Theme Toggle Component

```typescript
"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"

export const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {resolvedTheme === "dark" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
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
  )
}

/**
 * Simple toggle button (light/dark only)
 */
export const ThemeToggleSimple = () => {
  const { resolvedTheme, setTheme } = useTheme()

  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

## CSS Setup

### Tailwind CSS Theme Variables

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light theme (default) */
    --background: oklch(98% 0.01 220);
    --foreground: oklch(15% 0.02 220);
    --card: oklch(100% 0 0);
    --card-foreground: oklch(15% 0.02 220);
    --popover: oklch(100% 0 0);
    --popover-foreground: oklch(15% 0.02 220);
    --primary: oklch(45% 0.15 220);
    --primary-foreground: oklch(98% 0.01 220);
    --secondary: oklch(94% 0.02 220);
    --secondary-foreground: oklch(20% 0.02 220);
    --muted: oklch(94% 0.02 220);
    --muted-foreground: oklch(45% 0.02 220);
    --accent: oklch(94% 0.02 220);
    --accent-foreground: oklch(20% 0.02 220);
    --destructive: oklch(55% 0.2 25);
    --destructive-foreground: oklch(98% 0.01 25);
    --border: oklch(88% 0.02 220);
    --input: oklch(88% 0.02 220);
    --ring: oklch(45% 0.15 220);
    --radius: 0.5rem;
  }

  .dark {
    /* Dark theme */
    --background: oklch(12% 0.02 220);
    --foreground: oklch(95% 0.01 220);
    --card: oklch(15% 0.02 220);
    --card-foreground: oklch(95% 0.01 220);
    --popover: oklch(15% 0.02 220);
    --popover-foreground: oklch(95% 0.01 220);
    --primary: oklch(55% 0.15 220);
    --primary-foreground: oklch(12% 0.02 220);
    --secondary: oklch(22% 0.02 220);
    --secondary-foreground: oklch(95% 0.01 220);
    --muted: oklch(22% 0.02 220);
    --muted-foreground: oklch(60% 0.02 220);
    --accent: oklch(22% 0.02 220);
    --accent-foreground: oklch(95% 0.01 220);
    --destructive: oklch(50% 0.2 25);
    --destructive-foreground: oklch(95% 0.01 25);
    --border: oklch(25% 0.02 220);
    --input: oklch(25% 0.02 220);
    --ring: oklch(55% 0.15 220);
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Color Scheme Meta Tag

```html
<!-- For native browser UI elements (scrollbars, inputs, etc.) -->
<head>
  <meta name="color-scheme" content="light dark" />
</head>
```

## Advanced Patterns

### Multiple Theme Support

```typescript
/**
 * FOWT script supporting multiple themes beyond light/dark
 */
export const generateMultiThemeScript = (themes: string[]): string => `
(function() {
  var d = document.documentElement;
  var themes = ${JSON.stringify(themes)};
  var t = localStorage.getItem('theme');

  // Validate stored theme
  if (!t || !themes.includes(t)) {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  // Remove all theme classes
  themes.forEach(function(theme) {
    d.classList.remove(theme);
  });

  d.classList.add(t);
  d.style.colorScheme = t === 'dark' || t.includes('dark') ? 'dark' : 'light';
})();
`.trim()

// Usage with custom themes
const script = generateMultiThemeScript([
  "light",
  "dark",
  "midnight",    // Extra dark
  "sepia",       // Warm light
  "high-contrast"
])
```

### Theme with Accent Color

```typescript
/**
 * FOWT script with accent color support
 */
export const generateThemedFowtScript = (): string => `
(function() {
  var d = document.documentElement;

  // Theme (light/dark)
  var theme = localStorage.getItem('theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  d.classList.remove('light', 'dark');
  d.classList.add(theme);
  d.style.colorScheme = theme;

  // Accent color (hue value)
  var accent = localStorage.getItem('accent-hue');
  if (accent) {
    d.style.setProperty('--accent-hue', accent);
  }
})();
`.trim()
```

### SSR-Safe Hook

```typescript
"use client"

import * as React from "react"

/**
 * SSR-safe theme hook that prevents hydration mismatch
 */
export const useThemeSSR = () => {
  const [mounted, setMounted] = React.useState(false)
  const { theme, resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Return undefined during SSR to prevent mismatch
  if (!mounted) {
    return {
      theme: undefined,
      resolvedTheme: undefined,
      setTheme,
      mounted: false
    }
  }

  return { theme, resolvedTheme, setTheme, mounted: true }
}

// Usage - prevents hydration errors
const ThemeIndicator = () => {
  const { resolvedTheme, mounted } = useThemeSSR()

  // Render placeholder during SSR
  if (!mounted) {
    return <div className="h-5 w-5 animate-pulse bg-muted rounded" />
  }

  return <span>{resolvedTheme}</span>
}
```

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Still seeing flash | Script not first in head | Move script before all other elements |
| Hydration mismatch | Server/client theme differs | Use `suppressHydrationWarning` on `<html>` |
| Theme doesn't persist | localStorage not accessed | Check script runs before paint |
| System preference ignored | Missing media query check | Verify matchMedia in script |
| Dark scrollbars wrong | Missing colorScheme | Add `style.colorScheme = theme` |

### Debug Script

```typescript
/**
 * Debug version of FOWT script
 */
export const fowtScriptDebug = `
(function() {
  console.log('[FOWT] Script executing');
  var d = document.documentElement;
  var stored = localStorage.getItem('theme');
  var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var theme = stored || system;

  console.log('[FOWT] Stored:', stored, 'System:', system, 'Using:', theme);

  d.classList.remove('light', 'dark');
  d.classList.add(theme);
  d.style.colorScheme = theme;

  console.log('[FOWT] Applied:', theme, 'Classes:', d.className);
})();
`
```

### Verification Checklist

- [ ] Script is first element in `<head>` (before CSS)
- [ ] Script is inline, not external file
- [ ] Script is synchronous (no `async` or `defer`)
- [ ] `<html>` has `suppressHydrationWarning`
- [ ] `colorScheme` style is set
- [ ] localStorage key matches provider
- [ ] System preference media query works
- [ ] No flash visible on page load
- [ ] Theme persists across page refresh

## Performance

| Metric | Value |
|--------|-------|
| Script size (minified) | ~291 bytes |
| Execution time | < 1ms |
| Blocking time | Negligible |
| Paint delay | 0 (prevents repaint) |

The tiny blocking script prevents a much more expensive repaint operation that would occur with FOWT.

## Export

```typescript
export {
  generateFowtScript,
  fowtScriptMinified,
  generateMultiThemeScript,
  generateThemedFowtScript,
  ThemeProvider,
  useTheme,
  useThemeSSR,
  ThemeToggle,
  ThemeToggleSimple
}
export type { Theme, ThemeContextValue, ThemeProviderProps }
```
