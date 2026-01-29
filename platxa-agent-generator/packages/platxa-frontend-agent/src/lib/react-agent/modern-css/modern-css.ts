/**
 * Modern CSS Utilities
 *
 * Generates modern CSS features including container queries,
 * :has() selector patterns, and gradient utilities.
 */

import type {
  ContainerType,
  ContainerBreakpoint,
  ContainerDefinition,
  ContainerQueryRule,
  ContainerQueryConfig,
  HasSelectorRule,
  GradientDirection,
  GradientStop,
  LinearGradientConfig,
  RadialGradientConfig,
  ConicGradientConfig,
  GradientConfig,
  GradientPreset,
  Transform3DConfig,
  ModernCssOutput,
} from "./types"

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert camelCase to kebab-case for CSS properties
 *
 * Root cause: CSS uses kebab-case (font-size) while JavaScript
 * typically uses camelCase (fontSize). This helper ensures proper
 * CSS output from JavaScript style objects.
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * Convert style object to CSS string with kebab-case properties
 */
function stylesToCss(styles: Record<string, string>, indent: string = "  "): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${indent}${camelToKebab(prop)}: ${value};`)
    .join("\n")
}

// =============================================================================
// Container Queries (Feature #44)
// =============================================================================

/**
 * Default container breakpoints (matches Tailwind)
 */
export const DEFAULT_CONTAINER_BREAKPOINTS: ContainerBreakpoint[] = [
  { name: "xs", minWidth: 320 },
  { name: "sm", minWidth: 384 },
  { name: "md", minWidth: 448 },
  { name: "lg", minWidth: 512 },
  { name: "xl", minWidth: 576 },
  { name: "2xl", minWidth: 672 },
  { name: "3xl", minWidth: 768 },
  { name: "4xl", minWidth: 896 },
  { name: "5xl", minWidth: 1024 },
]

/**
 * Create a container definition
 */
export function createContainer(
  name: string,
  type: ContainerType = "inline-size"
): ContainerDefinition {
  return { name, type }
}

/**
 * Generate CSS for container definition
 */
export function generateContainerCss(container: ContainerDefinition): string {
  return `.${container.name} {
  container-type: ${container.type};
  container-name: ${container.name};
}`
}

/**
 * Generate container query CSS
 *
 * Root cause: Container queries use @container not @media,
 * and can optionally specify which container to query by name.
 */
export function generateContainerQuery(rule: ContainerQueryRule): string {
  const containerPart = rule.container ? `${rule.container} ` : ""
  const styles = stylesToCss(rule.styles)

  return `@container ${containerPart}(${rule.condition}) {
${styles}
}`
}

/**
 * Generate responsive container query classes
 */
export function generateContainerBreakpointClasses(
  breakpoints: ContainerBreakpoint[] = DEFAULT_CONTAINER_BREAKPOINTS
): string {
  const classes: string[] = []

  for (const bp of breakpoints) {
    if (bp.minWidth) {
      classes.push(`/* @${bp.name} - min-width: ${bp.minWidth}px */`)
      classes.push(`@container (min-width: ${bp.minWidth}px) {`)
      classes.push(`  .\\@${bp.name}\\:block { display: block; }`)
      classes.push(`  .\\@${bp.name}\\:hidden { display: none; }`)
      classes.push(`  .\\@${bp.name}\\:flex { display: flex; }`)
      classes.push(`  .\\@${bp.name}\\:grid { display: grid; }`)
      classes.push(`}`)
      classes.push("")
    }
  }

  return classes.join("\n")
}

/**
 * Generate Tailwind v4 container query config
 */
export function generateTailwindContainerConfig(
  breakpoints: ContainerBreakpoint[] = DEFAULT_CONTAINER_BREAKPOINTS
): string {
  const lines = ["@theme {"]

  for (const bp of breakpoints) {
    if (bp.minWidth) {
      lines.push(`  --container-${bp.name}: ${bp.minWidth}px;`)
    }
  }

  lines.push("}")
  return lines.join("\n")
}

/**
 * Extended config that accepts breakpoints directly
 */
interface ExtendedContainerQueryConfig extends Partial<ContainerQueryConfig> {
  /** Direct breakpoints override (alias for defaultBreakpoints) */
  breakpoints?: ContainerBreakpoint[]
}

/**
 * Create container query system
 *
 * Root cause: API should accept both 'breakpoints' (intuitive) and
 * 'defaultBreakpoints' (from type) for flexibility.
 */
export function createContainerQuerySystem(
  config: ExtendedContainerQueryConfig = {}
): ModernCssOutput {
  // Accept both 'breakpoints' and 'defaultBreakpoints' for API flexibility
  const breakpoints = config.breakpoints || config.defaultBreakpoints || DEFAULT_CONTAINER_BREAKPOINTS
  const containers = config.containers || []

  const cssLines: string[] = [
    "/* Container Query System */",
    "",
  ]

  // Container definitions
  if (containers.length > 0) {
    cssLines.push("/* Container Definitions */")
    for (const container of containers) {
      cssLines.push(generateContainerCss(container))
      cssLines.push("")
    }
  }

  // Breakpoint classes
  cssLines.push("/* Container Breakpoint Utilities */")
  cssLines.push(generateContainerBreakpointClasses(breakpoints))

  return {
    css: cssLines.join("\n"),
    tailwindClasses: breakpoints.map((bp) => `@${bp.name}:`),
    browserSupport: {
      chrome: 105,
      firefox: 110,
      safari: 16,
      edge: 105,
    },
    fallback: "/* Fallback: Use media queries for older browsers */",
  }
}

// =============================================================================
// :has() Selector (Feature #45)
// =============================================================================

/**
 * Generate :has() selector CSS
 *
 * Root cause: :has() is a parent selector - it styles the element
 * that CONTAINS the matched selector, not the matched element itself.
 */
export function generateHasSelector(rule: HasSelectorRule): string {
  let hasContent: string

  switch (rule.pattern) {
    case "has-child":
      hasContent = `> ${rule.target}`
      break
    case "has-descendant":
      hasContent = rule.target
      break
    case "has-sibling":
      hasContent = `+ ${rule.target}`
      break
    case "has-checked":
      hasContent = `${rule.target}:checked`
      break
    case "has-focus":
      hasContent = `${rule.target}:focus`
      break
    case "has-empty":
      hasContent = `${rule.target}:empty`
      break
    case "has-hover":
      hasContent = `${rule.target}:hover`
      break
    default:
      hasContent = rule.target
  }

  const styles = stylesToCss(rule.styles)

  return `${rule.parent}:has(${hasContent}) {
${styles}
}`
}

/**
 * Common :has() patterns
 */
export const HAS_PATTERNS = {
  /**
   * Style form when it has invalid inputs
   */
  formInvalid: (formSelector: string = "form"): HasSelectorRule => ({
    parent: formSelector,
    pattern: "has-descendant",
    target: "input:invalid",
    styles: {
      "--form-border-color": "var(--destructive)",
    },
  }),

  /**
   * Style label when its input is focused
   */
  labelOnFocus: (labelSelector: string = "label"): HasSelectorRule => ({
    parent: labelSelector,
    pattern: "has-sibling",
    target: "input:focus",
    styles: {
      color: "var(--primary)",
      "font-weight": "500",
    },
  }),

  /**
   * Style card when checkbox inside is checked
   */
  cardChecked: (cardSelector: string = ".card"): HasSelectorRule => ({
    parent: cardSelector,
    pattern: "has-descendant",
    target: "input[type='checkbox']:checked",
    styles: {
      "border-color": "var(--primary)",
      "background-color": "var(--primary-50, hsl(var(--primary) / 0.05))",
    },
  }),

  /**
   * Style container when it's empty
   */
  emptyContainer: (selector: string = ".container"): HasSelectorRule => ({
    parent: selector,
    pattern: "has-empty",
    target: "*",
    styles: {
      display: "none",
    },
  }),

  /**
   * Style parent on child hover
   */
  parentOnChildHover: (
    parent: string,
    child: string
  ): HasSelectorRule => ({
    parent,
    pattern: "has-hover",
    target: child,
    styles: {
      "background-color": "var(--muted)",
    },
  }),
}

/**
 * Generate common :has() utilities
 */
export function generateHasUtilities(): ModernCssOutput {
  const cssLines = [
    "/* :has() Selector Utilities */",
    "",
    "/* Form validity styling */",
    generateHasSelector(HAS_PATTERNS.formInvalid()),
    "",
    "/* Label focus state */",
    generateHasSelector(HAS_PATTERNS.labelOnFocus()),
    "",
    "/* Card selection state */",
    generateHasSelector(HAS_PATTERNS.cardChecked()),
    "",
    "/* Generic has-* utilities */",
    ".has-\\[\\:focus\\]:ring-2:has(:focus) { --tw-ring-width: 2px; }",
    ".has-\\[\\:checked\\]:bg-primary:has(:checked) { background-color: var(--primary); }",
    ".has-\\[\\:disabled\\]:opacity-50:has(:disabled) { opacity: 0.5; }",
  ]

  return {
    css: cssLines.join("\n"),
    browserSupport: {
      chrome: 105,
      firefox: 121,
      safari: 15.4,
      edge: 105,
    },
    fallback: "/* Fallback: Use JavaScript for parent selection in older browsers */",
  }
}

// =============================================================================
// Gradients (Feature #46)
// =============================================================================

/**
 * Convert direction to CSS
 */
function directionToCss(direction: GradientDirection): string {
  if (typeof direction === "number") {
    return `${direction}deg`
  }

  const dirMap: Record<string, string> = {
    "to-t": "to top",
    "to-tr": "to top right",
    "to-r": "to right",
    "to-br": "to bottom right",
    "to-b": "to bottom",
    "to-bl": "to bottom left",
    "to-l": "to left",
    "to-tl": "to top left",
  }

  return dirMap[direction] || "to bottom"
}

/**
 * Convert color stops to CSS
 */
function stopsToCss(stops: GradientStop[]): string {
  return stops
    .map((stop) => {
      if (stop.position !== undefined) {
        const pos = typeof stop.position === "number" ? `${stop.position}%` : stop.position
        return `${stop.color} ${pos}`
      }
      return stop.color
    })
    .join(", ")
}

/**
 * Generate linear gradient CSS
 */
export function generateLinearGradient(config: LinearGradientConfig): string {
  const fn = config.repeating ? "repeating-linear-gradient" : "linear-gradient"
  const direction = directionToCss(config.direction)
  const stops = stopsToCss(config.stops)

  return `${fn}(${direction}, ${stops})`
}

/**
 * Generate radial gradient CSS
 */
export function generateRadialGradient(config: RadialGradientConfig): string {
  const fn = config.repeating ? "repeating-radial-gradient" : "radial-gradient"
  const parts: string[] = []

  if (config.shape || config.size) {
    const shape = config.shape || "ellipse"
    const size = config.size || "farthest-corner"
    parts.push(`${shape} ${size}`)
  }

  if (config.position) {
    parts.push(`at ${config.position}`)
  }

  const prefix = parts.length > 0 ? `${parts.join(" ")}, ` : ""
  const stops = stopsToCss(config.stops)

  return `${fn}(${prefix}${stops})`
}

/**
 * Generate conic gradient CSS
 */
export function generateConicGradient(config: ConicGradientConfig): string {
  const fn = config.repeating ? "repeating-conic-gradient" : "conic-gradient"
  const parts: string[] = []

  if (config.from !== undefined) {
    parts.push(`from ${config.from}deg`)
  }

  if (config.position) {
    parts.push(`at ${config.position}`)
  }

  const prefix = parts.length > 0 ? `${parts.join(" ")}, ` : ""
  const stops = stopsToCss(config.stops)

  return `${fn}(${prefix}${stops})`
}

/**
 * Generate gradient CSS from config
 */
export function generateGradient(config: GradientConfig): string {
  switch (config.type) {
    case "linear":
      return generateLinearGradient(config)
    case "radial":
      return generateRadialGradient(config)
    case "conic":
      return generateConicGradient(config)
  }
}

/**
 * Gradient presets
 */
export const GRADIENT_PRESETS: Record<string, GradientPreset> = {
  // Linear gradients
  "sunset": {
    name: "sunset",
    description: "Warm sunset gradient",
    gradient: {
      type: "linear",
      direction: "to-r",
      stops: [
        { color: "#f97316", position: 0 },
        { color: "#ec4899", position: 50 },
        { color: "#8b5cf6", position: 100 },
      ],
    },
    css: "",
  },
  "ocean": {
    name: "ocean",
    description: "Cool ocean gradient",
    gradient: {
      type: "linear",
      direction: "to-r",
      stops: [
        { color: "#06b6d4", position: 0 },
        { color: "#3b82f6", position: 50 },
        { color: "#6366f1", position: 100 },
      ],
    },
    css: "",
  },
  "forest": {
    name: "forest",
    description: "Natural forest gradient",
    gradient: {
      type: "linear",
      direction: "to-r",
      stops: [
        { color: "#22c55e", position: 0 },
        { color: "#14b8a6", position: 50 },
        { color: "#0ea5e9", position: 100 },
      ],
    },
    css: "",
  },
  "midnight": {
    name: "midnight",
    description: "Dark midnight gradient",
    gradient: {
      type: "linear",
      direction: "to-br",
      stops: [
        { color: "#1e293b", position: 0 },
        { color: "#0f172a", position: 100 },
      ],
    },
    css: "",
  },

  // Radial gradients
  "spotlight": {
    name: "spotlight",
    description: "Spotlight radial effect",
    gradient: {
      type: "radial",
      shape: "circle",
      size: "farthest-corner",
      position: "center",
      stops: [
        { color: "rgba(255,255,255,0.2)", position: 0 },
        { color: "transparent", position: 70 },
      ],
    },
    css: "",
  },
  "glow": {
    name: "glow",
    description: "Soft glow effect",
    gradient: {
      type: "radial",
      shape: "ellipse",
      position: "center",
      stops: [
        { color: "var(--primary)", position: 0 },
        { color: "transparent", position: 70 },
      ],
    },
    css: "",
  },

  // Conic gradients
  "rainbow": {
    name: "rainbow",
    description: "Rainbow conic gradient",
    gradient: {
      type: "conic",
      from: 0,
      position: "center",
      stops: [
        { color: "#ef4444", position: 0 },
        { color: "#f97316", position: 17 },
        { color: "#eab308", position: 33 },
        { color: "#22c55e", position: 50 },
        { color: "#3b82f6", position: 67 },
        { color: "#8b5cf6", position: 83 },
        { color: "#ef4444", position: 100 },
      ],
    },
    css: "",
  },
  "sweep": {
    name: "sweep",
    description: "Loading sweep effect",
    gradient: {
      type: "conic",
      from: 0,
      position: "center",
      stops: [
        { color: "var(--primary)", position: 0 },
        { color: "transparent", position: 30 },
      ],
    },
    css: "",
  },
}

// Initialize CSS for presets
for (const [key, preset] of Object.entries(GRADIENT_PRESETS)) {
  GRADIENT_PRESETS[key].css = generateGradient(preset.gradient)
}

/**
 * Generate gradient utility classes
 */
export function generateGradientUtilities(): ModernCssOutput {
  const cssLines = [
    "/* Gradient Utilities */",
    "",
    "/* Direction utilities */",
    ".bg-gradient-to-t { background-image: linear-gradient(to top, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-tr { background-image: linear-gradient(to top right, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-b { background-image: linear-gradient(to bottom, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-bl { background-image: linear-gradient(to bottom left, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-l { background-image: linear-gradient(to left, var(--tw-gradient-stops)); }",
    ".bg-gradient-to-tl { background-image: linear-gradient(to top left, var(--tw-gradient-stops)); }",
    "",
    "/* Radial gradient */",
    ".bg-gradient-radial { background-image: radial-gradient(var(--tw-gradient-stops)); }",
    ".bg-gradient-radial-at-t { background-image: radial-gradient(at top, var(--tw-gradient-stops)); }",
    ".bg-gradient-radial-at-c { background-image: radial-gradient(at center, var(--tw-gradient-stops)); }",
    ".bg-gradient-radial-at-b { background-image: radial-gradient(at bottom, var(--tw-gradient-stops)); }",
    "",
    "/* Conic gradient */",
    ".bg-gradient-conic { background-image: conic-gradient(var(--tw-gradient-stops)); }",
    "",
    "/* Preset gradients */",
  ]

  for (const [name, preset] of Object.entries(GRADIENT_PRESETS)) {
    cssLines.push(`.bg-gradient-${name} { background-image: ${preset.css}; }`)
  }

  return {
    css: cssLines.join("\n"),
    tailwindClasses: [
      "bg-gradient-to-*",
      "bg-gradient-radial",
      "bg-gradient-conic",
      "from-*",
      "via-*",
      "to-*",
    ],
    browserSupport: {
      chrome: 26,
      firefox: 16,
      safari: 7,
      edge: 12,
    },
  }
}

// =============================================================================
// 3D Transforms (Feature #49)
// =============================================================================

/**
 * Generate 3D transform CSS
 */
export function generate3DTransform(config: Transform3DConfig): string {
  const transforms: string[] = []

  if (config.rotateX !== undefined) transforms.push(`rotateX(${config.rotateX}deg)`)
  if (config.rotateY !== undefined) transforms.push(`rotateY(${config.rotateY}deg)`)
  if (config.rotateZ !== undefined) transforms.push(`rotateZ(${config.rotateZ}deg)`)
  if (config.translateZ) transforms.push(`translateZ(${config.translateZ})`)
  if (config.scaleZ !== undefined) transforms.push(`scaleZ(${config.scaleZ})`)

  const cssProps: string[] = []

  if (config.perspective) {
    cssProps.push(`perspective: ${config.perspective};`)
  }

  if (config.preserve3d) {
    cssProps.push("transform-style: preserve-3d;")
  }

  if (transforms.length > 0) {
    cssProps.push(`transform: ${transforms.join(" ")};`)
  }

  return cssProps.join("\n  ")
}

/**
 * Generate 3D transform utilities
 */
export function generate3DUtilities(): ModernCssOutput {
  const cssLines = [
    "/* 3D Transform Utilities */",
    "",
    "/* Perspective */",
    ".perspective-none { perspective: none; }",
    ".perspective-500 { perspective: 500px; }",
    ".perspective-1000 { perspective: 1000px; }",
    ".perspective-1500 { perspective: 1500px; }",
    "",
    "/* Transform style */",
    ".transform-style-flat { transform-style: flat; }",
    ".transform-style-3d { transform-style: preserve-3d; }",
    "",
    "/* Backface visibility */",
    ".backface-visible { backface-visibility: visible; }",
    ".backface-hidden { backface-visibility: hidden; }",
    "",
    "/* Rotate X */",
    ".rotate-x-0 { transform: rotateX(0deg); }",
    ".rotate-x-45 { transform: rotateX(45deg); }",
    ".rotate-x-90 { transform: rotateX(90deg); }",
    ".rotate-x-180 { transform: rotateX(180deg); }",
    "",
    "/* Rotate Y */",
    ".rotate-y-0 { transform: rotateY(0deg); }",
    ".rotate-y-45 { transform: rotateY(45deg); }",
    ".rotate-y-90 { transform: rotateY(90deg); }",
    ".rotate-y-180 { transform: rotateY(180deg); }",
  ]

  return {
    css: cssLines.join("\n"),
    browserSupport: {
      chrome: 36,
      firefox: 16,
      safari: 9,
      edge: 12,
    },
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Factory configuration
 */
export interface ModernCssSystemConfig {
  containerBreakpoints?: ContainerBreakpoint[]
}

/**
 * Modern CSS system interface
 */
export interface ModernCssSystem {
  containerQueries: {
    create: (config?: ExtendedContainerQueryConfig) => ModernCssOutput
    query: (rule: ContainerQueryRule) => string
    breakpoints: ContainerBreakpoint[]
  }
  hasSelector: {
    generate: (rule: HasSelectorRule) => string
    patterns: typeof HAS_PATTERNS
    utilities: () => ModernCssOutput
  }
  gradients: {
    linear: (config: LinearGradientConfig) => string
    radial: (config: RadialGradientConfig) => string
    conic: (config: ConicGradientConfig) => string
    presets: typeof GRADIENT_PRESETS
    utilities: () => ModernCssOutput
  }
  transforms3d: {
    generate: (config: Transform3DConfig) => string
    utilities: () => ModernCssOutput
  }
  generateAll: (options?: { includeFallbacks?: boolean }) => ModernCssOutput
}

/**
 * Create complete modern CSS system
 *
 * Provides a unified API for all modern CSS features.
 */
export function createModernCssSystem(
  config: ModernCssSystemConfig = {}
): ModernCssSystem {
  const breakpoints = config.containerBreakpoints || DEFAULT_CONTAINER_BREAKPOINTS

  return {
    containerQueries: {
      create: (containerConfig?: ExtendedContainerQueryConfig) =>
        createContainerQuerySystem({
          ...containerConfig,
          breakpoints: containerConfig?.breakpoints || breakpoints,
        }),
      query: generateContainerQuery,
      breakpoints,
    },
    hasSelector: {
      generate: generateHasSelector,
      patterns: HAS_PATTERNS,
      utilities: generateHasUtilities,
    },
    gradients: {
      linear: generateLinearGradient,
      radial: generateRadialGradient,
      conic: generateConicGradient,
      presets: GRADIENT_PRESETS,
      utilities: generateGradientUtilities,
    },
    transforms3d: {
      generate: generate3DTransform,
      utilities: generate3DUtilities,
    },
    generateAll: (options?: { includeFallbacks?: boolean }) => {
      const containerQueries = createContainerQuerySystem({ breakpoints })
      const hasSelectors = generateHasUtilities()
      const gradients = generateGradientUtilities()
      const transforms3d = generate3DUtilities()

      const css = [
        "/* Modern CSS Utilities */",
        "/* Generated by platxa-frontend-agent */",
        "",
        containerQueries.css,
        "",
        hasSelectors.css,
        "",
        gradients.css,
        "",
        transforms3d.css,
      ].join("\n")

      // Combine browser support (use minimum versions)
      const browserSupport = {
        chrome: Math.max(
          containerQueries.browserSupport.chrome || 0,
          hasSelectors.browserSupport.chrome || 0,
          gradients.browserSupport.chrome || 0,
          transforms3d.browserSupport.chrome || 0
        ),
        firefox: Math.max(
          containerQueries.browserSupport.firefox || 0,
          hasSelectors.browserSupport.firefox || 0,
          gradients.browserSupport.firefox || 0,
          transforms3d.browserSupport.firefox || 0
        ),
        safari: Math.max(
          containerQueries.browserSupport.safari || 0,
          hasSelectors.browserSupport.safari || 0,
          gradients.browserSupport.safari || 0,
          transforms3d.browserSupport.safari || 0
        ),
        edge: Math.max(
          containerQueries.browserSupport.edge || 0,
          hasSelectors.browserSupport.edge || 0,
          gradients.browserSupport.edge || 0,
          transforms3d.browserSupport.edge || 0
        ),
      }

      const result: ModernCssOutput = {
        css,
        browserSupport,
      }

      if (options?.includeFallbacks) {
        result.fallback = [
          containerQueries.fallback,
          hasSelectors.fallback,
        ]
          .filter(Boolean)
          .join("\n")
      }

      return result
    },
  }
}
