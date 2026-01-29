/**
 * Frontend Orchestrator - Type Definitions
 *
 * Types for coordinating design analysis, component generation,
 * animation, theming, and accessibility validation.
 */

import type { DesignRequirements, AnalysisResult } from "../design-analyzer"
import type { GeneratedComponent } from "../generators"
import type { GeneratedAnimation } from "../animations"
import type { GeneratedTheme, ThemeConfig } from "../theme"
import type { AuditResult } from "../accessibility"

/**
 * Generation request from user
 */
export interface GenerationRequest {
  /** Natural language description of the component */
  description: string
  /** Optional component name override */
  componentName?: string
  /** Target framework (React is default) */
  framework?: "react" | "vue" | "svelte"
  /** Styling approach */
  styling?: "tailwind" | "css" | "styled-components"
  /** Include TypeScript types */
  typescript?: boolean
  /** Include tests */
  includeTests?: boolean
  /** Include stories (Storybook) */
  includeStories?: boolean
  /** Theme configuration */
  theme?: ThemeConfig | string
  /** Animation preferences */
  animations?: {
    enabled?: boolean
    reducedMotion?: boolean
    preset?: string
  }
  /** Accessibility requirements */
  accessibility?: {
    level?: "A" | "AA" | "AAA"
    audit?: boolean
  }
}

/**
 * Workflow step status
 */
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped"

/**
 * Individual workflow step result - discriminated union for type safety
 */
export type WorkflowStep<T = unknown> =
  | WorkflowStepSuccess<T>
  | WorkflowStepFailed
  | WorkflowStepPending

/**
 * Successful workflow step with data
 */
export interface WorkflowStepSuccess<T> {
  /** Step name */
  name: string
  /** Step status */
  status: "completed"
  /** Step result data */
  data: T
  /** Duration in ms */
  duration?: number
  /** Timestamp */
  timestamp: Date
}

/**
 * Failed workflow step with error
 */
export interface WorkflowStepFailed {
  /** Step name */
  name: string
  /** Step status */
  status: "failed"
  /** Error message */
  error: string
  /** Duration in ms */
  duration?: number
  /** Timestamp */
  timestamp: Date
}

/**
 * Pending or running workflow step
 */
export interface WorkflowStepPending {
  /** Step name */
  name: string
  /** Step status */
  status: "pending" | "running" | "skipped"
  /** Duration in ms */
  duration?: number
  /** Timestamp */
  timestamp: Date
}

/**
 * Complete workflow state
 */
export interface WorkflowState {
  /** Request ID */
  id: string
  /** Original request */
  request: GenerationRequest
  /** Current status */
  status: "pending" | "running" | "completed" | "failed"
  /** Individual step results */
  steps: {
    analyze?: WorkflowStep<AnalysisResult>
    generate?: WorkflowStep<GeneratedComponent>
    animate?: WorkflowStep<GeneratedAnimation>
    theme?: WorkflowStep<GeneratedTheme>
    accessibility?: WorkflowStep<AuditResult>
  }
  /** Start time */
  startedAt?: Date
  /** End time */
  completedAt?: Date
  /** Total duration in ms */
  totalDuration?: number
}

/**
 * Generated output files
 */
export interface GeneratedFile {
  /** File path (relative) */
  path: string
  /** File content */
  content: string
  /** File type */
  type: "component" | "test" | "story" | "style" | "types" | "theme"
  /** Language */
  language: "typescript" | "javascript" | "css" | "json"
}

/**
 * Complete generation result
 */
export interface GenerationResult {
  /** Whether generation succeeded */
  success: boolean
  /** Workflow state with all step results */
  workflow: WorkflowState
  /** Generated files */
  files: GeneratedFile[]
  /** Design requirements extracted */
  requirements: DesignRequirements
  /** Component code */
  component: GeneratedComponent
  /** Animation code if generated */
  animation?: GeneratedAnimation
  /** Theme if generated */
  theme?: GeneratedTheme
  /** Accessibility audit if run */
  audit?: AuditResult
  /** Warnings and suggestions */
  warnings: string[]
  /** Generation metadata */
  metadata: {
    generatedAt: Date
    duration: number
    version: string
  }
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Enable verbose logging */
  verbose?: boolean
  /** Enable parallel execution where possible */
  parallel?: boolean
  /** Timeout per step in ms */
  stepTimeout?: number
  /** Total timeout in ms */
  totalTimeout?: number
  /** Default theme preset */
  defaultTheme?: string
  /** Default accessibility level */
  defaultA11yLevel?: "A" | "AA" | "AAA"
  /** Fail on accessibility errors */
  failOnA11yErrors?: boolean
}

/**
 * Worker interface for extensibility
 */
export interface Worker<TInput, TOutput> {
  /** Worker name */
  name: string
  /** Execute the worker */
  execute(input: TInput): Promise<TOutput>
  /** Validate input */
  validate?(input: TInput): boolean
}

/**
 * Event types for orchestrator
 */
export type OrchestratorEvent =
  | { type: "workflow:start"; requestId: string }
  | { type: "workflow:complete"; requestId: string; result: GenerationResult }
  | { type: "workflow:error"; requestId: string; error: string }
  | { type: "step:start"; requestId: string; step: string }
  | { type: "step:complete"; requestId: string; step: string; duration: number }
  | { type: "step:error"; requestId: string; step: string; error: string }

/**
 * Event listener type
 */
export type OrchestratorEventListener = (event: OrchestratorEvent) => void

/**
 * Pipeline definition for custom workflows
 */
export interface PipelineDefinition {
  /** Pipeline name */
  name: string
  /** Pipeline steps in order */
  steps: Array<{
    /** Step name */
    name: string
    /** Worker to execute */
    worker: string
    /** Whether step is required */
    required?: boolean
    /** Condition to run step */
    condition?: (state: WorkflowState) => boolean
    /** Transform input */
    transformInput?: (state: WorkflowState) => unknown
  }>
}
