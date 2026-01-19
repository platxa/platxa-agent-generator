/**
 * Multi-Agent Coordinator - Core Implementation
 *
 * Implements the orchestrator-workers pattern where a central coordinator
 * dispatches tasks to specialized sub-agents and aggregates their results.
 *
 * Features:
 * - Task routing with multiple strategies
 * - Load balancing across agents
 * - Result aggregation
 * - Task queuing and prioritization
 * - Retry handling
 * - Event-driven architecture
 */

import type {
  AggregatedResult,
  AggregationStrategy,
  CoordinatorConfig,
  CoordinatorEvent,
  CoordinatorEventCallback,
  CoordinatorEventType,
  CoordinatorHooks,
  CoordinatorState,
  CoordinatorTask,
  DistributionStrategy,
  ResultAggregator,
  SubAgent,
  SubAgentResult,
  SubAgentState,
  SubAgentStatus,
  TaskRouter,
} from "./types"

/**
 * Default coordinator configuration
 */
const DEFAULT_CONFIG: Partial<CoordinatorConfig> = {
  distributionStrategy: "capability-match",
  aggregationStrategy: "merge",
  maxGlobalConcurrency: 10,
  defaultTaskTimeoutMs: 60000,
  maxRetries: 2,
  enableQueuing: true,
  maxQueueSize: 100,
  verbose: false,
}

/**
 * Generates a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Multi-Agent Coordinator
 *
 * Manages a pool of specialized sub-agents, routing tasks to appropriate
 * agents and aggregating their results.
 *
 * @example
 * ```typescript
 * const coordinator = new Coordinator({
 *   id: "ui-coordinator",
 *   name: "UI Generation Coordinator",
 *   distributionStrategy: "capability-match",
 * })
 *
 * coordinator.registerAgent(designAgent)
 * coordinator.registerAgent(codeGenAgent)
 * coordinator.registerAgent(testAgent)
 *
 * const result = await coordinator.dispatch({
 *   type: "generate-component",
 *   payload: { task: "Create a button component" },
 * })
 * ```
 */
export class Coordinator {
  protected config: CoordinatorConfig
  protected state: CoordinatorState
  protected hooks: CoordinatorHooks
  protected agents: Map<string, SubAgent>
  protected eventCallbacks: CoordinatorEventCallback[]

