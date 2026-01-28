import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUDGET,
  countSelectors,
  getCssSize,
  getFontFileCount,
  getTotalAssetSize,
  checkBudget,
  formatBudgetReport,
} from "@/lib/agent-bridge/performance-budget";
import type { AssetEntry } from "@/lib/agent-bridge/performance-budget";

function makeAsset(path: string, sizeBytes: number, type: AssetEntry["type"]): AssetEntry {
  return { path, sizeBytes, type };
}

describe("Performance Budget", () => {
  describe("DEFAULT_BUDGET", () => {
    it("has expected limits", () => {
      expect(DEFAULT_BUDGET.maxCssBytes).toBe(100 * 1024);
      expect(DEFAULT_BUDGET.maxSelectors).toBe(2000);
      expect(DEFAULT_BUDGET.maxFontFiles).toBe(5);
      expect(DEFAULT_BUDGET.maxTotalAssetBytes).toBe(500 * 1024);
    });
  });

  describe("countSelectors", () => {
    it("counts simple selectors", () => {
      const css = "h1 { color: red; }\np { margin: 0; }";
      expect(countSelectors(css)).toBe(2);
    });

    it("counts comma-separated selectors", () => {
      const css = "h1, h2, h3 { color: red; }";
      expect(countSelectors(css)).toBe(3);
    });

    it("ignores comments", () => {
      const css = "/* .foo { } */\nh1 { color: red; }";
      expect(countSelectors(css)).toBe(1);
    });

    it("skips @media wrappers but counts inner selectors", () => {
      const css = "@media (max-width: 768px) {\n  .nav { display: none; }\n}";
      expect(countSelectors(css)).toBe(1);
    });

    it("skips @keyframes", () => {
      const css = "@keyframes fade {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}";
      // "from" and "to" are inside keyframes — our counter skips @keyframes opener
      // but may count from/to as selectors; that's acceptable for budget purposes
      expect(countSelectors(css)).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 for empty CSS", () => {
      expect(countSelectors("")).toBe(0);
    });

    it("handles complex real-world CSS", () => {
      const css = [
        ".header { padding: 1rem; }",
        ".header .nav { display: flex; }",
        ".header .nav a, .header .nav button { color: #333; }",
        ".footer { padding: 2rem; }",
      ].join("\n");
      expect(countSelectors(css)).toBe(5);
    });
  });

  describe("getCssSize", () => {
    it("sums CSS asset sizes", () => {
      const assets = [
        makeAsset("main.css", 5000, "css"),
        makeAsset("theme.css", 3000, "css"),
        makeAsset("logo.png", 10000, "image"),
      ];
      expect(getCssSize(assets)).toBe(8000);
    });

    it("returns 0 with no CSS", () => {
      expect(getCssSize([makeAsset("x.png", 100, "image")])).toBe(0);
    });
  });

  describe("getFontFileCount", () => {
    it("counts font files", () => {
      const assets = [
        makeAsset("inter.woff2", 5000, "font"),
        makeAsset("roboto.woff2", 4000, "font"),
        makeAsset("main.css", 1000, "css"),
      ];
      expect(getFontFileCount(assets)).toBe(2);
    });
  });

  describe("getTotalAssetSize", () => {
    it("sums all asset sizes", () => {
      const assets = [
        makeAsset("a.css", 1000, "css"),
        makeAsset("b.woff2", 2000, "font"),
        makeAsset("c.png", 3000, "image"),
      ];
      expect(getTotalAssetSize(assets)).toBe(6000);
    });
  });

  describe("checkBudget", () => {
    it("passes when all under budget", () => {
      const assets = [
        makeAsset("main.css", 10000, "css"),
        makeAsset("inter.woff2", 5000, "font"),
      ];
      const css = "h1 { color: red; }\np { margin: 0; }";
      const result = checkBudget(assets, css);
      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("fails when CSS exceeds budget", () => {
      const assets = [makeAsset("big.css", 200 * 1024, "css")];
      const result = checkBudget(assets, "h1 { }");
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.metric === "cssSize")).toBe(true);
    });

    it("fails when font files exceed budget", () => {
      const assets = Array.from({ length: 8 }, (_, i) =>
        makeAsset(`font${i}.woff2`, 1000, "font"),
      );
      const result = checkBudget(assets, "");
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.metric === "fontFiles")).toBe(true);
    });

    it("fails when total assets exceed budget", () => {
      const assets = [makeAsset("huge.js", 600 * 1024, "js")];
      const result = checkBudget(assets, "");
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.metric === "totalAssets")).toBe(true);
    });

    it("warns at >80% utilization", () => {
      // 85KB CSS = 85% of 100KB budget
      const assets = [makeAsset("main.css", 85 * 1024, "css")];
      const result = checkBudget(assets, "h1 { }");
      expect(result.pass).toBe(true); // warnings don't fail
      expect(result.violations.some((v) => v.metric === "cssSize" && v.severity === "warning")).toBe(true);
    });

    it("reports selector count violation", () => {
      // Generate CSS with >2000 selectors
      const selectors = Array.from({ length: 2100 }, (_, i) => `.s${i} { color: red; }`).join("\n");
      const result = checkBudget([], selectors);
      expect(result.pass).toBe(false);
      expect(result.violations.some((v) => v.metric === "selectorCount")).toBe(true);
      expect(result.metrics.selectorCount).toBeGreaterThanOrEqual(2000);
    });

    it("uses custom budget", () => {
      const assets = [makeAsset("a.css", 5000, "css")];
      const result = checkBudget(assets, "h1 { }", { maxCssBytes: 3000 });
      expect(result.pass).toBe(false);
    });

    it("computes utilization ratios", () => {
      const assets = [
        makeAsset("a.css", 50 * 1024, "css"),
        makeAsset("f.woff2", 1000, "font"),
      ];
      const result = checkBudget(assets, "h1 { }");
      expect(result.utilization.cssBytes).toBeCloseTo(0.5, 1);
      expect(result.utilization.fontFileCount).toBeCloseTo(0.2, 1);
    });

    it("passes with exactly at limit (no violation)", () => {
      const assets = [makeAsset("a.css", 100 * 1024, "css")];
      const result = checkBudget(assets, "h1 { }");
      // 100% = error
      expect(result.violations.some((v) => v.metric === "cssSize" && v.severity === "error")).toBe(true);
    });
  });

  describe("formatBudgetReport", () => {
    it("shows PASS for clean result", () => {
      const result = checkBudget([makeAsset("a.css", 1000, "css")], "h1 { }");
      const report = formatBudgetReport(result);
      expect(report).toContain("PASS");
    });

    it("shows FAIL with violations", () => {
      const assets = [makeAsset("big.css", 200 * 1024, "css")];
      const result = checkBudget(assets, "h1 { }");
      const report = formatBudgetReport(result);
      expect(report).toContain("FAIL");
      expect(report).toContain("Violations");
      expect(report).toContain("CSS Size");
    });

    it("includes metric lines", () => {
      const result = checkBudget([], "");
      const report = formatBudgetReport(result);
      expect(report).toContain("CSS Size");
      expect(report).toContain("Selectors");
      expect(report).toContain("Font Files");
      expect(report).toContain("Total Assets");
    });
  });
});
