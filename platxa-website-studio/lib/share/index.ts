/**
 * Share and Embed System
 *
 * Provides sharing, embedding, and collaboration features
 * for Platxa themes and projects.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SharePermission = "view" | "comment" | "edit" | "admin";
export type ShareVisibility = "private" | "unlisted" | "public";
export type EmbedType = "preview" | "full" | "snippet" | "component";

export interface ShareLink {
  /** Unique share ID */
  id: string;
  /** Project/theme ID */
  projectId: string;
  /** Share URL token */
  token: string;
  /** Permission level */
  permission: SharePermission;
  /** Visibility setting */
  visibility: ShareVisibility;
  /** Expiration date (optional) */
  expiresAt?: Date;
  /** Max uses (optional) */
  maxUses?: number;
  /** Current use count */
  useCount: number;
  /** Created by user ID */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Optional password protection */
  hasPassword: boolean;
  /** Optional custom slug */
  customSlug?: string;
  /** Is link active */
  isActive: boolean;
}

export interface ShareInvite {
  /** Invite ID */
  id: string;
  /** Project ID */
  projectId: string;
  /** Invitee email */
  email: string;
  /** Permission level */
  permission: SharePermission;
  /** Invite status */
  status: "pending" | "accepted" | "declined" | "expired";
  /** Invited by user ID */
  invitedBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration date */
  expiresAt: Date;
  /** Personal message */
  message?: string;
}

export interface EmbedConfig {
  /** Embed type */
  type: EmbedType;
  /** Width (px or %) */
  width: string;
  /** Height (px or %) */
  height: string;
  /** Show header/branding */
  showHeader: boolean;
  /** Allow interaction */
  interactive: boolean;
  /** Custom theme colors */
  theme?: {
    background: string;
    foreground: string;
    accent: string;
  };
  /** Specific components to show */
  components?: string[];
  /** Responsive breakpoints */
  responsive: boolean;
}

export interface EmbedCode {
  /** HTML iframe code */
  iframe: string;
  /** JavaScript widget code */
  script: string;
  /** Direct URL */
  url: string;
  /** React component code */
  react: string;
  /** Vue component code */
  vue: string;
}

export interface SocialShareData {
  /** Share title */
  title: string;
  /** Share description */
  description: string;
  /** Share URL */
  url: string;
  /** Preview image URL */
  imageUrl?: string;
  /** Hashtags */
  hashtags?: string[];
}

export interface Collaborator {
  /** User ID */
  userId: string;
  /** User email */
  email: string;
  /** User name */
  name: string;
  /** Avatar URL */
  avatar?: string;
  /** Permission level */
  permission: SharePermission;
  /** Join date */
  joinedAt: Date;
  /** Last active */
  lastActiveAt?: Date;
  /** Is currently online */
  isOnline?: boolean;
}

// =============================================================================
// SHARE MANAGER
// =============================================================================

/**
 * Share manager for links, invites, and embeds
 */
export class ShareManager {
  private baseUrl: string;
  private links: Map<string, ShareLink> = new Map();
  private invites: Map<string, ShareInvite> = new Map();
  private collaborators: Map<string, Collaborator[]> = new Map();

  constructor(baseUrl: string = "https://platxa.studio") {
    this.baseUrl = baseUrl;
  }

  // ===========================================================================
  // SHARE LINKS
  // ===========================================================================

  /**
   * Create a share link
   */
  createShareLink(options: {
    projectId: string;
    permission: SharePermission;
    visibility?: ShareVisibility;
    expiresAt?: Date;
    maxUses?: number;
    customSlug?: string;
    createdBy: string;
  }): ShareLink {
    const link: ShareLink = {
      id: this.generateId(),
      projectId: options.projectId,
      token: this.generateToken(),
      permission: options.permission,
      visibility: options.visibility || "unlisted",
      expiresAt: options.expiresAt,
      maxUses: options.maxUses,
      useCount: 0,
      createdBy: options.createdBy,
      createdAt: new Date(),
      hasPassword: false,
      customSlug: options.customSlug,
      isActive: true,
    };

    this.links.set(link.id, link);
    return link;
  }

  /**
   * Get share link URL
   */
  getShareUrl(link: ShareLink): string {
    const slug = link.customSlug || link.token;
    return `${this.baseUrl}/share/${slug}`;
  }

  /**
   * Validate and use a share link
   */
  useShareLink(token: string): { valid: boolean; link?: ShareLink; error?: string } {
    const link = Array.from(this.links.values()).find(
      (l) => l.token === token || l.customSlug === token
    );

    if (!link) {
      return { valid: false, error: "Share link not found" };
    }

    if (!link.isActive) {
      return { valid: false, error: "Share link is no longer active" };
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return { valid: false, error: "Share link has expired" };
    }

    if (link.maxUses && link.useCount >= link.maxUses) {
      return { valid: false, error: "Share link has reached maximum uses" };
    }

    // Increment use count
    link.useCount++;

    return { valid: true, link };
  }

