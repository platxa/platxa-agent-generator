/**
 * Odoo Website Builder Snippet Options
 *
 * Simulates the snippet option system from Odoo's website builder.
 * Provides styling presets for backgrounds, padding, alignment, and more.
 */

/**
 * Color combination presets (Odoo's o_cc1 through o_cc5)
 */
export interface ColorCombination {
  id: string;
  name: string;
  className: string;
  bgColor: string;
  textColor: string;
  primaryColor: string;
  secondaryColor: string;
}

export const COLOR_COMBINATIONS: ColorCombination[] = [
  {
    id: "o_cc1",
    name: "Light",
    className: "o_cc o_cc1",
    bgColor: "#ffffff",
    textColor: "#212529",
    primaryColor: "#714B67",
    secondaryColor: "#017e84",
  },
  {
    id: "o_cc2",
    name: "Primary",
    className: "o_cc o_cc2",
    bgColor: "#714B67",
    textColor: "#ffffff",
    primaryColor: "#ffffff",
    secondaryColor: "#e2d5df",
  },
  {
    id: "o_cc3",
    name: "Secondary",
    className: "o_cc o_cc3",
    bgColor: "#f8f9fa",
    textColor: "#212529",
    primaryColor: "#714B67",
    secondaryColor: "#017e84",
  },
  {
    id: "o_cc4",
    name: "Accent",
    className: "o_cc o_cc4",
    bgColor: "#017e84",
    textColor: "#ffffff",
    primaryColor: "#ffffff",
    secondaryColor: "#cce7e8",
  },
  {
    id: "o_cc5",
    name: "Dark",
    className: "o_cc o_cc5",
    bgColor: "#212529",
    textColor: "#ffffff",
    primaryColor: "#ffffff",
    secondaryColor: "#adb5bd",
  },
];

/**
 * Padding presets for sections
 */
export interface PaddingOption {
  id: string;
  name: string;
  topClass: string;
  bottomClass: string;
  topValue: string;
  bottomValue: string;
}

export const PADDING_PRESETS: PaddingOption[] = [
  { id: "none", name: "None", topClass: "pt0", bottomClass: "pb0", topValue: "0", bottomValue: "0" },
  { id: "small", name: "Small", topClass: "pt16", bottomClass: "pb16", topValue: "16px", bottomValue: "16px" },
  { id: "medium", name: "Medium", topClass: "pt32", bottomClass: "pb32", topValue: "32px", bottomValue: "32px" },
  { id: "large", name: "Large", topClass: "pt64", bottomClass: "pb64", topValue: "64px", bottomValue: "64px" },
  { id: "xlarge", name: "X-Large", topClass: "pt96", bottomClass: "pb96", topValue: "96px", bottomValue: "96px" },
  { id: "xxlarge", name: "XX-Large", topClass: "pt160", bottomClass: "pb160", topValue: "160px", bottomValue: "160px" },
];

/**
 * Content width options
 */
export interface WidthOption {
  id: string;
  name: string;
  className: string;
  maxWidth: string;
}

export const WIDTH_OPTIONS: WidthOption[] = [
  { id: "container", name: "Container", className: "container", maxWidth: "1140px" },
  { id: "container-fluid", name: "Full Width", className: "container-fluid", maxWidth: "100%" },
  { id: "container-sm", name: "Small", className: "container-sm", maxWidth: "540px" },
  { id: "container-md", name: "Medium", className: "container-md", maxWidth: "720px" },
  { id: "container-lg", name: "Large", className: "container-lg", maxWidth: "960px" },
  { id: "container-xl", name: "X-Large", className: "container-xl", maxWidth: "1140px" },
];

/**
 * Text alignment options
 */
export interface AlignmentOption {
  id: string;
  name: string;
  icon: string;
  className: string;
}

export const ALIGNMENT_OPTIONS: AlignmentOption[] = [
  { id: "left", name: "Left", icon: "align-left", className: "text-start" },
  { id: "center", name: "Center", icon: "align-center", className: "text-center" },
  { id: "right", name: "Right", icon: "align-right", className: "text-end" },
];

/**
 * Shape divider options for section separators
 */
export interface ShapeDivider {
  id: string;
  name: string;
  svg: string;
  position: "top" | "bottom";
}

