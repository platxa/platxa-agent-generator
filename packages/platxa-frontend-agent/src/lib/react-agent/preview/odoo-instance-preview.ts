/**
 * Odoo Instance Preview
 *
 * Preview themes on real Odoo instances via XML-RPC.
 * Deploys theme as temporary module, renders pages, and provides preview URLs.
 *
 * @example
 * ```typescript
 * import { createOdooPreview } from "@/lib/react-agent/preview"
 *
 * const preview = createOdooPreview({
 *   connection: { url: "https://odoo.example.com", database: "db", username: "admin", password: "key" },
 *   themeConfig: myTheme,
 * })
 *
 * // Deploy and get preview URL
 * const result = await preview.deploy()
 * console.log(result.previewUrl) // https://odoo.example.com/?theme_preview=theme_myapp
 *
 * // Render a specific page
 * const rendered = await preview.renderPage("/contactus")
 *
 * // Cleanup
 * await preview.cleanup()
 * ```
 *
 * @module react-agent/preview
 */

import type { ThemeConfig, GeneratedTheme } from "../theme/types"

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * Escapes a string for use in Python string literals
 */
function escapePythonString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
}

/**
 * Escapes a string for use in XML content
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Validates and sanitizes a CSS color value
 * Only allows safe color formats: hex, rgb, hsl, oklch, and named colors
 */
function validateCssColor(value: unknown): string {
  if (typeof value !== "string") {
    return "transparent"
  }

  const trimmed = value.trim()

  // Hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed
  }

  // RGB/RGBA
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed
  }

  // HSL/HSLA
  if (/^hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed
  }

  // OKLCH
  if (/^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+\s*(\/\s*[\d.]+%?)?\s*\)$/.test(trimmed)) {
    return trimmed
  }

  // Named colors (basic safe list)
  const namedColors = [
    "transparent", "currentColor", "inherit",
    "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
    "gray", "grey", "pink", "brown", "cyan", "magenta", "lime", "olive",
    "navy", "teal", "aqua", "silver", "maroon", "fuchsia",
  ]
  if (namedColors.includes(trimmed.toLowerCase())) {
    return trimmed
  }

  // If not a valid color format, return a safe default
  return "transparent"
}

/**
 * Validates a theme name for safe use in module generation
 */
function validateThemeName(name: string): { valid: boolean; sanitized: string; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, sanitized: "untitled", error: "Theme name is required" }
  }

  // Limit length
  if (name.length > 100) {
    return { valid: false, sanitized: name.slice(0, 100), error: "Theme name too long" }
  }

  // Check for obviously malicious content
  const dangerousPatterns = [
    /__import__/,
    /\beval\b/,
    /\bexec\b/,
    /\bos\./,
    /\bsys\./,
    /subprocess/,
    /<script/i,
    /javascript:/i,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return { valid: false, sanitized: "theme", error: "Theme name contains dangerous content" }
    }
  }

  return { valid: true, sanitized: name }
}

/**
 * Validates a URL is HTTPS (unless localhost)
 */
function validateSecureUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"

    if (!isLocalhost && parsed.protocol !== "https:") {
      return { valid: false, error: "Connection must use HTTPS for security" }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}

// =============================================================================
// Types
// =============================================================================

/** Odoo instance connection config */
export interface OdooConnection {
  /** Odoo instance URL (e.g. "https://myodoo.com") */
  url: string
  /** Database name */
  database: string
  /** Login username */
  username: string
  /** Login password or API key */
  password: string
  /** Connection timeout in ms (default 30000) */
  timeoutMs?: number
}

/** Preview deployment mode */
export type PreviewMode = "sandbox" | "temporary" | "persistent"

/** Preview step status */
export type PreviewStepStatus = "pending" | "running" | "success" | "failed" | "skipped"

/** A single preview step */
export interface PreviewStep {
  /** Step identifier */
  id: string
  /** Human-readable label */
  label: string
  /** Current status */
  status: PreviewStepStatus
  /** Duration in ms (0 if not started) */
  durationMs: number
  /** Error message if failed */
  error?: string
  /** Step output/details */
  detail?: string
}

