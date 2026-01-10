# Image Upload Analyzer for Mockup-to-Code

AI-powered analysis system for converting design mockups to production-ready code.

## Overview

The Image Analyzer enables the frontend agent to:
1. Accept uploaded design images (mockups, screenshots, wireframes)
2. Extract visual components, layout, colors, and typography
3. Generate structured analysis for code generation
4. Output production-ready React/TypeScript components

## Analysis Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     IMAGE ANALYSIS PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Upload  │───▶│  Vision  │───▶│ Structure│───▶│   Code   │  │
│  │  Image   │    │ Analysis │    │ Mapping  │    │Generation│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  Formats:        Extract:        Map to:         Output:        │
│  - PNG/JPG       - Components    - shadcn/ui     - TSX          │
│  - Figma export  - Layout        - Tailwind      - Styles       │
│  - Screenshot    - Colors        - CVA variants  - Types        │
│  - Wireframe     - Typography    - Grid system   - Props        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Image Analysis Prompt Template

When analyzing a design image, use this structured prompt:

```markdown
## Design Analysis Request

Analyze this design mockup and extract the following information:

### 1. Component Identification
- Identify all UI components visible in the design
- Classify each component type (button, card, input, navigation, etc.)
- Note component hierarchy and nesting relationships

### 2. Layout Analysis
- Determine overall layout structure (grid, flex, stack)
- Identify responsive breakpoint considerations
- Note spacing patterns and alignment

### 3. Color Extraction
- Extract primary, secondary, and accent colors
- Identify background and foreground colors
- Note any gradients or color effects

### 4. Typography Analysis
- Identify heading levels and body text styles
- Estimate font sizes and weights
- Note text colors and alignment

### 5. Component States
- Identify any visible states (hover, active, disabled)
- Note focus indicators or interactive feedback

### 6. Spacing & Sizing
- Estimate padding and margin values
- Identify consistent spacing patterns
- Note component dimensions

Output the analysis as structured JSON for code generation.
```

## Analysis Output Schema

```typescript
interface DesignAnalysis {
  /**
   * Overall page/section metadata
   */
  metadata: {
    type: "page" | "section" | "component"
    name: string
    description: string
    estimatedComplexity: "simple" | "moderate" | "complex"
  }

  /**
   * Layout structure
   */
  layout: {
    type: "flex" | "grid" | "stack"
    direction?: "row" | "column"
    columns?: number
    gap: string
    padding: string
    maxWidth?: string
    alignment: {
      horizontal: "start" | "center" | "end" | "between" | "around"
      vertical: "start" | "center" | "end" | "stretch"
    }
  }

  /**
   * Color palette extracted from design
   */
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
    muted: string
    border: string
    custom: Record<string, string>
  }

  /**
   * Typography styles
   */
  typography: {
    headings: {
      h1: { size: string; weight: string; lineHeight: string }
      h2: { size: string; weight: string; lineHeight: string }
      h3: { size: string; weight: string; lineHeight: string }
    }
    body: { size: string; weight: string; lineHeight: string }
    caption: { size: string; weight: string; lineHeight: string }
  }

  /**
   * Identified components
   */
  components: ComponentAnalysis[]

  /**
   * Responsive considerations
   */
  responsive: {
    mobileFirst: boolean
    breakpoints: {
      sm?: LayoutOverride
      md?: LayoutOverride
      lg?: LayoutOverride
    }
  }
}

interface ComponentAnalysis {
  id: string
  type: ComponentType
  name: string
  position: {
    row?: number
    column?: number
    span?: number
    order?: number
  }
  props: Record<string, unknown>
  children?: ComponentAnalysis[]
  variants?: string[]
  states?: ("hover" | "active" | "disabled" | "focus")[]
}

type ComponentType =
  | "button"
  | "input"
  | "card"
  | "navigation"
  | "hero"
  | "footer"
  | "sidebar"
  | "modal"
  | "dropdown"
  | "tabs"
  | "accordion"
  | "avatar"
  | "badge"
  | "image"
  | "icon"
  | "text"
  | "heading"
  | "list"
  | "table"
  | "form"
  | "container"
  | "custom"
```

## Component Type Mapping

Map identified components to shadcn/ui equivalents:

