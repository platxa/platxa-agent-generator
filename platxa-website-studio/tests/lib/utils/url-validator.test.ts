import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateUrl, requireValidUrl } from "@/lib/utils/url-validator";

describe("url-validator", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("validateUrl", () => {
    it("accepts valid HTTPS URLs", () => {
      const result = validateUrl("https://odoo.example.com");
      expect(result.valid).toBe(true);
      expect(result.url).toBe("https://odoo.example.com/");
    });

    it("accepts valid HTTPS URL with port and path", () => {
      const result = validateUrl("https://odoo.example.com:8069/web");
      expect(result.valid).toBe(true);
    });

    it("rejects null/undefined/empty input", () => {
      expect(validateUrl(null).valid).toBe(false);
      expect(validateUrl(undefined).valid).toBe(false);
      expect(validateUrl("").valid).toBe(false);
    });

    it("rejects invalid URL format", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    // Protocol checks
    it("rejects file:// protocol", () => {
      const result = validateUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only");
    });

    it("rejects ftp:// protocol", () => {
      const result = validateUrl("ftp://example.com/file");
      expect(result.valid).toBe(false);
    });

    it("rejects javascript: protocol", () => {
      const result = validateUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
    });

    it("allows HTTP in development", () => {
      process.env.NODE_ENV = "development";
      const result = validateUrl("http://odoo.example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects HTTP in production", () => {
      process.env.NODE_ENV = "production";
      const result = validateUrl("http://odoo.example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });

    it("allows HTTP when explicitly opted in", () => {
      process.env.NODE_ENV = "production";
      const result = validateUrl("http://odoo.example.com", { allowHttp: true });
      expect(result.valid).toBe(true);
    });

    // Private IP ranges
    it("rejects 10.* private range", () => {
      const result = validateUrl("https://10.0.0.1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private");
    });

    it("rejects 172.16-31.* private range", () => {
      expect(validateUrl("https://172.16.0.1").valid).toBe(false);
      expect(validateUrl("https://172.31.255.255").valid).toBe(false);
    });

    it("rejects 192.168.* private range", () => {
      const result = validateUrl("https://192.168.1.1");
      expect(result.valid).toBe(false);
    });

    it("rejects 127.* loopback", () => {
      const result = validateUrl("https://127.0.0.1");
      expect(result.valid).toBe(false);
    });

    it("rejects cloud metadata endpoint 169.254.169.254", () => {
      const result = validateUrl("https://169.254.169.254/latest/meta-data");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("169.254");
    });

    // Blocked hostnames
    it("rejects localhost in production", () => {
      process.env.NODE_ENV = "production";
      const result = validateUrl("https://localhost:8069");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("localhost");
    });

    it("rejects 0.0.0.0 in production", () => {
      process.env.NODE_ENV = "production";
      const result = validateUrl("https://0.0.0.0");
      expect(result.valid).toBe(false);
    });

    it("rejects .local hostnames in production", () => {
      process.env.NODE_ENV = "production";
      const result = validateUrl("https://myserver.local:8069");
      expect(result.valid).toBe(false);
      expect(result.error).toContain(".local");
    });

    it("allows localhost in development", () => {
      process.env.NODE_ENV = "development";
      const result = validateUrl("http://localhost:8069");
      expect(result.valid).toBe(true);
    });
  });

  describe("requireValidUrl", () => {
    it("returns validated URL on success", () => {
      const url = requireValidUrl("https://odoo.example.com");
      expect(url).toBe("https://odoo.example.com/");
    });

    it("throws with descriptive message on invalid URL", () => {
      expect(() => requireValidUrl("file:///etc/passwd")).toThrow("Invalid URL");
    });

    it("throws on private IP", () => {
      expect(() => requireValidUrl("https://10.0.0.1")).toThrow("private");
    });
  });
});
