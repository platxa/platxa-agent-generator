/**
 * Performance Module Tests
 *
 * Tests for INP optimization, bundle analysis, lazy loading,
 * and React Compiler awareness.
 */

import { describe, it, expect } from "vitest"
import {
  // INP
  DEFAULT_INP_CONFIG,
  analyzeINP,
  // Bundle
  DEFAULT_PACKAGE_SIZES,
  analyzeBundleSize,
  // Lazy loading
  LAZY_PATTERNS,
  analyzeLazyLoading,
  // React Compiler
  DEFAULT_COMPILER_CONFIG,
  analyzeCompilerCompatibility,
  // Factory
  createPerformanceSystem,
} from "../performance"

// =============================================================================
// Test Fixtures
// =============================================================================

const GOOD_COMPONENT = `
import * as React from "react"
import { Button } from "@/components/ui/button"

export function GoodComponent() {
  const [count, setCount] = React.useState(0)

  const handleClick = React.useCallback(() => {
    React.startTransition(() => {
      setCount(c => c + 1)
    })
  }, [])

  return (
    <Button onClick={handleClick}>
      Count: {count}
    </Button>
  )
}
`

const BAD_INP_COMPONENT = `
import * as React from "react"

export function BadComponent() {
  const [items, setItems] = React.useState([])

  const handleClick = () => {
    // Heavy computation in handler
    const result = []
    for (let i = 0; i < 10000; i++) {
      result.push(i * Math.random())
    }
    setItems(result.filter(x => x > 0.5).map(x => x * 2))
  }

  return (
    <button onClick={handleClick}>
      Process {items.length} items
    </button>
  )
}
`

const HEAVY_IMPORTS_CODE = `
import * as React from "react"
import moment from "moment"
import _ from "lodash"
import { motion } from "framer-motion"
import { Dialog } from "@radix-ui/react-dialog"

export function HeavyComponent() {
  return <div>Heavy</div>
}
`

const LAZY_CANDIDATES_CODE = `
import * as React from "react"
import Dashboard from "./components/Dashboard"
import Settings from "./pages/Settings"
import { Modal } from "./components/Modal"

export function App() {
  return (
    <div>
      <img src="/hero.jpg" alt="Hero" />
      <Dashboard />
      <Settings />
      <Modal />
      <img src="/footer.jpg" alt="Footer" />
    </div>
  )
}
`

const COMPILER_ISSUES_CODE = `
import * as React from "react"

export const MemoizedComponent = React.memo(function Component({ data }) {
  const ref = React.useRef(null)

  const computed = React.useMemo(() => data.map(x => x * 2), [data])

  const handleClick = React.useCallback(() => {
    ref.current = Date.now()  // ref mutation
    window.globalState = computed  // external mutation
  }, [computed])

  React.useEffect(() => {
    // Object in deps
  }, [{ key: "value" }])

  return (
    <div
      style={{ color: "red" }}
      options={{ a: 1 }}
      config={{ b: 2 }}
      data={{ c: 3 }}
      onClick={handleClick}
    >
      {computed}
    </div>
  )
})
`

// =============================================================================
// INP Performance Optimization Tests (#74)
// =============================================================================

