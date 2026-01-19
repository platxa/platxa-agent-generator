/**
 * Component Templates
 *
 * Pre-built templates for common UI components following shadcn/ui patterns.
 */

import type {
  ComponentTemplateSpec,
  VariantConfig,
  SizeConfig,
} from "./types"

// ============================================================================
// Common Variants
// ============================================================================

export const buttonVariants: VariantConfig[] = [
  {
    name: "default",
    classes: "bg-primary text-primary-foreground hover:bg-primary/90",
    description: "Primary button style",
  },
  {
    name: "destructive",
    classes: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    description: "Destructive action button",
  },
  {
    name: "outline",
    classes: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    description: "Outlined button style",
  },
  {
    name: "secondary",
    classes: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    description: "Secondary button style",
  },
  {
    name: "ghost",
    classes: "hover:bg-accent hover:text-accent-foreground",
    description: "Ghost/transparent button",
  },
  {
    name: "link",
    classes: "text-primary underline-offset-4 hover:underline",
    description: "Link-styled button",
  },
]

export const buttonSizes: SizeConfig[] = [
  {
    name: "default",
    classes: "h-10 px-4 py-2",
    description: "Default button size",
  },
  {
    name: "sm",
    classes: "h-9 rounded-md px-3",
    description: "Small button",
  },
  {
    name: "lg",
    classes: "h-11 rounded-md px-8",
    description: "Large button",
  },
  {
    name: "icon",
    classes: "h-10 w-10",
    description: "Icon-only button",
  },
]

export const badgeVariants: VariantConfig[] = [
  {
    name: "default",
    classes: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    description: "Default badge style",
  },
  {
    name: "secondary",
    classes: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    description: "Secondary badge style",
  },
  {
    name: "destructive",
    classes: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    description: "Destructive badge style",
  },
  {
    name: "outline",
    classes: "text-foreground",
    description: "Outlined badge style",
  },
]

export const alertVariants: VariantConfig[] = [
  {
    name: "default",
    classes: "bg-background text-foreground",
    description: "Default alert style",
  },
  {
    name: "destructive",
    classes: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    description: "Destructive alert style",
  },
]

export const inputSizes: SizeConfig[] = [
  {
    name: "default",
    classes: "h-10 px-3 py-2",
    description: "Default input size",
  },
  {
    name: "sm",
    classes: "h-9 px-2 py-1 text-sm",
    description: "Small input",
  },
  {
    name: "lg",
    classes: "h-12 px-4 py-3",
    description: "Large input",
  },
]

export const avatarSizes: SizeConfig[] = [
  {
    name: "default",
    classes: "h-10 w-10",
    description: "Default avatar size",
  },
  {
    name: "sm",
    classes: "h-8 w-8",
    description: "Small avatar",
  },
  {
    name: "lg",
    classes: "h-14 w-14",
    description: "Large avatar",
  },
]

// ============================================================================
// Component Templates
// ============================================================================

