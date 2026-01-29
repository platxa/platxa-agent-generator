/**
 * Page Sections Module Tests
 *
 * Tests for hero, feature grid, pricing, testimonials, footer,
 * dashboard layout, data table, and auth form generators.
 */

import { describe, it, expect } from "vitest"
import {
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
} from "../page-sections"
import type {
  HeroConfig,
  FeatureGridConfig,
  PricingTableConfig,
  TestimonialConfig,
  FooterConfig,
  DashboardLayoutConfig,
  DataTableConfig,
  AuthFormConfig,
} from "../page-sections"

// =============================================================================
// Hero Section (#61)
// =============================================================================

describe("Hero Section Generator", () => {
  describe("HERO_LAYOUTS", () => {
    it("should have all layout variants", () => {
      expect(HERO_LAYOUTS.centered).toBeDefined()
      expect(HERO_LAYOUTS.split).toBeDefined()
      expect(HERO_LAYOUTS["split-reverse"]).toBeDefined()
      expect(HERO_LAYOUTS["background-image"]).toBeDefined()
    })

    it("should have containerClass and contentClass for each layout", () => {
      Object.values(HERO_LAYOUTS).forEach((layout) => {
        expect(layout.containerClass).toBeDefined()
        expect(layout.contentClass).toBeDefined()
      })
    })
  })

  describe("generateHeroSection", () => {
    it("should generate centered hero section", () => {
      const config: HeroConfig = {
        layout: "centered",
        headline: "Build something amazing",
        subheadline: "The best way to create modern web apps",
      }
      const result = generateHeroSection(config)

      expect(result.code).toContain("HeroSection")
      expect(result.code).toContain("Build something amazing")
      expect(result.code).toContain("The best way to create modern web apps")
      expect(result.fileName).toBe("HeroSection.tsx")
    })

    it("should generate split hero with image", () => {
      const config: HeroConfig = {
        layout: "split",
        headline: "Welcome",
        image: {
          src: "/hero.png",
          alt: "Hero image",
        },
      }
      const result = generateHeroSection(config)

      expect(result.code).toContain("/hero.png")
      expect(result.code).toContain("Hero image")
    })

    it("should include CTAs when provided", () => {
      const config: HeroConfig = {
        layout: "centered",
        headline: "Test",
        ctas: [
          { text: "Get Started", href: "/signup", variant: "primary" },
          { text: "Learn More", href: "/about", variant: "outline" },
        ],
      }
      const result = generateHeroSection(config)

      expect(result.code).toContain("Get Started")
      expect(result.code).toContain("Learn More")
      expect(result.code).toContain("/signup")
    })

    it("should include badge when provided", () => {
      const config: HeroConfig = {
        layout: "centered",
        headline: "Test",
        badge: "New Release",
      }
      const result = generateHeroSection(config)

      expect(result.code).toContain("New Release")
    })

    it("should handle background image layout", () => {
      const config: HeroConfig = {
        layout: "background-image",
        headline: "Test",
        background: {
          type: "image",
          value: "/bg.jpg",
        },
      }
      const result = generateHeroSection(config)

      expect(result.code).toContain("/bg.jpg")
      expect(result.code).toContain("Overlay")
    })

    it("should return correct dependencies", () => {
      const config: HeroConfig = {
        layout: "centered",
        headline: "Test",
      }
      const result = generateHeroSection(config)

      expect(result.dependencies).toContain("react")
      expect(result.dependencies).toContain("@/lib/utils")
    })
  })
})

// =============================================================================
// Feature Grid (#62)
// =============================================================================

