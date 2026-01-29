# Design System Consistency Checker

Automated validation of design token usage and pattern consistency.

## Overview

The consistency checker ensures generated components:
1. Use design tokens instead of hardcoded values
2. Follow the spacing scale (8px grid)
3. Apply colors from the semantic palette
4. Maintain typography hierarchy
5. Use consistent component variants

## Consistency Rules

```typescript
interface ConsistencyRule {
  id: string;
  name: string;
  category: RuleCategory;
  severity: 'error' | 'warning' | 'info';
  check: (code: string) => ConsistencyViolation[];
  autoFix?: (code: string, violation: ConsistencyViolation) => string;
}

type RuleCategory =
  | 'color'
  | 'spacing'
  | 'typography'
  | 'layout'
  | 'component'
  | 'animation';

interface ConsistencyViolation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: { line: number; column: number };
  found: string;
  expected: string;
  autoFixable: boolean;
}

interface ConsistencyReport {
  score: number;
  violations: ConsistencyViolation[];
  summary: CategorySummary[];
  passesThreshold: boolean;
}

interface CategorySummary {
  category: RuleCategory;
  violations: number;
  autoFixable: number;
}
```

## Color Consistency Rules

```typescript
const colorRules: ConsistencyRule[] = [
  {
    id: 'no-hardcoded-colors',
    name: 'No Hardcoded Colors',
    category: 'color',
    severity: 'error',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Detect hex colors
      const hexPattern = /#([0-9A-Fa-f]{3}){1,2}\b/g;
      let match;
      while ((match = hexPattern.exec(code)) !== null) {
        violations.push({
          rule: 'no-hardcoded-colors',
          severity: 'error',
          message: 'Use design token instead of hardcoded hex color',
          location: getLocation(code, match.index),
          found: match[0],
          expected: mapToToken(match[0], 'color'),
          autoFixable: true,
        });
      }

      // Detect rgb/rgba colors
      const rgbPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
      while ((match = rgbPattern.exec(code)) !== null) {
        violations.push({
          rule: 'no-hardcoded-colors',
          severity: 'error',
          message: 'Use design token instead of rgb/rgba color',
          location: getLocation(code, match.index),
          found: match[0],
          expected: 'Use CSS variable or Tailwind color',
          autoFixable: false,
        });
      }

      return violations;
    },
    autoFix: (code, violation) => {
      return code.replace(violation.found, violation.expected);
    },
  },
  {
    id: 'semantic-colors',
    name: 'Use Semantic Colors',
    category: 'color',
    severity: 'warning',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Detect raw color classes instead of semantic
      const rawColorPattern = /\b(bg|text|border)-(red|green|blue|yellow|gray)-\d{2,3}\b/g;
      let match;
      while ((match = rawColorPattern.exec(code)) !== null) {
        const [, prefix, color] = match;
        violations.push({
          rule: 'semantic-colors',
          severity: 'warning',
          message: 'Consider using semantic color token',
          location: getLocation(code, match.index),
          found: match[0],
          expected: suggestSemanticColor(prefix, color),
          autoFixable: false,
        });
      }

      return violations;
    },
  },
  {
    id: 'color-contrast',
    name: 'Color Contrast Pairs',
    category: 'color',
    severity: 'warning',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check for text on background combinations
      const bgTextPairs = [
        { bg: 'bg-primary', text: 'text-primary-foreground' },
        { bg: 'bg-secondary', text: 'text-secondary-foreground' },
        { bg: 'bg-destructive', text: 'text-destructive-foreground' },
        { bg: 'bg-muted', text: 'text-muted-foreground' },
        { bg: 'bg-accent', text: 'text-accent-foreground' },
        { bg: 'bg-card', text: 'text-card-foreground' },
      ];

      for (const pair of bgTextPairs) {
        const hasBg = code.includes(pair.bg);
        const hasText = code.includes(pair.text);

        if (hasBg && !hasText) {
          // Check if any text color is specified with this bg
          const bgIndex = code.indexOf(pair.bg);
          const context = code.substring(
            Math.max(0, bgIndex - 100),
            Math.min(code.length, bgIndex + 100)
          );

          if (!context.includes('text-')) {
            violations.push({
              rule: 'color-contrast',
              severity: 'warning',
              message: `Background ${pair.bg} should use ${pair.text}`,
              location: getLocation(code, bgIndex),
              found: pair.bg,
              expected: `${pair.bg} ${pair.text}`,
              autoFixable: false,
            });
          }
        }
      }

      return violations;
    },
  },
];

function suggestSemanticColor(prefix: string, color: string): string {
  const semanticMap: Record<string, string> = {
    red: 'destructive',
    green: 'success',
    yellow: 'warning',
    blue: 'primary',
    gray: 'muted',
  };

  const semantic = semanticMap[color] || 'foreground';
  return `${prefix}-${semantic}`;
}
```

