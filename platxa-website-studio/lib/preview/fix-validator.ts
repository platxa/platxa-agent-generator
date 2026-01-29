/**
 * Fix Validator
 *
 * Validates fixes before applying them permanently:
 * - Applies fix to temporary copy
 * - Runs validation checks (syntax, types, etc.)
 * - Only applies if validation passes
 */

import { randomUUID } from "crypto";

// =============================================================================
// Types
// =============================================================================

/** Fix to be validated */
export interface Fix {
  /** Unique fix identifier */
  id: string;
  /** File path to apply fix to */
  filePath: string;
  /** Original content */
  originalContent: string;
  /** Fixed content */
  fixedContent: string;
  /** Fix description */
  description?: string;
  /** Line number of fix */
  lineNumber?: number;
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Time taken to validate (ms) */
  validationTime: number;
  /** Validators that ran */
  validatorsRun: string[];
  /** Temporary file path used */
  tempFilePath?: string;
}

/** Validation error */
export interface ValidationError {
  /** Error type */
  type: "syntax" | "type" | "lint" | "runtime" | "custom";
  /** Error message */
  message: string;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Source of error */
  source: string;
}

/** Validation warning */
export interface ValidationWarning {
  /** Warning type */
  type: string;
  /** Warning message */
  message: string;
  /** Line number if applicable */
  line?: number;
}

/** Validator function */
export type ValidatorFn = (
  content: string,
  filePath: string,
  options?: Record<string, unknown>
) => Promise<ValidatorResult> | ValidatorResult;

/** Validator result */
export interface ValidatorResult {
  /** Whether validation passed */
  passed: boolean;
  /** Errors found */
  errors: ValidationError[];
  /** Warnings found */
  warnings: ValidationWarning[];
}

/** Validator configuration */
export interface ValidatorConfig {
  /** Validator name */
  name: string;
  /** Validator function */
  validate: ValidatorFn;
  /** File extensions this validator applies to */
  extensions?: string[];
  /** Whether validator is enabled */
  enabled?: boolean;
}

/** Fix validator configuration */
export interface FixValidatorConfig {
  /** Validators to use */
  validators: ValidatorConfig[];
  /** Create temp file for validation */
  useTempFile: boolean;
  /** Temp directory path */
  tempDir?: string;
  /** Stop on first error */
  stopOnFirstError: boolean;
  /** Validation timeout (ms) */
  timeout: number;
  /** Auto-apply if valid */
  autoApplyIfValid: boolean;
}

/** Apply result */
export interface ApplyResult {
  /** Whether fix was applied */
  applied: boolean;
  /** Validation result */
  validation: ValidationResult;
  /** Error message if failed */
  error?: string;
  /** Backup path if created */
  backupPath?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default fix validator configuration */
export const DEFAULT_VALIDATOR_CONFIG: FixValidatorConfig = {
  validators: [],
  useTempFile: true,
  stopOnFirstError: false,
  timeout: 30000,
  autoApplyIfValid: false,
};

// =============================================================================
// Built-in Validators
// =============================================================================

/**
 * Validates JavaScript/TypeScript syntax.
 */
export function createSyntaxValidator(): ValidatorConfig {
  return {
    name: "syntax",
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    validate: (content: string, filePath: string): ValidatorResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      try {
        // Basic syntax check - look for common syntax errors
        const syntaxPatterns = [
          { pattern: /\(\s*\)[\s\n]*{[\s\n]*}[\s\n]*\)/, message: "Possible extra closing parenthesis" },
          { pattern: /{\s*{\s*{/, message: "Possible triple brace nesting error" },
          { pattern: /}\s*}\s*}\s*}/, message: "Possible extra closing braces" },
          { pattern: /,\s*,/, message: "Double comma detected" },
          { pattern: /\.\s*\./, message: "Double dot detected" },
          { pattern: /;;\s*;/, message: "Multiple semicolons detected" },
        ];

        for (const { pattern, message } of syntaxPatterns) {
          const match = content.match(pattern);
          if (match) {
            const line = content.substring(0, match.index).split("\n").length;
            errors.push({
              type: "syntax",
              message,
              line,
              source: "syntax-validator",
            });
          }
        }

        // Check bracket balance
        const brackets = { "(": 0, "[": 0, "{": 0 };
        const closers: Record<string, keyof typeof brackets> = { ")": "(", "]": "[", "}": "{" };

        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (char in brackets) {
            brackets[char as keyof typeof brackets]++;
          } else if (char in closers) {
            brackets[closers[char]]--;
          }
        }

