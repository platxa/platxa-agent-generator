/**
 * Design Analyzer
 *
 * Extracts visual requirements from natural language descriptions
 * and maps them to component specifications.
 */

import type {
  ComponentType,
  ComponentCategory,
  StyleVariant,
  SizeVariant,
  ShapeVariant,
  ColorIntent,
  SpacingIntent,
  TypographyIntent,
  InteractionIntent,
  AnimationIntent,
  LayoutIntent,
  ContentIntent,
  AccessibilityIntent,
  DesignRequirements,
  AnalysisResult,
  AnalyzerConfig,
} from "./types"

// ============================================================================
// Component Type Detection
// ============================================================================

/**
 * Keywords that indicate specific component types
 * Ordered from most specific (multi-word) to least specific
 */
const componentTypePatterns: Record<ComponentType, string[]> = {
  button: ["action button", "call to action", "submit button", "click action", "button", "btn", "cta"],
  card: ["info card", "product card", "container card", "card", "tile", "panel"],
  input: ["text input", "text field", "search field", "input field", "textbox", "input", "entry"],
  form: ["contact form", "signup form", "login form", "form", "signup", "login", "register"],
  modal: ["modal dialog", "modal window", "overlay form", "modal", "popup", "overlay", "lightbox"],
  dialog: ["alert dialog", "confirm dialog", "confirmation dialog", "dialog", "confirmation"],
  dropdown: ["dropdown menu", "drop-down", "dropdown", "pulldown"],
  select: ["select menu", "option list", "select", "picker", "chooser", "combobox"],
  checkbox: ["check box", "checkbox", "tick box", "checkmark"],
  radio: ["radio button", "radio group", "radio", "option button"],
  switch: ["toggle switch", "switch", "toggle", "on/off"],
  slider: ["range slider", "slider", "range", "scrubber"],
  tabs: ["tab navigation", "tab panel", "tab bar", "tabbed", "tabs"],
  accordion: ["accordion", "collapsible", "expandable", "collapse"],
  menu: ["context menu", "action menu", "right-click menu", "menu"],
  navbar: ["navigation bar", "nav bar", "header nav", "top nav", "navbar"],
  sidebar: ["side panel", "side nav", "side bar", "sidebar", "drawer"],
  footer: ["page footer", "bottom bar", "footer"],
  header: ["page header", "top section", "masthead", "header"],
  hero: ["hero section", "banner section", "hero", "jumbotron", "splash"],
  banner: ["notice bar", "info bar", "announcement bar", "banner", "announcement"],
  alert: ["warning message", "error message", "alert message", "alert"],
  toast: ["notification toast", "toast notification", "toast", "snackbar", "flash message"],
  tooltip: ["hover text", "info tip", "tooltip", "hint"],
  popover: ["floating panel", "info popup", "pop over", "popover"],
  badge: ["pill badge", "badge", "chip", "tag"],
  avatar: ["profile picture", "profile image", "user image", "avatar"],
  table: ["data table", "grid table", "table", "spreadsheet"],
  list: ["item list", "bullet list", "ordered list", "list"],
  grid: ["grid layout", "card grid", "masonry", "grid"],
  carousel: ["slider gallery", "image slider", "carousel", "slideshow"],
  pagination: ["page navigation", "page numbers", "pagination", "pager"],
  breadcrumb: ["navigation path", "breadcrumbs", "breadcrumb"],
  progress: ["progress bar", "loading bar", "progress", "completion"],
  skeleton: ["loading placeholder", "skeleton", "placeholder", "shimmer"],
  spinner: ["loading spinner", "loading indicator", "spinner", "loader"],
  divider: ["horizontal rule", "divider", "separator"],
  container: ["content container", "container", "wrapper"],
  section: ["content section", "section", "block"],
  unknown: [],
}

/**
 * Creates a word-boundary regex for matching keywords
 */
function createWordBoundaryRegex(keyword: string): RegExp {
  // Escape special regex characters
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i")
}

/**
 * Map component types to categories
 */
