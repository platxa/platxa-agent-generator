import { describe, it, expect } from "vitest";
import { validateSemantics } from "@/lib/agent-bridge/semantic-validator";

describe("Semantic Validator", () => {
  describe("heading hierarchy", () => {
    it("passes valid h1 → h2 → h3 hierarchy", () => {
      const html = `<main><h1>Title</h1><h2>Sub</h2><h3>Detail</h3></main>`;
      const result = validateSemantics(html);
      const headingIssues = result.issues.filter((i) => i.rule.startsWith("heading"));
      expect(headingIssues).toHaveLength(0);
    });

    it("errors on skipped heading level h1 → h3", () => {
      const html = `<main><h1>Title</h1><h3>Skipped</h3></main>`;
      const result = validateSemantics(html);
      const skip = result.issues.find((i) => i.rule === "heading-order");
      expect(skip).toBeTruthy();
      expect(skip!.severity).toBe("error");
      expect(skip!.message).toContain("h3");
    });

    it("errors when no h1 is present", () => {
      const html = `<main><h2>Sub</h2></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "h1-present")).toBeTruthy();
    });

    it("warns on multiple h1 elements", () => {
      const html = `<main><h1>First</h1><h1>Second</h1></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "h1-unique")).toBeTruthy();
    });

    it("warns when no headings exist at all", () => {
      const html = `<main><p>No headings</p></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "heading-present")).toBeTruthy();
    });

    it("warns when first heading starts too deep", () => {
      const html = `<main><h4>Deep start</h4></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "heading-start")).toBeTruthy();
    });
  });

  describe("ARIA landmarks", () => {
    it("errors when no main landmark exists", () => {
      const html = `<div><h1>Title</h1></div>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-main")).toBeTruthy();
    });

    it("passes with <main> element", () => {
      const html = `<header><h1>T</h1></header><main><p>Content</p></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-main")).toBeFalsy();
    });

    it("passes with role=main", () => {
      const html = `<header><h1>T</h1></header><div role="main"><p>Content</p></div><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-main")).toBeFalsy();
    });

    it("warns when no header/banner exists", () => {
      const html = `<main><h1>Title</h1></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-banner")).toBeTruthy();
    });

    it("warns when no footer/contentinfo exists", () => {
      const html = `<header><h1>T</h1></header><main><p>C</p></main>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-contentinfo")).toBeTruthy();
    });

    it("errors on multiple main elements", () => {
      const html = `<header><h1>T</h1></header><main>A</main><main>B</main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "landmark-main-unique")).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("warns when multiple navs lack aria-label", () => {
      const html = `<header><h1>T</h1></header><nav><a href="/">Home</a></nav><nav><a href="/about">About</a></nav><main>C</main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "nav-label")).toBeTruthy();
    });

    it("passes when multiple navs have aria-label", () => {
      const html = `<header><h1>T</h1></header><nav aria-label="Main"><a href="/">Home</a></nav><nav aria-label="Footer"><a href="/about">About</a></nav><main>C</main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "nav-label")).toBeFalsy();
    });

    it("reports info when nav contains no links", () => {
      const html = `<header><h1>T</h1></header><nav><p>Empty nav</p></nav><main>C</main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "nav-links")).toBeTruthy();
    });
  });

  describe("semantic elements", () => {
    it("errors on img without alt", () => {
      const html = `<header><h1>T</h1></header><main><img src="photo.jpg"></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "img-alt")).toBeTruthy();
    });

    it("passes img with alt", () => {
      const html = `<header><h1>T</h1></header><main><img src="photo.jpg" alt="A photo"></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "img-alt")).toBeFalsy();
    });

    it("errors on button without text or aria-label", () => {
      const html = `<header><h1>T</h1></header><main><button></button></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "button-text")).toBeTruthy();
    });

    it("passes button with text", () => {
      const html = `<header><h1>T</h1></header><main><button>Click</button></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "button-text")).toBeFalsy();
    });

    it("passes button with aria-label", () => {
      const html = `<header><h1>T</h1></header><main><button aria-label="Close"></button></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.issues.find((i) => i.rule === "button-text")).toBeFalsy();
    });
  });

  describe("result structure", () => {
    it("groups issues by rule", () => {
      const html = `<div><h3>Skip</h3><img src="x"></div>`;
      const result = validateSemantics(html);
      expect(Object.keys(result.byRule).length).toBeGreaterThan(0);
    });

    it("counts errors, warnings, infos", () => {
      const html = `<header><h1>T</h1></header><main><h1>Dup</h1><h3>Skip</h3></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.counts.errors + result.counts.warnings + result.counts.infos).toBe(result.issues.length);
    });

    it("isValid is false when errors exist", () => {
      const html = `<div><h1>T</h1><h3>Skip</h3></div>`;
      const result = validateSemantics(html);
      expect(result.isValid).toBe(false);
    });

    it("isValid is true for well-formed HTML", () => {
      const html = `<header><nav aria-label="Main"><a href="/">Home</a></nav></header><main><h1>Title</h1><h2>Sub</h2><img src="x" alt="y"><button>OK</button></main><footer>F</footer>`;
      const result = validateSemantics(html);
      expect(result.isValid).toBe(true);
    });
  });
});
