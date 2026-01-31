/**
 * Utils Module Tests
 *
 * Tests for core utility functions used throughout the application.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  cn,
  formatCompact,
  generateId,
  isBrowser,
  prefersReducedMotion,
  delay,
} from "../utils"

// =============================================================================
// CN (CLASS NAME MERGER)
// =============================================================================

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    const isActive = true
    const isInactive = false
    expect(cn("base", isActive && "active")).toBe("base active")
    expect(cn("base", isInactive && "active")).toBe("base")
  })

  it("merges Tailwind classes correctly", () => {
    // Later class should override earlier conflicting class
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("handles arrays of classes", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar")
  })

  it("handles objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz")
  })

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, "bar", null)).toBe("foo bar")
  })

  it("handles empty inputs", () => {
    expect(cn()).toBe("")
    expect(cn("")).toBe("")
  })

  it("handles complex Tailwind merging", () => {
    // Focus ring classes
    expect(cn("focus:ring-2", "focus:ring-4")).toBe("focus:ring-4")
    // Hover states
    expect(cn("hover:bg-red-500", "hover:bg-blue-500")).toBe("hover:bg-blue-500")
    // Dark mode
    expect(cn("dark:bg-gray-900", "dark:bg-gray-800")).toBe("dark:bg-gray-800")
  })
})

// =============================================================================
// FORMAT COMPACT
// =============================================================================

describe("formatCompact", () => {
  it("formats small numbers as-is", () => {
    expect(formatCompact(0)).toBe("0")
    expect(formatCompact(1)).toBe("1")
    expect(formatCompact(999)).toBe("999")
  })

  it("formats thousands with K suffix", () => {
    expect(formatCompact(1000)).toBe("1K")
    expect(formatCompact(1500)).toBe("1.5K")
    expect(formatCompact(10000)).toBe("10K")
    expect(formatCompact(999999)).toBe("1M")
  })

  it("formats millions with M suffix", () => {
    expect(formatCompact(1000000)).toBe("1M")
    expect(formatCompact(1500000)).toBe("1.5M")
    expect(formatCompact(10000000)).toBe("10M")
  })

  it("formats billions with B suffix", () => {
    expect(formatCompact(1000000000)).toBe("1B")
    expect(formatCompact(1500000000)).toBe("1.5B")
  })

  it("handles negative numbers", () => {
    expect(formatCompact(-1000)).toBe("-1K")
    expect(formatCompact(-1000000)).toBe("-1M")
  })

  it("handles decimal numbers", () => {
    expect(formatCompact(1234.56)).toBe("1.2K")
  })
})

// =============================================================================
// GENERATE ID
// =============================================================================

describe("generateId", () => {
  it("generates unique IDs", () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it("uses default prefix", () => {
    const id = generateId()
    expect(id).toMatch(/^platxa-[a-z0-9]+$/)
  })

  it("uses custom prefix", () => {
    const id = generateId("custom")
    expect(id).toMatch(/^custom-[a-z0-9]+$/)
  })

  it("generates IDs with consistent format", () => {
    const id = generateId("test")
    // Should be prefix + hyphen + 9 alphanumeric chars
    expect(id.length).toBeGreaterThan(5)
    expect(id).toMatch(/^test-[a-z0-9]+$/)
  })

  it("generates many unique IDs", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId())
    }
    // All 1000 should be unique
    expect(ids.size).toBe(1000)
  })
})

// =============================================================================
// IS BROWSER
// =============================================================================

describe("isBrowser", () => {
  it("is a boolean", () => {
    expect(typeof isBrowser).toBe("boolean")
  })

  it("detects browser environment in test (jsdom)", () => {
    // In vitest with jsdom, window is defined
    expect(isBrowser).toBe(true)
  })
})

// =============================================================================
// PREFERS REDUCED MOTION
// =============================================================================

describe("prefersReducedMotion", () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it("returns false when reduced motion is not preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(prefersReducedMotion()).toBe(false)
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)"
    )
  })

  it("returns true when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(prefersReducedMotion()).toBe(true)
  })
})

// =============================================================================
// DELAY
// =============================================================================

describe("delay", () => {
  it("delays for specified milliseconds", async () => {
    const start = Date.now()
    await delay(50)
    const elapsed = Date.now() - start

    // Allow some tolerance for timing variations
    expect(elapsed).toBeGreaterThanOrEqual(45)
    expect(elapsed).toBeLessThan(150)
  })

  it("resolves to undefined", async () => {
    const result = await delay(1)
    expect(result).toBeUndefined()
  })

  it("works with 0ms", async () => {
    const start = Date.now()
    await delay(0)
    const elapsed = Date.now() - start

    // Should be nearly instant
    expect(elapsed).toBeLessThan(50)
  })

  it("can be used in sequence", async () => {
    const start = Date.now()
    await delay(10)
    await delay(10)
    await delay(10)
    const elapsed = Date.now() - start

    // At least 30ms total
    expect(elapsed).toBeGreaterThanOrEqual(25)
  })
})
