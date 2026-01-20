# Frontend Tooling Guide (2025-2026)

A comprehensive guide to modern frontend development tools and techniques based on current industry standards.

## Table of Contents

1. [Package Manager](#1-package-manager)
2. [Build Tool](#2-build-tool-vite)
3. [Framework](#3-framework-react-19)
4. [Styling](#4-styling-tailwind-css-v4)
5. [Component Library](#5-component-library-shadcnui)
6. [Testing](#6-testing)
7. [Linting & Formatting](#7-linting--formatting)
8. [TypeScript](#8-typescript)
9. [Documentation](#9-documentation-storybook-8)
10. [CI/CD](#10-cicd-github-actions)
11. [Quick Start](#11-quick-start)
12. [Uninstallation Guide](#12-uninstallation-guide)

---

## 1. Package Manager

### Recommendation: **pnpm** (Primary) or **Bun** (Speed-focused)

| Manager | Install Speed | Disk Usage | Monorepo Support | Maturity |
|---------|---------------|------------|------------------|----------|
| npm     | Baseline      | High       | Workspaces       | ★★★★★    |
| pnpm    | 2-3x faster   | 70% less   | Native           | ★★★★☆    |
| Bun     | 10-30x faster | Moderate   | Basic            | ★★★☆☆    |

### Installation

```bash
# pnpm (Recommended for production)
npm install -g pnpm
# or via corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate

# Bun (Speed-focused alternative)
curl -fsSL https://bun.sh/install | bash
# or on macOS
brew install oven-sh/bun/bun

# Verify installation
pnpm --version
bun --version
```

### Configuration

```bash
# Set pnpm as default for project
echo "packageManager=pnpm@9.15.0" >> package.json

# Create .npmrc for pnpm
cat > .npmrc << 'EOF'
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true
EOF
```

### Uninstallation

```bash
# pnpm
npm uninstall -g pnpm
# or if installed via corepack
corepack disable pnpm

# Bun
rm -rf ~/.bun
# Remove from PATH in ~/.bashrc or ~/.zshrc
```

### Sources
- [Package Manager Comparison 2026](https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc)
- [pnpm vs Bun Performance](https://betterstack.com/community/guides/scaling-nodejs/pnpm-vs-bun-install-vs-yarn/)

---

## 2. Build Tool: Vite

Vite is the industry standard for frontend tooling in 2025-2026, offering blazing-fast HMR and optimized builds via ESBuild and Rollup.

### Installation

```bash
# Create new project with Vite
pnpm create vite@latest my-app --template react-ts

# Add to existing project
pnpm add -D vite @vitejs/plugin-react
```

### Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
})
```

### Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

### Uninstallation

```bash
pnpm remove vite @vitejs/plugin-react
rm vite.config.ts
```

### Sources
- [Vite Official Documentation](https://vitejs.dev)
- [React + Vite Future of Web Development](https://devot.team/blog/react-vite)

---

## 3. Framework: React 19

React 19 with React Compiler is production-ready and offers automatic performance optimizations.

### Key Features (2025)
- **React Compiler 1.0**: Automatic memoization (no manual useMemo/useCallback needed)
- **Server Components**: Built-in SSR/SSG support
- **Actions API**: Simplified form handling
- **Activity Component**: Hidden mode for pre-rendering
- **12% performance improvement** with 2.5x faster interactions

### Installation

```bash
# New project
pnpm create vite@latest my-app --template react-ts
cd my-app
pnpm install

# Upgrade existing project to React 19
pnpm add react@19 react-dom@19
pnpm add -D @types/react@19 @types/react-dom@19
```

### React Compiler Setup

```bash
# Install React Compiler
pnpm add -D babel-plugin-react-compiler

# For Vite projects
pnpm add -D @vitejs/plugin-react
```

```typescript
// vite.config.ts with React Compiler
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', { target: '19' }],
        ],
      },
    }),
  ],
})
```

### ESLint Plugin for React Compiler

```bash
pnpm add -D eslint-plugin-react-compiler
```

```javascript
// eslint.config.js
import reactCompiler from 'eslint-plugin-react-compiler'

export default [
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
]
```

### Uninstallation

```bash
pnpm remove react react-dom
pnpm remove -D @types/react @types/react-dom babel-plugin-react-compiler
```

### Sources
- [React 19 Official Blog](https://react.dev/blog/2024/12/05/react-19)
- [React Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [React 19.2 Features](https://react.dev/blog/2025/10/01/react-19-2)

---

## 4. Styling: Tailwind CSS v4

Tailwind v4 introduces CSS-first configuration with the `@theme` directive, offering 3-10x faster builds.

### Key Features
- **CSS-first configuration**: No more `tailwind.config.js`
- **@theme directive**: Define design tokens in CSS
- **3D transforms**: Native 3D transform utilities
- **@starting-style**: CSS-only enter/exit animations
- **100x faster incremental rebuilds**

### Browser Requirements
- Safari 16.4+, Chrome 111+, Firefox 128+
- Node.js 20+

### Installation

```bash
# For Vite projects (recommended)
pnpm add -D tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### CSS Configuration

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  /* Colors */
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.7 0.15 180);
  --color-accent: oklch(0.65 0.25 30);

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Dark mode variables */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: oklch(0.15 0.01 250);
    --color-foreground: oklch(0.95 0.01 250);
  }
}
```

### Migration from v3

```bash
# Automated migration tool
npx @tailwindcss/upgrade@next
```

### Uninstallation

```bash
pnpm remove tailwindcss @tailwindcss/vite
# Remove CSS imports and @theme directives from CSS files
```

### Sources
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Theme Variables Documentation](https://tailwindcss.com/docs/theme)
- [Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)

---

## 5. Component Library: shadcn/ui

shadcn/ui provides copy-paste components built with Radix UI and Tailwind CSS, giving full ownership of code.

### Features
- **Full code ownership**: Components copied to your codebase
- **Tailwind v4 support**: Native @theme integration
- **Accessibility**: Built on Radix UI primitives
- **Customizable**: Modify any component directly

### Installation

```bash
# Initialize shadcn/ui
pnpm dlx shadcn@latest init

# When prompted, select:
# - TypeScript: Yes
# - Style: New York (recommended) or Default
# - Base color: Slate (or your preference)
# - CSS variables: Yes
# - Tailwind CSS: tailwind.config.ts
# - Components alias: @/components
# - Utils alias: @/lib/utils
```

### Adding Components

```bash
# Add individual components
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add dialog

# Add multiple components
pnpm dlx shadcn@latest add button card input label

# Add all components (not recommended for production)
pnpm dlx shadcn@latest add --all
```

### Project Structure

```
src/
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── index.ts
├── lib/
│   └── utils.ts      # cn() utility
└── styles/
    └── globals.css   # Tailwind + theme variables
```

### Utils Setup

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```bash
# Install required dependencies
pnpm add clsx tailwind-merge class-variance-authority
pnpm add @radix-ui/react-slot
```

### Uninstallation

```bash
# Remove shadcn components
rm -rf src/components/ui
rm src/lib/utils.ts

# Remove dependencies
pnpm remove clsx tailwind-merge class-variance-authority
pnpm remove @radix-ui/react-slot @radix-ui/react-dialog # etc.
```

### Sources
- [shadcn/ui Official](https://ui.shadcn.com/)
- [Tailwind v4 Integration](https://ui.shadcn.com/docs/tailwind-v4)
- [Installation Guide](https://ui.shadcn.com/docs/installation)

---

## 6. Testing

### Stack Overview

| Tool | Purpose | Speed |
|------|---------|-------|
| Vitest | Unit/Integration tests | Very Fast |
| Playwright | E2E/Visual regression | Fast |
| Testing Library | DOM testing utilities | - |

### Vitest Setup

```bash
# Install Vitest
pnpm add -D vitest @vitest/ui @vitest/coverage-v8

# React Testing Library
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# JSDOM for browser environment
pnpm add -D jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})
```

### Playwright Setup

```bash
# Install Playwright
pnpm add -D @playwright/test
pnpm exec playwright install
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Visual Regression Testing

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test'

