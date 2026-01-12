---
name: monaco-editor-integrator
description: Sets up Monaco Editor with y-monaco and Yjs for real-time collaborative editing in React/Next.js projects. Handles configuration, component scaffolding, and WebSocket synchronization.
tools: Read, Write, Grep, Glob, Bash
---

# Monaco Editor Integrator

## Overview

Integrate Monaco Editor with Yjs CRDT for real-time collaborative code editing in React applications.

**Capabilities:**
- Detect project type (Next.js, Vite, CRA) and configure appropriately
- Install and configure Monaco + y-monaco + Yjs packages
- Generate TypeScript components with proper SSR handling
- Set up WebSocket synchronization with y-websocket
- Configure custom themes matching design systems
- Handle accessibility requirements (WCAG 2.1 AA)

**Scope:**
Focuses on frontend editor integration. Does NOT set up backend WebSocket servers (use y-websocket server or custom implementation).

## Prerequisites Checklist

Before starting, verify:

- [ ] React 18+ project exists
- [ ] TypeScript configured
- [ ] Package manager available (npm/pnpm/yarn)
- [ ] Build tool configured (Next.js/Vite/Webpack)

## Workflow

### Step 1: Analyze Project

Use Read and Glob to examine project structure:

```
1. Read package.json for:
   - React version (must be 18+)
   - Existing Monaco/Yjs dependencies
   - Package manager (lockfile detection)
   - Build tool (next.config.js, vite.config.ts, etc.)

2. Glob for existing editor code:
   - **/monaco*.{ts,tsx}
   - **/editor*.{ts,tsx}
   - **/yjs*.{ts,tsx}

3. Determine framework:
   - next.config.* → Next.js
   - vite.config.* → Vite
   - react-scripts in deps → CRA
```

### Step 2: Install Dependencies

Generate installation command based on package manager:

**Core packages:**
```bash
# npm
npm install @monaco-editor/react monaco-editor yjs y-monaco y-websocket

# pnpm
pnpm add @monaco-editor/react monaco-editor yjs y-monaco y-websocket

# yarn
yarn add @monaco-editor/react monaco-editor yjs y-monaco y-websocket
```

**Optional persistence:**
```bash
npm install y-indexeddb  # Local persistence for offline support
```

**Version constraints:**
| Package | Version | Notes |
|---------|---------|-------|
| `@monaco-editor/react` | ^4.6.0 | React wrapper with hooks |
| `monaco-editor` | ^0.45.0 | Core editor |
| `yjs` | ^13.6.0 | CRDT library |
| `y-monaco` | ^0.1.6 | Monaco binding |
| `y-websocket` | ^2.1.0 | WebSocket provider (NOT v3) |

### Step 3: Configure Build Tool

**Next.js (next.config.js):**
```javascript
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['monaco-editor', 'yjs', 'y-monaco', 'y-websocket', 'y-indexeddb'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['python', 'xml', 'javascript', 'typescript', 'json', 'css', 'scss', 'markdown'],
          filename: 'static/[name].worker.js',
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
```

**Vite (vite.config.ts):**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'json', 'css', 'html', 'typescript'],
    }),
  ],
  optimizeDeps: {
    include: ['monaco-editor', 'yjs', 'y-monaco', 'y-websocket'],
  },
});
```

**CSP Headers (required for Monaco workers):**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  worker-src 'self' blob:;
  child-src 'self' blob:;
  font-src 'self' data:;
```

### Step 4: Generate Components

Create the following files in `src/features/editor/`:

**4.1 Editor Options (config/editorOptions.ts):**
```typescript
import type { editor } from 'monaco-editor';

export const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontLigatures: true,
  lineHeight: 1.6,
  minimap: {
    enabled: true,
    renderCharacters: false,
  },
  cursorStyle: 'line',
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  bracketPairColorization: { enabled: true },
  accessibilitySupport: 'auto',
  ariaLabel: 'Code editor',
};
```

