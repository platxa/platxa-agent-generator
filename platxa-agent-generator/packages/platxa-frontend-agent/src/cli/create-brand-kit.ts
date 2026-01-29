#!/usr/bin/env node
/**
 * Create Brand Kit - Scaffolding Tool (Feature #79)
 *
 * Standalone CLI for creating brand kit packages.
 * Works with `npx create-brand-kit` pattern.
 *
 * @example
 * ```bash
 * npx create-brand-kit my-brand
 * npx create-brand-kit @acme/brand-kit --template full
 * ```
 *
 * @module cli/create-brand-kit
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"

// =============================================================================
// TYPES
// =============================================================================

interface CreateOptions {
  /** Package name */
  name: string
  /** Output directory */
  outputDir: string
  /** Template to use */
  template: "minimal" | "standard" | "full" | "enterprise"
  /** Base preset */
  preset: "default" | "blue" | "green" | "violet" | "custom"
  /** Primary hue (0-360) for custom preset */
  primaryHue?: number
  /** Accent hue (0-360) for custom preset */
  accentHue?: number
  /** Include TypeScript */
  typescript: boolean
  /** Include Storybook */
  storybook: boolean
  /** Include tests */
  tests: boolean
  /** Package manager to use */
  packageManager: "npm" | "yarn" | "pnpm"
  /** Author */
  author?: string
  /** Description */
  description?: string
  /** License */
  license: string
  /** Git init */
  gitInit: boolean
  /** Install deps */
  installDeps: boolean
}

interface CreateResult {
  success: boolean
  outputDir: string
  files: string[]
  error?: string
  nextSteps: string[]
}

type TemplateType = CreateOptions["template"]

// =============================================================================
// TEMPLATES CONFIGURATION
// =============================================================================

const TEMPLATES: Record<
  TemplateType,
  {
    name: string
    description: string
    features: string[]
  }
> = {
  minimal: {
    name: "Minimal",
    description: "Basic brand kit with colors only",
    features: ["Color primitives", "Semantic colors", "Package.json"],
  },
  standard: {
    name: "Standard",
    description: "Complete brand kit with all tokens",
    features: [
      "Color primitives",
      "Semantic colors",
      "Typography",
      "Spacing",
      "Radius",
      "Shadow",
      "Tailwind preset",
    ],
  },
  full: {
    name: "Full",
    description: "Standard + CSS output and documentation",
    features: [
      "All standard features",
      "CSS variable output",
      "README documentation",
      "TypeScript types",
      "Build scripts",
    ],
  },
  enterprise: {
    name: "Enterprise",
    description: "Full + testing, Storybook, and CI/CD",
    features: [
      "All full features",
      "Vitest unit tests",
      "Storybook documentation",
      "GitHub Actions CI",
      "Changesets for versioning",
      "ESLint + Prettier",
    ],
  },
}

const PRESETS = {
  default: { primaryHue: 222, accentHue: 262, name: "Default (Blue-Violet)" },
  blue: { primaryHue: 217, accentHue: 199, name: "Blue (Ocean)" },
  green: { primaryHue: 142, accentHue: 160, name: "Green (Nature)" },
  violet: { primaryHue: 262, accentHue: 292, name: "Violet (Royal)" },
  custom: { primaryHue: 0, accentHue: 0, name: "Custom (Pick your own)" },
} as const

// =============================================================================
// PROMPTS
// =============================================================================

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

async function askYesNo(
  rl: readline.Interface,
  question: string,
  defaultValue: boolean = true
): Promise<boolean> {
  const hint = defaultValue ? "[Y/n]" : "[y/N]"
  const answer = await ask(rl, `${question} ${hint} `)
  if (answer === "") return defaultValue
  return answer.toLowerCase().startsWith("y")
}

async function askChoice<T extends string>(
  rl: readline.Interface,
  question: string,
  options: Array<{ value: T; label: string; description?: string }>,
  defaultIndex: number = 0
): Promise<T> {
  console.log(`\n${question}\n`)
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? ">" : " "
    const desc = opt.description ? ` - ${opt.description}` : ""
    console.log(`  ${marker} ${i + 1}. ${opt.label}${desc}`)
  })

  const answer = await ask(rl, `\nChoice [${defaultIndex + 1}]: `)
  if (answer === "") return options[defaultIndex].value

  const index = parseInt(answer, 10) - 1
  if (index >= 0 && index < options.length) {
    return options[index].value
  }
  return options[defaultIndex].value
}

