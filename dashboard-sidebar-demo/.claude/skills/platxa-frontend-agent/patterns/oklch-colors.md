# OKLCH Color Palette Generator

Modern color system using OKLCH color space for perceptually uniform colors and P3 wide gamut support.

## Overview

OKLCH (Oklab Lightness Chroma Hue) provides:
- **Perceptual uniformity**: Equal steps in lightness look equal to human eyes
- **Wide gamut support**: Access to P3 display colors (30% more colors than sRGB)
- **Predictable manipulation**: Adjusting L/C/H produces expected results
- **Better accessibility**: Easier to maintain contrast ratios

## OKLCH Structure

```
oklch(L C H / alpha)

L = Lightness (0-1 or 0%-100%)
    0 = black, 1 = white

C = Chroma (0-0.4 typically)
    0 = gray, higher = more saturated

H = Hue (0-360 degrees)
    0/360 = red, 120 = green, 240 = blue

alpha = opacity (0-1)
```

## Color Palette Schema

```typescript
interface ColorPalette {
  name: string
  colors: {
    50: string   // Lightest
    100: string
    200: string
    300: string
    400: string
    500: string  // Base color
    600: string
    700: string
    800: string
    900: string
    950: string  // Darkest
  }
}

interface ThemeColors {
  primary: ColorPalette
  secondary: ColorPalette
  accent: ColorPalette
  neutral: ColorPalette
  success: ColorPalette
  warning: ColorPalette
  error: ColorPalette
}
```

## Palette Generation

### Base Color to Full Scale

```typescript
/**
 * Generate a complete color scale from a base OKLCH color
 */
const generateColorScale = (
  baseHue: number,
  baseChroma: number = 0.15,
  options: {
    lightnessRange?: [number, number]
    chromaCurve?: "linear" | "bell"
  } = {}
): ColorPalette["colors"] => {
  const { lightnessRange = [0.98, 0.15], chromaCurve = "bell" } = options
  const [lightestL, darkestL] = lightnessRange

  // Lightness values for each step
  const lightnessSteps = {
    50: lightestL,
    100: 0.94,
    200: 0.88,
    300: 0.78,
    400: 0.65,
    500: 0.55,  // Base
    600: 0.48,
    700: 0.40,
    800: 0.32,
    900: 0.24,
    950: darkestL
  }

  // Chroma curve - bell shape for vibrant midtones
  const getChroma = (step: number): number => {
    if (chromaCurve === "linear") {
      return baseChroma
    }
    // Bell curve: max chroma at 500, reduced at extremes
    const distance = Math.abs(step - 500) / 500
    return baseChroma * (1 - distance * 0.5)
  }

  return Object.fromEntries(
    Object.entries(lightnessSteps).map(([step, l]) => [
      step,
      `oklch(${l} ${getChroma(Number(step))} ${baseHue})`
    ])
  ) as ColorPalette["colors"]
}
```

### Semantic Color Generation

```typescript
const generateSemanticColors = (
  primaryHue: number,
  options: {
    secondaryHue?: number
    accentHue?: number
    chroma?: number
  } = {}
) => {
  const {
    secondaryHue = (primaryHue + 30) % 360,
    accentHue = (primaryHue + 180) % 360,
    chroma = 0.15
  } = options

  return {
    primary: generateColorScale(primaryHue, chroma),
    secondary: generateColorScale(secondaryHue, chroma * 0.8),
    accent: generateColorScale(accentHue, chroma * 1.2),
    neutral: generateColorScale(primaryHue, 0.01), // Near-gray with hint
    success: generateColorScale(145, 0.15),  // Green
    warning: generateColorScale(85, 0.18),   // Yellow/Orange
    error: generateColorScale(25, 0.18)      // Red
  }
}
```

## CSS Variables Output

### Tailwind CSS v4 Format

```css
@theme {
  /* Primary */
  --color-primary-50: oklch(0.98 0.01 250);
  --color-primary-100: oklch(0.94 0.03 250);
  --color-primary-200: oklch(0.88 0.06 250);
  --color-primary-300: oklch(0.78 0.10 250);
  --color-primary-400: oklch(0.65 0.13 250);
  --color-primary-500: oklch(0.55 0.15 250);
  --color-primary-600: oklch(0.48 0.14 250);
  --color-primary-700: oklch(0.40 0.12 250);
  --color-primary-800: oklch(0.32 0.10 250);
  --color-primary-900: oklch(0.24 0.08 250);
  --color-primary-950: oklch(0.15 0.05 250);

  /* Semantic tokens */
  --color-primary: var(--color-primary-500);
  --color-primary-foreground: var(--color-primary-50);

  /* P3 wide gamut overrides */
  @supports (color: oklch(0 0 0)) {
    --color-accent-500: oklch(0.65 0.25 320); /* Vivid magenta */
  }
}
```

### shadcn/ui Format

