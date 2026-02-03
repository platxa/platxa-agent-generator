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
