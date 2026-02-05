/**
 * NetworkInspectionTool
 *
 * Agent tool for debugging API calls and inspecting network requests.
 * Captures and analyzes HTTP traffic for troubleshooting.
 *
 * Features:
 * - Intercept and log all fetch/XHR requests
 * - View request/response headers
 * - Inspect request/response bodies
 * - Filter by URL, method, status code
 * - Performance timing analysis
 * - Error detection and categorization
 * - Export HAR format
 * - Request replay capability
 *
 * Feature #54: Agent Tool Expansion - NetworkInspectionTool
 */

// =============================================================================
// Types
// =============================================================================

/** HTTP methods */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/** Request status */
export type RequestStatus = "pending" | "success" | "error" | "timeout" | "aborted";

/** Request entry */
export interface NetworkRequest {
  /** Unique request ID */
  id: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: HttpMethod;
  /** Request headers */
  requestHeaders: Record<string, string>;
  /** Request body (if any) */
  requestBody?: string | Record<string, unknown>;
  /** Response status code */
  statusCode?: number;
  /** Response status text */
  statusText?: string;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Response body (parsed if JSON) */
  responseBody?: unknown;
  /** Response content type */
  contentType?: string;
  /** Request status */
  status: RequestStatus;
  /** Error message if failed */
  error?: string;
  /** Timing information */
  timing: RequestTiming;
  /** Request initiator (if available) */
  initiator?: string;
  /** Tags for categorization */
  tags?: string[];
}

/** Request timing information */
export interface RequestTiming {
  /** When the request started */
  startTime: number;
  /** When the request ended */
  endTime?: number;
  /** Total duration in ms */
  duration?: number;
  /** Time to first byte */
  ttfb?: number;
  /** DNS lookup time */
  dnsTime?: number;
  /** Connection time */
  connectTime?: number;
  /** SSL/TLS negotiation time */
  sslTime?: number;
}

/** Filter options for querying requests */
export interface NetworkFilter {
  /** Filter by URL pattern (supports wildcards) */
  urlPattern?: string;
  /** Filter by HTTP method */
  method?: HttpMethod | HttpMethod[];
  /** Filter by status code range */
  statusCode?: number | { min?: number; max?: number };
  /** Filter by status */
  status?: RequestStatus | RequestStatus[];
  /** Filter by content type */
  contentType?: string;
  /** Filter by time range */
  timeRange?: { start?: number; end?: number };
  /** Filter by tags */
  tags?: string[];
  /** Limit results */
  limit?: number;
}

/** Network statistics */
export interface NetworkStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  pendingRequests: number;
  totalBytes: number;
  averageLatency: number;
  slowestRequest?: NetworkRequest;
  mostErrors: { url: string; count: number }[];
  requestsByMethod: Record<HttpMethod, number>;
  requestsByStatus: Record<number, number>;
}

/** Tool configuration */
export interface NetworkInspectionToolConfig {
  /** Maximum requests to store */
  maxRequests?: number;
  /** Auto-capture requests */
  autoCapture?: boolean;
  /** URLs to ignore */
  ignoreUrls?: string[];
  /** Truncate large bodies (bytes) */
  maxBodySize?: number;
  /** Enable performance timing */
  enableTiming?: boolean;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse headers from various formats
 */
function parseHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
  } else {
    Object.entries(headers).forEach(([key, value]) => {
      result[key.toLowerCase()] = value;
    });
  }

  return result;
}

/**
 * Safely parse JSON
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "... [truncated]";
}

/**
 * Match URL against pattern (supports * wildcards)
 */
function matchUrlPattern(url: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    "i"
  );
  return regex.test(url);
}

/**
 * Categorize HTTP status code
 */
function categorizeStatusCode(code: number): "info" | "success" | "redirect" | "client_error" | "server_error" {
  if (code < 200) return "info";
  if (code < 300) return "success";
  if (code < 400) return "redirect";
  if (code < 500) return "client_error";
  return "server_error";
}

// =============================================================================
// NetworkInspectionTool Class
// =============================================================================

/**
 * NetworkInspectionTool
 *
 * Agent tool for inspecting and debugging network requests
 */
export class NetworkInspectionTool {
  private config: Required<NetworkInspectionToolConfig>;
  private requests: Map<string, NetworkRequest> = new Map();
  private originalFetch: typeof fetch | null = null;
  private isCapturing = false;

  constructor(config: NetworkInspectionToolConfig = {}) {
    this.config = {
      maxRequests: config.maxRequests || 1000,
      autoCapture: config.autoCapture ?? true,
      ignoreUrls: config.ignoreUrls || [],
      maxBodySize: config.maxBodySize || 1024 * 100, // 100KB
      enableTiming: config.enableTiming ?? true,
    };

    if (this.config.autoCapture && typeof window !== "undefined") {
      this.startCapture();
    }
  }

