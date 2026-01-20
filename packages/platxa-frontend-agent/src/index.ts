// =============================================================================
// PLATXA FRONTEND AGENT - Main Entry Point
// =============================================================================

// Utilities
export {
  cn,
  formatCompact,
  generateId,
  isBrowser,
  prefersReducedMotion,
  delay,
} from "./lib/utils"

// Components
export { Button, AnimatedButton, buttonVariants } from "./components/ui/button"
export type { ButtonProps, AnimatedButtonProps } from "./components/ui/button"

// Re-export from barrel
export * from "./components/ui"
