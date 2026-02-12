/**
 * Production-grade safe localStorage wrapper
 * Handles JSON parse errors, quota exceeded, and other storage failures gracefully
 *
 * This prevents "Unexpected end of JSON input" and other storage-related crashes
 */

import type { StateStorage } from "zustand/middleware";

/**
 * Validate that a string is valid JSON
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe localStorage wrapper that handles all error cases gracefully
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;

    try {
      const value = localStorage.getItem(name);

      // Return null if no value
      if (!value) return null;

      // Validate JSON before returning to prevent parse errors downstream
      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Invalid JSON in "${name}", clearing corrupted data`);
        try {
          localStorage.removeItem(name);
        } catch {
          // Ignore removal errors
        }
        return null;
      }

      return value;
    } catch (error) {
      // Handle SecurityError (private browsing), QuotaExceededError, etc.
      console.warn(`[SafeStorage] Failed to read "${name}":`, error);
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;

    try {
      // Validate that we're storing valid JSON
      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Attempted to store invalid JSON in "${name}"`);
        return;
      }

      localStorage.setItem(name, value);
    } catch (error) {
      // Handle QuotaExceededError
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn(`[SafeStorage] Storage quota exceeded for "${name}", attempting cleanup`);

        // Try to clear old data and retry
        try {
          // Clear this specific key and try again
          localStorage.removeItem(name);
          localStorage.setItem(name, value);
        } catch {
          console.error(`[SafeStorage] Failed to save "${name}" even after cleanup`);
        }
      } else {
        console.warn(`[SafeStorage] Failed to save "${name}":`, error);
      }
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn(`[SafeStorage] Failed to remove "${name}":`, error);
    }
  },
};

/**
 * Safe sessionStorage wrapper (same pattern)
 */
export const safeSessionStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;

    try {
      const value = sessionStorage.getItem(name);
      if (!value) return null;

      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Invalid JSON in session "${name}", clearing`);
        try {
          sessionStorage.removeItem(name);
        } catch {
          // Ignore
        }
        return null;
      }

      return value;
    } catch (error) {
      console.warn(`[SafeStorage] Failed to read session "${name}":`, error);
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;

    try {
      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Attempted to store invalid JSON in session "${name}"`);
        return;
      }
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn(`[SafeStorage] Failed to save session "${name}":`, error);
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn(`[SafeStorage] Failed to remove session "${name}":`, error);
    }
  },
};

/**
 * Clear all Platxa-related storage (useful for debugging/reset)
 */
export function clearAllPlatxaStorage(): void {
  if (typeof window === "undefined") return;

  const prefixes = ["platxa-", "prompt-library"];

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && prefixes.some(p => key.startsWith(p))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

  } catch (error) {
    console.error("[SafeStorage] Failed to clear storage:", error);
  }
}
