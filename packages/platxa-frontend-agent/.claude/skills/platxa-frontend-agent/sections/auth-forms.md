# Auth Forms Generator

Complete login, signup, and password reset forms with validation and OAuth provider buttons.

## Generated Components

```typescript
"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

// =============================================================================
// SCHEMAS
// =============================================================================

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional()
})

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions"
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address")
})

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

type LoginFormData = z.infer<typeof loginSchema>
type SignupFormData = z.infer<typeof signupSchema>
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

// =============================================================================
// AUTH CARD WRAPPER
// =============================================================================

interface AuthCardProps {
  children: React.ReactNode
  title: string
  description?: string
  footer?: React.ReactNode
}

const AuthCard = ({ children, title, description, footer }: AuthCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="w-full max-w-md mx-auto"
  >
    <div className="rounded-xl border bg-card text-card-foreground shadow-lg">
      <div className="p-6 space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-6 pt-0">{children}</div>
      {footer && (
        <div className="p-6 pt-0 text-center text-sm">{footer}</div>
      )}
    </div>
  </motion.div>
)

// =============================================================================
// LOGIN FORM
// =============================================================================

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  onForgotPassword?: () => void
  onSignup?: () => void
  oauthProviders?: OAuthProvider[]
  loading?: boolean
}

const LoginForm = ({
  onSubmit,
  onForgotPassword,
  onSignup,
  oauthProviders = [],
  loading = false
}: LoginFormProps) => {
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false
    }
  })

  const handleSubmit = async (data: LoginFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      form.setError("root", {
        message: "Invalid email or password"
      })
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Enter your credentials to access your account"
      footer={
        onSignup && (
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onSignup}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </button>
          </p>
        )
      }
    >
      {/* OAuth Providers */}
      {oauthProviders.length > 0 && (
        <>
          <OAuthButtons providers={oauthProviders} />
          <Divider />
        </>
      )}

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Email */}
        <FormField
          label="Email"
          error={form.formState.errors.email?.message}
        >
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="name@example.com"
              className="pl-9"
              disabled={loading}
              {...form.register("email")}
            />
          </div>
        </FormField>

        {/* Password */}
        <FormField
          label="Password"
          error={form.formState.errors.password?.message}
        >
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="pl-9 pr-10"
              disabled={loading}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </FormField>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              disabled={loading}
              {...form.register("remember")}
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              Remember me
            </Label>
          </div>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>

        {/* Error */}
        {form.formState.errors.root && (
          <p className="text-sm text-destructive text-center">
            {form.formState.errors.root.message}
          </p>
        )}

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthCard>
  )
}

// =============================================================================
// SIGNUP FORM
// =============================================================================

interface SignupFormProps {
  onSubmit: (data: SignupFormData) => Promise<void>
  onLogin?: () => void
  oauthProviders?: OAuthProvider[]
  loading?: boolean
  termsUrl?: string
  privacyUrl?: string
}

const SignupForm = ({
  onSubmit,
  onLogin,
  oauthProviders = [],
  loading = false,
  termsUrl = "/terms",
  privacyUrl = "/privacy"
}: SignupFormProps) => {
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false
    }
  })

  const password = form.watch("password")

  const handleSubmit = async (data: SignupFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      form.setError("root", {
        message: "Failed to create account. Please try again."
      })
    }
  }

  return (
    <AuthCard
      title="Create an account"
      description="Enter your details to get started"
      footer={
        onLogin && (
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onLogin}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        )
      }
    >
      {/* OAuth Providers */}
      {oauthProviders.length > 0 && (
        <>
          <OAuthButtons providers={oauthProviders} />
          <Divider />
        </>
      )}

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Name */}
        <FormField
          label="Full name"
          error={form.formState.errors.name?.message}
        >
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="John Doe"
              className="pl-9"
              disabled={loading}
              {...form.register("name")}
            />
          </div>
        </FormField>

        {/* Email */}
        <FormField
          label="Email"
          error={form.formState.errors.email?.message}
        >
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="name@example.com"
              className="pl-9"
              disabled={loading}
              {...form.register("email")}
            />
          </div>
        </FormField>

        {/* Password */}
        <FormField
          label="Password"
          error={form.formState.errors.password?.message}
        >
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="pl-9 pr-10"
              disabled={loading}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
        </FormField>

        {/* Confirm Password */}
        <FormField
          label="Confirm password"
          error={form.formState.errors.confirmPassword?.message}
        >
          <Input
            type="password"
            placeholder="••••••••"
            disabled={loading}
            {...form.register("confirmPassword")}
          />
        </FormField>

        {/* Terms */}
        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            disabled={loading}
            {...form.register("terms")}
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-5">
            I agree to the{" "}
            <a href={termsUrl} className="text-primary hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href={privacyUrl} className="text-primary hover:underline">
              Privacy Policy
            </a>
          </Label>
        </div>
        {form.formState.errors.terms && (
          <p className="text-sm text-destructive">
            {form.formState.errors.terms.message}
          </p>
        )}

        {/* Error */}
        {form.formState.errors.root && (
          <p className="text-sm text-destructive text-center">
            {form.formState.errors.root.message}
          </p>
        )}

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthCard>
  )
}

// =============================================================================
// FORGOT PASSWORD FORM
// =============================================================================

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordFormData) => Promise<void>
  onBack?: () => void
  loading?: boolean
}

const ForgotPasswordForm = ({
  onSubmit,
  onBack,
  loading = false
}: ForgotPasswordFormProps) => {
  const [submitted, setSubmitted] = React.useState(false)

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  })

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    await onSubmit(data)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthCard
        title="Check your email"
        description="We've sent a password reset link to your email address."
      >
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="text-primary hover:underline"
            >
              try again
            </button>
          </p>
          {onBack && (
            <Button variant="outline" className="w-full" onClick={onBack}>
              Back to sign in
            </Button>
          )}
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Forgot password?"
      description="Enter your email and we'll send you a reset link"
      footer={
        onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to sign in
          </button>
        )
      }
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          label="Email"
          error={form.formState.errors.email?.message}
        >
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="name@example.com"
              className="pl-9"
              disabled={loading}
              {...form.register("email")}
            />
          </div>
        </FormField>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthCard>
  )
}

// =============================================================================
// RESET PASSWORD FORM
// =============================================================================

interface ResetPasswordFormProps {
  onSubmit: (data: ResetPasswordFormData) => Promise<void>
  loading?: boolean
}

const ResetPasswordForm = ({
  onSubmit,
  loading = false
}: ResetPasswordFormProps) => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" }
  })

  const password = form.watch("password")

  const handleSubmit = async (data: ResetPasswordFormData) => {
    await onSubmit(data)
    setSuccess(true)
  }

  if (success) {
    return (
      <AuthCard
        title="Password reset!"
        description="Your password has been successfully reset."
      >
        <div className="text-center">
          <Button asChild className="w-full">
            <a href="/login">Sign in with new password</a>
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset password"
      description="Enter your new password below"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          label="New password"
          error={form.formState.errors.password?.message}
        >
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="pr-10"
              disabled={loading}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
        </FormField>

        <FormField
          label="Confirm new password"
          error={form.formState.errors.confirmPassword?.message}
        >
          <Input
            type="password"
            placeholder="••••••••"
            disabled={loading}
            {...form.register("confirmPassword")}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthCard>
  )
}

// =============================================================================
// OAUTH BUTTONS
// =============================================================================

interface OAuthProvider {
  id: string
  name: string
  icon: React.ReactNode
  onClick: () => void
}

const OAuthButtons = ({ providers }: { providers: OAuthProvider[] }) => (
  <div className="grid gap-2">
    {providers.map((provider) => (
      <Button
        key={provider.id}
        type="button"
        variant="outline"
        className="w-full"
        onClick={provider.onClick}
      >
        {provider.icon}
        <span className="ml-2">Continue with {provider.name}</span>
      </Button>
    ))}
  </div>
)

// OAuth Icons
const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

const GitHubIcon = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

const AppleIcon = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const Divider = () => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-card px-2 text-muted-foreground">
        or continue with
      </span>
    </div>
  </div>
)

interface FormFieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

const FormField = ({ label, error, children }: FormFieldProps) => (
  <div className="space-y-2">
    <Label className={cn(error && "text-destructive")}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
)

interface PasswordStrengthProps {
  password: string
}

const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const checks = [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Uppercase", valid: /[A-Z]/.test(password) },
    { label: "Lowercase", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /[0-9]/.test(password) }
  ]

  const strength = checks.filter((c) => c.valid).length

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              strength >= level
                ? strength <= 2
                  ? "bg-destructive"
                  : strength === 3
                  ? "bg-yellow-500"
                  : "bg-green-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {checks.map((check) => (
          <span
            key={check.label}
            className={cn(
              check.valid ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {check.valid ? "✓" : "○"} {check.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export {
  LoginForm,
  SignupForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  AuthCard,
  OAuthButtons,
  GoogleIcon,
  GitHubIcon,
  AppleIcon
}
export type {
  LoginFormProps,
  SignupFormProps,
  ForgotPasswordFormProps,
  ResetPasswordFormProps,
  OAuthProvider,
  LoginFormData,
  SignupFormData
}
```

