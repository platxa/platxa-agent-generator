/**
 * Async/Await Error Pattern Detector
 *
 * Detects common async/await anti-patterns in JavaScript/TypeScript code:
 * - Missing await on async function calls
 * - Unhandled promise rejections
 * - Floating promises (promises without await or .catch)
 * - Async operations inside loops (sequential instead of parallel)
 *
 * @module async-pattern-detector
 */

import Parser from 'tree-sitter';
import type { SourceLocation } from '../core/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Types of async pattern issues
 */
export type AsyncPatternType =
  | 'missing-await'
  | 'unhandled-rejection'
  | 'floating-promise'
  | 'async-in-loop';

/**
 * Detected async pattern issue
 */
export interface AsyncPatternIssue {
  /** Type of async pattern issue */
  type: AsyncPatternType;
  /** Location in source code */
  location: SourceLocation;
  /** Human-readable message describing the issue */
  message: string;
  /** Code snippet containing the issue */
  code: string;
  /** Suggested fix description */
  suggestion: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional context about the issue */
  context?: {
    /** Name of the async function/method if identifiable */
    functionName?: string;
    /** Whether inside a try-catch block */
    inTryCatch?: boolean;
    /** Loop type if inside a loop */
    loopType?: string;
  };
}

/**
 * Result of async pattern detection
 */
export interface AsyncPatternResult {
  /** All detected issues */
  issues: AsyncPatternIssue[];
  /** Detection duration in milliseconds */
  duration: number;
  /** Number of async patterns analyzed */
  patternsAnalyzed: number;
  /** Parsing errors if any */
  errors: string[];
}

/**
 * Configuration for async pattern detection
 */
export interface AsyncPatternConfig {
  /** Detect missing await issues */
  detectMissingAwait?: boolean;
  /** Detect unhandled rejections */
  detectUnhandledRejections?: boolean;
  /** Detect floating promises */
  detectFloatingPromises?: boolean;
  /** Detect async in loops */
  detectAsyncInLoops?: boolean;
  /** Known async function names (in addition to auto-detection) */
  knownAsyncFunctions?: string[];
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
}

// =============================================================================
// Constants
// =============================================================================

const PROMISE_METHODS = new Set([
  'then',
  'catch',
  'finally',
  'all',
  'allSettled',
  'race',
  'any',
  'resolve',
  'reject',
]);

const ASYNC_PATTERNS = [
  /^fetch$/,
  /^axios/,
  /Async$/,
  /^get[A-Z]/,
  /^post[A-Z]/,
  /^put[A-Z]/,
  /^delete[A-Z]/,
  /^load/,
  /^save/,
  /^read/,
  /^write/,
  /^find/,
  /^create/,
  /^update/,
  /^remove/,
  /Promise/,
];

const LOOP_TYPES = new Set([
  'for_statement',
  'for_in_statement',
  'for_of_statement',
  'while_statement',
  'do_statement',
]);

// =============================================================================
// AsyncPatternDetector Class
// =============================================================================

/**
 * Detects async/await error patterns in JavaScript/TypeScript code
 */
export class AsyncPatternDetector {
  private readonly config: Required<AsyncPatternConfig>;
  private parser: Parser | null = null;
  private languageModule: unknown = null;

  constructor(config: AsyncPatternConfig = {}) {
    this.config = {
      detectMissingAwait: config.detectMissingAwait ?? true,
      detectUnhandledRejections: config.detectUnhandledRejections ?? true,
      detectFloatingPromises: config.detectFloatingPromises ?? true,
      detectAsyncInLoops: config.detectAsyncInLoops ?? true,
      knownAsyncFunctions: config.knownAsyncFunctions ?? [],
      minConfidence: config.minConfidence ?? 0.5,
    };
  }

