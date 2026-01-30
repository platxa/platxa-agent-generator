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
  getSourceLocation,
  SOURCE_MAP_CLICK_SCRIPT,
  type SourceMapEntry,
  type QWebSourceMap,
  type SourceLocation as QWebSourceLocation,
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
  parseSassException,
  formatScssError,
  CSS_INJECT_SCRIPT,
  type LiveCompileResult,
  type LiveCompilerOptions,
  type ScssCompileError,
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

// HMR Runtime for iframe communication with __PLATXA_HMR__ global
export {
  generateHMRRuntimeScript,
  HMR_RUNTIME_SCRIPT,
  HMRRuntimeController,
  createHMRRuntime,
  createHMRRuntimeScript,
  type PlatxaHMRRuntime,
  type HMRRuntimeConfig,
  type HMRMessageType,
  type HMRMessage,
} from "./hmr-runtime";

// Message Bridge for robust postMessage communication
export {
  ParentBridge,
  IframeBridge,
  createParentBridge,
  createIframeBridge,
  generateIframeBridgeScript,
  IFRAME_BRIDGE_SCRIPT,
  type BridgeMessage as GenericBridgeMessage,
  type BridgeCommand,
  type BridgeEvent,
  type BridgeResponse,
  type MessageHandler as GenericMessageHandler,
  type ErrorHandler as BridgeErrorHandler,
  type MessageBridgeConfig,
} from "./message-bridge";

// Morphdom integration for efficient DOM diffing with HMR support
export {
  MorphdomIntegration,
  createMorphdom,
  quickMorph,
  morphWithDefaults,
  createDefaultBeforeElUpdated,
  createAttributePreservingHook,
  combineBeforeElUpdatedHooks,
  morphdom,
  type MorphdomConfig,
  type MorphResult,
  type MorphCallback,
} from "./morphdom-integration";

// LogInspector for unified error/log aggregation
export {
  LogInspector,
  LogStream,
  createLogInspector,
  createConsoleLogInspector,
  parseErrorToLogEntry,
  type LogEntry,
  type LogSeverity,
  type LogSource,
  type LogFilter,
  type LogInspectorOptions,
  type LogStats,
} from "./log-inspector";

// QWeb validation with structured error capture
export {
  QWebValidator,
  createQWebValidator,
  validateQWeb,
  formatQWebError,
  extractDirectiveType,
  type QWebValidationError,
  type QWebValidationResult,
  type QWebValidatorOptions,
  type QWebDirective,
  type QWebErrorCode,
} from "./qweb-validation";

// Error analyzer for self-debugging
export {
  ErrorAnalyzer,
  createErrorAnalyzer,
  analyzeError,
  analyzeErrorObject,
  formatStructuredError,
  isErrorMessage,
  type StructuredError,
  type ErrorType,
  type ErrorContext,
  type ErrorAnalyzerOptions,
} from "./error-analyzer";

// Error location extractor for file/line/column extraction
export {
  ErrorLocationExtractor,
  createErrorLocationExtractor,
  extractErrorLocation,
  extractAllErrorLocations,
  extractLocationForFormat,
  hasErrorLocation,
  formatErrorLocation,
  type ErrorLocation,
  type ErrorFormat,
} from "./error-location-extractor";

// Error pattern library with 50+ patterns for Odoo/QWeb/SCSS self-debugging
export {
  ErrorPatternLibrary,
  createErrorPatternLibrary,
  matchErrorPattern,
  matchAllErrorPatterns,
  getPatternCount,
  ERROR_PATTERNS,
  type ErrorPattern,
  type ErrorCategory,
  type ErrorSeverity,
  type PatternMatch,
  type PatternMatchOptions,
} from "./error-pattern-library";

// AutoFixer for generating targeted fixes based on error patterns
export {
  AutoFixer,
  createAutoFixer,
  generateFixes,
  getBestFix,
  canAutoFix,
  type FixContext,
  type FixSuggestion,
  type FixType,
  type AutoFixResult,
  type AutoFixerOptions,
} from "./auto-fixer";

