# Layout Animation System

Animate element position and size changes automatically using Framer Motion's layout animations.

## Overview

Layout animations automatically animate:
- Position changes (reordering, filtering)
- Size changes (expanding, collapsing)
- Grid/flex redistributions
- Parent resize effects

## Basic Layout Animation

### The `layout` Prop

```typescript
import { motion } from "framer-motion"

// Enable automatic layout animation
<motion.div layout>
  Content that will animate when position changes
</motion.div>

// Different layout animation types
<motion.div layout>                    {/* Animate position + size */}
<motion.div layout="position">         {/* Animate position only */}
<motion.div layout="size">             {/* Animate size only */}
<motion.div layout="preserve-aspect">  {/* Maintain aspect ratio */}
```

### Layout Transition

```typescript
// Customize the layout animation
<motion.div
  layout
  transition={{
    layout: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }}
>
  Content
</motion.div>
```

## Animated List

### Reorderable List

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"

interface Item {
  id: string
  content: string
}

interface ReorderableListProps {
  items: Item[]
  onReorder: (items: Item[]) => void
}

export const ReorderableList = ({ items, onReorder }: ReorderableListProps) => {
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className="space-y-2"
    >
      <AnimatePresence>
        {items.map((item) => (
          <Reorder.Item
            key={item.id}
            value={item}
            className="cursor-grab active:cursor-grabbing"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            whileDrag={{
              scale: 1.02,
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)"
            }}
          >
            <div className="rounded-lg border bg-card p-4">
              {item.content}
            </div>
          </Reorder.Item>
        ))}
      </AnimatePresence>
    </Reorder.Group>
  )
}

// Usage
const [items, setItems] = React.useState([
  { id: "1", content: "Item 1" },
  { id: "2", content: "Item 2" },
  { id: "3", content: "Item 3" }
])

<ReorderableList items={items} onReorder={setItems} />
```

### Filterable List

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface FilterableListProps<T> {
  items: T[]
  filter: (item: T) => boolean
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function FilterableList<T>({
  items,
  filter,
  renderItem,
  keyExtractor
}: FilterableListProps<T>) {
  const filteredItems = items.filter(filter)

  return (
    <motion.div layout className="space-y-2">
      <AnimatePresence mode="popLayout">
        {filteredItems.map((item) => (
          <motion.div
            key={keyExtractor(item)}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              opacity: { duration: 0.2 },
              layout: { type: "spring", stiffness: 300, damping: 30 }
            }}
          >
            {renderItem(item)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// Usage
const [search, setSearch] = React.useState("")

<input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Filter..."
/>

<FilterableList
  items={todos}
  filter={(todo) => todo.title.toLowerCase().includes(search.toLowerCase())}
  renderItem={(todo) => <TodoCard todo={todo} />}
  keyExtractor={(todo) => todo.id}
/>
```

### Sortable Grid

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

type SortKey = "name" | "date" | "size"

