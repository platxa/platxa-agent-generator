# Bundle Size Analyzer

Estimate component bundle impact before generation.

## Overview

The bundle analyzer enables:
1. Estimate component size before adding to project
2. Analyze dependency impact on bundle
3. Identify tree-shaking opportunities
4. Compare alternative implementations
5. Track bundle budget compliance

## Size Estimation

```typescript
interface BundleEstimate {
  raw: number;           // Raw source size in bytes
  minified: number;      // Estimated minified size
  gzipped: number;       // Estimated gzipped size
  dependencies: DependencySize[];
  totalImpact: number;   // Total bundle impact
}

interface DependencySize {
  name: string;
  version: string;
  size: number;
  gzipped: number;
  isNew: boolean;        // Not already in project
  treeShakeable: boolean;
}

interface BundleBudget {
  maxComponentSize: number;  // KB
  maxDependencySize: number; // KB
  maxTotalImpact: number;    // KB
}

const defaultBudget: BundleBudget = {
  maxComponentSize: 10,    // 10 KB per component
  maxDependencySize: 50,   // 50 KB per new dependency
  maxTotalImpact: 100,     // 100 KB total impact
};
```

## Dependency Size Database

```typescript
// Pre-computed sizes for common dependencies (gzipped KB)
const dependencySizes: Record<string, { full: number; minimal: number }> = {
  // React ecosystem
  'react': { full: 6.4, minimal: 6.4 },
  'react-dom': { full: 42, minimal: 42 },

  // UI libraries
  '@radix-ui/react-dialog': { full: 12.5, minimal: 5.2 },
  '@radix-ui/react-dropdown-menu': { full: 14.2, minimal: 6.1 },
  '@radix-ui/react-select': { full: 18.3, minimal: 8.4 },
  '@radix-ui/react-tabs': { full: 4.8, minimal: 2.1 },
  '@radix-ui/react-tooltip': { full: 6.2, minimal: 2.8 },
  '@radix-ui/react-accordion': { full: 5.1, minimal: 2.3 },
  '@radix-ui/react-popover': { full: 11.4, minimal: 4.9 },

  // Animation
  'framer-motion': { full: 45, minimal: 28 },
  'motion': { full: 18, minimal: 12 },

  // Charts
  'recharts': { full: 156, minimal: 85 },
  'chart.js': { full: 67, minimal: 40 },
  'react-chartjs-2': { full: 4.2, minimal: 2.1 },

  // Tables
  '@tanstack/react-table': { full: 14.2, minimal: 8.5 },
  'react-table': { full: 11.3, minimal: 6.8 },

  // Forms
  'react-hook-form': { full: 8.6, minimal: 5.2 },
  'zod': { full: 13.4, minimal: 8.1 },
  '@hookform/resolvers': { full: 1.8, minimal: 0.9 },

  // Date handling
  'date-fns': { full: 75, minimal: 3 },
  'dayjs': { full: 2.9, minimal: 2.0 },

  // Icons
  'lucide-react': { full: 0.3, minimal: 0.3 }, // Per icon
  '@heroicons/react': { full: 0.4, minimal: 0.4 },

  // Utilities
  'clsx': { full: 0.3, minimal: 0.3 },
  'class-variance-authority': { full: 1.1, minimal: 0.8 },
  'tailwind-merge': { full: 3.2, minimal: 2.1 },

  // Carousel
  'embla-carousel-react': { full: 8.4, minimal: 6.2 },
  'swiper': { full: 45, minimal: 28 },

  // Rich text
  '@tiptap/react': { full: 85, minimal: 45 },
  'react-quill': { full: 95, minimal: 65 },

  // Other
  'lodash': { full: 72, minimal: 0.5 }, // Tree-shakeable
  'axios': { full: 4.8, minimal: 4.8 },
};

function getDependencySize(name: string, usage: 'full' | 'minimal' = 'minimal'): number {
  const dep = dependencySizes[name];
  if (!dep) return 0;
  return dep[usage];
}
```

## Code Size Estimator

