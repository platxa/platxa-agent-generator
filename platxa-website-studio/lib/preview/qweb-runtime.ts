/**
 * QWeb Runtime Simulator
 *
 * Simulates Odoo's QWeb template engine for standalone preview.
 * Renders t-foreach, t-if, t-call, and other directives with
 * sample data for realistic preview experience.
 */

/**
 * Context data available to templates
 */
export interface QWebContext {
  [key: string]: unknown;
  website?: {
    name: string;
    company_id?: { name: string; phone?: string; email?: string };
  };
  res_company?: { name: string; logo?: string };
  request?: { env: Record<string, unknown> };
}

/**
 * Template registry for t-call resolution
 */
export type TemplateRegistry = Map<string, string>;

/**
 * Sample data generators for common Odoo models
 */
const SAMPLE_DATA: Record<string, () => unknown[]> = {
  // Products
  products: () => [
    { id: 1, name: "Premium Widget", price: 99.99, image: "/web/image/product/1", description: "High-quality widget for professionals" },
    { id: 2, name: "Basic Widget", price: 49.99, image: "/web/image/product/2", description: "Affordable everyday widget" },
    { id: 3, name: "Pro Widget Plus", price: 149.99, image: "/web/image/product/3", description: "Advanced features for power users" },
  ],

  // Blog posts
  blog_posts: () => [
    { id: 1, name: "Getting Started Guide", subtitle: "Everything you need to know", author: "John Doe", date: "2024-01-15" },
    { id: 2, name: "Advanced Tips & Tricks", subtitle: "Level up your skills", author: "Jane Smith", date: "2024-01-20" },
    { id: 3, name: "Industry Best Practices", subtitle: "Learn from the experts", author: "Bob Wilson", date: "2024-01-25" },
  ],

  // Team members
  team: () => [
    { id: 1, name: "Alice Johnson", job_title: "CEO", image: "/web/image/employee/1", email: "alice@company.com" },
    { id: 2, name: "Bob Smith", job_title: "CTO", image: "/web/image/employee/2", email: "bob@company.com" },
    { id: 3, name: "Carol Williams", job_title: "Designer", image: "/web/image/employee/3", email: "carol@company.com" },
  ],

  // Testimonials
  testimonials: () => [
    { id: 1, author: "Happy Customer", company: "Tech Corp", text: "Amazing product! Highly recommended.", rating: 5 },
    { id: 2, author: "Satisfied User", company: "Startup Inc", text: "Great value for money.", rating: 4 },
    { id: 3, author: "Power User", company: "Enterprise Ltd", text: "Exceeded our expectations.", rating: 5 },
  ],

  // Menu items
  menu_items: () => [
    { id: 1, name: "Home", url: "/" },
    { id: 2, name: "About", url: "/about" },
    { id: 3, name: "Services", url: "/services" },
    { id: 4, name: "Contact", url: "/contact" },
  ],

  // Features
  features: () => [
    { id: 1, name: "Fast Performance", icon: "fa-bolt", description: "Lightning-fast load times" },
    { id: 2, name: "Secure", icon: "fa-shield", description: "Enterprise-grade security" },
    { id: 3, name: "Scalable", icon: "fa-expand", description: "Grows with your business" },
  ],

  // Pricing plans
  pricing: () => [
    { id: 1, name: "Starter", price: 9, period: "month", features: ["5 Users", "10GB Storage", "Email Support"] },
    { id: 2, name: "Professional", price: 29, period: "month", features: ["25 Users", "100GB Storage", "Priority Support"], popular: true },
    { id: 3, name: "Enterprise", price: 99, period: "month", features: ["Unlimited Users", "1TB Storage", "24/7 Support"] },
  ],

  // Generic items
  items: () => [
    { id: 1, name: "Item 1", value: "Value 1" },
    { id: 2, name: "Item 2", value: "Value 2" },
    { id: 3, name: "Item 3", value: "Value 3" },
  ],

  // Numbers for counters
  numbers: () => [1, 2, 3, 4, 5],
};

