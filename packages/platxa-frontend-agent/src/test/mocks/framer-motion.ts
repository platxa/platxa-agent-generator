/**
 * Framer Motion Mock for Testing
 *
 * This mock replaces Framer Motion components with regular DOM elements
 * to speed up tests and avoid animation-related flakiness.
 *
 * Usage in tests:
 * vi.mock('framer-motion', () => import('./test/mocks/framer-motion'))
 */

import * as React from "react"
import type { JSX, ComponentPropsWithRef } from "react"

// Supported HTML element types for motion components
type MotionElement = keyof JSX.IntrinsicElements

// Filter out framer-motion specific props
const filterMotionProps = (props: Record<string, unknown>) => {
  const motionProps = [
    "initial",
    "animate",
    "exit",
    "variants",
    "transition",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "drag",
    "dragConstraints",
    "dragElastic",
    "dragMomentum",
    "dragTransition",
    "dragPropagation",
    "dragControls",
    "dragListener",
    "dragSnapToOrigin",
    "onDrag",
    "onDragStart",
    "onDragEnd",
    "onDirectionLock",
    "onDragTransitionEnd",
    "layout",
    "layoutId",
    "layoutDependency",
    "layoutScroll",
    "onLayoutAnimationStart",
    "onLayoutAnimationComplete",
    "onViewportEnter",
    "onViewportLeave",
    "viewport",
    "custom",
  ]

  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!motionProps.includes(key)) {
      filtered[key] = value
    }
  }
  return filtered
}

// Create mock motion component factory
const createMotionComponent = <T extends MotionElement>(element: T) => {
  const Component = React.forwardRef<
    Element,
    ComponentPropsWithRef<T> & Record<string, unknown>
  >((props, ref) => {
    const filteredProps = filterMotionProps(props as Record<string, unknown>)
    return React.createElement(element as string, { ...filteredProps, ref })
  })
  Component.displayName = `motion.${String(element)}`
  return Component
}

// Mock motion object with all HTML elements
export const motion = {
  div: createMotionComponent("div"),
  span: createMotionComponent("span"),
  p: createMotionComponent("p"),
  a: createMotionComponent("a"),
  button: createMotionComponent("button"),
  ul: createMotionComponent("ul"),
  ol: createMotionComponent("ol"),
  li: createMotionComponent("li"),
  img: createMotionComponent("img"),
  svg: createMotionComponent("svg"),
  path: createMotionComponent("path"),
  section: createMotionComponent("section"),
  article: createMotionComponent("article"),
  header: createMotionComponent("header"),
  footer: createMotionComponent("footer"),
  nav: createMotionComponent("nav"),
  main: createMotionComponent("main"),
  aside: createMotionComponent("aside"),
  form: createMotionComponent("form"),
  input: createMotionComponent("input"),
  textarea: createMotionComponent("textarea"),
  select: createMotionComponent("select"),
  label: createMotionComponent("label"),
  h1: createMotionComponent("h1"),
  h2: createMotionComponent("h2"),
  h3: createMotionComponent("h3"),
  h4: createMotionComponent("h4"),
  h5: createMotionComponent("h5"),
  h6: createMotionComponent("h6"),
  table: createMotionComponent("table"),
  thead: createMotionComponent("thead"),
  tbody: createMotionComponent("tbody"),
  tr: createMotionComponent("tr"),
  td: createMotionComponent("td"),
  th: createMotionComponent("th"),
}

// Mock AnimatePresence - just renders children
export const AnimatePresence = ({
  children,
}: {
  children: React.ReactNode
  mode?: "sync" | "wait" | "popLayout"
  initial?: boolean
  onExitComplete?: () => void
}) => React.createElement(React.Fragment, null, children)

// Mock MotionConfig - just renders children
export const MotionConfig = ({
  children,
}: {
  children: React.ReactNode
  transition?: unknown
  reducedMotion?: "user" | "always" | "never"
}) => React.createElement(React.Fragment, null, children)

// Mock LazyMotion - just renders children
export const LazyMotion = ({
  children,
}: {
  children: React.ReactNode
  features: unknown
  strict?: boolean
}) => React.createElement(React.Fragment, null, children)

// Mock domAnimation features
export const domAnimation = {}
export const domMax = {}

// Mock useAnimation hook
export const useAnimation = () => ({
  start: () => Promise.resolve(),
  stop: () => {},
  set: () => {},
})

// Mock useMotionValue hook
export const useMotionValue = (initial: number) => ({
  get: () => initial,
  set: () => {},
  onChange: () => () => {},
})

// Mock useTransform hook
export const useTransform = (
  _value: unknown,
  _inputRange: number[],
  outputRange: number[]
) => ({
  get: () => outputRange[0],
  set: () => {},
  onChange: () => () => {},
})

// Mock useSpring hook
export const useSpring = (initial: number) => ({
  get: () => initial,
  set: () => {},
  onChange: () => () => {},
})

// Mock useInView hook
export const useInView = () => true

// Mock useScroll hook
export const useScroll = () => ({
  scrollX: { get: () => 0 },
  scrollY: { get: () => 0 },
  scrollXProgress: { get: () => 0 },
  scrollYProgress: { get: () => 0 },
})

// Mock useReducedMotion hook
export const useReducedMotion = () => false

// Mock useDragControls hook
export const useDragControls = () => ({
  start: () => {},
})

// Mock Reorder components
export const Reorder = {
  Group: createMotionComponent("ul"),
  Item: createMotionComponent("li"),
}
