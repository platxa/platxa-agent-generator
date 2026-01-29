/**
 * Core types for the platxa-debug-agent
 *
 * This module defines the fundamental types used throughout the debugging agent,
 * including error representations, language definitions, and module interfaces.
 */

// =============================================================================
// Language Types
// =============================================================================

/**
 * Supported programming languages and technologies
 */
export type Language =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'scss'
  | 'tailwind'
  | 'html'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'unknown';

/**
 * Language detection confidence level
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Result of language detection
 */
export interface LanguageDetectionResult {
  /** Detected primary language */
  language: Language;
  /** Confidence in the detection */
  confidence: ConfidenceLevel;
  /** Confidence score (0-1) */
  score: number;
  /** Secondary languages detected (e.g., embedded JS in HTML) */
  secondaryLanguages?: Language[];
  /** Detection method used */
  detectionMethod: 'extension' | 'content' | 'shebang' | 'pattern' | 'fallback';
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Severity levels for errors
 */
export type ErrorSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Error source type
 */
export type ErrorSource =
  | 'exception'      // Runtime exception/traceback
  | 'static'         // Static analysis (linter, type checker)
  | 'runtime'        // Runtime error (not exception)
  | 'build'          // Build/compilation error
  | 'test'           // Test failure
  | 'log'            // Log file entry
  | 'console'        // Console output
  | 'unknown';

/**
 * Location in source code
 */
export interface SourceLocation {
  /** File path (absolute or relative) */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
  /** End line for multi-line spans */
  endLine?: number;
  /** End column for multi-line spans */
  endColumn?: number;
}

/**
 * Stack frame in a stack trace
 */
export interface StackFrame {
  /** Function/method name */
  functionName?: string;
  /** Source location */
  location: SourceLocation;
  /** Raw frame text */
  raw?: string;
  /** Whether this is user code (vs library/framework) */
  isUserCode?: boolean;
}

/**
 * Normalized error format - the unified representation used internally
 */
export interface NormalizedError {
  /** Unique identifier for this error */
  id: string;
  /** Error type/class (e.g., "TypeError", "SyntaxError") */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Source of the error */
  source: ErrorSource;
  /** Detected language */
  language: Language;
  /** Primary location in source code */
  location?: SourceLocation;
  /** Full stack trace (if available) */
  stackTrace?: StackFrame[];
  /** Error code (e.g., "E1001", "TS2322") */
  code?: string;
  /** Additional context/metadata */
  context?: Record<string, unknown>;
  /** Raw original error text */
  raw: string;
  /** Timestamp when error was captured */
  timestamp: Date;
  /** Related errors (e.g., caused by) */
  relatedErrors?: string[];
}

// =============================================================================
// Analysis Types
// =============================================================================

/**
 * Root cause hypothesis
 */
export interface RootCauseHypothesis {
  /** Unique identifier */
  id: string;
  /** Description of the hypothesis */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Supporting evidence */
  evidence: Evidence[];
  /** Suggested fixes */
  suggestedFixes: FixSuggestion[];
  /** Related code locations */
  relatedLocations: SourceLocation[];
}

/**
 * Evidence supporting a hypothesis
 */
export interface Evidence {
  /** Type of evidence */
  type: 'code' | 'error' | 'test' | 'history' | 'pattern' | 'static_analysis';
  /** Description */
  description: string;
  /** Source location if applicable */
  location?: SourceLocation;
  /** Evidence strength (0-1) */
  strength: number;
}

/**
 * Suggested fix for an error
 */
export interface FixSuggestion {
  /** Unique identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Fix type */
  type: 'template' | 'generated' | 'retrieved';
  /** Code changes to apply */
  changes: CodeChange[];
  /** Validation steps */
  validationSteps: ValidationStep[];
}

/**
 * A code change to apply
 */
export interface CodeChange {
  /** File to modify */
  file: string;
  /** Type of change */
  type: 'replace' | 'insert' | 'delete';
  /** Start location */
  start: { line: number; column: number };
  /** End location (for replace/delete) */
  end?: { line: number; column: number };
  /** New content (for replace/insert) */
  newContent?: string;
  /** Original content (for context) */
  originalContent?: string;
}

/**
 * Validation step for a fix
 */
export interface ValidationStep {
  /** Step type */
  type: 'typecheck' | 'lint' | 'test' | 'build' | 'manual';
  /** Command to run (if automated) */
  command?: string;
  /** Description (if manual) */
  description?: string;
  /** Expected outcome */
  expectedOutcome: string;
}

// =============================================================================
// Module Interface Types
// =============================================================================

/**
 * Analysis result from a language module
 */
export interface ModuleAnalysisResult {
  /** Module that produced this result */
  module: Language;
  /** Errors found */
  errors: NormalizedError[];
  /** Root cause hypotheses */
  hypotheses: RootCauseHypothesis[];
  /** Fix suggestions */
  fixes: FixSuggestion[];
  /** Warnings/notes */
  notes: string[];
  /** Time taken for analysis (ms) */
  analysisTimeMs: number;
}

/**
 * Interface that all language modules must implement
 */
export interface LanguageModule {
  /** Language this module handles */
  readonly language: Language;