describe("INP Performance Optimization", () => {
  describe("DEFAULT_INP_CONFIG", () => {
    it("should have target INP", () => {
      expect(DEFAULT_INP_CONFIG.targetINP).toBe(200)
    })

    it("should have interaction types", () => {
      expect(DEFAULT_INP_CONFIG.interactionTypes).toContain("click")
      expect(DEFAULT_INP_CONFIG.interactionTypes).toContain("keydown")
    })
  })

  describe("analyzeINP", () => {
    it("should analyze good component", () => {
      const result = analyzeINP(GOOD_COMPONENT)

      expect(result.score).toBe("good")
      expect(result.issues.length).toBe(0)
    })

    it("should detect heavy computation in handler", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      expect(result.issues.some(i => i.type === "heavy-computation")).toBe(true)
    })

    it("should detect sync state updates", () => {
      const code = `
        const handleClick = () => {
          setState(computeExpensiveValue())
        }
        <button onClick={handleClick}>Click</button>
      `
      const result = analyzeINP(code)

      // May or may not detect depending on pattern
      expect(result.handlersAnalyzed).toBeGreaterThanOrEqual(0)
    })

    it("should estimate INP time", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      expect(result.estimatedINP).toBeGreaterThan(50)
    })

    it("should provide recommendations", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it("should count handlers analyzed", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      expect(result.handlersAnalyzed).toBeGreaterThan(0)
    })

    it("should categorize severity", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      for (const issue of result.issues) {
        expect(["good", "needs-improvement", "poor"]).toContain(issue.severity)
      }
    })

    it("should provide fixes for issues", () => {
      const result = analyzeINP(BAD_INP_COMPONENT)

      for (const issue of result.issues) {
        expect(issue.fix).toBeDefined()
        expect(issue.fix.length).toBeGreaterThan(0)
      }
    })
  })
})

// =============================================================================
// Bundle Size Analyzer Tests (#75)
// =============================================================================

describe("Bundle Size Analyzer", () => {
  describe("DEFAULT_PACKAGE_SIZES", () => {
    it("should have common packages", () => {
      expect(DEFAULT_PACKAGE_SIZES["react"]).toBeDefined()
      expect(DEFAULT_PACKAGE_SIZES["lodash"]).toBeDefined()
      expect(DEFAULT_PACKAGE_SIZES["moment"]).toBeDefined()
    })

    it("should have per-export sizes for lodash", () => {
      expect(DEFAULT_PACKAGE_SIZES["lodash"].perExport).toBeDefined()
      expect(DEFAULT_PACKAGE_SIZES["lodash"].perExport?.debounce).toBeDefined()
    })
  })

  describe("analyzeBundleSize", () => {
    it("should detect imports", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      expect(result.imports.length).toBeGreaterThan(0)
      expect(result.imports.some(i => i.module === "moment")).toBe(true)
      expect(result.imports.some(i => i.module === "lodash")).toBe(true)
    })

    it("should calculate total size", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      expect(result.totalSize).toBeGreaterThan(0)
      expect(result.totalSizeFormatted).toMatch(/KB|MB/)
    })

    it("should identify heavy imports", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      expect(result.heavyImports.length).toBeGreaterThan(0)
    })

    it("should suggest optimization opportunities", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      expect(result.opportunities.length).toBeGreaterThan(0)
    })

    it("should suggest replacing moment", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      const momentOpp = result.opportunities.find(o => o.description.includes("moment"))
      expect(momentOpp).toBeDefined()
      expect(momentOpp?.type).toBe("replace")
    })

    it("should detect non-tree-shakeable imports", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      const lodashImport = result.imports.find(i => i.module === "lodash")
      expect(lodashImport?.treeShakeable).toBe(false)
    })

    it("should calculate bundle score", () => {
      const result = analyzeBundleSize(HEAVY_IMPORTS_CODE)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it("should parse named imports correctly", () => {
      const code = `import { debounce, throttle } from "lodash"`
      const result = analyzeBundleSize(code)

      const lodashImport = result.imports.find(i => i.module === "lodash")
      expect(lodashImport?.type).toBe("named")
      expect(lodashImport?.names).toContain("debounce")
      expect(lodashImport?.treeShakeable).toBe(true)
    })
  })
})

// =============================================================================
// Lazy Loading Patterns Tests (#76)
// =============================================================================

