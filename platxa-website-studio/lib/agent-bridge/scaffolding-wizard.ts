/**
 * Project Scaffolding Wizard
 *
 * Generates a complete Odoo theme project from a single natural language
 * prompt. Extracts intent, brand, pages, and sections to produce a full
 * theme definition with 5+ pages and brand identity.
 */

// =============================================================================
// Types
// =============================================================================

/** Extracted brand identity from the prompt */
export interface ExtractedBrand {
  /** Business/theme name */
  name: string;
  /** Industry or niche */
  industry: string;
  /** Primary color (hex) */
  primaryColor: string;
  /** Secondary color (hex) */
  secondaryColor: string;
  /** Accent color (hex) */
  accentColor: string;
  /** Suggested heading font */
  headingFont: string;
  /** Suggested body font */
  bodyFont: string;
  /** Tone/mood keywords */
  tone: string[];
}

/** A page in the scaffolded project */
export interface ScaffoldedPage {
  /** Page slug (e.g. "home", "about") */
  slug: string;
  /** Page display title */
  title: string;
  /** Sections on this page */
  sections: string[];
  /** Whether this is the homepage */
  isHomepage: boolean;
  /** Brief description of page purpose */
  description: string;
}

/** Complete scaffolded project */
export interface ScaffoldedProject {
  /** Module technical name */
  moduleName: string;
  /** Display name */
  displayName: string;
  /** Project description */
  description: string;
  /** Extracted brand identity */
  brand: ExtractedBrand;
  /** Pages (5+) */
  pages: ScaffoldedPage[];
  /** All unique section types used */
  sectionTypes: string[];
  /** Odoo version target */
  odooVersion: string;
  /** Original prompt */
  originalPrompt: string;
  /** Features detected from prompt */
  features: ProjectFeature[];
}

/** A detected feature requirement */
export interface ProjectFeature {
  /** Feature identifier */
  id: string;
  /** Display label */
  label: string;
  /** Whether this feature was explicitly mentioned */
  explicit: boolean;
}

// =============================================================================
// Industry Presets
// =============================================================================

interface IndustryPreset {
  keywords: string[];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  tone: string[];
  suggestedPages: string[];
  suggestedSections: Record<string, string[]>;
}

const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  restaurant: {
    keywords: ["restaurant", "food", "cafe", "bistro", "dining", "pizza", "sushi", "bakery"],
    primaryColor: "#8B2500",
    secondaryColor: "#F5E6CC",
    accentColor: "#D4A017",
    headingFont: "Playfair Display",
    bodyFont: "Lato",
    tone: ["warm", "inviting", "appetizing"],
    suggestedPages: ["home", "menu", "about", "reservations", "contact"],
    suggestedSections: {
      home: ["hero", "features", "gallery", "testimonials", "cta"],
      menu: ["hero", "pricing", "gallery"],
      about: ["hero", "about", "team", "stats"],
      reservations: ["hero", "contact", "faq"],
      contact: ["hero", "contact"],
    },
  },
  technology: {
    keywords: ["tech", "software", "saas", "app", "startup", "digital", "ai", "platform"],
    primaryColor: "#3B82F6",
    secondaryColor: "#0F172A",
    accentColor: "#10B981",
    headingFont: "Inter",
    bodyFont: "Inter",
    tone: ["modern", "innovative", "clean"],
    suggestedPages: ["home", "features", "pricing", "about", "contact"],
    suggestedSections: {
      home: ["hero", "features", "stats", "testimonials", "cta"],
      features: ["hero", "features", "about", "cta"],
      pricing: ["hero", "pricing", "faq", "cta"],
      about: ["hero", "about", "team", "stats"],
      contact: ["hero", "contact"],
    },
  },
  healthcare: {
    keywords: ["health", "medical", "clinic", "doctor", "hospital", "dental", "wellness", "therapy"],
    primaryColor: "#0891B2",
    secondaryColor: "#F0FDFA",
    accentColor: "#14B8A6",
    headingFont: "Nunito",
    bodyFont: "Open Sans",
    tone: ["trustworthy", "caring", "professional"],
    suggestedPages: ["home", "services", "about", "team", "contact"],
    suggestedSections: {
      home: ["hero", "features", "about", "testimonials", "cta"],
      services: ["hero", "features", "pricing", "faq"],
      about: ["hero", "about", "stats", "testimonials"],
      team: ["hero", "team"],
      contact: ["hero", "contact", "faq"],
    },
  },
  ecommerce: {
    keywords: ["shop", "store", "ecommerce", "e-commerce", "retail", "fashion", "boutique"],
    primaryColor: "#7C3AED",
    secondaryColor: "#1E1B4B",
    accentColor: "#F59E0B",
    headingFont: "Montserrat",
    bodyFont: "Source Sans Pro",
    tone: ["trendy", "vibrant", "engaging"],
    suggestedPages: ["home", "shop", "about", "lookbook", "contact"],
    suggestedSections: {
      home: ["hero", "features", "gallery", "testimonials", "cta"],
      shop: ["hero", "features", "pricing"],
      about: ["hero", "about", "team", "stats"],
      lookbook: ["hero", "gallery", "cta"],
      contact: ["hero", "contact"],
    },
  },
  corporate: {
    keywords: ["corporate", "business", "consulting", "agency", "law", "finance", "accounting"],
    primaryColor: "#1E3A5F",
    secondaryColor: "#F8FAFC",
    accentColor: "#2563EB",
    headingFont: "Merriweather",
    bodyFont: "Source Sans Pro",
    tone: ["professional", "authoritative", "trustworthy"],
    suggestedPages: ["home", "services", "about", "case-studies", "contact"],
    suggestedSections: {
      home: ["hero", "features", "stats", "testimonials", "cta"],
      services: ["hero", "features", "pricing", "cta"],
      about: ["hero", "about", "team", "stats"],
      "case-studies": ["hero", "portfolio", "testimonials"],
      contact: ["hero", "contact"],
    },
  },
};

