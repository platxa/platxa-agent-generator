/**
 * Dependency Graph Builder (Feature #28)
 *
 * Builds and analyzes module dependency graphs for cross-file debugging.
 * Maps imports/exports across a project to understand project structure
 * and identify dependency-related issues.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import type { Language, SourceLocation } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Type of module in the dependency graph.
 */
export type ModuleType =
  | 'source'      // Application source code
  | 'external'    // External package (npm, pip, etc.)
  | 'builtin'     // Built-in/standard library module
  | 'virtual'     // Virtual/synthetic module (webpack, etc.)
  | 'unknown';    // Unknown module type

/**
 * Type of import statement.
 */
export type ImportType =
  | 'static'      // Static import (import x from 'y')
  | 'dynamic'     // Dynamic import (import('y'))
  | 'require'     // CommonJS require (const x = require('y'))
  | 'reexport'    // Re-export (export * from 'y')
  | 'sideEffect'; // Side-effect import (import 'y')

/**
 * Type of export statement.
 */
export type ExportType =
  | 'named'       // Named export (export const x = ...)
  | 'default'     // Default export (export default ...)
  | 'namespace'   // Namespace export (export * as ns from 'y')
  | 'reexport';   // Re-export (export { x } from 'y')

/**
 * Represents a single import in a module.
 */
export interface ModuleImport {
  /** Unique identifier */
  id: string;
  /** The module specifier (what's being imported from) */
  specifier: string;
  /** Resolved absolute path (if resolvable) */
  resolvedPath?: string;
  /** Type of import */
  type: ImportType;
  /** Imported names (empty for side-effect imports) */
  importedNames: ImportedName[];
  /** Source location of the import statement */
  location: SourceLocation;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
}

/**
 * An imported name binding.
 */
export interface ImportedName {
  /** Original exported name */
  name: string;
  /** Local alias (if renamed) */
  alias?: string;
  /** Whether this is a type import */
  isType: boolean;
  /** Whether this is a default import */
  isDefault: boolean;
  /** Whether this is a namespace import (* as ns) */
  isNamespace: boolean;
}

/**
 * Represents a single export from a module.
 */
export interface ModuleExport {
  /** Unique identifier */
  id: string;
  /** Exported name */
  name: string;
  /** Local name (if different from exported name) */
  localName?: string;
  /** Type of export */
  type: ExportType;
  /** Source location of the export */
  location: SourceLocation;
  /** Whether this is a type-only export */
  isTypeOnly: boolean;
  /** Source module (for re-exports) */
  source?: string;
}

/**
 * Represents a module (file) in the dependency graph.
 */
export interface DependencyNode {
  /** Unique identifier */
  id: string;
  /** Absolute file path */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** Module type */
  type: ModuleType;
  /** Detected language */
  language: Language;
  /** All imports in this module */
  imports: ModuleImport[];
  /** All exports from this module */
  exports: ModuleExport[];
  /** Direct dependencies (modules this imports from) */
  dependencies: string[];
  /** Direct dependents (modules that import this) */
  dependents: string[];
  /** Depth from entry points (0 for entry points) */
  depth: number;
  /** Whether this module is an entry point */
  isEntryPoint: boolean;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  lastModified?: number;
}

/**
 * Represents an edge in the dependency graph.
 */
export interface DependencyEdge {
  /** Source module ID */
  source: string;
  /** Target module ID */
  target: string;
  /** Type of dependency */
  type: ImportType;
  /** Imported names */
  importedNames: string[];
  /** Whether this is a circular dependency */
  isCircular: boolean;
  /** Weight (for analysis) */
  weight: number;
}

/**
 * A detected circular dependency.
 */
export interface CircularDependency {
  /** Unique identifier */
  id: string;
  /** Modules in the cycle (in order) */
  cycle: string[];
  /** Length of the cycle */
  length: number;
  /** Entry point of the cycle */
  entryPoint: string;
  /** Severity (longer cycles are more severe) */
  severity: 'low' | 'medium' | 'high';
  /** Suggested resolution */
  suggestion: string;
}

/**
 * Analysis result for unused exports.
 */
export interface UnusedExport {
  /** Module path */
  module: string;
  /** Export name */
  exportName: string;
  /** Export location */
  location: SourceLocation;
  /** Whether it might be externally used */
  mightBeExternal: boolean;
}

/**
 * Analysis result for missing imports.
 */
export interface MissingImport {
  /** Module that has the import */
  module: string;
  /** The import specifier that couldn't be resolved */
  specifier: string;
  /** Import location */
  location: SourceLocation;
  /** Possible resolution suggestions */
  suggestions: string[];
}

/**
 * Complete dependency graph.
 */
export interface DependencyGraph {
  /** Project root path */
  root: string;
  /** All nodes in the graph */
  nodes: Map<string, DependencyNode>;
  /** All edges in the graph */
  edges: DependencyEdge[];
  /** Detected circular dependencies */
  circularDependencies: CircularDependency[];
  /** Entry point modules */
  entryPoints: string[];
  /** External dependencies */
  externalDependencies: Set<string>;
  /** Statistics */
  stats: DependencyGraphStats;
}

