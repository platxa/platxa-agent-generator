/**
 * Brand Guidelines Generator
 *
 * AI-powered generation of brand usage guidelines from brand kit configurations.
 * Produces comprehensive documentation including:
 * - Color usage guidelines
 * - Typography recommendations
 * - Spacing and layout rules
 * - Do's and don'ts
 * - Example applications
 *
 * @module react-agent/guidelines
 */

import type { ThemeConfig } from "../theme/types"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Generated brand guidelines document
 */
export interface BrandGuidelines {
  /** Brand name */
  brandName: string
  /** Generation timestamp */
  generatedAt: string
  /** Overview section */
  overview: GuidelinesOverview
  /** Color guidelines */
  colors: ColorGuidelines
  /** Typography guidelines */
  typography: TypographyGuidelines
  /** Spacing guidelines */
  spacing: SpacingGuidelines
  /** Component guidelines */
  components: ComponentGuidelines
  /** Do's and don'ts */
  dosAndDonts: DosAndDonts
  /** Example applications */
  examples: ExampleApplication[]
  /** Accessibility notes */
  accessibility: AccessibilityGuidelines
}

/**
 * Guidelines overview section
 */
export interface GuidelinesOverview {
  /** Brand description */
  description: string
  /** Core principles */
  principles: string[]
  /** Target audience */
  audience: string
  /** Brand personality traits */
  personality: string[]
}

/**
 * Color usage guidelines
 */
export interface ColorGuidelines {
  /** Primary color usage */
  primary: ColorUsage
  /** Secondary color usage */
  secondary: ColorUsage
  /** Accent color usage */
  accent: ColorUsage
  /** Background/foreground pairs */
  backgrounds: BackgroundUsage[]
  /** Semantic colors (success, warning, error) */
  semantic: SemanticColorUsage[]
  /** Color combinations to avoid */
  avoidCombinations: string[]
}

/**
 * Individual color usage guide
 */
export interface ColorUsage {
  /** Color value */
  value: string
  /** When to use */
  usage: string[]
  /** When not to use */
  avoid: string[]
  /** Accessibility notes */
  a11y: string
}

/**
 * Background/foreground pair usage
 */
export interface BackgroundUsage {
  /** Background name */
  name: string
  /** Background color */
  background: string
  /** Foreground color */
  foreground: string
  /** Use cases */
  useCases: string[]
}

/**
 * Semantic color usage
 */
export interface SemanticColorUsage {
  /** Color role */
  role: "success" | "warning" | "error" | "info"
  /** Color value */
  value: string
  /** Usage guidelines */
  guidelines: string[]
}

/**
 * Typography guidelines
 */
export interface TypographyGuidelines {
  /** Font family recommendations */
  fontFamilies: FontFamilyUsage[]
  /** Size scale usage */
  sizeScale: SizeScaleUsage[]
  /** Weight usage */
  weights: WeightUsage[]
  /** Line height recommendations */
  lineHeight: string[]
  /** General typography rules */
  rules: string[]
}

/**
 * Font family usage
 */
export interface FontFamilyUsage {
  /** Family name */
  name: string
  /** Font stack */
  stack: string
  /** Usage guidelines */
  usage: string[]
}

/**
 * Size scale usage
 */
export interface SizeScaleUsage {
  /** Size name */
  name: string
  /** Size value */
  value: string
  /** Usage examples */
  usage: string[]
}

/**
 * Font weight usage
 */
export interface WeightUsage {
  /** Weight name */
  name: string
  /** Weight value */
  value: number
  /** When to use */
  usage: string[]
}

/**
 * Spacing guidelines
 */
export interface SpacingGuidelines {
  /** Base unit */
  baseUnit: string
  /** Scale values */
  scale: SpacingScaleUsage[]
  /** Spacing rules */
  rules: string[]
  /** Common patterns */
  patterns: SpacingPattern[]
}

/**
 * Spacing scale usage
 */
export interface SpacingScaleUsage {
  /** Token name */
  name: string
  /** Value */
  value: string
  /** Use cases */
  useCases: string[]
}