const componentCategoryMap: Record<ComponentType, ComponentCategory> = {
  button: "action",
  card: "display",
  input: "input",
  form: "input",
  modal: "overlay",
  dialog: "overlay",
  dropdown: "input",
  select: "input",
  checkbox: "input",
  radio: "input",
  switch: "input",
  slider: "input",
  tabs: "navigation",
  accordion: "display",
  menu: "navigation",
  navbar: "navigation",
  sidebar: "navigation",
  footer: "layout",
  header: "layout",
  hero: "display",
  banner: "feedback",
  alert: "feedback",
  toast: "feedback",
  tooltip: "overlay",
  popover: "overlay",
  badge: "display",
  avatar: "display",
  table: "display",
  list: "display",
  grid: "layout",
  carousel: "display",
  pagination: "navigation",
  breadcrumb: "navigation",
  progress: "feedback",
  skeleton: "feedback",
  spinner: "feedback",
  divider: "layout",
  container: "layout",
  section: "layout",
  unknown: "display",
}

/**
 * Detects component type from description
 */
export function detectComponentType(
  description: string
): { type: ComponentType; confidence: number } {
  const normalized = description.toLowerCase()
  let bestMatch: ComponentType = "unknown"
  let bestScore = 0
  let bestKeywordLength = 0

  for (const [type, keywords] of Object.entries(componentTypePatterns)) {
    for (const keyword of keywords) {
      const regex = createWordBoundaryRegex(keyword)
      if (regex.test(normalized)) {
        // Prioritize longer keyword matches (more specific)
        // Then use position in description as tiebreaker
        const keywordLength = keyword.length
        const score = keywordLength / normalized.length + 0.5

        // Longer keywords win (more specific)
        if (keywordLength > bestKeywordLength ||
            (keywordLength === bestKeywordLength && score > bestScore)) {
          bestScore = score
          bestMatch = type as ComponentType
          bestKeywordLength = keywordLength
        }
        // Once we find a match for this type, move to next type
        // (keywords are ordered by specificity within each type)
        break
      }
    }
  }

  return {
    type: bestMatch,
    confidence: Math.min(bestScore, 1),
  }
}

/**
 * Gets category for a component type
 */
export function getComponentCategory(type: ComponentType): ComponentCategory {
  return componentCategoryMap[type]
}

// ============================================================================
// Style Variant Detection
// ============================================================================

/**
 * Keywords for style variants (ordered by specificity)
 * More specific/unique keywords first to avoid false matches
 */
const variantPatterns: Record<StyleVariant, string[]> = {
  destructive: ["destructive", "danger", "delete", "remove"],
  success: ["success", "positive", "confirm", "complete", "done"],
  warning: ["warning", "caution"],
  info: ["info", "information", "help"],
  primary: ["primary", "main", "prominent", "important"],
  secondary: ["secondary", "alternate", "alternative", "subtle"],
  tertiary: ["tertiary", "minimal", "quiet"],
  ghost: ["ghost", "transparent", "invisible", "borderless"],
  outline: ["outline", "outlined", "border only", "hollow", "stroke"],
  link: ["link style", "text only", "inline link", "underlined"],
  default: ["default", "standard", "regular"],
}

/**
 * Detects style variant from description
 * Prioritizes by position in text (first match wins), then by keyword length
 */
export function detectStyleVariant(description: string): StyleVariant | undefined {
  const normalized = description.toLowerCase()
  let bestMatch: StyleVariant | undefined
  let bestPosition = Infinity
  let bestLength = 0

  for (const [variant, keywords] of Object.entries(variantPatterns)) {
    for (const keyword of keywords) {
      const regex = createWordBoundaryRegex(keyword)
      const match = regex.exec(normalized)
      if (match) {
        const position = match.index
        // Prioritize earlier matches, use length as tiebreaker
        if (position < bestPosition ||
            (position === bestPosition && keyword.length > bestLength)) {
          bestPosition = position
          bestLength = keyword.length
          bestMatch = variant as StyleVariant
        }
        break // Found match for this variant, check others
      }
    }
  }

  return bestMatch
}

// ============================================================================
// Size Detection
// ============================================================================

/**
 * Keywords for size variants (ordered by specificity - longer phrases first)
 */
const sizePatterns: Record<SizeVariant, string[]> = {
  "2xl": ["2xl", "xxl", "massive", "giant"],
  xl: ["extra large", "xl", "huge", "jumbo"],
  lg: ["large", "lg", "big", "wide"],
  md: ["medium", "md", "normal", "regular"],
  sm: ["small", "sm", "little", "narrow"],
  xs: ["extra small", "xs", "tiny", "mini", "compact"],
  full: ["full width", "full-width", "stretch", "100%"],
}

