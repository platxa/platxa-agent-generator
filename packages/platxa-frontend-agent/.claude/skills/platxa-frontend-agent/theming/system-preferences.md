# System Preference Detection

Detect and respond to OS-level user preferences including dark mode, reduced motion, contrast, and transparency.

## Overview

Modern operating systems expose user preferences through CSS media queries:
- `prefers-color-scheme` - Light or dark theme
- `prefers-reduced-motion` - Minimize animations
- `prefers-contrast` - High contrast mode
- `prefers-reduced-transparency` - Solid backgrounds
- `prefers-reduced-data` - Minimize data usage

## Media Queries Reference

| Query | Values | Description |
|-------|--------|-------------|
| `prefers-color-scheme` | `light`, `dark` | OS theme preference |
| `prefers-reduced-motion` | `reduce`, `no-preference` | Animation preference |
| `prefers-contrast` | `more`, `less`, `no-preference` | Contrast preference |
| `prefers-reduced-transparency` | `reduce`, `no-preference` | Transparency preference |
| `prefers-reduced-data` | `reduce`, `no-preference` | Data saving preference |

## Core Detection Utilities

### Type Definitions

```typescript
interface SystemPreferences {
  colorScheme: "light" | "dark"
  reducedMotion: boolean
  highContrast: boolean
  reducedTransparency: boolean
  reducedData: boolean
}

interface UseMediaQueryOptions {
  defaultValue?: boolean
  initializeWithValue?: boolean
}
```

### Generic Media Query Hook

```typescript
"use client"

import * as React from "react"

/**
 * SSR-safe media query hook with change detection
 */
export const useMediaQuery = (
  query: string,
  options: UseMediaQueryOptions = {}
): boolean => {
  const { defaultValue = false, initializeWithValue = true } = options

  const getMatches = React.useCallback((): boolean => {
    if (typeof window === "undefined") return defaultValue
    return window.matchMedia(query).matches
  }, [query, defaultValue])

  const [matches, setMatches] = React.useState<boolean>(() => {
    if (initializeWithValue) {
      return getMatches()
    }
    return defaultValue
  })

  // Handle SSR hydration
  React.useEffect(() => {
    setMatches(getMatches())
  }, [getMatches])

  // Listen for changes
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia(query)

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}
```

## Color Scheme Detection

### usePrefersDark Hook

```typescript
"use client"

/**
 * Detect if user prefers dark color scheme
 */
export const usePrefersDark = (): boolean => {
  return useMediaQuery("(prefers-color-scheme: dark)")
}

/**
 * Detect if user prefers light color scheme
 */
export const usePrefersLight = (): boolean => {
  return useMediaQuery("(prefers-color-scheme: light)")
}

/**
 * Get color scheme preference with explicit value
 */
export const useColorScheme = (): "light" | "dark" => {
  const prefersDark = usePrefersDark()
  return prefersDark ? "dark" : "light"
}
```

### Color Scheme with Callback

```typescript
"use client"

import * as React from "react"

interface UseColorSchemeWithCallbackOptions {
  onDark?: () => void
  onLight?: () => void
  onChange?: (scheme: "light" | "dark") => void
}

/**
 * Color scheme hook with change callbacks
 */
export const useColorSchemeWithCallback = (
  options: UseColorSchemeWithCallbackOptions = {}
): "light" | "dark" => {
  const { onDark, onLight, onChange } = options
  const prefersDark = usePrefersDark()
  const scheme = prefersDark ? "dark" : "light"
  const previousScheme = React.useRef(scheme)

  React.useEffect(() => {
    if (scheme !== previousScheme.current) {
      previousScheme.current = scheme
      onChange?.(scheme)

      if (scheme === "dark") {
        onDark?.()
      } else {
        onLight?.()
      }
    }
  }, [scheme, onChange, onDark, onLight])

  return scheme
}

// Usage
const App = () => {
  const scheme = useColorSchemeWithCallback({
    onDark: () => console.log("Switched to dark mode"),
    onLight: () => console.log("Switched to light mode"),
    onChange: (s) => analytics.track("theme_change", { scheme: s })
  })

  return <div className={scheme}>...</div>
}
```

