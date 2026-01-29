# Dashboard Layout Generator

Complete dashboard layout with collapsible sidebar, header, breadcrumbs, and main content area.

## Generated Component

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  User,
  Bell,
  Search,
  LogOut
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

// =============================================================================
// CONTEXT
// =============================================================================

interface DashboardContextValue {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  isMobile: boolean
}

const DashboardContext = React.createContext<DashboardContextValue | null>(null)

const useDashboard = () => {
  const context = React.useContext(DashboardContext)
  if (!context) {
    throw new Error("useDashboard must be used within DashboardLayout")
  }
  return context
}

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: string | number
  children?: NavItem[]
}

interface UserInfo {
  name: string
  email: string
  avatar?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  /**
   * Navigation items for sidebar
   */
  navItems: NavItem[]
  /**
   * Current active path
   */
  activePath?: string
  /**
   * User information for header
   */
  user?: UserInfo
  /**
   * Brand logo or text
   */
  brand?: React.ReactNode
  /**
   * Header actions (notifications, etc.)
   */
  headerActions?: React.ReactNode
  /**
   * Footer content for sidebar
   */
  sidebarFooter?: React.ReactNode
  /**
   * Default collapsed state
   */
  defaultCollapsed?: boolean
  /**
   * Callback when sidebar state changes
   */
  onSidebarChange?: (collapsed: boolean) => void
}

// =============================================================================
// DASHBOARD LAYOUT
// =============================================================================

const DashboardLayout = ({
  children,
  navItems,
  activePath,
  user,
  brand,
  headerActions,
  sidebarFooter,
  defaultCollapsed = false,
  onSidebarChange
}: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(defaultCollapsed)
  const [isMobile, setIsMobile] = React.useState(false)

  // Handle responsive behavior
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Notify parent of sidebar state changes
  React.useEffect(() => {
    onSidebarChange?.(sidebarCollapsed)
  }, [sidebarCollapsed, onSidebarChange])

  // Lock body scroll on mobile when sidebar is open
  React.useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobile, sidebarOpen])

  return (
    <DashboardContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        isMobile
      }}
    >
      <div className="min-h-screen bg-muted/30">
        {/* Sidebar */}
        <Sidebar
          navItems={navItems}
          activePath={activePath}
          brand={brand}
          footer={sidebarFooter}
        />

        {/* Main Content Area */}
        <div
          className={cn(
            "flex flex-col min-h-screen transition-all duration-300",
            !isMobile && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")
          )}
        >
          {/* Header */}
          <Header user={user} actions={headerActions} />

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </DashboardContext.Provider>
  )
}

// =============================================================================
// SIDEBAR
// =============================================================================

interface SidebarProps {
  navItems: NavItem[]
  activePath?: string
  brand?: React.ReactNode
  footer?: React.ReactNode
}

const Sidebar = ({ navItems, activePath, brand, footer }: SidebarProps) => {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, isMobile } =
    useDashboard()

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 64 }
  }

  const mobileVariants = {
    open: { x: 0 },
    closed: { x: "-100%" }
  }

  // Desktop Sidebar
  if (!isMobile) {
    return (
      <motion.aside
        className={cn(
          "fixed top-0 left-0 z-30 h-screen",
          "bg-background border-r",
          "hidden lg:flex flex-col"
        )}
        variants={sidebarVariants}
        animate={sidebarCollapsed ? "collapsed" : "expanded"}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-semibold text-lg truncate"
              >
                {brand || "Dashboard"}
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <NavList
            items={navItems}
            activePath={activePath}
            collapsed={sidebarCollapsed}
          />
        </nav>

        {/* Footer */}
        {footer && !sidebarCollapsed && (
          <div className="border-t p-4">{footer}</div>
        )}
      </motion.aside>
    )
  }

  // Mobile Sidebar
  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          className={cn(
            "fixed top-0 left-0 z-50 h-screen w-64",
            "bg-background border-r",
            "flex flex-col lg:hidden"
          )}
          variants={mobileVariants}
          initial="closed"
          animate="open"
          exit="closed"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Brand */}
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <div className="font-semibold text-lg">{brand || "Dashboard"}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <NavList
              items={navItems}
              activePath={activePath}
              collapsed={false}
              onItemClick={() => setSidebarOpen(false)}
            />
          </nav>

          {/* Footer */}
          {footer && <div className="border-t p-4">{footer}</div>}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// NAV LIST
// =============================================================================

interface NavListProps {
  items: NavItem[]
  activePath?: string
  collapsed?: boolean
  onItemClick?: () => void
}

const NavList = ({ items, activePath, collapsed, onItemClick }: NavListProps) => (
  <ul className="space-y-1 px-2">
    {items.map((item) => (
      <NavItemComponent
        key={item.href}
        item={item}
        activePath={activePath}
        collapsed={collapsed}
        onItemClick={onItemClick}
      />
    ))}
  </ul>
)

