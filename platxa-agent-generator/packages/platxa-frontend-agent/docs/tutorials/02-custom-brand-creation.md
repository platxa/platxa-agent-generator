# Tutorial 2: Custom Brand Creation

**Video Duration:** ~15 minutes
**Level:** Intermediate
**Prerequisites:** Completed Tutorial 1

---

## Video Script

### [0:00] Introduction

> "Welcome back! In this tutorial, we'll create a custom brand kit for Platxa. You'll learn how to define your own colors, typography, and design tokens that maintain consistency across your entire application."

**On Screen:** Example of before/after brand customization

---

### [0:45] Understanding Brand Kits

> "A brand kit in Platxa is a JSON configuration that defines your design system. It includes semantic colors, spacing, typography, and more."

**Key Concepts:**
```
Brand Kit
├── name          → Brand identifier
├── light         → Light mode tokens
│   ├── colors    → Semantic color definitions
│   ├── spacing   → Spacing scale
│   ├── typography → Font sizes and line heights
│   └── radius    → Border radius values
├── dark          → Dark mode color overrides
└── extends       → Parent brand to inherit from
```

> "The magic is in semantic colors. Instead of using 'blue' or '#3b82f6', you use 'primary' - and Platxa handles the rest."

---

### [2:00] Creating Your Brand Kit File

> "Let's create a brand kit for a fintech application with a professional, trustworthy feel."

**File: `brand-kit.json`**
```json
{
  "name": "fintech-pro",
  "light": {
    "colors": {
      "primary": "#0066cc",
      "primaryForeground": "#ffffff",
      "secondary": "#f0f4f8",
      "secondaryForeground": "#1a365d",
      "background": "#ffffff",
      "foreground": "#1a202c",
      "muted": "#edf2f7",
      "mutedForeground": "#718096",
      "accent": "#38a169",
      "accentForeground": "#ffffff",
      "destructive": "#e53e3e",
      "destructiveForeground": "#ffffff",
      "card": "#ffffff",
      "cardForeground": "#1a202c",
      "popover": "#ffffff",
      "popoverForeground": "#1a202c",
      "border": "#e2e8f0",
      "input": "#e2e8f0",
      "ring": "#0066cc"
    }
  }
}
```

> "We're using a blue primary for trust, green accent for positive actions, and a clean neutral palette."

---

### [4:00] Semantic Color Deep Dive

> "Let's understand each semantic color and its purpose."

**Color Roles Explained:**

| Token | Purpose | Usage Example |
|-------|---------|---------------|
| `primary` | Brand identity | Buttons, links, highlights |
| `primaryForeground` | Text on primary | Button labels |
| `secondary` | Supporting elements | Secondary buttons, badges |
| `background` | Page background | Main content area |
| `foreground` | Primary text | Body text, headings |
| `muted` | Subtle backgrounds | Input backgrounds, cards |
| `mutedForeground` | Secondary text | Placeholders, captions |
| `accent` | Highlights, success | Success states, CTAs |
| `destructive` | Errors, dangers | Delete buttons, alerts |
| `border` | Dividers, outlines | Card borders, separators |
| `ring` | Focus indicators | Keyboard focus rings |

> "Always define foreground colors for backgrounds. This ensures text remains readable."

---

### [6:00] Adding Dark Mode

> "Modern apps need dark mode. Let's add dark theme colors."

**Update `brand-kit.json`:**
```json
{
  "name": "fintech-pro",
  "light": {
    "colors": {
      "primary": "#0066cc",
      "primaryForeground": "#ffffff",
      "secondary": "#f0f4f8",
      "secondaryForeground": "#1a365d",
      "background": "#ffffff",
      "foreground": "#1a202c",
      "muted": "#edf2f7",
      "mutedForeground": "#718096",
      "accent": "#38a169",
      "accentForeground": "#ffffff",
      "destructive": "#e53e3e",
      "destructiveForeground": "#ffffff",
      "card": "#ffffff",
      "cardForeground": "#1a202c",
      "popover": "#ffffff",
      "popoverForeground": "#1a202c",
      "border": "#e2e8f0",
      "input": "#e2e8f0",
      "ring": "#0066cc"
    }
  },
  "dark": {
    "primary": "#3399ff",
    "primaryForeground": "#0a1628",
    "secondary": "#1e293b",
    "secondaryForeground": "#e2e8f0",
    "background": "#0f172a",
    "foreground": "#f1f5f9",
    "muted": "#1e293b",
    "mutedForeground": "#94a3b8",
    "accent": "#4ade80",
    "accentForeground": "#0a1628",
    "destructive": "#f87171",
    "destructiveForeground": "#0a1628",
    "card": "#1e293b",
    "cardForeground": "#f1f5f9",
    "popover": "#1e293b",
    "popoverForeground": "#f1f5f9",
    "border": "#334155",
    "input": "#334155",
    "ring": "#3399ff"
  }
}
```

> "Notice how dark mode colors are lighter versions. Primary blue becomes brighter, backgrounds become dark slate."

---