```typescript
class CodeSizeEstimator {
  // Estimate minified size from source
  estimateMinified(code: string): number {
    // Remove comments
    let minified = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    // Remove whitespace
    minified = minified.replace(/\s+/g, ' ');

    // Estimate variable name shortening (30% reduction)
    const estimatedSize = minified.length * 0.7;

    return estimatedSize;
  }

  // Estimate gzipped size from minified
  estimateGzipped(minifiedSize: number): number {
    // Gzip typically achieves 60-70% compression on code
    return minifiedSize * 0.35;
  }

  // Full estimation
  estimate(code: string): { raw: number; minified: number; gzipped: number } {
    const raw = new TextEncoder().encode(code).length;
    const minified = this.estimateMinified(code);
    const gzipped = this.estimateGzipped(minified);

    return {
      raw,
      minified: Math.round(minified),
      gzipped: Math.round(gzipped),
    };
  }
}
```

## Dependency Analyzer

```typescript
interface ImportAnalysis {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

class DependencyAnalyzer {
  private projectDependencies: Set<string>;

  constructor(packageJson: { dependencies?: Record<string, string> }) {
    this.projectDependencies = new Set(
      Object.keys(packageJson.dependencies || {})
    );
  }

  // Extract imports from code
  extractImports(code: string): ImportAnalysis[] {
    const imports: ImportAnalysis[] = [];

    // Named imports: import { a, b } from 'package'
    const namedPattern = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = namedPattern.exec(code)) !== null) {
      imports.push({
        source: match[2],
        imports: match[1].split(',').map(i => i.trim().split(' as ')[0]),
        isDefault: false,
        isNamespace: false,
      });
    }

    // Default imports: import X from 'package'
    const defaultPattern = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((match = defaultPattern.exec(code)) !== null) {
      imports.push({
        source: match[2],
        imports: [match[1]],
        isDefault: true,
        isNamespace: false,
      });
    }

    // Namespace imports: import * as X from 'package'
    const namespacePattern = /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((match = namespacePattern.exec(code)) !== null) {
      imports.push({
        source: match[2],
        imports: [match[1]],
        isDefault: false,
        isNamespace: true,
      });
    }

    return imports;
  }

  // Analyze dependency impact
  analyzeDependencies(code: string): DependencySize[] {
    const imports = this.extractImports(code);
    const dependencies: DependencySize[] = [];

    for (const imp of imports) {
      // Skip relative imports
      if (imp.source.startsWith('.') || imp.source.startsWith('@/')) {
        continue;
      }

      // Get package name (handle scoped packages)
      const packageName = imp.source.startsWith('@')
        ? imp.source.split('/').slice(0, 2).join('/')
        : imp.source.split('/')[0];

      const isNew = !this.projectDependencies.has(packageName);
      const sizeInfo = dependencySizes[packageName];

      // Determine if tree-shakeable (named imports vs namespace)
      const treeShakeable = !imp.isNamespace && !imp.isDefault;
      const usage = treeShakeable ? 'minimal' : 'full';

      const size = sizeInfo ? sizeInfo[usage] : 0;

      dependencies.push({
        name: packageName,
        version: 'latest',
        size: size * 1024, // Convert to bytes
        gzipped: size * 1024,
        isNew,
        treeShakeable,
      });
    }

    // Deduplicate
    const unique = new Map<string, DependencySize>();
    for (const dep of dependencies) {
      if (!unique.has(dep.name) || dep.size > unique.get(dep.name)!.size) {
        unique.set(dep.name, dep);
      }
    }

    return Array.from(unique.values());
  }
}
```

## Bundle Impact Analyzer

