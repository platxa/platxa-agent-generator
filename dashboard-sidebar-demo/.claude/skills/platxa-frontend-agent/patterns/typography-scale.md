# Typography Scale System

A consistent 3-level type hierarchy ensures visual clarity and scannability. This system defines headline, body, and caption styles that work together harmoniously.

## The 3-Level Hierarchy

| Level | Role | Sizes | Weight | Use Cases |
|-------|------|-------|--------|-----------|
| **Headline** | Primary attention | text-2xl to text-6xl | semibold/bold | Page titles, section headers |
| **Body** | Content reading | text-base to text-lg | normal/medium | Paragraphs, descriptions |
| **Caption** | Supporting info | text-xs to text-sm | normal | Labels, metadata, hints |

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  HEADLINE (text-4xl font-bold)                              │
│  Primary Visual Anchor                                       │
│                                                             │
│  Body Text (text-base font-normal)                          │
│  This is where the main content lives. It should be         │
│  comfortable to read for extended periods. Line height      │
│  is relaxed and line length is optimized for readability.   │
│                                                             │
│  Caption (text-sm text-muted-foreground)                    │
│  Supporting information like dates, metadata, hints         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Type Scale Definition

### Font Sizes (Major Third Scale - 1.25 ratio)

```css
@theme {
  /* Caption scale */
  --text-xs: 0.75rem;       /* 12px */
  --text-sm: 0.875rem;      /* 14px */

  /* Body scale */
  --text-base: 1rem;        /* 16px */
  --text-lg: 1.125rem;      /* 18px */

  /* Headline scale */
  --text-xl: 1.25rem;       /* 20px */
  --text-2xl: 1.5rem;       /* 24px */
  --text-3xl: 1.875rem;     /* 30px */
  --text-4xl: 2.25rem;      /* 36px */
  --text-5xl: 3rem;         /* 48px */
  --text-6xl: 3.75rem;      /* 60px */
}
```

### Line Heights

```css
@theme {
  /* Headline: tighter for large text */
  --leading-tight: 1.25;    /* Headlines */
  --leading-snug: 1.375;    /* Subheadlines */

  /* Body: comfortable for reading */
  --leading-normal: 1.5;    /* Default body */
  --leading-relaxed: 1.625; /* Long-form content */

  /* Caption: compact for metadata */
  --leading-none: 1;        /* Single-line labels */
}
```

### Letter Spacing

```css
@theme {
  --tracking-tight: -0.025em;   /* Headlines (large text) */
  --tracking-normal: 0;          /* Body text */
  --tracking-wide: 0.025em;      /* Captions, all-caps */
}
```

## Semantic Typography Tokens

### Headline Styles

```css
/* Headline hierarchy */
.headline-1 {
  @apply text-4xl font-bold tracking-tight leading-tight;
  /* 36px, bold, tight tracking/leading */
}

.headline-2 {
  @apply text-3xl font-semibold tracking-tight leading-tight;
  /* 30px, semibold */
}

.headline-3 {
  @apply text-2xl font-semibold leading-snug;
  /* 24px, semibold */
}

.headline-4 {
  @apply text-xl font-medium leading-snug;
  /* 20px, medium */
}
```

### Body Styles

```css
/* Body text hierarchy */
.body-large {
  @apply text-lg leading-relaxed;
  /* 18px, relaxed line height - intro paragraphs */
}

.body-default {
  @apply text-base leading-normal;
  /* 16px, normal line height - standard content */
}

.body-small {
  @apply text-sm leading-normal;
  /* 14px - dense UI, secondary content */
}
```

### Caption Styles

```css
/* Caption/supporting text */
.caption {
  @apply text-sm text-muted-foreground leading-normal;
  /* 14px, muted color */
}

.caption-small {
  @apply text-xs text-muted-foreground leading-none;
  /* 12px, muted, compact */
}

.label {
  @apply text-sm font-medium leading-none;
  /* 14px, medium weight - form labels */
}

.overline {
  @apply text-xs font-medium uppercase tracking-wide text-muted-foreground;
  /* 12px, uppercase, wide tracking - category labels */
}
```

## Component Patterns

### Page Header

