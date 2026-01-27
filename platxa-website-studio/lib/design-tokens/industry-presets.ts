/**
 * Industry Presets
 *
 * 15 industry-specific design token presets in DTCG format.
 * Converts the 11 existing presets from odoo-skills/theme-generator.ts
 * and adds 4 new industries (finance, travel, food, beauty).
 */

import type { OdooColorPalette } from "../agent-bridge/types";
import type { DesignTokenSet, TypographyConfig } from "./types";
import { assembleTokenSet } from "./token-assembler";

// =============================================================================
// Preset Definition
// =============================================================================

interface PresetDefinition {
  industry: string;
  name: string;
  description: string;
  palette: Required<OdooColorPalette>;
  typography: TypographyConfig;
  designStyle: string;
}

/**
 * All 15 industry presets with their color palettes and typography.
 * The existing 11 are ported from INDUSTRY_PRESETS in theme-generator.ts;
 * 4 new ones (finance, travel, food, beauty) are added.
 */
const PRESET_DEFINITIONS: PresetDefinition[] = [
  // --- Existing 11 (ported from theme-generator.ts) ---
  {
    industry: "restaurant",
    name: "Restaurant & Food",
    description: "Warm, inviting design for restaurants and cafes",
    palette: { primary: "#c9302c", secondary: "#8b4513", accent: "#d4a373", background: "#fefae0", text: "#1a1a1a" },
    typography: { headingFamily: "Playfair Display", bodyFamily: "Lato", headingWeight: 700, bodyWeight: 400, scale: 1.25 },
    designStyle: "elegant",
  },
  {
    industry: "technology",
    name: "Technology & SaaS",
    description: "Clean, modern design for tech companies",
    palette: { primary: "#2563eb", secondary: "#7c3aed", accent: "#06b6d4", background: "#f8fafc", text: "#0f172a" },
    typography: { headingFamily: "Inter", bodyFamily: "Inter", headingWeight: 700, bodyWeight: 400, scale: 1.2 },
    designStyle: "modern",
  },
  {
    industry: "legal",
    name: "Law & Legal Services",
    description: "Professional, trustworthy design for law firms",
    palette: { primary: "#1e3a5f", secondary: "#c9a227", accent: "#2d4a6f", background: "#f7f7f7", text: "#1a1a1a" },
    typography: { headingFamily: "Merriweather", bodyFamily: "Source Sans Pro", headingWeight: 700, bodyWeight: 400, scale: 1.25 },
    designStyle: "classic",
  },
  {
    industry: "healthcare",
    name: "Healthcare & Medical",
    description: "Calming, professional design for healthcare providers",
    palette: { primary: "#0d9488", secondary: "#0284c7", accent: "#14b8a6", background: "#f0fdfa", text: "#134e4a" },
    typography: { headingFamily: "Nunito", bodyFamily: "Open Sans", headingWeight: 700, bodyWeight: 400, scale: 1.2 },
    designStyle: "modern",
  },
  {
    industry: "ecommerce",
    name: "E-commerce & Retail",
    description: "Conversion-focused design for online stores",
    palette: { primary: "#7c3aed", secondary: "#ec4899", accent: "#f59e0b", background: "#faf5ff", text: "#1f2937" },
    typography: { headingFamily: "Poppins", bodyFamily: "Poppins", headingWeight: 600, bodyWeight: 400, scale: 1.2 },
    designStyle: "bold",
  },
  {
    industry: "education",
    name: "Education & Learning",
    description: "Friendly, accessible design for educational institutions",
    palette: { primary: "#4f46e5", secondary: "#0891b2", accent: "#f97316", background: "#f5f5ff", text: "#1e1b4b" },
    typography: { headingFamily: "Nunito", bodyFamily: "Nunito", headingWeight: 700, bodyWeight: 400, scale: 1.2 },
    designStyle: "playful",
  },
  {
    industry: "realestate",
    name: "Real Estate & Property",
    description: "Elegant design for real estate agencies",
    palette: { primary: "#0f766e", secondary: "#b45309", accent: "#14b8a6", background: "#f7f9f9", text: "#134e4a" },
    typography: { headingFamily: "Cormorant Garamond", bodyFamily: "Montserrat", headingWeight: 600, bodyWeight: 400, scale: 1.25 },
    designStyle: "elegant",
  },
  {
    industry: "fitness",
    name: "Fitness & Wellness",
    description: "Energetic design for gyms and fitness studios",
    palette: { primary: "#dc2626", secondary: "#1f2937", accent: "#f59e0b", background: "#fafafa", text: "#111827" },
    typography: { headingFamily: "Oswald", bodyFamily: "Roboto", headingWeight: 700, bodyWeight: 400, scale: 1.25 },
    designStyle: "bold",
  },
  {
    industry: "creative",
    name: "Creative & Portfolio",
    description: "Bold, artistic design for creative professionals",
    palette: { primary: "#be185d", secondary: "#7c3aed", accent: "#06b6d4", background: "#fdf4ff", text: "#1f2937" },
    typography: { headingFamily: "Space Grotesk", bodyFamily: "DM Sans", headingWeight: 700, bodyWeight: 400, scale: 1.333 },
    designStyle: "bold",
  },
  {
    industry: "nonprofit",
    name: "Nonprofit & Charity",
    description: "Compassionate design for charitable organizations",
    palette: { primary: "#0891b2", secondary: "#059669", accent: "#f97316", background: "#ecfeff", text: "#164e63" },
    typography: { headingFamily: "Nunito", bodyFamily: "Open Sans", headingWeight: 700, bodyWeight: 400, scale: 1.2 },
    designStyle: "modern",
  },
  {
    industry: "generic",
    name: "Generic Business",
    description: "Versatile design for any business type",
    palette: { primary: "#2563eb", secondary: "#64748b", accent: "#10b981", background: "#f8fafc", text: "#1e293b" },
    typography: { headingFamily: "Inter", bodyFamily: "Inter", headingWeight: 700, bodyWeight: 400, scale: 1.2 },
    designStyle: "modern",
  },

  // --- 4 New Industries ---
  {
    industry: "finance",
    name: "Finance & Banking",
    description: "Authoritative, secure design for financial services",
    palette: { primary: "#1e40af", secondary: "#0f766e", accent: "#ca8a04", background: "#f8fafc", text: "#0c0a09" },
    typography: { headingFamily: "IBM Plex Sans", bodyFamily: "IBM Plex Sans", headingWeight: 600, bodyWeight: 400, scale: 1.2 },
    designStyle: "corporate",
  },
  {
    industry: "travel",
    name: "Travel & Tourism",
    description: "Inspiring, adventurous design for travel companies",
    palette: { primary: "#0369a1", secondary: "#15803d", accent: "#ea580c", background: "#f0f9ff", text: "#0c4a6e" },
    typography: { headingFamily: "Outfit", bodyFamily: "Outfit", headingWeight: 700, bodyWeight: 400, scale: 1.25 },
    designStyle: "modern",
  },
  {
    industry: "food",
    name: "Food & Beverage",
    description: "Appetizing, warm design for food brands and delivery",
    palette: { primary: "#ea580c", secondary: "#a16207", accent: "#65a30d", background: "#fffbeb", text: "#292524" },
    typography: { headingFamily: "Bricolage Grotesque", bodyFamily: "DM Sans", headingWeight: 700, bodyWeight: 400, scale: 1.25 },
    designStyle: "playful",
  },
  {
    industry: "beauty",
    name: "Beauty & Cosmetics",
    description: "Refined, luxurious design for beauty brands",
    palette: { primary: "#be185d", secondary: "#9d174d", accent: "#d4a373", background: "#fdf2f8", text: "#1c1917" },
    typography: { headingFamily: "Cormorant", bodyFamily: "Jost", headingWeight: 500, bodyWeight: 300, scale: 1.25 },
    designStyle: "elegant",
  },
];

// =============================================================================
// Cached Token Sets
// =============================================================================

const tokenSetCache = new Map<string, DesignTokenSet>();

/**
 * Returns a full DesignTokenSet for the given industry.
 * Results are cached after first generation.
 *
 * @param industry - Industry identifier (e.g. "technology", "finance")
 * @returns Complete DesignTokenSet, or the "generic" preset if not found
 */
export function getPresetTokens(industry: string): DesignTokenSet {
  const cached = tokenSetCache.get(industry);
  if (cached) return cached;

  const def = PRESET_DEFINITIONS.find((d) => d.industry === industry)
    || PRESET_DEFINITIONS.find((d) => d.industry === "generic")!;

  const tokens = assembleTokenSet({
    palette: def.palette,
    typography: def.typography,
    designStyle: def.designStyle,
    industry: def.industry,
    name: `platxa-${def.industry}`,
  });

  tokenSetCache.set(industry, tokens);
  return tokens;
}

/**
 * Lists all available industry presets with metadata.
 */
export function listPresets(): Array<{
  industry: string;
  name: string;
  description: string;
  designStyle: string;
}> {
  return PRESET_DEFINITIONS.map(({ industry, name, description, designStyle }) => ({
    industry,
    name,
    description,
    designStyle,
  }));
}
