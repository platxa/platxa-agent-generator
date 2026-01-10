# Component Similarity Search

Pattern matching to find existing similar components in the codebase.

## Overview

The similarity search system enables the agent to:
1. Index existing components with semantic embeddings
2. Find similar components to a query or new design
3. Reuse patterns from existing implementations
4. Avoid duplicate component creation

## Component Indexing

```typescript
interface ComponentMetadata {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  props: PropDefinition[];
  variants: string[];
  dependencies: string[];
  patterns: string[];
  source: string;
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

interface IndexedComponent {
  metadata: ComponentMetadata;
  embedding: number[];
  codeHash: string;
  lastUpdated: Date;
}
```

## Component Parser

```typescript
import * as ts from 'typescript';

interface ParsedComponent {
  name: string;
  props: PropDefinition[];
  hasForwardRef: boolean;
  usedHooks: string[];
  imports: string[];
  exportType: 'default' | 'named';
}

function parseComponent(code: string, filePath: string): ParsedComponent {
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  const result: ParsedComponent = {
    name: '',
    props: [],
    hasForwardRef: false,
    usedHooks: [],
    imports: [],
    exportType: 'named',
  };

  function visit(node: ts.Node) {
    // Extract component name
    if (ts.isFunctionDeclaration(node) && node.name) {
      result.name = node.name.text;
    }

    // Extract forwardRef
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) || ts.isIdentifier(expr)) {
        const name = ts.isIdentifier(expr) ? expr.text : expr.name.text;
        if (name === 'forwardRef') {
          result.hasForwardRef = true;
        }
      }
    }

    // Extract hooks usage
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const hookName = node.expression.text;
      if (hookName.startsWith('use')) {
        result.usedHooks.push(hookName);
      }
    }

    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        result.imports.push(moduleSpecifier.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}
```

## Feature Extraction

```typescript
interface ComponentFeatures {
  structural: StructuralFeatures;
  semantic: SemanticFeatures;
  visual: VisualFeatures;
}

interface StructuralFeatures {
  elementCount: number;
  maxDepth: number;
  hasConditionalRender: boolean;
  hasLoop: boolean;
  propsCount: number;
  variantsCount: number;
}

interface SemanticFeatures {
  category: ComponentCategory;
  purpose: string[];
  keywords: string[];
  patterns: PatternType[];
}

interface VisualFeatures {
  usesAnimation: boolean;
  hasResponsive: boolean;
  colorScheme: string[];
  layoutType: 'flex' | 'grid' | 'block' | 'inline';
}

type ComponentCategory =
  | 'input'
  | 'display'
  | 'feedback'
  | 'navigation'
  | 'layout'
  | 'overlay'
  | 'data';

type PatternType =
  | 'compound-component'
  | 'render-prop'
  | 'controlled'
  | 'uncontrolled'
  | 'headless'
  | 'polymorphic';

function extractFeatures(code: string, metadata: ComponentMetadata): ComponentFeatures {
  return {
    structural: extractStructuralFeatures(code),
    semantic: extractSemanticFeatures(code, metadata),
    visual: extractVisualFeatures(code),
  };
}

function extractStructuralFeatures(code: string): StructuralFeatures {
  const jsxElementPattern = /<[A-Z][a-zA-Z]*/g;
  const conditionalPattern = /\{.*\?.*:.*\}|&&/g;
  const loopPattern = /\.map\(|\.forEach\(/g;

  return {
    elementCount: (code.match(jsxElementPattern) || []).length,
    maxDepth: calculateJSXDepth(code),
    hasConditionalRender: conditionalPattern.test(code),
    hasLoop: loopPattern.test(code),
    propsCount: (code.match(/props\./g) || []).length,
    variantsCount: (code.match(/variant[s]?:/g) || []).length,
  };
}

function extractVisualFeatures(code: string): VisualFeatures {
  return {
    usesAnimation: /motion\.|animate|transition|framer-motion/.test(code),
    hasResponsive: /sm:|md:|lg:|xl:|2xl:/.test(code),
    colorScheme: extractColors(code),
    layoutType: detectLayoutType(code),
  };
}
```

## Embedding Generation

