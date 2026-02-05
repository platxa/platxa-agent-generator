"use client";

/**
 * ExternalReferencesEditor Component
 *
 * Manage external references including API docs, design systems, and internal tools.
 * Allows adding, editing, and organizing reference links with categories.
 *
 * Features:
 * - Add/edit/remove reference links
 * - URL validation with fetch status check
 * - Category organization (API Docs, Design Systems, Tools, etc.)
 * - Drag-and-drop reordering
 * - Search and filter
 * - Import/export references
 * - Bookmark-style card display
 *
 * Feature #34: Custom Knowledge - External references section
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Search,
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  BookOpen,
  Palette,
  Wrench,
  Code2,
  FileText,
  Globe,
  Database,
  Server,
  Shield,
  Folder,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Star,
  StarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/** Reference categories */
export type ReferenceCategory =
  | "api-docs"
  | "design-system"
  | "internal-tools"
  | "documentation"
  | "libraries"
  | "infrastructure"
  | "security"
  | "other";

/** Single reference entry */
export interface Reference {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** URL to the resource */
  url: string;
  /** Description of what this reference contains */
  description: string;
  /** Category for organization */
  category: ReferenceCategory;
  /** Optional tags for filtering */
  tags?: string[];
  /** Whether this is a favorite/pinned reference */
  isFavorite?: boolean;
  /** Last verified timestamp */
  lastVerified?: number;
  /** Verification status */
  status?: "valid" | "invalid" | "unknown";
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
}

/** Category metadata */
export interface CategoryInfo {
  id: ReferenceCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

/** Editor props */
export interface ExternalReferencesEditorProps {
  /** Initial references */
  initialReferences?: Reference[];
  /** Callback when references change */
  onChange?: (references: Reference[]) => void;
  /** Callback when saving */
  onSave?: (references: Reference[]) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Category definitions */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: "api-docs",
    label: "API Documentation",
    icon: Code2,
    description: "REST APIs, GraphQL schemas, SDK references",
    color: "text-blue-500",
  },
  {
    id: "design-system",
    label: "Design Systems",
    icon: Palette,
    description: "Component libraries, style guides, design tokens",
    color: "text-purple-500",
  },
  {
    id: "internal-tools",
    label: "Internal Tools",
    icon: Wrench,
    description: "Admin panels, dashboards, development utilities",
    color: "text-orange-500",
  },
  {
    id: "documentation",
    label: "Documentation",
    icon: BookOpen,
    description: "Guides, tutorials, knowledge bases",
    color: "text-green-500",
  },
  {
    id: "libraries",
    label: "Libraries",
    icon: Database,
    description: "Package docs, framework references",
    color: "text-yellow-500",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: Server,
    description: "Cloud services, deployment configs, monitoring",
    color: "text-cyan-500",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Auth specs, compliance docs, security guidelines",
    color: "text-red-500",
  },
  {
    id: "other",
    label: "Other",
    icon: Folder,
    description: "Miscellaneous references",
    color: "text-gray-500",
  },
];

/** Get category info by ID */
function getCategoryInfo(id: ReferenceCategory): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

/** Generate unique ID */
function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Validate URL format */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Sub-components
// =============================================================================

/** Reference card display */
interface ReferenceCardProps {
  reference: Reference;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  readOnly?: boolean;
  isDragging?: boolean;
}

