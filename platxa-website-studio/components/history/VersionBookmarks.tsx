"use client";

/**
 * VersionBookmarks Component
 *
 * Allows users to bookmark stable versions and restore from bookmarks.
 * Provides quick access to important milestones in project history.
 *
 * Features:
 * - Bookmark current version
 * - Name and describe bookmarks
 * - View bookmarked versions in history
 * - Restore from any bookmark
 * - Delete unwanted bookmarks
 * - Compare bookmarks
 *
 * Feature #89: UI Enhancements - VersionBookmarks
 */

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Clock,
  RotateCcw,
  Trash2,
  Edit3,
  Check,
  X,
  Star,
  GitBranch,
  MoreHorizontal,
  Search,
  ChevronDown,
  Eye,
  ArrowLeftRight,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Version bookmark */
export interface VersionBookmark {
  id: string;
  versionId: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  isStarred?: boolean;
  tags?: string[];
  snapshot?: {
    pageCount: number;
    componentCount: number;
    previewUrl?: string;
  };
}

/** Current version info */
export interface CurrentVersion {
  id: string;
  timestamp: Date;
  changeCount: number;
  author: string;
}

/** VersionBookmarks props */
export interface VersionBookmarksProps {
  projectId: string;
  bookmarks: VersionBookmark[];
  currentVersion: CurrentVersion;
  onCreateBookmark: (name: string, description?: string) => Promise<VersionBookmark>;
  onDeleteBookmark: (bookmarkId: string) => Promise<void>;
  onRestoreBookmark: (bookmarkId: string) => Promise<void>;
  onUpdateBookmark?: (bookmarkId: string, updates: Partial<Pick<VersionBookmark, "name" | "description" | "isStarred">>) => Promise<void>;
  onPreviewBookmark?: (bookmarkId: string) => void;
  onCompareBookmarks?: (bookmarkId1: string, bookmarkId2: string) => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Create bookmark form */
function CreateBookmarkForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (name: string, description?: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), description.trim() || undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bookmark Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Before major redesign"
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes about this version..."
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create Bookmark"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Bookmark card */
function BookmarkCard({
  bookmark,
  onRestore,
  onDelete,
  onUpdate,
  onPreview,
  isSelected,
  onSelect,
}: {
  bookmark: VersionBookmark;
  onRestore: () => void;
  onDelete: () => void;
  onUpdate?: (updates: Partial<Pick<VersionBookmark, "name" | "description" | "isStarred">>) => void;
  onPreview?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(bookmark.name);
  const [editDescription, setEditDescription] = useState(bookmark.description || "");

  const handleSaveEdit = () => {
    if (onUpdate && editName.trim()) {
      onUpdate({
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
    }
    setIsEditing(false);
  };

  const handleToggleStar = () => {
    onUpdate?.({ isStarred: !bookmark.isStarred });
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editName.trim()}
              className="p-1.5 text-green-600 hover:text-green-700 rounded disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isSelected
          ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for comparison */}
        {onSelect && (
          <button
            onClick={onSelect}
            className={`mt-1 w-4 h-4 rounded border ${
              isSelected
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-300 dark:border-gray-600"
            } flex items-center justify-center`}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        )}

        {/* Bookmark icon */}
        <div className={`p-2 rounded-lg ${
          bookmark.isStarred
            ? "bg-amber-100 dark:bg-amber-900/30"
            : "bg-gray-100 dark:bg-gray-800"
        }`}>
          {bookmark.isStarred ? (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          ) : (
            <Bookmark className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {bookmark.name}
            </h4>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex gap-1">
                {bookmark.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {bookmark.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
              {bookmark.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(bookmark.createdAt)}
            </span>
            {bookmark.snapshot && (
              <>
                <span>{bookmark.snapshot.pageCount} pages</span>
                <span>{bookmark.snapshot.componentCount} components</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onRestore}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            title="Restore this version"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  {onPreview && (
                    <button
                      onClick={() => { onPreview(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                  )}
                  {onUpdate && (
                    <>
                      <button
                        onClick={() => { handleToggleStar(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <Star className={`w-4 h-4 ${bookmark.isStarred ? "fill-amber-500 text-amber-500" : ""}`} />
                        {bookmark.isStarred ? "Unstar" : "Star"}
                      </button>
                      <button
                        onClick={() => { setIsEditing(true); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 last:rounded-b-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function VersionBookmarks({
  projectId,
  bookmarks,
  currentVersion,
  onCreateBookmark,
  onDeleteBookmark,
  onRestoreBookmark,
  onUpdateBookmark,
  onPreviewBookmark,
  onCompareBookmarks,
  className = "",
}: VersionBookmarksProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(new Set());
  const [filterStarred, setFilterStarred] = useState(false);

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let filtered = [...bookmarks];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        b => b.name.toLowerCase().includes(query) ||
             b.description?.toLowerCase().includes(query)
      );
    }

    // Filter starred only
    if (filterStarred) {
      filtered = filtered.filter(b => b.isStarred);
    }

    // Sort: starred first, then by date
    return filtered.sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [bookmarks, searchQuery, filterStarred]);

  const handleCreateBookmark = useCallback(async (name: string, description?: string) => {
    setIsSubmitting(true);
    try {
      await onCreateBookmark(name, description);
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [onCreateBookmark]);

  const handleDeleteBookmark = useCallback(async (bookmarkId: string) => {
    if (confirm("Delete this bookmark? This action cannot be undone.")) {
      await onDeleteBookmark(bookmarkId);
      setSelectedBookmarks(prev => {
        const next = new Set(prev);
        next.delete(bookmarkId);
        return next;
      });
    }
  }, [onDeleteBookmark]);

  const handleRestoreBookmark = useCallback(async (bookmarkId: string) => {
    if (confirm("Restore this version? Current changes will be saved first.")) {
      await onRestoreBookmark(bookmarkId);
    }
  }, [onRestoreBookmark]);

  const toggleBookmarkSelection = useCallback((bookmarkId: string) => {
    setSelectedBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId);
      } else if (next.size < 2) {
        next.add(bookmarkId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedBookmarks.size === 2 && onCompareBookmarks) {
      const [id1, id2] = Array.from(selectedBookmarks);
      onCompareBookmarks(id1, id2);
    }
  }, [selectedBookmarks, onCompareBookmarks]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Version Bookmarks
              </h2>
              <p className="text-sm text-gray-500">
                {bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <BookmarkPlus className="w-4 h-4" />
              Bookmark Current
            </button>
          )}
        </div>

        {/* Create form */}
        {isCreating && (
          <CreateBookmarkForm
            onSubmit={handleCreateBookmark}
            onCancel={() => setIsCreating(false)}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Search and filters */}
        {!isCreating && bookmarks.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setFilterStarred(!filterStarred)}
              className={`p-2 rounded-lg border transition-colors ${
                filterStarred
                  ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              title={filterStarred ? "Show all" : "Show starred only"}
            >
              <Star className={`w-4 h-4 ${filterStarred ? "fill-amber-500" : ""}`} />
            </button>

            {onCompareBookmarks && selectedBookmarks.size === 2 && (
              <button
                onClick={handleCompare}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Compare
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bookmarks list */}
      <div className="p-6">
        {filteredBookmarks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500">
              {searchQuery || filterStarred
                ? "No bookmarks match your filters"
                : "No bookmarks yet"}
            </p>
            {!searchQuery && !filterStarred && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Create your first bookmark
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map(bookmark => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onRestore={() => handleRestoreBookmark(bookmark.id)}
                onDelete={() => handleDeleteBookmark(bookmark.id)}
                onUpdate={onUpdateBookmark ? (updates) => onUpdateBookmark(bookmark.id, updates) : undefined}
                onPreview={onPreviewBookmark ? () => onPreviewBookmark(bookmark.id) : undefined}
                isSelected={selectedBookmarks.has(bookmark.id)}
                onSelect={onCompareBookmarks ? () => toggleBookmarkSelection(bookmark.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VersionBookmarks;
