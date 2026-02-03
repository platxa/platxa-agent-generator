"use client";

import { useRef, useCallback, useEffect } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "@/lib/stores";
import { getFileLanguage } from "@/lib/utils/file-icons";
import { MonacoCursorAdapter, createMonacoCursorAdapter } from "@/lib/collaboration/monaco-adapter";
import type { CollaboratorInfo } from "@/lib/collaboration";

interface CodeEditorProps {
  filePath: string;
  content: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  /** Remote collaborators for cursor display */
  collaborators?: CollaboratorInfo[];
  /** Callback when local cursor moves */
  onCursorChange?: (line: number, column: number) => void;
  /** Callback when local selection changes */
  onSelectionChange?: (
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ) => void;
  /** Callback when user is typing */
  onTyping?: () => void;
}

export function CodeEditor({
  filePath,
  content,
  onChange,
  readOnly = false,
  collaborators = [],
  onCursorChange,
  onSelectionChange,
  onTyping,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const cursorAdapterRef = useRef<MonacoCursorAdapter | null>(null);

  const {
    showMinimap,
    wordWrap,
    fontSize,
    setCursorPosition,
    setSelection,
    setFileContent,
    markTabModified,
  } = useEditorStore();

  const language = getFileLanguage(filePath);

  // Update remote cursors when collaborators change
  useEffect(() => {
    if (cursorAdapterRef.current && collaborators.length > 0) {
      cursorAdapterRef.current.updateFromCollaborators(collaborators, filePath);
    }
  }, [collaborators, filePath]);

  // Clean up cursor adapter on unmount or file change
  useEffect(() => {
    return () => {
      cursorAdapterRef.current?.clearAll();
    };
  }, [filePath]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Initialize cursor adapter for collaboration
    cursorAdapterRef.current = createMonacoCursorAdapter(editor, monaco, {
      showLabels: true,
      labelDuration: 3000,
      cursorAnimation: "pulse",
      selectionOpacity: 0.25,
    });

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: showMinimap },
      wordWrap: wordWrap ? "on" : "off",
      fontSize,
      lineNumbers: "on",
      renderLineHighlight: "all",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
    });

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      const { lineNumber, column } = e.position;
      setCursorPosition({ line: lineNumber, column });
      onCursorChange?.(lineNumber, column);
    });

    // Track selection
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      if (sel.isEmpty()) {
        setSelection(null);
      } else {
        setSelection({
          startLine: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLine: sel.endLineNumber,
          endColumn: sel.endColumn,
        });
        onSelectionChange?.(
          sel.startLineNumber,
          sel.startColumn,
          sel.endLineNumber,
          sel.endColumn
        );
      }
    });

    // Register custom themes
    monaco.editor.defineTheme("platxa-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
      ],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "editorLineNumber.foreground": "#858585",
        "editorCursor.foreground": "#aeafad",
        "editor.selectionBackground": "#264f78",
      },
    });

    monaco.editor.setTheme("platxa-dark");

    // Register Odoo-specific languages
    registerOdooLanguages(monaco);

    // Update cursors if collaborators already present
    if (collaborators.length > 0) {
      cursorAdapterRef.current?.updateFromCollaborators(collaborators, filePath);
    }
  };

  const handleChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined) {
        onChange?.(value);
        setFileContent(filePath, value);
        markTabModified(filePath, true);
        onTyping?.();
      }
    },
    [filePath, onChange, setFileContent, markTabModified, onTyping]
  );

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        language={language}
        value={content}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          readOnly,
          minimap: { enabled: showMinimap },
          wordWrap: wordWrap ? "on" : "off",
          fontSize,
        }}
        theme="platxa-dark"
        loading={
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">Loading editor...</span>
          </div>
        }
      />
    </div>
  );
}

/**
 * Register Odoo-specific language configurations
 */
function registerOdooLanguages(monaco: typeof import("monaco-editor")) {
  // QWeb XML language configuration
  monaco.languages.registerCompletionItemProvider("xml", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // QWeb directives
        { label: "t-if", insertText: 't-if="${1:condition}"', documentation: "Conditional rendering" },
        { label: "t-elif", insertText: 't-elif="${1:condition}"', documentation: "Else if condition" },
        { label: "t-else", insertText: "t-else", documentation: "Else branch" },
        { label: "t-foreach", insertText: 't-foreach="${1:items}" t-as="${2:item}"', documentation: "Loop over items" },
        { label: "t-set", insertText: 't-set="${1:name}" t-value="${2:value}"', documentation: "Set variable" },
        { label: "t-out", insertText: 't-out="${1:value}"', documentation: "Output escaped value" },
        { label: "t-raw", insertText: 't-raw="${1:value}"', documentation: "Output raw HTML" },
        { label: "t-call", insertText: 't-call="${1:template}"', documentation: "Call another template" },
        { label: "t-att", insertText: 't-att-${1:attr}="${2:value}"', documentation: "Dynamic attribute" },
        { label: "t-attf", insertText: 't-attf-${1:attr}="${2:value}"', documentation: "Formatted attribute" },
        // Odoo classes
        { label: "o_cc", insertText: "o_cc o_cc${1:1}", documentation: "Odoo color class" },
        { label: "o_default_snippet_text", insertText: "o_default_snippet_text", documentation: "Editable text" },
      ].map((item) => ({
        ...item,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));

      return { suggestions };
    },
  });
}
