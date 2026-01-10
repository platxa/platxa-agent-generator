# Design Critique System

AI-powered evaluation and iterative refinement for generated components.

## Overview

The design critique system enables the agent to:
1. Evaluate generated UI components against design principles
2. Identify areas for improvement
3. Suggest specific refinements
4. Iterate until quality threshold is met

## Critique Dimensions

```typescript
interface CritiqueDimension {
  id: string;
  name: string;
  weight: number;
  criteria: string[];
}

const critiqueDimensions: CritiqueDimension[] = [
  {
    id: 'visual-hierarchy',
    name: 'Visual Hierarchy',
    weight: 0.2,
    criteria: [
      'Clear primary focal point',
      'Logical information flow',
      'Appropriate size contrast',
      'Effective use of whitespace',
      'Grouping of related elements',
    ],
  },
  {
    id: 'typography',
    name: 'Typography',
    weight: 0.15,
    criteria: [
      'Readable font sizes (16px+ body)',
      'Appropriate line height (1.5+)',
      'Clear heading hierarchy',
      'Consistent font usage',
      'Adequate contrast ratios',
    ],
  },
  {
    id: 'color-usage',
    name: 'Color Usage',
    weight: 0.15,
    criteria: [
      'Cohesive color palette',
      'Accessible contrast (WCAG AA)',
      'Meaningful color semantics',
      'Consistent application',
      'Dark mode support',
    ],
  },
  {
    id: 'spacing',
    name: 'Spacing & Layout',
    weight: 0.15,
    criteria: [
      'Consistent spacing scale',
      'Proper alignment',
      'Responsive breakpoints',
      'Container widths',
      'Grid consistency',
    ],
  },
  {
    id: 'interactivity',
    name: 'Interactivity',
    weight: 0.15,
    criteria: [
      'Clear interactive affordances',
      'Hover/focus states',
      'Loading states',
      'Error handling',
      'Transition smoothness',
    ],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    weight: 0.2,
    criteria: [
      'Keyboard navigable',
      'Screen reader support',
      'Focus indicators',
      'ARIA labels',
      'Reduced motion respect',
    ],
  },
];
```

## Critique Result Types

```typescript
type SeverityLevel = 'critical' | 'major' | 'minor' | 'suggestion';

interface CritiqueIssue {
  dimension: string;
  severity: SeverityLevel;
  description: string;
  location?: string;
  suggestion: string;
  codeExample?: string;
}

interface CritiqueScore {
  dimension: string;
  score: number; // 0-10
  issues: CritiqueIssue[];
}

interface CritiqueResult {
  overallScore: number;
  scores: CritiqueScore[];
  summary: string;
  improvements: CritiqueIssue[];
  passesThreshold: boolean;
}

const QUALITY_THRESHOLD = 7.0; // Minimum score to pass
```

## Critique Prompt Template

```typescript
const critiquePromptTemplate = `
You are an expert UI/UX designer reviewing a React component.
Evaluate the component against these dimensions:

