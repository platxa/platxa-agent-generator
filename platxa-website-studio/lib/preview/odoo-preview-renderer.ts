/**
 * Odoo Preview Renderer
 *
 * Fetches live rendered HTML from sidecar's Odoo instance:
 * - Renders QWeb templates via Odoo
 * - Supports page and snippet previews
 * - Handles caching and error recovery
 */

// =============================================================================
// Types
// =============================================================================

/** Preview render request */
export interface RenderRequest {
  /** Template path or XML ID */
  template: string;
  /** Render context values */
  context?: Record<string, unknown>;
  /** Page URL for full page renders */
  pageUrl?: string;
  /** Whether to include CSS/JS assets */
  includeAssets?: boolean;
  /** Preview width for responsive testing */
  width?: number;
  /** Preview height */
  height?: number;
  /** Request ID for tracking */
  requestId?: string;
}

/** Preview render result */
export interface RenderResult {
  /** Rendered HTML content */
  html: string;
  /** Whether render succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Render time in ms */
  renderTime: number;
  /** Request ID */
  requestId: string;
  /** Template that was rendered */
  template: string;
  /** Timestamp of render */
  timestamp: number;
  /** Cache hit indicator */
  cached: boolean;
  /** Asset URLs if included */
  assets?: {
    css: string[];
    js: string[];
  };
}

/** Sidecar render response */
export interface SidecarRenderResponse {
  /** Rendered HTML */
  html?: string;
  /** Error message */
  error?: string;
  /** Render time from sidecar */
  render_time?: number;
  /** CSS asset URLs */
  css_urls?: string[];
  /** JS asset URLs */
  js_urls?: string[];
}

/** Renderer configuration */
export interface RendererConfig {
  /** Sidecar base URL */
  sidecarUrl: string;
  /** Render endpoint path */
  renderEndpoint: string;
  /** Request timeout in ms */
  timeout: number;
  /** Enable response caching */
  enableCache: boolean;
  /** Cache TTL in ms */
  cacheTTL: number;
  /** Max cache entries */
  maxCacheSize: number;
  /** Default include assets */
  defaultIncludeAssets: boolean;
  /** Retry failed requests */
  retryOnError: boolean;
  /** Max retries */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelay: number;
}

/** Render event types */
export type RenderEventType =
  | "render:start"
  | "render:success"
  | "render:failure"
  | "render:cached"
  | "cache:hit"
  | "cache:miss";

/** Render event */
export interface RenderEvent {
  /** Event type */
  type: RenderEventType;
  /** Request that triggered event */
  request: RenderRequest;
  /** Result if available */
  result?: RenderResult;
  /** Timestamp */
  timestamp: number;
}

/** Render event callback */
export type RenderEventCallback = (event: RenderEvent) => void;

/** Fetch function type */
export type FetchFunction = (
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<SidecarRenderResponse>;
}>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: RendererConfig = {
  sidecarUrl: "http://localhost:8069",
  renderEndpoint: "/api/preview/render",
  timeout: 10000,
  enableCache: true,
  cacheTTL: 60000, // 1 minute
  maxCacheSize: 100,
  defaultIncludeAssets: true,
  retryOnError: true,
  maxRetries: 2,
  retryDelay: 500,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a cache key from render request.
 */
export function createCacheKey(request: RenderRequest): string {
  const parts = [
    request.template,
    request.pageUrl ?? "",
    JSON.stringify(request.context ?? {}),
    request.includeAssets ? "assets" : "no-assets",
    request.width?.toString() ?? "",
    request.height?.toString() ?? "",
  ];
  return parts.join("|");
}

/**
 * Creates a delay promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an abort controller with timeout.
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

// =============================================================================
// Cache Entry
// =============================================================================

interface CacheEntry {
  result: RenderResult;
  expires: number;
}

// =============================================================================
// Mock Fetch
// =============================================================================

/**
 * Creates a mock fetch function for testing.
 */
export function createMockFetch(options: {
  html?: string;
  error?: string;
  renderTime?: number;
  failCount?: number;
  cssUrls?: string[];
  jsUrls?: string[];
} = {}): FetchFunction {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return async () => {
    callCount++;

    // Simulate network delay
    await delay(options.renderTime ?? 50);

    // Simulate failures
    if (callCount <= failCount) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      };
    }

    if (options.error) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: options.error }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        html: options.html ?? "<div>Rendered content</div>",
        render_time: options.renderTime ?? 50,
        css_urls: options.cssUrls ?? ["/web/assets/style.css"],
        js_urls: options.jsUrls ?? ["/web/assets/script.js"],
      }),
    };
  };
}

// =============================================================================
// OdooPreviewRenderer Class
// =============================================================================

/**
 * Renders Odoo templates via sidecar for live preview.
 */
export class OdooPreviewRenderer {
  private config: RendererConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private callbacks: RenderEventCallback[] = [];
  private fetchFn: FetchFunction;
  private pendingRequests: Map<string, Promise<RenderResult>> = new Map();

  constructor(
    config: Partial<RendererConfig> = {},
    fetchFn?: FetchFunction
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchFn = fetchFn ?? this.defaultFetch.bind(this);
  }