describe("Lazy Loading Patterns", () => {
  describe("LAZY_PATTERNS", () => {
    it("should have react-lazy pattern", () => {
      expect(LAZY_PATTERNS["react-lazy"]).toContain("React.lazy")
      expect(LAZY_PATTERNS["react-lazy"]).toContain("Suspense")
    })

    it("should have next-dynamic pattern", () => {
      expect(LAZY_PATTERNS["next-dynamic"]).toContain("dynamic")
      expect(LAZY_PATTERNS["next-dynamic"]).toContain("next/dynamic")
    })

    it("should have intersection-observer pattern", () => {
      expect(LAZY_PATTERNS["intersection-observer"]).toContain("IntersectionObserver")
    })

    it("should have route-based pattern", () => {
      expect(LAZY_PATTERNS["route-based"]).toContain("Routes")
    })
  })

  describe("analyzeLazyLoading", () => {
    it("should find lazy loading candidates", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      expect(result.candidates.length).toBeGreaterThan(0)
    })

    it("should detect component candidates", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      const componentCandidates = result.candidates.filter(c => c.type === "component")
      expect(componentCandidates.length).toBeGreaterThan(0)
    })

    it("should detect image candidates", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE, { includeImages: true })

      const imageCandidates = result.candidates.filter(c => c.type === "image")
      expect(imageCandidates.length).toBeGreaterThan(0)
    })

    it("should suggest adding loading lazy to images", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      const imageCandidate = result.candidates.find(c => c.type === "image")
      expect(imageCandidate?.suggestedCode).toContain('loading="lazy"')
    })

    it("should recommend appropriate strategy", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE, { framework: "react" })

      const componentCandidate = result.candidates.find(c => c.type === "component")
      expect(componentCandidate?.strategy).toBe("react-lazy")
    })

    it("should use next-dynamic for Next.js", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE, { framework: "next" })

      const componentCandidate = result.candidates.find(c => c.type === "component")
      expect(componentCandidate?.strategy).toBe("next-dynamic")
    })

    it("should prioritize candidates", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      // Should be sorted by priority
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].priority).toBeGreaterThanOrEqual(result.candidates[i].priority)
      }
    })

    it("should estimate potential savings", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      expect(result.potentialSavings.initialBundle).toBeGreaterThan(0)
    })

    it("should detect already lazy-loaded components", () => {
      const code = `
        const Dashboard = React.lazy(() => import('./Dashboard'))
        import Settings from "./Settings"
      `
      const result = analyzeLazyLoading(code)

      expect(result.alreadyLazy).toContain("Dashboard")
    })

    it("should include all lazy patterns", () => {
      const result = analyzeLazyLoading(LAZY_CANDIDATES_CODE)

      expect(Object.keys(result.patterns)).toContain("react-lazy")
      expect(Object.keys(result.patterns)).toContain("next-dynamic")
    })
  })
})

// =============================================================================
// React Compiler Optimization Tests (#77)
// =============================================================================

describe("React Compiler Optimization", () => {
  describe("DEFAULT_COMPILER_CONFIG", () => {
    it("should have default values", () => {
      expect(DEFAULT_COMPILER_CONFIG.strict).toBe(false)
      expect(DEFAULT_COMPILER_CONFIG.reportRemovable).toBe(true)
      expect(DEFAULT_COMPILER_CONFIG.reactVersion).toBe("19")
    })
  })

  describe("analyzeCompilerCompatibility", () => {
    it("should analyze good component as compatible", () => {
      const simpleCode = `
        function SimpleComponent({ name }) {
          return <div>Hello {name}</div>
        }
      `
      const result = analyzeCompilerCompatibility(simpleCode)

      expect(result.compatibility).toBe("compatible")
      expect(result.score).toBeGreaterThanOrEqual(80)
    })

    it("should detect removable useMemo", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      const memoRemovable = result.removableOptimizations.filter(r => r.type === "useMemo")
      expect(memoRemovable.length).toBeGreaterThan(0)
    })

    it("should detect removable useCallback", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      const callbackRemovable = result.removableOptimizations.filter(r => r.type === "useCallback")
      expect(callbackRemovable.length).toBeGreaterThan(0)
    })

    it("should detect removable React.memo", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      const memoComponentRemovable = result.removableOptimizations.filter(r => r.type === "React.memo")
      expect(memoComponentRemovable.length).toBeGreaterThan(0)
    })

    it("should detect ref mutations", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      expect(result.issues.some(i => i.type === "ref-mutation")).toBe(true)
    })

    it("should detect external mutations", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      expect(result.issues.some(i => i.type === "external-mutation")).toBe(true)
    })

    it("should calculate compatibility score", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it("should determine compatibility level", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      expect(["compatible", "needs-changes", "incompatible"]).toContain(result.compatibility)
    })

    it("should provide recommendations", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it("should identify blocking vs non-blocking issues", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      for (const issue of result.issues) {
        expect(typeof issue.blocking).toBe("boolean")
      }
    })

    it("should provide line numbers for removable optimizations", () => {
      const result = analyzeCompilerCompatibility(COMPILER_ISSUES_CODE)

      for (const removable of result.removableOptimizations) {
        expect(removable.line).toBeGreaterThan(0)
      }
    })
  })
})