**4.2 Theme Configuration (config/theme.ts):**
```typescript
import type { editor } from 'monaco-editor';

export const CUSTOM_DARK_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
    { token: 'string', foreground: '7DD3CF' },
    { token: 'keyword', foreground: 'F97583' },
    { token: 'entity.name.function', foreground: 'B392F0' },
    { token: 'variable', foreground: 'E1E4E8' },
    { token: 'constant.numeric', foreground: '2DBDB6' },
  ],
  colors: {
    'editor.background': '#171717',
    'editor.selectionBackground': '#8B5BA340',
    'editor.lineHighlightBackground': '#1f1f1f',
    'editorLineNumber.foreground': '#6b7280',
  },
};
```

**4.3 Language Mapping (config/languages.ts):**
```typescript
export const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.xml': 'xml',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.css': 'css',
  '.scss': 'scss',
  '.md': 'markdown',
  '.txt': 'plaintext',
};

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return LANGUAGE_MAP[ext] || 'plaintext';
}
```

**4.4 Yjs Provider Context (context/YjsContext.tsx):**
```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface YjsContextValue {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  connected: boolean;
}

const YjsContext = createContext<YjsContextValue>({
  doc: null,
  provider: null,
  connected: false,
});

interface YjsProviderProps {
  children: ReactNode;
  roomName: string;
  websocketUrl: string;
  token?: string;
}

export function YjsProvider({ children, roomName, websocketUrl, token }: YjsProviderProps) {
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      websocketUrl,
      roomName,
      doc,
      {
        protocols: token ? [`bearer-${token}`] : undefined,
      }
    );

    wsProvider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected');
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [doc, roomName, websocketUrl, token]);

  return (
    <YjsContext.Provider value={{ doc, provider, connected }}>
      {children}
    </YjsContext.Provider>
  );
}

export function useYjs() {
  const context = useContext(YjsContext);
  if (!context.doc) {
    throw new Error('useYjs must be used within YjsProvider');
  }
  return context;
}
```

**4.5 Monaco Editor Component (components/MonacoEditor.tsx):**
```typescript
'use client';

import { Editor, OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import type * as Monaco from 'monaco-editor';
import { useYjs } from '../context/YjsContext';
import { EDITOR_OPTIONS } from '../config/editorOptions';
import { CUSTOM_DARK_THEME } from '../config/theme';
import { getLanguageFromPath } from '../config/languages';

interface MonacoEditorProps {
  filePath: string;
  className?: string;
  readOnly?: boolean;
}

export function MonacoEditor({ filePath, className, readOnly }: MonacoEditorProps) {
  const { doc, provider } = useYjs();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register custom theme
    monaco.editor.defineTheme('custom-dark', CUSTOM_DARK_THEME);
    monaco.editor.setTheme('custom-dark');

    // Get Y.Text for this file
    if (doc && provider) {
      const yText = doc.getText(filePath);

      // Create Yjs binding
      bindingRef.current = new MonacoBinding(
        yText,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      );
    }
  };

  // Cleanup binding on unmount or file change
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [filePath]);

  const language = getLanguageFromPath(filePath);

  return (
    <Editor
      height="100%"
      language={language}
      theme="custom-dark"
      onMount={handleEditorDidMount}
      options={{
        ...EDITOR_OPTIONS,
        readOnly,
        ariaLabel: `Editing ${filePath}`,
      }}
      loading={<EditorSkeleton />}
      className={className}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="h-full w-full bg-neutral-900 animate-pulse">
      <div className="h-8 bg-neutral-800 border-b border-neutral-700" />
      <div className="flex h-[calc(100%-32px)]">
        <div className="w-12 bg-neutral-800" />
        <div className="flex-1 p-4 space-y-2">
          <div className="h-4 bg-neutral-800 rounded w-3/4" />
          <div className="h-4 bg-neutral-800 rounded w-1/2" />
          <div className="h-4 bg-neutral-800 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Verify Integration

Run verification checks:

```bash
# Type check
pnpm typecheck

# Build test
pnpm build

