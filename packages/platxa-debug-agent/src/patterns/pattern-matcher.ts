/**
 * Pattern Matcher Engine
 *
 * Uses tree-sitter AST queries to match bug patterns against source code.
 * Returns matches with locations and confidence scores.
 *
 * @module pattern-matcher
 */

import Parser from 'tree-sitter';
import type { Language } from '../core/types.js';
import type { BugPattern, PatternMatch, ASTPattern, ASTContext } from './pattern-types.js';

// =============================================================================
// Types
// =============================================================================

export interface PatternMatcherConfig {
  /** Minimum confidence threshold for matches (0-1) */
  minConfidence?: number;
  /** Maximum matches to return per pattern */
  maxMatchesPerPattern?: number;
  /** Include context lines around matches */
  includeContext?: boolean;
  /** Number of context lines before/after */
  contextLines?: number;
}

export interface MatchContext {
  /** Lines before the match */
  before: string[];
  /** Lines after the match */
  after: string[];
}

export interface ExtendedPatternMatch extends PatternMatch {
  /** Context around the match */
  context?: MatchContext;
}

export interface MatchResult {
  /** All pattern matches found */
  matches: ExtendedPatternMatch[];
  /** Patterns that were checked */
  patternsChecked: number;
  /** Time taken to match (ms) */
  duration: number;
  /** Any errors encountered */
  errors: Array<{ patternId: string; error: string }>;
}

// =============================================================================
// Language Parser Configuration
// =============================================================================

interface LanguageParserConfig {
  /** Tree-sitter language module */
  module: string;
  /** Node types that represent functions */
  functionTypes: string[];
  /** Node types that represent loops */
  loopTypes: string[];
  /** Node types that represent try blocks */
  tryTypes: string[];
  /** Node types that represent classes */
  classTypes: string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageParserConfig> = {
  javascript: {
    module: 'tree-sitter-javascript',
    functionTypes: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    loopTypes: ['for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement'],
    tryTypes: ['try_statement'],
    classTypes: ['class_declaration', 'class_expression'],
  },
  typescript: {
    module: 'tree-sitter-typescript',
    functionTypes: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    loopTypes: ['for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement'],
    tryTypes: ['try_statement'],
    classTypes: ['class_declaration', 'class_expression'],
  },
  python: {
    module: 'tree-sitter-python',
    functionTypes: ['function_definition'],
    loopTypes: ['for_statement', 'while_statement'],
    tryTypes: ['try_statement'],
    classTypes: ['class_definition'],
  },
  css: {
    module: 'tree-sitter-css',
    functionTypes: [],
    loopTypes: [],
    tryTypes: [],
    classTypes: [],
  },
};

// =============================================================================
// Pattern Matcher Class
// =============================================================================

/**
 * Pattern matcher engine using tree-sitter AST queries
 */
export class PatternMatcher {
  private readonly config: Required<PatternMatcherConfig>;
  private readonly parsers: Map<string, Parser> = new Map();
  private readonly languageModules: Map<string, unknown> = new Map();

  constructor(config: PatternMatcherConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
      maxMatchesPerPattern: config.maxMatchesPerPattern ?? 100,
      includeContext: config.includeContext ?? false,
      contextLines: config.contextLines ?? 3,
    };
  }

