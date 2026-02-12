/**
 * QWeb Parser - AST-based QWeb template parsing
 *
 * Replaces regex-based parsing with proper XML AST parsing using fast-xml-parser.
 * This ensures accurate handling of:
 * - Nested directives
 * - Complex attribute expressions
 * - Proper element boundaries
 * - XML namespaces
 *
 * Phase 2: Production-grade QWeb support
 */

import { XMLParser, XMLBuilder, XmlBuilderOptions } from "fast-xml-parser";

// =============================================================================
// Types
// =============================================================================

/** QWeb directive types */
export type QWebDirectiveType =
  | "t-if"
  | "t-elif"
  | "t-else"
  | "t-foreach"
  | "t-as"
  | "t-set"
  | "t-value"
  | "t-esc"
  | "t-raw"
  | "t-out"
  | "t-call"
  | "t-field"
  | "t-att"
  | "t-attf"
  | "t-name"
  | "t-inherit"
  | "t-extend"
  | "t-debug"
  | "t-log"
  | "t-js"
  | "t-translation"
  | "t-options"
  | "t-tag"
  | "t-portal"
  | "t-cache"
  | "t-nocache";

/** Parsed QWeb directive */
export interface QWebDirective {
  type: QWebDirectiveType;
  value: string;
  /** For t-att-* and t-attf-*, the attribute name */
  attrName?: string;
}

/** AST Node representing a QWeb element */
export interface QWebASTNode {
  /** Tag name (or "#text" for text nodes, "#comment" for comments) */
  tag: string;
  /** Parsed attributes (excluding QWeb directives) */
  attributes: Record<string, string>;
  /** QWeb directives on this element */
  directives: QWebDirective[];
  /** Child nodes */
  children: QWebASTNode[];
  /** Raw text content for text nodes */
  text?: string;
  /** Source location for error reporting */
  location?: {
    line: number;
    column: number;
  };
}

/** Parse options */
export interface QWebParseOptions {
  /** Preserve whitespace (default: false) */
  preserveWhitespace?: boolean;
  /** Include source locations (default: true) */
  includeLocations?: boolean;
  /** Validate directive syntax (default: true) */
  validateDirectives?: boolean;
}

/** Parse result */
export interface QWebParseResult {
  /** Root AST node */
  ast: QWebASTNode;
  /** Template names found (from t-name attributes) */
  templateNames: string[];
  /** Directives found */
  directivesUsed: Set<QWebDirectiveType>;
  /** Parse errors (non-fatal) */
  warnings: string[];
}

// =============================================================================
// Constants
// =============================================================================

/** All recognized QWeb directive prefixes */
const DIRECTIVE_PREFIXES = [
  "t-if",
  "t-elif",
  "t-else",
  "t-foreach",
  "t-as",
  "t-set",
  "t-value",
  "t-esc",
  "t-raw",
  "t-out",
  "t-call",
  "t-field",
  "t-att-",
  "t-attf-",
  "t-att",
  "t-name",
  "t-inherit",
  "t-inherit-mode",
  "t-extend",
  "t-debug",
  "t-log",
  "t-js",
  "t-translation",
  "t-options",
  "t-tag",
  "t-portal",
  "t-cache",
  "t-nocache",
];

/** Self-closing HTML tags */
const SELF_CLOSING_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// =============================================================================
// Parser Configuration
// =============================================================================

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  // Don't process entities - let the renderer handle them
  processEntities: false,
  // Keep attribute order
  unpairedTags: Array.from(SELF_CLOSING_TAGS),
};

const builderOptions: XmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  preserveOrder: true,
  format: true,
  indentBy: "  ",
  suppressBooleanAttributes: false,
  suppressEmptyNode: false,
  unpairedTags: Array.from(SELF_CLOSING_TAGS),
};

// =============================================================================
// Directive Extraction
// =============================================================================

/**
 * Extracts QWeb directives from an attributes object
 */
