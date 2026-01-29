# TypeScript Strict Mode Enforcement

Comprehensive TypeScript patterns ensuring type safety with no `any` types and properly typed props.

## Overview

All generated components must follow strict TypeScript conventions:
- No `any` types anywhere in the codebase
- All component props explicitly typed with interfaces
- Proper generic constraints where applicable
- Discriminated unions for complex state
- Strict null checking enabled

## tsconfig.json Requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Component Props Typing

### Basic Component Pattern

```typescript
// ✅ CORRECT: Explicit props interface
interface ButtonProps {
  /**
   * Button variant style
   */
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  /**
   * Button size
   */
  size?: "sm" | "default" | "lg" | "icon"
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Click handler
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  /**
   * Button content
   */
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", disabled, onClick, children }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        onClick={onClick}
        className={buttonVariants({ variant, size })}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// ❌ WRONG: Missing types, using any
const Button = ({ variant, size, onClick, children }: any) => {
  return <button onClick={onClick}>{children}</button>
}
```

### Extending HTML Element Props

```typescript
// ✅ CORRECT: Extend native element props
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error message to display
   */
  error?: string
  /**
   * Left icon
   */
  startIcon?: React.ReactNode
  /**
   * Right icon
   */
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, startIcon, endIcon, ...props }, ref) => {
    return (
      <div className="relative">
        {startIcon && <span className="absolute left-3">{startIcon}</span>}
        <input
          ref={ref}
          className={cn(
            "input-base",
            startIcon && "pl-10",
            endIcon && "pr-10",
            error && "border-destructive",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {endIcon && <span className="absolute right-3">{endIcon}</span>}
      </div>
    )
  }
)
Input.displayName = "Input"
```

### Component with Children Variants

```typescript
// ✅ CORRECT: Discriminated union for different child types
interface CardPropsBase {
  className?: string
}

interface CardPropsWithChildren extends CardPropsBase {
  children: React.ReactNode
  title?: never
  description?: never
}

interface CardPropsWithTitleDesc extends CardPropsBase {
  title: string
  description?: string
  children?: never
}

type CardProps = CardPropsWithChildren | CardPropsWithTitleDesc

const Card = ({ className, children, title, description }: CardProps) => {
  return (
    <div className={cn("card", className)}>
      {children ?? (
        <>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </>
      )}
    </div>
  )
}
```

## Event Handler Typing

### Standard Event Types

```typescript
// ✅ CORRECT: Properly typed event handlers
interface FormProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: (event: React.FocusEvent<HTMLInputElement>) => void
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void
}

// Custom event data
interface SelectChangeEvent {
  value: string
  label: string
}

interface SelectProps {
  onChange: (event: SelectChangeEvent) => void
}

// Async handlers
interface AsyncButtonProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>
}
```

### Keyboard Event Patterns

```typescript
// ✅ CORRECT: Type-safe keyboard handling
const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
  // Type-safe key checking
  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault()
      handleSelect()
      break
    case "Escape":
      handleClose()
      break
    case "ArrowDown":
      event.preventDefault()
      focusNext()
      break
    case "ArrowUp":
      event.preventDefault()
      focusPrevious()
      break
  }
}

// Key type helper
type NavigationKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
type ActionKey = "Enter" | " " | "Escape"

const isNavigationKey = (key: string): key is NavigationKey => {
  return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)
}
```

## Generic Component Patterns

### Generic List Component

```typescript
// ✅ CORRECT: Generic with constraints
interface ListProps<T extends { id: string | number }> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor?: (item: T) => string | number
  emptyMessage?: string
}

function List<T extends { id: string | number }>({
  items,
  renderItem,
  keyExtractor = (item) => item.id,
  emptyMessage = "No items"
}: ListProps<T>) {
  if (items.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <ul>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  )
}

// Usage
interface User {
  id: string
  name: string
  email: string
}

<List<User>
  items={users}
  renderItem={(user) => <UserCard user={user} />}
/>
```

