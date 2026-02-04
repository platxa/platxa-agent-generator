/**
 * SourceMapper — Bidirectional DOM ↔ QWeb Template Mapping
 *
 * Feature #13: Visual Edit Mode - Source mapping for visual editing
 *
 * Provides bidirectional mapping between DOM elements in the preview
 * and their corresponding QWeb template source locations (line/column).
 *
 * Key capabilities:
 * - DOM node → QWeb source location (for "inspect element" → "edit source")
 * - QWeb source location → DOM nodes (for "click source" → "highlight preview")
 * - Incremental updates as templates are edited
 * - Column-level precision for attribute editing
 */

// =============================================================================
// Types
// =============================================================================

/** Position in source code */
export interface SourcePosition {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

/** Range in source code */
export interface SourceRange {
  /** Start position (opening tag) */
  start: SourcePosition;
  /** End position (closing tag) */
  end: SourcePosition;
}

/** A mapped DOM element */
export interface MappedElement {
  /** Unique identifier for this mapping */
  id: string;
  /** Source file path */
  file: string;
  /** Tag name (e.g., "div", "section", "t") */
  tagName: string;
  /** Source range (start and end positions) */
  range: SourceRange;
  /** CSS selector to find this element in DOM */
  selector: string;
  /** Data attributes extracted from the element */
  attributes: Record<string, string>;
  /** Parent element ID (if any) */
  parentId?: string;
  /** Child element IDs */
  childIds: string[];
  /** Whether this is a QWeb directive (t-if, t-foreach, etc.) */
  isDirective: boolean;
  /** Snippet ID if inside a snippet */
  snippetId?: string;
}

/** Lookup result from DOM to source */
export interface DomToSourceResult {
  element: MappedElement;
  /** The exact attribute if clicked on an attribute */
  attribute?: {
    name: string;
    value: string;
    column: number;
  };
}

/** Lookup result from source to DOM */
export interface SourceToDomResult {
  elements: MappedElement[];
  /** Primary element (most specific match) */
  primary?: MappedElement;
}

/** Source mapper configuration */
export interface SourceMapperConfig {
  /** Whether to track column positions (more expensive) */
  trackColumns: boolean;
  /** Whether to include QWeb directives in mapping */
  includeDirectives: boolean;
  /** Custom attribute to use for source IDs */
  sourceIdAttribute: string;
}

/** Event types emitted by SourceMapper */
export type SourceMapperEventType =
  | "mapping_created"
  | "mapping_updated"
  | "mapping_cleared"
  | "element_added"
  | "element_removed";

/** Event data for SourceMapper events */
export interface SourceMapperEvent {
  type: SourceMapperEventType;
  file?: string;
  elementId?: string;
  timestamp: number;
}

/** Event listener type */
export type SourceMapperEventListener = (event: SourceMapperEvent) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_MAPPER_CONFIG: SourceMapperConfig = {
  trackColumns: true,
  includeDirectives: true,
  sourceIdAttribute: "data-source-id",
};

/** QWeb directive attributes */
const QWEB_DIRECTIVES = new Set([
  "t-if",
  "t-elif",
  "t-else",
  "t-foreach",
  "t-as",
  "t-esc",
  "t-raw",
  "t-out",
  "t-set",
  "t-value",
  "t-att",
  "t-attf-",
  "t-call",
  "t-name",
  "t-inherit",
  "t-extend",
]);

// =============================================================================
// Helpers
// =============================================================================

let _elementCounter = 0;

/** Reset element counter (for testing) */
export function resetMapperCounters(): void {
  _elementCounter = 0;
}

/** Generate unique element ID */
function generateElementId(): string {
  return `elem-${_elementCounter++}`;
}

/** Check if attribute is a QWeb directive */
function isQWebDirective(attrName: string): boolean {
  if (QWEB_DIRECTIVES.has(attrName)) return true;
  // Check for t-attf- prefix
  if (attrName.startsWith("t-attf-")) return true;
  if (attrName.startsWith("t-att-")) return true;
  return false;
}

/** Parse attributes from tag string */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match attribute patterns: name="value" or name='value' or name
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[name] = value;
  }
  return attrs;
}

/** Find column position of attribute in line */
function findAttributeColumn(line: string, attrName: string): number {
  const idx = line.indexOf(attrName + "=");
  if (idx !== -1) return idx + 1; // 1-based
  const idx2 = line.indexOf(attrName);
  if (idx2 !== -1) return idx2 + 1;
  return 1;
}

// =============================================================================
// SourceMapper Class
// =============================================================================