## Reduced Motion Detection

### usePrefersReducedMotion Hook

```typescript
"use client"

/**
 * Detect if user prefers reduced motion
 * Returns true if user has enabled "Reduce motion" in OS settings
 */
export const usePrefersReducedMotion = (): boolean => {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

/**
 * Get motion preference for conditional rendering
 */
export const useMotionPreference = (): "full" | "reduced" => {
  const prefersReduced = usePrefersReducedMotion()
  return prefersReduced ? "reduced" : "full"
}
```

### Motion-Safe Animation Hook

```typescript
"use client"

import * as React from "react"
import { type Variants } from "framer-motion"

interface UseMotionSafeOptions {
  full: Variants
  reduced?: Variants
}

/**
 * Return appropriate animation variants based on motion preference
 */
export const useMotionSafe = (options: UseMotionSafeOptions): Variants => {
  const prefersReduced = usePrefersReducedMotion()

  return React.useMemo(() => {
    if (prefersReduced) {
      // Return reduced or empty variants
      return options.reduced ?? {
        initial: {},
        animate: {},
        exit: {}
      }
    }
    return options.full
  }, [prefersReduced, options.full, options.reduced])
}

// Usage
const fadeInVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

const AnimatedCard = () => {
  const variants = useMotionSafe({
    full: fadeInVariants,
    reduced: reducedVariants
  })

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      Content
    </motion.div>
  )
}
```

## Contrast Detection

### usePrefersContrast Hook

```typescript
"use client"

type ContrastPreference = "more" | "less" | "no-preference"

/**
 * Detect contrast preference
 */
export const usePrefersContrast = (): ContrastPreference => {
  const prefersMore = useMediaQuery("(prefers-contrast: more)")
  const prefersLess = useMediaQuery("(prefers-contrast: less)")

  if (prefersMore) return "more"
  if (prefersLess) return "less"
  return "no-preference"
}

/**
 * Simple boolean for high contrast mode
 */
export const usePrefersHighContrast = (): boolean => {
  return useMediaQuery("(prefers-contrast: more)")
}
```

## All System Preferences

### useSystemPreferences Hook

```typescript
"use client"

import * as React from "react"

/**
 * Get all system preferences in one hook
 */
export const useSystemPreferences = (): SystemPreferences => {
  const colorScheme = useColorScheme()
  const reducedMotion = usePrefersReducedMotion()
  const highContrast = usePrefersHighContrast()
  const reducedTransparency = useMediaQuery("(prefers-reduced-transparency: reduce)")
  const reducedData = useMediaQuery("(prefers-reduced-data: reduce)")

  return React.useMemo(() => ({
    colorScheme,
    reducedMotion,
    highContrast,
    reducedTransparency,
    reducedData
  }), [colorScheme, reducedMotion, highContrast, reducedTransparency, reducedData])
}

// Usage
const App = () => {
  const prefs = useSystemPreferences()

  return (
    <div
      className={cn(
        prefs.colorScheme,
        prefs.reducedMotion && "reduce-motion",
        prefs.highContrast && "high-contrast"
      )}
    >
      {/* App content */}
    </div>
  )
}
```

### System Preferences Context

```typescript
"use client"

import * as React from "react"

const SystemPreferencesContext = React.createContext<SystemPreferences | null>(null)

interface SystemPreferencesProviderProps {
  children: React.ReactNode
}

export const SystemPreferencesProvider = ({
  children
}: SystemPreferencesProviderProps) => {
  const preferences = useSystemPreferences()

  // Apply preferences to document
  React.useEffect(() => {
    const root = document.documentElement

    // Color scheme
    root.classList.remove("light", "dark")
    root.classList.add(preferences.colorScheme)
    root.style.colorScheme = preferences.colorScheme

    // Reduced motion
    root.classList.toggle("reduce-motion", preferences.reducedMotion)

    // High contrast
    root.classList.toggle("high-contrast", preferences.highContrast)

    // Reduced transparency
    root.classList.toggle("reduce-transparency", preferences.reducedTransparency)
  }, [preferences])

  return (
    <SystemPreferencesContext.Provider value={preferences}>
      {children}
    </SystemPreferencesContext.Provider>
  )
}

export const useSystemPreferencesContext = (): SystemPreferences => {
  const context = React.useContext(SystemPreferencesContext)
  if (!context) {
    throw new Error("useSystemPreferencesContext must be used within SystemPreferencesProvider")
  }
  return context
}
```

