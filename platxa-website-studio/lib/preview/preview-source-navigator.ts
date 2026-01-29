/**
 * Preview Source Navigator - Handles navigation from preview clicks to editor
 *
 * Feature #70: Implements editor highlight from preview selection.
 * When user clicks/double-clicks element in preview iframe, opens file
 * in editor and highlights relevant lines.
 *
 * @module preview/preview-source-navigator
 */

import { getSourceLocation, buildSourceMap, type QWebSourceMap, type SourceLocation } from './qweb-source-map';

// =============================================================================
// Types
// =============================================================================

/** Source navigation event from preview iframe */
export interface SourceNavigateEvent {
  /** Source file path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Source element ID (e.g., "src-0") */
  sourceId?: string;
}

/** Editor integration interface */
export interface EditorIntegration {
  /** Open a file in the editor */
  openFile(path: string): void;
  /** Set cursor position in the current file */
  setCursorPosition(line: number, column?: number): void;
  /** Highlight a range of lines */
  setSelection(startLine: number, endLine: number, startColumn?: number, endColumn?: number): void;
  /** Scroll to a specific line */
  revealLine(line: number): void;
}

/** Configuration for PreviewSourceNavigator */
export interface SourceNavigatorConfig {
  /** Editor integration for file/line navigation */
  editor?: EditorIntegration;
  /** Source map for looking up element locations */
  sourceMap?: QWebSourceMap;
  /** Whether to auto-scroll to line after navigation */
  autoReveal?: boolean;
  /** Callback when navigation occurs */
  onNavigate?: (location: NavigationResult) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/** Result of a navigation operation */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean;
  /** Source file path */
  path: string;
  /** Start line number */
  startLine: number;
  /** End line number */
  endLine: number;
  /** Source element ID if available */
  sourceId?: string;
  /** Error message if navigation failed */
  error?: string;
}

// =============================================================================
// Preview Source Navigator Class
// =============================================================================

/**
 * PreviewSourceNavigator - Handles preview-to-editor navigation
 *
 * Feature #70: Preview click opens file in editor and highlights relevant lines
 *
 * @example
 * ```typescript
 * const navigator = new PreviewSourceNavigator({
 *   editor: {
 *     openFile: (path) => editorStore.openTab({ path, name: path.split('/').pop()! }),
 *     setCursorPosition: (line) => editorStore.setCursorPosition({ line, column: 1 }),
 *     setSelection: (start, end) => editorStore.setSelection({ startLine: start, endLine: end }),
 *     revealLine: (line) => monaco.revealLineInCenter(line)
 *   }
 * });
 *
 * // Start listening for messages
 * navigator.listen();
 *
 * // Or handle navigation manually
 * navigator.navigateToSource({ file: 'template.xml', line: 10, sourceId: 'src-5' });
 * ```
 */
export class PreviewSourceNavigator {
  private config: Required<Omit<SourceNavigatorConfig, 'editor' | 'sourceMap' | 'onNavigate'>> & {
    editor?: EditorIntegration;
    sourceMap?: QWebSourceMap;
    onNavigate?: (location: NavigationResult) => void;
  };
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private isListening = false;

  constructor(config: SourceNavigatorConfig = {}) {
    this.config = {
      editor: config.editor,
      sourceMap: config.sourceMap,
      autoReveal: config.autoReveal ?? true,
      onNavigate: config.onNavigate,
      debug: config.debug ?? false,
    };
  }

