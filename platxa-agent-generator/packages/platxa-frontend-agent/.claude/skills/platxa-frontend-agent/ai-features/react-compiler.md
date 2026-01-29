# React Compiler Optimization Awareness

Understanding when manual memoization is unnecessary with React Compiler.

## Overview

React Compiler (formerly React Forget) automatically:
1. Memoizes components and their renders
2. Caches expensive computations
3. Stabilizes callback references
4. Optimizes prop comparisons
5. Makes manual useMemo/useCallback often unnecessary

## React Compiler Detection

```typescript
interface CompilerConfig {
  enabled: boolean;
  version: string;
  mode: 'automatic' | 'annotation';
}

// Detect if React Compiler is configured
function detectReactCompiler(config: {
  babel?: { plugins?: string[] };
  next?: { experimental?: { reactCompiler?: boolean } };
}): CompilerConfig | null {
  // Check Next.js config
  if (config.next?.experimental?.reactCompiler) {
    return {
      enabled: true,
      version: 'next',
      mode: 'automatic',
    };
  }

  // Check Babel plugins
  if (config.babel?.plugins?.some(p =>
    p.includes('babel-plugin-react-compiler') ||
    p.includes('@babel/plugin-react-compiler')
  )) {
    return {
      enabled: true,
      version: 'babel',
      mode: 'automatic',
    };
  }

  return null;
}
```

## Manual Memoization Analysis

```typescript
interface MemoizationIssue {
  type: 'unnecessary' | 'missing' | 'incorrect';
  hook: 'useMemo' | 'useCallback' | 'React.memo';
  line: number;
  reason: string;
  suggestion: string;
  compilerHandles: boolean;
}

interface MemoizationAnalysis {
  issues: MemoizationIssue[];
  stats: {
    useMemoCount: number;
    useCallbackCount: number;
    reactMemoCount: number;
    unnecessaryCount: number;
  };
  recommendations: string[];
}
```

## Pattern Detection

```typescript
const memoizationPatterns = {
  // Patterns that React Compiler handles automatically
  compilerHandled: [
    {
      // Simple object creation
      pattern: /useMemo\(\s*\(\)\s*=>\s*\(\{[^}]*\}\)\s*,\s*\[\s*\]\s*\)/g,
      reason: 'Simple object literals are auto-memoized',
      suggestion: 'Remove useMemo, compiler handles this',
    },
    {
      // Simple array creation
      pattern: /useMemo\(\s*\(\)\s*=>\s*\[[^\]]*\]\s*,\s*\[\s*\]\s*\)/g,
      reason: 'Simple array literals are auto-memoized',
      suggestion: 'Remove useMemo, compiler handles this',
    },
    {
      // Callback with no external dependencies
      pattern: /useCallback\(\s*\([^)]*\)\s*=>\s*\{[^}]*\}\s*,\s*\[\s*\]\s*\)/g,
      reason: 'Callbacks with empty deps are auto-stabilized',
      suggestion: 'Remove useCallback, compiler stabilizes functions',
    },
    {
      // Simple computed value
      pattern: /useMemo\(\s*\(\)\s*=>\s*\w+\s*[+\-*\/]\s*\w+\s*,/g,
      reason: 'Simple arithmetic is negligible cost',
      suggestion: 'Remove useMemo, computation is trivial',
    },
    {
      // JSX in useMemo
      pattern: /useMemo\(\s*\(\)\s*=>\s*<[A-Z]/g,
      reason: 'JSX elements are auto-memoized by compiler',
      suggestion: 'Remove useMemo, compiler handles JSX caching',
    },
  ],

  // Patterns still needed with compiler
  stillNeeded: [
    {
      // Expensive computation
      pattern: /useMemo\(\s*\(\)\s*=>\s*\w+\.(?:filter|map|reduce|sort)\([^)]+\)\.(?:filter|map|reduce|sort)/g,
      reason: 'Chained array operations may be expensive',
      keepIf: 'Array has 1000+ items',
    },
    {
      // External library calls
      pattern: /useMemo\(\s*\(\)\s*=>\s*(?:JSON\.parse|JSON\.stringify)/g,
      reason: 'JSON operations can be expensive for large objects',
      keepIf: 'Object is large or parsing is frequent',
    },
    {
      // RegExp creation
      pattern: /useMemo\(\s*\(\)\s*=>\s*new RegExp/g,
      reason: 'RegExp compilation has overhead',
      keepIf: 'Pattern is complex or used in hot path',
    },
  ],
};

function analyzeMemoization(code: string, hasCompiler: boolean): MemoizationAnalysis {
  const issues: MemoizationIssue[] = [];

  // Count hooks
  const useMemoCount = (code.match(/useMemo\(/g) || []).length;
  const useCallbackCount = (code.match(/useCallback\(/g) || []).length;
  const reactMemoCount = (code.match(/React\.memo\(/g) || []).length;

  if (hasCompiler) {
    // Check for unnecessary memoization
    for (const pattern of memoizationPatterns.compilerHandled) {
      const matches = code.matchAll(pattern.pattern);
      for (const match of matches) {
        issues.push({
          type: 'unnecessary',
          hook: match[0].startsWith('useMemo') ? 'useMemo' : 'useCallback',
          line: getLineNumber(code, match.index!),
          reason: pattern.reason,
          suggestion: pattern.suggestion,
          compilerHandles: true,
        });
      }
    }
  }

  return {
    issues,
    stats: {
      useMemoCount,
      useCallbackCount,
      reactMemoCount,
      unnecessaryCount: issues.filter(i => i.type === 'unnecessary').length,
    },
    recommendations: generateRecommendations(issues, hasCompiler),
  };
}

function generateRecommendations(
  issues: MemoizationIssue[],
  hasCompiler: boolean
): string[] {
  const recommendations: string[] = [];

  if (hasCompiler && issues.length > 0) {
    recommendations.push(
      'React Compiler is enabled - most manual memoization can be removed'
    );

    const unnecessaryCount = issues.filter(i => i.compilerHandles).length;
    if (unnecessaryCount > 0) {
      recommendations.push(
        `${unnecessaryCount} useMemo/useCallback calls can be safely removed`
      );
    }
  }

  if (!hasCompiler) {
    recommendations.push(
      'Consider enabling React Compiler to reduce manual memoization'
    );
  }

  return recommendations;
}
```

