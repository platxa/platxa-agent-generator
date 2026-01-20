#!/bin/bash
# =============================================================================
# Frontend Tooling Uninstallation Script - Production Grade
# =============================================================================
#
# Safely removes frontend development tools and their configuration files
# with verification at each step.
#
# Usage:
#   ./scripts/uninstall-tooling.sh [options]
#
# Options:
#   --all           Remove all tools (requires confirmation)
#   --testing       Remove testing tools only
#   --linting       Remove linting tools only
#   --styling       Remove styling tools only
#   --dry-run       Show what would be removed without removing
#   --force         Skip confirmation prompts
#   --help          Show this help message
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Flags
DRY_RUN=false
FORCE=false

# Counters - using assignment syntax for set -e compatibility
TOTAL_REMOVED=0
TOTAL_SKIPPED=0

# Increment functions that work with set -e
increment_removed() { TOTAL_REMOVED=$((TOTAL_REMOVED + 1)); }
increment_skipped() { TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1)); }

# =============================================================================
# Logging Functions
# =============================================================================

log_header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[REMOVED]${NC} $1"
  increment_removed
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1"
  increment_skipped
}

log_dry() {
  echo -e "${BLUE}[DRY-RUN]${NC} Would remove: $1"
}

# =============================================================================
# Utility Functions
# =============================================================================

# Detect package manager
detect_package_manager() {
  if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "$PROJECT_DIR/bun.lockb" ]; then
    echo "bun"
  elif [ -f "$PROJECT_DIR/yarn.lock" ]; then
    echo "yarn"
  else
    echo "npm"
  fi
}

PM=$(detect_package_manager)

# Check if package is installed
package_installed() {
  local pkg="$1"
  [ -d "$PROJECT_DIR/node_modules/$pkg" ]
}

# Remove packages safely
remove_packages() {
  local packages=("$@")
  local to_remove=()

  # Filter to only installed packages
  for pkg in "${packages[@]}"; do
    if package_installed "$pkg"; then
      to_remove+=("$pkg")
    fi
  done

  if [ ${#to_remove[@]} -eq 0 ]; then
    log_skip "No packages to remove (none installed)"
    return 0
  fi

  if $DRY_RUN; then
    for pkg in "${to_remove[@]}"; do
      log_dry "$pkg"
    done
    return 0
  fi

  case $PM in
    pnpm) pnpm remove "${to_remove[@]}" 2>/dev/null || true ;;
    bun) bun remove "${to_remove[@]}" 2>/dev/null || true ;;
    yarn) yarn remove "${to_remove[@]}" 2>/dev/null || true ;;
    npm) npm uninstall "${to_remove[@]}" 2>/dev/null || true ;;
  esac

  for pkg in "${to_remove[@]}"; do
    if ! package_installed "$pkg"; then
      log_success "$pkg"
    else
      log_warning "Failed to remove $pkg"
    fi
  done
}

# Remove file or directory safely
remove_path() {
  local path="$1"
  local full_path="$PROJECT_DIR/$path"

  if [ ! -e "$full_path" ]; then
    return 0
  fi

  if $DRY_RUN; then
    log_dry "$path"
    return 0
  fi

  rm -rf "$full_path"
  if [ ! -e "$full_path" ]; then
    log_success "$path"
  else
    log_warning "Failed to remove $path"
  fi
}

# Confirm action
confirm() {
  local message="$1"

  if $FORCE; then
    return 0
  fi

  if $DRY_RUN; then
    return 0
  fi

  echo ""
  echo -e "${YELLOW}$message${NC}"
  read -p "Continue? (y/N) " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Aborted by user"
    exit 0
  fi
}

# =============================================================================
# Uninstallation Functions
# =============================================================================

uninstall_react() {
  log_header "Removing React & React Compiler"

  log_info "Removing React packages..."
  remove_packages \
    "react" \
    "react-dom" \
    "@types/react" \
    "@types/react-dom" \
    "babel-plugin-react-compiler" \
    "eslint-plugin-react-compiler"
}

uninstall_build_tools() {
  log_header "Removing Build Tools"

  log_info "Removing Vite and plugins..."
  remove_packages \
    "vite" \
    "@vitejs/plugin-react"
}

uninstall_styling() {
  log_header "Removing Styling Tools"

  log_info "Removing Tailwind CSS..."
  remove_packages \
    "tailwindcss" \
    "@tailwindcss/vite" \
    "@tailwindcss/cli"

  log_info "Removing UI utilities..."
  remove_packages \
    "class-variance-authority" \
    "clsx" \
    "tailwind-merge"

  log_info "Removing Framer Motion..."
  remove_packages "framer-motion"

  log_info "Removing Lucide icons..."
  remove_packages "lucide-react"
}

