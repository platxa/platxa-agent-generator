# Line Height Calculator

Optimal line height (leading) calculator ensuring 112.5-120% of font size for maximum readability.

## Overview

Line height significantly impacts readability. The optimal range is:
- **Headings**: 1.1-1.2x (110-120%) - Tighter for visual impact
- **Body text**: 1.4-1.6x (140-160%) - Looser for readability
- **UI text**: 1.25-1.5x (125-150%) - Balanced for interfaces

## Line Height Formula

```typescript
/**
 * Calculate optimal line height based on font size and context
 */
const calculateLineHeight = (
  fontSize: number,
  context: "heading" | "body" | "ui" | "compact" = "body"
): number => {
  const multipliers = {
    heading: { min: 1.1, max: 1.2, optimal: 1.125 },
    body: { min: 1.4, max: 1.6, optimal: 1.5 },
    ui: { min: 1.25, max: 1.5, optimal: 1.375 },
    compact: { min: 1.1, max: 1.25, optimal: 1.125 }
  }

  const { optimal } = multipliers[context]

  // Larger fonts need tighter line height
  // Smaller fonts need looser line height
  const sizeAdjustment = fontSize > 24
    ? -0.05
    : fontSize < 14
    ? 0.1
    : 0

  return Math.round((optimal + sizeAdjustment) * 1000) / 1000
}
```

## Typography Scale

### Complete Type System

```typescript
interface TypeStyle {
  fontSize: string
  lineHeight: string
  letterSpacing?: string
  fontWeight?: string
}

const typeScale: Record<string, TypeStyle> = {
  // Display styles (1.1-1.15x line height)
  "display-2xl": {
    fontSize: "4.5rem",    // 72px
    lineHeight: "1.1",
    letterSpacing: "-0.025em",
    fontWeight: "700"
  },
  "display-xl": {
    fontSize: "3.75rem",   // 60px
    lineHeight: "1.1",
    letterSpacing: "-0.025em",
    fontWeight: "700"
  },
  "display-lg": {
    fontSize: "3rem",      // 48px
    lineHeight: "1.125",
    letterSpacing: "-0.02em",
    fontWeight: "700"
  },

  // Headings (1.125-1.2x line height)
  h1: {
    fontSize: "2.25rem",   // 36px
    lineHeight: "1.125",   // 40.5px
    letterSpacing: "-0.02em",
    fontWeight: "700"
  },
  h2: {
    fontSize: "1.875rem",  // 30px
    lineHeight: "1.15",    // 34.5px
    letterSpacing: "-0.015em",
    fontWeight: "600"
  },
  h3: {
    fontSize: "1.5rem",    // 24px
    lineHeight: "1.2",     // 28.8px
    letterSpacing: "-0.01em",
    fontWeight: "600"
  },
  h4: {
    fontSize: "1.25rem",   // 20px
    lineHeight: "1.25",    // 25px
    fontWeight: "600"
  },
  h5: {
    fontSize: "1.125rem",  // 18px
    lineHeight: "1.3",     // 23.4px
    fontWeight: "600"
  },
  h6: {
    fontSize: "1rem",      // 16px
    lineHeight: "1.35",    // 21.6px
    fontWeight: "600"
  },

  // Body text (1.5-1.6x line height)
  "body-lg": {
    fontSize: "1.125rem",  // 18px
    lineHeight: "1.6",     // 28.8px
    fontWeight: "400"
  },
  body: {
    fontSize: "1rem",      // 16px
    lineHeight: "1.5",     // 24px
    fontWeight: "400"
  },
  "body-sm": {
    fontSize: "0.875rem",  // 14px
    lineHeight: "1.5",     // 21px
    fontWeight: "400"
  },

  // UI text (1.25-1.4x line height)
  "ui-lg": {
    fontSize: "1rem",      // 16px
    lineHeight: "1.4",     // 22.4px
    fontWeight: "500"
  },
  ui: {
    fontSize: "0.875rem",  // 14px
    lineHeight: "1.35",    // 18.9px
    fontWeight: "500"
  },
  "ui-sm": {
    fontSize: "0.75rem",   // 12px
    lineHeight: "1.4",     // 16.8px
    fontWeight: "500"
  },

  // Caption/Small (1.4-1.5x line height)
  caption: {
    fontSize: "0.75rem",   // 12px
    lineHeight: "1.5",     // 18px
    fontWeight: "400"
  },
  overline: {
    fontSize: "0.625rem",  // 10px
    lineHeight: "1.6",     // 16px
    letterSpacing: "0.1em",
    fontWeight: "600"
  }
}
```

## CSS Variables

### Tailwind CSS v4 Format