```typescript
<header className="space-y-2">
  {/* Overline - Caption level */}
  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
    Documentation
  </p>

  {/* Title - Headline level */}
  <h1 className="text-4xl font-bold tracking-tight">
    Typography System
  </h1>

  {/* Description - Body level */}
  <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
    A comprehensive guide to using typography consistently across
    your application for optimal readability and visual hierarchy.
  </p>
</header>
```

### Card Component

```typescript
<Card>
  <CardHeader>
    {/* Title - Headline 4 */}
    <CardTitle className="text-xl font-semibold leading-snug">
      Feature Title
    </CardTitle>

    {/* Description - Caption */}
    <CardDescription className="text-sm text-muted-foreground">
      Brief description of the feature
    </CardDescription>
  </CardHeader>

  <CardContent>
    {/* Body text */}
    <p className="text-base leading-normal">
      Main content paragraph with comfortable reading line height
      and appropriate font size for body copy.
    </p>
  </CardContent>

  <CardFooter>
    {/* Metadata - Caption small */}
    <span className="text-xs text-muted-foreground">
      Updated 2 days ago
    </span>
  </CardFooter>
</Card>
```

### Article/Blog Post

```typescript
<article className="prose max-w-2xl">
  {/* Category - Overline */}
  <span className="text-xs font-medium uppercase tracking-wide text-primary">
    Tutorial
  </span>

  {/* Title - Headline 1 */}
  <h1 className="text-4xl font-bold tracking-tight mt-2">
    Getting Started with React
  </h1>

  {/* Meta - Caption */}
  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
    <span>John Doe</span>
    <span>•</span>
    <span>5 min read</span>
    <span>•</span>
    <span>Dec 15, 2024</span>
  </div>

  {/* Lead paragraph - Body large */}
  <p className="text-lg leading-relaxed text-muted-foreground mt-6">
    Learn the fundamentals of React and start building modern
    web applications with this comprehensive guide.
  </p>

  {/* Body content */}
  <div className="text-base leading-relaxed mt-8 space-y-4">
    <p>
      React is a JavaScript library for building user interfaces...
    </p>

    {/* Section heading - Headline 2 */}
    <h2 className="text-2xl font-semibold tracking-tight mt-12">
      Setting Up Your Environment
    </h2>

    <p>
      Before we begin, you'll need to install Node.js...
    </p>

    {/* Subsection - Headline 3 */}
    <h3 className="text-xl font-medium mt-8">
      Installing Dependencies
    </h3>
  </div>
</article>
```

### Form Layout

```typescript
<form className="space-y-6">
  {/* Form section title - Headline 3 */}
  <h2 className="text-2xl font-semibold">Account Settings</h2>

  <div className="space-y-4">
    <div className="space-y-2">
      {/* Label - Caption weight */}
      <Label className="text-sm font-medium">
        Email Address
      </Label>

      <Input type="email" />

      {/* Helper text - Caption */}
      <p className="text-sm text-muted-foreground">
        We'll use this for important notifications
      </p>
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Display Name
      </Label>

      <Input type="text" />

      {/* Error text - Caption with error color */}
      <p className="text-sm text-destructive">
        Display name is required
      </p>
    </div>
  </div>
</form>
```

### Data Table

```typescript
<Table>
  <TableHeader>
    <TableRow>
      {/* Column headers - Caption weight */}
      <TableHead className="text-xs font-medium uppercase tracking-wide">
        Name
      </TableHead>
      <TableHead className="text-xs font-medium uppercase tracking-wide">
        Status
      </TableHead>
      <TableHead className="text-xs font-medium uppercase tracking-wide">
        Date
      </TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    <TableRow>
      {/* Primary data - Body small */}
      <TableCell className="text-sm font-medium">
        Project Alpha
      </TableCell>

      {/* Secondary data - Caption */}
      <TableCell className="text-sm text-muted-foreground">
        Active
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        Dec 15, 2024
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Responsive Typography

### Mobile-First Scaling

```typescript
// Headlines scale down on mobile
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
  Responsive Headline
</h1>

// Body maintains readability
<p className="text-base md:text-lg leading-relaxed">
  Body text that's comfortable on all screen sizes.
</p>

// Captions stay consistent
<span className="text-xs md:text-sm text-muted-foreground">
  Caption text
</span>
```

### Fluid Typography (Advanced)

```css
/* Using clamp() for smooth scaling */
.fluid-headline {
  font-size: clamp(1.5rem, 4vw + 1rem, 3rem);
  line-height: 1.2;
}

