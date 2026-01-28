import { describe, it, expect } from "vitest";
import { validateResponsive, DEFAULT_VIEWPORTS } from "@/lib/agent-bridge/responsive-validator";

describe("Responsive Validator", () => {
  const meta = `<meta name="viewport" content="width=device-width, initial-scale=1">`;

  describe("viewport meta", () => {
    it("errors when no viewport meta exists", () => {
      const result = validateResponsive("<html><head></head><body></body></html>", "");
      expect(result.issues.find((i) => i.rule === "no-viewport-meta")).toBeTruthy();
      expect(result.isResponsive).toBe(false);
    });

    it("passes with proper viewport meta", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const result = validateResponsive(html, "");
      expect(result.issues.find((i) => i.rule === "no-viewport-meta")).toBeFalsy();
    });

    it("warns when viewport meta lacks width=device-width", () => {
      const html = `<html><head><meta name="viewport" content="initial-scale=1"></head></html>`;
      const result = validateResponsive(html, "");
      expect(result.issues.find((i) => i.rule === "missing-responsive-meta")).toBeTruthy();
    });
  });

  describe("fixed widths", () => {
    it("errors on width exceeding mobile viewport", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.container { width: 500px; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "fixed-width-overflow")).toBeTruthy();
    });

    it("passes on width within mobile viewport", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.container { width: 300px; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "fixed-width-overflow")).toBeFalsy();
    });

    it("errors on min-width exceeding mobile viewport", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.sidebar { min-width: 400px; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "fixed-width-overflow")).toBeTruthy();
    });

    it("ignores percentage widths", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.container { width: 100%; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "fixed-width-overflow")).toBeFalsy();
    });
  });

  describe("media queries", () => {
    it("reports info when no media queries in non-trivial CSS", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.a { color: red; } .b { color: blue; } .c { margin: 10px; } .d { padding: 20px; } .e { display: flex; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "no-media-queries")).toBeTruthy();
    });

    it("passes when media queries exist", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.a { color: red; } @media (max-width: 768px) { .a { color: blue; } }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "no-media-queries")).toBeFalsy();
    });
  });

  describe("tables", () => {
    it("warns on table without responsive wrapper", () => {
      const html = `<html><head>${meta}</head><body><table><tr><td>Data</td></tr></table></body></html>`;
      const result = validateResponsive(html, "");
      expect(result.issues.find((i) => i.rule === "table-no-responsive")).toBeTruthy();
    });
  });

  describe("images", () => {
    it("warns when images exist but no max-width rule", () => {
      const html = `<html><head>${meta}</head><body><img src="photo.jpg"></body></html>`;
      const css = `.hero { background: blue; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "image-no-max-width")).toBeTruthy();
    });

    it("passes when max-width:100% is present", () => {
      const html = `<html><head>${meta}</head><body><img src="photo.jpg"></body></html>`;
      const css = `img { max-width: 100%; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "image-no-max-width")).toBeFalsy();
    });
  });

  describe("horizontal scroll", () => {
    it("reports info on overflow-x:scroll", () => {
      const html = `<html><head>${meta}</head><body></body></html>`;
      const css = `.gallery { overflow-x: scroll; }`;
      const result = validateResponsive(html, css);
      expect(result.issues.find((i) => i.rule === "horizontal-scroll-element")).toBeTruthy();
    });
  });

  describe("result structure", () => {
    it("includes default viewports checked", () => {
      const result = validateResponsive(`<html><head>${meta}</head></html>`, "");
      expect(result.viewportsChecked).toEqual(["mobile", "tablet", "desktop"]);
    });

    it("counts errors and warnings", () => {
      const html = `<html><head></head><body><img src="x"></body></html>`;
      const css = `.wide { width: 500px; }`;
      const result = validateResponsive(html, css);
      expect(result.counts.errors).toBeGreaterThan(0);
    });

    it("isResponsive true when no errors", () => {
      const html = `<html><head>${meta}</head><body><p>Hello</p></body></html>`;
      const css = `.p { color: red; }`;
      const result = validateResponsive(html, css);
      expect(result.isResponsive).toBe(true);
    });

    it("accepts custom viewports", () => {
      const html = `<html><head>${meta}</head></html>`;
      const result = validateResponsive(html, "", [{ name: "custom", width: 320 }]);
      expect(result.viewportsChecked).toEqual(["custom"]);
    });
  });
});
