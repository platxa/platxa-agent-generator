'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  maxHeight?: string | number;
  theme?: 'light' | 'dark' | 'auto';
  onCopy?: (code: string) => void;
  className?: string;
}

export interface CopyButtonProps {
  text: string;
  onCopy?: (text: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'floating';
  showLabel?: boolean;
  className?: string;
}

export interface CopyFeedback {
  status: 'idle' | 'copied' | 'error';
  message?: string;
}

// ============================================================================
// Language Config
// ============================================================================

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'Markdown',
  markdown: 'Markdown',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
  vue: 'Vue',
  svelte: 'Svelte',
};

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: '#f7df1e',
  typescript: '#3178c6',
  python: '#3776ab',
  ruby: '#cc342d',
  go: '#00add8',
  rust: '#dea584',
  java: '#007396',
  html: '#e34c26',
  css: '#1572b6',
  scss: '#cf649a',
  json: '#292929',
  yaml: '#cb171e',
  shell: '#89e051',
  bash: '#89e051',
};

// ============================================================================
// Copy Button Component
// ============================================================================

export function CopyButton({
  text,
  onCopy,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className = '',
}: CopyButtonProps) {
  const [feedback, setFeedback] = useState<CopyFeedback>({ status: 'idle' });

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ status: 'copied', message: 'Copied!' });
      onCopy?.(text);

      setTimeout(() => {
        setFeedback({ status: 'idle' });
      }, 2000);
    } catch (error) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        setFeedback({ status: 'copied', message: 'Copied!' });
        onCopy?.(text);

        setTimeout(() => {
          setFeedback({ status: 'idle' });
        }, 2000);
      } catch {
        setFeedback({ status: 'error', message: 'Failed to copy' });
        setTimeout(() => {
          setFeedback({ status: 'idle' });
        }, 2000);
      }
    }
  }, [text, onCopy]);

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const variantClasses = {
    default: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md',
    minimal: 'hover:bg-gray-100 dark:hover:bg-gray-700 rounded',
    floating: 'bg-white dark:bg-gray-800 shadow-md rounded-lg hover:shadow-lg',
  };

  return (
    <button
      onClick={handleCopy}
      className={`copy-button inline-flex items-center gap-1.5 transition-all duration-200
        ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      title={feedback.status === 'copied' ? 'Copied!' : 'Copy to clipboard'}
      aria-label={feedback.status === 'copied' ? 'Copied!' : 'Copy to clipboard'}
    >
      {feedback.status === 'copied' ? (
        <CheckIcon size={iconSizes[size]} className="text-green-500" />
      ) : feedback.status === 'error' ? (
        <ErrorIcon size={iconSizes[size]} className="text-red-500" />
      ) : (
        <CopyIcon size={iconSizes[size]} className="text-gray-500 dark:text-gray-400" />
      )}

      {showLabel && (
        <span className={`text-xs font-medium ${
          feedback.status === 'copied' ? 'text-green-600' :
          feedback.status === 'error' ? 'text-red-600' :
          'text-gray-600 dark:text-gray-300'
        }`}>
          {feedback.status === 'copied' ? 'Copied!' :
           feedback.status === 'error' ? 'Error' : 'Copy'}
        </span>
      )}

      <style jsx>{`
        .copy-button:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
}

// ============================================================================
// Code Block Component
// ============================================================================

export function CodeBlockWithCopy({
  code,
  language,
  filename,
  showLineNumbers = false,
  highlightLines = [],
  maxHeight,
  theme = 'auto',
  onCopy,
  className = '',
}: CodeBlockProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);

  const languageLabel = language ? LANGUAGE_LABELS[language.toLowerCase()] || language : undefined;
  const languageColor = language ? LANGUAGE_COLORS[language.toLowerCase()] : undefined;

  // Check if content overflows
  useEffect(() => {
    if (codeRef.current && maxHeight) {
      const maxHeightPx = typeof maxHeight === 'number' ? maxHeight : parseInt(maxHeight);
      setShowExpandButton(codeRef.current.scrollHeight > maxHeightPx);
    }
  }, [code, maxHeight]);

  const lines = code.split('\n');

  const effectiveMaxHeight = isExpanded ? 'none' : maxHeight;

  return (
    <div
      className={`code-block-container rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}
      data-theme={theme}
    >
      {/* Header */}
      <div className="code-block-header flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {languageColor && (
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: languageColor }}
            />
          )}
          {filename ? (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filename}
            </span>
          ) : languageLabel ? (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {languageLabel}
            </span>
          ) : null}
        </div>

        <CopyButton
          text={code}
          onCopy={onCopy}
          size="sm"
          variant="minimal"
          showLabel
        />
      </div>

      {/* Code Content */}
      <div
        className="code-block-content relative"
        style={{
          maxHeight: effectiveMaxHeight,
          overflow: isExpanded ? 'visible' : 'auto',
        }}
      >
        <pre
          ref={codeRef}
          className="p-4 m-0 overflow-x-auto bg-gray-50 dark:bg-gray-900 text-sm leading-relaxed"
        >
          <code className={language ? `language-${language}` : ''}>
            {showLineNumbers ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const isHighlighted = highlightLines.includes(lineNumber);

                    return (
                      <tr
                        key={index}
                        className={isHighlighted ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
                      >
                        <td className="select-none text-right pr-4 text-gray-400 dark:text-gray-600 w-10">
                          {lineNumber}
                        </td>
                        <td className="pl-4 whitespace-pre">
                          {line || ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>

        {/* Expand/Collapse Button */}
        {showExpandButton && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent flex items-end justify-center pb-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-shadow"
            >
              Show more ↓
            </button>
          </div>
        )}

        {isExpanded && showExpandButton && (
          <div className="flex justify-center py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            >
              Show less ↑
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .code-block-container {
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        }

        .code-block-container[data-theme="dark"] {
          --bg-primary: #1a1a2e;
          --bg-secondary: #16213e;
        }

        .code-block-container[data-theme="light"] {
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
        }

        pre {
          tab-size: 2;
        }

        code {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Inline Code with Copy
// ============================================================================

export interface InlineCodeProps {
  code: string;
  copyable?: boolean;
  className?: string;
}

export function InlineCodeWithCopy({
  code,
  copyable = true,
  className = '',
}: InlineCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [code]);

  return (
    <code
      className={`inline-code relative px-1.5 py-0.5 rounded text-sm font-mono
        bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200
        ${copyable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : ''}
        ${className}`}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? (copied ? 'Copied!' : 'Click to copy') : undefined}
    >
      {code}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap">
          Copied!
        </span>
      )}
    </code>
  );
}

// ============================================================================
// Hook for Processing AI Response Code Blocks
// ============================================================================

export interface ParsedCodeBlock {
  code: string;
  language?: string;
  filename?: string;
  startIndex: number;
  endIndex: number;
}

export function useCodeBlockParser(content: string): {
  blocks: ParsedCodeBlock[];
  renderContent: (
    renderCodeBlock: (block: ParsedCodeBlock, index: number) => React.ReactNode,
    renderText: (text: string, index: number) => React.ReactNode
  ) => React.ReactNode[];
} {
  const blocks: ParsedCodeBlock[] = [];

  // Match code blocks with optional language and filename
  // Supports: ```lang, ```lang:filename, ```filename.ext
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1];
    const filename = match[2];
    const code = match[3].trimEnd();

    blocks.push({
      code,
      language,
      filename,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  const renderContent = (
    renderCodeBlock: (block: ParsedCodeBlock, index: number) => React.ReactNode,
    renderText: (text: string, index: number) => React.ReactNode
  ): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    blocks.forEach((block, index) => {
      // Add text before the code block
      if (block.startIndex > lastIndex) {
        const text = content.slice(lastIndex, block.startIndex);
        if (text.trim()) {
          result.push(renderText(text, result.length));
        }
      }

      // Add the code block
      result.push(renderCodeBlock(block, index));
      lastIndex = block.endIndex;
    });

    // Add any remaining text after the last code block
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex);
      if (text.trim()) {
        result.push(renderText(text, result.length));
      }
    }

    return result;
  };

  return { blocks, renderContent };
}