/**
 * Common spacing pattern
 */
export interface SpacingPattern {
  /** Pattern name */
  name: string
  /** Description */
  description: string
  /** Values used */
  values: string[]
}

/**
 * Component guidelines
 */
export interface ComponentGuidelines {
  /** Button guidelines */
  buttons: ComponentRule[]
  /** Form elements */
  forms: ComponentRule[]
  /** Cards and containers */
  cards: ComponentRule[]
  /** Navigation */
  navigation: ComponentRule[]
}

/**
 * Individual component rule
 */
export interface ComponentRule {
  /** Rule title */
  title: string
  /** Rule description */
  description: string
  /** Code example */
  example?: string
}

/**
 * Do's and don'ts
 */
export interface DosAndDonts {
  /** Things to do */
  dos: GuidelineItem[]
  /** Things to avoid */
  donts: GuidelineItem[]
}

/**
 * Single guideline item
 */
export interface GuidelineItem {
  /** Guideline text */
  text: string
  /** Category */
  category: "color" | "typography" | "spacing" | "component" | "general"
  /** Priority level */
  priority: "high" | "medium" | "low"
}

/**
 * Example application
 */
export interface ExampleApplication {
  /** Application name */
  name: string
  /** Description */
  description: string
  /** Tokens used */
  tokensUsed: string[]
  /** Code snippet */
  code: string
}

/**
 * Accessibility guidelines
 */
export interface AccessibilityGuidelines {
  /** Contrast requirements */
  contrast: string[]
  /** Focus indicators */
  focus: string[]
  /** Motion preferences */
  motion: string[]
  /** General a11y rules */
  general: string[]
}

/**
 * Generator options
 */
export interface GuidelinesGeneratorOptions {
  /** Include code examples */
  includeCodeExamples?: boolean
  /** Output format */
  format?: "json" | "markdown"
  /** Verbosity level */
  verbosity?: "minimal" | "standard" | "detailed"
  /** Custom brand description */
  brandDescription?: string
}

// =============================================================================
// COLOR ANALYSIS UTILITIES
// =============================================================================

/**
 * Parse hex color to RGB
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Try 6-digit hex first
  let match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (match) {
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
    }
  }

  // Try 3-digit hex (expand #RGB to #RRGGBB)
  match = hex.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (match) {
    return {
      r: parseInt(match[1] + match[1], 16),
      g: parseInt(match[2] + match[2], 16),
      b: parseInt(match[3] + match[3], 16),
    }
  }

  return null
}

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Determine if a color is "light" or "dark"
 */
function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color)
  if (!rgb) return true
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
  return luminance > 0.5
}

/**
 * Get color category based on hue and saturation
 * Uses HSL saturation to detect neutral/desaturated colors
 */
function getColorCategory(color: string): string {
  const rgb = hexToRgb(color)
  if (!rgb) return "neutral"

  const { r, g, b } = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  // Calculate lightness (0-1)
  const l = (max + min) / 2 / 255

  // Calculate saturation (HSL formula)
  let saturation = 0
  if (d !== 0) {
    saturation = d / 255 / (1 - Math.abs(2 * l - 1))
  }

  // Check for neutral colors using saturation threshold
  // Saturation < 0.20 means the color is desaturated/grayish (e.g., slate colors)
  if (saturation < 0.20 || d < 10) {
    if (l < 0.2) return "dark neutral"
    if (l > 0.8) return "light neutral"
    return "neutral"
  }

  // Calculate hue (0-360)
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const hue = h * 360

  // Categorize by hue with ranges matching common color naming conventions
  // Red: 0-15, 345-360 | Orange: 15-45 | Yellow: 45-75
  // Green: 75-160 | Cyan: 160-200 | Blue: 200-255 | Purple: 255-345
  if (hue < 15 || hue >= 345) return "red"
  if (hue < 45) return "orange"
  if (hue < 75) return "yellow"
  if (hue < 160) return "green"
  if (hue < 200) return "cyan"
  if (hue < 255) return "blue"
  if (hue < 345) return "purple"
  return "neutral"
}