```css
@theme {
  /* Font sizes */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  --font-size-5xl: 3rem;
  --font-size-6xl: 3.75rem;
  --font-size-7xl: 4.5rem;

  /* Line heights - calculated for each size */
  --line-height-xs: 1.5;      /* 18px for 12px */
  --line-height-sm: 1.43;     /* 20px for 14px */
  --line-height-base: 1.5;    /* 24px for 16px */
  --line-height-lg: 1.56;     /* 28px for 18px */
  --line-height-xl: 1.4;      /* 28px for 20px */
  --line-height-2xl: 1.33;    /* 32px for 24px */
  --line-height-3xl: 1.2;     /* 36px for 30px */
  --line-height-4xl: 1.125;   /* 40px for 36px */
  --line-height-5xl: 1.1;     /* 52.8px for 48px */
  --line-height-6xl: 1.1;     /* 66px for 60px */
  --line-height-7xl: 1.1;     /* 79.2px for 72px */

  /* Semantic line heights */
  --line-height-none: 1;
  --line-height-tight: 1.125;
  --line-height-snug: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
  --line-height-loose: 2;
}
```

### CSS Custom Properties

```css
:root {
  /* Heading line heights (1.125-1.2x) */
  --leading-heading-display: 1.1;
  --leading-heading-1: 1.125;
  --leading-heading-2: 1.15;
  --leading-heading-3: 1.2;
  --leading-heading-4: 1.25;

  /* Body line heights (1.5x) */
  --leading-body: 1.5;
  --leading-body-relaxed: 1.625;
  --leading-body-loose: 1.75;

  /* UI line heights (1.25-1.4x) */
  --leading-ui: 1.35;
  --leading-ui-tight: 1.25;
  --leading-ui-loose: 1.5;

  /* Utility */
  --leading-none: 1;
  --leading-trim: calc(1em - 1lh);  /* For leading-trim */
}
```

## Line Height Utilities

### Calculate from Font Size

```typescript
/**
 * Get line height CSS value from font size
 */
const getLineHeight = (
  fontSizePx: number,
  type: "heading" | "body" | "ui" = "body"
): string => {
  const baseMultiplier = {
    heading: 1.125,
    body: 1.5,
    ui: 1.35
  }[type]

  // Adjust for font size
  let multiplier = baseMultiplier
  if (fontSizePx >= 36) {
    multiplier = Math.max(1.1, baseMultiplier - 0.15)
  } else if (fontSizePx <= 12) {
    multiplier = Math.min(1.75, baseMultiplier + 0.15)
  }

  return multiplier.toString()
}

/**
 * Get line height in pixels
 */
const getLineHeightPx = (
  fontSizePx: number,
  type: "heading" | "body" | "ui" = "body"
): number => {
  const multiplier = parseFloat(getLineHeight(fontSizePx, type))
  return Math.round(fontSizePx * multiplier)
}
```

### Responsive Line Height

```typescript
/**
 * Generate responsive line height based on viewport
 */
const getResponsiveLineHeight = (
  baseFontSizePx: number,
  breakpoints: {
    sm?: number
    md?: number
    lg?: number
  } = {}
): Record<string, string> => {
  const { sm, md, lg } = breakpoints

  return {
    base: getLineHeight(baseFontSizePx, "body"),
    ...(sm && { sm: getLineHeight(sm, "body") }),
    ...(md && { md: getLineHeight(md, "body") }),
    ...(lg && { lg: getLineHeight(lg, "body") })
  }
}
```

## Tailwind Plugin

```typescript
// tailwind.config.ts
import plugin from "tailwindcss/plugin"

const typographyPlugin = plugin(({ addUtilities, theme }) => {
  const typeScale = {
    // Display
    ".text-display-2xl": {
      fontSize: "4.5rem",
      lineHeight: "1.1",
      letterSpacing: "-0.025em"
    },
    ".text-display-xl": {
      fontSize: "3.75rem",
      lineHeight: "1.1",
      letterSpacing: "-0.025em"
    },
    ".text-display-lg": {
      fontSize: "3rem",
      lineHeight: "1.125",
      letterSpacing: "-0.02em"
    },

    // Headings
    ".text-heading-1": {
      fontSize: "2.25rem",
      lineHeight: "1.125",
      letterSpacing: "-0.02em"
    },
    ".text-heading-2": {
      fontSize: "1.875rem",
      lineHeight: "1.15",
      letterSpacing: "-0.015em"
    },
    ".text-heading-3": {
      fontSize: "1.5rem",
      lineHeight: "1.2",
      letterSpacing: "-0.01em"
    },
    ".text-heading-4": {
      fontSize: "1.25rem",
      lineHeight: "1.25"
    },

    // Body
    ".text-body-lg": {
      fontSize: "1.125rem",
      lineHeight: "1.6"
    },
    ".text-body": {
      fontSize: "1rem",
      lineHeight: "1.5"
    },
    ".text-body-sm": {
      fontSize: "0.875rem",
      lineHeight: "1.5"
    },

    // UI
    ".text-ui-lg": {
      fontSize: "1rem",
      lineHeight: "1.4"
    },
    ".text-ui": {
      fontSize: "0.875rem",
      lineHeight: "1.35"
    },
    ".text-ui-sm": {
      fontSize: "0.75rem",
      lineHeight: "1.4"
    }
  }

  addUtilities(typeScale)
})
```

