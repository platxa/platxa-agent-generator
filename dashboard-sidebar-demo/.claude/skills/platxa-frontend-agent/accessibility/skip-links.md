# Skip Links for Keyboard Navigation

Implement skip navigation links that allow keyboard users to bypass repetitive content and jump directly to main areas.

## Overview

Skip links are visually hidden links that become visible on focus, allowing keyboard users to:
- Skip past navigation to main content
- Jump to specific page sections
- Bypass repetitive headers/sidebars

## WCAG Requirements

| Criterion | Requirement |
|-----------|-------------|
| 2.4.1 Bypass Blocks | Mechanism to skip repeated content |
| 2.4.6 Headings and Labels | Descriptive skip link text |
| 2.4.7 Focus Visible | Skip link visible when focused |

## Basic Skip Link

### Component

```typescript
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SkipLinkProps {
  /**
   * Target element ID (without #)
   */
  targetId: string
  /**
   * Link text
   * @default "Skip to main content"
   */
  children?: React.ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Accessible skip link that appears on focus
 */
export const SkipLink = ({
  targetId,
  children = "Skip to main content",
  className
}: SkipLinkProps) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById(targetId)

    if (target) {
      // Make target focusable if not already
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1")
      }

      // Scroll and focus
      target.scrollIntoView({ behavior: "smooth" })
      target.focus({ preventScroll: true })
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden by default
        "sr-only",
        // Visible on focus
        "focus:not-sr-only",
        "focus:fixed focus:left-4 focus:top-4 focus:z-[9999]",
        "focus:block focus:rounded-md focus:bg-primary focus:px-4 focus:py-2",
        "focus:text-primary-foreground focus:outline-none",
        "focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Typography
        "text-sm font-medium",
        className
      )}
    >
      {children}
    </a>
  )
}
```

### Usage

```typescript
// app/layout.tsx or pages/_app.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Skip link - MUST be first focusable element */}
        <SkipLink targetId="main-content" />

        <Header />
        <Navigation />

        {/* Main content with target ID */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        <Footer />
      </body>
    </html>
  )
}
```

## Multiple Skip Links

For complex pages with multiple sections:

```typescript
interface SkipTarget {
  id: string
  label: string
}

interface SkipLinksProps {
  targets: SkipTarget[]
  className?: string
}

/**
 * Multiple skip links for complex layouts
 */
export const SkipLinks = ({ targets, className }: SkipLinksProps) => {
  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    event.preventDefault()
    const target = document.getElementById(targetId)

    if (target) {
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1")
      }
      target.scrollIntoView({ behavior: "smooth" })
      target.focus({ preventScroll: true })
    }
  }

  return (
    <nav
      aria-label="Skip navigation"
      className={cn(
        // Container hidden until child focused
        "sr-only focus-within:not-sr-only",
        "focus-within:fixed focus-within:left-4 focus-within:top-4 focus-within:z-[9999]",
        "focus-within:flex focus-within:flex-col focus-within:gap-2",
        "focus-within:rounded-lg focus-within:bg-background focus-within:p-4",
        "focus-within:shadow-lg focus-within:border",
        className
      )}
    >
      {targets.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(e) => handleClick(e, id)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium",
            "text-foreground hover:bg-accent",
            "focus:bg-primary focus:text-primary-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}

// Usage
<SkipLinks
  targets={[
    { id: "main-content", label: "Skip to main content" },
    { id: "navigation", label: "Skip to navigation" },
    { id: "search", label: "Skip to search" },
    { id: "footer", label: "Skip to footer" }
  ]}
/>
```

## CSS-Only Skip Link

Pure CSS approach without JavaScript:

```css
/* Skip link styles */
.skip-link {
  /* Visually hidden */
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;

  /* Base styles for when visible */
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  border-radius: 0.375rem;
  z-index: 9999;
}

/* Visible on focus */
.skip-link:focus {
  position: fixed;
  top: 1rem;
  left: 1rem;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;

  /* Focus ring */
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>
```

## Tailwind CSS Utilities

### Custom Utility Classes

