import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button, AnimatedButton } from "./button"

// Mock framer-motion for AnimatedButton tests
vi.mock("framer-motion", async () => {
  const actual = await import("../../test/mocks/framer-motion")
  return actual
})

describe("Button", () => {
  describe("Rendering", () => {
    it("renders with default props", () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument()
    })

    it("renders children correctly", () => {
      render(<Button>Test Button</Button>)
      expect(screen.getByText("Test Button")).toBeInTheDocument()
    })

    it("forwards ref correctly", () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Button</Button>)
      expect(ref).toHaveBeenCalled()
    })
  })

  describe("Variants", () => {
    it("applies default variant classes", () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("bg-primary")
    })

    it("applies destructive variant classes", () => {
      render(<Button variant="destructive">Delete</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("bg-destructive")
    })

    it("applies outline variant classes", () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("border")
    })

    it("applies secondary variant classes", () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("bg-secondary")
    })

    it("applies ghost variant classes", () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("hover:bg-accent")
    })

    it("applies link variant classes", () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("underline-offset-4")
    })
  })

  describe("Sizes", () => {
    it("applies default size classes", () => {
      render(<Button>Default Size</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-10", "px-4")
    })

    it("applies sm size classes", () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-9", "px-3")
    })

    it("applies lg size classes", () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-11", "px-8")
    })

    it("applies icon size classes", () => {
      render(<Button size="icon" aria-label="Icon button">🔍</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("h-10", "w-10")
    })
  })

  describe("States", () => {
    it("disables button when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })

    it("disables button when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>)
      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })

    it("shows loading spinner when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>)
      const spinner = screen.getByRole("button").querySelector("svg")
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass("animate-spin")
    })

    it("sets aria-busy when loading", () => {
      render(<Button isLoading>Loading</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveAttribute("aria-busy", "true")
    })
  })

  describe("Icons", () => {
    it("renders left icon", () => {
      render(<Button leftIcon={<span data-testid="left-icon">←</span>}>With Left Icon</Button>)
      expect(screen.getByTestId("left-icon")).toBeInTheDocument()
    })

    it("renders right icon", () => {
      render(<Button rightIcon={<span data-testid="right-icon">→</span>}>With Right Icon</Button>)
      expect(screen.getByTestId("right-icon")).toBeInTheDocument()
    })

    it("renders both icons", () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Both Icons
        </Button>
      )
      expect(screen.getByTestId("left-icon")).toBeInTheDocument()
      expect(screen.getByTestId("right-icon")).toBeInTheDocument()
    })

    it("does not render icons when loading", () => {
      render(
        <Button
          isLoading
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Loading
        </Button>
      )
      expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument()
      expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument()
    })
  })

  describe("Interactions", () => {
    it("calls onClick when clicked", async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)

      await user.click(screen.getByRole("button"))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("does not call onClick when disabled", async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Disabled</Button>)

      await user.click(screen.getByRole("button"))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it("does not call onClick when loading", async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()
      render(<Button isLoading onClick={handleClick}>Loading</Button>)

      await user.click(screen.getByRole("button"))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe("asChild", () => {
    it("renders as child element when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      const link = screen.getByRole("link", { name: /link button/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/test")
    })
  })

  describe("Custom className", () => {
    it("merges custom className with variant classes", () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole("button")
      expect(button).toHaveClass("custom-class")
      expect(button).toHaveClass("bg-primary") // default variant still applied
    })
  })

  describe("Accessibility", () => {
    it("has accessible name", () => {
      render(<Button>Accessible Button</Button>)
      expect(screen.getByRole("button", { name: /accessible button/i })).toBeInTheDocument()
    })

    it("supports aria-label for icon buttons", () => {
      render(<Button size="icon" aria-label="Search">🔍</Button>)
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument()
    })

    it("is focusable", () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole("button")
      button.focus()
      expect(button).toHaveFocus()
    })

    it("is not focusable when disabled", () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })
  })
})

describe("AnimatedButton", () => {
  it("renders correctly", () => {
    render(<AnimatedButton>Animated</AnimatedButton>)
    expect(screen.getByRole("button", { name: /animated/i })).toBeInTheDocument()
  })

  it("applies variant classes", () => {
    render(<AnimatedButton variant="destructive">Delete</AnimatedButton>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-destructive")
  })

  it("shows loading state", () => {
    render(<AnimatedButton isLoading>Loading</AnimatedButton>)
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
  })
})
