# Line Length Validator

Optimal line length (measure) validation ensuring 40-60 characters for maximum readability.

## Overview

Line length significantly impacts reading comfort:
- **Too short** (<40 chars): Frequent line breaks disrupt reading flow
- **Too long** (>75 chars): Eyes struggle to track to next line
- **Optimal** (45-75 chars): Easy scanning, reduced eye fatigue

## Optimal Ranges

| Content Type | Min | Optimal | Max | CSS Width |
|--------------|-----|---------|-----|-----------|
| Body text | 45 | 65 | 75 | `max-w-prose` (~65ch) |
| Headings | 15 | 25 | 40 | `max-w-xl` |
| Captions | 30 | 45 | 55 | `max-w-sm` |
| UI labels | 10 | 20 | 35 | Natural width |
| Code | 80 | 100 | 120 | `max-w-4xl` |

## CSS Unit: `ch`

The `ch` unit equals the width of the "0" character in the current font:

```css
.prose {
  max-width: 65ch;  /* ~65 characters */
}

.caption {
  max-width: 45ch;
}

.heading {
  max-width: 25ch;
}
```

## Validation Schema

```typescript
interface LineLengthConfig {
  type: "body" | "heading" | "caption" | "ui" | "code"
  minChars: number
  maxChars: number
  optimalChars: number
}

const lineLengthConfigs: Record<string, LineLengthConfig> = {
  body: {
    type: "body",
    minChars: 45,
    maxChars: 75,
    optimalChars: 65
  },
  heading: {
    type: "heading",
    minChars: 15,
    maxChars: 40,
    optimalChars: 25
  },
  caption: {
    type: "caption",
    minChars: 30,
    maxChars: 55,
    optimalChars: 45
  },
  ui: {
    type: "ui",
    minChars: 10,
    maxChars: 35,
    optimalChars: 20
  },
  code: {
    type: "code",
    minChars: 80,
    maxChars: 120,
    optimalChars: 100
  }
}
```

## Validation Function

```typescript
interface ValidationResult {
  valid: boolean
  actualWidth: string
  recommendedWidth: string
  message?: string
  severity: "error" | "warning" | "info"
}

/**
 * Validate that a container has optimal line length
 */
const validateLineLength = (
  element: HTMLElement,
  type: keyof typeof lineLengthConfigs = "body"
): ValidationResult => {
  const config = lineLengthConfigs[type]
  const computedStyle = getComputedStyle(element)
  const fontSize = parseFloat(computedStyle.fontSize)

  // Get width in characters (approximate)
  const widthPx = element.clientWidth
  const avgCharWidth = fontSize * 0.5  // Approximate
  const widthInChars = Math.round(widthPx / avgCharWidth)

  if (widthInChars < config.minChars) {
    return {
      valid: false,
      actualWidth: `${widthInChars}ch`,
      recommendedWidth: `${config.optimalChars}ch`,
      message: `Line length too short (${widthInChars}ch). Minimum: ${config.minChars}ch`,
      severity: "warning"
    }
  }

  if (widthInChars > config.maxChars) {
    return {
      valid: false,
      actualWidth: `${widthInChars}ch`,
      recommendedWidth: `${config.optimalChars}ch`,
      message: `Line length too long (${widthInChars}ch). Maximum: ${config.maxChars}ch`,
      severity: "error"
    }
  }

  return {
    valid: true,
    actualWidth: `${widthInChars}ch`,
    recommendedWidth: `${config.optimalChars}ch`,
    severity: "info"
  }
}
```

## CSS Classes

### Tailwind Utilities

```css
/* Default Tailwind max-width utilities */
.max-w-prose { max-width: 65ch; }

/* Custom line length utilities */
@layer utilities {
  .measure-narrow {
    max-width: 45ch;
  }

  .measure {
    max-width: 65ch;
  }

  .measure-wide {
    max-width: 75ch;
  }

  .measure-heading {
    max-width: 25ch;
  }

  .measure-caption {
    max-width: 45ch;
  }

  .measure-code {
    max-width: 100ch;
  }
}
```

