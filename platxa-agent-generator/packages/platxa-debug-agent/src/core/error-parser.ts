/**
 * Error Parser Module
 *
 * Parses raw error text, stack traces, and log output into the normalized
 * error format. Supports multiple programming languages and error formats.
 *
 * @module error-parser
 */

import { randomUUID } from 'crypto';
import {
  type ErrorSeverity,
  type ErrorSource,
  type Language,
  type NormalizedError,
  type SourceLocation,
  type StackFrame,
} from './types.js';
import { LanguageDetector } from './language-detector.js';

// =============================================================================
// Parser Patterns
// =============================================================================

const PYTHON_TRACEBACK_START = /^Traceback \(most recent call last\):/m;
const PYTHON_FRAME_PATTERN = /^\s*File "([^"]+)", line (\d+)(?:, in (.+))?$/;
const PYTHON_ERROR_PATTERN = /^(\w+(?:Error|Exception|Warning)): (.+)$/;

const JS_FRAME_PATTERN = /^\s+at (?:(.+?) \()?([^()]+):(\d+):(\d+)\)?$/;
const JS_ERROR_PATTERN = /^(\w+(?:Error|Exception)): (.+)$/;

const TS_DIAGNOSTIC_PATTERN = /^(.+)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/;
const ESLINT_PATTERN = /^(.+):(\d+):(\d+): (error|warning|info) (.+?)(?:\s+\((.+)\))?$/;
const CSS_ERROR_PATTERN = /^(?:Error|SassError): (.+):(\d+):(\d+): (.+)$/;
const GENERIC_LOCATION_PATTERN = /^(.+?):(\d+)(?::(\d+))?(?:: (.+))?$/;

// =============================================================================
// Helper Functions for Building Objects with exactOptionalPropertyTypes
// =============================================================================

/**
 * Build a SourceLocation object, only including optional properties if defined
 */
function buildSourceLocation(
  file: string,
  line: number,
  column?: number,
  endLine?: number,
  endColumn?: number
): SourceLocation {
  const loc: SourceLocation = { file, line };
  if (column !== undefined) {
    loc.column = column;
  }
  if (endLine !== undefined) {
    loc.endLine = endLine;
  }
  if (endColumn !== undefined) {
    loc.endColumn = endColumn;
  }
  return loc;
}

/**
 * Build a StackFrame object, only including optional properties if defined
 */
function buildStackFrame(
  location: SourceLocation,
  functionName?: string,
  raw?: string,
  isUserCode?: boolean
): StackFrame {
  const frame: StackFrame = { location };
  if (functionName !== undefined) {
    frame.functionName = functionName;
  }
  if (raw !== undefined) {
    frame.raw = raw;
  }
  if (isUserCode !== undefined) {
    frame.isUserCode = isUserCode;
  }
  return frame;
}

/**
 * Build a NormalizedError object, only including optional properties if defined
 */
function buildNormalizedError(params: {
  type: string;
  message: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  language: Language;
  raw: string;
  location?: SourceLocation;
  stackTrace?: StackFrame[];
  code?: string;
  context?: Record<string, unknown>;
  relatedErrors?: string[];
}): NormalizedError {
  const error: NormalizedError = {
    id: randomUUID(),
    type: params.type,
    message: params.message,
    severity: params.severity,
    source: params.source,
    language: params.language,
    raw: params.raw,
    timestamp: new Date(),
  };

  if (params.location !== undefined) {
    error.location = params.location;
  }
  if (params.stackTrace !== undefined && params.stackTrace.length > 0) {
    error.stackTrace = params.stackTrace;
  }
  if (params.code !== undefined) {
    error.code = params.code;
  }
  if (params.context !== undefined) {
    error.context = params.context;
  }
  if (params.relatedErrors !== undefined && params.relatedErrors.length > 0) {
    error.relatedErrors = params.relatedErrors;
  }

  return error;
}

// =============================================================================
// Error Parser Configuration
// =============================================================================

export interface ErrorParserConfig {
  includeRaw?: boolean;
  maxStackFrames?: number;
  autoDetectLanguage?: boolean;
}

