# INP Performance Optimization

Interaction to Next Paint (INP) analysis and optimization for generated components.

## Overview

INP measures responsiveness by tracking the latency of all user interactions. The agent:
1. Analyzes generated code for potential INP issues
2. Identifies interactions likely to exceed 200ms
3. Suggests optimizations for slow interactions
4. Validates implementation patterns

## INP Thresholds

```typescript
interface INPThresholds {
  good: number;      // ≤ 200ms - optimal responsiveness
  needsImprovement: number; // 200-500ms - noticeable delay
  poor: number;      // > 500ms - frustrating experience
}

const INP_THRESHOLDS: INPThresholds = {
  good: 200,
  needsImprovement: 500,
  poor: 500,
};

type INPRating = 'good' | 'needs-improvement' | 'poor';

function rateINP(duration: number): INPRating {
  if (duration <= INP_THRESHOLDS.good) return 'good';
  if (duration <= INP_THRESHOLDS.needsImprovement) return 'needs-improvement';
  return 'poor';
}
```

## Code Pattern Analysis

```typescript
interface INPIssue {
  type: INPIssueType;
  severity: 'critical' | 'warning' | 'info';
  location: string;
  description: string;
  estimatedImpact: string;
  suggestion: string;
  codeExample?: string;
}

type INPIssueType =
  | 'synchronous-operation'
  | 'heavy-computation'
  | 'layout-thrashing'
  | 'render-blocking'
  | 'missing-transition'
  | 'unoptimized-handler'
  | 'large-dom-update';

interface AnalysisResult {
  issues: INPIssue[];
  score: number;
  passesThreshold: boolean;
  recommendations: string[];
}
```

## Pattern Detectors

### Synchronous Operations

```typescript
const syncPatterns = [
  {
    pattern: /localStorage\.(get|set)Item/g,
    type: 'synchronous-operation',
    severity: 'warning',
    description: 'localStorage operations are synchronous and block the main thread',
    suggestion: 'Use async storage wrapper or move to Web Worker',
    codeExample: `
// Instead of:
const data = localStorage.getItem('key');

// Use async wrapper:
const storage = {
  async get(key: string) {
    return new Promise((resolve) => {
      requestIdleCallback(() => {
        resolve(localStorage.getItem(key));
      });
    });
  }
};
`,
  },
  {
    pattern: /JSON\.(parse|stringify)\([^)]{50,}/g,
    type: 'heavy-computation',
    severity: 'warning',
    description: 'Large JSON operations can block the main thread',
    suggestion: 'Use streaming JSON parser or Web Worker for large data',
  },
  {
    pattern: /document\.(querySelector|getElementById|getElementsBy)/g,
    type: 'synchronous-operation',
    severity: 'info',
    description: 'DOM queries are synchronous; repeated queries impact INP',
    suggestion: 'Cache DOM references, use React refs instead',
  },
];
```

### Layout Thrashing Detection

```typescript
const layoutThrashingPatterns = [
  {
    // Reading then writing layout properties in sequence
    pattern: /\.(offsetWidth|offsetHeight|clientWidth|clientHeight|getBoundingClientRect)[\s\S]{0,50}\.(style\.|classList\.)/g,
    type: 'layout-thrashing',
    severity: 'critical',
    description: 'Reading layout then writing causes forced synchronous layout',
    suggestion: 'Batch reads before writes, use requestAnimationFrame',
    codeExample: `
// Layout thrashing (bad):
elements.forEach(el => {
  const width = el.offsetWidth;  // Read
  el.style.width = width + 10 + 'px';  // Write - forces layout
});

// Batched (good):
const widths = elements.map(el => el.offsetWidth);  // All reads
requestAnimationFrame(() => {
  elements.forEach((el, i) => {
    el.style.width = widths[i] + 10 + 'px';  // All writes
  });
});
`,
  },
];
```

### Heavy Computation Detection

```typescript
const computationPatterns = [
  {
    pattern: /\.filter\(.*\)\.map\(.*\)\.filter\(/g,
    type: 'heavy-computation',
    severity: 'warning',
    description: 'Chained array operations create multiple iterations',
    suggestion: 'Use single reduce or for loop for large arrays',
  },
  {
    pattern: /for\s*\([^)]*;\s*[^;]*\.length\s*;/g,
    type: 'heavy-computation',
    severity: 'info',
    description: 'Accessing .length in loop condition recalculates each iteration',
    suggestion: 'Cache array length before loop',
  },
  {
    pattern: /\.sort\(\s*\([^)]*\)\s*=>/g,
    type: 'heavy-computation',
    severity: 'info',
    description: 'Array sorting is O(n log n) and blocks main thread',
    suggestion: 'Sort in Web Worker or use virtualized list for display',
  },
];
```

### React-Specific Patterns

```typescript
const reactPatterns = [
  {
    pattern: /onClick\s*=\s*\{[^}]*setState[^}]*\}/g,
    type: 'render-blocking',
    severity: 'info',
    description: 'State updates in click handlers trigger synchronous re-renders',
    suggestion: 'Use startTransition for non-urgent updates',
    codeExample: `
