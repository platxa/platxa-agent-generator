# Hero Section Generator

Complete hero section with headline, subheadline, CTAs, and optional image/video background.

## Generated Component

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// =============================================================================
// HERO VARIANTS
// =============================================================================

const heroVariants = cva(
  [
    "relative w-full overflow-hidden",
    "flex items-center"
  ],
  {
    variants: {
      layout: {
        centered: "justify-center text-center",
        left: "justify-start text-left",
        split: "justify-between"
      },
      size: {
        sm: "min-h-[50vh] py-16",
        default: "min-h-[70vh] py-20",
        lg: "min-h-[85vh] py-24",
        full: "min-h-screen py-24"
      },
      overlay: {
        none: "",
        light: "before:absolute before:inset-0 before:bg-white/60",
        dark: "before:absolute before:inset-0 before:bg-black/50",
        gradient: "before:absolute before:inset-0 before:bg-gradient-to-b before:from-black/70 before:to-transparent"
      }
    },
    defaultVariants: {
      layout: "centered",
      size: "default",
      overlay: "none"
    }
  }
)

// =============================================================================
// TYPES
// =============================================================================

interface HeroAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "secondary" | "outline" | "ghost"
}

interface HeroProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof heroVariants> {
  /**
   * Main headline text
   */
  headline: string
  /**
   * Supporting subheadline text
   */
  subheadline?: string
  /**
   * Call-to-action buttons
   */
  actions?: HeroAction[]
  /**
   * Background image URL
   */
  backgroundImage?: string
  /**
   * Background video URL
   */
  backgroundVideo?: string
  /**
   * Side image for split layout
   */
  sideImage?: string
  /**
   * Side image alt text
   */
  sideImageAlt?: string
  /**
   * Badge/eyebrow text above headline
   */
  badge?: string
  /**
   * Enable entrance animations
   */
  animated?: boolean
}

// =============================================================================
// HERO COMPONENT
// =============================================================================

const Hero = React.forwardRef<HTMLElement, HeroProps>(
  (
    {
      className,
      layout,
      size,
      overlay,
      headline,
      subheadline,
      actions = [],
      backgroundImage,
      backgroundVideo,
      sideImage,
      sideImageAlt = "",
      badge,
      animated = true,
      children,
      ...props
    },
    ref
  ) => {
    const Wrapper = animated ? motion.section : "section"
    const ContentWrapper = animated ? motion.div : "div"

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.15,
          delayChildren: 0.1
        }
      }
    }

    const itemVariants = {
      hidden: { opacity: 0, y: 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 15
        }
      }
    }

    const contentProps = animated
      ? {
          variants: containerVariants,
          initial: "hidden",
          animate: "visible"
        }
      : {}

    const itemProps = animated ? { variants: itemVariants } : {}

    return (
      <Wrapper
        ref={ref}
        className={cn(heroVariants({ layout, size, overlay }), className)}
        {...props}
      >
        {/* Background Image */}
        {backgroundImage && !backgroundVideo && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat -z-10"
            style={{ backgroundImage: `url(${backgroundImage})` }}
            role="img"
            aria-label="Hero background"
          />
        )}

        {/* Background Video */}
        {backgroundVideo && (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover -z-10"
            aria-hidden="true"
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        )}

        {/* Content Container */}
        <div className="container relative z-10 px-4 md:px-6">
          {layout === "split" ? (
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
              {/* Text Content */}
              <ContentWrapper {...contentProps}>
                <HeroContent
                  badge={badge}
                  headline={headline}
                  subheadline={subheadline}
                  actions={actions}
                  layout={layout}
                  animated={animated}
                  itemProps={itemProps}
                />
                {children}
              </ContentWrapper>

              {/* Side Image */}
              {sideImage && (
                <motion.div
                  className="relative aspect-square lg:aspect-auto"
                  initial={animated ? { opacity: 0, x: 50 } : undefined}
                  animate={animated ? { opacity: 1, x: 0 } : undefined}
                  transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
                >
                  <img
                    src={sideImage}
                    alt={sideImageAlt}
                    className="rounded-lg object-cover w-full h-full shadow-2xl"
                  />
                </motion.div>
              )}
            </div>
          ) : (
            <ContentWrapper
              className={cn(
                "max-w-4xl",
                layout === "centered" && "mx-auto"
              )}
              {...contentProps}
            >
              <HeroContent
                badge={badge}
                headline={headline}
                subheadline={subheadline}
                actions={actions}
                layout={layout}
                animated={animated}
                itemProps={itemProps}
              />
              {children}
            </ContentWrapper>
          )}
        </div>
      </Wrapper>
    )
  }
)
Hero.displayName = "Hero"

// =============================================================================
// HERO CONTENT
// =============================================================================

interface HeroContentProps {
  badge?: string
  headline: string
  subheadline?: string
  actions: HeroAction[]
  layout?: "centered" | "left" | "split" | null
  animated: boolean
  itemProps: object
}

