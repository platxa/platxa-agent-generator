/**
 * PreviewURLGenerator
 *
 * Generates shareable preview links for website projects without full deployment.
 * Creates temporary, secure preview URLs that can be shared with clients/team.
 *
 * Features:
 * - Generate unique, secure preview URLs
 * - Configurable expiration times
 * - Optional password protection
 * - Access tracking and analytics
 * - Revocable links
 * - QR code generation support
 *
 * Feature #81: Deployment - PreviewURLGenerator
 */

// =============================================================================
// Types
// =============================================================================

/** Preview access level */
export type PreviewAccessLevel = "public" | "password" | "token";

/** Preview status */
export type PreviewStatus = "active" | "expired" | "revoked" | "max_views_reached";

/** Preview configuration */
export interface PreviewConfig {
  /** Project ID to preview */
  projectId: string;
  /** Specific page path (optional, defaults to home) */
  pagePath?: string;
  /** Access level */
  accessLevel?: PreviewAccessLevel;
  /** Password for password-protected previews */
  password?: string;
  /** Expiration time in hours (default: 24) */
  expiresInHours?: number;
  /** Maximum number of views (0 = unlimited) */
  maxViews?: number;
  /** Custom slug for the URL */
  customSlug?: string;
  /** Allow comments/feedback */
  allowComments?: boolean;
  /** Show device frame in preview */
  showDeviceFrame?: boolean;
  /** Device to preview (desktop/tablet/mobile) */
  defaultDevice?: "desktop" | "tablet" | "mobile";
}

/** Preview URL data */
export interface PreviewURL {
  id: string;
  url: string;
  shortUrl?: string;
  projectId: string;
  pagePath: string;
  accessLevel: PreviewAccessLevel;
  token: string;
  status: PreviewStatus;
  createdAt: Date;
  expiresAt: Date;
  maxViews: number;
  viewCount: number;
  allowComments: boolean;
  showDeviceFrame: boolean;
  defaultDevice: "desktop" | "tablet" | "mobile";
  createdBy: string;
  lastAccessedAt?: Date;
}

/** Preview access log entry */
export interface PreviewAccessLog {
  id: string;
  previewId: string;
  accessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  device?: string;
  country?: string;
}

/** Preview analytics */
export interface PreviewAnalytics {
  previewId: string;
  totalViews: number;
  uniqueVisitors: number;
  averageViewDuration?: number;
  viewsByDevice: Record<string, number>;
  viewsByCountry: Record<string, number>;
  viewsOverTime: Array<{ date: string; views: number }>;
}

/** Validate preview result */
export interface ValidatePreviewResult {
  valid: boolean;
  preview?: PreviewURL;
  requiresPassword?: boolean;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_MAX_VIEWS = 0; // Unlimited
const TOKEN_LENGTH = 32;
const SLUG_LENGTH = 8;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate secure random token
 */
function generateToken(length: number = TOKEN_LENGTH): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate URL-friendly slug
 */
function generateSlug(length: number = SLUG_LENGTH): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate preview ID
 */
function generatePreviewId(): string {
  return `prev_${Date.now().toString(36)}_${generateSlug(6)}`;
}

/**
 * Hash password (simple hash for demo - use bcrypt in production)
 */
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Detect device from user agent
 */
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "mobile";
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }
  return "desktop";
}

// =============================================================================
// PreviewURLGenerator Class
// =============================================================================

/**
 * Generates and manages shareable preview URLs
 */
