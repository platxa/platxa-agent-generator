# Context Window Management

Efficient handling of large projects within LLM context limits.

## Overview

Context management enables the agent to:
1. Track token usage across conversation
2. Prioritize relevant files for context
3. Summarize less relevant content
4. Handle projects with many files efficiently

## Context Budget

```typescript
interface ContextBudget {
  maxTokens: number;
  reservedForOutput: number;
  reservedForSystem: number;
  availableForContent: number;
}

interface TokenUsage {
  system: number;
  conversation: number;
  content: number;
  total: number;
  remaining: number;
}

const MODEL_LIMITS: Record<string, ContextBudget> = {
  'claude-3-opus': {
    maxTokens: 200000,
    reservedForOutput: 4096,
    reservedForSystem: 8000,
    availableForContent: 187904,
  },
  'claude-3-sonnet': {
    maxTokens: 200000,
    reservedForOutput: 4096,
    reservedForSystem: 8000,
    availableForContent: 187904,
  },
  'gpt-4-turbo': {
    maxTokens: 128000,
    reservedForOutput: 4096,
    reservedForSystem: 4000,
    availableForContent: 119904,
  },
};
```

## Token Counter

```typescript
import { encode } from 'gpt-tokenizer';

class TokenCounter {
  private cache: Map<string, number> = new Map();

  count(text: string): number {
    const cached = this.cache.get(text);
    if (cached !== undefined) return cached;

    const tokens = encode(text).length;
    this.cache.set(text, tokens);
    return tokens;
  }

  countFile(path: string, content: string): number {
    // Include file path and markers in count
    const fullContent = `\n--- ${path} ---\n${content}\n`;
    return this.count(fullContent);
  }

  estimateFromCharacters(chars: number): number {
    // Rough estimate: ~4 chars per token for code
    return Math.ceil(chars / 4);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## File Relevance Scoring

```typescript
interface FileScore {
  path: string;
  score: number;
  tokens: number;
  reasons: string[];
}

interface RelevanceConfig {
  taskDescription: string;
  recentlyModified: string[];
  importedBy: Map<string, string[]>;
  keywords: string[];
}

function scoreFileRelevance(
  path: string,
  content: string,
  config: RelevanceConfig
): FileScore {
  const reasons: string[] = [];
  let score = 0;

  // Check if recently modified
  if (config.recentlyModified.includes(path)) {
    score += 30;
    reasons.push('recently modified');
  }

  // Check if imported by other relevant files
  const importers = config.importedBy.get(path) || [];
  if (importers.length > 0) {
    score += Math.min(importers.length * 5, 20);
    reasons.push(`imported by ${importers.length} files`);
  }

  // Check keyword matches
  const keywordMatches = config.keywords.filter(kw =>
    content.toLowerCase().includes(kw.toLowerCase())
  );
  if (keywordMatches.length > 0) {
    score += keywordMatches.length * 10;
    reasons.push(`matches: ${keywordMatches.join(', ')}`);
  }

  // Boost for specific file types
  if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
    score += 5;
    reasons.push('component file');
  }
  if (path.includes('/components/')) {
    score += 5;
    reasons.push('components directory');
  }
  if (path.includes('index.')) {
    score += 3;
    reasons.push('index file');
  }

  // Penalize test files unless task mentions testing
  if (path.includes('.test.') || path.includes('.spec.')) {
    if (!config.taskDescription.toLowerCase().includes('test')) {
      score -= 20;
      reasons.push('test file (deprioritized)');
    }
  }

  // Penalize generated/build files
  if (path.includes('/dist/') || path.includes('/build/') || path.includes('.d.ts')) {
    score -= 50;
    reasons.push('generated file');
  }

  return {
    path,
    score: Math.max(0, score),
    tokens: new TokenCounter().countFile(path, content),
    reasons,
  };
}
```

## Context Manager

```typescript
interface ContextFile {
  path: string;
  content: string;
  tokens: number;
  score: number;
  included: 'full' | 'summary' | 'excluded';
}

interface ContextPlan {
  files: ContextFile[];
  totalTokens: number;
  budgetUsed: number;
  summaries: FileSummary[];
}

interface FileSummary {
  path: string;
  summary: string;
  exports: string[];
  dependencies: string[];
}

class ContextManager {
  private budget: ContextBudget;
  private tokenCounter: TokenCounter;
  private conversationTokens: number = 0;

  constructor(model: string) {
    this.budget = MODEL_LIMITS[model] || MODEL_LIMITS['claude-3-sonnet'];
    this.tokenCounter = new TokenCounter();
  }

  updateConversationTokens(messages: string[]): void {
    this.conversationTokens = messages.reduce(
      (sum, msg) => sum + this.tokenCounter.count(msg),
      0
    );
  }

  getAvailableTokens(): number {
    return this.budget.availableForContent - this.conversationTokens;
  }

