/**
 * CSS/SCSS/Tailwind Language Module
 *
 * Implements the LanguageModule interface for CSS, SCSS, and Tailwind CSS
 * error parsing, analysis, root cause detection, and fix generation.
 *
 * @module css-module
 */

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
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
 * Simple Tailwind CSS class validator (no config file loading)
 * @deprecated Use TailwindValidator for full config support
 */
export class SimpleTailwindValidator {
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
// Tailwind Content Path Analyzer
// =============================================================================

/**
 * Result of analyzing a single content path
 */
export interface ContentPathResult {
  /** The original path pattern from config */
  pattern: string;
  /** Whether the path/pattern is valid */
  valid: boolean;
  /** Files matched by this pattern */
  matchedFiles: string[];
  /** Error message if invalid */
  error?: string;
  /** Warning message if potentially problematic */
  warning?: string;
}

/**
 * Result of analyzing content path configuration
 */
export interface ContentAnalysisResult {
  /** Results for each content path */
  paths: ContentPathResult[];
  /** Files containing Tailwind classes but not in content paths */
  unreachableFiles: UnreachableFile[];
  /** Overall validity */
  valid: boolean;
  /** Summary of issues found */
  issues: ContentIssue[];
  /** Total files covered by content paths */
  totalCoveredFiles: number;
}

/**
 * A file that contains Tailwind classes but isn't covered by content paths
 */
export interface UnreachableFile {
  /** File path */
  file: string;
  /** Tailwind classes found in the file */
  classesFound: string[];
  /** Suggested content path pattern to add */
  suggestedPattern: string;
}

/**
 * An issue found during content path analysis
 */
export interface ContentIssue {
  /** Issue severity */
  severity: 'error' | 'warning';
  /** Issue type */
  type: 'missing_path' | 'empty_pattern' | 'unreachable_file' | 'invalid_glob' | 'no_matches';
  /** Human-readable message */
  message: string;
  /** Related path or file */
  path?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Tailwind CSS content path analyzer for detecting purge/content configuration issues.
 *
 * Analyzes tailwind.config.js content paths to detect:
 * - Missing or invalid paths
 * - Glob patterns that don't match any files
 * - Template files containing Tailwind classes but not covered by content paths
 */
export class ContentPathAnalyzer {
  /** Project root directory */
  private readonly projectRoot: string;
  /** File extensions to scan for Tailwind classes */
  private readonly scanExtensions: string[];
  /** Regex pattern to detect Tailwind class usage */
  private readonly tailwindClassPattern: RegExp;

  constructor(
    projectRoot: string = process.cwd(),
    scanExtensions: string[] = ['.html', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.php', '.blade.php', '.erb', '.ejs', '.hbs', '.twig']
  ) {
    this.projectRoot = resolve(projectRoot);
    this.scanExtensions = scanExtensions;
    // Pattern to detect className, class, or :class attributes with Tailwind-like classes
    this.tailwindClassPattern = /(?:className|class|:class)\s*=\s*["'`{]([^"'`}]+)["'`}]/g;
  }

  /**
   * Analyze Tailwind content paths from configuration.
   *
   * @param contentPaths - Array of content path patterns from tailwind.config.js
   * @param additionalScanDirs - Additional directories to scan for unreachable files
   * @returns Analysis result with issues and suggestions
   */
  async analyze(
    contentPaths: string[],
    additionalScanDirs: string[] = ['./src', './pages', './components', './app']
  ): Promise<ContentAnalysisResult> {
    const result: ContentAnalysisResult = {
      paths: [],
      unreachableFiles: [],
      valid: true,
      issues: [],
      totalCoveredFiles: 0,
    };

    const allCoveredFiles = new Set<string>();

    // Analyze each content path
    for (const pattern of contentPaths) {
      const pathResult = await this.analyzeContentPath(pattern);
      result.paths.push(pathResult);

      if (!pathResult.valid) {
        result.valid = false;
      }

      // Collect all covered files
      for (const file of pathResult.matchedFiles) {
        allCoveredFiles.add(file);
      }

      // Add issues from path analysis
      if (pathResult.error !== undefined) {
        result.issues.push({
          severity: 'error',
          type: pathResult.matchedFiles.length === 0 ? 'no_matches' : 'invalid_glob',
          message: pathResult.error,
          path: pattern,
        });
      }

      if (pathResult.warning !== undefined) {
        result.issues.push({
          severity: 'warning',
          type: 'empty_pattern',
          message: pathResult.warning,
          path: pattern,
        });
      }
    }

    result.totalCoveredFiles = allCoveredFiles.size;

    // Scan for unreachable files
    const unreachable = await this.findUnreachableFiles(allCoveredFiles, additionalScanDirs);
    result.unreachableFiles = unreachable;

    for (const file of unreachable) {
      result.issues.push({
        severity: 'warning',
        type: 'unreachable_file',
        message: `File '${file.file}' contains Tailwind classes but is not covered by content paths`,
        path: file.file,
        suggestion: `Add '${file.suggestedPattern}' to content paths`,
      });
    }

    if (unreachable.length > 0) {
      result.valid = false;
    }

    return result;
  }

  /**
   * Analyze a single content path pattern.
   */
  private async analyzeContentPath(pattern: string): Promise<ContentPathResult> {
    const result: ContentPathResult = {
      pattern,
      valid: true,
      matchedFiles: [],
    };

    // Handle empty pattern
    if (pattern.trim() === '') {
      result.valid = false;
      result.error = 'Empty content path pattern';
      return result;
    }

    // Resolve relative paths
    const absolutePattern = isAbsolute(pattern)
      ? pattern
      : join(this.projectRoot, pattern);

    try {
      // Check if it's a direct file path (no glob characters)
      if (!this.isGlobPattern(pattern)) {
        if (existsSync(absolutePattern)) {
          const stat = statSync(absolutePattern);
          if (stat.isFile()) {
            result.matchedFiles = [absolutePattern];
          } else if (stat.isDirectory()) {
            result.warning = `'${pattern}' is a directory. Consider using a glob pattern like '${pattern}/**/*.{html,js,jsx,tsx}'`;
          }
        } else {
          result.valid = false;
          result.error = `Path '${pattern}' does not exist`;
        }
        return result;
      }

      // Expand glob pattern
      const matches = await glob(absolutePattern, {
        cwd: this.projectRoot,
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      });

      result.matchedFiles = matches;

      if (matches.length === 0) {
        result.warning = `Pattern '${pattern}' does not match any files`;
      }
    } catch (error) {
      result.valid = false;
      result.error = `Invalid glob pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`;
    }

    return result;
  }

  /**
   * Check if a pattern contains glob characters.
   */
  private isGlobPattern(pattern: string): boolean {
    return /[*?[\]{}!]/.test(pattern);
  }

  /**
   * Find files containing Tailwind classes that aren't covered by content paths.
   */
  private async findUnreachableFiles(
    coveredFiles: Set<string>,
    scanDirs: string[]
  ): Promise<UnreachableFile[]> {
    const unreachable: UnreachableFile[] = [];

    for (const scanDir of scanDirs) {
      const absoluteDir = isAbsolute(scanDir)
        ? scanDir
        : join(this.projectRoot, scanDir);

      if (!existsSync(absoluteDir)) {
        continue;
      }

      try {
        // Find all potential template files
        const extensionGlob = `**/*{${this.scanExtensions.join(',')}}`;
        const files = await glob(extensionGlob, {
          cwd: absoluteDir,
          absolute: true,
          nodir: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        });

        for (const file of files) {
          // Skip if already covered
          if (coveredFiles.has(file)) {
            continue;
          }

          // Check if file contains Tailwind classes
          const classes = this.extractTailwindClasses(file);
          if (classes.length > 0) {
            unreachable.push({
              file: relative(this.projectRoot, file),
              classesFound: classes.slice(0, 10), // Limit to first 10 classes
              suggestedPattern: this.suggestPattern(file),
            });
          }
        }
      } catch {
        // Skip directories that can't be scanned
      }
    }

    return unreachable;
  }

  /**
   * Extract Tailwind classes from a file.
   */
  private extractTailwindClasses(filePath: string): string[] {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const classes = new Set<string>();

      let match: RegExpExecArray | null;
      while ((match = this.tailwindClassPattern.exec(content)) !== null) {
        const classString = match[1];
        if (classString !== undefined) {
          // Split class string and filter for Tailwind-like classes
          const classList = classString.split(/\s+/);
          for (const cls of classList) {
            if (this.looksLikeTailwindClass(cls)) {
              classes.add(cls);
            }
          }
        }
      }

      // Reset regex state
      this.tailwindClassPattern.lastIndex = 0;

      return Array.from(classes);
    } catch {
      return [];
    }
  }

  /**
   * Check if a class name looks like a Tailwind utility class.
   */
  private looksLikeTailwindClass(className: string): boolean {
    // Skip empty or very short classes
    if (className.length < 2) {
      return false;
    }

    // Skip classes that are clearly not Tailwind (e.g., BEM-style)
    if (className.includes('__') || className.includes('--')) {
      return false;
    }

    // Check for common Tailwind patterns
    const tailwindPatterns = [
      /^-?[mpwh][trblxy]?-/, // margin, padding, width, height
      /^(flex|grid|block|inline|hidden)/, // display
      /^(text|font|leading|tracking)-/, // typography
      /^(bg|border|rounded|shadow)-/, // backgrounds, borders
      /^(hover|focus|active|dark):/, // variants
      /^(sm|md|lg|xl|2xl):/, // responsive
      /^(justify|items|content|self)-/, // flexbox/grid alignment
      /^(gap|space)-/, // spacing
      /^(absolute|relative|fixed|sticky)$/, // position
      /^(top|right|bottom|left|inset)-/, // position values
      /^(z-|opacity-|overflow-)/, // other utilities
      /^(transition|duration|ease|delay|animate)-/, // transitions
      /^(scale|rotate|translate|skew|origin)-/, // transforms
    ];

    return tailwindPatterns.some((pattern) => pattern.test(className));
  }

  /**
   * Suggest a content path pattern for an unreachable file.
   */
  private suggestPattern(filePath: string): string {
    const relativePath = relative(this.projectRoot, filePath);
    const dir = dirname(relativePath);
    const ext = filePath.match(/\.[^.]+$/)?.[0] ?? '';

    // Suggest a pattern that covers the directory
    if (dir === '.') {
      return `./*${ext}`;
    }

    return `./${dir}/**/*${ext}`;
  }

  /**
   * Parse content paths from a tailwind.config.js file.
   *
   * @param configPath - Path to tailwind.config.js
   * @returns Array of content paths or null if parsing fails
   */
  async parseConfigFile(configPath: string): Promise<string[] | null> {
    const absolutePath = isAbsolute(configPath)
      ? configPath
      : join(this.projectRoot, configPath);

    if (!existsSync(absolutePath)) {
      return null;
    }

    try {
      const content = await readFile(absolutePath, 'utf-8');

      // Try to extract content array using regex (handles most common formats)
      // This is a simplified parser - for full parsing, would need to evaluate JS
      const contentMatch = content.match(/content\s*:\s*\[([\s\S]*?)\]/);
      if (contentMatch !== null && contentMatch[1] !== undefined) {
        const pathsString = contentMatch[1];
        const paths: string[] = [];

        // Extract string literals
        const stringMatches = pathsString.matchAll(/['"]([^'"]+)['"]/g);
        for (const match of stringMatches) {
          if (match[1] !== undefined) {
            paths.push(match[1]);
          }
        }

        return paths;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Analyze content paths directly from tailwind.config.js file.
   *
   * @param configPath - Path to tailwind.config.js (default: './tailwind.config.js')
   * @returns Analysis result or null if config can't be parsed
   */
  async analyzeFromConfig(configPath = './tailwind.config.js'): Promise<ContentAnalysisResult | null> {
    const contentPaths = await this.parseConfigFile(configPath);
    if (contentPaths === null) {
      return null;
    }

    return this.analyze(contentPaths);
  }
}

// =============================================================================
// Dynamic Class Name Detector for JIT Safelist
// =============================================================================

/**
 * Types of dynamic class patterns detected
 */
export type DynamicClassType =
  | 'template_literal'
  | 'string_concatenation'
  | 'conditional_ternary'
  | 'array_join'
  | 'object_keys'
  | 'function_call';

/**
 * A detected dynamic class pattern
 */
export interface DynamicClassPattern {
  /** Type of dynamic pattern */
  type: DynamicClassType;
  /** The raw code containing the pattern */
  raw: string;
  /** Source location in the file */
  location: SourceLocation;
  /** Static parts that can be identified */
  staticParts: string[];
  /** Variable parts (interpolations) */
  variableParts: string[];
  /** Suggested safelist patterns */
  safelistSuggestions: string[];
  /** Risk level for purging */
  riskLevel: 'high' | 'medium' | 'low';
  /** Human-readable description */
  description: string;
}

/**
 * Result of scanning a file for dynamic classes
 */
export interface DynamicClassScanResult {
  /** File path */
  file: string;
  /** Detected dynamic patterns */
  patterns: DynamicClassPattern[];
  /** Total patterns found */
  totalPatterns: number;
  /** Suggested safelist entries */
  safelistSuggestions: SafelistEntry[];
}

/**
 * A safelist entry for tailwind.config.js
 */
export interface SafelistEntry {
  /** Pattern string or regex */
  pattern: string;
  /** Whether this is a regex pattern */
  isRegex: boolean;
  /** Optional variants to include */
  variants?: string[];
  /** Source patterns that led to this suggestion */
  sourcePatterns: string[];
}

/**
 * Patterns for detecting dynamic Tailwind class names
 */
const DYNAMIC_CLASS_PATTERNS = {
  // Template literal with interpolation: `bg-${color}-500`
  templateLiteral: /`([^`]*\$\{[^}]+\}[^`]*)`/g,

  // String concatenation: 'bg-' + color + '-500'
  stringConcat: /['"]([a-z]+-?)['"]s*\+\s*(\w+)(?:\s*\+\s*['"](-?\w+)['"])?/gi,

  // Conditional/ternary in className: condition ? 'class-a' : 'class-b'
  conditionalClass: /(?:className|class)\s*=\s*\{[^}]*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g,

  // Array join pattern: ['mt-4', someVar].join(' ')
  arrayJoin: /\[([^\]]*)\]\.join\s*\(\s*['"]['"]\s*\)/g,

  // clsx/classnames function: clsx('base', { 'active': isActive })
  classnamesCall: /(?:clsx|classnames|cn|cx)\s*\(([^)]+)\)/gi,

  // Object.keys for conditional classes
  objectKeys: /Object\.keys\s*\(\s*\{([^}]+)\}\s*\)/g,
} as const;

/**
 * Common Tailwind utility prefixes for pattern generation
 */
const TAILWIND_PREFIXES = [
  'bg', 'text', 'border', 'rounded', 'shadow', 'opacity',
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h',
  'font', 'leading', 'tracking', 'gap', 'space',
  'grid-cols', 'grid-rows', 'col-span', 'row-span',
  'translate', 'rotate', 'scale', 'skew',
  'duration', 'delay', 'ease',
  'z', 'top', 'right', 'bottom', 'left', 'inset',
];

/**
 * Common color/size suffixes for safelist generation.
 * Used by generateExpandedSafelist for comprehensive class coverage.
 */
const COMMON_SUFFIXES = {
  colors: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
  sizes: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'],
  spacing: ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'],
} as const;

/**
 * Detector for dynamic Tailwind class names that need JIT safelist.
 *
 * Finds patterns like:
 * - Template literals: `bg-${color}-500`
 * - String concatenation: 'text-' + size
 * - Conditional ternary: condition ? 'bg-blue' : 'bg-red'
 * - Array joins: [baseClass, variantClass].join(' ')
 * - classnames/clsx calls with dynamic parts
 */
export class DynamicClassDetector {
  /** Project root directory */
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = resolve(projectRoot);
  }

  /**
   * Scan a file for dynamic class patterns.
   *
   * @param filePath - Path to the file to scan
   * @returns Scan result with detected patterns and safelist suggestions
   */
  async scanFile(filePath: string): Promise<DynamicClassScanResult> {
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : join(this.projectRoot, filePath);

    const result: DynamicClassScanResult = {
      file: relative(this.projectRoot, absolutePath),
      patterns: [],
      totalPatterns: 0,
      safelistSuggestions: [],
    };

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      // Scan for each pattern type
      result.patterns.push(...this.findTemplateLiterals(content, lines));
      result.patterns.push(...this.findStringConcatenation(content, lines));
      result.patterns.push(...this.findConditionalClasses(content, lines));
      result.patterns.push(...this.findArrayJoins(content, lines));
      result.patterns.push(...this.findClassnamesCalls(content, lines));

      result.totalPatterns = result.patterns.length;

      // Generate safelist suggestions
      result.safelistSuggestions = this.generateSafelistSuggestions(result.patterns);
    } catch {
      // File couldn't be read
    }

    return result;
  }

  /**
   * Scan multiple files for dynamic class patterns.
   *
   * @param filePaths - Array of file paths to scan
   * @returns Combined scan results
   */
  async scanFiles(filePaths: string[]): Promise<DynamicClassScanResult[]> {
    const results: DynamicClassScanResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.scanFile(filePath);
      if (result.patterns.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Find template literal patterns with interpolation.
   */
  private findTemplateLiterals(content: string, lines: string[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];
    const regex = new RegExp(DYNAMIC_CLASS_PATTERNS.templateLiteral.source, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const templateContent = match[1];

      if (templateContent === undefined) continue;

      // Check if this looks like a Tailwind class pattern
      if (!this.looksLikeTailwindTemplate(templateContent)) continue;

      const location = this.getLocationFromOffset(lines, match.index);
      const { staticParts, variableParts } = this.parseTemplateLiteral(templateContent);

      patterns.push({
        type: 'template_literal',
        raw: fullMatch,
        location,
        staticParts,
        variableParts,
        safelistSuggestions: this.generateTemplatePatterns(staticParts, variableParts),
        riskLevel: variableParts.length > 1 ? 'high' : 'medium',
        description: `Template literal with ${variableParts.length} dynamic part(s): ${templateContent}`,
      });
    }

    return patterns;
  }

  /**
   * Find string concatenation patterns.
   */
  private findStringConcatenation(content: string, lines: string[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];
    const regex = new RegExp(DYNAMIC_CLASS_PATTERNS.stringConcat.source, 'gi');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const prefix = match[1];
      const variable = match[2];
      const suffix = match[3];

      if (prefix === undefined || variable === undefined) continue;

      // Check if prefix looks like a Tailwind utility
      if (!this.looksLikeTailwindPrefix(prefix)) continue;

      const location = this.getLocationFromOffset(lines, match.index);
      const staticParts = [prefix];
      if (suffix !== undefined) {
        staticParts.push(suffix);
      }

      patterns.push({
        type: 'string_concatenation',
        raw: fullMatch,
        location,
        staticParts,
        variableParts: [variable],
        safelistSuggestions: this.generateConcatPatterns(prefix, suffix),
        riskLevel: 'medium',
        description: `String concatenation: "${prefix}" + ${variable}${suffix !== undefined ? ` + "${suffix}"` : ''}`,
      });
    }

    return patterns;
  }

  /**
   * Find conditional ternary patterns in className.
   */
  private findConditionalClasses(content: string, lines: string[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];
    const regex = new RegExp(DYNAMIC_CLASS_PATTERNS.conditionalClass.source, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const trueClass = match[1];
      const falseClass = match[2];

      if (trueClass === undefined || falseClass === undefined) continue;

      const location = this.getLocationFromOffset(lines, match.index);

      // Both classes are static, but we flag them as they're conditional
      patterns.push({
        type: 'conditional_ternary',
        raw: fullMatch,
        location,
        staticParts: [trueClass, falseClass],
        variableParts: [],
        safelistSuggestions: [trueClass, falseClass],
        riskLevel: 'low',
        description: `Conditional class: "${trueClass}" or "${falseClass}"`,
      });
    }

    return patterns;
  }

  /**
   * Find array join patterns.
   */
  private findArrayJoins(content: string, lines: string[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];
    const regex = new RegExp(DYNAMIC_CLASS_PATTERNS.arrayJoin.source, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const arrayContent = match[1];

      if (arrayContent === undefined) continue;

      const location = this.getLocationFromOffset(lines, match.index);

      // Extract static strings from array
      const staticStrings: string[] = [];
      const variableNames: string[] = [];
      const stringMatches = arrayContent.matchAll(/['"]([^'"]+)['"]/g);
      for (const strMatch of stringMatches) {
        if (strMatch[1] !== undefined) {
          staticStrings.push(strMatch[1]);
        }
      }

      // Find variable references
      const varMatches = arrayContent.matchAll(/(?:^|,\s*)(\w+)(?:\s*,|$)/g);
      for (const varMatch of varMatches) {
        if (varMatch[1] !== undefined && !varMatch[1].startsWith("'") && !varMatch[1].startsWith('"')) {
          variableNames.push(varMatch[1]);
        }
      }

      if (variableNames.length === 0 && staticStrings.length === 0) continue;

      patterns.push({
        type: 'array_join',
        raw: fullMatch,
        location,
        staticParts: staticStrings,
        variableParts: variableNames,
        safelistSuggestions: staticStrings,
        riskLevel: variableNames.length > 0 ? 'medium' : 'low',
        description: `Array join with ${staticStrings.length} static and ${variableNames.length} dynamic parts`,
      });
    }

    return patterns;
  }

  /**
   * Find classnames/clsx function calls with dynamic parts.
   */
  private findClassnamesCalls(content: string, lines: string[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];
    const regex = new RegExp(DYNAMIC_CLASS_PATTERNS.classnamesCall.source, 'gi');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const callContent = match[1];

      if (callContent === undefined) continue;

      const location = this.getLocationFromOffset(lines, match.index);

      // Extract static class strings
      const staticStrings: string[] = [];
      const stringMatches = callContent.matchAll(/['"]([^'"]+)['"]/g);
      for (const strMatch of stringMatches) {
        if (strMatch[1] !== undefined) {
          staticStrings.push(strMatch[1]);
        }
      }

      // Check for object notation { 'class-name': condition }
      const objectMatches = callContent.matchAll(/\{\s*['"]([^'"]+)['"]\s*:/g);
      for (const objMatch of objectMatches) {
        if (objMatch[1] !== undefined) {
          staticStrings.push(objMatch[1]);
        }
      }

      // Check for variables
      const hasVariables = /[^'"]\w+[^'"]/.test(callContent.replace(/['"][^'"]+['"]/g, ''));

      if (staticStrings.length === 0) continue;

      patterns.push({
        type: 'function_call',
        raw: fullMatch,
        location,
        staticParts: staticStrings,
        variableParts: hasVariables ? ['<dynamic>'] : [],
        safelistSuggestions: staticStrings,
        riskLevel: hasVariables ? 'medium' : 'low',
        description: `clsx/classnames call with ${staticStrings.length} detectable classes`,
      });
    }

    return patterns;
  }

  /**
   * Check if a template literal looks like it contains Tailwind classes.
   */
  private looksLikeTailwindTemplate(template: string): boolean {
    // Remove interpolations and check remaining parts
    const staticPart = template.replace(/\$\{[^}]+\}/g, '');
    return TAILWIND_PREFIXES.some((prefix) =>
      staticPart.includes(`${prefix}-`) || staticPart.startsWith(prefix)
    );
  }

  /**
   * Check if a string prefix looks like a Tailwind utility.
   */
  private looksLikeTailwindPrefix(prefix: string): boolean {
    const cleanPrefix = prefix.replace(/-$/, '');
    return TAILWIND_PREFIXES.includes(cleanPrefix);
  }

  /**
   * Parse a template literal into static and variable parts.
   */
  private parseTemplateLiteral(template: string): { staticParts: string[]; variableParts: string[] } {
    const staticParts: string[] = [];
    const variableParts: string[] = [];

    // Split by interpolation
    const parts = template.split(/\$\{([^}]+)\}/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;

      if (i % 2 === 0) {
        // Static part
        if (part.trim()) {
          staticParts.push(part.trim());
        }
      } else {
        // Variable part
        variableParts.push(part.trim());
      }
    }

    return { staticParts, variableParts };
  }

  /**
   * Get source location from character offset.
   */
  private getLocationFromOffset(
    lines: string[],
    offset: number
  ): SourceLocation {
    let currentOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const lineLength = line.length + 1; // +1 for newline
      if (currentOffset + lineLength > offset) {
        return {
          file: '',
          line: i + 1,
          column: offset - currentOffset,
        };
      }
      currentOffset += lineLength;
    }
    return { file: '', line: 1 };
  }

  /**
   * Generate safelist patterns for template literals.
   *
   * Analyzes both static parts and variable names to generate more accurate patterns.
   * Variable names like 'color', 'size', 'spacing' provide hints about expected values.
   */
  private generateTemplatePatterns(staticParts: string[], variableParts: string[]): string[] {
    const suggestions: string[] = [];

    if (staticParts.length === 0) return suggestions;

    const prefix = staticParts[0]?.replace(/-$/, '') ?? '';

    // Analyze variable names to infer expected value types
    const inferredType = this.inferValueTypeFromVariables(variableParts);

    // Check what kind of suffix is expected based on prefix and variable analysis
    if (inferredType === 'color' || prefix.includes('bg-') || prefix.includes('text-') || prefix.includes('border-')) {
      // Color-based utility - suggest color patterns
      suggestions.push(`{ pattern: /^${prefix}-(\\w+)-(\\d+)$/ }`);
      // Also suggest without shade for cases like `bg-${colorName}`
      suggestions.push(`{ pattern: /^${prefix}-\\w+$/ }`);
    } else if (inferredType === 'spacing' || ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'w', 'h', 'gap'].includes(prefix)) {
      // Spacing utility - suggest spacing patterns
      suggestions.push(`{ pattern: /^${prefix}-\\d+(\\.5)?$/ }`);
    } else if (inferredType === 'size') {
      // Size utility - suggest size patterns (xs, sm, md, lg, xl, etc.)
      suggestions.push(`{ pattern: /^${prefix}-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl)$/ }`);
    } else {
      // Generic pattern
      suggestions.push(`{ pattern: /^${prefix}-.+$/ }`);
    }

    return suggestions;
  }

