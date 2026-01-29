/**
 * useMonacoBinding Hook Template Generator
 *
 * Generates a React hook for connecting Monaco Editor to Yjs.
 */

/**
 * Options for useMonacoBinding hook template generation.
 */
export interface UseMonacoBindingTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Whether to include awareness support */
  includeAwareness: boolean;
  /** Whether to include undo manager */
  includeUndoManager: boolean;
}

/**
 * Default options for useMonacoBinding template.
 */
const DEFAULT_OPTIONS: UseMonacoBindingTemplateOptions = {
  useTypeScript: true,
  includeAwareness: true,
  includeUndoManager: true,
};

/**
 * Generates the imports section.
 *
 * @param options - Template options
 * @returns Import statements string
 */
function generateImports(options: UseMonacoBindingTemplateOptions): string {
  const imports: string[] = [
    `'use client';`,
    ``,
    `import { useEffect, useRef, useCallback } from 'react';`,
    `import { MonacoBinding } from 'y-monaco';`,
  ];

  if (options.useTypeScript) {
    imports.push(`import type * as Monaco from 'monaco-editor';`);
    imports.push(`import type * as Y from 'yjs';`);
  }

  if (options.includeAwareness && options.useTypeScript) {
    imports.push(`import type { Awareness } from 'y-protocols/awareness';`);
  }

  if (options.includeUndoManager) {
    imports.push(`import * as Y from 'yjs';`);
  }

  return imports.join('\n');
}

/**
 * Generates the types.
 *
 * @param options - Template options
 * @returns Types string
 */
function generateTypes(options: UseMonacoBindingTemplateOptions): string {
  if (!options.useTypeScript) {
    return '';
  }

  let types = `
/**
 * Options for useMonacoBinding hook.
 */
export interface UseMonacoBindingOptions {
  /** Y.Text instance to bind */
  yText: Y.Text | null;
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
`;

  if (options.includeAwareness) {
    types += `  /** Awareness instance for cursor sync */
  awareness?: Awareness | null;
`;
  }

  types += `  /** Whether binding is enabled */
  enabled?: boolean;
}

/**
 * Return type for useMonacoBinding hook.
 */
export interface UseMonacoBindingResult {
  /** Whether the binding is active */
  isBound: boolean;
`;

  if (options.includeUndoManager) {
    types += `  /** Undo the last change */
  undo: () => void;
  /** Redo the last undone change */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
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
function generateHookImplementation(options: UseMonacoBindingTemplateOptions): string {
  const returnType = options.useTypeScript ? ': UseMonacoBindingResult' : '';
  const optionsType = options.useTypeScript ? ': UseMonacoBindingOptions' : '';

  let implementation = `
/**
 * Hook for binding Monaco Editor to a Y.Text document.
 *
 * Handles the lifecycle of MonacoBinding, including creation,
 * destruction, and rebinding when dependencies change.
 *
 * @param options - Binding options
 * @returns UseMonacoBindingResult
 */
export function useMonacoBinding({
  yText,
  editor,
`;

  if (options.includeAwareness) {
    implementation += `  awareness,
`;
  }

  implementation += `  enabled = true,
}${optionsType})${returnType} {
  const bindingRef = useRef${options.useTypeScript ? '<MonacoBinding | null>' : ''}(null);
`;

  if (options.includeUndoManager) {
    implementation += `  const undoManagerRef = useRef${options.useTypeScript ? '<Y.UndoManager | null>' : ''}(null);
`;
  }

  implementation += `  const isBoundRef = useRef(false);

  // Create and manage binding
  useEffect(() => {
    // Clean up existing binding
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
      isBoundRef.current = false;
    }

`;

  if (options.includeUndoManager) {
    implementation += `    // Clean up existing undo manager
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
      undoManagerRef.current = null;
    }

`;
  }

  implementation += `    // Don't create binding if disabled or missing dependencies
    if (!enabled || !yText || !editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    try {
      // Create new binding
      bindingRef.current = new MonacoBinding(
        yText,
        model,
        new Set([editor])${options.includeAwareness ? `,
        awareness ?? undefined` : ''}
      );
      isBoundRef.current = true;

`;

  if (options.includeUndoManager) {
    implementation += `      // Create undo manager for this Y.Text
      const doc = yText.doc;
      if (doc) {
        undoManagerRef.current = new Y.UndoManager(yText, {
          // Track remote changes for proper undo/redo
          trackedOrigins: new Set([null]),
        });
      }
`;
  }

  implementation += `    } catch (error) {
      console.error('Failed to create MonacoBinding:', error);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
        isBoundRef.current = false;
      }
`;

  if (options.includeUndoManager) {
    implementation += `      if (undoManagerRef.current) {
        undoManagerRef.current.destroy();
        undoManagerRef.current = null;
      }
`;
  }

  implementation += `    };
  }, [yText, editor, ${options.includeAwareness ? 'awareness, ' : ''}enabled]);
`;

  if (options.includeUndoManager) {
    implementation += `
  // Undo callback
  const undo = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.undo();
    }
  }, []);

  // Redo callback
  const redo = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.redo();
    }
  }, []);
`;
  }

  implementation += `
  return {
    isBound: isBoundRef.current,
`;

  if (options.includeUndoManager) {
    implementation += `    undo,
    redo,
    canUndo: undoManagerRef.current?.canUndo() ?? false,
    canRedo: undoManagerRef.current?.canRedo() ?? false,
`;
  }

  implementation += `  };
}

export default useMonacoBinding;
`;

  return implementation;
}

/**
 * Generates a complete useMonacoBinding hook file.
 *
 * @param options - Template options (partial, merged with defaults)
 * @returns Complete hook file content
 */
export function generateUseMonacoBindingTemplate(
  options: Partial<UseMonacoBindingTemplateOptions> = {}
): string {
  const mergedOptions: UseMonacoBindingTemplateOptions = {
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