```css
:root {
  /* Light mode */
  --primary: 250 15% 55%;          /* H S L for HSL fallback */
  --primary-oklch: oklch(0.55 0.15 250);
  --primary-foreground: oklch(0.98 0.01 250);

  --secondary: 250 8% 48%;
  --secondary-oklch: oklch(0.55 0.08 250);
  --secondary-foreground: oklch(0.98 0.01 250);

  --muted: 250 5% 92%;
  --muted-oklch: oklch(0.92 0.02 250);
  --muted-foreground: oklch(0.45 0.03 250);

  --accent: 70 18% 55%;
  --accent-oklch: oklch(0.55 0.18 70);
  --accent-foreground: oklch(0.15 0.02 70);

  --destructive: 25 18% 45%;
  --destructive-oklch: oklch(0.45 0.18 25);
  --destructive-foreground: oklch(0.98 0.01 25);

  --background: oklch(0.99 0.002 250);
  --foreground: oklch(0.15 0.02 250);

  --card: oklch(0.99 0.002 250);
  --card-foreground: oklch(0.15 0.02 250);

  --border: oklch(0.88 0.01 250);
  --input: oklch(0.88 0.01 250);
  --ring: oklch(0.55 0.15 250);
}

.dark {
  --primary-oklch: oklch(0.65 0.15 250);
  --primary-foreground: oklch(0.15 0.02 250);

  --background: oklch(0.15 0.015 250);
  --foreground: oklch(0.95 0.01 250);

  --card: oklch(0.18 0.015 250);
  --card-foreground: oklch(0.95 0.01 250);

  --muted: oklch(0.25 0.015 250);
  --muted-foreground: oklch(0.65 0.02 250);

  --border: oklch(0.28 0.015 250);
  --input: oklch(0.28 0.015 250);
}
```

## P3 Wide Gamut Colors

### Detection and Fallback

```css
/* Fallback for non-P3 displays */
:root {
  --accent: #e040fb;  /* sRGB fallback */
}

/* P3 override for capable displays */
@supports (color: color(display-p3 1 0 0)) {
  :root {
    --accent: oklch(0.65 0.28 320);  /* Vivid P3 magenta */
  }
}

/* Alternative: @media query */
@media (color-gamut: p3) {
  :root {
    --accent: oklch(0.65 0.28 320);
  }
}
```

### Vibrant P3 Colors

```typescript
// Colors that benefit most from P3 gamut
const p3VibrantColors = {
  // Reds - more saturated
  vividRed: "oklch(0.55 0.25 25)",

  // Oranges - more electric
  electricOrange: "oklch(0.7 0.22 55)",

  // Greens - more vivid cyan-greens
  neonGreen: "oklch(0.8 0.25 150)",

  // Blues - deeper cyans
  electricBlue: "oklch(0.6 0.2 230)",

  // Purples - more saturated magentas
  vividMagenta: "oklch(0.55 0.28 320)",

  // Yellows - brighter
  brightYellow: "oklch(0.9 0.2 100)"
}
```

## Color Manipulation Utilities

### Lighten/Darken

```typescript
const adjustLightness = (
  oklch: string,
  amount: number  // -1 to 1
): string => {
  const match = oklch.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
  if (!match) return oklch

  const [, l, c, h] = match.map(Number)
  const newL = Math.max(0, Math.min(1, l + amount))

  return `oklch(${newL.toFixed(3)} ${c} ${h})`
}

// Usage
const lighterPrimary = adjustLightness("oklch(0.55 0.15 250)", 0.2)
// => "oklch(0.750 0.15 250)"
```

### Adjust Chroma (Saturation)

```typescript
const adjustChroma = (
  oklch: string,
  factor: number  // multiplier
): string => {
  const match = oklch.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
  if (!match) return oklch

  const [, l, c, h] = match.map(Number)
  const newC = Math.max(0, Math.min(0.4, c * factor))

  return `oklch(${l} ${newC.toFixed(3)} ${h})`
}

// Usage
const desaturated = adjustChroma("oklch(0.55 0.15 250)", 0.5)
// => "oklch(0.55 0.075 250)"
```

### Shift Hue

```typescript
const shiftHue = (
  oklch: string,
  degrees: number
): string => {
  const match = oklch.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
  if (!match) return oklch

  const [, l, c, h] = match.map(Number)
  const newH = (h + degrees + 360) % 360

  return `oklch(${l} ${c} ${newH.toFixed(1)})`
}

// Usage
const complementary = shiftHue("oklch(0.55 0.15 250)", 180)
// => "oklch(0.55 0.15 70)"
```

### Mix Colors

```typescript
const mixOklch = (
  color1: string,
  color2: string,
  ratio: number = 0.5  // 0 = color1, 1 = color2
): string => {
  const parse = (c: string) => {
    const match = c.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
    return match ? match.slice(1).map(Number) : [0, 0, 0]
  }

  const [l1, c1, h1] = parse(color1)
  const [l2, c2, h2] = parse(color2)

  // Handle hue interpolation (shortest path)
  let hueDiff = h2 - h1
  if (Math.abs(hueDiff) > 180) {
    hueDiff = hueDiff > 0 ? hueDiff - 360 : hueDiff + 360
  }

  const l = l1 + (l2 - l1) * ratio
  const c = c1 + (c2 - c1) * ratio
  const h = (h1 + hueDiff * ratio + 360) % 360

  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}
```

