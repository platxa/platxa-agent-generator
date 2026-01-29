# Brand Kit Operations

Comprehensive skill for creating, managing, and validating brand kits using the theme worker system.

## Overview

Brand kits define the complete visual identity of an application:
- Semantic colors (primary, secondary, background, etc.)
- Typography scale and font families
- Spacing and radius scales
- Dark mode variants
- Inheritance and extension

## Token Reference

### Semantic Colors

```typescript
interface SemanticColors {
  primary: ColorValue           // Main brand color
  primaryForeground: ColorValue // Text on primary
  secondary: ColorValue         // Secondary actions
  secondaryForeground: ColorValue
  muted: ColorValue            // Subtle backgrounds
  mutedForeground: ColorValue
  accent: ColorValue           // Highlights
  accentForeground: ColorValue
  destructive: ColorValue      // Errors, warnings
  destructiveForeground: ColorValue
  background: ColorValue       // Page background
  foreground: ColorValue       // Default text
  card: ColorValue             // Card backgrounds
  cardForeground: ColorValue
  popover: ColorValue          // Popover backgrounds
  popoverForeground: ColorValue
  border: ColorValue           // Default borders
  input: ColorValue            // Input borders
  ring: ColorValue             // Focus rings
}
```

### Typography Scale

```typescript
interface TypographyScale {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" }
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" }
  base: { fontSize: "1rem", lineHeight: "1.5rem" }
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" }
  xl: { fontSize: "1.25rem", lineHeight: "1.75rem" }
  "2xl": { fontSize: "1.5rem", lineHeight: "2rem" }
  "3xl": { fontSize: "1.875rem", lineHeight: "2.25rem" }
  "4xl": { fontSize: "2.25rem", lineHeight: "2.5rem" }
  // ... up to 9xl
}
```

### Spacing Scale

```typescript
interface SpacingScale {
  px: "1px"
  0: "0px"
  0.5: "0.125rem"   // 2px
  1: "0.25rem"      // 4px
  2: "0.5rem"       // 8px
  3: "0.75rem"      // 12px
  4: "1rem"         // 16px
  6: "1.5rem"       // 24px
  8: "2rem"         // 32px
  12: "3rem"        // 48px
  16: "4rem"        // 64px
  // ... up to 96
}
```

### Radius Scale

```typescript
interface RadiusScale {
  none: "0"
  sm: "0.125rem"
  default: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  "2xl": "1rem"
  "3xl": "1.5rem"
  full: "9999px"
}
```

## Core Operations

### Create a Brand Kit

```typescript
import {
  createTheme,
  generateTheme,
  defaultTokens
} from "@platxa/frontend-agent/theme"

// Create from scratch
const myBrand = createTheme("my-brand", {
  primaryHue: 250,        // Blue-ish
  saturation: "high",
  useOklch: true
})

// Create with full control
const customBrand: ThemeConfig = {
  name: "custom-brand",
  light: {
    colors: {
      primary: "oklch(0.6 0.2 250)",
      primaryForeground: "oklch(0.98 0 0)",
      secondary: "oklch(0.8 0.05 250)",
      secondaryForeground: "oklch(0.2 0 0)",
      background: "oklch(0.98 0 0)",
      foreground: "oklch(0.1 0 0)",
      // ... other semantic colors
    },
    spacing: defaultTokens.spacing,
    typography: defaultTokens.typography,
    fontWeight: defaultTokens.fontWeight,
    radius: defaultTokens.radius,
    shadow: defaultTokens.shadow,
  },
  dark: {
    primary: "oklch(0.7 0.18 250)",
    background: "oklch(0.15 0.02 250)",
    foreground: "oklch(0.95 0 0)",
    // Only override colors that change in dark mode
  },
  defaultMode: "system",
}

// Generate CSS and Tailwind theme
const { css, tailwindTheme, cssVariables } = generateTheme(customBrand)
```

### Extend Existing Brand

