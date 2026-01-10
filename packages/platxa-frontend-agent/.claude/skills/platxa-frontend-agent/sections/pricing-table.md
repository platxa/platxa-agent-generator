# Pricing Table Section

Pricing cards with tiers, features, CTAs, and popular badge.

## Dependencies

```bash
pnpm add lucide-react
```

## Types

```typescript
interface PricingFeature {
  text: string;
  included: boolean;
  tooltip?: string;
}

interface PricingTier {
  id: string;
  name: string;
  description?: string;
  price: {
    monthly: number;
    yearly: number;
  };
  currency?: string;
  features: PricingFeature[];
  cta: {
    text: string;
    href: string;
  };
  popular?: boolean;
  badge?: string;
}

type BillingPeriod = 'monthly' | 'yearly';
```

## Pricing Card Component

```typescript
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, X, HelpCircle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { SimpleTooltip } from '@/components/ui/tooltip';

const pricingCardVariants = cva(
  'relative rounded-2xl border p-6 md:p-8 transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-card hover:border-primary/50 hover:shadow-lg',
        popular: [
          'bg-card border-primary shadow-xl',
          'ring-2 ring-primary ring-offset-2 ring-offset-background',
        ],
        gradient: [
          'bg-gradient-to-b from-primary/5 to-transparent',
          'border-primary/20 hover:border-primary/40',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface PricingCardProps extends VariantProps<typeof pricingCardVariants> {
  tier: PricingTier;
  billingPeriod: BillingPeriod;
  className?: string;
}

function PricingCard({
  tier,
  billingPeriod,
  variant,
  className,
}: PricingCardProps) {
  const price = tier.price[billingPeriod];
  const yearlyDiscount = tier.price.monthly > 0
    ? Math.round((1 - tier.price.yearly / 12 / tier.price.monthly) * 100)
    : 0;

  const cardVariant = tier.popular ? 'popular' : variant;

  return (
    <motion.div
      className={cn(pricingCardVariants({ variant: cardVariant }), className)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {/* Popular badge */}
      {(tier.popular || tier.badge) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
            {tier.badge || 'Most Popular'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">{tier.name}</h3>
        {tier.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {tier.description}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="mt-6 text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-sm text-muted-foreground">
            {tier.currency || '$'}
          </span>
          <span className="text-4xl font-bold tracking-tight">
            {price === 0 ? 'Free' : price}
          </span>
          {price > 0 && (
            <span className="text-sm text-muted-foreground">
              /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
            </span>
          )}
        </div>
        {billingPeriod === 'yearly' && yearlyDiscount > 0 && (
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            Save {yearlyDiscount}% with yearly billing
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6">
        <a
          href={tier.cta.href}
          className={cn(
            'block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors',
            tier.popular
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          {tier.cta.text}
        </a>
      </div>

      {/* Features */}
      <ul className="mt-8 space-y-3">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            {feature.included ? (
              <Check className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <X className="h-5 w-5 shrink-0 text-muted-foreground/50" />
            )}
            <span
              className={cn(
                'text-sm',
                !feature.included && 'text-muted-foreground/50'
              )}
            >
              {feature.text}
            </span>
            {feature.tooltip && (
              <SimpleTooltip content={feature.tooltip}>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </SimpleTooltip>
            )}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
```

## Billing Toggle

```typescript
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BillingToggleProps {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  discountPercent?: number;
}

function BillingToggle({ value, onChange, discountPercent }: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span
        className={cn(
          'text-sm font-medium transition-colors',
          value === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        Monthly
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={value === 'yearly'}
        onClick={() => onChange(value === 'monthly' ? 'yearly' : 'monthly')}
        className="relative h-7 w-14 rounded-full bg-muted p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <motion.div
          className="h-5 w-5 rounded-full bg-primary"
          animate={{ x: value === 'yearly' ? 26 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>

      <span
        className={cn(
          'text-sm font-medium transition-colors',
          value === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        Yearly
        {discountPercent && discountPercent > 0 && (
          <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            -{discountPercent}%
          </span>
        )}
      </span>
    </div>
  );
}
```

## Pricing Table Component

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface PricingTableProps {
  tiers: PricingTier[];
  defaultBillingPeriod?: BillingPeriod;
  showBillingToggle?: boolean;
  variant?: 'default' | 'gradient';
  className?: string;
}