/**
 * Statistics about the dependency graph.
 */
export interface DependencyGraphStats {
  /** Total number of modules */
  totalModules: number;
  /** Number of source modules */
  sourceModules: number;
  /** Number of external dependencies */
  externalModules: number;
  /** Total number of edges */
  totalEdges: number;
  /** Number of circular dependencies */
  circularDependencies: number;
  /** Maximum depth */
  maxDepth: number;
  /** Average dependencies per module */
  avgDependencies: number;
  /** Most connected modules */
  mostConnected: { path: string; connections: number }[];
}

/**
 * Configuration for the dependency graph builder.
 */
export interface DependencyGraphConfig {
  /** Project root directory */
  root: string;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Entry points (auto-detected if not specified) */
  entryPoints?: string[];
  /** Whether to resolve external modules */
  resolveExternal?: boolean;
  /** Whether to detect circular dependencies */
  detectCircular?: boolean;
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Custom module resolver */
  resolver?: ModuleResolver;
}

/**
 * Module resolver interface.
 */
export interface ModuleResolver {
  /**
   * Resolve a module specifier to an absolute path.
   *
   * @param specifier - The import specifier
   * @param fromModule - The module making the import
   * @returns Resolved path or undefined if unresolvable
   */
  resolve(specifier: string, fromModule: string): string | undefined;

  /**
   * Check if a specifier refers to an external module.
   *
   * @param specifier - The import specifier
   * @returns True if external
   */
  isExternal(specifier: string): boolean;

  /**
   * Check if a specifier refers to a built-in module.
   *
   * @param specifier - The import specifier
   * @returns True if built-in
   */
  isBuiltin(specifier: string): boolean;
}

// =============================================================================
// Default Module Resolver
// =============================================================================

/**
 * Built-in Node.js modules.
 */
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

/**
 * Python built-in modules.
 */
const PYTHON_BUILTINS = new Set([
  'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
  'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect',
  'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd',
  'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
  'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
  'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
  'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email',
  'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
  'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass',
  'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac',
  'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect',
  'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3', 'linecache',
  'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal', 'math',
  'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc', 'nis',
  'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
  'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform', 'plistlib',
  'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd',
  'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri', 'random', 're', 'readline',
  'reprlib', 'resource', 'rlcompleter', 'runpy', 'sched', 'secrets', 'select',
  'selectors', 'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib',
  'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3', 'ssl', 'stat',
  'statistics', 'string', 'stringprep', 'struct', 'subprocess', 'sunau',
  'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
  'tempfile', 'termios', 'test', 'textwrap', 'threading', 'time', 'timeit',
  'tkinter', 'token', 'tokenize', 'tomllib', 'trace', 'traceback', 'tracemalloc',
  'tty', 'turtle', 'turtledemo', 'types', 'typing', 'unicodedata', 'unittest',
  'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser',
  'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp',
  'zipfile', 'zipimport', 'zlib', 'zoneinfo',
]);

/**
 * Default module resolver implementation.
 */
export class DefaultModuleResolver implements ModuleResolver {
  private readonly _root: string;
  private readonly language: Language;
  private readonly extensions: string[];

  constructor(root: string, language: Language = 'javascript') {
    this._root = root;
    this.language = language;
    this.extensions = this.getExtensions(language);
  }

  /** Get the project root path */
  get root(): string {
    return this._root;
  }

  private getExtensions(language: Language): string[] {
    switch (language) {
      case 'python':
        return ['.py', '.pyi'];
      case 'typescript':
        return ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs'];
      case 'javascript':
        return ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];
      default:
        return ['.js', '.ts', '.jsx', '.tsx'];
    }
  }

  resolve(specifier: string, fromModule: string): string | undefined {
    // Built-in modules don't resolve to paths
    if (this.isBuiltin(specifier)) {
      return undefined;
    }

    // External modules
    if (this.isExternal(specifier)) {
      return undefined;
    }

    // Relative imports
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const fromDir = dirname(fromModule);
      const targetPath = resolve(fromDir, specifier);

      // Try exact path first
      if (this.hasExtension(specifier)) {
        return targetPath;
      }

      // Try with extensions - return best guess with first extension
      if (!this.hasExtension(targetPath)) {
        return targetPath + (this.extensions[0] ?? '.js');
      }

      // Try index file
      return join(targetPath, 'index' + (this.extensions[0] ?? '.js'));
    }

    // Absolute/aliased imports - would need tsconfig/package.json parsing
    return undefined;
  }

  isExternal(specifier: string): boolean {
    // Built-ins are not external (they're a separate category)
    if (this.isBuiltin(specifier)) {
      return false;
    }

    // Relative paths are not external
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      return false;
    }

    // Everything else is considered external
    return true;
  }

  isBuiltin(specifier: string): boolean {
    // Handle node: prefix
    const normalized = specifier.startsWith('node:')
      ? specifier.slice(5)
      : specifier;

    // Get base module name (handle subpaths like 'fs/promises')
    const baseName = normalized.split('/')[0] ?? normalized;

    if (this.language === 'python') {
      return PYTHON_BUILTINS.has(baseName);
    }

    return NODE_BUILTINS.has(baseName);
  }

  private hasExtension(path: string): boolean {
    const ext = extname(path);
    return ext.length > 0 && this.extensions.includes(ext);
  }
}