interface SortableGridProps<T> {
  items: T[]
  sortKey: SortKey
  getSortValue: (item: T, key: SortKey) => string | number | Date
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

export function SortableGrid<T>({
  items,
  sortKey,
  getSortValue,
  renderItem,
  keyExtractor
}: SortableGridProps<T>) {
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
  }, [items, sortKey, getSortValue])

  return (
    <motion.div
      layout
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {sortedItems.map((item) => (
          <motion.div
            key={keyExtractor(item)}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              layout: { type: "spring", stiffness: 300, damping: 30 }
            }}
          >
            {renderItem(item)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
```

## Layout ID (Shared Layout)

### Hero Animation

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Card {
  id: string
  title: string
  image: string
  description: string
}

interface HeroExpandProps {
  cards: Card[]
}

export const HeroExpand = ({ cards }: HeroExpandProps) => {
  const [selected, setSelected] = React.useState<Card | null>(null)

  return (
    <>
      {/* Grid of cards */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            layoutId={`card-${card.id}`}
            onClick={() => setSelected(card)}
            className="cursor-pointer rounded-lg border bg-card overflow-hidden"
          >
            <motion.img
              layoutId={`image-${card.id}`}
              src={card.image}
              alt={card.title}
              className="w-full h-40 object-cover"
            />
            <motion.h3
              layoutId={`title-${card.id}`}
              className="p-4 font-semibold"
            >
              {card.title}
            </motion.h3>
          </motion.div>
        ))}
      </div>

      {/* Expanded card overlay */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelected(null)}
            />

            <motion.div
              layoutId={`card-${selected.id}`}
              className="fixed inset-4 md:inset-20 z-50 rounded-xl bg-card overflow-hidden"
            >
              <motion.img
                layoutId={`image-${selected.id}`}
                src={selected.image}
                alt={selected.title}
                className="w-full h-64 object-cover"
              />
              <div className="p-6">
                <motion.h2
                  layoutId={`title-${selected.id}`}
                  className="text-2xl font-bold"
                >
                  {selected.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 text-muted-foreground"
                >
                  {selected.description}
                </motion.p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-background/80"
              >
                ✕
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

### Tab Content Animation

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

interface AnimatedTabsProps {
  tabs: Tab[]
}

export const AnimatedTabs = ({ tabs }: AnimatedTabsProps) => {
  const [activeTab, setActiveTab] = React.useState(tabs[0].id)

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative px-4 py-2 text-sm font-medium"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {tabs.map((tab) => (
          tab.id === activeTab && (
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {tab.content}
            </motion.div>
          )
        ))}
      </div>
    </div>
  )
}
```

## Accordion with Layout

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

interface AccordionItem {
  id: string
  title: string
  content: React.ReactNode
}

interface LayoutAccordionProps {
  items: AccordionItem[]
  allowMultiple?: boolean
}

export const LayoutAccordion = ({
  items,
  allowMultiple = false
}: LayoutAccordionProps) => {
  const [expanded, setExpanded] = React.useState<string[]>([])

  const toggle = (id: string) => {
    if (allowMultiple) {
      setExpanded((prev) =>
        prev.includes(id)
          ? prev.filter((i) => i !== id)
          : [...prev, id]
      )
    } else {
      setExpanded((prev) =>
        prev.includes(id) ? [] : [id]
      )
    }
  }

  return (
    <motion.div layout className="space-y-2">
      {items.map((item) => {
        const isExpanded = expanded.includes(item.id)

        return (
          <motion.div
            key={item.id}
            layout
            className="rounded-lg border overflow-hidden"
          >
            <motion.button
              layout="position"
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between p-4 font-medium"
            >
              <span>{item.title}</span>
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.span>
            </motion.button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                >
                  <div className="p-4 pt-0">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
```

## Masonry Layout

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface MasonryItem {
  id: string
  height: number
  content: React.ReactNode
}

interface MasonryGridProps {
  items: MasonryItem[]
  columns?: number
}

export const MasonryGrid = ({ items, columns = 3 }: MasonryGridProps) => {
  // Distribute items across columns
  const columnItems = React.useMemo(() => {
    const cols: MasonryItem[][] = Array.from({ length: columns }, () => [])
    const heights = new Array(columns).fill(0)

    items.forEach((item) => {
      // Add to shortest column
      const shortestCol = heights.indexOf(Math.min(...heights))
      cols[shortestCol].push(item)
      heights[shortestCol] += item.height
    })

    return cols
  }, [items, columns])

  return (
    <div className="flex gap-4">
      {columnItems.map((column, colIndex) => (
        <div key={colIndex} className="flex-1 space-y-4">
          <AnimatePresence mode="popLayout">
            {column.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 }
                }}
                style={{ height: item.height }}
                className="rounded-lg border bg-card"
              >
                {item.content}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
```

## Layout Group

For coordinated animations across components:

```typescript
"use client"

import * as React from "react"
import { motion, LayoutGroup } from "framer-motion"

interface LayoutGroupDemoProps {
  items: { id: string; label: string }[]
}

export const LayoutGroupDemo = ({ items }: LayoutGroupDemoProps) => {
  const [selected, setSelected] = React.useState<string[]>([])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    )
  }

  return (
    <LayoutGroup>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isSelected = selected.includes(item.id)

          return (
            <motion.button
              key={item.id}
              layout
              onClick={() => toggle(item.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {item.label}
            </motion.button>
          )
        })}
      </div>

      {/* Selected items section */}
      <motion.div layout className="mt-4 flex flex-wrap gap-2">
        {selected.map((id) => {
          const item = items.find((i) => i.id === id)
          if (!item) return null

          return (
            <motion.span
              key={id}
              layoutId={id}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm"
            >
              {item.label}
            </motion.span>
          )
        })}
      </motion.div>
    </LayoutGroup>
  )
}
```

## Performance Tips

```typescript
/**
 * Layout Animation Performance Tips
 */

// 1. Use layout="position" when only position changes
<motion.div layout="position">
  {/* Size won't animate, only position */}
</motion.div>

// 2. Wrap text in motion.span with layout="position"
<motion.div layout>
  <motion.span layout="position">
    Text that won't distort during layout animation
  </motion.span>
</motion.div>

// 3. Use layoutId sparingly - only for hero animations
// Excessive layoutId usage can cause performance issues

// 4. Disable layout on deeply nested children
<motion.div layout>
  <div layout={false}>
    {/* This won't participate in layout animation */}
  </div>
</motion.div>

// 5. Use AnimatePresence mode="popLayout" for exit animations
<AnimatePresence mode="popLayout">
  {items.map((item) => (
    <motion.div key={item.id} layout exit={{ opacity: 0 }}>
      {item.content}
    </motion.div>
  ))}
</AnimatePresence>
```

## Reduced Motion Support

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"

/**
 * Layout animation with reduced motion support
 */
export const AccessibleLayoutList = <T,>({
  items,
  renderItem,
  keyExtractor
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}) => {
  const prefersReduced = usePrefersReducedMotion()

  return (
    <motion.div layout={!prefersReduced} className="space-y-2">
      {items.map((item) => (
        <motion.div
          key={keyExtractor(item)}
          layout={!prefersReduced}
          transition={
            prefersReduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 30 }
          }
        >
          {renderItem(item)}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use `layout` on items that move | Apply to everything |
| Use `layoutId` for hero animations | Overuse layoutId |
| Wrap text in `layout="position"` | Let text distort |
| Use `AnimatePresence mode="popLayout"` | Forget exit animations |
| Test with many items | Only test small lists |
| Respect reduced motion | Ignore accessibility |

## Export

```typescript
export {
  ReorderableList,
  FilterableList,
  SortableGrid,
  HeroExpand,
  AnimatedTabs,
  LayoutAccordion,
  MasonryGrid,
  LayoutGroupDemo,
  AccessibleLayoutList
}
```
