import { describe, it, expect, vi } from "vitest";
import {
  authenticate,
  callOdoo,
  deployToOdoo,
} from "@/lib/agent-bridge/odoo-xmlrpc-deploy";
import type {
  OdooConnection,
  XmlRpcCall,
  FileUploader,
  DeployOptions,
} from "@/lib/agent-bridge/odoo-xmlrpc-deploy";

const conn: OdooConnection = {
  url: "https://test.odoo.com",
  database: "testdb",
  username: "admin",
  password: "admin",
};

const okXmlrpc: XmlRpcCall = async (_url, _svc, method, args) => {
  if (method === "authenticate") return 1;
  if (method === "execute_kw") {
    const model = args[3] as string;
    const m = args[4] as string;
    if (model === "ir.module.module" && m === "search") return [42];
    if (model === "ir.module.module" && m === "update_list") return true;
    if (model === "ir.module.module" && m === "button_immediate_install") return true;
    if (model === "website" && m === "search") return [1];
    if (model === "website" && m === "write") return true;
  }
  return true;
};

const okUpload: FileUploader = async () => ({ success: true });

const makeOpts = (overrides?: Partial<DeployOptions>): DeployOptions => ({
  connection: conn,
  moduleName: "theme_flavor",
  moduleArchive: "UEsDBBQ=",
  xmlrpc: okXmlrpc,
  upload: okUpload,
  ...overrides,
});

describe("Odoo XML-RPC Deploy", () => {
  describe("authenticate", () => {
    it("returns UID on success", async () => {
      const uid = await authenticate(conn, okXmlrpc);
      expect(uid).toBe(1);
    });

    it("throws on invalid credentials", async () => {
      const failRpc: XmlRpcCall = async () => false;
      await expect(authenticate(conn, failRpc)).rejects.toThrow("Authentication failed");
    });
  });

  describe("callOdoo", () => {
    it("calls execute_kw with proper args", async () => {
      const rpc = vi.fn(async () => [1, 2]);
      await callOdoo(conn, 1, rpc, "res.partner", "search", [[]], {});
      expect(rpc).toHaveBeenCalledWith(
        "https://test.odoo.com/xmlrpc/2/object",
        "object",
        "execute_kw",
        ["testdb", 1, "admin", "res.partner", "search", [[]], {}],
      );
    });
  });

  describe("deployToOdoo", () => {
    it("succeeds when all steps pass", async () => {
      const result = await deployToOdoo(makeOpts());
      expect(result.success).toBe(true);
      expect(result.summary).toContain("Successfully deployed");
      expect(result.themeUrl).toBe("https://test.odoo.com/");
      expect(result.moduleName).toBe("theme_flavor");
    });

    it("includes all deployment steps", async () => {
      const result = await deployToOdoo(makeOpts());
      expect(result.steps.length).toBeGreaterThanOrEqual(5);
      expect(result.steps.every((s) => s.status === "success")).toBe(true);
    });

    it("fails on authentication error", async () => {
      const failRpc: XmlRpcCall = async () => false;
      const result = await deployToOdoo(makeOpts({ xmlrpc: failRpc }));
      expect(result.success).toBe(false);
      expect(result.summary).toContain("Authenticate");
      expect(result.themeUrl).toBeUndefined();
    });

    it("fails on upload error", async () => {
      const failUpload: FileUploader = async () => ({ success: false, error: "Upload rejected" });
      const result = await deployToOdoo(makeOpts({ upload: failUpload }));
      expect(result.success).toBe(false);
      expect(result.steps.find((s) => s.id === "upload")?.error).toBe("Upload rejected");
    });

    it("fails when module not found after upload", async () => {
      const rpc: XmlRpcCall = async (_url, _svc, method, args) => {
        if (method === "authenticate") return 1;
        if (method === "execute_kw") {
          const m = args[4] as string;
          if (m === "search") return []; // module not found
          if (m === "update_list") return true;
        }
        return true;
      };
      const result = await deployToOdoo(makeOpts({ xmlrpc: rpc }));
      expect(result.success).toBe(false);
      expect(result.summary).toContain("Install module");
    });

    it("skips remaining steps after failure", async () => {
      const failUpload: FileUploader = async () => ({ success: false, error: "fail" });
      const result = await deployToOdoo(makeOpts({ upload: failUpload }));
      const skipped = result.steps.filter((s) => s.status === "skipped");
      expect(skipped.length).toBeGreaterThan(0);
    });

    it("calls onStepUpdate for each step", async () => {
      const onStepUpdate = vi.fn();
      await deployToOdoo(makeOpts({ onStepUpdate }));
      // Each step gets at least 2 updates: running + success
      expect(onStepUpdate.mock.calls.length).toBeGreaterThanOrEqual(5);
    });

    it("includes activate step when activateTheme is true", async () => {
      const result = await deployToOdoo(makeOpts({ activateTheme: true }));
      expect(result.steps.some((s) => s.id === "activate")).toBe(true);
      expect(result.steps.find((s) => s.id === "activate")?.status).toBe("success");
    });

    it("omits activate step when activateTheme is false", async () => {
      const result = await deployToOdoo(makeOpts({ activateTheme: false }));
      expect(result.steps.some((s) => s.id === "activate")).toBe(false);
    });

    it("reports total duration", async () => {
      const result = await deployToOdoo(makeOpts());
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("records duration per step", async () => {
      const result = await deployToOdoo(makeOpts());
      for (const step of result.steps) {
        if (step.status === "success") {
          expect(step.durationMs).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("includes detail messages on successful steps", async () => {
      const result = await deployToOdoo(makeOpts());
      const authStep = result.steps.find((s) => s.id === "authenticate");
      expect(authStep?.detail).toContain("UID");
    });
  });
});
