/**
 * Odoo Mobile App Theme Generator
 *
 * Generates themes specifically for Odoo Mobile app, matching
 * the web theme styling for consistent brand experience.
 *
 * Key Features:
 * - Native mobile color schemes (iOS/Android)
 * - Touch-optimized spacing and sizing
 * - Mobile-specific component styling
 * - Dark mode support for mobile
 * - Sync with web theme colors
 *
 * @example
 * ```typescript
 * import { generateMobileTheme, createMobileThemeFromWeb } from "@/lib/odoo-skills/mobile-theme-generator"
 *
 * // Generate standalone mobile theme
 * const mobileTheme = generateMobileTheme({
 *   name: "my_mobile_theme",
 *   colors: { primary: "#2563eb", ... },
 *   platform: "both",
 * })
 *
 * // Create mobile theme matching web theme
 * const mobileFromWeb = createMobileThemeFromWeb(webThemeConfig)
 * ```
 *
 * @module odoo-skills/mobile-theme-generator
 */

import type {
  ColorPalette,
  Typography,
  GeneratedFile,
  ThemeConfig,
} from "./types"

// =============================================================================
// Types
// =============================================================================

/** Target mobile platform */
export type MobilePlatform = "ios" | "android" | "both"

/** Mobile component types */
export type MobileComponentType =
  | "navigation"
  | "list"
  | "form"
  | "button"
  | "card"
  | "modal"
  | "tab_bar"
  | "header"
  | "search"
  | "toast"

/** Mobile theme configuration */
export interface MobileThemeConfig {
  /** Theme name (lowercase, underscore) */
  name: string
  /** Display name */
  displayName: string
  /** Theme description */
  description?: string
  /** Version */
  version?: string
  /** Target platform */
  platform: MobilePlatform
  /** Color palette */
  colors: ColorPalette
  /** Typography settings */
  typography?: MobileTypography
  /** Component customizations */
  components?: MobileComponentStyles
  /** Enable dark mode */
  darkMode?: boolean
  /** Dark mode colors (auto-generated if not provided) */
  darkModeColors?: ColorPalette
  /** Touch target sizes */
  touchTargets?: TouchTargetConfig
  /** Associated web theme name */
  webThemeName?: string
}

/** Mobile typography settings */
export interface MobileTypography {
  /** Primary font family */
  fontFamily: string
  /** iOS system font fallback */
  iosFontFamily?: string
  /** Android system font fallback */
  androidFontFamily?: string
  /** Base font size in dp/pt */
  baseFontSize: number
  /** Header font weight */
  headerWeight: number
  /** Body font weight */
  bodyWeight: number
  /** Line height multiplier */
  lineHeight: number
}

/** Touch target configuration */
export interface TouchTargetConfig {
  /** Minimum touch target size in dp */
  minSize: number
  /** Button height */
  buttonHeight: number
  /** Input field height */
  inputHeight: number
  /** List item height */
  listItemHeight: number
  /** Tab bar height */
  tabBarHeight: number
  /** Navigation header height */
  headerHeight: number
}

/** Mobile component style overrides */
export interface MobileComponentStyles {
  /** Navigation bar style */
  navigation?: {
    backgroundColor?: string
    tintColor?: string
    titleColor?: string
    translucent?: boolean
  }
  /** Button styles */
  button?: {
    borderRadius?: number
    paddingHorizontal?: number
    paddingVertical?: number
    fontSize?: number
  }
  /** Card styles */
  card?: {
    borderRadius?: number
    shadowOpacity?: number
    padding?: number
  }
  /** List styles */
  list?: {
    separatorColor?: string
    separatorInset?: number
    rowHeight?: number
  }
  /** Form input styles */
  form?: {
    borderRadius?: number
    borderColor?: string
    focusBorderColor?: string
    backgroundColor?: string
  }
  /** Tab bar styles */
  tabBar?: {
    backgroundColor?: string
    activeTintColor?: string
    inactiveTintColor?: string
    showLabels?: boolean
  }
}

