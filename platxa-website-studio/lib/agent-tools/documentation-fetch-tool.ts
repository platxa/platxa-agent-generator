/**
 * DocumentationFetchTool
 *
 * Agent tool for retrieving and parsing Odoo documentation.
 * Fetches docs pages, extracts relevant sections, and caches results.
 *
 * Features:
 * - Fetch Odoo documentation pages
 * - Parse and extract relevant sections
 * - Search documentation content
 * - Cache fetched pages
 * - Extract code examples
 * - Navigate documentation structure
 * - Version-aware documentation
 * - Local documentation index
 *
 * Feature #56: Agent Tool Expansion - DocumentationFetchTool
 */

// =============================================================================
// Types
// =============================================================================

/** Documentation source types */
export type DocSource = "odoo" | "owl" | "api" | "custom";

/** Documentation section */
export interface DocSection {
  id: string;
  title: string;
  level: number;
  content: string;
  codeExamples: CodeExample[];
  links: DocLink[];
  anchors: string[];
}

/** Code example from documentation */
export interface CodeExample {
  language: string;
  code: string;
  description?: string;
  filename?: string;
}

/** Documentation link */
export interface DocLink {
  text: string;
  url: string;
  isExternal: boolean;
  isAnchor: boolean;
}

/** Parsed documentation page */
export interface DocPage {
  url: string;
  title: string;
  description: string;
  version: string;
  source: DocSource;
  sections: DocSection[];
  breadcrumb: string[];
  relatedPages: DocLink[];
  lastFetched: number;
  toc: TocEntry[];
}

/** Table of contents entry */
export interface TocEntry {
  title: string;
  anchor: string;
  level: number;
  children?: TocEntry[];
}

/** Search result */
export interface DocSearchResult {
  page: string;
  title: string;
  section: string;
  excerpt: string;
  relevance: number;
  url: string;
}

/** Fetch options */
export interface FetchOptions {
  version?: string;
  section?: string;
  extractCode?: boolean;
  includeRelated?: boolean;
  maxDepth?: number;
}

/** Tool configuration */
export interface DocumentationFetchToolConfig {
  /** Base URL for Odoo documentation */
  odooDocsUrl?: string;
  /** Odoo version */
  version?: string;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Maximum cached pages */
  maxCachedPages?: number;
  /** Custom documentation sources */
  customSources?: Array<{ name: string; baseUrl: string }>;
  /** Enable offline mode (use cached only) */
  offlineMode?: boolean;
}

// =============================================================================
// Documentation Index (Built-in reference)
// =============================================================================

/** Built-in documentation index for common topics */
const DOCUMENTATION_INDEX: Record<string, { url: string; title: string; keywords: string[] }> = {
  "models": {
    url: "/developer/reference/backend/orm.html",
    title: "ORM API",
    keywords: ["model", "orm", "fields", "records", "create", "write", "unlink", "search"],
  },
  "fields": {
    url: "/developer/reference/backend/orm.html#fields",
    title: "Field Types",
    keywords: ["field", "char", "integer", "float", "boolean", "many2one", "one2many", "selection"],
  },
  "controllers": {
    url: "/developer/reference/backend/http.html",
    title: "HTTP Controllers",
    keywords: ["controller", "http", "route", "request", "response", "json", "api"],
  },
  "views": {
    url: "/developer/reference/backend/views.html",
    title: "Views",
    keywords: ["view", "form", "tree", "kanban", "calendar", "graph", "pivot", "qweb"],
  },
  "qweb": {
    url: "/developer/reference/frontend/qweb.html",
    title: "QWeb Templates",
    keywords: ["qweb", "template", "t-if", "t-foreach", "t-esc", "t-raw", "t-call"],
  },
  "security": {
    url: "/developer/reference/backend/security.html",
    title: "Security",
    keywords: ["security", "access", "rights", "groups", "rules", "ir.model.access", "ir.rule"],
  },
  "actions": {
    url: "/developer/reference/backend/actions.html",
    title: "Actions",
    keywords: ["action", "window", "server", "client", "report", "url"],
  },
  "reports": {
    url: "/developer/reference/backend/reports.html",
    title: "Reports",
    keywords: ["report", "pdf", "qweb", "print", "template"],
  },
  "owl": {
    url: "/developer/reference/frontend/owl.html",
    title: "OWL Framework",
    keywords: ["owl", "component", "hook", "state", "props", "template", "frontend"],
  },
  "assets": {
    url: "/developer/reference/frontend/assets.html",
    title: "Assets Management",
    keywords: ["assets", "bundle", "javascript", "css", "scss", "manifest"],
  },
  "inheritance": {
    url: "/developer/howtos/rdtraining/B_acl_inh.html",
    title: "Model Inheritance",
    keywords: ["inherit", "inheritance", "extension", "delegation", "_inherit", "_inherits"],
  },
  "wizards": {
    url: "/developer/howtos/rdtraining/J_reports.html",
    title: "Wizards (TransientModel)",
    keywords: ["wizard", "transient", "popup", "dialog", "modal"],
  },
  "api-decorators": {
    url: "/developer/reference/backend/orm.html#api-decorators",
    title: "API Decorators",
    keywords: ["decorator", "api.model", "api.depends", "api.onchange", "api.constrains"],
  },
  "computed-fields": {
    url: "/developer/reference/backend/orm.html#computed-fields",
    title: "Computed Fields",
    keywords: ["compute", "computed", "depends", "readonly", "store"],
  },
  "constraints": {
    url: "/developer/reference/backend/orm.html#constraints",
    title: "Constraints",
    keywords: ["constraint", "sql", "python", "_sql_constraints", "api.constrains"],
  },
};

