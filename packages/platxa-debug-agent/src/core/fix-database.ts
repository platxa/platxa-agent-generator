/**
 * RAG System with Historical Bug-Fix Database
 *
 * Provides retrieval-augmented generation capabilities by storing
 * historical bug-fix pairs and retrieving similar past bugs.
 *
 * @module fix-database
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import type { CodeChange, Language, NormalizedError } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A bug-fix entry in the database
 */
export interface BugFixEntry {
  /** Unique identifier */
  id: string;
  /** Error type (e.g., "TypeError", "SyntaxError") */
  errorType: string;
  /** Error message */
  errorMessage: string;
  /** Programming language */
  language: Language;
  /** Error code if available */
  errorCode?: string;
  /** Code context where error occurred */
  codeContext?: string;
  /** The fix that resolved this error */
  fix: BugFix;
  /** Tags for categorization */
  tags: string[];
  /** When this entry was created */
  createdAt: Date;
  /** Number of times this fix was applied */
  useCount: number;
  /** Success rate of this fix (0-1) */
  successRate: number;
  /** Source of this entry */
  source: 'manual' | 'learned' | 'imported';
}

/**
 * A fix for a bug
 */
export interface BugFix {
  /** Description of the fix */
  description: string;
  /** Code changes to apply */
  changes: CodeChange[];
  /** Explanation of why this fix works */
  explanation?: string;
  /** Validation commands */
  validationCommands?: string[];
}

/**
 * Search query for finding similar bugs
 */
export interface BugSearchQuery {
  /** Error type to match */
  errorType?: string;
  /** Error message to match (fuzzy) */
  errorMessage?: string;
  /** Language filter */
  language?: Language;
  /** Error code to match */
  errorCode?: string;
  /** Code context for similarity */
  codeContext?: string;
  /** Tags to filter by */
  tags?: string[];
  /** Maximum results to return */
  limit?: number;
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
}

/**
 * Search result from the database
 */
export interface BugSearchResult {
  /** The matching entry */
  entry: BugFixEntry;
  /** Similarity score (0-1) */
  similarity: number;
  /** Breakdown of similarity components */
  similarityBreakdown: SimilarityBreakdown;
}

/**
 * Breakdown of similarity score components
 */
export interface SimilarityBreakdown {
  /** Error type similarity */
  errorTypeSimilarity: number;
  /** Error message similarity */
  messageSimilarity: number;
  /** Code context similarity */
  codeSimilarity: number;
  /** Tag overlap */
  tagOverlap: number;
}

/**
 * Database configuration
 */
export interface FixDatabaseConfig {
  /** Path to database file */
  databasePath?: string;
  /** Enable auto-save after modifications */
  autoSave?: boolean;
  /** Maximum entries to keep */
  maxEntries?: number;
  /** Minimum similarity for retrieval */
  defaultMinSimilarity?: number;
  /** Default result limit */
  defaultLimit?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  /** Total number of entries */
  totalEntries: number;
  /** Entries by language */
  byLanguage: Record<string, number>;
  /** Entries by error type */
  byErrorType: Record<string, number>;
  /** Average success rate */
  averageSuccessRate: number;
  /** Most used fixes */
  topFixes: Array<{ id: string; useCount: number }>;
}

// =============================================================================
// TF-IDF Implementation
// =============================================================================

/**
 * Simple TF-IDF implementation for text similarity
 */
class TFIDFIndex {
  /** Document frequency for each term */
  private readonly documentFrequency: Map<string, number> = new Map();
  /** Total number of documents */
  private documentCount: number = 0;
  /** Cached TF-IDF vectors by document ID */
  private readonly vectors: Map<string, Map<string, number>> = new Map();

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  /**
   * Calculate term frequency for a document
   */
  private calculateTF(terms: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const term of terms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
    // Normalize by document length
    const maxFreq = Math.max(...tf.values());
    if (maxFreq > 0) {
      for (const [term, freq] of tf) {
        tf.set(term, freq / maxFreq);
      }
    }
    return tf;
  }