.fluid-body {
  font-size: clamp(1rem, 1vw + 0.75rem, 1.125rem);
  line-height: 1.6;
}
```

## Line Length (Measure)

Optimal line length for readability: **45-75 characters**

```typescript
// Constrain prose content
<article className="max-w-prose">
  {/* max-w-prose = 65ch ≈ 65 characters */}
  <p>Content with optimal line length for reading...</p>
</article>

// Or explicit character width
<div className="max-w-[65ch]">
  <p>Explicitly set to 65 characters wide</p>
</div>

// Wider for headlines
<h1 className="max-w-4xl">
  Headlines can span wider since they're shorter
</h1>
```

## Typography Components

### Heading Component

```typescript
import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
  as?: HeadingLevel
}

const headingStyles: Record<HeadingLevel, string> = {
  h1: "text-4xl font-bold tracking-tight",
  h2: "text-3xl font-semibold tracking-tight",
  h3: "text-2xl font-semibold",
  h4: "text-xl font-medium",
  h5: "text-lg font-medium",
  h6: "text-base font-medium"
}

export function Heading({
  level = "h2",
  as,
  className,
  children,
  ...props
}: HeadingProps) {
  const Component = as ?? level

  return (
    <Component
      className={cn(headingStyles[level], className)}
      {...props}
    >
      {children}
    </Component>
  )
}

// Usage
<Heading level="h1">Page Title</Heading>
<Heading level="h2" as="h3">Visually h2, semantically h3</Heading>
```

### Text Component

```typescript
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const textVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      destructive: "text-destructive"
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl"
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold"
    },
    leading: {
      none: "leading-none",
      tight: "leading-tight",
      normal: "leading-normal",
      relaxed: "leading-relaxed"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "base",
    weight: "normal",
    leading: "normal"
  }
})

interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div"
}

export function Text({
  as: Component = "p",
  variant,
  size,
  weight,
  leading,
  className,
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(textVariants({ variant, size, weight, leading }), className)}
      {...props}
    />
  )
}

// Usage
<Text size="lg" leading="relaxed">Lead paragraph</Text>
<Text variant="muted" size="sm">Caption text</Text>
<Text weight="medium">Emphasized text</Text>
```

## Validation Rules

The design-analyzer validates typography usage:

```typescript
interface TypographyAnalysis {
  hasHeadlineHierarchy: boolean
  hasBodyText: boolean
  hasCaptions: boolean
  issues: TypographyIssue[]
}

function analyzeTypography(component: string): TypographyAnalysis {
  const issues: TypographyIssue[] = []

  // Check for skipped heading levels
  const headings = extractHeadings(component)
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      issues.push({
        type: "skipped-level",
        message: `Skipped from h${headings[i - 1].level} to h${headings[i].level}`,
        suggestion: "Use consecutive heading levels for accessibility"
      })
    }
  }

  // Check for missing hierarchy
  const hasH1 = component.includes("text-4xl") || component.includes("text-3xl")
  const hasBody = component.includes("text-base") || component.includes("text-lg")
  const hasCaption = component.includes("text-sm") || component.includes("text-xs")

  if (!hasH1 && component.length > 500) {
    issues.push({
      type: "missing-headline",
      message: "Large component lacks headline text",
      suggestion: "Add a text-2xl or larger heading"
    })
  }

  return {
    hasHeadlineHierarchy: hasH1,
    hasBodyText: hasBody,
    hasCaptions: hasCaption,
    issues
  }
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use 3 distinct levels (headline, body, caption) | Use more than 4-5 different sizes |
| Maintain consistent line height per level | Mix line heights arbitrarily |
| Use semantic heading elements (h1-h6) | Skip heading levels |
| Constrain body text to 65ch | Let text span full width |
| Use muted-foreground for secondary text | Use multiple gray shades |
| Scale headlines responsively | Keep same size on all screens |

## Quick Reference

```typescript
// Headline
className="text-4xl font-bold tracking-tight"    // h1
className="text-2xl font-semibold"               // h2
className="text-xl font-medium"                  // h3

// Body
className="text-lg leading-relaxed"              // lead
className="text-base leading-normal"             // default
className="text-sm leading-normal"               // small

// Caption
className="text-sm text-muted-foreground"        // caption
className="text-xs text-muted-foreground"        // small caption
className="text-xs uppercase tracking-wide"      // overline
```
