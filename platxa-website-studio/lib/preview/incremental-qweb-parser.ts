/**
 * Incremental QWeb Parser
 *
 * Parses streaming QWeb content incrementally, handling incomplete
 * tags and partial content gracefully for real-time preview.
 */

export interface ParseResult {
  completedHtml: string;
  partialHtml: string;
  isComplete: boolean;
  templateCount: number;
  errors: string[];
}

/**
 * Self-closing HTML tags that don't need closing tags
 */
const SELF_CLOSING_TAGS = new Set([
  "br", "hr", "img", "input", "meta", "link", "area", "base",
  "col", "embed", "param", "source", "track", "wbr"
]);

/**
 * QWeb directives that we process
 */
const QWEB_DIRECTIVES = [
  "t-if", "t-elif", "t-else", "t-foreach", "t-as",
  "t-esc", "t-raw", "t-out", "t-call", "t-set", "t-value",
  "t-att", "t-attf-"
];

/**
 * Parse streaming QWeb content incrementally
 * Handles incomplete tags and partial content gracefully
 */
export class IncrementalQWebParser {
  private buffer: string = "";
  private completedTemplates: string[] = [];
  private partialTemplate: string = "";
  private templateCount: number = 0;
  private errors: string[] = [];

  /**
   * Add new chunk to buffer and extract complete templates
   */
  addChunk(chunk: string): ParseResult {
    this.buffer += chunk;
    this.errors = [];

    // Try to extract complete XML/HTML blocks
    this.extractTemplates();

    // Process the completed templates
    const processedHtml = this.processTemplates(this.completedTemplates.join("\n"));

    // Sanitize partial content for preview
    const sanitizedPartial = this.sanitizePartial(this.partialTemplate);

    return {
      completedHtml: processedHtml,
      partialHtml: this.processTemplates(sanitizedPartial),
      isComplete: this.buffer.length === 0 && this.partialTemplate.length === 0,
      templateCount: this.templateCount,
      errors: this.errors,
    };
  }

  /**
   * Extract complete templates from buffer
   */
  private extractTemplates(): void {
    // Look for complete <template> blocks
    const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/g;
    let match;
    let lastIndex = 0;

    while ((match = templateRegex.exec(this.buffer)) !== null) {
      this.completedTemplates.push(match[1]);
      this.templateCount++;
      lastIndex = match.index + match[0].length;
    }

    // Also extract content from code blocks (```xml ... ```)
    const codeBlockRegex = /```(?:xml|html)([\s\S]*?)```/g;
    while ((match = codeBlockRegex.exec(this.buffer)) !== null) {
      const content = match[1].trim();
      if (content && !this.completedTemplates.includes(content)) {
        // Extract inner content from the XML
        const innerHtml = this.extractHtmlContent(content);
        if (innerHtml) {
          this.completedTemplates.push(innerHtml);
          this.templateCount++;
        }
      }
      lastIndex = Math.max(lastIndex, match.index + match[0].length);
    }

    // Keep remaining as partial
    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    // Check for partial template or code block
    const partialTemplateStart = this.buffer.lastIndexOf("<template");
    const partialCodeBlock = this.buffer.lastIndexOf("```xml");
    const partialHtmlBlock = this.buffer.lastIndexOf("```html");

    if (partialTemplateStart !== -1) {
      this.partialTemplate = this.buffer.slice(partialTemplateStart);
    } else if (partialCodeBlock !== -1) {
      this.partialTemplate = this.buffer.slice(partialCodeBlock + 6); // Skip ```xml
    } else if (partialHtmlBlock !== -1) {
      this.partialTemplate = this.buffer.slice(partialHtmlBlock + 7); // Skip ```html
    } else {
      // Look for any HTML-like content
      const htmlStart = this.buffer.indexOf("<");
      if (htmlStart !== -1) {
        this.partialTemplate = this.buffer.slice(htmlStart);
      } else {
        this.partialTemplate = "";
      }
    }
  }

