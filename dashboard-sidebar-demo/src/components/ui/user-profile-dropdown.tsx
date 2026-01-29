"use client"

import { forwardRef, useCallback, useId, useMemo, useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  User,
  Settings,
  Sun,
  Moon,
  Keyboard,
  LogOut,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* -----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

export interface UserData {
  /** User's display name */
  name: string
  /** User's email address */
  email: string
  /** Optional avatar URL */
  avatarUrl?: string
  /** User's role or status */
  role?: string
}

export interface UserProfileDropdownProps
  extends VariantProps<typeof avatarVariants> {
  /** User data to display */
  user: UserData
  /** Current theme mode */
  theme?: "light" | "dark" | "system"
  /** Callback when profile is clicked */
  onProfileClick?: () => void
  /** Callback when settings is clicked */
  onSettingsClick?: () => void
  /** Callback when theme changes */
  onThemeChange?: (theme: "light" | "dark" | "system") => void
  /** Callback when keyboard shortcuts is clicked */
  onKeyboardShortcutsClick?: () => void
  /** Callback when sign out is clicked */
  onSignOut?: () => void
  /** Additional class name for the trigger */
  className?: string
  /** Control dropdown open state externally */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Alignment of the dropdown */
  align?: "start" | "center" | "end"
  /** Side of the dropdown */
  side?: "top" | "right" | "bottom" | "left"
  /** Side offset in pixels */
  sideOffset?: number
}

/* -----------------------------------------------------------------------------
 * Variants (CVA)
 * -------------------------------------------------------------------------- */

const avatarVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    "bg-purple-9 text-white font-medium select-none",
    "ring-offset-background transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "hover:ring-2 hover:ring-purple-9/50",
  ],
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

const menuItemVariants = cva(
  [
    "relative flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5",
    "text-sm text-foreground outline-none transition-colors",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground",
    "focus:bg-sidebar-accent focus:text-sidebar-accent-foreground",
  ],
  {
    variants: {
      variant: {
        default: "",
        danger: [
          "text-red-600 dark:text-red-400",
          "data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700",
          "dark:data-[highlighted]:bg-red-950/50 dark:data-[highlighted]:text-red-400",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/* -----------------------------------------------------------------------------
 * Animation Variants
 * -------------------------------------------------------------------------- */

const dropdownAnimationVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -8,
  },
}

const reducedMotionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const itemAnimationVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: index * 0.03,
      duration: 0.15,
    },
  }),
}

const reducedMotionItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/* -----------------------------------------------------------------------------
 * Helper Components
 * -------------------------------------------------------------------------- */

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  user: UserData
  className?: string
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ user, size, className, ...props }, ref) => {
    const [imageError, setImageError] = useState(false)

    const initials = useMemo(() => {
      const names = user.name.trim().split(/\s+/)
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return names[0]?.slice(0, 2).toUpperCase() || "?"
    }, [user.name])

    const showImage = user.avatarUrl && !imageError

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {showImage ? (
          <img
            src={user.avatarUrl}
            alt={`${user.name}'s avatar`}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </span>
    )
  }
)
Avatar.displayName = "Avatar"

/* -----------------------------------------------------------------------------
 * Menu Item Component
 * -------------------------------------------------------------------------- */

interface MenuItemProps {
  icon: React.ElementType
  label: string
  shortcut?: string
  variant?: "default" | "danger"
  onClick?: () => void
  index: number
  prefersReducedMotion: boolean | null
}

const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  ({ icon: Icon, label, shortcut, variant = "default", onClick, index, prefersReducedMotion }, ref) => {
    const variants = prefersReducedMotion ? reducedMotionItemVariants : itemAnimationVariants

    return (
      <DropdownMenu.Item asChild>
        <motion.div
          ref={ref}
          className={cn(menuItemVariants({ variant }))}
          onClick={onClick}
          custom={index}
          variants={variants}
          initial="hidden"
          animate="visible"
          role="menuitem"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {shortcut && (
            <kbd className="ml-auto hidden text-xs text-muted-foreground md:inline-flex">
              {shortcut}
            </kbd>
          )}
        </motion.div>
      </DropdownMenu.Item>
    )
  }
)
MenuItem.displayName = "MenuItem"

/* -----------------------------------------------------------------------------
 * Theme Submenu Component
 * -------------------------------------------------------------------------- */

interface ThemeSubmenuProps {
  currentTheme: "light" | "dark" | "system"
  onThemeChange: (theme: "light" | "dark" | "system") => void
  index: number
  prefersReducedMotion: boolean | null
}

