/**
 * ReAct Agent Framework - Core Agent Implementation
 *
 * Implements the ReAct (Reasoning and Acting) pattern where agents
 * alternate between reasoning steps and action steps in a loop.
 *
 * The agent follows this cycle:
 * 1. REASON: Analyze the current situation and decide next action
 * 2. ACT: Execute the chosen action
 * 3. OBSERVE: Process the action's result
 * 4. Repeat until task is complete or max iterations reached
 */

import type {
  ActionDefinition,
  ActionResult,
  AgentConfig,
  AgentEvent,
  AgentEventCallback,
  AgentHooks,
  AgentInput,
  AgentOutput,
  AgentState,
  AgentStatus,
  Observation,
  ReasoningEngine,
  ReasoningResult,
  Step,
} from "./types"

/**
 * Default configuration for the ReAct agent
 */
const DEFAULT_CONFIG: Partial<AgentConfig> = {
  maxIterations: 10,
  stepTimeoutMs: 30000,
  minConfidenceThreshold: 0.3,
  verbose: false,
  humanInTheLoop: false,
}

/**
 * Base ReAct Agent class
 *
 * Provides the core reasoning-action loop with extensible hooks
 * for customization.
 *
 * @example
 * ```typescript
 * const agent = new ReActAgent({
 *   maxIterations: 5,
 *   actions: [searchAction, writeAction],
 *   verbose: true,
 * })
 *
 * const result = await agent.run({
 *   task: "Find and summarize the latest news about AI",
 * })
 * ```
 */
export class ReActAgent {
  protected config: AgentConfig
  protected state: AgentState
  protected hooks: AgentHooks
  protected reasoningEngine: ReasoningEngine | null = null
  protected eventCallbacks: AgentEventCallback[] = []

  constructor(config: Partial<AgentConfig> & { actions: ActionDefinition[] }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as AgentConfig
    this.state = this.createInitialState()
    this.hooks = {}
  }

  /**
   * Creates the initial agent state
   */
  protected createInitialState(): AgentState {
    return {
      status: "idle",
      currentStep: 0,
      steps: [],
      context: {},
      startTime: 0,
    }
  }

  /**
   * Resets the agent state for a new run
   */
  protected resetState(): void {
    this.state = this.createInitialState()
  }

  /**
   * Sets a custom reasoning engine
   */
  setReasoningEngine(engine: ReasoningEngine): void {
    this.reasoningEngine = engine
  }

