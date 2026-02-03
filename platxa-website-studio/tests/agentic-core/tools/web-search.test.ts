/**
 * Web Search Tool Tests
 *
 * Tests for Feature #25: web_search tool for fetching Odoo documentation
 * Verification: Returns top 5 search results; supports site: filtering for odoo.com
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  webSearchTool,
  webSearchImpl,
  clearSearchCache,
  getSearchCacheStats,
  type WebSearchOptions,
  type WebSearchResult,
  type SearchResult,
} from '@/lib/agentic-core/tools/web-search';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

// Mock fetch for controlled testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

// Sample HTML response from DuckDuckGo
// Matches the actual DuckDuckGo HTML structure with result divs
const createMockDuckDuckGoResponse = (results: Array<{ url: string; title: string; snippet: string }>) => {
  const resultHtml = results.map((r) => `
    <div class="result results_links results_links_deep web-result">
      <div class="links_main links_deep result__body">
        <h2 class="result__title">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(r.url)}&rut=abc123">${r.title}</a>
        </h2>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(r.url)}">${r.snippet}</a>
      </div>
    </div>
  `).join('');

  return `<html><body><div class="results">${resultHtml}</div></body></html>`;
};

describe('webSearchImpl', () => {
  beforeEach(() => {
    clearSearchCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    clearSearchCache();
    vi.clearAllMocks();
  });

  describe('basic search functionality', () => {
    it('returns top 5 results by default', async () => {
      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        url: `https://odoo.com/doc/${i}`,
        title: `Odoo Documentation ${i}`,
        snippet: `This is snippet ${i} about Odoo features`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse(mockResults)),
      });

      const result = await webSearchImpl({ query: 'odoo qweb templates' });

      expect(result.results.length).toBeLessThanOrEqual(5);
      expect(result.query).toBe('odoo qweb templates');
    });

    it('respects maxResults option', async () => {
      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        url: `https://odoo.com/doc/${i}`,
        title: `Result ${i}`,
        snippet: `Snippet ${i}`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse(mockResults)),
      });

      const result = await webSearchImpl({ query: 'test', maxResults: 3 });

      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('returns results with required metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          {
            url: 'https://www.odoo.com/documentation/17.0/developer/reference/frontend/qweb.html',
            title: 'QWeb Templates - Odoo Documentation',
            snippet: 'QWeb is the primary templating engine used by Odoo.',
          },
        ])),
      });

      const result = await webSearchImpl({ query: 'qweb templates' });

      expect(result.results.length).toBeGreaterThan(0);
      const firstResult = result.results[0];

      // Verify all required fields
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('url');
      expect(firstResult).toHaveProperty('snippet');
      expect(firstResult).toHaveProperty('domain');
      expect(firstResult).toHaveProperty('relevance');
      expect(firstResult).toHaveProperty('position');

      // Verify types
      expect(typeof firstResult.title).toBe('string');
      expect(typeof firstResult.url).toBe('string');
      expect(typeof firstResult.relevance).toBe('number');
      expect(firstResult.relevance).toBeGreaterThanOrEqual(0);
      expect(firstResult.relevance).toBeLessThanOrEqual(1);
    });

    it('includes search metadata in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Test snippet' },
        ])),
      });

      const result = await webSearchImpl({ query: 'test query' });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.source).toBe('api');
      expect(result.effectiveQuery).toBeDefined();
    });
  });

  describe('site: filtering', () => {
    it('supports site: filter in query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://www.odoo.com/documentation/qweb', title: 'QWeb', snippet: 'Templates' },
        ])),
      });

      const result = await webSearchImpl({ query: 'site:odoo.com qweb templates' });

      expect(result.effectiveQuery).toContain('site:odoo.com');
      expect(result.metadata.siteFilter).toBe('odoo.com');
    });

    it('supports explicit site option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://www.odoo.com/doc', title: 'Odoo Doc', snippet: 'Documentation' },
        ])),
      });

      const result = await webSearchImpl({
        query: 'qweb templates',
        site: 'odoo.com'
      });

      expect(result.effectiveQuery).toContain('site:odoo.com');
      expect(result.metadata.siteFilter).toBe('odoo.com');
    });

    it('filters results to match site domain', async () => {
      // Return mixed results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://www.odoo.com/doc1', title: 'Odoo Doc 1', snippet: 'Odoo content' },
          { url: 'https://stackoverflow.com/q1', title: 'SO Question', snippet: 'Stack content' },
          { url: 'https://www.odoo.com/doc2', title: 'Odoo Doc 2', snippet: 'More Odoo' },
        ])),
      });

      const result = await webSearchImpl({
        query: 'qweb',
        site: 'odoo.com'
      });

      // All results should be from odoo.com
      for (const r of result.results) {
        expect(r.url.toLowerCase()).toContain('odoo.com');
      }
    });
  });

  describe('relevance scoring', () => {
    it('boosts Odoo documentation domains', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://random-blog.com/odoo', title: 'Blog Post', snippet: 'About QWeb' },
          { url: 'https://www.odoo.com/documentation/qweb', title: 'Official QWeb', snippet: 'QWeb docs' },
        ])),
      });

      const result = await webSearchImpl({ query: 'qweb' });

      // Results should be sorted by relevance
      if (result.results.length >= 2) {
        // Official docs should have higher relevance
        const officialDoc = result.results.find(r => r.url.includes('odoo.com/documentation'));
        const blogPost = result.results.find(r => r.url.includes('random-blog.com'));

        if (officialDoc && blogPost) {
          expect(officialDoc.relevance).toBeGreaterThan(blogPost.relevance);
        }
      }
    });

    it('boosts results matching query terms', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://odoo.com/1', title: 'QWeb Templates Guide', snippet: 'Learn about QWeb templating' },
          { url: 'https://odoo.com/2', title: 'General Guide', snippet: 'Unrelated content here' },
        ])),
      });

      const result = await webSearchImpl({ query: 'qweb templates' });

      if (result.results.length >= 2) {
        const matchingResult = result.results.find(r =>
          r.title.toLowerCase().includes('qweb') && r.title.toLowerCase().includes('templates')
        );
        const nonMatchingResult = result.results.find(r =>
          !r.title.toLowerCase().includes('qweb')
        );

        if (matchingResult && nonMatchingResult) {
          expect(matchingResult.relevance).toBeGreaterThan(nonMatchingResult.relevance);
        }
      }
    });
  });

  describe('caching', () => {
    it('caches results for repeated queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Content' },
        ])),
      });

      // First call
      const result1 = await webSearchImpl({ query: 'test query' });
      expect(result1.metadata.source).toBe('api');

      // Second call should use cache
      const result2 = await webSearchImpl({ query: 'test query' });
      expect(result2.metadata.source).toBe('cache');

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses different cache keys for different queries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Content' },
        ])),
      });

      await webSearchImpl({ query: 'query 1' });
      await webSearchImpl({ query: 'query 2' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears cache correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(createMockDuckDuckGoResponse([
          { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Content' },
        ])),
      });

      await webSearchImpl({ query: 'test' });
      expect(getSearchCacheStats().size).toBe(1);

      clearSearchCache();
      expect(getSearchCacheStats().size).toBe(0);

      // Should make new request after cache clear
      await webSearchImpl({ query: 'test' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fallback behavior', () => {
    it('uses fallback results when search fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await webSearchImpl({ query: 'qweb templates' });

      expect(result.metadata.source).toBe('fallback');
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('provides Odoo-relevant fallback results', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await webSearchImpl({ query: 'qweb t-foreach templates' });

      // Should have relevant fallback results
      expect(result.results.some(r =>
        r.title.toLowerCase().includes('qweb') ||
        r.snippet.toLowerCase().includes('qweb')
      )).toBe(true);
    });

    it('handles timeout errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          reject(error);
        })
      );

      const result = await webSearchImpl({ query: 'test', timeout: 100 });

      expect(result.metadata.source).toBe('fallback');
    });
  });

  describe('error handling', () => {
    it('handles HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await webSearchImpl({ query: 'test' });

      // Should fall back gracefully
      expect(result.metadata.source).toBe('fallback');
    });

    it('handles malformed HTML response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>No results here</body></html>'),
      });

      const result = await webSearchImpl({ query: 'test' });

      // Should return empty or fallback results
      expect(result.results).toBeDefined();
    });
  });
});

describe('webSearchTool', () => {
  beforeEach(() => {
    clearSearchCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    clearSearchCache();
    vi.clearAllMocks();
  });

  it('returns success result with search data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(createMockDuckDuckGoResponse([
        { url: 'https://odoo.com/doc', title: 'Odoo Doc', snippet: 'Content' },
      ])),
    });

    const result = await webSearchTool({
      target: 'odoo qweb',
      context: createMockContext(),
    });

    expect(result.success).toBe(true);
    expect(result.toolName).toBe('web_search');
    expect(result.data).toBeDefined();
    const data = result.data as { query: string; results: unknown; metadata?: { siteFilter?: string } };
    expect(data.query).toBe('odoo qweb');
    expect(data.results).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('passes options correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(createMockDuckDuckGoResponse([
        { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Content' },
      ])),
    });

    const result = await webSearchTool({
      target: 'test query',
      context: createMockContext(),
      options: {
        maxResults: 3,
        site: 'odoo.com',
      },
    });

    expect(result.success).toBe(true);
    const data = result.data as { metadata: { siteFilter?: string } };
    expect(data.metadata.siteFilter).toBe('odoo.com');
  });

  it('updates context with search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(createMockDuckDuckGoResponse([
        { url: 'https://odoo.com/doc', title: 'Test', snippet: 'Content' },
      ])),
    });

    const context = createMockContext();
    await webSearchTool({
      target: 'test',
      context,
    });

    // Context should be updated with search results
    expect(context.searchResults.size).toBeGreaterThan(0);
  });

  it('handles errors gracefully', async () => {
    // Make both search and fallback fail by mocking a query that doesn't match fallbacks
    mockFetch.mockRejectedValue(new Error('Complete failure'));

    const result = await webSearchTool({
      target: 'completely unrelated xyz123',
      context: createMockContext(),
    });

    // Should still succeed with fallback or empty results
    expect(result.success).toBe(true);
    expect(result.toolName).toBe('web_search');
  });
});

describe('Feature #25 Verification', () => {
  beforeEach(() => {
    clearSearchCache();
    mockFetch.mockReset();
  });

  it('returns top 5 search results', async () => {
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      url: `https://odoo.com/doc/${i}`,
      title: `Result ${i}`,
      snippet: `Snippet ${i}`,
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(createMockDuckDuckGoResponse(mockResults)),
    });

    const result = await webSearchImpl({ query: 'odoo documentation' });

    expect(result.results.length).toBe(5);
  });

  it('supports site: filtering for odoo.com', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(createMockDuckDuckGoResponse([
        { url: 'https://www.odoo.com/documentation/17.0/qweb.html', title: 'QWeb', snippet: 'Templates' },
      ])),
    });

    const result = await webSearchImpl({ query: 'site:odoo.com qweb' });

    expect(result.metadata.siteFilter).toBe('odoo.com');
    expect(result.effectiveQuery).toContain('site:odoo.com');

    // All results should be from odoo.com
    for (const r of result.results) {
      expect(r.domain.toLowerCase()).toContain('odoo.com');
    }
  });
});
