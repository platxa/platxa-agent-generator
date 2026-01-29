# Feature Grid Section

Responsive grid of feature cards with icons and descriptions.

## Dependencies

```bash
pnpm add lucide-react
```

## Base Feature Card

```typescript
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const featureCardVariants = cva(
  'relative rounded-xl p-6 transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-card border hover:border-primary/50 hover:shadow-lg',
        filled: 'bg-muted hover:bg-muted/80',
        outlined: 'border-2 hover:border-primary',
        ghost: 'hover:bg-muted/50',
        gradient: [
          'bg-gradient-to-br from-primary/10 via-transparent to-secondary/10',
          'border border-primary/20 hover:border-primary/40',
        ],
      },
      alignment: {
        left: 'text-left',
        center: 'text-center',
      },
    },
    defaultVariants: {
      variant: 'default',
      alignment: 'left',
    },
  }
);

const iconContainerVariants = cva(
  'inline-flex items-center justify-center rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        filled: 'bg-primary text-primary-foreground',
        outlined: 'border-2 border-primary text-primary',
        ghost: 'text-primary',
        gradient: 'bg-gradient-to-br from-primary to-secondary text-white',
      },
      size: {
        sm: 'h-10 w-10',
        default: 'h-12 w-12',
        lg: 'h-14 w-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface FeatureCardProps extends VariantProps<typeof featureCardVariants> {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconVariant?: VariantProps<typeof iconContainerVariants>['variant'];
  iconSize?: VariantProps<typeof iconContainerVariants>['size'];
  className?: string;
}

function FeatureCard({
  icon,
  title,
  description,
  variant,
  alignment,
  iconVariant,
  iconSize,
  className,
}: FeatureCardProps) {
  return (
    <div className={cn(featureCardVariants({ variant, alignment }), className)}>
      <div
        className={cn(
          iconContainerVariants({ variant: iconVariant ?? variant, size: iconSize }),
          alignment === 'center' && 'mx-auto'
        )}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
```

## Feature Grid Component

```typescript
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  link?: string;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'filled' | 'outlined' | 'ghost' | 'gradient';
  alignment?: 'left' | 'center';
  animated?: boolean;
  className?: string;
}

const columnClasses = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
};

function FeatureGrid({
  features,
  columns = 3,
  variant = 'default',
  alignment = 'left',
  animated = true,
  className,
}: FeatureGridProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  const Container = animated ? motion.div : 'div';
  const Item = animated ? motion.div : 'div';

  return (
    <Container
      className={cn('grid gap-6', columnClasses[columns], className)}
      {...(animated && {
        variants: containerVariants,
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, margin: '-100px' },
      })}
    >
      {features.map((feature, index) => {
        const IconComponent = typeof feature.icon === 'function'
          ? feature.icon
          : null;

        return (
          <Item
            key={index}
            {...(animated && { variants: itemVariants })}
          >
            <FeatureCard
              icon={IconComponent ? <IconComponent className="h-6 w-6" /> : feature.icon}
              title={feature.title}
              description={feature.description}
              variant={variant}
              alignment={alignment}
            />
          </Item>
        );
      })}
    </Container>
  );
}
```

## Feature Section with Header

```typescript
interface FeatureSectionProps extends FeatureGridProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  headerAlignment?: 'left' | 'center';
}

function FeatureSection({
  title,
  subtitle,
  badge,
  headerAlignment = 'center',
  features,
  ...gridProps
}: FeatureSectionProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {(title || subtitle || badge) && (
          <div
            className={cn(
              'mb-12',
              headerAlignment === 'center' && 'text-center'
            )}
          >
            {badge && (
              <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
                {badge}
              </span>
            )}
            {title && (
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <FeatureGrid features={features} {...gridProps} />
      </div>
    </section>
  );
}
```

## Bento Grid Variant

