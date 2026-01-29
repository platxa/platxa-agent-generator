import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  parseInlineMarkdown,
  groupListItems,
  renderInlineTokens,
  MARKDOWN_PATTERNS,
  HEADING_STYLES,
  type MarkdownToken,
} from "@/components/chat/StreamingMarkdown";

describe("StreamingMarkdown", () => {
  describe("markdown renders as it streams with GFM support (Feature #114)", () => {
    it("parses headers correctly", () => {
      // Feature #114: Supports headers
      const content = "# Heading 1\n## Heading 2\n### Heading 3";
      const tokens = parseMarkdown(content);

      const headings = tokens.filter((t) => t.type === "heading");
      expect(headings.length).toBe(3);
      expect(headings[0].level).toBe(1);
      expect(headings[0].content).toBe("Heading 1");
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
    });

    it("parses unordered lists correctly", () => {
      // Feature #114: Supports lists
      const content = "- Item 1\n- Item 2\n- Item 3";
      const tokens = parseMarkdown(content);

      const listItems = tokens.filter((t) => t.type === "list_item");
      expect(listItems.length).toBe(3);
      expect(listItems[0].content).toBe("Item 1");
      expect(listItems[1].content).toBe("Item 2");
    });

    it("parses ordered lists correctly", () => {
      // Feature #114: Supports lists
      const content = "1. First\n2. Second\n3. Third";
      const tokens = parseMarkdown(content);

      const listItems = tokens.filter((t) => t.type === "ordered_list_item");
      expect(listItems.length).toBe(3);
      expect(listItems[0].content).toBe("First");
    });

    it("parses fenced code blocks with language", () => {
      // Feature #114: Supports code blocks
      const content = "```javascript\nconst x = 1;\n```";
      const tokens = parseMarkdown(content);

      const codeBlock = tokens.find((t) => t.type === "code_block");
      expect(codeBlock).toBeDefined();
      expect(codeBlock?.language).toBe("javascript");
      expect(codeBlock?.content).toBe("const x = 1;");
    });

    it("parses inline code", () => {
      // Feature #114: Supports code
      const tokens = parseInlineMarkdown("Use `npm install` to install");

      const codeToken = tokens.find((t) => t.type === "code_inline");
      expect(codeToken).toBeDefined();
      expect(codeToken?.content).toBe("npm install");
    });

    it("parses links correctly", () => {
      // Feature #114: Supports links
      const tokens = parseInlineMarkdown("Visit [Google](https://google.com) now");

      const linkToken = tokens.find((t) => t.type === "link");
      expect(linkToken).toBeDefined();
      expect(linkToken?.content).toBe("Google");
      expect(linkToken?.href).toBe("https://google.com");
    });

    it("handles streaming content with incomplete code block", () => {
      // Feature #114: Markdown renders as it streams
      const content = "```python\ndef hello():";
      const tokens = parseMarkdown(content);

      // Should still parse the incomplete code block
      const codeBlock = tokens.find((t) => t.type === "code_block");
      expect(codeBlock).toBeDefined();
      expect(codeBlock?.language).toBe("python");
      expect(codeBlock?.content).toContain("def hello():");
    });
  });

  describe("MARKDOWN_PATTERNS", () => {
    it("matches h1-h6 headings", () => {
      expect("# H1".match(MARKDOWN_PATTERNS.heading)).toBeTruthy();
      expect("## H2".match(MARKDOWN_PATTERNS.heading)).toBeTruthy();
      expect("###### H6".match(MARKDOWN_PATTERNS.heading)).toBeTruthy();
      expect("####### H7".match(MARKDOWN_PATTERNS.heading)).toBeFalsy();
    });

    it("matches code block delimiters", () => {
      expect("```js".match(MARKDOWN_PATTERNS.codeBlockStart)).toBeTruthy();
      expect("```".match(MARKDOWN_PATTERNS.codeBlockStart)).toBeTruthy();
      expect("```".match(MARKDOWN_PATTERNS.codeBlockEnd)).toBeTruthy();
    });

    it("matches unordered list items", () => {
      expect("- item".match(MARKDOWN_PATTERNS.unorderedList)).toBeTruthy();
      expect("* item".match(MARKDOWN_PATTERNS.unorderedList)).toBeTruthy();
      expect("+ item".match(MARKDOWN_PATTERNS.unorderedList)).toBeTruthy();
    });

    it("matches ordered list items", () => {
      expect("1. first".match(MARKDOWN_PATTERNS.orderedList)).toBeTruthy();
      expect("10. tenth".match(MARKDOWN_PATTERNS.orderedList)).toBeTruthy();
    });
  });

  describe("parseInlineMarkdown", () => {
    it("parses bold with asterisks", () => {
      const tokens = parseInlineMarkdown("This is **bold** text");
      const bold = tokens.find((t) => t.type === "bold");
      expect(bold?.content).toBe("bold");
    });

    it("parses bold with underscores", () => {
      const tokens = parseInlineMarkdown("This is __bold__ text");
      const bold = tokens.find((t) => t.type === "bold");
      expect(bold?.content).toBe("bold");
    });

    it("parses italic with asterisks", () => {
      const tokens = parseInlineMarkdown("This is *italic* text");
      const italic = tokens.find((t) => t.type === "italic");
      expect(italic?.content).toBe("italic");
    });

    it("parses italic with underscores", () => {
      const tokens = parseInlineMarkdown("This is _italic_ text");
      const italic = tokens.find((t) => t.type === "italic");
      expect(italic?.content).toBe("italic");
    });

    it("parses multiple inline elements", () => {
      const tokens = parseInlineMarkdown("**bold** and *italic* and `code`");

      expect(tokens.find((t) => t.type === "bold")).toBeDefined();
      expect(tokens.find((t) => t.type === "italic")).toBeDefined();
      expect(tokens.find((t) => t.type === "code_inline")).toBeDefined();
    });

    it("handles plain text", () => {
      const tokens = parseInlineMarkdown("Just plain text");
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe("text");
      expect(tokens[0].content).toBe("Just plain text");
    });
  });

  describe("parseMarkdown", () => {
    it("parses paragraphs", () => {
      const tokens = parseMarkdown("First paragraph\n\nSecond paragraph");

      const paragraphs = tokens.filter((t) => t.type === "paragraph");
      expect(paragraphs.length).toBe(2);
    });

    it("handles empty lines as newlines", () => {
      const tokens = parseMarkdown("Line 1\n\nLine 2");

      const newlines = tokens.filter((t) => t.type === "newline");
      expect(newlines.length).toBe(1);
    });

    it("parses multiline code blocks", () => {
      const content = "```typescript\nconst a = 1;\nconst b = 2;\n```";
      const tokens = parseMarkdown(content);

      const codeBlock = tokens.find((t) => t.type === "code_block");
      expect(codeBlock?.content).toContain("const a = 1;");
      expect(codeBlock?.content).toContain("const b = 2;");
    });

    it("parses headings with inline elements", () => {
      const tokens = parseMarkdown("# Title with **bold**");

      const heading = tokens.find((t) => t.type === "heading");
      expect(heading?.children).toBeDefined();
      expect(heading?.children?.some((c) => c.type === "bold")).toBe(true);
    });

    it("parses list items with inline elements", () => {
      const tokens = parseMarkdown("- Item with `code`");

      const listItem = tokens.find((t) => t.type === "list_item");
      expect(listItem?.children).toBeDefined();
      expect(listItem?.children?.some((c) => c.type === "code_inline")).toBe(true);
    });
  });

  describe("groupListItems", () => {
    it("groups consecutive unordered list items", () => {
      const tokens: MarkdownToken[] = [
        { type: "list_item", content: "A" },
        { type: "list_item", content: "B" },
        { type: "paragraph", content: "Text" },
      ];

      const grouped = groupListItems(tokens);

      expect(grouped.length).toBe(2);
      expect(grouped[0].type).toBe("list_item");
      expect(grouped[0].children?.length).toBe(2);
    });

    it("groups consecutive ordered list items", () => {
      const tokens: MarkdownToken[] = [
        { type: "ordered_list_item", content: "First" },
        { type: "ordered_list_item", content: "Second" },
      ];

      const grouped = groupListItems(tokens);

      expect(grouped.length).toBe(1);
      expect(grouped[0].type).toBe("ordered_list_item");
      expect(grouped[0].children?.length).toBe(2);
    });

    it("keeps different list types separate", () => {
      const tokens: MarkdownToken[] = [
        { type: "list_item", content: "Unordered" },
        { type: "ordered_list_item", content: "Ordered" },
      ];

      const grouped = groupListItems(tokens);

      expect(grouped.length).toBe(2);
      expect(grouped[0].type).toBe("list_item");
      expect(grouped[1].type).toBe("ordered_list_item");
    });
  });

  describe("HEADING_STYLES", () => {
    it("provides styles for all heading levels", () => {
      expect(HEADING_STYLES[1]).toContain("text-2xl");
      expect(HEADING_STYLES[2]).toContain("text-xl");
      expect(HEADING_STYLES[3]).toContain("text-lg");
      expect(HEADING_STYLES[4]).toContain("text-base");
      expect(HEADING_STYLES[5]).toContain("text-sm");
      expect(HEADING_STYLES[6]).toContain("text-sm");
    });

    it("h1 is the largest", () => {
      expect(HEADING_STYLES[1]).toContain("font-bold");
    });
  });

  describe("complex markdown documents", () => {
    it("parses mixed content correctly", () => {
      const content = `# Welcome

This is a **paragraph** with *emphasis*.

## Code Example

\`\`\`javascript
const hello = "world";
\`\`\`

### List

- First item
- Second with \`code\`
- Third with [link](http://example.com)

1. Ordered one
2. Ordered two`;

      const tokens = parseMarkdown(content);
      const grouped = groupListItems(tokens);

      // Should have headings
      const headings = tokens.filter((t) => t.type === "heading");
      expect(headings.length).toBe(3);

      // Should have code block
      const codeBlock = tokens.find((t) => t.type === "code_block");
      expect(codeBlock).toBeDefined();

      // Should have list items that get grouped
      const unorderedList = grouped.find(
        (t) => t.type === "list_item" && t.children && t.children.length > 1
      );
      expect(unorderedList).toBeDefined();
    });
  });
});
