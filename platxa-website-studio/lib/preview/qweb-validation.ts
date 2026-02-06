/**
 * QWeb Validation Error Capture
 *
 * Validates QWeb templates and captures structured errors with:
 * - Template name
 * - Line number
 * - Directive type
 * - Error message
 *
 * Phase 3: Upgraded to use AST-based parsing via qweb-parser.ts
 * for more accurate validation of nested structures.
 */

import {
  parseQWeb,
  type QWebASTNode,
  type QWebParseResult,
  hasDirective,
  getDirectiveValue,
} from "./qweb-parser";

// =============================================================================
// Types
// =============================================================================

/** QWeb directive types */
export type QWebDirective =
  | "t-if"
  | "t-elif"
  | "t-else"
  | "t-foreach"
  | "t-as"
  | "t-esc"
  | "t-raw"
  | "t-out"
  | "t-call"
  | "t-set"
  | "t-value"
  | "t-att"
  | "t-attf"
  | "t-field"
  | "t-name"
  | "t-inherit"
  | "t-extend"
  | "unknown";

/** Structured QWeb validation error */
export interface QWebValidationError {
  /** Error message */
  message: string;
  /** Template name (from t-name attribute or file) */
  templateName: string | null;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number | null;
  /** Directive that caused the error */
  directive: QWebDirective | null;
  /** Full directive attribute (e.g., "t-if=\"expr\"") */
  directiveValue: string | null;
  /** The element tag name where error occurred */
  elementTag: string | null;
  /** Error severity */
  severity: "error" | "warning";
  /** Error code for categorization */
  code: QWebErrorCode;
  /** Source file path */
  file: string | null;
}

/** QWeb error codes */
export type QWebErrorCode =
  | "MISSING_T_AS"
  | "MISSING_T_FOREACH"
  | "ORPHAN_T_ELIF"
  | "ORPHAN_T_ELSE"
  | "INVALID_EXPRESSION"
  | "MISSING_TEMPLATE_NAME"
  | "UNCLOSED_ELEMENT"
  | "MISMATCHED_TAGS"
  | "INVALID_DIRECTIVE"
  | "DUPLICATE_DIRECTIVE"
  | "MISSING_REQUIRED_ATTR"
  | "SYNTAX_ERROR"
  | "UNKNOWN";

/** Result of QWeb validation */
export interface QWebValidationResult {
  /** Whether validation passed without errors */
  valid: boolean;
  /** List of validation errors */
  errors: QWebValidationError[];
  /** List of warnings */
  warnings: QWebValidationError[];
  /** Template names found in the content */
  templateNames: string[];
  /** Total lines processed */
  linesProcessed: number;
}

/** Options for QWeb validator */
export interface QWebValidatorOptions {
  /** Source file path for error reporting */
  file?: string;
  /** Whether to validate expressions (default: false) */
  validateExpressions?: boolean;
  /** Whether to check for deprecated directives (default: true) */
  checkDeprecated?: boolean;
  /** Use AST-based validation for better accuracy (default: true) */
  useAST?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** All valid QWeb directives */
const VALID_DIRECTIVES = new Set([
  "t-if",
  "t-elif",
  "t-else",
  "t-foreach",
  "t-as",
  "t-esc",
  "t-raw",
  "t-out",
  "t-call",
  "t-set",
  "t-value",
  "t-att",
  "t-attf",
  "t-field",
  "t-name",
  "t-inherit",
  "t-inherit-mode",
  "t-extend",
  "t-translation",
  "t-debug",
  "t-log",
  "t-js",
  "t-cache",
  "t-nocache",
  "t-options",
  "t-tag",
  "t-portal",
]);

/** Directives that require specific paired directives */
const DIRECTIVE_REQUIREMENTS: Record<string, string[]> = {
  "t-as": ["t-foreach"],
  "t-foreach": ["t-as"],
  "t-value": ["t-set"],
};

/** Deprecated directives and their replacements */
const DEPRECATED_DIRECTIVES: Record<string, string> = {
  "t-raw": "t-out with t-options=\"{'widget': 'html'}\"",
};

// =============================================================================
// QWebValidator Class
// =============================================================================

/**
 * Validates QWeb templates and captures structured errors.
 *
 * @example
 * ```typescript
 * const validator = new QWebValidator({ file: 'template.xml' });
 * const result = validator.validate(qwebContent);
 *
 * if (!result.valid) {
 *   for (const error of result.errors) {
 *     console.error(`${error.file}:${error.line} - ${error.message}`);
 *   }
 * }
 * ```
 */
export class QWebValidator {
  private options: Required<QWebValidatorOptions>;