## Code Generation Guidelines

```typescript
interface CodeGenConfig {
  reactCompiler: boolean;
  targetReactVersion: string;
}

const codeGenGuidelines = {
  // With React Compiler
  withCompiler: {
    useMemo: {
      use: 'Only for genuinely expensive computations (1ms+)',
      avoid: [
        'Simple object/array creation',
        'Trivial arithmetic',
        'String concatenation',
        'JSX elements',
      ],
      examples: {
        unnecessary: `
// ❌ Unnecessary with compiler
const memoizedValue = useMemo(() => ({ foo: 'bar' }), []);
const items = useMemo(() => [1, 2, 3], []);
const doubled = useMemo(() => value * 2, [value]);
`,
        stillUseful: `
// ✅ Still useful (expensive operations)
const sortedItems = useMemo(
  () => items.sort((a, b) => complexSort(a, b)),
  [items]
);

const parsed = useMemo(
  () => JSON.parse(largeJsonString),
  [largeJsonString]
);
`,
      },
    },

    useCallback: {
      use: 'Rarely needed - compiler stabilizes functions',
      avoid: [
        'Event handlers passed to native elements',
        'Callbacks with primitive dependencies',
        'Functions passed to React.memo components (compiler handles)',
      ],
      examples: {
        unnecessary: `
// ❌ Unnecessary with compiler
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);

const handleChange = useCallback((e) => {
  setValue(e.target.value);
}, []);
`,
        stillUseful: `
// ✅ Still useful (external library requirements)
const debouncedSearch = useCallback(
  debounce((query) => search(query), 300),
  [search]
);
`,
      },
    },

    reactMemo: {
      use: 'Rarely needed - compiler memoizes components',
      avoid: [
        'Components with simple props',
        'Components that always re-render with parent',
      ],
      examples: {
        unnecessary: `
// ❌ Unnecessary with compiler
const Button = React.memo(({ onClick, children }) => (
  <button onClick={onClick}>{children}</button>
));
`,
        stillUseful: `
// ✅ Still useful (explicit control needed)
const ExpensiveChart = React.memo(
  ({ data }) => <Chart data={data} />,
  (prev, next) => prev.data.id === next.data.id
);
`,
      },
    },
  },

  // Without React Compiler
  withoutCompiler: {
    useMemo: {
      use: [
        'Expensive computations (sorting, filtering large arrays)',
        'Creating objects/arrays passed to memoized children',
        'Derived state that shouldn\'t trigger re-renders',
      ],
    },
    useCallback: {
      use: [
        'Callbacks passed to memoized children',
        'Callbacks in dependency arrays',
        'Event handlers that cause expensive child re-renders',
      ],
    },
    reactMemo: {
      use: [
        'Components that receive same props often',
        'Components with expensive render logic',
        'Leaf components in large lists',
      ],
    },
  },
};
```

## Code Transformer

