# Implementation Plan: Live Preview Iframe Enhancement

**Priority:** Tier 1 - Critical
**Status:** Planning
**Estimated Complexity:** High
**Dependencies:** platxa-website-studio, platxa-editor-sync

---

## Executive Summary

Enhance the existing PreviewPanel to provide a lovable.dev-quality live preview experience for Odoo theme generation. The current implementation has good foundations but needs improvements in real-time streaming, QWeb rendering accuracy, and interactive features.

---

## Current State Analysis

### What Exists (PreviewPanel.tsx)

```
✅ Standalone preview mode (renders QWeb to HTML)
✅ Odoo preview mode (connects to running Odoo)
✅ Device frames (mobile, tablet, desktop)
✅ SCSS to CSS variable conversion
✅ QWeb template extraction (basic)
✅ Bootstrap 5 CDN integration
✅ Blob URL generation for standalone preview
```

### Gaps Identified

```
❌ No streaming preview during AI generation
❌ Limited QWeb rendering accuracy (t-foreach, t-if)
❌ No Odoo widget/snippet simulation
❌ No hot-reload on file save (only manual refresh)
❌ No visual diff between versions
❌ No element inspection/selection
❌ No error boundary in preview iframe
❌ Missing responsive breakpoint indicators
```

---

## Implementation Phases

### Phase 1: Streaming Preview (Critical)

**Goal:** Show preview updates as AI generates code, not after completion.

#### 1.1 Create StreamingPreviewProvider

```typescript
// lib/preview/streaming-preview-context.tsx

interface StreamingPreviewState {
  isStreaming: boolean;
  partialHtml: string;
  partialCss: string;
  parseError: string | null;
  lastUpdateTime: number;
}

interface StreamingPreviewContextValue extends StreamingPreviewState {
  startStreaming: () => void;
  updateContent: (chunk: string) => void;
  endStreaming: () => void;
  resetPreview: () => void;
}

export const StreamingPreviewContext = createContext<StreamingPreviewContextValue | null>(null);

export function StreamingPreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StreamingPreviewState>({
    isStreaming: false,
    partialHtml: '',
    partialCss: '',
    parseError: null,
    lastUpdateTime: 0,
  });

  // Debounced preview update to avoid too frequent re-renders
  const updateContent = useCallback(
    debounce((chunk: string) => {
      const { html, css, error } = parseStreamingContent(chunk);
      setState(prev => ({
        ...prev,
        partialHtml: html,
        partialCss: css,
        parseError: error,
        lastUpdateTime: Date.now(),
      }));
    }, 100), // 100ms debounce
    []
  );

  return (
    <StreamingPreviewContext.Provider value={{ ...state, updateContent, startStreaming, endStreaming, resetPreview }}>
      {children}
    </StreamingPreviewContext.Provider>
  );
}
```

#### 1.2 Create Incremental QWeb Parser

```typescript
// lib/preview/incremental-qweb-parser.ts

/**
 * Parse streaming QWeb content incrementally
 * Handles incomplete tags and partial content gracefully
 */
export class IncrementalQWebParser {
  private buffer: string = '';
  private completedTemplates: string[] = [];
  private partialTemplate: string = '';

  /**
   * Add new chunk to buffer and extract complete templates
   */
  addChunk(chunk: string): ParseResult {
    this.buffer += chunk;

    // Try to extract complete templates
    const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/g;
    let match;
    let lastIndex = 0;

    while ((match = templateRegex.exec(this.buffer)) !== null) {
      this.completedTemplates.push(match[1]);
      lastIndex = match.index + match[0].length;
    }

    // Keep remaining as partial
    this.partialTemplate = this.buffer.slice(lastIndex);
    this.buffer = this.buffer.slice(lastIndex);

    return {
      completedHtml: this.completedTemplates.join('\n'),
      partialHtml: this.sanitizePartial(this.partialTemplate),
      isComplete: this.buffer.length === 0,
    };
  }

  /**
   * Sanitize partial HTML to prevent rendering errors
   */
  private sanitizePartial(html: string): string {
    // Close unclosed tags
    const openTags: string[] = [];
    const tagRegex = /<(\/?)([\w-]+)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const [, isClosing, tagName] = match;
      if (isClosing) {
        const lastOpen = openTags.pop();
        if (lastOpen !== tagName) {
          openTags.push(lastOpen!); // Put it back
        }
      } else if (!['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tagName.toLowerCase())) {
        openTags.push(tagName);
      }
    }

    // Close remaining open tags
    let sanitized = html;
    while (openTags.length > 0) {
      const tag = openTags.pop()!;
      sanitized += `</${tag}>`;
    }

    return sanitized;
  }

  reset(): void {
    this.buffer = '';
    this.completedTemplates = [];
    this.partialTemplate = '';
  }
}
```