  /**
   * Add a document to the index
   */
  addDocument(id: string, text: string): void {
    const terms = this.tokenize(text);
    const uniqueTerms = new Set(terms);

    // Update document frequency
    for (const term of uniqueTerms) {
      this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
    }
    this.documentCount++;

    // Calculate and store TF-IDF vector
    const tf = this.calculateTF(terms);
    const vector = new Map<string, number>();
    for (const [term, tfValue] of tf) {
      const df = this.documentFrequency.get(term) ?? 1;
      const idf = Math.log(this.documentCount / df);
      vector.set(term, tfValue * idf);
    }
    this.vectors.set(id, vector);
  }

  /**
   * Remove a document from the index
   */
  removeDocument(id: string): void {
    const vector = this.vectors.get(id);
    if (vector === undefined) return;

    // Update document frequency
    for (const term of vector.keys()) {
      const df = this.documentFrequency.get(term);
      if (df !== undefined) {
        if (df <= 1) {
          this.documentFrequency.delete(term);
        } else {
          this.documentFrequency.set(term, df - 1);
        }
      }
    }
    this.documentCount--;
    this.vectors.delete(id);
  }

  /**
   * Calculate cosine similarity between query and a document
   */
  similarity(queryText: string, documentId: string): number {
    const docVector = this.vectors.get(documentId);
    if (docVector === undefined) return 0;

    // Calculate query vector
    const queryTerms = this.tokenize(queryText);
    const queryTF = this.calculateTF(queryTerms);
    const queryVector = new Map<string, number>();
    for (const [term, tfValue] of queryTF) {
      const df = this.documentFrequency.get(term) ?? 1;
      const idf = Math.log((this.documentCount + 1) / df);
      queryVector.set(term, tfValue * idf);
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let queryNorm = 0;
    let docNorm = 0;

    for (const [term, value] of queryVector) {
      queryNorm += value * value;
      const docValue = docVector.get(term);
      if (docValue !== undefined) {
        dotProduct += value * docValue;
      }
    }

    for (const value of docVector.values()) {
      docNorm += value * value;
    }

    queryNorm = Math.sqrt(queryNorm);
    docNorm = Math.sqrt(docNorm);

    if (queryNorm === 0 || docNorm === 0) return 0;
    return dotProduct / (queryNorm * docNorm);
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.documentFrequency.clear();
    this.vectors.clear();
    this.documentCount = 0;
  }
}

// =============================================================================
// Inverted Index Implementation
// =============================================================================

/**
 * Inverted index for fast lookups
 */
class InvertedIndex {
  /** Index by error type */
  private readonly byErrorType: Map<string, Set<string>> = new Map();
  /** Index by language */
  private readonly byLanguage: Map<Language, Set<string>> = new Map();
  /** Index by error code */
  private readonly byErrorCode: Map<string, Set<string>> = new Map();
  /** Index by tags */
  private readonly byTag: Map<string, Set<string>> = new Map();

  /**
   * Add an entry to the index
   */
  addEntry(entry: BugFixEntry): void {
    // Index by error type
    const typeSet = this.byErrorType.get(entry.errorType) ?? new Set();
    typeSet.add(entry.id);
    this.byErrorType.set(entry.errorType, typeSet);

    // Index by language
    const langSet = this.byLanguage.get(entry.language) ?? new Set();
    langSet.add(entry.id);
    this.byLanguage.set(entry.language, langSet);

    // Index by error code
    if (entry.errorCode !== undefined) {
      const codeSet = this.byErrorCode.get(entry.errorCode) ?? new Set();
      codeSet.add(entry.id);
      this.byErrorCode.set(entry.errorCode, codeSet);
    }

    // Index by tags
    for (const tag of entry.tags) {
      const tagSet = this.byTag.get(tag) ?? new Set();
      tagSet.add(entry.id);
      this.byTag.set(tag, tagSet);
    }
  }

  /**
   * Remove an entry from the index
   */
  removeEntry(entry: BugFixEntry): void {
    this.byErrorType.get(entry.errorType)?.delete(entry.id);
    this.byLanguage.get(entry.language)?.delete(entry.id);
    if (entry.errorCode !== undefined) {
      this.byErrorCode.get(entry.errorCode)?.delete(entry.id);
    }
    for (const tag of entry.tags) {
      this.byTag.get(tag)?.delete(entry.id);
    }
  }

