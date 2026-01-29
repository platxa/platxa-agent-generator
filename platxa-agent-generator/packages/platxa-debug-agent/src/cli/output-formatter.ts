/**
 * Output Formatter
 *
 * Provides consistent structured output across all CLI commands.
 * Supports JSON, text, markdown, and HTML formats with a standardized schema.
 *
 * JSON Schema: {success, data, errors, metadata}
 *
 * @module output-formatter
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Types
// =============================================================================

/**
 * Output format types
 */
export type OutputFormat = 'json' | 'text' | 'markdown' | 'html';

/**
 * Error information for output
 */
export interface OutputError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Stack trace (only in verbose mode) */
  stack?: string;
}

/**
 * Metadata included in output
 */
export interface OutputMetadata {
  /** Timestamp of the output */
  timestamp: string;
  /** CLI version */
  version: string;
  /** Command that was executed */
  command: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Structured output schema for JSON format
 */
export interface StructuredOutput<T = unknown> {
  /** Whether the command succeeded */
  success: boolean;
  /** The response data */
  data: T | null;
  /** Any errors that occurred */
  errors: OutputError[];
  /** Output metadata */
  metadata: OutputMetadata;
}

/**
 * Output formatter configuration
 */
export interface OutputFormatterConfig {
  /** Default output format */
  format: OutputFormat;
  /** Enable colored output (for text format) */
  color: boolean;
  /** Include verbose details */
  verbose: boolean;
  /** Pretty-print JSON output */
  prettyPrint: boolean;
  /** Include stack traces in errors */
  includeStackTraces: boolean;
}

/**
 * Section for text/markdown output
 */
export interface OutputSection {
  /** Section title */
  title: string;
  /** Section content (string or key-value pairs) */
  content: string | Record<string, unknown> | Array<Record<string, unknown>>;
  /** Section level (1-3 for headers) */
  level?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: OutputFormatterConfig = {
  format: 'text',
  color: true,
  verbose: false,
  prettyPrint: true,
  includeStackTraces: false,
};

// =============================================================================
// Version Helper
// =============================================================================

let cachedVersion: string | null = null;

function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
    cachedVersion = packageJson.version;
    return cachedVersion;
  } catch {
    return '0.0.0';
  }
}

// =============================================================================
// OutputFormatter Class
// =============================================================================

/**
 * Formats command output in various formats with consistent structure
 */
export class OutputFormatter {
  private config: OutputFormatterConfig;
  private startTime: number;
  private command: string;

  constructor(command: string, config: Partial<OutputFormatterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.command = command;
    this.startTime = Date.now();
  }

  // ===========================================================================
  // Public API - Main Output Methods
  // ===========================================================================

  /**
   * Format successful output
   */
  success<T>(data: T, context?: Record<string, unknown>): string {
    const output = this.createOutput(true, data, [], context);
    return this.format(output);
  }

  /**
   * Format error output
   */
  error(errors: OutputError | OutputError[], context?: Record<string, unknown>): string {
    const errorArray = Array.isArray(errors) ? errors : [errors];
    const output = this.createOutput(false, null, errorArray, context);
    return this.format(output);
  }

  /**
   * Format partial success output (has data but also errors/warnings)
   */
  partial<T>(data: T, errors: OutputError[], context?: Record<string, unknown>): string {
    const output = this.createOutput(true, data, errors, context);
    return this.format(output);
  }

  /**
   * Create a structured output object (for custom formatting)
   */
  createOutput<T>(
    success: boolean,
    data: T | null,
    errors: OutputError[],
    context?: Record<string, unknown>
  ): StructuredOutput<T> {
    return {
      success,
      data,
      errors,
      metadata: this.createMetadata(context),
    };
  }

  /**
   * Format a structured output object
   */
  format<T>(output: StructuredOutput<T>): string {
    switch (this.config.format) {
      case 'json':
        return this.formatJSON(output);
      case 'markdown':
        return this.formatMarkdown(output);
      case 'html':
        return this.formatHTML(output);
      case 'text':
      default:
        return this.formatText(output);
    }
  }

  // ===========================================================================
  // Public API - Section-Based Output
  // ===========================================================================

  /**
   * Format output with sections (for complex command output)
   */
  formatSections(sections: OutputSection[], success: boolean = true): string {
    const data = { sections: sections.map(s => ({ title: s.title, content: s.content })) };
    const output = this.createOutput(success, data, []);

    if (this.config.format === 'json') {
      return this.formatJSON(output);
    }

    // For text/markdown/html, format sections directly
    switch (this.config.format) {
      case 'markdown':
        return this.formatSectionsMarkdown(sections);
      case 'html':
        return this.formatSectionsHTML(sections);
      case 'text':
      default:
        return this.formatSectionsText(sections);
    }
  }

  // ===========================================================================
  // Public API - Utility Methods
  // ===========================================================================

