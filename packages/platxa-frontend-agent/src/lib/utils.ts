import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and tailwind-merge.
 * This utility enables conditional class application and proper
 * Tailwind CSS class merging to avoid conflicts.
 *
 * @example
 * cn("px-2 py-1", "px-4") // returns "py-1 px-4"
 * cn("text-red-500", isActive && "text-blue-500")
 * cn(buttonVariants({ variant, size }), className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as a compact string (e.g., 1.2K, 3.4M)
 */
export function formatCompact(num: number): string {
  const formatter = Intl.NumberFormat("en", { notation: "compact" })
  return formatter.format(num)
}

/**
 * Generates a unique ID for component instances
 */
export function generateId(prefix = "platxa"): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Checks if code is running in a browser environment
 */
export const isBrowser = typeof window !== "undefined"

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (!isBrowser) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Delays execution for a given number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
