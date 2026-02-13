/**
 * URL validation utility for SSRF protection.
 *
 * Validates user-supplied URLs to prevent Server-Side Request Forgery (SSRF)
 * by blocking internal networks, cloud metadata endpoints, and non-HTTP protocols.
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  url?: string;
}

export interface UrlValidationOptions {
  /** Allow http:// (only in development by default) */
  allowHttp?: boolean;
  /** Allow localhost/loopback (only in development by default) */
  allowLocalhost?: boolean;
}

/** Private IP ranges and special addresses to block */
const BLOCKED_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local / cloud metadata
  /^0\./, // Current network
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "0.0.0.0",
  "::1",
  "[::1]",
];

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
];

const isDevelopment = () => process.env.NODE_ENV !== "production";

export function validateUrl(
  url: string | null | undefined,
  options: UrlValidationOptions = {}
): UrlValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  const trimmed = url.trim();

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Protocol check
  const allowHttp = options.allowHttp ?? isDevelopment();
  const allowedProtocols = allowHttp ? ["https:", "http:"] : ["https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: allowHttp
        ? `Only HTTP and HTTPS protocols are allowed, got: ${parsed.protocol}`
        : `Only HTTPS is allowed in production, got: ${parsed.protocol}`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowLocalhost = options.allowLocalhost ?? isDevelopment();

  // Block known dangerous hostnames
  if (!allowLocalhost) {
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: `Blocked hostname: ${hostname}` };
    }

    for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return { valid: false, error: `Blocked hostname suffix: ${suffix}` };
      }
    }
  }

  // Block private/internal IP ranges
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: `Blocked private/internal IP: ${hostname}` };
    }
  }

  return { valid: true, url: parsed.toString() };
}

/**
 * Validates a URL and throws on invalid input.
 * Convenience wrapper for inline use.
 */
export function requireValidUrl(
  url: string | null | undefined,
  options: UrlValidationOptions = {}
): string {
  const result = validateUrl(url, options);
  if (!result.valid) {
    throw new Error(`Invalid URL: ${result.error}`);
  }
  return result.url!;
}
