/**
 * Log Pipe
 *
 * Provides log piping integration for error intake,
 * allowing the debug agent to receive and process errors
 * from various log sources (stdout, stderr, files, streams).
 *
 * @module log-pipe
 */

import type { Language, NormalizedError, ErrorSeverity, ErrorSource } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Log source types
 */
export type LogSourceType =
  | 'stdout'
  | 'stderr'
  | 'file'
  | 'stream'
  | 'websocket'
  | 'http'
  | 'custom';

/**
 * Log entry from a source
 */
export interface LogEntry {
  /** Entry timestamp */
  timestamp: Date;
  /** Source type */
  source: LogSourceType;
  /** Source identifier (filename, url, etc.) */
  sourceId: string;
  /** Raw log content */
  content: string;
  /** Log level if detected */
  level?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Detected language */
  language?: Language;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Log pattern for matching errors
 */
export interface LogPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Languages this pattern applies to */
  languages: Language[];
  /** Error severity when matched */
  severity: ErrorSeverity;
  /** Parser function to extract error details */
  parser: (match: RegExpExecArray, entry: LogEntry) => Partial<NormalizedError>;
}

/**
 * Parsed error from log
 */
export interface ParsedLogError {
  /** Original log entry */
  entry: LogEntry;
  /** Pattern that matched */
  patternName: string;
  /** Extracted error information */
  error: NormalizedError;
  /** Confidence in the parse */
  confidence: number;
}

/**
 * Log buffer for accumulating multi-line errors
 */
export interface LogBuffer {
  /** Buffer identifier */
  id: string;
  /** Accumulated lines */
  lines: string[];
  /** Start timestamp */
  startTime: Date;
  /** Source identifier */
  sourceId: string;
  /** Whether buffer is complete */
  complete: boolean;
}

/**
 * Log stream handler
 */
export interface LogStreamHandler {
  /** Called for each log entry */
  onEntry: (entry: LogEntry) => void;
  /** Called when an error is detected */
  onError: (error: ParsedLogError) => void;
  /** Called on stream end */
  onEnd: () => void;
  /** Called on stream error */
  onStreamError: (error: Error) => void;
}

/**
 * Log pipe configuration
 */
export interface LogPipeConfig {
  /** Custom patterns to add */
  customPatterns: LogPattern[];
  /** Buffer timeout for multi-line errors (ms) */
  bufferTimeoutMs: number;
  /** Maximum buffer size (lines) */
  maxBufferLines: number;
  /** Languages to detect */
  targetLanguages: Language[];
  /** Whether to deduplicate errors */
  deduplicateErrors: boolean;
  /** Deduplication window (ms) */
  deduplicationWindowMs: number;
}

// =============================================================================
// Default Patterns
// =============================================================================

