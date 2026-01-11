/**
 * CSS/SCSS/Tailwind Language Module
 *
 * Implements the LanguageModule interface for CSS, SCSS, and Tailwind CSS
 * error parsing, analysis, root cause detection, and fix generation.
 *
 * @module css-module
 */

import { randomUUID } from 'crypto';
import {
  type AnalysisContext,
  type Evidence,
  type FixSuggestion,
  type Language,
  type LanguageModule,
  type ModuleAnalysisResult,
  type NormalizedError,
  type RootCauseHypothesis,
  type SourceLocation,
  type ValidationResult,
  type ValidationStep,
} from '../core/types.js';

// =============================================================================
// CSS/SCSS Error Patterns
// =============================================================================

const CSS_PATTERNS = {
  sassError: /^(?:Error|SassError): (.+):(\d+):(\d+): (.+)$/,
  sassCompilation: /^Compilation Error: (.+)$/,
  postcssError: /^(.+):(\d+):(\d+): (.+)$/,
  stylelint: /^(.+):(\d+):(\d+): (error|warning) (.+?)(?:\s+\((.+)\))?$/,
  cssParseError: /^(?:ParseError|SyntaxError): (.+) at line (\d+)/,
  tailwindError: /^(?:Error|Warning): (.+)$/,
  unknownUtility: /The `([^`]+)` class does not exist/,
  invalidConfig: /Invalid configuration/,
} as const;

const CSS_ERROR_TYPES: Readonly<Record<string, { category: string; commonCauses: string[] }>> = {
  SyntaxError: {
    category: 'syntax',
    commonCauses: [
      'Missing semicolon',
      'Unclosed bracket or brace',
      'Invalid property value',
      'Malformed selector',
    ],
  },
  SassError: {
    category: 'sass',
    commonCauses: [
      'Invalid @import path',
      'Undefined variable',
      'Invalid mixin call',
      'Compilation error',
    ],
  },
  StylelintError: {
    category: 'lint',
    commonCauses: [
      'Style convention violation',
      'Invalid property value',
      'Selector specificity issue',
      'Duplicate property',
    ],
  },
  TailwindError: {
    category: 'tailwind',
    commonCauses: [
      'Unknown utility class',
      'Invalid configuration',
      'Missing content paths',
      'JIT mode issue',
    ],
  },
  PostCSSError: {
    category: 'postcss',
    commonCauses: [
      'Plugin error',
      'Invalid CSS syntax',
      'Unsupported feature',
    ],
  },
};

const TAILWIND_CLASS_FIXES: Readonly<Record<string, string>> = {
  'flex-center': 'flex items-center justify-center',
  'text-bold': 'font-bold',
  'text-italic': 'italic',
  'text-underline': 'underline',
  'bg-opacity': 'bg-[color]/opacity',
  'border-radius': 'rounded-[value]',
  'box-shadow': 'shadow-[value]',
};

// =============================================================================
// Helper Functions
// =============================================================================

function buildSourceLocation(
  file: string,
  line: number,
  column?: number
): SourceLocation {
  const loc: SourceLocation = { file, line };
  if (column !== undefined) {
    loc.column = column;
  }
  return loc;
}

// =============================================================================
// CSS Language Module
// =============================================================================

export class CSSModule implements LanguageModule {
  readonly language: Language;
  readonly aliases: string[];
  readonly extensions: string[];

  constructor(variant: 'css' | 'scss' | 'tailwind' = 'css') {
    this.language = variant === 'tailwind' ? 'tailwind' : variant;

    switch (variant) {
      case 'scss':
        this.aliases = ['sass', 'scss'];
        this.extensions = ['.scss', '.sass'];
        break;
      case 'tailwind':
        this.aliases = ['tailwind', 'tailwindcss', 'tw'];
        this.extensions = ['.css', '.scss', '.html', '.jsx', '.tsx'];
        break;
      default:
        this.aliases = ['css', 'stylesheet'];
        this.extensions = ['.css'];
    }
  }

  // ===========================================================================
  // Error Parsing
  // ===========================================================================

  async parseError(raw: string): Promise<NormalizedError[]> {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    // Try Stylelint format
    const stylelintErrors = this.parseStylelintOutput(lines);
    if (stylelintErrors.length > 0) {
      return stylelintErrors;
    }

    // Try SCSS/Sass error format
    const sassErrors = this.parseSassErrors(lines, raw);
    if (sassErrors.length > 0) {
      return sassErrors;
    }

    // Try PostCSS error format
    const postcssErrors = this.parsePostCSSErrors(lines);
    if (postcssErrors.length > 0) {
      return postcssErrors;
    }

    // Try Tailwind-specific errors
    const tailwindErrors = this.parseTailwindErrors(raw);
    if (tailwindErrors.length > 0) {
      return tailwindErrors;
    }

    // Try generic CSS parse errors
    const genericErrors = this.parseGenericCSSErrors(lines, raw);
    errors.push(...genericErrors);

    return errors;
  }

  private parseSassErrors(lines: string[], raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.sassError.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push({
            id: randomUUID(),
            type: 'SassError',
            message,
            severity: 'error',
            source: 'build',
            language: 'scss',
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }

      const compileMatch = CSS_PATTERNS.sassCompilation.exec(line);
      if (compileMatch !== null) {
        const message = compileMatch[1];
        if (message !== undefined) {
          errors.push({
            id: randomUUID(),
            type: 'SassError',
            message,
            severity: 'error',
            source: 'build',
            language: 'scss',
            raw,
            timestamp: new Date(),
          });
        }
      }
    }

    return errors;
  }

  private parseStylelintOutput(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.stylelint.exec(line);
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

          const error: NormalizedError = {
            id: randomUUID(),
            type: 'StylelintError',
            message: fullMessage,
            severity: severity === 'error' ? 'error' : 'warning',
            source: 'static',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          };

          if (rule !== undefined) {
            error.code = rule;
          }

          errors.push(error);
        }
      }
    }

    return errors;
  }

  private parsePostCSSErrors(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.postcssError.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push({
            id: randomUUID(),
            type: 'PostCSSError',
            message,
            severity: 'error',
            source: 'build',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }
    }

    return errors;
  }

  private parseTailwindErrors(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    // Unknown utility class
    const unknownMatch = CSS_PATTERNS.unknownUtility.exec(raw);
    if (unknownMatch !== null) {
      const className = unknownMatch[1] ?? 'unknown';
      errors.push({
        id: randomUUID(),
        type: 'TailwindError',
        message: `Unknown utility class: ${className}`,
        severity: 'error',
        source: 'build',
        language: 'tailwind',
        raw,
        timestamp: new Date(),
      });
    }

    // Invalid configuration
    if (CSS_PATTERNS.invalidConfig.test(raw)) {
      errors.push({
        id: randomUUID(),
        type: 'TailwindError',
        message: 'Invalid Tailwind configuration',
        severity: 'error',
        source: 'build',
        language: 'tailwind',
        raw,
        timestamp: new Date(),
      });
    }

    // Generic Tailwind error
    const tailwindMatch = CSS_PATTERNS.tailwindError.exec(raw);
    if (tailwindMatch !== null && errors.length === 0) {
      const message = tailwindMatch[1];
      if (message !== undefined) {
        errors.push({
          id: randomUUID(),
          type: 'TailwindError',
          message,
          severity: 'error',
          source: 'build',
          language: 'tailwind',
          raw,
          timestamp: new Date(),
        });
      }
    }

    return errors;
  }

  private parseGenericCSSErrors(lines: string[], raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const parseMatch = CSS_PATTERNS.cssParseError.exec(line);
      if (parseMatch !== null) {
        const message = parseMatch[1];
        const lineNum = parseMatch[2];

        if (message !== undefined && lineNum !== undefined) {
          const location = buildSourceLocation('unknown', parseInt(lineNum, 10));

          errors.push({
            id: randomUUID(),
            type: 'SyntaxError',
            message,
            severity: 'error',
            source: 'build',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }
    }

    // Fallback: look for error keywords
    if (errors.length === 0 && /error|failed|invalid/i.test(raw)) {
      const firstLine = lines.find((l) => l.trim() !== '');
      if (firstLine !== undefined) {
        errors.push({
          id: randomUUID(),
          type: 'CSSError',
          message: firstLine.trim(),
          severity: 'error',
          source: 'build',
          language: this.language,
          raw,
          timestamp: new Date(),
        });
      }
    }

    return errors;
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  async analyze(
    errors: NormalizedError[],
    _context: AnalysisContext
  ): Promise<ModuleAnalysisResult> {
    const startTime = Date.now();
    const hypotheses: RootCauseHypothesis[] = [];
    const fixes: FixSuggestion[] = [];
    const notes: string[] = [];

    for (const error of errors) {
      const hypothesis = this.generateHypothesis(error);
      hypotheses.push(hypothesis);
    }

    return {
      module: this.language,
      errors,
      hypotheses,
      fixes,
      notes,
      analysisTimeMs: Date.now() - startTime,
    };
  }

  private generateHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    evidence.push({
      type: 'error',
      description: `${error.type}: ${error.message}`,
      strength: 0.9,
    });

    let description = `${error.type} occurred`;
    let confidence = 0.6;

    const errorInfo = CSS_ERROR_TYPES[error.type];
    if (errorInfo !== undefined) {
      description = `${error.type} (${errorInfo.category}): ${errorInfo.commonCauses[0] ?? 'Unknown cause'}`;
      confidence = 0.7;

      for (const cause of errorInfo.commonCauses) {
        evidence.push({
          type: 'pattern',
          description: `Possible cause: ${cause}`,
          strength: 0.5,
        });
      }
    }

    // Specific analysis based on error type
    const specificAnalysis = this.analyzeErrorMessage(error);
    if (specificAnalysis !== null) {
      description = specificAnalysis.description;
      confidence = specificAnalysis.confidence;
      suggestedFixes.push(...specificAnalysis.fixes);
    }

    if (error.location !== undefined) {
      relatedLocations.push(error.location);
    }

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private analyzeErrorMessage(error: NormalizedError): {
    description: string;
    confidence: number;
    fixes: FixSuggestion[];
  } | null {
    const message = error.message;

    // Unknown Tailwind utility
    const unknownUtilityMatch = /Unknown utility class: (.+)/.exec(message);
    if (unknownUtilityMatch !== null) {
      const className = unknownUtilityMatch[1] ?? 'unknown';
      return {
        description: `Tailwind utility class '${className}' does not exist`,
        confidence: 0.9,
        fixes: this.createUnknownUtilityFixes(className),
      };
    }

    // SCSS undefined variable
    if (message.includes('Undefined variable')) {
      const varMatch = /\$(\w+)/.exec(message);
      const varName = varMatch?.[1] ?? 'variable';
      return {
        description: `SCSS variable $${varName} is not defined`,
        confidence: 0.9,
        fixes: this.createUndefinedVariableFixes(varName),
      };
    }

    // Missing semicolon
    if (message.includes('semicolon') || message.includes('Expected ";"')) {
      return {
        description: 'Missing semicolon in CSS/SCSS',
        confidence: 0.95,
        fixes: this.createMissingSemicolonFix(error),
      };
    }

    // Invalid property value
    if (message.includes('Invalid value') || message.includes('invalid property value')) {
      return {
        description: 'Invalid CSS property value',
        confidence: 0.85,
        fixes: this.createInvalidPropertyFixes(error),
      };
    }

    // Unclosed bracket
    if (message.includes('Unclosed') || message.includes('unclosed')) {
      return {
        description: 'Unclosed bracket or brace in stylesheet',
        confidence: 0.9,
        fixes: this.createUnclosedBracketFix(error),
      };
    }

    return null;
  }

  // ===========================================================================
  // Fix Generation
  // ===========================================================================

  async suggestFixes(
    errors: NormalizedError[],
    hypotheses: RootCauseHypothesis[]
  ): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    for (const hypothesis of hypotheses) {
      fixes.push(...hypothesis.suggestedFixes);
    }

    for (const error of errors) {
      const additionalFixes = this.generateAdditionalFixes(error);
      fixes.push(...additionalFixes);
    }

    return fixes;
  }

  private generateAdditionalFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    if (error.type === 'TailwindError') {
      fixes.push(...this.generateTailwindFixes(error));
    }

    return fixes;
  }

  private createUnknownUtilityFixes(className: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    // Check for common misspellings
    const knownFix = TAILWIND_CLASS_FIXES[className];
    if (knownFix !== undefined) {
      fixes.push({
        id: randomUUID(),
        description: `Replace '${className}' with '${knownFix}'`,
        confidence: 0.95,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      });
    }

    // Suggest checking documentation
    fixes.push({
      id: randomUUID(),
      description: `Check Tailwind CSS documentation for correct utility class name`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: 'Verify class name in Tailwind documentation',
        expectedOutcome: 'Correct class name identified',
      }],
    });

    // Suggest adding to safelist if intentional
    fixes.push({
      id: randomUUID(),
      description: `If using dynamic class, add '${className}' to safelist in tailwind.config.js`,
      confidence: 0.6,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(),
    });

    return fixes;
  }

  private createUndefinedVariableFixes(varName: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Define variable $${varName} before use`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      },
      {
        id: randomUUID(),
        description: `Import the file containing $${varName} definition`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      },
    ];
  }

  private createMissingSemicolonFix(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` at line ${error.location.line}`
      : '';

    return [{
      id: randomUUID(),
      description: `Add missing semicolon at end of declaration${locationInfo}`,
      confidence: 0.95,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationStepsForError(error),
    }];
  }

  private createInvalidPropertyFixes(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` (line ${error.location.line})`
      : '';

    return [
      {
        id: randomUUID(),
        description: `Check property value against CSS specification${locationInfo}`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationStepsForError(error),
      },
      {
        id: randomUUID(),
        description: `Verify units are correct (px, em, rem, %, etc.)${locationInfo}`,
        confidence: 0.75,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationStepsForError(error),
      },
    ];
  }

  private createUnclosedBracketFix(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` near line ${error.location.line}`
      : '';

    return [{
      id: randomUUID(),
      description: `Add missing closing bracket or brace${locationInfo}`,
      confidence: 0.9,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationStepsForError(error),
    }];
  }

  private createValidationStepsForError(error: NormalizedError): ValidationStep[] {
    const steps: ValidationStep[] = [];
    const fileArg = error.location !== undefined ? ` ${error.location.file}` : '';

    if (this.language === 'scss') {
      steps.push({
        type: 'build',
        command: `npx sass --no-source-map${fileArg}`,
        expectedOutcome: 'SCSS compiles without errors',
      });
    }

    steps.push({
      type: 'lint',
      command: `npx stylelint${fileArg}`,
      expectedOutcome: 'No linting errors',
    });

    return steps;
  }

  private generateTailwindFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];
    const message = error.message;

    // Content paths issue
    if (message.includes('content') || message.includes('purge')) {
      fixes.push({
        id: randomUUID(),
        description: 'Update content paths in tailwind.config.js to include all template files',
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'build',
          command: 'npx tailwindcss build',
          expectedOutcome: 'Build completes without errors',
        }],
      });
    }

    return fixes;
  }

  private createValidationSteps(): ValidationStep[] {
    const steps: ValidationStep[] = [];

    if (this.language === 'scss') {
      steps.push({
        type: 'build',
        command: 'npx sass --no-source-map',
        expectedOutcome: 'SCSS compiles without errors',
      });
    }

    steps.push({
      type: 'lint',
      command: 'npx stylelint',
      expectedOutcome: 'No linting errors',
    });

    return steps;
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  async validateFix(fix: FixSuggestion): Promise<ValidationResult> {
    const results: ValidationResult['steps'] = [];

    for (const step of fix.validationSteps) {
      results.push({
        step,
        passed: true,
        output: 'Validation step pending implementation',
      });
    }

    return {
      passed: true,
      steps: results,
      notes: ['Validation requires execution environment'],
    };
  }

  // ===========================================================================
  // Capability Check
  // ===========================================================================

  canHandle(input: string | NormalizedError): boolean {
    if (typeof input === 'string') {
      return (
        CSS_PATTERNS.sassError.test(input) ||
        CSS_PATTERNS.stylelint.test(input) ||
        CSS_PATTERNS.postcssError.test(input) ||
        CSS_PATTERNS.unknownUtility.test(input) ||
        /\.(css|scss|sass):/.test(input) ||
        /tailwind/i.test(input)
      );
    }

    return (
      input.language === 'css' ||
      input.language === 'scss' ||
      input.language === 'tailwind'
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createCSSModule(): CSSModule {
  return new CSSModule('css');
}

export function createSCSSModule(): CSSModule {
  return new CSSModule('scss');
}

export function createTailwindModule(): CSSModule {
  return new CSSModule('tailwind');
}