/** Preview deployment result */
export interface PreviewDeployment {
  /** Whether the deployment succeeded */
  success: boolean
  /** Module that was deployed */
  moduleName: string
  /** Target Odoo URL */
  targetUrl: string
  /** Preview URL with query params */
  previewUrl: string
  /** All deployment steps */
  steps: PreviewStep[]
  /** Total duration in ms */
  totalDurationMs: number
  /** Summary message */
  summary: string
  /** Expiration timestamp (if temporary) */
  expiresAt?: number
  /** Preview session ID */
  sessionId: string
}

/** Page render result */
export interface PageRenderResult {
  /** HTTP status code */
  status: number
  /** Rendered HTML content */
  html: string
  /** Page title */
  title: string
  /** CSS content (extracted) */
  css: string
  /** Render errors */
  errors: RenderError[]
  /** Page URL */
  url: string
  /** Render duration in ms */
  durationMs: number
  /** Whether theme elements were detected */
  themeDetected: boolean
}

/** Render error */
export interface RenderError {
  /** Error type */
  type: "template" | "python" | "http" | "theme"
  /** Human-readable message */
  message: string
  /** Error trace (if available) */
  trace?: string
}

/** Preview configuration */
export interface OdooPreviewConfig {
  /** Odoo connection config */
  connection: OdooConnection
  /** Theme configuration to preview */
  themeConfig: ThemeConfig
  /** Generated theme output */
  generatedTheme?: GeneratedTheme
  /** Preview mode */
  mode?: PreviewMode
  /** Preview expiration in seconds (default 3600 = 1 hour) */
  expiresInSeconds?: number
  /** Module name prefix (default "theme_preview_") */
  modulePrefix?: string
  /** Pages to verify after deployment */
  verifyPages?: string[]
  /** Called when a step updates */
  onStepUpdate?: (step: PreviewStep) => void
}

/** XML-RPC call function signature */
export type XmlRpcCall = (
  url: string,
  service: string,
  method: string,
  args: unknown[],
) => Promise<unknown>

/** File upload function */
export type FileUploader = (
  url: string,
  moduleName: string,
  archiveBase64: string,
  headers: Record<string, string>,
) => Promise<{ success: boolean; error?: string }>

/** HTTP fetch function for page rendering */
export type PageFetcher = (
  url: string,
  options?: { headers?: Record<string, string>; timeout?: number },
) => Promise<{ status: number; text: string; headers: Record<string, string> }>

/** Odoo preview instance */
export interface OdooInstancePreview {
  /** Connection configuration */
  readonly connection: OdooConnection

  /** Deploy theme for preview */
  deploy(
    xmlrpc: XmlRpcCall,
    upload: FileUploader,
  ): Promise<PreviewDeployment>

  /** Get all available preview URLs */
  getPreviewUrls(): string[]

  /** Render a specific page */
  renderPage(
    path: string,
    fetcher: PageFetcher,
    options?: { context?: Record<string, unknown>; timeout?: number },
  ): Promise<PageRenderResult>

  /** Check if preview is still active */
  isActive(): boolean

  /** Extend preview expiration */
  extendExpiration(seconds: number): void

  /** Get preview status */
  getStatus(): PreviewStatus

  /** Cleanup preview (uninstall temporary module) */
  cleanup(xmlrpc: XmlRpcCall): Promise<{ success: boolean; error?: string }>
}

/** Preview status */
export interface PreviewStatus {
  /** Whether preview is deployed */
  deployed: boolean
  /** Whether preview is active (not expired) */
  active: boolean
  /** Module name */
  moduleName: string
  /** Session ID */
  sessionId: string
  /** Deployment timestamp */
  deployedAt?: number
  /** Expiration timestamp */
  expiresAt?: number
  /** Pages rendered */
  pagesRendered: number
  /** Last render timestamp */
  lastRenderAt?: number
}

// =============================================================================
// Constants
// =============================================================================

const STEP_IDS = {
  authenticate: "authenticate",
  generateModule: "generate_module",
  upload: "upload",
  updateModuleList: "update_module_list",
  install: "install",
  verify: "verify",
} as const

const DEFAULT_VERIFY_PAGES = ["/", "/contactus", "/shop"]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `preview_${timestamp}_${random}`
}

/**
 * Generates a module name from theme config
 */
function generateModuleName(prefix: string, themeName: string): string {
  const sanitized = themeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `${prefix}${sanitized}`
}