export class PreviewURLGenerator {
  private baseUrl: string;
  private previews: Map<string, PreviewURL & { passwordHash?: string }> = new Map();
  private tokenIndex: Map<string, string> = new Map(); // token -> previewId
  private slugIndex: Map<string, string> = new Map(); // slug -> previewId
  private accessLogs: Map<string, PreviewAccessLog[]> = new Map();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Generate a new preview URL
   */
  generatePreviewURL(config: PreviewConfig, createdBy: string): PreviewURL {
    const id = generatePreviewId();
    const token = generateToken();
    const slug = config.customSlug || generateSlug();

    // Check for slug collision
    if (this.slugIndex.has(slug)) {
      throw new Error("Custom slug is already in use");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (config.expiresInHours || DEFAULT_EXPIRY_HOURS));

    const preview: PreviewURL & { passwordHash?: string } = {
      id,
      url: `${this.baseUrl}/preview/${slug}`,
      shortUrl: `${this.baseUrl}/p/${slug}`,
      projectId: config.projectId,
      pagePath: config.pagePath || "/",
      accessLevel: config.accessLevel || "public",
      token,
      status: "active",
      createdAt: new Date(),
      expiresAt,
      maxViews: config.maxViews ?? DEFAULT_MAX_VIEWS,
      viewCount: 0,
      allowComments: config.allowComments ?? false,
      showDeviceFrame: config.showDeviceFrame ?? false,
      defaultDevice: config.defaultDevice || "desktop",
      createdBy,
    };

    // Store password hash if password protected
    if (config.accessLevel === "password" && config.password) {
      preview.passwordHash = hashPassword(config.password);
    }

    // Store preview
    this.previews.set(id, preview);
    this.tokenIndex.set(token, id);
    this.slugIndex.set(slug, id);
    this.accessLogs.set(id, []);

    // Return without password hash
    const { passwordHash: _, ...publicPreview } = preview;
    return publicPreview;
  }

  /**
   * Validate preview access
   */
  validatePreview(slugOrToken: string, password?: string): ValidatePreviewResult {
    // Find preview by slug or token
    let previewId = this.slugIndex.get(slugOrToken);
    if (!previewId) {
      previewId = this.tokenIndex.get(slugOrToken);
    }

    if (!previewId) {
      return { valid: false, error: "Preview not found" };
    }

    const preview = this.previews.get(previewId);
    if (!preview) {
      return { valid: false, error: "Preview not found" };
    }

    // Check status
    if (preview.status === "revoked") {
      return { valid: false, error: "This preview link has been revoked" };
    }

    if (preview.status === "max_views_reached") {
      return { valid: false, error: "Maximum views reached for this preview" };
    }

    // Check expiration
    if (new Date() > preview.expiresAt) {
      preview.status = "expired";
      return { valid: false, error: "This preview link has expired" };
    }

    // Check max views
    if (preview.maxViews > 0 && preview.viewCount >= preview.maxViews) {
      preview.status = "max_views_reached";
      return { valid: false, error: "Maximum views reached for this preview" };
    }

    // Check password
    if (preview.accessLevel === "password") {
      if (!password) {
        const { passwordHash: _, ...publicPreview } = preview;
        return { valid: false, preview: publicPreview, requiresPassword: true };
      }

      if (hashPassword(password) !== preview.passwordHash) {
        return { valid: false, error: "Incorrect password" };
      }
    }

    const { passwordHash: _, ...publicPreview } = preview;
    return { valid: true, preview: publicPreview };
  }

  /**
   * Record preview access
   */
  recordAccess(
    previewId: string,
    accessInfo?: { ipAddress?: string; userAgent?: string; referrer?: string }
  ): boolean {
    const preview = this.previews.get(previewId);
    if (!preview || preview.status !== "active") {
      return false;
    }

    // Increment view count
    preview.viewCount++;
    preview.lastAccessedAt = new Date();

    // Check if max views reached
    if (preview.maxViews > 0 && preview.viewCount >= preview.maxViews) {
      preview.status = "max_views_reached";
    }

    // Log access
    const logs = this.accessLogs.get(previewId) || [];
    logs.push({
      id: `log_${Date.now().toString(36)}`,
      previewId,
      accessedAt: new Date(),
      ipAddress: accessInfo?.ipAddress,
      userAgent: accessInfo?.userAgent,
      referrer: accessInfo?.referrer,
      device: accessInfo?.userAgent ? detectDevice(accessInfo.userAgent) : undefined,
    });
    this.accessLogs.set(previewId, logs);

    return true;
  }

  /**
   * Get preview by ID
   */
  getPreview(previewId: string): PreviewURL | undefined {
    const preview = this.previews.get(previewId);
    if (!preview) return undefined;

    const { passwordHash: _, ...publicPreview } = preview;
    return publicPreview;
  }

  /**
   * Get preview by slug
   */
  getPreviewBySlug(slug: string): PreviewURL | undefined {
    const previewId = this.slugIndex.get(slug);
    if (!previewId) return undefined;
    return this.getPreview(previewId);
  }

