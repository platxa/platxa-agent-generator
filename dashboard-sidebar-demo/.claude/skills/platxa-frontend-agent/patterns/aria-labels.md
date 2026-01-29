# ARIA Labels for Icons and Buttons

Icon-only buttons and decorative elements need accessible names to be usable by screen reader users. This pattern ensures all interactive elements have proper labels.

## WCAG Requirements

| Criterion | Requirement | Level |
|-----------|-------------|-------|
| 1.1.1 Non-text Content | Text alternatives for non-text content | A |
| 4.1.2 Name, Role, Value | UI components have accessible names | A |
| 2.5.3 Label in Name | Visible label matches accessible name | A |

## The Problem

```typescript
// ❌ INACCESSIBLE: No text for screen readers
<button onClick={onClose}>
  <XIcon />
</button>
// Screen reader announces: "button"

// ✅ ACCESSIBLE: Has aria-label
<button onClick={onClose} aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>
// Screen reader announces: "Close dialog, button"
```

## Labeling Methods

### 1. aria-label (Preferred for Icon Buttons)

```typescript
// Simple, direct labeling
<button aria-label="Search">
  <SearchIcon aria-hidden="true" />
</button>

<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

<button aria-label="Open menu">
  <MenuIcon aria-hidden="true" />
</button>
```

### 2. Visually Hidden Text (sr-only)

```typescript
// When you want text in the DOM but hidden visually
<button>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">Search</span>
</button>

// Utility class
// .sr-only {
//   position: absolute;
//   width: 1px;
//   height: 1px;
//   padding: 0;
//   margin: -1px;
//   overflow: hidden;
//   clip: rect(0, 0, 0, 0);
//   white-space: nowrap;
//   border: 0;
// }
```

### 3. aria-labelledby (Reference Existing Text)

```typescript
// Reference another element's text
<div>
  <h2 id="section-title">User Settings</h2>
  <button aria-labelledby="section-title">
    <SettingsIcon aria-hidden="true" />
  </button>
</div>
```

### 4. title Attribute (Avoid)

```typescript
// ⚠️ NOT RECOMMENDED: Inconsistent screen reader support
<button title="Search">
  <SearchIcon />
</button>
```

## Icon Button Component

### Basic Implementation

```typescript
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string  // Required - enforces accessibility
  srOnly?: boolean  // Use sr-only text instead of aria-label
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, srOnly = false, className, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={srOnly ? undefined : label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      {srOnly && <span className="sr-only">{label}</span>}
    </button>
  )
)
```

### With Variants

```typescript
const iconButtonVariants = cva(
  [
    "inline-flex items-center justify-center rounded-md",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "transition-colors"
  ],
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-foreground hover:bg-accent",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "text-destructive hover:text-destructive-foreground hover:bg-destructive",
        ghost: "hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        lg: "h-12 w-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: React.ReactNode
  label: string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant, size, className, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
)
```

## Label Generation

### From Icon Name

