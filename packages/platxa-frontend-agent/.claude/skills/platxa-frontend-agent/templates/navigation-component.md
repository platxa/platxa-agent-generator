# Navigation Component Generator

Complete responsive navigation with desktop links, mobile hamburger menu, and animated transitions.

## Generated Component

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  label: string
  href: string
  isActive?: boolean
}

interface NavAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "outline" | "ghost"
}

interface NavigationProps {
  /**
   * Brand logo or text
   */
  brand: React.ReactNode
  /**
   * Navigation items
   */
  items: NavItem[]
  /**
   * Action buttons (right side)
   */
  actions?: NavAction[]
  /**
   * Sticky header
   */
  sticky?: boolean
  /**
   * Custom class name
   */
  className?: string
}

// =============================================================================
// NAVIGATION COMPONENT
// =============================================================================

const Navigation = ({
  brand,
  items,
  actions = [],
  sticky = true,
  className
}: NavigationProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // Close mobile menu on resize to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Prevent body scroll when mobile menu is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <header
      className={cn(
        "w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border-b",
        sticky && "sticky top-0 z-50",
        className
      )}
    >
      <nav className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand */}
        <div className="flex items-center">
          <a href="/" className="flex items-center space-x-2">
            {brand}
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-6">
          {/* Nav Links */}
          <div className="flex items-center gap-6">
            {items.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              {actions.map((action, index) => (
                <NavAction key={index} {...action} />
              ))}
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        items={items}
        actions={actions}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  )
}

// =============================================================================
// NAV LINK
// =============================================================================

const NavLink = ({ label, href, isActive }: NavItem) => (
  <a
    href={href}
    className={cn(
      "text-sm font-medium transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "focus-visible:ring-offset-2 rounded-sm",
      isActive ? "text-foreground" : "text-muted-foreground"
    )}
  >
    {label}
  </a>
)

// =============================================================================
// NAV ACTION
// =============================================================================

const NavAction = ({ label, href, onClick, variant = "default" }: NavAction) => {
  if (href) {
    return (
      <Button variant={variant} size="sm" asChild>
        <a href={href}>{label}</a>
      </Button>
    )
  }

  return (
    <Button variant={variant} size="sm" onClick={onClick}>
      {label}
    </Button>
  )
}

// =============================================================================
// MOBILE MENU
// =============================================================================

interface MobileMenuProps {
  isOpen: boolean
  items: NavItem[]
  actions: NavAction[]
  onClose: () => void
}