/**
 * Detects size variant from description
 * Prioritizes by position in text (first match wins), then by keyword length
 */
export function detectSizeVariant(description: string): SizeVariant | undefined {
  const normalized = description.toLowerCase()
  let bestMatch: SizeVariant | undefined
  let bestPosition = Infinity
  let bestLength = 0

  for (const [size, keywords] of Object.entries(sizePatterns)) {
    for (const keyword of keywords) {
      const regex = createWordBoundaryRegex(keyword)
      const match = regex.exec(normalized)
      if (match) {
        const position = match.index
        // Prioritize earlier matches, use length as tiebreaker
        if (position < bestPosition ||
            (position === bestPosition && keyword.length > bestLength)) {
          bestPosition = position
          bestLength = keyword.length
          bestMatch = size as SizeVariant
        }
        break // Found match for this size
      }
    }
  }

  return bestMatch
}

// ============================================================================
// Shape Detection
// ============================================================================

/**
 * Keywords for shape variants
 */
const shapePatterns: Record<ShapeVariant, string[]> = {
  square: ["square", "sharp", "no radius", "sharp corners", "rectangular"],
  rounded: ["rounded", "round corners", "soft corners", "curved"],
  pill: ["pill", "capsule", "stadium", "fully rounded"],
  circle: ["circle", "circular", "round", "oval"],
}

/**
 * Detects shape variant from description
 */
export function detectShapeVariant(description: string): ShapeVariant | undefined {
  const normalized = description.toLowerCase()

  for (const [shape, keywords] of Object.entries(shapePatterns)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return shape as ShapeVariant
      }
    }
  }

  return undefined
}

// ============================================================================
// Color Detection
// ============================================================================

/**
 * Common color keywords to hex values
 */
const colorKeywords: Record<string, string> = {
  // Basic colors
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  // Neutrals
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  grey: "#6b7280",
  // Brand colors
  slate: "#64748b",
  zinc: "#71717a",
  neutral: "#737373",
  stone: "#78716c",
  // Semantic
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  lime: "#84cc16",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
}

/**
 * Semantic color intent patterns
 */
const semanticColorPatterns: Record<string, ColorIntent["semantic"]> = {
  success: "success",
  positive: "success",
  confirm: "success",
  complete: "success",
  done: "success",
  warning: "warning",
  caution: "warning",
  alert: "warning",
  error: "error",
  danger: "error",
  destructive: "error",
  invalid: "error",
  fail: "error",
  info: "info",
  information: "info",
  help: "info",
  neutral: "neutral",
  default: "neutral",
  muted: "neutral",
}

/**
 * Extracts color intent from description
 */