function extractDirectives(
  attrs: Record<string, string>
): { directives: QWebDirective[]; remainingAttrs: Record<string, string> } {
  const directives: QWebDirective[] = [];
  const remainingAttrs: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    // Check for t-att-* and t-attf-* first (dynamic attributes)
    if (key.startsWith("t-att-")) {
      directives.push({
        type: "t-att",
        value: String(value),
        attrName: key.slice(6), // Remove "t-att-" prefix
      });
    } else if (key.startsWith("t-attf-")) {
      directives.push({
        type: "t-attf",
        value: String(value),
        attrName: key.slice(7), // Remove "t-attf-" prefix
      });
    } else if (key.startsWith("t-")) {
      // Standard directive
      const directiveType = key as QWebDirectiveType;
      directives.push({
        type: directiveType,
        value: String(value ?? ""),
      });
    } else {
      // Regular attribute
      remainingAttrs[key] = String(value);
    }
  }

  return { directives, remainingAttrs };
}

// =============================================================================
// AST Construction
// =============================================================================

/**
 * Converts fast-xml-parser output to QWeb AST
 */
function buildAST(parsed: unknown[], warnings: string[]): QWebASTNode[] {
  const nodes: QWebASTNode[] = [];

  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const obj = item as Record<string, unknown>;

    // Handle text nodes
    if ("#text" in obj) {
      const text = String(obj["#text"]);
      if (text.trim()) {
        nodes.push({
          tag: "#text",
          attributes: {},
          directives: [],
          children: [],
          text,
        });
      }
      continue;
    }

    // Handle comments
    if ("#comment" in obj) {
      nodes.push({
        tag: "#comment",
        attributes: {},
        directives: [],
        children: [],
        text: String(obj["#comment"]),
      });
      continue;
    }

    // Handle elements
    for (const [tagName, content] of Object.entries(obj)) {
      if (tagName.startsWith("#") || tagName === ":@") {
        continue;
      }

      // Get attributes from :@ property
      const attrObj = (obj as Record<string, unknown>)[":@"];
      const rawAttrs: Record<string, string> = {};

      if (attrObj && typeof attrObj === "object") {
        for (const [k, v] of Object.entries(attrObj as Record<string, unknown>)) {
          rawAttrs[k] = String(v ?? "");
        }
      }

      // Extract directives
      const { directives, remainingAttrs } = extractDirectives(rawAttrs);

      // Recursively build children
      let children: QWebASTNode[] = [];
      if (Array.isArray(content)) {
        children = buildAST(content, warnings);
      }

      nodes.push({
        tag: tagName,
        attributes: remainingAttrs,
        directives,
        children,
      });
    }
  }

  return nodes;
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse QWeb template into AST
 */
export function parseQWeb(
  template: string,
  options: QWebParseOptions = {}
): QWebParseResult {
  const warnings: string[] = [];
  const templateNames: string[] = [];
  const directivesUsed = new Set<QWebDirectiveType>();

  // Wrap template if it doesn't have a root element
  let wrappedTemplate = template.trim();
  const hasMultipleRoots =
    !wrappedTemplate.startsWith("<") ||
    (wrappedTemplate.match(/<[a-zA-Z][^>]*>/g)?.length ?? 0) > 1;

  if (hasMultipleRoots || !wrappedTemplate.startsWith("<")) {
    wrappedTemplate = `<_root_>${wrappedTemplate}</_root_>`;
  }

  // Parse XML
  const parser = new XMLParser(parserOptions);
  let parsed: unknown[];

  try {
    parsed = parser.parse(wrappedTemplate);
  } catch (error) {
    warnings.push(`XML Parse error: ${(error as Error).message}`);
    // Return a basic text node as fallback
    return {
      ast: {
        tag: "#text",
        attributes: {},
        directives: [],
        children: [],
        text: template,
      },
      templateNames,
      directivesUsed,
      warnings,
    };
  }

  // Build AST
  const astNodes = buildAST(parsed as unknown[], warnings);

  // Unwrap if we added a root
  let rootNode: QWebASTNode;
  if (hasMultipleRoots && astNodes.length === 1 && astNodes[0].tag === "_root_") {
    rootNode = {
      tag: "#fragment",
      attributes: {},
      directives: [],
      children: astNodes[0].children,
    };
  } else if (astNodes.length === 1) {
    rootNode = astNodes[0];
  } else {
    rootNode = {
      tag: "#fragment",
      attributes: {},
      directives: [],
      children: astNodes,
    };
  }

  // Collect template names and directives used
  collectMetadata(rootNode, templateNames, directivesUsed);

  return {
    ast: rootNode,
    templateNames,
    directivesUsed,
    warnings,
  };
}

/**
 * Recursively collect metadata from AST
 */
