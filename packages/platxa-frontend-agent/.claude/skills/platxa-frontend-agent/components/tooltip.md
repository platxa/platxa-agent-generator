# Tooltip Component

Accessible tooltips with hover delay built on Radix UI.

## Dependencies

```bash
pnpm add @radix-ui/react-tooltip
```

## Base Tooltip Component

```typescript
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Global provider for shared delay settings
const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

// Content variants
const tooltipContentVariants = cva(
  [
    'z-50 overflow-hidden rounded-md px-3 py-1.5 text-sm shadow-md',
    'animate-in fade-in-0 zoom-in-95',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    'data-[side=bottom]:slide-in-from-top-2',
    'data-[side=left]:slide-in-from-right-2',
    'data-[side=right]:slide-in-from-left-2',
    'data-[side=top]:slide-in-from-bottom-2',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        muted: 'bg-muted text-muted-foreground border',
        dark: 'bg-gray-900 text-white',
        light: 'bg-white text-gray-900 border shadow-lg',
      },
      size: {
        sm: 'px-2 py-1 text-xs',
        default: 'px-3 py-1.5 text-sm',
        lg: 'px-4 py-2 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, variant, size, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(tooltipContentVariants({ variant, size }), className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

## Simple Tooltip Wrapper

```typescript
'use client';

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from './tooltip';
import type { VariantProps } from 'class-variance-authority';

interface SimpleTooltipProps extends VariantProps<typeof tooltipContentVariants> {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
  asChild?: boolean;
}

function SimpleTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300,
  skipDelayDuration = 300,
  disableHoverableContent = false,
  variant,
  size,
  asChild = true,
}: SimpleTooltipProps) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <Tooltip>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align} variant={variant} size={size}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { SimpleTooltip };
```

## Rich Tooltip

```typescript
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

interface RichTooltipProps {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  footer?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  maxWidth?: number;
  delayDuration?: number;
}

function RichTooltip({
  trigger,
  title,
  description,
  image,
  footer,
  side = 'top',
  maxWidth = 280,
  delayDuration = 400,
}: RichTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )}
            style={{ maxWidth }}
          >
            {image && (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="p-3">
              {title && (
                <p className="font-medium text-sm">{title}</p>
              )}
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
              {footer && (
                <div className="mt-2 pt-2 border-t text-xs">
                  {footer}
                </div>
              )}
            </div>
            <TooltipPrimitive.Arrow className="fill-popover" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
```

## Keyboard Shortcut Tooltip

```typescript
'use client';

import * as React from 'react';
import { SimpleTooltip } from './tooltip';
import { cn } from '@/lib/utils';

interface KeyboardShortcut {
  key: string;
  modifier?: 'cmd' | 'ctrl' | 'alt' | 'shift' | 'meta';
}

interface ShortcutTooltipProps {
  children: React.ReactNode;
  label: string;
  shortcut?: KeyboardShortcut | KeyboardShortcut[];
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const modifierSymbols: Record<string, string> = {
  cmd: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  meta: '⌘',
};

function ShortcutTooltip({
  children,
  label,
  shortcut,
  side = 'bottom',
}: ShortcutTooltipProps) {
  const shortcuts = shortcut
    ? Array.isArray(shortcut)
      ? shortcut
      : [shortcut]
    : [];

  const content = (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      {shortcuts.length > 0 && (
        <kbd className="flex items-center gap-0.5 rounded bg-black/20 px-1.5 py-0.5 text-xs">
          {shortcuts.map((s, i) => (
            <React.Fragment key={i}>
              {s.modifier && (
                <span>{modifierSymbols[s.modifier]}</span>
              )}
              <span className="uppercase">{s.key}</span>
              {i < shortcuts.length - 1 && <span>+</span>}
            </React.Fragment>
          ))}
        </kbd>
      )}
    </div>
  );

  return (
    <SimpleTooltip content={content} side={side} delayDuration={500}>
      {children}
    </SimpleTooltip>
  );
}

// Usage
<ShortcutTooltip label="Save" shortcut={{ modifier: 'cmd', key: 's' }}>
  <button>💾</button>
</ShortcutTooltip>
```

## Controlled Tooltip

```typescript
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

interface ControlledTooltipProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

function ControlledTooltip({
  open,
  onOpenChange,
  content,
  children,
  side = 'top',
}: ControlledTooltipProps) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={4}
            className={cn(
              'z-50 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-md',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Usage - show on focus only
function FocusTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <ControlledTooltip open={open} onOpenChange={setOpen} content={content}>
      <div
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => {}} // Prevent hover
        onMouseLeave={() => {}}
      >
        {children}
      </div>
    </ControlledTooltip>
  );
}
```

## Tooltip with Arrow

```typescript
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

interface ArrowTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  variant?: 'dark' | 'light';
}

function ArrowTooltip({
  content,
  children,
  side = 'top',
  variant = 'dark',
}: ArrowTooltipProps) {
  const isDark = variant === 'dark';

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-50 rounded-md px-3 py-1.5 text-sm shadow-md',
              'animate-in fade-in-0 zoom-in-95',
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border'
            )}
          >
            {content}
            <TooltipPrimitive.Arrow
              className={cn(
                'fill-current',
                isDark ? 'text-gray-900' : 'text-white'
              )}
              width={12}
              height={6}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
