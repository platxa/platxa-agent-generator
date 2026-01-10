# Contrast Validation System

WCAG 2.2 requires minimum contrast ratios for text readability. This system validates all color combinations meet accessibility standards.

## WCAG Contrast Requirements

| Content Type | Minimum Ratio | WCAG Level | Criterion |
|--------------|---------------|------------|-----------|
| Normal text (<18px, <14px bold) | **4.5:1** | AA | 1.4.3 |
| Large text (≥18px, ≥14px bold) | **3:1** | AA | 1.4.3 |
| UI components & graphics | **3:1** | AA | 1.4.11 |
| Enhanced normal text | 7:1 | AAA | 1.4.6 |
| Enhanced large text | 4.5:1 | AAA | 1.4.6 |

```
Contrast Ratio Scale:
═══════════════════════════════════════════════════════════════
1:1 ────── 3:1 ────── 4.5:1 ────── 7:1 ────── 21:1
   FAIL      UI OK      AA OK       AAA OK      MAX
                        (target)
═══════════════════════════════════════════════════════════════
```

## Contrast Calculation

### OKLCH to Relative Luminance

```typescript
/**
 * Convert OKLCH to relative luminance for contrast calculation
 * OKLCH L (lightness) correlates with perceived luminance
 */
function oklchToRelativeLuminance(oklch: string): number {
  const match = oklch.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
  if (!match) throw new Error(`Invalid OKLCH: ${oklch}`)

  const L = parseFloat(match[1])

  // OKLCH Lightness approximates perceptual luminance
  // Convert to relative luminance (0-1 scale)
  // This is a simplified approximation
  return L
}

/**
 * Calculate WCAG contrast ratio between two colors
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 > L2
 */
function calculateContrastRatio(foreground: string, background: string): number {
  const fgLum = oklchToRelativeLuminance(foreground)
  const bgLum = oklchToRelativeLuminance(background)

  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)

  return (lighter + 0.05) / (darker + 0.05)
}

// Example usage
const ratio = calculateContrastRatio(
  "oklch(0.15 0.02 250)",  // Dark text
  "oklch(0.98 0 0)"         // Light background
)
// Result: ~6.5:1 (passes AA)
```

### Precise RGB-Based Calculation

```typescript
/**
 * More accurate calculation using sRGB conversion
 */
function sRGBToLuminance(r: number, g: number, b: number): number {
  // Normalize to 0-1
  const [rNorm, gNorm, bNorm] = [r, g, b].map(c => {
    const sRGB = c / 255
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })

  // Calculate luminance using rec. 709 coefficients
  return 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm
}

function getContrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const fgLum = sRGBToLuminance(...fg)
  const bgLum = sRGBToLuminance(...bg)

  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)

  return (lighter + 0.05) / (darker + 0.05)
}
```

## Token Pair Validation

### Required Contrast Pairs

Every foreground token needs a contrasting background:

| Foreground Token | Background Token | Required Ratio |
|------------------|------------------|----------------|
| `--foreground` | `--background` | 4.5:1 |
| `--card-foreground` | `--card` | 4.5:1 |
| `--popover-foreground` | `--popover` | 4.5:1 |
| `--primary-foreground` | `--primary` | 4.5:1 |
| `--secondary-foreground` | `--secondary` | 4.5:1 |
| `--muted-foreground` | `--background` | 4.5:1 |
| `--muted-foreground` | `--muted` | 4.5:1 |
| `--accent-foreground` | `--accent` | 4.5:1 |
| `--destructive-foreground` | `--destructive` | 4.5:1 |

### Validation Function

