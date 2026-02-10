/**
 * Security Headers - CSP, HSTS, and other security headers
 *
 * Implements OWASP recommended security headers for web applications.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security header configuration
 */
export interface SecurityHeadersConfig {
  /** Enable strict CSP (blocks inline scripts) */
  strictCSP: boolean;
  /** CSP nonce for inline scripts (generated per request) */
  nonce?: string;
  /** Additional allowed script sources */
  scriptSrc?: string[];
  /** Additional allowed style sources */
  styleSrc?: string[];
  /** Additional allowed image sources */
  imgSrc?: string[];
  /** Additional allowed connect sources (API endpoints) */
  connectSrc?: string[];
  /** Frame ancestors (who can embed this site) */
  frameAncestors?: string[];
  /** Enable HSTS (only in production) */
  enableHSTS: boolean;
  /** HSTS max age in seconds (default: 1 year) */
  hstsMaxAge?: number;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  strictCSP: false,
  enableHSTS: process.env.NODE_ENV === 'production',
  hstsMaxAge: 31536000, // 1 year
  scriptSrc: [],
  styleSrc: [],
  imgSrc: [],
  connectSrc: [],
  frameAncestors: ["'self'"],
};

/**
 * Generate Content-Security-Policy header value
 */
export function generateCSP(config: SecurityHeadersConfig = DEFAULT_CONFIG): string {
  const nonce = config.nonce ? `'nonce-${config.nonce}'` : '';

  // Base directives
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // Scripts: self + nonce for inline + any additional sources
    'script-src': [
      "'self'",
      nonce,
      // Allow unsafe-inline for development (React HMR)
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
      ...(config.scriptSrc || []),
    ].filter(Boolean),

    // Styles: self + inline (many UI libraries need this)
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-jsx, emotion, etc.
      ...(config.styleSrc || []),
    ],

    // Images: self, data URIs, blobs, and external sources
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.githubusercontent.com', // GitHub avatars
      'https://*.googleusercontent.com', // Google avatars
      ...(config.imgSrc || []),
    ],

    // Fonts: self and Google Fonts
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],

    // API connections
    'connect-src': [
      "'self'",
      'https://api.anthropic.com', // Claude API
      'https://api.openai.com', // OpenAI API
      'https://api.github.com', // GitHub API
      ...(process.env.NODE_ENV === 'development' ? ['ws://localhost:*', 'http://localhost:*'] : []),
      ...(config.connectSrc || []),
    ],

    // Frame ancestors (who can embed this page)
    'frame-ancestors': config.frameAncestors || ["'self'"],

    // Form submissions
    'form-action': ["'self'"],

    // Base URI
    'base-uri': ["'self'"],

    // Object sources (plugins)
    'object-src': ["'none'"],

    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === 'production' ? { 'upgrade-insecure-requests': [] } : {}),
  };

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Get all security headers for a request
 */
export function getSecurityHeaders(config: SecurityHeadersConfig = DEFAULT_CONFIG): Record<string, string> {
  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': generateCSP(config),

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'SAMEORIGIN',

    // XSS Protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy (formerly Feature-Policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()', // Disable FLoC
    ].join(', '),

    // DNS Prefetch Control
    'X-DNS-Prefetch-Control': 'on',
  };

  // Add HSTS in production
  if (config.enableHSTS) {
    headers['Strict-Transport-Security'] = `max-age=${config.hstsMaxAge || 31536000}; includeSubDomains; preload`;
  }

  return headers;
}

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): NextResponse {
  const headers = getSecurityHeaders(config);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  request: NextRequest,
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): NextResponse {
  const response = NextResponse.next();
  return applySecurityHeaders(response, config);
}

/**
 * Generate a cryptographic nonce for CSP
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}