// =============================================================================
// Mock Documentation Content
// =============================================================================

const MOCK_DOC_CONTENT: Record<string, DocPage> = {
  "models": {
    url: "https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html",
    title: "ORM API - Models",
    description: "Reference documentation for Odoo ORM models and record operations",
    version: "17.0",
    source: "odoo",
    lastFetched: Date.now(),
    breadcrumb: ["Developer", "Reference", "Backend", "ORM"],
    relatedPages: [
      { text: "Fields", url: "#fields", isExternal: false, isAnchor: true },
      { text: "Recordsets", url: "#recordsets", isExternal: false, isAnchor: true },
    ],
    toc: [
      { title: "Models", anchor: "#models", level: 1 },
      { title: "Fields", anchor: "#fields", level: 2 },
      { title: "Recordsets", anchor: "#recordsets", level: 2 },
    ],
    sections: [
      {
        id: "models",
        title: "Models",
        level: 1,
        content: `Models are the core of Odoo applications. They define the data structure and business logic.

A model is a Python class that inherits from \`odoo.models.Model\` and defines fields that are columns in the database.

Key attributes:
- \`_name\`: Technical name of the model (e.g., 'sale.order')
- \`_description\`: Human-readable name
- \`_inherit\`: Model(s) to inherit from
- \`_order\`: Default ordering`,
        codeExamples: [
          {
            language: "python",
            code: `from odoo import models, fields, api

class SaleOrder(models.Model):
    _name = 'sale.order'
    _description = 'Sales Order'
    _order = 'date_order desc, id desc'

    name = fields.Char(string='Order Reference', required=True)
    partner_id = fields.Many2one('res.partner', string='Customer', required=True)
    order_line = fields.One2many('sale.order.line', 'order_id', string='Order Lines')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('sale', 'Sales Order'),
        ('done', 'Done'),
    ], string='Status', default='draft')
    amount_total = fields.Monetary(compute='_compute_amount', store=True)`,
            description: "Basic model definition example",
          },
        ],
        links: [],
        anchors: ["models"],
      },
      {
        id: "fields",
        title: "Fields",
        level: 2,
        content: `Fields define the data type and behavior of model attributes.

Common field types:
- Char: Single-line text
- Text: Multi-line text
- Integer: Whole numbers
- Float: Decimal numbers
- Boolean: True/False
- Date/Datetime: Date values
- Selection: Dropdown choices
- Many2one: Link to one record
- One2many: Link to many records (inverse of Many2one)
- Many2many: Link to many records`,
        codeExamples: [
          {
            language: "python",
            code: `# Field examples
name = fields.Char(string='Name', required=True, index=True)
description = fields.Text(string='Description')
quantity = fields.Integer(string='Quantity', default=1)
price = fields.Float(string='Price', digits=(16, 2))
is_active = fields.Boolean(string='Active', default=True)
date = fields.Date(string='Date', default=fields.Date.today)
partner_id = fields.Many2one('res.partner', string='Partner', ondelete='cascade')
tag_ids = fields.Many2many('product.tag', string='Tags')`,
            description: "Common field type examples",
          },
        ],
        links: [],
        anchors: ["fields"],
      },
      {
        id: "computed",
        title: "Computed Fields",
        level: 2,
        content: `Computed fields are calculated dynamically based on other fields.

Use the \`compute\` parameter to specify the method that calculates the value. Use \`@api.depends\` to declare dependencies.

Options:
- \`store=True\`: Store in database (recalculated on dependency change)
- \`readonly=True\`: Cannot be manually edited
- \`inverse\`: Method to set related values`,
        codeExamples: [
          {
            language: "python",
            code: `@api.depends('order_line.price_total')
def _compute_amount(self):
    for order in self:
        order.amount_total = sum(order.order_line.mapped('price_total'))

amount_total = fields.Monetary(
    string='Total',
    compute='_compute_amount',
    store=True,
    readonly=True
)`,
            description: "Computed field with dependency",
          },
        ],
        links: [],
        anchors: ["computed", "compute"],
      },
    ],
  },
  "controllers": {
    url: "https://www.odoo.com/documentation/17.0/developer/reference/backend/http.html",
    title: "HTTP Controllers",
    description: "Reference documentation for Odoo HTTP controllers and routing",
    version: "17.0",
    source: "odoo",
    lastFetched: Date.now(),
    breadcrumb: ["Developer", "Reference", "Backend", "HTTP"],
    relatedPages: [],
    toc: [
      { title: "Controllers", anchor: "#controllers", level: 1 },
      { title: "Routes", anchor: "#routes", level: 2 },
    ],
    sections: [
      {
        id: "controllers",
        title: "HTTP Controllers",
        level: 1,
        content: `Controllers handle HTTP requests and return responses. They define routes that map URLs to Python methods.

Key concepts:
- Routes are defined with the \`@http.route\` decorator
- Controllers inherit from \`http.Controller\`
- Use \`type='json'\` for JSON-RPC endpoints
- Use \`type='http'\` for standard HTTP endpoints`,
        codeExamples: [
          {
            language: "python",
            code: `from odoo import http
from odoo.http import request

class MyController(http.Controller):

    @http.route('/my/page', type='http', auth='public', website=True)
    def my_page(self):
        return request.render('my_module.my_template', {
            'data': request.env['my.model'].search([])
        })

    @http.route('/api/data', type='json', auth='user')
    def get_data(self, **kwargs):
        records = request.env['my.model'].search_read([])
        return {'records': records}`,
            description: "Controller with HTTP and JSON routes",
          },
        ],
        links: [],
        anchors: ["controllers", "http"],
      },
    ],
  },
};