// =============================================================================
// Import/Export Parser
// =============================================================================

/**
 * Parse result from analyzing a source file.
 */
interface ParseResult {
  imports: ModuleImport[];
  exports: ModuleExport[];
  language: Language;
}

/**
 * Parse imports and exports from source code.
 *
 * @param source - Source code content
 * @param filePath - File path for language detection
 * @returns Parsed imports and exports
 */
function parseSourceFile(source: string, filePath: string): ParseResult {
  const ext = extname(filePath).toLowerCase();
  const language = detectLanguage(ext);

  const imports: ModuleImport[] = [];
  const exports: ModuleExport[] = [];

  if (language === 'python') {
    parsePythonImports(source, filePath, imports);
    parsePythonExports(source, filePath, exports);
  } else {
    parseJavaScriptImports(source, filePath, imports);
    parseJavaScriptExports(source, filePath, exports);
  }

  return { imports, exports, language };
}

/**
 * Detect language from file extension.
 */
function detectLanguage(ext: string): Language {
  switch (ext) {
    case '.py':
    case '.pyi':
      return 'python';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    default:
      return 'javascript';
  }
}

/**
 * Parse JavaScript/TypeScript imports.
 */
function parseJavaScriptImports(
  source: string,
  filePath: string,
  imports: ModuleImport[]
): void {
  // ES6 static imports
  // import x from 'module'
  // import { x, y } from 'module'
  // import * as x from 'module'
  // import 'module' (side effect)
  const importRegex = /^\s*import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/gm;
  const sideEffectRegex = /^\s*import\s+['"]([^'"]+)['"]/gm;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const requireRegex = /(?:const|let|var)\s+(\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match: RegExpExecArray | null;

  // Parse static imports
  while ((match = importRegex.exec(source)) !== null) {
    const importClause = match[1] ?? '';
    const specifier = match[2] ?? '';
    const line = getLineNumber(source, match.index);
    const isTypeOnly = match[0].includes('import type');

    const importedNames = parseImportClause(importClause);

    imports.push({
      id: randomUUID(),
      specifier,
      type: 'static',
      importedNames,
      location: { file: filePath, line },
      isTypeOnly,
    });
  }

  // Parse side-effect imports
  importRegex.lastIndex = 0; // Reset regex
  while ((match = sideEffectRegex.exec(source)) !== null) {
    // Skip if already matched as a regular import
    const beforeMatch = source.slice(0, match.index);
    if (beforeMatch.match(/import\s+(?:type\s+)?.+\s+from\s*$/)) {
      continue;
    }

    const specifier = match[1] ?? '';
    const line = getLineNumber(source, match.index);

    imports.push({
      id: randomUUID(),
      specifier,
      type: 'sideEffect',
      importedNames: [],
      location: { file: filePath, line },
      isTypeOnly: false,
    });
  }

  // Parse dynamic imports
  while ((match = dynamicImportRegex.exec(source)) !== null) {
    const specifier = match[1] ?? '';
    const line = getLineNumber(source, match.index);

    imports.push({
      id: randomUUID(),
      specifier,
      type: 'dynamic',
      importedNames: [],
      location: { file: filePath, line },
      isTypeOnly: false,
    });
  }

  // Parse require statements
  while ((match = requireRegex.exec(source)) !== null) {
    const binding = match[1] ?? '';
    const specifier = match[2] ?? '';
    const line = getLineNumber(source, match.index);

    const importedNames = parseRequireBinding(binding);

    imports.push({
      id: randomUUID(),
      specifier,
      type: 'require',
      importedNames,
      location: { file: filePath, line },
      isTypeOnly: false,
    });
  }
}

/**
 * Create an ImportedName with proper optional property handling.
 */
function createImportedName(
  name: string,
  options: {
    alias?: string;
    isType?: boolean;
    isDefault?: boolean;
    isNamespace?: boolean;
  } = {}
): ImportedName {
  const result: ImportedName = {
    name,
    isType: options.isType ?? false,
    isDefault: options.isDefault ?? false,
    isNamespace: options.isNamespace ?? false,
  };
  if (options.alias !== undefined) {
    result.alias = options.alias;
  }
  return result;
}

/**
 * Parse an import clause into imported names.
 */
function parseImportClause(clause: string): ImportedName[] {
  const names: ImportedName[] = [];
  const trimmed = clause.trim();

  // Default import: import x from 'y'
  // Named imports: import { x, y as z } from 'y'
  // Namespace import: import * as x from 'y'
  // Combined: import x, { y } from 'y'

  // Check for namespace import
  const namespaceMatch = trimmed.match(/^\*\s+as\s+(\w+)$/);
  if (namespaceMatch !== null) {
    const alias = namespaceMatch[1];
    if (alias !== undefined) {
      names.push(createImportedName('*', { alias, isNamespace: true }));
    }
    return names;
  }

  // Check for default + named: default, { named }
  const combinedMatch = trimmed.match(/^(\w+)\s*,\s*\{([^}]*)\}$/);
  if (combinedMatch !== null) {
    // Default import
    const alias = combinedMatch[1];
    if (alias !== undefined) {
      names.push(createImportedName('default', { alias, isDefault: true }));
    }

    // Named imports
    const namedPart = combinedMatch[2] ?? '';
    names.push(...parseNamedImports(namedPart));
    return names;
  }

  // Check for named imports only: { x, y as z }
  const namedMatch = trimmed.match(/^\{([^}]*)\}$/);
  if (namedMatch !== null) {
    names.push(...parseNamedImports(namedMatch[1] ?? ''));
    return names;
  }

  // Default import only
  if (/^\w+$/.test(trimmed)) {
    names.push(createImportedName('default', { alias: trimmed, isDefault: true }));
  }

  return names;
}