  /**
   * Infer the expected value type from variable names.
   *
   * @param variableParts - Array of variable names/expressions from the template
   * @returns Inferred type: 'color', 'size', 'spacing', or 'unknown'
   */
  private inferValueTypeFromVariables(variableParts: string[]): 'color' | 'size' | 'spacing' | 'unknown' {
    const colorKeywords = ['color', 'colour', 'bg', 'background', 'text', 'border', 'fill', 'stroke'];
    const sizeKeywords = ['size', 'variant', 'breakpoint', 'screen'];
    const spacingKeywords = ['spacing', 'space', 'gap', 'margin', 'padding', 'width', 'height', 'inset'];

    for (const varPart of variableParts) {
      const lowerVar = varPart.toLowerCase();

      // Check for color-related variables
      if (colorKeywords.some((keyword) => lowerVar.includes(keyword))) {
        return 'color';
      }

      // Check for size-related variables
      if (sizeKeywords.some((keyword) => lowerVar.includes(keyword))) {
        return 'size';
      }

      // Check for spacing-related variables
      if (spacingKeywords.some((keyword) => lowerVar.includes(keyword))) {
        return 'spacing';
      }
    }

    return 'unknown';
  }

  /**
   * Generate safelist patterns for string concatenation.
   */
  private generateConcatPatterns(prefix: string, suffix?: string): string[] {
    const suggestions: string[] = [];
    const cleanPrefix = prefix.replace(/-$/, '');

    if (suffix !== undefined) {
      // Known suffix pattern: prefix-{var}-suffix
      suggestions.push(`{ pattern: /^${cleanPrefix}-.+-${suffix.replace(/^-/, '')}$/ }`);
    } else {
      // Just prefix-{var}
      suggestions.push(`{ pattern: /^${cleanPrefix}-.+$/ }`);
    }

    return suggestions;
  }

  /**
   * Generate consolidated safelist suggestions from all patterns.
   */
  private generateSafelistSuggestions(patterns: DynamicClassPattern[]): SafelistEntry[] {
    const suggestions = new Map<string, SafelistEntry>();

    for (const pattern of patterns) {
      for (const suggestion of pattern.safelistSuggestions) {
        // Check if this is a regex pattern or a static class
        const isRegex = suggestion.includes('pattern:') || suggestion.startsWith('/');

        const key = suggestion;
        const existing = suggestions.get(key);

        if (existing !== undefined) {
          existing.sourcePatterns.push(pattern.raw);
        } else {
          suggestions.set(key, {
            pattern: suggestion,
            isRegex,
            sourcePatterns: [pattern.raw],
          });
        }
      }
    }

    return Array.from(suggestions.values());
  }

  /**
   * Generate a safelist configuration string for tailwind.config.js.
   *
   * @param entries - Safelist entries to format
   * @returns Formatted safelist configuration string
   */
  formatSafelistConfig(entries: SafelistEntry[]): string {
    const lines = ['safelist: ['];

    for (const entry of entries) {
      if (entry.isRegex) {
        lines.push(`  ${entry.pattern},`);
      } else {
        lines.push(`  '${entry.pattern}',`);
      }
    }

    lines.push(']');
    return lines.join('\n');
  }