  constructor(options: QWebValidatorOptions = {}) {
    this.options = {
      file: options.file ?? null,
      validateExpressions: options.validateExpressions ?? false,
      checkDeprecated: options.checkDeprecated ?? true,
      useAST: options.useAST ?? false, // Line-based is default (handles malformed XML better)
    } as Required<QWebValidatorOptions>;
  }

  /**
   * Validate QWeb content and return structured errors.
   * Uses AST-based validation by default for better accuracy.
   */
  validate(content: string): QWebValidationResult {
    // Use AST-based validation when enabled (default)
    if (this.options.useAST) {
      return this.validateWithAST(content);
    }

    // Fallback to line-based validation
    const errors: QWebValidationError[] = [];
    const warnings: QWebValidationError[] = [];
    const templateNames: string[] = [];
    const lines = content.split("\n");

    let currentTemplateName: string | null = null;
    const conditionalStack: Array<{ directive: string; line: number }> = [];
    const tagStack: Array<{ tag: string; line: number }> = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNum = lineIndex + 1;

      // Track template names
      const templateNameMatch = line.match(/t-name=["']([^"']+)["']/);
      if (templateNameMatch) {
        currentTemplateName = templateNameMatch[1];
        templateNames.push(currentTemplateName);
      }

      // Check for opening/closing tags
      this.trackTags(line, lineNum, tagStack, errors, currentTemplateName);

      // Find all directives on this line
      const directiveMatches = this.findDirectives(line);

      for (const match of directiveMatches) {
        const { directive, value, column } = match;

        // Check for invalid directives
        if (!this.isValidDirective(directive)) {
          errors.push(
            this.createError({
              message: `Unknown QWeb directive: ${directive}`,
              templateName: currentTemplateName,
              line: lineNum,
              column,
              directive: "unknown",
              directiveValue: `${directive}="${value}"`,
              code: "INVALID_DIRECTIVE",
            })
          );
          continue;
        }

        // Check for deprecated directives
        if (this.options.checkDeprecated && DEPRECATED_DIRECTIVES[directive]) {
          warnings.push(
            this.createError({
              message: `Deprecated directive '${directive}'. Use ${DEPRECATED_DIRECTIVES[directive]} instead.`,
              templateName: currentTemplateName,
              line: lineNum,
              column,
              directive: directive as QWebDirective,
              directiveValue: `${directive}="${value}"`,
              code: "INVALID_DIRECTIVE",
              severity: "warning",
            })
          );
        }

        // Check directive requirements
        this.checkDirectiveRequirements(
          directive,
          value,
          line,
          lineNum,
          column,
          currentTemplateName,
          errors
        );

        // Track conditional blocks
        this.trackConditionals(
          directive,
          lineNum,
          column,
          conditionalStack,
          currentTemplateName,
          errors
        );

        // Validate expression syntax if enabled
        if (this.options.validateExpressions && value) {
          this.validateExpression(
            value,
            directive,
            lineNum,
            column,
            currentTemplateName,
            errors
          );
        }
      }
    }

    // Check for unclosed conditionals
    for (const cond of conditionalStack) {
      if (cond.directive === "t-if") {
        // t-if doesn't require closing, only check if t-elif/t-else are orphaned
      }
    }

    // Check for unclosed tags
    for (const tag of tagStack) {
      errors.push(
        this.createError({
          message: `Unclosed element: <${tag.tag}>`,
          templateName: currentTemplateName,
          line: tag.line,
          column: null,
          directive: null,
          directiveValue: null,
          elementTag: tag.tag,
          code: "UNCLOSED_ELEMENT",
        })
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      templateNames,
      linesProcessed: lines.length,
    };
  }

