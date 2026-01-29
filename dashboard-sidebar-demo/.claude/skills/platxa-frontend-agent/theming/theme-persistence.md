# Theme Persistence System

Robust localStorage-based theme persistence with cross-tab sync, SSR safety, and fallback handling.

## Overview

Theme persistence ensures user preferences survive:
- Page refreshes
- Browser restarts
- Tab switches (cross-tab sync)
- SSR/hydration cycles

## Storage Schema

```typescript
interface ThemePreferences {
  theme: "light" | "dark" | "system"
  accentHue?: number              // 0-360
  radius?: "none" | "sm" | "md" | "lg" | "full"
  reducedMotion?: boolean
  highContrast?: boolean
  fontSize?: "sm" | "md" | "lg" | "xl"
  updatedAt: number               // Timestamp
}

interface StorageConfig {
  key: string                     // localStorage key
  version: number                 // Schema version for migrations
  defaults: Partial<ThemePreferences>
}
```

## Core Storage Utilities

### Safe localStorage Access

```typescript
/**
 * Check if localStorage is available (SSR-safe)
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = "__storage_test__"
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Safe localStorage getter
 */
const safeGetItem = (key: string): string | null => {
  if (typeof window === "undefined") return null
  if (!isLocalStorageAvailable()) return null

  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Safe localStorage setter
 */
const safeSetItem = (key: string, value: string): boolean => {
  if (typeof window === "undefined") return false
  if (!isLocalStorageAvailable()) return false

  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    // Quota exceeded or private browsing
    return false
  }
}

/**
 * Safe localStorage remover
 */
const safeRemoveItem = (key: string): boolean => {
  if (typeof window === "undefined") return false
  if (!isLocalStorageAvailable()) return false

  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
```

### Theme Storage Manager

```typescript
const DEFAULT_CONFIG: StorageConfig = {
  key: "theme-preferences",
  version: 1,
  defaults: {
    theme: "system",
    radius: "md",
    reducedMotion: false,
    highContrast: false,
    fontSize: "md"
  }
}

/**
 * Theme storage manager with versioning and migration support
 */
class ThemeStorage {
  private config: StorageConfig
  private cache: ThemePreferences | null = null

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get stored preferences with defaults
   */
  get(): ThemePreferences {
    // Return cache if available
    if (this.cache) return this.cache

    const raw = safeGetItem(this.config.key)
    if (!raw) {
      return this.getDefaults()
    }

    try {
      const parsed = JSON.parse(raw)

      // Version migration
      if (parsed._version !== this.config.version) {
        return this.migrate(parsed)
      }

      this.cache = { ...this.getDefaults(), ...parsed }
      return this.cache
    } catch {
      return this.getDefaults()
    }
  }

  /**
   * Store preferences
   */
  set(preferences: Partial<ThemePreferences>): boolean {
    const current = this.get()
    const updated: ThemePreferences = {
      ...current,
      ...preferences,
      updatedAt: Date.now()
    }

    const success = safeSetItem(
      this.config.key,
      JSON.stringify({ ...updated, _version: this.config.version })
    )

    if (success) {
      this.cache = updated
      this.notifyTabs(updated)
    }

    return success
  }

  /**
   * Update single preference
   */
  update<K extends keyof ThemePreferences>(
    key: K,
    value: ThemePreferences[K]
  ): boolean {
    return this.set({ [key]: value } as Partial<ThemePreferences>)
  }

  /**
   * Clear all preferences
   */
  clear(): boolean {
    this.cache = null
    return safeRemoveItem(this.config.key)
  }

  /**
   * Get default preferences
   */
  private getDefaults(): ThemePreferences {
    return {
      theme: "system",
      radius: "md",
      reducedMotion: false,
      highContrast: false,
      fontSize: "md",
      updatedAt: Date.now(),
      ...this.config.defaults
    } as ThemePreferences
  }

  /**
   * Migrate from old version
   */
  private migrate(old: Record<string, unknown>): ThemePreferences {
    // Handle version migrations here
    const migrated = this.getDefaults()

    // Preserve known fields
    if (typeof old.theme === "string") {
      migrated.theme = old.theme as ThemePreferences["theme"]
    }
    if (typeof old.accentHue === "number") {
      migrated.accentHue = old.accentHue
    }

    // Save migrated version
    this.set(migrated)
    return migrated
  }

  /**
   * Notify other tabs of changes
   */
  private notifyTabs(preferences: ThemePreferences): void {
    if (typeof window === "undefined") return

    // Use storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent("storage", {
      key: this.config.key,
      newValue: JSON.stringify(preferences)
    }))
  }

  /**
   * Subscribe to changes (including from other tabs)
   */
  subscribe(callback: (prefs: ThemePreferences) => void): () => void {
    if (typeof window === "undefined") return () => {}

    const handler = (event: StorageEvent) => {
      if (event.key === this.config.key && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue)
          this.cache = parsed
          callback(parsed)
        } catch {
          // Invalid JSON, ignore
        }
      }
    }

    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }
}

// Singleton instance
export const themeStorage = new ThemeStorage()
```

