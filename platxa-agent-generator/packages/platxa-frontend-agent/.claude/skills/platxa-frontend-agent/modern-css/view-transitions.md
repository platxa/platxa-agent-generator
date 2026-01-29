# View Transitions API

Smooth page and element transitions using the native View Transitions API.

## Overview

View Transitions enable:
1. Smooth page-to-page transitions
2. Element morphing between states
3. Cross-document navigation animations
4. Shared element transitions
5. CSS-controllable animation customization

## Browser Support & Detection

```typescript
// Feature detection
const supportsViewTransitions = 'startViewTransition' in document;

// TypeScript type augmentation
declare global {
  interface Document {
    startViewTransition?: (callback: () => Promise<void> | void) => ViewTransition;
  }

  interface ViewTransition {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition(): void;
  }
}

// Safe wrapper
function startViewTransition(callback: () => void | Promise<void>): ViewTransition | null {
  if (!document.startViewTransition) {
    callback();
    return null;
  }
  return document.startViewTransition(callback);
}
```

## Basic Usage

### Simple State Change

```typescript
// Animate a DOM update
function updateContent(newContent: string) {
  if (!document.startViewTransition) {
    document.getElementById('content')!.innerHTML = newContent;
    return;
  }

  document.startViewTransition(() => {
    document.getElementById('content')!.innerHTML = newContent;
  });
}
```

### React State Transition

```typescript
import { flushSync } from 'react-dom';

function useViewTransition() {
  const startTransition = useCallback(
    (callback: () => void) => {
      if (!document.startViewTransition) {
        callback();
        return;
      }

      document.startViewTransition(() => {
        flushSync(callback);
      });
    },
    []
  );

  return { startTransition, isSupported: 'startViewTransition' in document };
}

// Usage
const Component = () => {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const { startTransition } = useViewTransition();

  const toggleView = () => {
    startTransition(() => {
      setView(view === 'list' ? 'grid' : 'list');
    });
  };

  return (
    <button onClick={toggleView}>
      Toggle View
    </button>
  );
};
```

## CSS Customization

### Default Transition

```css
/* Default crossfade animation */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* Customize the transition */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out forwards;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-out forwards;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Slide Transitions

```css
/* Slide left (forward navigation) */
::view-transition-old(root) {
  animation: slide-out-left 0.3s ease-out forwards;
}

::view-transition-new(root) {
  animation: slide-in-right 0.3s ease-out forwards;
}

@keyframes slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Slide right (back navigation) */
.back-navigation::view-transition-old(root) {
  animation: slide-out-right 0.3s ease-out forwards;
}

.back-navigation::view-transition-new(root) {
  animation: slide-in-left 0.3s ease-out forwards;
}