## CSS Integration

### Pure CSS Detection

```css
/* Dark mode styles */
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(12% 0.02 220);
    --foreground: oklch(95% 0.01 220);
  }
}

/* Light mode styles */
@media (prefers-color-scheme: light) {
  :root {
    --background: oklch(98% 0.01 220);
    --foreground: oklch(15% 0.02 220);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast */
@media (prefers-contrast: more) {
  :root {
    --border: oklch(0% 0 0);
    --ring: oklch(0% 0 0);
  }

  * {
    border-color: var(--border) !important;
    outline-color: var(--ring) !important;
  }
}

/* Reduced transparency */
@media (prefers-reduced-transparency: reduce) {
  .glass,
  .backdrop-blur {
    backdrop-filter: none !important;
    background: var(--background) !important;
  }
}
```

### Tailwind CSS Classes

```css
/* globals.css */
@layer utilities {
  /* Motion-safe animations */
  .motion-safe\:animate-fade-in {
    @media (prefers-reduced-motion: no-preference) {
      animation: fade-in 0.3s ease-out;
    }
  }

  /* Motion-reduce instant transitions */
  .motion-reduce\:transition-none {
    @media (prefers-reduced-motion: reduce) {
      transition: none !important;
    }
  }

  /* Dark mode utilities */
  .dark-mode\:hidden {
    @media (prefers-color-scheme: dark) {
      display: none;
    }
  }

  .light-mode\:hidden {
    @media (prefers-color-scheme: light) {
      display: none;
    }
  }

  /* High contrast utilities */
  .contrast-more\:border-2 {
    @media (prefers-contrast: more) {
      border-width: 2px;
    }
  }
}
```

### Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  darkMode: "media", // Use system preference
  theme: {
    extend: {
      screens: {
        // Custom media query screens
        "motion-safe": { raw: "(prefers-reduced-motion: no-preference)" },
        "motion-reduce": { raw: "(prefers-reduced-motion: reduce)" },
        "contrast-more": { raw: "(prefers-contrast: more)" },
        "contrast-less": { raw: "(prefers-contrast: less)" },
      }
    }
  }
} satisfies Config

// Usage in components:
// <div className="motion-safe:animate-bounce motion-reduce:animate-none">
// <div className="contrast-more:border-2 contrast-more:border-black">
```

## Non-Reactive Detection

### One-Time Check

```typescript
/**
 * Get current system preferences (non-reactive)
 * Use for initial setup or SSR
 */
export const getSystemPreferences = (): SystemPreferences => {
  if (typeof window === "undefined") {
    // SSR defaults
    return {
      colorScheme: "light",
      reducedMotion: false,
      highContrast: false,
      reducedTransparency: false,
      reducedData: false
    }
  }

  return {
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    highContrast: window.matchMedia("(prefers-contrast: more)").matches,
    reducedTransparency: window.matchMedia("(prefers-reduced-transparency: reduce)").matches,
    reducedData: window.matchMedia("(prefers-reduced-data: reduce)").matches
  }
}

/**
 * Check specific preference
 */
export const prefersColorScheme = (scheme: "light" | "dark"): boolean => {
  if (typeof window === "undefined") return scheme === "light"
  return window.matchMedia(`(prefers-color-scheme: ${scheme})`).matches
}

export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
```

### FOWT Script Integration

```typescript
/**
 * Generate head script that respects all preferences
 */
export const generatePreferencesScript = (): string => `
(function() {
  var d = document.documentElement;
  var m = window.matchMedia;

  // Color scheme
  var dark = m('(prefers-color-scheme: dark)').matches;
  d.classList.add(dark ? 'dark' : 'light');
  d.style.colorScheme = dark ? 'dark' : 'light';

  // Reduced motion
  if (m('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('reduce-motion');
  }

  // High contrast
  if (m('(prefers-contrast: more)').matches) {
    d.classList.add('high-contrast');
  }

  // Reduced transparency
  if (m('(prefers-reduced-transparency: reduce)').matches) {
    d.classList.add('reduce-transparency');
  }
})();
`.trim()
```

## Component Examples

### Adaptive Animation Component

```typescript
import { motion, AnimatePresence } from "framer-motion"

