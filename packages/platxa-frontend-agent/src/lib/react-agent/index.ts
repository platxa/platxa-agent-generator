/**
 * ReAct Agent Framework
 *
 * A TypeScript implementation of the ReAct (Reasoning and Acting) pattern
 * for building AI agents that alternate between reasoning and action steps.
 *
 * @example
 * ```typescript
 * import { createAgent, createAction } from "@/lib/react-agent"
 *
 * const searchAction = createAction({
 *   name: "search",
 *   description: "Search for information",
 *   parameters: {
 *     query: { type: "string", description: "Search query", required: true },
 *   },
 *   execute: async (params) => ({
 *     success: true,
 *     output: `Results for: ${params.query}`,
 *   }),
 * })
 *
 * const agent = createAgent()
 *   .withAction(searchAction)
 *   .withConfig({ maxIterations: 5, verbose: true })
 *   .build()
 *
 * const result = await agent.run({ task: "Find information about TypeScript" })
 * ```
 *
 * @module react-agent
 */

// Core agent class and factory functions
export { ReActAgent, createAgent, createAction } from "./agent"

// Type exports
export type {
  // Core types
  StepType,
  AgentStatus,
  // Step types
  ReasoningResult,
  ActionDefinition,
  ParameterDefinition,
  ActionResult,
  Observation,
  Step,
  // Configuration
  AgentConfig,
  AgentState,
  // Events
  AgentEvent,
  AgentEventCallback,
  // Input/Output
  AgentInput,
  AgentOutput,
  // Extension interfaces
  ReasoningEngine,
  ActionExecutor,
  AgentHooks,
} from "./types"