// Preview Source Navigator for preview-to-editor navigation
export {
  PreviewSourceNavigator,
  createPreviewSourceNavigator,
  navigateToSource,
  createEditorIntegration,
  type SourceNavigateEvent,
  type EditorIntegration,
  type SourceNavigatorConfig,
  type NavigationResult,
} from "./preview-source-navigator";

// Cursor Highlight Bridge for editor cursor to preview element highlighting
export {
  CursorHighlightBridge,
  createCursorHighlightBridge,
  CURSOR_HIGHLIGHT_SCRIPT,
  type CursorPosition,
  type CursorHighlightBridgeOptions,
  type CursorHighlightState,
  type HighlightStateCallback,
  type HighlightRequest,
  type UseCursorHighlightOptions,
  type UseCursorHighlightReturn,
} from "./cursor-highlight-bridge";

// Section Keyboard Navigator for arrow key navigation between sections
export {
  SectionKeyboardNavigator,
  createSectionNavigator,
  SECTION_KEYBOARD_NAV_SCRIPT,
  type NavigationDirection,
  type SectionKeyboardNavigatorOptions,
  type NavigatorState,
  type NavigationEvent,
  type NavigationCallback,
} from "./section-keyboard-navigator";

// Selection Persistence for preserving selection across HMR updates
export {
  SelectionPersistence,
  createSelectionPersistence,
  createMorphdomSelectionHooks,
  SELECTION_PERSISTENCE_SCRIPT,
  type SelectionIdentifier,
  type SelectionPersistenceOptions,
  type PersistenceState,
  type RestoreResult,
  type RestoreCallback,
} from "./selection-persistence";

// Google Fonts Selector for live font preview
export {
  GoogleFontsSelector,
  createFontSelector,
  GOOGLE_FONTS_CATALOG,
  GOOGLE_FONTS_SCRIPT,
  getFontsByCategory,
  getPopularFonts,
  findFont,
  getAllFontFamilies,
  buildFontUrl,
  buildCombinedFontUrl,
  type FontCategory,
  type FontWeight,
  type GoogleFont,
  type FontSelection,
  type FontSelectorOptions,
  type FontSelectorState,
  type FontApplyResult,
  type FontSelectionCallback,
  type FontLoadCallback,
} from "./google-fonts-selector";

// Spacing Controls for margin and padding adjustments
export {
  SpacingControls,
  createSpacingControls,
  SPACING_PRESETS,
  SPACING_CONTROLS_SCRIPT,
  DEFAULT_BOX_SPACING,
  DEFAULT_ELEMENT_SPACING,
  SIDES_ORDER,
  formatSpacingValue,
  parseSpacingValue,
  formatBoxSpacing,
  parseBoxSpacing,
  getPresetByValue,
  getClosestPreset,
  toPixels,
  cloneElementSpacing,
  type SpacingSide,
  type SpacingType,
  type SpacingAllSides,
  type SpacingUnit,
  type SpacingValue,
  type BoxSpacing,
  type ElementSpacing,
  type SpacingPreset,
  type SpacingControlsOptions,
  type SpacingControlsState,
  type SpacingChangeEvent,
  type SpacingChangeCallback,
  type DragCallback,
} from "./spacing-controls";

// Edit in Code button for jumping to source in editor
export {
  EditInCodeButton,
  createEditInCodeButton,
  EDIT_IN_CODE_SCRIPT,
  DEFAULT_LABEL,
  DEFAULT_TOOLTIP,
  DEFAULT_SHORTCUT,
  type SourceLocation as EditSourceLocation,
  type SelectedElementSource,
  type ButtonState,
  type EditInCodeButtonOptions,
  type EditInCodeButtonState,
  type EditInCodeClickEvent,
  type ClickCallback as EditClickCallback,
  type NavigationCallback as EditNavigationCallback,
  type StateChangeCallback as EditStateChangeCallback,
} from "./edit-in-code-button";

// Device Frame for device visualization around preview
export {
  DeviceFrame,
  createDeviceFrame,
  ALL_DEVICES,
  IPHONE_DEVICES,
  IPAD_DEVICES,
  MACBOOK_DEVICES,
  DESKTOP_DEVICES,
  DEFAULT_DEVICE,
  getDevice,
  getDevicesByCategory,
  getScreenDimensions,
  getFrameDimensions,
  calculateFitScale,
  type DeviceCategory,
  type DeviceOrientation,
  type DeviceColor,
  type DeviceDefinition,
  type DeviceFrameState,
  type DeviceFrameOptions,
  type FrameStyles,
  type DeviceChangeCallback,
} from "./device-frame";

