/**
 * Fuzzy Pattern Matching Engine
 *
 * Matches patterns with minor variations in wording or formatting:
 * - Handles typos and misspellings
 * - Normalizes whitespace and punctuation
 * - Supports synonym matching
 * - Calculates similarity scores
 */

// =============================================================================
// Types
// =============================================================================

/** Pattern definition for fuzzy matching */
export interface FuzzyPattern {
  /** Pattern identifier */
  id: string;
  /** Keywords to match (order matters for phrase matching) */
  keywords: string[];
  /** Optional synonyms for keywords */
  synonyms?: Record<string, string[]>;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Pattern category */
  category?: string;
  /** Associated data */
  data?: Record<string, unknown>;
}

/** Match result from fuzzy matching */
export interface FuzzyMatch {
  /** Matched pattern */
  pattern: FuzzyPattern;
  /** Overall similarity score (0-1) */
  score: number;
  /** Individual keyword match scores */
  keywordScores: Record<string, number>;
  /** Matched text segments */
  matchedSegments: string[];
  /** Original input text */
  input: string;
  /** Normalized input text */
  normalizedInput: string;
}

/** Configuration for fuzzy matcher */
export interface FuzzyMatcherConfig {
  /** Default similarity threshold (0-1) */
  defaultThreshold: number;
  /** Enable case-insensitive matching */
  caseInsensitive: boolean;
  /** Enable whitespace normalization */
  normalizeWhitespace: boolean;
  /** Enable punctuation removal */
  removePunctuation: boolean;
  /** Maximum edit distance for typo tolerance */
  maxEditDistance: number;
  /** Weight for keyword order matching */
  orderWeight: number;
  /** Weight for exact matches */
  exactMatchBonus: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default fuzzy matcher configuration */
export const DEFAULT_FUZZY_CONFIG: FuzzyMatcherConfig = {
  defaultThreshold: 0.6,
  caseInsensitive: true,
  normalizeWhitespace: true,
  removePunctuation: true,
  maxEditDistance: 2,
  orderWeight: 0.1,
  exactMatchBonus: 0.2,
};

// =============================================================================
// String Similarity Functions
// =============================================================================

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates normalized similarity score (0-1) based on Levenshtein distance.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Calculates Jaro-Winkler similarity score (0-1).
 * Better for short strings and typo detection.
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification - bonus for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Combines multiple similarity metrics for better accuracy.
 */
export function combinedSimilarity(a: string, b: string): number {
  const levenshtein = stringSimilarity(a, b);
  const jaroWinkler = jaroWinklerSimilarity(a, b);

  // Weight Jaro-Winkler higher for short strings
  const shortString = Math.min(a.length, b.length) < 5;
  if (shortString) {
    return jaroWinkler * 0.7 + levenshtein * 0.3;
  }

  return levenshtein * 0.5 + jaroWinkler * 0.5;
}

// =============================================================================
// Text Normalization
// =============================================================================

/**
 * Normalizes text for fuzzy matching.
 */
export function normalizeText(
  text: string,
  config: Partial<FuzzyMatcherConfig> = {}
): string {
  const cfg = { ...DEFAULT_FUZZY_CONFIG, ...config };
  let result = text;

  if (cfg.caseInsensitive) {
    result = result.toLowerCase();
  }

  if (cfg.removePunctuation) {
    result = result.replace(/[^\w\s]/g, " ");
  }

  if (cfg.normalizeWhitespace) {
    result = result.replace(/\s+/g, " ").trim();
  }

  return result;
}

/**
 * Tokenizes text into words.
 */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

// =============================================================================
// Keyword Matching
// =============================================================================

/**
 * Finds the best match for a keyword in text tokens.
 */
export function findBestKeywordMatch(
  keyword: string,
  tokens: string[],
  synonyms: string[] = [],
  maxEditDistance: number = 2
): { token: string; score: number; index: number } | null {
  const normalizedKeyword = keyword.toLowerCase();
  const allVariants = [normalizedKeyword, ...synonyms.map((s) => s.toLowerCase())];

  let bestMatch: { token: string; score: number; index: number } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    for (const variant of allVariants) {
      // Exact match
      if (token === variant) {
        return { token, score: 1.0, index: i };
      }

      // Fuzzy match
      const similarity = combinedSimilarity(token, variant);
      const distance = levenshteinDistance(token, variant);

      if (distance <= maxEditDistance && similarity > (bestMatch?.score ?? 0)) {
        bestMatch = { token, score: similarity, index: i };
      }
    }
  }

  return bestMatch;
}

/**
 * Matches all keywords against text and calculates scores.
 */
