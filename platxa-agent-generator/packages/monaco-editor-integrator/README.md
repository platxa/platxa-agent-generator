# @platxa/monaco-editor-integrator

Production-grade Monaco Editor + Yjs integration for real-time collaborative editing in React/Next.js projects.

## Overview

This package provides a Claude Code agent and code generation utilities for integrating Monaco Editor with Yjs CRDT for real-time collaborative code editing. It includes:

- **Project Detection**: Automatically detects your build tool (Next.js, Vite, CRA, Webpack), package manager, and React version
- **Config Generation**: Generates correct build configurations for Monaco workers
- **Component Templates**: Production-ready TypeScript/JavaScript components with proper SSR handling
- **Error Handling**: WebSocket retry logic, error boundaries, and conflict resolution
- **Performance Optimization**: Lazy loading, bundle optimization, and large file handling

## Installation

```bash
# npm
npm install @platxa/monaco-editor-integrator

# pnpm
pnpm add @platxa/monaco-editor-integrator

# yarn
yarn add @platxa/monaco-editor-integrator
```

## Quick Start

### Using the Claude Code Agent

The easiest way to set up Monaco + Yjs is using the Claude Code agent:

```bash
# Basic setup
claude "/platxa-monaco-editor-agent"

# Or describe what you need
claude "Set up Monaco Editor with Yjs for my Next.js project"
```

### Programmatic Usage

```typescript
import {
  // Project Detection
  detectBuildTool,
  detectPackageManager,
  detectReactVersion,
  analyzeMonacoIntegration,

  // Config Generation
  generateNextjsConfig,
  generateViteConfig,
  generateCspHeader,

  // Component Templates
  generateMonacoEditorTemplate,
  generateYjsProviderTemplate,
  generateUseYjsDocumentTemplate,
  generateUseMonacoBindingTemplate,
} from '@platxa/monaco-editor-integrator';

// Analyze project
const buildTool = detectBuildTool('./my-project');
const packageManager = detectPackageManager('./my-project');
const reactVersion = detectReactVersion('./my-project');

console.log(`Detected: ${buildTool} with ${packageManager}, React ${reactVersion}`);

// Generate build config
if (buildTool === 'nextjs') {
  const config = generateNextjsConfig({ typescript: true });
  console.log(config);
}

// Generate components
const editorComponent = generateMonacoEditorTemplate({
  componentName: 'CodeEditor',
  typescript: true,
  includeYjs: true,
});
```

## API Reference

### Project Detection

#### `detectBuildTool(rootDir: string): BuildTool`

Detects the build tool used in a project by examining config files and dependencies.

```typescript
const buildTool = detectBuildTool('/path/to/project');
// Returns: 'nextjs' | 'vite' | 'cra' | 'webpack' | 'unknown'
```

#### `detectPackageManager(rootDir: string): PackageManager`

Detects the package manager from lockfiles or package.json `packageManager` field.

```typescript
const pm = detectPackageManager('/path/to/project');
// Returns: 'npm' | 'pnpm' | 'yarn' | 'bun'
```

#### `detectReactVersion(rootDir: string): string | null`

Returns the React version from package.json, or null if React is not installed.

```typescript
const version = detectReactVersion('/path/to/project');
// Returns: '^18.2.0' | '17.0.2' | null
```

#### `analyzeMonacoIntegration(rootDir: string): MonacoAnalysis`

Comprehensive analysis of existing Monaco/Yjs dependencies.

```typescript
const analysis = analyzeMonacoIntegration('/path/to/project');
// Returns: {
//   hasMonaco: boolean,
//   hasYjs: boolean,
//   hasYMonaco: boolean,
//   conflicts: VersionConflict[],
//   recommendations: string[],
// }
```

### Config Generation

#### `generateNextjsConfig(options: NextjsConfigOptions): string`

Generates Next.js configuration with MonacoWebpackPlugin.

```typescript
const config = generateNextjsConfig({
  typescript: true,
  existingConfig: '// existing config here',
  languages: ['typescript', 'javascript', 'json'],
});
```

#### `generateViteConfig(options: ViteConfigOptions): string`

Generates Vite configuration with monaco-editor plugin.

```typescript
const config = generateViteConfig({
  typescript: true,
  languages: ['typescript', 'javascript'],
});
```

#### `generateCspHeader(options: CspOptions): string`

Generates Content Security Policy headers required for Monaco workers.

```typescript
const csp = generateCspHeader({
  nonce: 'abc123',
  reportUri: '/api/csp-report',
});
```

### Component Templates

#### `generateMonacoEditorTemplate(options: MonacoEditorTemplateOptions): string`

Generates a Monaco Editor React component with Yjs integration.

```typescript
const component = generateMonacoEditorTemplate({
  componentName: 'CodeEditor',
  typescript: true,
  includeYjs: true,
  includeAwareness: true,
});
```

#### `generateYjsProviderTemplate(options: YjsProviderTemplateOptions): string`

Generates a Yjs context provider with WebSocket connection management.

```typescript
const provider = generateYjsProviderTemplate({
  typescript: true,
  includeAwareness: true,
  reconnectInterval: 1000,
  maxRetries: 10,
});
```

#### `generateUseYjsDocumentTemplate(options): string`

Generates a hook for per-file Y.Doc management.

#### `generateUseMonacoBindingTemplate(options): string`

Generates a hook for connecting Monaco to Yjs.

### Error Handling Templates

#### `generateWebSocketErrorHandler(options): string`

Generates WebSocket error handling with exponential backoff retry.

#### `generateEditorErrorBoundary(options): string`

Generates an error boundary component for Monaco loading errors.

#### `generateConflictResolution(options): string`

Generates Yjs sync conflict resolution utilities.

### Performance Templates

#### `generateLazyEditorTemplate(options): string`

Generates a lazy-loaded Monaco Editor wrapper.

#### `generateLargeFileUtilities(options): string`

Generates utilities for handling large files with size warnings.

#### `generateBundleOptimizationDocs(): string`

Generates documentation for bundle size optimization strategies.

## Generated File Structure

When using the agent, files are generated in this structure:

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

- Node.js 18+
- React 17+ (18+ recommended for concurrent features)
- TypeScript 5+ (optional but recommended)

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Package structure and design decisions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/)
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-monaco](https://github.com/yjs/y-monaco)

## License

MIT
