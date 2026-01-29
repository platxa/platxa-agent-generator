# :has() Selector Pattern

CSS parent selector enabling styles based on child content.

## Browser Support

```typescript
// Feature detection
const supportsHas = CSS.supports('selector(:has(*))');

// Progressive enhancement wrapper
function HasSupport({ children, fallback }: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(CSS.supports('selector(:has(*))'));
  }, []);

  return supported ? children : (fallback ?? children);
}
```

## Basic Patterns

### Parent Styling Based on Child State

```css
/* Form group with error */
.form-group:has(.input-error) {
  border-color: var(--color-error);
  background-color: var(--color-error-bg);
}

/* Card with image */
.card:has(> img) {
  padding-top: 0;
}

/* Container with empty state */
.container:has(:empty) {
  display: none;
}

/* List with items */
.list:has(> li) {
  padding: 1rem;
}
```

### Form Validation States

```css
/* Input container states */
.input-wrapper:has(input:focus) {
  box-shadow: 0 0 0 2px var(--color-focus);
}

.input-wrapper:has(input:invalid) {
  border-color: var(--color-error);
}

.input-wrapper:has(input:valid) {
  border-color: var(--color-success);
}

.input-wrapper:has(input:disabled) {
  opacity: 0.5;
  pointer-events: none;
}

/* Required indicator */
.label:has(+ input:required)::after {
  content: '*';
  color: var(--color-error);
  margin-left: 0.25rem;
}
```

## Tailwind CSS Integration

### Custom Has Variants

```css
/* tailwind.config.ts */
@theme {
  /* :has() is built into Tailwind v4 */
}

/* Usage in components */
.group {
  /* Parent has focused child */
  @apply has-[:focus]:ring-2 has-[:focus]:ring-primary;

  /* Parent has checked child */
  @apply has-[:checked]:bg-primary/10;

  /* Parent has disabled child */
  @apply has-[:disabled]:opacity-50;

  /* Parent has specific element */
  @apply has-[img]:pt-0;

  /* Parent has error */
  @apply has-[.error]:border-destructive;
}
```

### Component Classes

```typescript
// Form field with :has() styling
const formFieldVariants = cva(
  [
    'relative rounded-lg border p-4 transition-colors',
    // Focus state via :has()
    'has-[:focus]:border-primary has-[:focus]:ring-2 has-[:focus]:ring-primary/20',
    // Error state
    'has-[:invalid]:border-destructive has-[:invalid]:bg-destructive/5',
    // Valid state
    'has-[:valid]:border-success',
    // Disabled state
    'has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed',
  ],
  {
    variants: {
      variant: {
        default: 'border-input bg-background',
        filled: 'border-transparent bg-muted',
        outlined: 'border-2 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface FormFieldProps extends VariantProps<typeof formFieldVariants> {
  label: string;
  children: React.ReactNode;
  error?: string;
}

function FormField({ label, children, error, variant }: FormFieldProps) {
  return (
    <div className={formFieldVariants({ variant })}>
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
```

## Component Patterns

### Dynamic Card Layout

```typescript
const cardVariants = cva(
  [
    'rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden',
    // Adjust padding when has image
    'has-[>img]:p-0 has-[>img]:pb-4',
    // Highlight when has badge
    'has-[.badge]:ring-1 has-[.badge]:ring-primary/20',
  ],
  {
    variants: {
      interactive: {
        true: [
          'cursor-pointer transition-all duration-200',
          'hover:shadow-md hover:border-primary/50',
          // Focus within for keyboard nav
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
        ],
        false: '',
      },
    },
    defaultVariants: {
      interactive: false,
    },
  }
);

interface CardProps extends VariantProps<typeof cardVariants> {
  children: React.ReactNode;
  className?: string;
}

function Card({ children, interactive, className }: CardProps) {
  return (
    <div className={cn(cardVariants({ interactive }), className)}>
      {children}
    </div>
  );
}

// Usage
<Card interactive>
  <img src="/hero.jpg" alt="" className="w-full aspect-video object-cover" />
  <div className="p-4">
    <span className="badge">New</span>
    <h3>Card Title</h3>
  </div>
</Card>
```

### Navigation with Active States

```typescript
function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className={cn(
      'relative px-4 py-2 rounded-lg transition-colors',
      // Style parent when link is active
      'has-[a[data-active=true]]:bg-primary/10',
      'has-[a[data-active=true]]:text-primary',
      // Hover state
      'has-[a:hover]:bg-muted',
    )}>
      <Link href={href} data-active={usePathname() === href}>
        {children}
      </Link>
    </li>
  );
}
```

### Checkbox Group Styling

```typescript
function CheckboxGroup({
  options,
  value,
  onChange
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className={cn(
      'space-y-2 rounded-lg border p-4',
      // Highlight when any checkbox checked
      'has-[:checked]:border-primary has-[:checked]:bg-primary/5',
      // Show count indicator when has selections
      'has-[:checked]:before:content-[attr(data-count)] has-[:checked]:before:absolute',
    )} data-count={value.length}>
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'flex items-center gap-3 p-2 rounded cursor-pointer',
            'has-[:checked]:bg-primary/10 has-[:checked]:font-medium',
            'has-[:focus]:ring-2 has-[:focus]:ring-primary/20',
          )}
        >
          <input
            type="checkbox"
            checked={value.includes(option.id)}
            onChange={(e) => {
              onChange(
                e.target.checked
                  ? [...value, option.id]
                  : value.filter(v => v !== option.id)
              );
            }}
            className="accent-primary"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
```

### Table Row States