```typescript
const ICON_LABELS: Record<string, string> = {
  // Navigation
  Menu: "Open menu",
  X: "Close",
  ChevronLeft: "Go back",
  ChevronRight: "Go forward",
  ChevronUp: "Collapse",
  ChevronDown: "Expand",
  Home: "Go to home",
  ArrowLeft: "Previous",
  ArrowRight: "Next",

  // Actions
  Plus: "Add",
  Minus: "Remove",
  Trash: "Delete",
  Trash2: "Delete",
  Edit: "Edit",
  Edit2: "Edit",
  Pencil: "Edit",
  Copy: "Copy",
  Clipboard: "Copy to clipboard",
  Check: "Confirm",
  Save: "Save",
  Download: "Download",
  Upload: "Upload",
  Share: "Share",
  Share2: "Share",

  // Media
  Play: "Play",
  Pause: "Pause",
  Stop: "Stop",
  SkipBack: "Previous track",
  SkipForward: "Next track",
  Volume: "Volume",
  Volume2: "Volume",
  VolumeX: "Mute",

  // Communication
  Mail: "Email",
  Phone: "Call",
  MessageSquare: "Message",
  MessageCircle: "Chat",
  Send: "Send",

  // View
  Search: "Search",
  ZoomIn: "Zoom in",
  ZoomOut: "Zoom out",
  Eye: "View",
  EyeOff: "Hide",
  Maximize: "Maximize",
  Minimize: "Minimize",
  Fullscreen: "Enter fullscreen",

  // Settings
  Settings: "Settings",
  Sliders: "Adjust settings",
  Filter: "Filter",
  SortAsc: "Sort ascending",
  SortDesc: "Sort descending",
  MoreHorizontal: "More options",
  MoreVertical: "More options",

  // User
  User: "User profile",
  Users: "Users",
  UserPlus: "Add user",
  UserMinus: "Remove user",
  LogIn: "Log in",
  LogOut: "Log out",

  // Status
  Info: "Information",
  AlertCircle: "Warning",
  AlertTriangle: "Alert",
  HelpCircle: "Help",
  CheckCircle: "Success",
  XCircle: "Error",

  // Misc
  Star: "Favorite",
  Heart: "Like",
  Bookmark: "Bookmark",
  Flag: "Flag",
  Bell: "Notifications",
  Calendar: "Calendar",
  Clock: "Time",
  Link: "Link",
  ExternalLink: "Open in new tab",
  Refresh: "Refresh",
  RotateCw: "Rotate clockwise",
  RotateCcw: "Rotate counter-clockwise"
}

function generateIconLabel(iconName: string, context?: string): string {
  const baseLabel = ICON_LABELS[iconName]

  if (!baseLabel) {
    // Convert PascalCase to sentence
    return iconName
      .replace(/([A-Z])/g, " $1")
      .trim()
      .toLowerCase()
  }

  if (context) {
    return `${baseLabel} ${context}`
  }

  return baseLabel
}

// Usage
generateIconLabel("Trash")           // "Delete"
generateIconLabel("Trash", "user")   // "Delete user"
generateIconLabel("Edit", "profile") // "Edit profile"
```

### Context-Aware Labels

```typescript
function generateContextualLabel(
  action: string,
  target?: string,
  state?: string
): string {
  const parts: string[] = []

  // State prefix (if toggled)
  if (state) {
    parts.push(state)
  }

  // Action
  parts.push(action)

  // Target
  if (target) {
    parts.push(target)
  }

  return parts.join(" ")
}

// Usage examples
generateContextualLabel("Delete", "comment")           // "Delete comment"
generateContextualLabel("Toggle", "sidebar", "Open")   // "Open Toggle sidebar"
generateContextualLabel("Edit", "profile")             // "Edit profile"
```

### Dynamic Labels for Toggles

```typescript
interface ToggleButtonProps {
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  isActive: boolean
  labelActive: string
  labelInactive: string
  onToggle: () => void
}

const ToggleButton = ({
  icon,
  activeIcon,
  isActive,
  labelActive,
  labelInactive,
  onToggle
}: ToggleButtonProps) => (
  <button
    aria-label={isActive ? labelActive : labelInactive}
    aria-pressed={isActive}
    onClick={onToggle}
    className={cn(
      "inline-flex h-10 w-10 items-center justify-center rounded-md",
      "focus-visible:ring-2 focus-visible:ring-ring",
      isActive && "bg-accent text-accent-foreground"
    )}
  >
    <span aria-hidden="true">
      {isActive && activeIcon ? activeIcon : icon}
    </span>
  </button>
)

// Usage
<ToggleButton
  icon={<VolumeIcon />}
  activeIcon={<VolumeXIcon />}
  isActive={isMuted}
  labelActive="Unmute"
  labelInactive="Mute"
  onToggle={() => setIsMuted(!isMuted)}
/>

<ToggleButton
  icon={<StarIcon />}
  isActive={isFavorite}
  labelActive="Remove from favorites"
  labelInactive="Add to favorites"
  onToggle={() => setIsFavorite(!isFavorite)}
/>
```

## Common Patterns

### Close Button

