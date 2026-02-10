/**
 * Platxa Frontend Agent
 *
 * AI-powered frontend design system with opt-in brand kit support.
 * Generates beautiful, production-ready React UI components.
 *
 * ## Getting Started (5-minute quickstart)
 *
 * ### Scenario 1: Zero-Config (Recommended Start)
 *
 * Just import and use - no configuration needed:
 *
 * ```typescript
 * import { resolveConfig, generateTheme } from "@platxa/frontend-agent"
 *
 * // Uses built-in "default" theme automatically
 * const config = resolveConfig()
 * const theme = generateTheme(config.themeConfig)
 *
 * console.log(theme.css)  // Ready-to-use CSS variables
 * ```
 *
 * ### Scenario 2: Built-in Theme Presets
 *
 * Choose from built-in presets (blue, green, violet):
 *
 * ```typescript
 * import { resolveConfig, generateTheme } from "@platxa/frontend-agent"
 *
 * // Use blue preset
 * const config = resolveConfig({ theme: { preset: "blue" } })
 * const theme = generateTheme(config.themeConfig)
 * ```
 *
 * ### Scenario 3: Custom Theme
 *
 * Create a custom theme with your brand colors:
 *
 * ```typescript
 * import { createTheme, generateTheme } from "@platxa/frontend-agent"
 *
 * const customTheme = createTheme("my-brand", {
 *   primaryHue: 262,      // Purple
 *   saturation: "high",
 *   useOklch: true,       // Use OKLCH color space
 * })
 *
 * const theme = generateTheme(customTheme)
 * ```
 *
 * ### Scenario 4: Brand Kit Integration (Advanced)
 *
 * Use a custom brand kit package:
 *
 * ```typescript
 * // platxa.config.ts
 * import { defineFrontendConfig } from "@platxa/frontend-agent"
 *
 * export default defineFrontendConfig({
 *   brand: { package: "@company/brand-kit" }
 * })
 *
 * // main.ts
 * import { resolveConfig, loadBrandKit } from "@platxa/frontend-agent"
 *
 * const config = resolveConfig(platxaConfig)
 * if (config.mode === "brand" && config.brandPackage) {
 *   const result = await loadBrandKit(config.brandPackage)
 *   // result.tokens contains normalized design tokens
 * }
 * ```
 *
 * ### Scenario 5: Vite Integration
 *
 * Auto-load config and inject CSS:
 *
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from "vite"
 * import { platxaTheme } from "@platxa/frontend-agent/vite"
 *
 * export default defineConfig({
 *   plugins: [platxaTheme()]
 * })
 *
 * // main.tsx - import virtual CSS
 * import "virtual:platxa-theme.css"
 * ```
 *
 * ### Scenario 6: Build-Time CSS Generation
 *
 * Generate static CSS at build time:
 *
 * ```typescript
 * import { processThemeForBuild, getThemePreset } from "@platxa/frontend-agent"
 * import { writeFileSync } from "fs"
 *
 * const config = getThemePreset("blue")
 * const output = processThemeForBuild(config)
 *
 * writeFileSync("dist/theme.css", output.stylesheet)
 * ```
 *
 * ### Scenario 7: Creating a Brand Kit Package
 *
 * Create a shareable brand kit:
 *
 * ```typescript
 * import { generateBrandKitPackageTemplate } from "@platxa/frontend-agent"
 * import { writeFileSync, mkdirSync } from "fs"
 *
 * const template = generateBrandKitPackageTemplate({
 *   packageName: "@company/brand-kit",
 *   brandName: "My Company",
 *   primaryHue: 220,
 * })
 *
 * mkdirSync("brand-kit/src", { recursive: true })
 * for (const [path, content] of Object.entries(template)) {
 *   writeFileSync(`brand-kit/${path}`, content)
 * }
 * ```
 *
 * ## React Hooks
 *
 * ```typescript
 * import { useTheme, useBrand } from "@platxa/frontend-agent"
 *
 * function MyComponent() {
 *   const { mode, tokens, setMode } = useTheme()
 *   const { name, isLoaded } = useBrand()
 *
 *   return (
 *     <div style={{ color: tokens.colors.primary }}>
 *       <button onClick={() => setMode("dark")}>Dark Mode</button>
 *     </div>
 *   )
 * }
 * ```
 *
 * @module react-agent
 */

