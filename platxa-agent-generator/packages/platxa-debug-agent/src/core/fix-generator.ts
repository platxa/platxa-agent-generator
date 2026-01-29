/**
 * Template-Based Fix Generator
 *
 * Generates fixes for common error patterns using predefined templates
 * with variable substitution and language-specific transformations.
 *
 * @module fix-generator
 */

import { randomUUID } from 'crypto';
import type {
  CodeChange,
  FixSuggestion,
  Language,
  NormalizedError,
  SourceLocation,
  ValidationStep,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A fix template for a specific error pattern
 */
export interface FixGeneratorTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Languages this template applies to */
  languages: Language[];
  /** Error type pattern (regex) */
  errorTypePattern: RegExp;
  /** Error message pattern (regex with capture groups) */
  messagePattern: RegExp;
  /** Description of what this fix does */
  description: string;
  /** The fix transformation */
  transformation: FixTransformation;
  /** Confidence level for this fix */
  confidence: number;
  /** Priority (higher = applied first) */
  priority: number;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Transformation to apply for a fix
 */
export interface FixTransformation {
  /** Type of transformation */
  type: 'replace' | 'insert_before' | 'insert_after' | 'wrap' | 'delete';
  /** Template for the new code (supports {{variable}} placeholders) */
  template: string;
  /** Pattern to find in the code (for replace/wrap) */
  findPattern?: RegExp;
  /** Additional context lines needed */
  contextLines?: number;
  /** Language-specific overrides */
  languageOverrides?: Partial<Record<Language, string>>;
}

/**
 * Variables extracted from error matching
 */
export interface TemplateVariables {
  /** Variable/identifier name */
  name?: string;
  /** Type name */
  type?: string;
  /** Property name */
  property?: string;
  /** Module name */
  module?: string;
  /** Function name */
  function?: string;
  /** Value */
  value?: string;
  /** Original code snippet */
  original?: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Custom variables from regex captures */
  [key: string]: string | number | undefined;
}

/**
 * Generated fix result
 */
export interface GeneratedFix {
  /** The fix suggestion */
  fix: FixSuggestion;
  /** Template used */
  templateId: string;
  /** Variables extracted */
  variables: TemplateVariables;
  /** Whether this is an exact match */
  isExactMatch: boolean;
}

/**
 * Fix generator configuration
 */
export interface FixGeneratorConfig {
  /** Custom templates to add */
  customTemplates?: FixGeneratorTemplate[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum fixes to generate per error */
  maxFixesPerError?: number;
  /** Enable language-specific transformations */
  enableLanguageOverrides?: boolean;
}

// =============================================================================
// Built-in Fix Templates
// =============================================================================

const BUILTIN_TEMPLATES: FixGeneratorTemplate[] = [
  // ===========================================================================
  // Null/Undefined Check Templates
  // ===========================================================================
  {
    id: 'js-optional-chaining',
    name: 'Add Optional Chaining',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read propert(?:y|ies) (?:of |')?(\w+)?(?:')?.*(?:undefined|null)/i,
    description: 'Add optional chaining (?.) to safely access property',
    transformation: {
      type: 'replace',
      template: '{{object}}?.{{property}}',
      findPattern: /(\w+)\.(\w+)/,
    },
    confidence: 0.85,
    priority: 90,
    tags: ['null-check', 'optional-chaining', 'safety'],
  },
  {
    id: 'js-nullish-coalescing',
    name: 'Add Nullish Coalescing Default',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read propert(?:y|ies).*(?:undefined|null)/i,
    description: 'Add nullish coalescing operator (??) with default value',
    transformation: {
      type: 'replace',
      template: '({{expression}} ?? {{default}})',
      findPattern: /(\w+(?:\.\w+)*)/,
    },
    confidence: 0.75,
    priority: 80,
    tags: ['null-check', 'default-value', 'safety'],
  },
  {
    id: 'js-null-guard',
    name: 'Add Null Guard Check',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read propert(?:y|ies).*(?:undefined|null)/i,
    description: 'Add explicit null/undefined check before access',
    transformation: {
      type: 'insert_before',
      template: 'if ({{object}} == null) {\n  throw new Error("{{object}} is null or undefined");\n}\n',
    },
    confidence: 0.70,
    priority: 70,
    tags: ['null-check', 'guard', 'explicit'],
  },
  {
    id: 'py-none-check',
    name: 'Add None Check',
    languages: ['python'],
    errorTypePattern: /^(?:TypeError|AttributeError)$/,
    messagePattern: /'NoneType' object has no attribute '(\w+)'/,
    description: 'Add None check before accessing attribute',
    transformation: {
      type: 'insert_before',
      template: 'if {{object}} is None:\n    raise ValueError("{{object}} cannot be None")\n',
    },
    confidence: 0.80,
    priority: 85,
    tags: ['none-check', 'guard', 'python'],
  },
  {
    id: 'py-getattr-default',
    name: 'Use getattr with Default',
    languages: ['python'],
    errorTypePattern: /^AttributeError$/,
    messagePattern: /'(\w+)' object has no attribute '(\w+)'/,
    description: 'Use getattr() with a default value',
    transformation: {
      type: 'replace',
      template: 'getattr({{object}}, "{{attribute}}", {{default}})',
      findPattern: /(\w+)\.(\w+)/,
    },
    confidence: 0.75,
    priority: 80,
    tags: ['attribute', 'default-value', 'python'],
  },

  // ===========================================================================
  // Type Coercion Templates
  // ===========================================================================
  {
    id: 'js-to-string',
    name: 'Convert to String',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:is not a string|expected.*string)/i,
    description: 'Convert value to string using String() or toString()',
    transformation: {
      type: 'replace',
      template: 'String({{value}})',
      findPattern: /(\w+)/,
    },
    confidence: 0.80,
    priority: 75,
    tags: ['type-coercion', 'string', 'conversion'],
  },
  {
    id: 'js-to-number',
    name: 'Convert to Number',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:is not a number|expected.*number|NaN)/i,
    description: 'Convert value to number using Number() or parseInt/parseFloat',
    transformation: {
      type: 'replace',
      template: 'Number({{value}})',
      findPattern: /(\w+)/,
    },
    confidence: 0.80,
    priority: 75,
    tags: ['type-coercion', 'number', 'conversion'],
  },
  {
    id: 'js-to-array',
    name: 'Ensure Array',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:is not iterable|\.map is not a function|\.forEach is not a function)/i,
    description: 'Ensure value is an array using Array.isArray() check or Array.from()',
    transformation: {
      type: 'replace',
      template: 'Array.isArray({{value}}) ? {{value}} : [{{value}}]',
      findPattern: /(\w+)/,
    },
    confidence: 0.75,
    priority: 70,
    tags: ['type-coercion', 'array', 'conversion'],
  },
  {
    id: 'py-int-conversion',
    name: 'Convert to Integer',
    languages: ['python'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:cannot.*int|expected.*int|unsupported operand.*int)/i,
    description: 'Convert value to integer using int()',
    transformation: {
      type: 'replace',
      template: 'int({{value}})',
      findPattern: /(\w+)/,
    },
    confidence: 0.80,
    priority: 75,
    tags: ['type-coercion', 'integer', 'python'],
  },
  {
    id: 'py-str-conversion',
    name: 'Convert to String',
    languages: ['python'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:cannot.*str|expected.*str|must be str)/i,
    description: 'Convert value to string using str()',
    transformation: {
      type: 'replace',
      template: 'str({{value}})',
      findPattern: /(\w+)/,
    },
    confidence: 0.80,
    priority: 75,
    tags: ['type-coercion', 'string', 'python'],
  },

  // ===========================================================================
  // Import/Module Templates
  // ===========================================================================
  {
    id: 'js-add-import',
    name: 'Add Missing Import',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^ReferenceError$/,
    messagePattern: /(\w+) is not defined/,
    description: 'Add import statement for undefined identifier',
    transformation: {
      type: 'insert_before',
      template: "import { {{name}} } from '{{module}}';\n",
      contextLines: 0,
    },
    confidence: 0.70,
    priority: 85,
    tags: ['import', 'module', 'reference'],
  },
  {
    id: 'py-add-import',
    name: 'Add Missing Import',
    languages: ['python'],
    errorTypePattern: /^NameError$/,
    messagePattern: /name '(\w+)' is not defined/,
    description: 'Add import statement for undefined name',
    transformation: {
      type: 'insert_before',
      template: 'from {{module}} import {{name}}\n',
      contextLines: 0,
    },
    confidence: 0.70,
    priority: 85,
    tags: ['import', 'module', 'reference', 'python'],
  },
  {
    id: 'py-install-package',
    name: 'Install Missing Package',
    languages: ['python'],
    errorTypePattern: /^(?:Import|Module)Error$/,
    messagePattern: /No module named '([^']+)'/,
    description: 'Install missing package using pip',
    transformation: {
      type: 'insert_before',
      template: '# Run: pip install {{module}}\n',
      contextLines: 0,
    },
    confidence: 0.90,
    priority: 95,
    tags: ['import', 'package', 'pip', 'python'],
  },

  // ===========================================================================
  // TypeScript-Specific Templates
  // ===========================================================================
  {
    id: 'ts-type-assertion',
    name: 'Add Type Assertion',
    languages: ['typescript'],
    errorTypePattern: /^TS\d+$/,
    messagePattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    description: 'Add type assertion to satisfy TypeScript',
    transformation: {
      type: 'replace',
      template: '({{expression}} as {{targetType}})',
      findPattern: /(\w+(?:\.\w+)*)/,
    },
    confidence: 0.65,
    priority: 60,
    tags: ['typescript', 'type-assertion', 'casting'],
  },
  {
    id: 'ts-non-null-assertion',
    name: 'Add Non-Null Assertion',
    languages: ['typescript'],
    errorTypePattern: /^TS\d+$/,
    messagePattern: /Object is possibly '(?:null|undefined)'/,
    description: 'Add non-null assertion operator (!)',
    transformation: {
      type: 'replace',
      template: '{{expression}}!',
      findPattern: /(\w+(?:\.\w+)*)/,
    },
    confidence: 0.60,
    priority: 55,
    tags: ['typescript', 'non-null', 'assertion'],
  },
  {
    id: 'ts-add-optional',
    name: 'Make Property Optional',
    languages: ['typescript'],
    errorTypePattern: /^TS\d+$/,
    messagePattern: /Property '(\w+)' is missing/,
    description: 'Make the property optional in the type definition',
    transformation: {
      type: 'replace',
      template: '{{property}}?: {{type}}',
      findPattern: /(\w+):\s*(\w+)/,
    },
    confidence: 0.70,
    priority: 65,
    tags: ['typescript', 'optional', 'interface'],
  },

  // ===========================================================================
  // Function/Method Templates
  // ===========================================================================
  {
    id: 'js-bind-this',
    name: 'Bind this Context',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read.*of undefined.*this/i,
    description: 'Bind function to correct this context',
    transformation: {
      type: 'replace',
      template: '{{function}}.bind(this)',
      findPattern: /this\.(\w+)/,
    },
    confidence: 0.70,
    priority: 70,
    tags: ['this', 'binding', 'context'],
  },
  {
    id: 'js-arrow-function',
    name: 'Convert to Arrow Function',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read.*of undefined/i,
    description: 'Convert to arrow function to preserve this context',
    transformation: {
      type: 'replace',
      template: '({{params}}) => {{body}}',
      findPattern: /function\s*\(([^)]*)\)\s*\{([^}]*)\}/,
    },
    confidence: 0.65,
    priority: 65,
    tags: ['arrow-function', 'this', 'context'],
  },

  // ===========================================================================
  // Async/Await Templates
  // ===========================================================================
  {
    id: 'js-add-await',
    name: 'Add Missing await',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(?:\.then is not a function|Promise.*object)/i,
    description: 'Add await keyword to async operation',
    transformation: {
      type: 'replace',
      template: 'await {{expression}}',
      findPattern: /(\w+\([^)]*\))/,
    },
    confidence: 0.80,
    priority: 85,
    tags: ['async', 'await', 'promise'],
  },
  {
    id: 'py-add-await',
    name: 'Add Missing await',
    languages: ['python'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /object.*can't be used in 'await' expression|coroutine.*was never awaited/i,
    description: 'Add await keyword to async operation',
    transformation: {
      type: 'replace',
      template: 'await {{expression}}',
      findPattern: /(\w+\([^)]*\))/,
    },
    confidence: 0.80,
    priority: 85,
    tags: ['async', 'await', 'coroutine', 'python'],
  },

  // ===========================================================================
  // Error Handling Templates
  // ===========================================================================
  {
    id: 'js-try-catch',
    name: 'Wrap in Try-Catch',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^(?:Error|TypeError|ReferenceError)$/,
    messagePattern: /.*/,
    description: 'Wrap code in try-catch block for error handling',
    transformation: {
      type: 'wrap',
      template: 'try {\n  {{original}}\n} catch (error) {\n  console.error("Error:", error);\n  throw error;\n}',
    },
    confidence: 0.50,
    priority: 30,
    tags: ['error-handling', 'try-catch', 'safety'],
  },
  {
    id: 'py-try-except',
    name: 'Wrap in Try-Except',
    languages: ['python'],
    errorTypePattern: /^(?:Exception|Error|TypeError|ValueError)$/,
    messagePattern: /.*/,
    description: 'Wrap code in try-except block for error handling',
    transformation: {
      type: 'wrap',
      template: 'try:\n    {{original}}\nexcept Exception as e:\n    print(f"Error: {e}")\n    raise',
    },
    confidence: 0.50,
    priority: 30,
    tags: ['error-handling', 'try-except', 'safety', 'python'],
  },
];

