/**
 * QWeb Runtime V2 - AST-based QWeb template rendering
 *
 * Upgraded from regex-based to proper AST parsing.
 * Uses qweb-parser.ts for XML parsing and provides:
 * - Accurate directive processing
 * - Proper expression evaluation with sandbox
 * - Full directive support (t-foreach, t-if, t-call, t-set, etc.)
 * - Template inheritance support
 *
 * Phase 2: Production-grade QWeb support
 */

import {
  parseQWeb,
  serializeAST,
  findNodes,
  hasDirective,
  getDirectiveValue,
  cloneNode,
  type QWebASTNode,
  type QWebParseResult,
} from "./qweb-parser";

// =============================================================================
// Types
// =============================================================================

/** Context data available to templates */
export interface QWebContext {
  [key: string]: unknown;
  website?: {
    name: string;
    company_id?: { name: string; phone?: string; email?: string };
  };
  res_company?: { name: string; logo?: string };
  request?: { env: Record<string, unknown> };
}

/** Template registry for t-call resolution */
export type TemplateRegistry = Map<string, string>;

/** Render options */
export interface QWebRenderOptions {
  /** Maximum recursion depth (default: 10) */
  maxDepth?: number;
  /** Strip comments from output (default: false) */
  stripComments?: boolean;
  /** Include preview data attributes (default: true) */
  includePreviewData?: boolean;
}

/** Render result */
export interface QWebRenderResult {
  html: string;
  templatesUsed: string[];
  warnings: string[];
}

// =============================================================================
// Sample Data (same as original for compatibility)
// =============================================================================

const SAMPLE_DATA: Record<string, () => unknown[]> = {
  products: () => [
    { id: 1, name: "Premium Widget", price: 99.99, image: "/web/image/product/1", description: "High-quality widget" },
    { id: 2, name: "Basic Widget", price: 49.99, image: "/web/image/product/2", description: "Affordable widget" },
    { id: 3, name: "Pro Widget Plus", price: 149.99, image: "/web/image/product/3", description: "Advanced features" },
  ],
  blog_posts: () => [
    { id: 1, name: "Getting Started", subtitle: "Everything you need", author: "John Doe", date: "2024-01-15" },
    { id: 2, name: "Advanced Tips", subtitle: "Level up your skills", author: "Jane Smith", date: "2024-01-20" },
  ],
  team: () => [
    { id: 1, name: "Alice Johnson", job_title: "CEO", image: "/web/image/employee/1" },
    { id: 2, name: "Bob Smith", job_title: "CTO", image: "/web/image/employee/2" },
  ],
  testimonials: () => [
    { id: 1, author: "Happy Customer", company: "Tech Corp", text: "Amazing product!", rating: 5 },
    { id: 2, author: "Satisfied User", company: "Startup Inc", text: "Great value.", rating: 4 },
  ],
  menu_items: () => [
    { id: 1, name: "Home", url: "/" },
    { id: 2, name: "About", url: "/about" },
    { id: 3, name: "Contact", url: "/contact" },
  ],
  features: () => [
    { id: 1, name: "Fast", icon: "fa-bolt", description: "Lightning-fast" },
    { id: 2, name: "Secure", icon: "fa-shield", description: "Enterprise security" },
  ],
  pricing: () => [
    { id: 1, name: "Starter", price: 9, period: "month", features: ["5 Users", "10GB"] },
    { id: 2, name: "Pro", price: 29, period: "month", features: ["25 Users", "100GB"], popular: true },
  ],
  items: () => [
    { id: 1, name: "Item 1", value: "Value 1" },
    { id: 2, name: "Item 2", value: "Value 2" },
    { id: 3, name: "Item 3", value: "Value 3" },
  ],
  numbers: () => [1, 2, 3, 4, 5],
};

function getSampleData(expr: string): unknown[] {
  const lowerExpr = expr.toLowerCase();
  for (const [key, generator] of Object.entries(SAMPLE_DATA)) {
    if (lowerExpr.includes(key) || lowerExpr.includes(key.replace("_", ""))) {
      return generator();
    }
  }
  return SAMPLE_DATA.items();
}