// Core agent class and factory functions
export { ReActAgent, createAgent, createAction } from "./agent"

// Type exports
export type {
  // Core types
  StepType,
  AgentStatus,
  // Step types
  ReasoningResult,
  ActionDefinition,
  ParameterDefinition,
  ActionResult,
  Observation,
  Step,
  // Configuration
  AgentConfig,
  AgentState,
  // Events
  AgentEvent,
  AgentEventCallback,
  // Input/Output
  AgentInput,
  AgentOutput,
  // Extension interfaces
  ReasoningEngine,
  ActionExecutor,
  AgentHooks,
} from "./types"

// =============================================================================
// DESIGN SYSTEM MODULES
// =============================================================================

// Design Analyzer (#1-5)
export {
  detectComponentType,
  getComponentCategory,
  detectStyleVariant,
  detectSizeVariant,
  detectShapeVariant,
  extractColorIntent,
  extractSpacingIntent,
  extractTypographyIntent,
  extractInteractionIntent,
  extractAnimationIntent,
  extractLayoutIntent,
  extractContentIntent,
  extractAccessibilityIntent,
  extractKeywords,
  analyzeDescription,
  quickAnalyze,
  validateRequirements,
} from "./design-analyzer"
export type {
  ComponentType,
  ComponentCategory,
  StyleVariant,
  SizeVariant,
  ShapeVariant,
  ColorIntent,
  SpacingIntent,
  TypographyIntent,
  InteractionIntent,
  AnimationIntent,
  LayoutIntent,
  ContentIntent,
  AccessibilityIntent,
  DesignRequirements,
  PatternMatch,
  AnalysisResult,
  KeywordPattern,
  AnalyzerConfig,
} from "./design-analyzer"

// Color Rules (#6-10)
export {
  DEFAULT_DISTRIBUTION,
  DEFAULT_TOLERANCE,
  DEFAULT_WEIGHTS,
  DEFAULT_ELEMENT_MAPPING,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  convertColor,
  getRelativeLuminance as colorGetRelativeLuminance,
  calculateContrast,
  categorizeColorUsage,
  assignColorRole,
  calculateColorWeight,
  createColorEntry,
  extractColorsFromStyles,
  calculateDistribution,
  isWithinTolerance,
  calculateDeviation,
  generateSuggestions,
  calculateBalanceScore,
  analyzeColorBalance,
  analyzeComponent as analyzeComponentColor,
  analyzeLayout as analyzeLayoutColor,
  extractPalette,
  detectHarmony,
  analyzeHarmony,
  suggestRoleReassignment,
} from "./color-rule"
export type {
  ColorRole,
  ColorUsageCategory,
  ColorEntry,
  ColorDistribution,
  RuleTolerance,
  ColorBalanceResult,
  ColorSuggestion,
  ColorPalette,
  ElementColorMap,
  WeightMultipliers,
  ComponentColorAnalysis,
  LayoutColorAnalysis,
  ColorRuleConfig,
  ColorHarmony,
  ColorHarmonyResult,
  StyleColorExtract,
  ColorConversion,
  ContrastResult,
} from "./color-rule"