  /**
   * Get candidate IDs matching the query filters
   */
  getCandidates(query: BugSearchQuery): Set<string> | null {
    const candidateSets: Set<string>[] = [];

    if (query.errorType !== undefined) {
      const set = this.byErrorType.get(query.errorType);
      if (set !== undefined && set.size > 0) {
        candidateSets.push(set);
      }
    }

    if (query.language !== undefined) {
      const set = this.byLanguage.get(query.language);
      if (set !== undefined && set.size > 0) {
        candidateSets.push(set);
      }
    }

    if (query.errorCode !== undefined) {
      const set = this.byErrorCode.get(query.errorCode);
      if (set !== undefined && set.size > 0) {
        candidateSets.push(set);
      }
    }

    if (query.tags !== undefined && query.tags.length > 0) {
      const tagCandidates = new Set<string>();
      for (const tag of query.tags) {
        const set = this.byTag.get(tag);
        if (set !== undefined) {
          for (const id of set) {
            tagCandidates.add(id);
          }
        }
      }
      if (tagCandidates.size > 0) {
        candidateSets.push(tagCandidates);
      }
    }

    if (candidateSets.length === 0) {
      return null; // No filters, return all
    }

    // Intersect all candidate sets
    let result = candidateSets[0];
    if (result === undefined) return null;

    for (let i = 1; i < candidateSets.length; i++) {
      const nextSet = candidateSets[i];
      if (nextSet === undefined) continue;
      result = new Set([...result].filter((id) => nextSet.has(id)));
    }

    return result;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.byErrorType.clear();
    this.byLanguage.clear();
    this.byErrorCode.clear();
    this.byTag.clear();
  }
}

// =============================================================================
// Fix Database Implementation
// =============================================================================

/**
 * RAG System with Historical Bug-Fix Database
 *
 * Stores and retrieves historical bug-fix pairs for
 * retrieval-augmented fix generation.
 */
export class FixDatabase {
  /** Database configuration */
  private readonly config: Required<FixDatabaseConfig>;

  /** Bug-fix entries storage */
  private readonly entries: Map<string, BugFixEntry> = new Map();

  /** TF-IDF index for message similarity */
  private readonly messageIndex: TFIDFIndex = new TFIDFIndex();

  /** TF-IDF index for code similarity */
  private readonly codeIndex: TFIDFIndex = new TFIDFIndex();

  /** Inverted index for fast filtering */
  private readonly invertedIndex: InvertedIndex = new InvertedIndex();

  /** Whether the database has been modified */
  private isDirty: boolean = false;

