# 8px Spacing Grid System

A consistent spacing system based on multiples of 8px creates visual harmony and simplifies design decisions. Use 4px for fine-tuning when 8px increments are too large.

## The 8px Grid

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `0` | 0 | 0px | Reset |
| `px` | 1px | 1px | Borders, hairlines |
| `0.5` | 0.125rem | 2px | Minimal spacing |
| `1` | 0.25rem | 4px | Tight spacing |
| `1.5` | 0.375rem | 6px | Small adjustment |
| `2` | 0.5rem | **8px** | Base unit |
| `2.5` | 0.625rem | 10px | Small adjustment |
| `3` | 0.75rem | 12px | Compact spacing |
| `4` | 1rem | **16px** | Default spacing |
| `5` | 1.25rem | 20px | Medium spacing |
| `6` | 1.5rem | **24px** | Section padding |
| `8` | 2rem | **32px** | Large spacing |
| `10` | 2.5rem | 40px | XL spacing |
| `12` | 3rem | **48px** | Section gaps |
| `16` | 4rem | **64px** | Page sections |
| `20` | 5rem | 80px | Hero spacing |
| `24` | 6rem | **96px** | Major sections |

**Bold = Primary 8px multiples**

## Visual Reference

```
┌─────────────────────────────────────────────────────────────┐
│  8px Grid Visualization                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████  = 8px (spacing-2)                                    │
│                                                             │
│  ████████  = 16px (spacing-4)                               │
│                                                             │
│  ████████████  = 24px (spacing-6)                           │
│                                                             │
│  ████████████████  = 32px (spacing-8)                       │
│                                                             │
│  ████████████████████████  = 48px (spacing-12)              │
│                                                             │
│  ████████████████████████████████  = 64px (spacing-16)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Spacing Scale Definition

```css
@theme {
  /* Base spacing scale (8px grid) */
  --spacing-0: 0;
  --spacing-px: 1px;
  --spacing-0_5: 0.125rem;  /* 2px - fine adjustment */
  --spacing-1: 0.25rem;     /* 4px - fine adjustment */
  --spacing-1_5: 0.375rem;  /* 6px - fine adjustment */
  --spacing-2: 0.5rem;      /* 8px  ★ BASE */
  --spacing-2_5: 0.625rem;  /* 10px - fine adjustment */
  --spacing-3: 0.75rem;     /* 12px */
  --spacing-3_5: 0.875rem;  /* 14px - fine adjustment */
  --spacing-4: 1rem;        /* 16px ★ */
  --spacing-5: 1.25rem;     /* 20px */
  --spacing-6: 1.5rem;      /* 24px ★ */
  --spacing-7: 1.75rem;     /* 28px */
  --spacing-8: 2rem;        /* 32px ★ */
  --spacing-9: 2.25rem;     /* 36px */
  --spacing-10: 2.5rem;     /* 40px ★ */
  --spacing-11: 2.75rem;    /* 44px */
  --spacing-12: 3rem;       /* 48px ★ */
  --spacing-14: 3.5rem;     /* 56px ★ */
  --spacing-16: 4rem;       /* 64px ★ */
  --spacing-20: 5rem;       /* 80px ★ */
  --spacing-24: 6rem;       /* 96px ★ */
  --spacing-28: 7rem;       /* 112px */
  --spacing-32: 8rem;       /* 128px ★ */
  --spacing-36: 9rem;       /* 144px */
  --spacing-40: 10rem;      /* 160px ★ */
  --spacing-44: 11rem;      /* 176px */
  --spacing-48: 12rem;      /* 192px ★ */
  --spacing-52: 13rem;      /* 208px */
  --spacing-56: 14rem;      /* 224px */
  --spacing-60: 15rem;      /* 240px ★ */
  --spacing-64: 16rem;      /* 256px ★ */
  --spacing-72: 18rem;      /* 288px */
  --spacing-80: 20rem;      /* 320px ★ */
  --spacing-96: 24rem;      /* 384px ★ */
}
```

## Usage Guidelines

### Component Internal Spacing

Use smaller values (4-16px) for internal component spacing:

```typescript
// Icon + Text gap
<Button className="gap-2">        {/* 8px */}
  <Icon />
  <span>Label</span>
</Button>

// Input padding
<Input className="px-3 py-2" />   {/* 12px × 8px */}

// Card internal spacing
<Card className="p-4">            {/* 16px */}
  <CardHeader className="pb-2">   {/* 8px bottom */}
    <CardTitle />
  </CardHeader>
  <CardContent className="space-y-3">  {/* 12px gap */}
    {/* Content */}
  </CardContent>
