import { describe, it, expect } from "vitest";
import {
  normalizeLanguage,
  detectLanguage,
  tokenize,
  highlight,
  highlightToHtml,
  escapeHtml,
  getLanguageDisplayName,
  LANGUAGE_ALIASES,
  TOKEN_CLASSES,
  type SyntaxToken,
} from "@/lib/syntax-highlighter";

describe("SyntaxHighlighter", () => {
  describe("code blocks have language detection and appropriate highlighting (Feature #115)", () => {
    it("detects JavaScript from import/export syntax", () => {
      // Feature #115: Language detection
      const code = `import React from 'react';
export default function App() {}`;
      expect(detectLanguage(code)).toBe("javascript");
    });

    it("detects TypeScript from type annotations", () => {
      // Feature #115: Language detection
      const code = `interface User {
  name: string;
  age: number;
}`;
      expect(detectLanguage(code)).toBe("typescript");
    });

    it("highlights JavaScript keywords correctly", () => {
      // Feature #115: Appropriate highlighting
      const tokens = highlight("const x = 1;", "javascript");

      const constToken = tokens.find((t) => t.content === "const");
      expect(constToken?.type).toBe("keyword");
    });

    it("highlights strings correctly", () => {
      // Feature #115: Appropriate highlighting
      const tokens = highlight('const s = "hello";', "javascript");

      const stringToken = tokens.find((t) => t.content === '"hello"');
      expect(stringToken?.type).toBe("string");
    });

    it("highlights numbers correctly", () => {
      // Feature #115: Appropriate highlighting
      const tokens = highlight("const n = 42;", "javascript");

      const numberToken = tokens.find((t) => t.content === "42");
      expect(numberToken?.type).toBe("number");
    });

    it("highlights comments correctly", () => {
      // Feature #115: Appropriate highlighting
      const tokens = highlight("// comment\ncode", "javascript");

      const commentToken = tokens.find((t) => t.content === "// comment");
      expect(commentToken?.type).toBe("comment");
    });

    it("highlights function calls correctly", () => {
      // Feature #115: Appropriate highlighting
      const tokens = highlight("myFunction()", "javascript");

      const funcToken = tokens.find((t) => t.content === "myFunction");
      expect(funcToken?.type).toBe("function");
    });
  });

  describe("normalizeLanguage", () => {
    it("normalizes common aliases", () => {
      expect(normalizeLanguage("js")).toBe("javascript");
      expect(normalizeLanguage("ts")).toBe("typescript");
      expect(normalizeLanguage("py")).toBe("python");
      expect(normalizeLanguage("sh")).toBe("bash");
    });

    it("handles case insensitivity", () => {
      expect(normalizeLanguage("JavaScript")).toBe("javascript");
      expect(normalizeLanguage("PYTHON")).toBe("python");
    });

    it("returns plaintext for unknown languages", () => {
      expect(normalizeLanguage("unknown")).toBe("plaintext");
      expect(normalizeLanguage("")).toBe("plaintext");
    });

    it("passes through supported languages", () => {
      expect(normalizeLanguage("javascript")).toBe("javascript");
      expect(normalizeLanguage("typescript")).toBe("typescript");
      expect(normalizeLanguage("python")).toBe("python");
    });
  });

  describe("detectLanguage", () => {
    it("detects HTML from tags", () => {
      expect(detectLanguage("<html><body></body></html>")).toBe("html");
      expect(detectLanguage("<div class='test'>")).toBe("html");
    });

    it("detects JSON from object structure", () => {
      expect(detectLanguage('{"key": "value"}')).toBe("json");
    });

    it("detects SQL from keywords", () => {
      expect(detectLanguage("SELECT * FROM users WHERE id = 1")).toBe("sql");
      expect(detectLanguage("INSERT INTO users VALUES (1, 'test')")).toBe("sql");
    });

    it("detects Python from syntax", () => {
      expect(detectLanguage("def hello():\n    print('hi')")).toBe("python");
      expect(detectLanguage("import os\nfrom pathlib import Path")).toBe("python");
    });

    it("detects Go from package declaration", () => {
      expect(detectLanguage("package main\n\nimport (\n\t\"fmt\"\n)")).toBe("go");
    });

    it("detects Rust from keywords", () => {
      expect(detectLanguage("fn main() {\n    println!(\"Hello\");\n}")).toBe("rust");
      expect(detectLanguage("use std::io;\nmod utils;")).toBe("rust");
    });

    it("detects SCSS from variables", () => {
      expect(detectLanguage("$primary: #333;\n@mixin button {}")).toBe("scss");
    });

    it("detects CSS from selectors", () => {
      expect(detectLanguage(".class {\n  color: red;\n}")).toBe("css");
    });

    it("detects bash from shebang", () => {
      expect(detectLanguage("#!/bin/bash\necho hello")).toBe("bash");
    });

    it("returns plaintext for ambiguous code", () => {
      expect(detectLanguage("x = 1")).toBe("plaintext");
    });
  });

  describe("tokenize", () => {
    it("tokenizes JavaScript code", () => {
      const tokens = tokenize("const x = 1;", "javascript");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "const")).toBe(true);
      expect(tokens.some((t) => t.type === "number" && t.content === "1")).toBe(true);
    });

    it("tokenizes Python code", () => {
      const tokens = tokenize("def hello():\n    pass", "python");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "def")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "pass")).toBe(true);
    });

    it("tokenizes TypeScript with types", () => {
      const tokens = tokenize("const x: string = 'test';", "typescript");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "const")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "string")).toBe(true);
    });

    it("tokenizes SQL keywords case-insensitively", () => {
      const tokens = tokenize("SELECT id FROM users", "sql");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "SELECT")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "FROM")).toBe(true);
    });

    it("handles multi-line comments", () => {
      const tokens = tokenize("/* comment */\ncode", "javascript");

      expect(tokens.some((t) => t.type === "comment" && t.content === "/* comment */")).toBe(true);
    });

    it("handles single-line comments in Python", () => {
      const tokens = tokenize("# this is a comment\nx = 1", "python");

      expect(tokens.some((t) => t.type === "comment" && t.content === "# this is a comment")).toBe(true);
    });

    it("returns plain text for unknown language", () => {
      const tokens = tokenize("some code", "plaintext");

      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe("text");
    });
  });

  describe("highlight", () => {
    it("normalizes language before tokenizing", () => {
      const tokens = highlight("const x = 1;", "js");

      expect(tokens.some((t) => t.type === "keyword")).toBe(true);
    });

    it("handles empty code", () => {
      const tokens = highlight("", "javascript");

      expect(tokens.length).toBe(0);
    });
  });

  describe("highlightToHtml", () => {
    it("wraps tokens in span elements with classes", () => {
      const html = highlightToHtml("const x", "javascript");

      expect(html).toContain('<span class="');
      expect(html).toContain("const");
    });

    it("escapes HTML characters", () => {
      const html = highlightToHtml("x < y && y > z", "javascript");

      expect(html).toContain("&lt;");
      expect(html).toContain("&gt;");
      expect(html).toContain("&amp;");
    });

    it("applies correct CSS classes", () => {
      const html = highlightToHtml("const", "javascript");

      expect(html).toContain(TOKEN_CLASSES.keyword);
    });
  });

  describe("escapeHtml", () => {
    it("escapes all HTML special characters", () => {
      expect(escapeHtml("<")).toBe("&lt;");
      expect(escapeHtml(">")).toBe("&gt;");
      expect(escapeHtml("&")).toBe("&amp;");
      expect(escapeHtml('"')).toBe("&quot;");
      expect(escapeHtml("'")).toBe("&#039;");
    });

    it("escapes multiple characters", () => {
      expect(escapeHtml("<div class=\"test\">")).toBe("&lt;div class=&quot;test&quot;&gt;");
    });
  });

  describe("getLanguageDisplayName", () => {
    it("returns proper display names", () => {
      expect(getLanguageDisplayName("javascript")).toBe("JavaScript");
      expect(getLanguageDisplayName("typescript")).toBe("TypeScript");
      expect(getLanguageDisplayName("python")).toBe("Python");
      expect(getLanguageDisplayName("html")).toBe("HTML");
      expect(getLanguageDisplayName("css")).toBe("CSS");
    });

    it("handles aliases", () => {
      expect(getLanguageDisplayName("js")).toBe("JavaScript");
      expect(getLanguageDisplayName("ts")).toBe("TypeScript");
      expect(getLanguageDisplayName("py")).toBe("Python");
    });

    it("returns Plain Text for unknown", () => {
      expect(getLanguageDisplayName("unknown")).toBe("Plain Text");
    });
  });

  describe("LANGUAGE_ALIASES", () => {
    it("maps common file extensions", () => {
      expect(LANGUAGE_ALIASES.js).toBe("javascript");
      expect(LANGUAGE_ALIASES.jsx).toBe("javascript");
      expect(LANGUAGE_ALIASES.ts).toBe("typescript");
      expect(LANGUAGE_ALIASES.tsx).toBe("typescript");
      expect(LANGUAGE_ALIASES.py).toBe("python");
      expect(LANGUAGE_ALIASES.sh).toBe("bash");
      expect(LANGUAGE_ALIASES.rs).toBe("rust");
    });
  });

  describe("TOKEN_CLASSES", () => {
    it("provides CSS classes for all token types", () => {
      expect(TOKEN_CLASSES.keyword).toContain("text-");
      expect(TOKEN_CLASSES.string).toContain("text-");
      expect(TOKEN_CLASSES.number).toContain("text-");
      expect(TOKEN_CLASSES.comment).toContain("text-");
      expect(TOKEN_CLASSES.function).toContain("text-");
      expect(TOKEN_CLASSES.operator).toContain("text-");
      expect(TOKEN_CLASSES.type).toContain("text-");
    });

    it("comments have italic style", () => {
      expect(TOKEN_CLASSES.comment).toContain("italic");
    });
  });

  describe("complex code examples", () => {
    it("tokenizes a complete JavaScript function", () => {
      const code = `function greet(name) {
  // Say hello
  console.log("Hello, " + name);
  return true;
}`;
      const tokens = tokenize(code, "javascript");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "function")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "return")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "true")).toBe(false); // true is builtin
      expect(tokens.some((t) => t.type === "comment")).toBe(true);
      expect(tokens.some((t) => t.type === "string")).toBe(true);
      expect(tokens.some((t) => t.type === "function")).toBe(true);
    });

    it("tokenizes Python class definition", () => {
      const code = `class User:
    def __init__(self, name):
        self.name = name`;
      const tokens = tokenize(code, "python");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "class")).toBe(true);
      expect(tokens.some((t) => t.type === "keyword" && t.content === "def")).toBe(true);
      expect(tokens.some((t) => t.type === "variable" && t.content === "self")).toBe(true);
    });

    it("tokenizes Rust struct", () => {
      const code = `struct Point {
    x: f64,
    y: f64,
}`;
      const tokens = tokenize(code, "rust");

      expect(tokens.some((t) => t.type === "keyword" && t.content === "struct")).toBe(true);
      expect(tokens.some((t) => t.type === "type" && t.content === "f64")).toBe(true);
    });
  });
});