const MobileMenu = ({ isOpen, items, actions, onClose }: MobileMenuProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Menu Panel */}
        <motion.div
          id="mobile-menu"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed top-16 right-0 bottom-0 z-50 w-3/4 max-w-sm",
            "bg-background border-l shadow-xl",
            "md:hidden"
          )}
        >
          <nav className="flex flex-col h-full p-6">
            {/* Nav Items */}
            <div className="flex-1 space-y-1">
              {items.map((item, index) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={onClose}
                  className={cn(
                    "block px-4 py-3 rounded-md text-base font-medium",
                    "transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.label}
                </motion.a>
              ))}
            </div>

            {/* Actions */}
            {actions.length > 0 && (
              <div className="border-t pt-6 space-y-3">
                {actions.map((action, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: items.length * 0.05 + index * 0.05 }}
                  >
                    {action.href ? (
                      <Button
                        variant={action.variant}
                        className="w-full"
                        asChild
                        onClick={onClose}
                      >
                        <a href={action.href}>{action.label}</a>
                      </Button>
                    ) : (
                      <Button
                        variant={action.variant}
                        className="w-full"
                        onClick={() => {
                          action.onClick?.()
                          onClose()
                        }}
                      >
                        {action.label}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </nav>
        </motion.div>
      </>
    )}
  </AnimatePresence>
)

export { Navigation }
export type { NavigationProps, NavItem, NavAction }
```

## Basic Usage

```typescript
<Navigation
  brand={
    <>
      <Logo className="h-8 w-8" />
      <span className="font-bold text-xl">Brand</span>
    </>
  }
  items={[
    { label: "Home", href: "/", isActive: true },
    { label: "Products", href: "/products" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" }
  ]}
  actions={[
    { label: "Sign In", href: "/login", variant: "ghost" },
    { label: "Get Started", href: "/signup" }
  ]}
/>
```

## Variants

### Simple Navigation (No Actions)

```typescript
<Navigation
  brand={<span className="font-bold text-xl">Logo</span>}
  items={[
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" }
  ]}
/>
```

### With User Menu

```typescript
<Navigation
  brand={<Logo />}
  items={navItems}
  actions={[
    {
      label: user ? "Dashboard" : "Sign In",
      href: user ? "/dashboard" : "/login",
      variant: "ghost"
    },
    user
      ? { label: "Sign Out", onClick: handleSignOut, variant: "outline" }
      : { label: "Sign Up", href: "/signup" }
  ]}
/>
```

### Non-Sticky

```typescript
<Navigation
  brand={<Logo />}
  items={navItems}
  sticky={false}
/>
```

## Animated Hamburger Icon

Enhanced hamburger with animated transition:

```typescript
const AnimatedMenuIcon = ({ isOpen }: { isOpen: boolean }) => (
  <div className="relative w-5 h-5">
    <motion.span
      className="absolute left-0 w-5 h-0.5 bg-current"
      animate={{
        top: isOpen ? "50%" : "25%",
        rotate: isOpen ? 45 : 0,
        translateY: isOpen ? "-50%" : 0
      }}
      transition={{ duration: 0.2 }}
    />
    <motion.span
      className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-0.5 bg-current"
      animate={{ opacity: isOpen ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    />
    <motion.span
      className="absolute left-0 w-5 h-0.5 bg-current"
      animate={{
        top: isOpen ? "50%" : "75%",
        rotate: isOpen ? -45 : 0,
        translateY: isOpen ? "-50%" : 0
      }}
      transition={{ duration: 0.2 }}
    />
  </div>
)
```

## Navigation with Dropdown

```typescript
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

const NavItemWithDropdown = ({
  label,
  items
}: {
  label: string
  items: NavItem[]
}) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button
        className={cn(
          "flex items-center gap-1 text-sm font-medium",
          "text-muted-foreground hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        )}
      >
        {label}
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content
        className={cn(
          "min-w-[180px] bg-popover rounded-md shadow-lg border p-1",
          "animate-in fade-in-0 zoom-in-95"
        )}
        sideOffset={8}
      >
        {items.map((item) => (
          <DropdownMenu.Item key={item.href} asChild>
            <a
              href={item.href}
              className={cn(
                "block px-3 py-2 text-sm rounded-sm",
                "hover:bg-accent focus:bg-accent outline-none"
              )}
            >
              {item.label}
            </a>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
)
```

## Scroll-Aware Navigation

Header that hides on scroll down, shows on scroll up:

```typescript
const ScrollAwareNavigation = (props: NavigationProps) => {
  const [isVisible, setIsVisible] = React.useState(true)
  const [lastScrollY, setLastScrollY] = React.useState(0)

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 100) {
        // Always show at top
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down
        setIsVisible(false)
      } else {
        // Scrolling up
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  return (
    <motion.div
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : -100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Navigation {...props} />
    </motion.div>
  )
}
```

## Transparent to Solid Navigation

Changes background on scroll:

```typescript
const TransparentNavigation = (props: NavigationProps) => {
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <Navigation
      {...props}
      className={cn(
        "transition-all duration-300",
        isScrolled
          ? "bg-background/95 backdrop-blur border-b"
          : "bg-transparent border-transparent"
      )}
    />
  )
}
```

## Mobile Overlay Menu (Full Screen)

Alternative full-screen mobile menu:

```typescript
const FullScreenMobileMenu = ({ isOpen, items, onClose }: MobileMenuProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background md:hidden"
      >
        {/* Close button */}
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Menu content */}
        <nav className="flex flex-col items-center justify-center h-full space-y-8">
          {items.map((item, index) => (
            <motion.a
              key={item.href}
              href={item.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={onClose}
              className={cn(
                "text-2xl font-semibold",
                item.isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </motion.a>
          ))}
        </nav>
      </motion.div>
    )}
  </AnimatePresence>
)
```

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| `aria-label` | Menu button has "Open/Close menu" |
| `aria-expanded` | Indicates menu state |
| `aria-controls` | Links button to menu |
| Focus management | Focus trapped in mobile menu |
| Keyboard navigation | Tab through links |
| Skip link | Add skip to main content link |

### Skip Link

```typescript
const SkipLink = () => (
  <a
    href="#main-content"
    className={cn(
      "sr-only focus:not-sr-only",
      "focus:absolute focus:top-4 focus:left-4 focus:z-[100]",
      "focus:px-4 focus:py-2 focus:bg-background focus:text-foreground",
      "focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-ring"
    )}
  >
    Skip to main content
  </a>
)

// Usage: Place before Navigation
<>
  <SkipLink />
  <Navigation {...props} />
  <main id="main-content">...</main>
</>
```

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< md` (768px) | Hamburger menu, mobile panel |
| `≥ md` (768px) | Horizontal desktop nav |

## Best Practices

| Do | Don't |
|----|-------|
| Limit nav items to 5-7 | Overcrowd with too many links |
| Use clear, concise labels | Use vague labels like "Stuff" |
| Highlight current page | Leave navigation state unclear |
| Close mobile menu on link click | Keep menu open after navigation |
| Lock body scroll when menu open | Allow scroll behind overlay |
| Add skip link for accessibility | Force users through all nav |
| Use semantic `<nav>` element | Use only `<div>` |

## Export

```typescript
// components/ui/navigation.tsx
export { Navigation, NavLink, NavAction, MobileMenu }
export type { NavigationProps, NavItem, NavAction }
```