</Card>
```

### Component Group Spacing

Use medium values (16-32px) between related components:

```typescript
// Form fields
<form className="space-y-4">      {/* 16px between fields */}
  <div className="space-y-2">     {/* 8px label-input gap */}
    <Label>Name</Label>
    <Input />
  </div>
  <div className="space-y-2">
    <Label>Email</Label>
    <Input />
  </div>
</form>

// Button groups
<div className="flex gap-3">      {/* 12px between buttons */}
  <Button>Cancel</Button>
  <Button>Submit</Button>
</div>

// Card grid
<div className="grid grid-cols-3 gap-6">  {/* 24px between cards */}
  <Card />
  <Card />
  <Card />
</div>
```

### Section Spacing

Use larger values (48-96px) between page sections:

```typescript
// Page sections
<main className="space-y-16">     {/* 64px between sections */}
  <section className="py-12">     {/* 48px vertical padding */}
    <Hero />
  </section>

  <section className="py-12">
    <Features />
  </section>

  <section className="py-24">     {/* 96px for major sections */}
    <CTA />
  </section>
</main>

// Container padding
<div className="container px-4 md:px-6 lg:px-8">
  {/* 16px → 24px → 32px responsive padding */}
</div>
```

## Component Patterns

### Button Sizing

```typescript
const buttonSizes = {
  sm: "h-9 px-3 gap-1.5",    // 36px height, 12px padding, 6px gap
  default: "h-10 px-4 gap-2", // 40px height, 16px padding, 8px gap
  lg: "h-11 px-6 gap-2.5",   // 44px height, 24px padding, 10px gap
  icon: "h-10 w-10"          // 40px square
}

// All heights divisible by 4
// 36 = 4 × 9
// 40 = 8 × 5 (primary)
// 44 = 4 × 11
```

### Input Sizing

```typescript
const inputSizes = {
  sm: "h-8 px-2.5 text-sm",   // 32px height
  default: "h-10 px-3",        // 40px height
  lg: "h-12 px-4 text-lg"     // 48px height
}

// Heights: 32, 40, 48 - all 8px multiples
```

### Card Padding

```typescript
// Standard card
<Card className="p-6">           {/* 24px all sides */}
  <CardHeader className="pb-4">  {/* 16px bottom margin */}
    ...
  </CardHeader>
  <CardContent>
    ...
  </CardContent>
</Card>

// Compact card
<Card className="p-4">           {/* 16px all sides */}
  <CardContent className="space-y-2">  {/* 8px gaps */}
    ...
  </CardContent>
</Card>

// Large card
<Card className="p-8">           {/* 32px all sides */}
  <CardHeader className="pb-6">  {/* 24px bottom */}
    ...
  </CardHeader>
</Card>
```

### Modal/Dialog

```typescript
<Dialog>
  <DialogContent className="p-6">      {/* 24px padding */}
    <DialogHeader className="space-y-2"> {/* 8px title-desc gap */}
      <DialogTitle />
      <DialogDescription />
    </DialogHeader>

    <div className="py-4">              {/* 16px vertical spacing */}
      {/* Content */}
    </div>

    <DialogFooter className="gap-3">    {/* 12px button gap */}
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Navigation

```typescript
<nav className="h-16 px-6">           {/* 64px height, 24px padding */}
  <div className="flex items-center gap-8">  {/* 32px nav item gap */}
    <Logo className="h-8" />          {/* 32px logo height */}

    <div className="flex gap-6">      {/* 24px link gap */}
      <NavLink>Home</NavLink>
      <NavLink>Products</NavLink>
    </div>

    <div className="ml-auto flex gap-3">  {/* 12px action gap */}
      <Button variant="ghost" size="sm">Login</Button>
      <Button size="sm">Sign Up</Button>
    </div>
  </div>
</nav>
```

### Table/List

```typescript
<Table>
  <TableHeader>
    <TableRow className="h-12">       {/* 48px header height */}
      <TableHead className="px-4">    {/* 16px horizontal padding */}
        Name
      </TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    <TableRow className="h-14">       {/* 56px row height */}
      <TableCell className="px-4 py-3">  {/* 16px × 12px */}
        Content
      </TableCell>
    </TableRow>
  </TableBody>
</Table>

// List items
<ul className="divide-y">
  <li className="py-4 px-4">          {/* 16px padding */}
    <div className="flex items-center gap-3">  {/* 12px gap */}
      <Avatar className="h-10 w-10" />  {/* 40px */}
      <div className="space-y-1">        {/* 4px internal gap */}
        <p className="font-medium">Name</p>
        <p className="text-sm text-muted-foreground">Email</p>
      </div>
    </div>
  </li>
</ul>
```

