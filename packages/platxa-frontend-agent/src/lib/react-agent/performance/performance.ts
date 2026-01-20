/**
 * Performance Module
 *
 * INP optimization, bundle analysis, lazy loading patterns,
 * and React Compiler awareness.
 */

import type {
  InteractionType,
  INPSeverity,
  INPIssue,
  INPAnalysis,
  INPConfig,
  ImportType,
  DetectedImport,
  BundleAnalysis,
  PackageSizeMap,
  BundleAnalyzerConfig,
  LazyStrategy,
  LazyCandidate,
  LazyLoadingAnalysis,
  LazyLoadingConfig,
  CompilerCompatibility,
  CompilerIssue,
  CompilerAnalysis,
  CompilerConfig,
  PerformanceConfig,
} from "./types"

// =============================================================================
// INP Performance Optimization (#74)
// =============================================================================

/**
 * Default INP configuration
 */
export const DEFAULT_INP_CONFIG: INPConfig = {
  targetINP: 200,
  interactionTypes: ["click", "keydown", "pointerdown"],
  includeRecommendations: true,
}

/**
 * INP check rules
 */
const INP_RULES: Array<{
  id: string
  type: INPIssue["type"]
  check: (code: string) => { match: boolean; line?: number; snippet?: string }
  description: string
  fix: string
  impact: number
}> = [
  {
    id: "sync-state-update",
    type: "sync-state",
    check: (code) => {
      const match = code.match(/onClick\s*=\s*\{[^}]*setState[^}]*\}/s)
      if (match) {
        const line = code.substring(0, match.index).split("\n").length
        return { match: true, line, snippet: match[0].slice(0, 100) }
      }
      return { match: false }
    },
    description: "Synchronous state update in click handler may block interaction",
    fix: "Use startTransition() for non-urgent updates or batch state updates",
    impact: 50,
  },
  {
    id: "heavy-computation",
    type: "heavy-computation",
    check: (code) => {
      // Check for loops or complex operations in handlers (inline or separate)
      // Pattern 1: Inline handler with loop
      const inlineMatch = code.match(/on(?:Click|KeyDown|Change)\s*=\s*\{[^}]*(?:for\s*\(|while\s*\(|\.map\(|\.filter\(|\.reduce\()[^}]*\}/s)
      if (inlineMatch) {
        const line = code.substring(0, inlineMatch.index).split("\n").length
        return { match: true, line, snippet: inlineMatch[0].slice(0, 100) }
      }
      // Pattern 2: Handler function with loop (handle + Click/Submit pattern)
      const handlerFuncMatch = code.match(/(?:const|function)\s+handle\w*\s*=?\s*(?:\([^)]*\))?\s*(?:=>)?\s*\{[^}]*(?:for\s*\(|while\s*\(|\.filter\(|\.map\()[^}]*\}/s)
      if (handlerFuncMatch) {
        const line = code.substring(0, handlerFuncMatch.index).split("\n").length
        return { match: true, line, snippet: handlerFuncMatch[0].slice(0, 100) }
      }
      return { match: false }
    },
    description: "Heavy computation in event handler blocks main thread",
    fix: "Move computation to useEffect, useMemo, or a Web Worker",
    impact: 100,
  },
  {
    id: "layout-thrashing",
    type: "layout-thrashing",
    check: (code) => {
      // Check for DOM measurements followed by mutations
      const match = code.match(/(?:getBoundingClientRect|offsetWidth|offsetHeight|scrollTop|clientWidth)[^;]*;[^;]*(?:style\.|classList\.|setAttribute)/s)
      if (match) {
        const line = code.substring(0, match.index).split("\n").length
        return { match: true, line, snippet: match[0].slice(0, 100) }
      }
      return { match: false }
    },
    description: "DOM read followed by write causes layout thrashing",
    fix: "Batch DOM reads together, then batch writes, or use requestAnimationFrame",
    impact: 80,
  },
  {
    id: "forced-reflow",
    type: "forced-reflow",
    check: (code) => {
      const match = code.match(/(?:offsetWidth|offsetHeight|getComputedStyle|getBoundingClientRect)/g)
      if (match && match.length > 2) {
        return { match: true }
      }
      return { match: false }
    },
    description: "Multiple forced reflow operations detected",
    fix: "Cache layout measurements and minimize DOM queries",
    impact: 60,
  },
  {
    id: "blocking-handler",
    type: "blocking-handler",
    check: (code) => {
      // Check for async operations without proper handling
      const match = code.match(/on(?:Click|Submit)\s*=\s*\{[^}]*(?:await|fetch\(|axios)[^}]*\}/s)
      if (match && !/startTransition|useTransition/.test(match[0])) {
        const line = code.substring(0, match.index).split("\n").length
        return { match: true, line, snippet: match[0].slice(0, 100) }
      }
      return { match: false }
    },
    description: "Async operation in handler may block UI feedback",
    fix: "Show immediate UI feedback (loading state) before async operation",
    impact: 70,
  },
]

/**
 * Analyze code for INP issues
 */
export function analyzeINP(
  code: string,
  config: INPConfig = DEFAULT_INP_CONFIG
): INPAnalysis {
  const issues: INPIssue[] = []
  let estimatedINP = 50 // Base INP

  // Count event handlers
  const handlers = code.match(/on(?:Click|KeyDown|KeyUp|PointerDown|Change|Submit)\s*=/g) || []
  const handlersAnalyzed = handlers.length

  // Run all INP rules
  for (const rule of INP_RULES) {
    const result = rule.check(code)
    if (result.match) {
      const severity: INPSeverity =
        rule.impact >= 80 ? "poor" :
        rule.impact >= 50 ? "needs-improvement" : "good"

      issues.push({
        id: rule.id,
        type: rule.type,
        severity,
        description: rule.description,
        line: result.line,
        snippet: result.snippet,
        fix: rule.fix,
        estimatedImpact: rule.impact,
      })

      estimatedINP += rule.impact
    }
  }

  // Determine overall score
  const targetINP = config.targetINP || 200
  const score: INPSeverity =
    estimatedINP <= targetINP ? "good" :
    estimatedINP <= targetINP * 2.5 ? "needs-improvement" : "poor"

  // Generate recommendations
  const recommendations: string[] = []
  if (config.includeRecommendations) {
    if (issues.some(i => i.type === "sync-state")) {
      recommendations.push("Use React 18's startTransition for non-urgent state updates")
    }
    if (issues.some(i => i.type === "heavy-computation")) {
      recommendations.push("Consider using Web Workers for heavy computations")
    }
    if (issues.some(i => i.type === "layout-thrashing")) {
      recommendations.push("Use CSS containment (contain: layout) to limit reflow scope")
    }
    if (handlersAnalyzed > 10) {
      recommendations.push("Consider event delegation for many similar handlers")
    }
    if (recommendations.length === 0 && score === "good") {
      recommendations.push("INP looks good! Consider adding performance monitoring in production")
    }
  }

  return {
    score,
    estimatedINP,
    issues,
    recommendations,
    handlersAnalyzed,
  }
}

// =============================================================================
// Bundle Size Analyzer (#75)
// =============================================================================

/**
 * Default package sizes (gzipped, approximate)
 */
export const DEFAULT_PACKAGE_SIZES: PackageSizeMap = {
  "react": { full: 2500 },
  "react-dom": { full: 40000 },
  "lodash": { full: 70000, perExport: { debounce: 1500, throttle: 1500, cloneDeep: 3000 } },
  "moment": { full: 67000 },
  "date-fns": { full: 20000, perExport: { format: 2000, parse: 1500 } },
  "axios": { full: 13000 },
  "framer-motion": { full: 45000 },
  "@radix-ui/react-dialog": { full: 8000 },
  "@radix-ui/react-dropdown-menu": { full: 10000 },
  "@radix-ui/react-select": { full: 12000 },
  "@radix-ui/react-tabs": { full: 5000 },
  "class-variance-authority": { full: 1500 },
  "clsx": { full: 300 },
  "tailwind-merge": { full: 3000 },
  "lucide-react": { full: 500, perExport: { default: 500 } },
  "zod": { full: 12000 },
  "react-hook-form": { full: 9000 },
  "@tanstack/react-query": { full: 12000 },
  "@tanstack/react-table": { full: 15000 },
}

/**
 * Default bundle analyzer configuration
 */
export const DEFAULT_BUNDLE_CONFIG: BundleAnalyzerConfig = {
  packageSizes: DEFAULT_PACKAGE_SIZES,
  warningThreshold: 10000,
  includeDevDeps: false,
}

/**
 * Parse imports from code
 */
function parseImports(code: string): DetectedImport[] {
  const imports: DetectedImport[] = []

  // Match various import patterns
  const importPatterns = [
    // Named imports: import { a, b } from 'module'
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
    // Default imports: import Name from 'module'
    /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
    // Namespace imports: import * as Name from 'module'
    /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
    // Side effect imports: import 'module'
    /import\s*['"]([^'"]+)['"]/g,
  ]

  // Named imports
  const namedPattern = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = namedPattern.exec(code)) !== null) {
    const names = match[1].split(",").map(n => n.trim().split(" as ")[0].trim()).filter(Boolean)
    imports.push({
      module: match[2],
      type: "named",
      names,
      estimatedSize: 0,
      treeShakeable: true,
    })
  }

  // Default imports
  const defaultPattern = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g
  while ((match = defaultPattern.exec(code)) !== null) {
    if (!match[0].includes("{") && !match[0].includes("*")) {
      imports.push({
        module: match[2],
        type: "default",
        names: [match[1]],
        estimatedSize: 0,
        treeShakeable: false,
      })
    }
  }

  // Namespace imports
  const namespacePattern = /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g
  while ((match = namespacePattern.exec(code)) !== null) {
    imports.push({
      module: match[2],
      type: "namespace",
      names: [match[1]],
      estimatedSize: 0,
      treeShakeable: false,
    })
  }

  return imports
}

