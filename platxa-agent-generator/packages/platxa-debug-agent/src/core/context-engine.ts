/**
 * Context Gathering Engine
 *
 * Provides file reading, AST parsing, and context extraction capabilities
 * for the debugging agent. Uses tree-sitter for multi-language AST parsing.
 *
 * @module context-engine
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, isAbsolute, join, resolve } from 'path';
import Parser from 'tree-sitter';
import type { Language, SourceLocation } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a node in the AST with relevant metadata
 */
export interface ASTNode {
  /** Node type (e.g., "function_definition", "class_declaration") */
  type: string;
  /** Node text content */
  text: string;
  /** Start position */
  startPosition: { row: number; column: number };
  /** End position */
  endPosition: { row: number; column: number };
  /** Child nodes */
  children: ASTNode[];
  /** Named children only */
  namedChildren: ASTNode[];
  /** Parent node type (if available) */
  parentType?: string;
  /** Field name in parent (if applicable) */
  fieldName?: string;
}

/**
 * Information about a code symbol (function, class, variable)
 */
export interface SymbolInfo {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: 'function' | 'class' | 'method' | 'variable' | 'constant' | 'parameter' | 'import' | 'export' | 'type' | 'interface';
  /** Source location */
  location: SourceLocation;
  /** Full text of the symbol definition */
  definition: string;
  /** Documentation/comments if available */
  documentation?: string;
  /** Scope containing this symbol */
  scope?: string;
  /** Type annotation if available */
  typeAnnotation?: string;
  /** Visibility modifier */
  visibility?: 'public' | 'private' | 'protected';
  /** Whether this is async (for functions) */
  isAsync?: boolean;
  /** Whether this is static (for methods) */
  isStatic?: boolean;
  /** Parameters (for functions/methods) */
  parameters?: ParameterInfo[];
  /** Return type (for functions/methods) */
  returnType?: string;
}

/**
 * Information about a function parameter
 */
export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Type annotation if available */
  type?: string;
  /** Default value if available */
  defaultValue?: string;
  /** Whether this is a rest/spread parameter */
  isRest?: boolean;
}

/**
 * Information about an import statement
 */
export interface ImportInfo {
  /** Module/package being imported */
  source: string;
  /** Imported names (or null for namespace import) */
  imports: ImportedName[];
  /** Whether this is a default import */
  isDefault: boolean;
  /** Whether this is a namespace import (import * as X) */
  isNamespace: boolean;
  /** Source location */
  location: SourceLocation;
  /** Raw import statement */
  raw: string;
}

/**
 * An imported name with optional alias
 */
export interface ImportedName {
  /** Original name in the module */
  name: string;
  /** Local alias (if different) */
  alias?: string;
}

/**
 * Code context extracted around a location
 */
export interface CodeContext {
  /** The file path */
  file: string;
  /** Language of the file */
  language: Language;
  /** Lines of code with line numbers */
  lines: { lineNumber: number; content: string }[];
  /** The target line number (center of context) */
  targetLine: number;
  /** Enclosing function/method if any */
  enclosingFunction?: SymbolInfo;
  /** Enclosing class if any */
  enclosingClass?: SymbolInfo;
  /** Symbols defined in this context */
  localSymbols: SymbolInfo[];
  /** Imports used in this file */
  imports: ImportInfo[];
}

/**
 * Result of full context extraction for a file
 */
export interface FileContext {
  /** File path */
  file: string;
  /** Detected language */
  language: Language;
  /** File content */
  content: string;
  /** All symbols in the file */
  symbols: SymbolInfo[];
  /** All imports in the file */
  imports: ImportInfo[];
  /** AST root node (simplified) */
  ast?: ASTNode;
  /** Parse errors if any */
  parseErrors: string[];
}

/**
 * Options for context extraction
 */