// =============================================================================
// Fix Generator Implementation
// =============================================================================

/**
 * Template-Based Fix Generator
 *
 * Generates concrete code fixes from predefined templates
 * matched against error patterns.
 */
export class FixGenerator {
  /** Available fix templates */
  private readonly templates: FixGeneratorTemplate[];

  /** Generator configuration */
  private readonly config: Required<FixGeneratorConfig>;

  constructor(config: FixGeneratorConfig = {}) {
    this.config = {
      customTemplates: config.customTemplates ?? [],
      minConfidence: config.minConfidence ?? 0.5,
      maxFixesPerError: config.maxFixesPerError ?? 5,
      enableLanguageOverrides: config.enableLanguageOverrides ?? true,
    };

    // Combine built-in and custom templates, sorted by priority
    this.templates = [...BUILTIN_TEMPLATES, ...this.config.customTemplates]
      .sort((a, b) => b.priority - a.priority);
  }

  // ===========================================================================
  // Fix Generation
  // ===========================================================================

  /**
   * Generate fixes for an error.
   *
   * @param error - The normalized error
   * @param codeContext - Optional code context around the error
   * @returns Array of generated fixes
   */
  generateFixes(
    error: NormalizedError,
    codeContext?: string
  ): GeneratedFix[] {
    const fixes: GeneratedFix[] = [];

    for (const template of this.templates) {
      // Check language match
      if (!template.languages.includes(error.language)) {
        continue;
      }

      // Check error type match
      if (!template.errorTypePattern.test(error.type)) {
        continue;
      }

      // Check message match
      const messageMatch = template.messagePattern.exec(error.message);
      if (messageMatch === null) {
        continue;
      }

      // Check confidence threshold
      if (template.confidence < this.config.minConfidence) {
        continue;
      }

      // Extract variables from match
      const variables = this.extractVariables(template, messageMatch, error, codeContext);

      // Generate the fix
      const fix = this.generateFixFromTemplate(template, variables, error, codeContext);
      if (fix !== null) {
        fixes.push({
          fix,
          templateId: template.id,
          variables,
          isExactMatch: messageMatch[0] === error.message,
        });
      }

      // Check max fixes limit
      if (fixes.length >= this.config.maxFixesPerError) {
        break;
      }
    }

    return fixes;
  }

