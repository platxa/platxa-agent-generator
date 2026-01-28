import { describe, it, expect } from "vitest";
import { validateKeyboardNav } from "@/lib/agent-bridge/keyboard-nav-validator";

describe("Keyboard Navigation Validator", () => {
  describe("onclick without keyboard handler", () => {
    it("errors on div with onclick but no onkeydown", () => {
      const html = `<div onclick="doStuff()">Click me</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "onclick-no-keyboard")).toBeTruthy();
      expect(result.isNavigable).toBe(false);
    });

    it("passes div with onclick and onkeydown", () => {
      const html = `<div onclick="doStuff()" onkeydown="doStuff()">Click me</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "onclick-no-keyboard")).toBeFalsy();
    });

    it("does not flag native button with onclick", () => {
      const html = `<button onclick="doStuff()">OK</button>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "onclick-no-keyboard")).toBeFalsy();
    });

    it("flags span with onclick", () => {
      const html = `<span onclick="toggle()">Toggle</span>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "onclick-no-keyboard")).toBeTruthy();
    });
  });

  describe("custom interactive without tabindex", () => {
    it("errors on div with onclick but no tabindex", () => {
      const html = `<div onclick="doStuff()">Click</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "div-interactive-no-tabindex")).toBeTruthy();
    });

    it("passes div with onclick and tabindex", () => {
      const html = `<div onclick="doStuff()" tabindex="0" onkeydown="doStuff()">Click</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "div-interactive-no-tabindex")).toBeFalsy();
    });
  });

  describe("positive tabindex", () => {
    it("warns on tabindex > 0", () => {
      const html = `<div tabindex="5">Focus me</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "positive-tabindex")).toBeTruthy();
    });

    it("passes tabindex=0", () => {
      const html = `<div tabindex="0" role="button">OK</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "positive-tabindex")).toBeFalsy();
    });

    it("passes tabindex=-1", () => {
      const html = `<div tabindex="-1">Hidden focus</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "positive-tabindex")).toBeFalsy();
    });
  });

  describe("tabindex without role", () => {
    it("warns on div with tabindex=0 but no role", () => {
      const html = `<div tabindex="0">Custom</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "tabindex-no-role")).toBeTruthy();
    });

    it("passes div with tabindex and role", () => {
      const html = `<div tabindex="0" role="button">Custom</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "tabindex-no-role")).toBeFalsy();
    });

    it("skips native focusable elements", () => {
      const html = `<button tabindex="0">OK</button>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "tabindex-no-role")).toBeFalsy();
    });

    it("skips tabindex=-1 (programmatic focus only)", () => {
      const html = `<div tabindex="-1">Hidden</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues.find((i) => i.rule === "tabindex-no-role")).toBeFalsy();
    });
  });

  describe("focus styles in CSS", () => {
    it("errors on outline:none without focus styles", () => {
      const html = `<button>OK</button>`;
      const css = `button { outline: none; }`;
      const result = validateKeyboardNav(html, css);
      expect(result.issues.find((i) => i.rule === "missing-focus-styles")).toBeTruthy();
    });

    it("passes outline:none with :focus-visible", () => {
      const html = `<button>OK</button>`;
      const css = `button { outline: none; } button:focus-visible { box-shadow: 0 0 0 2px blue; }`;
      const result = validateKeyboardNav(html, css);
      expect(result.issues.find((i) => i.rule === "missing-focus-styles")).toBeFalsy();
    });

    it("passes outline:none with :focus", () => {
      const html = `<button>OK</button>`;
      const css = `button { outline: none; } button:focus { border-color: blue; }`;
      const result = validateKeyboardNav(html, css);
      expect(result.issues.find((i) => i.rule === "missing-focus-styles")).toBeFalsy();
    });

    it("passes when no outline:none present", () => {
      const html = `<button>OK</button>`;
      const css = `button { color: red; }`;
      const result = validateKeyboardNav(html, css);
      expect(result.issues.find((i) => i.rule === "missing-focus-styles")).toBeFalsy();
    });
  });

  describe("result structure", () => {
    it("counts native interactive elements", () => {
      const html = `<button>A</button><a href="/">B</a><input type="text">`;
      const result = validateKeyboardNav(html);
      expect(result.counts.nativeInteractive).toBe(3);
    });

    it("counts custom interactive elements", () => {
      const html = `<div onclick="x()">A</div><span onclick="y()">B</span>`;
      const result = validateKeyboardNav(html);
      expect(result.counts.customInteractive).toBe(2);
    });

    it("isNavigable true when no errors", () => {
      const html = `<button>OK</button><a href="/">Home</a>`;
      const result = validateKeyboardNav(html);
      expect(result.isNavigable).toBe(true);
    });

    it("includes WCAG references", () => {
      const html = `<div onclick="x()">Click</div>`;
      const result = validateKeyboardNav(html);
      expect(result.issues[0].wcag).toBeTruthy();
    });
  });
});
