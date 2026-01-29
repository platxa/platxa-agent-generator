/**
 * Tests for PreviewSourceNavigator
 *
 * Feature #70: Implement editor highlight from preview selection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PreviewSourceNavigator,
  createPreviewSourceNavigator,
  navigateToSource,
  createEditorIntegration,
  type EditorIntegration,
  type SourceNavigateEvent,
  type NavigationResult,
} from '@/lib/preview/preview-source-navigator';
import { annotateTemplateSource, buildSourceMap, type QWebSourceMap } from '@/lib/preview/qweb-source-map';

describe('PreviewSourceNavigator', () => {
  let navigator: PreviewSourceNavigator;
  let mockEditor: EditorIntegration;

  beforeEach(() => {
    mockEditor = {
      openFile: vi.fn(),
      setCursorPosition: vi.fn(),
      setSelection: vi.fn(),
      revealLine: vi.fn(),
    };

    navigator = new PreviewSourceNavigator({
      editor: mockEditor,
    });
  });

  afterEach(() => {
    navigator.dispose();
  });

  describe('preview click opens file in editor and highlights relevant lines (Feature #70)', () => {
    it('should open file and highlight line on source navigation', () => {
      const event: SourceNavigateEvent = {
        file: 'templates/hero.xml',
        line: 15,
        sourceId: 'src-0',
      };

      const result = navigator.navigateToSource(event);

      expect(result.success).toBe(true);
      expect(result.path).toBe('templates/hero.xml');
      expect(result.startLine).toBe(15);
      expect(mockEditor.openFile).toHaveBeenCalledWith('templates/hero.xml');
      expect(mockEditor.setCursorPosition).toHaveBeenCalledWith(15, 1);
      expect(mockEditor.setSelection).toHaveBeenCalled();
      expect(mockEditor.revealLine).toHaveBeenCalledWith(15);
    });

    it('should highlight full element range when source map is available', () => {
      // Create source map with element that spans multiple lines
      const source = `<section class="hero">
  <div class="container">
    <h1>Title</h1>
  </div>
</section>`;
      const { entries } = annotateTemplateSource(source, 'hero.xml');
      const sourceMap = buildSourceMap(entries);

      const navigatorWithMap = new PreviewSourceNavigator({
        editor: mockEditor,
        sourceMap,
      });

      const result = navigatorWithMap.navigateToSource({
        file: 'hero.xml',
        line: 1,
        sourceId: 'src-0', // section element
      });

      expect(result.success).toBe(true);
      expect(result.startLine).toBe(1);
      expect(result.endLine).toBe(5); // section ends on line 5
      expect(mockEditor.setSelection).toHaveBeenCalledWith(1, 5, 1, 1);

      navigatorWithMap.dispose();
    });

    it('should work without source map (single line highlight)', () => {
      const result = navigator.navigateToSource({
        file: 'test.xml',
        line: 42,
      });

      expect(result.success).toBe(true);
      expect(result.startLine).toBe(42);
      expect(result.endLine).toBe(42);
      expect(mockEditor.setSelection).toHaveBeenCalledWith(42, 42, 1, 1);
    });
  });

  describe('navigateToSource', () => {
    it('should return NavigationResult with path, startLine, endLine', () => {
      const result = navigator.navigateToSource({
        file: 'views/page.xml',
        line: 10,
        sourceId: 'src-5',
      });

      expect(result).toMatchObject({
        success: true,
        path: 'views/page.xml',
        startLine: 10,
        endLine: 10,
        sourceId: 'src-5',
      });
    });

    it('should call onNavigate callback', () => {
      const onNavigate = vi.fn();
      const navWithCallback = new PreviewSourceNavigator({
        editor: mockEditor,
        onNavigate,
      });

      navWithCallback.navigateToSource({ file: 'test.xml', line: 5 });

      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          path: 'test.xml',
          startLine: 5,
        })
      );

      navWithCallback.dispose();
    });

    it('should work without editor integration', () => {
      const navNoEditor = new PreviewSourceNavigator();

      const result = navNoEditor.navigateToSource({
        file: 'test.xml',
        line: 10,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('test.xml');

      navNoEditor.dispose();
    });
  });

  describe('message listening', () => {
    it('should start and stop listening', () => {
      expect(navigator.isActive()).toBe(false);

      const unsubscribe = navigator.listen();
      expect(navigator.isActive()).toBe(true);

      unsubscribe();
      expect(navigator.isActive()).toBe(false);
    });

    it('should handle platxa:source-navigate messages', () => {
      navigator.listen();

      // Simulate postMessage from iframe
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'platxa:source-navigate',
          file: 'template.xml',
          line: 25,
          sourceId: 'src-3',
        },
      });

      window.dispatchEvent(messageEvent);

      expect(mockEditor.openFile).toHaveBeenCalledWith('template.xml');
      expect(mockEditor.setCursorPosition).toHaveBeenCalledWith(25, 1);
    });

    it('should ignore non-source-navigate messages', () => {
      navigator.listen();

      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'platxa:other-message',
          file: 'test.xml',
          line: 1,
        },
      });

      window.dispatchEvent(messageEvent);

      expect(mockEditor.openFile).not.toHaveBeenCalled();
    });

    it('should ignore messages without required fields', () => {
      navigator.listen();

      // Missing line
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'platxa:source-navigate', file: 'test.xml' },
      }));

      // Missing file
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'platxa:source-navigate', line: 10 },
      }));

      expect(mockEditor.openFile).not.toHaveBeenCalled();
    });
  });

  describe('setSourceMap', () => {
    it('should update source map for lookups', () => {
      const source = '<div>\n  <span>text</span>\n</div>';
      const { entries } = annotateTemplateSource(source, 'test.xml');
      const sourceMap = buildSourceMap(entries);

      navigator.setSourceMap(sourceMap);

      const result = navigator.navigateToSource({
        file: 'test.xml',
        line: 1,
        sourceId: 'src-0',
      });

      expect(result.endLine).toBe(3); // div ends on line 3
    });
  });

  describe('setEditor', () => {
    it('should update editor integration', () => {
      const navNoEditor = new PreviewSourceNavigator();
      const newEditor: EditorIntegration = {
        openFile: vi.fn(),
        setCursorPosition: vi.fn(),
        setSelection: vi.fn(),
        revealLine: vi.fn(),
      };

      navNoEditor.setEditor(newEditor);
      navNoEditor.navigateToSource({ file: 'test.xml', line: 1 });

      expect(newEditor.openFile).toHaveBeenCalledWith('test.xml');

      navNoEditor.dispose();
    });
  });

  describe('autoReveal option', () => {
    it('should reveal line when autoReveal is true (default)', () => {
      const result = navigator.navigateToSource({ file: 'test.xml', line: 50 });

      expect(mockEditor.revealLine).toHaveBeenCalledWith(50);
    });

    it('should not reveal line when autoReveal is false', () => {
      const navNoReveal = new PreviewSourceNavigator({
        editor: mockEditor,
        autoReveal: false,
      });

      navNoReveal.navigateToSource({ file: 'test.xml', line: 50 });

      expect(mockEditor.revealLine).not.toHaveBeenCalled();

      navNoReveal.dispose();
    });
  });
});

describe('createPreviewSourceNavigator', () => {
  it('should create a new navigator instance', () => {
    const nav = createPreviewSourceNavigator();
    expect(nav).toBeInstanceOf(PreviewSourceNavigator);
    nav.dispose();
  });
});

describe('navigateToSource (standalone)', () => {
  it('should navigate using provided editor', () => {
    const mockEditor: EditorIntegration = {
      openFile: vi.fn(),
      setCursorPosition: vi.fn(),
      setSelection: vi.fn(),
      revealLine: vi.fn(),
    };

    const result = navigateToSource(
      { file: 'page.xml', line: 20 },
      mockEditor
    );

    expect(result.success).toBe(true);
    expect(mockEditor.openFile).toHaveBeenCalledWith('page.xml');
  });
});

describe('createEditorIntegration', () => {
  it('should create integration from handlers', () => {
    const openFile = vi.fn();
    const setCursor = vi.fn();

    const integration = createEditorIntegration({
      openFile,
      setCursor,
    });

    integration.openFile('test.xml');
    integration.setCursorPosition(10, 5);

    expect(openFile).toHaveBeenCalledWith('test.xml');
    expect(setCursor).toHaveBeenCalledWith(10, 5);
  });

  it('should provide no-op defaults for optional handlers', () => {
    const integration = createEditorIntegration({
      openFile: vi.fn(),
    });

    // Should not throw
    expect(() => {
      integration.setCursorPosition(1, 1);
      integration.setSelection(1, 5);
      integration.revealLine(10);
    }).not.toThrow();
  });
});