export interface ContextExtractionOptions {
  /** Number of lines before target to include */
  linesBefore?: number;
  /** Number of lines after target to include */
  linesAfter?: number;
  /** Include full AST */
  includeAST?: boolean;
  /** Include documentation comments */
  includeDocumentation?: boolean;
  /** Maximum depth for AST traversal */
  maxASTDepth?: number;
}

// =============================================================================
// Language Parser Configuration
// =============================================================================

/**
 * Language parser registry
 */
interface LanguageParserConfig {
  /** Tree-sitter language module */
  parserModule: string;
  /** Node types for functions */
  functionTypes: string[];
  /** Node types for classes */
  classTypes: string[];
  /** Node types for methods */
  methodTypes: string[];
  /** Node types for variables */
  variableTypes: string[];
  /** Node types for imports */
  importTypes: string[];
  /** Node types for exports */
  exportTypes: string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageParserConfig> = {
  python: {
    parserModule: 'tree-sitter-python',
    functionTypes: ['function_definition'],
    classTypes: ['class_definition'],
    methodTypes: ['function_definition'], // Methods are functions inside classes
    variableTypes: ['assignment', 'augmented_assignment'],
    importTypes: ['import_statement', 'import_from_statement'],
    exportTypes: [],
  },
  javascript: {
    parserModule: 'tree-sitter-javascript',
    functionTypes: ['function_declaration', 'arrow_function', 'function_expression', 'generator_function_declaration'],
    classTypes: ['class_declaration', 'class'],
    methodTypes: ['method_definition'],
    variableTypes: ['variable_declaration', 'lexical_declaration'],
    importTypes: ['import_statement'],
    exportTypes: ['export_statement'],
  },
  typescript: {
    parserModule: 'tree-sitter-typescript',
    functionTypes: ['function_declaration', 'arrow_function', 'function_expression', 'generator_function_declaration'],
    classTypes: ['class_declaration', 'class'],
    methodTypes: ['method_definition', 'public_field_definition'],
    variableTypes: ['variable_declaration', 'lexical_declaration'],
    importTypes: ['import_statement'],
    exportTypes: ['export_statement'],
  },
  css: {
    parserModule: 'tree-sitter-css',
    functionTypes: [],
    classTypes: ['rule_set'],
    methodTypes: [],
    variableTypes: ['declaration'],
    importTypes: ['import_statement', 'at_rule'],
    exportTypes: [],
  },
};

// =============================================================================
// Context Engine Implementation
// =============================================================================

/**
 * Context Gathering Engine for file reading and AST-based context extraction.
 *
 * Provides capabilities to:
 * - Read files from disk with caching
 * - Parse source code to AST using tree-sitter
 * - Extract symbols (functions, classes, variables)
 * - Get code context around specific locations
 * - Analyze imports and dependencies
 */
export class ContextEngine {
  /** File content cache */
  private readonly fileCache: Map<string, string> = new Map();

  /** Parsed AST cache */
  private readonly astCache: Map<string, Parser.Tree> = new Map();

  /** Parser instances by language */
  private readonly parsers: Map<string, Parser> = new Map();

  /** Project root directory */
  private readonly projectRoot: string;

  /** Default context extraction options */
  private readonly defaultOptions: Required<ContextExtractionOptions>;

  constructor(
    projectRoot: string = process.cwd(),
    options: Partial<ContextExtractionOptions> = {}
  ) {
    this.projectRoot = resolve(projectRoot);
    this.defaultOptions = {
      linesBefore: 10,
      linesAfter: 10,
      includeAST: false,
      includeDocumentation: true,
      maxASTDepth: 10,
      ...options,
    };
  }

  // ===========================================================================
  // File Reading
  // ===========================================================================

