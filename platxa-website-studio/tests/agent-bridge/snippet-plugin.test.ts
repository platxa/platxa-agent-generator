import { describe, it, expect } from "vitest";
import {
  createPluginRegistry,
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  listPlugins,
  listPluginsByCategory,
  getPluginCount,
  generateAiToolSchema,
  generateAllToolSchemas,
  generateSnippetQWeb,
  generateSnippetScss,
  validateValues,
  getDefaultValues,
} from "@/lib/agent-bridge/snippet-plugin";
import type { SnippetPluginDef } from "@/lib/agent-bridge/snippet-plugin";

const pricingPlugin: SnippetPluginDef = {
  typeId: "pricing_table",
  name: "Pricing Table",
  category: "commerce",
  description: "Displays pricing plans",
  fields: [
    { name: "title", type: "string", label: "Title", required: true, description: "Table heading" },
    { name: "columns", type: "number", label: "Columns", required: true, defaultValue: 3 },
    { name: "highlight", type: "boolean", label: "Highlight Best", required: false, defaultValue: true },
    { name: "style", type: "select", label: "Style", required: true, options: ["flat", "card", "bordered"] },
  ],
  generateQWeb: (v) =>
    `<section class="s_pricing" data-columns="${v.columns}">\n  <h2>${v.title}</h2>\n</section>`,
  generateScss: (v) =>
    `.s_pricing { columns: ${v.columns}; }`,
};

const testimonialPlugin: SnippetPluginDef = {
  typeId: "testimonial",
  name: "Testimonial",
  category: "content",
  description: "Customer testimonials",
  fields: [
    { name: "quote", type: "rich_text", label: "Quote", required: true },
    { name: "author", type: "string", label: "Author", required: true },
  ],
  generateQWeb: (v) =>
    `<section class="s_testimonial"><blockquote>${v.quote}</blockquote><cite>${v.author}</cite></section>`,
};

describe("Snippet Plugin", () => {
  describe("createPluginRegistry", () => {
    it("creates empty registry", () => {
      const state = createPluginRegistry();
      expect(getPluginCount(state)).toBe(0);
    });
  });

  describe("registerPlugin", () => {
    it("registers a plugin", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      expect(getPluginCount(state)).toBe(1);
      expect(getPlugin(state, "pricing_table")).toBeDefined();
    });

    it("throws on duplicate registration", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      expect(() => registerPlugin(state, pricingPlugin)).toThrow("already registered");
    });

    it("does not mutate input", () => {
      const original = createPluginRegistry();
      registerPlugin(original, pricingPlugin);
      expect(getPluginCount(original)).toBe(0);
    });
  });

  describe("unregisterPlugin", () => {
    it("removes a plugin", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      state = unregisterPlugin(state, "pricing_table");
      expect(getPluginCount(state)).toBe(0);
    });
  });

  describe("queries", () => {
    it("getPlugin returns undefined for unknown", () => {
      expect(getPlugin(createPluginRegistry(), "unknown")).toBeUndefined();
    });

    it("listPlugins returns all", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      state = registerPlugin(state, testimonialPlugin);
      expect(listPlugins(state)).toHaveLength(2);
    });

    it("listPluginsByCategory filters", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      state = registerPlugin(state, testimonialPlugin);
      expect(listPluginsByCategory(state, "commerce")).toHaveLength(1);
      expect(listPluginsByCategory(state, "content")).toHaveLength(1);
    });
  });

  describe("generateAiToolSchema", () => {
    it("generates tool name from typeId", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      expect(schema.name).toBe("generate_pricing_table");
    });

    it("includes description", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      expect(schema.description).toContain("Pricing Table");
    });

    it("maps fields to parameters", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      expect(schema.parameters).toHaveLength(4);
      const title = schema.parameters.find((p) => p.name === "title");
      expect(title?.type).toBe("string");
      expect(title?.required).toBe(true);
    });

    it("maps number type", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      const cols = schema.parameters.find((p) => p.name === "columns");
      expect(cols?.type).toBe("number");
    });

    it("maps boolean type", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      const hl = schema.parameters.find((p) => p.name === "highlight");
      expect(hl?.type).toBe("boolean");
    });

    it("includes enum for select fields", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      const style = schema.parameters.find((p) => p.name === "style");
      expect(style?.enum).toEqual(["flat", "card", "bordered"]);
    });

    it("uses field description", () => {
      const schema = generateAiToolSchema(pricingPlugin);
      const title = schema.parameters.find((p) => p.name === "title");
      expect(title?.description).toBe("Table heading");
    });
  });

  describe("generateAllToolSchemas", () => {
    it("generates schemas for all plugins", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      state = registerPlugin(state, testimonialPlugin);
      const schemas = generateAllToolSchemas(state);
      expect(schemas).toHaveLength(2);
    });
  });

  describe("generateSnippetQWeb", () => {
    it("generates QWeb from plugin", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      const qweb = generateSnippetQWeb(state, "pricing_table", { title: "Plans", columns: 3 });
      expect(qweb).toContain("s_pricing");
      expect(qweb).toContain("Plans");
      expect(qweb).toContain('data-columns="3"');
    });

    it("throws for unknown type", () => {
      const state = createPluginRegistry();
      expect(() => generateSnippetQWeb(state, "unknown", {})).toThrow("Unknown snippet type");
    });
  });

  describe("generateSnippetScss", () => {
    it("generates SCSS when available", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, pricingPlugin);
      const scss = generateSnippetScss(state, "pricing_table", { columns: 3 });
      expect(scss).toContain(".s_pricing");
    });

    it("returns null when no SCSS generator", () => {
      let state = createPluginRegistry();
      state = registerPlugin(state, testimonialPlugin);
      expect(generateSnippetScss(state, "testimonial", {})).toBeNull();
    });
  });

  describe("validateValues", () => {
    it("passes with valid values", () => {
      const errors = validateValues(pricingPlugin, {
        title: "Plans",
        columns: 3,
        highlight: true,
        style: "flat",
      });
      expect(errors).toHaveLength(0);
    });

    it("errors on missing required field", () => {
      const errors = validateValues(pricingPlugin, { columns: 3, style: "flat" });
      expect(errors.some((e) => e.field === "title")).toBe(true);
    });

    it("errors on wrong type for number", () => {
      const errors = validateValues(pricingPlugin, {
        title: "Plans",
        columns: "three",
        style: "flat",
      });
      expect(errors.some((e) => e.field === "columns")).toBe(true);
    });

    it("errors on invalid select value", () => {
      const errors = validateValues(pricingPlugin, {
        title: "Plans",
        columns: 3,
        style: "neon",
      });
      expect(errors.some((e) => e.field === "style")).toBe(true);
    });

    it("allows optional fields to be missing", () => {
      const errors = validateValues(pricingPlugin, {
        title: "Plans",
        columns: 3,
        style: "flat",
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("getDefaultValues", () => {
    it("returns defaults for fields with defaultValue", () => {
      const defaults = getDefaultValues(pricingPlugin);
      expect(defaults.columns).toBe(3);
      expect(defaults.highlight).toBe(true);
    });

    it("omits fields without defaultValue", () => {
      const defaults = getDefaultValues(pricingPlugin);
      expect("title" in defaults).toBe(false);
    });
  });
});