| Detected Element | shadcn/ui Component | Notes |
|------------------|---------------------|-------|
| Primary button | `Button` | variant="default" |
| Secondary button | `Button` | variant="secondary" |
| Outline button | `Button` | variant="outline" |
| Text input | `Input` | With Label |
| Search box | `Input` | With search icon |
| Dropdown | `Select` | Or DropdownMenu |
| Checkbox | `Checkbox` | With Label |
| Radio group | `RadioGroup` | Multiple RadioGroupItem |
| Toggle | `Switch` | Boolean toggle |
| Card container | `Card` | With CardHeader, CardContent |
| Modal/Dialog | `Dialog` | With DialogContent |
| Tabs | `Tabs` | TabsList, TabsTrigger, TabsContent |
| Accordion | `Accordion` | AccordionItem, AccordionTrigger |
| Navigation bar | `Navigation` | Custom component |
| Avatar | `Avatar` | AvatarImage, AvatarFallback |
| Badge | `Badge` | variant based on color |
| Alert | `Alert` | AlertTitle, AlertDescription |
| Toast | `Toast` | Via useToast |
| Tooltip | `Tooltip` | TooltipTrigger, TooltipContent |

## Color Extraction Strategy

### From Design to Tailwind

```typescript
const extractColors = (analysis: DesignAnalysis) => {
  // Map to CSS variables for theme consistency
  return {
    ":root": {
      "--primary": analysis.colors.primary,
      "--secondary": analysis.colors.secondary,
      "--accent": analysis.colors.accent,
      "--background": analysis.colors.background,
      "--foreground": analysis.colors.foreground,
      "--muted": analysis.colors.muted,
      "--border": analysis.colors.border
    }
  }
}
```

### Color Format Conversion

```typescript
// Convert hex to OKLCH for modern CSS
const hexToOklch = (hex: string): string => {
  // Implementation uses color-js or similar
  return `oklch(0.7 0.15 250)` // Example output
}

// Generate color scale
const generateScale = (baseColor: string) => ({
  50: lighten(baseColor, 0.95),
  100: lighten(baseColor, 0.9),
  200: lighten(baseColor, 0.8),
  300: lighten(baseColor, 0.6),
  400: lighten(baseColor, 0.4),
  500: baseColor,
  600: darken(baseColor, 0.1),
  700: darken(baseColor, 0.2),
  800: darken(baseColor, 0.3),
  900: darken(baseColor, 0.4),
  950: darken(baseColor, 0.5)
})
```

## Layout Detection Patterns

### Grid Detection

```typescript
const detectGridLayout = (components: ComponentAnalysis[]) => {
  // Check for aligned columns
  const columns = new Set(components.map(c => c.position.column))
  const rows = new Set(components.map(c => c.position.row))

  if (columns.size > 1 && rows.size > 1) {
    return {
      type: "grid",
      columns: columns.size,
      rows: rows.size,
      template: `repeat(${columns.size}, 1fr)`
    }
  }

  return null
}
```

### Flexbox Detection

```typescript
const detectFlexLayout = (components: ComponentAnalysis[]) => {
  // Analyze component positions
  const horizontallyAligned = components.every(
    (c, i, arr) => i === 0 || c.position.row === arr[i - 1].position.row
  )

  const verticallyAligned = components.every(
    (c, i, arr) => i === 0 || c.position.column === arr[i - 1].position.column
  )

  return {
    type: "flex",
    direction: horizontallyAligned ? "row" : "column",
    wrap: components.length > 4 ? "wrap" : "nowrap"
  }
}
```

## Code Generation Templates

### Page Component Template

```typescript
const generatePageComponent = (analysis: DesignAnalysis) => `
"use client"

import * as React from "react"
${generateImports(analysis.components)}

export default function ${analysis.metadata.name}() {
  return (
    <div className="${generateLayoutClasses(analysis.layout)}">
      ${generateComponentTree(analysis.components)}
    </div>
  )
}
`
```

### Component Generation

```typescript
const generateComponent = (component: ComponentAnalysis) => {
  switch (component.type) {
    case "button":
      return generateButton(component)
    case "card":
      return generateCard(component)
    case "input":
      return generateInput(component)
    case "navigation":
      return generateNavigation(component)
    // ... other component types
    default:
      return generateCustomComponent(component)
  }
}

const generateButton = (component: ComponentAnalysis) => {
  const { props, variants } = component
  return `
<Button
  variant="${props.variant || 'default'}"
  size="${props.size || 'default'}"
  ${props.icon ? `asChild` : ''}
>
  ${props.icon ? `<${props.icon} className="mr-2 h-4 w-4" />` : ''}
  ${props.label}
</Button>`
}
```

## Analysis Examples

### Example 1: Hero Section

**Input**: Screenshot of a hero section with headline, subtext, and CTA buttons

