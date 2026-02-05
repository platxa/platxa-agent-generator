/**
 * Project Sharing System
 *
 * Manages project visibility, sharing settings, and access controls.
 * Supports public/private projects with URL-based sharing.
 *
 * Feature #79: Collaboration - Project sharing with visibility settings
 */

// =============================================================================
// Types
// =============================================================================

export type ProjectVisibility = "private" | "team" | "public" | "unlisted";

export type SharePermission = "view" | "comment" | "edit" | "admin";

export interface SharedUser {
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
  /** When sharing was created */
  sharedAt: Date;
  /** Who shared with this user */
  sharedBy: string;
  /** Whether invite is pending */
  pending: boolean;
  /** Invite token (if pending) */
  inviteToken?: string;
  /** Token expiration */
  inviteExpires?: Date;
}

export interface ShareLink {
  /** Unique link ID */
  id: string;
  /** Share token for URL */
  token: string;
  /** Permission level for link users */
  permission: SharePermission;
  /** Optional password protection */
  password?: string;
  /** Expiration date */
  expiresAt?: Date;
  /** Maximum number of uses */
  maxUses?: number;
  /** Current use count */
  useCount: number;
  /** Whether link is active */
  active: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Created by user ID */
  createdBy: string;
  /** Link label/name */
  label?: string;
  /** Allowed email domains */
  allowedDomains?: string[];
}

export interface ProjectSharingSettings {
  /** Project ID */
  projectId: string;
  /** Project visibility */
  visibility: ProjectVisibility;
  /** Project owner */
  ownerId: string;
  /** Users with explicit access */
  sharedWith: SharedUser[];
  /** Active share links */
  shareLinks: ShareLink[];
  /** Allow team members to reshare */
  allowResharing: boolean;
  /** Allow comments from viewers */
  allowComments: boolean;
  /** Allow forking/copying */
  allowForking: boolean;
  /** Require authentication for public */
  requireAuthForPublic: boolean;
  /** Show in public gallery */
  showInGallery: boolean;
  /** SEO settings for public projects */
  seo?: {
    title?: string;
    description?: string;
    image?: string;
  };
  /** Last updated */
  updatedAt: Date;
}

export interface ShareInvite {
  email: string;
  permission: SharePermission;
  message?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  permission: SharePermission | null;
  reason: string;
  requiresAuth: boolean;
}

// =============================================================================
// Project Sharing Manager
// =============================================================================

export class ProjectSharingManager {
  private projects: Map<string, ProjectSharingSettings> = new Map();

  // ---------------------------------------------------------------------------
  // Project Settings
  // ---------------------------------------------------------------------------

  /**
   * Initialize sharing settings for a project
   */
  initializeProject(projectId: string, ownerId: string): ProjectSharingSettings {
    const settings: ProjectSharingSettings = {
      projectId,
      visibility: "private",
      ownerId,
      sharedWith: [],
      shareLinks: [],
      allowResharing: false,
      allowComments: true,
      allowForking: false,
      requireAuthForPublic: false,
      showInGallery: false,
      updatedAt: new Date(),
    };

    this.projects.set(projectId, settings);
    return settings;
  }

  /**
   * Get project sharing settings
   */
  getSettings(projectId: string): ProjectSharingSettings | null {
    return this.projects.get(projectId) || null;
  }

  /**
   * Update project visibility
   */
  setVisibility(
    projectId: string,
    visibility: ProjectVisibility,
    options?: {
      requireAuthForPublic?: boolean;
      showInGallery?: boolean;
      seo?: ProjectSharingSettings["seo"];
    }
  ): ProjectSharingSettings | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    settings.visibility = visibility;
    settings.updatedAt = new Date();

    if (options) {
      if (options.requireAuthForPublic !== undefined) {
        settings.requireAuthForPublic = options.requireAuthForPublic;
      }
      if (options.showInGallery !== undefined) {
        settings.showInGallery = options.showInGallery;
      }
      if (options.seo) {
        settings.seo = { ...settings.seo, ...options.seo };
      }
    }

