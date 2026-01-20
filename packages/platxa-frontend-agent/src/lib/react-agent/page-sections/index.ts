/**
 * Page Sections Module
 *
 * Generators for common page sections like hero, pricing,
 * testimonials, and dashboard layouts.
 */

// Types
export type {
  CtaButton,
  ImageConfig,
  SocialLink,
  HeroLayout,
  HeroConfig,
  HeroOutput,
  FeatureItem,
  FeatureGridLayout,
  FeatureGridConfig,
  PricingTier,
  PricingTableConfig,
  Testimonial,
  TestimonialLayout,
  TestimonialConfig,
  FooterColumn,
  FooterConfig,
  SidebarItem,
  DashboardLayoutConfig,
  TableColumn,
  DataTableConfig,
  AuthFormType,
  OAuthProvider,
  AuthFormConfig,
  SectionOutput,
} from "./types"

// Generators
export {
  HERO_LAYOUTS,
  generateHeroSection,
  generateFeatureGrid,
  generatePricingTable,
  generateTestimonials,
  generateFooter,
  generateDashboardLayout,
  generateDataTable,
  generateAuthForm,
  createPageSectionGenerator,
} from "./page-sections"
