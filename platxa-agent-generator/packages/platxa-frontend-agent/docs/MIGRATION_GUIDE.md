# Migration Guide: Built-in Themes to Custom Brand Kit

This guide walks you through migrating from Platxa Frontend Agent's built-in theme presets to a custom brand kit package.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Code Examples](#code-examples)
5. [Common Pitfalls](#common-pitfalls)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Plan](#rollback-plan)

---

## Overview

### Why Migrate?

Built-in presets (`default`, `blue`, `green`, `violet`) are great for getting started, but a custom brand kit provides:

- **Brand Consistency**: Exact colors matching your brand guidelines
- **Custom Tokens**: Typography, spacing, shadows tailored to your design system
- **Version Control**: Lock specific design token versions across projects
- **Team Sharing**: Publish and share across multiple applications
- **CI/CD Integration**: Validate brand compliance in your pipeline

### Migration Paths

| From | To | Effort |
|------|-----|--------|
| No theming | Brand kit | Low |
| Built-in preset | Brand kit | Medium |
| Custom CSS variables | Brand kit | Medium-High |
| Multiple presets | Single brand kit | High |

---

## Prerequisites

Before migrating, ensure you have:

- [ ] Node.js 20+ installed
- [ ] `@platxa/frontend-agent` v1.0.0+ in your project
- [ ] Access to your brand guidelines (colors, typography, spacing)
- [ ] A test environment to verify changes

---

## Step-by-Step Migration

### Step 1: Audit Current Theme Usage

First, identify how you're currently using themes:

```bash
# Find all theme-related imports
grep -r "getThemePreset\|useTheme\|BrandProvider" src/

# Find CSS variable usage
grep -r "var(--" src/
```

Document what you find:
- Which preset(s) are you using?
- Are you overriding any CSS variables?
- Are you using `useTheme` hook?

### Step 2: Generate a Brand Kit Scaffold

Use the CLI to create your brand kit:

```bash
# Interactive mode
npx @platxa/frontend-agent generate

# Or with options
npx @platxa/frontend-agent generate @your-org/brand-kit \
  --preset default \
  --hue 220 \
  --typescript
```

This creates a package structure:

```
your-brand-kit/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts      # Your brand kit definition
└── README.md
```

### Step 3: Map Your Brand Colors

Open `src/index.ts` and update the color primitives to match your brand:

**Before (built-in preset):**
```typescript
// Using built-in preset
import { getThemePreset } from "@platxa/frontend-agent"
const theme = getThemePreset("default")
```

**After (custom brand kit):**
```typescript
// src/index.ts in your brand kit
export const primary = {
  50: "oklch(0.97 0.02 220)",   // Your brand's lightest primary
  100: "oklch(0.93 0.04 220)",
  200: "oklch(0.86 0.08 220)",
  300: "oklch(0.76 0.12 220)",
  400: "oklch(0.66 0.16 220)",
  500: "oklch(0.55 0.18 220)",  // Your brand's primary color
  600: "oklch(0.47 0.17 220)",
  700: "oklch(0.40 0.15 220)",
  800: "oklch(0.33 0.12 220)",
  900: "oklch(0.27 0.09 220)",
  950: "oklch(0.20 0.06 220)",  // Your brand's darkest primary
}
```

#### Converting Colors to OKLCH

If your brand colors are in HEX or RGB:

```typescript
// HEX to OKLCH conversion guide:
// Use https://oklch.com or programmatically:

import { convertColor } from "@platxa/frontend-agent"

const brandBlue = "#1E40AF"
const oklch = convertColor(brandBlue, "oklch")
// Result: "oklch(0.40 0.15 262)"
```

### Step 4: Configure Semantic Colors

Map your primitives to semantic roles:

```typescript
export const lightColors = {
  // Backgrounds
  background: "oklch(0.99 0.002 220)",  // Almost white with subtle hue
  foreground: "oklch(0.15 0.01 220)",   // Almost black with subtle hue

  // Primary action color
  primary: primary[600],                 // Main brand color
  primaryForeground: "oklch(0.99 0 0)", // White text on primary

  // Secondary (less prominent)
  secondary: neutral[100],
  secondaryForeground: neutral[900],

  // Muted (disabled, placeholders)
  muted: neutral[100],
  mutedForeground: neutral[500],

  // Accent (highlights, badges)
  accent: accent[100],
  accentForeground: accent[900],

  // Destructive (errors, delete actions)
  destructive: "oklch(0.55 0.22 25)",    // Red
  destructiveForeground: "oklch(0.99 0 0)",

  // Borders and inputs
  border: neutral[200],
  input: neutral[200],
  ring: primary[500],                    // Focus ring color
}
```

### Step 5: Add Typography and Spacing (Optional)

```typescript
export const typography = {
  fontFamily: {
    sans: ["Your Brand Font", "Inter", "system-ui", "sans-serif"],
    mono: ["Your Mono Font", "JetBrains Mono", "monospace"],
  },
  // ... rest of typography tokens
}

export const spacing = {
  // Use your design system's spacing scale
  // e.g., 4px base: 4, 8, 12, 16, 24, 32, 48, 64
}
```

### Step 6: Validate Your Brand Kit

Before publishing, validate the structure and contrast:

```bash
# From your brand kit directory
npx @platxa/frontend-agent validate .

# Expected output:
# ============================================================
# Brand Kit Validation Report
# ============================================================
# Source: .
# Status: ✅ VALID
#
# --- Schema Validation ---
# (no errors)
#
# --- Color Contrast (WCAG 2.1) ---
# AA Compliance: ✅ Pass
# AAA Compliance: ✅ Pass
```

Fix any contrast issues before proceeding.

### Step 7: Build and Publish Your Brand Kit

```bash
cd your-brand-kit

# Build TypeScript
npm run build

# Publish (or link for testing)
npm publish
# or for testing:
npm link
```

### Step 8: Update Your Application

**Before (built-in preset):**
```tsx
// App.tsx
import { BrandProvider } from "@platxa/frontend-agent"

function App() {
  return (
    <BrandProvider>  {/* Uses default preset */}
      <YourApp />
    </BrandProvider>
  )
}
```

**After (custom brand kit):**
```tsx
// App.tsx
import { BrandProvider } from "@platxa/frontend-agent"

function App() {
  return (
    <BrandProvider brandPackage="@your-org/brand-kit">
      <YourApp />
    </BrandProvider>
  )
}
```

### Step 9: Update frontend.config (if using)

**Before:**
```typescript
// frontend.config.ts
import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  theme: {
    preset: "blue",
  },
})
```

**After:**
```typescript
// frontend.config.ts
import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  theme: {
    preset: "default", // Fallback only
  },
  brand: {
    package: "@your-org/brand-kit",
  },
})
```

### Step 10: Verify and Test

```bash
# Run your app
npm run dev

# Check for:
# - Colors render correctly
# - Dark mode works
# - Focus rings visible
# - No console errors
```

---

## Code Examples

### Example 1: Simple Migration

**Before:**
```tsx
import { Button } from "@platxa/frontend-agent"

// Button uses default blue primary
<Button>Click me</Button>
```

**After:**
```tsx
import { BrandProvider, Button } from "@platxa/frontend-agent"

// Button now uses your brand's primary color
<BrandProvider brandPackage="@your-org/brand-kit">
  <Button>Click me</Button>
</BrandProvider>
```

### Example 2: Accessing Brand Colors Programmatically

**Before:**
```tsx
import { getThemePreset } from "@platxa/frontend-agent"

const theme = getThemePreset("blue")
const primaryColor = theme.colors.light.primary
```

**After:**
```tsx
import { useBrandContext } from "@platxa/frontend-agent"

function MyComponent() {
  const { brandKit } = useBrandContext()
  const primaryColor = brandKit?.semantics.light.primary
  // ...
}
```

### Example 3: Custom CSS with Brand Tokens

**Before (hardcoded):**
```css
.custom-element {
  background: hsl(217, 91%, 60%);
  color: white;
}
```

**After (using CSS variables):**
```css
.custom-element {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}
```

### Example 4: Tailwind Integration

**Before:**
```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
      },
    },
  },
}
```

**After:**
```javascript
// tailwind.config.js
import brandKit from "@your-org/brand-kit"

export default {
  presets: [brandKit.tailwindPreset],
}
```

---

## Common Pitfalls

### 1. Missing CSS Variable Injection

**Problem:** Colors don't appear after migration.

**Cause:** BrandProvider not at root level.

**Solution:**
```tsx
// Ensure BrandProvider wraps your entire app
<BrandProvider brandPackage="@your-org/brand-kit">
  <Router>
    <App />
  </Router>
</BrandProvider>
```

### 2. OKLCH Browser Support

**Problem:** Colors look wrong in older browsers.

**Cause:** OKLCH not supported in Safari <15.4, Chrome <111.

**Solution:** Include fallback CSS:
```css
.element {
  /* Fallback for older browsers */
  background: rgb(59, 130, 246);
  /* Modern browsers use OKLCH */
  background: oklch(0.55 0.18 250);
}
```

Or use the `css` export from your brand kit which includes fallbacks.

### 3. Dark Mode Not Working

**Problem:** Dark mode shows light colors.

**Cause:** Missing `semantics.dark` in brand kit.

**Solution:** Ensure both light and dark are defined:
```typescript
export const semantics = {
  light: lightColors,  // Required
  dark: darkColors,    // Required
}
```

### 4. Contrast Ratio Failures

**Problem:** Text unreadable on backgrounds.

**Cause:** Insufficient contrast between foreground/background pairs.

**Solution:**
```bash
# Validate contrast
npx @platxa/frontend-agent validate .

# Fix flagged pairs by adjusting lightness
# For AA: minimum 4.5:1 ratio
# For AAA: minimum 7:1 ratio
```

### 5. Package Not Found

**Problem:** `Error: Cannot find module '@your-org/brand-kit'`

**Cause:** Package not installed or not built.

**Solution:**
```bash
# If published
npm install @your-org/brand-kit

# If local development
cd brand-kit && npm link
cd your-app && npm link @your-org/brand-kit
```

### 6. TypeScript Errors After Migration

**Problem:** Type errors with brand kit imports.

**Cause:** Missing type declarations.

**Solution:**
```bash
# Rebuild brand kit with declarations
cd brand-kit
npm run build  # Generates .d.ts files

# Or add to your brand kit's package.json:
{
  "types": "./dist/index.d.ts"
}
```

### 7. SSR Hydration Mismatch

**Problem:** Console warnings about hydration mismatch.

**Cause:** Brand kit loading async on client only.

**Solution:**
```tsx
<BrandProvider
  brandPackage="@your-org/brand-kit"
  loading={<LoadingSpinner />}  // Show loading state during SSR
>
  <App />
</BrandProvider>
```

### 8. Multiple Brand Kit Instances

**Problem:** Different parts of app have different colors.

**Cause:** Multiple BrandProvider instances.

**Solution:** Use single BrandProvider at app root:
```tsx
// ❌ Wrong
<BrandProvider brandPackage="kit-a">
  <Header />
</BrandProvider>
<BrandProvider brandPackage="kit-b">
  <Main />
</BrandProvider>

// ✅ Correct
<BrandProvider brandPackage="@your-org/brand-kit">
  <Header />
  <Main />
</BrandProvider>
```

---

## Troubleshooting

### Debug Mode

Enable debug logging:
```tsx
<BrandProvider
  brandPackage="@your-org/brand-kit"
  onError={(error) => console.error('Brand kit error:', error)}
>
  <App />
</BrandProvider>
```

### Inspect Loaded Brand Kit

```tsx
function DebugBrand() {
  const { brandKit, isLoading, error } = useBrandContext()

  console.log('Brand Kit:', brandKit)
  console.log('Loading:', isLoading)
  console.log('Error:', error)

  return null
}
```

### CSS Variable Inspection

In browser DevTools:
```javascript
// Check if CSS variables are set
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
```

---

## Rollback Plan

If migration causes issues, rollback is straightforward:

### Quick Rollback

```tsx
// Comment out brand package
<BrandProvider /* brandPackage="@your-org/brand-kit" */>
  <App />
</BrandProvider>
```

### Full Rollback

```tsx
// Remove BrandProvider entirely
function App() {
  return <YourApp />  // Uses built-in defaults
}
```

### Gradual Migration

Use feature flags to migrate incrementally:

```tsx
const USE_BRAND_KIT = process.env.REACT_APP_USE_BRAND_KIT === 'true'

<BrandProvider
  brandPackage={USE_BRAND_KIT ? "@your-org/brand-kit" : undefined}
>
  <App />
</BrandProvider>
```

---

## Next Steps

After successful migration:

1. **Document your brand kit** - Add README with color guidelines
2. **Set up CI/CD validation** - Run `platxa-validate` in your pipeline
3. **Version your brand kit** - Follow semver for design token changes
4. **Monitor for regressions** - Visual regression testing recommended

---

## Need Help?

- [API Documentation](./API.md)
- [Brand Kit Schema](./BRAND_KIT_SCHEMA.md)
- [GitHub Issues](https://github.com/platxa/frontend-agent/issues)

---

*Migration Guide v1.0 - Last updated: 2025*
