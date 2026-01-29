/**
 * Fix Validator
 *
 * Validates generated fixes using language-specific type checkers
 * and linters. Supports Pyright for Python and TSC for TypeScript.
 *
 * @module fix-validator
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { CodeChange, FixSuggestion, Language } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Validation error from type checker
 */
export interface TypeCheckError {
  /** Error message */
  message: string;
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Error code */
  code?: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Type checker validation result
 */
export interface TypeCheckResult {
  /** Whether validation passed */
  success: boolean;
  /** Errors found */
  errors: TypeCheckError[];
  /** Warnings found */
  warnings: TypeCheckError[];
  /** Type checker used */
  checker: 'pyright' | 'tsc' | 'eslint' | 'stylelint' | 'ruff' | 'none';
  /** Raw output from type checker */
  rawOutput: string;
  /** Exit code */
  exitCode: number;
  /** Execution time in milliseconds */
  durationMs: number;
}

/**
 * Fix validation result
 */
export interface FixValidationResult {
  /** Unique validation ID */
  id: string;
  /** Fix being validated */
  fixId: string;
  /** Overall validation status */
  status: 'valid' | 'invalid' | 'partial' | 'skipped';
  /** Type check result */
  typeCheck?: TypeCheckResult;
  /** Lint check result */
  lintCheck?: TypeCheckResult;
  /** Syntax check result */
  syntaxCheck?: TypeCheckResult;
  /** Summary message */
  summary: string;
  /** Total validation time */
  totalDurationMs: number;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Skip type checking */
  skipTypeCheck?: boolean;
  /** Skip linting */
  skipLint?: boolean;
  /** Skip syntax check */
  skipSyntax?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory */
  workingDir?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Fix validator configuration
 */
export interface FixValidatorConfig {
  /** Path to Pyright executable */
  pyrightPath?: string;
  /** Path to TSC executable */
  tscPath?: string;
  /** Path to ESLint executable */
  eslintPath?: string;
  /** Path to Stylelint executable */
  stylelintPath?: string;
  /** Path to Ruff executable (Python linter) */
  ruffPath?: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Temporary directory for validation files */
  tempDir?: string;
  /** Whether to clean up temp files */
  cleanupTempFiles?: boolean;
}

// =============================================================================
// Fix Validator Implementation
// =============================================================================

/**
 * Validates generated fixes using language-specific type checkers.
 */
export class FixValidator {
  private readonly config: Required<FixValidatorConfig>;
  private readonly tempFiles: Set<string> = new Set();

  constructor(config: Partial<FixValidatorConfig> = {}) {
    this.config = {
      pyrightPath: config.pyrightPath ?? 'pyright',
      tscPath: config.tscPath ?? 'tsc',
      eslintPath: config.eslintPath ?? 'eslint',
      stylelintPath: config.stylelintPath ?? 'stylelint',
      ruffPath: config.ruffPath ?? 'ruff',
      defaultTimeout: config.defaultTimeout ?? 30000,
      tempDir: config.tempDir ?? os.tmpdir(),
      cleanupTempFiles: config.cleanupTempFiles ?? true,
    };
  }

  /**
   * Validate a fix suggestion.
   */
  async validateFix(
    fix: FixSuggestion,
    language: Language,
    originalCode: string,
    options: ValidationOptions = {}
  ): Promise<FixValidationResult> {
    const startTime = Date.now();
    const resultId = randomUUID();

    // Apply fix to get the modified code
    const modifiedCode = this.applyFix(originalCode, fix.changes);

    // Determine which validations to run
    const results: FixValidationResult = {
      id: resultId,
      fixId: fix.id,
      status: 'valid',
      summary: '',
      totalDurationMs: 0,
    };

    try {
      // Run type check if applicable
      if (!options.skipTypeCheck) {
        const typeCheck = await this.runTypeCheck(
          modifiedCode,
          language,
          options
        );
        results.typeCheck = typeCheck;

        if (!typeCheck.success) {
          results.status = typeCheck.errors.length > 0 ? 'invalid' : 'partial';
        }
      }

      // Run lint check if applicable
      if (!options.skipLint) {
        const lintCheck = await this.runLintCheck(
          modifiedCode,
          language,
          options
        );
        results.lintCheck = lintCheck;

        if (!lintCheck.success && results.status === 'valid') {
          results.status = 'partial';
        }
      }

      // Build summary
      results.summary = this.buildSummary(results);
    } catch (error) {
      results.status = 'skipped';
      results.summary = error instanceof Error
        ? `Validation skipped: ${error.message}`
        : 'Validation skipped: Unknown error';
    }

    results.totalDurationMs = Date.now() - startTime;

    // Cleanup temp files
    if (this.config.cleanupTempFiles) {
      await this.cleanupTempFiles();
    }

    return results;
  }