### [8:00] Using OKLCH Colors

> "For more precise color control, use OKLCH - the modern perceptually uniform color space."

**OKLCH Format:**
```
oklch(L C H)
     │ │ └─ Hue (0-360)
     │ └─── Chroma (0-0.4, saturation)
     └───── Lightness (0-1)
```

**Example with OKLCH:**
```json
{
  "light": {
    "colors": {
      "primary": "oklch(0.55 0.2 250)",
      "primaryForeground": "oklch(0.99 0 0)",
      "secondary": "oklch(0.96 0.01 250)",
      "background": "oklch(0.99 0 0)",
      "foreground": "oklch(0.2 0.02 250)"
    }
  }
}
```

> "OKLCH gives you predictable lightness across hues. Setting L to 0.55 gives consistent mid-tones whether the hue is blue, green, or red."

---

### [9:30] Adding Spacing and Typography

> "Let's customize spacing and typography scales."

**Extended Brand Kit:**
```json
{
  "name": "fintech-pro",
  "light": {
    "colors": { ... },
    "spacing": {
      "xs": "0.25rem",
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "xs": { "fontSize": "0.75rem", "lineHeight": "1rem" },
      "sm": { "fontSize": "0.875rem", "lineHeight": "1.25rem" },
      "base": { "fontSize": "1rem", "lineHeight": "1.5rem" },
      "lg": { "fontSize": "1.125rem", "lineHeight": "1.75rem" },
      "xl": { "fontSize": "1.25rem", "lineHeight": "1.75rem" },
      "2xl": { "fontSize": "1.5rem", "lineHeight": "2rem" }
    },
    "radius": {
      "sm": "0.25rem",
      "md": "0.375rem",
      "lg": "0.5rem",
      "full": "9999px"
    }
  },
  "dark": { ... }
}
```

> "These tokens create a cohesive system. Use 'md' spacing consistently, and your UI will feel unified."

---

### [11:00] Generating CSS from Brand Kit

> "Now let's generate CSS variables from our brand kit."

**Using the Theme Worker:**
```typescript
import { generateTheme } from "@platxa/frontend-agent/theme"
import brandKit from "./brand-kit.json"

const theme = generateTheme(brandKit)

console.log(theme.css)
// Outputs CSS with all variables

console.log(theme.tailwindTheme)
// Outputs @theme block for Tailwind
```

**Generated CSS:**
```css
:root {
  --color-primary: #0066cc;
  --color-primary-foreground: #ffffff;
  --color-secondary: #f0f4f8;
  /* ... all tokens as CSS variables */
}

.dark {
  --color-primary: #3399ff;
  --color-background: #0f172a;
  /* ... dark mode overrides */
}
```

> "The generated CSS can be imported directly into your project."

---

### [12:30] Validating Your Brand Kit

> "Let's validate our brand kit for accessibility compliance."

**Terminal Commands:**
```bash
# Run the brand kit validator
npx tsx scripts/validate-brand-kit.ts --verbose

# Or validate a specific file
npx tsx scripts/validate-brand-kit.ts --file ./brand-kit.json
```

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════════╗
║  Platxa Brand Kit Validator                                      ║
╚══════════════════════════════════════════════════════════════════╝

✓ brand-kit.json (Score: 95/100)
  Details:
    Schema valid:       Yes
    Colors valid:       Yes
    Accessibility:      100%
    Completeness:       100%
    Dark mode valid:    Yes
```

> "Our brand kit passes validation with a 95% score. The validator checks WCAG contrast ratios automatically."

---

### [13:30] Using Brand Tokens in Components

> "Finally, let's use our brand tokens in components."

**Using token() function in CSS:**
```css
.card {
  background: token(card);
  color: token(cardForeground);
  border: 1px solid token(border);
  border-radius: token(radius.md);
  padding: token(spacing.md);
}
```

**Using brand() in JSX styles:**
```tsx
const Card = ({ children }) => (
  <div
    style={{
      background: "brand(card)",
      color: "brand(cardForeground)",
      borderRadius: "brand(radius.md)",
    }}
  >
    {children}
  </div>
)
```

**Using with Tailwind:**
```tsx
const Card = ({ children }) => (
  <div className="bg-card text-card-foreground border rounded-md p-4">
    {children}
  </div>
)
```

> "All three approaches use the same tokens. Choose based on your styling preference."

---

### [15:00] Wrap Up

> "You've created a complete brand kit! Your design system now has semantic colors, dark mode support, and accessibility validation."

**What You Learned:**
- Brand kit structure and semantic colors
- Light and dark mode configuration
- OKLCH color format benefits
- Spacing and typography tokens
- Validation and usage patterns

**On Screen:**
- Link to next tutorial
- Brand kit template download
- Documentation links

> "In the next tutorial, we'll explore advanced features like runtime theme switching and framework integrations. See you there!"

---

## Resources

- [Color Naming Conventions](../api/colors.md)
- [OKLCH Color Picker](https://oklch.com)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Next Tutorial: Advanced Features](./03-advanced-features.md)
