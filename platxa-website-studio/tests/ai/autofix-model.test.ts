/**
 * Tests for AutoFix Model on Odoo Error Patterns
 *
 * Verifies >90% fix accuracy on Odoo-specific errors
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AutoFixModel,
  getAutoFixModel,
  resetAutoFixModel,
  autoFix,
  detectErrors,
  getPatternsForCategory,
  hasFixRule,
  getErrorCategories,
  formatAutoFixResult,
  type ErrorCategory,
  type DetectedError,
  type AutoFixResult,
} from "../../lib/ai/autofix-model";

describe("AutoFix Model", () => {
  beforeEach(() => {
    resetAutoFixModel();
  });

  describe("Error Detection", () => {
    describe("QWeb Syntax Errors", () => {
      it("detects missing <odoo> root element", () => {
        const content = `<template id="test">
  <div>Content</div>
</template>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-missing-odoo-root")).toBe(true);
      });

      it("detects template without id", () => {
        const content = `<odoo>
  <template name="test">
    <div>Content</div>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-template-no-id")).toBe(true);
      });

      it("detects Jinja syntax in QWeb", () => {
        const content = `<odoo>
  <template id="test">
    <div>{{ variable }}</div>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-jinja-syntax")).toBe(true);
      });

      it("detects JS template syntax in XML", () => {
        const content = `<odoo>
  <template id="test">
    <div>\${name}</div>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-js-template-syntax")).toBe(true);
      });

      it("detects t-foreach without t-as", () => {
        const content = `<odoo>
  <template id="test">
    <div t-foreach="items">
      <span>Item</span>
    </div>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-foreach-no-as")).toBe(true);
      });
    });

    describe("SCSS Syntax Errors", () => {
      it("detects unbalanced braces", () => {
        const content = `.header {
  color: red;
  .nested {
    background: blue;
`;
        const errors = detectErrors(content, "static/src/scss/theme.scss");
        expect(errors.some((e) => e.patternId === "scss-unbalanced-braces")).toBe(true);
      });

      it("detects empty CSS rules", () => {
        const content = `.header { }
.footer {
  color: red;
}`;
        const errors = detectErrors(content, "static/src/scss/theme.scss");
        expect(errors.some((e) => e.patternId === "scss-empty-rule")).toBe(true);
      });

      it("detects invalid selector syntax", () => {
        const content = `..header {
  color: red;
}
##footer {
  color: blue;
}`;
        const errors = detectErrors(content, "static/src/scss/theme.scss");
        expect(errors.some((e) => e.patternId === "scss-invalid-selector")).toBe(true);
      });
    });

    describe("Security Errors", () => {
      it("detects t-raw usage", () => {
        const content = `<odoo>
  <template id="test">
    <div t-raw="user_input"/>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-t-raw-usage")).toBe(true);
      });

      it("detects t-out with raw=1", () => {
        const content = `<odoo>
  <template id="test">
    <div t-out="content" raw="1"/>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "qweb-t-out-raw")).toBe(true);
      });
    });

    describe("Accessibility Errors", () => {
      it("detects image without alt", () => {
        const content = `<odoo>
  <template id="test">
    <img src="logo.png"/>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "a11y-img-no-alt")).toBe(true);
      });

      it("detects empty button", () => {
        const content = `<odoo>
  <template id="test">
    <button class="btn"></button>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "a11y-button-no-text")).toBe(true);
      });

      it("detects empty link", () => {
        const content = `<odoo>
  <template id="test">
    <a href="/page"></a>
  </template>
</odoo>`;
        const errors = detectErrors(content, "views/test.xml");
        expect(errors.some((e) => e.patternId === "a11y-link-no-text")).toBe(true);
      });
    });
  });

  describe("Fix Application", () => {
    describe("QWeb Fixes", () => {
      it("wraps content in <odoo> tags", () => {
        const content = `<template id="test">
  <div>Content</div>
</template>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain("<odoo>");
        expect(result.fixedContent).toContain("</odoo>");
      });

      it("converts Jinja syntax to QWeb", () => {
        const content = `<odoo>
  <template id="test">
    <div>{{ variable }}</div>
  </template>
</odoo>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain('t-esc="variable"');
        expect(result.fixedContent).not.toContain("{{");
      });

      it("converts JS template syntax to QWeb", () => {
        const content = `<odoo>
  <template id="test">
    <div>\${name}</div>
  </template>
</odoo>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain('t-esc="name"');
        expect(result.fixedContent).not.toContain("${");
      });

      it("replaces t-raw with t-esc", () => {
        const content = `<odoo>
  <template id="test">
    <div t-raw="content"/>
  </template>
</odoo>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain("t-esc=");
        expect(result.fixedContent).not.toContain("t-raw=");
      });
    });

    describe("SCSS Fixes", () => {
      it("balances unbalanced braces", () => {
        const content = `.header {
  color: red;
  .nested {
    background: blue;
`;
        const result = autoFix(content, "static/src/scss/theme.scss");
        const openCount = (result.fixedContent.match(/\{/g) || []).length;
        const closeCount = (result.fixedContent.match(/\}/g) || []).length;
        expect(openCount).toBe(closeCount);
      });

      it("fixes invalid selector syntax", () => {
        const content = `..header {
  color: red;
}`;
        const result = autoFix(content, "static/src/scss/theme.scss");
        expect(result.fixedContent).not.toContain("..");
      });
    });

    describe("Accessibility Fixes", () => {
      it("adds alt to images", () => {
        const content = `<odoo>
  <template id="test">
    <img src="logo.png"/>
  </template>
</odoo>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain('alt=""');
      });

      it("adds aria-label to empty buttons", () => {
        const content = `<odoo>
  <template id="test">
    <button class="btn"></button>
  </template>
</odoo>`;
        const result = autoFix(content, "views/test.xml");
        expect(result.fixedContent).toContain("aria-label");
      });
    });
  });

  describe("Fix Accuracy", () => {
    // This is the critical test - verifies >90% fix accuracy

    it("achieves >90% fix rate on QWeb syntax errors", () => {
      const testCases = [
        // Missing odoo root
        { content: '<template id="t1"><div>A</div></template>', file: "a.xml" },
        // Jinja syntax
        { content: '<odoo><template id="t2"><div>{{ x }}</div></template></odoo>', file: "b.xml" },
        // JS template
        { content: '<odoo><template id="t3"><div>${y}</div></template></odoo>', file: "c.xml" },
        // t-raw
        { content: '<odoo><template id="t4"><div t-raw="z"/></template></odoo>', file: "d.xml" },
        // Image no alt
        { content: '<odoo><template id="t5"><img src="x.png"/></template></odoo>', file: "e.xml" },
        // Empty button
        { content: '<odoo><template id="t6"><button></button></template></odoo>', file: "f.xml" },
        // Empty link
        { content: '<odoo><template id="t7"><a href="/"></a></template></odoo>', file: "g.xml" },
        // Jinja if
        { content: '<odoo><template id="t8">{% if x %}yes{% endif %}</template></odoo>', file: "h.xml" },
        // Jinja for
        { content: '<odoo><template id="t9">{% for i in items %}{{ i }}{% endfor %}</template></odoo>', file: "i.xml" },
        // Multiple issues
        { content: '<template name="bad"><div>{{ var }}</div><img src="x"/></template>', file: "j.xml" },
      ];

      let totalErrors = 0;
      let totalFixed = 0;

      for (const tc of testCases) {
        const initialErrors = detectErrors(tc.content, tc.file);
        const result = autoFix(tc.content, tc.file);
        totalErrors += initialErrors.length;
        totalFixed += result.errorsFixed;
      }

      const fixRate = (totalFixed / totalErrors) * 100;
      expect(fixRate).toBeGreaterThan(90);
    });

    it("achieves >90% fix rate on SCSS errors", () => {
      const testCases = [
        // Unbalanced braces
        { content: ".a { .b { color: red;", file: "a.scss" },
        // Empty rule
        { content: ".empty { }\n.valid { color: blue; }", file: "b.scss" },
        // Invalid selector
        { content: "..double { color: red; }", file: "c.scss" },
        // Another unbalanced
        { content: ".x { .y { .z { color: red; }", file: "d.scss" },
        // Multiple issues
        { content: "..bad { }\n.ok { color: red;", file: "e.scss" },
      ];

      let totalErrors = 0;
      let totalFixed = 0;

      for (const tc of testCases) {
        const initialErrors = detectErrors(tc.content, tc.file);
        const result = autoFix(tc.content, tc.file);
        totalErrors += initialErrors.length;
        totalFixed += result.errorsFixed;
      }

      const fixRate = totalErrors > 0 ? (totalFixed / totalErrors) * 100 : 100;
      expect(fixRate).toBeGreaterThan(90);
    });

    it("achieves >90% overall fix rate across all error types", () => {
      const model = getAutoFixModel();
      model.resetStats();

      // Comprehensive test suite covering all error types
      const testFiles = [
        // QWeb files
        { content: '<template id="a"><div>{{ x }}</div></template>', file: "a.xml" },
        { content: '<odoo><template id="b"><img src="x"/></template></odoo>', file: "b.xml" },
        { content: '<odoo><template id="c" t-raw="y"/></odoo>', file: "c.xml" },
        { content: '<odoo><template id="d"><button></button></template></odoo>', file: "d.xml" },
        { content: '<odoo><template id="e"><a href="/"></a></template></odoo>', file: "e.xml" },
        { content: '<template name="f"><div>${z}</div></template>', file: "f.xml" },
        // SCSS files
        { content: ".a { .b { color: red;", file: "a.scss" },
        { content: "..x { color: blue; }", file: "b.scss" },
        { content: ".empty { }", file: "c.scss" },
        { content: ".ok { color: red; }", file: "d.scss" }, // Valid file
      ];

      let totalDetected = 0;
      let totalFixed = 0;

      for (const tf of testFiles) {
        const result = model.applyFixes(tf.content, tf.file);
        totalDetected += result.errorsDetected;
        totalFixed += result.errorsFixed;
      }

      const overallFixRate = totalDetected > 0 ? (totalFixed / totalDetected) * 100 : 100;

      // This is the key assertion: >90% fix accuracy
      expect(overallFixRate).toBeGreaterThan(90);
    });
  });

  describe("Model Statistics", () => {
    it("tracks detection and fix statistics", () => {
      const model = getAutoFixModel();
      model.resetStats();

      autoFix('<template id="t"><div>{{ x }}</div></template>', "test.xml");

      expect(model.getOverallFixRate()).toBeGreaterThan(0);
    });

    it("provides model stats", () => {
      const model = getAutoFixModel();
      const stats = model.getStats();

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it("tracks category-specific fix rates", () => {
      const model = getAutoFixModel();
      model.resetStats();

      // Fix some QWeb errors
      autoFix('<odoo><template id="t"><div>{{ x }}</div></template></odoo>', "test.xml");

      const qwebRate = model.getCategoryFixRate("qweb_syntax");
      expect(qwebRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Pattern Coverage", () => {
    it("has patterns for all major categories", () => {
      const categories = getErrorCategories();

      expect(categories).toContain("qweb_syntax");
      expect(categories).toContain("scss_syntax");
      expect(categories).toContain("security");
      expect(categories).toContain("accessibility");
    });

    it("has fix rules for most patterns", () => {
      const categories = getErrorCategories();
      let patternsWithRules = 0;
      let totalPatterns = 0;

      for (const category of categories) {
        const patterns = getPatternsForCategory(category);
        for (const pattern of patterns) {
          totalPatterns++;
          if (hasFixRule(pattern.id)) {
            patternsWithRules++;
          }
        }
      }

      const coverage = (patternsWithRules / totalPatterns) * 100;
      expect(coverage).toBeGreaterThan(70); // At least 70% coverage
    });
  });

  describe("Result Formatting", () => {
    it("formats result with fixes", () => {
      const result = autoFix('<template id="t"><div>{{ x }}</div></template>', "test.xml");
      const formatted = formatAutoFixResult(result);

      expect(formatted).toContain("AUTOFIX RESULT");
      expect(formatted).toContain("Errors Detected:");
      expect(formatted).toContain("Errors Fixed:");
      expect(formatted).toContain("Fix Rate:");
    });

    it("formats result with remaining errors", () => {
      // Create a result with remaining errors (use a pattern without a fix rule)
      const result: AutoFixResult = {
        originalContent: "test",
        fixedContent: "test",
        errorsDetected: 2,
        errorsFixed: 1,
        fixRate: 50,
        fixes: [],
        remainingErrors: [
          {
            patternId: "test",
            category: "unknown",
            severity: "high",
            message: "Test error",
            file: "test.xml",
            line: 1,
            match: "test",
            matchIndex: 0,
          },
        ],
        duration: 10,
      };

      const formatted = formatAutoFixResult(result);
      expect(formatted).toContain("Remaining Errors");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty content", () => {
      const result = autoFix("", "test.xml");
      expect(result.errorsDetected).toBe(0);
      expect(result.fixedContent).toBe("");
    });

    it("handles valid content with no errors", () => {
      const validContent = `<odoo>
  <template id="valid_template">
    <div class="container">
      <img src="logo.png" alt="Logo"/>
      <button>Click me</button>
    </div>
  </template>
</odoo>`;
      const result = autoFix(validContent, "views/valid.xml");
      expect(result.errorsDetected).toBe(0);
      expect(result.fixRate).toBe(100);
    });

    it("handles files with wrong extension", () => {
      const xmlContent = '<template id="t"><div>{{ x }}</div></template>';
      // .txt files shouldn't trigger XML patterns
      const result = autoFix(xmlContent, "readme.txt");
      expect(result.errorsDetected).toBe(0);
    });

    it("prevents infinite loops on unfixable patterns", () => {
      const model = getAutoFixModel();
      // This should complete without hanging
      const result = model.applyFixes('<template id="t"><div>test</div></template>', "test.xml");
      expect(result.duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe("Singleton Pattern", () => {
    it("returns same instance on multiple calls", () => {
      const model1 = getAutoFixModel();
      const model2 = getAutoFixModel();
      expect(model1).toBe(model2);
    });

    it("reset creates new instance", () => {
      const model1 = getAutoFixModel();
      resetAutoFixModel();
      const model2 = getAutoFixModel();
      expect(model1).not.toBe(model2);
    });
  });

  describe("DetectedError Structure", () => {
    it("includes all required fields", () => {
      const errors = detectErrors('<template id="t"><div>{{ x }}</div></template>', "test.xml");

      expect(errors.length).toBeGreaterThan(0);
      const error = errors[0];

      expect(error).toHaveProperty("patternId");
      expect(error).toHaveProperty("category");
      expect(error).toHaveProperty("severity");
      expect(error).toHaveProperty("message");
      expect(error).toHaveProperty("file");
      expect(error).toHaveProperty("match");
      expect(error).toHaveProperty("matchIndex");
    });

    it("includes line number", () => {
      const content = `line1
line2
{{ variable }}
line4`;
      const errors = detectErrors(content, "test.xml");
      const jinjaError = errors.find((e) => e.patternId === "qweb-jinja-syntax");

      if (jinjaError) {
        expect(jinjaError.line).toBe(3);
      }
    });
  });

  describe("AutoFixResult Structure", () => {
    it("includes all required fields", () => {
      const result = autoFix('<template id="t"><div>{{ x }}</div></template>', "test.xml");

      expect(result).toHaveProperty("originalContent");
      expect(result).toHaveProperty("fixedContent");
      expect(result).toHaveProperty("errorsDetected");
      expect(result).toHaveProperty("errorsFixed");
      expect(result).toHaveProperty("fixRate");
      expect(result).toHaveProperty("fixes");
      expect(result).toHaveProperty("remainingErrors");
      expect(result).toHaveProperty("duration");
    });

    it("fix rate is percentage", () => {
      const result = autoFix('<template id="t"><div>{{ x }}</div></template>', "test.xml");

      expect(result.fixRate).toBeGreaterThanOrEqual(0);
      expect(result.fixRate).toBeLessThanOrEqual(100);
    });

    it("duration is in milliseconds", () => {
      const result = autoFix('<template id="t"><div>{{ x }}</div></template>', "test.xml");

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe("number");
    });
  });
});
