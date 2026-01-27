/**
 * Project Templates System
 *
 * Provides industry-specific starter templates for quick project setup.
 * Each template includes pre-configured pages, snippets, and styling.
 */

import {
  INDUSTRY_PRESETS,
  SNIPPET_LIBRARY,
  type Industry,
  type ThemeConfig,
  type PageConfig,
  type SnippetConfig,
  type ColorPalette,
  type Typography,
} from "../odoo-skills";

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectTemplate {
  /** Template ID */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Industry category */
  industry: Industry;
  /** Template thumbnail URL */
  thumbnail: string;
  /** Preview images */
  previews: string[];
  /** Included pages */
  pages: TemplatePageConfig[];
  /** Pre-selected snippets */
  snippets: string[];
  /** Feature flags */
  features: TemplateFeatures;
  /** Default color palette */
  colors: ColorPalette;
  /** Typography configuration */
  typography: Typography;
  /** Tags for filtering */
  tags: string[];
  /** Popularity score (for sorting) */
  popularity: number;
  /** Is premium template */
  premium: boolean;
}

export interface TemplatePageConfig {
  /** Page ID */
  id: string;
  /** Page name */
  name: string;
  /** Page title */
  title: string;
  /** URL path */
  url: string;
  /** Sections on this page */
  sections: TemplateSectionConfig[];
}

export interface TemplateSectionConfig {
  /** Snippet ID to use */
  snippetId: string;
  /** Section title override */
  title?: string;
  /** Color class (1-5) */
  colorClass: number;
  /** Custom options */
  options?: Record<string, unknown>;
}

export interface TemplateFeatures {
  /** Has sticky header */
  stickyHeader: boolean;
  /** Has promo bar */
  promoBar: boolean;
  /** Has mega menu */
  megaMenu: boolean;
  /** Supports dark mode */
  darkMode: boolean;
  /** Has animations */
  animations: boolean;
  /** Has contact form */
  contactForm: boolean;
  /** Has newsletter signup */
  newsletter: boolean;
  /** Has social links */
  socialLinks: boolean;
  /** Has blog section */
  blog: boolean;
  /** Has e-commerce */
  ecommerce: boolean;
}

