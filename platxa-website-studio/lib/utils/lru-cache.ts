/**
 * LRU Cache with optional TTL and eviction callbacks.
 * Drop-in replacement for Map (compatible subset).
 */

export type EvictReason = "evicted" | "expired" | "deleted";

export interface LRUCacheOptions<K, V> {
  /** Maximum number of entries */
  maxSize: number;
  /** Time-to-live in milliseconds (optional) */
  ttl?: number;
  /** Called when an entry is removed */
  onEvict?: (key: K, value: V, reason: EvictReason) => void;
}

interface CacheEntry<V> {
  value: V;
  createdAt: number;
}

export class LRUCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttl?: number;
  private readonly onEvict?: (key: K, value: V, reason: EvictReason) => void;

  constructor(options: LRUCacheOptions<K, V>) {
    if (options.maxSize < 1) {
      throw new Error("maxSize must be at least 1");
    }
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.onEvict = options.onEvict;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    // Check TTL expiry
    if (this.ttl !== undefined && Date.now() - entry.createdAt > this.ttl) {
      this.map.delete(key);
      this.onEvict?.(key, entry.value, "expired");
      return undefined;
    }

    // Refresh LRU order: delete and re-insert so it's the most recent
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V): this {
    // If key already exists, delete it first (will be re-inserted at end)
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    // Evict LRU entry if at capacity
    if (this.map.size >= this.maxSize) {
      const lruKey = this.map.keys().next().value!;
      const lruEntry = this.map.get(lruKey)!;
      this.map.delete(lruKey);
      this.onEvict?.(lruKey, lruEntry.value, "evicted");
    }

    this.map.set(key, { value, createdAt: Date.now() });
    return this;
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;

    // Check TTL - expired entries are treated as absent
    if (this.ttl !== undefined && Date.now() - entry.createdAt > this.ttl) {
      this.map.delete(key);
      this.onEvict?.(key, entry.value, "expired");
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;

    this.map.delete(key);
    this.onEvict?.(key, entry.value, "deleted");
    return true;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }
}
