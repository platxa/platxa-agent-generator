# Tabs Component

Accessible tabs built on Radix UI Tabs primitive with full keyboard navigation.

## Dependencies

```bash
pnpm add @radix-ui/react-tabs
```

## Base Tabs Component

```typescript
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

// TabsList variants
const tabsListVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'rounded-lg bg-muted p-1 text-muted-foreground',
        underline: 'border-b border-border gap-4',
        pills: 'gap-2',
        segment: 'rounded-full bg-muted p-1',
      },
      size: {
        sm: 'h-8',
        default: 'h-10',
        lg: 'h-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, size, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant, size }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// TabsTrigger variants
const tabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium',
    'ring-offset-background transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'rounded-md px-3 py-1.5',
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        ],
        underline: [
          'pb-3 pt-2 px-1 relative',
          'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
          'after:bg-transparent after:transition-colors',
          'data-[state=active]:text-foreground data-[state=active]:after:bg-primary',
          'hover:text-foreground',
        ],
        pills: [
          'rounded-full px-4 py-2',
          'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
          'hover:bg-muted',
        ],
        segment: [
          'rounded-full px-4 py-1.5',
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        ],
      },
      size: {
        sm: 'text-xs',
        default: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, size, icon, badge, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, size }), className)}
    {...props}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {children}
    {badge && <span className="ml-2">{badge}</span>}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// TabsContent
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Animation
      'data-[state=inactive]:hidden',
      'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

## Animated Tabs with Indicator

```typescript
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }>;
  defaultValue?: string;
  className?: string;
}

