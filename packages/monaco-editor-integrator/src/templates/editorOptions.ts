/**
 * Editor Options Template Generator
 *
 * Generates Monaco Editor configuration with production-ready defaults.
 */

/**
 * Options for editor options template generation.
 */
export interface EditorOptionsTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Include accessibility options */
  includeAccessibility: boolean;
  /** Include performance options */
  includePerformance: boolean;
  /** Default font family */
  fontFamily: string;
  /** Default font size */
  fontSize: number;
}

/**
 * Default options for editor options template.
 */
const DEFAULT_OPTIONS: EditorOptionsTemplateOptions = {
  useTypeScript: true,
  includeAccessibility: true,
  includePerformance: true,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
};

/**
 * Generates editor options configuration file.
 *
 * @param options - Template options
 * @returns Complete editor options file content
 */
export function generateEditorOptionsTemplate(
  options: Partial<EditorOptionsTemplateOptions> = {}
): string {
  const mergedOptions: EditorOptionsTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotation = mergedOptions.useTypeScript
    ? `: import('monaco-editor').editor.IStandaloneEditorConstructionOptions`
    : '';

  let content = `/**
 * Monaco Editor Configuration
 *
 * Production-ready editor options with accessibility and performance optimizations.
 */

/**
 * Default editor options for Monaco Editor.
 *
 * These options are optimized for:
 * - Code readability with modern fonts and ligatures
 * - Accessibility compliance (WCAG 2.1)
 * - Performance in large files
 * - Collaborative editing with Yjs
 */
export const defaultEditorOptions${typeAnnotation} = {
  // Layout
  automaticLayout: true,
  scrollBeyondLastLine: false,
  padding: { top: 16, bottom: 16 },

  // Typography
  fontSize: ${mergedOptions.fontSize},
  fontFamily: ${JSON.stringify(mergedOptions.fontFamily)},
  fontLigatures: true,
  fontWeight: '400',
  lineHeight: 1.6,
  letterSpacing: 0,

  // Cursor
  cursorStyle: 'line' as const,
  cursorBlinking: 'smooth' as const,
  cursorSmoothCaretAnimation: 'on' as const,
  cursorWidth: 2,

  // Scrolling
  smoothScrolling: true,
  mouseWheelScrollSensitivity: 1,
  fastScrollSensitivity: 5,

  // Minimap
  minimap: {
    enabled: false,
    renderCharacters: false,
    maxColumn: 80,
    scale: 1,
  },

  // Word wrap
  wordWrap: 'off' as const,
  wordWrapColumn: 80,
  wrappingIndent: 'same' as const,

  // Line numbers
  lineNumbers: 'on' as const,
  lineNumbersMinChars: 4,
  glyphMargin: true,
  folding: true,
  foldingStrategy: 'indentation' as const,

  // Brackets
  bracketPairColorization: { enabled: true },
  matchBrackets: 'always' as const,
  autoClosingBrackets: 'languageDefined' as const,
  autoClosingQuotes: 'languageDefined' as const,
  autoSurround: 'languageDefined' as const,

  // Indentation
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  trimAutoWhitespace: true,

  // Suggestions
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true,
  },
  acceptSuggestionOnEnter: 'smart' as const,
  suggestOnTriggerCharacters: true,
  snippetSuggestions: 'inline' as const,
`;

  if (mergedOptions.includeAccessibility) {
    content += `
  // Accessibility
  accessibilitySupport: 'auto' as const,
  accessibilityPageSize: 10,
  ariaLabel: 'Code editor',
  screenReaderAnnounceInlineSuggestion: true,
`;
  }

  if (mergedOptions.includePerformance) {
    content += `
  // Performance
  renderWhitespace: 'selection' as const,
  renderControlCharacters: false,
  renderLineHighlight: 'line' as const,
  renderValidationDecorations: 'on' as const,
  maxTokenizationLineLength: 20000,
  stopRenderingLineAfter: 10000,
  largeFileOptimizations: true,
`;
  }

  content += `};

/**
 * Read-only editor options.
 * Extends default options with read-only specific settings.
 */
export const readOnlyEditorOptions${typeAnnotation} = {
  ...defaultEditorOptions,
  readOnly: true,
  domReadOnly: true,
  cursorStyle: 'block' as const,
  cursorBlinking: 'solid' as const,
};

/**
 * Diff editor options.
 * Optimized for side-by-side diff viewing.
 */
export const diffEditorOptions${mergedOptions.useTypeScript ? `: import('monaco-editor').editor.IDiffEditorConstructionOptions` : ''} = {
  ...defaultEditorOptions,
  renderSideBySide: true,
  enableSplitViewResizing: true,
  ignoreTrimWhitespace: true,
  renderIndicators: true,
  originalEditable: false,
  diffWordWrap: 'off' as const,
};

/**
 * Compact editor options.
 * Minimal chrome for embedded or small editors.
 */
export const compactEditorOptions${typeAnnotation} = {
  ...defaultEditorOptions,
  minimap: { enabled: false },
  lineNumbers: 'off' as const,
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  padding: { top: 8, bottom: 8 },
};

export default defaultEditorOptions;
`;

  return content;
}