test('homepage visual regression', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
  })
})

test('button component visual regression', async ({ page }) => {
  await page.goto('/components/button')
  await expect(page.locator('[data-testid="button"]')).toHaveScreenshot()
})
```

### Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "playwright test --update-snapshots"
  }
}
```

### Uninstallation

```bash
# Vitest
pnpm remove vitest @vitest/ui @vitest/coverage-v8
pnpm remove @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
rm vitest.config.ts

# Playwright
pnpm remove @playwright/test
rm -rf playwright.config.ts e2e/ playwright-report/ test-results/
```

### Sources
- [Vitest Visual Regression](https://vitest.dev/guide/browser/visual-regression-testing)
- [Playwright Visual Testing](https://testdino.com/blog/playwright-visual-testing/)
- [Vitest 4.0 Browser Mode](https://progosling.com/en/dev-digest/vitest-4-browser-stable-visual-regression)

---

## 7. Linting & Formatting

### Option A: ESLint v9 + Prettier (Traditional)

```bash
# ESLint v9 with flat config
pnpm add -D eslint @eslint/js typescript-eslint
pnpm add -D eslint-plugin-react eslint-plugin-react-hooks
pnpm add -D eslint-plugin-react-compiler

# Prettier
pnpm add -D prettier eslint-config-prettier
```

```javascript
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactCompiler from 'eslint-plugin-react-compiler'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-compiler/react-compiler': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.js'],
  }
)
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Option B: Biome (10-25x Faster)

```bash
# Install Biome
pnpm add -D @biomejs/biome
pnpm exec biome init
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "double"
    }
  }
}
```

### Migration from ESLint/Prettier to Biome

```bash
# Automated migration
pnpm exec biome migrate eslint --write
pnpm exec biome migrate prettier --write