const HeroContent = ({
  badge,
  headline,
  subheadline,
  actions,
  layout,
  animated,
  itemProps
}: HeroContentProps) => {
  const ItemWrapper = animated ? motion.div : "div"

  return (
    <>
      {/* Badge */}
      {badge && (
        <ItemWrapper {...itemProps}>
          <span
            className={cn(
              "inline-block px-4 py-1.5 mb-6",
              "text-sm font-medium",
              "bg-primary/10 text-primary rounded-full"
            )}
          >
            {badge}
          </span>
        </ItemWrapper>
      )}

      {/* Headline */}
      <ItemWrapper {...itemProps}>
        <h1
          className={cn(
            "text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl",
            "text-foreground",
            "leading-[1.1]"
          )}
        >
          {headline}
        </h1>
      </ItemWrapper>

      {/* Subheadline */}
      {subheadline && (
        <ItemWrapper {...itemProps}>
          <p
            className={cn(
              "mt-6 text-lg sm:text-xl text-muted-foreground",
              "max-w-2xl",
              layout === "centered" && "mx-auto"
            )}
          >
            {subheadline}
          </p>
        </ItemWrapper>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <ItemWrapper
          className={cn(
            "mt-8 flex flex-wrap gap-4",
            layout === "centered" && "justify-center"
          )}
          {...itemProps}
        >
          {actions.map((action, index) => (
            <HeroButton key={index} action={action} isPrimary={index === 0} />
          ))}
        </ItemWrapper>
      )}
    </>
  )
}

// =============================================================================
// HERO BUTTON
// =============================================================================

interface HeroButtonProps {
  action: HeroAction
  isPrimary: boolean
}

const HeroButton = ({ action, isPrimary }: HeroButtonProps) => {
  const variant = action.variant || (isPrimary ? "default" : "outline")
  const size = isPrimary ? "lg" : "default"

  if (action.href) {
    return (
      <Button variant={variant} size={size} asChild>
        <a href={action.href}>{action.label}</a>
      </Button>
    )
  }

  return (
    <Button variant={variant} size={size} onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

export { Hero, heroVariants }
export type { HeroProps, HeroAction }
```

## Basic Usage

### Centered Hero (Default)

```typescript
<Hero
  headline="Build beautiful interfaces with ease"
  subheadline="A comprehensive component library for creating stunning, accessible web applications."
  actions={[
    { label: "Get Started", href: "/docs" },
    { label: "View Examples", href: "/examples", variant: "outline" }
  ]}
/>
```

### Left-Aligned Hero

```typescript
<Hero
  layout="left"
  headline="Welcome to our platform"
  subheadline="Start building your next great idea today."
  badge="New Release"
  actions={[
    { label: "Sign Up Free", href: "/signup" },
    { label: "Learn More", href: "/about" }
  ]}
/>
```

### Split Layout with Image

```typescript
<Hero
  layout="split"
  headline="Design meets functionality"
  subheadline="Create pixel-perfect interfaces that users love."
  sideImage="/hero-image.png"
  sideImageAlt="Product screenshot"
  actions={[
    { label: "Start Free Trial", href: "/trial" },
    { label: "Watch Demo", onClick: () => openVideo() }
  ]}
/>
```

## Background Variants

### With Background Image

```typescript
<Hero
  headline="Adventure awaits"
  subheadline="Discover breathtaking destinations around the world."
  backgroundImage="/mountains.jpg"
  overlay="dark"
  className="text-white"
  actions={[
    { label: "Explore", href: "/destinations" }
  ]}
/>
```

### With Video Background

```typescript
<Hero
  headline="Immersive experiences"
  subheadline="See your products come to life."
  backgroundVideo="/hero-video.mp4"
  overlay="gradient"
  className="text-white"
  size="full"
  actions={[
    { label: "Get Started", href: "/start" }
  ]}
/>
```

### Gradient Background (CSS)

```typescript
<Hero
  headline="Modern design system"
  subheadline="Built for the future."
  className="bg-gradient-to-br from-primary/20 via-background to-secondary/20"
  actions={[
    { label: "Learn More", href: "/docs" }
  ]}
/>
```

## Size Variants

| Size | Height | Use Case |
|------|--------|----------|
| `sm` | 50vh | Secondary pages, landing sections |
| `default` | 70vh | Standard hero sections |
| `lg` | 85vh | High-impact landing pages |
| `full` | 100vh | Full viewport immersive heroes |

```typescript
// Full viewport hero
<Hero
  size="full"
  headline="Welcome"
  subheadline="Scroll to discover more."
  actions={[{ label: "Explore", href: "#content" }]}
/>
```

## With Custom Content

### Stats Below CTA

```typescript
<Hero
  headline="Trusted by thousands"
  subheadline="Join the community of developers building amazing things."
  actions={[{ label: "Get Started", href: "/signup" }]}
>
  <div className="mt-12 flex justify-center gap-8">
    <div className="text-center">
      <div className="text-3xl font-bold">10K+</div>
      <div className="text-sm text-muted-foreground">Developers</div>
    </div>
    <div className="text-center">
      <div className="text-3xl font-bold">50M+</div>
      <div className="text-sm text-muted-foreground">Downloads</div>
    </div>
    <div className="text-center">
      <div className="text-3xl font-bold">99.9%</div>
      <div className="text-sm text-muted-foreground">Uptime</div>
    </div>
  </div>
</Hero>
```

### Email Capture Form

```typescript
<Hero
  headline="Stay in the loop"
  subheadline="Get early access to new features and updates."
  actions={[]}
>
  <form className="mt-8 flex max-w-md mx-auto gap-2">
    <Input
      type="email"
      placeholder="Enter your email"
      className="flex-1"
    />
    <Button type="submit">Subscribe</Button>
  </form>
</Hero>
```

### Logo Cloud

```typescript
<Hero
  headline="Enterprise ready"
  subheadline="Trusted by industry leaders worldwide."
  actions={[{ label: "Contact Sales", href: "/contact" }]}
>
  <div className="mt-16">
    <p className="text-sm text-muted-foreground mb-6">
      Trusted by innovative companies
    </p>
    <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
      <Logo1 className="h-8" />
      <Logo2 className="h-8" />
      <Logo3 className="h-8" />
      <Logo4 className="h-8" />
      <Logo5 className="h-8" />
    </div>
  </div>
</Hero>
```

## Animation Control

### Disabled Animations

```typescript
<Hero
  animated={false}
  headline="Simple and fast"
  subheadline="For users who prefer reduced motion."
  actions={[{ label: "Continue", href: "/next" }]}
/>
```

### Respect Reduced Motion

```typescript
"use client"

import { useReducedMotion } from "framer-motion"

const HeroSection = () => {
  const prefersReducedMotion = useReducedMotion()

  return (
    <Hero
      animated={!prefersReducedMotion}
      headline="Accessible by default"
      subheadline="Respects user preferences automatically."
    />
  )
}
```

## Advanced Patterns

### Animated Gradient Text

```typescript
<Hero
  layout="centered"
  headline=""
  subheadline="The future of web development is here."
  actions={[{ label: "Explore", href: "/explore" }]}
>
  {/* Custom animated headline */}
  <motion.h1
    className={cn(
      "text-5xl md:text-7xl font-bold",
      "bg-gradient-to-r from-primary via-purple-500 to-pink-500",
      "bg-clip-text text-transparent",
      "animate-gradient bg-[length:200%_auto]"
    )}
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
  >
    Build. Ship. Scale.
  </motion.h1>
</Hero>

// Add to globals.css
@keyframes gradient {
  0%, 100% { background-position: 0% center; }
  50% { background-position: 100% center; }
}
.animate-gradient {
  animation: gradient 3s ease infinite;
}
```

### Parallax Background

```typescript
"use client"

import { useScroll, useTransform } from "framer-motion"

const ParallaxHero = () => {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <section className="relative min-h-screen overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url(/hero-bg.jpg)",
          y,
        }}
      />
      <motion.div
        className="relative z-10 container mx-auto px-4 py-32"
        style={{ opacity }}
      >
        <h1 className="text-6xl font-bold text-white">
          Parallax Hero
        </h1>
      </motion.div>
    </section>
  )
}
```

### Multiple Headlines (Typewriter Effect)

```typescript
"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"

