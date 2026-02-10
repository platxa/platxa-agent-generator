/**
 * Output Sanitization
 *
 * Provides sanitization utilities for streamed content.
 * Supports both backend escaping and client-side DOMPurify sanitization.
 *
 * @module react-agent/streaming/sanitize
 */

import type {
  ContentType,
  SanitizeOptions,
  SanitizeResult,
  DOMPurifyConfig,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default allowed HTML tags for sanitization
 */
export const DEFAULT_ALLOWED_TAGS = [
  // Structure
  'div', 'span', 'p', 'br', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Text formatting
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  // Code
  'pre', 'code', 'kbd', 'samp',
  // Links and media (sanitized)
  'a', 'img',
  // Tables
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // Semantic
  'article', 'section', 'nav', 'aside', 'header', 'footer', 'main',
  // Quotes
  'blockquote', 'q', 'cite',
  // Details
  'details', 'summary',
];

/**
 * Default allowed attributes per tag
 */
export const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  '*': ['class', 'id', 'style'],
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  code: ['class', 'data-language'],
  pre: ['class', 'data-language'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
};

/**
 * Safe URI regex pattern
 */
export const SAFE_URI_REGEX = /^(?:(?:https?|mailto|tel|data):|[^#&/:?]*(?:[#/?]|$))/i;

// =============================================================================
// BACKEND SANITIZATION (Escaping)
// =============================================================================

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape XML special characters (stricter than HTML)
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape JSON string for safe embedding
 */
export function escapeJson(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

/**
 * Escape for Markdown (prevent injection)
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/`/g, '\\`')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/!/g, '\\!');
}

/**
 * Strip all HTML tags from text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Backend sanitization based on content type
 */
export function backendSanitize(
  content: string,
  contentType: ContentType
): SanitizeResult {
  const original = content;
  let sanitized: string;
  const warnings: string[] = [];

  switch (contentType) {
    case 'html':
      // For HTML, we escape potential script injection points
      sanitized = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, () => {
          warnings.push('Script tag removed');
          return '';
        })
        .replace(/on\w+\s*=/gi, () => {
          warnings.push('Event handler attribute removed');
          return 'data-removed=';
        })
        .replace(/javascript:/gi, () => {
          warnings.push('JavaScript protocol removed');
          return 'removed:';
        });
      break;

    case 'markdown':
      // For Markdown, check for HTML injection
      sanitized = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, () => {
          warnings.push('Script tag removed from markdown');
          return '';
        })
        .replace(/javascript:/gi, () => {
          warnings.push('JavaScript protocol removed from markdown');
          return 'removed:';
        });
      break;

    case 'code':
      // Code is displayed as-is but escaped for HTML context
      sanitized = escapeHtml(content);
      break;

    case 'json':
      // JSON should be valid JSON
      try {
        JSON.parse(content);
        sanitized = content;
      } catch {
        warnings.push('Invalid JSON, escaping as text');
        // Escape for HTML display since invalid JSON may be shown in UI
        sanitized = escapeHtml(content);
      }
      break;

    case 'text':
    default:
      sanitized = escapeHtml(content);
      break;
  }

  return {
    content: sanitized,
    wasModified: sanitized !== original,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// =============================================================================
// CLIENT-SIDE SANITIZATION (DOMPurify)
// =============================================================================

/**
 * DOMPurify type (loaded dynamically on client)
 */
type DOMPurifyInstance = {
  sanitize: (dirty: string, config?: DOMPurifyConfig) => string;
  addHook: (hook: string, callback: (node: Element) => void) => void;
  removeHook: (hook: string) => void;
  isSupported: boolean;
};

/** Cached DOMPurify instance */
let domPurifyInstance: DOMPurifyInstance | null = null;

/**
 * Get or create DOMPurify instance
 * Uses dynamic import to avoid compile-time dependency on dompurify
 */
async function getDOMPurify(): Promise<DOMPurifyInstance | null> {
  if (domPurifyInstance) {
    return domPurifyInstance;
  }

  // Only load on client
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Use variable to prevent TypeScript from resolving module statically
    const moduleName = 'dompurify';
    const DOMPurify = await import(/* @vite-ignore */ moduleName);
    domPurifyInstance = DOMPurify.default as unknown as DOMPurifyInstance;
    return domPurifyInstance;
  } catch {
    console.warn('DOMPurify not available, using fallback sanitization');
    return null;
  }
}

/**
 * Build DOMPurify config from options
 */
function buildDOMPurifyConfig(options?: SanitizeOptions): DOMPurifyConfig {
  const config: DOMPurifyConfig = {
    ALLOWED_TAGS: options?.allowedTags ?? DEFAULT_ALLOWED_TAGS,
    ALLOW_DATA_ATTR: options?.allowDataAttributes ?? false,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEX,
  };

  // Build allowed attributes list
  if (options?.allowedAttributes) {
    const attrs: string[] = [];
    for (const tagAttrs of Object.values(options.allowedAttributes)) {
      attrs.push(...tagAttrs);
    }
    config.ALLOWED_ATTR = [...new Set(attrs)];
  } else {
    const defaultAttrs: string[] = [];
    for (const tagAttrs of Object.values(DEFAULT_ALLOWED_ATTRIBUTES)) {
      defaultAttrs.push(...tagAttrs);
    }
    config.ALLOWED_ATTR = [...new Set(defaultAttrs)];
  }

  return config;
}

/**
 * Client-side sanitization using DOMPurify
 */
export async function clientSanitize(
  content: string,
  options?: SanitizeOptions
): Promise<SanitizeResult> {
  const original = content;
  const warnings: string[] = [];
  const removedItems: string[] = [];

  // Handle strip HTML case
  if (options?.stripHtml) {
    return {
      content: stripHtml(content),
      wasModified: true,
    };
  }

  // Handle text content type (no HTML processing needed)
  if (options?.contentType === 'text') {
    return {
      content: escapeHtml(content),
      wasModified: content !== escapeHtml(content),
    };
  }

  // Handle code content type
  if (options?.contentType === 'code') {
    return {
      content: escapeHtml(content),
      wasModified: content !== escapeHtml(content),
    };
  }

  // Try to use DOMPurify
  const purify = await getDOMPurify();

  if (purify && purify.isSupported) {
    const config = buildDOMPurifyConfig(options);

    // Track removed items
    purify.addHook('uponSanitizeElement', (node: Element) => {
      if (!config.ALLOWED_TAGS?.includes(node.tagName.toLowerCase())) {
        removedItems.push(`<${node.tagName.toLowerCase()}>`);
      }
    });

    const sanitized = purify.sanitize(content, config);

    purify.removeHook('uponSanitizeElement');

    if (removedItems.length > 0) {
      warnings.push(`Removed ${removedItems.length} unsafe elements`);
    }

    return {
      content: sanitized,
      wasModified: sanitized !== original,
      removedItems: removedItems.length > 0 ? removedItems : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Fallback: basic HTML sanitization without DOMPurify
  warnings.push('Using fallback sanitization (DOMPurify unavailable)');

  const fallbackSanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, 'removed:');

  return {
    content: fallbackSanitized,
    wasModified: fallbackSanitized !== original,
    warnings,
  };
}

/**
 * Synchronous client sanitization (uses cached DOMPurify)
 */
export function clientSanitizeSync(
  content: string,
  options?: SanitizeOptions
): SanitizeResult {
  // Handle simple cases synchronously
  if (options?.stripHtml) {
    return {
      content: stripHtml(content),
      wasModified: true,
    };
  }

  if (options?.contentType === 'text' || options?.contentType === 'code') {
    return {
      content: escapeHtml(content),
      wasModified: content !== escapeHtml(content),
    };
  }

  // Use cached DOMPurify if available
  if (domPurifyInstance?.isSupported) {
    const config = buildDOMPurifyConfig(options);
    const sanitized = domPurifyInstance.sanitize(content, config);
    return {
      content: sanitized,
      wasModified: sanitized !== content,
    };
  }

  // Fallback
  const fallbackSanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, 'removed:');

  return {
    content: fallbackSanitized,
    wasModified: fallbackSanitized !== content,
    warnings: ['Using fallback sanitization'],
  };
}

// =============================================================================
// COMBINED SANITIZATION
// =============================================================================

/**
 * Full sanitization pipeline (backend + client)
 */
export async function sanitize(
  content: string,
  options?: SanitizeOptions
): Promise<SanitizeResult> {
  const contentType = options?.contentType ?? 'html';

  // Step 1: Backend sanitization (escaping)
  const backendResult = backendSanitize(content, contentType);

  // Step 2: Client sanitization (DOMPurify) for HTML/Markdown
  if (contentType === 'html' || contentType === 'markdown') {
    const clientResult = await clientSanitize(backendResult.content, options);

    return {
      content: clientResult.content,
      wasModified: backendResult.wasModified || clientResult.wasModified,
      removedItems: clientResult.removedItems,
      warnings: [
        ...(backendResult.warnings ?? []),
        ...(clientResult.warnings ?? []),
      ].filter(Boolean),
    };
  }

  return backendResult;
}

/**
 * Synchronous full sanitization
 */
export function sanitizeSync(
  content: string,
  options?: SanitizeOptions
): SanitizeResult {
  const contentType = options?.contentType ?? 'html';

  // Step 1: Backend sanitization
  const backendResult = backendSanitize(content, contentType);

  // Step 2: Client sanitization for HTML/Markdown
  if (contentType === 'html' || contentType === 'markdown') {
    const clientResult = clientSanitizeSync(backendResult.content, options);

    return {
      content: clientResult.content,
      wasModified: backendResult.wasModified || clientResult.wasModified,
      removedItems: clientResult.removedItems,
      warnings: [
        ...(backendResult.warnings ?? []),
        ...(clientResult.warnings ?? []),
      ].filter(Boolean),
    };
  }

  return backendResult;
}

/**
 * Preload DOMPurify for faster sync sanitization
 */
export async function preloadDOMPurify(): Promise<boolean> {
  const purify = await getDOMPurify();
  return purify?.isSupported ?? false;
}
