/**
 * Pattern Types
 *
 * TypeScript type definitions for bug detection patterns.
 * These types correspond to the JSON schema in patterns/schema.json.
 *
 * @module pattern-types
 */

import type { Language } from '../core/types.js';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Severity levels for bug patterns
 */
export type PatternSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Categories of bug patterns
 */
export type PatternCategory =
  | 'null-safety'
  | 'type-safety'
  | 'error-handling'
  | 'resource-management'
  | 'security'
  | 'performance'
  | 'style'
  | 'logic'
  | 'async'
  | 'memory';

/**
 * Fix types
 */
export type FixType =
  | 'replace'
  | 'insert_before'
  | 'insert_after'
  | 'wrap'
  | 'delete'
  | 'refactor';

/**
 * Placeholder source types
 */
export type PlaceholderSource = 'matched_node' | 'parent' | 'context' | 'user_input';

// =============================================================================
// AST Pattern Types
// =============================================================================

/**
 * Context requirements for AST matching
 */
export interface ASTContext {
  /** Required parent node type */
  parent_type?: string;
  /** Must be inside a function */
  in_function?: boolean;
  /** Must be inside a loop */
  in_loop?: boolean;
  /** Must be inside a try block */
  in_try_block?: boolean;
}

/**
 * AST pattern matching specification
 */
export interface ASTPattern {
  /** AST node type to match */
  type?: string;
  /** CSS-like selector for AST nodes */
  selector?: string;
  /** Properties the AST node must have */
  properties?: Record<string, unknown>;
  /** Required context around the matched node */
  context?: ASTContext;
}

// =============================================================================
// Fix Template Types
// =============================================================================

/**
 * Placeholder definition
 */
export interface PlaceholderDefinition {
  /** Description of the placeholder */
  description?: string;
  /** Source of the placeholder value */
  source?: PlaceholderSource;
}

/**
 * Fix template for generating suggestions
 */
export interface FixTemplate {
  /** Type of fix to apply */
  type: FixType;
  /** Code template with placeholders ({{variable}} syntax) */
  template: string;
  /** Description of template placeholders */
  placeholders?: Record<string, PlaceholderDefinition>;
  /** Imports required for the fix */
  imports?: string[];
  /** Confidence score for this fix (0-1) */
  confidence?: number;
}

// =============================================================================
// Documentation Types
// =============================================================================

/**
 * Code example for documentation
 */
export interface PatternExample {
  /** Code that triggers the pattern */
  bad: string;
  /** Corrected code */
  good: string;
  /** Why the good version is better */
  explanation?: string;
}

/**
 * Extended documentation for a pattern
 */
export interface PatternDocumentation {
  /** Detailed explanation of the bug */
  description?: string;
  /** Why this pattern is important */
  rationale?: string;
  /** Example code snippets */
  examples?: PatternExample[];
  /** External references (URLs, documentation) */
  references?: string[];
}

// =============================================================================
// Condition Types
// =============================================================================

/**
 * Conditions for when a pattern applies
 */
export interface PatternConditions {
  /** Minimum language version required */
  min_language_version?: string;
  /** Frameworks this pattern applies to */
  frameworks?: string[];
  /** File glob patterns to match */
  file_patterns?: string[];
  /** File glob patterns to exclude */
  exclude_patterns?: string[];
}

// =============================================================================
// Metadata Types
// =============================================================================

/**
 * Pattern metadata
 */
export interface PatternMetadata {
  /** Pattern version */
  version?: string;
  /** Pattern author */
  author?: string;
  /** Creation timestamp */
  created?: string;
  /** Last update timestamp */
  updated?: string;
  /** Whether this pattern is deprecated */
  deprecated?: boolean;
  /** ID of pattern that replaces this one (if deprecated) */
  replaced_by?: string;
}

// =============================================================================
// Main Pattern Type
// =============================================================================

/**
 * Bug detection pattern definition
 */
export interface BugPattern {
  /** Unique identifier for the pattern */
  id: string;
  /** Programming language this pattern applies to */
  language: Language | 'any';
  /** AST pattern matching specification */
  ast_pattern?: ASTPattern;
  /** Human-readable description of the bug */
  message: string;
  /** Template for generating fix suggestions */
  fix_template?: FixTemplate;
  /** Severity level of the bug */
  severity: PatternSeverity;
  /** Category of the bug pattern */
  category?: PatternCategory;
  /** Tags for filtering and searching patterns */
  tags?: string[];
  /** IDs of related patterns */
  related_patterns?: string[];
  /** Extended documentation for the pattern */
  documentation?: PatternDocumentation;
  /** Conditions for when this pattern applies */
  conditions?: PatternConditions;
  /** Pattern metadata */
  metadata?: PatternMetadata;
}

// =============================================================================
// Collection Types
// =============================================================================

/**
 * Collection of bug patterns
 */
export interface PatternCollection {
  /** Schema version */
  $schema?: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description?: string;
  /** Collection version */
  version: string;
  /** Patterns in this collection */
  patterns: BugPattern[];
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Matched pattern */
  pattern: BugPattern;
  /** Location of the match */
  location: {
    file: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
  };
  /** Matched code snippet */
  code?: string;
  /** Extracted values from the match */
  captures?: Record<string, string>;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Pattern validation result
 */
export interface PatternValidationResult {
  /** Whether the pattern is valid */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    path: string;
    message: string;
  }>;
  /** Validation warnings */
  warnings: Array<{
    path: string;
    message: string;
  }>;
}
