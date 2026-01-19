/**
 * Example: UI Generator Agent using ReAct Pattern
 *
 * Demonstrates how to build a front-end AI agent that generates
 * React components using the ReAct (Reasoning and Acting) pattern.
 *
 * This agent can:
 * 1. Analyze UI requirements
 * 2. Search for existing patterns
 * 3. Generate component code
 * 4. Validate the output
 */

import {
  createAgent,
  createAction,
  type ActionResult,
  type AgentOutput,
  type ReasoningEngine,
  type ReasoningResult,
  type Observation,
  type ActionDefinition,
} from "../index"

// ============================================================================
// Action Definitions
// ============================================================================

/**
 * Action: Analyze UI requirements from a description
 */
const analyzeRequirementsAction = createAction({
  name: "analyze_requirements",
  description: "Analyzes UI requirements from a natural language description",
  parameters: {
    description: {
      type: "string",
      description: "Natural language description of the UI component",
      required: true,
    },
  },
  execute: async (params): Promise<ActionResult> => {
    const description = params.description as string

    // Simulated analysis - in production, this would use an LLM
    const requirements = {
      componentType: inferComponentType(description),
      features: extractFeatures(description),
      styling: extractStylingHints(description),
      accessibility: ["keyboard-navigation", "aria-labels", "focus-management"],
    }

    return {
      success: true,
      output: requirements,
      metadata: { analyzedAt: Date.now() },
    }
  },
})

/**
 * Action: Search for existing patterns in the codebase
 */
const searchPatternsAction = createAction({
  name: "search_patterns",
  description: "Searches for existing UI patterns that match requirements",
  parameters: {
    componentType: {
      type: "string",
      description: "Type of component to search for",
      required: true,
    },
    features: {
      type: "array",
      description: "List of features to match",
      required: false,
    },
  },
  execute: async (params): Promise<ActionResult> => {
    const componentType = params.componentType as string

    // Simulated pattern search - in production, this would search the codebase
    const patterns = getMatchingPatterns(componentType)

    return {
      success: patterns.length > 0,
      output: patterns,
      metadata: { matchCount: patterns.length },
    }
  },
})

/**
 * Action: Generate React component code
 */
const generateComponentAction = createAction({
  name: "generate_component",
  description: "Generates React component code based on requirements and patterns",
  parameters: {
    requirements: {
      type: "object",
      description: "Component requirements from analysis",
      required: true,
    },
    patterns: {
      type: "array",
      description: "Matching patterns to use as reference",
      required: false,
    },
    componentName: {
      type: "string",
      description: "Name for the generated component",
      required: true,
    },
  },
  execute: async (params): Promise<ActionResult> => {
    const requirements = params.requirements as ComponentRequirements
    const componentName = params.componentName as string

    // Generate component code
    const code = generateReactComponent(componentName, requirements)

    return {
      success: true,
      output: {
        code,
        componentName,
        exports: [componentName, `${componentName}Props`],
      },
    }
  },
})

/**
 * Action: Validate generated component
 */
const validateComponentAction = createAction({
  name: "validate_component",
  description: "Validates generated component for TypeScript errors and best practices",
  parameters: {
    code: {
      type: "string",
      description: "Component code to validate",
      required: true,
    },
  },
  execute: async (params): Promise<ActionResult> => {
    const code = params.code as string

    // Simulated validation - in production, this would run actual checks
    const validationResult = validateCode(code)

    return {
      success: validationResult.isValid,
      output: validationResult,
      error: validationResult.isValid ? undefined : validationResult.errors.join(", "),
    }
  },
})

// ============================================================================
// Custom Reasoning Engine for UI Generation
// ============================================================================

/**
 * Custom reasoning engine that understands UI generation workflow
 */
