/**
 * Option Generator - Produces 2-4 design approaches with trade-offs
 *
 * Takes exploration context and generates multiple implementation options,
 * each with pros, cons, effort estimates, and affected files.
 *
 * @module agentic-core/option-generator
 */

import type { AgentPlan, AgentPlanStep } from './agent-engine';
import type { PlanOption } from './plan-handoff';
import type { AnalysisResult } from './request-analyzer';
import type { ExplorationResult } from './plan-engine';

// ============================================================================
// Types
// ============================================================================

/** Effort level estimation */
export type EffortLevel = 'trivial' | 'small' | 'medium' | 'large' | 'complex';

/** Design approach category */
export type ApproachCategory =
  | 'minimal'      // Simplest solution
  | 'standard'     // Recommended balanced approach
  | 'comprehensive' // Full-featured solution
  | 'custom';       // Custom/specialized approach

/** A pro (advantage) of an option */
export interface OptionPro {
  /** Short description */
  text: string;
  /** Impact level */
  impact: 'low' | 'medium' | 'high';
  /** Category (performance, maintainability, etc.) */
  category?: string;
}

/** A con (disadvantage) of an option */
export interface OptionCon {
  /** Short description */
  text: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Mitigation strategy (if any) */
  mitigation?: string;
  /** Category */
  category?: string;
}

/** Effort estimation details */
export interface EffortEstimate {
  /** Overall effort level */
  level: EffortLevel;
  /** Estimated lines of code */
  linesOfCode?: number;
  /** Number of files affected */
  fileCount: number;
  /** Complexity factors */
  complexityFactors?: string[];
  /** Dependencies required */
  dependencies?: string[];
}

/** File that will be affected by the option */
export interface AffectedFile {
  /** File path */
  path: string;
  /** Type of change */
  changeType: 'create' | 'modify' | 'delete';
  /** Description of changes */
  description: string;
  /** Estimated lines changed */
  linesChanged?: number;
}

/**
 * A design option with full trade-off analysis
 *
 * Feature #44 Required Fields:
 * - id: Unique identifier for the option
 * - name: Display name for the option
 * - description: Full description of what the option does
 * - pros[]: List of advantages (OptionPro[])
 * - cons[]: List of disadvantages (OptionCon[])
 * - effort: Effort estimation (EffortEstimate)
 * - files[]: Files that will be affected (AffectedFile[])
 */
export interface DesignOption {
  /** Unique identifier (Feature #44: required) */
  id: string;
  /** Display name (Feature #44: required) */
  name: string;
  /** Full description (Feature #44: required) */
  description: string;
  /** Approach category */
  category: ApproachCategory;
  /** List of advantages (Feature #44: required as pros[]) */
  pros: OptionPro[];
  /** List of disadvantages (Feature #44: required as cons[]) */
  cons: OptionCon[];
  /** Effort estimation (Feature #44: required) */
  effort: EffortEstimate;
  /** Files that will be affected (Feature #44: required as files[]) */
  filesAffected: AffectedFile[];
  /** The execution plan */
  plan: AgentPlan;
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** Whether this is the recommended option */
  recommended?: boolean;
  /** Additional notes */
  notes?: string;
}

/** Generation result */
export interface OptionGenerationResult {
  /** Generated options (2-4) */
  options: DesignOption[];
  /** The recommended option ID */
  recommendedId: string;
  /** Summary of all options */
  summary: string;
  /** Original request context */
  context: {
    request: string;
    explorationCount: number;
  };
  /** Generation timestamp */
  timestamp: Date;
}

/** Option template for generating approaches */
export interface OptionTemplate {
  /** Category this template produces */
  category: ApproachCategory;
  /** Template name pattern */
  namePattern: string;
  /** Description pattern */
  descriptionPattern: string;
  /** Default pros */
  defaultPros: Omit<OptionPro, 'text'>[];
  /** Default cons */
  defaultCons: Omit<OptionCon, 'text'>[];
  /** Effort multiplier relative to standard (1.0) */
  effortMultiplier: number;
}