  constructor(config: Partial<CoordinatorConfig> & { id: string; name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CoordinatorConfig
    this.state = this.createInitialState()
    this.hooks = {}
    this.agents = new Map()
    this.eventCallbacks = []
  }

  /**
   * Creates the initial coordinator state
   */
  protected createInitialState(): CoordinatorState {
    return {
      status: "idle",
      agents: new Map(),
      taskQueue: [],
      activeTasks: new Map(),
      completedResults: [],
      startTime: 0,
      totalProcessed: 0,
    }
  }

  /**
   * Registers a sub-agent with the coordinator
   */
  registerAgent(agent: SubAgent): void {
    const config = agent.getConfig()

    if (this.agents.has(config.id)) {
      throw new Error(`Agent with ID "${config.id}" is already registered`)
    }

    this.agents.set(config.id, agent)

    const agentState: SubAgentState = {
      config,
      status: "idle",
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastActivity: Date.now(),
      currentTaskIds: [],
    }

    this.state.agents.set(config.id, agentState)
    this.emit("agent_registered", { agentId: config.id })

    if (this.config.verbose) {
      console.log(`[Coordinator] Registered agent: ${config.name} (${config.id})`)
    }
  }

  /**
   * Unregisters a sub-agent from the coordinator
   */
  unregisterAgent(agentId: string): void {
    const agentState = this.state.agents.get(agentId)

    if (!agentState) {
      throw new Error(`Agent with ID "${agentId}" is not registered`)
    }

    if (agentState.activeTasks > 0) {
      throw new Error(`Cannot unregister agent "${agentId}" with active tasks`)
    }

    this.agents.delete(agentId)
    this.state.agents.delete(agentId)
    this.emit("agent_unregistered", { agentId })

    if (this.config.verbose) {
      console.log(`[Coordinator] Unregistered agent: ${agentId}`)
    }
  }

  /**
   * Sets hooks for extending coordinator behavior
   */
  setHooks(hooks: CoordinatorHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Subscribes to coordinator events
   */
  on(callback: CoordinatorEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emits a coordinator event
   */
  protected emit(
    type: CoordinatorEventType,
    data: CoordinatorEvent["data"] = {}
  ): void {
    const event: CoordinatorEvent = {
      type,
      timestamp: Date.now(),
      data,
    }

    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (error) {
        if (this.config.verbose) {
          console.error("[Coordinator] Error in event callback:", error)
        }
      }
    }
  }

  /**
   * Dispatches a single task to the appropriate agent
   */
  async dispatch(
    taskInput: Omit<CoordinatorTask, "id" | "createdAt" | "retryCount">
  ): Promise<SubAgentResult> {
    const task: CoordinatorTask = {
      ...taskInput,
      id: generateTaskId(),
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: taskInput.maxRetries ?? this.config.maxRetries,
    }

    return this.processTask(task)
  }

  /**
   * Dispatches multiple tasks and aggregates results
   */
  async dispatchBatch(
    tasks: Array<Omit<CoordinatorTask, "id" | "createdAt" | "retryCount">>
  ): Promise<AggregatedResult> {
    const fullTasks: CoordinatorTask[] = tasks.map((t) => ({
      ...t,
      id: generateTaskId(),
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: t.maxRetries ?? this.config.maxRetries,
    }))

    // Execute tasks based on concurrency limits
    const results: SubAgentResult[] = []
    const batches = this.createBatches(fullTasks, this.config.maxGlobalConcurrency)

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((task) => this.processTask(task))
      )
      results.push(...batchResults)
    }

    // Aggregate results
    return this.aggregateResults(results)
  }

  /**
   * Processes a single task
   */
  protected async processTask(task: CoordinatorTask): Promise<SubAgentResult> {
    // Call beforeRoute hook
    if (this.hooks.beforeRoute) {
      await this.hooks.beforeRoute(task, this.getAvailableAgents())
    }

    // Route task to appropriate agent
    const agentId = this.routeTask(task)

    // Call afterRoute hook
    if (this.hooks.afterRoute) {
      await this.hooks.afterRoute(task, agentId)
    }

    if (!agentId) {
      // Check if ANY registered agent could handle this task (not just available ones)
      const anyAgentCanHandle = this.canAnyAgentHandle(task)

      // Only queue if some agent exists that can handle it (just temporarily busy)
      if (anyAgentCanHandle && this.config.enableQueuing && this.state.taskQueue.length < this.config.maxQueueSize) {
        this.state.taskQueue.push(task)
        this.emit("task_queued", { taskId: task.id, task })

        // Wait for agent to become available (simplified)
        return this.waitForAgent(task)
      }

      return {
        taskId: task.id,
        agentId: "",
        success: false,
        output: {
          success: false,
          result: null,
          reasoning: "No available agent to handle task",
          steps: [],
          totalSteps: 0,
          executionTimeMs: 0,
        },
        executionTimeMs: 0,
        error: "No available agent to handle task",
      }
    }

    // Execute task
    return this.executeTask(task, agentId)
  }

  /**
   * Routes a task to the appropriate agent based on distribution strategy
   */
  protected routeTask(task: CoordinatorTask): string | null {
    // Use custom router if provided
    if (this.config.customRouter) {
      return this.config.customRouter.route(task, this.getAvailableAgents())
    }

    const availableAgents = this.getAvailableAgents()

    if (availableAgents.length === 0) {
      return null
    }

    // Check for preferred agent
    if (task.preferredAgentId) {
      const preferred = availableAgents.find(
        (a) => a.config.id === task.preferredAgentId
      )
      if (preferred) {
        return preferred.config.id
      }
    }

    // Apply distribution strategy
    switch (this.config.distributionStrategy) {
      case "round-robin":
        return this.routeRoundRobin(availableAgents)
      case "least-busy":
        return this.routeLeastBusy(availableAgents)
      case "capability-match":
        return this.routeByCapability(task, availableAgents)
      case "priority-based":
        return this.routeByPriority(task, availableAgents)
      case "random":
        return this.routeRandom(availableAgents)
      default:
        return availableAgents[0]?.config.id ?? null
    }
  }