  constructor(config: FixDatabaseConfig = {}) {
    this.config = {
      databasePath: config.databasePath ?? join(process.cwd(), '.debug-agent', 'fix-database.json'),
      autoSave: config.autoSave ?? true,
      maxEntries: config.maxEntries ?? 10000,
      defaultMinSimilarity: config.defaultMinSimilarity ?? 0.3,
      defaultLimit: config.defaultLimit ?? 10,
    };

    // Load existing database
    this.load();
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Add a new bug-fix entry to the database
   *
   * @param entry - Entry to add (id will be generated if not provided)
   * @returns The added entry
   */
  addEntry(entry: Omit<BugFixEntry, 'id' | 'createdAt' | 'useCount' | 'successRate'> & { id?: string }): BugFixEntry {
    const id = entry.id ?? this.generateId(entry);

    const fullEntry: BugFixEntry = {
      ...entry,
      id,
      createdAt: new Date(),
      useCount: 0,
      successRate: 1.0,
    };

    // Check max entries
    if (this.entries.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    // Add to storage and indexes
    this.entries.set(id, fullEntry);
    this.indexEntry(fullEntry);
    this.isDirty = true;

    if (this.config.autoSave) {
      this.save();
    }

    return fullEntry;
  }

  /**
   * Add a bug-fix from a normalized error and fix
   */
  addFromError(
    error: NormalizedError,
    fix: BugFix,
    options: { tags?: string[]; codeContext?: string } = {}
  ): BugFixEntry {
    const entry: Omit<BugFixEntry, 'id' | 'createdAt' | 'useCount' | 'successRate'> = {
      errorType: error.type,
      errorMessage: error.message,
      language: error.language,
      fix,
      tags: options.tags ?? [],
      source: 'learned',
    };

    if (error.code !== undefined) {
      entry.errorCode = error.code;
    }
    if (options.codeContext !== undefined) {
      entry.codeContext = options.codeContext;
    }

    return this.addEntry(entry);
  }

  /**
   * Get an entry by ID
   */
  getEntry(id: string): BugFixEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Update an existing entry
   */
  updateEntry(id: string, updates: Partial<BugFixEntry>): BugFixEntry | null {
    const existing = this.entries.get(id);
    if (existing === undefined) return null;

    // Remove from indexes
    this.unindexEntry(existing);

    // Apply updates
    const updated: BugFixEntry = { ...existing, ...updates, id };
    this.entries.set(id, updated);

    // Re-index
    this.indexEntry(updated);
    this.isDirty = true;

    if (this.config.autoSave) {
      this.save();
    }

    return updated;
  }

  /**
   * Delete an entry
   */
  deleteEntry(id: string): boolean {
    const entry = this.entries.get(id);
    if (entry === undefined) return false;

    this.unindexEntry(entry);
    this.entries.delete(id);
    this.isDirty = true;

    if (this.config.autoSave) {
      this.save();
    }

    return true;
  }

  /**
   * Record that a fix was used
   */
  recordUsage(id: string, success: boolean): void {
    const entry = this.entries.get(id);
    if (entry === undefined) return;

    entry.useCount++;
    // Update success rate with exponential moving average
    const alpha = 0.3;
    entry.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * entry.successRate;
    this.isDirty = true;

    if (this.config.autoSave) {
      this.save();
    }
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Search for similar bugs in the database
   *
   * @param query - Search query
   * @returns Matching entries sorted by similarity
   */
  search(query: BugSearchQuery): BugSearchResult[] {
    const limit = query.limit ?? this.config.defaultLimit;
    const minSimilarity = query.minSimilarity ?? this.config.defaultMinSimilarity;

    // Get candidates from inverted index
    const candidates = this.invertedIndex.getCandidates(query);
    const idsToSearch = candidates ?? new Set(this.entries.keys());

    const results: BugSearchResult[] = [];

    for (const id of idsToSearch) {
      const entry = this.entries.get(id);
      if (entry === undefined) continue;

      // Calculate similarity
      const breakdown = this.calculateSimilarity(query, entry);
      const similarity = this.combineSimilarity(breakdown);

      if (similarity >= minSimilarity) {
        results.push({ entry, similarity, similarityBreakdown: breakdown });
      }
    }

    // Sort by similarity (descending) and then by success rate
    results.sort((a, b) => {
      if (Math.abs(a.similarity - b.similarity) > 0.05) {
        return b.similarity - a.similarity;
      }
      return b.entry.successRate - a.entry.successRate;
    });

    return results.slice(0, limit);
  }

  /**
   * Find fixes for a normalized error
   */
  findFixesForError(
    error: NormalizedError,
    options: { codeContext?: string; limit?: number } = {}
  ): BugSearchResult[] {
    const query: BugSearchQuery = {
      errorType: error.type,
      errorMessage: error.message,
      language: error.language,
    };

    if (error.code !== undefined) {
      query.errorCode = error.code;
    }
    if (options.codeContext !== undefined) {
      query.codeContext = options.codeContext;
    }
    if (options.limit !== undefined) {
      query.limit = options.limit;
    }

    return this.search(query);
  }

  /**
   * Get the best fix for an error
   */
  getBestFix(error: NormalizedError, codeContext?: string): BugFix | null {
    const options: { codeContext?: string; limit?: number } = { limit: 1 };
    if (codeContext !== undefined) {
      options.codeContext = codeContext;
    }
    const results = this.findFixesForError(error, options);
    if (results.length === 0) return null;
    const topResult = results[0];
    return topResult !== undefined ? topResult.entry.fix : null;
  }

  // ===========================================================================
  // Similarity Calculation
  // ===========================================================================

  /**
   * Calculate similarity breakdown between query and entry
   */
  private calculateSimilarity(query: BugSearchQuery, entry: BugFixEntry): SimilarityBreakdown {
    // Error type similarity (exact match)
    const errorTypeSimilarity =
      query.errorType !== undefined && query.errorType === entry.errorType ? 1.0 : 0.0;

    // Message similarity (TF-IDF)
    let messageSimilarity = 0;
    if (query.errorMessage !== undefined) {
      messageSimilarity = this.messageIndex.similarity(query.errorMessage, entry.id);
    }

    // Code similarity (TF-IDF)
    let codeSimilarity = 0;
    if (query.codeContext !== undefined && entry.codeContext !== undefined) {
      codeSimilarity = this.codeIndex.similarity(query.codeContext, entry.id);
    }

    // Tag overlap (Jaccard similarity)
    let tagOverlap = 0;
    if (query.tags !== undefined && query.tags.length > 0 && entry.tags.length > 0) {
      const queryTags = new Set(query.tags);
      const entryTags = new Set(entry.tags);
      const intersection = [...queryTags].filter((t) => entryTags.has(t)).length;
      const union = new Set([...queryTags, ...entryTags]).size;
      tagOverlap = union > 0 ? intersection / union : 0;
    }

    return {
      errorTypeSimilarity,
      messageSimilarity,
      codeSimilarity,
      tagOverlap,
    };
  }

  /**
   * Combine similarity components into overall score
   */
  private combineSimilarity(breakdown: SimilarityBreakdown): number {
    // Weighted combination
    const weights = {
      errorType: 0.35,
      message: 0.35,
      code: 0.20,
      tags: 0.10,
    };

    return (
      weights.errorType * breakdown.errorTypeSimilarity +
      weights.message * breakdown.messageSimilarity +
      weights.code * breakdown.codeSimilarity +
      weights.tags * breakdown.tagOverlap
    );
  }

  // ===========================================================================
  // Indexing
  // ===========================================================================

  /**
   * Index an entry in all indexes
   */
  private indexEntry(entry: BugFixEntry): void {
    this.messageIndex.addDocument(entry.id, entry.errorMessage);
    if (entry.codeContext !== undefined) {
      this.codeIndex.addDocument(entry.id, entry.codeContext);
    }
    this.invertedIndex.addEntry(entry);
  }

  /**
   * Remove an entry from all indexes
   */
  private unindexEntry(entry: BugFixEntry): void {
    this.messageIndex.removeDocument(entry.id);
    if (entry.codeContext !== undefined) {
      this.codeIndex.removeDocument(entry.id);
    }
    this.invertedIndex.removeEntry(entry);
  }

  /**
   * Rebuild all indexes
   */
  rebuildIndexes(): void {
    this.messageIndex.clear();
    this.codeIndex.clear();
    this.invertedIndex.clear();

    for (const entry of this.entries.values()) {
      this.indexEntry(entry);
    }
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Load database from file
   */
  load(): void {
    if (!existsSync(this.config.databasePath)) {
      return;
    }

    try {
      const data = readFileSync(this.config.databasePath, 'utf-8');
      const parsed = JSON.parse(data) as { entries: BugFixEntry[] };

      this.entries.clear();
      this.messageIndex.clear();
      this.codeIndex.clear();
      this.invertedIndex.clear();

      for (const entry of parsed.entries) {
        // Convert date strings back to Date objects
        entry.createdAt = new Date(entry.createdAt);
        this.entries.set(entry.id, entry);
        this.indexEntry(entry);
      }

      this.isDirty = false;
    } catch {
      // Failed to load, start fresh
    }
  }

  /**
   * Save database to file
   */
  save(): void {
    if (!this.isDirty) return;

    const dir = dirname(this.config.databasePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const data = {
      version: 1,
      entries: Array.from(this.entries.values()),
    };

    writeFileSync(this.config.databasePath, JSON.stringify(data, null, 2));
    this.isDirty = false;
  }

  /**
   * Export database to JSON string
   */
  export(): string {
    return JSON.stringify(
      {
        version: 1,
        entries: Array.from(this.entries.values()),
      },
      null,
      2
    );
  }

  /**
   * Import entries from JSON string
   */
  import(json: string, merge: boolean = true): number {
    const data = JSON.parse(json) as { entries: BugFixEntry[] };
    let imported = 0;

    if (!merge) {
      this.clear();
    }

    for (const entry of data.entries) {
      entry.createdAt = new Date(entry.createdAt);
      if (!this.entries.has(entry.id)) {
        this.entries.set(entry.id, entry);
        this.indexEntry(entry);
        imported++;
      }
    }

    this.isDirty = true;
    if (this.config.autoSave) {
      this.save();
    }

    return imported;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generate a unique ID for an entry
   */
  private generateId(entry: Omit<BugFixEntry, 'id' | 'createdAt' | 'useCount' | 'successRate'>): string {
    const hash = createHash('sha256');
    hash.update(entry.errorType);
    hash.update(entry.errorMessage);
    hash.update(entry.language);
    hash.update(entry.fix.description);
    hash.update(Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Evict oldest, least-used entry
   */
  private evictOldest(): void {
    let oldestEntry: BugFixEntry | null = null;
    let lowestScore = Infinity;

    for (const entry of this.entries.values()) {
      // Score: lower is more evictable
      // Based on recency, use count, and success rate
      const ageMs = Date.now() - entry.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const score = entry.useCount * entry.successRate / (1 + ageDays);

      if (score < lowestScore) {
        lowestScore = score;
        oldestEntry = entry;
      }
    }

    if (oldestEntry !== null) {
      this.deleteEntry(oldestEntry.id);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.messageIndex.clear();
    this.codeIndex.clear();
    this.invertedIndex.clear();
    this.isDirty = true;

    if (this.config.autoSave) {
      this.save();
    }
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const byLanguage: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};
    let totalSuccessRate = 0;

    for (const entry of this.entries.values()) {
      byLanguage[entry.language] = (byLanguage[entry.language] ?? 0) + 1;
      byErrorType[entry.errorType] = (byErrorType[entry.errorType] ?? 0) + 1;
      totalSuccessRate += entry.successRate;
    }

    // Get top fixes by use count
    const topFixes = Array.from(this.entries.values())
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 10)
      .map((e) => ({ id: e.id, useCount: e.useCount }));

    return {
      totalEntries: this.entries.size,
      byLanguage,
      byErrorType,
      averageSuccessRate: this.entries.size > 0 ? totalSuccessRate / this.entries.size : 0,
      topFixes,
    };
  }

  /**
   * Get the number of entries
   */
  get size(): number {
    return this.entries.size;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FixDatabase instance
 *
 * @param config - Database configuration
 * @returns FixDatabase instance
 */
export function createFixDatabase(config?: FixDatabaseConfig): FixDatabase {
  return new FixDatabase(config);
}

/**
 * Create a FixDatabase with pre-populated common fixes
 */
export function createFixDatabaseWithDefaults(config?: FixDatabaseConfig): FixDatabase {
  const db = new FixDatabase(config);

  // Add common Python fixes
  db.addEntry({
    errorType: 'NameError',
    errorMessage: "name 'undefined_var' is not defined",
    language: 'python',
    fix: {
      description: 'Define the variable before using it or import it from a module',
      changes: [],
      explanation: 'Python requires variables to be defined before use',
    },
    tags: ['python', 'undefined', 'variable'],
    source: 'manual',
  });

  db.addEntry({
    errorType: 'ImportError',
    errorMessage: "No module named 'missing_module'",
    language: 'python',
    fix: {
      description: 'Install the missing module using pip',
      changes: [],
      explanation: 'The module needs to be installed in the Python environment',
      validationCommands: ['pip install missing_module'],
    },
    tags: ['python', 'import', 'dependency'],
    source: 'manual',
  });

  // Add common JavaScript/TypeScript fixes
  db.addEntry({
    errorType: 'TypeError',
    errorMessage: "Cannot read properties of undefined",
    language: 'javascript',
    fix: {
      description: 'Add null/undefined check or use optional chaining (?.) operator',
      changes: [],
      explanation: 'Accessing properties on undefined/null causes TypeError',
    },
    tags: ['javascript', 'null', 'undefined', 'optional-chaining'],
    source: 'manual',
  });

  db.addEntry({
    errorType: 'ReferenceError',
    errorMessage: "is not defined",
    language: 'javascript',
    fix: {
      description: 'Import or declare the variable/function before use',
      changes: [],
      explanation: 'Variables must be declared or imported before use in JavaScript',
    },
    tags: ['javascript', 'undefined', 'import'],
    source: 'manual',
  });

  return db;
}
