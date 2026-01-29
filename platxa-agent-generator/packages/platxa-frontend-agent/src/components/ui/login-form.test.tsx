import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LoginForm, SocialAuthButton } from "./login-form"
import type { SocialProvider } from "./login-form"

// =============================================================================
// SOCIAL AUTH BUTTON TESTS
// =============================================================================

describe("SocialAuthButton", () => {
  it("renders google button", () => {
    render(<SocialAuthButton provider="google" />)
    expect(screen.getByText("Continue with Google")).toBeInTheDocument()
  })

  it("renders github button", () => {
    render(<SocialAuthButton provider="github" />)
    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument()
  })

  it("renders apple button", () => {
    render(<SocialAuthButton provider="apple" />)
    expect(screen.getByText("Continue with Apple")).toBeInTheDocument()
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<SocialAuthButton provider="google" onClick={handleClick} />)
    await user.click(screen.getByRole("button"))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("is disabled when disabled prop is true", () => {
    render(<SocialAuthButton provider="google" disabled />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})

// =============================================================================
// LOGIN FORM TESTS
// =============================================================================

describe("LoginForm", () => {
  describe("rendering", () => {
    it("renders with default title", () => {
      render(<LoginForm />)
      expect(screen.getByText("Welcome back")).toBeInTheDocument()
    })

    it("renders with default subtitle", () => {
      render(<LoginForm />)
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument()
    })

    it("renders with custom title", () => {
      render(<LoginForm title="Custom Title" />)
      expect(screen.getByText("Custom Title")).toBeInTheDocument()
    })

    it("renders email field", () => {
      render(<LoginForm />)
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })

    it("renders credential input", () => {
      render(<LoginForm />)
      expect(screen.getByPlaceholderText(/enter your/i)).toBeInTheDocument()
    })

    it("renders social auth buttons by default", () => {
      render(<LoginForm />)
      expect(screen.getByText("Continue with Google")).toBeInTheDocument()
      expect(screen.getByText("Continue with GitHub")).toBeInTheDocument()
      expect(screen.getByText("Continue with Apple")).toBeInTheDocument()
    })

    it("hides social auth when showSocialAuth is false", () => {
      render(<LoginForm showSocialAuth={false} />)
      expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument()
    })

    it("renders only specified providers", () => {
      render(<LoginForm socialProviders={["google"] as SocialProvider[]} />)
      expect(screen.getByText("Continue with Google")).toBeInTheDocument()
      expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument()
    })

    it("renders remember me checkbox by default", () => {
      render(<LoginForm />)
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument()
    })

    it("hides remember me when showRememberMe is false", () => {
      render(<LoginForm showRememberMe={false} />)
      expect(screen.queryByLabelText(/remember me/i)).not.toBeInTheDocument()
    })

    it("renders sign up link when callback provided", () => {
      render(<LoginForm onSignUp={() => {}} />)
      expect(screen.getByText(/sign up/i)).toBeInTheDocument()
    })
  })

  describe("interactions", () => {
    it("allows typing in email field", async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, "test@example.com")

      expect(emailInput).toHaveValue("test@example.com")
    })

    it("allows typing in credential field", async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const credInput = screen.getByPlaceholderText(/enter your/i)
      await user.type(credInput, "testsecret")

      expect(credInput).toHaveValue("testsecret")
    })

    it("toggles credential visibility", async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const credInput = screen.getByPlaceholderText(/enter your/i)
      expect(credInput.getAttribute("type")).not.toBe("text")

      await user.click(screen.getByLabelText(/show/i))
      expect(credInput).toHaveAttribute("type", "text")

      await user.click(screen.getByLabelText(/hide/i))
      expect(credInput.getAttribute("type")).not.toBe("text")
    })

    it("toggles remember me checkbox", async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const checkbox = screen.getByLabelText(/remember me/i)
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(checkbox).toBeChecked()
    })
  })

  describe("submission", () => {
    it("calls onSubmit with form data", async () => {
      const user = userEvent.setup()
      const handleSubmit = vi.fn()

      render(<LoginForm onSubmit={handleSubmit} />)

      await user.type(screen.getByLabelText(/email address/i), "test@example.com")
      await user.type(screen.getByPlaceholderText(/enter your/i), "secret123")
      await user.click(screen.getByLabelText(/remember me/i))
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("social auth", () => {
    it("calls onSocialAuth when social button clicked", async () => {
      const user = userEvent.setup()
      const handleSocialAuth = vi.fn()

      render(<LoginForm onSocialAuth={handleSocialAuth} />)

      await user.click(screen.getByText("Continue with Google"))
      expect(handleSocialAuth).toHaveBeenCalledWith("google")
    })
  })

  describe("loading state", () => {
    it("shows loading text", () => {
      render(<LoginForm isLoading />)
      expect(screen.getByRole("button", { name: /signing in/i })).toBeInTheDocument()
    })

    it("disables submit button", () => {
      render(<LoginForm isLoading />)
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled()
    })

    it("sets aria-busy on form", () => {
      render(<LoginForm isLoading />)
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true")
    })
  })

  describe("error state", () => {
    it("displays error message", () => {
      render(<LoginForm error="Invalid credentials" />)
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials")
    })

    it("error has proper role", () => {
      render(<LoginForm error="Error" />)
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has required indicators", () => {
      render(<LoginForm />)
      const emailLabel = screen.getByText(/email address/i)
      expect(emailLabel.closest("label")).toContainHTML("*")
    })

    it("toggle has accessible label", () => {
      render(<LoginForm />)
      expect(screen.getByLabelText(/show/i)).toBeInTheDocument()
    })

    it("email has autocomplete", () => {
      render(<LoginForm />)
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute("autocomplete", "email")
    })
  })
})