// =============================================================================
// NAV ITEM
// =============================================================================

interface NavItemComponentProps {
  item: NavItem
  activePath?: string
  collapsed?: boolean
  depth?: number
  onItemClick?: () => void
}

const NavItemComponent = ({
  item,
  activePath,
  collapsed,
  depth = 0,
  onItemClick
}: NavItemComponentProps) => {
  const [expanded, setExpanded] = React.useState(false)
  const isActive = activePath === item.href
  const hasChildren = item.children && item.children.length > 0

  return (
    <li>
      <a
        href={item.href}
        onClick={(e) => {
          if (hasChildren) {
            e.preventDefault()
            setExpanded(!expanded)
          } else {
            onItemClick?.()
          }
        }}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2",
          "text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "bg-accent text-accent-foreground",
          depth > 0 && "ml-6"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {item.icon && (
          <span className="shrink-0">{item.icon}</span>
        )}

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {item.badge}
              </span>
            )}
            {hasChildren && (
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            )}
          </>
        )}
      </a>

      {/* Children */}
      {hasChildren && !collapsed && (
        <AnimatePresence>
          {expanded && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {item.children!.map((child) => (
                <NavItemComponent
                  key={child.href}
                  item={child}
                  activePath={activePath}
                  collapsed={collapsed}
                  depth={depth + 1}
                  onItemClick={onItemClick}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </li>
  )
}

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  user?: UserInfo
  actions?: React.ReactNode
}

const Header = ({ user, actions }: HeaderProps) => {
  const { setSidebarOpen, isMobile } = useDashboard()

  return (
    <header className="sticky top-0 z-20 h-16 bg-background border-b">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left: Mobile menu + Search */}
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="hidden sm:block w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Right: Actions + User */}
        <div className="flex items-center gap-2">
          {actions}

          {/* Notifications */}
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="hidden md:block text-sm font-medium">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}

// =============================================================================
// PAGE HEADER
// =============================================================================

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

const PageHeader = ({
  title,
  description,
  breadcrumbs,
  actions
}: PageHeaderProps) => (
  <div className="mb-6">
    {/* Breadcrumbs */}
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <a href="/" className="hover:text-foreground">
              <Home className="h-4 w-4" />
            </a>
          </li>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <li>/</li>
              <li>
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </li>
            </React.Fragment>
          ))}
        </ol>
      </nav>
    )}

    {/* Title + Actions */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </div>
)

// =============================================================================
// CONTENT CARD
// =============================================================================

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  actions?: React.ReactNode
}

const ContentCard = React.forwardRef<HTMLDivElement, ContentCardProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
)
ContentCard.displayName = "ContentCard"

export {
  DashboardLayout,
  useDashboard,
  PageHeader,
  ContentCard
}
export type { DashboardLayoutProps, NavItem, UserInfo, PageHeaderProps }
```

## Basic Usage

```typescript
import {
  DashboardLayout,
  PageHeader,
  ContentCard
} from "@/components/sections/dashboard-layout"
import { LayoutDashboard, Users, FileText, Settings } from "lucide-react"

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  {
    label: "Users",
    href: "/users",
    icon: <Users className="h-4 w-4" />,
    badge: 12
  },
  {
    label: "Documents",
    href: "/documents",
    icon: <FileText className="h-4 w-4" />,
    children: [
      { label: "All Documents", href: "/documents/all" },
      { label: "Shared", href: "/documents/shared" },
      { label: "Archived", href: "/documents/archived" }
    ]
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="h-4 w-4" />
  }
]

const user = {
  name: "John Doe",
  email: "john@example.com",
  avatar: "/avatars/john.jpg"
}

export default function DashboardPage() {
  return (
    <DashboardLayout
      navItems={navItems}
      activePath="/dashboard"
      user={user}
      brand="My App"
    >
      <PageHeader
        title="Dashboard"
        description="Overview of your workspace"
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={<Button>Create New</Button>}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ContentCard title="Users" description="Total registered users">
          <p className="text-3xl font-bold">1,234</p>
        </ContentCard>
        <ContentCard title="Revenue" description="This month">
          <p className="text-3xl font-bold">$45,678</p>
        </ContentCard>
        <ContentCard title="Orders" description="Pending orders">
          <p className="text-3xl font-bold">89</p>
        </ContentCard>
      </div>
    </DashboardLayout>
  )
}
```

## With Custom Brand

```typescript
<DashboardLayout
  navItems={navItems}
  brand={
    <div className="flex items-center gap-2">
      <Logo className="h-6 w-6" />
      <span className="font-bold">Acme Inc</span>
    </div>
  }
