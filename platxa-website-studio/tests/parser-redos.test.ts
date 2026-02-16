/**
 * ReDoS Protection Tests
 *
 * Validates that the parser handles pathological regex input without
 * catastrophic backtracking. Each test must complete within 100ms.
 *
 * Feature #15: ReDoS protection for XML attribute parsing
 * Feature #27: Test coverage for ReDoS scenarios
 */

import { describe, it, expect } from "vitest";
import { repairCorruptedXmlAttributes } from "../lib/ai/parser";

// Helper: generates a string of repeated characters
function repeat(char: string, n: number): string {
  return char.repeat(n);
}

describe("ReDoS protection", () => {
  describe("repairCorruptedXmlAttributes", () => {
    it("handles deeply nested quotes without hanging", () => {
      // Pathological: many alternating quotes that could cause backtracking
      const input = `<div class="${repeat('"a"', 500)}">content</div>`;
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("handles long attribute values without hanging", () => {
      // Pathological: very long attribute value
      const input = `<template t-name="${repeat("a", 10000)}">content</template>`;
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.content).toContain("content");
    });

    it("handles many attributes on single tag without hanging", () => {
      // Pathological: tag with hundreds of attributes
      const attrs = Array.from({ length: 200 }, (_, i) => `attr${i}="val${i}"`).join(" ");
      const input = `<div ${attrs}>content</div>`;
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.content).toContain("content");
    });

    it("handles repeated corrupted attribute pattern without hanging", () => {
      // Pathological: many corrupted attributes in sequence
      const corrupted = Array.from(
        { length: 50 },
        (_, i) => `<t t-esc="var${i}"garbage${i}"more${i}">`,
      ).join("\n");
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(corrupted);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.fixed).toBe(true);
    });

    it("handles alternating quote-unquote patterns without hanging", () => {
      // Pathological: pattern designed to trigger backtracking in naive regex
      const input = `<div class="a${repeat('"b', 100)}${repeat('"c', 100)}">text</div>`;
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("handles content exceeding 500KB size guard", () => {
      // Should bail out immediately for oversized content
      const input = repeat("a", 600_000);
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10); // Should be near-instant
      expect(result.fixed).toBe(false);
      expect(result.content).toBe(input);
    });

    it("handles nested XML tags with corrupted attributes", () => {
      // Pathological: deeply nested tags with corrupted attributes
      let input = "";
      for (let i = 0; i < 50; i++) {
        input += `<div class="level${i}"garbage"more">`;
      }
      for (let i = 0; i < 50; i++) {
        input += `</div>`;
      }
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.fixed).toBe(true);
    });

    it("still correctly repairs simple corrupted attributes", () => {
      // Functional test: verify repair still works
      const input = `<t t-esc="product.name"garbage stuff">`;
      const result = repairCorruptedXmlAttributes(input);
      expect(result.fixed).toBe(true);
      expect(result.content).toContain('t-esc="product.name"');
      expect(result.content).not.toContain("garbage");
    });

    it("handles empty and minimal input", () => {
      expect(repairCorruptedXmlAttributes("").fixed).toBe(false);
      expect(repairCorruptedXmlAttributes("<div></div>").fixed).toBe(false);
      expect(repairCorruptedXmlAttributes("plain text").fixed).toBe(false);
    });

    it("handles pathological =\"...\"...\"...\" chains", () => {
      // The exact pattern the bounded regex guards against
      const chain = `="${"x".repeat(100)}"${"y".repeat(100)}"${"z".repeat(100)}"`;
      const input = `<div attr${chain}>text</div>`;
      const start = performance.now();
      const result = repairCorruptedXmlAttributes(input);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.fixed).toBe(true);
    });
  });
});
