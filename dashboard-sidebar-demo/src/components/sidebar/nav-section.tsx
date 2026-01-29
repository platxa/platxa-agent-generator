import { forwardRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface NavSectionProps {
  title?: string
  isCollapsed?: boolean
  children: React.ReactNode
  className?: string
}

export const NavSection = forwardRef<HTMLDivElement, NavSectionProps>(
  ({ title, isCollapsed, children, className }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1", className)}>
        <AnimatePresence mode="wait">
          {title && !isCollapsed && (
            <motion.h3
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {title}
            </motion.h3>
          )}
        </AnimatePresence>

        <nav className="space-y-0.5" role="navigation" aria-label={title}>
          {children}
        </nav>
      </div>
    )
  }
)

NavSection.displayName = "NavSection"