# Check for SSR errors (Next.js)
pnpm dev
# Open browser, check console for hydration errors
```

## Examples

### Example 1: Basic Setup for Next.js Project

**User Request:**
```
Set up Monaco with Yjs for my Next.js 14 project
```

**Agent Actions:**
1. Read package.json → Detect Next.js 14, pnpm
2. Check for existing Monaco deps → None found
3. Generate install command with pnpm
4. Create next.config.js with MonacoWebpackPlugin
5. Generate all component files
6. Provide usage example

**Output:**
```
Monaco + Yjs Integration Complete!

Files created:
  - src/features/editor/config/editorOptions.ts
  - src/features/editor/config/theme.ts
  - src/features/editor/config/languages.ts
  - src/features/editor/context/YjsContext.tsx
  - src/features/editor/components/MonacoEditor.tsx

Updated:
  - next.config.js (added Monaco webpack plugin)

To use:
  1. Run: pnpm add @monaco-editor/react monaco-editor yjs y-monaco y-websocket
  2. Wrap your app with <YjsProvider>
  3. Use <MonacoEditor filePath="/path/to/file.py" />
```

### Example 2: Adding Collaborative Cursors

**User Request:**
```
I have Monaco + Yjs working, but I want to show other users' cursors
```

**Agent Actions:**
1. Check existing MonacoBinding setup
2. Verify awareness protocol is connected
3. Generate cursor decoration component
4. Add CSS for cursor colors

**Output:**
```typescript
// Cursor awareness is automatic with y-monaco!
// The MonacoBinding already uses provider.awareness

// To customize cursor colors, update the awareness:
provider.awareness.setLocalStateField('user', {
  name: 'Alice',
  color: '#8B5BA3',
  colorLight: '#8B5BA340',
});
```

### Example 3: Upgrading from Standalone Monaco

**User Request:**
```
I have Monaco Editor already, need to add real-time sync
```

**Agent Actions:**
1. Analyze existing Monaco setup
2. Identify what needs to change
3. Generate migration steps
4. Preserve custom configurations

**Output:**
```
Migration Plan:

1. Add packages: yjs, y-monaco, y-websocket
2. Keep your existing EDITOR_OPTIONS
3. Wrap Editor component with YjsProvider
4. Add MonacoBinding after editor mount
5. Replace editor.setValue() with yText operations

Your custom theme will be preserved.
```

## Troubleshooting

### Monaco Not Loading (SSR Error)

**Symptom:** `window is not defined` or hydration mismatch

**Solution:** Ensure component has `'use client'` directive and Monaco is not imported on server:
```typescript
'use client';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(
  () => import('./MonacoEditor').then(mod => mod.MonacoEditor),
  { ssr: false }
);
```

### Workers Not Loading

**Symptom:** Syntax highlighting not working

**Solution:** Check webpack plugin configuration and CSP headers:
```
worker-src 'self' blob:;
script-src 'self' 'wasm-unsafe-eval';
```

### Yjs Not Syncing

**Symptom:** Changes not appearing in other clients

**Solution:**
1. Verify WebSocket URL is correct
2. Check provider.connected status
3. Ensure both clients use same roomName
4. Check WebSocket server logs

### WebSocket Connection Failures

**Symptom:** Connection drops or fails to establish

**Solution:** Implement retry logic with exponential backoff:
```typescript
'use client';