function PricingTable({
  tiers,
  defaultBillingPeriod = 'monthly',
  showBillingToggle = true,
  variant = 'default',
  className,
}: PricingTableProps) {
  const [billingPeriod, setBillingPeriod] = React.useState<BillingPeriod>(defaultBillingPeriod);

  // Calculate average yearly discount
  const avgDiscount = React.useMemo(() => {
    const discounts = tiers
      .filter((t) => t.price.monthly > 0)
      .map((t) => Math.round((1 - t.price.yearly / 12 / t.price.monthly) * 100));
    return discounts.length > 0
      ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
      : 0;
  }, [tiers]);

  return (
    <div className={cn('space-y-8', className)}>
      {showBillingToggle && (
        <BillingToggle
          value={billingPeriod}
          onChange={setBillingPeriod}
          discountPercent={avgDiscount}
        />
      )}

      <div
        className={cn(
          'grid gap-6',
          tiers.length === 2 && 'md:grid-cols-2 max-w-3xl mx-auto',
          tiers.length === 3 && 'md:grid-cols-3',
          tiers.length === 4 && 'md:grid-cols-2 lg:grid-cols-4',
          tiers.length > 4 && 'md:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            billingPeriod={billingPeriod}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
```

## Pricing Section with Header

```typescript
interface PricingSectionProps extends PricingTableProps {
  title?: string;
  subtitle?: string;
  badge?: string;
}

function PricingSection({
  title = 'Simple, transparent pricing',
  subtitle = 'Choose the plan that works for you',
  badge,
  ...tableProps
}: PricingSectionProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          {badge && (
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
              {badge}
            </span>
          )}
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <PricingTable {...tableProps} />
      </div>
    </section>
  );
}
```

## Comparison Table

```typescript
interface ComparisonTableProps {
  tiers: PricingTier[];
  featureGroups: Array<{
    name: string;
    features: Array<{
      name: string;
      values: Record<string, string | boolean>;
      tooltip?: string;
    }>;
  }>;
  billingPeriod: BillingPeriod;
}

function ComparisonTable({
  tiers,
  featureGroups,
  billingPeriod,
}: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header with tier names and prices */}
        <thead>
          <tr>
            <th className="p-4 text-left border-b" />
            {tiers.map((tier) => (
              <th key={tier.id} className="p-4 text-center border-b min-w-[180px]">
                <div className="font-semibold">{tier.name}</div>
                <div className="mt-1 text-2xl font-bold">
                  {tier.currency || '$'}{tier.price[billingPeriod]}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                <a
                  href={tier.cta.href}
                  className={cn(
                    'mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold',
                    tier.popular
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {tier.cta.text}
                </a>
              </th>
            ))}
          </tr>
        </thead>

        {/* Feature groups */}
        <tbody>
          {featureGroups.map((group) => (
            <React.Fragment key={group.name}>
              <tr>
                <td
                  colSpan={tiers.length + 1}
                  className="bg-muted/50 px-4 py-2 font-semibold"
                >
                  {group.name}
                </td>
              </tr>
              {group.features.map((feature, index) => (
                <tr key={index} className="border-b">
                  <td className="p-4 text-sm">
                    <div className="flex items-center gap-2">
                      {feature.name}
                      {feature.tooltip && (
                        <SimpleTooltip content={feature.tooltip}>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </SimpleTooltip>
                      )}
                    </div>
                  </td>
                  {tiers.map((tier) => {
                    const value = feature.values[tier.id];
                    return (
                      <td key={tier.id} className="p-4 text-center">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Horizontal Pricing Cards

```typescript
function HorizontalPricingCard({ tier, billingPeriod }: PricingCardProps) {
  const price = tier.price[billingPeriod];

  return (
    <motion.div
      className={cn(
        'flex flex-col md:flex-row md:items-center gap-6 rounded-2xl border p-6',
        tier.popular && 'border-primary ring-2 ring-primary ring-offset-2'
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {/* Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{tier.name}</h3>
          {tier.popular && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Popular
            </span>
          )}
        </div>
        {tier.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {tier.description}
          </p>
        )}
      </div>

      {/* Features (condensed) */}
      <div className="flex-1">
        <ul className="grid grid-cols-2 gap-2">
          {tier.features.filter(f => f.included).slice(0, 4).map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              {feature.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Price & CTA */}
      <div className="text-center md:text-right">
        <div className="text-3xl font-bold">
          {tier.currency || '$'}{price}
          <span className="text-sm font-normal text-muted-foreground">
            /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
          </span>
        </div>
        <a
          href={tier.cta.href}
          className={cn(
            'mt-3 inline-block rounded-lg px-6 py-2 text-sm font-semibold',
            tier.popular
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {tier.cta.text}
        </a>
      </div>
    </motion.div>
  );
}
```

## Usage Examples

```tsx
const tiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individuals getting started',
    price: { monthly: 0, yearly: 0 },
    features: [
      { text: '1 project', included: true },
      { text: '100 MB storage', included: true },
      { text: 'Community support', included: true },
      { text: 'API access', included: false },
      { text: 'Custom domain', included: false },
    ],
    cta: { text: 'Get Started', href: '/signup' },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals and small teams',
    price: { monthly: 29, yearly: 290 },
    popular: true,
    features: [
      { text: 'Unlimited projects', included: true },
      { text: '10 GB storage', included: true },
      { text: 'Priority support', included: true },
      { text: 'API access', included: true },
      { text: 'Custom domain', included: true },
    ],
    cta: { text: 'Start Free Trial', href: '/signup?plan=pro' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: { monthly: 99, yearly: 990 },
    features: [
      { text: 'Unlimited everything', included: true },
      { text: 'Unlimited storage', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Advanced API', included: true },
      { text: 'SSO & SAML', included: true },
    ],
    cta: { text: 'Contact Sales', href: '/contact' },
  },
];

// Basic pricing table
<PricingTable tiers={tiers} />

// With section header
<PricingSection
  badge="Pricing"
  title="Plans for every team"
  subtitle="Start free, upgrade when you need"
  tiers={tiers}
/>

// Gradient variant
<PricingTable tiers={tiers} variant="gradient" />

// Without billing toggle
<PricingTable tiers={tiers} showBillingToggle={false} />

// Comparison table
<ComparisonTable
  tiers={tiers}
  billingPeriod="monthly"
  featureGroups={[
    {
      name: 'Core Features',
      features: [
        { name: 'Projects', values: { free: '1', pro: 'Unlimited', enterprise: 'Unlimited' } },
        { name: 'Storage', values: { free: '100 MB', pro: '10 GB', enterprise: 'Unlimited' } },
      ],
    },
  ]}
/>
```

## Key Takeaways

1. **Billing Toggle**: Monthly/yearly with discount badge
2. **Popular Badge**: Highlight recommended tier with ring
3. **Feature List**: Check/X icons with optional tooltips
4. **Variants**: default, popular, gradient card styles
5. **Comparison**: Full feature comparison table
6. **Responsive**: Adapts grid columns based on tier count
7. **Animation**: Staggered reveal with Framer Motion
