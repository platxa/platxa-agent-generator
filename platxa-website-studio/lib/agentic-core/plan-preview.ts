/**
 * Plan Preview - Detailed visualization of execution plans
 *
 * Generates detailed previews showing:
 * - Numbered execution steps
 * - Affected file paths
 * - Estimated duration per step and total
 *
 * @module agentic-core/plan-preview
 */

import type { AgentPlan, AgentPlanStep, AgentActionType } from './agent-engine';
import type { DesignOption, AffectedFile } from './option-generator';

// ============================================================================
// Types
// ============================================================================

/** Preview of a single step */
export interface StepPreview {
  /** Step number (1-based) */
  number: number;
  /** Step ID */
  id: string;
  /** Action type */
  action: AgentActionType;
  /** Human-readable action label */
  actionLabel: string;
  /** Target file/resource */
  target: string;
  /** Step description/rationale */
  description: string;
  /** Estimated duration in seconds */
  estimatedDurationSec: number;
  /** Current status */
  status: AgentPlanStep['status'];
  /** Dependencies (step IDs this depends on) */
  dependencies?: string[];
  /** Risk level for this step */
  riskLevel?: 'low' | 'medium' | 'high';
}

/** Preview of an affected file */
export interface FilePreview {
  /** File path */
  path: string;
  /** File name (extracted from path) */
  name: string;
  /** Directory (extracted from path) */
  directory: string;
  /** File extension */
  extension: string;
  /** Change type */
  changeType: 'create' | 'modify' | 'delete' | 'read';
  /** Change description */
  description: string;
  /** Estimated lines changed */
  linesChanged?: number;
  /** Steps that affect this file */
  affectedBySteps: number[];
}

/** Duration breakdown */
export interface DurationEstimate {
  /** Total duration in seconds */
  totalSec: number;
  /** Formatted total (e.g., "2m 30s") */
  totalFormatted: string;
  /** Per-step durations */
  perStep: { stepNumber: number; durationSec: number }[];
  /** Average step duration */
  averageStepSec: number;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

/** Complete plan preview */
export interface PlanPreview {
  /** Plan ID */
  planId: string;
  /** Plan goal/title */
  title: string;
  /** Plan description */
  description: string;
  /** Numbered steps preview */
  steps: StepPreview[];
  /** Total step count */
  stepCount: number;
  /** Affected files preview */
  files: FilePreview[];
  /** Total file count */
  fileCount: number;
  /** Duration estimate */
  duration: DurationEstimate;
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** Preview generation timestamp */
  generatedAt: Date;
  /** Text summary */
  summary: string;
}

/** Preview configuration */
export interface PlanPreviewConfig {
  /** Base duration per action type (in seconds) */
  actionDurations?: Partial<Record<AgentActionType, number>>;
  /** Include detailed file analysis */
  includeFileDetails?: boolean;
  /** Include step dependencies */
  includeDependencies?: boolean;
  /** Custom action labels */
  actionLabels?: Partial<Record<AgentActionType, string>>;
}

/** Rendering format options */
export type PreviewFormat = 'text' | 'markdown' | 'json' | 'structured';

// ============================================================================
// Default Configuration
// ============================================================================

/** Default duration estimates per action type (in seconds) */
const DEFAULT_ACTION_DURATIONS: Record<AgentActionType, number> = {
  read_file: 2,
  write_file: 5,
  edit_file: 8,
  search: 3,
  validate: 4,
  execute: 10,
  analyze: 5,
  plan: 15,
  unknown: 5,
};

/** Default human-readable action labels */
const DEFAULT_ACTION_LABELS: Record<AgentActionType, string> = {
  read_file: 'Read file',
  write_file: 'Create file',
  edit_file: 'Edit file',
  search: 'Search codebase',
  validate: 'Validate changes',
  execute: 'Execute command',
  analyze: 'Analyze code',
  plan: 'Generate plan',
  unknown: 'Process',
};

// ============================================================================
// Plan Preview Generator Class
// ============================================================================

/**
 * PlanPreviewGenerator - Creates detailed plan previews
 *
 * @example
 * ```typescript
 * const generator = new PlanPreviewGenerator();
 *
 * const preview = generator.generate(plan);
 *
 * console.log(preview.steps[0].number);     // 1
 * console.log(preview.files[0].path);       // 'templates/homepage.xml'
 * console.log(preview.duration.totalFormatted); // '1m 30s'
 * ```
 */
export class PlanPreviewGenerator {
  private config: Required<PlanPreviewConfig>;
  private actionDurations: Record<AgentActionType, number>;
  private actionLabels: Record<AgentActionType, string>;

