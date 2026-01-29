# Container Queries with Tailwind CSS v4

Container queries allow components to respond to their parent container's size rather than the viewport. This enables truly reusable, context-aware components that adapt to where they're placed.

## Why Container Queries?

### The Viewport Problem

```
┌─────────────────────────────────────────────────────────────┐
│ Viewport: 1200px                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  ┌───────────────────────────────────────┐  │
│ │  Sidebar    │  │  Main Content                         │  │
│ │  300px      │  │  900px                                │  │
│ │             │  │                                       │  │
│ │ ┌─────────┐ │  │  ┌─────────────────────────────────┐  │  │
│ │ │ Card    │ │  │  │ Same Card                       │  │  │
│ │ │ @md?    │ │  │  │ @md applies (viewport > 768)    │  │  │
│ │ │ ✗ Wrong │ │  │  │ But card only has 300px!       │  │  │
│ │ └─────────┘ │  │  └─────────────────────────────────┘  │  │
│ └─────────────┘  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

With viewport media queries: Both cards get @md styles
With container queries: Each card responds to its actual space
```

### The Container Solution

```typescript
// Card responds to container width, not viewport
<div className="@container">
  <Card className="@md:flex @md:flex-row @sm:flex-col" />
</div>
```

## Tailwind CSS v4 Container Syntax

### Defining Containers

```typescript
// Basic container
<div className="@container">
  {/* Children can use @sm, @md, @lg, etc. */}
</div>

// Named container (for nested queries)
<div className="@container/sidebar">
  {/* Children use @sm/sidebar, @md/sidebar, etc. */}
</div>
```

### Container Breakpoints

| Class | Container Width |
|-------|-----------------|
| `@xs:` | ≥ 20rem (320px) |
| `@sm:` | ≥ 24rem (384px) |
| `@md:` | ≥ 28rem (448px) |
| `@lg:` | ≥ 32rem (512px) |
| `@xl:` | ≥ 36rem (576px) |
| `@2xl:` | ≥ 42rem (672px) |
| `@3xl:` | ≥ 48rem (768px) |
| `@4xl:` | ≥ 56rem (896px) |
| `@5xl:` | ≥ 64rem (1024px) |
| `@6xl:` | ≥ 72rem (1152px) |
| `@7xl:` | ≥ 80rem (1280px) |

### Custom Container Sizes

```css
/* globals.css */
@theme {
  --container-3xs: 16rem;  /* 256px */
  --container-2xs: 18rem;  /* 288px */
}
```

## Component Patterns

### Responsive Card

```typescript
const Card = ({ image, title, description, children }: CardProps) => (
  <div className="@container">
    <div className={cn(
      "bg-card rounded-lg border overflow-hidden",
      // Stack on small containers, horizontal on larger
      "flex flex-col @md:flex-row"
    )}>
      {/* Image */}
      <div className={cn(
        "relative",
        "w-full @md:w-1/3",
        "h-48 @md:h-auto"
      )}>
        <img src={image} alt="" className="object-cover w-full h-full" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 @lg:p-6">
        <h3 className={cn(
          "font-semibold",
          "text-lg @lg:text-xl"
        )}>
          {title}
        </h3>
        <p className={cn(
          "text-muted-foreground mt-2",
          "text-sm @lg:text-base",
          "line-clamp-2 @lg:line-clamp-3"
        )}>
          {description}
        </p>
        {children}
      </div>
    </div>
  </div>
)
```

### Adaptive Grid

```typescript
const AdaptiveGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="@container">
    <div className={cn(
      "grid gap-4",
      "grid-cols-1",
      "@sm:grid-cols-2",
      "@lg:grid-cols-3",
      "@2xl:grid-cols-4"
    )}>
      {children}
    </div>
  </div>
)
```

### Product Card

```typescript
const ProductCard = ({ product }: { product: Product }) => (
  <div className="@container">
    <div className={cn(
      "bg-card rounded-lg border p-4 @lg:p-6",
      "flex flex-col @sm:flex-row @sm:items-center gap-4"
    )}>
      {/* Image */}
      <div className={cn(
        "flex-shrink-0",
        "w-full @sm:w-24 @md:w-32 @lg:w-40",
        "aspect-square rounded-md overflow-hidden"
      )}>
        <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-base @lg:text-lg truncate">
          {product.name}
        </h3>
        <p className={cn(
          "text-muted-foreground text-sm mt-1",
          "hidden @md:block @md:line-clamp-2"
        )}>
          {product.description}
        </p>
        <div className="flex items-center justify-between mt-2 @md:mt-4">
          <span className="font-semibold text-lg @lg:text-xl">
            ${product.price}
          </span>
          <Button size="sm" className="@lg:size-default">
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  </div>
)
```