/**
 * Creates deployment steps
 */
function createSteps(): PreviewStep[] {
  return [
    { id: STEP_IDS.authenticate, label: "Authenticate with Odoo", status: "pending", durationMs: 0 },
    { id: STEP_IDS.generateModule, label: "Generate theme module", status: "pending", durationMs: 0 },
    { id: STEP_IDS.upload, label: "Upload module archive", status: "pending", durationMs: 0 },
    { id: STEP_IDS.updateModuleList, label: "Update module list", status: "pending", durationMs: 0 },
    { id: STEP_IDS.install, label: "Install preview module", status: "pending", durationMs: 0 },
    { id: STEP_IDS.verify, label: "Verify installation", status: "pending", durationMs: 0 },
  ]
}

/**
 * Authenticates with Odoo via XML-RPC
 */
async function authenticate(
  connection: OdooConnection,
  xmlrpc: XmlRpcCall,
): Promise<number> {
  const uid = await xmlrpc(
    `${connection.url}/xmlrpc/2/common`,
    "common",
    "authenticate",
    [connection.database, connection.username, connection.password, {}],
  )

  if (typeof uid !== "number" || uid <= 0) {
    throw new Error("Authentication failed: invalid credentials or database")
  }

  return uid
}

/**
 * Calls an Odoo model method via XML-RPC
 */
async function callOdoo(
  connection: OdooConnection,
  uid: number,
  xmlrpc: XmlRpcCall,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  return xmlrpc(
    `${connection.url}/xmlrpc/2/object`,
    "object",
    "execute_kw",
    [connection.database, uid, connection.password, model, method, args, kwargs],
  )
}

/**
 * Generates Odoo theme module structure
 */