  /**
   * Validate code directly without a fix object.
   */
  async validateCode(
    code: string,
    language: Language,
    options: ValidationOptions = {}
  ): Promise<TypeCheckResult> {
    return this.runTypeCheck(code, language, options);
  }

  /**
   * Check if a type checker is available for a language.
   */
  async isCheckerAvailable(language: Language): Promise<boolean> {
    try {
      switch (language) {
        case 'python':
          await this.runCommand(this.config.pyrightPath, ['--version'], {
            timeout: 5000,
          });
          return true;

        case 'typescript':
        case 'javascript':
          await this.runCommand(this.config.tscPath, ['--version'], {
            timeout: 5000,
          });
          return true;

        case 'css':
        case 'scss':
          await this.runCommand(this.config.stylelintPath, ['--version'], {
            timeout: 5000,
          });
          return true;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Type Checking
  // ===========================================================================

  /**
   * Run type check for the given language.
   */
  private async runTypeCheck(
    code: string,
    language: Language,
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    switch (language) {
      case 'python':
        return this.runPyrightCheck(code, options);

      case 'typescript':
        return this.runTscCheck(code, options);

      case 'javascript':
        return this.runEslintCheck(code, 'javascript', options);

      case 'css':
      case 'scss':
        return this.runStylelintCheck(code, language, options);

      default:
        return {
          success: true,
          errors: [],
          warnings: [],
          checker: 'none',
          rawOutput: 'No type checker available for this language',
          exitCode: 0,
          durationMs: 0,
        };
    }
  }

  /**
   * Run Pyright for Python type checking.
   */
  private async runPyrightCheck(
    code: string,
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    const startTime = Date.now();
    const tempFile = await this.createTempFile(code, '.py');

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(
        this.config.pyrightPath,
        ['--outputjson', tempFile],
        cmdOptions
      );

      const errors: TypeCheckError[] = [];
      const warnings: TypeCheckError[] = [];

      // Parse Pyright JSON output
      try {
        const output = JSON.parse(result.stdout) as {
          generalDiagnostics?: Array<{
            message: string;
            file: string;
            range: {
              start: { line: number; character: number };
            };
            severity: number;
            rule?: string;
          }>;
        };

        for (const diag of output.generalDiagnostics ?? []) {
          const error: TypeCheckError = {
            message: diag.message,
            file: diag.file,
            line: diag.range.start.line + 1,
            column: diag.range.start.character + 1,
            severity: diag.severity === 1 ? 'error' : 'warning',
          };

          if (diag.rule !== undefined) {
            error.code = diag.rule;
          }

          if (diag.severity === 1) {
            errors.push(error);
          } else {
            warnings.push(error);
          }
        }
      } catch {
        // If JSON parsing fails, try to parse text output
        const parsed = this.parsePyrightTextOutput(result.stdout, tempFile);
        errors.push(...parsed.errors);
        warnings.push(...parsed.warnings);
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        checker: 'pyright',
        rawOutput: result.stdout,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Pyright check failed',
          file: tempFile,
          line: 1,
          column: 1,
          severity: 'error',
        }],
        warnings: [],
        checker: 'pyright',
        rawOutput: '',
        exitCode: 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run TSC for TypeScript type checking.
   */
  private async runTscCheck(
    code: string,
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    const startTime = Date.now();
    const tempFile = await this.createTempFile(code, '.ts');

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(
        this.config.tscPath,
        ['--noEmit', '--strict', tempFile],
        cmdOptions
      );

      const errors: TypeCheckError[] = [];
      const warnings: TypeCheckError[] = [];

      // Parse TSC output
      const parsed = this.parseTscOutput(result.stdout + result.stderr, tempFile);
      errors.push(...parsed.errors);
      warnings.push(...parsed.warnings);

      return {
        success: errors.length === 0,
        errors,
        warnings,
        checker: 'tsc',
        rawOutput: result.stdout + result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'TSC check failed',
          file: tempFile,
          line: 1,
          column: 1,
          severity: 'error',
        }],
        warnings: [],
        checker: 'tsc',
        rawOutput: '',
        exitCode: 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // Lint Checking
  // ===========================================================================

  /**
   * Run lint check for the given language.
   */
  private async runLintCheck(
    code: string,
    language: Language,
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    switch (language) {
      case 'python':
        return this.runRuffCheck(code, options);

      case 'javascript':
      case 'typescript':
        return this.runEslintCheck(code, language, options);

      case 'css':
      case 'scss':
        return this.runStylelintCheck(code, language, options);

      default:
        return {
          success: true,
          errors: [],
          warnings: [],
          checker: 'none',
          rawOutput: 'No linter available for this language',
          exitCode: 0,
          durationMs: 0,
        };
    }
  }

  /**
   * Run Ruff for Python linting.
   */
  private async runRuffCheck(
    code: string,
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    const startTime = Date.now();
    const tempFile = await this.createTempFile(code, '.py');

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(
        this.config.ruffPath,
        ['check', '--output-format', 'json', tempFile],
        cmdOptions
      );

      const errors: TypeCheckError[] = [];
      const warnings: TypeCheckError[] = [];

      // Parse Ruff JSON output
      try {
        const output = JSON.parse(result.stdout) as Array<{
          message: string;
          filename: string;
          location: {
            row: number;
            column: number;
          };
          code: string;
          fix?: {
            applicability: string;
          };
        }>;

        for (const diag of output) {
          // Ruff uses codes like E501, W503, F401, etc.
          // E and F codes are errors, W codes are warnings
          const isWarning = diag.code.startsWith('W');

          const error: TypeCheckError = {
            message: diag.message,
            file: diag.filename,
            line: diag.location.row,
            column: diag.location.column,
            code: diag.code,
            severity: isWarning ? 'warning' : 'error',
          };

          if (isWarning) {
            warnings.push(error);
          } else {
            errors.push(error);
          }
        }
      } catch {
        // If JSON parsing fails, try to parse text output
        const parsed = this.parseRuffTextOutput(result.stdout, tempFile);
        errors.push(...parsed.errors);
        warnings.push(...parsed.warnings);
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        checker: 'ruff',
        rawOutput: result.stdout,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Ruff not available - skip
      return {
        success: true,
        errors: [],
        warnings: [],
        checker: 'ruff',
        rawOutput: error instanceof Error ? error.message : 'Ruff not available',
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run ESLint for JavaScript/TypeScript linting.
   */
  private async runEslintCheck(
    code: string,
    language: 'javascript' | 'typescript',
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    const startTime = Date.now();
    const ext = language === 'typescript' ? '.ts' : '.js';
    const tempFile = await this.createTempFile(code, ext);

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(
        this.config.eslintPath,
        ['--format', 'json', '--no-eslintrc', tempFile],
        cmdOptions
      );

      const errors: TypeCheckError[] = [];
      const warnings: TypeCheckError[] = [];

      // Parse ESLint JSON output
      try {
        const output = JSON.parse(result.stdout) as Array<{
          filePath: string;
          messages: Array<{
            message: string;
            line: number;
            column: number;
            ruleId: string | null;
            severity: number;
          }>;
        }>;

        for (const file of output) {
          for (const msg of file.messages) {
            const error: TypeCheckError = {
              message: msg.message,
              file: file.filePath,
              line: msg.line,
              column: msg.column,
              severity: msg.severity === 2 ? 'error' : 'warning',
            };

            if (msg.ruleId !== null) {
              error.code = msg.ruleId;
            }

            if (msg.severity === 2) {
              errors.push(error);
            } else {
              warnings.push(error);
            }
          }
        }
      } catch {
        // If JSON parsing fails, consider it a pass
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        checker: 'eslint',
        rawOutput: result.stdout,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // ESLint not available - skip
      return {
        success: true,
        errors: [],
        warnings: [],
        checker: 'eslint',
        rawOutput: error instanceof Error ? error.message : 'ESLint not available',
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Stylelint for CSS/SCSS linting.
   */
  private async runStylelintCheck(
    code: string,
    language: 'css' | 'scss',
    options: ValidationOptions
  ): Promise<TypeCheckResult> {
    const startTime = Date.now();
    const ext = language === 'scss' ? '.scss' : '.css';
    const tempFile = await this.createTempFile(code, ext);

    try {
      const cmdOptions = this.buildCommandOptions(options);
      const result = await this.runCommand(
        this.config.stylelintPath,
        ['--formatter', 'json', tempFile],
        cmdOptions
      );

      const errors: TypeCheckError[] = [];
      const warnings: TypeCheckError[] = [];

      // Parse Stylelint JSON output
      try {
        const output = JSON.parse(result.stdout) as Array<{
          source: string;
          warnings: Array<{
            text: string;
            line: number;
            column: number;
            rule: string;
            severity: string;
          }>;
        }>;

        for (const file of output) {
          for (const warn of file.warnings) {
            const error: TypeCheckError = {
              message: warn.text,
              file: file.source,
              line: warn.line,
              column: warn.column,
              code: warn.rule,
              severity: warn.severity === 'error' ? 'error' : 'warning',
            };

            if (warn.severity === 'error') {
              errors.push(error);
            } else {
              warnings.push(error);
            }
          }
        }
      } catch {
        // If JSON parsing fails, consider it a pass
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        checker: 'stylelint',
        rawOutput: result.stdout,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Stylelint not available - skip
      return {
        success: true,
        errors: [],
        warnings: [],
        checker: 'stylelint',
        rawOutput: error instanceof Error ? error.message : 'Stylelint not available',
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // Output Parsing
  // ===========================================================================

  /**
   * Parse Pyright text output.
   */
  private parsePyrightTextOutput(
    output: string,
    _file: string
  ): { errors: TypeCheckError[]; warnings: TypeCheckError[] } {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckError[] = [];

    // Pattern: /path/to/file.py:10:5 - error: message
    const pattern = /^(.+):(\d+):(\d+)\s+-\s+(error|warning|information):\s+(.+)$/gm;
    let match;

    while ((match = pattern.exec(output)) !== null) {
      const [, file, lineStr, colStr, severity, message] = match;
      if (file === undefined || lineStr === undefined || colStr === undefined || message === undefined) {
        continue;
      }

      const error: TypeCheckError = {
        message,
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        severity: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info',
      };

      if (severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }

    return { errors, warnings };
  }

  /**
   * Parse Ruff text output.
   */
  private parseRuffTextOutput(
    output: string,
    _file: string
  ): { errors: TypeCheckError[]; warnings: TypeCheckError[] } {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckError[] = [];

    // Pattern: /path/to/file.py:10:5: E501 Line too long
    const pattern = /^(.+):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/gm;
    let match;

    while ((match = pattern.exec(output)) !== null) {
      const [, file, lineStr, colStr, code, message] = match;
      if (file === undefined || lineStr === undefined || colStr === undefined || code === undefined || message === undefined) {
        continue;
      }

      // W codes are warnings, everything else (E, F, etc.) are errors
      const isWarning = code.startsWith('W');

      const error: TypeCheckError = {
        message,
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        code,
        severity: isWarning ? 'warning' : 'error',
      };

      if (isWarning) {
        warnings.push(error);
      } else {
        errors.push(error);
      }
    }

    return { errors, warnings };
  }

  /**
   * Parse TSC output.
   */
  private parseTscOutput(
    output: string,
    _file: string
  ): { errors: TypeCheckError[]; warnings: TypeCheckError[] } {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckError[] = [];

    // Pattern: file.ts(10,5): error TS2322: message
    const pattern = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
    let match;

    while ((match = pattern.exec(output)) !== null) {
      const [, file, lineStr, colStr, severity, code, message] = match;
      if (file === undefined || lineStr === undefined || colStr === undefined || message === undefined) {
        continue;
      }

      const error: TypeCheckError = {
        message,
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        severity: severity === 'error' ? 'error' : 'warning',
      };

      if (code !== undefined) {
        error.code = code;
      }

      if (severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }

    return { errors, warnings };
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Apply fix changes to original code.
   */
  private applyFix(originalCode: string, changes: CodeChange[]): string {
    const code = originalCode;
    const lines = code.split('\n');

    // Sort changes by line number in reverse order to apply from bottom to top
    const sortedChanges = [...changes].sort((a, b) => b.start.line - a.start.line);

    for (const change of sortedChanges) {
      const startLine = change.start.line - 1; // Convert to 0-based
      const endLine = change.end !== undefined ? change.end.line - 1 : startLine;

      switch (change.type) {
        case 'replace':
          if (change.newContent !== undefined) {
            const newLines = change.newContent.split('\n');
            lines.splice(startLine, endLine - startLine + 1, ...newLines);
          }
          break;

        case 'insert':
          if (change.newContent !== undefined) {
            const newLines = change.newContent.split('\n');
            lines.splice(startLine, 0, ...newLines);
          }
          break;

        case 'delete':
          lines.splice(startLine, endLine - startLine + 1);
          break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Build command options from validation options.
   */
  private buildCommandOptions(
    options: ValidationOptions
  ): { timeout: number; cwd?: string; env?: Record<string, string> } {
    const cmdOptions: { timeout: number; cwd?: string; env?: Record<string, string> } = {
      timeout: options.timeout ?? this.config.defaultTimeout,
    };

    if (options.workingDir !== undefined) {
      cmdOptions.cwd = options.workingDir;
    }

    if (options.env !== undefined) {
      cmdOptions.env = options.env;
    }

    return cmdOptions;
  }

  /**
   * Create a temporary file with the given code.
   */
  private async createTempFile(code: string, extension: string): Promise<string> {
    const filename = `platxa-validate-${randomUUID()}${extension}`;
    const filepath = path.join(this.config.tempDir, filename);

    await fs.writeFile(filepath, code, 'utf-8');
    this.tempFiles.add(filepath);

    return filepath;
  }

  /**
   * Clean up temporary files.
   */
  private async cleanupTempFiles(): Promise<void> {
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.tempFiles.clear();
  }

  /**
   * Run a command and return its output.
   */
  private runCommand(
    command: string,
    args: string[],
    options: { timeout?: number; cwd?: string; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = options.timeout ?? this.config.defaultTimeout;
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Build a summary message from validation results.
   */
  private buildSummary(results: FixValidationResult): string {
    const parts: string[] = [];

    if (results.typeCheck !== undefined) {
      if (results.typeCheck.success) {
        parts.push(`Type check passed (${results.typeCheck.checker})`);
      } else {
        parts.push(
          `Type check failed: ${results.typeCheck.errors.length} error(s), ` +
          `${results.typeCheck.warnings.length} warning(s)`
        );
      }
    }

    if (results.lintCheck !== undefined) {
      if (results.lintCheck.success) {
        parts.push(`Lint check passed (${results.lintCheck.checker})`);
      } else {
        parts.push(
          `Lint check failed: ${results.lintCheck.errors.length} error(s), ` +
          `${results.lintCheck.warnings.length} warning(s)`
        );
      }
    }

    if (parts.length === 0) {
      return 'No validation performed';
    }

    return parts.join('; ');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a fix validator with default configuration.
 */
export function createFixValidator(
  config?: Partial<FixValidatorConfig>
): FixValidator {
  return new FixValidator(config);
}