  /**
   * Revoke a share link
   */
  revokeShareLink(linkId: string): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;

    link.isActive = false;
    return true;
  }

  /**
   * Get all share links for a project
   */
  getProjectLinks(projectId: string): ShareLink[] {
    return Array.from(this.links.values()).filter(
      (l) => l.projectId === projectId
    );
  }

  /**
   * Update share link settings
   */
  updateShareLink(
    linkId: string,
    updates: Partial<Pick<ShareLink, "permission" | "expiresAt" | "maxUses" | "isActive">>
  ): ShareLink | null {
    const link = this.links.get(linkId);
    if (!link) return null;

    Object.assign(link, updates);
    return link;
  }

  // ===========================================================================
  // INVITES
  // ===========================================================================

  /**
   * Send a collaboration invite
   */
  sendInvite(options: {
    projectId: string;
    email: string;
    permission: SharePermission;
    invitedBy: string;
    message?: string;
    expiresInDays?: number;
  }): ShareInvite {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || 7));

    const invite: ShareInvite = {
      id: this.generateId(),
      projectId: options.projectId,
      email: options.email,
      permission: options.permission,
      status: "pending",
      invitedBy: options.invitedBy,
      createdAt: new Date(),
      expiresAt,
      message: options.message,
    };

    this.invites.set(invite.id, invite);
    return invite;
  }

  /**
   * Accept an invite
   */
  acceptInvite(inviteId: string, userId: string): { success: boolean; error?: string } {
    const invite = this.invites.get(inviteId);

    if (!invite) {
      return { success: false, error: "Invite not found" };
    }

    if (invite.status !== "pending") {
      return { success: false, error: "Invite has already been processed" };
    }

    if (new Date() > invite.expiresAt) {
      invite.status = "expired";
      return { success: false, error: "Invite has expired" };
    }

    invite.status = "accepted";

    // Add as collaborator
    this.addCollaborator(invite.projectId, {
      userId,
      email: invite.email,
      name: invite.email.split("@")[0],
      permission: invite.permission,
      joinedAt: new Date(),
    });

    return { success: true };
  }

  /**
   * Decline an invite
   */
  declineInvite(inviteId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.status !== "pending") return false;

    invite.status = "declined";
    return true;
  }

  /**
   * Get pending invites for a project
   */
  getPendingInvites(projectId: string): ShareInvite[] {
    return Array.from(this.invites.values()).filter(
      (i) => i.projectId === projectId && i.status === "pending"
    );
  }

  // ===========================================================================
  // COLLABORATORS
  // ===========================================================================

  /**
   * Add a collaborator
   */
  addCollaborator(
    projectId: string,
    collaborator: Omit<Collaborator, "lastActiveAt" | "isOnline">
  ): Collaborator {
    const projectCollabs = this.collaborators.get(projectId) || [];
    const fullCollab: Collaborator = {
      ...collaborator,
      lastActiveAt: new Date(),
      isOnline: false,
    };

    projectCollabs.push(fullCollab);
    this.collaborators.set(projectId, projectCollabs);

    return fullCollab;
  }

  /**
   * Remove a collaborator
   */
  removeCollaborator(projectId: string, userId: string): boolean {
    const projectCollabs = this.collaborators.get(projectId);
    if (!projectCollabs) return false;

    const index = projectCollabs.findIndex((c) => c.userId === userId);
    if (index === -1) return false;

    projectCollabs.splice(index, 1);
    return true;
  }

  /**
   * Update collaborator permission
   */
  updateCollaboratorPermission(
    projectId: string,
    userId: string,
    permission: SharePermission
  ): boolean {
    const projectCollabs = this.collaborators.get(projectId);
    if (!projectCollabs) return false;

    const collab = projectCollabs.find((c) => c.userId === userId);
    if (!collab) return false;

    collab.permission = permission;
    return true;
  }

  /**
   * Get all collaborators for a project
   */
  getCollaborators(projectId: string): Collaborator[] {
    return this.collaborators.get(projectId) || [];
  }

  /**
   * Update collaborator online status
   */
  setOnlineStatus(projectId: string, userId: string, isOnline: boolean): void {
    const projectCollabs = this.collaborators.get(projectId);
    if (!projectCollabs) return;

    const collab = projectCollabs.find((c) => c.userId === userId);
    if (collab) {
      collab.isOnline = isOnline;
      collab.lastActiveAt = new Date();
    }
  }

  // ===========================================================================
  // EMBED GENERATION
  // ===========================================================================

  /**
   * Generate embed code
   */
  generateEmbedCode(
    projectId: string,
    shareToken: string,
    config: EmbedConfig
  ): EmbedCode {
    const embedUrl = `${this.baseUrl}/embed/${shareToken}`;
    const params = new URLSearchParams({
      type: config.type,
      header: config.showHeader ? "1" : "0",
      interactive: config.interactive ? "1" : "0",
      responsive: config.responsive ? "1" : "0",
    });

    if (config.components?.length) {
      params.set("components", config.components.join(","));
    }

    const fullUrl = `${embedUrl}?${params.toString()}`;

    return {
      url: fullUrl,

      iframe: `<iframe
  src="${fullUrl}"
  width="${config.width}"
  height="${config.height}"
  frameborder="0"
  allow="clipboard-write"
  loading="lazy"
  title="Platxa Theme Preview"
></iframe>`,

      script: `<div id="platxa-embed-${projectId}"></div>
<script src="${this.baseUrl}/embed.js"></script>
<script>
  PlatxaEmbed.init({
    container: '#platxa-embed-${projectId}',
    token: '${shareToken}',
    type: '${config.type}',
    width: '${config.width}',
    height: '${config.height}',
    showHeader: ${config.showHeader},
    interactive: ${config.interactive}
  });
</script>`,

      react: `import { PlatxaEmbed } from '@platxa/react-embed';

export function ThemePreview() {
  return (
    <PlatxaEmbed
      token="${shareToken}"
      type="${config.type}"
      width="${config.width}"
      height="${config.height}"
      showHeader={${config.showHeader}}
      interactive={${config.interactive}}
    />
  );
}`,

      vue: `<template>
  <PlatxaEmbed
    token="${shareToken}"
    type="${config.type}"
    width="${config.width}"
    height="${config.height}"
    :show-header="${config.showHeader}"
    :interactive="${config.interactive}"
  />
</template>

<script setup>
import { PlatxaEmbed } from '@platxa/vue-embed';
</script>`,
    };
  }

  /**
   * Get default embed config
   */
  getDefaultEmbedConfig(): EmbedConfig {
    return {
      type: "preview",
      width: "100%",
      height: "600px",
      showHeader: true,
      interactive: true,
      responsive: true,
    };
  }

  // ===========================================================================
  // SOCIAL SHARING
  // ===========================================================================

  /**
   * Generate social share URLs
   */
  generateSocialShareUrls(data: SocialShareData): Record<string, string> {
    const encodedUrl = encodeURIComponent(data.url);
    const encodedTitle = encodeURIComponent(data.title);
    const encodedDesc = encodeURIComponent(data.description);
    const hashtags = data.hashtags?.join(",") || "";

    return {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      pinterest: data.imageUrl
        ? `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodeURIComponent(data.imageUrl)}&description=${encodedDesc}`
        : "",
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      hackernews: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    };
  }

  /**
   * Generate Open Graph meta tags
   */
  generateOGTags(data: SocialShareData): string {
    const tags = [
      `<meta property="og:title" content="${this.escapeHtml(data.title)}" />`,
      `<meta property="og:description" content="${this.escapeHtml(data.description)}" />`,
      `<meta property="og:url" content="${data.url}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${this.escapeHtml(data.title)}" />`,
      `<meta name="twitter:description" content="${this.escapeHtml(data.description)}" />`,
    ];

    if (data.imageUrl) {
      tags.push(`<meta property="og:image" content="${data.imageUrl}" />`);
      tags.push(`<meta name="twitter:image" content="${data.imageUrl}" />`);
    }

    return tags.join("\n");
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private generateId(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// =============================================================================
// CLIPBOARD UTILITIES
// =============================================================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy rich content (HTML) to clipboard
 */
export async function copyRichContent(html: string, plainText: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return copyToClipboard(plainText);
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    return copyToClipboard(plainText);
  }
}

// =============================================================================
// SHARE URL UTILITIES
// =============================================================================

/**
 * Generate a short share URL
 */
export function generateShortUrl(longUrl: string, customSlug?: string): string {
  // In production, this would call a URL shortening service
  const slug = customSlug || Math.random().toString(36).substring(2, 8);
  return `https://pltx.io/${slug}`;
}

/**
 * Parse share URL parameters
 */
export function parseShareUrl(url: string): {
  token?: string;
  permission?: SharePermission;
  embed?: boolean;
} {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    return {
      token: pathParts[1],
      permission: parsed.searchParams.get("p") as SharePermission | undefined,
      embed: parsed.searchParams.has("embed"),
    };
  } catch {
    return {};
  }
}

// =============================================================================
// QR CODE GENERATION (Simple SVG-based)
// =============================================================================

/**
 * Generate a simple QR code SVG for sharing
 * Note: For production, use a proper QR library
 */
export function generateShareQRCode(url: string, size: number = 200): string {
  // This is a placeholder - in production use qrcode library
  const dataUrl = encodeURIComponent(url);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect fill="#ffffff" width="${size}" height="${size}"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" font-family="monospace" font-size="10">
      QR: ${url.substring(0, 20)}...
    </text>
    <text x="${size / 2}" y="${size / 2 + 15}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#666">
      (Use qrcode library)
    </text>
  </svg>`;
}
