# Troubleshooting

This guide covers common issues when integrating Monaco Editor with Yjs and their solutions.

## Table of Contents

- [SSR and Hydration Errors](#ssr-and-hydration-errors)
- [Monaco Worker Issues](#monaco-worker-issues)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Bundle Size](#bundle-size)
- [Yjs Sync Issues](#yjs-sync-issues)
- [WebSocket Connection](#websocket-connection)
- [TypeScript Errors](#typescript-errors)
- [Performance Issues](#performance-issues)

---

## SSR and Hydration Errors

### Error: `window is not defined`

**Cause**: Monaco Editor accesses browser APIs during import, which fails during SSR.

**Solution for Next.js**:

```tsx
'use client';

import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }
);

export default function EditorPage() {
  return <MonacoEditor height="400px" language="typescript" />;
}
```

**Solution for Vite/React**:

```tsx
import { lazy, Suspense } from 'react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export default function EditorPage() {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <MonacoEditor height="400px" language="typescript" />
    </Suspense>
  );
}
```

### Error: `Hydration failed because the initial UI does not match`

**Cause**: Server and client render different content.

**Solution**: Ensure Monaco is only rendered on the client:

```tsx
'use client';

import { useState, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';

export default function Editor() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="editor-skeleton">Loading...</div>;
  }

  return <MonacoEditor height="400px" language="typescript" />;
}
```

---

## Monaco Worker Issues

### Error: `Could not create web worker(s)`

**Cause**: Monaco workers aren't being loaded correctly. This usually happens when the worker files aren't properly configured in your bundler.

**Solution for Next.js** (next.config.js):

```javascript
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['typescript', 'javascript', 'json', 'css', 'html'],
          filename: 'static/[name].worker.js',
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
```

**Solution for Vite** (vite.config.ts):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html'],
    }),
  ],
  optimizeDeps: {
    include: ['monaco-editor'],
  },
});
```

### Error: `Worker not found at /static/ts.worker.js`

**Cause**: Worker files are being served from the wrong path.

**Solution**: Check the `publicPath` configuration:

```javascript
// Next.js
new MonacoWebpackPlugin({
  languages: ['typescript'],
  publicPath: '/_next/', // Match Next.js output
  filename: 'static/[name].worker.js',
})
```

### Workers Loading Twice

**Cause**: Multiple MonacoWebpackPlugin instances or incorrect configuration.

**Solution**: Ensure only one plugin instance in your config:

```javascript
// next.config.js
webpack: (config, { isServer }) => {
  if (!isServer) {
    // Remove any existing Monaco plugins first
    config.plugins = config.plugins.filter(
      (plugin) => plugin.constructor.name !== 'MonacoWebpackPlugin'
    );

    config.plugins.push(new MonacoWebpackPlugin({
      // your config
    }));
  }
  return config;
}
```

---

## Content Security Policy (CSP)

### Error: `Refused to execute script because it violates the following CSP directive`

**Cause**: Monaco uses `eval()` for WASM and blob URLs for workers.

**Required CSP Directives**:

```
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
style-src 'self' 'unsafe-inline';
```

**Solution for Next.js** (middleware.ts):

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: '/:path*',
};
```

**Solution for meta tag** (when middleware isn't available):

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline';"
/>
```

---

## Bundle Size

### Large Initial Bundle (>2MB)

**Cause**: Monaco Editor includes all languages and features by default.

**Solution 1: Language Subsetting**

Only include the languages you need:

```javascript
// webpack.config.js or next.config.js
new MonacoWebpackPlugin({
  languages: ['typescript', 'javascript', 'json'], // Only these languages
})
```

```typescript
// vite.config.ts
monacoEditorPlugin({
  languageWorkers: ['typescript', 'json'], // Only these workers
})
```

**Solution 2: Lazy Loading**

Load Monaco only when needed:

```tsx
import { lazy, Suspense, useState } from 'react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export default function App() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>Open Editor</button>
      {showEditor && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <MonacoEditor height="400px" />
        </Suspense>
      )}
    </div>
  );
}
```

**Solution 3: Feature Reduction**

Disable unused features:

```tsx
<MonacoEditor
  options={{
    minimap: { enabled: false },
    folding: false,
    lineNumbers: 'off',
    glyphMargin: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
  }}
/>
```

---

## Yjs Sync Issues

### Error: `Y.Doc is already destroyed`

**Cause**: Accessing a Y.Doc after calling `doc.destroy()`.

**Solution**: Proper cleanup in useEffect:

```typescript
useEffect(() => {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(url, roomName, doc);

  return () => {
    provider.disconnect();
    provider.destroy();
    doc.destroy();
  };
}, [url, roomName]);
```

### Sync Conflicts / Duplicate Content

**Cause**: Multiple MonacoBinding instances for the same document.

**Solution**: Ensure single binding per editor:

```typescript
useEffect(() => {
  if (!editor || !yText) return;

  const binding = new MonacoBinding(
    yText,
    editor.getModel()!,
    new Set([editor]),
    provider?.awareness
  );

  return () => {
    binding.destroy();
  };
}, [editor, yText, provider]);
```

### Content Not Syncing

**Cause**: Y.Text not properly connected to provider.

**Solution**: Verify document structure:

```typescript
// Correct: Get text from connected Y.Doc
const yDoc = new Y.Doc();
const provider = new WebsocketProvider(url, room, yDoc);
const yText = yDoc.getText('monaco'); // Must use same key everywhere

