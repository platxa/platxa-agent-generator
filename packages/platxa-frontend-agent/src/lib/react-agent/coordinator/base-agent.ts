/**
 * Base Sub-Agent Implementation
 *
 * Provides a base class for creating specialized sub-agents that can be
 * registered with the Coordinator.
 */

import { ReActAgent } from "../agent"
import type { AgentOutput, ActionDefinition } from "../types"
import type {
  CoordinatorTask,
  SubAgent,
  SubAgentCapabilities,
  SubAgentConfig,
  SubAgentStatus,
} from "./types"

/**
 * Base class for creating sub-agents that work with the Coordinator
 *
 * @example
 * ```typescript
 * class DesignAnalyzerAgent extends BaseSubAgent {
 *   constructor() {
 *     super({
 *       id: "design-analyzer",
 *       name: "Design Analyzer",
 *       capabilities: [{
 *         id: "analyze-design",
 *         name: "Design Analysis",
 *         description: "Analyzes UI designs",
 *         tags: ["design", "analysis", "ui"],
 *       }],
 *       maxConcurrency: 3,
 *     })
 *   }
 *
 *   protected getActions(): ActionDefinition[] {
 *     return [analyzeAction, extractAction]
 *   }
 * }
 * ```
 */
export abstract class BaseSubAgent implements SubAgent {
  protected config: SubAgentConfig
  protected status: SubAgentStatus = "idle"
  protected agent: ReActAgent | null = null

  constructor(
    config: Omit<SubAgentConfig, "taskTimeoutMs" | "enabled"> &
      Partial<Pick<SubAgentConfig, "taskTimeoutMs" | "enabled">>
  ) {
    this.config = {
      taskTimeoutMs: 60000,
      enabled: true,
      ...config,
    }
  }

  /**
   * Returns the actions this agent can perform
   * Override in subclass to define agent-specific actions
   */
  protected abstract getActions(): ActionDefinition[]

  /**
   * Gets the agent configuration
   */
  getConfig(): SubAgentConfig {
    return { ...this.config }
  }

  /**
   * Gets the current status
   */
  getStatus(): SubAgentStatus {
    return this.status
  }

  /**
   * Checks if this agent can handle a given task
   */
  canHandle(task: CoordinatorTask): boolean {
    if (!this.config.enabled) {
      return false
    }

    // If no required capabilities specified, agent can handle it
    if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) {
      return true
    }

    // Check if agent has any of the required capabilities
    const agentCapabilities = new Set(
      this.config.capabilities.flatMap((c) => [c.id, ...c.tags])
    )

    return task.requiredCapabilities.some((cap) => agentCapabilities.has(cap))
  }

  /**
   * Executes a task
   */
  async execute(task: CoordinatorTask): Promise<AgentOutput> {
    this.status = "busy"

    try {
      // Create or reuse the ReAct agent
      if (!this.agent) {
        this.agent = new ReActAgent({
          actions: this.getActions(),
          maxIterations: 10,
          stepTimeoutMs: this.config.taskTimeoutMs,
          verbose: false,
        })
      }

      // Execute the task using the ReAct agent
      const result = await this.agent.run({
        task: task.payload.task,
        context: {
          ...task.payload.context,
          taskId: task.id,
          taskType: task.type,
          priority: task.priority,
        },
      })

      this.status = result.success ? "idle" : "failed"
      return result

    } catch (error) {
      this.status = "failed"
      throw error
    }
  }

  /**
   * Enables the agent
   */
  enable(): void {
    this.config.enabled = true
    this.status = "idle"
  }

  /**
   * Disables the agent
   */
  disable(): void {
    this.config.enabled = false
    this.status = "unavailable"
  }
}

/**
 * Creates a simple sub-agent from configuration and actions
 *
 * @example
 * ```typescript
 * const codeGenAgent = createSubAgent({
 *   id: "code-generator",
 *   name: "Code Generator",
 *   capabilities: [{
 *     id: "generate-code",
 *     name: "Code Generation",
 *     description: "Generates code from specifications",
 *     tags: ["code", "generation"],
 *   }],
 *   maxConcurrency: 2,
 *   actions: [generateAction, validateAction],
 * })
 * ```
 */
export function createSubAgent(
  config: Omit<SubAgentConfig, "taskTimeoutMs" | "enabled"> &
    Partial<Pick<SubAgentConfig, "taskTimeoutMs" | "enabled">> & {
      actions: ActionDefinition[]
    }
): SubAgent {
  const { actions, ...agentConfig } = config

  return new (class extends BaseSubAgent {
    constructor() {
      super(agentConfig)
    }

    protected getActions(): ActionDefinition[] {
      return actions
    }
  })()
}

/**
 * Creates a capability definition
 */
export function createCapability(
  id: string,
  name: string,
  description: string,
  tags: string[] = [],
  weight?: number
): SubAgentCapabilities {
  return { id, name, description, tags, weight }
}

/**
 * Pre-built capability definitions for common use cases
 */
export const CommonCapabilities = {
  /** Design analysis capability */
  DESIGN_ANALYSIS: createCapability(
    "design-analysis",
    "Design Analysis",
    "Analyzes UI/UX designs and extracts requirements",
    ["design", "analysis", "ui", "ux"],
    1.0
  ),

  /** Code generation capability */
  CODE_GENERATION: createCapability(
    "code-generation",
    "Code Generation",
    "Generates source code from specifications",
    ["code", "generation", "implementation"],
    1.0
  ),

  /** Testing capability */
  TESTING: createCapability(
    "testing",
    "Testing",
    "Creates and runs tests",
    ["test", "testing", "quality", "validation"],
    1.0
  ),

  /** Documentation capability */
  DOCUMENTATION: createCapability(
    "documentation",
    "Documentation",
    "Generates documentation and comments",
    ["docs", "documentation", "comments"],
    0.8
  ),

  /** Review capability */
  CODE_REVIEW: createCapability(
    "code-review",
    "Code Review",
    "Reviews code for quality and issues",
    ["review", "quality", "analysis"],
    0.9
  ),

  /** Accessibility capability */
  ACCESSIBILITY: createCapability(
    "accessibility",
    "Accessibility",
    "Ensures accessibility compliance",
    ["a11y", "accessibility", "wcag"],
    0.9
  ),

  /** Animation capability */
  ANIMATION: createCapability(
    "animation",
    "Animation",
    "Creates animations and transitions",
    ["animation", "motion", "transition"],
    0.8
  ),

  /** Theming capability */
  THEMING: createCapability(
    "theming",
    "Theming",
    "Manages themes and design tokens",
    ["theme", "styling", "design-tokens"],
    0.8
  ),
}
