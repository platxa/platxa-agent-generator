/**
 * Syntax Highlighter — Lightweight code syntax highlighting
 *
 * Provides language detection and token-based syntax highlighting
 * for code blocks in chat messages.
 */

// =============================================================================
// Types
// =============================================================================

/** Token types for syntax highlighting */
export type SyntaxTokenType =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "operator"
  | "punctuation"
  | "variable"
  | "type"
  | "property"
  | "tag"
  | "attribute"
  | "text";

/** A highlighted token */
export interface SyntaxToken {
  type: SyntaxTokenType;
  content: string;
}

/** Supported languages */
export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "scss"
  | "json"
  | "xml"
  | "bash"
  | "sql"
  | "go"
  | "rust"
  | "java"
  | "plaintext";

/** Language aliases mapping */
export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  python3: "python",
  htm: "html",
  xhtml: "html",
  sass: "scss",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  mysql: "sql",
  postgresql: "sql",
  golang: "go",
  rs: "rust",
  txt: "plaintext",
  text: "plaintext",
};

// =============================================================================
// Language Definitions
// =============================================================================

interface LanguageDefinition {
  keywords: string[];
  types?: string[];
  builtins?: string[];
  operators?: RegExp;
  stringPattern?: RegExp;
  commentSingle?: string;
  commentMultiStart?: string;
  commentMultiEnd?: string;
}

