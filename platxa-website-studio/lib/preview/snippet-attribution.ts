/**
 * Snippet Attribution — Unique ID generation for snippet instances during QWeb generation.
 *
 * Adds `data-snippet-id` attributes with unique identifiers to each snippet wrapper,
 * enabling precise targeting for HMR updates, source mapping, and editing operations.
 *
 * Key distinction:
 * - `data-snippet="s_banner"` — identifies snippet TYPE (existing Odoo pattern)
 * - `data-snippet-id="snippet-0"` — identifies unique INSTANCE (this module)
 */

// =============================================================================
// Types
// =============================================================================

/** ID generator function signature */
export type SnippetIdGenerator = (index: number, snippetType: string) => string;

/** Options for snippet ID generation */
export interface SnippetAttributionOptions {
  /** Prefix for generated IDs (default: "snippet") */
  idPrefix?: string;
  /** Starting counter value (default: 0) */
  startCounter?: number;
  /** Whether to preserve existing data-snippet-id attributes (default: false) */
  preserveExisting?: boolean;
  /** Custom ID generator function */
  idGenerator?: SnippetIdGenerator;
}

/** Result of attribution process */
export interface AttributionResult {
  /** HTML with data-snippet-id attributes added */
  html: string;
  /** Map of generated IDs to snippet types */
  snippetMap: Map<string, string>;
  /** Total snippets attributed */
  totalSnippets: number;
  /** IDs that were preserved (not overwritten) */
  preservedIds: string[];
}

/** A detected snippet in the HTML */
export interface DetectedSnippet {
  /** Unique instance ID */
  id: string;
  /** Snippet type (e.g., "s_banner") */
  type: string;
  /** Index in document order */
  index: number;
  /** Whether this ID was newly generated or preserved */
  isNew: boolean;
}

// =============================================================================
// SnippetAttributor Class
// =============================================================================

/**
 * Handles unique ID attribution for snippet instances.
 *
 * @example
 * ```typescript
 * const attributor = new SnippetAttributor();
 * const { html, snippetMap } = attributor.attribute(qwebOutput);
 *
 * // HTML now has unique IDs:
 * // <section data-snippet="s_banner" data-snippet-id="snippet-0">...
 * // <section data-snippet="s_features" data-snippet-id="snippet-1">...
 *
 * // Map for lookups:
 * snippetMap.get("snippet-0") // "s_banner"
 * ```
 */
export class SnippetAttributor {
  private counter: number;
  private options: Required<SnippetAttributionOptions>;
  private snippetMap = new Map<string, string>();

  constructor(options: SnippetAttributionOptions = {}) {
    this.counter = options.startCounter ?? 0;
    this.options = {
      idPrefix: options.idPrefix ?? "snippet",
      startCounter: options.startCounter ?? 0,
      preserveExisting: options.preserveExisting ?? false,
      idGenerator: options.idGenerator ?? ((index, _type) => `${this.options.idPrefix}-${index}`),
    };
  }

  // ---------------------------------------------------------------------------
  // Main API
  // ---------------------------------------------------------------------------

  /**
   * Attributes unique IDs to all snippet wrappers in HTML.
   *
   * Detects elements with `data-snippet` or snippet class patterns (s_xxx)
   * and adds `data-snippet-id` with unique identifiers.
   */
  attribute(html: string): AttributionResult {
    const preservedIds: string[] = [];
    let result = html;

    // Pattern to match snippet wrapper elements:
    // 1. Elements with data-snippet="xxx" attribute
    // 2. Elements with class containing s_xxx pattern
    const snippetPatterns = [
      // Match elements with data-snippet attribute
      /(<(?:section|div|footer|header|article|aside|nav)[^>]*)(data-snippet="([^"]+)")([^>]*>)/gi,
      // Match elements with s_xxx class (Odoo snippet naming convention)
      /(<(?:section|div|footer|header|article|aside|nav)[^>]*class="[^"]*\b(s_[a-z][a-z0-9_]*)\b[^"]*"[^>]*)(>)/gi,
    ];

