# Accordion Component

Collapsible content panels with smooth animations built on Radix UI.

## Dependencies

```bash
pnpm add @radix-ui/react-accordion
```

## Base Accordion Component

```typescript
'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Accordion = AccordionPrimitive.Root;

// AccordionItem variants
const accordionItemVariants = cva('', {
  variants: {
    variant: {
      default: 'border-b',
      card: 'rounded-lg border bg-card mb-2 last:mb-0',
      ghost: 'border-b border-transparent',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface AccordionItemProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>,
    VariantProps<typeof accordionItemVariants> {}

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(({ className, variant, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(accordionItemVariants({ variant }), className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

// AccordionTrigger variants
const accordionTriggerVariants = cva(
  [
    'flex flex-1 items-center justify-between py-4 font-medium transition-all',
    'hover:underline',
    '[&[data-state=open]>svg]:rotate-180',
  ],
  {
    variants: {
      variant: {
        default: 'text-left',
        card: 'px-4 hover:no-underline hover:bg-muted/50 rounded-lg',
        centered: 'justify-center gap-2',
      },
      size: {
        sm: 'py-2 text-sm',
        default: 'py-4',
        lg: 'py-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>,
    VariantProps<typeof accordionTriggerVariants> {
  icon?: React.ReactNode;
  hideChevron?: boolean;
}

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, variant, size, icon, hideChevron, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(accordionTriggerVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span className="mr-3">{icon}</span>}
      {children}
      {!hideChevron && (
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      )}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

// AccordionContent with CSS animation
const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm transition-all',
      'data-[state=closed]:animate-accordion-up',
      'data-[state=open]:animate-accordion-down',
      className
    )}
    {...props}
  >
    <div className="pb-4 pt-0">{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
```

## CSS Animation Setup

```css
/* tailwind.config.ts - add to theme.extend */
@theme {
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;

  @keyframes accordion-down {
    from {
      height: 0;
    }
    to {
      height: var(--radix-accordion-content-height);
    }
  }

  @keyframes accordion-up {
    from {
      height: var(--radix-accordion-content-height);
    }
    to {
      height: 0;
    }
  }
}
```

## Framer Motion Enhanced Accordion

```typescript
'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedAccordionProps {
  items: Array<{
    id: string;
    trigger: React.ReactNode;
    content: React.ReactNode;
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  className?: string;
}

function AnimatedAccordion({
  items,
  type = 'single',
  defaultValue,
  className,
}: AnimatedAccordionProps) {
  const [openItems, setOpenItems] = React.useState<string[]>(() => {
    if (!defaultValue) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });

  const toggleItem = (id: string) => {
    if (type === 'single') {
      setOpenItems((prev) => (prev.includes(id) ? [] : [id]));
    } else {
      setOpenItems((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id);

        return (
          <div
            key={item.id}
            className="rounded-lg border bg-card overflow-hidden"
          >
            <button
              onClick={() => !item.disabled && toggleItem(item.id)}
              disabled={item.disabled}
              className={cn(
                'flex w-full items-center justify-between p-4 text-left font-medium',
                'transition-colors hover:bg-muted/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.trigger}
              </span>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                    opacity: { duration: 0.2 },
                  }}
                >
                  <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
```

## Plus/Minus Icon Variant

```typescript
'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const PlusMinusAccordion = AccordionPrimitive.Root;

const PlusMinusAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b', className)}
    {...props}
  />
));

const PlusMinusAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 font-medium',
        'transition-all hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'group',
        className
      )}
      {...props}
    >
      {children}
      <div className="relative h-5 w-5">
        <Plus className="absolute inset-0 h-5 w-5 transition-opacity group-data-[state=open]:opacity-0" />
        <Minus className="absolute inset-0 h-5 w-5 opacity-0 transition-opacity group-data-[state=open]:opacity-100" />
      </div>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));

const PlusMinusAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm',
      'data-[state=closed]:animate-accordion-up',
      'data-[state=open]:animate-accordion-down',
      className
    )}
    {...props}
  >
    <div className="pb-4 pt-0 text-muted-foreground">{children}</div>
  </AccordionPrimitive.Content>
));

export {
  PlusMinusAccordion,
  PlusMinusAccordionItem,
  PlusMinusAccordionTrigger,
  PlusMinusAccordionContent,
};
```

## FAQ Accordion