### Generic Select Component

```typescript
// ✅ CORRECT: Generic select with type inference
interface SelectOption<T> {
  value: T
  label: string
  disabled?: boolean
}

interface GenericSelectProps<T extends string | number> {
  options: SelectOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  placeholder?: string
}

function GenericSelect<T extends string | number>({
  options,
  value,
  onChange,
  placeholder
}: GenericSelectProps<T>) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
```

## State Typing Patterns

### Discriminated Unions for State

```typescript
// ✅ CORRECT: Discriminated union for async states
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error }

interface User {
  id: string
  name: string
}

const [userState, setUserState] = useState<AsyncState<User>>({ status: "idle" })

// Type-safe state handling
const renderUser = () => {
  switch (userState.status) {
    case "idle":
      return <p>Enter a user ID to search</p>
    case "loading":
      return <Spinner />
    case "success":
      // TypeScript knows data exists here
      return <UserProfile user={userState.data} />
    case "error":
      // TypeScript knows error exists here
      return <ErrorMessage message={userState.error.message} />
  }
}
```

### Form State Typing

```typescript
// ✅ CORRECT: Typed form state
interface FormData {
  name: string
  email: string
  age: number | null
  preferences: {
    newsletter: boolean
    notifications: boolean
  }
}

interface FormErrors {
  name?: string
  email?: string
  age?: string
}

interface FormState {
  data: FormData
  errors: FormErrors
  isSubmitting: boolean
  isValid: boolean
}

const initialState: FormState = {
  data: {
    name: "",
    email: "",
    age: null,
    preferences: {
      newsletter: false,
      notifications: true
    }
  },
  errors: {},
  isSubmitting: false,
  isValid: false
}

const [form, setForm] = useState<FormState>(initialState)

// Type-safe update
const updateField = <K extends keyof FormData>(
  field: K,
  value: FormData[K]
) => {
  setForm(prev => ({
    ...prev,
    data: { ...prev.data, [field]: value }
  }))
}
```

## Utility Type Patterns

### Common Utility Types

```typescript
// Pick specific props
type ButtonVariant = Pick<ButtonProps, "variant" | "size">

// Omit props (for wrapper components)
interface CardButtonProps extends Omit<ButtonProps, "variant"> {
  cardId: string
}

// Required props
type RequiredUser = Required<User>

// Partial for updates
type UserUpdate = Partial<User>

// Record for maps
type UserMap = Record<string, User>

// Extract from union
type SuccessState = Extract<AsyncState<User>, { status: "success" }>

// Exclude from union
type LoadingOrError = Exclude<AsyncState<User>, { status: "idle" | "success" }>
```

### Component Prop Utilities

```typescript
// Extract props from component
type ButtonPropsFromComponent = React.ComponentProps<typeof Button>

// Props with ref
type ButtonPropsWithRef = React.ComponentPropsWithRef<typeof Button>

// Props without ref
type ButtonPropsWithoutRef = React.ComponentPropsWithoutRef<typeof Button>

// Children type
type PropsWithRequiredChildren<P = unknown> = P & {
  children: React.ReactNode
}

// Polymorphic component helper
type AsProp<C extends React.ElementType> = {
  as?: C
}

type PolymorphicProps<C extends React.ElementType, Props = object> = AsProp<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof AsProp<C> | keyof Props> &
  Props
```

## Avoiding `any` Patterns

### Unknown vs Any

```typescript
// ❌ WRONG: Using any
const handleResponse = (data: any) => {
  return data.user.name
}

// ✅ CORRECT: Using unknown with type guards
const handleResponse = (data: unknown) => {
  if (isUserResponse(data)) {
    return data.user.name
  }
  throw new Error("Invalid response")
}

// Type guard
interface UserResponse {
  user: {
    name: string
    email: string
  }
}

function isUserResponse(data: unknown): data is UserResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "user" in data &&
    typeof (data as UserResponse).user?.name === "string"
  )
}
```

