#!/bin/bash
# =============================================================================
# Frontend Tooling Uninstallation Script
# =============================================================================
#
# This script removes frontend development tools and their configuration files.
#
# Usage:
#   ./scripts/uninstall-tooling.sh [options]
#
# Options:
#   --all         Remove all tools
#   --testing     Remove testing tools only
#   --linting     Remove linting/formatting tools only
#   --ci          Remove CI/CD configuration only
#   --storybook   Remove Storybook only
#   --dry-run     Show what would be removed without removing
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

DRY_RUN=false

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

# Remove function based on package manager
remove_packages() {
  if $DRY_RUN; then
    log_info "[DRY RUN] Would remove: $@"
    return
  fi

  case $PM in
    pnpm) pnpm remove "$@" 2>/dev/null || true ;;
    bun) bun remove "$@" 2>/dev/null || true ;;
    yarn) yarn remove "$@" 2>/dev/null || true ;;
    npm) npm uninstall "$@" 2>/dev/null || true ;;
  esac
}

# Remove file/directory
remove_path() {
  if $DRY_RUN; then
    log_info "[DRY RUN] Would remove: $1"
    return
  fi

  if [ -e "$1" ]; then
    rm -rf "$1"
    log_success "Removed $1"
  fi
}

# =============================================================================
# Uninstallation Functions
# =============================================================================

uninstall_build_tools() {
  log_info "Removing build tools..."
  remove_packages vite @vitejs/plugin-react
  remove_path "vite.config.ts"
  remove_path "vite.config.js"
  log_success "Build tools removed"
}

uninstall_react() {
  log_info "Removing React..."
  remove_packages react react-dom
  remove_packages @types/react @types/react-dom
  remove_packages babel-plugin-react-compiler eslint-plugin-react-compiler
  log_success "React removed"
}

uninstall_tailwind() {
  log_info "Removing Tailwind CSS..."
  remove_packages tailwindcss @tailwindcss/vite @tailwindcss/cli
  remove_path "tailwind.config.js"
  remove_path "tailwind.config.ts"
  # Note: Don't remove src/index.css as it may contain custom styles
  log_warning "Note: src/index.css was not removed. Remove @import 'tailwindcss' and @theme manually if needed."
  log_success "Tailwind CSS removed"
}

uninstall_shadcn() {
  log_info "Removing shadcn/ui dependencies..."
  remove_packages clsx tailwind-merge class-variance-authority
  remove_packages @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
  remove_packages @radix-ui/react-label @radix-ui/react-checkbox @radix-ui/react-select
  remove_packages @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip
  remove_packages @radix-ui/react-popover @radix-ui/react-accordion @radix-ui/react-alert-dialog
  remove_packages @radix-ui/react-avatar @radix-ui/react-collapsible @radix-ui/react-context-menu
  remove_packages @radix-ui/react-hover-card @radix-ui/react-menubar @radix-ui/react-navigation-menu
  remove_packages @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area
  remove_packages @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-switch
  remove_packages @radix-ui/react-toggle @radix-ui/react-toggle-group
  remove_path "components.json"
  log_warning "Note: src/components/ui/ was not removed. Remove manually if needed."
  log_success "shadcn/ui dependencies removed"
}

uninstall_testing() {
  log_info "Removing testing tools..."

  # Vitest
  remove_packages vitest @vitest/ui @vitest/coverage-v8
  remove_path "vitest.config.ts"
  remove_path "vitest.config.js"

  # React Testing Library
  remove_packages @testing-library/react @testing-library/jest-dom @testing-library/user-event
  remove_packages jsdom

  # Coverage reports
  remove_path "coverage"

  log_success "Testing tools removed"
}

uninstall_playwright() {
  log_info "Removing Playwright..."
  remove_packages @playwright/test
  remove_path "playwright.config.ts"
  remove_path "playwright.config.js"
  remove_path "playwright-report"
  remove_path "test-results"
  remove_path "e2e"
  log_success "Playwright removed"
}

uninstall_biome() {
  log_info "Removing Biome..."
  remove_packages @biomejs/biome
  remove_path "biome.json"
  remove_path "biome.jsonc"
  log_success "Biome removed"
}

uninstall_eslint() {
  log_info "Removing ESLint..."
  remove_packages eslint @eslint/js typescript-eslint
  remove_packages eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-compiler
  remove_packages eslint-config-prettier
  remove_path "eslint.config.js"
  remove_path "eslint.config.mjs"
  remove_path ".eslintrc"
  remove_path ".eslintrc.js"
  remove_path ".eslintrc.json"
  remove_path ".eslintrc.yml"
  log_success "ESLint removed"
}

