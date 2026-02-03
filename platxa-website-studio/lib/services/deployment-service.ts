/**
 * Deployment Service - Complete deployment workflow with verification and rollback
 */

import { db } from "@/lib/db";
import { createSnapshot, restoreFromSnapshot } from "./project-service";
import type { Deployment, DeploymentStatus } from "@prisma/client";
import JSZip from "jszip";

export interface DeploymentConfig {
  projectId: string;
  userId: string;
  odooUrl: string;
  odooDatabase: string;
  odooUsername: string;
  odooPassword: string;
  moduleName?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  version: string;
  message: string;
  verificationLog?: string;
}

/**
 * Generate next version number for a project
 */
async function getNextVersion(projectId: string): Promise<string> {
  const lastDeployment = await db.deployment.findFirst({
    where: { projectId, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
  });

  if (!lastDeployment) {
    return "1.0.0";
  }

  const parts = lastDeployment.version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

/**
 * Create deployment record
 */
export async function createDeployment(
  config: DeploymentConfig
): Promise<Deployment> {
  const version = await getNextVersion(config.projectId);
  const moduleName = config.moduleName || "theme_generated";

  // Create pre-deployment snapshot
  const snapshot = await createSnapshot(
    config.projectId,
    `Pre-deployment v${version}`,
    `Automatic snapshot before deployment`
  );

  // Get files to deploy
  const files = await db.projectFile.findMany({
    where: { projectId: config.projectId },
  });

  const filesDeployed = files.map((f) => ({
    path: f.path,
    name: f.name,
    language: f.language,
  }));

  // Find manifest content
  const manifest = files.find((f) => f.path.includes("__manifest__.py"));

  return db.deployment.create({
    data: {
      projectId: config.projectId,
      userId: config.userId,
      version,
      odooUrl: config.odooUrl,
      odooDatabase: config.odooDatabase,
      moduleName,
      filesDeployed,
      manifestContent: manifest?.content,
      status: "PENDING",
    },
  });
}

/**
 * Update deployment status
 */
export async function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
  options?: {
    errorMessage?: string;
    errorCode?: string;
    verificationLog?: string;
  }
): Promise<Deployment> {
  const data: Record<string, unknown> = { status };

  if (status === "SUCCESS" || status === "FAILED") {
    data.completedAt = new Date();
  }

  if (status === "SUCCESS") {
    data.verifiedAt = new Date();
  }

  if (options?.errorMessage) {
    data.errorMessage = options.errorMessage;
  }

  if (options?.errorCode) {
    data.errorCode = options.errorCode;
  }

  if (options?.verificationLog) {
    data.verificationLog = options.verificationLog;
  }

  return db.deployment.update({
    where: { id },
    data,
  });
}

/**
 * Create ZIP file from project files
 */
export async function createModuleZip(projectId: string): Promise<Buffer> {
  const files = await db.projectFile.findMany({
    where: { projectId },
  });

  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Verify deployment by checking if module is installed in Odoo
 */
export async function verifyDeployment(
  deployment: Deployment,
  config: { username: string; password: string }
): Promise<{ success: boolean; log: string }> {
  const log: string[] = [];

  try {
    log.push(`[${new Date().toISOString()}] Starting deployment verification`);
    log.push(`Target: ${deployment.odooUrl}`);
    log.push(`Database: ${deployment.odooDatabase}`);
    log.push(`Module: ${deployment.moduleName}`);

    // Step 1: Check Odoo connectivity
    log.push(`\n[Step 1] Checking Odoo connectivity...`);
    const healthCheck = await fetch(`${deployment.odooUrl}/web/webclient/version_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: {}, id: 1 }),
    });

    if (!healthCheck.ok) {
      log.push(`FAILED: Unable to connect to Odoo (${healthCheck.status})`);
      return { success: false, log: log.join("\n") };
    }

    const versionInfo = await healthCheck.json();
    log.push(`SUCCESS: Connected to Odoo ${versionInfo.result?.server_version || "unknown"}`);

    // Step 2: Authenticate
    log.push(`\n[Step 2] Authenticating...`);
    const authResponse = await fetch(`${deployment.odooUrl}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          db: deployment.odooDatabase,
          login: config.username,
          password: config.password,
        },
        id: 2,
      }),
    });

    const authResult = await authResponse.json();
    if (authResult.error || !authResult.result?.uid) {
      log.push(`FAILED: Authentication failed - ${authResult.error?.message || "Invalid credentials"}`);
      return { success: false, log: log.join("\n") };
    }

    const sessionId = authResponse.headers.get("set-cookie")?.split(";")[0] || "";
    log.push(`SUCCESS: Authenticated as user ${authResult.result.uid}`);

    // Step 3: Check if module is installed
    log.push(`\n[Step 3] Checking module installation status...`);
    const moduleCheck = await fetch(`${deployment.odooUrl}/web/dataset/call_kw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "ir.module.module",
          method: "search_read",
          args: [[["name", "=", deployment.moduleName]]],
          kwargs: { fields: ["name", "state", "installed_version"] },
        },
        id: 3,
      }),
    });

    const moduleResult = await moduleCheck.json();
    const modules = moduleResult.result || [];

    if (modules.length === 0) {
      log.push(`WARNING: Module "${deployment.moduleName}" not found in Odoo database`);
      log.push(`The module may need to be updated in the Apps list`);
      return { success: false, log: log.join("\n") };
    }

    const odooModule = modules[0];
    log.push(`Found module: ${odooModule.name}`);
    log.push(`State: ${odooModule.state}`);
    log.push(`Version: ${odooModule.installed_version || "N/A"}`);

    if (odooModule.state === "installed") {
      log.push(`\n[Result] SUCCESS: Module is installed and active`);
      return { success: true, log: log.join("\n") };
    } else if (odooModule.state === "to upgrade" || odooModule.state === "to install") {
      log.push(`\n[Result] PENDING: Module is queued for ${odooModule.state.replace("to ", "")}`);
      return { success: true, log: log.join("\n") };
    } else {
      log.push(`\n[Result] WARNING: Module state is "${odooModule.state}"`);
      return { success: false, log: log.join("\n") };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    log.push(`\n[Error] Verification failed: ${errorMsg}`);
    return { success: false, log: log.join("\n") };
  }
}

/**
 * Execute full deployment workflow
 */
export async function deployToOdoo(
  config: DeploymentConfig
): Promise<DeploymentResult> {
  let deployment: Deployment | null = null;

  try {
    // Create deployment record
    deployment = await createDeployment(config);

    // Update status: UPLOADING
    await updateDeploymentStatus(deployment.id, "UPLOADING");

    // Create ZIP file
    const zipBuffer = await createModuleZip(config.projectId);

    // Upload to Odoo via XML-RPC
    await updateDeploymentStatus(deployment.id, "INSTALLING");

    // Upload the module
    const uploadResponse = await fetch(`${config.odooUrl}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "ir.module.module",
          method: "update_list",
          args: [],
          kwargs: {},
        },
        id: 1,
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    // Verify deployment
    await updateDeploymentStatus(deployment.id, "VERIFYING");

    const verification = await verifyDeployment(deployment, {
      username: config.odooUsername,
      password: config.odooPassword,
    });

    if (verification.success) {
      await updateDeploymentStatus(deployment.id, "SUCCESS", {
        verificationLog: verification.log,
      });

      return {
        success: true,
        deploymentId: deployment.id,
        version: deployment.version,
        message: "Deployment successful",
        verificationLog: verification.log,
      };
    } else {
      await updateDeploymentStatus(deployment.id, "FAILED", {
        errorMessage: "Verification failed",
        verificationLog: verification.log,
      });

      return {
        success: false,
        deploymentId: deployment.id,
        version: deployment.version,
        message: "Deployment verification failed",
        verificationLog: verification.log,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    if (deployment) {
      await updateDeploymentStatus(deployment.id, "FAILED", {
        errorMessage: errorMsg,
        errorCode: "DEPLOYMENT_ERROR",
      });
    }

    return {
      success: false,
      deploymentId: deployment?.id || "",
      version: deployment?.version || "0.0.0",
      message: `Deployment failed: ${errorMsg}`,
    };
  }
}