export function matchKeywords(
  keywords: string[],
  text: string,
  synonyms: Record<string, string[]> = {},
  config: Partial<FuzzyMatcherConfig> = {}
): { scores: Record<string, number>; segments: string[]; orderScore: number } {
  const cfg = { ...DEFAULT_FUZZY_CONFIG, ...config };
  const tokens = tokenize(text);
  const scores: Record<string, number> = {};
  const segments: string[] = [];
  const matchIndices: number[] = [];

  for (const keyword of keywords) {
    const keywordSynonyms = synonyms[keyword] ?? [];
    const match = findBestKeywordMatch(
      keyword,
      tokens,
      keywordSynonyms,
      cfg.maxEditDistance
    );

    if (match) {
      scores[keyword] = match.score;
      segments.push(match.token);
      matchIndices.push(match.index);
    } else {
      scores[keyword] = 0;
    }
  }

  // Calculate order score (how well keywords appear in expected order)
  let orderScore = 1.0;
  if (matchIndices.length > 1) {
    let outOfOrder = 0;
    for (let i = 1; i < matchIndices.length; i++) {
      if (matchIndices[i] < matchIndices[i - 1]) {
        outOfOrder++;
      }
    }
    orderScore = 1 - outOfOrder / (matchIndices.length - 1);
  }

  return { scores, segments, orderScore };
}

// =============================================================================
// Pattern Matching
// =============================================================================

/**
 * Matches a single pattern against text.
 */
export function matchPattern(
  pattern: FuzzyPattern,
  text: string,
  config: Partial<FuzzyMatcherConfig> = {}
): FuzzyMatch | null {
  const cfg = { ...DEFAULT_FUZZY_CONFIG, ...config };
  const threshold = pattern.threshold ?? cfg.defaultThreshold;
  const normalizedInput = normalizeText(text, cfg);

  const { scores, segments, orderScore } = matchKeywords(
    pattern.keywords,
    text,
    pattern.synonyms ?? {},
    cfg
  );

  // Calculate overall score
  const keywordScoreValues = Object.values(scores);
  if (keywordScoreValues.length === 0) return null;

  const avgKeywordScore =
    keywordScoreValues.reduce((a, b) => a + b, 0) / keywordScoreValues.length;
  const matchedCount = keywordScoreValues.filter((s) => s > 0).length;
  const matchedRatio = matchedCount / keywordScoreValues.length;

  // Combine scores with weights
  // Base score from average keyword match quality * ratio of keywords matched
  let score = avgKeywordScore * matchedRatio;

  // Order bonus for keywords appearing in expected sequence
  score += orderScore * cfg.orderWeight;

  // Exact match bonus (but don't cap - we need full score for ranking)
  const hasExactMatches = keywordScoreValues.some((s) => s === 1);
  if (hasExactMatches) {
    score += cfg.exactMatchBonus;
  }

  // Keyword count bonus AFTER other bonuses to ensure patterns with more
  // matched keywords rank higher when all else is equal
  // This ensures "syntax error" beats "error" when both fully match
  const keywordCountBonus = matchedCount * 0.01;
  score += keywordCountBonus;

  if (score < threshold) return null;

  return {
    pattern,
    score,
    keywordScores: scores,
    matchedSegments: segments,
    input: text,
    normalizedInput,
  };
}

/**
 * Matches all patterns against text and returns sorted results.
 */
