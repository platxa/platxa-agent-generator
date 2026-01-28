/**
 * Design Analyzer — Pre-Generation Context Building
 *
 * Analyzes user prompts to extract design intent (colors, layout, mood,
 * typography, spacing) before generation starts, producing a structured
 * design context for the AI pipeline.
 */

// =============================================================================
// Types
// =============================================================================

/** Detected color intent */
export interface ColorIntent {
  /** Named colors mentioned */
  namedColors: string[];
  /** Hex codes mentioned */
  hexCodes: string[];
  /** Color mood (warm, cool, neutral, vibrant, muted) */
  mood: string | null;
  /** Whether dark mode was requested */
  darkMode: boolean;
}

/** Detected layout intent */
export interface LayoutIntent {
  /** Layout style keywords */
  style: string[];
  /** Specific layout patterns mentioned */
  patterns: string[];
  /** Number of columns hinted */
  columns: number | null;
  /** Whether full-width was requested */
  fullWidth: boolean;
}

/** Detected mood/aesthetic intent */
export interface MoodIntent {
  /** Primary mood keywords */
  keywords: string[];
  /** Formality level (1=casual, 5=formal) */
  formality: number;
  /** Energy level (1=calm, 5=energetic) */
  energy: number;
}

/** Detected typography intent */
export interface TypographyIntent {
  /** Font style preferences */
  style: string[];
  /** Specific font names mentioned */
  fontNames: string[];
  /** Size preference (compact, normal, large) */
  sizePreference: string | null;
}

/** Detected spacing intent */
export interface SpacingIntent {
  /** Density preference (tight, normal, spacious) */
  density: string | null;
  /** Whether padding/margin specifics were mentioned */
  hasSpecifics: boolean;
}

/** Complete design context extracted from prompt */
export interface DesignContext {
  /** Original prompt */
  prompt: string;
  /** Color intent */
  colors: ColorIntent;
  /** Layout intent */
  layout: LayoutIntent;
  /** Mood/aesthetic intent */
  mood: MoodIntent;
  /** Typography intent */
  typography: TypographyIntent;
  /** Spacing intent */
  spacing: SpacingIntent;
  /** Overall confidence in analysis (0-1) */
  confidence: number;
  /** Suggested Odoo section types based on intent */
  suggestedSections: string[];
}

// =============================================================================
// Color Analysis
// =============================================================================

const NAMED_COLORS: Record<string, string> = {
  red: "#EF4444", blue: "#3B82F6", green: "#10B981", yellow: "#F59E0B",
  orange: "#F97316", purple: "#8B5CF6", pink: "#EC4899", teal: "#14B8A6",
  indigo: "#6366F1", cyan: "#06B6D4", emerald: "#059669", rose: "#F43F5E",
  amber: "#D97706", lime: "#84CC16", sky: "#0EA5E9", violet: "#7C3AED",
  navy: "#1E3A5F", coral: "#FF6B6B", gold: "#D4A017", silver: "#94A3B8",
  black: "#000000", white: "#FFFFFF", gray: "#6B7280", grey: "#6B7280",
};

const WARM_COLORS = ["red", "orange", "yellow", "amber", "coral", "gold", "rose", "pink"];
const COOL_COLORS = ["blue", "green", "teal", "cyan", "indigo", "sky", "violet", "navy", "emerald"];

