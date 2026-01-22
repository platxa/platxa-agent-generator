/**
 * Storybook Story Generator Module
 *
 * Automatically generates Storybook stories from React components.
 *
 * @module react-agent/storybook
 *
 * @example
 * ```typescript
 * import { analyzeComponent, generateStoryFile } from "@platxa/frontend-agent/storybook"
 *
 * const analysis = analyzeComponent(componentCode, "src/components/Button.tsx")
 * const story = generateStoryFile(analysis, { format: "csf3" })
 *
 * console.log(story.content)
 * ```
 */

export {
  analyzeComponent,
  generateStoryFile,
  generateStoriesForComponents,
  default,
  // Types
  type ComponentAnalysis,
  type PropDefinition,
  type VariantDefinition,
  type GeneratedStory,
  type StoryFile,
  type StoryGeneratorOptions,
} from "./story-generator"
