/**
 * Developer Experience (DX) Module
 *
 * Storybook generation, visual regression testing,
 * responsive preview, and live preview systems.
 */

import type {
  StoryConfig,
  StoryVariant,
  GeneratedStory,
  StoryGeneratorOptions,
  SnapshotConfig,
  SnapshotScenario,
  ViewportConfig,
  GeneratedVisualTest,
  Breakpoint,
  ResponsivePreviewConfig,
  GeneratedResponsivePreview,
  LivePreviewConfig,
  GeneratedLivePreview,
  DxSystemConfig,
} from "./types"

// =============================================================================
// Storybook Story Generator (#82)
// =============================================================================

/**
 * Default story variants to generate
 */
export const DEFAULT_STORY_VARIANTS: StoryVariant[] = [
  { name: "Default", props: {} },
  { name: "Disabled", props: { disabled: true } },
  { name: "Loading", props: { isLoading: true } },
]

/**
 * Generate arg types from props
 */
function generateArgTypes(
  props: Array<{ name: string; type: string; required: boolean; defaultValue?: unknown }>
): StoryConfig["argTypes"] {
  const argTypes: StoryConfig["argTypes"] = {}

  for (const prop of props) {
    const type = prop.type.toLowerCase()

    if (type === "boolean") {
      argTypes[prop.name] = {
        control: "boolean",
        description: `The ${prop.name} prop`,
        defaultValue: prop.defaultValue ?? false,
      }
    } else if (type.includes("|") && !type.includes("=>")) {
      // Union type - create select control
      const options = type.split("|").map((t) => t.trim().replace(/['"]/g, ""))
      argTypes[prop.name] = {
        control: { type: "select", options },
        description: `The ${prop.name} prop`,
      }
    } else if (type === "string") {
      argTypes[prop.name] = {
        control: "text",
        description: `The ${prop.name} prop`,
        defaultValue: prop.defaultValue ?? "",
      }
    } else if (type === "number") {
      argTypes[prop.name] = {
        control: "number",
        description: `The ${prop.name} prop`,
        defaultValue: prop.defaultValue ?? 0,
      }
    } else if (type.startsWith("react.reactnode") || type === "reactnode") {
      argTypes[prop.name] = {
        control: "text",
        description: `The ${prop.name} prop (ReactNode)`,
      }
    } else {
      argTypes[prop.name] = {
        control: "object",
        description: `The ${prop.name} prop`,
      }
    }
  }

  return argTypes
}

/**
 * Generate a Storybook story file
 */
export function generateStory(
  config: StoryConfig,
  options: StoryGeneratorOptions = {}
): GeneratedStory {
  const {
    includeDocs = true,
    includeActions = true,
    includeControls: _includeControls = true,
    typescript: _typescript = true,
    suffix = ".stories.tsx",
  } = options

  const lines: string[] = []

  // Imports
  lines.push(`import type { Meta, StoryObj } from "@storybook/react"`)
  if (includeActions) {
    lines.push(`import { fn } from "@storybook/test"`)
  }
  lines.push(`import { ${config.componentName} } from "${config.importPath}"`)
  lines.push("")

  // Meta
  lines.push(`const meta: Meta<typeof ${config.componentName}> = {`)
  lines.push(`  title: "${config.title}",`)
  lines.push(`  component: ${config.componentName},`)

  // Parameters
  if (config.parameters || includeDocs) {
    lines.push(`  parameters: {`)
    if (config.parameters?.layout) {
      lines.push(`    layout: "${config.parameters.layout}",`)
    } else {
      lines.push(`    layout: "centered",`)
    }
    if (includeDocs && config.description) {
      lines.push(`    docs: {`)
      lines.push(`      description: {`)
      lines.push(`        component: "${config.description}",`)
      lines.push(`      },`)
      lines.push(`    },`)
    }
    lines.push(`  },`)
  }

  // Tags
  lines.push(`  tags: ["autodocs"],`)

  // Arg types
  if (config.argTypes && Object.keys(config.argTypes).length > 0) {
    lines.push(`  argTypes: {`)
    for (const [name, argType] of Object.entries(config.argTypes)) {
      lines.push(`    ${name}: {`)
      if (typeof argType.control === "string") {
        lines.push(`      control: "${argType.control}",`)
      } else {
        lines.push(`      control: { type: "${argType.control.type}"${argType.control.options ? `, options: ${JSON.stringify(argType.control.options)}` : ""} },`)
      }
      if (argType.description) {
        lines.push(`      description: "${argType.description}",`)
      }
      lines.push(`    },`)
    }
    lines.push(`  },`)
  }

  // Default args with actions
  if (includeActions) {
    lines.push(`  args: {`)
    lines.push(`    onClick: fn(),`)
    lines.push(`  },`)
  }

  // Decorators
  if (config.decorators && config.decorators.length > 0) {
    lines.push(`  decorators: [`)
    for (const decorator of config.decorators) {
      lines.push(`    ${decorator},`)
    }
    lines.push(`  ],`)
  }

  lines.push(`}`)
  lines.push("")
  lines.push(`export default meta`)
  lines.push(`type Story = StoryObj<typeof meta>`)
  lines.push("")

  // Generate story variants
  for (const variant of config.variants) {
    lines.push(`/**`)
    lines.push(` * ${variant.description || variant.name + " variant"}`)
    lines.push(` */`)
    lines.push(`export const ${variant.name.replace(/\s+/g, "")}: Story = {`)
    if (Object.keys(variant.props).length > 0) {
      lines.push(`  args: ${JSON.stringify(variant.props, null, 4).replace(/\n/g, "\n  ")},`)
    }
    if (variant.decorators && variant.decorators.length > 0) {
      lines.push(`  decorators: [${variant.decorators.join(", ")}],`)
    }
    lines.push(`}`)
    lines.push("")
  }

  return {
    content: lines.join("\n"),
    fileName: `${config.componentName}${suffix}`,
    csfVersion: 3,
  }
}

/**
 * Extract balanced brace content from position
 */
function extractBalancedBraces(code: string, startIndex: number): string {
  let depth = 0
  let start = -1

  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (code[i] === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        return code.slice(start + 1, i)
      }
    }
  }
  return ""
}

/**
 * Extract CVA variants from code
 */
function extractCvaVariants(code: string): Array<{ variantName: string; options: string[] }> {
  const results: Array<{ variantName: string; options: string[] }> = []

  // Find variants: { in the code
  const variantsStart = code.indexOf("variants:")
  if (variantsStart === -1) return results

  // Find the opening brace after variants:
  const braceStart = code.indexOf("{", variantsStart)
  if (braceStart === -1) return results

  const variantsContent = extractBalancedBraces(code, variantsStart)
  if (!variantsContent) return results

  // Parse each variant category (variant, size, etc.)
  const categoryPattern = /(\w+):\s*{/g
  let match: RegExpExecArray | null

  while ((match = categoryPattern.exec(variantsContent)) !== null) {
    const variantName = match[1]
    // Find the content of this category
    const categoryContent = extractBalancedBraces(variantsContent, match.index + match[0].length - 1)

    // Extract option names (keys before colons)
    const optionPattern = /(\w+):/g
    const options: string[] = []
    let optMatch: RegExpExecArray | null

    while ((optMatch = optionPattern.exec(categoryContent)) !== null) {
      options.push(optMatch[1])
    }

    if (options.length > 0) {
      results.push({ variantName, options })
    }
  }

  return results
}

/**
 * Generate stories from component code
 */
export function generateStoriesFromCode(
  code: string,
  options: StoryGeneratorOptions = {}
): GeneratedStory {
  // Extract component name
  const nameMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/) ||
    code.match(/function\s+([A-Z]\w+)/) ||
    code.match(/export\s+(?:const|function)\s+([A-Z]\w+)/)
  const componentName = nameMatch?.[1] || "Component"

  // Extract props
  const propsMatch = code.match(/interface\s+(\w*Props)[^{]*{([^}]+)}/s)
  const props: Array<{ name: string; type: string; required: boolean }> = []
  if (propsMatch) {
    const propPattern = /(\w+)(\?)?:\s*([^;\n]+)/g
    let match: RegExpExecArray | null
    while ((match = propPattern.exec(propsMatch[2])) !== null) {
      props.push({
        name: match[1],
        type: match[3].trim(),
        required: !match[2],
      })
    }
  }

  // Extract variants from CVA if present
  const variants: StoryVariant[] = [{ name: "Default", props: {}, description: "Default state" }]

  const cvaVariants = extractCvaVariants(code)
  for (const { variantName, options } of cvaVariants) {
    for (const optionName of options) {
      if (optionName !== "default" && !variants.some((v) => v.name.toLowerCase() === optionName.toLowerCase())) {
        variants.push({
          name: optionName.charAt(0).toUpperCase() + optionName.slice(1),
          props: { [variantName]: optionName },
          description: `${variantName}: ${optionName}`,
        })
      }
    }
  }

  // Add common interaction states
  if (props.some((p) => p.name === "disabled")) {
    variants.push({ name: "Disabled", props: { disabled: true }, description: "Disabled state" })
  }
  if (props.some((p) => p.name === "isLoading")) {
    variants.push({ name: "Loading", props: { isLoading: true }, description: "Loading state" })
  }

  const config: StoryConfig = {
    componentName,
    importPath: `./${componentName}`,
    title: `Components/${componentName}`,
    description: `${componentName} component`,
    variants,
    argTypes: generateArgTypes(props),
    parameters: { layout: "centered" },
  }

  return generateStory(config, options)
}

// =============================================================================
// Visual Regression Testing (#83)
// =============================================================================

/**
 * Default viewports for visual testing
 */
export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: "mobile", width: 375, height: 667, isMobile: true },
  { name: "tablet", width: 768, height: 1024, isMobile: true },
  { name: "desktop", width: 1280, height: 800, isMobile: false },
  { name: "wide", width: 1920, height: 1080, isMobile: false },
]

