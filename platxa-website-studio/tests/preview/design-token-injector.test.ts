// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DesignTokenInjector,
  createTokenInjector,
  createTokenInjectorWithTokens,
  createEmptyTokens,
  createSampleBrandTokens,
  mergeTokens,
  estimateTokenCount,
  isWithinTokenLimit,
  serializeColors,
  serializeTypography,
  serializeSpacing,
  serializeRadii,
  serializeShadows,
  serializeCustom,
  serializeTokens,
  validateTokenCount,
  type DesignTokens,
  type TokenContext,
  type ProjectLoadEvent,
} from "@/lib/preview/design-token-injector";

describe("DesignTokenInjector", () => {
  describe("agent context includes serialized brand tokens under 500 tokens (Feature #163)", () => {
    it("serializes brand tokens under 500 tokens", () => {
      // Feature #163: Serialized brand tokens under 500 tokens
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);

      const context = injector.getContext();

      expect(context).not.toBeNull();
      expect(context!.tokenCount).toBeLessThanOrEqual(500);
    });

    it("includes color tokens in context", () => {
      // Feature #163: Agent context includes brand tokens
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);

      const context = injector.getContext();

      expect(context!.content).toContain("primary");
      expect(context!.content).toContain("#1a73e8");
      expect(context!.categories).toContain("colors");
    });

    it("includes typography tokens in context", () => {
      // Feature #163: Agent context includes brand tokens
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);

      const context = injector.getContext();

      expect(context!.content).toContain("h1");
      expect(context!.content).toContain("32px");
      expect(context!.categories).toContain("typography");
    });

    it("includes spacing tokens in context", () => {
      // Feature #163: Agent context includes brand tokens
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);

      const context = injector.getContext();

      expect(context!.content).toContain("md");
      expect(context!.content).toContain("16px");
      expect(context!.categories).toContain("spacing");
    });

    it("auto-injects on project load", () => {
      // Feature #163: Automatically on project load
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);
      const callback = vi.fn();
      injector.onInjection(callback);

      const event: ProjectLoadEvent = {
        projectId: "proj-123",
        projectName: "Test Project",
        timestamp: Date.now(),
      };

      injector.injectOnProjectLoad(event);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenCount: expect.any(Number),
          categories: expect.any(Array),
        }),
        event
      );
    });

    it("truncates tokens if over limit", () => {
      // Feature #163: Under 500 tokens - truncates if necessary
      const largeTokens: DesignTokens = {
        colors: Array.from({ length: 100 }, (_, i) => ({
          name: `color-${i}`,
          value: `#${i.toString(16).padStart(6, "0")}`,
          semantic: `semantic-description-for-color-${i}`,
        })),
        typography: Array.from({ length: 50 }, (_, i) => ({
          name: `type-${i}`,
          fontSize: `${12 + i}px`,
          fontWeight: 400 + i,
          lineHeight: 1.5,
        })),
        spacing: [],
        radii: [],
        shadows: [],
      };

      const injector = createTokenInjectorWithTokens(largeTokens, { maxTokens: 500 });
      const context = injector.getContext();

      expect(context!.tokenCount).toBeLessThanOrEqual(500);
      expect(context!.truncated).toBe(true);
    });
  });

  describe("estimateTokenCount", () => {
    it("estimates tokens for short text", () => {
      const count = estimateTokenCount("hello world");
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it("estimates tokens for longer text", () => {
      const text = "This is a longer piece of text that should have more tokens";
      const count = estimateTokenCount(text);
      expect(count).toBeGreaterThan(10);
    });

    it("returns 0 for empty string", () => {
      expect(estimateTokenCount("")).toBe(0);
    });
  });

  describe("isWithinTokenLimit", () => {
    it("returns true when under limit", () => {
      expect(isWithinTokenLimit("short text", 100)).toBe(true);
    });

    it("returns false when over limit", () => {
      const longText = "a".repeat(1000);
      expect(isWithinTokenLimit(longText, 10)).toBe(false);
    });
  });

  describe("serializeColors", () => {
    it("serializes colors in compact mode", () => {
      const colors = [
        { name: "primary", value: "#1a73e8" },
        { name: "secondary", value: "#34a853" },
      ];

      const result = serializeColors(colors, true);

      expect(result).toBe("primary:#1a73e8,secondary:#34a853");
    });

    it("serializes colors in verbose mode", () => {
      const colors = [
        { name: "primary", value: "#1a73e8", semantic: "brand" },
      ];

      const result = serializeColors(colors, false);

      expect(result).toContain("primary: #1a73e8");
      expect(result).toContain("(brand)");
    });

    it("returns empty string for empty array", () => {
      expect(serializeColors([], true)).toBe("");
    });
  });

  describe("serializeTypography", () => {
    it("serializes typography in compact mode", () => {
      const typography = [
        { name: "h1", fontSize: "32px", lineHeight: 1.2, fontWeight: 700 },
      ];

      const result = serializeTypography(typography, true);

      expect(result).toContain("h1");
      expect(result).toContain("32px");
    });

    it("serializes typography in verbose mode", () => {
      const typography = [
        { name: "body", fontSize: "16px", fontFamily: "Arial" },
      ];

      const result = serializeTypography(typography, false);

      expect(result).toContain("body:");
      expect(result).toContain("family: Arial");
    });
  });

  describe("serializeSpacing", () => {
    it("serializes spacing in compact mode", () => {
      const spacing = [
        { name: "sm", value: "8px" },
        { name: "md", value: "16px" },
      ];

      const result = serializeSpacing(spacing, true);

      expect(result).toBe("sm:8px,md:16px");
    });
  });

  describe("serializeRadii", () => {
    it("serializes radii in compact mode", () => {
      const radii = [
        { name: "sm", value: "4px" },
        { name: "lg", value: "16px" },
      ];

      const result = serializeRadii(radii, true);

      expect(result).toBe("sm:4px,lg:16px");
    });
  });

  describe("serializeShadows", () => {
    it("serializes shadows in compact mode", () => {
      const shadows = [
        { name: "sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
      ];

      const result = serializeShadows(shadows, true);

      expect(result).toContain("sm:");
    });
  });

  describe("serializeCustom", () => {
    it("serializes custom tokens in compact mode", () => {
      const custom = { brand: "Acme", version: "1.0" };

      const result = serializeCustom(custom, true);

      expect(result).toBe("brand:Acme,version:1.0");
    });

    it("returns empty string for empty object", () => {
      expect(serializeCustom({}, true)).toBe("");
    });
  });

  describe("serializeTokens", () => {
    it("serializes all token categories", () => {
      const tokens = createSampleBrandTokens();
      const config = {
        maxTokens: 500,
        includeColors: true,
        includeTypography: true,
        includeSpacing: true,
        includeRadii: true,
        includeShadows: true,
        includeCustom: true,
        compactMode: true,
      };

      const result = serializeTokens(tokens, config);

      expect(result.categories).toContain("colors");
      expect(result.categories).toContain("typography");
      expect(result.categories).toContain("spacing");
    });

    it("respects config exclusions", () => {
      const tokens = createSampleBrandTokens();
      const config = {
        maxTokens: 500,
        includeColors: true,
        includeTypography: false,
        includeSpacing: false,
        includeRadii: false,
        includeShadows: false,
        includeCustom: false,
        compactMode: true,
      };

      const result = serializeTokens(tokens, config);

      expect(result.categories).toContain("colors");
      expect(result.categories).not.toContain("typography");
    });

    it("truncates when over limit", () => {
      const tokens = createSampleBrandTokens();
      const config = {
        maxTokens: 10, // Very low limit
        includeColors: true,
        includeTypography: true,
        includeSpacing: true,
        includeRadii: true,
        includeShadows: true,
        includeCustom: true,
        compactMode: true,
      };

      const result = serializeTokens(tokens, config);

      expect(result.truncated).toBe(true);
      expect(result.tokenCount).toBeLessThanOrEqual(10);
    });
  });

  describe("DesignTokenInjector class", () => {
    let injector: DesignTokenInjector;

    beforeEach(() => {
      injector = createTokenInjector();
    });

    it("loads and gets tokens", () => {
      const tokens = createSampleBrandTokens();
      injector.loadTokens(tokens);

      expect(injector.getTokens()).toBe(tokens);
    });

    it("clears tokens", () => {
      injector.loadTokens(createSampleBrandTokens());
      injector.clearTokens();

      expect(injector.getTokens()).toBeNull();
    });

    it("returns null context when no tokens loaded", () => {
      expect(injector.getContext()).toBeNull();
    });

    it("caches context after first serialization", () => {
      injector.loadTokens(createSampleBrandTokens());

      const context1 = injector.getContext();
      const context2 = injector.getContext();

      expect(context1).toBe(context2);
    });

    it("invalidates cache on token reload", () => {
      injector.loadTokens(createSampleBrandTokens());
      const context1 = injector.getContext();

      injector.loadTokens(createEmptyTokens());
      const context2 = injector.getContext();

      expect(context1).not.toBe(context2);
    });

    it("invalidates cache on config update", () => {
      injector.loadTokens(createSampleBrandTokens());
      const context1 = injector.getContext();

      injector.updateConfig({ compactMode: false });
      const context2 = injector.getContext();

      expect(context1).not.toBe(context2);
    });

    it("registers and calls injection callbacks", () => {
      injector.loadTokens(createSampleBrandTokens());
      const callback = vi.fn();
      injector.onInjection(callback);

      const event: ProjectLoadEvent = {
        projectId: "123",
        projectName: "Test",
        timestamp: Date.now(),
      };

      injector.injectOnProjectLoad(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("removes injection callbacks", () => {
      injector.loadTokens(createSampleBrandTokens());
      const callback = vi.fn();
      injector.onInjection(callback);
      injector.offInjection(callback);

      injector.injectOnProjectLoad({
        projectId: "123",
        projectName: "Test",
        timestamp: Date.now(),
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      injector.loadTokens(createSampleBrandTokens());
      injector.onInjection(() => {
        throw new Error("Callback error");
      });

      // Should not throw
      expect(() => {
        injector.injectOnProjectLoad({
          projectId: "123",
          projectName: "Test",
          timestamp: Date.now(),
        });
      }).not.toThrow();
    });

    it("creates agent context with tokens", () => {
      injector.loadTokens(createSampleBrandTokens());

      const context = injector.createAgentContext("Base context");

      expect(context).toContain("Base context");
      expect(context).toContain("[Design Tokens]");
      expect(context).toContain("primary");
    });

    it("creates agent context without base", () => {
      injector.loadTokens(createSampleBrandTokens());

      const context = injector.createAgentContext();

      expect(context).toContain("[Design Tokens]");
    });

    it("returns base context when no tokens", () => {
      const context = injector.createAgentContext("Base only");

      expect(context).toBe("Base only");
    });

    it("isWithinLimit returns true when under limit", () => {
      injector.loadTokens(createSampleBrandTokens());

      expect(injector.isWithinLimit()).toBe(true);
    });

    it("getTokenCount returns token count", () => {
      injector.loadTokens(createSampleBrandTokens());

      expect(injector.getTokenCount()).toBeGreaterThan(0);
      expect(injector.getTokenCount()).toBeLessThanOrEqual(500);
    });

    it("getTokenCount returns 0 when no tokens", () => {
      expect(injector.getTokenCount()).toBe(0);
    });

    it("updates and gets config", () => {
      injector.updateConfig({ maxTokens: 1000 });
      const config = injector.getConfig();

      expect(config.maxTokens).toBe(1000);
    });
  });

  describe("factory functions", () => {
    it("createTokenInjector creates instance", () => {
      const injector = createTokenInjector();

      expect(injector).toBeInstanceOf(DesignTokenInjector);
    });

    it("createTokenInjectorWithTokens creates loaded instance", () => {
      const tokens = createSampleBrandTokens();
      const injector = createTokenInjectorWithTokens(tokens);

      expect(injector.getTokens()).toBe(tokens);
    });
  });

  describe("utility functions", () => {
    describe("createEmptyTokens", () => {
      it("creates empty token set", () => {
        const tokens = createEmptyTokens();

        expect(tokens.colors).toEqual([]);
        expect(tokens.typography).toEqual([]);
        expect(tokens.spacing).toEqual([]);
      });
    });

    describe("createSampleBrandTokens", () => {
      it("creates sample tokens with all categories", () => {
        const tokens = createSampleBrandTokens();

        expect(tokens.colors.length).toBeGreaterThan(0);
        expect(tokens.typography.length).toBeGreaterThan(0);
        expect(tokens.spacing.length).toBeGreaterThan(0);
        expect(tokens.radii.length).toBeGreaterThan(0);
        expect(tokens.shadows.length).toBeGreaterThan(0);
      });
    });

    describe("mergeTokens", () => {
      it("merges token sets", () => {
        const base = createSampleBrandTokens();
        const override = {
          colors: [{ name: "override", value: "#000" }],
        };

        const merged = mergeTokens(base, override);

        expect(merged.colors).toEqual(override.colors);
        expect(merged.typography).toEqual(base.typography);
      });

      it("merges custom tokens", () => {
        const base: DesignTokens = {
          ...createEmptyTokens(),
          custom: { a: "1" },
        };
        const override = {
          custom: { b: "2" },
        };

        const merged = mergeTokens(base, override);

        expect(merged.custom).toEqual({ a: "1", b: "2" });
      });
    });

    describe("validateTokenCount", () => {
      it("returns true when under limit", () => {
        const context: TokenContext = {
          content: "test",
          tokenCount: 100,
          categories: [],
          truncated: false,
        };

        expect(validateTokenCount(context, 500)).toBe(true);
      });

      it("returns false when over limit", () => {
        const context: TokenContext = {
          content: "test",
          tokenCount: 600,
          categories: [],
          truncated: false,
        };

        expect(validateTokenCount(context, 500)).toBe(false);
      });
    });
  });
});