```css
/* globals.css */
@layer components {
  .skip-link {
    @apply sr-only focus:not-sr-only;
    @apply focus:fixed focus:left-4 focus:top-4 focus:z-[9999];
    @apply focus:block focus:rounded-md focus:px-4 focus:py-2;
    @apply focus:bg-primary focus:text-primary-foreground;
    @apply focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2;
    @apply text-sm font-medium;
  }
}
```

```typescript
// Simple usage with utility class
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

## Skip Link Provider

For dynamic skip link management:

```typescript
"use client"

import * as React from "react"

interface SkipLinkTarget {
  id: string
  label: string
  priority?: number
}

interface SkipLinkContextValue {
  targets: SkipLinkTarget[]
  registerTarget: (target: SkipLinkTarget) => void
  unregisterTarget: (id: string) => void
}

const SkipLinkContext = React.createContext<SkipLinkContextValue | null>(null)

export const SkipLinkProvider = ({ children }: { children: React.ReactNode }) => {
  const [targets, setTargets] = React.useState<SkipLinkTarget[]>([])

  const registerTarget = React.useCallback((target: SkipLinkTarget) => {
    setTargets(prev => {
      const exists = prev.some(t => t.id === target.id)
      if (exists) return prev

      const updated = [...prev, target]
      // Sort by priority (lower = first)
      return updated.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    })
  }, [])

  const unregisterTarget = React.useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <SkipLinkContext.Provider value={{ targets, registerTarget, unregisterTarget }}>
      {children}
    </SkipLinkContext.Provider>
  )
}

/**
 * Hook to register a skip link target
 */
export const useSkipLinkTarget = (
  id: string,
  label: string,
  priority?: number
) => {
  const context = React.useContext(SkipLinkContext)

  React.useEffect(() => {
    if (!context) return

    context.registerTarget({ id, label, priority })
    return () => context.unregisterTarget(id)
  }, [context, id, label, priority])
}

/**
 * Render skip links from provider
 */
export const SkipLinksFromProvider = () => {
  const context = React.useContext(SkipLinkContext)

  if (!context || context.targets.length === 0) {
    return null
  }

  if (context.targets.length === 1) {
    return (
      <SkipLink targetId={context.targets[0].id}>
        {context.targets[0].label}
      </SkipLink>
    )
  }

  return <SkipLinks targets={context.targets} />
}

// Usage in components
const MainContent = ({ children }: { children: React.ReactNode }) => {
  useSkipLinkTarget("main-content", "Skip to main content", 1)

  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  )
}

const SearchBox = () => {
  useSkipLinkTarget("search", "Skip to search", 2)

  return (
    <div id="search" tabIndex={-1}>
      <input type="search" placeholder="Search..." />
    </div>
  )
}
```

## Framework Integration

### Next.js App Router

```typescript
// app/layout.tsx
import { SkipLink } from "@/components/skip-link"

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SkipLink targetId="main-content" />
        <Header />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
```

### Next.js Pages Router

```typescript
// pages/_app.tsx
import type { AppProps } from "next/app"
import { SkipLink } from "@/components/skip-link"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <SkipLink targetId="main-content" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Component {...pageProps} />
      </main>
      <Footer />
    </>
  )
}
```

### Remix

```typescript
// app/root.tsx
import { SkipLink } from "~/components/skip-link"

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <SkipLink targetId="main-content" />
        <Header />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

## Skip to Section Component

For in-page navigation:

```typescript
interface SkipToSectionProps {
  sectionId: string
  children: React.ReactNode
  className?: string
}

/**
 * In-page skip link for sections
 */
export const SkipToSection = ({
  sectionId,
  children,
  className
}: SkipToSectionProps) => (
  <a
    href={`#${sectionId}`}
    className={cn(
      "sr-only focus:not-sr-only",
      "focus:inline-block focus:px-2 focus:py-1",
      "focus:text-sm focus:text-primary focus:underline",
      className
    )}
    onClick={(e) => {
      e.preventDefault()
      const target = document.getElementById(sectionId)
      if (target) {
        target.scrollIntoView({ behavior: "smooth" })
        target.focus()
      }
    }}
  >
    {children}
  </a>
)