/**
 * Get sample data for a given expression
 */
function getSampleData(expr: string): unknown[] {
  // Try to match known data patterns
  const lowerExpr = expr.toLowerCase();

  for (const [key, generator] of Object.entries(SAMPLE_DATA)) {
    if (lowerExpr.includes(key) || lowerExpr.includes(key.replace("_", ""))) {
      return generator();
    }
  }

  // Default to generic items
  return SAMPLE_DATA.items();
}

/**
 * QWeb Runtime class
 */
export class QWebRuntime {
  private context: QWebContext;
  private templates: TemplateRegistry = new Map();
  private maxDepth: number = 10;
  private currentDepth: number = 0;

  constructor(initialContext?: Partial<QWebContext>) {
    this.context = {
      // Default Odoo website context
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
  render(template: string): string {
    if (this.currentDepth >= this.maxDepth) {
      return "<!-- Max template depth exceeded -->";
    }

    this.currentDepth++;
    let html = template;

    try {
      // Process in order of dependency
      html = this.processVariables(html);
      html = this.processForeach(html);
      html = this.processConditions(html);
      html = this.processCalls(html);
      html = this.processOutput(html);
      html = this.processAttributes(html);
      html = this.cleanupDirectives(html);
    } finally {
      this.currentDepth--;
    }

    return html;
  }

  /**
   * Process t-set variables
   */
  private processVariables(html: string): string {
    // t-set with t-value attribute
    const setValueRegex = /<t\s+t-set="(\w+)"\s+t-value="([^"]+)"[^>]*\/?>/g;
    html = html.replace(setValueRegex, (match, name, value) => {
      this.context[name] = this.evaluateExpression(value);
      return "";
    });

    // t-set with content
    const setContentRegex = /<t\s+t-set="(\w+)"[^>]*>([\s\S]*?)<\/t>/g;
    html = html.replace(setContentRegex, (match, name, content) => {
      this.context[name] = content;
      return "";
    });

    return html;
  }

