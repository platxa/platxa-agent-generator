/**
 * Page Section Generators
 *
 * Generates common page sections like hero, pricing, testimonials,
 * and dashboard layouts following modern React patterns.
 */

import type {
  HeroConfig,
  HeroLayout,
  FeatureGridConfig,
  PricingTableConfig,
  TestimonialConfig,
  FooterConfig,
  DashboardLayoutConfig,
  DataTableConfig,
  AuthFormConfig,
  SectionOutput,
  CtaButton,
} from "./types"

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase())
}

/**
 * Generate button JSX from config
 */
function generateButtonJsx(cta: CtaButton, index: number): string {
  const variant = cta.variant || "primary"
  const variantClass = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : variant === "secondary"
    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    : variant === "outline"
    ? "border border-input bg-background hover:bg-accent"
    : "hover:bg-accent hover:text-accent-foreground"

  if (cta.href) {
    return `        <a
          key={${index}}
          href="${cta.href}"
          className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${variantClass}"
        >
          ${cta.text}
        </a>`
  }

  return `        <button
          key={${index}}
          className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${variantClass}"
        >
          ${cta.text}
        </button>`
}

// =============================================================================
// Hero Section Generator (#61)
// =============================================================================

/**
 * Default hero configurations by layout
 */
export const HERO_LAYOUTS: Record<HeroLayout, { containerClass: string; contentClass: string }> = {
  centered: {
    containerClass: "flex flex-col items-center justify-center text-center",
    contentClass: "max-w-3xl mx-auto",
  },
  split: {
    containerClass: "grid lg:grid-cols-2 gap-12 items-center",
    contentClass: "order-1 lg:order-1",
  },
  "split-reverse": {
    containerClass: "grid lg:grid-cols-2 gap-12 items-center",
    contentClass: "order-1 lg:order-2",
  },
  "background-image": {
    containerClass: "relative flex flex-col items-center justify-center text-center min-h-[600px]",
    contentClass: "relative z-10 max-w-3xl mx-auto",
  },
}

/**
 * Generate hero section component
 */
