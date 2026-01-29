# Responsive Breakpoint Preview System

Preview components at multiple screen sizes during development.

## Overview

The responsive preview system enables:
1. Simultaneous view of all breakpoints
2. Individual breakpoint inspection
3. Device presets (iPhone, iPad, Desktop)
4. Custom viewport dimensions
5. Responsive class validation

## Breakpoint Configuration

```typescript
interface Breakpoint {
  name: string;
  minWidth: number;
  maxWidth?: number;
  label: string;
  icon: string;
}

const tailwindBreakpoints: Breakpoint[] = [
  { name: 'xs', minWidth: 0, maxWidth: 639, label: 'Mobile', icon: '📱' },
  { name: 'sm', minWidth: 640, maxWidth: 767, label: 'Small', icon: '📱' },
  { name: 'md', minWidth: 768, maxWidth: 1023, label: 'Tablet', icon: '📲' },
  { name: 'lg', minWidth: 1024, maxWidth: 1279, label: 'Laptop', icon: '💻' },
  { name: 'xl', minWidth: 1280, maxWidth: 1535, label: 'Desktop', icon: '🖥️' },
  { name: '2xl', minWidth: 1536, label: 'Large', icon: '🖥️' },
];

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
}

const devicePresets: DevicePreset[] = [
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, userAgent: 'iPhone' },
  { name: 'iPhone 14', width: 390, height: 844, deviceScaleFactor: 3, userAgent: 'iPhone' },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, userAgent: 'iPhone' },
  { name: 'iPad Mini', width: 768, height: 1024, deviceScaleFactor: 2, userAgent: 'iPad' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, deviceScaleFactor: 2, userAgent: 'iPad' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, deviceScaleFactor: 2, userAgent: 'iPad' },
  { name: 'MacBook Air', width: 1280, height: 800, deviceScaleFactor: 2, userAgent: 'Mac' },
  { name: 'MacBook Pro 14"', width: 1512, height: 982, deviceScaleFactor: 2, userAgent: 'Mac' },
  { name: 'iMac 24"', width: 1920, height: 1080, deviceScaleFactor: 2, userAgent: 'Mac' },
];
```

## Responsive Preview Component

```typescript
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResponsivePreviewProps {
  children: React.ReactNode;
  className?: string;
  defaultBreakpoint?: string;
  showAllBreakpoints?: boolean;
}

const ResponsivePreview = ({
  children,
  className,
  defaultBreakpoint = 'md',
  showAllBreakpoints = false,
}: ResponsivePreviewProps) => {
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(defaultBreakpoint);
  const [customWidth, setCustomWidth] = useState<number | null>(null);

  if (showAllBreakpoints) {
    return (
      <div className={cn('space-y-8', className)}>
        <BreakpointSelector
          selected={selectedBreakpoint}
          onSelect={setSelectedBreakpoint}
        />
        <AllBreakpointsView>{children}</AllBreakpointsView>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <BreakpointSelector
          selected={selectedBreakpoint}
          onSelect={setSelectedBreakpoint}
        />
        <CustomWidthInput
          value={customWidth}
          onChange={setCustomWidth}
        />
      </div>
      <SingleBreakpointView
        breakpoint={selectedBreakpoint}
        customWidth={customWidth}
      >
        {children}
      </SingleBreakpointView>
    </div>
  );
};
```

## Breakpoint Selector

```typescript
interface BreakpointSelectorProps {
  selected: string;
  onSelect: (breakpoint: string) => void;
}

const BreakpointSelector = ({ selected, onSelect }: BreakpointSelectorProps) => (
  <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
    {tailwindBreakpoints.map((bp) => (
      <button
        key={bp.name}
        onClick={() => onSelect(bp.name)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          selected === bp.name
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span>{bp.icon}</span>
        <span className="hidden sm:inline">{bp.name}</span>
        <span className="text-xs text-muted-foreground">
          {bp.minWidth}px
        </span>
      </button>
    ))}
  </div>
);

const CustomWidthInput = ({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) => (
  <div className="flex items-center gap-2">
    <input
      type="number"
      placeholder="Custom width"
      value={value || ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
      className="w-24 rounded-md border px-2 py-1 text-sm"
    />
    <span className="text-sm text-muted-foreground">px</span>
  </div>
);
```