  /**
   * Round-robin distribution
   */
  protected routeRoundRobin(agents: SubAgentState[]): string {
    // Simple round-robin based on completed tasks
    const sorted = [...agents].sort(
      (a, b) => a.completedTasks - b.completedTasks
    )
    return sorted[0].config.id
  }

  /**
   * Least-busy distribution
   */
  protected routeLeastBusy(agents: SubAgentState[]): string {
    const sorted = [...agents].sort((a, b) => a.activeTasks - b.activeTasks)
    return sorted[0].config.id
  }

  /**
   * Capability-based routing
   */
  protected routeByCapability(
    task: CoordinatorTask,
    agents: SubAgentState[]
  ): string | null {
    if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) {
      return this.routeLeastBusy(agents)
    }

    // Find agents with matching capabilities
    const matchingAgents = agents.filter((agent) => {
      const agentCapabilities = new Set(
        agent.config.capabilities.flatMap((c) => [c.id, ...c.tags])
      )
      return task.requiredCapabilities!.some((cap) => agentCapabilities.has(cap))
    })

    if (matchingAgents.length === 0) {
      return null
    }

    // Sort by capability weight and select best match
    const scored = matchingAgents.map((agent) => {
      const matchedCaps = agent.config.capabilities.filter((cap) =>
        task.requiredCapabilities!.some(
          (req) => cap.id === req || cap.tags.includes(req)
        )
      )
      const score = matchedCaps.reduce((sum, cap) => sum + (cap.weight ?? 1), 0)
      return { agent, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0].agent.config.id
  }

  /**
   * Priority-based routing (high priority gets dedicated agents)
   */
  protected routeByPriority(
    task: CoordinatorTask,
    agents: SubAgentState[]
  ): string {
    if (task.priority === "critical" || task.priority === "high") {
      // For high priority, prefer idle agents
      const idle = agents.filter((a) => a.activeTasks === 0)
      if (idle.length > 0) {
        return idle[0].config.id
      }
    }
    return this.routeLeastBusy(agents)
  }

  /**
   * Random distribution
   */
  protected routeRandom(agents: SubAgentState[]): string {
    const index = Math.floor(Math.random() * agents.length)
    return agents[index].config.id
  }

  /**
   * Gets available agents that can accept new tasks
   */
  protected getAvailableAgents(): SubAgentState[] {
    const available: SubAgentState[] = []

    for (const [, state] of this.state.agents) {
      if (
        state.config.enabled &&
        state.status !== "unavailable" &&
        state.activeTasks < state.config.maxConcurrency
      ) {
        available.push(state)
      }
    }

    return available
  }

  /**
   * Checks if any registered agent can handle the task (regardless of availability)
   */
  protected canAnyAgentHandle(task: CoordinatorTask): boolean {
    for (const [, agent] of this.agents) {
      if (agent.canHandle(task)) {
        return true
      }
    }
    return false
  }

  /**
   * Executes a task on a specific agent
   */
  protected async executeTask(
    task: CoordinatorTask,
    agentId: string
  ): Promise<SubAgentResult> {
    const agent = this.agents.get(agentId)
    const agentState = this.state.agents.get(agentId)

    if (!agent || !agentState) {
      return {
        taskId: task.id,
        agentId,
        success: false,
        output: {
          success: false,
          result: null,
          reasoning: `Agent "${agentId}" not found`,
          steps: [],
          totalSteps: 0,
          executionTimeMs: 0,
        },
        executionTimeMs: 0,
        error: `Agent "${agentId}" not found`,
      }
    }

    // Call beforeExecute hook
    if (this.hooks.beforeExecute) {
      const shouldProceed = await this.hooks.beforeExecute(task, agentId)
      if (!shouldProceed) {
        return {
          taskId: task.id,
          agentId,
          success: false,
          output: {
            success: false,
            result: null,
            reasoning: "Execution blocked by beforeExecute hook",
            steps: [],
            totalSteps: 0,
            executionTimeMs: 0,
          },
          executionTimeMs: 0,
          error: "Execution blocked by beforeExecute hook",
        }
      }
    }

    // Update agent state
    this.updateAgentStatus(agentId, "busy")
    agentState.activeTasks++
    agentState.currentTaskIds.push(task.id)
    this.state.activeTasks.set(task.id, { task, agentId })

    this.emit("task_started", { taskId: task.id, agentId, task })

    const startTime = Date.now()
    let result: SubAgentResult

    try {
      // Execute with timeout
      const output = await this.executeWithTimeout(
        agent.execute(task),
        task.payload.context?.timeout as number ?? this.config.defaultTaskTimeoutMs
      )

      result = {
        taskId: task.id,
        agentId,
        success: output.success,
        output,
        executionTimeMs: Date.now() - startTime,
      }

      agentState.completedTasks++
      this.emit("task_completed", { taskId: task.id, agentId, result })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      result = {
        taskId: task.id,
        agentId,
        success: false,
        output: {
          success: false,
          result: null,
          reasoning: `Execution failed: ${errorMessage}`,
          steps: [],
          totalSteps: 0,
          executionTimeMs: Date.now() - startTime,
        },
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
      }

      agentState.failedTasks++
      this.emit("task_failed", { taskId: task.id, agentId, result, error: errorMessage })

      // Handle retry
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        this.emit("task_retried", { taskId: task.id, agentId })

        // Clean up current execution state before retry
        agentState.activeTasks--
        agentState.currentTaskIds = agentState.currentTaskIds.filter(
          (id) => id !== task.id
        )
        this.state.activeTasks.delete(task.id)
        this.updateAgentStatusIfIdle(agentId)

        // Retry the task
        return this.processTask(task)
      }

      // Call onError hook
      if (this.hooks.onError) {
        await this.hooks.onError(
          error instanceof Error ? error : new Error(errorMessage),
          { taskId: task.id, agentId }
        )
      }
    }

    // Update agent state
    agentState.activeTasks--
    agentState.currentTaskIds = agentState.currentTaskIds.filter(
      (id) => id !== task.id
    )
    agentState.lastActivity = Date.now()
    this.state.activeTasks.delete(task.id)
    this.state.completedResults.push(result)
    this.state.totalProcessed++
    this.updateAgentStatusIfIdle(agentId)

    // Call afterExecute hook
    if (this.hooks.afterExecute) {
      await this.hooks.afterExecute(result)
    }

    // Process queued tasks
    this.processQueue()

    return result
  }

