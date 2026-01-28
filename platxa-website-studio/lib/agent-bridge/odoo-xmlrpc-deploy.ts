/**
 * One-Click Deploy to Odoo via XML-RPC
 *
 * Uploads a packaged theme module to a connected Odoo instance,
 * installs it via XML-RPC, and reports success/failure status.
 */

// =============================================================================
// Types
// =============================================================================

/** Odoo instance connection config */
export interface OdooConnection {
  /** Odoo instance URL (e.g. "https://myodoo.com") */
  url: string;
  /** Database name */
  database: string;
  /** Login username */
  username: string;
  /** Login password or API key */
  password: string;
  /** Connection timeout in ms (default 30000) */
  timeoutMs?: number;
}

/** Deploy step status */
export type DeployStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

/** A single deployment step */
export interface DeployStep {
  /** Step identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Current status */
  status: DeployStepStatus;
  /** Duration in ms (0 if not started) */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Step output/details */
  detail?: string;
}

/** Overall deployment result */
export interface DeployResult {
  /** Whether the deploy succeeded */
  success: boolean;
  /** Module that was deployed */
  moduleName: string;
  /** Target Odoo URL */
  targetUrl: string;
  /** All deployment steps */
  steps: DeployStep[];
  /** Total duration in ms */
  totalDurationMs: number;
  /** Summary message */
  summary: string;
  /** URL to access the installed theme (if successful) */
  themeUrl?: string;
}

/** XML-RPC call function signature */
export type XmlRpcCall = (
  url: string,
  service: string,
  method: string,
  args: unknown[],
) => Promise<unknown>;

/** File upload function (uploads module archive to Odoo) */
export type FileUploader = (
  url: string,
  moduleName: string,
  archiveBase64: string,
  headers: Record<string, string>,
) => Promise<{ success: boolean; error?: string }>;

/** Options for deployment */
export interface DeployOptions {
  /** Odoo connection config */
  connection: OdooConnection;
  /** Module technical name */
  moduleName: string;
  /** Base64-encoded module archive (ZIP) */
  moduleArchive: string;
  /** XML-RPC call implementation */
  xmlrpc: XmlRpcCall;
  /** File upload implementation */
  upload: FileUploader;
  /** Called when a step updates */
  onStepUpdate?: (step: DeployStep) => void;
  /** Whether to activate the theme on the website after install */
  activateTheme?: boolean;
}

// =============================================================================
// Deploy Steps
// =============================================================================

const STEP_IDS = {
  authenticate: "authenticate",
  upload: "upload",
  updateModuleList: "update_module_list",
  install: "install",
  activate: "activate",
  verify: "verify",
} as const;

function createSteps(activateTheme: boolean): DeployStep[] {
  const steps: DeployStep[] = [
    { id: STEP_IDS.authenticate, label: "Authenticate with Odoo", status: "pending", durationMs: 0 },
    { id: STEP_IDS.upload, label: "Upload module archive", status: "pending", durationMs: 0 },
    { id: STEP_IDS.updateModuleList, label: "Update module list", status: "pending", durationMs: 0 },
    { id: STEP_IDS.install, label: "Install module", status: "pending", durationMs: 0 },
  ];

  if (activateTheme) {
    steps.push({ id: STEP_IDS.activate, label: "Activate theme on website", status: "pending", durationMs: 0 });
  }

  steps.push({ id: STEP_IDS.verify, label: "Verify installation", status: "pending", durationMs: 0 });

  return steps;
}

// =============================================================================
// XML-RPC Helpers
// =============================================================================

/**
 * Authenticates with Odoo via XML-RPC and returns the user ID.
 */
export async function authenticate(
  connection: OdooConnection,
  xmlrpc: XmlRpcCall,
): Promise<number> {
  const uid = await xmlrpc(
    `${connection.url}/xmlrpc/2/common`,
    "common",
    "authenticate",
    [connection.database, connection.username, connection.password, {}],
  );

  if (typeof uid !== "number" || uid <= 0) {
    throw new Error("Authentication failed: invalid credentials or database");
  }

  return uid;
}

/**
 * Calls an Odoo model method via XML-RPC object service.
 */
export async function callOdoo(
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
  );
}

// =============================================================================
// Deploy Runner
// =============================================================================