@keyframes slide-out-right {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

@keyframes slide-in-left {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

## Named View Transitions

### Element-Specific Transitions

```css
/* Assign view transition name to element */
.hero-image {
  view-transition-name: hero;
}

.card-title {
  view-transition-name: card-title;
}

/* Customize transition for specific element */
::view-transition-old(hero),
::view-transition-new(hero) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Different animation for title */
::view-transition-old(card-title) {
  animation: fade-out 0.2s ease-out forwards;
}

::view-transition-new(card-title) {
  animation: fade-in 0.2s ease-in forwards;
  animation-delay: 0.1s;
}
```

### Dynamic View Transition Names

```typescript
// React component with dynamic name
interface TransitionElementProps {
  id: string;
  children: React.ReactNode;
}

const TransitionElement = ({ id, children }: TransitionElementProps) => (
  <div
    style={{ viewTransitionName: `element-${id}` }}
  >
    {children}
  </div>
);

// Generate unique CSS for each element
function generateTransitionStyles(ids: string[]): string {
  return ids.map(id => `
    ::view-transition-old(element-${id}),
    ::view-transition-new(element-${id}) {
      animation-duration: 0.3s;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
  `).join('\n');
}
```

## Shared Element Transitions

### List to Detail View

```typescript
// List item
const ListItem = ({ item, onClick }: ListItemProps) => (
  <div
    onClick={onClick}
    style={{ viewTransitionName: `item-${item.id}` }}
    className="cursor-pointer rounded-lg border p-4"
  >
    <img
      src={item.image}
      alt={item.title}
      style={{ viewTransitionName: `image-${item.id}` }}
      className="h-40 w-full object-cover"
    />
    <h3
      style={{ viewTransitionName: `title-${item.id}` }}
      className="mt-2 font-semibold"
    >
      {item.title}
    </h3>
  </div>
);

// Detail view
const DetailView = ({ item }: DetailViewProps) => (
  <div>
    <img
      src={item.image}
      alt={item.title}
      style={{ viewTransitionName: `image-${item.id}` }}
      className="h-80 w-full object-cover"
    />
    <h1
      style={{ viewTransitionName: `title-${item.id}` }}
      className="mt-4 text-3xl font-bold"
    >
      {item.title}
    </h1>
    <p className="mt-2">{item.description}</p>
  </div>
);

// Navigation with transition
const navigate = (item: Item) => {
  document.startViewTransition?.(() => {
    flushSync(() => {
      setSelectedItem(item);
      setView('detail');
    });
  });
};
```

### CSS for Shared Elements

```css
/* Shared image morphs between views */
::view-transition-old(image-*),
::view-transition-new(image-*) {
  /* Prevent default crossfade, allow morphing */
  animation: none;
  mix-blend-mode: normal;
}

/* Smooth size/position interpolation */
::view-transition-group(image-*) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Title fades and moves */
::view-transition-old(title-*) {
  animation: fade-and-scale-out 0.3s ease-out forwards;
}

::view-transition-new(title-*) {
  animation: fade-and-scale-in 0.3s ease-out forwards;
}

@keyframes fade-and-scale-out {
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

@keyframes fade-and-scale-in {
  from {
    opacity: 0;
    transform: scale(1.1);
  }
}
```

## Next.js App Router Integration

### Layout with View Transitions

```typescript
// app/template.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Transition already happened via Link
      prevPathname.current = pathname;
    }
  }, [pathname]);

  return <>{children}</>;
}
```

### View Transition Link

```typescript
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TransitionLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const TransitionLink = ({
  href,
  children,
  className,
}: TransitionLinkProps) => {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (!document.startViewTransition) {
      router.push(href);
      return;
    }

    document.startViewTransition(() => {
      router.push(href);
    });
  };

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
};
```

### Direction-Aware Transitions

```typescript
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Track navigation direction
export function useNavigationDirection() {
  const pathname = usePathname();
  const history = useRef<string[]>([]);
  const direction = useRef<'forward' | 'back'>('forward');

  useEffect(() => {
    const prevPath = history.current[history.current.length - 1];
    const prevPrevPath = history.current[history.current.length - 2];

    if (pathname === prevPrevPath) {
      // Going back
      direction.current = 'back';
      history.current.pop();
    } else {
      // Going forward
      direction.current = 'forward';
      history.current.push(pathname);
    }

    // Set class on document for CSS targeting
    document.documentElement.classList.remove('nav-forward', 'nav-back');
    document.documentElement.classList.add(`nav-${direction.current}`);
  }, [pathname]);

  return direction.current;
}
```

```css
/* Direction-aware animations */
.nav-forward::view-transition-old(root) {
  animation: slide-out-left 0.3s ease-out forwards;
}
.nav-forward::view-transition-new(root) {
  animation: slide-in-right 0.3s ease-out forwards;
}

.nav-back::view-transition-old(root) {
  animation: slide-out-right 0.3s ease-out forwards;
}
.nav-back::view-transition-new(root) {
  animation: slide-in-left 0.3s ease-out forwards;
}
```

## Cross-Document View Transitions

### Enable in CSS

```css
/* Enable cross-document view transitions */
@view-transition {
  navigation: auto;
}

/* Same-origin pages will animate automatically */
```

### MPA Navigation

```html
<!-- Page 1: list.html -->
<style>
  @view-transition { navigation: auto; }

  .product-image {
    view-transition-name: product-hero;
  }
</style>

<a href="/product/1">
  <img class="product-image" src="/product-1.jpg" />
</a>

<!-- Page 2: product.html -->
<style>
  @view-transition { navigation: auto; }

  .hero-image {
    view-transition-name: product-hero;
  }
</style>

<img class="hero-image" src="/product-1.jpg" />
```

## Advanced Patterns

### Async Data Loading

```typescript
async function navigateWithData(id: string) {
  // Start fetching data
  const dataPromise = fetchData(id);

  // Start transition
  const transition = document.startViewTransition(async () => {
    // Wait for data before updating DOM
    const data = await dataPromise;
    flushSync(() => {
      setData(data);
      setView('detail');
    });
  });

  // Handle transition completion
  await transition?.finished;
  console.log('Transition complete');
}
```

### Transition Types

```typescript
// Different transition styles based on context
function startTypedTransition(
  type: 'slide' | 'fade' | 'morph',
  callback: () => void
) {
  document.documentElement.dataset.transitionType = type;

  const transition = document.startViewTransition?.(() => {
    flushSync(callback);
  });

  transition?.finished.then(() => {
    delete document.documentElement.dataset.transitionType;
  });
}
```

```css
/* Type-specific animations */
[data-transition-type="slide"]::view-transition-old(root) {
  animation: slide-out 0.3s ease-out forwards;
}
[data-transition-type="slide"]::view-transition-new(root) {
  animation: slide-in 0.3s ease-out forwards;
}

[data-transition-type="fade"]::view-transition-old(root),
[data-transition-type="fade"]::view-transition-new(root) {
  animation-duration: 0.2s;
}

[data-transition-type="morph"]::view-transition-group(*) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }

  ::view-transition-group(*) {
    animation-duration: 0.01ms;
  }
}
```

## Utility Hook

```typescript
interface UseViewTransitionOptions {
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

function useViewTransitionState(options: UseViewTransitionOptions = {}) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startTransition = useCallback(
    async (callback: () => void | Promise<void>) => {
      if (!document.startViewTransition) {
        await callback();
        return;
      }

      setIsTransitioning(true);
      options.onTransitionStart?.();

      const transition = document.startViewTransition(async () => {
        await callback();
      });

      await transition.finished;
      setIsTransitioning(false);
      options.onTransitionEnd?.();
    },
    [options]
  );

  return {
    isTransitioning,
    startTransition,
    isSupported: 'startViewTransition' in document,
  };
}
```

## Key Takeaways

1. **Progressive Enhancement**: Always check for support first
2. **flushSync Required**: React needs synchronous DOM updates
3. **view-transition-name**: Unique names enable shared element transitions
4. **CSS Customization**: Full control via pseudo-elements
5. **Cross-Document**: Enable with `@view-transition { navigation: auto }`
6. **Direction Awareness**: Track history for back/forward animations
7. **Reduced Motion**: Always respect user preferences
8. **Async Support**: Works with data fetching workflows
