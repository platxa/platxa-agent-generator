/**
 * Compile SCSS Tool - Dart-sass compilation with Odoo variable imports
 *
 * Features:
 * - SCSS to CSS compilation using dart-sass
 * - Odoo variable/mixin imports support
 * - Source map generation
 * - Error reporting with line numbers
 *
 * @module agentic-core/tools/compile-scss
 */

import * as sass from 'sass';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname, isAbsolute, basename, join } from 'path';
import type { ToolParams, ToolResult } from '../tool-executor';
import { yjsRegistry } from './write-file';

// ============================================================================
// Types
// ============================================================================

/** SCSS compilation error */
export interface ScssError {
  /** Error message */
  message: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** File path where error occurred */
  file?: string;
  /** Full stack trace */
  stack?: string;
}

/** Options for SCSS compilation */
export interface CompileScssOptions {
  /** SCSS file path or content to compile */
  target: string;
  /** Whether target is content (true) or file path (false) */
  isContent?: boolean;
  /** Base directory for imports */
  baseDir?: string;
  /** Output file path (if specified, writes CSS to file) */
  outputPath?: string;
  /** Generate source map */
  sourceMap?: boolean;
  /** Output style: expanded or compressed */
  style?: 'expanded' | 'compressed';
  /** Additional load paths for imports */
  loadPaths?: string[];
  /** Odoo addon paths for variable imports */
  odooAddonPaths?: string[];
  /** Custom variables to inject */
  variables?: Record<string, string>;
}

/** Result from SCSS compilation */
export interface CompileScssResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Compiled CSS content */
  css: string;
  /** Source map (if generated) */
  sourceMap?: string;
  /** Output file path (if written) */
  outputPath?: string;
  /** Compilation errors */
  errors: ScssError[];
  /** Compilation warnings */
  warnings: ScssError[];
  /** Compilation duration in ms */
  duration: number;
  /** Files included during compilation */
  includedFiles: string[];
}

// ============================================================================
// Odoo SCSS Variables
// ============================================================================

/**
 * Default Odoo SCSS variables commonly used in themes
 * These can be imported/overridden in theme SCSS
 */
const ODOO_DEFAULT_VARIABLES = `
// Odoo Bootstrap Variables
$o-we-color-palette: () !default;
$o-theme-color-palette: () !default;
$o-color-palette-names: () !default;

// Primary colors
$o-brand-primary: #714B67 !default;
$o-brand-secondary: #017e84 !default;
$o-brand-odoo: #714B67 !default;

// Grays
$o-gray-100: #f8f9fa !default;
$o-gray-200: #e9ecef !default;
$o-gray-300: #dee2e6 !default;
$o-gray-400: #ced4da !default;
$o-gray-500: #adb5bd !default;
$o-gray-600: #6c757d !default;
$o-gray-700: #495057 !default;
$o-gray-800: #343a40 !default;
$o-gray-900: #212529 !default;

// Theme colors
$o-theme-primary: var(--o-cc1-btn-primary) !default;
$o-theme-secondary: var(--o-cc1-btn-secondary) !default;

// Fonts
$o-we-font-families: () !default;
$o-we-font-family-fallbacks: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !default;

// Spacing
$o-we-spacing: 1rem !default;
$o-we-border-radius: 0.375rem !default;

// Breakpoints (Bootstrap compatible)
$grid-breakpoints: (
  xs: 0,
  sm: 576px,
  md: 768px,
  lg: 992px,
  xl: 1200px,
  xxl: 1400px
) !default;

// Container max widths
$container-max-widths: (
  sm: 540px,
  md: 720px,
  lg: 960px,
  xl: 1140px,
  xxl: 1320px
) !default;
`;

/**
 * Odoo mixins commonly used in themes
 */
