# Toast/Notification System

Animated toast notifications with auto-dismiss and Framer Motion.

## Dependencies

```bash
pnpm add framer-motion
```

## Toast Context & Provider

```typescript
'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Toast types
type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';
type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Convenience methods
export function useToastActions() {
  const { addToast, removeToast, removeAll } = useToast();

  return {
    toast: (title: string, options?: Partial<Omit<Toast, 'id' | 'title'>>) =>
      addToast({ type: 'default', title, ...options }),

    success: (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) =>
      addToast({ type: 'success', title, ...options }),

    error: (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) =>
      addToast({ type: 'error', title, duration: 6000, ...options }),

    warning: (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) =>
      addToast({ type: 'warning', title, ...options }),

    info: (title: string, options?: Partial<Omit<Toast, 'id' | 'title' | 'type'>>) =>
      addToast({ type: 'info', title, ...options }),

    dismiss: removeToast,
    dismissAll: removeAll,
  };
}
```

## Toast Provider

```typescript
interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  defaultDuration = 4000,
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        dismissible: true,
        duration: defaultDuration,
        ...toast,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Limit max toasts
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [defaultDuration, maxToasts]
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removeAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, removeAll }}>
      {children}
      <ToastContainer position={position} />
    </ToastContext.Provider>
  );
}
```

## Toast Container

