/**
 * ASCII Mockup Generator - Quick option visualization for Plan Mode.
 *
 * Feature #47: Create ASCII mockup generator for quick option visualization
 * Verification: Generates simple ASCII layout showing section arrangement
 *
 * Creates ASCII art representations of website layouts for quick visualization
 * during the planning phase before actual code generation.
 *
 * @module agentic-core/ascii-mockup
 */

// =============================================================================
// Types
// =============================================================================

/** Section type for ASCII mockup */
export type SectionType =
  | "header"
  | "hero"
  | "nav"
  | "content"
  | "sidebar"
  | "footer"
  | "image"
  | "text"
  | "cta"
  | "features"
  | "gallery"
  | "testimonials"
  | "pricing"
  | "contact"
  | "form"
  | "cards"
  | "video"
  | "banner"
  | "breadcrumb"
  | "search"
  | "custom";

/** Layout direction */
export type LayoutDirection = "horizontal" | "vertical";

/** Section definition for mockup */
export interface MockupSection {
  /** Section type */
  type: SectionType;
  /** Display label (optional, defaults to type name) */
  label?: string;
  /** Relative width (1-12 columns, like Bootstrap grid) */
  width?: number;
  /** Relative height (1-6 rows) */
  height?: number;
  /** Nested sections (for complex layouts) */
  children?: MockupSection[];
  /** Layout direction for children */
  childDirection?: LayoutDirection;
}

/** Mockup layout definition */
export interface MockupLayout {
  /** Layout name/title */
  name: string;
  /** Total width in characters */
  width?: number;
  /** Sections in the layout */
  sections: MockupSection[];
}

/** ASCII rendering options */
export interface MockupRenderOptions {
  /** Total width in characters (default: 60) */
  width?: number;
  /** Use box drawing characters (default: true) */
  useBoxChars?: boolean;
  /** Show section labels (default: true) */
  showLabels?: boolean;
  /** Padding inside sections (default: 1) */
  padding?: number;
  /** Show grid lines between sections (default: true) */
  showGrid?: boolean;
}

/** Generated mockup result */
export interface MockupResult {
  /** ASCII art representation */
  ascii: string;
  /** Layout metadata */
  layout: MockupLayout;
  /** Rendering options used */
  options: Required<MockupRenderOptions>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default rendering options */
const DEFAULT_OPTIONS: Required<MockupRenderOptions> = {
  width: 60,
  useBoxChars: true,
  showLabels: true,
  padding: 1,
  showGrid: true,
};

/** Box drawing characters (Unicode) */
const BOX_CHARS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  teeDown: "┬",
  teeUp: "┴",
  teeRight: "├",
  teeLeft: "┤",
  cross: "┼",
};

/** Simple ASCII characters (fallback) */
const ASCII_CHARS = {
  topLeft: "+",
  topRight: "+",
  bottomLeft: "+",
  bottomRight: "+",
  horizontal: "-",
  vertical: "|",
  teeDown: "+",
  teeUp: "+",
  teeRight: "+",
  teeLeft: "+",
  cross: "+",
};

/** Section type display labels */
const SECTION_LABELS: Record<SectionType, string> = {
  header: "HEADER",
  hero: "HERO",
  nav: "NAV",
  content: "CONTENT",
  sidebar: "SIDEBAR",
  footer: "FOOTER",
  image: "[IMG]",
  text: "Text...",
  cta: "[CTA]",
  features: "FEATURES",
  gallery: "GALLERY",
  testimonials: "QUOTES",
  pricing: "PRICING",
  contact: "CONTACT",
  form: "[FORM]",
  cards: "CARDS",
  video: "[VIDEO]",
  banner: "BANNER",
  breadcrumb: "> > >",
  search: "[SEARCH]",
  custom: "CUSTOM",
};

/** Default heights by section type (in rows) */
const DEFAULT_HEIGHTS: Record<SectionType, number> = {
  header: 2,
  hero: 4,
  nav: 1,
  content: 5,
  sidebar: 5,
  footer: 2,
  image: 3,
  text: 2,
  cta: 1,
  features: 4,
  gallery: 4,
  testimonials: 3,
  pricing: 4,
  contact: 3,
  form: 3,
  cards: 3,
  video: 3,
  banner: 2,
  breadcrumb: 1,
  search: 1,
  custom: 2,
};