/**
 * Analyze bundle size from code
 */
export function analyzeBundleSize(
  code: string,
  config: BundleAnalyzerConfig = DEFAULT_BUNDLE_CONFIG
): BundleAnalysis {
  const packageSizes = { ...DEFAULT_PACKAGE_SIZES, ...config.packageSizes }
  const imports = parseImports(code)
  let totalSize = 0

  // Calculate sizes
  for (const imp of imports) {
    const pkgInfo = packageSizes[imp.module]

    if (pkgInfo) {
      if (imp.type === "named" && pkgInfo.perExport) {
        // Calculate size for named imports
        let size = 0
        for (const name of imp.names) {
          size += pkgInfo.perExport[name] || (pkgInfo.full / 10) // Estimate if not known
        }
        imp.estimatedSize = size
      } else {
        imp.estimatedSize = pkgInfo.full
      }

      // Add suggestions
      if (imp.module === "lodash" && imp.type !== "named") {
        imp.suggestion = "Use named imports (import { debounce } from 'lodash') for tree-shaking"
        imp.treeShakeable = false
      }
      if (imp.module === "moment") {
        imp.suggestion = "Consider replacing moment with date-fns or dayjs for smaller bundle"
      }
    } else {
      // Unknown package - estimate
      imp.estimatedSize = 5000
    }

    totalSize += imp.estimatedSize
  }

  // Find heavy imports
  const threshold = config.warningThreshold || 10000
  const heavyImports = imports.filter(i => i.estimatedSize > threshold)

  // Generate opportunities
  const opportunities: BundleAnalysis["opportunities"] = []

  // Check for moment first (high-impact replacement)
  const momentImport = imports.find(i => i.module === "moment")
  if (momentImport) {
    opportunities.push({
      type: "replace",
      description: "Replace moment.js with date-fns (67KB → 20KB)",
      potentialSavings: 47000,
      potentialSavingsFormatted: "47KB",
    })
  }

  // Check for lodash full import
  const lodashFull = imports.find(i => i.module === "lodash" && i.type !== "named")
  if (lodashFull) {
    opportunities.push({
      type: "tree-shake",
      description: "Use lodash-es or named imports from lodash",
      potentialSavings: 50000,
      potentialSavingsFormatted: "50KB",
    })
  }

  // Tree-shaking opportunities for other imports
  for (const imp of imports) {
    // Skip moment and lodash (already handled above)
    if (imp.module === "moment" || imp.module === "lodash") continue

    if (imp.type === "namespace" || (imp.type === "default" && imp.estimatedSize > 10000)) {
      opportunities.push({
        type: "tree-shake",
        description: `Convert ${imp.module} to named imports for tree-shaking`,
        potentialSavings: Math.floor(imp.estimatedSize * 0.5),
        potentialSavingsFormatted: formatBytes(Math.floor(imp.estimatedSize * 0.5)),
      })
    }
  }

  // Calculate score (100 = small, 0 = very large)
  const score = Math.max(0, Math.min(100, 100 - Math.floor(totalSize / 5000)))

  return {
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    imports,
    heavyImports,
    opportunities,
    score,
  }
}