### Stats Widget

```typescript
const StatsWidget = ({ stats }: { stats: Stat[] }) => (
  <div className="@container">
    <div className={cn(
      "bg-card rounded-lg border",
      "grid gap-4 p-4 @lg:p-6",
      "grid-cols-2 @md:grid-cols-4"
    )}>
      {stats.map(stat => (
        <div key={stat.label} className="text-center @md:text-left">
          <p className={cn(
            "text-muted-foreground",
            "text-xs @lg:text-sm"
          )}>
            {stat.label}
          </p>
          <p className={cn(
            "font-semibold",
            "text-xl @lg:text-2xl @xl:text-3xl"
          )}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  </div>
)
```

### Navigation Component

```typescript
const Navigation = ({ items }: { items: NavItem[] }) => (
  <nav className="@container">
    <div className={cn(
      "flex",
      // Vertical on small, horizontal on larger
      "flex-col @sm:flex-row",
      "gap-1 @sm:gap-2"
    )}>
      {items.map(item => (
        <a
          key={item.href}
          href={item.href}
          className={cn(
            "px-3 py-2 rounded-md text-sm font-medium",
            "hover:bg-accent transition-colors",
            // Full width on small, auto on larger
            "w-full @sm:w-auto",
            // Center text on small
            "text-center @sm:text-left"
          )}
        >
          {item.label}
        </a>
      ))}
    </div>
  </nav>
)
```

## Named Containers

Use named containers when nesting or for clarity:

```typescript
const Dashboard = () => (
  <div className="flex">
    {/* Sidebar with named container */}
    <aside className="w-64 @container/sidebar">
      <nav className={cn(
        // Responds to sidebar width
        "@sm/sidebar:block hidden"
      )}>
        <SidebarNav />
      </nav>
    </aside>

    {/* Main content with named container */}
    <main className="flex-1 @container/main">
      <div className={cn(
        // Responds to main content width
        "grid gap-6",
        "@sm/main:grid-cols-2",
        "@lg/main:grid-cols-3"
      )}>
        <DashboardCards />
      </div>
    </main>
  </div>
)
```

### Nested Containers

```typescript
const NestedLayout = () => (
  <div className="@container/outer">
    <div className={cn(
      "p-4",
      "@lg/outer:p-8"
    )}>
      <div className="@container/inner">
        <div className={cn(
          "grid gap-4",
          "@md/inner:grid-cols-2"
        )}>
          {/* Inner content responds to inner container */}
        </div>
      </div>
    </div>
  </div>
)
```

## Container Query Units

Use container query units for size-relative values:

```typescript
// cqw = 1% of container width
// cqh = 1% of container height
// cqi = 1% of container inline size
// cqb = 1% of container block size
// cqmin = smaller of cqi/cqb
// cqmax = larger of cqi/cqb

const FluidText = () => (
  <div className="@container">
    {/* Font size scales with container */}
    <h1 style={{ fontSize: "clamp(1rem, 5cqi, 3rem)" }}>
      Fluid Heading
    </h1>
  </div>
)
```

### Tailwind with Container Units

```css
/* globals.css */
@layer utilities {
  .text-fluid-sm {
    font-size: clamp(0.875rem, 3cqi, 1rem);
  }
  .text-fluid-base {
    font-size: clamp(1rem, 4cqi, 1.25rem);
  }
  .text-fluid-lg {
    font-size: clamp(1.25rem, 5cqi, 2rem);
  }
  .text-fluid-xl {
    font-size: clamp(1.5rem, 6cqi, 3rem);
  }
}
```

## Component Library Integration

### Container-Aware Button

```typescript
const ContainerButton = ({ children, ...props }: ButtonProps) => (
  <button
    className={cn(
      "rounded-md font-medium transition-colors",
      "bg-primary text-primary-foreground hover:bg-primary/90",
      // Size adapts to container
      "px-3 py-1.5 text-sm",
      "@md:px-4 @md:py-2 @md:text-base",
      "@lg:px-6 @lg:py-3"
    )}
    {...props}
  >
    {children}
  </button>
)
```

### Container-Aware Input

```typescript
const ContainerInput = (props: InputProps) => (
  <input
    className={cn(
      "rounded-md border bg-background",
      "text-sm placeholder:text-muted-foreground",
      "focus-visible:ring-2 focus-visible:ring-ring",
      // Size adapts to container
      "h-9 px-3 @md:h-10 @lg:h-11"
    )}
    {...props}
  />
)
```

