import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="alert-icon" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="refresh-icon" {...props} />,
  Home: (props: Record<string, unknown>) => <span data-testid="home-icon" {...props} />,
  FolderOpen: (props: Record<string, unknown>) => <span data-testid="folder-icon" {...props} />,
}));

// Mock Button component
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, asChild, variant, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    variant?: string;
    [key: string]: unknown;
  }) => {
    if (asChild) {
      // Render children directly for asChild mode
      return <>{children}</>;
    }
    return <button onClick={onClick} data-variant={variant} {...props}>{children}</button>;
  },
}));

import GlobalError from "@/app/error";
import StudioError from "@/app/studio/[projectId]/error";
import LoginError from "@/app/(auth)/login/error";
import SignupError from "@/app/(auth)/signup/error";

describe("Error Boundaries", () => {
  const mockError = new Error("Test error message");
  const mockReset = vi.fn();
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  describe("GlobalError (app/error.tsx)", () => {
    it("renders 'Something went wrong' title", () => {
      render(<GlobalError error={mockError} reset={mockReset} />);
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("calls reset on Try Again click", () => {
      render(<GlobalError error={mockError} reset={mockReset} />);
      fireEvent.click(screen.getByText("Try Again"));
      expect(mockReset).toHaveBeenCalledOnce();
    });

    it("shows error message in development", () => {
      process.env.NODE_ENV = "development";
      render(<GlobalError error={mockError} reset={mockReset} />);
      expect(screen.getByText("Test error message")).toBeDefined();
    });

    it("has Go Home link with correct href", () => {
      render(<GlobalError error={mockError} reset={mockReset} />);
      const homeLink = screen.getByText("Go Home").closest("a");
      expect(homeLink?.getAttribute("href")).toBe("/");
    });
  });

  describe("StudioError (app/studio/[projectId]/error.tsx)", () => {
    it("renders 'Failed to load project' title", () => {
      render(<StudioError error={mockError} reset={mockReset} />);
      expect(screen.getByText("Failed to load project")).toBeDefined();
    });

    it("calls reset on Try Again click", () => {
      render(<StudioError error={mockError} reset={mockReset} />);
      fireEvent.click(screen.getByText("Try Again"));
      expect(mockReset).toHaveBeenCalledOnce();
    });

    it("has My Projects link with correct href", () => {
      render(<StudioError error={mockError} reset={mockReset} />);
      const link = screen.getByText("My Projects").closest("a");
      expect(link?.getAttribute("href")).toBe("/projects");
    });
  });

  describe("LoginError (app/(auth)/login/error.tsx)", () => {
    it("renders 'Login error' title", () => {
      render(<LoginError error={mockError} reset={mockReset} />);
      expect(screen.getByText("Login error")).toBeDefined();
    });

    it("calls reset on Try Again click", () => {
      render(<LoginError error={mockError} reset={mockReset} />);
      fireEvent.click(screen.getByText("Try Again"));
      expect(mockReset).toHaveBeenCalledOnce();
    });

    it("has Back to Home link with correct href", () => {
      render(<LoginError error={mockError} reset={mockReset} />);
      const links = screen.getAllByText("Back to Home");
      const link = links[0].closest("a");
      expect(link?.getAttribute("href")).toBe("/");
    });
  });

  describe("SignupError (app/(auth)/signup/error.tsx)", () => {
    it("renders 'Signup error' title", () => {
      render(<SignupError error={mockError} reset={mockReset} />);
      expect(screen.getByText("Signup error")).toBeDefined();
    });

    it("calls reset on Try Again click", () => {
      render(<SignupError error={mockError} reset={mockReset} />);
      fireEvent.click(screen.getByText("Try Again"));
      expect(mockReset).toHaveBeenCalledOnce();
    });
  });
});
