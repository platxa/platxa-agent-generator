/**
 * Role-Based Permission System
 *
 * Implements role-based access control (RBAC) for workspace collaboration.
 * Defines permissions for Owner, Admin, Editor, and Viewer roles.
 *
 * Features:
 * - Granular permission definitions
 * - Role hierarchy with inheritance
 * - Resource-level permission checks
 * - Permission caching for performance
 * - Audit logging support
 *
 * Feature #72: Collaboration - Role-Based Permission System
 */

// =============================================================================
// Types
// =============================================================================

/** Available roles in the system */
export type Role = "owner" | "admin" | "editor" | "viewer";

/** Permission actions */
export type PermissionAction =
  // Workspace permissions
  | "workspace:read"
  | "workspace:update"
  | "workspace:delete"
  | "workspace:manage_settings"
  | "workspace:manage_billing"
  // Member permissions
  | "member:invite"
  | "member:remove"
  | "member:update_role"
  | "member:view"
  // Project permissions
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "project:archive"
  | "project:publish"
  | "project:export"
  // Page permissions
  | "page:create"
  | "page:read"
  | "page:update"
  | "page:delete"
  | "page:publish"
  // Component permissions
  | "component:create"
  | "component:read"
  | "component:update"
  | "component:delete"
  // Asset permissions
  | "asset:upload"
  | "asset:read"
  | "asset:update"
  | "asset:delete"
  // Theme permissions
  | "theme:read"
  | "theme:update"
  | "theme:apply"
  // History permissions
  | "history:view"
  | "history:restore"
  // Comment permissions
  | "comment:create"
  | "comment:read"
  | "comment:update"
  | "comment:delete"
  | "comment:resolve";

/** Resource types */
export type ResourceType =
  | "workspace"
  | "member"
  | "project"
  | "page"
  | "component"
  | "asset"
  | "theme"
  | "history"
  | "comment";

/** Permission check context */
export interface PermissionContext {
  userId: string;
  role: Role;
  workspaceId: string;
  resourceType?: ResourceType;
  resourceId?: string;
  resourceOwnerId?: string;
}

/** Permission check result */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: Role;
}

/** Permission definition */
export interface PermissionDefinition {
  action: PermissionAction;
  allowedRoles: Role[];
  description: string;
  resourceType: ResourceType;
  ownerOverride?: boolean; // Resource owner can always perform this action
}

/** Role definition */
export interface RoleDefinition {
  role: Role;
  displayName: string;
  description: string;
  level: number; // Higher = more permissions
  inheritsFrom?: Role;
}

// =============================================================================
// Role Definitions
// =============================================================================

/** Role hierarchy and definitions */
export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  viewer: {
    role: "viewer",
    displayName: "Viewer",
    description: "Can view projects and pages but cannot make changes",
    level: 1,
  },
  editor: {
    role: "editor",
    displayName: "Editor",
    description: "Can create and edit projects, pages, and components",
    level: 2,
    inheritsFrom: "viewer",
  },
  admin: {
    role: "admin",
    displayName: "Admin",
    description: "Can manage workspace members and settings",
    level: 3,
    inheritsFrom: "editor",
  },
  owner: {
    role: "owner",
    displayName: "Owner",
    description: "Full control over the workspace including billing and deletion",
    level: 4,
    inheritsFrom: "admin",
  },
};

// =============================================================================
// Permission Definitions
// =============================================================================

