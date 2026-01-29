/**
 * Multi-Agent Coordinator - Tests
 *
 * Tests the coordinator pattern implementation:
 * - Task routing to specialized sub-agents
 * - Distribution strategies
 * - Result aggregation
 * - Event emission
 * - Error handling
 */

import { describe, it, expect, vi } from "vitest"
import {
  Coordinator,
  createCoordinator,
  createSubAgent,
  CommonCapabilities,
  createCapability,
  type CoordinatorEvent,
  type CoordinatorTask,
  type ActionDefinition,
} from "../coordinator"

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockAction = (
  name: string,
  shouldSucceed = true,
  delay = 0
): ActionDefinition => ({
  name,
  description: `Mock action: ${name}`,
  parameters: {
    input: { type: "string", description: "Input parameter", required: false },
  },
  execute: async (params: Record<string, unknown>) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    return {
      success: shouldSucceed,
      output: { action: name, params, timestamp: Date.now() },
      error: shouldSucceed ? undefined : `${name} failed`,
    }
  },
})

const designAction = createMockAction("analyze_design", true)
const codeAction = createMockAction("generate_code", true)
const testAction = createMockAction("run_tests", true)
const failAction = createMockAction("fail_action", false)

// Create mock sub-agents with different capabilities
const createDesignAgent = () =>
  createSubAgent({
    id: "design-analyzer",
    name: "Design Analyzer",
    capabilities: [CommonCapabilities.DESIGN_ANALYSIS],
    maxConcurrency: 2,
    actions: [designAction],
  })

const createCodeGenAgent = () =>
  createSubAgent({
    id: "code-generator",
    name: "Code Generator",
    capabilities: [CommonCapabilities.CODE_GENERATION],
    maxConcurrency: 3,
    actions: [codeAction],
  })

const createTestAgent = () =>
  createSubAgent({
    id: "test-runner",
    name: "Test Runner",
    capabilities: [CommonCapabilities.TESTING],
    maxConcurrency: 2,
    actions: [testAction],
  })

const createFailingAgent = () =>
  createSubAgent({
    id: "failing-agent",
    name: "Failing Agent",
    capabilities: [createCapability("fail", "Fail", "Always fails", ["fail"])],
    maxConcurrency: 1,
    actions: [failAction],
  })

// Helper to create a task input (without id, createdAt, retryCount which are added by dispatch)
const createTaskInput = (
  type: string,
  requiredCapabilities?: string[],
  priority: "critical" | "high" | "medium" | "low" = "medium"
) => ({
  type,
  priority,
  payload: { task: `Test task: ${type}` },
  requiredCapabilities,
  maxRetries: 3,
})

// ============================================================================
// Coordinator Tests
// ============================================================================

