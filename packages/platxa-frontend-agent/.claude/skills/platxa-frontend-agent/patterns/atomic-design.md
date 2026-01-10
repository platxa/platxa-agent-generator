# Atomic Design Component Templates

Structured component organization following Brad Frost's Atomic Design methodology with atoms, molecules, organisms, templates, and pages.

## Overview

Atomic Design provides a systematic approach to building design systems by breaking interfaces into fundamental building blocks:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ATOMIC DESIGN HIERARCHY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────┐   ┌──────────┐   ┌───────────┐   ┌─────────┐   ┌────┐│
│  │Atoms │ → │Molecules │ → │ Organisms │ → │Templates│ → │Page││
│  └──────┘   └──────────┘   └───────────┘   └─────────┘   └────┘│
│                                                                  │
│  Button     SearchField    Header          PageLayout   HomePage│
│  Input      FormField      Navigation      DashboardTpl UserPage│
│  Label      UserAvatar     Sidebar         AuthLayout   Settings│
│  Icon       NavLink        Footer          ListingTpl   Checkout│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
src/
├── components/
│   ├── atoms/              # Smallest, indivisible components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Label/
│   │   ├── Icon/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Spinner/
│   │   └── index.ts        # Barrel export
│   │
│   ├── molecules/          # Combinations of atoms
│   │   ├── FormField/
│   │   │   ├── FormField.tsx
│   │   │   ├── FormField.test.tsx
│   │   │   └── index.ts
│   │   ├── SearchInput/
│   │   ├── NavLink/
│   │   ├── UserAvatar/
│   │   ├── CardHeader/
│   │   └── index.ts
│   │
│   ├── organisms/          # Complex, standalone sections
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   ├── Header.test.tsx
│   │   │   └── index.ts
│   │   ├── Navigation/
│   │   ├── Sidebar/
│   │   ├── Footer/
│   │   ├── LoginForm/
│   │   ├── DataTable/
│   │   └── index.ts
│   │
│   ├── templates/          # Page layouts without data
│   │   ├── PageLayout/
│   │   ├── DashboardLayout/
│   │   ├── AuthLayout/
│   │   └── index.ts
│   │
│   └── index.ts            # Main barrel export
│
├── pages/                  # Full pages with data
│   ├── HomePage/
│   ├── DashboardPage/
│   ├── SettingsPage/
│   └── index.ts
```

## Level Definitions

### Atoms

The smallest, indivisible UI components. They are:
- Single-purpose
- Highly reusable
- No dependencies on other components
- Styled but context-agnostic

```typescript
// atoms/Button/Button.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
export type { ButtonProps }
```

```typescript
// atoms/Input/Input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
export type { InputProps }
```

```typescript
// atoms/Label/Label.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  )
)
Label.displayName = "Label"

export { Label }
export type { LabelProps }
```

### Molecules

Combinations of atoms working together as a unit:
- Composed of multiple atoms
- Single, well-defined purpose
- Reusable across different contexts
- May have internal state

```typescript
// molecules/FormField/FormField.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/atoms/Label"
import { Input } from "@/components/atoms/Input"

interface FormFieldProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  error?: string
  required?: boolean
  className?: string
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, name, type = "text", placeholder, error, required, className }, ref) => (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Input
        ref={ref}
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
)
FormField.displayName = "FormField"

export { FormField }
export type { FormFieldProps }
```

```typescript
// molecules/SearchInput/SearchInput.tsx
import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/atoms/Input"
import { Button } from "@/components/atoms/Button"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  className?: string
}

const SearchInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  className
}: SearchInputProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(value)
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}

export { SearchInput }
export type { SearchInputProps }
```

```typescript
// molecules/UserAvatar/UserAvatar.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/atoms/Avatar"

interface UserAvatarProps {
  user: {
    name: string
    email?: string
    image?: string
  }
  showInfo?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
}

const sizeClasses = {
  sm: { avatar: "h-8 w-8", text: "text-sm", subtext: "text-xs" },
  default: { avatar: "h-10 w-10", text: "text-sm", subtext: "text-xs" },
  lg: { avatar: "h-12 w-12", text: "text-base", subtext: "text-sm" }
}