```typescript
import { extendBrand, defaultTheme } from "@platxa/frontend-agent/theme"

// Extend with partial overrides
const childBrand = extendBrand(defaultTheme, {
  name: "child-brand",
  light: {
    colors: {
      primary: "oklch(0.55 0.25 280)",  // Purple
      accent: "oklch(0.7 0.2 50)",       // Orange
    },
  },
})

// Using inheritance chain
const inheritedBrand: ThemeConfig = {
  name: "inherited-brand",
  extends: defaultTheme,  // or "default" for registry lookup
  light: {
    colors: {
      primary: "oklch(0.5 0.2 145)",  // Green
    },
  },
}

// Resolve inheritance
import { resolveBrandInheritance } from "@platxa/frontend-agent/theme"
const { resolved, chain, warnings } = resolveBrandInheritance(inheritedBrand)
```

### Validate Brand Kit

```typescript
import {
  validateTheme,
  validateBrandCompliance,
  generateWcagReport,
  checkBrandKitCircularReferences,
  validateBrandKitSize
} from "@platxa/frontend-agent/theme"

// Basic validation
const validation = validateTheme(myBrand)
if (!validation.valid) {
  console.error("Missing fields:", validation.missing)
}

// WCAG accessibility check
const wcagReport = generateWcagReport(myBrand)
console.log("AA compliance:", wcagReport.passesAA)
console.log("AAA compliance:", wcagReport.passesAAA)

// Check for circular references
const circularCheck = checkBrandKitCircularReferences(myBrand)
if (circularCheck.hasCircularReferences) {
  console.error("Circular refs:", circularCheck.cycles)
}

// Size validation
const sizeCheck = validateBrandKitSize(myBrand, {
  maxTotalBytes: 50000,
  maxColorsBytes: 10000,
})
if (!sizeCheck.isUnderLimit) {
  console.warn("Brand kit too large:", sizeCheck.breakdown)
}
```

### AI Color Suggestions

```typescript
import {
  suggestColors,
  suggestAccessiblePair,
  analyzePalette,
  getComponentColorRecommendations
} from "@platxa/frontend-agent/theme"

// Analyze existing palette
const analysis = analyzePalette(myBrand)
console.log("Temperature:", analysis.temperature)  // "warm" | "cool" | "neutral"
console.log("Harmony:", analysis.harmony)          // "monochromatic" | "analogous" | etc.

// Suggest colors for a use case
const suggestions = suggestColors({
  useCase: "button",
  palette: myBrand,
  backgroundColor: "oklch(0.98 0 0)",
  minContrast: 4.5,
  preferSemantic: true,
})

// Get accessible foreground for background
const fg = suggestAccessiblePair("oklch(0.25 0.1 250)", myBrand, 4.5)
console.log("Suggested:", fg.color, "Contrast:", fg.contrastRatio)

// Get coordinated colors for component
const buttonColors = getComponentColorRecommendations("button", myBrand)
// { background, text, hover, focusRing }
```

### Brand Compliance Validation

```typescript
import {
  validateBrandCompliance,
  formatBrandValidationReport,
  suggestBrandFixes
} from "@platxa/frontend-agent/theme"

// Validate component styles against brand
const result = validateBrandCompliance(
  {
    backgroundColor: "#ff0000",
    color: "#ffffff",
    fontSize: "15px",
    padding: "10px",
  },
  myBrand
)

console.log("Score:", result.score)  // 0-100
console.log("Valid:", result.isValid)
console.log("Errors:", result.summary.errors)

// Get formatted report
const report = formatBrandValidationReport(result)
console.log(report)

// Get suggested fixes
const fixes = suggestBrandFixes(result.violations)
// { backgroundColor: "oklch(...)", fontSize: "1rem", ... }
```

## Integration Patterns

### Next.js Integration

```typescript
import {
  generateNextMetadata,
  generateSSRHeadContent,
  getServerThemeTokens
} from "@platxa/frontend-agent/theme"

// In layout.tsx
export const metadata = generateNextMetadata(myBrand, {
  includeViewport: true,
  includeColorScheme: true
})

// Server-side theme tokens
const tokens = getServerThemeTokens(myBrand)

// SSR head content (CSS + init script)
const headContent = generateSSRHeadContent(myBrand, {
  defaultMode: "system",
  nonce: cspNonce
})
```

