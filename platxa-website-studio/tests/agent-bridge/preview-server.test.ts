import { describe, it, expect } from "vitest";
import {
  evaluateExpr,
  processAttfValue,
  renderQWeb,
  compileScss,
  createRegistry,
  registerTemplate,
  renderPreview,
} from "@/lib/agent-bridge/preview-server";
import type { QWebContext } from "@/lib/agent-bridge/preview-server";

describe("Preview Server", () => {
  describe("evaluateExpr", () => {
    const ctx: QWebContext = { name: "Platxa", count: 5, active: true, obj: { x: 10 } };

    it("resolves simple variable", () => {
      expect(evaluateExpr("name", ctx)).toBe("Platxa");
    });

    it("resolves dot path", () => {
      expect(evaluateExpr("obj.x", ctx)).toBe(10);
    });

    it("evaluates string literal", () => {
      expect(evaluateExpr("'hello'", ctx)).toBe("hello");
    });

    it("evaluates number literal", () => {
      expect(evaluateExpr("42", ctx)).toBe(42);
    });

    it("evaluates True/False/None", () => {
      expect(evaluateExpr("True", ctx)).toBe(true);
      expect(evaluateExpr("False", ctx)).toBe(false);
      expect(evaluateExpr("None", ctx)).toBe(null);
    });

    it("evaluates not operator", () => {
      expect(evaluateExpr("not active", ctx)).toBe(false);
    });

    it("evaluates == comparison", () => {
      expect(evaluateExpr("count == 5", ctx)).toBe(true);
      expect(evaluateExpr("count == 3", ctx)).toBe(false);
    });

    it("evaluates != comparison", () => {
      expect(evaluateExpr("count != 3", ctx)).toBe(true);
    });

    it("evaluates < > <= >= comparisons", () => {
      expect(evaluateExpr("count > 3", ctx)).toBe(true);
      expect(evaluateExpr("count < 3", ctx)).toBe(false);
      expect(evaluateExpr("count >= 5", ctx)).toBe(true);
      expect(evaluateExpr("count <= 5", ctx)).toBe(true);
    });

    it("evaluates and operator", () => {
      expect(evaluateExpr("active and name", ctx)).toBe("Platxa");
    });

    it("evaluates or operator", () => {
      expect(evaluateExpr("False or name", ctx)).toBe("Platxa");
    });

    it("returns undefined for missing path", () => {
      expect(evaluateExpr("missing.path", ctx)).toBeUndefined();
    });
  });

  describe("processAttfValue", () => {
    it("replaces #{expr} with evaluated value", () => {
      expect(processAttfValue("Hello #{name}!", { name: "World" })).toBe("Hello World!");
    });

    it("handles multiple replacements", () => {
      expect(processAttfValue("#{a}-#{b}", { a: "x", b: "y" })).toBe("x-y");
    });

    it("replaces undefined with empty string", () => {
      expect(processAttfValue("#{missing}", {})).toBe("");
    });
  });

  describe("renderQWeb", () => {
    it("renders t-esc with HTML escaping", () => {
      const html = renderQWeb('<t t-esc="val"/>', { val: "<b>bold</b>" });
      expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    });

    it("renders t-raw without escaping", () => {
      const html = renderQWeb('<t t-raw="val"/>', { val: "<b>bold</b>" });
      expect(html).toContain("<b>bold</b>");
    });

    it("renders t-if true", () => {
      const html = renderQWeb('<div t-if="show">visible</div>', { show: true });
      expect(html).toContain("visible");
    });

    it("renders t-if false", () => {
      const html = renderQWeb('<div t-if="show">hidden</div>', { show: false });
      expect(html).not.toContain("hidden");
    });

    it("renders t-foreach", () => {
      const html = renderQWeb(
        '<li t-foreach="items" t-as="item"><t t-esc="item"/></li>',
        { items: ["a", "b", "c"] },
      );
      expect(html).toContain("<li>a</li>");
      expect(html).toContain("<li>b</li>");
      expect(html).toContain("<li>c</li>");
    });

    it("provides foreach loop variables", () => {
      const html = renderQWeb(
        '<li t-foreach="items" t-as="x"><t t-esc="x_index"/></li>',
        { items: ["a", "b"] },
      );
      expect(html).toContain("<li>0</li>");
      expect(html).toContain("<li>1</li>");
    });

    it("renders t-set", () => {
      const html = renderQWeb(
        '<t t-set="greeting" t-value="\'Hello\'"/><t t-esc="greeting"/>',
        {},
      );
      expect(html).toBe("Hello");
    });

    it("renders t-attf- attributes", () => {
      const html = renderQWeb(
        '<div t-attf-class="section #{cls}">text</div>',
        { cls: "hero" },
      );
      expect(html).toContain('class="section hero"');
    });

    it("renders t-att- attributes", () => {
      const html = renderQWeb(
        '<a t-att-href="url">link</a>',
        { url: "https://example.com" },
      );
      expect(html).toContain('href="https://example.com"');
    });

    it("removes t-att- for false/null values", () => {
      const html = renderQWeb('<div t-att-hidden="val">text</div>', { val: false });
      expect(html).not.toContain("hidden");
    });

    it("renders t-call from registry", () => {
      let reg = createRegistry();
      reg = registerTemplate(reg, "header", "<h1>Title</h1>");
      const html = renderQWeb('<t t-call="header"/>', {}, reg);
      expect(html).toContain("<h1>Title</h1>");
    });

    it("reports error for missing t-call template", () => {
      const errors: Array<{ type: string; message: string }> = [];
      const reg = createRegistry();
      renderQWeb('<t t-call="missing"/>', {}, reg, undefined, errors);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("not found");
    });

    it("handles non-iterable t-foreach gracefully", () => {
      const errors: Array<{ type: string; message: string }> = [];
      renderQWeb(
        '<li t-foreach="items" t-as="x">text</li>',
        { items: "not-array" },
        undefined,
        undefined,
        errors,
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("compileScss", () => {
    it("resolves SCSS variables", () => {
      const { css } = compileScss("$primary: #1a73e8;\n.hero { color: $primary; }");
      expect(css).toContain("#1a73e8");
      expect(css).not.toContain("$primary");
    });

    it("removes variable declarations from output", () => {
      const { css } = compileScss("$x: red;\n.a { color: $x; }");
      expect(css).not.toMatch(/\$x\s*:/);
    });

    it("processes basic nesting", () => {
      const { css } = compileScss(".parent { .child { color: red; } }");
      expect(css).toContain(".parent .child");
    });

    it("processes & parent reference", () => {
      const { css } = compileScss(".btn { &:hover { color: blue; } }");
      expect(css).toContain(".btn:hover");
    });

    it("handles empty input", () => {
      const { css } = compileScss("");
      expect(css).toBe("");
    });
  });

  describe("renderPreview", () => {
    it("combines HTML and CSS in result", () => {
      const result = renderPreview(
        '<div><t t-esc="title"/></div>',
        { title: "Hello" },
        "$color: red;\n.hero { color: $color; }",
      );
      expect(result.html).toContain("Hello");
      expect(result.css).toContain("red");
      expect(result.errors).toHaveLength(0);
    });

    it("tracks used variables", () => {
      const result = renderPreview('<t t-esc="name"/>', { name: "Test" });
      expect(result.usedVariables).toContain("name");
    });

    it("returns empty CSS when no SCSS provided", () => {
      const result = renderPreview("<div>plain</div>", {});
      expect(result.css).toBe("");
    });

    it("collects errors from both rendering and SCSS", () => {
      const reg = createRegistry();
      const result = renderPreview(
        '<t t-call="missing"/>',
        {},
        "",
        reg,
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("createRegistry / registerTemplate", () => {
    it("creates empty registry", () => {
      const reg = createRegistry();
      expect(reg.templates.size).toBe(0);
    });

    it("registers and retrieves templates", () => {
      let reg = createRegistry();
      reg = registerTemplate(reg, "footer", "<footer>Footer</footer>");
      expect(reg.templates.get("footer")).toBe("<footer>Footer</footer>");
    });

    it("does not mutate original registry", () => {
      const reg = createRegistry();
      const reg2 = registerTemplate(reg, "a", "test");
      expect(reg.templates.size).toBe(0);
      expect(reg2.templates.size).toBe(1);
    });
  });
});