  constructor(config: PlanPreviewConfig = {}) {
    this.actionDurations = {
      ...DEFAULT_ACTION_DURATIONS,
      ...(config.actionDurations ?? {}),
    };
    this.actionLabels = {
      ...DEFAULT_ACTION_LABELS,
      ...(config.actionLabels ?? {}),
    };
    this.config = {
      actionDurations: this.actionDurations,
      includeFileDetails: config.includeFileDetails ?? true,
      includeDependencies: config.includeDependencies ?? true,
      actionLabels: this.actionLabels,
    };
  }

  // ==========================================================================
  // Main Generation
  // ==========================================================================

  /**
   * Generate preview from AgentPlan
   */
  generate(plan: AgentPlan): PlanPreview {
    // Generate step previews
    const steps = this.generateStepPreviews(plan.steps);

    // Extract and generate file previews
    const files = this.generateFilePreviews(plan.steps, steps);

    // Calculate duration
    const duration = this.calculateDuration(steps);

    // Assess overall risk
    const riskLevel = this.assessRisk(steps, files);

    // Generate summary
    const summary = this.generateSummary(plan, steps, files, duration);

    return {
      planId: plan.id,
      title: plan.goal || plan.id,
      description: plan.goal || `Plan with ${plan.steps.length} steps`,
      steps,
      stepCount: steps.length,
      files,
      fileCount: files.length,
      duration,
      riskLevel,
      generatedAt: new Date(),
      summary,
    };
  }

  /**
   * Generate preview from DesignOption
   */
  generateFromOption(option: DesignOption): PlanPreview {
    const preview = this.generate(option.plan);

    // Enhance with option data
    preview.title = option.name;
    preview.description = option.description;
    preview.riskLevel = option.riskLevel;

    // Add affected files from option if not in plan
    for (const affected of option.filesAffected) {
      const exists = preview.files.some(f => f.path === affected.path);
      if (!exists) {
        preview.files.push(this.createFilePreview(affected.path, affected.changeType, affected.description, []));
      }
    }
    preview.fileCount = preview.files.length;

    return preview;
  }

  // ==========================================================================
  // Step Preview Generation
  // ==========================================================================

  /**
   * Generate numbered step previews
   */
  private generateStepPreviews(steps: AgentPlanStep[]): StepPreview[] {
    return steps.map((step, index) => ({
      number: index + 1,
      id: step.id,
      action: step.action,
      actionLabel: this.actionLabels[step.action] || step.action,
      target: step.target,
      description: step.rationale || `${this.actionLabels[step.action]} on ${step.target}`,
      estimatedDurationSec: this.actionDurations[step.action] || 5,
      status: step.status,
      dependencies: this.config.includeDependencies
        ? this.inferDependencies(step, steps, index)
        : undefined,
      riskLevel: this.assessStepRisk(step),
    }));
  }

  /**
   * Infer step dependencies based on file targets
   */
  private inferDependencies(
    step: AgentPlanStep,
    allSteps: AgentPlanStep[],
    currentIndex: number
  ): string[] {
    const deps: string[] = [];

    // Write/edit operations depend on previous reads of the same file
    if (step.action === 'write_file' || step.action === 'edit_file') {
      for (let i = 0; i < currentIndex; i++) {
        const prevStep = allSteps[i];
        if (prevStep.target === step.target && prevStep.action === 'read_file') {
          deps.push(prevStep.id);
        }
      }
    }

    // Validate depends on previous edits
    if (step.action === 'validate') {
      for (let i = 0; i < currentIndex; i++) {
        const prevStep = allSteps[i];
        if (prevStep.action === 'edit_file' || prevStep.action === 'write_file') {
          deps.push(prevStep.id);
        }
      }
    }

    return deps;
  }

  /**
   * Assess risk level for a single step
   */
  private assessStepRisk(step: AgentPlanStep): 'low' | 'medium' | 'high' {
    // Destructive actions are higher risk
    if (step.action === 'write_file') return 'medium';
    if (step.action === 'edit_file') return 'medium';
    if (step.action === 'execute') return 'high';

    // Read-only actions are low risk
    if (step.action === 'read_file' || step.action === 'search') return 'low';

    return 'low';
  }

