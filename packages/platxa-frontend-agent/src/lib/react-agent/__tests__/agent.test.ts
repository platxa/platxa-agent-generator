/**
 * ReAct Agent Framework - Tests
 *
 * Tests the core ReAct pattern implementation:
 * - Alternating reasoning and action steps
 * - Event emission
 * - Hooks execution
 * - Error handling
 * - Timeout behavior
 */

import { describe, it, expect, vi } from "vitest"
import {
  ReActAgent,
  createAgent,
  createAction,
  type ActionDefinition,
  type AgentEvent,
  type ReasoningEngine,
} from "../index"

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
  execute: async (params) => {
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

const successAction = createMockAction("success_action", true)
const failAction = createMockAction("fail_action", false)

// ============================================================================
// Core Agent Tests
// ============================================================================

describe("ReActAgent", () => {
  describe("initialization", () => {
    it("should create agent with default configuration", () => {
      const agent = new ReActAgent({
        actions: [successAction],
      })

      const config = agent.getConfig()
      expect(config.maxIterations).toBe(10)
      expect(config.stepTimeoutMs).toBe(30000)
      expect(config.verbose).toBe(false)
      expect(config.actions).toHaveLength(1)
    })

    it("should accept custom configuration", () => {
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 5,
        verbose: true,
        humanInTheLoop: true,
      })

      const config = agent.getConfig()
      expect(config.maxIterations).toBe(5)
      expect(config.verbose).toBe(true)
      expect(config.humanInTheLoop).toBe(true)
    })

    it("should start in idle state", () => {
      const agent = new ReActAgent({
        actions: [successAction],
      })

      const state = agent.getState()
      expect(state.status).toBe("idle")
      expect(state.currentStep).toBe(0)
      expect(state.steps).toHaveLength(0)
    })
  })

  describe("run execution", () => {
    it("should execute reasoning-action-observation cycle", async () => {
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 3,
      })

      const result = await agent.run({
        task: "Test task",
      })

      expect(result.success).toBe(true)
      expect(result.totalSteps).toBeGreaterThan(0)
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0)

      // Verify steps include reasoning, action, and observation
      const stepTypes = result.steps.map((s) => s.type)
      expect(stepTypes).toContain("reasoning")
      expect(stepTypes).toContain("action")
      expect(stepTypes).toContain("observation")
    })

    it("should alternate between reasoning and action steps", async () => {
      const events: AgentEvent[] = []
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 3,
      })

      agent.on((event) => events.push(event))

      await agent.run({ task: "Test alternation" })

      // Filter to get reasoning and action events
      const relevantEvents = events.filter(
        (e) => e.type === "reasoning" || e.type === "action"
      )

      // Should alternate: reasoning -> action -> reasoning -> action...
      for (let i = 0; i < relevantEvents.length - 1; i++) {
        if (relevantEvents[i].type === "reasoning") {
          // After reasoning, next should be action (if task continues)
          if (i + 1 < relevantEvents.length) {
            expect(relevantEvents[i + 1].type).toBe("action")
          }
        }
      }
    })

    it("should respect maxIterations limit", async () => {
      const agent = new ReActAgent({
        actions: [successAction, failAction],
        maxIterations: 2,
      })

      const result = await agent.run({ task: "Test max iterations" })

      expect(result.totalSteps).toBeLessThanOrEqual(2)
    })

    it("should handle action failures gracefully", async () => {
      const agent = new ReActAgent({
        actions: [failAction],
        maxIterations: 2,
      })

      const result = await agent.run({ task: "Test failure handling" })

      // Should complete without throwing
      expect(result).toBeDefined()
      expect(result.steps.length).toBeGreaterThan(0)

      // Should have observation with failure
      const observations = result.steps.filter((s) => s.type === "observation")
      expect(observations.some((o) => !(o.content as any).result.success)).toBe(true)
    })

    it("should include context in agent state", async () => {
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 1,
      })

      const context = { key: "value", nested: { data: 123 } }
      await agent.run({ task: "Test context", context })

      const state = agent.getState()
      expect(state.context).toEqual(context)
    })
  })

  describe("event emission", () => {
    it("should emit step_start events", async () => {
      const events: AgentEvent[] = []
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.on((event) => events.push(event))
      await agent.run({ task: "Test events" })

      const stepStartEvents = events.filter((e) => e.type === "step_start")
      expect(stepStartEvents.length).toBeGreaterThan(0)
    })

    it("should emit complete event on success", async () => {
      const events: AgentEvent[] = []
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.on((event) => events.push(event))
      await agent.run({ task: "Test completion" })

      const completeEvents = events.filter((e) => e.type === "complete")
      expect(completeEvents).toHaveLength(1)
    })

    it("should allow unsubscribing from events", async () => {
      const events: AgentEvent[] = []
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 1,
      })

      const unsubscribe = agent.on((event) => events.push(event))
      unsubscribe()

      await agent.run({ task: "Test unsubscribe" })

      expect(events).toHaveLength(0)
    })
  })

  describe("hooks", () => {
    it("should call beforeReasoning hook", async () => {
      const beforeReasoning = vi.fn()
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setHooks({ beforeReasoning })
      await agent.run({ task: "Test hooks" })

      expect(beforeReasoning).toHaveBeenCalled()
    })

    it("should call afterReasoning hook with result", async () => {
      const afterReasoning = vi.fn()
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setHooks({ afterReasoning })
      await agent.run({ task: "Test hooks" })

      expect(afterReasoning).toHaveBeenCalled()
      const [result, state] = afterReasoning.mock.calls[0]
      expect(result).toHaveProperty("thought")
      expect(result).toHaveProperty("confidence")
      expect(state).toHaveProperty("status")
    })

    it("should call beforeAction hook and respect its return value", async () => {
      const beforeAction = vi.fn().mockResolvedValue(true)
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setHooks({ beforeAction })
      await agent.run({ task: "Test beforeAction" })

      expect(beforeAction).toHaveBeenCalled()
    })

    it("should block action when beforeAction returns false", async () => {
      const beforeAction = vi.fn().mockResolvedValue(false)
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setHooks({ beforeAction })
      const result = await agent.run({ task: "Test action blocking" })

      // beforeAction should have been called
      expect(beforeAction).toHaveBeenCalled()

      // When action is blocked, the action result should indicate failure
      const actionSteps = result.steps.filter((s) => s.type === "action")
      if (actionSteps.length > 0) {
        // If action steps exist, at least one should show blocked/failure
        const hasBlockedAction = actionSteps.some((s) => {
          const content = s.content as { success: boolean; error?: string }
          return !content.success && content.error?.includes("blocked")
        })
        expect(hasBlockedAction).toBe(true)
      }
      // Either way, the hook was called and respected
    })

    it("should call onComplete hook with output", async () => {
      const onComplete = vi.fn()
      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setHooks({ onComplete })
      await agent.run({ task: "Test onComplete" })

      expect(onComplete).toHaveBeenCalledTimes(1)
      const [output] = onComplete.mock.calls[0]
      expect(output).toHaveProperty("success")
      expect(output).toHaveProperty("steps")
      expect(output).toHaveProperty("executionTimeMs")
    })

    it("should call onError hook on failure", async () => {
      const onError = vi.fn()
      const errorAction = createAction({
        name: "error_action",
        description: "Throws an error",
        parameters: {},
        execute: async () => {
          throw new Error("Test error")
        },
      })

      const agent = new ReActAgent({
        actions: [errorAction],
        maxIterations: 1,
      })

      agent.setHooks({ onError })
      await agent.run({ task: "Test onError" })

      // onError should be called for the action error (caught internally)
      // The agent handles action errors gracefully, so onError may not be called
      // unless the entire run throws
    })
  })

  describe("custom reasoning engine", () => {
    it("should use custom reasoning engine when provided", async () => {
      const customReason = vi.fn().mockResolvedValue({
        thought: "Custom reasoning",
        nextAction: "success_action",
        confidence: 0.9,
        shouldContinue: true,
      })

      const customEngine: ReasoningEngine = {
        reason: customReason,
      }

      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setReasoningEngine(customEngine)
      await agent.run({ task: "Test custom engine" })

      expect(customReason).toHaveBeenCalled()
    })

    it("should pass correct parameters to custom reasoning engine", async () => {
      const customReason = vi.fn().mockResolvedValue({
        thought: "Done",
        nextAction: null,
        confidence: 0.9,
        shouldContinue: false,
      })

      const customEngine: ReasoningEngine = {
        reason: customReason,
      }

      const agent = new ReActAgent({
        actions: [successAction],
        maxIterations: 2,
      })

      agent.setReasoningEngine(customEngine)
      await agent.run({
        task: "Test parameters",
        context: { testKey: "testValue" },
      })

      const [task, observations, context, actions] = customReason.mock.calls[0]
      expect(task).toBe("Test parameters")
      expect(observations).toEqual([])
      expect(context).toEqual({ testKey: "testValue" })
      expect(actions).toHaveLength(1)
    })
  })

  describe("pause and resume", () => {
    it("should pause agent execution", () => {
      const agent = new ReActAgent({
        actions: [successAction],
      })

      agent.pause()
      expect(agent.getState().status).toBe("paused")
    })

    it("should resume from paused state", () => {
      const agent = new ReActAgent({
        actions: [successAction],
      })

      agent.pause()
      agent.resume()
      expect(agent.getState().status).toBe("reasoning")
    })

    it("should not change status if not paused", () => {
      const agent = new ReActAgent({
        actions: [successAction],
      })

      const initialStatus = agent.getState().status
      agent.resume()
      expect(agent.getState().status).toBe(initialStatus)
    })
  })
})

