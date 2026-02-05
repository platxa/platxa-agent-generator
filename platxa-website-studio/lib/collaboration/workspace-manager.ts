/**
 * Workspace Manager
 *
 * Manages team workspaces for collaborative website development.
 * Handles workspace creation, project management, and member invitations.
 *
 * Features:
 * - Create and configure team workspaces
 * - Add/remove projects to workspaces
 * - Invite and manage team members
 * - Role-based access control
 * - Workspace settings and preferences
 *
 * Feature #70: Collaboration - WorkspaceManager
 */

// =============================================================================
// Types
// =============================================================================

/** Workspace member roles */
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

/** Workspace visibility */
export type WorkspaceVisibility = "private" | "team" | "public";

/** Invitation status */
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

/** Workspace member */
export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: WorkspaceRole;
  joinedAt: Date;
  lastActiveAt?: Date;
}

/** Workspace invitation */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

/** Project reference in workspace */
export interface WorkspaceProject {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  addedAt: Date;
  addedBy: string;
  lastModifiedAt?: Date;
  status: "active" | "archived" | "deleted";
}

/** Workspace settings */
export interface WorkspaceSettings {
  allowMemberInvites: boolean;
  defaultProjectVisibility: "workspace" | "private";
  requireApprovalForPublish: boolean;
  notifyOnChanges: boolean;
  maxProjects: number;
  maxMembers: number;
}

/** Workspace definition */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  visibility: WorkspaceVisibility;
  ownerId: string;
  members: WorkspaceMember[];
  projects: WorkspaceProject[];
  invitations: WorkspaceInvitation[];
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}

/** Workspace creation options */
export interface CreateWorkspaceOptions {
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  visibility?: WorkspaceVisibility;
  settings?: Partial<WorkspaceSettings>;
}

/** Member invitation options */
export interface InviteMemberOptions {
  email: string;
  role?: WorkspaceRole;
  message?: string;
  expiresInDays?: number;
}

/** Project addition options */
export interface AddProjectOptions {
  projectId: string;
  name: string;
  description?: string;
}

/** Workspace update options */
export interface UpdateWorkspaceOptions {
  name?: string;
  description?: string;
  logoUrl?: string;
  visibility?: WorkspaceVisibility;
  settings?: Partial<WorkspaceSettings>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SETTINGS: WorkspaceSettings = {
  allowMemberInvites: true,
  defaultProjectVisibility: "workspace",
  requireApprovalForPublish: false,
  notifyOnChanges: true,
  maxProjects: 50,
  maxMembers: 25,
};

const INVITATION_EXPIRY_DAYS = 7;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a URL-safe slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if user has required permission
 */
function hasPermission(role: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  const hierarchy: WorkspaceRole[] = ["viewer", "editor", "admin", "owner"];
  return hierarchy.indexOf(role) >= hierarchy.indexOf(requiredRole);
}

// =============================================================================
// WorkspaceManager Class
// =============================================================================

/**
 * Manages team workspaces for collaborative development
 */
export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private userWorkspaces: Map<string, Set<string>> = new Map();

