# shadcn/ui Component Generation with CVA

Generating production-ready shadcn/ui components using Class Variance Authority (CVA) for variant management.

## Overview

shadcn/ui component generation includes:
1. CVA-based variant system architecture
2. Two-layer component structure (structure + styling)
3. Radix UI primitive integration
4. TypeScript-first component props
5. Tailwind CSS class composition with cn()

## CVA Fundamentals

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// CVA creates a function that returns classes based on variants
const buttonVariants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## Component Architecture

### Two-Layer Pattern

```typescript
// Layer 1: Variants (styling logic)
const componentVariants = cva(baseClasses, {
  variants: { /* variant definitions */ },
  defaultVariants: { /* defaults */ },
});

// Layer 2: Component (structure + behavior)
const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => (
    <element
      className={cn(componentVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
);
```

### Type-Safe Props

```typescript
import { type VariantProps } from 'class-variance-authority';

// Extract variant types from CVA
type ButtonVariants = VariantProps<typeof buttonVariants>;

// Extend HTML element props with variants
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  asChild?: boolean;
}
```

## Complete Button Component

```typescript
// button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

## Component Generator

```typescript
interface ComponentConfig {
  name: string;
  element: string;
  baseClasses: string;
  variants: VariantConfig[];
  defaultVariants: Record<string, string>;
  radixPrimitive?: string;
  asChild?: boolean;
  forwardRef?: boolean;
}

interface VariantConfig {
  name: string;
  options: Record<string, string>;
}

function generateShadcnComponent(config: ComponentConfig): string {
  const {
    name,
    element,
    baseClasses,
    variants,
    defaultVariants,
    radixPrimitive,
    asChild = false,
    forwardRef = true,
  } = config;

  const imports = generateImports(config);
  const variantsCode = generateVariants(name, baseClasses, variants, defaultVariants);
  const propsInterface = generatePropsInterface(name, element, variants, asChild);
  const component = generateComponentCode(config);

  return `${imports}\n\n${variantsCode}\n\n${propsInterface}\n\n${component}`;
}

function generateImports(config: ComponentConfig): string {
  const imports = [
    `import * as React from 'react';`,
    `import { cva, type VariantProps } from 'class-variance-authority';`,
    `import { cn } from '@/lib/utils';`,
  ];

  if (config.asChild) {
    imports.push(`import { Slot } from '@radix-ui/react-slot';`);
  }

  if (config.radixPrimitive) {
    imports.push(`import * as ${config.radixPrimitive}Primitive from '@radix-ui/react-${config.radixPrimitive.toLowerCase()}';`);
  }

  return imports.join('\n');
}

function generateVariants(
  name: string,
  baseClasses: string,
  variants: VariantConfig[],
  defaultVariants: Record<string, string>
): string {
  const variantName = `${name.toLowerCase()}Variants`;

  const variantObjects = variants
    .map((v) => {
      const options = Object.entries(v.options)
        .map(([key, value]) => `        ${key}: '${value}'`)
        .join(',\n');
      return `      ${v.name}: {\n${options}\n      }`;
    })
    .join(',\n');

  const defaults = Object.entries(defaultVariants)
    .map(([key, value]) => `      ${key}: '${value}'`)
    .join(',\n');

  return `const ${variantName} = cva(
  '${baseClasses}',
  {
    variants: {
${variantObjects}
    },
    defaultVariants: {
${defaults}
    },
  }
);`;
}

function generatePropsInterface(
  name: string,
  element: string,
  variants: VariantConfig[],
  asChild: boolean
): string {
  const variantName = `${name.toLowerCase()}Variants`;
  const elementProps = getElementPropsType(element);

  let interface_ = `export interface ${name}Props
  extends ${elementProps},
    VariantProps<typeof ${variantName}>`;

  if (asChild) {
    interface_ += ` {\n  asChild?: boolean;\n}`;
  } else {
    interface_ += ` {}`;
  }

  return interface_;
}

function generateComponentCode(config: ComponentConfig): string {
  const { name, element, asChild, forwardRef } = config;
  const variantName = `${name.toLowerCase()}Variants`;
  const variantParams = config.variants.map((v) => v.name).join(', ');

  if (forwardRef) {
    const refType = getRefType(element);
    const comp = asChild ? `const Comp = asChild ? Slot : '${element}';` : '';
    const compName = asChild ? 'Comp' : element;

    return `const ${name} = React.forwardRef<${refType}, ${name}Props>(
  ({ className, ${variantParams}, ${asChild ? 'asChild = false, ' : ''}...props }, ref) => {
    ${comp}
    return (
      <${compName}
        className={cn(${variantName}({ ${variantParams}, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
${name}.displayName = '${name}';

export { ${name}, ${variantName} };`;
  }

  return `const ${name} = ({ className, ${variantParams}, ...props }: ${name}Props) => (
  <${element}
    className={cn(${variantName}({ ${variantParams}, className }))}
    {...props}
  />
);

export { ${name}, ${variantName} };`;
}

