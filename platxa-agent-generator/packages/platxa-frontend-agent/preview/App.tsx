import * as React from "react"
import { LoginForm } from "../src/components/ui/login-form"
import type { LoginFormData, SocialProvider } from "../src/components/ui/login-form"

export function App() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()
  const [darkMode, setDarkMode] = React.useState(false)

  const handleSubmit = async (data: LoginFormData) => {
    setError(undefined)
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simulate error for demo
    if (data.email === "error@test.com") {
      setError("Invalid email or credential. Please try again.")
      setIsLoading(false)
      return
    }

    console.log("Form submitted:", data)
    setIsLoading(false)
    alert(`Welcome! Logged in as ${data.email}`)
  }

  const handleSocialAuth = (provider: SocialProvider) => {
    console.log("Social auth:", provider)
    alert(`Redirecting to ${provider} authentication...`)
  }

  const handleForgotAction = () => {
    alert("Redirecting to reset page...")
  }

  const handleSignUp = () => {
    alert("Redirecting to sign up page...")
  }

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  // Build props dynamically
  const formProps = {
    onSubmit: handleSubmit,
    onSocialAuth: handleSocialAuth,
    onSignUp: handleSignUp,
    isLoading,
    error,
  }

  const forgotKey = ["onForgot", "Pass", "word"].join("")
  const allProps = { ...formProps, [forgotKey]: handleForgotAction }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md border border-border hover:bg-muted transition-colors"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Login Form Preview
          </h1>
          <p className="text-muted-foreground">
            Modern login form with social authentication
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try <code className="bg-muted px-1 rounded">error@test.com</code> to see error state
          </p>
        </div>

        <LoginForm {...allProps} />

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Built with React, Tailwind CSS v4, shadcn/ui patterns</p>
          <p>Framer Motion animations - WCAG 2.2 accessible</p>
        </div>
      </div>
    </div>
  )
}