  /**
   * Detect async pattern issues in JavaScript/TypeScript code
   */
  async detect(
    code: string,
    filePath: string = 'unknown',
    language: 'javascript' | 'typescript' = 'javascript'
  ): Promise<AsyncPatternResult> {
    const startTime = Date.now();
    const result: AsyncPatternResult = {
      issues: [],
      duration: 0,
      patternsAnalyzed: 0,
      errors: [],
    };

    // Parse code
    const tree = await this.parseCode(code, language);
    if (!tree) {
      result.errors.push('Failed to parse code');
      result.duration = Date.now() - startTime;
      return result;
    }

    // Build context about async functions in the file
    const asyncContext = this.buildAsyncContext(tree.rootNode);

    // Detect each pattern type
    if (this.config.detectMissingAwait) {
      const issues = this.detectMissingAwait(tree.rootNode, asyncContext, filePath);
      result.issues.push(...issues);
      result.patternsAnalyzed++;
    }

    if (this.config.detectUnhandledRejections) {
      const issues = this.detectUnhandledRejections(tree.rootNode, filePath);
      result.issues.push(...issues);
      result.patternsAnalyzed++;
    }

    if (this.config.detectFloatingPromises) {
      const issues = this.detectFloatingPromises(tree.rootNode, asyncContext, filePath);
      result.issues.push(...issues);
      result.patternsAnalyzed++;
    }

    if (this.config.detectAsyncInLoops) {
      const issues = this.detectAsyncInLoops(tree.rootNode, asyncContext, filePath);
      result.issues.push(...issues);
      result.patternsAnalyzed++;
    }

    // Filter by confidence
    result.issues = result.issues.filter(
      (issue) => issue.confidence >= this.config.minConfidence
    );

    result.duration = Date.now() - startTime;
    return result;
  }

  // ===========================================================================
  // Pattern Detection Methods
  // ===========================================================================

  /**
   * Detect missing await on async function calls
   */
  private detectMissingAwait(
    rootNode: Parser.SyntaxNode,
    asyncContext: AsyncContext,
    filePath: string
  ): AsyncPatternIssue[] {
    const issues: AsyncPatternIssue[] = [];

    this.traverseAST(rootNode, (node) => {
      // Look for call expressions that might be async
      if (node.type !== 'call_expression') return;

      // Skip if already awaited
      if (this.isAwaited(node)) return;

      // Skip if part of a promise chain (.then/.catch)
      if (this.isPartOfPromiseChain(node)) return;

      // Skip if explicitly returned
      if (this.isReturned(node)) return;

      // Check if this call is likely async
      const functionName = this.getCallFunctionName(node);
      const isLikelyAsync = this.isLikelyAsyncCall(functionName, asyncContext);

      if (!isLikelyAsync) return;

      // Check if we're inside an async function (where await would be valid)
      const containingFunction = this.findContainingFunction(node);
      const isInAsyncFunction = containingFunction !== null &&
        this.isFunctionAsync(containingFunction);

      // Determine confidence based on context
      let confidence = 0.7;
      if (asyncContext.declaredAsyncFunctions.has(functionName)) {
        confidence = 0.95;
      } else if (this.matchesAsyncPattern(functionName)) {
        confidence = 0.8;
      }

      // Lower confidence if not in an async function (await would be syntax error)
      if (!isInAsyncFunction) {
        confidence *= 0.5;
      }

      issues.push({
        type: 'missing-await',
        location: this.nodeToLocation(node, filePath),
        message: `Async function '${functionName}' called without await`,
        code: node.text,
        suggestion: isInAsyncFunction
          ? `Add 'await' before '${functionName}()'`
          : `Either add 'await' (and make containing function async) or handle the promise with .then()/.catch()`,
        confidence,
        context: {
          functionName,
          inTryCatch: this.isInsideTryCatch(node),
        },
      });
    });

    return issues;
  }

  /**
   * Detect unhandled promise rejections
   */
  private detectUnhandledRejections(
    rootNode: Parser.SyntaxNode,
    filePath: string
  ): AsyncPatternIssue[] {
    const issues: AsyncPatternIssue[] = [];

    this.traverseAST(rootNode, (node) => {
      // Look for Promise.reject() or new Promise() without catch
      if (node.type === 'call_expression') {
        const callee = node.childForFieldName('function');
        if (!callee) return;

        // Check for Promise.reject()
        if (callee.type === 'member_expression') {
          const object = callee.childForFieldName('object');
          const property = callee.childForFieldName('property');

          if (object?.text === 'Promise' && property?.text === 'reject') {
            // Check if the rejection is handled
            if (!this.isPartOfPromiseChain(node) && !this.isReturned(node) && !this.isAwaited(node)) {
              issues.push({
                type: 'unhandled-rejection',
                location: this.nodeToLocation(node, filePath),
                message: 'Promise.reject() without error handling',
                code: node.text,
                suggestion: 'Add .catch() handler or wrap in try-catch with await',
                confidence: 0.85,
              });
            }
          }
        }
      }

      // Look for throw inside async functions without try-catch
      if (node.type === 'throw_statement') {
        const containingFunction = this.findContainingFunction(node);
        if (containingFunction && this.isFunctionAsync(containingFunction)) {
          if (!this.isInsideTryCatch(node)) {
            // Check if the caller handles the rejection
            issues.push({
              type: 'unhandled-rejection',
              location: this.nodeToLocation(node, filePath),
              message: 'Throw in async function may result in unhandled rejection',
              code: node.text,
              suggestion: 'Ensure callers handle the potential rejection with .catch() or try-catch',
              confidence: 0.6,
              context: {
                inTryCatch: false,
              },
            });
          }
        }
      }
    });

    return issues;
  }