```typescript
const CloseButton = ({ onClose, label = "Close" }: CloseButtonProps) => (
  <button
    aria-label={label}
    onClick={onClose}
    className="absolute top-4 right-4 p-2 rounded-md hover:bg-accent"
  >
    <XIcon className="h-4 w-4" aria-hidden="true" />
  </button>
)
```

### Menu Button

```typescript
const MenuButton = ({ isOpen, onClick }: MenuButtonProps) => (
  <button
    aria-label={isOpen ? "Close menu" : "Open menu"}
    aria-expanded={isOpen}
    onClick={onClick}
    className="p-2 rounded-md hover:bg-accent"
  >
    {isOpen ? (
      <XIcon className="h-6 w-6" aria-hidden="true" />
    ) : (
      <MenuIcon className="h-6 w-6" aria-hidden="true" />
    )}
  </button>
)
```

### Action Buttons in Lists

```typescript
interface ActionButtonsProps {
  item: { id: string; name: string }
  onEdit: () => void
  onDelete: () => void
}

const ActionButtons = ({ item, onEdit, onDelete }: ActionButtonsProps) => (
  <div className="flex gap-1">
    <IconButton
      icon={<EditIcon className="h-4 w-4" />}
      label={`Edit ${item.name}`}
      onClick={onEdit}
    />
    <IconButton
      icon={<TrashIcon className="h-4 w-4" />}
      label={`Delete ${item.name}`}
      onClick={onDelete}
      variant="destructive"
    />
  </div>
)
```

### Social Share Buttons

```typescript
const ShareButtons = ({ url, title }: ShareButtonsProps) => (
  <div className="flex gap-2" role="group" aria-label="Share options">
    <IconButton
      icon={<TwitterIcon />}
      label="Share on Twitter"
      onClick={() => shareToTwitter(url, title)}
    />
    <IconButton
      icon={<FacebookIcon />}
      label="Share on Facebook"
      onClick={() => shareToFacebook(url)}
    />
    <IconButton
      icon={<LinkedInIcon />}
      label="Share on LinkedIn"
      onClick={() => shareToLinkedIn(url, title)}
    />
    <IconButton
      icon={<LinkIcon />}
      label="Copy link to clipboard"
      onClick={() => copyToClipboard(url)}
    />
  </div>
)
```

### Media Controls

```typescript
const MediaControls = ({ isPlaying, isMuted, onPlayPause, onMute }: MediaControlsProps) => (
  <div className="flex items-center gap-2" role="group" aria-label="Media controls">
    <IconButton
      icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
      label={isPlaying ? "Pause" : "Play"}
      onClick={onPlayPause}
    />
    <IconButton
      icon={isMuted ? <VolumeXIcon /> : <VolumeIcon />}
      label={isMuted ? "Unmute" : "Mute"}
      onClick={onMute}
    />
  </div>
)
```

## Decorative vs Informative Icons

### Decorative Icons (aria-hidden)

Icons that are purely decorative and don't add meaning:

```typescript
// Icon next to text - decorative
<button>
  <DownloadIcon className="mr-2" aria-hidden="true" />
  Download
</button>

// Icon in card - decorative
<Card>
  <CardHeader>
    <FileIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    <CardTitle>Document.pdf</CardTitle>
  </CardHeader>
</Card>
```

### Informative Icons (Need Labels)

Icons that convey meaning on their own:

```typescript
// Status indicator
<span role="img" aria-label="Success">
  <CheckCircleIcon className="h-5 w-5 text-green-500" />
</span>

// Error indicator
<span role="img" aria-label="Error: Invalid email address">
  <AlertCircleIcon className="h-5 w-5 text-destructive" />
</span>
```

## Validation

### Icon Button Accessibility Checker