function analyzeColors(prompt: string): ColorIntent {
  const lower = prompt.toLowerCase();
  const namedColors: string[] = [];
  const hexCodes: string[] = [];

  // Extract named colors
  for (const color of Object.keys(NAMED_COLORS)) {
    if (new RegExp(`\\b${color}\\b`, "i").test(lower)) {
      namedColors.push(color);
    }
  }

  // Extract hex codes
  const hexMatches = prompt.match(/#[0-9A-Fa-f]{3,8}\b/g);
  if (hexMatches) hexCodes.push(...hexMatches);

  // Determine mood
  let mood: string | null = null;
  const hasWarm = namedColors.some((c) => WARM_COLORS.includes(c));
  const hasCool = namedColors.some((c) => COOL_COLORS.includes(c));
  if (/\b(vibrant|bright|bold|vivid|saturated)\b/i.test(lower)) mood = "vibrant";
  else if (/\b(muted|pastel|soft|subtle|desaturated)\b/i.test(lower)) mood = "muted";
  else if (hasWarm && !hasCool) mood = "warm";
  else if (hasCool && !hasWarm) mood = "cool";
  else if (/\b(neutral|monochrome|grayscale)\b/i.test(lower)) mood = "neutral";

  const darkMode = /\b(dark\s*mode|dark\s*theme|dark\s*background|black\s*background)\b/i.test(lower);

  return { namedColors, hexCodes, mood, darkMode };
}

// =============================================================================
// Layout Analysis
// =============================================================================

const LAYOUT_STYLES: [string, RegExp][] = [
  ["grid", /\b(grid|cards|tiles)\b/i],
  ["single-column", /\b(single.?column|one.?column|narrow)\b/i],
  ["two-column", /\b(two.?column|split|side.?by.?side)\b/i],
  ["three-column", /\b(three.?column)\b/i],
  ["masonry", /\b(masonry|pinterest)\b/i],
  ["hero-centric", /\b(hero|banner|splash|landing)\b/i],
  ["sidebar", /\b(sidebar|side.?panel)\b/i],
  ["full-width", /\b(full.?width|edge.?to.?edge|bleed)\b/i],
];

const LAYOUT_PATTERNS: [string, RegExp][] = [
  ["zigzag", /\b(zigzag|alternating|staggered)\b/i],
  ["centered", /\b(centered|center.?aligned|middle)\b/i],
  ["asymmetric", /\b(asymmetric|offset|unbalanced)\b/i],
  ["overlapping", /\b(overlapping|layered|stacked)\b/i],
];

function analyzeLayout(prompt: string): LayoutIntent {
  const style: string[] = [];
  const patterns: string[] = [];

  for (const [name, regex] of LAYOUT_STYLES) {
    if (regex.test(prompt)) style.push(name);
  }
  for (const [name, regex] of LAYOUT_PATTERNS) {
    if (regex.test(prompt)) patterns.push(name);
  }

  let columns: number | null = null;
  const colMatch = prompt.match(/(\d)\s*columns?/i);
  if (colMatch) columns = parseInt(colMatch[1], 10);

  const fullWidth = style.includes("full-width");

  return { style, patterns, columns, fullWidth };
}

// =============================================================================
// Mood Analysis
// =============================================================================

const MOOD_KEYWORDS: [string, number, number][] = [
  // [keyword, formality (1-5), energy (1-5)]
  ["professional", 5, 2],
  ["corporate", 5, 2],
  ["formal", 5, 1],
  ["elegant", 4, 2],
  ["sophisticated", 4, 2],
  ["luxurious", 4, 3],
  ["modern", 3, 3],
  ["clean", 3, 2],
  ["minimal", 3, 1],
  ["simple", 2, 1],
  ["casual", 1, 3],
  ["friendly", 2, 3],
  ["playful", 1, 5],
  ["fun", 1, 5],
  ["energetic", 2, 5],
  ["bold", 3, 5],
  ["dynamic", 3, 4],
  ["warm", 2, 3],
  ["cozy", 1, 2],
  ["creative", 2, 4],
  ["artistic", 2, 4],
  ["rustic", 2, 2],
  ["vintage", 3, 2],
  ["futuristic", 3, 4],
  ["techy", 3, 3],
];

function analyzeMood(prompt: string): MoodIntent {
  const lower = prompt.toLowerCase();
  const keywords: string[] = [];
  let formalitySum = 0;
  let energySum = 0;
  let count = 0;

  for (const [kw, formality, energy] of MOOD_KEYWORDS) {
    if (lower.includes(kw)) {
      keywords.push(kw);
      formalitySum += formality;
      energySum += energy;
      count++;
    }
  }

  return {
    keywords,
    formality: count > 0 ? Math.round(formalitySum / count) : 3,
    energy: count > 0 ? Math.round(energySum / count) : 3,
  };
}

// =============================================================================
// Typography Analysis
// =============================================================================

const FONT_STYLES: [string, RegExp][] = [
  ["serif", /\b(serif|traditional|classic)\b/i],
  ["sans-serif", /\b(sans.?serif|modern|clean)\b/i],
  ["monospace", /\b(monospace|code|technical)\b/i],
  ["handwritten", /\b(handwritten|script|cursive|calligraphy)\b/i],
  ["display", /\b(display|decorative|headline)\b/i],
];

const KNOWN_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Playfair Display", "Merriweather", "Source Sans Pro", "Nunito",
  "Raleway", "Ubuntu", "PT Sans", "Work Sans", "DM Sans",
];

