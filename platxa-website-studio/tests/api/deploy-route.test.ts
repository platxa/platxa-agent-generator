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

vi.mock("@/lib/agent-bridge/odoo-xmlrpc-deploy", () => ({
  deployToOdoo: vi.fn(),
  authenticate: vi.fn(),
}));

import { GET, POST } from "@/app/api/deploy/route";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/utils/api-rate-limit";
import { deployToOdoo } from "@/lib/agent-bridge/odoo-xmlrpc-deploy";

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost:3000/api/deploy", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });
}

function makeGet(params?: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/deploy");
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

const validBody = {
  moduleName: "theme_test",
  moduleArchive: "UEsDBBQ=",
  apiKey: "key_123",
};

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user, rate limit allowed
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", name: "Test" }, expires: "" } as any);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 30000 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 when moduleName is missing", async () => {
    const res = await POST(makeRequest({ moduleArchive: "UEsDBBQ=", apiKey: "k" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("moduleName");
  });

  it("returns 400 when moduleArchive is missing", async () => {
    const res = await POST(makeRequest({ moduleName: "theme_x", apiKey: "k" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("moduleArchive");
  });

  it("returns 400 when apiKey missing and env not set", async () => {
    const orig = process.env.ODOO_API_KEY;
    delete process.env.ODOO_API_KEY;
    const res = await POST(makeRequest({ moduleName: "theme_x", moduleArchive: "UEsDBBQ=" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("API key");
    process.env.ODOO_API_KEY = orig;
  });

  it("returns 200 on successful deploy", async () => {
    vi.mocked(deployToOdoo).mockResolvedValue({ success: true, moduleId: 42 } as any);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 when deployToOdoo reports failure", async () => {
    vi.mocked(deployToOdoo).mockResolvedValue({ success: false, error: "install failed" } as any);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 500 when deployToOdoo throws", async () => {
    vi.mocked(deployToOdoo).mockRejectedValue(new Error("network down"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("network down");
  });
});

describe("GET /api/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_ODOO_URL;
  });

  it("returns connected:false when no odooUrl configured", async () => {
    const res = await GET(makeGet());
    const json = await res.json();
    expect(json.connected).toBe(false);
    expect(json.error).toContain("No Odoo URL");
  });

  it("returns connected:true when Odoo is reachable", async () => {
    // global.fetch is mocked in setup.ts — returns ok:true by default
    const res = await GET(makeGet({ url: "http://odoo.test" }));
    const json = await res.json();
    expect(json.connected).toBe(true);
    expect(json.url).toBe("http://odoo.test");
  });

  it("returns connected:false when Odoo fetch throws", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await GET(makeGet({ url: "http://odoo.test" }));
    const json = await res.json();
    expect(json.connected).toBe(false);
    expect(json.error).toContain("ECONNREFUSED");
  });
});
