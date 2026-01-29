/**
 * Error Location Extractor
 *
 * Extracts file/line/column information from various error message formats.
 * Supports SCSS, QWeb, Python, JavaScript, TypeScript, and generic formats.
 */

// =============================================================================
// Types
// =============================================================================

/** Extracted location from an error message */
export interface ErrorLocation {
  /** File path where error occurred */
  file: string | null;
  /** Line number (1-based) */
  line: number | null;
  /** Column number (1-based) */
  column: number | null;
  /** End line for multi-line errors */
  endLine: number | null;
  /** End column for range errors */
  endColumn: number | null;
  /** The matched format type */
  format: ErrorFormat;
  /** Confidence level of the extraction */
  confidence: "high" | "medium" | "low";
}

/** Supported error format types */
export type ErrorFormat =
  | "typescript"
  | "scss"
  | "qweb"
  | "python"
  | "javascript"
  | "eslint"
  | "generic"
  | "unknown";

/** Pattern definition for location extraction */
interface LocationPattern {
  format: ErrorFormat;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<ErrorLocation>;
  confidence: "high" | "medium" | "low";
}

// =============================================================================
// Location Patterns
// =============================================================================

const LOCATION_PATTERNS: LocationPattern[] = [
  // TypeScript: file.ts(line,col): error TSxxxx
  {
    format: "typescript",
    pattern: /^(.+?)\((\d+),(\d+)\):/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "high",
  },
  // TypeScript alternative: file.ts:line:col - error TSxxxx
  {
    format: "typescript",
    pattern: /^(.+?):(\d+):(\d+)\s*-\s*error\s+TS/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "high",
  },
  // Python traceback: File "path/file.py", line 42, in function_name
  {
    format: "python",
    pattern: /File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+\S+)?/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
    }),
    confidence: "high",
  },
  // Python syntax error: file.py:line:col: SyntaxError
  {
    format: "python",
    pattern: /^(.+\.py):(\d+):(\d+):/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "high",
  },
  // Python simple: file.py:line
  {
    format: "python",
    pattern: /^(.+\.py):(\d+)(?:\s|$|:)/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
    }),
    confidence: "medium",
  },
  // QWeb: [QWeb ERROR] file:line:col
  {
    format: "qweb",
    pattern: /\[QWeb\s+(?:ERROR|WARNING)\]\s*(.+?):(\d+)(?::(\d+))?/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: match[3] ? parseInt(match[3], 10) : null,
    }),
    confidence: "high",
  },
  // SCSS dart-sass: file.scss:line:col: (non-greedy to avoid capturing prefixes)
  {
    format: "scss",
    pattern: /([^\s:]+\.scss):(\d+):(\d+):/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "high",
  },
  // SCSS on line X of file.scss
  {
    format: "scss",
    pattern: /on\s+line\s+(\d+)\s+of\s+(.+\.scss)/i,
    extract: (match) => ({
      file: match[2],
      line: parseInt(match[1], 10),
    }),
    confidence: "high",
  },
  // SCSS at file.scss:line (non-greedy file capture)
  {
    format: "scss",
    pattern: /at\s+([^\s:]+\.scss):(\d+)(?::(\d+))?/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: match[3] ? parseInt(match[3], 10) : null,
    }),
    confidence: "medium",
  },
  // ESLint/Prettier: file.ts:line:col: message
  {
    format: "eslint",
    pattern: /^(.+?\.[jt]sx?):(\d+):(\d+):/m,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "high",
  },
  // JavaScript stack trace: at Function (file:line:col)
  {
    format: "javascript",
    pattern: /at\s+(?:[\w.<>]+\s+)?\((.+?):(\d+):(\d+)\)/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "medium",
  },
  // JavaScript stack trace: at file:line:col
  {
    format: "javascript",
    pattern: /at\s+(.+?):(\d+):(\d+)(?:\s|$)/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "medium",
  },
  // Generic: file.ext:line:col
  {
    format: "generic",
    pattern: /([^\s:]+\.[a-z]{1,5}):(\d+):(\d+)/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    }),
    confidence: "low",
  },
  // Generic: file.ext:line
  {
    format: "generic",
    pattern: /([^\s:]+\.[a-z]{1,5}):(\d+)(?:\s|$|[^:\d])/i,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
    }),
    confidence: "low",
  },
  // Generic: line X in file
  {
    format: "generic",
    pattern: /line\s+(\d+)\s+(?:in|of)\s+([^\s:]+)/i,
    extract: (match) => ({
      file: match[2],
      line: parseInt(match[1], 10),
    }),
    confidence: "low",
  },
];

// =============================================================================
// ErrorLocationExtractor Class
// =============================================================================

