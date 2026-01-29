import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compileScssToCSS,
  compileAllScss,
  injectCSSToIframe,
  createLiveCompiler,
  parseSassException,
  formatScssError,
  CSS_INJECT_SCRIPT,
  type ScssCompileError,
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

    it("returns null compileError on success", () => {
      const result = compileScssToCSS(".test { color: red; }");
      expect(result.success).toBe(true);
      expect(result.compileError).toBeNull();
    });

    it("returns structured compileError on failure", () => {
      const result = compileScssToCSS("{{ broken }}", "theme.scss");
      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.message).toBeTruthy();
      expect(result.compileError!.fullMessage).toBeTruthy();
    });

    it("captures line number in compileError", () => {
      // Create SCSS with error on a specific line
      const scss = `.valid { color: red; }
.also-valid { color: blue; }
.broken { color: $undefined-variable; }`;
      const result = compileScssToCSS(scss, "test.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.line).toBe(3); // Error is on line 3
    });

    it("captures column number in compileError", () => {
      const scss = ".test { color: $undefined; }";
      const result = compileScssToCSS(scss, "test.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.column).toBeGreaterThan(0);
    });

    it("captures file path in compileError", () => {
      const result = compileScssToCSS("{{ broken }}", "my-theme.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      // File should be either the provided name or from span
      expect(result.compileError!.file).toBeTruthy();
    });
  });

  describe("structured error capture", () => {
    it("captures undefined variable error with location", () => {
      const scss = `$color: red;
.test {
  background: $undefined-var;
}`;
      const result = compileScssToCSS(scss, "variables.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.message.toLowerCase()).toContain("undefined");
      expect(result.compileError!.line).toBe(3);
    });

    it("captures syntax error with location", () => {
      const scss = `.test {
  color: red
  background: blue;
}`;
      const result = compileScssToCSS(scss, "syntax.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.line).toBeGreaterThan(0);
    });

    it("captures mixin error with location", () => {
      const scss = `@include undefined-mixin();`;
      const result = compileScssToCSS(scss, "mixin.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      expect(result.compileError!.message).toContain("mixin");
      expect(result.compileError!.line).toBe(1);
    });

    it("error message does not include location prefix (clean message)", () => {
      const result = compileScssToCSS("$x: $undefined;", "test.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();
      // sassMessage should be cleaner than fullMessage
      expect(result.compileError!.message.length).toBeLessThanOrEqual(
        result.compileError!.fullMessage.length
      );
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

  describe("parseSassException", () => {
    it("parses regular Error to ScssCompileError", () => {
      const error = new Error("Something went wrong");
      const result = parseSassException(error, "fallback.scss");

      expect(result.message).toBe("Something went wrong");
      expect(result.fullMessage).toBe("Something went wrong");
      expect(result.file).toBe("fallback.scss");
      expect(result.stack).toBeTruthy();
    });

    it("parses string error", () => {
      const result = parseSassException("Simple error string", "test.scss");

      expect(result.message).toBe("Simple error string");
      expect(result.file).toBe("test.scss");
    });

    it("uses default file when provided", () => {
      const result = parseSassException(new Error("test"), "default.scss");
      expect(result.file).toBe("default.scss");
    });

    it("extracts location from actual sass compilation error", () => {
      // Trigger a real sass error to test extraction
      const sassResult = compileScssToCSS("$x: $undefined;", "real.scss");
      expect(sassResult.compileError).not.toBeNull();
      expect(sassResult.compileError!.line).toBe(1);
      expect(sassResult.compileError!.column).toBeGreaterThan(0);
    });
  });

  describe("formatScssError", () => {
    it("formats error with file and line", () => {
      const error: ScssCompileError = {
        message: "Undefined variable",
        fullMessage: "Error: Undefined variable",
        file: "theme.scss",
        line: 42,
        column: 10,
        stack: null,
      };

      const formatted = formatScssError(error);

      expect(formatted).toContain("[SCSS Error]");
      expect(formatted).toContain("theme.scss");
      expect(formatted).toContain("42");
      expect(formatted).toContain("10");
      expect(formatted).toContain("Undefined variable");
    });

    it("formats error without column", () => {
      const error: ScssCompileError = {
        message: "Syntax error",
        fullMessage: "Error: Syntax error",
        file: "broken.scss",
        line: 15,
        column: null,
        stack: null,
      };

      const formatted = formatScssError(error);

      expect(formatted).toContain("broken.scss:15");
      expect(formatted).not.toContain(":15:");
    });

    it("formats error without line", () => {
      const error: ScssCompileError = {
        message: "Unknown error",
        fullMessage: "Error: Unknown error",
        file: "file.scss",
        line: null,
        column: null,
        stack: null,
      };

      const formatted = formatScssError(error);

      expect(formatted).toContain("file.scss");
      expect(formatted).toContain("Unknown error");
    });

    it("handles null file", () => {
      const error: ScssCompileError = {
        message: "Error message",
        fullMessage: "Error: Error message",
        file: null,
        line: null,
        column: null,
        stack: null,
      };

      const formatted = formatScssError(error);

      expect(formatted).toContain("unknown");
      expect(formatted).toContain("Error message");
    });
  });

  describe("verification: captures dart-sass errors with file path, line, column, message", () => {
    it("captures all error components from dart-sass", () => {
      const scss = `// Line 1: comment
// Line 2: another comment
.selector {
  color: $nonexistent-variable;
}`;
      const result = compileScssToCSS(scss, "verification.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();

      const err = result.compileError!;

      // File path captured
      expect(err.file).toBeTruthy();

      // Line number captured (should be line 4 where the error is)
      expect(err.line).toBe(4);

      // Column number captured
      expect(err.column).toBeGreaterThan(0);

      // Message captured
      expect(err.message).toBeTruthy();
      expect(err.message.toLowerCase()).toContain("undefined");
    });

    it("provides both clean message and full message", () => {
      const result = compileScssToCSS("$x: $y;", "test.scss");

      expect(result.success).toBe(false);
      expect(result.compileError).not.toBeNull();

      // message should be the clean error without location cruft
      expect(result.compileError!.message).toBeTruthy();

      // fullMessage includes location context
      expect(result.compileError!.fullMessage).toBeTruthy();

      // fullMessage should be >= message length (includes more context)
      expect(result.compileError!.fullMessage.length).toBeGreaterThanOrEqual(
        result.compileError!.message.length
      );
    });
  });
});
