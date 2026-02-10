/**
 * Odoo Marketplace Publisher
 *
 * Packages and publishes theme templates to the Odoo App Store (apps.odoo.com).
 * Handles the complete submission flow including validation, packaging, and upload.
 */

import type { MarketplaceMetadata, MetadataInput } from "./marketplace-metadata";
import type { ValidationResult, ManifestData, SubmissionAssets } from "./appstore-validator";
import { generateMarketplaceMetadata } from "./marketplace-metadata";
import { validateSubmission } from "./appstore-validator";

// =============================================================================
// Types
// =============================================================================

/** Odoo App Store authentication */
export interface OdooStoreAuth {
  /** Odoo.com account email */
  email: string;
  /** Odoo.com account password or API token */
  token: string;
  /** Publisher organization name */
  publisherName: string;
}

/** Module package structure */
export interface ModulePackage {
  /** Technical module name (e.g., "theme_platxa_modern") */
  technicalName: string;
  /** Human-readable display name */
  displayName: string;
  /** Module version (e.g., "17.0.1.0.0") */
  version: string;
  /** Base64-encoded ZIP archive of the module */
  archiveBase64: string;
  /** SHA256 hash of the archive */
  archiveHash: string;
  /** Size in bytes */
  archiveSize: number;
  /** Manifest data parsed from __manifest__.py */
  manifest: ManifestData;
  /** Submission assets (icon, screenshots, description) */
  assets: SubmissionAssets;
  /** Marketplace metadata */
  metadata: MarketplaceMetadata;
}

/** Publish step status */
export type PublishStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

/** A single publish step */
export interface PublishStep {
  id: string;
  label: string;
  status: PublishStepStatus;
  durationMs: number;
  error?: string;
  detail?: string;
}

/** Publish result */
export interface PublishResult {
  success: boolean;
  moduleName: string;
  steps: PublishStep[];
  totalDurationMs: number;
  summary: string;
  /** App Store listing URL if successful */
  listingUrl?: string;
  /** App Store module ID */
  moduleId?: number;
  /** Validation result from pre-flight check */
  validation: ValidationResult;
}

/** Price configuration */
export interface PriceConfig {
  /** Price in EUR (0 for free) */
  amount: number;
  /** Currency (must be EUR for Odoo Store) */
  currency: "EUR";
  /** License type */
  licenseType: "LGPL-3" | "OEEL-1" | "GPL-3" | "AGPL-3";
}

/** Publish options */
export interface PublishOptions {
  /** Authentication credentials */
  auth: OdooStoreAuth;
  /** Module package to publish */
  package: ModulePackage;
  /** Price configuration */
  pricing: PriceConfig;
  /** Target Odoo versions (e.g., ["16.0", "17.0"]) */
  targetVersions: string[];
  /** Whether to publish immediately or save as draft */
  publishImmediately: boolean;
  /** Called when a step updates */
  onStepUpdate?: (step: PublishStep) => void;
}

/** Purchase webhook event */
export interface PurchaseEvent {
  /** Event type */
  type: "purchase" | "refund" | "subscription_start" | "subscription_cancel";
  /** Module technical name */
  moduleName: string;
  /** Buyer email */
  buyerEmail: string;
  /** Transaction ID */
  transactionId: string;
  /** Amount in EUR */
  amount: number;
  /** Timestamp */
  timestamp: string;
  /** Odoo version purchased */
  odooVersion: string;
  /** License key (for paid modules) */
  licenseKey?: string;
}

