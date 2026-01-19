/**
 * UI Generation Coordinator Example
 *
 * Demonstrates the orchestrator-workers pattern for a multi-agent
 * UI generation workflow with specialized sub-agents.
 *
 * @example
 * ```typescript
 * import { createUIGenerationCoordinator } from "./ui-generation-coordinator"
 *
 * const coordinator = createUIGenerationCoordinator()
 *
 * // Generate a complete UI component
 * const result = await coordinator.generateComponent({
 *   description: "Create a modern login form with email and credential fields",
 *   style: "modern",
 *   includeAnimation: true,
 * })
 * ```
 */

import { createAction } from "../../agent"
import {
  Coordinator,
  createCoordinator,
  createSubAgent,
  CommonCapabilities,
  createCapability,
} from "../index"

// ============================================================================
// Specialized Actions for Each Agent
// ============================================================================

/**
 * Design Analysis Action
 * Analyzes UI requirements and extracts design specifications
 */
const analyzeDesignAction = createAction({
  name: "analyze_design",
  description: "Analyzes UI requirements and extracts design specifications",
  parameters: {
    description: {
      type: "string",
      description: "The UI component description to analyze",
      required: true,
    },
    context: {
      type: "object",
      description: "Additional context about the design requirements",
      required: false,
    },
  },
  execute: async (_params) => {
    // In production, this would call an LLM to analyze the design
    const analysis = {
      componentType: "form",
      elements: ["input", "button", "label"],
      layout: "vertical",
      colorScheme: "neutral",
      spacing: "comfortable",
      responsive: true,
      accessibility: {
        ariaLabels: true,
        keyboardNav: true,
        focusManagement: true,
      },
    }

    return {
      success: true,
      output: {
        analysis,
        recommendations: [
          "Use semantic HTML elements",
          "Include proper ARIA labels",
          "Implement keyboard navigation",
        ],
      },
    }
  },
})

/**
 * Component Generation Action
 * Generates React component code from specifications
 */
const generateComponentAction = createAction({
  name: "generate_component",
  description: "Generates React component code from design specifications",
  parameters: {
    specification: {
      type: "object",
      description: "The component specification from design analysis",
      required: true,
    },
    framework: {
      type: "string",
      description: "Target framework (react, vue, etc.)",
      required: false,
    },
  },
  execute: async (_params) => {
    // In production, this would call an LLM to generate code
    // This is a simplified example showing the structure
    const componentCode = `
import * as React from "react"
import { cn } from "@/lib/utils"

export interface AuthFormProps {
  onSubmit: (data: { email: string; credential: string }) => void
  className?: string
}

export const AuthForm = React.forwardRef<HTMLFormElement, AuthFormProps>(
  ({ onSubmit, className, ...props }, ref) => {
    const [formData, setFormData] = React.useState({
      email: "",
      credential: "",
    })

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      onSubmit(formData)
    }

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }))
    }

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleChange("email")}
            className="w-full rounded-md border px-3 py-2"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="credential" className="text-sm font-medium">
            Credential
          </label>
          <input
            id="credential"
            type="password"
            value={formData.credential}
            onChange={handleChange("credential")}
            className="w-full rounded-md border px-3 py-2"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-white"
        >
          Sign In
        </button>
      </form>
    )
  }
)
AuthForm.displayName = "AuthForm"
`

    return {
      success: true,
      output: {
        code: componentCode,
        fileName: "AuthForm.tsx",
        exports: ["AuthForm", "AuthFormProps"],
      },
    }
  },
})

/**
 * Animation Enhancement Action
 * Adds Framer Motion animations to components
 */