export function extractColorIntent(description: string): ColorIntent {
  const normalized = description.toLowerCase()
  const intent: ColorIntent = {}

  // Check for semantic intent using word boundaries
  for (const [keyword, semantic] of Object.entries(semanticColorPatterns)) {
    const regex = createWordBoundaryRegex(keyword)
    if (regex.test(normalized)) {
      intent.semantic = semantic
      break
    }
  }

  // Check for explicit colors with their roles
  // Pattern: "color role" or "role color" e.g., "blue background" or "background blue"
  for (const [colorName, hexValue] of Object.entries(colorKeywords)) {
    const colorRegex = createWordBoundaryRegex(colorName)
    if (!colorRegex.test(normalized)) continue

    // Check color role patterns (both orders)
    if (new RegExp(`\\b${colorName}\\s+background\\b|\\bbackground\\s+${colorName}\\b|\\b${colorName}\\s+bg\\b`, "i").test(normalized)) {
      intent.background = hexValue
    } else if (new RegExp(`\\b${colorName}\\s+text\\b|\\btext\\s+${colorName}\\b|\\b${colorName}\\s+foreground\\b`, "i").test(normalized)) {
      intent.foreground = hexValue
    } else if (new RegExp(`\\b${colorName}\\s+border\\b|\\bborder\\s+${colorName}\\b`, "i").test(normalized)) {
      intent.border = hexValue
    } else if (new RegExp(`\\b${colorName}\\s+accent\\b|\\baccent\\s+${colorName}\\b`, "i").test(normalized)) {
      intent.accent = hexValue
    } else {
      // Default to primary color if no specific role
      intent.primary = hexValue
    }
  }

  // Check for hex colors in description
  const hexMatch = description.match(/#([0-9a-fA-F]{3,6})\b/g)
  if (hexMatch) {
    intent.primary = hexMatch[0]
  }

  return intent
}

// ============================================================================
// Spacing Detection
// ============================================================================

/**
 * Extracts spacing intent from description
 */
export function extractSpacingIntent(description: string): SpacingIntent {
  const normalized = description.toLowerCase()
  const intent: SpacingIntent = {}

  // Padding
  if (normalized.includes("no padding") || normalized.includes("compact")) {
    intent.padding = "none"
  } else if (normalized.includes("tight padding") || normalized.includes("small padding")) {
    intent.padding = "tight"
  } else if (normalized.includes("large padding") || normalized.includes("spacious padding")) {
    intent.padding = "spacious"
  } else if (normalized.includes("relaxed")) {
    intent.padding = "relaxed"
  } else if (normalized.includes("padding")) {
    intent.padding = "normal"
  }

  // Gap
  if (normalized.includes("no gap") || normalized.includes("no space")) {
    intent.gap = "none"
  } else if (normalized.includes("tight") || normalized.includes("dense")) {
    intent.gap = "tight"
  } else if (normalized.includes("spacious") || normalized.includes("airy")) {
    intent.gap = "spacious"
  } else if (normalized.includes("gap") || normalized.includes("spacing")) {
    intent.gap = "normal"
  }

  return intent
}

// ============================================================================
// Typography Detection
// ============================================================================

/**
 * Extracts typography intent from description
 */
export function extractTypographyIntent(description: string): TypographyIntent {
  const normalized = description.toLowerCase()
  const intent: TypographyIntent = {}

  // Size
  const sizeKeywords: Record<SizeVariant, string[]> = {
    xs: ["tiny text", "extra small text"],
    sm: ["small text", "fine print"],
    md: ["normal text", "regular text"],
    lg: ["large text", "big text"],
    xl: ["extra large text", "heading"],
    "2xl": ["huge text", "display text"],
    full: [],
  }

  for (const [size, keywords] of Object.entries(sizeKeywords)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        intent.size = size as SizeVariant
        break
      }
    }
  }

  // Weight - check more specific patterns first using word boundaries
  const weightPatterns: Array<{ pattern: RegExp; weight: TypographyIntent["weight"] }> = [
    { pattern: /\b(extra\s*bold|extrabold)\b/i, weight: "extrabold" },
    { pattern: /\b(semi\s*bold|semibold)\b/i, weight: "semibold" },
    { pattern: /\bmedium\s+weight\b/i, weight: "medium" },
    { pattern: /\b(bold|strong)\b/i, weight: "bold" },
    { pattern: /\b(light|thin)\b/i, weight: "light" },
  ]

  for (const { pattern, weight } of weightPatterns) {
    if (pattern.test(normalized)) {
      intent.weight = weight
      break
    }
  }

  // Alignment
  if (normalized.includes("center") || normalized.includes("centered")) {
    intent.align = "center"
  } else if (normalized.includes("right align")) {
    intent.align = "right"
  } else if (normalized.includes("justify")) {
    intent.align = "justify"
  }

  // Transform
  if (normalized.includes("uppercase") || normalized.includes("all caps")) {
    intent.transform = "uppercase"
  } else if (normalized.includes("lowercase")) {
    intent.transform = "lowercase"
  } else if (normalized.includes("capitalize") || normalized.includes("title case")) {
    intent.transform = "capitalize"
  }

  // Family
  if (normalized.includes("monospace") || normalized.includes("code")) {
    intent.family = "mono"
  } else if (normalized.includes("serif")) {
    intent.family = "serif"
  }

  return intent
}

// ============================================================================
// Interaction Detection
// ============================================================================

/**
 * Extracts interaction intent from description
 */