// =============================================================================
// FILE GENERATORS
// =============================================================================

function generatePackageJson(options: CreateOptions): string {
  const isEnterprise = options.template === "enterprise"
  const isFull = options.template === "full" || isEnterprise

  const scripts: Record<string, string> = {}

  if (options.typescript) {
    scripts.build = "tsc"
    scripts.prepublishOnly = "npm run build"
  }

  if (options.tests) {
    scripts.test = "vitest run"
    scripts["test:watch"] = "vitest"
  }

  if (options.storybook) {
    scripts.storybook = "storybook dev -p 6006"
    scripts["build-storybook"] = "storybook build"
  }

  if (isEnterprise) {
    scripts.lint = "eslint src --ext .ts"
    scripts.format = "prettier --write 'src/**/*.ts'"
    scripts.validate = "npm run lint && npm run test"
    scripts.release = "changeset publish"
  }

  const devDependencies: Record<string, string> = {}

  if (options.typescript) {
    devDependencies.typescript = "^5.0.0"
  }

  if (options.tests) {
    devDependencies.vitest = "^2.0.0"
  }

  if (options.storybook) {
    devDependencies.storybook = "^8.0.0"
    devDependencies["@storybook/react"] = "^8.0.0"
    devDependencies["@storybook/react-vite"] = "^8.0.0"
  }

  if (isEnterprise) {
    devDependencies.eslint = "^9.0.0"
    devDependencies.prettier = "^3.0.0"
    devDependencies["@changesets/cli"] = "^2.27.0"
  }

  const pkg = {
    name: options.name,
    version: "0.1.0",
    description: options.description || `Brand kit for ${options.name}`,
    author: options.author || "",
    license: options.license,
    type: "module",
    main: options.typescript ? "./dist/index.js" : "./index.js",
    types: options.typescript ? "./dist/index.d.ts" : undefined,
    exports: {
      ".": {
        types: options.typescript ? "./dist/index.d.ts" : undefined,
        import: options.typescript ? "./dist/index.js" : "./index.js",
        require: options.typescript ? "./dist/index.cjs" : "./index.cjs",
      },
      ...(isFull && {
        "./css": "./dist/brand.css",
      }),
    },
    files: options.typescript
      ? ["dist", "src"]
      : ["index.js", "index.cjs", ...(isFull ? ["brand.css"] : [])],
    scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
    peerDependencies: {
      "@platxa/frontend-agent": "^1.0.0",
    },
    devDependencies:
      Object.keys(devDependencies).length > 0
        ? {
            "@platxa/frontend-agent": "^1.0.0",
            ...devDependencies,
          }
        : { "@platxa/frontend-agent": "^1.0.0" },
    keywords: ["platxa", "brand-kit", "design-tokens", "theme", "css"],
    repository: isEnterprise
      ? {
          type: "git",
          url: `https://github.com/your-org/${options.name.replace(/^@[^/]+\//, "")}`,
        }
      : undefined,
  }

  const cleaned = JSON.parse(JSON.stringify(pkg))
  return JSON.stringify(cleaned, null, 2)
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        declaration: true,
        declarationMap: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: "./dist",
        rootDir: "./src",
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  )
}

