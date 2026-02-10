/**
 * Build Process Error Capture — Missing Files, Import Errors, Manifest Issues
 *
 * Captures and categorizes build-time errors including file not found,
 * import resolution failures, and manifest parsing errors.
 */

// =============================================================================
// Types
// =============================================================================

/** Build error types */
export type BuildErrorType =
  | "file_not_found"
  | "import_resolution"
  | "manifest_error"
  | "syntax_error"
  | "compilation_error"
  | "dependency_error"
  | "permission_error"
  | "unknown";

/** Build error severity */
export type BuildErrorSeverity = "warning" | "error" | "fatal";

/** Captured build error */
export interface BuildError {
  /** Unique error ID */
  id: string;
  /** Error type */
  type: BuildErrorType;
  /** Error severity */
  severity: BuildErrorSeverity;
  /** Error message */
  message: string;
  /** Source file path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Missing file or import path */
  missingPath?: string;
  /** Stack trace or additional context */
  details?: string;
  /** Timestamp */
  timestamp: Date;
  /** Suggested fix */
  suggestion?: string;
}

/** Build error detection pattern */
export interface ErrorPattern {
  /** Pattern to match against error output */
  pattern: RegExp;
  /** Error type to assign */
  type: BuildErrorType;
  /** Severity level */
  severity: BuildErrorSeverity;
  /** Function to extract details from match */
  extract?: (match: RegExpMatchArray) => Partial<BuildError>;
}

/** Build error capture configuration */
export interface BuildErrorConfig {
  /** Custom error patterns */
  customPatterns?: ErrorPattern[];
  /** Maximum errors to buffer */
  maxBufferSize?: number;
  /** Whether to capture warnings */
  captureWarnings?: boolean;
}

/** Build error listener */
export type BuildErrorListener = (error: BuildError) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_BUILD_CONFIG: Required<BuildErrorConfig> = {
  customPatterns: [],
  maxBufferSize: 100,
  captureWarnings: true,
};

/** File not found error patterns */
export const FILE_NOT_FOUND_PATTERNS: ErrorPattern[] = [
  {
    pattern: /FileNotFoundError:\s*(?:\[Errno \d+\])?\s*(?:No such file or directory:\s*)?['"]?([^'"]+)['"]?/i,
    type: "file_not_found",
    severity: "error",
    extract: (m) => ({ missingPath: m[1], file: m[1] }),
  },
  {
    pattern: /ENOENT:\s*no such file or directory,\s*\w+\s*'([^']+)'/i,
    type: "file_not_found",
    severity: "error",
    extract: (m) => ({ missingPath: m[1], file: m[1] }),
  },
  {
    pattern: /(?:Error:\s*)?Cannot find (?:module|file)\s*['"]([^'"]+)['"]/i,
    type: "file_not_found",
    severity: "error",
    extract: (m) => ({ missingPath: m[1] }),
  },
  {
    pattern: /File\s*['"]([^'"]+)['"]\s*(?:does not exist|not found|missing)/i,
    type: "file_not_found",
    severity: "error",
    extract: (m) => ({ missingPath: m[1], file: m[1] }),
  },
];

/** Import resolution error patterns */
export const IMPORT_RESOLUTION_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ImportError:\s*(?:No module named|cannot import name)\s*['"]?([^'"\s]+)['"]?/i,
    type: "import_resolution",
    severity: "error",
    extract: (m) => ({ missingPath: m[1]?.trim() }),
  },
  {
    pattern: /ModuleNotFoundError:\s*No module named\s*['"]?([^'"\s]+)['"]?/i,
    type: "import_resolution",
    severity: "error",
    extract: (m) => ({ missingPath: m[1]?.trim() }),
  },
  {
    pattern: /Cannot resolve (?:module|dependency)\s*['"]?([^'"]+)['"]?/i,
    type: "import_resolution",
    severity: "error",
    extract: (m) => ({ missingPath: m[1]?.trim() }),
  },
  {
    pattern: /Module not found:\s*(?:Error:)?\s*Can't resolve\s*['"]([^'"]+)['"]\s*in\s*['"]([^'"]+)['"]/i,
    type: "import_resolution",
    severity: "error",
    extract: (m) => ({ missingPath: m[1], file: m[2] }),
  },
  {
    pattern: /from\s*['"]([^'"]+)['"]\s*could not be resolved/i,
    type: "import_resolution",
    severity: "error",
    extract: (m) => ({ missingPath: m[1] }),
  },
];

