# Live Preview with Hot Reload

Real-time component preview with instant updates on code changes.

## Overview

The live preview system provides:
1. Instant preview updates on code changes
2. State preservation during hot reload
3. Error boundary with recovery
4. WebSocket-based communication
5. Debounced compilation for performance

## Architecture

```typescript
interface PreviewSystem {
  compiler: CodeCompiler;
  renderer: PreviewRenderer;
  socket: WebSocketConnection;
  errorBoundary: ErrorRecovery;
}

interface CodeUpdate {
  id: string;
  code: string;
  timestamp: number;
  type: 'full' | 'partial';
}

interface PreviewState {
  component: React.ComponentType | null;
  error: CompilationError | null;
  isCompiling: boolean;
  lastUpdate: number;
}

interface CompilationError {
  message: string;
  line: number;
  column: number;
  stack?: string;
}
```

## Code Compiler

```typescript
import * as Babel from '@babel/standalone';
import { transform } from 'sucrase';

interface CompilerConfig {
  target: 'es2020' | 'es2022';
  jsx: 'react' | 'react-jsx';
  typescript: boolean;
  sourceMaps: boolean;
}

const defaultConfig: CompilerConfig = {
  target: 'es2020',
  jsx: 'react-jsx',
  typescript: true,
  sourceMaps: true,
};

class CodeCompiler {
  private config: CompilerConfig;
  private cache: Map<string, CompiledModule> = new Map();

  constructor(config: Partial<CompilerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  compile(code: string, filename: string): CompiledModule {
    // Check cache
    const cacheKey = this.getCacheKey(code, filename);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Fast compilation with Sucrase
      const result = transform(code, {
        transforms: ['typescript', 'jsx'],
        jsxRuntime: 'automatic',
        production: false,
        filePath: filename,
      });

      const compiled: CompiledModule = {
        code: result.code,
        sourceMap: result.sourceMap,
        error: null,
      };

      this.cache.set(cacheKey, compiled);
      return compiled;
    } catch (error) {
      return {
        code: '',
        sourceMap: null,
        error: this.parseError(error, code),
      };
    }
  }

  // Babel fallback for complex transformations
  compileBabel(code: string, filename: string): CompiledModule {
    try {
      const result = Babel.transform(code, {
        filename,
        presets: [
          ['typescript', { isTSX: true, allExtensions: true }],
          ['react', { runtime: 'automatic' }],
        ],
        sourceMaps: this.config.sourceMaps,
      });

      return {
        code: result.code || '',
        sourceMap: result.map,
        error: null,
      };
    } catch (error) {
      return {
        code: '',
        sourceMap: null,
        error: this.parseError(error, code),
      };
    }
  }

  private parseError(error: unknown, code: string): CompilationError {
    if (error instanceof SyntaxError) {
      const match = error.message.match(/\((\d+):(\d+)\)/);
      return {
        message: error.message,
        line: match ? parseInt(match[1], 10) : 1,
        column: match ? parseInt(match[2], 10) : 1,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
      line: 1,
      column: 1,
    };
  }

  private getCacheKey(code: string, filename: string): string {
    return `${filename}:${hashCode(code)}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

interface CompiledModule {
  code: string;
  sourceMap: unknown;
  error: CompilationError | null;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
```

## Module Executor

```typescript
interface ModuleScope {
  React: typeof React;
  useState: typeof useState;
  useEffect: typeof useEffect;
  useRef: typeof useRef;
  useMemo: typeof useMemo;
  useCallback: typeof useCallback;
  cn: typeof cn;
  motion: typeof motion;
  [key: string]: unknown;
}

class ModuleExecutor {
  private scope: ModuleScope;

  constructor(additionalScope: Record<string, unknown> = {}) {
    this.scope = {
      React,
      useState,
      useEffect,
      useRef,
      useMemo,
      useCallback,
      cn,
      motion,
      ...additionalScope,
    };
  }

  execute(compiledCode: string): React.ComponentType | null {
    try {
      // Create module wrapper
      const moduleCode = `
        const exports = {};
        const module = { exports };
        ${compiledCode}
        return module.exports.default || module.exports;
      `;

      // Create function with scope
      const scopeKeys = Object.keys(this.scope);
      const scopeValues = Object.values(this.scope);

      const moduleFunction = new Function(...scopeKeys, moduleCode);
      const result = moduleFunction(...scopeValues);

      if (typeof result === 'function') {
        return result as React.ComponentType;
      }

      return null;
    } catch (error) {
      console.error('Module execution error:', error);
      return null;
    }
  }

