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
