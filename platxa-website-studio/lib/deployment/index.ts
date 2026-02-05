/**
 * Deployment Module
 *
 * Services for deploying websites to Odoo server instances.
 *
 * Feature #80: OneClickDeploy Service
 */

export {
  OneClickDeploy,
  getDeployService,
  createDeployService,
  type OdooServerConfig,
  type DeploymentStatus,
  type DeploymentProgress,
  type DeploymentResult,
  type ModulePackage,
  type DeployOptions,
  type ConnectionTestResult,
} from "./one-click-deploy";

export {
  PreviewURLGenerator,
  getPreviewGenerator,
  createPreviewGenerator,
  type PreviewAccessLevel,
  type PreviewStatus,
  type PreviewConfig,
  type PreviewURL,
  type PreviewAccessLog,
  type PreviewAnalytics,
  type ValidatePreviewResult,
} from "./preview-url-generator";

export {
  OdooModuleExporter,
  getModuleExporter,
  createModuleExporter,
  toTechnicalName,
  escapeXml,
  type OdooModuleVersion,
  type ModuleCategory,
  type OdooModuleExportConfig,
  type ModuleFile,
  type PageTemplate,
  type AssetFile,
  type OdooModuleExportResult,
} from "./odoo-module-exporter";
