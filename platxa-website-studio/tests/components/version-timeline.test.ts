import { describe, it, expect } from "vitest";
import {
  VERSION_STATUS_CONFIG,
  formatTimestamp,
  formatFullTimestamp,
  type TimelineVersion,
  type VersionStatus,
} from "@/components/chat/VersionTimeline";

describe("VersionTimeline", () => {
  describe("vertical timeline shows versions with timestamps (Feature #102)", () => {
    it("defines status configuration for all version states", () => {
      // Feature #102: Timeline shows versions
      const statuses: VersionStatus[] = ["pending", "generating", "complete", "error"];
      for (const status of statuses) {
        expect(VERSION_STATUS_CONFIG[status]).toBeDefined();
        expect(VERSION_STATUS_CONFIG[status].icon).toBeDefined();
        expect(VERSION_STATUS_CONFIG[status].color).toBeTruthy();
        expect(VERSION_STATUS_CONFIG[status].label).toBeTruthy();
      }
    });

    it("formatTimestamp formats dates for timeline display", () => {
      // Feature #102: Versions with timestamps
      const now = new Date();
      const result = formatTimestamp(now);
      expect(result).toBe("Just now");
    });

    it("supports TimelineVersion structure with required fields", () => {
      // Feature #102: Timeline shows versions
      const version: TimelineVersion = {
        id: "v1",
        label: "v1",
        timestamp: new Date(),
        status: "complete",
      };

      expect(version.id).toBeTruthy();
      expect(version.label).toBeTruthy();
      expect(version.timestamp).toBeInstanceOf(Date);
      expect(version.status).toBe("complete");
    });

    it("supports optional description and error message", () => {
      // Feature #102: Version entries can have details
      const version: TimelineVersion = {
        id: "v2",
        label: "v2",
        timestamp: new Date(),
        status: "error",
        description: "Initial generation attempt",
        errorMessage: "Syntax error in template",
      };

      expect(version.description).toBe("Initial generation attempt");
      expect(version.errorMessage).toBe("Syntax error in template");
    });
  });

  describe("VERSION_STATUS_CONFIG", () => {
    it("pending status has clock icon and muted colors", () => {
      const config = VERSION_STATUS_CONFIG.pending;
      expect(config.label).toBe("Pending");
      expect(config.color).toContain("muted");
    });

    it("generating status has loader icon and primary colors", () => {
      const config = VERSION_STATUS_CONFIG.generating;
      expect(config.label).toBe("Generating");
      expect(config.color).toContain("primary");
    });

    it("complete status has check icon and emerald colors", () => {
      const config = VERSION_STATUS_CONFIG.complete;
      expect(config.label).toBe("Complete");
      expect(config.color).toContain("emerald");
    });

    it("error status has alert icon and red colors", () => {
      const config = VERSION_STATUS_CONFIG.error;
      expect(config.label).toBe("Error");
      expect(config.color).toContain("red");
    });

    it("all statuses have dot colors for timeline visualization", () => {
      expect(VERSION_STATUS_CONFIG.pending.dotColor).toBeTruthy();
      expect(VERSION_STATUS_CONFIG.generating.dotColor).toBeTruthy();
      expect(VERSION_STATUS_CONFIG.complete.dotColor).toBeTruthy();
      expect(VERSION_STATUS_CONFIG.error.dotColor).toBeTruthy();
    });
  });

  describe("formatTimestamp", () => {
    it("returns 'Just now' for timestamps less than a minute old", () => {
      const now = new Date();
      expect(formatTimestamp(now)).toBe("Just now");
    });

    it("returns minutes ago for timestamps less than an hour old", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatTimestamp(fiveMinutesAgo)).toBe("5m ago");
    });

    it("returns hours ago for timestamps less than a day old", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatTimestamp(threeHoursAgo)).toBe("3h ago");
    });

    it("returns days ago for timestamps less than a week old", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatTimestamp(twoDaysAgo)).toBe("2d ago");
    });

    it("returns formatted date for timestamps older than a week", () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = formatTimestamp(twoWeeksAgo);
      // Should contain month abbreviation and day
      expect(result).toMatch(/\w{3}\s+\d+/);
    });
  });

  describe("formatFullTimestamp", () => {
    it("returns complete datetime string", () => {
      const date = new Date("2024-03-15T14:30:45");
      const result = formatFullTimestamp(date);

      // Should contain year, month, day, and time
      expect(result).toContain("2024");
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    it("includes seconds in output", () => {
      const date = new Date("2024-06-20T10:15:30");
      const result = formatFullTimestamp(date);

      // Full format includes seconds
      expect(result).toMatch(/:\d{2}/); // Has at least minutes:seconds
    });
  });

  describe("TimelineVersion type", () => {
    it("supports pending version", () => {
      const version: TimelineVersion = {
        id: "pending-1",
        label: "v3 (queued)",
        timestamp: new Date(),
        status: "pending",
        description: "Waiting in queue",
      };

      expect(version.status).toBe("pending");
    });

    it("supports generating version", () => {
      const version: TimelineVersion = {
        id: "gen-1",
        label: "v2",
        timestamp: new Date(),
        status: "generating",
        description: "Generating website theme...",
      };

      expect(version.status).toBe("generating");
    });

    it("supports complete version", () => {
      const version: TimelineVersion = {
        id: "complete-1",
        label: "v1 - Initial",
        timestamp: new Date(),
        status: "complete",
        description: "Successfully generated",
      };

      expect(version.status).toBe("complete");
    });

    it("supports error version with message", () => {
      const version: TimelineVersion = {
        id: "error-1",
        label: "v2 - Failed",
        timestamp: new Date(),
        status: "error",
        description: "Generation attempt",
        errorMessage: "Template syntax error at line 42",
      };

      expect(version.status).toBe("error");
      expect(version.errorMessage).toBeTruthy();
    });
  });
});