### CSS Variables

```css
:root {
  /* Character-based widths */
  --measure-narrow: 45ch;
  --measure: 65ch;
  --measure-wide: 75ch;

  /* Pixel-based equivalents (approximate for 16px base) */
  --measure-narrow-px: 360px;
  --measure-px: 520px;
  --measure-wide-px: 600px;

  /* Context-specific */
  --measure-heading: 25ch;
  --measure-caption: 45ch;
  --measure-code: 100ch;
}
```

## Prose Component

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const proseVariants = cva(
  "text-foreground",
  {
    variants: {
      width: {
        narrow: "max-w-[45ch]",
        default: "max-w-prose",  // 65ch
        wide: "max-w-[75ch]",
        full: "max-w-none"
      },
      size: {
        sm: "text-sm leading-relaxed",
        default: "text-base leading-relaxed",
        lg: "text-lg leading-relaxed"
      },
      center: {
        true: "mx-auto",
        false: ""
      }
    },
    defaultVariants: {
      width: "default",
      size: "default",
      center: false
    }
  }
)

interface ProseProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof proseVariants> {}

const Prose = React.forwardRef<HTMLDivElement, ProseProps>(
  ({ className, width, size, center, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(proseVariants({ width, size, center }), className)}
      {...props}
    />
  )
)
Prose.displayName = "Prose"

export { Prose, proseVariants }
```

## Container Components

### Text Container

```typescript
interface TextContainerProps {
  children: React.ReactNode
  type?: "body" | "heading" | "caption"
  center?: boolean
  className?: string
}

const TextContainer = ({
  children,
  type = "body",
  center = false,
  className
}: TextContainerProps) => {
  const widthClass = {
    body: "max-w-prose",      // 65ch
    heading: "max-w-[25ch]",
    caption: "max-w-[45ch]"
  }[type]

  return (
    <div className={cn(widthClass, center && "mx-auto", className)}>
      {children}
    </div>
  )
}
```

### Article Layout

```typescript
const ArticleLayout = ({ children }: { children: React.ReactNode }) => (
  <article className="container py-8">
    {/* Constrained content width */}
    <div className="max-w-prose mx-auto">
      {children}
    </div>
  </article>
)

// Usage
<ArticleLayout>
  <h1 className="text-heading-1 max-w-[20ch]">
    Article Title Here
  </h1>
  <p className="text-body mt-4">
    Body text is automatically constrained to 65 characters
    for optimal readability. This width provides the best
    balance between easy scanning and comfortable reading.
  </p>
</ArticleLayout>
```

## Responsive Line Length

```typescript
// Responsive prose widths
const responsiveProse = {
  base: "max-w-full",        // Full width on mobile
  sm: "sm:max-w-[55ch]",     // Narrower on small screens
  md: "md:max-w-prose",      // Optimal on medium+
  lg: "lg:max-w-[70ch]"      // Slightly wider on large
}

// Usage
<p className="max-w-full sm:max-w-[55ch] md:max-w-prose">
  Responsive paragraph with appropriate width at each breakpoint.
</p>
```

## Width Calculation

### Characters to Pixels

```typescript
/**
 * Convert character width to approximate pixels
 * Based on average character width in common fonts
 */
const chToPx = (
  chars: number,
  fontSizePx: number = 16,
  fontFamily: "sans" | "serif" | "mono" = "sans"
): number => {
  // Average character width ratios
  const ratios = {
    sans: 0.5,    // ~50% of font size
    serif: 0.52,  // Slightly wider
    mono: 0.6     // Fixed width
  }

  return Math.round(chars * fontSizePx * ratios[fontFamily])
}

// Examples
chToPx(65, 16, "sans")  // => 520px
chToPx(65, 18, "sans")  // => 585px
chToPx(65, 16, "mono")  // => 624px
```

### Pixels to Characters

```typescript
/**
 * Convert pixel width to approximate characters
 */
const pxToCh = (
  pixels: number,
  fontSizePx: number = 16,
  fontFamily: "sans" | "serif" | "mono" = "sans"
): number => {
  const ratios = {
    sans: 0.5,
    serif: 0.52,
    mono: 0.6
  }

  return Math.round(pixels / (fontSizePx * ratios[fontFamily]))
}