## React Integration

### useThemeStorage Hook

```typescript
"use client"

import * as React from "react"

interface UseThemeStorageOptions {
  key?: string
  defaults?: Partial<ThemePreferences>
}

/**
 * React hook for theme persistence
 */
export const useThemeStorage = (options: UseThemeStorageOptions = {}) => {
  const storage = React.useMemo(
    () => new ThemeStorage({
      key: options.key,
      defaults: options.defaults
    }),
    [options.key]
  )

  const [preferences, setPreferences] = React.useState<ThemePreferences>(
    () => storage.get()
  )
  const [mounted, setMounted] = React.useState(false)

  // Initialize on mount
  React.useEffect(() => {
    setPreferences(storage.get())
    setMounted(true)
  }, [storage])

  // Subscribe to cross-tab changes
  React.useEffect(() => {
    return storage.subscribe(setPreferences)
  }, [storage])

  // Update handler
  const updatePreference = React.useCallback(<K extends keyof ThemePreferences>(
    key: K,
    value: ThemePreferences[K]
  ) => {
    storage.update(key, value)
    setPreferences(prev => ({ ...prev, [key]: value }))
  }, [storage])

  // Batch update handler
  const updatePreferences = React.useCallback((
    updates: Partial<ThemePreferences>
  ) => {
    storage.set(updates)
    setPreferences(prev => ({ ...prev, ...updates }))
  }, [storage])

  // Reset handler
  const resetPreferences = React.useCallback(() => {
    storage.clear()
    setPreferences(storage.get())
  }, [storage])

  return {
    preferences,
    mounted,
    updatePreference,
    updatePreferences,
    resetPreferences,
    storage
  }
}
```

### usePersistedTheme Hook

```typescript
"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface UsePersistedThemeReturn {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
  mounted: boolean
}

/**
 * Hook for persisted theme with system preference detection
 */
export const usePersistedTheme = (
  storageKey = "theme"
): UsePersistedThemeReturn => {
  const [theme, setThemeState] = React.useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")
  const [mounted, setMounted] = React.useState(false)

  // Resolve system theme
  const getSystemTheme = React.useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }, [])

  // Initialize from storage
  React.useEffect(() => {
    const stored = safeGetItem(storageKey) as Theme | null
    const systemTheme = getSystemTheme()

    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored)
      setResolvedTheme(stored === "system" ? systemTheme : stored)
    } else {
      setResolvedTheme(systemTheme)
    }

    setMounted(true)
  }, [storageKey, getSystemTheme])

  // Listen for system theme changes
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        setResolvedTheme(e.matches ? "dark" : "light")
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  // Listen for cross-tab changes
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const newTheme = e.newValue as Theme
        setThemeState(newTheme)
        setResolvedTheme(
          newTheme === "system" ? getSystemTheme() : newTheme
        )
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [storageKey, getSystemTheme])

  // Set theme with persistence
  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)

    const resolved = newTheme === "system" ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)

    // Persist
    safeSetItem(storageKey, newTheme)

    // Apply to DOM
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolved)
    root.style.colorScheme = resolved
  }, [storageKey, getSystemTheme])

  return { theme, resolvedTheme, setTheme, mounted }
}
```

