/**
 * SourceMapper — Bidirectional DOM element to template source line mapping.
 *
 * Provides efficient lookup:
 *   - elementId → { path, startLine, endLine }
 *   - { path, line } → elementIds[] (reverse lookup)
 *
 * Supports multi-line elements by tracking both start and end lines,
 * enabling accurate highlighting and navigation in both directions.
 */

// =============================================================================
// Types
// =============================================================================

/** Source location with line range */
export interface SourceLocation {
  /** Template file path */
  path: string;
  /** 1-based start line number */
  startLine: number;
  /** 1-based end line number (same as startLine for single-line elements) */
  endLine: number;
  /** Optional column offset */
  column?: number;
}

/** A complete mapping entry linking DOM element to source */
export interface ElementMapping {
  /** Unique element identifier (e.g., "el-0", "el-1") */
  elementId: string;
  /** Source file location */
  location: SourceLocation;
  /** Element tag name */
  tagName: string;
  /** Optional snippet ID if inside a snippet */
  snippetId?: string;
  /** Optional element classes for debugging */
  classes?: string[];
}

/** Options for building source maps */
export interface SourceMapperOptions {
  /** Prefix for generated element IDs (default: "el") */
  idPrefix?: string;
  /** Whether to track element classes (default: false) */
  trackClasses?: boolean;
  /** Whether to track self-closing tags (default: true) */
  trackSelfClosing?: boolean;
}

/** Query options for reverse lookup */
export interface ReverseLookupOptions {
  /** If true, return elements that span this line (not just start on it) */
  includeSpanning?: boolean;
}

// =============================================================================
// SourceMapper Class
// =============================================================================

/**
 * Builds and maintains bidirectional mappings between DOM elements
 * and template source locations.
 *
 * @example
 * ```typescript
 * const mapper = new SourceMapper();
 * const { annotated, elementCount } = mapper.annotate(templateSource, 'hero.xml');
 *
 * // Forward lookup: element → source
 * const loc = mapper.getLocation('el-5');
 * console.log(loc); // { path: 'hero.xml', startLine: 10, endLine: 15 }
 *
 * // Reverse lookup: source → elements
 * const elements = mapper.getElementsAtLine('hero.xml', 12);
 * console.log(elements); // ['el-5']
 * ```
 */
export class SourceMapper {
  private mappings = new Map<string, ElementMapping>();
  private byFileLine = new Map<string, Set<string>>();
  private byFileLineSpan = new Map<string, Set<string>>();
  private options: Required<SourceMapperOptions>;
  private nextId = 0;