const headlines = [
  "Build faster",
  "Ship sooner",
  "Scale easier"
]

const RotatingHero = () => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % headlines.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Hero
      headline=""
      subheadline="The complete toolkit for modern web development."
      actions={[{ label: "Get Started", href: "/start" }]}
    >
      <div className="h-20 overflow-hidden mb-6">
        <AnimatePresence mode="wait">
          <motion.h1
            key={index}
            className="text-6xl font-bold"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {headlines[index]}
          </motion.h1>
        </AnimatePresence>
      </div>
    </Hero>
  )
}
```

## Responsive Behavior

| Breakpoint | Typography | Layout |
|------------|------------|--------|
| Mobile | text-4xl headline | Stack vertically |
| sm (640px) | text-5xl headline | Stack vertically |
| md (768px) | text-6xl headline | Two-column starts |
| lg (1024px) | text-7xl headline | Full two-column |

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Heading hierarchy | Uses `<h1>` for headline |
| Background images | `role="img"` with `aria-label` |
| Video backgrounds | `aria-hidden="true"` (decorative) |
| Reduced motion | `animated` prop + `useReducedMotion` hook |
| Color contrast | Overlay variants ensure 4.5:1 ratio |
| Focus management | Buttons have visible focus states |

## Best Practices

| Do | Don't |
|----|-------|
| Use overlay with background images | Put text over busy images without overlay |
| Limit to 2-3 CTA buttons | Overwhelm with too many actions |
| Keep headlines concise (5-8 words) | Write paragraph-length headlines |
| Use semantic `<section>` element | Use generic `<div>` for hero |
| Provide alt text for informative images | Skip accessibility for decorative elements |
| Test on mobile viewports | Only design for desktop |

## Export

```typescript
// components/sections/hero.tsx
export { Hero, heroVariants }
export type { HeroProps, HeroAction }
```