// =============================================================================
// ASCII Rendering Functions
// =============================================================================

/**
 * Gets the appropriate character set based on options.
 */
function getChars(useBoxChars: boolean) {
  return useBoxChars ? BOX_CHARS : ASCII_CHARS;
}

/**
 * Creates a horizontal line with optional corners/junctions.
 */
function horizontalLine(
  width: number,
  chars: typeof BOX_CHARS,
  left: string,
  right: string
): string {
  return left + chars.horizontal.repeat(width - 2) + right;
}

/**
 * Centers text within a given width.
 */
function centerText(text: string, width: number): string {
  const textLen = text.length;
  if (textLen >= width) return text.slice(0, width);

  const leftPad = Math.floor((width - textLen) / 2);
  const rightPad = width - textLen - leftPad;
  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

/**
 * Creates a single section box.
 */
function renderSectionBox(
  section: MockupSection,
  width: number,
  height: number,
  options: Required<MockupRenderOptions>
): string[] {
  const chars = getChars(options.useBoxChars);
  const lines: string[] = [];

  const innerWidth = width - 2;
  const label = options.showLabels
    ? section.label || SECTION_LABELS[section.type]
    : "";

  // Top border
  lines.push(horizontalLine(width, chars, chars.topLeft, chars.topRight));

  // Content rows
  for (let row = 0; row < height - 2; row++) {
    let content: string;
    if (row === Math.floor((height - 2) / 2) && label) {
      content = centerText(label, innerWidth);
    } else {
      content = " ".repeat(innerWidth);
    }
    lines.push(chars.vertical + content + chars.vertical);
  }

  // Bottom border
  lines.push(horizontalLine(width, chars, chars.bottomLeft, chars.bottomRight));

  return lines;
}

/**
 * Merges multiple section renders horizontally.
 */
function mergeHorizontal(renders: string[][], options: Required<MockupRenderOptions>): string[] {
  if (renders.length === 0) return [];
  if (renders.length === 1) return renders[0];

  const chars = getChars(options.useBoxChars);
  const maxHeight = Math.max(...renders.map((r) => r.length));
  const result: string[] = [];

  for (let row = 0; row < maxHeight; row++) {
    let line = "";
    for (let i = 0; i < renders.length; i++) {
      const render = renders[i];
      const rowContent = row < render.length ? render[row] : " ".repeat(render[0]?.length || 0);

      if (i === 0) {
        line = rowContent;
      } else {
        // Merge adjacent borders
        const lastChar = line[line.length - 1];
        const firstChar = rowContent[0];

        // Handle border merging
        if (
          (lastChar === chars.vertical || lastChar === chars.topRight || lastChar === chars.bottomRight) &&
          (firstChar === chars.vertical || firstChar === chars.topLeft || firstChar === chars.bottomLeft)
        ) {
          // Merge vertical borders
          line = line.slice(0, -1);
          if (row === 0) {
            line += chars.teeDown + rowContent.slice(1);
          } else if (row === maxHeight - 1) {
            line += chars.teeUp + rowContent.slice(1);
          } else {
            line += chars.vertical + rowContent.slice(1);
          }
        } else {
          line += rowContent;
        }
      }
    }
    result.push(line);
  }

  return result;
}

/**
 * Merges multiple section renders vertically.
 */
function mergeVertical(renders: string[][], options: Required<MockupRenderOptions>): string[] {
  if (renders.length === 0) return [];
  if (renders.length === 1) return renders[0];

  const chars = getChars(options.useBoxChars);
  const result: string[] = [];

  for (let i = 0; i < renders.length; i++) {
    const render = renders[i];
    if (i === 0) {
      result.push(...render);
    } else {
      // Remove duplicate horizontal border between sections
      const prevLastLine = result[result.length - 1];
      const currentFirstLine = render[0];

      if (
        prevLastLine &&
        currentFirstLine &&
        prevLastLine[0] === chars.bottomLeft &&
        currentFirstLine[0] === chars.topLeft
      ) {
        // Replace both borders with a merged middle border
        const mergedLine = prevLastLine
          .replace(chars.bottomLeft, chars.teeRight)
          .replace(chars.bottomRight, chars.teeLeft);
        result[result.length - 1] = mergedLine;
        result.push(...render.slice(1));
      } else {
        result.push(...render);
      }
    }
  }

  return result;
}

/**
 * Calculates section dimensions based on layout.
 */
function calculateDimensions(
  sections: MockupSection[],
  totalWidth: number,
  direction: LayoutDirection
): Array<{ section: MockupSection; width: number; height: number }> {
  const results: Array<{ section: MockupSection; width: number; height: number }> = [];

  if (direction === "horizontal") {
    // Calculate widths based on column spans
    const totalCols = sections.reduce((sum, s) => sum + (s.width || 6), 0);
    let remainingWidth = totalWidth;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const cols = section.width || 6;
      const isLast = i === sections.length - 1;

      const width = isLast
        ? remainingWidth
        : Math.floor((cols / totalCols) * totalWidth);

      remainingWidth -= width;

      const height = (section.height || DEFAULT_HEIGHTS[section.type]) + 2; // +2 for borders

      results.push({ section, width: Math.max(width, 8), height });
    }
  } else {
    // Vertical: all sections take full width
    for (const section of sections) {
      const height = (section.height || DEFAULT_HEIGHTS[section.type]) + 2;
      results.push({ section, width: totalWidth, height });
    }
  }

  return results;
}