```typescript
interface EmbeddingConfig {
  model: string;
  dimensions: number;
}

const defaultConfig: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
};

async function generateEmbedding(
  text: string,
  config: EmbeddingConfig = defaultConfig
): Promise<number[]> {
  // Using OpenAI embeddings API
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      dimensions: config.dimensions,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

function createComponentDescription(
  metadata: ComponentMetadata,
  features: ComponentFeatures
): string {
  return `
Component: ${metadata.name}
Category: ${features.semantic.category}
Purpose: ${features.semantic.purpose.join(', ')}
Props: ${metadata.props.map(p => `${p.name}: ${p.type}`).join(', ')}
Patterns: ${features.semantic.patterns.join(', ')}
Keywords: ${features.semantic.keywords.join(', ')}
Features: ${[
  features.visual.usesAnimation && 'animated',
  features.visual.hasResponsive && 'responsive',
  features.structural.hasLoop && 'list-rendering',
  features.structural.hasConditionalRender && 'conditional',
].filter(Boolean).join(', ')}
  `.trim();
}
```

## Vector Store

```typescript
interface VectorStore {
  add(id: string, embedding: number[], metadata: ComponentMetadata): Promise<void>;
  search(query: number[], limit: number): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
  update(id: string, embedding: number[], metadata: ComponentMetadata): Promise<void>;
}

interface SearchResult {
  id: string;
  score: number;
  metadata: ComponentMetadata;
}

// In-memory vector store with cosine similarity
class InMemoryVectorStore implements VectorStore {
  private vectors: Map<string, { embedding: number[]; metadata: ComponentMetadata }> = new Map();

  async add(id: string, embedding: number[], metadata: ComponentMetadata): Promise<void> {
    this.vectors.set(id, { embedding, metadata });
  }

  async search(query: number[], limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const [id, { embedding, metadata }] of this.vectors) {
      const score = this.cosineSimilarity(query, embedding);
      results.push({ id, score, metadata });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async update(id: string, embedding: number[], metadata: ComponentMetadata): Promise<void> {
    this.vectors.set(id, { embedding, metadata });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

## Similarity Search Service

```typescript
interface SimilaritySearchConfig {
  minScore: number;
  maxResults: number;
  includeSource: boolean;
}

class ComponentSimilaritySearch {
  private vectorStore: VectorStore;
  private config: SimilaritySearchConfig;

  constructor(
    vectorStore: VectorStore,
    config: Partial<SimilaritySearchConfig> = {}
  ) {
    this.vectorStore = vectorStore;
    this.config = {
      minScore: 0.7,
      maxResults: 5,
      includeSource: false,
      ...config,
    };
  }

  async indexComponent(component: ComponentMetadata, code: string): Promise<void> {
    const features = extractFeatures(code, component);
    const description = createComponentDescription(component, features);
    const embedding = await generateEmbedding(description);

    await this.vectorStore.add(component.id, embedding, {
      ...component,
      source: this.config.includeSource ? code : '',
    });
  }

  async indexDirectory(directory: string): Promise<number> {
    const files = await glob(`${directory}/**/*.tsx`);
    let indexed = 0;

    for (const file of files) {
      try {
        const code = await readFile(file, 'utf-8');
        const parsed = parseComponent(code, file);
        const metadata = createMetadataFromParsed(parsed, file);

        await this.indexComponent(metadata, code);
        indexed++;
      } catch (error) {
        console.warn(`Failed to index ${file}:`, error);
      }
    }

    return indexed;
  }

  async findSimilar(query: string): Promise<SearchResult[]> {
    const embedding = await generateEmbedding(query);
    const results = await this.vectorStore.search(embedding, this.config.maxResults);

    return results.filter(r => r.score >= this.config.minScore);
  }

  async findSimilarToComponent(componentCode: string): Promise<SearchResult[]> {
    const parsed = parseComponent(componentCode, 'query.tsx');
    const metadata = createMetadataFromParsed(parsed, 'query.tsx');
    const features = extractFeatures(componentCode, metadata);
    const description = createComponentDescription(metadata, features);

    return this.findSimilar(description);
  }
}
```

## Pattern Matching

```typescript
interface PatternMatch {
  pattern: string;
  confidence: number;
  examples: string[];
  recommendation: string;
}

