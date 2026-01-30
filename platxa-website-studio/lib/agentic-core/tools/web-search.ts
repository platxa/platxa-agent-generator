/**
 * Web Search Tool - Fetches Odoo documentation and examples from the web
 *
 * Features:
 * - Returns top 5 search results by default
 * - Supports site: filtering (e.g., site:odoo.com)
 * - Caches results for repeated queries
 * - Provides relevant metadata (title, URL, snippet, relevance score)
 * - Production-grade error handling with timeouts
 *
 * @module agentic-core/tools/web-search
 */

import type { ToolParams, ToolResult } from '../tool-executor';

// ============================================================================
// Types
// ============================================================================

/** Individual search result */
export interface SearchResult {
  /** Result title */
  title: string;
  /** Full URL */
  url: string;
  /** Text snippet/description */
  snippet: string;
  /** Source domain */
  domain: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Result position (1-indexed) */
  position: number;
}

/** Options for web search */
export interface WebSearchOptions {
  /** Search query */
  query: string;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
  /** Site filter (e.g., "odoo.com") */
  site?: string;
  /** Search timeout in ms (default: 10000) */
  timeout?: number;
  /** Language preference (default: "en") */
  language?: string;
  /** Include only documentation pages */
  docsOnly?: boolean;
}

/** Result from web search */
export interface WebSearchResult {
  /** Original query */
  query: string;
  /** Effective query after site filter applied */
  effectiveQuery: string;
  /** Search results */
  results: SearchResult[];
  /** Total results found (estimated) */
  totalResults: number;
  /** Whether results were limited */
  limited: boolean;
  /** Search metadata */
  metadata: {
    /** Time taken for search in ms */
    searchTime: number;
    /** Site filter if applied */
    siteFilter?: string;
    /** Source of results */
    source: 'api' | 'cache' | 'fallback';
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum results */
const DEFAULT_MAX_RESULTS = 5;

/** Default search timeout (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/** Odoo documentation domains for prioritization */
const ODOO_DOCS_DOMAINS = [
  'odoo.com/documentation',
  'odoo.com/page/docs',
  'github.com/odoo',
  'odoo.github.io',
];

/** Common Odoo documentation patterns */
const ODOO_DOC_PATTERNS = [
  { pattern: /qweb|t-foreach|t-if|t-esc|t-raw|t-call/i, boost: 0.3 },
  { pattern: /odoo\s+\d+\.0/i, boost: 0.2 },
  { pattern: /owl|webclient|views|models|fields/i, boost: 0.15 },
  { pattern: /documentation|tutorial|guide|reference/i, boost: 0.1 },
];

// ============================================================================
// Search Result Cache
// ============================================================================

interface CacheEntry {
  result: WebSearchResult;
  timestamp: number;
}

/** Simple in-memory cache for search results */
const searchCache = new Map<string, CacheEntry>();

/** Cache TTL (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get cached result if valid
 */
function getCachedResult(cacheKey: string): WebSearchResult | null {
  const entry = searchCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    searchCache.delete(cacheKey);
    return null;
  }

  return entry.result;
}

/**
 * Cache a search result
 */
function cacheResult(cacheKey: string, result: WebSearchResult): void {
  // Limit cache size
  if (searchCache.size >= 100) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }

  searchCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Generate cache key from options
 */
function getCacheKey(options: WebSearchOptions): string {
  return JSON.stringify({
    query: options.query,
    maxResults: options.maxResults || DEFAULT_MAX_RESULTS,
    site: options.site,
    language: options.language || 'en',
    docsOnly: options.docsOnly,
  });
}

// ============================================================================
// Search Implementation
// ============================================================================

/**
 * Parse site filter from query
 * Extracts "site:domain.com" from query and returns separated components
 */
function parseSiteFilter(query: string): { query: string; site?: string } {
  const siteMatch = query.match(/\bsite:([^\s]+)/i);
  if (siteMatch) {
    return {
      query: query.replace(siteMatch[0], '').trim(),
      site: siteMatch[1],
    };
  }
  return { query };
}

/**
 * Calculate relevance score for a result
 */
function calculateRelevance(
  result: { title: string; snippet: string; url: string },
  query: string,
  site?: string
): number {
  let score = 0.5; // Base score

  const queryTerms = query.toLowerCase().split(/\s+/);
  const titleLower = result.title.toLowerCase();
  const snippetLower = result.snippet.toLowerCase();
  const urlLower = result.url.toLowerCase();

  // Term matching in title (high value)
  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 0.15;
    if (snippetLower.includes(term)) score += 0.05;
    if (urlLower.includes(term)) score += 0.05;
  }

  // Odoo documentation domain boost
  for (const domain of ODOO_DOCS_DOMAINS) {
    if (urlLower.includes(domain.toLowerCase())) {
      score += 0.2;
      break;
    }
  }