uninstall_radix_ui() {
  log_header "Removing Radix UI Primitives"

  log_info "Removing Radix UI packages..."
  remove_packages \
    "@radix-ui/react-accordion" \
    "@radix-ui/react-alert-dialog" \
    "@radix-ui/react-avatar" \
    "@radix-ui/react-checkbox" \
    "@radix-ui/react-collapsible" \
    "@radix-ui/react-context-menu" \
    "@radix-ui/react-dialog" \
    "@radix-ui/react-dropdown-menu" \
    "@radix-ui/react-hover-card" \
    "@radix-ui/react-label" \
    "@radix-ui/react-menubar" \
    "@radix-ui/react-navigation-menu" \
    "@radix-ui/react-popover" \
    "@radix-ui/react-progress" \
    "@radix-ui/react-radio-group" \
    "@radix-ui/react-scroll-area" \
    "@radix-ui/react-select" \
    "@radix-ui/react-separator" \
    "@radix-ui/react-slider" \
    "@radix-ui/react-slot" \
    "@radix-ui/react-switch" \
    "@radix-ui/react-tabs" \
    "@radix-ui/react-toast" \
    "@radix-ui/react-toggle" \
    "@radix-ui/react-toggle-group" \
    "@radix-ui/react-tooltip"
}

uninstall_testing() {
  log_header "Removing Testing Tools"

  log_info "Removing Vitest..."
  remove_packages \
    "vitest" \
    "@vitest/ui" \
    "@vitest/coverage-v8"

  log_info "Removing React Testing Library..."
  remove_packages \
    "@testing-library/react" \
    "@testing-library/jest-dom" \
    "@testing-library/user-event"

  log_info "Removing JSDOM..."
  remove_packages "jsdom"

  log_info "Removing test artifacts..."
  remove_path "coverage"
}

uninstall_playwright() {
  log_header "Removing Playwright"

  log_info "Removing Playwright package..."
  remove_packages "@playwright/test"

  log_info "Removing Playwright artifacts..."
  remove_path "playwright-report"
  remove_path "test-results"

  log_warning "Note: e2e/ directory preserved (may contain custom tests)"
  log_warning "Note: Playwright browsers in ~/.cache/ms-playwright not removed"
}

uninstall_linting() {
  log_header "Removing Linting Tools"

  log_info "Removing ESLint..."
  remove_packages \
    "eslint" \
    "@eslint/js" \
    "typescript-eslint" \
    "eslint-plugin-react" \
    "eslint-plugin-react-hooks" \
    "eslint-plugin-react-compiler" \
    "eslint-plugin-jsx-a11y" \
    "@typescript-eslint/eslint-plugin" \
    "@typescript-eslint/parser"

  log_info "Removing Prettier..."
  remove_packages "prettier"

  log_info "Removing globals..."
  remove_packages "globals"
}

uninstall_typescript() {
  log_header "Removing TypeScript"

  log_info "Removing TypeScript packages..."
  remove_packages \
    "typescript" \
    "@types/node"
}

uninstall_config_files() {
  log_header "Removing Configuration Files"

  log_warning "This will remove project configuration files!"

  if ! $DRY_RUN && ! $FORCE; then
    confirm "Remove configuration files?"
  fi

  log_info "Removing config files..."
  remove_path "vite.config.ts"
  remove_path "vite.config.js"
  remove_path "vitest.config.ts"
  remove_path "vitest.config.js"
  remove_path "playwright.config.ts"
  remove_path "playwright.config.js"
  remove_path "eslint.config.js"
  remove_path "eslint.config.mjs"
  remove_path ".eslintrc"
  remove_path ".eslintrc.js"
  remove_path ".eslintrc.json"
  remove_path ".prettierrc"
  remove_path ".prettierrc.js"
  remove_path ".prettierrc.json"
  remove_path ".prettierignore"
  remove_path "biome.json"
  remove_path "biome.jsonc"
  remove_path "tailwind.config.js"
  remove_path "tailwind.config.ts"
  remove_path "postcss.config.js"
  remove_path "postcss.config.mjs"
}