export function extractInteractionIntent(description: string): InteractionIntent {
  const normalized = description.toLowerCase()
  const intent: InteractionIntent = {}

  // Hover effects
  if (normalized.includes("hover")) {
    if (normalized.includes("lift") || normalized.includes("raise")) {
      intent.hover = { effect: "lift" }
    } else if (normalized.includes("scale") || normalized.includes("grow")) {
      intent.hover = { effect: "scale" }
    } else if (normalized.includes("glow") || normalized.includes("shine")) {
      intent.hover = { effect: "glow" }
    } else if (normalized.includes("darken") || normalized.includes("dim")) {
      intent.hover = { effect: "darken" }
    } else if (normalized.includes("lighten") || normalized.includes("brighten")) {
      intent.hover = { effect: "lighten" }
    } else {
      intent.hover = { effect: "scale", intensity: "subtle" }
    }
  }

  // Press effects
  if (normalized.includes("press") || normalized.includes("click")) {
    if (normalized.includes("scale") || normalized.includes("shrink")) {
      intent.press = { effect: "scale" }
    } else if (normalized.includes("push") || normalized.includes("depress")) {
      intent.press = { effect: "push" }
    } else if (normalized.includes("ripple")) {
      intent.press = { effect: "ripple" }
    } else {
      intent.press = { effect: "scale" }
    }
  }

  // Focus
  if (normalized.includes("focus")) {
    intent.focus = {
      ring: normalized.includes("ring") || !normalized.includes("outline"),
      outline: normalized.includes("outline"),
    }
  }

  // States
  intent.hasDisabledState = normalized.includes("disabled") || normalized.includes("disable")
  intent.hasLoadingState = normalized.includes("loading") || normalized.includes("spinner")

  return intent
}

// ============================================================================
// Animation Detection
// ============================================================================

/**
 * Extracts animation intent from description
 */
export function extractAnimationIntent(description: string): AnimationIntent {
  const normalized = description.toLowerCase()
  const intent: AnimationIntent = {}

  // Entrance animations - check for various patterns
  if (/\bfade\s*in\b|\bfade-in\b|\bfades?\s+in\b/i.test(normalized)) {
    intent.entrance = "fade"
  } else if (/\bslide\s*in\b|\bslide-in\b|\bslides?\s+in\b|\bsliding\s+in\b/i.test(normalized)) {
    intent.entrance = "slide"
  } else if (/\bscale\s*in\b|\bzoom\s*in\b/i.test(normalized)) {
    intent.entrance = "scale"
  } else if (/\bbounce\s*in\b|\bbouncy\b/i.test(normalized)) {
    intent.entrance = "bounce"
  } else if (/\banimate[ds]?\b|\banimation\b/i.test(normalized)) {
    intent.entrance = "fade" // Default
  }

  // Exit animations
  if (/\bfade\s*out\b|\bfade-out\b|\bfades?\s+out\b/i.test(normalized)) {
    intent.exit = "fade"
  } else if (/\bslide\s*out\b|\bslide-out\b|\bslides?\s+out\b/i.test(normalized)) {
    intent.exit = "slide"
  } else if (/\bscale\s*out\b|\bzoom\s*out\b/i.test(normalized)) {
    intent.exit = "scale"
  }

  // Direction - check these patterns
  if (/\bfrom\s+(?:the\s+)?top\b|\bslides?\s+down\b/i.test(normalized)) {
    intent.direction = "down"
  } else if (/\bfrom\s+(?:the\s+)?bottom\b|\bslides?\s+up\b/i.test(normalized)) {
    intent.direction = "up"
    // If direction is specified, infer slide animation if not already set
    if (!intent.entrance) {
      intent.entrance = "slide"
    }
  } else if (/\bfrom\s+(?:the\s+)?left\b/i.test(normalized)) {
    intent.direction = "left"
    if (!intent.entrance) {
      intent.entrance = "slide"
    }
  } else if (/\bfrom\s+(?:the\s+)?right\b/i.test(normalized)) {
    intent.direction = "right"
    if (!intent.entrance) {
      intent.entrance = "slide"
    }
  }

  // Speed
  if (/\bfast\b|\bquick\b/i.test(normalized)) {
    intent.speed = "fast"
  } else if (/\bslow\b|\bgentle\b/i.test(normalized)) {
    intent.speed = "slow"
  } else if (/\binstant\b|\bimmediate\b/i.test(normalized)) {
    intent.speed = "instant"
  }

  // Reduced motion
  intent.respectReducedMotion = /\breduced\s+motion\b|\baccessib/i.test(normalized) ||
    normalized.includes("a11y")

  return intent
}

// ============================================================================
// Layout Detection
// ============================================================================

/**
 * Extracts layout intent from description
 */
