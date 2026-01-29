/**
 * Platxa Frontend Agent Configuration
 *
 * This file configures the frontend agent for component generation,
 * theming, and brand kit integration.
 */

export interface FrontendConfig {
  theme: {
    preset: "default" | "minimal" | "vibrant"
    tokens?: {
      colors?: Record<string, string>
      typography?: Record<string, string>
      spacing?: Record<string, string>
    }
  }
  brand: {
    package: string
    autoSync: boolean
  }
  components: {
    outputDir: string
    naming: "kebab-case" | "PascalCase"
    includeTests: boolean
  }
  accessibility: {
    level: "A" | "AA" | "AAA"
    focusIndicators: boolean
    colorContrast: boolean
  }
}

export function defineFrontendConfig(config: FrontendConfig): FrontendConfig {
  return config
}

export default defineFrontendConfig({
  // Theme configuration
  theme: {
    preset: "default",
    tokens: {
      colors: {
        // Override with brand colors if needed
        // primary: "oklch(0.7 0.15 250)",
      },
      typography: {
        // fontFamily: { sans: "Inter, sans-serif" },
      },
    },
  },

  // Brand kit integration
  brand: {
    package: "@platxa/brand-kit",
    autoSync: true,
  },

  // Component generation settings
  components: {
    outputDir: "src/components/ui",
    naming: "kebab-case",
    includeTests: true,
  },

  // Accessibility settings
  accessibility: {
    level: "AA",
    focusIndicators: true,
    colorContrast: true,
  },
})