const knownPatterns = {
  'compound-component': {
    indicators: ['createContext', 'useContext', 'Children.map'],
    description: 'Parent with child components sharing state',
    example: 'Accordion, Tabs, Menu',
  },
  'controlled-input': {
    indicators: ['value', 'onChange', 'defaultValue'],
    description: 'Input controlled by parent state',
    example: 'Form inputs, Select',
  },
  'polymorphic': {
    indicators: ['as', 'component', 'ElementType'],
    description: 'Component that can render as different elements',
    example: 'Box, Text, Button',
  },
  'headless': {
    indicators: ['renderProps', 'children(', 'slot'],
    description: 'Logic without UI, render prop pattern',
    example: 'Downshift, React Aria',
  },
  'variant-based': {
    indicators: ['cva(', 'variants:', 'compoundVariants'],
    description: 'CVA-based style variants',
    example: 'Button, Badge, Card',
  },
};

function detectPatterns(code: string): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const [pattern, config] of Object.entries(knownPatterns)) {
    const matchCount = config.indicators.filter(indicator =>
      code.includes(indicator)
    ).length;

    const confidence = matchCount / config.indicators.length;

    if (confidence > 0.3) {
      matches.push({
        pattern,
        confidence,
        examples: [config.example],
        recommendation: config.description,
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}
```

## Usage in Agent Workflow

```typescript
// Initialize search service
const searchService = new ComponentSimilaritySearch(
  new InMemoryVectorStore(),
  { minScore: 0.75, maxResults: 3 }
);

// Index existing components
await searchService.indexDirectory('./src/components');

// Before generating new component, search for similar
async function handleComponentRequest(request: string): Promise<ComponentResult> {
  // Search for similar existing components
  const similar = await searchService.findSimilar(request);

  if (similar.length > 0 && similar[0].score > 0.9) {
    // Very similar component exists
    return {
      action: 'reuse',
      existing: similar[0].metadata,
      message: `Found existing component "${similar[0].metadata.name}" with ${Math.round(similar[0].score * 100)}% similarity`,
    };
  }

  if (similar.length > 0 && similar[0].score > 0.75) {
    // Moderately similar - suggest as reference
    return {
      action: 'generate-with-reference',
      references: similar.map(s => s.metadata),
      message: `Found ${similar.length} similar components to use as reference`,
    };
  }

  // Generate new component
  return {
    action: 'generate-new',
    message: 'No similar components found, generating new',
  };
}
```

## Search Query Examples

```typescript
// Natural language queries
const queries = [
  'button with loading state and icon support',
  'modal dialog with animation and close on outside click',
  'dropdown menu with keyboard navigation',
  'form input with validation error display',
  'card component with image and hover effect',
  'table with sorting and pagination',
];

// Component code similarity
const existingButton = `
export function Button({ variant, size, loading, children }) {
  return (
    <button className={buttonVariants({ variant, size })} disabled={loading}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
`;

const similarResults = await searchService.findSimilarToComponent(existingButton);
```

## Integration Output Format

```markdown
## Similar Components Found

### 1. Button (92% match)
- **Path**: src/components/ui/button.tsx
- **Category**: input
- **Patterns**: variant-based, polymorphic
- **Recommendation**: Use existing Button component, add loading prop if missing

### 2. IconButton (78% match)
- **Path**: src/components/ui/icon-button.tsx
- **Category**: input
- **Patterns**: variant-based
- **Recommendation**: Consider extending Button instead of creating new

### 3. LinkButton (71% match)
- **Path**: src/components/ui/link-button.tsx
- **Category**: navigation
- **Patterns**: polymorphic
- **Recommendation**: Reference for `as` prop implementation
```

## Key Takeaways

1. **Semantic Search**: Embeddings capture component purpose
2. **Feature Extraction**: Analyze structure, semantics, visuals
3. **Pattern Detection**: Identify common React patterns
4. **Deduplication**: Prevent creating similar components
5. **Reference Suggestions**: Find related implementations
6. **Configurable Threshold**: Adjust similarity sensitivity
