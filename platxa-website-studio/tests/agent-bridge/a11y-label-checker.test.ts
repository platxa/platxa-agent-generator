import { describe, it, expect } from "vitest";
import { checkA11yLabels } from "@/lib/agent-bridge/a11y-label-checker";

describe("A11y Label Checker", () => {
  describe("images", () => {
    it("errors on img without alt", () => {
      const result = checkA11yLabels(`<img src="photo.jpg">`);
      expect(result.issues.find((i) => i.type === "img-alt-missing")).toBeTruthy();
      expect(result.isAccessible).toBe(false);
    });

    it("passes img with alt text", () => {
      const result = checkA11yLabels(`<img src="photo.jpg" alt="A photo">`);
      expect(result.issues.find((i) => i.type === "img-alt-missing")).toBeFalsy();
      expect(result.counts.imagesWithAlt).toBe(1);
    });

    it("warns on empty alt without role=presentation", () => {
      const result = checkA11yLabels(`<img src="bg.jpg" alt="">`);
      expect(result.issues.find((i) => i.type === "img-alt-empty")).toBeTruthy();
    });

    it("passes empty alt with role attribute", () => {
      const result = checkA11yLabels(`<img src="bg.jpg" alt="" role="presentation">`);
      expect(result.issues.find((i) => i.type === "img-alt-empty")).toBeFalsy();
    });

    it("counts total images", () => {
      const result = checkA11yLabels(`<img src="a.jpg" alt="a"><img src="b.jpg" alt="b">`);
      expect(result.counts.images).toBe(2);
      expect(result.counts.imagesWithAlt).toBe(2);
    });
  });

  describe("buttons", () => {
    it("errors on button without text or aria-label", () => {
      const result = checkA11yLabels(`<button></button>`);
      expect(result.issues.find((i) => i.type === "button-label-missing")).toBeTruthy();
    });

    it("passes button with visible text", () => {
      const result = checkA11yLabels(`<button>Click me</button>`);
      expect(result.issues.find((i) => i.type === "button-label-missing")).toBeFalsy();
    });

    it("passes button with aria-label", () => {
      const result = checkA11yLabels(`<button aria-label="Close"></button>`);
      expect(result.issues.find((i) => i.type === "button-label-missing")).toBeFalsy();
    });

    it("passes button with title", () => {
      const result = checkA11yLabels(`<button title="Submit form"></button>`);
      expect(result.issues.find((i) => i.type === "button-label-missing")).toBeFalsy();
    });
  });

  describe("links", () => {
    it("errors on empty link without label", () => {
      const result = checkA11yLabels(`<a href="/"></a>`);
      expect(result.issues.find((i) => i.type === "link-label-missing")).toBeTruthy();
    });

    it("passes link with text", () => {
      const result = checkA11yLabels(`<a href="/">Home</a>`);
      expect(result.issues.find((i) => i.type === "link-label-missing")).toBeFalsy();
    });

    it("passes link with aria-label", () => {
      const result = checkA11yLabels(`<a href="/" aria-label="Go home"></a>`);
      expect(result.issues.find((i) => i.type === "link-label-missing")).toBeFalsy();
    });
  });

  describe("inputs", () => {
    it("errors on input without any label", () => {
      const result = checkA11yLabels(`<input type="text">`);
      expect(result.issues.find((i) => i.type === "input-label-missing")).toBeTruthy();
    });

    it("passes input with aria-label", () => {
      const result = checkA11yLabels(`<input type="text" aria-label="Name">`);
      expect(result.issues.find((i) => i.type === "input-label-missing")).toBeFalsy();
    });

    it("passes input with placeholder", () => {
      const result = checkA11yLabels(`<input type="text" placeholder="Enter name">`);
      expect(result.issues.find((i) => i.type === "input-label-missing")).toBeFalsy();
    });

    it("skips hidden inputs", () => {
      const result = checkA11yLabels(`<input type="hidden" name="csrf">`);
      expect(result.issues.find((i) => i.type === "input-label-missing")).toBeFalsy();
    });
  });

  describe("selects and textareas", () => {
    it("errors on select without label", () => {
      const result = checkA11yLabels(`<select><option>A</option></select>`);
      expect(result.issues.find((i) => i.type === "select-label-missing")).toBeTruthy();
    });

    it("passes select with aria-label", () => {
      const result = checkA11yLabels(`<select aria-label="Country"><option>US</option></select>`);
      expect(result.issues.find((i) => i.type === "select-label-missing")).toBeFalsy();
    });

    it("errors on textarea without label", () => {
      const result = checkA11yLabels(`<textarea></textarea>`);
      expect(result.issues.find((i) => i.type === "textarea-label-missing")).toBeTruthy();
    });

    it("passes textarea with aria-labelledby", () => {
      const result = checkA11yLabels(`<textarea aria-labelledby="msg-label"></textarea>`);
      expect(result.issues.find((i) => i.type === "textarea-label-missing")).toBeFalsy();
    });
  });

  describe("result structure", () => {
    it("isAccessible true when no errors", () => {
      const html = `<img src="x" alt="x"><button>OK</button><a href="/">Home</a>`;
      const result = checkA11yLabels(html);
      expect(result.isAccessible).toBe(true);
    });

    it("counts interactive elements", () => {
      const html = `<button>A</button><a href="/">B</a><input type="text" aria-label="C">`;
      const result = checkA11yLabels(html);
      expect(result.counts.interactiveElements).toBe(3);
      expect(result.counts.labeledElements).toBe(3);
    });

    it("includes WCAG reference in issues", () => {
      const result = checkA11yLabels(`<img src="x">`);
      expect(result.issues[0].wcag).toBeTruthy();
    });
  });
});