/**
 * Parse named imports like "x, y as z, type w".
 */
function parseNamedImports(namedPart: string): ImportedName[] {
  const names: ImportedName[] = [];
  const items = namedPart.split(',').map((s) => s.trim()).filter(Boolean);

  for (const item of items) {
    const isType = item.startsWith('type ');
    const withoutType = isType ? item.slice(5).trim() : item;

    const asMatch = withoutType.match(/^(\w+)\s+as\s+(\w+)$/);
    if (asMatch !== null) {
      const alias = asMatch[2];
      if (alias !== undefined) {
        names.push(createImportedName(asMatch[1] ?? '', { alias, isType }));
      }
    } else {
      names.push(createImportedName(withoutType, { isType }));
    }
  }

  return names;
}

/**
 * Parse require binding like "x" or "{ a, b }".
 */
function parseRequireBinding(binding: string): ImportedName[] {
  const trimmed = binding.trim();

  // Destructured: { a, b }
  const destructured = trimmed.match(/^\{([^}]*)\}$/);
  if (destructured !== null) {
    return parseNamedImports(destructured[1] ?? '');
  }

  // Single binding
  return [{
    name: 'default',
    alias: trimmed,
    isType: false,
    isDefault: true,
    isNamespace: false,
  }];
}

/**
 * Parse JavaScript/TypeScript exports.
 */
function parseJavaScriptExports(
  source: string,
  filePath: string,
  exports: ModuleExport[]
): void {
  // Named exports: export const x = ..., export function y() {}
  const namedExportRegex = /^\s*export\s+(?:type\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;

  // Default export: export default ...
  const defaultExportRegex = /^\s*export\s+default\s+/gm;

  // Re-exports: export { x } from 'y', export * from 'y'
  const reexportRegex = /^\s*export\s+(?:type\s+)?(\{[^}]+\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/gm;

  // Named export list: export { x, y as z }
  const exportListRegex = /^\s*export\s+(?:type\s+)?\{([^}]+)\}(?!\s+from)/gm;

  let match: RegExpExecArray | null;

  // Parse named exports
  while ((match = namedExportRegex.exec(source)) !== null) {
    const name = match[1] ?? '';
    const line = getLineNumber(source, match.index);
    const isTypeOnly = match[0].includes('export type');

    exports.push({
      id: randomUUID(),
      name,
      type: 'named',
      location: { file: filePath, line },
      isTypeOnly,
    });
  }

  // Parse default exports
  while ((match = defaultExportRegex.exec(source)) !== null) {
    const line = getLineNumber(source, match.index);

    exports.push({
      id: randomUUID(),
      name: 'default',
      type: 'default',
      location: { file: filePath, line },
      isTypeOnly: false,
    });
  }

  // Parse re-exports
  while ((match = reexportRegex.exec(source)) !== null) {
    const exportClause = match[1] ?? '';
    const sourceModule = match[2] ?? '';
    const line = getLineNumber(source, match.index);
    const isTypeOnly = match[0].includes('export type');

    if (exportClause.startsWith('*')) {
      // Namespace re-export
      const asMatch = exportClause.match(/\*\s+as\s+(\w+)/);
      exports.push({
        id: randomUUID(),
        name: asMatch !== null ? (asMatch[1] ?? '*') : '*',
        type: 'namespace',
        location: { file: filePath, line },
        isTypeOnly,
        source: sourceModule,
      });
    } else {
      // Named re-exports
      const names = exportClause.slice(1, -1).split(',').map((s) => s.trim());
      for (const nameSpec of names) {
        const asMatch = nameSpec.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch !== null) {
          const localName = asMatch[1];
          const exp: ModuleExport = {
            id: randomUUID(),
            name: asMatch[2] ?? '',
            type: 'reexport',
            location: { file: filePath, line },
            isTypeOnly,
            source: sourceModule,
          };
          if (localName !== undefined) {
            exp.localName = localName;
          }
          exports.push(exp);
        } else {
          exports.push({
            id: randomUUID(),
            name: nameSpec,
            type: 'reexport',
            location: { file: filePath, line },
            isTypeOnly,
            source: sourceModule,
          });
        }
      }
    }
  }

  // Parse export lists
  while ((match = exportListRegex.exec(source)) !== null) {
    const exportList = match[1] ?? '';
    const line = getLineNumber(source, match.index);
    const isTypeOnly = match[0].includes('export type');

    const names = exportList.split(',').map((s) => s.trim()).filter(Boolean);
    for (const nameSpec of names) {
      const asMatch = nameSpec.match(/(\w+)\s+as\s+(\w+)/);
      if (asMatch !== null) {
        const localName = asMatch[1];
        const exp: ModuleExport = {
          id: randomUUID(),
          name: asMatch[2] ?? '',
          type: 'named',
          location: { file: filePath, line },
          isTypeOnly,
        };
        if (localName !== undefined) {
          exp.localName = localName;
        }
        exports.push(exp);
      } else {
        exports.push({
          id: randomUUID(),
          name: nameSpec,
          type: 'named',
          location: { file: filePath, line },
          isTypeOnly,
        });
      }
    }
  }
}