  /**
   * Read a file from disk with caching.
   *
   * @param filePath - Path to the file (absolute or relative to project root)
   * @returns File content
   * @throws Error if file doesn't exist or can't be read
   */
  async readFile(filePath: string): Promise<string> {
    const absolutePath = this.resolvePath(filePath);

    // Check cache first
    const cached = this.fileCache.get(absolutePath);
    if (cached !== undefined) {
      return cached;
    }

    // Check file exists
    if (!existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Read file
    const content = await readFile(absolutePath, 'utf-8');
    this.fileCache.set(absolutePath, content);
    return content;
  }

  /**
   * Read multiple files in parallel.
   *
   * @param filePaths - Array of file paths
   * @returns Map of file path to content
   */
  async readFiles(filePaths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const readPromises = filePaths.map(async (path) => {
      try {
        const content = await this.readFile(path);
        results.set(path, content);
      } catch {
        // Skip files that can't be read
      }
    });

    await Promise.all(readPromises);
    return results;
  }

  /**
   * Clear the file cache.
   *
   * @param filePath - Optional specific file to clear, or all if not provided
   */
  clearCache(filePath?: string): void {
    if (filePath !== undefined) {
      const absolutePath = this.resolvePath(filePath);
      this.fileCache.delete(absolutePath);
      this.astCache.delete(absolutePath);
    } else {
      this.fileCache.clear();
      this.astCache.clear();
    }
  }

  // ===========================================================================
  // AST Parsing
  // ===========================================================================

  /**
   * Parse source code to AST using tree-sitter.
   *
   * @param content - Source code content
   * @param language - Programming language
   * @returns Parsed AST tree
   */
  async parseToAST(content: string, language: Language): Promise<Parser.Tree | null> {
    const parser = await this.getParser(language);
    if (parser === null) {
      return null;
    }

    try {
      return parser.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse a file to AST with caching.
   *
   * @param filePath - Path to the file
   * @param language - Optional language override
   * @returns Parsed AST tree
   */
  async parseFile(filePath: string, language?: Language): Promise<Parser.Tree | null> {
    const absolutePath = this.resolvePath(filePath);

    // Check AST cache
    const cached = this.astCache.get(absolutePath);
    if (cached !== undefined) {
      return cached;
    }

    // Read file and detect language
    const content = await this.readFile(absolutePath);
    const lang = language ?? this.detectLanguage(absolutePath);

    // Parse to AST
    const tree = await this.parseToAST(content, lang);
    if (tree !== null) {
      this.astCache.set(absolutePath, tree);
    }

    return tree;
  }

  /**
   * Convert tree-sitter node to simplified ASTNode.
   *
   * @param node - Tree-sitter syntax node
   * @param depth - Current depth (for limiting)
   * @param maxDepth - Maximum depth to traverse
   * @returns Simplified AST node
   */
  private convertToASTNode(
    node: Parser.SyntaxNode,
    depth: number = 0,
    maxDepth: number = 10
  ): ASTNode {
    const children: ASTNode[] = [];
    const namedChildren: ASTNode[] = [];

    if (depth < maxDepth) {
      for (const child of node.children) {
        const childNode = this.convertToASTNode(child, depth + 1, maxDepth);
        children.push(childNode);
        if (child.isNamed) {
          namedChildren.push(childNode);
        }
      }
    }

    const astNode: ASTNode = {
      type: node.type,
      text: node.text,
      startPosition: { row: node.startPosition.row, column: node.startPosition.column },
      endPosition: { row: node.endPosition.row, column: node.endPosition.column },
      children,
      namedChildren,
    };

    if (node.parent !== null) {
      astNode.parentType = node.parent.type;
    }

    return astNode;
  }

  // ===========================================================================
  // Context Extraction
  // ===========================================================================

  /**
   * Extract full context for a file.
   *
   * @param filePath - Path to the file
   * @param options - Extraction options
   * @returns File context with symbols and imports
   */
  async extractFileContext(
    filePath: string,
    options: ContextExtractionOptions = {}
  ): Promise<FileContext> {
    const opts = { ...this.defaultOptions, ...options };
    const absolutePath = this.resolvePath(filePath);
    const language = this.detectLanguage(absolutePath);

    const result: FileContext = {
      file: absolutePath,
      language,
      content: '',
      symbols: [],
      imports: [],
      parseErrors: [],
    };

    try {
      result.content = await this.readFile(absolutePath);
    } catch (error) {
      result.parseErrors.push(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }

    // Parse to AST
    const tree = await this.parseToAST(result.content, language);
    if (tree === null) {
      result.parseErrors.push(`Failed to parse file as ${language}`);
      return result;
    }

    // Include AST if requested
    if (opts.includeAST) {
      result.ast = this.convertToASTNode(tree.rootNode, 0, opts.maxASTDepth);
    }

    // Extract symbols
    result.symbols = this.extractSymbols(tree.rootNode, language, result.content);

    // Extract imports
    result.imports = this.extractImports(tree.rootNode, language, result.content);

    return result;
  }

  /**
   * Extract code context around a specific location.
   *
   * @param filePath - Path to the file
   * @param location - Source location to center context around
   * @param options - Extraction options
   * @returns Code context with surrounding lines and enclosing scope
   */
  async extractContextAtLocation(
    filePath: string,
    location: SourceLocation,
    options: ContextExtractionOptions = {}
  ): Promise<CodeContext> {
    const opts = { ...this.defaultOptions, ...options };
    const absolutePath = this.resolvePath(filePath);
    const language = this.detectLanguage(absolutePath);

    const result: CodeContext = {
      file: absolutePath,
      language,
      lines: [],
      targetLine: location.line,
      localSymbols: [],
      imports: [],
    };

    let content: string;
    try {
      content = await this.readFile(absolutePath);
    } catch {
      return result;
    }

    const lines = content.split('\n');

    // Extract surrounding lines
    const startLine = Math.max(0, location.line - 1 - opts.linesBefore);
    const endLine = Math.min(lines.length - 1, location.line - 1 + opts.linesAfter);

    for (let i = startLine; i <= endLine; i++) {
      const lineContent = lines[i];
      if (lineContent !== undefined) {
        result.lines.push({
          lineNumber: i + 1,
          content: lineContent,
        });
      }
    }

    // Parse AST to find enclosing scopes
    const tree = await this.parseToAST(content, language);
    if (tree !== null) {
      // Find enclosing function and class
      const enclosing = this.findEnclosingScope(tree.rootNode, location, language, content);
      if (enclosing.function !== undefined) {
        result.enclosingFunction = enclosing.function;
      }
      if (enclosing.class !== undefined) {
        result.enclosingClass = enclosing.class;
      }

      // Extract local symbols in the enclosing scope
      if (enclosing.scopeNode !== null) {
        result.localSymbols = this.extractSymbols(enclosing.scopeNode, language, content);
      }

      // Extract imports
      result.imports = this.extractImports(tree.rootNode, language, content);
    }

    return result;
  }

  /**
   * Find a symbol by name across files.
   *
   * @param name - Symbol name to find
   * @param files - Files to search in
   * @returns Found symbol info or null
   */
  async findSymbol(name: string, files: string[]): Promise<SymbolInfo | null> {
    for (const file of files) {
      try {
        const context = await this.extractFileContext(file);
        const symbol = context.symbols.find((s) => s.name === name);
        if (symbol !== undefined) {
          return symbol;
        }
      } catch {
        // Continue searching other files
      }
    }
    return null;
  }

  /**
   * Get all references to a symbol across files.
   *
   * @param symbolName - Name of the symbol
   * @param files - Files to search in
   * @returns Array of source locations where the symbol is referenced
   */
  async findReferences(symbolName: string, files: string[]): Promise<SourceLocation[]> {
    const references: SourceLocation[] = [];

    for (const file of files) {
      try {
        const content = await this.readFile(file);
        const absolutePath = this.resolvePath(file);
        const lines = content.split('\n');

        // Simple pattern matching for references
        const pattern = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line !== undefined) {
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(line)) !== null) {
              references.push({
                file: absolutePath,
                line: i + 1,
                column: match.index + 1,
              });
            }
          }
        }
      } catch {
        // Continue with other files
      }
    }

    return references;
  }

