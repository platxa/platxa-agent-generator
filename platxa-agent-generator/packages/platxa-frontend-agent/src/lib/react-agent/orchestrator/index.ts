/**
 * Frontend Orchestrator Module
 *
 * Coordinates all workers to generate complete UI components from
 * natural language descriptions.
 *
 * @example
 * ```typescript
 * import {
 *   FrontendOrchestrator,
 *   generateFromDescription,
 * } from "@/lib/react-agent/orchestrator"
 *
 * // Quick generation
 * const result = await generateFromDescription(
 *   "A large primary button with hover lift effect"
 * )
 * console.log(result.files) // Generated component files
 *
 * // Full orchestrator with events
 * const orchestrator = new FrontendOrchestrator({ verbose: true })
 * orchestrator.on((event) => console.log(event))
 *
 * const result = await orchestrator.generate({
 *   description: "A card with image, title, and action buttons",
 *   includeTests: true,
 *   includeStories: true,
 *   accessibility: { audit: true, level: "AA" },
 * })
 * ```
 *
 * @module react-agent/orchestrator
 */

// Main orchestrator
export {
  FrontendOrchestrator,
  createOrchestrator,
  generateFromDescription,
  validateRequest,
} from "./frontend-orchestrator"

// Type exports
export type {
  GenerationRequest,
  GenerationResult,
  WorkflowState,
  WorkflowStep,
  WorkflowStepSuccess,
  WorkflowStepFailed,
  WorkflowStepPending,
  StepStatus,
  GeneratedFile,
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventListener,
  Worker,
  PipelineDefinition,
} from "./types"