/**
 * Parse Python imports.
 */
function parsePythonImports(
  source: string,
  filePath: string,
  imports: ModuleImport[]
): void {
  // import module
  // import module as alias
  // from module import name
  // from module import name as alias
  // from module import *

  const importRegex = /^\s*import\s+(\w+(?:\.\w+)*)(?:\s+as\s+(\w+))?/gm;
  const fromImportRegex = /^\s*from\s+(\w+(?:\.\w+)*)\s+import\s+(.+)/gm;

  let match: RegExpExecArray | null;

  // Parse simple imports
  while ((match = importRegex.exec(source)) !== null) {
    const specifier = match[1] ?? '';
    const alias = match[2];
    const line = getLineNumber(source, match.index);

    const importedNames: ImportedName[] = [
      createImportedName(
        specifier.split('.').pop() ?? specifier,
        alias !== undefined
          ? { alias, isNamespace: true }
          : { isNamespace: true }
      ),
    ];

    imports.push({
      id: randomUUID(),
      specifier,
      type: 'static',
      importedNames,
      location: { file: filePath, line },
      isTypeOnly: false,
    });
  }

  // Parse from imports
  while ((match = fromImportRegex.exec(source)) !== null) {
    const specifier = match[1] ?? '';
    const importList = match[2] ?? '';
    const line = getLineNumber(source, match.index);

    // Handle multi-line imports with parentheses
    const cleanList = importList.replace(/[()]/g, '').trim();

    if (cleanList === '*') {
      imports.push({
        id: randomUUID(),
        specifier,
        type: 'static',
        importedNames: [{
          name: '*',
          isType: false,
          isDefault: false,
          isNamespace: true,
        }],
        location: { file: filePath, line },
        isTypeOnly: false,
      });
    } else {
      const names = cleanList.split(',').map((s) => s.trim()).filter(Boolean);
      const importedNames: ImportedName[] = names.map((nameSpec) => {
        const asMatch = nameSpec.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch !== null) {
          const aliasValue = asMatch[2];
          return createImportedName(
            asMatch[1] ?? '',
            aliasValue !== undefined ? { alias: aliasValue } : {}
          );
        }
        return createImportedName(nameSpec, {});
      });

      imports.push({
        id: randomUUID(),
        specifier,
        type: 'static',
        importedNames,
        location: { file: filePath, line },
        isTypeOnly: false,
      });
    }
  }
}

/**
 * Parse Python exports (module-level definitions).
 */
function parsePythonExports(
  source: string,
  filePath: string,
  exports: ModuleExport[]
): void {
  // In Python, everything at module level is potentially exported
  // We look for __all__, class definitions, function definitions, and assignments

  // Check for __all__
  const allMatch = source.match(/__all__\s*=\s*\[([^\]]+)\]/);
  if (allMatch !== null) {
    const names = allMatch[1]
      ?.match(/['"](\w+)['"]/g)
      ?.map((s) => s.slice(1, -1)) ?? [];

    for (const name of names) {
      exports.push({
        id: randomUUID(),
        name,
        type: 'named',
        location: { file: filePath, line: getLineNumber(source, allMatch.index ?? 0) },
        isTypeOnly: false,
      });
    }
    return; // If __all__ is defined, only those are exported
  }

  // Class definitions
  const classRegex = /^class\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(source)) !== null) {
    const name = match[1] ?? '';
    if (!name.startsWith('_')) {
      exports.push({
        id: randomUUID(),
        name,
        type: 'named',
        location: { file: filePath, line: getLineNumber(source, match.index) },
        isTypeOnly: false,
      });
    }
  }

  // Function definitions
  const funcRegex = /^def\s+(\w+)/gm;
  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] ?? '';
    if (!name.startsWith('_')) {
      exports.push({
        id: randomUUID(),
        name,
        type: 'named',
        location: { file: filePath, line: getLineNumber(source, match.index) },
        isTypeOnly: false,
      });
    }
  }

  // Module-level assignments (potential exports)
  const assignRegex = /^([A-Z][A-Z_0-9]*)\s*=/gm;
  while ((match = assignRegex.exec(source)) !== null) {
    const name = match[1] ?? '';
    exports.push({
      id: randomUUID(),
      name,
      type: 'named',
      location: { file: filePath, line: getLineNumber(source, match.index) },
      isTypeOnly: false,
    });
  }
}

/**
 * Get line number from character index.
 */
