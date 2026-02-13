import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  generateETag,
  isNotModified,
  notModifiedResponse,
  setCacheHeaders,
  PRIVATE_SHORT,
  PRIVATE_MEDIUM,
  NO_STORE,
} from "@/lib/utils/http-cache";

describe("http-cache utilities", () => {
  describe("generateETag", () => {
    it("produces consistent hashes for same data", () => {
      const data = { id: 1, name: "test" };
      const etag1 = generateETag(data);
      const etag2 = generateETag(data);
      expect(etag1).toBe(etag2);
    });

    it("produces different hashes for different data", () => {
      const etag1 = generateETag({ a: 1 });
      const etag2 = generateETag({ a: 2 });
      expect(etag1).not.toBe(etag2);
    });

    it("returns weak ETag format (W/\"...\")", () => {
      const etag = generateETag("hello");
      expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
    });
  });

  describe("isNotModified", () => {
    it("returns true when ETags match", () => {
      const etag = generateETag({ data: true });
      const req = new Request("http://localhost/test", {
        headers: { "If-None-Match": etag },
      });
      expect(isNotModified(req, etag)).toBe(true);
    });

    it("returns false when ETags do not match", () => {
      const req = new Request("http://localhost/test", {
        headers: { "If-None-Match": 'W/"aaaa"' },
      });
      expect(isNotModified(req, 'W/"bbbb"')).toBe(false);
    });

    it("returns false when no If-None-Match header", () => {
      const req = new Request("http://localhost/test");
      expect(isNotModified(req, 'W/"abc"')).toBe(false);
    });
  });

  describe("notModifiedResponse", () => {
    it("returns 304 status", () => {
      const res = notModifiedResponse();
      expect(res.status).toBe(304);
    });

    it("includes ETag when provided", () => {
      const res = notModifiedResponse('W/"test"');
      expect(res.headers.get("ETag")).toBe('W/"test"');
    });

    it("includes Vary: Authorization", () => {
      const res = notModifiedResponse();
      expect(res.headers.get("Vary")).toBe("Authorization");
    });
  });

  describe("setCacheHeaders", () => {
    it("sets Cache-Control header", () => {
      const response = NextResponse.json({ ok: true });
      setCacheHeaders(response, PRIVATE_SHORT);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=30, stale-while-revalidate=60"
      );
    });

    it("sets ETag when provided", () => {
      const response = NextResponse.json({ ok: true });
      setCacheHeaders(response, PRIVATE_SHORT, 'W/"abc"');
      expect(response.headers.get("ETag")).toBe('W/"abc"');
    });

    it("always includes Authorization in Vary header", () => {
      const response = NextResponse.json({ ok: true });
      setCacheHeaders(response, PRIVATE_SHORT);
      expect(response.headers.get("Vary")).toContain("Authorization");
    });

    it("includes additional Vary headers", () => {
      const response = NextResponse.json({ ok: true });
      setCacheHeaders(response, { ...PRIVATE_SHORT, vary: ["Accept-Language"] });
      const vary = response.headers.get("Vary") || "";
      expect(vary).toContain("Authorization");
      expect(vary).toContain("Accept-Language");
    });
  });

  describe("presets", () => {
    it("PRIVATE_SHORT produces correct header", () => {
      const response = NextResponse.json({});
      setCacheHeaders(response, PRIVATE_SHORT);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=30, stale-while-revalidate=60"
      );
    });

    it("PRIVATE_MEDIUM produces 5-min cache", () => {
      const response = NextResponse.json({});
      setCacheHeaders(response, PRIVATE_MEDIUM);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=300, stale-while-revalidate=600"
      );
    });

    it("NO_STORE produces no-store", () => {
      const response = NextResponse.json({});
      setCacheHeaders(response, NO_STORE);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