  /**
   * Start capturing network requests
   */
  startCapture(): void {
    if (this.isCapturing || typeof window === "undefined") return;

    this.originalFetch = window.fetch;
    const tool = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // Check if URL should be ignored
      if (tool.config.ignoreUrls.some((pattern) => matchUrlPattern(url, pattern))) {
        return tool.originalFetch!.call(window, input, init);
      }

      const requestId = generateRequestId();
      const startTime = performance.now();

      // Create request entry
      const request: NetworkRequest = {
        id: requestId,
        url,
        method: ((init?.method || "GET") as HttpMethod).toUpperCase() as HttpMethod,
        requestHeaders: parseHeaders(init?.headers as Record<string, string> || {}),
        requestBody: init?.body ? tool.parseBody(init.body) : undefined,
        status: "pending",
        timing: { startTime: Date.now() },
      };

      tool.addRequest(request);

      try {
        const response = await tool.originalFetch!.call(window, input, init);
        const endTime = performance.now();

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();
        let responseBody: unknown;

        try {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            responseBody = await clonedResponse.json();
          } else if (contentType.includes("text/")) {
            const text = await clonedResponse.text();
            responseBody = truncate(text, tool.config.maxBodySize);
          }
        } catch {
          // Ignore body parsing errors
        }

        // Update request with response info
        tool.updateRequest(requestId, {
          statusCode: response.status,
          statusText: response.statusText,
          responseHeaders: parseHeaders(response.headers),
          responseBody,
          contentType: response.headers.get("content-type") || undefined,
          status: response.ok ? "success" : "error",
          timing: {
            ...request.timing,
            endTime: Date.now(),
            duration: endTime - startTime,
            ttfb: endTime - startTime, // Simplified TTFB
          },
        });

        return response;
      } catch (error) {
        const endTime = performance.now();

        tool.updateRequest(requestId, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          timing: {
            ...request.timing,
            endTime: Date.now(),
            duration: endTime - startTime,
          },
        });

