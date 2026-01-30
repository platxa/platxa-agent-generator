/**
 * Fix Explainer for User Transparency
 *
 * Feature #151: Create fix explanation for user transparency
 * Verification: Each fix includes plain-language explanation of what was wrong and how it was fixed
 *
 * Generates human-readable explanations for error fixes, making debugging
 * transparent and educational for users.
 */

// ============================================================================
// Types
// ============================================================================

/** Error category for explanation templates */
export type ExplanationCategory =
  | "syntax"
  | "type"
  | "reference"
  | "import"
  | "qweb"
  | "scss"
  | "accessibility"
  | "runtime"
  | "configuration"
  | "unknown";

/** Severity level for explanation tone */
export type ExplanationSeverity = "critical" | "warning" | "info";

/** What was wrong - the problem explanation */
export interface ProblemExplanation {
  /** Short summary of the problem */
  summary: string;
  /** Detailed explanation of what went wrong */
  detail: string;
  /** Why this is a problem */
  reason: string;
  /** Where the problem occurred */
  location?: string;
}

/** How it was fixed - the solution explanation */
export interface SolutionExplanation {
  /** Short summary of the fix */
  summary: string;
  /** Step-by-step explanation of the fix */
  steps: string[];
  /** What was changed */
  changes: string[];
  /** Why this fix works */
  rationale: string;
}

/** Complete fix explanation */
export interface FixExplanation {
  /** Unique ID */
  id: string;
  /** Error category */
  category: ExplanationCategory;
  /** Severity level */
  severity: ExplanationSeverity;
  /** What was wrong */
  problem: ProblemExplanation;
  /** How it was fixed */
  solution: SolutionExplanation;
  /** Plain-language one-liner for quick display */
  oneLiner: string;
  /** Educational tip related to this error */
  tip?: string;
  /** Link to relevant documentation */
  docLink?: string;
  /** Related error patterns */
  relatedPatterns?: string[];
  /** Timestamp */
  timestamp: number;
}

/** Input error for explanation generation */
export interface ExplainableError {
  /** Error message */
  message: string;
  /** Error type (e.g., TypeError, SyntaxError) */
  type?: string;
  /** Error code (e.g., TS2345, SCSS-001) */
  code?: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Code snippet around error */
  snippet?: string;
  /** Stack trace */
  stack?: string;
}

/** Input fix for explanation generation */
export interface ExplainableFix {
  /** Fix description */
  description: string;
  /** Fix type */
  type?: string;
  /** Original code */
  originalCode?: string;
  /** Fixed code */
  fixedCode?: string;
  /** Files changed */
  filesChanged?: string[];
  /** Lines changed */
  linesChanged?: number;
}

/** Explanation template */
export interface ExplanationTemplate {
  /** Template ID */
  id: string;
  /** Pattern to match error message */
  pattern: RegExp;
  /** Category */
  category: ExplanationCategory;
  /** Default severity */
  severity: ExplanationSeverity;
  /** Problem summary template */
  problemSummary: string;
  /** Problem detail template */
  problemDetail: string;
  /** Problem reason template */
  problemReason: string;
  /** Solution summary template */
  solutionSummary: string;
  /** Solution steps templates */
  solutionSteps: string[];
  /** Solution rationale template */
  solutionRationale: string;
  /** One-liner template */
  oneLiner: string;
  /** Educational tip */
  tip?: string;
  /** Documentation link */
  docLink?: string;
}

