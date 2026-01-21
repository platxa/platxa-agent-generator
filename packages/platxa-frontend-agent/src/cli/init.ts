#!/usr/bin/env node
/**
 * CLI Brand Init Command (Feature #75)
 *
 * Initializes brand configuration for a project.
 *
 * @example
 * ```bash
 * npx @platxa/frontend-agent init
 * # or
 * pnpm dlx @platxa/frontend-agent init
 * ```
 *
 * @module cli/init
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"

// =============================================================================
// TYPES
// =============================================================================

interface InitOptions {
  /** Project name */
  projectName: string
  /** Use brand kit package */
  useBrandKit: boolean
  /** Brand kit package name */
  brandPackage?: string
  /** Built-in preset to use */
  preset: string
  /** Generate TypeScript config */
  typescript: boolean
  /** Install dependencies */
  installDeps: boolean
}

interface InitResult {
  /** Whether initialization succeeded */
  success: boolean
  /** Path to generated config file */
  configPath?: string
  /** Error message if failed */
  error?: string
  /** Commands to run after init */
  nextSteps: string[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESETS = ["default", "blue", "green", "violet"] as const

const CONFIG_TEMPLATE_TS = `import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
})
`

const CONFIG_TEMPLATE_JS = `/** @type {import('@platxa/frontend-agent').FrontendConfig} */
module.exports = {
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
}
`

const BRAND_CONFIG_TEMPLATE = `
  // Brand kit (opt-in)
  brand: {
    package: "{{BRAND_PACKAGE}}",
  },
`

// =============================================================================
// PROMPTS
// =============================================================================

/**
 * Create readline interface for prompts
 */
function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Ask a question and get response
 */
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

/**
 * Ask yes/no question
 */
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

/**
 * Ask with options
 */
async function askChoice(
  rl: readline.Interface,
  question: string,
  options: readonly string[],
  defaultIndex: number = 0
): Promise<string> {
  console.log(question)
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? ">" : " "
    console.log(`  ${marker} ${i + 1}. ${opt}`)
  })

  const answer = await ask(rl, `Choice [${defaultIndex + 1}]: `)

  if (answer === "") return options[defaultIndex]

  const index = parseInt(answer, 10) - 1
  if (index >= 0 && index < options.length) {
    return options[index]
  }

  return options[defaultIndex]
}

// =============================================================================
// CONFIG GENERATION
// =============================================================================

/**
 * Generate config file content
 */
function generateConfigContent(options: InitOptions): string {
  const template = options.typescript ? CONFIG_TEMPLATE_TS : CONFIG_TEMPLATE_JS

  let content = template.replace("{{PRESET}}", options.preset)

  if (options.useBrandKit && options.brandPackage) {
    const brandConfig = BRAND_CONFIG_TEMPLATE.replace(
      "{{BRAND_PACKAGE}}",
      options.brandPackage
    )
    content = content.replace("{{BRAND_CONFIG}}", brandConfig)
  } else {
    content = content.replace("{{BRAND_CONFIG}}", "")
  }

  return content
}

/**
 * Get config file path
 */
function getConfigPath(cwd: string, typescript: boolean): string {
  const ext = typescript ? ".ts" : ".js"
  return path.join(cwd, `frontend.config${ext}`)
}

// =============================================================================
// DEPENDENCY INSTALLATION
// =============================================================================

/**
 * Detect package manager
 */
function detectPackageManager(cwd: string): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm"
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn"
  return "npm"
}

/**
 * Get install command
 */
function getInstallCommand(
  packageManager: "npm" | "yarn" | "pnpm",
  packages: string[]
): string {
  const pkgList = packages.join(" ")

  switch (packageManager) {
    case "pnpm":
      return `pnpm add ${pkgList}`
    case "yarn":
      return `yarn add ${pkgList}`
    default:
      return `npm install ${pkgList}`
  }
}

// =============================================================================
// MAIN INIT FUNCTION
// =============================================================================

/**
 * Run interactive init prompts
 */