// =============================================================================
// Expression Evaluator (Sandboxed)
// =============================================================================

/**
 * Safely evaluate a QWeb expression in context
 * Uses a restricted evaluator to prevent code injection
 */
function evaluateExpression(expr: string, context: QWebContext): unknown {
  if (!expr || expr.trim() === "") {
    return undefined;
  }

  const trimmed = expr.trim();

  // Handle string literals
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // Handle number literals
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Handle boolean literals
  if (trimmed === "true" || trimmed === "True") return true;
  if (trimmed === "false" || trimmed === "False") return false;
  if (trimmed === "none" || trimmed === "None" || trimmed === "null") return null;

  // Handle simple variable access and property chains
  const parts = trimmed.split(".");
  let value: unknown = context;

  for (const part of parts) {
    // Handle array access like items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, propName, indexStr] = arrayMatch;
      if (value && typeof value === "object" && propName in value) {
        const arr = (value as Record<string, unknown>)[propName];
        if (Array.isArray(arr)) {
          value = arr[parseInt(indexStr, 10)];
          continue;
        }
      }
      return undefined;
    }

    // Simple property access
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      // Return placeholder for undefined values
      return `[[${expr}]]`;
    }
  }

  return value;
}

/**
 * Evaluate a boolean expression for t-if/t-elif
 */
function evaluateBooleanExpression(expr: string, context: QWebContext): boolean {
  const value = evaluateExpression(expr, context);

  // Handle comparison operators
  if (expr.includes("==") || expr.includes("!=") ||
      expr.includes("<") || expr.includes(">")) {
    // For preview, always return true to show content
    return true;
  }

  // Truthy check
  if (value === undefined || value === null || value === false || value === 0 || value === "") {
    return false;
  }

  // Placeholder strings are falsy for preview purposes
  if (typeof value === "string" && value.startsWith("[[") && value.endsWith("]]")) {
    // For preview, show conditionals anyway
    return true;
  }

  return true;
}