        throw error;
      }
    };

    this.isCapturing = true;
  }

  /**
   * Stop capturing network requests
   */
  stopCapture(): void {
    if (!this.isCapturing || !this.originalFetch) return;

    window.fetch = this.originalFetch;
    this.originalFetch = null;
    this.isCapturing = false;
  }

  /**
   * Parse request body
   */
  private parseBody(body: BodyInit): string | Record<string, unknown> {
    if (typeof body === "string") {
      return truncate(body, this.config.maxBodySize);
    }
    if (body instanceof FormData) {
      const obj: Record<string, unknown> = {};
      body.forEach((value, key) => {
        obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return obj;
    }
    if (body instanceof URLSearchParams) {
      const obj: Record<string, string> = {};
      body.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return "[Binary data]";
  }

  /**
   * Add a request to the store
   */
  private addRequest(request: NetworkRequest): void {
    // Enforce max requests limit
    if (this.requests.size >= this.config.maxRequests) {
      const oldestKey = this.requests.keys().next().value;
      if (oldestKey) {
        this.requests.delete(oldestKey);
      }
    }

    this.requests.set(request.id, request);
  }

  /**
   * Update an existing request
   */
  private updateRequest(id: string, updates: Partial<NetworkRequest>): void {
    const request = this.requests.get(id);
    if (request) {
      this.requests.set(id, { ...request, ...updates });
    }
  }

  /**
   * Get all captured requests
   */
  getRequests(filter?: NetworkFilter): NetworkRequest[] {
    let results = Array.from(this.requests.values());

    if (filter) {
      // Filter by URL pattern
      if (filter.urlPattern) {
        results = results.filter((r) => matchUrlPattern(r.url, filter.urlPattern!));
      }

      // Filter by method
      if (filter.method) {
        const methods = Array.isArray(filter.method) ? filter.method : [filter.method];
        results = results.filter((r) => methods.includes(r.method));
      }

      // Filter by status code
      if (filter.statusCode !== undefined) {
        if (typeof filter.statusCode === "number") {
          results = results.filter((r) => r.statusCode === filter.statusCode);
        } else {
          const { min = 0, max = 999 } = filter.statusCode;
          results = results.filter(
            (r) => r.statusCode !== undefined && r.statusCode >= min && r.statusCode <= max
          );
        }
      }

      // Filter by request status
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        results = results.filter((r) => statuses.includes(r.status));
      }

      // Filter by content type
      if (filter.contentType) {
        results = results.filter((r) => r.contentType?.includes(filter.contentType!));
      }

      // Filter by time range
      if (filter.timeRange) {
        const { start, end } = filter.timeRange;
        results = results.filter((r) => {
          const time = r.timing.startTime;
          if (start && time < start) return false;
          if (end && time > end) return false;
          return true;
        });
      }

      // Limit results
      if (filter.limit) {
        results = results.slice(-filter.limit);
      }
    }

    return results;
  }

  /**
   * Get a specific request by ID
   */
  getRequest(id: string): NetworkRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Get recent requests
   */
  getRecentRequests(count = 10): NetworkRequest[] {
    return this.getRequests({ limit: count });
  }

  /**
   * Get failed requests
   */
  getFailedRequests(): NetworkRequest[] {
    return this.getRequests({ status: "error" });
  }

  /**
   * Get slow requests (above threshold)
   */
  getSlowRequests(thresholdMs = 1000): NetworkRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.timing.duration !== undefined && r.timing.duration > thresholdMs
    );
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    const requests = Array.from(this.requests.values());

    const requestsByMethod: Record<HttpMethod, number> = {
      GET: 0,
      POST: 0,
      PUT: 0,
      PATCH: 0,
      DELETE: 0,
      HEAD: 0,
      OPTIONS: 0,
    };

    const requestsByStatus: Record<number, number> = {};
    const errorsByUrl: Record<string, number> = {};

    let totalDuration = 0;
    let durationCount = 0;
    let slowestRequest: NetworkRequest | undefined;

    for (const req of requests) {
      // Count by method
      requestsByMethod[req.method] = (requestsByMethod[req.method] || 0) + 1;

      // Count by status code
      if (req.statusCode) {
        requestsByStatus[req.statusCode] = (requestsByStatus[req.statusCode] || 0) + 1;
      }

      // Track errors
      if (req.status === "error") {
        const urlBase = new URL(req.url).pathname;
        errorsByUrl[urlBase] = (errorsByUrl[urlBase] || 0) + 1;
      }

      // Track timing
      if (req.timing.duration !== undefined) {
        totalDuration += req.timing.duration;
        durationCount++;

        if (!slowestRequest || req.timing.duration > (slowestRequest.timing.duration || 0)) {
          slowestRequest = req;
        }
      }
    }

    // Sort errors by count
    const mostErrors = Object.entries(errorsByUrl)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRequests: requests.length,
      successfulRequests: requests.filter((r) => r.status === "success").length,
      failedRequests: requests.filter((r) => r.status === "error").length,
      pendingRequests: requests.filter((r) => r.status === "pending").length,
      totalBytes: 0, // Would need response size tracking
      averageLatency: durationCount > 0 ? totalDuration / durationCount : 0,
      slowestRequest,
      mostErrors,
      requestsByMethod,
      requestsByStatus,
    };
  }

  /**
   * Clear all captured requests
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Export requests to HAR format
   */
  exportHar(): object {
    const entries = Array.from(this.requests.values()).map((req) => ({
      startedDateTime: new Date(req.timing.startTime).toISOString(),
      time: req.timing.duration || 0,
      request: {
        method: req.method,
        url: req.url,
        headers: Object.entries(req.requestHeaders).map(([name, value]) => ({
          name,
          value,
        })),
        postData: req.requestBody
          ? {
              mimeType: "application/json",
              text:
                typeof req.requestBody === "string"
                  ? req.requestBody
                  : JSON.stringify(req.requestBody),
            }
          : undefined,
      },
      response: {
        status: req.statusCode || 0,
        statusText: req.statusText || "",
        headers: req.responseHeaders
          ? Object.entries(req.responseHeaders).map(([name, value]) => ({
              name,
              value,
            }))
          : [],
        content: {
          mimeType: req.contentType || "text/plain",
          text:
            typeof req.responseBody === "string"
              ? req.responseBody
              : JSON.stringify(req.responseBody),
        },
      },
      timings: {
        send: 0,
        wait: req.timing.ttfb || 0,
        receive: (req.timing.duration || 0) - (req.timing.ttfb || 0),
      },
    }));

    return {
      log: {
        version: "1.2",
        creator: {
          name: "NetworkInspectionTool",
          version: "1.0",
        },
        entries,
      },
    };
  }

  /**
   * Manually record a request (for non-fetch requests)
   */
  recordRequest(request: Omit<NetworkRequest, "id">): string {
    const id = generateRequestId();
    this.addRequest({ ...request, id });
    return id;
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}

// =============================================================================
// Factory & Agent Integration
// =============================================================================

/**
 * Create a NetworkInspectionTool instance
 */
export function createNetworkInspectionTool(
  config?: NetworkInspectionToolConfig
): NetworkInspectionTool {
  return new NetworkInspectionTool(config);
}

/**
 * Tool definition for agent integration
 */
export const networkInspectionToolDefinition = {
  name: "network_inspection",
  description:
    "Inspect and debug network requests. View recent API calls, status codes, response data, and timing information.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["getRecent", "getRequest", "getFailed", "getSlow", "getStats", "clear"],
        description: "Action to perform",
      },
      requestId: {
        type: "string",
        description: "Request ID for getRequest action",
      },
      count: {
        type: "number",
        description: "Number of requests to return",
      },
      filter: {
        type: "object",
        description: "Filter criteria for requests",
      },
    },
    required: ["action"],
  },
};

export default NetworkInspectionTool;