  addToScope(name: string, value: unknown): void {
    this.scope[name] = value;
  }
}
```

## Live Preview Component

```typescript
interface LivePreviewProps {
  code: string;
  scope?: Record<string, unknown>;
  onError?: (error: CompilationError) => void;
  onSuccess?: () => void;
  debounceMs?: number;
}

const LivePreview = ({
  code,
  scope = {},
  onError,
  onSuccess,
  debounceMs = 300,
}: LivePreviewProps) => {
  const [state, setState] = useState<PreviewState>({
    component: null,
    error: null,
    isCompiling: false,
    lastUpdate: 0,
  });

  const compilerRef = useRef(new CodeCompiler());
  const executorRef = useRef(new ModuleExecutor(scope));

  // Debounced compilation
  const debouncedCompile = useMemo(
    () =>
      debounce((newCode: string) => {
        setState((prev) => ({ ...prev, isCompiling: true }));

        const compiled = compilerRef.current.compile(newCode, 'preview.tsx');

        if (compiled.error) {
          setState({
            component: null,
            error: compiled.error,
            isCompiling: false,
            lastUpdate: Date.now(),
          });
          onError?.(compiled.error);
          return;
        }

        const Component = executorRef.current.execute(compiled.code);

        setState({
          component: Component,
          error: null,
          isCompiling: false,
          lastUpdate: Date.now(),
        });
        onSuccess?.();
      }, debounceMs),
    [debounceMs, onError, onSuccess]
  );

  // Recompile on code change
  useEffect(() => {
    debouncedCompile(code);
  }, [code, debouncedCompile]);

  // Update scope
  useEffect(() => {
    Object.entries(scope).forEach(([key, value]) => {
      executorRef.current.addToScope(key, value);
    });
  }, [scope]);

  return (
    <div className="relative h-full">
      {/* Compilation indicator */}
      {state.isCompiling && (
        <div className="absolute right-2 top-2 z-10">
          <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <PreviewError error={state.error} code={code} />
      )}

      {/* Component preview */}
      {state.component && !state.error && (
        <ErrorBoundary
          fallback={<PreviewCrash onRetry={() => debouncedCompile(code)} />}
        >
          <state.component />
        </ErrorBoundary>
      )}

      {/* Empty state */}
      {!state.component && !state.error && !state.isCompiling && (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Start typing to see preview
        </div>
      )}
    </div>
  );
};
```

## Error Display

```typescript
interface PreviewErrorProps {
  error: CompilationError;
  code: string;
}

const PreviewError = ({ error, code }: PreviewErrorProps) => {
  const lines = code.split('\n');
  const errorLine = lines[error.line - 1] || '';
  const contextStart = Math.max(0, error.line - 3);
  const contextEnd = Math.min(lines.length, error.line + 2);
  const contextLines = lines.slice(contextStart, contextEnd);

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <h4 className="font-medium text-destructive">Compilation Error</h4>
          <p className="mt-1 text-sm text-destructive/80">{error.message}</p>
        </div>
      </div>

      {/* Code context */}
      <div className="mt-4 overflow-x-auto rounded-md bg-gray-900 p-4">
        <pre className="text-sm">
          {contextLines.map((line, i) => {
            const lineNumber = contextStart + i + 1;
            const isErrorLine = lineNumber === error.line;

            return (
              <div
                key={lineNumber}
                className={cn(
                  'flex',
                  isErrorLine && 'bg-destructive/20'
                )}
              >
                <span className="mr-4 w-8 text-right text-gray-500">
                  {lineNumber}
                </span>
                <code className={cn(isErrorLine ? 'text-destructive' : 'text-gray-300')}>
                  {line || ' '}
                </code>
              </div>
            );
          })}
        </pre>

        {/* Error pointer */}
        {error.column > 0 && (
          <div className="ml-12 text-destructive">
            {' '.repeat(error.column - 1)}^
          </div>
        )}
      </div>
    </div>
  );
};

const PreviewCrash = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
    <AlertTriangle className="h-12 w-12 text-yellow-500" />
    <div>
      <h4 className="font-medium">Preview Crashed</h4>
      <p className="text-sm text-muted-foreground">
        An error occurred while rendering the component
      </p>
    </div>
    <button
      onClick={onRetry}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
    >
      Retry
    </button>
  </div>
);
```

## Error Boundary

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Preview error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
```

## State Preservation