// Incorrect: Creating text before connection
const yText = new Y.Text(); // This won't sync!
```

---

## WebSocket Connection

### Error: `WebSocket connection failed`

**Cause**: Server not running, wrong URL, or CORS issues.

**Solution 1: Verify server is running**

```bash
# Check if y-websocket server is accessible
curl -I ws://localhost:1234
```

**Solution 2: Add retry logic**

```typescript
const MAX_RETRIES = 10;
const BASE_DELAY = 1000;

function createProviderWithRetry(url: string, room: string, doc: Y.Doc) {
  let retries = 0;

  const provider = new WebsocketProvider(url, room, doc, {
    connect: true,
    maxBackoffTime: 10000,
  });

  provider.on('status', ({ status }: { status: string }) => {
    if (status === 'disconnected' && retries < MAX_RETRIES) {
      retries++;
      const delay = BASE_DELAY * Math.pow(2, retries);
      console.log(`Reconnecting in ${delay}ms (attempt ${retries})`);
      setTimeout(() => provider.connect(), delay);
    }
  });

  return provider;
}
```

**Solution 3: Check CORS configuration**

Your y-websocket server needs proper CORS headers:

```javascript
// y-websocket server configuration
const wss = new WebSocketServer({
  port: 1234,
  verifyClient: (info, callback) => {
    // Allow connections from your domain
    const origin = info.origin || info.req.headers.origin;
    const allowed = ['http://localhost:3000', 'https://yourdomain.com'];
    callback(allowed.includes(origin));
  },
});
```

### Connection Dropping Frequently

**Cause**: Network issues or server timeout configuration.

**Solution**: Implement heartbeat/ping:

```typescript
const provider = new WebsocketProvider(url, room, doc, {
  connect: true,
});

// Send periodic awareness updates as heartbeat
setInterval(() => {
  if (provider.wsconnected) {
    provider.awareness.setLocalStateField('lastActive', Date.now());
  }
}, 30000);
```

---

## TypeScript Errors

### Error: `Cannot find module 'monaco-editor'`

**Solution**: Install type definitions:

```bash
npm install --save-dev @types/monaco-editor
# or
pnpm add -D @types/monaco-editor
```

### Error: `Property 'monaco' does not exist on type 'Window'`

**Solution**: Add type declaration:

```typescript
// types/monaco.d.ts
import type * as Monaco from 'monaco-editor';

declare global {
  interface Window {
    monaco: typeof Monaco;
  }
}

export {};
```

### Error: `Type 'IStandaloneCodeEditor' is not assignable`

**Cause**: Type mismatch between @monaco-editor/react and monaco-editor types.

**Solution**: Use the correct import:

```typescript
import type { editor } from 'monaco-editor';

const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
  // editor is correctly typed
};
```

---

## Performance Issues

### Slow Initial Load

**Cause**: Monaco loads all features synchronously.

**Solution**: Use `@monaco-editor/react`'s built-in loader:

```tsx
import { loader } from '@monaco-editor/react';

// Configure Monaco to load from CDN (faster than bundling)
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
  },
});
```

### Typing Lag in Large Files

**Cause**: Monaco recalculates layout on every keystroke.

**Solution**: Optimize for large files:

```tsx
<MonacoEditor
  options={{
    // Disable expensive features for large files
    renderWhitespace: 'none',
    renderControlCharacters: false,
    guides: { indentation: false },
    folding: false,
    links: false,
    minimap: { enabled: false },

    // Reduce validation frequency
    quickSuggestions: false,
    parameterHints: { enabled: false },

    // Optimize rendering
    smoothScrolling: false,
    mouseWheelScrollSensitivity: 1,
  }}
/>
```

### Memory Leak

**Cause**: Editor instances not being disposed.

**Solution**: Proper cleanup:

```typescript
useEffect(() => {
  return () => {
    // Clean up editor instance
    if (editorRef.current) {
      editorRef.current.dispose();
    }
  };
}, []);
```

---

## Getting Help

If your issue isn't covered here:

1. Check the [Monaco Editor Issues](https://github.com/microsoft/monaco-editor/issues)
2. Check the [y-monaco Issues](https://github.com/yjs/y-monaco/issues)
3. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/monaco-editor)
4. File an issue on this repository with:
   - Your build tool (Next.js version, Vite version)
   - Package versions (`package.json` dependencies)
   - Error message and stack trace
   - Minimal reproduction code
