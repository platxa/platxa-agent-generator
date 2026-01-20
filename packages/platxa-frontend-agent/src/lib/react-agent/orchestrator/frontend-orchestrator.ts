/**
 * Frontend Orchestrator
 *
 * Coordinates design analysis, component generation, animation,
 * theming, and accessibility validation into a unified workflow.
 */

import type {
  GenerationRequest,
  GenerationResult,
  WorkflowState,
  WorkflowStepSuccess,
  WorkflowStepFailed,
  GeneratedFile,
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventListener,
} from "./types"

import {
  analyzeDescription,
  type AnalysisResult,
  type DesignRequirements,
} from "../design-analyzer"

import {
  generateFromTemplate,
  toPascalCase as utilToPascalCase,
  type GeneratedComponent,
} from "../generators"

import {
  getAnimationForComponent,
  generateAnimationCode,
  withReducedMotion,
  type GeneratedAnimation,
} from "../animations"

import {
  generateTheme,
  getThemePreset,
  type GeneratedTheme,
} from "../theme"

import {
  audit,
  type AuditResult,
} from "../accessibility"

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Creates an initial workflow state
 */
function createWorkflowState(request: GenerationRequest): WorkflowState {
  return {
    id: generateRequestId(),
    request,
    status: "pending",
    steps: {},
  }
}

/**
 * Creates a successful workflow step
 */
function createSuccessStep<T>(
  name: string,
  data: T,
  duration?: number
): WorkflowStepSuccess<T> {
  return {
    name,
    status: "completed",
    data,
    duration,
    timestamp: new Date(),
  }
}

/**
 * Creates a failed workflow step
 */
function createFailedStep(
  name: string,
  error: string,
  duration?: number
): WorkflowStepFailed {
  return {
    name,
    status: "failed",
    error,
    duration,
    timestamp: new Date(),
  }
}

/**
 * Converts component type to pascal case for naming
 */
function toPascalCase(str: string): string {
  return utilToPascalCase(str)
}

/**
 * Maps design analyzer component type to generator template
 */
function mapComponentTypeToTemplate(
  componentType: string
): string {
  const mapping: Record<string, string> = {
    button: "button",
    card: "card",
    input: "input",
    modal: "dialog",
    dialog: "dialog",
    alert: "alert",
    badge: "badge",
    avatar: "avatar",
    tabs: "tabs",
    dropdown: "dropdown",
    checkbox: "checkbox",
    switch: "switch",
    slider: "slider",
    progress: "progress",
    tooltip: "tooltip",
    toast: "toast",
  }
  return mapping[componentType] || "button"
}

/**
 * Maps component type to animation component type
 */
function mapToAnimationComponent(
  componentType: string
): "button" | "card" | "modal" | "toast" | "list" | "nav" | "input" {
  const mapping: Record<string, "button" | "card" | "modal" | "toast" | "list" | "nav" | "input"> = {
    button: "button",
    card: "card",
    modal: "modal",
    dialog: "modal",
    alert: "toast",
    toast: "toast",
    tabs: "nav",
    navbar: "nav",
    sidebar: "nav",
    menu: "nav",
    input: "input",
    form: "input",
    dropdown: "input",
    list: "list",
    table: "list",
    grid: "list",
  }
  return mapping[componentType] || "button"
}

// ============================================================================
// Main Orchestrator Class
// ============================================================================

/**
 * Frontend Orchestrator
 *
 * Coordinates all workers to generate complete UI components from
 * natural language descriptions.
 */