/** Mobile theme generation result */
export interface MobileThemeResult {
  /** Success status */
  success: boolean
  /** Generated files */
  files: GeneratedFile[]
  /** Theme manifest data */
  manifest: MobileThemeManifest
  /** Generation stats */
  stats: {
    totalFiles: number
    totalBytes: number
    generationTime: number
  }
}

/** Mobile theme manifest */
export interface MobileThemeManifest {
  name: string
  displayName: string
  version: string
  platform: MobilePlatform
  webThemeName?: string
  colorScheme: "light" | "dark" | "both"
  files: string[]
}

// =============================================================================
// Constants
// =============================================================================

/** Default mobile typography */
const DEFAULT_MOBILE_TYPOGRAPHY: MobileTypography = {
  fontFamily: "System",
  iosFontFamily: "-apple-system, BlinkMacSystemFont",
  androidFontFamily: "Roboto, sans-serif",
  baseFontSize: 16,
  headerWeight: 600,
  bodyWeight: 400,
  lineHeight: 1.5,
}

/** Default touch targets (following Apple HIG and Material Design) */
const DEFAULT_TOUCH_TARGETS: TouchTargetConfig = {
  minSize: 44,
  buttonHeight: 48,
  inputHeight: 48,
  listItemHeight: 56,
  tabBarHeight: 49,
  headerHeight: 56,
}

/** Platform-specific defaults */
const PLATFORM_DEFAULTS = {
  ios: {
    borderRadius: 10,
    shadowOpacity: 0.1,
    separatorInset: 16,
    translucent: true,
  },
  android: {
    borderRadius: 4,
    shadowOpacity: 0.2,
    separatorInset: 0,
    translucent: false,
  },
}

// =============================================================================
// Core Generator Functions
// =============================================================================

/**
 * Generate a complete Odoo Mobile theme
 */
export function generateMobileTheme(config: MobileThemeConfig): MobileThemeResult {
  const startTime = Date.now()
  const files: GeneratedFile[] = []

  // Apply defaults
  const typography = { ...DEFAULT_MOBILE_TYPOGRAPHY, ...config.typography }
  const touchTargets = { ...DEFAULT_TOUCH_TARGETS, ...config.touchTargets }

  // Generate dark mode colors if enabled but not provided
  const darkModeColors = config.darkMode && !config.darkModeColors
    ? generateDarkModeColors(config.colors)
    : config.darkModeColors

  // Generate manifest
  const manifest = generateManifest(config, darkModeColors)
  files.push({
    path: `${config.name}/manifest.json`,
    content: JSON.stringify(manifest, null, 2),
    type: "js", // JSON type
  })

  // Generate color definitions
  files.push(...generateColorFiles(config, darkModeColors))

  // Generate typography styles
  files.push(...generateTypographyFiles(config.name, typography))

  // Generate component styles
  files.push(...generateComponentFiles(config, typography, touchTargets))

  // Generate platform-specific files
  if (config.platform === "ios" || config.platform === "both") {
    files.push(...generateIOSFiles(config, typography, touchTargets))
  }
  if (config.platform === "android" || config.platform === "both") {
    files.push(...generateAndroidFiles(config, typography, touchTargets))
  }

  // Generate sync file for web theme matching
  if (config.webThemeName) {
    files.push(generateWebThemeSyncFile(config))
  }

  const endTime = Date.now()
  const totalBytes = files.reduce((sum, f) => sum + f.content.length, 0)

  return {
    success: true,
    files,
    manifest,
    stats: {
      totalFiles: files.length,
      totalBytes,
      generationTime: endTime - startTime,
    },
  }
}

/**
 * Create mobile theme from existing web theme configuration
 */