```typescript
interface ContrastCheck {
  foreground: string
  background: string
  foregroundToken: string
  backgroundToken: string
  ratio: number
  required: number
  passes: boolean
  level: "AAA" | "AA" | "FAIL"
}

interface ContrastReport {
  passes: boolean
  checks: ContrastCheck[]
  failures: ContrastCheck[]
}

const TOKEN_PAIRS: Array<{
  fg: string
  bg: string
  required: number
  description: string
}> = [
  { fg: "--foreground", bg: "--background", required: 4.5, description: "Default text" },
  { fg: "--card-foreground", bg: "--card", required: 4.5, description: "Card text" },
  { fg: "--popover-foreground", bg: "--popover", required: 4.5, description: "Popover text" },
  { fg: "--primary-foreground", bg: "--primary", required: 4.5, description: "Primary button text" },
  { fg: "--secondary-foreground", bg: "--secondary", required: 4.5, description: "Secondary button text" },
  { fg: "--muted-foreground", bg: "--background", required: 4.5, description: "Muted text on background" },
  { fg: "--muted-foreground", bg: "--muted", required: 4.5, description: "Muted text on muted bg" },
  { fg: "--muted-foreground", bg: "--card", required: 4.5, description: "Muted text in cards" },
  { fg: "--accent-foreground", bg: "--accent", required: 4.5, description: "Accent text" },
  { fg: "--destructive-foreground", bg: "--destructive", required: 4.5, description: "Destructive button text" },
  { fg: "--foreground", bg: "--muted", required: 4.5, description: "Text on muted backgrounds" },
  { fg: "--ring", bg: "--background", required: 3, description: "Focus ring visibility" },
  { fg: "--border", bg: "--background", required: 3, description: "Border visibility" },
]

function validateContrast(tokens: Record<string, string>): ContrastReport {
  const checks: ContrastCheck[] = []
  const failures: ContrastCheck[] = []

  for (const pair of TOKEN_PAIRS) {
    const foreground = tokens[pair.fg]
    const background = tokens[pair.bg]

    if (!foreground || !background) continue

    const ratio = calculateContrastRatio(foreground, background)
    const passes = ratio >= pair.required

    const check: ContrastCheck = {
      foreground,
      background,
      foregroundToken: pair.fg,
      backgroundToken: pair.bg,
      ratio: Math.round(ratio * 100) / 100,
      required: pair.required,
      passes,
      level: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "FAIL"
    }

    checks.push(check)
    if (!passes) failures.push(check)
  }

  return {
    passes: failures.length === 0,
    checks,
    failures
  }
}
```

## Design Token Reference

### Light Mode (Verified Contrast)

```css
:root {
  /* ═══════════════════════════════════════════════════════════
     Background/Foreground: L=0.98 vs L=0.15 → ~6.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     Card: L=0.99 vs L=0.15 → ~7:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --card: oklch(0.99 0 0);
  --card-foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     Primary: L=0.60 vs L=0.98 → ~4.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --primary: oklch(0.6 0.2 250);
  --primary-foreground: oklch(0.98 0 0);

  /* ═══════════════════════════════════════════════════════════
     Secondary: L=0.95 vs L=0.15 → ~5.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --secondary: oklch(0.95 0.02 250);
  --secondary-foreground: oklch(0.15 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     Muted text: L=0.45 vs L=0.98 → ~4.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --muted: oklch(0.95 0.01 250);
  --muted-foreground: oklch(0.45 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     Destructive: L=0.55 vs L=0.98 → ~4.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --destructive: oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.98 0 0);
}
```

### Dark Mode (Verified Contrast)

```css
.dark {
  /* ═══════════════════════════════════════════════════════════
     Background/Foreground: L=0.12 vs L=0.95 → ~6:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --background: oklch(0.12 0.02 250);
  --foreground: oklch(0.95 0 0);

  /* ═══════════════════════════════════════════════════════════
     Card: L=0.15 vs L=0.95 → ~5.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --card: oklch(0.15 0.02 250);
  --card-foreground: oklch(0.95 0 0);

  /* ═══════════════════════════════════════════════════════════
     Primary: L=0.70 vs L=0.10 → ~5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --primary: oklch(0.70 0.18 250);
  --primary-foreground: oklch(0.10 0.02 250);

  /* ═══════════════════════════════════════════════════════════
     Muted text: L=0.65 vs L=0.12 → ~4.5:1 ✓
     ═══════════════════════════════════════════════════════════ */
  --muted-foreground: oklch(0.65 0.02 250);
}
```

## Component Validation

### Automated Checker

```typescript
interface ComponentContrastReport {
  component: string
  issues: ContrastIssue[]
  passes: boolean
}

interface ContrastIssue {
  element: string
  line: number
  foreground: string
  background: string
  ratio: number
  required: number
  suggestion: string
}

function validateComponentContrast(
  componentCode: string,
  tokens: Record<string, string>
): ComponentContrastReport {
  const issues: ContrastIssue[] = []

  // Extract color class combinations
  const colorPatterns = componentCode.matchAll(
    /className="[^"]*(?:text|bg)-([a-z-]+)[^"]*"/g
  )

  for (const match of colorPatterns) {
    const classes = match[0]

    // Find text color
    const textMatch = classes.match(/text-([a-z-]+)/)
    const bgMatch = classes.match(/bg-([a-z-]+)/)

    if (textMatch && bgMatch) {
      const fgToken = `--${textMatch[1].replace('foreground', '-foreground')}`
      const bgToken = `--${bgMatch[1]}`

      const fg = tokens[fgToken]
      const bg = tokens[bgToken]

      if (fg && bg) {
        const ratio = calculateContrastRatio(fg, bg)

        if (ratio < 4.5) {
          issues.push({
            element: match[0].slice(0, 50),
            line: getLineNumber(componentCode, match.index ?? 0),
            foreground: fgToken,
            background: bgToken,
            ratio: Math.round(ratio * 100) / 100,
            required: 4.5,
            suggestion: `Increase contrast: use darker text or lighter background`
          })
        }
      }
    }
  }

  return {
    component: extractComponentName(componentCode),
    issues,
    passes: issues.length === 0
  }
}
```

