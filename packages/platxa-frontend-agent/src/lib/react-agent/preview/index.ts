/**
 * Odoo Instance Preview Module
 *
 * Preview themes on real Odoo instances via XML-RPC.
 *
 * @example
 * ```typescript
 * import { createOdooPreview, createPreviewUrlMapper } from "@/lib/react-agent/preview"
 *
 * // Create preview handler
 * const preview = createOdooPreview({
 *   connection: {
 *     url: "https://odoo.example.com",
 *     database: "mydb",
 *     username: "admin",
 *     password: "api_key",
 *   },
 *   themeConfig: myTheme,
 * })
 *
 * // Deploy theme preview
 * const result = await preview.deploy(xmlrpc, upload)
 * if (result.success) {
 *   console.log("Preview URL:", result.previewUrl)
 * }
 *
 * // Render a page
 * const page = await preview.renderPage("/shop", fetcher)
 *
 * // Clean up when done
 * await preview.cleanup(xmlrpc)
 * ```
 *
 * @module react-agent/preview
 */

export {
  createOdooPreview,
  createPreviewUrlMapper,
  type OdooConnection,
  type PreviewMode,
  type PreviewStepStatus,
  type PreviewStep,
  type PreviewDeployment,
  type PageRenderResult,
  type RenderError,
  type OdooPreviewConfig,
  type XmlRpcCall,
  type FileUploader,
  type PageFetcher,
  type OdooInstancePreview,
  type PreviewStatus,
  type PreviewUrlConfig,
} from "./odoo-instance-preview"