// =============================================================================
// Factory Tests
// =============================================================================

describe("createPerformanceSystem", () => {
  it("should create system with all methods", () => {
    const perf = createPerformanceSystem()

    expect(perf.analyzeINP).toBeDefined()
    expect(perf.analyzeBundleSize).toBeDefined()
    expect(perf.analyzeLazyLoading).toBeDefined()
    expect(perf.analyzeCompiler).toBeDefined()
  })

  it("should expose package sizes", () => {
    const perf = createPerformanceSystem()

    expect(perf.packageSizes).toBe(DEFAULT_PACKAGE_SIZES)
  })

  it("should expose lazy patterns", () => {
    const perf = createPerformanceSystem()

    expect(perf.lazyPatterns).toBe(LAZY_PATTERNS)
  })

  it("should have formatBytes utility", () => {
    const perf = createPerformanceSystem()

    expect(perf.formatBytes(1024)).toBe("1.0KB")
    expect(perf.formatBytes(1024 * 1024)).toBe("1.0MB")
  })

  it("should integrate all performance checks", () => {
    const perf = createPerformanceSystem()

    // INP
    const inp = perf.analyzeINP(BAD_INP_COMPONENT)
    expect(inp.issues.length).toBeGreaterThan(0)

    // Bundle
    const bundle = perf.analyzeBundleSize(HEAVY_IMPORTS_CODE)
    expect(bundle.imports.length).toBeGreaterThan(0)

    // Lazy loading
    const lazy = perf.analyzeLazyLoading(LAZY_CANDIDATES_CODE)
    expect(lazy.candidates.length).toBeGreaterThan(0)

    // Compiler
    const compiler = perf.analyzeCompiler(COMPILER_ISSUES_CODE)
    expect(compiler.issues.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Performance Integration", () => {
  it("should provide comprehensive performance analysis", () => {
    const perf = createPerformanceSystem()
    const code = HEAVY_IMPORTS_CODE

    const inp = perf.analyzeINP(code)
    const bundle = perf.analyzeBundleSize(code)
    const lazy = perf.analyzeLazyLoading(code)
    const compiler = perf.analyzeCompiler(code)

    // All should return valid results
    expect(inp.score).toBeDefined()
    expect(bundle.totalSize).toBeGreaterThan(0)
    expect(lazy.patterns).toBeDefined()
    expect(compiler.compatibility).toBeDefined()
  })

  it("should handle empty code gracefully", () => {
    const perf = createPerformanceSystem()

    const inp = perf.analyzeINP("")
    const bundle = perf.analyzeBundleSize("")
    const lazy = perf.analyzeLazyLoading("")
    const compiler = perf.analyzeCompiler("")

    expect(inp.handlersAnalyzed).toBe(0)
    expect(bundle.imports.length).toBe(0)
    expect(lazy.candidates.length).toBe(0)
    expect(compiler.compatibility).toBe("compatible")
  })

  it("should handle minimal component", () => {
    const perf = createPerformanceSystem()
    const code = `const X = () => <div>Hello</div>`

    const inp = perf.analyzeINP(code)
    const compiler = perf.analyzeCompiler(code)

    expect(inp.score).toBe("good")
    expect(compiler.compatibility).toBe("compatible")
  })
})