/** HTTP client interface for publishing */
export interface HttpClient {
  post(url: string, body: unknown, headers: Record<string, string>): Promise<{
    status: number;
    data: unknown;
    ok: boolean;
  }>;
  put(url: string, body: unknown, headers: Record<string, string>): Promise<{
    status: number;
    data: unknown;
    ok: boolean;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const ODOO_STORE_BASE_URL = "https://apps.odoo.com";
const ODOO_STORE_API_URL = `${ODOO_STORE_BASE_URL}/api/v2`;

const PUBLISH_STEPS = {
  validate: "validate",
  authenticate: "authenticate",
  checkExisting: "check_existing",
  uploadArchive: "upload_archive",
  updateMetadata: "update_metadata",
  uploadScreenshots: "upload_screenshots",
  publish: "publish",
} as const;

// =============================================================================
// Step Creators
// =============================================================================

function createPublishSteps(): PublishStep[] {
  return [
    { id: PUBLISH_STEPS.validate, label: "Validate module for App Store", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.authenticate, label: "Authenticate with Odoo.com", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.checkExisting, label: "Check for existing listing", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.uploadArchive, label: "Upload module archive", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.updateMetadata, label: "Update listing metadata", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.uploadScreenshots, label: "Upload screenshots", status: "pending", durationMs: 0 },
    { id: PUBLISH_STEPS.publish, label: "Publish to marketplace", status: "pending", durationMs: 0 },
  ];
}

// =============================================================================
// Publish Flow
// =============================================================================

/**
 * Publishes a theme module to the Odoo App Store.
 *
 * Flow:
 * 1. Validate module against App Store requirements
 * 2. Authenticate with Odoo.com
 * 3. Check if module already exists (update vs create)
 * 4. Upload module archive
 * 5. Update listing metadata (description, features, etc.)
 * 6. Upload screenshots
 * 7. Publish listing (or save as draft)
 */
export async function publishToMarketplace(
  options: PublishOptions,
  http: HttpClient,
): Promise<PublishResult> {
  const { auth, package: pkg, pricing, targetVersions, publishImmediately, onStepUpdate } = options;

  const steps = createPublishSteps();
  const totalStart = performance.now();
  let aborted = false;
  let sessionToken: string | null = null;
  let moduleId: number | null = null;
  let isUpdate = false;

  const updateStep = (id: string, updates: Partial<PublishStep>) => {
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

  // Step 1: Validate
  const validation = validateSubmission(pkg.manifest, pkg.assets);
  await runStep(PUBLISH_STEPS.validate, async () => {
    if (!validation.valid) {
      const errors = validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ");
      throw new Error(`Validation failed: ${errors}`);
    }
    return `Passed ${validation.passed.length} checks, ${validation.warningCount} warnings`;
  });

  // Step 2: Authenticate
  await runStep(PUBLISH_STEPS.authenticate, async () => {
    const response = await http.post(
      `${ODOO_STORE_API_URL}/auth/login`,
      { email: auth.email, token: auth.token },
      { "Content-Type": "application/json" },
    );

    if (!response.ok) {
      throw new Error("Authentication failed: invalid credentials");
    }

    const data = response.data as { session_token?: string };
    sessionToken = data.session_token || null;
    if (!sessionToken) {
      throw new Error("No session token received");
    }

    return `Authenticated as ${auth.email}`;
  });

  // Step 3: Check for existing listing
  await runStep(PUBLISH_STEPS.checkExisting, async () => {
    const response = await http.post(
      `${ODOO_STORE_API_URL}/modules/search`,
      {
        name: pkg.technicalName,
        publisher: auth.publisherName,
      },
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    );

    const data = response.data as { modules?: Array<{ id: number; version: string }> };
    if (data.modules && data.modules.length > 0) {
      moduleId = data.modules[0].id;
      isUpdate = true;
      return `Found existing listing (ID: ${moduleId}) — will update`;
    }

    return "No existing listing — will create new";
  });

  // Step 4: Upload module archive
  await runStep(PUBLISH_STEPS.uploadArchive, async () => {
    const endpoint = isUpdate && moduleId
      ? `${ODOO_STORE_API_URL}/modules/${moduleId}/versions`
      : `${ODOO_STORE_API_URL}/modules`;

    const payload = {
      technical_name: pkg.technicalName,
      display_name: pkg.displayName,
      version: pkg.version,
      archive: pkg.archiveBase64,
      archive_hash: pkg.archiveHash,
      license: pricing.licenseType,
      price: pricing.amount,
      currency: pricing.currency,
      odoo_versions: targetVersions,
      publisher: auth.publisherName,
    };

    const response = await http.post(endpoint, payload, {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    });

    if (!response.ok) {
      const errorData = response.data as { error?: string };
      throw new Error(errorData.error || "Failed to upload archive");
    }

    const data = response.data as { module_id?: number };
    if (!moduleId && data.module_id) {
      moduleId = data.module_id;
    }

    return `Archive uploaded (${Math.round(pkg.archiveSize / 1024)} KB)`;
  });

  // Step 5: Update metadata
  await runStep(PUBLISH_STEPS.updateMetadata, async () => {
    if (!moduleId) throw new Error("No module ID available");

    const response = await http.put(
      `${ODOO_STORE_API_URL}/modules/${moduleId}/metadata`,
      {
        summary: pkg.metadata.summary,
        description_html: pkg.metadata.htmlDescription,
        features: pkg.metadata.features,
        categories: pkg.metadata.categories,
        keywords: pkg.metadata.keywords,
        icon_spec: pkg.metadata.icon,
      },
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update metadata");
    }

    return "Listing metadata updated";
  });

  // Step 6: Upload screenshots
  await runStep(PUBLISH_STEPS.uploadScreenshots, async () => {
    if (!moduleId) throw new Error("No module ID available");

    // In a real implementation, this would upload actual screenshot files
    // For now, we submit screenshot specs and the store generates placeholders
    const response = await http.put(
      `${ODOO_STORE_API_URL}/modules/${moduleId}/screenshots`,
      { screenshots: pkg.metadata.screenshots },
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to upload screenshots");
    }

    return `${pkg.metadata.screenshots.length} screenshot specs submitted`;
  });

  // Step 7: Publish
  await runStep(PUBLISH_STEPS.publish, async () => {
    if (!moduleId) throw new Error("No module ID available");

    const response = await http.put(
      `${ODOO_STORE_API_URL}/modules/${moduleId}/status`,
      { status: publishImmediately ? "published" : "draft" },
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update publish status");
    }

    return publishImmediately ? "Published to marketplace" : "Saved as draft";
  });

  const totalDurationMs = Math.round(performance.now() - totalStart);
  const success = !aborted;
  const failedStep = steps.find((s) => s.status === "failed");

  return {
    success,
    moduleName: pkg.technicalName,
    steps,
    totalDurationMs,
    summary: success
      ? `Successfully ${isUpdate ? "updated" : "published"} ${pkg.displayName} to Odoo App Store`
      : `Publish failed at "${failedStep?.label}": ${failedStep?.error}`,
    listingUrl: success && moduleId
      ? `${ODOO_STORE_BASE_URL}/apps/modules/${pkg.technicalName}/`
      : undefined,
    moduleId: moduleId || undefined,
    validation,
  };
}

// =============================================================================
// Purchase Flow Integration
// =============================================================================

/**
 * Creates a webhook handler for purchase events from Odoo App Store.
 * This is called when customers purchase themes.
 */
export function createPurchaseWebhookHandler(options: {
  /** Secret key for verifying webhook signatures */
  webhookSecret: string;
  /** Called when a purchase is made */
  onPurchase: (event: PurchaseEvent) => Promise<void>;
  /** Called when a refund is issued */
  onRefund?: (event: PurchaseEvent) => Promise<void>;
  /** Called when a subscription starts */
  onSubscriptionStart?: (event: PurchaseEvent) => Promise<void>;
  /** Called when a subscription is cancelled */
  onSubscriptionCancel?: (event: PurchaseEvent) => Promise<void>;
}) {
  const { webhookSecret, onPurchase, onRefund, onSubscriptionStart, onSubscriptionCancel } = options;

  return async function handleWebhook(
    payload: string,
    signature: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify signature
    const expectedSignature = computeHmacSignature(payload, webhookSecret);
    if (!timingSafeEqual(signature, expectedSignature)) {
      return { success: false, error: "Invalid webhook signature" };
    }

    try {
      const event = JSON.parse(payload) as PurchaseEvent;

      switch (event.type) {
        case "purchase":
          await onPurchase(event);
          break;
        case "refund":
          if (onRefund) await onRefund(event);
          break;
        case "subscription_start":
          if (onSubscriptionStart) await onSubscriptionStart(event);
          break;
        case "subscription_cancel":
          if (onSubscriptionCancel) await onSubscriptionCancel(event);
          break;
        default:
          return { success: false, error: `Unknown event type: ${(event as PurchaseEvent).type}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

/**
 * Generates a license key for a purchased module.
 */
export function generateLicenseKey(options: {
  moduleName: string;
  buyerEmail: string;
  transactionId: string;
  expiresAt?: Date;
}): string {
  const { moduleName, buyerEmail, transactionId, expiresAt } = options;

  // Simple deterministic license key format
  // In production, use cryptographic signing
  const data = [
    moduleName,
    buyerEmail,
    transactionId,
    expiresAt ? expiresAt.toISOString() : "perpetual",
  ].join("|");

  const hash = simpleHash(data);
  const segments = [
    hash.slice(0, 4),
    hash.slice(4, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
  ].map((s) => s.toUpperCase());

  return segments.join("-");
}

/**
 * Validates a license key for a module.
 */
export function validateLicenseKey(
  licenseKey: string,
  moduleName: string,
  buyerEmail: string,
): { valid: boolean; expired: boolean } {
  // In production, verify against stored license records
  // This is a placeholder implementation
  const keyPattern = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

  if (!keyPattern.test(licenseKey)) {
    return { valid: false, expired: false };
  }

  // Would check against database in production
  return { valid: true, expired: false };
}

// =============================================================================
// Package Builder
// =============================================================================

/**
 * Builds a complete module package from source files.
 */
export async function buildModulePackage(options: {
  /** Path to module directory */
  modulePath: string;
  /** Metadata input for marketplace */
  metadataInput: MetadataInput;
  /** Function to read file contents */
  readFile: (path: string) => Promise<string>;
  /** Function to list files in directory */
  listFiles: (path: string) => Promise<string[]>;
  /** Function to create ZIP archive (returns base64) */
  createArchive: (files: Array<{ path: string; content: string }>) => Promise<string>;
  /** Function to compute SHA256 hash */
  computeHash: (data: string) => string;
}): Promise<ModulePackage> {
  const { modulePath, metadataInput, readFile, listFiles, createArchive, computeHash } = options;

  // List all module files
  const files = await listFiles(modulePath);

  // Read manifest
  const manifestContent = await readFile(`${modulePath}/__manifest__.py`);
  const manifest = parseManifest(manifestContent);

  // Build file list for archive
  const archiveFiles: Array<{ path: string; content: string }> = [];
  for (const file of files) {
    const content = await readFile(`${modulePath}/${file}`);
    archiveFiles.push({ path: file, content });
  }

  // Create archive
  const archiveBase64 = await createArchive(archiveFiles);
  const archiveHash = computeHash(archiveBase64);

  // Build submission assets
  const assets = buildSubmissionAssets(files, modulePath, readFile);

  // Generate marketplace metadata
  const metadata = generateMarketplaceMetadata(metadataInput);

  return {
    technicalName: metadataInput.themeName,
    displayName: metadataInput.displayName,
    version: manifest.version || "17.0.1.0.0",
    archiveBase64,
    archiveHash,
    archiveSize: Math.round((archiveBase64.length * 3) / 4), // Approximate decoded size
    manifest,
    assets: await assets,
    metadata,
  };
}

async function buildSubmissionAssets(
  files: string[],
  _modulePath: string,
  _readFile: (path: string) => Promise<string>,
): Promise<SubmissionAssets> {
  const hasIcon = files.includes("static/description/icon.png");
  const screenshotPaths = files.filter((f) =>
    f.startsWith("static/description/") &&
    f.includes("screenshot") &&
    f.endsWith(".png"),
  );
  const hasDescription =
    files.includes("static/description/index.html") ||
    files.includes("README.md");

  // Would read and measure description in production
  const descriptionLength = 200; // Placeholder

  return {
    hasIcon,
    iconSize: hasIcon ? [256, 256] : undefined,
    screenshotCount: screenshotPaths.length,
    screenshotPaths,
    hasDescription,
    descriptionLength,
    moduleFiles: files,
  };
}

function parseManifest(content: string): ManifestData {
  // Simple Python dict parser for manifest
  // In production, use a proper Python AST parser
  const manifest: ManifestData = {};

  const stringMatch = (key: string): string | undefined => {
    const regex = new RegExp(`['"]${key}['"]\\s*:\\s*['"]([^'"]+)['"]`);
    const match = content.match(regex);
    return match ? match[1] : undefined;
  };

  const boolMatch = (key: string): boolean | undefined => {
    const regex = new RegExp(`['"]${key}['"]\\s*:\\s*(True|False)`);
    const match = content.match(regex);
    return match ? match[1] === "True" : undefined;
  };

  manifest.name = stringMatch("name");
  manifest.version = stringMatch("version");
  manifest.license = stringMatch("license");
  manifest.author = stringMatch("author");
  manifest.website = stringMatch("website");
  manifest.category = stringMatch("category");
  manifest.summary = stringMatch("summary");
  manifest.installable = boolMatch("installable");
  manifest.application = boolMatch("application");

  return manifest;
}

// =============================================================================
// Utility Functions
// =============================================================================

function computeHmacSignature(payload: string, secret: string): string {
  // Placeholder - in production use crypto.createHmac
  return simpleHash(payload + secret);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function simpleHash(input: string): string {
  // Simple hash for demo - in production use crypto.createHash
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
