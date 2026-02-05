/**
 * Collaboration Module
 *
 * Exports all collaboration-related functionality.
 */

export {
  CollaborationProvider,
  createCollaborationProvider,
  getCollaborationProvider,
  destroyCollaborationProvider,
  type CollaboratorInfo,
  type CollaborationState,
  type CollaborationConfig,
  type CollaborationEvent,
  type CollaborationEventType,
  type CollaborationEventCallback,
} from "./provider";

export {
  MonacoCursorAdapter,
  createMonacoCursorAdapter,
  type RemoteCursor,
  type MonacoCursorAdapterConfig,
} from "./monaco-adapter";

export {
  WorkspaceManager,
  getWorkspaceManager,
  createWorkspaceManager,
  type WorkspaceRole,
  type WorkspaceVisibility,
  type InvitationStatus,
  type WorkspaceMember,
  type WorkspaceInvitation,
  type WorkspaceProject,
  type WorkspaceSettings,
  type Workspace,
  type CreateWorkspaceOptions,
  type InviteMemberOptions,
  type AddProjectOptions,
  type UpdateWorkspaceOptions,
} from "./workspace-manager";

export {
  InvitationService,
  createInvitationService,
  generateInvitationEmailHtml,
  generateInvitationEmailText,
  type EmailProvider,
  type SendEmailOptions,
  type EmailResult,
  type InvitationTokenPayload,
  type InvitationDetails,
  type InvitationServiceConfig,
  type CreateInvitationOptions,
  type AcceptInvitationResult,
} from "./invitation-service";

export {
  PermissionChecker,
  getPermissionChecker,
  createPermissionChecker,
  canPerform,
  getRoleInfo,
  getAllRoles,
  getAssignableRoles,
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  type Role,
  type PermissionAction,
  type ResourceType,
  type PermissionContext,
  type PermissionResult,
  type PermissionDefinition,
  type RoleDefinition,
} from "./permission-system";
