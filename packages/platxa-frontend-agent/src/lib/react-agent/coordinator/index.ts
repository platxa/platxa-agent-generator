/**
 * Multi-Agent Coordinator Module
 *
 * Implements the orchestrator-workers pattern for managing multiple
 * specialized sub-agents with task routing and result aggregation.
 *
 * @example
 * ```typescript
 * import {
 *   Coordinator,
 *   createCoordinator,
 *   createSubAgent,
 *   CommonCapabilities,
 * } from "@/lib/react-agent/coordinator"
 *
 * // Create specialized agents
 * const designAgent = createSubAgent({
 *   id: "design-analyzer",
 *   name: "Design Analyzer",
 *   capabilities: [CommonCapabilities.DESIGN_ANALYSIS],
 *   maxConcurrency: 2,
 *   actions: [analyzeDesignAction],
 * })
 *
 * // Create coordinator
 * const coordinator = createCoordinator("ui-coordinator", "UI Coordinator")
 *   .withDistributionStrategy("capability-match")
 *   .withAggregationStrategy("merge")
 *   .withAgent(designAgent)
 *   .build()
 *
 * // Dispatch tasks
 * const result = await coordinator.dispatch({
 *   type: "analyze",
 *   priority: "high",
 *   payload: { task: "Analyze the login form design" },
 *   requiredCapabilities: ["design-analysis"],
 * })
 * ```
 *
 * @module react-agent/coordinator
 */

// Core coordinator
export { Coordinator, createCoordinator } from "./coordinator"

// Sub-agent utilities
export {
  BaseSubAgent,
  createSubAgent,
  createCapability,
  CommonCapabilities,
} from "./base-agent"

// Re-export action utilities from agent module
export { createAction } from "../agent"
export type { ActionDefinition } from "../types"

// Type exports
export type {
  // Status types
  SubAgentStatus,
  TaskPriority,
  DistributionStrategy,
  AggregationStrategy,
  // Capability types
  SubAgentCapabilities,
  SubAgentConfig,
  SubAgentState,
  // Task types
  CoordinatorTask,
  SubAgentResult,
  AggregatedResult,
  // Configuration
  CoordinatorConfig,
  CoordinatorState,
  // Events
  CoordinatorEventType,
  CoordinatorEvent,
  CoordinatorEventCallback,
  // Interfaces
  TaskRouter,
  ResultAggregator,
  SubAgent,
  CoordinatorHooks,
} from "./types"
