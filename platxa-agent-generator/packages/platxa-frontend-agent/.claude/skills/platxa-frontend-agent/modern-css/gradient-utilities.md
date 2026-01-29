# Gradient Utilities

Modern CSS gradient utilities with Tailwind CSS integration.

## Tailwind CSS v4 Gradient System

### Linear Gradients

```css
/* @theme configuration */
@theme {
  /* Gradient angles */
  --gradient-angle-0: 0deg;
  --gradient-angle-45: 45deg;
  --gradient-angle-90: 90deg;
  --gradient-angle-135: 135deg;
  --gradient-angle-180: 180deg;
  --gradient-angle-225: 225deg;
  --gradient-angle-270: 270deg;
  --gradient-angle-315: 315deg;

  /* Gradient color stops */
  --gradient-from: transparent;
  --gradient-via: transparent;
  --gradient-to: transparent;
}

/* Linear gradient utilities */
.bg-linear-0 {
  background-image: linear-gradient(
    var(--gradient-angle-0),
    var(--gradient-from) 0%,
    var(--gradient-via) 50%,
    var(--gradient-to) 100%
  );
}

.bg-linear-45 {
  background-image: linear-gradient(
    var(--gradient-angle-45),
    var(--gradient-from) 0%,
    var(--gradient-via) 50%,
    var(--gradient-to) 100%
  );
}

.bg-linear-90 {
  background-image: linear-gradient(
    var(--gradient-angle-90),
    var(--gradient-from) 0%,
    var(--gradient-via) 50%,
    var(--gradient-to) 100%
  );
}

/* Usage */
.hero-gradient {
  @apply bg-linear-45 from-primary via-primary/50 to-secondary;
}
```

### Radial Gradients

```css
/* Radial gradient shapes */
@theme {
  --radial-shape-circle: circle;
  --radial-shape-ellipse: ellipse;

  /* Radial positions */
  --radial-pos-center: at center;
  --radial-pos-top: at top;
  --radial-pos-bottom: at bottom;
  --radial-pos-left: at left;
  --radial-pos-right: at right;
  --radial-pos-top-left: at top left;
  --radial-pos-top-right: at top right;
  --radial-pos-bottom-left: at bottom left;
  --radial-pos-bottom-right: at bottom right;
}

/* Radial gradient utilities */
.bg-radial {
  background-image: radial-gradient(
    circle at center,
    var(--gradient-from) 0%,
    var(--gradient-via) 50%,
    var(--gradient-to) 100%
  );
}

.bg-radial-top {
  background-image: radial-gradient(
    ellipse at top,
    var(--gradient-from) 0%,
    var(--gradient-to) 100%
  );
}

.bg-radial-bottom {
  background-image: radial-gradient(
    ellipse at bottom,
    var(--gradient-from) 0%,
    var(--gradient-to) 100%
  );
}

/* Spotlight effect */
.bg-radial-spotlight {
  background-image: radial-gradient(
    ellipse 80% 50% at 50% -20%,
    var(--gradient-from) 0%,
    transparent 100%
  );
}
```

### Conic Gradients

```css
/* Conic gradient utilities */
.bg-conic {
  background-image: conic-gradient(
    from 0deg at center,
    var(--gradient-from) 0deg,
    var(--gradient-via) 180deg,
    var(--gradient-to) 360deg
  );
}

.bg-conic-90 {
  background-image: conic-gradient(
    from 90deg at center,
    var(--gradient-from) 0deg,
    var(--gradient-to) 360deg
  );
}

.bg-conic-180 {
  background-image: conic-gradient(
    from 180deg at center,
    var(--gradient-from) 0deg,
    var(--gradient-to) 360deg
  );
}

/* Color wheel */
.bg-conic-wheel {
  background-image: conic-gradient(
    from 0deg,
    oklch(0.7 0.15 0),
    oklch(0.7 0.15 60),
    oklch(0.7 0.15 120),
    oklch(0.7 0.15 180),
    oklch(0.7 0.15 240),
    oklch(0.7 0.15 300),
    oklch(0.7 0.15 360)
  );
}
```

## TypeScript Gradient Utilities

### Gradient Builder

