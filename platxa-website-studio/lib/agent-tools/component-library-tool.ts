/**
 * ComponentLibraryTool
 *
 * Agent tool for browsing and using available Odoo website snippets and components.
 * Provides access to the snippet library with categories, properties, and usage examples.
 *
 * Features:
 * - Browse snippets by category
 * - Search snippets by name/description
 * - Get snippet properties and options
 * - Preview snippet HTML structure
 * - Get usage examples and code
 * - Snippet compatibility information
 * - Custom snippet registration
 * - Theme-aware component variants
 *
 * Feature #58: Agent Tool Expansion - ComponentLibraryTool
 */

// =============================================================================
// Types
// =============================================================================

/** Snippet categories */
export type SnippetCategory =
  | "structure"
  | "content"
  | "features"
  | "dynamic"
  | "ecommerce"
  | "social"
  | "media"
  | "text"
  | "custom";

/** Snippet option type */
export type OptionType =
  | "select"
  | "color"
  | "boolean"
  | "text"
  | "number"
  | "image"
  | "icon"
  | "padding"
  | "margin"
  | "border";

/** Snippet option definition */
export interface SnippetOption {
  name: string;
  label: string;
  type: OptionType;
  default?: unknown;
  choices?: Array<{ value: string; label: string; preview?: string }>;
  cssClass?: string;
  dataAttribute?: string;
  description?: string;
}

/** Snippet property/slot */
export interface SnippetSlot {
  name: string;
  selector: string;
  description: string;
  required: boolean;
  defaultContent?: string;
  allowedChildren?: string[];
}

/** Snippet definition */
export interface Snippet {
  id: string;
  name: string;
  description: string;
  category: SnippetCategory;
  subcategory?: string;
  thumbnail?: string;
  keywords: string[];
  htmlTemplate: string;
  scss?: string;
  javascript?: string;
  options: SnippetOption[];
  slots: SnippetSlot[];
  dependencies?: string[];
  compatibility: {
    minVersion?: string;
    maxVersion?: string;
    themes?: string[];
    modules?: string[];
  };
  usageExample?: string;
  isResponsive: boolean;
  isAnimated: boolean;
  module: string;
}

/** Snippet search result */
export interface SnippetSearchResult {
  snippet: Snippet;
  relevance: number;
  matchedKeywords: string[];
}

/** Tool configuration */
export interface ComponentLibraryToolConfig {
  /** Include built-in snippets */
  includeBuiltIn?: boolean;
  /** Include theme snippets */
  includeTheme?: boolean;
  /** Custom snippets to add */
  customSnippets?: Snippet[];
  /** Filter by modules */
  filterModules?: string[];
  /** Current Odoo version */
  odooVersion?: string;
}

// =============================================================================
// Built-in Snippet Library
// =============================================================================