// Zoom Controls for preview panel scale adjustment
export {
  ZoomControls,
  createZoomControls,
  ZOOM_PRESETS,
  KEYBOARD_SHORTCUTS,
  ZOOM_CONTROLS_SCRIPT,
  zoomToScale,
  scaleToZoom,
  formatZoom,
  getClosestPreset,
  isPreset,
  type ZoomPreset,
  type ZoomControlMode,
  type ZoomChangeSource,
  type ZoomChangeEvent,
  type ZoomControlsState,
  type ZoomControlsOptions,
  type ZoomChangeCallback,
  type StateChangeCallback as ZoomStateChangeCallback,
  type SliderConfig,
  type ButtonConfig,
  type PresetButtonConfig,
} from "./zoom-controls";

// Preview Error Boundary for error handling with fallback UI
export {
  PreviewErrorBoundary,
  createPreviewErrorBoundary,
  PREVIEW_ERROR_SCRIPT,
  ERROR_MESSAGES,
  SUGGESTED_ACTIONS,
  categorizeError,
  determineSeverity,
  isRecoverable,
  createPreviewError,
  getFallbackUIConfig,
  formatErrorMessage,
  formatErrorForLog,
  type ErrorSeverity,
  type ErrorCategory,
  type PreviewError,
  type ErrorBoundaryState,
  type ErrorBoundaryOptions,
  type FallbackUIConfig,
  type ErrorCallback,
  type RecoveryCallback,
  type StateChangeCallback as ErrorStateChangeCallback,
} from "./preview-error-boundary";

// Tool Indicator for showing active operations
export {
  ToolIndicator,
  createToolIndicator,
  TOOL_DEFINITIONS,
  CATEGORY_STYLES,
  getToolDefinition,
  formatDuration,
  truncateTarget,
  getCategoryStyle,
  type ToolOperation,
  type ToolCategory,
  type ToolDefinition,
  type ActiveTool,
  type ToolIndicatorState,
  type ToolHistoryEntry,
  type ToolIndicatorOptions,
  type ToolBadgeConfig,
  type ToolChangeCallback,
  type ToolCompleteCallback,
} from "./tool-indicator";

// ETA Calculator for estimated time remaining
export {
  ETACalculator,
  createETACalculator,
  formatDuration as formatETADuration,
  formatTime as formatETATime,
  roundForDisplay,
  type StepTiming,
  type ETAState,
  type ETACalculatorOptions,
  type ETADisplay,
  type ETAUpdateCallback,
} from "./eta-calculator";

// Animated Progress Bar with phase-specific colors
export {
  AnimatedProgressBar,
  createAnimatedProgressBar,
  PHASE_COLORS,
  PHASE_LABELS,
  SIZE_CONFIG,
  ANIMATION_KEYFRAMES,
  PROGRESS_BAR_SCRIPT,
  clamp,
  getPhaseColor,
  getPhaseLabel,
  formatProgress,
  getAnimationClasses,
  getIndeterminateClasses,
  type ProgressPhase,
  type AnimationStyle,
  type ProgressSize,
  type PhaseColor,
  type ProgressBarState,
  type ProgressBarOptions,
  type ProgressBarStyles,
  type StateChangeCallback as ProgressStateChangeCallback,
  type PhaseChangeCallback,
  type CompleteCallback as ProgressCompleteCallback,
} from "./animated-progress-bar";

// Thumbnail Generator for visual version history
export {
  ThumbnailGenerator,
  createThumbnailGenerator,
  SIZE_PRESETS as THUMBNAIL_SIZE_PRESETS,
  generateThumbnailId,
  getDimensions,
  getMimeType,
  calculateScaledDimensions,
  dataUrlToBlob,
  estimateFileSize,
  type ThumbnailSize,
  type ImageFormat,
  type ThumbnailDimensions,
  type ThumbnailMetadata,
  type Thumbnail,
  type VersionThumbnail,
  type ThumbnailGeneratorOptions,
  type CaptureOptions,
  type GenerationCallback,
  type ErrorCallback as ThumbnailErrorCallback,
} from "./thumbnail-generator";

