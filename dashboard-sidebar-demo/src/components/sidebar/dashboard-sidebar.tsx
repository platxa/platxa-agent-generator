import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home,
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  FileText,
  Mail,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NavItem } from "./nav-item"
import { NavSection } from "./nav-section"
import { UserProfileDropdown } from "@/components/ui/user-profile-dropdown"

const mainNavItems = [
  { icon: Home, label: "Home", href: "#home" },
  { icon: LayoutDashboard, label: "Dashboard", href: "#dashboard", isActive: true },
  { icon: BarChart3, label: "Analytics", href: "#analytics", badge: 3 },
  { icon: Users, label: "Team", href: "#team" },
  { icon: FileText, label: "Documents", href: "#documents", badge: 12 },
]

const communicationItems = [
  { icon: Mail, label: "Messages", href: "#messages", badge: 5 },
  { icon: Bell, label: "Notifications", href: "#notifications", badge: 24 },
]

const supportItems = [
  { icon: HelpCircle, label: "Help & Support", href: "#help" },
  { icon: Settings, label: "Settings", href: "#settings" },
]

const sidebarVariants = {
  expanded: {
    width: "var(--sidebar-width)",
    transition: { duration: 0.3, ease: "easeOut" },
  },
  collapsed: {
    width: "var(--sidebar-collapsed-width)",
    transition: { duration: 0.3, ease: "easeOut" },
  },
}

export interface DashboardSidebarProps {
  defaultCollapsed?: boolean
  className?: string
}

// Demo user data
const demoUser = {
  name: "Jane Doe",
  email: "jane@platxa.com",
  role: "Admin",
}

export function DashboardSidebar({ defaultCollapsed = false, className }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light")

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  return (
    <motion.aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
      initial={isCollapsed ? "collapsed" : "expanded"}
      animate={isCollapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      role="complementary"
      aria-label="Main navigation sidebar"
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-9">
                <span className="text-sm font-bold text-white">P</span>
              </div>
              <span className="text-lg font-semibold">Platxa</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-purple-9">
            <span className="text-sm font-bold text-white">P</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          <NavSection title="Main" isCollapsed={isCollapsed}>
            {mainNavItems.map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={item.isActive}
                isCollapsed={isCollapsed}
                badge={item.badge}
              />
            ))}
          </NavSection>

          <NavSection title="Communication" isCollapsed={isCollapsed}>
            {communicationItems.map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isCollapsed={isCollapsed}
                badge={item.badge}
              />
            ))}
          </NavSection>

          <NavSection title="Support" isCollapsed={isCollapsed}>
            {supportItems.map((item) => (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isCollapsed={isCollapsed}
              />
            ))}
          </NavSection>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        {/* User Profile Dropdown */}
        <UserProfileDropdown
          user={demoUser}
          size={isCollapsed ? "sm" : "md"}
          theme={theme}
          onProfileClick={() => console.log("Profile clicked")}
          onSettingsClick={() => console.log("Settings clicked")}
          onThemeChange={setTheme}
          onKeyboardShortcutsClick={() => console.log("Shortcuts clicked")}
          onSignOut={() => console.log("Sign out clicked")}
          side="top"
          align="start"
        />

        {/* Collapse Toggle */}
        <motion.button
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-2 rounded-md p-2",
            "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "transition-colors"
          )}
          onClick={toggleCollapse}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.aside>
  )
}