const uiGeneratorReasoningEngine: ReasoningEngine = {
  async reason(
    task: string,
    observations: Observation[],
    context: Record<string, unknown>,
    availableActions: ActionDefinition[]
  ): Promise<ReasoningResult> {
    const completedActions = new Set(observations.map((o) => o.actionName))
    const lastObservation = observations[observations.length - 1]

    // Phase 1: Analyze requirements first
    if (!completedActions.has("analyze_requirements")) {
      return {
        thought: `Starting UI generation task: "${task}". First, I need to analyze the requirements to understand what component to build.`,
        nextAction: "analyze_requirements",
        confidence: 0.95,
        shouldContinue: true,
        metadata: { phase: "analysis" },
      }
    }

    // Phase 2: Search for existing patterns
    if (!completedActions.has("search_patterns")) {
      const requirements = getRequirementsFromObservations(observations)
      return {
        thought: `Requirements analyzed: ${requirements.componentType} with ${requirements.features.length} features. Now searching for existing patterns to maintain consistency.`,
        nextAction: "search_patterns",
        confidence: 0.9,
        shouldContinue: true,
        metadata: { phase: "pattern_search", requirements },
      }
    }

    // Phase 3: Generate component
    if (!completedActions.has("generate_component")) {
      return {
        thought: `Found matching patterns. Now generating the React component code based on requirements and patterns.`,
        nextAction: "generate_component",
        confidence: 0.85,
        shouldContinue: true,
        metadata: { phase: "generation" },
      }
    }

    // Phase 4: Validate component
    if (!completedActions.has("validate_component")) {
      return {
        thought: `Component generated. Validating for TypeScript errors and best practices.`,
        nextAction: "validate_component",
        confidence: 0.9,
        shouldContinue: true,
        metadata: { phase: "validation" },
      }
    }

    // All phases complete - check validation result
    if (lastObservation?.actionName === "validate_component") {
      const validationResult = lastObservation.result.output as ValidationResult
      if (validationResult.isValid) {
        return {
          thought: `Component successfully generated and validated. All checks passed with score ${validationResult.score}/10.`,
          nextAction: null,
          confidence: 0.95,
          shouldContinue: false,
          metadata: { phase: "complete", validationScore: validationResult.score },
        }
      } else {
        // In a more sophisticated agent, we would re-generate or fix
        return {
          thought: `Validation failed: ${validationResult.errors.join(", ")}. Completing with partial success.`,
          nextAction: null,
          confidence: 0.5,
          shouldContinue: false,
          metadata: { phase: "complete_with_errors", errors: validationResult.errors },
        }
      }
    }

    // Fallback
    return {
      thought: `Unexpected state. Completing task.`,
      nextAction: null,
      confidence: 0.3,
      shouldContinue: false,
    }
  },
}

// ============================================================================
// Helper Types and Functions
// ============================================================================

interface ComponentRequirements {
  componentType: string
  features: string[]
  styling: Record<string, string>
  accessibility: string[]
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

interface UIPattern {
  name: string
  template: string
  tags: string[]
}

function inferComponentType(description: string): string {
  const lower = description.toLowerCase()
  if (lower.includes("button")) return "button"
  if (lower.includes("input") || lower.includes("field")) return "input"
  if (lower.includes("card")) return "card"
  if (lower.includes("modal") || lower.includes("dialog")) return "dialog"
  if (lower.includes("dropdown") || lower.includes("select")) return "select"
  if (lower.includes("table")) return "table"
  if (lower.includes("form")) return "form"
  return "div"
}

function extractFeatures(description: string): string[] {
  const features: string[] = []
  const lower = description.toLowerCase()

  if (lower.includes("variant")) features.push("variants")
  if (lower.includes("size")) features.push("sizes")
  if (lower.includes("disabled")) features.push("disabled-state")
  if (lower.includes("loading")) features.push("loading-state")
  if (lower.includes("icon")) features.push("icon-support")
  if (lower.includes("click") || lower.includes("interact")) features.push("interactive")

  return features.length > 0 ? features : ["basic"]
}

function extractStylingHints(description: string): Record<string, string> {
  const hints: Record<string, string> = {}
  const lower = description.toLowerCase()

  if (lower.includes("primary")) hints.variant = "primary"
  if (lower.includes("secondary")) hints.variant = "secondary"
  if (lower.includes("small")) hints.size = "sm"
  if (lower.includes("large")) hints.size = "lg"
  if (lower.includes("rounded")) hints.radius = "rounded"
  if (lower.includes("shadow")) hints.shadow = "shadow"

  return hints
}

function getMatchingPatterns(componentType: string): UIPattern[] {
  // Simulated pattern database
  const patternDatabase: Record<string, UIPattern[]> = {
    button: [
      { name: "BasicButton", template: "button-basic", tags: ["interactive"] },
      { name: "IconButton", template: "button-icon", tags: ["icon", "interactive"] },
    ],
    input: [
      { name: "TextInput", template: "input-text", tags: ["form", "validation"] },
      { name: "SearchInput", template: "input-search", tags: ["search", "icon"] },
    ],
    card: [
      { name: "BasicCard", template: "card-basic", tags: ["container"] },
      { name: "InteractiveCard", template: "card-interactive", tags: ["clickable"] },
    ],
  }

  return patternDatabase[componentType] ?? []
}

function getRequirementsFromObservations(observations: Observation[]): ComponentRequirements {
  const analysisObs = observations.find((o) => o.actionName === "analyze_requirements")
  if (analysisObs?.result.success) {
    return analysisObs.result.output as ComponentRequirements
  }
  return {
    componentType: "unknown",
    features: [],
    styling: {},
    accessibility: [],
  }
}

function generateReactComponent(name: string, requirements: ComponentRequirements): string {
  const hasVariants = requirements.features.includes("variants")
  const hasSizes = requirements.features.includes("sizes")

  return `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const ${name.toLowerCase()}Variants = cva(
  ["inline-flex items-center justify-center"],
  {
    variants: {
      ${hasVariants ? `variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
      },` : ""}
      ${hasSizes ? `size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },` : ""}
    },
    defaultVariants: {
      ${hasVariants ? 'variant: "default",' : ""}
      ${hasSizes ? 'size: "md",' : ""}
    },
  }
)

export interface ${name}Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof ${name.toLowerCase()}Variants> {
  /** Whether the component is disabled */
  disabled?: boolean
}

const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(
  ({ className, ${hasVariants ? "variant," : ""} ${hasSizes ? "size," : ""} disabled, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        ${name.toLowerCase()}Variants({ ${hasVariants ? "variant," : ""} ${hasSizes ? "size," : ""} }),
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      aria-disabled={disabled}
      {...props}
    />
  )
)
${name}.displayName = "${name}"

export { ${name}, ${name.toLowerCase()}Variants }
`
}

