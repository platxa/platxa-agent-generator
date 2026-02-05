"use client";

/**
 * CommentSystem
 *
 * Provides comment and annotation functionality for leaving feedback
 * on specific elements with support for replies, resolution, and mentions.
 *
 * Feature #76: Collaboration - Comment/annotation system
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Reply,
  Check,
  MoreHorizontal,
  Trash2,
  Edit2,
  Pin,
  CheckCircle2,
  Circle,
  Send,
  X,
  AtSign,
  Smile,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  isAi?: boolean;
}

export interface CommentReply {
  id: string;
  author: CommentAuthor;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  mentions?: string[];
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved: boolean;
  resolvedBy?: CommentAuthor;
  resolvedAt?: Date;
  pinned: boolean;
  replies: CommentReply[];
  mentions?: string[];
  /** Target element selector or path */
  target?: {
    type: "element" | "line" | "region" | "file";
    selector?: string;
    filePath?: string;
    lineNumber?: number;
    lineRange?: { start: number; end: number };
    /** Position for visual annotations */
    position?: { x: number; y: number };
  };
  /** Thread metadata */
  metadata?: Record<string, unknown>;
}

export interface CommentThreadProps {
  /** Comment thread data */
  comment: Comment;
  /** Current user for permissions */
  currentUser: CommentAuthor;
  /** Available users for mentions */
  availableUsers?: CommentAuthor[];
  /** Callback when reply is added */
  onReply?: (commentId: string, content: string, mentions: string[]) => void;
  /** Callback when comment is resolved/unresolve */
  onResolve?: (commentId: string, resolved: boolean) => void;
  /** Callback when comment is deleted */
  onDelete?: (commentId: string) => void;
  /** Callback when comment is edited */
  onEdit?: (commentId: string, content: string) => void;
  /** Callback when comment is pinned/unpinned */
  onPin?: (commentId: string, pinned: boolean) => void;
  /** Callback when reply is deleted */
  onDeleteReply?: (commentId: string, replyId: string) => void;
  /** Compact display mode */
  compact?: boolean;
  /** Show target info */
  showTarget?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface CommentInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Available users for mentions */
  availableUsers?: CommentAuthor[];
  /** Callback when comment is submitted */
  onSubmit: (content: string, mentions: string[]) => void;
  /** Callback when input is cancelled */
  onCancel?: () => void;
  /** Show cancel button */
  showCancel?: boolean;
  /** Auto-focus input */
  autoFocus?: boolean;
  /** Initial content (for editing) */
  initialContent?: string;
  /** Submit button text */
  submitLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

export interface CommentListProps {
  /** List of comments */
  comments: Comment[];
  /** Current user */
  currentUser: CommentAuthor;
  /** Available users for mentions */
  availableUsers?: CommentAuthor[];
  /** Filter: show only unresolved */
  showUnresolvedOnly?: boolean;
  /** Filter: show only pinned */
  showPinnedOnly?: boolean;
  /** Filter: by file path */
  filterByFile?: string;
  /** Sort order */
  sortOrder?: "newest" | "oldest" | "activity";
  /** All comment callbacks */
  onReply?: (commentId: string, content: string, mentions: string[]) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onDelete?: (commentId: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onPin?: (commentId: string, pinned: boolean) => void;
  onDeleteReply?: (commentId: string, replyId: string) => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Comment Input
// =============================================================================

export function CommentInput({
  placeholder = "Add a comment...",
  availableUsers = [],
  onSubmit,
  onCancel,
  showCancel = false,
  autoFocus = false,
  initialContent = "",
  submitLabel = "Comment",
  className,
}: CommentInputProps) {
  const [content, setContent] = useState(initialContent);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);

      // Check for @ mentions
      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const afterAt = value.slice(lastAtIndex + 1);
        const spaceIndex = afterAt.indexOf(" ");
        if (spaceIndex === -1) {
          setMentionQuery(afterAt.toLowerCase());
          setShowMentions(true);
          return;
        }
      }
      setShowMentions(false);
    },
    []
  );

  // Filter users for mention dropdown
  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(mentionQuery) ||
        u.id.toLowerCase().includes(mentionQuery)
    );
  }, [availableUsers, mentionQuery]);

  // Insert mention
  const insertMention = useCallback(
    (user: CommentAuthor) => {
      const lastAtIndex = content.lastIndexOf("@");
      const newContent = content.slice(0, lastAtIndex) + `@${user.name} `;
      setContent(newContent);
      setMentions([...mentions, user.id]);
      setShowMentions(false);
      textareaRef.current?.focus();
    },
    [content, mentions]
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;

    // Extract mentions from content
    const mentionMatches = content.match(/@(\w+)/g) || [];
    const extractedMentions = mentionMatches
      .map((m) => m.slice(1))
      .filter((name) => availableUsers.some((u) => u.name === name))
      .map((name) => availableUsers.find((u) => u.name === name)!.id);

    const allMentions = [...new Set([...mentions, ...extractedMentions])];

    onSubmit(content.trim(), allMentions);
    setContent("");
    setMentions([]);
  }, [content, mentions, availableUsers, onSubmit]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && onCancel) {
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div className={cn("relative", className)}>
      <div className="border rounded-lg bg-background focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full px-3 py-2 text-sm bg-transparent resize-none focus:outline-none min-h-[60px]"
        />

        {/* Actions bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/30">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowMentions(!showMentions)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Mention someone"
            >
              <AtSign className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {showCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
              {submitLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Mention dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.isAi ? "AI" : getInitials(user.name)}
              </div>
              <span className="text-sm">{user.name}</span>
              {user.isAi && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                  AI
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Comment Thread
// =============================================================================

export function CommentThread({
  comment,
  currentUser,
  availableUsers = [],
  onReply,
  onResolve,
  onDelete,
  onEdit,
  onPin,
  onDeleteReply,
  compact = false,
  showTarget = true,
  className,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isOwner = comment.author.id === currentUser.id;

  // Handle reply submit
  const handleReply = useCallback(
    (content: string, mentions: string[]) => {
      onReply?.(comment.id, content, mentions);
      setShowReplyInput(false);
    },
    [comment.id, onReply]
  );

  // Handle edit submit
  const handleEdit = useCallback(
    (content: string) => {
      onEdit?.(comment.id, content);
      setIsEditing(false);
    },
    [comment.id, onEdit]
  );

  return (
    <div
      className={cn(
        "border rounded-lg",
        comment.resolved && "opacity-60",
        comment.pinned && "border-yellow-500/50 bg-yellow-500/5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Avatar */}
        <div
          className={cn(
            "rounded-full flex items-center justify-center text-white font-medium flex-shrink-0",
            compact ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
          )}
          style={{ backgroundColor: comment.author.color }}
        >
          {comment.author.isAi ? "AI" : getInitials(comment.author.name)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.author.name}</span>
            {comment.author.isAi && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                AI
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
            {comment.pinned && <Pin className="w-3 h-3 text-yellow-500" />}
          </div>

          {isEditing ? (
            <CommentInput
              initialContent={comment.content}
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              showCancel
              autoFocus
              submitLabel="Save"
              availableUsers={availableUsers}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {renderContentWithMentions(comment.content)}
            </p>
          )}

          {/* Target info */}
          {showTarget && comment.target && !compact && (
            <div className="mt-2 text-xs text-muted-foreground">
              {comment.target.type === "line" && comment.target.lineNumber && (
                <span>Line {comment.target.lineNumber}</span>
              )}
              {comment.target.type === "file" && comment.target.filePath && (
                <span>{comment.target.filePath}</span>
              )}
              {comment.target.type === "element" && comment.target.selector && (
                <span>{comment.target.selector}</span>
              )}
            </div>
          )}

          {/* Resolved badge */}
          {comment.resolved && comment.resolvedBy && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Resolved by {comment.resolvedBy.name}{" "}
                {comment.resolvedAt && formatRelativeTime(comment.resolvedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Resolve button */}
          <button
            onClick={() => onResolve?.(comment.id, !comment.resolved)}
            className={cn(
              "p-1.5 rounded hover:bg-muted",
              comment.resolved ? "text-green-500" : "text-muted-foreground"
            )}
            title={comment.resolved ? "Unresolve" : "Resolve"}
          >
            {comment.resolved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                <button
                  onClick={() => {
                    setShowReplyInput(true);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    onPin?.(comment.id, !comment.pinned);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {comment.pinned ? "Unpin" : "Pin"}
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      onDelete?.(comment.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-500 hover:bg-muted"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="border-t">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              currentUser={currentUser}
              onDelete={
                onDeleteReply
                  ? () => onDeleteReply(comment.id, reply.id)
                  : undefined
              }
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="p-3 border-t bg-muted/30">
          <CommentInput
            placeholder="Write a reply..."
            onSubmit={handleReply}
            onCancel={() => setShowReplyInput(false)}
            showCancel
            autoFocus
            submitLabel="Reply"
            availableUsers={availableUsers}
          />
        </div>
      )}

      {/* Quick reply button */}
      {!showReplyInput && !compact && (
        <button
          onClick={() => setShowReplyInput(true)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border-t"
        >
          <Reply className="w-3.5 h-3.5" />
          Reply
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Reply Item
// =============================================================================

interface ReplyItemProps {
  reply: CommentReply;
  currentUser: CommentAuthor;
  onDelete?: () => void;
  compact: boolean;
}

function ReplyItem({ reply, currentUser, onDelete, compact }: ReplyItemProps) {
  const isOwner = reply.author.id === currentUser.id;

  return (
    <div className="flex items-start gap-2 px-3 py-2 pl-12 hover:bg-muted/30">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white flex-shrink-0"
        style={{ backgroundColor: reply.author.color }}
      >
        {reply.author.isAi ? "AI" : getInitials(reply.author.name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">{reply.author.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(reply.createdAt)}
          </span>
        </div>
        <p className="text-xs mt-0.5">{renderContentWithMentions(reply.content)}</p>
      </div>

      {isOwner && onDelete && (
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Comment List
// =============================================================================

export function CommentList({
  comments,
  currentUser,
  availableUsers = [],
  showUnresolvedOnly = false,
  showPinnedOnly = false,
  filterByFile,
  sortOrder = "newest",
  onReply,
  onResolve,
  onDelete,
  onEdit,
  onPin,
  onDeleteReply,
  compact = false,
  className,
}: CommentListProps) {
  // Filter and sort comments
  const filteredComments = useMemo(() => {
    let result = [...comments];

    if (showUnresolvedOnly) {
      result = result.filter((c) => !c.resolved);
    }

    if (showPinnedOnly) {
      result = result.filter((c) => c.pinned);
    }

    if (filterByFile) {
      result = result.filter((c) => c.target?.filePath === filterByFile);
    }

    // Sort
    switch (sortOrder) {
      case "newest":
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "oldest":
        result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case "activity":
        result.sort((a, b) => {
          const aLatest = Math.max(
            a.createdAt.getTime(),
            ...a.replies.map((r) => r.createdAt.getTime())
          );
          const bLatest = Math.max(
            b.createdAt.getTime(),
            ...b.replies.map((r) => r.createdAt.getTime())
          );
          return bLatest - aLatest;
        });
        break;
    }

    // Pinned always first
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    return result;
  }, [comments, showUnresolvedOnly, showPinnedOnly, filterByFile, sortOrder]);

  if (filteredComments.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No comments yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Start a conversation by adding a comment
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {filteredComments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          currentUser={currentUser}
          availableUsers={availableUsers}
          onReply={onReply}
          onResolve={onResolve}
          onDelete={onDelete}
          onEdit={onEdit}
          onPin={onPin}
          onDeleteReply={onDeleteReply}
          compact={compact}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Comment Hook
// =============================================================================

export interface UseCommentsOptions {
  initialComments?: Comment[];
}

export function useComments(options: UseCommentsOptions = {}) {
  const [comments, setComments] = useState<Comment[]>(options.initialComments || []);

  // Add comment
  const addComment = useCallback(
    (
      author: CommentAuthor,
      content: string,
      target?: Comment["target"],
      mentions?: string[]
    ): Comment => {
      const newComment: Comment = {
        id: `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        author,
        content,
        createdAt: new Date(),
        resolved: false,
        pinned: false,
        replies: [],
        target,
        mentions,
      };

      setComments((prev) => [newComment, ...prev]);
      return newComment;
    },
    []
  );

  // Add reply
  const addReply = useCallback(
    (commentId: string, author: CommentAuthor, content: string, mentions?: string[]) => {
      const reply: CommentReply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        author,
        content,
        createdAt: new Date(),
        mentions,
      };

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
        )
      );

      return reply;
    },
    []
  );

  // Resolve/unresolve comment
  const resolveComment = useCallback(
    (commentId: string, resolved: boolean, resolvedBy?: CommentAuthor) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                resolved,
                resolvedBy: resolved ? resolvedBy : undefined,
                resolvedAt: resolved ? new Date() : undefined,
              }
            : c
        )
      );
    },
    []
  );

  // Delete comment
  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  // Edit comment
  const editComment = useCallback((commentId: string, content: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, content, updatedAt: new Date() } : c
      )
    );
  }, []);

  // Pin/unpin comment
  const pinComment = useCallback((commentId: string, pinned: boolean) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, pinned } : c))
    );
  }, []);

  // Delete reply
  const deleteReply = useCallback((commentId: string, replyId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: c.replies.filter((r) => r.id !== replyId) }
          : c
      )
    );
  }, []);

  // Get comments by file
  const getCommentsByFile = useCallback(
    (filePath: string) => {
      return comments.filter((c) => c.target?.filePath === filePath);
    },
    [comments]
  );

  // Get unresolved count
  const unresolvedCount = useMemo(
    () => comments.filter((c) => !c.resolved).length,
    [comments]
  );

  return {
    comments,
    addComment,
    addReply,
    resolveComment,
    deleteComment,
    editComment,
    pinComment,
    deleteReply,
    getCommentsByFile,
    unresolvedCount,
    setComments,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function renderContentWithMentions(content: string): React.ReactNode {
  // Simple mention highlighting
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

// =============================================================================
// Export
// =============================================================================

export default CommentThread;