// Examples
pxToCh(520, 16, "sans")  // => 65ch
pxToCh(600, 16, "sans")  // => 75ch
```

## Quality Checker Integration

```typescript
interface LineLengthCheck {
  element: string
  selector: string
  type: "body" | "heading" | "caption"
  result: ValidationResult
}

/**
 * Check all text containers in a component
 */
const checkComponentLineLength = (
  componentCode: string
): LineLengthCheck[] => {
  const checks: LineLengthCheck[] = []

  // Pattern: elements that should have constrained width
  const patterns = [
    { selector: "article p", type: "body" as const },
    { selector: "article h1, article h2", type: "heading" as const },
    { selector: ".caption, figcaption", type: "caption" as const }
  ]

  // Check if appropriate max-width classes are used
  const hasMaxWProse = /max-w-prose|max-w-\[[\d]+ch\]/.test(componentCode)

  if (!hasMaxWProse) {
    checks.push({
      element: "prose container",
      selector: "article, .prose",
      type: "body",
      result: {
        valid: false,
        actualWidth: "unconstrained",
        recommendedWidth: "65ch",
        message: "Body text should be constrained with max-w-prose",
        severity: "warning"
      }
    })
  }

  return checks
}
```

## Tailwind Plugin

```typescript
// tailwind.config.ts
import plugin from "tailwindcss/plugin"

const lineLengthPlugin = plugin(({ addUtilities }) => {
  addUtilities({
    // Character-based widths
    ".w-measure-narrow": { width: "45ch" },
    ".w-measure": { width: "65ch" },
    ".w-measure-wide": { width: "75ch" },

    // Max-width variants
    ".max-w-measure-narrow": { maxWidth: "45ch" },
    ".max-w-measure": { maxWidth: "65ch" },
    ".max-w-measure-wide": { maxWidth: "75ch" },

    // Min-width variants
    ".min-w-measure-narrow": { minWidth: "45ch" },
    ".min-w-measure": { minWidth: "65ch" },

    // Context-specific
    ".max-w-heading": { maxWidth: "25ch" },
    ".max-w-caption": { maxWidth: "45ch" },
    ".max-w-code": { maxWidth: "100ch" }
  })
})

export default lineLengthPlugin
```

## Best Practices

| Do | Don't |
|----|-------|
| Use `ch` units for text | Use fixed pixel widths |
| Constrain body text to 65ch | Let text span full width |
| Use narrower widths for headings | Apply same width everywhere |
| Center long-form content | Left-align wide paragraphs |
| Test at different font sizes | Assume fixed character width |
| Adjust for responsive | Use single fixed width |

## Examples

### Blog Post

```typescript
<article className="container py-12">
  <header className="max-w-prose mx-auto mb-8">
    <h1 className="text-heading-1 max-w-[20ch]">
      Understanding Line Length in Typography
    </h1>
    <p className="text-body-lg text-muted-foreground mt-4 max-w-[55ch]">
      A short introduction that's slightly narrower than body text.
    </p>
  </header>

  <div className="max-w-prose mx-auto">
    <p className="text-body">
      Body paragraphs at optimal 65ch width for comfortable reading.
      This width has been studied extensively and provides the best
      balance between readability and efficient use of space.
    </p>
  </div>
</article>
```

### Card Grid

```typescript
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  {cards.map(card => (
    <Card key={card.id}>
      <CardHeader>
        {/* Headings constrained within card */}
        <CardTitle className="max-w-[20ch]">{card.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Card body text naturally constrained by card width */}
        <p className="text-body-sm">{card.description}</p>
      </CardContent>
    </Card>
  ))}
</div>
```

## Export

```typescript
export {
  validateLineLength,
  lineLengthConfigs,
  Prose,
  proseVariants,
  TextContainer,
  chToPx,
  pxToCh,
  checkComponentLineLength
}
export type { LineLengthConfig, ValidationResult, ProseProps }
```
