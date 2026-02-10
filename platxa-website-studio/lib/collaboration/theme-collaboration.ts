/**
 * Theme Collaboration Provider
 *
 * Extends the base collaboration system for real-time theme editing.
 * Provides theme-specific awareness including color picker interactions,
 * token editing, and design tool state synchronization.
 *
 * @example
 * ```typescript
 * import { createThemeCollaboration } from "@/lib/collaboration/theme-collaboration"
 *
 * const collab = createThemeCollaboration({
 *   serverUrl: "wss://collab.example.com",
 *   themeId: "my-theme",
 *   userName: "Alice",
 * })
 *
 * await collab.connect()
 *
 * // Track when user is editing a color
 * collab.setEditingToken("colors.primary", { type: "color-picker", value: "#3b82f6" })
 *
 * // See what others are editing
 * const activeEdits = collab.getActiveTokenEdits()
 * ```
 *
 * @module collaboration/theme-collaboration
 */

import {
  CollaborationProvider,
  createCollaborationProvider,
  type CollaboratorInfo,
  type CollaborationConfig,
  type CollaborationEventCallback,
  type CollaborationState,
} from "./provider"

// =============================================================================
// Types
// =============================================================================

/** Tool types for theme editing */
export type ThemeEditTool =
  | "color-picker"
  | "slider"
  | "text-input"
  | "dropdown"
  | "token-browser"
  | "preview"
  | "code-editor"

/** Theme token category */
export type TokenCategory =
  | "colors"
  | "spacing"
  | "typography"
  | "radius"
  | "shadow"
  | "animation"
  | "custom"

/** Active token edit state */
export interface TokenEditState {
  /** Token path (e.g., "colors.primary", "spacing.4") */
  tokenPath: string
  /** Token category */
  category: TokenCategory
  /** Tool being used */
  tool: ThemeEditTool
  /** Current value being edited */
  value: unknown
  /** Original value before editing */
  originalValue?: unknown
  /** Edit start timestamp */
  startedAt: number
  /** Last update timestamp */
  updatedAt: number
}

/** Theme-specific collaborator info */
export interface ThemeCollaboratorInfo extends CollaboratorInfo {
  /** Currently editing token */
  editingToken?: TokenEditState
  /** Panel/section being viewed */
  viewingPanel?: string
  /** Preview viewport size */
  previewViewport?: { width: number; height: number }
  /** Selected theme mode */
  selectedMode?: "light" | "dark" | "system"
  /** Color format preference */
  colorFormat?: "hex" | "rgb" | "hsl" | "oklch"
}

/** Theme collaboration state */
export interface ThemeCollaborationState extends CollaborationState {
  /** Theme ID being edited */
  themeId: string
  /** Theme-aware collaborators */
  collaborators: ThemeCollaboratorInfo[]
  /** All active token edits */
  activeTokenEdits: Map<string, { collaborator: ThemeCollaboratorInfo; edit: TokenEditState }>
  /** Tokens with multiple editors (potential conflicts) */
  conflictingTokens: string[]
  /** Local user */
  localUser: ThemeCollaboratorInfo | null
}

/** Theme collaboration config */
export interface ThemeCollaborationConfig extends Omit<CollaborationConfig, "roomId"> {
  /** Theme ID to collaborate on */
  themeId: string
  /** Initial panel being viewed */
  initialPanel?: string
  /** Initial preview viewport */
  initialViewport?: { width: number; height: number }
}

/** Token lock status */
export interface TokenLockStatus {
  /** Whether the token is locked by another user */
  locked: boolean
  /** User who has the lock */
  lockedBy?: ThemeCollaboratorInfo
  /** When the lock was acquired */
  lockedAt?: number
  /** Whether local user can edit */
  canEdit: boolean
}

/** Theme collaboration event types */
export type ThemeCollaborationEventType =
  | "token:edit-start"
  | "token:edit-update"
  | "token:edit-end"
  | "token:conflict"
  | "panel:change"
  | "viewport:change"
  | "mode:change"

export interface ThemeCollaborationEvent {
  type: ThemeCollaborationEventType
  data: unknown
  collaborator?: ThemeCollaboratorInfo
  timestamp: number
}

export type ThemeCollaborationEventCallback = (event: ThemeCollaborationEvent) => void

// =============================================================================
// Constants
// =============================================================================

/** Idle timeout for token editing (5 seconds) */
const TOKEN_EDIT_IDLE_TIMEOUT = 5000

/** Maximum concurrent edits on same token before conflict warning */
const CONFLICT_THRESHOLD = 2

// =============================================================================
// Theme Collaboration Provider
// =============================================================================

export class ThemeCollaborationProvider {
  private baseProvider: CollaborationProvider
  private themeId: string
  private callbacks: ThemeCollaborationEventCallback[] = []
  private editTimeout: ReturnType<typeof setTimeout> | null = null
  private _state: ThemeCollaborationState