  /**
   * Generate a single fix from a template.
   */
  private generateFixFromTemplate(
    template: FixGeneratorTemplate,
    variables: TemplateVariables,
    error: NormalizedError,
    codeContext?: string
  ): FixSuggestion | null {
    // Get the template string (with language override if applicable)
    let templateStr = template.transformation.template;
    if (
      this.config.enableLanguageOverrides &&
      template.transformation.languageOverrides !== undefined
    ) {
      const override = template.transformation.languageOverrides[error.language];
      if (override !== undefined) {
        templateStr = override;
      }
    }

    // Substitute variables
    const fixedCode = this.substituteVariables(templateStr, variables);

    // Generate code changes
    const changes = this.generateCodeChanges(
      template.transformation,
      fixedCode,
      variables,
      error.location,
      codeContext
    );

    // Generate validation steps
    const validationSteps = this.generateValidationSteps(error.language);

    return {
      id: randomUUID(),
      description: this.substituteVariables(template.description, variables),
      confidence: template.confidence,
      type: 'template',
      changes,
      validationSteps,
    };
  }

  /**
   * Extract variables from error match and context.
   */
  private extractVariables(
    template: FixGeneratorTemplate,
    match: RegExpExecArray,
    error: NormalizedError,
    codeContext?: string
  ): TemplateVariables {
    const variables: TemplateVariables = {};

    // Add location properties only if defined
    if (error.location?.file !== undefined) {
      variables.file = error.location.file;
    }
    if (error.location?.line !== undefined) {
      variables.line = error.location.line;
    }
    if (error.location?.column !== undefined) {
      variables.column = error.location.column;
    }

    // Extract captures from message match
    for (let i = 1; i < match.length; i++) {
      const captured = match[i];
      if (captured !== undefined) {
        variables[`$${i}`] = captured;
      }
    }

    // Map common capture patterns based on template
    this.mapCapturedVariables(template.id, match, variables);

    // Extract additional variables from code context
    if (codeContext !== undefined) {
      this.extractFromCodeContext(template, codeContext, variables);
    }

    // Set defaults for common variables
    if (variables.default === undefined) {
      variables.default = this.getDefaultValue(error.language, template.tags);
    }

    return variables;
  }