function getLineNumber(source: string, index: number): number {
  const before = source.slice(0, index);
  return before.split('\n').length;
}

// =============================================================================
// Dependency Graph Builder
// =============================================================================

/**
 * Builder for dependency graphs.
 *
 * Analyzes source files to build a complete dependency graph including
 * import/export relationships, circular dependency detection, and
 * dependency statistics.
 *
 * @example
 * ```typescript
 * const builder = new DependencyGraphBuilder({
 *   root: '/path/to/project',
 *   include: ['src/**\/*.ts'],
 *   detectCircular: true,
 * });
 *
 * // Add files to analyze
 * builder.addFile('/path/to/project/src/index.ts', sourceCode);
 *
 * // Build the graph
 * const graph = builder.build();
 * console.log(`Found ${graph.stats.circularDependencies} circular dependencies`);
 * ```
 */
export class DependencyGraphBuilder {
  private readonly config: Required<DependencyGraphConfig>;
  private readonly nodes: Map<string, DependencyNode>;
  private readonly edges: DependencyEdge[];
  private readonly resolver: ModuleResolver;
  private readonly pendingSources: Map<string, string>;

  constructor(config: DependencyGraphConfig) {
    this.config = {
      root: config.root,
      include: config.include ?? ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py'],
      exclude: config.exclude ?? ['**/node_modules/**', '**/__pycache__/**', '**/dist/**', '**/build/**'],
      entryPoints: config.entryPoints ?? [],
      resolveExternal: config.resolveExternal ?? false,
      detectCircular: config.detectCircular ?? true,
      maxDepth: config.maxDepth ?? 100,
      resolver: config.resolver ?? new DefaultModuleResolver(config.root),
    };

    this.nodes = new Map();
    this.edges = [];
    this.resolver = this.config.resolver;
    this.pendingSources = new Map();
  }

  /**
   * Add a source file to be analyzed.
   *
   * @param filePath - Absolute path to the file
   * @param source - Source code content
   * @param isEntryPoint - Whether this is an entry point
   */
  addFile(filePath: string, source: string, isEntryPoint = false): void {
    this.pendingSources.set(filePath, source);

    if (isEntryPoint) {
      if (!this.config.entryPoints.includes(filePath)) {
        this.config.entryPoints.push(filePath);
      }
    }
  }

  /**
   * Add multiple files at once.
   *
   * @param files - Map of file paths to source code
   */
  addFiles(files: Map<string, string>): void {
    for (const [path, source] of files) {
      this.addFile(path, source);
    }
  }