import { useCallback, useRef, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

export function useWebSocketWithRetry(
  doc: Y.Doc,
  websocketUrl: string,
  roomName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    setConnectionState('connecting');

    try {
      const provider = new WebsocketProvider(websocketUrl, roomName, doc);
      providerRef.current = provider;

      provider.on('status', ({ status }: { status: string }) => {
        if (status === 'connected') {
          setConnectionState('connected');
          setRetryCount(0); // Reset on successful connection
        }
      });

      provider.on('connection-close', () => {
        if (retryCount < config.maxRetries) {
          const delay = Math.min(
            config.baseDelay * Math.pow(2, retryCount),
            config.maxDelay
          );
          setConnectionState('disconnected');
          setRetryCount(prev => prev + 1);

          timeoutRef.current = setTimeout(connect, delay);
        } else {
          setConnectionState('error');
        }
      });
    } catch (error) {
      setConnectionState('error');
    }
  }, [doc, websocketUrl, roomName, retryCount, config]);

  const disconnect = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    providerRef.current?.destroy();
    setConnectionState('disconnected');
  }, []);

  return { connectionState, retryCount, connect, disconnect, provider: providerRef.current };
}
```

### Bundle Size Too Large

**Symptom:** Initial load > 5MB

**Solution:**
```javascript
// Only include needed languages in webpack plugin
new MonacoWebpackPlugin({
  languages: ['python', 'xml', 'javascript'],  // Remove unused
  features: ['!gotoSymbol', '!quickOutline'],  // Disable unused features
})
```

## Output Format

### Success Case

When integration is complete successfully:

```
Monaco + Yjs Integration Report
================================

Status: SUCCESS

Files Created:
  - {path}: {description}
  - {path}: {description}

Files Modified:
  - {path}: {changes}

Dependencies to Install:
  {install command}

Verification Steps:
  1. {step}
  2. {step}

Usage Example:
  {code snippet}

Next Steps:
  - {recommendation}
```

### Failure Cases

When integration fails, provide detailed error information:

```
Monaco + Yjs Integration Report
================================

Status: FAILURE

Error Code: {ERROR_CODE}
Error Message: {detailed message}

Root Cause:
  {explanation of why the error occurred}

Failed At:
  Step: {step name}
  File: {file path if applicable}

Attempted Actions:
  - {action 1}: {result}
  - {action 2}: {result}

Resolution Steps:
  1. {specific fix step}
  2. {verification step}

Alternative Approaches:
  - {alternative 1}
  - {alternative 2}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `PROJECT_NOT_FOUND` | Could not locate package.json |
| `PACKAGE_JSON_NOT_FOUND` | package.json exists but is invalid |
| `UNSUPPORTED_PROJECT_TYPE` | Project type not supported |
| `REACT_VERSION_INCOMPATIBLE` | React version < 17 |
| `EXISTING_MONACO_CONFLICT` | Incompatible Monaco version exists |
| `CONFIG_GENERATION_FAILED` | Could not generate build config |
| `TEMPLATE_GENERATION_FAILED` | Could not generate components |
| `VALIDATION_FAILED` | TypeScript or build errors |

### Partial Success

When some operations succeed but others fail:

```
Monaco + Yjs Integration Report
================================

Status: PARTIAL

Completed:
  ✓ Project analysis
  ✓ Dependency installation command generated
  ✓ Build configuration created

Failed:
  ✗ Component generation: {reason}

Files Created:
  - {path}: {description}

Remaining Steps:
  1. {manual step required}
  2. {manual step required}

To Complete Integration:
  {specific instructions}
```

## Configuration Reference

### Package Versions (as of 2025)

| Package | Recommended | Notes |
|---------|-------------|-------|
| @monaco-editor/react | ^4.6.0 | React 18 compatible |
| monaco-editor | ^0.45.0 | Latest stable |
| yjs | ^13.6.0 | CRDT core |
| y-monaco | ^0.1.6 | Monaco binding |
| y-websocket | ^2.1.0 | **Use v2.x, NOT v3** |
| y-indexeddb | ^9.0.0 | Optional persistence |

### Supported Languages

Python, XML, JavaScript, TypeScript, JSON, CSS, SCSS, Markdown, HTML, YAML

### Browser Support

Chrome 100+, Firefox 100+, Safari 16+, Edge 100+

## Performance Considerations

### Bundle Size Optimization

Monaco Editor adds ~2-3MB (gzipped) to your bundle. Optimization strategies:

**1. Code Splitting (Required)**
```typescript
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(
  () => import('./MonacoEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);
```

**2. Language Subsetting**
Only include languages you need:
```javascript
new MonacoWebpackPlugin({
  languages: ['typescript', 'json'],  // Only needed languages
})
```