export function extractLayoutIntent(description: string): LayoutIntent {
  const normalized = description.toLowerCase()
  const intent: LayoutIntent = {}

  // Display type
  if (normalized.includes("flex") || normalized.includes("flexible")) {
    intent.display = "flex"
  } else if (normalized.includes("grid")) {
    intent.display = "grid"
  } else if (normalized.includes("inline")) {
    intent.display = "inline"
  }

  // Direction
  if (normalized.includes("horizontal") || normalized.includes("row")) {
    intent.direction = "row"
  } else if (normalized.includes("vertical") || normalized.includes("column") ||
             normalized.includes("stack")) {
    intent.direction = "column"
  }

  // Alignment
  if (normalized.includes("center") || normalized.includes("centered")) {
    intent.align = "center"
    intent.justify = "center"
  } else if (normalized.includes("space between") || normalized.includes("spread")) {
    intent.justify = "between"
  } else if (normalized.includes("end") || normalized.includes("right align")) {
    intent.justify = "end"
  }

  // Width
  if (normalized.includes("full width") || normalized.includes("full-width") ||
      normalized.includes("stretch")) {
    intent.width = "full"
  } else if (normalized.includes("fixed width") || normalized.includes("fixed-width")) {
    intent.width = "fixed"
  }

  // Responsive
  intent.responsive = normalized.includes("responsive") ||
    normalized.includes("mobile") ||
    normalized.includes("adaptive")

  return intent
}

// ============================================================================
// Content Detection
// ============================================================================

/**
 * Extracts content intent from description
 */
export function extractContentIntent(description: string): ContentIntent {
  const normalized = description.toLowerCase()
  const intent: ContentIntent = {}

  // Icon
  if (normalized.includes("icon")) {
    intent.hasIcon = true
    if (normalized.includes("icon left") || normalized.includes("left icon")) {
      intent.iconPosition = "left"
    } else if (normalized.includes("icon right") || normalized.includes("right icon")) {
      intent.iconPosition = "right"
    } else if (normalized.includes("icon only") || normalized.includes("just icon")) {
      intent.iconPosition = "only"
    } else {
      intent.iconPosition = "left"
    }
  }

  // Image
  intent.hasImage = normalized.includes("image") ||
    normalized.includes("photo") ||
    normalized.includes("picture") ||
    normalized.includes("thumbnail")

  // Text elements
  intent.hasText = normalized.includes("text") ||
    normalized.includes("label") ||
    normalized.includes("content")

  intent.hasTitle = normalized.includes("title") ||
    normalized.includes("heading") ||
    normalized.includes("header")

  intent.hasDescription = normalized.includes("description") ||
    normalized.includes("subtitle") ||
    normalized.includes("subtext") ||
    normalized.includes("body")

  // Actions
  intent.hasActions = normalized.includes("action") ||
    normalized.includes("buttons") ||
    normalized.includes("cta")

  // Dismiss
  intent.hasDismiss = normalized.includes("dismiss") ||
    normalized.includes("close") ||
    normalized.includes("x button") ||
    normalized.includes("closeable")

  return intent
}

// ============================================================================
// Accessibility Detection
// ============================================================================

/**
 * Extracts accessibility intent from description
 */
export function extractAccessibilityIntent(description: string): AccessibilityIntent {
  const normalized = description.toLowerCase()
  const intent: AccessibilityIntent = {}

  // Explicit mention
  intent.explicitlyMentioned = normalized.includes("accessible") ||
    normalized.includes("a11y") ||
    normalized.includes("wcag") ||
    normalized.includes("aria")

  // ARIA label
  intent.needsAriaLabel = normalized.includes("aria label") ||
    normalized.includes("screen reader") ||
    intent.explicitlyMentioned

  // Keyboard support
  intent.needsKeyboardSupport = normalized.includes("keyboard") ||
    normalized.includes("tab") ||
    normalized.includes("focus") ||
    intent.explicitlyMentioned

  // Focus management
  intent.needsFocusManagement = normalized.includes("focus trap") ||
    normalized.includes("focus management") ||
    normalized.includes("modal") ||
    normalized.includes("dialog")

  // Announcements
  intent.needsAnnouncements = normalized.includes("announce") ||
    normalized.includes("live region") ||
    normalized.includes("alert") ||
    normalized.includes("toast")

  return intent
}

// ============================================================================
// Keyword Extraction
// ============================================================================

/**
 * Extracts relevant keywords from description
 */