export function createMobileThemeFromWeb(
  webTheme: ThemeConfig,
  options?: Partial<MobileThemeConfig>
): MobileThemeResult {
  const mobileConfig: MobileThemeConfig = {
    name: `${webTheme.name}_mobile`,
    displayName: `${webTheme.displayName} (Mobile)`,
    description: `Mobile version of ${webTheme.displayName}`,
    version: webTheme.version,
    platform: options?.platform || "both",
    colors: webTheme.colors,
    typography: options?.typography || {
      fontFamily: webTheme.typography.bodyFamily,
      baseFontSize: 16,
      headerWeight: webTheme.typography.headingWeight,
      bodyWeight: webTheme.typography.bodyWeight,
      lineHeight: 1.5,
    },
    darkMode: options?.darkMode ?? webTheme.features.darkMode,
    darkModeColors: options?.darkModeColors,
    components: options?.components,
    touchTargets: options?.touchTargets,
    webThemeName: webTheme.name,
  }

  return generateMobileTheme(mobileConfig)
}

// =============================================================================
// File Generators
// =============================================================================

function generateManifest(
  config: MobileThemeConfig,
  darkModeColors?: ColorPalette
): MobileThemeManifest {
  const files: string[] = [
    "colors/light.json",
    "typography/styles.json",
    "components/common.json",
  ]

  if (darkModeColors) {
    files.push("colors/dark.json")
  }

  if (config.platform === "ios" || config.platform === "both") {
    files.push("platform/ios.json")
  }
  if (config.platform === "android" || config.platform === "both") {
    files.push("platform/android.json")
  }

  return {
    name: config.name,
    displayName: config.displayName || config.name,
    version: config.version || "1.0.0",
    platform: config.platform,
    webThemeName: config.webThemeName,
    colorScheme: darkModeColors ? "both" : "light",
    files,
  }
}

function generateColorFiles(
  config: MobileThemeConfig,
  darkModeColors?: ColorPalette
): GeneratedFile[] {
  const files: GeneratedFile[] = []

  // Light mode colors
  const lightColors = {
    scheme: "light",
    colors: {
      primary: config.colors.primary,
      primaryVariant: adjustLightness(config.colors.primary, -10),
      secondary: config.colors.secondary,
      secondaryVariant: adjustLightness(config.colors.secondary, -10),
      accent: config.colors.accent,
      background: config.colors.background,
      surface: config.colors.surface,
      error: config.colors.error,
      success: config.colors.success,
      warning: config.colors.warning,
      onPrimary: getContrastColor(config.colors.primary),
      onSecondary: getContrastColor(config.colors.secondary),
      onBackground: config.colors.text,
      onSurface: config.colors.text,
      onError: getContrastColor(config.colors.error),
      textPrimary: config.colors.text,
      textSecondary: config.colors.textMuted,
      divider: config.colors.border,
      disabled: adjustLightness(config.colors.textMuted, 20),
      ripple: `${config.colors.primary}20`,
      shadow: "rgba(0, 0, 0, 0.1)",
    },
  }

  files.push({
    path: `${config.name}/colors/light.json`,
    content: JSON.stringify(lightColors, null, 2),
    type: "js",
  })

  // Dark mode colors
  if (darkModeColors) {
    const darkColors = {
      scheme: "dark",
      colors: {
        primary: darkModeColors.primary,
        primaryVariant: adjustLightness(darkModeColors.primary, 10),
        secondary: darkModeColors.secondary,
        secondaryVariant: adjustLightness(darkModeColors.secondary, 10),
        accent: darkModeColors.accent,
        background: darkModeColors.background,
        surface: darkModeColors.surface,
        error: darkModeColors.error,
        success: darkModeColors.success,
        warning: darkModeColors.warning,
        onPrimary: getContrastColor(darkModeColors.primary),
        onSecondary: getContrastColor(darkModeColors.secondary),
        onBackground: darkModeColors.text,
        onSurface: darkModeColors.text,
        onError: getContrastColor(darkModeColors.error),
        textPrimary: darkModeColors.text,
        textSecondary: darkModeColors.textMuted,
        divider: darkModeColors.border,
        disabled: adjustLightness(darkModeColors.textMuted, -20),
        ripple: `${darkModeColors.primary}30`,
        shadow: "rgba(0, 0, 0, 0.3)",
      },
    }

    files.push({
      path: `${config.name}/colors/dark.json`,
      content: JSON.stringify(darkColors, null, 2),
      type: "js",
    })
  }

  return files
}

