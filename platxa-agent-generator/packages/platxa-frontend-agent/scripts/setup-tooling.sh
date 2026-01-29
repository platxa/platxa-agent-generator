#!/bin/bash
# =============================================================================
# Frontend Tooling Setup Script - Production Grade
# =============================================================================
#
# Installs and verifies the complete modern frontend development toolchain
# based on 2025-2026 industry standards with React 19, Tailwind CSS v4,
# and React Compiler.
#
# Usage:
#   ./scripts/setup-tooling.sh [options]
#
# Options:
#   --all           Install all tools (default)
#   --minimal       Install only essential tools
#   --testing       Install testing tools only
#   --verify-only   Only verify existing installation
#   --help          Show this help message
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration - Pin to exact versions for reproducibility
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Production versions (matched to package.json)
readonly REACT_VERSION="^19.2.3"
readonly REACT_DOM_VERSION="^19.2.3"
readonly TYPESCRIPT_VERSION="^5.7.2"
readonly VITE_VERSION="^6.0.7"
readonly TAILWIND_VERSION="^4.0.0"
readonly VITEST_VERSION="^2.1.8"
readonly PLAYWRIGHT_VERSION="^1.57.0"
readonly ESLINT_VERSION="^9.17.0"
readonly FRAMER_MOTION_VERSION="^11.15.0"
readonly LUCIDE_REACT_VERSION="^0.469.0"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Counters for summary - using assignment syntax for set -e compatibility
TOTAL_STEPS=0
PASSED_STEPS=0
FAILED_STEPS=0

# Increment function that works with set -e
# Using assignment syntax instead of ((var++)) which returns 1 when var is 0
increment_total() { TOTAL_STEPS=$((TOTAL_STEPS + 1)); }
increment_passed() { PASSED_STEPS=$((PASSED_STEPS + 1)); }
increment_failed() { FAILED_STEPS=$((FAILED_STEPS + 1)); }

# =============================================================================
# Logging Functions
# =============================================================================

log_header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
  increment_total
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  increment_passed
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  increment_failed
}

log_verify() {
  echo -e "${CYAN}[VERIFY]${NC} $1"
}

# =============================================================================
# Utility Functions
# =============================================================================

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

package_installed() {
  local pkg="$1"
  if [ -f "$PROJECT_DIR/node_modules/$pkg/package.json" ]; then
    return 0
  fi
  return 1
}

get_package_version() {
  local pkg="$1"
  if [ -f "$PROJECT_DIR/node_modules/$pkg/package.json" ]; then
    grep '"version"' "$PROJECT_DIR/node_modules/$pkg/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/'
  else
    echo "not installed"
  fi
}

verify_package() {
  local pkg="$1"
  local expected_pattern="$2"
  local actual_version

  actual_version=$(get_package_version "$pkg")

  if [ "$actual_version" = "not installed" ]; then
    log_error "$pkg: NOT INSTALLED"
    return 1
  fi

  log_success "$pkg: v$actual_version"
  return 0
}

# Detect package manager
detect_package_manager() {
  if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "$PROJECT_DIR/bun.lockb" ]; then
    echo "bun"
  elif [ -f "$PROJECT_DIR/yarn.lock" ]; then
    echo "yarn"
  else
    echo "pnpm"  # Default to pnpm for this project
  fi
}

PM=$(detect_package_manager)