#### 1.3 Integrate with AI Chat Stream

```typescript
// components/chat/ChatPanel.tsx (modifications)

import { useStreamingPreview } from '@/lib/preview/streaming-preview-context';

export function ChatPanel({ initialPrompt }: ChatPanelProps) {
  const { startStreaming, updateContent, endStreaming } = useStreamingPreview();

  const handleStreamMessage = async (prompt: string) => {
    startStreaming();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt, stream: true }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        updateContent(chunk); // Update preview in real-time
      }
    } finally {
      endStreaming();
    }
  };
}
```

---

### Phase 2: Enhanced QWeb Rendering

**Goal:** Improve QWeb template rendering accuracy for better preview fidelity.

#### 2.1 Create QWeb Runtime Simulator

```typescript
// lib/preview/qweb-runtime.ts

/**
 * Simulates Odoo's QWeb runtime for preview purposes
 */
export class QWebRuntime {
  private context: Record<string, any>;
  private templates: Map<string, string> = new Map();

  constructor(initialContext?: Record<string, any>) {
    this.context = {
      // Default Odoo website context
      website: {
        name: 'Preview Website',
        company_id: { name: 'Company Name', phone: '+1 234 567 890' },
      },
      res_company: { name: 'Company Name' },
      request: { env: {} },
      ...initialContext,
    };
  }

  /**
   * Register a template for t-call resolution
   */
  registerTemplate(name: string, content: string): void {
    this.templates.set(name, content);
  }

  /**
   * Render QWeb template to HTML
   */
  render(template: string): string {
    let html = template;

    // Process t-set variables
    html = this.processVariables(html);

    // Process t-foreach loops
    html = this.processForeach(html);

    // Process t-if/t-else conditions
    html = this.processConditions(html);

    // Process t-call includes
    html = this.processCalls(html);

    // Process t-esc/t-raw output
    html = this.processOutput(html);

    // Process t-att attributes
    html = this.processAttributes(html);

    // Clean up remaining t-* directives
    html = this.cleanupDirectives(html);

    return html;
  }

  private processForeach(html: string): string {
    // t-foreach with sample data
    const foreachRegex = /<(\w+)\s+t-foreach="([^"]+)"\s+t-as="(\w+)"([^>]*)>([\s\S]*?)<\/\1>/g;

    return html.replace(foreachRegex, (match, tag, expr, varName, attrs, content) => {
      // Generate 3 sample items
      const items = [1, 2, 3];
      return items.map((i, index) => {
        let itemContent = content;
        // Replace variable references
        itemContent = itemContent.replace(new RegExp(`\\$\\{${varName}\\}`, 'g'), `Item ${i}`);
        itemContent = itemContent.replace(new RegExp(`${varName}_index`, 'g'), String(index));
        itemContent = itemContent.replace(new RegExp(`${varName}_first`, 'g'), String(index === 0));
        itemContent = itemContent.replace(new RegExp(`${varName}_last`, 'g'), String(index === items.length - 1));
        return `<${tag}${attrs}>${itemContent}</${tag}>`;
      }).join('\n');
    });
  }

  private processConditions(html: string): string {
    // For preview, show all conditional content with visual indicators
    html = html.replace(/\s*t-if="([^"]+)"/g, ' data-preview-condition="$1"');
    html = html.replace(/\s*t-elif="([^"]+)"/g, ' data-preview-condition="elif: $1"');
    html = html.replace(/\s*t-else(="[^"]*")?/g, ' data-preview-condition="else"');
    return html;
  }

  private processOutput(html: string): string {
    // t-esc: escaped output
    html = html.replace(/<t\s+t-esc="([^"]+)"\s*\/>/g,
      '<span class="preview-placeholder" data-field="$1">[$1]</span>');

    // t-raw: raw HTML output
    html = html.replace(/<t\s+t-raw="([^"]+)"\s*\/>/g,
      '<span class="preview-placeholder preview-html" data-field="$1">[HTML: $1]</span>');

    // t-out: new Odoo 15+ syntax
    html = html.replace(/<t\s+t-out="([^"]+)"\s*\/>/g,
      '<span class="preview-placeholder" data-field="$1">[$1]</span>');

    return html;
  }

  private processCalls(html: string): string {
    const callRegex = /<t\s+t-call="([^"]+)"[^>]*>([\s\S]*?)<\/t>|<t\s+t-call="([^"]+)"[^/]*\/>/g;

    return html.replace(callRegex, (match, name1, content, name2) => {
      const templateName = name1 || name2;
      const template = this.templates.get(templateName);

      if (template) {
        return this.render(template);
      }

      // Show placeholder for unknown templates
      return `<div class="preview-template-call" data-template="${templateName}">
        <span class="text-muted">[Template: ${templateName}]</span>
        ${content || ''}
      </div>`;
    });
  }

  private processAttributes(html: string): string {
    // t-attf- (formatted attributes)
    html = html.replace(/t-attf-(\w+)="([^"]+)"/g, (match, attr, value) => {
      // Replace #{expr} with placeholder
      const processed = value.replace(/#{([^}]+)}/g, '[$1]');
      return `${attr}="${processed}"`;
    });

    // t-att- (dynamic attributes)
    html = html.replace(/t-att-(\w+)="([^"]+)"/g, (match, attr, expr) => {
      return `${attr}="[${expr}]"`;
    });

    // t-att (object attributes)
    html = html.replace(/\s*t-att="[^"]+"/g, '');

    return html;
  }

  private processVariables(html: string): string {
    // t-set variables - extract and store
    const setRegex = /<t\s+t-set="(\w+)"(?:\s+t-value="([^"]+)")?[^>]*>(?:([\s\S]*?)<\/t>)?/g;

    html = html.replace(setRegex, (match, name, value, content) => {
      this.context[name] = value || content || '';
      return ''; // Remove from output
    });

    return html;
  }

  private cleanupDirectives(html: string): string {
    // Remove any remaining t-* attributes
    html = html.replace(/\s*t-[\w-]+="[^"]*"/g, '');
    // Remove empty t tags
    html = html.replace(/<t\s*>([\s\S]*?)<\/t>/g, '$1');
    html = html.replace(/<t\s*\/>/g, '');
    return html;
  }
}
```

