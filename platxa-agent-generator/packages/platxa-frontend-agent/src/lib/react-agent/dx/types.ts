/**
 * Developer Experience (DX) Module Types
 *
 * Types for Storybook generation, visual regression testing,
 * responsive preview, and live preview systems.
 */

// =============================================================================
// Storybook Story Generator (#82)
// =============================================================================

/**
 * Story variant for component state
 */
export interface StoryVariant {
  /** Story name */
  name: string
  /** Story description */
  description?: string
  /** Props to apply */
  props: Record<string, unknown>
  /** Decorator wrappers */
  decorators?: string[]
}

/**
 * Storybook story configuration
 */
export interface StoryConfig {
  /** Component name */
  componentName: string
  /** Component import path */
  importPath: string
  /** Story title (e.g., "Components/Button") */
  title: string
  /** Component description */
  description?: string
  /** Variants to generate */
  variants: StoryVariant[]
  /** Args table configuration */
  argTypes?: Record<string, {
    control: string | { type: string; options?: string[] }
    description?: string
    defaultValue?: unknown
  }>
  /** Story decorators */
  decorators?: string[]
  /** Story parameters */
  parameters?: {
    layout?: "centered" | "fullscreen" | "padded"
    backgrounds?: { default: string }
    docs?: { description?: { component?: string } }
  }
}

/**
 * Generated Storybook story
 */
export interface GeneratedStory {
  /** Story file content */
  content: string
  /** File name */
  fileName: string
  /** Storybook CSF version */
  csfVersion: 3
}

/**
 * Storybook generator options
 */
export interface StoryGeneratorOptions {
  /** Include docs addon */
  includeDocs?: boolean
  /** Include actions addon */
  includeActions?: boolean
  /** Include controls addon */
  includeControls?: boolean
  /** Use TypeScript */
  typescript?: boolean
  /** Story file suffix */
  suffix?: ".stories.tsx" | ".stories.ts" | ".stories.jsx" | ".stories.js"
}

// =============================================================================
// Visual Regression Testing (#83)
// =============================================================================

/**
 * Snapshot test configuration
 */
export interface SnapshotConfig {
  /** Component name */
  componentName: string
  /** Test scenarios */
  scenarios: SnapshotScenario[]
  /** Viewport sizes to test */
  viewports?: ViewportConfig[]
  /** Theme variants */
  themes?: ("light" | "dark")[]
  /** Threshold for visual diff */
  threshold?: number
}

/**
 * Single snapshot scenario
 */
export interface SnapshotScenario {
  /** Scenario name */
  name: string
  /** Props for this scenario */
  props: Record<string, unknown>
  /** Wait for selector before snapshot */
  waitForSelector?: string
  /** Delay before snapshot (ms) */
  delay?: number
  /** Specific viewport for this scenario */
  viewport?: ViewportConfig
}

/**
 * Viewport configuration
 */
export interface ViewportConfig {
  /** Viewport name */
  name: string
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Device pixel ratio */
  deviceScaleFactor?: number
  /** Is mobile device */
  isMobile?: boolean
}

/**
 * Visual regression test result
 */
export interface VisualTestResult {
  /** Test passed */
  passed: boolean
  /** Scenario name */
  scenario: string
  /** Baseline image path */
  baseline?: string
  /** Current image path */
  current?: string
  /** Diff image path */
  diff?: string
  /** Percentage difference */
  diffPercentage: number
  /** Threshold used */
  threshold: number
}

/**
 * Generated visual test
 */
export interface GeneratedVisualTest {
  /** Test file content */
  content: string
  /** File name */
  fileName: string
  /** Test framework */
  framework: "playwright" | "cypress" | "puppeteer"
}

// =============================================================================
// Responsive Preview System (#84)
// =============================================================================

/**
 * Standard breakpoint
 */
export interface Breakpoint {
  /** Breakpoint name */
  name: string
  /** Minimum width */
  minWidth: number
  /** Maximum width */
  maxWidth?: number
  /** Common device at this breakpoint */
  device?: string
  /** Tailwind class prefix */
  prefix?: string
}

/**
 * Responsive preview configuration
 */
export interface ResponsivePreviewConfig {
  /** Breakpoints to show */
  breakpoints: Breakpoint[]
  /** Show device frames */
  showDeviceFrames?: boolean
  /** Sync scroll between viewports */
  syncScroll?: boolean
  /** Show breakpoint labels */
  showLabels?: boolean
  /** Custom container styles */
  containerStyles?: Record<string, string>
}

/**
 * Responsive preview state
 */
export interface ResponsivePreviewState {
  /** Currently selected breakpoint */
  activeBreakpoint: string
  /** All breakpoints visible (grid mode) */
  showAll: boolean
  /** Current zoom level */
  zoom: number
  /** Rotation (portrait/landscape) */
  orientation: "portrait" | "landscape"
}

/**
 * Generated responsive preview
 */
export interface GeneratedResponsivePreview {
  /** Preview component code */
  component: string
  /** Preview styles */
  styles: string
  /** Preview script (controls) */
  script: string
}

// =============================================================================
// Live Preview System (#85)
// =============================================================================

/**
 * Live preview configuration
 */
export interface LivePreviewConfig {
  /** Watch file patterns */
  watchPatterns: string[]
  /** Debounce delay (ms) */
  debounceDelay?: number
  /** Hot reload enabled */
  hotReload?: boolean
  /** Show error overlay */
  errorOverlay?: boolean
  /** Port for preview server */
  port?: number
}

/**
 * Live preview state
 */
export interface LivePreviewState {
  /** Preview is running */
  isRunning: boolean
  /** Current component being previewed */
  component?: string
  /** Last update timestamp */
  lastUpdate?: number
  /** Current error */
  error?: string
  /** Connected clients */
  clients: number
}

/**
 * Preview update event
 */
export interface PreviewUpdateEvent {
  /** Event type */
  type: "update" | "error" | "reload"
  /** Updated file path */
  filePath?: string
  /** New component code */
  code?: string
  /** Error message */
  error?: string
  /** Timestamp */
  timestamp: number
}

/**
 * Generated live preview setup
 */
export interface GeneratedLivePreview {
  /** Server code */
  server: string
  /** Client code */
  client: string
  /** WebSocket handler */
  websocket: string
  /** Configuration file */
  config: string
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * DX system configuration
 */
export interface DxSystemConfig {
  /** Project root */
  projectRoot?: string
  /** Output directory */
  outputDir?: string
  /** Storybook options */
  storybook?: StoryGeneratorOptions
  /** Visual test options */
  visualTests?: {
    framework?: "playwright" | "cypress" | "puppeteer"
    threshold?: number
  }
  /** Preview options */
  preview?: {
    port?: number
    hotReload?: boolean
  }
}