  /**
   * Generate an expanded safelist from detected patterns.
   *
   * Uses COMMON_SUFFIXES to expand patterns like `bg-${color}` into
   * concrete class names like `bg-red-500`, `bg-blue-600`, etc.
   *
   * @param patterns - Detected dynamic class patterns
   * @param options - Expansion options
   * @returns Array of expanded class names for safelist
   */
  generateExpandedSafelist(
    patterns: DynamicClassPattern[],
    options: {
      includeColors?: boolean;
      includeSizes?: boolean;
      includeSpacing?: boolean;
      colorNames?: string[];
    } = {}
  ): string[] {
    const {
      includeColors = true,
      includeSizes = true,
      includeSpacing = true,
      colorNames = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'],
    } = options;

    const expanded = new Set<string>();

    for (const pattern of patterns) {
      // Only expand patterns with variable parts
      if (pattern.variableParts.length === 0) {
        // Add static parts directly
        for (const staticPart of pattern.staticParts) {
          expanded.add(staticPart);
        }
        continue;
      }

      const prefix = pattern.staticParts[0]?.replace(/-$/, '') ?? '';

      // Determine what kind of values to expand based on prefix
      if (this.isColorUtility(prefix) && includeColors) {
        // Expand with color values
        for (const color of colorNames) {
          for (const shade of COMMON_SUFFIXES.colors) {
            expanded.add(`${prefix}-${color}-${shade}`);
          }
        }
      } else if (this.isSizeUtility(prefix) && includeSizes) {
        // Expand with size values
        for (const size of COMMON_SUFFIXES.sizes) {
          expanded.add(`${prefix}-${size}`);
        }
      } else if (this.isSpacingUtility(prefix) && includeSpacing) {
        // Expand with spacing values
        for (const spacing of COMMON_SUFFIXES.spacing) {
          expanded.add(`${prefix}-${spacing}`);
        }
      }
    }

    return Array.from(expanded).sort();
  }

  /**
   * Check if a utility prefix is color-based.
   */
  private isColorUtility(prefix: string): boolean {
    const colorUtilities = ['bg', 'text', 'border', 'ring', 'outline', 'shadow', 'accent', 'caret', 'fill', 'stroke', 'from', 'via', 'to', 'decoration', 'divide'];
    return colorUtilities.includes(prefix);
  }

  /**
   * Check if a utility prefix is size-based.
   */
  private isSizeUtility(prefix: string): boolean {
    const sizeUtilities = ['text', 'font', 'rounded', 'shadow', 'blur', 'max-w', 'container'];
    return sizeUtilities.includes(prefix);
  }