describe("Feature Grid Generator", () => {
  const baseConfig: FeatureGridConfig = {
    layout: "grid-3",
    features: [
      { title: "Feature 1", description: "Description 1", icon: "icon1" },
      { title: "Feature 2", description: "Description 2", icon: "icon2" },
      { title: "Feature 3", description: "Description 3", icon: "icon3" },
    ],
  }

  it("should generate feature grid component", () => {
    const result = generateFeatureGrid(baseConfig)

    expect(result.code).toContain("FeatureGrid")
    expect(result.code).toContain("Feature 1")
    expect(result.code).toContain("Feature 2")
    expect(result.code).toContain("Feature 3")
    expect(result.fileName).toBe("FeatureGrid.tsx")
  })

  it("should include section title and subtitle", () => {
    const config: FeatureGridConfig = {
      ...baseConfig,
      title: "Our Features",
      subtitle: "Everything you need",
    }
    const result = generateFeatureGrid(config)

    expect(result.code).toContain("Our Features")
    expect(result.code).toContain("Everything you need")
  })

  it("should apply correct grid columns for layout", () => {
    const layouts: Array<FeatureGridConfig["layout"]> = ["grid-2", "grid-3", "grid-4"]

    layouts.forEach((layout) => {
      const result = generateFeatureGrid({ ...baseConfig, layout })
      expect(result.code).toContain("grid")
    })
  })

  it("should apply card styles", () => {
    const result = generateFeatureGrid({
      ...baseConfig,
      cardStyle: "elevated",
    })

    expect(result.code).toContain("shadow-lg")
  })

  it("should hide icons when showIcons is false", () => {
    const result = generateFeatureGrid({
      ...baseConfig,
      showIcons: false,
    })

    // When icons are hidden, icon rendering is omitted
    expect(result.code).not.toContain("Icon placeholder")
  })
})

// =============================================================================
// Pricing Table (#63)
// =============================================================================

describe("Pricing Table Generator", () => {
  const baseConfig: PricingTableConfig = {
    tiers: [
      {
        name: "Free",
        price: 0,
        period: "month",
        features: ["Feature 1", "Feature 2"],
        cta: { text: "Get Started" },
      },
      {
        name: "Pro",
        price: 29,
        period: "month",
        features: ["Feature 1", "Feature 2", "Feature 3"],
        cta: { text: "Subscribe" },
        popular: true,
        badge: "Most Popular",
      },
    ],
  }

  it("should generate pricing table component", () => {
    const result = generatePricingTable(baseConfig)

    expect(result.code).toContain("PricingTable")
    expect(result.code).toContain("Free")
    expect(result.code).toContain("Pro")
    expect(result.fileName).toBe("PricingTable.tsx")
  })

  it("should include section header when provided", () => {
    const config: PricingTableConfig = {
      ...baseConfig,
      title: "Simple Pricing",
      subtitle: "Choose the plan that works for you",
    }
    const result = generatePricingTable(config)

    expect(result.code).toContain("Simple Pricing")
    expect(result.code).toContain("Choose the plan")
  })

  it("should show billing toggle when enabled", () => {
    const config: PricingTableConfig = {
      ...baseConfig,
      showToggle: true,
      annualDiscount: 20,
    }
    const result = generatePricingTable(config)

    expect(result.code).toContain("Monthly")
    expect(result.code).toContain("Annual")
    expect(result.code).toContain("isAnnual")
  })

  it("should highlight popular tier", () => {
    const result = generatePricingTable(baseConfig)

    expect(result.code).toContain("tier.popular")
    expect(result.code).toContain("Most Popular")
  })

  it("should show features and not included items", () => {
    const config: PricingTableConfig = {
      tiers: [
        {
          name: "Basic",
          price: 10,
          features: ["Included feature"],
          notIncluded: ["Not included"],
          cta: { text: "Start" },
        },
      ],
    }
    const result = generatePricingTable(config)

    expect(result.code).toContain("Included feature")
    expect(result.code).toContain("notIncluded")
  })

  it("should use custom currency", () => {
    const config: PricingTableConfig = {
      ...baseConfig,
      currency: "€",
    }
    const result = generatePricingTable(config)

    expect(result.code).toContain("€")
  })
})