  // ===========================================================================
  // Symbol Extraction
  // ===========================================================================

  /**
   * Extract symbols from an AST node.
   */
  private extractSymbols(
    node: Parser.SyntaxNode,
    language: Language,
    content: string
  ): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const config = LANGUAGE_CONFIGS[language];

    if (config === undefined) {
      return symbols;
    }

    this.traverseAST(node, (currentNode) => {
      // Functions
      if (config.functionTypes.includes(currentNode.type)) {
        const symbol = this.extractFunctionSymbol(currentNode, language, content);
        if (symbol !== null) {
          symbols.push(symbol);
        }
      }

      // Classes
      if (config.classTypes.includes(currentNode.type)) {
        const symbol = this.extractClassSymbol(currentNode, language, content);
        if (symbol !== null) {
          symbols.push(symbol);
        }
      }

      // Variables
      if (config.variableTypes.includes(currentNode.type)) {
        const varSymbols = this.extractVariableSymbols(currentNode, language, content);
        symbols.push(...varSymbols);
      }
    });

    return symbols;
  }

  /**
   * Extract a function symbol from an AST node.
   */
  private extractFunctionSymbol(
    node: Parser.SyntaxNode,
    language: Language,
    content: string
  ): SymbolInfo | null {
    let name: string | undefined;
    let isAsync = false;
    const parameters: ParameterInfo[] = [];
    let returnType: string | undefined;
    let documentation: string | undefined;

    // Find name node
    const nameNode = node.childForFieldName('name');
    if (nameNode !== null) {
      name = nameNode.text;
    }

    // Check for async
    if (language === 'python') {
      isAsync = node.text.startsWith('async ');
    } else {
      const asyncChild = node.children.find((c) => c.type === 'async');
      isAsync = asyncChild !== undefined;
    }

    // Extract parameters
    const paramsNode = node.childForFieldName('parameters');
    if (paramsNode !== null) {
      for (const paramNode of paramsNode.namedChildren) {
        const paramInfo = this.extractParameterInfo(paramNode, language);
        if (paramInfo !== null) {
          parameters.push(paramInfo);
        }
      }
    }

    // Extract return type (TypeScript/Python)
    const returnTypeNode = node.childForFieldName('return_type');
    if (returnTypeNode !== null) {
      returnType = returnTypeNode.text;
    }

    // Extract documentation comment
    if (this.defaultOptions.includeDocumentation) {
      documentation = this.extractDocumentation(node, content);
    }

    if (name === undefined) {
      return null;
    }

    // Determine if this is a method
    const isMethod = node.parent !== null &&
      (node.parent.type === 'class_body' || node.parent.type === 'block');

    const symbol: SymbolInfo = {
      name,
      kind: isMethod ? 'method' : 'function',
      location: {
        file: '',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column + 1,
      },
      definition: node.text,
      parameters,
    };

    if (isAsync) {
      symbol.isAsync = isAsync;
    }
    if (returnType !== undefined) {
      symbol.returnType = returnType;
    }
    if (documentation !== undefined) {
      symbol.documentation = documentation;
    }

    return symbol;
  }