  /**
   * Map captured regex groups to named variables based on template.
   */
  private mapCapturedVariables(
    templateId: string,
    match: RegExpExecArray,
    variables: TemplateVariables
  ): void {
    // Map based on known template patterns
    switch (templateId) {
      case 'js-optional-chaining':
      case 'js-nullish-coalescing':
      case 'js-null-guard':
        if (match[1] !== undefined) {
          variables.property = match[1];
        }
        break;

      case 'py-none-check':
      case 'py-getattr-default':
        if (match[1] !== undefined) {
          variables.type = match[1];
        }
        if (match[2] !== undefined) {
          variables.attribute = match[2];
        }
        break;

      case 'js-add-import':
      case 'py-add-import':
        if (match[1] !== undefined) {
          variables.name = match[1];
        }
        break;

      case 'py-install-package':
        if (match[1] !== undefined) {
          variables.module = match[1];
        }
        break;

      case 'ts-type-assertion':
        if (match[1] !== undefined) {
          variables.sourceType = match[1];
        }
        if (match[2] !== undefined) {
          variables.targetType = match[2];
        }
        break;

      case 'ts-add-optional':
        if (match[1] !== undefined) {
          variables.property = match[1];
        }
        break;
    }
  }

  /**
   * Extract variables from code context.
   */
  private extractFromCodeContext(
    template: FixGeneratorTemplate,
    codeContext: string,
    variables: TemplateVariables
  ): void {
    // Try to find the pattern in code context
    if (template.transformation.findPattern !== undefined) {
      const codeMatch = template.transformation.findPattern.exec(codeContext);
      if (codeMatch !== null) {
        variables.original = codeMatch[0];
        if (codeMatch[1] !== undefined) {
          variables.object = codeMatch[1];
        }
        if (codeMatch[2] !== undefined) {
          variables.property = codeMatch[2];
        }
      }
    }

    // Store the original code
    if (variables.original === undefined) {
      variables.original = codeContext.trim();
    }
  }

