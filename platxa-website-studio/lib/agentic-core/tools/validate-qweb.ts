/**
 * Validate QWeb Tool - XML syntax and t-directive validation for Odoo templates
 *
 * Features:
 * - XML syntax validation
 * - t-directive validity checking (t-if, t-foreach, t-call, t-esc, t-raw, etc.)
 * - Template inheritance validation (t-extend, t-jquery)
 * - Template reference checking (t-call targets)
 *
 * @module agentic-core/tools/validate-qweb
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import type { ToolParams, ToolResult } from '../tool-executor';

// ============================================================================
// Types
// ============================================================================

/** Validation error/warning */
export interface ValidationIssue {
  /** Error or warning */
  type: 'error' | 'warning';
  /** Issue message */
  message: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Directive or element that caused the issue */
  directive?: string;
}

/** Options for QWeb validation */
export interface ValidateQwebOptions {
  /** File path or XML content to validate */
  target: string;
  /** Whether target is content (true) or file path (false) */
  isContent?: boolean;
  /** Base directory for relative paths */
  baseDir?: string;
  /** Known template IDs for reference validation */
  knownTemplates?: string[];
  /** Strict mode (warnings become errors) */
  strict?: boolean;
}

/** Result from QWeb validation */
export interface ValidateQwebResult {
  /** Whether validation passed (no errors) */
  valid: boolean;
  /** List of errors */
  errors: ValidationIssue[];
  /** List of warnings */
  warnings: ValidationIssue[];
  /** Template IDs found in the file */
  templateIds: string[];
  /** Template references (t-call targets) */
  templateRefs: string[];
  /** Directives used */
  directivesUsed: string[];
}

// ============================================================================
// QWeb Directive Definitions
// ============================================================================

/** Valid QWeb t-directives */
const VALID_DIRECTIVES = new Set([
  // Output directives
  't-esc', 't-raw', 't-out', 't-field',
  // Control flow
  't-if', 't-elif', 't-else',
  't-foreach', 't-as',
  // Template composition
  't-call', 't-call-assets',
  't-set', 't-value',
  // Attributes
  't-att', 't-attf-',
  't-att-class', 't-att-style', 't-att-id', 't-att-href', 't-att-src',
  // Special
  't-name', 't-inherit', 't-inherit-mode',
  't-extend', 't-jquery', 't-operation',
  't-debug', 't-log',
  't-js', 't-translation',
  't-options', 't-ignore',
  't-tag', 't-component',
  't-portal', 't-ref',
  't-key', 't-cache',
]);

/** Directives that require specific attributes */
const DIRECTIVE_REQUIREMENTS: Record<string, string[]> = {
  't-foreach': ['t-as'],
  't-elif': [], // Requires preceding t-if
  't-else': [], // Requires preceding t-if or t-elif
};

/** Directives that should have a value */
const DIRECTIVES_WITH_VALUE = new Set([
  't-if', 't-elif', 't-foreach', 't-as',
  't-esc', 't-raw', 't-out', 't-field',
  't-call', 't-set', 't-value',
  't-name', 't-inherit',
]);

// ============================================================================
// XML Parsing Utilities
// ============================================================================

/**
 * Simple XML parser for QWeb validation
 * Returns parsed structure with line/column info
 */
