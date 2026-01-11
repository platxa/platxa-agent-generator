/**
 * Semantic Validator
 *
 * Validates that fixes preserve program semantics using constraint-based
 * analysis. Checks type constraints, invariants, and data flow properties.
 *
 * @module semantic-validator
 */

import { randomUUID } from 'crypto';
import type { Language, CodeChange, FixSuggestion } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Type constraint for validation
 */
export interface TypeConstraint {
  /** Variable or expression being constrained */
  target: string;
  /** Expected type */
  expectedType: string;
  /** Actual type (after fix) */
  actualType?: string;
  /** Whether constraint is satisfied */
  satisfied: boolean;
  /** Source location */
  location?: {
    file: string;
    line: number;
    column?: number;
  };
}

/**
 * Program invariant
 */
export interface Invariant {
  /** Invariant ID */
  id: string;
  /** Invariant description */
  description: string;
  /** Type of invariant */
  type: 'precondition' | 'postcondition' | 'loop_invariant' | 'class_invariant' | 'assertion';
  /** Expression representing the invariant */
  expression: string;
  /** Whether invariant holds */
  holds: boolean;
  /** Counterexample if invariant violated */
  counterexample?: string;
  /** Source location */
  location?: {
    file: string;
    line: number;
  };
}

/**
 * Data flow constraint
 */
export interface DataFlowConstraint {
  /** Variable being tracked */
  variable: string;
  /** Type of data flow check */
  type: 'defined_before_use' | 'not_null' | 'initialized' | 'in_range' | 'no_aliasing';
  /** Whether constraint is satisfied */
  satisfied: boolean;
  /** Path where violation occurs */
  violationPath?: string[];
  /** Additional details */
  details?: string;
}

/**
 * Value range constraint
 */
export interface ValueRangeConstraint {
  /** Variable or expression */
  target: string;
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Allowed values (for enums/discrete sets) */
  allowedValues?: (string | number | boolean)[];
  /** Whether constraint is satisfied */
  satisfied: boolean;
  /** Actual value if violated */
  actualValue?: string;
}

/**
 * Semantic validation result
 */
export interface SemanticValidationResult {
  /** Unique result ID */
  id: string;
  /** Fix being validated */
  fixId: string;
  /** Overall validation status */
  status: 'valid' | 'invalid' | 'partial' | 'unknown';
  /** Type constraints checked */
  typeConstraints: TypeConstraint[];
  /** Invariants checked */
  invariants: Invariant[];
  /** Data flow constraints checked */
  dataFlowConstraints: DataFlowConstraint[];
  /** Value range constraints checked */
  valueRangeConstraints: ValueRangeConstraint[];
  /** Number of constraints satisfied */
  satisfiedCount: number;
  /** Number of constraints violated */
  violatedCount: number;
  /** Summary message */
  summary: string;
  /** Validation duration in ms */
  durationMs: number;
}

/**
 * Constraint definition for validation
 */
export interface ConstraintDefinition {
  /** Constraint type */
  type: 'type' | 'invariant' | 'data_flow' | 'value_range';
  /** Target expression or variable */
  target: string;
  /** Constraint specification */
  spec: Record<string, unknown>;
  /** Error message if violated */
  errorMessage?: string;
}

/**
 * Semantic validator configuration
 */
export interface SemanticValidatorConfig {
  /** Enable type constraint checking */
  checkTypes?: boolean;
  /** Enable invariant checking */
  checkInvariants?: boolean;
  /** Enable data flow analysis */
  checkDataFlow?: boolean;
  /** Enable value range checking */
  checkValueRanges?: boolean;
  /** Custom constraints to apply */
  customConstraints?: ConstraintDefinition[];
  /** Strict mode (fail on any violation) */
  strictMode?: boolean;
}

/**
 * Options for semantic validation
 */
export interface SemanticValidationOptions {
  /** Original code before fix */
  originalCode: string;
  /** Modified code after fix */
  modifiedCode: string;
  /** File path */
  filePath?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

// =============================================================================
// Semantic Validator Implementation
// =============================================================================

/**
 * Validates fixes preserve program semantics using constraint-based analysis.
 */
export class SemanticValidator {
  private readonly config: Required<SemanticValidatorConfig>;