/**
 * Renders a mockup section (recursively handles children).
 */
function renderSection(
  section: MockupSection,
  width: number,
  height: number,
  options: Required<MockupRenderOptions>
): string[] {
  // If section has children, render them instead
  if (section.children && section.children.length > 0) {
    const direction = section.childDirection || "vertical";
    const dims = calculateDimensions(section.children, width, direction);

    const childRenders = dims.map((d) =>
      renderSection(d.section, d.width, d.height, options)
    );

    if (direction === "horizontal") {
      return mergeHorizontal(childRenders, options);
    } else {
      return mergeVertical(childRenders, options);
    }
  }

  // Render leaf section
  return renderSectionBox(section, width, height, options);
}

// =============================================================================
// Main Generator Class
// =============================================================================

/**
 * ASCII Mockup Generator.
 *
 * Creates simple ASCII art representations of website layouts.
 *
 * @example
 * ```typescript
 * const generator = new AsciiMockup();
 *
 * // Simple layout
 * const result = generator.render({
 *   name: "Landing Page",
 *   sections: [
 *     { type: "header" },
 *     { type: "hero" },
 *     { type: "features" },
 *     { type: "footer" }
 *   ]
 * });
 *
 * console.log(result.ascii);
 *
 * // Complex layout with columns
 * const complex = generator.render({
 *   name: "Blog Layout",
 *   sections: [
 *     { type: "header" },
 *     {
 *       type: "content",
 *       children: [
 *         { type: "content", width: 8 },
 *         { type: "sidebar", width: 4 }
 *       ],
 *       childDirection: "horizontal"
 *     },
 *     { type: "footer" }
 *   ]
 * });
 * ```
 */
export class AsciiMockup {
  private options: Required<MockupRenderOptions>;