const ThemeSubmenu = ({
  currentTheme,
  onThemeChange,
  index,
  prefersReducedMotion,
}: ThemeSubmenuProps) => {
  const variants = prefersReducedMotion ? reducedMotionItemVariants : itemAnimationVariants
  const themeSubmenuId = useId()

  const themeOptions: Array<{ value: "light" | "dark" | "system"; label: string; icon: React.ElementType }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ]

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger asChild>
        <motion.div
          className={cn(
            menuItemVariants({ variant: "default" }),
            "data-[state=open]:bg-sidebar-accent"
          )}
          custom={index}
          variants={variants}
          initial="hidden"
          animate="visible"
          role="menuitem"
          aria-haspopup="menu"
        >
          {currentTheme === "dark" ? (
            <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1">Theme</span>
          <span className="ml-auto text-xs text-muted-foreground capitalize">
            {currentTheme}
          </span>
        </motion.div>
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className={cn(
            "z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-card p-1.5",
            "shadow-lg shadow-black/5 dark:shadow-black/20",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          sideOffset={8}
          alignOffset={-4}
          aria-labelledby={themeSubmenuId}
          role="menu"
        >
          <span id={themeSubmenuId} className="sr-only">
            Theme options
          </span>
          {themeOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className={cn(
                menuItemVariants({ variant: "default" }),
                "justify-between"
              )}
              onClick={() => onThemeChange(option.value)}
              role="menuitemradio"
              aria-checked={currentTheme === option.value}
            >
              <div className="flex items-center gap-3">
                <option.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{option.label}</span>
              </div>
              {currentTheme === option.value && (
                <Check className="h-4 w-4 text-purple-9" aria-hidden="true" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )
}

/* -----------------------------------------------------------------------------
 * Main Component
 * -------------------------------------------------------------------------- */

export const UserProfileDropdown = forwardRef<
  HTMLButtonElement,
  UserProfileDropdownProps
>(
  (
    {
      user,
      size = "md",
      theme = "light",
      onProfileClick,
      onSettingsClick,
      onThemeChange,
      onKeyboardShortcutsClick,
      onSignOut,
      className,
      open,
      onOpenChange,
      align = "end",
      side = "bottom",
      sideOffset = 8,
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const prefersReducedMotion = useReducedMotion()
    const triggerId = useId()
    const menuId = useId()

    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (!isControlled) {
          setInternalOpen(newOpen)
        }
        onOpenChange?.(newOpen)
      },
      [isControlled, onOpenChange]
    )

    const handleThemeChange = useCallback(
      (newTheme: "light" | "dark" | "system") => {
        onThemeChange?.(newTheme)
      },
      [onThemeChange]
    )

    const animationVariants = prefersReducedMotion
      ? reducedMotionVariants
      : dropdownAnimationVariants

    const transitionConfig = prefersReducedMotion
      ? { duration: 0.01 }
      : { type: "spring", stiffness: 400, damping: 25 }

    return (
      <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenu.Trigger asChild>
          <motion.button
            ref={ref}
            id={triggerId}
            className={cn(
              "group flex items-center gap-3 rounded-lg p-2",
              "hover:bg-sidebar-accent transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              className
            )}
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            aria-controls={isOpen ? menuId : undefined}
            aria-label={`User menu for ${user.name}`}
          >
            <Avatar user={user} size={size} />
            <div className="hidden flex-1 text-left md:block">
              <p className="text-sm font-medium leading-tight truncate max-w-[140px]">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                {user.email}
              </p>
            </div>
          </motion.button>
        </DropdownMenu.Trigger>

        <AnimatePresence>
          {isOpen && (
            <DropdownMenu.Portal forceMount>
              <DropdownMenu.Content
                asChild
                align={align}
                side={side}
                sideOffset={sideOffset}
                onCloseAutoFocus={(event) => {
                  // Ensure focus returns to trigger
                  event.preventDefault()
                  document.getElementById(triggerId)?.focus()
                }}
              >
                <motion.div
                  id={menuId}
                  className={cn(
                    "z-50 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card",
                    "shadow-xl shadow-black/10 dark:shadow-black/30",
                    "origin-top-right"
                  )}
                  variants={animationVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={transitionConfig}
                  role="menu"
                  aria-labelledby={triggerId}
                >
                  {/* User Info Header */}
                  <div
                    className="border-b border-border px-3 py-3"
                    role="presentation"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {user.role && (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-teal-9/10 px-2 py-0.5 text-xs font-medium text-teal-9">
                        {user.role}
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="p-1.5" role="group">
                    <MenuItem
                      icon={User}
                      label="Profile"
                      shortcut="P"
                      onClick={onProfileClick}
                      index={0}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                    <MenuItem
                      icon={Settings}
                      label="Settings"
                      shortcut="S"
                      onClick={onSettingsClick}
                      index={1}
                      prefersReducedMotion={prefersReducedMotion}
                    />

                    <ThemeSubmenu
                      currentTheme={theme}
                      onThemeChange={handleThemeChange}
                      index={2}
                      prefersReducedMotion={prefersReducedMotion}
                    />

                    <MenuItem
                      icon={Keyboard}
                      label="Keyboard shortcuts"
                      shortcut="?"
                      onClick={onKeyboardShortcutsClick}
                      index={3}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  </div>

                  {/* Divider */}
                  <DropdownMenu.Separator
                    className="mx-1.5 h-px bg-border"
                    role="separator"
                  />

                  {/* Sign Out */}
                  <div className="p-1.5" role="group">
                    <MenuItem
                      icon={LogOut}
                      label="Sign out"
                      variant="danger"
                      shortcut="Q"
                      onClick={onSignOut}
                      index={4}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  </div>
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          )}
        </AnimatePresence>
      </DropdownMenu.Root>
    )
  }
)

UserProfileDropdown.displayName = "UserProfileDropdown"

/* -----------------------------------------------------------------------------
 * Exports
 * -------------------------------------------------------------------------- */

export { avatarVariants, menuItemVariants }
export type { AvatarProps, MenuItemProps }
