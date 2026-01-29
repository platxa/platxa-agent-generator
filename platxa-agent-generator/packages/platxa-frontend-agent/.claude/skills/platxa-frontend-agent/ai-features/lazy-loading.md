# Lazy Loading Patterns

Performance optimization through deferred loading of images and components.

## Overview

Lazy loading defers non-critical resources until needed:
1. Images load when entering viewport
2. Components load on-demand via dynamic imports
3. Routes split into separate bundles
4. Heavy libraries loaded only when required

## Image Lazy Loading

### Native Browser Lazy Loading

```typescript
interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

// Basic lazy image with native loading attribute
const LazyImage = ({
  src,
  alt,
  width,
  height,
  className,
  placeholder = 'empty',
  blurDataURL,
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Placeholder */}
      {placeholder === 'blur' && !isLoaded && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 h-full w-full object-cover blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Skeleton placeholder */}
      {placeholder === 'empty' && !isLoaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
```

### Intersection Observer Image

```typescript
interface ObservedImageProps extends LazyImageProps {
  rootMargin?: string;
  threshold?: number;
}

const ObservedImage = ({
  src,
  alt,
  rootMargin = '200px',
  threshold = 0.1,
  ...props
}: ObservedImageProps) => {
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={imgRef} className={props.className}>
      {isInView ? (
        <LazyImage src={src} alt={alt} {...props} />
      ) : (
        <div className="h-full w-full bg-muted animate-pulse" />
      )}
    </div>
  );
};
```

### Next.js Image Optimization

```typescript
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes = '100vw',
}: OptimizedImageProps) => (
  <Image
    src={src}
    alt={alt}
    width={width}
    height={height}
    priority={priority}
    loading={priority ? 'eager' : 'lazy'}
    placeholder="blur"
    blurDataURL={generateBlurPlaceholder(width, height)}
    sizes={sizes}
    className={className}
  />
);

// Generate tiny blur placeholder
function generateBlurPlaceholder(width: number, height: number): string {
  const aspectRatio = width / height;
  const w = 10;
  const h = Math.round(w / aspectRatio);

  return `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <filter id="b" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="1"/>
      </filter>
      <rect width="100%" height="100%" fill="#e5e7eb" filter="url(#b)"/>
    </svg>`
  )}`;
}

// Responsive sizes helper
const imageSizes = {
  thumbnail: '(max-width: 640px) 100vw, 150px',
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  hero: '100vw',
  avatar: '48px',
};
```

## Component Lazy Loading

### React.lazy with Suspense

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const DataTable = lazy(() => import('./components/DataTable'));
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));

// Named export lazy loading
const Modal = lazy(() =>
  import('./components/Modal').then(module => ({
    default: module.Modal,
  }))
);

// Usage with Suspense
const Dashboard = () => (
  <div>
    <h1>Dashboard</h1>

    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={chartData} />
    </Suspense>

    <Suspense fallback={<TableSkeleton />}>
      <DataTable rows={tableRows} />
    </Suspense>
  </div>
);
```

### Dynamic Import with Loading State

```typescript
import dynamic from 'next/dynamic';

// Next.js dynamic import
const DynamicChart = dynamic(
  () => import('@/components/Chart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Disable SSR for client-only components
  }
);

const DynamicMap = dynamic(
  () => import('@/components/Map'),
  {
    loading: () => (
      <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

// Conditional loading
const DynamicEditor = dynamic(
  () => import('@/components/RichTextEditor'),
  {
    loading: () => <EditorSkeleton />,
  }
);

const Page = () => {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>
        Open Editor
      </button>

      {showEditor && (
        <Suspense fallback={<EditorSkeleton />}>
          <DynamicEditor />
        </Suspense>
      )}
    </div>
  );
};
```

### Preloading Components

```typescript
// Preload on hover/focus for better UX
const preloadComponent = (importFn: () => Promise<unknown>) => {
  const componentPromise = importFn();
  return componentPromise;
};

// Lazy component with preload
function lazyWithPreload<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFn);

  return Object.assign(LazyComponent, {
    preload: () => importFn(),
  });
}

// Usage
const Settings = lazyWithPreload(() => import('./Settings'));

const Navigation = () => (
  <nav>
    <Link
      to="/settings"
      onMouseEnter={() => Settings.preload()}
      onFocus={() => Settings.preload()}
    >
      Settings
    </Link>
  </nav>
);
```

## Route-Based Code Splitting

### React Router Lazy Routes

```typescript
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load route components
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <Spinner className="h-8 w-8" />
  </div>
);

const App = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  </Suspense>
);
```

### Next.js App Router

```typescript
// app/dashboard/loading.tsx - Automatic loading UI
export default function Loading() {
  return <DashboardSkeleton />;
}

// app/dashboard/page.tsx - Automatically code-split
export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return <Dashboard data={data} />;
}

// Streaming with Suspense
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Streams independently */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <Chart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

## Library Lazy Loading

### Heavy Dependencies

```typescript
// Lazy load heavy libraries only when needed
const loadChartLibrary = () => import('recharts');
const loadEditorLibrary = () => import('@tiptap/react');
const loadPdfLibrary = () => import('react-pdf');

