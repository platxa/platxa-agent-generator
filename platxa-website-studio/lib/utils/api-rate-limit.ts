/**
 * Simple in-memory IP-based rate limiter for API routes.
 *
 * Uses a sliding window approach. Entries are auto-cleaned
 * on each check to prevent memory leaks.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a given identifier (typically IP address).
 *
 * @param identifier - Unique key (IP, user ID, etc.)
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns Object with allowed boolean, remaining count, and reset time
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Extract client IP from request headers (works behind proxies).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * Returns a 429 Too Many Requests Response.
 */
export function rateLimitResponse(resetMs: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
      retryAfterMs: resetMs,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetMs / 1000)),
      },
    }
  );
}
