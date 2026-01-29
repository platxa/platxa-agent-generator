import { describe, it, expect, beforeEach } from "vitest";
import {
  FuzzyPatternMatcher,
  createFuzzyMatcher,
  createPattern,
  matchPattern,
  matchAllPatterns,
  findBestMatch,
  levenshteinDistance,
  stringSimilarity,
  jaroWinklerSimilarity,
  combinedSimilarity,
  normalizeText,
  tokenize,
  findBestKeywordMatch,
  matchKeywords,
  containsPhrase,
  extractSimilarSegment,
  suggestCorrections,
  groupMatchesByCategory,
  formatMatch,
  DEFAULT_FUZZY_CONFIG,
  type FuzzyPattern,
  type FuzzyMatch,
} from "@/lib/preview/fuzzy-pattern-matcher";

describe("FuzzyPatternMatcher", () => {
  describe("matches patterns with minor variations in wording (Feature #144)", () => {
    it("matches exact wording", () => {
      // Feature #144: Matches patterns with minor variations
      const pattern = createPattern("test", ["syntax", "error"]);
      const match = matchPattern(pattern, "syntax error detected");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.8);
    });

    it("matches with minor typos", () => {
      // Feature #144: Matches patterns with minor variations
      const pattern = createPattern("test", ["syntax", "error"]);
      const match = matchPattern(pattern, "syntx eror detected");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.5);
    });

    it("matches with different word order", () => {
      // Feature #144: Matches patterns with minor variations
      const pattern = createPattern("test", ["missing", "file"]);
      const match = matchPattern(pattern, "file is missing");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.5);
    });

    it("matches with synonyms", () => {
      // Feature #144: Matches patterns with minor variations
      const pattern = createPattern("test", ["error", "found"], {
        synonyms: { error: ["fault", "bug", "issue"] },
      });
      const match = matchPattern(pattern, "bug found in code");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.7);
    });

    it("matches with extra words between keywords", () => {
      // Feature #144: Matches patterns with minor variations
      const pattern = createPattern("test", ["cannot", "read", "property"]);
      const match = matchPattern(pattern, "cannot safely read the property");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.6);
    });
  });

  describe("matches patterns with formatting variations (Feature #144)", () => {
    it("ignores case differences", () => {
      // Feature #144: Matches patterns with formatting variations
      const pattern = createPattern("test", ["syntax", "error"]);
      const match = matchPattern(pattern, "SYNTAX ERROR");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.8);
    });

    it("ignores punctuation", () => {
      // Feature #144: Matches patterns with formatting variations
      const pattern = createPattern("test", ["file", "not", "found"]);
      const match = matchPattern(pattern, "File: not found!");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.7);
    });

    it("normalizes whitespace", () => {
      // Feature #144: Matches patterns with formatting variations
      const pattern = createPattern("test", ["missing", "module"]);
      const match = matchPattern(pattern, "missing   \n  module");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.8);
    });

    it("handles mixed formatting", () => {
      // Feature #144: Matches patterns with formatting variations
      const pattern = createPattern("test", ["undefined", "variable"]);
      const match = matchPattern(pattern, "UNDEFINED  variable!!!");

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(0.8);
    });
  });

  describe("levenshteinDistance", () => {
    it("returns 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("returns string length for empty comparison", () => {
      expect(levenshteinDistance("hello", "")).toBe(5);
      expect(levenshteinDistance("", "world")).toBe(5);
    });

    it("calculates single character changes", () => {
      expect(levenshteinDistance("cat", "bat")).toBe(1);
      expect(levenshteinDistance("cat", "car")).toBe(1);
      expect(levenshteinDistance("cat", "cats")).toBe(1);
    });

    it("calculates multiple character changes", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
      expect(levenshteinDistance("sunday", "saturday")).toBe(3);
    });
  });

  describe("stringSimilarity", () => {
    it("returns 1 for identical strings", () => {
      expect(stringSimilarity("hello", "hello")).toBe(1);
    });

    it("returns 0 for completely different strings", () => {
      expect(stringSimilarity("abc", "xyz")).toBeLessThan(0.5);
    });

    it("returns high score for similar strings", () => {
      expect(stringSimilarity("error", "eror")).toBeGreaterThan(0.7);
      expect(stringSimilarity("syntax", "syntx")).toBeGreaterThan(0.7);
    });
  });

  describe("jaroWinklerSimilarity", () => {
    it("returns 1 for identical strings", () => {
      expect(jaroWinklerSimilarity("hello", "hello")).toBe(1);
    });

    it("returns 0 for completely different strings", () => {
      expect(jaroWinklerSimilarity("abc", "xyz")).toBe(0);
    });

    it("gives bonus for common prefix", () => {
      const withPrefix = jaroWinklerSimilarity("prefix_test", "prefix_tset");
      const withoutPrefix = jaroWinklerSimilarity("test_prefix", "tset_prefix");
      expect(withPrefix).toBeGreaterThan(withoutPrefix);
    });

    it("handles short strings well", () => {
      expect(jaroWinklerSimilarity("cat", "car")).toBeGreaterThan(0.7);
    });
  });

  describe("combinedSimilarity", () => {
    it("returns 1 for identical strings", () => {
      expect(combinedSimilarity("hello", "hello")).toBe(1);
    });

    it("handles typos gracefully", () => {
      expect(combinedSimilarity("undefined", "undefinied")).toBeGreaterThan(0.8);
      expect(combinedSimilarity("property", "proprty")).toBeGreaterThan(0.8);
    });
  });

  describe("normalizeText", () => {
    it("converts to lowercase by default", () => {
      expect(normalizeText("HELLO World")).toBe("hello world");
    });

    it("removes punctuation by default", () => {
      expect(normalizeText("Hello, World!")).toBe("hello world");
    });

    it("normalizes whitespace by default", () => {
      expect(normalizeText("hello   world\n\ttest")).toBe("hello world test");
    });

    it("respects config options", () => {
      const result = normalizeText("HELLO!", { caseInsensitive: false });
      expect(result).toContain("HELLO");
    });
  });

  describe("tokenize", () => {
    it("splits text into words", () => {
      expect(tokenize("hello world")).toEqual(["hello", "world"]);
    });

    it("handles multiple spaces", () => {
      expect(tokenize("hello   world")).toEqual(["hello", "world"]);
    });

    it("removes empty tokens", () => {
      expect(tokenize("  hello  ")).toEqual(["hello"]);
    });
  });

  describe("findBestKeywordMatch", () => {
    it("finds exact match", () => {
      const match = findBestKeywordMatch("error", ["syntax", "error", "found"]);
      expect(match).not.toBeNull();
      expect(match!.token).toBe("error");
      expect(match!.score).toBe(1);
    });

    it("finds fuzzy match", () => {
      const match = findBestKeywordMatch("error", ["syntax", "eror", "found"]);
      expect(match).not.toBeNull();
      expect(match!.token).toBe("eror");
      expect(match!.score).toBeGreaterThan(0.7);
    });

    it("finds synonym match", () => {
      const match = findBestKeywordMatch(
        "error",
        ["bug", "found"],
        ["bug", "fault"]
      );
      expect(match).not.toBeNull();
      expect(match!.token).toBe("bug");
    });

    it("returns null for no match", () => {
      const match = findBestKeywordMatch("xyz", ["abc", "def"], [], 1);
      expect(match).toBeNull();
    });
  });

  describe("matchKeywords", () => {
    it("matches all keywords", () => {
      const result = matchKeywords(
        ["syntax", "error"],
        "syntax error detected"
      );

      expect(result.scores["syntax"]).toBe(1);
      expect(result.scores["error"]).toBe(1);
    });

    it("calculates order score", () => {
      const inOrder = matchKeywords(["first", "second"], "first then second");
      const outOfOrder = matchKeywords(["first", "second"], "second then first");

      expect(inOrder.orderScore).toBeGreaterThan(outOfOrder.orderScore);
    });

    it("tracks matched segments", () => {
      const result = matchKeywords(["file", "missing"], "the file is missing");

      expect(result.segments).toContain("file");
      expect(result.segments).toContain("missing");
    });
  });

  describe("matchPattern", () => {
    it("returns match for matching text", () => {
      const pattern = createPattern("test", ["hello", "world"]);
      const match = matchPattern(pattern, "hello world");

      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("test");
    });

    it("returns null for non-matching text", () => {
      const pattern = createPattern("test", ["hello", "world"], {
        threshold: 0.9,
      });
      const match = matchPattern(pattern, "completely different text");

      expect(match).toBeNull();
    });

    it("includes all match details", () => {
      const pattern = createPattern("test", ["error", "found"]);
      const match = matchPattern(pattern, "error found here");

      expect(match!.score).toBeGreaterThan(0);
      expect(match!.keywordScores).toBeDefined();
      expect(match!.matchedSegments.length).toBeGreaterThan(0);
      expect(match!.input).toBe("error found here");
      expect(match!.normalizedInput).toBe("error found here");
    });

    it("respects custom threshold", () => {
      const lowThreshold = createPattern("low", ["test"], { threshold: 0.3 });
      const highThreshold = createPattern("high", ["test"], { threshold: 0.95 });

      const lowMatch = matchPattern(lowThreshold, "tset");
      const highMatch = matchPattern(highThreshold, "tset");

      expect(lowMatch).not.toBeNull();
      expect(highMatch).toBeNull();
    });
  });

  describe("matchAllPatterns", () => {
    it("returns all matching patterns", () => {
      const patterns = [
        createPattern("p1", ["error"]),
        createPattern("p2", ["syntax"]),
        createPattern("p3", ["warning"]),
      ];

      const matches = matchAllPatterns(patterns, "syntax error detected");

      expect(matches.length).toBe(2);
    });

    it("sorts by score descending", () => {
      const patterns = [
        createPattern("exact", ["syntax", "error"]),
        createPattern("partial", ["error"]),
      ];

      const matches = matchAllPatterns(patterns, "syntax error");

      expect(matches[0].pattern.id).toBe("exact");
    });

    it("returns empty array for no matches", () => {
      const patterns = [createPattern("test", ["xyz"], { threshold: 0.9 })];
      const matches = matchAllPatterns(patterns, "abc def");

      expect(matches.length).toBe(0);
    });
  });

  describe("findBestMatch", () => {
    it("returns best match", () => {
      const patterns = [
        createPattern("good", ["error"]),
        createPattern("better", ["syntax", "error"]),
      ];

      const match = findBestMatch(patterns, "syntax error");

      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("better");
    });

    it("returns null for no matches", () => {
      const patterns = [createPattern("test", ["xyz"], { threshold: 0.9 })];
      const match = findBestMatch(patterns, "abc");

      expect(match).toBeNull();
    });
  });

  describe("FuzzyPatternMatcher class", () => {
    let matcher: FuzzyPatternMatcher;

    beforeEach(() => {
      matcher = createFuzzyMatcher([
        createPattern("syntax_error", ["syntax", "error"]),
        createPattern("type_error", ["type", "error"]),
        createPattern("missing_file", ["file", "not", "found"], {
          category: "file",
        }),
      ]);
    });

    it("matches text", () => {
      const matches = matcher.match("syntax error detected");

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern.id).toBe("syntax_error");
    });

    it("finds best match", () => {
      const match = matcher.findBest("type error occurred");

      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("type_error");
    });

    it("checks for matches", () => {
      expect(matcher.hasMatch("syntax error")).toBe(true);
      expect(matcher.hasMatch("completely unrelated text")).toBe(false);
    });

    it("caches results", () => {
      const matches1 = matcher.match("syntax error");
      const matches2 = matcher.match("syntax error");

      expect(matches1).toBe(matches2);
    });

    it("clears cache", () => {
      matcher.match("syntax error");
      matcher.clearCache();

      expect(matcher.getCacheStats().size).toBe(0);
    });

    it("adds patterns", () => {
      matcher.addPattern(createPattern("new", ["new", "pattern"]));

      const match = matcher.findBest("new pattern here");
      expect(match).not.toBeNull();
      expect(match!.pattern.id).toBe("new");
    });

    it("removes patterns", () => {
      const removed = matcher.removePattern("syntax_error");
      expect(removed).toBe(true);

      const match = matcher.findBest("syntax error");
      expect(match?.pattern.id).not.toBe("syntax_error");
    });

    it("gets patterns by category", () => {
      const filePatterns = matcher.getPatternsByCategory("file");
      expect(filePatterns.length).toBe(1);
      expect(filePatterns[0].id).toBe("missing_file");
    });

    it("matches in category", () => {
      const matches = matcher.matchInCategory("file not found", "file");

      expect(matches.length).toBe(1);
      expect(matches[0].pattern.id).toBe("missing_file");
    });

    it("updates config", () => {
      matcher.updateConfig({ defaultThreshold: 0.9 });

      const config = matcher.getConfig();
      expect(config.defaultThreshold).toBe(0.9);
    });

    it("gets all patterns", () => {
      const patterns = matcher.getPatterns();
      expect(patterns.length).toBe(3);
    });
  });

  describe("containsPhrase", () => {
    it("returns true for matching phrase", () => {
      expect(containsPhrase("error found in code", "error found")).toBe(true);
    });

    it("handles minor variations", () => {
      expect(containsPhrase("eror found in code", "error found", 0.6)).toBe(true);
    });

    it("returns false for non-matching phrase", () => {
      expect(containsPhrase("all good here", "error found")).toBe(false);
    });
  });

  describe("extractSimilarSegment", () => {
    it("extracts matching segment", () => {
      const result = extractSimilarSegment(
        "there was a syntax error in the code",
        "syntax error"
      );

      expect(result).not.toBeNull();
      expect(result!.segment).toContain("syntax");
      expect(result!.score).toBeGreaterThan(0.8);
    });

    it("returns best matching segment", () => {
      const result = extractSimilarSegment(
        "first error and second error here",
        "second error"
      );

      expect(result).not.toBeNull();
      expect(result!.segment).toContain("second");
    });
  });

  describe("suggestCorrections", () => {
    it("suggests corrections for misspelled words", () => {
      const dictionary = ["error", "warning", "info", "debug"];
      const suggestions = suggestCorrections("eror", dictionary);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].word).toBe("error");
    });

    it("limits suggestions", () => {
      const dictionary = ["cat", "car", "can", "cap", "cab"];
      const suggestions = suggestCorrections("ca", dictionary, 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it("returns empty for no matches", () => {
      const dictionary = ["apple", "banana"];
      const suggestions = suggestCorrections("xyz", dictionary);

      expect(suggestions.length).toBe(0);
    });
  });

  describe("groupMatchesByCategory", () => {
    it("groups matches by category", () => {
      const matches: FuzzyMatch[] = [
        {
          pattern: { id: "p1", keywords: [], category: "syntax" },
          score: 0.9,
          keywordScores: {},
          matchedSegments: [],
          input: "",
          normalizedInput: "",
        },
        {
          pattern: { id: "p2", keywords: [], category: "type" },
          score: 0.8,
          keywordScores: {},
          matchedSegments: [],
          input: "",
          normalizedInput: "",
        },
        {
          pattern: { id: "p3", keywords: [], category: "syntax" },
          score: 0.7,
          keywordScores: {},
          matchedSegments: [],
          input: "",
          normalizedInput: "",
        },
      ];

      const groups = groupMatchesByCategory(matches);

      expect(groups["syntax"].length).toBe(2);
      expect(groups["type"].length).toBe(1);
    });

    it("uses 'uncategorized' for patterns without category", () => {
      const matches: FuzzyMatch[] = [
        {
          pattern: { id: "p1", keywords: [] },
          score: 0.9,
          keywordScores: {},
          matchedSegments: [],
          input: "",
          normalizedInput: "",
        },
      ];

      const groups = groupMatchesByCategory(matches);

      expect(groups["uncategorized"].length).toBe(1);
    });
  });

  describe("formatMatch", () => {
    it("formats match for display", () => {
      const match: FuzzyMatch = {
        pattern: { id: "test_pattern", keywords: ["test"], category: "testing" },
        score: 0.85,
        keywordScores: { test: 1 },
        matchedSegments: ["test"],
        input: "test input",
        normalizedInput: "test input",
      };

      const formatted = formatMatch(match);

      expect(formatted).toContain("test_pattern");
      expect(formatted).toContain("85%");
      expect(formatted).toContain("testing");
    });
  });

  describe("DEFAULT_FUZZY_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_FUZZY_CONFIG.defaultThreshold).toBe(0.6);
      expect(DEFAULT_FUZZY_CONFIG.caseInsensitive).toBe(true);
      expect(DEFAULT_FUZZY_CONFIG.normalizeWhitespace).toBe(true);
      expect(DEFAULT_FUZZY_CONFIG.removePunctuation).toBe(true);
      expect(DEFAULT_FUZZY_CONFIG.maxEditDistance).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      const pattern = createPattern("test", ["hello"]);
      const match = matchPattern(pattern, "");

      expect(match).toBeNull();
    });

    it("handles empty keywords", () => {
      const pattern = createPattern("test", []);
      const match = matchPattern(pattern, "some text");

      expect(match).toBeNull();
    });

    it("handles single character keywords", () => {
      const pattern = createPattern("test", ["a", "b"]);
      const match = matchPattern(pattern, "a b c");

      expect(match).not.toBeNull();
    });

    it("handles very long text", () => {
      const longText = "error ".repeat(100);
      const pattern = createPattern("test", ["error"]);
      const match = matchPattern(pattern, longText);

      expect(match).not.toBeNull();
    });
  });
});