// =============================================================================
// Testimonials (#64)
// =============================================================================

describe("Testimonials Generator", () => {
  const baseConfig: TestimonialConfig = {
    layout: "carousel",
    testimonials: [
      {
        quote: "Amazing product!",
        author: "John Doe",
        role: "CEO",
        company: "Acme Inc",
      },
      {
        quote: "Changed our workflow",
        author: "Jane Smith",
        role: "CTO",
        company: "Tech Co",
      },
    ],
  }

  it("should generate testimonials component", () => {
    const result = generateTestimonials(baseConfig)

    expect(result.code).toContain("Testimonials")
    expect(result.code).toContain("Amazing product!")
    expect(result.code).toContain("John Doe")
    expect(result.fileName).toBe("Testimonials.tsx")
  })

  it("should generate carousel layout with navigation", () => {
    const result = generateTestimonials(baseConfig)

    expect(result.code).toContain("activeIndex")
    expect(result.code).toContain("nextSlide")
    expect(result.code).toContain("prevSlide")
  })

  it("should generate grid layout", () => {
    const config: TestimonialConfig = {
      ...baseConfig,
      layout: "grid",
    }
    const result = generateTestimonials(config)

    expect(result.code).toContain("grid")
    expect(result.code).not.toContain("activeIndex")
  })

  it("should show ratings when enabled", () => {
    const config: TestimonialConfig = {
      ...baseConfig,
      showRatings: true,
      testimonials: [
        {
          quote: "Great!",
          author: "Test",
          rating: 5,
        },
      ],
    }
    const result = generateTestimonials(config)

    expect(result.code).toContain("rating")
    expect(result.code).toContain("text-yellow-400")
  })

  it("should enable autoplay when configured", () => {
    const config: TestimonialConfig = {
      ...baseConfig,
      autoPlay: true,
    }
    const result = generateTestimonials(config)

    expect(result.code).toContain("setInterval")
  })

  it("should include author details", () => {
    const result = generateTestimonials(baseConfig)

    expect(result.code).toContain("CEO")
    expect(result.code).toContain("Acme Inc")
  })
})

// =============================================================================
// Footer (#65)
// =============================================================================

describe("Footer Generator", () => {
  const baseConfig: FooterConfig = {
    brand: "MyCompany",
    columns: [
      {
        title: "Product",
        links: [
          { text: "Features", href: "/features" },
          { text: "Pricing", href: "/pricing" },
        ],
      },
      {
        title: "Company",
        links: [
          { text: "About", href: "/about" },
          { text: "Blog", href: "/blog" },
        ],
      },
    ],
  }

  it("should generate footer component", () => {
    const result = generateFooter(baseConfig)

    expect(result.code).toContain("Footer")
    expect(result.code).toContain("MyCompany")
    expect(result.fileName).toBe("Footer.tsx")
  })

  it("should include link columns", () => {
    const result = generateFooter(baseConfig)

    expect(result.code).toContain("Product")
    expect(result.code).toContain("Company")
    expect(result.code).toContain("/features")
    expect(result.code).toContain("/pricing")
  })

  it("should include tagline when provided", () => {
    const config: FooterConfig = {
      ...baseConfig,
      tagline: "Building the future",
    }
    const result = generateFooter(config)

    expect(result.code).toContain("Building the future")
  })

  it("should include social links", () => {
    const config: FooterConfig = {
      ...baseConfig,
      social: [
        { platform: "twitter", href: "https://twitter.com/test" },
        { platform: "github", href: "https://github.com/test" },
      ],
    }
    const result = generateFooter(config)

    expect(result.code).toContain("socialLinks")
    expect(result.code).toContain("twitter")
  })

  it("should include newsletter signup", () => {
    const config: FooterConfig = {
      ...baseConfig,
      newsletter: {
        title: "Subscribe",
        placeholder: "Enter email",
        buttonText: "Join",
      },
    }
    const result = generateFooter(config)

    expect(result.code).toContain("Subscribe")
    expect(result.code).toContain("Enter email")
    expect(result.code).toContain("Join")
  })

  it("should include legal links", () => {
    const config: FooterConfig = {
      ...baseConfig,
      legal: [
        { text: "Privacy", href: "/privacy" },
        { text: "Terms", href: "/terms" },
      ],
    }
    const result = generateFooter(config)

    expect(result.code).toContain("legalLinks")
    expect(result.code).toContain("Privacy")
  })

  it("should include custom copyright", () => {
    const config: FooterConfig = {
      ...baseConfig,
      copyright: "© 2026 Custom Copyright",
    }
    const result = generateFooter(config)

    expect(result.code).toContain("© 2026 Custom Copyright")
  })
})

