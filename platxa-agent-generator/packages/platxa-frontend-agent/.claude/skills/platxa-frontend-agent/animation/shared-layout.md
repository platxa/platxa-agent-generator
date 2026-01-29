# Shared Layout Animations with layoutId

Create seamless morphing animations between elements using Framer Motion's layoutId for hero transitions and state changes.

## Overview

`layoutId` creates a visual connection between components:
- Elements with matching `layoutId` morph into each other
- Works across component boundaries
- Enables "magic move" hero animations
- Perfect for card-to-modal, list-to-detail, navigation indicators

## Basic Concept

```typescript
import { motion, AnimatePresence } from "framer-motion"

// Two elements with same layoutId will animate between each other
{isExpanded ? (
  <motion.div layoutId="box" className="w-64 h-64 bg-blue-500" />
) : (
  <motion.div layoutId="box" className="w-16 h-16 bg-blue-500" />
)}
```

## Card to Modal Pattern

### Basic Implementation

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface Card {
  id: string
  title: string
  subtitle: string
  image: string
  content: string
}

interface CardModalProps {
  cards: Card[]
}

export const CardModal = ({ cards }: CardModalProps) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selectedCard = cards.find((c) => c.id === selectedId)

  return (
    <>
      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            layoutId={`card-container-${card.id}`}
            onClick={() => setSelectedId(card.id)}
            className="cursor-pointer rounded-xl border bg-card overflow-hidden"
          >
            <motion.img
              layoutId={`card-image-${card.id}`}
              src={card.image}
              alt={card.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <motion.h3
                layoutId={`card-title-${card.id}`}
                className="font-semibold text-lg"
              >
                {card.title}
              </motion.h3>
              <motion.p
                layoutId={`card-subtitle-${card.id}`}
                className="text-sm text-muted-foreground"
              >
                {card.subtitle}
              </motion.p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {selectedId && selectedCard && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                layoutId={`card-container-${selectedId}`}
                className="w-full max-w-2xl rounded-xl bg-card overflow-hidden shadow-2xl"
              >
                <motion.img
                  layoutId={`card-image-${selectedId}`}
                  src={selectedCard.image}
                  alt={selectedCard.title}
                  className="w-full h-72 object-cover"
                />
                <div className="p-6">
                  <motion.h2
                    layoutId={`card-title-${selectedId}`}
                    className="text-2xl font-bold"
                  >
                    {selectedCard.title}
                  </motion.h2>
                  <motion.p
                    layoutId={`card-subtitle-${selectedId}`}
                    className="text-muted-foreground mt-1"
                  >
                    {selectedCard.subtitle}
                  </motion.p>

                  {/* Additional content that fades in */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: 0.1 }}
                    className="mt-6"
                  >
                    <p className="text-foreground leading-relaxed">
                      {selectedCard.content}
                    </p>
                  </motion.div>
                </div>

                {/* Close button */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedId(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-background/80 hover:bg-background"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

## Navigation Indicator

### Tab Indicator

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export const TabNav = ({ tabs, activeTab, onTabChange }: TabNavProps) => {
  return (
    <nav className="flex space-x-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative px-4 py-2 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {/* Sliding background indicator */}
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35
              }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
```

### Pill Navigation

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavItem {
  href: string
  label: string
}

interface PillNavProps {
  items: NavItem[]
}

export const PillNav = ({ items }: PillNavProps) => {
  const pathname = usePathname()

  return (
    <nav className="flex space-x-2">
      {items.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-4 py-2 rounded-full text-sm font-medium",
              isActive ? "text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30
                }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

## Image Gallery

### Gallery with Lightbox

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface Image {
  id: string
  src: string
  alt: string
  width: number
  height: number
}

interface GalleryProps {
  images: Image[]
}

export const Gallery = ({ images }: GalleryProps) => {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null

  const goNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length)
    }
  }

  const goPrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length)
    }
  }

  return (
    <>
      {/* Thumbnail Grid */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {images.map((image, index) => (
          <motion.button
            key={image.id}
            layoutId={`image-${image.id}`}
            onClick={() => setSelectedIndex(index)}
            className="relative aspect-square overflow-hidden rounded-lg"
          >
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIndex(null)}
              className="absolute inset-0 bg-black/90"
            />

            {/* Image */}
            <motion.div
              layoutId={`image-${selectedImage.id}`}
              className="relative z-10 max-w-4xl max-h-[80vh]"
            >
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </motion.div>

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-4 flex justify-between px-4 z-20"
            >
              <span className="text-white/80 text-sm">
                {selectedIndex! + 1} / {images.length}
              </span>
              <button
                onClick={() => setSelectedIndex(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </motion.div>

            {/* Navigation */}
            <button
              onClick={goPrev}
              className="absolute left-4 z-20 p-2 text-white/80 hover:text-white"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-4 z-20 p-2 text-white/80 hover:text-white"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
```

## List to Detail Pattern

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft } from "lucide-react"

interface Item {
  id: string
  title: string
  description: string
  image: string
  details: React.ReactNode
}

interface ListDetailProps {
  items: Item[]
}

export const ListDetail = ({ items }: ListDetailProps) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selectedItem = items.find((i) => i.id === selectedId)

  return (
    <div className="relative min-h-[500px]">
      {/* List View */}
      <AnimatePresence>
        {!selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {items.map((item) => (
              <motion.button
                key={item.id}
                layoutId={`item-${item.id}`}
                onClick={() => setSelectedId(item.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card text-left hover:bg-accent/50 transition-colors"
              >
                <motion.img
                  layoutId={`image-${item.id}`}
                  src={item.image}
                  alt={item.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <motion.h3
                    layoutId={`title-${item.id}`}
                    className="font-semibold truncate"
                  >
                    {item.title}
                  </motion.h3>
                  <motion.p
                    layoutId={`desc-${item.id}`}
                    className="text-sm text-muted-foreground truncate"
                  >
                    {item.description}
                  </motion.p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail View */}
      <AnimatePresence>
        {selectedId && selectedItem && (
          <motion.div
            layoutId={`item-${selectedId}`}
            className="absolute inset-0 rounded-xl border bg-card overflow-hidden"
          >
            <motion.img
              layoutId={`image-${selectedId}`}
              src={selectedItem.image}
              alt={selectedItem.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-6">
              <motion.h2
                layoutId={`title-${selectedId}`}
                className="text-2xl font-bold"
              >
                {selectedItem.title}
              </motion.h2>
              <motion.p
                layoutId={`desc-${selectedId}`}
                className="text-muted-foreground mt-1"
              >
                {selectedItem.description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6"
              >
                {selectedItem.details}
              </motion.div>
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setSelectedId(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-background/80 hover:bg-background"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

## Switch/Toggle Animation

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export const AnimatedSwitch = ({
  checked,
  onCheckedChange,
  disabled = false
}: AnimatedSwitchProps) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 700,
          damping: 30
        }}
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm",
          checked ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  )
}
```

## Avatar Stack Expand

```typescript
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface User {
  id: string
  name: string
  avatar: string
}

interface AvatarStackProps {
  users: User[]
  max?: number
}

export const AvatarStack = ({ users, max = 3 }: AvatarStackProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const visibleUsers = isExpanded ? users : users.slice(0, max)
  const remaining = users.length - max

  return (
    <motion.div
      layout
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "flex cursor-pointer",
        isExpanded ? "flex-wrap gap-2" : "-space-x-3"
      )}
    >
      <AnimatePresence mode="popLayout">
        {visibleUsers.map((user, index) => (
          <motion.div
            key={user.id}
            layoutId={`avatar-${user.id}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              delay: isExpanded ? index * 0.05 : 0
            }}
            className="relative"
          >
            <img
              src={user.avatar}
              alt={user.name}
              className={cn(
                "rounded-full border-2 border-background",
                isExpanded ? "w-12 h-12" : "w-10 h-10"
              )}
            />
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap"
              >
                {user.name}
              </motion.span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {!isExpanded && remaining > 0 && (
        <motion.div
          layoutId="avatar-overflow"
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium border-2 border-background"
        >
          +{remaining}
        </motion.div>
      )}
    </motion.div>
  )
}
```

## Cross-Route Transitions

```typescript
// For Next.js App Router with route transitions
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

interface SharedLayoutProviderProps {
  children: React.ReactNode
}

// Store for cross-route shared elements
const SharedLayoutContext = React.createContext<{
  registerElement: (id: string, element: HTMLElement) => void
  unregisterElement: (id: string) => void
}>({
  registerElement: () => {},
  unregisterElement: () => {}
})

export const SharedLayoutProvider = ({ children }: SharedLayoutProviderProps) => {
  const pathname = usePathname()
  const elementsRef = React.useRef<Map<string, HTMLElement>>(new Map())

  const registerElement = React.useCallback((id: string, element: HTMLElement) => {
    elementsRef.current.set(id, element)
  }, [])

  const unregisterElement = React.useCallback((id: string) => {
    elementsRef.current.delete(id)
  }, [])

  return (
    <SharedLayoutContext.Provider value={{ registerElement, unregisterElement }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </SharedLayoutContext.Provider>
  )
}

// Hook to register shared elements
export const useSharedElement = (id: string) => {
  const ref = React.useRef<HTMLElement>(null)
  const { registerElement, unregisterElement } = React.useContext(SharedLayoutContext)

  React.useEffect(() => {
    if (ref.current) {
      registerElement(id, ref.current)
    }
    return () => unregisterElement(id)
  }, [id, registerElement, unregisterElement])

  return ref
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Use unique, stable layoutIds | Use array indices as layoutIds |
| Match element structure | Morph between different DOM trees |
| Use AnimatePresence for exit | Forget exit animations |
| Keep layoutIds scoped | Use same layoutId across pages |
| Animate shared properties | Animate unrelated elements |
| Test intermediate states | Only test start/end |

## Performance Tips

```typescript
// 1. Use layout="position" for child text
<motion.div layoutId="card">
  <motion.h3 layout="position">{title}</motion.h3>
</motion.div>

// 2. Limit the number of layoutId elements
// Too many can cause performance issues

// 3. Use will-change for complex animations
<motion.div
  layoutId="hero"
  style={{ willChange: "transform" }}
/>

// 4. Avoid layoutId on frequently updating components
// Use regular layout prop instead
```

## Export

```typescript
export {
  CardModal,
  TabNav,
  PillNav,
  Gallery,
  ListDetail,
  AnimatedSwitch,
  AvatarStack,
  SharedLayoutProvider,
  useSharedElement
}
```
