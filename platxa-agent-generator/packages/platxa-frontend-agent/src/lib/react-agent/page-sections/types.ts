/**
 * Page Sections Types
 *
 * Types for generating common page sections like hero, pricing,
 * testimonials, and dashboard layouts.
 */

// =============================================================================
// Common Types
// =============================================================================

/**
 * Call-to-action button configuration
 */
export interface CtaButton {
  /** Button text */
  text: string
  /** Button href or onClick handler name */
  href?: string
  /** Button variant */
  variant?: "primary" | "secondary" | "outline" | "ghost"
  /** Icon name (optional) */
  icon?: string
}

/**
 * Image configuration
 */
export interface ImageConfig {
  /** Image source URL or path */
  src: string
  /** Alt text for accessibility */
  alt: string
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Whether to use priority loading */
  priority?: boolean
}

/**
 * Social link configuration
 */
export interface SocialLink {
  /** Platform name */
  platform: "twitter" | "github" | "linkedin" | "facebook" | "instagram" | "youtube"
  /** URL */
  href: string
  /** Aria label */
  label?: string
}

// =============================================================================
// Hero Section (#61)
// =============================================================================

/**
 * Hero section layout variant
 */
export type HeroLayout =
  | "centered" // Text centered, CTA below
  | "split" // Text left, image right
  | "split-reverse" // Image left, text right
  | "background-image" // Full background image with overlay

/**
 * Hero section configuration
 */
export interface HeroConfig {
  /** Section layout */
  layout: HeroLayout
  /** Main headline */
  headline: string
  /** Subheadline/description */
  subheadline?: string
  /** Call-to-action buttons */
  ctas?: CtaButton[]
  /** Hero image */
  image?: ImageConfig
  /** Background configuration */
  background?: {
    type: "color" | "gradient" | "image"
    value: string
    overlay?: string
  }
  /** Badge/eyebrow text above headline */
  badge?: string
  /** Trusted by logos */
  trustedBy?: ImageConfig[]
}

/**
 * Generated hero section output
 */
export interface HeroOutput {
  /** Component code */
  code: string
  /** Component name */
  name: string
  /** Required imports */
  imports: string[]
  /** Props interface */
  propsInterface: string
}

// =============================================================================
// Feature Grid (#62)
// =============================================================================

/**
 * Single feature item
 */
export interface FeatureItem {
  /** Feature title */
  title: string
  /** Feature description */
  description: string
  /** Icon name (Lucide icon) */
  icon: string
  /** Optional link */
  href?: string
}

/**
 * Feature grid layout
 */
export type FeatureGridLayout =
  | "grid-2" // 2 columns
  | "grid-3" // 3 columns
  | "grid-4" // 4 columns
  | "alternating" // Alternating left/right with images
  | "bento" // Bento box layout

/**
 * Feature grid configuration
 */
export interface FeatureGridConfig {
  /** Section title */
  title?: string
  /** Section subtitle */
  subtitle?: string
  /** Layout style */
  layout: FeatureGridLayout
  /** Feature items */
  features: FeatureItem[]
  /** Show icons */
  showIcons?: boolean
  /** Card style */
  cardStyle?: "flat" | "bordered" | "elevated"
}

// =============================================================================
// Pricing Table (#63)
// =============================================================================

/**
 * Pricing tier
 */
export interface PricingTier {
  /** Tier name */
  name: string
  /** Price (number or string like "Custom") */
  price: number | string
  /** Billing period */
  period?: "month" | "year" | "one-time"
  /** Description */
  description?: string
  /** Features included */
  features: string[]
  /** Features not included */
  notIncluded?: string[]
  /** CTA button */
  cta: CtaButton
  /** Whether this is the popular/recommended tier */
  popular?: boolean
  /** Badge text (e.g., "Most Popular", "Best Value") */
  badge?: string
}

/**
 * Pricing table configuration
 */
export interface PricingTableConfig {
  /** Section title */
  title?: string
  /** Section subtitle */
  subtitle?: string
  /** Pricing tiers */
  tiers: PricingTier[]
  /** Show annual/monthly toggle */
  showToggle?: boolean
  /** Annual discount percentage */
  annualDiscount?: number
  /** Currency symbol */
  currency?: string
}

// =============================================================================
// Testimonials (#64)
// =============================================================================

/**
 * Single testimonial
 */
export interface Testimonial {
  /** Quote text */
  quote: string
  /** Author name */
  author: string
  /** Author role/title */
  role?: string
  /** Author company */
  company?: string
  /** Author avatar */
  avatar?: ImageConfig
  /** Rating (1-5) */
  rating?: number
}