const addAnimationAction = createAction({
  name: "add_animation",
  description: "Adds Framer Motion animations to a component",
  parameters: {
    componentCode: {
      type: "string",
      description: "The component code to enhance",
      required: true,
    },
    animationType: {
      type: "string",
      description: "Type of animation (fade, slide, scale, etc.)",
      required: false,
    },
  },
  execute: async (_params) => {
    // In production, this would transform the code to add animations
    const animatedCode = `
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
}

export const AuthForm = React.forwardRef<HTMLFormElement, AuthFormProps>(
  ({ onSubmit, className, ...props }, ref) => {
    // ... component with motion.div wrappers
    return (
      <motion.form
        ref={ref}
        variants={formVariants}
        initial="hidden"
        animate="visible"
        className={cn("flex flex-col gap-4", className)}
      >
        {/* Animated fields */}
      </motion.form>
    )
  }
)
`

    return {
      success: true,
      output: {
        code: animatedCode,
        animations: ["fade-in", "stagger-children", "slide-up"],
        reducedMotionSupport: true,
      },
    }
  },
})

/**
 * Accessibility Audit Action
 * Validates WCAG 2.2 compliance
 */
const auditAccessibilityAction = createAction({
  name: "audit_accessibility",
  description: "Audits component for WCAG 2.2 accessibility compliance",
  parameters: {
    componentCode: {
      type: "string",
      description: "The component code to audit",
      required: true,
    },
    level: {
      type: "string",
      description: "WCAG compliance level (A, AA, AAA)",
      required: false,
    },
  },
  execute: async (_params) => {
    // In production, this would analyze the code for accessibility issues
    const auditResult = {
      passed: true,
      level: "AA",
      score: 95,
      checks: [
        { rule: "color-contrast", status: "pass" },
        { rule: "label-association", status: "pass" },
        { rule: "keyboard-accessible", status: "pass" },
        { rule: "focus-visible", status: "pass" },
        { rule: "aria-labels", status: "pass" },
      ],
      warnings: [
        {
          rule: "touch-target-size",
          message: "Consider increasing button touch target to 44x44px",
        },
      ],
      suggestions: [
        "Add aria-describedby for field requirements",
        "Consider adding autocomplete attributes",
      ],
    }

    return {
      success: true,
      output: auditResult,
    }
  },
})

/**
 * Theme Generation Action
 * Generates CSS variables and design tokens
 */
const generateThemeAction = createAction({
  name: "generate_theme",
  description: "Generates CSS variables and design tokens for theming",
  parameters: {
    colorScheme: {
      type: "string",
      description: "The color scheme (light, dark, auto)",
      required: false,
    },
    brandColors: {
      type: "object",
      description: "Brand color definitions",
      required: false,
    },
  },
  execute: async (_params) => {
    const theme = {
      colors: {
        primary: "hsl(220 90% 56%)",
        secondary: "hsl(220 14% 96%)",
        foreground: "hsl(220 9% 8%)",
        background: "hsl(0 0% 100%)",
        muted: "hsl(220 14% 96%)",
        border: "hsl(220 13% 91%)",
      },
      spacing: {
        xs: "0.25rem",
        sm: "0.5rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        full: "9999px",
      },
      cssVariables: `
:root {
  --color-primary: 220 90% 56%;
  --color-secondary: 220 14% 96%;
  --color-foreground: 220 9% 8%;
  --color-background: 0 0% 100%;
  --radius: 0.5rem;
}

.dark {
  --color-primary: 220 90% 66%;
  --color-foreground: 0 0% 98%;
  --color-background: 220 9% 8%;
}
`,
    }

    return {
      success: true,
      output: theme,
    }
  },
})

// ============================================================================
// Specialized Sub-Agents
// ============================================================================

/**
 * Creates the Design Analyzer sub-agent
 */
const createDesignAnalyzerAgent = () =>
  createSubAgent({
    id: "design-analyzer",
    name: "Design Analyzer",
    capabilities: [
      CommonCapabilities.DESIGN_ANALYSIS,
      createCapability(
        "requirements-extraction",
        "Requirements Extraction",
        "Extracts UI requirements from descriptions",
        ["requirements", "analysis", "ui"]
      ),
    ],
    maxConcurrency: 3,
    taskTimeoutMs: 30000,
    actions: [analyzeDesignAction],
  })

/**
 * Creates the Component Generator sub-agent
 */