// OKLCH Palette (#11-15)
export {
  DEFAULT_SHADE_CONFIG,
  TAILWIND_SHADES,
  rgbToOklch,
  oklchToRgb,
  hexToOklch,
  oklchToHex,
  hslToOklch as oklchHslToOklch,
  oklchToHsl,
  parseColor as parseColorOklch,
  formatOklch,
  formatTailwindOklch,
  isInSrgbGamut,
  getMaxChroma,
  mapToGamut,
  createGamutColor,
  adjustColor,
  lighten as oklchLighten,
  darken as oklchDarken,
  saturate as oklchSaturate,
  desaturate,
  rotateHue,
  mixColors,
  interpolateColors,
  generateShadeScale,
  generatePalette as generateOklchPalette,
  generateComplementaryPalette,
  generateAnalogousPalette,
  generateTriadicPalette,
  generateSplitComplementaryPalette,
  generateTetradicPalette,
} from "./oklch-palette"
export type {
  OklchColor,
  RgbColor,
  HslColor,
  ColorGamut,
  GamutColor,
  PaletteMode,
  ShadeConfig,
  TailwindShadeScale,
  ColorPalette as OklchColorPalette,
  HarmonyPalette,
  PaletteOptions,
  SemanticPalette,
  OklchThemeConfig,
  ContrastPair,
  ColorAdjustment,
  InterpolationOptions,
  ParsedColor,
  GamutMapResult,
  AccessibleColorSuggestion,
} from "./oklch-palette"

// Typography Scale (#16-20)
export {
  SCALE_RATIOS,
  FONT_WEIGHTS,
  DEFAULT_STEP_NAMES,
  DEFAULT_FONT_STACKS,
  DEFAULT_HIERARCHY_CONFIG,
  DEFAULT_SCALE_OPTIONS,
  getRatioValue,
  getFontWeightValue,
  calculateLineHeight,
  calculateLetterSpacing,
  convertToUnit,
  generateScale,
  getScaleStep,
  getStepAtIndex,
  generateSemanticTypography,
  generateFluidSize,
  generateFluidScale,
  generateTypographyCss,
  validateTypography,
  PRESET_MODERN,
  PRESET_EDITORIAL,
} from "./typography-scale"
export type {
  HierarchyLevel,
  TypographyRole,
  FontWeight,
  FontWeightValue,
  ScaleRatio,
  TypographyUnit,
  TypeSize,
  TypeStyle,
  ScaleStep,
  TypographyScale,
  HierarchyConfig,
  SemanticTypography,
  FluidConfig,
  ResponsiveTypography,
  ScaleOptions,
  HierarchyOptions,
  TypographyCss,
  FontStacks,
  TypographyValidation,
  TypographyPreset,
  LineHeightMode,
  LineHeightConfig,
  LineHeightResult,
  LineLengthResult,
  LineLengthConfig,
} from "./typography-scale"

// Design Tokens (#21-25)
export {
  defaultLightColors,
  defaultDarkColors,
  defaultChartColors,
  defaultBorderRadius,
  createDefaultTokens,
  generateThemeDirective,
  generateRootVariables,
  generateDarkVariables,
  generateChartVariables,
  generateTheme as generateDesignTokenTheme,
  validateTokens,
  hexToHsl,
  hslToHex,
  toOklch,
  parseOklch,
  generateColorScale,
  detectColorFormat,
  createSemanticColorsFromPrimary,
} from "./design-tokens"
export type {
  ColorToken,
  ColorScale,
  SemanticColors,
  ChartColors,
  SpacingScale,
  TypographyTokens,
  BorderRadiusTokens,
  ShadowTokens,
  AnimationTokens,
  BreakpointTokens,
  DesignTokens,
  ThemeDirectiveConfig,
  NamingConvention,
  GeneratedTheme,
  ThemeGenerationOptions,
  TokenValidationResult,
  ColorFormat,
} from "./design-tokens"

// =============================================================================
// COMPONENT MODULES
// =============================================================================

// Animations (#26-30)
export {
  resolvePreset,
  getHoverForPreset,
  getTapForPreset,
  composeAnimations,
  generateAnimationCode,
  generateAnimatedComponent,
  getAnimationForComponent,
  withReducedMotion,
  springSnappy,
  springGentle,
  springBouncy,
  springStiff,
  springSoft,
  hoverScale,
  hoverLift,
  hoverGlow,
  hoverBrighten,
  hoverRotate,
  tapScale,
  tapPush,
  tapPress,
  presenceFade,
  presenceScale,
  presenceSlide,
  presenceBounce,
  presenceFlip,
  presenceZoom,
  pulseVariants,
} from "./animations"