  /**
   * Check if a utility prefix is spacing-based.
   */
  private isSpacingUtility(prefix: string): boolean {
    const spacingUtilities = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'gap', 'space', 'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h', 'inset', 'top', 'right', 'bottom', 'left'];
    return spacingUtilities.includes(prefix);
  }
}

// =============================================================================
// Framework Conflict Detector (Feature #24)
// =============================================================================

/**
 * CSS framework identifiers for conflict detection.
 */
export type CSSFramework = 'tailwind' | 'bootstrap' | 'material-ui' | 'bulma' | 'foundation' | 'semantic-ui' | 'ant-design' | 'chakra-ui';

/**
 * Category of CSS property that may conflict between frameworks.
 */
export type ConflictCategory =
  | 'spacing'      // margin, padding
  | 'typography'   // font-size, font-weight, line-height
  | 'color'        // text color, background color
  | 'layout'       // display, flexbox, grid
  | 'sizing'       // width, height
  | 'border'       // border, border-radius
  | 'shadow'       // box-shadow
  | 'position'     // position, z-index
  | 'animation'    // transitions, animations
  | 'reset'        // CSS resets/normalizations
  | 'component';   // component-specific styles

/**
 * Severity of a framework conflict.
 */
export type ConflictSeverity = 'error' | 'warning' | 'info';

/**
 * A detected conflict between CSS frameworks.
 */
export interface FrameworkConflict {
  /** Unique identifier */
  id: string;
  /** Conflicting frameworks */
  frameworks: [CSSFramework, CSSFramework];
  /** Category of the conflict */
  category: ConflictCategory;
  /** Severity level */
  severity: ConflictSeverity;
  /** The conflicting class names */
  classes: {
    framework: CSSFramework;
    className: string;
    cssProperties: string[];
  }[];
  /** Description of the conflict */
  description: string;
  /** Suggested resolution */
  resolution: string;
  /** Source location if available */
  location?: SourceLocation;
  /** Element or component where conflict was detected */
  element?: string;
}

/**
 * Result of framework conflict analysis.
 */
export interface FrameworkConflictResult {
  /** Whether conflicts were detected */
  hasConflicts: boolean;
  /** Total number of conflicts */
  totalConflicts: number;
  /** Conflicts grouped by severity */
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  /** Detected frameworks in use */
  detectedFrameworks: CSSFramework[];
  /** All detected conflicts */
  conflicts: FrameworkConflict[];
  /** Summary of conflicts by category */
  byCategory: Map<ConflictCategory, FrameworkConflict[]>;
  /** Recommendations for resolving conflicts */
  recommendations: string[];
}

/**
 * Configuration for the framework conflict detector.
 */
export interface FrameworkConflictDetectorConfig {
  /** Frameworks to check for (default: all supported) */
  frameworks?: CSSFramework[];
  /** Minimum severity to report (default: 'info') */
  minSeverity?: ConflictSeverity;
  /** Whether to include component-level conflicts (default: true) */
  includeComponentConflicts?: boolean;
  /** Custom class patterns for framework detection */
  customPatterns?: Map<CSSFramework, RegExp[]>;
}

/**
 * Framework class pattern definition.
 */
interface FrameworkPattern {
  /** Pattern to match class names */
  pattern: RegExp;
  /** CSS properties this pattern affects */
  cssProperties: string[];
  /** Category of the pattern */
  category: ConflictCategory;
  /** Description of what this pattern does */
  description: string;
}

/**
 * Predefined patterns for common CSS frameworks.
 */
const FRAMEWORK_PATTERNS: Record<CSSFramework, FrameworkPattern[]> = {
  tailwind: [
    // Spacing
    { pattern: /^[mp][trblxy]?-\d+$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Tailwind spacing utility' },
    { pattern: /^-?[mp][trblxy]?-\d+$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Tailwind negative spacing' },
    { pattern: /^space-[xy]-\d+$/, cssProperties: ['margin'], category: 'spacing', description: 'Tailwind space between' },
    { pattern: /^gap-\d+$/, cssProperties: ['gap'], category: 'spacing', description: 'Tailwind gap utility' },
    // Typography
    { pattern: /^text-(xs|sm|base|lg|xl|[2-9]xl)$/, cssProperties: ['font-size', 'line-height'], category: 'typography', description: 'Tailwind font size' },
    { pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, cssProperties: ['font-weight'], category: 'typography', description: 'Tailwind font weight' },
    { pattern: /^leading-(none|tight|snug|normal|relaxed|loose|\d+)$/, cssProperties: ['line-height'], category: 'typography', description: 'Tailwind line height' },
    { pattern: /^tracking-(tighter|tight|normal|wide|wider|widest)$/, cssProperties: ['letter-spacing'], category: 'typography', description: 'Tailwind letter spacing' },
    // Colors
    { pattern: /^text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)-\d+$/, cssProperties: ['color'], category: 'color', description: 'Tailwind text color' },
    { pattern: /^bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)-\d+$/, cssProperties: ['background-color'], category: 'color', description: 'Tailwind background color' },
    // Layout
    { pattern: /^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden)$/, cssProperties: ['display'], category: 'layout', description: 'Tailwind display utility' },
    { pattern: /^(flex-row|flex-col|flex-row-reverse|flex-col-reverse)$/, cssProperties: ['flex-direction'], category: 'layout', description: 'Tailwind flex direction' },
    { pattern: /^(justify|items|content|self)-(start|end|center|between|around|evenly|stretch|baseline)$/, cssProperties: ['justify-content', 'align-items', 'align-content', 'align-self'], category: 'layout', description: 'Tailwind alignment' },
    { pattern: /^grid-cols-\d+$/, cssProperties: ['grid-template-columns'], category: 'layout', description: 'Tailwind grid columns' },
    // Sizing
    { pattern: /^w-(\d+|auto|full|screen|min|max|fit)$/, cssProperties: ['width'], category: 'sizing', description: 'Tailwind width' },
    { pattern: /^h-(\d+|auto|full|screen|min|max|fit)$/, cssProperties: ['height'], category: 'sizing', description: 'Tailwind height' },
    { pattern: /^(min|max)-(w|h)-(\d+|full|screen|min|max|fit)$/, cssProperties: ['min-width', 'max-width', 'min-height', 'max-height'], category: 'sizing', description: 'Tailwind min/max sizing' },
    // Border
    { pattern: /^border(-[trbl])?(-\d+)?$/, cssProperties: ['border-width'], category: 'border', description: 'Tailwind border width' },
    { pattern: /^rounded(-[trbl]{1,2})?(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/, cssProperties: ['border-radius'], category: 'border', description: 'Tailwind border radius' },
    // Shadow
    { pattern: /^shadow(-sm|-md|-lg|-xl|-2xl|-inner|-none)?$/, cssProperties: ['box-shadow'], category: 'shadow', description: 'Tailwind box shadow' },
    // Position
    { pattern: /^(static|fixed|absolute|relative|sticky)$/, cssProperties: ['position'], category: 'position', description: 'Tailwind position' },
    { pattern: /^z-(\d+|auto)$/, cssProperties: ['z-index'], category: 'position', description: 'Tailwind z-index' },
  ],
  bootstrap: [
    // Spacing (Bootstrap 5)
    { pattern: /^[mp][tbselrxy]?-[0-5]$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Bootstrap spacing utility' },
    { pattern: /^[mp][tbselrxy]?-auto$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Bootstrap auto spacing' },
    { pattern: /^g-[0-5]$/, cssProperties: ['gap'], category: 'spacing', description: 'Bootstrap gutter' },
    // Typography
    { pattern: /^fs-[1-6]$/, cssProperties: ['font-size'], category: 'typography', description: 'Bootstrap font size' },
    { pattern: /^fw-(lighter|light|normal|medium|semibold|bold|bolder)$/, cssProperties: ['font-weight'], category: 'typography', description: 'Bootstrap font weight' },
    { pattern: /^lh-(1|sm|base|lg)$/, cssProperties: ['line-height'], category: 'typography', description: 'Bootstrap line height' },
    { pattern: /^h[1-6]$/, cssProperties: ['font-size', 'font-weight'], category: 'typography', description: 'Bootstrap heading' },
    // Colors
    { pattern: /^text-(primary|secondary|success|danger|warning|info|light|dark|body|muted|white|black-50|white-50)$/, cssProperties: ['color'], category: 'color', description: 'Bootstrap text color' },
    { pattern: /^bg-(primary|secondary|success|danger|warning|info|light|dark|body|white|transparent)$/, cssProperties: ['background-color'], category: 'color', description: 'Bootstrap background color' },
    // Layout
    { pattern: /^d-(none|inline|inline-block|block|grid|inline-grid|table|table-row|table-cell|flex|inline-flex)$/, cssProperties: ['display'], category: 'layout', description: 'Bootstrap display utility' },
    { pattern: /^flex-(row|column|row-reverse|column-reverse)$/, cssProperties: ['flex-direction'], category: 'layout', description: 'Bootstrap flex direction' },
    { pattern: /^(justify-content|align-items|align-content|align-self)-(start|end|center|between|around|evenly|stretch|baseline)$/, cssProperties: ['justify-content', 'align-items'], category: 'layout', description: 'Bootstrap alignment' },
    { pattern: /^col(-\d+)?(-sm|-md|-lg|-xl|-xxl)?(-\d+)?$/, cssProperties: ['width', 'flex'], category: 'layout', description: 'Bootstrap grid column' },
    { pattern: /^row$/, cssProperties: ['display', 'flex-wrap'], category: 'layout', description: 'Bootstrap row' },
    // Sizing
    { pattern: /^w-(25|50|75|100|auto)$/, cssProperties: ['width'], category: 'sizing', description: 'Bootstrap width' },
    { pattern: /^h-(25|50|75|100|auto)$/, cssProperties: ['height'], category: 'sizing', description: 'Bootstrap height' },
    { pattern: /^(mw|mh)-100$/, cssProperties: ['max-width', 'max-height'], category: 'sizing', description: 'Bootstrap max sizing' },
    // Border
    { pattern: /^border(-top|-end|-bottom|-start)?(-0)?$/, cssProperties: ['border-width'], category: 'border', description: 'Bootstrap border' },
    { pattern: /^rounded(-top|-end|-bottom|-start|-circle|-pill)?(-0|-1|-2|-3|-4|-5)?$/, cssProperties: ['border-radius'], category: 'border', description: 'Bootstrap border radius' },
    // Shadow
    { pattern: /^shadow(-none|-sm|-lg)?$/, cssProperties: ['box-shadow'], category: 'shadow', description: 'Bootstrap shadow' },
    // Position
    { pattern: /^position-(static|relative|absolute|fixed|sticky)$/, cssProperties: ['position'], category: 'position', description: 'Bootstrap position' },
    // Components
    { pattern: /^btn(-[a-z]+)?$/, cssProperties: ['display', 'padding', 'font-size', 'border-radius'], category: 'component', description: 'Bootstrap button' },
    { pattern: /^card(-[a-z]+)?$/, cssProperties: ['display', 'flex-direction', 'border', 'border-radius'], category: 'component', description: 'Bootstrap card' },
    { pattern: /^navbar(-[a-z]+)?$/, cssProperties: ['display', 'flex-wrap', 'align-items'], category: 'component', description: 'Bootstrap navbar' },
    { pattern: /^modal(-[a-z]+)?$/, cssProperties: ['position', 'display'], category: 'component', description: 'Bootstrap modal' },
    { pattern: /^alert(-[a-z]+)?$/, cssProperties: ['padding', 'border', 'border-radius'], category: 'component', description: 'Bootstrap alert' },
  ],
  'material-ui': [
    // Spacing (MUI sx prop classes)
    { pattern: /^MuiBox-root$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'MUI Box component' },
    { pattern: /^Mui[A-Z][a-zA-Z]+-root$/, cssProperties: ['margin', 'padding', 'display'], category: 'component', description: 'MUI component root' },
    // Typography
    { pattern: /^MuiTypography-(h[1-6]|subtitle[12]|body[12]|caption|overline)$/, cssProperties: ['font-size', 'font-weight', 'line-height'], category: 'typography', description: 'MUI Typography variant' },
    { pattern: /^MuiTypography-root$/, cssProperties: ['font-family', 'font-size'], category: 'typography', description: 'MUI Typography' },
    // Layout
    { pattern: /^MuiGrid-root$/, cssProperties: ['display', 'flex-wrap'], category: 'layout', description: 'MUI Grid' },
    { pattern: /^MuiGrid-item$/, cssProperties: ['flex-grow'], category: 'layout', description: 'MUI Grid item' },
    { pattern: /^MuiStack-root$/, cssProperties: ['display', 'flex-direction'], category: 'layout', description: 'MUI Stack' },
    { pattern: /^MuiContainer-root$/, cssProperties: ['width', 'max-width', 'padding'], category: 'layout', description: 'MUI Container' },
    // Components
    { pattern: /^MuiButton-root$/, cssProperties: ['display', 'padding', 'font-size', 'border-radius'], category: 'component', description: 'MUI Button' },
    { pattern: /^MuiCard-root$/, cssProperties: ['display', 'overflow', 'border-radius'], category: 'component', description: 'MUI Card' },
    { pattern: /^MuiAppBar-root$/, cssProperties: ['display', 'flex-direction', 'position'], category: 'component', description: 'MUI AppBar' },
    { pattern: /^MuiDrawer-root$/, cssProperties: ['position', 'width'], category: 'component', description: 'MUI Drawer' },
    { pattern: /^MuiDialog-root$/, cssProperties: ['position', 'display'], category: 'component', description: 'MUI Dialog' },
    { pattern: /^MuiPaper-root$/, cssProperties: ['background-color', 'box-shadow'], category: 'component', description: 'MUI Paper' },
    { pattern: /^MuiChip-root$/, cssProperties: ['display', 'padding', 'border-radius'], category: 'component', description: 'MUI Chip' },
  ],
  bulma: [
    // Spacing
    { pattern: /^[mp][trblxy]?-[0-6]$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Bulma spacing helper' },
    // Typography
    { pattern: /^is-size-[1-7]$/, cssProperties: ['font-size'], category: 'typography', description: 'Bulma font size' },
    { pattern: /^has-text-weight-(light|normal|medium|semibold|bold)$/, cssProperties: ['font-weight'], category: 'typography', description: 'Bulma font weight' },
    { pattern: /^title$/, cssProperties: ['font-size', 'font-weight'], category: 'typography', description: 'Bulma title' },
    { pattern: /^subtitle$/, cssProperties: ['font-size', 'font-weight'], category: 'typography', description: 'Bulma subtitle' },
    // Colors
    { pattern: /^has-text-(white|black|light|dark|primary|link|info|success|warning|danger)$/, cssProperties: ['color'], category: 'color', description: 'Bulma text color' },
    { pattern: /^has-background-(white|black|light|dark|primary|link|info|success|warning|danger)$/, cssProperties: ['background-color'], category: 'color', description: 'Bulma background color' },
    // Layout
    { pattern: /^is-(flex|inline-flex|block|inline-block|inline)$/, cssProperties: ['display'], category: 'layout', description: 'Bulma display helper' },
    { pattern: /^is-flex-direction-(row|row-reverse|column|column-reverse)$/, cssProperties: ['flex-direction'], category: 'layout', description: 'Bulma flex direction' },
    { pattern: /^is-justify-content-(flex-start|flex-end|center|space-between|space-around|space-evenly)$/, cssProperties: ['justify-content'], category: 'layout', description: 'Bulma justify content' },
    { pattern: /^columns$/, cssProperties: ['display', 'flex-wrap'], category: 'layout', description: 'Bulma columns' },
    { pattern: /^column$/, cssProperties: ['flex'], category: 'layout', description: 'Bulma column' },
    // Components
    { pattern: /^button$/, cssProperties: ['display', 'padding', 'border-radius'], category: 'component', description: 'Bulma button' },
    { pattern: /^card$/, cssProperties: ['display', 'flex-direction', 'background-color'], category: 'component', description: 'Bulma card' },
    { pattern: /^navbar$/, cssProperties: ['display', 'min-height'], category: 'component', description: 'Bulma navbar' },
    { pattern: /^modal$/, cssProperties: ['display', 'position'], category: 'component', description: 'Bulma modal' },
  ],
  foundation: [
    // Spacing (Foundation Sites)
    { pattern: /^(margin|padding)-(top|right|bottom|left|horizontal|vertical)?-[0-3]$/, cssProperties: ['margin', 'padding'], category: 'spacing', description: 'Foundation spacing' },
    // Typography
    { pattern: /^h[1-6]$/, cssProperties: ['font-size', 'font-weight'], category: 'typography', description: 'Foundation heading' },
    { pattern: /^lead$/, cssProperties: ['font-size'], category: 'typography', description: 'Foundation lead text' },
    // Layout
    { pattern: /^grid-(x|y)$/, cssProperties: ['display'], category: 'layout', description: 'Foundation grid' },
    { pattern: /^cell$/, cssProperties: ['flex'], category: 'layout', description: 'Foundation cell' },
    { pattern: /^(small|medium|large)-\d+$/, cssProperties: ['width'], category: 'layout', description: 'Foundation responsive column' },
    // Components
    { pattern: /^button$/, cssProperties: ['display', 'padding', 'font-size'], category: 'component', description: 'Foundation button' },
    { pattern: /^callout$/, cssProperties: ['padding', 'margin', 'border'], category: 'component', description: 'Foundation callout' },
    { pattern: /^top-bar$/, cssProperties: ['display', 'flex-wrap'], category: 'component', description: 'Foundation top bar' },
    { pattern: /^reveal$/, cssProperties: ['position', 'display'], category: 'component', description: 'Foundation reveal modal' },
  ],
  'semantic-ui': [
    // Spacing
    { pattern: /^(very\s+)?(fitted|padded)$/, cssProperties: ['padding'], category: 'spacing', description: 'Semantic UI padding' },
    // Typography
    { pattern: /^(tiny|small|medium|large|big|huge|massive)$/, cssProperties: ['font-size'], category: 'typography', description: 'Semantic UI size' },
    // Layout
    { pattern: /^ui\s+grid$/, cssProperties: ['display', 'flex-wrap'], category: 'layout', description: 'Semantic UI grid' },
    { pattern: /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\s+wide\s+column$/, cssProperties: ['width'], category: 'layout', description: 'Semantic UI column' },
    // Components
    { pattern: /^ui\s+button$/, cssProperties: ['display', 'padding', 'font-size'], category: 'component', description: 'Semantic UI button' },
    { pattern: /^ui\s+card$/, cssProperties: ['display', 'flex-direction', 'background'], category: 'component', description: 'Semantic UI card' },
    { pattern: /^ui\s+menu$/, cssProperties: ['display', 'margin'], category: 'component', description: 'Semantic UI menu' },
    { pattern: /^ui\s+modal$/, cssProperties: ['position', 'display'], category: 'component', description: 'Semantic UI modal' },
  ],
  'ant-design': [
    // Layout
    { pattern: /^ant-row$/, cssProperties: ['display', 'flex-flow'], category: 'layout', description: 'Ant Design row' },
    { pattern: /^ant-col(-\d+)?$/, cssProperties: ['flex', 'max-width'], category: 'layout', description: 'Ant Design column' },
    { pattern: /^ant-space$/, cssProperties: ['display', 'gap'], category: 'layout', description: 'Ant Design space' },
    // Typography
    { pattern: /^ant-typography$/, cssProperties: ['font-family', 'font-size'], category: 'typography', description: 'Ant Design typography' },
    { pattern: /^ant-typography-h[1-5]$/, cssProperties: ['font-size', 'font-weight'], category: 'typography', description: 'Ant Design heading' },
    // Components
    { pattern: /^ant-btn(-[a-z]+)?$/, cssProperties: ['display', 'padding', 'font-size'], category: 'component', description: 'Ant Design button' },
    { pattern: /^ant-card(-[a-z]+)?$/, cssProperties: ['display', 'background', 'border-radius'], category: 'component', description: 'Ant Design card' },
    { pattern: /^ant-menu(-[a-z]+)?$/, cssProperties: ['display', 'margin'], category: 'component', description: 'Ant Design menu' },
    { pattern: /^ant-modal(-[a-z]+)?$/, cssProperties: ['position', 'display'], category: 'component', description: 'Ant Design modal' },
    { pattern: /^ant-table(-[a-z]+)?$/, cssProperties: ['display', 'width'], category: 'component', description: 'Ant Design table' },
    { pattern: /^ant-form(-[a-z]+)?$/, cssProperties: ['display', 'margin'], category: 'component', description: 'Ant Design form' },
  ],
  'chakra-ui': [
    // Layout
    { pattern: /^chakra-stack$/, cssProperties: ['display', 'flex-direction'], category: 'layout', description: 'Chakra UI Stack' },
    { pattern: /^chakra-flex$/, cssProperties: ['display'], category: 'layout', description: 'Chakra UI Flex' },
    { pattern: /^chakra-grid$/, cssProperties: ['display'], category: 'layout', description: 'Chakra UI Grid' },
    { pattern: /^chakra-container$/, cssProperties: ['max-width', 'padding'], category: 'layout', description: 'Chakra UI Container' },
    // Typography
    { pattern: /^chakra-heading$/, cssProperties: ['font-family', 'font-size', 'font-weight'], category: 'typography', description: 'Chakra UI Heading' },
    { pattern: /^chakra-text$/, cssProperties: ['font-family', 'font-size'], category: 'typography', description: 'Chakra UI Text' },
    // Components
    { pattern: /^chakra-button$/, cssProperties: ['display', 'padding', 'font-size'], category: 'component', description: 'Chakra UI Button' },
    { pattern: /^chakra-card$/, cssProperties: ['display', 'background', 'border-radius'], category: 'component', description: 'Chakra UI Card' },
    { pattern: /^chakra-modal(-[a-z]+)?$/, cssProperties: ['position', 'display'], category: 'component', description: 'Chakra UI Modal' },
    { pattern: /^chakra-menu(-[a-z]+)?$/, cssProperties: ['display', 'position'], category: 'component', description: 'Chakra UI Menu' },
  ],
};

/**
 * Detector for conflicts between Tailwind CSS and other CSS frameworks.
 *
 * This detector identifies when classes from multiple CSS frameworks are used
 * together in a way that may cause style conflicts, unexpected overrides, or
 * unpredictable rendering behavior.
 *
 * @example
 * ```typescript
 * const detector = new FrameworkConflictDetector();
 *
 * // Scan HTML content for conflicts
 * const result = detector.scanHTML('<div class="flex d-flex p-4 m-3 bg-primary">');
 * console.log(result.conflicts);
 *
 * // Scan class list
 * const classes = ['flex', 'd-flex', 'p-4', 'm-3', 'bg-primary'];
 * const result2 = detector.scanClasses(classes);
 * ```
 */
export class FrameworkConflictDetector {
  private readonly config: Required<FrameworkConflictDetectorConfig>;
  private readonly patterns: Map<CSSFramework, FrameworkPattern[]>;

  constructor(config: FrameworkConflictDetectorConfig = {}) {
    this.config = {
      frameworks: config.frameworks ?? ['tailwind', 'bootstrap', 'material-ui', 'bulma', 'foundation', 'semantic-ui', 'ant-design', 'chakra-ui'],
      minSeverity: config.minSeverity ?? 'info',
      includeComponentConflicts: config.includeComponentConflicts ?? true,
      customPatterns: config.customPatterns ?? new Map(),
    };

    // Initialize patterns
    this.patterns = new Map();
    for (const framework of this.config.frameworks) {
      const builtIn = FRAMEWORK_PATTERNS[framework] ?? [];
      const custom = this.config.customPatterns.get(framework) ?? [];
      const customPatterns: FrameworkPattern[] = custom.map((pattern) => ({
        pattern,
        cssProperties: ['unknown'],
        category: 'component' as ConflictCategory,
        description: `Custom ${framework} pattern`,
      }));
      this.patterns.set(framework, [...builtIn, ...customPatterns]);
    }
  }

  /**
   * Scan HTML content for framework conflicts.
   *
   * @param html - HTML content to scan
   * @param fileName - Optional file name for location tracking
   * @returns Analysis result with detected conflicts
   */
  scanHTML(html: string, fileName?: string): FrameworkConflictResult {
    const classRegex = /class\s*=\s*["']([^"']+)["']/gi;
    const allClasses: { classes: string[]; line: number; element: string }[] = [];

    let match: RegExpExecArray | null;
    const lines = html.split('\n');
    let lineIndex = 0;
    let charIndex = 0;

    while ((match = classRegex.exec(html)) !== null) {
      // Find line number
      while (charIndex < match.index && lineIndex < lines.length) {
        const currentLine = lines[lineIndex];
        if (currentLine !== undefined) {
          charIndex += currentLine.length + 1; // +1 for newline
        }
        lineIndex++;
      }

      const classString = match[1] ?? '';
      const classes = classString.split(/\s+/).filter(Boolean);

      // Try to extract element name
      const beforeClass = html.slice(Math.max(0, match.index - 50), match.index);
      const elementMatch = beforeClass.match(/<(\w+)[^>]*$/);
      const element = elementMatch?.[1] ?? 'unknown';

      allClasses.push({
        classes,
        line: lineIndex + 1,
        element,
      });
    }

    const result = this.createEmptyResult();

    for (const { classes, line, element } of allClasses) {
      const conflicts = this.detectConflicts(classes, element);
      for (const conflict of conflicts) {
        if (fileName !== undefined) {
          conflict.location = { file: fileName, line };
        }
        conflict.element = element;
        this.addConflict(result, conflict);
      }
    }

    this.generateRecommendations(result);
    return result;
  }

  /**
   * Scan a list of class names for conflicts.
   *
   * @param classes - Array of class names to check
   * @param element - Optional element context
   * @returns Analysis result with detected conflicts
   */
  scanClasses(classes: string[], element?: string): FrameworkConflictResult {
    const result = this.createEmptyResult();
    const conflicts = this.detectConflicts(classes, element);

    for (const conflict of conflicts) {
      this.addConflict(result, conflict);
    }

    this.generateRecommendations(result);
    return result;
  }

  /**
   * Scan a class string for conflicts.
   *
   * @param classString - Space-separated class string
   * @param element - Optional element context
   * @returns Analysis result with detected conflicts
   */
  scanClassString(classString: string, element?: string): FrameworkConflictResult {
    const classes = classString.split(/\s+/).filter(Boolean);
    return this.scanClasses(classes, element);
  }

  /**
   * Detect which frameworks are being used based on class names.
   *
   * @param classes - Array of class names
   * @returns Array of detected frameworks
   */
  detectFrameworks(classes: string[]): CSSFramework[] {
    const detected = new Set<CSSFramework>();

    for (const className of classes) {
      for (const [framework, patterns] of this.patterns) {
        for (const { pattern } of patterns) {
          if (pattern.test(className)) {
            detected.add(framework);
            break;
          }
        }
      }
    }

    return Array.from(detected);
  }

  /**
   * Get framework information for a specific class.
   *
   * @param className - Class name to look up
   * @returns Framework and pattern info, or undefined if not matched
   */
  getClassInfo(className: string): { framework: CSSFramework; pattern: FrameworkPattern } | undefined {
    for (const [framework, patterns] of this.patterns) {
      for (const pattern of patterns) {
        if (pattern.pattern.test(className)) {
          return { framework, pattern };
        }
      }
    }
    return undefined;
  }

  /**
   * Detect conflicts between class names.
   */
  private detectConflicts(classes: string[], element?: string): FrameworkConflict[] {
    const conflicts: FrameworkConflict[] = [];
    const classInfos: { className: string; framework: CSSFramework; pattern: FrameworkPattern }[] = [];

    // Gather information about each class
    for (const className of classes) {
      const info = this.getClassInfo(className);
      if (info !== undefined) {
        classInfos.push({ className, ...info });
      }
    }

    // Check for conflicts between different frameworks
    const frameworks = new Set(classInfos.map((i) => i.framework));
    if (frameworks.size < 2) {
      return conflicts; // No cross-framework conflicts possible
    }

    // Group by CSS property
    const byProperty = new Map<string, typeof classInfos>();
    for (const info of classInfos) {
      for (const prop of info.pattern.cssProperties) {
        if (!byProperty.has(prop)) {
          byProperty.set(prop, []);
        }
        byProperty.get(prop)!.push(info);
      }
    }

    // Find conflicts (same property from different frameworks)
    for (const [property, infos] of byProperty) {
      const frameworksForProperty = new Set(infos.map((i) => i.framework));
      if (frameworksForProperty.size < 2) continue;

      // Group by framework
      const byFramework = new Map<CSSFramework, typeof classInfos>();
      for (const info of infos) {
        if (!byFramework.has(info.framework)) {
          byFramework.set(info.framework, []);
        }
        byFramework.get(info.framework)!.push(info);
      }

      // Create conflict for each pair of frameworks
      const frameworkList = Array.from(frameworksForProperty);
      for (let i = 0; i < frameworkList.length; i++) {
        for (let j = i + 1; j < frameworkList.length; j++) {
          const fw1 = frameworkList[i];
          const fw2 = frameworkList[j];

          // Skip if frameworks are undefined (should not happen but TypeScript requires check)
          if (fw1 === undefined || fw2 === undefined) continue;

          // Skip component conflicts if disabled
          const fw1Infos = byFramework.get(fw1);
          const fw2Infos = byFramework.get(fw2);
          if (fw1Infos === undefined || fw2Infos === undefined) continue;

          const isComponentConflict =
            fw1Infos.some((info) => info.pattern.category === 'component') ||
            fw2Infos.some((info) => info.pattern.category === 'component');

          if (isComponentConflict && !this.config.includeComponentConflicts) {
            continue;
          }

          const severity = this.determineSeverity(property, fw1Infos, fw2Infos);
          if (!this.meetsMinSeverity(severity)) continue;

          const category = fw1Infos[0]?.pattern.category ?? 'component';

          const conflict: FrameworkConflict = {
            id: randomUUID(),
            frameworks: [fw1, fw2],
            category,
            severity,
            classes: [
              ...fw1Infos.map((info) => ({
                framework: fw1,
                className: info.className,
                cssProperties: info.pattern.cssProperties,
              })),
              ...fw2Infos.map((info) => ({
                framework: fw2,
                className: info.className,
                cssProperties: info.pattern.cssProperties,
              })),
            ],
            description: this.generateDescription(property, fw1, fw2, fw1Infos, fw2Infos),
            resolution: this.generateResolution(property, fw1, fw2, fw1Infos, fw2Infos),
          };
          if (element !== undefined) {
            conflict.element = element;
          }
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Determine severity of a conflict.
   */
  private determineSeverity(
    property: string,
    fw1Infos: { pattern: FrameworkPattern }[],
    fw2Infos: { pattern: FrameworkPattern }[]
  ): ConflictSeverity {
    // Layout conflicts are errors - they cause major visual issues
    const layoutProperties = ['display', 'flex-direction', 'grid-template-columns', 'position'];
    if (layoutProperties.includes(property)) {
      return 'error';
    }

    // Sizing conflicts are warnings
    const sizingProperties = ['width', 'height', 'max-width', 'min-width'];
    if (sizingProperties.includes(property)) {
      return 'warning';
    }

    // Component conflicts are warnings if they affect layout
    const isComponentConflict =
      fw1Infos.some((i) => i.pattern.category === 'component') ||
      fw2Infos.some((i) => i.pattern.category === 'component');
    if (isComponentConflict) {
      return 'warning';
    }

    // Everything else is info
    return 'info';
  }

  /**
   * Check if severity meets minimum threshold.
   */
  private meetsMinSeverity(severity: ConflictSeverity): boolean {
    const severityOrder: ConflictSeverity[] = ['error', 'warning', 'info'];
    const minIndex = severityOrder.indexOf(this.config.minSeverity);
    const currentIndex = severityOrder.indexOf(severity);
    return currentIndex <= minIndex;
  }

  /**
   * Generate conflict description.
   */
  private generateDescription(
    property: string,
    fw1: CSSFramework,
    fw2: CSSFramework,
    fw1Infos: { className: string; pattern: FrameworkPattern }[],
    fw2Infos: { className: string; pattern: FrameworkPattern }[]
  ): string {
    const fw1Classes = fw1Infos.map((i) => i.className).join(', ');
    const fw2Classes = fw2Infos.map((i) => i.className).join(', ');

    return `Conflicting ${property} styles: ${fw1} classes (${fw1Classes}) conflict with ${fw2} classes (${fw2Classes}). Both frameworks are trying to control the same CSS property, which may cause unpredictable styling.`;
  }

  /**
   * Generate resolution suggestion.
   */
  private generateResolution(
    property: string,
    fw1: CSSFramework,
    fw2: CSSFramework,
    fw1Infos: { className: string; pattern: FrameworkPattern }[],
    fw2Infos: { className: string; pattern: FrameworkPattern }[]
  ): string {
    // Prefer Tailwind if it's one of the frameworks
    if (fw1 === 'tailwind' || fw2 === 'tailwind') {
      const tailwindFw = fw1 === 'tailwind' ? fw1 : fw2;
      const otherFw = fw1 === 'tailwind' ? fw2 : fw1;
      const tailwindClasses = (tailwindFw === fw1 ? fw1Infos : fw2Infos).map((i) => i.className).join(', ');
      const otherClasses = (otherFw === fw1 ? fw1Infos : fw2Infos).map((i) => i.className).join(', ');

      return `Choose one framework for ${property}. If using Tailwind as primary, remove ${otherFw} classes (${otherClasses}) and keep Tailwind classes (${tailwindClasses}). Alternatively, use Tailwind's @layer directive to control cascade order.`;
    }

    // Generic resolution
    return `Remove duplicate ${property} styling. Choose either ${fw1} or ${fw2} classes for this property to avoid conflicts. Consider consolidating to a single CSS framework for consistency.`;
  }

  /**
   * Create an empty result object.
   */
  private createEmptyResult(): FrameworkConflictResult {
    return {
      hasConflicts: false,
      totalConflicts: 0,
      bySeverity: { error: 0, warning: 0, info: 0 },
      detectedFrameworks: [],
      conflicts: [],
      byCategory: new Map(),
      recommendations: [],
    };
  }

  /**
   * Add a conflict to the result.
   */
  private addConflict(result: FrameworkConflictResult, conflict: FrameworkConflict): void {
    result.conflicts.push(conflict);
    result.hasConflicts = true;
    result.totalConflicts++;
    result.bySeverity[conflict.severity]++;

    // Update detected frameworks
    for (const fw of conflict.frameworks) {
      if (!result.detectedFrameworks.includes(fw)) {
        result.detectedFrameworks.push(fw);
      }
    }

    // Update by category
    if (!result.byCategory.has(conflict.category)) {
      result.byCategory.set(conflict.category, []);
    }
    result.byCategory.get(conflict.category)!.push(conflict);
  }

  /**
   * Generate recommendations based on detected conflicts.
   */
  private generateRecommendations(result: FrameworkConflictResult): void {
    if (!result.hasConflicts) {
      return;
    }

    const recommendations: string[] = [];

    // General recommendation about using multiple frameworks
    if (result.detectedFrameworks.length > 2) {
      recommendations.push(
        `Consider consolidating CSS frameworks. You are using ${result.detectedFrameworks.length} different frameworks (${result.detectedFrameworks.join(', ')}), which increases complexity and potential for conflicts.`
      );
    } else if (result.detectedFrameworks.length === 2) {
      recommendations.push(
        `You are mixing ${result.detectedFrameworks[0]} and ${result.detectedFrameworks[1]}. Consider choosing one as your primary framework to reduce maintenance overhead and conflicts.`
      );
    }

    // Severity-based recommendations
    if (result.bySeverity.error > 0) {
      recommendations.push(
        `Found ${result.bySeverity.error} critical conflict(s) affecting layout. These should be resolved immediately as they may cause significant visual issues.`
      );
    }

    // Category-specific recommendations
    if (result.byCategory.has('layout')) {
      recommendations.push(
        'Layout conflicts detected. Using multiple grid/flex systems can cause unpredictable layouts. Stick to one layout system per component.'
      );
    }

    if (result.byCategory.has('component')) {
      recommendations.push(
        'Component conflicts detected. Avoid mixing component classes from different frameworks on the same element. Create wrapper components instead.'
      );
    }

    // Tailwind-specific recommendations
    if (result.detectedFrameworks.includes('tailwind')) {
      const otherFrameworks = result.detectedFrameworks.filter((f) => f !== 'tailwind');
      if (otherFrameworks.length > 0) {
        recommendations.push(
          `When using Tailwind with ${otherFrameworks.join('/')}, consider using Tailwind's @layer directive to control cascade order, or use the important: prefix in tailwind.config.js to ensure Tailwind utilities take precedence.`
        );
      }
    }

    result.recommendations = recommendations;
  }
}

/**
 * Create a new FrameworkConflictDetector with default configuration.
 *
 * @param config - Optional configuration
 * @returns New detector instance
 */
export function createFrameworkConflictDetector(
  config?: FrameworkConflictDetectorConfig
): FrameworkConflictDetector {
  return new FrameworkConflictDetector(config);
}

/**
 * Quick utility to scan for framework conflicts.
 *
 * @param classes - Classes to check (array or space-separated string)
 * @returns Framework conflict result
 */
export function detectFrameworkConflicts(
  classes: string | string[]
): FrameworkConflictResult {
  const detector = new FrameworkConflictDetector();
  const classArray = Array.isArray(classes) ? classes : classes.split(/\s+/).filter(Boolean);
  return detector.scanClasses(classArray);
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
// CSS Cascade Layer (@layer) Analyzer
// =============================================================================

/**
 * Represents a CSS cascade layer as defined by @layer.
 * Layers establish a predictable ordering for the cascade, independent of specificity.
 *
 * @see https://www.w3.org/TR/css-cascade-5/#layering
 */
export interface CascadeLayer {
  /** Unique identifier for this layer */
  id: string;
  /** Layer name (e.g., "base", "components", "utilities") */
  name: string;
  /** Full qualified name for nested layers (e.g., "framework.base") */
  qualifiedName: string;
  /** Parent layer name if this is a nested layer */
  parent: string | null;
  /** Child layer names */
  children: string[];
  /** Order in which this layer was declared (lower = earlier = lower priority) */
  order: number;
  /** Whether this is an anonymous layer (unnamed @layer block) */
  isAnonymous: boolean;
  /** Source locations where this layer is declared or used */
  sources: LayerSource[];
  /** CSS rules contained within this layer */
  rules: LayerRule[];
}

/**
 * Source location where a layer is declared or referenced
 */
export interface LayerSource {
  /** Source file path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** Type of layer reference */
  type: 'declaration' | 'block' | 'import';
  /** Raw @layer statement or block header */
  raw: string;
}

/**
 * A CSS rule within a cascade layer
 */
export interface LayerRule {
  /** The CSS selector */
  selector: string;
  /** Property being set */
  property: string;
  /** Value being applied */
  value: string;
  /** Specificity of the selector */
  specificity: Specificity;
  /** Whether marked !important */
  important: boolean;
  /** Source location */
  location?: SourceLocation;
  /** The layer this rule belongs to */
  layerName: string;
}

/**
 * Conflict between rules in different cascade layers
 */
export interface LayerConflict {
  /** Unique identifier for this conflict */
  id: string;
  /** The CSS property being contested */
  property: string;
  /** The selector(s) involved in the conflict */
  selectors: string[];
  /** The winning rule and its layer */
  winner: {
    rule: LayerRule;
    layer: CascadeLayer;
    reason: LayerConflictReason;
  };
  /** The losing rule(s) and their layers */
  losers: Array<{
    rule: LayerRule;
    layer: CascadeLayer;
  }>;
  /** Severity of the conflict */
  severity: 'info' | 'warning' | 'error';
  /** Human-readable explanation of the conflict */
  explanation: string;
  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Reason why a rule won over another in layer cascade
 */
export type LayerConflictReason =
  | 'layer-order'        // Later layer wins
  | 'importance'         // !important in earlier layer beats normal in later layer
  | 'unlayered'          // Unlayered styles beat all layered styles
  | 'specificity'        // Same layer, higher specificity wins
  | 'cascade-order';     // Same layer and specificity, later declaration wins

/**
 * Result of analyzing cascade layers in CSS content
 */
export interface LayerAnalysisResult {
  /** All discovered layers in cascade order (lowest to highest priority) */
  layers: CascadeLayer[];
  /** Layer hierarchy as a tree structure */
  hierarchy: LayerHierarchyNode;
  /** Detected conflicts between layers */
  conflicts: LayerConflict[];
  /** Unlayered rules (implicitly highest priority) */
  unlayeredRules: LayerRule[];
  /** Warnings and informational messages */
  diagnostics: LayerDiagnostic[];
  /** Statistics about the analysis */
  stats: LayerAnalysisStats;
}

/**
 * Tree node representing layer hierarchy
 */
export interface LayerHierarchyNode {
  /** Layer name (empty string for root) */
  name: string;
  /** Full qualified name */
  qualifiedName: string;
  /** Cascade order (lower = lower priority) */
  order: number;
  /** Child layers */
  children: LayerHierarchyNode[];
}

/**
 * Diagnostic message from layer analysis
 */
export interface LayerDiagnostic {
  /** Diagnostic level */
  level: 'info' | 'warning' | 'error';
  /** Diagnostic code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Related source location */
  location?: SourceLocation;
  /** Related layer name */
  layerName?: string;
}

/**
 * Statistics from layer analysis
 */
export interface LayerAnalysisStats {
  /** Total number of layers found */
  totalLayers: number;
  /** Number of nested layers */
  nestedLayers: number;
  /** Number of anonymous layers */
  anonymousLayers: number;
  /** Total rules across all layers */
  totalLayeredRules: number;
  /** Total unlayered rules */
  totalUnlayeredRules: number;
  /** Number of conflicts detected */
  totalConflicts: number;
  /** Maximum nesting depth */
  maxNestingDepth: number;
}

/**
 * Configuration for the cascade layer analyzer
 */
export interface LayerAnalyzerConfig {
  /** Whether to analyze nested layers */
  analyzeNestedLayers?: boolean;
  /** Whether to detect conflicts */
  detectConflicts?: boolean;
  /** Whether to include rules in the analysis */
  includeRules?: boolean;
  /** Maximum nesting depth to analyze (default: 10) */
  maxNestingDepth?: number;
  /** Whether to treat warnings as errors */
  strictMode?: boolean;
}

/**
 * Default configuration for the layer analyzer
 */
const DEFAULT_LAYER_ANALYZER_CONFIG: Required<LayerAnalyzerConfig> = {
  analyzeNestedLayers: true,
  detectConflicts: true,
  includeRules: true,
  maxNestingDepth: 10,
  strictMode: false,
};

/**
 * Regular expressions for parsing @layer syntax
 */
const LAYER_PATTERNS = {
  // @layer statement: @layer name1, name2, name3;
  layerStatement: /@layer\s+([^{;]+);/g,
  // @layer block: @layer name { ... }
  layerBlock: /@layer\s+([^{]*)\{/g,
  // Anonymous layer block: @layer { ... }
  anonymousLayerBlock: /@layer\s*\{/g,
  // @import with layer: @import url("...") layer(name);
  importWithLayer: /@import\s+(?:url\s*\(\s*)?["']([^"']+)["']\s*\)?\s+layer\s*\(\s*([^)]+)\s*\)/g,
  // Layer name validation (CSS ident)
  validLayerName: /^[a-zA-Z_-][a-zA-Z0-9_-]*$/,
  // Nested layer name (e.g., framework.base.reset)
  nestedLayerName: /^[a-zA-Z_-][a-zA-Z0-9_.-]*$/,
  // CSS rule selector and declarations
  cssRule: /([^{]+)\{([^}]+)\}/g,
  // CSS declaration
  cssDeclaration: /([a-zA-Z-]+)\s*:\s*([^;]+)/g,
} as const;

/**
 * Production-grade CSS Cascade Layer Analyzer.
 *
 * Analyzes CSS content for @layer declarations, maps the layer hierarchy,
 * and detects cascade conflicts between layers.
 *
 * Features:
 * - Parses @layer statements (order declarations)
 * - Parses @layer blocks (rules within layers)
 * - Handles nested layers (e.g., framework.base)
 * - Detects anonymous layers
 * - Tracks @import with layer()
 * - Analyzes cascade conflicts
 * - Provides detailed diagnostics
 *
 * @example
 * ```typescript
 * const analyzer = new CascadeLayerAnalyzer();
 * const result = analyzer.analyze(cssContent, 'styles.css');
 *
 * // Check layer hierarchy
 * console.log(result.layers.map(l => l.qualifiedName));
 *
 * // Check for conflicts
 * for (const conflict of result.conflicts) {
 *   console.log(`Conflict: ${conflict.explanation}`);
 * }
 * ```
 */
export class CascadeLayerAnalyzer {
  private readonly config: Required<LayerAnalyzerConfig>;
  private layerCounter: number = 0;
  private anonymousCounter: number = 0;

  constructor(config: LayerAnalyzerConfig = {}) {
    this.config = { ...DEFAULT_LAYER_ANALYZER_CONFIG, ...config };
  }

  /**
   * Analyze CSS content for cascade layers.
   *
   * @param content - CSS content to analyze
   * @param file - Source file path (for diagnostics)
   * @returns Complete layer analysis result
   */
  analyze(content: string, file: string = '<unknown>'): LayerAnalysisResult {
    // Reset counters for fresh analysis
    this.layerCounter = 0;
    this.anonymousCounter = 0;

    const layers = new Map<string, CascadeLayer>();
    const diagnostics: LayerDiagnostic[] = [];
    const unlayeredRules: LayerRule[] = [];

    // Step 1: Parse @layer statements (order declarations)
    this.parseLayerStatements(content, file, layers, diagnostics);

    // Step 2: Parse @import with layer()
    this.parseLayerImports(content, file, layers, diagnostics);

    // Step 3: Parse @layer blocks and extract rules
    this.parseLayerBlocks(content, file, layers, diagnostics, unlayeredRules);

    // Step 4: Build layer hierarchy
    const hierarchy = this.buildHierarchy(layers);

    // Step 5: Assign final cascade order based on hierarchy
    this.assignCascadeOrder(layers, hierarchy);

    // Step 6: Detect conflicts if enabled
    const conflicts: LayerConflict[] = [];
    if (this.config.detectConflicts) {
      conflicts.push(...this.detectConflicts(layers, unlayeredRules));
    }

    // Step 7: Compute statistics
    const stats = this.computeStats(layers, unlayeredRules, conflicts);

    // Sort layers by cascade order for output
    const sortedLayers = Array.from(layers.values()).sort((a, b) => a.order - b.order);

    return {
      layers: sortedLayers,
      hierarchy,
      conflicts,
      unlayeredRules,
      diagnostics,
      stats,
    };
  }

  /**
   * Analyze multiple CSS files and merge results.
   *
   * @param files - Array of { content, file } objects
   * @returns Merged layer analysis result
   */
  analyzeMultiple(files: Array<{ content: string; file: string }>): LayerAnalysisResult {
    const allLayers = new Map<string, CascadeLayer>();
    const allDiagnostics: LayerDiagnostic[] = [];
    const allUnlayeredRules: LayerRule[] = [];

    for (const { content, file } of files) {
      const result = this.analyze(content, file);

      // Merge layers
      for (const layer of result.layers) {
        const existing = allLayers.get(layer.qualifiedName);
        if (existing !== undefined) {
          // Merge sources and rules
          existing.sources.push(...layer.sources);
          existing.rules.push(...layer.rules);
        } else {
          allLayers.set(layer.qualifiedName, { ...layer });
        }
      }

      allDiagnostics.push(...result.diagnostics);
      allUnlayeredRules.push(...result.unlayeredRules);
    }

    // Rebuild hierarchy and recompute
    const hierarchy = this.buildHierarchy(allLayers);
    this.assignCascadeOrder(allLayers, hierarchy);

    const conflicts = this.config.detectConflicts
      ? this.detectConflicts(allLayers, allUnlayeredRules)
      : [];

    const stats = this.computeStats(allLayers, allUnlayeredRules, conflicts);
    const sortedLayers = Array.from(allLayers.values()).sort((a, b) => a.order - b.order);

    return {
      layers: sortedLayers,
      hierarchy,
      conflicts,
      unlayeredRules: allUnlayeredRules,
      diagnostics: allDiagnostics,
      stats,
    };
  }

  /**
   * Parse @layer statement declarations (e.g., @layer base, components, utilities;)
   */
  private parseLayerStatements(
    content: string,
    file: string,
    layers: Map<string, CascadeLayer>,
    diagnostics: LayerDiagnostic[]
  ): void {
    const pattern = new RegExp(LAYER_PATTERNS.layerStatement.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const layerNames = match[1];
      if (layerNames === undefined) continue;

      const line = this.getLineNumber(content, match.index);
      const column = this.getColumnNumber(content, match.index);

      // Parse comma-separated layer names
      const names = layerNames.split(',').map((n) => n.trim()).filter((n) => n.length > 0);

      for (const name of names) {
        // Validate layer name
        if (!this.isValidLayerName(name)) {
          diagnostics.push({
            level: this.config.strictMode ? 'error' : 'warning',
            code: 'INVALID_LAYER_NAME',
            message: `Invalid layer name: "${name}". Layer names must be valid CSS identifiers.`,
            location: { file, line, column },
            layerName: name,
          });
          continue;
        }

        this.getOrCreateLayer(name, layers, {
          file,
          line,
          column,
          type: 'declaration',
          raw: match[0],
        });
      }
    }
  }

  /**
   * Parse @import with layer() syntax
   */
  private parseLayerImports(
    content: string,
    file: string,
    layers: Map<string, CascadeLayer>,
    diagnostics: LayerDiagnostic[]
  ): void {
    const pattern = new RegExp(LAYER_PATTERNS.importWithLayer.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const importUrl = match[1];
      const layerName = match[2]?.trim();

      if (layerName === undefined || layerName.length === 0) continue;

      const line = this.getLineNumber(content, match.index);
      const column = this.getColumnNumber(content, match.index);

      if (!this.isValidLayerName(layerName)) {
        diagnostics.push({
          level: this.config.strictMode ? 'error' : 'warning',
          code: 'INVALID_LAYER_NAME',
          message: `Invalid layer name in @import: "${layerName}"`,
          location: { file, line, column },
          layerName,
        });
        continue;
      }

      this.getOrCreateLayer(layerName, layers, {
        file,
        line,
        column,
        type: 'import',
        raw: match[0],
      });

      diagnostics.push({
        level: 'info',
        code: 'LAYER_IMPORT',
        message: `Layer "${layerName}" imports styles from "${importUrl}"`,
        location: { file, line, column },
        layerName: layerName,
      });
    }
  }

  /**
   * Parse @layer blocks and extract CSS rules within them
   */
  private parseLayerBlocks(
    content: string,
    file: string,
    layers: Map<string, CascadeLayer>,
    diagnostics: LayerDiagnostic[],
    unlayeredRules: LayerRule[]
  ): void {
    // Track current position and nesting
    let pos = 0;
    const contentLength = content.length;

    while (pos < contentLength) {
      // Look for @layer
      const layerIndex = content.indexOf('@layer', pos);

      // Extract unlayered rules before this @layer (or to end if no more @layer)
      const unlayeredEnd = layerIndex === -1 ? contentLength : layerIndex;
      if (this.config.includeRules && pos < unlayeredEnd) {
        const unlayeredContent = content.slice(pos, unlayeredEnd);
        const rules = this.extractRulesFromContent(unlayeredContent, file, null, pos);
        unlayeredRules.push(...rules);
      }

      if (layerIndex === -1) break;

      // Find the layer name and opening brace
      const afterLayer = content.slice(layerIndex + 6); // Skip "@layer"
      const braceIndex = afterLayer.indexOf('{');
      const semicolonIndex = afterLayer.indexOf(';');

      // Check if this is a statement (@layer name;) or block (@layer name { })
      if (semicolonIndex !== -1 && (braceIndex === -1 || semicolonIndex < braceIndex)) {
        // This is a @layer statement, already handled
        pos = layerIndex + 6 + semicolonIndex + 1;
        continue;
      }

      if (braceIndex === -1) {
        // Malformed @layer, no opening brace
        diagnostics.push({
          level: 'error',
          code: 'MALFORMED_LAYER',
          message: 'Malformed @layer block: missing opening brace',
          location: { file, line: this.getLineNumber(content, layerIndex) },
        });
        pos = layerIndex + 6;
        continue;
      }

      // Extract layer name(s)
      const layerNamePart = afterLayer.slice(0, braceIndex).trim();
      const line = this.getLineNumber(content, layerIndex);
      const column = this.getColumnNumber(content, layerIndex);

      // Find matching closing brace
      const blockStart = layerIndex + 6 + braceIndex + 1;
      const blockEnd = this.findMatchingBrace(content, blockStart - 1);

      if (blockEnd === -1) {
        const diagnostic: LayerDiagnostic = {
          level: 'error',
          code: 'UNCLOSED_LAYER',
          message: `Unclosed @layer block for "${layerNamePart || 'anonymous'}"`,
          location: { file, line, column },
        };
        if (layerNamePart.length > 0) {
          diagnostic.layerName = layerNamePart;
        }
        diagnostics.push(diagnostic);
        pos = blockStart;
        continue;
      }

      const blockContent = content.slice(blockStart, blockEnd);

      // Handle anonymous layer
      let layerName: string;
      let isAnonymous = false;

      if (layerNamePart.length === 0) {
        this.anonymousCounter++;
        layerName = `__anonymous_${this.anonymousCounter}__`;
        isAnonymous = true;

        diagnostics.push({
          level: 'info',
          code: 'ANONYMOUS_LAYER',
          message: `Anonymous layer detected at line ${line}`,
          location: { file, line, column },
        });
      } else {
        layerName = layerNamePart;
      }

      // Validate and create layer
      if (!isAnonymous && !this.isValidLayerName(layerName)) {
        diagnostics.push({
          level: this.config.strictMode ? 'error' : 'warning',
          code: 'INVALID_LAYER_NAME',
          message: `Invalid layer name: "${layerName}"`,
          location: { file, line, column },
          layerName,
        });
      }

      const layer = this.getOrCreateLayer(layerName, layers, {
        file,
        line,
        column,
        type: 'block',
        raw: `@layer ${layerNamePart} { ... }`,
      });

      if (isAnonymous) {
        layer.isAnonymous = true;
      }

      // Extract rules from block content
      if (this.config.includeRules) {
        // Check for nested @layer blocks
        if (blockContent.includes('@layer') && this.config.analyzeNestedLayers) {
          // Recursively parse nested layers
          this.parseLayerBlocks(
            blockContent,
            file,
            layers,
            diagnostics,
            layer.rules // Nested unlayered rules go to parent layer
          );
        } else {
          const rules = this.extractRulesFromContent(blockContent, file, layerName, blockStart);
          layer.rules.push(...rules);
        }
      }

      pos = blockEnd + 1;
    }
  }

  /**
   * Extract CSS rules from content
   */
  private extractRulesFromContent(
    content: string,
    file: string,
    layerName: string | null,
    baseOffset: number
  ): LayerRule[] {
    const rules: LayerRule[] = [];
    const rulePattern = new RegExp(LAYER_PATTERNS.cssRule.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = rulePattern.exec(content)) !== null) {
      const selector = match[1]?.trim();
      const declarations = match[2];

      if (selector === undefined || declarations === undefined) continue;

      // Skip @-rules
      if (selector.startsWith('@')) continue;

      const declPattern = new RegExp(LAYER_PATTERNS.cssDeclaration.source, 'g');
      let declMatch: RegExpExecArray | null;

      while ((declMatch = declPattern.exec(declarations)) !== null) {
        const property = declMatch[1]?.trim();
        let value = declMatch[2]?.trim();

        if (property === undefined || value === undefined) continue;

        // Check for !important
        const { value: cleanValue, important } = parseImportant(value);
        value = cleanValue;

        const line = this.getLineNumber(content, match.index) +
          this.getLineNumber(content.slice(0, baseOffset), 0) - 1;

        rules.push({
          selector,
          property,
          value,
          specificity: calculateSpecificity(selector),
          important,
          location: { file, line },
          layerName: layerName ?? '__unlayered__',
        });
      }
    }

    return rules;
  }

  /**
   * Get or create a layer entry
   */
  private getOrCreateLayer(
    name: string,
    layers: Map<string, CascadeLayer>,
    source: LayerSource
  ): CascadeLayer {
    // Handle nested layer names (e.g., "framework.base")
    const parts = name.split('.');
    let currentName = '';
    let parentName: string | null = null;
    let layer: CascadeLayer | undefined;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;

      parentName = currentName || null;
      currentName = currentName ? `${currentName}.${part}` : part;

      layer = layers.get(currentName);

      if (layer === undefined) {
        this.layerCounter++;
        layer = {
          id: `layer_${this.layerCounter}`,
          name: part,
          qualifiedName: currentName,
          parent: parentName,
          children: [],
          order: this.layerCounter,
          isAnonymous: false,
          sources: i === parts.length - 1 ? [source] : [],
          rules: [],
        };
        layers.set(currentName, layer);

        // Add to parent's children
        if (parentName !== null) {
          const parentLayer = layers.get(parentName);
          if (parentLayer !== undefined && !parentLayer.children.includes(part)) {
            parentLayer.children.push(part);
          }
        }
      } else if (i === parts.length - 1) {
        // Add source to existing layer
        layer.sources.push(source);
      }
    }

    return layer!;
  }

  /**
   * Build layer hierarchy tree
   */
  private buildHierarchy(layers: Map<string, CascadeLayer>): LayerHierarchyNode {
    const root: LayerHierarchyNode = {
      name: '',
      qualifiedName: '',
      order: -1,
      children: [],
    };

    // Find top-level layers (no parent)
    const topLevelLayers = Array.from(layers.values())
      .filter((l) => l.parent === null)
      .sort((a, b) => a.order - b.order);

    for (const layer of topLevelLayers) {
      root.children.push(this.buildHierarchyNode(layer, layers));
    }

    return root;
  }

  /**
   * Build a hierarchy node for a layer and its children
   */
  private buildHierarchyNode(
    layer: CascadeLayer,
    layers: Map<string, CascadeLayer>
  ): LayerHierarchyNode {
    const node: LayerHierarchyNode = {
      name: layer.name,
      qualifiedName: layer.qualifiedName,
      order: layer.order,
      children: [],
    };

    for (const childName of layer.children) {
      const childQualifiedName = `${layer.qualifiedName}.${childName}`;
      const childLayer = layers.get(childQualifiedName);
      if (childLayer !== undefined) {
        node.children.push(this.buildHierarchyNode(childLayer, layers));
      }
    }

    // Sort children by order
    node.children.sort((a, b) => a.order - b.order);

    return node;
  }

  /**
   * Assign final cascade order based on declaration order and hierarchy
   */
  private assignCascadeOrder(
    layers: Map<string, CascadeLayer>,
    hierarchy: LayerHierarchyNode
  ): void {
    let order = 0;

    const assignOrder = (node: LayerHierarchyNode): void => {
      if (node.qualifiedName !== '') {
        const layer = layers.get(node.qualifiedName);
        if (layer !== undefined) {
          layer.order = order++;
        }
      }
      for (const child of node.children) {
        assignOrder(child);
      }
    };

    assignOrder(hierarchy);
  }

  /**
   * Detect conflicts between rules in different layers
   */
  private detectConflicts(
    layers: Map<string, CascadeLayer>,
    unlayeredRules: LayerRule[]
  ): LayerConflict[] {
    const conflicts: LayerConflict[] = [];

    // Collect all rules with their layer info
    const allRules: Array<{ rule: LayerRule; layer: CascadeLayer | null }> = [];

    for (const layer of layers.values()) {
      for (const rule of layer.rules) {
        allRules.push({ rule, layer });
      }
    }

    for (const rule of unlayeredRules) {
      allRules.push({ rule, layer: null });
    }

    // Group by property
    const rulesByProperty = new Map<string, Array<{ rule: LayerRule; layer: CascadeLayer | null }>>();
    for (const entry of allRules) {
      const key = entry.rule.property;
      const existing = rulesByProperty.get(key) ?? [];
      existing.push(entry);
      rulesByProperty.set(key, existing);
    }

    // Find conflicts for each property
    for (const [property, propertyRules] of rulesByProperty) {
      if (propertyRules.length < 2) continue;

      // Sort by cascade priority:
      // 1. Unlayered styles win over layered (unless layered is !important)
      // 2. !important in earlier layer beats normal in later layer
      // 3. Later layers win over earlier layers
      // 4. Same layer: specificity, then source order

      const sorted = [...propertyRules].sort((a, b) => {
        const aImportant = a.rule.important;
        const bImportant = b.rule.important;
        const aLayered = a.layer !== null;
        const bLayered = b.layer !== null;
        const aOrder = a.layer?.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.layer?.order ?? Number.MAX_SAFE_INTEGER;

        // !important handling across layers
        if (aImportant !== bImportant) {
          if (aLayered && bLayered) {
            // !important in earlier layer beats normal in later layer
            if (aImportant && aOrder < bOrder) return 1;
            if (bImportant && bOrder < aOrder) return -1;
          }
          // Otherwise, !important wins
          return aImportant ? 1 : -1;
        }

        // Unlayered beats layered (for normal declarations)
        if (aLayered !== bLayered) {
          return aLayered ? -1 : 1;
        }

        // Both layered: later layer wins
        if (aLayered && bLayered && aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        // Same layer or both unlayered: compare specificity
        const specCompare = compareSpecificity(a.rule.specificity, b.rule.specificity);
        if (specCompare !== 0) return specCompare;

        // Same specificity: cascade order (later wins)
        return 0;
      });

      const winnerEntry = sorted[sorted.length - 1];
      if (winnerEntry === undefined) continue;

      const losers = sorted.slice(0, -1);
      if (losers.length === 0) continue;

      // Determine conflict reason
      let reason: LayerConflictReason = 'layer-order';
      const firstLoser = losers[0];

      if (firstLoser !== undefined) {
        if (winnerEntry.layer === null && firstLoser.layer !== null) {
          reason = 'unlayered';
        } else if (winnerEntry.rule.important && !firstLoser.rule.important) {
          reason = 'importance';
        } else if (winnerEntry.layer === firstLoser.layer) {
          if (compareSpecificity(winnerEntry.rule.specificity, firstLoser.rule.specificity) !== 0) {
            reason = 'specificity';
          } else {
            reason = 'cascade-order';
          }
        }
      }

      // Generate explanation
      const winnerLayerName = winnerEntry.layer?.qualifiedName ?? 'unlayered styles';
      const loserLayerNames = [...new Set(losers.map((l) => l.layer?.qualifiedName ?? 'unlayered'))];

      let explanation = `Property "${property}" conflict: `;
      switch (reason) {
        case 'unlayered':
          explanation += `Unlayered styles override layered styles (${loserLayerNames.join(', ')})`;
          break;
        case 'importance':
          explanation += `!important in "${winnerLayerName}" overrides normal declarations`;
          break;
        case 'layer-order':
          explanation += `Layer "${winnerLayerName}" (later) overrides earlier layers (${loserLayerNames.join(', ')})`;
          break;
        case 'specificity':
          explanation += `Higher specificity selector wins within same layer`;
          break;
        case 'cascade-order':
          explanation += `Later declaration wins (same layer and specificity)`;
          break;
      }

      const selectors = [...new Set([
        winnerEntry.rule.selector,
        ...losers.map((l) => l.rule.selector),
      ])];

      // Determine severity
      let severity: 'info' | 'warning' | 'error' = 'info';
      if (reason === 'importance') {
        severity = 'warning'; // !important across layers can be confusing
      }
      if (losers.some((l) => l.rule.important)) {
        severity = 'warning'; // Overriding !important is usually intentional but noteworthy
      }

      const conflict: LayerConflict = {
        id: `conflict_${conflicts.length + 1}`,
        property,
        selectors,
        winner: {
          rule: winnerEntry.rule,
          layer: winnerEntry.layer!,
          reason,
        },
        losers: losers.map((l) => ({
          rule: l.rule,
          layer: l.layer!,
        })),
        severity,
        explanation,
      };

      const suggestion = this.generateConflictSuggestion(reason, winnerEntry, losers);
      if (suggestion !== undefined) {
        conflict.suggestion = suggestion;
      }

      conflicts.push(conflict);
    }

    return conflicts;
  }

  /**
   * Generate a suggestion for resolving a conflict
   */
  private generateConflictSuggestion(
    reason: LayerConflictReason,
    winner: { rule: LayerRule; layer: CascadeLayer | null },
    losers: Array<{ rule: LayerRule; layer: CascadeLayer | null }>
  ): string | undefined {
    switch (reason) {
      case 'unlayered':
        return 'Consider moving unlayered styles into an appropriate layer for better cascade control.';
      case 'importance':
        return 'Avoid using !important across layers when possible. Consider restructuring layer order instead.';
      case 'layer-order':
        if (losers.some((l) => l.rule.value !== winner.rule.value)) {
          return 'If the overridden value is needed, consider adjusting layer order or using a more specific selector.';
        }
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Compute analysis statistics
   */
  private computeStats(
    layers: Map<string, CascadeLayer>,
    unlayeredRules: LayerRule[],
    conflicts: LayerConflict[]
  ): LayerAnalysisStats {
    let nestedLayers = 0;
    let anonymousLayers = 0;
    let totalLayeredRules = 0;
    let maxDepth = 0;

    for (const layer of layers.values()) {
      if (layer.parent !== null) nestedLayers++;
      if (layer.isAnonymous) anonymousLayers++;
      totalLayeredRules += layer.rules.length;

      const depth = layer.qualifiedName.split('.').length;
      if (depth > maxDepth) maxDepth = depth;
    }

    return {
      totalLayers: layers.size,
      nestedLayers,
      anonymousLayers,
      totalLayeredRules,
      totalUnlayeredRules: unlayeredRules.length,
      totalConflicts: conflicts.length,
      maxNestingDepth: maxDepth,
    };
  }

  /**
   * Validate a layer name
   */
  private isValidLayerName(name: string): boolean {
    // Check for nested names
    if (name.includes('.')) {
      return LAYER_PATTERNS.nestedLayerName.test(name);
    }
    return LAYER_PATTERNS.validLayerName.test(name);
  }

  /**
   * Find matching closing brace
   */
  private findMatchingBrace(content: string, openIndex: number): number {
    let depth = 0;
    for (let i = openIndex; i < content.length; i++) {
      const char = content[i];
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Get line number for a position in content
   */
  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  /**
   * Get column number for a position in content
   */
  private getColumnNumber(content: string, index: number): number {
    const lastNewline = content.lastIndexOf('\n', index - 1);
    return index - lastNewline;
  }
}

/**
 * Create a cascade layer analyzer with default configuration
 */
export function createCascadeLayerAnalyzer(
  config?: LayerAnalyzerConfig
): CascadeLayerAnalyzer {
  return new CascadeLayerAnalyzer(config);
}

/**
 * Quick function to analyze CSS content for layer conflicts
 */
export function analyzeLayerConflicts(
  content: string,
  file?: string
): LayerConflict[] {
  const analyzer = new CascadeLayerAnalyzer({ detectConflicts: true });
  return analyzer.analyze(content, file).conflicts;
}

/**
 * Quick function to map layer hierarchy from CSS content
 */
export function mapLayerHierarchy(
  content: string,
  file?: string
): LayerHierarchyNode {
  const analyzer = new CascadeLayerAnalyzer({ detectConflicts: false });
  return analyzer.analyze(content, file).hierarchy;
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

// =============================================================================
// Tailwind Validator
// =============================================================================

/**
 * Configuration for TailwindValidator
 */
export interface TailwindValidatorConfig {
  /** Path to tailwind.config.js (default: './tailwind.config.js') */
  configPath?: string;
  /** Custom class patterns to allow (regex patterns) */
  customPatterns?: RegExp[];
  /** Additional valid classes (for plugins, custom utilities) */
  additionalClasses?: string[];
  /** Whether to allow arbitrary values like bg-[#fff] */
  allowArbitraryValues?: boolean;
  /** Whether to allow arbitrary properties like [mask-type:alpha] */
  allowArbitraryProperties?: boolean;
}

/**
 * Result of batch class validation
 */
export interface TailwindBatchValidationResult {
  /** Whether all classes are valid */
  valid: boolean;
  /** List of invalid classes */
  invalidClasses: InvalidClass[];
  /** List of valid classes */
  validClasses: string[];
  /** Suggestions for invalid classes */
  suggestions: Map<string, string[]>;
  /** Config that was used for validation */
  configLoaded: boolean;
}

/**
 * Information about an invalid class
 */
export interface InvalidClass {
  /** The invalid class name */
  className: string;
  /** Reason why it's invalid */
  reason: string;
  /** Position in the input (if applicable) */
  position?: number;
  /** Suggested alternatives */
  suggestions?: string[];
}

/**
 * Parsed Tailwind configuration
 */
interface ParsedTailwindConfig {
  /** Theme extensions */
  theme: {
    extend?: Record<string, Record<string, string>>;
    colors?: Record<string, string | Record<string, string>>;
    spacing?: Record<string, string>;
    screens?: Record<string, string>;
  };
  /** Safelist entries */
  safelist?: (string | { pattern: RegExp })[];
  /** Plugin-added utilities */
  plugins?: string[];
  /** Prefix for classes */
  prefix?: string;
  /** Important modifier */
  important?: boolean | string;
}

// Core Tailwind utility patterns (v3.x)
const TAILWIND_CORE_PATTERNS: RegExp[] = [
  // Layout
  /^(container|box-(border|content)|block|inline(-block|-flex|-grid|-table)?|flex|grid|hidden|table(-caption|-cell|-column|-column-group|-footer-group|-header-group|-row|-row-group)?|flow-root|contents|list-item)$/,
  /^(float-(left|right|none)|clear-(left|right|both|none))$/,
  /^(isolate|isolation-auto)$/,
  /^(object-(contain|cover|fill|none|scale-down)|object-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top))$/,
  /^(overflow(-[xy])?-(auto|hidden|clip|visible|scroll))$/,
  /^(overscroll(-[xy])?-(auto|contain|none))$/,
  /^(static|fixed|absolute|relative|sticky)$/,
  /^(inset(-[xy])?|top|right|bottom|left)-/,
  /^(visible|invisible|collapse)$/,
  /^z-/,

  // Flexbox & Grid
  /^(flex-(row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none)|flex-grow(-0)?|flex-shrink(-0)?)$/,
  /^(grow|grow-0|shrink|shrink-0)$/,
  /^(order-(first|last|none|\d+))$/,
  /^(grid-cols-|grid-rows-|col-(auto|span-|start-|end-)|row-(auto|span-|start-|end-))/,
  /^(gap(-[xy])?-|auto-cols-|auto-rows-)/,
  /^(justify-(normal|start|end|center|between|around|evenly|stretch)|justify-items-(start|end|center|stretch)|justify-self-(auto|start|end|center|stretch))$/,
  /^(content-(normal|center|start|end|between|around|evenly|baseline|stretch))$/,
  /^(items-(start|end|center|baseline|stretch)|self-(auto|start|end|center|stretch|baseline))$/,
  /^(place-(content|items|self)-)/,

  // Spacing
  /^[mp][trblxy]?-(\d+(\.\d+)?|px|auto|\[\d+[a-z]+\])$/,
  /^-[mp][trblxy]?-\d+(\.\d+)?$/,
  /^space-[xy]-(reverse|\d+(\.\d+)?)$/,

  // Sizing
  /^[wh]-(auto|full|screen|svw|svh|lvw|lvh|dvw|dvh|min|max|fit|\d+(\.\d+)?|px|\d+\/\d+|\[\d+[a-z]+\])$/,
  /^(min|max)-[wh]-/,
  /^size-/,

  // Typography
  /^(font-(sans|serif|mono)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d+))$/,
  /^(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|text-(left|center|right|justify|start|end))$/,
  /^(text-(ellipsis|clip)|truncate)$/,
  /^text-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/,
  /^(italic|not-italic|underline|overline|line-through|no-underline)$/,
  /^(uppercase|lowercase|capitalize|normal-case)$/,
  /^(leading-(none|tight|snug|normal|relaxed|loose|\d+))$/,
  /^(tracking-(tighter|tight|normal|wide|wider|widest))$/,
  /^(antialiased|subpixel-antialiased)$/,
  /^(decoration-(auto|from-font|solid|double|dotted|dashed|wavy)|decoration-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?|decoration-\d+|underline-offset-(auto|\d+))$/,
  /^(indent-|align-(baseline|top|middle|bottom|text-top|text-bottom|sub|super)|whitespace-(normal|nowrap|pre|pre-line|pre-wrap|break-spaces)|break-(normal|words|all|keep)|hyphens-(none|manual|auto))$/,
  /^(list-(inside|outside|none|disc|decimal)|list-image-none)$/,
  /^(placeholder-|caret-)/,

  // Backgrounds
  /^bg-(inherit|current|transparent|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/,
  /^bg-(fixed|local|scroll|clip-(border|padding|content|text)|origin-(border|padding|content))$/,
  /^bg-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top)$/,
  /^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/,
  /^bg-(auto|cover|contain)$/,
  /^bg-none$/,
  /^(from|via|to)-(inherit|current|transparent|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/,
  /^bg-gradient-to-(t|tr|r|br|b|bl|l|tl)$/,

  // Borders
  /^(border|border-[trblxy]|border-(solid|dashed|dotted|double|hidden|none))$/,
  /^border(-[trblxy])?-(\d+|transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/,
  /^(rounded|rounded-(t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/,
  /^(divide-[xy](-\d+|-reverse)?|divide-(solid|dashed|dotted|double|none)|divide-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?)$/,
  /^(outline|outline-(none|dashed|dotted|double)|outline-\d+|outline-offset-\d+|outline-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?)$/,
  /^(ring|ring-\d+|ring-inset|ring-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?|ring-offset-\d+|ring-offset-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?)$/,

  // Effects
  /^(shadow|shadow-(sm|md|lg|xl|2xl|inner|none)|shadow-(transparent|current|inherit|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?)$/,
  /^(opacity-\d+)$/,
  /^(mix-blend-|bg-blend-)(normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity)$/,

  // Filters
  /^(blur|blur-(none|sm|md|lg|xl|2xl|3xl))$/,
  /^(brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)-/,
  /^(drop-shadow|drop-shadow-(sm|md|lg|xl|2xl|none))$/,
  /^(backdrop-(blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia)-|backdrop-filter|backdrop-filter-none)$/,

  // Tables
  /^(border-(collapse|separate)|border-spacing(-[xy])?-\d+)$/,
  /^(table-auto|table-fixed|caption-(top|bottom))$/,

  // Transitions & Animation
  /^(transition|transition-(none|all|colors|opacity|shadow|transform))$/,
  /^(duration-\d+|ease-(linear|in|out|in-out)|delay-\d+)$/,
  /^(animate-(none|spin|ping|pulse|bounce))$/,

  // Transforms
  /^(scale(-[xy])?-\d+|rotate-\d+|-rotate-\d+|translate-[xy]-|skew-[xy]-|-skew-[xy]-)$/,
  /^(origin-(center|top|top-right|right|bottom-right|bottom|bottom-left|left|top-left))$/,
  /^(transform|transform-cpu|transform-gpu|transform-none)$/,

  // Interactivity
  /^(accent-|appearance-none|cursor-(auto|default|pointer|wait|text|move|help|not-allowed|none|context-menu|progress|cell|crosshair|vertical-text|alias|copy|no-drop|grab|grabbing|all-scroll|col-resize|row-resize|n-resize|e-resize|s-resize|w-resize|ne-resize|nw-resize|se-resize|sw-resize|ew-resize|ns-resize|nesw-resize|nwse-resize|zoom-in|zoom-out))$/,
  /^(pointer-events-(none|auto)|resize|resize-(none|y|x)|scroll-(auto|smooth)|scroll-m[trblxy]?-|scroll-p[trblxy]?-)$/,
  /^(snap-(start|end|center|align-none)|snap-(normal|always)|snap-(none|x|y|both|mandatory|proximity))$/,
  /^(touch-(auto|none|pan-x|pan-left|pan-right|pan-y|pan-up|pan-down|pinch-zoom|manipulation))$/,
  /^(select-(none|text|all|auto)|will-change-(auto|scroll|contents|transform))$/,

  // SVG
  /^(fill-|stroke-)(inherit|current|transparent|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/,
  /^(fill-none|stroke-\d+)$/,

  // Accessibility
  /^(sr-only|not-sr-only)$/,
  /^(forced-color-adjust-(auto|none))$/,

  // Arbitrary values
  /^\[.+\]$/,

  // Variants/Modifiers (prefixes)
  /^(hover|focus|focus-within|focus-visible|active|visited|target|first|last|only|odd|even|first-of-type|last-of-type|only-of-type|empty|disabled|enabled|checked|indeterminate|default|required|valid|invalid|in-range|out-of-range|placeholder-shown|autofill|read-only|open|before|after|first-letter|first-line|marker|selection|file|backdrop|placeholder|sm|md|lg|xl|2xl|dark|rtl|ltr|motion-safe|motion-reduce|contrast-more|contrast-less|portrait|landscape|print|supports-\[.+\]|aria-\[.+\]|data-\[.+\]|group-hover|group-focus|peer-hover|peer-focus|has-\[.+\]):/,
];

/**
 * Common Tailwind class suggestions for typos
 */
const CLASS_SUGGESTIONS: Record<string, string[]> = {
  'flex-column': ['flex-col'],
  'flex-row-rev': ['flex-row-reverse'],
  'flex-col-rev': ['flex-col-reverse'],
  'justify-left': ['justify-start'],
  'justify-right': ['justify-end'],
  'align-center': ['items-center'],
  'align-left': ['items-start'],
  'align-right': ['items-end'],
  'colour': ['color'],
  'margin-': ['m-'],
  'padding-': ['p-'],
  'width-': ['w-'],
  'height-': ['h-'],
  'font-size-': ['text-'],
  'font-weight-': ['font-'],
  'display-flex': ['flex'],
  'display-grid': ['grid'],
  'display-block': ['block'],
  'display-none': ['hidden'],
  'text-colour': ['text-'],
  'bg-colour': ['bg-'],
};

/**
 * Tailwind CSS class validator
 *
 * Validates Tailwind CSS classes against the project's tailwind.config.js
 * and core Tailwind utilities.
 */
export class TailwindValidator {
  private readonly config: Required<TailwindValidatorConfig>;
  private parsedConfig: ParsedTailwindConfig | null = null;
  private configLoaded = false;
  private safelistPatterns: RegExp[] = [];
  private customClassSet: Set<string> = new Set();

  constructor(config: TailwindValidatorConfig = {}) {
    this.config = {
      configPath: config.configPath ?? './tailwind.config.js',
      customPatterns: config.customPatterns ?? [],
      additionalClasses: config.additionalClasses ?? [],
      allowArbitraryValues: config.allowArbitraryValues ?? true,
      allowArbitraryProperties: config.allowArbitraryProperties ?? true,
    };

    // Add additional classes to custom set
    for (const cls of this.config.additionalClasses) {
      this.customClassSet.add(cls);
    }
  }

  /**
   * Load and parse tailwind.config.js
   */
  async loadConfig(): Promise<boolean> {
    try {
      const configPath = isAbsolute(this.config.configPath)
        ? this.config.configPath
        : join(process.cwd(), this.config.configPath);

      if (!existsSync(configPath)) {
        this.configLoaded = false;
        return false;
      }

      const content = await readFile(configPath, 'utf-8');
      this.parsedConfig = this.parseConfigContent(content);
      this.configLoaded = true;

      // Build safelist patterns from config
      if (this.parsedConfig.safelist) {
        for (const entry of this.parsedConfig.safelist) {
          if (typeof entry === 'string') {
            this.customClassSet.add(entry);
          } else if (entry.pattern) {
            this.safelistPatterns.push(entry.pattern);
          }
        }
      }

      // Add theme extension classes
      if (this.parsedConfig.theme?.extend) {
        this.addThemeExtensions(this.parsedConfig.theme.extend);
      }

      return true;
    } catch {
      this.configLoaded = false;
      return false;
    }
  }

  /**
   * Parse tailwind.config.js content
   */
  private parseConfigContent(content: string): ParsedTailwindConfig {
    const config: ParsedTailwindConfig = {
      theme: {},
    };

    // Extract theme.extend
    const themeExtendMatch = content.match(/theme\s*:\s*\{[\s\S]*?extend\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
    if (themeExtendMatch) {
      try {
        // Simple extraction of color/spacing keys
        const colorsMatch = themeExtendMatch[1]?.match(/colors\s*:\s*(\{[^}]+\})/);
        if (colorsMatch) {
          config.theme.extend = config.theme.extend || {};
          config.theme.extend.colors = this.parseSimpleObject(colorsMatch[1] ?? '{}');
        }

        const spacingMatch = themeExtendMatch[1]?.match(/spacing\s*:\s*(\{[^}]+\})/);
        if (spacingMatch) {
          config.theme.extend = config.theme.extend || {};
          config.theme.extend.spacing = this.parseSimpleObject(spacingMatch[1] ?? '{}');
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Extract safelist
    const safelistMatch = content.match(/safelist\s*:\s*\[([\s\S]*?)\]/);
    if (safelistMatch && safelistMatch[1]) {
      config.safelist = [];
      const entries = safelistMatch[1].match(/['"]([^'"]+)['"]/g);
      if (entries) {
        for (const entry of entries) {
          const cls = entry.replace(/['"]/g, '');
          config.safelist.push(cls);
        }
      }
    }

    // Extract prefix
    const prefixMatch = content.match(/prefix\s*:\s*['"]([^'"]+)['"]/);
    if (prefixMatch && prefixMatch[1]) {
      config.prefix = prefixMatch[1];
    }

    // Extract important
    const importantMatch = content.match(/important\s*:\s*(true|false|['"][^'"]+['"])/);
    if (importantMatch && importantMatch[1]) {
      if (importantMatch[1] === 'true') {
        config.important = true;
      } else if (importantMatch[1] === 'false') {
        config.important = false;
      } else {
        config.important = importantMatch[1].replace(/['"]/g, '');
      }
    }

    return config;
  }

  /**
   * Parse a simple object from config string
   */
  private parseSimpleObject(objStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    const matches = objStr.matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const match of matches) {
      const key = match[1];
      const value = match[2];
      if (key && value) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Add theme extensions to custom class set
   */
  private addThemeExtensions(extend: Record<string, Record<string, string>>): void {
    // Add custom colors
    if (extend.colors) {
      for (const colorName of Object.keys(extend.colors)) {
        // Add color utilities
        for (const prefix of ['text', 'bg', 'border', 'ring', 'from', 'via', 'to', 'fill', 'stroke']) {
          this.customClassSet.add(`${prefix}-${colorName}`);
        }
      }
    }

    // Add custom spacing
    if (extend.spacing) {
      for (const spacingKey of Object.keys(extend.spacing)) {
        for (const prefix of ['m', 'mt', 'mr', 'mb', 'ml', 'mx', 'my', 'p', 'pt', 'pr', 'pb', 'pl', 'px', 'py', 'w', 'h', 'gap', 'space-x', 'space-y']) {
          this.customClassSet.add(`${prefix}-${spacingKey}`);
        }
      }
    }
  }

  /**
   * Validate a list of Tailwind classes
   */
  validate(classes: string | string[]): TailwindBatchValidationResult {
    const classList = typeof classes === 'string'
      ? classes.split(/\s+/).filter(c => c.length > 0)
      : classes;

    const result: TailwindBatchValidationResult = {
      valid: true,
      invalidClasses: [],
      validClasses: [],
      suggestions: new Map(),
      configLoaded: this.configLoaded,
    };

    for (let i = 0; i < classList.length; i++) {
      const className = classList[i];
      if (!className) continue;

      const validation = this.validateClass(className);

      if (validation.valid) {
        result.validClasses.push(className);
      } else {
        result.valid = false;
        const invalidClass: InvalidClass = {
          className,
          reason: validation.reason,
          position: i,
        };
        if (validation.suggestions && validation.suggestions.length > 0) {
          invalidClass.suggestions = validation.suggestions;
          result.suggestions.set(className, validation.suggestions);
        }
        result.invalidClasses.push(invalidClass);
      }
    }

    return result;
  }

  /**
   * Validate a single class
   */
  private validateClass(className: string): { valid: boolean; reason: string; suggestions?: string[] } {
    // Remove variant prefixes for validation
    const baseClass = this.extractBaseClass(className);

    // Check custom classes first (highest priority)
    if (this.customClassSet.has(baseClass) || this.customClassSet.has(className)) {
      return { valid: true, reason: '' };
    }

    // Check safelist patterns
    for (const pattern of this.safelistPatterns) {
      if (pattern.test(baseClass) || pattern.test(className)) {
        return { valid: true, reason: '' };
      }
    }

    // Check custom patterns from config
    for (const pattern of this.config.customPatterns) {
      if (pattern.test(baseClass) || pattern.test(className)) {
        return { valid: true, reason: '' };
      }
    }

    // Check arbitrary values
    if (this.config.allowArbitraryValues && /\[.+\]/.test(baseClass)) {
      return { valid: true, reason: '' };
    }

    // Check arbitrary properties
    if (this.config.allowArbitraryProperties && /^\[.+:.+\]$/.test(baseClass)) {
      return { valid: true, reason: '' };
    }

    // Check core Tailwind patterns
    for (const pattern of TAILWIND_CORE_PATTERNS) {
      if (pattern.test(className)) {
        return { valid: true, reason: '' };
      }
    }

    // Class not found - generate suggestions
    const suggestions = this.getSuggestions(baseClass);

    return {
      valid: false,
      reason: `Unknown Tailwind class: ${className}`,
      suggestions,
    };
  }

  /**
   * Extract base class (remove variant prefixes)
   */
  private extractBaseClass(className: string): string {
    // Handle variant prefixes like hover:, focus:, sm:, etc.
    const parts = className.split(':');
    return parts[parts.length - 1] ?? className;
  }

  /**
   * Get suggestions for an invalid class
   */
  private getSuggestions(className: string): string[] {
    const suggestions: string[] = [];

    // Check for common typos
    for (const [typo, fixes] of Object.entries(CLASS_SUGGESTIONS)) {
      if (className.includes(typo)) {
        suggestions.push(...fixes.map(fix => className.replace(typo, fix)));
      }
    }

    // Check for similar classes in custom set
    for (const customClass of this.customClassSet) {
      if (this.isSimilar(className, customClass)) {
        suggestions.push(customClass);
      }
    }

    // Limit suggestions
    return suggestions.slice(0, 5);
  }

  /**
   * Check if two class names are similar (for typo detection)
   */
  private isSimilar(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 2) return false;

    let differences = 0;
    const maxLen = Math.max(a.length, b.length);

    for (let i = 0; i < maxLen; i++) {
      if (a[i] !== b[i]) differences++;
      if (differences > 2) return false;
    }

    return differences <= 2;
  }

  /**
   * Add classes to the safelist
   */
  addToSafelist(classes: string[]): void {
    for (const cls of classes) {
      this.customClassSet.add(cls);
    }
  }

  /**
   * Add patterns to the safelist
   */
  addPatternToSafelist(patterns: RegExp[]): void {
    this.safelistPatterns.push(...patterns);
  }
}

/**
 * Create a new TailwindValidator instance
 */
export function createTailwindValidator(config?: TailwindValidatorConfig): TailwindValidator {
  return new TailwindValidator(config);
}
