import { describe, it, expect } from "vitest";
import {
  QWebValidator,
  createQWebValidator,
  validateQWeb,
  formatQWebError,
  extractDirectiveType,
  type QWebValidationError,
  type QWebValidationResult,
} from "@/lib/preview/qweb-validation";

describe("QWebValidator", () => {
  describe("basic validation", () => {
    it("validates correct QWeb template", () => {
      const qweb = `
<template t-name="my.template">
  <div class="container">
    <span t-if="condition">Content</span>
  </div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("captures template names", () => {
      const qweb = `
<template t-name="first.template">
  <div>First</div>
</template>
<template t-name="second.template">
  <div>Second</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.templateNames).toContain("first.template");
      expect(result.templateNames).toContain("second.template");
    });

    it("tracks lines processed", () => {
      const qweb = "line 1\nline 2\nline 3\nline 4";
      const result = validateQWeb(qweb);

      expect(result.linesProcessed).toBe(4);
    });
  });

  describe("directive requirement errors", () => {
    it("detects t-foreach without t-as", () => {
      const qweb = `
<template t-name="test">
  <div t-foreach="items">Item</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe("MISSING_T_AS");
      expect(result.errors[0].directive).toBe("t-foreach");
    });

    it("detects t-as without t-foreach", () => {
      const qweb = `
<template t-name="test">
  <div t-as="item">Item</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MISSING_T_FOREACH")).toBe(true);
    });

    it("allows valid t-foreach with t-as", () => {
      const qweb = `
<template t-name="test">
  <div t-foreach="items" t-as="item">
    <span t-esc="item.name"/>
  </div>
</template>`;

      const result = validateQWeb(qweb);

      // Should not have t-foreach/t-as errors
      expect(
        result.errors.filter(
          (e) => e.code === "MISSING_T_AS" || e.code === "MISSING_T_FOREACH"
        )
      ).toHaveLength(0);
    });
  });

  describe("conditional chain errors", () => {
    it("detects orphan t-elif", () => {
      const qweb = `
<template t-name="test">
  <div t-elif="condition">Content</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ORPHAN_T_ELIF")).toBe(true);
      expect(result.errors[0].directive).toBe("t-elif");
    });

    it("detects orphan t-else", () => {
      const qweb = `
<template t-name="test">
  <div t-else="">Content</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ORPHAN_T_ELSE")).toBe(true);
    });

    it("allows valid t-if/t-elif/t-else chain", () => {
      const qweb = `
<template t-name="test">
  <div t-if="a">A</div>
  <div t-elif="b">B</div>
  <div t-else="">C</div>
</template>`;

      const result = validateQWeb(qweb);

      // Should not have orphan errors
      expect(
        result.errors.filter(
          (e) => e.code === "ORPHAN_T_ELIF" || e.code === "ORPHAN_T_ELSE"
        )
      ).toHaveLength(0);
    });
  });

  describe("invalid directive detection", () => {
    it("detects unknown directives", () => {
      const qweb = `
<template t-name="test">
  <div t-invalid="value">Content</div>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_DIRECTIVE")).toBe(
        true
      );
      expect(result.errors[0].message).toContain("t-invalid");
    });

    it("allows valid dynamic attribute directives", () => {
      const qweb = `
<template t-name="test">
  <div t-att-class="dynamic_class" t-attf-href="/page/#{id}">Content</div>
</template>`;

      const result = validateQWeb(qweb);

      // Should not flag t-att-* or t-attf-* as invalid
      expect(
        result.errors.filter((e) => e.code === "INVALID_DIRECTIVE")
      ).toHaveLength(0);
    });
  });

  describe("deprecated directive warnings", () => {
    it("warns about deprecated t-raw", () => {
      const qweb = `
<template t-name="test">
  <div t-raw="html_content"/>
</template>`;

      const result = validateQWeb(qweb, { checkDeprecated: true });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].directive).toBe("t-raw");
      expect(result.warnings[0].severity).toBe("warning");
    });

    it("can disable deprecated warnings", () => {
      const qweb = `
<template t-name="test">
  <div t-raw="html_content"/>
</template>`;

      const result = validateQWeb(qweb, { checkDeprecated: false });

      expect(result.warnings.filter((w) => w.directive === "t-raw")).toHaveLength(0);
    });
  });

  describe("tag matching errors", () => {
    it("detects mismatched closing tags", () => {
      const qweb = `
<template t-name="test">
  <div class="container">
    <span>Content</div>
  </span>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MISMATCHED_TAGS")).toBe(true);
    });

    it("detects unclosed elements", () => {
      const qweb = `
<template t-name="test">
  <div class="container">
    <span>Content
</template>`;

      const result = validateQWeb(qweb);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "UNCLOSED_ELEMENT")).toBe(true);
    });
  });

  describe("error location tracking", () => {
    it("captures correct line number", () => {
      const qweb = `<template t-name="test">
  <div>Line 2</div>
  <div t-foreach="items">Line 3</div>
</template>`;

      const result = validateQWeb(qweb);
      const error = result.errors.find((e) => e.code === "MISSING_T_AS");

      expect(error).toBeDefined();
      expect(error!.line).toBe(3);
    });

    it("captures column number", () => {
      const qweb = `<div t-foreach="items">Content</div>`;
      const result = validateQWeb(qweb);

      const error = result.errors[0];
      expect(error.column).toBeGreaterThan(0);
    });

    it("associates error with template name", () => {
      const qweb = `
<template t-name="my.widget">
  <div t-foreach="items">Error here</div>
</template>`;

      const result = validateQWeb(qweb);
      const error = result.errors[0];

      expect(error.templateName).toBe("my.widget");
    });

    it("includes file path in error", () => {
      const qweb = `<div t-foreach="items">Content</div>`;
      const result = validateQWeb(qweb, { file: "templates/widget.xml" });

      expect(result.errors[0].file).toBe("templates/widget.xml");
    });
  });

  describe("expression validation", () => {
    it("detects unbalanced parentheses when enabled", () => {
      const qweb = `
<template t-name="test">
  <span t-if="func(a, b">Content</span>
</template>`;

      const result = validateQWeb(qweb, { validateExpressions: true });

      expect(result.errors.some((e) => e.code === "INVALID_EXPRESSION")).toBe(
        true
      );
    });

    it("detects unbalanced brackets when enabled", () => {
      const qweb = `
<template t-name="test">
  <span t-if="items[0">Content</span>
</template>`;

      const result = validateQWeb(qweb, { validateExpressions: true });

      expect(result.errors.some((e) => e.code === "INVALID_EXPRESSION")).toBe(
        true
      );
    });

    it("skips expression validation by default", () => {
      const qweb = `
<template t-name="test">
  <span t-if="func(a, b">Content</span>
</template>`;

      const result = validateQWeb(qweb);

      expect(result.errors.filter((e) => e.code === "INVALID_EXPRESSION")).toHaveLength(0);
    });
  });
});