  async planContext(
    files: Map<string, string>,
    config: RelevanceConfig
  ): Promise<ContextPlan> {
    const available = this.getAvailableTokens();
    const scoredFiles: FileScore[] = [];

    // Score all files
    for (const [path, content] of files) {
      scoredFiles.push(scoreFileRelevance(path, content, config));
    }

    // Sort by score (highest first)
    scoredFiles.sort((a, b) => b.score - a.score);

    const plan: ContextPlan = {
      files: [],
      totalTokens: 0,
      budgetUsed: 0,
      summaries: [],
    };

    // Phase 1: Include high-priority files in full
    const highPriorityThreshold = 50;
    for (const file of scoredFiles.filter(f => f.score >= highPriorityThreshold)) {
      if (plan.totalTokens + file.tokens <= available * 0.7) {
        plan.files.push({
          path: file.path,
          content: files.get(file.path)!,
          tokens: file.tokens,
          score: file.score,
          included: 'full',
        });
        plan.totalTokens += file.tokens;
      }
    }

    // Phase 2: Summarize medium-priority files
    const mediumPriorityFiles = scoredFiles.filter(
      f => f.score >= 20 && f.score < highPriorityThreshold
    );

    for (const file of mediumPriorityFiles) {
      const content = files.get(file.path)!;
      const summary = await this.summarizeFile(file.path, content);
      const summaryTokens = this.tokenCounter.count(summary.summary);

      if (plan.totalTokens + summaryTokens <= available * 0.9) {
        plan.files.push({
          path: file.path,
          content: summary.summary,
          tokens: summaryTokens,
          score: file.score,
          included: 'summary',
        });
        plan.summaries.push(summary);
        plan.totalTokens += summaryTokens;
      }
    }

    // Phase 3: List remaining files (excluded from context)
    for (const file of scoredFiles) {
      if (!plan.files.find(f => f.path === file.path)) {
        plan.files.push({
          path: file.path,
          content: '',
          tokens: 0,
          score: file.score,
          included: 'excluded',
        });
      }
    }

    plan.budgetUsed = (plan.totalTokens / available) * 100;
    return plan;
  }

  private async summarizeFile(path: string, content: string): Promise<FileSummary> {
    // Extract exports
    const exportMatches = content.matchAll(/export\s+(const|function|class|type|interface)\s+(\w+)/g);
    const exports = [...exportMatches].map(m => m[2]);

    // Extract imports
    const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
    const dependencies = [...new Set([...importMatches].map(m => m[1]))];

    // Generate summary
    const summary = `
File: ${path}
Exports: ${exports.join(', ') || 'none'}
Dependencies: ${dependencies.length} imports
${this.generateBriefDescription(content)}
    `.trim();

    return { path, summary, exports, dependencies };
  }

  private generateBriefDescription(content: string): string {
    const lines = content.split('\n').slice(0, 50);

    // Look for JSDoc or leading comments
    const commentMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (commentMatch) {
      return commentMatch[0].slice(0, 200);
    }

    // Look for component definition
    if (content.includes('function') || content.includes('const')) {
      const componentMatch = content.match(/(?:function|const)\s+(\w+)/);
      if (componentMatch) {
        return `Defines ${componentMatch[1]}`;
      }
    }

    return 'No description available';
  }
}
```

## Context Compression Strategies

```typescript
type CompressionStrategy = 'truncate' | 'summarize' | 'skeleton' | 'relevant-only';

interface CompressionResult {
  content: string;
  originalTokens: number;
  compressedTokens: number;
  ratio: number;
}

function compressContent(
  content: string,
  strategy: CompressionStrategy,
  targetTokens: number
): CompressionResult {
  const counter = new TokenCounter();
  const originalTokens = counter.count(content);

  let compressed: string;

  switch (strategy) {
    case 'truncate':
      compressed = truncateToTokens(content, targetTokens);
      break;
    case 'summarize':
      compressed = extractKeyParts(content);
      break;
    case 'skeleton':
      compressed = generateSkeleton(content);
      break;
    case 'relevant-only':
      compressed = extractRelevantSections(content);
      break;
  }

  const compressedTokens = counter.count(compressed);

  return {
    content: compressed,
    originalTokens,
    compressedTokens,
    ratio: compressedTokens / originalTokens,
  };
}

function truncateToTokens(content: string, maxTokens: number): string {
  const counter = new TokenCounter();
  const lines = content.split('\n');
  let result = '';
  let tokens = 0;

  for (const line of lines) {
    const lineTokens = counter.count(line + '\n');
    if (tokens + lineTokens > maxTokens) {
      result += '\n// ... truncated ...';
      break;
    }
    result += line + '\n';
    tokens += lineTokens;
  }

  return result;
}

