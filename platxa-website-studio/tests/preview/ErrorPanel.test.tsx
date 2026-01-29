import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  ErrorPanel,
  type ErrorItem,
  type ErrorSeverity,
} from "@/components/preview/ErrorPanel";

describe("ErrorPanel", () => {
  // Helper to create test errors
  function createTestError(overrides: Partial<ErrorItem> = {}): ErrorItem {
    return {
      id: `error-${Date.now()}-${Math.random()}`,
      message: "Test error message",
      severity: "medium",
      timestamp: Date.now(),
      ...overrides,
    };
  }

  function createErrorList(): ErrorItem[] {
    return [
      createTestError({ id: "1", severity: "critical", message: "Critical error" }),
      createTestError({ id: "2", severity: "high", message: "High severity error" }),
      createTestError({ id: "3", severity: "medium", message: "Medium severity error" }),
      createTestError({ id: "4", severity: "low", message: "Low severity error" }),
    ];
  }

  describe("lists errors with severity icons (Feature #157)", () => {
    it("displays errors in a list", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} />);

      expect(screen.getByTestId("error-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("error-item-2")).toBeInTheDocument();
      expect(screen.getByTestId("error-item-3")).toBeInTheDocument();
      expect(screen.getByTestId("error-item-4")).toBeInTheDocument();
    });

    it("shows severity icons for each error", () => {
      const errors = [
        createTestError({ id: "critical", severity: "critical", message: "Critical" }),
        createTestError({ id: "high", severity: "high", message: "High" }),
        createTestError({ id: "medium", severity: "medium", message: "Medium" }),
        createTestError({ id: "low", severity: "low", message: "Low" }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Check severity icons are present
      const criticalItem = screen.getByTestId("error-item-critical");
      const highItem = screen.getByTestId("error-item-high");
      const mediumItem = screen.getByTestId("error-item-medium");
      const lowItem = screen.getByTestId("error-item-low");

      expect(within(criticalItem).getByText("🚨")).toBeInTheDocument();
      expect(within(highItem).getByText("❌")).toBeInTheDocument();
      expect(within(mediumItem).getByText("⚠️")).toBeInTheDocument();
      expect(within(lowItem).getByText("ℹ️")).toBeInTheDocument();
    });

    it("applies severity data attribute to items", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} />);

      expect(screen.getByTestId("error-item-1")).toHaveAttribute("data-severity", "critical");
      expect(screen.getByTestId("error-item-2")).toHaveAttribute("data-severity", "high");
      expect(screen.getByTestId("error-item-3")).toHaveAttribute("data-severity", "medium");
      expect(screen.getByTestId("error-item-4")).toHaveAttribute("data-severity", "low");
    });

    it("displays error messages", () => {
      const errors = [
        createTestError({ id: "1", message: "Specific error message" }),
      ];

      render(<ErrorPanel errors={errors} />);

      expect(screen.getByText(/Specific error message/)).toBeInTheDocument();
    });
  });

  describe("expandable details (Feature #157)", () => {
    it("expands details when clicked", () => {
      const errors = [
        createTestError({
          id: "1",
          message: "Test error",
          details: "Detailed error information",
        }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Details should not be visible initially
      expect(screen.queryByTestId("error-details-1")).not.toBeInTheDocument();

      // Click to expand
      const item = screen.getByTestId("error-item-1");
      fireEvent.click(within(item).getByRole("button"));

      // Details should now be visible
      expect(screen.getByTestId("error-details-1")).toBeInTheDocument();
      expect(screen.getByText("Detailed error information")).toBeInTheDocument();
    });

    it("collapses details when clicked again", () => {
      const errors = [createTestError({ id: "1", message: "Test error" })];

      render(<ErrorPanel errors={errors} />);

      const item = screen.getByTestId("error-item-1");
      const button = within(item).getByRole("button");

      // Expand
      fireEvent.click(button);
      expect(screen.getByTestId("error-details-1")).toBeInTheDocument();

      // Collapse
      fireEvent.click(button);
      expect(screen.queryByTestId("error-details-1")).not.toBeInTheDocument();
    });

    it("shows file location in expanded details", () => {
      const errors = [
        createTestError({
          id: "1",
          message: "Test error",
          filePath: "/app/test.ts",
          lineNumber: 42,
          column: 10,
        }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Expand
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(screen.getByText("/app/test.ts:42:10")).toBeInTheDocument();
    });

    it("shows suggestions in expanded details", () => {
      const errors = [
        createTestError({
          id: "1",
          message: "Test error",
          suggestions: ["Check syntax", "Verify imports"],
        }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Expand
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(screen.getByText("Check syntax")).toBeInTheDocument();
      expect(screen.getByText("Verify imports")).toBeInTheDocument();
    });

    it("shows retry attempts in expanded details", () => {
      const errors = [
        createTestError({
          id: "1",
          message: "Test error",
          retryAttempts: 2,
        }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Expand
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(screen.getByText("2/3")).toBeInTheDocument();
    });
  });

  describe("panel behavior", () => {
    it("renders with custom title", () => {
      render(<ErrorPanel errors={[]} title="Build Errors" />);

      expect(screen.getByText("Build Errors")).toBeInTheDocument();
    });

    it("shows empty message when no errors", () => {
      render(<ErrorPanel errors={[]} />);

      expect(screen.getByTestId("error-panel-empty")).toBeInTheDocument();
      expect(screen.getByText("No issues found")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<ErrorPanel errors={[]} isLoading />);

      expect(screen.getByTestId("error-panel-loading")).toBeInTheDocument();
    });

    it("collapses panel when header is clicked", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} />);

      // Panel should be expanded by default
      expect(screen.getByTestId("error-item-1")).toBeInTheDocument();

      // Click header to collapse
      fireEvent.click(screen.getByText("Issues"));

      // Items should no longer be visible
      expect(screen.queryByTestId("error-item-1")).not.toBeInTheDocument();
    });

    it("starts collapsed when configured", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} config={{ defaultCollapsed: true }} />);

      expect(screen.queryByTestId("error-item-1")).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<ErrorPanel errors={[]} className="custom-class" />);

      expect(screen.getByTestId("error-panel")).toHaveClass("custom-class");
    });
  });

  describe("filtering", () => {
    it("filters by severity", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} />);

      // Initially all visible
      expect(screen.getByTestId("error-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("error-item-4")).toBeInTheDocument();

      // Click to disable 'low' severity filter
      const filterBar = screen.getByTestId("error-filter-bar");
      const lowFilterBtn = within(filterBar).getByTitle("Filter Low");
      fireEvent.click(lowFilterBtn);

      // Low severity error should be hidden
      expect(screen.queryByTestId("error-item-4")).not.toBeInTheDocument();
      // Others still visible
      expect(screen.getByTestId("error-item-1")).toBeInTheDocument();
    });

    it("filters by search text", () => {
      const errors = [
        createTestError({ id: "1", message: "Syntax error in parser" }),
        createTestError({ id: "2", message: "Network timeout" }),
      ];

      render(<ErrorPanel errors={errors} />);

      const searchInput = screen.getByPlaceholderText("Search errors...");
      fireEvent.change(searchInput, { target: { value: "syntax" } });

      expect(screen.getByTestId("error-item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("error-item-2")).not.toBeInTheDocument();
    });

    it("shows no matching message when filter returns empty", () => {
      const errors = createErrorList();

      render(<ErrorPanel errors={errors} />);

      const searchInput = screen.getByPlaceholderText("Search errors...");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      expect(screen.getByText("No matching issues")).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts by severity by default", () => {
      const errors = [
        createTestError({ id: "low", severity: "low", message: "Low" }),
        createTestError({ id: "critical", severity: "critical", message: "Critical" }),
        createTestError({ id: "medium", severity: "medium", message: "Medium" }),
      ];

      render(<ErrorPanel errors={errors} />);

      const items = screen.getAllByRole("button", { name: /.*/ }).filter(
        (btn) => btn.closest("[data-testid^='error-item-']")
      );

      // Critical should be first
      expect(items[0].closest("[data-testid]")).toHaveAttribute("data-testid", "error-item-critical");
    });

    it("sorts by timestamp when selected", () => {
      const now = Date.now();
      const errors = [
        createTestError({ id: "old", message: "Old", timestamp: now - 10000 }),
        createTestError({ id: "new", message: "New", timestamp: now }),
      ];

      render(<ErrorPanel errors={errors} />);

      const sortSelect = screen.getByRole("combobox", { name: "Sort errors" });
      fireEvent.change(sortSelect, { target: { value: "timestamp" } });

      // Newest should be first
      const panel = screen.getByTestId("error-panel");
      const items = within(panel).getAllByTestId(/^error-item-/);
      expect(items[0]).toHaveAttribute("data-testid", "error-item-new");
    });

    it("sorts by file when selected", () => {
      const errors = [
        createTestError({ id: "z", message: "Z", filePath: "/z/file.ts" }),
        createTestError({ id: "a", message: "A", filePath: "/a/file.ts" }),
      ];

      render(<ErrorPanel errors={errors} />);

      const sortSelect = screen.getByRole("combobox", { name: "Sort errors" });
      fireEvent.change(sortSelect, { target: { value: "file" } });

      const panel = screen.getByTestId("error-panel");
      const items = within(panel).getAllByTestId(/^error-item-/);
      expect(items[0]).toHaveAttribute("data-testid", "error-item-a");
    });
  });

  describe("callbacks", () => {
    it("calls onErrorClick when error is clicked", () => {
      const onErrorClick = vi.fn();
      const errors = [createTestError({ id: "1", message: "Test" })];

      render(<ErrorPanel errors={errors} onErrorClick={onErrorClick} />);

      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(onErrorClick).toHaveBeenCalledWith(errors[0]);
    });

    it("calls onRequestFix when fix button is clicked", () => {
      const onRequestFix = vi.fn();
      const errors = [createTestError({ id: "1", message: "Test" })];

      render(<ErrorPanel errors={errors} onRequestFix={onRequestFix} />);

      // Expand to see actions
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      // Click fix button
      fireEvent.click(screen.getByRole("button", { name: "Attempt fix" }));

      expect(onRequestFix).toHaveBeenCalledWith(errors[0]);
    });

    it("calls onDismiss when dismiss button is clicked", () => {
      const onDismiss = vi.fn();
      const errors = [createTestError({ id: "1", message: "Test" })];

      render(<ErrorPanel errors={errors} onDismiss={onDismiss} />);

      // Expand to see actions
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      // Click dismiss button
      fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));

      expect(onDismiss).toHaveBeenCalledWith(errors[0]);
    });

    it("does not show fix button when isFixing is true", () => {
      const onRequestFix = vi.fn();
      const errors = [createTestError({ id: "1", message: "Test", isFixing: true })];

      render(<ErrorPanel errors={errors} onRequestFix={onRequestFix} />);

      // Expand to see actions
      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      // Fix button should not be present
      expect(screen.queryByRole("button", { name: "Attempt fix" })).not.toBeInTheDocument();
    });
  });

  describe("severity counts", () => {
    it("shows severity count badges in header", () => {
      const errors = [
        createTestError({ id: "1", severity: "critical" }),
        createTestError({ id: "2", severity: "critical" }),
        createTestError({ id: "3", severity: "high" }),
      ];

      render(<ErrorPanel errors={errors} />);

      // Should show count badges
      expect(screen.getByText("2")).toBeInTheDocument(); // 2 critical
      expect(screen.getByText("1")).toBeInTheDocument(); // 1 high
    });
  });

  describe("accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<ErrorPanel errors={[]} title="Errors" />);

      const panel = screen.getByTestId("error-panel");
      expect(panel).toHaveAttribute("role", "region");
      expect(panel).toHaveAttribute("aria-label", "Errors");
    });

    it("error items are keyboard accessible", () => {
      const errors = [createTestError({ id: "1", message: "Test" })];

      render(<ErrorPanel errors={errors} />);

      const item = screen.getByTestId("error-item-1");
      const button = within(item).getByRole("button");

      // Trigger with Enter key
      fireEvent.keyDown(button, { key: "Enter" });

      expect(screen.getByTestId("error-details-1")).toBeInTheDocument();
    });

    it("severity icons have aria-labels", () => {
      const errors = [createTestError({ id: "1", severity: "critical" })];

      render(<ErrorPanel errors={errors} />);

      expect(screen.getByLabelText("Critical")).toBeInTheDocument();
    });
  });

  describe("config options", () => {
    it("hides timestamp when configured", () => {
      const errors = [createTestError({ id: "1", message: "Test" })];

      render(<ErrorPanel errors={errors} config={{ showTimestamp: false }} />);

      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(screen.queryByText("Time:")).not.toBeInTheDocument();
    });

    it("hides location when configured", () => {
      const errors = [
        createTestError({ id: "1", message: "Test", filePath: "/app/test.ts" }),
      ];

      render(<ErrorPanel errors={errors} config={{ showLocation: false }} />);

      fireEvent.click(within(screen.getByTestId("error-item-1")).getByRole("button"));

      expect(screen.queryByText("Location:")).not.toBeInTheDocument();
    });

    it("hides filter bar when configured", () => {
      render(<ErrorPanel errors={[]} config={{ allowFilter: false, allowSort: false }} />);

      expect(screen.queryByTestId("error-filter-bar")).not.toBeInTheDocument();
    });

    it("limits max errors displayed", () => {
      const errors = Array.from({ length: 10 }, (_, i) =>
        createTestError({ id: String(i), message: `Error ${i}` })
      );

      render(<ErrorPanel errors={errors} config={{ maxErrors: 3 }} />);

      // Only 3 should be visible
      expect(screen.getByText("Showing 3 of 10 issues")).toBeInTheDocument();
    });
  });
});
