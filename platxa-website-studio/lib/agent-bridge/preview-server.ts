/**
 * Theme Preview Server — QWeb Template Renderer
 *
 * Simulates Odoo QWeb rendering without a full Odoo instance.
 * Processes t-directives (t-if, t-foreach, t-esc, t-raw, t-att-, t-attf-,
 * t-set, t-call) and compiles SCSS to CSS for live preview.
 */

// =============================================================================
// Types
// =============================================================================

/** QWeb rendering context (variable bindings) */
export type QWebContext = Record<string, unknown>;

/** Result of rendering a QWeb template */
export interface RenderResult {
  /** Rendered HTML output */
  html: string;
  /** Compiled CSS (from SCSS) */
  css: string;
  /** Errors encountered during rendering */
  errors: RenderError[];
  /** Template variables used */
  usedVariables: string[];
}

export interface RenderError {
  /** Error type */
  type: "directive" | "expression" | "scss" | "template";
  /** Human-readable message */
  message: string;
  /** Source line (if known) */
  line?: number;
}

/** A registered template for t-call */
export interface TemplateRegistry {
  templates: Map<string, string>;
}

/** Preview server configuration */
export interface PreviewConfig {
  /** Default context variables */
  defaultContext: QWebContext;
  /** SCSS source files to compile */
  scssSource: string;
  /** Template registry for t-call lookups */
  registry: TemplateRegistry;
}

// =============================================================================
// Expression Evaluator (sandboxed)
// =============================================================================

/**
 * Safely evaluates a simple expression against the context.
 * Supports dot-access (a.b.c), comparisons, and basic operators.
 * Does NOT use eval() — parses a restricted subset.
 */
export function evaluateExpr(expr: string, ctx: QWebContext): unknown {
  const trimmed = expr.trim();

  // String literal
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // Boolean literals
  if (trimmed === "True" || trimmed === "true") return true;
  if (trimmed === "False" || trimmed === "false") return false;
  if (trimmed === "None" || trimmed === "null") return null;

  // not <expr>
  if (trimmed.startsWith("not ")) {
    return !evaluateExpr(trimmed.slice(4), ctx);
  }

  // Comparison operators (==, !=, <, >, <=, >=)
  const cmpMatch = trimmed.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (cmpMatch) {
    const left = evaluateExpr(cmpMatch[1], ctx);
    const right = evaluateExpr(cmpMatch[3], ctx);
    switch (cmpMatch[2]) {
      case "==": return left === right;
      case "!=": return left !== right;
      case "<": return (left as number) < (right as number);
      case ">": return (left as number) > (right as number);
      case "<=": return (left as number) <= (right as number);
      case ">=": return (left as number) >= (right as number);
    }
  }

  // "and" / "or" operators
  const andIdx = trimmed.indexOf(" and ");
  if (andIdx !== -1) {
    const left = evaluateExpr(trimmed.slice(0, andIdx), ctx);
    const right = evaluateExpr(trimmed.slice(andIdx + 5), ctx);
    return left && right;
  }
  const orIdx = trimmed.indexOf(" or ");
  if (orIdx !== -1) {
    const left = evaluateExpr(trimmed.slice(0, orIdx), ctx);
    const right = evaluateExpr(trimmed.slice(orIdx + 4), ctx);
    return left || right;
  }

  // Dot-path variable access: a.b.c
  return resolvePath(trimmed, ctx);
}

function resolvePath(path: string, ctx: QWebContext): unknown {
  const parts = path.split(".");
  let current: unknown = ctx;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// =============================================================================
// QWeb Directive Processing
// =============================================================================

// Regex for matching QWeb XML-like tags with attributes
const TAG_REGEX = /<(\w+)([^>]*?)(\/?)\s*>/g;
const CLOSE_TAG_REGEX = /<\/(\w+)\s*>/g;
const ATTR_REGEX = /([\w-]+)\s*=\s*"([^"]*)"/g;

interface ParsedTag {
  tagName: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  fullMatch: string;
}

function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  const re = new RegExp(ATTR_REGEX.source, "g");
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * Processes t-attf- (formatted attributes) replacing #{expr} with evaluated values.
 */
export function processAttfValue(template: string, ctx: QWebContext): string {
  return template.replace(/#\{([^}]+)\}/g, (_, expr) => {
    const val = evaluateExpr(expr, ctx);
    return val == null ? "" : String(val);
  });
}