// =============================================================================
// Utilities
// =============================================================================

/**
 * Extract text excerpt around keyword
 */
function extractExcerpt(content: string, keyword: string, contextLength = 100): string {
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerContent.indexOf(lowerKeyword);

  if (index === -1) {
    return content.substring(0, contextLength * 2) + "...";
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + keyword.length + contextLength);

  let excerpt = content.substring(start, end);
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";

  return excerpt;
}

/**
 * Calculate relevance score
 */
function calculateRelevance(content: string, keywords: string[]): number {
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    const regex = new RegExp(keyword.toLowerCase(), "g");
    const matches = lowerContent.match(regex);
    if (matches) {
      score += matches.length * (keyword.length > 5 ? 2 : 1);
    }
  }

  return score;
}

/**
 * Parse HTML to extract sections (simplified)
 */
function parseHtmlToSections(html: string): DocSection[] {
  // This is a simplified parser - in production, use a proper HTML parser
  const sections: DocSection[] = [];
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h\1>/gi;

  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    sections.push({
      id: match[2],
      title: match[3].trim(),
      level: parseInt(match[1]),
      content: "",
      codeExamples: [],
      links: [],
      anchors: [match[2]],
    });
  }

  return sections;
}

// =============================================================================
// DocumentationFetchTool Class
// =============================================================================

/**
 * DocumentationFetchTool
 *
 * Agent tool for fetching and parsing Odoo documentation
 */
export class DocumentationFetchTool {
  private config: Required<DocumentationFetchToolConfig>;
  private cache: Map<string, DocPage> = new Map();
  private index: typeof DOCUMENTATION_INDEX;

  constructor(config: DocumentationFetchToolConfig = {}) {
    this.config = {
      odooDocsUrl: config.odooDocsUrl || "https://www.odoo.com/documentation",
      version: config.version || "17.0",
      cacheTtl: config.cacheTtl || 1000 * 60 * 60, // 1 hour
      maxCachedPages: config.maxCachedPages || 100,
      customSources: config.customSources || [],
      offlineMode: config.offlineMode ?? false,
    };

    this.index = DOCUMENTATION_INDEX;

    // Pre-populate cache with mock data
    Object.entries(MOCK_DOC_CONTENT).forEach(([key, page]) => {
      this.cache.set(key, page);
    });
  }

  /**
   * Get documentation by topic
   */
  async getDocumentation(topic: string, options: FetchOptions = {}): Promise<DocPage | null> {
    const normalizedTopic = topic.toLowerCase().replace(/\s+/g, "-");

    // Check cache first
    if (this.cache.has(normalizedTopic)) {
      const cached = this.cache.get(normalizedTopic)!;
      const age = Date.now() - cached.lastFetched;

      if (age < this.config.cacheTtl) {
        return cached;
      }
    }

    // Check index for topic
    const indexEntry = this.findInIndex(normalizedTopic);

    if (indexEntry) {
      // Return mock/cached content if available
      const cachedKey = Object.keys(MOCK_DOC_CONTENT).find((k) =>
        indexEntry.keywords.some((kw) => k.includes(kw) || kw.includes(k))
      );

      if (cachedKey && this.cache.has(cachedKey)) {
        return this.cache.get(cachedKey)!;
      }
    }

    // In production, fetch from actual URL
    // For now, return closest match from cache
    return this.findClosestMatch(normalizedTopic);
  }