  // Pattern-based boosts
  const fullText = `${result.title} ${result.snippet}`;
  for (const { pattern, boost } of ODOO_DOC_PATTERNS) {
    if (pattern.test(fullText)) {
      score += boost;
    }
  }

  // Site filter match bonus
  if (site && urlLower.includes(site.toLowerCase())) {
    score += 0.15;
  }

  // Cap at 1.0
  return Math.min(1.0, score);
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback: extract using regex
    const match = url.match(/^(?:https?:\/\/)?([^/]+)/);
    return match ? match[1] : 'unknown';
  }
}

/**
 * Parse a single search result from HTML block
 * Extracts URL, title, and snippet using separate patterns for robustness
 */
function parseResultBlock(block: string): { url: string; title: string; snippet: string } | null {
  // Extract URL from result__a link - handle both attribute orders
  // Pattern matches href="..." anywhere in the tag with class="result__a"
  const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>/i)
    || block.match(/<a[^>]*href="([^"]+)"[^>]*class="result__a"[^>]*>/i);

  if (!urlMatch) return null;

  // Extract title - text content of the result__a link
  const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/i);
  if (!titleMatch) return null;

  // Extract snippet - text content of result__snippet
  const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
  const snippet = snippetMatch
    ? snippetMatch[1].replace(/<[^>]+>/g, '').trim()
    : '';

  // Decode DuckDuckGo redirect URL
  let url = urlMatch[1];
  if (url.includes('duckduckgo.com/l/?uddg=')) {
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }
  }

  return {
    url,
    title: titleMatch[1].trim(),
    snippet,
  };
}

/**
 * Perform web search using DuckDuckGo HTML interface
 * This is a fallback implementation that scrapes search results
 */