/**
 * Generate visual regression test
 */
export function generateVisualTest(
  config: SnapshotConfig,
  framework: "playwright" | "cypress" | "puppeteer" = "playwright"
): GeneratedVisualTest {
  const lines: string[] = []

  if (framework === "playwright") {
    lines.push(`import { test, expect } from "@playwright/test"`)
    lines.push("")
    lines.push(`test.describe("${config.componentName} Visual Tests", () => {`)

    // Generate test for each scenario
    for (const scenario of config.scenarios) {
      lines.push(`  test("${scenario.name}", async ({ page }) => {`)

      // Set viewport if specified
      if (scenario.viewport) {
        lines.push(`    await page.setViewportSize({ width: ${scenario.viewport.width}, height: ${scenario.viewport.height} })`)
      }

      // Navigate to component
      lines.push(`    await page.goto("/components/${config.componentName.toLowerCase()}?props=${encodeURIComponent(JSON.stringify(scenario.props))}")`)

      // Wait for selector if specified
      if (scenario.waitForSelector) {
        lines.push(`    await page.waitForSelector("${scenario.waitForSelector}")`)
      }

      // Delay if specified
      if (scenario.delay) {
        lines.push(`    await page.waitForTimeout(${scenario.delay})`)
      }

      // Take screenshot
      lines.push(`    await expect(page).toHaveScreenshot("${config.componentName}-${scenario.name.toLowerCase().replace(/\s+/g, "-")}.png", {`)
      lines.push(`      threshold: ${config.threshold ?? 0.1},`)
      lines.push(`    })`)

      lines.push(`  })`)
      lines.push("")
    }

    // Generate viewport tests
    if (config.viewports && config.viewports.length > 0) {
      lines.push(`  test.describe("Responsive", () => {`)
      for (const viewport of config.viewports) {
        lines.push(`    test("${viewport.name}", async ({ page }) => {`)
        lines.push(`      await page.setViewportSize({ width: ${viewport.width}, height: ${viewport.height} })`)
        lines.push(`      await page.goto("/components/${config.componentName.toLowerCase()}")`)
        lines.push(`      await expect(page).toHaveScreenshot("${config.componentName}-${viewport.name}.png")`)
        lines.push(`    })`)
        lines.push("")
      }
      lines.push(`  })`)
    }

    // Generate theme tests
    if (config.themes && config.themes.length > 0) {
      lines.push(`  test.describe("Themes", () => {`)
      for (const theme of config.themes) {
        lines.push(`    test("${theme} theme", async ({ page }) => {`)
        lines.push(`      await page.goto("/components/${config.componentName.toLowerCase()}")`)
        lines.push(`      await page.evaluate(() => document.documentElement.classList.${theme === "dark" ? "add" : "remove"}("dark"))`)
        lines.push(`      await expect(page).toHaveScreenshot("${config.componentName}-${theme}.png")`)
        lines.push(`    })`)
        lines.push("")
      }
      lines.push(`  })`)
    }

    lines.push(`})`)
  } else if (framework === "cypress") {
    lines.push(`describe("${config.componentName} Visual Tests", () => {`)

    for (const scenario of config.scenarios) {
      lines.push(`  it("${scenario.name}", () => {`)

      if (scenario.viewport) {
        lines.push(`    cy.viewport(${scenario.viewport.width}, ${scenario.viewport.height})`)
      }

      lines.push(`    cy.visit("/components/${config.componentName.toLowerCase()}")`)

      if (scenario.waitForSelector) {
        lines.push(`    cy.get("${scenario.waitForSelector}").should("be.visible")`)
      }

      if (scenario.delay) {
        lines.push(`    cy.wait(${scenario.delay})`)
      }

      lines.push(`    cy.matchImageSnapshot("${config.componentName}-${scenario.name.toLowerCase().replace(/\s+/g, "-")}")`)
      lines.push(`  })`)
      lines.push("")
    }

    lines.push(`})`)
  }

  return {
    content: lines.join("\n"),
    fileName: `${config.componentName}.visual.spec.ts`,
    framework,
  }
}