import { startTransition } from 'react';

// Instead of:
onClick={() => setItems(processedItems)}

// Use for non-urgent updates:
onClick={() => {
  startTransition(() => {
    setItems(processedItems);
  });
}}
`,
  },
  {
    pattern: /useMemo\([^,]+,\s*\[\s*\]\s*\)/g,
    type: 'heavy-computation',
    severity: 'info',
    description: 'Empty dependency array means computation runs once but may be expensive',
    suggestion: 'Consider lazy initialization with useState instead',
  },
  {
    pattern: /useEffect\([^}]+setState[^}]+\}\s*,\s*\[\s*\]\s*\)/g,
    type: 'render-blocking',
    severity: 'warning',
    description: 'setState in useEffect with empty deps causes double render on mount',
    suggestion: 'Initialize state directly or use useSyncExternalStore',
  },
];
```

## INP Analyzer Class

```typescript
class INPAnalyzer {
  private patterns: PatternConfig[];

  constructor() {
    this.patterns = [
      ...syncPatterns,
      ...layoutThrashingPatterns,
      ...computationPatterns,
      ...reactPatterns,
    ];
  }

  analyze(code: string, filename: string): AnalysisResult {
    const issues: INPIssue[] = [];

    for (const config of this.patterns) {
      const matches = code.matchAll(config.pattern);

      for (const match of matches) {
        const lineNumber = this.getLineNumber(code, match.index!);

        issues.push({
          type: config.type,
          severity: config.severity,
          location: `${filename}:${lineNumber}`,
          description: config.description,
          estimatedImpact: this.estimateImpact(config.type),
          suggestion: config.suggestion,
          codeExample: config.codeExample,
        });
      }
    }

    const score = this.calculateScore(issues);

    return {
      issues: this.sortBySeverity(issues),
      score,
      passesThreshold: score >= 7.0,
      recommendations: this.generateRecommendations(issues),
    };
  }

  private calculateScore(issues: INPIssue[]): number {
    const penalties = {
      critical: 2.0,
      warning: 0.5,
      info: 0.1,
    };

    let penalty = 0;
    for (const issue of issues) {
      penalty += penalties[issue.severity];
    }

    return Math.max(0, 10 - penalty);
  }

  private estimateImpact(type: INPIssueType): string {
    const impacts: Record<INPIssueType, string> = {
      'synchronous-operation': '50-200ms depending on data size',
      'heavy-computation': '100-500ms for large datasets',
      'layout-thrashing': '100-300ms per layout recalculation',
      'render-blocking': '16-100ms per unnecessary render',
      'missing-transition': '50-200ms perceived delay',
      'unoptimized-handler': '50-100ms per interaction',
      'large-dom-update': '100-500ms for 1000+ nodes',
    };
    return impacts[type];
  }

  private sortBySeverity(issues: INPIssue[]): INPIssue[] {
    const order = { critical: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private generateRecommendations(issues: INPIssue[]): string[] {
    const recommendations: string[] = [];
    const types = new Set(issues.map(i => i.type));

    if (types.has('layout-thrashing')) {
      recommendations.push('Batch DOM reads before writes using requestAnimationFrame');
    }
    if (types.has('heavy-computation')) {
      recommendations.push('Move heavy computations to Web Workers or use time-slicing');
    }
    if (types.has('synchronous-operation')) {
      recommendations.push('Replace synchronous APIs with async alternatives');
    }
    if (types.has('render-blocking')) {
      recommendations.push('Use React.startTransition for non-urgent state updates');
    }

    return recommendations;
  }
}
```

## Event Handler Optimization

```typescript
// Optimized click handler patterns
const optimizedHandlerPatterns = {
  // Debounced handler for rapid interactions
  debouncedHandler: `
const handleSearch = useMemo(
  () => debounce((value: string) => {
    startTransition(() => {
      setSearchResults(filterItems(value));
    });
  }, 150),
  []
);
`,

  // Event delegation for lists
  eventDelegation: `
// Instead of handlers on each item:
<ul onClick={(e) => {
  const target = e.target as HTMLElement;
  const itemId = target.closest('[data-item-id]')?.dataset.itemId;
  if (itemId) handleItemClick(itemId);
}}>
  {items.map(item => (
    <li key={item.id} data-item-id={item.id}>{item.name}</li>
  ))}
</ul>
`,

  // Optimistic UI updates
  optimisticUpdate: `
const handleToggle = async (id: string) => {
  // Update UI immediately
  setItems(prev => prev.map(item =>
    item.id === id ? { ...item, checked: !item.checked } : item
  ));

  // Then persist (rollback on error)
  try {
    await api.toggle(id);
  } catch {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
    toast.error('Failed to save');
  }
};
`,
};
```

## Visual Feedback Patterns

```typescript
// Immediate visual feedback for perceived performance
const feedbackPatterns = {
  // Button with loading state
  buttonWithFeedback: `
