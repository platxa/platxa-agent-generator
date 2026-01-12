/**
 * useYjsDocument Hook Template Generator
 *
 * Generates a React hook for per-file Y.Doc and Y.Text management.
 */

/**
 * Options for useYjsDocument hook template generation.
 */
export interface UseYjsDocumentTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Whether to include content initialization */
  includeInitialization: boolean;
  /** Whether to track dirty state */
  trackDirtyState: boolean;
}

/**
 * Default options for useYjsDocument template.
 */
const DEFAULT_OPTIONS: UseYjsDocumentTemplateOptions = {
  useTypeScript: true,
  includeInitialization: true,
  trackDirtyState: true,
};

/**
 * Generates the imports section.
 *
 * @param options - Template options
 * @returns Import statements string
 */
function generateImports(_options: UseYjsDocumentTemplateOptions): string {
  const imports: string[] = [
    `'use client';`,
    ``,
    `import { useState, useEffect, useCallback, useMemo, useRef } from 'react';`,
    `import * as Y from 'yjs';`,
    `import { useYjsProvider } from './YjsProvider';`,
  ];

  return imports.join('\n');
}

/**
 * Generates the types.
 *
 * @param options - Template options
 * @returns Types string
 */
function generateTypes(options: UseYjsDocumentTemplateOptions): string {
  if (!options.useTypeScript) {
    return '';
  }

  let types = `
/**
 * Return type for useYjsDocument hook.
 */
export interface UseYjsDocumentResult {
  /** The Y.Text instance for this document */
  yText: Y.Text | null;
  /** Whether the document is ready for editing */
  isReady: boolean;
  /** Whether the document is currently syncing */
  isSyncing: boolean;
  /** Get the current text content */
  getText: () => string;
  /** Set the text content (replaces all content) */
  setText: (content: string) => void;
  /** Insert text at a position */
  insertText: (index: number, content: string) => void;
  /** Delete text from a position */
  deleteText: (index: number, length: number) => void;
`;

  if (options.trackDirtyState) {
    types += `  /** Whether the document has unsaved changes */
  isDirty: boolean;
  /** Mark the document as saved */
  markSaved: () => void;
`;
  }

  types += `}
`;

  return types;
}

/**
 * Generates the hook implementation.
 *
 * @param options - Template options
 * @returns Hook implementation string
 */
function generateHookImplementation(options: UseYjsDocumentTemplateOptions): string {
  const returnType = options.useTypeScript ? ': UseYjsDocumentResult' : '';
  const docIdType = options.useTypeScript ? ': string' : '';
  const initialContentType = options.useTypeScript ? ': string' : '';

  let implementation = `
/**
 * Hook for managing a Y.Text document for a specific file.
 *
 * Creates or retrieves a Y.Text instance from the shared Y.Doc,
 * handling initialization and providing convenient methods for
 * text manipulation.
 *
 * @param documentId - Unique identifier for the document (e.g., file path)
 * @param initialContent - Initial content if document is new
 * @returns UseYjsDocumentResult
 */
export function useYjsDocument(
  documentId${docIdType},
  initialContent${initialContentType} = ''
)${returnType} {
  const { doc, isConnected } = useYjsProvider();
  const [yText, setYText] = useState${options.useTypeScript ? '<Y.Text | null>' : ''}(null);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
`;

  if (options.trackDirtyState) {
    implementation += `  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef${options.useTypeScript ? '<string>' : ''}('');
`;
  }

  implementation += `  const initializedRef = useRef${options.useTypeScript ? '<Set<string>>' : ''}(new Set());

  // Initialize Y.Text for this document
  useEffect(() => {
    if (!doc) {
      return;
    }

    // Get or create Y.Text for this document
    const text = doc.getText(documentId);
    setYText(text);
`;

  if (options.includeInitialization) {
    implementation += `
    // Initialize with content if this is a new document
    if (!initializedRef.current.has(documentId) && text.length === 0 && initialContent) {
      doc.transact(() => {
        text.insert(0, initialContent);
      });
      initializedRef.current.add(documentId);
`;

    if (options.trackDirtyState) {
      implementation += `      savedContentRef.current = initialContent;
`;
    }

    implementation += `    }
`;
  }

  if (options.trackDirtyState) {
    implementation += `
    // Track changes for dirty state
    const observer = () => {
      const currentContent = text.toString();
      setIsDirty(currentContent !== savedContentRef.current);
    };
    text.observe(observer);
`;
  }

  implementation += `
    setIsReady(true);

    return () => {
`;

  if (options.trackDirtyState) {
    implementation += `      text.unobserve(observer);
`;
  }

  implementation += `    };
  }, [doc, documentId, initialContent]);

  // Track syncing state
  useEffect(() => {
    setIsSyncing(!isConnected && isReady);
  }, [isConnected, isReady]);

  // Get current text content
  const getText = useCallback(()${options.useTypeScript ? ': string' : ''} => {
    return yText?.toString() ?? '';
  }, [yText]);

  // Set text content (replaces all)
  const setText = useCallback((content${options.useTypeScript ? ': string' : ''}) => {
    if (!yText || !doc) {
      return;
    }

    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, content);
    });
  }, [yText, doc]);

  // Insert text at position
  const insertText = useCallback((index${options.useTypeScript ? ': number' : ''}, content${options.useTypeScript ? ': string' : ''}) => {
    if (!yText) {
      return;
    }

    yText.insert(index, content);
  }, [yText]);

  // Delete text from position
  const deleteText = useCallback((index${options.useTypeScript ? ': number' : ''}, length${options.useTypeScript ? ': number' : ''}) => {
    if (!yText) {
      return;
    }

    yText.delete(index, length);
  }, [yText]);
`;

  if (options.trackDirtyState) {
    implementation += `
  // Mark document as saved
  const markSaved = useCallback(() => {
    savedContentRef.current = getText();
    setIsDirty(false);
  }, [getText]);
`;
  }

  implementation += `
  return useMemo(
    () => ({
      yText,
      isReady,
      isSyncing,
      getText,
      setText,
      insertText,
      deleteText,
`;

  if (options.trackDirtyState) {
    implementation += `      isDirty,
      markSaved,
`;
  }

  implementation += `    }),
    [yText, isReady, isSyncing, getText, setText, insertText, deleteText${options.trackDirtyState ? ', isDirty, markSaved' : ''}]
  );
}

export default useYjsDocument;
`;

  return implementation;
}

/**
 * Generates a complete useYjsDocument hook file.
 *
 * @param options - Template options (partial, merged with defaults)
 * @returns Complete hook file content
 */
export function generateUseYjsDocumentTemplate(
  options: Partial<UseYjsDocumentTemplateOptions> = {}
): string {
  const mergedOptions: UseYjsDocumentTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const imports = generateImports(mergedOptions);
  const types = generateTypes(mergedOptions);
  const implementation = generateHookImplementation(mergedOptions);

  return `${imports}
${types}
${implementation}
`;
}