// =============================================================================
// Error Parser Class
// =============================================================================

export class ErrorParser {
  private readonly config: Required<ErrorParserConfig>;
  private readonly languageDetector: LanguageDetector;

  constructor(config?: ErrorParserConfig) {
    this.config = {
      includeRaw: config?.includeRaw ?? true,
      maxStackFrames: config?.maxStackFrames ?? 50,
      autoDetectLanguage: config?.autoDetectLanguage ?? true,
    };
    this.languageDetector = new LanguageDetector();
  }

  // ===========================================================================
  // Main Parse Methods
  // ===========================================================================

  parse(
    raw: string,
    options?: {
      language?: Language;
      filePath?: string;
      source?: ErrorSource;
    }
  ): NormalizedError[] {
    if (raw.trim() === '') {
      return [];
    }

    let language = options?.language;
    if (language === undefined && this.config.autoDetectLanguage) {
      const detectionInput: { content: string; errorText: string; filePath?: string } = {
        content: raw,
        errorText: raw,
      };
      if (options?.filePath !== undefined) {
        detectionInput.filePath = options.filePath;
      }
      const detection = this.languageDetector.detect(detectionInput);
      language = detection.language;
    }
    language = language ?? 'unknown';

    switch (language) {
      case 'python':
        return this.parsePython(raw, options?.source);
      case 'javascript':
      case 'typescript':
        return this.parseJavaScript(raw, language, options?.source);
      case 'css':
      case 'scss':
        return this.parseCSS(raw, language, options?.source);
      default:
        return this.parseGeneric(raw, language, options?.source);
    }
  }

  parseMultiple(raw: string, options?: Parameters<typeof this.parse>[1]): NormalizedError[] {
    const blocks = this.splitErrorBlocks(raw);
    const errors: NormalizedError[] = [];
    for (const block of blocks) {
      errors.push(...this.parse(block, options));
    }
    return errors;
  }

  // ===========================================================================
  // Python Parser
  // ===========================================================================

  private parsePython(raw: string, source?: ErrorSource): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    if (PYTHON_TRACEBACK_START.test(raw)) {
      const error = this.parsePythonTraceback(lines, raw, source ?? 'exception');
      if (error !== null) {
        errors.push(error);
      }
    } else {
      for (const line of lines) {
        const match = PYTHON_ERROR_PATTERN.exec(line);
        if (match !== null) {
          const errorType = match[1];
          const message = match[2];
          if (errorType !== undefined && message !== undefined) {
            errors.push(buildNormalizedError({
              type: errorType,
              message,
              language: 'python',
              source: source ?? 'runtime',
              severity: 'error',
              raw: this.config.includeRaw ? line : '',
            }));
          }
        }
      }
    }