```typescript
interface BentoFeature extends Feature {
  size?: 'normal' | 'wide' | 'tall' | 'large';
}

interface BentoGridProps {
  features: BentoFeature[];
  className?: string;
}

function BentoGrid({ features, className }: BentoGridProps) {
  const sizeClasses = {
    normal: '',
    wide: 'md:col-span-2',
    tall: 'md:row-span-2',
    large: 'md:col-span-2 md:row-span-2',
  };

  return (
    <motion.div
      className={cn(
        'grid gap-4 md:grid-cols-3 auto-rows-[200px]',
        className
      )}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {features.map((feature, index) => {
        const IconComponent = typeof feature.icon === 'function'
          ? feature.icon
          : null;

        return (
          <motion.div
            key={index}
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-card p-6',
              'hover:border-primary/50 hover:shadow-lg transition-all duration-300',
              sizeClasses[feature.size || 'normal']
            )}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <div className="flex h-full flex-col">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {IconComponent ? <IconComponent className="h-6 w-6" /> : feature.icon}
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground flex-1">
                {feature.description}
              </p>
            </div>

            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
```

## Icon Feature List

```typescript
interface IconFeatureListProps {
  features: Feature[];
  iconColor?: string;
  className?: string;
}

function IconFeatureList({
  features,
  iconColor = 'text-primary',
  className,
}: IconFeatureListProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {features.map((feature, index) => {
        const IconComponent = typeof feature.icon === 'function'
          ? feature.icon
          : null;

        return (
          <motion.div
            key={index}
            className="flex gap-4"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <div className={cn('flex-shrink-0 mt-1', iconColor)}>
              {IconComponent ? <IconComponent className="h-5 w-5" /> : feature.icon}
            </div>
            <div>
              <h4 className="font-medium">{feature.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
```

## Hover Card Feature Grid

```typescript
function HoverFeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => {
        const IconComponent = typeof feature.icon === 'function'
          ? feature.icon
          : null;

        return (
          <motion.div
            key={index}
            className="group relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <div className="relative z-10 rounded-xl border bg-card p-6 transition-transform duration-300 group-hover:-translate-y-1">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white">
                {IconComponent ? <IconComponent className="h-6 w-6" /> : feature.icon}
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
              {feature.link && (
                <a
                  href={feature.link}
                  className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Learn more →
                </a>
              )}
            </div>

            {/* Shadow element */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
          </motion.div>
        );
      })}
    </div>
  );
}
```

## Numbered Feature Grid

```typescript
function NumberedFeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          {/* Large number background */}
          <span className="absolute -top-4 -left-2 text-8xl font-bold text-muted/20 select-none">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="relative">
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

## Usage Examples

```tsx
import {
  Zap,
  Shield,
  Palette,
  Globe,
  Lock,
  Sparkles,
} from 'lucide-react';

// Basic feature grid
<FeatureGrid
  features={[
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Built for speed with optimized performance.',
    },
    {
      icon: Shield,
      title: 'Secure by Default',
      description: 'Enterprise-grade security out of the box.',
    },
    {
      icon: Palette,
      title: 'Fully Customizable',
      description: 'Adapt to your brand with flexible theming.',
    },
  ]}
  columns={3}
  variant="default"
/>

// Feature section with header
<FeatureSection
  badge="Features"
  title="Everything you need"
  subtitle="Build modern applications with our comprehensive toolkit."
  features={features}
  columns={3}
  variant="gradient"
  alignment="center"
/>

// Bento grid layout
<BentoGrid
  features={[
    { icon: Zap, title: 'Fast', description: '...', size: 'large' },
    { icon: Shield, title: 'Secure', description: '...', size: 'normal' },
    { icon: Palette, title: 'Themed', description: '...', size: 'wide' },
    { icon: Globe, title: 'Global', description: '...', size: 'tall' },
  ]}
/>

// Icon feature list
<IconFeatureList
  features={features}
  iconColor="text-green-500"
/>

// Hover card grid
<HoverFeatureGrid features={features} />

// Numbered features
<NumberedFeatureGrid features={features} />
```

## Key Takeaways

1. **Grid Layouts**: 2, 3, or 4 column responsive grids
2. **Variants**: default, filled, outlined, ghost, gradient styles
3. **Icons**: Support Lucide icons or custom ReactNode
4. **Animation**: Staggered reveal with Framer Motion
5. **Bento**: Mixed-size grid cells for visual interest
6. **Numbered**: Large background numbers for step-based content
7. **Hover Effects**: Shadow, translate, gradient overlays
