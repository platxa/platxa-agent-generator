/**
 * LLM-Guided Patch Synthesizer
 *
 * Generates fix patches for novel bugs using LLM prompts when
 * template-based fixes don't apply. Includes prompt generation,
 * response parsing, and syntax validation.
 *
 * @module llm-patch-synthesizer
 */

import { randomUUID } from 'crypto';
import type {
  CodeChange,
  Evidence,
  FixSuggestion,
  Language,
  NormalizedError,
  RootCauseHypothesis,
  ValidationStep,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Prompt template for LLM patch synthesis
 */
export interface PatchPromptTemplate {
  /** Template identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Languages this template applies to */
  languages: Language[];
  /** System prompt for the LLM */
  systemPrompt: string;
  /** User prompt template (supports {{variable}} placeholders) */
  userPromptTemplate: string;
  /** Expected response format */
  responseFormat: ResponseFormat;
  /** Temperature for generation */
  temperature: number;
  /** Maximum tokens for response */
  maxTokens: number;
}

/**
 * Expected response format from LLM
 */
export interface ResponseFormat {
  /** Format type */
  type: 'json' | 'markdown' | 'diff' | 'code_block';
  /** Schema for JSON format */
  schema?: Record<string, unknown>;
  /** Markers for extracting content */
  markers?: ResponseMarkers;
}

/**
 * Markers for extracting content from LLM response
 */
export interface ResponseMarkers {
  /** Start marker for code block */
  codeStart: string;
  /** End marker for code block */
  codeEnd: string;
  /** Start marker for explanation */
  explanationStart?: string;
  /** End marker for explanation */
  explanationEnd?: string;
}

/**
 * Generated prompt ready for LLM
 */
export interface GeneratedPrompt {
  /** Unique prompt ID */
  id: string;
  /** System message */
  system: string;
  /** User message */
  user: string;
  /** Template used */
  templateId: string;
  /** Expected response format */
  responseFormat: ResponseFormat;
  /** Generation parameters */
  parameters: GenerationParameters;
}

/**
 * Parameters for LLM generation
 */
export interface GenerationParameters {
  /** Temperature (0-1) */
  temperature: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Top-p sampling */
  topP?: number;
}

/**
 * Parsed patch from LLM response
 */
export interface ParsedPatch {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed code changes */
  changes: CodeChange[];
  /** Explanation from LLM */
  explanation?: string;
  /** Confidence in the patch */
  confidence: number;
  /** Raw response for debugging */
  rawResponse: string;
  /** Parse errors if any */
  parseErrors?: string[];
}

/**
 * Syntax validation result
 */
export interface SyntaxValidationResult {
  /** Whether syntax is valid */
  isValid: boolean;
  /** Validation errors */
  errors: SyntaxError[];
  /** Warnings (non-blocking) */
  warnings: string[];
  /** Language-specific details */
  details?: Record<string, unknown>;
}

/**
 * Syntax error details
 */
export interface SyntaxError {
  /** Error message */
  message: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Error code */
  code?: string;
}

/**
 * Synthesis attempt result
 */
export interface SynthesisAttempt {
  /** Attempt number */
  attempt: number;
  /** Generated prompt */
  prompt: GeneratedPrompt;
  /** Raw LLM response */
  response?: string;
  /** Parsed patch */
  parsedPatch?: ParsedPatch;
  /** Syntax validation result */
  syntaxValidation?: SyntaxValidationResult;
  /** Whether this attempt succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Complete synthesis result
 */
export interface SynthesisResult {
  /** Whether synthesis succeeded */
  success: boolean;
  /** Generated fix suggestion */
  fix?: FixSuggestion;
  /** All attempts made */
  attempts: SynthesisAttempt[];
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Final error if all attempts failed */
  error?: string;
}

/**
 * Context for patch synthesis
 */
export interface SynthesisContext {
  /** The error being fixed */
  error: NormalizedError;
  /** Root cause hypothesis */
  hypothesis?: RootCauseHypothesis;
  /** Evidence collected */
  evidence?: Evidence[];
  /** Relevant code snippets */
  codeSnippets: CodeSnippet[];
  /** Related file contents */
  relatedFiles?: FileContent[];
  /** Previous fix attempts that failed */
  previousAttempts?: string[];
}

/**
 * Code snippet with context
 */
export interface CodeSnippet {
  /** File path */
  file: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Code content */
  content: string;
  /** Whether this is the error location */
  isErrorLocation: boolean;
}

/**
 * File content for context
 */
export interface FileContent {
  /** File path */
  path: string;
  /** Full content */
  content: string;
  /** Relevance score (0-1) */
  relevance: number;
}

/**
 * Configuration for LLM patch synthesizer
 */
export interface LLMPatchSynthesizerConfig {
  /** Maximum synthesis attempts */
  maxAttempts: number;
  /** Whether to validate syntax */
  validateSyntax: boolean;
  /** Default temperature */
  defaultTemperature: number;
  /** Default max tokens */
  defaultMaxTokens: number;
  /** Minimum confidence threshold */
  minConfidenceThreshold: number;
  /** Whether to include previous attempts in refinement prompts */
  includeFailedAttempts: boolean;
  /** Custom prompt templates */
  customTemplates?: PatchPromptTemplate[];
}

// =============================================================================
// Default Prompt Templates
// =============================================================================

const DEFAULT_PROMPT_TEMPLATES: PatchPromptTemplate[] = [
  {
    id: 'general-fix',
    name: 'General Bug Fix',
    languages: ['python', 'javascript', 'typescript'],
    systemPrompt: `You are an expert software engineer specializing in debugging and fixing code. Your task is to analyze the error and provide a precise fix.

Guidelines:
1. Analyze the error message and stack trace carefully
2. Identify the root cause of the issue
3. Provide a minimal, focused fix that addresses the root cause
4. Do not make unnecessary changes to surrounding code
5. Ensure the fix follows the language's best practices
6. Include a brief explanation of the fix

Response Format:
Provide your response in the following format:

<explanation>
Brief explanation of the issue and the fix
</explanation>

<fix>
\`\`\`{{language}}
// Your fixed code here
\`\`\`
</fix>

<confidence>
A number between 0 and 1 indicating your confidence in the fix
</confidence>`,
    userPromptTemplate: `Fix the following {{language}} error:

**Error Type:** {{errorType}}
**Error Message:** {{errorMessage}}

**File:** {{file}}
**Line:** {{line}}

**Code Context:**
\`\`\`{{language}}
{{codeContext}}
\`\`\`

{{#if hypothesis}}
**Suspected Cause:** {{hypothesis}}
{{/if}}

{{#if evidence}}
**Evidence:**
{{evidence}}
{{/if}}

{{#if previousAttempts}}
**Previous failed attempts:**
{{previousAttempts}}

Please provide a different approach.
{{/if}}

Provide a fix for this error.`,
    responseFormat: {
      type: 'markdown',
      markers: {
        codeStart: '```',
        codeEnd: '```',
        explanationStart: '<explanation>',
        explanationEnd: '</explanation>',
      },
    },
    temperature: 0.3,
    maxTokens: 2000,
  },
  {
    id: 'python-fix',
    name: 'Python Bug Fix',
    languages: ['python'],
    systemPrompt: `You are a Python expert specializing in debugging. Fix the error following Python best practices.

Guidelines:
1. Follow PEP 8 style guidelines
2. Use type hints where appropriate
3. Handle exceptions properly
4. Avoid common Python pitfalls
5. Provide idiomatic Python solutions

Response format:
<explanation>Brief explanation</explanation>
<fix>\`\`\`python
# Fixed code
\`\`\`</fix>
<confidence>0.0-1.0</confidence>`,
    userPromptTemplate: `Fix this Python error:

**Error:** {{errorType}}: {{errorMessage}}
**Location:** {{file}}:{{line}}

\`\`\`python
{{codeContext}}
\`\`\`

{{#if stackTrace}}
**Stack Trace:**
{{stackTrace}}
{{/if}}

{{#if hypothesis}}
**Analysis:** {{hypothesis}}
{{/if}}`,
    responseFormat: {
      type: 'markdown',
      markers: {
        codeStart: '```python',
        codeEnd: '```',
        explanationStart: '<explanation>',
        explanationEnd: '</explanation>',
      },
    },
    temperature: 0.2,
    maxTokens: 1500,
  },
  {
    id: 'typescript-fix',
    name: 'TypeScript Bug Fix',
    languages: ['typescript'],
    systemPrompt: `You are a TypeScript expert specializing in debugging type errors and runtime issues.

Guidelines:
1. Ensure type safety
2. Use strict TypeScript patterns
3. Avoid 'any' type where possible
4. Handle null/undefined properly
5. Follow modern TypeScript best practices

Response format:
<explanation>Brief explanation</explanation>
<fix>\`\`\`typescript
// Fixed code
\`\`\`</fix>
<confidence>0.0-1.0</confidence>`,
    userPromptTemplate: `Fix this TypeScript error:

**Error:** {{errorType}}: {{errorMessage}}
**Location:** {{file}}:{{line}}

\`\`\`typescript
{{codeContext}}
\`\`\`

{{#if typeContext}}
**Type Information:**
{{typeContext}}
{{/if}}

{{#if hypothesis}}
**Analysis:** {{hypothesis}}
{{/if}}`,
    responseFormat: {
      type: 'markdown',
      markers: {
        codeStart: '```typescript',
        codeEnd: '```',
        explanationStart: '<explanation>',
        explanationEnd: '</explanation>',
      },
    },
    temperature: 0.2,
    maxTokens: 1500,
  },
  {
    id: 'css-fix',
    name: 'CSS Bug Fix',
    languages: ['css', 'scss'],
    systemPrompt: `You are a CSS expert specializing in layout, styling, and cross-browser compatibility issues.

Guidelines:
1. Follow CSS best practices
2. Consider browser compatibility
3. Use modern CSS features appropriately
4. Avoid specificity issues
5. Keep selectors efficient

Response format:
<explanation>Brief explanation</explanation>
<fix>\`\`\`css
/* Fixed styles */
\`\`\`</fix>
<confidence>0.0-1.0</confidence>`,
    userPromptTemplate: `Fix this CSS issue:

**Problem:** {{errorMessage}}
**File:** {{file}}

\`\`\`css
{{codeContext}}
\`\`\`

{{#if relatedHTML}}
**Related HTML:**
\`\`\`html
{{relatedHTML}}
\`\`\`
{{/if}}`,
    responseFormat: {
      type: 'markdown',
      markers: {
        codeStart: '```css',
        codeEnd: '```',
        explanationStart: '<explanation>',
        explanationEnd: '</explanation>',
      },
    },
    temperature: 0.3,
    maxTokens: 1000,
  },
  {
    id: 'json-structured',
    name: 'JSON Structured Fix',
    languages: ['python', 'javascript', 'typescript'],
    systemPrompt: `You are an expert debugger. Provide fixes in a structured JSON format.

You must respond with valid JSON matching this schema:
{
  "explanation": "string - brief explanation of the fix",
  "changes": [
    {
      "file": "string - file path",
      "line": "number - line number",
      "original": "string - original code",
      "replacement": "string - fixed code"
    }
  ],
  "confidence": "number - confidence 0 to 1",
  "warnings": ["string - any warnings or caveats"]
}`,
    userPromptTemplate: `{
  "error": {
    "type": "{{errorType}}",
    "message": "{{errorMessage}}",
    "file": "{{file}}",
    "line": {{line}}
  },
  "code": "{{codeContextEscaped}}",
  "hypothesis": "{{hypothesis}}",
  "context": "{{additionalContext}}"
}`,
    responseFormat: {
      type: 'json',
      schema: {
        type: 'object',
        required: ['explanation', 'changes', 'confidence'],
        properties: {
          explanation: { type: 'string' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'line', 'original', 'replacement'],
            },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    temperature: 0.1,
    maxTokens: 2000,
  },
];

// =============================================================================
// LLM Patch Synthesizer Implementation
// =============================================================================

/**
 * LLM-guided patch synthesizer for novel bugs.
 *
 * Generates fix patches using LLM prompts when template-based fixes
 * don't apply. Includes multi-attempt synthesis with refinement.
 */
export class LLMPatchSynthesizer {
  private readonly config: Required<LLMPatchSynthesizerConfig>;
  private readonly templates: Map<string, PatchPromptTemplate>;
  private readonly languageTemplates: Map<Language, PatchPromptTemplate[]>;

  constructor(config: Partial<LLMPatchSynthesizerConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 3,
      validateSyntax: config.validateSyntax ?? true,
      defaultTemperature: config.defaultTemperature ?? 0.3,
      defaultMaxTokens: config.defaultMaxTokens ?? 2000,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.5,
      includeFailedAttempts: config.includeFailedAttempts ?? true,
      customTemplates: config.customTemplates ?? [],
    };

    this.templates = new Map();
    this.languageTemplates = new Map();

    // Register default templates
    for (const template of DEFAULT_PROMPT_TEMPLATES) {
      this.registerTemplate(template);
    }

    // Register custom templates
    for (const template of this.config.customTemplates) {
      this.registerTemplate(template);
    }
  }

  /**
   * Register a prompt template.
   */
  registerTemplate(template: PatchPromptTemplate): void {
    this.templates.set(template.id, template);

    for (const language of template.languages) {
      const existing = this.languageTemplates.get(language) ?? [];
      existing.push(template);
      this.languageTemplates.set(language, existing);
    }
  }

  /**
   * Generate a prompt for LLM patch synthesis.
   */
  generatePrompt(
    context: SynthesisContext,
    templateId?: string
  ): GeneratedPrompt {
    const template = this.selectTemplate(context, templateId);
    const variables = this.extractVariables(context);
    const userPrompt = this.substituteVariables(
      template.userPromptTemplate,
      variables
    );

    return {
      id: randomUUID(),
      system: template.systemPrompt,
      user: userPrompt,
      templateId: template.id,
      responseFormat: template.responseFormat,
      parameters: {
        temperature: template.temperature,
        maxTokens: template.maxTokens,
      },
    };
  }

  /**
   * Parse an LLM response into a structured patch.
   */
  parseResponse(
    response: string,
    format: ResponseFormat,
    context: SynthesisContext
  ): ParsedPatch {
    try {
      switch (format.type) {
        case 'json':
          return this.parseJsonResponse(response, context);
        case 'markdown':
          return this.parseMarkdownResponse(response, format.markers, context);
        case 'diff':
          return this.parseDiffResponse(response, context);
        case 'code_block':
          return this.parseCodeBlockResponse(response, context);
        default:
          return {
            success: false,
            changes: [],
            confidence: 0,
            rawResponse: response,
            parseErrors: [`Unknown response format: ${format.type}`],
          };
      }
    } catch (error) {
      return {
        success: false,
        changes: [],
        confidence: 0,
        rawResponse: response,
        parseErrors: [
          error instanceof Error ? error.message : 'Parse error',
        ],
      };
    }
  }

  /**
   * Validate patch syntax for the target language.
   */
  validateSyntax(
    patch: ParsedPatch,
    language: Language
  ): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: string[] = [];

    for (const change of patch.changes) {
      if (change.newContent !== undefined) {
        const validation = this.validateCodeSyntax(
          change.newContent,
          language
        );

        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
        warnings.push(...validation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create a fix suggestion from a parsed patch.
   */
  createFixSuggestion(
    patch: ParsedPatch,
    context: SynthesisContext
  ): FixSuggestion {
    return {
      id: randomUUID(),
      description: patch.explanation ?? 'LLM-generated fix',
      confidence: patch.confidence,
      type: 'generated',
      changes: patch.changes,
      validationSteps: this.generateValidationSteps(context.error.language),
    };
  }

  /**
   * Generate a refinement prompt based on failed attempt.
   */
  generateRefinementPrompt(
    context: SynthesisContext,
    previousAttempt: SynthesisAttempt,
    validationResult?: SyntaxValidationResult
  ): GeneratedPrompt {
    // Build feedback for the LLM
    const feedbackParts: string[] = [];

    if (previousAttempt.parsedPatch?.parseErrors) {
      feedbackParts.push(
        `Parse errors: ${previousAttempt.parsedPatch.parseErrors.join(', ')}`
      );
    }

    if (validationResult && !validationResult.isValid) {
      feedbackParts.push(
        `Syntax errors: ${validationResult.errors.map(e => e.message).join(', ')}`
      );
    }

    if (previousAttempt.error) {
      feedbackParts.push(`Error: ${previousAttempt.error}`);
    }

    // Create updated context with previous attempt info
    const updatedContext: SynthesisContext = {
      ...context,
      previousAttempts: [
        ...(context.previousAttempts ?? []),
        feedbackParts.join('\n'),
      ],
    };

    return this.generatePrompt(updatedContext);
  }

  /**
   * Get all registered templates.
   */
  getTemplates(): PatchPromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates for a specific language.
   */
  getTemplatesForLanguage(language: Language): PatchPromptTemplate[] {
    return this.languageTemplates.get(language) ?? [];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Select the best template for the context.
   */
  private selectTemplate(
    context: SynthesisContext,
    templateId?: string
  ): PatchPromptTemplate {
    // Use specified template if provided
    if (templateId !== undefined) {
      const template = this.templates.get(templateId);
      if (template !== undefined) {
        return template;
      }
    }

    // Find language-specific template
    const language = context.error.language;
    const languageTemplates = this.languageTemplates.get(language);

    if (languageTemplates !== undefined && languageTemplates.length > 0) {
      // Prefer more specific templates
      const specific = languageTemplates.find(t => t.languages.length === 1);
      if (specific !== undefined) {
        return specific;
      }
      // Safe: we checked length > 0
      const firstTemplate = languageTemplates[0];
      if (firstTemplate !== undefined) {
        return firstTemplate;
      }
    }

    // Fall back to general template
    const general = this.templates.get('general-fix');
    if (general !== undefined) {
      return general;
    }

    // Should never happen, but provide fallback
    const defaultTemplate = DEFAULT_PROMPT_TEMPLATES[0];
    if (defaultTemplate !== undefined) {
      return defaultTemplate;
    }

    // Ultimate fallback - create minimal template
    throw new Error('No prompt templates available');
  }

  /**
   * Extract variables from synthesis context.
   */
  private extractVariables(
    context: SynthesisContext
  ): Record<string, string> {
    const variables: Record<string, string> = {
      language: context.error.language,
      errorType: context.error.type,
      errorMessage: context.error.message,
      file: context.error.location?.file ?? 'unknown',
      line: String(context.error.location?.line ?? 0),
      column: String(context.error.location?.column ?? 0),
    };

    // Add code context
    const errorSnippet = context.codeSnippets.find(s => s.isErrorLocation);
    if (errorSnippet !== undefined) {
      variables.codeContext = errorSnippet.content;
      variables.codeContextEscaped = this.escapeForJson(errorSnippet.content);
    } else if (context.codeSnippets.length > 0) {
      const firstSnippet = context.codeSnippets[0];
      if (firstSnippet !== undefined) {
        variables.codeContext = firstSnippet.content;
        variables.codeContextEscaped = this.escapeForJson(firstSnippet.content);
      }
    }

    // Add hypothesis
    if (context.hypothesis !== undefined) {
      variables.hypothesis = context.hypothesis.description;
    }

    // Add evidence summary
    if (context.evidence !== undefined && context.evidence.length > 0) {
      variables.evidence = context.evidence
        .map(e => `- ${e.type}: ${e.description}`)
        .join('\n');
    }

    // Add previous attempts
    if (
      context.previousAttempts !== undefined &&
      context.previousAttempts.length > 0
    ) {
      variables.previousAttempts = context.previousAttempts
        .map((a, i) => `Attempt ${i + 1}: ${a}`)
        .join('\n\n');
    }

    // Add stack trace
    if (context.error.stackTrace !== undefined) {
      variables.stackTrace = context.error.stackTrace
        .map(
          frame =>
            `  at ${frame.functionName ?? '<anonymous>'} (${frame.location.file}:${frame.location.line})`
        )
        .join('\n');
    }

    // Add additional context
    variables.additionalContext = this.buildAdditionalContext(context);

    return variables;
  }

  /**
   * Substitute variables in template string.
   */
  private substituteVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;

    // Handle conditional blocks: {{#if variable}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName: string, content: string) => {
        const value = variables[varName];
        if (value !== undefined && value !== '' && value !== 'undefined') {
          return content;
        }
        return '';
      }
    );

    // Handle simple variables: {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
      return variables[varName] ?? '';
    });

    return result;
  }

  /**
   * Parse JSON response from LLM.
   */
  private parseJsonResponse(
    response: string,
    context: SynthesisContext
  ): ParsedPatch {
    // Extract JSON from response (might be wrapped in markdown)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch !== null && jsonMatch[1] !== undefined) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr) as {
      explanation?: string;
      changes?: Array<{
        file?: string;
        line?: number;
        original?: string;
        replacement?: string;
      }>;
      confidence?: number;
    };

    const changes: CodeChange[] = (parsed.changes ?? []).map(change => {
      const lineNum = change.line ?? context.error.location?.line ?? 1;
      const codeChange: CodeChange = {
        file: change.file ?? context.error.location?.file ?? 'unknown',
        type: 'replace',
        start: { line: lineNum, column: 1 },
        end: { line: lineNum, column: 1 },
      };

      if (change.original !== undefined) {
        codeChange.originalContent = change.original;
      }
      if (change.replacement !== undefined) {
        codeChange.newContent = change.replacement;
      }

      return codeChange;
    });

    const result: ParsedPatch = {
      success: changes.length > 0,
      changes,
      confidence: parsed.confidence ?? 0.5,
      rawResponse: response,
    };

    if (parsed.explanation !== undefined) {
      result.explanation = parsed.explanation;
    }

    return result;
  }

  /**
   * Parse markdown response from LLM.
   */
  private parseMarkdownResponse(
    response: string,
    markers: ResponseMarkers | undefined,
    context: SynthesisContext
  ): ParsedPatch {
    const parseErrors: string[] = [];

    // Extract explanation
    let explanation: string | undefined;
    if (markers?.explanationStart !== undefined) {
      const explMatch = response.match(
        new RegExp(
          `${this.escapeRegex(markers.explanationStart)}([\\s\\S]*?)${this.escapeRegex(markers.explanationEnd ?? '')}`
        )
      );
      if (explMatch !== null && explMatch[1] !== undefined) {
        explanation = explMatch[1].trim();
      }
    }

    // Extract code block
    const codeStart = markers?.codeStart ?? '```';
    const codeEnd = markers?.codeEnd ?? '```';

    const codeMatch = response.match(
      new RegExp(
        `${this.escapeRegex(codeStart)}[\\w]*\\s*([\\s\\S]*?)${this.escapeRegex(codeEnd)}`
      )
    );

    if (codeMatch === null || codeMatch[1] === undefined) {
      parseErrors.push('No code block found in response');
      return {
        success: false,
        changes: [],
        confidence: 0,
        rawResponse: response,
        parseErrors,
      };
    }

    const newContent = codeMatch[1].trim();

    // Extract confidence
    let confidence = 0.5;
    const confMatch = response.match(/<confidence>\s*([\d.]+)\s*<\/confidence>/);
    if (confMatch !== null && confMatch[1] !== undefined) {
      const parsed = parseFloat(confMatch[1]);
      if (!isNaN(parsed)) {
        confidence = parsed;
      }
    }

    const line = context.error.location?.line ?? 1;
    const change: CodeChange = {
      file: context.error.location?.file ?? 'unknown',
      type: 'replace',
      start: { line, column: 1 },
      newContent,
    };

    // Add optional properties only if they have values
    const originalContent = context.codeSnippets.find(s => s.isErrorLocation)?.content;
    if (originalContent !== undefined) {
      change.originalContent = originalContent;
    }

    const result: ParsedPatch = {
      success: true,
      changes: [change],
      confidence,
      rawResponse: response,
    };

    if (explanation !== undefined) {
      result.explanation = explanation;
    }

    return result;
  }

  /**
   * Parse diff response from LLM.
   */
  private parseDiffResponse(
    response: string,
    context: SynthesisContext
  ): ParsedPatch {
    const changes: CodeChange[] = [];
    const parseErrors: string[] = [];

    // Parse unified diff format
    const diffMatch = response.match(/```(?:diff)?\s*([\s\S]*?)```/);
    const diffContent = diffMatch !== null && diffMatch[1] !== undefined
      ? diffMatch[1]
      : response;

    const hunks = diffContent.split(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/m);

    for (let i = 1; i < hunks.length; i += 3) {
      const startLineStr = hunks[i];
      const hunkContent = hunks[i + 2];

      if (startLineStr === undefined || hunkContent === undefined) continue;

      const startLine = parseInt(startLineStr, 10);
      if (isNaN(startLine)) continue;

      const lines = hunkContent.split('\n');
      const oldLines: string[] = [];
      const newLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('-')) {
          oldLines.push(line.slice(1));
        } else if (line.startsWith('+')) {
          newLines.push(line.slice(1));
        } else if (line.startsWith(' ')) {
          oldLines.push(line.slice(1));
          newLines.push(line.slice(1));
        }
      }

      const change: CodeChange = {
        file: context.error.location?.file ?? 'unknown',
        type: 'replace',
        start: { line: startLine, column: 1 },
        end: { line: startLine + oldLines.length - 1, column: 1 },
        newContent: newLines.join('\n'),
        originalContent: oldLines.join('\n'),
      };

      changes.push(change);
    }

    if (changes.length === 0) {
      parseErrors.push('No valid diff hunks found');
    }

    const result: ParsedPatch = {
      success: changes.length > 0,
      changes,
      confidence: 0.6,
      rawResponse: response,
    };

    if (parseErrors.length > 0) {
      result.parseErrors = parseErrors;
    }

    return result;
  }

  /**
   * Parse simple code block response.
   */
  private parseCodeBlockResponse(
    response: string,
    context: SynthesisContext
  ): ParsedPatch {
    const codeMatch = response.match(/```[\w]*\s*([\s\S]*?)```/);

    if (codeMatch === null || codeMatch[1] === undefined) {
      return {
        success: false,
        changes: [],
        confidence: 0,
        rawResponse: response,
        parseErrors: ['No code block found'],
      };
    }

    const line = context.error.location?.line ?? 1;
    const change: CodeChange = {
      file: context.error.location?.file ?? 'unknown',
      type: 'replace',
      start: { line, column: 1 },
      newContent: codeMatch[1].trim(),
    };

    // Add original content if available
    const originalContent = context.codeSnippets.find(s => s.isErrorLocation)?.content;
    if (originalContent !== undefined) {
      change.originalContent = originalContent;
    }

    return {
      success: true,
      changes: [change],
      confidence: 0.5,
      rawResponse: response,
    };
  }

  /**
   * Validate code syntax for a language.
   */
  private validateCodeSyntax(
    code: string,
    language: Language
  ): SyntaxValidationResult {
    switch (language) {
      case 'python':
        return this.validatePythonSyntax(code);
      case 'javascript':
      case 'typescript':
        return this.validateJavaScriptSyntax(code);
      case 'css':
      case 'scss':
        return this.validateCSSSyntax(code);
      default:
        // Basic validation for unknown languages
        return this.validateBasicSyntax(code);
    }
  }

  /**
   * Validate Python syntax (basic checks).
   */
  private validatePythonSyntax(code: string): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: string[] = [];

    // Check for common syntax issues
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const lineNum = i + 1;

      // Check for unclosed strings
      const singleQuotes = (line.match(/'/g) ?? []).length;
      const doubleQuotes = (line.match(/"/g) ?? []).length;
      const tripleQuotes = (line.match(/'''|"""/g) ?? []).length;

      if (tripleQuotes === 0) {
        if (singleQuotes % 2 !== 0 && !line.includes("\\'")) {
          errors.push({
            message: 'Unclosed string literal',
            line: lineNum,
          });
        }
        if (doubleQuotes % 2 !== 0 && !line.includes('\\"')) {
          errors.push({
            message: 'Unclosed string literal',
            line: lineNum,
          });
        }
      }

      // Check for mismatched brackets
      const openBrackets =
        (line.match(/\(/g) ?? []).length +
        (line.match(/\[/g) ?? []).length +
        (line.match(/\{/g) ?? []).length;
      const closeBrackets =
        (line.match(/\)/g) ?? []).length +
        (line.match(/\]/g) ?? []).length +
        (line.match(/\}/g) ?? []).length;

      if (openBrackets !== closeBrackets) {
        warnings.push(`Line ${lineNum}: Mismatched brackets (may span lines)`);
      }

      // Check for invalid indentation
      if (line.match(/^[ ]+\t/) !== null || line.match(/^\t+[ ]+/) !== null) {
        warnings.push(`Line ${lineNum}: Mixed tabs and spaces`);
      }
    }

    // Check for unclosed blocks
    const defCount = (code.match(/\bdef\s+\w+/g) ?? []).length;
    const returnCount = (code.match(/\breturn\b/g) ?? []).length;

    if (defCount > 0 && returnCount === 0) {
      warnings.push('Function defined without return statement (may be intentional)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate JavaScript/TypeScript syntax (basic checks).
   */
  private validateJavaScriptSyntax(code: string): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: string[] = [];

    // Count brackets
    const openParens = (code.match(/\(/g) ?? []).length;
    const closeParens = (code.match(/\)/g) ?? []).length;
    const openBrackets = (code.match(/\[/g) ?? []).length;
    const closeBrackets = (code.match(/\]/g) ?? []).length;
    const openBraces = (code.match(/\{/g) ?? []).length;
    const closeBraces = (code.match(/\}/g) ?? []).length;

    if (openParens !== closeParens) {
      errors.push({
        message: `Mismatched parentheses: ${openParens} open, ${closeParens} close`,
      });
    }

    if (openBrackets !== closeBrackets) {
      errors.push({
        message: `Mismatched square brackets: ${openBrackets} open, ${closeBrackets} close`,
      });
    }

    if (openBraces !== closeBraces) {
      errors.push({
        message: `Mismatched curly braces: ${openBraces} open, ${closeBraces} close`,
      });
    }

    // Check for common issues
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const lineNum = i + 1;

      // Check for unclosed template literals
      const backticks = (line.match(/`/g) ?? []).length;
      if (backticks % 2 !== 0 && !line.includes('\\`')) {
        warnings.push(`Line ${lineNum}: Potentially unclosed template literal`);
      }

      // Check for == instead of ===
      if (line.match(/[^=!]==[^=]/) !== null) {
        warnings.push(`Line ${lineNum}: Consider using === instead of ==`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSS/SCSS syntax (basic checks).
   */
  private validateCSSSyntax(code: string): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: string[] = [];

    // Count braces
    const openBraces = (code.match(/\{/g) ?? []).length;
    const closeBraces = (code.match(/\}/g) ?? []).length;

    if (openBraces !== closeBraces) {
      errors.push({
        message: `Mismatched braces: ${openBraces} open, ${closeBraces} close`,
      });
    }

    // Check for missing semicolons (simple heuristic)
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (rawLine === undefined) continue;

      const line = rawLine.trim();
      const lineNum = i + 1;

      // Skip empty lines, comments, selectors, and closing braces
      if (
        line === '' ||
        line.startsWith('//') ||
        line.startsWith('/*') ||
        line.endsWith('{') ||
        line === '}' ||
        line.startsWith('@')
      ) {
        continue;
      }

      // Check for property lines without semicolons
      if (line.includes(':') && !line.endsWith(';') && !line.endsWith('{')) {
        warnings.push(`Line ${lineNum}: Missing semicolon`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Basic syntax validation for unknown languages.
   */
  private validateBasicSyntax(code: string): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: string[] = [];

    // Basic bracket matching
    const stack: string[] = [];
    const brackets: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
    };

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      if (char === undefined) continue;

      if (char in brackets) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (last === undefined || brackets[last] !== char) {
          errors.push({
            message: `Unexpected closing bracket '${char}'`,
            column: i + 1,
          });
        }
      }
    }

    if (stack.length > 0) {
      const unclosed = stack
        .map(b => brackets[b])
        .filter((b): b is string => b !== undefined);
      errors.push({
        message: `Unclosed brackets: ${unclosed.join(', ')}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate validation steps for a fix.
   */
  private generateValidationSteps(language: Language): ValidationStep[] {
    const steps: ValidationStep[] = [
      {
        type: 'manual',
        description: 'Verify the fix addresses the error',
        expectedOutcome: 'Error no longer occurs',
      },
    ];

    switch (language) {
      case 'python':
        steps.push({
          type: 'lint',
          description: 'Run Python syntax check',
          command: 'python -m py_compile {{file}}',
          expectedOutcome: 'No syntax errors',
        });
        steps.push({
          type: 'test',
          description: 'Run tests',
          command: 'pytest {{file}} -v',
          expectedOutcome: 'All tests pass',
        });
        break;

      case 'typescript':
        steps.push({
          type: 'typecheck',
          description: 'Run TypeScript compiler',
          command: 'tsc --noEmit',
          expectedOutcome: 'No type errors',
        });
        steps.push({
          type: 'test',
          description: 'Run tests',
          command: 'npm test',
          expectedOutcome: 'All tests pass',
        });
        break;

      case 'javascript':
        steps.push({
          type: 'lint',
          description: 'Run ESLint',
          command: 'eslint {{file}}',
          expectedOutcome: 'No linting errors',
        });
        steps.push({
          type: 'test',
          description: 'Run tests',
          command: 'npm test',
          expectedOutcome: 'All tests pass',
        });
        break;

      case 'css':
      case 'scss':
        steps.push({
          type: 'lint',
          description: 'Run CSS linter',
          command: 'stylelint {{file}}',
          expectedOutcome: 'No linting errors',
        });
        break;
    }

    return steps;
  }

  /**
   * Build additional context string.
   */
  private buildAdditionalContext(context: SynthesisContext): string {
    const parts: string[] = [];

    if (context.relatedFiles !== undefined) {
      parts.push(
        `Related files: ${context.relatedFiles.map(f => f.path).join(', ')}`
      );
    }

    if (context.evidence !== undefined && context.evidence.length > 0) {
      parts.push(`Evidence count: ${context.evidence.length}`);
    }

    return parts.join('; ');
  }

  /**
   * Escape string for JSON.
   */
  private escapeForJson(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Escape string for regex.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an LLM patch synthesizer with default configuration.
 */
export function createLLMPatchSynthesizer(
  config?: Partial<LLMPatchSynthesizerConfig>
): LLMPatchSynthesizer {
  return new LLMPatchSynthesizer(config);
}