const BUILT_IN_SNIPPETS: Snippet[] = [
  // Structure snippets
  {
    id: "s_banner",
    name: "Banner",
    description: "Full-width banner with background image, title, and call-to-action button",
    category: "structure",
    subcategory: "hero",
    keywords: ["banner", "hero", "header", "cover", "jumbotron", "cta"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_banner pt96 pb96" data-snippet="s_banner" data-name="Banner">
  <div class="container">
    <div class="row">
      <div class="col-lg-6">
        <h1>Your Title Here</h1>
        <p class="lead">Your subtitle or description goes here.</p>
        <a href="#" class="btn btn-primary btn-lg">Get Started</a>
      </div>
    </div>
  </div>
</section>`,
    options: [
      {
        name: "background",
        label: "Background",
        type: "select",
        choices: [
          { value: "bg-primary", label: "Primary Color" },
          { value: "bg-secondary", label: "Secondary Color" },
          { value: "bg-dark", label: "Dark" },
          { value: "bg-light", label: "Light" },
        ],
      },
      {
        name: "height",
        label: "Height",
        type: "select",
        choices: [
          { value: "pt48 pb48", label: "Small" },
          { value: "pt96 pb96", label: "Medium" },
          { value: "pt128 pb128", label: "Large" },
          { value: "o_full_screen_height", label: "Full Screen" },
        ],
      },
      {
        name: "textAlign",
        label: "Text Alignment",
        type: "select",
        choices: [
          { value: "text-start", label: "Left" },
          { value: "text-center", label: "Center" },
          { value: "text-end", label: "Right" },
        ],
      },
    ],
    slots: [
      { name: "title", selector: "h1", description: "Main title", required: true },
      { name: "subtitle", selector: ".lead", description: "Subtitle text", required: false },
      { name: "cta", selector: ".btn", description: "Call-to-action button", required: false },
    ],
    compatibility: { minVersion: "14.0" },
    usageExample: `<!-- Use the banner snippet -->
<t t-call="website.s_banner">
  <t t-set="title">Welcome to Our Site</t>
  <t t-set="subtitle">Discover our amazing products</t>
</t>`,
  },
  {
    id: "s_three_columns",
    name: "Three Columns",
    description: "Three equal columns for displaying features or content blocks",
    category: "structure",
    subcategory: "columns",
    keywords: ["columns", "grid", "features", "cards", "three"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_three_columns pt48 pb48" data-snippet="s_three_columns" data-name="Three Columns">
  <div class="container">
    <div class="row">
      <div class="col-lg-4 pt16 pb16">
        <i class="fa fa-3x fa-star text-primary mb-3"></i>
        <h3>Feature One</h3>
        <p>Description for the first feature goes here.</p>
      </div>
      <div class="col-lg-4 pt16 pb16">
        <i class="fa fa-3x fa-heart text-primary mb-3"></i>
        <h3>Feature Two</h3>
        <p>Description for the second feature goes here.</p>
      </div>
      <div class="col-lg-4 pt16 pb16">
        <i class="fa fa-3x fa-cog text-primary mb-3"></i>
        <h3>Feature Three</h3>
        <p>Description for the third feature goes here.</p>
      </div>
    </div>
  </div>
</section>`,
    options: [
      {
        name: "columnStyle",
        label: "Column Style",
        type: "select",
        choices: [
          { value: "", label: "Plain" },
          { value: "s_col_bordered", label: "Bordered" },
          { value: "s_col_cards", label: "Cards" },
        ],
      },
    ],
    slots: [
      { name: "column1", selector: ".col-lg-4:nth-child(1)", description: "First column", required: true },
      { name: "column2", selector: ".col-lg-4:nth-child(2)", description: "Second column", required: true },
      { name: "column3", selector: ".col-lg-4:nth-child(3)", description: "Third column", required: true },
    ],
    compatibility: { minVersion: "14.0" },
  },

  // Content snippets
  {
    id: "s_text_block",
    name: "Text Block",
    description: "Simple text content block with title and paragraph",
    category: "content",
    subcategory: "text",
    keywords: ["text", "paragraph", "content", "copy", "body"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_text_block pt32 pb32" data-snippet="s_text_block" data-name="Text Block">
  <div class="container">
    <div class="row">
      <div class="col-lg-8 offset-lg-2">
        <h2>Section Title</h2>
        <p>Your content goes here. This is a text block that you can use to add paragraphs of content to your page.</p>
      </div>
    </div>
  </div>
</section>`,
    options: [
      { name: "width", label: "Width", type: "select", choices: [
        { value: "col-lg-12", label: "Full" },
        { value: "col-lg-8 offset-lg-2", label: "Medium" },
        { value: "col-lg-6 offset-lg-3", label: "Narrow" },
      ]},
    ],
    slots: [
      { name: "title", selector: "h2", description: "Section title", required: false },
      { name: "content", selector: "p", description: "Text content", required: true },
    ],
    compatibility: { minVersion: "14.0" },
  },
  {
    id: "s_image_text",
    name: "Image & Text",
    description: "Side-by-side image and text content",
    category: "content",
    subcategory: "media",
    keywords: ["image", "text", "side", "media", "photo"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_image_text pt48 pb48" data-snippet="s_image_text" data-name="Image - Text">
  <div class="container">
    <div class="row align-items-center">
      <div class="col-lg-6">
        <img src="/web/image/website.s_image_text_default_image" class="img-fluid rounded" alt=""/>
      </div>
      <div class="col-lg-6 pt24 pb24">
        <h2>Your Title Here</h2>
        <p>Add your description text here. Explain your product, service, or idea in a compelling way.</p>
        <a href="#" class="btn btn-primary">Learn More</a>
      </div>
    </div>
  </div>
</section>`,
    options: [
      { name: "imagePosition", label: "Image Position", type: "select", choices: [
        { value: "order-first", label: "Left" },
        { value: "order-last", label: "Right" },
      ]},
      { name: "imageShape", label: "Image Shape", type: "select", choices: [
        { value: "", label: "Square" },
        { value: "rounded", label: "Rounded" },
        { value: "rounded-circle", label: "Circle" },
      ]},
    ],
    slots: [
      { name: "image", selector: "img", description: "Image", required: true },
      { name: "title", selector: "h2", description: "Title", required: true },
      { name: "text", selector: "p", description: "Description", required: true },
    ],
    compatibility: { minVersion: "14.0" },
  },

  // Feature snippets
  {
    id: "s_features",
    name: "Features Grid",
    description: "Grid of feature items with icons",
    category: "features",
    keywords: ["features", "grid", "icons", "services", "benefits"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_features pt48 pb48" data-snippet="s_features" data-name="Features">
  <div class="container">
    <div class="row text-center">
      <div class="col-lg-4 mb-4">
        <div class="p-4 bg-light rounded">
          <i class="fa fa-2x fa-rocket text-primary mb-3"></i>
          <h4>Fast Performance</h4>
          <p class="text-muted">Lightning fast loading times for your visitors.</p>
        </div>
      </div>
      <div class="col-lg-4 mb-4">
        <div class="p-4 bg-light rounded">
          <i class="fa fa-2x fa-shield text-primary mb-3"></i>
          <h4>Secure</h4>
          <p class="text-muted">Enterprise-grade security for your data.</p>
        </div>
      </div>
      <div class="col-lg-4 mb-4">
        <div class="p-4 bg-light rounded">
          <i class="fa fa-2x fa-support text-primary mb-3"></i>
          <h4>24/7 Support</h4>
          <p class="text-muted">Round-the-clock assistance when you need it.</p>
        </div>
      </div>
    </div>
  </div>
</section>`,
    options: [
      { name: "columns", label: "Columns", type: "select", choices: [
        { value: "col-lg-6", label: "2 Columns" },
        { value: "col-lg-4", label: "3 Columns" },
        { value: "col-lg-3", label: "4 Columns" },
      ]},
      { name: "style", label: "Style", type: "select", choices: [
        { value: "bg-light", label: "Light Background" },
        { value: "shadow-sm", label: "Shadow" },
        { value: "border", label: "Bordered" },
      ]},
    ],
    slots: [],
    compatibility: { minVersion: "14.0" },
  },

  // Dynamic snippets
  {
    id: "s_dynamic_snippet_products",
    name: "Dynamic Products",
    description: "Automatically display products from your catalog",
    category: "dynamic",
    subcategory: "ecommerce",
    keywords: ["products", "shop", "catalog", "dynamic", "ecommerce"],
    module: "website_sale",
    isResponsive: true,
    isAnimated: false,
    dependencies: ["website_sale"],
    htmlTemplate: `<section class="s_dynamic_snippet_products" data-snippet="s_dynamic_snippet_products" data-name="Products">
  <div class="container">
    <t t-call="website_sale.products_item" t-foreach="products" t-as="product"/>
  </div>
</section>`,
    options: [
      { name: "productCount", label: "Number of Products", type: "number", default: 4 },
      { name: "category", label: "Category Filter", type: "select", choices: [] },
      { name: "sortBy", label: "Sort By", type: "select", choices: [
        { value: "name", label: "Name" },
        { value: "list_price", label: "Price" },
        { value: "create_date", label: "Newest" },
        { value: "website_sequence", label: "Manual" },
      ]},
    ],
    slots: [],
    compatibility: { minVersion: "14.0", modules: ["website_sale"] },
  },
  {
    id: "s_dynamic_snippet_blog",
    name: "Dynamic Blog Posts",
    description: "Automatically display recent blog posts",
    category: "dynamic",
    subcategory: "blog",
    keywords: ["blog", "posts", "articles", "news", "dynamic"],
    module: "website_blog",
    isResponsive: true,
    isAnimated: false,
    dependencies: ["website_blog"],
    htmlTemplate: `<section class="s_dynamic_snippet_blog" data-snippet="s_dynamic_snippet_blog" data-name="Blog Posts">
  <div class="container">
    <div class="row">
      <t t-foreach="posts" t-as="post">
        <div class="col-lg-4 mb-4">
          <div class="card h-100">
            <img t-att-src="post.cover_image" class="card-img-top" alt=""/>
            <div class="card-body">
              <h5 class="card-title" t-field="post.name"/>
              <p class="card-text" t-field="post.subtitle"/>
              <a t-att-href="post.website_url" class="btn btn-link">Read More</a>
            </div>
          </div>
        </div>
      </t>
    </div>
  </div>
</section>`,
    options: [
      { name: "postCount", label: "Number of Posts", type: "number", default: 3 },
      { name: "blog", label: "Blog Filter", type: "select", choices: [] },
    ],
    slots: [],
    compatibility: { minVersion: "14.0", modules: ["website_blog"] },
  },

  // Social snippets
  {
    id: "s_social_icons",
    name: "Social Icons",
    description: "Social media icon links",
    category: "social",
    keywords: ["social", "icons", "facebook", "twitter", "linkedin", "instagram"],
    module: "website",
    isResponsive: true,
    isAnimated: false,
    htmlTemplate: `<section class="s_social_icons pt24 pb24" data-snippet="s_social_icons" data-name="Social Icons">
  <div class="container text-center">
    <a href="#" class="btn btn-outline-primary btn-lg mx-1"><i class="fa fa-facebook"></i></a>
    <a href="#" class="btn btn-outline-info btn-lg mx-1"><i class="fa fa-twitter"></i></a>
    <a href="#" class="btn btn-outline-primary btn-lg mx-1"><i class="fa fa-linkedin"></i></a>
    <a href="#" class="btn btn-outline-danger btn-lg mx-1"><i class="fa fa-instagram"></i></a>
  </div>
</section>`,
    options: [
      { name: "iconStyle", label: "Icon Style", type: "select", choices: [
        { value: "btn-outline-*", label: "Outlined" },
        { value: "btn-*", label: "Filled" },
        { value: "text-*", label: "Text Only" },
      ]},
      { name: "size", label: "Size", type: "select", choices: [
        { value: "btn-sm", label: "Small" },
        { value: "", label: "Medium" },
        { value: "btn-lg", label: "Large" },
      ]},
    ],
    slots: [],
    compatibility: { minVersion: "14.0" },
  },

  // Media snippets
  {
    id: "s_image_gallery",
    name: "Image Gallery",
    description: "Responsive image gallery with lightbox",
    category: "media",
    keywords: ["gallery", "images", "photos", "lightbox", "portfolio"],
    module: "website",
    isResponsive: true,
    isAnimated: true,
    htmlTemplate: `<section class="s_image_gallery pt48 pb48" data-snippet="s_image_gallery" data-name="Image Gallery">
  <div class="container">
    <div class="row o_gallery" data-columns="3">
      <div class="col-lg-4 mb-4">
        <a href="/web/image/website.gallery_image_1" data-lightbox="gallery">
          <img src="/web/image/website.gallery_image_1" class="img-fluid rounded" alt=""/>
        </a>
      </div>
      <div class="col-lg-4 mb-4">
        <a href="/web/image/website.gallery_image_2" data-lightbox="gallery">
          <img src="/web/image/website.gallery_image_2" class="img-fluid rounded" alt=""/>
        </a>
      </div>
      <div class="col-lg-4 mb-4">
        <a href="/web/image/website.gallery_image_3" data-lightbox="gallery">
          <img src="/web/image/website.gallery_image_3" class="img-fluid rounded" alt=""/>
        </a>
      </div>
    </div>
  </div>
</section>`,
    options: [
      { name: "columns", label: "Columns", type: "select", choices: [
        { value: "2", label: "2 Columns" },
        { value: "3", label: "3 Columns" },
        { value: "4", label: "4 Columns" },
      ]},
      { name: "imageShape", label: "Image Shape", type: "select", choices: [
        { value: "", label: "Square" },
        { value: "rounded", label: "Rounded" },
      ]},
    ],
    slots: [],
    compatibility: { minVersion: "14.0" },
  },
];

// =============================================================================
// Utilities
// =============================================================================

/**
 * Calculate search relevance
 */
function calculateRelevance(snippet: Snippet, keywords: string[]): number {
  let score = 0;
  const lowerName = snippet.name.toLowerCase();
  const lowerDesc = snippet.description.toLowerCase();
  const snippetKeywords = snippet.keywords.map((k) => k.toLowerCase());

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();

    // Name match (highest weight)
    if (lowerName.includes(lowerKeyword)) score += 10;
    if (lowerName === lowerKeyword) score += 20;

    // Keyword match (high weight)
    if (snippetKeywords.includes(lowerKeyword)) score += 8;
    if (snippetKeywords.some((k) => k.includes(lowerKeyword))) score += 4;

    // Description match (medium weight)
    if (lowerDesc.includes(lowerKeyword)) score += 2;

    // Category match
    if (snippet.category.includes(lowerKeyword)) score += 5;
  }

  return score;
}

// =============================================================================
// ComponentLibraryTool Class
// =============================================================================

/**
 * ComponentLibraryTool
 *
 * Agent tool for browsing Odoo website snippets and components
 */
export class ComponentLibraryTool {
  private config: Required<ComponentLibraryToolConfig>;
  private snippets: Map<string, Snippet> = new Map();

  constructor(config: ComponentLibraryToolConfig = {}) {
    this.config = {
      includeBuiltIn: config.includeBuiltIn ?? true,
      includeTheme: config.includeTheme ?? true,
      customSnippets: config.customSnippets || [],
      filterModules: config.filterModules || [],
      odooVersion: config.odooVersion || "17.0",
    };

    this.initializeLibrary();
  }

  /**
   * Initialize snippet library
   */
  private initializeLibrary(): void {
    // Add built-in snippets
    if (this.config.includeBuiltIn) {
      for (const snippet of BUILT_IN_SNIPPETS) {
        if (this.isCompatible(snippet)) {
          this.snippets.set(snippet.id, snippet);
        }
      }
    }

    // Add custom snippets
    for (const snippet of this.config.customSnippets) {
      this.snippets.set(snippet.id, snippet);
    }
  }

  /**
   * Check if snippet is compatible with current config
   */
  private isCompatible(snippet: Snippet): boolean {
    // Check module filter
    if (this.config.filterModules.length > 0) {
      if (!this.config.filterModules.includes(snippet.module)) {
        return false;
      }
    }

    // Check version compatibility
    const { minVersion, maxVersion } = snippet.compatibility;
    const currentVersion = parseFloat(this.config.odooVersion);

    if (minVersion && currentVersion < parseFloat(minVersion)) {
      return false;
    }
    if (maxVersion && currentVersion > parseFloat(maxVersion)) {
      return false;
    }

    return true;
  }

  /**
   * List all snippets
   */
  listSnippets(category?: SnippetCategory): Snippet[] {
    let snippets = Array.from(this.snippets.values());

    if (category) {
      snippets = snippets.filter((s) => s.category === category);
    }

    return snippets.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get snippets by category
   */
  getByCategory(): Record<SnippetCategory, Snippet[]> {
    const result: Record<SnippetCategory, Snippet[]> = {
      structure: [],
      content: [],
      features: [],
      dynamic: [],
      ecommerce: [],
      social: [],
      media: [],
      text: [],
      custom: [],
    };

    for (const snippet of this.snippets.values()) {
      result[snippet.category].push(snippet);
    }

    return result;
  }

  /**
   * Get snippet by ID
   */
  getSnippet(id: string): Snippet | null {
    return this.snippets.get(id) || null;
  }

  /**
   * Search snippets
   */
  search(query: string, options: { category?: SnippetCategory; limit?: number } = {}): SnippetSearchResult[] {
    const keywords = query.toLowerCase().split(/\s+/);
    const results: SnippetSearchResult[] = [];

    for (const snippet of this.snippets.values()) {
      // Filter by category if specified
      if (options.category && snippet.category !== options.category) {
        continue;
      }

      const relevance = calculateRelevance(snippet, keywords);
      if (relevance > 0) {
        const matchedKeywords = keywords.filter(
          (kw) =>
            snippet.name.toLowerCase().includes(kw) ||
            snippet.keywords.some((k) => k.toLowerCase().includes(kw))
        );

        results.push({ snippet, relevance, matchedKeywords });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    // Limit results
    const limit = options.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * Get snippet HTML template
   */
  getTemplate(id: string): string | null {
    const snippet = this.getSnippet(id);
    return snippet?.htmlTemplate || null;
  }

  /**
   * Get snippet options
   */
  getOptions(id: string): SnippetOption[] {
    const snippet = this.getSnippet(id);
    return snippet?.options || [];
  }

  /**
   * Get snippet slots
   */
  getSlots(id: string): SnippetSlot[] {
    const snippet = this.getSnippet(id);
    return snippet?.slots || [];
  }

  /**
   * Get usage example
   */
  getUsageExample(id: string): string | null {
    const snippet = this.getSnippet(id);
    return snippet?.usageExample || null;
  }

  /**
   * Get available categories
   */
  getCategories(): Array<{ category: SnippetCategory; count: number }> {
    const counts: Record<string, number> = {};

    for (const snippet of this.snippets.values()) {
      counts[snippet.category] = (counts[snippet.category] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([category, count]) => ({ category: category as SnippetCategory, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get snippets requiring specific module
   */
  getByModule(moduleName: string): Snippet[] {
    return Array.from(this.snippets.values()).filter(
      (s) => s.module === moduleName || s.dependencies?.includes(moduleName)
    );
  }

  /**
   * Register a custom snippet
   */
  registerSnippet(snippet: Snippet): void {
    this.snippets.set(snippet.id, snippet);
  }

  /**
   * Get snippet summary for display
   */
  getSnippetSummary(id: string): string | null {
    const snippet = this.getSnippet(id);
    if (!snippet) return null;

    return `**${snippet.name}** (${snippet.id})
Category: ${snippet.category}
Description: ${snippet.description}
Keywords: ${snippet.keywords.join(", ")}
Options: ${snippet.options.length} configurable options
Slots: ${snippet.slots.length} content slots
Responsive: ${snippet.isResponsive ? "Yes" : "No"}
Animated: ${snippet.isAnimated ? "Yes" : "No"}`;
  }

  /**
   * Get total snippet count
   */
  get count(): number {
    return this.snippets.size;
  }
}

// =============================================================================
// Factory & Agent Integration
// =============================================================================

/**
 * Create a ComponentLibraryTool instance
 */
export function createComponentLibraryTool(
  config?: ComponentLibraryToolConfig
): ComponentLibraryTool {
  return new ComponentLibraryTool(config);
}

/**
 * Tool definition for agent integration
 */
export const componentLibraryToolDefinition = {
  name: "component_library",
  description:
    "Browse and search Odoo website snippets and components. Get templates, options, and usage examples for building pages.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "search", "get", "template", "options", "slots", "categories", "byModule"],
        description: "Action to perform",
      },
      id: {
        type: "string",
        description: "Snippet ID",
      },
      query: {
        type: "string",
        description: "Search query",
      },
      category: {
        type: "string",
        enum: ["structure", "content", "features", "dynamic", "ecommerce", "social", "media", "text", "custom"],
        description: "Filter by category",
      },
      module: {
        type: "string",
        description: "Filter by module",
      },
    },
    required: ["action"],
  },
};

export default ComponentLibraryTool;