    // Process data-snippet attributes first
    result = result.replace(
      snippetPatterns[0],
      (match, prefix, dataSnippet, snippetType, suffix) => {
        // Check if already has data-snippet-id
        if (this.options.preserveExisting && /data-snippet-id="([^"]+)"/.test(prefix + suffix)) {
          const existingId = (prefix + suffix).match(/data-snippet-id="([^"]+)"/)?.[1];
          if (existingId) {
            preservedIds.push(existingId);
            this.snippetMap.set(existingId, snippetType);
            return match;
          }
        }

        const id = this.generateId(snippetType);
        this.snippetMap.set(id, snippetType);

        // Insert data-snippet-id after data-snippet
        return `${prefix}${dataSnippet} data-snippet-id="${id}"${suffix}`;
      },
    );

    // Process class-based snippets that don't have data-snippet
    result = result.replace(
      snippetPatterns[1],
      (match, prefix, snippetClass, suffix) => {
        // Skip if already has data-snippet-id or data-snippet
        if (/data-snippet-id="/.test(prefix) || /data-snippet="/.test(prefix)) {
          return match;
        }

        // Check for preserved existing IDs
        if (this.options.preserveExisting) {
          const existingMatch = prefix.match(/data-snippet-id="([^"]+)"/);
          if (existingMatch) {
            preservedIds.push(existingMatch[1]);
            this.snippetMap.set(existingMatch[1], snippetClass);
            return match;
          }
        }

        const id = this.generateId(snippetClass);
        this.snippetMap.set(id, snippetClass);

        // Insert both data-snippet and data-snippet-id before closing >
        return `${prefix} data-snippet="${snippetClass}" data-snippet-id="${id}"${suffix}`;
      },
    );

    return {
      html: result,
      snippetMap: new Map(this.snippetMap),
      totalSnippets: this.snippetMap.size,
      preservedIds,
    };
  }

  /**
   * Detects all snippets in HTML and returns their information.
   */
  detect(html: string): DetectedSnippet[] {
    const snippets: DetectedSnippet[] = [];
    let index = 0;

    // Pattern to find all snippet elements
    const pattern = /data-snippet="([^"]+)"(?:\s+data-snippet-id="([^"]+)")?|data-snippet-id="([^"]+)"[^>]*data-snippet="([^"]+)"|class="[^"]*\b(s_[a-z][a-z0-9_]*)\b[^"]*"/gi;

    let match;
    while ((match = pattern.exec(html)) !== null) {
      const snippetType = match[1] || match[4] || match[5];
      const existingId = match[2] || match[3];

      if (snippetType) {
        const id = existingId || this.generateId(snippetType);
        snippets.push({
          id,
          type: snippetType,
          index: index++,
          isNew: !existingId,
        });
      }
    }

    return snippets;
  }

  /**
   * Gets the snippet type for a given ID.
   */
  getSnippetType(id: string): string | undefined {
    return this.snippetMap.get(id);
  }

  /**
   * Gets all attributed snippet IDs.
   */
  getAllIds(): string[] {
    return Array.from(this.snippetMap.keys());
  }

  /**
   * Gets IDs for a specific snippet type.
   */
  getIdsByType(type: string): string[] {
    return Array.from(this.snippetMap.entries())
      .filter(([_, t]) => t === type)
      .map(([id]) => id);
  }

  /**
   * Resets the counter and clears the map.
   */
  reset(): void {
    this.counter = this.options.startCounter;
    this.snippetMap.clear();
  }

  /**
   * Returns the current counter value.
   */
  get currentCounter(): number {
    return this.counter;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private generateId(snippetType: string): string {
    const id = this.options.idGenerator(this.counter, snippetType);
    this.counter++;
    return id;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Attributes snippet IDs to HTML in one step.
 */
export function attributeSnippetIds(
  html: string,
  options?: SnippetAttributionOptions,
): AttributionResult {
  const attributor = new SnippetAttributor(options);
  return attributor.attribute(html);
}

/**
 * Detects snippets in HTML without modifying it.
 */
export function detectSnippets(html: string): DetectedSnippet[] {
  const attributor = new SnippetAttributor();
  return attributor.detect(html);
}

/**
 * Ensures all snippets have unique IDs, generating only for those missing.
 */
export function ensureSnippetIds(
  html: string,
  options?: Omit<SnippetAttributionOptions, "preserveExisting">,
): AttributionResult {
  return attributeSnippetIds(html, { ...options, preserveExisting: true });
}

/**
 * Creates a custom ID generator that includes snippet type.
 */
export function createTypedIdGenerator(prefix = "snippet"): SnippetIdGenerator {
  return (index: number, snippetType: string): string => {
    // e.g., "snippet-banner-0"
    const shortType = snippetType.replace(/^s_/, "");
    return `${prefix}-${shortType}-${index}`;
  };
}

/**
 * Creates a UUID-based ID generator for globally unique IDs.
 */
export function createUuidIdGenerator(): SnippetIdGenerator {
  return (_index: number, _snippetType: string): string => {
    // Simple UUID v4 generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates that all snippets have unique IDs.
 */
export function validateSnippetIds(html: string): {
  valid: boolean;
  duplicates: string[];
  missing: number;
} {
  const idCounts = new Map<string, number>();
  let missing = 0;

  // Find all data-snippet-id values
  const idPattern = /data-snippet-id="([^"]+)"/g;
  let match;
  while ((match = idPattern.exec(html)) !== null) {
    const id = match[1];
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  // Find snippets without IDs
  const snippetPattern = /data-snippet="([^"]+)"(?![^>]*data-snippet-id)/g;
  while ((match = snippetPattern.exec(html)) !== null) {
    missing++;
  }

  // Also check class-based snippets
  const classPattern = /class="[^"]*\b(s_[a-z][a-z0-9_]*)\b[^"]*"(?![^>]*data-snippet-id)(?![^>]*data-snippet)/g;
  while ((match = classPattern.exec(html)) !== null) {
    missing++;
  }

  const duplicates = Array.from(idCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([id]) => id);

  return {
    valid: duplicates.length === 0 && missing === 0,
    duplicates,
    missing,
  };
}

/**
 * Extracts the snippet ID from an element's HTML string.
 */
export function extractSnippetId(elementHtml: string): string | null {
  const match = elementHtml.match(/data-snippet-id="([^"]+)"/);
  return match?.[1] ?? null;
}

/**
 * Extracts the snippet type from an element's HTML string.
 */
export function extractSnippetType(elementHtml: string): string | null {
  // Try data-snippet first
  const dataMatch = elementHtml.match(/data-snippet="([^"]+)"/);
  if (dataMatch) return dataMatch[1];

  // Fall back to class-based pattern
  const classMatch = elementHtml.match(/class="[^"]*\b(s_[a-z][a-z0-9_]*)\b/);
  return classMatch?.[1] ?? null;
}