// =============================================================================
// Dashboard Layout (#66)
// =============================================================================

describe("Dashboard Layout Generator", () => {
  const baseConfig: DashboardLayoutConfig = {
    sidebarItems: [
      { label: "Dashboard", icon: "home", href: "/" },
      { label: "Users", icon: "users", href: "/users", badge: 5 },
      { label: "Settings", icon: "settings", href: "/settings" },
    ],
  }

  it("should generate dashboard layout component", () => {
    const result = generateDashboardLayout(baseConfig)

    expect(result.code).toContain("DashboardLayout")
    expect(result.code).toContain("Dashboard")
    expect(result.code).toContain("Users")
    expect(result.fileName).toBe("DashboardLayout.tsx")
  })

  it("should include collapsible sidebar", () => {
    const result = generateDashboardLayout(baseConfig)

    expect(result.code).toContain("sidebarOpen")
    expect(result.code).toContain("setSidebarOpen")
  })

  it("should include mobile menu toggle", () => {
    const result = generateDashboardLayout(baseConfig)

    expect(result.code).toContain("mobileOpen")
    expect(result.code).toContain("lg:hidden")
  })

  it("should show badge counts", () => {
    const result = generateDashboardLayout(baseConfig)

    expect(result.code).toContain("item.badge")
  })

  it("should include brand when provided", () => {
    const config: DashboardLayoutConfig = {
      ...baseConfig,
      brand: {
        name: "MyApp",
      },
    }
    const result = generateDashboardLayout(config)

    expect(result.code).toContain("MyApp")
  })

  it("should include header features", () => {
    const config: DashboardLayoutConfig = {
      ...baseConfig,
      headerConfig: {
        showSearch: true,
        showNotifications: true,
        showUserMenu: true,
      },
    }
    const result = generateDashboardLayout(config)

    expect(result.code).toContain("Search")
    expect(result.code).toContain("Notifications")
    expect(result.code).toContain("User Menu")
  })

  it("should start collapsed when configured", () => {
    const config: DashboardLayoutConfig = {
      ...baseConfig,
      sidebarCollapsed: true,
    }
    const result = generateDashboardLayout(config)

    expect(result.code).toContain("useState(false)")
  })
})

// =============================================================================
// Data Table (#67)
// =============================================================================