#### 2.2 Add Preview Placeholder Styles

```css
/* styles/preview-placeholders.css */

.preview-placeholder {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #92400e;
  border: 1px dashed #f59e0b;
}

.preview-placeholder.preview-html {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
  border-color: #3b82f6;
}

.preview-template-call {
  border: 2px dashed #d1d5db;
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 0.5rem;
  background: #f9fafb;
}

[data-preview-condition] {
  position: relative;
}

[data-preview-condition]::before {
  content: attr(data-preview-condition);
  position: absolute;
  top: -0.5rem;
  left: 0.5rem;
  font-size: 0.625rem;
  background: #8b5cf6;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: monospace;
  opacity: 0.7;
}

.preview-foreach {
  position: relative;
  outline: 1px dashed #10b981;
  outline-offset: 2px;
}
```

---

### Phase 3: Hot Reload Integration

**Goal:** Automatically refresh preview when files are saved.

#### 3.1 Create File Watch Hook

```typescript
// hooks/use-preview-hot-reload.ts

import { useEffect, useRef } from 'react';
import { useEditorStore, useSyncStore } from '@/lib/stores';

interface UsePreviewHotReloadOptions {
  debounceMs?: number;
  onReload?: () => void;
}

export function usePreviewHotReload(options: UsePreviewHotReloadOptions = {}) {
  const { debounceMs = 500, onReload } = options;
  const { fileContents } = useEditorStore();
  const { isConnected } = useSyncStore();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousContentsRef = useRef<string>('');

  useEffect(() => {
    // Create hash of current contents
    const currentHash = JSON.stringify(fileContents);

    // Skip if no change
    if (currentHash === previousContentsRef.current) {
      return;
    }

    previousContentsRef.current = currentHash;

    // Debounce reload
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onReload?.();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fileContents, debounceMs, onReload]);

  return {
    isWatching: true,
    isConnected,
  };
}
```

#### 3.2 WebSocket Live Reload Channel