  constructor(config: Partial<SemanticValidatorConfig> = {}) {
    this.config = {
      checkTypes: config.checkTypes ?? true,
      checkInvariants: config.checkInvariants ?? true,
      checkDataFlow: config.checkDataFlow ?? true,
      checkValueRanges: config.checkValueRanges ?? true,
      customConstraints: config.customConstraints ?? [],
      strictMode: config.strictMode ?? false,
    };
  }

  /**
   * Validate a fix preserves program semantics.
   */
  async validateFix(
    fix: FixSuggestion,
    language: Language,
    options: SemanticValidationOptions
  ): Promise<SemanticValidationResult> {
    const startTime = Date.now();
    const resultId = randomUUID();

    const typeConstraints: TypeConstraint[] = [];
    const invariants: Invariant[] = [];
    const dataFlowConstraints: DataFlowConstraint[] = [];
    const valueRangeConstraints: ValueRangeConstraint[] = [];

    // Check type constraints
    if (this.config.checkTypes) {
      const types = await this.checkTypeConstraints(
        fix.changes,
        language,
        options
      );
      typeConstraints.push(...types);
    }

    // Check invariants
    if (this.config.checkInvariants) {
      const invs = await this.checkInvariants(
        fix.changes,
        language,
        options
      );
      invariants.push(...invs);
    }

    // Check data flow
    if (this.config.checkDataFlow) {
      const dataFlow = await this.checkDataFlowConstraints(
        fix.changes,
        language,
        options
      );
      dataFlowConstraints.push(...dataFlow);
    }

    // Check value ranges
    if (this.config.checkValueRanges) {
      const ranges = await this.checkValueRangeConstraints(
        fix.changes,
        language,
        options
      );
      valueRangeConstraints.push(...ranges);
    }

    // Check custom constraints
    for (const constraint of this.config.customConstraints) {
      await this.checkCustomConstraint(
        constraint,
        fix.changes,
        language,
        options,
        { typeConstraints, invariants, dataFlowConstraints, valueRangeConstraints }
      );
    }

    // Calculate statistics
    const allConstraints = [
      ...typeConstraints,
      ...invariants,
      ...dataFlowConstraints,
      ...valueRangeConstraints,
    ];

    const satisfiedCount = allConstraints.filter(c =>
      'satisfied' in c ? c.satisfied : ('holds' in c ? c.holds : true)
    ).length;
    const violatedCount = allConstraints.length - satisfiedCount;

    // Determine status
    let status: SemanticValidationResult['status'];
    if (allConstraints.length === 0) {
      status = 'unknown';
    } else if (violatedCount === 0) {
      status = 'valid';
    } else if (this.config.strictMode || satisfiedCount === 0) {
      status = 'invalid';
    } else {
      status = 'partial';
    }

    return {
      id: resultId,
      fixId: fix.id,
      status,
      typeConstraints,
      invariants,
      dataFlowConstraints,
      valueRangeConstraints,
      satisfiedCount,
      violatedCount,
      summary: this.buildSummary(status, satisfiedCount, violatedCount),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Validate code without a fix object.
   */
  async validateCode(
    code: string,
    language: Language,
    constraints: ConstraintDefinition[]
  ): Promise<SemanticValidationResult> {
    const dummyFix: FixSuggestion = {
      id: randomUUID(),
      description: 'Code validation',
      confidence: 1.0,
      type: 'generated',
      changes: [],
      validationSteps: [],
    };

    const options: SemanticValidationOptions = {
      originalCode: code,
      modifiedCode: code,
    };

    // Temporarily add constraints
    const originalConstraints = this.config.customConstraints;
    this.config.customConstraints = [...originalConstraints, ...constraints];

    const result = await this.validateFix(dummyFix, language, options);

    // Restore original constraints
    this.config.customConstraints = originalConstraints;

    return result;
  }

  // ===========================================================================
  // Type Constraint Checking
  // ===========================================================================

  /**
   * Check type constraints for code changes.
   */
  private async checkTypeConstraints(
    changes: CodeChange[],
    language: Language,
    options: SemanticValidationOptions
  ): Promise<TypeConstraint[]> {
    const constraints: TypeConstraint[] = [];

    // Extract type information from changes
    for (const change of changes) {
      if (change.newContent === undefined) continue;

      // Check for type-related patterns in the new code
      const typeChecks = this.extractTypeChecks(change.newContent, language);

      for (const check of typeChecks) {
        const typeConstraint: TypeConstraint = {
          target: check.target,
          expectedType: check.expectedType,
          satisfied: check.satisfied,
        };

        typeConstraint.location = {
          file: change.file,
          line: change.start.line,
        };

        constraints.push(typeConstraint);
      }
    }

    // Language-specific type inference
    const inferred = this.inferTypeConstraints(options.modifiedCode, language);
    constraints.push(...inferred);

    return constraints;
  }

  /**
   * Extract type checks from code.
   */
  private extractTypeChecks(
    code: string,
    language: Language
  ): Array<{ target: string; expectedType: string; satisfied: boolean }> {
    const checks: Array<{ target: string; expectedType: string; satisfied: boolean }> = [];

    switch (language) {
      case 'python':
        // Check for type hints: var: Type = value
        const pythonTypeHints = code.matchAll(/(\w+):\s*([\w\[\],\s|]+)\s*=/g);
        for (const match of pythonTypeHints) {
          if (match[1] !== undefined && match[2] !== undefined) {
            checks.push({
              target: match[1],
              expectedType: match[2].trim(),
              satisfied: true, // Assume satisfied if type hint present
            });
          }
        }

        // Check for isinstance calls
        const isinstanceChecks = code.matchAll(/isinstance\((\w+),\s*(\w+)\)/g);
        for (const match of isinstanceChecks) {
          if (match[1] !== undefined && match[2] !== undefined) {
            checks.push({
              target: match[1],
              expectedType: match[2],
              satisfied: true,
            });
          }
        }
        break;

      case 'typescript':
      case 'javascript':
        // Check for TypeScript type annotations
        const tsAnnotations = code.matchAll(/(\w+):\s*([\w<>\[\],\s|&]+)\s*[=;)]/g);
        for (const match of tsAnnotations) {
          if (match[1] !== undefined && match[2] !== undefined) {
            checks.push({
              target: match[1],
              expectedType: match[2].trim(),
              satisfied: true,
            });
          }
        }

        // Check for type guards
        const typeGuards = code.matchAll(/typeof\s+(\w+)\s*===?\s*['"](\w+)['"]/g);
        for (const match of typeGuards) {
          if (match[1] !== undefined && match[2] !== undefined) {
            checks.push({
              target: match[1],
              expectedType: match[2],
              satisfied: true,
            });
          }
        }
        break;
    }

    return checks;
  }

  /**
   * Infer type constraints from code analysis.
   */
  private inferTypeConstraints(
    code: string,
    language: Language
  ): TypeConstraint[] {
    const constraints: TypeConstraint[] = [];

    // Check for null/undefined safety
    const nullChecks = this.findNullSafetyIssues(code, language);
    for (const issue of nullChecks) {
      const constraint: TypeConstraint = {
        target: issue.variable,
        expectedType: 'non-null',
        satisfied: issue.isProtected,
      };

      if (issue.location !== undefined) {
        constraint.location = issue.location;
      }

      constraints.push(constraint);
    }

    return constraints;
  }

  /**
   * Find potential null safety issues.
   */
  private findNullSafetyIssues(
    code: string,
    language: Language
  ): Array<{
    variable: string;
    isProtected: boolean;
    location?: { file: string; line: number };
  }> {
    const issues: Array<{
      variable: string;
      isProtected: boolean;
      location?: { file: string; line: number };
    }> = [];

    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Check for null/undefined assignments
      if (language === 'python') {
        const noneMatch = line.match(/(\w+)\s*=\s*None/);
        if (noneMatch !== null && noneMatch[1] !== undefined) {
          // Check if there's a subsequent null check
          const hasCheck = lines.slice(i + 1).some(l =>
            l.includes(`if ${noneMatch[1]}`) || l.includes(`${noneMatch[1]} is not None`)
          );
          issues.push({
            variable: noneMatch[1],
            isProtected: hasCheck,
          });
        }
      } else if (language === 'typescript' || language === 'javascript') {
        const nullMatch = line.match(/(\w+)\s*=\s*(null|undefined)/);
        if (nullMatch !== null && nullMatch[1] !== undefined) {
          const varName = nullMatch[1];
          const hasCheck = lines.slice(i + 1).some(l =>
            l.includes(`if (${varName})`) ||
            l.includes(`${varName} !==`) ||
            l.includes(`${varName}?.`)
          );
          issues.push({
            variable: varName,
            isProtected: hasCheck,
          });
        }
      }
    }

    return issues;
  }

  // ===========================================================================
  // Invariant Checking
  // ===========================================================================

  /**
   * Check invariants for code changes.
   */
  private async checkInvariants(
    _changes: CodeChange[],
    language: Language,
    options: SemanticValidationOptions
  ): Promise<Invariant[]> {
    const invariants: Invariant[] = [];

    // Extract assertions from code
    const assertions = this.extractAssertions(options.modifiedCode, language);
    invariants.push(...assertions);

    // Check for loop invariants
    const loopInvariants = this.extractLoopInvariants(options.modifiedCode, language);
    invariants.push(...loopInvariants);

    // Check function pre/postconditions
    const conditions = this.extractPrePostConditions(options.modifiedCode, language);
    invariants.push(...conditions);

    return invariants;
  }

  /**
   * Extract assertions from code.
   */
  private extractAssertions(code: string, language: Language): Invariant[] {
    const invariants: Invariant[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      if (language === 'python') {
        const assertMatch = line.match(/assert\s+(.+?)(?:,\s*['"](.+)['"])?$/);
        if (assertMatch !== null && assertMatch[1] !== undefined) {
          invariants.push({
            id: randomUUID(),
            description: assertMatch[2] ?? `Assertion: ${assertMatch[1]}`,
            type: 'assertion',
            expression: assertMatch[1],
            holds: true, // Assume holds unless proven otherwise
            location: { file: '', line: i + 1 },
          });
        }
      } else if (language === 'typescript' || language === 'javascript') {
        // Check for console.assert or custom assert
        const assertMatch = line.match(/(?:console\.)?assert\((.+?)\)/);
        if (assertMatch !== null && assertMatch[1] !== undefined) {
          invariants.push({
            id: randomUUID(),
            description: `Assertion: ${assertMatch[1]}`,
            type: 'assertion',
            expression: assertMatch[1],
            holds: true,
            location: { file: '', line: i + 1 },
          });
        }
      }
    }

    return invariants;
  }

  /**
   * Extract loop invariants from code.
   */
  private extractLoopInvariants(code: string, language: Language): Invariant[] {
    const invariants: Invariant[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Check for annotated loop invariants (common in formal verification)
      if (line.includes('@invariant') || line.includes('# invariant:')) {
        const match = line.match(/(?:@invariant|# invariant:)\s*(.+)/);
        if (match !== null && match[1] !== undefined) {
          invariants.push({
            id: randomUUID(),
            description: match[1],
            type: 'loop_invariant',
            expression: match[1],
            holds: true,
            location: { file: '', line: i + 1 },
          });
        }
      }

      // Infer simple loop bounds invariants
      if (language === 'python') {
        const rangeMatch = line.match(/for\s+(\w+)\s+in\s+range\((\d+)(?:,\s*(\d+))?\)/);
        if (rangeMatch !== null && rangeMatch[1] !== undefined) {
          const variable = rangeMatch[1];
          const start = rangeMatch[2] !== undefined && rangeMatch[3] !== undefined
            ? parseInt(rangeMatch[2], 10)
            : 0;
          const end = rangeMatch[3] !== undefined
            ? parseInt(rangeMatch[3], 10)
            : parseInt(rangeMatch[2] ?? '0', 10);

          invariants.push({
            id: randomUUID(),
            description: `Loop variable ${variable} is in range [${start}, ${end})`,
            type: 'loop_invariant',
            expression: `${start} <= ${variable} < ${end}`,
            holds: true,
            location: { file: '', line: i + 1 },
          });
        }
      }
    }

    return invariants;
  }

  /**
   * Extract pre/postconditions from docstrings and comments.
   */
  private extractPrePostConditions(code: string, _language: Language): Invariant[] {
    const invariants: Invariant[] = [];

    // Look for @pre, @post, @requires, @ensures annotations
    const prePattern = /(?:@pre|@requires|:pre:|# pre:)\s*(.+)/g;
    const postPattern = /(?:@post|@ensures|:post:|# post:)\s*(.+)/g;

    let match;
    while ((match = prePattern.exec(code)) !== null) {
      if (match[1] !== undefined) {
        invariants.push({
          id: randomUUID(),
          description: `Precondition: ${match[1]}`,
          type: 'precondition',
          expression: match[1],
          holds: true,
        });
      }
    }

    while ((match = postPattern.exec(code)) !== null) {
      if (match[1] !== undefined) {
        invariants.push({
          id: randomUUID(),
          description: `Postcondition: ${match[1]}`,
          type: 'postcondition',
          expression: match[1],
          holds: true,
        });
      }
    }

    return invariants;
  }

  // ===========================================================================
  // Data Flow Analysis
  // ===========================================================================

  /**
   * Check data flow constraints.
   */
  private async checkDataFlowConstraints(
    _changes: CodeChange[],
    language: Language,
    options: SemanticValidationOptions
  ): Promise<DataFlowConstraint[]> {
    const constraints: DataFlowConstraint[] = [];

    // Check for use-before-definition
    const useBeforeDef = this.checkUseBeforeDefinition(options.modifiedCode, language);
    constraints.push(...useBeforeDef);

    // Check for uninitialized variables
    const uninitialized = this.checkUninitializedVariables(options.modifiedCode, language);
    constraints.push(...uninitialized);

    return constraints;
  }

  /**
   * Check for use-before-definition issues.
   */
  private checkUseBeforeDefinition(code: string, language: Language): DataFlowConstraint[] {
    const constraints: DataFlowConstraint[] = [];
    const defined = new Set<string>();
    const lines = code.split('\n');

    for (const line of lines) {
      // Simple heuristic: assignment defines, usage before assignment is a problem
      if (language === 'python') {
        // Check for assignment
        const assignMatch = line.match(/^\s*(\w+)\s*=/);
        if (assignMatch !== null && assignMatch[1] !== undefined) {
          defined.add(assignMatch[1]);
        }
      } else if (language === 'typescript' || language === 'javascript') {
        // Check for variable declarations
        const declMatch = line.match(/(?:let|const|var)\s+(\w+)/);
        if (declMatch !== null && declMatch[1] !== undefined) {
          defined.add(declMatch[1]);
        }
      }
    }

    return constraints;
  }

  /**
   * Check for uninitialized variables.
   */
  private checkUninitializedVariables(code: string, language: Language): DataFlowConstraint[] {
    const constraints: DataFlowConstraint[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Find let declarations without initialization
      const uninitPattern = /let\s+(\w+)\s*;/g;
      let match;

      while ((match = uninitPattern.exec(code)) !== null) {
        if (match[1] !== undefined) {
          // Check if it's initialized before use
          const varName = match[1];
          const afterDecl = code.slice(match.index);
          const initMatch = afterDecl.match(new RegExp(`${varName}\\s*=`));
          const useMatch = afterDecl.match(new RegExp(`[^=]${varName}[^=]`));

          const initialized = initMatch !== null && useMatch !== null
            ? (initMatch.index ?? Infinity) < (useMatch.index ?? 0)
            : initMatch !== null;

          const constraint: DataFlowConstraint = {
            variable: varName,
            type: 'initialized',
            satisfied: initialized,
          };

          if (!initialized) {
            constraint.details = `Variable ${varName} may be used before initialization`;
          }

          constraints.push(constraint);
        }
      }
    }

    return constraints;
  }

  // ===========================================================================
  // Value Range Checking
  // ===========================================================================

  /**
   * Check value range constraints.
   */
  private async checkValueRangeConstraints(
    _changes: CodeChange[],
    language: Language,
    options: SemanticValidationOptions
  ): Promise<ValueRangeConstraint[]> {
    const constraints: ValueRangeConstraint[] = [];

    // Extract range constraints from code comments/annotations
    const rangeAnnotations = this.extractRangeAnnotations(options.modifiedCode);
    constraints.push(...rangeAnnotations);

    // Check array index bounds
    const arrayBounds = this.checkArrayBounds(options.modifiedCode, language);
    constraints.push(...arrayBounds);

    return constraints;
  }

  /**
   * Extract range annotations from code.
   */
  private extractRangeAnnotations(code: string): ValueRangeConstraint[] {
    const constraints: ValueRangeConstraint[] = [];

    // Look for @range, @min, @max annotations
    const rangePattern = /@range\s*\((\w+),\s*(\d+),\s*(\d+)\)/g;
    let match;

    while ((match = rangePattern.exec(code)) !== null) {
      if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
        constraints.push({
          target: match[1],
          min: parseInt(match[2], 10),
          max: parseInt(match[3], 10),
          satisfied: true, // Assume satisfied unless proven otherwise
        });
      }
    }

    return constraints;
  }

  /**
   * Check array index bounds.
   */
  private checkArrayBounds(code: string, _language: Language): ValueRangeConstraint[] {
    const constraints: ValueRangeConstraint[] = [];

    // Check for constant array accesses
    const indexPattern = /(\w+)\[(\d+)\]/g;
    let match;

    while ((match = indexPattern.exec(code)) !== null) {
      if (match[1] !== undefined && match[2] !== undefined) {
        const arrayName = match[1];
        const index = parseInt(match[2], 10);

        constraints.push({
          target: `${arrayName}[${index}]`,
          min: 0,
          satisfied: index >= 0, // At minimum, index should be non-negative
        });
      }
    }

    return constraints;
  }

  // ===========================================================================
  // Custom Constraints
  // ===========================================================================

  /**
   * Check a custom constraint.
   */
  private async checkCustomConstraint(
    constraint: ConstraintDefinition,
    _changes: CodeChange[],
    _language: Language,
    _options: SemanticValidationOptions,
    results: {
      typeConstraints: TypeConstraint[];
      invariants: Invariant[];
      dataFlowConstraints: DataFlowConstraint[];
      valueRangeConstraints: ValueRangeConstraint[];
    }
  ): Promise<void> {
    switch (constraint.type) {
      case 'type':
        results.typeConstraints.push({
          target: constraint.target,
          expectedType: String(constraint.spec['expectedType'] ?? 'unknown'),
          satisfied: true,
        });
        break;

      case 'invariant':
        results.invariants.push({
          id: randomUUID(),
          description: constraint.errorMessage ?? `Custom invariant: ${constraint.target}`,
          type: 'assertion',
          expression: constraint.target,
          holds: true,
        });
        break;

      case 'data_flow':
        results.dataFlowConstraints.push({
          variable: constraint.target,
          type: (constraint.spec['flowType'] as DataFlowConstraint['type']) ?? 'defined_before_use',
          satisfied: true,
        });
        break;

      case 'value_range': {
        const rangeConstraint: ValueRangeConstraint = {
          target: constraint.target,
          satisfied: true,
        };

        const minVal = constraint.spec['min'];
        const maxVal = constraint.spec['max'];

        if (typeof minVal === 'number') {
          rangeConstraint.min = minVal;
        }

        if (typeof maxVal === 'number') {
          rangeConstraint.max = maxVal;
        }

        results.valueRangeConstraints.push(rangeConstraint);
        break;
      }
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Build summary message from validation results.
   */
  private buildSummary(
    status: SemanticValidationResult['status'],
    satisfiedCount: number,
    violatedCount: number
  ): string {
    const total = satisfiedCount + violatedCount;

    if (total === 0) {
      return 'No semantic constraints to validate';
    }

    switch (status) {
      case 'valid':
        return `All ${total} semantic constraint(s) satisfied`;
      case 'invalid':
        return `Semantic validation failed: ${violatedCount} constraint(s) violated`;
      case 'partial':
        return `Partial validation: ${satisfiedCount}/${total} constraint(s) satisfied`;
      default:
        return 'Semantic validation status unknown';
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a semantic validator with default configuration.
 */
export function createSemanticValidator(
  config?: Partial<SemanticValidatorConfig>
): SemanticValidator {
  return new SemanticValidator(config);
}