/** Default preset when no industry matches */
const DEFAULT_PRESET: IndustryPreset = {
  keywords: [],
  primaryColor: "#3B82F6",
  secondaryColor: "#1E293B",
  accentColor: "#10B981",
  headingFont: "Inter",
  bodyFont: "Inter",
  tone: ["modern", "clean", "professional"],
  suggestedPages: ["home", "about", "services", "portfolio", "contact"],
  suggestedSections: {
    home: ["hero", "features", "about", "testimonials", "cta"],
    about: ["hero", "about", "team", "stats"],
    services: ["hero", "features", "pricing", "cta"],
    portfolio: ["hero", "gallery", "testimonials"],
    contact: ["hero", "contact", "faq"],
  },
};

// =============================================================================
// Extraction
// =============================================================================

/**
 * Detects the industry from a natural language prompt.
 */
export function detectIndustry(prompt: string): { industry: string; preset: IndustryPreset } {
  const lower = prompt.toLowerCase();

  for (const [industry, preset] of Object.entries(INDUSTRY_PRESETS)) {
    if (preset.keywords.some((kw) => lower.includes(kw))) {
      return { industry, preset };
    }
  }

  return { industry: "general", preset: DEFAULT_PRESET };
}

/**
 * Extracts a business name from the prompt.
 */
export function extractBusinessName(prompt: string): string {
  // Look for quoted names
  const quoted = prompt.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];

  // Look for "called X" or "named X" patterns
  const named = prompt.match(/(?:called|named|for)\s+([A-Z][a-zA-Z\s]{1,30}?)(?:\s*[,.]|\s+(?:that|which|with|a\b|an?\b|the\b|is\b))/);
  if (named) return named[1].trim();

  // Look for capitalized multi-word phrases
  const caps = prompt.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (caps) return caps[1];

  return "My Theme";
}

/**
 * Extracts feature requirements from the prompt.
 */
export function extractFeatures(prompt: string): ProjectFeature[] {
  const lower = prompt.toLowerCase();
  const features: ProjectFeature[] = [];

  const featurePatterns: [string, string, string[]][] = [
    ["ecommerce", "E-Commerce / Shop", ["shop", "store", "ecommerce", "e-commerce", "products", "buy"]],
    ["blog", "Blog", ["blog", "articles", "posts", "news"]],
    ["multilingual", "Multi-language", ["multilingual", "multi-language", "translate", "languages"]],
    ["animations", "Animations", ["animation", "animate", "motion", "parallax"]],
    ["forms", "Contact Forms", ["form", "contact", "inquiry", "booking"]],
    ["gallery", "Image Gallery", ["gallery", "photos", "portfolio", "images"]],
    ["testimonials", "Testimonials", ["testimonial", "review", "feedback", "client"]],
    ["pricing", "Pricing Tables", ["pricing", "plans", "packages", "subscription"]],
    ["team", "Team Section", ["team", "staff", "employees", "people"]],
    ["faq", "FAQ Section", ["faq", "questions", "help"]],
  ];

  for (const [id, label, keywords] of featurePatterns) {
    const explicit = keywords.some((kw) => lower.includes(kw));
    if (explicit) {
      features.push({ id, label, explicit: true });
    }
  }

  return features;
}

/**
 * Generates a module technical name from a business name.
 */
export function toModuleName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `theme_${slug || "custom"}`;
}

// =============================================================================
// Scaffolding
// =============================================================================

/**
 * Generates a complete scaffolded project from a single natural language prompt.
 * Produces a theme definition with 5+ pages and brand identity.
 */
export function scaffoldProject(prompt: string): ScaffoldedProject {
  const { industry, preset } = detectIndustry(prompt);
  const businessName = extractBusinessName(prompt);
  const features = extractFeatures(prompt);
  const moduleName = toModuleName(businessName);

  // Build brand
  const brand: ExtractedBrand = {
    name: businessName,
    industry,
    primaryColor: preset.primaryColor,
    secondaryColor: preset.secondaryColor,
    accentColor: preset.accentColor,
    headingFont: preset.headingFont,
    bodyFont: preset.bodyFont,
    tone: preset.tone,
  };

  // Build pages (ensure 5+)
  const pageNames = [...preset.suggestedPages];

  // Add feature-driven pages
  if (features.some((f) => f.id === "blog") && !pageNames.includes("blog")) {
    pageNames.push("blog");
  }
  if (features.some((f) => f.id === "ecommerce") && !pageNames.includes("shop")) {
    pageNames.push("shop");
  }

  // Ensure at least 5 pages
  const extraPages = ["faq", "testimonials", "team"];
  for (const ep of extraPages) {
    if (pageNames.length >= 5) break;
    if (!pageNames.includes(ep)) pageNames.push(ep);
  }

  const pages: ScaffoldedPage[] = pageNames.map((slug) => ({
    slug,
    title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
    sections: preset.suggestedSections[slug] || ["hero", "features", "cta"],
    isHomepage: slug === "home",
    description: `${slug.charAt(0).toUpperCase() + slug.slice(1)} page for ${businessName}`,
  }));

  // Collect all unique section types
  const sectionTypes = [...new Set(pages.flatMap((p) => p.sections))];

  return {
    moduleName,
    displayName: `${businessName} Theme`,
    description: `A ${preset.tone.join(", ")} Odoo website theme for ${businessName}`,
    brand,
    pages,
    sectionTypes,
    odooVersion: "16.0",
    originalPrompt: prompt,
    features,
  };
}
