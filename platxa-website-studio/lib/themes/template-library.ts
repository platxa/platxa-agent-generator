/**
 * Template Library - Pre-built Industry Theme Templates
 *
 * Provides 15+ industry-specific theme templates that users can customize.
 * Each template includes:
 * - Industry-appropriate color schemes
 * - Curated typography pairings
 * - Recommended page sections
 * - Customization options
 * - Odoo-compatible structure
 *
 * Feature #12: Create pre-built theme template library (10+ industries)
 */

import type { ColorScheme, Typography, Spacing, LayoutOptions } from "./theme-registry";

// =============================================================================
// Types
// =============================================================================

/** Industry categories */
export type IndustryCategory =
  | "restaurant"
  | "technology"
  | "healthcare"
  | "legal"
  | "ecommerce"
  | "education"
  | "realestate"
  | "fitness"
  | "creative"
  | "nonprofit"
  | "finance"
  | "travel"
  | "beauty"
  | "automotive"
  | "construction";

/** Page section types */
export type SectionType =
  | "hero"
  | "features"
  | "about"
  | "services"
  | "portfolio"
  | "testimonials"
  | "team"
  | "pricing"
  | "faq"
  | "contact"
  | "cta"
  | "blog"
  | "gallery"
  | "stats"
  | "clients"
  | "menu"
  | "products"
  | "appointments"
  | "locations"
  | "events";

/** Section configuration */
export interface SectionConfig {
  type: SectionType;
  title: string;
  description: string;
  required: boolean;
  variants: string[];
}

/** Customization option */
export interface CustomizationOption {
  id: string;
  label: string;
  type: "color" | "font" | "layout" | "toggle" | "select";
  default: string | boolean;
  options?: string[];
}

/** Industry template definition */
export interface IndustryTemplate {
  /** Unique template ID */
  id: string;
  /** Template name */
  name: string;
  /** Target industry */
  industry: IndustryCategory;
  /** Template description */
  description: string;
  /** Industry-specific tagline */
  tagline: string;
  /** Keywords for search */
  keywords: string[];
  /** Preview image path */
  previewImage: string;
  /** Color scheme */
  colors: ColorScheme;
  /** Typography settings */
  typography: Typography;
  /** Spacing settings */
  spacing: Spacing;
  /** Layout options */
  layout: LayoutOptions;
  /** Recommended page sections */
  sections: SectionConfig[];
  /** Customization options */
  customizations: CustomizationOption[];
  /** Industry-specific features */
  features: string[];
  /** Sample content hints */
  contentHints: Record<string, string>;
  /** Odoo version compatibility */
  odooVersion: string;
  /** Is premium template */
  isPremium: boolean;
}

/** Template filter options */
export interface TemplateFilterOptions {
  industry?: IndustryCategory;
  keywords?: string[];
  includePremium?: boolean;
  search?: string;
}

/** Template customization result */
export interface CustomizedTemplate {
  templateId: string;
  customizations: Record<string, string | boolean>;
  generatedAt: Date;
}

// =============================================================================
// Industry Templates (15+ industries)
// =============================================================================