/**
 * Extracts file/line/column information from error messages.
 *
 * @example
 * ```typescript
 * const extractor = new ErrorLocationExtractor();
 *
 * // SCSS error
 * const loc1 = extractor.extract("Error on line 15 of styles/theme.scss");
 * // { file: "styles/theme.scss", line: 15, column: null, format: "scss" }
 *
 * // Python error
 * const loc2 = extractor.extract('File "/app/main.py", line 42, in run');
 * // { file: "/app/main.py", line: 42, column: null, format: "python" }
 *
 * // QWeb error
 * const loc3 = extractor.extract("[QWeb ERROR] templates/page.xml:100:5");
 * // { file: "templates/page.xml", line: 100, column: 5, format: "qweb" }
 * ```
 */
export class ErrorLocationExtractor {
  /**
   * Extract location from an error message.
   * Returns the first match with highest confidence.
   */
  extract(errorMessage: string): ErrorLocation {
    for (const patternDef of LOCATION_PATTERNS) {
      const match = errorMessage.match(patternDef.pattern);
      if (match) {
        const extracted = patternDef.extract(match);
        return {
          file: extracted.file ?? null,
          line: extracted.line ?? null,
          column: extracted.column ?? null,
          endLine: extracted.endLine ?? null,
          endColumn: extracted.endColumn ?? null,
          format: patternDef.format,
          confidence: patternDef.confidence,
        };
      }
    }

    return {
      file: null,
      line: null,
      column: null,
      endLine: null,
      endColumn: null,
      format: "unknown",
      confidence: "low",
    };
  }

  /**
   * Extract all locations from an error message (for stack traces).
   */
  extractAll(errorMessage: string): ErrorLocation[] {
    const locations: ErrorLocation[] = [];
    const seen = new Set<string>();

    for (const patternDef of LOCATION_PATTERNS) {
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags + "g");
      let match;

      while ((match = regex.exec(errorMessage)) !== null) {
        const extracted = patternDef.extract(match);
        const key = `${extracted.file}:${extracted.line}:${extracted.column}`;

        if (!seen.has(key)) {
          seen.add(key);
          locations.push({
            file: extracted.file ?? null,
            line: extracted.line ?? null,
            column: extracted.column ?? null,
            endLine: extracted.endLine ?? null,
            endColumn: extracted.endColumn ?? null,
            format: patternDef.format,
            confidence: patternDef.confidence,
          });
        }
      }
    }

    // Sort by confidence (high first) then by line number
    return locations.sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      return (a.line ?? 0) - (b.line ?? 0);
    });
  }

  /**
   * Extract location for a specific format.
   */
  extractForFormat(errorMessage: string, format: ErrorFormat): ErrorLocation | null {
    for (const patternDef of LOCATION_PATTERNS) {
      if (patternDef.format !== format) continue;

      const match = errorMessage.match(patternDef.pattern);
      if (match) {
        const extracted = patternDef.extract(match);
        return {
          file: extracted.file ?? null,
          line: extracted.line ?? null,
          column: extracted.column ?? null,
          endLine: extracted.endLine ?? null,
          endColumn: extracted.endColumn ?? null,
          format: patternDef.format,
          confidence: patternDef.confidence,
        };
      }
    }

    return null;
  }

  /**
   * Check if an error message contains extractable location info.
   */
  hasLocation(errorMessage: string): boolean {
    const location = this.extract(errorMessage);
    return location.file !== null || location.line !== null;
  }

  /**
   * Format a location for display.
   */
  formatLocation(location: ErrorLocation): string {
    if (!location.file && !location.line) {
      return "(unknown location)";
    }

    let result = location.file || "(unknown file)";

    if (location.line != null) {
      result += `:${location.line}`;
      if (location.column != null) {
        result += `:${location.column}`;
      }
    }

    return result;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ErrorLocationExtractor instance.
 */
export function createErrorLocationExtractor(): ErrorLocationExtractor {
  return new ErrorLocationExtractor();
}

/**
 * Quick extraction of location from an error message.
 */
export function extractErrorLocation(errorMessage: string): ErrorLocation {
  const extractor = new ErrorLocationExtractor();
  return extractor.extract(errorMessage);
}

/**
 * Extract all locations from an error message (for stack traces).
 */
export function extractAllErrorLocations(errorMessage: string): ErrorLocation[] {
  const extractor = new ErrorLocationExtractor();
  return extractor.extractAll(errorMessage);
}

/**
 * Extract location for a specific format.
 */
export function extractLocationForFormat(
  errorMessage: string,
  format: ErrorFormat
): ErrorLocation | null {
  const extractor = new ErrorLocationExtractor();
  return extractor.extractForFormat(errorMessage, format);
}

/**
 * Check if an error message contains extractable location.
 */
export function hasErrorLocation(errorMessage: string): boolean {
  const extractor = new ErrorLocationExtractor();
  return extractor.hasLocation(errorMessage);
}

/**
 * Format a location for display.
 */
export function formatErrorLocation(location: ErrorLocation): string {
  const extractor = new ErrorLocationExtractor();
  return extractor.formatLocation(location);
}
