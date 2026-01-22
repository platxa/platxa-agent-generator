# Tutorial 1: Setup Walkthrough

**Video Duration:** ~10 minutes
**Level:** Beginner
**Prerequisites:** Node.js 18+, npm/pnpm

---

## Video Script

### [0:00] Introduction

> "Welcome to Platxa Frontend Agent! In this tutorial, we'll walk through setting up the agent in your project. By the end, you'll have a fully configured environment ready to generate beautiful, accessible UI components."

**On Screen:** Platxa logo, tutorial title

---

### [0:30] Prerequisites Check

> "Before we begin, let's verify you have the prerequisites installed."

**Terminal Commands:**
```bash
# Check Node.js version (need 18+)
node --version

# Check package manager
npm --version
# or
pnpm --version
```

**Expected Output:**
```
v20.10.0
10.2.0
```

> "Great! We're running Node 20 and npm 10. If you're on an older version, visit nodejs.org to upgrade."

---

### [1:30] Project Setup

> "Let's create a new React project. We'll use Vite for fast development."

**Terminal Commands:**
```bash
# Create new Vite project
npm create vite@latest my-platxa-app -- --template react-ts

# Navigate to project
cd my-platxa-app

# Install dependencies
npm install
```

**On Screen:** Terminal showing installation progress

> "Vite scaffolds a clean React TypeScript project. Now let's add Platxa."

---

### [2:30] Installing Platxa Frontend Agent

> "Install the Platxa Frontend Agent package along with its peer dependencies."

**Terminal Commands:**
```bash
# Install Platxa Frontend Agent
npm install @platxa/frontend-agent

# Install peer dependencies
npm install tailwindcss@next @tailwindcss/postcss postcss
npm install framer-motion class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-slot
```

**On Screen:** Package installation output

> "We're installing Tailwind CSS v4, Framer Motion for animations, CVA for component variants, and Radix primitives for accessibility."

---

### [3:30] Configuring Tailwind CSS

> "Create the Tailwind CSS configuration for version 4's CSS-first approach."

**File: `src/styles/main.css`**
```css
@import "tailwindcss";

/* Import Platxa brand tokens */
@import "@platxa/frontend-agent/styles/tokens.css";

/* Custom theme overrides */
@theme {
  --color-primary: oklch(0.7 0.15 250);
  --color-background: oklch(0.99 0 0);
  --color-foreground: oklch(0.15 0 0);
}
```

> "Tailwind v4 uses the @theme directive for customization. We're importing Platxa's default tokens and overriding the primary color."

---

### [4:30] PostCSS Configuration

> "Set up PostCSS to process our styles."

**File: `postcss.config.js`**
```javascript
import { postcssPlugin } from "@platxa/frontend-agent/postcss"

export default {
  plugins: {
    "@tailwindcss/postcss": {},
    // Platxa PostCSS plugin for brand token processing
    "@platxa/postcss": postcssPlugin({
      brandKit: "./brand-kit.json", // optional
    }),
  },
}
```

> "The Platxa PostCSS plugin transforms brand() and token() functions to CSS variables."

---

### [5:30] Creating the Utils File

> "Create the utility functions Platxa components rely on."

**File: `src/lib/utils.ts`**
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

> "The cn() function merges Tailwind classes intelligently, handling conflicts properly."

---

### [6:30] Your First Component

> "Let's generate our first component using the Platxa agent."

**Using Claude Code CLI:**
```bash
# In your project directory
claude

# Then ask:
> Generate a Button component with primary, secondary, and outline variants
```

**Expected Output: `src/components/ui/Button.tsx`**
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4 py-2",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

> "Beautiful! The agent generated a fully typed, accessible Button component with variants."

---

### [8:00] Testing the Component

> "Let's use our new component in the app."

**File: `src/App.tsx`**
```tsx
import { Button } from "./components/ui/Button"

function App() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Platxa Demo</h1>

      <div className="flex gap-4">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  )
}

export default App
```

**Terminal Commands:**
```bash
# Start development server
npm run dev
```

> "Open localhost:5173 in your browser. You should see three beautifully styled buttons!"

**On Screen:** Browser showing the rendered buttons

---

### [9:00] Verifying the Setup

> "Let's verify everything is working correctly."

**Checklist:**
- [ ] Buttons render with correct colors
- [ ] Hover states work smoothly
- [ ] Focus ring is visible on keyboard navigation
- [ ] No console errors

> "Press Tab to navigate between buttons. Notice the focus ring - that's accessibility in action!"

---

### [9:30] Troubleshooting

> "If you encounter issues, here are common fixes."

**Issue: Styles not applying**
```bash
# Ensure Tailwind is processing your CSS
npm run dev -- --force
```

**Issue: TypeScript errors**
```bash
# Update path aliases in tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Issue: Missing dependencies**
```bash
# Verify all packages installed
npm ls @platxa/frontend-agent
```

---

### [10:00] Wrap Up

> "Congratulations! You've successfully set up Platxa Frontend Agent. In the next tutorial, we'll create a custom brand kit with your own colors and design tokens."

**On Screen:**
- Links to next tutorial
- GitHub repository
- Documentation

> "Don't forget to like and subscribe for more Platxa tutorials. See you in the next one!"

---

## Resources

- [Platxa Documentation](https://github.com/anthropics/platxa-agent-generator)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [Next Tutorial: Custom Brand Creation](./02-custom-brand-creation.md)