  /**
   * Extract HTML content from XML wrapper
   */
  private extractHtmlContent(xml: string): string {
    // Remove XML declaration
    let content = xml.replace(/<\?xml[^?]*\?>/g, "");

    // Remove <odoo> wrapper
    content = content.replace(/<odoo[^>]*>/g, "").replace(/<\/odoo>/g, "");

    // Extract template content
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      return templateMatch[1];
    }

    // Return cleaned content if no template wrapper
    return content.trim();
  }

  /**
   * Process QWeb templates for preview display
   */
  private processTemplates(html: string): string {
    if (!html.trim()) return "";

    let processed = html;

    // Remove t-call to website.layout (we wrap content ourselves)
    processed = processed.replace(/<t\s+t-call=["']website\.layout["'][^>]*>/g, "");
    processed = processed.replace(/<\/t>/g, "");

    // Process t-foreach (show sample items)
    processed = this.processForeach(processed);

    // Process t-if/t-else (show all content with indicators)
    processed = this.processConditions(processed);

    // Process t-esc/t-raw/t-out (show placeholders)
    processed = this.processOutput(processed);

    // Process t-call (show template references)
    processed = this.processCalls(processed);

    // Process t-att attributes
    processed = this.processAttributes(processed);

    // Clean up remaining t-* attributes
    processed = this.cleanupDirectives(processed);

    return processed;
  }

  /**
   * Process t-foreach loops
   */
  private processForeach(html: string): string {
    const foreachRegex = /<(\w+)([^>]*)\s+t-foreach="([^"]+)"\s+t-as="(\w+)"([^>]*)>([\s\S]*?)<\/\1>/g;

    return html.replace(foreachRegex, (match, tag, attrsBefore, expr, varName, attrsAfter, content) => {
      // Generate 3 sample items
      const items = [1, 2, 3];
      const result = items.map((i, index) => {
        let itemContent = content;
        // Replace variable references
        itemContent = itemContent.replace(new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, "g"), `Item ${i}`);
        itemContent = itemContent.replace(new RegExp(`${varName}_index`, "g"), String(index));
        itemContent = itemContent.replace(new RegExp(`${varName}_first`, "g"), String(index === 0));
        itemContent = itemContent.replace(new RegExp(`${varName}_last`, "g"), String(index === items.length - 1));
        return `<${tag}${attrsBefore}${attrsAfter} data-preview-foreach="${expr}">${itemContent}</${tag}>`;
      }).join("\n");

      return `<!-- foreach: ${expr} as ${varName} -->\n${result}`;
    });
  }

  /**
   * Process t-if/t-elif/t-else conditions
   */
  private processConditions(html: string): string {
    // Mark conditional elements with data attributes (show all in preview)
    html = html.replace(/\s+t-if="([^"]+)"/g, ' data-preview-condition="if: $1"');
    html = html.replace(/\s+t-elif="([^"]+)"/g, ' data-preview-condition="elif: $1"');
    html = html.replace(/\s+t-else(="[^"]*")?/g, ' data-preview-condition="else"');
    return html;
  }

  /**
   * Process t-esc, t-raw, t-out output
   */
  private processOutput(html: string): string {
    // t-esc: escaped output
    html = html.replace(
      /<t\s+t-esc="([^"]+)"[^/]*\/>/g,
      '<span class="preview-placeholder" data-field="$1">[$1]</span>'
    );

    // t-raw: raw HTML output
    html = html.replace(
      /<t\s+t-raw="([^"]+)"[^/]*\/>/g,
      '<span class="preview-placeholder preview-html" data-field="$1">[HTML: $1]</span>'
    );

    // t-out: Odoo 15+ syntax
    html = html.replace(
      /<t\s+t-out="([^"]+)"[^/]*\/>/g,
      '<span class="preview-placeholder" data-field="$1">[$1]</span>'
    );

    // Inline t-esc on elements
    html = html.replace(
      /\s+t-esc="([^"]+)"/g,
      ' data-preview-value="$1"'
    );

    return html;
  }

  /**
   * Process t-call template includes
   */
  private processCalls(html: string): string {
    const callRegex = /<t\s+t-call="([^"]+)"[^>]*(?:>([\s\S]*?)<\/t>|\s*\/>)/g;

    return html.replace(callRegex, (match, templateName, content) => {
      return `<div class="preview-template-call" data-template="${templateName}">
        <span class="preview-template-label">[Template: ${templateName}]</span>
        ${content || ""}
      </div>`;
    });
  }

  /**
   * Process t-att and t-attf attributes
   */
  private processAttributes(html: string): string {
    // t-attf- (formatted attributes)
    html = html.replace(/t-attf-(\w+)="([^"]+)"/g, (match, attr, value) => {
      const processed = value.replace(/#{([^}]+)}/g, "[$1]");
      return `${attr}="${processed}"`;
    });

    // t-att- (dynamic attributes)
    html = html.replace(/t-att-(\w+)="([^"]+)"/g, (match, attr, expr) => {
      return `${attr}="[${expr}]"`;
    });

    // t-att (object attributes) - remove
    html = html.replace(/\s*t-att="[^"]+"/g, "");

    return html;
  }

  /**
   * Clean up remaining QWeb directives
   */
  private cleanupDirectives(html: string): string {
    // Remove remaining t-* attributes
    html = html.replace(/\s*t-[\w-]+="[^"]*"/g, "");

    // Clean empty <t> tags
    html = html.replace(/<t\s*>([\s\S]*?)<\/t>/g, "$1");
    html = html.replace(/<t\s*\/>/g, "");

    // Remove t-set blocks (variable declarations)
    html = html.replace(/<t\s+t-set[^>]*>[\s\S]*?<\/t>/g, "");
    html = html.replace(/<t\s+t-set[^/]*\/>/g, "");

    return html;
  }

  /**
   * Sanitize partial HTML to prevent rendering errors
   */
  private sanitizePartial(html: string): string {
    if (!html.trim()) return "";

    // Track open tags
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][\w-]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const fullMatch = match[0];
      const tagName = match[1].toLowerCase();

      if (fullMatch.startsWith("</")) {
        // Closing tag
        const lastOpen = openTags[openTags.length - 1];
        if (lastOpen === tagName) {
          openTags.pop();
        }
      } else if (!fullMatch.endsWith("/>") && !SELF_CLOSING_TAGS.has(tagName)) {
        // Opening tag (not self-closing)
        openTags.push(tagName);
      }
    }

    // Close remaining open tags
    let sanitized = html;
    while (openTags.length > 0) {
      const tag = openTags.pop()!;
      sanitized += `</${tag}>`;
    }

    // Remove incomplete tags at the end
    sanitized = sanitized.replace(/<[^>]*$/, "");

    return sanitized;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = "";
    this.completedTemplates = [];
    this.partialTemplate = "";
    this.templateCount = 0;
    this.errors = [];
  }

  /**
   * Get current state for debugging
   */
  getState(): {
    bufferLength: number;
    completedCount: number;
    partialLength: number;
  } {
    return {
      bufferLength: this.buffer.length,
      completedCount: this.completedTemplates.length,
      partialLength: this.partialTemplate.length,
    };
  }
}

/**
 * Utility function to detect if content looks like QWeb
 */
export function isQWebContent(content: string): boolean {
  return QWEB_DIRECTIVES.some(directive => content.includes(directive));
}

/**
 * Utility to extract CSS from SCSS content
 */
export function extractCssFromScss(scss: string): string {
  // Basic SCSS to CSS conversion for preview
  let css = scss;

  // Extract and convert variables
  const variables: Record<string, string> = {};
  const varRegex = /\$([\w-]+):\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(scss)) !== null) {
    variables[match[1]] = match[2].trim();
  }

  // Remove variable declarations
  css = css.replace(/\$[\w-]+:\s*[^;]+;/g, "");

  // Replace variable usage with values or CSS custom properties
  for (const [name, value] of Object.entries(variables)) {
    css = css.replace(new RegExp(`\\$${name}`, "g"), value);
  }

  // Convert basic SCSS nesting (simplified)
  css = css.replace(/&:hover/g, ":hover");
  css = css.replace(/&:focus/g, ":focus");
  css = css.replace(/&:active/g, ":active");
  css = css.replace(/&\./g, ".");

  return css;
}