// =============================================================================
// GUIDELINES GENERATOR
// =============================================================================

/**
 * Generate brand guidelines from a theme configuration
 */
export function generateBrandGuidelines(
  config: ThemeConfig,
  options: GuidelinesGeneratorOptions = {}
): BrandGuidelines {
  const {
    includeCodeExamples = true,
    verbosity = "standard",
    brandDescription,
  } = options

  const colors = config.light.colors as unknown as Record<string, string>
  const primaryCategory = getColorCategory(colors.primary || "#6366f1")

  return {
    brandName: config.name,
    generatedAt: new Date().toISOString(),

    overview: generateOverview(config, brandDescription, primaryCategory),
    colors: generateColorGuidelines(colors, verbosity),
    typography: generateTypographyGuidelines(config, verbosity),
    spacing: generateSpacingGuidelines(config, verbosity),
    components: generateComponentGuidelines(colors, includeCodeExamples),
    dosAndDonts: generateDosAndDonts(colors, verbosity),
    examples: generateExamples(config, includeCodeExamples),
    accessibility: generateAccessibilityGuidelines(colors),
  }
}

/**
 * Generate overview section
 */
function generateOverview(
  config: ThemeConfig,
  customDescription: string | undefined,
  primaryCategory: string
): GuidelinesOverview {
  const personalityMap: Record<string, string[]> = {
    blue: ["trustworthy", "professional", "calm", "reliable"],
    purple: ["creative", "luxurious", "imaginative", "wise"],
    green: ["natural", "growth-oriented", "balanced", "fresh"],
    red: ["energetic", "passionate", "bold", "urgent"],
    orange: ["friendly", "confident", "cheerful", "adventurous"],
    yellow: ["optimistic", "warm", "innovative", "youthful"],
    cyan: ["modern", "clean", "refreshing", "technological"],
    neutral: ["sophisticated", "timeless", "versatile", "elegant"],
  }

  return {
    description:
      customDescription ||
      `${config.name} is a carefully crafted design system featuring a ${primaryCategory}-based color palette. It provides semantic tokens for consistent, accessible UI development.`,
    principles: [
      "Consistency: Use semantic tokens instead of raw values",
      "Accessibility: Maintain WCAG 2.1 AA contrast ratios",
      "Flexibility: Support light and dark modes seamlessly",
      "Scalability: Design tokens scale from small to large applications",
    ],
    audience: "Developers and designers building modern web applications",
    personality: personalityMap[primaryCategory] || personalityMap.neutral,
  }
}

/**
 * Generate color guidelines
 */