**3. Feature Removal**
Disable unused features:
```javascript
new MonacoWebpackPlugin({
  features: [
    '!accessibilityHelp',
    '!anchorSelect',
    '!bracketMatching',
    '!caretOperations',
    '!clipboard',
    '!codeAction',
    '!codelens',
    '!colorPicker',
    '!comment',
    '!contextmenu',
    '!coreCommands',
    '!cursorUndo',
    '!dnd',
    '!documentSymbols',
    '!find',
    '!folding',
    '!fontZoom',
    '!format',
    '!gotoError',
    '!gotoLine',
    '!gotoSymbol',
    '!hover',
    '!iPadShowKeyboard',
    '!inPlaceReplace',
    '!indentation',
    '!inlayHints',
    '!inlineCompletions',
    '!inspectTokens',
    '!linesOperations',
    '!linkedEditing',
    '!links',
    '!multicursor',
    '!parameterHints',
    '!quickCommand',
    '!quickHelp',
    '!quickOutline',
    '!referenceSearch',
    '!rename',
    '!smartSelect',
    '!snippets',
    '!suggest',
    '!toggleHighContrast',
    '!toggleTabFocusMode',
    '!transpose',
    '!unusualLineTerminators',
    '!wordHighlighter',
    '!wordOperations',
    '!wordPartOperations',
  ],
})
```

### Large File Handling

Files over 1MB require special handling:

```typescript
const LARGE_FILE_THRESHOLD = 1024 * 1024; // 1MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getEditorOptionsForFileSize(sizeBytes: number) {
  if (sizeBytes > MAX_FILE_SIZE) {
    return { readOnly: true }; // Block editing very large files
  }

  if (sizeBytes > LARGE_FILE_THRESHOLD) {
    return {
      minimap: { enabled: false },
      folding: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
      quickSuggestions: false,
      parameterHints: { enabled: false },
      suggestOnTriggerCharacters: false,
      largeFileOptimizations: true,
    };
  }

  return {}; // Default options
}
```

### Memory Management

Prevent memory leaks with proper cleanup:

```typescript
useEffect(() => {
  const binding = new MonacoBinding(yText, model, editors, awareness);

  return () => {
    binding.destroy();
    // Don't destroy Y.Doc here if shared across components
  };
}, [yText, model]);
```

## Rate Limits and Connection Management

### WebSocket Connection Limits

**Recommended Limits:**
| Setting | Value | Reason |
|---------|-------|--------|
| Max connections per user | 5 | Prevents resource exhaustion |
| Max rooms per connection | 10 | Memory management |
| Reconnection max retries | 5 | Prevents infinite loops |
| Reconnection base delay | 1000ms | Allows server recovery |
| Reconnection max delay | 30000ms | Caps backoff time |

### Connection State Management

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface ConnectionConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.25,
};

function calculateBackoffDelay(attempt: number, config: ConnectionConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const jitter = exponentialDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}
```

### Handling Disconnections

```typescript
provider.on('connection-close', (event) => {
  // Check if intentional disconnect
  if (event.code === 1000) {
    return; // Normal closure, don't retry
  }

  // Server errors - retry with backoff
  if (event.code >= 1001 && event.code <= 1015) {
    scheduleReconnect();
  }

  // Application errors - may need user action
  if (event.code >= 4000) {
    showUserNotification('Connection lost. Please refresh.');
  }
});

provider.on('connection-error', (error) => {
  console.error('WebSocket error:', error);
  // Network errors are usually transient - retry
  scheduleReconnect();
});
```

### User Feedback

Always show connection status to users:

```typescript
function ConnectionStatus({ state }: { state: ConnectionState }) {
  const statusConfig = {
    connected: { color: 'green', text: 'Connected' },
    connecting: { color: 'yellow', text: 'Connecting...' },
    reconnecting: { color: 'orange', text: 'Reconnecting...' },
    disconnected: { color: 'gray', text: 'Offline' },
    error: { color: 'red', text: 'Connection Error' },
  };

  const config = statusConfig[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full bg-${config.color}-500`} />
      <span className="text-sm">{config.text}</span>
    </div>
  );
}
```