```typescript
interface BundleAnalysis {
  estimate: BundleEstimate;
  budget: BudgetStatus;
  suggestions: Suggestion[];
  alternatives: Alternative[];
}

interface BudgetStatus {
  componentSize: { value: number; limit: number; passed: boolean };
  dependencySize: { value: number; limit: number; passed: boolean };
  totalImpact: { value: number; limit: number; passed: boolean };
  overall: boolean;
}

interface Suggestion {
  type: 'warning' | 'optimization' | 'alternative';
  message: string;
  impact: number;
}

interface Alternative {
  current: string;
  alternative: string;
  savingsKB: number;
  tradeoff: string;
}

class BundleImpactAnalyzer {
  private sizeEstimator: CodeSizeEstimator;
  private dependencyAnalyzer: DependencyAnalyzer;
  private budget: BundleBudget;

  constructor(
    packageJson: { dependencies?: Record<string, string> },
    budget: Partial<BundleBudget> = {}
  ) {
    this.sizeEstimator = new CodeSizeEstimator();
    this.dependencyAnalyzer = new DependencyAnalyzer(packageJson);
    this.budget = { ...defaultBudget, ...budget };
  }

  analyze(code: string): BundleAnalysis {
    // Estimate code size
    const sizeEstimate = this.sizeEstimator.estimate(code);

    // Analyze dependencies
    const dependencies = this.dependencyAnalyzer.analyzeDependencies(code);

    // Calculate totals
    const newDepsSize = dependencies
      .filter(d => d.isNew)
      .reduce((sum, d) => sum + d.gzipped, 0);

    const totalImpact = sizeEstimate.gzipped + newDepsSize;

    const estimate: BundleEstimate = {
      raw: sizeEstimate.raw,
      minified: sizeEstimate.minified,
      gzipped: sizeEstimate.gzipped,
      dependencies,
      totalImpact,
    };

    // Check budget
    const budget = this.checkBudget(estimate);

    // Generate suggestions
    const suggestions = this.generateSuggestions(estimate, dependencies);

    // Find alternatives
    const alternatives = this.findAlternatives(dependencies);

    return { estimate, budget, suggestions, alternatives };
  }

  private checkBudget(estimate: BundleEstimate): BudgetStatus {
    const componentKB = estimate.gzipped / 1024;
    const depsKB = estimate.dependencies
      .filter(d => d.isNew)
      .reduce((sum, d) => sum + d.gzipped, 0) / 1024;
    const totalKB = estimate.totalImpact / 1024;

    const componentStatus = {
      value: componentKB,
      limit: this.budget.maxComponentSize,
      passed: componentKB <= this.budget.maxComponentSize,
    };

    const dependencyStatus = {
      value: depsKB,
      limit: this.budget.maxDependencySize,
      passed: depsKB <= this.budget.maxDependencySize,
    };

    const totalStatus = {
      value: totalKB,
      limit: this.budget.maxTotalImpact,
      passed: totalKB <= this.budget.maxTotalImpact,
    };

    return {
      componentSize: componentStatus,
      dependencySize: dependencyStatus,
      totalImpact: totalStatus,
      overall: componentStatus.passed && dependencyStatus.passed && totalStatus.passed,
    };
  }

  private generateSuggestions(
    estimate: BundleEstimate,
    dependencies: DependencySize[]
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Large dependencies warning
    for (const dep of dependencies) {
      if (dep.isNew && dep.gzipped > 20 * 1024) {
        suggestions.push({
          type: 'warning',
          message: `${dep.name} adds ${(dep.gzipped / 1024).toFixed(1)}KB to bundle`,
          impact: dep.gzipped / 1024,
        });
      }
    }

    // Tree-shaking opportunities
    const nonTreeShakeable = dependencies.filter(d => !d.treeShakeable);
    for (const dep of nonTreeShakeable) {
      suggestions.push({
        type: 'optimization',
        message: `Use named imports from ${dep.name} for better tree-shaking`,
        impact: dep.size / 1024 * 0.3,
      });
    }

    // Framer Motion optimization
    if (dependencies.some(d => d.name === 'framer-motion')) {
      suggestions.push({
        type: 'alternative',
        message: 'Consider motion (lighter) instead of framer-motion',
        impact: 27,
      });
    }

    return suggestions;
  }

  private findAlternatives(dependencies: DependencySize[]): Alternative[] {
    const alternatives: Alternative[] = [];

    const alternativeMap: Record<string, { alt: string; savings: number; tradeoff: string }> = {
      'framer-motion': {
        alt: 'motion',
        savings: 27,
        tradeoff: 'Fewer features, similar API',
      },
      'recharts': {
        alt: 'chart.js + react-chartjs-2',
        savings: 85,
        tradeoff: 'Different API, more manual setup',
      },
      'lodash': {
        alt: 'lodash-es (tree-shakeable)',
        savings: 70,
        tradeoff: 'Must use ES imports',
      },
      'date-fns': {
        alt: 'dayjs',
        savings: 72,
        tradeoff: 'Slightly different API',
      },
      '@tiptap/react': {
        alt: 'textarea (if simple)',
        savings: 85,
        tradeoff: 'No rich text features',
      },
      'swiper': {
        alt: 'embla-carousel-react',
        savings: 37,
        tradeoff: 'Different API, fewer built-in features',
      },
    };

    for (const dep of dependencies) {
      const alt = alternativeMap[dep.name];
      if (alt && dep.isNew) {
        alternatives.push({
          current: dep.name,
          alternative: alt.alt,
          savingsKB: alt.savings,
          tradeoff: alt.tradeoff,
        });
      }
    }

    return alternatives;
  }
}
```

