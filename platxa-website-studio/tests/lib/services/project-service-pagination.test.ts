import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma db before importing the service
const mockFindManyProject = vi.fn();
const mockFindManyFile = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findMany: (...args: unknown[]) => mockFindManyProject(...args),
    },
    projectFile: {
      findMany: (...args: unknown[]) => mockFindManyFile(...args),
    },
  },
}));

import { getUserProjects, getProjectFiles } from "@/lib/services/project-service";

function makeProject(id: string) {
  return {
    id,
    name: `Project ${id}`,
    userId: "user1",
    status: "ACTIVE",
    updatedAt: new Date(),
    _count: { files: 3, deployments: 1 },
  };
}

function makeFile(path: string) {
  return {
    id: `file-${path}`,
    projectId: "proj1",
    path,
    name: path.split("/").pop(),
    content: "content",
    language: "xml",
  };
}

describe("getUserProjects pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default (no options) returns all items (backward-compatible array)", async () => {
    const allProjects = [makeProject("1"), makeProject("2"), makeProject("3")];
    mockFindManyProject.mockResolvedValue(allProjects);

    const result = await getUserProjects("user1");

    // Should return array directly (not paginated wrapper)
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    // Should NOT include take/cursor in the query
    expect(mockFindManyProject).toHaveBeenCalledWith(
      expect.not.objectContaining({ take: expect.anything() })
    );
  });

  it("respects limit parameter", async () => {
    const twoItems = [makeProject("1"), makeProject("2")];
    mockFindManyProject.mockResolvedValue(twoItems);

    const result = await getUserProjects("user1", { limit: 2 });

    // Should pass take: limit + 1
    expect(mockFindManyProject).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );
    expect(!Array.isArray(result) && "items" in result).toBe(true);
  });

  it("clamps limit to max 200", async () => {
    mockFindManyProject.mockResolvedValue([]);

    await getUserProjects("user1", { limit: 999 });

    expect(mockFindManyProject).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }) // 200 + 1
    );
  });

  it("returns hasMore=true when more items exist", async () => {
    // Return 4 items when limit=3 (take=4) → hasMore=true
    const items = [makeProject("1"), makeProject("2"), makeProject("3"), makeProject("4")];
    mockFindManyProject.mockResolvedValue(items);

    const result = await getUserProjects("user1", { limit: 3 });

    expect(!Array.isArray(result) && result.hasMore).toBe(true);
    expect(!Array.isArray(result) && result.items).toHaveLength(3);
  });

  it("returns nextCursor when hasMore", async () => {
    const items = [makeProject("a"), makeProject("b"), makeProject("c"), makeProject("d")];
    mockFindManyProject.mockResolvedValue(items);

    const result = await getUserProjects("user1", { limit: 3 });

    expect(!Array.isArray(result) && result.nextCursor).toBe("c");
  });

  it("returns hasMore=false on last page", async () => {
    const items = [makeProject("x"), makeProject("y")];
    mockFindManyProject.mockResolvedValue(items);

    const result = await getUserProjects("user1", { limit: 5 });

    expect(!Array.isArray(result) && result.hasMore).toBe(false);
    expect(!Array.isArray(result) && result.nextCursor).toBeNull();
  });

  it("cursor-based pagination passes cursor to query", async () => {
    mockFindManyProject.mockResolvedValue([]);

    await getUserProjects("user1", { limit: 10, cursor: "proj-42" });

    expect(mockFindManyProject).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "proj-42" },
        skip: 1,
      })
    );
  });
});

describe("getProjectFiles pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default (no options) returns all files (backward-compatible array)", async () => {
    const allFiles = [makeFile("a.xml"), makeFile("b.scss")];
    mockFindManyFile.mockResolvedValue(allFiles);

    const result = await getProjectFiles("proj1");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("respects limit parameter", async () => {
    mockFindManyFile.mockResolvedValue([makeFile("a.xml")]);

    const result = await getProjectFiles("proj1", { limit: 1 });

    expect(mockFindManyFile).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }) // limit + 1
    );
    expect(!Array.isArray(result) && "items" in result).toBe(true);
  });

  it("returns hasMore=true when more files exist", async () => {
    const files = [makeFile("a.xml"), makeFile("b.xml"), makeFile("c.xml")];
    mockFindManyFile.mockResolvedValue(files);

    const result = await getProjectFiles("proj1", { limit: 2 });

    expect(!Array.isArray(result) && result.hasMore).toBe(true);
    expect(!Array.isArray(result) && result.items).toHaveLength(2);
  });

  it("returns nextCursor as file path when hasMore", async () => {
    const files = [makeFile("a.xml"), makeFile("b.xml"), makeFile("c.xml")];
    mockFindManyFile.mockResolvedValue(files);

    const result = await getProjectFiles("proj1", { limit: 2 });

    expect(!Array.isArray(result) && result.nextCursor).toBe("b.xml");
  });

  it("empty result returns hasMore=false, nextCursor=null", async () => {
    mockFindManyFile.mockResolvedValue([]);

    const result = await getProjectFiles("proj1", { limit: 10 });

    expect(!Array.isArray(result) && result.hasMore).toBe(false);
    expect(!Array.isArray(result) && result.nextCursor).toBeNull();
  });

  it("cursor-based pagination passes compound cursor to query", async () => {
    mockFindManyFile.mockResolvedValue([]);

    await getProjectFiles("proj1", { limit: 10, cursor: "static/src/scss/theme.scss" });

    expect(mockFindManyFile).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { projectId_path: { projectId: "proj1", path: "static/src/scss/theme.scss" } },
        skip: 1,
      })
    );
  });
});