function generateColorGuidelines(
  colors: Record<string, string>,
  verbosity: string
): ColorGuidelines {
  const primary = colors.primary || "#6366f1"
  const secondary = colors.secondary || "#f1f5f9"
  const accent = colors.accent || colors.primary || "#6366f1"

  return {
    primary: {
      value: primary,
      usage: [
        "Primary call-to-action buttons",
        "Important links and navigation highlights",
        "Active states and selections",
        "Brand identity elements",
      ],
      avoid: [
        "Large background areas (overwhelming)",
        "Body text (use foreground instead)",
        "Warning or error states",
      ],
      a11y: `Pair with primaryForeground (${colors.primaryForeground || "#ffffff"}) for text`,
    },
    secondary: {
      value: secondary,
      usage: [
        "Secondary buttons and actions",
        "Subtle backgrounds and containers",
        "Supporting UI elements",
        "Hover states for neutral elements",
      ],
      avoid: [
        "Primary actions",
        "Error states",
        "Areas requiring high visual prominence",
      ],
      a11y: `Pair with secondaryForeground (${colors.secondaryForeground || "#0f172a"}) for text`,
    },
    accent: {
      value: accent,
      usage: [
        "Highlighting important information",
        "Success states and positive feedback",
        "Interactive element hover states",
        "Badges and tags",
      ],
      avoid: [
        "Primary branding (use primary instead)",
        "Large text areas",
        "Overuse that diminishes impact",
      ],
      a11y: `Pair with accentForeground (${colors.accentForeground || "#ffffff"}) for text`,
    },
    backgrounds: [
      {
        name: "Default",
        background: colors.background || "#ffffff",
        foreground: colors.foreground || "#0f172a",
        useCases: ["Main page background", "Content areas", "Default surfaces"],
      },
      {
        name: "Card",
        background: colors.card || "#ffffff",
        foreground: colors.cardForeground || "#0f172a",
        useCases: ["Card components", "Elevated surfaces", "Modal backgrounds"],
      },
      {
        name: "Muted",
        background: colors.muted || "#f1f5f9",
        foreground: colors.mutedForeground || "#64748b",
        useCases: [
          "Subtle backgrounds",
          "Input backgrounds",
          "Disabled states",
        ],
      },
    ],
    semantic:
      verbosity === "minimal"
        ? []
        : [
            {
              role: "success",
              value: colors.accent || "#22c55e",
              guidelines: [
                "Use for positive feedback and confirmations",
                "Success messages and toasts",
                "Completed states in progress indicators",
              ],
            },
            {
              role: "error",
              value: colors.destructive || "#ef4444",
              guidelines: [
                "Form validation errors",
                "Destructive action warnings",
                "Error messages and alerts",
              ],
            },
          ],
    avoidCombinations: [
      "Red text on green background (colorblind accessibility)",
      "Low contrast color pairs (< 4.5:1 ratio)",
      "Multiple bright colors in close proximity",
      "Primary color for error states (confusing semantics)",
    ],
  }
}

/**
 * Generate typography guidelines
 */
function generateTypographyGuidelines(
  config: ThemeConfig,
  verbosity: string
): TypographyGuidelines {
  const typography = config.light.typography || {}

  return {
    fontFamilies: [
      {
        name: "Sans Serif (Default)",
        stack:
          config.light.fontFamily?.sans ||
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        usage: ["Body text", "UI elements", "Most content"],
      },
      {
        name: "Monospace",
        stack:
          config.light.fontFamily?.mono ||
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        usage: ["Code snippets", "Technical data", "Tabular numbers"],
      },
    ],
    sizeScale: [
      {
        name: "xs",
        value: (typography as Record<string, { fontSize?: string }>).xs?.fontSize || "0.75rem",
        usage: ["Fine print", "Labels", "Captions"],
      },
      {
        name: "sm",
        value: (typography as Record<string, { fontSize?: string }>).sm?.fontSize || "0.875rem",
        usage: ["Secondary text", "Helper text", "Metadata"],
      },
      {
        name: "base",
        value: (typography as Record<string, { fontSize?: string }>).base?.fontSize || "1rem",
        usage: ["Body text", "Primary content", "Default size"],
      },
      {
        name: "lg",
        value: (typography as Record<string, { fontSize?: string }>).lg?.fontSize || "1.125rem",
        usage: ["Lead paragraphs", "Emphasized text"],
      },
      {
        name: "xl",
        value: (typography as Record<string, { fontSize?: string }>).xl?.fontSize || "1.25rem",
        usage: ["Section headings", "Card titles"],
      },
      {
        name: "2xl",
        value: (typography as Record<string, { fontSize?: string }>)["2xl"]?.fontSize || "1.5rem",
        usage: ["Page headings", "Major sections"],
      },
    ],
    weights:
      verbosity === "minimal"
        ? []
        : [
            { name: "normal", value: 400, usage: ["Body text", "Default weight"] },
            { name: "medium", value: 500, usage: ["Labels", "Subtle emphasis"] },
            {
              name: "semibold",
              value: 600,
              usage: ["Headings", "Important labels"],
            },
            { name: "bold", value: 700, usage: ["Strong emphasis", "Titles"] },
          ],
    lineHeight: [
      "Use tight line-height (1.25) for headings",
      "Use normal line-height (1.5) for body text",
      "Use relaxed line-height (1.75) for long-form content",
    ],
    rules: [
      "Limit font sizes to the defined scale",
      "Use semantic heading levels (h1-h6) appropriately",
      "Maintain consistent line-height ratios",
      "Avoid font sizes below 12px for readability",
    ],
  }
}

