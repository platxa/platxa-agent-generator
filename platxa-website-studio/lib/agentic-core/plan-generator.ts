/**
 * Plan Generator - LLM-based plan generation for AgentEngine
 *
 * Generates structured execution plans from user goals using LLM.
 * Supports multiple LLM providers and includes fallback patterns.
 *
 * @module agentic-core/plan-generator
 */

import type {
  AgentPlan,
  AgentPlanStep,
  AgentContext,
  AgentActionType,
  AgentError,
  LLMProvider,
} from './agent-engine';

// ============================================================================
// Types
// ============================================================================

/** LLM response for plan generation */
export interface LLMPlanResponse {
  steps: Array<{
    action: string;
    target: string;
    rationale: string;
  }>;
}

/** LLM response for fix generation */
export interface LLMFixResponse {
  fixes: Array<{
    action: string;
    target: string;
    rationale: string;
    errorRef?: string;
  }>;
}

/** Options for plan generation */
export interface PlanGeneratorOptions {
  /** Maximum steps per plan */
  maxSteps?: number;
  /** Include search/read steps for context gathering */
  includeExplorationSteps?: boolean;
  /** Odoo-specific planning hints */
  odooHints?: boolean;
}

/** Prompt templates for LLM */
export interface PlanPromptTemplates {
  systemPrompt: string;
  planPrompt: string;
  fixPrompt: string;
}

// ============================================================================
// Default Prompt Templates
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an expert Odoo website developer assistant. Your task is to create detailed execution plans for website generation tasks.