  /**
   * Find all QWeb directives on a line.
   */
  private findDirectives(
    line: string
  ): Array<{ directive: string; value: string; column: number }> {
    const results: Array<{ directive: string; value: string; column: number }> =
      [];

    // Match t-* attributes with values
    const directiveRegex = /(t-[\w-]+)(?:=["']([^"']*)["'])?/g;
    let match;

    while ((match = directiveRegex.exec(line)) !== null) {
      results.push({
        directive: match[1],
        value: match[2] ?? "",
        column: match.index + 1,
      });
    }

    return results;
  }

  /**
   * Check if a directive is valid.
   */
  private isValidDirective(directive: string): boolean {
    if (VALID_DIRECTIVES.has(directive)) {
      return true;
    }

    // Check for dynamic attribute directives (t-att-*, t-attf-*)
    if (directive.startsWith("t-att-") || directive.startsWith("t-attf-")) {
      return true;
    }

    return false;
  }

  /**
   * Check directive requirements (e.g., t-foreach requires t-as).
   */
  private checkDirectiveRequirements(
    directive: string,
    _value: string,
    line: string,
    lineNum: number,
    column: number,
    templateName: string | null,
    errors: QWebValidationError[]
  ): void {
    const requirements = DIRECTIVE_REQUIREMENTS[directive];
    if (!requirements) return;

    for (const required of requirements) {
      // Check for actual directive attribute, not just string content
      // Must match t-as= or t-as (with whitespace/end) to avoid matching text content like "No t-as"
      const directivePattern = new RegExp(`\\b${required}(?:=|\\s|>|/)`);
      if (!directivePattern.test(line)) {
        errors.push(
          this.createError({
            message: `Directive '${directive}' requires '${required}' on the same element`,
            templateName,
            line: lineNum,
            column,
            directive: directive as QWebDirective,
            directiveValue: null,
            code:
              required === "t-as"
                ? "MISSING_T_AS"
                : required === "t-foreach"
                  ? "MISSING_T_FOREACH"
                  : "MISSING_REQUIRED_ATTR",
          })
        );
      }
    }
  }

  /**
   * Track conditional directive chains (t-if/t-elif/t-else).
   */
  private trackConditionals(
    directive: string,
    lineNum: number,
    column: number,
    stack: Array<{ directive: string; line: number }>,
    templateName: string | null,
    errors: QWebValidationError[]
  ): void {
    if (directive === "t-if") {
      stack.push({ directive, line: lineNum });
    } else if (directive === "t-elif") {
      const last = stack[stack.length - 1];
      if (!last || (last.directive !== "t-if" && last.directive !== "t-elif")) {
        errors.push(
          this.createError({
            message:
              "t-elif must follow a t-if or another t-elif on a sibling element",
            templateName,
            line: lineNum,
            column,
            directive: "t-elif",
            directiveValue: null,
            code: "ORPHAN_T_ELIF",
          })
        );
      } else {
        stack[stack.length - 1] = { directive: "t-elif", line: lineNum };
      }
    } else if (directive === "t-else") {
      const last = stack[stack.length - 1];
      if (!last || (last.directive !== "t-if" && last.directive !== "t-elif")) {
        errors.push(
          this.createError({
            message:
              "t-else must follow a t-if or t-elif on a sibling element",
            templateName,
            line: lineNum,
            column,
            directive: "t-else",
            directiveValue: null,
            code: "ORPHAN_T_ELSE",
          })
        );
      } else {
        stack.pop(); // End of conditional chain
      }
    }
  }