/** Manifest error patterns */
export const MANIFEST_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /(?:Invalid|Malformed)\s*(?:JSON\s*)?manifest/i,
    type: "manifest_error",
    severity: "error",
  },
  {
    pattern: /__manifest__\.py.*(?:SyntaxError|NameError|KeyError):\s*(.+)/i,
    type: "manifest_error",
    severity: "error",
    extract: (m) => ({ details: m[1] }),
  },
  {
    pattern: /manifest\s+missing\s+(?:required\s+)?(?:key|field)\s*['"]?(\w+)['"]?/i,
    type: "manifest_error",
    severity: "error",
    extract: (m) => ({ details: m[1] ? `Missing required field: ${m[1]}` : "Missing required field" }),
  },
  {
    pattern: /(?:package|composer|cargo)\.(?:json|toml|lock).*(?:parse|syntax)\s*error/i,
    type: "manifest_error",
    severity: "error",
  },
  {
    pattern: /assets.*manifest.*(?:not found|missing|invalid)/i,
    type: "manifest_error",
    severity: "error",
  },
];

/** Syntax error patterns */
export const SYNTAX_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /SyntaxError:\s*(.+?)\s+at\s+['"]?([^'":\s]+)['"]?\s+line\s+(\d+)/i,
    type: "syntax_error",
    severity: "error",
    extract: (m) => ({ message: m[1], file: m[2], line: parseInt(m[3]) }),
  },
  {
    // SyntaxError with file location (at/in 'file') - NOT optional
    pattern: /SyntaxError:\s*(.+?)\s+(?:at|in)\s+['"]([^'"]+)['"]/i,
    type: "syntax_error",
    severity: "error",
    extract: (m) => ({ message: m[1], file: m[2] }),
  },
  {
    // SyntaxError without file location - fallback pattern
    pattern: /SyntaxError:\s*(.+)/i,
    type: "syntax_error",
    severity: "error",
    extract: (m) => ({ message: m[1] }),
  },
  {
    pattern: /(?:Parse|Parsing)\s*error:\s*(.+?)\s*(?:in|at)\s*['"]?([^'":\n]+)['"]?(?::(\d+))?/i,
    type: "syntax_error",
    severity: "error",
    extract: (m) => ({ message: m[1], file: m[2], line: m[3] ? parseInt(m[3]) : undefined }),
  },
  {
    pattern: /Unexpected token\s*['"]?([^'"]+)['"]?\s*(?:in|at)?\s*['"]?([^'":\n]+)['"]?(?::(\d+))?/i,
    type: "syntax_error",
    severity: "error",
    extract: (m) => ({ message: `Unexpected token: ${m[1]}`, file: m[2], line: m[3] ? parseInt(m[3]) : undefined }),
  },
];

/** Compilation error patterns */
export const COMPILATION_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /(?:Compilation|Build)\s*(?:failed|error):\s*(.+)/i,
    type: "compilation_error",
    severity: "error",
    extract: (m) => ({ details: m[1] }),
  },
  {
    pattern: /SCSS\s*(?:Error|error):\s*(.+?)\s+in\s+['"]?([^'":\s]+)['"]?:(\d+)/i,
    type: "compilation_error",
    severity: "error",
    extract: (m) => ({ message: m[1], file: m[2], line: parseInt(m[3]) }),
  },
  {
    pattern: /SCSS\s*(?:Error|error):\s*(.+?)\s+(?:in|on line)\s+['"]?([^'"]+)['"]?/i,
    type: "compilation_error",
    severity: "error",
    extract: (m) => ({ message: m[1], file: m[2] }),
  },
  {
    pattern: /(?:TypeScript|tsc)\s*error\s*TS(\d+):\s*(.+)/i,
    type: "compilation_error",
    severity: "error",
    extract: (m) => ({ message: `TS${m[1]}: ${m[2]}` }),
  },
];

/** All built-in patterns */
export const ALL_ERROR_PATTERNS: ErrorPattern[] = [
  ...FILE_NOT_FOUND_PATTERNS,
  ...IMPORT_RESOLUTION_PATTERNS,
  ...MANIFEST_ERROR_PATTERNS,
  ...SYNTAX_ERROR_PATTERNS,
  ...COMPILATION_ERROR_PATTERNS,
];