  /**
   * Match patterns against source code
   */
  async match(
    code: string,
    patterns: BugPattern[],
    language?: Language
  ): Promise<MatchResult> {
    const startTime = Date.now();
    const result: MatchResult = {
      matches: [],
      patternsChecked: 0,
      duration: 0,
      errors: [],
    };

    // Detect language if not provided
    const detectedLanguage = language ?? this.detectLanguage(code);
    if (!detectedLanguage || !LANGUAGE_CONFIGS[detectedLanguage]) {
      result.errors.push({
        patternId: '*',
        error: `Unsupported or undetected language: ${detectedLanguage}`,
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    // Parse code to AST
    const tree = await this.parseCode(code, detectedLanguage);
    if (!tree) {
      result.errors.push({
        patternId: '*',
        error: 'Failed to parse code',
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    const codeLines = code.split('\n');

    // Filter patterns by language
    const applicablePatterns = patterns.filter(
      (p) => p.language === detectedLanguage || p.language === 'any'
    );

    // Match each pattern
    for (const pattern of applicablePatterns) {
      result.patternsChecked++;

      try {
        const matches = this.matchPattern(tree.rootNode, pattern, code, codeLines, detectedLanguage);

        // Apply confidence threshold and limit
        const filteredMatches = matches
          .filter((m) => m.confidence >= this.config.minConfidence)
          .slice(0, this.config.maxMatchesPerPattern);

        result.matches.push(...filteredMatches);
      } catch (error) {
        result.errors.push({
          patternId: pattern.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Match a single pattern against an AST
   */
  private matchPattern(
    rootNode: Parser.SyntaxNode,
    pattern: BugPattern,
    code: string,
    codeLines: string[],
    language: string
  ): ExtendedPatternMatch[] {
    const matches: ExtendedPatternMatch[] = [];
    const astPattern = pattern.ast_pattern;

    if (!astPattern) {
      // Pattern without AST pattern - skip
      return matches;
    }

    // Traverse AST and find matching nodes
    this.traverseAST(rootNode, (node) => {
      const matchResult = this.nodeMatchesPattern(node, astPattern, rootNode, language);

      if (matchResult.matches) {
        const match = this.createMatch(pattern, node, code, codeLines, matchResult.confidence);
        if (match) {
          matches.push(match);
        }
      }
    });

    return matches;
  }

  /**
   * Check if a node matches an AST pattern
   */
  private nodeMatchesPattern(
    node: Parser.SyntaxNode,
    astPattern: ASTPattern,
    rootNode: Parser.SyntaxNode,
    language: string
  ): { matches: boolean; confidence: number } {
    let confidence = 1.0;
    let typeMatches = true;
    let propertiesMatch = true;
    let contextMatches = true;

    // Check node type
    if (astPattern.type) {
      typeMatches = node.type === astPattern.type;
      if (!typeMatches) {
        return { matches: false, confidence: 0 };
      }
    }

    // Check CSS-like selector (simplified implementation)
    if (astPattern.selector) {
      const selectorResult = this.matchSelector(node, astPattern.selector);
      if (!selectorResult.matches) {
        return { matches: false, confidence: 0 };
      }
      confidence *= selectorResult.confidence;
    }

    // Check properties
    if (astPattern.properties) {
      propertiesMatch = this.matchProperties(node, astPattern.properties);
      if (!propertiesMatch) {
        return { matches: false, confidence: 0 };
      }
    }

    // Check context requirements
    if (astPattern.context) {
      const contextResult = this.matchContext(node, astPattern.context, rootNode, language);
      if (!contextResult.matches) {
        return { matches: false, confidence: 0 };
      }
      confidence *= contextResult.confidence;
    }

    return { matches: typeMatches && propertiesMatch && contextMatches, confidence };
  }

  /**
   * Match a CSS-like selector against a node
   */
  private matchSelector(
    node: Parser.SyntaxNode,
    selector: string
  ): { matches: boolean; confidence: number } {
    // Parse selector components
    // Format: NodeType[property=value]:pseudo-class

    // Extract node type from selector
    const typeMatch = selector.match(/^([A-Za-z_]+)/);
    if (typeMatch && typeMatch[1] !== node.type) {
      return { matches: false, confidence: 0 };
    }

    // Extract attribute selectors [attr=value]
    const attrMatches = selector.matchAll(/\[([^\]=]+)(?:=(['"]?)([^'"\]]+)\2)?\]/g);
    for (const match of attrMatches) {
      const [, attr, , value] = match;
      if (!attr) continue;
      const nodeValue = this.getNodeProperty(node, attr);

      if (value !== undefined) {
        if (nodeValue !== value) {
          return { matches: false, confidence: 0 };
        }
      } else {
        // Just checking attribute exists
        if (nodeValue === undefined) {
          return { matches: false, confidence: 0 };
        }
      }
    }

    // Check for :not() pseudo-class
    const notMatch = selector.match(/:not\(([^)]+)\)/);
    if (notMatch && notMatch[1]) {
      const innerSelector = notMatch[1];
      const innerResult = this.matchSelector(node, innerSelector);
      if (innerResult.matches) {
        return { matches: false, confidence: 0 };
      }
    }

    // Check for :has() pseudo-class (child selector)
    const hasMatch = selector.match(/:has\(([^)]+)\)/);
    if (hasMatch && hasMatch[1]) {
      const childSelector = hasMatch[1];
      let hasMatchingChild = false;
      this.traverseAST(node, (child) => {
        if (child !== node) {
          const childResult = this.matchSelector(child, childSelector);
          if (childResult.matches) {
            hasMatchingChild = true;
          }
        }
      });
      if (!hasMatchingChild) {
        return { matches: false, confidence: 0 };
      }
    }

    // Check regex patterns in attribute values [attr=/regex/]
    const regexMatches = selector.matchAll(/\[([^\]=]+)=\/([^/]+)\/\]/g);
    for (const match of regexMatches) {
      const [, attr, pattern] = match;
      if (!attr || !pattern) continue;
      const nodeValue = this.getNodeProperty(node, attr);
      if (typeof nodeValue !== 'string' || !new RegExp(pattern).test(nodeValue)) {
        return { matches: false, confidence: 0 };
      }
    }

    return { matches: true, confidence: 0.9 };
  }

  /**
   * Get a property value from a node
   */
  private getNodeProperty(node: Parser.SyntaxNode, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = node;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === 'object') {
        // Handle special tree-sitter node properties
        const nodeObj = current as Parser.SyntaxNode;

        if (part === 'name' && nodeObj.type) {
          // Try to get the name from child nodes
          const nameChild = nodeObj.childForFieldName?.('name');
          if (nameChild) {
            current = nameChild.text;
            continue;
          }
        }

        if (part === 'type') {
          current = nodeObj.type;
          continue;
        }

        if (part === 'text') {
          current = nodeObj.text;
          continue;
        }

        // Try field name access
        if (nodeObj.childForFieldName) {
          const fieldChild = nodeObj.childForFieldName(part);
          if (fieldChild) {
            current = fieldChild;
            continue;
          }
        }

        // Try property access
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Match properties against a node
   */
  private matchProperties(
    node: Parser.SyntaxNode,
    properties: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(properties)) {
      const nodeValue = this.getNodeProperty(node, key);

      if (value === null) {
        // Check for null/undefined
        if (nodeValue !== null && nodeValue !== undefined) {
          return false;
        }
      } else if (typeof value === 'string' && value.startsWith('/') && value.endsWith('/')) {
        // Regex pattern
        const pattern = value.slice(1, -1);
        if (typeof nodeValue !== 'string' || !new RegExp(pattern).test(nodeValue)) {
          return false;
        }
      } else if (nodeValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Match context requirements
   */
  private matchContext(
    node: Parser.SyntaxNode,
    context: ASTContext,
    _rootNode: Parser.SyntaxNode,
    language: string
  ): { matches: boolean; confidence: number } {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return { matches: true, confidence: 0.5 };
    }

    let confidence = 1.0;

    // Check parent type
    if (context.parent_type) {
      if (!node.parent || node.parent.type !== context.parent_type) {
        return { matches: false, confidence: 0 };
      }
    }

    // Check if in function
    if (context.in_function !== undefined) {
      const inFunction = this.isInsideNodeType(node, config.functionTypes);
      if (context.in_function !== inFunction) {
        return { matches: false, confidence: 0 };
      }
      confidence *= 0.95;
    }

    // Check if in loop
    if (context.in_loop !== undefined) {
      const inLoop = this.isInsideNodeType(node, config.loopTypes);
      if (context.in_loop !== inLoop) {
        return { matches: false, confidence: 0 };
      }
      confidence *= 0.95;
    }

    // Check if in try block
    if (context.in_try_block !== undefined) {
      const inTry = this.isInsideNodeType(node, config.tryTypes);
      if (context.in_try_block !== inTry) {
        return { matches: false, confidence: 0 };
      }
      confidence *= 0.95;
    }

    return { matches: true, confidence };
  }

  /**
   * Check if a node is inside any of the given node types
   */
  private isInsideNodeType(node: Parser.SyntaxNode, types: string[]): boolean {
    let current = node.parent;
    while (current) {
      if (types.includes(current.type)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Create a PatternMatch from a matched node
   */
  private createMatch(
    pattern: BugPattern,
    node: Parser.SyntaxNode,
    _code: string,
    codeLines: string[],
    confidence: number
  ): ExtendedPatternMatch | null {
    const startLine = node.startPosition.row + 1; // 1-based
    const endLine = node.endPosition.row + 1;
    const startColumn = node.startPosition.column + 1;
    const endColumn = node.endPosition.column + 1;

    const match: ExtendedPatternMatch = {
      pattern,
      location: {
        file: '', // Will be set by caller if needed
        line: startLine,
        column: startColumn,
        endLine,
        endColumn,
      },
      code: node.text,
      captures: this.extractCaptures(node),
      confidence: Math.min(confidence, pattern.fix_template?.confidence ?? 1.0),
    };

    // Add context if configured
    if (this.config.includeContext) {
      const contextBefore: string[] = [];
      const contextAfter: string[] = [];

      for (let i = Math.max(0, startLine - 1 - this.config.contextLines); i < startLine - 1; i++) {
        contextBefore.push(codeLines[i] ?? '');
      }

      for (let i = endLine; i < Math.min(codeLines.length, endLine + this.config.contextLines); i++) {
        contextAfter.push(codeLines[i] ?? '');
      }

      match.context = {
        before: contextBefore,
        after: contextAfter,
      };
    }

    return match;
  }

  /**
   * Extract named captures from a node
   */
  private extractCaptures(node: Parser.SyntaxNode): Record<string, string> {
    const captures: Record<string, string> = {};

    // Extract common captures
    captures['matched'] = node.text;
    captures['type'] = node.type;

    // Extract named children as captures
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {
        const fieldName = node.fieldNameForChild?.(i);
        if (fieldName) {
          captures[fieldName] = child.text;
        }
      }
    }

    return captures;
  }

  /**
   * Traverse AST and call callback for each node
   */
  private traverseAST(
    node: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode) => void
  ): void {
    callback(node);
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.traverseAST(child, callback);
      }
    }
  }

  /**
   * Parse code to AST
   */
  private async parseCode(code: string, language: string): Promise<Parser.Tree | null> {
    const parser = await this.getParser(language);
    if (!parser) {
      return null;
    }

    try {
      return parser.parse(code);
    } catch {
      return null;
    }
  }

  /**
   * Get or create a parser for a language
   */
  private async getParser(language: string): Promise<Parser | null> {
    if (this.parsers.has(language)) {
      return this.parsers.get(language)!;
    }

    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return null;
    }

    try {
      const parser = new Parser();

      // Load language module
      let langModule = this.languageModules.get(language);
      if (!langModule) {
        // Dynamic import of tree-sitter language
        if (language === 'typescript') {
          const tsModule = await import('tree-sitter-typescript');
          langModule = tsModule.default?.typescript ?? tsModule.typescript;
        } else {
          const module = await import(config.module);
          langModule = module.default ?? module;
        }
        this.languageModules.set(language, langModule);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.setLanguage(langModule as any);
      this.parsers.set(language, parser);
      return parser;
    } catch {
      return null;
    }
  }

  /**
   * Simple language detection based on code patterns
   */
  private detectLanguage(code: string): Language | null {
    // Python detection
    if (code.includes('def ') && code.includes(':') && !code.includes('{')) {
      return 'python';
    }
    if (code.includes('import ') && code.includes('from ') && !code.includes('{')) {
      return 'python';
    }

    // TypeScript detection (before JS since it's a superset)
    if (code.includes(': string') || code.includes(': number') || code.includes(': boolean')) {
      return 'typescript';
    }
    if (code.includes('interface ') || code.includes('type ') && code.includes('=')) {
      return 'typescript';
    }

    // JavaScript detection
    if (code.includes('const ') || code.includes('let ') || code.includes('var ')) {
      return 'javascript';
    }
    if (code.includes('function ') || code.includes('=>')) {
      return 'javascript';
    }

    // CSS detection
    if (code.includes('{') && code.includes('}') && code.includes(':') && code.includes(';')) {
      if (!code.includes('function') && !code.includes('const ')) {
        return 'css';
      }
    }

    return null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PatternMatcher instance
 */
export function createPatternMatcher(config?: PatternMatcherConfig): PatternMatcher {
  return new PatternMatcher(config);
}

/**
 * Quick match function for simple use cases
 */
export async function matchPatterns(
  code: string,
  patterns: BugPattern[],
  language?: Language
): Promise<PatternMatch[]> {
  const matcher = createPatternMatcher();
  const result = await matcher.match(code, patterns, language);
  return result.matches;
}