  /**
   * Create an error object from an Error instance
   */
  static fromError(err: Error, code: string = 'ERROR'): OutputError {
    const outputError: OutputError = {
      code,
      message: err.message,
    };
    if (err.stack) {
      outputError.stack = err.stack;
    }
    return outputError;
  }

  /**
   * Create an error object from a string
   */
  static errorFromString(message: string, code: string = 'ERROR'): OutputError {
    return { code, message };
  }

  /**
   * Get the current output format
   */
  getFormat(): OutputFormat {
    return this.config.format;
  }

  /**
   * Set the output format
   */
  setFormat(format: OutputFormat): void {
    this.config.format = format;
  }

  // ===========================================================================
  // Private Methods - Metadata
  // ===========================================================================

  private createMetadata(context?: Record<string, unknown>): OutputMetadata {
    const metadata: OutputMetadata = {
      timestamp: new Date().toISOString(),
      version: getVersion(),
      command: this.command,
      durationMs: Date.now() - this.startTime,
    };

    if (context) {
      metadata.context = context;
    }

    return metadata;
  }

  // ===========================================================================
  // Private Methods - JSON Formatting
  // ===========================================================================

  private formatJSON<T>(output: StructuredOutput<T>): string {
    // Remove stack traces if not configured
    const sanitized = this.sanitizeForOutput(output);

    if (this.config.prettyPrint) {
      return JSON.stringify(sanitized, null, 2);
    }
    return JSON.stringify(sanitized);
  }

  private sanitizeForOutput<T>(output: StructuredOutput<T>): StructuredOutput<T> {
    if (this.config.includeStackTraces) {
      return output;
    }

    // Remove stack traces from errors
    return {
      ...output,
      errors: output.errors.map(err => {
        const { stack: _stack, ...rest } = err;
        return rest;
      }),
    };
  }

  // ===========================================================================
  // Private Methods - Text Formatting
  // ===========================================================================

  private formatText<T>(output: StructuredOutput<T>): string {
    const lines: string[] = [];

    // Status line
    if (output.success) {
      lines.push(this.colorize('Success', 'green'));
    } else {
      lines.push(this.colorize('Error', 'red'));
    }
    lines.push('');

    // Data
    if (output.data !== null) {
      lines.push(...this.formatDataText(output.data));
    }

    // Errors
    if (output.errors.length > 0) {
      lines.push('');
      lines.push(this.colorize('Errors:', 'red'));
      for (const err of output.errors) {
        lines.push(`  [${err.code}] ${err.message}`);
        if (this.config.verbose && err.details) {
          lines.push(`    Details: ${JSON.stringify(err.details)}`);
        }
        if (this.config.includeStackTraces && err.stack) {
          lines.push(`    Stack: ${err.stack.split('\n').slice(1, 4).join('\n    ')}`);
        }
      }
    }

    // Metadata (verbose only)
    if (this.config.verbose) {
      lines.push('');
      lines.push(this.colorize('Metadata:', 'dim'));
      lines.push(`  Command: ${output.metadata.command}`);
      lines.push(`  Duration: ${output.metadata.durationMs}ms`);
      lines.push(`  Version: ${output.metadata.version}`);
    }

    return lines.join('\n');
  }

  private formatDataText(data: unknown, indent: number = 0): string[] {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    if (data === null || data === undefined) {
      return lines;
    }

    if (typeof data !== 'object') {
      lines.push(`${prefix}${String(data)}`);
      return lines;
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item !== null) {
          lines.push(...this.formatDataText(item, indent));
          lines.push('');
        } else {
          lines.push(`${prefix}- ${String(item)}`);
        }
      }
      return lines;
    }

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${prefix}${this.colorize(key + ':', 'cyan')}`);
        lines.push(...this.formatDataText(value, indent + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${this.colorize(key + ':', 'cyan')}`);
        for (const item of value) {
          if (typeof item === 'object') {
            lines.push(...this.formatDataText(item, indent + 1));
          } else {
            lines.push(`${prefix}  - ${String(item)}`);
          }
        }
      } else {
        lines.push(`${prefix}${this.colorize(key + ':', 'cyan')} ${String(value)}`);
      }
    }

    return lines;
  }

  // ===========================================================================
  // Private Methods - Markdown Formatting
  // ===========================================================================

  private formatMarkdown<T>(output: StructuredOutput<T>): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${output.success ? 'Success' : 'Error'}`);
    lines.push('');

    // Data
    if (output.data !== null) {
      lines.push('## Data');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(output.data, null, 2));
      lines.push('```');
      lines.push('');
    }

    // Errors
    if (output.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const err of output.errors) {
        lines.push(`- **[${err.code}]** ${err.message}`);
      }
      lines.push('');
    }

    // Metadata
    lines.push('## Metadata');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Command | ${output.metadata.command} |`);
    lines.push(`| Duration | ${output.metadata.durationMs}ms |`);
    lines.push(`| Version | ${output.metadata.version} |`);
    lines.push(`| Timestamp | ${output.metadata.timestamp} |`);

    return lines.join('\n');
  }

  // ===========================================================================
  // Private Methods - HTML Formatting
  // ===========================================================================

  private formatHTML<T>(output: StructuredOutput<T>): string {
    const statusClass = output.success ? 'success' : 'error';
    const statusText = output.success ? 'Success' : 'Error';

    return `<!DOCTYPE html>
