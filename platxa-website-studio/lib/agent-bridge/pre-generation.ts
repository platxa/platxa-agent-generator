/**
 * Pre-Generation Hook
 *
 * Runs before LLM streaming to produce:
 * 1. Design analysis from the user message (layout/color/typography intent)
 * 2. Brand token context from the project's color palette
 * 3. Enhanced prompt fragment to inject into system prompt
 */

import type {
  OdooColorPalette,
  BrandTokenContext,
  DesignAnalysis,
  PreGenerationResult,
} from "./types";
import { mapOdooPaletteToBrandTokens } from "./color-mapper";
import { assembleTokenSet } from "../design-tokens/token-assembler";
import { deriveDarkMode } from "../design-tokens/color-scale-generator";
import { analyzeDesignIntent, type DesignContext } from "./design-analyzer";
import { INDUSTRY_PRESETS } from "../odoo-skills/theme-generator";
import type { Industry } from "../odoo-skills/types";

// =============================================================================
// Lightweight Design Analysis (Odoo-focused)
// =============================================================================

/**
 * Extracts design intent from a user message.
 * This is a simplified version focused on what matters for Odoo template
 * generation — not component-level analysis like the frontend-agent's
 * analyzeDescription() which targets React components.
 */
function analyzeUserMessage(message: string): DesignAnalysis {
  const lower = message.toLowerCase();

  // Detect section/page type
  const componentType = detectOdooSectionType(lower);
  const category = categorizeRequest(lower);
  const confidence = componentType !== "unknown" ? 0.7 : 0.3;

  // Extract color mood
  const colorIntent = extractColorMood(lower);

  // Extract layout hints
  const layoutIntent = extractLayoutHints(lower);

  // Extract keywords
  const keywords = extractDesignKeywords(message);

  return {
    componentType,
    category,
    confidence,
    keywords,
    colorIntent: Object.keys(colorIntent).length > 0 ? colorIntent : undefined,
    layoutIntent: Object.keys(layoutIntent).length > 0 ? layoutIntent : undefined,
  };
}

/** Odoo section types (snippets) rather than React component types */
function detectOdooSectionType(text: string): string {
  const patterns: Record<string, string[]> = {
    hero: ["hero", "banner", "splash", "landing", "above the fold", "main section"],
    features: ["features", "services", "benefits", "capabilities", "what we offer"],
    testimonials: ["testimonials", "reviews", "quotes", "feedback", "what people say"],
    pricing: ["pricing", "plans", "packages", "tiers"],
    team: ["team", "staff", "people", "about us", "our team"],
    contact: ["contact", "get in touch", "reach us", "contact form"],
    cta: ["call to action", "cta", "sign up", "get started", "try now"],
    gallery: ["gallery", "portfolio", "showcase", "our work", "projects"],
    faq: ["faq", "questions", "frequently asked"],
    footer: ["footer", "bottom"],
    full_page: ["website", "page", "theme", "full site", "complete"],
  };

  for (const [type, keywords] of Object.entries(patterns)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return type;
    }
  }
  return "unknown";
}

function categorizeRequest(text: string): string {
  if (text.includes("fix") || text.includes("change") || text.includes("update")) return "modification";
  if (text.includes("style") || text.includes("color") || text.includes("font")) return "styling";
  if (text.includes("add") || text.includes("create") || text.includes("new")) return "creation";
  if (text.includes("generate") || text.includes("build") || text.includes("make")) return "generation";
  return "generation";
}

function extractColorMood(text: string): NonNullable<DesignAnalysis["colorIntent"]> {
  const result: NonNullable<DesignAnalysis["colorIntent"]> = {};

  // Mood detection
  const moods: Record<string, string[]> = {
    professional: ["professional", "corporate", "business", "formal", "executive"],
    playful: ["playful", "fun", "vibrant", "colorful", "energetic", "lively"],
    elegant: ["elegant", "luxury", "premium", "sophisticated", "refined"],
    minimal: ["minimal", "clean", "simple", "modern", "sleek"],
    warm: ["warm", "cozy", "friendly", "welcoming", "inviting"],
    cool: ["cool", "calm", "serene", "peaceful", "tranquil"],
    bold: ["bold", "strong", "powerful", "impactful", "dramatic"],
    dark: ["dark", "dark mode", "night", "moody"],
  };

  for (const [mood, keywords] of Object.entries(moods)) {
    if (keywords.some((kw) => text.includes(kw))) {
      result.mood = mood;
      break;
    }
  }

  // Temperature detection
  const warmKeywords = ["warm", "red", "orange", "yellow", "gold", "amber", "burgundy", "terracotta"];
  const coolKeywords = ["cool", "blue", "green", "teal", "cyan", "purple", "navy", "mint"];

  if (warmKeywords.some((kw) => text.includes(kw))) {
    result.temperature = "warm";
  } else if (coolKeywords.some((kw) => text.includes(kw))) {
    result.temperature = "cool";
  }

  return result;
}