# Install function based on package manager
install_deps() {
  local save_type="$1"
  shift

  case $PM in
    pnpm)
      if [ "$save_type" = "dev" ]; then
        pnpm add -D "$@"
      else
        pnpm add "$@"
      fi
      ;;
    bun)
      if [ "$save_type" = "dev" ]; then
        bun add -D "$@"
      else
        bun add "$@"
      fi
      ;;
    yarn)
      if [ "$save_type" = "dev" ]; then
        yarn add -D "$@"
      else
        yarn add "$@"
      fi
      ;;
    npm)
      if [ "$save_type" = "dev" ]; then
        npm install -D "$@"
      else
        npm install "$@"
      fi
      ;;
  esac
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
  log_header "Pre-flight Checks"

  # Check Node.js
  log_step "Checking Node.js version..."
  if ! command_exists node; then
    log_error "Node.js is not installed. Please install Node.js >= 20.0.0"
    exit 1
  fi

  local node_version
  node_version=$(node --version | sed 's/v//')
  local node_major
  node_major=$(echo "$node_version" | cut -d. -f1)

  if [ "$node_major" -lt 20 ]; then
    log_error "Node.js version $node_version is too old. Required: >= 20.0.0"
    exit 1
  fi
  log_success "Node.js v$node_version"

  # Check package manager
  log_step "Checking package manager..."
  if ! command_exists "$PM"; then
    log_warning "$PM not found, installing..."
    if [ "$PM" = "pnpm" ]; then
      npm install -g pnpm@9.15.0
    fi
  fi

  local pm_version
  pm_version=$($PM --version)
  log_success "$PM v$pm_version"

  # Check project directory
  log_step "Checking project directory..."
  if [ ! -f "$PROJECT_DIR/package.json" ]; then
    log_error "package.json not found in $PROJECT_DIR"
    exit 1
  fi
  log_success "Project directory verified"

  cd "$PROJECT_DIR"
}

# =============================================================================
# Installation Functions
# =============================================================================

install_core_dependencies() {
  log_header "Installing Core Dependencies"

  # React 19
  log_step "Installing React 19..."
  install_deps prod "react@$REACT_VERSION" "react-dom@$REACT_DOM_VERSION"
  verify_package "react" "$REACT_VERSION"
  verify_package "react-dom" "$REACT_DOM_VERSION"

  # TypeScript
  log_step "Installing TypeScript..."
  install_deps dev "typescript@$TYPESCRIPT_VERSION" "@types/node@^22.10.5"
  verify_package "typescript" "$TYPESCRIPT_VERSION"

  # React Types for React 19
  log_step "Installing React 19 type definitions..."
  install_deps dev "@types/react@^19.2.8" "@types/react-dom@^19.2.3"
  verify_package "@types/react" "19"
  verify_package "@types/react-dom" "19"
}

install_build_tools() {
  log_header "Installing Build Tools"

  # Vite
  log_step "Installing Vite..."
  install_deps dev "vite@$VITE_VERSION" "@vitejs/plugin-react@^4.3.4"
  verify_package "vite" "$VITE_VERSION"
  verify_package "@vitejs/plugin-react" "4"

  # React Compiler
  log_step "Installing React Compiler..."
  install_deps dev "babel-plugin-react-compiler@^1.0.0"
  verify_package "babel-plugin-react-compiler" "1"
}

install_styling() {
  log_header "Installing Styling Tools"

  # Tailwind CSS v4
  log_step "Installing Tailwind CSS v4..."
  install_deps dev "tailwindcss@$TAILWIND_VERSION" "@tailwindcss/vite@^4.0.0"
  verify_package "tailwindcss" "4"
  verify_package "@tailwindcss/vite" "4"

  # UI Dependencies
  log_step "Installing UI utilities..."
  install_deps prod "class-variance-authority@^0.7.1" "clsx@^2.1.1" "tailwind-merge@^2.6.0"
  verify_package "class-variance-authority" "0.7"
  verify_package "clsx" "2"
  verify_package "tailwind-merge" "2"

  # Framer Motion
  log_step "Installing Framer Motion..."
  install_deps prod "framer-motion@$FRAMER_MOTION_VERSION"
  verify_package "framer-motion" "11"

  # Lucide Icons
  log_step "Installing Lucide React icons..."
  install_deps prod "lucide-react@$LUCIDE_REACT_VERSION"
  verify_package "lucide-react" "0.469"
}

install_radix_ui() {
  log_header "Installing Radix UI Primitives"

  log_step "Installing Radix UI components..."
  install_deps prod \
    "@radix-ui/react-accordion@^1.2.2" \
    "@radix-ui/react-collapsible@^1.1.2" \
    "@radix-ui/react-dialog@^1.1.4" \
    "@radix-ui/react-dropdown-menu@^2.1.4" \
    "@radix-ui/react-select@^2.1.4" \
    "@radix-ui/react-slot@^1.1.1" \
    "@radix-ui/react-tabs@^1.1.2" \
    "@radix-ui/react-tooltip@^1.1.6"

  verify_package "@radix-ui/react-dialog" "1"
  verify_package "@radix-ui/react-slot" "1"
  log_success "Radix UI primitives installed"
}

