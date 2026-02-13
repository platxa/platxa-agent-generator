/**
 * Production-grade safe storage wrapper with IndexedDB fallback
 * Handles JSON parse errors, quota exceeded, and other storage failures gracefully
 *
 * Storage strategy:
 * - Try localStorage first (fast, synchronous)
 * - On QuotaExceededError, fall back to IndexedDB (larger quota)
 * - Reads check localStorage first, then IDB
 */

import type { StateStorage } from "zustand/middleware";

// =============================================================================
// JSON validation
// =============================================================================

function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// IndexedDB adapter (lazy-initialized on first quota error)
// =============================================================================

const IDB_NAME = "platxa-storage";
const IDB_STORE = "platxa-kv";

let idbInstance: IDBDatabase | null = null;
let idbInitPromise: Promise<IDBDatabase | null> | null = null;

/** Check if IndexedDB is available (not in SSR or some private browsing modes) */
export function isIdbAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openIdb(): Promise<IDBDatabase | null> {
  if (idbInstance) return Promise.resolve(idbInstance);
  if (idbInitPromise) return idbInitPromise;

  if (!isIdbAvailable()) return Promise.resolve(null);

  idbInitPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        idbInstance = request.result;
        resolve(idbInstance);
      };
      request.onerror = () => {
        console.warn("[SafeStorage] Failed to open IndexedDB:", request.error);
        idbInitPromise = null;
        resolve(null);
      };
    } catch {
      idbInitPromise = null;
      resolve(null);
    }
  });

  return idbInitPromise;
}

function idbGet(key: string): Promise<string | null> {
  return openIdb().then((db) => {
    if (!db) return null;
    return new Promise<string | null>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

function idbSet(key: string, value: string): Promise<boolean> {
  return openIdb().then((db) => {
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const request = store.put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  });
}

function idbRemove(key: string): Promise<void> {
  return openIdb().then((db) => {
    if (!db) return;
    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

function idbClearAll(): Promise<void> {
  return openIdb().then((db) => {
    if (!db) return;
    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

// Track which keys have been promoted to IDB (avoid unnecessary IDB reads)
const idbKeys = new Set<string>();

// =============================================================================
// Safe localStorage with IDB fallback
// =============================================================================

export const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;

    try {
      const value = localStorage.getItem(name);

      if (value) {
        if (!isValidJson(value)) {
          console.warn(`[SafeStorage] Invalid JSON in "${name}", clearing corrupted data`);
          try { localStorage.removeItem(name); } catch { /* ignore */ }
          return null;
        }
        return value;
      }

      // Only check IDB for keys we know were promoted there (avoids async for normal misses)
      if (idbKeys.has(name)) {
        return idbGet(name) as unknown as string | null;
      }

      return null;
    } catch (error) {
      console.warn(`[SafeStorage] Failed to read "${name}":`, error);
      // Try IDB as fallback for read errors too
      return idbGet(name) as unknown as string | null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;

    try {
      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Attempted to store invalid JSON in "${name}"`);
        return;
      }

      localStorage.setItem(name, value);
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn(`[SafeStorage] Quota exceeded for "${name}", falling back to IndexedDB`);
        idbKeys.add(name);
        // Store in IDB instead (async, fire-and-forget)
        idbSet(name, value).catch(() => {
          console.error(`[SafeStorage] IDB fallback also failed for "${name}"`);
        });
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

    // Also remove from IDB
    idbKeys.delete(name);
    idbRemove(name).catch(() => { /* ignore */ });
  },
};

// =============================================================================
// Safe sessionStorage (unchanged - session data is small)
// =============================================================================

export const safeSessionStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;

    try {
      const value = sessionStorage.getItem(name);
      if (!value) return null;

      if (!isValidJson(value)) {
        console.warn(`[SafeStorage] Invalid JSON in session "${name}", clearing`);
        try { sessionStorage.removeItem(name); } catch { /* ignore */ }
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

// =============================================================================
// Clear all Platxa storage (localStorage + IDB)
// =============================================================================

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
    console.error("[SafeStorage] Failed to clear localStorage:", error);
  }

  // Also clear IDB store
  idbKeys.clear();
  idbClearAll().catch((error) => {
    console.error("[SafeStorage] Failed to clear IndexedDB:", error);
  });
}

// Export IDB helpers for testing
export const _idbHelpers = { openIdb, idbGet, idbSet, idbRemove, idbClearAll, idbKeys };