```typescript
// Remove unnecessary memoization for compiler-enabled projects
function transformForCompiler(code: string): { code: string; changes: string[] } {
  const changes: string[] = [];
  let transformed = code;

  // Remove simple useMemo
  const simpleMemoPattern = /const\s+(\w+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*(\{[^}]*\}|\[[^\]]*\])\s*,\s*\[\s*\]\s*\)/g;
  transformed = transformed.replace(simpleMemoPattern, (match, varName, value) => {
    changes.push(`Removed useMemo from ${varName}`);
    return `const ${varName} = ${value}`;
  });

  // Remove simple useCallback
  const simpleCallbackPattern = /const\s+(\w+)\s*=\s*useCallback\(\s*((?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>\s*(?:\{[^}]*\}|[^,]+))\s*,\s*\[\s*\]\s*\)/g;
  transformed = transformed.replace(simpleCallbackPattern, (match, varName, fn) => {
    changes.push(`Removed useCallback from ${varName}`);
    return `const ${varName} = ${fn}`;
  });

  // Remove React.memo wrapper from simple components
  const simpleMemoComponentPattern = /const\s+(\w+)\s*=\s*React\.memo\(\s*(\([^)]*\)\s*=>\s*\{[\s\S]*?\})\s*\)/g;
  transformed = transformed.replace(simpleMemoComponentPattern, (match, name, component) => {
    changes.push(`Removed React.memo from ${name}`);
    return `const ${name} = ${component}`;
  });

  return { code: transformed, changes };
}
```

## Best Practices Guide

```typescript
const bestPractices = {
  withCompiler: `
## React Compiler Best Practices

### Do
- Write simple, idiomatic React code
- Trust the compiler to optimize
- Focus on correct behavior, not micro-optimizations
- Use useMemo only for truly expensive computations (>1ms)

### Don't
- Wrap every callback in useCallback
- Memoize simple object/array creation
- Use React.memo on every component
- Premature optimization

### When to Still Use Manual Optimization

1. **useMemo**: Expensive computations that the compiler can't determine are expensive
   - Sorting arrays with 1000+ items
   - Complex recursive calculations
   - JSON parsing of large strings

2. **useCallback**: External library requirements
   - Debounced/throttled functions
   - Callbacks stored in refs
   - Web Worker communication

3. **React.memo**: Custom comparison logic needed
   - Deep equality checks
   - Specific prop comparisons
`,

  withoutCompiler: `
## Manual Optimization (No Compiler)

### useMemo
- Object/array creation passed as props
- Expensive filtering/sorting/mapping
- Derived state calculations

### useCallback
- Handlers passed to memoized children
- Callbacks in useEffect dependencies
- Handlers for frequently re-rendering components

### React.memo
- List item components
- Pure presentational components
- Components with expensive render
`,
};
```

## Integration with Agent

```typescript
// Analyze and transform code based on compiler status
async function optimizeForCompiler(
  code: string,
  projectConfig: ProjectConfig
): Promise<{ code: string; report: string }> {
  const hasCompiler = detectReactCompiler(projectConfig) !== null;
  const analysis = analyzeMemoization(code, hasCompiler);

  let optimizedCode = code;
  let transformChanges: string[] = [];

  if (hasCompiler && analysis.stats.unnecessaryCount > 0) {
    const result = transformForCompiler(code);
    optimizedCode = result.code;
    transformChanges = result.changes;
  }

  const report = generateReport(analysis, hasCompiler, transformChanges);

  return { code: optimizedCode, report };
}

function generateReport(
  analysis: MemoizationAnalysis,
  hasCompiler: boolean,
  changes: string[]
): string {
  return `
## React Optimization Analysis

**React Compiler**: ${hasCompiler ? '✅ Enabled' : '❌ Not detected'}

### Hook Usage
- useMemo: ${analysis.stats.useMemoCount}
- useCallback: ${analysis.stats.useCallbackCount}
- React.memo: ${analysis.stats.reactMemoCount}

${hasCompiler ? `
### Unnecessary Memoization
${analysis.issues.length > 0
  ? analysis.issues.map(i => `- Line ${i.line}: ${i.reason}`).join('\n')
  : 'None detected ✓'}

### Auto-Applied Changes
${changes.length > 0 ? changes.map(c => `- ${c}`).join('\n') : 'None needed'}
` : ''}

### Recommendations
${analysis.recommendations.map(r => `- ${r}`).join('\n')}

${hasCompiler ? bestPractices.withCompiler : bestPractices.withoutCompiler}
`.trim();
}
```

## Key Takeaways

1. **Compiler Detection**: Check Next.js config or Babel plugins
2. **Auto-Memoization**: Compiler handles objects, arrays, callbacks
3. **Remove Unnecessary**: Simple useMemo/useCallback can be removed
4. **Still Useful**: Expensive computations, custom comparisons
5. **Code Transformation**: Auto-remove unnecessary hooks
6. **Best Practices**: Guide varies by compiler status
7. **Trust the Compiler**: Focus on correctness, not micro-optimization
