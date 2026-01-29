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

// Live SCSS compilation and CSS injection
export {
  compileScssToCSS,
  compileAllScss,
  injectCSSToIframe,
  createLiveCompiler,
  CSS_INJECT_SCRIPT,
  type LiveCompileResult,
  type LiveCompilerOptions,
} from "./live-scss-compiler";

// HMR Preview manager for iframe communication and hot updates
export {
  OdooHMRPreview,
  createHMRPreview,
  createDebugHMRPreview,
  type HMRUpdate,
  type HMRUpdateType,
  type UpdateQueueState,
  type MessageType,
  type BridgeMessage,
  type MessageHandler,
  type OdooHMRPreviewConfig,
} from "./odoo-hmr-preview";

// QWeb hot-swap with morphdom for DOM diffing
export {
  hotSwapHTML,
  hotSwapIframeHTML,
  createHotSwapper,
  createIframeHotSwapper,
  HTML_INJECT_SCRIPT,
  type MorphdomOptions,
  type HotSwapResult,
} from "./qweb-hot-swap";

// SourceMapper for bidirectional DOM element ↔ template line mapping
export {
  SourceMapper,
  createSourceMap,
  createMultiFileSourceMap,
  type SourceLocation,
  type ElementMapping,
  type SourceMapperOptions,
  type ReverseLookupOptions,
} from "./source-mapper";

// Snippet attribution for unique instance IDs during QWeb generation
export {
  SnippetAttributor,
  attributeSnippetIds,
  detectSnippets as detectSnippetInstances,
  ensureSnippetIds,
  createTypedIdGenerator,
  createUuidIdGenerator,
  validateSnippetIds,
  extractSnippetId,
  extractSnippetType,
  type SnippetIdGenerator,
  type SnippetAttributionOptions,
  type AttributionResult,
  type DetectedSnippet,
} from "./snippet-attribution";

// SelectMode for visual element selection in preview
export {
  SelectModeController,
  createSelectMode,
  extractElementInfo,
  generateSelector,
  findSelectableAncestor,
  createSelectModeBridge,
  SELECT_MODE_SCRIPT,
  type SelectModeState,
  type SelectedElement,
  type SelectionEvent,
  type SelectModeOptions,
  type SelectionCallback,
} from "./select-mode";

// ClickToSource for mapping iframe clicks to source locations
export {
  ClickToSourceController,
  createClickToSource,
  findSourceElement,
  extractClickEvent,
  checkModifierKey,
  createClickToSourceBridge,
  CLICK_TO_SOURCE_SCRIPT,
  type ClickToSourceEvent,
  type ClickToSourceOptions,
  type ClickToSourceCallback,
} from "./click-to-source";

// RegenerateSection for triggering agent regeneration of selected snippets
export {
  RegenerateSectionController,
  createRegenerateSection,
  extractSectionHtml,
  extractRegenerateContext,
  createRegenerateBridge,
  REGENERATE_SECTION_SCRIPT,
  type RegenerateSectionContext,
  type RegenerateRequest,
  type RegenerateResult,
  type RegenerateSectionOptions,
  type RegenerateCallback,
  type RegenerateResultCallback,
} from "./regenerate-section";