const UserAvatar = ({
  user,
  showInfo = false,
  size = "default",
  className
}: UserAvatarProps) => {
  const sizes = sizeClasses[size]
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className={sizes.avatar}>
        {user.image ? (
          <img src={user.image} alt="" className="object-cover" />
        ) : (
          <span className="font-medium">{initials}</span>
        )}
      </Avatar>
      {showInfo && (
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", sizes.text)}>{user.name}</p>
          {user.email && (
            <p className={cn("text-muted-foreground truncate", sizes.subtext)}>
              {user.email}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export { UserAvatar }
export type { UserAvatarProps }
```

### Organisms

Complex, standalone sections composed of molecules and atoms:
- Complete, functional UI sections
- Can manage their own state
- May fetch data
- Contextually aware

```typescript
// organisms/Header/Header.tsx
import * as React from "react"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/atoms/Button"
import { SearchInput } from "@/components/molecules/SearchInput"
import { UserAvatar } from "@/components/molecules/UserAvatar"

interface HeaderProps {
  user?: {
    name: string
    email: string
    image?: string
  }
  onMenuClick?: () => void
  onSearch?: (query: string) => void
  className?: string
}

const Header = ({ user, onMenuClick, onSearch, className }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = React.useState("")

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur",
        className
      )}
    >
      <div className="container flex h-16 items-center gap-4 px-4">
        {/* Mobile menu */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <a href="/" className="font-bold text-xl">
          Logo
        </a>

        {/* Search */}
        <div className="flex-1 max-w-md mx-auto hidden sm:block">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={onSearch}
          />
        </div>

        {/* User */}
        <div className="ml-auto">
          {user ? (
            <UserAvatar user={user} showInfo className="hidden md:flex" />
          ) : (
            <Button>Sign In</Button>
          )}
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }
```

```typescript
// organisms/LoginForm/LoginForm.tsx
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/atoms/Button"
import { FormField } from "@/components/molecules/FormField"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  className?: string
}

const LoginForm = ({ onSubmit, className }: LoginFormProps) => {
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  })

  const handleFormSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await onSubmit(data)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn("space-y-4", className)}
    >
      <FormField
        label="Email"
        type="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        required
        {...register("email")}
      />

      <FormField
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        required
        {...register("password")}
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  )
}

export { LoginForm }
export type { LoginFormProps, LoginFormData }
```

### Templates

Page-level layouts without specific content:
- Define page structure
- Accept children or slots
- No data fetching
- Purely presentational

```typescript
// templates/PageLayout/PageLayout.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Header } from "@/components/organisms/Header"
import { Footer } from "@/components/organisms/Footer"

interface PageLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    image?: string
  }
  className?: string
}

const PageLayout = ({ children, user, className }: PageLayoutProps) => (
  <div className="min-h-screen flex flex-col">
    <Header user={user} />
    <main className={cn("flex-1 container py-8", className)}>
      {children}
    </main>
    <Footer />
  </div>
)

export { PageLayout }
export type { PageLayoutProps }
```

```typescript
// templates/DashboardLayout/DashboardLayout.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Header } from "@/components/organisms/Header"
import { Sidebar } from "@/components/organisms/Sidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    name: string
    email: string
    image?: string
  }
  navigation: {
    label: string
    href: string
    icon: React.ReactNode
  }[]
}

const DashboardLayout = ({
  children,
  user,
  navigation
}: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className="min-h-screen">
      <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigation}
        />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export { DashboardLayout }
export type { DashboardLayoutProps }
```

### Pages

Complete pages with real data:
- Fetch and manage data
- Compose templates with content
- Handle routing
- Manage page-level state

```typescript
// pages/DashboardPage/DashboardPage.tsx
import * as React from "react"
import { DashboardLayout } from "@/components/templates/DashboardLayout"
import { StatsCard } from "@/components/organisms/StatsCard"
import { RecentActivity } from "@/components/organisms/RecentActivity"
import { useDashboardData } from "@/hooks/useDashboardData"
import { useAuth } from "@/hooks/useAuth"

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: <HomeIcon /> },
  { label: "Projects", href: "/projects", icon: <FolderIcon /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> }
]

const DashboardPage = () => {
  const { user } = useAuth()
  const { stats, recentActivity, isLoading } = useDashboardData()

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <DashboardLayout user={user} navigation={navigation}>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </div>

      <RecentActivity items={recentActivity} />
    </DashboardLayout>
  )
}

export { DashboardPage }
```

## Barrel Exports

Each level has an index.ts for clean imports:

```typescript
// components/atoms/index.ts
export * from "./Button"
export * from "./Input"
export * from "./Label"
export * from "./Icon"
export * from "./Badge"
export * from "./Avatar"
export * from "./Spinner"

// components/molecules/index.ts
export * from "./FormField"
export * from "./SearchInput"
export * from "./UserAvatar"
export * from "./NavLink"
export * from "./CardHeader"

// components/organisms/index.ts
export * from "./Header"
export * from "./Navigation"
export * from "./Sidebar"
export * from "./Footer"
export * from "./LoginForm"
export * from "./DataTable"

// components/index.ts
export * from "./atoms"
export * from "./molecules"
export * from "./organisms"
export * from "./templates"
```

## Component Classification Guide

| Level | Criteria | Examples |
|-------|----------|----------|
| **Atom** | Single HTML element or primitive | Button, Input, Label, Icon, Badge |
| **Molecule** | 2-3 atoms combined | FormField, SearchInput, UserAvatar |
| **Organism** | Multiple molecules, self-contained | Header, Footer, LoginForm, DataTable |
| **Template** | Page structure, no data | PageLayout, DashboardLayout |
| **Page** | Template + real data | HomePage, SettingsPage |

## Best Practices

| Do | Don't |
|----|-------|
| Keep atoms context-agnostic | Add business logic to atoms |
| Compose molecules from atoms | Skip levels (atom → organism) |
| Let organisms manage their state | Pass too many props through levels |
| Keep templates data-free | Fetch data in templates |
| Co-locate tests with components | Mix component levels in folders |

## Export

```typescript
export {
  // Atoms
  Button,
  Input,
  Label,
  // Molecules
  FormField,
  SearchInput,
  // Organisms
  Header,
  LoginForm,
  // Templates
  PageLayout,
  DashboardLayout
}
```