/**
 * SourceMapper manages bidirectional mapping between DOM and QWeb source.
 *
 * Usage:
 * ```ts
 * const mapper = new SourceMapper();
 *
 * // Build mapping from template source
 * const annotated = mapper.mapTemplate(templateSource, 'home.xml');
 *
 * // Look up source location for DOM element
 * const source = mapper.getSourceForDom('[data-source-id="elem-5"]');
 *
 * // Look up DOM elements for source location
 * const dom = mapper.getDomForSource('home.xml', 15);
 *
 * // Listen for mapping changes
 * mapper.on((event) => console.log('Mapping changed:', event));
 * ```
 */
export class SourceMapper {
  private config: SourceMapperConfig;
  private elements: Map<string, MappedElement> = new Map();
  private bySelector: Map<string, string> = new Map(); // selector → elementId
  private byFileLine: Map<string, Set<string>> = new Map(); // "file:line" → Set<elementId>
  private listeners: Set<SourceMapperEventListener> = new Set();
  private fileContents: Map<string, string> = new Map(); // file → content

  constructor(config: Partial<SourceMapperConfig> = {}) {
    this.config = { ...DEFAULT_MAPPER_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Template Mapping
  // ---------------------------------------------------------------------------

  /**
   * Map a QWeb template and annotate it with source IDs.
   * Returns the annotated template ready for rendering.
   */
  mapTemplate(source: string, file: string): string {
    // Clear existing mappings for this file
    this.clearFile(file);

    // Store file contents for column lookups
    this.fileContents.set(file, source);

    const lines = source.split("\n");
    const annotatedLines: string[] = [];

    // Stack for tracking parent-child relationships
    const tagStack: Array<{ id: string; tagName: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      let processedLine = line;

      // Find all opening tags in this line
      const openTagRegex = /<([a-zA-Z][\w.-]*)(\s[^>]*)?(\/?)>/g;
      let tagMatch;
      const replacements: Array<{ original: string; replacement: string }> = [];

      while ((tagMatch = openTagRegex.exec(line)) !== null) {
        const [fullMatch, tagName, attrString = "", selfClose] = tagMatch;
        const column = tagMatch.index + 1; // 1-based
        const isSelfClosing = selfClose === "/" || fullMatch.endsWith("/>");

        // Parse attributes
        const attributes = parseAttributes(attrString);

        // Check if this is a QWeb directive
        const isDirective = tagName === "t" ||
          Object.keys(attributes).some(a => isQWebDirective(a));

        // Skip if directive and config says no
        if (isDirective && !this.config.includeDirectives) {
          continue;
        }

        // Extract snippet ID
        let snippetId: string | undefined;
        if (attributes["data-snippet"]) {
          snippetId = attributes["data-snippet"];
        } else if (attributes["class"]) {
          const snippetMatch = attributes["class"].match(/\b(s_[a-z][a-z0-9_]*)\b/);
          if (snippetMatch) snippetId = snippetMatch[1];
        }

        // Create element mapping
        const elementId = generateElementId();
        const parentId = tagStack.length > 0 ? tagStack[tagStack.length - 1].id : undefined;

        const element: MappedElement = {
          id: elementId,
          file,
          tagName,
          range: {
            start: { line: lineNum, column },
            end: { line: lineNum, column: column + fullMatch.length }, // Will be updated for closing tag
          },
          selector: `[${this.config.sourceIdAttribute}="${elementId}"]`,
          attributes,
          parentId,
          childIds: [],
          isDirective,
          snippetId,
        };

        // Add as child to parent
        if (parentId) {
          const parent = this.elements.get(parentId);
          if (parent) {
            parent.childIds.push(elementId);
          }
        }

        // Store element
        this.elements.set(elementId, element);
        this.bySelector.set(element.selector, elementId);
        this.indexByLine(file, lineNum, elementId);

        // Track non-self-closing tags
        if (!isSelfClosing) {
          tagStack.push({ id: elementId, tagName });
        }

        // Create annotated tag
        const sourceIdAttr = ` ${this.config.sourceIdAttribute}="${elementId}"`;
        const dataAttrs = ` data-source-line="${lineNum}" data-source-file="${file}"`;
        const newTag = `<${tagName}${sourceIdAttr}${dataAttrs}${attrString}${selfClose}>`;

        replacements.push({ original: fullMatch, replacement: newTag });

        this.emit({ type: "element_added", file, elementId, timestamp: Date.now() });
      }

      // Apply replacements in reverse order to preserve indices
      for (let j = replacements.length - 1; j >= 0; j--) {
        const { original, replacement } = replacements[j];
        processedLine = processedLine.replace(original, replacement);
      }

      // Check for closing tags to update end positions
      const closeTagRegex = /<\/([a-zA-Z][\w.-]*)>/g;
      let closeMatch;
      while ((closeMatch = closeTagRegex.exec(line)) !== null) {
        const closingTagName = closeMatch[1];
        const closeColumn = closeMatch.index + 1;

        // Find matching open tag
        for (let j = tagStack.length - 1; j >= 0; j--) {
          if (tagStack[j].tagName === closingTagName) {
            const element = this.elements.get(tagStack[j].id);
            if (element) {
              element.range.end = {
                line: lineNum,
                column: closeColumn + closeMatch[0].length,
              };
            }
            tagStack.splice(j, 1);
            break;
          }
        }
      }

      annotatedLines.push(processedLine);
    }

    // Set end line for unclosed tags
    const totalLines = lines.length;
    for (const remaining of tagStack) {
      const element = this.elements.get(remaining.id);
      if (element) {
        element.range.end.line = totalLines;
      }
    }

    this.emit({ type: "mapping_created", file, timestamp: Date.now() });
    return annotatedLines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // DOM → Source Lookup
  // ---------------------------------------------------------------------------

  /**
   * Get source location for a DOM element.
   *
   * @param selector - CSS selector (e.g., '[data-source-id="elem-5"]')
   * @returns Source info or null if not found
   */
  getSourceForDom(selector: string): DomToSourceResult | null {
    const elementId = this.bySelector.get(selector);
    if (!elementId) return null;

    const element = this.elements.get(elementId);
    if (!element) return null;

    return { element };
  }

  /**
   * Get source location for a DOM element by its source ID.
   *
   * @param sourceId - The element ID (e.g., "elem-5")
   * @returns Source info or null if not found
   */
  getSourceForElementId(sourceId: string): DomToSourceResult | null {
    const element = this.elements.get(sourceId);
    if (!element) return null;
    return { element };
  }

  // ---------------------------------------------------------------------------
  // Source → DOM Lookup
  // ---------------------------------------------------------------------------

  /**
   * Get DOM elements for a source location.
   *
   * @param file - Source file path
   * @param line - 1-based line number
   * @returns Matching elements
   */
  getDomForSource(file: string, line: number): SourceToDomResult {
    const key = `${file}:${line}`;
    const elementIds = this.byFileLine.get(key);

    if (!elementIds || elementIds.size === 0) {
      return { elements: [] };
    }

    const elements: MappedElement[] = [];
    const idsArray: string[] = [];
    elementIds.forEach(id => idsArray.push(id));

    for (const id of idsArray) {
      const element = this.elements.get(id);
      if (element) {
        elements.push(element);
      }
    }

    // Primary is the most specific (deepest nested) element
    const primary = elements.length > 0
      ? elements.reduce((a, b) => (a.childIds.length === 0 ? a : b))
      : undefined;

    return { elements, primary };
  }

  /**
   * Get all elements whose range contains the given line.
   */
  getElementsContainingLine(file: string, line: number): MappedElement[] {
    const results: MappedElement[] = [];

    this.elements.forEach((element) => {
      if (element.file === file &&
          element.range.start.line <= line &&
          element.range.end.line >= line) {
        results.push(element);
      }
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Element Access
  // ---------------------------------------------------------------------------

  /** Get element by ID */
  getElement(id: string): MappedElement | undefined {
    return this.elements.get(id);
  }

  /** Get all elements for a file */
  getElementsForFile(file: string): MappedElement[] {
    const results: MappedElement[] = [];
    this.elements.forEach((element) => {
      if (element.file === file) {
        results.push(element);
      }
    });
    return results;
  }

  /** Get all mapped files */
  getMappedFiles(): string[] {
    const files = new Set<string>();
    this.elements.forEach((element) => {
      files.add(element.file);
    });
    const result: string[] = [];
    files.forEach(f => result.push(f));
    return result;
  }

  /** Get total element count */
  getElementCount(): number {
    return this.elements.size;
  }

  // ---------------------------------------------------------------------------
  // Incremental Updates
  // ---------------------------------------------------------------------------

  /**
   * Update mapping for a single element (e.g., after editing).
   * Shifts line numbers for elements below the edit.
   */
  updateElementRange(
    elementId: string,
    newStart: SourcePosition,
    newEnd: SourcePosition
  ): void {
    const element = this.elements.get(elementId);
    if (!element) return;

    const oldStartLine = element.range.start.line;
    const lineDelta = newStart.line - oldStartLine;

    // Update this element
    element.range.start = newStart;
    element.range.end = newEnd;

    // Re-index
    this.clearLineIndex(element.file, oldStartLine, elementId);
    this.indexByLine(element.file, newStart.line, elementId);

    this.emit({ type: "mapping_updated", file: element.file, elementId, timestamp: Date.now() });
  }

  /**
   * Shift all mappings in a file after a line edit.
   *
   * @param file - File that was edited
   * @param afterLine - Line after which to shift
   * @param lineDelta - Number of lines added (positive) or removed (negative)
   */
  shiftMappings(file: string, afterLine: number, lineDelta: number): void {
    if (lineDelta === 0) return;

    this.elements.forEach((element) => {
      if (element.file !== file) return;

      if (element.range.start.line > afterLine) {
        // Clear old index
        this.clearLineIndex(file, element.range.start.line, element.id);

        // Shift
        element.range.start.line += lineDelta;
        element.range.end.line += lineDelta;

        // Re-index
        this.indexByLine(file, element.range.start.line, element.id);
      } else if (element.range.end.line > afterLine) {
        // Element spans the edit point - adjust end only
        element.range.end.line += lineDelta;
      }
    });

    this.emit({ type: "mapping_updated", file, timestamp: Date.now() });
  }

  // ---------------------------------------------------------------------------
  // Clear / Reset
  // ---------------------------------------------------------------------------

  /** Clear all mappings for a file */
  clearFile(file: string): void {
    const toRemove: string[] = [];

    this.elements.forEach((element, id) => {
      if (element.file === file) {
        toRemove.push(id);
      }
    });

    for (const id of toRemove) {
      const element = this.elements.get(id);
      if (element) {
        this.bySelector.delete(element.selector);
        this.elements.delete(id);
      }
    }

    // Clear line index for this file
    const keysToDelete: string[] = [];
    this.byFileLine.forEach((_, key) => {
      if (key.startsWith(file + ":")) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.byFileLine.delete(key);
    }

    this.fileContents.delete(file);
    this.emit({ type: "mapping_cleared", file, timestamp: Date.now() });
  }

  /** Clear all mappings */
  clearAll(): void {
    this.elements.clear();
    this.bySelector.clear();
    this.byFileLine.clear();
    this.fileContents.clear();
    this.emit({ type: "mapping_cleared", timestamp: Date.now() });
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /** Subscribe to mapping events */
  on(listener: SourceMapperEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Unsubscribe from events */
  off(listener: SourceMapperEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: SourceMapperEvent): void {
    const listenersArray: SourceMapperEventListener[] = [];
    this.listeners.forEach(l => listenersArray.push(l));

    for (const listener of listenersArray) {
      try {
        listener(event);
      } catch (error) {
        console.error("[SourceMapper] Listener error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private indexByLine(file: string, line: number, elementId: string): void {
    const key = `${file}:${line}`;
    let ids = this.byFileLine.get(key);
    if (!ids) {
      ids = new Set();
      this.byFileLine.set(key, ids);
    }
    ids.add(elementId);
  }

  private clearLineIndex(file: string, line: number, elementId: string): void {
    const key = `${file}:${line}`;
    const ids = this.byFileLine.get(key);
    if (ids) {
      ids.delete(elementId);
      if (ids.size === 0) {
        this.byFileLine.delete(key);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /** Export mapping state for persistence */
  toJSON(): { elements: MappedElement[]; config: SourceMapperConfig } {
    const elements: MappedElement[] = [];
    this.elements.forEach(e => elements.push(e));
    return {
      elements,
      config: this.config,
    };
  }

  /** Import mapping state */
  fromJSON(data: { elements: MappedElement[]; config?: SourceMapperConfig }): void {
    this.clearAll();

    if (data.config) {
      this.config = { ...DEFAULT_MAPPER_CONFIG, ...data.config };
    }

    for (const element of data.elements) {
      this.elements.set(element.id, element);
      this.bySelector.set(element.selector, element.id);
      this.indexByLine(element.file, element.range.start.line, element.id);
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: SourceMapper | null = null;

/** Get the global SourceMapper instance */
export function getSourceMapper(): SourceMapper {
  if (!_instance) {
    _instance = new SourceMapper();
  }
  return _instance;
}

/** Reset the global SourceMapper instance */
export function resetSourceMapper(): void {
  if (_instance) {
    _instance.clearAll();
    _instance = null;
  }
  resetMapperCounters();
}