  constructor(config: ThemeCollaborationConfig) {
    // Create base collaboration provider
    this.baseProvider = createCollaborationProvider({
      ...config,
      roomId: `theme:${config.themeId}`,
    })

    this.themeId = config.themeId

    // Initialize state
    this._state = {
      connected: false,
      statusMessage: "Initializing...",
      collaborators: [],
      roomId: `theme:${config.themeId}`,
      themeId: config.themeId,
      localUser: null,
      activeTokenEdits: new Map(),
      conflictingTokens: [],
    }

    // Subscribe to base provider events
    this.baseProvider.on(this.handleBaseEvent.bind(this))
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    await this.baseProvider.connect()
    this.syncStateFromBase()
  }

  disconnect(): void {
    this.clearEditingToken()
    this.baseProvider.disconnect()
    this.syncStateFromBase()
  }

  isConnected(): boolean {
    return this.baseProvider.isConnected()
  }

  // ---------------------------------------------------------------------------
  // Token Editing Awareness
  // ---------------------------------------------------------------------------

  /**
   * Signals that local user is editing a token
   */
  setEditingToken(
    tokenPath: string,
    options: {
      tool: ThemeEditTool
      value: unknown
      originalValue?: unknown
      category?: TokenCategory
    },
  ): void {
    const category = options.category || this.inferCategory(tokenPath)
    const now = Date.now()

    const editState: TokenEditState = {
      tokenPath,
      category,
      tool: options.tool,
      value: options.value,
      originalValue: options.originalValue,
      startedAt: now,
      updatedAt: now,
    }

    this.updateLocalAwareness({ editingToken: editState })
    this.scheduleEditTimeout()
    this.emit({
      type: "token:edit-start",
      data: editState,
      timestamp: now,
    })
  }

  /**
   * Updates the value being edited
   */
  updateEditingToken(value: unknown): void {
    const awareness = this.baseProvider.getAwareness()
    const localState = awareness.getLocalState() as { user: ThemeCollaboratorInfo } | null

    if (!localState?.user?.editingToken) return

    const updatedEdit: TokenEditState = {
      ...localState.user.editingToken,
      value,
      updatedAt: Date.now(),
    }

    this.updateLocalAwareness({ editingToken: updatedEdit })
    this.scheduleEditTimeout()
  }

  /**
   * Clears the editing token (signals edit complete)
   */
  clearEditingToken(): void {
    const awareness = this.baseProvider.getAwareness()
    const localState = awareness.getLocalState() as { user: ThemeCollaboratorInfo } | null

    if (!localState?.user?.editingToken) return

    const editState = localState.user.editingToken
    this.updateLocalAwareness({ editingToken: undefined })

    this.emit({
      type: "token:edit-end",
      data: editState,
      timestamp: Date.now(),
    })
  }

  /**
   * Gets all active token edits from collaborators
   */
  getActiveTokenEdits(): Map<string, { collaborator: ThemeCollaboratorInfo; edit: TokenEditState }> {
    const edits = new Map<string, { collaborator: ThemeCollaboratorInfo; edit: TokenEditState }>()

    for (const collab of this._state.collaborators) {
      if (collab.editingToken && !collab.isLocal) {
        edits.set(collab.editingToken.tokenPath, {
          collaborator: collab,
          edit: collab.editingToken,
        })
      }
    }

    return edits
  }

  /**
   * Checks if a token is being edited by someone else
   */
  getTokenLockStatus(tokenPath: string): TokenLockStatus {
    const edits = this.getActiveTokenEdits()
    const edit = edits.get(tokenPath)

    if (!edit) {
      return { locked: false, canEdit: true }
    }

    return {
      locked: true,
      lockedBy: edit.collaborator,
      lockedAt: edit.edit.startedAt,
      canEdit: false,
    }
  }

  /**
   * Gets tokens with potential conflicts (multiple editors)
   */
  getConflictingTokens(): string[] {
    const tokenEditors = new Map<string, ThemeCollaboratorInfo[]>()

    for (const collab of this._state.collaborators) {
      if (collab.editingToken) {
        const editors = tokenEditors.get(collab.editingToken.tokenPath) || []
        editors.push(collab)
        tokenEditors.set(collab.editingToken.tokenPath, editors)
      }
    }

    const conflicts: string[] = []
    for (const [path, editors] of tokenEditors) {
      if (editors.length >= CONFLICT_THRESHOLD) {
        conflicts.push(path)
      }
    }

    return conflicts
  }

  // ---------------------------------------------------------------------------
  // Panel/View Awareness
  // ---------------------------------------------------------------------------

  /**
   * Updates which panel the local user is viewing
   */
  setViewingPanel(panel: string): void {
    this.updateLocalAwareness({ viewingPanel: panel })
    this.emit({
      type: "panel:change",
      data: { panel },
      timestamp: Date.now(),
    })
  }

  /**
   * Updates the local user's preview viewport size
   */
  setPreviewViewport(width: number, height: number): void {
    this.updateLocalAwareness({ previewViewport: { width, height } })
    this.emit({
      type: "viewport:change",
      data: { width, height },
      timestamp: Date.now(),
    })
  }

  /**
   * Updates the local user's selected theme mode
   */
  setSelectedMode(mode: "light" | "dark" | "system"): void {
    this.updateLocalAwareness({ selectedMode: mode })
    this.emit({
      type: "mode:change",
      data: { mode },
      timestamp: Date.now(),
    })
  }

