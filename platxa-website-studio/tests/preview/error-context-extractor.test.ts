import { describe, it, expect, beforeEach } from "vitest";
import {
  ErrorContextExtractor,
  createErrorContextExtractor,
  extractErrorContext,
  extractContextFromFile,
  formatErrorContext,
  formatAsCodeBlock,
  processLine,
  detectLanguage,
  getContextWindowSize,
  extractMultipleContexts,
  contextsOverlap,
  mergeContexts,
  createDefaultContext,
  DEFAULT_CONFIG,
  type ErrorContext,
  type CodeLine,
  type ContextExtractionConfig,
} from "@/lib/preview/error-context-extractor";

// Sample source code for testing
const SAMPLE_SOURCE = `import React from 'react';
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  const decrement = () => {
    setCount(count - 1);
  };

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}

export default Counter;`;

describe("ErrorContextExtractor", () => {
  describe("includes 5 lines before/after error line in context (Feature #137)", () => {
    it("extracts 5 lines before error line", () => {
      // Feature #137: Includes 5 lines before error line
      // Using line 12 which contains "setCount(count - 1);"
      const context = extractErrorContext(SAMPLE_SOURCE, 12);

      expect(context.linesBefore.length).toBe(5);
      expect(context.linesBefore[0].lineNumber).toBe(7);
      expect(context.linesBefore[4].lineNumber).toBe(11);
    });

    it("extracts 5 lines after error line", () => {
      // Feature #137: Includes 5 lines after error line
      // Using line 12 which contains "setCount(count - 1);"
      const context = extractErrorContext(SAMPLE_SOURCE, 12);

      expect(context.linesAfter.length).toBe(5);
      expect(context.linesAfter[0].lineNumber).toBe(13);
      expect(context.linesAfter[4].lineNumber).toBe(17);
    });

    it("includes error line in context", () => {
      // Feature #137: Error line is included
      // Line 12 contains "setCount(count - 1);"
      const context = extractErrorContext(SAMPLE_SOURCE, 12);

      expect(context.errorLineContent.lineNumber).toBe(12);
      expect(context.errorLineContent.isErrorLine).toBe(true);
      expect(context.errorLineContent.content).toContain("setCount(count - 1)");
    });

    it("total context is 11 lines (5 + 1 + 5)", () => {
      // Feature #137: 5 lines before + error + 5 lines after
      const context = extractErrorContext(SAMPLE_SOURCE, 12);

      expect(context.contextSize).toBe(11);
      expect(context.allLines.length).toBe(11);
    });

    it("default config uses 5 lines before and after", () => {
      // Feature #137: Default is 5 lines
      expect(DEFAULT_CONFIG.linesBefore).toBe(5);
      expect(DEFAULT_CONFIG.linesAfter).toBe(5);
    });
  });

  describe("extractErrorContext", () => {
    it("handles error at beginning of file", () => {
      const context = extractErrorContext(SAMPLE_SOURCE, 2);

      expect(context.linesBefore.length).toBe(1); // Only line 1
      expect(context.linesAfter.length).toBe(5);
      expect(context.errorLine).toBe(2);
    });

    it("handles error at end of file", () => {
      const lines = SAMPLE_SOURCE.split("\n");
      const lastLine = lines.length;
      const context = extractErrorContext(SAMPLE_SOURCE, lastLine);

      expect(context.linesBefore.length).toBe(5);
      expect(context.linesAfter.length).toBe(0);
      expect(context.errorLine).toBe(lastLine);
    });

    it("throws for invalid line number", () => {
      expect(() => extractErrorContext(SAMPLE_SOURCE, 0)).toThrow();
      expect(() => extractErrorContext(SAMPLE_SOURCE, 1000)).toThrow();
    });

    it("respects custom linesBefore config", () => {
      const context = extractErrorContext(SAMPLE_SOURCE, 10, { linesBefore: 2 });

      expect(context.linesBefore.length).toBe(2);
    });

    it("respects custom linesAfter config", () => {
      const context = extractErrorContext(SAMPLE_SOURCE, 10, { linesAfter: 3 });

      expect(context.linesAfter.length).toBe(3);
    });

    it("marks only error line as isErrorLine", () => {
      const context = extractErrorContext(SAMPLE_SOURCE, 10);

      const errorLines = context.allLines.filter((l) => l.isErrorLine);
      expect(errorLines.length).toBe(1);
      expect(errorLines[0].lineNumber).toBe(10);
    });
  });

  describe("extractContextFromFile", () => {
    it("includes file path in context", () => {
      const context = extractContextFromFile(
        "/app/src/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      expect(context.filePath).toBe("/app/src/Counter.tsx");
    });

    it("includes column in context", () => {
      const context = extractContextFromFile(
        "/app/src/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10, column: 5 }
      );

      expect(context.errorColumn).toBe(5);
    });
  });

  describe("processLine", () => {
    it("replaces tabs with spaces", () => {
      const result = processLine("\t\tindented", DEFAULT_CONFIG);

      expect(result).toBe("    indented"); // 2 spaces per tab
    });

    it("truncates long lines", () => {
      const longLine = "a".repeat(250);
      const result = processLine(longLine, DEFAULT_CONFIG);

      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith("...")).toBe(true);
    });

    it("preserves short lines", () => {
      const shortLine = "const x = 1;";
      const result = processLine(shortLine, DEFAULT_CONFIG);

      expect(result).toBe(shortLine);
    });
  });

  describe("formatErrorContext", () => {
    it("includes file path in header", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatErrorContext(context);

      expect(formatted).toContain("/app/Counter.tsx");
    });

    it("shows line numbers by default", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatErrorContext(context);

      expect(formatted).toContain("10 │");
    });

    it("highlights error line with marker", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatErrorContext(context);

      expect(formatted).toContain("→");
    });

    it("can hide line numbers", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatErrorContext(context, { showLineNumbers: false });

      expect(formatted).not.toContain(" │ ");
    });
  });

  describe("formatAsCodeBlock", () => {
    it("formats as markdown code block", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatAsCodeBlock(context);

      expect(formatted.startsWith("```")).toBe(true);
      expect(formatted.endsWith("```")).toBe(true);
    });

    it("detects language from file extension", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatAsCodeBlock(context);

      expect(formatted.startsWith("```tsx")).toBe(true);
    });

    it("uses provided language", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatAsCodeBlock(context, "javascript");

      expect(formatted.startsWith("```javascript")).toBe(true);
    });

    it("marks error line with >", () => {
      const context = extractContextFromFile(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = formatAsCodeBlock(context);
      const lines = formatted.split("\n");
      const errorLine = lines.find((l) => l.includes("10 |"));

      expect(errorLine?.startsWith(">")).toBe(true);
    });
  });

  describe("detectLanguage", () => {
    it("detects JavaScript", () => {
      expect(detectLanguage("app.js")).toBe("javascript");
    });

    it("detects TypeScript", () => {
      expect(detectLanguage("app.ts")).toBe("typescript");
      expect(detectLanguage("app.tsx")).toBe("tsx");
    });

    it("detects Python", () => {
      expect(detectLanguage("script.py")).toBe("python");
    });

    it("detects CSS/SCSS", () => {
      expect(detectLanguage("styles.css")).toBe("css");
      expect(detectLanguage("theme.scss")).toBe("scss");
    });

    it("returns empty for unknown extensions", () => {
      expect(detectLanguage("file.xyz")).toBe("");
    });
  });

  describe("getContextWindowSize", () => {
    it("returns default size of 11", () => {
      expect(getContextWindowSize()).toBe(11); // 5 + 1 + 5
    });

    it("respects custom config", () => {
      expect(getContextWindowSize({ linesBefore: 3, linesAfter: 2 })).toBe(6);
    });
  });

  describe("extractMultipleContexts", () => {
    it("extracts contexts for multiple lines", () => {
      const contexts = extractMultipleContexts(SAMPLE_SOURCE, [5, 10, 15]);

      expect(contexts.length).toBe(3);
      expect(contexts[0].errorLine).toBe(5);
      expect(contexts[1].errorLine).toBe(10);
      expect(contexts[2].errorLine).toBe(15);
    });
  });

  describe("contextsOverlap", () => {
    it("detects overlapping contexts", () => {
      const ctx1 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 5 });
      const ctx2 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 8 });

      expect(contextsOverlap(ctx1, ctx2)).toBe(true);
    });

    it("detects non-overlapping contexts", () => {
      const ctx1 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 2 });
      const ctx2 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 20 });

      expect(contextsOverlap(ctx1, ctx2)).toBe(false);
    });
  });

  describe("mergeContexts", () => {
    it("returns null for empty array", () => {
      expect(mergeContexts([])).toBeNull();
    });

    it("returns single context unchanged", () => {
      const ctx = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 10 });
      const merged = mergeContexts([ctx]);

      expect(merged).toBe(ctx);
    });

    it("merges overlapping contexts", () => {
      const ctx1 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 5 });
      const ctx2 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 8 });

      const merged = mergeContexts([ctx1, ctx2]);

      expect(merged).not.toBeNull();
      expect(merged!.allLines.length).toBeGreaterThan(ctx1.allLines.length);
    });

    it("preserves error line status", () => {
      const ctx1 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 5 });
      const ctx2 = extractContextFromFile("file.ts", SAMPLE_SOURCE, { line: 8 });

      const merged = mergeContexts([ctx1, ctx2]);
      const errorLines = merged!.allLines.filter((l) => l.isErrorLine);

      expect(errorLines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ErrorContextExtractor class", () => {
    let extractor: ErrorContextExtractor;

    beforeEach(() => {
      extractor = createErrorContextExtractor();
    });

    it("extracts context", () => {
      const context = extractor.extract(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      expect(context.errorLine).toBe(10);
      expect(context.filePath).toBe("/app/Counter.tsx");
    });

    it("caches results", () => {
      const ctx1 = extractor.extract("/app/file.ts", SAMPLE_SOURCE, { line: 10 });
      const ctx2 = extractor.extract("/app/file.ts", SAMPLE_SOURCE, { line: 10 });

      expect(ctx1).toBe(ctx2); // Same reference
    });

    it("clears cache", () => {
      extractor.extract("/app/file.ts", SAMPLE_SOURCE, { line: 10 });
      extractor.clearCache();

      // Should still work
      const ctx = extractor.extract("/app/file.ts", SAMPLE_SOURCE, { line: 10 });
      expect(ctx).toBeDefined();
    });

    it("extracts multiple contexts", () => {
      const contexts = extractor.extractMultiple(
        "/app/file.ts",
        SAMPLE_SOURCE,
        [{ line: 5 }, { line: 10 }, { line: 15 }]
      );

      expect(contexts.length).toBe(3);
    });

    it("formats context", () => {
      const context = extractor.extract(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = extractor.format(context);

      expect(formatted).toContain("Counter.tsx");
    });

    it("formats as code block", () => {
      const context = extractor.extract(
        "/app/Counter.tsx",
        SAMPLE_SOURCE,
        { line: 10 }
      );

      const formatted = extractor.formatCodeBlock(context);

      expect(formatted.startsWith("```")).toBe(true);
    });

    it("gets config", () => {
      const config = extractor.getConfig();

      expect(config.linesBefore).toBe(5);
      expect(config.linesAfter).toBe(5);
    });

    it("updates config", () => {
      extractor.updateConfig({ linesBefore: 3 });

      const config = extractor.getConfig();
      expect(config.linesBefore).toBe(3);
    });
  });

  describe("createDefaultContext", () => {
    it("creates context with default settings", () => {
      const context = createDefaultContext(
        "/app/file.ts",
        SAMPLE_SOURCE,
        10
      );

      expect(context.errorLine).toBe(10);
      expect(context.linesBefore.length).toBe(5);
      expect(context.linesAfter.length).toBe(5);
    });

    it("includes column when provided", () => {
      const context = createDefaultContext(
        "/app/file.ts",
        SAMPLE_SOURCE,
        10,
        15
      );

      expect(context.errorColumn).toBe(15);
    });
  });

  describe("edge cases", () => {
    it("handles single-line source", () => {
      const singleLine = "const x = 1;";
      const context = extractErrorContext(singleLine, 1);

      expect(context.errorLine).toBe(1);
      expect(context.linesBefore.length).toBe(0);
      expect(context.linesAfter.length).toBe(0);
    });

    it("handles empty lines in source", () => {
      const sourceWithEmptyLines = "line 1\n\nline 3\n\nline 5";
      const context = extractErrorContext(sourceWithEmptyLines, 3);

      expect(context.errorLineContent.content).toBe("line 3");
    });

    it("handles very short file", () => {
      const shortSource = "line 1\nline 2\nline 3";
      const context = extractErrorContext(shortSource, 2);

      expect(context.linesBefore.length).toBe(1);
      expect(context.linesAfter.length).toBe(1);
    });
  });
});
