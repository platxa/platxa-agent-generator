/**
 * Root Cause Analysis (RCA) Engine
 *
 * Generates plausible root cause hypotheses from error context using
 * pattern matching, evidence gathering, and LLM prompt templates.
 *
 * @module rca-engine
 */

import { randomUUID } from 'crypto';
import type {
  AnalysisContext,
  Evidence,
  FixSuggestion,
  Language,
  NormalizedError,
  RootCauseHypothesis,
  SourceLocation,
  ValidationStep,
} from './types.js';
import type { CodeContext, SymbolInfo } from './context-engine.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Error pattern for matching and hypothesis generation
 */
export interface ErrorPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Languages this pattern applies to */
  languages: Language[];
  /** Error type regex pattern */
  errorTypePattern: RegExp;
  /** Error message regex pattern */
  messagePattern: RegExp;
  /** Root cause description template */
  causeTemplate: string;
  /** Evidence types to look for */
  evidenceTypes: Evidence['type'][];
  /** Base confidence for this pattern */
  baseConfidence: number;
  /** Fix suggestion templates */
  fixTemplates: FixTemplate[];
  /** Additional context to gather */
  contextHints: string[];
}

/**
 * Fix suggestion template
 */
export interface FixTemplate {
  /** Description template (supports {{variable}} placeholders) */
  description: string;
  /** Fix type */
  type: 'template' | 'generated';
  /** Confidence modifier */
  confidenceModifier: number;
  /** Validation steps */
  validationSteps: ValidationStep[];
}

/**
 * LLM prompt template for hypothesis generation
 */
export interface LLMPromptTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** System prompt */
  systemPrompt: string;
  /** User prompt template (supports placeholders) */
  userPromptTemplate: string;
  /** Expected output format */
  outputFormat: 'json' | 'text' | 'structured';
  /** Output schema for JSON format */
  outputSchema?: Record<string, unknown>;
}

/**
 * Hypothesis generation result
 */
export interface HypothesisGenerationResult {
  /** Generated hypotheses */
  hypotheses: RootCauseHypothesis[];
  /** LLM prompts for further analysis */
  llmPrompts: GeneratedPrompt[];
  /** Analysis notes */
  notes: string[];
  /** Generation time in ms */
  generationTimeMs: number;
}

/**
 * A generated LLM prompt for external processing
 */
export interface GeneratedPrompt {
  /** Prompt identifier */
  id: string;
  /** Template used */
  templateId: string;
  /** System message */
  system: string;
  /** User message */
  user: string;
  /** Context included */
  context: {
    errors: NormalizedError[];
    codeContext?: CodeContext;
    symbols?: SymbolInfo[];
  };
  /** Expected response handler */
  responseHandler: 'parse_hypothesis' | 'parse_fix' | 'parse_evidence';
}

/**
 * RCA Engine configuration
 */
export interface RCAEngineConfig {
  /** Maximum hypotheses to generate */
  maxHypotheses?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Enable LLM prompt generation */
  enableLLMPrompts?: boolean;
  /** Custom error patterns */
  customPatterns?: ErrorPattern[];
}

// =============================================================================
// Built-in Error Patterns
// =============================================================================