const DEFAULT_PATTERNS: LogPattern[] = [
  // Python traceback
  {
    name: 'python-traceback',
    pattern: /Traceback \(most recent call last\):/,
    languages: ['python'],
    severity: 'error',
    parser: (_match, entry) => ({
      language: 'python',
      message: extractLastLine(entry.content),
      source: 'runtime' as ErrorSource,
      severity: 'error',
      raw: entry.content,
      timestamp: entry.timestamp,
    }),
  },
  // Python error line
  {
    name: 'python-error',
    pattern: /^(\w+Error|\w+Exception):\s*(.+)$/m,
    languages: ['python'],
    severity: 'error',
    parser: (match, entry) => ({
      language: 'python',
      message: match[0] ?? 'Unknown error',
      source: 'runtime' as ErrorSource,
      severity: 'error',
      raw: entry.content,
      timestamp: entry.timestamp,
    }),
  },
  // JavaScript/Node error
  {
    name: 'javascript-error',
    pattern: /^(\w+Error):\s*(.+)$/m,
    languages: ['javascript', 'typescript'],
    severity: 'error',
    parser: (match, entry) => ({
      language: detectJsLanguage(entry),
      message: match[0] ?? 'Unknown error',
      source: 'runtime' as ErrorSource,
      severity: 'error',
      raw: entry.content,
      timestamp: entry.timestamp,
    }),
  },
  // Node.js stack trace
  {
    name: 'nodejs-stack',
    pattern: /^\s+at\s+.+\s+\((.+):(\d+):(\d+)\)$/m,
    languages: ['javascript', 'typescript'],
    severity: 'error',
    parser: (_match, entry) => ({
      language: detectJsLanguage(entry),
      message: entry.content.split('\n')[0] ?? 'Unknown error',
      source: 'runtime' as ErrorSource,
      severity: 'error',
      raw: entry.content,
      timestamp: entry.timestamp,
      stackTrace: parseJsStackFrames(entry.content),
    }),
  },
  // TypeScript compiler error
  {
    name: 'typescript-error',
    pattern: /^(.+)\((\d+),(\d+)\):\s*error\s+TS(\d+):\s*(.+)$/m,
    languages: ['typescript'],
    severity: 'error',
    parser: (match, entry) => {
      const file = match[1] ?? 'unknown';
      const result: Partial<NormalizedError> = {
        language: 'typescript',
        message: match[5] ?? 'Unknown error',
        source: 'compiler' as ErrorSource,
        severity: 'error',
        location: {
          file,
          line: parseInt(match[2] ?? '0', 10),
          column: parseInt(match[3] ?? '0', 10),
        },
        code: `TS${match[4] ?? '0000'}`,
        raw: entry.content,
        timestamp: entry.timestamp,
      };
      return result;
    },
  },
  // ESLint error
  {
    name: 'eslint-error',
    pattern: /^(.+):(\d+):(\d+):\s*(error|warning)\s+(.+?)\s+(\S+)$/m,
    languages: ['javascript', 'typescript'],
    severity: 'error',
    parser: (match, entry) => {
      const file = match[1] ?? 'unknown';
      const result: Partial<NormalizedError> = {
        language: detectJsLanguage(entry),
        message: match[5] ?? 'Unknown error',
        source: 'linter' as ErrorSource,
        severity: (match[4] ?? 'error') as ErrorSeverity,
        location: {
          file,
          line: parseInt(match[2] ?? '0', 10),
          column: parseInt(match[3] ?? '0', 10),
        },
        raw: entry.content,
        timestamp: entry.timestamp,
      };
      const code = match[6];
      if (code) {
        result.code = code;
      }
      return result;
    },
  },
  // Pyright/Pylint error
  {
    name: 'python-linter',
    pattern: /^(.+):(\d+):(\d+):\s*(error|warning|information):\s*(.+)$/m,
    languages: ['python'],
    severity: 'error',
    parser: (match, entry) => {
      const file = match[1] ?? 'unknown';
      const result: Partial<NormalizedError> = {
        language: 'python',
        message: match[5] ?? 'Unknown error',
        source: 'linter' as ErrorSource,
        severity: mapPythonSeverity(match[4]),
        location: {
          file,
          line: parseInt(match[2] ?? '0', 10),
          column: parseInt(match[3] ?? '0', 10),
        },
        raw: entry.content,
        timestamp: entry.timestamp,
      };
      return result;
    },
  },
  // CSS/Stylelint error
  {
    name: 'css-linter',
    pattern: /^(.+):(\d+):(\d+):\s*(?:✖|×)\s*(.+?)\s+(\S+)$/m,
    languages: ['css', 'scss'],
    severity: 'error',
    parser: (match, entry) => {
      const file = match[1] ?? 'unknown';
      const result: Partial<NormalizedError> = {
        language: detectCssLanguage(entry),
        message: match[4] ?? 'Unknown error',
        source: 'linter' as ErrorSource,
        severity: 'error',
        location: {
          file,
          line: parseInt(match[2] ?? '0', 10),
          column: parseInt(match[3] ?? '0', 10),
        },
        raw: entry.content,
        timestamp: entry.timestamp,
      };
      const code = match[5];
      if (code) {
        result.code = code;
      }
      return result;
    },
  },
  // Generic error log
  {
    name: 'generic-error',
    pattern: /\[ERROR\]|\[ERR\]|ERROR:|error:/i,
    languages: ['unknown'],
    severity: 'error',
    parser: (_match, entry) => ({
      language: 'unknown',
      message: entry.content,
      source: 'runtime' as ErrorSource,
      severity: 'error',
      raw: entry.content,
      timestamp: entry.timestamp,
    }),
  },
  // Generic warning log
  {
    name: 'generic-warning',
    pattern: /\[WARN\]|\[WARNING\]|WARN:|warning:/i,
    languages: ['unknown'],
    severity: 'warning',
    parser: (_match, entry) => ({
      language: 'unknown',
      message: entry.content,
      source: 'runtime' as ErrorSource,
      severity: 'warning',
      rawOutput: entry.content,
      timestamp: entry.timestamp,
    }),
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function extractLastLine(content: string): string {
  const lines = content.trim().split('\n');
  return lines[lines.length - 1] ?? 'Unknown error';
}

function detectJsLanguage(entry: LogEntry): Language {
  if (entry.language) return entry.language;
  if (entry.sourceId.endsWith('.ts') || entry.sourceId.endsWith('.tsx')) {
    return 'typescript';
  }
  return 'javascript';
}

function detectCssLanguage(entry: LogEntry): Language {
  if (entry.language) return entry.language;
  if (entry.sourceId.endsWith('.scss')) return 'scss';
  return 'css';
}

function mapPythonSeverity(severity: string | undefined): ErrorSeverity {
  switch (severity?.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'information':
    case 'info':
      return 'info';
    default:
      return 'error';
  }
}

function parseJsStackFrames(
  content: string
): Array<{ file: string; line: number; column: number; function?: string }> {
  const frames: Array<{ file: string; line: number; column: number; function?: string }> = [];
  const stackPattern = /^\s+at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?$/gm;
  let match;
  while ((match = stackPattern.exec(content)) !== null) {
    const funcName = match[1];
    const file = match[2];
    const line = match[3];
    const column = match[4];
    if (file && line && column) {
      const frame: { file: string; line: number; column: number; function?: string } = {
        file,
        line: parseInt(line, 10),
        column: parseInt(column, 10),
      };
      if (funcName) {
        frame.function = funcName;
      }
      frames.push(frame);
    }
  }
  return frames;
}

function generateErrorId(error: NormalizedError): string {
  const parts = [
    error.language,
    error.message?.slice(0, 50),
    error.location?.file,
    error.location?.line,
  ].filter(Boolean);
  return parts.join(':');
}

// =============================================================================
// Log Pipe Class
// =============================================================================

/**
 * Log Pipe for error intake
 *
 * Processes log streams and extracts errors for debugging.
 */
export class LogPipe {
  private config: LogPipeConfig;
  private patterns: LogPattern[];
  private buffers: Map<string, LogBuffer>;
  private recentErrors: Map<string, number>;
  private handlers: Set<LogStreamHandler>;

  constructor(config: Partial<LogPipeConfig> = {}) {
    this.config = {
      customPatterns: config.customPatterns ?? [],
      bufferTimeoutMs: config.bufferTimeoutMs ?? 500,
      maxBufferLines: config.maxBufferLines ?? 100,
      targetLanguages: config.targetLanguages ?? [
        'python',
        'javascript',
        'typescript',
        'css',
        'scss',
      ],
      deduplicateErrors: config.deduplicateErrors ?? true,
      deduplicationWindowMs: config.deduplicationWindowMs ?? 5000,
    };

    // Combine default and custom patterns
    this.patterns = [...DEFAULT_PATTERNS, ...this.config.customPatterns];

    // Filter patterns by target languages
    if (this.config.targetLanguages.length > 0) {
      this.patterns = this.patterns.filter(
        (p) =>
          p.languages.includes('unknown') ||
          p.languages.some((l) => this.config.targetLanguages.includes(l))
      );
    }

    this.buffers = new Map();
    this.recentErrors = new Map();
    this.handlers = new Set();
  }

  /**
   * Register a stream handler
   */
  addHandler(handler: LogStreamHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Remove a stream handler
   */
  removeHandler(handler: LogStreamHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Process a single log line
   */
  processLine(
    line: string,
    sourceType: LogSourceType,
    sourceId: string,
    metadata: Record<string, unknown> = {}
  ): ParsedLogError[] {
    const entry: LogEntry = {
      timestamp: new Date(),
      source: sourceType,
      sourceId,
      content: line,
      metadata,
    };
    const level = this.detectLogLevel(line);
    if (level) {
      entry.level = level;
    }
    const language = this.detectLanguage(line, sourceId);
    if (language) {
      entry.language = language;
    }

    return this.processEntry(entry);
  }

  /**
   * Process a log entry
   */
  processEntry(entry: LogEntry): ParsedLogError[] {
    const errors: ParsedLogError[] = [];

    // Notify handlers of entry
    for (const handler of this.handlers) {
      handler.onEntry(entry);
    }

    // Check if this starts a multi-line error
    if (this.isMultiLineStart(entry.content)) {
      this.startBuffer(entry);
      return errors;
    }

    // Check if this continues a buffered error
    const buffer = this.getActiveBuffer(entry.sourceId);
    if (buffer && !this.isBufferComplete(entry.content, buffer)) {
      this.appendToBuffer(buffer.id, entry.content);
      return errors;
    }

    // Flush buffer if complete
    if (buffer) {
      const bufferedEntry = this.flushBuffer(buffer.id, entry);
      if (bufferedEntry) {
        errors.push(...this.parseEntry(bufferedEntry));
      }
    }

    // Parse current entry
    errors.push(...this.parseEntry(entry));

    // Notify handlers of errors
    for (const error of errors) {
      if (!this.isDuplicate(error)) {
        this.recordError(error);
        for (const handler of this.handlers) {
          handler.onError(error);
        }
      }
    }

    return errors;
  }

  /**
   * Process multiple lines at once
   */
  processLines(
    lines: string[],
    sourceType: LogSourceType,
    sourceId: string,
    metadata: Record<string, unknown> = {}
  ): ParsedLogError[] {
    const allErrors: ParsedLogError[] = [];
    for (const line of lines) {
      const errors = this.processLine(line, sourceType, sourceId, metadata);
      allErrors.push(...errors);
    }
    return allErrors;
  }

  /**
   * Process a complete log chunk
   */
  processChunk(
    chunk: string,
    sourceType: LogSourceType,
    sourceId: string,
    metadata: Record<string, unknown> = {}
  ): ParsedLogError[] {
    const lines = chunk.split('\n');
    return this.processLines(lines, sourceType, sourceId, metadata);
  }

  /**
   * Flush all pending buffers
   */
  flushAllBuffers(): ParsedLogError[] {
    const errors: ParsedLogError[] = [];
    for (const buffer of this.buffers.values()) {
      const entry = this.createEntryFromBuffer(buffer);
      errors.push(...this.parseEntry(entry));
    }
    this.buffers.clear();
    return errors;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: LogPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): LogPattern[] {
    return [...this.patterns];
  }

  /**
   * Parse raw error output
   */
  parseRawOutput(
    output: string,
    language: Language,
    sourceId: string = 'raw'
  ): ParsedLogError[] {
    const entry: LogEntry = {
      timestamp: new Date(),
      source: 'custom',
      sourceId,
      content: output,
      language,
      metadata: {},
    };
    return this.parseEntry(entry);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private parseEntry(entry: LogEntry): ParsedLogError[] {
    const errors: ParsedLogError[] = [];

    for (const pattern of this.patterns) {
      // Skip patterns for different languages
      if (
        entry.language &&
        !pattern.languages.includes('unknown') &&
        !pattern.languages.includes(entry.language)
      ) {
        continue;
      }

      const match = pattern.pattern.exec(entry.content);
      if (match) {
        const partialError = pattern.parser(match, entry);
        const normalizedError = this.normalizeError(partialError, entry);

        errors.push({
          entry,
          patternName: pattern.name,
          error: normalizedError,
          confidence: this.calculateConfidence(pattern, match, entry),
        });

        // Only use first matching pattern for severity precedence
        break;
      }
    }

    return errors;
  }

  private normalizeError(
    partial: Partial<NormalizedError>,
    entry: LogEntry
  ): NormalizedError {
    const message = partial.message ?? entry.content;
    const result: NormalizedError = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: partial.type ?? this.extractErrorType(message),
      language: partial.language ?? entry.language ?? 'unknown',
      message,
      source: partial.source ?? 'runtime',
      severity: partial.severity ?? 'error',
      raw: partial.raw ?? entry.content,
      timestamp: partial.timestamp ?? entry.timestamp,
    };
    if (partial.location) {
      result.location = partial.location;
    }
    if (partial.code) {
      result.code = partial.code;
    }
    if (partial.stackTrace) {
      result.stackTrace = partial.stackTrace;
    }
    if (partial.context) {
      result.context = partial.context;
    }
    if (partial.relatedErrors && partial.relatedErrors.length > 0) {
      result.relatedErrors = partial.relatedErrors;
    }
    return result;
  }

  private extractErrorType(message: string): string {
    const match = message.match(/^(\w+Error|\w+Exception)/);
    return match?.[1] ?? 'Error';
  }

  private calculateConfidence(
    pattern: LogPattern,
    match: RegExpExecArray,
    entry: LogEntry
  ): number {
    let confidence = 0.5;

    // Language match boosts confidence
    if (entry.language && pattern.languages.includes(entry.language)) {
      confidence += 0.2;
    }

    // More capture groups = more specific pattern
    confidence += Math.min(0.15, match.length * 0.03);

    // Pattern name specificity
    if (pattern.name.includes('error') || pattern.name.includes('traceback')) {
      confidence += 0.1;
    }

    // Generic patterns have lower confidence
    if (pattern.name.startsWith('generic-')) {
      confidence -= 0.2;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private detectLogLevel(line: string): LogEntry['level'] {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('err]') || lower.includes('[err')) {
      return 'error';
    }
    if (lower.includes('warn') || lower.includes('[warn')) {
      return 'warn';
    }
    if (lower.includes('info') || lower.includes('[info')) {
      return 'info';
    }
    if (lower.includes('debug') || lower.includes('[debug')) {
      return 'debug';
    }
    if (lower.includes('trace') || lower.includes('[trace')) {
      return 'trace';
    }
    return undefined;
  }

  private detectLanguage(line: string, sourceId: string): Language | undefined {
    // Check file extension
    if (sourceId.endsWith('.py')) return 'python';
    if (sourceId.endsWith('.js') || sourceId.endsWith('.jsx')) return 'javascript';
    if (sourceId.endsWith('.ts') || sourceId.endsWith('.tsx')) return 'typescript';
    if (sourceId.endsWith('.css')) return 'css';
    if (sourceId.endsWith('.scss')) return 'scss';

    // Check content patterns
    if (line.includes('Traceback') || /\w+Error:/.test(line)) {
      if (line.includes('File "')) return 'python';
    }
    if (/at\s+.+\s+\(.+:\d+:\d+\)/.test(line)) {
      return 'javascript';
    }
    if (/TS\d{4}:/.test(line)) {
      return 'typescript';
    }

    return undefined;
  }

  private isMultiLineStart(line: string): boolean {
    return (
      line.includes('Traceback (most recent call last)') ||
      line.includes('Error: ') ||
      /^\w+Error:/.test(line)
    );
  }

  private isBufferComplete(line: string, _buffer: LogBuffer): boolean {
    // Empty line often ends multi-line errors
    if (line.trim() === '') return true;

    // New error starts
    if (this.isMultiLineStart(line)) return true;

    // Stack trace typically ends when indentation stops
    if (!line.startsWith(' ') && !line.startsWith('\t')) return true;

    return false;
  }

  private startBuffer(entry: LogEntry): void {
    const id = `buffer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.buffers.set(id, {
      id,
      lines: [entry.content],
      startTime: new Date(),
      sourceId: entry.sourceId,
      complete: false,
    });

    // Set timeout to flush buffer
    setTimeout(() => {
      const buffer = this.buffers.get(id);
      if (buffer && !buffer.complete) {
        this.flushBuffer(id);
      }
    }, this.config.bufferTimeoutMs);
  }

  private getActiveBuffer(sourceId: string): LogBuffer | undefined {
    for (const buffer of this.buffers.values()) {
      if (buffer.sourceId === sourceId && !buffer.complete) {
        return buffer;
      }
    }
    return undefined;
  }

  private appendToBuffer(bufferId: string, line: string): void {
    const buffer = this.buffers.get(bufferId);
    if (buffer && buffer.lines.length < this.config.maxBufferLines) {
      buffer.lines.push(line);
    }
  }

  private flushBuffer(bufferId: string, triggerEntry?: LogEntry): LogEntry | undefined {
    const buffer = this.buffers.get(bufferId);
    if (!buffer) return undefined;

    buffer.complete = true;
    this.buffers.delete(bufferId);

    return this.createEntryFromBuffer(buffer, triggerEntry);
  }

  private createEntryFromBuffer(buffer: LogBuffer, triggerEntry?: LogEntry): LogEntry {
    const entry: LogEntry = {
      timestamp: buffer.startTime,
      source: triggerEntry?.source ?? 'stream',
      sourceId: buffer.sourceId,
      content: buffer.lines.join('\n'),
      level: 'error',
      metadata: triggerEntry?.metadata ?? {},
    };
    if (triggerEntry?.language) {
      entry.language = triggerEntry.language;
    }
    return entry;
  }

  private isDuplicate(error: ParsedLogError): boolean {
    if (!this.config.deduplicateErrors) return false;

    const errorId = generateErrorId(error.error);
    const lastSeen = this.recentErrors.get(errorId);

    if (lastSeen && Date.now() - lastSeen < this.config.deduplicationWindowMs) {
      return true;
    }

    return false;
  }

  private recordError(error: ParsedLogError): void {
    const errorId = generateErrorId(error.error);
    this.recentErrors.set(errorId, Date.now());

    // Clean up old entries
    const now = Date.now();
    for (const [id, timestamp] of this.recentErrors) {
      if (now - timestamp > this.config.deduplicationWindowMs) {
        this.recentErrors.delete(id);
      }
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a log pipe
 */
export function createLogPipe(config?: Partial<LogPipeConfig>): LogPipe {
  return new LogPipe(config);
}