function ReferenceCard({
  reference,
  onEdit,
  onDelete,
  onToggleFavorite,
  readOnly,
  isDragging,
}: ReferenceCardProps) {
  const category = getCategoryInfo(reference.category);
  const CategoryIcon = category.icon;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 border-dashed",
        reference.status === "invalid" && "border-destructive/50"
      )}
    >
      {/* Drag handle */}
      {!readOnly && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Category icon */}
      <div className={cn("mt-0.5 p-2 rounded-lg bg-muted", category.color)}>
        <CategoryIcon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{reference.title}</h4>
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary truncate block max-w-[300px]"
            >
              {reference.url}
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onToggleFavorite}
              disabled={readOnly}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                reference.isFavorite ? "text-yellow-500" : "text-muted-foreground"
              )}
              title={reference.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              {reference.isFavorite ? (
                <Star className="h-4 w-4 fill-current" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </button>
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Open link"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {!readOnly && (
              <>
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {reference.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {reference.description}
          </p>
        )}

        {/* Tags and status */}
        <div className="flex items-center gap-2 mt-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-full bg-muted", category.color)}>
            {category.label}
          </span>
          {reference.tags?.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {reference.status === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Invalid URL
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reference form for add/edit */
interface ReferenceFormProps {
  reference?: Reference;
  onSubmit: (reference: Omit<Reference, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function ReferenceForm({ reference, onSubmit, onCancel }: ReferenceFormProps) {
  const [title, setTitle] = useState(reference?.title || "");
  const [url, setUrl] = useState(reference?.url || "");
  const [description, setDescription] = useState(reference?.description || "");
  const [category, setCategory] = useState<ReferenceCategory>(reference?.category || "other");
  const [tags, setTags] = useState(reference?.tags?.join(", ") || "");
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !isValidUrl(value)) {
      setUrlError("Please enter a valid URL");
    } else {
      setUrlError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !url.trim()) return;
    if (!isValidUrl(url)) {
      setUrlError("Please enter a valid URL");
      return;
    }

    onSubmit({
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      category,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isFavorite: reference?.isFavorite || false,
      status: "unknown",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="font-medium">{reference ? "Edit Reference" : "Add Reference"}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-sm font-medium">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., React Documentation"
            required
            className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReferenceCategory)}
            className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">URL *</label>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://..."
          required
          className={cn(
            "w-full mt-1 px-3 py-2 text-sm border rounded bg-background",
            urlError && "border-destructive"
          )}
        />
        {urlError && <p className="mt-1 text-xs text-destructive">{urlError}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this reference contains..."
          rows={2}
          className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background resize-y"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Tags</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated tags (e.g., react, hooks, state)"
          className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
        />
        <p className="mt-1 text-xs text-muted-foreground">Separate tags with commas</p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || !url.trim() || !!urlError}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {reference ? "Update" : "Add"}
        </button>
      </div>
    </form>
  );
}

/** Category group with collapsible references */
interface CategoryGroupProps {
  category: CategoryInfo;
  references: Reference[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  readOnly?: boolean;
  defaultExpanded?: boolean;
}

function CategoryGroup({
  category,
  references,
  onEdit,
  onDelete,
  onToggleFavorite,
  readOnly,
  defaultExpanded = true,
}: CategoryGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const CategoryIcon = category.icon;

  if (references.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-muted/50 rounded transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <CategoryIcon className={cn("h-4 w-4", category.color)} />
        <span className="font-medium">{category.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{references.length}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pl-6">
          {references.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              onEdit={() => onEdit(ref.id)}
              onDelete={() => onDelete(ref.id)}
              onToggleFavorite={() => onToggleFavorite(ref.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ExternalReferencesEditor({
  initialReferences = [],
  onChange,
  onSave,
  readOnly = false,
  className,
}: ExternalReferencesEditorProps) {
  // State
  const [references, setReferences] = useState<Reference[]>(initialReferences);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ReferenceCategory | "all" | "favorites">(
    "all"
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Update references helper
  const updateReferences = useCallback(
    (newReferences: Reference[]) => {
      setReferences(newReferences);
      setHasChanges(true);
      onChange?.(newReferences);
    },
    [onChange]
  );

  // Add reference
  const handleAdd = useCallback(
    (data: Omit<Reference, "id" | "createdAt" | "updatedAt">) => {
      const now = Date.now();
      const newReference: Reference = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      updateReferences([...references, newReference]);
      setIsAdding(false);
    },
    [references, updateReferences]
  );

  // Update reference
  const handleUpdate = useCallback(
    (data: Omit<Reference, "id" | "createdAt" | "updatedAt">) => {
      if (!editingId) return;

      const newReferences = references.map((ref) =>
        ref.id === editingId
          ? { ...ref, ...data, updatedAt: Date.now() }
          : ref
      );
      updateReferences(newReferences);
      setEditingId(null);
    },
    [editingId, references, updateReferences]
  );

  // Delete reference
  const handleDelete = useCallback(
    (id: string) => {
      updateReferences(references.filter((ref) => ref.id !== id));
    },
    [references, updateReferences]
  );

  // Toggle favorite
  const handleToggleFavorite = useCallback(
    (id: string) => {
      const newReferences = references.map((ref) =>
        ref.id === id ? { ...ref, isFavorite: !ref.isFavorite, updatedAt: Date.now() } : ref
      );
      updateReferences(newReferences);
    },
    [references, updateReferences]
  );

  // Export references
  const exportReferences = useCallback(() => {
    const blob = new Blob([JSON.stringify(references, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "external-references.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [references]);

  // Import references
  const importReferences = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Reference[];
        // Merge with existing, avoiding duplicates by URL
        const existingUrls = new Set(references.map((r) => r.url));
        const newRefs = imported.filter((r) => !existingUrls.has(r.url));
        updateReferences([...references, ...newRefs]);
      } catch {
        console.error("Failed to import references");
      }
    };
    input.click();
  }, [references, updateReferences]);

  // Filter references
  const filteredReferences = useMemo(() => {
    let result = references;

    // Filter by category
    if (selectedCategory === "favorites") {
      result = result.filter((ref) => ref.isFavorite);
    } else if (selectedCategory !== "all") {
      result = result.filter((ref) => ref.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ref) =>
          ref.title.toLowerCase().includes(query) ||
          ref.description.toLowerCase().includes(query) ||
          ref.url.toLowerCase().includes(query) ||
          ref.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return result;
  }, [references, selectedCategory, searchQuery]);

  // Group references by category
  const groupedReferences = useMemo(() => {
    const groups: Record<ReferenceCategory, Reference[]> = {
      "api-docs": [],
      "design-system": [],
      "internal-tools": [],
      documentation: [],
      libraries: [],
      infrastructure: [],
      security: [],
      other: [],
    };

    filteredReferences.forEach((ref) => {
      groups[ref.category].push(ref);
    });

    return groups;
  }, [filteredReferences]);

  // Reference being edited
  const editingReference = editingId ? references.find((r) => r.id === editingId) : undefined;

  // Favorite count
  const favoriteCount = references.filter((r) => r.isFavorite).length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Link2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">External References</h2>
            <p className="text-xs text-muted-foreground">
              {references.length} reference{references.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={importReferences}
            disabled={readOnly}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Import"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={exportReferences}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
          {hasChanges && onSave && !readOnly && (
            <button
              onClick={() => {
                onSave(references);
                setHasChanges(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              <Check className="h-4 w-4" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search references..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded bg-background"
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as ReferenceCategory | "all" | "favorites")}
          className="px-3 py-2 text-sm border rounded bg-background"
        >
          <option value="all">All Categories</option>
          <option value="favorites">⭐ Favorites ({favoriteCount})</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>

        {/* Add button */}
        {!readOnly && !isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Reference
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Add/Edit form */}
        {isAdding && (
          <ReferenceForm onSubmit={handleAdd} onCancel={() => setIsAdding(false)} />
        )}

        {editingId && editingReference && (
          <ReferenceForm
            reference={editingReference}
            onSubmit={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        )}

        {/* References list */}
        {!isAdding && !editingId && (
          <>
            {filteredReferences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-muted-foreground">No references found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "Add your first external reference"}
                </p>
              </div>
            ) : selectedCategory === "all" ? (
              // Grouped view
              CATEGORIES.map((cat) => (
                <CategoryGroup
                  key={cat.id}
                  category={cat}
                  references={groupedReferences[cat.id]}
                  onEdit={setEditingId}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                  readOnly={readOnly}
                />
              ))
            ) : (
              // Flat view for filtered results
              <div className="space-y-2">
                {filteredReferences.map((ref) => (
                  <ReferenceCard
                    key={ref.id}
                    reference={ref}
                    onEdit={() => setEditingId(ref.id)}
                    onDelete={() => handleDelete(ref.id)}
                    onToggleFavorite={() => handleToggleFavorite(ref.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {filteredReferences.length} of {references.length} shown
        </span>
        <span>{favoriteCount} favorited</span>
      </div>
    </div>
  );
}

export default ExternalReferencesEditor;