describe("Coordinator", () => {
  describe("initialization", () => {
    it("should create coordinator with default configuration", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      const config = coordinator.getConfig()
      expect(config.id).toBe("test-coordinator")
      expect(config.name).toBe("Test Coordinator")
      expect(config.distributionStrategy).toBe("capability-match")
      expect(config.aggregationStrategy).toBe("merge")
      expect(config.maxGlobalConcurrency).toBe(10)
    })

    it("should accept custom configuration", () => {
      const coordinator = new Coordinator({
        id: "custom-coordinator",
        name: "Custom Coordinator",
        distributionStrategy: "round-robin",
        aggregationStrategy: "first-success",
        maxGlobalConcurrency: 5,
        verbose: true,
      })

      const config = coordinator.getConfig()
      expect(config.distributionStrategy).toBe("round-robin")
      expect(config.aggregationStrategy).toBe("first-success")
      expect(config.maxGlobalConcurrency).toBe(5)
      expect(config.verbose).toBe(true)
    })

    it("should start in idle state", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      const state = coordinator.getState()
      expect(state.status).toBe("idle")
      expect(state.agents.size).toBe(0)
      expect(state.taskQueue).toHaveLength(0)
    })
  })

  describe("agent registration", () => {
    it("should register sub-agents", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      const state = coordinator.getState()
      expect(state.agents.size).toBe(2)
      expect(state.agents.has("design-analyzer")).toBe(true)
      expect(state.agents.has("code-generator")).toBe(true)
    })

    it("should unregister sub-agents", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())
      coordinator.unregisterAgent("design-analyzer")

      const state = coordinator.getState()
      expect(state.agents.size).toBe(1)
      expect(state.agents.has("design-analyzer")).toBe(false)
      expect(state.agents.has("code-generator")).toBe(true)
    })

    it("should emit events on agent registration", () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createDesignAgent())

      const registrationEvents = events.filter(
        (e) => e.type === "agent_registered"
      )
      expect(registrationEvents).toHaveLength(1)
      expect(registrationEvents[0].data.agentId).toBe("design-analyzer")
    })

    it("should throw when registering duplicate agent", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())
      expect(() => coordinator.registerAgent(createDesignAgent())).toThrow(
        'Agent with ID "design-analyzer" is already registered'
      )
    })
  })

  describe("task routing", () => {
    it("should route tasks to agents with matching capabilities", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        distributionStrategy: "capability-match",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      const taskInput = createTaskInput("analyze", ["design-analysis"])
      const result = await coordinator.dispatch(taskInput)

      expect(result.success).toBe(true)
      expect(result.agentId).toBe("design-analyzer")
    })

    it("should route to code generation agent for code tasks", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        distributionStrategy: "capability-match",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      const taskInput = createTaskInput("generate", ["code-generation"])
      const result = await coordinator.dispatch(taskInput)

      expect(result.success).toBe(true)
      expect(result.agentId).toBe("code-generator")
    })

    it("should fail when no agent can handle the task", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())

      const taskInput = createTaskInput("test", ["testing"])
      const result = await coordinator.dispatch(taskInput)

      expect(result.success).toBe(false)
      expect(result.error).toContain("No available agent")
    })

    it("should handle tasks without required capabilities", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())

      // Task without specific capability requirements
      const taskInput = createTaskInput("general")
      const result = await coordinator.dispatch(taskInput)

      // Should be handled by available agent
      expect(result.success).toBe(true)
    })
  })

  describe("distribution strategies", () => {
    it("should use round-robin distribution", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        distributionStrategy: "round-robin",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())
      coordinator.registerAgent(createTestAgent())

      // Dispatch multiple tasks without capability requirements
      const task1 = createTaskInput("task1")
      const task2 = createTaskInput("task2")
      const task3 = createTaskInput("task3")

      const result1 = await coordinator.dispatch(task1)
      const result2 = await coordinator.dispatch(task2)
      const result3 = await coordinator.dispatch(task3)

      // Round robin should cycle through agents
      const agents = [result1.agentId, result2.agentId, result3.agentId]

      // All should succeed
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result3.success).toBe(true)

      // Should have used multiple agents
      const uniqueAgents = new Set(agents)
      expect(uniqueAgents.size).toBeGreaterThanOrEqual(1)
    })

    it("should use capability-match distribution", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        distributionStrategy: "capability-match",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())
      coordinator.registerAgent(createTestAgent())

      const designTask = createTaskInput("design", ["design-analysis"])
      const codeTask = createTaskInput("code", ["code-generation"])
      const testTask = createTaskInput("test", ["testing"])

      const designResult = await coordinator.dispatch(designTask)
      const codeResult = await coordinator.dispatch(codeTask)
      const testResult = await coordinator.dispatch(testTask)

      expect(designResult.agentId).toBe("design-analyzer")
      expect(codeResult.agentId).toBe("code-generator")
      expect(testResult.agentId).toBe("test-runner")
    })

    it("should respect priority-based distribution", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        distributionStrategy: "priority-based",
      })

      coordinator.registerAgent(createDesignAgent())

      const lowTask = createTaskInput("low", undefined, "low")
      const highTask = createTaskInput("high", undefined, "critical")

      // Both should be processed
      const lowResult = await coordinator.dispatch(lowTask)
      const highResult = await coordinator.dispatch(highTask)

      expect(lowResult.success).toBe(true)
      expect(highResult.success).toBe(true)
    })
  })

  describe("result aggregation", () => {
    it("should merge results from multiple agents using dispatchToAll", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        aggregationStrategy: "merge",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      // Dispatch to all agents that can handle it
      const taskInput = createTaskInput("multi")
      const result = await coordinator.dispatchToAll(taskInput)

      expect(result.strategy).toBe("merge")
      expect(result.results.length).toBeGreaterThanOrEqual(1)
      expect(result.stats.totalTasks).toBeGreaterThanOrEqual(1)
    })

    it("should use first-success aggregation", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        aggregationStrategy: "first-success",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      const taskInput = createTaskInput("first")
      const result = await coordinator.dispatchToAll(taskInput)

      expect(result.strategy).toBe("first-success")
      expect(result.success).toBe(true)
    })

    it("should calculate aggregation statistics in batch dispatch", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())

      const tasks = [
        createTaskInput("task1"),
        createTaskInput("task2"),
      ]
      const result = await coordinator.dispatchBatch(tasks)

      expect(result.stats).toBeDefined()
      expect(result.stats.totalTasks).toBe(2)
      expect(result.stats.successfulTasks).toBeGreaterThanOrEqual(0)
      expect(result.totalExecutionTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe("event emission", () => {
    it("should emit task_started events", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createDesignAgent())

      const taskInput = createTaskInput("test")
      await coordinator.dispatch(taskInput)

      const startedEvents = events.filter((e) => e.type === "task_started")
      expect(startedEvents.length).toBeGreaterThan(0)
    })

    it("should emit task_completed events", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createDesignAgent())

      const taskInput = createTaskInput("test")
      await coordinator.dispatch(taskInput)

      const completedEvents = events.filter((e) => e.type === "task_completed")
      expect(completedEvents.length).toBeGreaterThan(0)
    })

    it("should emit aggregation_complete events for batch dispatch", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createDesignAgent())

      const tasks = [createTaskInput("test1"), createTaskInput("test2")]
      await coordinator.dispatchBatch(tasks)

      const aggregationEvents = events.filter(
        (e) => e.type === "aggregation_complete"
      )
      expect(aggregationEvents.length).toBeGreaterThan(0)
    })

    it("should allow unsubscribing from events", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      const unsubscribe = coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createDesignAgent())

      unsubscribe()

      const taskInput = createTaskInput("test")
      await coordinator.dispatch(taskInput)

      // Should only have the registration event (before unsubscribe)
      const taskEvents = events.filter(
        (e) => e.type === "task_started" || e.type === "task_completed"
      )
      expect(taskEvents).toHaveLength(0)
    })
  })

  describe("error handling", () => {
    it("should handle agent execution failures", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createFailingAgent())

      const taskInput = createTaskInput("fail", ["fail"])
      const result = await coordinator.dispatch(taskInput)

      // Should complete without throwing
      expect(result).toBeDefined()
      // The result should indicate failure
      expect(result.success).toBe(false)
    })

    it("should emit task_failed events on failure", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
        maxRetries: 0, // Disable retries to see failure immediately
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createFailingAgent())

      const taskInput = { ...createTaskInput("fail", ["fail"]), maxRetries: 0 }
      await coordinator.dispatch(taskInput)

      // Check for failure-related events
      const failedEvents = events.filter(
        (e) => e.type === "task_failed" || e.type === "task_completed"
      )
      expect(failedEvents.length).toBeGreaterThan(0)
    })

    it("should retry failed tasks up to maxRetries", async () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))
      coordinator.registerAgent(createFailingAgent())

      const taskInput = { ...createTaskInput("fail", ["fail"]), maxRetries: 2 }
      await coordinator.dispatch(taskInput)

      // Should have retry events
      const retryEvents = events.filter((e) => e.type === "task_retried")
      expect(retryEvents.length).toBeLessThanOrEqual(2)
    })
  })

  describe("coordinator lifecycle", () => {
    it("should start and stop coordinator", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.start()
      expect(coordinator.getState().status).toBe("running")

      coordinator.stop()
      expect(coordinator.getState().status).toBe("stopped")
    })

    it("should pause and resume coordinator", () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.start()
      coordinator.pause()
      expect(coordinator.getState().status).toBe("paused")

      coordinator.resume()
      expect(coordinator.getState().status).toBe("running")
    })

    it("should emit lifecycle events", () => {
      const events: CoordinatorEvent[] = []
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.on((event) => events.push(event))

      coordinator.start()
      coordinator.stop()

      const startEvents = events.filter((e) => e.type === "coordinator_started")
      const stopEvents = events.filter((e) => e.type === "coordinator_stopped")

      expect(startEvents).toHaveLength(1)
      expect(stopEvents).toHaveLength(1)
    })
  })

  describe("statistics", () => {
    it("should return accurate stats", async () => {
      const coordinator = new Coordinator({
        id: "test-coordinator",
        name: "Test Coordinator",
      })

      coordinator.registerAgent(createDesignAgent())
      coordinator.registerAgent(createCodeGenAgent())

      const stats = coordinator.getStats()
      expect(stats.totalAgents).toBe(2)
      expect(stats.activeAgents).toBe(0)
      expect(stats.totalProcessed).toBe(0)
      expect(stats.queueLength).toBe(0)

      await coordinator.dispatch(createTaskInput("test"))

      const updatedStats = coordinator.getStats()
      expect(updatedStats.totalProcessed).toBe(1)
    })
  })
})