// Theme (#31-35)
export {
  parseHsl,
  hslToString,
  hslToOklch as themeHslToOklch,
  oklchToString,
  lighten as themeLighten,
  darken as themeDarken,
  saturate as themeSaturate,
  generatePalette as themeGeneratePalette,
  generateSemanticColors,
  generateColorVariables,
  generateCss,
  generateDarkModeCss,
  generateTailwindTheme,
  generateThemeScript,
  generateTheme,
  generateThemeFromPreset,
  createTheme,
  validateTheme,
  slatePalette,
  zincPalette,
  neutralPalette,
  defaultLightColors as themeDefaultLightColors,
  defaultDarkColors as themeDefaultDarkColors,
  blueLightColors,
  blueDarkColors,
  greenLightColors,
  violetLightColors,
  defaultSpacing,
  defaultTypography,
  defaultFontWeight,
  defaultRadius,
  defaultShadow,
  defaultTokens,
  defaultTheme,
  blueTheme,
  greenTheme,
  violetTheme,
  getThemePreset,
  getThemePresetNames,
} from "./theme"

// Accessibility (#36-43)
export {
  hexToRgb as a11yHexToRgb,
  parseRgbString,
  hslToRgb as a11yHslToRgb,
  parseColor as a11yParseColor,
  getRelativeLuminance,
  getContrastRatio,
  checkContrast,
  suggestAccessibleColor,
  ariaRoleRequirements,
  getRoleRequirements,
  validateAriaForRole,
  componentA11yRequirements,
  getComponentRequirements,
  focusIndicatorRequirements,
  targetSizeRequirements,
  checkTargetSize,
  keyboardPatterns,
  getKeyboardPattern,
  validateKeyboardAccessibility,
  validateScreenReader,
  createIssue,
  auditContrast,
  auditAria,
  calculateScore,
  audit,
} from "./accessibility"
export type {
  WcagLevel,
  WcagVersion,
  IssueSeverity,
  WcagCategory,
  WcagCriterion,
  RgbColor as A11yRgbColor,
  ContrastResult as A11yContrastResult,
  AriaRoleCategory,
} from "./accessibility"

// =============================================================================
// MODERN CSS MODULES (#44-68)
// =============================================================================

// Modern CSS Features (#44-48)
export {
  DEFAULT_CONTAINER_BREAKPOINTS,
  createContainerQuerySystem,
  generateContainerQuery,
  generateHasSelector,
  HAS_PATTERNS,
  generateHasUtilities,
  generateLinearGradient,
  generateRadialGradient,
  generateConicGradient,
  generateGradient,
  GRADIENT_PRESETS,
  generateGradientUtilities,
  generate3DTransform,
  generate3DUtilities,
  createModernCssSystem,
} from "./modern-css"
export type {
  ContainerType,
  ContainerBreakpoint,
  ContainerDefinition,
  ContainerQueryRule,
  ContainerQueryConfig,
  HasPattern,
  HasSelectorRule,
  HasUseCases,
  GradientType,
  GradientDirection,
  RadialShape,
  RadialSize,
  GradientStop,
  LinearGradientConfig,
  RadialGradientConfig,
  ConicGradientConfig,
  GradientConfig,
  GradientPreset,
  ViewTransitionName,
  ViewTransitionConfig,
  Transform3DConfig,
  ModernCssOutput,
  ModernCssSystemConfig,
  ModernCssSystem,
} from "./modern-css"

// Page Sections (#49-53)
export {
  HERO_LAYOUTS,
  generateHeroSection,
  generateFeatureGrid,
  generatePricingTable,
  generateTestimonials,
  generateFooter,
  generateDashboardLayout,
  generateDataTable,
  generateAuthForm,
  createPageSectionGenerator,
} from "./page-sections"
export type {
  CtaButton,
  ImageConfig,
  SocialLink,
  HeroLayout,
  HeroConfig,
  HeroOutput,
  FeatureItem,
  FeatureGridLayout,
  FeatureGridConfig,
  PricingTier,
  PricingTableConfig,
  Testimonial,
  TestimonialLayout,
  TestimonialConfig,
  FooterColumn,
  FooterConfig,
  SidebarItem,
  DashboardLayoutConfig,
  TableColumn,
  DataTableConfig,
  AuthFormType,
  OAuthProvider,
  AuthFormConfig,
  SectionOutput,
} from "./page-sections"