async function searchDuckDuckGo(
  query: string,
  options: WebSearchOptions
): Promise<SearchResult[]> {
  const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  // Build search URL
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PlatxaAgent/1.0)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`);
    }

    const html = await response.text();

    // Parse results from HTML using robust block-based extraction
    const results: SearchResult[] = [];

    // Find all result blocks - each contains a result__a link
    // Split by result div boundaries for isolation
    const resultBlocks = html.split(/<div[^>]*class="[^"]*result[^"]*"[^>]*>/i);

    let position = 0;
    for (const block of resultBlocks) {
      if (results.length >= maxResults) break;

      // Skip blocks without result__a (headers, footers, etc.)
      if (!block.includes('class="result__a"')) continue;

      const parsed = parseResultBlock(block);
      if (!parsed) continue;

      // Apply site filter if specified
      if (options.site && !parsed.url.toLowerCase().includes(options.site.toLowerCase())) {
        continue;
      }

      position++;
      results.push({
        title: parsed.title,
        url: parsed.url,
        snippet: parsed.snippet,
        domain: extractDomain(parsed.url),
        relevance: calculateRelevance(parsed, query, options.site),
        position,
      });
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Search timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Generate fallback results for Odoo-related queries
 * Used when web search is unavailable or fails
 */
function generateFallbackResults(query: string, site?: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  // Odoo documentation fallbacks based on common topics
  const fallbackDocs: Array<{ keywords: string[]; title: string; url: string; snippet: string }> = [
    {
      keywords: ['qweb', 'template', 't-foreach', 't-if', 't-esc'],
      title: 'QWeb Templates - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/frontend/qweb.html',
      snippet: 'QWeb is the primary templating engine used by Odoo. It is an XML templating engine with special attributes for dynamic content generation.',
    },
    {
      keywords: ['owl', 'component', 'webclient'],
      title: 'OWL Framework - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/frontend/owl.html',
      snippet: 'OWL (Odoo Web Library) is a component system based on QWeb templates. It provides a reactive framework for building interactive web components.',
    },
    {
      keywords: ['scss', 'css', 'style', 'bootstrap'],
      title: 'Assets Management - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/frontend/assets.html',
      snippet: 'Learn how to manage assets including SCSS, CSS, and JavaScript in Odoo. Includes information about asset bundles and compilation.',
    },
    {
      keywords: ['model', 'field', 'orm', 'record'],
      title: 'ORM API - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html',
      snippet: 'The Odoo ORM provides an object-relational mapping to interact with the database. Define models, fields, and relationships.',
    },
    {
      keywords: ['view', 'form', 'tree', 'kanban', 'search'],
      title: 'Views - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/backend/views.html',
      snippet: 'Views define how records are displayed in the Odoo interface. Types include form, tree, kanban, search, and graph views.',
    },
    {
      keywords: ['controller', 'route', 'http', 'api'],
      title: 'Controllers - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/reference/backend/http.html',
      snippet: 'HTTP controllers handle web requests in Odoo. Define routes and response handlers for custom endpoints.',
    },
    {
      keywords: ['module', 'manifest', '__manifest__', 'install'],
      title: 'Module Structure - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/tutorials/define_module_data.html',
      snippet: 'Learn how to create and structure Odoo modules. Includes manifest file configuration and module dependencies.',
    },
    {
      keywords: ['website', 'snippet', 'theme'],
      title: 'Website Builder - Odoo Documentation',
      url: 'https://www.odoo.com/documentation/17.0/developer/tutorials/website.html',
      snippet: 'Build and customize Odoo websites with themes and snippets. Create reusable building blocks for the website builder.',
    },
  ];

  // Find matching fallback docs
  for (const doc of fallbackDocs) {
    const matches = doc.keywords.some(kw => queryLower.includes(kw));
    if (matches) {
      // Apply site filter
      if (site && !doc.url.toLowerCase().includes(site.toLowerCase())) {
        continue;
      }

      results.push({
        title: doc.title,
        url: doc.url,
        snippet: doc.snippet,
        domain: extractDomain(doc.url),
        relevance: calculateRelevance(doc, query, site),
        position: results.length + 1,
      });
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, 5);
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Perform a web search for Odoo documentation and examples
 *
 * @param options - Search options
 * @returns Search results with metadata
 */
export async function webSearchImpl(options: WebSearchOptions): Promise<WebSearchResult> {
  const startTime = Date.now();

  // Parse site filter from query if not explicitly provided
  const parsed = parseSiteFilter(options.query);
  const effectiveQuery = parsed.query;
  const siteFilter = options.site || parsed.site;

  // Build effective search query with site filter
  let searchQuery = effectiveQuery;
  if (siteFilter) {
    searchQuery = `site:${siteFilter} ${effectiveQuery}`;
  }

  // Check cache first
  const cacheKey = getCacheKey({ ...options, query: searchQuery, site: siteFilter });
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return {
      ...cached,
      metadata: { ...cached.metadata, source: 'cache' },
    };
  }

  const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
  let results: SearchResult[] = [];
  let source: 'api' | 'cache' | 'fallback' = 'api';

  try {
    // Attempt web search
    results = await searchDuckDuckGo(searchQuery, {
      ...options,
      query: searchQuery,
      site: siteFilter,
    });
  } catch (error) {
    // Fall back to generated results for Odoo queries
    console.warn(`Web search failed: ${(error as Error).message}, using fallback`);
    results = generateFallbackResults(effectiveQuery, siteFilter);
    source = 'fallback';
  }

  // If no results and no site filter, try with odoo.com filter
  if (results.length === 0 && !siteFilter) {
    try {
      results = await searchDuckDuckGo(`site:odoo.com ${effectiveQuery}`, {
        ...options,
        query: `site:odoo.com ${effectiveQuery}`,
        site: 'odoo.com',
      });
    } catch {
      // Use fallback
      results = generateFallbackResults(effectiveQuery, 'odoo.com');
      source = 'fallback';
    }
  }

  // Ensure we have at most maxResults
  const limitedResults = results.slice(0, maxResults);

  const searchResult: WebSearchResult = {
    query: options.query,
    effectiveQuery: searchQuery,
    results: limitedResults,
    totalResults: results.length,
    limited: results.length > maxResults,
    metadata: {
      searchTime: Date.now() - startTime,
      siteFilter,
      source,
    },
  };

  // Cache the result
  cacheResult(cacheKey, searchResult);

  return searchResult;
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Web search tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Top 5 search results by default
 * - site: filtering support (e.g., site:odoo.com)
 * - Relevance scoring for Odoo documentation
 * - Result caching for repeated queries
 * - Fallback results when search unavailable
 */
export async function webSearchTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const options: WebSearchOptions = {
      query: params.target,
      maxResults: (params.options?.maxResults as number) || DEFAULT_MAX_RESULTS,
      site: params.options?.site as string,
      timeout: (params.options?.timeout as number) || DEFAULT_TIMEOUT,
      language: (params.options?.language as string) || 'en',
      docsOnly: params.options?.docsOnly as boolean,
    };

    const result = await webSearchImpl(options);

    // Update context with search results for caching
    if (params.context?.searchResults) {
      params.context.searchResults.set(result.effectiveQuery, result.results);
    }

    return {
      success: true,
      data: {
        query: result.query,
        effectiveQuery: result.effectiveQuery,
        results: result.results,
        totalResults: result.totalResults,
        metadata: result.metadata,
      },
      duration: Date.now() - startTime,
      toolName: 'web_search',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'web_search',
    };
  }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear the search cache
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Get cache statistics
 */
export function getSearchCacheStats(): { size: number; maxSize: number } {
  return {
    size: searchCache.size,
    maxSize: 100,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default webSearchTool;