```typescript
const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4 flex-col',
  'top-left': 'top-4 left-4 flex-col',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 flex-col',
  'bottom-right': 'bottom-4 right-4 flex-col-reverse',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 flex-col-reverse',
};

const slideVariants: Record<ToastPosition, { initial: object; animate: object; exit: object }> = {
  'top-right': {
    initial: { opacity: 0, x: 100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 100, scale: 0.9 },
  },
  'top-left': {
    initial: { opacity: 0, x: -100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -100, scale: 0.9 },
  },
  'top-center': {
    initial: { opacity: 0, y: -50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -50, scale: 0.9 },
  },
  'bottom-right': {
    initial: { opacity: 0, x: 100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 100, scale: 0.9 },
  },
  'bottom-left': {
    initial: { opacity: 0, x: -100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -100, scale: 0.9 },
  },
  'bottom-center': {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 50, scale: 0.9 },
  },
};

function ToastContainer({ position }: { position: ToastPosition }) {
  const { toasts } = useToast();

  return (
    <div
      className={cn(
        'fixed z-50 flex gap-2 pointer-events-none',
        positionClasses[position]
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            variants={slideVariants[position]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

## Toast Item Component

```typescript
const toastVariants = cva(
  [
    'pointer-events-auto relative flex w-full max-w-sm items-start gap-3',
    'rounded-lg border p-4 shadow-lg',
    'bg-background text-foreground',
  ],
  {
    variants: {
      type: {
        default: 'border-border',
        success: 'border-green-500/50 bg-green-500/10',
        error: 'border-red-500/50 bg-red-500/10',
        warning: 'border-yellow-500/50 bg-yellow-500/10',
        info: 'border-blue-500/50 bg-blue-500/10',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  }
);

const iconMap: Record<ToastType, React.ReactNode> = {
  default: null,
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

interface ToastItemProps {
  toast: Toast;
  variants: { initial: object; animate: object; exit: object };
}

function ToastItem({ toast, variants }: ToastItemProps) {
  const { removeToast } = useToast();
  const [isPaused, setIsPaused] = React.useState(false);
  const [progress, setProgress] = React.useState(100);

  // Auto-dismiss timer
  React.useEffect(() => {
    if (!toast.duration || isPaused) return;

    const startTime = Date.now();
    const endTime = startTime + toast.duration;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const percent = (remaining / toast.duration!) * 100;
      setProgress(percent);

      if (remaining <= 0) {
        removeToast(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.id, toast.duration, isPaused, removeToast]);

  return (
    <motion.div
      layout
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 40,
        mass: 1,
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={toastVariants({ type: toast.type })}
      role="alert"
    >
      {/* Icon */}
      {iconMap[toast.type] && (
        <div className="flex-shrink-0">{iconMap[toast.type]}</div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {toast.dismissible && (
        <button
          onClick={() => removeToast(toast.id)}
          className={cn(
            'flex-shrink-0 rounded-md p-1',
            'text-muted-foreground hover:text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Progress bar */}
      {toast.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg">
          <motion.div
            className={cn(
              'h-full',
              toast.type === 'success' && 'bg-green-500',
              toast.type === 'error' && 'bg-red-500',
              toast.type === 'warning' && 'bg-yellow-500',
              toast.type === 'info' && 'bg-blue-500',
              toast.type === 'default' && 'bg-primary'
            )}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}
```

## Sonner Integration (Alternative)

```typescript
// Using Sonner library for simpler setup
// pnpm add sonner

'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

// Custom styled Toaster
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            'group flex items-center gap-3 rounded-lg border p-4 shadow-lg',
            'bg-background text-foreground'
          ),
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          actionButton: 'text-sm font-medium text-primary',
          cancelButton: 'text-sm text-muted-foreground',
          success: 'border-green-500/50 bg-green-500/10',
          error: 'border-red-500/50 bg-red-500/10',
          warning: 'border-yellow-500/50 bg-yellow-500/10',
          info: 'border-blue-500/50 bg-blue-500/10',
        },
      }}
    />
  );
}

// Export toast function with typed helpers
export const showToast = {
  default: (message: string, options?: Parameters<typeof toast>[1]) =>
    toast(message, options),

  success: (message: string, options?: Parameters<typeof toast.success>[1]) =>
    toast.success(message, options),

  error: (message: string, options?: Parameters<typeof toast.error>[1]) =>
    toast.error(message, options),

  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) =>
    toast.warning(message, options),

  info: (message: string, options?: Parameters<typeof toast.info>[1]) =>
    toast.info(message, options),

  promise: <T,>(
    promise: Promise<T>,
    options: Parameters<typeof toast.promise<T>>[1]
  ) => toast.promise(promise, options),

  dismiss: toast.dismiss,
  dismissAll: () => toast.dismiss(),
};
```

## Promise Toast Pattern

```typescript
// Custom hook for async operation toasts
function useAsyncToast() {
  const { addToast, removeToast } = useToast();

  return async function asyncToast<T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ): Promise<T> {
    const toastId = addToast({
      type: 'default',
      title: options.loading,
      duration: 0, // No auto-dismiss while loading
      dismissible: false,
    });

    try {
      const result = await promise;
      removeToast(toastId);
      addToast({
        type: 'success',
        title: typeof options.success === 'function'
          ? options.success(result)
          : options.success,
      });
      return result;
    } catch (error) {
      removeToast(toastId);
      addToast({
        type: 'error',
        title: typeof options.error === 'function'
          ? options.error(error as Error)
          : options.error,
      });
      throw error;
    }
  };
}

// Usage
const asyncToast = useAsyncToast();

await asyncToast(
  saveUser(formData),
  {
    loading: 'Saving...',
    success: 'User saved successfully!',
    error: (err) => `Failed to save: ${err.message}`,
  }
);
```

## Stacked Toasts

```typescript
function StackedToastContainer({ position }: { position: ToastPosition }) {
  const { toasts } = useToast();
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={cn(
        'fixed z-50 pointer-events-none',
        positionClasses[position]
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {toasts.map((toast, index) => {
          const isLast = index === toasts.length - 1;
          const offset = isHovered ? index * 80 : Math.min(index * 8, 24);
          const scale = isHovered ? 1 : 1 - Math.min(index * 0.05, 0.1);
          const opacity = isHovered ? 1 : 1 - Math.min(index * 0.2, 0.4);

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{
                opacity,
                y: position.includes('bottom') ? -offset : offset,
                scale,
                zIndex: toasts.length - index,
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              style={{
                position: index === 0 ? 'relative' : 'absolute',
                bottom: position.includes('bottom') ? 0 : 'auto',
                top: position.includes('top') ? 0 : 'auto',
              }}
            >
              <ToastItem toast={toast} variants={slideVariants[position]} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

## Usage Examples

```tsx
// Setup in app layout
function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ToastProvider position="bottom-right" maxToasts={5}>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

// Using toast in components
function SaveButton() {
  const { success, error } = useToastActions();

  const handleSave = async () => {
    try {
      await saveData();
      success('Changes saved!', {
        description: 'Your changes have been saved successfully.',
      });
    } catch (e) {
      error('Failed to save', {
        description: 'Please try again later.',
        action: {
          label: 'Retry',
          onClick: handleSave,
        },
      });
    }
  };

  return <button onClick={handleSave}>Save</button>;
}

// Different toast types
const { toast, success, error, warning, info } = useToastActions();

toast('Default notification');
success('Operation completed!');
error('Something went wrong');
warning('Please review your input');
info('New feature available');

// With action button
success('File uploaded', {
  description: 'document.pdf was uploaded successfully',
  action: {
    label: 'View',
    onClick: () => router.push('/files'),
  },
});

// Promise toast
const asyncToast = useAsyncToast();
await asyncToast(
  fetch('/api/users'),
  {
    loading: 'Loading users...',
    success: 'Users loaded!',
    error: 'Failed to load users',
  }
);

// Using Sonner
import { showToast } from '@/components/ui/toaster';

showToast.success('Saved!');
showToast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed to save',
});
```

## Key Takeaways

1. **AnimatePresence**: Required for exit animations
2. **Position**: 6 positions with matching slide directions
3. **Auto-dismiss**: Progress bar with pause on hover
4. **Types**: default, success, error, warning, info
5. **Actions**: Optional action buttons in toasts
6. **Promise**: Built-in loading/success/error pattern
7. **Stacking**: Optional stacked display mode
