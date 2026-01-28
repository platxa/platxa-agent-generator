import { describe, it, expect, beforeEach } from "vitest";
import {
  resetSnapshotCounter,
  createTimeline,
  addSnapshot,
  restoreSnapshot,
  restoreById,
  getCurrentSnapshot,
  canUndo,
  canRedo,
  undo,
  redo,
  diffSnapshots,
  getTimelineSummary,
} from "@/lib/agent-bridge/snapshot-timeline";

beforeEach(() => {
  resetSnapshotCounter();
});

describe("Snapshot Timeline", () => {
  describe("createTimeline", () => {
    it("creates empty timeline", () => {
      const tl = createTimeline();
      expect(tl.snapshots).toHaveLength(0);
      expect(tl.currentIndex).toBe(-1);
    });

    it("accepts max snapshots param", () => {
      const tl = createTimeline(10);
      expect(tl.maxSnapshots).toBe(10);
    });
  });

  describe("addSnapshot", () => {
    it("adds first snapshot", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "<h1>Hi</h1>", ".h1{}", "Initial", "thumb1");
      expect(tl.snapshots).toHaveLength(1);
      expect(tl.currentIndex).toBe(0);
      expect(tl.snapshots[0].id).toBe("snap_1");
      expect(tl.snapshots[0].label).toBe("Initial");
      expect(tl.snapshots[0].thumbnail).toBe("thumb1");
    });

    it("adds multiple snapshots sequentially", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "Step 1");
      tl = addSnapshot(tl, "v2", "s2", "Step 2");
      tl = addSnapshot(tl, "v3", "s3", "Step 3");
      expect(tl.snapshots).toHaveLength(3);
      expect(tl.currentIndex).toBe(2);
    });

    it("discards future snapshots when adding after restore", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "Step 1");
      tl = addSnapshot(tl, "v2", "s2", "Step 2");
      tl = addSnapshot(tl, "v3", "s3", "Step 3");
      // Restore to step 1
      tl = { ...tl, currentIndex: 0 };
      tl = addSnapshot(tl, "v4", "s4", "Branch");
      expect(tl.snapshots).toHaveLength(2); // step1 + branch
      expect(tl.snapshots[1].label).toBe("Branch");
    });

    it("enforces max snapshots limit", () => {
      let tl = createTimeline(3);
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      tl = addSnapshot(tl, "v3", "s3", "S3");
      tl = addSnapshot(tl, "v4", "s4", "S4");
      expect(tl.snapshots).toHaveLength(3);
      expect(tl.snapshots[0].label).toBe("S2"); // oldest trimmed
    });

    it("stores metadata", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1", "", { prompt: "test" });
      expect(tl.snapshots[0].metadata).toEqual({ prompt: "test" });
    });

    it("assigns sequential step numbers", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      expect(tl.snapshots[0].step).toBe(1);
      expect(tl.snapshots[1].step).toBe(2);
    });
  });

  describe("restoreSnapshot", () => {
    it("restores by index", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      const result = restoreSnapshot(tl, 0);
      expect(result).not.toBeNull();
      expect(result!.snapshot.label).toBe("S1");
      expect(result!.currentIndex).toBe(0);
    });

    it("returns null for invalid index", () => {
      const tl = createTimeline();
      expect(restoreSnapshot(tl, 5)).toBeNull();
    });
  });

  describe("restoreById", () => {
    it("restores by snapshot ID", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      const result = restoreById(tl, "snap_1");
      expect(result).not.toBeNull();
      expect(result!.snapshot.html).toBe("v1");
    });

    it("returns null for unknown ID", () => {
      const tl = createTimeline();
      expect(restoreById(tl, "snap_999")).toBeNull();
    });
  });

  describe("getCurrentSnapshot", () => {
    it("returns current snapshot", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      expect(getCurrentSnapshot(tl)!.label).toBe("S1");
    });

    it("returns null for empty timeline", () => {
      expect(getCurrentSnapshot(createTimeline())).toBeNull();
    });
  });

  describe("undo/redo", () => {
    it("canUndo is false at start", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      expect(canUndo(tl)).toBe(false);
    });

    it("canUndo is true with 2+ snapshots", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      expect(canUndo(tl)).toBe(true);
    });

    it("undo moves back one step", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      tl = undo(tl);
      expect(tl.currentIndex).toBe(0);
      expect(getCurrentSnapshot(tl)!.label).toBe("S1");
    });

    it("redo moves forward one step", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s2", "S2");
      tl = undo(tl);
      tl = redo(tl);
      expect(tl.currentIndex).toBe(1);
      expect(getCurrentSnapshot(tl)!.label).toBe("S2");
    });

    it("canRedo is false at end", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      expect(canRedo(tl)).toBe(false);
    });

    it("undo at start is no-op", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      const before = tl.currentIndex;
      tl = undo(tl);
      expect(tl.currentIndex).toBe(before);
    });
  });

  describe("diffSnapshots", () => {
    it("detects HTML changes", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1");
      tl = addSnapshot(tl, "v2", "s1", "S2");
      const diff = diffSnapshots(tl.snapshots[0], tl.snapshots[1]);
      expect(diff.htmlChanged).toBe(true);
      expect(diff.scssChanged).toBe(false);
    });

    it("computes size delta", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "short", "s", "S1");
      tl = addSnapshot(tl, "much longer html content", "s", "S2");
      const diff = diffSnapshots(tl.snapshots[0], tl.snapshots[1]);
      expect(diff.htmlSizeDelta).toBeGreaterThan(0);
    });
  });

  describe("getTimelineSummary", () => {
    it("returns summary with isCurrent flag", () => {
      let tl = createTimeline();
      tl = addSnapshot(tl, "v1", "s1", "S1", "t1");
      tl = addSnapshot(tl, "v2", "s2", "S2", "t2");
      const summary = getTimelineSummary(tl);
      expect(summary).toHaveLength(2);
      expect(summary[0].isCurrent).toBe(false);
      expect(summary[1].isCurrent).toBe(true);
      expect(summary[0].thumbnail).toBe("t1");
    });
  });
});