export function matchAllPatterns(
  patterns: FuzzyPattern[],
  text: string,
  config: Partial<FuzzyMatcherConfig> = {}
): FuzzyMatch[] {
  const matches: FuzzyMatch[] = [];

  for (const pattern of patterns) {
    const match = matchPattern(pattern, text, config);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Finds the best matching pattern.
 */
export function findBestMatch(
  patterns: FuzzyPattern[],
  text: string,
  config: Partial<FuzzyMatcherConfig> = {}
): FuzzyMatch | null {
  const matches = matchAllPatterns(patterns, text, config);
  return matches.length > 0 ? matches[0] : null;
}

// =============================================================================
// FuzzyPatternMatcher Class
// =============================================================================

/**
 * Fuzzy pattern matching engine with caching.
 */
export class FuzzyPatternMatcher {
  private patterns: FuzzyPattern[] = [];
  private config: FuzzyMatcherConfig;
  private cache: Map<string, FuzzyMatch[]> = new Map();
  private maxCacheSize: number = 1000;

  constructor(
    patterns: FuzzyPattern[] = [],
    config: Partial<FuzzyMatcherConfig> = {}
  ) {
    this.patterns = [...patterns];
    this.config = { ...DEFAULT_FUZZY_CONFIG, ...config };
  }

  /**
   * Adds a pattern to the matcher.
   */
  addPattern(pattern: FuzzyPattern): void {
    this.patterns.push(pattern);
    this.clearCache();
  }

  /**
   * Adds multiple patterns.
   */
  addPatterns(patterns: FuzzyPattern[]): void {
    this.patterns.push(...patterns);
    this.clearCache();
  }

  /**
   * Removes a pattern by ID.
   */
  removePattern(id: string): boolean {
    const index = this.patterns.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.patterns.splice(index, 1);
    this.clearCache();
    return true;
  }

  /**
   * Gets all patterns.
   */
  getPatterns(): FuzzyPattern[] {
    return [...this.patterns];
  }

  /**
   * Gets patterns by category.
   */
  getPatternsByCategory(category: string): FuzzyPattern[] {
    return this.patterns.filter((p) => p.category === category);
  }

  /**
   * Matches text against all patterns.
   */
  match(text: string): FuzzyMatch[] {
    const cacheKey = text;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const matches = matchAllPatterns(this.patterns, text, this.config);

    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, matches);
    return matches;
  }

  /**
   * Finds the best matching pattern.
   */
  findBest(text: string): FuzzyMatch | null {
    const matches = this.match(text);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Checks if any pattern matches.
   */
  hasMatch(text: string): boolean {
    return this.match(text).length > 0;
  }

  /**
   * Matches against patterns in a specific category.
   */
  matchInCategory(text: string, category: string): FuzzyMatch[] {
    const categoryPatterns = this.getPatternsByCategory(category);
    return matchAllPatterns(categoryPatterns, text, this.config);
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<FuzzyMatcherConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }

  /**
   * Gets current configuration.
   */
  getConfig(): FuzzyMatcherConfig {
    return { ...this.config };
  }

  /**
   * Clears the match cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a FuzzyPatternMatcher instance.
 */
export function createFuzzyMatcher(
  patterns?: FuzzyPattern[],
  config?: Partial<FuzzyMatcherConfig>
): FuzzyPatternMatcher {
  return new FuzzyPatternMatcher(patterns, config);
}

/**
 * Creates a pattern from keywords.
 */
export function createPattern(
  id: string,
  keywords: string[],
  options: Partial<Omit<FuzzyPattern, "id" | "keywords">> = {}
): FuzzyPattern {
  return {
    id,
    keywords,
    ...options,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if text contains a phrase (fuzzy).
 */
export function containsPhrase(
  text: string,
  phrase: string,
  threshold: number = 0.7
): boolean {
  const pattern = createPattern("temp", phrase.split(/\s+/), { threshold });
  const match = matchPattern(pattern, text);
  return match !== null;
}

/**
 * Extracts the most similar segment from text.
 */
export function extractSimilarSegment(
  text: string,
  target: string,
  windowSize?: number
): { segment: string; score: number; position: number } | null {
  const tokens = tokenize(text);
  const targetTokens = tokenize(target);
  const size = windowSize ?? targetTokens.length;

  if (tokens.length < size) {
    const score = combinedSimilarity(
      tokens.join(" "),
      targetTokens.join(" ")
    );
    return { segment: tokens.join(" "), score, position: 0 };
  }

  let bestMatch: { segment: string; score: number; position: number } | null = null;

  for (let i = 0; i <= tokens.length - size; i++) {
    const segment = tokens.slice(i, i + size).join(" ");
    const score = combinedSimilarity(segment, targetTokens.join(" "));

    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { segment, score, position: i };
    }
  }

  return bestMatch;
}

/**
 * Suggests corrections for misspelled words.
 */
export function suggestCorrections(
  word: string,
  dictionary: string[],
  maxSuggestions: number = 3
): Array<{ word: string; score: number }> {
  const normalizedWord = word.toLowerCase();
  const suggestions: Array<{ word: string; score: number }> = [];

  for (const dictWord of dictionary) {
    const score = combinedSimilarity(normalizedWord, dictWord.toLowerCase());
    if (score > 0.5) {
      suggestions.push({ word: dictWord, score });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

/**
 * Groups matches by category.
 */
export function groupMatchesByCategory(
  matches: FuzzyMatch[]
): Record<string, FuzzyMatch[]> {
  const groups: Record<string, FuzzyMatch[]> = {};

  for (const match of matches) {
    const category = match.pattern.category ?? "uncategorized";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(match);
  }

  return groups;
}

/**
 * Formats match result for display.
 */
export function formatMatch(match: FuzzyMatch): string {
  const scorePercent = Math.round(match.score * 100);
  const parts = [
    `Pattern: ${match.pattern.id}`,
    `Score: ${scorePercent}%`,
    `Matched: ${match.matchedSegments.join(", ")}`,
  ];

  if (match.pattern.category) {
    parts.push(`Category: ${match.pattern.category}`);
  }

  return parts.join(" | ");
}
