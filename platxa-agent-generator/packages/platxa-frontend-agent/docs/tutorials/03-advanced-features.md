# Tutorial 3: Advanced Features

**Video Duration:** ~20 minutes
**Level:** Advanced
**Prerequisites:** Completed Tutorials 1 & 2

---

## Video Script

### [0:00] Introduction

> "Welcome to the advanced features tutorial! Today we'll explore powerful capabilities that make Platxa production-ready: framework integrations, build plugins, runtime theme switching, and performance optimization."

**On Screen:** Overview of topics

---

### [1:00] Framework Integrations Overview

> "Platxa integrates with all major React frameworks. Each integration is optimized for the framework's specific patterns."

**Supported Frameworks:**
- **Next.js** - App Router & Pages Router
- **Vite** - Fast development & optimized builds
- **Remix** - Server-side rendering
- **Astro** - Static & hybrid rendering

---

### [2:00] Next.js Integration

> "Let's set up Platxa in a Next.js 14 App Router project."

**Installation:**
```bash
npm install @platxa/frontend-agent
```

**File: `next.config.js`**
```javascript
import { withPlatxa } from "@platxa/frontend-agent/next"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config
}

export default withPlatxa(nextConfig, {
  brandKit: "./brand-kit.json",
  darkMode: "class",
})
```

**File: `app/layout.tsx`**
```tsx
import { PlatxaProvider } from "@platxa/frontend-agent/react"
import "./globals.css"

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PlatxaProvider
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </PlatxaProvider>
      </body>
    </html>
  )
}
```

> "The withPlatxa wrapper handles CSS extraction and optimization automatically."

---

### [4:00] Vite Integration

> "Vite users get blazing fast HMR with the Platxa plugin."

**File: `vite.config.ts`**
```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { platxaVitePlugin } from "@platxa/frontend-agent/vite"

export default defineConfig({
  plugins: [
    react(),
    platxaVitePlugin({
      brandKit: "./brand-kit.json",
      // Inject CSS variables into index.html
      injectStyles: true,
      // Generate static stylesheet
      generateStaticCss: true,
      // Enable hot reload for brand kit changes
      hmr: true,
    }),
  ],
})
```

> "The Vite plugin watches your brand kit file and hot-reloads changes instantly."

---

### [5:30] Remix Integration

> "Remix brings server-side token resolution for optimal performance."

**File: `remix.config.js`**
```javascript
import { platxaRemixPreset } from "@platxa/frontend-agent/remix"

export default {
  presets: [
    platxaRemixPreset({
      brandKit: "./brand-kit.json",
    }),
  ],
}
```

**File: `app/root.tsx`**
```tsx
import { useBrandKit } from "@platxa/frontend-agent/remix"

export function loader() {
  const brandKit = useBrandKit()
  return { brandKit }
}

export default function App() {
  const { brandKit } = useLoaderData()

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandKit.css }} />
      </head>
      <body>{/* ... */}</body>
    </html>
  )
}
```

> "Server-side resolution means zero client-side JavaScript for theming."

---

### [7:00] Build Tool Plugins

> "Beyond frameworks, Platxa offers plugins for build tools."

### PostCSS Plugin

**File: `postcss.config.js`**
```javascript
import { postcssPlugin } from "@platxa/frontend-agent/postcss"

export default {
  plugins: {
    "@platxa/postcss": postcssPlugin({
      brandKit: "./brand-kit.json",
      // Transform brand() to var()
      transformTokens: true,
      // Inject custom properties
      injectVariables: true,
      // Generate theme variants
      generateDarkMode: true,
      darkModeStrategy: "class", // or "media"
    }),
  },
}
```

> "PostCSS transforms brand() functions at build time - zero runtime overhead."

### ESLint Plugin

**File: `eslint.config.js`**
```javascript
import platxaPlugin from "@platxa/frontend-agent/eslint"

export default [
  {
    plugins: { platxa: platxaPlugin },
    rules: {
      // Warn on hardcoded colors
      "platxa/no-hardcoded-colors": "warn",
      // Suggest brand tokens over var()
      "platxa/prefer-brand-token": "warn",
    },
  },
]
```

> "The ESLint plugin catches hardcoded colors and suggests token replacements."

### Webpack Plugin

**File: `webpack.config.js`**
```javascript
import { PlatxaWebpackPlugin } from "@platxa/frontend-agent/webpack"

export default {
  plugins: [
    new PlatxaWebpackPlugin({
      brandKit: "./brand-kit.json",
      outputCss: true,
    }),
  ],
}
```

---

### [10:00] Runtime Theme Switching

> "Now for the exciting part - runtime theme switching without page reloads."

**Using the useBrand Hook:**
```tsx
import { useBrand } from "@platxa/frontend-agent/react"

function ThemeSwitcher() {
  const { theme, setTheme, themes, systemTheme } = useBrand()

  return (
    <div>
      <p>Current: {theme}</p>
      <p>System prefers: {systemTheme}</p>

      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("system")}>System</button>
    </div>
  )
}
```