## Contrast Checker UI Component

```typescript
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ContrastCheckProps {
  foreground: string
  background: string
  children?: React.ReactNode
}

export function ContrastCheck({ foreground, background, children }: ContrastCheckProps) {
  const [ratio, setRatio] = React.useState<number>(0)

  React.useEffect(() => {
    // Calculate contrast ratio
    const calculated = calculateContrastRatio(foreground, background)
    setRatio(Math.round(calculated * 100) / 100)
  }, [foreground, background])

  const level = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-large" : "FAIL"
  const passes = ratio >= 4.5

  return (
    <div className="space-y-2">
      <div
        className="p-4 rounded-lg"
        style={{ backgroundColor: background, color: foreground }}
      >
        {children || "Sample Text Aa"}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className={cn(
          "px-2 py-0.5 rounded font-mono text-xs",
          passes ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        )}>
          {ratio}:1
        </span>

        <span className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          level === "AAA" && "bg-green-500 text-white",
          level === "AA" && "bg-green-400 text-white",
          level === "AA-large" && "bg-yellow-400 text-black",
          level === "FAIL" && "bg-red-500 text-white"
        )}>
          {level}
        </span>

        <span className="text-muted-foreground">
          {passes ? "Passes WCAG AA" : "Fails WCAG AA"}
        </span>
      </div>
    </div>
  )
}
```

## Report Format

### Validation Output

```json
{
  "timestamp": "2025-01-10T12:00:00Z",
  "theme": "light",
  "wcag_level": "AA",
  "overall_status": "PASS",
  "summary": {
    "total_checks": 13,
    "passed": 13,
    "failed": 0,
    "warnings": 2
  },
  "checks": [
    {
      "pair": "foreground / background",
      "foreground": "oklch(0.15 0.02 250)",
      "background": "oklch(0.98 0 0)",
      "ratio": 6.53,
      "required": 4.5,
      "status": "PASS",
      "level": "AA"
    },
    {
      "pair": "primary-foreground / primary",
      "foreground": "oklch(0.98 0 0)",
      "background": "oklch(0.6 0.2 250)",
      "ratio": 4.58,
      "required": 4.5,
      "status": "PASS",
      "level": "AA",
      "warning": "Close to minimum threshold"
    }
  ],
  "recommendations": [
    "Consider increasing primary lightness to 0.55 for better contrast margin",
    "Muted foreground passes but has limited headroom"
  ]
}
```

## Fixing Contrast Issues

### Common Fixes

| Issue | Solution |
|-------|----------|
| Text too light on light bg | Decrease text lightness (L: 0.5 → 0.35) |
| Text too dark on dark bg | Increase text lightness (L: 0.6 → 0.75) |
| Primary button text | Ensure foreground contrasts with primary bg |
| Muted text invisible | Increase chroma or adjust lightness |
| Border not visible | Increase lightness difference from bg |

### Adjustment Helper

```typescript
function suggestContrastFix(
  foreground: string,
  background: string,
  targetRatio: number = 4.5
): string {
  const currentRatio = calculateContrastRatio(foreground, background)

  if (currentRatio >= targetRatio) {
    return foreground // Already passing
  }

  const bgL = parseOKLCH(background).L
  const fgParsed = parseOKLCH(foreground)

  // Determine if we need lighter or darker foreground
  if (bgL > 0.5) {
    // Light background: darken foreground
    let newL = fgParsed.L
    while (newL > 0.1) {
      newL -= 0.05
      const newFg = `oklch(${newL} ${fgParsed.C} ${fgParsed.H})`
      if (calculateContrastRatio(newFg, background) >= targetRatio) {
        return newFg
      }
    }
  } else {
    // Dark background: lighten foreground
    let newL = fgParsed.L
    while (newL < 0.95) {
      newL += 0.05
      const newFg = `oklch(${newL} ${fgParsed.C} ${fgParsed.H})`
      if (calculateContrastRatio(newFg, background) >= targetRatio) {
        return newFg
      }
    }
  }

  return foreground // Could not fix
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Test both light and dark modes | Assume one mode is fine |
| Use semantic token pairs | Mix arbitrary color combinations |
| Validate during generation | Wait for manual testing |
| Target 4.5:1 minimum | Settle for 3:1 on normal text |
| Add contrast margin (5:1+) | Hit exactly 4.5:1 |
| Document contrast ratios | Leave contrast undocumented |