  /**
   * Track opening/closing tags for mismatch detection.
   */
  private trackTags(
    line: string,
    lineNum: number,
    stack: Array<{ tag: string; line: number }>,
    errors: QWebValidationError[],
    templateName: string | null
  ): void {
    const selfClosingTags = new Set([
      "br",
      "hr",
      "img",
      "input",
      "meta",
      "link",
      "area",
      "base",
      "col",
      "embed",
      "param",
      "source",
      "track",
      "wbr",
    ]);

    // Find opening tags
    const openingRegex = /<([a-zA-Z][\w-]*)[^>]*(?<!\/)\s*>/g;
    let match;

    while ((match = openingRegex.exec(line)) !== null) {
      const tag = match[1].toLowerCase();
      if (!selfClosingTags.has(tag) && tag !== "t") {
        stack.push({ tag, line: lineNum });
      }
    }

    // Find closing tags
    const closingRegex = /<\/([a-zA-Z][\w-]*)\s*>/g;
    while ((match = closingRegex.exec(line)) !== null) {
      const tag = match[1].toLowerCase();
      if (tag === "t") continue;

      const lastOpen = stack[stack.length - 1];
      if (lastOpen && lastOpen.tag === tag) {
        stack.pop();
      } else if (lastOpen) {
        errors.push(
          this.createError({
            message: `Mismatched closing tag: expected </${lastOpen.tag}>, found </${tag}>`,
            templateName,
            line: lineNum,
            column: match.index + 1,
            directive: null,
            directiveValue: null,
            elementTag: tag,
            code: "MISMATCHED_TAGS",
          })
        );
      }
    }
  }

  /**
   * Validate expression syntax.
   */
  private validateExpression(
    expr: string,
    directive: string,
    lineNum: number,
    column: number,
    templateName: string | null,
    errors: QWebValidationError[]
  ): void {
    // Basic expression validation
    const trimmed = expr.trim();

    // Check for unbalanced parentheses
    let parenCount = 0;
    let bracketCount = 0;
    for (const char of trimmed) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;

      if (parenCount < 0 || bracketCount < 0) {
        errors.push(
          this.createError({
            message: `Unbalanced brackets in expression: ${expr}`,
            templateName,
            line: lineNum,
            column,
            directive: directive as QWebDirective,
            directiveValue: `${directive}="${expr}"`,
            code: "INVALID_EXPRESSION",
          })
        );
        return;
      }
    }

    if (parenCount !== 0 || bracketCount !== 0) {
      errors.push(
        this.createError({
          message: `Unbalanced brackets in expression: ${expr}`,
          templateName,
          line: lineNum,
          column,
          directive: directive as QWebDirective,
          directiveValue: `${directive}="${expr}"`,
          code: "INVALID_EXPRESSION",
        })
      );
    }
  }

  /**
   * Create a validation error object.
   */
  private createError(
    params: Omit<QWebValidationError, "file" | "severity" | "elementTag"> & {
      severity?: "error" | "warning";
      elementTag?: string | null;
    }
  ): QWebValidationError {
    return {
      message: params.message,
      templateName: params.templateName,
      line: params.line,
      column: params.column,
      directive: params.directive,
      directiveValue: params.directiveValue,
      elementTag: params.elementTag ?? null,
      severity: params.severity ?? "error",
      code: params.code,
      file: this.options.file,
    };
  }

  // ===========================================================================
  // AST-Based Validation (Phase 3)
  // ===========================================================================