## Spacing Consistency Rules

```typescript
const spacingScale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
const spacingPxValues = spacingScale.map(s => s * 4); // 4px base

const spacingRules: ConsistencyRule[] = [
  {
    id: 'spacing-scale',
    name: 'Use Spacing Scale',
    category: 'spacing',
    severity: 'error',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Detect arbitrary spacing values
      const arbitraryPattern = /\b(p|m|gap|space)-\[(\d+)px\]/g;
      let match;
      while ((match = arbitraryPattern.exec(code)) !== null) {
        const pxValue = parseInt(match[2], 10);

        if (!spacingPxValues.includes(pxValue)) {
          const closest = findClosestSpacing(pxValue);
          violations.push({
            rule: 'spacing-scale',
            severity: 'error',
            message: 'Use spacing from the design scale',
            location: getLocation(code, match.index),
            found: match[0],
            expected: `${match[1]}-${closest}`,
            autoFixable: true,
          });
        }
      }

      return violations;
    },
    autoFix: (code, violation) => {
      return code.replace(violation.found, violation.expected);
    },
  },
  {
    id: 'consistent-gaps',
    name: 'Consistent Gap Usage',
    category: 'spacing',
    severity: 'warning',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Detect mixed spacing in same context
      const componentMatch = code.match(/className=["'][^"']*["']/g) || [];

      for (const classStr of componentMatch) {
        const gaps = classStr.match(/gap-(\d+)/g) || [];
        const spaces = classStr.match(/space-[xy]-(\d+)/g) || [];

        if (gaps.length > 1) {
          const values = gaps.map(g => parseInt(g.split('-')[1], 10));
          if (new Set(values).size > 1) {
            violations.push({
              rule: 'consistent-gaps',
              severity: 'warning',
              message: 'Multiple gap values in same element',
              location: getLocation(code, code.indexOf(classStr)),
              found: gaps.join(', '),
              expected: 'Use consistent gap value',
              autoFixable: false,
            });
          }
        }
      }

      return violations;
    },
  },
  {
    id: '8px-grid',
    name: '8px Grid Alignment',
    category: 'spacing',
    severity: 'info',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check for odd spacing values (not on 4px grid)
      const oddSpacing = /\b(p|m|w|h)-(\d+)\b/g;
      let match;
      while ((match = oddSpacing.exec(code)) !== null) {
        const value = parseInt(match[2], 10);
        // Tailwind uses 4px base, so values should be in scale
        if (!spacingScale.includes(value)) {
          violations.push({
            rule: '8px-grid',
            severity: 'info',
            message: 'Value not on standard spacing scale',
            location: getLocation(code, match.index),
            found: match[0],
            expected: `${match[1]}-${findClosestSpacing(value * 4) / 4}`,
            autoFixable: true,
          });
        }
      }

      return violations;
    },
  },
];

function findClosestSpacing(pxValue: number): number {
  let closest = spacingScale[0];
  let minDiff = Math.abs(pxValue - spacingPxValues[0]);

  for (let i = 1; i < spacingScale.length; i++) {
    const diff = Math.abs(pxValue - spacingPxValues[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = spacingScale[i];
    }
  }

  return closest;
}
```

