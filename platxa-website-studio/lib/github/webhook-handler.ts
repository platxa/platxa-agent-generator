/**
 * GitHub Webhook Handler
 *
 * Handles GitHub webhook events for real-time sync when repo changes externally.
 * Processes push events, pull requests, and other repository changes.
 *
 * Features:
 * - Webhook signature verification
 * - Push event handling (triggers pull)
 * - Pull request events
 * - Branch creation/deletion events
 * - Issue/comment events
 * - Real-time UI updates via callbacks
 * - Event queue for handling bursts
 * - Retry logic for failed syncs
 *
 * Feature #48: GitHub Integration - Webhook handler for real-time sync
 */

import { createHmac, timingSafeEqual } from "crypto";

// =============================================================================
// Types
// =============================================================================

/** Supported webhook event types */
export type WebhookEventType =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "create"
  | "delete"
  | "issues"
  | "issue_comment"
  | "release"
  | "workflow_run"
  | "ping";

/** Push event payload */
export interface PushEventPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  sender: {
    login: string;
    id: number;
    avatar_url: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
  } | null;
  forced: boolean;
  created: boolean;
  deleted: boolean;
}

/** Pull request event payload */
export interface PullRequestEventPayload {
  action: "opened" | "closed" | "reopened" | "synchronize" | "edited" | "merged";
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed";
    merged: boolean;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    user: {
      login: string;
      avatar_url: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
}

/** Branch create/delete event payload */
export interface RefEventPayload {
  ref: string;
  ref_type: "branch" | "tag";
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  sender: {
    login: string;
    id: number;
  };
}

/** Generic webhook payload */
export type WebhookPayload =
  | { event: "push"; payload: PushEventPayload }
  | { event: "pull_request"; payload: PullRequestEventPayload }
  | { event: "create"; payload: RefEventPayload }
  | { event: "delete"; payload: RefEventPayload }
  | { event: "ping"; payload: { zen: string; hook_id: number } }
  | { event: string; payload: Record<string, unknown> };

/** Webhook processing result */
export interface WebhookResult {
  success: boolean;
  event: WebhookEventType | string;
  action?: string;
  message: string;
  shouldSync: boolean;
  affectedBranch?: string;
  affectedFiles?: string[];
}

/** Webhook handler configuration */
export interface WebhookHandlerConfig {
  /** GitHub webhook secret for signature verification */
  webhookSecret: string;
  /** Repository full name to filter events */
  repositoryFullName?: string;
  /** Branches to sync (default: all) */
  syncBranches?: string[];
  /** Callback when sync is needed */
  onSyncNeeded?: (result: WebhookResult) => Promise<void>;
  /** Callback when branch changes */
  onBranchChange?: (action: "created" | "deleted", branchName: string) => void;
  /** Callback when PR changes */
  onPullRequestChange?: (payload: PullRequestEventPayload) => void;
  /** Callback for all events (for UI updates) */
  onEvent?: (result: WebhookResult) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/** Queued event for processing */
interface QueuedEvent {
  id: string;
  event: WebhookEventType | string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

// =============================================================================
// Signature Verification
// =============================================================================

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const payloadBuffer = typeof payload === "string" ? Buffer.from(payload) : payload;

  // GitHub sends signature as "sha256=<hex>"
  const signatureParts = signature.split("=");
  if (signatureParts.length !== 2) {
    return false;
  }

  const [algorithm, receivedSignature] = signatureParts;

