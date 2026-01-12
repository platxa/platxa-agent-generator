/**
 * Language Detection Module
 *
 * Detects programming language from file extensions, content patterns,
 * and shebang lines. Provides confidence scores for detection.
 *
 * @module language-detector
 */

import {
  Language,
  LanguageDetectionResult,
  ConfidenceLevel,
} from './types.js';

// =============================================================================
// Extension Mappings
// =============================================================================

/**
 * Maps file extensions to their corresponding language
 * Extensions are lowercase and include the leading dot
 */
const EXTENSION_MAP: Readonly<Record<string, Language>> = {
  // Python
  '.py': 'python',
  '.pyi': 'python',
  '.pyw': 'python',
  '.pyx': 'python',

  // JavaScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',

  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // CSS
  '.css': 'css',

  // SCSS/Sass
  '.scss': 'scss',
  '.sass': 'scss',

  // HTML
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',

  // JSON
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json',

  // YAML
  '.yml': 'yaml',
  '.yaml': 'yaml',

  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
} as const;

// =============================================================================
// Content Patterns
// =============================================================================

interface ContentPattern {
  readonly pattern: RegExp;
  readonly language: Language;
  readonly weight: number;
}

/**
 * Content patterns for language detection
 * Patterns are tested against file content to identify the language
 * Weight indicates confidence contribution (0-1)
 */