## Typography Consistency Rules

```typescript
const typographyRules: ConsistencyRule[] = [
  {
    id: 'font-size-scale',
    name: 'Use Font Size Scale',
    category: 'typography',
    severity: 'error',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Detect arbitrary font sizes
      const arbitraryPattern = /text-\[(\d+)px\]/g;
      let match;
      while ((match = arbitraryPattern.exec(code)) !== null) {
        violations.push({
          rule: 'font-size-scale',
          severity: 'error',
          message: 'Use typography scale instead of arbitrary size',
          location: getLocation(code, match.index),
          found: match[0],
          expected: mapToTypographyScale(parseInt(match[1], 10)),
          autoFixable: true,
        });
      }

      return violations;
    },
  },
  {
    id: 'heading-hierarchy',
    name: 'Heading Hierarchy',
    category: 'typography',
    severity: 'warning',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check heading order
      const headings = [...code.matchAll(/<h([1-6])/g)];
      let lastLevel = 0;

      for (const heading of headings) {
        const level = parseInt(heading[1], 10);

        if (level > lastLevel + 1 && lastLevel !== 0) {
          violations.push({
            rule: 'heading-hierarchy',
            severity: 'warning',
            message: `Heading level skipped from h${lastLevel} to h${level}`,
            location: getLocation(code, heading.index!),
            found: `<h${level}>`,
            expected: `<h${lastLevel + 1}>`,
            autoFixable: false,
          });
        }

        lastLevel = level;
      }

      return violations;
    },
  },
  {
    id: 'line-height-pairing',
    name: 'Line Height with Font Size',
    category: 'typography',
    severity: 'info',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check for text size without matching line height
      const textSizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
      const leadingValues = ['leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose'];

      for (const size of textSizes) {
        const sizeIndex = code.indexOf(size);
        if (sizeIndex !== -1) {
          const context = code.substring(
            Math.max(0, sizeIndex - 50),
            Math.min(code.length, sizeIndex + 100)
          );

          const hasLeading = leadingValues.some(l => context.includes(l));
          if (!hasLeading && !context.includes('leading-')) {
            // Large text should have explicit line height
            if (['text-xl', 'text-2xl', 'text-3xl'].includes(size)) {
              violations.push({
                rule: 'line-height-pairing',
                severity: 'info',
                message: 'Large text should have explicit line-height',
                location: getLocation(code, sizeIndex),
                found: size,
                expected: `${size} leading-tight`,
                autoFixable: false,
              });
            }
          }
        }
      }

      return violations;
    },
  },
];

function mapToTypographyScale(px: number): string {
  const scale: Record<number, string> = {
    12: 'text-xs',
    14: 'text-sm',
    16: 'text-base',
    18: 'text-lg',
    20: 'text-xl',
    24: 'text-2xl',
    30: 'text-3xl',
    36: 'text-4xl',
    48: 'text-5xl',
    60: 'text-6xl',
  };

  // Find closest
  let closest = 'text-base';
  let minDiff = Infinity;

  for (const [size, className] of Object.entries(scale)) {
    const diff = Math.abs(px - parseInt(size, 10));
    if (diff < minDiff) {
      minDiff = diff;
      closest = className;
    }
  }

  return closest;
}
```

## Component Consistency Rules

