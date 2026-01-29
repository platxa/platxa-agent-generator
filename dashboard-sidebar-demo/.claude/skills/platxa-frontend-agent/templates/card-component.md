# Card Component Generator

Complete card component with shadow, hover effects, optional image, and composable sub-components.

## Generated Component

```typescript
import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// =============================================================================
// CARD VARIANTS
// =============================================================================

const cardVariants = cva(
  [
    "rounded-lg border bg-card text-card-foreground",
    "transition-shadow"
  ],
  {
    variants: {
      variant: {
        default: "shadow-sm",
        elevated: "shadow-md",
        outline: "shadow-none",
        ghost: "border-transparent shadow-none bg-transparent"
      },
      hover: {
        none: "",
        lift: "hover:shadow-lg hover:-translate-y-1 transition-all duration-200",
        glow: "hover:shadow-lg hover:shadow-primary/10",
        border: "hover:border-primary"
      },
      padding: {
        none: "",
        sm: "p-4",
        default: "p-6",
        lg: "p-8"
      }
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
      padding: "none"
    }
  }
)

// =============================================================================
// CARD PROPS
// =============================================================================

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /**
   * Make card clickable
   */
  asButton?: boolean
  /**
   * Click handler (when asButton is true)
   */
  onPress?: () => void
}

// =============================================================================
// CARD COMPONENT
// =============================================================================

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      hover,
      padding,
      asButton = false,
      onPress,
      children,
      ...props
    },
    ref
  ) => {
    if (asButton) {
      return (
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          onClick={onPress}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onPress?.()
            }
          }}
          className={cn(
            cardVariants({ variant, hover: hover || "lift", padding }),
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
          {...props}
        >
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, hover, padding }), className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = "Card"

// =============================================================================
// ANIMATED CARD
// =============================================================================

export interface AnimatedCardProps
  extends Omit<HTMLMotionProps<"div">, "ref">,
    VariantProps<typeof cardVariants> {
  asButton?: boolean
  onPress?: () => void
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      className,
      variant,
      padding,
      asButton = false,
      onPress,
      children,
      ...props
    },
    ref
  ) => {
    const interactionProps = asButton
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: onPress,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onPress?.()
            }
          }
        }
      : {}

    return (
      <motion.div
        ref={ref}
        className={cn(
          cardVariants({ variant, hover: "none", padding }),
          asButton && [
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2"
          ],
          className
        )}
        whileHover={{
          y: -8,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12)"
        }}
        whileTap={asButton ? { scale: 0.98, y: 0 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        {...interactionProps}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
AnimatedCard.displayName = "AnimatedCard"

// =============================================================================
// CARD SUB-COMPONENTS
// =============================================================================

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// =============================================================================
// CARD IMAGE
// =============================================================================

interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Aspect ratio of the image container
   */
  aspectRatio?: "auto" | "square" | "video" | "wide"
  /**
   * Position within the card
   */
  position?: "top" | "bottom" | "left" | "right"
}

const CardImage = React.forwardRef<HTMLDivElement, CardImageProps>(
  (
    {
      className,
      src,
      alt = "",
      aspectRatio = "video",
      position = "top",
      ...props
    },
    ref
  ) => {
    const aspectClasses = {
      auto: "",
      square: "aspect-square",
      video: "aspect-video",
      wide: "aspect-[21/9]"
    }

    const positionClasses = {
      top: "rounded-t-lg",
      bottom: "rounded-b-lg",
      left: "rounded-l-lg",
      right: "rounded-r-lg"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          aspectClasses[aspectRatio],
          positionClasses[position],
          className
        )}
      >
        <img
          src={src}
          alt={alt}
          className="object-cover w-full h-full"
          {...props}
        />
      </div>
    )
  }
)
CardImage.displayName = "CardImage"

export {
  Card,
  AnimatedCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardImage,
  cardVariants
}
```

## Basic Usage

### Simple Card

```typescript
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content and body text.</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Card with Image

```typescript
<Card className="overflow-hidden">
  <CardImage
    src="/image.jpg"
    alt="Card image"
    aspectRatio="video"
  />
  <CardHeader>
    <CardTitle>Featured Article</CardTitle>
    <CardDescription>Published on Jan 10, 2024</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Article preview text goes here...</p>
  </CardContent>
</Card>
```

## Variant Examples

### Default (with shadow)

```typescript
<Card variant="default">
  <CardContent className="p-6">
    Default card with subtle shadow
  </CardContent>
</Card>
```

### Elevated

```typescript
<Card variant="elevated">
  <CardContent className="p-6">
    Elevated card with more prominent shadow
  </CardContent>
</Card>
```

### Outline

```typescript
<Card variant="outline">
  <CardContent className="p-6">
    Outline card with border, no shadow
  </CardContent>
</Card>
```

### Ghost

```typescript
<Card variant="ghost">
  <CardContent className="p-6">
    Ghost card - transparent background
  </CardContent>
</Card>
```

## Hover Effects

### Lift Effect

```typescript
<Card hover="lift">
  <CardContent className="p-6">
    Lifts up on hover with enhanced shadow
  </CardContent>
</Card>
```

### Glow Effect

```typescript
<Card hover="glow">
  <CardContent className="p-6">
    Glows with primary color on hover
  </CardContent>
</Card>
```

### Border Effect

```typescript
<Card hover="border">
  <CardContent className="p-6">
    Border changes to primary on hover
  </CardContent>
</Card>
```

### Animated Card (Framer Motion)

```typescript
<AnimatedCard>
  <CardContent className="p-6">
    Smooth spring animation on hover
  </CardContent>