/** Generator configuration */
export interface OptionGeneratorConfig {
  /** Minimum options to generate */
  minOptions?: number;
  /** Maximum options to generate */
  maxOptions?: number;
  /** Custom templates */
  customTemplates?: OptionTemplate[];
  /** Default workspace root for file paths */
  workspaceRoot?: string;
  /** Include custom option template */
  includeCustomOption?: boolean;
}

/** Context for generating options */
export interface GenerationContext {
  /** User's original request */
  request: string;
  /** Analysis result (if available) */
  analysis?: AnalysisResult;
  /** Exploration results */
  explorations?: ExplorationResult[];
  /** Relevant files discovered */
  relevantFiles?: string[];
  /** Domain context */
  domain?: string;
}

// ============================================================================
// Default Templates
// ============================================================================

/** Default option templates for common approaches */
const DEFAULT_TEMPLATES: OptionTemplate[] = [
  {
    category: 'minimal',
    namePattern: 'Minimal Approach',
    descriptionPattern: 'Simplest solution with core functionality only',
    defaultPros: [
      { impact: 'high', category: 'speed' },
      { impact: 'medium', category: 'simplicity' },
      { impact: 'low', category: 'risk' },
    ],
    defaultCons: [
      { severity: 'medium', category: 'features' },
      { severity: 'low', category: 'extensibility' },
    ],
    effortMultiplier: 0.5,
  },
  {
    category: 'standard',
    namePattern: 'Standard Approach',
    descriptionPattern: 'Balanced solution following best practices',
    defaultPros: [
      { impact: 'high', category: 'balance' },
      { impact: 'medium', category: 'maintainability' },
      { impact: 'medium', category: 'quality' },
    ],
    defaultCons: [
      { severity: 'low', category: 'complexity' },
    ],
    effortMultiplier: 1.0,
  },
  {
    category: 'comprehensive',
    namePattern: 'Comprehensive Approach',
    descriptionPattern: 'Full-featured solution with all capabilities',
    defaultPros: [
      { impact: 'high', category: 'features' },
      { impact: 'high', category: 'extensibility' },
      { impact: 'medium', category: 'future-proof' },
    ],
    defaultCons: [
      { severity: 'medium', category: 'complexity' },
      { severity: 'medium', category: 'time' },
      { severity: 'low', category: 'risk' },
    ],
    effortMultiplier: 2.0,
  },
  {
    category: 'custom',
    namePattern: 'Custom Approach',
    descriptionPattern: 'Tailored solution for specific requirements',
    defaultPros: [
      { impact: 'high', category: 'fit' },
      { impact: 'medium', category: 'optimization' },
    ],
    defaultCons: [
      { severity: 'medium', category: 'maintenance' },
      { severity: 'low', category: 'documentation' },
    ],
    effortMultiplier: 1.5,
  },
];

/** Pro text templates by category */
const PRO_TEXTS: Record<string, string[]> = {
  speed: ['Quick to implement', 'Fast delivery time', 'Minimal development overhead'],
  simplicity: ['Easy to understand', 'Low cognitive complexity', 'Straightforward implementation'],
  risk: ['Low risk of issues', 'Minimal side effects', 'Safe approach'],
  balance: ['Good balance of features and complexity', 'Optimal trade-offs', 'Well-rounded solution'],
  maintainability: ['Easy to maintain', 'Clear code structure', 'Good separation of concerns'],
  quality: ['High code quality', 'Robust implementation', 'Well-tested approach'],
  features: ['Full feature set', 'Complete functionality', 'All requirements met'],
  extensibility: ['Easily extensible', 'Ready for future enhancements', 'Modular architecture'],
  'future-proof': ['Future-proof design', 'Scalable architecture', 'Long-term viability'],
  fit: ['Perfectly tailored solution', 'Exact requirements match', 'Custom-fit implementation'],
  optimization: ['Optimized for your use case', 'Performance tuned', 'Efficient implementation'],
};

