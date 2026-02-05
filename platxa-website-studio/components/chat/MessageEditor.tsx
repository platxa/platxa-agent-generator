'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
    edited?: boolean;
    originalContent?: string;
    editedAt?: Date;
    rerunCount?: number;
  };
}

export interface MessageEditState {
  messageId: string;
  originalContent: string;
  editedContent: string;
  isEditing: boolean;
}

export interface MessageEditorProps {
  message: ChatMessage;
  onEdit: (messageId: string, newContent: string) => void;
  onRerun: (messageId: string, newContent: string) => void;
  onCancel: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  disabled?: boolean;
  className?: string;
  showRerunWarning?: boolean;
  maxLength?: number;
}

export interface EditableMessageListProps {
  messages: ChatMessage[];
  onEditAndRerun: (messageId: string, newContent: string) => Promise<void>;
  onEditOnly: (messageId: string, newContent: string) => void;
  isProcessing?: boolean;
  className?: string;
  renderMessage?: (message: ChatMessage, editControls: React.ReactNode) => React.ReactNode;
}

export interface UseMessageEditingOptions {
  messages: ChatMessage[];
  onRerunFromMessage: (messageId: string, newContent: string) => Promise<void>;
  onUpdateMessage?: (messageId: string, newContent: string) => void;
}

export interface UseMessageEditingReturn {
  editingMessageId: string | null;
  editContent: string;
  startEditing: (messageId: string) => void;
  cancelEditing: () => void;
  setEditContent: (content: string) => void;
  saveEdit: () => void;
  saveAndRerun: () => Promise<void>;
  isEditing: (messageId: string) => boolean;
  canEdit: (message: ChatMessage) => boolean;
  getEditHistory: (messageId: string) => string[];
}

// ============================================================================
// Message Editor Component
// ============================================================================

