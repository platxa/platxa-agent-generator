"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** Token types for markdown parsing */
export type MarkdownTokenType =
  | "heading"
  | "paragraph"
  | "code_block"
  | "code_inline"
  | "list_item"
  | "ordered_list_item"
  | "link"
  | "bold"
  | "italic"
  | "text"
  | "newline";

/** Parsed markdown token */
export interface MarkdownToken {
  type: MarkdownTokenType;
  content: string;
  level?: number; // For headings (1-6)
  language?: string; // For code blocks
  href?: string; // For links
  children?: MarkdownToken[];
}

/** Props for StreamingMarkdown component */
export interface StreamingMarkdownProps {
  /** The markdown content to render */
  content: string;
  /** Whether content is still streaming */
  isStreaming?: boolean;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Parsing Utilities
// =============================================================================

/** Regex patterns for markdown elements */
export const MARKDOWN_PATTERNS = {
  heading: /^(#{1,6})\s+(.+)$/,
  codeBlockStart: /^```(\w*)$/,
  codeBlockEnd: /^```$/,
  codeInline: /`([^`]+)`/g,
  unorderedList: /^[-*+]\s+(.+)$/,
  orderedList: /^\d+\.\s+(.+)$/,
  link: /\[([^\]]+)\]\(([^)]+)\)/g,
  bold: /\*\*([^*]+)\*\*/g,
  italic: /\*([^*]+)\*/g,
  boldAlt: /__([^_]+)__/g,
  italicAlt: /_([^_]+)_/g,
} as const;

/**
 * Parses inline markdown elements (bold, italic, code, links).
 */
export function parseInlineMarkdown(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = [];
  let remaining = text;
  let lastIndex = 0;

  // Combined pattern for all inline elements
  const inlinePattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;

  let match;
  while ((match = inlinePattern.exec(text)) !== null) {
    // Add preceding text
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const matched = match[0];

    // Determine token type
    if (matched.startsWith("`") && matched.endsWith("`")) {
      tokens.push({
        type: "code_inline",
        content: matched.slice(1, -1),
      });
    } else if (matched.startsWith("**") && matched.endsWith("**")) {
      tokens.push({
        type: "bold",
        content: matched.slice(2, -2),
      });
    } else if (matched.startsWith("__") && matched.endsWith("__")) {
      tokens.push({
        type: "bold",
        content: matched.slice(2, -2),
      });
    } else if (matched.startsWith("*") && matched.endsWith("*")) {
      tokens.push({
        type: "italic",
        content: matched.slice(1, -1),
      });
    } else if (matched.startsWith("_") && matched.endsWith("_")) {
      tokens.push({
        type: "italic",
        content: matched.slice(1, -1),
      });
    } else if (matched.startsWith("[")) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(matched);
      if (linkMatch) {
        tokens.push({
          type: "link",
          content: linkMatch[1],
          href: linkMatch[2],
        });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", content: text }];
}

/**
 * Parses markdown content into tokens.
 * Handles streaming content by parsing complete lines.
 */
export function parseMarkdown(content: string): MarkdownToken[] {
  const lines = content.split("\n");
  const tokens: MarkdownToken[] = [];
  let inCodeBlock = false;
  let codeBlockContent = "";
  let codeBlockLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (MARKDOWN_PATTERNS.codeBlockStart.test(line) && !inCodeBlock) {
      const match = line.match(MARKDOWN_PATTERNS.codeBlockStart);
      inCodeBlock = true;
      codeBlockLanguage = match?.[1] || "";
      codeBlockContent = "";
      continue;
    }

    if (MARKDOWN_PATTERNS.codeBlockEnd.test(line) && inCodeBlock) {
      tokens.push({
        type: "code_block",
        content: codeBlockContent,
        language: codeBlockLanguage,
      });
      inCodeBlock = false;
      codeBlockLanguage = "";
      codeBlockContent = "";
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? "\n" : "") + line;
      continue;
    }

    // Handle empty lines
    if (line.trim() === "") {
      tokens.push({ type: "newline", content: "" });
      continue;
    }

    // Handle headings
    const headingMatch = line.match(MARKDOWN_PATTERNS.heading);
    if (headingMatch) {
      tokens.push({
        type: "heading",
        content: headingMatch[2],
        level: headingMatch[1].length,
        children: parseInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    // Handle unordered lists
    const unorderedMatch = line.match(MARKDOWN_PATTERNS.unorderedList);
    if (unorderedMatch) {
      tokens.push({
        type: "list_item",
        content: unorderedMatch[1],
        children: parseInlineMarkdown(unorderedMatch[1]),
      });
      continue;
    }

    // Handle ordered lists
    const orderedMatch = line.match(MARKDOWN_PATTERNS.orderedList);
    if (orderedMatch) {
      tokens.push({
        type: "ordered_list_item",
        content: orderedMatch[1],
        children: parseInlineMarkdown(orderedMatch[1]),
      });
      continue;
    }

    // Handle paragraphs with inline elements
    tokens.push({
      type: "paragraph",
      content: line,
      children: parseInlineMarkdown(line),
    });
  }

  // Handle unclosed code block (streaming)
  if (inCodeBlock && codeBlockContent) {
    tokens.push({
      type: "code_block",
      content: codeBlockContent,
      language: codeBlockLanguage,
    });
  }

  return tokens;
}

/**
 * Groups consecutive list items into lists.
 */
export function groupListItems(tokens: MarkdownToken[]): MarkdownToken[] {
  const grouped: MarkdownToken[] = [];
  let currentList: MarkdownToken[] = [];
  let currentListType: "list_item" | "ordered_list_item" | null = null;

  for (const token of tokens) {
    if (token.type === "list_item" || token.type === "ordered_list_item") {
      if (currentListType === token.type) {
        currentList.push(token);
      } else {
        if (currentList.length > 0) {
          grouped.push({ type: currentListType!, content: "", children: currentList });
        }
        currentList = [token];
        currentListType = token.type;
      }
    } else {
      if (currentList.length > 0) {
        grouped.push({ type: currentListType!, content: "", children: currentList });
        currentList = [];
        currentListType = null;
      }
      grouped.push(token);
    }
  }

  if (currentList.length > 0) {
    grouped.push({ type: currentListType!, content: "", children: currentList });
  }

  return grouped;
}

// =============================================================================
// Rendering Utilities
// =============================================================================

/** Heading tag map */
const HEADING_TAGS = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

/** Heading styles */
export const HEADING_STYLES: Record<number, string> = {
  1: "text-2xl font-bold mt-6 mb-3",
  2: "text-xl font-semibold mt-5 mb-2",
  3: "text-lg font-semibold mt-4 mb-2",
  4: "text-base font-medium mt-3 mb-1",
  5: "text-sm font-medium mt-2 mb-1",
  6: "text-sm font-medium mt-2 mb-1",
};

/**
 * Renders inline tokens to React elements.
 */
export function renderInlineTokens(tokens: MarkdownToken[], key: string): React.ReactNode[] {
  return tokens.map((token, i) => {
    const tokenKey = `${key}-${i}`;
    switch (token.type) {
      case "code_inline":
        return (
          <code
            key={tokenKey}
            className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
          >
            {token.content}
          </code>
        );
      case "bold":
        return (
          <strong key={tokenKey} className="font-semibold">
            {token.content}
          </strong>
        );
      case "italic":
        return (
          <em key={tokenKey} className="italic">
            {token.content}
          </em>
        );
      case "link":
        return (
          <a
            key={tokenKey}
            href={token.href}
            className="text-primary underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {token.content}
          </a>
        );
      default:
        return <span key={tokenKey}>{token.content}</span>;
    }
  });
}

/**
 * Renders a single markdown token.
 */
export function renderToken(token: MarkdownToken, index: number): React.ReactNode {
  const key = `token-${index}`;

  switch (token.type) {
    case "heading": {
      const level = token.level || 1;
      const Tag = HEADING_TAGS[level as keyof typeof HEADING_TAGS] || "h1";
      return (
        <Tag key={key} className={HEADING_STYLES[level]}>
          {token.children ? renderInlineTokens(token.children, key) : token.content}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p key={key} className="mb-3 leading-relaxed">
          {token.children ? renderInlineTokens(token.children, key) : token.content}
        </p>
      );

    case "code_block":
      return (
        <div key={key} className="my-3 rounded-lg overflow-hidden border">
          {token.language && (
            <div className="px-4 py-1.5 bg-muted/50 border-b text-xs text-muted-foreground">
              {token.language}
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-sm font-mono bg-[#1e1e1e] text-[#d4d4d4]">
            <code>{token.content}</code>
          </pre>
        </div>
      );

    case "list_item":
      if (token.children && token.children[0]?.type === "list_item") {
        return (
          <ul key={key} className="mb-3 ml-4 list-disc list-outside space-y-1">
            {token.children.map((item, i) => (
              <li key={`${key}-item-${i}`} className="pl-1">
                {item.children ? renderInlineTokens(item.children, `${key}-item-${i}`) : item.content}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <li key={key} className="ml-4 list-disc pl-1">
          {token.children ? renderInlineTokens(token.children, key) : token.content}
        </li>
      );

    case "ordered_list_item":
      if (token.children && token.children[0]?.type === "ordered_list_item") {
        return (
          <ol key={key} className="mb-3 ml-4 list-decimal list-outside space-y-1">
            {token.children.map((item, i) => (
              <li key={`${key}-item-${i}`} className="pl-1">
                {item.children ? renderInlineTokens(item.children, `${key}-item-${i}`) : item.content}
              </li>
            ))}
          </ol>
        );
      }
      return (
        <li key={key} className="ml-4 list-decimal pl-1">
          {token.children ? renderInlineTokens(token.children, key) : token.content}
        </li>
      );

    case "newline":
      return <div key={key} className="h-2" />;

    default:
      return <span key={key}>{token.content}</span>;
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * StreamingMarkdown - Renders GitHub-flavored markdown with streaming support.
 *
 * Parses and renders markdown as it streams, supporting:
 * - Headers (h1-h6)
 * - Paragraphs
 * - Code blocks (fenced with language)
 * - Inline code
 * - Bold and italic
 * - Links
 * - Ordered and unordered lists
 *
 * @example
 * ```tsx
 * <StreamingMarkdown content={streamingContent} isStreaming={true} />
 * ```
 */
export function StreamingMarkdown({
  content,
  isStreaming = false,
  className,
}: StreamingMarkdownProps) {
  const tokens = useMemo(() => {
    const parsed = parseMarkdown(content);
    return groupListItems(parsed);
  }, [content]);

  return (
    <div
      className={cn(
        "streaming-markdown prose prose-sm dark:prose-invert max-w-none",
        isStreaming && "streaming",
        className
      )}
      data-streaming={isStreaming}
    >
      {tokens.map((token, index) => renderToken(token, index))}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
      )}
    </div>
  );
}

export default StreamingMarkdown;