  /** Alternative language names/aliases */
  readonly aliases: string[];

  /** File extensions this module handles */
  readonly extensions: string[];

  /**
   * Parse raw error input into normalized errors
   */
  parseError(raw: string): Promise<NormalizedError[]>;

  /**
   * Analyze code and errors to find root causes
   */
  analyze(
    errors: NormalizedError[],
    context: AnalysisContext
  ): Promise<ModuleAnalysisResult>;

  /**
   * Generate fix suggestions for errors
   */
  suggestFixes(
    errors: NormalizedError[],
    hypotheses: RootCauseHypothesis[]
  ): Promise<FixSuggestion[]>;

  /**
   * Validate a proposed fix
   */
  validateFix(fix: FixSuggestion): Promise<ValidationResult>;

  /**
   * Check if this module can handle the given input
   */
  canHandle(input: string | NormalizedError): boolean;
}

/**
 * Context provided to analysis
 */
export interface AnalysisContext {
  /** Working directory */
  workingDir: string;
  /** Files relevant to the error */
  relevantFiles: string[];
  /** File contents cache */
  fileContents: Map<string, string>;
  /** Git information */
  git?: {
    branch: string;
    recentCommits: string[];
    changedFiles: string[];
  };
  /** Project configuration */
  projectConfig?: Record<string, unknown>;
}

/**
 * Result of fix validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Validation steps executed */
  steps: {
    step: ValidationStep;
    passed: boolean;
    output?: string;
    error?: string;
  }[];
  /** Overall notes */
  notes: string[];
}

// =============================================================================
// Orchestrator Types
// =============================================================================

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  /** Working directory */
  workingDir: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum analysis time (ms) */
  maxAnalysisTimeMs?: number;
  /** Enable parallel module execution */
  parallelExecution?: boolean;
  /** Custom module configurations (partial - not all languages need config) */
  moduleConfigs?: Partial<Record<Language, Record<string, unknown>>>;
}

/**
 * Debug session representing one debugging interaction
 */
export interface DebugSession {
  /** Session identifier */
  id: string;
  /** Session start time */
  startedAt: Date;
  /** Original input */
  input: string;
  /** Detected language */
  language: Language;
  /** Parsed errors */
  errors: NormalizedError[];
  /** Analysis results */
  analysisResults?: ModuleAnalysisResult[];
  /** Selected hypothesis */
  selectedHypothesis?: RootCauseHypothesis;
  /** Applied fix */
  appliedFix?: FixSuggestion;
  /** Session status */
  status: 'parsing' | 'analyzing' | 'fixing' | 'validating' | 'complete' | 'failed';
}

/**
 * Event emitted during debugging
 */
export interface DebugEvent {
  /** Event type */
  type:
    | 'session_started'
    | 'language_detected'
    | 'error_parsed'
    | 'analysis_started'
    | 'hypothesis_generated'
    | 'fix_suggested'
    | 'fix_validated'
    | 'session_complete'
    | 'error';
  /** Event timestamp */
  timestamp: Date;
  /** Session ID */
  sessionId: string;
  /** Event data */
  data: unknown;
}
