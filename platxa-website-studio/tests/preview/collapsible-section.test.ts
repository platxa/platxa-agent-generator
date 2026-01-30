/**
 * Tests for Collapsible Section
 *
 * Feature #117: Create collapsible plan/execution details in messages
 * Verification: Expand/collapse toggle for detailed plan and execution logs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CollapsibleSection,
  createCollapsibleSection,
  DEFAULT_ANIMATION,
  SECTION_LABELS,
  SECTION_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
  TOGGLE_ICONS,
  generateSectionId,
  formatDuration,
  formatTimestamp,
  truncateText,
  getStatusBadge,
  getSeverityBadge,
  escapeHtml,
  createStepSummary,
  createLogSummary,
  createLogEntry,
  createPlanStep,
  type PlanStep,
  type LogEntry,
} from "../../lib/preview/collapsible-section";

describe("CollapsibleSection", () => {
  let section: CollapsibleSection;

  beforeEach(() => {
    section = createCollapsibleSection();
  });

  afterEach(() => {
    section.dispose();
  });

  describe("utility functions", () => {
    describe("generateSectionId", () => {
      it("should generate unique IDs", () => {
        const id1 = generateSectionId();
        const id2 = generateSectionId();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^section-\d+-[a-z0-9]+$/);
      });
    });

    describe("formatDuration", () => {
      it("should format milliseconds", () => {
        expect(formatDuration(500)).toBe("500ms");
      });

      it("should format seconds", () => {
        expect(formatDuration(1500)).toBe("1.5s");
        expect(formatDuration(30000)).toBe("30.0s");
      });

      it("should format minutes and seconds", () => {
        expect(formatDuration(90000)).toBe("1m 30s");
        expect(formatDuration(125000)).toBe("2m 5s");
      });
    });

    describe("formatTimestamp", () => {
      it("should format timestamp to time string", () => {
        const ts = new Date("2024-01-15T10:30:45").getTime();
        const formatted = formatTimestamp(ts);
        expect(formatted).toContain(":");
      });
    });

    describe("truncateText", () => {
      it("should not truncate short text", () => {
        expect(truncateText("short", 10)).toBe("short");
      });

      it("should truncate long text with ellipsis", () => {
        expect(truncateText("this is a long text", 10)).toBe("this is...");
      });

      it("should handle exact length", () => {
        expect(truncateText("exact", 5)).toBe("exact");
      });
    });

    describe("escapeHtml", () => {
      it("should escape HTML characters", () => {
        expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
        expect(escapeHtml("a & b")).toBe("a &amp; b");
      });
    });

    describe("getStatusBadge", () => {
      it("should return HTML with status color", () => {
        const badge = getStatusBadge("completed");
        expect(badge).toContain("status-completed");
        expect(badge).toContain(STATUS_COLORS.completed);
        expect(badge).toContain("Completed");
      });
    });

    describe("getSeverityBadge", () => {
      it("should return HTML with severity color", () => {
        const badge = getSeverityBadge("error");
        expect(badge).toContain("severity-error");
        expect(badge).toContain(SEVERITY_COLORS.error);
        expect(badge).toContain("ERROR");
      });
    });

    describe("createStepSummary", () => {
      it("should summarize step completion", () => {
        const steps: PlanStep[] = [
          createPlanStep(1, "Step 1", "completed"),
          createPlanStep(2, "Step 2", "completed"),
          createPlanStep(3, "Step 3", "pending"),
        ];
        expect(createStepSummary(steps)).toBe("2/3 steps completed");
      });
    });

    describe("createLogSummary", () => {
      it("should summarize logs", () => {
        const logs: LogEntry[] = [
          createLogEntry("Info", "info"),
          createLogEntry("Warning", "warning"),
          createLogEntry("Error", "error"),
        ];
        expect(createLogSummary(logs)).toBe("3 entries, 1 errors, 1 warnings");
      });

      it("should handle logs without errors", () => {
        const logs: LogEntry[] = [
          createLogEntry("Info 1", "info"),
          createLogEntry("Info 2", "info"),
        ];
        expect(createLogSummary(logs)).toBe("2 entries");
      });
    });
  });

  describe("helper builders", () => {
    describe("createLogEntry", () => {
      it("should create log entry with defaults", () => {
        const entry = createLogEntry("Test message");
        expect(entry.message).toBe("Test message");
        expect(entry.severity).toBe("info");
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeDefined();
      });

      it("should create log entry with severity", () => {
        const entry = createLogEntry("Error!", "error", "Details here");
        expect(entry.severity).toBe("error");
        expect(entry.details).toBe("Details here");
      });
    });

    describe("createPlanStep", () => {
      it("should create plan step with defaults", () => {
        const step = createPlanStep(1, "First step");
        expect(step.number).toBe(1);
        expect(step.description).toBe("First step");
        expect(step.status).toBe("pending");
        expect(step.id).toBeDefined();
      });

      it("should create plan step with status", () => {
        const step = createPlanStep(2, "Second step", "completed");
        expect(step.status).toBe("completed");
      });
    });
  });

  describe("addSection", () => {
    it("should add a section", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test Plan",
        status: "pending",
      });

      expect(added.id).toBeDefined();
      expect(added.title).toBe("Test Plan");
      expect(section.getSection(added.id)).toEqual(added);
    });

    it("should set default expanded state", () => {
      const added = section.addSection({
        type: "details",
        title: "Details",
        status: "completed",
      });

      expect(added.expanded).toBe(false); // defaultExpanded is false
    });

    it("should throw if disposed", () => {
      section.dispose();
      expect(() =>
        section.addSection({ type: "plan", title: "Test", status: "pending" })
      ).toThrow("CollapsibleSection is disposed");
    });
  });

  describe("addPlanSection", () => {
    it("should add plan section with steps", () => {
      const steps = [
        createPlanStep(1, "Step 1", "completed"),
        createPlanStep(2, "Step 2", "running"),
      ];

      const added = section.addPlanSection("My Plan", steps);

      expect(added.type).toBe("plan");
      expect(added.title).toBe("My Plan");
      expect(added.steps).toEqual(steps);
      expect(added.status).toBe("running"); // Has running step
    });

    it("should calculate status from steps", () => {
      const completedSteps = [
        createPlanStep(1, "Step 1", "completed"),
        createPlanStep(2, "Step 2", "completed"),
      ];

      const added = section.addPlanSection("Done Plan", completedSteps);
      expect(added.status).toBe("completed");
    });

    it("should detect failed status", () => {
      const failedSteps = [
        createPlanStep(1, "Step 1", "completed"),
        createPlanStep(2, "Step 2", "failed"),
      ];

      const added = section.addPlanSection("Failed Plan", failedSteps);
      expect(added.status).toBe("failed");
    });
  });

  describe("addExecutionSection", () => {
    it("should add execution section with logs", () => {
      const logs = [
        createLogEntry("Started", "info"),
        createLogEntry("Completed", "success"),
      ];

      const added = section.addExecutionSection("Execution", logs);

      expect(added.type).toBe("execution");
      expect(added.logs).toEqual(logs);
      expect(added.status).toBe("completed");
    });

    it("should detect failed status from error logs", () => {
      const logs = [
        createLogEntry("Started", "info"),
        createLogEntry("Failed!", "error"),
      ];

      const added = section.addExecutionSection("Execution", logs);
      expect(added.status).toBe("failed");
    });
  });

  describe("addDetailsSection", () => {
    it("should add details section with content", () => {
      const added = section.addDetailsSection("Details", "Some detailed content");

      expect(added.type).toBe("details");
      expect(added.content).toBe("Some detailed content");
    });

    it("should truncate summary", () => {
      const longContent = "a".repeat(200);
      const added = section.addDetailsSection("Details", longContent);

      expect(added.summary!.length).toBeLessThan(longContent.length);
      expect(added.summary).toContain("...");
    });
  });

  describe("toggle", () => {
    it("should toggle expanded state", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      expect(section.isExpanded(added.id)).toBe(false);

      section.toggle(added.id);
      expect(section.isExpanded(added.id)).toBe(true);

      section.toggle(added.id);
      expect(section.isExpanded(added.id)).toBe(false);
    });

    it("should return new state", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      expect(section.toggle(added.id)).toBe(true);
      expect(section.toggle(added.id)).toBe(false);
    });

    it("should return false for non-existent section", () => {
      expect(section.toggle("non-existent")).toBe(false);
    });

    it("should auto-collapse siblings when enabled", () => {
      const autoCollapseSection = createCollapsibleSection({
        autoCollapseSiblings: true,
      });

      const s1 = autoCollapseSection.addSection({
        type: "plan",
        title: "Section 1",
        status: "pending",
      });
      const s2 = autoCollapseSection.addSection({
        type: "plan",
        title: "Section 2",
        status: "pending",
      });

      autoCollapseSection.toggle(s1.id); // Expand s1
      expect(autoCollapseSection.isExpanded(s1.id)).toBe(true);

      autoCollapseSection.toggle(s2.id); // Expand s2
      expect(autoCollapseSection.isExpanded(s2.id)).toBe(true);
      expect(autoCollapseSection.isExpanded(s1.id)).toBe(false); // s1 collapsed

      autoCollapseSection.dispose();
    });

    it("should throw if disposed", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });
      section.dispose();

      expect(() => section.toggle(added.id)).toThrow(
        "CollapsibleSection is disposed"
      );
    });
  });

  describe("expand/collapse", () => {
    it("should expand a section", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      expect(section.expand(added.id)).toBe(true);
      expect(section.isExpanded(added.id)).toBe(true);
    });

    it("should not re-expand already expanded", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      section.expand(added.id);
      expect(section.expand(added.id)).toBe(false);
    });

    it("should collapse a section", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      section.expand(added.id);
      expect(section.collapse(added.id)).toBe(true);
      expect(section.isExpanded(added.id)).toBe(false);
    });

    it("should not re-collapse already collapsed", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      expect(section.collapse(added.id)).toBe(false);
    });
  });

  describe("expandAll/collapseAll", () => {
    it("should expand all sections", () => {
      const s1 = section.addSection({ type: "plan", title: "S1", status: "pending" });
      const s2 = section.addSection({ type: "plan", title: "S2", status: "pending" });

      section.expandAll();

      expect(section.isExpanded(s1.id)).toBe(true);
      expect(section.isExpanded(s2.id)).toBe(true);
    });

    it("should collapse all sections", () => {
      const s1 = section.addSection({ type: "plan", title: "S1", status: "pending" });
      const s2 = section.addSection({ type: "plan", title: "S2", status: "pending" });

      section.expandAll();
      section.collapseAll();

      expect(section.isExpanded(s1.id)).toBe(false);
      expect(section.isExpanded(s2.id)).toBe(false);
    });
  });

  describe("updateSection", () => {
    it("should update section properties", () => {
      const added = section.addSection({
        type: "plan",
        title: "Original",
        status: "pending",
      });

      section.updateSection(added.id, { title: "Updated", status: "completed" });

      const updated = section.getSection(added.id);
      expect(updated?.title).toBe("Updated");
      expect(updated?.status).toBe("completed");
    });

    it("should preserve ID", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      section.updateSection(added.id, { title: "New Title" });

      expect(section.getSection(added.id)?.id).toBe(added.id);
    });

    it("should return false for non-existent", () => {
      expect(section.updateSection("non-existent", { title: "X" })).toBe(false);
    });
  });

  describe("removeSection", () => {
    it("should remove a section", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });

      expect(section.removeSection(added.id)).toBe(true);
      expect(section.getSection(added.id)).toBeUndefined();
    });

    it("should return false for non-existent", () => {
      expect(section.removeSection("non-existent")).toBe(false);
    });
  });

  describe("clearSections", () => {
    it("should clear all sections", () => {
      section.addSection({ type: "plan", title: "S1", status: "pending" });
      section.addSection({ type: "plan", title: "S2", status: "pending" });

      section.clearSections();

      expect(section.getAllSections()).toHaveLength(0);
    });
  });

  describe("renderSection", () => {
    it("should render section with toggle button", () => {
      const added = section.addPlanSection("My Plan", [
        createPlanStep(1, "Step 1", "completed"),
      ]);

      const rendered = section.renderSection(added.id);

      expect(rendered).not.toBeNull();
      expect(rendered!.html).toContain("toggle-btn");
      expect(rendered!.html).toContain("My Plan");
      expect(rendered!.toggle.icon).toBe(TOGGLE_ICONS.collapsed);
    });

    it("should show expanded icon when expanded", () => {
      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });
      section.expand(added.id);

      const rendered = section.renderSection(added.id);

      expect(rendered!.toggle.icon).toBe(TOGGLE_ICONS.expanded);
      expect(rendered!.expanded).toBe(true);
    });

    it("should render plan steps", () => {
      const added = section.addPlanSection("Plan", [
        createPlanStep(1, "First step", "completed"),
        createPlanStep(2, "Second step", "pending"),
      ]);
      section.expand(added.id);

      const rendered = section.renderSection(added.id);

      expect(rendered!.html).toContain("First step");
      expect(rendered!.html).toContain("Second step");
      expect(rendered!.html).toContain("plan-steps");
    });

    it("should render log entries", () => {
      const added = section.addExecutionSection("Logs", [
        createLogEntry("Started process", "info"),
        createLogEntry("Warning occurred", "warning"),
      ]);
      section.expand(added.id);

      const rendered = section.renderSection(added.id);

      expect(rendered!.html).toContain("Started process");
      expect(rendered!.html).toContain("Warning occurred");
      expect(rendered!.html).toContain("log-entries");
    });

    it("should return null for non-existent", () => {
      expect(section.renderSection("non-existent")).toBeNull();
    });
  });

  describe("callbacks", () => {
    it("should call state change callback", () => {
      const callback = vi.fn();
      section.onStateChange(callback);

      section.addSection({ type: "plan", title: "Test", status: "pending" });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Array));
    });

    it("should call toggle callback", () => {
      const callback = vi.fn();
      section.onToggle(callback);

      const added = section.addSection({
        type: "plan",
        title: "Test",
        status: "pending",
      });
      section.toggle(added.id);

      expect(callback).toHaveBeenCalledWith(added.id, true);
    });

    it("should allow unsubscribing", () => {
      const callback = vi.fn();
      const unsubscribe = section.onStateChange(callback);

      section.addSection({ type: "plan", title: "S1", status: "pending" });
      unsubscribe();
      section.addSection({ type: "plan", title: "S2", status: "pending" });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      section.onStateChange(errorCallback);

      expect(() =>
        section.addSection({ type: "plan", title: "Test", status: "pending" })
      ).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(section.isDisposed()).toBe(false);
      section.dispose();
      expect(section.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      section.dispose();
      expect(() => section.dispose()).not.toThrow();
    });

    it("should clear all data", () => {
      section.addSection({ type: "plan", title: "Test", status: "pending" });
      section.dispose();

      expect(section.getAllSections()).toHaveLength(0);
    });
  });
});

describe("constants", () => {
  it("should have labels for all section types", () => {
    expect(SECTION_LABELS.plan).toBe("Plan");
    expect(SECTION_LABELS.execution).toBe("Execution");
    expect(SECTION_LABELS.logs).toBe("Logs");
  });

  it("should have icons for all section types", () => {
    expect(SECTION_ICONS.plan).toBeDefined();
    expect(SECTION_ICONS.execution).toBeDefined();
  });

  it("should have status colors", () => {
    expect(STATUS_COLORS.completed).toBeDefined();
    expect(STATUS_COLORS.failed).toBeDefined();
    expect(STATUS_COLORS.running).toBeDefined();
  });

  it("should have severity colors", () => {
    expect(SEVERITY_COLORS.info).toBeDefined();
    expect(SEVERITY_COLORS.error).toBeDefined();
    expect(SEVERITY_COLORS.warning).toBeDefined();
  });

  it("should have toggle icons", () => {
    expect(TOGGLE_ICONS.expanded).toBe("▼");
    expect(TOGGLE_ICONS.collapsed).toBe("▶");
  });

  it("should have default animation settings", () => {
    expect(DEFAULT_ANIMATION.enabled).toBe(true);
    expect(DEFAULT_ANIMATION.duration).toBeGreaterThan(0);
  });
});

describe("verification tests", () => {
  it("should provide expand/collapse toggle for plan", () => {
    const section = createCollapsibleSection();

    const plan = section.addPlanSection("Implementation Plan", [
      createPlanStep(1, "Analyze requirements", "completed"),
      createPlanStep(2, "Design solution", "running"),
      createPlanStep(3, "Implement code", "pending"),
    ]);

    // Initially collapsed
    expect(section.isExpanded(plan.id)).toBe(false);

    // Toggle to expand
    section.toggle(plan.id);
    expect(section.isExpanded(plan.id)).toBe(true);

    // Render shows toggle button
    const rendered = section.renderSection(plan.id);
    expect(rendered!.html).toContain("toggle-btn");
    expect(rendered!.toggle.label).toBe("Collapse");

    // Toggle to collapse
    section.toggle(plan.id);
    expect(section.isExpanded(plan.id)).toBe(false);

    const collapsedRender = section.renderSection(plan.id);
    expect(collapsedRender!.toggle.label).toBe("Expand");

    section.dispose();
  });

  it("should provide expand/collapse toggle for execution logs", () => {
    const section = createCollapsibleSection();

    const execution = section.addExecutionSection("Execution Logs", [
      createLogEntry("Starting build...", "info"),
      createLogEntry("Compiling TypeScript...", "info"),
      createLogEntry("Build completed", "success"),
    ]);

    // Toggle functionality works
    expect(section.isExpanded(execution.id)).toBe(false);
    section.toggle(execution.id);
    expect(section.isExpanded(execution.id)).toBe(true);

    // Render contains toggle
    const rendered = section.renderSection(execution.id);
    expect(rendered!.html).toContain("toggle-btn");
    expect(rendered!.html).toContain("aria-expanded");

    section.dispose();
  });

  it("should show toggle icons for expand/collapse states", () => {
    const section = createCollapsibleSection();

    const details = section.addDetailsSection(
      "Detailed Information",
      "This is detailed content that can be expanded or collapsed."
    );

    // Collapsed state shows expand icon
    let rendered = section.renderSection(details.id);
    expect(rendered!.toggle.icon).toBe("▶");

    // Expanded state shows collapse icon
    section.expand(details.id);
    rendered = section.renderSection(details.id);
    expect(rendered!.toggle.icon).toBe("▼");

    section.dispose();
  });
});
