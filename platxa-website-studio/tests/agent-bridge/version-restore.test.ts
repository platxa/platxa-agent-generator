import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VersionRestoreService,
  createVersionRestoreService,
  quickRestore,
  canRestoreVersion,
  getRestoreTarget,
  RESTORE_MESSAGES,
  RESTORE_STATE_LABELS,
  type PreviewUpdateCallback,
} from "@/lib/agent-bridge/version-restore";
import { createTimeline, addSnapshot, resetSnapshotCounter } from "@/lib/agent-bridge/snapshot-timeline";

describe("VersionRestoreService", () => {
  beforeEach(() => {
    resetSnapshotCounter();
  });

  describe("one-click restore to previous version (Feature #105)", () => {
    it("click version → confirmation → files restored → preview updated", () => {
      // Feature #105: Full workflow verification
      const service = createVersionRestoreService();
      const previewCallback = vi.fn();
      service.setPreviewCallback(previewCallback);

      // Create timeline with versions
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<v1>", ".v1{}", "Version 1");
      timeline = addSnapshot(timeline, "<v2>", ".v2{}", "Version 2");

      const v1 = timeline.snapshots[0];

      // Step 1: Click version - request restore
      service.requestRestore(v1.id, 0, timeline);
      expect(service.isPendingConfirmation()).toBe(true);

      // Step 2: Confirm - files restored
      const { result, updatedTimeline } = service.confirmRestore(timeline);

      expect(result.success).toBe(true);
      expect(result.restoredSnapshot?.id).toBe(v1.id);
      expect(result.html).toBe("<v1>");
      expect(result.scss).toBe(".v1{}");

      // Step 3: Preview updated
      expect(previewCallback).toHaveBeenCalledWith("<v1>", ".v1{}");
      expect(service.getConfirmationState()).toBe("completed");
    });

    it("oneClickRestore combines request + confirm", () => {
      // Feature #105: One-click restore shortcut
      const service = createVersionRestoreService();
      const previewCallback = vi.fn();
      service.setPreviewCallback(previewCallback);

      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<old>", ".old{}", "Old Version");
      timeline = addSnapshot(timeline, "<new>", ".new{}", "New Version");

      const { result } = service.oneClickRestore(
        timeline.snapshots[0].id,
        0,
        timeline
      );

      expect(result.success).toBe(true);
      expect(previewCallback).toHaveBeenCalled();
    });
  });

  describe("workflow states", () => {
    it("starts in idle state", () => {
      const service = createVersionRestoreService();
      expect(service.getConfirmationState()).toBe("idle");
    });

    it("transitions to pending_confirmation on request", () => {
      const service = createVersionRestoreService();
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "Test");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);

      expect(service.getConfirmationState()).toBe("pending_confirmation");
      expect(service.isPendingConfirmation()).toBe(true);
    });

    it("transitions to completed after confirm", () => {
      const service = createVersionRestoreService();
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "Test");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.confirmRestore(timeline);

      expect(service.getConfirmationState()).toBe("completed");
    });

    it("transitions to cancelled after cancel", () => {
      const service = createVersionRestoreService();
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "Test");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.cancelRestore();

      expect(service.getConfirmationState()).toBe("cancelled");
    });

    it("resets to idle state", () => {
      const service = createVersionRestoreService();
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "Test");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.reset();

      expect(service.getConfirmationState()).toBe("idle");
    });
  });

  describe("confirmation handling", () => {
    it("stores pending request details", () => {
      const service = createVersionRestoreService();
      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<v1>", ".v1{}", "V1");
      timeline = addSnapshot(timeline, "<v2>", ".v2{}", "V2");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);

      const state = service.getState();
      expect(state.pendingRequest).toBeDefined();
      expect(state.pendingRequest?.snapshotId).toBe(timeline.snapshots[0].id);
      expect(state.pendingRequest?.snapshotIndex).toBe(0);
      expect(state.pendingRequest?.previousSnapshotId).toBe(timeline.snapshots[1].id);
    });

    it("fails confirm when not pending", () => {
      const service = createVersionRestoreService();
      const timeline = createTimeline();

      const { result } = service.confirmRestore(timeline);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No pending");
    });

    it("cancel has no effect when not pending", () => {
      const service = createVersionRestoreService();

      const state = service.cancelRestore();

      expect(state.state).toBe("idle");
    });
  });

  describe("preview update", () => {
    it("calls preview callback with restored content", () => {
      const service = createVersionRestoreService();
      const callback = vi.fn();
      service.setPreviewCallback(callback);

      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<restored-html>", ".restored-scss{}", "V1");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.confirmRestore(timeline);

      expect(callback).toHaveBeenCalledWith("<restored-html>", ".restored-scss{}");
    });

    it("sets previewNeedsUpdate when no callback", () => {
      const service = createVersionRestoreService();
      // No callback set

      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "V1");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.confirmRestore(timeline);

      expect(service.getState().previewNeedsUpdate).toBe(true);
    });

    it("markPreviewUpdated clears the flag", () => {
      const service = createVersionRestoreService();

      let timeline = createTimeline();
      timeline = addSnapshot(timeline, "<html>", ".scss{}", "V1");

      service.requestRestore(timeline.snapshots[0].id, 0, timeline);
      service.confirmRestore(timeline);
      service.markPreviewUpdated();

      expect(service.getState().previewNeedsUpdate).toBe(false);
    });
  });

  describe("error handling", () => {
    it("returns error for invalid snapshot ID", () => {
      const service = createVersionRestoreService();
      const timeline = createTimeline();

      service.requestRestore("invalid-id", 999, timeline);
      const { result } = service.confirmRestore(timeline);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(service.getConfirmationState()).toBe("error");
    });
  });
});