/**
 * Rollback to a previous deployment
 */
export async function rollbackDeployment(
  deploymentId: string,
  userId: string
): Promise<DeploymentResult> {
  try {
    // Get the deployment to rollback
    const deployment = await db.deployment.findUnique({
      where: { id: deploymentId },
      include: { snapshot: true },
    });

    if (!deployment) {
      throw new Error("Deployment not found");
    }

    if (!deployment.snapshot) {
      throw new Error("No snapshot available for rollback");
    }

    // Restore files from snapshot
    await restoreFromSnapshot(deployment.projectId, deployment.snapshot.id);

    // Mark original deployment as rolled back
    await updateDeploymentStatus(deploymentId, "ROLLED_BACK");

    // Create new deployment with rolled back files
    const rollbackDeployment = await db.deployment.create({
      data: {
        projectId: deployment.projectId,
        userId,
        version: `${deployment.version}-rollback`,
        odooUrl: deployment.odooUrl,
        odooDatabase: deployment.odooDatabase,
        moduleName: deployment.moduleName,
        filesDeployed: deployment.snapshot.files as object,
        status: "SUCCESS",
        rolledBackFromId: deploymentId,
        completedAt: new Date(),
        verifiedAt: new Date(),
        verificationLog: `Rolled back from deployment ${deployment.version}`,
      },
    });

    return {
      success: true,
      deploymentId: rollbackDeployment.id,
      version: rollbackDeployment.version,
      message: `Successfully rolled back from ${deployment.version}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      deploymentId,
      version: "",
      message: `Rollback failed: ${errorMsg}`,
    };
  }
}

/**
 * Get deployment history for a project
 */
export async function getDeploymentHistory(projectId: string) {
  return db.deployment.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true },
      },
      snapshot: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Get deployment by ID
 */
export async function getDeployment(id: string) {
  return db.deployment.findUnique({
    where: { id },
    include: {
      project: true,
      user: {
        select: { name: true, email: true },
      },
      snapshot: true,
    },
  });
}