const createComponentGeneratorAgent = () =>
  createSubAgent({
    id: "component-generator",
    name: "Component Generator",
    capabilities: [
      CommonCapabilities.CODE_GENERATION,
      createCapability(
        "react-generation",
        "React Generation",
        "Generates React/TypeScript components",
        ["react", "typescript", "component"]
      ),
    ],
    maxConcurrency: 2,
    taskTimeoutMs: 60000,
    actions: [generateComponentAction],
  })

/**
 * Creates the Animation Worker sub-agent
 */
const createAnimationWorkerAgent = () =>
  createSubAgent({
    id: "animation-worker",
    name: "Animation Worker",
    capabilities: [
      CommonCapabilities.ANIMATION,
      createCapability(
        "framer-motion",
        "Framer Motion",
        "Adds Framer Motion animations",
        ["animation", "framer", "motion", "transitions"]
      ),
    ],
    maxConcurrency: 2,
    taskTimeoutMs: 30000,
    actions: [addAnimationAction],
  })

/**
 * Creates the Accessibility Auditor sub-agent
 */
const createAccessibilityAuditorAgent = () =>
  createSubAgent({
    id: "accessibility-auditor",
    name: "Accessibility Auditor",
    capabilities: [
      CommonCapabilities.ACCESSIBILITY,
      createCapability(
        "wcag-audit",
        "WCAG Audit",
        "Audits for WCAG 2.2 compliance",
        ["wcag", "a11y", "audit", "compliance"]
      ),
    ],
    maxConcurrency: 3,
    taskTimeoutMs: 20000,
    actions: [auditAccessibilityAction],
  })

/**
 * Creates the Theme Worker sub-agent
 */
const createThemeWorkerAgent = () =>
  createSubAgent({
    id: "theme-worker",
    name: "Theme Worker",
    capabilities: [
      CommonCapabilities.THEMING,
      createCapability(
        "css-variables",
        "CSS Variables",
        "Generates CSS custom properties",
        ["css", "variables", "tokens", "theming"]
      ),
    ],
    maxConcurrency: 2,
    taskTimeoutMs: 15000,
    actions: [generateThemeAction],
  })

// ============================================================================
// UI Generation Coordinator
// ============================================================================

/**
 * Configuration for the UI generation coordinator
 */
export interface UIGenerationConfig {
  includeAnimation?: boolean
  includeAccessibilityAudit?: boolean
  includeTheming?: boolean
  verbose?: boolean
}

/**
 * Input for generating a UI component
 */
export interface GenerateComponentInput {
  description: string
  style?: "modern" | "minimal" | "classic"
  includeAnimation?: boolean
  colorScheme?: "light" | "dark" | "auto"
}

/**
 * Creates a fully configured UI generation coordinator
 */
export function createUIGenerationCoordinator(
  config: UIGenerationConfig = {}
): UIGenerationCoordinatorInstance {
  const {
    includeAnimation = true,
    includeAccessibilityAudit = true,
    includeTheming = true,
    verbose = false,
  } = config

  const coordinator = createCoordinator("ui-generation", "UI Generation Coordinator")
    .withDistributionStrategy("capability-match")
    .withAggregationStrategy("merge")
    .withMaxConcurrency(10)
    .withVerbose(verbose)
    .withAgent(createDesignAnalyzerAgent())
    .withAgent(createComponentGeneratorAgent())

  if (includeAnimation) {
    coordinator.withAgent(createAnimationWorkerAgent())
  }

  if (includeAccessibilityAudit) {
    coordinator.withAgent(createAccessibilityAuditorAgent())
  }

  if (includeTheming) {
    coordinator.withAgent(createThemeWorkerAgent())
  }

  const builtCoordinator = coordinator.withAutoStart(true).build()

  return new UIGenerationCoordinatorInstance(builtCoordinator, config)
}

/**
 * UI Generation Coordinator wrapper with high-level API
 */
class UIGenerationCoordinatorInstance {
  constructor(
    private coordinator: Coordinator,
    private config: UIGenerationConfig
  ) {}