## Report Generator

```typescript
function generateBundleReport(analysis: BundleAnalysis): string {
  const { estimate, budget, suggestions, alternatives } = analysis;

  const formatKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  const status = (passed: boolean) => passed ? '✅' : '❌';

  return `
## Bundle Size Analysis

### Component Size
| Metric | Size |
|--------|------|
| Raw | ${formatKB(estimate.raw)} |
| Minified | ${formatKB(estimate.minified)} |
| Gzipped | ${formatKB(estimate.gzipped)} |

### Dependencies (${estimate.dependencies.length})

${estimate.dependencies.length > 0 ? `
| Package | Size (gzip) | New? | Tree-shakeable |
|---------|-------------|------|----------------|
${estimate.dependencies.map(d =>
  `| ${d.name} | ${formatKB(d.gzipped)} | ${d.isNew ? '🆕' : '-'} | ${d.treeShakeable ? '✅' : '❌'} |`
).join('\n')}
` : 'No external dependencies.'}

### Budget Status

| Category | Value | Limit | Status |
|----------|-------|-------|--------|
| Component | ${budget.componentSize.value.toFixed(1)} KB | ${budget.componentSize.limit} KB | ${status(budget.componentSize.passed)} |
| New Dependencies | ${budget.dependencySize.value.toFixed(1)} KB | ${budget.dependencySize.limit} KB | ${status(budget.dependencySize.passed)} |
| Total Impact | ${budget.totalImpact.value.toFixed(1)} KB | ${budget.totalImpact.limit} KB | ${status(budget.totalImpact.passed)} |

**Overall: ${budget.overall ? '✅ Within budget' : '❌ Over budget'}**

${suggestions.length > 0 ? `
### Suggestions

${suggestions.map(s => `- **[${s.type}]** ${s.message} (${s.impact.toFixed(1)} KB impact)`).join('\n')}
` : ''}

${alternatives.length > 0 ? `
### Alternatives

| Current | Alternative | Savings | Tradeoff |
|---------|-------------|---------|----------|
${alternatives.map(a =>
  `| ${a.current} | ${a.alternative} | ${a.savingsKB} KB | ${a.tradeoff} |`
).join('\n')}
` : ''}
`.trim();
}
```

## Integration with Agent

```typescript
// Analyze component before generation
async function analyzeBeforeGeneration(
  componentCode: string,
  packageJson: { dependencies?: Record<string, string> }
): Promise<{ analysis: BundleAnalysis; report: string }> {
  const analyzer = new BundleImpactAnalyzer(packageJson);
  const analysis = analyzer.analyze(componentCode);
  const report = generateBundleReport(analysis);

  return { analysis, report };
}

// Usage in generation workflow
async function generateWithBundleAnalysis(
  request: ComponentRequest
): Promise<GeneratedComponent> {
  const component = await generateComponent(request);

  // Analyze bundle impact
  const { analysis, report } = await analyzeBeforeGeneration(
    component.code,
    await readPackageJson()
  );

  // Warn if over budget
  if (!analysis.budget.overall) {
    console.warn('⚠️ Component exceeds bundle budget');
    console.warn(report);
  }

  return {
    ...component,
    bundleAnalysis: analysis,
    bundleReport: report,
  };
}
```

## Key Takeaways

1. **Pre-Generation Analysis**: Estimate impact before adding code
2. **Dependency Database**: Known sizes for common packages
3. **Tree-Shaking Detection**: Identify optimization opportunities
4. **Budget Enforcement**: Set limits for component and dependency sizes
5. **Alternative Suggestions**: Recommend lighter alternatives
6. **Detailed Reports**: Clear breakdown of size impact
7. **New vs Existing**: Only count new dependencies toward budget