// ============================================================================
// AI Response Renderer with Code Blocks
// ============================================================================

export interface AIResponseProps {
  content: string;
  onCodeCopy?: (code: string, language?: string) => void;
  showLineNumbers?: boolean;
  maxCodeHeight?: string | number;
  className?: string;
}

export function AIResponseWithCodeBlocks({
  content,
  onCodeCopy,
  showLineNumbers = false,
  maxCodeHeight = 400,
  className = '',
}: AIResponseProps) {
  const { renderContent } = useCodeBlockParser(content);

  return (
    <div className={`ai-response prose dark:prose-invert max-w-none ${className}`}>
      {renderContent(
        (block, index) => (
          <CodeBlockWithCopy
            key={`code-${index}`}
            code={block.code}
            language={block.language}
            filename={block.filename}
            showLineNumbers={showLineNumbers}
            maxHeight={maxCodeHeight}
            onCopy={(code) => onCodeCopy?.(code, block.language)}
            className="my-4"
          />
        ),
        (text, index) => (
          <div
            key={`text-${index}`}
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: processInlineCode(text) }}
          />
        )
      )}
    </div>
  );
}

// Process inline code (backticks)
function processInlineCode(text: string): string {
  return text.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded text-sm font-mono bg-gray-100 dark:bg-gray-800">$1</code>'
  );
}

// ============================================================================
// Icons
// ============================================================================

function CopyIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export default CodeBlockWithCopy;