## Single Breakpoint View

```typescript
interface SingleBreakpointViewProps {
  breakpoint: string;
  customWidth: number | null;
  children: React.ReactNode;
}

const SingleBreakpointView = ({
  breakpoint,
  customWidth,
  children,
}: SingleBreakpointViewProps) => {
  const bp = tailwindBreakpoints.find((b) => b.name === breakpoint);
  const width = customWidth || bp?.minWidth || 1024;

  return (
    <div className="relative rounded-lg border bg-background">
      {/* Device frame */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-muted-foreground">
            {width}px × auto
          </span>
        </div>
        <span className="text-sm font-medium">{bp?.label || 'Custom'}</span>
      </div>

      {/* Preview container */}
      <div className="overflow-auto p-4">
        <div
          className="mx-auto border border-dashed border-muted-foreground/20"
          style={{ width: `${width}px`, maxWidth: '100%' }}
        >
          <IframePreview width={width}>{children}</IframePreview>
        </div>
      </div>
    </div>
  );
};
```

## All Breakpoints View

```typescript
const AllBreakpointsView = ({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Calculate scale to fit all previews
  useEffect(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const totalWidth = tailwindBreakpoints.reduce(
      (sum, bp) => sum + bp.minWidth + 32, // 32px gap
      0
    );

    if (totalWidth > containerWidth) {
      setScale(containerWidth / totalWidth);
    }
  }, []);

  return (
    <div ref={containerRef} className="overflow-x-auto pb-4">
      <div
        className="flex gap-8"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {tailwindBreakpoints.map((bp) => (
          <div key={bp.name} className="flex-shrink-0">
            <div className="mb-2 text-center">
              <span className="text-lg">{bp.icon}</span>
              <p className="text-sm font-medium">{bp.name}</p>
              <p className="text-xs text-muted-foreground">{bp.minWidth}px</p>
            </div>
            <div
              className="rounded-lg border bg-background shadow-sm"
              style={{ width: bp.minWidth }}
            >
              <IframePreview width={bp.minWidth}>{children}</IframePreview>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Iframe Preview Component

```typescript
interface IframePreviewProps {
  width: number;
  height?: number;
  children: React.ReactNode;
}

const IframePreview = ({
  width,
  height = 600,
  children,
}: IframePreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(height);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Inject content into iframe
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Add styles (Tailwind CDN for preview)
    doc.head.innerHTML = `
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body {
          margin: 0;
          padding: 16px;
          font-family: system-ui, sans-serif;
        }
      </style>
    `;

    // Render children as HTML string
    const content = typeof children === 'string'
      ? children
      : renderToStaticMarkup(children);

    doc.body.innerHTML = content;

    // Auto-resize iframe height
    const resizeObserver = new ResizeObserver(() => {
      setIframeHeight(doc.body.scrollHeight + 32);
    });

    resizeObserver.observe(doc.body);

    return () => resizeObserver.disconnect();
  }, [children, width]);

  return (
    <iframe
      ref={iframeRef}
      title="Component Preview"
      className="w-full border-0"
      style={{ height: iframeHeight }}
      sandbox="allow-scripts"
    />
  );
};
```

## Device Preview Mode

```typescript
interface DevicePreviewProps {
  device: DevicePreset;
  children: React.ReactNode;
  orientation?: 'portrait' | 'landscape';
}

