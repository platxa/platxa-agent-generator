import { describe, it, expect } from "vitest";
import {
  validateScss,
  validateScssBatch,
} from "@/lib/validators/scss-validator";

describe("SCSS Compilation Validator", () => {
  describe("validateScss", () => {
    it("validates correct SCSS", () => {
      const result = validateScss(`
        $primary: #7c3aed;
        .s_hero {
          background-color: $primary;
          h1 { font-size: 2rem; }
        }
      `);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.css).toBeTruthy();
      expect(result.css).toContain("background-color");
    });

    it("detects syntax errors with line numbers", () => {
      const result = validateScss(
        `.broken {
  color: red
  font-size: 16px;
}`,
        "theme.scss",
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe("theme.scss");
      expect(result.errors[0].line).toBeTypeOf("number");
      expect(result.errors[0].line).toBeGreaterThan(0);
      expect(result.errors[0].message).toBeTruthy();
    });

    it("reports context around error line", () => {
      const result = validateScss(
        `$color: #fff;
.valid { color: $color; }
.broken {
  color: red
  font-size: 16px;
}
.after { margin: 0; }`,
        "styles.scss",
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].context).toBeTruthy();
      expect(result.errors[0].context).toContain("|");
    });

    it("detects undefined variable errors", () => {
      const result = validateScss(`
        .test { color: $undefined-var; }
      `);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("$undefined-var");
    });

    it("compiles nested SCSS correctly", () => {
      const result = validateScss(`
        .s_features {
          padding: 2rem;
          .feature-card {
            border-radius: 8px;
            &:hover { transform: scale(1.02); }
          }
        }
      `);

      expect(result.valid).toBe(true);
      expect(result.css).toContain(".s_features .feature-card:hover");
    });

    it("compiles Odoo color variables pattern", () => {
      const result = validateScss(`
        $o-color-1: #7c3aed;
        $o-color-2: #6c757d;
        $o-color-3: #ec4899;
        $o-color-4: #f8f9fa;
        $o-color-5: #212529;

        .s_hero {
          background: $o-color-4;
          color: $o-color-5;
          .btn-primary { background: $o-color-1; }
        }
      `);

      expect(result.valid).toBe(true);
      expect(result.css).toContain("#7c3aed");
    });

    it("returns null css on failure", () => {
      const result = validateScss("{{invalid}}");
      expect(result.valid).toBe(false);
      expect(result.css).toBeNull();
    });
  });

  describe("validateScssBatch", () => {
    it("validates multiple files", () => {
      const result = validateScssBatch([
        { path: "variables.scss", content: "$primary: #7c3aed;" },
        { path: "hero.scss", content: ".s_hero { padding: 1rem; }" },
        { path: "footer.scss", content: ".footer { margin-top: 2rem; }" },
      ]);

      expect(result.allValid).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.totalErrors).toBe(0);
    });

    it("reports errors per file", () => {
      const result = validateScssBatch([
        { path: "good.scss", content: ".ok { color: red; }" },
        { path: "bad.scss", content: ".broken { color: red font-size: 1rem; }" },
      ]);

      expect(result.allValid).toBe(false);
      expect(result.totalErrors).toBe(1);
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(false);
      expect(result.results[1].errors[0].file).toBe("bad.scss");
    });

    it("handles empty file list", () => {
      const result = validateScssBatch([]);
      expect(result.allValid).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.totalErrors).toBe(0);
    });
  });
});
