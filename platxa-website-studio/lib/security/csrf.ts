/**
 * CSRF Protection - Double-submit cookie pattern
 *
 * Implements CSRF protection using the double-submit cookie pattern:
 * 1. Server generates a random token and sets it as a cookie
 * 2. Client includes the token in request headers
 * 3. Server validates that cookie value matches header value
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create CSRF token for the current session
 * Used in server components to set the initial token
 */
export async function getOrCreateCSRFToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!token) {
    token = generateCSRFToken();
    // Cookie will be set in the response
  }

  return token;
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // Both must be present
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * CSRF protection middleware for API routes
 * Call this at the start of state-changing API handlers (POST, PUT, DELETE, PATCH)
 */
export function requireCSRF(request: NextRequest): NextResponse | null {
  // Skip CSRF check for safe methods
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  // Skip CSRF for API routes that use other auth (e.g., API keys)
  if (request.headers.get('authorization')?.startsWith('Bearer ')) {
    return null;
  }

  // Validate CSRF token
  if (!validateCSRFToken(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Set CSRF cookie on response
 */
export function setCSRFCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCSRFToken();

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}

/**
 * React hook-compatible function to get CSRF token from cookie
 * Use this in client components
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }

  return null;
}

/**
 * Fetch wrapper that automatically includes CSRF token
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCSRFTokenFromCookie();

  const headers = new Headers(options.headers);
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent
  });
}