### Tailwind v4 Integration

```typescript
import {
  generateTailwindThemeDirective,
  generateTailwindV4Css,
  generateTailwindPlugin
} from "@platxa/frontend-agent/theme"

// Generate @theme directive
const directive = generateTailwindThemeDirective(myBrand)
// { content: "@theme { --color-primary: ...; }", colors: {...}, ... }

// Generate complete CSS file
const css = generateTailwindV4Css(myBrand, { darkMode: true })
// @import "tailwindcss"; @theme { ... }

// Generate plugin (for JS config)
const plugin = generateTailwindPlugin(myBrand)
```

### Monorepo Support

```typescript
import {
  generateMonorepoConfig,
  createBrandKitPackage,
  generateBrandKitImport
} from "@platxa/frontend-agent/theme"

// Generate monorepo configuration
const config = generateMonorepoConfig({
  root: "/path/to/monorepo",
  packages: ["packages/*", "apps/*"],
  packageManager: "pnpm"
})

// Create shareable brand kit package
const packageJson = createBrandKitPackage(myBrand, {
  name: "@myorg/brand-kit",
  version: "1.0.0"
})

// Generate import for consuming packages
const importCode = generateBrandKitImport("@myorg/brand-kit")
```

## Build-Time Processing

```typescript
import {
  buildStaticTheme,
  generateStaticCss,
  generateCriticalCss,
  processThemeForBuild
} from "@platxa/frontend-agent/theme"

// Build static assets
const build = buildStaticTheme(myBrand, {
  outDir: "dist/theme",
  formats: ["css", "json", "js"],
  minify: true
})

// Generate critical CSS (above-the-fold)
const criticalCss = generateCriticalCss(myBrand)

// Process for production build
const processed = processThemeForBuild(myBrand, {
  target: "production",
  treeshake: true
})
```

## Presets

```typescript
import {
  getThemePreset,
  getThemePresetNames,
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme
} from "@platxa/frontend-agent/theme"

// Get available presets
const presets = getThemePresetNames()
// ["default", "slate", "zinc", "blue", "green", "violet", ...]

// Load a preset
const preset = getThemePreset("blue")
const generated = generateTheme(preset)
```

## Best Practices

| Do | Don't |
|----|-------|
| Use OKLCH for colors | Use hex for new brands |
| Define all semantic colors | Leave colors undefined |
| Test contrast ratios | Assume colors are accessible |
| Use inheritance for variants | Duplicate entire configs |
| Validate before deploying | Skip validation |
| Keep dark mode colors-only | Override spacing in dark mode |
| Use the spacing scale | Use arbitrary pixel values |
| Version your brand kits | Make breaking changes silently |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Colors look different | Color space mismatch | Use OKLCH consistently |
| Contrast failures | Low lightness difference | Use suggestAccessiblePair() |
| Circular reference | A extends B extends A | Check inheritance chain |
| Size limit exceeded | Too many palettes | Use partial brand kits |
| SSR mismatch | Missing init script | Use generateSSRHeadContent() |
| Dark mode broken | Missing dark overrides | Define config.dark colors |

## Export Reference

```typescript
// Core operations
export {
  createTheme,
  generateTheme,
  generateThemeFromPreset,
  validateTheme
}

// Extension & inheritance
export {
  extendBrand,
  createChildBrand,
  resolveBrandInheritance,
  flattenBrandInheritance
}

// Validation
export {
  validateBrandCompliance,
  generateWcagReport,
  checkBrandKitCircularReferences,
  validateBrandKitSize
}

// AI suggestions
export {
  suggestColors,
  suggestAccessiblePair,
  analyzePalette,
  getComponentColorRecommendations
}

// Integration
export {
  generateTailwindThemeDirective,
  generateTailwindV4Css,
  generateNextMetadata,
  generateSSRHeadContent
}

// Build
export {
  buildStaticTheme,
  generateCriticalCss,
  processThemeForBuild
}

// Types
export type {
  ThemeConfig,
  SemanticColors,
  DesignTokens,
  GeneratedTheme,
  ColorSuggestion,
  BrandValidationResult
}
```