## Complete Theme Provider

```typescript
"use client"

import * as React from "react"

interface ThemeProviderProps {
  children: React.ReactNode
  storageKey?: string
  defaultTheme?: "light" | "dark" | "system"
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

interface ThemeContextValue {
  theme: "light" | "dark" | "system"
  resolvedTheme: "light" | "dark"
  setTheme: (theme: "light" | "dark" | "system") => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

export const ThemeProvider = ({
  children,
  storageKey = "theme",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false
}: ThemeProviderProps) => {
  const { theme, resolvedTheme, setTheme, mounted } = usePersistedTheme(storageKey)

  // Toggle between light and dark
  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  // Disable transitions during theme change (optional)
  const setThemeWithTransition = React.useCallback((newTheme: "light" | "dark" | "system") => {
    if (disableTransitionOnChange) {
      const css = document.createElement("style")
      css.appendChild(document.createTextNode(
        `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
      ))
      document.head.appendChild(css)

      setTheme(newTheme)

      // Force reflow
      ;(() => window.getComputedStyle(document.body))()

      // Re-enable transitions
      setTimeout(() => {
        document.head.removeChild(css)
      }, 1)
    } else {
      setTheme(newTheme)
    }
  }, [setTheme, disableTransitionOnChange])

  // Set initial theme on mount
  React.useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
  }, [mounted, resolvedTheme])

  const value = React.useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme: setThemeWithTransition,
    toggleTheme
  }), [theme, resolvedTheme, setThemeWithTransition, toggleTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
```

## Advanced Persistence Patterns

### Multi-Preference Storage

```typescript
/**
 * Store multiple design preferences
 */
const useDesignPreferences = () => {
  const { preferences, updatePreference, mounted } = useThemeStorage({
    key: "design-preferences",
    defaults: {
      theme: "system",
      accentHue: 220,
      radius: "md",
      fontSize: "md",
      reducedMotion: false
    }
  })

  // Apply all preferences to CSS variables
  React.useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    // Accent color
    if (preferences.accentHue !== undefined) {
      root.style.setProperty("--accent-hue", String(preferences.accentHue))
    }

    // Border radius
    const radiusMap = {
      none: "0",
      sm: "0.25rem",
      md: "0.5rem",
      lg: "0.75rem",
      full: "9999px"
    }
    root.style.setProperty("--radius", radiusMap[preferences.radius || "md"])

    // Font size
    const fontSizeMap = {
      sm: "14px",
      md: "16px",
      lg: "18px",
      xl: "20px"
    }
    root.style.setProperty("--base-font-size", fontSizeMap[preferences.fontSize || "md"])

    // Reduced motion
    if (preferences.reducedMotion) {
      root.classList.add("reduce-motion")
    } else {
      root.classList.remove("reduce-motion")
    }
  }, [mounted, preferences])

  return {
    preferences,
    updatePreference,
    mounted,
    setAccent: (hue: number) => updatePreference("accentHue", hue),
    setRadius: (radius: ThemePreferences["radius"]) => updatePreference("radius", radius),
    setFontSize: (size: ThemePreferences["fontSize"]) => updatePreference("fontSize", size),
    setReducedMotion: (enabled: boolean) => updatePreference("reducedMotion", enabled)
  }
}
```

### Cookie Fallback (For SSR)

```typescript
/**
 * Storage adapter with cookie fallback for SSR
 */