  /**
   * Renders a template and returns HTML.
   */
  async render(request: RenderRequest): Promise<RenderResult> {
    const requestId = request.requestId ?? generateRequestId();
    const fullRequest = { ...request, requestId };

    this.emit({
      type: "render:start",
      request: fullRequest,
      timestamp: Date.now(),
    });

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getFromCache(fullRequest);
      if (cached) {
        this.emit({
          type: "cache:hit",
          request: fullRequest,
          result: cached,
          timestamp: Date.now(),
        });
        this.emit({
          type: "render:cached",
          request: fullRequest,
          result: cached,
          timestamp: Date.now(),
        });
        return cached;
      }
      this.emit({
        type: "cache:miss",
        request: fullRequest,
        timestamp: Date.now(),
      });
    }

    // Check for pending request with same cache key
    const cacheKey = createCacheKey(fullRequest);
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Create and track the request promise
    const requestPromise = this.executeRender(fullRequest);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Renders a page by URL.
   */
  async renderPage(pageUrl: string, options: Partial<RenderRequest> = {}): Promise<RenderResult> {
    return this.render({
      template: "page",
      pageUrl,
      includeAssets: options.includeAssets ?? this.config.defaultIncludeAssets,
      ...options,
    });
  }

  /**
   * Renders a QWeb template.
   */
  async renderTemplate(
    template: string,
    context?: Record<string, unknown>,
    options?: Partial<RenderRequest>
  ): Promise<RenderResult> {
    return this.render({
      template,
      context,
      includeAssets: options?.includeAssets ?? this.config.defaultIncludeAssets,
      ...options,
    });
  }

  /**
   * Renders a snippet for preview.
   */
  async renderSnippet(
    snippetXmlId: string,
    options?: Partial<RenderRequest>
  ): Promise<RenderResult> {
    return this.render({
      template: `snippet:${snippetXmlId}`,
      includeAssets: true,
      ...options,
    });
  }

  /**
   * Clears the render cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidates cache for a specific template.
   */
  invalidateTemplate(template: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(template)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Gets cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: RenderEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: RenderEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<RendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): RendererConfig {
    return { ...this.config };
  }

  /**
   * Checks if renderer is ready (sidecar available).
   */
  async isReady(): Promise<boolean> {
    try {
      const result = await this.render({
        template: "health_check",
        requestId: "health-check",
      });
      return result.success;
    } catch {
      return false;
    }
  }

  // Private methods

  private async executeRender(request: RenderRequest): Promise<RenderResult> {
    const startTime = Date.now();
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= (this.config.retryOnError ? this.config.maxRetries : 0); attempt++) {
      try {
        const result = await this.fetchRender(request, startTime);

        if (result.success) {
          // Cache successful result
          if (this.config.enableCache) {
            this.addToCache(request, result);
          }

          this.emit({
            type: "render:success",
            request,
            result,
            timestamp: Date.now(),
          });

          return result;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      // Wait before retry
      if (attempt < this.config.maxRetries) {
        await delay(this.config.retryDelay);
      }
    }

    // All attempts failed
    const failureResult: RenderResult = {
      html: "",
      success: false,
      error: lastError ?? "Unknown error",
      renderTime: Date.now() - startTime,
      requestId: request.requestId ?? generateRequestId(),
      template: request.template,
      timestamp: Date.now(),
      cached: false,
    };

    this.emit({
      type: "render:failure",
      request,
      result: failureResult,
      timestamp: Date.now(),
    });

    return failureResult;
  }

  private async fetchRender(request: RenderRequest, startTime: number): Promise<RenderResult> {
    const { controller, timeoutId } = createTimeoutController(this.config.timeout);

    try {
      const url = `${this.config.sidecarUrl}${this.config.renderEndpoint}`;
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: request.template,
          context: request.context,
          page_url: request.pageUrl,
          include_assets: request.includeAssets ?? this.config.defaultIncludeAssets,
          width: request.width,
          height: request.height,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || data.error) {
        return {
          html: "",
          success: false,
          error: data.error ?? `HTTP ${response.status}`,
          renderTime: Date.now() - startTime,
          requestId: request.requestId ?? generateRequestId(),
          template: request.template,
          timestamp: Date.now(),
          cached: false,
        };
      }

      return {
        html: data.html ?? "",
        success: true,
        renderTime: data.render_time ?? Date.now() - startTime,
        requestId: request.requestId ?? generateRequestId(),
        template: request.template,
        timestamp: Date.now(),
        cached: false,
        assets: data.css_urls || data.js_urls
          ? {
              css: data.css_urls ?? [],
              js: data.js_urls ?? [],
            }
          : undefined,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getFromCache(request: RenderRequest): RenderResult | null {
    const key = createCacheKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, cached: true };
  }

  private addToCache(request: RenderRequest, result: RenderResult): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const key = createCacheKey(request);
    this.cache.set(key, {
      result,
      expires: Date.now() + this.config.cacheTTL,
    });
  }

  private emit(event: RenderEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private async defaultFetch(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
    }
  ): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<SidecarRenderResponse>;
  }> {
    if (typeof fetch !== "undefined") {
      const response = await fetch(url, options);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json() as Promise<SidecarRenderResponse>,
      };
    }
    throw new Error("Fetch not available");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an OdooPreviewRenderer instance.
 */
export function createPreviewRenderer(
  config?: Partial<RendererConfig>,
  fetchFn?: FetchFunction
): OdooPreviewRenderer {
  return new OdooPreviewRenderer(config, fetchFn);
}

/**
 * Creates a renderer with mock fetch for testing.
 */
export function createMockPreviewRenderer(
  config?: Partial<RendererConfig>,
  mockOptions?: Parameters<typeof createMockFetch>[0]
): OdooPreviewRenderer {
  return new OdooPreviewRenderer(config, createMockFetch(mockOptions));
}