    return settings;
  }

  /**
   * Update sharing options
   */
  updateOptions(
    projectId: string,
    options: Partial<
      Pick<
        ProjectSharingSettings,
        "allowResharing" | "allowComments" | "allowForking"
      >
    >
  ): ProjectSharingSettings | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    Object.assign(settings, options);
    settings.updatedAt = new Date();

    return settings;
  }

  // ---------------------------------------------------------------------------
  // User Sharing
  // ---------------------------------------------------------------------------

  /**
   * Share project with specific users
   */
  shareWithUsers(
    projectId: string,
    invites: ShareInvite[],
    sharedBy: string
  ): SharedUser[] {
    const settings = this.projects.get(projectId);
    if (!settings) return [];

    const newUsers: SharedUser[] = [];

    for (const invite of invites) {
      // Check if already shared
      const existing = settings.sharedWith.find(
        (u) => u.email.toLowerCase() === invite.email.toLowerCase()
      );

      if (existing) {
        // Update permission if needed
        existing.permission = invite.permission;
        newUsers.push(existing);
        continue;
      }

      // Create new shared user
      const sharedUser: SharedUser = {
        userId: "", // Will be filled when user accepts
        email: invite.email,
        name: invite.email.split("@")[0], // Placeholder
        permission: invite.permission,
        sharedAt: new Date(),
        sharedBy,
        pending: true,
        inviteToken: generateToken(),
        inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      settings.sharedWith.push(sharedUser);
      newUsers.push(sharedUser);
    }

    settings.updatedAt = new Date();
    return newUsers;
  }

  /**
   * Accept a share invitation
   */
  acceptInvite(
    projectId: string,
    inviteToken: string,
    userId: string,
    userName: string,
    avatar?: string
  ): SharedUser | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    const user = settings.sharedWith.find(
      (u) => u.inviteToken === inviteToken && u.pending
    );

    if (!user) return null;

    // Check expiration
    if (user.inviteExpires && user.inviteExpires < new Date()) {
      return null;
    }

    // Update user
    user.userId = userId;
    user.name = userName;
    user.avatar = avatar;
    user.pending = false;
    user.inviteToken = undefined;
    user.inviteExpires = undefined;

    settings.updatedAt = new Date();
    return user;
  }

  /**
   * Update user permission
   */
  updateUserPermission(
    projectId: string,
    userId: string,
    permission: SharePermission
  ): boolean {
    const settings = this.projects.get(projectId);
    if (!settings) return false;

    const user = settings.sharedWith.find((u) => u.userId === userId);
    if (!user) return false;

    user.permission = permission;
    settings.updatedAt = new Date();
    return true;
  }

  /**
   * Remove user access
   */
  removeUser(projectId: string, userId: string): boolean {
    const settings = this.projects.get(projectId);
    if (!settings) return false;

    const index = settings.sharedWith.findIndex((u) => u.userId === userId);
    if (index === -1) return false;

    settings.sharedWith.splice(index, 1);
    settings.updatedAt = new Date();
    return true;
  }

  /**
   * Get all users with access
   */
  getSharedUsers(projectId: string): SharedUser[] {
    const settings = this.projects.get(projectId);
    return settings?.sharedWith || [];
  }

  // ---------------------------------------------------------------------------
  // Share Links
  // ---------------------------------------------------------------------------

  /**
   * Create a share link
   */
  createShareLink(
    projectId: string,
    createdBy: string,
    options?: {
      permission?: SharePermission;
      password?: string;
      expiresIn?: number; // milliseconds
      maxUses?: number;
      label?: string;
      allowedDomains?: string[];
    }
  ): ShareLink | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    const link: ShareLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      token: generateToken(32),
      permission: options?.permission || "view",
      password: options?.password,
      expiresAt: options?.expiresIn
        ? new Date(Date.now() + options.expiresIn)
        : undefined,
      maxUses: options?.maxUses,
      useCount: 0,
      active: true,
      createdAt: new Date(),
      createdBy,
      label: options?.label,
      allowedDomains: options?.allowedDomains,
    };

    settings.shareLinks.push(link);
    settings.updatedAt = new Date();
    return link;
  }

  /**
   * Get share link by token
   */
  getShareLink(projectId: string, token: string): ShareLink | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    return settings.shareLinks.find((l) => l.token === token) || null;
  }

  /**
   * Validate and use a share link
   */
  useShareLink(
    projectId: string,
    token: string,
    password?: string,
    userEmail?: string
  ): { valid: boolean; permission: SharePermission | null; error?: string } {
    const link = this.getShareLink(projectId, token);

    if (!link) {
      return { valid: false, permission: null, error: "Link not found" };
    }

    if (!link.active) {
      return { valid: false, permission: null, error: "Link is disabled" };
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return { valid: false, permission: null, error: "Link has expired" };
    }

    if (link.maxUses && link.useCount >= link.maxUses) {
      return { valid: false, permission: null, error: "Link usage limit reached" };
    }

    if (link.password && link.password !== password) {
      return { valid: false, permission: null, error: "Invalid password" };
    }

    if (link.allowedDomains && link.allowedDomains.length > 0 && userEmail) {
      const domain = userEmail.split("@")[1];
      if (!link.allowedDomains.includes(domain)) {
        return { valid: false, permission: null, error: "Email domain not allowed" };
      }
    }

    // Increment use count
    link.useCount++;

    return { valid: true, permission: link.permission };
  }

  /**
   * Update share link
   */
  updateShareLink(
    projectId: string,
    linkId: string,
    updates: Partial<Pick<ShareLink, "active" | "permission" | "label" | "maxUses">>
  ): ShareLink | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    const link = settings.shareLinks.find((l) => l.id === linkId);
    if (!link) return null;

    Object.assign(link, updates);
    settings.updatedAt = new Date();
    return link;
  }

  /**
   * Delete share link
   */
  deleteShareLink(projectId: string, linkId: string): boolean {
    const settings = this.projects.get(projectId);
    if (!settings) return false;

    const index = settings.shareLinks.findIndex((l) => l.id === linkId);
    if (index === -1) return false;

    settings.shareLinks.splice(index, 1);
    settings.updatedAt = new Date();
    return true;
  }

  /**
   * Get all share links
   */
  getShareLinks(projectId: string): ShareLink[] {
    const settings = this.projects.get(projectId);
    return settings?.shareLinks || [];
  }

  // ---------------------------------------------------------------------------
  // Access Control
  // ---------------------------------------------------------------------------

  /**
   * Check if a user has access to a project
   */
  checkAccess(
    projectId: string,
    userId?: string,
    userEmail?: string,
    shareToken?: string
  ): AccessCheckResult {
    const settings = this.projects.get(projectId);

    if (!settings) {
      return {
        allowed: false,
        permission: null,
        reason: "Project not found",
        requiresAuth: false,
      };
    }

    // Owner always has full access
    if (userId && userId === settings.ownerId) {
      return {
        allowed: true,
        permission: "admin",
        reason: "Project owner",
        requiresAuth: false,
      };
    }

    // Check explicit user sharing
    if (userId) {
      const sharedUser = settings.sharedWith.find(
        (u) => u.userId === userId && !u.pending
      );
      if (sharedUser) {
        return {
          allowed: true,
          permission: sharedUser.permission,
          reason: "Explicitly shared",
          requiresAuth: false,
        };
      }
    }

    // Check share token
    if (shareToken) {
      const linkResult = this.useShareLink(projectId, shareToken, undefined, userEmail);
      if (linkResult.valid) {
        return {
          allowed: true,
          permission: linkResult.permission,
          reason: "Valid share link",
          requiresAuth: false,
        };
      }
    }

    // Check visibility-based access
    switch (settings.visibility) {
      case "public":
        if (settings.requireAuthForPublic && !userId) {
          return {
            allowed: false,
            permission: "view",
            reason: "Authentication required",
            requiresAuth: true,
          };
        }
        return {
          allowed: true,
          permission: "view",
          reason: "Public project",
          requiresAuth: false,
        };

      case "unlisted":
        // Unlisted requires share link or explicit access
        return {
          allowed: false,
          permission: null,
          reason: "Share link required",
          requiresAuth: false,
        };

      case "team":
        // Would check team membership here
        return {
          allowed: false,
          permission: null,
          reason: "Team membership required",
          requiresAuth: true,
        };

      case "private":
      default:
        return {
          allowed: false,
          permission: null,
          reason: "Private project",
          requiresAuth: true,
        };
    }
  }

  /**
   * Get public URL for a project
   */
  getPublicUrl(projectId: string, baseUrl: string): string | null {
    const settings = this.projects.get(projectId);
    if (!settings) return null;

    if (settings.visibility === "public" || settings.visibility === "unlisted") {
      return `${baseUrl}/p/${projectId}`;
    }

    // Generate share link URL for private projects
    const activeLink = settings.shareLinks.find((l) => l.active);
    if (activeLink) {
      return `${baseUrl}/share/${activeLink.token}`;
    }

    return null;
  }

  /**
   * Get projects visible in public gallery
   */
  getGalleryProjects(): ProjectSharingSettings[] {
    return Array.from(this.projects.values()).filter(
      (p) => p.visibility === "public" && p.showInGallery
    );
  }
}