  /**
   * Get a sensible default value based on language and context.
   */
  private getDefaultValue(language: Language, tags: string[]): string {
    if (tags.includes('array')) {
      return '[]';
    }
    if (tags.includes('number') || tags.includes('integer')) {
      return '0';
    }
    if (tags.includes('string')) {
      return language === 'python' ? '""' : "''";
    }
    if (tags.includes('object')) {
      return language === 'python' ? '{}' : '{}';
    }
    return language === 'python' ? 'None' : 'null';
  }

  /**
   * Substitute variables in a template string.
   */
  private substituteVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(placeholder, String(value));
      }
    }

    // Remove any remaining unsubstituted placeholders
    result = result.replace(/\{\{\w+\}\}/g, '');

    return result;
  }

  /**
   * Generate code changes from transformation.
   */
  private generateCodeChanges(
    transformation: FixTransformation,
    fixedCode: string,
    variables: TemplateVariables,
    location?: SourceLocation,
    _codeContext?: string
  ): CodeChange[] {
    const changes: CodeChange[] = [];

    if (location === undefined) {
      return changes;
    }

    const change: CodeChange = {
      file: location.file,
      type: transformation.type === 'delete' ? 'delete' :
            transformation.type === 'insert_before' || transformation.type === 'insert_after' ? 'insert' :
            'replace',
      start: { line: location.line, column: location.column ?? 1 },
    };

    // Set end position for replace/delete
    if (transformation.type === 'replace' || transformation.type === 'delete' || transformation.type === 'wrap') {
      change.end = {
        line: location.endLine ?? location.line,
        column: location.endColumn ?? (location.column ?? 1) + (variables.original?.length ?? 10),
      };
    }

    // Set new content
    if (transformation.type !== 'delete') {
      change.newContent = fixedCode;
    }

    // Set original content
    if (variables.original !== undefined) {
      change.originalContent = variables.original;
    }

    changes.push(change);
    return changes;
  }

  /**
   * Generate validation steps for a fix.
   */
  private generateValidationSteps(language: Language): ValidationStep[] {
    const steps: ValidationStep[] = [];

    switch (language) {
      case 'python':
        steps.push({
          type: 'typecheck',
          command: 'pyright',
          expectedOutcome: 'No type errors',
        });
        steps.push({
          type: 'lint',
          command: 'ruff check',
          expectedOutcome: 'No lint errors',
        });
        break;

      case 'typescript':
        steps.push({
          type: 'typecheck',
          command: 'tsc --noEmit',
          expectedOutcome: 'No type errors',
        });
        steps.push({
          type: 'lint',
          command: 'eslint',
          expectedOutcome: 'No lint errors',
        });
        break;

      case 'javascript':
        steps.push({
          type: 'lint',
          command: 'eslint',
          expectedOutcome: 'No lint errors',
        });
        break;

      default:
        steps.push({
          type: 'manual',
          description: 'Verify the fix works correctly',
          expectedOutcome: 'No errors',
        });
    }

    return steps;
  }

  // ===========================================================================
  // Template Management
  // ===========================================================================

  /**
   * Add a custom template.
   */
  addTemplate(template: FixGeneratorTemplate): void {
    this.templates.push(template);
    this.templates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get templates for a language.
   */
  getTemplatesForLanguage(language: Language): FixGeneratorTemplate[] {
    return this.templates.filter((t) => t.languages.includes(language));
  }

  /**
   * Get templates by tag.
   */
  getTemplatesByTag(tag: string): FixGeneratorTemplate[] {
    return this.templates.filter((t) => t.tags.includes(tag));
  }

  /**
   * Get a template by ID.
   */
  getTemplate(id: string): FixGeneratorTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * Get all templates.
   */
  getAllTemplates(): FixGeneratorTemplate[] {
    return [...this.templates];
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Check if a fix is applicable for an error.
   */
  canFix(error: NormalizedError): boolean {
    return this.templates.some(
      (t) =>
        t.languages.includes(error.language) &&
        t.errorTypePattern.test(error.type) &&
        t.messagePattern.test(error.message) &&
        t.confidence >= this.config.minConfidence
    );
  }

  /**
   * Get applicable template IDs for an error.
   */
  getApplicableTemplates(error: NormalizedError): string[] {
    return this.templates
      .filter(
        (t) =>
          t.languages.includes(error.language) &&
          t.errorTypePattern.test(error.type) &&
          t.messagePattern.test(error.message) &&
          t.confidence >= this.config.minConfidence
      )
      .map((t) => t.id);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FixGenerator instance.
 *
 * @param config - Generator configuration
 * @returns FixGenerator instance
 */
export function createFixGenerator(config?: FixGeneratorConfig): FixGenerator {
  return new FixGenerator(config);
}