  if (algorithm !== "sha256") {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBuffer)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(receivedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Extract branch name from ref
 */
export function extractBranchFromRef(ref: string): string | null {
  const match = ref.match(/^refs\/heads\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract tag name from ref
 */
export function extractTagFromRef(ref: string): string | null {
  const match = ref.match(/^refs\/tags\/(.+)$/);
  return match ? match[1] : null;
}

// =============================================================================
// Event Processing
// =============================================================================

/**
 * Process push event
 */
function processPushEvent(
  payload: PushEventPayload,
  config: WebhookHandlerConfig
): WebhookResult {
  const branchName = extractBranchFromRef(payload.ref);

  // Check if this is a branch we care about
  if (config.syncBranches && branchName && !config.syncBranches.includes(branchName)) {
    return {
      success: true,
      event: "push",
      message: `Push to ${branchName} ignored (not in sync branches)`,
      shouldSync: false,
      affectedBranch: branchName,
    };
  }

  // Handle branch deletion
  if (payload.deleted) {
    return {
      success: true,
      event: "push",
      action: "deleted",
      message: `Branch ${branchName} was deleted`,
      shouldSync: false,
      affectedBranch: branchName || undefined,
    };
  }

  // Handle branch creation
  if (payload.created) {
    return {
      success: true,
      event: "push",
      action: "created",
      message: `Branch ${branchName} was created`,
      shouldSync: true,
      affectedBranch: branchName || undefined,
    };
  }

  // Collect affected files from commits
  const affectedFiles = new Set<string>();
  for (const commit of payload.commits) {
    commit.added.forEach((f) => affectedFiles.add(f));
    commit.modified.forEach((f) => affectedFiles.add(f));
    commit.removed.forEach((f) => affectedFiles.add(f));
  }

  const commitCount = payload.commits.length;
  const commitMsg = payload.head_commit?.message || "No message";

  return {
    success: true,
    event: "push",
    action: "pushed",
    message: `${commitCount} commit(s) pushed to ${branchName}: ${commitMsg}`,
    shouldSync: true,
    affectedBranch: branchName || undefined,
    affectedFiles: Array.from(affectedFiles),
  };
}

/**
 * Process pull request event
 */
function processPullRequestEvent(
  payload: PullRequestEventPayload,
  config: WebhookHandlerConfig
): WebhookResult {
  const { action, pull_request: pr } = payload;

  // Notify callback if configured
  config.onPullRequestChange?.(payload);

  const shouldSync = action === "closed" && pr.merged;

  return {
    success: true,
    event: "pull_request",
    action,
    message: `PR #${pr.number} "${pr.title}" ${action}${pr.merged ? " (merged)" : ""}`,
    shouldSync,
    affectedBranch: pr.merged ? pr.base.ref : pr.head.ref,
  };
}

/**
 * Process branch/tag creation event
 */
function processCreateEvent(
  payload: RefEventPayload,
  config: WebhookHandlerConfig
): WebhookResult {
  if (payload.ref_type === "branch") {
    config.onBranchChange?.("created", payload.ref);
  }

  return {
    success: true,
    event: "create",
    action: payload.ref_type,
    message: `${payload.ref_type} "${payload.ref}" created`,
    shouldSync: payload.ref_type === "branch",
    affectedBranch: payload.ref_type === "branch" ? payload.ref : undefined,
  };
}

/**
 * Process branch/tag deletion event
 */
function processDeleteEvent(
  payload: RefEventPayload,
  config: WebhookHandlerConfig
): WebhookResult {
  if (payload.ref_type === "branch") {
    config.onBranchChange?.("deleted", payload.ref);
  }

  return {
    success: true,
    event: "delete",
    action: payload.ref_type,
    message: `${payload.ref_type} "${payload.ref}" deleted`,
    shouldSync: false,
    affectedBranch: payload.ref_type === "branch" ? payload.ref : undefined,
  };
}

// =============================================================================
// Webhook Handler Class
// =============================================================================

/**
 * GitHub Webhook Handler
 *
 * Processes webhook events and triggers appropriate sync actions
 */
export class GitHubWebhookHandler {
  private config: WebhookHandlerConfig;
  private eventQueue: QueuedEvent[] = [];
  private processing = false;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(config: WebhookHandlerConfig) {
    this.config = config;
  }

  /**
   * Handle incoming webhook request
   */
  async handleWebhook(
    body: string | Buffer,
    headers: Record<string, string | undefined>
  ): Promise<WebhookResult> {
    const event = headers["x-github-event"] as WebhookEventType | undefined;
    const signature = headers["x-hub-signature-256"];
    const deliveryId = headers["x-github-delivery"];

    // Log if debug enabled
    if (this.config.debug) {
      console.log(`[Webhook] Received event: ${event}, delivery: ${deliveryId}`);
    }

    // Verify signature
    if (!verifyWebhookSignature(body, signature || null, this.config.webhookSecret)) {
      return {
        success: false,
        event: event || "unknown",
        message: "Invalid webhook signature",
        shouldSync: false,
      };
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(typeof body === "string" ? body : body.toString());
    } catch {
      return {
        success: false,
        event: event || "unknown",
        message: "Invalid JSON payload",
        shouldSync: false,
      };
    }

    // Filter by repository if configured
    if (this.config.repositoryFullName) {
      const repoFullName = (payload as Record<string, unknown>).repository
        ? ((payload as Record<string, unknown>).repository as Record<string, unknown>).full_name
        : null;

      if (repoFullName !== this.config.repositoryFullName) {
        return {
          success: true,
          event: event || "unknown",
          message: `Event from different repository: ${repoFullName}`,
          shouldSync: false,
        };
      }
    }

    // Process the event
    const result = this.processEvent(event || "unknown", payload);

    // Notify event callback
    this.config.onEvent?.(result);

    // Queue sync if needed
    if (result.shouldSync && this.config.onSyncNeeded) {
      this.queueEvent(deliveryId || Date.now().toString(), event || "unknown", payload);
    }

    return result;
  }

  /**
   * Process a webhook event
   */
  private processEvent(event: string, payload: unknown): WebhookResult {
    switch (event) {
      case "ping":
        return {
          success: true,
          event: "ping",
          message: `Webhook configured: ${(payload as { zen?: string }).zen || "OK"}`,
          shouldSync: false,
        };

      case "push":
        return processPushEvent(payload as PushEventPayload, this.config);

      case "pull_request":
        return processPullRequestEvent(payload as PullRequestEventPayload, this.config);

      case "create":
        return processCreateEvent(payload as RefEventPayload, this.config);

      case "delete":
        return processDeleteEvent(payload as RefEventPayload, this.config);

      default:
        return {
          success: true,
          event,
          message: `Unhandled event type: ${event}`,
          shouldSync: false,
        };
    }
  }

  /**
   * Queue an event for processing
   */
  private queueEvent(id: string, event: string, payload: unknown): void {
    this.eventQueue.push({
      id,
      event: event as WebhookEventType,
      payload,
      timestamp: Date.now(),
      retries: 0,
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      try {
        const result = this.processEvent(event.event, event.payload);

        if (result.shouldSync && this.config.onSyncNeeded) {
          await this.config.onSyncNeeded(result);
        }
      } catch (error) {
        if (this.config.debug) {
          console.error(`[Webhook] Error processing event ${event.id}:`, error);
        }

        // Retry if under limit
        if (event.retries < this.maxRetries) {
          event.retries++;
          this.eventQueue.push(event);
          await this.delay(this.retryDelayMs * event.retries);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.eventQueue.length,
      processing: this.processing,
    };
  }

  /**
   * Clear the event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }
}

// =============================================================================
// Factory & Utilities
// =============================================================================

/**
 * Create a webhook handler instance
 */
export function createWebhookHandler(config: WebhookHandlerConfig): GitHubWebhookHandler {
  return new GitHubWebhookHandler(config);
}

/**
 * Create webhook handler for Next.js API route
 */
export function createNextApiWebhookHandler(config: WebhookHandlerConfig) {
  const handler = createWebhookHandler(config);

  return async function handleRequest(request: Request): Promise<Response> {
    const body = await request.text();
    const headers: Record<string, string | undefined> = {};

    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await handler.handleWebhook(body, headers);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  };
}

/**
 * Generate webhook URL for configuration
 */
export function generateWebhookUrl(baseUrl: string, path = "/api/github/webhook"): string {
  const url = new URL(path, baseUrl);
  return url.toString();
}

/**
 * Get recommended webhook events to subscribe to
 */
export function getRecommendedWebhookEvents(): WebhookEventType[] {
  return ["push", "pull_request", "create", "delete"];
}