/** Explainer options */
export interface FixExplainerOptions {
  /** Include educational tips */
  includeTips?: boolean;
  /** Include documentation links */
  includeDocLinks?: boolean;
  /** Verbosity level */
  verbosity?: "minimal" | "normal" | "detailed";
  /** Custom templates to add */
  customTemplates?: ExplanationTemplate[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default templates for common error types */
export const EXPLANATION_TEMPLATES: ExplanationTemplate[] = [
  // Syntax Errors
  {
    id: "syntax-unexpected-token",
    pattern: /unexpected token[:\s]+['"]?(\w+)['"]?/i,
    category: "syntax",
    severity: "critical",
    problemSummary: "Unexpected token in code",
    problemDetail: "The code contains an unexpected character or keyword '{{token}}' that doesn't belong in this position.",
    problemReason: "JavaScript/TypeScript has strict syntax rules. The parser encountered something it didn't expect at this location.",
    solutionSummary: "Remove or replace the unexpected token",
    solutionSteps: [
      "Look at the line where the error occurred",
      "Check for missing punctuation before '{{token}}'",
      "Verify brackets, parentheses, and braces are balanced",
      "Remove or fix the unexpected token",
    ],
    solutionRationale: "Correcting the syntax allows the parser to understand and execute the code.",
    oneLiner: "Fixed syntax error: removed unexpected '{{token}}'",
    tip: "Use an editor with syntax highlighting to catch these errors early.",
  },
  {
    id: "syntax-missing-semicolon",
    pattern: /missing semicolon|expected.*[;]/i,
    category: "syntax",
    severity: "critical",
    problemSummary: "Missing semicolon",
    problemDetail: "A semicolon is missing at the end of a statement.",
    problemReason: "While JavaScript has automatic semicolon insertion (ASI), some cases require explicit semicolons to avoid ambiguity.",
    solutionSummary: "Add the missing semicolon",
    solutionSteps: [
      "Locate the line before the error",
      "Add a semicolon at the end of the statement",
    ],
    solutionRationale: "Adding the semicolon clarifies statement boundaries for the parser.",
    oneLiner: "Fixed: added missing semicolon",
    tip: "Configure your editor to add semicolons automatically on save.",
  },
  {
    id: "syntax-unclosed-bracket",
    pattern: /unclosed|unmatched|expected.*[}\])]|missing.*[}\])]/i,
    category: "syntax",
    severity: "critical",
    problemSummary: "Unclosed bracket or parenthesis",
    problemDetail: "A bracket, brace, or parenthesis was opened but never closed.",
    problemReason: "Every opening bracket must have a matching closing bracket for code to be valid.",
    solutionSummary: "Add the missing closing bracket",
    solutionSteps: [
      "Find the opening bracket that's missing its pair",
      "Add the corresponding closing bracket",
      "Verify proper nesting of all brackets",
    ],
    solutionRationale: "Balanced brackets define code blocks and ensure correct parsing.",
    oneLiner: "Fixed: added missing closing bracket",
    tip: "Use editor bracket matching features to see pairs.",
  },

  // Type Errors
  {
    id: "type-undefined-property",
    pattern: /cannot read propert(?:y|ies).*of (undefined|null)/i,
    category: "type",
    severity: "critical",
    problemSummary: "Accessing property of undefined/null",
    problemDetail: "The code tried to access a property on a value that is {{value}}, which has no properties.",
    problemReason: "{{value}} is a special value indicating the absence of a value. You can't access properties on it.",
    solutionSummary: "Add null/undefined check before accessing the property",
    solutionSteps: [
      "Identify which variable is {{value}}",
      "Add a check: if (variable) { ... } or use optional chaining: variable?.property",
      "Consider providing a default value",
    ],
    solutionRationale: "Checking for null/undefined before access prevents the runtime error.",
    oneLiner: "Fixed: added null check before property access",
    tip: "Use optional chaining (?.) for safer property access.",
  },
  {
    id: "type-not-a-function",
    pattern: /(\w+) is not a function/i,
    category: "type",
    severity: "critical",
    problemSummary: "Value is not callable",
    problemDetail: "The code tried to call '{{name}}' as a function, but it's not a function.",
    problemReason: "Only functions can be called with parentheses. The value might be undefined, an object, or a different type.",
    solutionSummary: "Verify the value is a function before calling",
    solutionSteps: [
      "Check if '{{name}}' is defined correctly",
      "Verify it's imported/required properly",
      "Check for typos in the function name",
      "Ensure the module exports the function",
    ],
    solutionRationale: "Ensuring the value is a function before calling prevents the runtime error.",
    oneLiner: "Fixed: corrected function reference for '{{name}}'",
    tip: "Use typeof checks: if (typeof fn === 'function') { fn(); }",
  },
  {
    id: "type-assignment-mismatch",
    pattern: /type ['"]?(\w+)['"]? is not assignable to.*['"]?(\w+)['"]?/i,
    category: "type",
    severity: "warning",
    problemSummary: "Type mismatch in assignment",
    problemDetail: "A value of type '{{sourceType}}' cannot be assigned to a variable of type '{{targetType}}'.",
    problemReason: "TypeScript enforces type safety. The types must be compatible for assignment.",
    solutionSummary: "Fix the type mismatch",
    solutionSteps: [
      "Check if the types should actually be different",
      "Convert the value to the correct type if appropriate",
      "Update the type annotation if it's too restrictive",
      "Use type assertions carefully if you're certain the types are compatible",
    ],
    solutionRationale: "Matching types ensures type safety and prevents runtime errors.",
    oneLiner: "Fixed: corrected type from '{{sourceType}}' to '{{targetType}}'",
    tip: "Use 'unknown' instead of 'any' for better type safety.",
  },

  // Reference Errors
  {
    id: "reference-not-defined",
    pattern: /(\w+) is not defined/i,
    category: "reference",
    severity: "critical",
    problemSummary: "Variable not defined",
    problemDetail: "The variable '{{name}}' was used but hasn't been declared.",
    problemReason: "Variables must be declared with let, const, or var before use, or imported from a module.",
    solutionSummary: "Define or import the missing variable",
    solutionSteps: [
      "Check for typos in the variable name",
      "Add the variable declaration",
      "Or import it from the correct module",
    ],
    solutionRationale: "Declaring the variable makes it available in the current scope.",
    oneLiner: "Fixed: defined missing variable '{{name}}'",
    tip: "Use 'const' by default, 'let' when you need to reassign.",
  },

  // Import Errors
  {
    id: "import-not-found",
    pattern: /cannot find module ['"]([^'"]+)['"]|module not found.*['"]([^'"]+)['"]?/i,
    category: "import",
    severity: "critical",
    problemSummary: "Module not found",
    problemDetail: "The module '{{module}}' could not be found or resolved.",
    problemReason: "The module might not be installed, the path might be wrong, or there could be a typo.",
    solutionSummary: "Install the module or fix the import path",
    solutionSteps: [
      "Check if the module is installed: npm ls {{module}}",
      "Install if missing: npm install {{module}}",
      "Verify the import path is correct",
      "Check for typos in the module name",
    ],
    solutionRationale: "The module must exist and be resolvable for the import to work.",
    oneLiner: "Fixed: installed missing module '{{module}}'",
    tip: "Use path aliases in tsconfig.json for cleaner imports.",
  },
  {
    id: "import-named-not-found",
    pattern: /has no exported member ['"]?(\w+)['"]?|does not export.*['"]?(\w+)['"]?/i,
    category: "import",
    severity: "critical",
    problemSummary: "Named export not found",
    problemDetail: "The module doesn't export '{{name}}' as a named export.",
    problemReason: "The export might have a different name, be a default export, or not exist.",
    solutionSummary: "Fix the import to use the correct export name",
    solutionSteps: [
      "Check the module's exports",
      "Verify the exact name of the export",
      "Use default import if it's a default export",
      "Update to the correct export name",
    ],
    solutionRationale: "Using the correct export name ensures the import resolves properly.",
    oneLiner: "Fixed: corrected import for '{{name}}'",
    tip: "Use your IDE's auto-import feature for accuracy.",
  },

  // QWeb Errors
  {
    id: "qweb-directive-invalid",
    pattern: /invalid.*t-\w+|unknown directive.*t-(\w+)/i,
    category: "qweb",
    severity: "warning",
    problemSummary: "Invalid QWeb directive",
    problemDetail: "The QWeb directive 't-{{directive}}' is not valid or properly formatted.",
    problemReason: "QWeb has specific directives like t-if, t-foreach, t-esc. Unknown or malformed directives won't work.",
    solutionSummary: "Use a valid QWeb directive",
    solutionSteps: [
      "Check the QWeb directive name",
      "Verify the syntax is correct",
      "Common directives: t-if, t-else, t-elif, t-foreach, t-esc, t-out, t-set, t-call",
    ],
    solutionRationale: "Valid QWeb directives are required for template rendering.",
    oneLiner: "Fixed: corrected QWeb directive 't-{{directive}}'",
    tip: "Refer to Odoo QWeb documentation for all available directives.",
    docLink: "https://www.odoo.com/documentation/16.0/developer/reference/frontend/qweb.html",
  },
  {
    id: "qweb-missing-closing-tag",
    pattern: /missing closing tag|unclosed.*element|expected.*<\//i,
    category: "qweb",
    severity: "critical",
    problemSummary: "Missing closing tag in template",
    problemDetail: "An HTML/XML element was opened but never closed in the template.",
    problemReason: "QWeb templates must have valid XML structure with matching open/close tags.",
    solutionSummary: "Add the missing closing tag",
    solutionSteps: [
      "Find the element that's missing its closing tag",
      "Add the corresponding </tag> element",
      "Or use self-closing syntax for void elements: <tag />",
    ],
    solutionRationale: "Valid XML structure is required for QWeb template parsing.",
    oneLiner: "Fixed: added missing closing tag",
    tip: "Use an XML validator extension in your editor.",
  },

  // SCSS Errors
  {
    id: "scss-undefined-variable",
    pattern: /undefined variable.*\$(\w+)|unknown variable.*\$(\w+)/i,
    category: "scss",
    severity: "warning",
    problemSummary: "Undefined SCSS variable",
    problemDetail: "The SCSS variable '${{variable}}' was used but hasn't been defined.",
    problemReason: "SCSS variables must be defined before use, either in the same file or in an imported partial.",
    solutionSummary: "Define or import the missing variable",
    solutionSteps: [
      "Define the variable: ${{variable}}: value;",
      "Or import the file that contains it",
      "Check for typos in the variable name",
    ],
    solutionRationale: "SCSS needs variable definitions to compile successfully.",
    oneLiner: "Fixed: defined missing SCSS variable '${{variable}}'",
    tip: "Keep variables in a central _variables.scss partial.",
  },
  {
    id: "scss-invalid-property",
    pattern: /invalid property|unknown property ['"]?(\w+)['"]?/i,
    category: "scss",
    severity: "warning",
    problemSummary: "Invalid CSS property",
    problemDetail: "The property '{{property}}' is not a valid CSS property.",
    problemReason: "CSS has specific property names. Typos or vendor prefixes without fallbacks can cause issues.",
    solutionSummary: "Use the correct CSS property name",
    solutionSteps: [
      "Check for typos in the property name",
      "Verify the property exists in CSS",
      "Add vendor prefixes if needed: -webkit-, -moz-",
    ],
    solutionRationale: "Valid CSS properties are required for styles to apply correctly.",
    oneLiner: "Fixed: corrected CSS property name",
    tip: "Use autoprefixer for automatic vendor prefixes.",
  },

  // Accessibility Errors
  {
    id: "a11y-missing-alt",
    pattern: /missing alt.*attribute|img.*without alt/i,
    category: "accessibility",
    severity: "warning",
    problemSummary: "Image missing alt text",
    problemDetail: "An image element is missing the 'alt' attribute for accessibility.",
    problemReason: "Screen readers use alt text to describe images. Missing alt makes content inaccessible.",
    solutionSummary: "Add descriptive alt text to the image",
    solutionSteps: [
      "Add alt='Description of image' to the img tag",
      "Use empty alt='' for decorative images",
      "Make alt text descriptive but concise",
    ],
    solutionRationale: "Alt text makes images accessible to users with visual impairments.",
    oneLiner: "Fixed: added alt text to image",
    tip: "Describe what the image conveys, not what it looks like.",
    docLink: "https://www.w3.org/WAI/tutorials/images/",
  },
  {
    id: "a11y-low-contrast",
    pattern: /contrast ratio|insufficient contrast|low contrast/i,
    category: "accessibility",
    severity: "warning",
    problemSummary: "Insufficient color contrast",
    problemDetail: "The text and background colors don't have enough contrast for readability.",
    problemReason: "WCAG requires minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text.",
    solutionSummary: "Increase contrast between text and background",
    solutionSteps: [
      "Check current contrast ratio with a tool",
      "Darken the text or lighten the background",
      "Aim for at least 4.5:1 contrast ratio",
    ],
    solutionRationale: "Sufficient contrast ensures text is readable for all users.",
    oneLiner: "Fixed: improved color contrast ratio",
    tip: "Use a contrast checker like WebAIM's tool.",
    docLink: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html",
  },
  {
    id: "a11y-missing-label",
    pattern: /missing.*label|form.*without label|input.*no label/i,
    category: "accessibility",
    severity: "warning",
    problemSummary: "Form input missing label",
    problemDetail: "A form input doesn't have an associated label element.",
    problemReason: "Labels tell users what information to enter. Screen readers need labels to announce form fields.",
    solutionSummary: "Add a label element for the input",
    solutionSteps: [
      "Add a <label> element with for='inputId'",
      "Or wrap the input inside the label",
      "Use aria-label for inputs without visible labels",
    ],
    solutionRationale: "Labels make forms usable for all users, including those using assistive technology.",
    oneLiner: "Fixed: added label to form input",
    tip: "Always use visible labels when possible, not just placeholders.",
    docLink: "https://www.w3.org/WAI/tutorials/forms/labels/",
  },

  // Runtime Errors
  {
    id: "runtime-network-error",
    pattern: /network error|fetch failed|connection refused/i,
    category: "runtime",
    severity: "warning",
    problemSummary: "Network request failed",
    problemDetail: "A network request failed to complete, possibly due to connectivity issues or server problems.",
    problemReason: "Network requests can fail for many reasons: no internet, server down, CORS issues, timeout.",
    solutionSummary: "Handle the network error gracefully",
    solutionSteps: [
      "Check if the server is running",
      "Verify the URL is correct",
      "Check for CORS configuration if cross-origin",
      "Add error handling with try/catch",
      "Implement retry logic for transient failures",
    ],
    solutionRationale: "Proper error handling provides a better user experience when requests fail.",
    oneLiner: "Fixed: added error handling for network request",
    tip: "Always wrap fetch calls in try/catch blocks.",
  },
  {
    id: "runtime-json-parse-error",
    pattern: /json.parse|unexpected.*json|invalid json/i,
    category: "runtime",
    severity: "warning",
    problemSummary: "Invalid JSON format",
    problemDetail: "The data could not be parsed as JSON because it's malformed or not JSON at all.",
    problemReason: "JSON has strict syntax rules. The response might be HTML (like an error page) instead of JSON.",
    solutionSummary: "Validate JSON before parsing",
    solutionSteps: [
      "Check the actual response content",
      "Verify the server returns JSON",
      "Handle non-JSON responses gracefully",
      "Use try/catch around JSON.parse",
    ],
    solutionRationale: "Validating the response prevents parse errors and provides better error messages.",
    oneLiner: "Fixed: added JSON validation before parsing",
    tip: "Log the raw response before parsing to debug JSON issues.",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique ID
 */
export function generateExplanationId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Interpolate template string with values
 */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

/**
 * Extract captures from regex match
 */
export function extractCaptures(
  pattern: RegExp,
  text: string
): Record<string, string> {
  const match = text.match(pattern);
  if (!match) return {};

  const captures: Record<string, string> = {};

  // Handle numbered groups
  for (let i = 1; i < match.length; i++) {
    if (match[i]) {
      captures[`capture${i}`] = match[i];
    }
  }

  // Handle named groups
  if (match.groups) {
    Object.assign(captures, match.groups);
  }

  return captures;
}

/**
 * Determine category from error type/message
 */
export function categorizeError(error: ExplainableError): ExplanationCategory {
  const message = error.message.toLowerCase();
  const type = (error.type ?? "").toLowerCase();

  if (type.includes("syntax") || message.includes("syntax")) return "syntax";
  if (type.includes("type") || message.includes("type")) return "type";
  if (type.includes("reference") || message.includes("not defined")) return "reference";
  if (message.includes("import") || message.includes("module")) return "import";
  if (message.includes("t-") || message.includes("qweb")) return "qweb";
  if (message.includes("scss") || message.includes("sass") || error.file?.endsWith(".scss")) return "scss";
  if (message.includes("contrast") || message.includes("alt") || message.includes("aria")) return "accessibility";
  if (message.includes("network") || message.includes("fetch") || message.includes("json")) return "runtime";
  if (message.includes("config") || message.includes("setting")) return "configuration";

  return "unknown";
}

/**
 * Determine severity from error type/message
 */
export function determineSeverity(error: ExplainableError): ExplanationSeverity {
  const message = error.message.toLowerCase();
  const type = (error.type ?? "").toLowerCase();

  // Critical errors that break functionality
  if (
    type.includes("syntax") ||
    type.includes("reference") ||
    message.includes("cannot") ||
    message.includes("failed") ||
    message.includes("fatal")
  ) {
    return "critical";
  }

  // Warnings that should be addressed
  if (
    type.includes("warning") ||
    message.includes("deprecated") ||
    message.includes("accessibility")
  ) {
    return "warning";
  }

  return "info";
}

/**
 * Find matching template for error
 */
export function findMatchingTemplate(
  error: ExplainableError,
  templates: ExplanationTemplate[] = EXPLANATION_TEMPLATES
): ExplanationTemplate | null {
  for (const template of templates) {
    if (template.pattern.test(error.message)) {
      return template;
    }
  }
  return null;
}

/**
 * Build variable map for template interpolation
 */
export function buildVariableMap(
  error: ExplainableError,
  fix: ExplainableFix,
  template: ExplanationTemplate | null
): Record<string, string> {
  const vars: Record<string, string> = {};

  // Extract from error
  vars.message = error.message;
  vars.type = error.type ?? "Error";
  vars.code = error.code ?? "";
  vars.file = error.file ?? "unknown file";
  vars.line = error.line?.toString() ?? "?";
  vars.column = error.column?.toString() ?? "?";

  // Extract from fix
  vars.fixDescription = fix.description;
  vars.fixType = fix.type ?? "fix";
  vars.linesChanged = fix.linesChanged?.toString() ?? "1";

  // Extract captures from template pattern
  if (template) {
    const captures = extractCaptures(template.pattern, error.message);
    Object.assign(vars, captures);

    // Map common capture positions to semantic names
    if (captures.capture1 || captures.capture2) {
      const primaryCapture = captures.capture1 || captures.capture2;

      // Context-dependent naming based on template ID
      if (template.id.includes("token")) vars.token = primaryCapture;
      if (template.id.includes("function")) vars.name = primaryCapture;
      if (template.id.includes("variable")) vars.variable = primaryCapture;
      // import-not-found and import-named-not-found templates capture module/export names
      if (template.id.includes("module") || template.id.startsWith("import-")) {
        vars.module = primaryCapture;
      }
      if (template.id.includes("property")) vars.property = primaryCapture;
      if (template.id.includes("undefined-property")) vars.value = primaryCapture;
      if (template.id.includes("mismatch")) {
        vars.sourceType = captures.capture1 ?? "unknown";
        vars.targetType = captures.capture2 ?? "unknown";
      }
      if (template.id.includes("directive")) vars.directive = primaryCapture;
      if (template.id.includes("defined")) vars.name = primaryCapture;
      if (template.id.includes("named")) vars.name = primaryCapture;
    }
  }

  return vars;
}

/**
 * Format location string
 */
export function formatLocation(error: ExplainableError): string | undefined {
  if (!error.file) return undefined;

  let location = error.file;
  if (error.line) {
    location += `:${error.line}`;
    if (error.column) {
      location += `:${error.column}`;
    }
  }
  return location;
}

/**
 * Generate generic explanation for unknown errors
 */
export function generateGenericExplanation(
  error: ExplainableError,
  fix: ExplainableFix,
  category: ExplanationCategory,
  severity: ExplanationSeverity
): FixExplanation {
  return {
    id: generateExplanationId(),
    category,
    severity,
    problem: {
      summary: `${category.charAt(0).toUpperCase() + category.slice(1)} error occurred`,
      detail: error.message,
      reason: "An error was detected that requires attention.",
      location: formatLocation(error),
    },
    solution: {
      summary: fix.description,
      steps: [
        "Review the error message",
        "Examine the code at the error location",
        fix.description,
        "Verify the fix resolves the error",
      ],
      changes: fix.fixedCode ? [`Changed: ${fix.fixedCode}`] : ["Applied fix"],
      rationale: "This fix addresses the root cause of the error.",
    },
    oneLiner: `Fixed: ${fix.description}`,
    timestamp: Date.now(),
  };
}

// ============================================================================
// FixExplainer Class
// ============================================================================

/**
 * Generates human-readable explanations for error fixes
 */
export class FixExplainer {
  private templates: ExplanationTemplate[];
  private includeTips: boolean;
  private includeDocLinks: boolean;
  private verbosity: "minimal" | "normal" | "detailed";
  private disposed = false;

  constructor(options: FixExplainerOptions = {}) {
    this.templates = [...EXPLANATION_TEMPLATES, ...(options.customTemplates ?? [])];
    this.includeTips = options.includeTips ?? true;
    this.includeDocLinks = options.includeDocLinks ?? true;
    this.verbosity = options.verbosity ?? "normal";
  }

  /**
   * Generate explanation for an error and its fix
   */
  explain(error: ExplainableError, fix: ExplainableFix): FixExplanation {
    if (this.disposed) {
      throw new Error("FixExplainer is disposed");
    }

    // Find matching template
    const template = findMatchingTemplate(error, this.templates);

    // Determine category and severity
    const category = template?.category ?? categorizeError(error);
    const severity = template?.severity ?? determineSeverity(error);

    // Build variable map for interpolation
    const vars = buildVariableMap(error, fix, template);

    // Generate explanation
    if (template) {
      return this.generateFromTemplate(template, vars, error, fix, category, severity);
    } else {
      return generateGenericExplanation(error, fix, category, severity);
    }
  }

  /**
   * Generate explanation from template
   */
  private generateFromTemplate(
    template: ExplanationTemplate,
    vars: Record<string, string>,
    error: ExplainableError,
    fix: ExplainableFix,
    category: ExplanationCategory,
    severity: ExplanationSeverity
  ): FixExplanation {
    const explanation: FixExplanation = {
      id: generateExplanationId(),
      category,
      severity,
      problem: {
        summary: interpolate(template.problemSummary, vars),
        detail: interpolate(template.problemDetail, vars),
        reason: interpolate(template.problemReason, vars),
        location: formatLocation(error),
      },
      solution: {
        summary: interpolate(template.solutionSummary, vars),
        steps: this.verbosity === "minimal"
          ? [interpolate(template.solutionSteps[0], vars)]
          : template.solutionSteps.map((step) => interpolate(step, vars)),
        changes: this.buildChanges(fix),
        rationale: interpolate(template.solutionRationale, vars),
      },
      oneLiner: interpolate(template.oneLiner, vars),
      timestamp: Date.now(),
    };

    // Add optional fields based on settings
    if (this.includeTips && template.tip) {
      explanation.tip = template.tip;
    }
    if (this.includeDocLinks && template.docLink) {
      explanation.docLink = template.docLink;
    }

    // Add related patterns for detailed verbosity
    if (this.verbosity === "detailed") {
      explanation.relatedPatterns = this.findRelatedPatterns(template.id);
    }

    return explanation;
  }

  /**
   * Build changes list from fix
   */
  private buildChanges(fix: ExplainableFix): string[] {
    const changes: string[] = [];

    if (fix.filesChanged?.length) {
      changes.push(`Modified ${fix.filesChanged.length} file(s): ${fix.filesChanged.join(", ")}`);
    }
    if (fix.linesChanged) {
      changes.push(`Changed ${fix.linesChanged} line(s)`);
    }
    if (fix.originalCode && fix.fixedCode) {
      changes.push(`Changed: "${fix.originalCode}" → "${fix.fixedCode}"`);
    } else if (fix.fixedCode) {
      changes.push(`Added: ${fix.fixedCode}`);
    }

    return changes.length > 0 ? changes : [fix.description];
  }

  /**
   * Find related patterns for educational purposes
   */
  private findRelatedPatterns(templateId: string): string[] {
    const [category] = templateId.split("-");
    return this.templates
      .filter((t) => t.id !== templateId && t.id.startsWith(category))
      .map((t) => t.id)
      .slice(0, 3);
  }

  /**
   * Explain multiple errors and fixes
   */
  explainBatch(
    pairs: Array<{ error: ExplainableError; fix: ExplainableFix }>
  ): FixExplanation[] {
    if (this.disposed) {
      throw new Error("FixExplainer is disposed");
    }

    return pairs.map(({ error, fix }) => this.explain(error, fix));
  }

  /**
   * Get available template IDs
   */
  getTemplateIds(): string[] {
    return this.templates.map((t) => t.id);
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ExplanationTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * Add custom template
   */
  addTemplate(template: ExplanationTemplate): void {
    if (this.disposed) {
      throw new Error("FixExplainer is disposed");
    }
    this.templates.push(template);
  }

  /**
   * Format explanation as plain text
   */
  formatAsText(explanation: FixExplanation): string {
    const lines: string[] = [];

    lines.push(`## ${explanation.problem.summary}`);
    lines.push("");
    lines.push(`**What went wrong:** ${explanation.problem.detail}`);
    if (explanation.problem.location) {
      lines.push(`**Location:** ${explanation.problem.location}`);
    }
    lines.push(`**Why:** ${explanation.problem.reason}`);
    lines.push("");
    lines.push(`**How it was fixed:** ${explanation.solution.summary}`);
    lines.push("");
    lines.push("**Steps:**");
    explanation.solution.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push("");
    lines.push(`**Rationale:** ${explanation.solution.rationale}`);

    if (explanation.tip) {
      lines.push("");
      lines.push(`**Tip:** ${explanation.tip}`);
    }

    if (explanation.docLink) {
      lines.push("");
      lines.push(`**Learn more:** ${explanation.docLink}`);
    }

    return lines.join("\n");
  }

  /**
   * Format explanation as HTML
   */
  formatAsHtml(explanation: FixExplanation): string {
    const severityClass = `severity-${explanation.severity}`;
    const categoryClass = `category-${explanation.category}`;

    return `
<div class="fix-explanation ${severityClass} ${categoryClass}">
  <h3 class="problem-summary">${this.escapeHtml(explanation.problem.summary)}</h3>

  <div class="problem">
    <p><strong>What went wrong:</strong> ${this.escapeHtml(explanation.problem.detail)}</p>
    ${explanation.problem.location ? `<p><strong>Location:</strong> <code>${this.escapeHtml(explanation.problem.location)}</code></p>` : ""}
    <p><strong>Why:</strong> ${this.escapeHtml(explanation.problem.reason)}</p>
  </div>

  <div class="solution">
    <p><strong>How it was fixed:</strong> ${this.escapeHtml(explanation.solution.summary)}</p>
    <ol class="steps">
      ${explanation.solution.steps.map((step) => `<li>${this.escapeHtml(step)}</li>`).join("\n      ")}
    </ol>
    <p><strong>Rationale:</strong> ${this.escapeHtml(explanation.solution.rationale)}</p>
  </div>

  ${explanation.tip ? `<p class="tip"><strong>Tip:</strong> ${this.escapeHtml(explanation.tip)}</p>` : ""}
  ${explanation.docLink ? `<p class="doc-link"><a href="${this.escapeHtml(explanation.docLink)}" target="_blank">Learn more</a></p>` : ""}
</div>`.trim();
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.templates = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FixExplainer instance
 */
export function createFixExplainer(options?: FixExplainerOptions): FixExplainer {
  return new FixExplainer(options);
}
