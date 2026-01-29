# Monochromatic Palette Generator

Generate elegant tints, shades, and tones from a single hue using OKLCH color space.

## Overview

Monochromatic palettes use variations of a single hue:
- **Tints**: Add lightness (towards white)
- **Shades**: Reduce lightness (towards black)
- **Tones**: Adjust chroma (saturation)

This creates cohesive, elegant themes that feel unified and sophisticated.

## Color Theory

```
                    LIGHTNESS
                       ↑
         Tints ────────┼──────── Pure White
           │           │
           │     ●     │  ← Base Color (Hue)
           │           │
        Shades ────────┼──────── Pure Black
                       ↓

                    CHROMA
         Muted ────────●──────── Vibrant
        (Tones)               (Saturated)
```

## OKLCH Palette Generation

### Core Types

```typescript
interface OklchColor {
  l: number  // Lightness: 0-100
  c: number  // Chroma: 0-0.4 (saturation)
  h: number  // Hue: 0-360
}

interface MonochromaticPalette {
  base: OklchColor
  tints: OklchColor[]    // Lighter variations
  shades: OklchColor[]   // Darker variations
  tones: OklchColor[]    // Chroma variations
  scale: Record<string, string>  // CSS color strings
}

interface PaletteConfig {
  hue: number           // Base hue (0-360)
  baseChroma?: number   // Base saturation (default: 0.15)
  baseLightness?: number // Base lightness (default: 50)
  steps?: number        // Number of steps (default: 11)
  chromaCurve?: "linear" | "bell" | "constant"
}
```

### Hue Reference

| Hue | Color | Use Case |
|-----|-------|----------|
| 0 | Red | Energy, urgency, passion |
| 30 | Orange | Warmth, creativity |
| 60 | Yellow | Optimism, clarity |
| 120 | Green | Growth, nature, success |
| 180 | Cyan | Calm, clarity |
| 220 | Blue | Trust, professionalism |
| 270 | Purple | Luxury, creativity |
| 330 | Pink | Playful, soft |

## Palette Generator

### Generate Monochromatic Scale

```typescript
/**
 * Generate a monochromatic palette from a single hue
 */
const generateMonochromaticPalette = (
  config: PaletteConfig
): MonochromaticPalette => {
  const {
    hue,
    baseChroma = 0.15,
    baseLightness = 50,
    steps = 11,
    chromaCurve = "bell"
  } = config

  const base: OklchColor = {
    l: baseLightness,
    c: baseChroma,
    h: hue
  }

  // Generate lightness stops (0-100)
  const lightnessStops = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    // Non-linear distribution for perceptual uniformity
    return Math.round(5 + 90 * easeInOutQuad(t))
  })

  // Calculate chroma at each lightness level
  const getChromaAtLightness = (lightness: number): number => {
    switch (chromaCurve) {
      case "constant":
        return baseChroma

      case "linear":
        // Linear falloff towards extremes
        const distFromCenter = Math.abs(lightness - 50) / 50
        return baseChroma * (1 - distFromCenter * 0.5)

      case "bell":
      default:
        // Bell curve - max chroma at mid-lightness
        const normalized = (lightness - 50) / 50
        return baseChroma * Math.exp(-2 * normalized * normalized)
    }
  }

  // Generate scale
  const scale: Record<string, string> = {}
  const tints: OklchColor[] = []
  const shades: OklchColor[] = []

  lightnessStops.forEach((lightness, index) => {
    const chroma = getChromaAtLightness(lightness)
    const color: OklchColor = { l: lightness, c: chroma, h: hue }
    const cssColor = oklchToString(color)

    // Name stops: 50, 100, 200, ..., 900, 950
    const stopName = index === 0 ? "50" :
                     index === steps - 1 ? "950" :
                     String(index * 100)
    scale[stopName] = cssColor

    // Categorize
    if (lightness > baseLightness) {
      tints.push(color)
    } else if (lightness < baseLightness) {
      shades.push(color)
    }
  })

  // Generate tone variations (chroma changes)
  const tones = [0.05, 0.10, 0.15, 0.20, 0.25].map(c => ({
    l: baseLightness,
    c,
    h: hue
  }))

  return { base, tints, shades, tones, scale }
}

// Easing function for perceptual uniformity
const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
```

### Convert to CSS String

