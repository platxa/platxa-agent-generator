# Architecture

This document describes the package structure and design decisions for `@platxa/monaco-editor-integrator`.

## Design Philosophy

### Template Generators vs Runtime Code

This package generates code rather than providing runtime components. This design choice was made for several reasons:

1. **Zero Runtime Dependencies**: Generated code has no dependency on this package at runtime, reducing bundle size
2. **Full Customization**: Users can modify generated code to fit their specific needs
3. **Framework Agnostic**: Templates can target different React versions, TypeScript configurations, and styling approaches
4. **No Version Lock-in**: Projects aren't coupled to this package's release cycle
5. **Transparency**: Users see exactly what code is running in their application

### Agent-First Approach

The primary interface is a Claude Code agent that:
- Analyzes the target project to detect build tools, package managers, and existing dependencies
- Generates appropriate configurations and components based on project structure
- Handles edge cases like SSR, worker loading, and CSP headers
- Provides troubleshooting guidance when issues arise

## Package Structure

```
@platxa/monaco-editor-integrator/
├── src/
│   ├── index.ts              # Main entry point, re-exports all modules
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── utils/
│   │   ├── index.ts          # Barrel export
│   │   ├── detectPackageManager.ts
│   │   ├── detectBuildTool.ts
│   │   ├── detectReactVersion.ts
│   │   ├── detectExistingMonaco.ts
│   │   └── __tests__/        # Unit tests
│   ├── generators/
│   │   ├── index.ts          # Barrel export
│   │   ├── nextjsConfig.ts   # Next.js config generation
│   │   ├── viteConfig.ts     # Vite config generation
│   │   └── cspHeaders.ts     # CSP header generation
│   └── templates/
│       ├── index.ts          # Barrel export
│       ├── MonacoEditor.ts   # Editor component template
│       ├── YjsProvider.ts    # Context provider template
│       ├── useYjsDocument.ts # Document hook template
│       ├── useMonacoBinding.ts
│       ├── editorOptions.ts
│       ├── theme.ts
│       ├── languages.ts
│       ├── errorHandling.ts  # Error handling templates
│       └── performance.ts    # Performance optimization templates
├── .claude/
│   ├── agents/
│   │   └── monaco-editor-integrator.md
│   └── commands/
│       └── platxa-monaco-editor-agent.md
├── package.json
├── tsconfig.json
└── README.md
```

## Module Responsibilities

### `src/types/`

Defines TypeScript interfaces used throughout the package:

| Type | Purpose |
|------|---------|
| `PackageManager` | Union type: npm, pnpm, yarn, bun |
| `BuildTool` | Union type: nextjs, vite, cra, webpack, unknown |
| `ProjectType` | Union type: react, nextjs, vite-react, cra, unknown |
| `EditorOptions` | Monaco editor configuration interface |
| `YjsProviderConfig` | WebSocket provider configuration |
| `MonacoBindingOptions` | y-monaco binding options |
| `AwarenessState` | Cursor/selection awareness state |

### `src/utils/`

Project detection utilities that analyze the target project:

| Module | Function | Purpose |
|--------|----------|---------|
| `detectPackageManager` | `detectPackageManager()` | Identifies npm/pnpm/yarn/bun from lockfiles |
| | `detectLockfile()` | Checks for specific lockfile presence |
| | `getInstallCommand()` | Generates install command for detected manager |
| `detectBuildTool` | `detectBuildTool()` | Identifies Next.js/Vite/CRA/Webpack |
| | `detectProjectType()` | Combines build tool + React detection |
| | `isAppRouter()` | Checks for Next.js App Router |
| `detectReactVersion` | `detectReactVersion()` | Parses React version from package.json |
| | `analyzeReactCompatibility()` | Checks hooks/concurrent feature support |
| `detectExistingMonaco` | `analyzeMonacoIntegration()` | Comprehensive Monaco/Yjs dependency check |
| | `checkVersionConflicts()` | Identifies version incompatibilities |

**Detection Algorithm**: Config files are checked first (strongest signal), then package.json dependencies. This ensures `vite.config.ts` takes priority over a `next` dependency.

### `src/generators/`

Build configuration generators:

| Module | Output |
|--------|--------|
| `nextjsConfig` | `next.config.js` / `next.config.mjs` with MonacoWebpackPlugin |
| `viteConfig` | `vite.config.ts` with vite-plugin-monaco-editor |
| `cspHeaders` | Content Security Policy headers for Monaco workers |