// Spacing & Grid (#54-58)
export {
  DEFAULT_GRID_CONFIG,
  SPACING_MULTIPLIERS,
  DEFAULT_SEMANTIC_MAPPING,
  createSpacingValue,
  spacing,
  pxToUnits,
  unitsToPx,
  isOnGrid,
  snapToGrid,
  floorToGrid,
  ceilToGrid,
  generateSpacingScale,
  generateSemanticSpacing,
  generateComponentSpacing,
  generateLayoutSpacing,
  validateSpacing,
  validateSpacingValues,
  allOnGrid,
  boxSpacing,
  boxSpacingXY,
  boxSpacingTRBL,
  formatBoxSpacing,
  generateSpacingCss,
  PRESET_4PX,
  PRESET_8PX,
  PRESET_COMPACT,
  SPACING_PRESETS,
} from "./spacing-grid"
export type {
  SpacingUnit,
  SpacingMultiplier,
  SemanticSpacing,
  SpacingOutputUnit,
  SpacingValue,
  SpacingScale as GridSpacingScale,
  SemanticSpacingTokens,
  ComponentSpacing,
  LayoutSpacing,
  SpacingGridConfig,
  SpacingValidation,
  SpacingCss,
  SpacingPreset,
  BoxSpacing,
  InsetSpacing,
} from "./spacing-grid"

// Atomic Design (#59-63)
export {
  classifyComponent,
  classifyComponents,
  analyzeComplexity,
  generateAtomTemplate,
  generateMoleculeTemplate,
  generateOrganismTemplate,
  generateTemplateComponent,
  generateFolderStructure,
  getComponentPath,
  generateIndexFile,
} from "./atomic-design"
export type {
  AtomicLevel,
  AtomicClassification,
  ComponentMetadata,
  ComplexityIndicators,
  AtomTemplate,
  MoleculeTemplate,
  OrganismTemplate,
  TemplateConfig,
  PageConfig,
  AtomCategory,
  MoleculeCategory,
  OrganismCategory,
  TemplateCategory,
  PropDefinition,
  VariantDefinition,
  AccessibilityConfig,
  InteractionPattern,
  StructureDefinition,
  StateConfig,
  DataRequirement,
  LayoutDefinition,
  BreakpointConfig,
  SlotDefinition,
  PageMeta,
  RouteConfig,
  AtomicFolderStructure,
  AtomicGenerationOptions,
} from "./atomic-design"

// =============================================================================
// AI & QUALITY MODULES (#69-85)
// =============================================================================

// AI Features (#69-73)
export {
  DEFAULT_MOCKUP_CONFIG,
  analyzeMockupDescription,
  generateCodeFromAnalysis,
  DEFAULT_CRITIQUE_CONFIG,
  generateDesignCritique,
  SHADCN_LIBRARY,
  extractComponentSignature,
  searchSimilarComponents,
  DEFAULT_AUTOFIX_CONFIG,
  applyAutoFix,
  DEFAULT_CONTEXT_CONFIG,
  estimateTokens,
  createContextItem,
  createContextWindow,
  addToContext,
  optimizeContext,
  compressContent,
  createAIFeaturesSystem,
} from "./ai-features"
export type {
  DetectedElement,
  ExtractedColor,
  MockupAnalysis,
  MockupAnalyzerConfig,
  CritiqueCategory,
  CritiqueSeverity,
  CritiqueItem,
  DesignCritique,
  CritiqueConfig,
  ComponentSignature,
  SimilarityMatch,
  SimilaritySearchResult,
  ComponentLibrary,
  AutoFixRule,
  AutoFixResult,
  AutoFixConfig,
  ContextItemType,
  ContextItem,
  ContextWindow,
  ContextOptimization,
  ContextManagerConfig,
  AIFeaturesConfig,
} from "./ai-features"

