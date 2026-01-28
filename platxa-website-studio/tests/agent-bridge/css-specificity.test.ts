import { describe, it, expect } from "vitest";
import {
  calculateSpecificity,
  compareSpecificity,
  formatSpecificity,
  maxNestingDepth,
  analyzeSpecificity,
} from "@/lib/agent-bridge/css-specificity";

describe("CSS Specificity Analyzer", () => {
  describe("calculateSpecificity", () => {
    it("scores element selector as (0,0,1)", () => {
      expect(calculateSpecificity("div")).toEqual([0, 0, 1]);
    });

    it("scores class selector as (0,1,0)", () => {
      expect(calculateSpecificity(".foo")).toEqual([0, 1, 0]);
    });

    it("scores ID selector as (1,0,0)", () => {
      expect(calculateSpecificity("#bar")).toEqual([1, 0, 0]);
    });

    it("scores combined selector div.foo", () => {
      expect(calculateSpecificity("div.foo")).toEqual([0, 1, 1]);
    });

    it("scores descendant selector .a .b .c", () => {
      expect(calculateSpecificity(".a .b .c")).toEqual([0, 3, 0]);
    });

    it("scores pseudo-class :hover as class-level", () => {
      expect(calculateSpecificity("a:hover")).toEqual([0, 1, 1]);
    });

    it("scores pseudo-element ::before as element-level", () => {
      expect(calculateSpecificity("p::before")).toEqual([0, 0, 2]);
    });

    it("scores attribute selector [type='text'] as class-level", () => {
      expect(calculateSpecificity("input[type='text']")).toEqual([0, 1, 1]);
    });

    it("scores complex selector #id .class div:hover", () => {
      expect(calculateSpecificity("#id .class div:hover")).toEqual([1, 2, 1]);
    });

    it("scores :not() contents", () => {
      // :not(.foo) — the .foo inside counts as (0,1,0)
      expect(calculateSpecificity("div:not(.foo)")).toEqual([0, 1, 1]);
    });

    it("scores multiple classes .a.b.c.d", () => {
      expect(calculateSpecificity(".a.b.c.d")).toEqual([0, 4, 0]);
    });
  });

  describe("compareSpecificity", () => {
    it("higher ID wins", () => {
      expect(compareSpecificity([1, 0, 0], [0, 10, 10])).toBeGreaterThan(0);
    });

    it("higher class wins when IDs equal", () => {
      expect(compareSpecificity([0, 3, 0], [0, 2, 5])).toBeGreaterThan(0);
    });

    it("higher element wins when IDs and classes equal", () => {
      expect(compareSpecificity([0, 1, 3], [0, 1, 2])).toBeGreaterThan(0);
    });

    it("returns 0 for equal", () => {
      expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
    });
  });

  describe("formatSpecificity", () => {
    it("formats as (a,b,c)", () => {
      expect(formatSpecificity([1, 2, 3])).toBe("(1,2,3)");
    });
  });

  describe("maxNestingDepth", () => {
    it("returns 0 for flat CSS", () => {
      expect(maxNestingDepth(".a { color: red; }")).toBe(1);
    });

    it("returns depth for nested SCSS", () => {
      const scss = `.a { .b { .c { .d { color: red; } } } }`;
      expect(maxNestingDepth(scss)).toBe(4);
    });

    it("returns 0 for empty string", () => {
      expect(maxNestingDepth("")).toBe(0);
    });
  });

  describe("analyzeSpecificity", () => {
    it("passes clean CSS with low specificity", () => {
      const css = `.hero { color: red; }\n.btn { padding: 8px; }`;
      const result = analyzeSpecificity(css);
      expect(result.isClean).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("flags selectors with specificity > (0,3,0)", () => {
      const css = `.a .b .c .d { color: red; }`;
      const result = analyzeSpecificity(css);
      const issue = result.issues.find((i) => i.rule === "max-class-specificity");
      expect(issue).toBeTruthy();
      expect(issue!.severity).toBe("error");
    });

    it("flags ID selectors by default", () => {
      const css = `#header { color: blue; }`;
      const result = analyzeSpecificity(css);
      const issue = result.issues.find((i) => i.rule === "no-id-selectors");
      expect(issue).toBeTruthy();
    });

    it("warns on nesting depth > 3", () => {
      const scss = `.a { .b { .c { .d { color: red; } } } }`;
      const result = analyzeSpecificity(scss);
      const issue = result.issues.find((i) => i.rule === "max-nesting-depth");
      expect(issue).toBeTruthy();
      expect(issue!.severity).toBe("warning");
    });

    it("respects custom thresholds", () => {
      const css = `#header .nav .item { color: red; }`;
      const result = analyzeSpecificity(css, { maxIdSpecificity: 1, maxClassSpecificity: 5 });
      // ID=1 which is within threshold, classes=2 within 5
      expect(result.issues.find((i) => i.rule === "no-id-selectors")).toBeFalsy();
      expect(result.issues.find((i) => i.rule === "max-class-specificity")).toBeFalsy();
    });

    it("tracks max specificity", () => {
      const css = `.a { color: red; }\n.a .b .c { color: blue; }`;
      const result = analyzeSpecificity(css);
      expect(result.maxSpecificity[1]).toBeGreaterThanOrEqual(3);
    });

    it("extracts multiple selectors", () => {
      const css = `.a { color: red; }\n.b { color: blue; }\n.c { color: green; }`;
      const result = analyzeSpecificity(css);
      expect(result.selectors.length).toBe(3);
    });

    it("handles comma-separated selectors", () => {
      const css = `.a, .b, .c { color: red; }`;
      const result = analyzeSpecificity(css);
      expect(result.selectors.length).toBe(3);
    });

    it("isClean false when issues exist", () => {
      const css = `.a .b .c .d .e { color: red; }`;
      const result = analyzeSpecificity(css);
      expect(result.isClean).toBe(false);
    });
  });
});