  /**
   * Waits for an agent to become available (simplified implementation)
   */
  protected async waitForAgent(task: CoordinatorTask): Promise<SubAgentResult> {
    // In a real implementation, this would use proper async waiting
    // For now, we'll just return a queued status
    return {
      taskId: task.id,
      agentId: "",
      success: false,
      output: {
        success: false,
        result: null,
        reasoning: "Task queued - waiting for available agent",
        steps: [],
        totalSteps: 0,
        executionTimeMs: 0,
      },
      executionTimeMs: 0,
      error: "Task queued",
      metadata: { queued: true, queuePosition: this.state.taskQueue.length },
    }
  }

  /**
   * Processes tasks from the queue
   */
  protected processQueue(): void {
    if (this.state.taskQueue.length === 0) {
      return
    }

    const availableAgents = this.getAvailableAgents()
    if (availableAgents.length === 0) {
      return
    }

    // Process as many queued tasks as possible
    while (this.state.taskQueue.length > 0 && this.getAvailableAgents().length > 0) {
      const task = this.state.taskQueue.shift()
      if (task) {
        // Fire and forget - results will be handled by the task processing
        this.processTask(task).catch((error) => {
          if (this.config.verbose) {
            console.error("[Coordinator] Error processing queued task:", error)
          }
        })
      }
    }
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
          () => reject(new Error(`Task timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ])
  }

  /**
   * Updates an agent's status
   */
  protected updateAgentStatus(agentId: string, status: SubAgentStatus): void {
    const agentState = this.state.agents.get(agentId)
    if (agentState && agentState.status !== status) {
      const previousStatus = agentState.status
      agentState.status = status
      this.emit("agent_status_changed", {
        agentId,
        previousStatus,
        newStatus: status,
      })
    }
  }

  /**
   * Updates agent status to idle if no active tasks
   */
  protected updateAgentStatusIfIdle(agentId: string): void {
    const agentState = this.state.agents.get(agentId)
    if (agentState && agentState.activeTasks === 0) {
      this.updateAgentStatus(agentId, "idle")
    }
  }

  /**
   * Aggregates results from multiple agents
   */
  protected async aggregateResults(
    results: SubAgentResult[]
  ): Promise<AggregatedResult> {
    // Call beforeAggregate hook
    if (this.hooks.beforeAggregate) {
      await this.hooks.beforeAggregate(results)
    }

    let aggregatedResult: AggregatedResult

    // Use custom aggregator if provided
    if (this.config.customAggregator) {
      aggregatedResult = this.config.customAggregator.aggregate(results)
    } else {
      aggregatedResult = this.applyAggregationStrategy(results)
    }

    this.emit("aggregation_complete", { aggregatedResult })

    // Call afterAggregate hook
    if (this.hooks.afterAggregate) {
      await this.hooks.afterAggregate(aggregatedResult)
    }

    return aggregatedResult
  }

  /**
   * Applies the configured aggregation strategy
   */
  protected applyAggregationStrategy(
    results: SubAgentResult[]
  ): AggregatedResult {
    const stats = {
      totalTasks: results.length,
      successfulTasks: results.filter((r) => r.success).length,
      failedTasks: results.filter((r) => !r.success).length,
      averageExecutionTimeMs:
        results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length || 0,
    }

    const totalExecutionTimeMs = results.reduce(
      (sum, r) => sum + r.executionTimeMs,
      0
    )

    switch (this.config.aggregationStrategy) {
      case "merge":
        return this.aggregateMerge(results, stats, totalExecutionTimeMs)
      case "vote":
        return this.aggregateVote(results, stats, totalExecutionTimeMs)
      case "first-success":
        return this.aggregateFirstSuccess(results, stats, totalExecutionTimeMs)
      case "all-required":
        return this.aggregateAllRequired(results, stats, totalExecutionTimeMs)
      case "best-score":
        return this.aggregateBestScore(results, stats, totalExecutionTimeMs)
      default:
        return this.aggregateMerge(results, stats, totalExecutionTimeMs)
    }
  }

  /**
   * Merge aggregation - combines all outputs
   */
  protected aggregateMerge(
    results: SubAgentResult[],
    stats: AggregatedResult["stats"],
    totalExecutionTimeMs: number
  ): AggregatedResult {
    const outputs = results
      .filter((r) => r.success)
      .map((r) => r.output.result)

    return {
      success: stats.successfulTasks > 0,
      strategy: "merge",
      results,
      aggregatedOutput: outputs,
      summary: `Merged ${stats.successfulTasks} successful results from ${stats.totalTasks} tasks`,
      totalExecutionTimeMs,
      stats,
    }
  }

  /**
   * Vote aggregation - uses majority result
   */
  protected aggregateVote(
    results: SubAgentResult[],
    stats: AggregatedResult["stats"],
    totalExecutionTimeMs: number
  ): AggregatedResult {
    const successVotes = stats.successfulTasks
    const failVotes = stats.failedTasks
    const success = successVotes >= failVotes

    return {
      success,
      strategy: "vote",
      results,
      aggregatedOutput: success
        ? results.find((r) => r.success)?.output.result
        : null,
      summary: `Vote result: ${successVotes} success vs ${failVotes} fail`,
      totalExecutionTimeMs,
      stats,
    }
  }

  /**
   * First-success aggregation - returns first successful result
   */
  protected aggregateFirstSuccess(
    results: SubAgentResult[],
    stats: AggregatedResult["stats"],
    totalExecutionTimeMs: number
  ): AggregatedResult {
    const firstSuccess = results.find((r) => r.success)

    return {
      success: !!firstSuccess,
      strategy: "first-success",
      results,
      aggregatedOutput: firstSuccess?.output.result ?? null,
      summary: firstSuccess
        ? `First success from agent: ${firstSuccess.agentId}`
        : "No successful results",
      totalExecutionTimeMs,
      stats,
    }
  }

  /**
   * All-required aggregation - success only if all tasks succeed
   */
  protected aggregateAllRequired(
    results: SubAgentResult[],
    stats: AggregatedResult["stats"],
    totalExecutionTimeMs: number
  ): AggregatedResult {
    const allSuccessful = stats.failedTasks === 0

    return {
      success: allSuccessful,
      strategy: "all-required",
      results,
      aggregatedOutput: allSuccessful
        ? results.map((r) => r.output.result)
        : null,
      summary: allSuccessful
        ? `All ${stats.totalTasks} tasks completed successfully`
        : `${stats.failedTasks} of ${stats.totalTasks} tasks failed`,
      totalExecutionTimeMs,
      stats,
    }
  }

  /**
   * Best-score aggregation - returns highest scored result
   */
  protected aggregateBestScore(
    results: SubAgentResult[],
    stats: AggregatedResult["stats"],
    totalExecutionTimeMs: number
  ): AggregatedResult {
    const scored = results.filter((r) => r.score !== undefined)
    const best = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]

    return {
      success: !!best?.success,
      strategy: "best-score",
      results,
      aggregatedOutput: best?.output.result ?? null,
      summary: best
        ? `Best score: ${best.score} from agent: ${best.agentId}`
        : "No scored results",
      totalExecutionTimeMs,
      stats,
    }
  }

  /**
   * Creates batches of tasks for concurrent execution
   */
  protected createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Starts the coordinator
   */
  start(): void {
    this.state.status = "running"
    this.state.startTime = Date.now()
    this.emit("coordinator_started", {})

    if (this.config.verbose) {
      console.log(`[Coordinator] Started: ${this.config.name}`)
    }
  }

  /**
   * Stops the coordinator
   */
  stop(): void {
    this.state.status = "stopped"
    this.emit("coordinator_stopped", {})

    if (this.config.verbose) {
      console.log(`[Coordinator] Stopped: ${this.config.name}`)
    }
  }

  /**
   * Pauses the coordinator
   */
  pause(): void {
    if (this.state.status === "running") {
      this.state.status = "paused"
      this.emit("coordinator_started", {}) // Using existing event type
      if (this.config.verbose) {
        console.log(`[Coordinator] Paused: ${this.config.name}`)
      }
    }
  }

  /**
   * Resumes the coordinator from paused state
   */
  resume(): void {
    if (this.state.status === "paused") {
      this.state.status = "running"
      if (this.config.verbose) {
        console.log(`[Coordinator] Resumed: ${this.config.name}`)
      }
      // Process any queued tasks
      this.processQueue()
    }
  }

  /**
   * Dispatches a task to all agents that can handle it
   */
  async dispatchToAll(
    taskInput: Omit<CoordinatorTask, "id" | "createdAt" | "retryCount">
  ): Promise<AggregatedResult> {
    const task: CoordinatorTask = {
      ...taskInput,
      id: generateTaskId(),
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: taskInput.maxRetries ?? this.config.maxRetries,
    }

    // Find all agents that can handle the task
    const availableAgents = this.getAvailableAgents()
    const capableAgents = availableAgents.filter((agentState) => {
      const agent = this.agents.get(agentState.config.id)
      return agent && agent.canHandle(task)
    })

    if (capableAgents.length === 0) {
      return {
        success: false,
        strategy: this.config.aggregationStrategy,
        results: [],
        aggregatedOutput: null,
        summary: "No agents available to handle task",
        totalExecutionTimeMs: 0,
        stats: {
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          averageExecutionTimeMs: 0,
        },
      }
    }

    // Execute on all capable agents in parallel
    const results = await Promise.all(
      capableAgents.map((agentState) =>
        this.executeTask(
          { ...task, id: generateTaskId() },
          agentState.config.id
        )
      )
    )

    return this.aggregateResults(results)
  }

  /**
   * Gets the current coordinator state
   */
  getState(): Readonly<CoordinatorState> {
    return {
      ...this.state,
      agents: new Map(this.state.agents),
      activeTasks: new Map(this.state.activeTasks),
    }
  }

  /**
   * Gets the coordinator configuration
   */
  getConfig(): Readonly<CoordinatorConfig> {
    return { ...this.config }
  }

  /**
   * Gets statistics about the coordinator
   */
  getStats(): {
    totalAgents: number
    activeAgents: number
    totalProcessed: number
    queueLength: number
    activeTasks: number
  } {
    const activeAgents = Array.from(this.state.agents.values()).filter(
      (a) => a.status === "busy"
    ).length

    return {
      totalAgents: this.state.agents.size,
      activeAgents,
      totalProcessed: this.state.totalProcessed,
      queueLength: this.state.taskQueue.length,
      activeTasks: this.state.activeTasks.size,
    }
  }
}

/**
 * Creates a coordinator with a fluent builder API
 */
export function createCoordinator(
  id: string,
  name: string
): CoordinatorBuilder {
  return new CoordinatorBuilder(id, name)
}

/**
 * Builder class for creating Coordinator instances
 */
class CoordinatorBuilder {
  private id: string
  private name: string
  private config: Partial<CoordinatorConfig> = {}
  private hooks: CoordinatorHooks = {}
  private agents: SubAgent[] = []
  private autoStart = false

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  /**
   * Sets distribution strategy
   */
  withDistributionStrategy(strategy: DistributionStrategy): CoordinatorBuilder {
    this.config.distributionStrategy = strategy
    return this
  }

  /**
   * Sets aggregation strategy
   */
  withAggregationStrategy(strategy: AggregationStrategy): CoordinatorBuilder {
    this.config.aggregationStrategy = strategy
    return this
  }

  /**
   * Sets maximum global concurrency
   */
  withMaxConcurrency(max: number): CoordinatorBuilder {
    this.config.maxGlobalConcurrency = max
    return this
  }

  /**
   * Sets custom router
   */
  withRouter(router: TaskRouter): CoordinatorBuilder {
    this.config.customRouter = router
    return this
  }

  /**
   * Sets custom aggregator
   */
  withAggregator(aggregator: ResultAggregator): CoordinatorBuilder {
    this.config.customAggregator = aggregator
    return this
  }

  /**
   * Sets configuration options
   */
  withConfig(config: Partial<CoordinatorConfig>): CoordinatorBuilder {
    this.config = { ...this.config, ...config }
    return this
  }

  /**
   * Sets hooks
   */
  withHooks(hooks: CoordinatorHooks): CoordinatorBuilder {
    this.hooks = { ...this.hooks, ...hooks }
    return this
  }

  /**
   * Adds an agent to be registered
   */
  withAgent(agent: SubAgent): CoordinatorBuilder {
    this.agents.push(agent)
    return this
  }

  /**
   * Adds multiple agents to be registered
   */
  withAgents(agents: SubAgent[]): CoordinatorBuilder {
    this.agents.push(...agents)
    return this
  }

  /**
   * Sets verbose mode
   */
  withVerbose(verbose: boolean): CoordinatorBuilder {
    this.config.verbose = verbose
    return this
  }

  /**
   * Sets whether to auto-start the coordinator
   */
  withAutoStart(autoStart: boolean): CoordinatorBuilder {
    this.autoStart = autoStart
    return this
  }

  /**
   * Builds the coordinator instance
   */
  build(): Coordinator {
    const coordinator = new Coordinator({
      ...this.config,
      id: this.id,
      name: this.name,
    })

    coordinator.setHooks(this.hooks)

    for (const agent of this.agents) {
      coordinator.registerAgent(agent)
    }

    if (this.autoStart) {
      coordinator.start()
    }

    return coordinator
  }
}