interface AdaptiveAnimationProps {
  children: React.ReactNode
  className?: string
}

export const AdaptiveAnimation = ({
  children,
  className
}: AdaptiveAnimationProps) => {
  const prefersReduced = usePrefersReducedMotion()

  if (prefersReduced) {
    // No animation wrapper
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

### Theme-Aware Image

```typescript
interface ThemeAwareImageProps {
  lightSrc: string
  darkSrc: string
  alt: string
  className?: string
}

export const ThemeAwareImage = ({
  lightSrc,
  darkSrc,
  alt,
  className
}: ThemeAwareImageProps) => {
  const colorScheme = useColorScheme()

  return (
    <img
      src={colorScheme === "dark" ? darkSrc : lightSrc}
      alt={alt}
      className={className}
    />
  )
}

// Alternative: Pure HTML with media query
export const ThemeAwareImagePure = ({
  lightSrc,
  darkSrc,
  alt,
  className
}: ThemeAwareImageProps) => (
  <picture className={className}>
    <source srcSet={darkSrc} media="(prefers-color-scheme: dark)" />
    <source srcSet={lightSrc} media="(prefers-color-scheme: light)" />
    <img src={lightSrc} alt={alt} />
  </picture>
)
```

### Contrast-Aware Button

```typescript
import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      contrast: {
        normal: "border border-input",
        high: "border-2 border-black dark:border-white"
      }
    },
    defaultVariants: {
      contrast: "normal"
    }
  }
)

export const ContrastAwareButton = ({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const highContrast = usePrefersHighContrast()

  return (
    <button
      className={cn(
        buttonVariants({ contrast: highContrast ? "high" : "normal" }),
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

## Testing

```typescript
/**
 * Mock matchMedia for testing
 */
export const mockMatchMedia = (matches: Partial<SystemPreferences> = {}) => {
  const defaultMatches = {
    colorScheme: "light" as const,
    reducedMotion: false,
    highContrast: false,
    reducedTransparency: false,
    reducedData: false,
    ...matches
  }

  const queries: Record<string, boolean> = {
    "(prefers-color-scheme: dark)": defaultMatches.colorScheme === "dark",
    "(prefers-color-scheme: light)": defaultMatches.colorScheme === "light",
    "(prefers-reduced-motion: reduce)": defaultMatches.reducedMotion,
    "(prefers-contrast: more)": defaultMatches.highContrast,
    "(prefers-reduced-transparency: reduce)": defaultMatches.reducedTransparency,
    "(prefers-reduced-data: reduce)": defaultMatches.reducedData
  }

  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: queries[query] ?? false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
}

// Usage in tests
describe("usePrefersDark", () => {
  it("returns true when system is dark", () => {
    mockMatchMedia({ colorScheme: "dark" })

    const { result } = renderHook(() => usePrefersDark())
    expect(result.current).toBe(true)
  })
})
```

## Export

```typescript
export {
  // Core hook
  useMediaQuery,

  // Color scheme
  usePrefersDark,
  usePrefersLight,
  useColorScheme,
  useColorSchemeWithCallback,

  // Motion
  usePrefersReducedMotion,
  useMotionPreference,
  useMotionSafe,

  // Contrast
  usePrefersContrast,
  usePrefersHighContrast,

  // All preferences
  useSystemPreferences,
  SystemPreferencesProvider,
  useSystemPreferencesContext,

  // Non-reactive
  getSystemPreferences,
  prefersColorScheme,
  prefersReducedMotion,

  // Script
  generatePreferencesScript,

  // Components
  AdaptiveAnimation,
  ThemeAwareImage,
  ThemeAwareImagePure,
  ContrastAwareButton,

  // Testing
  mockMatchMedia
}
export type { SystemPreferences, UseMediaQueryOptions, ContrastPreference }
```