// =============================================================================
// Utilities
// =============================================================================

function generateToken(length: number = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if a permission level includes another
 */
export function permissionIncludes(
  userPermission: SharePermission,
  requiredPermission: SharePermission
): boolean {
  const levels: Record<SharePermission, number> = {
    view: 0,
    comment: 1,
    edit: 2,
    admin: 3,
  };
  return levels[userPermission] >= levels[requiredPermission];
}

/**
 * Get permission description
 */
export function getPermissionDescription(permission: SharePermission): string {
  const descriptions: Record<SharePermission, string> = {
    view: "Can view the project",
    comment: "Can view and comment",
    edit: "Can view, comment, and edit",
    admin: "Full access including sharing settings",
  };
  return descriptions[permission];
}

// =============================================================================
// Singleton
// =============================================================================

let sharingManager: ProjectSharingManager | null = null;

/**
 * Get the singleton ProjectSharingManager instance
 */
export function getProjectSharingManager(): ProjectSharingManager {
  if (!sharingManager) {
    sharingManager = new ProjectSharingManager();
  }
  return sharingManager;
}

/**
 * Create a new ProjectSharingManager instance
 */
export function createProjectSharingManager(): ProjectSharingManager {
  return new ProjectSharingManager();
}

// =============================================================================
// Export
// =============================================================================

export default ProjectSharingManager;