  /**
   * Generates a complete UI component with all enhancements
   */
  async generateComponent(input: GenerateComponentInput): Promise<{
    success: boolean
    component?: {
      code: string
      fileName: string
      exports: string[]
    }
    animation?: {
      code: string
      animations: string[]
    }
    accessibility?: {
      passed: boolean
      score: number
      suggestions: string[]
    }
    theme?: {
      colors: Record<string, string>
      cssVariables: string
    }
    errors?: string[]
  }> {
    const errors: string[] = []
    const results: Record<string, unknown> = {}

    // Step 1: Analyze design
    const analysisResult = await this.coordinator.dispatch({
      type: "design-analysis",
      priority: "high",
      payload: {
        task: "Analyze design requirements",
        context: { description: input.description, style: input.style },
      },
      requiredCapabilities: ["design-analysis"],
      maxRetries: 2,
    })

    if (!analysisResult.success) {
      errors.push(`Design analysis failed: ${analysisResult.error}`)
      return { success: false, errors }
    }

    // Step 2: Generate component
    const componentResult = await this.coordinator.dispatch({
      type: "code-generation",
      priority: "high",
      payload: {
        task: "Generate React component",
        context: {
          specification: analysisResult.output.result,
          framework: "react",
        },
      },
      requiredCapabilities: ["code-generation"],
      maxRetries: 2,
    })

    if (!componentResult.success) {
      errors.push(`Component generation failed: ${componentResult.error}`)
      return { success: false, errors }
    }

    results.component = componentResult.output.result

    // Step 3: Run parallel tasks (animation, accessibility, theming)
    const parallelTasks = []

    if (input.includeAnimation ?? this.config.includeAnimation) {
      parallelTasks.push({
        type: "animation",
        priority: "medium" as const,
        payload: {
          task: "Add animations to component",
          context: {
            componentCode: (componentResult.output.result as { code: string }).code,
            animationType: "fade",
          },
        },
        requiredCapabilities: ["animation"],
        maxRetries: 1,
      })
    }

    if (this.config.includeAccessibilityAudit) {
      parallelTasks.push({
        type: "accessibility-audit",
        priority: "medium" as const,
        payload: {
          task: "Audit component accessibility",
          context: {
            componentCode: (componentResult.output.result as { code: string }).code,
            level: "AA",
          },
        },
        requiredCapabilities: ["accessibility"],
        maxRetries: 1,
      })
    }

    if (this.config.includeTheming) {
      parallelTasks.push({
        type: "theming",
        priority: "low" as const,
        payload: {
          task: "Generate theme tokens",
          context: { colorScheme: input.colorScheme ?? "auto" },
        },
        requiredCapabilities: ["theming"],
        maxRetries: 1,
      })
    }

    if (parallelTasks.length > 0) {
      const batchResult = await this.coordinator.dispatchBatch(parallelTasks)

      for (const result of batchResult.results) {
        if (result.success) {
          const output = result.output.result as Record<string, unknown>
          if (output.animations) {
            results.animation = output
          } else if (output.passed !== undefined) {
            results.accessibility = output
          } else if (output.cssVariables) {
            results.theme = output
          }
        }
      }
    }

    return {
      success: true,
      component: results.component as {
        code: string
        fileName: string
        exports: string[]
      },
      animation: results.animation as {
        code: string
        animations: string[]
      },
      accessibility: results.accessibility as {
        passed: boolean
        score: number
        suggestions: string[]
      },
      theme: results.theme as {
        colors: Record<string, string>
        cssVariables: string
      },
    }
  }

  /**
   * Gets the underlying coordinator
   */
  getCoordinator(): Coordinator {
    return this.coordinator
  }

  /**
   * Gets coordinator statistics
   */
  getStats() {
    return this.coordinator.getStats()
  }

  /**
   * Stops the coordinator
   */
  stop(): void {
    this.coordinator.stop()
  }
}

export { UIGenerationCoordinatorInstance }