## Contrast Checking

```typescript
/**
 * Calculate relative luminance from OKLCH lightness
 * (Approximate - OKLCH L is perceptually uniform)
 */
const getContrastRatio = (
  color1L: number,
  color2L: number
): number => {
  const l1 = Math.max(color1L, color2L)
  const l2 = Math.min(color1L, color2L)
  return (l1 + 0.05) / (l2 + 0.05)
}

/**
 * Find accessible foreground color
 */
const getAccessibleForeground = (
  backgroundL: number,
  minContrast: number = 4.5
): string => {
  // Try white first
  if (getContrastRatio(1, backgroundL) >= minContrast) {
    return "oklch(1 0 0)"  // White
  }
  // Fall back to black
  return "oklch(0 0 0)"
}

// WCAG AA requirements
const contrastRequirements = {
  normalText: 4.5,    // AA for normal text
  largeText: 3.0,     // AA for large text (18pt+)
  uiComponents: 3.0,  // AA for UI components
  enhanced: 7.0       // AAA
}
```

## Preset Palettes

### Brand Colors

```typescript
const brandPresets = {
  // Tech blue
  azure: {
    hue: 230,
    chroma: 0.15,
    description: "Professional tech blue"
  },

  // Nature green
  forest: {
    hue: 145,
    chroma: 0.12,
    description: "Natural, eco-friendly green"
  },

  // Warm coral
  coral: {
    hue: 25,
    chroma: 0.18,
    description: "Warm, friendly coral"
  },

  // Royal purple
  amethyst: {
    hue: 290,
    chroma: 0.14,
    description: "Luxurious purple"
  },

  // Ocean teal
  ocean: {
    hue: 195,
    chroma: 0.13,
    description: "Calm, trustworthy teal"
  }
}

// Generate from preset
const azurePalette = generateColorScale(
  brandPresets.azure.hue,
  brandPresets.azure.chroma
)
```

### Dark Mode Adjustments

```typescript
const darkModeAdjustments = {
  // Increase lightness for backgrounds
  background: { l: 0.12, c: 0.015 },

  // Slightly desaturate colors
  chromaMultiplier: 0.9,

  // Lift minimum lightness for text
  minTextLightness: 0.85,

  // Reduce contrast for less eye strain
  maxLightness: 0.95
}

const generateDarkScale = (
  hue: number,
  chroma: number
): ColorPalette["colors"] => {
  const { chromaMultiplier } = darkModeAdjustments
  const darkChroma = chroma * chromaMultiplier

  return {
    50: `oklch(0.15 ${darkChroma * 0.3} ${hue})`,
    100: `oklch(0.20 ${darkChroma * 0.4} ${hue})`,
    200: `oklch(0.28 ${darkChroma * 0.5} ${hue})`,
    300: `oklch(0.38 ${darkChroma * 0.7} ${hue})`,
    400: `oklch(0.50 ${darkChroma * 0.9} ${hue})`,
    500: `oklch(0.62 ${darkChroma} ${hue})`,
    600: `oklch(0.72 ${darkChroma * 0.95} ${hue})`,
    700: `oklch(0.80 ${darkChroma * 0.8} ${hue})`,
    800: `oklch(0.88 ${darkChroma * 0.6} ${hue})`,
    900: `oklch(0.94 ${darkChroma * 0.4} ${hue})`,
    950: `oklch(0.97 ${darkChroma * 0.2} ${hue})`
  }
}
```

## Integration

### Generate CSS File

```typescript
const generateCSSVariables = (
  colors: ThemeColors,
  options: { darkMode?: boolean } = {}
): string => {
  let css = `:root {\n`

  for (const [name, palette] of Object.entries(colors)) {
    for (const [step, value] of Object.entries(palette)) {
      css += `  --color-${name}-${step}: ${value};\n`
    }
  }

  css += `}\n`

  if (options.darkMode) {
    css += `\n.dark {\n`
    // Add dark mode overrides
    css += `}\n`
  }

  return css
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use OKLCH for all colors | Mix color spaces |
| Provide sRGB fallbacks | Assume P3 support |
| Generate full scales | Use arbitrary color values |
| Check contrast ratios | Ignore accessibility |
| Test on various displays | Only test on P3 displays |
| Use semantic tokens | Hardcode color values |

## Export

```typescript
export {
  generateColorScale,
  generateSemanticColors,
  adjustLightness,
  adjustChroma,
  shiftHue,
  mixOklch,
  getContrastRatio,
  brandPresets
}
export type { ColorPalette, ThemeColors }
```