  /**
   * Validate using AST parser for more accurate structural validation.
   * This method uses the qweb-parser.ts for proper XML parsing.
   */
  validateWithAST(content: string): QWebValidationResult {
    const errors: QWebValidationError[] = [];
    const warnings: QWebValidationError[] = [];
    const templateNames: string[] = [];
    const lines = content.split("\n");

    // Parse content using AST parser
    let parseResult: QWebParseResult;
    try {
      parseResult = parseQWeb(content);
    } catch (error) {
      // AST parsing failed - fall back to line-based validation for better error detection
      // Line-based validation handles malformed XML (unclosed tags, mismatched tags) better
      const fallbackValidator = new QWebValidator({
        ...this.options,
        useAST: false, // Force line-based validation
      });
      return fallbackValidator.validate(content);
    }

    // Add parser warnings
    for (const warning of parseResult.warnings) {
      warnings.push(
        this.createError({
          message: warning,
          templateName: null,
          line: 1,
          column: null,
          directive: null,
          directiveValue: null,
          code: "SYNTAX_ERROR",
          severity: "warning",
        })
      );
    }

    // Collect template names
    templateNames.push(...parseResult.templateNames);

    // Validate AST nodes recursively
    this.validateASTNode(parseResult.ast, null, errors, warnings, [], lines);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      templateNames,
      linesProcessed: content.split("\n").length,
    };
  }

  /**
   * Recursively validate an AST node and its children.
   */
  private validateASTNode(
    node: QWebASTNode,
    templateName: string | null,
    errors: QWebValidationError[],
    warnings: QWebValidationError[],
    siblingDirectives: string[],
    lines: string[]
  ): void {
    // Skip text and comment nodes
    if (node.tag === "#text" || node.tag === "#comment") {
      return;
    }

    // Extract template name if present
    const tName = getDirectiveValue(node, "t-name");
    if (tName) {
      templateName = tName;
    }

    // Calculate line number by finding the tag in source
    let line = node.location?.line ?? 1;
    let column = node.location?.column ?? null;

    // Find line number by searching for the element in source
    if (node.tag && node.tag !== "#fragment") {
      const tagPattern = new RegExp(`<${node.tag}[\\s>]`);
      for (let i = 0; i < lines.length; i++) {
        if (tagPattern.test(lines[i])) {
          // Verify this is the right element by checking directives
          const lineHasAllDirectives = node.directives.every(d =>
            lines[i].includes(d.type) || lines[i].includes(`${d.type}=`)
          );
          if (lineHasAllDirectives || node.directives.length === 0) {
            line = i + 1;
            const match = lines[i].match(tagPattern);
            if (match && match.index !== undefined) {
              column = match.index + 1;
            }
            break;
          }
        }
      }
    }

    // Check for unknown/invalid directives
    for (const directive of node.directives) {
      const dirType = directive.type;
      // Check if it's a valid directive or dynamic attribute (t-att-*, t-attf-*)
      const isValid = VALID_DIRECTIVES.has(dirType) ||
        dirType.startsWith("t-att-") ||
        dirType.startsWith("t-attf-") ||
        dirType === "t-att" ||
        dirType === "t-attf";

      if (!isValid) {
        errors.push(
          this.createError({
            message: `Unknown QWeb directive: ${dirType}`,
            templateName,
            line,
            column,
            directive: "unknown",
            directiveValue: `${dirType}="${directive.value}"`,
            code: "INVALID_DIRECTIVE",
          })
        );
      }
    }

    // Check t-foreach requires t-as
    if (hasDirective(node, "t-foreach") && !hasDirective(node, "t-as")) {
      errors.push(
        this.createError({
          message: "Directive 't-foreach' requires 't-as' on the same element",
          templateName,
          line,
          column,
          directive: "t-foreach",
          directiveValue: getDirectiveValue(node, "t-foreach") ?? null,
          code: "MISSING_T_AS",
        })
      );
    }

    // Check t-as requires t-foreach
    if (hasDirective(node, "t-as") && !hasDirective(node, "t-foreach")) {
      errors.push(
        this.createError({
          message: "Directive 't-as' requires 't-foreach' on the same element",
          templateName,
          line,
          column,
          directive: "t-as",
          directiveValue: getDirectiveValue(node, "t-as") ?? null,
          code: "MISSING_T_FOREACH",
        })
      );
    }

    // Check t-elif/t-else must follow t-if
    if (hasDirective(node, "t-elif")) {
      if (!siblingDirectives.includes("t-if") && !siblingDirectives.includes("t-elif")) {
        errors.push(
          this.createError({
            message: "t-elif must follow a t-if or another t-elif on a sibling element",
            templateName,
            line,
            column,
            directive: "t-elif",
            directiveValue: getDirectiveValue(node, "t-elif") ?? null,
            code: "ORPHAN_T_ELIF",
          })
        );
      }
    }

    if (hasDirective(node, "t-else")) {
      if (!siblingDirectives.includes("t-if") && !siblingDirectives.includes("t-elif")) {
        errors.push(
          this.createError({
            message: "t-else must follow a t-if or t-elif on a sibling element",
            templateName,
            line,
            column,
            directive: "t-else",
            directiveValue: null,
            code: "ORPHAN_T_ELSE",
          })
        );
      }
    }

    // Check for deprecated directives
    if (this.options.checkDeprecated && hasDirective(node, "t-raw")) {
      warnings.push(
        this.createError({
          message: "Deprecated directive 't-raw'. Use t-out with t-options=\"{'widget': 'html'}\" instead.",
          templateName,
          line,
          column,
          directive: "t-raw",
          directiveValue: getDirectiveValue(node, "t-raw") ?? null,
          code: "INVALID_DIRECTIVE",
          severity: "warning",
        })
      );
    }

    // Validate expressions if enabled
    if (this.options.validateExpressions) {
      for (const directive of node.directives) {
        if (directive.value) {
          this.validateExpressionAST(
            directive.value,
            directive.type,
            line,
            column,
            templateName,
            errors
          );
        }
      }
    }

    // Track directives for sibling validation
    const currentDirectives: string[] = [];
    for (const directive of node.directives) {
      currentDirectives.push(directive.type);
    }

    // Recursively validate children with sibling tracking
    let childSiblingDirectives: string[] = [];
    for (const child of node.children) {
      this.validateASTNode(child, templateName, errors, warnings, childSiblingDirectives, lines);

      // Track sibling directives for conditional chains
      if (child.tag !== "#text" && child.tag !== "#comment") {
        childSiblingDirectives = child.directives.map(d => d.type);
      }
    }
  }

  /**
   * Validate expression syntax for AST-based validation.
   */
  private validateExpressionAST(
    expr: string,
    directive: string,
    line: number,
    column: number | null,
    templateName: string | null,
    errors: QWebValidationError[]
  ): void {
    const trimmed = expr.trim();
    let parenCount = 0;
    let bracketCount = 0;

    for (const char of trimmed) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;

      if (parenCount < 0 || bracketCount < 0) {
        errors.push(
          this.createError({
            message: `Unbalanced brackets in expression: ${expr}`,
            templateName,
            line,
            column,
            directive: directive as QWebDirective,
            directiveValue: `${directive}="${expr}"`,
            code: "INVALID_EXPRESSION",
          })
        );
        return;
      }
    }

    if (parenCount !== 0 || bracketCount !== 0) {
      errors.push(
        this.createError({
          message: `Unbalanced brackets in expression: ${expr}`,
          templateName,
          line,
          column,
          directive: directive as QWebDirective,
          directiveValue: `${directive}="${expr}"`,
          code: "INVALID_EXPRESSION",
        })
      );
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a QWeb validator instance.
 */
export function createQWebValidator(
  options?: QWebValidatorOptions
): QWebValidator {
  return new QWebValidator(options);
}

/**
 * Quick validation function for one-off checks.
 */
export function validateQWeb(
  content: string,
  options?: QWebValidatorOptions
): QWebValidationResult {
  const validator = new QWebValidator(options);
  return validator.validate(content);
}

/**
 * Format a validation error for display.
 */
export function formatQWebError(error: QWebValidationError): string {
  const location = error.file
    ? `${error.file}:${error.line}${error.column ? `:${error.column}` : ""}`
    : `line ${error.line}`;

  const template = error.templateName ? ` [${error.templateName}]` : "";
  const directive = error.directive ? ` (${error.directive})` : "";

  return `[QWeb ${error.severity.toUpperCase()}] ${location}${template}${directive}: ${error.message}`;
}

/**
 * Extract directive type from a directive string.
 */
export function extractDirectiveType(directiveAttr: string): QWebDirective {
  const match = directiveAttr.match(/^(t-[\w-]+)/);
  if (!match) return "unknown";

  const directive = match[1];

  // Handle dynamic attributes
  if (directive.startsWith("t-att-")) return "t-att";
  if (directive.startsWith("t-attf-")) return "t-attf";

  if (VALID_DIRECTIVES.has(directive)) {
    return directive as QWebDirective;
  }

  return "unknown";
}
