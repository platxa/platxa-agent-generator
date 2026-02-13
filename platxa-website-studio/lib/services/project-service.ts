/**
 * Project Service - Database-backed project management
 */

import { db } from "@/lib/db";
import type { Project, ProjectFile, ProjectSnapshot, ProjectStatus } from "@prisma/client";

export interface CreateProjectInput {
  name: string;
  userId: string;
  description?: string;
  industry?: string;
  colorPalette?: Record<string, string>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  industry?: string;
  colorPalette?: object;
  settings?: object;
  status?: ProjectStatus;
}

export interface SaveFileInput {
  path: string;
  name: string;
  content: string;
  language: string;
  isGenerated?: boolean;
}

export interface PaginationOptions {
  /** Max items per page (clamped to 200) */
  limit?: number;
  /** Cursor for next page */
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const MAX_PAGE_SIZE = 200;

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  return db.project.create({
    data: {
      name: input.name,
      userId: input.userId,
      description: input.description,
      industry: input.industry,
      colorPalette: input.colorPalette,
    },
  });
}

/**
 * Get project by ID with files
 */
export async function getProjectWithFiles(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      files: {
        orderBy: { path: "asc" },
      },
    },
  });
}

/**
 * Get project by ID
 */
export async function getProject(id: string): Promise<Project | null> {
  return db.project.findUnique({
    where: { id },
  });
}

/**
 * Get projects for a user.
 * When `options.limit` is provided, returns paginated results.
 * Default (no options) returns all items for backward compatibility.
 */
export async function getUserProjects(
  userId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<Awaited<ReturnType<typeof db.project.findMany>>[number]> | Awaited<ReturnType<typeof db.project.findMany>>> {
  // No pagination — return all (backward-compatible)
  if (!options?.limit) {
    return db.project.findMany({
      where: { userId, status: { not: "DELETED" } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { files: true, deployments: true } } },
    });
  }

  const limit = Math.min(options.limit, MAX_PAGE_SIZE);

  const items = await db.project.findMany({
    where: { userId, status: { not: "DELETED" } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { files: true, deployments: true } } },
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}

/**
 * Update project
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<Project> {
  return db.project.update({
    where: { id },
    data: input,
  });
}

/**
 * Delete project (soft delete)
 */
export async function deleteProject(id: string): Promise<Project> {
  return db.project.update({
    where: { id },
    data: { status: "DELETED" },
  });
}

/**
 * Save or update a file in the project
 */
export async function saveFile(
  projectId: string,
  input: SaveFileInput
): Promise<ProjectFile> {
  return db.projectFile.upsert({
    where: {
      projectId_path: {
        projectId,
        path: input.path,
      },
    },
    update: {
      content: input.content,
      name: input.name,
      language: input.language,
    },
    create: {
      projectId,
      path: input.path,
      name: input.name,
      content: input.content,
      language: input.language,
      isGenerated: input.isGenerated ?? true,
    },
  });
}

/**
 * Save multiple files at once
 */
export async function saveFiles(
  projectId: string,
  files: SaveFileInput[]
): Promise<ProjectFile[]> {
  const results = await Promise.all(
    files.map((file) => saveFile(projectId, file))
  );

  // Update project timestamp
  await db.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  return results;
}

/**
 * Get files for a project.
 * When `options.limit` is provided, returns paginated results.
 * Default (no options) returns all files (needed by createSnapshot).
 */
export async function getProjectFiles(
  projectId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<ProjectFile> | ProjectFile[]> {
  // No pagination — return all (backward-compatible, used by createSnapshot)
  if (!options?.limit) {
    return db.projectFile.findMany({
      where: { projectId },
      orderBy: { path: "asc" },
    });
  }

  const limit = Math.min(options.limit, MAX_PAGE_SIZE);

  const items = await db.projectFile.findMany({
    where: { projectId },
    orderBy: { path: "asc" },
    take: limit + 1,
    ...(options.cursor
      ? { cursor: { projectId_path: { projectId, path: options.cursor } }, skip: 1 }
      : {}),
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].path : null,
    hasMore,
  };
}

/**
 * Delete a file
 */
export async function deleteFile(projectId: string, path: string): Promise<void> {
  await db.projectFile.delete({
    where: {
      projectId_path: {
        projectId,
        path,
      },
    },
  });
}

/**
 * Create a snapshot of all project files
 */
export async function createSnapshot(
  projectId: string,
  name: string,
  description?: string
): Promise<ProjectSnapshot> {
  const files = await getProjectFiles(projectId);

  const filesData = files.map((f) => ({
    path: f.path,
    name: f.name,
    content: f.content,
    language: f.language,
  }));

  return db.projectSnapshot.create({
    data: {
      projectId,
      name,
      description,
      files: filesData,
    },
  });
}

/**
 * Restore project files from a snapshot
 */
export async function restoreFromSnapshot(
  projectId: string,
  snapshotId: string
): Promise<void> {
  const snapshot = await db.projectSnapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  const files = snapshot.files as unknown as SaveFileInput[];

  // Delete existing files
  await db.projectFile.deleteMany({
    where: { projectId },
  });

  // Restore files from snapshot
  await db.projectFile.createMany({
    data: files.map((f) => ({
      projectId,
      path: f.path,
      name: f.name,
      content: f.content,
      language: f.language,
      isGenerated: true,
    })),
  });
}

/**
 * Get project snapshots
 */
export async function getProjectSnapshots(projectId: string) {
  return db.projectSnapshot.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}
