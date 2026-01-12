/**
 * Pattern Loader
 *
 * Loads and validates bug detection patterns from JSON files.
 * Validates against the pattern schema and returns typed BugPattern objects.
 *
 * @module pattern-loader
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BugPattern,
  PatternCollection,
  PatternValidationResult,
  PatternSeverity,
  PatternCategory,
  FixType,
  PlaceholderSource,
} from './pattern-types.js';

/** Languages supported in patterns (superset of core Language type) */
type PatternLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'html'
  | 'go'
  | 'rust'
  | 'java'
  | 'any';

// =============================================================================
// Constants
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Default patterns directory (relative to package root) */
const DEFAULT_PATTERNS_DIR = resolve(__dirname, '../../patterns');

/** Valid severity levels */
const VALID_SEVERITIES: PatternSeverity[] = ['error', 'warning', 'info', 'hint'];

/** Valid categories */
const VALID_CATEGORIES: PatternCategory[] = [
  'null-safety',
  'type-safety',
  'error-handling',
  'resource-management',
  'security',
  'performance',
  'style',
  'logic',
  'async',
  'memory',
];

/** Valid languages */
const VALID_LANGUAGES: PatternLanguage[] = [
  'python',
  'javascript',
  'typescript',
  'css',
  'html',
  'go',
  'rust',
  'java',
  'any',
];

/** Valid fix types */
const VALID_FIX_TYPES: FixType[] = [
  'replace',
  'insert_before',
  'insert_after',
  'wrap',
  'delete',
  'refactor',
];

/** Valid placeholder sources */
const VALID_PLACEHOLDER_SOURCES: PlaceholderSource[] = [
  'matched_node',
  'parent',
  'context',
  'user_input',
];

/** Pattern ID regex */
const PATTERN_ID_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;

// =============================================================================
// Validation Functions
// =============================================================================