```typescript
function DataTable<T>({ data, columns }: DataTableProps<T>) {
  return (
    <table className="w-full">
      <tbody>
        {data.map((row, i) => (
          <tr
            key={i}
            className={cn(
              'border-b transition-colors',
              // Row with selected checkbox
              'has-[input:checked]:bg-primary/5',
              // Row with focused input
              'has-[:focus]:bg-muted',
              // Row with error
              'has-[.error]:bg-destructive/5 has-[.error]:border-destructive',
            )}
          >
            {columns.map((col) => (
              <td key={col.id}>{col.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Advanced Patterns

### Conditional Grid Layouts

```css
/* Grid adjusts based on content */
.auto-grid {
  display: grid;
  gap: 1rem;

  /* Single item - full width */
  &:has(> :only-child) {
    grid-template-columns: 1fr;
  }

  /* Two items - two columns */
  &:has(> :nth-child(2)):not(:has(> :nth-child(3))) {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Three+ items - three columns */
  &:has(> :nth-child(3)) {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Featured item layout */
.featured-grid:has(.featured) {
  grid-template-columns: 2fr 1fr 1fr;

  & .featured {
    grid-row: span 2;
  }
}
```

### Sibling Aware Styling

```css
/* Style based on adjacent content */
.content-block {
  /* Following a heading */
  h2:has(+ &) {
    margin-bottom: 0.5rem;
  }

  /* Before a call-to-action */
  &:has(+ .cta) {
    margin-bottom: 2rem;
  }

  /* Between two images */
  img:has(+ &) + & + img {
    margin-top: 1rem;
  }
}
```

### Container Queries Combined

```css
/* :has() with container queries */
.card-container {
  container-type: inline-size;

  /* Horizontal layout when has image and wide enough */
  @container (min-width: 400px) {
    &:has(> img) {
      display: flex;
      flex-direction: row;

      > img {
        width: 40%;
        height: auto;
      }
    }
  }
}
```

## Fallback Strategies

### JavaScript Enhancement

```typescript
// Polyfill-like behavior for :has()
function useHasPolyfill(
  containerRef: RefObject<HTMLElement>,
  selector: string
) {
  const [hasMatch, setHasMatch] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if :has() is supported
    if (CSS.supports('selector(:has(*))')) {
      return; // Let CSS handle it
    }

    // Manual check
    const check = () => {
      setHasMatch(container.querySelector(selector) !== null);
    };

    check();

    // Observe for changes
    const observer = new MutationObserver(check);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [selector]);

  return hasMatch;
}

// Usage
function FormGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasError = useHasPolyfill(ref, '.input-error');

  return (
    <div
      ref={ref}
      className={cn(
        'form-group',
        // CSS :has() will work if supported
        // This class is fallback
        hasError && 'form-group--has-error',
      )}
    >
      {children}
    </div>
  );
}
```

### Progressive CSS

```css
/* Base styles (no :has()) */
.form-group {
  border: 1px solid var(--color-border);
}

.form-group.has-error {
  border-color: var(--color-error);
}

/* Enhanced with :has() when supported */
@supports selector(:has(*)) {
  .form-group:has(.input-error) {
    border-color: var(--color-error);
  }

  /* Remove JS-added class styles to avoid conflicts */
  .form-group.has-error:not(:has(.input-error)) {
    border-color: var(--color-border);
  }
}
```

## Performance Considerations

```typescript
// Limit :has() selector complexity
const performantSelectors = {
  // Good - direct child
  good: ':has(> .error)',

  // Acceptable - shallow descendant
  ok: ':has(.error)',

  // Avoid - deep complex selectors
  avoid: ':has(div > ul > li > .error)',

  // Avoid - multiple :has()
  avoid2: ':has(.a):has(.b):has(.c)',
};

// Use data attributes for complex states
function OptimizedComponent({ hasError, isActive }: Props) {
  return (
    <div
      data-has-error={hasError || undefined}
      data-active={isActive || undefined}
      className={cn(
        'component',
        // CSS can use attribute selectors (faster)
        '[data-has-error]:border-destructive',
        '[data-active]:bg-primary/10',
      )}
    />
  );
}
```

## Integration Example

```typescript
// Complete form with :has() styling
function ContactForm() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={cn(
        'space-y-6 rounded-xl border p-6',
        // Form-level states via :has()
        'has-[:focus]:shadow-lg has-[:focus]:border-primary/50',
        'has-[.error]:border-destructive/50',
      )}
    >
      <div className={cn(
        'space-y-2',
        'has-[:invalid]:text-destructive',
      )}>
        <label className="has-[+input:required]:after:content-['*'] has-[+input:required]:after:text-destructive">
          Email
        </label>
        <input
          {...form.register('email')}
          type="email"
          required
          className={cn(
            'w-full rounded-lg border px-4 py-2',
            'focus:outline-none focus:ring-2 focus:ring-primary',
          )}
        />
      </div>

      <button
        type="submit"
        className={cn(
          'w-full py-3 rounded-lg bg-primary text-primary-foreground',
          // Disable when form has invalid inputs
          'group-has-[:invalid]:opacity-50 group-has-[:invalid]:pointer-events-none',
        )}
      >
        Submit
      </button>
    </form>
  );
}
```

## Key Takeaways

1. **Browser Support**: Check with `CSS.supports('selector(:has(*))')`
2. **Tailwind v4**: Use `has-[selector]:` variants
3. **Performance**: Prefer direct child selectors `:has(> .child)`
4. **Fallbacks**: Combine with JS for older browsers
5. **Use Cases**: Form states, dynamic layouts, parent-based theming