/**
 * Deploys a theme module to an Odoo instance:
 * 1. Authenticate via XML-RPC
 * 2. Upload module archive
 * 3. Update module list
 * 4. Install module
 * 5. Optionally activate theme
 * 6. Verify installation
 */
export async function deployToOdoo(options: DeployOptions): Promise<DeployResult> {
  const {
    connection,
    moduleName,
    moduleArchive,
    xmlrpc,
    upload,
    onStepUpdate,
    activateTheme = false,
  } = options;

  const steps = createSteps(activateTheme);
  const totalStart = performance.now();
  let uid = 0;
  let aborted = false;

  const updateStep = (id: string, updates: Partial<DeployStep>) => {
    const step = steps.find((s) => s.id === id);
    if (step) {
      Object.assign(step, updates);
      onStepUpdate?.(step);
    }
  };

  const runStep = async (id: string, fn: () => Promise<string | void>) => {
    if (aborted) {
      updateStep(id, { status: "skipped" });
      return;
    }
    updateStep(id, { status: "running" });
    const start = performance.now();
    try {
      const detail = await fn();
      updateStep(id, {
        status: "success",
        durationMs: Math.round(performance.now() - start),
        detail: detail || undefined,
      });
    } catch (err) {
      updateStep(id, {
        status: "failed",
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      });
      aborted = true;
    }
  };

  // Step 1: Authenticate
  await runStep(STEP_IDS.authenticate, async () => {
    uid = await authenticate(connection, xmlrpc);
    return `Authenticated as UID ${uid}`;
  });

  // Step 2: Upload module archive
  await runStep(STEP_IDS.upload, async () => {
    const sessionHeader = { "X-Odoo-Database": connection.database };
    const result = await upload(
      `${connection.url}/web/binary/upload_module`,
      moduleName,
      moduleArchive,
      sessionHeader,
    );
    if (!result.success) throw new Error(result.error || "Upload failed");
    return "Module archive uploaded";
  });

  // Step 3: Update module list
  await runStep(STEP_IDS.updateModuleList, async () => {
    await callOdoo(connection, uid, xmlrpc, "ir.module.module", "update_list", []);
    return "Module list updated";
  });

  // Step 4: Install module
  await runStep(STEP_IDS.install, async () => {
    // Search for module
    const moduleIds = await callOdoo(
      connection, uid, xmlrpc,
      "ir.module.module", "search",
      [[["name", "=", moduleName]]],
    ) as number[];

    if (!moduleIds || moduleIds.length === 0) {
      throw new Error(`Module "${moduleName}" not found after upload`);
    }

    // Install
    await callOdoo(
      connection, uid, xmlrpc,
      "ir.module.module", "button_immediate_install",
      [moduleIds],
    );

    return `Module ${moduleName} installed (ID: ${moduleIds[0]})`;
  });

  // Step 5: Activate theme (optional)
  if (activateTheme) {
    await runStep(STEP_IDS.activate, async () => {
      const websiteIds = await callOdoo(
        connection, uid, xmlrpc,
        "website", "search",
        [[]],
        { limit: 1 },
      ) as number[];

      if (websiteIds && websiteIds.length > 0) {
        await callOdoo(
          connection, uid, xmlrpc,
          "website", "write",
          [websiteIds, { theme_id: moduleName }],
        );
        return `Theme activated on website ID ${websiteIds[0]}`;
      }
      return "No website found — theme installed but not activated";
    });
  }

  // Step 6: Verify installation
  await runStep(STEP_IDS.verify, async () => {
    const moduleIds = await callOdoo(
      connection, uid, xmlrpc,
      "ir.module.module", "search",
      [[["name", "=", moduleName], ["state", "=", "installed"]]],
    ) as number[];

    if (!moduleIds || moduleIds.length === 0) {
      throw new Error("Module not found in installed state after installation");
    }

    return `Verified: ${moduleName} is installed`;
  });

  const totalDurationMs = Math.round(performance.now() - totalStart);
  const success = !aborted;
  const failedStep = steps.find((s) => s.status === "failed");

  return {
    success,
    moduleName,
    targetUrl: connection.url,
    steps,
    totalDurationMs,
    summary: success
      ? `Successfully deployed ${moduleName} to ${connection.url}`
      : `Deploy failed at "${failedStep?.label}": ${failedStep?.error}`,
    themeUrl: success ? `${connection.url}/` : undefined,
  };
}