export const componentTemplates: Record<string, ComponentTemplateSpec> = {
  button: {
    template: "button",
    spec: {
      baseElement: "button",
      description: "A clickable button component with multiple variants and sizes.",
      baseClasses: [
        "inline-flex",
        "items-center",
        "justify-center",
        "whitespace-nowrap",
        "rounded-md",
        "text-sm",
        "font-medium",
        "ring-offset-background",
        "transition-colors",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
      ],
      forwardRef: true,
      hasChildren: true,
      hasDisabledState: true,
      hasLoadingState: true,
    },
    commonVariants: buttonVariants,
    commonSizes: buttonSizes,
    dependencies: ["class-variance-authority", "@/lib/utils"],
  },

  input: {
    template: "input",
    spec: {
      baseElement: "input",
      description: "A text input component with validation states.",
      baseClasses: [
        "flex",
        "w-full",
        "rounded-md",
        "border",
        "border-input",
        "bg-background",
        "text-sm",
        "ring-offset-background",
        "file:border-0",
        "file:bg-transparent",
        "file:text-sm",
        "file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        "disabled:opacity-50",
      ],
      forwardRef: true,
      hasChildren: false,
      hasDisabledState: true,
    },
    commonVariants: [],
    commonSizes: inputSizes,
    dependencies: ["@/lib/utils"],
  },

  card: {
    template: "card",
    spec: {
      baseElement: "div",
      description: "A card container component for grouping related content.",
      baseClasses: [
        "rounded-lg",
        "border",
        "bg-card",
        "text-card-foreground",
        "shadow-sm",
      ],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@/lib/utils"],
  },

  badge: {
    template: "badge",
    spec: {
      baseElement: "div",
      description: "A small badge component for labels and status indicators.",
      baseClasses: [
        "inline-flex",
        "items-center",
        "rounded-full",
        "border",
        "px-2.5",
        "py-0.5",
        "text-xs",
        "font-semibold",
        "transition-colors",
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-ring",
        "focus:ring-offset-2",
      ],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: badgeVariants,
    commonSizes: [],
    dependencies: ["class-variance-authority", "@/lib/utils"],
  },

  avatar: {
    template: "avatar",
    spec: {
      baseElement: "span",
      description: "An avatar component for displaying user images or initials.",
      baseClasses: [
        "relative",
        "flex",
        "shrink-0",
        "overflow-hidden",
        "rounded-full",
      ],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: avatarSizes,
    dependencies: ["@/lib/utils"],
  },

  alert: {
    template: "alert",
    spec: {
      baseElement: "div",
      description: "An alert component for displaying important messages.",
      baseClasses: [
        "relative",
        "w-full",
        "rounded-lg",
        "border",
        "p-4",
        "[&>svg~*]:pl-7",
        "[&>svg+div]:translate-y-[-3px]",
        "[&>svg]:absolute",
        "[&>svg]:left-4",
        "[&>svg]:top-4",
        "[&>svg]:text-foreground",
      ],
      forwardRef: true,
      hasChildren: true,
      ariaRole: "alert",
    },
    commonVariants: alertVariants,
    commonSizes: [],
    dependencies: ["class-variance-authority", "@/lib/utils"],
  },

  dialog: {
    template: "dialog",
    spec: {
      baseElement: "div",
      description: "A modal dialog component with overlay and focus trap.",
      baseClasses: [],
      forwardRef: true,
      hasChildren: true,
      ariaRole: "dialog",
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@radix-ui/react-dialog", "@/lib/utils"],
  },

  dropdown: {
    template: "dropdown",
    spec: {
      baseElement: "div",
      description: "A dropdown menu component with keyboard navigation.",
      baseClasses: [],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@radix-ui/react-dropdown-menu", "@/lib/utils"],
  },

  tabs: {
    template: "tabs",
    spec: {
      baseElement: "div",
      description: "A tabs component for organizing content into panels.",
      baseClasses: [],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@radix-ui/react-tabs", "@/lib/utils"],
  },

  accordion: {
    template: "accordion",
    spec: {
      baseElement: "div",
      description: "An accordion component for collapsible content sections.",
      baseClasses: [],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@radix-ui/react-accordion", "@/lib/utils"],
  },

  tooltip: {
    template: "tooltip",
    spec: {
      baseElement: "div",
      description: "A tooltip component for showing additional information on hover.",
      baseClasses: [
        "z-50",
        "overflow-hidden",
        "rounded-md",
        "border",
        "bg-popover",
        "px-3",
        "py-1.5",
        "text-sm",
        "text-popover-foreground",
        "shadow-md",
        "animate-in",
        "fade-in-0",
        "zoom-in-95",
      ],
      forwardRef: true,
      hasChildren: true,
    },
    commonVariants: [],
    commonSizes: [],
    dependencies: ["@radix-ui/react-tooltip", "@/lib/utils"],
  },

  toast: {
    template: "toast",
    spec: {
      baseElement: "div",
      description: "A toast notification component for feedback messages.",
      baseClasses: [
        "group",
        "pointer-events-auto",
        "relative",
        "flex",
        "w-full",
        "items-center",
        "justify-between",
        "space-x-4",
        "overflow-hidden",
        "rounded-md",
        "border",
        "p-6",
        "pr-8",
        "shadow-lg",
        "transition-all",
      ],
      forwardRef: true,
      hasChildren: true,
      ariaRole: "status",
    },
    commonVariants: [
      {
        name: "default",
        classes: "border bg-background text-foreground",
        description: "Default toast style",
      },
      {
        name: "destructive",
        classes: "destructive group border-destructive bg-destructive text-destructive-foreground",
        description: "Destructive toast style",
      },
    ],
    commonSizes: [],
    dependencies: ["@/lib/utils"],
  },
}

/**
 * Gets a component template by name
 */
export function getTemplate(name: string): ComponentTemplateSpec | undefined {
  return componentTemplates[name.toLowerCase()]
}

/**
 * Gets all available template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(componentTemplates)
}