```typescript
type GradientType = 'linear' | 'radial' | 'conic';

interface GradientStop {
  color: string;
  position?: number | string;
}

interface LinearGradientConfig {
  type: 'linear';
  angle: number;
  stops: GradientStop[];
}

interface RadialGradientConfig {
  type: 'radial';
  shape: 'circle' | 'ellipse';
  position: string;
  size?: string;
  stops: GradientStop[];
}

interface ConicGradientConfig {
  type: 'conic';
  from: number;
  position: string;
  stops: GradientStop[];
}

type GradientConfig = LinearGradientConfig | RadialGradientConfig | ConicGradientConfig;

function buildGradient(config: GradientConfig): string {
  const formatStop = (stop: GradientStop) =>
    stop.position !== undefined
      ? `${stop.color} ${typeof stop.position === 'number' ? `${stop.position}%` : stop.position}`
      : stop.color;

  switch (config.type) {
    case 'linear':
      return `linear-gradient(${config.angle}deg, ${config.stops.map(formatStop).join(', ')})`;

    case 'radial':
      const size = config.size ? ` ${config.size}` : '';
      return `radial-gradient(${config.shape}${size} at ${config.position}, ${config.stops.map(formatStop).join(', ')})`;

    case 'conic':
      return `conic-gradient(from ${config.from}deg at ${config.position}, ${config.stops.map(formatStop).join(', ')})`;
  }
}

// Usage
const heroGradient = buildGradient({
  type: 'linear',
  angle: 45,
  stops: [
    { color: 'oklch(0.6 0.2 250)', position: 0 },
    { color: 'oklch(0.7 0.15 280)', position: 50 },
    { color: 'oklch(0.5 0.25 310)', position: 100 },
  ],
});
```

### Gradient Presets

```typescript
const gradientPresets = {
  // Brand gradients
  primary: {
    type: 'linear' as const,
    angle: 135,
    stops: [
      { color: 'oklch(0.55 0.2 250)', position: 0 },
      { color: 'oklch(0.65 0.18 280)', position: 100 },
    ],
  },

  secondary: {
    type: 'linear' as const,
    angle: 45,
    stops: [
      { color: 'oklch(0.7 0.12 30)', position: 0 },
      { color: 'oklch(0.8 0.1 50)', position: 100 },
    ],
  },

  // Effect gradients
  spotlight: {
    type: 'radial' as const,
    shape: 'ellipse' as const,
    position: 'center top',
    size: '100% 50%',
    stops: [
      { color: 'oklch(0.95 0.02 250 / 0.3)', position: 0 },
      { color: 'transparent', position: 100 },
    ],
  },

  glow: {
    type: 'radial' as const,
    shape: 'circle' as const,
    position: 'center',
    stops: [
      { color: 'oklch(0.7 0.2 250 / 0.4)', position: 0 },
      { color: 'transparent', position: 70 },
    ],
  },

  // Decorative
  rainbow: {
    type: 'conic' as const,
    from: 0,
    position: 'center',
    stops: [
      { color: 'oklch(0.7 0.2 0)', position: '0deg' },
      { color: 'oklch(0.7 0.2 60)', position: '60deg' },
      { color: 'oklch(0.7 0.2 120)', position: '120deg' },
      { color: 'oklch(0.7 0.2 180)', position: '180deg' },
      { color: 'oklch(0.7 0.2 240)', position: '240deg' },
      { color: 'oklch(0.7 0.2 300)', position: '300deg' },
      { color: 'oklch(0.7 0.2 360)', position: '360deg' },
    ],
  },

  // Mesh-like
  mesh: {
    type: 'radial' as const,
    shape: 'ellipse' as const,
    position: '0% 0%',
    stops: [
      { color: 'oklch(0.6 0.2 250 / 0.5)', position: 0 },
      { color: 'transparent', position: 50 },
    ],
  },
} as const;

function getGradientPreset(name: keyof typeof gradientPresets): string {
  return buildGradient(gradientPresets[name]);
}
```

## Component Patterns

### Gradient Background

```typescript
interface GradientBackgroundProps {
  gradient: GradientConfig | keyof typeof gradientPresets;
  className?: string;
  children?: React.ReactNode;
}

function GradientBackground({
  gradient,
  className,
  children,
}: GradientBackgroundProps) {
  const gradientValue = typeof gradient === 'string'
    ? getGradientPreset(gradient)
    : buildGradient(gradient);

  return (
    <div
      className={cn('relative', className)}
      style={{ backgroundImage: gradientValue }}
    >
      {children}
    </div>
  );
}

// Usage
<GradientBackground gradient="primary" className="min-h-screen">
  <h1>Hero Section</h1>
</GradientBackground>
```

