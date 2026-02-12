import { describe, it, expect, beforeEach } from "vitest";
import { useSyncStore } from "@/lib/stores/sync-store";

/**
 * Tests for the Zustand sync store.
 * Uses getState() to read and actions to mutate — no DOM needed.
 */

function getState() {
  return useSyncStore.getState();
}

describe("useSyncStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    getState().reset();
  });

  // ── Initial state ────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct defaults", () => {
      const s = getState();
      expect(s.status).toBe("disconnected");
      expect(s.connectionError).toBeNull();
      expect(s.sidecarUrl).toBeNull();
      expect(s.authToken).toBeNull();
      expect(s.isDeploying).toBe(false);
      expect(s.previewUrl).toBeNull();
      expect(s.previewStatus).toBe("loading");
    });
  });

  // ── connect / disconnect ─────────────────────────────────────────────

  describe("connect()", () => {
    it("sets sidecarUrl, authToken, and status to connecting", () => {
      getState().connect("http://localhost:9000", "tok_abc");
      const s = getState();
      expect(s.sidecarUrl).toBe("http://localhost:9000");
      expect(s.authToken).toBe("tok_abc");
      expect(s.status).toBe("connecting");
    });
  });

  describe("disconnect()", () => {
    it("sets status to disconnected and clears sidecarUrl/authToken", () => {
      getState().connect("http://localhost:9000", "tok_abc");
      getState().disconnect();
      const s = getState();
      expect(s.status).toBe("disconnected");
      expect(s.sidecarUrl).toBeNull();
      expect(s.authToken).toBeNull();
    });
  });

  // ── setStatus ────────────────────────────────────────────────────────

  describe("setStatus()", () => {
    it("sets status to connected, connectionError stays null", () => {
      getState().setStatus("connected");
      const s = getState();
      expect(s.status).toBe("connected");
      expect(s.connectionError).toBeNull();
    });

    it("sets status to error with connectionError message", () => {
      getState().setStatus("error", "timeout");
      const s = getState();
      expect(s.status).toBe("error");
      expect(s.connectionError).toBe("timeout");
    });

    it("clears connectionError when transitioning from error to connected", () => {
      getState().setStatus("error", "timeout");
      expect(getState().connectionError).toBe("timeout");

      getState().setStatus("connected");
      expect(getState().connectionError).toBeNull();
    });

    it("sets status to syncing", () => {
      getState().setStatus("syncing");
      expect(getState().status).toBe("syncing");
    });
  });

  // ── addDeployEvent ───────────────────────────────────────────────────

  describe("addDeployEvent()", () => {
    it("deploy_started sets isDeploying to true", () => {
      getState().addDeployEvent({ type: "deploy_started" });
      expect(getState().isDeploying).toBe(true);
    });

    it("deploy_progress keeps isDeploying unchanged (true)", () => {
      getState().addDeployEvent({ type: "deploy_started" });
      getState().addDeployEvent({ type: "deploy_progress", progress: 50 });
      expect(getState().isDeploying).toBe(true);
    });

    it("deploy_complete sets isDeploying to false", () => {
      getState().addDeployEvent({ type: "deploy_started" });
      getState().addDeployEvent({ type: "deploy_complete" });
      expect(getState().isDeploying).toBe(false);
    });

    it("deploy_error sets isDeploying to false", () => {
      getState().addDeployEvent({ type: "deploy_started" });
      getState().addDeployEvent({ type: "deploy_error", error: "fail" });
      expect(getState().isDeploying).toBe(false);
    });

    it("full lifecycle: started -> progress -> complete", () => {
      getState().addDeployEvent({ type: "deploy_started" });
      expect(getState().isDeploying).toBe(true);

      getState().addDeployEvent({ type: "deploy_progress", progress: 25 });
      expect(getState().isDeploying).toBe(true);

      getState().addDeployEvent({ type: "deploy_progress", progress: 75 });
      expect(getState().isDeploying).toBe(true);

      getState().addDeployEvent({ type: "deploy_complete" });
      expect(getState().isDeploying).toBe(false);
    });
  });

  // ── setPreviewStatus ─────────────────────────────────────────────────

  describe("setPreviewStatus()", () => {
    it("sets previewStatus to ready", () => {
      getState().setPreviewStatus("ready");
      expect(getState().previewStatus).toBe("ready");
    });

    it("sets previewStatus to error", () => {
      getState().setPreviewStatus("error");
      expect(getState().previewStatus).toBe("error");
    });
  });

  // ── reset ────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("returns all fields to initial state", () => {
      const s = getState();
      expect(s.status).toBe("disconnected");
      expect(s.connectionError).toBeNull();
      expect(s.sidecarUrl).toBeNull();
      expect(s.authToken).toBeNull();
      expect(s.isDeploying).toBe(false);
      expect(s.previewUrl).toBeNull();
      expect(s.previewStatus).toBe("loading");
    });

    it("clears everything after multiple mutations", () => {
      const store = getState();
      store.connect("http://host", "tok");
      store.setStatus("error", "boom");
      store.addDeployEvent({ type: "deploy_started" });
      store.setPreviewStatus("error");

      // Verify mutations took effect
      expect(getState().status).toBe("error");
      expect(getState().connectionError).toBe("boom");
      expect(getState().isDeploying).toBe(true);
      expect(getState().previewStatus).toBe("error");

      // Reset and verify
      getState().reset();
      const s = getState();
      expect(s.status).toBe("disconnected");
      expect(s.connectionError).toBeNull();
      expect(s.sidecarUrl).toBeNull();
      expect(s.authToken).toBeNull();
      expect(s.isDeploying).toBe(false);
      expect(s.previewUrl).toBeNull();
      expect(s.previewStatus).toBe("loading");
    });
  });
});