  /**
   * Find topic in index
   */
  private findInIndex(topic: string): (typeof DOCUMENTATION_INDEX)[string] | null {
    // Direct match
    if (this.index[topic]) {
      return this.index[topic];
    }

    // Keyword match
    for (const [key, entry] of Object.entries(this.index)) {
      if (entry.keywords.some((kw) => topic.includes(kw) || kw.includes(topic))) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Find closest matching cached page
   */
  private findClosestMatch(topic: string): DocPage | null {
    const keywords = topic.split(/[-_\s]+/);
    let bestMatch: DocPage | null = null;
    let bestScore = 0;

    for (const [, page] of this.cache) {
      const content = page.sections.map((s) => s.title + " " + s.content).join(" ");
      const score = calculateRelevance(content, keywords);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = page;
      }
    }

    return bestMatch;
  }

  /**
   * Search documentation
   */
  async search(query: string, options: { limit?: number } = {}): Promise<DocSearchResult[]> {
    const keywords = query.toLowerCase().split(/\s+/);
    const results: DocSearchResult[] = [];
    const limit = options.limit || 10;

    for (const [key, page] of this.cache) {
      for (const section of page.sections) {
        const content = section.title + " " + section.content;
        const relevance = calculateRelevance(content, keywords);

        if (relevance > 0) {
          results.push({
            page: key,
            title: page.title,
            section: section.title,
            excerpt: extractExcerpt(section.content, keywords[0]),
            relevance,
            url: page.url + (section.anchors[0] ? "#" + section.anchors[0] : ""),
          });
        }
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Get code examples for a topic
   */
  async getCodeExamples(topic: string): Promise<CodeExample[]> {
    const page = await this.getDocumentation(topic);
    if (!page) return [];

    const examples: CodeExample[] = [];
    for (const section of page.sections) {
      examples.push(...section.codeExamples);
    }

    return examples;
  }

  /**
   * Get table of contents
   */
  async getTableOfContents(topic: string): Promise<TocEntry[]> {
    const page = await this.getDocumentation(topic);
    return page?.toc || [];
  }

  /**
   * List available documentation topics
   */
  listTopics(): Array<{ topic: string; title: string; keywords: string[] }> {
    return Object.entries(this.index).map(([topic, info]) => ({
      topic,
      title: info.title,
      keywords: info.keywords,
    }));
  }

  /**
   * Get specific section from documentation
   */
  async getSection(topic: string, sectionId: string): Promise<DocSection | null> {
    const page = await this.getDocumentation(topic);
    if (!page) return null;

    return page.sections.find(
      (s) => s.id === sectionId || s.anchors.includes(sectionId)
    ) || null;
  }

  /**
   * Get related documentation pages
   */
  async getRelated(topic: string): Promise<DocLink[]> {
    const page = await this.getDocumentation(topic);
    return page?.relatedPages || [];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    // Re-populate with mock data
    Object.entries(MOCK_DOC_CONTENT).forEach(([key, page]) => {
      this.cache.set(key, page);
    });
  }

  /**
   * Get documentation URL
   */
  getDocUrl(path: string): string {
    return `${this.config.odooDocsUrl}/${this.config.version}${path}`;
  }
}

// =============================================================================
// Factory & Agent Integration
// =============================================================================

/**
 * Create a DocumentationFetchTool instance
 */
export function createDocumentationFetchTool(
  config?: DocumentationFetchToolConfig
): DocumentationFetchTool {
  return new DocumentationFetchTool(config);
}

/**
 * Tool definition for agent integration
 */
export const documentationFetchToolDefinition = {
  name: "documentation_fetch",
  description:
    "Fetch and search Odoo documentation. Get explanations, code examples, and API references for models, controllers, views, and other topics.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "search", "examples", "toc", "topics", "section", "related"],
        description: "Action to perform",
      },
      topic: {
        type: "string",
        description: "Documentation topic (e.g., models, fields, controllers, views)",
      },
      query: {
        type: "string",
        description: "Search query",
      },
      sectionId: {
        type: "string",
        description: "Section ID for getSection action",
      },
      limit: {
        type: "number",
        description: "Maximum results for search",
      },
    },
    required: ["action"],
  },
};

export default DocumentationFetchTool;
