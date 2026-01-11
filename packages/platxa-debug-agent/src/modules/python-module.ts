/**
 * Python Language Module
 *
 * Implements the LanguageModule interface for Python-specific error parsing,
 * analysis, root cause detection, and fix generation.
 *
 * @module python-module
 */

import { randomUUID } from 'crypto';
import {
  type AnalysisContext,
  type Evidence,
  type FixSuggestion,
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
// Python Error Patterns
// =============================================================================

const PYTHON_PATTERNS = {
  traceback: /^Traceback \(most recent call last\):/m,
  frame: /^\s*File "([^"]+)", line (\d+)(?:, in (.+))?$/,
  error: /^(\w+(?:Error|Exception|Warning)): (.+)$/,
  syntaxError: /^\s*File "([^"]+)", line (\d+)\n.*\n\s*\^\s*\n(\w+Error): (.+)$/s,
  indentationPointer: /^\s*\^+\s*$/,
} as const;

const PYTHON_ERROR_TYPES: Readonly<Record<string, { category: string; commonCauses: string[] }>> = {
  TypeError: {
    category: 'type',
    commonCauses: [
      'Wrong argument type passed to function',
      'Calling non-callable object',
      'Unsupported operand types',
      'Missing required positional argument',
    ],
  },
  ValueError: {
    category: 'value',
    commonCauses: [
      'Invalid value for conversion',
      'Value out of expected range',
      'Empty sequence when value expected',
    ],
  },
  AttributeError: {
    category: 'attribute',
    commonCauses: [
      'Accessing undefined attribute',
      'NoneType has no attribute (missing null check)',
      'Typo in attribute name',
    ],
  },
  NameError: {
    category: 'name',
    commonCauses: [
      'Variable not defined',
      'Typo in variable name',
      'Using variable before assignment',
    ],
  },
  KeyError: {
    category: 'key',
    commonCauses: [
      'Dictionary key does not exist',
      'Missing key in dict access',
      'Typo in dictionary key',
    ],
  },
  IndexError: {
    category: 'index',
    commonCauses: [
      'List index out of range',
      'Empty list access',
      'Off-by-one error',
    ],
  },
  ImportError: {
    category: 'import',
    commonCauses: [
      'Module not installed',
      'Circular import',
      'Wrong module path',
    ],
  },
  ModuleNotFoundError: {
    category: 'import',
    commonCauses: [
      'Package not installed',
      'Virtual environment not activated',
      'Missing __init__.py',
    ],
  },
  SyntaxError: {
    category: 'syntax',
    commonCauses: [
      'Missing colon after statement',
      'Unbalanced parentheses/brackets',
      'Invalid indentation',
    ],
  },
  IndentationError: {
    category: 'indentation',
    commonCauses: [
      'Mixed tabs and spaces',
      'Inconsistent indentation level',
      'Missing indentation after block statement',
    ],
  },
  FileNotFoundError: {
    category: 'file',
    commonCauses: [
      'File path does not exist',
      'Relative path from wrong directory',
      'Missing file extension',
    ],
  },
  PermissionError: {
    category: 'permission',
    commonCauses: [
      'Insufficient file permissions',
      'File is read-only',
      'Directory access denied',
    ],
  },
  ZeroDivisionError: {
    category: 'arithmetic',
    commonCauses: [
      'Division by zero',
      'Missing zero check before division',
    ],
  },
  RecursionError: {
    category: 'recursion',
    commonCauses: [
      'Infinite recursion',
      'Missing base case',
      'Stack overflow',
    ],
  },
  StopIteration: {
    category: 'iterator',
    commonCauses: [
      'Iterator exhausted',
      'Calling next() on empty iterator',
    ],
  },
  AssertionError: {
    category: 'assertion',
    commonCauses: [
      'Failed assert statement',
      'Test assertion failed',
      'Precondition not met',
    ],
  },
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
  const patterns = [
    /site-packages/,
    /dist-packages/,
    /\.pyenv/,
    /\/lib\/python/,
    /\/usr\/lib/,
    /<frozen/,
    /<string>/,
    /venv\//,
    /\.venv\//,
  ];
  return patterns.some((p) => p.test(filePath));
}

// =============================================================================
// Python Language Module
// =============================================================================

export class PythonModule implements LanguageModule {
  readonly language = 'python' as const;
  readonly aliases = ['py', 'python3', 'python2', 'pypy'];
  readonly extensions = ['.py', '.pyi', '.pyw', '.pyx'];