const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  // 1. Restaurant & Cafe
  {
    id: "restaurant-warmth",
    name: "Restaurant Warmth",
    industry: "restaurant",
    description: "Warm, inviting theme for restaurants and cafes with menu showcases and reservation features.",
    tagline: "Taste the experience",
    keywords: ["restaurant", "cafe", "food", "menu", "dining", "reservation"],
    previewImage: "/templates/restaurant-warmth/preview.png",
    colors: {
      primary: "#c9302c",
      secondary: "#8b4513",
      background: "#fefae0",
      surface: "#ffffff",
      text: "#1a1a1a",
      textMuted: "#57534e",
      border: "#e7e5e4",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Playfair Display, serif",
      bodyFont: "Lora, serif",
      baseFontSize: "17px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1180px",
      gap: "28px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 3,
    },
    sections: [
      { type: "hero", title: "Hero Banner", description: "Welcome message with featured dish", required: true, variants: ["fullscreen", "split", "video"] },
      { type: "menu", title: "Menu", description: "Food and drink menu display", required: true, variants: ["grid", "list", "tabs"] },
      { type: "about", title: "Our Story", description: "Restaurant history and philosophy", required: true, variants: ["timeline", "simple", "gallery"] },
      { type: "gallery", title: "Gallery", description: "Food and ambiance photos", required: false, variants: ["masonry", "carousel", "grid"] },
      { type: "testimonials", title: "Reviews", description: "Customer testimonials", required: false, variants: ["cards", "slider", "quotes"] },
      { type: "locations", title: "Visit Us", description: "Location and hours", required: true, variants: ["map", "cards", "simple"] },
      { type: "contact", title: "Reservations", description: "Booking form", required: true, variants: ["form", "widget", "phone"] },
    ],
    customizations: [
      { id: "menuStyle", label: "Menu Display Style", type: "select", default: "grid", options: ["grid", "list", "tabs"] },
      { id: "showPrices", label: "Show Prices", type: "toggle", default: true },
      { id: "reservationWidget", label: "Online Reservations", type: "toggle", default: true },
      { id: "accentColor", label: "Accent Color", type: "color", default: "#d4a373" },
    ],
    features: ["Online reservations", "Menu management", "Photo gallery", "Customer reviews", "Location map", "Social integration"],
    contentHints: {
      heroTitle: "Welcome to [Restaurant Name]",
      heroSubtitle: "Authentic cuisine made with love",
      aboutTitle: "Our Story",
      menuCategories: "Appetizers, Main Courses, Desserts, Drinks",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 2. Technology & SaaS
  {
    id: "tech-startup",
    name: "Tech Startup",
    industry: "technology",
    description: "Modern, conversion-focused theme for tech startups and SaaS products.",
    tagline: "Innovation meets design",
    keywords: ["technology", "saas", "startup", "software", "app", "digital"],
    previewImage: "/templates/tech-startup/preview.png",
    colors: {
      primary: "#6366f1",
      secondary: "#a855f7",
      background: "#020617",
      surface: "#0f172a",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      border: "#1e293b",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
    },
    typography: {
      headingFont: "Inter, sans-serif",
      bodyFont: "Inter, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "96px",
      containerWidth: "1200px",
      gap: "28px",
      borderRadius: "16px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Product showcase with CTA", required: true, variants: ["centered", "split", "video"] },
      { type: "features", title: "Features", description: "Product features grid", required: true, variants: ["icons", "cards", "alternating"] },
      { type: "stats", title: "Metrics", description: "Key statistics and numbers", required: false, variants: ["counters", "cards", "inline"] },
      { type: "pricing", title: "Pricing", description: "Pricing plans comparison", required: true, variants: ["cards", "table", "toggle"] },
      { type: "testimonials", title: "Testimonials", description: "Customer success stories", required: false, variants: ["quotes", "cards", "video"] },
      { type: "faq", title: "FAQ", description: "Frequently asked questions", required: false, variants: ["accordion", "grid", "tabs"] },
      { type: "cta", title: "Get Started", description: "Final call to action", required: true, variants: ["centered", "split", "gradient"] },
      { type: "contact", title: "Contact Sales", description: "Sales inquiry form", required: true, variants: ["form", "demo", "chat"] },
    ],
    customizations: [
      { id: "darkMode", label: "Dark Mode Default", type: "toggle", default: true },
      { id: "gradientHero", label: "Gradient Hero Background", type: "toggle", default: true },
      { id: "pricingToggle", label: "Monthly/Annual Toggle", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Brand Color", type: "color", default: "#6366f1" },
    ],
    features: ["Dark mode", "Pricing tables", "Feature comparisons", "Demo booking", "Blog integration", "Newsletter signup"],
    contentHints: {
      heroTitle: "Build [Product Type] 10x faster",
      heroSubtitle: "The modern platform for [target audience]",
      ctaButton: "Start Free Trial",
      pricingPlans: "Starter, Professional, Enterprise",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 3. Healthcare & Medical
  {
    id: "healthcare-trust",
    name: "Healthcare Trust",
    industry: "healthcare",
    description: "Calming, professional theme for healthcare providers and medical practices.",
    tagline: "Your health, our priority",
    keywords: ["healthcare", "medical", "doctor", "clinic", "hospital", "wellness"],
    previewImage: "/templates/healthcare-trust/preview.png",
    colors: {
      primary: "#0d9488",
      secondary: "#0284c7",
      background: "#f0fdfa",
      surface: "#ffffff",
      text: "#134e4a",
      textMuted: "#5eead4",
      border: "#99f6e4",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Nunito, sans-serif",
      bodyFont: "Open Sans, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "72px",
      containerWidth: "1200px",
      gap: "24px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Welcome", description: "Welcoming message with appointment CTA", required: true, variants: ["image", "video", "slider"] },
      { type: "services", title: "Services", description: "Medical services offered", required: true, variants: ["cards", "icons", "list"] },
      { type: "team", title: "Our Doctors", description: "Medical team profiles", required: true, variants: ["grid", "carousel", "detailed"] },
      { type: "appointments", title: "Book Appointment", description: "Online booking system", required: true, variants: ["form", "calendar", "widget"] },
      { type: "testimonials", title: "Patient Stories", description: "Patient testimonials", required: false, variants: ["cards", "video", "quotes"] },
      { type: "locations", title: "Locations", description: "Clinic locations and hours", required: true, variants: ["map", "list", "tabs"] },
      { type: "faq", title: "FAQ", description: "Common questions", required: false, variants: ["accordion", "categories", "search"] },
      { type: "contact", title: "Contact Us", description: "General inquiries and feedback", required: true, variants: ["form", "info", "map"] },
    ],
    customizations: [
      { id: "appointmentSystem", label: "Online Appointments", type: "toggle", default: true },
      { id: "emergencyBanner", label: "Emergency Contact Banner", type: "toggle", default: true },
      { id: "insuranceLogos", label: "Show Insurance Partners", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#0d9488" },
    ],
    features: ["Online appointments", "Doctor profiles", "Service listings", "Insurance info", "Patient portal link", "Emergency contact"],
    contentHints: {
      heroTitle: "Compassionate Care for Your Family",
      heroSubtitle: "Experienced healthcare professionals you can trust",
      servicesTitle: "Our Services",
      appointmentCta: "Book Your Appointment",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 4. Law & Legal Services
  {
    id: "legal-authority",
    name: "Legal Authority",
    industry: "legal",
    description: "Professional, trustworthy theme for law firms and legal services.",
    tagline: "Justice served with excellence",
    keywords: ["law", "legal", "attorney", "lawyer", "firm", "justice"],
    previewImage: "/templates/legal-authority/preview.png",
    colors: {
      primary: "#1e3a5f",
      secondary: "#c9a227",
      background: "#f7f7f7",
      surface: "#ffffff",
      text: "#1a1a1a",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#15803d",
      warning: "#ca8a04",
      error: "#b91c1c",
    },
    typography: {
      headingFont: "Merriweather, serif",
      bodyFont: "Source Sans Pro, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1140px",
      gap: "24px",
      borderRadius: "4px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Firm introduction with consultation CTA", required: true, variants: ["classic", "image", "video"] },
      { type: "services", title: "Practice Areas", description: "Legal practice areas", required: true, variants: ["icons", "cards", "detailed"] },
      { type: "team", title: "Our Attorneys", description: "Attorney profiles", required: true, variants: ["grid", "list", "featured"] },
      { type: "testimonials", title: "Client Success", description: "Case results and testimonials", required: false, variants: ["cases", "quotes", "stats"] },
      { type: "about", title: "About Our Firm", description: "Firm history and values", required: true, variants: ["timeline", "story", "values"] },
      { type: "blog", title: "Legal Insights", description: "Legal blog articles", required: false, variants: ["grid", "list", "featured"] },
      { type: "contact", title: "Consultation", description: "Free consultation form", required: true, variants: ["form", "sidebar", "fullwidth"] },
    ],
    customizations: [
      { id: "consultationForm", label: "Free Consultation Form", type: "toggle", default: true },
      { id: "caseResults", label: "Show Case Results", type: "toggle", default: true },
      { id: "goldAccent", label: "Gold Accent Color", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#1e3a5f" },
    ],
    features: ["Attorney profiles", "Practice areas", "Case results", "Legal blog", "Free consultation", "Client portal"],
    contentHints: {
      heroTitle: "Trusted Legal Representation",
      heroSubtitle: "Over [X] years of experience protecting your rights",
      practiceAreas: "Personal Injury, Family Law, Criminal Defense, Business Law",
      consultationCta: "Free Consultation",
    },
    odooVersion: "18.0",
    isPremium: true,
  },

  // 5. E-commerce & Retail
  {
    id: "ecommerce-modern",
    name: "E-commerce Modern",
    industry: "ecommerce",
    description: "Conversion-optimized theme for online stores with product showcases.",
    tagline: "Shop the future",
    keywords: ["ecommerce", "shop", "store", "products", "retail", "online"],
    previewImage: "/templates/ecommerce-modern/preview.png",
    colors: {
      primary: "#7c3aed",
      secondary: "#ec4899",
      background: "#faf5ff",
      surface: "#ffffff",
      text: "#1f2937",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Poppins, sans-serif",
      bodyFont: "Poppins, sans-serif",
      baseFontSize: "15px",
      lineHeight: "1.6",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "64px",
      containerWidth: "1320px",
      gap: "20px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
      sidebarPosition: "left",
    },
    sections: [
      { type: "hero", title: "Hero Banner", description: "Featured products or sale", required: true, variants: ["slider", "split", "fullwidth"] },
      { type: "products", title: "Featured Products", description: "Product showcase grid", required: true, variants: ["grid", "carousel", "masonry"] },
      { type: "features", title: "Why Choose Us", description: "Store benefits", required: false, variants: ["icons", "cards", "inline"] },
      { type: "testimonials", title: "Reviews", description: "Customer reviews", required: false, variants: ["cards", "slider", "wall"] },
      { type: "blog", title: "Style Guide", description: "Fashion/product blog", required: false, variants: ["grid", "magazine", "list"] },
      { type: "cta", title: "Newsletter", description: "Email signup", required: true, variants: ["popup", "inline", "footer"] },
      { type: "contact", title: "Customer Support", description: "Contact and support form", required: true, variants: ["form", "chat", "faq"] },
    ],
    customizations: [
      { id: "productGrid", label: "Products Per Row", type: "select", default: "4", options: ["3", "4", "5"] },
      { id: "quickView", label: "Quick View Modal", type: "toggle", default: true },
      { id: "wishlist", label: "Wishlist Feature", type: "toggle", default: true },
      { id: "primaryColor", label: "Brand Color", type: "color", default: "#7c3aed" },
    ],
    features: ["Product catalog", "Shopping cart", "Wishlist", "Quick view", "Product filters", "Newsletter popup"],
    contentHints: {
      heroTitle: "New Season Collection",
      heroSubtitle: "Discover the latest trends",
      ctaButton: "Shop Now",
      categories: "New Arrivals, Best Sellers, Sale",
    },
    odooVersion: "18.0",
    isPremium: true,
  },

  // 6. Education & Learning
  {
    id: "education-bright",
    name: "Education Bright",
    industry: "education",
    description: "Friendly, accessible theme for schools and learning platforms.",
    tagline: "Learn without limits",
    keywords: ["education", "school", "university", "courses", "learning", "training"],
    previewImage: "/templates/education-bright/preview.png",
    colors: {
      primary: "#4f46e5",
      secondary: "#0891b2",
      background: "#f5f5ff",
      surface: "#ffffff",
      text: "#1e1b4b",
      textMuted: "#6366f1",
      border: "#c7d2fe",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Nunito, sans-serif",
      bodyFont: "Nunito, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "72px",
      containerWidth: "1240px",
      gap: "24px",
      borderRadius: "16px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Welcome", description: "Welcome message with enrollment CTA", required: true, variants: ["image", "video", "animated"] },
      { type: "features", title: "Programs", description: "Course offerings", required: true, variants: ["cards", "tabs", "carousel"] },
      { type: "team", title: "Faculty", description: "Instructor profiles", required: true, variants: ["grid", "carousel", "featured"] },
      { type: "stats", title: "Achievements", description: "Success metrics", required: false, variants: ["counters", "cards", "timeline"] },
      { type: "testimonials", title: "Student Stories", description: "Student testimonials", required: false, variants: ["video", "cards", "quotes"] },
      { type: "events", title: "Upcoming Events", description: "School events calendar", required: false, variants: ["calendar", "list", "cards"] },
      { type: "contact", title: "Admissions", description: "Inquiry form", required: true, variants: ["form", "sidebar", "fullwidth"] },
    ],
    customizations: [
      { id: "courseCards", label: "Course Card Style", type: "select", default: "detailed", options: ["simple", "detailed", "image"] },
      { id: "eventsCalendar", label: "Show Events Calendar", type: "toggle", default: true },
      { id: "studentPortal", label: "Student Portal Link", type: "toggle", default: true },
      { id: "accentColor", label: "Accent Color", type: "color", default: "#f97316" },
    ],
    features: ["Course catalog", "Faculty profiles", "Events calendar", "Admissions form", "Student portal", "Newsletter"],
    contentHints: {
      heroTitle: "Shape Your Future",
      heroSubtitle: "World-class education for tomorrow's leaders",
      programsTitle: "Our Programs",
      admissionsCta: "Apply Now",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 7. Real Estate & Property
  {
    id: "realestate-luxury",
    name: "Real Estate Luxury",
    industry: "realestate",
    description: "Elegant theme for real estate agencies with property showcases.",
    tagline: "Find your dream home",
    keywords: ["real estate", "property", "homes", "listings", "agent", "broker"],
    previewImage: "/templates/realestate-luxury/preview.png",
    colors: {
      primary: "#0f766e",
      secondary: "#b45309",
      background: "#f7f9f9",
      surface: "#ffffff",
      text: "#134e4a",
      textMuted: "#5eead4",
      border: "#d1d5db",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Cormorant Garamond, serif",
      bodyFont: "Montserrat, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1280px",
      gap: "28px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero Search", description: "Property search with filters", required: true, variants: ["search", "map", "slider"] },
      { type: "products", title: "Featured Listings", description: "Property listings", required: true, variants: ["grid", "map", "list"] },
      { type: "services", title: "Our Services", description: "Real estate services", required: true, variants: ["icons", "cards", "steps"] },
      { type: "team", title: "Our Agents", description: "Agent profiles", required: true, variants: ["grid", "carousel", "detailed"] },
      { type: "testimonials", title: "Success Stories", description: "Client testimonials", required: false, variants: ["video", "cards", "quotes"] },
      { type: "blog", title: "Market Insights", description: "Real estate blog", required: false, variants: ["grid", "featured", "list"] },
      { type: "contact", title: "Get in Touch", description: "Contact form", required: true, variants: ["form", "sidebar", "map"] },
    ],
    customizations: [
      { id: "propertySearch", label: "Advanced Property Search", type: "toggle", default: true },
      { id: "mapIntegration", label: "Map Integration", type: "toggle", default: true },
      { id: "virtualTours", label: "Virtual Tours Support", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#0f766e" },
    ],
    features: ["Property search", "Listing management", "Agent profiles", "Virtual tours", "Market reports", "Mortgage calculator"],
    contentHints: {
      heroTitle: "Find Your Perfect Home",
      heroSubtitle: "Luxury properties in prime locations",
      listingsTitle: "Featured Properties",
      searchPlaceholder: "Search by location, price, or property type",
    },
    odooVersion: "18.0",
    isPremium: true,
  },

  // 8. Fitness & Wellness
  {
    id: "fitness-energy",
    name: "Fitness Energy",
    industry: "fitness",
    description: "Energetic theme for gyms, fitness studios, and wellness centers.",
    tagline: "Transform your body",
    keywords: ["fitness", "gym", "workout", "wellness", "health", "training"],
    previewImage: "/templates/fitness-energy/preview.png",
    colors: {
      primary: "#dc2626",
      secondary: "#1f2937",
      background: "#fafafa",
      surface: "#ffffff",
      text: "#111827",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Oswald, sans-serif",
      bodyFont: "Roboto, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1280px",
      gap: "24px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 3,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Motivational hero with CTA", required: true, variants: ["video", "image", "split"] },
      { type: "services", title: "Programs", description: "Fitness programs", required: true, variants: ["cards", "tabs", "grid"] },
      { type: "team", title: "Trainers", description: "Trainer profiles", required: true, variants: ["grid", "carousel", "cards"] },
      { type: "pricing", title: "Membership", description: "Membership plans", required: true, variants: ["cards", "table", "comparison"] },
      { type: "gallery", title: "Facilities", description: "Gym photos", required: false, variants: ["grid", "carousel", "masonry"] },
      { type: "testimonials", title: "Transformations", description: "Success stories", required: false, variants: ["before-after", "video", "quotes"] },
      { type: "contact", title: "Start Today", description: "Trial signup", required: true, variants: ["form", "embedded", "popup"] },
    ],
    customizations: [
      { id: "classSchedule", label: "Class Schedule Integration", type: "toggle", default: true },
      { id: "beforeAfter", label: "Before/After Gallery", type: "toggle", default: true },
      { id: "trialSignup", label: "Free Trial Signup", type: "toggle", default: true },
      { id: "primaryColor", label: "Energy Color", type: "color", default: "#dc2626" },
    ],
    features: ["Class schedule", "Membership plans", "Trainer profiles", "Transformation gallery", "Free trial", "Mobile app link"],
    contentHints: {
      heroTitle: "Unleash Your Potential",
      heroSubtitle: "Transform your body, transform your life",
      programsTitle: "Our Programs",
      trialCta: "Start Free Trial",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 9. Creative & Portfolio
  {
    id: "creative-bold",
    name: "Creative Bold",
    industry: "creative",
    description: "Bold, artistic theme for designers and creative professionals.",
    tagline: "Create without boundaries",
    keywords: ["creative", "portfolio", "designer", "artist", "photography", "agency"],
    previewImage: "/templates/creative-bold/preview.png",
    colors: {
      primary: "#be185d",
      secondary: "#7c3aed",
      background: "#fdf4ff",
      surface: "#ffffff",
      text: "#1f2937",
      textMuted: "#6b7280",
      border: "#f5d0fe",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Space Grotesk, sans-serif",
      bodyFont: "DM Sans, sans-serif",
      baseFontSize: "17px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "100px",
      containerWidth: "1400px",
      gap: "32px",
      borderRadius: "16px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "hamburger",
      footerColumns: 3,
    },
    sections: [
      { type: "hero", title: "Intro", description: "Bold introduction", required: true, variants: ["fullscreen", "split", "animated"] },
      { type: "portfolio", title: "Work", description: "Project showcase", required: true, variants: ["masonry", "grid", "carousel"] },
      { type: "about", title: "About", description: "Creative story", required: true, variants: ["story", "timeline", "video"] },
      { type: "services", title: "Services", description: "Offered services", required: true, variants: ["minimal", "detailed", "icons"] },
      { type: "testimonials", title: "Clients", description: "Client testimonials", required: false, variants: ["logos", "quotes", "video"] },
      { type: "contact", title: "Let's Talk", description: "Contact form", required: true, variants: ["minimal", "creative", "fullwidth"] },
    ],
    customizations: [
      { id: "portfolioLayout", label: "Portfolio Layout", type: "select", default: "masonry", options: ["masonry", "grid", "carousel"] },
      { id: "cursorEffect", label: "Custom Cursor", type: "toggle", default: true },
      { id: "darkMode", label: "Dark Mode Option", type: "toggle", default: true },
      { id: "primaryColor", label: "Accent Color", type: "color", default: "#be185d" },
    ],
    features: ["Portfolio gallery", "Project case studies", "Client logos", "Custom animations", "Dark mode", "Contact form"],
    contentHints: {
      heroTitle: "Creative [Profession]",
      heroSubtitle: "Turning ideas into visual experiences",
      portfolioTitle: "Selected Work",
      contactCta: "Start a Project",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 10. Nonprofit & Charity
  {
    id: "nonprofit-compassion",
    name: "Nonprofit Compassion",
    industry: "nonprofit",
    description: "Compassionate theme for charitable organizations and causes.",
    tagline: "Together we make a difference",
    keywords: ["nonprofit", "charity", "donation", "cause", "volunteer", "foundation"],
    previewImage: "/templates/nonprofit-compassion/preview.png",
    colors: {
      primary: "#0891b2",
      secondary: "#059669",
      background: "#ecfeff",
      surface: "#ffffff",
      text: "#164e63",
      textMuted: "#0e7490",
      border: "#a5f3fc",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Nunito, sans-serif",
      bodyFont: "Open Sans, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "72px",
      containerWidth: "1200px",
      gap: "24px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Mission", description: "Mission statement with donate CTA", required: true, variants: ["impact", "video", "story"] },
      { type: "stats", title: "Impact", description: "Impact statistics", required: true, variants: ["counters", "infographic", "timeline"] },
      { type: "services", title: "Programs", description: "Charitable programs", required: true, variants: ["cards", "stories", "grid"] },
      { type: "testimonials", title: "Stories", description: "Beneficiary stories", required: true, variants: ["video", "cards", "featured"] },
      { type: "team", title: "Team", description: "Team and volunteers", required: false, variants: ["grid", "carousel", "simple"] },
      { type: "events", title: "Events", description: "Upcoming events", required: false, variants: ["calendar", "cards", "list"] },
      { type: "cta", title: "Donate", description: "Donation CTA", required: true, variants: ["amounts", "monthly", "custom"] },
      { type: "contact", title: "Get Involved", description: "Volunteer and contact form", required: true, variants: ["form", "sidebar", "embedded"] },
    ],
    customizations: [
      { id: "donationWidget", label: "Donation Widget", type: "toggle", default: true },
      { id: "impactCounter", label: "Impact Counter", type: "toggle", default: true },
      { id: "volunteerSignup", label: "Volunteer Signup", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#0891b2" },
    ],
    features: ["Donation system", "Impact metrics", "Volunteer signup", "Event calendar", "Newsletter", "Social sharing"],
    contentHints: {
      heroTitle: "Creating [Impact] Together",
      heroSubtitle: "Every contribution makes a difference",
      donateButton: "Donate Now",
      impactTitle: "Our Impact",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 11. Finance & Banking
  {
    id: "finance-secure",
    name: "Finance Secure",
    industry: "finance",
    description: "Authoritative, secure theme for financial services and banking.",
    tagline: "Your financial future, secured",
    keywords: ["finance", "banking", "investment", "insurance", "wealth", "advisory"],
    previewImage: "/templates/finance-secure/preview.png",
    colors: {
      primary: "#1e40af",
      secondary: "#0f766e",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#0c0a09",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#16a34a",
      warning: "#ca8a04",
      error: "#b91c1c",
    },
    typography: {
      headingFont: "IBM Plex Sans, sans-serif",
      bodyFont: "IBM Plex Sans, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1200px",
      gap: "24px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Trust-building hero", required: true, variants: ["stats", "video", "classic"] },
      { type: "services", title: "Services", description: "Financial services", required: true, variants: ["icons", "cards", "detailed"] },
      { type: "features", title: "Why Us", description: "Trust factors", required: true, variants: ["icons", "numbers", "comparison"] },
      { type: "team", title: "Advisors", description: "Financial advisors", required: false, variants: ["grid", "carousel", "featured"] },
      { type: "testimonials", title: "Client Success", description: "Client testimonials", required: false, variants: ["quotes", "video", "logos"] },
      { type: "faq", title: "FAQ", description: "Common questions", required: false, variants: ["accordion", "categories", "search"] },
      { type: "contact", title: "Consultation", description: "Contact form", required: true, variants: ["form", "callback", "chat"] },
    ],
    customizations: [
      { id: "calculators", label: "Financial Calculators", type: "toggle", default: true },
      { id: "securityBadges", label: "Security Badges", type: "toggle", default: true },
      { id: "liveChat", label: "Live Chat Widget", type: "toggle", default: false },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#1e40af" },
    ],
    features: ["Service overview", "Calculator tools", "Advisor profiles", "Security badges", "Client portal", "Appointment booking"],
    contentHints: {
      heroTitle: "Secure Your Financial Future",
      heroSubtitle: "Trusted financial guidance for over [X] years",
      servicesTitle: "Our Services",
      consultationCta: "Schedule Consultation",
    },
    odooVersion: "18.0",
    isPremium: true,
  },

  // 12. Travel & Tourism
  {
    id: "travel-adventure",
    name: "Travel Adventure",
    industry: "travel",
    description: "Inspiring theme for travel agencies and tourism businesses.",
    tagline: "Adventure awaits",
    keywords: ["travel", "tourism", "vacation", "tours", "adventure", "destinations"],
    previewImage: "/templates/travel-adventure/preview.png",
    colors: {
      primary: "#0369a1",
      secondary: "#15803d",
      background: "#f0f9ff",
      surface: "#ffffff",
      text: "#0c4a6e",
      textMuted: "#0284c7",
      border: "#bae6fd",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Outfit, sans-serif",
      bodyFont: "Outfit, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1320px",
      gap: "28px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Explore", description: "Destination search hero", required: true, variants: ["search", "video", "slider"] },
      { type: "products", title: "Destinations", description: "Featured destinations", required: true, variants: ["grid", "map", "carousel"] },
      { type: "services", title: "Experiences", description: "Travel experiences", required: true, variants: ["cards", "icons", "stories"] },
      { type: "gallery", title: "Gallery", description: "Travel photos", required: false, variants: ["masonry", "slider", "grid"] },
      { type: "testimonials", title: "Travelers Say", description: "Customer reviews", required: false, variants: ["cards", "video", "quotes"] },
      { type: "blog", title: "Travel Guide", description: "Travel blog", required: false, variants: ["grid", "magazine", "featured"] },
      { type: "contact", title: "Plan Your Trip", description: "Inquiry form", required: true, variants: ["form", "wizard", "chat"] },
    ],
    customizations: [
      { id: "destinationSearch", label: "Destination Search", type: "toggle", default: true },
      { id: "mapIntegration", label: "Interactive Map", type: "toggle", default: true },
      { id: "bookingWidget", label: "Booking Widget", type: "toggle", default: true },
      { id: "primaryColor", label: "Primary Color", type: "color", default: "#0369a1" },
    ],
    features: ["Destination search", "Tour packages", "Interactive map", "Travel blog", "Booking system", "Customer reviews"],
    contentHints: {
      heroTitle: "Discover Your Next Adventure",
      heroSubtitle: "Unforgettable experiences await",
      destinationsTitle: "Popular Destinations",
      bookingCta: "Book Now",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 13. Beauty & Cosmetics
  {
    id: "beauty-elegant",
    name: "Beauty Elegant",
    industry: "beauty",
    description: "Refined, luxurious theme for beauty brands and salons.",
    tagline: "Reveal your radiance",
    keywords: ["beauty", "cosmetics", "salon", "spa", "skincare", "makeup"],
    previewImage: "/templates/beauty-elegant/preview.png",
    colors: {
      primary: "#be185d",
      secondary: "#9d174d",
      background: "#fdf2f8",
      surface: "#ffffff",
      text: "#1c1917",
      textMuted: "#78716c",
      border: "#fce7f3",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Cormorant, serif",
      bodyFont: "Jost, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "500",
    },
    spacing: {
      sectionPadding: "88px",
      containerWidth: "1200px",
      gap: "28px",
      borderRadius: "0px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Elegant hero with product", required: true, variants: ["fullscreen", "split", "video"] },
      { type: "products", title: "Products", description: "Product showcase", required: true, variants: ["grid", "carousel", "featured"] },
      { type: "services", title: "Treatments", description: "Spa/salon services", required: true, variants: ["cards", "menu", "gallery"] },
      { type: "appointments", title: "Book", description: "Appointment booking", required: true, variants: ["form", "calendar", "widget"] },
      { type: "team", title: "Specialists", description: "Beauty specialists", required: false, variants: ["grid", "carousel", "simple"] },
      { type: "testimonials", title: "Reviews", description: "Client reviews", required: false, variants: ["cards", "video", "instagram"] },
      { type: "gallery", title: "Gallery", description: "Beauty gallery", required: false, variants: ["masonry", "instagram", "slider"] },
      { type: "contact", title: "Contact Us", description: "General inquiries and feedback", required: true, variants: ["form", "elegant", "minimal"] },
    ],
    customizations: [
      { id: "appointmentBooking", label: "Online Booking", type: "toggle", default: true },
      { id: "instagramFeed", label: "Instagram Feed", type: "toggle", default: true },
      { id: "productQuickView", label: "Product Quick View", type: "toggle", default: true },
      { id: "accentColor", label: "Accent Color", type: "color", default: "#d4a373" },
    ],
    features: ["Product catalog", "Appointment booking", "Service menu", "Instagram feed", "Specialist profiles", "Gift cards"],
    contentHints: {
      heroTitle: "Reveal Your Natural Beauty",
      heroSubtitle: "Luxury skincare and treatments",
      servicesTitle: "Our Treatments",
      bookingCta: "Book Appointment",
    },
    odooVersion: "18.0",
    isPremium: true,
  },

  // 14. Automotive
  {
    id: "automotive-drive",
    name: "Automotive Drive",
    industry: "automotive",
    description: "Dynamic theme for car dealerships and automotive services.",
    tagline: "Drive your dreams",
    keywords: ["automotive", "cars", "dealership", "vehicles", "auto", "motors"],
    previewImage: "/templates/automotive-drive/preview.png",
    colors: {
      primary: "#dc2626",
      secondary: "#18181b",
      background: "#fafafa",
      surface: "#ffffff",
      text: "#09090b",
      textMuted: "#71717a",
      border: "#e4e4e7",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Rajdhani, sans-serif",
      bodyFont: "Open Sans, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1400px",
      gap: "24px",
      borderRadius: "4px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Featured", description: "Featured vehicle hero", required: true, variants: ["slider", "video", "split"] },
      { type: "products", title: "Inventory", description: "Vehicle inventory", required: true, variants: ["grid", "list", "filters"] },
      { type: "services", title: "Services", description: "Auto services", required: true, variants: ["icons", "cards", "tabs"] },
      { type: "features", title: "Why Us", description: "Dealership benefits", required: false, variants: ["icons", "comparison", "stats"] },
      { type: "testimonials", title: "Reviews", description: "Customer reviews", required: false, variants: ["cards", "video", "ratings"] },
      { type: "locations", title: "Locations", description: "Dealership locations", required: true, variants: ["map", "cards", "list"] },
      { type: "contact", title: "Contact", description: "Inquiry form", required: true, variants: ["form", "callback", "chat"] },
    ],
    customizations: [
      { id: "vehicleSearch", label: "Vehicle Search Filters", type: "toggle", default: true },
      { id: "financingCalculator", label: "Financing Calculator", type: "toggle", default: true },
      { id: "testDriveBooking", label: "Test Drive Booking", type: "toggle", default: true },
      { id: "primaryColor", label: "Brand Color", type: "color", default: "#dc2626" },
    ],
    features: ["Vehicle inventory", "Search filters", "Financing calculator", "Test drive booking", "Service scheduling", "Trade-in form"],
    contentHints: {
      heroTitle: "Find Your Perfect Ride",
      heroSubtitle: "Quality vehicles at competitive prices",
      inventoryTitle: "Browse Inventory",
      testDriveCta: "Schedule Test Drive",
    },
    odooVersion: "18.0",
    isPremium: false,
  },

  // 15. Construction & Building
  {
    id: "construction-solid",
    name: "Construction Solid",
    industry: "construction",
    description: "Strong, reliable theme for construction and building companies.",
    tagline: "Building tomorrow today",
    keywords: ["construction", "building", "contractor", "architecture", "renovation", "engineering"],
    previewImage: "/templates/construction-solid/preview.png",
    colors: {
      primary: "#d97706",
      secondary: "#1f2937",
      background: "#f9fafb",
      surface: "#ffffff",
      text: "#111827",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#16a34a",
      warning: "#f59e0b",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Barlow, sans-serif",
      bodyFont: "Barlow, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1280px",
      gap: "24px",
      borderRadius: "4px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    sections: [
      { type: "hero", title: "Hero", description: "Project showcase hero", required: true, variants: ["video", "slider", "split"] },
      { type: "services", title: "Services", description: "Construction services", required: true, variants: ["icons", "cards", "detailed"] },
      { type: "portfolio", title: "Projects", description: "Project portfolio", required: true, variants: ["grid", "masonry", "slider"] },
      { type: "about", title: "About Us", description: "Company history", required: true, variants: ["timeline", "story", "stats"] },
      { type: "testimonials", title: "Testimonials", description: "Client testimonials", required: false, variants: ["cards", "video", "quotes"] },
      { type: "team", title: "Team", description: "Team members", required: false, variants: ["grid", "carousel", "simple"] },
      { type: "contact", title: "Get a Quote", description: "Quote request form", required: true, variants: ["form", "detailed", "sidebar"] },
    ],
    customizations: [
      { id: "projectGallery", label: "Project Gallery", type: "toggle", default: true },
      { id: "quoteCalculator", label: "Quote Calculator", type: "toggle", default: true },
      { id: "certifications", label: "Show Certifications", type: "toggle", default: true },
      { id: "primaryColor", label: "Brand Color", type: "color", default: "#d97706" },
    ],
    features: ["Project portfolio", "Service listings", "Quote request", "Team profiles", "Certifications", "Safety standards"],
    contentHints: {
      heroTitle: "Building Excellence Since [Year]",
      heroSubtitle: "Quality construction you can trust",
      servicesTitle: "Our Services",
      quoteCta: "Request a Quote",
    },
    odooVersion: "18.0",
    isPremium: false,
  },
];

// =============================================================================
// TemplateLibrary Class
// =============================================================================

export class TemplateLibrary {
  private templates: Map<string, IndustryTemplate> = new Map();
  private customTemplates: Map<string, IndustryTemplate> = new Map();

  constructor() {
    for (const template of INDUSTRY_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Get all available templates
   */
  getAll(): IndustryTemplate[] {
    return [...this.templates.values(), ...this.customTemplates.values()];
  }

  /**
   * Get template by ID
   */
  getById(id: string): IndustryTemplate | undefined {
    return this.templates.get(id) || this.customTemplates.get(id);
  }

  /**
   * Get templates by industry
   */
  getByIndustry(industry: IndustryCategory): IndustryTemplate[] {
    return this.getAll().filter((t) => t.industry === industry);
  }

  /**
   * Filter templates
   */
  filter(options: TemplateFilterOptions): IndustryTemplate[] {
    let results = this.getAll();

    if (options.industry) {
      results = results.filter((t) => t.industry === options.industry);
    }

    if (options.keywords?.length) {
      results = results.filter((t) =>
        options.keywords!.some((kw) => t.keywords.includes(kw))
      );
    }

    if (options.includePremium === false) {
      results = results.filter((t) => !t.isPremium);
    }

    if (options.search) {
      const search = options.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.keywords.some((k) => k.includes(search))
      );
    }

    return results;
  }

  /**
   * Search templates
   */
  search(query: string): IndustryTemplate[] {
    return this.filter({ search: query });
  }

  /**
   * Get all industries
   */
  getIndustries(): IndustryCategory[] {
    const industries = new Set<IndustryCategory>();
    for (const template of this.getAll()) {
      industries.add(template.industry);
    }
    return [...industries];
  }

  /**
   * Get industry count
   */
  getIndustryCount(): number {
    return this.getIndustries().length;
  }

  /**
   * Get template count
   */
  getTemplateCount(): number {
    return this.templates.size + this.customTemplates.size;
  }

  /**
   * Get templates grouped by industry
   */
  getGroupedByIndustry(): Map<IndustryCategory, IndustryTemplate[]> {
    const grouped = new Map<IndustryCategory, IndustryTemplate[]>();

    for (const template of this.getAll()) {
      const existing = grouped.get(template.industry) || [];
      existing.push(template);
      grouped.set(template.industry, existing);
    }

    return grouped;
  }

  /**
   * Customize a template
   */
  customize(
    templateId: string,
    customizations: Record<string, string | boolean>
  ): CustomizedTemplate | null {
    const template = this.getById(templateId);
    if (!template) return null;

    return {
      templateId,
      customizations,
      generatedAt: new Date(),
    };
  }

  /**
   * Register a custom template
   */
  registerTemplate(template: IndustryTemplate): void {
    this.customTemplates.set(template.id, template);
  }

  /**
   * Remove a custom template
   */
  removeTemplate(id: string): boolean {
    return this.customTemplates.delete(id);
  }

  /**
   * Get recommended sections for an industry
   */
  getRecommendedSections(industry: IndustryCategory): SectionConfig[] {
    const templates = this.getByIndustry(industry);
    if (templates.length === 0) return [];

    // Return sections from the first template for this industry
    return templates[0].sections;
  }

  /**
   * Get customization options for a template
   */
  getCustomizationOptions(templateId: string): CustomizationOption[] {
    const template = this.getById(templateId);
    return template?.customizations || [];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createTemplateLibrary(): TemplateLibrary {
  return new TemplateLibrary();
}

let libraryInstance: TemplateLibrary | null = null;

export function getTemplateLibrary(): TemplateLibrary {
  if (!libraryInstance) {
    libraryInstance = new TemplateLibrary();
  }
  return libraryInstance;
}

export function resetTemplateLibrary(): void {
  libraryInstance = null;
}

export default TemplateLibrary;