```typescript
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FAQItem {
  id: string;
  question: string;
  answer: string | React.ReactNode;
  category?: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

function FAQAccordion({ items, className }: FAQAccordionProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Group by category if present
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, FAQItem[]>();
    items.forEach((item) => {
      const category = item.category || 'General';
      const existing = groups.get(category) || [];
      groups.set(category, [...existing, item]);
    });
    return groups;
  }, [items]);

  const hasCategories = items.some((item) => item.category);

  return (
    <div className={cn('space-y-6', className)}>
      {hasCategories ? (
        Array.from(groupedItems.entries()).map(([category, categoryItems]) => (
          <div key={category}>
            <h3 className="mb-4 text-lg font-semibold">{category}</h3>
            <div className="space-y-2">
              {categoryItems.map((item) => (
                <FAQItem
                  key={item.id}
                  item={item}
                  isOpen={openId === item.id}
                  onToggle={() =>
                    setOpenId(openId === item.id ? null : item.id)
                  }
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <FAQItem
              key={item.id}
              item={item}
              isOpen={openId === item.id}
              onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FAQItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between p-4 text-left',
          'font-medium transition-colors hover:bg-muted/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
        )}
        aria-expanded={isOpen}
      >
        <span>{item.question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          +
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-4 text-sm text-muted-foreground">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Nested Accordion

```typescript
'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NestedItem {
  id: string;
  label: string;
  content?: React.ReactNode;
  children?: NestedItem[];
}

interface NestedAccordionProps {
  items: NestedItem[];
  className?: string;
  level?: number;
}

function NestedAccordion({
  items,
  className,
  level = 0,
}: NestedAccordionProps) {
  return (
    <AccordionPrimitive.Root type="multiple" className={className}>
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.id} value={item.id}>
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger
              className={cn(
                'flex w-full items-center gap-2 py-2 text-sm font-medium',
                'transition-colors hover:text-primary',
                '[&[data-state=open]>svg]:rotate-90'
              )}
              style={{ paddingLeft: `${level * 1}rem` }}
            >
              {(item.children?.length || 0) > 0 && (
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
              )}
              {!item.children?.length && <span className="w-4" />}
              {item.label}
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>

          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            {item.content && (
              <div
                className="py-2 text-sm text-muted-foreground"
                style={{ paddingLeft: `${(level + 1) * 1 + 1}rem` }}
              >
                {item.content}
              </div>
            )}
            {item.children && item.children.length > 0 && (
              <NestedAccordion items={item.children} level={level + 1} />
            )}
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}

// Usage
<NestedAccordion
  items={[
    {
      id: 'getting-started',
      label: 'Getting Started',
      children: [
        {
          id: 'installation',
          label: 'Installation',
          content: 'Run npm install to get started.',
        },
        {
          id: 'configuration',
          label: 'Configuration',
          children: [
            { id: 'basic', label: 'Basic Setup', content: '...' },
            { id: 'advanced', label: 'Advanced Options', content: '...' },
          ],
        },
      ],
    },
  ]}
/>
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next trigger |
| `Shift+Tab` | Move focus to previous trigger |
| `Space` / `Enter` | Toggle focused item |
| `ArrowDown` | Move focus to next item (when focused) |
| `ArrowUp` | Move focus to previous item (when focused) |
| `Home` | Move focus to first item |
| `End` | Move focus to last item |

## Usage Examples

```tsx
// Basic accordion (single open)
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>Content for section 1</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>Content for section 2</AccordionContent>
  </AccordionItem>
</Accordion>

// Multiple open items
<Accordion type="multiple" defaultValue={['item-1']}>
  <AccordionItem value="item-1">...</AccordionItem>
  <AccordionItem value="item-2">...</AccordionItem>
</Accordion>

// Card variant
<Accordion type="single" collapsible>
  <AccordionItem value="item-1" variant="card">
    <AccordionTrigger variant="card" icon={<Settings />}>
      Settings
    </AccordionTrigger>
    <AccordionContent>Settings content</AccordionContent>
  </AccordionItem>
</Accordion>

// Plus/Minus variant
<PlusMinusAccordion type="single" collapsible>
  <PlusMinusAccordionItem value="q1">
    <PlusMinusAccordionTrigger>
      What is your return policy?
    </PlusMinusAccordionTrigger>
    <PlusMinusAccordionContent>
      We offer a 30-day return policy...
    </PlusMinusAccordionContent>
  </PlusMinusAccordionItem>
</PlusMinusAccordion>

// FAQ with categories
<FAQAccordion
  items={[
    { id: '1', question: 'How do I sign up?', answer: '...', category: 'Account' },
    { id: '2', question: 'How do I pay?', answer: '...', category: 'Billing' },
  ]}
/>

// Animated with Framer Motion
<AnimatedAccordion
  type="multiple"
  items={[
    { id: '1', trigger: 'First item', content: 'Content 1' },
    { id: '2', trigger: 'Second item', content: 'Content 2' },
  ]}
/>
```

## Key Takeaways

1. **Radix Base**: Built on @radix-ui/react-accordion for accessibility
2. **Animation**: CSS keyframes with --radix-accordion-content-height
3. **Framer Motion**: Enhanced animations with AnimatePresence
4. **Variants**: default, card, plus/minus icon styles
5. **Types**: single (one open) or multiple (many open)
6. **Nested**: Support for hierarchical content structures