describe("createQWebValidator", () => {
  it("creates validator instance", () => {
    const validator = createQWebValidator();
    expect(validator).toBeInstanceOf(QWebValidator);
  });

  it("passes options through", () => {
    const validator = createQWebValidator({ file: "test.xml" });
    const result = validator.validate("<div t-foreach='x'>y</div>");

    expect(result.errors[0].file).toBe("test.xml");
  });
});

describe("validateQWeb", () => {
  it("performs quick validation", () => {
    const result = validateQWeb("<div>Valid</div>");
    expect(result.valid).toBe(true);
  });
});

describe("formatQWebError", () => {
  it("formats error with all fields", () => {
    const error: QWebValidationError = {
      message: "Missing t-as directive",
      templateName: "my.widget",
      line: 10,
      column: 5,
      directive: "t-foreach",
      directiveValue: 't-foreach="items"',
      elementTag: "div",
      severity: "error",
      code: "MISSING_T_AS",
      file: "widget.xml",
    };

    const formatted = formatQWebError(error);

    expect(formatted).toContain("[QWeb ERROR]");
    expect(formatted).toContain("widget.xml:10:5");
    expect(formatted).toContain("[my.widget]");
    expect(formatted).toContain("(t-foreach)");
    expect(formatted).toContain("Missing t-as directive");
  });

  it("formats warning correctly", () => {
    const warning: QWebValidationError = {
      message: "Deprecated directive",
      templateName: null,
      line: 5,
      column: null,
      directive: "t-raw",
      directiveValue: null,
      elementTag: null,
      severity: "warning",
      code: "INVALID_DIRECTIVE",
      file: null,
    };

    const formatted = formatQWebError(warning);

    expect(formatted).toContain("[QWeb WARNING]");
    expect(formatted).toContain("line 5");
  });

  it("handles null template name", () => {
    const error: QWebValidationError = {
      message: "Error",
      templateName: null,
      line: 1,
      column: 1,
      directive: null,
      directiveValue: null,
      elementTag: null,
      severity: "error",
      code: "UNKNOWN",
      file: "test.xml",
    };

    const formatted = formatQWebError(error);

    expect(formatted).not.toContain("[null]");
    expect(formatted).toContain("test.xml:1:1");
  });
});