// Performance (#74-77)
export {
  DEFAULT_INP_CONFIG,
  analyzeINP,
  DEFAULT_PACKAGE_SIZES,
  DEFAULT_BUNDLE_CONFIG,
  analyzeBundleSize,
  DEFAULT_LAZY_CONFIG,
  LAZY_PATTERNS,
  analyzeLazyLoading,
  DEFAULT_COMPILER_CONFIG,
  analyzeCompilerCompatibility,
  createPerformanceSystem,
} from "./performance"
export type {
  InteractionType,
  INPSeverity,
  INPIssue,
  INPAnalysis,
  INPConfig,
  ImportType,
  DetectedImport,
  BundleAnalysis,
  PackageSizeMap,
  BundleAnalyzerConfig,
  LazyStrategy,
  LazyCandidate,
  LazyLoadingAnalysis,
  LazyLoadingConfig,
  CompilerCompatibility,
  CompilerIssue,
  CompilerAnalysis,
  CompilerConfig,
  PerformanceConfig,
} from "./performance"

// Quality (#78-81)
export {
  DEFAULT_QUALITY_WEIGHTS,
  createCheck,
  generateQualityReport,
  DEFAULT_DESIGN_RULES,
  checkDesignConsistency,
  validateTypeScript,
  generateComponentDoc,
  formatDocAsMarkdown,
  createQualitySystem,
} from "./quality"
export type {
  QualityCategory,
  CheckSeverity,
  QualityCheck,
  QualityScoreBreakdown,
  QualityReport,
  QualityScoringConfig,
  TokenType,
  TokenUsage,
  ConsistencyResult,
  DesignSystemRules,
  TypeScriptCheckType,
  TypeScriptIssue,
  TypeScriptValidation,
  PropDoc,
  ComponentDoc,
  DocFormat,
  DocGenerationOptions,
} from "./quality"

// DX - Developer Experience (#82-85)
export {
  DEFAULT_STORY_VARIANTS,
  generateStory,
  generateStoriesFromCode,
  DEFAULT_VIEWPORTS,
  generateVisualTest,
  generateVisualTestsFromCode,
  DEFAULT_BREAKPOINTS,
  generateResponsivePreview,
  DEFAULT_LIVE_PREVIEW_CONFIG,
  generateLivePreview,
  createDxSystem,
} from "./dx"
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
} from "./dx"

// =============================================================================
// ORCHESTRATION & TESTING MODULES
// =============================================================================

// Generators
export {
  generateComponentCode,
  generateFromTemplate,
  validateComponent,
  toPascalCase,
  toCamelCase,
  componentTemplates,
  getTemplate,
  getTemplateNames,
  buttonVariants,
  buttonSizes,
  badgeVariants,
  alertVariants,
  inputSizes,
  avatarSizes,
} from "./generators"
export type {
  ComponentSpec,
  GeneratedComponent,
  GenerationOptions,
  ValidationResult,
  VariantConfig,
  SizeConfig,
  PropDefinition as GeneratorPropDefinition,
  ComponentTemplate,
  ComponentTemplateSpec,
} from "./generators"

// Test Planner
export {
  generateTestPlan,
  toMarkdown,
  extractSpecFromRequirements,
  resetTestIdCounter,
  generatePropTests,
  generateStateTests,
  generateEventTests,
  generateAccessibilityTests,
  generateVisualTests,
  generateIntegrationTests,
  generateE2ETests,
  generatePerformanceTests,
} from "./test-planner"
export type {
  TestPlan,
  TestSuite,
  TestCase,
  TestCategory,
  TestPriority,
  TestPlanSummary,
  CoverageAnalysis,
  ComponentSpec as TestComponentSpec,
  PropSpec,
  StateSpec,
  EventSpec,
} from "./test-planner"

// Test Generator
export {
  generateTests as generateTestCode,
  generateTestsMultiFramework,
  generateTestFile,
  generateSuiteCode,
  generateTestCaseCode,
  getFrameworkTemplates,
  parseStep,
  parseTestCase,
} from "./test-generator"
export type {
  TestFramework,
  GeneratedTestFile,
  TestGenerationResult,
  TestGeneratorConfig,
  FrameworkTemplates,
  AssertionTemplates,
  ActionTemplates,
  SelectorTemplates,
  TestStep,
  ParsedTestCase,
  ComponentContext,
} from "./test-generator"