```typescript
// lib/preview/live-reload-channel.ts

/**
 * WebSocket channel for live reload notifications
 */
export class LiveReloadChannel {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Set<(event: LiveReloadEvent) => void> = new Set();

  constructor(private baseUrl: string) {}

  connect(): void {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws/preview-reload';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[LiveReload] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveReloadEvent;
        this.notifyListeners(data);
      } catch (e) {
        console.error('[LiveReload] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[LiveReload] Disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[LiveReload] Error:', error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[LiveReload] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => this.connect(), delay);
  }

  subscribe(listener: (event: LiveReloadEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: LiveReloadEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

interface LiveReloadEvent {
  type: 'file-changed' | 'deploy-complete' | 'error';
  path?: string;
  timestamp: number;
}
```

---

### Phase 4: Visual Enhancements

**Goal:** Add lovable.dev-quality visual features.

#### 4.1 Responsive Breakpoint Indicator

```typescript
// components/preview/BreakpointIndicator.tsx

interface BreakpointIndicatorProps {
  width: number;
}

const BREAKPOINTS = [
  { name: 'xs', min: 0, max: 575, color: '#ef4444' },
  { name: 'sm', min: 576, max: 767, color: '#f97316' },
  { name: 'md', min: 768, max: 991, color: '#eab308' },
  { name: 'lg', min: 992, max: 1199, color: '#22c55e' },
  { name: 'xl', min: 1200, max: 1399, color: '#3b82f6' },
  { name: 'xxl', min: 1400, max: Infinity, color: '#8b5cf6' },
];

export function BreakpointIndicator({ width }: BreakpointIndicatorProps) {
  const current = BREAKPOINTS.find(bp => width >= bp.min && width <= bp.max);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="px-2 py-0.5 rounded-full font-mono"
        style={{ backgroundColor: current?.color, color: 'white' }}
      >
        {current?.name}
      </span>
      <span className="text-muted-foreground">
        {width}px
      </span>
    </div>
  );
}
```

#### 4.2 Element Inspector Overlay

```typescript
// components/preview/ElementInspector.tsx

interface ElementInspectorProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  enabled: boolean;
  onSelect?: (element: ElementInfo) => void;
}

interface ElementInfo {
  tagName: string;
  classes: string[];
  id?: string;
  rect: DOMRect;
  styles: CSSStyleDeclaration;
}

export function ElementInspector({ iframeRef, enabled, onSelect }: ElementInspectorProps) {
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);

  useEffect(() => {
    if (!enabled || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target === doc.body || target === doc.documentElement) return;

      setHoveredElement({
        tagName: target.tagName.toLowerCase(),
        classes: Array.from(target.classList),
        id: target.id || undefined,
        rect: target.getBoundingClientRect(),
        styles: getComputedStyle(target),
      });
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      if (hoveredElement) {
        setSelectedElement(hoveredElement);
        onSelect?.(hoveredElement);
      }
    };

    doc.addEventListener('mousemove', handleMouseMove);
    doc.addEventListener('click', handleClick);

    return () => {
      doc.removeEventListener('mousemove', handleMouseMove);
      doc.removeEventListener('click', handleClick);
    };
  }, [enabled, iframeRef, hoveredElement, onSelect]);

  if (!enabled || !hoveredElement) return null;

  return (
    <>
      {/* Hover highlight */}
      <div
        className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 z-50"
        style={{
          left: hoveredElement.rect.left,
          top: hoveredElement.rect.top,
          width: hoveredElement.rect.width,
          height: hoveredElement.rect.height,
        }}
      />

      {/* Element info tooltip */}
      <div
        className="absolute z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg"
        style={{
          left: hoveredElement.rect.left,
          top: hoveredElement.rect.top - 24,
        }}
      >
        <span className="text-blue-400">{hoveredElement.tagName}</span>
        {hoveredElement.id && <span className="text-green-400">#{hoveredElement.id}</span>}
        {hoveredElement.classes.length > 0 && (
          <span className="text-yellow-400">.{hoveredElement.classes.slice(0, 2).join('.')}</span>
        )}
      </div>
    </>
  );
}
```

#### 4.3 Preview Error Boundary