You work with:
- QWeb templates (Odoo's templating engine)
- SCSS styling with Odoo's Bootstrap-based framework
- Website snippets and building blocks
- Design tokens for theming

Always output valid JSON matching the requested schema.`;

const DEFAULT_PLAN_PROMPT = `Create an execution plan for the following goal:

GOAL: {{goal}}

CONTEXT:
{{context}}

Generate a JSON plan with steps. Each step must have:
- action: One of "search", "read", "write", "edit", "validate", "compile", "preview", "test", "web_search"
- target: The file path or resource to operate on
- rationale: Why this step is necessary

Respond with JSON only:
{
  "steps": [
    { "action": "...", "target": "...", "rationale": "..." }
  ]
}`;

const DEFAULT_FIX_PROMPT = `Generate fix steps for the following errors:

ERRORS:
{{errors}}

CONTEXT:
{{context}}

Generate JSON with fixes. Each fix must have:
- action: The corrective action to take
- target: The file or resource to fix
- rationale: How this fixes the error
- errorRef: Reference to the error being fixed (optional)

Respond with JSON only:
{
  "fixes": [
    { "action": "...", "target": "...", "rationale": "...", "errorRef": "..." }
  ]
}`;

// ============================================================================
// Plan Generator Class
// ============================================================================

/**
 * PlanGenerator - Creates execution plans from goals using LLM
 */
export class PlanGenerator implements LLMProvider {
  private options: Required<PlanGeneratorOptions>;
  private templates: PlanPromptTemplates;
  private llmCall?: (prompt: string) => Promise<string>;

  constructor(
    options: PlanGeneratorOptions = {},
    llmCall?: (prompt: string) => Promise<string>
  ) {
    this.options = {
      maxSteps: options.maxSteps ?? 20,
      includeExplorationSteps: options.includeExplorationSteps ?? true,
      odooHints: options.odooHints ?? true,
    };

    this.templates = {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      planPrompt: DEFAULT_PLAN_PROMPT,
      fixPrompt: DEFAULT_FIX_PROMPT,
    };

    this.llmCall = llmCall;
  }

  /**
   * Generate an execution plan from a goal
   */
  async generatePlan(goal: string, context: AgentContext): Promise<AgentPlan> {
    const planId = this.generateId();

    // Build context summary for the prompt
    const contextSummary = this.buildContextSummary(context);

    // Generate steps using LLM or fallback
    let steps: AgentPlanStep[];

    if (this.llmCall) {
      steps = await this.generateStepsWithLLM(goal, contextSummary);
    } else {
      steps = this.generateDefaultSteps(goal, context);
    }

    // Ensure we don't exceed max steps
    if (steps.length > this.options.maxSteps) {
      steps = steps.slice(0, this.options.maxSteps);
    }

    return {
      id: planId,
      goal,
      steps,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate fix steps from errors
   */
  async generateFix(errors: AgentError[], context: AgentContext): Promise<AgentPlanStep[]> {
    if (errors.length === 0) {
      return [];
    }

    if (this.llmCall) {
      return this.generateFixStepsWithLLM(errors, context);
    }

    return this.generateDefaultFixSteps(errors);
  }

  /**
   * Set custom prompt templates
   */
  setTemplates(templates: Partial<PlanPromptTemplates>): void {
    this.templates = { ...this.templates, ...templates };
  }

  /**
   * Set the LLM call function
   */
  setLLMCall(llmCall: (prompt: string) => Promise<string>): void {
    this.llmCall = llmCall;
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private async generateStepsWithLLM(
    goal: string,
    contextSummary: string
  ): Promise<AgentPlanStep[]> {
    const prompt = this.templates.planPrompt
      .replace('{{goal}}', goal)
      .replace('{{context}}', contextSummary);

    const fullPrompt = `${this.templates.systemPrompt}\n\n${prompt}`;

    try {
      const response = await this.llmCall!(fullPrompt);
      const parsed = this.parseJSONResponse<LLMPlanResponse>(response);

      return parsed.steps.map((step, index) => ({
        id: `${this.generateId()}-${index}`,
        action: this.normalizeAction(step.action),
        target: step.target,
        rationale: step.rationale,
        status: 'pending' as const,
      }));
    } catch (error) {
      console.error('LLM plan generation failed, using defaults:', error);
      return this.generateDefaultSteps(goal, { filesRead: new Map(), searchResults: new Map(), userPreferences: {}, odooContext: {} });
    }
  }

  private async generateFixStepsWithLLM(
    errors: AgentError[],
    context: AgentContext
  ): Promise<AgentPlanStep[]> {
    const errorSummary = errors.map(e =>
      `[${e.type}] ${e.message}${e.file ? ` in ${e.file}:${e.line}` : ''}`
    ).join('\n');

    const contextSummary = this.buildContextSummary(context);

    const prompt = this.templates.fixPrompt
      .replace('{{errors}}', errorSummary)
      .replace('{{context}}', contextSummary);

    const fullPrompt = `${this.templates.systemPrompt}\n\n${prompt}`;

    try {
      const response = await this.llmCall!(fullPrompt);
      const parsed = this.parseJSONResponse<LLMFixResponse>(response);

      return parsed.fixes.map((fix, index) => ({
        id: `fix-${this.generateId()}-${index}`,
        action: this.normalizeAction(fix.action),
        target: fix.target,
        rationale: fix.rationale,
        status: 'pending' as const,
      }));
    } catch (error) {
      console.error('LLM fix generation failed, using defaults:', error);
      return this.generateDefaultFixSteps(errors);
    }
  }

  private generateDefaultSteps(goal: string, context: AgentContext): AgentPlanStep[] {
    const steps: AgentPlanStep[] = [];
    const goalLower = goal.toLowerCase();

    // Step 1: Search for existing patterns (if exploration enabled)
    if (this.options.includeExplorationSteps) {
      steps.push({
        id: `${this.generateId()}-search`,
        action: 'search',
        target: this.inferSearchTarget(goal),
        rationale: 'Search codebase for existing patterns and related code',
        status: 'pending',
      });
    }

    // Step 2: Read relevant templates
    if (this.options.odooHints && (goalLower.includes('template') || goalLower.includes('page'))) {
      steps.push({
        id: `${this.generateId()}-read-template`,
        action: 'read',
        target: 'views/templates.xml',
        rationale: 'Read existing QWeb templates for context',
        status: 'pending',
      });
    }

    // Step 3: Generate/write the main content
    steps.push({
      id: `${this.generateId()}-write`,
      action: 'write',
      target: this.inferWriteTarget(goal),
      rationale: 'Generate the main content for the requested feature',
      status: 'pending',
    });

    // Step 4: Validate QWeb (for Odoo templates)
    if (this.options.odooHints) {
      steps.push({
        id: `${this.generateId()}-validate`,
        action: 'validate',
        target: 'qweb',
        rationale: 'Validate QWeb template syntax and t-directives',
        status: 'pending',
      });
    }

    // Step 5: Compile styles
    if (goalLower.includes('style') || goalLower.includes('scss') || goalLower.includes('css')) {
      steps.push({
        id: `${this.generateId()}-compile`,
        action: 'compile',
        target: 'scss',
        rationale: 'Compile SCSS styles and check for errors',
        status: 'pending',
      });
    }

    // Step 6: Preview
    steps.push({
      id: `${this.generateId()}-preview`,
      action: 'preview',
      target: 'generated',
      rationale: 'Generate preview to verify visual output',
      status: 'pending',
    });

    return steps;
  }

  private generateDefaultFixSteps(errors: AgentError[]): AgentPlanStep[] {
    const steps: AgentPlanStep[] = [];

    for (const error of errors) {
      if (error.severity !== 'error') continue;

      const fixAction = this.inferFixAction(error);
      steps.push({
        id: `fix-${error.id}`,
        action: fixAction.action,
        target: fixAction.target,
        rationale: `Fix ${error.type} error: ${error.message}`,
        status: 'pending',
      });
    }

    // Add re-validation step
    if (steps.length > 0) {
      steps.push({
        id: `fix-${this.generateId()}-revalidate`,
        action: 'validate',
        target: 'all',
        rationale: 'Re-validate after applying fixes',
        status: 'pending',
      });
    }

    return steps;
  }

  private buildContextSummary(context: AgentContext): string {
    const parts: string[] = [];

    if (context.odooContext.version) {
      parts.push(`Odoo Version: ${context.odooContext.version}`);
    }

    if (context.odooContext.modules?.length) {
      parts.push(`Modules: ${context.odooContext.modules.join(', ')}`);
    }

    if (context.odooContext.theme) {
      parts.push(`Theme: ${context.odooContext.theme}`);
    }

    if (context.filesRead.size > 0) {
      parts.push(`Files analyzed: ${context.filesRead.size}`);
    }

    if (context.designTokens) {
      parts.push('Design tokens: Available');
    }

    return parts.length > 0 ? parts.join('\n') : 'No prior context';
  }

  private parseJSONResponse<T>(response: string): T {
    // Extract JSON from potential markdown code blocks
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in the response
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }

    return JSON.parse(jsonStr);
  }

  private normalizeAction(action: string): AgentActionType {
    const actionMap: Record<string, AgentActionType> = {
      search: 'search',
      read: 'read',
      write: 'write',
      edit: 'edit',
      validate: 'validate',
      compile: 'compile',
      preview: 'preview',
      test: 'test',
      web_search: 'web_search',
      inspect_logs: 'inspect_logs',
      // Common alternatives
      create: 'write',
      modify: 'edit',
      update: 'edit',
      check: 'validate',
      build: 'compile',
      render: 'preview',
      find: 'search',
      lookup: 'web_search',
      logs: 'inspect_logs',
      errors: 'inspect_logs',
    };

    return actionMap[action.toLowerCase()] || 'write';
  }

  private inferSearchTarget(goal: string): string {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('snippet')) return 'snippets/**/*.xml';
    if (goalLower.includes('template')) return 'views/**/*.xml';
    if (goalLower.includes('style') || goalLower.includes('scss')) return '**/*.scss';
    if (goalLower.includes('page')) return 'views/pages/**/*.xml';

    return '**/*';
  }

  private inferWriteTarget(goal: string): string {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('snippet')) return 'static/src/snippets/new_snippet.xml';
    if (goalLower.includes('page')) return 'views/pages/new_page.xml';
    if (goalLower.includes('style') || goalLower.includes('scss')) return 'static/src/scss/custom.scss';
    if (goalLower.includes('template')) return 'views/templates.xml';

    return 'views/generated.xml';
  }

  private inferFixAction(error: AgentError): { action: AgentActionType; target: string } {
    if (error.file) {
      return { action: 'edit', target: error.file };
    }

    switch (error.type) {
      case 'qweb':
        return { action: 'edit', target: 'views/**/*.xml' };
      case 'scss':
        return { action: 'edit', target: '**/*.scss' };
      case 'validation':
        return { action: 'validate', target: 'all' };
      default:
        return { action: 'edit', target: 'unknown' };
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a plan generator with optional LLM integration
 */
export function createPlanGenerator(
  options?: PlanGeneratorOptions,
  llmCall?: (prompt: string) => Promise<string>
): PlanGenerator {
  return new PlanGenerator(options, llmCall);
}

// ============================================================================
// Default Export
// ============================================================================

export default PlanGenerator;
