#!/bin/bash
# =============================================================================
# Frontend Tooling Setup Script
# =============================================================================
#
# This script sets up the complete modern frontend development toolchain
# based on 2025-2026 industry standards.
#
# Usage:
#   ./scripts/setup-tooling.sh [options]
#
# Options:
#   --all         Install all tools (default)
#   --minimal     Install only essential tools
#   --testing     Install testing tools only
#   --linting     Install linting/formatting tools only
#   --ci          Install CI/CD tools only
#   --help        Show this help message
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Detect package manager
detect_package_manager() {
  if [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "bun.lockb" ]; then
    echo "bun"
  elif [ -f "yarn.lock" ]; then
    echo "yarn"
  else
    echo "npm"
  fi
}

PM=$(detect_package_manager)
log_info "Detected package manager: $PM"

# Install function based on package manager
install_dev() {
  case $PM in
    pnpm) pnpm add -D "$@" ;;
    bun) bun add -D "$@" ;;
    yarn) yarn add -D "$@" ;;
    npm) npm install -D "$@" ;;
  esac
}

install_prod() {
  case $PM in
    pnpm) pnpm add "$@" ;;
    bun) bun add "$@" ;;
    yarn) yarn add "$@" ;;
    npm) npm install "$@" ;;
  esac
}

# =============================================================================
# Installation Functions
# =============================================================================

install_build_tools() {
  log_info "Installing build tools (Vite)..."
  install_dev vite @vitejs/plugin-react
  log_success "Build tools installed"
}

install_react() {
  log_info "Installing React 19..."
  install_prod react@19 react-dom@19
  install_dev @types/react@19 @types/react-dom@19
  log_success "React 19 installed"
}

install_react_compiler() {
  log_info "Installing React Compiler..."
  install_dev babel-plugin-react-compiler eslint-plugin-react-compiler
  log_success "React Compiler installed"
}

install_tailwind() {
  log_info "Installing Tailwind CSS v4..."
  install_dev tailwindcss @tailwindcss/vite

  # Create CSS file with @theme if it doesn't exist
  if [ ! -f "src/index.css" ]; then
    mkdir -p src
    cat > src/index.css << 'EOF'
@import "tailwindcss";

@theme {
  /* Colors - OKLCH for P3 gamut support */
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.7 0.15 180);
  --color-accent: oklch(0.65 0.25 30);
  --color-muted: oklch(0.9 0.01 250);
  --color-destructive: oklch(0.55 0.2 25);

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}
EOF
    log_success "Created src/index.css with @theme"
  fi

  log_success "Tailwind CSS v4 installed"
}

install_shadcn_deps() {
  log_info "Installing shadcn/ui dependencies..."
  install_prod clsx tailwind-merge class-variance-authority
  install_prod @radix-ui/react-slot

  # Create utils.ts if it doesn't exist
  if [ ! -f "src/lib/utils.ts" ]; then
    mkdir -p src/lib
    cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF
    log_success "Created src/lib/utils.ts"
  fi

  log_success "shadcn/ui dependencies installed"
}

install_testing() {
  log_info "Installing testing tools..."

  # Vitest
  install_dev vitest @vitest/ui @vitest/coverage-v8

  # React Testing Library
  install_dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

  # JSDOM
  install_dev jsdom

  # Create test setup if it doesn't exist
  if [ ! -f "src/test/setup.ts" ]; then
    mkdir -p src/test
    cat > src/test/setup.ts << 'EOF'
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Cleanup after each test
afterEach(() => {
  cleanup()
})
EOF
    log_success "Created src/test/setup.ts"
  fi

  log_success "Testing tools installed"
}

install_playwright() {
  log_info "Installing Playwright..."
  install_dev @playwright/test

  # Install browsers
  log_info "Installing Playwright browsers..."
  case $PM in
    pnpm) pnpm exec playwright install --with-deps ;;
    bun) bunx playwright install --with-deps ;;
    yarn) yarn playwright install --with-deps ;;
    npm) npx playwright install --with-deps ;;
  esac

  # Create playwright config if it doesn't exist
  if [ ! -f "playwright.config.ts" ]; then
    cat > playwright.config.ts << 'EOF'
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
EOF
    log_success "Created playwright.config.ts"
  fi

  # Create e2e directory
  mkdir -p e2e

  log_success "Playwright installed"
}

install_biome() {
  log_info "Installing Biome (linting/formatting)..."
  install_dev @biomejs/biome

  # Initialize biome config
  if [ ! -f "biome.json" ]; then
    cat > biome.json << 'EOF'
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
      },
      "suspicious": {
        "noExplicitAny": "warn"
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
  },
  "files": {
    "ignore": ["node_modules", "dist", "coverage", "playwright-report"]
  }
}
EOF
    log_success "Created biome.json"
  fi

  log_success "Biome installed"
}

install_eslint() {
  log_info "Installing ESLint v9 (alternative to Biome)..."
  install_dev eslint @eslint/js typescript-eslint
  install_dev eslint-plugin-react eslint-plugin-react-hooks
  install_dev eslint-plugin-react-compiler

  # Create eslint config
  if [ ! -f "eslint.config.js" ]; then
    cat > eslint.config.js << 'EOF'
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import reactCompiler from "eslint-plugin-react-compiler"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.js", "coverage/"],
  }
)
EOF
    log_success "Created eslint.config.js"
  fi

  log_success "ESLint v9 installed"
}

