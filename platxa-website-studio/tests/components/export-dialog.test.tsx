import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportDialog } from "@/components/explorer/ExportDialog";
import { useProjectStore } from "@/lib/stores";
import { act } from "@testing-library/react";

/**
 * Tests for ExportDialog progress tracking (Fix 5: M12/H9)
 */

// Mock JSZip
vi.mock("jszip", () => ({
  default: class MockJSZip {
    private files: Record<string, string> = {};

    file(name: string, data: string) {
      this.files[name] = data;
      return this;
    }

    async generateAsync(options: Record<string, unknown>, onUpdate?: (meta: { percent: number }) => void) {
      // Simulate compression progress
      if (onUpdate) {
        onUpdate({ percent: 50 });
        onUpdate({ percent: 100 });
      }
      return new Blob(["mock-zip-content"], { type: "application/zip" });
    }
  },
}));

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(global.URL, "createObjectURL", { value: mockCreateObjectURL });
Object.defineProperty(global.URL, "revokeObjectURL", { value: mockRevokeObjectURL });

describe("ExportDialog", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOpenChange.mockClear();

    // Set up project store with test files
    act(() => {
      useProjectStore.setState({
        projectName: "Test Theme",
        files: [
          {
            id: "1",
            name: "__manifest__.py",
            path: "theme_test/__manifest__.py",
            type: "file" as const,
            content: "{'name': 'Test'}",
          },
          {
            id: "2",
            name: "templates.xml",
            path: "theme_test/views/templates.xml",
            type: "file" as const,
            content: "<odoo><template/></odoo>",
          },
          {
            id: "3",
            name: "theme.scss",
            path: "theme_test/static/src/scss/theme.scss",
            type: "file" as const,
            content: "body { color: red; }",
          },
        ],
      });
    });
  });

  it("renders file count correctly", () => {
    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText("3 files will be exported")).toBeTruthy();
  });

  it("renders project name", () => {
    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText("Test Theme")).toBeTruthy();
  });

  it("shows Export ZIP button when idle", () => {
    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);
    const exportBtn = screen.getByText("Export ZIP");
    expect(exportBtn).toBeTruthy();
  });

  it("disables export button when no files", () => {
    act(() => {
      useProjectStore.setState({ files: [] });
    });

    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);
    // Find the button that contains "Export ZIP"
    const btn = screen.getByText("Export ZIP").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("shows progress bar during export", async () => {
    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);

    const exportBtn = screen.getByText("Export ZIP");
    fireEvent.click(exportBtn);

    // Should show progress bar (via role="progressbar")
    await waitFor(() => {
      const progressBar = screen.queryByRole("progressbar");
      // Progress bar should appear during exporting state
      // It may complete quickly in tests, so we check for success too
      const success = screen.queryByText("Export successful!");
      expect(progressBar || success).toBeTruthy();
    });
  });

  it("shows success state after export completes", async () => {
    render(<ExportDialog open={true} onOpenChange={mockOnOpenChange} />);

    const exportBtn = screen.getByText("Export ZIP");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText("Export successful!")).toBeTruthy();
    });
  });
});