function generateSkeleton(content: string): string {
  const lines = content.split('\n');
  const skeleton: string[] = [];

  for (const line of lines) {
    // Keep imports
    if (line.trim().startsWith('import')) {
      skeleton.push(line);
    }
    // Keep exports and function signatures
    else if (line.includes('export') || line.includes('function') || line.includes('const')) {
      if (line.includes('{')) {
        skeleton.push(line.replace(/\{[\s\S]*$/, '{ ... }'));
      } else {
        skeleton.push(line);
      }
    }
    // Keep interface/type definitions
    else if (line.includes('interface') || line.includes('type ')) {
      skeleton.push(line);
    }
  }

  return skeleton.join('\n');
}

function extractRelevantSections(content: string, keywords: string[] = []): string {
  if (keywords.length === 0) return content;

  const lines = content.split('\n');
  const relevantLines: Set<number> = new Set();

  // Find lines containing keywords
  for (let i = 0; i < lines.length; i++) {
    for (const keyword of keywords) {
      if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
        // Include surrounding context (5 lines before and after)
        for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
          relevantLines.add(j);
        }
      }
    }
  }

  // Build result with ellipsis for gaps
  const result: string[] = [];
  let lastIncluded = -2;

  for (let i = 0; i < lines.length; i++) {
    if (relevantLines.has(i)) {
      if (i > lastIncluded + 1) {
        result.push('// ...');
      }
      result.push(lines[i]);
      lastIncluded = i;
    }
  }

  return result.join('\n');
}
```

## Progressive Loading

```typescript
interface LoadingPhase {
  phase: number;
  files: string[];
  tokens: number;
  description: string;
}

class ProgressiveLoader {
  private phases: LoadingPhase[] = [];
  private currentPhase: number = 0;

  constructor(
    private contextManager: ContextManager,
    private files: Map<string, string>
  ) {}

  planPhases(config: RelevanceConfig): LoadingPhase[] {
    const available = this.contextManager.getAvailableTokens();
    const counter = new TokenCounter();

    // Phase 1: Core files (entry points, config)
    const coreFiles = [...this.files.keys()].filter(
      p => p.includes('index.') || p.includes('config') || p.includes('App.')
    );

    // Phase 2: Direct dependencies of task
    const directDeps = this.findDirectDependencies(config.keywords);

    // Phase 3: Related components
    const relatedComponents = [...this.files.keys()].filter(
      p => p.includes('/components/') && !coreFiles.includes(p)
    );

    // Phase 4: Everything else
    const remaining = [...this.files.keys()].filter(
      p => !coreFiles.includes(p) && !directDeps.includes(p) && !relatedComponents.includes(p)
    );

    this.phases = [
      { phase: 1, files: coreFiles, tokens: this.countTokens(coreFiles), description: 'Core files' },
      { phase: 2, files: directDeps, tokens: this.countTokens(directDeps), description: 'Direct dependencies' },
      { phase: 3, files: relatedComponents, tokens: this.countTokens(relatedComponents), description: 'Related components' },
      { phase: 4, files: remaining, tokens: this.countTokens(remaining), description: 'Remaining files' },
    ];

    return this.phases;
  }

  loadNextPhase(): { files: Map<string, string>; hasMore: boolean } {
    if (this.currentPhase >= this.phases.length) {
      return { files: new Map(), hasMore: false };
    }

    const phase = this.phases[this.currentPhase];
    const result = new Map<string, string>();

    for (const path of phase.files) {
      result.set(path, this.files.get(path)!);
    }

    this.currentPhase++;
    return { files: result, hasMore: this.currentPhase < this.phases.length };
  }

  private findDirectDependencies(keywords: string[]): string[] {
    return [...this.files.keys()].filter(path => {
      const content = this.files.get(path)!;
      return keywords.some(kw => content.includes(kw));
    });
  }

  private countTokens(paths: string[]): number {
    const counter = new TokenCounter();
    return paths.reduce(
      (sum, path) => sum + counter.countFile(path, this.files.get(path)!),
      0
    );
  }
}
```

## Usage in Agent Workflow

```typescript
// Initialize context manager
const contextManager = new ContextManager('claude-3-sonnet');

// Update with current conversation
contextManager.updateConversationTokens(conversationHistory);

// Plan context for task
const plan = await contextManager.planContext(projectFiles, {
  taskDescription: 'Create a new Button component with variants',
  recentlyModified: ['src/components/ui/button.tsx'],
  importedBy: importGraph,
  keywords: ['Button', 'variant', 'CVA', 'onClick'],
});

// Log context usage
console.log(`Context plan: ${plan.budgetUsed.toFixed(1)}% of budget used`);
console.log(`Files included: ${plan.files.filter(f => f.included === 'full').length} full`);
console.log(`Files summarized: ${plan.files.filter(f => f.included === 'summary').length}`);
console.log(`Files excluded: ${plan.files.filter(f => f.included === 'excluded').length}`);

// Build context string
const contextContent = plan.files
  .filter(f => f.included !== 'excluded')
  .map(f => `\n--- ${f.path} ---\n${f.content}`)
  .join('\n');
```

## Key Takeaways

1. **Token Budgeting**: Track and allocate context space
2. **Relevance Scoring**: Prioritize files by importance
3. **Compression Strategies**: Truncate, summarize, skeleton
4. **Progressive Loading**: Load in phases by priority
5. **File Summaries**: Extract key info for large files
6. **Cache Token Counts**: Avoid recomputation
7. **Dynamic Allocation**: Adjust based on conversation length