/** Con text templates by category */
const CON_TEXTS: Record<string, string[]> = {
  features: ['Limited feature set', 'Some features omitted', 'Reduced functionality'],
  extensibility: ['Harder to extend later', 'Limited flexibility', 'May require refactoring'],
  complexity: ['More complex implementation', 'Higher cognitive load', 'Steeper learning curve'],
  time: ['Takes longer to implement', 'Extended timeline', 'More development hours'],
  risk: ['Higher risk of issues', 'More potential edge cases', 'Increased testing needed'],
  maintenance: ['May be harder to maintain', 'Custom patterns to learn', 'Documentation needed'],
  documentation: ['Requires more documentation', 'Non-standard patterns', 'Training may be needed'],
};

// ============================================================================
// Option Generator Class
// ============================================================================

/**
 * OptionGenerator - Creates 2-4 design approaches with trade-offs
 *
 * Key features:
 * - Generates 2-4 options (minimal, standard, comprehensive, custom)
 * - Each option has pros, cons, effort, and affected files
 * - Recommends the best option based on context
 * - Customizable templates
 *
 * @example
 * ```typescript
 * const generator = new OptionGenerator();
 *
 * const result = generator.generate({
 *   request: 'Add a hero section to the homepage',
 *   relevantFiles: ['templates/homepage.xml', 'static/css/style.scss'],
 * });
 *
 * console.log(result.options.length); // 2-4
 * console.log(result.recommendedId);  // 'opt-standard'
 * ```
 */
export class OptionGenerator {
  private templates: OptionTemplate[];
  private config: Required<Omit<OptionGeneratorConfig, 'customTemplates'>>;

  constructor(config: OptionGeneratorConfig = {}) {
    this.templates = [
      ...DEFAULT_TEMPLATES,
      ...(config.customTemplates ?? []),
    ];
    this.config = {
      minOptions: Math.max(2, config.minOptions ?? 2),
      maxOptions: Math.min(4, Math.max(2, config.maxOptions ?? 4)),
      workspaceRoot: config.workspaceRoot ?? '',
      includeCustomOption: config.includeCustomOption ?? false,
    };
  }

  // ==========================================================================
  // Main Generation
  // ==========================================================================