/** All permission definitions */
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Workspace permissions
  {
    action: "workspace:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View workspace details",
    resourceType: "workspace",
  },
  {
    action: "workspace:update",
    allowedRoles: ["admin", "owner"],
    description: "Update workspace name, description, logo",
    resourceType: "workspace",
  },
  {
    action: "workspace:delete",
    allowedRoles: ["owner"],
    description: "Delete the workspace",
    resourceType: "workspace",
  },
  {
    action: "workspace:manage_settings",
    allowedRoles: ["admin", "owner"],
    description: "Manage workspace settings",
    resourceType: "workspace",
  },
  {
    action: "workspace:manage_billing",
    allowedRoles: ["owner"],
    description: "Manage billing and subscription",
    resourceType: "workspace",
  },

  // Member permissions
  {
    action: "member:view",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View workspace members",
    resourceType: "member",
  },
  {
    action: "member:invite",
    allowedRoles: ["admin", "owner"],
    description: "Invite new members to workspace",
    resourceType: "member",
  },
  {
    action: "member:remove",
    allowedRoles: ["admin", "owner"],
    description: "Remove members from workspace",
    resourceType: "member",
  },
  {
    action: "member:update_role",
    allowedRoles: ["admin", "owner"],
    description: "Change member roles",
    resourceType: "member",
  },

  // Project permissions
  {
    action: "project:create",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Create new projects",
    resourceType: "project",
  },
  {
    action: "project:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View project details",
    resourceType: "project",
  },
  {
    action: "project:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Update project settings",
    resourceType: "project",
    ownerOverride: true,
  },
  {
    action: "project:delete",
    allowedRoles: ["admin", "owner"],
    description: "Delete projects",
    resourceType: "project",
    ownerOverride: true,
  },
  {
    action: "project:archive",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Archive/unarchive projects",
    resourceType: "project",
    ownerOverride: true,
  },
  {
    action: "project:publish",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Publish project to production",
    resourceType: "project",
  },
  {
    action: "project:export",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Export project files",
    resourceType: "project",
  },

  // Page permissions
  {
    action: "page:create",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Create new pages",
    resourceType: "page",
  },
  {
    action: "page:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View page content",
    resourceType: "page",
  },
  {
    action: "page:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Edit page content",
    resourceType: "page",
  },
  {
    action: "page:delete",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Delete pages",
    resourceType: "page",
  },
  {
    action: "page:publish",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Publish page changes",
    resourceType: "page",
  },

  // Component permissions
  {
    action: "component:create",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Create custom components",
    resourceType: "component",
  },
  {
    action: "component:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View component details",
    resourceType: "component",
  },
  {
    action: "component:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Update component code",
    resourceType: "component",
  },
  {
    action: "component:delete",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Delete components",
    resourceType: "component",
  },

  // Asset permissions
  {
    action: "asset:upload",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Upload images and files",
    resourceType: "asset",
  },
  {
    action: "asset:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View and download assets",
    resourceType: "asset",
  },
  {
    action: "asset:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Update asset metadata",
    resourceType: "asset",
  },
  {
    action: "asset:delete",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Delete assets",
    resourceType: "asset",
  },

  // Theme permissions
  {
    action: "theme:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View theme settings",
    resourceType: "theme",
  },
  {
    action: "theme:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Modify theme customizations",
    resourceType: "theme",
  },
  {
    action: "theme:apply",
    allowedRoles: ["admin", "owner"],
    description: "Apply theme to project",
    resourceType: "theme",
  },

  // History permissions
  {
    action: "history:view",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View change history",
    resourceType: "history",
  },
  {
    action: "history:restore",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Restore previous versions",
    resourceType: "history",
  },

  // Comment permissions
  {
    action: "comment:create",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "Add comments",
    resourceType: "comment",
  },
  {
    action: "comment:read",
    allowedRoles: ["viewer", "editor", "admin", "owner"],
    description: "View comments",
    resourceType: "comment",
  },
  {
    action: "comment:update",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Edit comments",
    resourceType: "comment",
    ownerOverride: true,
  },
  {
    action: "comment:delete",
    allowedRoles: ["admin", "owner"],
    description: "Delete comments",
    resourceType: "comment",
    ownerOverride: true,
  },
  {
    action: "comment:resolve",
    allowedRoles: ["editor", "admin", "owner"],
    description: "Resolve/unresolve comments",
    resourceType: "comment",
  },
];

// =============================================================================
// Permission Checker Class
// =============================================================================

/**
 * Permission checker for role-based access control
 */
export class PermissionChecker {
  private permissionMap: Map<PermissionAction, PermissionDefinition>;
  private cache: Map<string, PermissionResult> = new Map();
  private cacheEnabled: boolean;
  private auditCallback?: (context: PermissionContext, action: PermissionAction, result: PermissionResult) => void;

  constructor(options?: {
    enableCache?: boolean;
    auditCallback?: (context: PermissionContext, action: PermissionAction, result: PermissionResult) => void;
  }) {
    this.permissionMap = new Map();
    this.cacheEnabled = options?.enableCache ?? true;
    this.auditCallback = options?.auditCallback;

    // Build permission map
    for (const def of PERMISSION_DEFINITIONS) {
      this.permissionMap.set(def.action, def);
    }
  }

  /**
   * Check if a role has permission to perform an action
   */
  check(context: PermissionContext, action: PermissionAction): PermissionResult {
    // Check cache
    const cacheKey = this.getCacheKey(context, action);
    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const result = this.performCheck(context, action);

    // Cache result
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    // Audit log
    if (this.auditCallback) {
      this.auditCallback(context, action, result);
    }

    return result;
  }

  /**
   * Check multiple permissions at once
   */
  checkAll(context: PermissionContext, actions: PermissionAction[]): Map<PermissionAction, PermissionResult> {
    const results = new Map<PermissionAction, PermissionResult>();
    for (const action of actions) {
      results.set(action, this.check(context, action));
    }
    return results;
  }