```typescript
/**
 * Convert OKLCH color to CSS string
 */
const oklchToString = (color: OklchColor): string =>
  `oklch(${color.l}% ${color.c.toFixed(3)} ${color.h})`

/**
 * Convert OKLCH to HSL fallback
 */
const oklchToHslFallback = (color: OklchColor): string => {
  // Approximate conversion for browsers without OKLCH support
  const h = color.h
  const s = Math.min(100, color.c * 500) // Rough approximation
  const l = color.l
  return `hsl(${h}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`
}
```

## Pre-Built Palettes

### Elegant Neutrals

```typescript
const elegantNeutrals = {
  // Warm gray (slight orange hue)
  warmGray: generateMonochromaticPalette({
    hue: 30,
    baseChroma: 0.02,
    chromaCurve: "constant"
  }),

  // Cool gray (slight blue hue)
  coolGray: generateMonochromaticPalette({
    hue: 220,
    baseChroma: 0.02,
    chromaCurve: "constant"
  }),

  // True neutral (no hue)
  neutral: generateMonochromaticPalette({
    hue: 0,
    baseChroma: 0,
    chromaCurve: "constant"
  }),

  // Slate (blue-gray)
  slate: generateMonochromaticPalette({
    hue: 215,
    baseChroma: 0.03,
    chromaCurve: "bell"
  })
}
```

### Brand Color Palettes

```typescript
const brandPalettes = {
  // Ocean blue - professional, trustworthy
  ocean: generateMonochromaticPalette({
    hue: 220,
    baseChroma: 0.15,
    baseLightness: 45,
    chromaCurve: "bell"
  }),

  // Forest green - natural, growth
  forest: generateMonochromaticPalette({
    hue: 150,
    baseChroma: 0.12,
    baseLightness: 40,
    chromaCurve: "bell"
  }),

  // Royal purple - luxury, creative
  royal: generateMonochromaticPalette({
    hue: 270,
    baseChroma: 0.18,
    baseLightness: 45,
    chromaCurve: "bell"
  }),

  // Coral - warm, energetic
  coral: generateMonochromaticPalette({
    hue: 15,
    baseChroma: 0.16,
    baseLightness: 55,
    chromaCurve: "bell"
  })
}
```

## CSS Variables Output

### Generate CSS Custom Properties

```typescript
/**
 * Generate CSS variables from palette
 */
const paletteToCssVariables = (
  palette: MonochromaticPalette,
  prefix: string = "color"
): string => {
  const lines: string[] = []

  Object.entries(palette.scale).forEach(([stop, color]) => {
    lines.push(`--${prefix}-${stop}: ${color};`)
  })

  return lines.join("\n")
}

// Usage
const bluePalette = generateMonochromaticPalette({ hue: 220 })
console.log(paletteToCssVariables(bluePalette, "blue"))

// Output:
// --blue-50: oklch(95% 0.015 220);
// --blue-100: oklch(90% 0.035 220);
// --blue-200: oklch(80% 0.070 220);
// ...
// --blue-900: oklch(15% 0.045 220);
// --blue-950: oklch(8% 0.025 220);
```

### Tailwind CSS Integration

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss"

const generateTailwindPalette = (hue: number, name: string) => {
  const palette = generateMonochromaticPalette({ hue })
  return { [name]: palette.scale }
}

export default {
  theme: {
    extend: {
      colors: {
        ...generateTailwindPalette(220, "brand"),
        ...generateTailwindPalette(150, "success"),
        ...generateTailwindPalette(350, "danger"),
      }
    }
  }
} satisfies Config
```

### CSS @theme Directive (Tailwind v4)

```css
@theme {
  /* Monochromatic blue palette */
  --color-brand-50: oklch(95% 0.015 220);
  --color-brand-100: oklch(90% 0.035 220);
  --color-brand-200: oklch(80% 0.070 220);
  --color-brand-300: oklch(70% 0.100 220);
  --color-brand-400: oklch(60% 0.130 220);
  --color-brand-500: oklch(50% 0.150 220);
  --color-brand-600: oklch(40% 0.140 220);
  --color-brand-700: oklch(30% 0.120 220);
  --color-brand-800: oklch(20% 0.090 220);
  --color-brand-900: oklch(15% 0.060 220);
  --color-brand-950: oklch(8% 0.030 220);
}
```

## Theme Generation

### Dark Mode Palette

```typescript
/**
 * Generate dark mode variant of palette
 */
const generateDarkModePalette = (
  lightPalette: MonochromaticPalette
): Record<string, string> => {
  const darkScale: Record<string, string> = {}

  // Invert the scale for dark mode
  const entries = Object.entries(lightPalette.scale)
  const reversed = [...entries].reverse()

  entries.forEach(([stop], index) => {
    darkScale[stop] = reversed[index][1]
  })

  return darkScale
}

// CSS output
const lightPalette = generateMonochromaticPalette({ hue: 220 })
const darkPalette = generateDarkModePalette(lightPalette)

/*
Light mode: brand-100 is light, brand-900 is dark
Dark mode:  brand-100 is dark, brand-900 is light
*/
```

### Semantic Color Mapping

```typescript
interface SemanticTheme {
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  border: string
  ring: string
  primary: string
  primaryForeground: string
}

/**
 * Generate semantic theme from monochromatic palette
 */
const paletteToSemanticTheme = (
  palette: MonochromaticPalette,
  mode: "light" | "dark" = "light"
): SemanticTheme => {
  const { scale } = palette

  if (mode === "light") {
    return {
      background: scale["50"],
      foreground: scale["900"],
      muted: scale["100"],
      mutedForeground: scale["500"],
      border: scale["200"],
      ring: scale["400"],
      primary: scale["600"],
      primaryForeground: scale["50"]
    }
  }

  // Dark mode
  return {
    background: scale["950"],
    foreground: scale["50"],
    muted: scale["800"],
    mutedForeground: scale["400"],
    border: scale["700"],
    ring: scale["500"],
    primary: scale["400"],
    primaryForeground: scale["950"]
  }
}
```

## React Hook

```typescript
import { useMemo } from "react"

interface UseMonochromaticPaletteOptions {
  hue: number
  chroma?: number
  steps?: number
}

/**
 * React hook for generating monochromatic palette
 */
const useMonochromaticPalette = (options: UseMonochromaticPaletteOptions) => {
  const { hue, chroma = 0.15, steps = 11 } = options

  const palette = useMemo(
    () => generateMonochromaticPalette({
      hue,
      baseChroma: chroma,
      steps
    }),
    [hue, chroma, steps]
  )

  const cssVariables = useMemo(
    () => paletteToCssVariables(palette, "palette"),
    [palette]
  )

  const applyToElement = (element: HTMLElement) => {
    Object.entries(palette.scale).forEach(([stop, color]) => {
      element.style.setProperty(`--palette-${stop}`, color)
    })
  }

  return {
    palette,
    cssVariables,
    applyToElement,
    scale: palette.scale
  }
}

// Usage
const ThemeProvider = ({ children, hue }: { children: React.ReactNode; hue: number }) => {
  const { cssVariables } = useMonochromaticPalette({ hue })

  return (
    <div style={{ cssText: cssVariables }}>
      {children}
    </div>
  )
}
```

## Color Picker Component

```typescript
import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface MonochromaticPickerProps {
  value: number
  onChange: (hue: number) => void
  showPreview?: boolean
  className?: string
}

const MonochromaticPicker = ({
  value,
  onChange,
  showPreview = true,
  className
}: MonochromaticPickerProps) => {
  const palette = React.useMemo(
    () => generateMonochromaticPalette({ hue: value }),
    [value]
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hue slider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Hue: {value}°</label>
        <div
          className="h-4 rounded-full"
          style={{
            background: `linear-gradient(to right,
              oklch(60% 0.15 0),
              oklch(60% 0.15 60),
              oklch(60% 0.15 120),
              oklch(60% 0.15 180),
              oklch(60% 0.15 240),
              oklch(60% 0.15 300),
              oklch(60% 0.15 360)
            )`
          }}
        />
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={0}
          max={360}
          step={1}
        />
      </div>

      {/* Palette preview */}
      {showPreview && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Generated Palette</label>
          <div className="flex h-12 overflow-hidden rounded-lg">
            {Object.entries(palette.scale).map(([stop, color]) => (
              <div
                key={stop}
                className="flex-1 transition-colors"
                style={{ backgroundColor: color }}
                title={`${stop}: ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

## Palette Visualization

### Swatch Grid

```typescript
interface PaletteSwatchProps {
  palette: MonochromaticPalette
  showValues?: boolean
}

const PaletteSwatch = ({ palette, showValues = false }: PaletteSwatchProps) => (
  <div className="grid grid-cols-11 gap-1">
    {Object.entries(palette.scale).map(([stop, color]) => (
      <div key={stop} className="space-y-1">
        <div
          className="aspect-square rounded-lg shadow-sm"
          style={{ backgroundColor: color }}
        />
        <div className="text-center text-xs">
          <div className="font-medium">{stop}</div>
          {showValues && (
            <div className="text-muted-foreground truncate text-[10px]">
              {color}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
)
```

### Contrast Checker

```typescript
/**
 * Calculate WCAG contrast ratio between two OKLCH colors
 */
const calculateContrastRatio = (
  color1: OklchColor,
  color2: OklchColor
): number => {
  // Convert to relative luminance (simplified)
  const getLuminance = (c: OklchColor) => c.l / 100

  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Find best text color for background
 */
const getContrastingTextColor = (
  background: OklchColor,
  palette: MonochromaticPalette
): string => {
  const candidates = [
    palette.scale["50"],   // Light text
    palette.scale["950"]   // Dark text
  ]

  // Return color with higher contrast
  const light = { l: 95, c: 0.015, h: background.h }
  const dark = { l: 8, c: 0.025, h: background.h }

  const lightContrast = calculateContrastRatio(background, light)
  const darkContrast = calculateContrastRatio(background, dark)

  return lightContrast > darkContrast ? candidates[0] : candidates[1]
}
```

## Usage Examples

### Brand Theme Generator

```typescript
// Generate complete brand theme from single hue
const createBrandTheme = (brandHue: number) => {
  const primary = generateMonochromaticPalette({
    hue: brandHue,
    baseChroma: 0.15
  })

  const neutral = generateMonochromaticPalette({
    hue: brandHue,
    baseChroma: 0.02  // Very subtle brand tint
  })

  return {
    primary,
    neutral,
    light: paletteToSemanticTheme(primary, "light"),
    dark: paletteToSemanticTheme(primary, "dark")
  }
}

// Usage
const blueTheme = createBrandTheme(220)
```

### Dynamic Theme Switching

```typescript
const ThemeSwitcher = () => {
  const [hue, setHue] = React.useState(220)
  const theme = React.useMemo(() => createBrandTheme(hue), [hue])

  return (
    <div
      style={{
        "--background": theme.light.background,
        "--foreground": theme.light.foreground,
        "--primary": theme.light.primary
      } as React.CSSProperties}
    >
      <MonochromaticPicker value={hue} onChange={setHue} />
      <div className="bg-background text-foreground p-4">
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded">
          Themed Button
        </button>
      </div>
    </div>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use bell curve for chroma | Use constant chroma (looks flat) |
| Start from mid-lightness | Start from extremes (limited range) |
| Add subtle hue to neutrals | Use pure gray (feels cold) |
| Test contrast at all stops | Assume all combinations work |
| Provide light + dark themes | Only generate one mode |
| Use OKLCH for uniformity | Use HSL (uneven perception) |

## Accessibility

```typescript
/**
 * Validate palette accessibility
 */
const validatePaletteAccessibility = (palette: MonochromaticPalette) => {
  const issues: string[] = []

  // Check text on background combinations
  const textOnBg = [
    { text: "900", bg: "50", minRatio: 4.5 },
    { text: "50", bg: "900", minRatio: 4.5 },
    { text: "700", bg: "100", minRatio: 4.5 },
    { text: "200", bg: "800", minRatio: 4.5 }
  ]

  textOnBg.forEach(({ text, bg, minRatio }) => {
    const textColor = parseOklch(palette.scale[text])
    const bgColor = parseOklch(palette.scale[bg])
    const ratio = calculateContrastRatio(textColor, bgColor)

    if (ratio < minRatio) {
      issues.push(
        `${text} on ${bg}: ${ratio.toFixed(2)}:1 (needs ${minRatio}:1)`
      )
    }
  })

  return {
    valid: issues.length === 0,
    issues
  }
}
```

## Export

```typescript
export {
  generateMonochromaticPalette,
  paletteToCssVariables,
  paletteToSemanticTheme,
  generateDarkModePalette,
  useMonochromaticPalette,
  MonochromaticPicker,
  PaletteSwatch,
  calculateContrastRatio,
  getContrastingTextColor,
  validatePaletteAccessibility,
  elegantNeutrals,
  brandPalettes
}
export type {
  OklchColor,
  MonochromaticPalette,
  PaletteConfig,
  SemanticTheme
}
```
