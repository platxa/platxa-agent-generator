/**
 * QWeb Source Map — Bidirectional mapping between DOM elements and QWeb template source lines.
 *
 * Annotates HTML output with `data-source-line` and `data-source-file` attributes
 * so the preview iframe can map clicks back to exact template lines, and the editor
 * can highlight corresponding preview elements when clicking source code.
 */

// =============================================================================
// Types
// =============================================================================

/** A mapping entry linking a DOM selector to a source location */
export interface SourceMapEntry {
  /** CSS selector or data attribute value to identify the DOM element */
  domSelector: string;
  /** Source file path */
  file: string;
  /** 1-based line number in the source file */
  line: number;
  /** 1-based end line number (closing tag line) */
  endLine?: number;
  /** Optional column */
  column?: number;
  /** The QWeb tag name (e.g. "section", "div", "t") */
  tagName: string;
  /** Snippet ID if this element is inside a snippet */
  snippetId?: string;
}

/** Source location returned by getSourceLocation */
export interface SourceLocation {
  /** Source file path */
  path: string;
  /** 1-based start line number */
  startLine: number;
  /** 1-based end line number */
  endLine: number;
}

/** Complete source map for a rendered page */
export interface QWebSourceMap {
  entries: SourceMapEntry[];
  /** Lookup DOM → source */
  findSource(domSelector: string): SourceMapEntry | undefined;
  /** Lookup source line → DOM selectors */
  findDom(file: string, line: number): SourceMapEntry[];
}

// =============================================================================
// Annotation
// =============================================================================

/**
 * Annotates QWeb/XML template source by adding `data-source-line` and
 * `data-source-file` attributes to each opening HTML tag.
 * This allows the rendered preview to be mapped back to source lines.
 */
export function annotateTemplateSource(
  source: string,
  file: string,
): { annotated: string; entries: SourceMapEntry[] } {
  const lines = source.split("\n");
  const entries: SourceMapEntry[] = [];
  const annotatedLines: string[] = [];

  // Regex to match opening HTML tags (not closing, not comments, not self-closing processed separately)
  const openTagRegex = /^(\s*)<([a-zA-Z][\w.-]*)(\s[^>]*)?(\/?)>/;
  // Regex to match closing tags
  const closeTagRegex = /<\/([a-zA-Z][\w.-]*)>/g;

  // Stack to track open tags for endLine calculation
  const tagStack: Array<{ entryIndex: number; tagName: string }> = [];
  let entryIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const match = line.match(openTagRegex);

    if (match) {
      const [fullMatch, indent, tagName, attrs = "", selfClose] = match;
      const selectorId = `src-${entryIndex}`;
      const isSelfClosing = selfClose === "/" || line.includes("/>");

      // Extract snippet ID if present
      let snippetId: string | undefined;
      const snippetMatch = (attrs || "").match(/(?:data-snippet=["']([^"']+)["']|class="[^"]*\b(s_[a-z][a-z0-9_]*)\b)/);
      if (snippetMatch) {
        snippetId = snippetMatch[1] || snippetMatch[2];
      }

      const entry: SourceMapEntry = {
        domSelector: `[data-source-id="${selectorId}"]`,
        file,
        line: lineNum,
        endLine: isSelfClosing ? lineNum : undefined, // Self-closing tags end on same line
        tagName,
        snippetId,
      };
      entries.push(entry);

      // Track non-self-closing tags for endLine
      if (!isSelfClosing) {
        tagStack.push({ entryIndex, tagName });
      }

      // Inject data attributes into the tag
      const injection = ` data-source-id="${selectorId}" data-source-line="${lineNum}" data-source-file="${file}"`;
      const reconstructed = `${indent}<${tagName}${injection}${attrs || ""}${selfClose}>`;
      annotatedLines.push(line.replace(fullMatch, reconstructed));
      entryIndex++;
    } else {
      annotatedLines.push(line);
    }

    // Check for closing tags to set endLine
    let closeMatch;
    while ((closeMatch = closeTagRegex.exec(line)) !== null) {
      const closingTagName = closeMatch[1];
      // Find matching open tag (search from top of stack)
      for (let j = tagStack.length - 1; j >= 0; j--) {
        if (tagStack[j].tagName === closingTagName) {
          entries[tagStack[j].entryIndex].endLine = lineNum;
          tagStack.splice(j, 1);
          break;
        }
      }
    }
  }

  // Set endLine for unclosed tags (end of file)
  const totalLines = lines.length;
  for (const remaining of tagStack) {
    if (entries[remaining.entryIndex].endLine === undefined) {
      entries[remaining.entryIndex].endLine = totalLines;
    }
  }

  return {
    annotated: annotatedLines.join("\n"),
    entries,
  };
}

