/**
 * OneClickDeploy Service
 *
 * Deploys website themes and customizations to Odoo server instances.
 * Handles module packaging, upload, installation, and verification.
 *
 * Features:
 * - One-click deployment to Odoo instances
 * - Module packaging with proper structure (JSZip)
 * - Secure authentication with Odoo API
 * - Progress tracking and status updates
 * - Rollback support on failure
 * - Multi-version Odoo support (14-17)
 *
 * Feature #80: Deployment - OneClickDeploy Service
 * Phase 2: Production-grade ZIP creation with JSZip
 */

import JSZip from "jszip";

// =============================================================================
// Types
// =============================================================================

/** Odoo server configuration */
export interface OdooServerConfig {
  id: string;
  name: string;
  url: string;
  database: string;
  version: "14.0" | "15.0" | "16.0" | "17.0";
  apiKey?: string;
  username?: string;
  getPassword?: () => string | undefined;
}

/** Deployment status */
export type DeploymentStatus =
  | "pending"
  | "packaging"
  | "uploading"
  | "installing"
  | "activating"
  | "verifying"
  | "success"
  | "failed"
  | "rolled_back";

/** Deployment progress event */
export interface DeploymentProgress {
  status: DeploymentStatus;
  progress: number; // 0-100
  message: string;
  details?: string;
  timestamp: Date;
}

/** Deployment result */
export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  status: DeploymentStatus;
  serverUrl?: string;
  websiteUrl?: string;
  moduleId?: string;
  moduleName?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  logs: DeploymentProgress[];
}

/** Module package data */
export interface ModulePackage {
  name: string;
  technicalName: string;
  version: string;
  description: string;
  files: Map<string, string | Uint8Array>;
  manifest: Record<string, unknown>;
}

/** Deployment options */
export interface DeployOptions {
  modulePackage: ModulePackage;
  server: OdooServerConfig;
  activateWebsite?: boolean;
  backupExisting?: boolean;
  onProgress?: (progress: DeploymentProgress) => void;
}