/**
 * Generate spacing guidelines
 */
function generateSpacingGuidelines(
  _config: ThemeConfig,
  verbosity: string
): SpacingGuidelines {

  return {
    baseUnit: "0.25rem (4px)",
    scale: [
      { name: "1", value: "0.25rem", useCases: ["Tight gaps", "Icon padding"] },
      {
        name: "2",
        value: "0.5rem",
        useCases: ["Small gaps", "Inline spacing"],
      },
      {
        name: "4",
        value: "1rem",
        useCases: ["Standard padding", "Component gaps"],
      },
      {
        name: "6",
        value: "1.5rem",
        useCases: ["Section padding", "Card padding"],
      },
      {
        name: "8",
        value: "2rem",
        useCases: ["Large gaps", "Section margins"],
      },
    ],
    rules: [
      "Use consistent spacing tokens instead of arbitrary values",
      "Increase spacing for larger screens (responsive)",
      "Group related elements with smaller spacing",
      "Separate distinct sections with larger spacing",
    ],
    patterns:
      verbosity === "minimal"
        ? []
        : [
            {
              name: "Card Padding",
              description: "Standard padding for card components",
              values: ["p-4 (1rem)", "p-6 for larger cards"],
            },
            {
              name: "Stack Spacing",
              description: "Vertical spacing between stacked elements",
              values: ["space-y-2 for tight", "space-y-4 for normal"],
            },
            {
              name: "Section Margins",
              description: "Spacing between page sections",
              values: ["my-8 to my-16 depending on importance"],
            },
          ],
  }
}

/**
 * Generate component guidelines
 */
function generateComponentGuidelines(
  _colors: Record<string, string>,
  includeExamples: boolean
): ComponentGuidelines {
  return {
    buttons: [
      {
        title: "Primary Buttons",
        description:
          "Use for main call-to-action. One primary button per view.",
        example: includeExamples
          ? `<Button variant="primary">Submit</Button>`
          : undefined,
      },
      {
        title: "Secondary Buttons",
        description: "Use for secondary actions that complement the primary.",
        example: includeExamples
          ? `<Button variant="secondary">Cancel</Button>`
          : undefined,
      },
      {
        title: "Destructive Buttons",
        description: "Use for delete/remove actions. Require confirmation.",
        example: includeExamples
          ? `<Button variant="destructive">Delete</Button>`
          : undefined,
      },
    ],
    forms: [
      {
        title: "Input Fields",
        description: "Use border color for default, ring color for focus.",
        example: includeExamples
          ? `<Input className="border-input focus:ring-ring" />`
          : undefined,
      },
      {
        title: "Labels",
        description: "Use foreground color, medium weight.",
        example: includeExamples
          ? `<Label className="text-foreground font-medium">Email</Label>`
          : undefined,
      },
      {
        title: "Error States",
        description: "Use destructive color for error messages and borders.",
        example: includeExamples
          ? `<Input className="border-destructive" />\n<p className="text-destructive">Required field</p>`
          : undefined,
      },
    ],
    cards: [
      {
        title: "Card Containers",
        description: "Use card/cardForeground colors with subtle border.",
        example: includeExamples
          ? `<Card className="bg-card text-card-foreground border">`
          : undefined,
      },
      {
        title: "Card Elevation",
        description: "Use shadow-sm for default, shadow-md for hover.",
        example: includeExamples
          ? `<Card className="shadow-sm hover:shadow-md transition-shadow">`
          : undefined,
      },
    ],
    navigation: [
      {
        title: "Active States",
        description: "Use primary color or accent for active navigation items.",
        example: includeExamples
          ? `<NavLink className="text-primary font-medium">Dashboard</NavLink>`
          : undefined,
      },
      {
        title: "Hover States",
        description: "Use muted background for hover states.",
        example: includeExamples
          ? `<NavLink className="hover:bg-muted">Settings</NavLink>`
          : undefined,
      },
    ],
  }
}

