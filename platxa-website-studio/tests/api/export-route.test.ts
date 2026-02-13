import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be before route import) ────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/utils/api-rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
  ),
}));

vi.mock("@/lib/export", () => ({
  exportTheme: vi.fn(),
  validateBeforeExport: vi.fn().mockReturnValue({
    valid: true, errors: [], warnings: [], canExport: true,
    validation: { valid: true, issues: [], stats: { errors: 0, warnings: 0 } },
    message: "OK",
  }),
  exportAsJson: vi.fn().mockReturnValue({
    themeName: "theme_test",
    files: [],
    exportedAt: "2026-01-01T00:00:00.000Z",
    version: "1.0.0",
  }),
}));

vi.mock("@/lib/ai/quality-checker", () => ({
  processGeneratedFiles: vi.fn().mockImplementation((files: any[]) => ({
    files,
    quality: { issues: [], fixedFiles: files },
    structure: { valid: true, fixedFiles: files },
  })),
}));

vi.mock("@/lib/ai/parser", () => ({
  ensureRequiredFiles: vi.fn().mockImplementation((files: any[]) => files),
  consolidateExportFiles: vi.fn().mockImplementation((files: any[]) => files),
}));

vi.mock("@/lib/ai/theme-assembler", () => ({
  assembleThemeFiles: vi.fn().mockImplementation((files: any[]) => files),
}));

vi.mock("@/lib/security/code-scanner", () => ({
  scanFiles: vi.fn().mockReturnValue({
    passed: true,
    issues: [],
    scannedFiles: 1,
    scanDuration: 5,
  }),
}));

vi.mock("@/lib/validators/scss-validator", () => ({
  validateScssBatch: vi.fn().mockReturnValue({
    allValid: true,
    results: [],
    totalErrors: 0,
  }),
}));

import { GET, POST } from "@/app/api/export/route";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/utils/api-rate-limit";
import { exportTheme } from "@/lib/export";
import { scanFiles } from "@/lib/security/code-scanner";
import { validateScssBatch } from "@/lib/validators/scss-validator";

// ── Helpers ────────────────────────────────────────────────────────────

function makePost(body?: unknown): Request {
  const hasBody = body !== undefined;
  return new Request("http://localhost:3000/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: hasBody ? (typeof body === "string" ? body : JSON.stringify(body)) : "",
  });
}

function makeGet(params?: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/export");
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

const validFile = { path: "views/layout.xml", content: "<t/>", type: "xml" };

const validBody = {
  themeName: "theme_my_site",
  files: [validFile],
};

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", name: "Test" }, expires: "" } as any);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 });
    vi.mocked(scanFiles).mockReturnValue({ passed: true, issues: [], scannedFiles: 1, scanDuration: 5 });
  });

  // ── Auth & rate limit ──────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 30000 });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(429);
  });

  // ── Body validation ────────────────────────────────────────────────

  it("returns 400 for empty body", async () => {
    const req = new Request("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("empty");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON");
  });

  it("returns 400 when themeName is missing", async () => {
    const res = await POST(makePost({ files: [validFile] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("themeName");
  });

  it("returns 400 when files array is empty", async () => {
    const res = await POST(makePost({ themeName: "theme_x", files: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("files");
  });

  // ── Theme name format ──────────────────────────────────────────────

  it("returns 400 for invalid themeName format (MyTheme)", async () => {
    const res = await POST(makePost({ themeName: "MyTheme", files: [validFile] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("theme_name");
  });

  it("passes validation for valid themeName (theme_my_site)", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zip"]),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(200);
  });

  // ── Security scan ──────────────────────────────────────────────────

  it("returns 400 when critical security issues found", async () => {
    vi.mocked(scanFiles).mockReturnValue({
      passed: false,
      issues: [{ id: "XSS-001", severity: "critical", message: "XSS in template", file: "x.xml", line: 1, rule: "xss" }],
      scannedFiles: 1,
      scanDuration: 3,
    } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Security scan failed");
  });

  // ── Successful exports ─────────────────────────────────────────────

  it("returns ZIP blob on successful export", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zipdata"], { type: "application/zip" }),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("theme_my_site.zip");
  });

  it("returns JSON when format=json requested", async () => {
    const res = await POST(makePost({ ...validBody, options: { format: "json" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const json = await res.json();
    expect(json.themeName).toBe("theme_test");
  });

  it("returns 500 when exportTheme fails", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: false,
      error: "ZIP creation failed",
      stats: { fileCount: 0, totalSize: 0, validationErrors: 0, validationWarnings: 0 },
    });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("ZIP creation failed");
  });

  // ── SCSS validation (warn-only) ───────────────────────────────────

  it("sets no SCSS headers when all SCSS is valid", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zip"]),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    vi.mocked(validateScssBatch).mockReturnValue({
      allValid: true,
      results: [],
      totalErrors: 0,
    });
    const body = {
      themeName: "theme_my_site",
      files: [{ path: "static/src/scss/theme.scss", content: "body { color: red; }", type: "scss" }],
    };
    const res = await POST(makePost(body));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Scss-Errors")).toBeNull();
  });

  it("sets X-Scss-Errors header when SCSS has errors but still exports", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zip"]),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    vi.mocked(validateScssBatch).mockReturnValue({
      allValid: false,
      results: [{
        valid: false,
        file: "theme.scss",
        errors: [{ message: "Invalid property", line: 5, column: 1, file: "theme.scss", context: null }],
        css: null,
      }],
      totalErrors: 1,
    });
    const body = {
      themeName: "theme_my_site",
      files: [{ path: "static/src/scss/theme.scss", content: "body { invalid; }", type: "scss" }],
    };
    const res = await POST(makePost(body));
    // Export still succeeds (warn-only)
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Scss-Errors")).toBe("1");
    expect(res.headers.get("X-Scss-Warnings")).toContain("Invalid property");
  });

  it("calls validateScssBatch with Odoo variable stubs prepended", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zip"]),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    const body = {
      themeName: "theme_my_site",
      files: [{ path: "static/src/scss/primary_variables.scss", content: "$custom: red;", type: "scss" }],
    };
    await POST(makePost(body));
    expect(validateScssBatch).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(validateScssBatch).mock.calls[0][0];
    expect(callArg[0].content).toContain("$o-color-palettes");
    expect(callArg[0].content).toContain("$o-color-1");
    expect(callArg[0].content).toContain("$custom: red;");
  });

  it("does not call validateScssBatch when no SCSS files present", async () => {
    vi.mocked(exportTheme).mockResolvedValue({
      success: true,
      blob: new Blob(["zip"]),
      stats: { fileCount: 1, totalSize: 100, validationErrors: 0, validationWarnings: 0 },
    });
    const body = {
      themeName: "theme_my_site",
      files: [{ path: "views/layout.xml", content: "<t/>", type: "xml" }],
    };
    await POST(makePost(body));
    expect(validateScssBatch).not.toHaveBeenCalled();
  });
});

describe("GET /api/export", () => {
  it("returns endpoint info when no themeName", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.endpoint).toBe("/api/export");
    expect(json.methods).toBeDefined();
  });

  it("returns status ready when themeName provided", async () => {
    const res = await GET(makeGet({ themeName: "theme_acme" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ready");
    expect(json.themeName).toBe("theme_acme");
  });
});
