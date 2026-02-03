import "@testing-library/jest-dom/vitest";
import { vi, beforeEach } from "vitest";

/**
 * Global Test Setup for Platxa Website Studio
 *
 * Provides mocks for browser/network APIs that aren't available in test environment:
 * - fetch: Mocked to simulate network errors for graceful degradation testing
 * - clipboard: Mocked to allow clipboard operations in tests
 */

// Create a mock fetch that simulates network errors for services that aren't running
// This allows tools with graceful degradation (like preview_render) to work correctly
const mockFetch = vi.fn().mockImplementation((url: string) => {
  // Simulate network error for preview service (triggers graceful degradation)
  if (url.includes('/api/preview/') || url.includes('localhost:8766')) {
    return Promise.reject(new TypeError('fetch failed: ECONNREFUSED'));
  }

  // Default: return a basic success response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  });
});

// Set up global fetch mock
global.fetch = mockFetch;

// Reset fetch mock before each test to clear call history
beforeEach(() => {
  mockFetch.mockClear();
});

// Mock clipboard API for tests (only if not already defined)
if (typeof navigator !== "undefined" && !navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    writable: true,
    configurable: true,
  });
}
