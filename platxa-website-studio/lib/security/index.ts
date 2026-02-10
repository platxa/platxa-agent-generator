/**
 * Security Module - Centralized security utilities
 *
 * Exports all security-related functions for:
 * - Security headers (CSP, HSTS, etc.)
 * - Code scanning for vulnerabilities
 * - CSRF protection
 */

// Security Headers
export {
  generateCSP,
  getSecurityHeaders,
  applySecurityHeaders,
  securityHeadersMiddleware,
  generateNonce,
  type SecurityHeadersConfig,
} from './headers';

// Code Scanner
export {
  scanFile,
  scanFiles,
  getScanSummary,
  formatScanReport,
  type SecurityIssue,
  type ScanResult,
  type SeverityLevel,
} from './code-scanner';

// CSRF Protection
export {
  generateCSRFToken,
  getOrCreateCSRFToken,
  validateCSRFToken,
  requireCSRF,
  setCSRFCookie,
  getCSRFTokenFromCookie,
  csrfFetch,
} from './csrf';
