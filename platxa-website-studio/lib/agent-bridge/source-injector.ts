/**
 * Source Injector — Injects data-qweb-* attributes into rendered HTML
 *
 * Feature #14: Visual Edit Mode - Click-to-source functionality
 *
 * Post-processes rendered HTML to add source location attributes:
 * - data-qweb-line: Source line number
 * - data-qweb-file: Source file path
 * - data-qweb-id: Unique element identifier for mapping
 *
 * These attributes enable click-to-source navigation in the preview.
 */

import {
  SourceMapper,
  getSourceMapper,
  type MappedElement,
} from "./source-mapper";

// =============================================================================
// Types
// =============================================================================

/** Configuration for source injection */
export interface SourceInjectorConfig {
  /** Attribute name for line number */
  lineAttr: string;
  /** Attribute name for file path */
  fileAttr: string;
  /** Attribute name for element ID */
  idAttr: string;
  /** Whether to include column info */
  includeColumn: boolean;
  /** Column attribute name */
  columnAttr: string;
  /** Tags to skip injection (usually scripts, styles) */
  skipTags: string[];
  /** Whether to inject into self-closing tags */
  injectSelfClosing: boolean;
}

/** Result of source injection */
export interface InjectionResult {
  /** Injected HTML */
  html: string;
  /** Number of elements injected */
  elementCount: number;
  /** Injection time in ms */
  injectionTime: number;
  /** Errors encountered */
  errors: string[];
  /** File that was processed */
  file: string;
}

/** Injection statistics */
export interface InjectionStats {
  totalInjections: number;
  filesProcessed: number;
  averageElementsPerFile: number;
  totalTime: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default injector configuration */
export const DEFAULT_INJECTOR_CONFIG: SourceInjectorConfig = {
  lineAttr: "data-qweb-line",
  fileAttr: "data-qweb-file",
  idAttr: "data-qweb-id",
  includeColumn: true,
  columnAttr: "data-qweb-col",
  skipTags: ["script", "style", "meta", "link", "!--"],
  injectSelfClosing: true,
};

// =============================================================================
// Helpers
// =============================================================================

let _injectionCounter = 0;

/** Reset injection counter (for testing) */
export function resetInjectionCounters(): void {
  _injectionCounter = 0;
}

/** Generate unique injection ID */
function generateInjectionId(): string {
  return `qweb-${_injectionCounter++}`;
}

/** Check if tag should be skipped */
function shouldSkipTag(tagName: string, config: SourceInjectorConfig): boolean {
  const lower = tagName.toLowerCase();
  return config.skipTags.some(skip => lower === skip || lower.startsWith(skip));
}

// =============================================================================
// Source Injector Class
// =============================================================================

/**
 * SourceInjector handles injection of data-qweb-* attributes into HTML.
 *
 * Usage:
 * ```ts
 * const injector = new SourceInjector();
 *
 * // Inject attributes into rendered HTML
 * const result = injector.inject(html, 'template.xml');
 *
 * // Access injected HTML
 * console.log(result.html);
 *
 * // Elements are registered with SourceMapper automatically
 * const mapper = getSourceMapper();
 * const source = mapper.getSourceForElementId('qweb-0');
 * ```
 */
export class SourceInjector {
  private config: SourceInjectorConfig;
  private mapper: SourceMapper;
  private stats: InjectionStats;