  /**
   * Sets hooks for extending agent behavior
   */
  setHooks(hooks: AgentHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Subscribes to agent events
   */
  on(callback: AgentEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emits an event to all subscribers
   */
  protected emit(
    type: AgentEvent["type"],
    step?: Step
  ): void {
    const event: AgentEvent = {
      type,
      step,
      state: { ...this.state },
      timestamp: Date.now(),
    }

    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (error) {
        if (this.config.verbose) {
          console.error("Error in event callback:", error)
        }
      }
    }
  }

  /**
   * Updates the agent status
   */
  protected setStatus(status: AgentStatus): void {
    this.state.status = status
  }

  /**
   * Performs a reasoning step
   *
   * Analyzes the current context and observations to determine
   * the next action to take.
   */
  protected async reason(
    task: string,
    observations: Observation[]
  ): Promise<ReasoningResult> {
    this.setStatus("reasoning")

    // Call beforeReasoning hook
    if (this.hooks.beforeReasoning) {
      await this.hooks.beforeReasoning(this.state)
    }

    let result: ReasoningResult

    if (this.reasoningEngine) {
      // Use custom reasoning engine
      result = await this.reasoningEngine.reason(
        task,
        observations,
        this.state.context,
        this.config.actions
      )
    } else {
      // Default reasoning implementation
      result = await this.defaultReason(task, observations)
    }

    // Call afterReasoning hook
    if (this.hooks.afterReasoning) {
      await this.hooks.afterReasoning(result, this.state)
    }

    // Record reasoning step
    const step: Step = {
      type: "reasoning",
      content: result,
      timestamp: Date.now(),
      stepNumber: this.state.currentStep,
    }
    this.state.steps.push(step)
    this.emit("reasoning", step)

    return result
  }

  /**
   * Default reasoning implementation
   *
   * Can be overridden by setting a custom ReasoningEngine
   * or by subclassing ReActAgent.
   */
  protected async defaultReason(
    task: string,
    observations: Observation[]
  ): Promise<ReasoningResult> {
    // Analyze observations to determine completion
    const lastObservation = observations[observations.length - 1]

    // Check if task appears complete
    if (lastObservation?.result.success) {
      const hasMoreWork = this.analyzeIfMoreWorkNeeded(task, observations)
      if (!hasMoreWork) {
        return {
          thought: `Task "${task}" has been completed successfully based on observations.`,
          nextAction: null,
          confidence: 0.9,
          shouldContinue: false,
        }
      }
    }

    // Determine next action based on available actions
    const nextAction = this.selectNextAction(task, observations)

    return {
      thought: `Analyzing task "${task}". Based on ${observations.length} observations, the next step is to execute "${nextAction}".`,
      nextAction,
      confidence: 0.7,
      shouldContinue: true,
    }
  }

  /**
   * Analyzes observations to determine if more work is needed
   */
  protected analyzeIfMoreWorkNeeded(
    _task: string,
    observations: Observation[]
  ): boolean {
    // Simple heuristic: if we have successful observations, task might be done
    const successfulObservations = observations.filter(
      (obs) => obs.result.success
    )
    return successfulObservations.length < this.config.actions.length
  }

  /**
   * Selects the next action to execute based on task and observations
   */
  protected selectNextAction(
    _task: string,
    observations: Observation[]
  ): string {
    // Get actions that haven't been executed yet
    const executedActions = new Set(observations.map((obs) => obs.actionName))
    const availableActions = this.config.actions.filter(
      (action) => !executedActions.has(action.name)
    )

    if (availableActions.length > 0) {
      return availableActions[0].name
    }

    // If all actions have been tried, return the first action
    return this.config.actions[0]?.name ?? ""
  }

  /**
   * Executes an action
   */
  protected async act(
    actionName: string,
    params: Record<string, unknown> = {}
  ): Promise<ActionResult> {
    this.setStatus("acting")

    // Find the action definition
    const action = this.config.actions.find((a) => a.name === actionName)
    if (!action) {
      return {
        success: false,
        output: null,
        error: `Action "${actionName}" not found`,
      }
    }

    // Call beforeAction hook
    if (this.hooks.beforeAction) {
      const shouldProceed = await this.hooks.beforeAction(
        action,
        params,
        this.state
      )
      if (!shouldProceed) {
        return {
          success: false,
          output: null,
          error: "Action blocked by beforeAction hook",
        }
      }
    }

    // Execute action with timeout
    let result: ActionResult
    try {
      result = await this.executeWithTimeout(
        action.execute(params),
        this.config.stepTimeoutMs
      )
    } catch (error) {
      result = {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // Record action step
    const step: Step = {
      type: "action",
      content: result,
      timestamp: Date.now(),
      stepNumber: this.state.currentStep,
    }
    this.state.steps.push(step)
    this.emit("action", step)

    // Call afterAction hook
    if (this.hooks.afterAction) {
      await this.hooks.afterAction(result, this.state)
    }

    return result
  }

  /**
   * Creates an observation from an action result
   */
  protected observe(actionName: string, result: ActionResult): Observation {
    this.setStatus("observing")

    const observation: Observation = {
      actionName,
      result,
      timestamp: Date.now(),
      stepNumber: this.state.currentStep,
    }

    // Record observation step
    const step: Step = {
      type: "observation",
      content: observation,
      timestamp: Date.now(),
      stepNumber: this.state.currentStep,
    }
    this.state.steps.push(step)
    this.emit("observation", step)

    return observation
  }

  /**
   * Executes a promise with a timeout
   */
  protected async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ])
  }

  /**
   * Main execution loop - runs the ReAct cycle
   */
  async run(input: AgentInput): Promise<AgentOutput> {
    this.resetState()
    this.state.startTime = Date.now()
    this.state.context = input.context ?? {}

    const observations: Observation[] = []
    let iteration = 0
    let finalResult: unknown = null

    try {
      while (iteration < this.config.maxIterations) {
        this.state.currentStep = iteration
        this.emit("step_start")

        // REASON: Analyze and decide next action
        const reasoning = await this.reason(input.task, observations)

        if (this.config.verbose) {
          console.log(`[Step ${iteration}] Reasoning:`, reasoning.thought)
        }

        // Check if reasoning indicates completion
        if (!reasoning.shouldContinue || reasoning.nextAction === null) {
          finalResult = this.extractFinalResult(observations)
          break
        }

        // Check confidence threshold
        if (reasoning.confidence < this.config.minConfidenceThreshold) {
          if (this.config.verbose) {
            console.log(
              `[Step ${iteration}] Low confidence (${reasoning.confidence}), pausing for review`
            )
          }
          if (this.config.humanInTheLoop) {
            this.setStatus("paused")
            this.emit("paused")
            // In a real implementation, this would wait for human input
          }
        }

        // ACT: Execute the chosen action
        const actionResult = await this.act(reasoning.nextAction)

        if (this.config.verbose) {
          console.log(
            `[Step ${iteration}] Action "${reasoning.nextAction}":`,
            actionResult.success ? "Success" : `Failed: ${actionResult.error}`
          )
        }

        // OBSERVE: Process the result
        const observation = this.observe(reasoning.nextAction, actionResult)
        observations.push(observation)

        this.emit("step_complete")
        iteration++
      }

      // Determine final success
      const success =
        observations.length > 0 &&
        observations.some((obs) => obs.result.success)

      this.state.endTime = Date.now()
      this.setStatus("completed")

      const output: AgentOutput = {
        success,
        result: finalResult,
        reasoning: this.summarizeReasoning(),
        steps: this.state.steps,
        totalSteps: iteration,
        executionTimeMs: this.state.endTime - this.state.startTime,
      }

      this.emit("complete")

      // Call onComplete hook
      if (this.hooks.onComplete) {
        await this.hooks.onComplete(output)
      }

      return output
    } catch (error) {
      this.state.endTime = Date.now()
      this.setStatus("failed")
      this.state.error =
        error instanceof Error ? error.message : String(error)

      // Call onError hook
      if (this.hooks.onError) {
        await this.hooks.onError(
          error instanceof Error ? error : new Error(String(error)),
          this.state
        )
      }

      this.emit("error")

      return {
        success: false,
        result: null,
        reasoning: `Agent failed: ${this.state.error}`,
        steps: this.state.steps,
        totalSteps: iteration,
        executionTimeMs: this.state.endTime - this.state.startTime,
        metadata: { error: this.state.error },
      }
    }
  }

