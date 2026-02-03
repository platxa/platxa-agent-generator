/**
 * Context Builder - Mode-specific context preparation
 *
 * Prepares AgentContext based on detected intent mode:
 * - Plan mode: read-only operations (disables write_file, edit_file tools)
 * - Agent mode: full tools enabled (all operations available)
 *
 * @module agentic-core/context-builder
 */

import type { AgentContext } from './agent-engine';
import type { IntentMode, ClassificationResult } from './mode-router';
import { ModeRouter, createModeRouter } from './mode-router';

// ============================================================================
// Types
// ============================================================================

/** Options for context building */
export interface ContextBuilderOptions {
  /** Workspace root path */
  workspaceRoot: string;
  /** Goal/task description */
  goal: string;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** Custom ModeRouter instance */
  modeRouter?: ModeRouter;
  /** Force a specific mode (bypass classification) */
  forceMode?: IntentMode;
}

/** Result from context building */
export interface ContextBuildResult {
  /** Built context */
  context: AgentContext;
  /** Classification result (if classified) */
  classification?: ClassificationResult;
  /** Mode that was applied */
  mode: IntentMode;
  /** Tools that are disabled in this mode */
  disabledTools: string[];
  /** Tools that are enabled in this mode */
  enabledTools: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Tools disabled in plan mode (read-only exploration) */
export const PLAN_MODE_DISABLED_TOOLS = ['write_file', 'edit_file'];

/** All available tools */
export const ALL_TOOLS = [
  'search_codebase',
  'read_file',
  'write_file',
  'edit_file',
  'validate_qweb',
  'compile_scss',
  'preview_render',
  'test_odoo',
  'web_search',
  'inspect_logs',
];

/** Tools available in plan mode (read-only) */
export const PLAN_MODE_TOOLS = ALL_TOOLS.filter(
  tool => !PLAN_MODE_DISABLED_TOOLS.includes(tool)
);

/** Tools available in agent mode (all) */
export const AGENT_MODE_TOOLS = [...ALL_TOOLS];

// ============================================================================
// Context Builder Class
// ============================================================================

/**
 * ContextBuilder - Prepares mode-specific agent context
 *
 * @example
 * ```typescript
 * const builder = new ContextBuilder();
 *
 * // Build context from user message
 * const result = builder.buildFromMessage({
 *   workspaceRoot: '/project',
 *   goal: 'What if we refactored this?',
 * });
 * // result.mode === 'plan'
 * // result.context.planMode === true
 * // result.disabledTools includes 'write_file', 'edit_file'
 *
 * // Build context for agent mode
 * const agentResult = builder.buildFromMessage({
 *   workspaceRoot: '/project',
 *   goal: 'Create a new component',
 * });
 * // agentResult.mode === 'agent'
 * // agentResult.context.planMode === false
 * // agentResult.enabledTools includes all tools
 * ```
 */
export class ContextBuilder {
  private modeRouter: ModeRouter;

  constructor(modeRouter?: ModeRouter) {
    this.modeRouter = modeRouter ?? createModeRouter();
  }

  /**
   * Build context from user message with automatic mode detection
   */
  buildFromMessage(options: ContextBuilderOptions): ContextBuildResult {
    const { workspaceRoot, goal, maxIterations = 5, forceMode } = options;

    // Use forced mode or classify from goal
    let mode: IntentMode;
    let classification: ClassificationResult | undefined;

    if (forceMode) {
      mode = forceMode;
    } else {
      classification = this.modeRouter.classify(goal);
      mode = classification.mode;
    }

    return this.buildForMode(mode, {
      workspaceRoot,
      goal,
      maxIterations,
      classification,
    });
  }

  /**
   * Build context for a specific mode
   */
  buildForMode(
    mode: IntentMode,
    options: {
      workspaceRoot: string;
      goal: string;
      maxIterations?: number;
      classification?: ClassificationResult;
    }
  ): ContextBuildResult {
    const { workspaceRoot, goal, maxIterations = 5, classification } = options;
    const isPlanMode = mode === 'plan';

    const context: AgentContext = {
      workspaceRoot,
      goal,
      iteration: 1,
      maxIterations,
      planMode: isPlanMode,
      filesRead: new Map(),
      searchResults: new Map(),
      userPreferences: {},
      odooContext: {},
    };

    return {
      context,
      classification,
      mode,
      disabledTools: isPlanMode ? PLAN_MODE_DISABLED_TOOLS : [],
      enabledTools: isPlanMode ? PLAN_MODE_TOOLS : AGENT_MODE_TOOLS,
    };
  }

  /**
   * Build plan mode context (read-only, disables write_file and edit_file)
   */
  buildPlanContext(workspaceRoot: string, goal: string, maxIterations = 5): ContextBuildResult {
    return this.buildForMode('plan', { workspaceRoot, goal, maxIterations });
  }

  /**
   * Build agent mode context (full tools enabled)
   */
  buildAgentContext(workspaceRoot: string, goal: string, maxIterations = 5): ContextBuildResult {
    return this.buildForMode('agent', { workspaceRoot, goal, maxIterations });
  }

  /**
   * Check if a tool is enabled for the given mode
   */
  isToolEnabled(tool: string, mode: IntentMode): boolean {
    if (mode === 'plan') {
      return !PLAN_MODE_DISABLED_TOOLS.includes(tool);
    }
    return true; // Agent mode enables all tools
  }

  /**
   * Get list of enabled tools for a mode
   */
  getEnabledTools(mode: IntentMode): string[] {
    return mode === 'plan' ? PLAN_MODE_TOOLS : AGENT_MODE_TOOLS;
  }

  /**
   * Get list of disabled tools for a mode
   */
  getDisabledTools(mode: IntentMode): string[] {
    return mode === 'plan' ? PLAN_MODE_DISABLED_TOOLS : [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ContextBuilder instance
 */
export function createContextBuilder(modeRouter?: ModeRouter): ContextBuilder {
  return new ContextBuilder(modeRouter);
}

/**
 * Quick context build from message
 */
export function buildContextFromMessage(options: ContextBuilderOptions): ContextBuildResult {
  const builder = new ContextBuilder(options.modeRouter);
  return builder.buildFromMessage(options);
}

/**
 * Build plan mode context directly
 */
export function buildPlanContext(workspaceRoot: string, goal: string): ContextBuildResult {
  return new ContextBuilder().buildPlanContext(workspaceRoot, goal);
}

/**
 * Build agent mode context directly
 */
export function buildAgentContext(workspaceRoot: string, goal: string): ContextBuildResult {
  return new ContextBuilder().buildAgentContext(workspaceRoot, goal);
}

// ============================================================================
// Exports
// ============================================================================

export default ContextBuilder;