  constructor(options: MockupRenderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Renders a mockup layout to ASCII art.
   */
  render(layout: MockupLayout, options?: MockupRenderOptions): MockupResult {
    const opts = { ...this.options, ...options };
    const width = layout.width || opts.width;

    // Calculate dimensions for all sections
    const dims = calculateDimensions(layout.sections, width, "vertical");

    // Render each section
    const renders = dims.map((d) => renderSection(d.section, d.width, d.height, opts));

    // Merge vertically
    const merged = mergeVertical(renders, opts);

    // Add title if present
    const lines: string[] = [];
    if (layout.name) {
      const chars = getChars(opts.useBoxChars);
      const titleLine = ` ${layout.name} `;
      const paddedTitle = centerText(titleLine, width);
      lines.push("");
      lines.push(paddedTitle);
      lines.push(chars.horizontal.repeat(width));
    }

    lines.push(...merged);

    return {
      ascii: lines.join("\n"),
      layout,
      options: opts,
    };
  }

  /**
   * Creates a quick mockup from section types.
   */
  quick(name: string, ...types: SectionType[]): MockupResult {
    return this.render({
      name,
      sections: types.map((type) => ({ type })),
    });
  }

  /**
   * Sets default options.
   */
  setOptions(options: Partial<MockupRenderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Gets current options.
   */
  getOptions(): Required<MockupRenderOptions> {
    return { ...this.options };
  }
}

// =============================================================================
// Preset Layouts
// =============================================================================

/** Common website layout presets */
export const LAYOUT_PRESETS: Record<string, MockupLayout> = {
  landing: {
    name: "Landing Page",
    sections: [
      { type: "header" },
      { type: "hero", height: 5 },
      { type: "features" },
      { type: "testimonials" },
      { type: "cta" },
      { type: "footer" },
    ],
  },

  blog: {
    name: "Blog Layout",
    sections: [
      { type: "header" },
      { type: "nav" },
      {
        type: "content",
        height: 8,
        children: [
          { type: "content", width: 8, label: "POSTS" },
          { type: "sidebar", width: 4 },
        ],
        childDirection: "horizontal",
      },
      { type: "footer" },
    ],
  },

  ecommerce: {
    name: "E-commerce",
    sections: [
      { type: "header" },
      { type: "nav" },
      { type: "banner" },
      { type: "cards", height: 4, label: "PRODUCTS" },
      { type: "features", label: "WHY US" },
      { type: "footer" },
    ],
  },

  portfolio: {
    name: "Portfolio",
    sections: [
      { type: "header" },
      { type: "hero", label: "ABOUT ME" },
      { type: "gallery", height: 5, label: "WORK" },
      { type: "contact" },
      { type: "footer" },
    ],
  },

  documentation: {
    name: "Documentation",
    sections: [
      { type: "header" },
      { type: "search" },
      {
        type: "content",
        height: 10,
        children: [
          { type: "sidebar", width: 3, label: "TOC" },
          { type: "content", width: 9, label: "DOCS" },
        ],
        childDirection: "horizontal",
      },
      { type: "footer" },
    ],
  },

  pricing: {
    name: "Pricing Page",
    sections: [
      { type: "header" },
      { type: "hero", height: 2, label: "PRICING" },
      { type: "pricing", height: 6 },
      { type: "features", label: "COMPARE" },
      { type: "cta" },
      { type: "footer" },
    ],
  },
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an ASCII mockup generator.
 */
export function createAsciiMockup(options?: MockupRenderOptions): AsciiMockup {
  return new AsciiMockup(options);
}

/**
 * Quick render a layout preset.
 */
export function renderPreset(
  presetName: keyof typeof LAYOUT_PRESETS,
  options?: MockupRenderOptions
): MockupResult {
  const mockup = new AsciiMockup(options);
  const preset = LAYOUT_PRESETS[presetName];

  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  return mockup.render(preset);
}

/**
 * Quick render from section types.
 */
export function quickMockup(
  name: string,
  types: SectionType[],
  options?: MockupRenderOptions
): MockupResult {
  const mockup = new AsciiMockup(options);
  return mockup.quick(name, ...types);
}

/**
 * Render multiple layout options for comparison.
 */
export function compareLayouts(
  layouts: MockupLayout[],
  options?: MockupRenderOptions
): string {
  const mockup = new AsciiMockup({ ...options, width: 40 });
  const renders = layouts.map((layout) => mockup.render(layout));

  const lines: string[] = [];
  const maxHeight = Math.max(...renders.map((r) => r.ascii.split("\n").length));

  // Side by side comparison
  const allLines: string[][] = renders.map((r) => r.ascii.split("\n"));

  for (let i = 0; i < maxHeight; i++) {
    const row = allLines.map((lines) => (lines[i] || "").padEnd(42)).join("  ");
    lines.push(row);
  }

  return lines.join("\n");
}

// =============================================================================
// Export
// =============================================================================

export default AsciiMockup;