export function generateHeroSection(config: HeroConfig): SectionOutput {
  const layout = HERO_LAYOUTS[config.layout]
  const hasImage = config.image && (config.layout === "split" || config.layout === "split-reverse")
  const hasBgImage = config.layout === "background-image" && config.background?.type === "image"

  const code = `/**
 * Hero Section Component
 *
 * A ${config.layout} layout hero section with headline, subheadline, and CTAs.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface HeroSectionProps {
  /** Optional className override */
  className?: string
}

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      className={cn(
        "relative w-full py-24 lg:py-32",
        ${hasBgImage ? '"bg-cover bg-center bg-no-repeat",' : ""}
        className
      )}
      ${hasBgImage ? `style={{ backgroundImage: "url('${config.background?.value}')" }}` : ""}
    >
      ${hasBgImage ? `{/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />` : ""}
      <div className="container px-4 md:px-6">
        <div className="${layout.containerClass}">
          <div className="${layout.contentClass}">
            ${config.badge ? `{/* Badge */}
            <div className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-sm">
              ${config.badge}
            </div>` : ""}

            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              ${config.headline}
            </h1>

            ${config.subheadline ? `{/* Subheadline */}
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              ${config.subheadline}
            </p>` : ""}

            ${config.ctas && config.ctas.length > 0 ? `{/* CTAs */}
            <div className="mt-8 flex flex-wrap ${config.layout === "centered" ? "justify-center" : ""} gap-4">
${config.ctas.map((cta, i) => generateButtonJsx(cta, i)).join("\n")}
            </div>` : ""}

            ${config.trustedBy && config.trustedBy.length > 0 ? `{/* Trusted By */}
            <div className="mt-12">
              <p className="text-sm text-muted-foreground mb-4">Trusted by</p>
              <div className="flex flex-wrap ${config.layout === "centered" ? "justify-center" : ""} gap-8 opacity-50">
                {/* Add logo images here */}
              </div>
            </div>` : ""}
          </div>

          ${hasImage ? `{/* Hero Image */}
          <div className="${config.layout === "split-reverse" ? "order-1 lg:order-1" : "order-2 lg:order-2"}">
            <img
              src="${config.image?.src}"
              alt="${config.image?.alt}"
              className="rounded-lg shadow-2xl"
              ${config.image?.width ? `width={${config.image.width}}` : ""}
              ${config.image?.height ? `height={${config.image.height}}` : ""}
            />
          </div>` : ""}
        </div>
      </div>
    </section>
  )
}
`

  return {
    code,
    fileName: "HeroSection.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<HeroSection />`,
  }
}

// =============================================================================
// Feature Grid Generator (#62)
// =============================================================================

/**
 * Generate feature grid component
 */
export function generateFeatureGrid(config: FeatureGridConfig): SectionOutput {
  const gridCols = config.layout === "grid-2" ? "md:grid-cols-2"
    : config.layout === "grid-3" ? "md:grid-cols-2 lg:grid-cols-3"
    : config.layout === "grid-4" ? "md:grid-cols-2 lg:grid-cols-4"
    : "md:grid-cols-2"

  const cardClass = config.cardStyle === "bordered" ? "border rounded-lg p-6"
    : config.cardStyle === "elevated" ? "bg-card rounded-lg p-6 shadow-lg"
    : "p-6"

  const code = `/**
 * Feature Grid Component
 *
 * A ${config.layout} feature grid showcasing product features.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const features = ${JSON.stringify(config.features, null, 2)}

export interface FeatureGridProps {
  /** Optional className override */
  className?: string
}

export function FeatureGrid({ className }: FeatureGridProps) {
  return (
    <section className={cn("w-full py-24 lg:py-32", className)}>
      <div className="container px-4 md:px-6">
        ${config.title || config.subtitle ? `{/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          ${config.title ? `<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ${config.title}
          </h2>` : ""}
          ${config.subtitle ? `<p className="mt-4 text-lg text-muted-foreground">
            ${config.subtitle}
          </p>` : ""}
        </div>` : ""}

        {/* Feature Grid */}
        <div className="grid gap-8 ${gridCols}">
          {features.map((feature, index) => (
            <div key={index} className="${cardClass}">
              ${config.showIcons !== false ? `{/* Icon */}
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {/* Icon placeholder - replace with actual icon */}
                <span className="text-2xl">{feature.icon}</span>
              </div>` : ""}

              {/* Title */}
              <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>

              {/* Description */}
              <p className="text-muted-foreground">{feature.description}</p>

              {feature.href && (
                <a
                  href={feature.href}
                  className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Learn more &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
`

  return {
    code,
    fileName: "FeatureGrid.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<FeatureGrid />`,
  }
}

// =============================================================================
// Pricing Table Generator (#63)
// =============================================================================

/**
 * Generate pricing table component
 */
export function generatePricingTable(config: PricingTableConfig): SectionOutput {
  const currency = config.currency || "$"

  const code = `/**
 * Pricing Table Component
 *
 * A pricing comparison table with ${config.tiers.length} tiers.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const tiers = ${JSON.stringify(config.tiers, null, 2)}

export interface PricingTableProps {
  /** Optional className override */
  className?: string
}

export function PricingTable({ className }: PricingTableProps) {
  ${config.showToggle ? `const [isAnnual, setIsAnnual] = React.useState(false)
  const discount = ${config.annualDiscount || 20}` : ""}

  return (
    <section className={cn("w-full py-24 lg:py-32", className)}>
      <div className="container px-4 md:px-6">
        ${config.title || config.subtitle ? `{/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          ${config.title ? `<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ${config.title}
          </h2>` : ""}
          ${config.subtitle ? `<p className="mt-4 text-lg text-muted-foreground">
            ${config.subtitle}
          </p>` : ""}
        </div>` : ""}

        ${config.showToggle ? `{/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center rounded-full border p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                !isAnnual ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isAnnual ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              Annual <span className="ml-1 text-xs text-green-500">Save {discount}%</span>
            </button>
          </div>
        </div>` : ""}

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-${Math.min(config.tiers.length, 3)} lg:grid-cols-${config.tiers.length}">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                tier.popular && "border-primary shadow-lg scale-105"
              )}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier Name */}
              <h3 className="text-xl font-semibold">{tier.name}</h3>

              {tier.description && (
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              )}

              {/* Price */}
              <div className="mt-6">
                <span className="text-4xl font-bold">
                  {typeof tier.price === "number" ? (
                    <>
                      ${currency}{${config.showToggle ? "isAnnual ? Math.round(tier.price * 12 * (1 - discount / 100)) : tier.price" : "tier.price"}}
                    </>
                  ) : (
                    tier.price
                  )}
                </span>
                {typeof tier.price === "number" && tier.period && (
                  <span className="text-muted-foreground">
                    /{${config.showToggle ? "isAnnual ? 'year' : tier.period" : "tier.period"}}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="mt-8 flex-1 space-y-3">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
                {tier.notIncluded?.map((feature, featureIndex) => (
                  <li key={\`not-\${featureIndex}\`} className="flex items-center gap-2 opacity-50">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={cn(
                  "mt-8 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  tier.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border hover:bg-muted"
                )}
              >
                {tier.cta.text}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
`

  return {
    code,
    fileName: "PricingTable.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<PricingTable />`,
  }
}

// =============================================================================
// Testimonials Generator (#64)
// =============================================================================

/**
 * Generate testimonials section
 */
export function generateTestimonials(config: TestimonialConfig): SectionOutput {
  const code = `/**
 * Testimonials Section Component
 *
 * A ${config.layout} testimonials section.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const testimonials = ${JSON.stringify(config.testimonials, null, 2)}

export interface TestimonialsProps {
  /** Optional className override */
  className?: string
}

export function Testimonials({ className }: TestimonialsProps) {
  ${config.layout === "carousel" ? `const [activeIndex, setActiveIndex] = React.useState(0)

  const nextSlide = () => setActiveIndex((prev) => (prev + 1) % testimonials.length)
  const prevSlide = () => setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)

  ${config.autoPlay ? `React.useEffect(() => {
    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [])` : ""}` : ""}

  return (
    <section className={cn("w-full py-24 lg:py-32 bg-muted/50", className)}>
      <div className="container px-4 md:px-6">
        ${config.title || config.subtitle ? `{/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          ${config.title ? `<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ${config.title}
          </h2>` : ""}
          ${config.subtitle ? `<p className="mt-4 text-lg text-muted-foreground">
            ${config.subtitle}
          </p>` : ""}
        </div>` : ""}

        ${config.layout === "carousel" ? `{/* Carousel */}
        <div className="relative mx-auto max-w-4xl">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: \`translateX(-\${activeIndex * 100}%)\` }}
            >
              {testimonials.map((testimonial, index) => (
                <div key={index} className="w-full flex-shrink-0 px-4">
                  <div className="rounded-2xl bg-background p-8 shadow-lg">
                    ${config.showRatings ? `{/* Rating */}
                    {testimonial.rating && (
                      <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={cn("h-5 w-5", i < testimonial.rating ? "text-yellow-400" : "text-gray-300")}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    )}` : ""}

                    {/* Quote */}
                    <blockquote className="text-xl font-medium">"{testimonial.quote}"</blockquote>

                    {/* Author */}
                    <div className="mt-6 flex items-center gap-4">
                      {testimonial.avatar && (
                        <img
                          src={testimonial.avatar.src}
                          alt={testimonial.avatar.alt}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-semibold">{testimonial.author}</div>
                        {(testimonial.role || testimonial.company) && (
                          <div className="text-sm text-muted-foreground">
                            {testimonial.role}{testimonial.role && testimonial.company && ", "}{testimonial.company}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 rounded-full bg-background p-2 shadow-lg hover:bg-muted"
            aria-label="Previous testimonial"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 rounded-full bg-background p-2 shadow-lg hover:bg-muted"
            aria-label="Next testimonial"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="mt-8 flex justify-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  index === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
                aria-label={\`Go to testimonial \${index + 1}\`}
              />
            ))}
          </div>
        </div>` : `{/* Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="rounded-2xl bg-background p-8 shadow-lg">
              {/* Quote */}
              <blockquote className="text-lg">"{testimonial.quote}"</blockquote>

              {/* Author */}
              <div className="mt-6 flex items-center gap-4">
                {testimonial.avatar && (
                  <img
                    src={testimonial.avatar.src}
                    alt={testimonial.avatar.alt}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <div className="font-semibold">{testimonial.author}</div>
                  {(testimonial.role || testimonial.company) && (
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}{testimonial.role && testimonial.company && ", "}{testimonial.company}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>`}
      </div>
    </section>
  )
}
`

  return {
    code,
    fileName: "Testimonials.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<Testimonials />`,
  }
}