function parseXML(content: string): {
  valid: boolean;
  errors: ValidationIssue[];
  elements: ParsedElement[];
} {
  const errors: ValidationIssue[] = [];
  const elements: ParsedElement[] = [];

  // Check for basic XML structure
  if (!content.trim()) {
    errors.push({ type: 'error', message: 'Empty content', line: 1 });
    return { valid: false, errors, elements };
  }

  // Track line numbers and depth
  const lines = content.split('\n');
  let currentLine = 1;
  let currentCol = 1;
  let currentDepth = 0;

  // Simple tag regex
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z:_][a-zA-Z0-9:._-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
  const attrRegex = /([a-zA-Z:_][a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;

  let match;
  let lastIndex = 0;

  while ((match = tagRegex.exec(content)) !== null) {
    // Update line/column tracking
    const textBefore = content.slice(lastIndex, match.index);
    for (const char of textBefore) {
      if (char === '\n') {
        currentLine++;
        currentCol = 1;
      } else {
        currentCol++;
      }
    }

    const tagName = match[1];
    const attrsString = match[2] || '';
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[0].endsWith('/>');

    // Calculate depth for this element
    // Closing tags: depth is current-1 (before we decrement)
    // Opening tags: depth is current (before we increment)
    const elementDepth = isClosing ? currentDepth - 1 : currentDepth;

    // Parse attributes
    const attributes: Record<string, string> = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? '';
      attributes[attrName] = attrValue;
    }

    elements.push({
      tagName,
      attributes,
      line: currentLine,
      column: currentCol,
      isClosing,
      isSelfClosing,
      depth: Math.max(0, elementDepth),
    });

    // Update depth after processing element
    if (isClosing) {
      currentDepth = Math.max(0, currentDepth - 1);
    } else if (!isSelfClosing) {
      currentDepth++;
    }

    // Update position after tag
    for (const char of match[0]) {
      if (char === '\n') {
        currentLine++;
        currentCol = 1;
      } else {
        currentCol++;
      }
    }
    lastIndex = match.index + match[0].length;
  }

  // Check for unclosed tags (basic check)
  const tagStack: string[] = [];
  for (const el of elements) {
    if (el.isClosing) {
      if (tagStack.length === 0 || tagStack[tagStack.length - 1] !== el.tagName) {
        errors.push({
          type: 'error',
          message: `Unexpected closing tag </${el.tagName}>`,
          line: el.line,
          column: el.column,
        });
      } else {
        tagStack.pop();
      }
    } else if (!el.isSelfClosing) {
      tagStack.push(el.tagName);
    }
  }

  // Report unclosed tags
  if (tagStack.length > 0) {
    errors.push({
      type: 'error',
      message: `Unclosed tags: ${tagStack.join(', ')}`,
      line: lines.length,
    });
  }

  return { valid: errors.length === 0, errors, elements };
}

interface ParsedElement {
  tagName: string;
  attributes: Record<string, string>;
  line: number;
  column: number;
  isClosing: boolean;
  isSelfClosing: boolean;
  /** Element depth in DOM tree (0 = root) */
  depth: number;
}

// ============================================================================
// QWeb Validation
// ============================================================================

/**
 * Validate QWeb directives in parsed elements
 */
function validateDirectives(
  elements: ParsedElement[],
  knownTemplates: Set<string>
): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  templateIds: string[];
  templateRefs: string[];
  directivesUsed: string[];
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const templateIds: string[] = [];
  const templateRefs: string[] = [];
  const directivesUsed = new Set<string>();

  // Track conditionals per-depth level to handle nested elements correctly
  // Key: depth, Value: last conditional directive at that depth
  const conditionalsByDepth = new Map<number, 't-if' | 't-elif' | null>();

  for (const el of elements) {
    if (el.isClosing) {
      // Clear conditional tracking for depths deeper than current
      // This ensures child elements don't affect sibling conditional chains
      for (const depth of conditionalsByDepth.keys()) {
        if (depth > el.depth) {
          conditionalsByDepth.delete(depth);
        }
      }
      continue;
    }

    const depth = el.depth;
    const lastConditional = conditionalsByDepth.get(depth) ?? null;

    // Check each attribute for t-directives
    for (const [attrName, attrValue] of Object.entries(el.attributes)) {
      if (!attrName.startsWith('t-')) continue;

      // Track directive usage
      const baseDirective = attrName.replace(/^(t-att[f]?-).*/, '$1');
      directivesUsed.add(baseDirective || attrName);

      // Check if directive is valid
      const isValidDirective = VALID_DIRECTIVES.has(attrName) ||
        attrName.startsWith('t-att-') ||
        attrName.startsWith('t-attf-');

      if (!isValidDirective) {
        warnings.push({
          type: 'warning',
          message: `Unknown directive: ${attrName}`,
          line: el.line,
          column: el.column,
          directive: attrName,
        });
      }

      // Check for empty values on directives that require them
      if (DIRECTIVES_WITH_VALUE.has(attrName) && !attrValue.trim()) {
        errors.push({
          type: 'error',
          message: `Directive ${attrName} requires a value`,
          line: el.line,
          column: el.column,
          directive: attrName,
        });
      }

      // Validate specific directives
      switch (attrName) {
        case 't-name':
          templateIds.push(attrValue);
          break;

        case 't-call':
          templateRefs.push(attrValue);
          // Check if template exists (if we have a list)
          if (knownTemplates.size > 0 && !knownTemplates.has(attrValue) && !attrValue.includes('.')) {
            warnings.push({
              type: 'warning',
              message: `Template reference not found: ${attrValue}`,
              line: el.line,
              column: el.column,
              directive: attrName,
            });
          }
          break;

        case 't-foreach':
          // Check for t-as
          if (!el.attributes['t-as']) {
            errors.push({
              type: 'error',
              message: 't-foreach requires t-as attribute',
              line: el.line,
              column: el.column,
              directive: attrName,
            });
          }
          break;

        case 't-elif':
          if (lastConditional !== 't-if' && lastConditional !== 't-elif') {
            errors.push({
              type: 'error',
              message: 't-elif must follow t-if or t-elif',
              line: el.line,
              column: el.column,
              directive: attrName,
            });
          }
          break;

        case 't-else':
          if (lastConditional !== 't-if' && lastConditional !== 't-elif') {
            errors.push({
              type: 'error',
              message: 't-else must follow t-if or t-elif',
              line: el.line,
              column: el.column,
              directive: attrName,
            });
          }
          break;

        case 't-inherit':
          templateRefs.push(attrValue);
          break;
      }
    }

    // Update conditional tracking at this depth level
    const hasIf = 't-if' in el.attributes;
    const hasElif = 't-elif' in el.attributes;
    const hasElse = 't-else' in el.attributes;

    if (hasIf) {
      conditionalsByDepth.set(depth, 't-if');
    } else if (hasElif) {
      conditionalsByDepth.set(depth, 't-elif');
    } else if (hasElse) {
      // t-else terminates the chain
      conditionalsByDepth.set(depth, null);
    } else {
      // Non-conditional element at this depth resets the chain
      conditionalsByDepth.set(depth, null);
    }
  }

  return {
    errors,
    warnings,
    templateIds,
    templateRefs,
    directivesUsed: Array.from(directivesUsed),
  };
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Resolve target to content
 */
async function resolveContent(
  target: string,
  isContent: boolean,
  baseDir?: string
): Promise<string> {
  if (isContent) {
    return target;
  }

  const filePath = isAbsolute(target) ? target : resolve(baseDir || process.cwd(), target);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return readFile(filePath, 'utf-8');
}

/**
 * Validate QWeb template content
 *
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export async function validateQwebImpl(options: ValidateQwebOptions): Promise<ValidateQwebResult> {
  const content = await resolveContent(options.target, options.isContent ?? false, options.baseDir);
  const knownTemplates = new Set(options.knownTemplates || []);

  // Parse XML
  const parseResult = parseXML(content);

  // Validate directives
  const directiveResult = validateDirectives(parseResult.elements, knownTemplates);

  // Combine results
  const allErrors = [...parseResult.errors, ...directiveResult.errors];
  const allWarnings = directiveResult.warnings;

  // In strict mode, warnings become errors
  if (options.strict) {
    allErrors.push(...allWarnings.map(w => ({ ...w, type: 'error' as const })));
    allWarnings.length = 0;
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    templateIds: directiveResult.templateIds,
    templateRefs: directiveResult.templateRefs,
    directivesUsed: directiveResult.directivesUsed,
  };
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Validate QWeb tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - XML syntax validation
 * - t-directive validation
 * - Template reference checking
 */
export async function validateQwebTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const options: ValidateQwebOptions = {
      target: params.target,
      isContent: params.options?.isContent as boolean,
      baseDir: params.options?.baseDir as string,
      knownTemplates: params.options?.knownTemplates as string[],
      strict: params.options?.strict as boolean,
    };

    const result = await validateQwebImpl(options);

    return {
      success: true,
      data: {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        templateIds: result.templateIds,
        templateRefs: result.templateRefs,
        directivesUsed: result.directivesUsed,
        summary: {
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          templateCount: result.templateIds.length,
        },
      },
      duration: Date.now() - startTime,
      toolName: 'validate_qweb',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'validate_qweb',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default validateQwebTool;
