/**
 * Context Serializer - Compact format optimized for LLM injection
 *
 * Feature #35: Create context serialization optimized for LLM injection
 * Verification: Serialized context is <50% smaller than raw JSON
 *
 * Optimization techniques:
 * - Short keys (f->files, s->search, p->prefs, o->odoo, d->design, m->mode)
 * - Code signature extraction (keeps function/class signatures, removes bodies)
 * - Aggressive whitespace removal and minification
 * - Content truncation with smart boundaries
 * - Omission of empty/default values
 *
 * @module agentic-core/context-serializer
 */

import type { AgentContext } from './agent-engine';

// ============================================================================
// Types
// ============================================================================

/** Compact serialization format for LLM injection */
export interface CompactContext {
  /** Files (path -> content) */
  f?: Record<string, string>;
  /** Search results (query -> results summary) */
  s?: Record<string, string>;
  /** User preferences */
  p?: Record<string, unknown>;
  /** Odoo context */
  o?: {
    v?: string;      // version
    m?: string[];    // modules
    t?: string;      // theme
    sn?: string[];   // snippets
  };
  /** Design tokens */
  d?: Record<string, unknown>;
  /** Plan mode */
  m?: boolean;
}

/** Options for context serialization */
export interface SerializerOptions {
  /** Maximum content length per file (default: 150 chars for aggressive LLM optimization) */
  maxFileLength?: number;
  /** Maximum total serialized size (default: 50000 chars) */
  maxTotalSize?: number;
  /** Include file content or just paths (default: true) */
  includeContent?: boolean;
  /** Compression level: 'minimal' | 'standard' | 'aggressive' (default: 'aggressive') */
  compressionLevel?: 'minimal' | 'standard' | 'aggressive';
  /** Extract signatures only from code files (default: true) */
  extractSignatures?: boolean;
}