/**
 * Generate visual tests from component code
 */
export function generateVisualTestsFromCode(
  code: string,
  options: { framework?: "playwright" | "cypress" | "puppeteer"; viewports?: ViewportConfig[] } = {}
): GeneratedVisualTest {
  // Extract component name
  const nameMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/) ||
    code.match(/function\s+([A-Z]\w+)/)
  const componentName = nameMatch?.[1] || "Component"

  // Build scenarios from variants
  const scenarios: SnapshotScenario[] = [
    { name: "Default", props: {} },
  ]

  // Extract variants using the CVA helper
  const cvaVariants = extractCvaVariants(code)
  for (const { variantName, options } of cvaVariants) {
    for (const optionName of options) {
      if (optionName !== "default") {
        scenarios.push({
          name: `${variantName}-${optionName}`,
          props: { [variantName]: optionName },
        })
      }
    }
  }

  // Add interaction states
  if (/disabled/.test(code)) {
    scenarios.push({ name: "Disabled", props: { disabled: true } })
  }

  const config: SnapshotConfig = {
    componentName,
    scenarios,
    viewports: options.viewports || DEFAULT_VIEWPORTS,
    themes: ["light", "dark"],
    threshold: 0.1,
  }

  return generateVisualTest(config, options.framework || "playwright")
}