function validateCode(code: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Basic validation checks
  if (!code.includes("forwardRef")) {
    errors.push("Component should use forwardRef for ref forwarding")
  }
  if (!code.includes("displayName")) {
    warnings.push("Component should have displayName set")
  }
  if (!code.includes("aria-")) {
    warnings.push("Consider adding more ARIA attributes for accessibility")
  }
  if (!code.includes("cn(")) {
    errors.push("Should use cn() utility for class merging")
  }

  const score = 10 - errors.length * 2 - warnings.length * 0.5

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, score),
  }
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Creates a UI Generator Agent with the ReAct pattern
 *
 * @example
 * ```typescript
 * const agent = createUIGeneratorAgent({ verbose: true })
 * const result = await agent.run({
 *   task: "Create a primary button with variants and sizes",
 * })
 * console.log(result.result) // Generated component code
 * ```
 */
export function createUIGeneratorAgent(options: {
  verbose?: boolean
  maxIterations?: number
} = {}) {
  return createAgent()
    .withActions([
      analyzeRequirementsAction,
      searchPatternsAction,
      generateComponentAction,
      validateComponentAction,
    ])
    .withConfig({
      maxIterations: options.maxIterations ?? 10,
      verbose: options.verbose ?? false,
      stepTimeoutMs: 30000,
      minConfidenceThreshold: 0.3,
    })
    .withReasoningEngine(uiGeneratorReasoningEngine)
    .withHooks({
      onComplete: async (output: AgentOutput) => {
        if (options.verbose) {
          console.log("\n=== UI Generation Complete ===")
          console.log(`Success: ${output.success}`)
          console.log(`Total Steps: ${output.totalSteps}`)
          console.log(`Execution Time: ${output.executionTimeMs}ms`)
        }
      },
    })
    .build()
}

// ============================================================================
// Demo Usage
// ============================================================================

/**
 * Demonstrates the UI Generator Agent
 */
export async function demoUIGeneratorAgent(): Promise<void> {
  console.log("Creating UI Generator Agent...")

  const agent = createUIGeneratorAgent({ verbose: true })

  console.log("\nRunning agent with task: 'Create a button component with variants and sizes'\n")

  const result = await agent.run({
    task: "Create a button component with primary and secondary variants, and small, medium, large sizes",
    context: {
      framework: "react",
      styling: "tailwind",
      componentLibrary: "shadcn",
    },
  })

  console.log("\n=== Final Result ===")
  console.log("Success:", result.success)
  console.log("Reasoning:", result.reasoning)
  console.log("\nGenerated Output:", JSON.stringify(result.result, null, 2))
}