  /**
   * Extract a class symbol from an AST node.
   */
  private extractClassSymbol(
    node: Parser.SyntaxNode,
    _language: Language,
    content: string
  ): SymbolInfo | null {
    let name: string | undefined;
    let documentation: string | undefined;

    // Find name node
    const nameNode = node.childForFieldName('name');
    if (nameNode !== null) {
      name = nameNode.text;
    }

    // Extract documentation
    if (this.defaultOptions.includeDocumentation) {
      documentation = this.extractDocumentation(node, content);
    }

    if (name === undefined) {
      return null;
    }

    const symbol: SymbolInfo = {
      name,
      kind: 'class',
      location: {
        file: '',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column + 1,
      },
      definition: node.text,
    };

    if (documentation !== undefined) {
      symbol.documentation = documentation;
    }

    return symbol;
  }

  /**
   * Extract variable symbols from an AST node.
   */
  private extractVariableSymbols(
    node: Parser.SyntaxNode,
    language: Language,
    _content: string
  ): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    if (language === 'python') {
      // Python assignment
      const leftNode = node.childForFieldName('left');
      if (leftNode !== null && leftNode.type === 'identifier') {
        symbols.push({
          name: leftNode.text,
          kind: 'variable',
          location: {
            file: '',
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
          },
          definition: node.text,
        });
      }
    } else {
      // JavaScript/TypeScript variable declaration
      for (const declarator of node.namedChildren) {
        if (declarator.type === 'variable_declarator') {
          const nameNode = declarator.childForFieldName('name');
          if (nameNode !== null) {
            const isConst = node.text.startsWith('const');
            symbols.push({
              name: nameNode.text,
              kind: isConst ? 'constant' : 'variable',
              location: {
                file: '',
                line: declarator.startPosition.row + 1,
                column: declarator.startPosition.column + 1,
              },
              definition: node.text,
            });
          }
        }
      }
    }