// =============================================================================
// Responsive Preview System (#84)
// =============================================================================

/**
 * Default breakpoints (Tailwind CSS)
 */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: "xs", minWidth: 0, maxWidth: 639, device: "Mobile (Portrait)", prefix: "" },
  { name: "sm", minWidth: 640, maxWidth: 767, device: "Mobile (Landscape)", prefix: "sm:" },
  { name: "md", minWidth: 768, maxWidth: 1023, device: "Tablet", prefix: "md:" },
  { name: "lg", minWidth: 1024, maxWidth: 1279, device: "Laptop", prefix: "lg:" },
  { name: "xl", minWidth: 1280, maxWidth: 1535, device: "Desktop", prefix: "xl:" },
  { name: "2xl", minWidth: 1536, device: "Large Desktop", prefix: "2xl:" },
]

/**
 * Generate responsive preview component
 */
export function generateResponsivePreview(
  componentCode: string,
  config: ResponsivePreviewConfig = { breakpoints: DEFAULT_BREAKPOINTS }
): GeneratedResponsivePreview {
  // Extract component name
  const nameMatch = componentCode.match(/const\s+([A-Z]\w+)\s*=\s*(?:React\.)?forwardRef/) ||
    componentCode.match(/function\s+([A-Z]\w+)/)
  const componentName = nameMatch?.[1] || "Component"

  // Generate preview component
  const component = `
import * as React from "react"
import { ${componentName} } from "./${componentName}"

interface ResponsivePreviewProps {
  showAll?: boolean
  activeBreakpoint?: string
  zoom?: number
}

const breakpoints = ${JSON.stringify(config.breakpoints, null, 2)}

export function ${componentName}ResponsivePreview({
  showAll = false,
  activeBreakpoint = "md",
  zoom = 1,
}: ResponsivePreviewProps) {
  const [active, setActive] = React.useState(activeBreakpoint)
  const [viewAll, setViewAll] = React.useState(showAll)

  const activeConfig = breakpoints.find(b => b.name === active)

  if (viewAll) {
    return (
      <div className="flex flex-wrap gap-4 p-4">
        {breakpoints.map(bp => (
          <div
            key={bp.name}
            className="border rounded-lg overflow-hidden"
            style={{ width: bp.minWidth * zoom }}
          >
            ${config.showLabels !== false ? `<div className="bg-muted px-2 py-1 text-xs font-medium">
              {bp.name} - {bp.device} ({bp.minWidth}px)
            </div>` : ""}
            <div className="p-4">
              <${componentName} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {breakpoints.map(bp => (
          <button
            key={bp.name}
            onClick={() => setActive(bp.name)}
            className={\`px-3 py-1 rounded \${active === bp.name ? "bg-primary text-primary-foreground" : "bg-muted"}\`}
          >
            {bp.name}
          </button>
        ))}
        <button
          onClick={() => setViewAll(true)}
          className="px-3 py-1 rounded bg-muted ml-auto"
        >
          View All
        </button>
      </div>
      <div
        className="border rounded-lg overflow-auto mx-auto"
        style={{ width: (activeConfig?.minWidth || 768) * zoom }}
      >
        ${config.showLabels !== false ? `<div className="bg-muted px-2 py-1 text-xs font-medium sticky top-0">
          {activeConfig?.name} - {activeConfig?.device} ({activeConfig?.minWidth}px)
        </div>` : ""}
        <div className="p-4">
          <${componentName} />
        </div>
      </div>
    </div>
  )
}
`.trim()

  // Generate styles
  const styles = `
.responsive-preview {
  --preview-border: 1px solid hsl(var(--border));
  --preview-radius: 0.5rem;
}

.responsive-preview-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.responsive-preview-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.responsive-preview-frame {
  border: var(--preview-border);
  border-radius: var(--preview-radius);
  overflow: hidden;
  transition: width 0.3s ease;
}

.responsive-preview-label {
  background: hsl(var(--muted));
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.responsive-preview-content {
  padding: 1rem;
}
`.trim()

  // Generate script for controls
  const script = `
export function useResponsivePreview(initialBreakpoint = "md") {
  const [activeBreakpoint, setActiveBreakpoint] = React.useState(initialBreakpoint)
  const [showAll, setShowAll] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">("portrait")

  const toggleOrientation = () => {
    setOrientation(o => o === "portrait" ? "landscape" : "portrait")
  }

  return {
    activeBreakpoint,
    setActiveBreakpoint,
    showAll,
    setShowAll,
    zoom,
    setZoom,
    orientation,
    toggleOrientation,
  }
}
`.trim()

  return {
    component,
    styles,
    script,
  }
}