// =============================================================================
// Footer Generator (#65)
// =============================================================================

/**
 * Generate footer component
 */
export function generateFooter(config: FooterConfig): SectionOutput {
  const code = `/**
 * Footer Component
 *
 * Site footer with navigation, social links, and legal.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const columns = ${JSON.stringify(config.columns, null, 2)}
${config.social ? `const socialLinks = ${JSON.stringify(config.social, null, 2)}` : ""}
${config.legal ? `const legalLinks = ${JSON.stringify(config.legal, null, 2)}` : ""}

export interface FooterProps {
  /** Optional className override */
  className?: string
}

export function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("w-full border-t bg-background", className)}>
      <div className="container px-4 md:px-6 py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-${config.columns.length + 1}">
          {/* Brand */}
          <div className="lg:col-span-1">
            ${config.logo ? `<img
              src="${config.logo.src}"
              alt="${config.logo.alt}"
              className="h-8 w-auto"
            />` : `<span className="text-xl font-bold">${config.brand}</span>`}
            ${config.tagline ? `<p className="mt-4 text-sm text-muted-foreground">
              ${config.tagline}
            </p>` : ""}

            ${config.social ? `{/* Social Links */}
            <div className="mt-6 flex gap-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={social.label || social.platform}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* Social icon placeholder */}
                  <span className="sr-only">{social.platform}</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </a>
              ))}
            </div>` : ""}
          </div>

          {/* Link Columns */}
          {columns.map((column, index) => (
            <div key={index}>
              <h3 className="font-semibold mb-4">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          ${config.newsletter ? `{/* Newsletter */}
          <div>
            <h3 className="font-semibold mb-4">${config.newsletter.title}</h3>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="${config.newsletter.placeholder}"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                ${config.newsletter.buttonText}
              </button>
            </form>
          </div>` : ""}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            ${config.copyright || `© ${new Date().getFullYear()} ${config.brand}. All rights reserved.`}
          </p>

          ${config.legal ? `<div className="flex gap-6">
            {legalLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.text}
              </a>
            ))}
          </div>` : ""}
        </div>
      </div>
    </footer>
  )
}
`

  return {
    code,
    fileName: "Footer.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<Footer />`,
  }
}