  /**
   * Get all previews for a project
   */
  getProjectPreviews(projectId: string): PreviewURL[] {
    const results: PreviewURL[] = [];
    for (const preview of this.previews.values()) {
      if (preview.projectId === projectId) {
        const { passwordHash: _, ...publicPreview } = preview;
        results.push(publicPreview);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all previews created by a user
   */
  getUserPreviews(userId: string): PreviewURL[] {
    const results: PreviewURL[] = [];
    for (const preview of this.previews.values()) {
      if (preview.createdBy === userId) {
        const { passwordHash: _, ...publicPreview } = preview;
        results.push(publicPreview);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Extend preview expiration
   */
  extendExpiration(previewId: string, additionalHours: number): PreviewURL | null {
    const preview = this.previews.get(previewId);
    if (!preview) return null;

    if (preview.status === "revoked") {
      return null;
    }

    // Extend from current expiration or now, whichever is later
    const baseTime = preview.expiresAt > new Date() ? preview.expiresAt : new Date();
    const newExpiry = new Date(baseTime);
    newExpiry.setHours(newExpiry.getHours() + additionalHours);

    preview.expiresAt = newExpiry;
    if (preview.status === "expired") {
      preview.status = "active";
    }

    const { passwordHash: _, ...publicPreview } = preview;
    return publicPreview;
  }

  /**
   * Revoke preview URL
   */
  revokePreview(previewId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;

    preview.status = "revoked";
    return true;
  }

  /**
   * Delete preview permanently
   */
  deletePreview(previewId: string): boolean {
    const preview = this.previews.get(previewId);
    if (!preview) return false;

    // Remove from indexes
    this.tokenIndex.delete(preview.token);
    const slug = preview.url.split("/").pop();
    if (slug) this.slugIndex.delete(slug);

    // Remove preview and logs
    this.previews.delete(previewId);
    this.accessLogs.delete(previewId);

    return true;
  }

  /**
   * Get preview analytics
   */
  getAnalytics(previewId: string): PreviewAnalytics | null {
    const preview = this.previews.get(previewId);
    if (!preview) return null;

    const logs = this.accessLogs.get(previewId) || [];

    // Calculate unique visitors (by IP)
    const uniqueIps = new Set(logs.filter(l => l.ipAddress).map(l => l.ipAddress));

    // Views by device
    const viewsByDevice: Record<string, number> = {};
    for (const log of logs) {
      const device = log.device || "unknown";
      viewsByDevice[device] = (viewsByDevice[device] || 0) + 1;
    }

    // Views by country (placeholder - would need geo IP lookup)
    const viewsByCountry: Record<string, number> = {};
    for (const log of logs) {
      const country = log.country || "Unknown";
      viewsByCountry[country] = (viewsByCountry[country] || 0) + 1;
    }

    // Views over time (last 7 days)
    const viewsOverTime: Array<{ date: string; views: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const views = logs.filter(l => {
        const logDate = l.accessedAt.toISOString().split("T")[0];
        return logDate === dateStr;
      }).length;

      viewsOverTime.push({ date: dateStr, views });
    }

    return {
      previewId,
      totalViews: preview.viewCount,
      uniqueVisitors: uniqueIps.size,
      viewsByDevice,
      viewsByCountry,
      viewsOverTime,
    };
  }

  /**
   * Generate QR code data URL for preview
   */
  generateQRCodeData(previewId: string): string | null {
    const preview = this.previews.get(previewId);
    if (!preview) return null;

    // Return URL that can be used with QR code library
    // In production, use a library like qrcode to generate actual QR code
    return preview.shortUrl || preview.url;
  }

  /**
   * Cleanup expired previews
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [id, preview] of this.previews) {
      if (preview.status === "active" && now > preview.expiresAt) {
        preview.status = "expired";
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get active preview count
   */
  getActiveCount(): number {
    let count = 0;
    for (const preview of this.previews.values()) {
      if (preview.status === "active") {
        count++;
      }
    }
    return count;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let generatorInstance: PreviewURLGenerator | null = null;

/**
 * Get PreviewURLGenerator singleton
 */
export function getPreviewGenerator(baseUrl?: string): PreviewURLGenerator {
  if (!generatorInstance) {
    if (!baseUrl) {
      throw new Error("Base URL required for first initialization");
    }
    generatorInstance = new PreviewURLGenerator(baseUrl);
  }
  return generatorInstance;
}

/**
 * Create new PreviewURLGenerator instance
 */
export function createPreviewGenerator(baseUrl: string): PreviewURLGenerator {
  return new PreviewURLGenerator(baseUrl);
}