  /**
   * Detect floating promises (promises without await or .catch)
   */
  private detectFloatingPromises(
    rootNode: Parser.SyntaxNode,
    asyncContext: AsyncContext,
    filePath: string
  ): AsyncPatternIssue[] {
    const issues: AsyncPatternIssue[] = [];

    this.traverseAST(rootNode, (node) => {
      // Look for expression statements containing async calls
      if (node.type !== 'expression_statement') return;

      const expression = node.firstChild;
      if (!expression) return;

      // Check if it's a call expression
      if (expression.type !== 'call_expression') return;

      // Skip if it's part of a promise chain
      if (this.isPartOfPromiseChain(expression)) return;

      // Check if the call is async
      const functionName = this.getCallFunctionName(expression);
      const isLikelyAsync = this.isLikelyAsyncCall(functionName, asyncContext);

      if (!isLikelyAsync) return;

      // This is a floating promise - async call as standalone statement
      let confidence = 0.75;
      if (asyncContext.declaredAsyncFunctions.has(functionName)) {
        confidence = 0.9;
      }

      issues.push({
        type: 'floating-promise',
        location: this.nodeToLocation(node, filePath),
        message: `Promise from '${functionName}()' is not awaited or handled`,
        code: node.text,
        suggestion: `Add 'await', assign to variable, or add '.catch()' to handle errors`,
        confidence,
        context: {
          functionName,
        },
      });
    });

    return issues;
  }