```typescript
interface StatePreservation {
  key: string;
  value: unknown;
  timestamp: number;
}

class StateManager {
  private storage: Map<string, StatePreservation> = new Map();

  save(key: string, value: unknown): void {
    this.storage.set(key, {
      key,
      value,
      timestamp: Date.now(),
    });
  }

  restore(key: string): unknown {
    return this.storage.get(key)?.value;
  }

  clear(): void {
    this.storage.clear();
  }
}

// Hook for state preservation across hot reloads
function usePreservedState<T>(
  key: string,
  initialValue: T,
  stateManager: StateManager
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const preserved = stateManager.restore(key);
    return preserved !== undefined ? (preserved as T) : initialValue;
  });

  useEffect(() => {
    stateManager.save(key, state);
  }, [key, state, stateManager]);

  return [state, setState];
}
```

## WebSocket Hot Reload

```typescript
interface HotReloadConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

class HotReloadClient {
  private socket: WebSocket | null = null;
  private config: HotReloadConfig;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectAttempts = 0;

  constructor(config: Partial<HotReloadConfig> = {}) {
    this.config = {
      url: 'ws://localhost:3001',
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  connect(): void {
    try {
      this.socket = new WebSocket(this.config.url);

      this.socket.onopen = () => {
        console.log('Hot reload connected');
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.emit(message.type, message.data);
      };

      this.socket.onclose = () => {
        this.handleDisconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.config.reconnectInterval);
    }
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}

// React hook for hot reload
function useHotReload(
  onUpdate: (update: CodeUpdate) => void,
  config?: Partial<HotReloadConfig>
): { connected: boolean; reconnecting: boolean } {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const clientRef = useRef<HotReloadClient>();

  useEffect(() => {
    const client = new HotReloadClient(config);
    clientRef.current = client;

    client.on('connected', () => {
      setConnected(true);
      setReconnecting(false);
    });

    client.on('disconnected', () => {
      setConnected(false);
      setReconnecting(true);
    });

    client.on('update', (data) => {
      onUpdate(data as CodeUpdate);
    });

    client.connect();

    return () => client.disconnect();
  }, [config, onUpdate]);

  return { connected, reconnecting };
}
```

## Full Preview Editor

```typescript
interface PreviewEditorProps {
  initialCode: string;
  scope?: Record<string, unknown>;
  onChange?: (code: string) => void;
}

const PreviewEditor = ({
  initialCode,
  scope,
  onChange,
}: PreviewEditorProps) => {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<CompilationError | null>(null);
  const stateManagerRef = useRef(new StateManager());

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onChange?.(newCode);
  };

  return (
    <div className="grid h-full grid-cols-2 gap-4">
      {/* Code editor */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium">Code</span>
          {error && (
            <span className="text-xs text-destructive">
              Error on line {error.line}
            </span>
          )}
        </div>
        <CodeEditor
          value={code}
          onChange={handleCodeChange}
          language="typescript"
          className="flex-1"
        />
      </div>

      {/* Preview */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium">Preview</span>
          <HotReloadIndicator />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <LivePreview
            code={code}
            scope={{
              ...scope,
              usePreservedState: (key: string, initial: unknown) =>
                usePreservedState(key, initial, stateManagerRef.current),
            }}
            onError={setError}
            onSuccess={() => setError(null)}
          />
        </div>
      </div>
    </div>
  );
};

const HotReloadIndicator = () => {
  const { connected, reconnecting } = useHotReload(() => {});

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          connected ? 'bg-green-500' : reconnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
        )}
      />
      <span className="text-xs text-muted-foreground">
        {connected ? 'Live' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
      </span>
    </div>
  );
};
```

## Utility Functions

```typescript
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;

  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Code editor placeholder (use Monaco, CodeMirror, etc.)
const CodeEditor = ({
  value,
  onChange,
  language,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  language: string;
  className?: string;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      'w-full resize-none bg-gray-900 p-4 font-mono text-sm text-gray-100',
      className
    )}
    spellCheck={false}
  />
);
```

## Key Takeaways

1. **Fast Compilation**: Sucrase for quick transforms, Babel as fallback
2. **Module Execution**: Safe evaluation with controlled scope
3. **Debounced Updates**: Prevent excessive recompilation
4. **Error Recovery**: Clear error display with code context
5. **State Preservation**: Maintain component state across hot reloads
6. **WebSocket Connection**: Real-time updates from dev server
7. **Error Boundaries**: Graceful crash handling with retry option