```typescript
// components/preview/PreviewErrorBoundary.tsx

interface PreviewErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

export function PreviewErrorBoundary({ children, onError }: PreviewErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Only catch errors from preview iframe
      if (event.filename?.includes('blob:')) {
        setError(new Error(event.message));
        onError?.(new Error(event.message));
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [onError]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-red-50">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="font-semibold text-red-900 mb-2">Preview Error</h3>
        <p className="text-sm text-red-700 mb-4 text-center max-w-md">
          {error.message}
        </p>
        <Button variant="outline" onClick={() => setError(null)}>
          Dismiss
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

### Phase 5: Odoo Snippet Simulation

**Goal:** Render Odoo website builder snippets in standalone preview.

#### 5.1 Create Snippet Registry

```typescript
// lib/preview/snippet-registry.ts

interface SnippetDefinition {
  id: string;
  name: string;
  category: 'structure' | 'content' | 'feature' | 'dynamic';
  html: string;
  scss?: string;
  thumbnail?: string;
}

/**
 * Registry of common Odoo snippets for preview simulation
 */
export const SNIPPET_REGISTRY: Record<string, SnippetDefinition> = {
  s_banner: {
    id: 's_banner',
    name: 'Banner',
    category: 'structure',
    html: `
      <section class="s_banner pt96 pb96" data-snippet="s_banner">
        <div class="container">
          <div class="row">
            <div class="col-lg-6">
              <h1>Welcome to Our Website</h1>
              <p class="lead">Your amazing tagline goes here</p>
              <a href="#" class="btn btn-primary btn-lg">Get Started</a>
            </div>
          </div>
        </div>
      </section>
    `,
  },
  s_three_columns: {
    id: 's_three_columns',
    name: 'Three Columns',
    category: 'content',
    html: `
      <section class="s_three_columns pt48 pb48" data-snippet="s_three_columns">
        <div class="container">
          <div class="row">
            <div class="col-lg-4 text-center">
              <i class="fa fa-3x fa-star mb-3"></i>
              <h4>Feature One</h4>
              <p>Description of the first feature.</p>
            </div>
            <div class="col-lg-4 text-center">
              <i class="fa fa-3x fa-heart mb-3"></i>
              <h4>Feature Two</h4>
              <p>Description of the second feature.</p>
            </div>
            <div class="col-lg-4 text-center">
              <i class="fa fa-3x fa-rocket mb-3"></i>
              <h4>Feature Three</h4>
              <p>Description of the third feature.</p>
            </div>
          </div>
        </div>
      </section>
    `,
  },
  // Add more snippets...
};

/**
 * Replace snippet placeholders with actual HTML
 */
export function resolveSnippets(html: string): string {
  // Replace t-snippet calls
  const snippetRegex = /<t\s+t-snippet="([^"]+)"[^>]*\/>/g;

  return html.replace(snippetRegex, (match, snippetId) => {
    const snippet = SNIPPET_REGISTRY[snippetId];
    return snippet?.html || `<!-- Unknown snippet: ${snippetId} -->`;
  });
}
```

---

## Updated PreviewPanel Component

```typescript
// components/preview/PreviewPanel.tsx (enhanced version)

export function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('standalone');
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [iframeWidth, setIframeWidth] = useState(0);

  const { fileContents } = useEditorStore();
  const { isStreaming, partialHtml, partialCss } = useStreamingPreview();

  // Hot reload integration
  usePreviewHotReload({
    debounceMs: 500,
    onReload: () => {
      if (iframeRef.current && previewMode === 'standalone') {
        // Force re-render
        const html = generatePreviewHtml(fileContents);
        iframeRef.current.srcdoc = html;
      }
    },
  });

  // Generate preview HTML with streaming support
  const previewHtml = useMemo(() => {
    if (isStreaming && partialHtml) {
      // Use streaming content during generation
      return generatePreviewHtml({
        'streaming/preview.xml': partialHtml,
        'streaming/preview.scss': partialCss,
      });
    }
    return generatePreviewHtml(fileContents);
  }, [fileContents, isStreaming, partialHtml, partialCss]);

  // Track iframe width for breakpoint indicator
  useEffect(() => {
    if (!iframeRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIframeWidth(entry.contentRect.width);
      }
    });

    observer.observe(iframeRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-muted/30">
        {/* Enhanced Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
          {/* ... existing toolbar items ... */}

          {/* Breakpoint Indicator */}
          <BreakpointIndicator width={iframeWidth} />

          {/* Inspector Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={inspectorEnabled ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setInspectorEnabled(!inspectorEnabled)}
              >
                <MousePointer className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Element Inspector</TooltipContent>
          </Tooltip>

          {/* Streaming Indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Streaming...</span>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative">
          <PreviewErrorBoundary>
            <DeviceFrame device={device}>
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin"
                title="Preview"
              />

              {/* Element Inspector Overlay */}
              <ElementInspector
                iframeRef={iframeRef}
                enabled={inspectorEnabled}
                onSelect={(el) => console.log('Selected:', el)}
              />
            </DeviceFrame>
          </PreviewErrorBoundary>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t">
          {/* ... status bar content ... */}
        </div>
      </div>
    </TooltipProvider>
  );
}
```

---

## File Structure

```
platxa-website-studio/
├── lib/
│   └── preview/
│       ├── streaming-preview-context.tsx    # NEW
│       ├── incremental-qweb-parser.ts       # NEW
│       ├── qweb-runtime.ts                  # NEW
│       ├── live-reload-channel.ts           # NEW
│       ├── snippet-registry.ts              # NEW
│       └── index.ts
├── hooks/
│   └── use-preview-hot-reload.ts            # NEW
├── components/
│   └── preview/
│       ├── PreviewPanel.tsx                 # ENHANCED
│       ├── DeviceFrame.tsx                  # EXISTS
│       ├── BreakpointIndicator.tsx          # NEW
│       ├── ElementInspector.tsx             # NEW
│       ├── PreviewErrorBoundary.tsx         # NEW
│       └── index.ts
└── styles/
    └── preview-placeholders.css             # NEW
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/qweb-runtime.test.ts