uninstall_prettier() {
  log_info "Removing Prettier..."
  remove_packages prettier eslint-config-prettier
  remove_path ".prettierrc"
  remove_path ".prettierrc.js"
  remove_path ".prettierrc.json"
  remove_path ".prettierrc.yml"
  remove_path ".prettierignore"
  log_success "Prettier removed"
}

uninstall_typescript() {
  log_info "Removing TypeScript..."
  remove_packages typescript @types/node
  remove_path "tsconfig.json"
  remove_path "tsconfig.app.json"
  remove_path "tsconfig.node.json"
  remove_path "tsconfig.build.json"
  log_success "TypeScript removed"
}

uninstall_storybook() {
  log_info "Removing Storybook..."
  remove_packages @storybook/react-vite storybook
  remove_packages @storybook/addon-essentials @storybook/addon-interactions
  remove_packages @storybook/addon-a11y @storybook/addon-coverage @storybook/test
  remove_packages @storybook/blocks @storybook/react
  remove_path ".storybook"
  remove_path "storybook-static"
  log_success "Storybook removed"
}

uninstall_ci() {
  log_info "Removing CI/CD configuration..."
  remove_path ".github/workflows/ci.yml"
  remove_path ".github/workflows/visual-regression.yml"

  # Only remove .github if empty
  if [ -d ".github" ] && [ -z "$(ls -A .github)" ]; then
    remove_path ".github"
  fi

  log_success "CI/CD configuration removed"
}

uninstall_all() {
  log_warning "This will remove ALL development tools and configurations!"
  echo ""

  if ! $DRY_RUN; then
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Aborted."
      exit 0
    fi
  fi

  uninstall_storybook
  uninstall_playwright
  uninstall_testing
  uninstall_biome
  uninstall_eslint
  uninstall_prettier
  uninstall_shadcn
  uninstall_tailwind
  uninstall_react
  uninstall_typescript
  uninstall_build_tools
  uninstall_ci

  # Clean up node_modules and lock files
  if ! $DRY_RUN; then
    read -p "Also remove node_modules and lock files? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      remove_path "node_modules"
      remove_path "pnpm-lock.yaml"
      remove_path "package-lock.json"
      remove_path "yarn.lock"
      remove_path "bun.lockb"
      log_success "Node modules and lock files removed"
    fi
  fi
}

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << EOF
Frontend Tooling Uninstallation Script

Usage: $0 [options]

Options:
  --all         Remove all tools and configurations
  --build       Remove build tools (Vite)
  --react       Remove React and React Compiler
  --tailwind    Remove Tailwind CSS
  --shadcn      Remove shadcn/ui dependencies
  --testing     Remove testing tools (Vitest, RTL)
  --playwright  Remove Playwright
  --linting     Remove all linting tools (Biome, ESLint, Prettier)
  --biome       Remove Biome only
  --eslint      Remove ESLint only
  --prettier    Remove Prettier only
  --typescript  Remove TypeScript
  --storybook   Remove Storybook
  --ci          Remove CI/CD configuration
  --dry-run     Show what would be removed without removing
  --help        Show this help message

Examples:
  $0 --all              # Remove everything
  $0 --testing          # Remove testing tools only
  $0 --linting          # Remove all linting tools
  $0 --dry-run --all    # Preview what would be removed
EOF
}

# =============================================================================
# Main Logic
# =============================================================================

if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      uninstall_all
      exit 0
      ;;
    --build)
      uninstall_build_tools
      shift
      ;;
    --react)
      uninstall_react
      shift
      ;;
    --tailwind)
      uninstall_tailwind
      shift
      ;;
    --shadcn)
      uninstall_shadcn
      shift
      ;;
    --testing)
      uninstall_testing
      shift
      ;;
    --playwright)
      uninstall_playwright
      shift
      ;;
    --linting)
      uninstall_biome
      uninstall_eslint
      uninstall_prettier
      shift
      ;;
    --biome)
      uninstall_biome
      shift
      ;;
    --eslint)
      uninstall_eslint
      shift
      ;;
    --prettier)
      uninstall_prettier
      shift
      ;;
    --typescript)
      uninstall_typescript
      shift
      ;;
    --storybook)
      uninstall_storybook
      shift
      ;;
    --ci)
      uninstall_ci
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      log_info "Running in DRY RUN mode - no changes will be made"
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

echo ""
log_success "Uninstallation complete!"
echo ""