# Remove old tools
pnpm remove eslint prettier eslint-config-prettier
pnpm remove @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks
rm .eslintrc* .prettierrc* eslint.config.js
```

### Scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

### Uninstallation

```bash
# ESLint + Prettier
pnpm remove eslint prettier @eslint/js typescript-eslint
pnpm remove eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier
rm eslint.config.js .prettierrc

# Biome
pnpm remove @biomejs/biome
rm biome.json
```

### Sources
- [ESLint Flat Config Migration](https://eslint.org/docs/latest/use/configure/migration-guide)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Biome vs ESLint 2025](https://medium.com/@harryespant/biome-vs-eslint-the-ultimate-2025-showdown-for-javascript-developers-speed-features-and-3e5130be4a3c)

---

## 8. TypeScript

### Current Version: TypeScript 5.7+ (5.8 Beta)

### Key Features
- **Satisfies operator**: Type validation without assertion
- **Decorators (Stage 3)**: Standard decorator support
- **erasableSyntaxOnly**: For Node.js/Bun type stripping
- **Never-initialized variable checks**: Better null safety

### Installation

```bash
pnpm add -D typescript @types/node
```

### Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    // Language & Environment
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict Type Checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // Module Options
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // Output
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,

    // Path Aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },

    // React
    "jsx": "react-jsx",

    // Decorators (if using)
    "experimentalDecorators": false,

    // Skip lib check for faster builds
    "skipLibCheck": true
  },
  "include": ["src/**/*", "*.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### React TypeScript Configuration

```json
// tsconfig.app.json (for Vite)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

### Uninstallation

```bash
pnpm remove typescript @types/node @types/react @types/react-dom
rm tsconfig.json tsconfig.app.json tsconfig.node.json
```

### Sources
- [TypeScript 5.0 Documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
- [State of TypeScript 2025](https://medium.com/@noroavetisyan/the-state-of-typescript-in-2025-architectural-maturity-ecosystem-dominance-and-the-erasable-fa746201c2e0)

---

## 9. Documentation: Storybook 8

### Features
- **Vitest integration**: Component testing in Storybook
- **Code coverage**: Built-in coverage reporting
- **a11y testing**: Real-time accessibility checks
- **Story reuse**: Use stories in unit tests

### Installation

```bash
# Initialize Storybook
pnpm dlx storybook@latest init

# Add testing addon
pnpm add -D @storybook/test @storybook/addon-coverage
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-coverage',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  viteFinal: async (config) => {
    return config
  },
}

export default config
```

### Story Example (CSF3)

```typescript
// src/components/ui/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Button } from './button'

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
  args: { onClick: fn() },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Button',
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
}
```

### Scripts

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test-storybook": "test-storybook"
  }
}
```

### Uninstallation

```bash
pnpm remove @storybook/react-vite storybook @storybook/addon-essentials
pnpm remove @storybook/addon-interactions @storybook/addon-a11y @storybook/test
rm -rf .storybook/ storybook-static/
```

### Sources
- [Storybook 8.5 Release](https://storybook.js.org/blog/storybook-8-5/)
- [Component Testing](https://storybook.js.org/docs/8/writing-tests/component-testing)
- [Vitest Addon](https://storybook.js.org/docs/writing-tests)

---

## 10. CI/CD: GitHub Actions

### Best Practices
- Use `pnpm ci` for deterministic installs
- Cache `node_modules` and `.pnpm-store`
- Use matrix builds for Node.js versions
- Parallelize independent jobs
- Use artifacts for test results

### Workflow Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  PNPM_VERSION: 9.15.0
  NODE_VERSION: 22

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: [test, e2e]
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

### Visual Regression Workflow

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression

on:
  workflow_dispatch:
  pull_request:
    types: [labeled]

jobs:
  update-snapshots:
    if: github.event.label.name == 'update-snapshots' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:visual

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update visual regression snapshots'
          file_pattern: '**/*.png'
```