function getElementPropsType(element: string): string {
  const elementMap: Record<string, string> = {
    button: 'React.ButtonHTMLAttributes<HTMLButtonElement>',
    a: 'React.AnchorHTMLAttributes<HTMLAnchorElement>',
    div: 'React.HTMLAttributes<HTMLDivElement>',
    span: 'React.HTMLAttributes<HTMLSpanElement>',
    input: 'React.InputHTMLAttributes<HTMLInputElement>',
    textarea: 'React.TextareaHTMLAttributes<HTMLTextAreaElement>',
    select: 'React.SelectHTMLAttributes<HTMLSelectElement>',
    img: 'React.ImgHTMLAttributes<HTMLImageElement>',
    label: 'React.LabelHTMLAttributes<HTMLLabelElement>',
  };
  return elementMap[element] || 'React.HTMLAttributes<HTMLElement>';
}

function getRefType(element: string): string {
  const refMap: Record<string, string> = {
    button: 'HTMLButtonElement',
    a: 'HTMLAnchorElement',
    div: 'HTMLDivElement',
    span: 'HTMLSpanElement',
    input: 'HTMLInputElement',
    textarea: 'HTMLTextAreaElement',
    select: 'HTMLSelectElement',
    img: 'HTMLImageElement',
    label: 'HTMLLabelElement',
  };
  return refMap[element] || 'HTMLElement';
}
```

## Radix UI Integration

### Dialog Component

```typescript
// dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

## Input Components

### Input with CVA

```typescript
// input.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex w-full rounded-md border bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-green-500 focus-visible:ring-green-500',
      },
      inputSize: {
        default: 'h-10 px-3 py-2',
        sm: 'h-9 px-3 py-1 text-xs',
        lg: 'h-11 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input, inputVariants };
```

### Textarea with CVA

```typescript
// textarea.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      variant: 'default',
      resize: 'vertical',
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, resize, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, resize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
```

## Card Component

```typescript
// card.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-lg border bg-card text-card-foreground', {
  variants: {
    variant: {
      default: 'shadow-sm',
      outline: 'border-2',
      elevated: 'shadow-md',
      ghost: 'border-transparent shadow-none',
    },
    padding: {
      default: '',
      none: '',
      sm: '[&>*]:p-4',
      lg: '[&>*]:p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'default',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
```

## Badge Component

```typescript
// badge.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-transparent bg-green-500 text-white hover:bg-green-500/80',
        warning:
          'border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
```

## Alert Component

```typescript
// alert.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        success:
          'border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-500',
        warning:
          'border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-500',
        info: 'border-blue-500/50 text-blue-700 dark:text-blue-400 [&>svg]:text-blue-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
```

## cn() Utility

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Compound Variants

```typescript
// Advanced CVA with compound variants
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-input bg-background',
        ghost: 'hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        default: 'h-10 px-4',
        lg: 'h-11 px-8 text-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // When outline + sm, use smaller border
      {
        variant: 'outline',
        size: 'sm',
        className: 'border',
      },
      // When outline + lg, use thicker border
      {
        variant: 'outline',
        size: 'lg',
        className: 'border-2',
      },
      // When ghost + fullWidth, add specific styles
      {
        variant: 'ghost',
        fullWidth: true,
        className: 'justify-start',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  }
);
```

## Component Generation Pipeline

```typescript
interface GenerationRequest {
  componentType: 'button' | 'input' | 'card' | 'badge' | 'alert' | 'custom';
  name: string;
  variants: VariantDefinition[];
  radixPrimitive?: string;
  additionalProps?: PropDefinition[];
}

interface VariantDefinition {
  name: string;
  type: 'visual' | 'size' | 'state' | 'behavior';
  options: Record<string, string>;
  default: string;
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: string;
}

async function generateComponent(request: GenerationRequest): Promise<string> {
  // 1. Determine base element and props
  const baseConfig = getBaseConfig(request.componentType);

  // 2. Build CVA variants
  const variants = buildVariants(request.variants);

  // 3. Generate TypeScript interfaces
  const interfaces = generateInterfaces(request);

  // 4. Generate component code
  const component = generateComponentCode({
    ...baseConfig,
    name: request.name,
    variants: request.variants,
    radixPrimitive: request.radixPrimitive,
  });

  // 5. Combine and format
  return formatCode(`
    ${generateImports(request)}

    ${variants}

    ${interfaces}

    ${component}
  `);
}

function getBaseConfig(type: string) {
  const configs: Record<string, Partial<ComponentConfig>> = {
    button: {
      element: 'button',
      asChild: true,
      forwardRef: true,
      baseClasses:
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
    },
    input: {
      element: 'input',
      forwardRef: true,
      baseClasses:
        'flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2',
    },
    card: {
      element: 'div',
      forwardRef: true,
      baseClasses: 'rounded-lg border bg-card text-card-foreground shadow-sm',
    },
    badge: {
      element: 'div',
      forwardRef: false,
      baseClasses:
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
    },
    alert: {
      element: 'div',
      forwardRef: true,
      baseClasses: 'relative w-full rounded-lg border p-4',
    },
  };

  return configs[type] || configs.button;
}
```

## Key Takeaways

1. **CVA Pattern**: Separate variant logic from component structure
2. **Type Safety**: VariantProps extracts types from CVA definitions
3. **cn() Utility**: Merge Tailwind classes with conflict resolution
4. **forwardRef**: Always forward refs for DOM element access
5. **asChild Pattern**: Use Radix Slot for polymorphic components
6. **Compound Variants**: Handle complex variant combinations
7. **Radix Primitives**: Build on accessible, unstyled primitives
8. **Semantic Tokens**: Use CSS variables for theming flexibility