const CONTENT_PATTERNS: readonly ContentPattern[] = [
  // Python patterns
  { pattern: /^#!.*\bpython\b/m, language: 'python', weight: 1.0 },
  { pattern: /^from\s+\w+\s+import\s+/m, language: 'python', weight: 0.9 },
  { pattern: /^import\s+\w+\s*$/m, language: 'python', weight: 0.7 },
  { pattern: /\bdef\s+\w+\s*\([^)]*\)\s*(?:->\s*[\w[],\s]+)?\s*:/m, language: 'python', weight: 0.9 },
  { pattern: /\bclass\s+\w+(?:\s*\([^)]*\))?\s*:/m, language: 'python', weight: 0.8 },
  { pattern: /if\s+__name__\s*==\s*["']__main__["']\s*:/m, language: 'python', weight: 1.0 },
  { pattern: /^\s*@\w+(?:\.\w+)*(?:\([^)]*\))?\s*$/m, language: 'python', weight: 0.6 },
  { pattern: /Traceback\s+\(most\s+recent\s+call\s+last\)/m, language: 'python', weight: 1.0 },
  { pattern: /File\s+"[^"]*\.py",\s+line\s+\d+/m, language: 'python', weight: 1.0 },

  // JavaScript/TypeScript patterns
  { pattern: /^#!.*\bnode\b/m, language: 'javascript', weight: 1.0 },
  { pattern: /^import\s+.+\s+from\s+["'][^"']+["']/m, language: 'javascript', weight: 0.8 },
  { pattern: /^export\s+(?:default\s+)?(?:class|function|const|let|var)\b/m, language: 'javascript', weight: 0.9 },
  { pattern: /^const\s+\w+\s*=\s*require\s*\(/m, language: 'javascript', weight: 0.9 },
  { pattern: /=>\s*\{/m, language: 'javascript', weight: 0.5 },
  { pattern: /\bconsole\.(?:log|error|warn|info)\s*\(/m, language: 'javascript', weight: 0.6 },
  { pattern: /\basync\s+function\b/m, language: 'javascript', weight: 0.7 },
  { pattern: /\bawait\s+/m, language: 'javascript', weight: 0.5 },

  // TypeScript-specific patterns
  { pattern: /:\s*(?:string|number|boolean|void|any|unknown|never)\b/m, language: 'typescript', weight: 0.9 },
  { pattern: /\binterface\s+\w+\s*\{/m, language: 'typescript', weight: 0.95 },
  { pattern: /\btype\s+\w+\s*=\s*/m, language: 'typescript', weight: 0.9 },
  { pattern: /<\w+(?:\s*,\s*\w+)*>/m, language: 'typescript', weight: 0.6 },
  { pattern: /\bas\s+(?:const|string|number|boolean|\w+)\b/m, language: 'typescript', weight: 0.8 },
  { pattern: /:\s*\w+\[\]/m, language: 'typescript', weight: 0.8 },

  // CSS patterns
  { pattern: /^\s*\.[a-zA-Z][\w-]*\s*\{/m, language: 'css', weight: 0.8 },
  { pattern: /^\s*#[a-zA-Z][\w-]*\s*\{/m, language: 'css', weight: 0.8 },
  { pattern: /^\s*@media\s+/m, language: 'css', weight: 0.9 },
  { pattern: /^\s*@keyframes\s+/m, language: 'css', weight: 0.9 },
  { pattern: /:\s*(?:flex|grid|block|inline|none)\s*;/m, language: 'css', weight: 0.7 },
  { pattern: /background(?:-color)?:\s*#[0-9a-fA-F]+/m, language: 'css', weight: 0.7 },

  // SCSS patterns
  { pattern: /\$[\w-]+\s*:/m, language: 'scss', weight: 0.95 },
  { pattern: /@mixin\s+\w+/m, language: 'scss', weight: 1.0 },
  { pattern: /@include\s+\w+/m, language: 'scss', weight: 1.0 },
  { pattern: /@extend\s+/m, language: 'scss', weight: 0.9 },
  { pattern: /&:(?:hover|focus|active)/m, language: 'scss', weight: 0.7 },

  // Tailwind patterns (in HTML/JSX context)
  { pattern: /class(?:Name)?=["'][^"']*\b(?:flex|grid|p-|m-|text-|bg-|border-)/m, language: 'tailwind', weight: 0.9 },
  { pattern: /@tailwind\s+(?:base|components|utilities)/m, language: 'tailwind', weight: 1.0 },
  { pattern: /@apply\s+[\w-]+/m, language: 'tailwind', weight: 1.0 },

  // HTML patterns
  { pattern: /<!DOCTYPE\s+html>/i, language: 'html', weight: 1.0 },
  { pattern: /<html[^>]*>/i, language: 'html', weight: 0.9 },
  { pattern: /<head[^>]*>[\s\S]*<\/head>/i, language: 'html', weight: 0.8 },
  { pattern: /<body[^>]*>/i, language: 'html', weight: 0.8 },
  { pattern: /<div[^>]*>/i, language: 'html', weight: 0.5 },

  // JSON patterns
  { pattern: /^\s*\{\s*"[^"]+"\s*:/m, language: 'json', weight: 0.9 },
  { pattern: /^\s*\[\s*\{/m, language: 'json', weight: 0.7 },

  // YAML patterns
  { pattern: /^---\s*$/m, language: 'yaml', weight: 0.8 },
  { pattern: /^\w+:\s*$/m, language: 'yaml', weight: 0.5 },
  { pattern: /^\s+-\s+\w+:/m, language: 'yaml', weight: 0.7 },
] as const;

// =============================================================================
// Error Pattern Detection
// =============================================================================

interface ErrorPattern {
  readonly pattern: RegExp;
  readonly language: Language;
  readonly weight: number;
}

/**
 * Error patterns for detecting language from error messages
 * These patterns match common error formats from various tools and runtimes
 */
const ERROR_PATTERNS: readonly ErrorPattern[] = [
  // Python errors
  { pattern: /Traceback\s+\(most\s+recent\s+call\s+last\)/i, language: 'python', weight: 1.0 },
  { pattern: /File\s+"[^"]*\.py",\s+line\s+\d+/i, language: 'python', weight: 1.0 },
  { pattern: /\b(?:TypeError|ValueError|AttributeError|NameError|ImportError|KeyError|IndexError|SyntaxError|IndentationError|RuntimeError|ZeroDivisionError|FileNotFoundError|ModuleNotFoundError):\s/i, language: 'python', weight: 0.95 },
  { pattern: /\b(?:pyright|mypy|pylint|ruff|flake8)\b/i, language: 'python', weight: 0.9 },

  // JavaScript/TypeScript errors
  { pattern: /\bat\s+\w+\s+\([^)]*:\d+:\d+\)/i, language: 'javascript', weight: 0.9 },
  { pattern: /\.(?:js|mjs|cjs):\d+:\d+/i, language: 'javascript', weight: 0.95 },
  { pattern: /\.(?:ts|tsx):\d+:\d+/i, language: 'typescript', weight: 0.95 },
  { pattern: /\bTS\d{4}:/i, language: 'typescript', weight: 1.0 },
  { pattern: /\b(?:ReferenceError|TypeError|SyntaxError|RangeError|URIError|EvalError):\s/i, language: 'javascript', weight: 0.8 },
  { pattern: /\b(?:eslint|tsc|typescript)\b/i, language: 'typescript', weight: 0.8 },

  // CSS errors
  { pattern: /\.(?:css|scss|sass):\d+:\d+/i, language: 'css', weight: 0.95 },
  { pattern: /\bstylelint\b/i, language: 'css', weight: 0.9 },
  { pattern: /(?:Unknown\s+property|Invalid\s+property\s+value|Expected\s+.*selector)/i, language: 'css', weight: 0.8 },

  // Tailwind errors
  { pattern: /\b(?:tailwind|@apply|purge|content\s*.*paths)\b/i, language: 'tailwind', weight: 0.9 },
  { pattern: /(?:class\s+.*not\s+found|Unknown\s+utility)/i, language: 'tailwind', weight: 0.85 },

  // HTML errors
  { pattern: /\.(?:html|htm):\d+:\d+/i, language: 'html', weight: 0.95 },
  { pattern: /(?:Invalid\s+.*tag|Unclosed\s+.*element|Missing\s+.*attribute)/i, language: 'html', weight: 0.7 },
] as const;

// =============================================================================
// Language Detector Class
// =============================================================================

/**
 * Detects programming language from various inputs
 *
 * Supports detection from:
 * - File paths (extension-based)
 * - File content (pattern-based)
 * - Error messages (error pattern-based)
 * - Shebang lines
 *
 * @example
 * ```typescript
 * const detector = new LanguageDetector();
 *
 * // Detect from file path
 * const result1 = detector.detectFromPath('app.py');
 * // { language: 'python', confidence: 'high', score: 1.0 }
 *
 * // Detect from content
 * const result2 = detector.detectFromContent('def hello(): pass');
 * // { language: 'python', confidence: 'high', score: 0.9 }
 *
 * // Detect from error
 * const result3 = detector.detectFromError('TypeError: expected str');
 * // { language: 'python', confidence: 'high', score: 0.95 }
 * ```
 */
export class LanguageDetector {
  /**
   * Detect language from a file path using extension mapping
   *
   * @param filePath - Path to the file (can be relative or absolute)
   * @returns Detection result with language and confidence
   */
  detectFromPath(filePath: string): LanguageDetectionResult {
    const ext = this.extractExtension(filePath);

    if (ext !== null && ext in EXTENSION_MAP) {
      const language = EXTENSION_MAP[ext];
      if (language !== undefined) {
        return {
          language,
          confidence: 'high',
          score: 1.0,
          detectionMethod: 'extension',
        };
      }
    }

    return {
      language: 'unknown',
      confidence: 'low',
      score: 0.0,
      detectionMethod: 'fallback',
    };
  }

  /**
   * Detect language from file content using pattern matching
   *
   * @param content - File content to analyze
   * @returns Detection result with language, confidence, and any secondary languages
   */
  detectFromContent(content: string): LanguageDetectionResult {
    // Check shebang first (highest priority for scripts)
    const shebangResult = this.detectFromShebang(content);
    if (shebangResult.score > 0.9) {
      return shebangResult;
    }

    // Score all patterns
    const scores = new Map<Language, number>();

    for (const { pattern, language, weight } of CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        const current = scores.get(language) ?? 0;
        scores.set(language, current + weight);
      }
    }

    // Find best match
    let bestLanguage: Language = 'unknown';
    let bestScore = 0;

    for (const [language, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = language;
      }
    }

    // Normalize score (cap at 1.0, using 3.0 as max expected cumulative weight)
    const normalizedScore = Math.min(bestScore / 3, 1.0);

    return {
      language: bestLanguage,
      confidence: this.scoreToConfidence(normalizedScore),
      score: normalizedScore,
      detectionMethod: 'content',
      secondaryLanguages: this.getSecondaryLanguages(scores, bestLanguage),
    };
  }

  /**
   * Detect language from error text using error patterns
   *
   * @param errorText - Error message or stack trace to analyze
   * @returns Detection result with language and confidence
   */
  detectFromError(errorText: string): LanguageDetectionResult {
    const scores = new Map<Language, number>();

    for (const { pattern, language, weight } of ERROR_PATTERNS) {
      if (pattern.test(errorText)) {
        const current = scores.get(language) ?? 0;
        scores.set(language, current + weight);
      }
    }

    // Find best match
    let bestLanguage: Language = 'unknown';
    let bestScore = 0;

    for (const [language, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = language;
      }
    }

    // Normalize score (cap at 1.0, using 2.0 as max expected cumulative weight)
    const normalizedScore = Math.min(bestScore / 2, 1.0);

    return {
      language: bestLanguage,
      confidence: this.scoreToConfidence(normalizedScore),
      score: normalizedScore,
      detectionMethod: 'pattern',
    };
  }

  /**
   * Detect language using all available information
   *
   * Combines results from path, content, and error detection methods,
   * prioritizing the most reliable detection method.
   *
   * @param input - Object containing optional filePath, content, and/or errorText
   * @returns Best detection result based on all available inputs
   */
  detect(input: {
    filePath?: string;
    content?: string;
    errorText?: string;
  }): LanguageDetectionResult {
    const results: LanguageDetectionResult[] = [];

    // Try file path detection (highest priority if matched)
    if (input.filePath !== undefined) {
      const pathResult = this.detectFromPath(input.filePath);
      if (pathResult.score > 0) {
        results.push(pathResult);
      }
    }

    // Try error pattern detection
    if (input.errorText !== undefined) {
      const errorResult = this.detectFromError(input.errorText);
      if (errorResult.score > 0) {
        results.push(errorResult);
      }
    }

    // Try content detection
    if (input.content !== undefined) {
      const contentResult = this.detectFromContent(input.content);
      if (contentResult.score > 0) {
        results.push(contentResult);
      }
    }

    // No results - return unknown
    if (results.length === 0) {
      return {
        language: 'unknown',
        confidence: 'low',
        score: 0,
        detectionMethod: 'fallback',
      };
    }

    // Prefer extension detection if score is high (most reliable)
    const extensionResult = results.find((r) => r.detectionMethod === 'extension');
    if (extensionResult !== undefined && extensionResult.score >= 0.9) {
      return extensionResult;
    }

    // Otherwise return highest scoring result
    return results.reduce((best, current) =>
      current.score > best.score ? current : best
    );
  }

  /**
   * Check if input content is likely Tailwind CSS related
   *
   * @param content - Content to check for Tailwind patterns
   * @returns True if Tailwind patterns are detected
   */
  isTailwindRelated(content: string): boolean {
    const tailwindPatterns: readonly RegExp[] = [
      /@tailwind\b/,
      /@apply\s+[\w-]/,
      /tailwind\.config/,
      /class(?:Name)?=["'][^"']*\b(?:flex|grid|p-\d|m-\d|text-|bg-|border-|rounded|shadow)/,
    ];

    return tailwindPatterns.some((p) => p.test(content));
  }

  /**
   * Get all supported languages
   *
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): readonly Language[] {
    return [
      'python',
      'javascript',
      'typescript',
      'css',
      'scss',
      'tailwind',
      'html',
      'json',
      'yaml',
      'markdown',
    ] as const;
  }

  /**
   * Get file extensions for a specific language
   *
   * @param language - Language to get extensions for
   * @returns Array of file extensions (including leading dot)
   */
  getExtensionsForLanguage(language: Language): string[] {
    return Object.entries(EXTENSION_MAP)
      .filter(([, lang]) => lang === language)
      .map(([ext]) => ext);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Extract file extension from path
   */
  private extractExtension(filePath: string): string | null {
    const match = filePath.match(/(\.[a-zA-Z0-9]+)$/);
    const extension = match?.[1];
    return extension !== undefined ? extension.toLowerCase() : null;
  }

  /**
   * Detect language from shebang line
   */
  private detectFromShebang(content: string): LanguageDetectionResult {
    const shebangMatch = content.match(/^#!.+$/m);

    if (shebangMatch !== null) {
      const shebang = shebangMatch[0].toLowerCase();

      if (/\bpython\b/.test(shebang)) {
        return {
          language: 'python',
          confidence: 'high',
          score: 1.0,
          detectionMethod: 'shebang',
        };
      }

      if (/\b(?:node|bun|deno)\b/.test(shebang)) {
        return {
          language: 'javascript',
          confidence: 'high',
          score: 1.0,
          detectionMethod: 'shebang',
        };
      }
    }

    return {
      language: 'unknown',
      confidence: 'low',
      score: 0,
      detectionMethod: 'shebang',
    };
  }

  /**
   * Convert numeric score to confidence level
   */
  private scoreToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Get secondary languages from scores map
   */
  private getSecondaryLanguages(
    scores: Map<Language, number>,
    primary: Language
  ): Language[] {
    return Array.from(scores.entries())
      .filter(([lang, score]) => lang !== primary && score > 0.3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default language detector instance
 * Use this for convenience when a shared instance is acceptable
 */
export const languageDetector = new LanguageDetector();