describe("quickRestore", () => {
  beforeEach(() => {
    resetSnapshotCounter();
  });

  it("performs one-click restore without service instance", () => {
    const callback = vi.fn();
    let timeline = createTimeline();
    timeline = addSnapshot(timeline, "<old>", ".old{}", "Old");
    timeline = addSnapshot(timeline, "<new>", ".new{}", "New");

    const { result } = quickRestore(timeline.snapshots[0].id, timeline, callback);

    expect(result.success).toBe(true);
    expect(callback).toHaveBeenCalledWith("<old>", ".old{}");
  });

  it("returns error for invalid snapshot", () => {
    const timeline = createTimeline();

    const { result } = quickRestore("invalid", timeline);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("canRestoreVersion", () => {
  beforeEach(() => {
    resetSnapshotCounter();
  });

  it("returns true for valid non-current version", () => {
    let timeline = createTimeline();
    timeline = addSnapshot(timeline, "<v1>", ".v1{}", "V1");
    timeline = addSnapshot(timeline, "<v2>", ".v2{}", "V2");

    expect(canRestoreVersion(timeline.snapshots[0].id, timeline)).toBe(true);
  });

  it("returns false for current version", () => {
    let timeline = createTimeline();
    timeline = addSnapshot(timeline, "<v1>", ".v1{}", "V1");

    expect(canRestoreVersion(timeline.snapshots[0].id, timeline)).toBe(false);
  });

  it("returns false for invalid ID", () => {
    const timeline = createTimeline();

    expect(canRestoreVersion("invalid", timeline)).toBe(false);
  });
});

describe("getRestoreTarget", () => {
  beforeEach(() => {
    resetSnapshotCounter();
  });

  it("returns snapshot for valid ID", () => {
    let timeline = createTimeline();
    timeline = addSnapshot(timeline, "<target>", ".target{}", "Target");

    const target = getRestoreTarget(timeline.snapshots[0].id, timeline);

    expect(target).not.toBeNull();
    expect(target?.html).toBe("<target>");
  });

  it("returns null for invalid ID", () => {
    const timeline = createTimeline();

    expect(getRestoreTarget("invalid", timeline)).toBeNull();
  });
});

describe("RESTORE_MESSAGES", () => {
  it("provides confirmation dialog messages", () => {
    expect(RESTORE_MESSAGES.confirmTitle).toBe("Restore Version");
    expect(RESTORE_MESSAGES.confirmButton).toBe("Restore");
    expect(RESTORE_MESSAGES.cancelButton).toBe("Cancel");
    expect(RESTORE_MESSAGES.successMessage).toBeTruthy();
    expect(RESTORE_MESSAGES.errorMessage).toBeTruthy();
  });
});

describe("RESTORE_STATE_LABELS", () => {
  it("provides labels for all states", () => {
    expect(RESTORE_STATE_LABELS.idle).toBe("Ready");
    expect(RESTORE_STATE_LABELS.pending_confirmation).toBe("Awaiting confirmation");
    expect(RESTORE_STATE_LABELS.confirmed).toBe("Restoring...");
    expect(RESTORE_STATE_LABELS.cancelled).toBe("Cancelled");
    expect(RESTORE_STATE_LABELS.completed).toBe("Restored");
    expect(RESTORE_STATE_LABELS.error).toBe("Error");
  });
});