```typescript
const componentRules: ConsistencyRule[] = [
  {
    id: 'variant-usage',
    name: 'Use Component Variants',
    category: 'component',
    severity: 'warning',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check for manual styling that should use variants
      const manualPatterns = [
        { pattern: /className="[^"]*bg-primary[^"]*text-primary-foreground[^"]*"/, component: 'Button', variant: 'default' },
        { pattern: /className="[^"]*bg-destructive[^"]*text-destructive-foreground[^"]*"/, component: 'Button', variant: 'destructive' },
        { pattern: /className="[^"]*border[^"]*bg-background[^"]*"/, component: 'Button', variant: 'outline' },
        { pattern: /className="[^"]*rounded-full[^"]*border[^"]*"/, component: 'Avatar', variant: 'default' },
      ];

      for (const { pattern, component, variant } of manualPatterns) {
        const match = code.match(pattern);
        if (match) {
          violations.push({
            rule: 'variant-usage',
            severity: 'warning',
            message: `Use ${component} variant instead of manual styling`,
            location: getLocation(code, match.index!),
            found: 'Manual className styling',
            expected: `<${component} variant="${variant}">`,
            autoFixable: false,
          });
        }
      }

      return violations;
    },
  },
  {
    id: 'shadcn-components',
    name: 'Use shadcn/ui Components',
    category: 'component',
    severity: 'info',
    check: (code) => {
      const violations: ConsistencyViolation[] = [];

      // Check for native elements that should use shadcn
      const nativeToShadcn = [
        { native: /<button(?![^>]*variant)/g, shadcn: 'Button', condition: (ctx: string) => !ctx.includes('@radix-ui') },
        { native: /<input(?![^>]*type="hidden")/g, shadcn: 'Input', condition: () => true },
        { native: /<select\b/g, shadcn: 'Select', condition: () => true },
        { native: /<dialog\b/g, shadcn: 'Dialog', condition: () => true },
      ];

      for (const { native, shadcn, condition } of nativeToShadcn) {
        let match;
        while ((match = native.exec(code)) !== null) {
          const context = code.substring(
            Math.max(0, match.index - 200),
            Math.min(code.length, match.index + 200)
          );

          if (condition(context)) {
            violations.push({
              rule: 'shadcn-components',
              severity: 'info',
              message: `Consider using shadcn/ui ${shadcn} component`,
              location: getLocation(code, match.index),
              found: match[0],
              expected: `<${shadcn}>`,
              autoFixable: false,
            });
          }
        }
      }

      return violations;
    },
  },
];
```

## Consistency Checker Class

```typescript
class DesignConsistencyChecker {
  private rules: ConsistencyRule[];

  constructor(customRules?: ConsistencyRule[]) {
    this.rules = [
      ...colorRules,
      ...spacingRules,
      ...typographyRules,
      ...componentRules,
      ...(customRules || []),
    ];
  }

  check(code: string, filename: string): ConsistencyReport {
    const violations: ConsistencyViolation[] = [];

    for (const rule of this.rules) {
      const ruleViolations = rule.check(code);
      violations.push(...ruleViolations);
    }

    const score = this.calculateScore(violations);
    const summary = this.summarizeByCategory(violations);

    return {
      score,
      violations: this.sortViolations(violations),
      summary,
      passesThreshold: score >= 7.0,
    };
  }

  autoFix(code: string, violations: ConsistencyViolation[]): string {
    let fixedCode = code;

    // Apply fixes in reverse order to maintain positions
    const fixableViolations = violations
      .filter(v => v.autoFixable)
      .sort((a, b) => b.location.line - a.location.line);

    for (const violation of fixableViolations) {
      const rule = this.rules.find(r => r.id === violation.rule);
      if (rule?.autoFix) {
        fixedCode = rule.autoFix(fixedCode, violation);
      }
    }

    return fixedCode;
  }

  private calculateScore(violations: ConsistencyViolation[]): number {
    const penalties = {
      error: 1.5,
      warning: 0.5,
      info: 0.1,
    };

    let penalty = 0;
    for (const violation of violations) {
      penalty += penalties[violation.severity];
    }

    return Math.max(0, 10 - penalty);
  }

  private summarizeByCategory(violations: ConsistencyViolation[]): CategorySummary[] {
    const categories: RuleCategory[] = ['color', 'spacing', 'typography', 'layout', 'component', 'animation'];
    const summary: CategorySummary[] = [];

    for (const category of categories) {
      const categoryViolations = violations.filter(v => {
        const rule = this.rules.find(r => r.id === v.rule);
        return rule?.category === category;
      });

      if (categoryViolations.length > 0) {
        summary.push({
          category,
          violations: categoryViolations.length,
          autoFixable: categoryViolations.filter(v => v.autoFixable).length,
        });
      }
    }

    return summary;
  }

  private sortViolations(violations: ConsistencyViolation[]): ConsistencyViolation[] {
    const order = { error: 0, warning: 1, info: 2 };
    return violations.sort((a, b) => order[a.severity] - order[b.severity]);
  }
}

function getLocation(code: string, index: number): { line: number; column: number } {
  const lines = code.substring(0, index).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}
```