  /**
   * Process t-foreach loops
   */
  private processForeach(html: string): string {
    // Match t-foreach on any element
    const foreachRegex = /<(\w+)([^>]*?)\s+t-foreach="([^"]+)"\s+t-as="(\w+)"([^>]*)>([\s\S]*?)<\/\1>/g;

    let result = html;
    let match;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while ((match = foreachRegex.exec(html)) !== null && iterations < maxIterations) {
      iterations++;
      const [fullMatch, tag, attrsBefore, expr, varName, attrsAfter, content] = match;

      // Get sample data
      const items = getSampleData(expr);
      const itemCount = items.length;

      // Generate items
      const renderedItems = items.map((item, index) => {
        // Create loop variables
        const loopVars: Record<string, unknown> = {
          [`${varName}`]: item,
          [`${varName}_index`]: index,
          [`${varName}_first`]: index === 0,
          [`${varName}_last`]: index === itemCount - 1,
          [`${varName}_even`]: index % 2 === 0,
          [`${varName}_odd`]: index % 2 === 1,
          [`${varName}_value`]: item,
          [`${varName}_size`]: itemCount,
        };

        // Temporarily add loop vars to context
        const oldContext = { ...this.context };
        Object.assign(this.context, loopVars);

        // Render item content
        let itemHtml = this.render(content);

        // Replace variable references in content
        itemHtml = this.replaceVariables(itemHtml, varName, item, index);

        // Restore context
        this.context = oldContext;

        // Wrap in container with data attribute for preview
        const cleanAttrs = (attrsBefore + attrsAfter)
          .replace(/\s+t-[\w-]+="[^"]*"/g, "")
          .trim();

        return `<${tag} ${cleanAttrs} data-preview-loop-item="${index + 1}">${itemHtml}</${tag}>`;
      }).join("\n");

      // Replace the foreach block
      result = result.replace(
        fullMatch,
        `<!-- foreach: ${expr} as ${varName} (${itemCount} items) -->\n${renderedItems}`
      );

      // Reset regex
      foreachRegex.lastIndex = 0;
      html = result;
    }

    return result;
  }

  /**
   * Replace variable references in content
   */
  private replaceVariables(content: string, varName: string, item: unknown, index: number): string {
    let result = content;

    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;

      // Replace property access: item.name, item.price, etc.
      for (const [key, value] of Object.entries(obj)) {
        const patterns = [
          new RegExp(`\\$\\{${varName}\\.${key}\\}`, "g"),
          new RegExp(`#{${varName}\\.${key}}`, "g"),
          new RegExp(`t-esc="${varName}\\.${key}"`, "g"),
        ];

        const displayValue = this.formatValue(value);

        patterns.forEach((pattern) => {
          result = result.replace(pattern, displayValue);
        });

        // Also handle t-field
        result = result.replace(
          new RegExp(`t-field="${varName}\\.${key}"`, "g"),
          `data-field="${key}"`
        );
      }
    }

    // Replace loop index variables
    result = result.replace(new RegExp(`${varName}_index`, "g"), String(index));
    result = result.replace(new RegExp(`${varName}_first`, "g"), String(index === 0));
    result = result.replace(new RegExp(`${varName}_last`, "g"), "false");

    return result;
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") {
      // Format as currency if it looks like a price
      if (value % 1 !== 0) {
        return `$${value.toFixed(2)}`;
      }
      return String(value);
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }

  /**
   * Process t-if/t-elif/t-else conditions
   */
  private processConditions(html: string): string {
    // For preview, show all conditional content with visual indicators
    // This helps designers see all possible states

    // t-if
    html = html.replace(
      /(<\w+[^>]*)\s+t-if="([^"]+)"([^>]*>)/g,
      '$1 data-preview-if="$2"$3'
    );

    // t-elif
    html = html.replace(
      /(<\w+[^>]*)\s+t-elif="([^"]+)"([^>]*>)/g,
      '$1 data-preview-elif="$2"$3'
    );

    // t-else (with or without value)
    html = html.replace(
      /(<\w+[^>]*)\s+t-else(?:="[^"]*")?([^>]*>)/g,
      '$1 data-preview-else="true"$2'
    );

    return html;
  }

  /**
   * Process t-call template includes
   */
  private processCalls(html: string): string {
    // t-call with content
    const callWithContentRegex = /<t\s+t-call="([^"]+)"[^>]*>([\s\S]*?)<\/t>/g;
    html = html.replace(callWithContentRegex, (match, templateName, content) => {
      const template = this.templates.get(templateName);

      if (template) {
        // Render the called template with any passed content
        let rendered = this.render(template);
        // Replace $0 or t-raw="0" with the passed content
        rendered = rendered.replace(/<t\s+t-raw="0"[^>]*\/>/g, content);
        return rendered;
      }

      return `<div class="preview-template-call" data-template="${templateName}">
        <div class="preview-template-header">
          <span class="preview-template-icon">📄</span>
          <span class="preview-template-name">${templateName}</span>
        </div>
        ${content || '<span class="preview-template-empty">Template content</span>'}
      </div>`;
    });

    // Self-closing t-call
    const callSelfClosingRegex = /<t\s+t-call="([^"]+)"[^/]*\/>/g;
    html = html.replace(callSelfClosingRegex, (match, templateName) => {
      const template = this.templates.get(templateName);

      if (template) {
        return this.render(template);
      }

      return `<div class="preview-template-call preview-template-compact" data-template="${templateName}">
        <span class="preview-template-icon">📄</span>
        <span class="preview-template-name">${templateName}</span>
      </div>`;
    });

    return html;
  }

  /**
   * Process t-esc, t-raw, t-out, t-field output
   */
  private processOutput(html: string): string {
    // t-esc (escaped output)
    html = html.replace(
      /<t\s+t-esc="([^"]+)"[^/]*\/>/g,
      '<span class="preview-value" data-expr="$1">[[$1]]</span>'
    );

    // t-raw (raw HTML output)
    html = html.replace(
      /<t\s+t-raw="([^"]+)"[^/]*\/>/g,
      '<span class="preview-value preview-html" data-expr="$1">[[HTML: $1]]</span>'
    );

    // t-out (Odoo 15+ syntax)
    html = html.replace(
      /<t\s+t-out="([^"]+)"[^/]*\/>/g,
      '<span class="preview-value" data-expr="$1">[[$1]]</span>'
    );

    // t-field (model field)
    html = html.replace(
      /<(\w+)\s+t-field="([^"]+)"([^>]*)\/>/g,
      '<$1 class="preview-field" data-field="$2"$3>[[$2]]</$1>'
    );

    // Inline t-esc on elements
    html = html.replace(
      /(<\w+[^>]*)\s+t-esc="([^"]+)"([^>]*>)/g,
      '$1 data-preview-esc="$2"$3'
    );

    return html;
  }

  /**
   * Process t-att and t-attf attributes
   */
  private processAttributes(html: string): string {
    // t-attf- (formatted attributes with interpolation)
    html = html.replace(/t-attf-(\w+)="([^"]+)"/g, (match, attr, value) => {
      // Replace #{expr} and {{expr}} with placeholders
      let processed = value
        .replace(/#{([^}]+)}/g, "[[$1]]")
        .replace(/\{\{([^}]+)\}\}/g, "[[$1]]");
      return `${attr}="${processed}"`;
    });

    // t-att- (dynamic attributes)
    html = html.replace(/t-att-(\w+)="([^"]+)"/g, (match, attr, expr) => {
      const value = this.evaluateExpression(expr);
      if (typeof value === "boolean") {
        return value ? attr : "";
      }
      return `${attr}="${this.formatValue(value)}"`;
    });

    // t-att (object/dict attributes)
    html = html.replace(/\s*t-att="[^"]+"/g, "");

    return html;
  }

  /**
   * Evaluate a simple expression
   */
  private evaluateExpression(expr: string): unknown {
    // Handle simple variable access
    if (this.context[expr] !== undefined) {
      return this.context[expr];
    }

    // Handle property access like "company.name"
    const parts = expr.split(".");
    let value: unknown = this.context;
    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return `[[${expr}]]`;
      }
    }
    return value;
  }

  /**
   * Clean up remaining QWeb directives
   */
  private cleanupDirectives(html: string): string {
    // Remove remaining t-* attributes that weren't processed
    html = html.replace(/\s*t-[\w-]+="[^"]*"/g, "");

    // Clean up empty <t> wrapper tags
    html = html.replace(/<t\s*>([\s\S]*?)<\/t>/g, "$1");
    html = html.replace(/<t\s*\/>/g, "");

    // Remove XML declarations
    html = html.replace(/<\?xml[^?]*\?>/g, "");

    // Remove odoo root tags
    html = html.replace(/<\/?odoo[^>]*>/g, "");

    // Remove template wrapper tags (keep content)
    html = html.replace(/<template[^>]*>([\s\S]*?)<\/template>/g, "$1");

    return html;
  }

  /**
   * Reset the runtime state
   */
  reset(): void {
    this.templates.clear();
    this.currentDepth = 0;
  }
}

/**
 * Create a QWebRuntime with default Odoo context
 */
export function createQWebRuntime(context?: Partial<QWebContext>): QWebRuntime {
  return new QWebRuntime(context);
}

/**
 * Render QWeb template with default runtime
 */
export function renderQWeb(template: string, context?: Partial<QWebContext>): string {
  const runtime = createQWebRuntime(context);
  return runtime.render(template);
}