describe("Data Table Generator", () => {
  const baseConfig: DataTableConfig = {
    columns: [
      { key: "id", header: "ID", sortable: true },
      { key: "name", header: "Name", sortable: true },
      { key: "email", header: "Email" },
    ],
  }

  it("should generate data table component", () => {
    const result = generateDataTable(baseConfig)

    expect(result.code).toContain("DataTable")
    expect(result.code).toContain("ID")
    expect(result.code).toContain("Name")
    expect(result.fileName).toBe("DataTable.tsx")
  })

  it("should include sorting when enabled", () => {
    const config: DataTableConfig = {
      ...baseConfig,
      enableSorting: true,
    }
    const result = generateDataTable(config)

    expect(result.code).toContain("sortKey")
    expect(result.code).toContain("sortDir")
    expect(result.code).toContain("handleSort")
  })

  it("should include search when enabled", () => {
    const config: DataTableConfig = {
      ...baseConfig,
      enableSearch: true,
    }
    const result = generateDataTable(config)

    expect(result.code).toContain("search")
    expect(result.code).toContain("setSearch")
    expect(result.code).toContain('placeholder="Search..."')
  })

  it("should include pagination when enabled", () => {
    const config: DataTableConfig = {
      ...baseConfig,
      enablePagination: true,
      pageSizes: [10, 20, 50],
    }
    const result = generateDataTable(config)

    expect(result.code).toContain("page")
    expect(result.code).toContain("pageSize")
    expect(result.code).toContain("Previous")
    expect(result.code).toContain("Next")
  })

  it("should include row selection when enabled", () => {
    const config: DataTableConfig = {
      ...baseConfig,
      enableSelection: true,
    }
    const result = generateDataTable(config)

    expect(result.code).toContain("selected")
    expect(result.code).toContain('type="checkbox"')
  })

  it("should include actions column when provided", () => {
    const config: DataTableConfig = {
      ...baseConfig,
      actions: [
        { label: "Edit", icon: "edit" },
        { label: "Delete", variant: "destructive" },
      ],
    }
    const result = generateDataTable(config)

    expect(result.code).toContain("Actions")
    expect(result.code).toContain("Edit")
    expect(result.code).toContain("Delete")
  })
})

// =============================================================================
// Auth Forms (#68)
// =============================================================================