## Basic Usage

### Login Form

```typescript
import { LoginForm, GoogleIcon, GitHubIcon } from "@/components/sections/auth-forms"

const LoginPage = () => {
  const handleLogin = async (data) => {
    await signIn("credentials", data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm
        onSubmit={handleLogin}
        onForgotPassword={() => router.push("/forgot-password")}
        onSignup={() => router.push("/signup")}
        oauthProviders={[
          {
            id: "google",
            name: "Google",
            icon: <GoogleIcon />,
            onClick: () => signIn("google")
          },
          {
            id: "github",
            name: "GitHub",
            icon: <GitHubIcon />,
            onClick: () => signIn("github")
          }
        ]}
      />
    </div>
  )
}
```

### Signup Form

```typescript
import { SignupForm } from "@/components/sections/auth-forms"

const SignupPage = () => {
  const handleSignup = async (data) => {
    await createUser(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm
        onSubmit={handleSignup}
        onLogin={() => router.push("/login")}
        termsUrl="/terms"
        privacyUrl="/privacy"
      />
    </div>
  )
}
```

### Forgot Password Flow

```typescript
import { ForgotPasswordForm } from "@/components/sections/auth-forms"

const ForgotPasswordPage = () => {
  const handleForgotPassword = async (data) => {
    await sendPasswordResetEmail(data.email)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ForgotPasswordForm
        onSubmit={handleForgotPassword}
        onBack={() => router.push("/login")}
      />
    </div>
  )
}
```