function generateIndexTs(options: CreateOptions): string {
  const preset = options.preset === "custom" ? null : PRESETS[options.preset]
  const primaryHue = options.primaryHue ?? preset?.primaryHue ?? 222
  const accentHue = options.accentHue ?? preset?.accentHue ?? 262
  const isMinimal = options.template === "minimal"

  let content = `/**
 * ${options.name} Brand Kit
 *
 * Generated by create-brand-kit
 * Template: ${options.template}
 * Preset: ${options.preset}
 *
 * @packageDocumentation
 */

import type { BrandKitExport } from "@platxa/frontend-agent"

// =============================================================================
// METADATA
// =============================================================================

export const meta = {
  name: "${options.name}",
  version: "0.1.0",
  description: "${options.description || `Brand kit for ${options.name}`}",
  author: "${options.author || ""}",
} as const

// =============================================================================
// COLOR PRIMITIVES
// =============================================================================

export const primary = {
  50: "oklch(0.97 0.02 ${primaryHue})",
  100: "oklch(0.93 0.04 ${primaryHue})",
  200: "oklch(0.86 0.08 ${primaryHue})",
  300: "oklch(0.76 0.12 ${primaryHue})",
  400: "oklch(0.66 0.16 ${primaryHue})",
  500: "oklch(0.55 0.18 ${primaryHue})",
  600: "oklch(0.47 0.17 ${primaryHue})",
  700: "oklch(0.40 0.15 ${primaryHue})",
  800: "oklch(0.33 0.12 ${primaryHue})",
  900: "oklch(0.27 0.09 ${primaryHue})",
  950: "oklch(0.20 0.06 ${primaryHue})",
} as const

export const accent = {
  50: "oklch(0.97 0.02 ${accentHue})",
  100: "oklch(0.93 0.04 ${accentHue})",
  200: "oklch(0.86 0.08 ${accentHue})",
  300: "oklch(0.76 0.12 ${accentHue})",
  400: "oklch(0.66 0.16 ${accentHue})",
  500: "oklch(0.55 0.18 ${accentHue})",
  600: "oklch(0.47 0.17 ${accentHue})",
  700: "oklch(0.40 0.15 ${accentHue})",
  800: "oklch(0.33 0.12 ${accentHue})",
  900: "oklch(0.27 0.09 ${accentHue})",
  950: "oklch(0.20 0.06 ${accentHue})",
} as const

export const neutral = {
  50: "oklch(0.98 0.005 ${primaryHue})",
  100: "oklch(0.95 0.005 ${primaryHue})",
  200: "oklch(0.90 0.005 ${primaryHue})",
  300: "oklch(0.82 0.005 ${primaryHue})",
  400: "oklch(0.70 0.01 ${primaryHue})",
  500: "oklch(0.55 0.01 ${primaryHue})",
  600: "oklch(0.45 0.01 ${primaryHue})",
  700: "oklch(0.37 0.01 ${primaryHue})",
  800: "oklch(0.27 0.01 ${primaryHue})",
  900: "oklch(0.20 0.01 ${primaryHue})",
  950: "oklch(0.14 0.01 ${primaryHue})",
} as const

export const primitives = { primary, accent, neutral } as const

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

export const lightColors = {
  background: "oklch(0.99 0.002 ${primaryHue})",
  foreground: "oklch(0.15 0.01 ${primaryHue})",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.15 0.01 ${primaryHue})",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.15 0.01 ${primaryHue})",
  primary: primary[600],
  primaryForeground: "oklch(0.99 0 0)",
  secondary: neutral[100],
  secondaryForeground: neutral[900],
  muted: neutral[100],
  mutedForeground: neutral[500],
  accent: accent[100],
  accentForeground: accent[900],
  destructive: "oklch(0.55 0.22 25)",
  destructiveForeground: "oklch(0.99 0 0)",
  border: neutral[200],
  input: neutral[200],
  ring: primary[500],
} as const

export const darkColors = {
  background: "oklch(0.14 0.01 ${primaryHue})",
  foreground: "oklch(0.95 0.005 ${primaryHue})",
  card: "oklch(0.17 0.01 ${primaryHue})",
  cardForeground: "oklch(0.95 0.005 ${primaryHue})",
  popover: "oklch(0.17 0.01 ${primaryHue})",
  popoverForeground: "oklch(0.95 0.005 ${primaryHue})",
  primary: primary[500],
  primaryForeground: "oklch(0.12 0.01 ${primaryHue})",
  secondary: neutral[800],
  secondaryForeground: neutral[100],
  muted: neutral[800],
  mutedForeground: neutral[400],
  accent: accent[800],
  accentForeground: accent[100],
  destructive: "oklch(0.60 0.20 25)",
  destructiveForeground: "oklch(0.99 0 0)",
  border: neutral[800],
  input: neutral[800],
  ring: primary[400],
} as const

export const semantics = { light: lightColors, dark: darkColors } as const
`

  // Add optional sections based on template
  if (!isMinimal) {
    content += `
// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "Consolas", "monospace"],
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
} as const

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  px: "1px",
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const

// =============================================================================
// RADIUS
// =============================================================================

export const radius = {
  none: "0",
  sm: "0.125rem",
  default: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const

// =============================================================================
// SHADOW
// =============================================================================

export const shadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  none: "none",
} as const

// =============================================================================
// TAILWIND PRESET
// =============================================================================

export const tailwindPreset = {
  theme: {
    extend: {
      colors: { primary, accent, neutral },
      borderRadius: radius,
      boxShadow: shadow,
    },
  },
} as const
`
  }

  // Export
  content += `
// =============================================================================
// EXPORT
// =============================================================================

const brandKit: BrandKitExport = {
  meta,
  primitives,
  semantics,${!isMinimal ? `
  typography,
  spacing,
  radius,
  shadow,
  tailwindPreset,` : ""}
}

export default brandKit
`

  return content
}