install_typescript() {
  log_info "Installing TypeScript..."
  install_dev typescript @types/node

  # Create tsconfig if it doesn't exist
  if [ ! -f "tsconfig.json" ]; then
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "jsx": "react-jsx",
    "skipLibCheck": true
  },
  "include": ["src/**/*", "*.config.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF
    log_success "Created tsconfig.json"
  fi

  log_success "TypeScript installed"
}

install_storybook() {
  log_info "Installing Storybook 8..."

  case $PM in
    pnpm) pnpm dlx storybook@latest init --skip-install ;;
    bun) bunx storybook@latest init --skip-install ;;
    yarn) yarn dlx storybook@latest init --skip-install ;;
    npm) npx storybook@latest init --skip-install ;;
  esac

  # Install additional addons
  install_dev @storybook/test @storybook/addon-a11y @storybook/addon-coverage

  log_success "Storybook 8 installed"
}

setup_github_actions() {
  log_info "Setting up GitHub Actions CI/CD..."

  mkdir -p .github/workflows

  cat > .github/workflows/ci.yml << 'EOF'
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
EOF

  log_success "GitHub Actions CI/CD configured"
}

# =============================================================================
# Main Installation Logic
# =============================================================================

show_help() {
  cat << EOF
Frontend Tooling Setup Script

Usage: $0 [options]

Options:
  --all         Install all tools (default)
  --minimal     Install only essential tools (Vite, React, TypeScript, Tailwind)
  --testing     Install testing tools only (Vitest, Playwright)
  --linting     Install linting/formatting tools only (Biome or ESLint)
  --biome       Use Biome for linting (default)
  --eslint      Use ESLint + Prettier instead of Biome
  --ci          Install CI/CD tools only
  --storybook   Install Storybook
  --help        Show this help message

Examples:
  $0 --all              # Install everything
  $0 --minimal          # Essential tools only
  $0 --testing --biome  # Testing + Biome
EOF
}

INSTALL_BUILD=false
INSTALL_REACT=false
INSTALL_COMPILER=false
INSTALL_TAILWIND=false
INSTALL_SHADCN=false
INSTALL_TESTING=false
INSTALL_PLAYWRIGHT=false
INSTALL_BIOME=false
INSTALL_ESLINT=false
INSTALL_TYPESCRIPT=false
INSTALL_STORYBOOK=false
INSTALL_CI=false

# Parse arguments
if [ $# -eq 0 ]; then
  # Default: install all
  INSTALL_BUILD=true
  INSTALL_REACT=true
  INSTALL_COMPILER=true
  INSTALL_TAILWIND=true
  INSTALL_SHADCN=true
  INSTALL_TESTING=true
  INSTALL_PLAYWRIGHT=true
  INSTALL_BIOME=true
  INSTALL_TYPESCRIPT=true
  INSTALL_CI=true
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      INSTALL_BUILD=true
      INSTALL_REACT=true
      INSTALL_COMPILER=true
      INSTALL_TAILWIND=true
      INSTALL_SHADCN=true
      INSTALL_TESTING=true
      INSTALL_PLAYWRIGHT=true
      INSTALL_BIOME=true
      INSTALL_TYPESCRIPT=true
      INSTALL_STORYBOOK=true
      INSTALL_CI=true
      shift
      ;;
    --minimal)
      INSTALL_BUILD=true
      INSTALL_REACT=true
      INSTALL_TAILWIND=true
      INSTALL_TYPESCRIPT=true
      shift
      ;;
    --testing)
      INSTALL_TESTING=true
      INSTALL_PLAYWRIGHT=true
      shift
      ;;
    --linting|--biome)
      INSTALL_BIOME=true
      shift
      ;;
    --eslint)
      INSTALL_ESLINT=true
      INSTALL_BIOME=false
      shift
      ;;
    --ci)
      INSTALL_CI=true
      shift
      ;;
    --storybook)
      INSTALL_STORYBOOK=true
      shift
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# =============================================================================
# Run Installation
# =============================================================================

echo ""
echo "=============================================="
echo "  Frontend Tooling Setup (2025-2026)"
echo "=============================================="
echo ""

$INSTALL_BUILD && install_build_tools
$INSTALL_REACT && install_react
$INSTALL_COMPILER && install_react_compiler
$INSTALL_TAILWIND && install_tailwind
$INSTALL_SHADCN && install_shadcn_deps
$INSTALL_TYPESCRIPT && install_typescript
$INSTALL_TESTING && install_testing
$INSTALL_PLAYWRIGHT && install_playwright
$INSTALL_BIOME && install_biome
$INSTALL_ESLINT && install_eslint
$INSTALL_STORYBOOK && install_storybook
$INSTALL_CI && setup_github_actions

echo ""
log_success "=============================================="
log_success "  Setup Complete!"
log_success "=============================================="
echo ""
log_info "Next steps:"
echo "  1. Run 'pnpm dev' to start development server"
echo "  2. Run 'pnpm test' to run tests"
echo "  3. Run 'pnpm lint' to check code quality"
echo ""
