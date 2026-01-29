/**
 * Error Context Extractor — Surrounding Code Lines
 *
 * Extracts surrounding code lines around an error location
 * to provide context for debugging.
 */

// =============================================================================
// Types
// =============================================================================

/** A single line of code with metadata */
export interface CodeLine {
  /** Line number (1-based) */
  lineNumber: number;
  /** Line content */
  content: string;
  /** Whether this is the error line */
  isErrorLine: boolean;
}

/** Extracted error context */
export interface ErrorContext {
  /** File path */
  filePath: string;
  /** Error line number (1-based) */
  errorLine: number;
  /** Error column (1-based, optional) */
  errorColumn?: number;
  /** Lines before the error */
  linesBefore: CodeLine[];
  /** The error line itself */
  errorLineContent: CodeLine;
  /** Lines after the error */
  linesAfter: CodeLine[];
  /** All context lines combined */
  allLines: CodeLine[];
  /** Total context size (lines before + error + lines after) */
  contextSize: number;
}

/** Configuration for context extraction */
export interface ContextExtractionConfig {
  /** Number of lines to include before error (default: 5) */
  linesBefore?: number;
  /** Number of lines to include after error (default: 5) */
  linesAfter?: number;
  /** Whether to trim empty lines at edges */
  trimEmptyEdges?: boolean;
  /** Maximum line length before truncation */
  maxLineLength?: number;
  /** Tab size for display (default: 2) */
  tabSize?: number;
}

/** Source location for an error */
export interface ErrorLocation {
  /** File path */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_CONFIG: Required<ContextExtractionConfig> = {
  linesBefore: 5,
  linesAfter: 5,
  trimEmptyEdges: false,
  maxLineLength: 200,
  tabSize: 2,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extracts error context from source code.
 */
export function extractErrorContext(
  source: string,
  errorLine: number,
  config: ContextExtractionConfig = {}
): Omit<ErrorContext, "filePath" | "errorColumn"> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const lines = source.split("\n");

  // Validate error line
  if (errorLine < 1 || errorLine > lines.length) {
    throw new Error(
      `Error line ${errorLine} is out of range (1-${lines.length})`
    );
  }

  const errorLineIndex = errorLine - 1; // Convert to 0-based

  // Calculate range
  const startIndex = Math.max(0, errorLineIndex - mergedConfig.linesBefore);
  const endIndex = Math.min(
    lines.length - 1,
    errorLineIndex + mergedConfig.linesAfter
  );

  // Build context lines
  const linesBefore: CodeLine[] = [];
  const linesAfter: CodeLine[] = [];
  let errorLineContent: CodeLine | null = null;

  for (let i = startIndex; i <= endIndex; i++) {
    const lineContent = processLine(lines[i], mergedConfig);
    const codeLine: CodeLine = {
      lineNumber: i + 1, // Convert back to 1-based
      content: lineContent,
      isErrorLine: i === errorLineIndex,
    };

    if (i < errorLineIndex) {
      linesBefore.push(codeLine);
    } else if (i === errorLineIndex) {
      errorLineContent = codeLine;
    } else {
      linesAfter.push(codeLine);
    }
  }

  if (!errorLineContent) {
    throw new Error("Failed to extract error line");
  }

  const allLines = [...linesBefore, errorLineContent, ...linesAfter];

  return {
    errorLine,
    linesBefore,
    errorLineContent,
    linesAfter,
    allLines,
    contextSize: allLines.length,
  };
}

/**
 * Processes a single line according to config.
 */
export function processLine(
  line: string,
  config: Required<ContextExtractionConfig>
): string {
  // Replace tabs with spaces
  let processed = line.replace(/\t/g, " ".repeat(config.tabSize));

  // Truncate if too long
  if (processed.length > config.maxLineLength) {
    processed = processed.substring(0, config.maxLineLength - 3) + "...";
  }

  return processed;
}

/**
 * Extracts context from file content with full location info.
 */
export function extractContextFromFile(
  filePath: string,
  fileContent: string,
  location: { line: number; column?: number },
  config: ContextExtractionConfig = {}
): ErrorContext {
  const baseContext = extractErrorContext(fileContent, location.line, config);

  return {
    filePath,
    errorColumn: location.column,
    ...baseContext,
  };
}

/**
 * Formats error context for display.
 */
export function formatErrorContext(
  context: ErrorContext,
  options: {
    showLineNumbers?: boolean;
    highlightError?: boolean;
    gutterWidth?: number;
  } = {}
): string {
  const { showLineNumbers = true, highlightError = true, gutterWidth } = options;

  // Calculate gutter width based on max line number
  const maxLineNum = Math.max(...context.allLines.map((l) => l.lineNumber));
  const gutter = gutterWidth ?? String(maxLineNum).length;

  const lines: string[] = [];

  // Add file header
  lines.push(`File: ${context.filePath}`);
  lines.push("─".repeat(40));

  for (const line of context.allLines) {
    const lineNumStr = showLineNumbers
      ? String(line.lineNumber).padStart(gutter, " ") + " │ "
      : "";

    const marker = line.isErrorLine && highlightError ? "→ " : "  ";
    lines.push(`${marker}${lineNumStr}${line.content}`);

    // Add column indicator for error line
    if (line.isErrorLine && context.errorColumn && highlightError) {
      const columnOffset = lineNumStr.length + marker.length + context.errorColumn - 1;
      lines.push(" ".repeat(columnOffset) + "^");
    }
  }

  lines.push("─".repeat(40));

  return lines.join("\n");
}

/**
 * Formats context as a code block (for markdown/display).
 */
export function formatAsCodeBlock(
  context: ErrorContext,
  language?: string
): string {
  const lines: string[] = [];
  const maxLineNum = Math.max(...context.allLines.map((l) => l.lineNumber));
  const gutter = String(maxLineNum).length;

  for (const line of context.allLines) {
    const lineNum = String(line.lineNumber).padStart(gutter, " ");
    const marker = line.isErrorLine ? ">" : " ";
    lines.push(`${marker} ${lineNum} | ${line.content}`);
  }

  const lang = language || detectLanguage(context.filePath);
  return "```" + lang + "\n" + lines.join("\n") + "\n```";
}

/**
 * Detects language from file path.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    java: "java",
    go: "go",
    rs: "rust",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
  };

  return languageMap[ext] || "";
}

/**
 * Gets the context window size (total lines).
 */
export function getContextWindowSize(config: ContextExtractionConfig = {}): number {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return mergedConfig.linesBefore + 1 + mergedConfig.linesAfter;
}

/**
 * Extracts multiple error contexts from the same source.
 */
export function extractMultipleContexts(
  source: string,
  errorLines: number[],
  config: ContextExtractionConfig = {}
): Omit<ErrorContext, "filePath" | "errorColumn">[] {
  return errorLines.map((line) => extractErrorContext(source, line, config));
}

/**
 * Checks if two contexts overlap.
 */
export function contextsOverlap(
  context1: ErrorContext,
  context2: ErrorContext
): boolean {
  const start1 = context1.allLines[0]?.lineNumber ?? 0;
  const end1 = context1.allLines[context1.allLines.length - 1]?.lineNumber ?? 0;
  const start2 = context2.allLines[0]?.lineNumber ?? 0;
  const end2 = context2.allLines[context2.allLines.length - 1]?.lineNumber ?? 0;

  return !(end1 < start2 || end2 < start1);
}

/**
 * Merges overlapping contexts into one.
 */
export function mergeContexts(
  contexts: ErrorContext[]
): ErrorContext | null {
  if (contexts.length === 0) return null;
  if (contexts.length === 1) return contexts[0];

  // Sort by first line number
  const sorted = [...contexts].sort(
    (a, b) => (a.allLines[0]?.lineNumber ?? 0) - (b.allLines[0]?.lineNumber ?? 0)
  );

  // Merge all lines, removing duplicates
  const lineMap = new Map<number, CodeLine>();
  for (const ctx of sorted) {
    for (const line of ctx.allLines) {
      if (!lineMap.has(line.lineNumber)) {
        lineMap.set(line.lineNumber, line);
      } else if (line.isErrorLine) {
        // Preserve error line status
        lineMap.set(line.lineNumber, line);
      }
    }
  }

  const allLines = Array.from(lineMap.values()).sort(
    (a, b) => a.lineNumber - b.lineNumber
  );

  const errorLines = allLines.filter((l) => l.isErrorLine);
  const firstErrorLine = errorLines[0];

  if (!firstErrorLine) {
    return null;
  }

  const errorLineIndex = allLines.indexOf(firstErrorLine);

  return {
    filePath: sorted[0].filePath,
    errorLine: firstErrorLine.lineNumber,
    errorColumn: sorted[0].errorColumn,
    linesBefore: allLines.slice(0, errorLineIndex),
    errorLineContent: firstErrorLine,
    linesAfter: allLines.slice(errorLineIndex + 1),
    allLines,
    contextSize: allLines.length,
  };
}

// =============================================================================
// ErrorContextExtractor Class
// =============================================================================

/**
 * Service for extracting error context from source code.
 */
export class ErrorContextExtractor {
  private config: Required<ContextExtractionConfig>;
  private cache: Map<string, ErrorContext> = new Map();