const createStorageAdapter = (key: string) => {
  return {
    get: (): string | null => {
      // Try localStorage first
      if (typeof window !== "undefined" && isLocalStorageAvailable()) {
        return localStorage.getItem(key)
      }

      // Fallback to cookie (SSR-safe)
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`))
        return match ? decodeURIComponent(match[2]) : null
      }

      return null
    },

    set: (value: string): void => {
      // Set in localStorage
      if (typeof window !== "undefined" && isLocalStorageAvailable()) {
        localStorage.setItem(key, value)
      }

      // Also set cookie for SSR access
      if (typeof document !== "undefined") {
        document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`
      }
    },

    remove: (): void => {
      if (typeof window !== "undefined" && isLocalStorageAvailable()) {
        localStorage.removeItem(key)
      }
      if (typeof document !== "undefined") {
        document.cookie = `${key}=;path=/;max-age=0`
      }
    }
  }
}
```

### Sync Across Origins (PostMessage)

```typescript
/**
 * Sync theme across iframes or subdomains
 */
const useThemeBroadcast = (origins: string[] = []) => {
  const { theme, setTheme } = useTheme()

  // Broadcast changes
  React.useEffect(() => {
    const broadcast = (newTheme: string) => {
      // To iframes
      document.querySelectorAll("iframe").forEach(iframe => {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "theme-change", theme: newTheme },
            "*"
          )
        }
      })

      // To parent (if in iframe)
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "theme-change", theme: newTheme },
          "*"
        )
      }
    }

    broadcast(theme)
  }, [theme])

  // Listen for broadcasts
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (origins.length > 0 && !origins.includes(event.origin)) {
        return
      }

      if (event.data?.type === "theme-change" && event.data?.theme) {
        setTheme(event.data.theme)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [origins, setTheme])
}
```

## Testing Utilities

```typescript
/**
 * Mock storage for testing
 */
class MockStorage implements Storage {
  private data: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.data).length
  }

  clear(): void {
    this.data = {}
  }

  getItem(key: string): string | null {
    return this.data[key] ?? null
  }

  key(index: number): string | null {
    return Object.keys(this.data)[index] ?? null
  }

  removeItem(key: string): void {
    delete this.data[key]
  }

  setItem(key: string, value: string): void {
    this.data[key] = value
  }
}

/**
 * Setup mock storage for tests
 */
export const setupMockStorage = () => {
  const mockStorage = new MockStorage()

  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true
  })

  return mockStorage
}

// Usage in tests
describe("ThemeStorage", () => {
  let storage: MockStorage

  beforeEach(() => {
    storage = setupMockStorage()
  })

  it("persists theme preference", () => {
    const themeStorage = new ThemeStorage()
    themeStorage.set({ theme: "dark" })

    expect(storage.getItem("theme-preferences")).toContain('"theme":"dark"')
  })

  it("retrieves stored preference", () => {
    storage.setItem("theme-preferences", JSON.stringify({
      theme: "dark",
      _version: 1
    }))

    const themeStorage = new ThemeStorage()
    expect(themeStorage.get().theme).toBe("dark")
  })
})
```

## Best Practices

| Do | Don't |
|----|-------|
| Use safe accessor functions | Access localStorage directly |
| Handle SSR with fallbacks | Assume window exists |
| Version your storage schema | Break existing preferences |
| Sync across tabs | Ignore storage events |
| Provide defaults | Return undefined |
| Cache reads in memory | Read storage repeatedly |
| Test with mock storage | Skip storage tests |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Theme resets on refresh | Storage not persisting | Check isLocalStorageAvailable |
| Hydration mismatch | Server/client differ | Use mounted check |
| Cross-tab not syncing | Missing storage listener | Add storage event handler |
| Private browsing fails | localStorage blocked | Use cookie fallback |
| Quota exceeded | Too much data | Store only essentials |

## Export

```typescript
export {
  ThemeStorage,
  themeStorage,
  useThemeStorage,
  usePersistedTheme,
  ThemeProvider,
  useTheme,
  useDesignPreferences,
  createStorageAdapter,
  useThemeBroadcast,
  isLocalStorageAvailable,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  setupMockStorage
}
export type {
  ThemePreferences,
  StorageConfig,
  ThemeProviderProps,
  ThemeContextValue
}
```