function generateReadme(options: CreateOptions): string {
  const template = TEMPLATES[options.template]

  return `# ${options.name}

${options.description || `Brand kit for ${options.name}`}

## Features

${template.features.map((f) => `- ${f}`).join("\n")}

## Installation

\`\`\`bash
${options.packageManager} ${options.packageManager === "npm" ? "install" : "add"} ${options.name}
\`\`\`

## Usage

### With BrandProvider

\`\`\`tsx
import { BrandProvider } from "@platxa/frontend-agent"

function App() {
  return (
    <BrandProvider brandPackage="${options.name}">
      <YourApp />
    </BrandProvider>
  )
}
\`\`\`

### Direct Import

\`\`\`typescript
import brandKit from "${options.name}"

// Access colors
console.log(brandKit.primitives.primary[500])
console.log(brandKit.semantics.light.primary)
\`\`\`

### With Tailwind CSS

\`\`\`javascript
// tailwind.config.js
import brandKit from "${options.name}"

export default {
  presets: [brandKit.tailwindPreset],
}
\`\`\`

## Development

\`\`\`bash
# Build
${options.packageManager} run build

${options.tests ? `# Test\n${options.packageManager} run test\n` : ""}${options.storybook ? `# Storybook\n${options.packageManager} run storybook\n` : ""}
\`\`\`

## Validation

\`\`\`bash
npx @platxa/frontend-agent validate .
\`\`\`

## License

${options.license}
`
}

function generateGitignore(): string {
  return `node_modules/
dist/
*.log
.DS_Store
coverage/
storybook-static/
.changeset/*.md
!.changeset/README.md
`
}

function generateTestFile(options: CreateOptions): string {
  return `import { describe, it, expect } from "vitest"
import brandKit from "./index"

describe("${options.name}", () => {
  describe("meta", () => {
    it("has required fields", () => {
      expect(brandKit.meta.name).toBe("${options.name}")
      expect(brandKit.meta.version).toBeDefined()
    })
  })

  describe("primitives", () => {
    it("has primary color scale", () => {
      expect(brandKit.primitives.primary).toBeDefined()
      expect(brandKit.primitives.primary[500]).toBeDefined()
    })

    it("has accent color scale", () => {
      expect(brandKit.primitives.accent).toBeDefined()
      expect(brandKit.primitives.accent[500]).toBeDefined()
    })

    it("has neutral color scale", () => {
      expect(brandKit.primitives.neutral).toBeDefined()
      expect(brandKit.primitives.neutral[500]).toBeDefined()
    })
  })

  describe("semantics", () => {
    it("has light mode colors", () => {
      expect(brandKit.semantics.light).toBeDefined()
      expect(brandKit.semantics.light.primary).toBeDefined()
      expect(brandKit.semantics.light.background).toBeDefined()
      expect(brandKit.semantics.light.foreground).toBeDefined()
    })

    it("has dark mode colors", () => {
      expect(brandKit.semantics.dark).toBeDefined()
      expect(brandKit.semantics.dark.primary).toBeDefined()
      expect(brandKit.semantics.dark.background).toBeDefined()
      expect(brandKit.semantics.dark.foreground).toBeDefined()
    })
  })
})
`
}