// Orchestrator
export {
  FrontendOrchestrator,
  createOrchestrator,
  generateFromDescription,
  validateRequest,
} from "./orchestrator"
export type {
  GenerationRequest,
  GenerationResult,
  WorkflowState,
  WorkflowStep,
  WorkflowStepSuccess,
  WorkflowStepFailed,
  WorkflowStepPending,
  StepStatus,
  GeneratedFile,
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventListener,
  Worker,
  PipelineDefinition,
} from "./orchestrator"

// Coordinator
export {
  Coordinator,
  createCoordinator,
  BaseSubAgent,
  createSubAgent,
  createCapability,
  CommonCapabilities,
} from "./coordinator"
export type {
  SubAgentStatus,
  TaskPriority,
  DistributionStrategy,
  AggregationStrategy,
  SubAgentCapabilities,
  SubAgentConfig,
  SubAgentState,
  CoordinatorTask,
  SubAgentResult,
  AggregatedResult,
  CoordinatorConfig,
  CoordinatorState,
  CoordinatorEventType,
  CoordinatorEvent,
  CoordinatorEventCallback,
} from "./coordinator"

// =============================================================================
// BRAND SYSTEM (Feature #45-49)
// =============================================================================

// Brand Configuration
export {
  defineFrontendConfig,
  defineBrandKit,
  resolveConfig,
  validateConfig,
  getBuiltInTheme,
  getBuiltInPresetNames,
  getAllPresetNames,
  isBuiltInPreset,
  usesBrandKit,
  usesBuiltInTheme,
  getEffectivePreset,
  BUILTIN_PRESETS,
  DEFAULT_CONFIG,
  createBrandKitTemplate,
  EXAMPLE_BRAND_KIT,
  generateBrandKitPackageTemplate,
} from "./brand"

export type {
  ConfigValidationResult,
  BrandKitTemplateOptions,
  BrandKitPackageOptions,
  BrandKitPackageTemplate,
} from "./brand"

// Brand Loading
export {
  loadBrandKit,
  resolveBrand,
  validateBrandKit,
  isValidBrandPackageName,
  normalizeBrandTokens,
  mergeDesignTokens,
  getBrandLoadingState,
  getCurrentBrandKit,
  isBrandLoaded,
  isBrandLoading,
  clearBrandCache,
  removeBrandFromCache,
  isBrandCached,
  getBrandCacheSize,
  useBrand,
  subscribeToBrandChanges,
  getBrandStateSnapshot,
  validateCssValue,
  sanitizeCssValue,
  validateBrandKitCss,
} from "./brand"

export type { BrandLoadResult, BrandLoaderOptions, UseBrandState } from "./brand"

// Config File Loading
export {
  loadConfigFile,
  findAndLoadConfig,
  validateLoadedConfig,
  isSupportedExtension,
  getConfigExtension,
  isConfigFileName,
  getConfigFilePaths,
  getConfigFormatDescription,
  isConfigLoadingSupported,
  CONFIG_FILE_NAME,
  CONFIG_FILE_NAMES,
  SUPPORTED_EXTENSIONS,
} from "./brand"

export type {
  ConfigFileExtension,
  ConfigFileResult,
  ConfigLoaderOptions,
} from "./brand"

// Brand Types
export type {
  BuiltInPreset,
  ThemePresetName,
  BrandKitMeta,
  BrandKitExport,
  BrandColorPrimitives,
  BrandSemanticColors,
  BrandTypography,
  BrandSpacing,
  BrandRadius,
  BrandShadow,
  FrontendConfig,
  ThemeOptions,
  BrandOptions,
  ResolvedConfig,
  ConfigLoadingState,
  ConfigState,
  DefineFrontendConfigReturn,
  DefineBrandKitReturn,
  BrandKitValidationResult,
} from "./brand"

