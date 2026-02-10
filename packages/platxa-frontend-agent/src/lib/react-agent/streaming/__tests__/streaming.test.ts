/**
 * Double-Streaming Tests
 *
 * Tests for the streaming pipeline and sanitization utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  escapeHtml,
  escapeXml,
  escapeJson,
  escapeMarkdown,
  stripHtml,
  backendSanitize,
  clientSanitizeSync,
  sanitizeSync,
} from '../sanitize.js';
import {
  createDoubleStream,
  createSanitizingTransform,
} from '../double-stream.js';
import type {
  StreamPipelineConfig,
  AnyChunk,
} from '../types.js';

describe('Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#x27;s');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeXml', () => {
    it('should escape XML special characters', () => {
      expect(escapeXml('<tag attr="value">text</tag>')).toBe(
        '&lt;tag attr=&quot;value&quot;&gt;text&lt;/tag&gt;'
      );
    });

    it('should use apos entity for single quotes', () => {
      expect(escapeXml("it's")).toBe('it&apos;s');
    });
  });

  describe('escapeJson', () => {
    it('should escape for JSON embedding', () => {
      expect(escapeJson('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape quotes', () => {
      expect(escapeJson('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should escape backslashes', () => {
      expect(escapeJson('path\\to\\file')).toBe('path\\\\to\\\\file');
    });
  });

  describe('escapeMarkdown', () => {
    it('should escape markdown special characters', () => {
      expect(escapeMarkdown('**bold** _italic_')).toBe(
        '\\*\\*bold\\*\\* \\_italic\\_'
      );
    });

    it('should escape links', () => {
      expect(escapeMarkdown('[text](url)')).toBe('\\[text\\]\\(url\\)');
    });

    it('should escape code backticks', () => {
      expect(escapeMarkdown('`code`')).toBe('\\`code\\`');
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe(
        'Hello World'
      );
    });

    it('should remove script tags and content', () => {
      expect(stripHtml('Before<script>alert("xss")</script>After')).toBe(
        'BeforeAfter'
      );
    });

    it('should remove style tags and content', () => {
      expect(stripHtml('Before<style>.red{color:red}</style>After')).toBe(
        'BeforeAfter'
      );
    });

    it('should decode HTML entities', () => {
      expect(stripHtml('&lt;tag&gt; &amp; &quot;text&quot;')).toBe(
        '<tag> & "text"'
      );
    });

    it('should convert nbsp to space', () => {
      expect(stripHtml('Hello&nbsp;World')).toBe('Hello World');
    });
  });
});

describe('Backend Sanitization', () => {
  describe('HTML content type', () => {
    it('should remove script tags', () => {
      const result = backendSanitize(
        '<div><script>alert("xss")</script></div>',
        'html'
      );
      expect(result.content).not.toContain('<script>');
      expect(result.wasModified).toBe(true);
      expect(result.warnings).toContain('Script tag removed');
    });

    it('should remove event handlers', () => {
      const result = backendSanitize(
        '<button onclick="alert()">Click</button>',
        'html'
      );
      expect(result.content).not.toContain('onclick=');
      expect(result.wasModified).toBe(true);
    });

    it('should remove javascript: protocol', () => {
      const result = backendSanitize(
        '<a href="javascript:alert()">Link</a>',
        'html'
      );
      expect(result.content).not.toContain('javascript:');
      expect(result.wasModified).toBe(true);
    });

    it('should not modify safe HTML', () => {
      const safeHtml = '<div class="container"><p>Hello World</p></div>';
      const result = backendSanitize(safeHtml, 'html');
      expect(result.content).toBe(safeHtml);
      expect(result.wasModified).toBe(false);
    });
  });

  describe('Markdown content type', () => {
    it('should remove script tags from markdown', () => {
      const result = backendSanitize(
        '# Title\n<script>alert()</script>\nText',
        'markdown'
      );
      expect(result.content).not.toContain('<script>');
      expect(result.wasModified).toBe(true);
    });

    it('should remove javascript: protocol from markdown', () => {
      const result = backendSanitize(
        '[Click](javascript:alert())',
        'markdown'
      );
      expect(result.content).not.toContain('javascript:');
      expect(result.wasModified).toBe(true);
    });
  });

  describe('Code content type', () => {
    it('should escape code for HTML display', () => {
      const result = backendSanitize(
        'function foo() { return "<div>"; }',
        'code'
      );
      expect(result.content).toBe(
        'function foo() { return &quot;&lt;div&gt;&quot;; }'
      );
    });
  });

  describe('JSON content type', () => {
    it('should pass through valid JSON', () => {
      const json = '{"key": "value"}';
      const result = backendSanitize(json, 'json');
      expect(result.content).toBe(json);
      expect(result.wasModified).toBe(false);
    });

    it('should warn and escape invalid JSON with HTML chars', () => {
      const invalid = '{invalid: "<script>"}';
      const result = backendSanitize(invalid, 'json');
      expect(result.wasModified).toBe(true);
      expect(result.warnings).toContain('Invalid JSON, escaping as text');
      expect(result.content).toContain('&lt;script&gt;');
    });

    it('should warn for invalid JSON without HTML chars', () => {
      const invalid = '{invalid json}';
      const result = backendSanitize(invalid, 'json');
      expect(result.warnings).toContain('Invalid JSON, escaping as text');
      // No HTML chars to escape, so content unchanged
      expect(result.content).toBe(invalid);
    });
  });

  describe('Text content type', () => {
    it('should escape HTML in text', () => {
      const result = backendSanitize('<script>alert()</script>', 'text');
      expect(result.content).toBe(
        '&lt;script&gt;alert()&lt;/script&gt;'
      );
    });
  });
});

describe('Client Sanitization', () => {
  describe('clientSanitizeSync', () => {
    it('should strip HTML when stripHtml option is true', () => {
      const result = clientSanitizeSync('<p>Hello <b>World</b></p>', {
        contentType: 'html',
        stripHtml: true,
      });
      expect(result.content).toBe('Hello World');
      expect(result.wasModified).toBe(true);
    });

    it('should escape text content type', () => {
      const result = clientSanitizeSync('<script>alert()</script>', {
        contentType: 'text',
      });
      expect(result.content).toBe('&lt;script&gt;alert()&lt;/script&gt;');
    });

    it('should escape code content type', () => {
      const result = clientSanitizeSync('const x = "<div>";', {
        contentType: 'code',
      });
      expect(result.content).toBe('const x = &quot;&lt;div&gt;&quot;;');
    });

    it('should use fallback sanitization for HTML', () => {
      const result = clientSanitizeSync(
        '<div onclick="alert()"><script>xss</script></div>',
        { contentType: 'html' }
      );
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('onclick=');
    });
  });
});

describe('Combined Sanitization', () => {
  describe('sanitizeSync', () => {
    it('should apply both backend and client sanitization for HTML', () => {
      const result = sanitizeSync(
        '<div onclick="alert()"><script>xss</script>Safe content</div>',
        { contentType: 'html' }
      );
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('onclick=');
      expect(result.content).toContain('Safe content');
    });

    it('should apply both sanitizations for markdown', () => {
      const result = sanitizeSync(
        '# Title\n<script>xss</script>\n[link](javascript:alert())',
        { contentType: 'markdown' }
      );
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('javascript:');
    });

    it('should only apply backend sanitization for code', () => {
      const result = sanitizeSync('const x = "<script>";', {
        contentType: 'code',
      });
      expect(result.content).toBe('const x = &quot;&lt;script&gt;&quot;;');
    });
  });
});

describe('Double Stream Pipeline', () => {
  describe('createDoubleStream', () => {
    it('should create a pipeline with all required methods', () => {
      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: new ReadableStream(),
        },
      };

      const pipeline = createDoubleStream(config);

      expect(pipeline).toHaveProperty('start');
      expect(pipeline).toHaveProperty('pause');
      expect(pipeline).toHaveProperty('resume');
      expect(pipeline).toHaveProperty('cancel');
      expect(pipeline).toHaveProperty('getState');
      expect(pipeline).toHaveProperty('getContent');
      expect(pipeline).toHaveProperty('getSanitizedContent');
    });

    it('should initialize with correct default state', () => {
      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: new ReadableStream(),
        },
      };

      const pipeline = createDoubleStream(config);
      const state = pipeline.getState();

      expect(state.isActive).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.chunksReceived).toBe(0);
      expect(state.bytesReceived).toBe(0);
      expect(state.accumulatedText).toBe('');
    });

    it('should process text chunks and accumulate content', async () => {
      const chunks: AnyChunk[] = [];
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('0:"Hello "\n'));
          controller.enqueue(encoder.encode('0:"World"\n'));
          controller.enqueue(
            encoder.encode(
              'd:{"totalTokens":10,"durationMs":100,"reason":"complete"}\n'
            )
          );
          controller.close();
        },
      });

      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: stream,
        },
        backendSanitize: false,
        clientSanitize: false,
        onChunk: (chunk) => chunks.push(chunk),
      };

      const pipeline = createDoubleStream(config);
      await pipeline.start();

      expect(pipeline.getContent()).toBe('Hello World');
      expect(chunks.length).toBe(3);
      expect(chunks[0].type).toBe('text');
      expect(chunks[1].type).toBe('text');
      expect(chunks[2].type).toBe('finish');
    });

    it('should sanitize text chunks when enabled', async () => {
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('0:"<script>alert()</script>Safe"\n')
          );
          controller.enqueue(
            encoder.encode(
              'd:{"totalTokens":5,"durationMs":50,"reason":"complete"}\n'
            )
          );
          controller.close();
        },
      });

      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: stream,
        },
        sanitization: { contentType: 'html' },
        backendSanitize: true,
        clientSanitize: true,
      };

      const pipeline = createDoubleStream(config);
      await pipeline.start();

      const content = pipeline.getSanitizedContent();
      expect(content).not.toContain('<script>');
      expect(content).toContain('Safe');
    });

    it('should call onComplete when stream finishes', async () => {
      const onComplete = vi.fn();
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'd:{"totalTokens":10,"durationMs":100,"reason":"complete"}\n'
            )
          );
          controller.close();
        },
      });

      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: stream,
        },
        onComplete,
      };

      const pipeline = createDoubleStream(config);
      await pipeline.start();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTokens: 10,
          durationMs: 100,
          reason: 'complete',
        })
      );
    });

    it('should handle metadata chunks', async () => {
      const chunks: AnyChunk[] = [];
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('2:{"progress":50,"phase":"generating"}\n')
          );
          controller.enqueue(
            encoder.encode(
              'd:{"totalTokens":10,"durationMs":100,"reason":"complete"}\n'
            )
          );
          controller.close();
        },
      });

      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: stream,
        },
        onChunk: (chunk) => chunks.push(chunk),
      };

      const pipeline = createDoubleStream(config);
      await pipeline.start();

      const state = pipeline.getState();
      expect(state.metadata.progress).toBe(50);
      expect(state.metadata.phase).toBe('generating');
    });

    it('should support cancel', () => {
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('0:"First chunk"\n'));
        },
      });

      const config: StreamPipelineConfig = {
        source: {
          type: 'readable',
          source: stream,
        },
      };

      const pipeline = createDoubleStream(config);
      // Start but don't await - just cancel immediately
      void pipeline.start();
      pipeline.cancel();

      const state = pipeline.getState();
      expect(state.isActive).toBe(false);
    });
  });
});

describe('Sanitizing Transform Stream', () => {
  it('should create a transform stream', () => {
    const transform = createSanitizingTransform({ contentType: 'html' });
    expect(transform).toBeInstanceOf(TransformStream);
  });

  it('should sanitize chunks passing through', async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('0:"<script>xss</script>Safe"\n'));
        controller.close();
      },
    });

    const transform = createSanitizingTransform({ contentType: 'html' });
    const output = input.pipeThrough(transform);
    const reader = output.getReader();

    const chunks: string[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(decoder.decode(result.value));
      }
    }

    const combined = chunks.join('');
    expect(combined).not.toContain('<script>');
    expect(combined).toContain('Safe');
  });
});