        for (const [bracket, count] of Object.entries(brackets)) {
          if (count > 0) {
            errors.push({
              type: "syntax",
              message: `Unclosed '${bracket}' bracket (${count} unclosed)`,
              source: "syntax-validator",
            });
          } else if (count < 0) {
            errors.push({
              type: "syntax",
              message: `Extra closing bracket for '${bracket}' (${Math.abs(count)} extra)`,
              source: "syntax-validator",
            });
          }
        }

        // Check string balance (simplified)
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip comments
          if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

          // Check for unterminated strings (simplified check)
          const singleQuotes = (line.match(/'/g) || []).length;
          const doubleQuotes = (line.match(/"/g) || []).length;
          const backticks = (line.match(/`/g) || []).length;

          // Odd number of quotes might indicate unterminated string
          // (This is a simplified check - real parser would be needed for accuracy)
          if (singleQuotes % 2 !== 0 && !line.includes("'")) {
            warnings.push({
              type: "possible-unterminated-string",
              message: "Possible unterminated single-quoted string",
              line: i + 1,
            });
          }
        }

      } catch (e) {
        errors.push({
          type: "syntax",
          message: `Syntax validation error: ${e instanceof Error ? e.message : String(e)}`,
          source: "syntax-validator",
        });
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

/**
 * Validates JSON syntax.
 */
export function createJSONValidator(): ValidatorConfig {
  return {
    name: "json",
    extensions: [".json"],
    validate: (content: string): ValidatorResult => {
      const errors: ValidationError[] = [];

      try {
        JSON.parse(content);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const lineMatch = message.match(/line (\d+)/i);
        const posMatch = message.match(/position (\d+)/i);

        errors.push({
          type: "syntax",
          message: `Invalid JSON: ${message}`,
          line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
          column: posMatch ? parseInt(posMatch[1], 10) : undefined,
          source: "json-validator",
        });
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings: [],
      };
    },
  };
}

/**
 * Validates XML/HTML basic structure.
 */
export function createXMLValidator(): ValidatorConfig {
  return {
    name: "xml",
    extensions: [".xml", ".html", ".htm", ".svg"],
    validate: (content: string): ValidatorResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check for unclosed tags (simplified)
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g;
      const tagStack: Array<{ tag: string; line: number }> = [];
      const selfClosing = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"]);

      let match;
      let lineNum = 1;
      let lastIndex = 0;

      while ((match = tagPattern.exec(content)) !== null) {
        // Count lines
        lineNum += content.substring(lastIndex, match.index).split("\n").length - 1;
        lastIndex = match.index;

        const fullMatch = match[0];
        const tagName = match[1].toLowerCase();

        // Skip self-closing tags
        if (selfClosing.has(tagName) || fullMatch.endsWith("/>")) {
          continue;
        }

        if (fullMatch.startsWith("</")) {
          // Closing tag
          if (tagStack.length === 0) {
            errors.push({
              type: "syntax",
              message: `Unexpected closing tag </${tagName}>`,
              line: lineNum,
              source: "xml-validator",
            });
          } else {
            const last = tagStack.pop()!;
            if (last.tag !== tagName) {
              errors.push({
                type: "syntax",
                message: `Mismatched tags: expected </${last.tag}>, found </${tagName}>`,
                line: lineNum,
                source: "xml-validator",
              });
            }
          }
        } else {
          // Opening tag
          tagStack.push({ tag: tagName, line: lineNum });
        }
      }

      // Check for unclosed tags
      for (const { tag, line } of tagStack) {
        errors.push({
          type: "syntax",
          message: `Unclosed tag <${tag}>`,
          line,
          source: "xml-validator",
        });
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

/**
 * Validates CSS/SCSS basic syntax.
 */
export function createCSSValidator(): ValidatorConfig {
  return {
    name: "css",
    extensions: [".css", ".scss", ".less"],
    validate: (content: string): ValidatorResult => {
      const errors: ValidationError[] = [];

      // Check brace balance
      let braceCount = 0;
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;

          if (braceCount < 0) {
            errors.push({
              type: "syntax",
              message: "Unexpected closing brace",
              line: i + 1,
              source: "css-validator",
            });
            braceCount = 0;
          }
        }
      }

      if (braceCount > 0) {
        errors.push({
          type: "syntax",
          message: `${braceCount} unclosed brace(s)`,
          source: "css-validator",
        });
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings: [],
      };
    },
  };
}

/**
 * Validates Python basic syntax.
 */
export function createPythonValidator(): ValidatorConfig {
  return {
    name: "python",
    extensions: [".py"],
    validate: (content: string): ValidatorResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      const lines = content.split("\n");

      // Check indentation consistency
      let expectedIndent = 0;
      let indentChar: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "" || line.trim().startsWith("#")) continue;

        const leadingSpace = line.match(/^(\s*)/)?.[1] || "";

        // Detect indent character
        if (indentChar === null && leadingSpace.length > 0) {
          indentChar = leadingSpace[0];
        }

        // Check for mixed tabs and spaces
        if (leadingSpace.includes("\t") && leadingSpace.includes(" ")) {
          errors.push({
            type: "syntax",
            message: "Mixed tabs and spaces in indentation",
            line: i + 1,
            source: "python-validator",
          });
        }

        // Check for colon at end of block statements
        const blockKeywords = /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
        if (blockKeywords.test(line.trim()) && !line.trim().endsWith(":")) {
          errors.push({
            type: "syntax",
            message: "Block statement missing colon",
            line: i + 1,
            source: "python-validator",
          });
        }
      }

      return {
        passed: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

// =============================================================================
// Temp File Management
// =============================================================================

/**
 * Creates a temporary file path.
 */
export function createTempFilePath(originalPath: string, tempDir?: string): string {
  const ext = originalPath.substring(originalPath.lastIndexOf("."));
  const id = randomUUID().substring(0, 8);
  const dir = tempDir || "/tmp";
  return `${dir}/fix-validation-${id}${ext}`;
}

/**
 * Simulates writing to temp file (in-memory for testing).
 */
export function writeTempFile(path: string, content: string): void {
  // In real implementation, would write to filesystem
  // For now, we track in memory for testing
  tempFileStore.set(path, content);
}

/**
 * Simulates reading temp file.
 */
export function readTempFile(path: string): string | null {
  return tempFileStore.get(path) ?? null;
}

/**
 * Simulates deleting temp file.
 */
export function deleteTempFile(path: string): void {
  tempFileStore.delete(path);
}

/** In-memory temp file store for testing */
const tempFileStore = new Map<string, string>();

/**
 * Clears all temp files.
 */
export function clearTempFiles(): void {
  tempFileStore.clear();
}

// =============================================================================
// Fix Validator Class
// =============================================================================

/**
 * Validates fixes before applying them.
 */
export class FixValidator {
  private config: FixValidatorConfig;
  private validationHistory: Map<string, ValidationResult> = new Map();

  constructor(config: Partial<FixValidatorConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };

    // Add default validators if none provided
    if (this.config.validators.length === 0) {
      this.config.validators = [
        createSyntaxValidator(),
        createJSONValidator(),
        createXMLValidator(),
        createCSSValidator(),
        createPythonValidator(),
      ];
    }
  }

  /**
   * Validates a fix without applying it.
   */
  async validate(fix: Fix): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const validatorsRun: string[] = [];

    // Get file extension
    const ext = fix.filePath.substring(fix.filePath.lastIndexOf(".")).toLowerCase();

    // Create temp file path
    let tempFilePath: string | undefined;
    if (this.config.useTempFile) {
      tempFilePath = createTempFilePath(fix.filePath, this.config.tempDir);
      writeTempFile(tempFilePath, fix.fixedContent);
    }

    // Run applicable validators
    for (const validator of this.config.validators) {
      if (validator.enabled === false) continue;

      // Check if validator applies to this file type
      if (validator.extensions && !validator.extensions.includes(ext)) {
        continue;
      }

      validatorsRun.push(validator.name);

      try {
        const result = await Promise.resolve(
          validator.validate(fix.fixedContent, fix.filePath)
        );

        errors.push(...result.errors);
        warnings.push(...result.warnings);

        if (this.config.stopOnFirstError && result.errors.length > 0) {
          break;
        }
      } catch (e) {
        errors.push({
          type: "runtime",
          message: `Validator '${validator.name}' threw error: ${e instanceof Error ? e.message : String(e)}`,
          source: validator.name,
        });
      }
    }

    // Clean up temp file
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: Date.now() - startTime,
      validatorsRun,
      tempFilePath,
    };

    // Store in history
    this.validationHistory.set(fix.id, result);

    return result;
  }

  /**
   * Validates and optionally applies a fix.
   */
  async validateAndApply(
    fix: Fix,
    applyFn?: (fix: Fix) => Promise<void> | void
  ): Promise<ApplyResult> {
    const validation = await this.validate(fix);

    if (!validation.isValid) {
      return {
        applied: false,
        validation,
        error: `Validation failed with ${validation.errors.length} error(s)`,
      };
    }

    // Apply fix if valid and auto-apply is enabled or applyFn provided
    if (this.config.autoApplyIfValid || applyFn) {
      try {
        if (applyFn) {
          await applyFn(fix);
        }
        return {
          applied: true,
          validation,
        };
      } catch (e) {
        return {
          applied: false,
          validation,
          error: `Failed to apply fix: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }

    return {
      applied: false,
      validation,
    };
  }

  /**
   * Validates fix synchronously.
   */
  validateSync(fix: Fix): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const validatorsRun: string[] = [];

    const ext = fix.filePath.substring(fix.filePath.lastIndexOf(".")).toLowerCase();

    let tempFilePath: string | undefined;
    if (this.config.useTempFile) {
      tempFilePath = createTempFilePath(fix.filePath, this.config.tempDir);
      writeTempFile(tempFilePath, fix.fixedContent);
    }

    for (const validator of this.config.validators) {
      if (validator.enabled === false) continue;
      if (validator.extensions && !validator.extensions.includes(ext)) continue;

      validatorsRun.push(validator.name);

      try {
        const result = validator.validate(fix.fixedContent, fix.filePath);
        // Handle sync result only
        if (result && "passed" in result) {
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        }

        if (this.config.stopOnFirstError && errors.length > 0) break;
      } catch (e) {
        errors.push({
          type: "runtime",
          message: `Validator error: ${e instanceof Error ? e.message : String(e)}`,
          source: validator.name,
        });
      }
    }

    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationTime: Date.now() - startTime,
      validatorsRun,
      tempFilePath,
    };

    this.validationHistory.set(fix.id, result);
    return result;
  }

  /**
   * Gets validation history for a fix.
   */
  getValidationHistory(fixId: string): ValidationResult | undefined {
    return this.validationHistory.get(fixId);
  }

  /**
   * Clears validation history.
   */
  clearHistory(): void {
    this.validationHistory.clear();
  }

  /**
   * Adds a custom validator.
   */
  addValidator(validator: ValidatorConfig): void {
    this.config.validators.push(validator);
  }

  /**
   * Removes a validator by name.
   */
  removeValidator(name: string): boolean {
    const index = this.config.validators.findIndex((v) => v.name === name);
    if (index === -1) return false;
    this.config.validators.splice(index, 1);
    return true;
  }

  /**
   * Enables/disables a validator.
   */
  setValidatorEnabled(name: string, enabled: boolean): void {
    const validator = this.config.validators.find((v) => v.name === name);
    if (validator) {
      validator.enabled = enabled;
    }
  }

  /**
   * Gets all validators.
   */
  getValidators(): ValidatorConfig[] {
    return [...this.config.validators];
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<FixValidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): FixValidatorConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a FixValidator instance.
 */
export function createFixValidator(
  config?: Partial<FixValidatorConfig>
): FixValidator {
  return new FixValidator(config);
}

/**
 * Creates a Fix object.
 */
export function createFix(
  filePath: string,
  originalContent: string,
  fixedContent: string,
  options: Partial<Omit<Fix, "filePath" | "originalContent" | "fixedContent">> = {}
): Fix {
  return {
    id: options.id ?? randomUUID(),
    filePath,
    originalContent,
    fixedContent,
    ...options,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats validation result for display.
 */
export function formatValidationResult(result: ValidationResult): string {
  const parts: string[] = [];

  parts.push(`Validation ${result.isValid ? "PASSED" : "FAILED"}`);
  parts.push(`Time: ${result.validationTime}ms`);
  parts.push(`Validators: ${result.validatorsRun.join(", ")}`);

  if (result.errors.length > 0) {
    parts.push("\nErrors:");
    for (const error of result.errors) {
      const location = error.line ? `:${error.line}${error.column ? `:${error.column}` : ""}` : "";
      parts.push(`  [${error.type}${location}] ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    parts.push("\nWarnings:");
    for (const warning of result.warnings) {
      const location = warning.line ? `:${warning.line}` : "";
      parts.push(`  [${warning.type}${location}] ${warning.message}`);
    }
  }

  return parts.join("\n");
}

/**
 * Checks if a fix is safe to apply (no errors, few warnings).
 */
export function isSafeToApply(result: ValidationResult, maxWarnings: number = 3): boolean {
  return result.isValid && result.warnings.length <= maxWarnings;
}

/**
 * Gets summary of validation errors.
 */
export function getErrorSummary(result: ValidationResult): string {
  if (result.isValid) return "No errors";

  const byType = result.errors.reduce((acc, err) => {
    acc[err.type] = (acc[err.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(byType)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
}