// Usage in long pages
<section>
  <SkipToSection sectionId="pricing">
    Skip to pricing
  </SkipToSection>
  <h2>Features</h2>
  {/* Long content... */}
</section>

<section id="pricing" tabIndex={-1}>
  <h2>Pricing</h2>
  {/* Pricing content */}
</section>
```

## Animated Skip Link

With smooth appearance animation:

```typescript
import { motion } from "framer-motion"

export const AnimatedSkipLink = ({
  targetId,
  children = "Skip to main content"
}: SkipLinkProps) => {
  const [isFocused, setIsFocused] = React.useState(false)

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.setAttribute("tabindex", "-1")
      target.scrollIntoView({ behavior: "smooth" })
      target.focus({ preventScroll: true })
    }
  }

  return (
    <motion.a
      href={`#${targetId}`}
      onClick={handleClick}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: isFocused ? 1 : 0,
        y: isFocused ? 0 : -20,
        pointerEvents: isFocused ? "auto" : "none"
      }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed left-4 top-4 z-[9999]",
        "rounded-md bg-primary px-4 py-2",
        "text-sm font-medium text-primary-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
      // Still accessible when visually hidden
      aria-hidden={!isFocused}
    >
      {children}
    </motion.a>
  )
}
```

## Testing

```typescript
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

describe("SkipLink", () => {
  it("is visually hidden until focused", () => {
    render(
      <>
        <SkipLink targetId="main" />
        <main id="main" tabIndex={-1}>Content</main>
      </>
    )

    const link = screen.getByText("Skip to main content")

    // Check sr-only class is applied
    expect(link).toHaveClass("sr-only")
  })

  it("becomes visible on focus", async () => {
    const user = userEvent.setup()

    render(
      <>
        <SkipLink targetId="main" />
        <main id="main" tabIndex={-1}>Content</main>
      </>
    )

    // Tab to focus the skip link
    await user.tab()

    const link = screen.getByText("Skip to main content")
    expect(link).toHaveFocus()
    expect(link).not.toHaveClass("sr-only")
  })

  it("moves focus to target on click", async () => {
    const user = userEvent.setup()

    render(
      <>
        <SkipLink targetId="main" />
        <main id="main" tabIndex={-1}>Content</main>
      </>
    )

    const link = screen.getByText("Skip to main content")
    const main = screen.getByRole("main")

    await user.click(link)

    expect(main).toHaveFocus()
  })

  it("moves focus to target on Enter key", async () => {
    const user = userEvent.setup()

    render(
      <>
        <SkipLink targetId="main" />
        <main id="main" tabIndex={-1}>Content</main>
      </>
    )

    await user.tab() // Focus skip link
    await user.keyboard("{Enter}")

    const main = screen.getByRole("main")
    expect(main).toHaveFocus()
  })
})

describe("SkipLinks (multiple)", () => {
  it("renders all skip links", () => {
    render(
      <SkipLinks
        targets={[
          { id: "main", label: "Main content" },
          { id: "nav", label: "Navigation" }
        ]}
      />
    )

    expect(screen.getByText("Main content")).toBeInTheDocument()
    expect(screen.getByText("Navigation")).toBeInTheDocument()
  })
})
```

## Best Practices

| Do | Don't |
|----|-------|
| Place skip link first in DOM | Hide after header |
| Use descriptive link text | Say "Skip" alone |
| Include `tabindex="-1"` on target | Forget to make target focusable |
| Make link visible on focus | Keep permanently hidden |
| Test with keyboard only | Only test with mouse |
| Include multiple targets for complex pages | Only skip to main |

## Accessibility Checklist

- [ ] Skip link is first focusable element
- [ ] Link text is descriptive
- [ ] Target element has `id` attribute
- [ ] Target element has `tabindex="-1"`
- [ ] Link is visible when focused
- [ ] Link has visible focus indicator
- [ ] Works with keyboard navigation
- [ ] Scrolls to and focuses target

## Export

```typescript
export {
  SkipLink,
  SkipLinks,
  SkipToSection,
  AnimatedSkipLink,
  SkipLinkProvider,
  SkipLinksFromProvider,
  useSkipLinkTarget
}
export type { SkipLinkProps, SkipTarget, SkipLinksProps }
```