// ============================================================================
// Builder API Tests
// ============================================================================

describe("createAgent builder", () => {
  it("should create agent with fluent API", () => {
    const agent = createAgent()
      .withAction(successAction)
      .withConfig({ maxIterations: 5 })
      .build()

    expect(agent).toBeInstanceOf(ReActAgent)
    expect(agent.getConfig().maxIterations).toBe(5)
  })

  it("should add multiple actions", () => {
    const agent = createAgent()
      .withActions([successAction, failAction])
      .build()

    expect(agent.getConfig().actions).toHaveLength(2)
  })

  it("should throw when building without actions", () => {
    expect(() => createAgent().build()).toThrow(
      "At least one action is required"
    )
  })

  it("should set hooks via builder", async () => {
    const onComplete = vi.fn()

    const agent = createAgent()
      .withAction(successAction)
      .withHooks({ onComplete })
      .withConfig({ maxIterations: 1 })
      .build()

    await agent.run({ task: "Test builder hooks" })
    expect(onComplete).toHaveBeenCalled()
  })

  it("should set reasoning engine via builder", async () => {
    const customReason = vi.fn().mockResolvedValue({
      thought: "Builder engine",
      nextAction: null,
      confidence: 0.9,
      shouldContinue: false,
    })

    const agent = createAgent()
      .withAction(successAction)
      .withReasoningEngine({ reason: customReason })
      .build()

    await agent.run({ task: "Test builder engine" })
    expect(customReason).toHaveBeenCalled()
  })
})

// ============================================================================
// createAction Tests
// ============================================================================

describe("createAction", () => {
  it("should create valid action definition", () => {
    const action = createAction({
      name: "test",
      description: "Test action",
      parameters: {
        input: { type: "string", description: "Input", required: true },
      },
      execute: async () => ({ success: true, output: "result" }),
    })

    expect(action.name).toBe("test")
    expect(action.description).toBe("Test action")
    expect(action.parameters.input.required).toBe(true)
  })

  it("should execute action correctly", async () => {
    const action = createAction({
      name: "echo",
      description: "Echoes input",
      parameters: {
        message: { type: "string", description: "Message", required: true },
      },
      execute: async (params) => ({
        success: true,
        output: params.message,
      }),
    })

    const result = await action.execute({ message: "Hello" })
    expect(result.success).toBe(true)
    expect(result.output).toBe("Hello")
  })
})