const DevicePreview = ({
  device,
  children,
  orientation = 'portrait',
}: DevicePreviewProps) => {
  const width = orientation === 'portrait' ? device.width : device.height;
  const height = orientation === 'portrait' ? device.height : device.width;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Device frame */}
      <div
        className="relative rounded-[2rem] border-[8px] border-gray-800 bg-gray-800 shadow-xl"
        style={{
          width: width / device.deviceScaleFactor + 16,
          height: height / device.deviceScaleFactor + 16,
        }}
      >
        {/* Notch (for iPhone) */}
        {device.userAgent === 'iPhone' && (
          <div className="absolute left-1/2 top-0 h-6 w-24 -translate-x-1/2 rounded-b-xl bg-gray-800" />
        )}

        {/* Screen */}
        <div
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            width: width / device.deviceScaleFactor,
            height: height / device.deviceScaleFactor,
          }}
        >
          <div
            style={{
              transform: `scale(${1 / device.deviceScaleFactor})`,
              transformOrigin: 'top left',
              width: width,
              height: height,
            }}
          >
            {children}
          </div>
        </div>

        {/* Home indicator (for modern iPhones) */}
        {device.userAgent === 'iPhone' && device.height > 800 && (
          <div className="absolute bottom-1 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white" />
        )}
      </div>

      {/* Device label */}
      <div className="text-center">
        <p className="font-medium">{device.name}</p>
        <p className="text-sm text-muted-foreground">
          {width} × {height} @{device.deviceScaleFactor}x
        </p>
      </div>
    </div>
  );
};
```

## Device Grid Preview

```typescript
const DeviceGridPreview = ({ children }: { children: React.ReactNode }) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([
    'iPhone 14',
    'iPad Pro 11"',
    'MacBook Air',
  ]);

  return (
    <div className="space-y-4">
      {/* Device selector */}
      <div className="flex flex-wrap gap-2">
        {devicePresets.map((device) => (
          <button
            key={device.name}
            onClick={() => {
              setSelectedDevices((prev) =>
                prev.includes(device.name)
                  ? prev.filter((d) => d !== device.name)
                  : [...prev, device.name]
              );
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              selectedDevices.includes(device.name)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {device.name}
          </button>
        ))}
      </div>

      {/* Device previews */}
      <div className="flex flex-wrap items-start justify-center gap-8">
        {selectedDevices.map((deviceName) => {
          const device = devicePresets.find((d) => d.name === deviceName);
          if (!device) return null;

          return (
            <DevicePreview key={device.name} device={device}>
              {children}
            </DevicePreview>
          );
        })}
      </div>
    </div>
  );
};
```

## Responsive Class Validator

```typescript
interface ResponsiveIssue {
  type: 'missing' | 'redundant' | 'order';
  breakpoint: string;
  className: string;
  message: string;
  suggestion: string;
}

function validateResponsiveClasses(code: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const classNames = extractClassNames(code);

  for (const className of classNames) {
    // Check for mobile-first violations
    const responsivePattern = /^(sm|md|lg|xl|2xl):(.+)$/;
    const baseClass = className.replace(responsivePattern, '$2');

    // Check if base class exists for responsive variants
    const hasResponsive = classNames.some((c) => responsivePattern.test(c) && c.endsWith(baseClass));
    const hasBase = classNames.includes(baseClass);

    if (hasResponsive && !hasBase) {
      issues.push({
        type: 'missing',
        breakpoint: 'base',
        className: baseClass,
        message: `Responsive class without mobile base: ${className}`,
        suggestion: `Add base class "${baseClass}" for mobile-first approach`,
      });
    }

    // Check for redundant breakpoints
    const breakpointOrder = ['sm', 'md', 'lg', 'xl', '2xl'];
    for (let i = 0; i < breakpointOrder.length - 1; i++) {
      const current = `${breakpointOrder[i]}:${baseClass}`;
      const next = `${breakpointOrder[i + 1]}:${baseClass}`;

      if (classNames.includes(current) && classNames.includes(next)) {
        // Check if they have the same value (redundant)
        const currentValue = getClassValue(current);
        const nextValue = getClassValue(next);

        if (currentValue === nextValue) {
          issues.push({
            type: 'redundant',
            breakpoint: breakpointOrder[i + 1],
            className: next,
            message: `Redundant breakpoint: ${next} same as ${current}`,
            suggestion: `Remove ${next}, ${current} already applies at larger screens`,
          });
        }
      }
    }
  }

  return issues;
}

function extractClassNames(code: string): string[] {
  const classNamePattern = /className=["']([^"']+)["']/g;
  const classes: string[] = [];
  let match;

  while ((match = classNamePattern.exec(code)) !== null) {
    classes.push(...match[1].split(/\s+/));
  }

  return [...new Set(classes)];
}

function getClassValue(className: string): string {
  // Extract the value part (e.g., "md:text-lg" -> "text-lg")
  return className.replace(/^(sm|md|lg|xl|2xl):/, '');
}
```

## Preview Panel Integration

```typescript
// Full preview panel for component development
const ComponentPreviewPanel = ({
  code,
  component,
}: {
  code: string;
  component: React.ReactNode;
}) => {
  const [view, setView] = useState<'breakpoints' | 'devices' | 'single'>('breakpoints');
  const responsiveIssues = validateResponsiveClasses(code);

  return (
    <div className="flex h-full flex-col">
      {/* View toggle */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('breakpoints')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              view === 'breakpoints' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            All Breakpoints
          </button>
          <button
            onClick={() => setView('devices')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              view === 'devices' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            Devices
          </button>
          <button
            onClick={() => setView('single')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              view === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}
          >
            Single View
          </button>
        </div>

        {/* Issues badge */}
        {responsiveIssues.length > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
            {responsiveIssues.length} responsive issues
          </span>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'breakpoints' && (
          <ResponsivePreview showAllBreakpoints>{component}</ResponsivePreview>
        )}
        {view === 'devices' && <DeviceGridPreview>{component}</DeviceGridPreview>}
        {view === 'single' && <ResponsivePreview>{component}</ResponsivePreview>}
      </div>

      {/* Issues panel */}
      {responsiveIssues.length > 0 && (
        <div className="border-t p-4">
          <h4 className="mb-2 font-medium">Responsive Issues</h4>
          <ul className="space-y-2">
            {responsiveIssues.map((issue, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-yellow-600">[{issue.type}]</span>{' '}
                {issue.message}
                <p className="text-muted-foreground">💡 {issue.suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## Usage in Agent Workflow

```typescript
// Generate responsive preview for component
function generateResponsivePreview(
  componentCode: string,
  componentName: string
): string {
  return `
## Responsive Preview: ${componentName}

### Breakpoint Behavior

| Breakpoint | Width | Behavior |
|------------|-------|----------|
${tailwindBreakpoints.map(bp =>
  `| ${bp.name} | ${bp.minWidth}px+ | ${analyzeBreakpointBehavior(componentCode, bp.name)} |`
).join('\n')}

### Responsive Classes Used

${extractResponsiveClasses(componentCode).map(c => `- \`${c}\``).join('\n')}

### Validation

${validateResponsiveClasses(componentCode).length === 0
  ? '✅ No responsive issues found'
  : validateResponsiveClasses(componentCode).map(i => `⚠️ ${i.message}`).join('\n')
}
`.trim();
}

function extractResponsiveClasses(code: string): string[] {
  const classes = extractClassNames(code);
  const responsivePattern = /^(sm|md|lg|xl|2xl):/;
  return classes.filter(c => responsivePattern.test(c));
}

function analyzeBreakpointBehavior(code: string, breakpoint: string): string {
  const classes = extractClassNames(code);
  const bpClasses = classes.filter(c => c.startsWith(`${breakpoint}:`));

  if (bpClasses.length === 0) return 'Inherits from smaller breakpoints';

  const behaviors = bpClasses.map(c => {
    const property = c.replace(`${breakpoint}:`, '').split('-')[0];
    return property;
  });

  return `Changes: ${[...new Set(behaviors)].join(', ')}`;
}
```

## Key Takeaways

1. **Multiple Views**: Breakpoint grid, device presets, single preview
2. **Tailwind Breakpoints**: xs, sm, md, lg, xl, 2xl with widths
3. **Device Presets**: iPhone, iPad, MacBook with accurate dimensions
4. **Iframe Isolation**: Preview in sandboxed iframe for accuracy
5. **Responsive Validation**: Detect mobile-first violations, redundant classes
6. **Scale to Fit**: Auto-scale previews to fit container
7. **Device Frames**: Realistic device chrome for presentations
