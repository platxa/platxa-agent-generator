/**
 * Odoo Marketplace Metadata Generator
 *
 * Produces marketplace-ready metadata: icon spec, screenshot specs,
 * HTML description, feature list, and category tags for Odoo App Store.
 */

// =============================================================================
// Types
// =============================================================================

/** Icon specification for the marketplace */
export interface IconSpec {
  /** Width in pixels (256) */
  width: 256;
  /** Height in pixels (256) */
  height: 256;
  /** Background color (hex) */
  backgroundColor: string;
  /** Foreground/accent color (hex) */
  foregroundColor: string;
  /** Text to render on icon (e.g. theme initials) */
  label: string;
  /** Output path relative to module */
  path: string;
}

/** Screenshot specification */
export interface ScreenshotSpec {
  /** Screenshot title/caption */
  title: string;
  /** Description of what the screenshot shows */
  description: string;
  /** Suggested viewport width */
  viewportWidth: number;
  /** Suggested viewport height */
  viewportHeight: number;
  /** Which page/section to capture */
  target: string;
  /** Output path relative to module */
  path: string;
}

/** Odoo marketplace category */
export type MarketplaceCategory =
  | "Theme"
  | "Website"
  | "eCommerce"
  | "Blog"
  | "Portal"
  | "Backend Theme";

/** Complete marketplace metadata */
export interface MarketplaceMetadata {
  /** Theme display name */
  displayName: string;
  /** Short summary (max 150 chars) */
  summary: string;
  /** Full HTML description for marketplace page */
  htmlDescription: string;
  /** Feature list */
  features: string[];
  /** Category tags */
  categories: MarketplaceCategory[];
  /** Keywords for search */
  keywords: string[];
  /** Icon specification */
  icon: IconSpec;
  /** Screenshot specifications (3+) */
  screenshots: ScreenshotSpec[];
  /** Supported Odoo versions */
  odooVersions: string[];
  /** Price tier suggestion */
  priceTier: "free" | "starter" | "professional" | "enterprise";
}

/** Input for metadata generation */
export interface MetadataInput {
  /** Theme technical name */
  themeName: string;
  /** Human-readable display name */
  displayName: string;
  /** Theme description */
  description?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Secondary brand color (hex) */
  secondaryColor?: string;
  /** Sections included in theme */
  sections?: string[];
  /** Target industry/niche */
  industry?: string;
  /** Odoo version (default "16.0") */
  odooVersion?: string;
  /** Whether theme includes eCommerce support */
  hasEcommerce?: boolean;
  /** Whether theme includes blog support */
  hasBlog?: boolean;
  /** Additional features to highlight */
  additionalFeatures?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SECTIONS = ["hero", "features", "about", "testimonials", "cta", "footer"];

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero Banner",
  features: "Features Grid",
  about: "About Section",
  testimonials: "Testimonials",
  cta: "Call to Action",
  footer: "Footer",
  pricing: "Pricing Table",
  team: "Team Members",
  gallery: "Image Gallery",
  contact: "Contact Form",
  faq: "FAQ Accordion",
  stats: "Statistics Counter",
  blog: "Blog Posts",
  portfolio: "Portfolio Showcase",
};

// =============================================================================
// Generators
// =============================================================================

/**
 * Generates the 256x256 icon specification.
 */
function generateIcon(input: MetadataInput): IconSpec {
  const initials = input.displayName
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return {
    width: 256,
    height: 256,
    backgroundColor: input.primaryColor || "#3B82F6",
    foregroundColor: input.secondaryColor || "#FFFFFF",
    label: initials || "TH",
    path: "static/description/icon.png",
  };
}

/**
 * Generates screenshot specifications (minimum 3).
 */
function generateScreenshots(input: MetadataInput): ScreenshotSpec[] {
  const sections = input.sections || DEFAULT_SECTIONS;
  const screenshots: ScreenshotSpec[] = [];

  // Desktop full page
  screenshots.push({
    title: "Desktop Full Page",
    description: `Full page view of ${input.displayName} on desktop`,
    viewportWidth: 1920,
    viewportHeight: 1080,
    target: "full-page",
    path: "static/description/screenshot_desktop.png",
  });

  // Mobile view
  screenshots.push({
    title: "Mobile Responsive",
    description: `Mobile responsive layout of ${input.displayName}`,
    viewportWidth: 375,
    viewportHeight: 812,
    target: "full-page-mobile",
    path: "static/description/screenshot_mobile.png",
  });

  // Hero section detail
  screenshots.push({
    title: "Hero Section",
    description: `Hero banner section with call-to-action`,
    viewportWidth: 1920,
    viewportHeight: 900,
    target: "hero",
    path: "static/description/screenshot_hero.png",
  });

  // Additional section screenshots
  const extraSections = sections.filter((s) => s !== "hero").slice(0, 3);
  for (const section of extraSections) {
    const label = SECTION_LABELS[section] || section;
    screenshots.push({
      title: label,
      description: `${label} section of ${input.displayName}`,
      viewportWidth: 1920,
      viewportHeight: 900,
      target: section,
      path: `static/description/screenshot_${section}.png`,
    });
  }

  return screenshots;
}