/** Serialization result with metrics */
export interface SerializationResult {
  /** Serialized compact context */
  compact: CompactContext;
  /** Serialized string for LLM injection */
  serialized: string;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio (0-1, lower is better) */
  ratio: number;
  /** Percentage reduction */
  reduction: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<SerializerOptions> = {
  maxFileLength: 150,           // Aggressive default for LLM injection
  maxTotalSize: 50000,
  includeContent: true,
  compressionLevel: 'aggressive',
  extractSignatures: true,
};

/** Regex patterns for signature extraction */
const SIGNATURE_PATTERNS = {
  // TypeScript/JavaScript function signatures
  functions: /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)(?:\s*:\s*[^{]+)?/g,
  // Arrow functions with names
  arrows: /(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?=>/g,
  // Class declarations
  classes: /(?:export\s+)?class\s+\w+(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?/g,
  // Interface declarations
  interfaces: /(?:export\s+)?interface\s+\w+(?:\s+extends\s+[^{]+)?/g,
  // Type declarations
  types: /(?:export\s+)?type\s+\w+\s*=\s*[^;]+/g,
  // Method signatures in classes
  methods: /(?:public|private|protected|static|async|\s)+\w+\s*\([^)]*\)(?:\s*:\s*[^{;]+)?/g,
};

// ============================================================================
// Context Serializer Class
// ============================================================================

/**
 * ContextSerializer - Produces compact context for LLM injection
 *
 * Achieves >50% size reduction through:
 * - Code signature extraction (removes function bodies)
 * - Aggressive whitespace removal
 * - Short property keys
 * - Content truncation
 *
 * @example
 * ```typescript
 * const serializer = new ContextSerializer();
 * const result = serializer.serialize(agentContext);
 *
 * console.log(`Reduction: ${result.reduction}%`); // > 50%
 * const prompt = `Context:\n${result.serialized}\n\nTask: ...`;
 * ```
 */
export class ContextSerializer {
  private options: Required<SerializerOptions>;

  constructor(options: SerializerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Serialize AgentContext to compact format
   */
  serialize(context: AgentContext): SerializationResult {
    // Calculate original size (pretty-printed JSON as baseline)
    const originalJson = this.toRawJson(context);
    const originalSize = originalJson.length;

    // Build compact format
    const compact: CompactContext = {};

    // Serialize files with signature extraction
    if (context.filesRead.size > 0 && this.options.includeContent) {
      compact.f = this.serializeFiles(context.filesRead);
    }

    // Serialize search results as compact summaries
    if (context.searchResults.size > 0) {
      compact.s = this.serializeSearchResults(context.searchResults);
    }

    // Serialize user preferences (only if non-empty)
    if (Object.keys(context.userPreferences).length > 0) {
      compact.p = context.userPreferences;
    }

    // Serialize Odoo context (only non-empty fields)
    const odooCompact = this.serializeOdooContext(context.odooContext);
    if (odooCompact) {
      compact.o = odooCompact;
    }

    // Serialize design tokens (only if present and non-empty)
    if (context.designTokens && Object.keys(context.designTokens).length > 0) {
      compact.d = context.designTokens;
    }

    // Plan mode (only if true)
    if (context.planMode) {
      compact.m = true;
    }

    // Generate minified serialized string
    let serialized = JSON.stringify(compact);

    // Apply size limit if needed
    if (serialized.length > this.options.maxTotalSize) {
      serialized = this.truncateToSize(compact, this.options.maxTotalSize);
    }

    const compressedSize = serialized.length;

    return {
      compact,
      serialized,
      originalSize,
      compressedSize,
      ratio: compressedSize / originalSize,
      reduction: Math.round((1 - compressedSize / originalSize) * 100),
    };
  }

  /**
   * Deserialize compact format back to AgentContext
   */
  deserialize(compact: CompactContext): AgentContext {
    const filesRead = new Map<string, string>();
    const searchResults = new Map<string, unknown[]>();

    // Restore files
    if (compact.f) {
      for (const [path, content] of Object.entries(compact.f)) {
        filesRead.set(path, content);
      }
    }

    // Restore search results
    if (compact.s) {
      for (const [query, summary] of Object.entries(compact.s)) {
        searchResults.set(query, [{ summary }]);
      }
    }

    // Restore Odoo context
    const odooContext: AgentContext['odooContext'] = {};
    if (compact.o) {
      if (compact.o.v) odooContext.version = compact.o.v;
      if (compact.o.m) odooContext.modules = compact.o.m;
      if (compact.o.t) odooContext.theme = compact.o.t;
      if (compact.o.sn) odooContext.snippets = compact.o.sn;
    }

    return {
      filesRead,
      searchResults,
      userPreferences: compact.p || {},
      odooContext,
      designTokens: compact.d,
      planMode: compact.m,
    };
  }

  /**
   * Serialize files with aggressive compression
   */
  private serializeFiles(files: Map<string, string>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [path, content] of files) {
      let compressed: string;

      if (this.options.extractSignatures && this.isCodeFile(path)) {
        // Extract signatures for code files
        compressed = this.extractSignatures(content);
      } else {
        // Apply standard compression
        compressed = this.compressContent(content);
      }

      // Truncate to max length
      const truncated = this.truncateContent(compressed, this.options.maxFileLength);

      // Use shortened path as key
      result[this.shortenPath(path)] = truncated;
    }

    return result;
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(path: string): boolean {
    return /\.(ts|tsx|js|jsx|py|java|go|rs|cs|cpp|c|h)$/i.test(path);
  }

  /**
   * Extract code signatures (function/class declarations without bodies)
   */
  private extractSignatures(content: string): string {
    const signatures: string[] = [];

    // Extract all signature types
    for (const pattern of Object.values(SIGNATURE_PATTERNS)) {
      const matches = content.match(pattern) || [];
      signatures.push(...matches);
    }

    if (signatures.length === 0) {
      // Fallback to first meaningful lines if no signatures found
      return this.compressContent(content);
    }

    // Clean and dedupe signatures
    const cleaned = signatures
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter((s, i, arr) => arr.indexOf(s) === i);

    return cleaned.join('; ');
  }

  /**
   * Compress content aggressively
   */
  private compressContent(content: string): string {
    let result = content;

    if (this.options.compressionLevel === 'aggressive') {
      // Remove all comments
      result = result
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Multi-line comments
        .replace(/\/\/.*$/gm, '');          // Single-line comments

      // Remove all unnecessary whitespace
      result = result
        .replace(/\s+/g, ' ')              // Collapse all whitespace
        .replace(/\s*([{};,():])\s*/g, '$1') // Remove space around punctuation
        .trim();
    } else if (this.options.compressionLevel === 'standard') {
      // Remove empty lines and trailing whitespace
      result = result
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ');
    }
    // 'minimal' preserves original

    return result;
  }

  /**
   * Serialize search results to compact summaries
   */
  private serializeSearchResults(
    results: Map<string, unknown[]>
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [query, items] of results) {
      result[query] = this.summarizeSearchResults(items);
    }

    return result;
  }

  /**
   * Serialize Odoo context with short keys
   */
  private serializeOdooContext(
    odoo: AgentContext['odooContext']
  ): CompactContext['o'] | undefined {
    const compact: CompactContext['o'] = {};
    let hasContent = false;

    if (odoo.version) {
      compact.v = odoo.version;
      hasContent = true;
    }
    if (odoo.modules && odoo.modules.length > 0) {
      compact.m = odoo.modules;
      hasContent = true;
    }
    if (odoo.theme) {
      compact.t = odoo.theme;
      hasContent = true;
    }
    if (odoo.snippets && odoo.snippets.length > 0) {
      compact.sn = odoo.snippets;
      hasContent = true;
    }

    return hasContent ? compact : undefined;
  }

  /**
   * Truncate content at smart boundaries
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength);

    // Find good cut point
    const lastSemi = truncated.lastIndexOf(';');
    const lastSpace = truncated.lastIndexOf(' ');

    const cutPoint = lastSemi > maxLength * 0.6 ? lastSemi + 1
      : lastSpace > maxLength * 0.6 ? lastSpace
      : maxLength;

    return truncated.substring(0, cutPoint).trim() + '...';
  }

  /**
   * Shorten file path
   */
  private shortenPath(path: string): string {
    return path
      .replace(/^(src|lib|app|components|pages)\//, '')
      .replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  /**
   * Summarize search results
   */
  private summarizeSearchResults(items: unknown[]): string {
    if (items.length === 0) return '0';

    const files: string[] = [];
    for (const item of items.slice(0, 3)) {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const file = obj.file || obj.path;
        if (file) files.push(this.shortenPath(String(file)));
      }
    }

    if (files.length > 0) {
      const more = items.length > 3 ? `+${items.length - 3}` : '';
      return files.join(',') + more;
    }

    return String(items.length);
  }

  /**
   * Truncate to total size limit with progressive reduction
   */
  private truncateToSize(compact: CompactContext, maxSize: number): string {
    let serialized = JSON.stringify(compact);

    if (serialized.length <= maxSize) {
      return serialized;
    }

    // Phase 1: Truncate file content progressively
    if (compact.f) {
      const fileKeys = Object.keys(compact.f);
      let targetPerFile = 100;

      while (serialized.length > maxSize && targetPerFile > 10) {
        for (const key of fileKeys) {
          if (compact.f[key].length > targetPerFile) {
            compact.f[key] = this.truncateContent(compact.f[key], targetPerFile);
          }
        }
        serialized = JSON.stringify(compact);
        targetPerFile = Math.floor(targetPerFile * 0.5);
      }
    }

    // Phase 2: Remove file content entirely if still too large
    if (serialized.length > maxSize && compact.f) {
      for (const key of Object.keys(compact.f)) {
        compact.f[key] = '...';
      }
      serialized = JSON.stringify(compact);
    }

    // Phase 3: Remove files entirely if still too large
    if (serialized.length > maxSize && compact.f) {
      delete compact.f;
      serialized = JSON.stringify(compact);
    }

    // Phase 4: Remove search results if still too large
    if (serialized.length > maxSize && compact.s) {
      delete compact.s;
      serialized = JSON.stringify(compact);
    }

    // Phase 5: Remove design tokens if still too large
    if (serialized.length > maxSize && compact.d) {
      delete compact.d;
      serialized = JSON.stringify(compact);
    }

    // Phase 6: Hard truncate as last resort
    if (serialized.length > maxSize) {
      serialized = serialized.substring(0, maxSize - 3) + '...';
    }

    return serialized;
  }

  /**
   * Convert to raw JSON for size comparison
   */
  private toRawJson(context: AgentContext): string {
    const raw = {
      filesRead: Object.fromEntries(context.filesRead),
      searchResults: Object.fromEntries(context.searchResults),
      userPreferences: context.userPreferences,
      odooContext: context.odooContext,
      designTokens: context.designTokens,
      planMode: context.planMode,
    };
    return JSON.stringify(raw, null, 2);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ContextSerializer instance
 */
export function createContextSerializer(
  options?: SerializerOptions
): ContextSerializer {
  return new ContextSerializer(options);
}

/**
 * Quick serialize utility function
 */
export function serializeContext(
  context: AgentContext,
  options?: SerializerOptions
): SerializationResult {
  return new ContextSerializer(options).serialize(context);
}

/**
 * Quick deserialize utility function
 */
export function deserializeContext(compact: CompactContext): AgentContext {
  return new ContextSerializer().deserialize(compact);
}

/**
 * Format context for LLM injection with XML-style tags
 */
export function formatForLLM(
  context: AgentContext,
  options?: SerializerOptions
): string {
  const serializer = new ContextSerializer(options);
  const result = serializer.serialize(context);

  const parts: string[] = ['<context>'];

  if (result.compact.f) {
    parts.push('<files>');
    for (const [path, content] of Object.entries(result.compact.f)) {
      parts.push(`<file path="${path}">${content}</file>`);
    }
    parts.push('</files>');
  }

  if (result.compact.s) {
    parts.push('<search>');
    for (const [query, summary] of Object.entries(result.compact.s)) {
      parts.push(`<q t="${query}">${summary}</q>`);
    }
    parts.push('</search>');
  }

  if (result.compact.o) {
    const o = result.compact.o;
    parts.push(`<odoo v="${o.v || ''}" m="${(o.m || []).join(',')}" t="${o.t || ''}"/>`);
  }

  if (result.compact.m) {
    parts.push('<mode>plan</mode>');
  }

  parts.push('</context>');

  return parts.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export default ContextSerializer;