    return symbols;
  }

  /**
   * Extract parameter info from a parameter node.
   */
  private extractParameterInfo(
    node: Parser.SyntaxNode,
    _language: Language
  ): ParameterInfo | null {
    const info: ParameterInfo = {
      name: '',
    };

    // Handle different parameter types
    if (node.type === 'identifier') {
      info.name = node.text;
    } else if (node.type === 'typed_parameter' || node.type === 'required_parameter') {
      const nameNode = node.childForFieldName('name') ?? node.namedChildren[0];
      if (nameNode !== null && nameNode !== undefined) {
        info.name = nameNode.text;
      }
      const typeNode = node.childForFieldName('type');
      if (typeNode !== null) {
        info.type = typeNode.text;
      }
    } else if (node.type === 'default_parameter' || node.type === 'optional_parameter') {
      const nameNode = node.childForFieldName('name') ?? node.namedChildren[0];
      if (nameNode !== null && nameNode !== undefined) {
        info.name = nameNode.text;
      }
      const valueNode = node.childForFieldName('value');
      if (valueNode !== null) {
        info.defaultValue = valueNode.text;
      }
    } else if (node.type === 'rest_pattern' || node.type === 'list_splat_pattern') {
      const nameNode = node.namedChildren[0];
      if (nameNode !== null && nameNode !== undefined) {
        info.name = nameNode.text;
        info.isRest = true;
      }
    }

    return info.name !== '' ? info : null;
  }

  // ===========================================================================
  // Import Extraction
  // ===========================================================================

  /**
   * Extract imports from an AST.
   */
  private extractImports(
    node: Parser.SyntaxNode,
    language: Language,
    _content: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const config = LANGUAGE_CONFIGS[language];

    if (config === undefined) {
      return imports;
    }

    this.traverseAST(node, (currentNode) => {
      if (config.importTypes.includes(currentNode.type)) {
        const importInfo = this.extractImportInfo(currentNode, language);
        if (importInfo !== null) {
          imports.push(importInfo);
        }
      }
    });

    return imports;
  }

  /**
   * Extract import info from an import node.
   */
  private extractImportInfo(
    node: Parser.SyntaxNode,
    language: Language
  ): ImportInfo | null {
    const info: ImportInfo = {
      source: '',
      imports: [],
      isDefault: false,
      isNamespace: false,
      location: {
        file: '',
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      },
      raw: node.text,
    };

    if (language === 'python') {
      return this.extractPythonImport(node, info);
    } else {
      return this.extractJSImport(node, info);
    }
  }

  /**
   * Extract Python import information.
   */
  private extractPythonImport(
    node: Parser.SyntaxNode,
    info: ImportInfo
  ): ImportInfo | null {
    if (node.type === 'import_statement') {
      // import module or import module as alias
      const moduleNode = node.namedChildren[0];
      if (moduleNode !== undefined) {
        info.source = moduleNode.text;
        info.isNamespace = true;
      }
    } else if (node.type === 'import_from_statement') {
      // from module import name
      const moduleNode = node.childForFieldName('module_name');
      if (moduleNode !== null) {
        info.source = moduleNode.text;
      }

      // Get imported names
      for (const child of node.namedChildren) {
        if (child.type === 'dotted_name' && child !== moduleNode) {
          info.imports.push({ name: child.text });
        } else if (child.type === 'aliased_import') {
          const nameNode = child.namedChildren[0];
          const aliasNode = child.namedChildren[1];
          if (nameNode !== undefined) {
            const imported: ImportedName = { name: nameNode.text };
            if (aliasNode !== undefined) {
              imported.alias = aliasNode.text;
            }
            info.imports.push(imported);
          }
        }
      }
    }

    return info.source !== '' ? info : null;
  }

  /**
   * Extract JavaScript/TypeScript import information.
   */
  private extractJSImport(
    node: Parser.SyntaxNode,
    info: ImportInfo
  ): ImportInfo | null {
    // Find source (module path)
    const sourceNode = node.childForFieldName('source');
    if (sourceNode !== null) {
      // Remove quotes from string
      info.source = sourceNode.text.replace(/^['"`]|['"`]$/g, '');
    }

    // Find import clause
    for (const child of node.namedChildren) {
      if (child.type === 'import_clause') {
        for (const clauseChild of child.namedChildren) {
          if (clauseChild.type === 'identifier') {
            // Default import
            info.isDefault = true;
            info.imports.push({ name: 'default', alias: clauseChild.text });
          } else if (clauseChild.type === 'namespace_import') {
            // import * as X
            info.isNamespace = true;
            const aliasNode = clauseChild.namedChildren[0];
            if (aliasNode !== undefined) {
              info.imports.push({ name: '*', alias: aliasNode.text });
            }
          } else if (clauseChild.type === 'named_imports') {
            // import { a, b as c }
            for (const specifier of clauseChild.namedChildren) {
              if (specifier.type === 'import_specifier') {
                const nameNode = specifier.childForFieldName('name');
                const aliasNode = specifier.childForFieldName('alias');
                if (nameNode !== null) {
                  const imported: ImportedName = { name: nameNode.text };
                  if (aliasNode !== null) {
                    imported.alias = aliasNode.text;
                  }
                  info.imports.push(imported);
                }
              }
            }
          }
        }
      }
    }

    return info.source !== '' ? info : null;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get or create a parser for a language.
   */
  private async getParser(language: Language): Promise<Parser | null> {
    const existing = this.parsers.get(language);
    if (existing !== undefined) {
      return existing;
    }

    const config = LANGUAGE_CONFIGS[language];
    if (config === undefined) {
      return null;
    }

    try {
      const parser = new Parser();
      // Dynamic import of language module
      const languageModule = await import(config.parserModule);
      const lang = languageModule.default ?? languageModule;
      parser.setLanguage(lang);
      this.parsers.set(language, parser);
      return parser;
    } catch {
      return null;
    }
  }

  /**
   * Detect language from file extension.
   */
  private detectLanguage(filePath: string): Language {
    const ext = extname(filePath).toLowerCase();
    const extensionMap: Record<string, Language> = {
      '.py': 'python',
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mts': 'typescript',
      '.cts': 'typescript',
      '.css': 'css',
      '.scss': 'scss',
      '.html': 'html',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
    };
    return extensionMap[ext] ?? 'unknown';
  }

  /**
   * Resolve a file path relative to project root.
   */
  private resolvePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }
    return join(this.projectRoot, filePath);
  }

  /**
   * Traverse AST with a callback.
   */
  private traverseAST(
    node: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode) => void
  ): void {
    callback(node);
    for (const child of node.children) {
      this.traverseAST(child, callback);
    }
  }

  /**
   * Find the enclosing scope (function/class) for a location.
   */
  private findEnclosingScope(
    root: Parser.SyntaxNode,
    location: SourceLocation,
    language: Language,
    content: string
  ): { function?: SymbolInfo; class?: SymbolInfo; scopeNode: Parser.SyntaxNode | null } {
    const config = LANGUAGE_CONFIGS[language];
    if (config === undefined) {
      return { scopeNode: null };
    }

    let enclosingFunction: Parser.SyntaxNode | null = null;
    let enclosingClass: Parser.SyntaxNode | null = null;

    const targetRow = location.line - 1;
    const targetCol = location.column !== undefined ? location.column - 1 : 0;

    // Find smallest enclosing nodes
    this.traverseAST(root, (node) => {
      const containsTarget =
        node.startPosition.row <= targetRow &&
        node.endPosition.row >= targetRow &&
        (node.startPosition.row < targetRow ||
          node.startPosition.column <= targetCol) &&
        (node.endPosition.row > targetRow ||
          node.endPosition.column >= targetCol);

      if (!containsTarget) return;

      if (config.functionTypes.includes(node.type) || config.methodTypes.includes(node.type)) {
        if (enclosingFunction === null ||
            (node.startPosition.row > enclosingFunction.startPosition.row)) {
          enclosingFunction = node;
        }
      }

      if (config.classTypes.includes(node.type)) {
        if (enclosingClass === null ||
            (node.startPosition.row > enclosingClass.startPosition.row)) {
          enclosingClass = node;
        }
      }
    });

    const result: { function?: SymbolInfo; class?: SymbolInfo; scopeNode: Parser.SyntaxNode | null } = {
      scopeNode: enclosingFunction ?? enclosingClass,
    };

    if (enclosingFunction !== null) {
      const funcSymbol = this.extractFunctionSymbol(enclosingFunction, language, content);
      if (funcSymbol !== null) {
        result.function = funcSymbol;
      }
    }

    if (enclosingClass !== null) {
      const classSymbol = this.extractClassSymbol(enclosingClass, language, content);
      if (classSymbol !== null) {
        result.class = classSymbol;
      }
    }

    return result;
  }

  /**
   * Extract documentation comment preceding a node.
   */
  private extractDocumentation(node: Parser.SyntaxNode, content: string): string | undefined {
    // Look for comment node before this node
    const lines = content.split('\n');
    const startLine = node.startPosition.row;

    if (startLine === 0) {
      return undefined;
    }

    // Check preceding lines for comments
    const docLines: string[] = [];
    for (let i = startLine - 1; i >= 0; i--) {
      const line = lines[i];
      if (line === undefined) break;

      const trimmed = line.trim();

      // Check for Python docstring (inside function)
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        // This is a docstring, capture until closing quotes
        let docstring = trimmed;
        if (!trimmed.endsWith('"""') && !trimmed.endsWith("'''") || trimmed.length === 3) {
          // Multi-line docstring - look for end
          for (let j = i + 1; j < startLine; j++) {
            const nextLine = lines[j];
            if (nextLine !== undefined) {
              docstring += '\n' + nextLine;
              if (nextLine.includes('"""') || nextLine.includes("'''")) {
                break;
              }
            }
          }
        }
        return docstring;
      }

      // Check for JSDoc or Python # comment
      if (trimmed.startsWith('/**') || trimmed.startsWith('*') ||
          trimmed.startsWith('//') || trimmed.startsWith('#')) {
        docLines.unshift(trimmed);
      } else if (trimmed === '') {
        // Empty line - stop if we already have some docs
        if (docLines.length > 0) {
          break;
        }
      } else {
        // Non-comment line - stop
        break;
      }
    }

    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  /**
   * Escape special regex characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new ContextEngine instance.
 *
 * @param projectRoot - Project root directory
 * @param options - Context extraction options
 * @returns ContextEngine instance
 */
export function createContextEngine(
  projectRoot?: string,
  options?: ContextExtractionOptions
): ContextEngine {
  return new ContextEngine(projectRoot, options);
}