// Version Diff View for before/after changes
export {
  VersionDiffView,
  createVersionDiffView,
  DIFF_STYLES,
  computeDiff,
  groupIntoHunks,
  calculateStats,
  formatLineNumber,
  getChangeTypeClass,
  getChangePrefix,
  formatUnifiedDiff,
  parseUnifiedDiff,
  type DiffViewMode,
  type ChangeType,
  type DiffLine,
  type DiffHunk,
  type FileDiff,
  type DiffStats,
  type VersionInfo,
  type DiffViewState,
  type DiffViewOptions,
  type DiffStyles,
  type StateChangeCallback as DiffStateChangeCallback,
  type FileSelectCallback,
} from "./version-diff-view";

// Tool Usage Indicator for chat message chips
export {
  ToolUsageIndicator,
  createToolUsageIndicator,
  TOOL_LABELS,
  getToolLabel,
  formatCount,
  formatDuration as formatUsageDuration,
  generateChipLabel,
  generateShortLabel,
  truncatePath,
  calculateSuccessRate,
  type ToolType,
  type ToolUsage,
  type AggregatedUsage,
  type UsageChip,
  type MessageUsageSummary,
  type ToolUsageIndicatorOptions,
  type ToolLabelConfig,
  type StateChangeCallback as UsageStateChangeCallback,
} from "./tool-usage-indicator";

// Token Cost Counter for session usage tracking
export {
  TokenCostCounter,
  createTokenCostCounter,
  MODEL_PRICING,
  formatTokenCount,
  formatCost,
  calculateCost,
  estimateTokens,
  formatSessionDuration,
  calculateCostPerToken,
  generateSessionSummary,
  type ModelId,
  type ModelPricing,
  type TokenUsage,
  type SessionStats,
  type ModelStats,
  type DisplayOptions,
  type HeaderDisplay,
  type UsageHistoryEntry,
  type BudgetAlert,
  type StatsChangeCallback,
} from "./token-cost-counter";

// Quality Score Display for generation completion
export {
  QualityScoreDisplay,
  createQualityScoreDisplay,
  CATEGORY_LABELS,
  CATEGORY_SHORT_LABELS,
  DEFAULT_CATEGORY_WEIGHTS,
  GRADE_THRESHOLDS,
  SCORE_COLORS,
  getGrade,
  getScoreColor,
  getScoreStatus,
  formatScore,
  formatCategoryScore,
  calculateWeightedAverage,
  normalizeWeights,
  createSyntaxCheck,
  createA11yCheck,
  createStructureCheck,
  createPerformanceCheck,
  createQualityCheck,
  type QualityCategory,
  type QualityCheck,
  type QualityIssue,
  type CategoryScore,
  type QualityScore,
  type QualityGrade,
  type DisplayOptions as QualityDisplayOptions,
  type QualityDisplay,
  type ScoreColor,
  type ScoreChangeCallback,
  type QualityScoreDisplayOptions,
} from "./quality-score-display";

// File Diff Display for inline chat messages
export {
  FileDiffDisplay,
  createFileDiffDisplay,
  DEFAULT_COLORS as DIFF_DEFAULT_COLORS,
  LIGHT_COLORS as DIFF_LIGHT_COLORS,
  LINE_PREFIXES,
  CSS_CLASSES as DIFF_CSS_CLASSES,
  parseUnifiedDiff,
  createDiff,
  groupIntoHunks as groupDiffIntoHunks,
  renderLineText,
  renderLineHtml,
  escapeHtml,
  getLineColor,
  formatDiffStats,
  type LineChangeType,
  type DiffLine as FileDiffLine,
  type DiffHunk as FileDiffHunk,
  type FileDiff,
  type DiffColors,
  type DiffDisplayOptions,
  type RenderedLine,
  type RenderedDiff,
  type DiffChangeCallback,
  type DisplayStateCallback as DiffDisplayStateCallback,
  type FileDiffDisplayState,
} from "./file-diff-display";