function generateGitHubWorkflow(options: CreateOptions): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "${options.packageManager}"

      - name: Install dependencies
        run: ${options.packageManager} install

      - name: Build
        run: ${options.packageManager} run build

      ${options.tests ? `- name: Test
        run: ${options.packageManager} run test` : ""}

      - name: Validate brand kit
        run: npx @platxa/frontend-agent validate .

  publish:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: ${options.packageManager} install

      - name: Build
        run: ${options.packageManager} run build

      - name: Publish
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`
}

// =============================================================================
// INTERACTIVE WIZARD
// =============================================================================

async function runWizard(initialName?: string): Promise<CreateOptions> {
  const rl = createPrompt()

  console.log("\n")
  console.log("  ╔═══════════════════════════════════════════════════╗")
  console.log("  ║                                                   ║")
  console.log("  ║     🎨 Create Brand Kit                          ║")
  console.log("  ║     Interactive Setup Wizard                     ║")
  console.log("  ║                                                   ║")
  console.log("  ╚═══════════════════════════════════════════════════╝")
  console.log("\n")

  try {
    // Package name
    const defaultName = initialName || "my-brand-kit"
    const name =
      (await ask(rl, `  Package name: [${defaultName}] `)) || defaultName

    // Output directory
    const defaultDir = name.replace(/^@[^/]+\//, "")
    const outputDir =
      (await ask(rl, `  Output directory: [./${defaultDir}] `)) ||
      `./${defaultDir}`

    // Template selection
    const template = await askChoice(
      rl,
      "  Select a template:",
      [
        { value: "minimal" as const, label: "Minimal", description: "Colors only" },
        {
          value: "standard" as const,
          label: "Standard",
          description: "All design tokens (recommended)",
        },
        {
          value: "full" as const,
          label: "Full",
          description: "Standard + CSS & docs",
        },
        {
          value: "enterprise" as const,
          label: "Enterprise",
          description: "Full + testing & CI/CD",
        },
      ],
      1
    )

    // Preset selection
    const preset = await askChoice(
      rl,
      "  Select a color preset:",
      [
        { value: "default" as const, label: "Default", description: "Blue-Violet" },
        { value: "blue" as const, label: "Blue", description: "Ocean theme" },
        { value: "green" as const, label: "Green", description: "Nature theme" },
        { value: "violet" as const, label: "Violet", description: "Royal theme" },
        { value: "custom" as const, label: "Custom", description: "Pick your own hue" },
      ],
      0
    )

    let primaryHue: number | undefined
    let accentHue: number | undefined

    if (preset === "custom") {
      const hueStr = await ask(rl, "  Primary hue (0-360): [220] ")
      primaryHue = hueStr ? parseInt(hueStr, 10) : 220

      const accentStr = await ask(rl, "  Accent hue (0-360): [260] ")
      accentHue = accentStr ? parseInt(accentStr, 10) : 260
    }

    // TypeScript
    const typescript = await askYesNo(rl, "\n  Use TypeScript?", true)

    // Additional options based on template
    let storybook = false
    let tests = false

    if (template === "enterprise") {
      storybook = true
      tests = true
    } else if (template === "full") {
      tests = await askYesNo(rl, "  Include tests?", false)
      storybook = await askYesNo(rl, "  Include Storybook?", false)
    }

    // Package manager
    const packageManager = await askChoice(
      rl,
      "  Package manager:",
      [
        { value: "npm" as const, label: "npm" },
        { value: "pnpm" as const, label: "pnpm" },
        { value: "yarn" as const, label: "yarn" },
      ],
      0
    )

    // Metadata
    const description = await ask(rl, "\n  Description: ")
    const author = await ask(rl, "  Author: ")
    const license =
      (await ask(rl, "  License: [MIT] ")) || "MIT"

    // Git init
    const gitInit = await askYesNo(rl, "\n  Initialize git repository?", true)

    // Install deps
    const installDeps = await askYesNo(rl, "  Install dependencies?", true)

    rl.close()

    return {
      name,
      outputDir,
      template,
      preset,
      primaryHue,
      accentHue,
      typescript,
      storybook,
      tests,
      packageManager,
      author: author || undefined,
      description: description || undefined,
      license,
      gitInit,
      installDeps,
    }
  } catch (error) {
    rl.close()
    throw error
  }
}

// =============================================================================
// MAIN CREATE FUNCTION
// =============================================================================

export async function createBrandKit(
  options: CreateOptions
): Promise<CreateResult> {
  const files: string[] = []
  const nextSteps: string[] = []

  try {
    const outDir = path.resolve(process.cwd(), options.outputDir)

    // Check if directory exists and is not empty
    if (fs.existsSync(outDir)) {
      const contents = fs.readdirSync(outDir)
      if (contents.length > 0) {
        return {
          success: false,
          outputDir: outDir,
          files: [],
          error: `Directory "${options.outputDir}" is not empty`,
          nextSteps: [],
        }
      }
    } else {
      fs.mkdirSync(outDir, { recursive: true })
    }

    console.log("\n  Creating brand kit...\n")

    // Generate package.json
    fs.writeFileSync(
      path.join(outDir, "package.json"),
      generatePackageJson(options)
    )
    files.push("package.json")
    console.log("  ✓ package.json")

    // Generate source files
    if (options.typescript) {
      const srcDir = path.join(outDir, "src")
      fs.mkdirSync(srcDir, { recursive: true })

      fs.writeFileSync(
        path.join(srcDir, "index.ts"),
        generateIndexTs(options)
      )
      files.push("src/index.ts")
      console.log("  ✓ src/index.ts")

      fs.writeFileSync(
        path.join(outDir, "tsconfig.json"),
        generateTsConfig()
      )
      files.push("tsconfig.json")
      console.log("  ✓ tsconfig.json")

      // Tests
      if (options.tests) {
        fs.writeFileSync(
          path.join(srcDir, "index.test.ts"),
          generateTestFile(options)
        )
        files.push("src/index.test.ts")
        console.log("  ✓ src/index.test.ts")
      }
    }

    // README
    if (options.template !== "minimal") {
      fs.writeFileSync(path.join(outDir, "README.md"), generateReadme(options))
      files.push("README.md")
      console.log("  ✓ README.md")
    }

    // .gitignore
    fs.writeFileSync(path.join(outDir, ".gitignore"), generateGitignore())
    files.push(".gitignore")
    console.log("  ✓ .gitignore")

    // Enterprise: GitHub workflow
    if (options.template === "enterprise") {
      const workflowDir = path.join(outDir, ".github", "workflows")
      fs.mkdirSync(workflowDir, { recursive: true })
      fs.writeFileSync(
        path.join(workflowDir, "ci.yml"),
        generateGitHubWorkflow(options)
      )
      files.push(".github/workflows/ci.yml")
      console.log("  ✓ .github/workflows/ci.yml")
    }

    // Git init
    if (options.gitInit) {
      const { execSync } = await import("node:child_process")
      try {
        execSync("git init", { cwd: outDir, stdio: "ignore" })
        console.log("  ✓ Initialized git repository")
      } catch {
        console.log("  ⚠ Could not initialize git repository")
      }
    }

    // Install dependencies
    if (options.installDeps) {
      const { execSync } = await import("node:child_process")
      console.log(`\n  Installing dependencies with ${options.packageManager}...`)
      try {
        const installCmd =
          options.packageManager === "yarn" ? "yarn" : `${options.packageManager} install`
        execSync(installCmd, { cwd: outDir, stdio: "inherit" })
        console.log("  ✓ Dependencies installed")
      } catch {
        console.log("  ⚠ Could not install dependencies")
        nextSteps.push(`${options.packageManager} install`)
      }
    } else {
      nextSteps.push(`${options.packageManager} install`)
    }

    // Build step
    if (options.typescript) {
      nextSteps.push(`${options.packageManager} run build`)
    }

    nextSteps.push(`Edit src/index.ts to customize your brand colors`)
    nextSteps.push(`npx @platxa/frontend-agent validate . to check your kit`)

    // Success message
    console.log("\n  ╔═══════════════════════════════════════════════════╗")
    console.log("  ║  ✅ Brand kit created successfully!               ║")
    console.log("  ╚═══════════════════════════════════════════════════╝")
    console.log(`\n  Location: ${outDir}\n`)

    if (nextSteps.length > 0) {
      console.log("  Next steps:")
      console.log(`    cd ${options.outputDir}`)
      nextSteps.forEach((step) => console.log(`    ${step}`))
      console.log("")
    }

    return {
      success: true,
      outputDir: outDir,
      files,
      nextSteps,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      outputDir: options.outputDir,
      files,
      error: message,
      nextSteps: [],
    }
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: create-brand-kit [name] [options]

Create a new Platxa brand kit package.

Arguments:
  name                    Package name (e.g., @acme/brand-kit)

Options:
  --template <type>       Template: minimal, standard, full, enterprise
  --preset <name>         Preset: default, blue, green, violet, custom
  --hue <number>          Primary hue (0-360) for custom preset
  --typescript, --ts      Use TypeScript (default)
  --javascript, --js      Use JavaScript
  --pm <manager>          Package manager: npm, yarn, pnpm
  --no-git                Skip git initialization
  --no-install            Skip dependency installation
  -h, --help              Show this help

Templates:
  minimal     - Colors only
  standard    - All design tokens (recommended)
  full        - Standard + CSS output & docs
  enterprise  - Full + testing, Storybook, CI/CD

Examples:
  create-brand-kit
  create-brand-kit my-brand
  create-brand-kit @acme/brand-kit --template full
  create-brand-kit my-brand --preset custom --hue 180
`)
    process.exit(0)
  }

  // Parse CLI args for non-interactive mode
  let name: string | undefined
  let template: CreateOptions["template"] = "standard"
  let preset: CreateOptions["preset"] = "default"
  let primaryHue: number | undefined
  let typescript = true
  let packageManager: CreateOptions["packageManager"] = "npm"
  let gitInit = true
  let installDeps = true

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--template") {
      const t = args[++i]
      if (["minimal", "standard", "full", "enterprise"].includes(t)) {
        template = t as CreateOptions["template"]
      }
    } else if (arg === "--preset") {
      const p = args[++i]
      if (["default", "blue", "green", "violet", "custom"].includes(p)) {
        preset = p as CreateOptions["preset"]
      }
    } else if (arg === "--hue") {
      primaryHue = parseInt(args[++i], 10)
    } else if (arg === "--typescript" || arg === "--ts") {
      typescript = true
    } else if (arg === "--javascript" || arg === "--js") {
      typescript = false
    } else if (arg === "--pm") {
      const pm = args[++i]
      if (["npm", "yarn", "pnpm"].includes(pm)) {
        packageManager = pm as CreateOptions["packageManager"]
      }
    } else if (arg === "--no-git") {
      gitInit = false
    } else if (arg === "--no-install") {
      installDeps = false
    } else if (!arg.startsWith("-") && !name) {
      name = arg
    }
  }

  // If minimal args, run interactive wizard
  const hasEnoughArgs = name && args.some((a) => a.startsWith("--template"))

  if (!hasEnoughArgs) {
    const options = await runWizard(name)
    const result = await createBrandKit(options)
    process.exit(result.success ? 0 : 1)
  }

  // Non-interactive mode
  const options: CreateOptions = {
    name: name!,
    outputDir: `./${name!.replace(/^@[^/]+\//, "")}`,
    template,
    preset,
    primaryHue,
    typescript,
    storybook: template === "enterprise",
    tests: template === "enterprise" || template === "full",
    packageManager,
    license: "MIT",
    gitInit,
    installDeps,
  }

  const result = await createBrandKit(options)

  if (!result.success) {
    console.error(`\n  ❌ Error: ${result.error}\n`)
  }

  process.exit(result.success ? 0 : 1)
}

// Run if executed directly
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`

if (isMain) {
  main().catch((err) => {
    console.error("Error:", err.message)
    process.exit(1)
  })
}
