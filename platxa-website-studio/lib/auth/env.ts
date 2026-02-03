/**
 * Environment configuration for authentication
 * All sensitive values are loaded from environment variables
 */

/**
 * Get the NextAuth secret from environment
 * This is required for JWT signing and encryption
 */
export function getAuthSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET;
}

/**
 * Get the base URL for authentication callbacks
 */
export function getAuthUrl(): string | undefined {
  return process.env.NEXTAUTH_URL;
}

/**
 * Check if demo mode is enabled for development
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Check if E2E test mode is enabled
 * When true, test users can be seeded and certain protections are relaxed
 */
export function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === "true" || process.env.PLAYWRIGHT_TEST === "true";
}

/**
 * Test user credentials for E2E testing
 * Only available when E2E test mode is enabled
 */
export const E2E_TEST_USER = {
  email: "e2e-test@platxa.dev",
  password: "E2ETestPassword123!",
  name: "E2E Test User",
} as const;