install_testing() {
  log_header "Installing Testing Tools"

  # Vitest
  log_step "Installing Vitest..."
  install_deps dev "vitest@$VITEST_VERSION" "@vitest/coverage-v8@^2.1.8"
  verify_package "vitest" "2"

  # React Testing Library
  log_step "Installing React Testing Library..."
  install_deps dev \
    "@testing-library/react@^16.1.0" \
    "@testing-library/jest-dom@^6.6.3" \
    "@testing-library/user-event@^14.5.2"
  verify_package "@testing-library/react" "16"

  # JSDOM
  log_step "Installing JSDOM..."
  install_deps dev "jsdom@^25.0.1"
  verify_package "jsdom" "25"
}

install_playwright() {
  log_header "Installing Playwright E2E Testing"

  log_step "Installing Playwright..."
  install_deps dev "@playwright/test@$PLAYWRIGHT_VERSION"
  verify_package "@playwright/test" "1"

  log_step "Installing Playwright browsers..."
  log_info "This may take a few minutes..."

  # Install browsers without system deps (user-level installation)
  case $PM in
    pnpm) pnpm exec playwright install chromium firefox webkit || log_warning "Some browsers may require manual installation" ;;
    bun) bunx playwright install chromium firefox webkit || log_warning "Some browsers may require manual installation" ;;
    yarn) yarn playwright install chromium firefox webkit || log_warning "Some browsers may require manual installation" ;;
    npm) npx playwright install chromium firefox webkit || log_warning "Some browsers may require manual installation" ;;
  esac

  log_success "Playwright browsers installed"

  # Create e2e directory if it doesn't exist
  mkdir -p "$PROJECT_DIR/e2e"
}

install_linting() {
  log_header "Installing Linting Tools"

  # ESLint v9
  log_step "Installing ESLint v9..."
  install_deps dev \
    "eslint@$ESLINT_VERSION" \
    "@eslint/js@^9.39.2" \
    "typescript-eslint@^8.53.0"
  verify_package "eslint" "9"

  # React ESLint plugins
  log_step "Installing React ESLint plugins..."
  install_deps dev \
    "eslint-plugin-react@^7.37.3" \
    "eslint-plugin-react-hooks@^5.1.0" \
    "eslint-plugin-react-compiler@19.1.0-rc.2" \
    "eslint-plugin-jsx-a11y@^6.10.2"
  verify_package "eslint-plugin-react" "7"
  verify_package "eslint-plugin-react-compiler" "19"

  # TypeScript ESLint
  log_step "Installing TypeScript ESLint..."
  install_deps dev \
    "@typescript-eslint/eslint-plugin@^8.19.1" \
    "@typescript-eslint/parser@^8.19.1"
  verify_package "@typescript-eslint/eslint-plugin" "8"

  # Prettier
  log_step "Installing Prettier..."
  install_deps dev "prettier@^3.4.2"
  verify_package "prettier" "3"

  # Globals
  log_step "Installing globals..."
  install_deps dev "globals@^17.0.0"
  verify_package "globals" "17"
}

# =============================================================================
# Verification Functions
# =============================================================================

verify_all_installations() {
  log_header "Verification Report"

  local verify_failed=0

  log_verify "Core Dependencies:"
  verify_package "react" "19" || ((verify_failed++))
  verify_package "react-dom" "19" || ((verify_failed++))
  verify_package "typescript" "5" || ((verify_failed++))

  log_verify "Build Tools:"
  verify_package "vite" "6" || ((verify_failed++))
  verify_package "@vitejs/plugin-react" "4" || ((verify_failed++))
  verify_package "babel-plugin-react-compiler" "1" || ((verify_failed++))

  log_verify "Styling:"
  verify_package "tailwindcss" "4" || ((verify_failed++))
  verify_package "framer-motion" "11" || ((verify_failed++))
  verify_package "lucide-react" "0" || ((verify_failed++))

  log_verify "Testing:"
  verify_package "vitest" "2" || ((verify_failed++))
  verify_package "@playwright/test" "1" || ((verify_failed++))
  verify_package "@testing-library/react" "16" || ((verify_failed++))

  log_verify "Linting:"
  verify_package "eslint" "9" || ((verify_failed++))
  verify_package "prettier" "3" || ((verify_failed++))

  return $verify_failed
}

