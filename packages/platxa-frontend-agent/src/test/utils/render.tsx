/**
 * Custom Test Render Utilities (Feature #17)
 *
 * Provides a custom render function that wraps components with all
 * necessary providers for consistent testing.
 *
 * @example
 * ```tsx
 * import { render, screen } from "@/test/utils/render"
 *
 * test("renders with brand context", () => {
 *   render(<MyComponent />)
 *   expect(screen.getByText("Hello")).toBeInTheDocument()
 * })
 * ```
 *
 * @module test/utils/render
 */

import * as React from "react"
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react"
import { BrandProvider } from "@/components/brand/BrandProvider"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for custom render function
 */
export interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /**
   * Brand package to load (optional)
   */
  brandPackage?: string
  /**
   * Initial theme mode
   */
  theme?: "light" | "dark"
  /**
   * Additional wrapper component
   */
  wrapper?: React.ComponentType<{ children: React.ReactNode }>
}

// =============================================================================
// PROVIDERS
// =============================================================================

/**
 * Creates a wrapper with all necessary providers
 */
function createWrapper(options: CustomRenderOptions = {}) {
  const { brandPackage, theme = "light", wrapper: CustomWrapper } = options

  return function Wrapper({ children }: { children: React.ReactNode }) {
    // Apply theme class to document for testing
    React.useEffect(() => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
      return () => {
        document.documentElement.classList.remove("dark")
      }
    }, [])

    let content = (
      <BrandProvider brandPackage={brandPackage}>
        {children}
      </BrandProvider>
    )

    // Wrap with custom wrapper if provided
    if (CustomWrapper) {
      content = <CustomWrapper>{content}</CustomWrapper>
    }

    return content
  }
}

// =============================================================================
// CUSTOM RENDER
// =============================================================================

/**
 * Custom render function that wraps components with providers
 *
 * @param ui - Component to render
 * @param options - Render options including provider configuration
 * @returns Render result with additional utilities
 *
 * @example Basic usage
 * ```tsx
 * const { getByRole } = render(<Button>Click</Button>)
 * ```
 *
 * @example With brand package
 * ```tsx
 * render(<BrandedComponent />, { brandPackage: "@acme/brand-kit" })
 * ```
 *
 * @example With dark theme
 * ```tsx
 * render(<ThemeAwareComponent />, { theme: "dark" })
 * ```
 */
function customRender(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { brandPackage, theme, wrapper, ...renderOptions } = options

  return rtlRender(ui, {
    wrapper: createWrapper({ brandPackage, theme, wrapper }),
    ...renderOptions,
  })
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Renders component without any providers
 * Use for testing components in isolation
 */
function renderWithoutProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  return rtlRender(ui, options)
}

/**
 * Wait for async brand loading to complete
 */
async function waitForBrandLoad(): Promise<void> {
  // Brand loading is typically fast, but we give it time
  await new Promise((resolve) => setTimeout(resolve, 50))
}

/**
 * Create a mock brand kit for testing
 */
function createMockBrandKit() {
  return {
    name: "test-brand",
    colors: {
      primitives: {
        gray: Array.from({ length: 12 }, (_, i) => `oklch(${0.95 - i * 0.07} 0.01 250)`),
        primary: Array.from({ length: 12 }, (_, i) => `oklch(${0.95 - i * 0.06} 0.15 250)`),
      },
      semantic: {
        background: "gray.1",
        foreground: "gray.12",
        primary: "primary.9",
        primaryForeground: "primary.1",
      },
    },
    typography: {
      fontFamily: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace",
      },
    },
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export everything from @testing-library/react
export * from "@testing-library/react"

// Export custom render as default render
export { customRender as render }

// Export additional utilities
export {
  renderWithoutProviders,
  waitForBrandLoad,
  createMockBrandKit,
  createWrapper,
}