// =============================================================================
// Live Preview System (#85)
// =============================================================================

/**
 * Default live preview configuration
 */
export const DEFAULT_LIVE_PREVIEW_CONFIG: LivePreviewConfig = {
  watchPatterns: ["src/components/**/*.tsx", "src/components/**/*.ts"],
  debounceDelay: 300,
  hotReload: true,
  errorOverlay: true,
  port: 3333,
}

/**
 * Generate live preview setup
 */
export function generateLivePreview(
  config: LivePreviewConfig = DEFAULT_LIVE_PREVIEW_CONFIG
): GeneratedLivePreview {
  // Server code
  const server = `
import { createServer } from "vite"
import { WebSocketServer } from "ws"
import chokidar from "chokidar"

const PORT = ${config.port || 3333}

async function startPreviewServer() {
  // Create Vite dev server
  const vite = await createServer({
    server: { port: PORT },
    optimizeDeps: { include: ["react", "react-dom"] },
  })

  await vite.listen()
  console.log(\`Preview server running at http://localhost:\${PORT}\`)

  // Create WebSocket server for hot updates
  const wss = new WebSocketServer({ port: PORT + 1 })

  // Watch for file changes
  const watcher = chokidar.watch(${JSON.stringify(config.watchPatterns)}, {
    ignored: /node_modules/,
    persistent: true,
  })

  let debounceTimer: NodeJS.Timeout

  watcher.on("change", (filePath) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      console.log(\`File changed: \${filePath}\`)

      // Notify all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "update",
            filePath,
            timestamp: Date.now(),
          }))
        }
      })
    }, ${config.debounceDelay || 300})
  })

  wss.on("connection", (ws) => {
    console.log("Preview client connected")

    ws.on("close", () => {
      console.log("Preview client disconnected")
    })
  })

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await vite.close()
    wss.close()
    watcher.close()
    process.exit(0)
  })
}

startPreviewServer()
`.trim()

  // Client code
  const client = `
import * as React from "react"

interface LivePreviewProps {
  children: React.ReactNode
  wsUrl?: string
}

export function LivePreview({
  children,
  wsUrl = "ws://localhost:${(config.port || 3333) + 1}",
}: LivePreviewProps) {
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<number>(Date.now())

  React.useEffect(() => {
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "update") {
        setLastUpdate(data.timestamp)
        setError(null)
        // Trigger React Fast Refresh
        if (import.meta.hot) {
          import.meta.hot.invalidate()
        }
      }

      if (data.type === "error") {
        setError(data.error)
      }
    }

    ws.onerror = () => {
      setError("WebSocket connection failed")
    }

    return () => ws.close()
  }, [wsUrl])

  return (
    <div className="live-preview">
      {${config.errorOverlay !== false} && error && (
        <div className="live-preview-error">
          <pre>{error}</pre>
        </div>
      )}
      <div key={lastUpdate} className="live-preview-content">
        {children}
      </div>
    </div>
  )
}
`.trim()

  // WebSocket handler
  const websocket = `
export interface PreviewMessage {
  type: "update" | "error" | "reload" | "ping"
  filePath?: string
  code?: string
  error?: string
  timestamp: number
}

export function createPreviewWebSocket(url: string) {
  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  const maxReconnects = 5

  const handlers = new Set<(msg: PreviewMessage) => void>()

  function connect() {
    ws = new WebSocket(url)

    ws.onopen = () => {
      console.log("[Preview] Connected")
      reconnectAttempts = 0
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as PreviewMessage
      handlers.forEach(h => h(msg))
    }

    ws.onclose = () => {
      console.log("[Preview] Disconnected")
      if (reconnectAttempts < maxReconnects) {
        reconnectAttempts++
        setTimeout(connect, 1000 * reconnectAttempts)
      }
    }
  }

  connect()

  return {
    onMessage: (handler: (msg: PreviewMessage) => void) => {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    close: () => ws?.close(),
  }
}
`.trim()

  // Configuration file
  const configFile = `
import type { LivePreviewConfig } from "./types"

export const previewConfig: LivePreviewConfig = ${JSON.stringify(config, null, 2)}
`.trim()

  return {
    server,
    client,
    websocket,
    config: configFile,
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create DX system
 */
export function createDxSystem(config?: DxSystemConfig) {
  return {
    /**
     * Generate Storybook story
     */
    generateStory: (storyConfig: StoryConfig) =>
      generateStory(storyConfig, config?.storybook),

    /**
     * Generate stories from component code
     */
    generateStoriesFromCode: (code: string) =>
      generateStoriesFromCode(code, config?.storybook),

    /**
     * Generate visual regression test
     */
    generateVisualTest: (snapshotConfig: SnapshotConfig) =>
      generateVisualTest(
        snapshotConfig,
        config?.visualTests?.framework || "playwright"
      ),

    /**
     * Generate visual tests from component code
     */
    generateVisualTestsFromCode: (code: string) =>
      generateVisualTestsFromCode(code, {
        framework: config?.visualTests?.framework || "playwright",
      }),

    /**
     * Generate responsive preview
     */
    generateResponsivePreview: (
      componentCode: string,
      previewConfig?: ResponsivePreviewConfig
    ) => generateResponsivePreview(componentCode, previewConfig),

    /**
     * Generate live preview setup
     */
    generateLivePreview: (previewConfig?: LivePreviewConfig) =>
      generateLivePreview(previewConfig),

    /**
     * Get default breakpoints
     */
    breakpoints: DEFAULT_BREAKPOINTS,

    /**
     * Get default viewports
     */
    viewports: DEFAULT_VIEWPORTS,
  }
}