describe("extractDirectiveType", () => {
  it("extracts standard directives", () => {
    expect(extractDirectiveType("t-if")).toBe("t-if");
    expect(extractDirectiveType("t-foreach")).toBe("t-foreach");
    expect(extractDirectiveType("t-esc")).toBe("t-esc");
  });

  it("normalizes dynamic attribute directives", () => {
    expect(extractDirectiveType("t-att-class")).toBe("t-att");
    expect(extractDirectiveType("t-att-data-id")).toBe("t-att");
    expect(extractDirectiveType("t-attf-href")).toBe("t-attf");
  });

  it("returns unknown for invalid directives", () => {
    expect(extractDirectiveType("t-invalid")).toBe("unknown");
    expect(extractDirectiveType("not-a-directive")).toBe("unknown");
  });
});

describe("verification: captures template name, line, directive type, error message", () => {
  it("captures all required fields from QWeb validation errors", () => {
    const qweb = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template t-name="website.custom_snippet">
    <section class="s_snippet">
      <div t-foreach="records">
        <span t-esc="record.name"/>
      </div>
    </section>
  </template>
</odoo>`;

    const result = validateQWeb(qweb, { file: "snippet.xml" });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors[0];

    // Template name captured
    expect(error.templateName).toBe("website.custom_snippet");

    // Line number captured
    expect(error.line).toBe(5);

    // Directive type captured
    expect(error.directive).toBe("t-foreach");

    // Error message captured
    expect(error.message).toBeTruthy();
    expect(error.message.toLowerCase()).toContain("t-as");

    // File captured
    expect(error.file).toBe("snippet.xml");

    // Error code captured
    expect(error.code).toBe("MISSING_T_AS");
  });

  it("captures multiple errors with correct context", () => {
    const qweb = `
<template t-name="test.template">
  <div t-elif="x">Orphan elif</div>
  <span t-foreach="items">No t-as</span>
  <div t-unknown="value">Unknown directive</div>
</template>`;

    const result = validateQWeb(qweb);

    expect(result.errors.length).toBeGreaterThanOrEqual(3);

    // Each error has the required fields
    for (const error of result.errors) {
      expect(error.line).toBeGreaterThan(0);
      expect(error.message).toBeTruthy();
      expect(error.code).toBeTruthy();
      // templateName should be "test.template" for errors after line 1
      if (error.line > 1) {
        expect(error.templateName).toBe("test.template");
      }
    }
  });
});
