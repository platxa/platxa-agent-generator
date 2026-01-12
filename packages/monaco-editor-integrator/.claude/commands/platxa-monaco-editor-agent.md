---
name: platxa-monaco-editor-agent
description: Set up Monaco Editor with Yjs for real-time collaborative editing
---

# Monaco Editor Integrator Agent

Set up Monaco Editor with y-monaco and Yjs for real-time collaborative code editing.

## Usage

```
/platxa-monaco-editor-agent [options]
```

## Options

- `--minimal` - Generate minimal setup without Yjs collaboration
- `--theme <name>` - Use a specific theme (dark, light, custom)
- `--languages <list>` - Comma-separated list of languages to support

## What This Command Does

1. **Analyzes your project** - Detects React/Next.js/Vite, package manager, and existing dependencies
2. **Generates installation command** - Correct packages for your setup
3. **Creates build configuration** - Webpack/Vite config for Monaco workers
4. **Generates components** - TypeScript components with proper SSR handling
5. **Sets up Yjs integration** - WebSocket provider, document hooks, and Monaco binding

## Examples

### Basic Setup
```
/platxa-monaco-editor-agent
```
Detects your project and generates a complete Monaco + Yjs integration.

### Minimal Setup (No Collaboration)
```
/platxa-monaco-editor-agent --minimal
```
Generates Monaco Editor without Yjs for single-user editing.

### Custom Language Support
```
/platxa-monaco-editor-agent --languages typescript,python,json,markdown
```
Only includes specified languages to reduce bundle size.

## Generated Files

```
src/features/editor/
├── components/
│   └── MonacoEditor.tsx      # Main editor component
├── context/
│   └── YjsProvider.tsx       # Yjs context provider
├── hooks/
│   ├── useYjsDocument.ts     # Document management hook
│   └── useMonacoBinding.ts   # Editor-Yjs binding hook
├── config/
│   ├── editorOptions.ts      # Editor configuration
│   ├── theme.ts              # Theme definitions
│   └── languages.ts          # Language mappings
└── index.ts                  # Barrel export
```

## Requirements

- React 17+ (18+ recommended)
- Node.js 18+
- TypeScript 5+
- npm, pnpm, or yarn

## After Setup

1. Run the generated installation command
2. Start your dev server
3. Wrap your app with `<YjsProvider>`
4. Use `<MonacoEditor>` component

```tsx
import { YjsProvider, MonacoEditor } from '@/features/editor';

function App() {
  return (
    <YjsProvider
      websocketUrl="wss://your-yjs-server.com"
      roomName="my-document"
    >
      <MonacoEditor documentId="file.ts" />
    </YjsProvider>
  );
}
```