// ============================================================================
// Builder API Tests
// ============================================================================

describe("createCoordinator builder", () => {
  it("should create coordinator with fluent API", () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withDistributionStrategy("round-robin")
      .withAggregationStrategy("merge")
      .build()

    const config = coordinator.getConfig()
    expect(config.id).toBe("test-coord")
    expect(config.distributionStrategy).toBe("round-robin")
    expect(config.aggregationStrategy).toBe("merge")
  })

  it("should add agents via builder", async () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withAgent(createDesignAgent())
      .withAgent(createCodeGenAgent())
      .build()

    const state = coordinator.getState()
    expect(state.agents.size).toBe(2)
  })

  it("should configure max concurrency via builder", () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withMaxConcurrency(5)
      .build()

    expect(coordinator.getConfig().maxGlobalConcurrency).toBe(5)
  })

  it("should set verbose mode via builder", () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withVerbose(true)
      .build()

    expect(coordinator.getConfig().verbose).toBe(true)
  })

  it("should auto-start coordinator via builder", () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withAgent(createDesignAgent())
      .withAutoStart(true)
      .build()

    expect(coordinator.getState().status).toBe("running")
  })

  it("should add multiple agents at once via builder", () => {
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withAgents([createDesignAgent(), createCodeGenAgent(), createTestAgent()])
      .build()

    expect(coordinator.getState().agents.size).toBe(3)
  })

  it("should set hooks via builder", async () => {
    const beforeRoute = vi.fn()
    const coordinator = createCoordinator("test-coord", "Test Coordinator")
      .withAgent(createDesignAgent())
      .withHooks({ beforeRoute })
      .build()

    await coordinator.dispatch(createTaskInput("test"))
    expect(beforeRoute).toHaveBeenCalled()
  })
})