> "The useBrand hook manages theme state and persists preference to localStorage."

### Multi-Brand Switching

> "Enterprise apps often need multiple brand identities."

```tsx
import { useBrand } from "@platxa/frontend-agent/react"

function BrandSwitcher() {
  const { brand, setBrand, brands } = useBrand()

  return (
    <select
      value={brand}
      onChange={(e) => setBrand(e.target.value)}
    >
      {brands.map((b) => (
        <option key={b.name} value={b.name}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
```

**Provider Setup:**
```tsx
<PlatxaProvider
  brands={[mainBrand, partnerBrand, whiteLabelBrand]}
  defaultBrand="main"
>
  {children}
</PlatxaProvider>
```

> "Perfect for white-label applications or partner portals."

---

### [13:00] Brand Events System

> "React to brand changes with the event system."

```typescript
import { brandEvents } from "@platxa/frontend-agent/theme"

// Subscribe to theme changes
const unsubscribe = brandEvents.on("theme:change", (event) => {
  console.log(`Theme changed: ${event.from} → ${event.to}`)

  // Analytics tracking
  analytics.track("theme_changed", {
    fromTheme: event.from,
    toTheme: event.to,
  })
})

// Subscribe to brand switches
brandEvents.on("brand:change", (event) => {
  console.log(`Brand switched to: ${event.brand.name}`)
})

// Cleanup on unmount
useEffect(() => unsubscribe, [])
```

> "Events enable analytics integration and cross-component coordination."

---

### [15:00] Performance Optimization

> "Let's optimize Platxa for production."

### CSS Extraction

```typescript
// vite.config.ts
platxaVitePlugin({
  // Extract CSS to separate file (better caching)
  extractCss: true,
  // Minify CSS variables
  minify: true,
  // Remove unused tokens (tree-shaking)
  purgeUnused: true,
})
```

### Preloading Critical CSS

```html
<!-- In your HTML head -->
<link
  rel="preload"
  href="/styles/brand-tokens.css"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'"
/>
```

### Avoiding Flash of Unstyled Content (FOUC)

```tsx
// In app/layout.tsx or _document.tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        const theme = localStorage.getItem('platxa-theme') || 'system';
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme === 'dark' || (theme === 'system' && systemDark);
        if (isDark) document.documentElement.classList.add('dark');
      })();
    `,
  }}
/>
```

> "This inline script runs before React hydration, preventing theme flash."

---

### [17:00] CI/CD Integration

> "Automate brand kit validation in your pipeline."

**GitHub Actions Workflow:**
```yaml
name: Brand Kit Validation

on:
  pull_request:
    paths:
      - "**/brand-kit*.json"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm install
      - run: npx tsx scripts/validate-brand-kit.ts --ci

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            // Posts validation results as PR comment
```

> "Every PR touching brand files gets automatic validation and feedback."

---

### [18:30] Debugging Tips

> "When things don't look right, here's how to debug."

**1. Inspect CSS Variables:**
```javascript
// In browser console
getComputedStyle(document.documentElement)
  .getPropertyValue('--color-primary')
```

**2. Check Token Resolution:**
```typescript
import { resolveToken } from "@platxa/frontend-agent/theme"

console.log(resolveToken("primary")) // "#6366f1"
console.log(resolveToken("spacing.md")) // "1rem"
```

**3. Validate in Development:**
```bash
# Watch mode with validation
npm run dev -- --validate-brand
```

---

### [19:30] Best Practices Summary

> "Let's recap the best practices we've learned."

**Do:**
- Use semantic tokens, not raw colors
- Define both light and dark modes
- Validate accessibility with WCAG checks
- Extract CSS in production
- Use events for analytics

**Don't:**
- Hardcode colors in components
- Skip dark mode support
- Ignore contrast warnings
- Load brand kit synchronously on client

---

### [20:00] Wrap Up

> "Congratulations! You now have production-ready knowledge of Platxa Frontend Agent. You can integrate with any framework, optimize for performance, and maintain brand consistency at scale."

**What You Learned:**
- Framework integrations (Next.js, Vite, Remix, Astro)
- Build tool plugins (PostCSS, ESLint, Webpack)
- Runtime theme and brand switching
- Performance optimization techniques
- CI/CD validation workflows

**On Screen:**
- Documentation links
- GitHub discussions
- Community Discord

> "Thanks for watching this tutorial series! If you have questions, join our Discord or open a GitHub discussion. Happy coding!"

---

## Resources

- [API Reference](../api/README.md)
- [Framework Integration Guides](../integrations/README.md)
- [Performance Guide](../guides/performance.md)
- [GitHub Discussions](https://github.com/anthropics/platxa-agent-generator/discussions)
