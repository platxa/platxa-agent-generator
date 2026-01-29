/**
 * Live SCSS Compiler
 *
 * Compiles SCSS to CSS in-process using dart-sass and injects the result
 * into the preview iframe via postMessage, avoiding a full page reload.
 * Debounces rapid changes and tracks compilation performance.
 */

import * as sass from "sass";

// =============================================================================
// Types
// =============================================================================

/** Structured SCSS compilation error with location information */
export interface ScssCompileError {
  /** Human-readable error message (without location info) */
  message: string;
  /** Full error message including location context */
  fullMessage: string;
  /** File path where the error occurred */
  file: string | null;
  /** Line number (1-based) */
  line: number | null;
  /** Column number (1-based) */
  column: number | null;
  /** End line number (1-based) if span available */
  endLine?: number | null;
  /** End column number (1-based) if span available */
  endColumn?: number | null;
  /** Sass stack trace */
  stack: string | null;
}

/** Result of a live SCSS compilation */
export interface LiveCompileResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Compiled CSS (null on failure) */
  css: string | null;
  /** Error message (null on success) - kept for backwards compatibility */
  error: string | null;
  /** Structured error information with line/column (null on success) */
  compileError: ScssCompileError | null;
  /** Compilation duration in milliseconds */
  durationMs: number;
  /** Source file path */
  file: string;
}

/** Options for the live compiler */
export interface LiveCompilerOptions {
  /** Debounce interval in ms (default 150) */
  debounceMs?: number;
  /** Callback when compilation completes */
  onCompile?: (result: LiveCompileResult) => void;
}

// =============================================================================
// Core Compilation
// =============================================================================

/**
 * Parses a sass.Exception into a structured ScssCompileError.
 * Extracts file path, line, column, and message from the exception.
 */
export function parseSassException(
  err: unknown,
  defaultFile: string
): ScssCompileError {
  // Check if it's a sass Exception with span info
  if (isSassException(err)) {
    const span = err.span;
    return {
      message: err.sassMessage || err.message,
      fullMessage: err.message,
      file: span?.url?.pathname || span?.url?.href || defaultFile,
      // Convert from 0-based to 1-based line/column numbers
      line: span?.start?.line != null ? span.start.line + 1 : null,
      column: span?.start?.column != null ? span.start.column + 1 : null,
      endLine: span?.end?.line != null ? span.end.line + 1 : null,
      endColumn: span?.end?.column != null ? span.end.column + 1 : null,
      stack: err.sassStack || null,
    };
  }

  // Fallback for regular errors or unknown types
  const message = err instanceof Error ? err.message : String(err);

  // Try to parse line/column from error message (e.g., "Error: expected...\\n   ╷\\n1  │ ...")
  const lineMatch = message.match(/^.*?:(\d+):(\d+):/);

  return {
    message,
    fullMessage: message,
    file: defaultFile,
    line: lineMatch ? parseInt(lineMatch[1], 10) : null,
    column: lineMatch ? parseInt(lineMatch[2], 10) : null,
    stack: err instanceof Error ? err.stack || null : null,
  };
}

/**
 * Type guard to check if an error is a sass.Exception with span info.
 */
function isSassException(err: unknown): err is sass.Exception {
  return (
    err instanceof Error &&
    "sassMessage" in err &&
    "span" in err
  );
}

/**
 * Formats an ScssCompileError into a human-readable string.
 */
export function formatScssError(error: ScssCompileError): string {
  const location = error.line != null
    ? `${error.file || "unknown"}:${error.line}${error.column != null ? `:${error.column}` : ""}`
    : error.file || "unknown";

  return `[SCSS Error] ${location}\n${error.message}`;
}

/**
 * Compiles SCSS source to CSS using dart-sass.
 * Returns the result with timing and structured error information.
 */
export function compileScssToCSS(
  source: string,
  file = "live.scss",
): LiveCompileResult {
  const start = performance.now();

  try {
    const result = sass.compileString(source, {
      style: "expanded",
      sourceMap: false,
    });

    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      success: true,
      css: result.css,
      error: null,
      compileError: null,
      durationMs,
      file,
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const compileError = parseSassException(err, file);

    return {
      success: false,
      css: null,
      error: compileError.fullMessage,
      compileError,
      durationMs,
      file,
    };
  }
}

/**
 * Compiles all SCSS files from editor contents into a single CSS string.
 * Concatenates variables first, then rules, for proper resolution.
 */
export function compileAllScss(
  fileContents: Record<string, string>,
): LiveCompileResult {
  const scssFiles = Object.entries(fileContents)
    .filter(([path]) => path.endsWith(".scss"))
    .sort(([a], [b]) => {
      // Variables/tokens files first
      const aIsVar = a.includes("variable") || a.includes("token") || a.includes("color");
      const bIsVar = b.includes("variable") || b.includes("token") || b.includes("color");
      if (aIsVar && !bIsVar) return -1;
      if (!aIsVar && bIsVar) return 1;
      return a.localeCompare(b);
    });

  if (scssFiles.length === 0) {
    return {
      success: true,
      css: "",
      error: null,
      compileError: null,
      durationMs: 0,
      file: "(none)",
    };
  }

  const combined = scssFiles.map(([, content]) => content).join("\n\n");
  return compileScssToCSS(combined, scssFiles.map(([p]) => p).join(", "));
}

// =============================================================================
// CSS Injection Script (injected into preview iframe)
// =============================================================================

/**
 * Script injected into the preview iframe that listens for CSS injection
 * messages from the parent window. Updates a <style> tag without reload.
 */
export const CSS_INJECT_SCRIPT = `
<script>
(function() {
  var styleEl = document.createElement('style');
  styleEl.id = 'platxa-live-css';
  document.head.appendChild(styleEl);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'platxa:inject-css') {
      styleEl.textContent = e.data.css || '';
    }
  });
})();
</script>`;

// =============================================================================
// Injection Helper
// =============================================================================

/**
 * Posts a CSS injection message to the preview iframe.
 * The iframe must have CSS_INJECT_SCRIPT loaded.
 */
export function injectCSSToIframe(
  iframeEl: HTMLIFrameElement | null,
  css: string,
): boolean {
  if (!iframeEl?.contentWindow) return false;

  iframeEl.contentWindow.postMessage(
    { type: "platxa:inject-css", css },
    "*",
  );
  return true;
}

// =============================================================================
// Debounced Compiler
// =============================================================================

/**
 * Creates a debounced live compiler that compiles SCSS and optionally
 * injects the result into an iframe.
 */
export function createLiveCompiler(options: LiveCompilerOptions = {}) {
  const { debounceMs = 150, onCompile } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastResult: LiveCompileResult | null = null;

  function compile(
    fileContents: Record<string, string>,
    iframeEl?: HTMLIFrameElement | null,
  ): void {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      const result = compileAllScss(fileContents);
      lastResult = result;

      if (result.success && result.css != null && iframeEl) {
        injectCSSToIframe(iframeEl, result.css);
      }

      onCompile?.(result);
    }, debounceMs);
  }

  function getLastResult(): LiveCompileResult | null {
    return lastResult;
  }

  function dispose(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { compile, getLastResult, dispose };
}