{{#each dimensions}}
## {{name}} (Weight: {{weight}})
Criteria:
{{#each criteria}}
- {{this}}
{{/each}}

{{/each}}

For each dimension, provide:
1. Score (0-10)
2. Identified issues with severity (critical/major/minor/suggestion)
3. Specific improvement suggestions with code examples

Component to review:
\`\`\`tsx
{{componentCode}}
\`\`\`

Output your critique as structured JSON:
{
  "scores": [
    {
      "dimension": "visual-hierarchy",
      "score": 8,
      "issues": [
        {
          "severity": "minor",
          "description": "Secondary actions compete with primary CTA",
          "suggestion": "Reduce prominence of secondary buttons",
          "codeExample": "className='text-muted-foreground hover:text-foreground'"
        }
      ]
    }
  ],
  "summary": "Overall assessment...",
  "topImprovements": ["improvement1", "improvement2", "improvement3"]
}
`;
```

## Critique Agent Implementation

```typescript
interface CritiqueAgentConfig {
  dimensions: CritiqueDimension[];
  threshold: number;
  maxIterations: number;
}

class DesignCritiqueAgent {
  private config: CritiqueAgentConfig;
  private history: CritiqueResult[] = [];

  constructor(config: Partial<CritiqueAgentConfig> = {}) {
    this.config = {
      dimensions: critiqueDimensions,
      threshold: QUALITY_THRESHOLD,
      maxIterations: 3,
      ...config,
    };
  }

  async critique(componentCode: string): Promise<CritiqueResult> {
    const prompt = this.buildPrompt(componentCode);
    const response = await this.callLLM(prompt);
    const result = this.parseResponse(response);

    this.history.push(result);
    return result;
  }

  private buildPrompt(code: string): string {
    return critiquePromptTemplate
      .replace('{{componentCode}}', code)
      .replace('{{dimensions}}', JSON.stringify(this.config.dimensions));
  }

  private calculateOverallScore(scores: CritiqueScore[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const score of scores) {
      const dimension = this.config.dimensions.find(d => d.id === score.dimension);
      if (dimension) {
        weightedSum += score.score * dimension.weight;
        totalWeight += dimension.weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private parseResponse(response: string): CritiqueResult {
    const parsed = JSON.parse(response);
    const overallScore = this.calculateOverallScore(parsed.scores);

    return {
      overallScore,
      scores: parsed.scores,
      summary: parsed.summary,
      improvements: this.extractImprovements(parsed.scores),
      passesThreshold: overallScore >= this.config.threshold,
    };
  }

  private extractImprovements(scores: CritiqueScore[]): CritiqueIssue[] {
    const allIssues = scores.flatMap(s => s.issues);

    // Sort by severity
    const severityOrder: Record<SeverityLevel, number> = {
      critical: 0,
      major: 1,
      minor: 2,
      suggestion: 3,
    };

    return allIssues
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 5); // Top 5 improvements
  }

  getHistory(): CritiqueResult[] {
    return this.history;
  }

  hasPassedThreshold(): boolean {
    const latest = this.history[this.history.length - 1];
    return latest?.passesThreshold ?? false;
  }
}
```

## Refinement Loop

```typescript
interface RefinementConfig {
  maxIterations: number;
  targetScore: number;
  autoApply: boolean;
}

async function iterativeRefinement(
  initialCode: string,
  config: RefinementConfig
): Promise<{
  finalCode: string;
  iterations: number;
  history: CritiqueResult[];
}> {
  const critiqueAgent = new DesignCritiqueAgent({ threshold: config.targetScore });
  let currentCode = initialCode;
  let iterations = 0;

  while (iterations < config.maxIterations) {
    iterations++;

    // Critique current version
    const critique = await critiqueAgent.critique(currentCode);

    if (critique.passesThreshold) {
      return {
        finalCode: currentCode,
        iterations,
        history: critiqueAgent.getHistory(),
      };
    }

    // Apply improvements
    if (config.autoApply) {
      currentCode = await applyImprovements(currentCode, critique.improvements);
    } else {
      // Return with suggestions for manual review
      break;
    }
  }

  return {
    finalCode: currentCode,
    iterations,
    history: critiqueAgent.getHistory(),
  };
}

async function applyImprovements(
  code: string,
  improvements: CritiqueIssue[]
): Promise<string> {
  const refinementPrompt = `
Apply these improvements to the component:

${improvements.map((imp, i) => `
${i + 1}. ${imp.description}
   Suggestion: ${imp.suggestion}
   ${imp.codeExample ? `Example: ${imp.codeExample}` : ''}
`).join('\n')}

Original component:
\`\`\`tsx
${code}
\`\`\`

Output the improved component code only, no explanations.
`;

  const improvedCode = await callLLM(refinementPrompt);
  return improvedCode;
}
```

## Specialized Critiques

### Accessibility Audit

```typescript
const accessibilityCritique = {
  id: 'a11y-audit',
  name: 'Accessibility Audit',
  checks: [
    {
      id: 'color-contrast',
      check: 'All text meets WCAG AA contrast (4.5:1 normal, 3:1 large)',
      autoFix: 'Adjust color to meet contrast requirement',
    },
    {
      id: 'focus-visible',
      check: 'All interactive elements have visible focus indicators',
      autoFix: 'Add focus-visible:ring-2 focus-visible:ring-ring',
    },
    {
      id: 'aria-labels',
      check: 'Icon-only buttons have aria-label',
      autoFix: 'Add aria-label describing the action',
    },
    {
      id: 'heading-order',
      check: 'Headings follow logical order (h1 → h2 → h3)',
      autoFix: 'Adjust heading levels',
    },
    {
      id: 'keyboard-nav',
      check: 'All functionality accessible via keyboard',
      autoFix: 'Add keyboard event handlers',
    },
    {
      id: 'reduced-motion',
      check: 'Animations respect prefers-reduced-motion',
      autoFix: 'Wrap animations in motion-safe or use useReducedMotion',
    },
  ],
};
```

### Performance Critique

```typescript
const performanceCritique = {
  id: 'perf-audit',
  name: 'Performance Audit',
  checks: [
    {
      id: 'bundle-size',
      check: 'No unnecessary dependencies imported',
      suggestion: 'Use tree-shakeable imports',
    },
    {
      id: 'memoization',
      check: 'Expensive computations memoized',
      suggestion: 'Use useMemo/useCallback where appropriate',
    },
    {
      id: 'render-optimization',
      check: 'Avoid unnecessary re-renders',
      suggestion: 'Use React.memo for pure components',
    },
    {
      id: 'lazy-loading',
      check: 'Heavy components use lazy loading',
      suggestion: 'Use React.lazy and Suspense',
    },
    {
      id: 'image-optimization',
      check: 'Images use next/image or optimized loading',
      suggestion: 'Add width/height, use modern formats',
    },
  ],
};
```

### Responsive Design Critique

```typescript
const responsiveCritique = {
  id: 'responsive-audit',
  name: 'Responsive Design Audit',
  breakpoints: ['sm', 'md', 'lg', 'xl', '2xl'],
  checks: [
    {
      id: 'mobile-first',
      check: 'Styles follow mobile-first approach',
      pattern: /^(sm:|md:|lg:|xl:|2xl:)/,
    },
    {
      id: 'touch-targets',
      check: 'Touch targets are at least 44px',
      suggestion: 'Use min-h-11 min-w-11 for interactive elements',
    },
    {
      id: 'text-scaling',
      check: 'Text scales appropriately across breakpoints',
      suggestion: 'Use responsive text classes (text-sm md:text-base)',
    },
    {
      id: 'layout-shifts',
      check: 'No layout shifts on resize',
      suggestion: 'Define explicit dimensions or aspect ratios',
    },
  ],
};
```

## Integration with Component Generator

```typescript
// In component-generator agent
async function generateWithCritique(
  request: ComponentRequest
): Promise<GeneratedComponent> {
  // Initial generation
  let component = await generateComponent(request);

  // Critique loop
  const refinement = await iterativeRefinement(component.code, {
    maxIterations: 3,
    targetScore: 7.5,
    autoApply: true,
  });

  return {
    ...component,
    code: refinement.finalCode,
    critiqueHistory: refinement.history,
    qualityScore: refinement.history[refinement.history.length - 1].overallScore,
  };
}
```

## Critique Report Format

```typescript
function formatCritiqueReport(result: CritiqueResult): string {
  const scoreBar = (score: number) => {
    const filled = Math.round(score);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  return `
# Design Critique Report

## Overall Score: ${result.overallScore.toFixed(1)}/10 ${result.passesThreshold ? '✅' : '⚠️'}

${scoreBar(result.overallScore)} ${result.overallScore.toFixed(1)}

## Dimension Scores

${result.scores.map(s => `
### ${s.dimension}
${scoreBar(s.score)} ${s.score}/10

${s.issues.length > 0 ? `
Issues:
${s.issues.map(i => `- [${i.severity.toUpperCase()}] ${i.description}`).join('\n')}
` : '✓ No issues found'}
`).join('\n')}

## Top Improvements

${result.improvements.map((imp, i) => `
${i + 1}. **${imp.description}**
   Severity: ${imp.severity}
   Suggestion: ${imp.suggestion}
   ${imp.codeExample ? `\`\`\`tsx\n${imp.codeExample}\n\`\`\`` : ''}
`).join('\n')}

## Summary

${result.summary}
`;
}
```

## Usage in Agent Workflow

```markdown
## Design Critique Workflow

When generating or reviewing components:

1. **Generate Initial Component**
   - Create component based on user request
   - Apply standard patterns and best practices

2. **Run Critique**
   - Evaluate against all dimensions
   - Identify issues by severity
   - Calculate quality score

3. **Iterate if Needed**
   - If score < threshold, apply top improvements
   - Re-run critique
   - Maximum 3 iterations

4. **Report Results**
   - Show final score and dimension breakdown
   - List any remaining suggestions
   - Provide code with improvements applied

5. **User Approval**
   - Present final component
   - Offer to address specific concerns
   - Allow manual refinement requests
```

## Key Takeaways

1. **Multi-Dimensional**: Evaluate visual, accessibility, performance aspects
2. **Weighted Scoring**: Prioritize accessibility and hierarchy
3. **Iterative**: Auto-refine until quality threshold met
4. **Actionable**: Provide specific code improvements
5. **Transparent**: Show scoring breakdown and history
6. **Specialized Audits**: Deep-dive for a11y, performance, responsive