  // ==========================================================================
  // File Preview Generation
  // ==========================================================================

  /**
   * Generate file previews from steps
   */
  private generateFilePreviews(
    steps: AgentPlanStep[],
    stepPreviews: StepPreview[]
  ): FilePreview[] {
    const fileMap = new Map<string, FilePreview>();

    for (const stepPreview of stepPreviews) {
      const step = steps.find(s => s.id === stepPreview.id);
      if (!step) continue;

      const target = step.target;
      if (!target || target === 'unknown') continue;

      const changeType = this.actionToChangeType(step.action);
      if (!changeType) continue;

      if (fileMap.has(target)) {
        // Update existing file preview
        const existing = fileMap.get(target)!;
        existing.affectedBySteps.push(stepPreview.number);

        // Upgrade change type if needed
        if (changeType === 'create' || changeType === 'modify') {
          if (existing.changeType === 'read') {
            existing.changeType = changeType;
          }
        }
      } else {
        // Create new file preview
        fileMap.set(
          target,
          this.createFilePreview(
            target,
            changeType,
            stepPreview.description,
            [stepPreview.number]
          )
        );
      }
    }

    return Array.from(fileMap.values());
  }

  /**
   * Create a file preview
   */
  private createFilePreview(
    path: string,
    changeType: 'create' | 'modify' | 'delete' | 'read',
    description: string,
    affectedBySteps: number[]
  ): FilePreview {
    const parts = path.split('/');
    const name = parts.pop() || path;
    const directory = parts.join('/') || '.';
    const extension = name.includes('.') ? name.split('.').pop() || '' : '';

    return {
      path,
      name,
      directory,
      extension,
      changeType,
      description,
      affectedBySteps,
    };
  }

  /**
   * Map action type to file change type
   */
  private actionToChangeType(
    action: AgentActionType
  ): 'create' | 'modify' | 'delete' | 'read' | null {
    switch (action) {
      case 'write_file':
        return 'create';
      case 'edit_file':
        return 'modify';
      case 'read_file':
        return 'read';
      default:
        return null;
    }
  }

  // ==========================================================================
  // Duration Calculation
  // ==========================================================================

  /**
   * Calculate duration estimate
   */
  private calculateDuration(steps: StepPreview[]): DurationEstimate {
    const perStep = steps.map(s => ({
      stepNumber: s.number,
      durationSec: s.estimatedDurationSec,
    }));

    const totalSec = perStep.reduce((sum, s) => sum + s.durationSec, 0);
    const averageStepSec = steps.length > 0 ? totalSec / steps.length : 0;

    // Confidence based on step count
    let confidence: 'low' | 'medium' | 'high';
    if (steps.length <= 3) {
      confidence = 'high';
    } else if (steps.length <= 7) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      totalSec,
      totalFormatted: this.formatDuration(totalSec),
      perStep,
      averageStepSec: Math.round(averageStepSec * 10) / 10,
      confidence,
    };
  }