const ODOO_DEFAULT_MIXINS = `
// Odoo utility mixins
@mixin o-position-absolute($top: auto, $right: auto, $bottom: auto, $left: auto) {
  position: absolute;
  top: $top;
  right: $right;
  bottom: $bottom;
  left: $left;
}

@mixin o-position-center($horizontal: true, $vertical: true) {
  position: absolute;
  @if $horizontal {
    left: 50%;
  }
  @if $vertical {
    top: 50%;
  }
  @if $horizontal and $vertical {
    transform: translate(-50%, -50%);
  } @else if $horizontal {
    transform: translateX(-50%);
  } @else if $vertical {
    transform: translateY(-50%);
  }
}

@mixin o-hover-opacity($opacity: 0.7) {
  transition: opacity 0.2s ease-in-out;
  &:hover {
    opacity: $opacity;
  }
}

@mixin o-text-overflow {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin o-bg-img($url, $size: cover, $position: center) {
  background-image: url($url);
  background-size: $size;
  background-position: $position;
  background-repeat: no-repeat;
}
`;

// ============================================================================
// SCSS Compilation
// ============================================================================

/**
 * Build SCSS content with Odoo imports prepended
 */
function buildScssContent(
  content: string,
  variables?: Record<string, string>,
  includeOdooDefaults: boolean = true
): string {
  const parts: string[] = [];

  // Add Odoo defaults if enabled
  if (includeOdooDefaults) {
    parts.push('// Odoo Default Variables');
    parts.push(ODOO_DEFAULT_VARIABLES);
    parts.push('// Odoo Default Mixins');
    parts.push(ODOO_DEFAULT_MIXINS);
  }

  // Add custom variables
  if (variables && Object.keys(variables).length > 0) {
    parts.push('// Custom Variables');
    for (const [name, value] of Object.entries(variables)) {
      parts.push(`$${name}: ${value};`);
    }
  }

  // Add user content
  parts.push('// User SCSS');
  parts.push(content);

  return parts.join('\n\n');
}

/**
 * Build load paths for sass compilation
 */
function buildLoadPaths(
  baseDir: string,
  additionalPaths?: string[],
  odooAddonPaths?: string[]
): string[] {
  const paths = [baseDir];

  // Add additional paths
  if (additionalPaths) {
    paths.push(...additionalPaths.map(p => isAbsolute(p) ? p : resolve(baseDir, p)));
  }

  // Add Odoo addon paths
  if (odooAddonPaths) {
    paths.push(...odooAddonPaths.map(p => isAbsolute(p) ? p : resolve(baseDir, p)));
  }

  // Add node_modules for Bootstrap etc.
  const nodeModules = resolve(process.cwd(), 'node_modules');
  if (existsSync(nodeModules)) {
    paths.push(nodeModules);
  }

  return paths.filter(p => existsSync(p));
}

/**
 * Parse sass error into structured format
 */