function generateThemeModule(
  moduleName: string,
  themeConfig: ThemeConfig,
  generatedTheme?: GeneratedTheme,
): { manifest: string; scss: string; xml: string } {
  // Validate and escape theme name for safe use
  const nameValidation = validateThemeName(themeConfig.name)
  const safeName = escapePythonString(nameValidation.sanitized)
  const safeXmlName = escapeXml(nameValidation.sanitized)

  const manifest = `# -*- coding: utf-8 -*-
{
    'name': '${safeName} (Preview)',
    'description': 'Preview theme generated by Platxa',
    'category': 'Theme/Creative',
    'version': '1.0.0',
    'author': 'Platxa',
    'depends': ['website'],
    'data': [
        'views/assets.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            '${moduleName}/static/src/scss/theme.scss',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
`

  // Validate all color values to prevent CSS injection
  const colors = themeConfig.light.colors
  const safeColors = {
    primary: validateCssColor(colors.primary) || "hsl(220, 80%, 50%)",
    secondary: validateCssColor(colors.secondary) || "hsl(220, 20%, 90%)",
    accent: validateCssColor(colors.accent) || "hsl(220, 80%, 60%)",
    muted: validateCssColor(colors.muted) || "hsl(220, 10%, 95%)",
    destructive: validateCssColor(colors.destructive) || "hsl(0, 70%, 50%)",
    background: validateCssColor(colors.background) || "#ffffff",
    foreground: validateCssColor(colors.foreground) || "#1a1a1a",
    border: validateCssColor(colors.border) || "#e5e5e5",
  }

  // Only include generated CSS if it passes basic validation (no imports, no urls to external)
  let safeCss = ""
  if (generatedTheme?.css) {
    const dangerousCssPatterns = [
      /@import\s+url/i,
      /url\s*\(\s*['"]?https?:/i,
      /expression\s*\(/i,
      /javascript:/i,
    ]
    const cssIsSafe = !dangerousCssPatterns.some(p => p.test(generatedTheme.css))
    if (cssIsSafe) {
      safeCss = generatedTheme.css
    }
  }

  const scss = `// Theme: ${safeXmlName}
// Generated by Platxa Preview

// Primary colors
$o-color-1: ${safeColors.primary};
$o-color-2: ${safeColors.secondary};
$o-color-3: ${safeColors.accent};
$o-color-4: ${safeColors.muted};
$o-color-5: ${safeColors.destructive};

// Background/foreground
$o-cc1-bg: ${safeColors.background};
$o-cc1-text: ${safeColors.foreground};

// Border and input
$o-cc1-border: ${safeColors.border};

// Apply theme variables
:root {
  --o-color-1: #{$o-color-1};
  --o-color-2: #{$o-color-2};
  --o-color-3: #{$o-color-3};
  --o-color-4: #{$o-color-4};
  --o-color-5: #{$o-color-5};
}

// Additional generated CSS
${safeCss}
`

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="assets_frontend" inherit_id="website.assets_frontend" name="${safeXmlName} Assets">
        <xpath expr="." position="inside">
            <link rel="stylesheet" href="/${moduleName}/static/src/scss/theme.scss"/>
        </xpath>
    </template>
</odoo>
`

  return { manifest, scss, xml }
}

/**
 * Creates base64-encoded ZIP archive of module
 */
function createModuleArchive(
  moduleName: string,
  files: { manifest: string; scss: string; xml: string },
): string {
  // Simple ZIP structure (uncompressed for simplicity)
  // In production, use a proper ZIP library
  const encoder = new TextEncoder()

  const fileContents: Array<{ path: string; content: Uint8Array }> = [
    { path: `${moduleName}/__manifest__.py`, content: encoder.encode(files.manifest) },
    { path: `${moduleName}/static/src/scss/theme.scss`, content: encoder.encode(files.scss) },
    { path: `${moduleName}/views/assets.xml`, content: encoder.encode(files.xml) },
    { path: `${moduleName}/__init__.py`, content: encoder.encode("# -*- coding: utf-8 -*-\n") },
  ]

  // Create minimal ZIP structure
  const zip = createMinimalZip(fileContents)
  return btoa(String.fromCharCode.apply(null, Array.from(zip)))
}

/**
 * Creates a minimal ZIP file structure
 * Note: This is a simplified implementation for preview purposes
 */
function createMinimalZip(
  files: Array<{ path: string; content: Uint8Array }>,
): Uint8Array {
  const parts: Uint8Array[] = []
  const centralDir: Uint8Array[] = []
  let offset = 0
  const encoder = new TextEncoder()

  for (const file of files) {
    const pathBytes = encoder.encode(file.path)

    // Local file header
    const localHeader = new Uint8Array(30 + pathBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)  // Local file header signature
    localView.setUint16(4, 20, true)          // Version needed
    localView.setUint16(6, 0, true)           // General purpose flag
    localView.setUint16(8, 0, true)           // Compression method (store)
    localView.setUint16(10, 0, true)          // File time
    localView.setUint16(12, 0, true)          // File date
    localView.setUint32(14, 0, true)          // CRC-32 (0 for simplicity)
    localView.setUint32(18, file.content.length, true)  // Compressed size
    localView.setUint32(22, file.content.length, true)  // Uncompressed size
    localView.setUint16(26, pathBytes.length, true)     // File name length
    localView.setUint16(28, 0, true)          // Extra field length
    localHeader.set(pathBytes, 30)

    // Central directory entry
    const centralEntry = new Uint8Array(46 + pathBytes.length)
    const centralView = new DataView(centralEntry.buffer)
    centralView.setUint32(0, 0x02014b50, true)  // Central directory signature
    centralView.setUint16(4, 20, true)          // Version made by
    centralView.setUint16(6, 20, true)          // Version needed
    centralView.setUint16(8, 0, true)           // General purpose flag
    centralView.setUint16(10, 0, true)          // Compression method
    centralView.setUint16(12, 0, true)          // File time
    centralView.setUint16(14, 0, true)          // File date
    centralView.setUint32(16, 0, true)          // CRC-32
    centralView.setUint32(20, file.content.length, true)  // Compressed size
    centralView.setUint32(24, file.content.length, true)  // Uncompressed size
    centralView.setUint16(28, pathBytes.length, true)     // File name length
    centralView.setUint16(30, 0, true)          // Extra field length
    centralView.setUint16(32, 0, true)          // File comment length
    centralView.setUint16(34, 0, true)          // Disk number start
    centralView.setUint16(36, 0, true)          // Internal file attributes
    centralView.setUint32(38, 0, true)          // External file attributes
    centralView.setUint32(42, offset, true)    // Relative offset of local header
    centralEntry.set(pathBytes, 46)

    parts.push(localHeader, file.content)
    centralDir.push(centralEntry)
    offset += localHeader.length + file.content.length
  }

  // End of central directory
  const centralDirSize = centralDir.reduce((sum, entry) => sum + entry.length, 0)
  const endOfCentralDir = new Uint8Array(22)
  const endView = new DataView(endOfCentralDir.buffer)
  endView.setUint32(0, 0x06054b50, true)      // End of central directory signature
  endView.setUint16(4, 0, true)               // Number of this disk
  endView.setUint16(6, 0, true)               // Disk where central directory starts
  endView.setUint16(8, files.length, true)    // Number of central directory records on this disk
  endView.setUint16(10, files.length, true)   // Total number of central directory records
  endView.setUint32(12, centralDirSize, true) // Size of central directory
  endView.setUint32(16, offset, true)         // Offset of start of central directory
  endView.setUint16(20, 0, true)              // Comment length

  // Combine all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0) + centralDirSize + 22
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const part of parts) {
    result.set(part, pos)
    pos += part.length
  }
  for (const entry of centralDir) {
    result.set(entry, pos)
    pos += entry.length
  }
  result.set(endOfCentralDir, pos)

  return result
}

/**
 * Parses rendered page for theme detection
 */
function detectThemeElements(html: string): boolean {
  // Check for Odoo theme CSS classes
  const themeIndicators = [
    /class="[^"]*o_[^"]*"/,           // Odoo classes
    /class="[^"]*s_[^"]*"/,           // Snippet classes
    /--o-color-/,                      // Theme CSS variables
    /<link[^>]+theme/i,                // Theme stylesheets
  ]

  return themeIndicators.some(pattern => pattern.test(html))
}

/**
 * Extracts page title from HTML
 */
function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i)
  return match ? match[1].trim() : "Untitled"
}

/**
 * Detects render errors in HTML
 */
function detectRenderErrors(html: string, status: number): RenderError[] {
  const errors: RenderError[] = []

  if (status >= 400) {
    errors.push({
      type: "http",
      message: `HTTP ${status} error`,
    })
  }

  if (/Internal Server Error/i.test(html)) {
    errors.push({
      type: "python",
      message: "Internal Server Error detected",
    })
  }

  if (/Traceback \(most recent call last\)/i.test(html)) {
    const traceMatch = html.match(/Traceback[\s\S]*?(?=<\/pre>|$)/)
    errors.push({
      type: "python",
      message: "Python traceback detected",
      trace: traceMatch?.[0],
    })
  }

  if (/QWebException|odoo\.exceptions/i.test(html)) {
    errors.push({
      type: "template",
      message: "QWeb template error detected",
    })
  }

  return errors
}

// =============================================================================
// Main Implementation
// =============================================================================

/**
 * Creates an Odoo instance preview handler
 */
export function createOdooPreview(config: OdooPreviewConfig): OdooInstancePreview {
  const {
    connection,
    themeConfig,
    generatedTheme,
    mode = "temporary",
    expiresInSeconds = 3600,
    modulePrefix = "theme_preview_",
    verifyPages = DEFAULT_VERIFY_PAGES,
    onStepUpdate,
  } = config

  const sessionId = generateSessionId()
  const moduleName = generateModuleName(modulePrefix, themeConfig.name)

  let deployed = false
  let deployedAt: number | undefined
  let expiresAt: number | undefined
  let pagesRendered = 0
  let lastRenderAt: number | undefined
  let uid = 0

  const updateStep = (steps: PreviewStep[], id: string, updates: Partial<PreviewStep>) => {
    const step = steps.find(s => s.id === id)
    if (step) {
      Object.assign(step, updates)
      onStepUpdate?.(step)
    }
  }

  const runStep = async (
    steps: PreviewStep[],
    id: string,
    fn: () => Promise<string | void>,
    aborted: { value: boolean },
  ) => {
    if (aborted.value) {
      updateStep(steps, id, { status: "skipped" })
      return
    }
    updateStep(steps, id, { status: "running" })
    const start = performance.now()
    try {
      const detail = await fn()
      updateStep(steps, id, {
        status: "success",
        durationMs: Math.round(performance.now() - start),
        detail: detail || undefined,
      })
    } catch (err) {
      updateStep(steps, id, {
        status: "failed",
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      })
      aborted.value = true
    }
  }

  return {
    get connection() {
      return connection
    },

    async deploy(xmlrpc, upload): Promise<PreviewDeployment> {
      const steps = createSteps()
      const totalStart = performance.now()
      const aborted = { value: false }

      // Validate secure connection before proceeding
      const urlValidation = validateSecureUrl(connection.url)
      if (!urlValidation.valid) {
        return {
          success: false,
          moduleName,
          targetUrl: connection.url,
          previewUrl: connection.url,
          steps: steps.map(s => ({ ...s, status: "skipped" as const })),
          totalDurationMs: 0,
          summary: `Security error: ${urlValidation.error}`,
          sessionId,
        }
      }

      // Step 1: Authenticate
      await runStep(steps, STEP_IDS.authenticate, async () => {
        uid = await authenticate(connection, xmlrpc)
        return `Authenticated as UID ${uid}`
      }, aborted)

      // Step 2: Generate module
      let moduleArchive = ""
      await runStep(steps, STEP_IDS.generateModule, async () => {
        const files = generateThemeModule(moduleName, themeConfig, generatedTheme)
        moduleArchive = createModuleArchive(moduleName, files)
        return `Generated ${moduleName} module`
      }, aborted)

      // Step 3: Upload
      await runStep(steps, STEP_IDS.upload, async () => {
        const sessionHeader = { "X-Odoo-Database": connection.database }
        const result = await upload(
          `${connection.url}/web/binary/upload_module`,
          moduleName,
          moduleArchive,
          sessionHeader,
        )
        if (!result.success) throw new Error(result.error || "Upload failed")
        return "Module archive uploaded"
      }, aborted)

      // Step 4: Update module list
      await runStep(steps, STEP_IDS.updateModuleList, async () => {
        await callOdoo(connection, uid, xmlrpc, "ir.module.module", "update_list", [])
        return "Module list updated"
      }, aborted)

      // Step 5: Install
      await runStep(steps, STEP_IDS.install, async () => {
        const moduleIds = await callOdoo(
          connection, uid, xmlrpc,
          "ir.module.module", "search",
          [[["name", "=", moduleName]]],
        ) as number[]

        if (!moduleIds || moduleIds.length === 0) {
          throw new Error(`Module "${moduleName}" not found after upload`)
        }

        await callOdoo(
          connection, uid, xmlrpc,
          "ir.module.module", "button_immediate_install",
          [moduleIds],
        )

        return `Module ${moduleName} installed (ID: ${moduleIds[0]})`
      }, aborted)

      // Step 6: Verify
      await runStep(steps, STEP_IDS.verify, async () => {
        const moduleIds = await callOdoo(
          connection, uid, xmlrpc,
          "ir.module.module", "search",
          [[["name", "=", moduleName], ["state", "=", "installed"]]],
        ) as number[]

        if (!moduleIds || moduleIds.length === 0) {
          throw new Error("Module not found in installed state")
        }

        return `Verified: ${moduleName} is installed`
      }, aborted)

      const totalDurationMs = Math.round(performance.now() - totalStart)
      const success = !aborted.value
      const failedStep = steps.find(s => s.status === "failed")

      if (success) {
        deployed = true
        deployedAt = Date.now()
        expiresAt = mode === "temporary" ? deployedAt + expiresInSeconds * 1000 : undefined
      }

      const previewUrl = success
        ? `${connection.url}/?theme_preview=${encodeURIComponent(moduleName)}`
        : connection.url

      return {
        success,
        moduleName,
        targetUrl: connection.url,
        previewUrl,
        steps,
        totalDurationMs,
        summary: success
          ? `Successfully deployed ${moduleName} preview to ${connection.url}`
          : `Preview deploy failed at "${failedStep?.label}": ${failedStep?.error}`,
        expiresAt,
        sessionId,
      }
    },

    getPreviewUrls(): string[] {
      if (!deployed) return []
      const encodedModule = encodeURIComponent(moduleName)
      return verifyPages.map(page => {
        const separator = page.includes("?") ? "&" : "?"
        return `${connection.url}${page}${separator}theme_preview=${encodedModule}`
      })
    },

    async renderPage(path, fetcher, options = {}): Promise<PageRenderResult> {
      const { timeout = 30000 } = options
      const start = performance.now()

      const encodedModule = encodeURIComponent(moduleName)
      const separator = path.includes("?") ? "&" : "?"
      const url = `${connection.url}${path}${separator}theme_preview=${encodedModule}`

      try {
        const response = await fetcher(url, {
          headers: {
            "Accept": "text/html",
            "User-Agent": "Platxa-Preview/1.0",
          },
          timeout,
        })

        pagesRendered++
        lastRenderAt = Date.now()

        const errors = detectRenderErrors(response.text, response.status)
        const themeDetected = detectThemeElements(response.text)

        if (!themeDetected) {
          errors.push({
            type: "theme",
            message: "Theme elements not detected in rendered page",
          })
        }

        return {
          status: response.status,
          html: response.text,
          title: extractTitle(response.text),
          css: "", // CSS is embedded via Odoo assets
          errors,
          url,
          durationMs: Math.round(performance.now() - start),
          themeDetected,
        }
      } catch (err) {
        return {
          status: 0,
          html: "",
          title: "",
          css: "",
          errors: [{
            type: "http",
            message: err instanceof Error ? err.message : String(err),
          }],
          url,
          durationMs: Math.round(performance.now() - start),
          themeDetected: false,
        }
      }
    },

    isActive(): boolean {
      if (!deployed) return false
      if (expiresAt && Date.now() > expiresAt) return false
      return true
    },

    extendExpiration(seconds: number): void {
      if (deployed && expiresAt) {
        expiresAt = Date.now() + seconds * 1000
      }
    },

    getStatus(): PreviewStatus {
      return {
        deployed,
        active: this.isActive(),
        moduleName,
        sessionId,
        deployedAt,
        expiresAt,
        pagesRendered,
        lastRenderAt,
      }
    },

    async cleanup(xmlrpc): Promise<{ success: boolean; error?: string }> {
      if (!deployed) {
        return { success: true }
      }

      try {
        // Re-authenticate if needed
        if (!uid) {
          uid = await authenticate(connection, xmlrpc)
        }

        // Find and uninstall the module
        const moduleIds = await callOdoo(
          connection, uid, xmlrpc,
          "ir.module.module", "search",
          [[["name", "=", moduleName]]],
        ) as number[]

        if (moduleIds && moduleIds.length > 0) {
          await callOdoo(
            connection, uid, xmlrpc,
            "ir.module.module", "button_immediate_uninstall",
            [moduleIds],
          )
        }

        deployed = false
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

// =============================================================================
// URL Mapper
// =============================================================================

/** Preview URL mapping configuration */
export interface PreviewUrlConfig {
  /** Base Odoo URL */
  baseUrl: string
  /** Module name */
  moduleName: string
  /** Custom URL mappings */
  mappings?: Record<string, string>
}

/**
 * Creates a URL mapper for theme preview
 */
export function createPreviewUrlMapper(config: PreviewUrlConfig) {
  const { baseUrl, moduleName, mappings = {} } = config
  const encodedModule = encodeURIComponent(moduleName)

  const defaultMappings: Record<string, string> = {
    home: "/",
    contact: "/contactus",
    shop: "/shop",
    blog: "/blog",
    about: "/about-us",
    ...mappings,
  }

  return {
    /**
     * Maps a page key to a preview URL
     */
    getUrl(pageKey: string): string {
      const path = defaultMappings[pageKey] || pageKey
      const separator = path.includes("?") ? "&" : "?"
      return `${baseUrl}${path}${separator}theme_preview=${encodedModule}`
    },

    /**
     * Gets all available preview URLs
     */
    getAllUrls(): Record<string, string> {
      const result: Record<string, string> = {}
      for (const [key, path] of Object.entries(defaultMappings)) {
        result[key] = this.getUrl(key)
      }
      return result
    },

    /**
     * Adds a custom mapping
     */
    addMapping(key: string, path: string): void {
      defaultMappings[key] = path
    },

    /**
     * Checks if a URL is a preview URL
     */
    isPreviewUrl(url: string): boolean {
      return url.includes(`theme_preview=${moduleName}`)
    },

    /**
     * Strips preview parameters from URL
     */
    stripPreviewParams(url: string): string {
      return url.replace(new RegExp(`[?&]theme_preview=${moduleName}`, "g"), "")
    },
  }
}