function collectMetadata(
  node: QWebASTNode,
  templateNames: string[],
  directivesUsed: Set<QWebDirectiveType>
): void {
  // Check for t-name
  const tNameDirective = node.directives.find((d) => d.type === "t-name");
  if (tNameDirective && tNameDirective.value) {
    templateNames.push(tNameDirective.value);
  }

  // Collect directive types
  for (const directive of node.directives) {
    directivesUsed.add(directive.type);
  }

  // Recurse into children
  for (const child of node.children) {
    collectMetadata(child, templateNames, directivesUsed);
  }
}

// =============================================================================
// AST to HTML Serialization
// =============================================================================

/**
 * Serialize AST node back to HTML string
 */
export function serializeAST(node: QWebASTNode): string {
  if (node.tag === "#text") {
    return node.text ?? "";
  }

  if (node.tag === "#comment") {
    return `<!-- ${node.text ?? ""} -->`;
  }

  if (node.tag === "#fragment") {
    return node.children.map(serializeAST).join("");
  }

  // Build attributes string
  const attrParts: string[] = [];

  // Add regular attributes
  for (const [key, value] of Object.entries(node.attributes)) {
    attrParts.push(`${key}="${escapeAttr(value)}"`);
  }

  // Add directives back (for debugging/output)
  for (const directive of node.directives) {
    if (directive.attrName) {
      // t-att-* or t-attf-*
      const prefix = directive.type === "t-attf" ? "t-attf-" : "t-att-";
      attrParts.push(`${prefix}${directive.attrName}="${escapeAttr(directive.value)}"`);
    } else {
      attrParts.push(`${directive.type}="${escapeAttr(directive.value)}"`);
    }
  }

  const attrsStr = attrParts.length > 0 ? " " + attrParts.join(" ") : "";

  // Self-closing tags
  if (SELF_CLOSING_TAGS.has(node.tag.toLowerCase()) && node.children.length === 0) {
    return `<${node.tag}${attrsStr}/>`;
  }

  // Regular tags
  const childrenStr = node.children.map(serializeAST).join("");
  return `<${node.tag}${attrsStr}>${childrenStr}</${node.tag}>`;
}

/**
 * Escape attribute value
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =============================================================================
// AST Utilities
// =============================================================================

/**
 * Find all nodes matching a predicate
 */
export function findNodes(
  root: QWebASTNode,
  predicate: (node: QWebASTNode) => boolean
): QWebASTNode[] {
  const results: QWebASTNode[] = [];

  function walk(node: QWebASTNode): void {
    if (predicate(node)) {
      results.push(node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return results;
}

/**
 * Find nodes with a specific directive
 */
export function findNodesWithDirective(
  root: QWebASTNode,
  directiveType: QWebDirectiveType
): QWebASTNode[] {
  return findNodes(root, (node) =>
    node.directives.some((d) => d.type === directiveType)
  );
}

/**
 * Get directive value from a node
 */
export function getDirectiveValue(
  node: QWebASTNode,
  directiveType: QWebDirectiveType
): string | undefined {
  const directive = node.directives.find((d) => d.type === directiveType);
  return directive?.value;
}

/**
 * Check if node has a directive
 */
export function hasDirective(
  node: QWebASTNode,
  directiveType: QWebDirectiveType
): boolean {
  return node.directives.some((d) => d.type === directiveType);
}

/**
 * Transform AST with a visitor function
 */
export function transformAST(
  root: QWebASTNode,
  visitor: (node: QWebASTNode) => QWebASTNode | null
): QWebASTNode | null {
  const transformed = visitor(root);
  if (transformed === null) {
    return null;
  }

  // Transform children
  transformed.children = transformed.children
    .map((child) => transformAST(child, visitor))
    .filter((child): child is QWebASTNode => child !== null);

  return transformed;
}

/**
 * Clone an AST node (deep copy)
 */
export function cloneNode(node: QWebASTNode): QWebASTNode {
  return {
    tag: node.tag,
    attributes: { ...node.attributes },
    directives: node.directives.map((d) => ({ ...d })),
    children: node.children.map(cloneNode),
    text: node.text,
    location: node.location ? { ...node.location } : undefined,
  };
}

// =============================================================================
// Exports
// =============================================================================

const qwebParser = {
  parseQWeb,
  serializeAST,
  findNodes,
  findNodesWithDirective,
  getDirectiveValue,
  hasDirective,
  transformAST,
  cloneNode,
};

export default qwebParser;