### Error Handling

```typescript
// ❌ WRONG: Catch with any
try {
  await fetchUser()
} catch (error: any) {
  console.log(error.message)
}

// ✅ CORRECT: Proper error handling
try {
  await fetchUser()
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log("Unknown error occurred")
  }
}

// Or with type assertion
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}
```

### JSON Parsing

```typescript
// ❌ WRONG: JSON.parse returns any
const data = JSON.parse(jsonString)

// ✅ CORRECT: Validate after parsing
interface Config {
  apiUrl: string
  timeout: number
}

const parseConfig = (jsonString: string): Config => {
  const parsed: unknown = JSON.parse(jsonString)

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "apiUrl" in parsed &&
    "timeout" in parsed &&
    typeof (parsed as Config).apiUrl === "string" &&
    typeof (parsed as Config).timeout === "number"
  ) {
    return parsed as Config
  }

  throw new Error("Invalid config format")
}

// Or use Zod for runtime validation
import { z } from "zod"

const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  timeout: z.number().positive()
})

const parseConfig = (jsonString: string): Config => {
  return ConfigSchema.parse(JSON.parse(jsonString))
}
```

## React-Specific Patterns

### Ref Typing

```typescript
// ✅ CORRECT: Properly typed refs
const inputRef = useRef<HTMLInputElement>(null)
const divRef = useRef<HTMLDivElement>(null)
const buttonRef = useRef<HTMLButtonElement>(null)

// Callback ref
const callbackRef = useCallback((node: HTMLInputElement | null) => {
  if (node) {
    node.focus()
  }
}, [])

// Imperative handle
interface InputHandle {
  focus: () => void
  clear: () => void
  getValue: () => string
}

const Input = forwardRef<InputHandle, InputProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      if (inputRef.current) inputRef.current.value = ""
    },
    getValue: () => inputRef.current?.value ?? ""
  }))

  return <input ref={inputRef} {...props} />
})
```

### Context Typing

```typescript
// ✅ CORRECT: Properly typed context
interface ThemeContextValue {
  theme: "light" | "dark"
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Hook with null check
const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

// Provider
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === "light" ? "dark" : "light")
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### Reducer Typing

```typescript
// ✅ CORRECT: Typed reducer with discriminated unions
interface State {
  count: number
  lastAction: string
}

type Action =
  | { type: "INCREMENT" }
  | { type: "DECREMENT" }
  | { type: "SET"; payload: number }
  | { type: "RESET" }

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1, lastAction: "increment" }
    case "DECREMENT":
      return { ...state, count: state.count - 1, lastAction: "decrement" }
    case "SET":
      // TypeScript knows payload exists for SET action
      return { ...state, count: action.payload, lastAction: "set" }
    case "RESET":
      return { count: 0, lastAction: "reset" }
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, lastAction: "" })
```

## Validation Checklist

Before component generation is complete, verify:

- [ ] No `any` types in the codebase
- [ ] All props have explicit interface/type
- [ ] Event handlers properly typed
- [ ] Refs properly typed
- [ ] Generic components have constraints
- [ ] State uses discriminated unions where appropriate
- [ ] Error handling uses `unknown` not `any`
- [ ] JSON parsing includes validation
- [ ] Context has null safety
- [ ] All exports have explicit types

## Error Messages

Common TypeScript errors and fixes:

| Error | Fix |
|-------|-----|
| `Parameter 'x' implicitly has an 'any' type` | Add explicit type annotation |
| `Object is possibly 'undefined'` | Add null check or optional chaining |
| `Type 'x' is not assignable to type 'y'` | Verify types match or use type assertion |
| `Property 'x' does not exist on type 'y'` | Add property to interface or use type guard |
| `Cannot find name 'x'` | Import the type or define it |

## Export

```typescript
// All types should be exported for reuse
export type {
  ButtonProps,
  InputProps,
  CardProps,
  SelectOption,
  AsyncState,
  FormData,
  FormState
}
```