describe('QWebRuntime', () => {
  it('should process t-foreach correctly', () => {
    const runtime = new QWebRuntime();
    const input = '<ul><li t-foreach="items" t-as="item">Item</li></ul>';
    const output = runtime.render(input);
    expect(output).toContain('<li');
    expect((output.match(/<li/g) || []).length).toBe(3); // 3 sample items
  });

  it('should handle t-if conditions', () => {
    const runtime = new QWebRuntime();
    const input = '<div t-if="show">Content</div>';
    const output = runtime.render(input);
    expect(output).toContain('data-preview-condition');
  });

  it('should resolve t-call templates', () => {
    const runtime = new QWebRuntime();
    runtime.registerTemplate('partial', '<span>Partial</span>');
    const input = '<div><t t-call="partial"/></div>';
    const output = runtime.render(input);
    expect(output).toContain('Partial');
  });
});
```

### E2E Tests

```typescript
// e2e/preview.spec.ts

test('preview updates during streaming', async ({ page }) => {
  await page.goto('/studio/test-project');

  // Start generation
  await page.fill('[data-testid="chat-input"]', 'Create a hero section');
  await page.click('[data-testid="send-button"]');

  // Check streaming indicator appears
  await expect(page.locator('text=Streaming...')).toBeVisible();

  // Check preview updates
  await expect(page.frameLocator('iframe').locator('section')).toBeVisible({
    timeout: 10000,
  });
});

test('hot reload on file change', async ({ page }) => {
  await page.goto('/studio/test-project');

  // Edit a file
  await page.click('[data-testid="file-tree"] >> text=templates.xml');
  await page.fill('.monaco-editor textarea', '<section>New Content</section>');

  // Wait for hot reload
  await page.waitForTimeout(1000);

  // Check preview updated
  await expect(page.frameLocator('iframe').locator('text=New Content')).toBeVisible();
});
```

---

## Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Streaming latency | <200ms | Time from chunk received to preview update |
| Hot reload time | <500ms | Time from file save to preview update |
| QWeb accuracy | >90% | Correctly rendered QWeb templates |
| Error handling | 100% | All preview errors gracefully handled |
| Device frames | 3 | Mobile, tablet, desktop working |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QWeb parsing complexity | High | Start with common patterns, iterate |
| Performance with large files | Medium | Debounce updates, virtualize |
| Cross-origin iframe issues | Medium | Use srcdoc instead of blob URLs |
| Browser compatibility | Low | Test in Chrome, Firefox, Safari |

---

## Next Steps

1. Implement StreamingPreviewProvider (Phase 1.1)
2. Create IncrementalQWebParser (Phase 1.2)
3. Integrate with ChatPanel streaming (Phase 1.3)
4. Build QWebRuntime simulator (Phase 2.1)
5. Add hot reload hook (Phase 3.1)
6. Enhance PreviewPanel with new features (Phase 4)
7. Add snippet registry (Phase 5)
8. Write tests and documentation

---

*Plan created: 2026-01-23*
*Author: Claude Code Analysis*