const BUILTIN_ERROR_PATTERNS: ErrorPattern[] = [
  // Python Patterns
  {
    id: 'py-name-error',
    name: 'Python NameError',
    languages: ['python'],
    errorTypePattern: /^NameError$/,
    messagePattern: /name '(\w+)' is not defined/,
    causeTemplate: "Variable or function '{{name}}' is used before being defined or imported",
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.85,
    fixTemplates: [
      {
        description: "Import '{{name}}' from the appropriate module",
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'pyright', expectedOutcome: 'No errors' }],
      },
      {
        description: "Define '{{name}}' before using it",
        type: 'template',
        confidenceModifier: 0.05,
        validationSteps: [{ type: 'typecheck', command: 'pyright', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check imports at top of file', 'Look for typos in variable name'],
  },
  {
    id: 'py-type-error',
    name: 'Python TypeError',
    languages: ['python'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /(.+)/,
    causeTemplate: 'Type mismatch: {{message}}',
    evidenceTypes: ['code', 'error', 'static_analysis'],
    baseConfidence: 0.75,
    fixTemplates: [
      {
        description: 'Add type conversion or check type before operation',
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'pyright', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check function signatures', 'Verify argument types'],
  },
  {
    id: 'py-attribute-error',
    name: 'Python AttributeError',
    languages: ['python'],
    errorTypePattern: /^AttributeError$/,
    messagePattern: /'(\w+)' object has no attribute '(\w+)'/,
    causeTemplate: "Object of type '{{type}}' does not have attribute '{{attribute}}'",
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.8,
    fixTemplates: [
      {
        description: "Check if '{{attribute}}' is spelled correctly",
        type: 'template',
        confidenceModifier: 0.15,
        validationSteps: [{ type: 'typecheck', command: 'pyright', expectedOutcome: 'No errors' }],
      },
      {
        description: 'Verify the object type is correct before accessing attribute',
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'pyright', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check class definition', 'Look for None values'],
  },
  {
    id: 'py-import-error',
    name: 'Python ImportError',
    languages: ['python'],
    errorTypePattern: /^(?:Import|Module)Error$/,
    messagePattern: /No module named '([^']+)'/,
    causeTemplate: "Module '{{module}}' is not installed or not in Python path",
    evidenceTypes: ['error', 'pattern'],
    baseConfidence: 0.9,
    fixTemplates: [
      {
        description: "Install missing module: pip install {{module}}",
        type: 'template',
        confidenceModifier: 0.2,
        validationSteps: [{ type: 'build', command: 'pip install {{module}}', expectedOutcome: 'Installation successful' }],
      },
    ],
    contextHints: ['Check requirements.txt', 'Verify virtual environment'],
  },

  // JavaScript/TypeScript Patterns
  {
    id: 'js-reference-error',
    name: 'JavaScript ReferenceError',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^ReferenceError$/,
    messagePattern: /(\w+) is not defined/,
    causeTemplate: "Variable '{{name}}' is used before being declared or imported",
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.85,
    fixTemplates: [
      {
        description: "Import '{{name}}' from the appropriate module",
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
      {
        description: "Declare '{{name}}' before using it",
        type: 'template',
        confidenceModifier: 0.05,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check imports', 'Verify variable scope'],
  },
  {
    id: 'js-type-error',
    name: 'JavaScript TypeError',
    languages: ['javascript', 'typescript'],
    errorTypePattern: /^TypeError$/,
    messagePattern: /Cannot read propert(?:y|ies) (?:of |')?(\w+)?(?:')?/,
    causeTemplate: 'Attempted to access property on null or undefined value',
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.8,
    fixTemplates: [
      {
        description: 'Add null/undefined check before accessing property',
        type: 'template',
        confidenceModifier: 0.15,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
      {
        description: 'Use optional chaining (?.) to safely access property',
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check for async operations', 'Verify data initialization'],
  },
  {
    id: 'ts-type-mismatch',
    name: 'TypeScript Type Mismatch',
    languages: ['typescript'],
    errorTypePattern: /^TS\d+$/,
    messagePattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    causeTemplate: "Type '{{sourceType}}' cannot be assigned to '{{targetType}}'",
    evidenceTypes: ['code', 'error', 'static_analysis'],
    baseConfidence: 0.9,
    fixTemplates: [
      {
        description: 'Add type assertion or conversion',
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
      {
        description: 'Update type definition to be more permissive',
        type: 'template',
        confidenceModifier: 0.05,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check interface definitions', 'Review generic type parameters'],
  },
  {
    id: 'ts-property-missing',
    name: 'TypeScript Missing Property',
    languages: ['typescript'],
    errorTypePattern: /^TS\d+$/,
    messagePattern: /Property '(\w+)' (?:does not exist|is missing)/,
    causeTemplate: "Required property '{{property}}' is missing or misspelled",
    evidenceTypes: ['code', 'error', 'static_analysis'],
    baseConfidence: 0.85,
    fixTemplates: [
      {
        description: "Add missing property '{{property}}' to the object",
        type: 'template',
        confidenceModifier: 0.15,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
      {
        description: 'Make property optional in type definition',
        type: 'template',
        confidenceModifier: 0.05,
        validationSteps: [{ type: 'typecheck', command: 'tsc --noEmit', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check interface/type definition', 'Look for typos'],
  },

  // CSS/Tailwind Patterns
  {
    id: 'css-unknown-property',
    name: 'CSS Unknown Property',
    languages: ['css', 'scss'],
    errorTypePattern: /^(?:CSS|Style)Error$/,
    messagePattern: /Unknown property[:\s]+['"]?(\w+)['"]?/,
    causeTemplate: "CSS property '{{property}}' is not recognized",
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.85,
    fixTemplates: [
      {
        description: "Check spelling of property '{{property}}'",
        type: 'template',
        confidenceModifier: 0.15,
        validationSteps: [{ type: 'lint', command: 'stylelint', expectedOutcome: 'No errors' }],
      },
    ],
    contextHints: ['Check CSS specification', 'Verify browser support'],
  },
  {
    id: 'tailwind-unknown-class',
    name: 'Tailwind Unknown Utility',
    languages: ['tailwind'],
    errorTypePattern: /^TailwindError$/,
    messagePattern: /(?:Unknown|class does not exist)[:\s]+['"]?([a-z0-9-]+)['"]?/i,
    causeTemplate: "Tailwind utility class '{{class}}' is not recognized",
    evidenceTypes: ['code', 'error', 'pattern'],
    baseConfidence: 0.9,
    fixTemplates: [
      {
        description: 'Check Tailwind documentation for correct class name',
        type: 'template',
        confidenceModifier: 0.1,
        validationSteps: [{ type: 'build', command: 'npx tailwindcss build', expectedOutcome: 'Build successful' }],
      },
      {
        description: 'Add class to safelist in tailwind.config.js',
        type: 'template',
        confidenceModifier: 0.05,
        validationSteps: [{ type: 'build', command: 'npx tailwindcss build', expectedOutcome: 'Build successful' }],
      },
    ],
    contextHints: ['Check if using JIT mode', 'Verify content paths'],
  },
];

// =============================================================================
// LLM Prompt Templates
// =============================================================================

const LLM_PROMPT_TEMPLATES: LLMPromptTemplate[] = [
  {
    id: 'hypothesis-generation',
    name: 'Root Cause Hypothesis Generation',
    systemPrompt: `You are an expert debugging assistant. Analyze the provided error information and code context to generate plausible root cause hypotheses.

For each hypothesis:
1. Provide a clear description of the potential root cause
2. List supporting evidence from the error and code context
3. Estimate confidence (0.0-1.0) based on evidence strength
4. Suggest specific fixes with code changes if possible

Focus on the most likely causes first. Be specific and actionable.`,
    userPromptTemplate: `Analyze this error and generate root cause hypotheses:

**Error Information:**
- Type: {{errorType}}
- Message: {{errorMessage}}
- File: {{file}}
- Line: {{line}}
- Language: {{language}}

**Code Context:**
\`\`\`{{language}}
{{codeContext}}
\`\`\`

**Enclosing Function:** {{enclosingFunction}}
**Available Symbols:** {{symbols}}
**Imports:** {{imports}}

Generate 1-3 most likely root cause hypotheses in JSON format:
{
  "hypotheses": [
    {
      "description": "...",
      "confidence": 0.0-1.0,
      "evidence": ["..."],
      "suggestedFix": "..."
    }
  ]
}`,
    outputFormat: 'json',
    outputSchema: {
      type: 'object',
      properties: {
        hypotheses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              confidence: { type: 'number' },
              evidence: { type: 'array', items: { type: 'string' } },
              suggestedFix: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    id: 'evidence-analysis',
    name: 'Evidence Analysis',
    systemPrompt: `You are an expert code analyst. Examine the provided code context to find evidence supporting or refuting the given hypothesis about an error's root cause.

Look for:
1. Code patterns that could cause the error
2. Missing null checks, type mismatches, undefined variables
3. Incorrect API usage or deprecated patterns
4. Race conditions or async issues
5. Configuration problems`,
    userPromptTemplate: `Analyze evidence for this hypothesis:

**Hypothesis:** {{hypothesis}}

**Error:** {{errorType}}: {{errorMessage}}

**Code Context:**
\`\`\`{{language}}
{{codeContext}}
\`\`\`

Find evidence that supports or contradicts this hypothesis. Rate each piece of evidence by strength (0.0-1.0).`,
    outputFormat: 'json',
  },
  {
    id: 'fix-generation',
    name: 'Fix Generation',
    systemPrompt: `You are an expert software engineer. Generate specific, actionable code fixes for the identified root cause.

Requirements:
1. Provide exact code changes (what to replace, where)
2. Explain why the fix addresses the root cause
3. Note any potential side effects
4. Include validation steps to verify the fix`,
    userPromptTemplate: `Generate a fix for this root cause:

**Root Cause:** {{rootCause}}

**Error:** {{errorType}}: {{errorMessage}}
**File:** {{file}}
**Line:** {{line}}

**Current Code:**
\`\`\`{{language}}
{{codeContext}}
\`\`\`

Provide the fix as a code diff or replacement.`,
    outputFormat: 'structured',
  },
];

// =============================================================================
// RCA Engine Implementation
// =============================================================================

/**
 * Root Cause Analysis Engine
 *
 * Generates plausible root cause hypotheses from error context using:
 * - Pattern matching against known error patterns
 * - Evidence gathering from code context
 * - LLM prompt templates for complex analysis
 * - Confidence scoring based on evidence strength
 */
export class RCAEngine {
  /** Error patterns database */
  private readonly patterns: ErrorPattern[];

  /** LLM prompt templates */
  private readonly promptTemplates: Map<string, LLMPromptTemplate>;

  /** Engine configuration */
  private readonly config: Required<RCAEngineConfig>;

  constructor(config: RCAEngineConfig = {}) {
    this.config = {
      maxHypotheses: config.maxHypotheses ?? 5,
      minConfidence: config.minConfidence ?? 0.3,
      enableLLMPrompts: config.enableLLMPrompts ?? true,
      customPatterns: config.customPatterns ?? [],
    };

    // Combine built-in and custom patterns
    this.patterns = [...BUILTIN_ERROR_PATTERNS, ...this.config.customPatterns];

    // Index prompt templates
    this.promptTemplates = new Map();
    for (const template of LLM_PROMPT_TEMPLATES) {
      this.promptTemplates.set(template.id, template);
    }
  }

  // ===========================================================================
  // Hypothesis Generation
  // ===========================================================================

  /**
   * Generate root cause hypotheses for errors.
   *
   * @param errors - Normalized errors to analyze
   * @param context - Analysis context with code and file information
   * @param codeContext - Optional code context from ContextEngine
   * @returns Generation result with hypotheses and optional LLM prompts
   */
  async generateHypotheses(
    errors: NormalizedError[],
    context: AnalysisContext,
    codeContext?: CodeContext
  ): Promise<HypothesisGenerationResult> {
    const startTime = Date.now();
    const result: HypothesisGenerationResult = {
      hypotheses: [],
      llmPrompts: [],
      notes: [],
      generationTimeMs: 0,
    };

    for (const error of errors) {
      // Pattern-based hypothesis generation
      const patternHypotheses = this.generateFromPatterns(error, context, codeContext);
      result.hypotheses.push(...patternHypotheses);

      // Generate LLM prompts for complex analysis
      if (this.config.enableLLMPrompts) {
        const prompts = this.generateLLMPrompts(error, context, codeContext);
        result.llmPrompts.push(...prompts);
      }
    }

    // Score and rank hypotheses
    result.hypotheses = this.rankHypotheses(result.hypotheses);

    // Limit to max hypotheses
    if (result.hypotheses.length > this.config.maxHypotheses) {
      result.hypotheses = result.hypotheses.slice(0, this.config.maxHypotheses);
    }

    // Filter by minimum confidence
    result.hypotheses = result.hypotheses.filter(
      (h) => h.confidence >= this.config.minConfidence
    );

    result.generationTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Generate hypotheses from pattern matching.
   */
  private generateFromPatterns(
    error: NormalizedError,
    context: AnalysisContext,
    codeContext?: CodeContext
  ): RootCauseHypothesis[] {
    const hypotheses: RootCauseHypothesis[] = [];

    for (const pattern of this.patterns) {
      // Check language match
      if (!pattern.languages.includes(error.language)) {
        continue;
      }

      // Check error type match
      if (!pattern.errorTypePattern.test(error.type)) {
        continue;
      }

      // Check message match and extract captures
      const messageMatch = pattern.messagePattern.exec(error.message);
      if (messageMatch === null) {
        continue;
      }

      // Build hypothesis from pattern
      const hypothesis = this.buildHypothesisFromPattern(
        pattern,
        error,
        messageMatch,
        context,
        codeContext
      );

      hypotheses.push(hypothesis);
    }

    return hypotheses;
  }

  /**
   * Build a hypothesis from a matched pattern.
   */
  private buildHypothesisFromPattern(
    pattern: ErrorPattern,
    error: NormalizedError,
    messageMatch: RegExpExecArray,
    context: AnalysisContext,
    codeContext?: CodeContext
  ): RootCauseHypothesis {
    // Extract captured groups for template substitution
    const captures = this.extractCaptures(pattern, messageMatch);

    // Build description from template
    const description = this.substituteTemplate(pattern.causeTemplate, captures);

    // Gather evidence
    const evidence = this.gatherEvidence(error, pattern, context, codeContext);

    // Calculate confidence
    const confidence = this.calculateConfidence(pattern.baseConfidence, evidence);

    // Generate fix suggestions
    const suggestedFixes = this.generateFixSuggestions(pattern, captures, error);

    // Collect related locations
    const relatedLocations: SourceLocation[] = [];
    if (error.location !== undefined) {
      relatedLocations.push(error.location);
    }
    if (codeContext?.enclosingFunction?.location !== undefined) {
      relatedLocations.push(codeContext.enclosingFunction.location);
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

  /**
   * Extract named captures from message match.
   */
  private extractCaptures(
    pattern: ErrorPattern,
    match: RegExpExecArray
  ): Record<string, string> {
    const captures: Record<string, string> = {
      message: match[0],
    };

    // Map captures based on pattern
    if (pattern.id === 'py-name-error' || pattern.id === 'js-reference-error') {
      captures['name'] = match[1] ?? 'unknown';
    } else if (pattern.id === 'py-attribute-error') {
      captures['type'] = match[1] ?? 'unknown';
      captures['attribute'] = match[2] ?? 'unknown';
    } else if (pattern.id === 'py-import-error') {
      captures['module'] = match[1] ?? 'unknown';
    } else if (pattern.id === 'ts-type-mismatch') {
      captures['sourceType'] = match[1] ?? 'unknown';
      captures['targetType'] = match[2] ?? 'unknown';
    } else if (pattern.id === 'ts-property-missing') {
      captures['property'] = match[1] ?? 'unknown';
    } else if (pattern.id === 'css-unknown-property') {
      captures['property'] = match[1] ?? 'unknown';
    } else if (pattern.id === 'tailwind-unknown-class') {
      captures['class'] = match[1] ?? 'unknown';
    }

    // Include all numbered captures
    for (let i = 1; i < match.length; i++) {
      const captured = match[i];
      if (captured !== undefined) {
        captures[`$${i}`] = captured;
      }
    }

    return captures;
  }

  /**
   * Substitute template placeholders with values.
   */
  private substituteTemplate(
    template: string,
    values: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  // ===========================================================================
  // Evidence Gathering
  // ===========================================================================

  /**
   * Gather evidence supporting a hypothesis.
   */
  private gatherEvidence(
    error: NormalizedError,
    pattern: ErrorPattern,
    context: AnalysisContext,
    codeContext?: CodeContext
  ): Evidence[] {
    const evidence: Evidence[] = [];

    // Error evidence
    const errorEvidence: Evidence = {
      type: 'error',
      description: `${error.type}: ${error.message}`,
      strength: 0.9,
    };
    if (error.location !== undefined) {
      errorEvidence.location = error.location;
    }
    evidence.push(errorEvidence);

    // Pattern match evidence
    evidence.push({
      type: 'pattern',
      description: `Matched known error pattern: ${pattern.name}`,
      strength: pattern.baseConfidence,
    });

    // Code context evidence
    if (codeContext !== undefined) {
      // Check for enclosing function
      if (codeContext.enclosingFunction !== undefined) {
        evidence.push({
          type: 'code',
          description: `Error occurs in function: ${codeContext.enclosingFunction.name}`,
          location: codeContext.enclosingFunction.location,
          strength: 0.6,
        });
      }

      // Check imports for potential issues
      if (codeContext.imports.length > 0) {
        evidence.push({
          type: 'code',
          description: `File has ${codeContext.imports.length} import(s)`,
          strength: 0.3,
        });
      }

      // Check local symbols
      if (codeContext.localSymbols.length > 0) {
        evidence.push({
          type: 'code',
          description: `${codeContext.localSymbols.length} symbols in scope`,
          strength: 0.4,
        });
      }
    }

    // Stack trace evidence
    if (error.stackTrace !== undefined && error.stackTrace.length > 0) {
      evidence.push({
        type: 'code',
        description: `Stack trace with ${error.stackTrace.length} frames`,
        strength: 0.7,
      });
    }

    // File content evidence
    const fileContent = context.fileContents.get(error.location?.file ?? '');
    if (fileContent !== undefined) {
      evidence.push({
        type: 'code',
        description: 'Source file content available for analysis',
        strength: 0.5,
      });
    }

    return evidence;
  }

  /**
   * Calculate confidence score based on evidence.
   */
  private calculateConfidence(baseConfidence: number, evidence: Evidence[]): number {
    let confidence = baseConfidence;

    // Adjust based on evidence strength
    const totalStrength = evidence.reduce((sum, e) => sum + e.strength, 0);
    const avgStrength = evidence.length > 0 ? totalStrength / evidence.length : 0;

    // Boost confidence if average evidence strength is high
    if (avgStrength > 0.7) {
      confidence = Math.min(1.0, confidence + 0.1);
    } else if (avgStrength < 0.4) {
      confidence = Math.max(0.1, confidence - 0.1);
    }

    // Boost if multiple evidence types
    const evidenceTypes = new Set(evidence.map((e) => e.type));
    if (evidenceTypes.size >= 3) {
      confidence = Math.min(1.0, confidence + 0.05);
    }

    return Math.round(confidence * 100) / 100;
  }

  // ===========================================================================
  // Fix Suggestion Generation
  // ===========================================================================

  /**
   * Generate fix suggestions from pattern templates.
   */
  private generateFixSuggestions(
    pattern: ErrorPattern,
    captures: Record<string, string>,
    _error: NormalizedError
  ): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    for (const template of pattern.fixTemplates) {
      const description = this.substituteTemplate(template.description, captures);
      const confidence = Math.min(1.0, pattern.baseConfidence + template.confidenceModifier);

      // Substitute placeholders in validation commands
      const validationSteps: ValidationStep[] = template.validationSteps.map((step) => {
        const newStep: ValidationStep = {
          type: step.type,
          expectedOutcome: step.expectedOutcome,
        };
        if (step.command !== undefined) {
          newStep.command = this.substituteTemplate(step.command, captures);
        }
        if (step.description !== undefined) {
          newStep.description = step.description;
        }
        return newStep;
      });

      fixes.push({
        id: randomUUID(),
        description,
        confidence,
        type: template.type,
        changes: [], // Actual code changes would be generated by LLM
        validationSteps,
      });
    }

    return fixes;
  }

  // ===========================================================================
  // LLM Prompt Generation
  // ===========================================================================

  /**
   * Generate LLM prompts for complex analysis.
   */
  private generateLLMPrompts(
    error: NormalizedError,
    context: AnalysisContext,
    codeContext?: CodeContext
  ): GeneratedPrompt[] {
    const prompts: GeneratedPrompt[] = [];

    // Get hypothesis generation template
    const hypothesisTemplate = this.promptTemplates.get('hypothesis-generation');
    if (hypothesisTemplate !== undefined) {
      const prompt = this.buildPromptFromTemplate(
        hypothesisTemplate,
        error,
        context,
        codeContext
      );
      prompts.push(prompt);
    }

    return prompts;
  }

  /**
   * Build a prompt from a template.
   */
  private buildPromptFromTemplate(
    template: LLMPromptTemplate,
    error: NormalizedError,
    _context: AnalysisContext,
    codeContext?: CodeContext
  ): GeneratedPrompt {
    // Build context for substitution
    const values: Record<string, string> = {
      errorType: error.type,
      errorMessage: error.message,
      file: error.location?.file ?? 'unknown',
      line: String(error.location?.line ?? 0),
      language: error.language,
      codeContext: this.formatCodeContext(codeContext),
      enclosingFunction: codeContext?.enclosingFunction?.name ?? 'N/A',
      symbols: this.formatSymbols(codeContext?.localSymbols ?? []),
      imports: this.formatImports(codeContext?.imports ?? []),
    };

    const userPrompt = this.substituteTemplate(template.userPromptTemplate, values);

    // Build context object conditionally
    const promptContext: GeneratedPrompt['context'] = {
      errors: [error],
    };
    if (codeContext !== undefined) {
      promptContext.codeContext = codeContext;
      if (codeContext.localSymbols.length > 0) {
        promptContext.symbols = codeContext.localSymbols;
      }
    }

    return {
      id: randomUUID(),
      templateId: template.id,
      system: template.systemPrompt,
      user: userPrompt,
      context: promptContext,
      responseHandler: 'parse_hypothesis',
    };
  }

  /**
   * Format code context for prompt.
   */
  private formatCodeContext(codeContext?: CodeContext): string {
    if (codeContext === undefined || codeContext.lines.length === 0) {
      return 'No code context available';
    }

    return codeContext.lines
      .map((l) => `${l.lineNumber}: ${l.content}`)
      .join('\n');
  }

  /**
   * Format symbols for prompt.
   */
  private formatSymbols(symbols: SymbolInfo[]): string {
    if (symbols.length === 0) {
      return 'None';
    }

    return symbols
      .slice(0, 10)
      .map((s) => `${s.kind}: ${s.name}`)
      .join(', ');
  }

  /**
   * Format imports for prompt.
   */
  private formatImports(imports: { source: string }[]): string {
    if (imports.length === 0) {
      return 'None';
    }

    return imports
      .slice(0, 10)
      .map((i) => i.source)
      .join(', ');
  }

  // ===========================================================================
  // Hypothesis Ranking
  // ===========================================================================

  /**
   * Rank hypotheses by confidence and evidence quality.
   */
  private rankHypotheses(hypotheses: RootCauseHypothesis[]): RootCauseHypothesis[] {
    return hypotheses.sort((a, b) => {
      // Primary: confidence score
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }

      // Secondary: evidence count
      if (a.evidence.length !== b.evidence.length) {
        return b.evidence.length - a.evidence.length;
      }

      // Tertiary: fix suggestion count
      return b.suggestedFixes.length - a.suggestedFixes.length;
    });
  }

  // ===========================================================================
  // Pattern Management
  // ===========================================================================

  /**
   * Add a custom error pattern.
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get all patterns for a language.
   */
  getPatternsForLanguage(language: Language): ErrorPattern[] {
    return this.patterns.filter((p) => p.languages.includes(language));
  }

  /**
   * Get a prompt template by ID.
   */
  getPromptTemplate(id: string): LLMPromptTemplate | undefined {
    return this.promptTemplates.get(id);
  }

  /**
   * Add a custom prompt template.
   */
  addPromptTemplate(template: LLMPromptTemplate): void {
    this.promptTemplates.set(template.id, template);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new RCA Engine instance.
 *
 * @param config - Engine configuration
 * @returns RCAEngine instance
 */
export function createRCAEngine(config?: RCAEngineConfig): RCAEngine {
  return new RCAEngine(config);
}