export const SHAPE_DIVIDERS: ShapeDivider[] = [
  {
    id: "wave",
    name: "Wave",
    position: "bottom",
    svg: `<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="currentColor"></path></svg>`,
  },
  {
    id: "curve",
    name: "Curve",
    position: "bottom",
    svg: `<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M600,112.77C268.63,112.77,0,65.52,0,7.23V120H1200V7.23C1200,65.52,931.37,112.77,600,112.77Z" fill="currentColor"></path></svg>`,
  },
  {
    id: "triangle",
    name: "Triangle",
    position: "bottom",
    svg: `<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M1200 0L0 0 598.97 114.72 1200 0z" fill="currentColor"></path></svg>`,
  },
  {
    id: "tilt",
    name: "Tilt",
    position: "bottom",
    svg: `<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M1200 120L0 16.48 0 0 1200 0 1200 120z" fill="currentColor"></path></svg>`,
  },
  {
    id: "zigzag",
    name: "Zigzag",
    position: "bottom",
    svg: `<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" fill="currentColor"></path></svg>`,
  },
];

/**
 * Background style options
 */
export interface BackgroundOption {
  id: string;
  name: string;
  type: "color" | "gradient" | "image" | "video";
  value: string;
}

export const BACKGROUND_PRESETS: BackgroundOption[] = [
  { id: "white", name: "White", type: "color", value: "#ffffff" },
  { id: "light-gray", name: "Light Gray", type: "color", value: "#f8f9fa" },
  { id: "dark", name: "Dark", type: "color", value: "#212529" },
  { id: "primary", name: "Primary", type: "color", value: "#714B67" },
  { id: "secondary", name: "Secondary", type: "color", value: "#017e84" },
  {
    id: "gradient-purple",
    name: "Purple Gradient",
    type: "gradient",
    value: "linear-gradient(135deg, #714B67 0%, #9c6b8e 100%)",
  },
  {
    id: "gradient-teal",
    name: "Teal Gradient",
    type: "gradient",
    value: "linear-gradient(135deg, #017e84 0%, #019fa7 100%)",
  },
  {
    id: "gradient-sunset",
    name: "Sunset Gradient",
    type: "gradient",
    value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  },
];

/**
 * Animation options for snippet elements
 */
export interface AnimationOption {
  id: string;
  name: string;
  className: string;
  duration: string;
}

export const ANIMATION_OPTIONS: AnimationOption[] = [
  { id: "none", name: "None", className: "", duration: "0s" },
  { id: "fade-in", name: "Fade In", className: "o_animate o_fade_in", duration: "0.5s" },
  { id: "fade-in-up", name: "Fade In Up", className: "o_animate o_fade_in_up", duration: "0.5s" },
  { id: "fade-in-down", name: "Fade In Down", className: "o_animate o_fade_in_down", duration: "0.5s" },
  { id: "zoom-in", name: "Zoom In", className: "o_animate o_zoom_in", duration: "0.5s" },
  { id: "slide-left", name: "Slide Left", className: "o_animate o_slide_left", duration: "0.5s" },
  { id: "slide-right", name: "Slide Right", className: "o_animate o_slide_right", duration: "0.5s" },
];

/**
 * Snippet options state
 */
export interface SnippetOptions {
  colorCombination: string;
  paddingTop: string;
  paddingBottom: string;
  width: string;
  alignment: string;
  background: string;
  backgroundType: "color" | "gradient" | "image";
  shapeDividerTop?: string;
  shapeDividerBottom?: string;
  animation: string;
}

/**
 * Default snippet options
 */
export const DEFAULT_SNIPPET_OPTIONS: SnippetOptions = {
  colorCombination: "o_cc1",
  paddingTop: "large",
  paddingBottom: "large",
  width: "container",
  alignment: "left",
  background: "white",
  backgroundType: "color",
  animation: "none",
};

/**
 * Generate CSS for snippet options
 */
export function generateSnippetCSS(options: Partial<SnippetOptions>): string {
  const merged = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const styles: string[] = [];

  // Color combination
  const cc = COLOR_COMBINATIONS.find((c) => c.id === merged.colorCombination);
  if (cc) {
    styles.push(`--snippet-bg: ${cc.bgColor}`);
    styles.push(`--snippet-text: ${cc.textColor}`);
    styles.push(`--snippet-primary: ${cc.primaryColor}`);
    styles.push(`--snippet-secondary: ${cc.secondaryColor}`);
  }

  // Padding
  const paddingTop = PADDING_PRESETS.find((p) => p.id === merged.paddingTop);
  const paddingBottom = PADDING_PRESETS.find((p) => p.id === merged.paddingBottom);
  if (paddingTop) styles.push(`padding-top: ${paddingTop.topValue}`);
  if (paddingBottom) styles.push(`padding-bottom: ${paddingBottom.bottomValue}`);

  // Background
  const bg = BACKGROUND_PRESETS.find((b) => b.id === merged.background);
  if (bg) {
    if (bg.type === "gradient") {
      styles.push(`background: ${bg.value}`);
    } else {
      styles.push(`background-color: ${bg.value}`);
    }
  }

  return styles.join("; ");
}

