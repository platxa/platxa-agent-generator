/**
 * Preview module exports
 *
 * Provides streaming preview functionality for real-time
 * code generation preview in Platxa Website Studio.
 */

// Streaming preview context and hooks
export {
  StreamingPreviewProvider,
  useStreamingPreview,
  useStreamingPreviewSafe,
  useIsStreaming,
  useStreamingProgress,
  type StreamingPreviewState,
  type StreamingPreviewContextValue,
} from "./streaming-preview-context";

// Incremental QWeb parser
export {
  IncrementalQWebParser,
  isQWebContent,
  extractCssFromScss,
  type ParseResult,
} from "./incremental-qweb-parser";

// QWeb Runtime simulator
export {
  QWebRuntime,
  createQWebRuntime,
  renderQWeb,
  type QWebContext,
  type TemplateRegistry,
} from "./qweb-runtime";

// Snippet registry
export {
  SNIPPET_TEMPLATES,
  getSnippet,
  getSnippetsByCategory,
  getAllSnippets,
  detectSnippets,
  expandSnippets,
  type SnippetDefinition,
} from "./snippet-registry";

// Snippet options (Odoo website builder styling)
export {
  COLOR_COMBINATIONS,
  PADDING_PRESETS,
  WIDTH_OPTIONS,
  ALIGNMENT_OPTIONS,
  SHAPE_DIVIDERS,
  BACKGROUND_PRESETS,
  ANIMATION_OPTIONS,
  DEFAULT_SNIPPET_OPTIONS,
  generateSnippetCSS,
  generateSnippetClasses,
  applySnippetOptions,
  parseSnippetOptions,
  getColorCombination,
  getPaddingOption,
  getWidthOption,
  getAlignmentOption,
  getBackgroundOption,
  getAnimationOption,
  type ColorCombination,
  type PaddingOption,
  type WidthOption,
  type AlignmentOption,
  type ShapeDivider,
  type BackgroundOption,
  type AnimationOption,
  type SnippetOptions,
} from "./snippet-options";

// Placeholder image generation
export {
  generatePlaceholderSVG,
  generatePlaceholderDataURL,
  generateGradientPlaceholder,
  generateGradientPlaceholderDataURL,
  replaceImagesWithPlaceholders,
  getPlaceholder,
  PLACEHOLDER_SIZES,
  PLACEHOLDER_URLS,
  type PlaceholderConfig,
  type PlaceholderType,
} from "./placeholder-images";

// QWeb source map for DOM ↔ source bidirectional mapping
export {
  annotateTemplateSource,
  buildSourceMap,
  SOURCE_MAP_CLICK_SCRIPT,
  type SourceMapEntry,
  type QWebSourceMap,
} from "./qweb-source-map";

// SCSS color variable updater for live palette editing
export {
  extractColorPalette,
  updateColorVariable,
  resolveColorToPalette,
  applyColorChange,
  ODOO_COLOR_VAR_PREFIX,
  ODOO_PALETTE_SIZE,
  CSS_VAR_TO_PALETTE,
  type OdooColorPalette,
  type ScssColorUpdateResult,
} from "./scss-color-updater";
