import { forwardRef } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface NavItemProps {
  icon: LucideIcon
  label: string
  href?: string
  isActive?: boolean
  isCollapsed?: boolean
  badge?: number
  onClick?: () => void
}

export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(
  ({ icon: Icon, label, href = "#", isActive, isCollapsed, badge, onClick }, ref) => {
    return (
      <motion.a
        ref={ref}
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          isCollapsed && "justify-center px-2"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />

        {!isCollapsed && (
          <motion.span
            className="flex-1 truncate text-sm"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        )}

        {!isCollapsed && badge !== undefined && badge > 0 && (
          <motion.span
            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-9 px-1.5 text-xs font-medium text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}

        {isCollapsed && (
          <span className="sr-only">{label}</span>
        )}
      </motion.a>
    )
  }
)

NavItem.displayName = "NavItem"
