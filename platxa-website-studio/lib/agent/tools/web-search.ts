/**
 * WebSearchTool - Search documentation and external resources
 *
 * Provides real-time web search capabilities for the agent to:
 * - Search documentation for frameworks, libraries, APIs
 * - Find code examples and solutions
 * - Research best practices and patterns
 * - Access external knowledge bases
 *
 * Feature #50: Agent Tool Expansion - WebSearchTool
 */

// =============================================================================
// Types
// =============================================================================

/** Search result item */
export interface SearchResult {
  /** Result title */
  title: string;
  /** URL to the resource */
  url: string;
  /** Snippet/description */
  snippet: string;
  /** Source domain */
  source: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Result type */
  type: "documentation" | "article" | "code" | "forum" | "video" | "other";
}

/** Search response */
export interface SearchResponse {
  /** Search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Total results found */
  totalResults: number;
  /** Search duration in ms */
  duration: number;
  /** Whether search was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/** Search options */
export interface SearchOptions {
  /** Maximum number of results */
  maxResults?: number;
  /** Filter by source domains */
  domains?: string[];
  /** Exclude domains */
  excludeDomains?: string[];
  /** Filter by result type */
  types?: SearchResult["type"][];
  /** Search language */
  language?: string;
  /** Safe search level */
  safeSearch?: "off" | "moderate" | "strict";
  /** Time range filter */
  timeRange?: "day" | "week" | "month" | "year" | "all";
}

/** Search provider configuration */
export interface SearchProviderConfig {
  /** Provider name */
  name: string;
  /** API endpoint */
  endpoint: string;
  /** Function to retrieve API key securely */
  getApiKey: () => string | undefined;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
}

/** Tool invocation request */
export interface WebSearchRequest {
  /** Search query */
  query: string;
  /** Search options */
  options?: SearchOptions;
}

/** Tool schema for AI model */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

/** Documentation domains for priority ranking */
const DOCUMENTATION_DOMAINS = [
  "docs.python.org",
  "developer.mozilla.org",
  "reactjs.org",
  "nextjs.org",
  "typescriptlang.org",
  "vuejs.org",
  "angular.io",
  "nodejs.org",
  "tailwindcss.com",
  "odoo.com/documentation",
  "github.com",
  "stackoverflow.com",
];

/** Domain to result type mapping */
const DOMAIN_TYPE_MAP: Record<string, SearchResult["type"]> = {
  "stackoverflow.com": "forum",
  "github.com": "code",
  "medium.com": "article",
  "dev.to": "article",
  "youtube.com": "video",
  "docs.": "documentation",
  "developer.": "documentation",
};

// =============================================================================
// WebSearchTool Class
// =============================================================================

/**
 * WebSearchTool provides web search capabilities for AI agents.
 *
 * @example
 * ```typescript
 * const searchTool = new WebSearchTool({
 *   name: "brave",
 *   endpoint: "https://api.search.brave.com/res/v1/web/search",
 *   getApiKey: () => process.env.BRAVE_API_KEY,
 * });
 *
 * const results = await searchTool.search("React hooks best practices");
 * console.log(results);
 * ```
 */
export class WebSearchTool {
  private name: string;
  private endpoint: string;
  private getApiKey: () => string | undefined;
  private rateLimit: number;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private rateLimitWindow: number = 60000; // 1 minute