export function extractKeywords(description: string): string[] {
  const normalized = description.toLowerCase()

  // Remove common words
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "shall",
    "can", "need", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after",
    "above", "below", "between", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all",
    "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "also", "now", "i", "want", "please", "me",
    "make", "create", "build", "generate", "give", "show", "display",
    "that", "this", "it", "its", "like", "looks", "looking",
  ])

  const words = normalized
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))

  // Also extract multi-word phrases
  const phrases: string[] = []
  const phrasePatterns = [
    /call to action/gi,
    /full width/gi,
    /hover effect/gi,
    /dark mode/gi,
    /light mode/gi,
    /focus ring/gi,
    /drop shadow/gi,
    /border radius/gi,
  ]

  for (const pattern of phrasePatterns) {
    const matches = description.match(pattern)
    if (matches) {
      phrases.push(...matches.map((m) => m.toLowerCase()))
    }
  }

  return [...new Set([...words, ...phrases])]
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyzes a natural language description and extracts design requirements
 */
export function analyzeDescription(
  description: string,
  config: AnalyzerConfig = {}
): AnalysisResult {
  const { minConfidence = 0.3, defaults = {} } = config

  // Detect component type
  const { type: componentType, confidence } = detectComponentType(description)
  const category = getComponentCategory(componentType)

  // Extract all intents
  const variant = detectStyleVariant(description)
  const size = detectSizeVariant(description)
  const shape = detectShapeVariant(description)
  const colors = extractColorIntent(description)
  const spacing = extractSpacingIntent(description)
  const typography = extractTypographyIntent(description)
  const interactions = extractInteractionIntent(description)
  const animations = extractAnimationIntent(description)
  const layout = extractLayoutIntent(description)
  const content = extractContentIntent(description)
  const accessibility = extractAccessibilityIntent(description)
  const keywords = extractKeywords(description)

  // Build primary requirements
  const primary: DesignRequirements = {
    componentType,
    category,
    confidence,
    variant: variant || defaults.variant,
    size: size || defaults.size,
    shape: shape || defaults.shape,
    colors: Object.keys(colors).length > 0 ? colors : defaults.colors,
    spacing: Object.keys(spacing).length > 0 ? spacing : defaults.spacing,
    typography: Object.keys(typography).length > 0 ? typography : defaults.typography,
    interactions: Object.keys(interactions).length > 0 ? interactions : defaults.interactions,
    animations: Object.keys(animations).length > 0 ? animations : defaults.animations,
    layout: Object.keys(layout).length > 0 ? layout : defaults.layout,
    content: Object.keys(content).length > 0 ? content : defaults.content,
    accessibility: Object.keys(accessibility).length > 0 ? accessibility : defaults.accessibility,
    keywords,
    originalDescription: description,
  }

  // Build result
  const result: AnalysisResult = {
    primary,
    warnings: [],
    suggestions: [],
  }

  // Add warnings
  if (confidence < minConfidence) {
    result.warnings!.push(
      `Low confidence (${(confidence * 100).toFixed(0)}%) in component type detection. ` +
      `Consider being more specific about the component type.`
    )
  }

  // Add suggestions for missing information
  if (!variant) {
    result.suggestions!.push("Consider specifying a style variant (e.g., primary, outline, ghost)")
  }
  if (!size) {
    result.suggestions!.push("Consider specifying a size (e.g., small, medium, large)")
  }
  if (Object.keys(colors).length === 0) {
    result.suggestions!.push("Consider specifying colors for better theming")
  }
  if (!accessibility.explicitlyMentioned) {
    result.suggestions!.push("Consider accessibility requirements for WCAG compliance")
  }

  return result
}

/**
 * Quick analysis for simple component type detection
 */
export function quickAnalyze(description: string): {
  type: ComponentType
  variant?: StyleVariant
  size?: SizeVariant
} {
  const { type } = detectComponentType(description)
  const variant = detectStyleVariant(description)
  const size = detectSizeVariant(description)

  return { type, variant, size }
}

/**
 * Validates design requirements
 */
export function validateRequirements(
  requirements: DesignRequirements
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!requirements.componentType) {
    errors.push("Component type is required")
  }

  if (requirements.componentType === "unknown" && requirements.confidence < 0.5) {
    errors.push("Could not determine component type from description")
  }

  if (!requirements.originalDescription) {
    errors.push("Original description is required")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