describe("Auth Form Generator", () => {
  it("should generate login form", () => {
    const config: AuthFormConfig = {
      type: "login",
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Sign in to your account")
    expect(result.code).toContain("Email")
    expect(result.code).toContain("Sign in")
    expect(result.fileName).toBe("LoginForm.tsx")
  })

  it("should generate signup form", () => {
    const config: AuthFormConfig = {
      type: "signup",
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Create your account")
    expect(result.code).toContain("Full name")
    expect(result.code).toContain("Create account")
    expect(result.fileName).toBe("SignupForm.tsx")
  })

  it("should generate forgot form", () => {
    const config: AuthFormConfig = {
      type: "forgot-password",
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Reset your")
    expect(result.code).toContain("Email")
    expect(result.code).toContain("Send reset link")
  })

  it("should generate reset form", () => {
    const config: AuthFormConfig = {
      type: "reset-password",
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Set a new")
    expect(result.code).toContain("Confirm")
  })

  it("should include OAuth providers", () => {
    const config: AuthFormConfig = {
      type: "login",
      oauthProviders: ["google", "github"],
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Continue with Google")
    expect(result.code).toContain("Continue with Github")
    expect(result.code).toContain("Or continue with email")
  })

  it("should include remember me checkbox for login", () => {
    const config: AuthFormConfig = {
      type: "login",
      showRememberMe: true,
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Remember me")
  })

  it("should include strength indicator for signup", () => {
    const config: AuthFormConfig = {
      type: "signup",
      showPasswordStrength: true,
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("getPasswordStrength")
    expect(result.code).toContain("strengthLabels")
    expect(result.code).toContain("Too weak")
  })

  it("should include terms and privacy for signup", () => {
    const config: AuthFormConfig = {
      type: "signup",
      legal: {
        termsHref: "/terms",
        privacyHref: "/privacy",
      },
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Terms of Service")
    expect(result.code).toContain("Privacy Policy")
    expect(result.code).toContain("/terms")
    expect(result.code).toContain("/privacy")
  })

  it("should include custom fields for signup", () => {
    const config: AuthFormConfig = {
      type: "signup",
      customFields: [
        { name: "phone", label: "Phone Number", type: "tel", required: true },
      ],
    }
    const result = generateAuthForm(config)

    expect(result.code).toContain("Phone Number")
    expect(result.code).toContain('type="tel"')
  })
})

// =============================================================================
// Factory Function
// =============================================================================

describe("createPageSectionGenerator", () => {
  it("should return all generator functions", () => {
    const generator = createPageSectionGenerator()

    expect(typeof generator.hero).toBe("function")
    expect(typeof generator.featureGrid).toBe("function")
    expect(typeof generator.pricing).toBe("function")
    expect(typeof generator.testimonials).toBe("function")
    expect(typeof generator.footer).toBe("function")
    expect(typeof generator.dashboard).toBe("function")
    expect(typeof generator.dataTable).toBe("function")
    expect(typeof generator.authForm).toBe("function")
  })

  it("should generate sections using factory", () => {
    const generator = createPageSectionGenerator()

    const hero = generator.hero({
      layout: "centered",
      headline: "Test",
    })
    expect(hero.code).toContain("HeroSection")

    const pricing = generator.pricing({
      tiers: [{ name: "Free", price: 0, features: [], cta: { text: "Start" } }],
    })
    expect(pricing.code).toContain("PricingTable")
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("Page Sections Integration", () => {
  it("should generate a complete landing page set", () => {
    const generator = createPageSectionGenerator()

    const hero = generator.hero({
      layout: "centered",
      headline: "Welcome",
      ctas: [{ text: "Get Started" }],
    })

    const features = generator.featureGrid({
      layout: "grid-3",
      title: "Features",
      features: [
        { title: "Fast", description: "Lightning fast", icon: "zap" },
        { title: "Secure", description: "Bank-grade security", icon: "shield" },
        { title: "Simple", description: "Easy to use", icon: "smile" },
      ],
    })

    const pricing = generator.pricing({
      title: "Pricing",
      tiers: [
        { name: "Free", price: 0, features: ["Basic"], cta: { text: "Start" } },
        { name: "Pro", price: 29, features: ["All"], cta: { text: "Subscribe" }, popular: true },
      ],
    })

    const testimonials = generator.testimonials({
      layout: "carousel",
      testimonials: [
        { quote: "Amazing!", author: "User" },
      ],
    })

    const footer = generator.footer({
      brand: "MyApp",
      columns: [{ title: "Links", links: [{ text: "Home", href: "/" }] }],
    })

    // All sections should generate valid code
    expect(hero.code).toContain("export function HeroSection")
    expect(features.code).toContain("export function FeatureGrid")
    expect(pricing.code).toContain("export function PricingTable")
    expect(testimonials.code).toContain("export function Testimonials")
    expect(footer.code).toContain("export function Footer")
  })

  it("should generate dashboard with data table", () => {
    const generator = createPageSectionGenerator()

    const dashboard = generator.dashboard({
      sidebarItems: [
        { label: "Home", icon: "home", href: "/" },
        { label: "Data", icon: "table", href: "/data" },
      ],
      headerConfig: {
        showSearch: true,
      },
    })

    const table = generator.dataTable({
      columns: [
        { key: "id", header: "ID", sortable: true },
        { key: "name", header: "Name", sortable: true },
      ],
      enableSorting: true,
      enablePagination: true,
    })

    expect(dashboard.code).toContain("DashboardLayout")
    expect(dashboard.code).toContain("children")
    expect(table.code).toContain("DataTable")
    expect(table.code).toContain("sortKey")
  })

  it("should generate auth flow pages", () => {
    const generator = createPageSectionGenerator()

    const login = generator.authForm({
      type: "login",
      oauthProviders: ["google"],
      showRememberMe: true,
    })

    const signup = generator.authForm({
      type: "signup",
      oauthProviders: ["google"],
      showPasswordStrength: true,
      legal: { termsHref: "/terms", privacyHref: "/privacy" },
    })

    const forgotForm = generator.authForm({
      type: "forgot-password",
    })

    expect(login.code).toContain("Sign in")
    expect(signup.code).toContain("Create account")
    expect(forgotForm.code).toContain("Send reset link")
  })
})