export class FrontendOrchestrator {
  private config: OrchestratorConfig
  private listeners: OrchestratorEventListener[] = []

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      verbose: false,
      parallel: false,
      stepTimeout: 30000,
      totalTimeout: 120000,
      defaultTheme: "default",
      defaultA11yLevel: "AA",
      failOnA11yErrors: false,
      ...config,
    }
  }

  /**
   * Adds an event listener
   */
  on(listener: OrchestratorEventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Emits an event to all listeners
   */
  private emit(event: OrchestratorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Logs if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Orchestrator] ${message}`)
    }
  }

  /**
   * Main generation method
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const state = createWorkflowState(request)
    state.status = "running"
    state.startedAt = new Date()

    this.emit({ type: "workflow:start", requestId: state.id })
    this.log(`Starting workflow ${state.id}`)

    const warnings: string[] = []
    const files: GeneratedFile[] = []

    try {
      // Step 1: Analyze description
      const analyzeResult = await this.executeStep(
        state,
        "analyze",
        () => this.analyzeStep(request)
      )

      if (!analyzeResult.success) {
        state.steps.analyze = createFailedStep("analyze", analyzeResult.error, analyzeResult.duration)
        throw new Error("Design analysis failed")
      }

      const analysisResult = analyzeResult.result
      state.steps.analyze = createSuccessStep("analyze", analysisResult, analyzeResult.duration)
      const requirements = analysisResult.primary

      // Step 2: Generate component
      const generateResult = await this.executeStep(
        state,
        "generate",
        () => this.generateStep(request, requirements)
      )

      if (!generateResult.success) {
        state.steps.generate = createFailedStep("generate", generateResult.error, generateResult.duration)
        throw new Error("Component generation failed")
      }

      const componentResult = generateResult.result
      state.steps.generate = createSuccessStep("generate", componentResult, generateResult.duration)

      // Add component file
      files.push({
        path: componentResult.fileName,
        content: componentResult.code,
        type: "component",
        language: "typescript",
      })

      // Step 3: Generate animations (if enabled)
      let animationResult: GeneratedAnimation | undefined
      if (request.animations?.enabled !== false) {
        const animateResult = await this.executeStep(
          state,
          "animate",
          () => this.animateStep(requirements, request)
        )

        if (animateResult.success) {
          animationResult = animateResult.result
          state.steps.animate = createSuccessStep("animate", animationResult, animateResult.duration)
        } else {
          state.steps.animate = createFailedStep("animate", animateResult.error, animateResult.duration)
        }
      }

      // Step 4: Generate theme (if specified)
      let themeResult: GeneratedTheme | undefined
      if (request.theme) {
        const themeStepResult = await this.executeStep(
          state,
          "theme",
          () => this.themeStep(request)
        )

        if (themeStepResult.success) {
          themeResult = themeStepResult.result
          state.steps.theme = createSuccessStep("theme", themeResult, themeStepResult.duration)

          files.push({
            path: "theme.css",
            content: themeResult.css,
            type: "theme",
            language: "css",
          })
        } else {
          state.steps.theme = createFailedStep("theme", themeStepResult.error, themeStepResult.duration)
        }
      }

      // Step 5: Run accessibility audit (if enabled)
      let auditResult: AuditResult | undefined
      if (request.accessibility?.audit !== false) {
        const a11yResult = await this.executeStep(
          state,
          "accessibility",
          () => this.accessibilityStep(requirements)
        )

        if (a11yResult.success) {
          auditResult = a11yResult.result
          state.steps.accessibility = createSuccessStep("accessibility", auditResult, a11yResult.duration)

          if (!auditResult.passed) {
            warnings.push(
              `Accessibility audit found ${auditResult.bySeverity.errors} errors`
            )
            if (this.config.failOnA11yErrors) {
              throw new Error("Accessibility audit failed")
            }
          }
        } else {
          state.steps.accessibility = createFailedStep("accessibility", a11yResult.error, a11yResult.duration)
        }
      }

      // Get component name from filename
      const componentName = componentResult.fileName.replace(/\.tsx$/, "")

      // Add test file if requested
      if (request.includeTests) {
        files.push({
          path: `${componentName}.test.tsx`,
          content: this.generateTestFile(componentName),
          type: "test",
          language: "typescript",
        })
      }

      // Add story file if requested
      if (request.includeStories) {
        files.push({
          path: `${componentName}.stories.tsx`,
          content: this.generateStoryFile(componentName),
          type: "story",
          language: "typescript",
        })
      }

      // Add analysis warnings/suggestions
      if (analysisResult.warnings) {
        warnings.push(...analysisResult.warnings)
      }
      if (analysisResult.suggestions) {
        warnings.push(...analysisResult.suggestions.map((s) => `Suggestion: ${s}`))
      }

      // Complete workflow
      state.status = "completed"
      state.completedAt = new Date()
      state.totalDuration = state.completedAt.getTime() - state.startedAt!.getTime()

      const result: GenerationResult = {
        success: true,
        workflow: state,
        files,
        requirements,
        component: componentResult,
        animation: animationResult,
        theme: themeResult,
        audit: auditResult,
        warnings,
        metadata: {
          generatedAt: new Date(),
          duration: state.totalDuration,
          version: "1.0.0",
        },
      }

      this.emit({ type: "workflow:complete", requestId: state.id, result })
      this.log(`Workflow ${state.id} completed in ${state.totalDuration}ms`)

      return result
    } catch (error) {
      state.status = "failed"
      state.completedAt = new Date()
      state.totalDuration = state.completedAt.getTime() - state.startedAt!.getTime()

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emit({ type: "workflow:error", requestId: state.id, error: errorMessage })
      this.log(`Workflow ${state.id} failed: ${errorMessage}`)

      // Return failed result
      return {
        success: false,
        workflow: state,
        files: [],
        requirements: {
          componentType: "unknown",
          category: "display",
          confidence: 0,
          keywords: [],
          originalDescription: request.description,
        },
        component: {
          fileName: "Unknown.tsx",
          code: "",
          exports: [],
          dependencies: [],
          atomicType: "atom",
        },
        warnings: [errorMessage, ...warnings],
        metadata: {
          generatedAt: new Date(),
          duration: state.totalDuration || 0,
          version: "1.0.0",
        },
      }
    }
  }

  /**
   * Runs a workflow step with timing and error handling
   */
  private async executeStep<T>(
    state: WorkflowState,
    stepName: string,
    executor: () => Promise<T>
  ): Promise<{ success: true; result: T; duration: number } | { success: false; error: string; duration: number }> {
    this.emit({ type: "step:start", requestId: state.id, step: stepName })
    this.log(`Starting step: ${stepName}`)

    const startTime = Date.now()

    try {
      const result = await executor()
      const duration = Date.now() - startTime

      this.emit({ type: "step:complete", requestId: state.id, step: stepName, duration })
      this.log(`Step ${stepName} completed in ${duration}ms`)

      return { success: true, result, duration }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.emit({ type: "step:error", requestId: state.id, step: stepName, error: errorMessage })
      this.log(`Step ${stepName} failed: ${errorMessage}`)

      return { success: false, error: errorMessage, duration }
    }
  }

  /**
   * Step 1: Analyze description
   */
  private async analyzeStep(request: GenerationRequest): Promise<AnalysisResult> {
    return analyzeDescription(request.description, {
      includeAlternatives: true,
    })
  }

  /**
   * Step 2: Generate component
   */
  private async generateStep(
    request: GenerationRequest,
    requirements: DesignRequirements
  ): Promise<GeneratedComponent> {
    const templateName = mapComponentTypeToTemplate(requirements.componentType)

    // Determine component name
    const componentName = request.componentName ||
      toPascalCase(requirements.componentType) ||
      "Component"

    return generateFromTemplate(templateName, { name: componentName })
  }

  /**
   * Step 3: Generate animations
   */
  private async animateStep(
    requirements: DesignRequirements,
    request: GenerationRequest
  ): Promise<GeneratedAnimation> {
    const componentType = mapToAnimationComponent(requirements.componentType)
    let animation = getAnimationForComponent(componentType)

    // Apply reduced motion if requested
    if (request.animations?.reducedMotion) {
      animation = withReducedMotion(animation, { behavior: "simplify" })
    }

    return generateAnimationCode(animation, toPascalCase(requirements.componentType))
  }

  /**
   * Step 4: Generate theme
   */
  private async themeStep(request: GenerationRequest): Promise<GeneratedTheme> {
    const themeConfig = typeof request.theme === "string"
      ? getThemePreset(request.theme)
      : request.theme!

    return generateTheme(themeConfig)
  }

  /**
   * Step 5: Run accessibility audit
   */
  private async accessibilityStep(
    requirements: DesignRequirements
  ): Promise<AuditResult> {
    // Extract colors from requirements for contrast checking
    const contrastChecks: Array<{ foreground: string; background: string; element?: string }> = []

    if (requirements.colors) {
      if (requirements.colors.foreground && requirements.colors.background) {
        contrastChecks.push({
          foreground: requirements.colors.foreground,
          background: requirements.colors.background,
          element: "main content",
        })
      }
      if (requirements.colors.primary) {
        // Check primary color on white background
        contrastChecks.push({
          foreground: "#ffffff",
          background: requirements.colors.primary,
          element: "primary button text",
        })
      }
    }

    return audit(
      {
        contrast: contrastChecks.length > 0 ? contrastChecks : undefined,
      },
      {
        level: this.config.defaultA11yLevel,
        includeWarnings: true,
      }
    )
  }

  /**
   * Generates a basic test file for the component
   */
  private generateTestFile(componentName: string): string {
    return `import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ${componentName} } from "./${componentName}"