<html>
<head>
  <title>CLI Output - ${this.command}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    .success { color: #28a745; }
    .error { color: #dc3545; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    .metadata { color: #666; font-size: 0.9rem; margin-top: 2rem; }
    .error-item { background: #fff5f5; padding: 0.5rem; margin: 0.5rem 0; border-left: 3px solid #dc3545; }
  </style>
</head>
<body>
  <h1 class="${statusClass}">${statusText}</h1>

  ${output.data !== null ? `
  <h2>Data</h2>
  <pre>${this.escapeHtml(JSON.stringify(output.data, null, 2))}</pre>
  ` : ''}

  ${output.errors.length > 0 ? `
  <h2>Errors</h2>
  ${output.errors.map(err => `
  <div class="error-item">
    <strong>[${this.escapeHtml(err.code)}]</strong> ${this.escapeHtml(err.message)}
  </div>
  `).join('')}
  ` : ''}

  <div class="metadata">
    <p>Command: ${this.escapeHtml(output.metadata.command)}</p>
    <p>Duration: ${output.metadata.durationMs}ms</p>
    <p>Version: ${output.metadata.version}</p>
    <p>Timestamp: ${output.metadata.timestamp}</p>
  </div>
</body>
</html>`;
  }

  // ===========================================================================
  // Private Methods - Section Formatting
  // ===========================================================================

  private formatSectionsText(sections: OutputSection[]): string {
    const lines: string[] = [];

    for (const section of sections) {
      const level = section.level ?? 1;
      const separator = level === 1 ? '=' : level === 2 ? '-' : '.';

      lines.push('');
      lines.push(separator.repeat(Math.min(60, section.title.length + 10)));
      lines.push(this.colorize(section.title, 'cyan'));
      lines.push(separator.repeat(Math.min(60, section.title.length + 10)));
      lines.push('');

      if (typeof section.content === 'string') {
        lines.push(section.content);
      } else {
        lines.push(...this.formatDataText(section.content));
      }
    }

    return lines.join('\n');
  }

  private formatSectionsMarkdown(sections: OutputSection[]): string {
    const lines: string[] = [];

    for (const section of sections) {
      const level = section.level ?? 1;
      const prefix = '#'.repeat(Math.min(level, 6));

      lines.push('');
      lines.push(`${prefix} ${section.title}`);
      lines.push('');

      if (typeof section.content === 'string') {
        lines.push(section.content);
      } else {
        lines.push('```json');
        lines.push(JSON.stringify(section.content, null, 2));
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  private formatSectionsHTML(sections: OutputSection[]): string {
    const sectionHTML = sections.map(section => {
      const level = Math.min(section.level ?? 1, 6);
      const contentHTML = typeof section.content === 'string'
        ? `<p>${this.escapeHtml(section.content)}</p>`
        : `<pre>${this.escapeHtml(JSON.stringify(section.content, null, 2))}</pre>`;

      return `<h${level}>${this.escapeHtml(section.title)}</h${level}>${contentHTML}`;
    }).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <title>CLI Output - ${this.command}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
  </style>
</head>
<body>
  ${sectionHTML}
</body>
</html>`;
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  private colorize(text: string, color: string): string {
    if (!this.config.color) {
      return text;
    }

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      dim: '\x1b[2m',
      reset: '\x1b[0m',
    };

    const colorCode = colors[color] ?? '';
    const reset = colors.reset ?? '';

    return `${colorCode}${text}${reset}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an output formatter for a command
 */
export function createOutputFormatter(
  command: string,
  config?: Partial<OutputFormatterConfig>
): OutputFormatter {
  return new OutputFormatter(command, config);
}

/**
 * Quick success output
 */
export function formatSuccess<T>(
  command: string,
  data: T,
  format: OutputFormat = 'json'
): string {
  const formatter = new OutputFormatter(command, { format });
  return formatter.success(data);
}

/**
 * Quick error output
 */
export function formatError(
  command: string,
  error: Error | string,
  format: OutputFormat = 'json'
): string {
  const formatter = new OutputFormatter(command, { format });
  const outputError = typeof error === 'string'
    ? OutputFormatter.errorFromString(error)
    : OutputFormatter.fromError(error);
  return formatter.error(outputError);
}