## Report Formatter

```typescript
function formatConsistencyReport(report: ConsistencyReport, filename: string): string {
  const statusIcon = report.passesThreshold ? '✅' : '⚠️';
  const scoreBar = '█'.repeat(Math.round(report.score)) + '░'.repeat(10 - Math.round(report.score));

  return `
## Design Consistency Report

**File**: ${filename}
**Score**: ${report.score.toFixed(1)}/10 ${statusIcon}
**Status**: ${report.passesThreshold ? 'Passes threshold' : 'Needs attention'}

${scoreBar} ${report.score.toFixed(1)}

### Summary by Category

| Category | Violations | Auto-fixable |
|----------|------------|--------------|
${report.summary.map(s =>
  `| ${s.category} | ${s.violations} | ${s.autoFixable} |`
).join('\n')}

${report.violations.length > 0 ? `
### Violations

${report.violations.map((v, i) => `
#### ${i + 1}. [${v.severity.toUpperCase()}] ${v.rule}
- **Line ${v.location.line}**: ${v.message}
- **Found**: \`${v.found}\`
- **Expected**: \`${v.expected}\`
${v.autoFixable ? '- ✨ Auto-fixable' : ''}
`).join('')}
` : '### No violations found ✓'}

${report.violations.some(v => v.autoFixable) ? `
### Auto-fix Available

${report.violations.filter(v => v.autoFixable).length} violations can be automatically fixed.
` : ''}
`.trim();
}
```

## Integration with Agent

```typescript
// Post-generation consistency check
async function validateDesignConsistency(
  generatedCode: string,
  filename: string
): Promise<{ code: string; report: string; passed: boolean }> {
  const checker = new DesignConsistencyChecker();

  // First check
  let result = checker.check(generatedCode, filename);

  // Auto-fix if possible
  if (!result.passesThreshold) {
    const fixedCode = checker.autoFix(generatedCode, result.violations);
    result = checker.check(fixedCode, filename);

    return {
      code: fixedCode,
      report: formatConsistencyReport(result, filename),
      passed: result.passesThreshold,
    };
  }

  return {
    code: generatedCode,
    report: formatConsistencyReport(result, filename),
    passed: result.passesThreshold,
  };
}

// Usage in component generator workflow
async function generateWithConsistencyCheck(
  request: ComponentRequest
): Promise<GeneratedComponent> {
  // Generate component
  let component = await generateComponent(request);

  // Check consistency
  const { code, report, passed } = await validateDesignConsistency(
    component.code,
    component.filename
  );

  if (!passed) {
    // Request LLM to fix remaining issues
    component.code = await requestConsistencyFixes(code, report);
  }

  return {
    ...component,
    code,
    consistencyReport: report,
    consistencyScore: passed ? 'passed' : 'needs-review',
  };
}
```

## Key Takeaways

1. **Token Validation**: Enforce design tokens over hardcoded values
2. **Spacing Grid**: Validate 8px grid alignment
3. **Color Semantics**: Prefer semantic colors (primary, destructive) over raw
4. **Typography Scale**: Use standard type scale, not arbitrary sizes
5. **Component Variants**: Use shadcn/ui variants instead of manual styling
6. **Auto-fix Support**: Many violations can be automatically corrected
7. **Scoring System**: Weighted by severity (error > warning > info)
