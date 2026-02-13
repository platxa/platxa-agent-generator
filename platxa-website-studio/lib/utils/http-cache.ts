/**
 * HTTP Cache header utilities for GET routes.
 * Provides ETag generation, Cache-Control presets, and 304 responses.
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";

export interface CacheOptions {
  /** Cache-Control max-age in seconds */
  maxAge: number;
  /** stale-while-revalidate in seconds */
  staleWhileRevalidate?: number;
  /** Cache scope */
  scope?: "private" | "public";
  /** Additional Vary headers */
  vary?: string[];
}

/** Short-lived private cache (30s) for user-specific data that changes frequently */
export const PRIVATE_SHORT: CacheOptions = {
  maxAge: 30,
  staleWhileRevalidate: 60,
  scope: "private",
};

/** Medium-lived private cache (5 min) for data that changes occasionally */
export const PRIVATE_MEDIUM: CacheOptions = {
  maxAge: 300,
  staleWhileRevalidate: 600,
  scope: "private",
};

/** No caching at all */
export const NO_STORE: CacheOptions = {
  maxAge: 0,
  scope: "private",
};

/**
 * Generate a weak ETag from JSON-serializable data.
 * Uses SHA-256 truncated to 16 hex chars for brevity.
 */
export function generateETag(data: unknown): string {
  const json = JSON.stringify(data);
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Check if the request's If-None-Match header matches the given ETag.
 */
export function isNotModified(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers.get("if-none-match");
  if (!ifNoneMatch) return false;
  return ifNoneMatch === etag || ifNoneMatch === `"${etag}"`;
}

/**
 * Return a 304 Not Modified response with cache headers.
 */
export function notModifiedResponse(etag?: string, options?: CacheOptions): Response {
  const headers: Record<string, string> = {};
  if (etag) headers["ETag"] = etag;
  if (options) {
    headers["Cache-Control"] = buildCacheControl(options);
  }
  headers["Vary"] = "Authorization";
  return new Response(null, { status: 304, headers });
}

/**
 * Set cache headers on a NextResponse.
 */
export function setCacheHeaders(
  response: NextResponse,
  options: CacheOptions,
  etag?: string
): NextResponse {
  response.headers.set("Cache-Control", buildCacheControl(options));

  // Always vary on Authorization for private data
  const varyParts = ["Authorization", ...(options.vary || [])];
  response.headers.set("Vary", varyParts.join(", "));

  if (etag) {
    response.headers.set("ETag", etag);
  }

  return response;
}

function buildCacheControl(options: CacheOptions): string {
  if (options.maxAge === 0 && !options.staleWhileRevalidate) {
    return "no-store";
  }

  const parts: string[] = [];
  parts.push(options.scope || "private");
  parts.push(`max-age=${options.maxAge}`);
  if (options.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  return parts.join(", ");
}