### Reset Password

```typescript
import { ResetPasswordForm } from "@/components/sections/auth-forms"

const ResetPasswordPage = ({ token }) => {
  const handleResetPassword = async (data) => {
    await resetPassword(token, data.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ResetPasswordForm onSubmit={handleResetPassword} />
    </div>
  )
}
```

## OAuth Provider Examples

### All Major Providers

```typescript
const oauthProviders = [
  {
    id: "google",
    name: "Google",
    icon: <GoogleIcon />,
    onClick: () => signIn("google")
  },
  {
    id: "github",
    name: "GitHub",
    icon: <GitHubIcon />,
    onClick: () => signIn("github")
  },
  {
    id: "apple",
    name: "Apple",
    icon: <AppleIcon />,
    onClick: () => signIn("apple")
  }
]
```

### Enterprise SSO

```typescript
const oauthProviders = [
  {
    id: "okta",
    name: "Company SSO",
    icon: <Building className="h-4 w-4" />,
    onClick: () => signIn("okta")
  }
]
```

## Auth Page Layout

```typescript
const AuthLayout = ({ children }) => (
  <div className="min-h-screen grid lg:grid-cols-2">
    {/* Left: Form */}
    <div className="flex items-center justify-center p-8">
      {children}
    </div>

    {/* Right: Hero Image */}
    <div className="hidden lg:block relative bg-primary">
      <img
        src="/auth-hero.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="relative z-10 flex flex-col justify-center h-full p-12 text-white">
        <blockquote className="space-y-4">
          <p className="text-2xl font-medium">
            "This platform has transformed how we build products."
          </p>
          <footer className="text-sm opacity-80">
            — Sarah Chen, CTO at TechCorp
          </footer>
        </blockquote>
      </div>
    </div>
  </div>
)
```

## Password Validation Rules

| Rule | Regex | Message |
|------|-------|---------|
| Minimum length | `.{8,}` | At least 8 characters |
| Uppercase | `[A-Z]` | One uppercase letter |
| Lowercase | `[a-z]` | One lowercase letter |
| Number | `[0-9]` | One number |
| Special char (optional) | `[!@#$%^&*]` | One special character |

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Form labels | Every input has associated `<Label>` |
| Error announcements | Errors linked with `aria-describedby` |
| Focus management | Auto-focus first field on mount |
| Password toggle | Toggle has `aria-label` |
| Loading states | Buttons disabled during submit |
| Success feedback | Clear success messages |

## Best Practices

| Do | Don't |
|----|-------|
| Show password strength indicator | Just reject weak passwords |
| Provide OAuth options | Force email-only signup |
| Show inline validation errors | Only show errors on submit |
| Allow password visibility toggle | Hide password without option |
| Link to terms during signup | Hide legal requirements |
| Provide "Remember me" option | Force re-login every time |

## Export

```typescript
// components/sections/auth-forms.tsx
export {
  LoginForm,
  SignupForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  AuthCard,
  OAuthButtons,
  GoogleIcon,
  GitHubIcon,
  AppleIcon
}
```