/** Error type display configuration */
export const ERROR_TYPE_CONFIG: Record<
  BuildErrorType,
  { label: string; icon: string; color: string }
> = {
  file_not_found: { label: "File Not Found", icon: "file-x", color: "text-red-500" },
  import_resolution: { label: "Import Error", icon: "package-x", color: "text-orange-500" },
  manifest_error: { label: "Manifest Error", icon: "file-warning", color: "text-amber-500" },
  syntax_error: { label: "Syntax Error", icon: "code", color: "text-red-500" },
  compilation_error: { label: "Compilation Error", icon: "hammer", color: "text-red-600" },
  dependency_error: { label: "Dependency Error", icon: "puzzle", color: "text-purple-500" },
  permission_error: { label: "Permission Error", icon: "lock", color: "text-yellow-500" },
  unknown: { label: "Unknown Error", icon: "alert-circle", color: "text-gray-500" },
};

// =============================================================================
// Helper Functions
// =============================================================================

let errorIdCounter = 0;

/**
 * Generates a unique build error ID.
 */
export function generateBuildErrorId(): string {
  return `build-err-${Date.now()}-${++errorIdCounter}`;
}

/**
 * Resets the error ID counter (for testing).
 */
export function resetBuildErrorIdCounter(): void {
  errorIdCounter = 0;
}

/**
 * Parses build output to extract errors.
 */
export function parseBuildOutput(
  output: string,
  patterns: ErrorPattern[] = ALL_ERROR_PATTERNS
): BuildError[] {
  const errors: BuildError[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern.pattern);
      if (match) {
        const extracted = pattern.extract ? pattern.extract(match) : {};
        const error: BuildError = {
          id: generateBuildErrorId(),
          type: pattern.type,
          severity: pattern.severity,
          message: extracted.message || match[0],
          timestamp: new Date(),
          ...extracted,
        };

        // Add suggestion based on error type
        error.suggestion = generateSuggestion(error);

        errors.push(error);
        break; // Only match first pattern per line
      }
    }
  }

  return errors;
}

/**
 * Generates a fix suggestion for an error.
 */
export function generateSuggestion(error: BuildError): string | undefined {
  switch (error.type) {
    case "file_not_found":
      return error.missingPath
        ? `Check if the file "${error.missingPath}" exists and the path is correct.`
        : "Verify that all referenced files exist.";

    case "import_resolution":
      return error.missingPath
        ? `Install the missing module with: pip install ${error.missingPath} or npm install ${error.missingPath}`
        : "Check that all dependencies are installed.";

    case "manifest_error":
      return "Verify the manifest file syntax and required fields.";

    case "syntax_error":
      return error.line
        ? `Check the syntax at line ${error.line}.`
        : "Review the file for syntax errors.";

    case "compilation_error":
      return "Review the compilation output for specific errors.";

    default:
      return undefined;
  }
}

/**
 * Checks if output contains a file not found error.
 */
export function hasFileNotFoundError(output: string): boolean {
  return FILE_NOT_FOUND_PATTERNS.some((p) => p.pattern.test(output));
}

/**
 * Checks if output contains an import resolution error.
 */
export function hasImportResolutionError(output: string): boolean {
  return IMPORT_RESOLUTION_PATTERNS.some((p) => p.pattern.test(output));
}

/**
 * Checks if output contains a manifest error.
 */
export function hasManifestError(output: string): boolean {
  return MANIFEST_ERROR_PATTERNS.some((p) => p.pattern.test(output));
}

/**
 * Groups errors by type.
 */
export function groupBuildErrorsByType(
  errors: BuildError[]
): Record<BuildErrorType, BuildError[]> {
  const grouped: Record<BuildErrorType, BuildError[]> = {
    file_not_found: [],
    import_resolution: [],
    manifest_error: [],
    syntax_error: [],
    compilation_error: [],
    dependency_error: [],
    permission_error: [],
    unknown: [],
  };

  for (const error of errors) {
    grouped[error.type].push(error);
  }

  return grouped;
}

/**
 * Gets build error statistics.
 */
