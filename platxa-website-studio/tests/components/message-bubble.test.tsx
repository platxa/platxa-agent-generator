import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Message } from "ai";
import React from "react";

/**
 * Tests for MessageBubble memoization (Fix 4: M13/M14)
 */

// Mock the FileList component to avoid complex dependency tree
vi.mock("@/components/chat/FileList", () => ({
  FileList: ({ files }: { files: unknown[] }) => (
    <div data-testid="file-list">{files.length} files</div>
  ),
}));

// Mock the parser to return predictable results
vi.mock("@/lib/ai/parser", () => ({
  parseGeneratedFiles: (content: string) => {
    if (content.includes("```")) {
      return [{ path: "test.xml", content: "<odoo/>", language: "xml", action: "create" }];
    }
    return [];
  },
  extractTextContent: (content: string) => {
    return content.replace(/```[\s\S]*?```/g, "").trim();
  },
}));

const makeMessage = (role: "user" | "assistant", content: string, id?: string): Message => ({
  id: id || `msg-${Date.now()}`,
  role,
  content,
  createdAt: new Date(),
});

describe("MessageBubble", () => {
  it("renders user message correctly", () => {
    const msg = makeMessage("user", "Create a restaurant website");
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Create a restaurant website")).toBeTruthy();
  });

  it("renders assistant message with text content", () => {
    const msg = makeMessage("assistant", "Here is your theme design");
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Here is your theme design")).toBeTruthy();
  });

  it("renders assistant message with files when code blocks present", () => {
    const msg = makeMessage("assistant", "Here is the code\n```xml\n<odoo/>\n```");
    render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("file-list")).toBeTruthy();
    expect(screen.getByText("Generated 1 file(s)")).toBeTruthy();
  });

  it("is wrapped in React.memo", () => {
    // React.memo wraps the component — check that it's a memo type
    // The $$typeof for memo is Symbol.for('react.memo')
    const memoSymbol = Symbol.for("react.memo");
    expect((MessageBubble as unknown as { $$typeof: symbol }).$$typeof).toBe(memoSymbol);
  });
});