>
  {children}
</DashboardLayout>
```

## With Sidebar Footer

```typescript
<DashboardLayout
  navItems={navItems}
  sidebarFooter={
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">John Doe</p>
        <p className="text-xs text-muted-foreground truncate">john@example.com</p>
      </div>
    </div>
  }
>
  {children}
</DashboardLayout>
```

## Default Collapsed State

```typescript
<DashboardLayout
  navItems={navItems}
  defaultCollapsed={true}
  onSidebarChange={(collapsed) => {
    // Persist preference
    localStorage.setItem("sidebar-collapsed", String(collapsed))
  }}
>
  {children}
</DashboardLayout>
```

## Nested Navigation

```typescript
const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  {
    label: "Products",
    href: "/products",
    icon: <Package className="h-4 w-4" />,
    children: [
      { label: "All Products", href: "/products" },
      { label: "Categories", href: "/products/categories" },
      { label: "Inventory", href: "/products/inventory" },
      {
        label: "Reports",
        href: "/products/reports",
        children: [
          { label: "Sales", href: "/products/reports/sales" },
          { label: "Stock", href: "/products/reports/stock" }
        ]
      }
    ]
  }
]
```

## Custom Header Actions

```typescript
<DashboardLayout
  navItems={navItems}
  headerActions={
    <>
      <Button variant="ghost" size="icon">
        <HelpCircle className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon">
        <Moon className="h-5 w-5" />
      </Button>
    </>
  }
>
  {children}
</DashboardLayout>
```

## Page Layouts

### Stats Grid

```typescript
<PageHeader title="Analytics" />

<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {stats.map((stat) => (
    <ContentCard key={stat.label}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className="text-2xl font-bold">{stat.value}</p>
        </div>
        <stat.icon className="h-8 w-8 text-muted-foreground" />
      </div>
    </ContentCard>
  ))}
</div>
```

### Two Column Layout

```typescript
<PageHeader title="User Profile" />

<div className="grid gap-6 lg:grid-cols-3">
  <ContentCard title="Profile" className="lg:col-span-2">
    {/* Main content */}
  </ContentCard>
  <div className="space-y-6">
    <ContentCard title="Activity">
      {/* Sidebar content */}
    </ContentCard>
    <ContentCard title="Quick Actions">
      {/* More sidebar content */}
    </ContentCard>
  </div>
</div>
```

### Table View

```typescript
<PageHeader
  title="Users"
  actions={
    <>
      <Button variant="outline">Export</Button>
      <Button>Add User</Button>
    </>
  }
/>

<ContentCard>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {users.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
          <TableCell>
            <Badge variant={user.active ? "default" : "secondary"}>
              {user.active ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ContentCard>
```

## Responsive Behavior

| Breakpoint | Sidebar | Header |
|------------|---------|--------|
| Mobile (<1024px) | Slide-out drawer | Hamburger menu |
| Desktop (≥1024px) | Fixed, collapsible | Full search + user |

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| `aria-current` | Active nav item has `aria-current="page"` |
| `aria-label` | Sidebar toggle has descriptive label |
| Keyboard navigation | All items focusable with Tab |
| Focus trap | Mobile sidebar traps focus |
| Skip link | Add skip to main content |
| Breadcrumb `aria-label` | Navigation labeled "Breadcrumb" |

### Skip Link

```typescript
// Add before DashboardLayout
<a
  href="#main-content"
  className={cn(
    "sr-only focus:not-sr-only",
    "focus:absolute focus:top-4 focus:left-4 focus:z-[100]",
    "focus:px-4 focus:py-2 focus:bg-background",
    "focus:rounded-md focus:shadow-lg focus:ring-2"
  )}
>
  Skip to main content
</a>

// Add to main element
<main id="main-content" className="flex-1 p-4 md:p-6">
```

## Persistence

```typescript
"use client"

import { useLocalStorage } from "@/hooks/use-local-storage"

const DashboardWithPersistence = ({ children }) => {
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false)

  return (
    <DashboardLayout
      navItems={navItems}
      defaultCollapsed={collapsed}
      onSidebarChange={setCollapsed}
    >
      {children}
    </DashboardLayout>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Keep nav items to 7-10 max | Overcrowd sidebar with items |
| Use icons for all nav items | Mix items with and without icons |
| Group related items with children | Create flat navigation only |
| Show badges for notifications | Use badges for static info |
| Persist collapsed state | Reset state on every load |
| Test mobile navigation | Only test desktop view |

## Export

```typescript
// components/sections/dashboard-layout.tsx
export {
  DashboardLayout,
  useDashboard,
  PageHeader,
  ContentCard
}
export type {
  DashboardLayoutProps,
  NavItem,
  UserInfo,
  PageHeaderProps
}
```