  // ===========================================================================
  // Error Parsing
  // ===========================================================================

  async parseError(raw: string): Promise<NormalizedError[]> {
    const errors: NormalizedError[] = [];

    if (PYTHON_PATTERNS.traceback.test(raw)) {
      const error = this.parseTraceback(raw);
      if (error !== null) {
        errors.push(error);
      }
    } else {
      const lines = raw.split('\n');
      for (const line of lines) {
        const match = PYTHON_PATTERNS.error.exec(line);
        if (match !== null) {
          const errorType = match[1];
          const message = match[2];
          if (errorType !== undefined && message !== undefined) {
            errors.push(this.createError(errorType, message, raw));
          }
        }
      }
    }

    return errors;
  }

  private parseTraceback(raw: string): NormalizedError | null {
    const lines = raw.split('\n');
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

      if (PYTHON_PATTERNS.traceback.test(line)) {
        inTraceback = true;
        i++;
        continue;
      }

      if (inTraceback) {
        const frameMatch = PYTHON_PATTERNS.frame.exec(line);
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
              !isLibraryPath(file)
            ));
          }
          i++;
          continue;
        }

        const errorMatch = PYTHON_PATTERNS.error.exec(line);
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

    const error: NormalizedError = {
      id: randomUUID(),
      type: errorType,
      message,
      severity: 'error',
      source: 'exception',
      language: 'python',
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

  private createError(type: string, message: string, raw: string): NormalizedError {
    return {
      id: randomUUID(),
      type,
      message,
      severity: 'error',
      source: 'exception',
      language: 'python',
      raw,
      timestamp: new Date(),
    };
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
      module: 'python',
      errors,
      hypotheses,
      fixes,
      notes,
      analysisTimeMs: Date.now() - startTime,
    };
  }

  private generateHypothesis(error: NormalizedError): RootCauseHypothesis {
    const errorInfo = PYTHON_ERROR_TYPES[error.type];
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    // Add error message as evidence
    evidence.push({
      type: 'error',
      description: `${error.type}: ${error.message}`,
      strength: 0.9,
    });

    // Add stack trace evidence
    if (error.stackTrace !== undefined && error.stackTrace.length > 0) {
      const userFrames = error.stackTrace.filter((f) => f.isUserCode === true);
      for (const frame of userFrames) {
        evidence.push({
          type: 'code',
          description: `In ${frame.functionName ?? 'unknown'}: ${frame.raw ?? 'unknown code'}`,
          location: frame.location,
          strength: 0.7,
        });
        relatedLocations.push(frame.location);
      }
    }

    // Generate description based on error type
    let description = `${error.type} occurred`;
    let confidence = 0.6;

    if (errorInfo !== undefined) {
      description = `${error.type} (${errorInfo.category}): ${errorInfo.commonCauses[0] ?? 'Unknown cause'}`;
      confidence = 0.75;

      // Add common causes as evidence
      for (const cause of errorInfo.commonCauses) {
        evidence.push({
          type: 'pattern',
          description: `Possible cause: ${cause}`,
          strength: 0.5,
        });
      }
    }

    // Parse specific patterns in error message
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

    // TypeError: missing required positional argument
    const missingArgMatch = /missing (\d+) required positional argument[s]?: (.+)/.exec(message);
    if (missingArgMatch !== null) {
      const count = missingArgMatch[1];
      const args = missingArgMatch[2];
      return {
        description: `Function call is missing ${count} required argument(s): ${args}`,
        confidence: 0.9,
        fixes: this.createMissingArgFix(error, args ?? ''),
      };
    }

    // AttributeError: 'NoneType' has no attribute
    if (message.includes("'NoneType' has no attribute")) {
      const attrMatch = /has no attribute '(\w+)'/.exec(message);
      const attr = attrMatch?.[1] ?? 'unknown';
      return {
        description: `Attempted to access attribute '${attr}' on None - missing null check`,
        confidence: 0.85,
        fixes: this.createNoneCheckFix(error, attr),
      };
    }

    // NameError: name 'x' is not defined
    const nameMatch = /name '(\w+)' is not defined/.exec(message);
    if (nameMatch !== null) {
      const varName = nameMatch[1] ?? 'unknown';
      return {
        description: `Variable '${varName}' is used before being defined`,
        confidence: 0.9,
        fixes: this.createUndefinedNameFix(error, varName),
      };
    }

    // KeyError
    const keyMatch = /KeyError: ['"]?(.+?)['"]?$/.exec(message);
    if (keyMatch !== null) {
      const key = keyMatch[1] ?? 'unknown';
      return {
        description: `Dictionary key '${key}' does not exist`,
        confidence: 0.9,
        fixes: this.createKeyErrorFix(error, key),
      };
    }

    // IndexError: list index out of range
    if (message.includes('list index out of range')) {
      return {
        description: 'List index is out of bounds - check list length before accessing',
        confidence: 0.85,
        fixes: this.createIndexErrorFix(error),
      };
    }

    // ImportError / ModuleNotFoundError
    const moduleMatch = /No module named '([^']+)'/.exec(message);
    if (moduleMatch !== null) {
      const moduleName = moduleMatch[1] ?? 'unknown';
      return {
        description: `Module '${moduleName}' is not installed or not found`,
        confidence: 0.9,
        fixes: this.createModuleNotFoundFix(moduleName),
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

    // Generate additional fixes based on error patterns
    for (const error of errors) {
      const additionalFixes = this.generateAdditionalFixes(error);
      fixes.push(...additionalFixes);
    }

    return fixes;
  }

  private generateAdditionalFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    // Add type-specific fixes
    switch (error.type) {
      case 'ZeroDivisionError':
        fixes.push(this.createZeroDivisionFix(error));
        break;
      case 'RecursionError':
        fixes.push(this.createRecursionFix());
        break;
    }

    return fixes;
  }

  private createMissingArgFix(error: NormalizedError, args: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Add missing argument(s): ${args}`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createNoneCheckFix(error: NormalizedError, attr: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Add null check before accessing '${attr}' attribute`,
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createUndefinedNameFix(error: NormalizedError, varName: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Define variable '${varName}' before use or check for typos`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createKeyErrorFix(error: NormalizedError, key: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Use .get('${key}') with default value instead of direct access`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
      {
        id: randomUUID(),
        description: `Add key existence check: if '${key}' in dict`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(error),
      },
    ];
  }

  private createIndexErrorFix(error: NormalizedError): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: 'Add bounds check: if index < len(list)',
      confidence: 0.8,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    }];
  }

  private createModuleNotFoundFix(moduleName: string): FixSuggestion[] {
    return [{
      id: randomUUID(),
      description: `Install missing module: pip install ${moduleName}`,
      confidence: 0.9,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: `Run: pip install ${moduleName}`,
        expectedOutcome: 'Module installed successfully',
      }],
    }];
  }

  private createZeroDivisionFix(error: NormalizedError): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Add check for zero before division',
      confidence: 0.85,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(error),
    };
  }

  private createRecursionFix(): FixSuggestion {
    return {
      id: randomUUID(),
      description: 'Add or fix base case in recursive function',
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: 'Verify base case properly terminates recursion',
        expectedOutcome: 'Recursion terminates correctly',
      }],
    };
  }

  private createValidationSteps(error: NormalizedError): ValidationStep[] {
    const steps: ValidationStep[] = [];

    // Add type check step
    steps.push({
      type: 'typecheck',
      command: 'python -m mypy --ignore-missing-imports',
      expectedOutcome: 'No type errors',
    });

    // Add lint step
    steps.push({
      type: 'lint',
      command: 'python -m ruff check',
      expectedOutcome: 'No linting errors',
    });

    // Add test step if we can identify test files
    if (error.location !== undefined) {
      steps.push({
        type: 'test',
        command: 'python -m pytest -x',
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
    let allPassed = true;

    for (const step of fix.validationSteps) {
      // In production, this would actually run the commands
      // For now, we return a placeholder result
      results.push({
        step,
        passed: true,
        output: 'Validation step pending implementation',
      });
    }

    return {
      passed: allPassed,
      steps: results,
      notes: ['Validation requires execution environment'],
    };
  }

  // ===========================================================================
  // Capability Check
  // ===========================================================================

  canHandle(input: string | NormalizedError): boolean {
    if (typeof input === 'string') {
      // Check for Python-specific patterns
      return (
        PYTHON_PATTERNS.traceback.test(input) ||
        PYTHON_PATTERNS.error.test(input) ||
        /\.py[wi]?:/.test(input) ||
        /python/i.test(input)
      );
    }

    return input.language === 'python';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createPythonModule(): PythonModule {
  return new PythonModule();
}