// =============================================================================
// Dashboard Layout Generator (#66)
// =============================================================================

/**
 * Generate dashboard layout component
 */
export function generateDashboardLayout(config: DashboardLayoutConfig): SectionOutput {
  const code = `/**
 * Dashboard Layout Component
 *
 * A responsive dashboard layout with collapsible sidebar.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const sidebarItems = ${JSON.stringify(config.sidebarItems, null, 2)}

export interface DashboardLayoutProps {
  /** Page content */
  children: React.ReactNode
  /** Optional className override */
  className?: string
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(${!config.sidebarCollapsed})
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-card border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          ${config.brand?.logo ? `<img
            src="${config.brand.logo.src}"
            alt="${config.brand.logo.alt}"
            className={cn("h-8 transition-all", !sidebarOpen && "hidden")}
          />` : config.brand?.name ? `<span className={cn("font-bold", !sidebarOpen && "hidden")}>
            ${config.brand.name}
          </span>` : ""}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-2 rounded-md hover:bg-muted"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {sidebarItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className={cn("truncate", !sidebarOpen && "hidden")}>{item.label}</span>
              {item.badge !== undefined && sidebarOpen && (
                <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={cn("transition-all duration-300", sidebarOpen ? "lg:pl-64" : "lg:pl-16")}>
        ${config.showHeader !== false ? `{/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-muted"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          ${config.headerConfig?.showSearch ? `{/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search..."
                className="w-full rounded-md border bg-background pl-10 pr-4 py-2 text-sm"
              />
            </div>
          </div>` : "<div className='flex-1' />"}

          <div className="flex items-center gap-4">
            ${config.headerConfig?.showNotifications ? `{/* Notifications */}
            <button className="relative p-2 rounded-md hover:bg-muted">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </button>` : ""}

            ${config.headerConfig?.showUserMenu ? `{/* User Menu */}
            <button className="flex items-center gap-2 rounded-md p-2 hover:bg-muted">
              <div className="h-8 w-8 rounded-full bg-muted" />
            </button>` : ""}
          </div>
        </header>` : ""}

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
`

  return {
    code,
    fileName: "DashboardLayout.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<DashboardLayout>
  <h1>Dashboard Content</h1>
</DashboardLayout>`,
  }
}