interface ValidationError {
  path: string;
  message: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

/**
 * Validate a pattern ID
 */
function validatePatternId(id: unknown, errors: ValidationError[]): id is string {
  if (typeof id !== 'string') {
    errors.push({ path: 'id', message: 'Pattern ID must be a string' });
    return false;
  }
  if (id.length < 3 || id.length > 64) {
    errors.push({ path: 'id', message: 'Pattern ID must be 3-64 characters' });
    return false;
  }
  if (!PATTERN_ID_REGEX.test(id)) {
    errors.push({
      path: 'id',
      message: 'Pattern ID must match pattern ^[a-z][a-z0-9-]*[a-z0-9]$',
    });
    return false;
  }
  return true;
}

/**
 * Validate language field
 */
function validateLanguage(
  language: unknown,
  errors: ValidationError[]
): language is PatternLanguage {
  if (typeof language !== 'string') {
    errors.push({ path: 'language', message: 'Language must be a string' });
    return false;
  }
  if (!VALID_LANGUAGES.includes(language as PatternLanguage)) {
    errors.push({
      path: 'language',
      message: `Language must be one of: ${VALID_LANGUAGES.join(', ')}`,
    });
    return false;
  }
  return true;
}

/**
 * Validate severity field
 */
function validateSeverity(
  severity: unknown,
  errors: ValidationError[]
): severity is PatternSeverity {
  if (typeof severity !== 'string') {
    errors.push({ path: 'severity', message: 'Severity must be a string' });
    return false;
  }
  if (!VALID_SEVERITIES.includes(severity as PatternSeverity)) {
    errors.push({
      path: 'severity',
      message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
    });
    return false;
  }
  return true;
}

/**
 * Validate message field
 */
function validateMessage(message: unknown, errors: ValidationError[]): message is string {
  if (typeof message !== 'string') {
    errors.push({ path: 'message', message: 'Message must be a string' });
    return false;
  }
  if (message.length < 10 || message.length > 500) {
    errors.push({ path: 'message', message: 'Message must be 10-500 characters' });
    return false;
  }
  return true;
}

/**
 * Validate category field (optional)
 */
function validateCategory(
  category: unknown,
  errors: ValidationError[]
): category is PatternCategory | undefined {
  if (category === undefined) return true;
  if (typeof category !== 'string') {
    errors.push({ path: 'category', message: 'Category must be a string' });
    return false;
  }
  if (!VALID_CATEGORIES.includes(category as PatternCategory)) {
    errors.push({
      path: 'category',
      message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
    });
    return false;
  }
  return true;
}

/**
 * Validate AST pattern (optional)
 */
function validateASTPattern(
  astPattern: unknown,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): boolean {
  if (astPattern === undefined) return true;
  if (typeof astPattern !== 'object' || astPattern === null) {
    errors.push({ path: 'ast_pattern', message: 'AST pattern must be an object' });
    return false;
  }

  const pattern = astPattern as Record<string, unknown>;

  // Validate optional type field
  if (pattern.type !== undefined && typeof pattern.type !== 'string') {
    errors.push({ path: 'ast_pattern.type', message: 'AST pattern type must be a string' });
    return false;
  }

  // Validate optional selector field
  if (pattern.selector !== undefined && typeof pattern.selector !== 'string') {
    errors.push({
      path: 'ast_pattern.selector',
      message: 'AST pattern selector must be a string',
    });
    return false;
  }

  // Warn if neither type nor selector is provided
  if (!pattern.type && !pattern.selector) {
    warnings.push({
      path: 'ast_pattern',
      message: 'AST pattern should have either type or selector',
    });
  }

  // Validate optional context field
  if (pattern.context !== undefined) {
    if (typeof pattern.context !== 'object' || pattern.context === null) {
      errors.push({
        path: 'ast_pattern.context',
        message: 'AST pattern context must be an object',
      });
      return false;
    }
    const context = pattern.context as Record<string, unknown>;
    if (context.parent_type !== undefined && typeof context.parent_type !== 'string') {
      errors.push({
        path: 'ast_pattern.context.parent_type',
        message: 'Parent type must be a string',
      });
      return false;
    }
    if (context.in_function !== undefined && typeof context.in_function !== 'boolean') {
      errors.push({
        path: 'ast_pattern.context.in_function',
        message: 'in_function must be a boolean',
      });
      return false;
    }
    if (context.in_loop !== undefined && typeof context.in_loop !== 'boolean') {
      errors.push({
        path: 'ast_pattern.context.in_loop',
        message: 'in_loop must be a boolean',
      });
      return false;
    }
    if (context.in_try_block !== undefined && typeof context.in_try_block !== 'boolean') {
      errors.push({
        path: 'ast_pattern.context.in_try_block',
        message: 'in_try_block must be a boolean',
      });
      return false;
    }
  }

  return true;
}

/**
 * Validate fix template (optional)
 */
function validateFixTemplate(
  fixTemplate: unknown,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): boolean {
  if (fixTemplate === undefined) return true;
  if (typeof fixTemplate !== 'object' || fixTemplate === null) {
    errors.push({ path: 'fix_template', message: 'Fix template must be an object' });
    return false;
  }

  const template = fixTemplate as Record<string, unknown>;

  // Validate type field
  if (template.type !== undefined) {
    if (typeof template.type !== 'string') {
      errors.push({ path: 'fix_template.type', message: 'Fix type must be a string' });
      return false;
    }
    if (!VALID_FIX_TYPES.includes(template.type as FixType)) {
      errors.push({
        path: 'fix_template.type',
        message: `Fix type must be one of: ${VALID_FIX_TYPES.join(', ')}`,
      });
      return false;
    }
  }

  // Validate template field
  if (template.template !== undefined && typeof template.template !== 'string') {
    errors.push({
      path: 'fix_template.template',
      message: 'Fix template must be a string',
    });
    return false;
  }

  // Warn if no template string provided
  if (!template.template) {
    warnings.push({
      path: 'fix_template',
      message: 'Fix template should have a template string',
    });
  }

  // Validate confidence field
  if (template.confidence !== undefined) {
    if (typeof template.confidence !== 'number') {
      errors.push({
        path: 'fix_template.confidence',
        message: 'Confidence must be a number',
      });
      return false;
    }
    if (template.confidence < 0 || template.confidence > 1) {
      errors.push({
        path: 'fix_template.confidence',
        message: 'Confidence must be between 0 and 1',
      });
      return false;
    }
  }

  // Validate imports array
  if (template.imports !== undefined) {
    if (!Array.isArray(template.imports)) {
      errors.push({ path: 'fix_template.imports', message: 'Imports must be an array' });
      return false;
    }
    for (let i = 0; i < template.imports.length; i++) {
      if (typeof template.imports[i] !== 'string') {
        errors.push({
          path: `fix_template.imports[${i}]`,
          message: 'Import must be a string',
        });
        return false;
      }
    }
  }

  // Validate placeholders
  if (template.placeholders !== undefined) {
    if (typeof template.placeholders !== 'object' || template.placeholders === null) {
      errors.push({
        path: 'fix_template.placeholders',
        message: 'Placeholders must be an object',
      });
      return false;
    }
    const placeholders = template.placeholders as Record<string, unknown>;
    for (const [key, value] of Object.entries(placeholders)) {
      if (typeof value !== 'object' || value === null) {
        errors.push({
          path: `fix_template.placeholders.${key}`,
          message: 'Placeholder definition must be an object',
        });
        return false;
      }
      const placeholder = value as Record<string, unknown>;
      if (placeholder.source !== undefined) {
        if (typeof placeholder.source !== 'string') {
          errors.push({
            path: `fix_template.placeholders.${key}.source`,
            message: 'Placeholder source must be a string',
          });
          return false;
        }
        if (!VALID_PLACEHOLDER_SOURCES.includes(placeholder.source as PlaceholderSource)) {
          errors.push({
            path: `fix_template.placeholders.${key}.source`,
            message: `Source must be one of: ${VALID_PLACEHOLDER_SOURCES.join(', ')}`,
          });
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Validate tags array (optional)
 */
function validateTags(tags: unknown, errors: ValidationError[]): boolean {
  if (tags === undefined) return true;
  if (!Array.isArray(tags)) {
    errors.push({ path: 'tags', message: 'Tags must be an array' });
    return false;
  }
  const seen = new Set<string>();
  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== 'string') {
      errors.push({ path: `tags[${i}]`, message: 'Tag must be a string' });
      return false;
    }
    if (tags[i].length < 1 || tags[i].length > 32) {
      errors.push({ path: `tags[${i}]`, message: 'Tag must be 1-32 characters' });
      return false;
    }
    if (seen.has(tags[i])) {
      errors.push({ path: `tags[${i}]`, message: 'Duplicate tag found' });
      return false;
    }
    seen.add(tags[i]);
  }
  return true;
}

/**
 * Validate a complete bug pattern
 */
export function validatePattern(pattern: unknown): PatternValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (typeof pattern !== 'object' || pattern === null) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Pattern must be an object' }],
      warnings: [],
    };
  }

  const p = pattern as Record<string, unknown>;

  // Required fields
  const idValid = validatePatternId(p.id, errors);
  const languageValid = validateLanguage(p.language, errors);
  const severityValid = validateSeverity(p.severity, errors);
  const messageValid = validateMessage(p.message, errors);

  // Optional fields
  const categoryValid = validateCategory(p.category, errors);
  const astPatternValid = validateASTPattern(p.ast_pattern, errors, warnings);
  const fixTemplateValid = validateFixTemplate(p.fix_template, errors, warnings);
  const tagsValid = validateTags(p.tags, errors);

  // Check for unknown properties
  const knownProperties = new Set([
    'id',
    'language',
    'ast_pattern',
    'message',
    'fix_template',
    'severity',
    'category',
    'tags',
    'related_patterns',
    'documentation',
    'conditions',
    'metadata',
  ]);
  for (const key of Object.keys(p)) {
    if (!knownProperties.has(key)) {
      warnings.push({ path: key, message: `Unknown property: ${key}` });
    }
  }

  const valid =
    idValid &&
    languageValid &&
    severityValid &&
    messageValid &&
    categoryValid &&
    astPatternValid &&
    fixTemplateValid &&
    tagsValid;

  return { valid, errors, warnings };
}

// =============================================================================
// Pattern Loading
// =============================================================================

export interface LoadPatternsOptions {
  /** Directory or file path to load patterns from */
  path?: string;
  /** Filter by language */
  language?: PatternLanguage;
  /** Filter by category */
  category?: PatternCategory;
  /** Filter by severity */
  severity?: PatternSeverity;
  /** Filter by tags (patterns must have all specified tags) */
  tags?: string[];
  /** Include deprecated patterns */
  includeDeprecated?: boolean;
  /** Validate patterns before returning */
  validate?: boolean;
}

export interface LoadPatternsResult {
  /** Successfully loaded patterns */
  patterns: BugPattern[];
  /** Validation errors by file */
  errors: Map<string, PatternValidationResult>;
  /** Files that were loaded */
  files: string[];
}

/**
 * Load patterns from a JSON file
 */
function loadPatternFile(filePath: string): {
  patterns: unknown[];
  error?: Error;
} {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Handle both single pattern and pattern collection formats
    if (Array.isArray(data)) {
      return { patterns: data };
    } else if (data.patterns && Array.isArray(data.patterns)) {
      return { patterns: data.patterns };
    } else if (typeof data === 'object' && data.id) {
      // Single pattern object
      return { patterns: [data] };
    } else {
      return { patterns: [], error: new Error('Invalid pattern file format') };
    }
  } catch (error) {
    return {
      patterns: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Filter patterns based on options
 */
function filterPatterns(patterns: BugPattern[], options: LoadPatternsOptions): BugPattern[] {
  return patterns.filter((pattern) => {
    // Filter by language
    if (options.language && pattern.language !== options.language && pattern.language !== 'any') {
      return false;
    }

    // Filter by category
    if (options.category && pattern.category !== options.category) {
      return false;
    }

    // Filter by severity
    if (options.severity && pattern.severity !== options.severity) {
      return false;
    }

    // Filter by tags (must have all specified tags)
    if (options.tags && options.tags.length > 0) {
      if (!pattern.tags) return false;
      for (const tag of options.tags) {
        if (!pattern.tags.includes(tag)) return false;
      }
    }

    // Filter deprecated
    if (!options.includeDeprecated && pattern.metadata?.deprecated) {
      return false;
    }

    return true;
  });
}

/**
 * Load bug detection patterns from a directory or file
 */
export function loadPatterns(options: LoadPatternsOptions = {}): LoadPatternsResult {
  const basePath = options.path ?? DEFAULT_PATTERNS_DIR;
  const validate = options.validate ?? true;

  const result: LoadPatternsResult = {
    patterns: [],
    errors: new Map(),
    files: [],
  };

  if (!existsSync(basePath)) {
    return result;
  }

  const stat = statSync(basePath);
  const filesToLoad: string[] = [];

  if (stat.isDirectory()) {
    // Load all .json files except schema.json
    const entries = readdirSync(basePath);
    for (const entry of entries) {
      if (extname(entry) === '.json' && entry !== 'schema.json') {
        filesToLoad.push(join(basePath, entry));
      }
    }
  } else if (stat.isFile() && extname(basePath) === '.json') {
    filesToLoad.push(basePath);
  }

  for (const filePath of filesToLoad) {
    const { patterns: rawPatterns, error } = loadPatternFile(filePath);

    if (error) {
      result.errors.set(filePath, {
        valid: false,
        errors: [{ path: '', message: error.message }],
        warnings: [],
      });
      continue;
    }

    result.files.push(filePath);

    for (const rawPattern of rawPatterns) {
      if (validate) {
        const validation = validatePattern(rawPattern);
        if (!validation.valid) {
          // Aggregate errors by file
          const existing = result.errors.get(filePath);
          if (existing) {
            existing.errors.push(...validation.errors);
            existing.warnings.push(...validation.warnings);
          } else {
            result.errors.set(filePath, validation);
          }
          continue;
        }
      }

      // Pattern is valid (or validation skipped), add to results
      result.patterns.push(rawPattern as BugPattern);
    }
  }

  // Apply filters
  result.patterns = filterPatterns(result.patterns, options);

  return result;
}

/**
 * Load a single pattern by ID
 */
export function loadPatternById(
  id: string,
  options: Omit<LoadPatternsOptions, 'language' | 'category' | 'severity' | 'tags'> = {}
): BugPattern | null {
  const result = loadPatterns(options);
  return result.patterns.find((p) => p.id === id) ?? null;
}

/**
 * Validate a pattern collection file
 */
export function validatePatternFile(filePath: string): PatternValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!existsSync(filePath)) {
    return {
      valid: false,
      errors: [{ path: '', message: `File not found: ${filePath}` }],
      warnings: [],
    };
  }

  const { patterns: rawPatterns, error } = loadPatternFile(filePath);

  if (error) {
    return {
      valid: false,
      errors: [{ path: '', message: error.message }],
      warnings: [],
    };
  }

  if (rawPatterns.length === 0) {
    warnings.push({ path: '', message: 'No patterns found in file' });
  }

  // Track pattern IDs for duplicate detection
  const seenIds = new Set<string>();

  for (let i = 0; i < rawPatterns.length; i++) {
    const pattern = rawPatterns[i];
    const validation = validatePattern(pattern);

    // Prefix paths with array index
    for (const err of validation.errors) {
      errors.push({
        path: `patterns[${i}].${err.path}`.replace(/\.$/, ''),
        message: err.message,
      });
    }
    for (const warn of validation.warnings) {
      warnings.push({
        path: `patterns[${i}].${warn.path}`.replace(/\.$/, ''),
        message: warn.message,
      });
    }

    // Check for duplicate IDs
    const p = pattern as Record<string, unknown>;
    if (typeof p.id === 'string') {
      if (seenIds.has(p.id)) {
        errors.push({
          path: `patterns[${i}].id`,
          message: `Duplicate pattern ID: ${p.id}`,
        });
      } else {
        seenIds.add(p.id);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Pattern Collection Management
// =============================================================================

/**
 * Create a new pattern collection
 */
export function createPatternCollection(
  name: string,
  version: string,
  patterns: BugPattern[] = [],
  description?: string
): PatternCollection {
  const collection: PatternCollection = {
    $schema: 'https://platxa.com/schemas/debug-pattern.json',
    name,
    version,
    patterns,
  };
  if (description !== undefined) {
    collection.description = description;
  }
  return collection;
}

/**
 * Get all available pattern categories
 */
export function getAvailableCategories(): PatternCategory[] {
  return [...VALID_CATEGORIES];
}

/**
 * Get all available severities
 */
export function getAvailableSeverities(): PatternSeverity[] {
  return [...VALID_SEVERITIES];
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): PatternLanguage[] {
  return [...VALID_LANGUAGES];
}