export interface TemplateCategory {
  /** Category ID */
  id: string;
  /** Display name */
  name: string;
  /** Display label (alias for name) */
  label: string;
  /** Description */
  description: string;
  /** Icon name */
  icon: string;
  /** Template IDs in this category */
  templates: string[];
}

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  // -------------------------------------------------------------------------
  // RESTAURANT TEMPLATES
  // -------------------------------------------------------------------------
  restaurant_modern: {
    id: "restaurant_modern",
    name: "Modern Restaurant",
    description: "Sleek design for upscale dining establishments with online reservations",
    industry: "restaurant",
    thumbnail: "/templates/restaurant-modern-thumb.svg",
    previews: ["/templates/restaurant-modern-1.svg", "/templates/restaurant-modern-2.svg"],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Fine Dining Experience" },
          { snippetId: "s_features_grid", colorClass: 2, title: "Our Specialties" },
          { snippetId: "s_image_text", colorClass: 1 },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_cta_box", colorClass: 1, title: "Make a Reservation" },
        ],
      },
      {
        id: "menu",
        name: "Menu",
        title: "Our Menu",
        url: "/menu",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Culinary Delights" },
          { snippetId: "s_tabs", colorClass: 2 },
        ],
      },
      {
        id: "about",
        name: "About",
        title: "Our Story",
        url: "/about",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_image_text", colorClass: 2 },
          { snippetId: "s_team", colorClass: 1 },
        ],
      },
      {
        id: "contact",
        name: "Contact",
        title: "Contact Us",
        url: "/contact",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_contact_form", colorClass: 2 },
          { snippetId: "s_google_map", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_image_text", "s_testimonials", "s_cta_box", "s_team", "s_contact_form"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: false,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: false,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.restaurant.colors,
    typography: INDUSTRY_PRESETS.restaurant.typography,
    tags: ["restaurant", "food", "dining", "reservations", "upscale"],
    popularity: 95,
    premium: false,
  },

  restaurant_casual: {
    id: "restaurant_casual",
    name: "Casual Eatery",
    description: "Friendly and inviting design for casual dining and cafes",
    industry: "restaurant",
    thumbnail: "/templates/restaurant-casual-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_three_columns", colorClass: 2 },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_cta_box", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_three_columns", "s_testimonials", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: true,
      megaMenu: false,
      darkMode: false,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: false,
      ecommerce: false,
    },
    colors: { ...INDUSTRY_PRESETS.restaurant.colors, primary: "#e67e22" },
    typography: INDUSTRY_PRESETS.restaurant.typography,
    tags: ["restaurant", "cafe", "casual", "friendly"],
    popularity: 82,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // TECHNOLOGY TEMPLATES
  // -------------------------------------------------------------------------
  tech_saas: {
    id: "tech_saas",
    name: "SaaS Platform",
    description: "Professional SaaS landing page with pricing and features showcase",
    industry: "technology",
    thumbnail: "/templates/tech-saas-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Transform Your Business" },
          { snippetId: "s_features_grid", colorClass: 2, title: "Powerful Features" },
          { snippetId: "s_numbers", colorClass: 1 },
          { snippetId: "s_pricing", colorClass: 2 },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_faq", colorClass: 2 },
          { snippetId: "s_cta_box", colorClass: 1 },
        ],
      },
      {
        id: "features",
        name: "Features",
        title: "Features",
        url: "/features",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_features_grid", colorClass: 2 },
          { snippetId: "s_image_text", colorClass: 1 },
        ],
      },
      {
        id: "pricing",
        name: "Pricing",
        title: "Pricing",
        url: "/pricing",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_pricing", colorClass: 2 },
          { snippetId: "s_faq", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_numbers", "s_pricing", "s_testimonials", "s_faq", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: true,
      megaMenu: true,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: true,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.technology.colors,
    typography: INDUSTRY_PRESETS.technology.typography,
    tags: ["saas", "technology", "software", "startup", "pricing"],
    popularity: 98,
    premium: false,
  },

  tech_startup: {
    id: "tech_startup",
    name: "Tech Startup",
    description: "Bold and innovative design for tech startups and apps",
    industry: "technology",
    thumbnail: "/templates/tech-startup-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_features_grid", colorClass: 2 },
          { snippetId: "s_image_text", colorClass: 1 },
          { snippetId: "s_cta_box", colorClass: 3 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_image_text", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: false,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: false,
      ecommerce: false,
    },
    colors: { ...INDUSTRY_PRESETS.technology.colors, primary: "#7c3aed" },
    typography: INDUSTRY_PRESETS.technology.typography,
    tags: ["startup", "technology", "app", "innovation"],
    popularity: 90,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // LEGAL TEMPLATES
  // -------------------------------------------------------------------------
  legal_firm: {
    id: "legal_firm",
    name: "Law Firm",
    description: "Professional and trustworthy design for legal practices",
    industry: "legal",
    thumbnail: "/templates/legal-firm-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Justice & Excellence" },
          { snippetId: "s_features_grid", colorClass: 2, title: "Practice Areas" },
          { snippetId: "s_team", colorClass: 1, title: "Our Attorneys" },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_cta_box", colorClass: 1 },
        ],
      },
      {
        id: "practice-areas",
        name: "Practice Areas",
        title: "Practice Areas",
        url: "/practice-areas",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_features_grid", colorClass: 2 },
        ],
      },
      {
        id: "attorneys",
        name: "Attorneys",
        title: "Our Team",
        url: "/attorneys",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_team", colorClass: 2 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_team", "s_testimonials", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: true,
      darkMode: false,
      animations: false,
      contactForm: true,
      newsletter: false,
      socialLinks: true,
      blog: true,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.legal.colors,
    typography: INDUSTRY_PRESETS.legal.typography,
    tags: ["legal", "law", "attorney", "professional", "corporate"],
    popularity: 85,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // HEALTHCARE TEMPLATES
  // -------------------------------------------------------------------------
  healthcare_clinic: {
    id: "healthcare_clinic",
    name: "Medical Clinic",
    description: "Clean and caring design for healthcare providers",
    industry: "healthcare",
    thumbnail: "/templates/healthcare-clinic-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Your Health, Our Priority" },
          { snippetId: "s_features_grid", colorClass: 2, title: "Our Services" },
          { snippetId: "s_team", colorClass: 1, title: "Our Doctors" },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_cta_box", colorClass: 1, title: "Book Appointment" },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_team", "s_testimonials", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: false,
      darkMode: false,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: true,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.healthcare.colors,
    typography: INDUSTRY_PRESETS.healthcare.typography,
    tags: ["healthcare", "medical", "clinic", "doctor", "health"],
    popularity: 88,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // ECOMMERCE TEMPLATES
  // -------------------------------------------------------------------------
  ecommerce_fashion: {
    id: "ecommerce_fashion",
    name: "Fashion Store",
    description: "Stylish e-commerce design for fashion and apparel brands",
    industry: "ecommerce",
    thumbnail: "/templates/ecommerce-fashion-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "New Collection" },
          { snippetId: "s_three_columns", colorClass: 2, title: "Shop by Category" },
          { snippetId: "s_products", colorClass: 1, title: "Featured Products" },
          { snippetId: "s_image_text", colorClass: 2 },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_newsletter", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_three_columns", "s_products", "s_image_text", "s_testimonials", "s_newsletter"],
    features: {
      stickyHeader: true,
      promoBar: true,
      megaMenu: true,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: true,
      ecommerce: true,
    },
    colors: INDUSTRY_PRESETS.ecommerce.colors,
    typography: INDUSTRY_PRESETS.ecommerce.typography,
    tags: ["ecommerce", "fashion", "clothing", "store", "shop"],
    popularity: 92,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // EDUCATION TEMPLATES
  // -------------------------------------------------------------------------
  education_school: {
    id: "education_school",
    name: "Educational Institution",
    description: "Informative design for schools, colleges, and universities",
    industry: "education",
    thumbnail: "/templates/education-school-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Shaping Future Leaders" },
          { snippetId: "s_features_grid", colorClass: 2, title: "Our Programs" },
          { snippetId: "s_numbers", colorClass: 1 },
          { snippetId: "s_team", colorClass: 2, title: "Our Faculty" },
          { snippetId: "s_cta_box", colorClass: 1, title: "Apply Now" },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_numbers", "s_team", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: true,
      megaMenu: true,
      darkMode: false,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: true,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.education.colors,
    typography: INDUSTRY_PRESETS.education.typography,
    tags: ["education", "school", "university", "college", "learning"],
    popularity: 80,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // CREATIVE TEMPLATES
  // -------------------------------------------------------------------------
  creative_portfolio: {
    id: "creative_portfolio",
    name: "Creative Portfolio",
    description: "Stunning portfolio design for artists, designers, and creatives",
    industry: "creative",
    thumbnail: "/templates/creative-portfolio-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Portfolio",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_masonry", colorClass: 2, title: "My Work" },
          { snippetId: "s_image_text", colorClass: 1, title: "About Me" },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_contact_form", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_masonry", "s_image_text", "s_testimonials", "s_contact_form"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: false,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: false,
      socialLinks: true,
      blog: false,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.creative.colors,
    typography: INDUSTRY_PRESETS.creative.typography,
    tags: ["portfolio", "creative", "designer", "artist", "photography"],
    popularity: 87,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // NONPROFIT TEMPLATES
  // -------------------------------------------------------------------------
  nonprofit_charity: {
    id: "nonprofit_charity",
    name: "Charity Organization",
    description: "Impactful design for nonprofits and charitable organizations",
    industry: "nonprofit",
    thumbnail: "/templates/nonprofit-charity-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1, title: "Make a Difference" },
          { snippetId: "s_numbers", colorClass: 2, title: "Our Impact" },
          { snippetId: "s_features_grid", colorClass: 1, title: "Our Programs" },
          { snippetId: "s_testimonials", colorClass: 3 },
          { snippetId: "s_cta_box", colorClass: 1, title: "Donate Now" },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_numbers", "s_features_grid", "s_testimonials", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: true,
      megaMenu: false,
      darkMode: false,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: true,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.nonprofit.colors,
    typography: INDUSTRY_PRESETS.nonprofit.typography,
    tags: ["nonprofit", "charity", "donation", "cause", "organization"],
    popularity: 78,
    premium: false,
  },

  // -------------------------------------------------------------------------
  // GENERIC / MINIMAL TEMPLATES
  // -------------------------------------------------------------------------
  minimal_starter: {
    id: "minimal_starter",
    name: "Minimal Starter",
    description: "Clean and minimal starting point for any type of website",
    industry: "generic",
    thumbnail: "/templates/minimal-starter-thumb.svg",
    previews: [],
    pages: [
      {
        id: "home",
        name: "Home",
        title: "Welcome",
        url: "/",
        sections: [
          { snippetId: "s_hero_centered", colorClass: 1 },
          { snippetId: "s_features_grid", colorClass: 2 },
          { snippetId: "s_cta_box", colorClass: 1 },
        ],
      },
    ],
    snippets: ["s_hero_centered", "s_features_grid", "s_cta_box"],
    features: {
      stickyHeader: true,
      promoBar: false,
      megaMenu: false,
      darkMode: true,
      animations: true,
      contactForm: true,
      newsletter: true,
      socialLinks: true,
      blog: false,
      ecommerce: false,
    },
    colors: INDUSTRY_PRESETS.generic.colors,
    typography: INDUSTRY_PRESETS.generic.typography,
    tags: ["minimal", "starter", "simple", "clean", "basic"],
    popularity: 75,
    premium: false,
  },
};

// =============================================================================
// TEMPLATE CATEGORIES
// =============================================================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "all",
    name: "All Templates",
    label: "All Templates",
    description: "Browse all available templates",
    icon: "grid",
    templates: Object.keys(PROJECT_TEMPLATES),
  },
  {
    id: "restaurant",
    name: "Restaurant & Food",
    label: "Restaurant & Food",
    description: "Templates for restaurants, cafes, and food businesses",
    icon: "utensils",
    templates: ["restaurant_modern", "restaurant_casual"],
  },
  {
    id: "technology",
    name: "Technology & SaaS",
    label: "Technology & SaaS",
    description: "Templates for tech companies and software products",
    icon: "laptop",
    templates: ["tech_saas", "tech_startup"],
  },
  {
    id: "professional",
    name: "Professional Services",
    label: "Professional Services",
    description: "Templates for law firms, healthcare, and consultants",
    icon: "briefcase",
    templates: ["legal_firm", "healthcare_clinic"],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    label: "E-commerce",
    description: "Templates for online stores and retail",
    icon: "shopping-cart",
    templates: ["ecommerce_fashion"],
  },
  {
    id: "creative",
    name: "Creative & Portfolio",
    label: "Creative & Portfolio",
    description: "Templates for artists, designers, and creatives",
    icon: "palette",
    templates: ["creative_portfolio"],
  },
  {
    id: "nonprofit",
    name: "Nonprofit & Education",
    label: "Nonprofit & Education",
    description: "Templates for charities, schools, and organizations",
    icon: "heart",
    templates: ["nonprofit_charity", "education_school"],
  },
];