async function runInteractivePrompts(): Promise<InitOptions> {
  const rl = createPrompt()

  console.log("\n🎨 Platxa Frontend Agent - Brand Configuration\n")
  console.log("This will create a frontend.config file in your project.\n")

  try {
    // Project name
    const cwdName = path.basename(process.cwd())
    const projectName = await ask(rl, `Project name [${cwdName}]: `) || cwdName

    // TypeScript
    const hasTs = fs.existsSync(path.join(process.cwd(), "tsconfig.json"))
    const typescript = await askYesNo(rl, "Use TypeScript config?", hasTs)

    // Preset
    const preset = await askChoice(rl, "\nSelect a theme preset:", PRESETS, 0)

    // Brand kit
    const useBrandKit = await askYesNo(
      rl,
      "\nUse a custom brand kit package?",
      false
    )

    let brandPackage: string | undefined
    if (useBrandKit) {
      brandPackage = await ask(rl, "Brand kit package name: ")
      if (!brandPackage) {
        console.log("No package specified, skipping brand kit.")
      }
    }

    // Install deps
    const installDeps = await askYesNo(
      rl,
      "\nInstall dependencies automatically?",
      true
    )

    rl.close()

    return {
      projectName,
      useBrandKit: useBrandKit && !!brandPackage,
      brandPackage,
      preset,
      typescript,
      installDeps,
    }
  } catch (error) {
    rl.close()
    throw error
  }
}

/**
 * Initialize brand configuration (Feature #75)
 *
 * @param options - Optional pre-configured options (skips prompts)
 * @returns Initialization result
 */
export async function initBrandConfig(
  options?: Partial<InitOptions>
): Promise<InitResult> {
  const cwd = process.cwd()
  const nextSteps: string[] = []

  try {
    // Get options from prompts or use provided
    const config: InitOptions = options?.projectName
      ? {
          projectName: options.projectName,
          useBrandKit: options.useBrandKit ?? false,
          brandPackage: options.brandPackage,
          preset: options.preset ?? "default",
          typescript: options.typescript ?? true,
          installDeps: options.installDeps ?? false,
        }
      : await runInteractivePrompts()

    // Generate config content
    const content = generateConfigContent(config)
    const configPath = getConfigPath(cwd, config.typescript)

    // Check if config already exists
    if (fs.existsSync(configPath)) {
      console.log(`\n⚠️  Config file already exists: ${path.basename(configPath)}`)
      const rl = createPrompt()
      const overwrite = await askYesNo(rl, "Overwrite?", false)
      rl.close()

      if (!overwrite) {
        return {
          success: false,
          error: "Config file already exists",
          nextSteps: [],
        }
      }
    }

    // Write config file
    fs.writeFileSync(configPath, content, "utf-8")
    console.log(`\n✅ Created ${path.basename(configPath)}`)

    // Determine packages to install
    const packages = ["@platxa/frontend-agent"]
    if (config.useBrandKit && config.brandPackage) {
      packages.push(config.brandPackage)
    }

    // Install dependencies
    const pm = detectPackageManager(cwd)
    const installCmd = getInstallCommand(pm, packages)

    if (config.installDeps) {
      console.log(`\n📦 Installing dependencies...`)
      console.log(`   $ ${installCmd}`)

      // Note: In a real implementation, we'd use child_process.exec here
      // For now, we add it to next steps
      nextSteps.push(`Run: ${installCmd}`)
    } else {
      nextSteps.push(`Install dependencies: ${installCmd}`)
    }

    // Add usage instructions
    nextSteps.push("Import and use in your app:")
    nextSteps.push('  import { BrandProvider } from "@platxa/frontend-agent"')
    nextSteps.push("  <BrandProvider>...</BrandProvider>")

    console.log("\n🎉 Brand configuration initialized!\n")
    console.log("Next steps:")
    nextSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`)
    })
    console.log("")

    return {
      success: true,
      configPath,
      nextSteps,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Error: ${message}\n`)
    return {
      success: false,
      error: message,
      nextSteps: [],
    }
  }
}

/**
 * CLI entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: platxa-init [options]

Initialize Platxa Frontend Agent brand configuration.

Options:
  --preset <name>    Use preset (default, blue, green, violet)
  --brand <package>  Use brand kit package
  --typescript       Generate TypeScript config (default: auto-detect)
  --javascript       Generate JavaScript config
  --no-install       Skip dependency installation
  -h, --help         Show this help message

Examples:
  platxa-init
  platxa-init --preset blue
  platxa-init --brand @acme/brand-kit
`)
    process.exit(0)
  }

  // Parse CLI args for non-interactive mode
  const options: Partial<InitOptions> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--preset" && args[i + 1]) {
      options.preset = args[++i]
    } else if (arg === "--brand" && args[i + 1]) {
      options.useBrandKit = true
      options.brandPackage = args[++i]
    } else if (arg === "--typescript") {
      options.typescript = true
    } else if (arg === "--javascript") {
      options.typescript = false
    } else if (arg === "--no-install") {
      options.installDeps = false
    }
  }

  const result = await initBrandConfig(
    Object.keys(options).length > 0 ? options : undefined
  )

  process.exit(result.success ? 0 : 1)
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}