describe("${componentName}", () => {
  it("renders without crashing", () => {
    render(<${componentName}>Test</${componentName}>)
    expect(screen.getByText("Test")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    render(<${componentName} className="custom-class">Test</${componentName}>)
    const element = screen.getByText("Test")
    expect(element.className).toContain("custom-class")
  })

  it("supports variants", () => {
    render(<${componentName} variant="default">Test</${componentName}>)
    expect(screen.getByText("Test")).toBeInTheDocument()
  })
})
`
  }

  /**
   * Generates a basic Storybook story file
   */
  private generateStoryFile(componentName: string): string {
    return `import type { Meta, StoryObj } from "@storybook/react"
import { ${componentName} } from "./${componentName}"

const meta: Meta<typeof ${componentName}> = {
  title: "Components/${componentName}",
  component: ${componentName},
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof ${componentName}>

export const Default: Story = {
  args: {
    children: "${componentName}",
  },
}

export const WithVariant: Story = {
  args: {
    children: "${componentName} with variant",
    variant: "default",
  },
}
`
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates an orchestrator instance with default config
 */
export function createOrchestrator(
  config?: OrchestratorConfig
): FrontendOrchestrator {
  return new FrontendOrchestrator(config)
}

/**
 * Quick generation function for simple use cases
 */
export async function generateFromDescription(
  description: string,
  options?: Partial<GenerationRequest>
): Promise<GenerationResult> {
  const orchestrator = new FrontendOrchestrator()
  return orchestrator.generate({
    description,
    ...options,
  })
}

/**
 * Validates a generation request
 */
export function validateRequest(request: GenerationRequest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!request.description) {
    errors.push("Description is required")
  }

  if (request.description && request.description.length < 3) {
    errors.push("Description must be at least 3 characters")
  }

  if (request.description && request.description.length > 2000) {
    errors.push("Description must be less than 2000 characters")
  }

  if (request.framework && !["react", "vue", "svelte"].includes(request.framework)) {
    errors.push("Invalid framework (must be react, vue, or svelte)")
  }

  if (request.styling && !["tailwind", "css", "styled-components"].includes(request.styling)) {
    errors.push("Invalid styling option")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