// =============================================================================
// TEMPLATE FUNCTIONS
// =============================================================================

/**
 * Get all templates (with category field added)
 */
export function getAllTemplates(): (ProjectTemplate & { category: string })[] {
  return Object.values(PROJECT_TEMPLATES)
    .map((template) => ({
      ...template,
      category: template.industry,
    }))
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES[id];
}

/**
 * Get templates by industry
 */
export function getTemplatesByIndustry(industry: Industry): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES)
    .filter((t) => t.industry === industry)
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(categoryId: string): (ProjectTemplate & { category: string })[] {
  const category = TEMPLATE_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];

  return category.templates
    .map((id) => PROJECT_TEMPLATES[id])
    .filter(Boolean)
    .map((template) => ({ ...template, category: categoryId }))
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * Search templates by query
 */
export function searchTemplates(query: string): ProjectTemplate[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(PROJECT_TEMPLATES)
    .filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * Get featured templates
 */
export function getFeaturedTemplates(limit: number = 6): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

/**
 * Convert template to ThemeConfig for generation
 */
export function templateToThemeConfig(
  template: ProjectTemplate,
  themeName: string
): Partial<ThemeConfig> {
  return {
    name: themeName,
    displayName: template.name,
    description: template.description,
    industry: template.industry,
    colors: template.colors,
    typography: template.typography,
    features: {
      stickyHeader: template.features.stickyHeader,
      promoBar: template.features.promoBar,
      megaMenu: template.features.megaMenu,
      darkMode: template.features.darkMode,
      animations: template.features.animations,
      lazyLoading: true,
      smoothScroll: true,
      backToTop: true,
      cookieConsent: true,
      socialLinks: template.features.socialLinks,
    },
    pages: template.pages.map((page) => ({
      id: page.id,
      name: page.name,
      title: page.title,
      url: page.url,
      template: "website.layout",
      sections: page.sections.map((section) => ({
        id: `${page.id}_${section.snippetId}`,
        type: "snippet",
        snippetId: section.snippetId,
        colorClass: section.colorClass,
        options: section.options || {},
      })),
      meta: {
        title: page.title,
        description: template.description,
        keywords: template.tags,
      },
    })),
  };
}

/**
 * Get template statistics
 */
export function getTemplateStats(): {
  total: number;
  byIndustry: Record<Industry, number>;
  premium: number;
  free: number;
} {
  const templates = Object.values(PROJECT_TEMPLATES);
  const byIndustry: Record<string, number> = {};

  templates.forEach((t) => {
    byIndustry[t.industry] = (byIndustry[t.industry] || 0) + 1;
  });

  return {
    total: templates.length,
    byIndustry: byIndustry as Record<Industry, number>,
    premium: templates.filter((t) => t.premium).length,
    free: templates.filter((t) => !t.premium).length,
  };
}