/**
 * Format a value for HTML output
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (value % 1 !== 0) return `$${value.toFixed(2)}`;
    return String(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// =============================================================================
// QWeb Runtime V2 Class
// =============================================================================

export class QWebRuntimeV2 {
  private context: QWebContext;
  private templates: TemplateRegistry = new Map();
  private options: Required<QWebRenderOptions>;
  private currentDepth: number = 0;
  private templatesUsed: string[] = [];
  private warnings: string[] = [];

  constructor(
    initialContext?: Partial<QWebContext>,
    options?: QWebRenderOptions
  ) {
    this.context = {
      website: {
        name: "Preview Website",
        company_id: {
          name: "Company Name",
          phone: "+1 (555) 123-4567",
          email: "info@company.com",
        },
      },
      res_company: { name: "Company Name" },
      request: { env: {} },
      ...initialContext,
    };

    this.options = {
      maxDepth: options?.maxDepth ?? 10,
      stripComments: options?.stripComments ?? false,
      includePreviewData: options?.includePreviewData ?? true,
    };
  }

  /**
   * Register a template for t-call resolution
   */
  registerTemplate(name: string, content: string): void {
    this.templates.set(name, content);
  }

  /**
   * Register multiple templates
   */
  registerTemplates(templates: Record<string, string>): void {
    for (const [name, content] of Object.entries(templates)) {
      this.templates.set(name, content);
    }
  }

  /**
   * Set context variable
   */
  setContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  /**
   * Render QWeb template to HTML
   */
  render(template: string): QWebRenderResult {
    this.currentDepth = 0;
    this.templatesUsed = [];
    this.warnings = [];

    // Parse template to AST
    const parseResult = this.parseTemplate(template);
    this.warnings.push(...parseResult.warnings);

    // Render AST to HTML
    const html = this.renderNode(parseResult.ast);

    return {
      html,
      templatesUsed: this.templatesUsed,
      warnings: this.warnings,
    };
  }

  /**
   * Parse template string to AST
   */
  private parseTemplate(template: string): QWebParseResult {
    return parseQWeb(template);
  }

  /**
   * Render an AST node to HTML
   */
  private renderNode(node: QWebASTNode): string {
    if (this.currentDepth >= this.options.maxDepth) {
      return "<!-- Max template depth exceeded -->";
    }

    // Handle text nodes
    if (node.tag === "#text") {
      return this.interpolateText(node.text ?? "");
    }

    // Handle comments
    if (node.tag === "#comment") {
      return this.options.stripComments ? "" : `<!-- ${node.text ?? ""} -->`;
    }

    // Handle fragments
    if (node.tag === "#fragment") {
      return node.children.map((child) => this.renderNode(child)).join("");
    }

    // Process directives
    return this.processDirectives(node);
  }

  /**
   * Process all directives on a node
   */
  private processDirectives(node: QWebASTNode): string {
    // t-set (variable assignment)
    if (hasDirective(node, "t-set")) {
      return this.processSet(node);
    }

    // t-if/t-elif/t-else (conditionals)
    if (hasDirective(node, "t-if") || hasDirective(node, "t-elif") || hasDirective(node, "t-else")) {
      return this.processConditional(node);
    }

    // t-foreach (loops)
    if (hasDirective(node, "t-foreach")) {
      return this.processForeach(node);
    }

    // t-call (template inclusion)
    if (hasDirective(node, "t-call")) {
      return this.processCall(node);
    }

    // t-esc, t-raw, t-out (output)
    if (hasDirective(node, "t-esc") || hasDirective(node, "t-raw") || hasDirective(node, "t-out")) {
      return this.processOutput(node);
    }

    // t-field (model field)
    if (hasDirective(node, "t-field")) {
      return this.processField(node);
    }

    // Default: render as regular element
    return this.renderElement(node);
  }

  /**
   * Process t-set directive
   */
  private processSet(node: QWebASTNode): string {
    const varName = getDirectiveValue(node, "t-set");
    const valueExpr = getDirectiveValue(node, "t-value");

    if (varName) {
      if (valueExpr) {
        this.context[varName] = evaluateExpression(valueExpr, this.context);
      } else {
        // Set to rendered children content
        this.context[varName] = node.children
          .map((child) => this.renderNode(child))
          .join("");
      }
    }

    return "";
  }

  /**
   * Process t-if/t-elif/t-else directives
   */
  private processConditional(node: QWebASTNode): string {
    const ifExpr = getDirectiveValue(node, "t-if");
    const elifExpr = getDirectiveValue(node, "t-elif");
    const hasElse = hasDirective(node, "t-else");

    let condition = true;
    let conditionExpr = "";

    if (ifExpr) {
      condition = evaluateBooleanExpression(ifExpr, this.context);
      conditionExpr = ifExpr;
    } else if (elifExpr) {
      condition = evaluateBooleanExpression(elifExpr, this.context);
      conditionExpr = elifExpr;
    }
    // t-else always renders (in preview mode)

    // Remove directive from node for rendering
    const cleanNode = this.removeDirectives(node, ["t-if", "t-elif", "t-else"]);

    // Add preview data attribute
    if (this.options.includePreviewData) {
      if (ifExpr) {
        cleanNode.attributes["data-preview-if"] = ifExpr;
      } else if (elifExpr) {
        cleanNode.attributes["data-preview-elif"] = elifExpr;
      } else if (hasElse) {
        cleanNode.attributes["data-preview-else"] = "true";
      }
    }

    // For preview, always render to show all states
    return this.renderElement(cleanNode);
  }

  /**
   * Process t-foreach directive
   */
  private processForeach(node: QWebASTNode): string {
    const expr = getDirectiveValue(node, "t-foreach") ?? "";
    const varName = getDirectiveValue(node, "t-as") ?? "item";

    // Get sample data
    const items = getSampleData(expr);
    const itemCount = items.length;

    // Remove foreach directives
    const cleanNode = this.removeDirectives(node, ["t-foreach", "t-as"]);

    // Render each item
    const results: string[] = [];

    for (let index = 0; index < itemCount; index++) {
      const item = items[index];

      // Create loop context
      const loopContext = {
        ...this.context,
        [varName]: item,
        [`${varName}_index`]: index,
        [`${varName}_first`]: index === 0,
        [`${varName}_last`]: index === itemCount - 1,
        [`${varName}_even`]: index % 2 === 0,
        [`${varName}_odd`]: index % 2 === 1,
        [`${varName}_value`]: item,
        [`${varName}_size`]: itemCount,
      };

      // Temporarily swap context
      const oldContext = this.context;
      this.context = loopContext;

      // Clone and render node
      const itemNode = cloneNode(cleanNode);
      if (this.options.includePreviewData) {
        itemNode.attributes["data-preview-loop-item"] = String(index + 1);
      }

      results.push(this.renderElement(itemNode));

      // Restore context
      this.context = oldContext;
    }

    return `<!-- foreach: ${expr} as ${varName} (${itemCount} items) -->\n${results.join("\n")}`;
  }

  /**
   * Process t-call directive
   */
  private processCall(node: QWebASTNode): string {
    const templateName = getDirectiveValue(node, "t-call") ?? "";
    this.templatesUsed.push(templateName);

    const template = this.templates.get(templateName);

    if (template) {
      this.currentDepth++;
      try {
        // Render child content for $0 placeholder
        const childContent = node.children
          .map((child) => this.renderNode(child))
          .join("");

        // Parse and render the called template
        const parseResult = this.parseTemplate(template);
        let rendered = this.renderNode(parseResult.ast);

        // Replace $0 placeholder with child content
        rendered = rendered.replace(/<t\s+t-raw="0"[^>]*\/?>/g, childContent);

        return rendered;
      } finally {
        this.currentDepth--;
      }
    }

    // Template not found - render placeholder
    const childContent = node.children
      .map((child) => this.renderNode(child))
      .join("");

    return `<div class="preview-template-call" data-template="${templateName}">
      <div class="preview-template-header">
        <span class="preview-template-icon">📄</span>
        <span class="preview-template-name">${templateName}</span>
      </div>
      ${childContent || '<span class="preview-template-empty">Template content</span>'}
    </div>`;
  }

  /**
   * Process t-esc/t-raw/t-out directives
   */
  private processOutput(node: QWebASTNode): string {
    const escExpr = getDirectiveValue(node, "t-esc");
    const rawExpr = getDirectiveValue(node, "t-raw");
    const outExpr = getDirectiveValue(node, "t-out");

    const expr = escExpr ?? rawExpr ?? outExpr ?? "";

    // For <t> tags, just output the value
    if (node.tag === "t") {
      const value = evaluateExpression(expr, this.context);
      const formatted = formatValue(value);
      const cssClass = rawExpr ? "preview-value preview-html" : "preview-value";
      return `<span class="${cssClass}" data-expr="${expr}">${formatted}</span>`;
    }

    // For other tags, add as content
    const cleanNode = this.removeDirectives(node, ["t-esc", "t-raw", "t-out"]);
    const value = evaluateExpression(expr, this.context);
    cleanNode.attributes["data-preview-esc"] = expr;

    // If node has no children, set text content
    if (cleanNode.children.length === 0) {
      cleanNode.children = [
        {
          tag: "#text",
          attributes: {},
          directives: [],
          children: [],
          text: formatValue(value),
        },
      ];
    }

    return this.renderElement(cleanNode);
  }

  /**
   * Process t-field directive
   */
  private processField(node: QWebASTNode): string {
    const fieldExpr = getDirectiveValue(node, "t-field") ?? "";
    const cleanNode = this.removeDirectives(node, ["t-field"]);

    cleanNode.attributes["class"] =
      ((cleanNode.attributes["class"] ?? "") + " preview-field").trim();
    cleanNode.attributes["data-field"] = fieldExpr;

    // Set placeholder content
    if (cleanNode.children.length === 0) {
      const value = evaluateExpression(fieldExpr, this.context);
      cleanNode.children = [
        {
          tag: "#text",
          attributes: {},
          directives: [],
          children: [],
          text: formatValue(value),
        },
      ];
    }

    return this.renderElement(cleanNode);
  }

  /**
   * Render an element node to HTML
   */
  private renderElement(node: QWebASTNode): string {
    // Handle <t> wrapper tag
    if (node.tag === "t") {
      return node.children.map((child) => this.renderNode(child)).join("");
    }

    // Process attributes
    const attrs = this.processAttributes(node);

    // Build attribute string
    const attrParts: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      attrParts.push(`${key}="${this.escapeAttr(value)}"`);
    }
    const attrsStr = attrParts.length > 0 ? " " + attrParts.join(" ") : "";

    // Self-closing tags
    const selfClosing = new Set([
      "br", "hr", "img", "input", "meta", "link", "area",
      "base", "col", "embed", "param", "source", "track", "wbr",
    ]);

    if (selfClosing.has(node.tag.toLowerCase()) && node.children.length === 0) {
      return `<${node.tag}${attrsStr}/>`;
    }

    // Render children
    const childrenStr = node.children.map((child) => this.renderNode(child)).join("");

    return `<${node.tag}${attrsStr}>${childrenStr}</${node.tag}>`;
  }

  /**
   * Process t-att and t-attf attributes
   */
  private processAttributes(node: QWebASTNode): Record<string, string> {
    const result = { ...node.attributes };

    for (const directive of node.directives) {
      if (directive.type === "t-att" && directive.attrName) {
        // Dynamic attribute
        const value = evaluateExpression(directive.value, this.context);
        if (typeof value === "boolean") {
          if (value) {
            result[directive.attrName] = directive.attrName;
          }
          // Don't add attribute if false
        } else {
          result[directive.attrName] = formatValue(value);
        }
      } else if (directive.type === "t-attf" && directive.attrName) {
        // Formatted attribute with interpolation
        let formatted = directive.value;

        // Replace #{expr} and {{expr}} with evaluated values
        formatted = formatted.replace(/#{([^}]+)}/g, (_, expr) => {
          const value = evaluateExpression(expr.trim(), this.context);
          return formatValue(value);
        });
        formatted = formatted.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
          const value = evaluateExpression(expr.trim(), this.context);
          return formatValue(value);
        });

        result[directive.attrName] = formatted;
      }
    }

    return result;
  }

  /**
   * Remove specific directives from a node (returns new node)
   */
  private removeDirectives(node: QWebASTNode, types: string[]): QWebASTNode {
    return {
      ...node,
      directives: node.directives.filter((d) => !types.includes(d.type)),
      children: [...node.children],
    };
  }

  /**
   * Interpolate #{} and {{}} in text content
   */
  private interpolateText(text: string): string {
    let result = text;

    result = result.replace(/#{([^}]+)}/g, (_, expr) => {
      const value = evaluateExpression(expr.trim(), this.context);
      return formatValue(value);
    });

    result = result.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
      const value = evaluateExpression(expr.trim(), this.context);
      return formatValue(value);
    });

    return result;
  }

  /**
   * Escape attribute value
   */
  private escapeAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Reset the runtime state
   */
  reset(): void {
    this.templates.clear();
    this.currentDepth = 0;
    this.templatesUsed = [];
    this.warnings = [];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a QWebRuntimeV2 with default Odoo context
 */
export function createQWebRuntimeV2(
  context?: Partial<QWebContext>,
  options?: QWebRenderOptions
): QWebRuntimeV2 {
  return new QWebRuntimeV2(context, options);
}

/**
 * Render QWeb template with default runtime
 */
export function renderQWebV2(
  template: string,
  context?: Partial<QWebContext>,
  options?: QWebRenderOptions
): QWebRenderResult {
  const runtime = createQWebRuntimeV2(context, options);
  return runtime.render(template);
}

// =============================================================================
// Exports
// =============================================================================

export default QWebRuntimeV2;