// =============================================================================
// Data Table Generator (#67)
// =============================================================================

/**
 * Generate data table component
 */
export function generateDataTable(config: DataTableConfig): SectionOutput {
  const code = `/**
 * Data Table Component
 *
 * A feature-rich data table with sorting, filtering, and pagination.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const columns = ${JSON.stringify(config.columns, null, 2)}

export interface DataTableProps<T> {
  /** Table data */
  data: T[]
  /** Optional className override */
  className?: string
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  className,
}: DataTableProps<T>) {
  ${config.enableSorting ? `const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")` : ""}
  ${config.enableSearch ? `const [search, setSearch] = React.useState("")` : ""}
  ${config.enablePagination ? `const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(${config.pageSizes?.[0] || 10})` : ""}
  ${config.enableSelection ? `const [selected, setSelected] = React.useState<Set<number>>(new Set())` : ""}

  ${config.enableSorting ? `const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }` : ""}

  // Process data
  let processedData = [...data]

  ${config.enableSearch ? `// Filter by search
  if (search) {
    processedData = processedData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase())
      )
    )
  }` : ""}

  ${config.enableSorting ? `// Sort data
  if (sortKey) {
    processedData.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }` : ""}

  ${config.enablePagination ? `// Paginate
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice((page - 1) * pageSize, page * pageSize)` : "const paginatedData = processedData"}

  return (
    <div className={cn("w-full", className)}>
      ${config.enableSearch ? `{/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>` : ""}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              ${config.enableSelection ? `<th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === paginatedData.length && paginatedData.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(paginatedData.map((_, i) => i)))
                    } else {
                      setSelected(new Set())
                    }
                  }}
                  className="rounded border"
                />
              </th>` : ""}
              {columns.map((col, index) => (
                <th
                  key={index}
                  className={cn(
                    "px-4 py-3 text-left text-sm font-medium",
                    ${config.enableSorting ? "col.sortable && 'cursor-pointer hover:bg-muted'" : ""}
                  )}
                  ${config.enableSorting ? "onClick={() => col.sortable && handleSort(col.key)}" : ""}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    ${config.enableSorting ? `{col.sortable && sortKey === col.key && (
                      <svg className={cn("h-4 w-4", sortDir === "desc" && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}` : ""}
                  </div>
                </th>
              ))}
              ${config.actions ? `<th className="px-4 py-3 text-right text-sm font-medium">Actions</th>` : ""}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t hover:bg-muted/50">
                ${config.enableSelection ? `<td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(rowIndex)}
                    onChange={(e) => {
                      const newSelected = new Set(selected)
                      if (e.target.checked) {
                        newSelected.add(rowIndex)
                      } else {
                        newSelected.delete(rowIndex)
                      }
                      setSelected(newSelected)
                    }}
                    className="rounded border"
                  />
                </td>` : ""}
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-4 py-3 text-sm">
                    {String(row[col.key] ?? "")}
                  </td>
                ))}
                ${config.actions ? `<td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    ${config.actions.map((action, i) => `<button
                      key={${i}}
                      className={cn(
                        "px-3 py-1 text-xs rounded-md",
                        ${action.variant === "destructive" ? '"text-destructive hover:bg-destructive/10"' : '"hover:bg-muted"'}
                      )}
                    >
                      ${action.label}
                    </button>`).join("\n                    ")}
                  </div>
                </td>` : ""}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      ${config.enablePagination ? `{/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, processedData.length)} of {processedData.length} results
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            ${(config.pageSizes || [10, 20, 50]).map((size) => `<option value={${size}}>${size} per page</option>`).join("\n            ")}
          </select>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>` : ""}
    </div>
  )
}
`

  return {
    code,
    fileName: "DataTable.tsx",
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<DataTable data={[{ id: 1, name: "John" }]} />`,
  }
}

// =============================================================================
// Auth Forms Generator (#68)
// =============================================================================