const Button = ({ onClick, children }: ButtonProps) => {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => onClick())}
      disabled={isPending}
      className={cn(
        'relative transition-all duration-150',
        isPending && 'opacity-70'
      )}
    >
      {isPending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className="h-4 w-4" />
        </span>
      )}
      <span className={cn(isPending && 'invisible')}>{children}</span>
    </button>
  );
};
`,

  // Skeleton loading for content
  skeletonLoading: `
const ContentWithSkeleton = ({ isLoading, children }: Props) => (
  <AnimatePresence mode="wait">
    {isLoading ? (
      <motion.div
        key="skeleton"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Skeleton className="h-20 w-full" />
      </motion.div>
    ) : (
      <motion.div
        key="content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);
`,
};
```

## Web Worker Offloading

```typescript
// Pattern for offloading heavy work
const workerPattern = `
// worker.ts
self.onmessage = (e: MessageEvent<{ type: string; data: unknown }>) => {
  const { type, data } = e.data;

  switch (type) {
    case 'SORT_ITEMS':
      const sorted = (data as Item[]).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      self.postMessage({ type: 'SORTED', data: sorted });
      break;

    case 'FILTER_ITEMS':
      const { items, query } = data as { items: Item[]; query: string };
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase())
      );
      self.postMessage({ type: 'FILTERED', data: filtered });
      break;
  }
};

// useWorker.ts
function useWorker<T, R>(workerFactory: () => Worker) {
  const workerRef = useRef<Worker>();
  const [result, setResult] = useState<R>();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    workerRef.current = workerFactory();
    workerRef.current.onmessage = (e) => {
      setResult(e.data);
      setIsPending(false);
    };
    return () => workerRef.current?.terminate();
  }, []);

  const run = useCallback((data: T) => {
    setIsPending(true);
    workerRef.current?.postMessage(data);
  }, []);

  return { result, isPending, run };
}
`;
```

## Integration with Component Generator

```typescript
// Post-generation INP check
async function validateINP(generatedCode: string, filename: string): Promise<{
  passes: boolean;
  report: string;
}> {
  const analyzer = new INPAnalyzer();
  const result = analyzer.analyze(generatedCode, filename);

  const report = formatINPReport(result);

  if (!result.passesThreshold) {
    // Request fixes from LLM
    const fixedCode = await requestINPFixes(generatedCode, result.issues);
    const reanalysis = analyzer.analyze(fixedCode, filename);

    return {
      passes: reanalysis.passesThreshold,
      report: formatINPReport(reanalysis),
    };
  }

  return { passes: true, report };
}

function formatINPReport(result: AnalysisResult): string {
  return `
## INP Performance Report

**Score**: ${result.score.toFixed(1)}/10 ${result.passesThreshold ? '✅' : '⚠️'}
**Status**: ${result.passesThreshold ? 'Passes threshold' : 'Needs optimization'}

${result.issues.length > 0 ? `
### Issues Found

${result.issues.map(issue => `
#### [${issue.severity.toUpperCase()}] ${issue.type}
- **Location**: ${issue.location}
- **Description**: ${issue.description}
- **Impact**: ${issue.estimatedImpact}
- **Fix**: ${issue.suggestion}
${issue.codeExample ? `\n\`\`\`typescript\n${issue.codeExample}\n\`\`\`` : ''}
`).join('\n')}
` : '### No INP issues detected ✓'}

${result.recommendations.length > 0 ? `
### Recommendations

${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : ''}
`.trim();
}
```

## Runtime INP Monitoring

```typescript
// Client-side INP measurement
const measureINP = `
import { onINP } from 'web-vitals';

// Report INP to analytics
onINP((metric) => {
  const rating = metric.rating; // 'good' | 'needs-improvement' | 'poor'

  // Log with interaction details
  console.log({
    name: 'INP',
    value: metric.value,
    rating,
    entries: metric.entries.map(entry => ({
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      target: entry.target?.tagName,
    })),
  });

  // Send to analytics
  sendToAnalytics({
    metric: 'INP',
    value: metric.value,
    rating,
    page: window.location.pathname,
  });
});
`;

// Development-time INP warning
const devINPWarning = `
if (process.env.NODE_ENV === 'development') {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 200) {
        console.warn(
          \`⚠️ Slow interaction detected: \${entry.name}\`,
          \`Duration: \${entry.duration.toFixed(0)}ms\`,
          \`Target: \${(entry as any).target?.tagName}\`
        );
      }
    }
  });

  observer.observe({ type: 'event', buffered: true, durationThreshold: 100 });
}
`;
```

## Key Takeaways

1. **INP Threshold**: Target ≤ 200ms for good responsiveness
2. **Avoid Layout Thrashing**: Batch DOM reads before writes
3. **Offload Heavy Work**: Use Web Workers for sorting, filtering
4. **Immediate Feedback**: Show loading states instantly
5. **React Optimization**: Use startTransition for non-urgent updates
6. **Event Delegation**: Single handler for lists instead of per-item
7. **Monitor in Production**: Use web-vitals library for real user metrics