    return errors;
  }

  private parsePythonTraceback(
    lines: string[],
    raw: string,
    source: ErrorSource
  ): NormalizedError | null {
    const stackFrames: StackFrame[] = [];
    let errorType = 'Error';
    let message = '';
    let primaryLocation: SourceLocation | undefined;

    let inTraceback = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line === undefined) {
        i++;
        continue;
      }

      if (PYTHON_TRACEBACK_START.test(line)) {
        inTraceback = true;
        i++;
        continue;
      }

      if (inTraceback) {
        const frameMatch = PYTHON_FRAME_PATTERN.exec(line);
        if (frameMatch !== null) {
          const file = frameMatch[1];
          const lineNum = frameMatch[2];
          const funcName = frameMatch[3];

          if (file !== undefined && lineNum !== undefined) {
            const location = buildSourceLocation(file, parseInt(lineNum, 10));
            const codeLine = lines[i + 1];
            const codeRaw = codeLine !== undefined && codeLine.startsWith('    ')
              ? codeLine.trim()
              : undefined;

            stackFrames.push(buildStackFrame(
              location,
              funcName,
              codeRaw,
              !this.isLibraryPath(file)
            ));
          }
          i++;
          continue;
        }

        const errorMatch = PYTHON_ERROR_PATTERN.exec(line);
        if (errorMatch !== null) {
          const matchedType = errorMatch[1];
          const matchedMessage = errorMatch[2];
          if (matchedType !== undefined) {
            errorType = matchedType;
          }
          if (matchedMessage !== undefined) {
            message = matchedMessage;
          }
          inTraceback = false;
        }
      }

      i++;
    }

    const userFrames = stackFrames.filter((f) => f.isUserCode === true);
    if (userFrames.length > 0) {
      const lastUserFrame = userFrames[userFrames.length - 1];
      if (lastUserFrame !== undefined) {
        primaryLocation = lastUserFrame.location;
      }
    } else if (stackFrames.length > 0) {
      const lastFrame = stackFrames[stackFrames.length - 1];
      if (lastFrame !== undefined) {
        primaryLocation = lastFrame.location;
      }
    }

    if (message === '') {
      return null;
    }

    const params: Parameters<typeof buildNormalizedError>[0] = {
      type: errorType,
      message,
      language: 'python',
      source,
      severity: 'error',
      raw: this.config.includeRaw ? raw : '',
    };
    if (primaryLocation !== undefined) {
      params.location = primaryLocation;
    }
    if (stackFrames.length > 0) {
      params.stackTrace = stackFrames;
    }
    return buildNormalizedError(params);
  }

  // ===========================================================================
  // JavaScript/TypeScript Parser
  // ===========================================================================

  private parseJavaScript(
    raw: string,
    language: 'javascript' | 'typescript',
    source?: ErrorSource
  ): NormalizedError[] {
    const lines = raw.split('\n');

    const tsDiagnostics = this.parseTypeScriptDiagnostics(lines);
    if (tsDiagnostics.length > 0) {
      return tsDiagnostics;
    }

    const eslintErrors = this.parseESLintOutput(lines);
    if (eslintErrors.length > 0) {
      return eslintErrors;
    }

    return this.parseJavaScriptStackTrace(lines, raw, language, source);
  }

  private parseJavaScriptStackTrace(
    lines: string[],
    raw: string,
    language: 'javascript' | 'typescript',
    source?: ErrorSource
  ): NormalizedError[] {
    const errors: NormalizedError[] = [];
    let errorType = 'Error';
    let message = '';
    const stackFrames: StackFrame[] = [];

    for (const line of lines) {
      const errorMatch = JS_ERROR_PATTERN.exec(line);
      if (errorMatch !== null) {
        const matchedType = errorMatch[1];
        const matchedMessage = errorMatch[2];
        if (matchedType !== undefined) {
          errorType = matchedType;
        }
        if (matchedMessage !== undefined) {
          message = matchedMessage;
        }
        continue;
      }

      const frameMatch = JS_FRAME_PATTERN.exec(line);
      if (frameMatch !== null) {
        const funcName = frameMatch[1];
        const file = frameMatch[2];
        const lineNum = frameMatch[3];
        const colNum = frameMatch[4];

        if (file !== undefined && lineNum !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          stackFrames.push(buildStackFrame(
            location,
            funcName ?? '<anonymous>',
            line.trim(),
            !this.isLibraryPath(file)
          ));
        }
      }
    }

    if (message !== '') {
      let primaryLocation: SourceLocation | undefined;
      const userFrames = stackFrames.filter((f) => f.isUserCode === true);
      if (userFrames.length > 0 && userFrames[0] !== undefined) {
        primaryLocation = userFrames[0].location;
      } else if (stackFrames.length > 0 && stackFrames[0] !== undefined) {
        primaryLocation = stackFrames[0].location;
      }

      const params: Parameters<typeof buildNormalizedError>[0] = {
        type: errorType,
        message,
        language,
        source: source ?? 'exception',
        severity: 'error',
        raw: this.config.includeRaw ? raw : '',
      };
      if (primaryLocation !== undefined) {
        params.location = primaryLocation;
      }
      if (stackFrames.length > 0) {
        params.stackTrace = stackFrames;
      }
      errors.push(buildNormalizedError(params));
    }

    return errors;
  }

  private parseTypeScriptDiagnostics(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = TS_DIAGNOSTIC_PATTERN.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const severity = match[4];
        const code = match[5];
        const message = match[6];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          const params: Parameters<typeof buildNormalizedError>[0] = {
            type: 'TypeScriptError',
            message,
            language: 'typescript',
            source: 'static',
            severity: severity === 'error' ? 'error' : 'warning',
            location,
            raw: this.config.includeRaw ? line : '',
          };
          if (code !== undefined) {
            params.code = code;
          }
          errors.push(buildNormalizedError(params));
        }
      }
    }

    return errors;
  }

  private parseESLintOutput(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = ESLINT_PATTERN.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const severity = match[4];
        const message = match[5];
        const rule = match[6];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);
          const fullMessage = rule !== undefined ? `${message} (${rule})` : message;

          const params: Parameters<typeof buildNormalizedError>[0] = {
            type: 'ESLintError',
            message: fullMessage,
            language: this.detectLanguageFromPath(file),
            source: 'static',
            severity: this.mapSeverity(severity),
            location,
            raw: this.config.includeRaw ? line : '',
          };
          if (rule !== undefined) {
            params.code = rule;
          }
          errors.push(buildNormalizedError(params));
        }
      }
    }

    return errors;
  }

  // ===========================================================================
  // CSS/SCSS Parser
  // ===========================================================================

  private parseCSS(
    raw: string,
    language: 'css' | 'scss',
    source?: ErrorSource
  ): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      const match = CSS_ERROR_PATTERN.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push(buildNormalizedError({
            type: 'CSSError',
            message,
            language,
            source: source ?? 'build',
            severity: 'error',
            location,
            raw: this.config.includeRaw ? line : '',
          }));
        }
      }
    }

    if (errors.length === 0) {
      return this.parseGeneric(raw, language, source);
    }

    return errors;
  }

  // ===========================================================================
  // Generic Parser
  // ===========================================================================

  private parseGeneric(
    raw: string,
    language: Language,
    source?: ErrorSource
  ): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      const match = GENERIC_LOCATION_PATTERN.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push(buildNormalizedError({
            type: 'Error',
            message,
            language,
            source: source ?? 'unknown',
            severity: 'error',
            location,
            raw: this.config.includeRaw ? line : '',
          }));
        }
      }

      const errorKeywords = /\b(error|exception|failed|failure|fatal)\b/i;
      if (errorKeywords.test(line) && errors.length === 0) {
        errors.push(buildNormalizedError({
          type: 'Error',
          message: line.trim(),
          language,
          source: source ?? 'unknown',
          severity: 'error',
          raw: this.config.includeRaw ? line : '',
        }));
      }
    }

    if (errors.length === 0 && raw.trim() !== '') {
      const firstLine = lines.find((l) => l.trim() !== '');
      if (firstLine !== undefined) {
        errors.push(buildNormalizedError({
          type: 'Error',
          message: firstLine.trim(),
          language,
          source: source ?? 'unknown',
          severity: 'error',
          raw: this.config.includeRaw ? raw : '',
        }));
      }
    }

    return errors;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private splitErrorBlocks(raw: string): string[] {
    const blocks = raw.split(/\n{2,}(?=Traceback|Error:|at\s)/);
    return blocks.filter((b) => b.trim() !== '');
  }

  private isLibraryPath(filePath: string): boolean {
    const libraryPatterns = [
      /node_modules/,
      /site-packages/,
      /dist-packages/,
      /\.pyenv/,
      /\.nvm/,
      /\/lib\/python/,
      /\/usr\/lib/,
      /<frozen/,
      /<string>/,
      /webpack:/,
      /internal\//,
    ];
    return libraryPatterns.some((pattern) => pattern.test(filePath));
  }

  private detectLanguageFromPath(filePath: string): Language {
    const detection = this.languageDetector.detectFromPath(filePath);
    return detection.language;
  }

  private mapSeverity(severity?: string): ErrorSeverity {
    if (severity === undefined) {
      return 'error';
    }
    switch (severity.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'hint':
        return 'hint';
      default:
        return 'error';
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createErrorParser(config?: ErrorParserConfig): ErrorParser {
  return new ErrorParser(config);
}
