/**
 * Semantic Similarity Extractor
 *
 * Extracts and compares semantic similarity between code snippets
 * to find related patterns, bugs, and fixes across the codebase.
 *
 * Feature #30: Related code extractor using semantic similarity
 *
 * @module semantic-similarity
 */

import type { Language, SourceLocation } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Token types for code analysis
 */
export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'operator'
  | 'literal'
  | 'punctuation'
  | 'comment'
  | 'string'
  | 'number'
  | 'whitespace'
  | 'unknown';

/**
 * A code token with metadata
 */
export interface CodeToken {
  /** Token type */
  type: TokenType;
  /** Token value */
  value: string;
  /** Normalized value (for comparison) */
  normalized: string;
  /** Start position in source */
  start: number;
  /** End position in source */
  end: number;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/**
 * Code structure representation
 */
export interface CodeStructure {
  /** Structure type (function, class, loop, etc.) */
  type: string;
  /** Structure name (if applicable) */
  name?: string;
  /** Nested structures */
  children: CodeStructure[];
  /** Depth in the AST */
  depth: number;
  /** Source location */
  location?: SourceLocation;
  /** Structural hash for comparison */
  hash: string;
}

/**
 * Similarity score breakdown
 */
export interface SimilarityBreakdown {
  /** Token-based similarity (0-1) */
  tokenSimilarity: number;
  /** Structural similarity (0-1) */
  structuralSimilarity: number;
  /** Semantic similarity (0-1) */
  semanticSimilarity: number;
  /** Name pattern similarity (0-1) */
  nameSimilarity: number;
  /** Overall weighted similarity (0-1) */
  overall: number;
}

/**
 * Result of similarity comparison
 */
export interface SimilarityResult {
  /** Source code snippet A */
  snippetA: CodeSnippet;
  /** Source code snippet B */
  snippetB: CodeSnippet;
  /** Similarity score breakdown */
  similarity: SimilarityBreakdown;
  /** Common patterns found */
  commonPatterns: string[];
  /** Differences identified */
  differences: CodeDifference[];
  /** Confidence in the comparison (0-1) */
  confidence: number;
}

/**
 * A code snippet for comparison
 */
export interface CodeSnippet {
  /** Source code */
  code: string;
  /** Language */
  language: Language;
  /** File path (optional) */
  filePath?: string;
  /** Source location (optional) */
  location?: SourceLocation;
  /** Extracted tokens */
  tokens?: CodeToken[];
  /** Code structure */
  structure?: CodeStructure;
}

/**
 * Difference between code snippets
 */
export interface CodeDifference {
  /** Type of difference */
  type: 'addition' | 'deletion' | 'modification' | 'reorder';
  /** Description of the difference */
  description: string;
  /** Location in snippet A */
  locationA?: { start: number; end: number };
  /** Location in snippet B */
  locationB?: { start: number; end: number };
  /** Severity (0-1, higher = more significant) */
  significance: number;
}

/**
 * Related code match
 */
export interface RelatedCodeMatch {
  /** The matching code snippet */
  snippet: CodeSnippet;
  /** Similarity score */
  similarity: number;
  /** Why this code is related */
  reason: string;
  /** Common structural patterns */
  patterns: string[];
  /** Confidence level */
  confidence: number;
}

/**
 * Configuration for semantic similarity
 */
export interface SemanticSimilarityConfig {
  /** Weight for token similarity */
  tokenWeight: number;
  /** Weight for structural similarity */
  structuralWeight: number;
  /** Weight for semantic similarity */
  semanticWeight: number;
  /** Weight for name similarity */
  nameWeight: number;
  /** Minimum similarity threshold for matches */
  minSimilarityThreshold: number;
  /** Maximum number of matches to return */
  maxMatches: number;
  /** Whether to normalize identifiers */
  normalizeIdentifiers: boolean;
  /** Whether to ignore comments */
  ignoreComments: boolean;
  /** Whether to ignore whitespace */
  ignoreWhitespace: boolean;
  /** N-gram size for token comparison */
  ngramSize: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: SemanticSimilarityConfig = {
  tokenWeight: 0.3,
  structuralWeight: 0.35,
  semanticWeight: 0.25,
  nameWeight: 0.1,
  minSimilarityThreshold: 0.5,
  maxMatches: 10,
  normalizeIdentifiers: true,
  ignoreComments: true,
  ignoreWhitespace: true,
  ngramSize: 3,
};

// =============================================================================
// Language-Specific Patterns
// =============================================================================

interface LanguagePatterns {
  keywords: Set<string>;
  operators: Set<string>;
  structurePatterns: RegExp[];
}

const LANGUAGE_PATTERNS: Record<Language, LanguagePatterns> = {
  python: {
    keywords: new Set([
      'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except',
      'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'raise',
      'break', 'continue', 'pass', 'lambda', 'and', 'or', 'not', 'in', 'is',
      'True', 'False', 'None', 'async', 'await', 'global', 'nonlocal',
    ]),
    operators: new Set([
      '+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=',
      '>=', '+=', '-=', '*=', '/=', '//=', '%=', '**=', '&', '|', '^', '~',
      '<<', '>>', '&=', '|=', '^=', '<<=', '>>=', '->', ':=',
    ]),
    structurePatterns: [
      /^def\s+(\w+)\s*\(/,
      /^class\s+(\w+)/,
      /^if\s+/,
      /^for\s+\w+\s+in\s+/,
      /^while\s+/,
      /^try\s*:/,
      /^with\s+/,
    ],
  },
  javascript: {
    keywords: new Set([
      'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'throw',
      'try', 'catch', 'finally', 'new', 'delete', 'typeof', 'instanceof', 'in',
      'of', 'this', 'super', 'import', 'export', 'from', 'as', 'async', 'await',
      'yield', 'true', 'false', 'null', 'undefined', 'void', 'extends',
    ]),
    operators: new Set([
      '+', '-', '*', '/', '%', '**', '=', '==', '===', '!=', '!==', '<', '>',
      '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**=', '&&', '||', '??', '!',
      '&', '|', '^', '~', '<<', '>>', '>>>', '&=', '|=', '^=', '<<=', '>>=',
      '>>>=', '++', '--', '...', '=>', '?.', '?.',
    ]),
    structurePatterns: [
      /^function\s+(\w+)\s*\(/,
      /^class\s+(\w+)/,
      /^const\s+(\w+)\s*=/,
      /^let\s+(\w+)\s*=/,
      /^if\s*\(/,
      /^for\s*\(/,
      /^while\s*\(/,
      /^try\s*\{/,
    ],
  },
  typescript: {
    keywords: new Set([
      'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'throw',
      'try', 'catch', 'finally', 'new', 'delete', 'typeof', 'instanceof', 'in',
      'of', 'this', 'super', 'import', 'export', 'from', 'as', 'async', 'await',
      'yield', 'true', 'false', 'null', 'undefined', 'void', 'extends',
      'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract',
      'implements', 'private', 'protected', 'public', 'readonly', 'static',
      'override', 'keyof', 'infer', 'never', 'unknown', 'any',
    ]),
    operators: new Set([
      '+', '-', '*', '/', '%', '**', '=', '==', '===', '!=', '!==', '<', '>',
      '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**=', '&&', '||', '??', '!',
      '&', '|', '^', '~', '<<', '>>', '>>>', '&=', '|=', '^=', '<<=', '>>=',
      '>>>=', '++', '--', '...', '=>', '?.', '?:', 'as', 'is',
    ]),
    structurePatterns: [
      /^function\s+(\w+)\s*[<(]/,
      /^class\s+(\w+)/,
      /^interface\s+(\w+)/,
      /^type\s+(\w+)\s*=/,
      /^const\s+(\w+)\s*[:<]?/,
      /^if\s*\(/,
      /^for\s*\(/,
      /^while\s*\(/,
    ],
  },
  css: {
    keywords: new Set([
      '@media', '@import', '@keyframes', '@font-face', '@supports', '@layer',
      '@container', '@property', 'important', 'inherit', 'initial', 'unset',
      'revert', 'auto', 'none', 'block', 'inline', 'flex', 'grid',
    ]),
    operators: new Set(['+', '>', '~', '*', ':', '::', ',', ';', '{', '}', '(', ')', '[', ']']),
    structurePatterns: [
      /^\.[\w-]+\s*\{/,
      /^#[\w-]+\s*\{/,
      /^[\w-]+\s*\{/,
      /^@media\s+/,
      /^@keyframes\s+(\w+)/,
    ],
  },
  scss: {
    keywords: new Set([
      '@media', '@import', '@keyframes', '@font-face', '@supports', '@layer',
      '@mixin', '@include', '@extend', '@function', '@return', '@if', '@else',
      '@for', '@each', '@while', '@use', '@forward', '@at-root', '$',
    ]),
    operators: new Set(['+', '>', '~', '*', ':', '::', ',', ';', '{', '}', '(', ')', '[', ']', '#{', '}']),
    structurePatterns: [
      /^\.[\w-]+\s*\{/,
      /^#[\w-]+\s*\{/,
      /^@mixin\s+(\w+)/,
      /^@function\s+(\w+)/,
      /^\$[\w-]+\s*:/,
    ],
  },
  tailwind: {
    keywords: new Set([
      '@tailwind', '@apply', '@layer', '@variants', '@responsive', '@screen',
      'base', 'components', 'utilities',
    ]),
    operators: new Set([':', '-', '[', ']', '/', '!']),
    structurePatterns: [
      /^@layer\s+(\w+)/,
      /^@apply\s+/,
    ],
  },
  html: {
    keywords: new Set([
      'html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'script', 'style',
      'link', 'meta', 'title', 'header', 'footer', 'main', 'section', 'article',
      'nav', 'aside', 'form', 'input', 'button', 'select', 'option', 'table',
      'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ]),
    operators: new Set(['=', '<', '>', '/', '"', "'"]),
    structurePatterns: [
      /<(\w+)[\s>]/,
      /<\/(\w+)>/,
    ],
  },
  json: {
    keywords: new Set(['true', 'false', 'null']),
    operators: new Set(['{', '}', '[', ']', ':', ',']),
    structurePatterns: [
      /^\s*"(\w+)"\s*:/,
    ],
  },
  yaml: {
    keywords: new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off']),
    operators: new Set([':', '-', '>', '|', '&', '*', '!', '%', '@', '`']),
    structurePatterns: [
      /^(\w+):/,
      /^\s*-\s+/,
    ],
  },
  markdown: {
    keywords: new Set([]),
    operators: new Set(['#', '*', '-', '+', '>', '`', '[', ']', '(', ')', '|']),
    structurePatterns: [
      /^#{1,6}\s+/,
      /^\*\*\*|---/,
      /^```\w*/,
    ],
  },
  unknown: {
    keywords: new Set([]),
    operators: new Set([]),
    structurePatterns: [],
  },
};

// =============================================================================
// Tokenizer
// =============================================================================

/**
 * Tokenize source code into tokens
 */
function tokenize(code: string, language: Language): CodeToken[] {
  const tokens: CodeToken[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.unknown;

  // Common token patterns
  const tokenPatterns: Array<{ type: TokenType; regex: RegExp }> = [
    // Comments
    { type: 'comment', regex: /^\/\/[^\n]*/},
    { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
    { type: 'comment', regex: /^#[^\n]*/ },
    // Strings
    { type: 'string', regex: /^"(?:[^"\\]|\\.)*"/ },
    { type: 'string', regex: /^'(?:[^'\\]|\\.)*'/ },
    { type: 'string', regex: /^`(?:[^`\\]|\\.)*`/ },
    { type: 'string', regex: /^"""[\s\S]*?"""/ },
    { type: 'string', regex: /^'''[\s\S]*?'''/ },
    // Numbers
    { type: 'number', regex: /^0[xX][0-9a-fA-F]+/ },
    { type: 'number', regex: /^0[bB][01]+/ },
    { type: 'number', regex: /^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
    // Identifiers (checked against keywords after)
    { type: 'identifier', regex: /^[a-zA-Z_$][\w$]*/ },
    // Whitespace
    { type: 'whitespace', regex: /^\s+/ },
    // Operators (multi-char first)
    { type: 'operator', regex: /^(?:===|!==|>>>|<<=|>>=|&&=|\|\|=|\?\?=|\.\.\.|\*\*=|=>|->|:=|\?\.|&&|\|\||\?\?|<<|>>|<=|>=|==|!=|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=)/ },
    // Single-char operators
    { type: 'operator', regex: /^[+\-*/%=<>!&|^~?:]/ },
    // Punctuation
    { type: 'punctuation', regex: /^[()[\]{},;.]/ },
  ];

  let pos = 0;
  let line = 1;
  let column = 1;

  while (pos < code.length) {
    let matched = false;

    for (const { type, regex } of tokenPatterns) {
      const match = regex.exec(code.slice(pos));
      if (match) {
        const value = match[0];
        let tokenType = type;

        // Check if identifier is a keyword
        if (type === 'identifier' && patterns.keywords.has(value)) {
          tokenType = 'keyword';
        }

        tokens.push({
          type: tokenType,
          value,
          normalized: normalizeToken(value, tokenType),
          start: pos,
          end: pos + value.length,
          line,
          column,
        });

        // Update position tracking
        for (const char of value) {
          if (char === '\n') {
            line++;
            column = 1;
          } else {
            column++;
          }
        }

        pos += value.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Unknown character, add as unknown token
      const char = code[pos];
      if (char) {
        tokens.push({
          type: 'unknown',
          value: char,
          normalized: char,
          start: pos,
          end: pos + 1,
          line,
          column,
        });
        if (char === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
      pos++;
    }
  }

  return tokens;
}

/**
 * Normalize a token value for comparison
 */
function normalizeToken(value: string, type: TokenType): string {
  switch (type) {
    case 'identifier':
      // Normalize identifiers to placeholder
      return '__IDENT__';
    case 'string':
      return '__STRING__';
    case 'number':
      return '__NUMBER__';
    case 'comment':
      return '__COMMENT__';
    case 'whitespace':
      return ' ';
    default:
      return value.toLowerCase();
  }
}

// =============================================================================
// Structure Extractor
// =============================================================================

/**
 * Extract code structure from tokens
 */
function extractStructure(code: string, language: Language): CodeStructure {
  const lines = code.split('\n');
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.unknown;
  const root: CodeStructure = {
    type: 'root',
    children: [],
    depth: 0,
    hash: '',
  };

  const stack: CodeStructure[] = [root];
  let currentDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Calculate indentation depth
    const indent = line.length - line.trimStart().length;
    const depth = Math.floor(indent / 2); // Assume 2-space indent

    // Pop structures that are at higher depth
    while (stack.length > 1 && depth <= currentDepth) {
      stack.pop();
      currentDepth--;
    }

    // Check for structure patterns
    for (const pattern of patterns.structurePatterns) {
      const match = pattern.exec(trimmed);
      if (match) {
        const structure: CodeStructure = {
          type: getStructureType(trimmed, language),
          children: [],
          depth: depth + 1,
          location: {
            file: '',
            line: i + 1,
          },
          hash: '',
        };
        if (match[1]) {
          structure.name = match[1];
        }

        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(structure);
        }
        stack.push(structure);
        currentDepth = depth;
        break;
      }
    }
  }

  // Calculate hashes
  calculateStructureHash(root);

  return root;
}

/**
 * Get structure type from line
 */
function getStructureType(line: string, language: Language): string {
  const lineStart = line.slice(0, 20).toLowerCase();

  if (language === 'python') {
    if (lineStart.startsWith('def ')) return 'function';
    if (lineStart.startsWith('class ')) return 'class';
    if (lineStart.startsWith('if ')) return 'conditional';
    if (lineStart.startsWith('for ')) return 'loop';
    if (lineStart.startsWith('while ')) return 'loop';
    if (lineStart.startsWith('try')) return 'try-catch';
    if (lineStart.startsWith('with ')) return 'context-manager';
  } else if (language === 'javascript' || language === 'typescript') {
    if (lineStart.startsWith('function ')) return 'function';
    if (lineStart.startsWith('class ')) return 'class';
    if (lineStart.startsWith('interface ')) return 'interface';
    if (lineStart.startsWith('type ')) return 'type-alias';
    if (lineStart.includes('const ') || lineStart.includes('let ')) return 'declaration';
    if (lineStart.startsWith('if ') || lineStart.startsWith('if(')) return 'conditional';
    if (lineStart.startsWith('for ') || lineStart.startsWith('for(')) return 'loop';
    if (lineStart.startsWith('while ') || lineStart.startsWith('while(')) return 'loop';
    if (lineStart.startsWith('try')) return 'try-catch';
  } else if (language === 'css' || language === 'scss') {
    if (lineStart.startsWith('@media')) return 'media-query';
    if (lineStart.startsWith('@keyframes')) return 'animation';
    if (lineStart.startsWith('@mixin')) return 'mixin';
    if (lineStart.startsWith('.')) return 'class-selector';
    if (lineStart.startsWith('#')) return 'id-selector';
    return 'rule';
  }

  return 'block';
}

/**
 * Calculate hash for structure comparison
 */
function calculateStructureHash(structure: CodeStructure): string {
  const parts: string[] = [structure.type];

  // Add children hashes
  for (const child of structure.children) {
    parts.push(calculateStructureHash(child));
  }

  structure.hash = simpleHash(parts.join('|'));
  return structure.hash;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// =============================================================================
// Similarity Calculation
// =============================================================================

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const [key, valA] of vecA) {
    const valB = vecB.get(key) ?? 0;
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
  }

  for (const val of vecB.values()) {
    magnitudeB += val * val;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Create n-grams from tokens
 */
function createNgrams(tokens: CodeToken[], n: number): Set<string> {
  const ngrams = new Set<string>();

  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).map(t => t.normalized).join(' ');
    ngrams.add(ngram);
  }

  return ngrams;
}

/**
 * Create token frequency vector
 */
function createTokenVector(tokens: CodeToken[]): Map<string, number> {
  const vector = new Map<string, number>();

  for (const token of tokens) {
    const key = `${token.type}:${token.normalized}`;
    vector.set(key, (vector.get(key) ?? 0) + 1);
  }

  return vector;
}

/**
 * Calculate structure similarity using tree edit distance approximation
 */
function calculateStructureSimilarity(structA: CodeStructure, structB: CodeStructure): number {
  // Fast hash comparison
  if (structA.hash === structB.hash) return 1;

  // Compare types
  if (structA.type !== structB.type) return 0;

  // Compare children recursively
  if (structA.children.length === 0 && structB.children.length === 0) {
    return 1;
  }

  if (structA.children.length === 0 || structB.children.length === 0) {
    return 0.5;
  }

  // Calculate average similarity of matched children
  let totalSimilarity = 0;
  let matches = 0;

  for (const childA of structA.children) {
    let bestSimilarity = 0;
    for (const childB of structB.children) {
      const similarity = calculateStructureSimilarity(childA, childB);
      bestSimilarity = Math.max(bestSimilarity, similarity);
    }
    totalSimilarity += bestSimilarity;
    matches++;
  }

  // Penalize for different number of children
  const sizeDiff = Math.abs(structA.children.length - structB.children.length);
  const sizePenalty = sizeDiff / Math.max(structA.children.length, structB.children.length);

  return (matches > 0 ? totalSimilarity / matches : 0) * (1 - sizePenalty * 0.3);
}

/**
 * Extract identifier names for comparison
 */
function extractNames(tokens: CodeToken[]): string[] {
  return tokens
    .filter(t => t.type === 'identifier')
    .map(t => t.value);
}

/**
 * Calculate name similarity using Levenshtein-based approach
 */
function calculateNameSimilarity(namesA: string[], namesB: string[]): number {
  if (namesA.length === 0 && namesB.length === 0) return 1;
  if (namesA.length === 0 || namesB.length === 0) return 0;

  // Normalize names (camelCase/snake_case splitting)
  const normalizedA = namesA.flatMap(normalizeName);
  const normalizedB = namesB.flatMap(normalizeName);

  // Create sets for comparison
  const setA = new Set(normalizedA);
  const setB = new Set(normalizedB);

  return jaccardSimilarity(setA, setB);
}

/**
 * Normalize identifier name by splitting on case changes and underscores
 */
function normalizeName(name: string): string[] {
  const parts: string[] = [];

  // Split on underscores
  const underscoreParts = name.split('_');

  for (const part of underscoreParts) {
    // Split on camelCase
    const camelParts = part.split(/(?=[A-Z])/);
    for (const camelPart of camelParts) {
      if (camelPart) {
        parts.push(camelPart.toLowerCase());
      }
    }
  }

  return parts;
}

// =============================================================================
// Main Semantic Similarity Class
// =============================================================================

/**
 * Semantic Similarity Extractor
 *
 * Provides methods for comparing code snippets and finding related code
 * based on semantic similarity.
 */
export class SemanticSimilarityExtractor {
  private config: SemanticSimilarityConfig;

  constructor(config: Partial<SemanticSimilarityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Snippet Preparation
  // ===========================================================================

  /**
   * Prepare a code snippet for comparison
   */
  prepareSnippet(code: string, language: Language, options: {
    filePath?: string;
    location?: SourceLocation;
  } = {}): CodeSnippet {
    let tokens = tokenize(code, language);

    // Filter based on config
    if (this.config.ignoreComments) {
      tokens = tokens.filter(t => t.type !== 'comment');
    }
    if (this.config.ignoreWhitespace) {
      tokens = tokens.filter(t => t.type !== 'whitespace');
    }

    const structure = extractStructure(code, language);

    const snippet: CodeSnippet = {
      code,
      language,
      tokens,
      structure,
    };

    if (options.filePath) {
      snippet.filePath = options.filePath;
    }
    if (options.location) {
      snippet.location = options.location;
    }

    return snippet;
  }

  // ===========================================================================
  // Similarity Comparison
  // ===========================================================================

  /**
   * Compare two code snippets
   */
  compare(snippetA: CodeSnippet, snippetB: CodeSnippet): SimilarityResult {
    // Ensure snippets are prepared
    if (!snippetA.tokens) {
      snippetA = this.prepareSnippet(snippetA.code, snippetA.language);
    }
    if (!snippetB.tokens) {
      snippetB = this.prepareSnippet(snippetB.code, snippetB.language);
    }

    const tokensA = snippetA.tokens ?? [];
    const tokensB = snippetB.tokens ?? [];
    const structureA = snippetA.structure ?? { type: 'root', children: [], depth: 0, hash: '' };
    const structureB = snippetB.structure ?? { type: 'root', children: [], depth: 0, hash: '' };

    // Calculate token similarity using n-grams
    const ngramsA = createNgrams(tokensA, this.config.ngramSize);
    const ngramsB = createNgrams(tokensB, this.config.ngramSize);
    const tokenSimilarity = jaccardSimilarity(ngramsA, ngramsB);

    // Calculate structural similarity
    const structuralSimilarity = calculateStructureSimilarity(structureA, structureB);

    // Calculate semantic similarity using token vectors
    const vectorA = createTokenVector(tokensA);
    const vectorB = createTokenVector(tokensB);
    const semanticSimilarity = cosineSimilarity(vectorA, vectorB);

    // Calculate name similarity
    const namesA = extractNames(tokensA);
    const namesB = extractNames(tokensB);
    const nameSimilarity = calculateNameSimilarity(namesA, namesB);

    // Calculate overall weighted similarity
    const overall =
      tokenSimilarity * this.config.tokenWeight +
      structuralSimilarity * this.config.structuralWeight +
      semanticSimilarity * this.config.semanticWeight +
      nameSimilarity * this.config.nameWeight;

    // Find common patterns
    const commonPatterns = this.findCommonPatterns(tokensA, tokensB);

    // Identify differences
    const differences = this.identifyDifferences(snippetA, snippetB);

    // Calculate confidence
    const confidence = this.calculateConfidence(tokensA, tokensB, overall);

    return {
      snippetA,
      snippetB,
      similarity: {
        tokenSimilarity,
        structuralSimilarity,
        semanticSimilarity,
        nameSimilarity,
        overall,
      },
      commonPatterns,
      differences,
      confidence,
    };
  }

  /**
   * Find common patterns between two token sequences
   */
  private findCommonPatterns(tokensA: CodeToken[], tokensB: CodeToken[]): string[] {
    const patterns: string[] = [];
    const ngramSize = this.config.ngramSize;

    // Find common n-grams
    const ngramsA = createNgrams(tokensA, ngramSize);
    const ngramsB = createNgrams(tokensB, ngramSize);

    for (const ngram of ngramsA) {
      if (ngramsB.has(ngram)) {
        patterns.push(ngram);
      }
    }

    // Deduplicate and limit
    return [...new Set(patterns)].slice(0, 20);
  }

  /**
   * Identify differences between snippets
   */
  private identifyDifferences(snippetA: CodeSnippet, snippetB: CodeSnippet): CodeDifference[] {
    const differences: CodeDifference[] = [];
    const tokensA = snippetA.tokens ?? [];
    const tokensB = snippetB.tokens ?? [];

    // Simple diff based on token sequences
    const setA = new Set(tokensA.map(t => t.normalized));
    const setB = new Set(tokensB.map(t => t.normalized));

    // Find unique to A (deletions from A's perspective)
    for (const token of tokensA) {
      if (!setB.has(token.normalized)) {
        differences.push({
          type: 'deletion',
          description: `Token "${token.value}" only in first snippet`,
          locationA: { start: token.start, end: token.end },
          significance: token.type === 'keyword' ? 0.8 : 0.5,
        });
      }
    }

    // Find unique to B (additions from A's perspective)
    for (const token of tokensB) {
      if (!setA.has(token.normalized)) {
        differences.push({
          type: 'addition',
          description: `Token "${token.value}" only in second snippet`,
          locationB: { start: token.start, end: token.end },
          significance: token.type === 'keyword' ? 0.8 : 0.5,
        });
      }
    }

    return differences.slice(0, 50); // Limit differences
  }

  /**
   * Calculate confidence in the comparison
   */
  private calculateConfidence(tokensA: CodeToken[], tokensB: CodeToken[], similarity: number): number {
    // Base confidence on similarity and token counts
    const minTokens = Math.min(tokensA.length, tokensB.length);
    const maxTokens = Math.max(tokensA.length, tokensB.length);

    // More tokens = more confidence
    const tokenConfidence = Math.min(1, minTokens / 50);

    // Similar sizes = more confidence
    const sizeRatio = minTokens / (maxTokens || 1);
    const sizeConfidence = sizeRatio;

    // High similarity = more confidence
    const similarityConfidence = similarity;

    return (tokenConfidence + sizeConfidence + similarityConfidence) / 3;
  }

  // ===========================================================================
  // Related Code Search
  // ===========================================================================

  /**
   * Find related code snippets from a collection
   */
  findRelated(
    target: CodeSnippet,
    candidates: CodeSnippet[],
    options: {
      minSimilarity?: number;
      maxResults?: number;
    } = {}
  ): RelatedCodeMatch[] {
    const minSimilarity = options.minSimilarity ?? this.config.minSimilarityThreshold;
    const maxResults = options.maxResults ?? this.config.maxMatches;

    // Prepare target if needed
    const preparedTarget = target.tokens
      ? target
      : this.prepareSnippet(target.code, target.language);

    const matches: RelatedCodeMatch[] = [];

    for (const candidate of candidates) {
      const preparedCandidate = candidate.tokens
        ? candidate
        : this.prepareSnippet(candidate.code, candidate.language);

      const result = this.compare(preparedTarget, preparedCandidate);

      if (result.similarity.overall >= minSimilarity) {
        matches.push({
          snippet: preparedCandidate,
          similarity: result.similarity.overall,
          reason: this.generateReason(result),
          patterns: result.commonPatterns.slice(0, 5),
          confidence: result.confidence,
        });
      }
    }

    // Sort by similarity (descending) and limit results
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, maxResults);
  }

  /**
   * Generate a reason for why code is related
   */
  private generateReason(result: SimilarityResult): string {
    const reasons: string[] = [];

    if (result.similarity.structuralSimilarity > 0.8) {
      reasons.push('similar code structure');
    }
    if (result.similarity.tokenSimilarity > 0.7) {
      reasons.push('shared code patterns');
    }
    if (result.similarity.nameSimilarity > 0.6) {
      reasons.push('similar naming conventions');
    }
    if (result.similarity.semanticSimilarity > 0.7) {
      reasons.push('semantically related');
    }

    if (reasons.length === 0) {
      return 'general similarity in code patterns';
    }

    return reasons.join(', ');
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  /**
   * Calculate pairwise similarities for a collection of snippets
   */
  calculatePairwiseSimilarities(snippets: CodeSnippet[]): Map<string, SimilarityResult> {
    const results = new Map<string, SimilarityResult>();

    // Prepare all snippets
    const prepared = snippets.map(s =>
      s.tokens ? s : this.prepareSnippet(s.code, s.language)
    );

    // Calculate pairwise similarities
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const a = prepared[i];
        const b = prepared[j];
        if (a && b) {
          const key = `${i}:${j}`;
          results.set(key, this.compare(a, b));
        }
      }
    }

    return results;
  }

  /**
   * Cluster snippets by similarity
   */
  clusterBySimilarity(
    snippets: CodeSnippet[],
    threshold: number = 0.7
  ): CodeSnippet[][] {
    const clusters: CodeSnippet[][] = [];
    const assigned = new Set<number>();

    // Prepare all snippets
    const prepared = snippets.map(s =>
      s.tokens ? s : this.prepareSnippet(s.code, s.language)
    );

    for (let i = 0; i < prepared.length; i++) {
      if (assigned.has(i)) continue;

      const cluster: CodeSnippet[] = [prepared[i]!];
      assigned.add(i);

      for (let j = i + 1; j < prepared.length; j++) {
        if (assigned.has(j)) continue;

        const a = prepared[i];
        const b = prepared[j];
        if (a && b) {
          const result = this.compare(a, b);
          if (result.similarity.overall >= threshold) {
            cluster.push(b);
            assigned.add(j);
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  // ===========================================================================
  // Analysis Utilities
  // ===========================================================================

  /**
   * Extract the most significant tokens from a snippet
   */
  extractSignificantTokens(snippet: CodeSnippet, limit: number = 20): CodeToken[] {
    const tokens = snippet.tokens ?? [];

    // Score tokens by significance
    const scored = tokens.map(token => ({
      token,
      score: this.getTokenSignificance(token),
    }));

    // Sort by score and take top
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.token);
  }

  /**
   * Get significance score for a token
   */
  private getTokenSignificance(token: CodeToken): number {
    switch (token.type) {
      case 'keyword':
        return 1.0;
      case 'identifier':
        // Longer identifiers are usually more meaningful
        return 0.7 + Math.min(0.3, token.value.length / 20);
      case 'operator':
        return 0.5;
      case 'punctuation':
        return 0.2;
      case 'literal':
      case 'string':
      case 'number':
        return 0.4;
      default:
        return 0.1;
    }
  }

  /**
   * Get fingerprint for a snippet (for quick comparison)
   */
  getFingerprint(snippet: CodeSnippet): string {
    const tokens = snippet.tokens ?? tokenize(snippet.code, snippet.language);
    const significant = tokens
      .filter(t => t.type === 'keyword' || t.type === 'identifier')
      .slice(0, 30)
      .map(t => t.normalized);

    return simpleHash(significant.join('|'));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SemanticSimilarityExtractor with optional configuration
 */
export function createSemanticSimilarityExtractor(
  config: Partial<SemanticSimilarityConfig> = {}
): SemanticSimilarityExtractor {
  return new SemanticSimilarityExtractor(config);
}

/**
 * Quick function to compare two code snippets
 */
export function compareCode(
  codeA: string,
  codeB: string,
  language: Language,
  config: Partial<SemanticSimilarityConfig> = {}
): SimilarityResult {
  const extractor = createSemanticSimilarityExtractor(config);
  const snippetA = extractor.prepareSnippet(codeA, language);
  const snippetB = extractor.prepareSnippet(codeB, language);
  return extractor.compare(snippetA, snippetB);
}

/**
 * Quick function to find related code
 */
export function findRelatedCode(
  targetCode: string,
  candidateCodes: string[],
  language: Language,
  config: Partial<SemanticSimilarityConfig> = {}
): RelatedCodeMatch[] {
  const extractor = createSemanticSimilarityExtractor(config);
  const target = extractor.prepareSnippet(targetCode, language);
  const candidates = candidateCodes.map(code =>
    extractor.prepareSnippet(code, language)
  );
  return extractor.findRelated(target, candidates);
}