// =============================================================================
// Lazy Loading Patterns (#76)
// =============================================================================

/**
 * Default lazy loading configuration
 */
export const DEFAULT_LAZY_CONFIG: LazyLoadingConfig = {
  strategies: ["react-lazy", "intersection-observer"],
  minSize: 5000,
  includeImages: true,
  framework: "react",
}

/**
 * Lazy loading patterns
 */
export const LAZY_PATTERNS: Record<LazyStrategy, string> = {
  "react-lazy": `const LazyComponent = React.lazy(() => import('./Component'))

// Usage:
<React.Suspense fallback={<Loading />}>
  <LazyComponent />
</React.Suspense>`,

  "next-dynamic": `import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('./Component'), {
  loading: () => <Loading />,
  ssr: false, // Optional: disable SSR
})`,

  "intersection-observer": `function LazyLoad({ children }) {
  const [isVisible, setIsVisible] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { rootMargin: '100px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref}>{isVisible ? children : <Skeleton />}</div>
}`,

  "idle-callback": `function useIdleLoad(importFn) {
  const [Component, setComponent] = React.useState(null)

  React.useEffect(() => {
    const id = requestIdleCallback(async () => {
      const mod = await importFn()
      setComponent(() => mod.default)
    })
    return () => cancelIdleCallback(id)
  }, [])

  return Component
}`,

  "route-based": `// React Router
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Settings = React.lazy(() => import('./pages/Settings'))

<Routes>
  <Route path="/dashboard" element={
    <Suspense fallback={<PageLoader />}>
      <Dashboard />
    </Suspense>
  } />
</Routes>`,
}