/**
 * Renders a QWeb template string with the given context.
 * Processes t-if, t-foreach, t-as, t-esc, t-raw, t-set,
 * t-att-*, t-attf-*, and t-call directives.
 */
export function renderQWeb(
  template: string,
  ctx: QWebContext,
  registry?: TemplateRegistry,
  usedVars?: Set<string>,
  errors?: RenderError[],
): string {
  const vars = usedVars ?? new Set<string>();
  const errs = errors ?? [];
  let context = { ...ctx };
  let output = template;

  // Process t-set (variable assignment) — must happen first
  output = output.replace(
    /<t\s+t-set="([^"]+)"\s+t-value="([^"]+)"\s*\/?\s*>/g,
    (_, name, valueExpr) => {
      try {
        context[name] = evaluateExpr(valueExpr, context);
        vars.add(name);
      } catch (e) {
        errs.push({ type: "expression", message: `t-set error for ${name}: ${e}` });
      }
      return "";
    },
  );

  // Process t-if (conditional rendering)
  output = processConditionals(output, context, registry, vars, errs);

  // Process t-foreach
  output = processForeach(output, context, registry, vars, errs);

  // Process t-call (template inclusion)
  if (registry) {
    output = output.replace(
      /<t\s+t-call="([^"]+)"\s*\/?\s*>/g,
      (_, templateName) => {
        const sub = registry.templates.get(templateName);
        if (!sub) {
          errs.push({ type: "template", message: `Template not found: ${templateName}` });
          return `<!-- t-call: ${templateName} not found -->`;
        }
        return renderQWeb(sub, context, registry, vars, errs);
      },
    );
  }

  // Process t-esc (escaped output)
  output = output.replace(
    /<t\s+t-esc="([^"]+)"\s*\/?\s*>/g,
    (_, expr) => {
      vars.add(expr.split(".")[0]);
      try {
        const val = evaluateExpr(expr, context);
        return escapeHtml(val == null ? "" : String(val));
      } catch (e) {
        errs.push({ type: "expression", message: `t-esc error: ${e}` });
        return "";
      }
    },
  );

  // Process t-raw (unescaped output)
  output = output.replace(
    /<t\s+t-raw="([^"]+)"\s*\/?\s*>/g,
    (_, expr) => {
      vars.add(expr.split(".")[0]);
      try {
        const val = evaluateExpr(expr, context);
        return val == null ? "" : String(val);
      } catch (e) {
        errs.push({ type: "expression", message: `t-raw error: ${e}` });
        return "";
      }
    },
  );

  // Process t-attf-* attributes (string formatting)
  output = output.replace(
    /t-attf-(\w[\w-]*)="([^"]*)"/g,
    (_, attrName, template_str) => {
      return `${attrName}="${processAttfValue(template_str, context)}"`;
    },
  );

  // Process t-att-* attributes (expression evaluation)
  output = output.replace(
    /t-att-(\w[\w-]*)="([^"]*)"/g,
    (_, attrName, expr) => {
      try {
        const val = evaluateExpr(expr, context);
        vars.add(expr.split(".")[0]);
        if (val == null || val === false) return "";
        return `${attrName}="${escapeHtml(String(val))}"`;
      } catch (e) {
        errs.push({ type: "directive", message: `t-att-${attrName} error: ${e}` });
        return "";
      }
    },
  );

  // Clean up empty <t> wrapper tags
  output = output.replace(/<t\s*>/g, "").replace(/<\/t>/g, "");

  return output;
}

function processConditionals(
  template: string,
  ctx: QWebContext,
  registry: TemplateRegistry | undefined,
  vars: Set<string>,
  errs: RenderError[],
): string {
  // Match <element t-if="expr">...</element> or self-closing
  // Simple approach: process t-if on any tag
  const tIfRegex = /<(\w+)([^>]*?)\s+t-if="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/g;
  let result = template;

  result = result.replace(tIfRegex, (full, tag, pre, expr, post, inner) => {
    vars.add(expr.split(".")[0]);
    try {
      const val = evaluateExpr(expr, ctx);
      if (val) {
        const innerRendered = renderQWeb(inner, ctx, registry, vars, errs);
        return `<${tag}${pre}${post}>${innerRendered}</${tag}>`;
      }
      return "";
    } catch (e) {
      errs.push({ type: "directive", message: `t-if error: ${e}` });
      return "";
    }
  });

  // Self-closing t-if on <t> elements
  result = result.replace(
    /<t\s+t-if="([^"]+)"\s*\/>/g,
    () => "",
  );

  return result;
}

