import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { AnimatedButton } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Checkbox } from "./checkbox"

// =============================================================================
// TYPES
// =============================================================================

export type SocialProvider = "google" | "github" | "apple"

export interface LoginFormData {
  email: string
  password: string
  rememberMe: boolean
}

export interface LoginFormProps {
  /**
   * Callback when form is submitted
   */
  onSubmit?: (data: LoginFormData) => void | Promise<void>
  /**
   * Callback when social auth button is clicked
   */
  onSocialAuth?: (provider: SocialProvider) => void
  /**
   * Callback when forgot password link is clicked
   */
  onForgotPassword?: () => void
  /**
   * Callback when sign up link is clicked
   */
  onSignUp?: () => void
  /**
   * Loading state for submit button
   */
  isLoading?: boolean
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether to show remember me checkbox
   * @default true
   */
  showRememberMe?: boolean
  /**
   * Whether to show social auth buttons
   * @default true
   */
  showSocialAuth?: boolean
  /**
   * Social providers to display
   * @default ['google', 'github', 'apple']
   */
  socialProviders?: SocialProvider[]
  /**
   * Form title
   * @default "Welcome back"
   */
  title?: string
  /**
   * Form subtitle
   * @default "Sign in to your account"
   */
  subtitle?: string
  /**
   * Additional class name for the form container
   */
  className?: string
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
}

// =============================================================================
// SOCIAL AUTH ICONS
// =============================================================================

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

const GitHubIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
)

const AppleIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

// =============================================================================
// SOCIAL AUTH BUTTON
// =============================================================================

interface SocialAuthButtonProps {
  provider: SocialProvider
  onClick?: () => void
  disabled?: boolean
}

const socialButtonStyles: Record<SocialProvider, string> = {
  google: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  github: "bg-[#24292e] text-white hover:bg-[#1b1f23]",
  apple: "bg-black text-white hover:bg-gray-900",
}

const socialButtonLabels: Record<SocialProvider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
  apple: "Continue with Apple",
}

const SocialAuthButton = React.forwardRef<HTMLButtonElement, SocialAuthButtonProps>(
  ({ provider, onClick, disabled }, ref) => {
    const Icon = {
      google: GoogleIcon,
      github: GitHubIcon,
      apple: AppleIcon,
    }[provider]

    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center justify-center gap-3 rounded-md px-4 py-2.5",
          "text-sm font-medium",
          "transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          socialButtonStyles[provider]
        )}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon />
        <span>{socialButtonLabels[provider]}</span>
      </motion.button>
    )
  }
)
SocialAuthButton.displayName = "SocialAuthButton"

// =============================================================================
// DIVIDER
// =============================================================================

const Divider = ({ children }: { children: React.ReactNode }) => (
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-card px-2 text-muted-foreground">{children}</span>
    </div>
  </div>
)

// =============================================================================
// LOGIN FORM COMPONENT
// =============================================================================

const LoginForm = React.forwardRef<HTMLFormElement, LoginFormProps>(
  (
    {
      onSubmit,
      onSocialAuth,
      onForgotPassword,
      onSignUp,
      isLoading = false,
      error,
      showRememberMe = true,
      showSocialAuth = true,
      socialProviders = ["google", "github", "apple"],
      title = "Welcome back",
      subtitle = "Sign in to your account",
      className,
    },
    ref
  ) => {
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [rememberMe, setRememberMe] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)

    const emailId = React.useId()
    const passwordId = React.useId()
    const rememberMeId = React.useId()
    const errorId = React.useId()

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      await onSubmit?.({ email, password, rememberMe })
    }

    return (
      <motion.div
        className={cn(
          "w-full max-w-md mx-auto",
          "rounded-xl border border-border bg-card p-6 sm:p-8",
          "shadow-lg",
          className
        )}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.form
          ref={ref}
          onSubmit={handleSubmit}
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          aria-busy={isLoading}
        >
          {/* Header */}
          <motion.div className="space-y-2 text-center" variants={itemVariants}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </motion.div>

          {/* Error Message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                id={errorId}
                role="alert"
                className={cn(
                  "flex items-center gap-2 rounded-md p-3",
                  "bg-destructive/10 text-destructive text-sm"
                )}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social Auth */}
          {showSocialAuth && socialProviders.length > 0 && (
            <>
              <motion.div className="space-y-3" variants={itemVariants}>
                {socialProviders.map((provider) => (
                  <SocialAuthButton
                    key={provider}
                    provider={provider}
                    onClick={() => onSocialAuth?.(provider)}
                    disabled={isLoading}
                  />
                ))}
              </motion.div>

              <motion.div variants={itemVariants}>
                <Divider>or continue with email</Divider>
              </motion.div>
            </>
          )}

          {/* Email Field */}
          <motion.div className="space-y-2" variants={itemVariants}>
            <Label htmlFor={emailId} required>
              Email address
            </Label>
            <Input
              id={emailId}
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
              aria-describedby={error ? errorId : undefined}
              leftElement={<Mail className="h-4 w-4" />}
            />
          </motion.div>

          {/* Password Field */}
          <motion.div className="space-y-2" variants={itemVariants}>
            <div className="flex items-center justify-between">
              <Label htmlFor={passwordId} required>
                Password
              </Label>
              {onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className={cn(
                    "text-sm font-medium text-primary",
                    "hover:text-primary/80 hover:underline",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "rounded-sm"
                  )}
                  tabIndex={isLoading ? -1 : 0}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
              aria-describedby={error ? errorId : undefined}
              leftElement={<Lock className="h-4 w-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    "focus-visible:outline-none focus-visible:text-foreground",
                    "transition-colors"
                  )}
                  tabIndex={isLoading ? -1 : 0}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
          </motion.div>

          {/* Remember Me */}
          {showRememberMe && (
            <motion.div className="flex items-center gap-2" variants={itemVariants}>
              <Checkbox
                id={rememberMeId}
                checked={rememberMe}
                onCheckedChange={setRememberMe}
                disabled={isLoading}
              />
              <Label
                htmlFor={rememberMeId}
                variant="muted"
                className="cursor-pointer font-normal"
              >
                Remember me for 30 days
              </Label>
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.div variants={itemVariants}>
            <AnimatedButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </AnimatedButton>
          </motion.div>

          {/* Sign Up Link */}
          {onSignUp && (
            <motion.p
              className="text-center text-sm text-muted-foreground"
              variants={itemVariants}
            >
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={onSignUp}
                className={cn(
                  "font-medium text-primary",
                  "hover:text-primary/80 hover:underline",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "rounded-sm"
                )}
                tabIndex={isLoading ? -1 : 0}
              >
                Sign up
              </button>
            </motion.p>
          )}
        </motion.form>
      </motion.div>
    )
  }
)
LoginForm.displayName = "LoginForm"

// =============================================================================
// EXPORTS
// =============================================================================

export { LoginForm, SocialAuthButton }