// =============================================================================
// Source Map Builder
// =============================================================================

/**
 * Builds a bidirectional source map from annotated entries.
 */
export function buildSourceMap(entries: SourceMapEntry[]): QWebSourceMap {
  const bySelector = new Map<string, SourceMapEntry>();
  const byFileLine = new Map<string, SourceMapEntry[]>();

  for (const entry of entries) {
    bySelector.set(entry.domSelector, entry);

    const key = `${entry.file}:${entry.line}`;
    const existing = byFileLine.get(key) || [];
    existing.push(entry);
    byFileLine.set(key, existing);
  }

  return {
    entries,
    findSource(domSelector: string) {
      return bySelector.get(domSelector);
    },
    findDom(file: string, line: number) {
      return byFileLine.get(`${file}:${line}`) || [];
    },
  };
}

// =============================================================================
// Source Location Lookup
// =============================================================================

/**
 * Get source location for a DOM element by its source ID.
 *
 * Feature #69: Returns { path, startLine, endLine } for element selection.
 *
 * @param elementId - The data-source-id value (e.g., "src-0")
 * @param sourceMap - The QWebSourceMap containing entries
 * @returns SourceLocation or null if not found
 *
 * @example
 * ```typescript
 * const { entries } = annotateTemplateSource(source, 'template.xml');
 * const map = buildSourceMap(entries);
 * const location = getSourceLocation('src-0', map);
 * // { path: 'template.xml', startLine: 1, endLine: 5 }
 * ```
 */
export function getSourceLocation(
  elementId: string,
  sourceMap: QWebSourceMap
): SourceLocation | null {
  // Build selector from elementId
  const selector = `[data-source-id="${elementId}"]`;
  const entry = sourceMap.findSource(selector);

  if (!entry) {
    return null;
  }

  return {
    path: entry.file,
    startLine: entry.line,
    endLine: entry.endLine ?? entry.line, // Default to same line if no endLine
  };
}

// =============================================================================
// Preview Script — injected into iframe for DOM→source click mapping
// =============================================================================

/**
 * Script to inject into the preview iframe that sends source location
 * when clicking an element with data-source-line attributes.
 */
export const SOURCE_MAP_CLICK_SCRIPT = `
<script>
(function() {
  function findSourceElement(el) {
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.sourceLine) {
        return {
          line: parseInt(el.dataset.sourceLine, 10),
          file: el.dataset.sourceFile || '',
          id: el.dataset.sourceId || '',
          tag: el.tagName.toLowerCase()
        };
      }
      el = el.parentElement;
    }
    return null;
  }

  // Highlight style for source-mapped elements
  var style = document.createElement('style');
  style.textContent =
    '[data-source-highlight] {' +
    '  outline: 2px solid #3b82f6 !important;' +
    '  outline-offset: 1px;' +
    '  background-color: rgba(59, 130, 246, 0.05) !important;' +
    '}';
  document.head.appendChild(style);

  // Click: navigate to source
  document.addEventListener('dblclick', function(e) {
    var result = findSourceElement(e.target);
    if (result) {
      window.parent.postMessage({
        type: 'platxa:source-navigate',
        file: result.file,
        line: result.line,
        sourceId: result.id
      }, '*');
    }
  });

  // Listen for highlight requests from parent (editor → preview)
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'platxa:highlight-element') {
      // Clear previous
      var prev = document.querySelector('[data-source-highlight]');
      if (prev) prev.removeAttribute('data-source-highlight');

      if (e.data.sourceId) {
        var el = document.querySelector('[data-source-id="' + e.data.sourceId + '"]');
        if (el) {
          el.setAttribute('data-source-highlight', 'true');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  });
})();
</script>`;