## Responsive Spacing

Scale spacing at breakpoints:

```typescript
// Container
<div className="px-4 md:px-6 lg:px-8">
  {/* 16px → 24px → 32px */}
</div>

// Section padding
<section className="py-12 md:py-16 lg:py-24">
  {/* 48px → 64px → 96px */}
</section>

// Grid gaps
<div className="grid gap-4 md:gap-6 lg:gap-8">
  {/* 16px → 24px → 32px */}
</div>

// Stack spacing
<div className="space-y-4 md:space-y-6">
  {/* 16px → 24px */}
</div>
```

## Spacing Tokens Reference

### Commonly Used Tokens

| Use Case | Token | Value |
|----------|-------|-------|
| Icon gap | `gap-2` | 8px |
| Button padding | `px-4 py-2` | 16×8px |
| Input padding | `px-3 py-2` | 12×8px |
| Form field gap | `space-y-4` | 16px |
| Label-input gap | `space-y-2` | 8px |
| Card padding | `p-6` | 24px |
| Card header margin | `mb-4` | 16px |
| Section padding | `py-12` | 48px |
| Page section gap | `space-y-16` | 64px |
| Container padding | `px-4 md:px-6` | 16-24px |

### Component Height Standards

| Component | Token | Pixels |
|-----------|-------|--------|
| Small button | `h-9` | 36px |
| Default button | `h-10` | 40px |
| Large button | `h-11` | 44px |
| Small input | `h-8` | 32px |
| Default input | `h-10` | 40px |
| Large input | `h-12` | 48px |
| Nav height | `h-16` | 64px |
| Table header | `h-12` | 48px |
| Table row | `h-14` | 56px |

## Validation Rules

The design-analyzer validates spacing:

```typescript
interface SpacingAnalysis {
  isValid: boolean
  violations: SpacingViolation[]
}

const VALID_SPACING = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96]

function analyzeSpacing(component: string): SpacingAnalysis {
  const violations: SpacingViolation[] = []

  // Extract arbitrary spacing values
  const arbitraryValues = component.matchAll(/(?:p|m|gap|space)-\[(\d+)px\]/g)

  for (const match of arbitraryValues) {
    const value = parseInt(match[1])

    // Check if divisible by 4
    if (value % 4 !== 0) {
      violations.push({
        value: `${value}px`,
        issue: "Not divisible by 4px",
        suggestion: `Use ${Math.round(value / 4) * 4}px instead`
      })
    }

    // Recommend using tokens
    if (VALID_SPACING.includes(value / 4)) {
      violations.push({
        value: `[${value}px]`,
        issue: "Arbitrary value has token equivalent",
        suggestion: `Use spacing-${value / 4} instead`
      })
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  }
}
```

## Anti-Patterns

### ❌ Arbitrary Values

```typescript
// Wrong: Non-grid values
<div className="p-[13px]">        {/* 13 not divisible by 4 */}
<div className="gap-[7px]">       {/* 7 not divisible by 4 */}
<div className="mt-[15px]">       {/* Use mt-4 (16px) instead */}

// Correct: Grid-aligned
<div className="p-3">             {/* 12px */}
<div className="gap-2">           {/* 8px */}
<div className="mt-4">            {/* 16px */}
```

### ❌ Inconsistent Spacing

```typescript
// Wrong: Mixed spacing patterns
<Card className="p-5">            {/* 20px */}
  <CardHeader className="pb-3">   {/* 12px - inconsistent */}
    ...
  </CardHeader>
</Card>

// Correct: Consistent pattern
<Card className="p-6">            {/* 24px */}
  <CardHeader className="pb-4">   {/* 16px - related to 24 */}
    ...
  </CardHeader>
</Card>
```

### ❌ Too Many Unique Values

```typescript
// Wrong: Every element different
<div className="space-y-2">
  <div className="p-3">
    <span className="mr-5" />
  </div>
  <div className="p-4">
    <span className="mr-6" />
  </div>
</div>

// Correct: Consistent system
<div className="space-y-4">
  <div className="p-4">
    <span className="mr-3" />
  </div>
  <div className="p-4">
    <span className="mr-3" />
  </div>
</div>
```

## Best Practices

| Do | Don't |
|----|-------|
| Use token values (p-4, gap-6) | Use arbitrary pixels [13px] |
| Keep spacing consistent per component | Mix different scales |
| Use 8px for most spacing | Default to non-standard values |
| Use 4px for fine adjustments only | Use 4px as primary unit |
| Scale spacing responsively | Keep same spacing all breakpoints |
| Document spacing decisions | Leave spacing arbitrary |