</AnimatedCard>
```

## Clickable Cards

### As Button

```typescript
<Card asButton onPress={() => console.log("Clicked!")}>
  <CardHeader>
    <CardTitle>Clickable Card</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Click anywhere on this card</p>
  </CardContent>
</Card>
```

### Animated Clickable

```typescript
<AnimatedCard asButton onPress={() => navigate("/details")}>
  <CardImage src="/image.jpg" alt="" />
  <CardHeader>
    <CardTitle>Interactive Card</CardTitle>
    <CardDescription>Click to view details</CardDescription>
  </CardHeader>
</AnimatedCard>
```

### As Link

```typescript
<a href="/article/123" className="block">
  <Card hover="lift">
    <CardImage src="/image.jpg" alt="" />
    <CardHeader>
      <CardTitle>Article Title</CardTitle>
    </CardHeader>
  </Card>
</a>
```

## Card Layouts

### Horizontal Card

```typescript
<Card className="flex flex-row overflow-hidden">
  <CardImage
    src="/image.jpg"
    alt=""
    position="left"
    className="w-1/3"
    aspectRatio="auto"
  />
  <div className="flex-1">
    <CardHeader>
      <CardTitle>Horizontal Layout</CardTitle>
      <CardDescription>Image on the left</CardDescription>
    </CardHeader>
    <CardContent>
      <p>Content flows beside the image</p>
    </CardContent>
  </div>
</Card>
```

### Grid of Cards

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <AnimatedCard key={item.id}>
      <CardImage src={item.image} alt={item.title} />
      <CardHeader>
        <CardTitle>{item.title}</CardTitle>
        <CardDescription>{item.description}</CardDescription>
      </CardHeader>
    </AnimatedCard>
  ))}
</div>
```

### Stats Card

```typescript
<Card>
  <CardHeader className="pb-2">
    <CardDescription>Total Revenue</CardDescription>
    <CardTitle className="text-4xl">$45,231.89</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-xs text-muted-foreground">
      +20.1% from last month
    </p>
  </CardContent>
</Card>
```

### Profile Card

```typescript
<Card className="text-center">
  <CardHeader className="items-center">
    <div className="h-24 w-24 rounded-full overflow-hidden mb-4">
      <img src="/avatar.jpg" alt="" className="object-cover w-full h-full" />
    </div>
    <CardTitle>John Doe</CardTitle>
    <CardDescription>Software Engineer</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex justify-center gap-8">
      <div>
        <p className="font-semibold">128</p>
        <p className="text-sm text-muted-foreground">Posts</p>
      </div>
      <div>
        <p className="font-semibold">1.2k</p>
        <p className="text-sm text-muted-foreground">Followers</p>
      </div>
    </div>
  </CardContent>
  <CardFooter className="justify-center">
    <Button>Follow</Button>
  </CardFooter>
</Card>
```

### Pricing Card

```typescript
<Card className="relative overflow-hidden">
  {/* Popular badge */}
  <div className="absolute top-4 right-4">
    <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
      Popular
    </span>
  </div>

  <CardHeader>
    <CardTitle>Pro Plan</CardTitle>
    <CardDescription>Best for professionals</CardDescription>
    <div className="mt-4">
      <span className="text-4xl font-bold">$29</span>
      <span className="text-muted-foreground">/month</span>
    </div>
  </CardHeader>

  <CardContent>
    <ul className="space-y-3">
      {features.map(feature => (
        <li key={feature} className="flex items-center gap-2">
          <CheckIcon className="h-4 w-4 text-green-500" />
          <span className="text-sm">{feature}</span>
        </li>
      ))}
    </ul>
  </CardContent>

  <CardFooter>
    <Button className="w-full">Get Started</Button>
  </CardFooter>
</Card>
```

## Container Query Card

```typescript
<Card className="@container">
  <div className="flex flex-col @md:flex-row">
    <CardImage
      src="/image.jpg"
      alt=""
      className="w-full @md:w-1/3"
    />
    <div className="flex-1">
      <CardHeader>
        <CardTitle className="text-lg @lg:text-2xl">
          Responsive Card
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm @lg:text-base">
          Adapts to container width
        </p>
      </CardContent>
    </div>
  </div>
</Card>
```

## Skeleton Loading

```typescript
const CardSkeleton = () => (
  <Card>
    <div className="aspect-video bg-muted animate-pulse rounded-t-lg" />
    <CardHeader>
      <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
      <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded" />
        <div className="h-4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
      </div>
    </CardContent>
  </Card>
)
```

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Clickable cards | `role="button"`, `tabIndex={0}`, keyboard handlers |
| Images | Descriptive `alt` text or `alt=""` for decorative |
| Focus visible | Two-color focus ring on clickable cards |
| Headings | Proper heading hierarchy with `CardTitle` |
| Color contrast | Uses semantic tokens for 4.5:1 ratio |

## Best Practices

| Do | Don't |
|----|-------|
| Use `CardImage` for hero images | Put images directly in `CardContent` |
| Apply hover effects intentionally | Add hover to every card |
| Use `asButton` for clickable cards | Wrap entire card in anchor tag |
| Keep card content scannable | Overload with too much content |
| Use consistent card heights in grids | Mix different heights randomly |
| Add descriptive alt text to images | Leave alt empty for informative images |

## Export

```typescript
// components/ui/card.tsx
export {
  Card,
  AnimatedCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardImage,
  cardVariants
}
export type { CardProps, AnimatedCardProps, CardImageProps }
```