  /**
   * Start listening for source navigation messages from iframe
   */
  listen(): () => void {
    if (this.isListening) {
      this.log('Already listening for source navigation messages');
      return () => this.stopListening();
    }

    this.messageHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.messageHandler);
      this.isListening = true;
      this.log('Started listening for source navigation messages');
    }

    return () => this.stopListening();
  }

  /**
   * Stop listening for messages
   */
  stopListening(): void {
    if (this.messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
      this.isListening = false;
      this.log('Stopped listening for source navigation messages');
    }
  }

  /**
   * Handle incoming postMessage from iframe
   */
  private handleMessage(event: MessageEvent): void {
    const data = event.data;

    if (!data || typeof data !== 'object') return;
    if (data.type !== 'platxa:source-navigate') return;

    const { file, line, sourceId } = data as SourceNavigateEvent & { type: string };

    if (!file || typeof line !== 'number') {
      this.log('Invalid source-navigate message: missing file or line');
      return;
    }

    this.navigateToSource({ file, line, sourceId });
  }

  /**
   * Navigate to a source location in the editor
   *
   * Feature #70 core function: Opens file and highlights relevant lines
   */
  navigateToSource(event: SourceNavigateEvent): NavigationResult {
    const { file, line, sourceId } = event;

    this.log(`Navigating to ${file}:${line} (sourceId: ${sourceId || 'none'})`);

    // Try to get full location with endLine from source map
    let startLine = line;
    let endLine = line;

    if (sourceId && this.config.sourceMap) {
      const location = getSourceLocation(sourceId, this.config.sourceMap);
      if (location) {
        startLine = location.startLine;
        endLine = location.endLine;
        this.log(`Resolved location: ${location.path}:${startLine}-${endLine}`);
      }
    }

    const result: NavigationResult = {
      success: true,
      path: file,
      startLine,
      endLine,
      sourceId,
    };

    // Perform editor navigation if editor integration is available
    if (this.config.editor) {
      try {
        // Open the file
        this.config.editor.openFile(file);

        // Set cursor to start line
        this.config.editor.setCursorPosition(startLine, 1);

        // Highlight the range (startLine to endLine)
        this.config.editor.setSelection(startLine, endLine, 1, 1);

        // Reveal the line if auto-reveal is enabled
        if (this.config.autoReveal) {
          this.config.editor.revealLine(startLine);
        }

        this.log(`Editor navigation complete: ${file}:${startLine}-${endLine}`);
      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : String(error);
        this.log(`Editor navigation failed: ${result.error}`);
      }
    } else {
      this.log('No editor integration configured, navigation result only');
    }

    // Call onNavigate callback
    this.config.onNavigate?.(result);

    return result;
  }

  /**
   * Update the source map for location lookups
   */
  setSourceMap(sourceMap: QWebSourceMap): void {
    this.config.sourceMap = sourceMap;
  }

  /**
   * Update the editor integration
   */
  setEditor(editor: EditorIntegration): void {
    this.config.editor = editor;
  }

  /**
   * Check if navigator is currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Dispose the navigator
   */
  dispose(): void {
    this.stopListening();
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[PreviewSourceNavigator] ${message}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new PreviewSourceNavigator
 */
export function createPreviewSourceNavigator(config?: SourceNavigatorConfig): PreviewSourceNavigator {
  return new PreviewSourceNavigator(config);
}

/**
 * Navigate to source location (standalone function)
 *
 * Feature #70: getSourceLocation(elementId) returns { path, startLine, endLine }
 * This function uses that to navigate the editor to the correct location.
 */
export function navigateToSource(
  event: SourceNavigateEvent,
  editor: EditorIntegration,
  sourceMap?: QWebSourceMap
): NavigationResult {
  const navigator = new PreviewSourceNavigator({ editor, sourceMap });
  return navigator.navigateToSource(event);
}

/**
 * Create an editor integration from store functions
 *
 * @example
 * ```typescript
 * const integration = createEditorIntegration({
 *   openFile: editorStore.openTab,
 *   setCursor: editorStore.setCursorPosition,
 *   setSelection: editorStore.setSelection,
 *   reveal: monaco.revealLine
 * });
 * ```
 */
export function createEditorIntegration(handlers: {
  openFile: (path: string) => void;
  setCursor?: (line: number, column: number) => void;
  setSelection?: (startLine: number, endLine: number, startColumn?: number, endColumn?: number) => void;
  reveal?: (line: number) => void;
}): EditorIntegration {
  return {
    openFile: handlers.openFile,
    setCursorPosition: handlers.setCursor ?? (() => {}),
    setSelection: handlers.setSelection ?? (() => {}),
    revealLine: handlers.reveal ?? (() => {}),
  };
}

// =============================================================================
// Exports
// =============================================================================

export default PreviewSourceNavigator;