/** Server connection test result */
export interface ConnectionTestResult {
  success: boolean;
  serverVersion?: string;
  databaseExists?: boolean;
  hasPermissions?: boolean;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEPLOY_TIMEOUT_MS = 300000; // 5 minutes
const POLL_INTERVAL_MS = 2000;

const STATUS_PROGRESS: Record<DeploymentStatus, number> = {
  pending: 0,
  packaging: 10,
  uploading: 30,
  installing: 50,
  activating: 70,
  verifying: 90,
  success: 100,
  failed: 0,
  rolled_back: 0,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate deployment ID
 */
function generateDeploymentId(): string {
  return `deploy_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Build Odoo XML-RPC endpoint URL
 */
function buildEndpoint(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Create module manifest content
 */
function createManifestContent(manifest: Record<string, unknown>): string {
  const entries = Object.entries(manifest).map(([key, value]) => {
    const valueStr = JSON.stringify(value, null, 4)
      .replace(/"/g, "'")
      .replace(/\n/g, "\n    ");
    return `    '${key}': ${valueStr}`;
  });

  return `# -*- coding: utf-8 -*-\n{\n${entries.join(",\n")}\n}\n`;
}

/**
 * Validate server URL
 */
function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// =============================================================================
// OneClickDeploy Class
// =============================================================================

/**
 * Service for deploying to Odoo server instances
 */
export class OneClickDeploy {
  private activeDeployments: Map<string, DeploymentResult> = new Map();

  /**
   * Test connection to Odoo server
   */
  async testConnection(server: OdooServerConfig): Promise<ConnectionTestResult> {
    if (!validateServerUrl(server.url)) {
      return { success: false, error: "Invalid server URL" };
    }

    try {
      // Test version endpoint
      const versionUrl = buildEndpoint(server.url, "/web/webclient/version_info");
      const versionResponse = await fetch(versionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: {}, id: 1 }),
      });

      if (!versionResponse.ok) {
        return { success: false, error: `Server returned ${versionResponse.status}` };
      }

      const versionData = await versionResponse.json();
      const serverVersion = versionData?.result?.server_version;

      // Test authentication
      const authUrl = buildEndpoint(server.url, "/web/session/authenticate");
      const authResponse = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            db: server.database,
            login: server.username || "",
            password: server.getPassword?.() || server.apiKey || "",
          },
          id: 2,
        }),
      });

      if (!authResponse.ok) {
        return {
          success: false,
          serverVersion,
          error: "Authentication failed",
        };
      }

      const authData = await authResponse.json();
      const hasPermissions = authData?.result?.uid > 0;

      return {
        success: hasPermissions,
        serverVersion,
        databaseExists: true,
        hasPermissions,
        error: hasPermissions ? undefined : "Invalid credentials or insufficient permissions",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Deploy module to Odoo server
   */
  async deploy(options: DeployOptions): Promise<DeploymentResult> {
    const deploymentId = generateDeploymentId();
    const startedAt = new Date();
    const logs: DeploymentProgress[] = [];

    const result: DeploymentResult = {
      success: false,
      deploymentId,
      status: "pending",
      startedAt,
      logs,
    };

    this.activeDeployments.set(deploymentId, result);

    const updateProgress = (status: DeploymentStatus, message: string, details?: string) => {
      const progress: DeploymentProgress = {
        status,
        progress: STATUS_PROGRESS[status],
        message,
        details,
        timestamp: new Date(),
      };
      logs.push(progress);
      result.status = status;
      options.onProgress?.(progress);
    };

    try {
      // Step 1: Validate server connection
      updateProgress("pending", "Validating server connection...");

      const connectionTest = await this.testConnection(options.server);
      if (!connectionTest.success) {
        throw new Error(connectionTest.error || "Failed to connect to server");
      }

      // Step 2: Package module
      updateProgress("packaging", "Packaging module for deployment...");

      const packagedModule = await this.packageModule(options.modulePackage);

      // Step 3: Upload module
      updateProgress("uploading", "Uploading module to server...", `Size: ${formatBytes(packagedModule.size)}`);

      const uploadResult = await this.uploadModule(options.server, packagedModule, options.modulePackage.technicalName);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload module");
      }

      // Step 4: Install module
      updateProgress("installing", "Installing module...", options.modulePackage.name);

      const installResult = await this.installModule(
        options.server,
        options.modulePackage.technicalName
      );

      if (!installResult.success) {
        throw new Error(installResult.error || "Failed to install module");
      }

      result.moduleId = installResult.moduleId;
      result.moduleName = options.modulePackage.technicalName;

      // Step 5: Activate on website (optional)
      if (options.activateWebsite) {
        updateProgress("activating", "Activating theme on website...");

        await this.activateTheme(options.server, options.modulePackage.technicalName);
      }

      // Step 6: Verify deployment
      updateProgress("verifying", "Verifying deployment...");

      const verifyResult = await this.verifyDeployment(
        options.server,
        options.modulePackage.technicalName
      );

      if (!verifyResult.success) {
        throw new Error("Deployment verification failed");
      }

      // Success!
      updateProgress("success", "Deployment completed successfully!");

      result.success = true;
      result.serverUrl = options.server.url;
      result.websiteUrl = buildEndpoint(options.server.url, "/");
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startedAt.getTime();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      updateProgress("failed", "Deployment failed", errorMessage);

      result.success = false;
      result.error = errorMessage;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startedAt.getTime();

      // Attempt rollback if backup was made
      if (options.backupExisting) {
        try {
          updateProgress("rolled_back", "Rolling back changes...");
          await this.rollback(options.server, options.modulePackage.technicalName);
        } catch {
          // Rollback failed, log but don't throw
        }
      }

      return result;
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentResult | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  /**
   * Get all active deployments
   */
  getActiveDeployments(): DeploymentResult[] {
    return Array.from(this.activeDeployments.values()).filter(
      d => d.status !== "success" && d.status !== "failed" && d.status !== "rolled_back"
    );
  }

  /**
   * Cancel deployment (if possible)
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return false;

    // Can only cancel during certain stages
    if (deployment.status === "pending" || deployment.status === "packaging") {
      deployment.status = "failed";
      deployment.error = "Deployment cancelled by user";
      deployment.completedAt = new Date();
      return true;
    }

    return false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Package module files into uploadable format
   * Uses JSZip for proper ZIP file creation with compression
   */
  private async packageModule(pkg: ModulePackage): Promise<Blob> {
    const zip = new JSZip();
    const moduleFolder = zip.folder(pkg.technicalName);

    if (!moduleFolder) {
      throw new Error("Failed to create module folder in ZIP");
    }

    // Add manifest
    moduleFolder.file("__manifest__.py", createManifestContent(pkg.manifest));

    // Add __init__.py
    moduleFolder.file("__init__.py", "# -*- coding: utf-8 -*-\n");

    // Add all package files with proper directory structure
    for (const [path, content] of pkg.files) {
      // Handle nested directories
      const parts = path.split("/");
      if (parts.length > 1) {
        // Create subdirectories and add file
        let currentFolder = moduleFolder;
        for (let i = 0; i < parts.length - 1; i++) {
          const subFolder = currentFolder.folder(parts[i]);
          if (subFolder) {
            currentFolder = subFolder;
          }
        }
        currentFolder.file(parts[parts.length - 1], content);
      } else {
        moduleFolder.file(path, content);
      }
    }

    // Generate ZIP with DEFLATE compression for smaller file size
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      comment: `Platxa Website Studio - ${pkg.name} v${pkg.version}`,
    });

    return zipBlob;
  }

  /**
   * Upload module to Odoo server
   */
  private async uploadModule(
    server: OdooServerConfig,
    moduleBlob: Blob,
    moduleName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First authenticate
      const sessionId = await this.authenticate(server);
      if (!sessionId) {
        return { success: false, error: "Authentication failed" };
      }

      // Upload via /web/binary/upload_attachment or similar endpoint
      const formData = new FormData();
      formData.append("ufile", moduleBlob, `${moduleName}.zip`);
      formData.append("model", "ir.module.module");
      formData.append("id", "0");

      const uploadUrl = buildEndpoint(server.url, "/web/binary/upload_attachment");
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        headers: {
          Cookie: `session_id=${sessionId}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Upload failed: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Install module on Odoo server
   */
  private async installModule(
    server: OdooServerConfig,
    moduleName: string
  ): Promise<{ success: boolean; moduleId?: string; error?: string }> {
    try {
      const sessionId = await this.authenticate(server);
      if (!sessionId) {
        return { success: false, error: "Authentication failed" };
      }

      // Update module list
      await this.callOdooMethod(server, sessionId, "ir.module.module", "update_list", []);

      // Search for module
      const moduleIds = await this.callOdooMethod(
        server,
        sessionId,
        "ir.module.module",
        "search",
        [[["name", "=", moduleName]]]
      ) as number[];

      if (!moduleIds || moduleIds.length === 0) {
        return { success: false, error: "Module not found after upload" };
      }

      const moduleId = moduleIds[0];

      // Install module
      await this.callOdooMethod(
        server,
        sessionId,
        "ir.module.module",
        "button_immediate_install",
        [[moduleId]]
      );

      return { success: true, moduleId: String(moduleId) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Installation failed",
      };
    }
  }

  /**
   * Activate theme on website
   */
  private async activateTheme(server: OdooServerConfig, moduleName: string): Promise<void> {
    const sessionId = await this.authenticate(server);
    if (!sessionId) throw new Error("Authentication failed");

    // Get website ID
    const websiteIds = await this.callOdooMethod(
      server,
      sessionId,
      "website",
      "search",
      [[]]
    ) as number[];

    if (websiteIds && websiteIds.length > 0) {
      // Set theme on website
      await this.callOdooMethod(
        server,
        sessionId,
        "website",
        "write",
        [[websiteIds[0]], { theme_id: moduleName }]
      );
    }
  }

  /**
   * Verify deployment was successful
   */
  private async verifyDeployment(
    server: OdooServerConfig,
    moduleName: string
  ): Promise<{ success: boolean }> {
    try {
      const sessionId = await this.authenticate(server);
      if (!sessionId) return { success: false };

      // Check module state
      const modules = await this.callOdooMethod(
        server,
        sessionId,
        "ir.module.module",
        "search_read",
        [[["name", "=", moduleName]], ["state"]]
      ) as Array<{ state: string }>;

      if (modules && modules.length > 0 && modules[0].state === "installed") {
        return { success: true };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }

  /**
   * Rollback deployment
   */
  private async rollback(server: OdooServerConfig, moduleName: string): Promise<void> {
    try {
      const sessionId = await this.authenticate(server);
      if (!sessionId) return;

      // Uninstall module
      const moduleIds = await this.callOdooMethod(
        server,
        sessionId,
        "ir.module.module",
        "search",
        [[["name", "=", moduleName]]]
      ) as number[];

      if (moduleIds && moduleIds.length > 0) {
        await this.callOdooMethod(
          server,
          sessionId,
          "ir.module.module",
          "button_immediate_uninstall",
          [[moduleIds[0]]]
        );
      }
    } catch {
      // Rollback failed silently
    }
  }

  /**
   * Authenticate with Odoo server
   */
  private async authenticate(server: OdooServerConfig): Promise<string | null> {
    try {
      const authUrl = buildEndpoint(server.url, "/web/session/authenticate");
      const response = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            db: server.database,
            login: server.username || "",
            password: server.getPassword?.() || server.apiKey || "",
          },
          id: Date.now(),
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data?.result?.uid > 0) {
        // Extract session ID from cookies
        const cookies = response.headers.get("set-cookie");
        const match = cookies?.match(/session_id=([^;]+)/);
        return match?.[1] || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Call Odoo JSON-RPC method
   */
  private async callOdooMethod(
    server: OdooServerConfig,
    sessionId: string,
    model: string,
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    const url = buildEndpoint(server.url, "/web/dataset/call_kw");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model,
          method,
          args,
          kwargs: {},
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Odoo API call failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "Odoo API error");
    }

    return data.result;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// =============================================================================
// Factory Functions
// =============================================================================

let deployServiceInstance: OneClickDeploy | null = null;

/**
 * Get OneClickDeploy singleton
 */
export function getDeployService(): OneClickDeploy {
  if (!deployServiceInstance) {
    deployServiceInstance = new OneClickDeploy();
  }
  return deployServiceInstance;
}

/**
 * Create new OneClickDeploy instance
 */
export function createDeployService(): OneClickDeploy {
  return new OneClickDeploy();
}