## Component Integration

### Typography Component

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const textVariants = cva("", {
  variants: {
    variant: {
      "display-2xl": "text-7xl leading-[1.1] tracking-[-0.025em] font-bold",
      "display-xl": "text-6xl leading-[1.1] tracking-[-0.025em] font-bold",
      "display-lg": "text-5xl leading-[1.125] tracking-[-0.02em] font-bold",
      h1: "text-4xl leading-[1.125] tracking-[-0.02em] font-bold",
      h2: "text-3xl leading-[1.15] tracking-[-0.015em] font-semibold",
      h3: "text-2xl leading-[1.2] tracking-[-0.01em] font-semibold",
      h4: "text-xl leading-[1.25] font-semibold",
      h5: "text-lg leading-[1.3] font-semibold",
      h6: "text-base leading-[1.35] font-semibold",
      "body-lg": "text-lg leading-[1.6]",
      body: "text-base leading-[1.5]",
      "body-sm": "text-sm leading-[1.5]",
      "ui-lg": "text-base leading-[1.4] font-medium",
      ui: "text-sm leading-[1.35] font-medium",
      "ui-sm": "text-xs leading-[1.4] font-medium",
      caption: "text-xs leading-[1.5]",
      overline: "text-[0.625rem] leading-[1.6] tracking-[0.1em] font-semibold uppercase"
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      destructive: "text-destructive"
    }
  },
  defaultVariants: {
    variant: "body",
    color: "default"
  }
})

interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, color, as, ...props }, ref) => {
    // Auto-select element based on variant
    const Component = as || (variant?.startsWith("h") ? variant as "h1" : "p")

    return (
      <Component
        ref={ref as React.Ref<HTMLParagraphElement>}
        className={cn(textVariants({ variant, color }), className)}
        {...props}
      />
    )
  }
)
Text.displayName = "Text"

export { Text, textVariants }
```

### Usage Examples

```typescript
// Headings with proper line height
<Text variant="h1">Welcome to Our Platform</Text>
<Text variant="h2">Getting Started</Text>
<Text variant="h3">Quick Setup Guide</Text>

// Body text with 1.5x line height
<Text variant="body">
  This paragraph has optimal readability with 1.5x line height,
  making it easy to read across multiple lines without losing
  your place.
</Text>

// UI text with balanced line height
<Text variant="ui">Button Label</Text>
<Text variant="ui-sm" color="muted">Helper text</Text>

// Display for hero sections
<Text variant="display-xl">
  Build Something Amazing
</Text>
```

## Line Length Considerations

Optimal line lengths for each text type:

```typescript
const lineLength = {
  // Characters per line
  heading: { min: 15, max: 40, optimal: 25 },
  body: { min: 45, max: 75, optimal: 65 },
  ui: { min: 20, max: 50, optimal: 35 }
}

// CSS max-width for optimal reading
const maxWidthClasses = {
  prose: "max-w-prose",          // ~65ch
  "prose-sm": "max-w-[45ch]",    // Narrower
  "prose-lg": "max-w-[75ch]"     // Wider
}
```

## Best Practices

| Context | Line Height | Rationale |
|---------|-------------|-----------|
| Display (48px+) | 1.1x | Tighter for visual impact |
| Headings | 1.125-1.2x | Balance impact and clarity |
| Body text | 1.5x | Optimal readability |
| Long-form reading | 1.6x | Reduced eye strain |
| UI labels | 1.25-1.4x | Compact but readable |
| Buttons | 1x | Single line, tight |
| Small text (<12px) | 1.5-1.6x | More space for clarity |

## Validation

```typescript
/**
 * Validate line height is within optimal range
 */
const validateLineHeight = (
  fontSize: number,
  lineHeight: number,
  context: "heading" | "body" | "ui"
): { valid: boolean; message?: string } => {
  const ranges = {
    heading: { min: 1.1, max: 1.3 },
    body: { min: 1.4, max: 1.7 },
    ui: { min: 1.2, max: 1.5 }
  }

  const { min, max } = ranges[context]

  if (lineHeight < min) {
    return {
      valid: false,
      message: `Line height ${lineHeight} is too tight for ${context}. Minimum: ${min}`
    }
  }

  if (lineHeight > max) {
    return {
      valid: false,
      message: `Line height ${lineHeight} is too loose for ${context}. Maximum: ${max}`
    }
  }

  return { valid: true }
}
```

## Export

```typescript
export {
  calculateLineHeight,
  getLineHeight,
  getLineHeightPx,
  typeScale,
  Text,
  textVariants,
  validateLineHeight
}
export type { TypeStyle, TextProps }
```