```

## Tooltip Group (Shared Delay)

```typescript
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

// Wrap multiple tooltips to share delay state
// After first tooltip opens, subsequent ones open immediately
function TooltipGroup({
  children,
  delayDuration = 400,
  skipDelayDuration = 300,
}: {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}

// Usage
<TooltipGroup delayDuration={500}>
  <div className="flex gap-2">
    <Tooltip>
      <TooltipTrigger>🏠</TooltipTrigger>
      <TooltipContent>Home</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger>⚙️</TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger>👤</TooltipTrigger>
      <TooltipContent>Profile</TooltipContent>
    </Tooltip>
  </div>
</TooltipGroup>
```

## Truncated Text Tooltip

```typescript
'use client';

import * as React from 'react';
import { SimpleTooltip } from './tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  maxWidth?: number | string;
  className?: string;
}

function TruncatedText({ text, maxWidth = '100%', className }: TruncatedTextProps) {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [text]);

  const textElement = (
    <span
      ref={textRef}
      className={cn('block truncate', className)}
      style={{ maxWidth }}
    >
      {text}
    </span>
  );

  if (!isTruncated) {
    return textElement;
  }

  return (
    <SimpleTooltip content={text} delayDuration={500}>
      {textElement}
    </SimpleTooltip>
  );
}

// Usage
<TruncatedText
  text="This is a very long text that will be truncated"
  maxWidth={200}
/>
```

## Delay Configuration

```typescript
// Provider-level delay settings
<TooltipProvider
  delayDuration={400}       // Time before tooltip shows (ms)
  skipDelayDuration={300}   // Skip delay when moving between tooltips
  disableHoverableContent   // Close when moving to tooltip content
>
  {children}
</TooltipProvider>

// Per-tooltip delay override
<Tooltip delayDuration={0}>  {/* Instant */}
  <TooltipTrigger>Instant tooltip</TooltipTrigger>
  <TooltipContent>Shows immediately</TooltipContent>
</Tooltip>

<Tooltip delayDuration={1000}>  {/* 1 second */}
  <TooltipTrigger>Delayed tooltip</TooltipTrigger>
  <TooltipContent>Shows after 1 second</TooltipContent>
</Tooltip>
```

## Accessibility

```typescript
// Tooltips are accessible by default with Radix
// - Trigger has aria-describedby pointing to content
// - Content has role="tooltip"
// - Shows on focus as well as hover

// For icon-only buttons, add aria-label
<Tooltip>
  <TooltipTrigger asChild>
    <button aria-label="Save document">
      <SaveIcon />
    </button>
  </TooltipTrigger>
  <TooltipContent>Save (⌘S)</TooltipContent>
</Tooltip>

// Disabled elements need wrapper
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0}>
      <button disabled>Can't click</button>
    </span>
  </TooltipTrigger>
  <TooltipContent>This action is disabled</TooltipContent>
</Tooltip>
```

## Usage Examples

```tsx
// Basic tooltip
<SimpleTooltip content="Edit profile">
  <button>✏️</button>
</SimpleTooltip>

// With keyboard shortcut
<ShortcutTooltip label="Copy" shortcut={{ modifier: 'cmd', key: 'c' }}>
  <button>📋</button>
</ShortcutTooltip>

// Rich tooltip with image
<RichTooltip
  trigger={<button>View details</button>}
  title="Product Preview"
  description="Click to see full product details and specifications"
  image="/product-thumb.jpg"
  footer={<span className="text-primary">$99.99</span>}
/>

// Different positions
<SimpleTooltip content="Top" side="top">...</SimpleTooltip>
<SimpleTooltip content="Right" side="right">...</SimpleTooltip>
<SimpleTooltip content="Bottom" side="bottom">...</SimpleTooltip>
<SimpleTooltip content="Left" side="left">...</SimpleTooltip>

// Variants
<SimpleTooltip content="Dark" variant="dark">...</SimpleTooltip>
<SimpleTooltip content="Light" variant="light">...</SimpleTooltip>
<SimpleTooltip content="Muted" variant="muted">...</SimpleTooltip>

// Truncated text with auto tooltip
<TruncatedText text="Very long filename.pdf" maxWidth={150} />
```

## Key Takeaways

1. **Radix Base**: Built on @radix-ui/react-tooltip for accessibility
2. **Delay**: Configurable show/skip delays (default 300ms)
3. **Variants**: dark, light, muted styles via CVA
4. **Rich Content**: Support for images, titles, descriptions
5. **Keyboard**: Show shortcuts with modifier symbols
6. **Grouped**: Share delay state across multiple tooltips
7. **Truncation**: Auto-show tooltip for truncated text
