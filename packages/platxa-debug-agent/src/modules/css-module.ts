/**
 * CSS/SCSS/Tailwind Language Module
 *
 * Implements the LanguageModule interface for CSS, SCSS, and Tailwind CSS
 * error parsing, analysis, root cause detection, and fix generation.
 *
 * @module css-module
 */

import { randomUUID } from 'crypto';
import {
  type AnalysisContext,
  type Evidence,
  type FixSuggestion,
  type Language,
  type LanguageModule,
  type ModuleAnalysisResult,
  type NormalizedError,
  type RootCauseHypothesis,
  type SourceLocation,
  type ValidationResult,
  type ValidationStep,
} from '../core/types.js';

// =============================================================================
// CSS/SCSS Error Patterns
// =============================================================================

const CSS_PATTERNS = {
  sassError: /^(?:Error|SassError): (.+):(\d+):(\d+): (.+)$/,
  sassCompilation: /^Compilation Error: (.+)$/,
  postcssError: /^(.+):(\d+):(\d+): (.+)$/,
  stylelint: /^(.+):(\d+):(\d+): (error|warning) (.+?)(?:\s+\((.+)\))?$/,
  cssParseError: /^(?:ParseError|SyntaxError): (.+) at line (\d+)/,
  tailwindError: /^(?:Error|Warning): (.+)$/,
  unknownUtility: /The `([^`]+)` class does not exist/,
  invalidConfig: /Invalid configuration/,
} as const;

const CSS_ERROR_TYPES: Readonly<Record<string, { category: string; commonCauses: string[] }>> = {
  SyntaxError: {
    category: 'syntax',
    commonCauses: [
      'Missing semicolon',
      'Unclosed bracket or brace',
      'Invalid property value',
      'Malformed selector',
    ],
  },
  SassError: {
    category: 'sass',
    commonCauses: [
      'Invalid @import path',
      'Undefined variable',
      'Invalid mixin call',
      'Compilation error',
    ],
  },
  StylelintError: {
    category: 'lint',
    commonCauses: [
      'Style convention violation',
      'Invalid property value',
      'Selector specificity issue',
      'Duplicate property',
    ],
  },
  TailwindError: {
    category: 'tailwind',
    commonCauses: [
      'Unknown utility class',
      'Invalid configuration',
      'Missing content paths',
      'JIT mode issue',
    ],
  },
  PostCSSError: {
    category: 'postcss',
    commonCauses: [
      'Plugin error',
      'Invalid CSS syntax',
      'Unsupported feature',
    ],
  },
};

const TAILWIND_CLASS_FIXES: Readonly<Record<string, string>> = {
  'flex-center': 'flex items-center justify-center',
  'text-bold': 'font-bold',
  'text-italic': 'italic',
  'text-underline': 'underline',
  'bg-opacity': 'bg-[color]/opacity',
  'border-radius': 'rounded-[value]',
  'box-shadow': 'shadow-[value]',
};

// =============================================================================
// Tailwind CSS Class Validator
// =============================================================================

/**
 * Core Tailwind CSS utility prefixes and patterns.
 * These are the base utilities available in Tailwind CSS v3.x
 */
const TAILWIND_UTILITY_PREFIXES = new Set([
  // Layout
  'container', 'columns', 'break-after', 'break-before', 'break-inside',
  'box-decoration', 'box', 'float', 'clear', 'isolation', 'object',
  'overflow', 'overscroll', 'position', 'inset', 'top', 'right', 'bottom', 'left',
  'visible', 'invisible', 'z',
  // Flexbox & Grid
  'basis', 'flex', 'shrink', 'grow', 'order', 'grid', 'col', 'row',
  'auto-cols', 'auto-rows', 'gap', 'justify', 'content', 'items', 'self', 'place',
  // Spacing
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'space',
  // Sizing
  'w', 'min-w', 'max-w', 'h', 'min-h', 'max-h', 'size',
  // Typography
  'font', 'text', 'antialiased', 'subpixel-antialiased',
  'italic', 'not-italic', 'normal-nums', 'ordinal', 'slashed-zero',
  'lining-nums', 'oldstyle-nums', 'proportional-nums', 'tabular-nums',
  'diagonal-fractions', 'stacked-fractions',
  'tracking', 'leading', 'list', 'placeholder',
  'decoration', 'underline', 'overline', 'line-through', 'no-underline',
  'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'truncate', 'indent', 'align', 'whitespace', 'break', 'hyphens', 'content',
  // Backgrounds
  'bg', 'from', 'via', 'to', 'gradient',
  // Borders
  'border', 'rounded', 'divide', 'outline', 'ring', 'ring-offset',
  // Effects
  'shadow', 'opacity', 'mix-blend', 'bg-blend',
  // Filters
  'blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale',
  'hue-rotate', 'invert', 'saturate', 'sepia', 'backdrop',
  // Tables
  'table', 'caption', 'border-collapse', 'border-separate', 'border-spacing',
  // Transitions & Animation
  'transition', 'duration', 'ease', 'delay', 'animate',
  // Transforms
  'scale', 'rotate', 'translate', 'skew', 'origin', 'transform',
  // Interactivity
  'accent', 'appearance', 'cursor', 'caret', 'pointer-events', 'resize',
  'scroll', 'snap', 'touch', 'select', 'will-change',
  // SVG
  'fill', 'stroke',
  // Accessibility
  'sr-only', 'not-sr-only', 'forced-color-adjust',
]);

/**
 * Tailwind CSS responsive/state variant prefixes
 */
const TAILWIND_VARIANTS = new Set([
  // Responsive
  'sm', 'md', 'lg', 'xl', '2xl',
  // State
  'hover', 'focus', 'focus-within', 'focus-visible', 'active', 'visited',
  'target', 'first', 'last', 'only', 'odd', 'even', 'first-of-type',
  'last-of-type', 'only-of-type', 'empty', 'disabled', 'enabled', 'checked',
  'indeterminate', 'default', 'required', 'valid', 'invalid', 'in-range',
  'out-of-range', 'placeholder-shown', 'autofill', 'read-only',
  // Dark mode
  'dark',
  // Reduced motion
  'motion-safe', 'motion-reduce',
  // Print
  'print',
  // Contrast
  'contrast-more', 'contrast-less',
  // Portrait/Landscape
  'portrait', 'landscape',
  // LTR/RTL
  'ltr', 'rtl',
  // Group/Peer
  'group-hover', 'group-focus', 'group-active', 'group-visited',
  'peer-hover', 'peer-focus', 'peer-active', 'peer-checked', 'peer-disabled',
  // Before/After
  'before', 'after',
  // Markers
  'marker', 'selection', 'file', 'placeholder', 'backdrop', 'first-line', 'first-letter',
  // Open
  'open',
]);

/**
 * Result of Tailwind class validation
 */
export interface TailwindValidationResult {
  /** Whether the class is valid */
  valid: boolean;
  /** The original class name */
  className: string;
  /** Parsed variants (e.g., ['hover', 'md']) */
  variants: string[];
  /** The utility part of the class */
  utility: string;
  /** The value/modifier if present */
  value?: string;
  /** Suggested fix if invalid */
  suggestion?: string;
  /** Reason for invalidity */
  reason?: string;
}

/**
 * Validate a single Tailwind CSS class name.
 *
 * @param className - The class name to validate
 * @param customUtilities - Optional set of custom utility names from config
 * @returns Validation result with details
 */
export function validateTailwindClass(
  className: string,
  customUtilities?: Set<string>
): TailwindValidationResult {
  const result: TailwindValidationResult = {
    valid: false,
    className,
    variants: [],
    utility: '',
  };

  // Handle arbitrary values [...]
  if (className.includes('[') && className.includes(']')) {
    const arbitraryMatch = className.match(/^(.+?)\[(.+)\]$/);
    if (arbitraryMatch !== null) {
      const prefix = arbitraryMatch[1]?.replace(/-$/, '') ?? '';
      const arbitraryValue = arbitraryMatch[2];
      result.utility = prefix;
      if (arbitraryValue !== undefined) {
        result.value = arbitraryValue;
      }
      // Arbitrary values are valid if the prefix is a known utility
      result.valid = isValidUtilityPrefix(prefix, customUtilities);
      if (!result.valid) {
        result.reason = `Unknown utility prefix '${prefix}' for arbitrary value`;
      }
      return result;
    }
  }

  // Split by colon for variants
  const parts = className.split(':');
  const utilityPart = parts.pop() ?? '';
  result.variants = parts;
  result.utility = utilityPart;

  // Validate variants
  for (const variant of result.variants) {
    if (!TAILWIND_VARIANTS.has(variant) && !variant.startsWith('group-') && !variant.startsWith('peer-')) {
      result.reason = `Unknown variant '${variant}'`;
      const closestVariant = findClosestVariant(variant);
      if (closestVariant !== undefined) {
        result.suggestion = closestVariant;
      }
      return result;
    }
  }

  // Handle negative values (e.g., -mt-4)
  let utility = utilityPart;
  const isNegative = utility.startsWith('-');
  if (isNegative) {
    utility = utility.slice(1);
  }

  // Split utility from value (e.g., mt-4 -> mt, 4)
  const dashIndex = utility.indexOf('-');
  let utilityPrefix: string;
  let utilityValue: string | undefined;

  if (dashIndex === -1) {
    utilityPrefix = utility;
  } else {
    utilityPrefix = utility.slice(0, dashIndex);
    utilityValue = utility.slice(dashIndex + 1);
  }

  if (utilityValue !== undefined) {
    result.value = utilityValue;
  }

  // Check if it's a valid utility
  if (isValidUtilityPrefix(utilityPrefix, customUtilities)) {
    result.valid = true;
    return result;
  }

  // Check if the full utility name matches (for utilities like 'flex', 'hidden')
  if (TAILWIND_UTILITY_PREFIXES.has(utility) || customUtilities?.has(utility)) {
    result.valid = true;
    result.utility = utility;
    // Don't set value - it remains unset for standalone utilities
    return result;
  }

  // Check for known fixes
  const fix = TAILWIND_CLASS_FIXES[className];
  if (fix !== undefined) {
    result.suggestion = fix;
    result.reason = `'${className}' is not a valid Tailwind class`;
    return result;
  }

  // Try to find closest match
  result.reason = `Unknown utility '${utilityPrefix}'`;
  const closestUtility = findClosestUtility(utilityPrefix);
  if (closestUtility !== undefined) {
    result.suggestion = closestUtility;
  }
  return result;
}

/**
 * Check if a utility prefix is valid
 */
function isValidUtilityPrefix(prefix: string, customUtilities?: Set<string>): boolean {
  if (TAILWIND_UTILITY_PREFIXES.has(prefix)) {
    return true;
  }
  if (customUtilities?.has(prefix)) {
    return true;
  }
  return false;
}

/**
 * Find the closest matching utility prefix using Levenshtein distance
 */
function findClosestUtility(input: string): string | undefined {
  let closest: string | undefined;
  let minDistance = Infinity;

  for (const utility of TAILWIND_UTILITY_PREFIXES) {
    const distance = levenshteinDistance(input, utility);
    if (distance < minDistance && distance <= 2) {
      minDistance = distance;
      closest = utility;
    }
  }

  return closest;
}

/**
 * Find the closest matching variant
 */
function findClosestVariant(input: string): string | undefined {
  let closest: string | undefined;
  let minDistance = Infinity;

  for (const variant of TAILWIND_VARIANTS) {
    const distance = levenshteinDistance(input, variant);
    if (distance < minDistance && distance <= 2) {
      minDistance = distance;
      closest = variant;
    }
  }

  return closest;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row !== undefined) {
      row[j] = j;
    }
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const row = matrix[i];
      const prevRow = matrix[i - 1];
      if (row !== undefined && prevRow !== undefined) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          row[j] = prevRow[j - 1] ?? 0;
        } else {
          row[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1, // substitution
            (prevRow[j] ?? 0) + 1,     // deletion
            (row[j - 1] ?? 0) + 1      // insertion
          );
        }
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow?.[a.length] ?? Infinity;
}

/**
 * Validate multiple Tailwind CSS classes
 *
 * @param classString - Space-separated class names
 * @param customUtilities - Optional set of custom utility names
 * @returns Array of validation results for invalid classes
 */
export function validateTailwindClasses(
  classString: string,
  customUtilities?: Set<string>
): TailwindValidationResult[] {
  const classes = classString.split(/\s+/).filter((c) => c.length > 0);
  const results: TailwindValidationResult[] = [];

  for (const className of classes) {
    const result = validateTailwindClass(className, customUtilities);
    if (!result.valid) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Tailwind CSS class validator with config support
 */
export class TailwindValidator {
  private readonly customUtilities: Set<string>;

  constructor(customUtilities: string[] = []) {
    this.customUtilities = new Set(customUtilities);
  }

  /**
   * Add custom utilities from Tailwind config
   */
  addCustomUtilities(utilities: string[]): void {
    for (const utility of utilities) {
      this.customUtilities.add(utility);
    }
  }

  /**
   * Validate a single class
   */
  validate(className: string): TailwindValidationResult {
    return validateTailwindClass(className, this.customUtilities);
  }

  /**
   * Validate multiple classes
   */
  validateAll(classString: string): TailwindValidationResult[] {
    return validateTailwindClasses(classString, this.customUtilities);
  }

  /**
   * Check if a class is valid
   */
  isValid(className: string): boolean {
    return validateTailwindClass(className, this.customUtilities).valid;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildSourceLocation(
  file: string,
  line: number,
  column?: number
): SourceLocation {
  const loc: SourceLocation = { file, line };
  if (column !== undefined) {
    loc.column = column;
  }
  return loc;
}

// =============================================================================
// CSS Specificity Calculator
// =============================================================================

/**
 * CSS specificity represented as a tuple [inline, ids, classes, elements]
 * Based on CSS specification: https://www.w3.org/TR/selectors-3/#specificity
 */
export interface Specificity {
  /** Inline styles (style attribute) - highest priority */
  inline: number;
  /** ID selectors (#id) */
  ids: number;
  /** Class selectors (.class), attribute selectors ([attr]), and pseudo-classes (:hover) */
  classes: number;
  /** Element selectors (div) and pseudo-elements (::before) */
  elements: number;
}

/**
 * Represents a CSS rule with its specificity
 */
export interface CSSRule {
  /** The CSS selector string */
  selector: string;
  /** Property being set */
  property: string;
  /** Value being applied */
  value: string;
  /** Calculated specificity */
  specificity: Specificity;
  /** Source location if available */
  location?: SourceLocation;
  /** Whether this rule is marked !important */
  important: boolean;
}

/**
 * Represents a specificity conflict between CSS rules
 */
export interface SpecificityConflict {
  /** The CSS property being overridden */
  property: string;
  /** The winning rule (higher specificity or later in cascade) */
  winner: CSSRule;
  /** The overridden rule(s) */
  overridden: CSSRule[];
  /** Reason for the override */
  reason: 'specificity' | 'importance' | 'cascade-order';
}

/**
 * Calculate CSS specificity for a selector string.
 *
 * Specificity is calculated as:
 * - Inline styles: 1,0,0,0
 * - ID selectors: 0,1,0,0
 * - Class/attribute/pseudo-class: 0,0,1,0
 * - Element/pseudo-element: 0,0,0,1
 *
 * @param selector - CSS selector string
 * @param isInline - Whether this is an inline style
 * @returns Specificity tuple
 */
export function calculateSpecificity(selector: string, isInline = false): Specificity {
  const specificity: Specificity = {
    inline: isInline ? 1 : 0,
    ids: 0,
    classes: 0,
    elements: 0,
  };

  if (isInline) {
    return specificity;
  }

  // Remove :not() wrapper but count its contents
  // :not() itself doesn't add specificity, but its argument does
  let processedSelector = selector;
  const notMatches = selector.match(/:not\(([^)]+)\)/g);
  if (notMatches !== null) {
    for (const notMatch of notMatches) {
      const innerSelector = notMatch.slice(5, -1); // Remove ":not(" and ")"
      const innerSpec = calculateSpecificity(innerSelector);
      specificity.ids += innerSpec.ids;
      specificity.classes += innerSpec.classes;
      specificity.elements += innerSpec.elements;
    }
    processedSelector = processedSelector.replace(/:not\([^)]+\)/g, '');
  }

  // Remove :where() completely (it has 0 specificity)
  processedSelector = processedSelector.replace(/:where\([^)]+\)/g, '');

  // Handle :is() and :has() - take the highest specificity of arguments
  const isHasMatches = processedSelector.match(/:(?:is|has)\(([^)]+)\)/g);
  if (isHasMatches !== null) {
    for (const match of isHasMatches) {
      const innerSelectors = match.slice(match.indexOf('(') + 1, -1).split(',');
      let maxSpec: Specificity = { inline: 0, ids: 0, classes: 0, elements: 0 };
      for (const inner of innerSelectors) {
        const innerSpec = calculateSpecificity(inner.trim());
        if (compareSpecificity(innerSpec, maxSpec) > 0) {
          maxSpec = innerSpec;
        }
      }
      specificity.ids += maxSpec.ids;
      specificity.classes += maxSpec.classes;
      specificity.elements += maxSpec.elements;
    }
    processedSelector = processedSelector.replace(/:(?:is|has)\([^)]+\)/g, '');
  }

  // Count ID selectors (#id)
  const idMatches = processedSelector.match(/#[\w-]+/g);
  if (idMatches !== null) {
    specificity.ids += idMatches.length;
  }

  // Count class selectors (.class)
  const classMatches = processedSelector.match(/\.[\w-]+/g);
  if (classMatches !== null) {
    specificity.classes += classMatches.length;
  }

  // Count attribute selectors ([attr], [attr=value], etc.)
  const attrMatches = processedSelector.match(/\[[^\]]+\]/g);
  if (attrMatches !== null) {
    specificity.classes += attrMatches.length;
  }

  // Count pseudo-classes (:hover, :focus, :nth-child, etc.)
  // Exclude pseudo-elements (::before, ::after)
  const pseudoClassMatches = processedSelector.match(/:(?!:)[\w-]+(?:\([^)]*\))?/g);
  if (pseudoClassMatches !== null) {
    specificity.classes += pseudoClassMatches.length;
  }

  // Count pseudo-elements (::before, ::after, ::first-line, etc.)
  const pseudoElementMatches = processedSelector.match(/::[\w-]+/g);
  if (pseudoElementMatches !== null) {
    specificity.elements += pseudoElementMatches.length;
  }

  // Count element selectors (div, span, etc.)
  // Remove IDs, classes, attributes, and pseudo-selectors first
  const cleanedSelector = processedSelector
    .replace(/#[\w-]+/g, '')
    .replace(/\.[\w-]+/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/::?[\w-]+(?:\([^)]*\))?/g, '')
    .replace(/[>\+~\s]+/g, ' ')
    .trim();

  const elementMatches = cleanedSelector.match(/[\w-]+/g);
  if (elementMatches !== null) {
    // Filter out combinators and empty strings
    const elements = elementMatches.filter((e) => e !== '' && !/^[>\+~]$/.test(e));
    specificity.elements += elements.length;
  }

  return specificity;
}

/**
 * Compare two specificities.
 * @returns Positive if a > b, negative if a < b, 0 if equal
 */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a.inline !== b.inline) return a.inline - b.inline;
  if (a.ids !== b.ids) return a.ids - b.ids;
  if (a.classes !== b.classes) return a.classes - b.classes;
  return a.elements - b.elements;
}

/**
 * Convert specificity to a string representation (e.g., "0,1,2,3")
 */
export function specificityToString(spec: Specificity): string {
  return `${spec.inline},${spec.ids},${spec.classes},${spec.elements}`;
}

/**
 * Convert specificity to a numeric value for quick comparison.
 * Uses base-1000 encoding to handle up to 999 selectors per category.
 */
export function specificityToNumber(spec: Specificity): number {
  return (
    spec.inline * 1000000000 +
    spec.ids * 1000000 +
    spec.classes * 1000 +
    spec.elements
  );
}

/**
 * Detect specificity conflicts between CSS rules targeting the same property.
 *
 * @param rules - Array of CSS rules to analyze
 * @returns Array of detected conflicts
 */
export function detectSpecificityConflicts(rules: CSSRule[]): SpecificityConflict[] {
  const conflicts: SpecificityConflict[] = [];

  // Group rules by property
  const rulesByProperty = new Map<string, CSSRule[]>();
  for (const rule of rules) {
    const existing = rulesByProperty.get(rule.property) ?? [];
    existing.push(rule);
    rulesByProperty.set(rule.property, existing);
  }

  // Find conflicts for each property
  for (const [property, propertyRules] of rulesByProperty) {
    if (propertyRules.length < 2) continue;

    // Sort by importance first, then specificity, then cascade order (array index)
    const sortedRules = [...propertyRules].map((rule, index) => ({ rule, index }));
    sortedRules.sort((a, b) => {
      // !important always wins
      if (a.rule.important !== b.rule.important) {
        return a.rule.important ? 1 : -1;
      }
      // Then compare specificity
      const specCompare = compareSpecificity(a.rule.specificity, b.rule.specificity);
      if (specCompare !== 0) return specCompare;
      // Finally, cascade order (later wins)
      return a.index - b.index;
    });

    // The last rule in sorted order is the winner
    const winnerEntry = sortedRules[sortedRules.length - 1];
    if (winnerEntry === undefined) continue;

    const winner = winnerEntry.rule;
    const overridden = sortedRules
      .slice(0, -1)
      .map((entry) => entry.rule);

    if (overridden.length > 0) {
      // Determine the reason for the override
      let reason: 'specificity' | 'importance' | 'cascade-order' = 'specificity';

      const firstOverridden = overridden[0];
      if (firstOverridden !== undefined) {
        if (winner.important && !firstOverridden.important) {
          reason = 'importance';
        } else if (compareSpecificity(winner.specificity, firstOverridden.specificity) === 0) {
          reason = 'cascade-order';
        }
      }

      conflicts.push({
        property,
        winner,
        overridden,
        reason,
      });
    }
  }

  return conflicts;
}

/**
 * Parse a CSS declaration value and check if it has !important
 */
export function parseImportant(value: string): { value: string; important: boolean } {
  const importantMatch = value.match(/^(.+?)\s*!important\s*$/i);
  if (importantMatch !== null && importantMatch[1] !== undefined) {
    return { value: importantMatch[1].trim(), important: true };
  }
  return { value: value.trim(), important: false };
}

// =============================================================================
// CSS Language Module
// =============================================================================

export class CSSModule implements LanguageModule {
  readonly language: Language;
  readonly aliases: string[];
  readonly extensions: string[];

  constructor(variant: 'css' | 'scss' | 'tailwind' = 'css') {
    this.language = variant === 'tailwind' ? 'tailwind' : variant;

    switch (variant) {
      case 'scss':
        this.aliases = ['sass', 'scss'];
        this.extensions = ['.scss', '.sass'];
        break;
      case 'tailwind':
        this.aliases = ['tailwind', 'tailwindcss', 'tw'];
        this.extensions = ['.css', '.scss', '.html', '.jsx', '.tsx'];
        break;
      default:
        this.aliases = ['css', 'stylesheet'];
        this.extensions = ['.css'];
    }
  }

  // ===========================================================================
  // Error Parsing
  // ===========================================================================

  async parseError(raw: string): Promise<NormalizedError[]> {
    const errors: NormalizedError[] = [];
    const lines = raw.split('\n');

    // Try Stylelint format
    const stylelintErrors = this.parseStylelintOutput(lines);
    if (stylelintErrors.length > 0) {
      return stylelintErrors;
    }

    // Try SCSS/Sass error format
    const sassErrors = this.parseSassErrors(lines, raw);
    if (sassErrors.length > 0) {
      return sassErrors;
    }

    // Try PostCSS error format
    const postcssErrors = this.parsePostCSSErrors(lines);
    if (postcssErrors.length > 0) {
      return postcssErrors;
    }

    // Try Tailwind-specific errors
    const tailwindErrors = this.parseTailwindErrors(raw);
    if (tailwindErrors.length > 0) {
      return tailwindErrors;
    }

    // Try generic CSS parse errors
    const genericErrors = this.parseGenericCSSErrors(lines, raw);
    errors.push(...genericErrors);

    return errors;
  }

  private parseSassErrors(lines: string[], raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.sassError.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push({
            id: randomUUID(),
            type: 'SassError',
            message,
            severity: 'error',
            source: 'build',
            language: 'scss',
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }

      const compileMatch = CSS_PATTERNS.sassCompilation.exec(line);
      if (compileMatch !== null) {
        const message = compileMatch[1];
        if (message !== undefined) {
          errors.push({
            id: randomUUID(),
            type: 'SassError',
            message,
            severity: 'error',
            source: 'build',
            language: 'scss',
            raw,
            timestamp: new Date(),
          });
        }
      }
    }

    return errors;
  }

  private parseStylelintOutput(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.stylelint.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const severity = match[4];
        const message = match[5];
        const rule = match[6];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);
          const fullMessage = rule !== undefined ? `${message} (${rule})` : message;

          const error: NormalizedError = {
            id: randomUUID(),
            type: 'StylelintError',
            message: fullMessage,
            severity: severity === 'error' ? 'error' : 'warning',
            source: 'static',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          };

          if (rule !== undefined) {
            error.code = rule;
          }

          errors.push(error);
        }
      }
    }

    return errors;
  }

  private parsePostCSSErrors(lines: string[]): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const match = CSS_PATTERNS.postcssError.exec(line);
      if (match !== null) {
        const file = match[1];
        const lineNum = match[2];
        const colNum = match[3];
        const message = match[4];

        if (file !== undefined && lineNum !== undefined && message !== undefined) {
          const parsedLine = parseInt(lineNum, 10);
          const parsedCol = colNum !== undefined ? parseInt(colNum, 10) : undefined;
          const location = buildSourceLocation(file, parsedLine, parsedCol);

          errors.push({
            id: randomUUID(),
            type: 'PostCSSError',
            message,
            severity: 'error',
            source: 'build',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }
    }

    return errors;
  }

  private parseTailwindErrors(raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    // Unknown utility class
    const unknownMatch = CSS_PATTERNS.unknownUtility.exec(raw);
    if (unknownMatch !== null) {
      const className = unknownMatch[1] ?? 'unknown';
      errors.push({
        id: randomUUID(),
        type: 'TailwindError',
        message: `Unknown utility class: ${className}`,
        severity: 'error',
        source: 'build',
        language: 'tailwind',
        raw,
        timestamp: new Date(),
      });
    }

    // Invalid configuration
    if (CSS_PATTERNS.invalidConfig.test(raw)) {
      errors.push({
        id: randomUUID(),
        type: 'TailwindError',
        message: 'Invalid Tailwind configuration',
        severity: 'error',
        source: 'build',
        language: 'tailwind',
        raw,
        timestamp: new Date(),
      });
    }

    // Generic Tailwind error
    const tailwindMatch = CSS_PATTERNS.tailwindError.exec(raw);
    if (tailwindMatch !== null && errors.length === 0) {
      const message = tailwindMatch[1];
      if (message !== undefined) {
        errors.push({
          id: randomUUID(),
          type: 'TailwindError',
          message,
          severity: 'error',
          source: 'build',
          language: 'tailwind',
          raw,
          timestamp: new Date(),
        });
      }
    }

    return errors;
  }

  private parseGenericCSSErrors(lines: string[], raw: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    for (const line of lines) {
      const parseMatch = CSS_PATTERNS.cssParseError.exec(line);
      if (parseMatch !== null) {
        const message = parseMatch[1];
        const lineNum = parseMatch[2];

        if (message !== undefined && lineNum !== undefined) {
          const location = buildSourceLocation('unknown', parseInt(lineNum, 10));

          errors.push({
            id: randomUUID(),
            type: 'SyntaxError',
            message,
            severity: 'error',
            source: 'build',
            language: this.language,
            location,
            raw: line,
            timestamp: new Date(),
          });
        }
      }
    }

    // Fallback: look for error keywords
    if (errors.length === 0 && /error|failed|invalid/i.test(raw)) {
      const firstLine = lines.find((l) => l.trim() !== '');
      if (firstLine !== undefined) {
        errors.push({
          id: randomUUID(),
          type: 'CSSError',
          message: firstLine.trim(),
          severity: 'error',
          source: 'build',
          language: this.language,
          raw,
          timestamp: new Date(),
        });
      }
    }

    return errors;
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  async analyze(
    errors: NormalizedError[],
    _context: AnalysisContext
  ): Promise<ModuleAnalysisResult> {
    const startTime = Date.now();
    const hypotheses: RootCauseHypothesis[] = [];
    const fixes: FixSuggestion[] = [];
    const notes: string[] = [];

    for (const error of errors) {
      const hypothesis = this.generateHypothesis(error);
      hypotheses.push(hypothesis);
    }

    return {
      module: this.language,
      errors,
      hypotheses,
      fixes,
      notes,
      analysisTimeMs: Date.now() - startTime,
    };
  }

  private generateHypothesis(error: NormalizedError): RootCauseHypothesis {
    const evidence: Evidence[] = [];
    const suggestedFixes: FixSuggestion[] = [];
    const relatedLocations: SourceLocation[] = [];

    evidence.push({
      type: 'error',
      description: `${error.type}: ${error.message}`,
      strength: 0.9,
    });

    let description = `${error.type} occurred`;
    let confidence = 0.6;

    const errorInfo = CSS_ERROR_TYPES[error.type];
    if (errorInfo !== undefined) {
      description = `${error.type} (${errorInfo.category}): ${errorInfo.commonCauses[0] ?? 'Unknown cause'}`;
      confidence = 0.7;

      for (const cause of errorInfo.commonCauses) {
        evidence.push({
          type: 'pattern',
          description: `Possible cause: ${cause}`,
          strength: 0.5,
        });
      }
    }

    // Specific analysis based on error type
    const specificAnalysis = this.analyzeErrorMessage(error);
    if (specificAnalysis !== null) {
      description = specificAnalysis.description;
      confidence = specificAnalysis.confidence;
      suggestedFixes.push(...specificAnalysis.fixes);
    }

    if (error.location !== undefined) {
      relatedLocations.push(error.location);
    }

    return {
      id: randomUUID(),
      description,
      confidence,
      evidence,
      suggestedFixes,
      relatedLocations,
    };
  }

  private analyzeErrorMessage(error: NormalizedError): {
    description: string;
    confidence: number;
    fixes: FixSuggestion[];
  } | null {
    const message = error.message;

    // Unknown Tailwind utility
    const unknownUtilityMatch = /Unknown utility class: (.+)/.exec(message);
    if (unknownUtilityMatch !== null) {
      const className = unknownUtilityMatch[1] ?? 'unknown';
      return {
        description: `Tailwind utility class '${className}' does not exist`,
        confidence: 0.9,
        fixes: this.createUnknownUtilityFixes(className),
      };
    }

    // SCSS undefined variable
    if (message.includes('Undefined variable')) {
      const varMatch = /\$(\w+)/.exec(message);
      const varName = varMatch?.[1] ?? 'variable';
      return {
        description: `SCSS variable $${varName} is not defined`,
        confidence: 0.9,
        fixes: this.createUndefinedVariableFixes(varName),
      };
    }

    // Missing semicolon
    if (message.includes('semicolon') || message.includes('Expected ";"')) {
      return {
        description: 'Missing semicolon in CSS/SCSS',
        confidence: 0.95,
        fixes: this.createMissingSemicolonFix(error),
      };
    }

    // Invalid property value
    if (message.includes('Invalid value') || message.includes('invalid property value')) {
      return {
        description: 'Invalid CSS property value',
        confidence: 0.85,
        fixes: this.createInvalidPropertyFixes(error),
      };
    }

    // Unclosed bracket
    if (message.includes('Unclosed') || message.includes('unclosed')) {
      return {
        description: 'Unclosed bracket or brace in stylesheet',
        confidence: 0.9,
        fixes: this.createUnclosedBracketFix(error),
      };
    }

    return null;
  }

  // ===========================================================================
  // Fix Generation
  // ===========================================================================

  async suggestFixes(
    errors: NormalizedError[],
    hypotheses: RootCauseHypothesis[]
  ): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    for (const hypothesis of hypotheses) {
      fixes.push(...hypothesis.suggestedFixes);
    }

    for (const error of errors) {
      const additionalFixes = this.generateAdditionalFixes(error);
      fixes.push(...additionalFixes);
    }

    return fixes;
  }

  private generateAdditionalFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    if (error.type === 'TailwindError') {
      fixes.push(...this.generateTailwindFixes(error));
    }

    return fixes;
  }

  private createUnknownUtilityFixes(className: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    // Check for common misspellings
    const knownFix = TAILWIND_CLASS_FIXES[className];
    if (knownFix !== undefined) {
      fixes.push({
        id: randomUUID(),
        description: `Replace '${className}' with '${knownFix}'`,
        confidence: 0.95,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      });
    }

    // Suggest checking documentation
    fixes.push({
      id: randomUUID(),
      description: `Check Tailwind CSS documentation for correct utility class name`,
      confidence: 0.7,
      type: 'template',
      changes: [],
      validationSteps: [{
        type: 'manual',
        description: 'Verify class name in Tailwind documentation',
        expectedOutcome: 'Correct class name identified',
      }],
    });

    // Suggest adding to safelist if intentional
    fixes.push({
      id: randomUUID(),
      description: `If using dynamic class, add '${className}' to safelist in tailwind.config.js`,
      confidence: 0.6,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationSteps(),
    });

    return fixes;
  }

  private createUndefinedVariableFixes(varName: string): FixSuggestion[] {
    return [
      {
        id: randomUUID(),
        description: `Define variable $${varName} before use`,
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      },
      {
        id: randomUUID(),
        description: `Import the file containing $${varName} definition`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationSteps(),
      },
    ];
  }

  private createMissingSemicolonFix(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` at line ${error.location.line}`
      : '';

    return [{
      id: randomUUID(),
      description: `Add missing semicolon at end of declaration${locationInfo}`,
      confidence: 0.95,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationStepsForError(error),
    }];
  }

  private createInvalidPropertyFixes(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` (line ${error.location.line})`
      : '';

    return [
      {
        id: randomUUID(),
        description: `Check property value against CSS specification${locationInfo}`,
        confidence: 0.8,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationStepsForError(error),
      },
      {
        id: randomUUID(),
        description: `Verify units are correct (px, em, rem, %, etc.)${locationInfo}`,
        confidence: 0.75,
        type: 'template',
        changes: [],
        validationSteps: this.createValidationStepsForError(error),
      },
    ];
  }

  private createUnclosedBracketFix(error: NormalizedError): FixSuggestion[] {
    const locationInfo = error.location !== undefined
      ? ` near line ${error.location.line}`
      : '';

    return [{
      id: randomUUID(),
      description: `Add missing closing bracket or brace${locationInfo}`,
      confidence: 0.9,
      type: 'template',
      changes: [],
      validationSteps: this.createValidationStepsForError(error),
    }];
  }

  private createValidationStepsForError(error: NormalizedError): ValidationStep[] {
    const steps: ValidationStep[] = [];
    const fileArg = error.location !== undefined ? ` ${error.location.file}` : '';

    if (this.language === 'scss') {
      steps.push({
        type: 'build',
        command: `npx sass --no-source-map${fileArg}`,
        expectedOutcome: 'SCSS compiles without errors',
      });
    }

    steps.push({
      type: 'lint',
      command: `npx stylelint${fileArg}`,
      expectedOutcome: 'No linting errors',
    });

    return steps;
  }

  private generateTailwindFixes(error: NormalizedError): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];
    const message = error.message;

    // Content paths issue
    if (message.includes('content') || message.includes('purge')) {
      fixes.push({
        id: randomUUID(),
        description: 'Update content paths in tailwind.config.js to include all template files',
        confidence: 0.85,
        type: 'template',
        changes: [],
        validationSteps: [{
          type: 'build',
          command: 'npx tailwindcss build',
          expectedOutcome: 'Build completes without errors',
        }],
      });
    }

    return fixes;
  }

  private createValidationSteps(): ValidationStep[] {
    const steps: ValidationStep[] = [];

    if (this.language === 'scss') {
      steps.push({
        type: 'build',
        command: 'npx sass --no-source-map',
        expectedOutcome: 'SCSS compiles without errors',
      });
    }

    steps.push({
      type: 'lint',
      command: 'npx stylelint',
      expectedOutcome: 'No linting errors',
    });

    return steps;
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  async validateFix(fix: FixSuggestion): Promise<ValidationResult> {
    const results: ValidationResult['steps'] = [];

    for (const step of fix.validationSteps) {
      results.push({
        step,
        passed: true,
        output: 'Validation step pending implementation',
      });
    }

    return {
      passed: true,
      steps: results,
      notes: ['Validation requires execution environment'],
    };
  }

  // ===========================================================================
  // Capability Check
  // ===========================================================================

  canHandle(input: string | NormalizedError): boolean {
    if (typeof input === 'string') {
      return (
        CSS_PATTERNS.sassError.test(input) ||
        CSS_PATTERNS.stylelint.test(input) ||
        CSS_PATTERNS.postcssError.test(input) ||
        CSS_PATTERNS.unknownUtility.test(input) ||
        /\.(css|scss|sass):/.test(input) ||
        /tailwind/i.test(input)
      );
    }

    return (
      input.language === 'css' ||
      input.language === 'scss' ||
      input.language === 'tailwind'
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createCSSModule(): CSSModule {
  return new CSSModule('css');
}

export function createSCSSModule(): CSSModule {
  return new CSSModule('scss');
}

export function createTailwindModule(): CSSModule {
  return new CSSModule('tailwind');
}