/**
 * Generate class names for snippet options
 */
export function generateSnippetClasses(options: Partial<SnippetOptions>): string {
  const merged = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const classes: string[] = [];

  // Color combination
  const cc = COLOR_COMBINATIONS.find((c) => c.id === merged.colorCombination);
  if (cc) classes.push(cc.className);

  // Padding
  const paddingTop = PADDING_PRESETS.find((p) => p.id === merged.paddingTop);
  const paddingBottom = PADDING_PRESETS.find((p) => p.id === merged.paddingBottom);
  if (paddingTop) classes.push(paddingTop.topClass);
  if (paddingBottom) classes.push(paddingBottom.bottomClass);

  // Width
  const width = WIDTH_OPTIONS.find((w) => w.id === merged.width);
  if (width) classes.push(width.className);

  // Alignment
  const alignment = ALIGNMENT_OPTIONS.find((a) => a.id === merged.alignment);
  if (alignment) classes.push(alignment.className);

  // Animation
  const animation = ANIMATION_OPTIONS.find((a) => a.id === merged.animation);
  if (animation && animation.className) classes.push(animation.className);

  return classes.join(" ");
}

/**
 * Apply options to a snippet HTML string
 */
export function applySnippetOptions(html: string, options: Partial<SnippetOptions>): string {
  const classes = generateSnippetClasses(options);
  const styles = generateSnippetCSS(options);

  // Find the first section or root element and add classes/styles
  return html.replace(
    /^(\s*<(?:section|div)[^>]*)(class="([^"]*)")?([^>]*>)/,
    (match, start, classAttr, existingClasses, end) => {
      const newClasses = existingClasses
        ? `${existingClasses} ${classes}`
        : classes;
      const styleAttr = styles ? ` style="${styles}"` : "";
      return `${start}class="${newClasses}"${styleAttr}${end}`;
    }
  );
}

/**
 * Parse snippet options from HTML element attributes
 */
export function parseSnippetOptions(html: string): Partial<SnippetOptions> {
  const options: Partial<SnippetOptions> = {};

  // Extract color combination
  const ccMatch = html.match(/o_cc\d/);
  if (ccMatch) {
    options.colorCombination = ccMatch[0];
  }

  // Extract padding classes
  const ptMatch = html.match(/pt(\d+)/);
  const pbMatch = html.match(/pb(\d+)/);
  if (ptMatch) {
    const ptValue = parseInt(ptMatch[1]);
    const padding = PADDING_PRESETS.find((p) => p.topValue === `${ptValue}px`);
    if (padding) options.paddingTop = padding.id;
  }
  if (pbMatch) {
    const pbValue = parseInt(pbMatch[1]);
    const padding = PADDING_PRESETS.find((p) => p.bottomValue === `${pbValue}px`);
    if (padding) options.paddingBottom = padding.id;
  }

  // Extract alignment
  if (html.includes("text-center")) options.alignment = "center";
  else if (html.includes("text-end")) options.alignment = "right";
  else options.alignment = "left";

  return options;
}

/**
 * Get option by ID
 */
export function getColorCombination(id: string): ColorCombination | undefined {
  return COLOR_COMBINATIONS.find((c) => c.id === id);
}

export function getPaddingOption(id: string): PaddingOption | undefined {
  return PADDING_PRESETS.find((p) => p.id === id);
}

export function getWidthOption(id: string): WidthOption | undefined {
  return WIDTH_OPTIONS.find((w) => w.id === id);
}

export function getAlignmentOption(id: string): AlignmentOption | undefined {
  return ALIGNMENT_OPTIONS.find((a) => a.id === id);
}

export function getBackgroundOption(id: string): BackgroundOption | undefined {
  return BACKGROUND_PRESETS.find((b) => b.id === id);
}

export function getAnimationOption(id: string): AnimationOption | undefined {
  return ANIMATION_OPTIONS.find((a) => a.id === id);
}