/**
 * Analyze code for lazy loading opportunities
 */
export function analyzeLazyLoading(
  code: string,
  config: LazyLoadingConfig = DEFAULT_LAZY_CONFIG
): LazyLoadingAnalysis {
  const candidates: LazyCandidate[] = []
  const alreadyLazy: string[] = []

  // Check for already lazy-loaded components
  const lazyMatches = code.match(/React\.lazy\(\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/g) || []
  const dynamicMatches = code.match(/dynamic\(\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/g) || []

  for (const match of [...lazyMatches, ...dynamicMatches]) {
    const nameMatch = match.match(/['"]\.\/(\w+)['"]/)
    if (nameMatch) alreadyLazy.push(nameMatch[1])
  }

  // Find components that could be lazy loaded
  const componentImports = code.match(/import\s+(?:\w+|\{[^}]+\})\s+from\s*['"]\.\/(?:components|pages|views)\/([^'"]+)['"]/g) || []

  for (const imp of componentImports) {
    const nameMatch = imp.match(/['"]\.\/(?:components|pages|views)\/([^'"]+)['"]/)
    if (nameMatch && !alreadyLazy.includes(nameMatch[1])) {
      const name = nameMatch[1].split("/").pop() || nameMatch[1]

      candidates.push({
        name,
        type: "component",
        strategy: config.framework === "next" ? "next-dynamic" : "react-lazy",
        currentCode: imp,
        suggestedCode: generateLazyImport(name, config.framework || "react"),
        priority: /page|modal|dialog|dashboard/i.test(name) ? 9 : 5,
        reason: "Component can be code-split for faster initial load",
      })
    }
  }

  // Find images that could be lazy loaded
  if (config.includeImages) {
    const imgMatches = [...code.matchAll(/<img([^>]*)>/g)]
    for (const match of imgMatches) {
      if (!match[1].includes('loading="lazy"') && !match[1].includes("loading={'lazy'}")) {
        const line = code.substring(0, match.index).split("\n").length
        candidates.push({
          name: "Image",
          type: "image",
          strategy: "intersection-observer",
          line,
          currentCode: match[0],
          suggestedCode: match[0].replace("<img", '<img loading="lazy"'),
          priority: 7,
          reason: "Images below the fold should be lazy loaded",
        })
      }
    }
  }

  // Sort by priority
  candidates.sort((a, b) => b.priority - a.priority)

  return {
    candidates,
    alreadyLazy,
    potentialSavings: {
      initialBundle: candidates.filter(c => c.type === "component").length * 10000,
      timeToInteractive: candidates.length * 50,
    },
    patterns: LAZY_PATTERNS,
  }
}

// =============================================================================
// React Compiler Optimization (#77)
// =============================================================================

/**
 * Default React Compiler configuration
 */
export const DEFAULT_COMPILER_CONFIG: CompilerConfig = {
  strict: false,
  reportRemovable: true,
  reactVersion: "19",
}

/**
 * React Compiler compatibility rules
 */
const COMPILER_RULES: Array<{
  id: string
  type: CompilerIssue["type"]
  check: (code: string) => { match: boolean; line?: number; snippet?: string }
  description: string
  blocking: boolean
  fix?: string
}> = [
  {
    id: "ref-mutation",
    type: "ref-mutation",
    check: (code) => {
      const match = code.match(/ref\.current\s*=(?!=)/g)
      return { match: !!match }
    },
    description: "Direct ref.current mutation may not work as expected with React Compiler",
    blocking: false,
    fix: "Consider using state for values that affect rendering",
  },
  {
    id: "effect-deps-object",
    type: "effect-deps",
    check: (code) => {
      // Check for objects/arrays in useEffect deps that aren't memoized
      const match = code.match(/useEffect\([^)]+,\s*\[[^\]]*(?:\{|\[)[^\]]*\]\)/s)
      return { match: !!match }
    },
    description: "Object/array in useEffect dependencies may cause infinite loops",
    blocking: true,
    fix: "Move object/array outside component or use useMemo",
  },
  {
    id: "external-mutation",
    type: "external-mutation",
    check: (code) => {
      // Check for mutations to imported objects
      const match = code.match(/(?:window|document|global)\.\w+\s*=/g)
      return { match: !!match }
    },
    description: "Mutations to external objects may not trigger re-renders",
    blocking: false,
    fix: "Use React state for values that should trigger re-renders",
  },
  {
    id: "unstable-reference",
    type: "unstable-reference",
    check: (code) => {
      // Check for inline objects passed to children
      const match = code.match(/<\w+[^>]*(?:style|options|config)=\{\{[^}]+\}\}/g)
      if (match && match.length > 3) {
        return { match: true }
      }
      return { match: false }
    },
    description: "Inline objects create new references on every render",
    blocking: false,
    fix: "React Compiler will auto-memoize, but consider extracting constants",
  },
]

/**
 * Analyze React Compiler compatibility
 */
export function analyzeCompilerCompatibility(
  code: string,
  config: CompilerConfig = DEFAULT_COMPILER_CONFIG
): CompilerAnalysis {
  const issues: CompilerIssue[] = []
  const removableOptimizations: CompilerAnalysis["removableOptimizations"] = []
  const recommendations: string[] = []

  // Run compiler rules
  for (const rule of COMPILER_RULES) {
    const result = rule.check(code)
    if (result.match) {
      issues.push({
        type: rule.type,
        description: rule.description,
        line: result.line,
        snippet: result.snippet,
        blocking: rule.blocking,
        fix: rule.fix,
      })
    }
  }

  // Find removable manual optimizations
  if (config.reportRemovable) {
    // useMemo
    const memoMatches = [...code.matchAll(/useMemo\(/g)]
    for (const match of memoMatches) {
      const line = code.substring(0, match.index).split("\n").length
      removableOptimizations.push({
        type: "useMemo",
        line,
        reason: "React Compiler auto-memoizes computed values",
      })
    }

    // useCallback
    const callbackMatches = [...code.matchAll(/useCallback\(/g)]
    for (const match of callbackMatches) {
      const line = code.substring(0, match.index).split("\n").length
      removableOptimizations.push({
        type: "useCallback",
        line,
        reason: "React Compiler auto-memoizes callbacks",
      })
    }

    // React.memo
    const memoComponentMatches = [...code.matchAll(/React\.memo\(|memo\(/g)]
    for (const match of memoComponentMatches) {
      const line = code.substring(0, match.index).split("\n").length
      removableOptimizations.push({
        type: "React.memo",
        line,
        reason: "React Compiler determines optimal memoization automatically",
      })
    }
  }

  // Determine compatibility
  const blockingIssues = issues.filter(i => i.blocking)
  const compatibility: CompilerCompatibility =
    blockingIssues.length > 0 ? "incompatible" :
    issues.length > 0 ? "needs-changes" : "compatible"

  // Calculate score
  let score = 100
  score -= blockingIssues.length * 20
  score -= (issues.length - blockingIssues.length) * 5
  score = Math.max(0, Math.min(100, score))

  // Generate recommendations
  if (removableOptimizations.length > 0) {
    recommendations.push(
      `Found ${removableOptimizations.length} manual optimization(s) that React Compiler handles automatically`
    )
  }
  if (compatibility === "compatible") {
    recommendations.push("Code is ready for React Compiler - no changes needed")
  }
  if (blockingIssues.length > 0) {
    recommendations.push("Fix blocking issues before enabling React Compiler")
  }

  return {
    compatibility,
    score,
    issues,
    removableOptimizations,
    recommendations,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function generateLazyImport(name: string, framework: string): string {
  if (framework === "next") {
    return `const ${name} = dynamic(() => import('./${name}'), { loading: () => <Loading /> })`
  }
  return `const ${name} = React.lazy(() => import('./${name}'))`
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create performance analysis system
 */
export function createPerformanceSystem(config?: PerformanceConfig) {
  return {
    // INP analysis
    analyzeINP: (code: string) => analyzeINP(code, config?.inp),

    // Bundle analysis
    analyzeBundleSize: (code: string) => analyzeBundleSize(code, config?.bundle),
    packageSizes: DEFAULT_PACKAGE_SIZES,

    // Lazy loading
    analyzeLazyLoading: (code: string) => analyzeLazyLoading(code, config?.lazy),
    lazyPatterns: LAZY_PATTERNS,

    // React Compiler
    analyzeCompiler: (code: string) => analyzeCompilerCompatibility(code, config?.compiler),

    // Utilities
    formatBytes,
  }
}