export function MessageEditor({
  message,
  onEdit,
  onRerun,
  onCancel,
  isEditing,
  onStartEdit,
  disabled = false,
  className = '',
  showRerunWarning = true,
  maxLength = 10000,
}: MessageEditorProps) {
  const [editedContent, setEditedContent] = useState(message.content);
  const [showWarning, setShowWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and resize textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
      adjustTextareaHeight();
    }
  }, [isEditing]);

  // Reset content when message changes
  useEffect(() => {
    setEditedContent(message.content);
  }, [message.content]);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 400)}px`;
    }
  }, []);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setEditedContent(value);
        adjustTextareaHeight();
      }
    },
    [maxLength, adjustTextareaHeight]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (showRerunWarning) {
          setShowWarning(true);
        } else {
          onRerun(message.id, editedContent);
        }
      }
    },
    [onCancel, onRerun, message.id, editedContent, showRerunWarning]
  );

  const handleSaveOnly = useCallback(() => {
    onEdit(message.id, editedContent);
  }, [onEdit, message.id, editedContent]);

  const handleSaveAndRerun = useCallback(() => {
    setShowWarning(false);
    onRerun(message.id, editedContent);
  }, [onRerun, message.id, editedContent]);

  const handleRerunClick = useCallback(() => {
    if (showRerunWarning) {
      setShowWarning(true);
    } else {
      onRerun(message.id, editedContent);
    }
  }, [showRerunWarning, onRerun, message.id, editedContent]);

  const hasChanges = editedContent !== message.content;
  const charCount = editedContent.length;
  const isNearLimit = charCount > maxLength * 0.9;

  if (!isEditing) {
    return (
      <div className={`message-editor-view ${className}`}>
        <div className="message-content">
          {message.content}
        </div>
        {message.role === 'user' && !disabled && (
          <button
            className="edit-button"
            onClick={onStartEdit}
            title="Edit message (click to modify and re-run)"
          >
            <EditIcon />
          </button>
        )}
        {message.metadata?.edited && (
          <span className="edited-indicator" title={`Edited ${message.metadata.editedAt?.toLocaleString()}`}>
            (edited)
          </span>
        )}

        <style jsx>{`
          .message-editor-view {
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .message-content {
            flex: 1;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .edit-button {
            flex-shrink: 0;
            padding: 4px;
            background: transparent;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s ease;
          }

          .message-editor-view:hover .edit-button {
            opacity: 0.5;
          }

          .edit-button:hover {
            opacity: 1 !important;
            background: var(--bg-secondary, #f5f5f5);
          }

          .edited-indicator {
            font-size: 11px;
            color: var(--text-tertiary, #999);
            font-style: italic;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`message-editor-editing ${className}`}>
      <textarea
        ref={textareaRef}
        value={editedContent}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        className="edit-textarea"
        placeholder="Enter your message..."
        disabled={disabled}
      />

      <div className="editor-footer">
        <div className="char-count" data-near-limit={isNearLimit}>
          {charCount} / {maxLength}
        </div>

        <div className="editor-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={disabled}>
            Cancel
          </button>
          <button
            className="btn-save"
            onClick={handleSaveOnly}
            disabled={disabled || !hasChanges}
            title="Save changes without re-running"
          >
            Save Only
          </button>
          <button
            className="btn-rerun"
            onClick={handleRerunClick}
            disabled={disabled}
            title="Save and re-run conversation from this point (Cmd/Ctrl + Enter)"
          >
            Save & Re-run
          </button>
        </div>
      </div>

      {showWarning && (
        <div className="rerun-warning">
          <div className="warning-content">
            <WarningIcon />
            <div className="warning-text">
              <strong>Re-run Conversation?</strong>
              <p>This will discard all messages after this point and generate new responses.</p>
            </div>
          </div>
          <div className="warning-actions">
            <button className="btn-cancel" onClick={() => setShowWarning(false)}>
              Cancel
            </button>
            <button className="btn-confirm" onClick={handleSaveAndRerun}>
              Yes, Re-run
            </button>
          </div>
        </div>
      )}

      <div className="keyboard-hint">
        Press <kbd>Esc</kbd> to cancel, <kbd>Cmd/Ctrl + Enter</kbd> to save & re-run
      </div>

      <style jsx>{`
        .message-editor-editing {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .edit-textarea {
          width: 100%;
          min-height: 80px;
          max-height: 400px;
          padding: 12px;
          font-size: 14px;
          font-family: inherit;
          line-height: 1.5;
          border: 2px solid var(--accent, #4f46e5);
          border-radius: 8px;
          background: var(--bg-primary, #fff);
          resize: none;
          outline: none;
        }

        .edit-textarea:focus {
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
        }

        .editor-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .char-count {
          font-size: 12px;
          color: var(--text-tertiary, #999);
        }

        .char-count[data-near-limit="true"] {
          color: var(--warning, #f59e0b);
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .btn-cancel,
        .btn-save,
        .btn-rerun {
          padding: 6px 12px;
          font-size: 13px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel {
          background: var(--bg-secondary, #f5f5f5);
          color: var(--text-secondary, #666);
        }

        .btn-cancel:hover:not(:disabled) {
          background: var(--bg-tertiary, #e5e5e5);
        }

        .btn-save {
          background: var(--bg-secondary, #f5f5f5);
          color: var(--text-primary, #333);
        }

        .btn-save:hover:not(:disabled) {
          background: var(--bg-tertiary, #e5e5e5);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-rerun {
          background: var(--accent, #4f46e5);
          color: white;
        }

        .btn-rerun:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-rerun:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rerun-warning {
          padding: 12px;
          background: var(--warning-bg, #fef3c7);
          border: 1px solid var(--warning-border, #f59e0b);
          border-radius: 8px;
          margin-top: 8px;
        }

        .warning-content {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .warning-text {
          flex: 1;
        }

        .warning-text strong {
          display: block;
          margin-bottom: 4px;
          color: var(--warning-text, #92400e);
        }

        .warning-text p {
          margin: 0;
          font-size: 13px;
          color: var(--warning-text, #92400e);
          opacity: 0.9;
        }

        .warning-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 12px;
        }

        .btn-confirm {
          padding: 6px 12px;
          font-size: 13px;
          background: var(--warning, #f59e0b);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-confirm:hover {
          opacity: 0.9;
        }

        .keyboard-hint {
          font-size: 11px;
          color: var(--text-tertiary, #999);
          text-align: right;
        }

        .keyboard-hint kbd {
          padding: 2px 5px;
          font-size: 10px;
          font-family: monospace;
          background: var(--bg-secondary, #f5f5f5);
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Editable Message List Component
// ============================================================================

export function EditableMessageList({
  messages,
  onEditAndRerun,
  onEditOnly,
  isProcessing = false,
  className = '',
  renderMessage,
}: EditableMessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleStartEdit = useCallback((messageId: string) => {
    setEditingId(messageId);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleEdit = useCallback(
    (messageId: string, newContent: string) => {
      onEditOnly(messageId, newContent);
      setEditingId(null);
    },
    [onEditOnly]
  );

  const handleRerun = useCallback(
    async (messageId: string, newContent: string) => {
      await onEditAndRerun(messageId, newContent);
      setEditingId(null);
    },
    [onEditAndRerun]
  );

  return (
    <div className={`editable-message-list ${className}`}>
      {messages.map((message) => {
        const editControls = (
          <MessageEditor
            key={message.id}
            message={message}
            onEdit={handleEdit}
            onRerun={handleRerun}
            onCancel={handleCancelEdit}
            isEditing={editingId === message.id}
            onStartEdit={() => handleStartEdit(message.id)}
            disabled={isProcessing}
          />
        );

        if (renderMessage) {
          return (
            <div key={message.id} className="message-wrapper">
              {renderMessage(message, editControls)}
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`message-item ${message.role}`}
            data-editing={editingId === message.id}
          >
            <div className="message-role">
              {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️'}
            </div>
            <div className="message-body">
              {editControls}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .editable-message-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-wrapper {
          width: 100%;
        }

        .message-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          transition: background 0.15s ease;
        }

        .message-item[data-editing="true"] {
          background: var(--bg-secondary, #f9f9f9);
        }

        .message-item.user {
          background: var(--user-message-bg, #f0f9ff);
        }

        .message-item.assistant {
          background: var(--assistant-message-bg, #f9f9f9);
        }

        .message-item.system {
          background: var(--system-message-bg, #fef3c7);
          font-style: italic;
        }

        .message-role {
          flex-shrink: 0;
          font-size: 20px;
        }

        .message-body {
          flex: 1;
          min-width: 0;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// useMessageEditing Hook
// ============================================================================

export function useMessageEditing({
  messages,
  onRerunFromMessage,
  onUpdateMessage,
}: UseMessageEditingOptions): UseMessageEditingReturn {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editHistory, setEditHistory] = useState<Map<string, string[]>>(new Map());

  const startEditing = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message && message.role === 'user') {
        setEditingMessageId(messageId);
        setEditContent(message.content);
      }
    },
    [messages]
  );

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingMessageId || !onUpdateMessage) return;

    const message = messages.find((m) => m.id === editingMessageId);
    if (message) {
      // Save to history
      setEditHistory((prev) => {
        const history = prev.get(editingMessageId) || [];
        return new Map(prev).set(editingMessageId, [...history, message.content]);
      });

      onUpdateMessage(editingMessageId, editContent);
    }

    setEditingMessageId(null);
    setEditContent('');
  }, [editingMessageId, editContent, messages, onUpdateMessage]);

  const saveAndRerun = useCallback(async () => {
    if (!editingMessageId) return;

    const message = messages.find((m) => m.id === editingMessageId);
    if (message) {
      // Save to history
      setEditHistory((prev) => {
        const history = prev.get(editingMessageId) || [];
        return new Map(prev).set(editingMessageId, [...history, message.content]);
      });

      await onRerunFromMessage(editingMessageId, editContent);
    }

    setEditingMessageId(null);
    setEditContent('');
  }, [editingMessageId, editContent, messages, onRerunFromMessage]);

  const isEditing = useCallback(
    (messageId: string) => editingMessageId === messageId,
    [editingMessageId]
  );

  const canEdit = useCallback(
    (message: ChatMessage) => message.role === 'user',
    []
  );

  const getEditHistory = useCallback(
    (messageId: string) => editHistory.get(messageId) || [],
    [editHistory]
  );

  return {
    editingMessageId,
    editContent,
    startEditing,
    cancelEditing,
    setEditContent,
    saveEdit,
    saveAndRerun,
    isEditing,
    canEdit,
    getEditHistory,
  };
}

// ============================================================================
// Edit History Component
// ============================================================================

export interface EditHistoryProps {
  messageId: string;
  history: string[];
  onRestore: (content: string) => void;
  className?: string;
}

export function EditHistory({
  messageId,
  history,
  onRestore,
  className = '',
}: EditHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className={`edit-history ${className}`}>
      <button
        className="history-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <HistoryIcon />
        <span>{history.length} previous version{history.length > 1 ? 's' : ''}</span>
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="history-list">
          {history.map((content, index) => (
            <div key={index} className="history-item">
              <div className="history-content">
                {content.slice(0, 100)}
                {content.length > 100 && '...'}
              </div>
              <button
                className="restore-btn"
                onClick={() => onRestore(content)}
                title="Restore this version"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .edit-history {
          margin-top: 8px;
        }

        .history-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          font-size: 12px;
          color: var(--text-secondary, #666);
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .history-toggle:hover {
          background: var(--bg-secondary, #f5f5f5);
        }

        .toggle-icon {
          font-size: 10px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          padding: 8px;
          background: var(--bg-secondary, #f9f9f9);
          border-radius: 6px;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--bg-primary, #fff);
          border-radius: 4px;
        }

        .history-content {
          flex: 1;
          font-size: 13px;
          color: var(--text-secondary, #666);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .restore-btn {
          flex-shrink: 0;
          padding: 4px 8px;
          font-size: 12px;
          background: var(--bg-tertiary, #e5e5e5);
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .restore-btn:hover {
          background: var(--accent, #4f46e5);
          color: white;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Inline Edit Button Component
// ============================================================================

export interface InlineEditButtonProps {
  onEdit: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  className?: string;
}

export function InlineEditButton({
  onEdit,
  disabled = false,
  size = 'small',
  className = '',
}: InlineEditButtonProps) {
  return (
    <button
      className={`inline-edit-btn ${size} ${className}`}
      onClick={onEdit}
      disabled={disabled}
      title="Edit and re-run from this message"
    >
      <EditIcon />

      <style jsx>{`
        .inline-edit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          opacity: 0.5;
          transition: all 0.15s ease;
        }

        .inline-edit-btn:hover:not(:disabled) {
          opacity: 1;
          background: var(--bg-secondary, #f5f5f5);
        }

        .inline-edit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.3;
        }

        .inline-edit-btn.small {
          padding: 3px;
        }

        .inline-edit-btn.small :global(svg) {
          width: 14px;
          height: 14px;
        }

        .inline-edit-btn.medium {
          padding: 5px;
        }

        .inline-edit-btn.medium :global(svg) {
          width: 18px;
          height: 18px;
        }
      `}</style>
    </button>
  );
}

// ============================================================================
// Icons
// ============================================================================

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#f59e0b', flexShrink: 0 }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ============================================================================
// Message Branching Utilities
// ============================================================================

export interface MessageBranch {
  id: string;
  parentMessageId: string;
  messages: ChatMessage[];
  createdAt: Date;
  label?: string;
}

export interface UseMessageBranchingOptions {
  initialMessages: ChatMessage[];
  maxBranches?: number;
}

export interface UseMessageBranchingReturn {
  currentBranch: string | null;
  branches: MessageBranch[];
  createBranch: (fromMessageId: string, label?: string) => string;
  switchBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  getCurrentMessages: () => ChatMessage[];
  mergeBranch: (branchId: string) => void;
}

export function useMessageBranching({
  initialMessages,
  maxBranches = 10,
}: UseMessageBranchingOptions): UseMessageBranchingReturn {
  const [branches, setBranches] = useState<MessageBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [mainMessages, setMainMessages] = useState<ChatMessage[]>(initialMessages);

  const createBranch = useCallback(
    (fromMessageId: string, label?: string) => {
      const messageIndex = mainMessages.findIndex((m) => m.id === fromMessageId);
      if (messageIndex === -1) return '';

      if (branches.length >= maxBranches) {
        console.warn('Maximum branch limit reached');
        return '';
      }

      const branchId = `branch-${Date.now()}`;
      const branchedMessages = mainMessages.slice(0, messageIndex + 1);

      const newBranch: MessageBranch = {
        id: branchId,
        parentMessageId: fromMessageId,
        messages: branchedMessages,
        createdAt: new Date(),
        label: label || `Branch ${branches.length + 1}`,
      };

      setBranches((prev) => [...prev, newBranch]);
      setCurrentBranch(branchId);

      return branchId;
    },
    [mainMessages, branches.length, maxBranches]
  );

  const switchBranch = useCallback((branchId: string | null) => {
    setCurrentBranch(branchId);
  }, []);

  const deleteBranch = useCallback((branchId: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== branchId));
    if (currentBranch === branchId) {
      setCurrentBranch(null);
    }
  }, [currentBranch]);

  const getCurrentMessages = useCallback(() => {
    if (!currentBranch) return mainMessages;
    const branch = branches.find((b) => b.id === currentBranch);
    return branch?.messages || mainMessages;
  }, [currentBranch, branches, mainMessages]);

  const mergeBranch = useCallback(
    (branchId: string) => {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return;

      setMainMessages(branch.messages);
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
      setCurrentBranch(null);
    },
    [branches]
  );

  return {
    currentBranch,
    branches,
    createBranch,
    switchBranch,
    deleteBranch,
    getCurrentMessages,
    mergeBranch,
  };
}

export default MessageEditor;
