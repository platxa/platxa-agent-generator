/**
 * Developer Experience (DX) Module
 *
 * Storybook generation, visual regression testing,
 * responsive preview, and live preview systems.
 */

// Types
export type {
  StoryVariant,
  StoryConfig,
  GeneratedStory,
  StoryGeneratorOptions,
  SnapshotConfig,
  SnapshotScenario,
  ViewportConfig,
  VisualTestResult,
  GeneratedVisualTest,
  Breakpoint,
  ResponsivePreviewConfig,
  ResponsivePreviewState,
  GeneratedResponsivePreview,
  LivePreviewConfig,
  LivePreviewState,
  PreviewUpdateEvent,
  GeneratedLivePreview,
  DxSystemConfig,
} from "./types"

// Storybook Generator (#82)
export {
  DEFAULT_STORY_VARIANTS,
  generateStory,
  generateStoriesFromCode,
} from "./dx"

// Visual Regression Testing (#83)
export {
  DEFAULT_VIEWPORTS,
  generateVisualTest,
  generateVisualTestsFromCode,
} from "./dx"

// Responsive Preview (#84)
export {
  DEFAULT_BREAKPOINTS,
  generateResponsivePreview,
} from "./dx"

// Live Preview (#85)
export {
  DEFAULT_LIVE_PREVIEW_CONFIG,
  generateLivePreview,
} from "./dx"

// Factory
export { createDxSystem } from "./dx"