uninstall_all() {
  log_header "FULL UNINSTALLATION"

  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  WARNING: This will remove ALL frontend tooling and configurations!     ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if ! $DRY_RUN && ! $FORCE; then
    confirm "This action cannot be undone. Are you sure?"
  fi

  # Remove in reverse dependency order
  uninstall_playwright
  uninstall_testing
  uninstall_linting
  uninstall_radix_ui
  uninstall_styling
  uninstall_build_tools
  uninstall_react
  uninstall_typescript

  # Optionally remove config files
  if ! $DRY_RUN; then
    echo ""
    read -p "Also remove configuration files? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      FORCE=true  # Skip inner confirmation
      uninstall_config_files
    fi
  else
    uninstall_config_files
  fi

  # Optionally clean node_modules
  if ! $DRY_RUN; then
    echo ""
    read -p "Also remove node_modules and lock files? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      log_info "Removing node_modules..."
      remove_path "node_modules"
      remove_path "pnpm-lock.yaml"
      remove_path "package-lock.json"
      remove_path "yarn.lock"
      remove_path "bun.lockb"
    fi
  fi
}

# =============================================================================
# Verification
# =============================================================================

verify_removal() {
  log_header "Verification"

  local remaining=0

  # Check for remaining packages
  local packages_to_check=(
    "react"
    "vite"
    "tailwindcss"
    "vitest"
    "@playwright/test"
    "eslint"
  )

  for pkg in "${packages_to_check[@]}"; do
    if package_installed "$pkg"; then
      log_warning "Still installed: $pkg"
      remaining=$((remaining + 1))
    fi
  done

  if [ $remaining -eq 0 ]; then
    log_info "All target packages removed successfully"
  else
    log_warning "$remaining packages still installed"
  fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  log_header "Uninstallation Summary"

  echo ""
  if $DRY_RUN; then
    echo -e "${BLUE}Mode: DRY RUN (no changes made)${NC}"
  fi
  echo ""

  echo -e "${CYAN}Results:${NC}"
  echo "  Removed: $TOTAL_REMOVED"
  echo "  Skipped: $TOTAL_SKIPPED"
  echo ""

  if [ $TOTAL_REMOVED -gt 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Uninstallation Complete${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  echo ""
  echo "To reinstall:"
  echo "  ./scripts/setup-tooling.sh --all"
  echo ""
}

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << EOF
Frontend Tooling Uninstallation Script - Production Grade

Usage: $0 [options]

Options:
  --all           Remove all tools and configurations (requires confirmation)
  --react         Remove React and React Compiler
  --build         Remove build tools (Vite)
  --styling       Remove styling tools (Tailwind, Framer Motion, etc.)
  --radix         Remove Radix UI primitives
  --testing       Remove testing tools (Vitest, RTL)
  --playwright    Remove Playwright E2E testing
  --linting       Remove linting tools (ESLint, Prettier)
  --typescript    Remove TypeScript
  --config        Remove configuration files only
  --dry-run       Show what would be removed without removing
  --force         Skip confirmation prompts
  --help          Show this help message

Examples:
  $0 --dry-run --all      # Preview full uninstallation
  $0 --testing            # Remove testing tools only
  $0 --linting            # Remove linting tools only
  $0 --force --all        # Remove everything without prompts

Safety:
  - Source files (src/) are never removed
  - package.json is never modified directly
  - Prompts for confirmation on destructive actions
EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
  local action=""

  cd "$PROJECT_DIR"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --all)
        action="all"
        shift
        ;;
      --react)
        action="react"
        shift
        ;;
      --build)
        action="build"
        shift
        ;;
      --styling)
        action="styling"
        shift
        ;;
      --radix)
        action="radix"
        shift
        ;;
      --testing)
        action="testing"
        shift
        ;;
      --playwright)
        action="playwright"
        shift
        ;;
      --linting)
        action="linting"
        shift
        ;;
      --typescript)
        action="typescript"
        shift
        ;;
      --config)
        action="config"
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --force)
        FORCE=true
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

  # Require an action
  if [ -z "$action" ]; then
    show_help
    exit 0
  fi

  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║      Frontend Tooling Uninstaller - Production Grade                    ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"

  if $DRY_RUN; then
    echo ""
    echo -e "${BLUE}Running in DRY-RUN mode - no changes will be made${NC}"
  fi

  log_info "Detected package manager: $PM"

  # Execute action
  case $action in
    all)        uninstall_all ;;
    react)      uninstall_react ;;
    build)      uninstall_build_tools ;;
    styling)    uninstall_styling ;;
    radix)      uninstall_radix_ui ;;
    testing)    uninstall_testing ;;
    playwright) uninstall_playwright ;;
    linting)    uninstall_linting ;;
    typescript) uninstall_typescript ;;
    config)     uninstall_config_files ;;
  esac

  # Verify and summarize
  if [ "$action" = "all" ]; then
    verify_removal
  fi

  print_summary
}

main "$@"