### Sources
- [GitHub Actions Node.js](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs)
- [CI/CD Best Practices](https://securityboulevard.com/2025/11/how-to-build-and-implement-ci-cd-pipeline-with-github-actions/)

---

## 11. Quick Start

### Complete Project Setup (One Command)

```bash
#!/bin/bash
# scripts/setup-project.sh

set -e

PROJECT_NAME=${1:-my-app}

echo "🚀 Creating new project: $PROJECT_NAME"

# Create Vite + React + TypeScript project
pnpm create vite@latest $PROJECT_NAME --template react-ts
cd $PROJECT_NAME

# Install dependencies
pnpm install

# Add Tailwind CSS v4
pnpm add -D tailwindcss @tailwindcss/vite

# Add shadcn/ui dependencies
pnpm add clsx tailwind-merge class-variance-authority
pnpm add @radix-ui/react-slot

# Add testing tools
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
pnpm add -D @playwright/test

# Add Biome (linting/formatting)
pnpm add -D @biomejs/biome
pnpm exec biome init

# Add React Compiler
pnpm add -D babel-plugin-react-compiler eslint-plugin-react-compiler

# Install Playwright browsers
pnpm exec playwright install

# Initialize shadcn/ui
pnpm dlx shadcn@latest init -y

# Add common components
pnpm dlx shadcn@latest add button card input label

echo "✅ Project setup complete!"
echo "📁 cd $PROJECT_NAME"
echo "🏃 pnpm dev"
```

### Usage

```bash
chmod +x scripts/setup-project.sh
./scripts/setup-project.sh my-awesome-app
```

---

## 12. Uninstallation Guide

### Complete Tool Removal

```bash
#!/bin/bash
# scripts/uninstall-tools.sh

echo "🗑️ Removing development tools..."

# Build tools
pnpm remove vite @vitejs/plugin-react

# Tailwind
pnpm remove tailwindcss @tailwindcss/vite

# shadcn dependencies
pnpm remove clsx tailwind-merge class-variance-authority
pnpm remove @radix-ui/react-slot @radix-ui/react-dialog # add other radix packages

# Testing
pnpm remove vitest @vitest/ui @vitest/coverage-v8
pnpm remove @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
pnpm remove @playwright/test

# Linting (Biome)
pnpm remove @biomejs/biome

# Linting (ESLint - if used)
pnpm remove eslint @eslint/js typescript-eslint
pnpm remove eslint-plugin-react eslint-plugin-react-hooks

# Formatting (Prettier - if used)
pnpm remove prettier eslint-config-prettier

# TypeScript
pnpm remove typescript @types/node @types/react @types/react-dom

# Storybook
pnpm remove @storybook/react-vite storybook
pnpm remove @storybook/addon-essentials @storybook/addon-interactions

# Clean up config files
rm -f vite.config.ts vitest.config.ts playwright.config.ts
rm -f tsconfig.json tsconfig.app.json tsconfig.node.json
rm -f biome.json eslint.config.js .prettierrc
rm -rf .storybook/ playwright-report/ test-results/ coverage/

echo "✅ Tools removed successfully"
```

### Selective Removal

```bash
# Remove only testing tools
pnpm remove vitest @vitest/ui @playwright/test @testing-library/react

# Remove only linting/formatting
pnpm remove @biomejs/biome  # or eslint prettier

# Remove only Storybook
pnpm remove @storybook/react-vite storybook
rm -rf .storybook/
```

---

## Version Matrix

| Tool | Recommended Version | Node.js Requirement |
|------|---------------------|---------------------|
| Node.js | 22.x LTS | - |
| pnpm | 9.15+ | 18.12+ |
| Vite | 6.x | 18+ |
| React | 19.x | 18+ |
| Tailwind CSS | 4.x | 20+ |
| TypeScript | 5.7+ | 14.17+ |
| Vitest | 4.x | 18+ |
| Playwright | 1.50+ | 18+ |
| Storybook | 8.5+ | 18+ |
| Biome | 1.9+ | 14.18+ |
| ESLint | 9.x | 18.18+ |

---

## Additional Resources

### Official Documentation
- [Vite](https://vitejs.dev)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)
- [Storybook](https://storybook.js.org)
- [Biome](https://biomejs.dev)
- [TypeScript](https://www.typescriptlang.org)

### Community Resources
- [Frontend Wrapped 2025](https://blog.logrocket.com/frontend-wrapped-2025/)
- [Top Frontend Technologies 2026](https://roadmap.sh/frontend/technologies)
- [Tailwind Best Practices](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)