  constructor(config: SearchProviderConfig) {
    this.name = config.name;
    this.endpoint = config.endpoint;
    this.getApiKey = config.getApiKey;
    this.rateLimit = config.rateLimit ?? 60;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the tool schema for AI model integration
   */
  getSchema(): ToolSchema {
    return {
      name: "web_search",
      description:
        "Search the web for documentation, code examples, articles, and other resources. " +
        "Use this to find information about frameworks, libraries, APIs, best practices, " +
        "and solutions to programming problems.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query. Be specific and include relevant keywords.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (1-20, default 10)",
          },
          domains: {
            type: "array",
            items: { type: "string" },
            description: "Only include results from these domains",
          },
          types: {
            type: "array",
            items: {
              type: "string",
              enum: ["documentation", "article", "code", "forum", "video", "other"],
            },
            description: "Filter by result type",
          },
        },
        required: ["query"],
      },
    };
  }

  /**
   * Execute a web search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();

    // Check rate limit
    if (!this.checkRateLimit()) {
      return {
        query,
        results: [],
        totalResults: 0,
        duration: Date.now() - startTime,
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      };
    }

    try {
      const results = await this.executeSearch(query, options);
      const rankedResults = this.rankResults(results, query);
      const filteredResults = this.filterResults(rankedResults, options);

      return {
        query,
        results: filteredResults.slice(0, options.maxResults || DEFAULT_MAX_RESULTS),
        totalResults: filteredResults.length,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        query,
        results: [],
        totalResults: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }

  /**
   * Invoke the tool (for AI agent integration)
   */
  async invoke(request: WebSearchRequest): Promise<SearchResponse> {
    return this.search(request.query, request.options);
  }

  /**
   * Search documentation specifically
   */
  async searchDocs(
    query: string,
    framework?: string
  ): Promise<SearchResponse> {
    const domains = framework
      ? this.getFrameworkDomains(framework)
      : DOCUMENTATION_DOMAINS;

    return this.search(query, {
      domains,
      types: ["documentation"],
      maxResults: 5,
    });
  }

  /**
   * Search for code examples
   */
  async searchCode(query: string, language?: string): Promise<SearchResponse> {
    const codeQuery = language
      ? `${query} ${language} code example`
      : `${query} code example`;

    return this.search(codeQuery, {
      domains: ["github.com", "stackoverflow.com", "codepen.io"],
      types: ["code", "forum"],
      maxResults: 10,
    });
  }

  /**
   * Format results for context injection
   */
  formatForContext(response: SearchResponse): string {
    if (!response.success || response.results.length === 0) {
      return `No results found for: "${response.query}"`;
    }

    const lines: string[] = [
      `## Web Search Results for: "${response.query}"`,
      "",
    ];

    response.results.forEach((result, index) => {
      lines.push(`### ${index + 1}. ${result.title}`);
      lines.push(`Source: ${result.source} | Type: ${result.type}`);
      lines.push(`URL: ${result.url}`);
      lines.push("");
      lines.push(result.snippet);
      lines.push("");
    });

    lines.push(`---`);
    lines.push(`Found ${response.totalResults} results in ${response.duration}ms`);

    return lines.join("\n");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Execute the actual search request
   */
  private async executeSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const apiKey = this.getApiKey();

    // If no API key, use mock results for development
    if (!apiKey) {
      return this.getMockResults(query, options);
    }

    // Build search URL
    const params = new URLSearchParams({
      q: query,
      count: String(options.maxResults || DEFAULT_MAX_RESULTS),
    });

    if (options.language) {
      params.set("search_lang", options.language);
    }

    if (options.safeSearch) {
      params.set("safesearch", options.safeSearch);
    }

    const response = await fetch(`${this.endpoint}?${params}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseSearchResponse(data);
  }

  /**
   * Parse provider-specific response format
   */
  private parseSearchResponse(data: Record<string, unknown>): SearchResult[] {
    // Handle Brave Search API format
    const webResults = (data.web as { results?: unknown[] })?.results || [];

    return webResults.map((result: unknown) => {
      const r = result as Record<string, unknown>;
      const url = String(r.url || "");
      const domain = this.extractDomain(url);

      return {
        title: String(r.title || ""),
        url,
        snippet: String(r.description || ""),
        source: domain,
        relevance: 0.5, // Will be recalculated in ranking
        type: this.inferResultType(url, domain),
      };
    });
  }

  /**
   * Get mock results for development/testing
   */
  private getMockResults(query: string, options: SearchOptions): SearchResult[] {
    const queryLower = query.toLowerCase();
    const mockResults: SearchResult[] = [];

    // Generate contextual mock results based on query
    if (queryLower.includes("react") || queryLower.includes("component")) {
      mockResults.push({
        title: "React Documentation - Components and Props",
        url: "https://reactjs.org/docs/components-and-props.html",
        snippet:
          "Components let you split the UI into independent, reusable pieces. " +
          "This page provides an introduction to the idea of components.",
        source: "reactjs.org",
        relevance: 0.95,
        type: "documentation",
      });
    }

    if (queryLower.includes("tailwind") || queryLower.includes("css")) {
      mockResults.push({
        title: "Tailwind CSS Documentation",
        url: "https://tailwindcss.com/docs",
        snippet:
          "A utility-first CSS framework for rapidly building custom user interfaces. " +
          "Tailwind CSS is a highly customizable, low-level CSS framework.",
        source: "tailwindcss.com",
        relevance: 0.9,
        type: "documentation",
      });
    }

    if (queryLower.includes("odoo") || queryLower.includes("theme")) {
      mockResults.push({
        title: "Odoo Theme Development Guide",
        url: "https://www.odoo.com/documentation/17.0/developer/howtos/themes.html",
        snippet:
          "Learn how to create custom themes for Odoo websites. " +
          "This guide covers theme structure, snippets, and customization options.",
        source: "odoo.com",
        relevance: 0.92,
        type: "documentation",
      });
    }

    // Add generic results if specific ones weren't added
    if (mockResults.length < 3) {
      mockResults.push({
        title: `Stack Overflow: ${query}`,
        url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
        snippet:
          "Find answers to programming questions. Stack Overflow is the largest " +
          "community of developers helping each other solve coding problems.",
        source: "stackoverflow.com",
        relevance: 0.7,
        type: "forum",
      });

      mockResults.push({
        title: `GitHub Code Search: ${query}`,
        url: `https://github.com/search?q=${encodeURIComponent(query)}&type=code`,
        snippet:
          "Search millions of repositories for code examples. " +
          "Find how other developers have solved similar problems.",
        source: "github.com",
        relevance: 0.65,
        type: "code",
      });

      mockResults.push({
        title: `MDN Web Docs`,
        url: "https://developer.mozilla.org/",
        snippet:
          "Resources for developers, by developers. " +
          "Documentation for web technologies including HTML, CSS, and JavaScript.",
        source: "developer.mozilla.org",
        relevance: 0.6,
        type: "documentation",
      });
    }

    return mockResults.slice(0, options.maxResults || DEFAULT_MAX_RESULTS);
  }

  /**
   * Rank results by relevance
   */
  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    return results
      .map((result) => {
        let score = result.relevance;

        // Boost documentation domains
        if (DOCUMENTATION_DOMAINS.some((d) => result.source.includes(d))) {
          score += 0.2;
        }

        // Boost if title contains query terms
        const titleLower = result.title.toLowerCase();
        const matchingTerms = queryTerms.filter((term) => titleLower.includes(term));
        score += matchingTerms.length * 0.1;

        // Boost documentation type
        if (result.type === "documentation") {
          score += 0.15;
        }

        return { ...result, relevance: Math.min(1, score) };
      })
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Filter results based on options
   */
  private filterResults(
    results: SearchResult[],
    options: SearchOptions
  ): SearchResult[] {
    let filtered = results;

    // Filter by domains
    if (options.domains?.length) {
      filtered = filtered.filter((r) =>
        options.domains!.some((d) => r.source.includes(d))
      );
    }

    // Exclude domains
    if (options.excludeDomains?.length) {
      filtered = filtered.filter(
        (r) => !options.excludeDomains!.some((d) => r.source.includes(d))
      );
    }

    // Filter by type
    if (options.types?.length) {
      filtered = filtered.filter((r) => options.types!.includes(r.type));
    }

    return filtered;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  /**
   * Infer result type from URL/domain
   */
  private inferResultType(url: string, domain: string): SearchResult["type"] {
    for (const [pattern, type] of Object.entries(DOMAIN_TYPE_MAP)) {
      if (domain.includes(pattern)) {
        return type;
      }
    }

    // Check URL path patterns
    if (url.includes("/docs/") || url.includes("/documentation/")) {
      return "documentation";
    }
    if (url.includes("/blog/") || url.includes("/article/")) {
      return "article";
    }

    return "other";
  }

  /**
   * Get framework-specific documentation domains
   */
  private getFrameworkDomains(framework: string): string[] {
    const frameworkDomains: Record<string, string[]> = {
      react: ["reactjs.org", "react.dev", "github.com/facebook/react"],
      vue: ["vuejs.org", "router.vuejs.org", "pinia.vuejs.org"],
      angular: ["angular.io", "material.angular.io"],
      nextjs: ["nextjs.org", "vercel.com/docs"],
      tailwind: ["tailwindcss.com", "headlessui.com"],
      odoo: ["odoo.com/documentation", "github.com/odoo"],
      python: ["docs.python.org", "pypi.org"],
      typescript: ["typescriptlang.org", "github.com/microsoft/TypeScript"],
    };

    return frameworkDomains[framework.toLowerCase()] || DOCUMENTATION_DOMAINS;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check if under limit
    if (this.requestCount >= this.rateLimit) {
      return false;
    }

    this.requestCount++;
    return true;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a WebSearchTool with Brave Search provider
 *
 * @param getApiKey - Function that returns the API key
 * @param options - Additional configuration options
 */
export function createWebSearchTool(
  getApiKey: () => string | undefined,
  options?: {
    name?: string;
    endpoint?: string;
    rateLimit?: number;
  }
): WebSearchTool {
  return new WebSearchTool({
    name: options?.name ?? "brave",
    endpoint: options?.endpoint ?? DEFAULT_ENDPOINT,
    getApiKey,
    rateLimit: options?.rateLimit ?? 60,
  });
}

export default WebSearchTool;