function analyzeTypography(prompt: string): TypographyIntent {
  const style: string[] = [];
  const fontNames: string[] = [];

  for (const [name, regex] of FONT_STYLES) {
    if (regex.test(prompt)) style.push(name);
  }

  for (const font of KNOWN_FONTS) {
    if (prompt.toLowerCase().includes(font.toLowerCase())) {
      fontNames.push(font);
    }
  }

  let sizePreference: string | null = null;
  if (/\b(large|big|oversized|xl|hero.?text)\b/i.test(prompt)) sizePreference = "large";
  else if (/\b(compact|small|dense|condensed)\b/i.test(prompt)) sizePreference = "compact";

  return { style, fontNames, sizePreference };
}

// =============================================================================
// Spacing Analysis
// =============================================================================

function analyzeSpacing(prompt: string): SpacingIntent {
  let density: string | null = null;
  if (/\b(spacious|airy|breathing|generous|open)\b/i.test(prompt)) density = "spacious";
  else if (/\b(tight|compact|dense|condensed|snug)\b/i.test(prompt)) density = "tight";

  const hasSpecifics = /\b(padding|margin|gap|spacing)\b/i.test(prompt);

  return { density, hasSpecifics };
}

// =============================================================================
// Section Suggestion
// =============================================================================

function suggestSections(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const sections: string[] = [];

  const sectionMap: [string, RegExp][] = [
    ["hero", /\b(hero|banner|landing|header|splash)\b/i],
    ["features", /\b(features?|benefits?|services?|highlights?)\b/i],
    ["about", /\b(about|story|mission|who\s+we)\b/i],
    ["testimonials", /\b(testimonials?|reviews?|feedback|clients?)\b/i],
    ["pricing", /\b(pricing|plans?|packages?|cost)\b/i],
    ["team", /\b(team|staff|people|members?)\b/i],
    ["gallery", /\b(gallery|photos?|images?|portfolio)\b/i],
    ["contact", /\b(contact|form|reach|email)\b/i],
    ["cta", /\b(cta|call.?to.?action|sign.?up|get\s+started)\b/i],
    ["faq", /\b(faq|questions?|help)\b/i],
    ["stats", /\b(stats?|numbers?|counter|achievements?)\b/i],
    ["blog", /\b(blog|articles?|posts?|news)\b/i],
  ];

  for (const [section, regex] of sectionMap) {
    if (regex.test(lower)) sections.push(section);
  }

  // Default: always include hero if nothing detected
  if (sections.length === 0) sections.push("hero", "features", "cta");

  return sections;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Analyzes a user prompt for design intent before generation starts.
 * Extracts colors, layout, mood, typography, and spacing preferences.
 */
export function analyzeDesignIntent(prompt: string): DesignContext {
  const colors = analyzeColors(prompt);
  const layout = analyzeLayout(prompt);
  const mood = analyzeMood(prompt);
  const typography = analyzeTypography(prompt);
  const spacing = analyzeSpacing(prompt);
  const suggestedSections = suggestSections(prompt);

  // Confidence: more signals = higher confidence
  const signals = [
    colors.namedColors.length > 0 || colors.hexCodes.length > 0,
    layout.style.length > 0,
    mood.keywords.length > 0,
    typography.style.length > 0 || typography.fontNames.length > 0,
    spacing.density !== null,
    suggestedSections.length > 3,
  ].filter(Boolean).length;

  const confidence = Math.min(1, Math.round((signals / 6) * 100) / 100);

  return {
    prompt,
    colors,
    layout,
    mood,
    typography,
    spacing,
    confidence,
    suggestedSections,
  };
}