  /**
   * Build the dependency graph.
   *
   * @returns Complete dependency graph
   */
  build(): DependencyGraph {
    // Parse all files
    for (const [filePath, source] of this.pendingSources) {
      this.processFile(filePath, source);
    }

    // Resolve dependencies
    this.resolveDependencies();

    // Calculate depths
    this.calculateDepths();

    // Detect circular dependencies
    const circularDependencies = this.config.detectCircular
      ? this.detectCircularDependencies()
      : [];

    // Collect external dependencies
    const externalDependencies = new Set<string>();
    for (const node of this.nodes.values()) {
      for (const imp of node.imports) {
        if (this.resolver.isExternal(imp.specifier)) {
          const baseName = imp.specifier.split('/')[0] ?? imp.specifier;
          externalDependencies.add(baseName.startsWith('@')
            ? imp.specifier.split('/').slice(0, 2).join('/')
            : baseName);
        }
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(circularDependencies);

    return {
      root: this.config.root,
      nodes: this.nodes,
      edges: this.edges,
      circularDependencies,
      entryPoints: this.config.entryPoints,
      externalDependencies,
      stats,
    };
  }

  /**
   * Process a single file.
   */
  private processFile(filePath: string, source: string): void {
    const { imports, exports, language } = parseSourceFile(source, filePath);
    const relativePath = relative(this.config.root, filePath);
    const isEntryPoint = this.config.entryPoints.includes(filePath);

    const node: DependencyNode = {
      id: filePath,
      path: filePath,
      relativePath,
      type: 'source',
      language,
      imports,
      exports,
      dependencies: [],
      dependents: [],
      depth: isEntryPoint ? 0 : -1,
      isEntryPoint,
    };

    this.nodes.set(filePath, node);
  }

  /**
   * Resolve import specifiers to file paths and build edges.
   */
  private resolveDependencies(): void {
    for (const node of this.nodes.values()) {
      for (const imp of node.imports) {
        const resolvedPath = this.resolver.resolve(imp.specifier, node.path);

        if (resolvedPath !== undefined) {
          imp.resolvedPath = resolvedPath;

          // Check if target exists
          const targetNode = this.nodes.get(resolvedPath);
          if (targetNode !== undefined) {
            // Add dependency relationship
            if (!node.dependencies.includes(resolvedPath)) {
              node.dependencies.push(resolvedPath);
            }
            if (!targetNode.dependents.includes(node.path)) {
              targetNode.dependents.push(node.path);
            }

            // Create edge
            this.edges.push({
              source: node.path,
              target: resolvedPath,
              type: imp.type,
              importedNames: imp.importedNames.map((n) => n.alias ?? n.name),
              isCircular: false,
              weight: imp.importedNames.length || 1,
            });
          }
        } else if (this.config.resolveExternal && this.resolver.isExternal(imp.specifier)) {
          // Create external node
          const externalId = `external:${imp.specifier}`;
          if (!this.nodes.has(externalId)) {
            this.nodes.set(externalId, {
              id: externalId,
              path: externalId,
              relativePath: imp.specifier,
              type: 'external',
              language: 'javascript',
              imports: [],
              exports: [],
              dependencies: [],
              dependents: [],
              depth: -1,
              isEntryPoint: false,
            });
          }

          node.dependencies.push(externalId);
          this.nodes.get(externalId)?.dependents.push(node.path);
        }
      }
    }
  }

  /**
   * Calculate depth from entry points using BFS.
   */
  private calculateDepths(): void {
    const visited = new Set<string>();
    const queue: Array<{ path: string; depth: number }> = [];

    // Start from entry points
    for (const entryPoint of this.config.entryPoints) {
      const node = this.nodes.get(entryPoint);
      if (node !== undefined) {
        node.depth = 0;
        queue.push({ path: entryPoint, depth: 0 });
        visited.add(entryPoint);
      }
    }

    // If no entry points, use nodes with no dependents
    if (queue.length === 0) {
      for (const node of this.nodes.values()) {
        if (node.dependents.length === 0 && node.type === 'source') {
          node.depth = 0;
          node.isEntryPoint = true;
          queue.push({ path: node.path, depth: 0 });
          visited.add(node.path);
        }
      }
    }

    // BFS traversal
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;

      const node = this.nodes.get(current.path);
      if (node === undefined) continue;

      for (const depPath of node.dependencies) {
        const depNode = this.nodes.get(depPath);
        if (depNode === undefined) continue;

        const newDepth = current.depth + 1;
        if (!visited.has(depPath)) {
          depNode.depth = newDepth;
          visited.add(depPath);
          queue.push({ path: depPath, depth: newDepth });
        }
      }
    }
  }

  /**
   * Detect circular dependencies using Tarjan's algorithm.
   */
  private detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodePath: string): void => {
      visited.add(nodePath);
      recursionStack.add(nodePath);
      path.push(nodePath);

      const node = this.nodes.get(nodePath);
      if (node !== undefined) {
        for (const depPath of node.dependencies) {
          if (!visited.has(depPath)) {
            dfs(depPath);
          } else if (recursionStack.has(depPath)) {
            // Found a cycle
            const cycleStart = path.indexOf(depPath);
            const cycle = path.slice(cycleStart);
            cycle.push(depPath); // Complete the cycle

            // Mark edges as circular
            for (let i = 0; i < cycle.length - 1; i++) {
              const edge = this.edges.find(
                (e) => e.source === cycle[i] && e.target === cycle[i + 1]
              );
              if (edge !== undefined) {
                edge.isCircular = true;
              }
            }

            const length = cycle.length - 1;
            cycles.push({
              id: randomUUID(),
              cycle: cycle.map((p) => relative(this.config.root, p)),
              length,
              entryPoint: relative(this.config.root, depPath),
              severity: length <= 2 ? 'low' : length <= 4 ? 'medium' : 'high',
              suggestion: this.generateCycleSuggestion(cycle),
            });
          }
        }
      }

      path.pop();
      recursionStack.delete(nodePath);
    };

    // Run DFS from each unvisited node
    for (const nodePath of this.nodes.keys()) {
      if (!visited.has(nodePath)) {
        dfs(nodePath);
      }
    }

    return cycles;
  }

  /**
   * Generate a suggestion for breaking a cycle.
   */
  private generateCycleSuggestion(cycle: string[]): string {
    if (cycle.length <= 2) {
      return `Consider extracting shared code to a separate module that both ${basename(cycle[0] ?? '')} and ${basename(cycle[1] ?? '')} can import.`;
    }

    // Find the weakest link (edge with fewest imports)
    let minWeight = Infinity;
    let weakestEdge: { from: string; to: string } | undefined;

    for (let i = 0; i < cycle.length - 1; i++) {
      const edge = this.edges.find(
        (e) => e.source === cycle[i] && e.target === cycle[i + 1]
      );
      if (edge !== undefined && edge.weight < minWeight) {
        minWeight = edge.weight;
        weakestEdge = { from: cycle[i] ?? '', to: cycle[i + 1] ?? '' };
      }
    }

    if (weakestEdge !== undefined) {
      return `Consider removing or refactoring the import from ${basename(weakestEdge.from)} to ${basename(weakestEdge.to)} to break this cycle.`;
    }

    return `Review the dependency chain and extract shared code to break this ${cycle.length - 1}-module cycle.`;
  }

  /**
   * Calculate graph statistics.
   */
  private calculateStats(circularDeps: CircularDependency[]): DependencyGraphStats {
    let sourceModules = 0;
    let externalModules = 0;
    let maxDepth = 0;
    let totalDeps = 0;
    const connections: Array<{ path: string; connections: number }> = [];

    for (const node of this.nodes.values()) {
      if (node.type === 'source') {
        sourceModules++;
        totalDeps += node.dependencies.length;
        maxDepth = Math.max(maxDepth, node.depth);
        connections.push({
          path: node.relativePath,
          connections: node.dependencies.length + node.dependents.length,
        });
      } else if (node.type === 'external') {
        externalModules++;
      }
    }

    connections.sort((a, b) => b.connections - a.connections);

    return {
      totalModules: this.nodes.size,
      sourceModules,
      externalModules,
      totalEdges: this.edges.length,
      circularDependencies: circularDeps.length,
      maxDepth,
      avgDependencies: sourceModules > 0 ? totalDeps / sourceModules : 0,
      mostConnected: connections.slice(0, 10),
    };
  }
}