export function getBuildErrorStats(errors: BuildError[]): {
  total: number;
  byType: Record<BuildErrorType, number>;
  bySeverity: Record<BuildErrorSeverity, number>;
  hasBlockingErrors: boolean;
} {
  const stats = {
    total: errors.length,
    byType: {} as Record<BuildErrorType, number>,
    bySeverity: { warning: 0, error: 0, fatal: 0 },
    hasBlockingErrors: false,
  };

  for (const type of Object.keys(ERROR_TYPE_CONFIG) as BuildErrorType[]) {
    stats.byType[type] = 0;
  }

  for (const error of errors) {
    stats.byType[error.type]++;
    stats.bySeverity[error.severity]++;
    if (error.severity === "error" || error.severity === "fatal") {
      stats.hasBlockingErrors = true;
    }
  }

  return stats;
}

/**
 * Formats a build error for display.
 */
export function formatBuildError(error: BuildError): string {
  const parts = [
    `[${error.severity.toUpperCase()}] ${ERROR_TYPE_CONFIG[error.type].label}: ${error.message}`,
  ];

  if (error.file) {
    let location = `  at ${error.file}`;
    if (error.line !== undefined) {
      location += `:${error.line}`;
      if (error.column !== undefined) {
        location += `:${error.column}`;
      }
    }
    parts.push(location);
  }

  if (error.suggestion) {
    parts.push(`  → ${error.suggestion}`);
  }

  return parts.join("\n");
}

// =============================================================================
// BuildErrorCapture Class
// =============================================================================

/**
 * Service for capturing and managing build process errors.
 */
export class BuildErrorCapture {
  private config: Required<BuildErrorConfig>;
  private errors: BuildError[] = [];
  private listeners: Set<BuildErrorListener> = new Set();
  private patterns: ErrorPattern[];

  constructor(config: BuildErrorConfig = {}) {
    this.config = { ...DEFAULT_BUILD_CONFIG, ...config };
    this.patterns = [...ALL_ERROR_PATTERNS, ...this.config.customPatterns];
  }

  /**
   * Gets all captured errors.
   */
  getErrors(): BuildError[] {
    return [...this.errors];
  }

  /**
   * Gets errors filtered by severity.
   */
  getErrorsBySeverity(severity: BuildErrorSeverity): BuildError[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  /**
   * Gets errors filtered by type.
   */
  getErrorsByType(type: BuildErrorType): BuildError[] {
    return this.errors.filter((e) => e.type === type);
  }

  /**
   * Clears all captured errors.
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Adds an error listener.
   */
  addListener(listener: BuildErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Removes an error listener.
   */
  removeListener(listener: BuildErrorListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Processes build output and captures errors.
   */
  processBuildOutput(output: string): BuildError[] {
    const newErrors = parseBuildOutput(output, this.patterns);

    for (const error of newErrors) {
      // Skip warnings if not configured to capture them
      if (error.severity === "warning" && !this.config.captureWarnings) {
        continue;
      }

      // Add to buffer with size limit
      if (this.errors.length >= this.config.maxBufferSize) {
        this.errors.shift();
      }
      this.errors.push(error);

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(error);
        } catch (err) {
          console.error("Build error listener failed:", err);
        }
      }
    }

    return newErrors;
  }

  /**
   * Manually adds an error.
   */
  addError(error: BuildError): void {
    if (this.errors.length >= this.config.maxBufferSize) {
      this.errors.shift();
    }
    this.errors.push(error);

    for (const listener of this.listeners) {
      try {
        listener(error);
      } catch (err) {
        console.error("Build error listener failed:", err);
      }
    }
  }

  /**
   * Gets error statistics.
   */
  getStats(): ReturnType<typeof getBuildErrorStats> {
    return getBuildErrorStats(this.errors);
  }

  /**
   * Checks if there are blocking errors.
   */
  hasBlockingErrors(): boolean {
    return this.errors.some((e) => e.severity === "error" || e.severity === "fatal");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a BuildErrorCapture instance.
 */
export function createBuildErrorCapture(
  config?: BuildErrorConfig
): BuildErrorCapture {
  return new BuildErrorCapture(config);
}

/**
 * Creates a mock build error for testing.
 */
export function createMockBuildError(
  overrides: Partial<BuildError> = {}
): BuildError {
  return {
    id: generateBuildErrorId(),
    type: "file_not_found",
    severity: "error",
    message: "Test build error",
    timestamp: new Date(),
    ...overrides,
  };
}