  /**
   * Create a new workspace
   */
  createWorkspace(ownerId: string, options: CreateWorkspaceOptions): Workspace {
    const id = generateId();
    const slug = options.slug || generateSlug(options.name);
    const now = new Date();

    // Create owner member
    const ownerMember: WorkspaceMember = {
      id: generateId(),
      userId: ownerId,
      email: "", // Would be populated from user data
      name: "Owner",
      role: "owner",
      joinedAt: now,
      lastActiveAt: now,
    };

    const workspace: Workspace = {
      id,
      name: options.name,
      slug,
      description: options.description,
      logoUrl: options.logoUrl,
      visibility: options.visibility || "private",
      ownerId,
      members: [ownerMember],
      projects: [],
      invitations: [],
      settings: { ...DEFAULT_SETTINGS, ...options.settings },
      createdAt: now,
      updatedAt: now,
    };

    this.workspaces.set(id, workspace);
    this.addUserWorkspace(ownerId, id);

    return workspace;
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(workspaceId: string): Workspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Get workspace by slug
   */
  getWorkspaceBySlug(slug: string): Workspace | undefined {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) {
        return workspace;
      }
    }
    return undefined;
  }

  /**
   * Get all workspaces for a user
   */
  getUserWorkspaces(userId: string): Workspace[] {
    const workspaceIds = this.userWorkspaces.get(userId);
    if (!workspaceIds) return [];

    return Array.from(workspaceIds)
      .map(id => this.workspaces.get(id))
      .filter((ws): ws is Workspace => ws !== undefined);
  }

  /**
   * Update workspace
   */
  updateWorkspace(
    workspaceId: string,
    userId: string,
    options: UpdateWorkspaceOptions
  ): Workspace | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const member = this.getMember(workspace, userId);
    if (!member || !hasPermission(member.role, "admin")) {
      throw new Error("Insufficient permissions to update workspace");
    }

    if (options.name !== undefined) workspace.name = options.name;
    if (options.description !== undefined) workspace.description = options.description;
    if (options.logoUrl !== undefined) workspace.logoUrl = options.logoUrl;
    if (options.visibility !== undefined) workspace.visibility = options.visibility;
    if (options.settings) {
      workspace.settings = { ...workspace.settings, ...options.settings };
    }
    workspace.updatedAt = new Date();

    return workspace;
  }

  /**
   * Delete workspace
   */
  deleteWorkspace(workspaceId: string, userId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    if (workspace.ownerId !== userId) {
      throw new Error("Only the owner can delete a workspace");
    }

    // Remove workspace from all user mappings
    for (const member of workspace.members) {
      this.removeUserWorkspace(member.userId, workspaceId);
    }

    this.workspaces.delete(workspaceId);
    return true;
  }

  // ===========================================================================
  // Member Management
  // ===========================================================================

  /**
   * Invite a member to workspace
   */
  inviteMember(
    workspaceId: string,
    inviterId: string,
    options: InviteMemberOptions
  ): WorkspaceInvitation | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const inviter = this.getMember(workspace, inviterId);
    if (!inviter || !hasPermission(inviter.role, "admin")) {
      throw new Error("Insufficient permissions to invite members");
    }

    // Check member limit
    if (workspace.members.length >= workspace.settings.maxMembers) {
      throw new Error("Workspace has reached maximum member limit");
    }

    // Check if already a member
    if (workspace.members.some(m => m.email === options.email)) {
      throw new Error("User is already a member of this workspace");
    }

    // Check for existing pending invitation
    const existingInvite = workspace.invitations.find(
      i => i.email === options.email && i.status === "pending"
    );
    if (existingInvite) {
      throw new Error("Invitation already pending for this email");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || INVITATION_EXPIRY_DAYS));

    const invitation: WorkspaceInvitation = {
      id: generateId(),
      workspaceId,
      email: options.email,
      role: options.role || "editor",
      invitedBy: inviterId,
      status: "pending",
      createdAt: new Date(),
      expiresAt,
    };

    workspace.invitations.push(invitation);
    workspace.updatedAt = new Date();

    return invitation;
  }

  /**
   * Accept invitation
   */
  acceptInvitation(
    invitationId: string,
    userId: string,
    userEmail: string,
    userName: string
  ): WorkspaceMember | null {
    for (const workspace of this.workspaces.values()) {
      const invitation = workspace.invitations.find(i => i.id === invitationId);
      if (!invitation) continue;

      if (invitation.email !== userEmail) {
        throw new Error("Invitation email does not match");
      }

      if (invitation.status !== "pending") {
        throw new Error("Invitation is no longer pending");
      }

      if (new Date() > invitation.expiresAt) {
        invitation.status = "expired";
        throw new Error("Invitation has expired");
      }

      // Create member
      const member: WorkspaceMember = {
        id: generateId(),
        userId,
        email: userEmail,
        name: userName,
        role: invitation.role,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
      };

      workspace.members.push(member);
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      workspace.updatedAt = new Date();

      this.addUserWorkspace(userId, workspace.id);

      return member;
    }

    return null;
  }

  /**
   * Decline invitation
   */
  declineInvitation(invitationId: string, userEmail: string): boolean {
    for (const workspace of this.workspaces.values()) {
      const invitation = workspace.invitations.find(i => i.id === invitationId);
      if (!invitation) continue;

      if (invitation.email !== userEmail) {
        throw new Error("Invitation email does not match");
      }

      if (invitation.status !== "pending") {
        return false;
      }

      invitation.status = "declined";
      workspace.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Remove member from workspace
   */
  removeMember(workspaceId: string, actorId: string, memberId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const actor = this.getMember(workspace, actorId);
    const memberToRemove = workspace.members.find(m => m.userId === memberId);

    if (!actor || !memberToRemove) return false;

    // Can't remove owner
    if (memberToRemove.role === "owner") {
      throw new Error("Cannot remove workspace owner");
    }

    // Check permissions (admins can remove editors/viewers, owner can remove anyone)
    if (actor.role === "owner" ||
        (actor.role === "admin" && !hasPermission(memberToRemove.role, "admin"))) {
      workspace.members = workspace.members.filter(m => m.userId !== memberId);
      this.removeUserWorkspace(memberId, workspaceId);
      workspace.updatedAt = new Date();
      return true;
    }

    throw new Error("Insufficient permissions to remove member");
  }

  /**
   * Update member role
   */
  updateMemberRole(
    workspaceId: string,
    actorId: string,
    memberId: string,
    newRole: WorkspaceRole
  ): WorkspaceMember | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const actor = this.getMember(workspace, actorId);
    const member = workspace.members.find(m => m.userId === memberId);

    if (!actor || !member) return null;

    // Can't change owner's role
    if (member.role === "owner") {
      throw new Error("Cannot change owner's role");
    }

    // Only owner can promote to admin
    if (newRole === "admin" && actor.role !== "owner") {
      throw new Error("Only owner can promote to admin");
    }

    // Only owner/admin can change roles
    if (!hasPermission(actor.role, "admin")) {
      throw new Error("Insufficient permissions to change roles");
    }

    member.role = newRole;
    workspace.updatedAt = new Date();

    return member;
  }

  /**
   * Get workspace members
   */
  getMembers(workspaceId: string): WorkspaceMember[] {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.members || [];
  }

  // ===========================================================================
  // Project Management
  // ===========================================================================

  /**
   * Add project to workspace
   */
  addProject(
    workspaceId: string,
    userId: string,
    options: AddProjectOptions
  ): WorkspaceProject | null {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return null;

    const member = this.getMember(workspace, userId);
    if (!member || !hasPermission(member.role, "editor")) {
      throw new Error("Insufficient permissions to add projects");
    }

    // Check project limit
    const activeProjects = workspace.projects.filter(p => p.status === "active");
    if (activeProjects.length >= workspace.settings.maxProjects) {
      throw new Error("Workspace has reached maximum project limit");
    }

    // Check if project already exists
    if (workspace.projects.some(p => p.projectId === options.projectId && p.status === "active")) {
      throw new Error("Project already exists in workspace");
    }

    const project: WorkspaceProject = {
      id: generateId(),
      projectId: options.projectId,
      name: options.name,
      description: options.description,
      addedAt: new Date(),
      addedBy: userId,
      status: "active",
    };

    workspace.projects.push(project);
    workspace.updatedAt = new Date();

    return project;
  }

  /**
   * Remove project from workspace
   */
  removeProject(workspaceId: string, userId: string, projectId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const member = this.getMember(workspace, userId);
    if (!member || !hasPermission(member.role, "editor")) {
      throw new Error("Insufficient permissions to remove projects");
    }

    const project = workspace.projects.find(
      p => p.projectId === projectId && p.status === "active"
    );
    if (!project) return false;

    project.status = "deleted";
    workspace.updatedAt = new Date();

    return true;
  }

  /**
   * Archive project
   */
  archiveProject(workspaceId: string, userId: string, projectId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const member = this.getMember(workspace, userId);
    if (!member || !hasPermission(member.role, "editor")) {
      throw new Error("Insufficient permissions to archive projects");
    }

    const project = workspace.projects.find(
      p => p.projectId === projectId && p.status === "active"
    );
    if (!project) return false;

    project.status = "archived";
    workspace.updatedAt = new Date();

    return true;
  }

  /**
   * Restore archived project
   */
  restoreProject(workspaceId: string, userId: string, projectId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const member = this.getMember(workspace, userId);
    if (!member || !hasPermission(member.role, "editor")) {
      throw new Error("Insufficient permissions to restore projects");
    }

    const project = workspace.projects.find(
      p => p.projectId === projectId && p.status === "archived"
    );
    if (!project) return false;

    project.status = "active";
    workspace.updatedAt = new Date();

    return true;
  }

  /**
   * Get workspace projects
   */
  getProjects(workspaceId: string, includeArchived = false): WorkspaceProject[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return [];

    return workspace.projects.filter(p =>
      p.status === "active" || (includeArchived && p.status === "archived")
    );
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getMember(workspace: Workspace, userId: string): WorkspaceMember | undefined {
    return workspace.members.find(m => m.userId === userId);
  }

  private addUserWorkspace(userId: string, workspaceId: string): void {
    if (!this.userWorkspaces.has(userId)) {
      this.userWorkspaces.set(userId, new Set());
    }
    this.userWorkspaces.get(userId)!.add(workspaceId);
  }

  private removeUserWorkspace(userId: string, workspaceId: string): void {
    this.userWorkspaces.get(userId)?.delete(workspaceId);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let workspaceManagerInstance: WorkspaceManager | null = null;

/**
 * Get workspace manager singleton
 */
export function getWorkspaceManager(): WorkspaceManager {
  if (!workspaceManagerInstance) {
    workspaceManagerInstance = new WorkspaceManager();
  }
  return workspaceManagerInstance;
}

/**
 * Create new workspace manager instance
 */
export function createWorkspaceManager(): WorkspaceManager {
  return new WorkspaceManager();
}