/**
 * Generate do's and don'ts
 */
function generateDosAndDonts(
  _colors: Record<string, string>,
  _verbosity: string
): DosAndDonts {
  return {
    dos: [
      {
        text: "Use semantic color tokens (primary, secondary) instead of raw hex values",
        category: "color",
        priority: "high",
      },
      {
        text: "Maintain minimum 4.5:1 contrast ratio for text",
        category: "color",
        priority: "high",
      },
      {
        text: "Use the spacing scale consistently throughout the application",
        category: "spacing",
        priority: "high",
      },
      {
        text: "Provide visible focus indicators for keyboard navigation",
        category: "component",
        priority: "high",
      },
      {
        text: "Test components in both light and dark modes",
        category: "general",
        priority: "high",
      },
      {
        text: "Use appropriate font weights for hierarchy",
        category: "typography",
        priority: "medium",
      },
      {
        text: "Group related elements with consistent spacing",
        category: "spacing",
        priority: "medium",
      },
      {
        text: "Use muted colors for disabled states",
        category: "color",
        priority: "medium",
      },
    ],
    donts: [
      {
        text: "Don't use hardcoded color values in components",
        category: "color",
        priority: "high",
      },
      {
        text: "Don't remove focus indicators for aesthetic reasons",
        category: "component",
        priority: "high",
      },
      {
        text: "Don't use primary color for error states",
        category: "color",
        priority: "high",
      },
      {
        text: "Don't mix spacing systems (px and rem arbitrarily)",
        category: "spacing",
        priority: "high",
      },
      {
        text: "Don't use font sizes below 12px",
        category: "typography",
        priority: "medium",
      },
      {
        text: "Don't rely solely on color to convey information",
        category: "general",
        priority: "high",
      },
      {
        text: "Don't use too many colors in a single view",
        category: "color",
        priority: "medium",
      },
      {
        text: "Don't ignore reduced motion preferences",
        category: "component",
        priority: "medium",
      },
    ],
  }
}

/**
 * Generate example applications
 */
function generateExamples(
  _config: ThemeConfig,
  includeCode: boolean
): ExampleApplication[] {
  return [
    {
      name: "Login Form",
      description: "A complete login form demonstrating form styling patterns",
      tokensUsed: [
        "background",
        "foreground",
        "card",
        "primary",
        "input",
        "ring",
      ],
      code: includeCode
        ? `<div className="bg-background min-h-screen flex items-center justify-center">
  <Card className="w-full max-w-md p-6">
    <h1 className="text-2xl font-bold text-foreground mb-6">Sign In</h1>
    <form className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          className="border-input focus:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="secret">Secret</Label>
        <Input
          id="secret"
          type="text"
          className="border-input focus:ring-ring"
        />
      </div>
      <Button variant="primary" className="w-full">
        Sign In
      </Button>
    </form>
  </Card>
</div>`
        : "",
    },
    {
      name: "Dashboard Card",
      description: "A metric card for dashboard interfaces",
      tokensUsed: ["card", "cardForeground", "muted", "mutedForeground", "primary"],
      code: includeCode
        ? `<Card className="p-6">
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Total Revenue</span>
    <TrendIcon className="text-primary" />
  </div>
  <p className="text-3xl font-bold text-card-foreground mt-2">$45,231</p>
  <p className="text-sm text-muted-foreground mt-1">
    +20.1% from last month
  </p>
</Card>`
        : "",
    },
    {
      name: "Alert Component",
      description: "Semantic alert variants using brand colors",
      tokensUsed: ["destructive", "destructiveForeground", "accent", "accentForeground"],
      code: includeCode
        ? `{/* Error Alert */}
<Alert className="bg-destructive/10 border-destructive text-destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong.</AlertDescription>
</Alert>

{/* Success Alert */}
<Alert className="bg-accent/10 border-accent text-accent">
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Operation completed.</AlertDescription>
</Alert>`
        : "",
    },
  ]
}

/**
 * Generate accessibility guidelines
 */