function generateTypographyFiles(
  themeName: string,
  typography: MobileTypography
): GeneratedFile[] {
  const typographyConfig = {
    fontFamily: {
      primary: typography.fontFamily,
      ios: typography.iosFontFamily || "-apple-system, BlinkMacSystemFont",
      android: typography.androidFontFamily || "Roboto, sans-serif",
    },
    scale: {
      xs: Math.round(typography.baseFontSize * 0.75),
      sm: Math.round(typography.baseFontSize * 0.875),
      base: typography.baseFontSize,
      lg: Math.round(typography.baseFontSize * 1.125),
      xl: Math.round(typography.baseFontSize * 1.25),
      "2xl": Math.round(typography.baseFontSize * 1.5),
      "3xl": Math.round(typography.baseFontSize * 1.875),
      "4xl": Math.round(typography.baseFontSize * 2.25),
    },
    weight: {
      light: 300,
      normal: typography.bodyWeight,
      medium: 500,
      semibold: 600,
      bold: typography.headerWeight,
    },
    lineHeight: {
      tight: 1.25,
      normal: typography.lineHeight,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
    },
    styles: {
      h1: {
        fontSize: Math.round(typography.baseFontSize * 2.25),
        fontWeight: typography.headerWeight,
        lineHeight: 1.25,
      },
      h2: {
        fontSize: Math.round(typography.baseFontSize * 1.875),
        fontWeight: typography.headerWeight,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: Math.round(typography.baseFontSize * 1.5),
        fontWeight: typography.headerWeight,
        lineHeight: 1.35,
      },
      h4: {
        fontSize: Math.round(typography.baseFontSize * 1.25),
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body: {
        fontSize: typography.baseFontSize,
        fontWeight: typography.bodyWeight,
        lineHeight: typography.lineHeight,
      },
      caption: {
        fontSize: Math.round(typography.baseFontSize * 0.75),
        fontWeight: typography.bodyWeight,
        lineHeight: 1.4,
      },
      button: {
        fontSize: typography.baseFontSize,
        fontWeight: 600,
        lineHeight: 1,
        textTransform: "none",
      },
    },
  }

  return [{
    path: `${themeName}/typography/styles.json`,
    content: JSON.stringify(typographyConfig, null, 2),
    type: "js",
  }]
}

function generateComponentFiles(
  config: MobileThemeConfig,
  typography: MobileTypography,
  touchTargets: TouchTargetConfig
): GeneratedFile[] {
  const components = config.components || {}

  const componentConfig = {
    common: {
      borderRadius: {
        none: 0,
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      shadow: {
        none: "none",
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
      },
    },
    navigation: {
      height: touchTargets.headerHeight,
      backgroundColor: components.navigation?.backgroundColor || config.colors.surface,
      tintColor: components.navigation?.tintColor || config.colors.primary,
      titleColor: components.navigation?.titleColor || config.colors.text,
      titleFontSize: Math.round(typography.baseFontSize * 1.125),
      titleFontWeight: 600,
      shadowEnabled: true,
      translucent: components.navigation?.translucent ?? false,
    },
    button: {
      height: touchTargets.buttonHeight,
      minWidth: 64,
      borderRadius: components.button?.borderRadius ?? 8,
      paddingHorizontal: components.button?.paddingHorizontal ?? 16,
      paddingVertical: components.button?.paddingVertical ?? 12,
      fontSize: components.button?.fontSize ?? typography.baseFontSize,
      fontWeight: 600,
      variants: {
        primary: {
          backgroundColor: config.colors.primary,
          textColor: getContrastColor(config.colors.primary),
        },
        secondary: {
          backgroundColor: config.colors.secondary,
          textColor: getContrastColor(config.colors.secondary),
        },
        outline: {
          backgroundColor: "transparent",
          borderColor: config.colors.primary,
          borderWidth: 1,
          textColor: config.colors.primary,
        },
        text: {
          backgroundColor: "transparent",
          textColor: config.colors.primary,
        },
      },
    },
    card: {
      borderRadius: components.card?.borderRadius ?? 12,
      backgroundColor: config.colors.surface,
      shadowOpacity: components.card?.shadowOpacity ?? 0.1,
      padding: components.card?.padding ?? 16,
      borderColor: config.colors.border,
      borderWidth: 0,
    },
    list: {
      rowHeight: touchTargets.listItemHeight,
      separatorColor: components.list?.separatorColor || config.colors.border,
      separatorInset: components.list?.separatorInset ?? 16,
      backgroundColor: config.colors.surface,
      activeBackgroundColor: `${config.colors.primary}10`,
    },
    form: {
      inputHeight: touchTargets.inputHeight,
      borderRadius: components.form?.borderRadius ?? 8,
      borderWidth: 1,
      borderColor: components.form?.borderColor || config.colors.border,
      focusBorderColor: components.form?.focusBorderColor || config.colors.primary,
      backgroundColor: components.form?.backgroundColor || config.colors.surface,
      placeholderColor: config.colors.textMuted,
      padding: 12,
      fontSize: typography.baseFontSize,
    },
    tabBar: {
      height: touchTargets.tabBarHeight,
      backgroundColor: components.tabBar?.backgroundColor || config.colors.surface,
      activeTintColor: components.tabBar?.activeTintColor || config.colors.primary,
      inactiveTintColor: components.tabBar?.inactiveTintColor || config.colors.textMuted,
      showLabels: components.tabBar?.showLabels ?? true,
      labelFontSize: Math.round(typography.baseFontSize * 0.75),
      iconSize: 24,
    },
    modal: {
      backgroundColor: config.colors.surface,
      overlayColor: "rgba(0, 0, 0, 0.5)",
      borderRadius: 16,
      padding: 20,
    },
    toast: {
      backgroundColor: config.colors.text,
      textColor: config.colors.background,
      borderRadius: 8,
      padding: 12,
      fontSize: Math.round(typography.baseFontSize * 0.875),
    },
    search: {
      height: 40,
      borderRadius: 20,
      backgroundColor: config.colors.background,
      placeholderColor: config.colors.textMuted,
      iconColor: config.colors.textMuted,
      padding: 12,
    },
  }

  return [{
    path: `${config.name}/components/common.json`,
    content: JSON.stringify(componentConfig, null, 2),
    type: "js",
  }]
}

function generateIOSFiles(
  config: MobileThemeConfig,
  typography: MobileTypography,
  touchTargets: TouchTargetConfig
): GeneratedFile[] {
  const iosConfig = {
    platform: "ios",
    version: "15.0",
    appearance: {
      style: config.darkMode ? "automatic" : "light",
      accentColor: config.colors.primary,
      tintColor: config.colors.primary,
    },
    navigation: {
      barStyle: "default",
      translucent: PLATFORM_DEFAULTS.ios.translucent,
      prefersLargeTitles: true,
      shadowImage: true,
    },
    tabBar: {
      translucent: true,
      itemPositioning: "centered",
    },
    systemFonts: {
      largeTitle: {
        size: 34,
        weight: "bold",
      },
      title1: {
        size: 28,
        weight: "bold",
      },
      title2: {
        size: 22,
        weight: "bold",
      },
      title3: {
        size: 20,
        weight: "semibold",
      },
      headline: {
        size: 17,
        weight: "semibold",
      },
      body: {
        size: typography.baseFontSize,
        weight: "regular",
      },
      callout: {
        size: 16,
        weight: "regular",
      },
      subheadline: {
        size: 15,
        weight: "regular",
      },
      footnote: {
        size: 13,
        weight: "regular",
      },
      caption1: {
        size: 12,
        weight: "regular",
      },
      caption2: {
        size: 11,
        weight: "regular",
      },
    },
    haptics: {
      selectionChanged: true,
      impactLight: true,
      impactMedium: true,
      notificationSuccess: true,
      notificationWarning: true,
      notificationError: true,
    },
    safeArea: {
      respectTop: true,
      respectBottom: true,
      topInset: 44,
      bottomInset: 34,
    },
    corners: {
      small: 8,
      medium: 12,
      large: 16,
      continuous: true,
    },
  }

  return [{
    path: `${config.name}/platform/ios.json`,
    content: JSON.stringify(iosConfig, null, 2),
    type: "js",
  }]
}

function generateAndroidFiles(
  config: MobileThemeConfig,
  typography: MobileTypography,
  touchTargets: TouchTargetConfig
): GeneratedFile[] {
  const androidConfig = {
    platform: "android",
    minSdk: 24,
    targetSdk: 34,
    appearance: {
      forceDarkAllowed: config.darkMode ?? true,
      windowLightStatusBar: isLightColor(config.colors.background),
      windowLightNavigationBar: isLightColor(config.colors.surface),
    },
    material: {
      version: 3,
      dynamicColors: false,
      colorPrimary: config.colors.primary,
      colorPrimaryContainer: adjustLightness(config.colors.primary, 40),
      colorSecondary: config.colors.secondary,
      colorSecondaryContainer: adjustLightness(config.colors.secondary, 40),
      colorTertiary: config.colors.accent,
      colorError: config.colors.error,
      colorSurface: config.colors.surface,
      colorBackground: config.colors.background,
      colorOnPrimary: getContrastColor(config.colors.primary),
      colorOnSecondary: getContrastColor(config.colors.secondary),
      colorOnBackground: config.colors.text,
      colorOnSurface: config.colors.text,
      colorOutline: config.colors.border,
    },
    typography: {
      displayLarge: { size: 57, weight: 400, lineHeight: 64 },
      displayMedium: { size: 45, weight: 400, lineHeight: 52 },
      displaySmall: { size: 36, weight: 400, lineHeight: 44 },
      headlineLarge: { size: 32, weight: 400, lineHeight: 40 },
      headlineMedium: { size: 28, weight: 400, lineHeight: 36 },
      headlineSmall: { size: 24, weight: 400, lineHeight: 32 },
      titleLarge: { size: 22, weight: 500, lineHeight: 28 },
      titleMedium: { size: 16, weight: 500, lineHeight: 24 },
      titleSmall: { size: 14, weight: 500, lineHeight: 20 },
      bodyLarge: { size: typography.baseFontSize, weight: 400, lineHeight: 24 },
      bodyMedium: { size: 14, weight: 400, lineHeight: 20 },
      bodySmall: { size: 12, weight: 400, lineHeight: 16 },
      labelLarge: { size: 14, weight: 500, lineHeight: 20 },
      labelMedium: { size: 12, weight: 500, lineHeight: 16 },
      labelSmall: { size: 11, weight: 500, lineHeight: 16 },
    },
    elevation: {
      level0: 0,
      level1: 1,
      level2: 3,
      level3: 6,
      level4: 8,
      level5: 12,
    },
    shapes: {
      extraSmall: PLATFORM_DEFAULTS.android.borderRadius,
      small: 8,
      medium: 12,
      large: 16,
      extraLarge: 28,
      full: 9999,
    },
    ripple: {
      color: config.colors.primary,
      alpha: 0.12,
      bounded: true,
    },
    statusBar: {
      color: config.colors.primary,
      lightIcons: !isLightColor(config.colors.primary),
    },
    navigationBar: {
      color: config.colors.surface,
      lightIcons: !isLightColor(config.colors.surface),
      dividerColor: config.colors.border,
    },
  }

  return [{
    path: `${config.name}/platform/android.json`,
    content: JSON.stringify(androidConfig, null, 2),
    type: "js",
  }]
}

function generateWebThemeSyncFile(config: MobileThemeConfig): GeneratedFile {
  const syncConfig = {
    mobileTheme: config.name,
    webTheme: config.webThemeName,
    syncVersion: "1.0",
    colorMapping: {
      web: {
        primary: "primary",
        secondary: "secondary",
        accent: "accent",
        background: "background",
        surface: "surface",
        text: "text",
        textMuted: "textMuted",
        border: "border",
      },
      mobile: {
        primary: "primary",
        secondary: "secondary",
        accent: "accent",
        background: "background",
        surface: "surface",
        textPrimary: "text",
        textSecondary: "textMuted",
        divider: "border",
      },
    },
    autoSync: {
      enabled: true,
      properties: ["colors", "typography.fontFamily"],
    },
    overrides: {
      // Mobile-specific overrides that don't sync
      touchTargets: true,
      platformSpecific: true,
      haptics: true,
    },
  }

  return {
    path: `${config.name}/sync/web-theme-sync.json`,
    content: JSON.stringify(syncConfig, null, 2),
    type: "js",
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate dark mode colors from light colors
 */
function generateDarkModeColors(lightColors: ColorPalette): ColorPalette {
  return {
    primary: adjustLightness(lightColors.primary, 10),
    secondary: adjustLightness(lightColors.secondary, 10),
    accent: adjustLightness(lightColors.accent, 10),
    background: "#121212",
    surface: "#1e1e1e",
    text: "#ffffff",
    textMuted: "#a0a0a0",
    border: "#333333",
    success: adjustLightness(lightColors.success, 10),
    warning: adjustLightness(lightColors.warning, 10),
    error: adjustLightness(lightColors.error, 10),
  }
}

/**
 * Adjust color lightness
 */
function adjustLightness(color: string, amount: number): string {
  // Simple hex color adjustment
  const hex = color.replace("#", "")
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount * 2.55))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount * 2.55))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount * 2.55))
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`
}

/**
 * Get contrasting text color for a background
 */
function getContrastColor(bgColor: string): string {
  return isLightColor(bgColor) ? "#000000" : "#ffffff"
}

/**
 * Check if color is light
 */
function isLightColor(color: string): boolean {
  const hex = color.replace("#", "")
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Validate mobile theme configuration
 */
export function validateMobileThemeConfig(config: MobileThemeConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.name || !/^[a-z][a-z0-9_]*$/.test(config.name)) {
    errors.push("Theme name must be lowercase alphanumeric with underscores, starting with a letter")
  }

  if (!config.colors?.primary) {
    errors.push("Primary color is required")
  }

  if (!["ios", "android", "both"].includes(config.platform)) {
    errors.push("Platform must be 'ios', 'android', or 'both'")
  }

  // Validate color format
  const colorRegex = /^#[0-9A-Fa-f]{6}$/
  const colorFields = ["primary", "secondary", "accent", "background", "surface", "text"] as const
  for (const field of colorFields) {
    if (config.colors?.[field] && !colorRegex.test(config.colors[field])) {
      errors.push(`Invalid color format for ${field}: ${config.colors[field]}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get mobile theme presets
 */