/**
 * Generate auth form component
 */
export function generateAuthForm(config: AuthFormConfig): SectionOutput {
  const formTitle = config.type === "login" ? "Sign in to your account"
    : config.type === "signup" ? "Create your account"
    : config.type === "forgot-password" ? "Reset your password"
    : "Set a new password"

  const code = `/**
 * ${toPascalCase(config.type)} Form Component
 *
 * Authentication form with validation and OAuth support.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface AuthFormProps {
  /** Form submission handler */
  onSubmit?: (data: Record<string, string>) => void
  /** Optional className override */
  className?: string
}

export function AuthForm({ onSubmit, className }: AuthFormProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  ${config.showPasswordStrength && config.type === "signup" ? `const [password, setPassword] = React.useState("")

  const getPasswordStrength = (pwd: string) => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/\\d/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"]
  const strengthColors = ["bg-destructive", "bg-orange-500", "bg-yellow-500", "bg-green-500"]` : ""}

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries()) as Record<string, string>

    try {
      await onSubmit?.(data)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="rounded-2xl border bg-card p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">${formTitle}</h1>
          ${config.type === "login" ? `<p className="mt-2 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/signup" className="text-primary hover:underline">Sign up</a>
          </p>` : config.type === "signup" ? `<p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline">Sign in</a>
          </p>` : ""}
        </div>

        ${config.oauthProviders && config.oauthProviders.length > 0 ? `{/* OAuth Providers */}
        <div className="space-y-3 mb-6">
          ${config.oauthProviders.map((provider) => `<button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            {/* ${provider} icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Continue with ${toPascalCase(provider)}
          </button>`).join("\n          ")}
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>` : ""}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          ${config.type === "signup" ? `{/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="John Doe"
            />
          </div>` : ""}

          ${config.type !== "reset-password" ? `{/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>` : ""}

          ${config.type !== "forgot-password" ? `{/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              ${config.type === "login" ? `<a href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </a>` : ""}
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              ${config.showPasswordStrength && config.type === "signup" ? "value={password} onChange={(e) => setPassword(e.target.value)}" : ""}
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
            ${config.showPasswordStrength && config.type === "signup" ? `{password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: {strengthLabels[passwordStrength - 1] || "Too weak"}
                </p>
              </div>
            )}` : ""}
          </div>` : ""}

          ${config.type === "signup" || config.type === "reset-password" ? `{/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>` : ""}

          ${config.customFields?.map((field) => `{/* ${field.label} */}
          <div>
            <label htmlFor="${field.name}" className="block text-sm font-medium mb-2">
              ${field.label}
            </label>
            <input
              id="${field.name}"
              name="${field.name}"
              type="${field.type}"
              ${field.required ? "required" : ""}
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>`).join("\n          ") || ""}

          ${config.showRememberMe && config.type === "login" ? `{/* Remember Me */}
          <div className="flex items-center gap-2">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="rounded border"
            />
            <label htmlFor="remember" className="text-sm">
              Remember me
            </label>
          </div>` : ""}

          ${config.type === "signup" && config.legal ? `{/* Terms */}
          <div className="flex items-start gap-2">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="rounded border mt-1"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground">
              I agree to the{" "}
              <a href="${config.legal.termsHref}" className="text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="${config.legal.privacyHref}" className="text-primary hover:underline">Privacy Policy</a>
            </label>
          </div>` : ""}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Loading..." : "${config.type === "login" ? "Sign in" : config.type === "signup" ? "Create account" : config.type === "forgot-password" ? "Send reset link" : "Reset password"}"}
          </button>
        </form>
      </div>
    </div>
  )
}
`

  return {
    code,
    fileName: `${toPascalCase(config.type)}Form.tsx`,
    dependencies: ["react", "@/lib/utils"],
    exampleUsage: `<AuthForm onSubmit={(data) => console.log(data)} />`,
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Page section generator factory
 */
export function createPageSectionGenerator() {
  return {
    hero: generateHeroSection,
    featureGrid: generateFeatureGrid,
    pricing: generatePricingTable,
    testimonials: generateTestimonials,
    footer: generateFooter,
    dashboard: generateDashboardLayout,
    dataTable: generateDataTable,
    authForm: generateAuthForm,
  }
}