function processForeach(
  template: string,
  ctx: QWebContext,
  registry: TemplateRegistry | undefined,
  vars: Set<string>,
  errs: RenderError[],
): string {
  const foreachRegex = /<(\w+)([^>]*?)\s+t-foreach="([^"]+)"\s+t-as="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/g;

  return template.replace(foreachRegex, (_, tag, pre, listExpr, varName, post, inner) => {
    vars.add(listExpr.split(".")[0]);
    try {
      const list = evaluateExpr(listExpr, ctx);
      if (!Array.isArray(list)) {
        errs.push({ type: "directive", message: `t-foreach: ${listExpr} is not iterable` });
        return "";
      }
      return list.map((item, index) => {
        const loopCtx: QWebContext = {
          ...ctx,
          [varName]: item,
          [`${varName}_index`]: index,
          [`${varName}_first`]: index === 0,
          [`${varName}_last`]: index === list.length - 1,
          [`${varName}_size`]: list.length,
        };
        const innerRendered = renderQWeb(inner, loopCtx, registry, vars, errs);
        return `<${tag}${pre}${post}>${innerRendered}</${tag}>`;
      }).join("");
    } catch (e) {
      errs.push({ type: "directive", message: `t-foreach error: ${e}` });
      return "";
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =============================================================================
// SCSS Compilation (lightweight)
// =============================================================================

/**
 * Compiles a simplified SCSS subset to CSS.
 * Handles: variable declarations ($var: value), variable usage,
 * and basic nesting (one level).
 */
export function compileScss(source: string): { css: string; errors: RenderError[] } {
  const errors: RenderError[] = [];
  const variables = new Map<string, string>();

  // Extract variables
  const withoutVars = source.replace(
    /\$([a-zA-Z_][\w-]*)\s*:\s*([^;]+);/g,
    (_, name, value) => {
      variables.set(name, value.trim());
      return "";
    },
  );

  // Replace variable usage
  let css = withoutVars;
  for (const [name, value] of variables) {
    css = css.replace(new RegExp(`\\$${name}\\b`, "g"), value);
  }

  // Process nesting (one level deep)
  css = processNesting(css);

  // Clean up
  css = css.replace(/\n\s*\n/g, "\n").trim();

  return { css, errors };
}

function processNesting(css: string): string {
  // Match top-level selectors with nested blocks
  const blockRegex = /([^{}]+)\{([^{}]*\{[^{}]*\}[^{}]*)\}/g;

  return css.replace(blockRegex, (_, parentSelector, innerBlock) => {
    const parent = parentSelector.trim();
    let result = "";
    let parentProps = "";

    // Split inner content into nested rules and parent properties
    const nestedRegex = /([^{}]+)\{([^{}]*)\}/g;
    let remaining = innerBlock;
    let match: RegExpExecArray | null;
    const nestedRe = new RegExp(nestedRegex.source, "g");

    while ((match = nestedRe.exec(innerBlock)) !== null) {
      const childSel = match[1].trim();
      const childProps = match[2].trim();
      remaining = remaining.replace(match[0], "");

      // Handle & (parent reference)
      const fullSel = childSel.startsWith("&")
        ? parent + childSel.slice(1)
        : `${parent} ${childSel}`;

      result += `${fullSel} { ${childProps} }\n`;
    }

    // Remaining properties belong to parent
    parentProps = remaining.trim();
    if (parentProps) {
      result = `${parent} { ${parentProps} }\n` + result;
    }

    return result;
  });
}

// =============================================================================
// Preview Server
// =============================================================================

/** Creates a template registry */
export function createRegistry(): TemplateRegistry {
  return { templates: new Map() };
}

/** Registers a template by name */
export function registerTemplate(
  registry: TemplateRegistry,
  name: string,
  template: string,
): TemplateRegistry {
  const next = new Map(registry.templates);
  next.set(name, template);
  return { templates: next };
}

/** Renders a preview of a QWeb template with SCSS compilation */
export function renderPreview(
  template: string,
  context: QWebContext,
  scssSource: string = "",
  registry?: TemplateRegistry,
): RenderResult {
  const usedVars = new Set<string>();
  const errors: RenderError[] = [];

  const html = renderQWeb(template, context, registry, usedVars, errors);

  let css = "";
  if (scssSource) {
    const scssResult = compileScss(scssSource);
    css = scssResult.css;
    errors.push(...scssResult.errors);
  }

  return {
    html,
    css,
    errors,
    usedVariables: Array.from(usedVars),
  };
}
