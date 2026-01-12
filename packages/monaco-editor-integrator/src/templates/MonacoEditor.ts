/**
 * Monaco Editor Component Template Generator
 *
 * Generates a React component for Monaco Editor with Yjs integration.
 */

/**
 * Options for MonacoEditor component generation.
 */
export interface MonacoEditorTemplateOptions {
  /** Component name */
  componentName: string;
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Whether to include Yjs binding */
  includeYjsBinding: boolean;
  /** Whether to include awareness (cursor sync) */
  includeAwareness: boolean;
  /** Default language */
  defaultLanguage: string;
  /** Default theme */
  defaultTheme: string;
}

/**
 * Default options for MonacoEditor template.
 */
const DEFAULT_OPTIONS: MonacoEditorTemplateOptions = {
  componentName: 'MonacoEditor',
  useTypeScript: true,
  includeYjsBinding: true,
  includeAwareness: true,
  defaultLanguage: 'typescript',
  defaultTheme: 'vs-dark',
};

/**
 * Generates the imports section for the MonacoEditor component.
 *
 * @param options - Template options
 * @returns Import statements string
 */
function generateImports(options: MonacoEditorTemplateOptions): string {
  const imports: string[] = [
    `'use client';`,
    ``,
    `import { useRef, useEffect, useCallback } from 'react';`,
    `import Editor, { OnMount, OnChange } from '@monaco-editor/react';`,
  ];

  if (options.useTypeScript) {
    imports.push(`import type * as Monaco from 'monaco-editor';`);
  }

  if (options.includeYjsBinding) {
    imports.push(`import { MonacoBinding } from 'y-monaco';`);
    imports.push(`import { useYjsDocument } from './useYjsDocument';`);
  }

  if (options.includeAwareness) {
    imports.push(`import { useYjsProvider } from './YjsProvider';`);
  }

  return imports.join('\n');
}

/**
 * Generates the props interface for the MonacoEditor component.
 *
 * @param options - Template options
 * @returns Props interface string
 */
function generatePropsInterface(options: MonacoEditorTemplateOptions): string {
  if (!options.useTypeScript) {
    return '';
  }

  const props: string[] = [
    `  /** Unique identifier for the document */`,
    `  documentId: string;`,
    `  /** Initial content (only used if document is new) */`,
    `  initialContent?: string;`,
    `  /** Language for syntax highlighting */`,
    `  language?: string;`,
    `  /** Editor theme */`,
    `  theme?: string;`,
    `  /** Read-only mode */`,
    `  readOnly?: boolean;`,
    `  /** Called when content changes */`,
    `  onChange?: (value: string | undefined) => void;`,
    `  /** Called when editor is mounted */`,
    `  onMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;`,
    `  /** Additional editor options */`,
    `  options?: Monaco.editor.IStandaloneEditorConstructionOptions;`,
    `  /** CSS class name */`,
    `  className?: string;`,
    `  /** Editor height */`,
    `  height?: string | number;`,
  ];

  return `
export interface ${options.componentName}Props {
${props.join('\n')}
}
`;
}

/**
 * Generates the component body.
 *
 * @param options - Template options
 * @returns Component body string
 */
function generateComponentBody(options: MonacoEditorTemplateOptions): string {
  const propsType = options.useTypeScript ? `: ${options.componentName}Props` : '';
  const editorRefType = options.useTypeScript
    ? `<Monaco.editor.IStandaloneCodeEditor | null>`
    : '';
  const bindingRefType = options.useTypeScript ? `<MonacoBinding | null>` : '';

  let body = `
export function ${options.componentName}({
  documentId,
  initialContent = '',
  language = '${options.defaultLanguage}',
  theme = '${options.defaultTheme}',
  readOnly = false,
  onChange,
  onMount,
  options = {},
  className,
  height = '100%',
}${propsType}) {
  const editorRef = useRef${editorRefType}(null);
`;

  if (options.includeYjsBinding) {
    body += `  const bindingRef = useRef${bindingRefType}(null);
  const { yText, isReady } = useYjsDocument(documentId, initialContent);
`;
  }

  if (options.includeAwareness) {
    body += `  const { awareness } = useYjsProvider();
`;
  }

  // Handle editor mount
  body += `
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
`;

  if (options.includeYjsBinding) {
    body += `
    // Set up Yjs binding when document is ready
    if (isReady && yText) {
      const model = editor.getModel();
      if (model) {
        bindingRef.current = new MonacoBinding(
          yText,
          model,
          new Set([editor])${options.includeAwareness ? `,
          awareness` : ''}
        );
      }
    }
`;
  }

  body += `
    onMount?.(editor);
  }, [${options.includeYjsBinding ? 'isReady, yText, ' : ''}${options.includeAwareness ? 'awareness, ' : ''}onMount]);
`;

  // Cleanup effect
  if (options.includeYjsBinding) {
    body += `
  // Cleanup binding on unmount
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, []);

  // Update binding when document changes
  useEffect(() => {
    if (editorRef.current && isReady && yText && !bindingRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        bindingRef.current = new MonacoBinding(
          yText,
          model,
          new Set([editorRef.current])${options.includeAwareness ? `,
          awareness` : ''}
        );
      }
    }
  }, [isReady, yText${options.includeAwareness ? ', awareness' : ''}]);
`;
  }

  // onChange handler
  body += `
  const handleChange: OnChange = useCallback((value) => {
    onChange?.(value);
  }, [onChange]);
`;

  // Render
  body += `
  return (
    <div className={className} style={{ height }}>
      <Editor
        height="100%"
        language={language}
        theme={theme}
        onMount={handleEditorMount}
        onChange={handleChange}
        options={{
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineHeight: 1.6,
          padding: { top: 16, bottom: 16 },
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          ...options,
        }}
      />
    </div>
  );
}
`;

  return body;
}

/**
 * Generates a complete MonacoEditor component file.
 *
 * @param options - Template options (partial, merged with defaults)
 * @returns Complete component file content
 */
export function generateMonacoEditorTemplate(
  options: Partial<MonacoEditorTemplateOptions> = {}
): string {
  const mergedOptions: MonacoEditorTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const imports = generateImports(mergedOptions);
  const propsInterface = generatePropsInterface(mergedOptions);
  const componentBody = generateComponentBody(mergedOptions);

  return `${imports}
${propsInterface}
/**
 * Monaco Editor component with${mergedOptions.includeYjsBinding ? ' Yjs' : ''} collaborative editing support.
 *
 * Features:
 * - Syntax highlighting for ${mergedOptions.defaultLanguage}
 * - ${mergedOptions.defaultTheme} theme
${mergedOptions.includeYjsBinding ? ' * - Real-time collaborative editing via Yjs\n' : ''}${mergedOptions.includeAwareness ? ' * - Cursor and selection sync with other users\n' : ''} * - Automatic layout adjustment
 * - Keyboard shortcuts and accessibility support
 */
${componentBody}
export default ${mergedOptions.componentName};
`;
}

/**
 * Generates a minimal MonacoEditor component without Yjs.
 *
 * @param options - Template options (partial)
 * @returns Minimal component file content
 */
export function generateMinimalMonacoEditorTemplate(
  options: Partial<MonacoEditorTemplateOptions> = {}
): string {
  return generateMonacoEditorTemplate({
    ...options,
    includeYjsBinding: false,
    includeAwareness: false,
  });
}