**Analysis Output**:
```json
{
  "metadata": {
    "type": "section",
    "name": "HeroSection",
    "description": "Landing page hero with headline and CTAs",
    "estimatedComplexity": "moderate"
  },
  "layout": {
    "type": "flex",
    "direction": "column",
    "gap": "24px",
    "padding": "96px 24px",
    "alignment": {
      "horizontal": "center",
      "vertical": "center"
    }
  },
  "components": [
    {
      "id": "headline",
      "type": "heading",
      "name": "Headline",
      "props": {
        "level": "h1",
        "text": "Build faster with our platform",
        "className": "text-5xl font-bold text-center"
      }
    },
    {
      "id": "subheadline",
      "type": "text",
      "name": "Subheadline",
      "props": {
        "text": "The complete toolkit for modern web development",
        "className": "text-xl text-muted-foreground text-center max-w-2xl"
      }
    },
    {
      "id": "cta-group",
      "type": "container",
      "name": "CTAGroup",
      "props": {
        "className": "flex gap-4"
      },
      "children": [
        {
          "id": "primary-cta",
          "type": "button",
          "props": {
            "variant": "default",
            "size": "lg",
            "label": "Get Started"
          }
        },
        {
          "id": "secondary-cta",
          "type": "button",
          "props": {
            "variant": "outline",
            "size": "lg",
            "label": "Learn More"
          }
        }
      ]
    }
  ]
}
```

**Generated Code**:
```typescript
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center gap-6 py-24 px-6">
      <h1 className="text-5xl font-bold text-center">
        Build faster with our platform
      </h1>
      <p className="text-xl text-muted-foreground text-center max-w-2xl">
        The complete toolkit for modern web development
      </p>
      <div className="flex gap-4">
        <Button size="lg">Get Started</Button>
        <Button variant="outline" size="lg">Learn More</Button>
      </div>
    </section>
  )
}
```

### Example 2: Card Grid

**Input**: Design showing a 3-column grid of feature cards

**Analysis Output**:
```json
{
  "metadata": {
    "type": "section",
    "name": "FeatureGrid",
    "estimatedComplexity": "moderate"
  },
  "layout": {
    "type": "grid",
    "columns": 3,
    "gap": "24px",
    "padding": "48px 24px"
  },
  "components": [
    {
      "id": "card-1",
      "type": "card",
      "props": {
        "icon": "Zap",
        "title": "Lightning Fast",
        "description": "Optimized for performance"
      }
    },
    {
      "id": "card-2",
      "type": "card",
      "props": {
        "icon": "Shield",
        "title": "Secure",
        "description": "Enterprise-grade security"
      }
    },
    {
      "id": "card-3",
      "type": "card",
      "props": {
        "icon": "Users",
        "title": "Collaborative",
        "description": "Built for teams"
      }
    }
  ],
  "responsive": {
    "mobileFirst": true,
    "breakpoints": {
      "sm": { "columns": 1 },
      "md": { "columns": 2 },
      "lg": { "columns": 3 }
    }
  }
}
```

## Agent Integration

### Image Upload Handler

```typescript
// In the agent workflow
const analyzeDesignImage = async (imagePath: string) => {
  // 1. Read the image file
  const imageData = await readImage(imagePath)

  // 2. Send to vision model for analysis
  const analysis = await analyzeWithVision(imageData, ANALYSIS_PROMPT)

  // 3. Parse and validate analysis
  const parsedAnalysis = parseAnalysisOutput(analysis)

  // 4. Generate component code
  const generatedCode = generateComponentCode(parsedAnalysis)

  return {
    analysis: parsedAnalysis,
    code: generatedCode
  }
}
```

### Agent Prompt for Image Analysis

```markdown
You are analyzing a design mockup to generate React components.

When the user uploads an image:

1. **Describe what you see** - List all visual elements
2. **Identify components** - Map to shadcn/ui components
3. **Extract styles** - Colors, typography, spacing
4. **Determine layout** - Grid, flexbox, positioning
5. **Generate code** - Production-ready TSX

Always output:
- Clean, typed TypeScript/React code
- Tailwind CSS classes
- Proper shadcn/ui imports
- Responsive considerations
```

## Quality Checklist

Before outputting generated code, verify:

- [ ] All identified components mapped to code
- [ ] Colors extracted and applied consistently
- [ ] Typography matches design hierarchy
- [ ] Spacing follows 8px grid system
- [ ] Layout is responsive (mobile-first)
- [ ] Accessibility attributes included
- [ ] Code follows project conventions
- [ ] No hardcoded values (use CSS variables)

## Best Practices

| Do | Don't |
|----|-------|
| Extract exact colors from design | Guess color values |
| Use semantic component names | Use generic names like "div1" |
| Apply consistent spacing scale | Use arbitrary pixel values |
| Generate responsive layouts | Only target one screen size |
| Include all visible states | Ignore hover/focus states |
| Map to existing components | Create duplicate components |

## Export

This pattern is used by the `design-analyzer` worker agent in the orchestrator-workers architecture. The analysis output feeds directly into the `component-generator` worker.
