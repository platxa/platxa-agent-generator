/**
 * VS Code Diagnostics Adapter
 *
 * Converts normalized debug errors to VS Code diagnostic format
 * for IDE integration.
 *
 * Features #31-35: VS Code diagnostics integration
 *
 * @module adapters/vscode-diagnostics
 */

// =============================================================================
// Types
// =============================================================================

/**
 * VS Code diagnostic severity levels
 */
export enum VSCodeDiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

/**
 * VS Code position (0-based)
 */
export interface VSCodePosition {
  /** Line number (0-based) */
  line: number;
  /** Character offset (0-based) */
  character: number;
}

/**
 * VS Code range
 */
export interface VSCodeRange {
  /** Start position */
  start: VSCodePosition;
  /** End position */
  end: VSCodePosition;
}

/**
 * VS Code diagnostic related information
 */
export interface VSCodeDiagnosticRelatedInformation {
  /** Location of related information */
  location: {
    uri: string;
    range: VSCodeRange;
  };
  /** Description message */
  message: string;
}

/**
 * VS Code diagnostic
 */
export interface VSCodeDiagnostic {
  /** Range in the document */
  range: VSCodeRange;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: VSCodeDiagnosticSeverity;
  /** Identifier for the diagnostic (e.g., rule ID) */
  code?: string | number;
  /** Human-readable source (e.g., 'eslint', 'typescript') */
  source?: string;
  /** Related information */
  relatedInformation?: VSCodeDiagnosticRelatedInformation[];
  /** Tags (e.g., unnecessary, deprecated) */
  tags?: number[];
}

/**
 * Normalized error from our system
 */
export interface NormalizedError {
  /** Error identifier */
  id?: string;
  /** Error message */
  message: string;
  /** Error type/category */
  type?: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info' | 'hint';
  /** Source location */
  location: {
    file: string;
    /** Line number (1-based) */
    line: number;
    /** Column number (1-based, optional) */
    column?: number;
    /** End line (1-based, optional) */
    endLine?: number;
    /** End column (1-based, optional) */
    endColumn?: number;
  };
  /** Stack trace */
  stackTrace?: string;
  /** Rule ID */
  ruleId?: string;
}

/**
 * Stack frame from parsed stack trace
 */
export interface StackFrame {
  /** Function name */
  functionName?: string;
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
}

/**
 * Converter options
 */
export interface VSCodeDiagnosticsOptions {
  /** Source name for diagnostics */
  source?: string;
  /** Whether to include related information from stack traces */
  includeRelatedInfo?: boolean;
  /** Maximum stack frames to include as related info */
  maxRelatedFrames?: number;
  /** Custom severity mapping */
  severityMapping?: Partial<Record<'error' | 'warning' | 'info' | 'hint', VSCodeDiagnosticSeverity>>;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<VSCodeDiagnosticsOptions> = {
  source: 'platxa-debug',
  includeRelatedInfo: true,
  maxRelatedFrames: 5,
  severityMapping: {},
};

// =============================================================================
// VS Code Diagnostics Converter
// =============================================================================

/**
 * Converts normalized errors to VS Code diagnostics
 */
export class VSCodeDiagnosticsConverter {
  private options: Required<VSCodeDiagnosticsOptions>;

  constructor(options: VSCodeDiagnosticsOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Main Conversion (Feature #31)
  // ===========================================================================

  /**
   * Convert a normalized error to VS Code diagnostic
   *
   * Feature #31: Convert normalized error to VS Code diagnostic
   */
  convertToDiagnostic(error: NormalizedError): VSCodeDiagnostic {
    // Feature #33: Convert 1-based to 0-based line numbers
    const range = this.createRange(error.location);

    // Feature #32: Map severity correctly
    const severity = this.mapSeverity(error.severity);

    const diagnostic: VSCodeDiagnostic = {
      range,
      message: error.message,
      severity,
      source: this.options.source,
    };

    // Feature #34: Include error type as diagnostic code
    if (error.type) {
      diagnostic.code = error.type;
    } else if (error.ruleId) {
      diagnostic.code = error.ruleId;
    }

    // Feature #35: Include related information from stack trace
    if (this.options.includeRelatedInfo && error.stackTrace) {
      const relatedInfo = this.parseStackTraceToRelatedInfo(error.stackTrace, error.location.file);
      if (relatedInfo.length > 0) {
        diagnostic.relatedInformation = relatedInfo;
      }
    }

    return diagnostic;
  }

  /**
   * Convert multiple normalized errors to VS Code diagnostics
   */
  convertToDiagnostics(errors: NormalizedError[]): VSCodeDiagnostic[] {
    return errors.map((error) => this.convertToDiagnostic(error));
  }

  /**
   * Convert errors and group by file URI
   */
  convertAndGroupByFile(errors: NormalizedError[]): Map<string, VSCodeDiagnostic[]> {
    const grouped = new Map<string, VSCodeDiagnostic[]>();

    for (const error of errors) {
      const uri = this.fileToUri(error.location.file);
      const diagnostic = this.convertToDiagnostic(error);

      if (!grouped.has(uri)) {
        grouped.set(uri, []);
      }
      grouped.get(uri)!.push(diagnostic);
    }

    return grouped;
  }

  // ===========================================================================
  // Severity Mapping (Feature #32)
  // ===========================================================================

  /**
   * Map our severity to VS Code severity
   *
   * Feature #32: error->Error, warning->Warning, info->Information, hint->Hint
   */
  mapSeverity(severity: 'error' | 'warning' | 'info' | 'hint'): VSCodeDiagnosticSeverity {
    // Check custom mapping first
    const customMapping = this.options.severityMapping[severity];
    if (customMapping !== undefined) {
      return customMapping;
    }

    // Default mapping
    switch (severity) {
      case 'error':
        return VSCodeDiagnosticSeverity.Error;
      case 'warning':
        return VSCodeDiagnosticSeverity.Warning;
      case 'info':
        return VSCodeDiagnosticSeverity.Information;
      case 'hint':
        return VSCodeDiagnosticSeverity.Hint;
      default:
        return VSCodeDiagnosticSeverity.Warning;
    }
  }

  // ===========================================================================
  // Range Creation (Feature #33)
  // ===========================================================================

  /**
   * Create VS Code range from source location
   *
   * Feature #33: Convert 1-based line numbers to 0-based
   */
  createRange(location: NormalizedError['location']): VSCodeRange {
    // Convert from 1-based (source) to 0-based (VS Code)
    const startLine = Math.max(0, location.line - 1);
    const startChar = Math.max(0, (location.column ?? 1) - 1);

    const endLine = location.endLine !== undefined
      ? Math.max(0, location.endLine - 1)
      : startLine;
    const endChar = location.endColumn !== undefined
      ? Math.max(0, location.endColumn - 1)
      : startChar + 1; // Default to 1 character width

    return {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };
  }

  // ===========================================================================
  // Stack Trace Parsing (Feature #35)
  // ===========================================================================

  /**
   * Parse stack trace to related information
   *
   * Feature #35: Include related information from stack trace frames
   */
  parseStackTraceToRelatedInfo(
    stackTrace: string,
    originalFile: string
  ): VSCodeDiagnosticRelatedInformation[] {
    const frames = this.parseStackTrace(stackTrace);
    const relatedInfo: VSCodeDiagnosticRelatedInformation[] = [];

    for (const frame of frames.slice(0, this.options.maxRelatedFrames)) {
      // Skip frames in the same file at the same location as the error
      if (frame.file === originalFile) {
        continue;
      }

      const location: NormalizedError['location'] = {
        file: frame.file,
        line: frame.line,
      };
      if (frame.column !== undefined) {
        location.column = frame.column;
      }
      const range = this.createRange(location);

      relatedInfo.push({
        location: {
          uri: this.fileToUri(frame.file),
          range,
        },
        message: frame.functionName
          ? `Called from ${frame.functionName}`
          : `at ${frame.file}:${frame.line}`,
      });
    }

    return relatedInfo;
  }

  /**
   * Parse a stack trace string into stack frames
   */
  parseStackTrace(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Common stack trace patterns
    const v8Pattern = /^\s*at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?$/;
    const firefoxPattern = /^(.+)@(.+):(\d+):(\d+)$/;
    const simplePattern = /^(.+?):(\d+)(?::(\d+))?$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try V8/Node.js format: "at functionName (file:line:column)"
      let match = trimmed.match(v8Pattern);
      if (match) {
        const frame: StackFrame = {
          file: match[2] ?? '',
          line: parseInt(match[3] ?? '0', 10),
        };
        if (match[1]) frame.functionName = match[1];
        if (match[4]) frame.column = parseInt(match[4], 10);
        if (frame.file && frame.line > 0) {
          frames.push(frame);
        }
        continue;
      }

      // Try Firefox format: "functionName@file:line:column"
      match = trimmed.match(firefoxPattern);
      if (match) {
        const frame: StackFrame = {
          file: match[2] ?? '',
          line: parseInt(match[3] ?? '0', 10),
        };
        if (match[1]) frame.functionName = match[1];
        if (match[4]) frame.column = parseInt(match[4], 10);
        if (frame.file && frame.line > 0) {
          frames.push(frame);
        }
        continue;
      }

      // Try simple format: "file:line:column"
      match = trimmed.match(simplePattern);
      if (match) {
        const frame: StackFrame = {
          file: match[1] ?? '',
          line: parseInt(match[2] ?? '0', 10),
        };
        if (match[3]) frame.column = parseInt(match[3], 10);
        if (frame.file && frame.line > 0) {
          frames.push(frame);
        }
      }
    }

    return frames;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Convert file path to URI
   */
  fileToUri(filePath: string): string {
    // Handle Windows paths
    if (filePath.match(/^[a-zA-Z]:\\/)) {
      return `file:///${filePath.replace(/\\/g, '/')}`;
    }

    // Handle absolute paths
    if (filePath.startsWith('/')) {
      return `file://${filePath}`;
    }

    // Relative paths - return as-is (will be resolved by VS Code)
    return filePath;
  }

  /**
   * Convert URI back to file path
   */
  uriToFile(uri: string): string {
    if (uri.startsWith('file:///')) {
      // Windows path
      const path = uri.slice(8);
      return path.replace(/\//g, '\\');
    }

    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }

    return uri;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a VS Code diagnostics converter
 */
export function createVSCodeDiagnosticsConverter(
  options?: VSCodeDiagnosticsOptions
): VSCodeDiagnosticsConverter {
  return new VSCodeDiagnosticsConverter(options);
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Convert a single error to VS Code diagnostic
 */
export function convertToDiagnostic(
  error: NormalizedError,
  options?: VSCodeDiagnosticsOptions
): VSCodeDiagnostic {
  const converter = new VSCodeDiagnosticsConverter(options);
  return converter.convertToDiagnostic(error);
}

/**
 * Convert multiple errors to VS Code diagnostics
 */
export function convertToDiagnostics(
  errors: NormalizedError[],
  options?: VSCodeDiagnosticsOptions
): VSCodeDiagnostic[] {
  const converter = new VSCodeDiagnosticsConverter(options);
  return converter.convertToDiagnostics(errors);
}

// =============================================================================
// Default Instance
// =============================================================================

/** Default VS Code diagnostics converter */
export const vscodeDiagnosticsConverter = new VSCodeDiagnosticsConverter();