  /**
   * Format duration as human-readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  }

  // ==========================================================================
  // Risk Assessment
  // ==========================================================================

  /**
   * Assess overall risk level
   */
  private assessRisk(steps: StepPreview[], files: FilePreview[]): 'low' | 'medium' | 'high' {
    // Count high-risk steps
    const highRiskSteps = steps.filter(s => s.riskLevel === 'high').length;
    const mediumRiskSteps = steps.filter(s => s.riskLevel === 'medium').length;

    // Count destructive file changes
    const destructiveChanges = files.filter(
      f => f.changeType === 'create' || f.changeType === 'modify' || f.changeType === 'delete'
    ).length;

    // High risk if any high-risk steps or many destructive changes
    if (highRiskSteps > 0 || destructiveChanges > 5) return 'high';

    // Medium risk if several medium-risk steps
    if (mediumRiskSteps > 2 || destructiveChanges > 2) return 'medium';

    return 'low';
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate text summary
   */
  private generateSummary(
    plan: AgentPlan,
    steps: StepPreview[],
    files: FilePreview[],
    duration: DurationEstimate
  ): string {
    const createCount = files.filter(f => f.changeType === 'create').length;
    const modifyCount = files.filter(f => f.changeType === 'modify').length;
    const readCount = files.filter(f => f.changeType === 'read').length;

    const parts: string[] = [];

    parts.push(`${steps.length} step${steps.length !== 1 ? 's' : ''}`);
    parts.push(`${duration.totalFormatted} estimated`);

    const fileChanges: string[] = [];
    if (createCount > 0) fileChanges.push(`${createCount} new`);
    if (modifyCount > 0) fileChanges.push(`${modifyCount} modified`);
    if (readCount > 0) fileChanges.push(`${readCount} read`);

    if (fileChanges.length > 0) {
      parts.push(`${files.length} file${files.length !== 1 ? 's' : ''} (${fileChanges.join(', ')})`);
    }

    return parts.join(' | ');
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  /**
   * Render preview to text format
   */
  renderText(preview: PlanPreview): string {
    const lines: string[] = [];

    lines.push(`Plan: ${preview.title}`);
    lines.push(`Duration: ${preview.duration.totalFormatted} (${preview.duration.confidence} confidence)`);
    lines.push('');
    lines.push('Steps:');

    for (const step of preview.steps) {
      lines.push(`  ${step.number}. [${step.actionLabel}] ${step.target}`);
      lines.push(`     ${step.description}`);
      lines.push(`     Duration: ${step.estimatedDurationSec}s | Risk: ${step.riskLevel || 'low'}`);
    }

    lines.push('');
    lines.push('Files:');

    for (const file of preview.files) {
      lines.push(`  [${file.changeType.toUpperCase()}] ${file.path}`);
      if (file.linesChanged) {
        lines.push(`     ~${file.linesChanged} lines`);
      }
    }

    lines.push('');
    lines.push(`Summary: ${preview.summary}`);

    return lines.join('\n');
  }

  /**
   * Render preview to markdown format
   */
  renderMarkdown(preview: PlanPreview): string {
    const lines: string[] = [];

    lines.push(`## ${preview.title}`);
    lines.push('');
    lines.push(`**Duration:** ${preview.duration.totalFormatted} (${preview.duration.confidence} confidence)`);
    lines.push(`**Risk:** ${preview.riskLevel}`);
    lines.push('');
    lines.push('### Execution Steps');
    lines.push('');

    for (const step of preview.steps) {
      const riskBadge = step.riskLevel === 'high' ? ' :warning:' : '';
      lines.push(`${step.number}. **${step.actionLabel}** \`${step.target}\`${riskBadge}`);
      lines.push(`   - ${step.description}`);
      lines.push(`   - *Duration: ${step.estimatedDurationSec}s*`);
    }

    lines.push('');
    lines.push('### Affected Files');
    lines.push('');
    lines.push('| File | Change | Steps |');
    lines.push('|------|--------|-------|');

    for (const file of preview.files) {
      const stepsStr = file.affectedBySteps.join(', ');
      lines.push(`| \`${file.path}\` | ${file.changeType} | ${stepsStr} |`);
    }

    lines.push('');
    lines.push(`---`);
    lines.push(`*${preview.summary}*`);

    return lines.join('\n');
  }

  /**
   * Render preview to specified format
   */
  render(preview: PlanPreview, format: PreviewFormat = 'text'): string {
    switch (format) {
      case 'text':
        return this.renderText(preview);
      case 'markdown':
        return this.renderMarkdown(preview);
      case 'json':
        return JSON.stringify(preview, null, 2);
      case 'structured':
        return JSON.stringify(preview);
      default:
        return this.renderText(preview);
    }
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
   * Update action duration estimate
   */
  setActionDuration(action: AgentActionType, durationSec: number): void {
    this.actionDurations[action] = durationSec;
  }

  /**
   * Update action label
   */
  setActionLabel(action: AgentActionType, label: string): void {
    this.actionLabels[action] = label;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new PlanPreviewGenerator instance
 */
export function createPlanPreviewGenerator(
  config?: PlanPreviewConfig
): PlanPreviewGenerator {
  return new PlanPreviewGenerator(config);
}

/**
 * Quick preview generation function
 */
export function generatePlanPreview(
  plan: AgentPlan,
  config?: PlanPreviewConfig
): PlanPreview {
  return new PlanPreviewGenerator(config).generate(plan);
}

/**
 * Quick preview generation from option
 */
export function generateOptionPreview(
  option: DesignOption,
  config?: PlanPreviewConfig
): PlanPreview {
  return new PlanPreviewGenerator(config).generateFromOption(option);
}

// ============================================================================
// Exports
// ============================================================================

export default PlanPreviewGenerator;