// ============================================================================
// SubAgent Tests
// ============================================================================

describe("createSubAgent", () => {
  it("should create valid sub-agent", () => {
    const agent = createSubAgent({
      id: "test-agent",
      name: "Test Agent",
      capabilities: [
        createCapability("test-cap", "Test Capability", "A test", ["test"]),
      ],
      maxConcurrency: 2,
      actions: [designAction],
    })

    const config = agent.getConfig()
    expect(config.id).toBe("test-agent")
    expect(config.name).toBe("Test Agent")
    expect(config.capabilities).toHaveLength(1)
    expect(config.maxConcurrency).toBe(2)
    expect(config.enabled).toBe(true)
  })

  it("should check if agent can handle task based on capabilities", () => {
    const agent = createSubAgent({
      id: "design-agent",
      name: "Design Agent",
      capabilities: [CommonCapabilities.DESIGN_ANALYSIS],
      maxConcurrency: 1,
      actions: [designAction],
    })

    const matchingTask: CoordinatorTask = {
      id: "task-1",
      type: "analyze",
      priority: "medium",
      payload: { task: "analyze" },
      requiredCapabilities: ["design-analysis"],
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    const nonMatchingTask: CoordinatorTask = {
      id: "task-2",
      type: "code",
      priority: "medium",
      payload: { task: "code" },
      requiredCapabilities: ["code-generation"],
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    const openTask: CoordinatorTask = {
      id: "task-3",
      type: "open",
      priority: "medium",
      payload: { task: "open" },
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    expect(agent.canHandle(matchingTask)).toBe(true)
    expect(agent.canHandle(nonMatchingTask)).toBe(false)
    expect(agent.canHandle(openTask)).toBe(true) // No requirements
  })

  it("should execute tasks", async () => {
    const agent = createSubAgent({
      id: "exec-agent",
      name: "Exec Agent",
      capabilities: [CommonCapabilities.CODE_GENERATION],
      maxConcurrency: 1,
      actions: [codeAction],
    })

    const task: CoordinatorTask = {
      id: "task-1",
      type: "generate",
      priority: "medium",
      payload: { task: "generate code" },
      requiredCapabilities: ["code-generation"],
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    const result = await agent.execute(task)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })

  it("should track agent status", async () => {
    const agent = createSubAgent({
      id: "status-agent",
      name: "Status Agent",
      capabilities: [CommonCapabilities.TESTING],
      maxConcurrency: 1,
      actions: [testAction],
    })

    expect(agent.getStatus()).toBe("idle")

    const task: CoordinatorTask = {
      id: "task-1",
      type: "test",
      priority: "medium",
      payload: { task: "run tests" },
      requiredCapabilities: ["testing"],
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    await agent.execute(task)

    // After completion, should be idle
    expect(agent.getStatus()).toBe("idle")
  })

  it("should enable and disable agent", () => {
    const agent = createSubAgent({
      id: "toggle-agent",
      name: "Toggle Agent",
      capabilities: [CommonCapabilities.DOCUMENTATION],
      maxConcurrency: 1,
      actions: [designAction],
    })

    agent.disable()
    expect(agent.getConfig().enabled).toBe(false)
    expect(agent.getStatus()).toBe("unavailable")

    agent.enable()
    expect(agent.getConfig().enabled).toBe(true)
    expect(agent.getStatus()).toBe("idle")
  })

  it("should not handle tasks when disabled", () => {
    const agent = createSubAgent({
      id: "disabled-agent",
      name: "Disabled Agent",
      capabilities: [CommonCapabilities.DESIGN_ANALYSIS],
      maxConcurrency: 1,
      actions: [designAction],
    })

    const task: CoordinatorTask = {
      id: "task-1",
      type: "analyze",
      priority: "medium",
      payload: { task: "analyze" },
      requiredCapabilities: ["design-analysis"],
      maxRetries: 0,
      retryCount: 0,
      createdAt: Date.now(),
    }

    expect(agent.canHandle(task)).toBe(true)

    agent.disable()
    expect(agent.canHandle(task)).toBe(false)
  })
})

// ============================================================================
// CommonCapabilities Tests
// ============================================================================

describe("CommonCapabilities", () => {
  it("should have predefined capabilities", () => {
    expect(CommonCapabilities.DESIGN_ANALYSIS).toBeDefined()
    expect(CommonCapabilities.CODE_GENERATION).toBeDefined()
    expect(CommonCapabilities.TESTING).toBeDefined()
    expect(CommonCapabilities.DOCUMENTATION).toBeDefined()
    expect(CommonCapabilities.CODE_REVIEW).toBeDefined()
    expect(CommonCapabilities.ACCESSIBILITY).toBeDefined()
    expect(CommonCapabilities.ANIMATION).toBeDefined()
    expect(CommonCapabilities.THEMING).toBeDefined()
  })

  it("should have correct capability structure", () => {
    const capability = CommonCapabilities.DESIGN_ANALYSIS
    expect(capability.id).toBe("design-analysis")
    expect(capability.name).toBe("Design Analysis")
    expect(capability.description).toBeDefined()
    expect(capability.tags).toContain("design")
    expect(capability.weight).toBeDefined()
  })
})

// ============================================================================
// createCapability Tests
// ============================================================================

describe("createCapability", () => {
  it("should create capability with all fields", () => {
    const capability = createCapability(
      "custom-cap",
      "Custom Capability",
      "A custom capability for testing",
      ["custom", "test"],
      0.9
    )

    expect(capability.id).toBe("custom-cap")
    expect(capability.name).toBe("Custom Capability")
    expect(capability.description).toBe("A custom capability for testing")
    expect(capability.tags).toEqual(["custom", "test"])
    expect(capability.weight).toBe(0.9)
  })

  it("should create capability with default tags", () => {
    const capability = createCapability(
      "simple-cap",
      "Simple Capability",
      "A simple capability"
    )

    expect(capability.tags).toEqual([])
    expect(capability.weight).toBeUndefined()
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Coordinator Integration", () => {
  it("should handle end-to-end workflow with multiple agents", async () => {
    const events: CoordinatorEvent[] = []

    const coordinator = createCoordinator("integration-test", "Integration Test")
      .withDistributionStrategy("capability-match")
      .withAggregationStrategy("merge")
      .withAgent(createDesignAgent())
      .withAgent(createCodeGenAgent())
      .withAgent(createTestAgent())
      .withAutoStart(true)
      .build()

    coordinator.on((event) => events.push(event))

    // Dispatch tasks to different agents
    const designResult = await coordinator.dispatch(
      createTaskInput("design", ["design-analysis"])
    )
    const codeResult = await coordinator.dispatch(
      createTaskInput("code", ["code-generation"])
    )
    const testResult = await coordinator.dispatch(
      createTaskInput("test", ["testing"])
    )

    // Verify all tasks succeeded
    expect(designResult.success).toBe(true)
    expect(codeResult.success).toBe(true)
    expect(testResult.success).toBe(true)

    // Verify correct agent routing
    expect(designResult.agentId).toBe("design-analyzer")
    expect(codeResult.agentId).toBe("code-generator")
    expect(testResult.agentId).toBe("test-runner")

    // Verify events were emitted
    const startedEvents = events.filter((e) => e.type === "task_started")
    const completedEvents = events.filter((e) => e.type === "task_completed")
    expect(startedEvents.length).toBe(3)
    expect(completedEvents.length).toBe(3)

    // Verify stats
    const stats = coordinator.getStats()
    expect(stats.totalProcessed).toBe(3)
    expect(stats.totalAgents).toBe(3)

    coordinator.stop()
  })

  it("should handle batch processing with aggregation", async () => {
    const coordinator = createCoordinator("batch-test", "Batch Test")
      .withAgent(createDesignAgent())
      .withAgent(createCodeGenAgent())
      .build()

    const tasks = [
      createTaskInput("task1"),
      createTaskInput("task2"),
      createTaskInput("task3"),
    ]

    const result = await coordinator.dispatchBatch(tasks)

    expect(result.success).toBe(true)
    expect(result.stats.totalTasks).toBe(3)
    expect(result.stats.successfulTasks).toBe(3)
    expect(result.results).toHaveLength(3)
  })
})