  /**
   * Detect async operations inside loops (sequential instead of parallel)
   */
  private detectAsyncInLoops(
    rootNode: Parser.SyntaxNode,
    _asyncContext: AsyncContext,
    filePath: string
  ): AsyncPatternIssue[] {
    const issues: AsyncPatternIssue[] = [];

    this.traverseAST(rootNode, (node) => {
      // Look for loops
      if (!LOOP_TYPES.has(node.type)) return;

      // Check for await expressions inside the loop
      const awaitsInLoop: Parser.SyntaxNode[] = [];
      this.traverseAST(node, (child) => {
        if (child.type === 'await_expression') {
          awaitsInLoop.push(child);
        }
      });

      if (awaitsInLoop.length === 0) return;

      // Check if the awaits are independent (could be parallelized)
      for (const awaitNode of awaitsInLoop) {
        // Skip if the await uses loop variable in a dependent way
        // (simplified check - could be more sophisticated)
        const loopVariable = this.getLoopVariable(node);
        const awaitCode = awaitNode.text;

        // If the await clearly depends on previous iteration, skip
        if (this.awaitDependsOnPreviousIteration(awaitNode, node)) {
          continue;
        }

        const loopType = this.getLoopTypeName(node.type);
        let confidence = 0.7;

        // Higher confidence if it's a for-of loop (common pattern for parallel ops)
        if (node.type === 'for_of_statement') {
          confidence = 0.85;
        }

        // Lower confidence if loop variable is used in the await
        if (loopVariable && awaitCode.includes(loopVariable)) {
          confidence *= 0.9;
        }

        issues.push({
          type: 'async-in-loop',
          location: this.nodeToLocation(awaitNode, filePath),
          message: `Await inside ${loopType} executes sequentially`,
          code: awaitNode.text,
          suggestion: `Consider using Promise.all() for parallel execution, or add comment if sequential is intentional`,
          confidence,
          context: {
            loopType,
          },
        });
      }
    });

    return issues;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Build context about async functions declared in the file
   */
  private buildAsyncContext(rootNode: Parser.SyntaxNode): AsyncContext {
    const ctx: AsyncContext = {
      declaredAsyncFunctions: new Set(),
      promiseReturningFunctions: new Set(),
    };

    this.traverseAST(rootNode, (node) => {
      // Find async function declarations
      if (
        node.type === 'function_declaration' ||
        node.type === 'function_expression' ||
        node.type === 'arrow_function' ||
        node.type === 'method_definition'
      ) {
        if (this.isFunctionAsync(node)) {
          const name = this.getFunctionName(node);
          if (name) {
            ctx.declaredAsyncFunctions.add(name);
          }
        }
      }

      // Find functions that return promises (heuristic)
      if (node.type === 'return_statement') {
        const returnValue = node.firstNamedChild;
        if (returnValue?.type === 'new_expression') {
          const constructor = returnValue.childForFieldName('constructor');
          if (constructor?.text === 'Promise') {
            const fn = this.findContainingFunction(node);
            if (fn) {
              const name = this.getFunctionName(fn);
              if (name) {
                ctx.promiseReturningFunctions.add(name);
              }
            }
          }
        }
      }
    });

    // Add known async functions from config
    for (const fn of this.config.knownAsyncFunctions) {
      ctx.declaredAsyncFunctions.add(fn);
    }

    return ctx;
  }

  /**
   * Check if a node is inside an await expression
   */
  private isAwaited(node: Parser.SyntaxNode): boolean {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'await_expression') {
        return true;
      }
      // Stop at statement boundary
      if (parent.type.endsWith('_statement') || parent.type.endsWith('_declaration')) {
        break;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Check if a node is part of a promise chain (.then/.catch/.finally)
   */
  private isPartOfPromiseChain(node: Parser.SyntaxNode): boolean {
    let current: Parser.SyntaxNode | null = node;
    while (current) {
      // Check if this is the object of a member expression
      if (current.parent?.type === 'member_expression') {
        const property = current.parent.childForFieldName('property');
        if (property && PROMISE_METHODS.has(property.text)) {
          return true;
        }
      }
      // Check if parent is a call expression with .then/.catch
      if (current.parent?.type === 'call_expression') {
        const callee = current.parent.childForFieldName('function');
        if (callee?.type === 'member_expression') {
          const property = callee.childForFieldName('property');
          if (property && (property.text === 'then' || property.text === 'catch' || property.text === 'finally')) {
            return true;
          }
        }
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if a node is returned
   */
  private isReturned(node: Parser.SyntaxNode): boolean {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'return_statement') {
        return true;
      }
      // Arrow function implicit return
      if (parent.type === 'arrow_function' && node === parent.lastChild) {
        return true;
      }
      // Stop at function boundary
      if (this.isFunctionNode(parent)) {
        break;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Check if inside try-catch
   */
  private isInsideTryCatch(node: Parser.SyntaxNode): boolean {
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'try_statement') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Get the function name from a call expression
   */
  private getCallFunctionName(node: Parser.SyntaxNode): string {
    const callee = node.childForFieldName('function');
    if (!callee) return 'unknown';

    if (callee.type === 'identifier') {
      return callee.text;
    }

    if (callee.type === 'member_expression') {
      const property = callee.childForFieldName('property');
      return property?.text ?? 'unknown';
    }

    return 'unknown';
  }

  /**
   * Check if a function call is likely async
   */
  private isLikelyAsyncCall(functionName: string, context: AsyncContext): boolean {
    // Check declared async functions
    if (context.declaredAsyncFunctions.has(functionName)) {
      return true;
    }

    // Check promise-returning functions
    if (context.promiseReturningFunctions.has(functionName)) {
      return true;
    }

    // Check patterns
    return this.matchesAsyncPattern(functionName);
  }

  /**
   * Check if function name matches async patterns
   */
  private matchesAsyncPattern(name: string): boolean {
    return ASYNC_PATTERNS.some((pattern) => pattern.test(name));
  }

  /**
   * Find the containing function of a node
   */
  private findContainingFunction(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let parent = node.parent;
    while (parent) {
      if (this.isFunctionNode(parent)) {
        return parent;
      }
      parent = parent.parent;
    }
    return null;
  }

  /**
   * Check if a node is a function
   */
  private isFunctionNode(node: Parser.SyntaxNode): boolean {
    return (
      node.type === 'function_declaration' ||
      node.type === 'function_expression' ||
      node.type === 'arrow_function' ||
      node.type === 'method_definition'
    );
  }

  /**
   * Check if a function is async
   */
  private isFunctionAsync(node: Parser.SyntaxNode): boolean {
    // Check for async keyword
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'async') {
        return true;
      }
    }

    // Check text for async keyword
    return node.text.trimStart().startsWith('async ') ||
           node.text.trimStart().startsWith('async(');
  }

  /**
   * Get function name
   */
  private getFunctionName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    // For method definitions
    if (node.type === 'method_definition') {
      const name = node.childForFieldName('name');
      return name?.text ?? null;
    }

    // For variable declarations with function expressions
    if (node.parent?.type === 'variable_declarator') {
      const name = node.parent.childForFieldName('name');
      return name?.text ?? null;
    }

    return null;
  }

  /**
   * Get loop variable name
   */
  private getLoopVariable(loopNode: Parser.SyntaxNode): string | null {
    if (loopNode.type === 'for_of_statement' || loopNode.type === 'for_in_statement') {
      const left = loopNode.childForFieldName('left');
      if (left?.type === 'identifier') {
        return left.text;
      }
      if (left?.type === 'variable_declaration') {
        const declarator = left.firstNamedChild;
        const name = declarator?.childForFieldName('name');
        return name?.text ?? null;
      }
    }

    if (loopNode.type === 'for_statement') {
      const init = loopNode.childForFieldName('initializer');
      if (init?.type === 'variable_declaration') {
        const declarator = init.firstNamedChild;
        const name = declarator?.childForFieldName('name');
        return name?.text ?? null;
      }
    }

    return null;
  }

  /**
   * Check if await depends on previous iteration
   */
  private awaitDependsOnPreviousIteration(
    awaitNode: Parser.SyntaxNode,
    _loopNode: Parser.SyntaxNode
  ): boolean {
    // Simple heuristic: check for accumulator patterns
    const awaitCode = awaitNode.text;

    // Patterns that suggest dependency on previous iteration
    const dependencyPatterns = [
      /result\s*[+=]/,
      /total\s*[+=]/,
      /acc\s*[+=]/,
      /\.push\(/,
      /\[\s*i\s*-\s*1\s*\]/,
      /previous/i,
      /last/i,
    ];

    return dependencyPatterns.some((pattern) => pattern.test(awaitCode));
  }

  /**
   * Get human-readable loop type name
   */
  private getLoopTypeName(type: string): string {
    switch (type) {
      case 'for_statement':
        return 'for loop';
      case 'for_in_statement':
        return 'for-in loop';
      case 'for_of_statement':
        return 'for-of loop';
      case 'while_statement':
        return 'while loop';
      case 'do_statement':
        return 'do-while loop';
      default:
        return 'loop';
    }
  }

  /**
   * Convert node to source location
   */
  private nodeToLocation(node: Parser.SyntaxNode, filePath: string): SourceLocation {
    return {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * Traverse AST
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

  // ===========================================================================
  // Parser Methods
  // ===========================================================================

  /**
   * Parse code to AST
   */
  private async parseCode(
    code: string,
    language: 'javascript' | 'typescript'
  ): Promise<Parser.Tree | null> {
    if (!this.parser) {
      await this.initializeParser(language);
    }

    if (!this.parser) {
      return null;
    }

    try {
      return this.parser.parse(code);
    } catch {
      return null;
    }
  }

  /**
   * Initialize parser for language
   */
  private async initializeParser(language: 'javascript' | 'typescript'): Promise<void> {
    try {
      this.parser = new Parser();

      if (language === 'typescript') {
        const tsModule = await import('tree-sitter-typescript');
        this.languageModule = tsModule.default?.typescript ?? tsModule.typescript;
      } else {
        const jsModule = await import('tree-sitter-javascript');
        this.languageModule = jsModule.default ?? jsModule;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.parser.setLanguage(this.languageModule as any);
    } catch {
      this.parser = null;
    }
  }
}

// =============================================================================
// Types (Internal)
// =============================================================================

interface AsyncContext {
  declaredAsyncFunctions: Set<string>;
  promiseReturningFunctions: Set<string>;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new AsyncPatternDetector instance
 */
export function createAsyncPatternDetector(
  config?: AsyncPatternConfig
): AsyncPatternDetector {
  return new AsyncPatternDetector(config);
}

/**
 * Quick detection function for simple use cases
 */
export async function detectAsyncPatterns(
  code: string,
  filePath?: string,
  language?: 'javascript' | 'typescript'
): Promise<AsyncPatternIssue[]> {
  const detector = createAsyncPatternDetector();
  const result = await detector.detect(code, filePath, language);
  return result.issues;
}