function extractLayoutHints(text: string): NonNullable<DesignAnalysis["layoutIntent"]> {
  const result: NonNullable<DesignAnalysis["layoutIntent"]> = {};

  if (text.includes("centered") || text.includes("center")) result.alignment = "center";
  if (text.includes("grid") || text.includes("columns")) result.distribution = "grid";
  if (text.includes("side by side") || text.includes("horizontal")) result.direction = "horizontal";
  if (text.includes("stacked") || text.includes("vertical")) result.direction = "vertical";

  return result;
}

function extractDesignKeywords(text: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "can", "to", "of", "in", "for", "on",
    "with", "at", "by", "from", "as", "into", "that", "this", "it",
    "its", "i", "me", "my", "want", "please", "make", "create", "build",
    "generate", "give", "show", "like", "need",
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

// =============================================================================
// Industry Auto-Detection
// =============================================================================

/**
 * Industry keyword patterns for auto-detection from user messages.
 * Maps keywords found in user prompts to Industry types.
 */
const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  restaurant: [
    "restaurant", "cafe", "coffee", "bistro", "diner", "eatery", "food",
    "dining", "menu", "cuisine", "chef", "kitchen", "bakery", "pizzeria",
    "bar", "pub", "grill", "steakhouse", "sushi", "catering",
  ],
  technology: [
    "tech", "technology", "saas", "software", "app", "startup", "digital",
    "platform", "cloud", "api", "developer", "coding", "ai", "machine learning",
    "data", "analytics", "cyber", "fintech", "blockchain",
  ],
  legal: [
    "law", "legal", "lawyer", "attorney", "firm", "litigation", "court",
    "justice", "paralegal", "counsel", "advocate", "barrister", "solicitor",
  ],
  healthcare: [
    "health", "healthcare", "medical", "clinic", "hospital", "doctor",
    "physician", "dental", "dentist", "therapy", "therapist", "wellness",
    "pharmacy", "nursing", "patient", "care",
  ],
  ecommerce: [
    "ecommerce", "e-commerce", "shop", "store", "retail", "products",
    "marketplace", "buy", "sell", "cart", "checkout", "inventory",
  ],
  fitness: [
    "fitness", "gym", "workout", "training", "exercise", "sports", "yoga",
    "pilates", "crossfit", "personal trainer", "athletic", "wellness",
  ],
  education: [
    "education", "school", "university", "college", "academy", "learning",
    "course", "training", "tutoring", "student", "teacher", "classroom",
    "curriculum", "degree", "certification", "online learning", "e-learning",
  ],
  realestate: [
    "real estate", "realestate", "property", "properties", "housing", "home",
    "apartment", "condo", "rental", "mortgage", "broker", "agent", "listing",
    "commercial", "residential", "investment property",
  ],
  creative: [
    "creative", "design", "art", "artist", "studio", "portfolio", "photography",
    "photographer", "graphic", "illustration", "animation", "video", "film",
    "music", "agency", "branding", "marketing",
  ],
  nonprofit: [
    "nonprofit", "non-profit", "charity", "foundation", "ngo", "volunteer",
    "donation", "cause", "community", "social", "mission", "advocacy",
    "humanitarian", "welfare", "fundraising",
  ],
  generic: [], // Fallback, no specific keywords
};

/**
 * Detects industry type from user message by matching keywords.
 * Returns the detected industry or undefined if no strong match.
 */
export function detectIndustry(text: string): Industry | undefined {
  const lower = text.toLowerCase();

  // Count matches for each industry
  const scores: Record<string, number> = {};

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (industry === "generic") continue;

    let score = 0;
    for (const keyword of keywords) {
      // Use word boundary matching for accuracy
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    if (score > 0) {
      scores[industry] = score;
    }
  }

  // Find the industry with highest score
  const entries = Object.entries(scores);
  if (entries.length === 0) return undefined;

  entries.sort((a, b) => b[1] - a[1]);
  const [topIndustry, topScore] = entries[0];

  // Require at least 1 keyword match
  if (topScore >= 1) {
    return topIndustry as Industry;
  }

  return undefined;
}

/**
 * Gets color palette from industry preset.
 * Returns undefined if industry is not found.
 */
