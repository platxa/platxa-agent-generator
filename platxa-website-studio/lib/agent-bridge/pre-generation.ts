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
 * 1. Analyze user message for design intent
 * 2. Map color palette to brand tokens
 * 3. Generate full DTCG design tokens (when palette is available)
 * 4. Build enhanced prompt fragment
 */
export function runPreGeneration(input: PreGenerationInput): PreGenerationResult {
  const { userMessage, colorPalette, industry, designStyle } = input;

  // 1. Analyze design intent from user message
  const designAnalysis = analyzeUserMessage(userMessage);

  // 2. Map Odoo palette to brand tokens
  const brandTokens = mapOdooPaletteToBrandTokens(colorPalette);

  // 3. Generate full DTCG token set from the palette
  if (colorPalette) {
    const palette = {
      primary: colorPalette.primary || brandTokens.colors.primary,
      secondary: colorPalette.secondary || brandTokens.colors.secondary,
      accent: colorPalette.accent || brandTokens.colors.accent,
      background: colorPalette.background || brandTokens.colors.background,
      text: colorPalette.text || brandTokens.colors.text,
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
    if (designAnalysis.colorIntent?.mood === "dark") {
      brandTokens.darkModeTokens = deriveDarkMode(brandTokens.designTokens);
    }
  }

  // 4. Build compact prompt fragment
  const enhancedPromptFragment = buildPromptFragment(
    designAnalysis,
    brandTokens,
    industry,
    designStyle,
  );

  return {
    designAnalysis,
    brandTokens,
    enhancedPromptFragment,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a compact prompt fragment (<500 tokens) from analysis results.
 * This is injected into the system prompt before LLM streaming.
 */
function buildPromptFragment(
  analysis: DesignAnalysis,
  tokens: BrandTokenContext,
  industry?: string,
  designStyle?: string,
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

  // Design analysis hints
  if (analysis.componentType !== "unknown") {
    lines.push(`\n## Design Hints`);
    lines.push(`Section type: ${analysis.componentType}`);
  }

  if (analysis.colorIntent?.mood) {
    lines.push(`Mood: ${analysis.colorIntent.mood}`);
  }

  if (analysis.layoutIntent?.direction) {
    lines.push(`Layout: ${analysis.layoutIntent.direction}`);
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