const LANGUAGE_DEFINITIONS: Partial<Record<SupportedLanguage, LanguageDefinition>> = {
  javascript: {
    keywords: [
      "async", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
      "for", "from", "function", "if", "import", "in", "instanceof", "let", "new",
      "of", "return", "static", "super", "switch", "this", "throw", "try", "typeof",
      "var", "void", "while", "with", "yield",
    ],
    types: ["Array", "Boolean", "Date", "Error", "Function", "Map", "Number", "Object", "Promise", "RegExp", "Set", "String", "Symbol"],
    builtins: ["console", "document", "window", "Math", "JSON", "parseInt", "parseFloat", "undefined", "null", "true", "false", "NaN", "Infinity"],
    operators: /[+\-*/%=!<>&|^~?:]+/,
    stringPattern: /(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  typescript: {
    keywords: [
      "abstract", "any", "as", "async", "await", "boolean", "break", "case", "catch",
      "class", "const", "constructor", "continue", "debugger", "declare", "default",
      "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from",
      "function", "get", "if", "implements", "import", "in", "infer", "instanceof",
      "interface", "is", "keyof", "let", "module", "namespace", "never", "new", "null",
      "number", "object", "of", "override", "package", "private", "protected", "public",
      "readonly", "return", "set", "static", "string", "super", "switch", "symbol",
      "this", "throw", "try", "type", "typeof", "undefined", "unique", "unknown",
      "var", "void", "while", "with", "yield",
    ],
    types: ["Array", "Boolean", "Date", "Error", "Function", "Map", "Number", "Object", "Promise", "Record", "RegExp", "Set", "String", "Symbol", "Partial", "Required", "Readonly", "Pick", "Omit"],
    builtins: ["console", "document", "window", "Math", "JSON", "true", "false"],
    operators: /[+\-*/%=!<>&|^~?:]+/,
    stringPattern: /(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  python: {
    keywords: [
      "False", "None", "True", "and", "as", "assert", "async", "await", "break",
      "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
      "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or",
      "pass", "raise", "return", "try", "while", "with", "yield",
    ],
    types: ["int", "str", "float", "bool", "list", "dict", "tuple", "set", "bytes"],
    builtins: ["print", "len", "range", "type", "input", "open", "self", "cls"],
    operators: /[+\-*/%=!<>&|^~@]+/,
    stringPattern: /('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,
    commentSingle: "#",
  },
  css: {
    keywords: ["important", "inherit", "initial", "unset", "auto", "none"],
    operators: /[{}:;,>+~*]/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  scss: {
    keywords: ["important", "inherit", "initial", "unset", "auto", "none", "if", "else", "for", "each", "while", "mixin", "include", "extend", "function", "return"],
    operators: /[{}:;,>+~*$@#]/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  html: {
    keywords: [],
    operators: /[<>\/=]/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentMultiStart: "<!--",
    commentMultiEnd: "-->",
  },
  json: {
    keywords: ["true", "false", "null"],
    operators: /[{}[\]:,]/,
    stringPattern: /"(?:[^"\\]|\\.)*"/g,
  },
  bash: {
    keywords: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "exit", "export", "local", "readonly", "declare"],
    builtins: ["echo", "cd", "pwd", "ls", "cat", "grep", "sed", "awk", "rm", "mkdir", "chmod", "chown", "sudo", "apt", "npm", "yarn", "git"],
    operators: /[|&;$(){}[\]<>!]/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "#",
  },
  sql: {
    keywords: [
      "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "INSERT", "INTO", "VALUES",
      "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "INDEX", "DROP", "ALTER", "ADD",
      "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "ON", "GROUP", "BY", "ORDER", "ASC",
      "DESC", "LIMIT", "OFFSET", "HAVING", "UNION", "DISTINCT", "AS", "NULL", "IS",
      "LIKE", "IN", "BETWEEN", "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END",
    ],
    types: ["INT", "VARCHAR", "TEXT", "BOOLEAN", "DATE", "TIMESTAMP", "DECIMAL", "FLOAT"],
    operators: /[=<>!+\-*/%(),;]/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "--",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  go: {
    keywords: [
      "break", "case", "chan", "const", "continue", "default", "defer", "else",
      "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map",
      "package", "range", "return", "select", "struct", "switch", "type", "var",
    ],
    types: ["bool", "byte", "complex64", "complex128", "error", "float32", "float64", "int", "int8", "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr"],
    builtins: ["append", "cap", "close", "copy", "delete", "len", "make", "new", "panic", "print", "println", "recover", "true", "false", "nil"],
    operators: /[+\-*/%=!<>&|^:]+/,
    stringPattern: /(`[^`]*`|"(?:[^"\\]|\\.)*")/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  rust: {
    keywords: [
      "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
      "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop",
      "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static",
      "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while",
    ],
    types: ["bool", "char", "f32", "f64", "i8", "i16", "i32", "i64", "i128", "isize", "str", "u8", "u16", "u32", "u64", "u128", "usize", "String", "Vec", "Option", "Result", "Box"],
    builtins: ["Some", "None", "Ok", "Err", "println", "print", "format", "vec"],
    operators: /[+\-*/%=!<>&|^?:;,]+/,
    stringPattern: /(r#*"[^"]*"#*|"(?:[^"\\]|\\.)*")/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
  java: {
    keywords: [
      "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
      "class", "const", "continue", "default", "do", "double", "else", "enum",
      "extends", "final", "finally", "float", "for", "goto", "if", "implements",
      "import", "instanceof", "int", "interface", "long", "native", "new", "package",
      "private", "protected", "public", "return", "short", "static", "strictfp",
      "super", "switch", "synchronized", "this", "throw", "throws", "transient",
      "try", "void", "volatile", "while",
    ],
    types: ["Boolean", "Byte", "Character", "Double", "Float", "Integer", "Long", "Object", "Short", "String", "List", "Map", "Set", "ArrayList", "HashMap"],
    builtins: ["System", "Math", "true", "false", "null"],
    operators: /[+\-*/%=!<>&|^~?:]+/,
    stringPattern: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g,
    commentSingle: "//",
    commentMultiStart: "/*",
    commentMultiEnd: "*/",
  },
};

// Copy JS/TS definition
LANGUAGE_DEFINITIONS.typescript = {
  ...LANGUAGE_DEFINITIONS.javascript,
  ...LANGUAGE_DEFINITIONS.typescript,
};

// =============================================================================
// Token CSS Classes
// =============================================================================

/** CSS class names for token types */
export const TOKEN_CLASSES: Record<SyntaxTokenType, string> = {
  keyword: "text-purple-400",
  string: "text-green-400",
  number: "text-orange-400",
  comment: "text-gray-500 italic",
  function: "text-blue-400",
  operator: "text-cyan-400",
  punctuation: "text-gray-400",
  variable: "text-red-400",
  type: "text-yellow-400",
  property: "text-teal-400",
  tag: "text-red-400",
  attribute: "text-orange-400",
  text: "text-gray-200",
};

// =============================================================================
// Language Detection
// =============================================================================

/**
 * Normalizes a language identifier to a supported language.
 */
export function normalizeLanguage(lang: string): SupportedLanguage {
  const normalized = lang.toLowerCase().trim();

  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  if (LANGUAGE_DEFINITIONS[normalized as SupportedLanguage]) {
    return normalized as SupportedLanguage;
  }

  return "plaintext";
}

/**
 * Detects language from code content heuristically.
 */
export function detectLanguage(code: string): SupportedLanguage {
  const lines = code.split("\n").slice(0, 10).join("\n");

  // Check for shebang
  if (lines.startsWith("#!/bin/bash") || lines.startsWith("#!/bin/sh")) {
    return "bash";
  }
  if (lines.startsWith("#!/usr/bin/env python") || lines.startsWith("#!/usr/bin/python")) {
    return "python";
  }

  // Check for common patterns
  if (/<\?xml|<!DOCTYPE|<html|<div|<span/i.test(lines)) return "html";
  if (/^{[\s\S]*}$/.test(code.trim()) && /"[^"]+"\s*:/m.test(lines)) return "json";
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(lines)) return "sql";
  if (/^package\s+\w+/m.test(lines) && /^import\s+\(/m.test(lines)) return "go";
  if (/^(use|mod|fn|impl|struct|enum)\s+/m.test(lines)) return "rust";
  if (/^(public\s+)?class\s+\w+/m.test(lines) && /import\s+java\./m.test(lines)) return "java";
  if (/^import\s+.*from\s+['"]|^export\s+(default\s+)?(function|class|const|let)/m.test(lines)) return "javascript";
  if (/:\s*(string|number|boolean|any)\b|interface\s+\w+/m.test(lines)) return "typescript";
  if (/^(def|class|import|from|if __name__)/m.test(lines)) return "python";
  if (/^@(mixin|include|import|use)|^\$\w+:/m.test(lines)) return "scss";
  if (/^[.#]?\w+\s*\{[\s\S]*\}/m.test(lines)) return "css";

  return "plaintext";
}

// =============================================================================
// Tokenization
// =============================================================================

/**
 * Tokenizes code for a specific language.
 */
export function tokenize(code: string, language: SupportedLanguage): SyntaxToken[] {
  const definition = LANGUAGE_DEFINITIONS[language];

  if (!definition || language === "plaintext") {
    return [{ type: "text", content: code }];
  }

  const tokens: SyntaxToken[] = [];
  let remaining = code;

  while (remaining.length > 0) {
    let matched = false;

    // Check for comments first
    if (definition.commentSingle && remaining.startsWith(definition.commentSingle)) {
      const endIndex = remaining.indexOf("\n");
      const comment = endIndex === -1 ? remaining : remaining.slice(0, endIndex);
      tokens.push({ type: "comment", content: comment });
      remaining = endIndex === -1 ? "" : remaining.slice(endIndex);
      continue;
    }

    if (definition.commentMultiStart && remaining.startsWith(definition.commentMultiStart)) {
      const endIndex = remaining.indexOf(definition.commentMultiEnd!, definition.commentMultiStart.length);
      const end = endIndex === -1 ? remaining.length : endIndex + definition.commentMultiEnd!.length;
      tokens.push({ type: "comment", content: remaining.slice(0, end) });
      remaining = remaining.slice(end);
      continue;
    }

    // Check for strings
    if (definition.stringPattern) {
      const stringMatch = remaining.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push({ type: "string", content: stringMatch[0] });
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }
      // Template literals and multiline strings
      const templateMatch = remaining.match(/^`(?:[^`\\]|\\.)*?`/);
      if (templateMatch) {
        tokens.push({ type: "string", content: templateMatch[0] });
        remaining = remaining.slice(templateMatch[0].length);
        continue;
      }
    }

    // Check for numbers
    const numberMatch = remaining.match(/^(\d+\.?\d*([eE][+-]?\d+)?|0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+)/);
    if (numberMatch) {
      tokens.push({ type: "number", content: numberMatch[0] });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Check for words (keywords, types, builtins, identifiers)
    const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      let tokenType: SyntaxTokenType = "text";

      if (definition.keywords.includes(word)) {
        tokenType = "keyword";
      } else if (definition.types?.includes(word)) {
        tokenType = "type";
      } else if (definition.builtins?.includes(word)) {
        tokenType = "variable";
      } else if (remaining.slice(word.length).match(/^\s*\(/)) {
        tokenType = "function";
      }

      tokens.push({ type: tokenType, content: word });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Check for operators
    if (definition.operators) {
      const opMatch = remaining.match(new RegExp(`^${definition.operators.source}`));
      if (opMatch) {
        tokens.push({ type: "operator", content: opMatch[0] });
        remaining = remaining.slice(opMatch[0].length);
        continue;
      }
    }

    // Punctuation and whitespace
    const puncMatch = remaining.match(/^[{}[\]();,.<>]/);
    if (puncMatch) {
      tokens.push({ type: "punctuation", content: puncMatch[0] });
      remaining = remaining.slice(1);
      continue;
    }

    // Whitespace
    const wsMatch = remaining.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ type: "text", content: wsMatch[0] });
      remaining = remaining.slice(wsMatch[0].length);
      continue;
    }

    // Single character fallback
    tokens.push({ type: "text", content: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

/**
 * Highlights code and returns tokens.
 */
export function highlight(code: string, lang: string): SyntaxToken[] {
  const language = normalizeLanguage(lang);
  return tokenize(code, language);
}

/**
 * Highlights code and returns HTML string.
 */
export function highlightToHtml(code: string, lang: string): string {
  const tokens = highlight(code, lang);
  return tokens
    .map((token) => {
      const className = TOKEN_CLASSES[token.type];
      const escaped = escapeHtml(token.content);
      return token.type === "text" ? escaped : `<span class="${className}">${escaped}</span>`;
    })
    .join("");
}

/**
 * Escapes HTML special characters.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Gets the display name for a language.
 */
export function getLanguageDisplayName(lang: string): string {
  const normalized = normalizeLanguage(lang);
  const displayNames: Record<SupportedLanguage, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    xml: "XML",
    bash: "Bash",
    sql: "SQL",
    go: "Go",
    rust: "Rust",
    java: "Java",
    plaintext: "Plain Text",
  };
  return displayNames[normalized] || normalized;
}
