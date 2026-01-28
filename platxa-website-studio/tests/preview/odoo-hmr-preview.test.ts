/**
 * OdooHMRPreview Tests
 *
 * Verifies Feature #59: OdooHMRPreview class managing iframe communication and hot updates
 *
 * Verification criteria:
 * - Class manages iframe ref
 * - Source map tracking
 * - Pending updates queue
 * - Message bridge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OdooHMRPreview,
  createHMRPreview,
  createDebugHMRPreview,
  type HMRUpdate,
  type MessageType,
  type BridgeMessage,
} from '@/lib/preview/odoo-hmr-preview';
import { buildSourceMap, type SourceMapEntry } from '@/lib/preview/qweb-source-map';

// Mock iframe element
function createMockIframe(): HTMLIFrameElement {
  const postMessage = vi.fn();
  const contentWindow = { postMessage };

  return {
    contentWindow,
    src: 'about:blank',
  } as unknown as HTMLIFrameElement;
}

// Mock source map entries
function createMockSourceMapEntries(): SourceMapEntry[] {
  return [
    {
      domSelector: '[data-source-id="src-0"]',
      file: 'views/hero.xml',
      line: 1,
      tagName: 'section',
      snippetId: 's_hero',
    },
    {
      domSelector: '[data-source-id="src-1"]',
      file: 'views/hero.xml',
      line: 5,
      tagName: 'div',
    },
    {
      domSelector: '[data-source-id="src-2"]',
      file: 'views/hero.xml',
      line: 8,
      tagName: 'h1',
    },
  ];
}

describe('OdooHMRPreview', () => {
  let hmr: OdooHMRPreview;

  beforeEach(() => {
    hmr = new OdooHMRPreview({ debounceMs: 0 }); // No debounce for tests
  });

  afterEach(() => {
    hmr.dispose();
  });

  describe('instantiation', () => {
    it('should create instance with default config', () => {
      const instance = new OdooHMRPreview();
      expect(instance).toBeInstanceOf(OdooHMRPreview);
      instance.dispose();
    });

    it('should create instance with custom config', () => {
      const instance = new OdooHMRPreview({
        debounceMs: 100,
        maxQueueSize: 50,
        targetOrigin: 'https://example.com',
        debug: true,
      });
      expect(instance).toBeInstanceOf(OdooHMRPreview);
      instance.dispose();
    });

    it('should create via createHMRPreview factory', () => {
      const instance = createHMRPreview();
      expect(instance).toBeInstanceOf(OdooHMRPreview);
      instance.dispose();
    });

    it('should create debug instance via createDebugHMRPreview factory', () => {
      const instance = createDebugHMRPreview();
      expect(instance).toBeInstanceOf(OdooHMRPreview);
      instance.dispose();
    });
  });

  describe('iframe management', () => {
    it('should initially have no iframe reference', () => {
      expect(hmr.getIframe()).toBeNull();
      expect(hmr.isIframeReady()).toBe(false);
    });

    it('should set and get iframe reference', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      expect(hmr.getIframe()).toBe(iframe);
      expect(hmr.isIframeReady()).toBe(true);
    });

    it('should clear iframe reference when set to null', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);
      hmr.setIframe(null);

      expect(hmr.getIframe()).toBeNull();
      expect(hmr.isIframeReady()).toBe(false);
    });

    it('should clear pending updates when iframe is removed', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueCSSUpdate('.test { color: red; }');
      expect(hmr.getQueueState().pendingCount).toBe(1);

      hmr.setIframe(null);
      expect(hmr.getQueueState().pendingCount).toBe(0);
    });
  });

  describe('source map management', () => {
    it('should initially have no source map', () => {
      expect(hmr.getSourceMap()).toBeNull();
    });

    it('should set source map directly', () => {
      const entries = createMockSourceMapEntries();
      const sourceMap = buildSourceMap(entries);

      hmr.setSourceMap(sourceMap);

      expect(hmr.getSourceMap()).toBe(sourceMap);
    });

    it('should build source map from entries', () => {
      const entries = createMockSourceMapEntries();
      hmr.setSourceMapFromEntries(entries);

      const sourceMap = hmr.getSourceMap();
      expect(sourceMap).not.toBeNull();
      expect(sourceMap!.entries).toHaveLength(3);
    });

    it('should find source by DOM selector', () => {
      const entries = createMockSourceMapEntries();
      hmr.setSourceMapFromEntries(entries);

      const source = hmr.findSource('[data-source-id="src-0"]');
      expect(source).toBeDefined();
      expect(source!.file).toBe('views/hero.xml');
      expect(source!.line).toBe(1);
      expect(source!.snippetId).toBe('s_hero');
    });

    it('should find DOM entries by source location', () => {
      const entries = createMockSourceMapEntries();
      hmr.setSourceMapFromEntries(entries);

      const domEntries = hmr.findDom('views/hero.xml', 5);
      expect(domEntries).toHaveLength(1);
      expect(domEntries[0].tagName).toBe('div');
    });

    it('should return undefined for unknown DOM selector', () => {
      hmr.setSourceMapFromEntries(createMockSourceMapEntries());
      expect(hmr.findSource('[data-source-id="unknown"]')).toBeUndefined();
    });

    it('should return empty array for unknown source location', () => {
      hmr.setSourceMapFromEntries(createMockSourceMapEntries());
      expect(hmr.findDom('unknown.xml', 999)).toEqual([]);
    });

    it('should handle findSource/findDom with no source map set', () => {
      expect(hmr.findSource('[data-source-id="src-0"]')).toBeUndefined();
      expect(hmr.findDom('file.xml', 1)).toEqual([]);
    });
  });

  describe('pending updates queue', () => {
    it('should queue updates', () => {
      hmr.queueUpdate({ type: 'css', content: '.test {}' });
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should queue CSS updates via helper', () => {
      hmr.queueCSSUpdate('.body { margin: 0; }', 'styles.scss');
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should queue HTML updates via helper', () => {
      hmr.queueHTMLUpdate('<div>Hello</div>', 'page.xml');
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should queue highlight updates via helper', () => {
      hmr.queueHighlight('src-0');
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should queue scroll-to updates via helper', () => {
      hmr.queueScrollTo('src-1');
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should queue full reload and clear other updates', () => {
      hmr.queueCSSUpdate('.test {}');
      hmr.queueHTMLUpdate('<div></div>');
      expect(hmr.getQueueState().pendingCount).toBe(2);

      hmr.queueFullReload();
      expect(hmr.getQueueState().pendingCount).toBe(1);
    });

    it('should clear pending updates', () => {
      hmr.queueCSSUpdate('.test {}');
      hmr.queueHTMLUpdate('<div></div>');

      hmr.clearPendingUpdates();
      expect(hmr.getQueueState().pendingCount).toBe(0);
    });

    it('should apply pending updates', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueCSSUpdate('.test { color: blue; }');
      await hmr.applyPendingUpdates();

      expect(hmr.getQueueState().pendingCount).toBe(0);
      expect(hmr.getQueueState().totalApplied).toBe(1);
      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'platxa:inject-css', css: '.test { color: blue; }' }),
        '*'
      );
    });

    it('should track queue state', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const initialState = hmr.getQueueState();
      expect(initialState.pendingCount).toBe(0);
      expect(initialState.isApplying).toBe(false);
      expect(initialState.lastApplied).toBeNull();
      expect(initialState.totalApplied).toBe(0);

      hmr.queueCSSUpdate('.test {}');
      await hmr.applyPendingUpdates();

      const afterState = hmr.getQueueState();
      expect(afterState.totalApplied).toBe(1);
      expect(afterState.lastApplied).not.toBeNull();
    });

    it('should sort updates by priority', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      // Queue in wrong order
      hmr.queueUpdate({ type: 'html', content: '<div></div>', priority: 50 });
      hmr.queueUpdate({ type: 'css', content: '.test {}', priority: 100 });
      hmr.queueUpdate({ type: 'highlight', sourceId: 'src-0', priority: 150 });

      await hmr.applyPendingUpdates();

      // Verify order: highlight (150) -> css (100) -> html (50)
      const calls = (iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0].type).toBe('platxa:highlight-element');
      expect(calls[1][0].type).toBe('platxa:inject-css');
      expect(calls[2][0].type).toBe('platxa:inject-html');
    });

    it('should not apply when queue is empty', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      await hmr.applyPendingUpdates();

      expect(iframe.contentWindow!.postMessage).not.toHaveBeenCalled();
    });

    it('should force apply when queue exceeds maxQueueSize', async () => {
      const smallQueueHmr = new OdooHMRPreview({ maxQueueSize: 2, debounceMs: 1000 });
      const iframe = createMockIframe();
      smallQueueHmr.setIframe(iframe);

      // Queue exactly at limit - should trigger immediate apply
      smallQueueHmr.queueCSSUpdate('.a {}');
      smallQueueHmr.queueCSSUpdate('.b {}');

      // Wait a tick for the apply to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(smallQueueHmr.getQueueState().pendingCount).toBe(0);
      expect(smallQueueHmr.getQueueState().totalApplied).toBe(2);

      smallQueueHmr.dispose();
    });
  });

  describe('message bridge', () => {
    it('should post messages to iframe', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const result = hmr.postMessage('platxa:inject-css', { css: '.test {}' });

      expect(result).toBe(true);
      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        { type: 'platxa:inject-css', css: '.test {}' },
        '*'
      );
    });

    it('should return false when iframe is not ready', () => {
      const result = hmr.postMessage('platxa:inject-css', { css: '.test {}' });
      expect(result).toBe(false);
    });

    it('should register message handlers', () => {
      const handler = vi.fn();
      const unsubscribe = hmr.onMessage('platxa:source-navigate', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe message handlers', () => {
      const handler = vi.fn();
      const unsubscribe = hmr.onMessage('platxa:source-navigate', handler);

      unsubscribe();

      // Handler should be removed - simulate a message
      const event = new MessageEvent('message', {
        data: { type: 'platxa:source-navigate', file: 'test.xml', line: 1 },
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle incoming messages from iframe', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const handler = vi.fn();
      hmr.onMessage('platxa:source-navigate', handler);

      // Simulate message from iframe
      const event = new MessageEvent('message', {
        data: { type: 'platxa:source-navigate', file: 'test.xml', line: 5 },
        source: iframe.contentWindow,
      });
      window.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith({
        type: 'platxa:source-navigate',
        file: 'test.xml',
        line: 5,
      });
    });

    it('should ignore messages from other sources', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const handler = vi.fn();
      hmr.onMessage('platxa:source-navigate', handler);

      // Simulate message from different source (null = main window)
      const event = new MessageEvent('message', {
        data: { type: 'platxa:source-navigate', file: 'test.xml', line: 5 },
        source: null,
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore non-platxa messages', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const handler = vi.fn();
      hmr.onMessage('platxa:source-navigate', handler);

      // Simulate non-platxa message
      const event = new MessageEvent('message', {
        data: { type: 'other-message' },
        source: iframe.contentWindow,
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all handlers for a message type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      hmr.onMessage('platxa:snippet-select', handler1);
      hmr.onMessage('platxa:snippet-select', handler2);

      hmr.offMessage('platxa:snippet-select');

      // Handlers should be removed
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const event = new MessageEvent('message', {
        data: { type: 'platxa:snippet-select', snippetId: 's_test' },
        source: iframe.contentWindow,
      });
      window.dispatchEvent(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same message type', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      hmr.onMessage('platxa:ready', handler1);
      hmr.onMessage('platxa:ready', handler2);

      const event = new MessageEvent('message', {
        data: { type: 'platxa:ready' },
        source: iframe.contentWindow,
      });
      window.dispatchEvent(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should catch handler errors without breaking other handlers', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      hmr.onMessage('platxa:ready', errorHandler);
      hmr.onMessage('platxa:ready', goodHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = new MessageEvent('message', {
        data: { type: 'platxa:ready' },
        source: iframe.contentWindow,
      });
      window.dispatchEvent(event);

      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('update application', () => {
    it('should apply CSS update via postMessage', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueCSSUpdate('.body { margin: 0; }');
      await hmr.applyPendingUpdates();

      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'platxa:inject-css' }),
        '*'
      );
    });

    it('should apply HTML update via postMessage', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueHTMLUpdate('<div>Updated</div>');
      await hmr.applyPendingUpdates();

      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'platxa:inject-html', html: '<div>Updated</div>' }),
        '*'
      );
    });

    it('should apply highlight update via postMessage', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueHighlight('src-5');
      await hmr.applyPendingUpdates();

      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'platxa:highlight-element', sourceId: 'src-5' }),
        '*'
      );
    });

    it('should apply scroll-to update via postMessage', async () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);

      hmr.queueScrollTo('src-3');
      await hmr.applyPendingUpdates();

      expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'platxa:scroll-to-element', sourceId: 'src-3' }),
        '*'
      );
    });

    it('should apply full reload by resetting iframe src', async () => {
      const iframe = createMockIframe();
      iframe.src = 'http://example.com/preview';
      hmr.setIframe(iframe);

      hmr.queueFullReload();
      await hmr.applyPendingUpdates();

      // After reset and restore, src should be back to original
      expect(iframe.src).toBe('http://example.com/preview');
    });
  });

  describe('dispose', () => {
    it('should clean up all state on dispose', () => {
      const iframe = createMockIframe();
      hmr.setIframe(iframe);
      hmr.setSourceMapFromEntries(createMockSourceMapEntries());
      hmr.queueCSSUpdate('.test {}');

      hmr.dispose();

      expect(hmr.getIframe()).toBeNull();
      expect(hmr.getSourceMap()).toBeNull();
      expect(hmr.getQueueState().pendingCount).toBe(0);
    });

    it('should remove window message listener on dispose', () => {
      const handler = vi.fn();
      hmr.onMessage('platxa:ready', handler);

      hmr.dispose();

      // Message should not be handled after dispose
      const event = new MessageEvent('message', {
        data: { type: 'platxa:ready' },
      });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should be safe to call dispose multiple times', () => {
      expect(() => {
        hmr.dispose();
        hmr.dispose();
        hmr.dispose();
      }).not.toThrow();
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid updates', async () => {
      const debouncedHmr = new OdooHMRPreview({ debounceMs: 50 });
      const iframe = createMockIframe();
      debouncedHmr.setIframe(iframe);

      // Queue multiple rapid updates
      debouncedHmr.queueCSSUpdate('.a {}');
      debouncedHmr.queueCSSUpdate('.b {}');
      debouncedHmr.queueCSSUpdate('.c {}');

      // Should not apply immediately
      expect(debouncedHmr.getQueueState().pendingCount).toBe(3);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have applied all updates
      expect(debouncedHmr.getQueueState().pendingCount).toBe(0);
      expect(debouncedHmr.getQueueState().totalApplied).toBe(3);

      debouncedHmr.dispose();
    });
  });
});