### Gradient Text

```typescript
function GradientText({
  gradient,
  children,
  className,
  as: Component = 'span',
}: {
  gradient: GradientConfig | keyof typeof gradientPresets;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  const gradientValue = typeof gradient === 'string'
    ? getGradientPreset(gradient)
    : buildGradient(gradient);

  return (
    <Component
      className={cn(
        'bg-clip-text text-transparent',
        className
      )}
      style={{ backgroundImage: gradientValue }}
    >
      {children}
    </Component>
  );
}

// Usage
<GradientText gradient="primary" as="h1" className="text-5xl font-bold">
  Welcome
</GradientText>
```

### Gradient Border

```typescript
function GradientBorder({
  gradient,
  borderWidth = 2,
  borderRadius = '0.5rem',
  children,
  className,
}: {
  gradient: GradientConfig | keyof typeof gradientPresets;
  borderWidth?: number;
  borderRadius?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const gradientValue = typeof gradient === 'string'
    ? getGradientPreset(gradient)
    : buildGradient(gradient);

  return (
    <div
      className={cn('relative p-[var(--border-width)]', className)}
      style={{
        '--border-width': `${borderWidth}px`,
        backgroundImage: gradientValue,
        borderRadius,
      } as React.CSSProperties}
    >
      <div
        className="bg-background h-full w-full"
        style={{ borderRadius: `calc(${borderRadius} - ${borderWidth}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

// Usage
<GradientBorder gradient="primary" borderWidth={2} borderRadius="1rem">
  <div className="p-6">
    <h3>Premium Card</h3>
  </div>
</GradientBorder>
```

### Animated Gradient

```typescript
function AnimatedGradient({
  colors,
  duration = 10,
  className,
  children,
}: {
  colors: string[];
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const keyframes = colors.map((_, i) => {
    const position = (i / colors.length) * 100;
    return `${position}% { background-position: ${i * 50}% 50%; }`;
  }).join('\n');

  const gradientStops = [...colors, colors[0]].join(', ');

  return (
    <>
      <style>{`
        @keyframes gradient-shift {
          ${keyframes}
          100% { background-position: ${colors.length * 50}% 50%; }
        }
      `}</style>
      <div
        className={cn('bg-[length:400%_400%]', className)}
        style={{
          backgroundImage: `linear-gradient(90deg, ${gradientStops})`,
          animation: `gradient-shift ${duration}s ease infinite`,
        }}
      >
        {children}
      </div>
    </>
  );
}

// Usage
<AnimatedGradient
  colors={['oklch(0.6 0.2 250)', 'oklch(0.7 0.18 280)', 'oklch(0.65 0.22 310)']}
  duration={8}
  className="min-h-screen"
>
  <h1>Animated Hero</h1>
</AnimatedGradient>
```

### Mesh Gradient

```typescript
interface MeshGradientProps {
  colors: Array<{
    color: string;
    x: number;
    y: number;
    size?: number;
  }>;
  className?: string;
  children?: React.ReactNode;
}

function MeshGradient({ colors, className, children }: MeshGradientProps) {
  const layers = colors.map(({ color, x, y, size = 50 }) =>
    `radial-gradient(ellipse ${size}% ${size}% at ${x}% ${y}%, ${color} 0%, transparent 100%)`
  );

  return (
    <div
      className={cn('relative', className)}
      style={{
        backgroundColor: colors[0]?.color.replace(/\/[\d.]+\)/, ')'),
        backgroundImage: layers.join(', '),
      }}
    >
      {children}
    </div>
  );
}

// Usage
<MeshGradient
  colors={[
    { color: 'oklch(0.7 0.2 250 / 0.8)', x: 20, y: 30, size: 60 },
    { color: 'oklch(0.6 0.25 310 / 0.6)', x: 80, y: 20, size: 50 },
    { color: 'oklch(0.75 0.15 180 / 0.7)', x: 50, y: 80, size: 70 },
  ]}
  className="min-h-screen"
/>
```

## Tailwind Plugin

```typescript
// tailwind.config.ts
import plugin from 'tailwindcss/plugin';

export default {
  plugins: [
    plugin(({ addUtilities, matchUtilities, theme }) => {
      // Linear gradient angles
      matchUtilities(
        {
          'bg-linear': (angle) => ({
            backgroundImage: `linear-gradient(${angle}, var(--tw-gradient-stops))`,
          }),
        },
        {
          values: {
            '0': '0deg',
            '45': '45deg',
            '90': '90deg',
            '135': '135deg',
            '180': '180deg',
            '225': '225deg',
            '270': '270deg',
            '315': '315deg',
          },
        }
      );

      // Radial gradient positions
      addUtilities({
        '.bg-radial': {
          backgroundImage: 'radial-gradient(circle at center, var(--tw-gradient-stops))',
        },
        '.bg-radial-top': {
          backgroundImage: 'radial-gradient(ellipse at top, var(--tw-gradient-stops))',
        },
        '.bg-radial-bottom': {
          backgroundImage: 'radial-gradient(ellipse at bottom, var(--tw-gradient-stops))',
        },
        '.bg-radial-left': {
          backgroundImage: 'radial-gradient(ellipse at left, var(--tw-gradient-stops))',
        },
        '.bg-radial-right': {
          backgroundImage: 'radial-gradient(ellipse at right, var(--tw-gradient-stops))',
        },
        '.bg-radial-tl': {
          backgroundImage: 'radial-gradient(ellipse at top left, var(--tw-gradient-stops))',
        },
        '.bg-radial-tr': {
          backgroundImage: 'radial-gradient(ellipse at top right, var(--tw-gradient-stops))',
        },
        '.bg-radial-bl': {
          backgroundImage: 'radial-gradient(ellipse at bottom left, var(--tw-gradient-stops))',
        },
        '.bg-radial-br': {
          backgroundImage: 'radial-gradient(ellipse at bottom right, var(--tw-gradient-stops))',
        },
      });

      // Conic gradient
      matchUtilities(
        {
          'bg-conic': (angle) => ({
            backgroundImage: `conic-gradient(from ${angle} at center, var(--tw-gradient-stops))`,
          }),
        },
        {
          values: {
            DEFAULT: '0deg',
            '90': '90deg',
            '180': '180deg',
            '270': '270deg',
          },
        }
      );
    }),
  ],
};
```

## Usage Examples

```tsx
// Hero section with linear gradient
<section className="bg-linear-135 from-primary via-primary/50 to-secondary min-h-screen">
  <h1 className="text-6xl font-bold">
    <GradientText gradient="rainbow">Welcome</GradientText>
  </h1>
</section>

// Card with radial spotlight
<div className="relative bg-card">
  <div className="absolute inset-0 bg-radial-top from-primary/20 to-transparent" />
  <div className="relative z-10 p-6">Card content</div>
</div>

// Progress indicator with conic gradient
<div className="relative h-32 w-32">
  <div
    className="absolute inset-0 rounded-full"
    style={{
      backgroundImage: `conic-gradient(
        from 0deg,
        oklch(0.6 0.2 250) 0deg,
        oklch(0.6 0.2 250) ${progress * 3.6}deg,
        oklch(0.9 0.02 250) ${progress * 3.6}deg
      )`,
    }}
  />
  <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
    {progress}%
  </div>
</div>

// Animated mesh background
<MeshGradient
  colors={[
    { color: 'oklch(0.6 0.2 250 / 0.6)', x: 10, y: 20 },
    { color: 'oklch(0.7 0.18 310 / 0.5)', x: 90, y: 30 },
    { color: 'oklch(0.65 0.15 180 / 0.7)', x: 40, y: 80 },
  ]}
  className="fixed inset-0 -z-10"
/>
```

## Key Takeaways

1. **Linear**: `bg-linear-{angle}` for directional gradients
2. **Radial**: `bg-radial-{position}` for circular/elliptical gradients
3. **Conic**: `bg-conic-{angle}` for pie-chart style gradients
4. **OKLCH**: Use for perceptually uniform color transitions
5. **Animation**: Shift background-position for smooth animated gradients
6. **Mesh**: Layer multiple radial gradients for organic effects