  /**
   * Generate design options from context
   */
  generate(context: GenerationContext): OptionGenerationResult {
    // Determine which templates to use
    const templatesToUse = this.selectTemplates(context);

    // Generate options from templates
    const options = templatesToUse.map((template, index) =>
      this.generateOption(template, context, index)
    );

    // Determine recommended option
    const recommendedId = this.selectRecommendation(options, context);

    // Mark recommended
    for (const option of options) {
      option.recommended = option.id === recommendedId;
    }

    return {
      options,
      recommendedId,
      summary: this.generateSummary(options),
      context: {
        request: context.request,
        explorationCount: context.explorations?.length ?? 0,
      },
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // Template Selection
  // ==========================================================================

  /**
   * Select which templates to use based on context
   */
  private selectTemplates(context: GenerationContext): OptionTemplate[] {
    const templates: OptionTemplate[] = [];

    // Always include minimal and standard
    const minimal = this.templates.find(t => t.category === 'minimal');
    const standard = this.templates.find(t => t.category === 'standard');

    if (minimal) templates.push(minimal);
    if (standard) templates.push(standard);

    // Add comprehensive if request seems complex
    if (this.isComplexRequest(context)) {
      const comprehensive = this.templates.find(t => t.category === 'comprehensive');
      if (comprehensive) templates.push(comprehensive);
    }

    // Add custom if explicitly requested or enabled
    if (this.config.includeCustomOption || this.needsCustomOption(context)) {
      const custom = this.templates.find(t => t.category === 'custom');
      if (custom && templates.length < this.config.maxOptions) {
        templates.push(custom);
      }
    }

    // Ensure we have at least minOptions
    while (templates.length < this.config.minOptions) {
      const comprehensive = this.templates.find(t => t.category === 'comprehensive');
      if (comprehensive && !templates.includes(comprehensive)) {
        templates.push(comprehensive);
      } else {
        break;
      }
    }

    // Limit to maxOptions
    return templates.slice(0, this.config.maxOptions);
  }

  /**
   * Check if request seems complex
   */
  private isComplexRequest(context: GenerationContext): boolean {
    // Complex if many files affected
    if (context.relevantFiles && context.relevantFiles.length > 3) return true;

    // Complex if analysis shows many issues
    if (context.analysis && context.analysis.issues.length > 3) return true;

    // Complex if request is long
    if (context.request.length > 100) return true;

    // Complex keywords
    const complexKeywords = ['complete', 'full', 'comprehensive', 'entire', 'all'];
    const hasComplexKeyword = complexKeywords.some(kw =>
      context.request.toLowerCase().includes(kw)
    );
    if (hasComplexKeyword) return true;

    return false;
  }

  /**
   * Check if custom option is needed
   */
  private needsCustomOption(context: GenerationContext): boolean {
    // Custom keywords
    const customKeywords = ['custom', 'specific', 'unique', 'tailored', 'specialized'];
    return customKeywords.some(kw =>
      context.request.toLowerCase().includes(kw)
    );
  }

  // ==========================================================================
  // Option Generation
  // ==========================================================================

  /**
   * Generate a single option from template
   */
  private generateOption(
    template: OptionTemplate,
    context: GenerationContext,
    index: number
  ): DesignOption {
    const id = `opt-${template.category}-${index}`;

    // Generate pros
    const pros = this.generatePros(template, context);

    // Generate cons
    const cons = this.generateCons(template, context);

    // Calculate effort
    const effort = this.calculateEffort(template, context);

    // Determine affected files
    const filesAffected = this.determineAffectedFiles(template, context);

    // Generate plan
    const plan = this.generatePlan(template, context);

    // Determine risk
    const riskLevel = this.assessRisk(template, context);

    return {
      id,
      name: this.generateName(template, context),
      description: this.generateDescription(template, context),
      category: template.category,
      pros,
      cons,
      effort,
      filesAffected,
      plan,
      riskLevel,
    };
  }

  /**
   * Generate option name
   */
  private generateName(template: OptionTemplate, context: GenerationContext): string {
    // Could be customized based on context
    return template.namePattern;
  }

  /**
   * Generate option description
   */
  private generateDescription(template: OptionTemplate, context: GenerationContext): string {
    // Could be customized based on context
    return template.descriptionPattern;
  }

  /**
   * Generate pros for an option
   */
  private generatePros(template: OptionTemplate, context: GenerationContext): OptionPro[] {
    return template.defaultPros.map(defaultPro => {
      const texts = PRO_TEXTS[defaultPro.category ?? 'balance'] ?? ['Advantage'];
      const text = texts[Math.floor(Math.random() * texts.length)];

      return {
        text,
        impact: defaultPro.impact,
        category: defaultPro.category,
      };
    });
  }

  /**
   * Generate cons for an option
   */
  private generateCons(template: OptionTemplate, context: GenerationContext): OptionCon[] {
    return template.defaultCons.map(defaultCon => {
      const texts = CON_TEXTS[defaultCon.category ?? 'complexity'] ?? ['Disadvantage'];
      const text = texts[Math.floor(Math.random() * texts.length)];

      return {
        text,
        severity: defaultCon.severity,
        category: defaultCon.category,
      };
    });
  }

  /**
   * Calculate effort estimate
   */
  private calculateEffort(
    template: OptionTemplate,
    context: GenerationContext
  ): EffortEstimate {
    const baseFiles = context.relevantFiles?.length ?? 1;
    const fileCount = Math.ceil(baseFiles * template.effortMultiplier);

    // Determine effort level based on multiplier
    let level: EffortLevel;
    if (template.effortMultiplier <= 0.5) {
      level = 'trivial';
    } else if (template.effortMultiplier <= 0.8) {
      level = 'small';
    } else if (template.effortMultiplier <= 1.2) {
      level = 'medium';
    } else if (template.effortMultiplier <= 1.8) {
      level = 'large';
    } else {
      level = 'complex';
    }

    return {
      level,
      fileCount,
      linesOfCode: fileCount * 50 * template.effortMultiplier,
      complexityFactors: this.getComplexityFactors(template),
    };
  }

  /**
   * Get complexity factors based on template
   */
  private getComplexityFactors(template: OptionTemplate): string[] {
    const factors: string[] = [];

    switch (template.category) {
      case 'minimal':
        factors.push('Simple implementation');
        break;
      case 'standard':
        factors.push('Standard patterns');
        factors.push('Best practices');
        break;
      case 'comprehensive':
        factors.push('Multiple components');
        factors.push('Integration points');
        factors.push('Testing requirements');
        break;
      case 'custom':
        factors.push('Custom logic');
        factors.push('Specific requirements');
        break;
    }

    return factors;
  }

  /**
   * Determine affected files
   */
  private determineAffectedFiles(
    template: OptionTemplate,
    context: GenerationContext
  ): AffectedFile[] {
    const files: AffectedFile[] = [];
    const relevantFiles = context.relevantFiles ?? [];

    // Include relevant files based on effort multiplier
    const fileCount = Math.ceil(relevantFiles.length * template.effortMultiplier);
    const filesToInclude = relevantFiles.slice(0, Math.max(1, fileCount));

    for (const path of filesToInclude) {
      files.push({
        path,
        changeType: 'modify',
        description: `Update ${path.split('/').pop()} for ${template.category} approach`,
        linesChanged: Math.ceil(50 * template.effortMultiplier),
      });
    }

    // Comprehensive might create new files
    if (template.category === 'comprehensive' && relevantFiles.length > 0) {
      const basePath = relevantFiles[0].replace(/\/[^/]+$/, '');
      files.push({
        path: `${basePath}/new_component.xml`,
        changeType: 'create',
        description: 'New component for comprehensive implementation',
        linesChanged: 100,
      });
    }

    return files;
  }

  /**
   * Generate execution plan
   */
  private generatePlan(template: OptionTemplate, context: GenerationContext): AgentPlan {
    const steps: AgentPlanStep[] = [];
    const relevantFiles = context.relevantFiles ?? [];

    // Add steps based on category
    switch (template.category) {
      case 'minimal':
        steps.push({
          id: 'step-1',
          description: 'Implement core functionality',
          action: 'edit_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        break;

      case 'standard':
        steps.push({
          id: 'step-1',
          description: 'Analyze existing code structure',
          action: 'read_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-2',
          description: 'Implement changes following best practices',
          action: 'edit_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-3',
          description: 'Update related files',
          action: 'edit_file',
          target: relevantFiles[1] ?? 'style.scss',
          status: 'pending',
        });
        break;

      case 'comprehensive':
        steps.push({
          id: 'step-1',
          description: 'Analyze all affected components',
          action: 'read_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-2',
          description: 'Create new component structure',
          action: 'write_file',
          target: 'new_component.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-3',
          description: 'Implement full feature set',
          action: 'edit_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-4',
          description: 'Add styling and integration',
          action: 'edit_file',
          target: relevantFiles[1] ?? 'style.scss',
          status: 'pending',
        });
        break;

      case 'custom':
        steps.push({
          id: 'step-1',
          description: 'Analyze specific requirements',
          action: 'read_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        steps.push({
          id: 'step-2',
          description: 'Implement custom solution',
          action: 'edit_file',
          target: relevantFiles[0] ?? 'main.xml',
          status: 'pending',
        });
        break;
    }

    return {
      id: `plan-${template.category}`,
      description: `${template.namePattern} for: ${context.request}`,
      steps,
      estimatedSteps: steps.length,
    };
  }

  /**
   * Assess risk level
   */
  private assessRisk(
    template: OptionTemplate,
    context: GenerationContext
  ): 'low' | 'medium' | 'high' {
    // Minimal is low risk
    if (template.category === 'minimal') return 'low';

    // Standard is low-medium based on file count
    if (template.category === 'standard') {
      return (context.relevantFiles?.length ?? 0) > 3 ? 'medium' : 'low';
    }

    // Comprehensive has higher risk
    if (template.category === 'comprehensive') return 'medium';

    // Custom depends on context
    return 'medium';
  }

  // ==========================================================================
  // Recommendation
  // ==========================================================================

  /**
   * Select recommended option
   */
  private selectRecommendation(
    options: DesignOption[],
    context: GenerationContext
  ): string {
    // Default to standard if available
    const standard = options.find(o => o.category === 'standard');
    if (standard) return standard.id;

    // Otherwise pick lowest risk with most features
    const sorted = [...options].sort((a, b) => {
      // Lower risk is better
      const riskOrder = { low: 0, medium: 1, high: 2 };
      const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      if (riskDiff !== 0) return riskDiff;

      // More pros is better
      return b.pros.length - a.pros.length;
    });

    return sorted[0]?.id ?? options[0].id;
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  /**
   * Generate summary of all options
   */
  private generateSummary(options: DesignOption[]): string {
    const optionSummaries = options.map(opt => {
      const proCount = opt.pros.length;
      const conCount = opt.cons.length;
      return `${opt.name}: ${opt.effort.level} effort, ${proCount} pros, ${conCount} cons`;
    });

    return optionSummaries.join('; ');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Add custom template
   */
  addTemplate(template: OptionTemplate): void {
    this.templates.push(template);
  }

  /**
   * Create option from PlanOption (for compatibility)
   */
  fromPlanOption(planOption: PlanOption, context: GenerationContext): DesignOption {
    return {
      id: planOption.id,
      name: planOption.label,
      description: planOption.description,
      category: 'custom',
      pros: [],
      cons: [],
      effort: {
        level: this.complexityToEffort(planOption.complexity ?? 3),
        fileCount: planOption.affectedFiles?.length ?? 1,
      },
      filesAffected: (planOption.affectedFiles ?? []).map(path => ({
        path,
        changeType: 'modify' as const,
        description: `Modify ${path}`,
      })),
      plan: planOption.plan,
      riskLevel: planOption.riskLevel ?? 'medium',
    };
  }

  /**
   * Convert to PlanOption (for compatibility)
   */
  toPlanOption(designOption: DesignOption): PlanOption {
    return {
      id: designOption.id,
      label: designOption.name,
      description: designOption.description,
      plan: designOption.plan,
      complexity: this.effortToComplexity(designOption.effort.level),
      riskLevel: designOption.riskLevel,
      affectedFiles: designOption.filesAffected.map(f => f.path),
    };
  }

  /**
   * Convert complexity (1-5) to effort level
   */
  private complexityToEffort(complexity: number): EffortLevel {
    if (complexity <= 1) return 'trivial';
    if (complexity <= 2) return 'small';
    if (complexity <= 3) return 'medium';
    if (complexity <= 4) return 'large';
    return 'complex';
  }

  /**
   * Convert effort level to complexity (1-5)
   */
  private effortToComplexity(effort: EffortLevel): number {
    const map: Record<EffortLevel, number> = {
      trivial: 1,
      small: 2,
      medium: 3,
      large: 4,
      complex: 5,
    };
    return map[effort];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new OptionGenerator instance
 */
export function createOptionGenerator(config?: OptionGeneratorConfig): OptionGenerator {
  return new OptionGenerator(config);
}

/**
 * Quick generate function
 */
export function generateOptions(
  context: GenerationContext,
  config?: OptionGeneratorConfig
): OptionGenerationResult {
  return new OptionGenerator(config).generate(context);
}

// ============================================================================
// Exports
// ============================================================================

export default OptionGenerator;