export function getMobileThemePresets(): Record<string, Partial<MobileThemeConfig>> {
  return {
    modern: {
      typography: {
        fontFamily: "Inter",
        baseFontSize: 16,
        headerWeight: 700,
        bodyWeight: 400,
        lineHeight: 1.5,
      },
      components: {
        button: { borderRadius: 8 },
        card: { borderRadius: 16, shadowOpacity: 0.08 },
        form: { borderRadius: 8 },
      },
    },
    classic: {
      typography: {
        fontFamily: "Georgia",
        baseFontSize: 16,
        headerWeight: 700,
        bodyWeight: 400,
        lineHeight: 1.6,
      },
      components: {
        button: { borderRadius: 4 },
        card: { borderRadius: 4, shadowOpacity: 0.1 },
        form: { borderRadius: 4 },
      },
    },
    minimal: {
      typography: {
        fontFamily: "System",
        baseFontSize: 15,
        headerWeight: 600,
        bodyWeight: 400,
        lineHeight: 1.5,
      },
      components: {
        button: { borderRadius: 0 },
        card: { borderRadius: 0, shadowOpacity: 0 },
        form: { borderRadius: 0 },
        navigation: { translucent: false },
      },
    },
    rounded: {
      typography: {
        fontFamily: "Nunito",
        baseFontSize: 16,
        headerWeight: 700,
        bodyWeight: 400,
        lineHeight: 1.5,
      },
      components: {
        button: { borderRadius: 24 },
        card: { borderRadius: 24, shadowOpacity: 0.12 },
        form: { borderRadius: 16 },
      },
    },
  }
}