  constructor(
    config: Partial<SourceInjectorConfig> = {},
    mapper?: SourceMapper
  ) {
    this.config = { ...DEFAULT_INJECTOR_CONFIG, ...config };
    this.mapper = mapper || getSourceMapper();
    this.stats = {
      totalInjections: 0,
      filesProcessed: 0,
      averageElementsPerFile: 0,
      totalTime: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Main Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject source attributes into HTML.
   *
   * @param html - HTML to process
   * @param file - Source file path for attribution
   * @returns Injection result with modified HTML
   */
  inject(html: string, file: string): InjectionResult {
    const startTime = Date.now();
    const errors: string[] = [];
    let elementCount = 0;

    // First, map the template to get source positions
    // This also annotates with data-source-* attributes
    let processedHtml = this.mapper.mapTemplate(html, file);

    // Now add data-qweb-* attributes based on mappings
    const elements = this.mapper.getElementsForFile(file);

    // Process each element to add qweb attributes
    for (const element of elements) {
      if (shouldSkipTag(element.tagName, this.config)) {
        continue;
      }

      try {
        processedHtml = this.injectElementAttributes(processedHtml, element);
        elementCount++;
      } catch (error) {
        errors.push(`Failed to inject ${element.id}: ${error}`);
      }
    }

    const injectionTime = Date.now() - startTime;

    // Update stats
    this.stats.totalInjections += elementCount;
    this.stats.filesProcessed++;
    this.stats.totalTime += injectionTime;
    this.stats.averageElementsPerFile = this.stats.totalInjections / this.stats.filesProcessed;

    return {
      html: processedHtml,
      elementCount,
      injectionTime,
      errors,
      file,
    };
  }

  /**
   * Inject attributes for a single element.
   */
  private injectElementAttributes(html: string, element: MappedElement): string {
    // Find the element by its data-source-id
    const sourceIdPattern = new RegExp(
      `(<${element.tagName}[^>]*)(data-source-id="${element.id}"[^>]*)>`,
      "i"
    );

    const match = html.match(sourceIdPattern);
    if (!match) {
      // Try alternative pattern for self-closing tags
      const selfClosePattern = new RegExp(
        `(<${element.tagName}[^>]*)(data-source-id="${element.id}"[^/]*)/>`,
        "i"
      );
      const selfMatch = html.match(selfClosePattern);

      if (!selfMatch) {
        return html;
      }

      // Inject into self-closing tag
      if (this.config.injectSelfClosing) {
        const attrs = this.buildAttributeString(element);
        const replacement = `${selfMatch[1]}${selfMatch[2]}${attrs}/>`;
        return html.replace(selfMatch[0], replacement);
      }
      return html;
    }

    // Inject attributes before the closing >
    const attrs = this.buildAttributeString(element);
    const replacement = `${match[1]}${match[2]}${attrs}>`;
    return html.replace(match[0], replacement);
  }

  /**
   * Build attribute string for injection.
   */
  private buildAttributeString(element: MappedElement): string {
    const attrs: string[] = [];

    // data-qweb-line
    attrs.push(`${this.config.lineAttr}="${element.range.start.line}"`);

    // data-qweb-file
    attrs.push(`${this.config.fileAttr}="${element.file}"`);

    // data-qweb-id (using a new ID for qweb namespace)
    const qwebId = generateInjectionId();
    attrs.push(`${this.config.idAttr}="${qwebId}"`);

    // data-qweb-col (optional)
    if (this.config.includeColumn) {
      attrs.push(`${this.config.columnAttr}="${element.range.start.column}"`);
    }

    return " " + attrs.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Batch Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject source attributes into multiple HTML files.
   *
   * @param files - Array of { html, file } pairs
   * @returns Array of injection results
   */
  injectBatch(files: Array<{ html: string; file: string }>): InjectionResult[] {
    return files.map(({ html, file }) => this.inject(html, file));
  }

  // ---------------------------------------------------------------------------
  // Extraction (reverse operation)
  // ---------------------------------------------------------------------------

  /**
   * Extract source info from an element's attributes.
   * Useful for processing click events in preview.
   *
   * @param attributes - Element attributes object
   * @returns Source info or null
   */
  extractSourceInfo(attributes: Record<string, string>): {
    line: number;
    file: string;
    id: string;
    column?: number;
  } | null {
    const line = attributes[this.config.lineAttr];
    const file = attributes[this.config.fileAttr];
    const id = attributes[this.config.idAttr];

    if (!line || !file) {
      return null;
    }

    const result: {
      line: number;
      file: string;
      id: string;
      column?: number;
    } = {
      line: parseInt(line, 10),
      file,
      id: id || "",
    };

    if (this.config.includeColumn && attributes[this.config.columnAttr]) {
      result.column = parseInt(attributes[this.config.columnAttr], 10);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  /** Get injection statistics */
  getStats(): InjectionStats {
    return { ...this.stats };
  }

  /** Reset statistics */
  resetStats(): void {
    this.stats = {
      totalInjections: 0,
      filesProcessed: 0,
      averageElementsPerFile: 0,
      totalTime: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Get current configuration */
  getConfig(): SourceInjectorConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<SourceInjectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Standalone Functions
// =============================================================================

/**
 * Quick injection without creating an instance.
 *
 * @param html - HTML to process
 * @param file - Source file path
 * @param config - Optional configuration
 * @returns Injected HTML
 */
export function injectSourceAttributes(
  html: string,
  file: string,
  config?: Partial<SourceInjectorConfig>
): string {
  const injector = new SourceInjector(config);
  const result = injector.inject(html, file);
  return result.html;
}

/**
 * Check if HTML has source attributes.
 *
 * @param html - HTML to check
 * @returns true if has data-qweb-* attributes
 */
export function hasSourceAttributes(html: string): boolean {
  return (
    html.includes("data-qweb-line=") ||
    html.includes("data-qweb-file=") ||
    html.includes("data-qweb-id=")
  );
}

/**
 * Strip source attributes from HTML.
 * Useful for final export/deploy.
 *
 * @param html - HTML to clean
 * @returns HTML without source attributes
 */
export function stripSourceAttributes(html: string): string {
  // Remove data-qweb-* attributes
  let result = html.replace(/\s*data-qweb-line="[^"]*"/g, "");
  result = result.replace(/\s*data-qweb-file="[^"]*"/g, "");
  result = result.replace(/\s*data-qweb-id="[^"]*"/g, "");
  result = result.replace(/\s*data-qweb-col="[^"]*"/g, "");

  // Also remove data-source-* attributes
  result = result.replace(/\s*data-source-id="[^"]*"/g, "");
  result = result.replace(/\s*data-source-line="[^"]*"/g, "");
  result = result.replace(/\s*data-source-file="[^"]*"/g, "");

  return result;
}

// =============================================================================
// Preview Script
// =============================================================================

/**
 * JavaScript to inject into preview iframe for click-to-source.
 * Sends postMessage to parent when elements are clicked.
 */
export const CLICK_TO_SOURCE_SCRIPT = `
<script>
(function() {
  'use strict';

  // Find element with source attributes
  function findSourceElement(el) {
    while (el && el !== document.body) {
      var line = el.getAttribute('data-qweb-line');
      var file = el.getAttribute('data-qweb-file');
      if (line && file) {
        return {
          line: parseInt(line, 10),
          file: file,
          id: el.getAttribute('data-qweb-id') || '',
          column: parseInt(el.getAttribute('data-qweb-col') || '1', 10),
          tagName: el.tagName.toLowerCase()
        };
      }
      el = el.parentElement;
    }
    return null;
  }

  // Highlight styles
  var style = document.createElement('style');
  style.textContent = [
    '[data-qweb-highlight] {',
    '  outline: 2px solid #3b82f6 !important;',
    '  outline-offset: 2px;',
    '  background-color: rgba(59, 130, 246, 0.1) !important;',
    '}',
    '[data-qweb-hover] {',
    '  outline: 1px dashed #94a3b8 !important;',
    '  outline-offset: 1px;',
    '}'
  ].join('\\n');
  document.head.appendChild(style);

  // Hover preview
  var currentHover = null;
  document.addEventListener('mouseover', function(e) {
    if (currentHover) {
      currentHover.removeAttribute('data-qweb-hover');
    }
    var info = findSourceElement(e.target);
    if (info) {
      currentHover = e.target;
      while (currentHover && !currentHover.hasAttribute('data-qweb-line')) {
        currentHover = currentHover.parentElement;
      }
      if (currentHover) {
        currentHover.setAttribute('data-qweb-hover', 'true');
      }
    }
  });

  // Double-click to navigate to source
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    var info = findSourceElement(e.target);
    if (info) {
      window.parent.postMessage({
        type: 'platxa:qweb-navigate',
        file: info.file,
        line: info.line,
        column: info.column,
        elementId: info.id,
        tagName: info.tagName
      }, '*');
    }
  });

  // Single click with modifier to select element
  document.addEventListener('click', function(e) {
    if (e.altKey || e.metaKey) {
      e.preventDefault();
      var info = findSourceElement(e.target);
      if (info) {
        window.parent.postMessage({
          type: 'platxa:qweb-select',
          file: info.file,
          line: info.line,
          column: info.column,
          elementId: info.id,
          tagName: info.tagName
        }, '*');
      }
    }
  });

  // Listen for highlight requests from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'platxa:qweb-highlight') {
      // Clear previous highlight
      var prev = document.querySelector('[data-qweb-highlight]');
      if (prev) prev.removeAttribute('data-qweb-highlight');

      // Find and highlight element
      if (e.data.elementId) {
        var el = document.querySelector('[data-qweb-id="' + e.data.elementId + '"]');
        if (el) {
          el.setAttribute('data-qweb-highlight', 'true');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.data.line && e.data.file) {
        var selector = '[data-qweb-file="' + e.data.file + '"][data-qweb-line="' + e.data.line + '"]';
        var el = document.querySelector(selector);
        if (el) {
          el.setAttribute('data-qweb-highlight', 'true');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    if (e.data.type === 'platxa:qweb-clear-highlight') {
      var prev = document.querySelector('[data-qweb-highlight]');
      if (prev) prev.removeAttribute('data-qweb-highlight');
    }
  });

  // Notify parent that script is ready
  window.parent.postMessage({ type: 'platxa:qweb-script-ready' }, '*');
})();
</script>`;

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: SourceInjector | null = null;

/** Get the global SourceInjector instance */
export function getSourceInjector(): SourceInjector {
  if (!_instance) {
    _instance = new SourceInjector();
  }
  return _instance;
}

/** Reset the global SourceInjector instance */
export function resetSourceInjector(): void {
  if (_instance) {
    _instance.resetStats();
    _instance = null;
  }
  resetInjectionCounters();
}