// =============================================================================
// Dependency Graph Analyzer
// =============================================================================

/**
 * Analyzes a dependency graph for issues.
 *
 * @param graph - The dependency graph to analyze
 * @returns Analysis results
 */
export function analyzeGraph(graph: DependencyGraph): {
  unusedExports: UnusedExport[];
  missingImports: MissingImport[];
  suggestions: string[];
} {
  const unusedExports: UnusedExport[] = [];
  const missingImports: MissingImport[] = [];
  const suggestions: string[] = [];

  // Find all imported names
  const importedNames = new Map<string, Set<string>>();
  for (const node of graph.nodes.values()) {
    for (const imp of node.imports) {
      if (imp.resolvedPath !== undefined) {
        if (!importedNames.has(imp.resolvedPath)) {
          importedNames.set(imp.resolvedPath, new Set());
        }
        for (const name of imp.importedNames) {
          importedNames.get(imp.resolvedPath)?.add(name.alias ?? name.name);
        }
      }
    }
  }

  // Check for unused exports
  for (const node of graph.nodes.values()) {
    if (node.type !== 'source') continue;

    const usedNames = importedNames.get(node.path) ?? new Set();

    for (const exp of node.exports) {
      // Default exports are always considered potentially used
      if (exp.name === 'default') continue;

      // Re-exports might be used externally
      if (exp.type === 'reexport') continue;

      if (!usedNames.has(exp.name)) {
        unusedExports.push({
          module: node.relativePath,
          exportName: exp.name,
          location: exp.location,
          mightBeExternal: node.isEntryPoint,
        });
      }
    }
  }

  // Check for unresolved imports
  for (const node of graph.nodes.values()) {
    if (node.type !== 'source') continue;

    for (const imp of node.imports) {
      // Skip external and builtin modules
      if (imp.specifier.startsWith('.') || imp.specifier.startsWith('/')) {
        if (imp.resolvedPath === undefined || !graph.nodes.has(imp.resolvedPath)) {
          missingImports.push({
            module: node.relativePath,
            specifier: imp.specifier,
            location: imp.location,
            suggestions: generateImportSuggestions(imp.specifier, graph),
          });
        }
      }
    }
  }

  // Generate suggestions
  if (graph.circularDependencies.length > 0) {
    suggestions.push(
      `Found ${graph.circularDependencies.length} circular dependencies. Consider refactoring to break these cycles.`
    );
  }

  if (unusedExports.length > 10) {
    suggestions.push(
      `Found ${unusedExports.length} potentially unused exports. Consider cleaning up dead code.`
    );
  }

  const avgDeps = graph.stats.avgDependencies;
  if (avgDeps > 10) {
    suggestions.push(
      `Average dependencies per module is ${avgDeps.toFixed(1)}. Consider breaking up large modules.`
    );
  }

  return { unusedExports, missingImports, suggestions };
}

/**
 * Generate suggestions for a missing import.
 */
function generateImportSuggestions(specifier: string, graph: DependencyGraph): string[] {
  const suggestions: string[] = [];
  const targetName = basename(specifier).replace(/\.\w+$/, '');

  for (const node of graph.nodes.values()) {
    if (node.type !== 'source') continue;

    const nodeName = basename(node.path).replace(/\.\w+$/, '');
    if (nodeName.toLowerCase().includes(targetName.toLowerCase())) {
      suggestions.push(node.relativePath);
    }
  }

  return suggestions.slice(0, 5);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new dependency graph builder.
 *
 * @param config - Builder configuration
 * @returns New builder instance
 */
export function createDependencyGraphBuilder(
  config: DependencyGraphConfig
): DependencyGraphBuilder {
  return new DependencyGraphBuilder(config);
}

/**
 * Create a default module resolver.
 *
 * @param root - Project root directory
 * @param language - Primary language
 * @returns New resolver instance
 */
export function createModuleResolver(
  root: string,
  language: Language = 'javascript'
): DefaultModuleResolver {
  return new DefaultModuleResolver(root, language);
}

/**
 * Build a dependency graph from a map of files.
 *
 * @param root - Project root directory
 * @param files - Map of file paths to source code
 * @param options - Additional options
 * @returns Built dependency graph
 */
export function buildDependencyGraph(
  root: string,
  files: Map<string, string>,
  options: Partial<DependencyGraphConfig> = {}
): DependencyGraph {
  const builder = new DependencyGraphBuilder({ root, ...options });
  builder.addFiles(files);
  return builder.build();
}
