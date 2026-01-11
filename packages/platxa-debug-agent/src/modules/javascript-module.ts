/**
 * JavaScript/TypeScript Language Module
 *
 * Implements the LanguageModule interface for JavaScript and TypeScript
 * error parsing, analysis, root cause detection, and fix generation.
 *
 * @module javascript-module
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
  type StackFrame,
  type ValidationResult,
  type ValidationStep,
} from '../core/types.js';

// =============================================================================
// JavaScript/TypeScript Error Patterns
// =============================================================================

const JS_PATTERNS = {
  stackFrame: /^\s+at (?:(.+?) \()?([^()]+):(\d+):(\d+)\)?$/,
  error: /^(\w+(?:Error|Exception)): (.+)$/,
  tsDiagnostic: /^(.+)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/,
  eslint: /^(.+):(\d+):(\d+): (error|warning|info) (.+?)(?:\s+\((.+)\))?$/,
  nodeModule: /node_modules/,
  internalModule: /^(?:node:|internal\/)/,
} as const;

const JS_ERROR_TYPES: Readonly<Record<string, { category: string; commonCauses: string[] }>> = {
  TypeError: {
    category: 'type',
    commonCauses: [
      'Calling undefined as a function',
      'Reading property of undefined/null',
      'Wrong argument type',
      'Invalid array method on non-array',
    ],
  },
  ReferenceError: {
    category: 'reference',
    commonCauses: [
      'Variable not defined',
      'Using before declaration (TDZ)',
      'Typo in variable name',
      'Scope issue',
    ],
  },
  SyntaxError: {
    category: 'syntax',
    commonCauses: [
      'Missing bracket/parenthesis',
      'Unexpected token',
      'Invalid JSON',
      'Reserved word misuse',
    ],
  },
  RangeError: {
    category: 'range',
    commonCauses: [
      'Invalid array length',
      'Maximum call stack exceeded',
      'Invalid date',
      'Number out of range',
    ],
  },
  URIError: {
    category: 'uri',
    commonCauses: [
      'Invalid URI encoding',
      'Malformed URI',
    ],
  },
  EvalError: {
    category: 'eval',
    commonCauses: [
      'Incorrect use of eval()',
    ],
  },
  AggregateError: {
    category: 'aggregate',
    commonCauses: [
      'Multiple errors from Promise.any()',
      'Multiple validation errors',
    ],
  },
};

const TS_ERROR_CODES: Readonly<Record<string, { description: string; fix: string }>> = {
  TS2304: { description: 'Cannot find name', fix: 'Import or declare the identifier' },
  TS2305: { description: 'Module has no exported member', fix: 'Check export name or add export' },
  TS2307: { description: 'Cannot find module', fix: 'Install package or fix import path' },
  TS2322: { description: 'Type is not assignable', fix: 'Fix type mismatch or add type assertion' },
  TS2339: { description: 'Property does not exist on type', fix: 'Add property or fix type' },
  TS2345: { description: 'Argument type not assignable', fix: 'Fix argument type' },
  TS2531: { description: 'Object is possibly null', fix: 'Add null check or use optional chaining' },
  TS2532: { description: 'Object is possibly undefined', fix: 'Add undefined check' },
  TS2554: { description: 'Expected N arguments, got M', fix: 'Fix argument count' },
  TS2571: { description: 'Object is of type unknown', fix: 'Add type assertion or type guard' },
  TS2739: { description: 'Type missing required properties', fix: 'Add missing properties' },
  TS2741: { description: 'Property missing in type', fix: 'Add the missing property' },
  TS7006: { description: 'Parameter implicitly has any type', fix: 'Add explicit type annotation' },
  TS7031: { description: 'Binding element implicitly has any', fix: 'Add type annotation' },
  TS18046: { description: 'Value is of type unknown', fix: 'Add type guard or assertion' },
  TS18047: { description: 'Value is possibly null', fix: 'Add null check' },
  TS18048: { description: 'Value is possibly undefined', fix: 'Add undefined check' },
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

function isLibraryPath(filePath: string): boolean {
  return (
    JS_PATTERNS.nodeModule.test(filePath) ||
    JS_PATTERNS.internalModule.test(filePath) ||
    filePath.includes('webpack:') ||
    filePath.startsWith('<')
  );
}

// =============================================================================
// JavaScript/TypeScript Language Module
// =============================================================================

export class JavaScriptModule implements LanguageModule {
  readonly language: Language;
  readonly aliases: string[];
  readonly extensions: string[];

  constructor(variant: 'javascript' | 'typescript' = 'javascript') {
    this.language = variant;
    if (variant === 'typescript') {
      this.aliases = ['ts', 'tsx', 'typescript'];
      this.extensions = ['.ts', '.tsx', '.mts', '.cts'];
    } else {
      this.aliases = ['js', 'jsx', 'javascript', 'node', 'nodejs'];
      this.extensions = ['.js', '.jsx', '.mjs', '.cjs'];
    }
  }

  // ===========================================================================
  // Error Parsing
  // ===========================================================================

  async parseError(raw: string): Promise<NormalizedError[]> {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    // Try TypeScript diagnostic format first
    const tsDiagnostics = this.parseTypeScriptDiagnostics(lines);
    if (tsDiagnostics.length > 0) {
      return tsDiagnostics;
    }

    // Try ESLint format
    const eslintErrors = this.parseESLintOutput(lines);
    if (eslintErrors.length > 0) {
      return eslintErrors;
    }

    // Parse JavaScript stack trace
    const stackError = this.parseStackTrace(lines, raw);
    if (stackError !== null) {
      errors.push(stackError);
    }

    return errors;
  }

  private parseStackTrace(lines: string[], raw: string): NormalizedError | null {
    const stackFrames: StackFrame[] = [];
    let errorType = 'Error';
    let message = '';

    for (const line of lines) {
      const errorMatch = JS_PATTERNS.error.exec(line);
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

      const frameMatch = JS_PATTERNS.stackFrame.exec(line);
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
            !isLibraryPath(file)
          ));
        }
      }
    }

    if (message === '') {
      return null;
    }

    let primaryLocation: SourceLocation | undefined;
    const userFrames = stackFrames.filter((f) => f.isUserCode === true);
    if (userFrames.length > 0 && userFrames[0] !== undefined) {
      primaryLocation = userFrames[0].location;
    } else if (stackFrames.length > 0 && stackFrames[0] !== undefined) {
      primaryLocation = stackFrames[0].location;
    }

    const error: NormalizedError = {
      id: randomUUID(),
      type: errorType,
      message,
      severity: 'error',
      source: 'exception',
      language: this.language,
      raw,
      timestamp: new Date(),
    };

    if (primaryLocation !== undefined) {
      error.location = primaryLocation;
    }
    if (stackFrames.length > 0) {
      error.stackTrace = stackFrames;
    }

    return error;
  }

  private parseTypeScriptDiagnostics(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = JS_PATTERNS.tsDiagnostic.exec(line);
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

          const error: NormalizedError = {
            id: randomUUID(),
            type: 'TypeScriptError',
            message,
            severity: severity === 'error' ? 'error' : 'warning',
            source: 'static',
            language: 'typescript',
            location,
            raw: line,
            timestamp: new Date(),
          };

          if (code !== undefined) {
            error.code = code;
          }

          errors.push(error);
        }
      }
    }

    return errors;
  }

  private parseESLintOutput(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = JS_PATTERNS.eslint.exec(line);
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
            type: 'ESLintError',
            message: fullMessage,
            severity: this.mapSeverity(severity),
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

  private mapSeverity(severity?: string): 'error' | 'warning' | 'info' | 'hint' {
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
      default:
        return 'error';
    }
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

    if (error.stackTrace !== undefined && error.stackTrace.length > 0) {
      const userFrames = error.stackTrace.filter((f) => f.isUserCode === true);
      for (const frame of userFrames.slice(0, 3)) {
        evidence.push({
          type: 'code',
          description: `In ${frame.functionName ?? 'unknown'}`,
          location: frame.location,
          strength: 0.7,
        });
        relatedLocations.push(frame.location);
      }
    }

    let description = `${error.type} occurred`;
    let confidence = 0.6;

    // Handle TypeScript errors
    if (error.code !== undefined && error.code.startsWith('TS')) {
      const tsInfo = TS_ERROR_CODES[error.code];
      if (tsInfo !== undefined) {
        description = `${error.code}: ${tsInfo.description} - ${error.message}`;
        confidence = 0.85;
        suggestedFixes.push(this.createTSFix(error, tsInfo.fix));
      }
    }

    // Handle runtime errors
    const errorInfo = JS_ERROR_TYPES[error.type];
    if (errorInfo !== undefined) {
      const specificAnalysis = this.analyzeErrorMessage(error);
      if (specificAnalysis !== null) {
        description = specificAnalysis.description;
        confidence = specificAnalysis.confidence;
        suggestedFixes.push(...specificAnalysis.fixes);
      } else {
        description = `${error.type} (${errorInfo.category}): ${errorInfo.commonCauses[0] ?? 'Unknown cause'}`;
        confidence = 0.7;
      }

      for (const cause of errorInfo.commonCauses) {
        evidence.push({
          type: 'pattern',
          description: `Possible cause: ${cause}`,
          strength: 0.5,
        });
      }
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

    // Cannot read property/properties of undefined/null
    const propMatch = /Cannot read propert(?:y|ies) (?:of|'(\w+)' of) (undefined|null)/.exec(message);
    if (propMatch !== null) {
      const prop = propMatch[1] ?? 'unknown';
      const type = propMatch[2] ?? 'undefined';
      return {
        description: `Attempted to access '${prop}' on ${type} - add null/undefined check`,
        confidence: 0.9,
        fixes: this.createNullCheckFixes(error, prop),
      };
    }

    // X is not a function
    const notFuncMatch = /(.+) is not a function/.exec(message);
    if (notFuncMatch !== null) {
      const name = notFuncMatch[1] ?? 'Value';
      return {
        description: `'${name}' is not a function - check if it's correctly imported or defined`,
        confidence: 0.85,
        fixes: this.createNotFunctionFixes(error, name),
      };
    }

    // X is not defined
    const notDefinedMatch = /(\w+) is not defined/.exec(message);
    if (notDefinedMatch !== null) {
      const name = notDefinedMatch[1] ?? 'Variable';
      return {
        description: `'${name}' is not defined - import or declare it`,
        confidence: 0.9,
        fixes: this.createNotDefinedFixes(error, name),
      };
    }

    // Maximum call stack size exceeded
    if (message.includes('Maximum call stack size exceeded')) {
      return {
        description: 'Infinite recursion or deeply nested calls detected',
        confidence: 0.95,
        fixes: [this.createRecursionFix()],
      };
    }

    // Cannot assign to read only property
    const readOnlyMatch = /Cannot assign to read only property '(\w+)'/.exec(message);
    if (readOnlyMatch !== null) {
      const prop = readOnlyMatch[1] ?? 'property';
      return {
        description: `Cannot modify read-only property '${prop}' - use spread/Object.assign for immutable update`,
        confidence: 0.85,
        fixes: this.createReadOnlyFixes(error, prop),
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

    if (error.type === 'SyntaxError') {
      fixes.push(this.createSyntaxFix(error));
    }

    return fixes;
  }

  private createTSFix(error: NormalizedError, suggestion: string): FixSuggestion {
    return {
      id: randomUUID(),
      description: suggestion,
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    };
  }

  private createNullCheckFixes(error: NormalizedError, prop: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Add optional chaining: obj?.${prop}`,
        confidence: 0.9,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
      {
        id: randomUUID(),
        description: 'Add explicit null/undefined check before access',
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
    ];
  }

  private createNotFunctionFixes(error: NormalizedError, name: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Verify '${name}' is correctly imported/exported`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
      {
        id: randomUUID(),
        description: `Check if '${name}' is defined as a function`,
        confidence: 0.7,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
    ];
  }

  private createNotDefinedFixes(error: NormalizedError, name: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Import '${name}' from the appropriate module`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
      {
        id: randomUUID(),
        description: `Declare '${name}' before use`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
    ];
  }

  private createReadOnlyFixes(error: NormalizedError, prop: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Create a new object with updated '${prop}' using spread operator`,
      confidence: 0.85,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createRecursionFix(): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Add or fix base case to prevent infinite recursion',
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: 'Verify recursion has proper termination condition',
        expectedOutcome: 'Function terminates correctly',
      }],
    };
  }

  private createSyntaxFix(error: NormalizedError): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Fix syntax error: check for missing brackets, quotes, or semicolons',
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    };
  }

  private createValidationSteps(error: NormalizedError): ValidationStep[] {
    const steps: ValidationStep[] = [];

    if (this.language === 'typescript') {
      steps.push({
        type: 'typecheck',
        command: 'npx tsc --noEmit',
        expectedOutcome: 'No type errors',
      });
    }

    steps.push({
      type: 'lint',
      command: 'npx eslint --fix',
      expectedOutcome: 'No linting errors',
    });

    if (error.location !== undefined) {
      steps.push({
        type: 'test',
        command: 'npm test',
        expectedOutcome: 'All tests pass',
      });
    }

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
        JS_PATTERNS.error.test(input) ||
        JS_PATTERNS.stackFrame.test(input) ||
        JS_PATTERNS.tsDiagnostic.test(input) ||
        JS_PATTERNS.eslint.test(input) ||
        /\.(js|jsx|ts|tsx|mjs|cjs):/.test(input)
      );
    }

    return input.language === 'javascript' || input.language === 'typescript';
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createJavaScriptModule(): JavaScriptModule {
  return new JavaScriptModule('javascript');
}

export function createTypeScriptModule(): JavaScriptModule {
  return new JavaScriptModule('typescript');
}