  /**
   * Updates the local user's color format preference
   */
  setColorFormat(format: "hex" | "rgb" | "hsl" | "oklch"): void {
    this.updateLocalAwareness({ colorFormat: format })
  }

  // ---------------------------------------------------------------------------
  // Collaborator Queries
  // ---------------------------------------------------------------------------

  /**
   * Gets collaborators viewing a specific panel
   */
  getCollaboratorsInPanel(panel: string): ThemeCollaboratorInfo[] {
    return this._state.collaborators.filter(
      (c) => !c.isLocal && c.viewingPanel === panel,
    )
  }

  /**
   * Gets collaborators editing tokens in a category
   */
  getCollaboratorsEditingCategory(category: TokenCategory): ThemeCollaboratorInfo[] {
    return this._state.collaborators.filter(
      (c) => !c.isLocal && c.editingToken?.category === category,
    )
  }

  /**
   * Gets all remote collaborators
   */
  getRemoteCollaborators(): ThemeCollaboratorInfo[] {
    return this._state.collaborators.filter((c) => !c.isLocal)
  }

  /**
   * Gets the current state
   */
  getState(): ThemeCollaborationState {
    return { ...this._state }
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to theme collaboration events
   */
  on(callback: ThemeCollaborationEventCallback): () => void {
    this.callbacks.push(callback)
    return () => this.off(callback)
  }

  /**
   * Unsubscribe from events
   */
  off(callback: ThemeCollaborationEventCallback): void {
    const index = this.callbacks.indexOf(callback)
    if (index !== -1) {
      this.callbacks.splice(index, 1)
    }
  }

  private emit(event: ThemeCollaborationEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error("Theme collaboration event error:", error)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private handleBaseEvent: CollaborationEventCallback = (event) => {
    // Sync state on any change
    this.syncStateFromBase()

    // Check for conflicts when awareness changes
    if (event.type === "awareness:change") {
      const conflicts = this.getConflictingTokens()
      if (conflicts.length > 0 && conflicts.length !== this._state.conflictingTokens.length) {
        this._state.conflictingTokens = conflicts
        for (const tokenPath of conflicts) {
          this.emit({
            type: "token:conflict",
            data: { tokenPath, editorCount: this.getEditorsForToken(tokenPath).length },
            timestamp: Date.now(),
          })
        }
      }
    }
  }

  private syncStateFromBase(): void {
    const baseState = this.baseProvider.getState()
    this._state = {
      ...this._state,
      connected: baseState.connected,
      statusMessage: baseState.statusMessage,
      collaborators: baseState.collaborators as ThemeCollaboratorInfo[],
      localUser: baseState.localUser as ThemeCollaboratorInfo | null,
    }
  }

  private updateLocalAwareness(updates: Partial<ThemeCollaboratorInfo>): void {
    const awareness = this.baseProvider.getAwareness()
    const currentState = awareness.getLocalState() as { user: ThemeCollaboratorInfo } | null

    if (!currentState) return

    awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        ...updates,
        lastActivity: Date.now(),
      },
    })
  }

  private scheduleEditTimeout(): void {
    if (this.editTimeout) {
      clearTimeout(this.editTimeout)
    }
    this.editTimeout = setTimeout(() => {
      this.clearEditingToken()
    }, TOKEN_EDIT_IDLE_TIMEOUT)
  }

  private inferCategory(tokenPath: string): TokenCategory {
    const firstPart = tokenPath.split(".")[0]
    const categoryMap: Record<string, TokenCategory> = {
      colors: "colors",
      color: "colors",
      spacing: "spacing",
      space: "spacing",
      typography: "typography",
      font: "typography",
      radius: "radius",
      rounded: "radius",
      shadow: "shadow",
      animation: "animation",
      transition: "animation",
    }
    return categoryMap[firstPart] || "custom"
  }

  private getEditorsForToken(tokenPath: string): ThemeCollaboratorInfo[] {
    return this._state.collaborators.filter(
      (c) => c.editingToken?.tokenPath === tokenPath,
    )
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (this.editTimeout) {
      clearTimeout(this.editTimeout)
    }
    this.callbacks = []
    this.baseProvider.destroy()
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let globalThemeProvider: ThemeCollaborationProvider | null = null

/**
 * Creates a new theme collaboration provider
 */
export function createThemeCollaboration(
  config: ThemeCollaborationConfig,
): ThemeCollaborationProvider {
  return new ThemeCollaborationProvider(config)
}

/**
 * Gets or creates the global theme collaboration provider
 */
export function getThemeCollaboration(
  config?: ThemeCollaborationConfig,
): ThemeCollaborationProvider {
  if (!globalThemeProvider && config) {
    globalThemeProvider = createThemeCollaboration(config)
  }
  if (!globalThemeProvider) {
    throw new Error("Theme collaboration not initialized. Call with config first.")
  }
  return globalThemeProvider
}

/**
 * Destroys the global theme collaboration provider
 */
export function destroyThemeCollaboration(): void {
  if (globalThemeProvider) {
    globalThemeProvider.destroy()
    globalThemeProvider = null
  }
}