**CSP Requirements**: Monaco Editor requires specific CSP directives:
- `script-src 'wasm-unsafe-eval'` - For WASM execution
- `worker-src blob:` - For Web Workers loaded from blobs

### `src/templates/`

Code generation templates for React components:

| Template | Output |
|----------|--------|
| `MonacoEditor` | Main editor component with `'use client'` directive |
| `YjsProvider` | React context provider with WebSocket connection management |
| `useYjsDocument` | Hook for per-file Y.Doc lifecycle |
| `useMonacoBinding` | Hook for MonacoBinding creation/cleanup |
| `editorOptions` | Default editor configuration presets |
| `theme` | Dark/light theme definitions |
| `languages` | File extension to Monaco language mapping |
| `errorHandling` | WebSocket retry, error boundary, conflict resolution |
| `performance` | Lazy loading wrapper, large file handling |

**Template Options**: Each template accepts options for:
- `typescript: boolean` - Generate TypeScript or JavaScript
- `componentName: string` - Custom component name
- `includeYjs: boolean` - Include Yjs integration
- `includeAwareness: boolean` - Include cursor awareness

## Key Design Decisions

### 1. Per-File Y.Doc Model

Each file gets its own Y.Doc and Y.Text instance:

```typescript
// Document structure
const yDoc = new Y.Doc();
const yText = yDoc.getText('content');

// Binding per file
const binding = new MonacoBinding(
  yText,
  editor.getModel()!,
  new Set([editor]),
  provider.awareness
);
```

**Rationale**: This allows independent sync status per file, prevents large document overhead, and enables efficient garbage collection when files are closed.

### 2. WebSocket Provider Architecture

Uses `y-websocket` v2.x (NOT v3) for synchronization:

```typescript
const provider = new WebsocketProvider(
  websocketUrl,
  `doc:${documentId}`,
  yDoc,
  { connect: true }
);
```

**Why v2**: The v2 API is stable and widely deployed. v3 has breaking changes and is still in development.

### 3. SSR Handling

Monaco Editor doesn't support SSR. The generated components handle this with:

```tsx
'use client';

import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }
);
```

**Rationale**: Explicit client-side rendering prevents hydration mismatches and ensures workers load correctly.

### 4. Error Handling Strategy

Three-layer error handling:

1. **WebSocket Retry**: Exponential backoff with jitter for connection failures
2. **Error Boundary**: React error boundary catches Monaco loading errors
3. **Conflict Resolution**: CRDT merge handling for concurrent edits

```typescript
// Exponential backoff calculation
const delay = baseDelay * Math.pow(2, attempt);
const jitter = delay * 0.25 * (Math.random() * 2 - 1);
return Math.min(delay + jitter, maxDelay);
```

### 5. Bundle Optimization

Monaco Editor is large (~2MB). Optimization strategies:

1. **Language Subsetting**: Only include needed languages
2. **Feature Removal**: Disable unused features (minimap, folding, etc.)
3. **Dynamic Import**: Load Monaco only when needed
4. **Worker Optimization**: Use shared workers when possible

## Testing Strategy

Unit tests cover project detection utilities using temporary directories:

```typescript
beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monaco-test-'));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});
```

**Coverage Targets**:
- Project detection: >80% coverage
- Config generators: Syntax validation
- Templates: TypeScript compilation check

## Future Considerations

### Potential Enhancements

1. **MCP Integration**: Direct file writing via MCP filesystem tools
2. **Migration Support**: Upgrade paths from older Monaco versions
3. **Testing Templates**: Jest/Vitest test file generation
4. **Storybook Stories**: Component documentation templates

### Non-Goals

1. **Runtime Library**: This package generates code, not runtime dependencies
2. **Opinionated Styling**: Generated code uses minimal styling
3. **Backend Integration**: Yjs server setup is out of scope

## References

- [Monaco Editor Webpack Plugin](https://github.com/microsoft/monaco-editor/tree/main/webpack-plugin)
- [y-monaco](https://github.com/yjs/y-monaco)
- [Yjs Awareness Protocol](https://docs.yjs.dev/api/about-awareness)
- [Anthropic Building Effective Agents](https://anthropic.com/research/building-effective-agents)