function AnimatedTabs({ tabs, defaultValue, className }: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue ?? tabs[0]?.id);
  const [tabRects, setTabRects] = React.useState<Map<string, DOMRect>>(new Map());
  const tabsRef = React.useRef<HTMLDivElement>(null);

  // Measure tab positions
  React.useEffect(() => {
    if (!tabsRef.current) return;

    const updateRects = () => {
      const newRects = new Map<string, DOMRect>();
      tabs.forEach((tab) => {
        const el = tabsRef.current?.querySelector(`[data-tab-id="${tab.id}"]`);
        if (el) {
          newRects.set(tab.id, el.getBoundingClientRect());
        }
      });
      setTabRects(newRects);
    };

    updateRects();
    window.addEventListener('resize', updateRects);
    return () => window.removeEventListener('resize', updateRects);
  }, [tabs]);

  const activeRect = tabRects.get(activeTab);
  const listRect = tabsRef.current?.getBoundingClientRect();

  return (
    <TabsPrimitive.Root
      value={activeTab}
      onValueChange={setActiveTab}
      className={className}
    >
      <TabsPrimitive.List
        ref={tabsRef}
        className="relative inline-flex items-center rounded-lg bg-muted p-1"
      >
        {/* Animated indicator */}
        {activeRect && listRect && (
          <motion.div
            className="absolute inset-y-1 rounded-md bg-background shadow-sm"
            initial={false}
            animate={{
              left: activeRect.left - listRect.left,
              width: activeRect.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 35,
            }}
          />
        )}

        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            data-tab-id={tab.id}
            className={cn(
              'relative z-10 inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium',
              'transition-colors',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content key={tab.id} value={tab.id} className="mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab.content}
          </motion.div>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
```

## Vertical Tabs

```typescript
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

interface VerticalTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    description?: string;
    content: React.ReactNode;
  }>;
  defaultValue?: string;
  className?: string;
}

function VerticalTabs({ tabs, defaultValue, className }: VerticalTabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? tabs[0]?.id}
      orientation="vertical"
      className={cn('flex gap-6', className)}
    >
      <TabsPrimitive.List className="flex flex-col space-y-1 border-r pr-4">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
              'hover:bg-muted',
              'data-[state=active]:bg-muted data-[state=active]:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            {tab.icon && (
              <span className="mt-0.5 text-muted-foreground">{tab.icon}</span>
            )}
            <div>
              <div className="font-medium">{tab.label}</div>
              {tab.description && (
                <div className="text-xs text-muted-foreground">
                  {tab.description}
                </div>
              )}
            </div>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className="flex-1">
        {tabs.map((tab) => (
          <TabsPrimitive.Content
            key={tab.id}
            value={tab.id}
            className="focus-visible:outline-none"
          >
            {tab.content}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
}
```

## Scrollable Tabs

```typescript
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollableTabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  defaultValue?: string;
  className?: string;
}

function ScrollableTabs({ tabs, defaultValue, className }: ScrollableTabsProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.5;
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? tabs[0]?.id}
      className={className}
    >
      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className={cn(
              'absolute left-0 top-0 z-10 flex h-full items-center',
              'bg-gradient-to-r from-background via-background to-transparent pl-1 pr-4'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable tabs */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex overflow-x-auto scrollbar-none"
        >
          <TabsPrimitive.List className="inline-flex h-10 items-center gap-1 rounded-lg bg-muted p-1">
            {tabs.map((tab) => (
              <TabsPrimitive.Trigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5',
                  'text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm'
                )}
              >
                {tab.label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
        </div>

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className={cn(
              'absolute right-0 top-0 z-10 flex h-full items-center',
              'bg-gradient-to-l from-background via-background to-transparent pl-4 pr-1'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {tabs.map((tab) => (
        <TabsPrimitive.Content key={tab.id} value={tab.id} className="mt-4">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
```

## Controlled Tabs with URL Sync

```typescript
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface URLSyncTabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  paramName?: string;
  defaultValue?: string;
}

function URLSyncTabs({
  tabs,
  paramName = 'tab',
  defaultValue,
}: URLSyncTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get(paramName) ?? defaultValue ?? tabs[0]?.id;

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

## Keyboard Navigation

Radix Tabs provides comprehensive keyboard support:

| Key | Action |
|-----|--------|
| `Tab` | Move focus to active tab, then to content |
| `ArrowLeft` | Focus previous tab (horizontal) |
| `ArrowRight` | Focus next tab (horizontal) |
| `ArrowUp` | Focus previous tab (vertical) |
| `ArrowDown` | Focus next tab (vertical) |
| `Home` | Focus first tab |
| `End` | Focus last tab |
| `Space` / `Enter` | Activate focused tab |

### Activation Modes

```typescript
// Automatic activation (default) - tab activates on focus
<Tabs activationMode="automatic">
  ...
</Tabs>

// Manual activation - requires Enter/Space to activate
<Tabs activationMode="manual">
  ...
</Tabs>
```

## Accessibility Features

```typescript
// Proper ARIA structure provided by Radix
<Tabs defaultValue="tab1" aria-label="Account settings">
  <TabsList aria-label="Settings sections">
    <TabsTrigger value="tab1">Profile</TabsTrigger>
    <TabsTrigger value="tab2">Security</TabsTrigger>
    <TabsTrigger value="tab3" disabled>
      Billing (Coming soon)
    </TabsTrigger>
  </TabsList>

  <TabsContent value="tab1">
    <h2 id="profile-heading">Profile Settings</h2>
    {/* Content */}
  </TabsContent>

  <TabsContent value="tab2">
    <h2 id="security-heading">Security Settings</h2>
    {/* Content */}
  </TabsContent>
</Tabs>
```

## Usage Examples

```tsx
// Basic tabs
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="analytics">Analytics content</TabsContent>
  <TabsContent value="reports">Reports content</TabsContent>
</Tabs>

// Underline variant
<Tabs defaultValue="tab1">
  <TabsList variant="underline">
    <TabsTrigger variant="underline" value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger variant="underline" value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  ...
</Tabs>

// Pills variant with icons
<Tabs defaultValue="inbox">
  <TabsList variant="pills">
    <TabsTrigger variant="pills" value="inbox" icon={<Inbox />}>
      Inbox
    </TabsTrigger>
    <TabsTrigger variant="pills" value="sent" icon={<Send />}>
      Sent
    </TabsTrigger>
  </TabsList>
  ...
</Tabs>

// With badges
<TabsTrigger value="notifications" badge={<Badge>3</Badge>}>
  Notifications
</TabsTrigger>

// Animated tabs
<AnimatedTabs
  tabs={[
    { id: 'all', label: 'All', content: <AllItems /> },
    { id: 'active', label: 'Active', content: <ActiveItems /> },
    { id: 'completed', label: 'Completed', content: <CompletedItems /> },
  ]}
/>

// Vertical tabs
<VerticalTabs
  tabs={[
    {
      id: 'profile',
      label: 'Profile',
      icon: <User />,
      description: 'Manage your profile',
      content: <ProfileSettings />,
    },
    {
      id: 'security',
      label: 'Security',
      icon: <Shield />,
      description: 'Password and 2FA',
      content: <SecuritySettings />,
    },
  ]}
/>
```

## Key Takeaways

1. **Radix Base**: Built on @radix-ui/react-tabs for accessibility
2. **Variants**: default, underline, pills, segment styles
3. **Keyboard**: Full arrow key navigation, Home/End support
4. **Animated**: Sliding indicator with Framer Motion
5. **Orientations**: Horizontal and vertical layouts
6. **URL Sync**: Optional query parameter synchronization