  constructor(options: SourceMapperOptions = {}) {
    this.options = {
      idPrefix: options.idPrefix ?? "el",
      trackClasses: options.trackClasses ?? false,
      trackSelfClosing: options.trackSelfClosing ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // Annotation
  // ---------------------------------------------------------------------------

  /**
   * Annotates template source with data attributes for source mapping.
   * Adds `data-element-id`, `data-source-start`, `data-source-end` attributes.
   *
   * @param source - Raw template source
   * @param path - File path for source location
   * @returns Annotated source and element count
   */
  annotate(source: string, path: string): { annotated: string; elementCount: number } {
    const lines = source.split("\n");
    const annotatedLines: string[] = [];
    const tagStack: Array<{ id: string; tagName: string; startLine: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      let line = lines[i];

      // Process opening tags
      line = this.processOpeningTags(line, lineNum, path, tagStack);

      // Process closing tags
      line = this.processClosingTags(line, lineNum, tagStack);

      annotatedLines.push(line);
    }

    // Handle unclosed tags (treat as ending at last line)
    const lastLine = lines.length;
    for (const unclosed of tagStack) {
      this.finalizeMapping(unclosed.id, lastLine);
    }

    return {
      annotated: annotatedLines.join("\n"),
      elementCount: this.mappings.size,
    };
  }

  private processOpeningTags(
    line: string,
    lineNum: number,
    path: string,
    tagStack: Array<{ id: string; tagName: string; startLine: number }>,
  ): string {
    // Match opening tags (including self-closing)
    const tagRegex = /<([a-zA-Z][\w.-]*)(\s[^>]*)?(\/?)>/g;
    let match: RegExpExecArray | null;
    let result = line;
    let offset = 0;

    while ((match = tagRegex.exec(line)) !== null) {
      const [fullMatch, tagName, attrs = "", selfClose] = match;
      const isSelfClosing = selfClose === "/" || this.isSelfClosingTag(tagName);

      if (!this.options.trackSelfClosing && isSelfClosing) {
        continue;
      }

      const elementId = this.generateId();
      const snippetId = this.extractSnippetId(attrs);
      const classes = this.options.trackClasses ? this.extractClasses(attrs) : undefined;

      // Create initial mapping
      const mapping: ElementMapping = {
        elementId,
        location: {
          path,
          startLine: lineNum,
          endLine: isSelfClosing ? lineNum : lineNum, // Will be updated for non-self-closing
        },
        tagName: tagName.toLowerCase(),
        snippetId,
        classes,
      };

      this.addMapping(mapping);

      // For non-self-closing tags, push to stack
      if (!isSelfClosing) {
        tagStack.push({ id: elementId, tagName: tagName.toLowerCase(), startLine: lineNum });
      }

      // Inject data attributes
      const injection = ` data-element-id="${elementId}" data-source-start="${lineNum}"${isSelfClosing ? ` data-source-end="${lineNum}"` : ""}`;
      const insertPos = match.index + 1 + tagName.length + offset;
      result = result.slice(0, insertPos) + injection + result.slice(insertPos);
      offset += injection.length;
    }

    return result;
  }

  private processClosingTags(
    line: string,
    lineNum: number,
    tagStack: Array<{ id: string; tagName: string; startLine: number }>,
  ): string {
    // Match closing tags
    const closeRegex = /<\/([a-zA-Z][\w.-]*)>/g;
    let match: RegExpExecArray | null;

    while ((match = closeRegex.exec(line)) !== null) {
      const [, tagName] = match;
      const lowerTag = tagName.toLowerCase();

      // Find matching opening tag (from top of stack)
      for (let i = tagStack.length - 1; i >= 0; i--) {
        if (tagStack[i].tagName === lowerTag) {
          const opened = tagStack.splice(i, 1)[0];
          this.finalizeMapping(opened.id, lineNum);
          break;
        }
      }
    }

    return line;
  }

  private finalizeMapping(elementId: string, endLine: number): void {
    const mapping = this.mappings.get(elementId);
    if (mapping) {
      mapping.location.endLine = endLine;
      // Index all lines this element spans
      this.indexSpanningLines(mapping);
    }
  }

  // ---------------------------------------------------------------------------
  // Mapping Management
  // ---------------------------------------------------------------------------

  private addMapping(mapping: ElementMapping): void {
    this.mappings.set(mapping.elementId, mapping);

    // Index by start line
    const startKey = `${mapping.location.path}:${mapping.location.startLine}`;
    if (!this.byFileLine.has(startKey)) {
      this.byFileLine.set(startKey, new Set());
    }
    this.byFileLine.get(startKey)!.add(mapping.elementId);
  }

  private indexSpanningLines(mapping: ElementMapping): void {
    const { path, startLine, endLine } = mapping.location;
    for (let line = startLine; line <= endLine; line++) {
      const key = `${path}:${line}`;
      if (!this.byFileLineSpan.has(key)) {
        this.byFileLineSpan.set(key, new Set());
      }
      this.byFileLineSpan.get(key)!.add(mapping.elementId);
    }
  }

  // ---------------------------------------------------------------------------
  // Forward Lookup: elementId → location
  // ---------------------------------------------------------------------------

  /**
   * Gets the source location for an element ID.
   *
   * @param elementId - The element identifier
   * @returns Source location or undefined if not found
   */
  getLocation(elementId: string): SourceLocation | undefined {
    return this.mappings.get(elementId)?.location;
  }

  /**
   * Gets the full mapping entry for an element ID.
   *
   * @param elementId - The element identifier
   * @returns Full mapping entry or undefined if not found
   */
  getMapping(elementId: string): ElementMapping | undefined {
    return this.mappings.get(elementId);
  }

  /**
   * Checks if an element ID exists in the map.
   */
  has(elementId: string): boolean {
    return this.mappings.has(elementId);
  }

  // ---------------------------------------------------------------------------
  // Reverse Lookup: location → elementIds
  // ---------------------------------------------------------------------------

  /**
   * Gets element IDs at a specific line in a file.
   *
   * @param path - File path
   * @param line - Line number (1-based)
   * @param options - Lookup options
   * @returns Array of element IDs
   */
  getElementsAtLine(
    path: string,
    line: number,
    options: ReverseLookupOptions = {},
  ): string[] {
    const key = `${path}:${line}`;

    if (options.includeSpanning) {
      return Array.from(this.byFileLineSpan.get(key) ?? []);
    }

    return Array.from(this.byFileLine.get(key) ?? []);
  }

  /**
   * Gets element IDs within a line range in a file.
   *
   * @param path - File path
   * @param startLine - Start line (1-based, inclusive)
   * @param endLine - End line (1-based, inclusive)
   * @returns Array of element IDs
   */
  getElementsInRange(path: string, startLine: number, endLine: number): string[] {
    const result = new Set<string>();

    for (let line = startLine; line <= endLine; line++) {
      const key = `${path}:${line}`;
      const ids = this.byFileLineSpan.get(key);
      if (ids) {
        for (const id of ids) {
          result.add(id);
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Gets elements by snippet ID.
   *
   * @param snippetId - The snippet ID (e.g., "s_hero")
   * @returns Array of element IDs
   */
  getElementsBySnippet(snippetId: string): string[] {
    const result: string[] = [];
    for (const mapping of this.mappings.values()) {
      if (mapping.snippetId === snippetId) {
        result.push(mapping.elementId);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  /**
   * Returns all mappings as an array.
   */
  getAllMappings(): ElementMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Returns the total number of mapped elements.
   */
  get size(): number {
    return this.mappings.size;
  }

  /**
   * Clears all mappings.
   */
  clear(): void {
    this.mappings.clear();
    this.byFileLine.clear();
    this.byFileLineSpan.clear();
    this.nextId = 0;
  }

  /**
   * Merges another SourceMapper's mappings into this one.
   * Useful when processing multiple template files.
   */
  merge(other: SourceMapper): void {
    for (const mapping of other.mappings.values()) {
      // Re-ID to avoid conflicts
      const newId = this.generateId();
      const newMapping = { ...mapping, elementId: newId };
      this.addMapping(newMapping);
      this.indexSpanningLines(newMapping);
    }
  }

  /**
   * Exports mappings to a JSON-serializable format.
   */
  toJSON(): Record<string, { path: string; startLine: number; endLine: number }> {
    const result: Record<string, { path: string; startLine: number; endLine: number }> = {};
    for (const [id, mapping] of this.mappings) {
      result[id] = {
        path: mapping.location.path,
        startLine: mapping.location.startLine,
        endLine: mapping.location.endLine,
      };
    }
    return result;
  }

  /**
   * Creates a SourceMapper from JSON data.
   */
  static fromJSON(
    data: Record<string, { path: string; startLine: number; endLine: number }>,
  ): SourceMapper {
    const mapper = new SourceMapper();
    for (const [id, loc] of Object.entries(data)) {
      const mapping: ElementMapping = {
        elementId: id,
        location: {
          path: loc.path,
          startLine: loc.startLine,
          endLine: loc.endLine,
        },
        tagName: "unknown",
      };
      mapper.mappings.set(id, mapping);
      mapper.indexSpanningLines(mapping);

      // Update ID counter
      const num = parseInt(id.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num >= mapper.nextId) {
        mapper.nextId = num + 1;
      }
    }
    return mapper;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateId(): string {
    return `${this.options.idPrefix}-${this.nextId++}`;
  }

  private isSelfClosingTag(tagName: string): boolean {
    const selfClosing = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr",
    ]);
    return selfClosing.has(tagName.toLowerCase());
  }

  private extractSnippetId(attrs: string): string | undefined {
    const snippetMatch = attrs.match(
      /(?:data-snippet=["']([^"']+)["']|class="[^"]*\b(s_[a-z][a-z0-9_]*)\b)/,
    );
    return snippetMatch?.[1] || snippetMatch?.[2];
  }

  private extractClasses(attrs: string): string[] | undefined {
    const classMatch = attrs.match(/class="([^"]*)"/);
    if (classMatch) {
      return classMatch[1].split(/\s+/).filter(Boolean);
    }
    return undefined;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SourceMapper and annotates a template in one step.
 *
 * @param source - Template source
 * @param path - File path
 * @param options - Mapper options
 * @returns Mapper instance and annotated source
 */
export function createSourceMap(
  source: string,
  path: string,
  options?: SourceMapperOptions,
): { mapper: SourceMapper; annotated: string } {
  const mapper = new SourceMapper(options);
  const { annotated } = mapper.annotate(source, path);
  return { mapper, annotated };
}

/**
 * Creates a SourceMapper for multiple files.
 *
 * @param files - Array of { source, path } objects
 * @param options - Mapper options
 * @returns Single mapper with all files indexed
 */
export function createMultiFileSourceMap(
  files: Array<{ source: string; path: string }>,
  options?: SourceMapperOptions,
): { mapper: SourceMapper; annotatedFiles: Array<{ path: string; annotated: string }> } {
  const mapper = new SourceMapper(options);
  const annotatedFiles: Array<{ path: string; annotated: string }> = [];

  for (const file of files) {
    const { annotated } = mapper.annotate(file.source, file.path);
    annotatedFiles.push({ path: file.path, annotated });
  }

  return { mapper, annotatedFiles };
}