// Theme React Hooks
export {
  useTheme,
  subscribeToThemeChanges,
  getThemeStateSnapshot,
  setThemeMode,
  getThemeMode,
  setThemeConfig,
  generateStaticStylesheet,
  processThemeForBuild,
  processPresetForBuild,
} from "./theme"

export type { UseThemeState, BuildOutput } from "./theme"

// =============================================================================
// POSTCSS PLUGIN (Feature #137)
// =============================================================================

// PostCSS Plugin for Brand Token Processing
export {
  platxaTokens,
  postcssPluginPlatxa,
} from "./postcss"

export type { PlatxaPostCSSOptions } from "./postcss"

// =============================================================================
// ESLINT PLUGIN (Feature #138)
// =============================================================================

// ESLint Plugin for Brand Token Usage
export {
  plugin as eslintPlugin,
  flatConfigRecommended as eslintConfigRecommended,
  flatConfigStrict as eslintConfigStrict,
  isColorValue,
  isColorProperty,
  extractColorsFromValue,
  suggestTokenForColor,
  COLOR_PATTERNS,
  COLOR_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_COLORS,
} from "./eslint"

export type {
  NoHardcodedColorsOptions,
  PreferBrandTokenOptions,
} from "./eslint"

// =============================================================================
// STYLELINT PLUGIN (Feature #145)
// =============================================================================

// Stylelint Plugin for Brand CSS Rules
export {
  default as stylelintPlugin,
  createStylelintPlugin,
  rules as stylelintRules,
  configs as stylelintConfigs,
  createEnforceCSSVariablesRule,
  createColorFormatRule,
  createNamingConventionRule,
  isCSSVariable,
  isHardcodedColor,
  detectColorFormat as detectCSSColorFormat,
  isColorProperty as isStylelintColorProperty,
  extractColors,
  validateCustomPropertyName,
  validateSelectorName,
  COLOR_FORMAT_PATTERNS,
  TOKEN_PROPERTIES,
  NAMED_COLORS as STYLELINT_NAMED_COLORS,
  DEFAULT_ALLOWED_VALUES as STYLELINT_DEFAULT_ALLOWED_VALUES,
  NAMESPACE as STYLELINT_NAMESPACE,
} from "./stylelint"

export type {
  EnforceCSSVariablesOptions,
  ColorFormatOptions,
  NamingConventionOptions,
} from "./stylelint"

// =============================================================================
// MCP Integration (ESLint AI-Aware Linting)
// =============================================================================

export {
  createESLintMCPTool,
  createAILintContext,
  ESLintBridge,
  createESLintBridge,
  createAIContext,
} from "./mcp"

export type {
  LintSeverity,
  LintMessage,
  LintSuggestion,
  LintFix,
  LintFileResult,
  LintResults,
  RuleCategory,
  LintAnalysis,
  DetectedPattern,
  LintToolParams,
  AnalyzeToolParams,
  ReportToolParams,
  ESLintMCPConfig,
  ESLintMCPTool,
  RuleInfo,
  AILintContext,
} from "./mcp"

// =============================================================================
// Streaming (Double-Streaming with Sanitization)
// =============================================================================

export {
  createDoubleStream,
  createSanitizingTransform,
  pipeWithSanitization,
  escapeHtml,
  escapeXml,
  escapeJson,
  escapeMarkdown,
  stripHtml,
  backendSanitize,
  clientSanitize,
  clientSanitizeSync,
  sanitize,
  sanitizeSync,
  preloadDOMPurify,
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  SAFE_URI_REGEX,
  PROTOCOL_CODES,
} from "./streaming"

export type {
  ChunkType,
  StreamChunk,
  TextChunk,
  MetadataChunk,
  FinishChunk,
  ErrorChunk,
  AnyChunk,
  StreamMetadata,
  StreamPhase,
  FinishData,
  StreamError,
  ContentType,
  SanitizeOptions,
  SanitizeResult,
  DOMPurifyConfig,
  StreamSource,
  StreamTransform,
  StreamPipelineConfig,
  StreamPipelineState,
  DoubleStreamPipeline,
  UseDoubleStreamOptions,
  UseDoubleStreamReturn,
} from "./streaming"