  /**
   * Extracts the final result from observations
   */
  protected extractFinalResult(observations: Observation[]): unknown {
    // Get the last successful observation's output
    const successfulObs = observations
      .filter((obs) => obs.result.success)
      .sort((a, b) => b.timestamp - a.timestamp)

    return successfulObs[0]?.result.output ?? null
  }

  /**
   * Summarizes the reasoning steps for the final output
   */
  protected summarizeReasoning(): string {
    const reasoningSteps = this.state.steps
      .filter((step) => step.type === "reasoning")
      .map((step) => (step.content as ReasoningResult).thought)

    return reasoningSteps.join(" → ")
  }

  /**
   * Gets the current agent state
   */
  getState(): Readonly<AgentState> {
    return { ...this.state }
  }

  /**
   * Gets the agent configuration
   */
  getConfig(): Readonly<AgentConfig> {
    return { ...this.config }
  }

  /**
   * Pauses the agent execution (for human-in-the-loop scenarios)
   */
  pause(): void {
    this.setStatus("paused")
    this.emit("paused")
  }

  /**
   * Resumes paused agent execution
   */
  resume(): void {
    if (this.state.status === "paused") {
      this.setStatus("reasoning")
    }
  }
}

/**
 * Creates a simple action definition
 *
 * @example
 * ```typescript
 * const searchAction = createAction({
 *   name: "search",
 *   description: "Search for information",
 *   parameters: {
 *     query: { type: "string", description: "Search query", required: true },
 *   },
 *   execute: async (params) => {
 *     const results = await performSearch(params.query as string)
 *     return { success: true, output: results }
 *   },
 * })
 * ```
 */
export function createAction(
  definition: ActionDefinition
): ActionDefinition {
  return definition
}

/**
 * Creates an agent with a fluent builder API
 *
 * @example
 * ```typescript
 * const agent = createAgent()
 *   .withAction(searchAction)
 *   .withAction(writeAction)
 *   .withConfig({ maxIterations: 5 })
 *   .withHooks({ onComplete: async (output) => console.log(output) })
 *   .build()
 * ```
 */
export function createAgent(): AgentBuilder {
  return new AgentBuilder()
}

/**
 * Builder class for creating ReActAgent instances
 */
class AgentBuilder {
  private actions: ActionDefinition[] = []
  private config: Partial<AgentConfig> = {}
  private hooks: AgentHooks = {}
  private reasoningEngine: ReasoningEngine | null = null

  /**
   * Adds an action to the agent
   */
  withAction(action: ActionDefinition): AgentBuilder {
    this.actions.push(action)
    return this
  }

  /**
   * Adds multiple actions to the agent
   */
  withActions(actions: ActionDefinition[]): AgentBuilder {
    this.actions.push(...actions)
    return this
  }

  /**
   * Sets agent configuration
   */
  withConfig(config: Partial<AgentConfig>): AgentBuilder {
    this.config = { ...this.config, ...config }
    return this
  }

  /**
   * Sets agent hooks
   */
  withHooks(hooks: AgentHooks): AgentBuilder {
    this.hooks = { ...this.hooks, ...hooks }
    return this
  }

  /**
   * Sets a custom reasoning engine
   */
  withReasoningEngine(engine: ReasoningEngine): AgentBuilder {
    this.reasoningEngine = engine
    return this
  }

  /**
   * Builds the agent instance
   */
  build(): ReActAgent {
    if (this.actions.length === 0) {
      throw new Error("At least one action is required to build an agent")
    }

    const agent = new ReActAgent({
      ...this.config,
      actions: this.actions,
    })

    agent.setHooks(this.hooks)

    if (this.reasoningEngine) {
      agent.setReasoningEngine(this.reasoningEngine)
    }

    return agent
  }
}
