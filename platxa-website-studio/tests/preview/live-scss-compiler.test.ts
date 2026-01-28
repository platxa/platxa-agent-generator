import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compileScssToCSS,
  compileAllScss,
  injectCSSToIframe,
  createLiveCompiler,
  CSS_INJECT_SCRIPT,
} from "@/lib/preview/live-scss-compiler";

describe("Live SCSS Compiler", () => {
  describe("compileScssToCSS", () => {
    it("compiles valid SCSS to CSS", () => {
      const result = compileScssToCSS("$color: red; .test { color: $color; }");
      expect(result.success).toBe(true);
      expect(result.css).toContain("color: red");
      expect(result.error).toBeNull();
    });

    it("reports compilation time in ms", () => {
      const result = compileScssToCSS(".test { color: blue; }");
      expect(result.durationMs).toBeTypeOf("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("compiles in under 500ms", () => {
      const scss = `
        $o-color-1: #7c3aed;
        $o-color-2: #6c757d;
        .s_hero { background: $o-color-1; color: $o-color-2;
          .container { padding: 2rem;
            h1 { font-size: 3rem; }
            p { font-size: 1.2rem; }
          }
        }
        .s_features { padding: 4rem;
          .card { border-radius: 8px; &:hover { transform: scale(1.02); } }
        }
      `;
      const result = compileScssToCSS(scss);
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeLessThan(500);
    });

    it("returns error for invalid SCSS", () => {
      const result = compileScssToCSS("{{ broken }}");
      expect(result.success).toBe(false);
      expect(result.css).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it("includes file name in result", () => {
      const result = compileScssToCSS(".x{}", "theme.scss");
      expect(result.file).toBe("theme.scss");
    });
  });

  describe("compileAllScss", () => {
    it("compiles multiple SCSS files into one CSS output", () => {
      const files: Record<string, string> = {
        "variables.scss": "$primary: #7c3aed;",
        "hero.scss": ".s_hero { color: $primary; }",
        "page.xml": "<div>not scss</div>",
      };
      const result = compileAllScss(files);
      expect(result.success).toBe(true);
      expect(result.css).toContain("#7c3aed");
    });

    it("sorts variable files first for resolution", () => {
      const files: Record<string, string> = {
        "hero.scss": ".s_hero { color: $primary; }",
        "color-variables.scss": "$primary: #ff0000;",
      };
      const result = compileAllScss(files);
      expect(result.success).toBe(true);
      expect(result.css).toContain("#ff0000");
    });

    it("returns empty CSS for no SCSS files", () => {
      const result = compileAllScss({ "page.xml": "<div/>" });
      expect(result.success).toBe(true);
      expect(result.css).toBe("");
    });

    it("reports error if any SCSS is invalid", () => {
      const files = { "bad.scss": "{{ broken }}" };
      const result = compileAllScss(files);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("CSS_INJECT_SCRIPT", () => {
    it("creates a style element with id platxa-live-css", () => {
      expect(CSS_INJECT_SCRIPT).toContain("platxa-live-css");
    });

    it("listens for platxa:inject-css messages", () => {
      expect(CSS_INJECT_SCRIPT).toContain("platxa:inject-css");
      expect(CSS_INJECT_SCRIPT).toContain("addEventListener");
    });
  });

  describe("injectCSSToIframe", () => {
    it("returns false for null iframe", () => {
      expect(injectCSSToIframe(null, "body{}")).toBe(false);
    });

    it("returns false for iframe without contentWindow", () => {
      const iframe = { contentWindow: null } as unknown as HTMLIFrameElement;
      expect(injectCSSToIframe(iframe, "body{}")).toBe(false);
    });

    it("posts message to iframe contentWindow", () => {
      const postMessage = vi.fn();
      const iframe = {
        contentWindow: { postMessage },
      } as unknown as HTMLIFrameElement;

      const result = injectCSSToIframe(iframe, ".test { color: red; }");
      expect(result).toBe(true);
      expect(postMessage).toHaveBeenCalledWith(
        { type: "platxa:inject-css", css: ".test { color: red; }" },
        "*",
      );
    });
  });

  describe("createLiveCompiler", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("debounces compilation", () => {
      const onCompile = vi.fn();
      const compiler = createLiveCompiler({ debounceMs: 100, onCompile });

      compiler.compile({ "a.scss": ".a { color: red; }" });
      compiler.compile({ "a.scss": ".a { color: blue; }" });
      compiler.compile({ "a.scss": ".a { color: green; }" });

      expect(onCompile).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(onCompile).toHaveBeenCalledTimes(1);
      expect(onCompile.mock.calls[0][0].css).toContain("green");

      compiler.dispose();
    });

    it("getLastResult returns most recent result", () => {
      const compiler = createLiveCompiler({ debounceMs: 0 });

      compiler.compile({ "test.scss": ".x { color: red; }" });
      vi.advanceTimersByTime(0);

      const result = compiler.getLastResult();
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);

      compiler.dispose();
    });

    it("dispose clears pending timer", () => {
      const onCompile = vi.fn();
      const compiler = createLiveCompiler({ debounceMs: 100, onCompile });

      compiler.compile({ "a.scss": ".a{}" });
      compiler.dispose();
      vi.advanceTimersByTime(200);

      expect(onCompile).not.toHaveBeenCalled();
    });
  });
});