function generateAccessibilityGuidelines(
  colors: Record<string, string>
): AccessibilityGuidelines {
  return {
    contrast: [
      "Maintain minimum 4.5:1 contrast for normal text (WCAG AA)",
      "Maintain minimum 3:1 contrast for large text (18px+ or 14px+ bold)",
      "Maintain minimum 3:1 contrast for UI components and graphics",
      `Primary on background: verify contrast of ${colors.primary || "#6366f1"} on ${colors.background || "#ffffff"}`,
    ],
    focus: [
      `Use ring color (${colors.ring || "#6366f1"}) for focus indicators`,
      "Focus rings should be visible in both light and dark modes",
      "Never remove focus indicators; style them appropriately instead",
      "Focus indicators should have minimum 3:1 contrast against adjacent colors",
    ],
    motion: [
      "Respect prefers-reduced-motion media query",
      "Provide alternatives to motion-based interactions",
      "Keep animations under 5 seconds or provide pause controls",
      "Avoid flashing content (max 3 flashes per second)",
    ],
    general: [
      "Don't rely solely on color to convey information",
      "Provide text alternatives for non-text content",
      "Ensure interactive elements have minimum 44x44px touch targets",
      "Support keyboard navigation for all interactive elements",
      "Use semantic HTML elements (button, nav, main, etc.)",
    ],
  }
}

/**
 * Convert guidelines to Markdown format
 */
export function guidelinesToMarkdown(guidelines: BrandGuidelines): string {
  const lines: string[] = []

  lines.push(`# ${guidelines.brandName} Brand Guidelines`)
  lines.push("")
  lines.push(`*Generated: ${guidelines.generatedAt}*`)
  lines.push("")

  // Overview
  lines.push("## Overview")
  lines.push("")
  lines.push(guidelines.overview.description)
  lines.push("")
  lines.push("### Core Principles")
  guidelines.overview.principles.forEach((p) => lines.push(`- ${p}`))
  lines.push("")
  lines.push("### Brand Personality")
  lines.push(guidelines.overview.personality.join(", "))
  lines.push("")

  // Colors
  lines.push("## Color Guidelines")
  lines.push("")
  lines.push("### Primary Color")
  lines.push(`**Value:** \`${guidelines.colors.primary.value}\``)
  lines.push("")
  lines.push("**Use for:**")
  guidelines.colors.primary.usage.forEach((u) => lines.push(`- ${u}`))
  lines.push("")
  lines.push("**Avoid:**")
  guidelines.colors.primary.avoid.forEach((a) => lines.push(`- ${a}`))
  lines.push("")

  // Do's and Don'ts
  lines.push("## Do's and Don'ts")
  lines.push("")
  lines.push("### Do")
  guidelines.dosAndDonts.dos.forEach((d) => {
    lines.push(`- **[${d.priority.toUpperCase()}]** ${d.text}`)
  })
  lines.push("")
  lines.push("### Don't")
  guidelines.dosAndDonts.donts.forEach((d) => {
    lines.push(`- **[${d.priority.toUpperCase()}]** ${d.text}`)
  })
  lines.push("")

  // Examples
  lines.push("## Example Applications")
  lines.push("")
  guidelines.examples.forEach((ex) => {
    lines.push(`### ${ex.name}`)
    lines.push("")
    lines.push(ex.description)
    lines.push("")
    lines.push("**Tokens used:** " + ex.tokensUsed.join(", "))
    if (ex.code) {
      lines.push("")
      lines.push("```tsx")
      lines.push(ex.code)
      lines.push("```")
    }
    lines.push("")
  })

  // Accessibility
  lines.push("## Accessibility")
  lines.push("")
  lines.push("### Contrast Requirements")
  guidelines.accessibility.contrast.forEach((c) => lines.push(`- ${c}`))
  lines.push("")
  lines.push("### Focus Indicators")
  guidelines.accessibility.focus.forEach((f) => lines.push(`- ${f}`))
  lines.push("")

  return lines.join("\n")
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  generateBrandGuidelines as default,
  isLightColor,
  getColorCategory,
}