/**
 * Generates feature list from theme capabilities.
 */
function generateFeatures(input: MetadataInput): string[] {
  const features: string[] = [];
  const sections = input.sections || DEFAULT_SECTIONS;

  features.push("Fully responsive design for desktop, tablet, and mobile");
  features.push("WCAG 2.1 AA accessibility compliant");
  features.push("Odoo 16 Website Builder compatible");
  features.push("Clean, semantic HTML5 structure");
  features.push("Customizable color palette via Odoo color picker");

  // Section-based features
  const sectionCount = sections.length;
  features.push(`${sectionCount} pre-designed page sections`);

  for (const section of sections.slice(0, 4)) {
    const label = SECTION_LABELS[section];
    if (label) features.push(`${label} section included`);
  }

  if (input.hasEcommerce) {
    features.push("eCommerce shop integration");
    features.push("Product page styling");
  }

  if (input.hasBlog) {
    features.push("Blog layout and post styling");
  }

  if (input.additionalFeatures) {
    features.push(...input.additionalFeatures);
  }

  return features;
}

/**
 * Determines marketplace categories from input.
 */
function generateCategories(input: MetadataInput): MarketplaceCategory[] {
  const cats: MarketplaceCategory[] = ["Theme", "Website"];
  if (input.hasEcommerce) cats.push("eCommerce");
  if (input.hasBlog) cats.push("Blog");
  return cats;
}

/**
 * Generates search keywords.
 */
function generateKeywords(input: MetadataInput): string[] {
  const kw = new Set<string>([
    "odoo theme",
    "website theme",
    "responsive",
    "modern",
    input.displayName.toLowerCase(),
  ]);

  if (input.industry) {
    kw.add(input.industry.toLowerCase());
    kw.add(`${input.industry.toLowerCase()} website`);
  }

  if (input.hasEcommerce) {
    kw.add("ecommerce");
    kw.add("shop");
  }

  if (input.hasBlog) {
    kw.add("blog");
  }

  return [...kw];
}

/**
 * Generates the HTML description for the marketplace page.
 */
function generateHtmlDescription(input: MetadataInput, features: string[]): string {
  const sections = input.sections || DEFAULT_SECTIONS;
  const desc = input.description || `A modern, responsive Odoo theme for ${input.industry || "business"} websites.`;

  const featureItems = features
    .map((f) => `    <li>${escapeHtml(f)}</li>`)
    .join("\n");

  const sectionItems = sections
    .map((s) => {
      const label = SECTION_LABELS[s] || s;
      return `    <li>${escapeHtml(label)}</li>`;
    })
    .join("\n");

  return `<section class="oe_container">
  <div class="oe_row oe_spaced">
    <h2 class="oe_slogan">${escapeHtml(input.displayName)}</h2>
    <h3 class="oe_slogan">${escapeHtml(desc)}</h3>
  </div>
</section>

<section class="oe_container">
  <div class="oe_row oe_spaced">
    <h3>Key Features</h3>
    <ul>
${featureItems}
    </ul>
  </div>
</section>

<section class="oe_container">
  <div class="oe_row oe_spaced">
    <h3>Included Sections</h3>
    <ul>
${sectionItems}
    </ul>
  </div>
</section>

<section class="oe_container">
  <div class="oe_row oe_spaced">
    <h3>Compatibility</h3>
    <p>Compatible with Odoo ${input.odooVersion || "16.0"} Community and Enterprise editions.</p>
    <p>Works seamlessly with the Odoo Website Builder — no coding required.</p>
  </div>
</section>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates a short summary (max 150 chars).
 */
function generateSummary(input: MetadataInput): string {
  const base = input.description
    || `Modern, responsive ${input.industry || "business"} theme for Odoo websites`;
  return base.length <= 150 ? base : base.substring(0, 147) + "...";
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Generates complete Odoo marketplace metadata including icon spec,
 * screenshots, HTML description, feature list, and category tags.
 */
export function generateMarketplaceMetadata(input: MetadataInput): MarketplaceMetadata {
  const features = generateFeatures(input);
  const summary = generateSummary(input);

  return {
    displayName: input.displayName,
    summary,
    htmlDescription: generateHtmlDescription(input, features),
    features,
    categories: generateCategories(input),
    keywords: generateKeywords(input),
    icon: generateIcon(input),
    screenshots: generateScreenshots(input),
    odooVersions: [input.odooVersion || "16.0"],
    priceTier: input.hasEcommerce ? "professional" : "starter",
  };
}