### Container Form Layout

```typescript
const ContainerForm = ({ children }: { children: React.ReactNode }) => (
  <div className="@container">
    <form className={cn(
      "space-y-4",
      // Stack on small, grid on larger
      "@md:grid @md:grid-cols-2 @md:gap-4 @md:space-y-0",
      "@lg:grid-cols-3"
    )}>
      {children}
    </form>
  </div>
)
```

## Real-World Examples

### Article Card (Blog)

```typescript
const ArticleCard = ({ article }: { article: Article }) => (
  <article className="@container">
    <div className={cn(
      "bg-card rounded-lg border overflow-hidden",
      "flex flex-col @lg:flex-row"
    )}>
      {/* Featured image */}
      <div className={cn(
        "relative",
        "h-48 @lg:h-auto @lg:w-2/5",
        "overflow-hidden"
      )}>
        <img
          src={article.image}
          alt=""
          className="object-cover w-full h-full"
        />
        <div className={cn(
          "absolute top-2 left-2",
          "@lg:top-4 @lg:left-4"
        )}>
          <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
            {article.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 @lg:p-6 flex flex-col">
        <time className="text-sm text-muted-foreground">
          {article.date}
        </time>
        <h2 className={cn(
          "font-semibold mt-2",
          "text-lg @lg:text-xl"
        )}>
          {article.title}
        </h2>
        <p className={cn(
          "text-muted-foreground mt-2 flex-1",
          "text-sm @lg:text-base",
          "line-clamp-2 @lg:line-clamp-3"
        )}>
          {article.excerpt}
        </p>
        <a
          href={article.url}
          className="text-primary font-medium mt-4 inline-flex items-center gap-1"
        >
          Read more
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  </article>
)
```

### User Profile Widget

```typescript
const UserProfile = ({ user }: { user: User }) => (
  <div className="@container">
    <div className={cn(
      "bg-card rounded-lg border p-4 @lg:p-6",
      "flex flex-col @md:flex-row items-center @md:items-start gap-4"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0",
        "h-16 w-16 @md:h-20 @md:w-20 @lg:h-24 @lg:w-24",
        "rounded-full overflow-hidden"
      )}>
        <img src={user.avatar} alt={user.name} className="object-cover w-full h-full" />
      </div>

      {/* Info */}
      <div className={cn(
        "flex-1 min-w-0",
        "text-center @md:text-left"
      )}>
        <h3 className="font-semibold text-lg @lg:text-xl truncate">
          {user.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {user.role}
        </p>

        {/* Stats - hidden on small containers */}
        <div className={cn(
          "hidden @lg:flex gap-6 mt-4"
        )}>
          <div>
            <span className="font-semibold">{user.followers}</span>
            <span className="text-muted-foreground text-sm ml-1">followers</span>
          </div>
          <div>
            <span className="font-semibold">{user.following}</span>
            <span className="text-muted-foreground text-sm ml-1">following</span>
          </div>
        </div>
      </div>

      {/* Action button */}
      <Button
        variant="outline"
        className={cn(
          "w-full @md:w-auto",
          "mt-2 @md:mt-0"
        )}
      >
        Follow
      </Button>
    </div>
  </div>
)
```

## CSS Definition

```css
/* For browsers that need explicit container-type */
@layer utilities {
  .\@container {
    container-type: inline-size;
  }

  .\@container\/sidebar {
    container-type: inline-size;
    container-name: sidebar;
  }

  .\@container\/main {
    container-type: inline-size;
    container-name: main;
  }
}
```

## Browser Support

Container queries have excellent browser support (2023+):
- Chrome 105+
- Firefox 110+
- Safari 16+
- Edge 105+

For older browsers, components gracefully degrade to the base styles.

## Best Practices

| Do | Don't |
|----|-------|
| Use `@container` on immediate parent | Apply container to entire page |
| Design mobile-first (`flex-col` then `@md:flex-row`) | Design desktop-first |
| Use named containers for nested queries | Create ambiguous container scopes |
| Keep breakpoint logic simple | Over-complicate with too many breakpoints |
| Test in various container widths | Only test at viewport breakpoints |
| Use container queries for components | Use them for page layout |

## Quick Reference

```typescript
// Define container
<div className="@container">

// Named container
<div className="@container/sidebar">

// Use container breakpoints
<div className="flex-col @md:flex-row">
<div className="text-sm @lg:text-base">
<div className="hidden @md:block">
<div className="grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3">

// Named container queries
<div className="@md/sidebar:block">
```