  constructor(config: ContextExtractionConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extracts context for an error location.
   */
  extract(
    filePath: string,
    fileContent: string,
    location: { line: number; column?: number }
  ): ErrorContext {
    const cacheKey = `${filePath}:${location.line}:${location.column || 0}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const context = extractContextFromFile(
      filePath,
      fileContent,
      location,
      this.config
    );

    this.cache.set(cacheKey, context);
    return context;
  }

  /**
   * Extracts context for multiple locations in the same file.
   */
  extractMultiple(
    filePath: string,
    fileContent: string,
    locations: { line: number; column?: number }[]
  ): ErrorContext[] {
    return locations.map((loc) => this.extract(filePath, fileContent, loc));
  }

  /**
   * Formats context for display.
   */
  format(context: ErrorContext): string {
    return formatErrorContext(context);
  }

  /**
   * Formats context as code block.
   */
  formatCodeBlock(context: ErrorContext, language?: string): string {
    return formatAsCodeBlock(context, language);
  }

  /**
   * Clears the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): Required<ContextExtractionConfig> {
    return { ...this.config };
  }

  /**
   * Updates the configuration.
   */
  updateConfig(config: ContextExtractionConfig): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ErrorContextExtractor instance.
 */
export function createErrorContextExtractor(
  config?: ContextExtractionConfig
): ErrorContextExtractor {
  return new ErrorContextExtractor(config);
}

/**
 * Creates a context with default 5 lines before and after.
 */
export function createDefaultContext(
  filePath: string,
  fileContent: string,
  errorLine: number,
  errorColumn?: number
): ErrorContext {
  return extractContextFromFile(filePath, fileContent, {
    line: errorLine,
    column: errorColumn,
  });
}