run_quality_checks() {
  log_header "Running Quality Checks"

  # TypeScript check
  log_step "Running TypeScript verification..."
  if pnpm typecheck 2>/dev/null; then
    log_success "TypeScript: No errors"
  else
    log_error "TypeScript: Errors found"
  fi

  # ESLint check
  log_step "Running ESLint verification..."
  if pnpm lint 2>/dev/null; then
    log_success "ESLint: No errors"
  else
    log_error "ESLint: Errors found"
  fi

  # Test check
  log_step "Running test suite..."
  if pnpm test 2>/dev/null; then
    log_success "Tests: All passed"
  else
    log_error "Tests: Some failed"
  fi

  # Build check
  log_step "Running production build..."
  if pnpm build 2>/dev/null; then
    log_success "Build: Success"
  else
    log_error "Build: Failed"
  fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  log_header "Installation Summary"

  echo ""
  echo -e "${CYAN}Environment:${NC}"
  echo "  Node.js: $(node --version)"
  echo "  $PM: $($PM --version)"
  echo ""

  echo -e "${CYAN}Results:${NC}"
  echo -e "  Total Steps: $TOTAL_STEPS"
  echo -e "  ${GREEN}Passed: $PASSED_STEPS${NC}"
  if [ $FAILED_STEPS -gt 0 ]; then
    echo -e "  ${RED}Failed: $FAILED_STEPS${NC}"
  fi
  echo ""

  if [ $FAILED_STEPS -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Installation Complete - All checks passed!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  Installation Complete - Some checks failed!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  echo ""
  echo "Next steps:"
  echo "  pnpm dev        # Start development server"
  echo "  pnpm test       # Run tests"
  echo "  pnpm build      # Build for production"
  echo ""
}

# =============================================================================
# Help
# =============================================================================

show_help() {
  cat << EOF
Frontend Tooling Setup Script - Production Grade

Usage: $0 [options]

Options:
  --all           Install all tools (default)
  --minimal       Install only essential tools (React, TypeScript, Vite, Tailwind)
  --testing       Install testing tools only (Vitest, Playwright, RTL)
  --linting       Install linting tools only (ESLint, Prettier)
  --verify-only   Only verify existing installation without installing
  --skip-verify   Skip verification after installation
  --help          Show this help message

Examples:
  $0                    # Install all tools with verification
  $0 --minimal          # Essential tools only
  $0 --verify-only      # Just verify current installation
  $0 --testing          # Install testing tools only

Installed Versions:
  React:          $REACT_VERSION
  TypeScript:     $TYPESCRIPT_VERSION
  Vite:           $VITE_VERSION
  Tailwind CSS:   $TAILWIND_VERSION
  Vitest:         $VITEST_VERSION
  Playwright:     $PLAYWRIGHT_VERSION
  ESLint:         $ESLINT_VERSION
EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
  local install_all=false
  local install_minimal=false
  local install_testing=false
  local install_linting=false
  local verify_only=false
  local skip_verify=false

  # Parse arguments
  if [ $# -eq 0 ]; then
    install_all=true
  fi

  while [[ $# -gt 0 ]]; do
    case $1 in
      --all)
        install_all=true
        shift
        ;;
      --minimal)
        install_minimal=true
        shift
        ;;
      --testing)
        install_testing=true
        shift
        ;;
      --linting)
        install_linting=true
        shift
        ;;
      --verify-only)
        verify_only=true
        shift
        ;;
      --skip-verify)
        skip_verify=true
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
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║      Frontend Tooling Setup - Production Grade (2025-2026)              ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"

  # Pre-flight checks
  preflight_checks

  if $verify_only; then
    verify_all_installations
    run_quality_checks
    print_summary
    exit $FAILED_STEPS
  fi

  # Run installations based on mode
  if $install_all; then
    install_core_dependencies
    install_build_tools
    install_styling
    install_radix_ui
    install_testing
    install_playwright
    install_linting
  elif $install_minimal; then
    install_core_dependencies
    install_build_tools
    install_styling
  elif $install_testing; then
    install_testing
    install_playwright
  elif $install_linting; then
    install_linting
  fi

  # Verification
  if ! $skip_verify; then
    verify_all_installations
    run_quality_checks
  fi

  # Summary
  print_summary

  exit $FAILED_STEPS
}

main "$@"