/**
 * Testimonial section layout
 */
export type TestimonialLayout =
  | "carousel" // Sliding carousel
  | "grid" // Grid of cards
  | "single" // One large testimonial
  | "marquee" // Infinite scroll marquee

/**
 * Testimonial section configuration
 */
export interface TestimonialConfig {
  /** Section title */
  title?: string
  /** Section subtitle */
  subtitle?: string
  /** Layout style */
  layout: TestimonialLayout
  /** Testimonials */
  testimonials: Testimonial[]
  /** Show ratings */
  showRatings?: boolean
  /** Auto-play carousel */
  autoPlay?: boolean
}

// =============================================================================
// Footer (#65)
// =============================================================================

/**
 * Footer link column
 */
export interface FooterColumn {
  /** Column title */
  title: string
  /** Links in column */
  links: Array<{
    text: string
    href: string
  }>
}

/**
 * Footer configuration
 */
export interface FooterConfig {
  /** Company/brand name */
  brand: string
  /** Brand logo */
  logo?: ImageConfig
  /** Tagline/description */
  tagline?: string
  /** Link columns */
  columns: FooterColumn[]
  /** Social links */
  social?: SocialLink[]
  /** Copyright text */
  copyright?: string
  /** Newsletter signup */
  newsletter?: {
    title: string
    placeholder: string
    buttonText: string
  }
  /** Legal links (Privacy, Terms) */
  legal?: Array<{
    text: string
    href: string
  }>
}

// =============================================================================
// Dashboard Layout (#66)
// =============================================================================

/**
 * Sidebar navigation item
 */
export interface SidebarItem {
  /** Item label */
  label: string
  /** Icon name */
  icon: string
  /** Href */
  href: string
  /** Badge count */
  badge?: number
  /** Nested items */
  children?: SidebarItem[]
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayoutConfig {
  /** Sidebar navigation items */
  sidebarItems: SidebarItem[]
  /** Sidebar collapsed by default */
  sidebarCollapsed?: boolean
  /** Show header */
  showHeader?: boolean
  /** Header content (search, user menu, etc.) */
  headerConfig?: {
    showSearch?: boolean
    showNotifications?: boolean
    showUserMenu?: boolean
  }
  /** Brand/logo */
  brand?: {
    name: string
    logo?: ImageConfig
  }
}

// =============================================================================
// Data Table (#67)
// =============================================================================

/**
 * Table column definition
 */
export interface TableColumn {
  /** Column key (accessor) */
  key: string
  /** Column header */
  header: string
  /** Column type for formatting */
  type?: "text" | "number" | "date" | "currency" | "badge" | "avatar" | "actions"
  /** Sortable */
  sortable?: boolean
  /** Filterable */
  filterable?: boolean
  /** Column width */
  width?: string
}

/**
 * Data table configuration
 */
export interface DataTableConfig {
  /** Table columns */
  columns: TableColumn[]
  /** Enable sorting */
  enableSorting?: boolean
  /** Enable filtering */
  enableFiltering?: boolean
  /** Enable pagination */
  enablePagination?: boolean
  /** Page size options */
  pageSizes?: number[]
  /** Enable row selection */
  enableSelection?: boolean
  /** Enable search */
  enableSearch?: boolean
  /** Actions column */
  actions?: Array<{
    label: string
    icon?: string
    variant?: "default" | "destructive"
  }>
}

// =============================================================================
// Auth Forms (#68)
// =============================================================================

/**
 * Auth form type
 */
export type AuthFormType = "login" | "signup" | "forgot-password" | "reset-password"

/**
 * OAuth provider
 */
export type OAuthProvider = "google" | "github" | "apple" | "microsoft"

/**
 * Auth form configuration
 */
export interface AuthFormConfig {
  /** Form type */
  type: AuthFormType
  /** OAuth providers */
  oauthProviders?: OAuthProvider[]
  /** Show "Remember me" checkbox */
  showRememberMe?: boolean
  /** Show password strength indicator */
  showPasswordStrength?: boolean
  /** Custom fields (for signup) */
  customFields?: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel"
    required?: boolean
  }>
  /** Terms and privacy links */
  legal?: {
    termsHref: string
    privacyHref: string
  }
  /** Redirect URL after auth */
  redirectUrl?: string
}

// =============================================================================
// Section Generator Output
// =============================================================================

/**
 * Generated section output
 */
export interface SectionOutput {
  /** Component code */
  code: string
  /** Component file name */
  fileName: string
  /** Required dependencies */
  dependencies: string[]
  /** Props interface code */
  propsInterface?: string
  /** Example usage */
  exampleUsage?: string
}