function parseSassError(error: unknown): ScssError {
  if (error instanceof sass.Exception) {
    const span = error.span;
    return {
      message: error.message,
      line: span?.start?.line ? span.start.line + 1 : undefined,
      column: span?.start?.column ? span.start.column + 1 : undefined,
      file: span?.url?.pathname,
      stack: error.sassStack,
    };
  }

  if (error instanceof Error) {
    // Try to parse line/column from error message
    const lineMatch = error.message.match(/line (\d+)/i);
    const colMatch = error.message.match(/col(?:umn)? (\d+)/i);

    return {
      message: error.message,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: colMatch ? parseInt(colMatch[1], 10) : undefined,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Resolve target to SCSS content
 */
async function resolveScssContent(
  target: string,
  isContent: boolean,
  baseDir?: string
): Promise<{ content: string; filePath?: string }> {
  if (isContent) {
    return { content: target };
  }

  const filePath = isAbsolute(target) ? target : resolve(baseDir || process.cwd(), target);

  if (!existsSync(filePath)) {
    throw new Error(`SCSS file not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  return { content, filePath };
}

/**
 * Compile SCSS to CSS
 *
 * @param options - Compilation options
 * @returns Compilation result with CSS or errors
 */
export async function compileScssImpl(options: CompileScssOptions): Promise<CompileScssResult> {
  const startTime = Date.now();
  const errors: ScssError[] = [];
  const warnings: ScssError[] = [];
  const includedFiles: string[] = [];

  try {
    // Resolve content
    const baseDir = options.baseDir || process.cwd();
    const { content, filePath } = await resolveScssContent(
      options.target,
      options.isContent ?? false,
      baseDir
    );

    // Build full SCSS with Odoo imports
    const fullScss = buildScssContent(content, options.variables, true);

    // Build load paths
    const loadPaths = buildLoadPaths(
      filePath ? dirname(filePath) : baseDir,
      options.loadPaths,
      options.odooAddonPaths
    );

    // Compile with dart-sass
    const result = sass.compileString(fullScss, {
      style: options.style || 'expanded',
      sourceMap: options.sourceMap ?? false,
      loadPaths,
      logger: {
        warn(message, opts) {
          warnings.push({
            message,
            line: opts.span?.start?.line ? opts.span.start.line + 1 : undefined,
            column: opts.span?.start?.column ? opts.span.start.column + 1 : undefined,
            file: opts.span?.url?.pathname,
          });
        },
      },
    });

    // Track included files
    for (const url of result.loadedUrls) {
      if (url.protocol === 'file:') {
        includedFiles.push(url.pathname);
      }
    }

    // Write output if path specified
    let outputPath: string | undefined;
    if (options.outputPath) {
      outputPath = isAbsolute(options.outputPath)
        ? options.outputPath
        : resolve(baseDir, options.outputPath);

      // Ensure directory exists
      const outDir = dirname(outputPath);
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      await writeFile(outputPath, result.css, 'utf-8');
      // Sync CSS output to Yjs for real-time collaboration
      yjsRegistry.updateDoc(outputPath, result.css);

      // Write source map if generated
      if (result.sourceMap && options.sourceMap) {
        const sourceMapPath = `${outputPath}.map`;
        const sourceMapContent = JSON.stringify(result.sourceMap);
        await writeFile(sourceMapPath, sourceMapContent, 'utf-8');
        // Sync source map to Yjs
        yjsRegistry.updateDoc(sourceMapPath, sourceMapContent);
      }
    }

    return {
      success: true,
      css: result.css,
      sourceMap: result.sourceMap ? JSON.stringify(result.sourceMap) : undefined,
      outputPath,
      errors: [],
      warnings,
      duration: Date.now() - startTime,
      includedFiles,
    };
  } catch (error) {
    const scssError = parseSassError(error);
    errors.push(scssError);

    return {
      success: false,
      css: '',
      errors,
      warnings,
      duration: Date.now() - startTime,
      includedFiles,
    };
  }
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Compile SCSS tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Dart-sass compilation
 * - Odoo variable imports
 * - Error reporting with line numbers
 */
export async function compileScssTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const options: CompileScssOptions = {
      target: params.target,
      isContent: params.options?.isContent as boolean,
      baseDir: params.options?.baseDir as string,
      outputPath: params.options?.outputPath as string,
      sourceMap: params.options?.sourceMap as boolean,
      style: params.options?.style as 'expanded' | 'compressed',
      loadPaths: params.options?.loadPaths as string[],
      odooAddonPaths: params.options?.odooAddonPaths as string[],
      variables: params.options?.variables as Record<string, string>,
    };

    const result = await compileScssImpl(options);

    return {
      success: result.success,
      data: {
        css: result.css,
        sourceMap: result.sourceMap,
        outputPath: result.outputPath,
        errors: result.errors,
        warnings: result.warnings,
        includedFiles: result.includedFiles,
        summary: {
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          cssLength: result.css.length,
          compilationTime: result.duration,
        },
      },
      error: result.success ? undefined : result.errors[0]?.message,
      duration: Date.now() - startTime,
      toolName: 'compile_scss',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'compile_scss',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default compileScssTool;