  /**
   * Check if role has any of the specified permissions
   */
  checkAny(context: PermissionContext, actions: PermissionAction[]): boolean {
    return actions.some(action => this.check(context, action).allowed);
  }

  /**
   * Get all permissions for a role
   */
  getPermissionsForRole(role: Role): PermissionAction[] {
    const permissions: PermissionAction[] = [];
    const roleLevel = ROLE_DEFINITIONS[role].level;

    for (const def of PERMISSION_DEFINITIONS) {
      const minRoleLevel = Math.min(
        ...def.allowedRoles.map(r => ROLE_DEFINITIONS[r].level)
      );
      if (roleLevel >= minRoleLevel) {
        permissions.push(def.action);
      }
    }

    return permissions;
  }

  /**
   * Get all actions for a resource type
   */
  getActionsForResource(resourceType: ResourceType): PermissionAction[] {
    return PERMISSION_DEFINITIONS
      .filter(def => def.resourceType === resourceType)
      .map(def => def.action);
  }

  /**
   * Compare two roles
   */
  compareRoles(role1: Role, role2: Role): number {
    return ROLE_DEFINITIONS[role1].level - ROLE_DEFINITIONS[role2].level;
  }

  /**
   * Check if role1 is higher or equal to role2
   */
  isRoleAtLeast(role: Role, minimumRole: Role): boolean {
    return ROLE_DEFINITIONS[role].level >= ROLE_DEFINITIONS[minimumRole].level;
  }

  /**
   * Get minimum role required for an action
   */
  getMinimumRole(action: PermissionAction): Role | undefined {
    const def = this.permissionMap.get(action);
    if (!def) return undefined;

    let minLevel = Infinity;
    let minRole: Role | undefined;

    for (const role of def.allowedRoles) {
      const level = ROLE_DEFINITIONS[role].level;
      if (level < minLevel) {
        minLevel = level;
        minRole = role;
      }
    }

    return minRole;
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private performCheck(context: PermissionContext, action: PermissionAction): PermissionResult {
    const def = this.permissionMap.get(action);

    if (!def) {
      return {
        allowed: false,
        reason: `Unknown permission action: ${action}`,
      };
    }

    // Check if resource owner override applies
    if (def.ownerOverride && context.resourceOwnerId === context.userId) {
      return { allowed: true, reason: "Resource owner" };
    }

    // Check role hierarchy
    const userRoleLevel = ROLE_DEFINITIONS[context.role].level;
    const minRequiredLevel = Math.min(
      ...def.allowedRoles.map(r => ROLE_DEFINITIONS[r].level)
    );

    if (userRoleLevel >= minRequiredLevel) {
      return { allowed: true };
    }

    // Find minimum required role for error message
    const minRole = this.getMinimumRole(action);

    return {
      allowed: false,
      reason: `Insufficient permissions. Requires at least ${minRole} role.`,
      requiredRole: minRole,
    };
  }

  private getCacheKey(context: PermissionContext, action: PermissionAction): string {
    return `${context.userId}:${context.workspaceId}:${context.role}:${action}:${context.resourceOwnerId || ""}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let defaultChecker: PermissionChecker | null = null;

/**
 * Get default permission checker instance
 */
export function getPermissionChecker(): PermissionChecker {
  if (!defaultChecker) {
    defaultChecker = new PermissionChecker();
  }
  return defaultChecker;
}

/**
 * Create new permission checker instance
 */
export function createPermissionChecker(options?: {
  enableCache?: boolean;
  auditCallback?: (context: PermissionContext, action: PermissionAction, result: PermissionResult) => void;
}): PermissionChecker {
  return new PermissionChecker(options);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Quick permission check utility
 */
export function canPerform(
  role: Role,
  action: PermissionAction,
  resourceOwnerId?: string,
  userId?: string
): boolean {
  const checker = getPermissionChecker();
  return checker.check(
    {
      userId: userId || "",
      role,
      workspaceId: "",
      resourceOwnerId,
    },
    action
  ).allowed;
}

/**
 * Get role display information
 */
export function getRoleInfo(role: Role): RoleDefinition {
  return ROLE_DEFINITIONS[role];
}

/**
 * Get all roles sorted by level
 */
export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLE_DEFINITIONS).sort((a, b) => b.level - a.level);
}

/**
 * Get available roles for assignment (excludes owner)
 */
export function getAssignableRoles(): RoleDefinition[] {
  return getAllRoles().filter(r => r.role !== "owner");
}