// Hook for lazy library loading
function useLazyLibrary<T>(
  loader: () => Promise<T>,
  shouldLoad: boolean
): { library: T | null; isLoading: boolean } {
  const [library, setLibrary] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shouldLoad || library) return;

    setIsLoading(true);
    loader()
      .then(setLibrary)
      .finally(() => setIsLoading(false));
  }, [shouldLoad, library, loader]);

  return { library, isLoading };
}

// Usage
const ChartComponent = ({ showChart }: { showChart: boolean }) => {
  const { library: Recharts, isLoading } = useLazyLibrary(
    loadChartLibrary,
    showChart
  );

  if (!showChart) return null;
  if (isLoading) return <ChartSkeleton />;
  if (!Recharts) return null;

  const { LineChart, Line, XAxis, YAxis } = Recharts;

  return (
    <LineChart width={400} height={300} data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Line type="monotone" dataKey="value" />
    </LineChart>
  );
};
```

### Conditional Feature Loading

```typescript
// Load features based on user permissions or feature flags
const featureModules = {
  analytics: () => import('./features/analytics'),
  reporting: () => import('./features/reporting'),
  admin: () => import('./features/admin'),
};

type FeatureKey = keyof typeof featureModules;

const useFeature = (featureKey: FeatureKey, enabled: boolean) => {
  const [Feature, setFeature] = useState<React.ComponentType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setIsLoading(true);
    featureModules[featureKey]()
      .then(module => setFeature(() => module.default))
      .finally(() => setIsLoading(false));
  }, [featureKey, enabled]);

  return { Feature, isLoading };
};

// Usage
const Dashboard = ({ userPermissions }: Props) => {
  const { Feature: Analytics, isLoading: analyticsLoading } = useFeature(
    'analytics',
    userPermissions.includes('view_analytics')
  );

  return (
    <div>
      {analyticsLoading && <AnalyticsSkeleton />}
      {Analytics && <Analytics />}
    </div>
  );
};
```

## Skeleton Components

```typescript
// Reusable skeleton components
const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

const ImageSkeleton = ({ aspectRatio = 'square' }: { aspectRatio?: string }) => (
  <Skeleton
    className={cn(
      'w-full',
      aspectRatio === 'square' && 'aspect-square',
      aspectRatio === 'video' && 'aspect-video',
      aspectRatio === 'portrait' && 'aspect-[3/4]'
    )}
  />
);

const CardSkeleton = () => (
  <div className="rounded-lg border p-4 space-y-4">
    <ImageSkeleton aspectRatio="video" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" /> {/* Header */}
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);

const ChartSkeleton = () => (
  <div className="h-[300px] rounded-lg border p-4">
    <div className="flex h-full items-end gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          style={{ height: `${Math.random() * 60 + 20}%` }}
        />
      ))}
    </div>
  </div>
);
```

## Virtualized Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize: number;
  overscan?: number;
}

function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  overscan = 5,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage
const ProductList = ({ products }: { products: Product[] }) => (
  <VirtualList
    items={products}
    estimateSize={80}
    renderItem={(product) => <ProductCard product={product} />}
  />
);
```

## Integration Pattern

```typescript
// Pattern detection for lazy loading opportunities
const lazyLoadingChecks = {
  // Images without loading attribute
  imagesNeedLazy: /<img(?![^>]*loading=)[^>]*>/g,

  // Large components imported synchronously
  syncHeavyImports: /import\s+\{[^}]+\}\s+from\s+['"](@?recharts|@tiptap|react-pdf|monaco-editor)['"]/g,

  // Route components not lazy loaded
  syncRouteImports: /import\s+(\w+)\s+from\s+['"]\.\/pages\//g,

  // Missing Suspense boundaries
  lazyWithoutSuspense: /const\s+\w+\s*=\s*lazy\(/g,
};

function detectLazyLoadingOpportunities(code: string): string[] {
  const suggestions: string[] = [];

  if (lazyLoadingChecks.imagesNeedLazy.test(code)) {
    suggestions.push('Add loading="lazy" to images below the fold');
  }

  if (lazyLoadingChecks.syncHeavyImports.test(code)) {
    suggestions.push('Use dynamic import for heavy libraries (recharts, tiptap, etc.)');
  }

  if (lazyLoadingChecks.syncRouteImports.test(code)) {
    suggestions.push('Use React.lazy for route components');
  }

  return suggestions;
}
```

## Key Takeaways

1. **Native Lazy Loading**: Use `loading="lazy"` for images below the fold
2. **React.lazy**: Split code at route and feature boundaries
3. **Suspense Boundaries**: Wrap lazy components with appropriate fallbacks
4. **Preloading**: Preload on hover/focus for perceived performance
5. **Next.js Image**: Use for automatic optimization and lazy loading
6. **Virtual Lists**: Virtualize long lists instead of lazy loading items
7. **Library Loading**: Defer heavy dependencies until actually needed
8. **Skeleton States**: Provide meaningful loading placeholders