// Collapsible Section for plan/execution details
export {
  CollapsibleSection,
  createCollapsibleSection,
  DEFAULT_ANIMATION,
  SECTION_LABELS,
  SECTION_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
  TOGGLE_ICONS,
  generateSectionId,
  formatDuration as formatSectionDuration,
  formatTimestamp,
  truncateText,
  getStatusBadge,
  getSeverityBadge,
  escapeHtml as escapeSectionHtml,
  createStepSummary,
  createLogSummary,
  createLogEntry,
  createPlanStep,
  type SectionType,
  type SectionStatus,
  type LogSeverity,
  type LogEntry,
  type PlanStep,
  type SectionContent,
  type AnimationOptions,
  type SectionDisplayOptions,
  type RenderedSection,
  type StateChangeCallback as SectionStateChangeCallback,
  type ToggleCallback,
  type CollapsibleSectionOptions,
} from "./collapsible-section";

// Message Actions for chat messages
export {
  MessageActions,
  createMessageActions,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_TOOLTIPS,
  ACTION_SHORTCUTS,
  DEFAULT_USER_ACTIONS,
  DEFAULT_ASSISTANT_ACTIONS,
  copyToClipboard,
  formatForCopy,
  generateButtonHtml,
  getActionsForRole,
  createActionButton,
  type ActionType,
  type ActionState,
  type MessageRole,
  type ActionButton,
  type MessageContext,
  type ActionResult,
  type CopyOptions,
  type RegenerateOptions,
  type EditOptions,
  type CopyCallback,
  type RegenerateCallback,
  type EditCallback,
  type DeleteCallback,
  type ActionCallback,
  type HoverState,
  type MessageActionsOptions,
  type RenderedActionPanel,
} from "./message-actions";

// Panel Animator for collapse/expand animations
export {
  PanelAnimator,
  createPanelAnimator,
  DEFAULT_CONFIG,
  EASING_CSS,
  EASING_PRESETS,
  ANIMATION_STYLES,
  getEasingValue,
  applyEasing,
  generateTransitionCSS,
  generateFrameStyles,
  prefersReducedMotion,
  lerp,
  clamp as clampValue,
  generatePanelId,
  createSmoothConfig,
  createSnappyConfig,
  createBounceConfig,
  type AnimationDirection,
  type AnimationStyle,
  type EasingFunction,
  type PanelOrientation,
  type AnimationState,
  type AnimationConfig,
  type PanelDimensions,
  type AnimationFrame,
  type PanelState,
  type AnimationStyles,
  type AnimationCallback,
  type StateChangeCallback as PanelStateChangeCallback,
  type CompleteCallback as PanelCompleteCallback,
  type PanelAnimatorOptions,
} from "./panel-animator";

// Panel Layout Presets for code-focused, preview-focused, balanced layouts
export {
  PanelLayoutPresets,
  createPanelLayoutPresets,
  LAYOUT_PRESETS,
  PRESET_SHORTCUTS,
  DEFAULT_MIN_SIZES,
  DEFAULT_MAX_SIZES,
  DEFAULT_TRANSITION,
  SMOOTH_TRANSITION,
  SPRING_TRANSITION,
  STORAGE_KEY as LAYOUT_STORAGE_KEY,
  getPreset as getLayoutPreset,
  getAllPresetNames,
  getAllPresets,
  findPresetByShortcut,
  getPanelRatio,
  isPanelVisible,
  validateRatios,
  normalizeRatios,
  calculatePixelSizes,
  generatePanelCSS,
  createTransitionCSS,
  loadPersistedPreset,
  persistPreset,
  clearPersistedPreset,
  generatePresetButtons,
  generatePresetButtonsHTML,
  type PresetName,
  type PanelId,
  type PanelRatio,
  type PanelVisibility,
  type LayoutOrientation,
  type TransitionStyle,
  type PanelConfig,
  type LayoutPreset,
  type LayoutState,
  type TransitionOptions,
  type PresetChangeEvent,
  type PanelResizeEvent,
  type PresetChangeCallback,
  type PanelResizeCallback,
  type StateChangeCallback as LayoutStateChangeCallback,
  type PanelLayoutPresetsOptions,
  type PresetButtonConfig,
} from "./panel-layout-presets";