export function getIndustryColorPalette(industry: Industry): OdooColorPalette | undefined {
  const preset = INDUSTRY_PRESETS[industry];
  if (!preset) return undefined;

  return {
    primary: preset.colors.primary,
    secondary: preset.colors.secondary,
    accent: preset.colors.accent,
    background: preset.colors.background,
    text: preset.colors.text,
  };
}

// =============================================================================
// Public API
// =============================================================================

export interface PreGenerationInput {
  userMessage: string;
  colorPalette?: OdooColorPalette;
  industry?: string;
  designStyle?: string;
}

/**
 * Runs the pre-generation pipeline:
 * 1. Analyze user message for design intent (comprehensive design-analyzer)
 * 2. Auto-detect industry from user message if not provided
 * 3. Map color palette to brand tokens (using industry colors if detected)
 * 4. Generate full DTCG design tokens (when palette is available)
 * 5. Build enhanced prompt fragment with rich design context
 */
export function runPreGeneration(input: PreGenerationInput): PreGenerationResult {
  const { userMessage, colorPalette, designStyle } = input;

  // Auto-detect industry from user message if not explicitly provided
  let industry = input.industry;
  let detectedIndustry: Industry | undefined;

  if (!industry) {
    detectedIndustry = detectIndustry(userMessage);
    if (detectedIndustry) {
      industry = detectedIndustry;
      console.log(`[PreGeneration] Auto-detected industry: ${industry}`);
    }
  }

  // 1. Run comprehensive design analysis (colors, layout, mood, typography, spacing)
  const designContext = analyzeDesignIntent(userMessage);

  // 1b. Also run lightweight analysis for backward compatibility
  const designAnalysis = analyzeUserMessage(userMessage);

  // Merge insights from comprehensive analysis into designAnalysis
  if (designContext.colors.mood) {
    designAnalysis.colorIntent = designAnalysis.colorIntent || {};
    designAnalysis.colorIntent.mood = designContext.colors.mood;
    // Map warm/cool to temperature
    if (designContext.colors.mood === "warm" || designContext.colors.mood === "cool") {
      designAnalysis.colorIntent.temperature = designContext.colors.mood;
    }
  }
  if (designContext.layout.style.length > 0) {
    designAnalysis.layoutIntent = designAnalysis.layoutIntent || {};
    if (designContext.layout.style.includes("centered") || designContext.layout.patterns.includes("centered")) {
      designAnalysis.layoutIntent.alignment = "center";
    }
    if (designContext.layout.style.includes("grid")) {
      designAnalysis.layoutIntent.distribution = "grid";
    }
    if (designContext.layout.style.includes("single-column")) {
      designAnalysis.layoutIntent.direction = "vertical";
    } else if (designContext.layout.style.includes("two-column") || designContext.layout.style.includes("three-column")) {
      designAnalysis.layoutIntent.direction = "horizontal";
    }
  }

  // 2. Determine color palette: explicit > industry preset > defaults
  let effectiveColorPalette = colorPalette;

  if (!effectiveColorPalette && industry) {
    // Use industry preset colors when no explicit palette provided
    effectiveColorPalette = getIndustryColorPalette(industry as Industry);
    if (effectiveColorPalette) {
      console.log(`[PreGeneration] Using ${industry} industry color palette:`, effectiveColorPalette);
    }
  }

  // 3. Map Odoo palette to brand tokens
  const brandTokens = mapOdooPaletteToBrandTokens(effectiveColorPalette);

  // 4. Generate full DTCG token set from the palette
  if (effectiveColorPalette) {
    const palette = {
      primary: effectiveColorPalette.primary || brandTokens.colors.primary,
      secondary: effectiveColorPalette.secondary || brandTokens.colors.secondary,
      accent: effectiveColorPalette.accent || brandTokens.colors.accent,
      background: effectiveColorPalette.background || brandTokens.colors.background,
      text: effectiveColorPalette.text || brandTokens.colors.text,
    };

    const typographyConfig = brandTokens.typography
      ? {
          headingFamily: brandTokens.typography.headingFamily,
          bodyFamily: brandTokens.typography.bodyFamily,
          headingWeight: 700,
          bodyWeight: 400,
          scale: parseFloat(brandTokens.typography.scale) || 1.2,
        }
      : undefined;

    brandTokens.designTokens = assembleTokenSet({
      palette,
      typography: typographyConfig,
      designStyle: designStyle || "modern",
      industry,
      name: industry ? `platxa-${industry}` : "platxa-custom",
    });

    // Generate dark mode tokens if design analysis suggests dark theme
    if (designAnalysis.colorIntent?.mood === "dark" || designContext.colors.darkMode) {
      brandTokens.darkModeTokens = deriveDarkMode(brandTokens.designTokens);
    }
  }

  // 4. Build compact prompt fragment with rich design context
  const enhancedPromptFragment = buildPromptFragment(
    designAnalysis,
    brandTokens,
    industry,
    designStyle,
    designContext,
  );

  return {
    designAnalysis,
    designContext,
    brandTokens,
    enhancedPromptFragment,
    industry,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a compact prompt fragment (<500 tokens) from analysis results.
 * This is injected into the system prompt before LLM streaming.
 * Now includes rich design context from design-analyzer.
 */
function buildPromptFragment(
  analysis: DesignAnalysis,
  tokens: BrandTokenContext,
  industry?: string,
  designStyle?: string,
  designContext?: DesignContext,
): string {
  const lines: string[] = ["## Brand Tokens"];

  // Colors (compact format)
  lines.push(`Primary: ${tokens.colors.primary}`);
  lines.push(`Secondary: ${tokens.colors.secondary}`);
  lines.push(`Accent: ${tokens.colors.accent}`);
  lines.push(`Background: ${tokens.colors.background}`);
  lines.push(`Text: ${tokens.colors.text}`);
  lines.push(`Error: ${tokens.colors.error} | Warning: ${tokens.colors.warning} | Success: ${tokens.colors.success} | Info: ${tokens.colors.info}`);

  // OKLCH info for intelligent color derivation
  const p = tokens.colors.primaryOklch;
  lines.push(`Primary OKLCH: L=${p.l} C=${p.c} H=${p.h}`);

  // Typography (if set)
  if (tokens.typography) {
    lines.push(`Headings: ${tokens.typography.headingFamily}`);
    lines.push(`Body: ${tokens.typography.bodyFamily}`);
  }

  // Design analysis hints section
  lines.push(`\n## Design Hints`);

  if (analysis.componentType !== "unknown") {
    lines.push(`Section type: ${analysis.componentType}`);
  }

  // Include rich design context from design-analyzer
  if (designContext) {
    // Color intent from design-analyzer
    if (designContext.colors.mood) {
      lines.push(`Color mood: ${designContext.colors.mood}`);
    }
    if (designContext.colors.namedColors.length > 0) {
      lines.push(`Requested colors: ${designContext.colors.namedColors.join(", ")}`);
    }
    if (designContext.colors.darkMode) {
      lines.push(`Dark mode: requested`);
    }

    // Layout intent from design-analyzer
    if (designContext.layout.style.length > 0) {
      lines.push(`Layout style: ${designContext.layout.style.join(", ")}`);
    }
    if (designContext.layout.patterns.length > 0) {
      lines.push(`Layout patterns: ${designContext.layout.patterns.join(", ")}`);
    }
    if (designContext.layout.columns !== null) {
      lines.push(`Columns: ${designContext.layout.columns}`);
    }
    if (designContext.layout.fullWidth) {
      lines.push(`Full width: yes`);
    }

    // Mood/aesthetic from design-analyzer
    if (designContext.mood.keywords.length > 0) {
      lines.push(`Aesthetic: ${designContext.mood.keywords.join(", ")}`);
    }
    lines.push(`Formality: ${designContext.mood.formality}/5 | Energy: ${designContext.mood.energy}/5`);

    // Typography from design-analyzer
    if (designContext.typography.style.length > 0) {
      lines.push(`Font style: ${designContext.typography.style.join(", ")}`);
    }
    if (designContext.typography.fontNames.length > 0) {
      lines.push(`Requested fonts: ${designContext.typography.fontNames.join(", ")}`);
    }
    if (designContext.typography.sizePreference) {
      lines.push(`Text size: ${designContext.typography.sizePreference}`);
    }

    // Spacing from design-analyzer
    if (designContext.spacing.density) {
      lines.push(`Spacing: ${designContext.spacing.density}`);
    }

    // Suggested sections
    if (designContext.suggestedSections.length > 0) {
      lines.push(`Suggested sections: ${designContext.suggestedSections.join(", ")}`);
    }

    // Confidence score
    lines.push(`Analysis confidence: ${Math.round(designContext.confidence * 100)}%`);
  } else {
    // Fallback to basic analysis
    if (analysis.colorIntent?.mood) {
      lines.push(`Mood: ${analysis.colorIntent.mood}`);
    }
    if (analysis.layoutIntent?.direction) {
      lines.push(`Layout: ${analysis.layoutIntent.direction}`);
    }
  }

  if (industry) {
    lines.push(`Industry: ${industry}`);
  }

  if (designStyle) {
    lines.push(`Style: ${designStyle}`);
  }

  // Enforcement rule
  lines.push(`\nIMPORTANT: Use ONLY the colors listed above. Do not introduce new colors.`);

  return lines.join("\n");
}