```typescript
interface IconAccessibilityIssue {
  element: string
  issue: string
  fix: string
}

function validateIconAccessibility(component: string): IconAccessibilityIssue[] {
  const issues: IconAccessibilityIssue[] = []

  // Find icon buttons (button with Icon inside but no text)
  const iconButtonPattern = /<button[^>]*>[\s\n]*<[A-Z]\w*Icon/g
  const matches = component.matchAll(iconButtonPattern)

  for (const match of matches) {
    const elementStart = match.index ?? 0
    const elementEnd = component.indexOf("</button>", elementStart)
    const elementStr = component.slice(elementStart, elementEnd + 9)

    // Check for aria-label
    const hasAriaLabel = /aria-label=/.test(elementStr)

    // Check for sr-only text
    const hasSrOnly = /sr-only|visually-hidden/.test(elementStr)

    // Check for aria-labelledby
    const hasAriaLabelledby = /aria-labelledby=/.test(elementStr)

    // Check for visible text content
    const hasVisibleText = />[^<]*\w+[^<]*</.test(
      elementStr.replace(/<[^>]*Icon[^>]*>/g, "")
    )

    if (!hasAriaLabel && !hasSrOnly && !hasAriaLabelledby && !hasVisibleText) {
      issues.push({
        element: elementStr.slice(0, 80) + "...",
        issue: "Icon button has no accessible name",
        fix: 'Add aria-label="Description" or sr-only text'
      })
    }

    // Check if icon has aria-hidden
    const iconMatch = elementStr.match(/<[A-Z]\w*Icon[^>]*>/)
    if (iconMatch && !iconMatch[0].includes("aria-hidden")) {
      issues.push({
        element: iconMatch[0],
        issue: "Icon in button should have aria-hidden",
        fix: 'Add aria-hidden="true" to the icon'
      })
    }
  }

  // Check for standalone informative icons
  const standaloneIconPattern = /<[A-Z]\w*Icon[^>]*\/>/g
  const standaloneMatches = component.matchAll(standaloneIconPattern)

  for (const match of standaloneMatches) {
    const iconStr = match[0]

    // Check if it's in a button (already handled above)
    const context = component.slice(Math.max(0, (match.index ?? 0) - 50), match.index)
    if (context.includes("<button")) continue

    // Check if parent has role="img" and aria-label
    if (!iconStr.includes("aria-hidden") && !context.includes('role="img"')) {
      issues.push({
        element: iconStr,
        issue: "Standalone icon may need aria-hidden or accessible label",
        fix: 'Add aria-hidden="true" if decorative, or wrap in <span role="img" aria-label="...">'
      })
    }
  }

  return issues
}
```

### Usage in Design Analyzer

```typescript
function analyzeComponent(component: string): AnalysisResult {
  const iconIssues = validateIconAccessibility(component)

  return {
    accessibility: {
      iconLabels: {
        passed: iconIssues.length === 0,
        issues: iconIssues
      }
    }
  }
}
```

## sr-only Utility Class

```css
/* globals.css */
@layer utilities {
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .not-sr-only {
    position: static;
    width: auto;
    height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
}
```

## Best Practices

| Do | Don't |
|----|-------|
| Always add aria-label to icon-only buttons | Leave icon buttons without labels |
| Use aria-hidden="true" on decorative icons | Let screen readers announce icon names |
| Make labels descriptive ("Delete user") | Use vague labels ("Click here") |
| Update labels for toggle states | Use same label for both states |
| Include context in labels ("Edit profile") | Use generic labels ("Edit") |
| Use sr-only for complex labels | Rely solely on title attribute |
| Test with screen readers | Assume sighted testing is sufficient |

## Quick Reference

### Icon Button Template

```typescript
<button aria-label="[Action] [Target]">
  <IconName aria-hidden="true" />
</button>

// Examples
<button aria-label="Delete comment">
  <TrashIcon aria-hidden="true" />
</button>

<button aria-label="Edit profile">
  <EditIcon aria-hidden="true" />
</button>

<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>
```

### With Visible Text (Decorative Icon)

```typescript
<button>
  <IconName aria-hidden="true" />
  Visible Label
</button>
```

### Toggle Button Template

```typescript
<button
  aria-label={isActive ? "[Deactivate action]" : "[Activate action]"}
  aria-pressed={isActive}
>
  <IconName aria-hidden="true" />
</button>
```
