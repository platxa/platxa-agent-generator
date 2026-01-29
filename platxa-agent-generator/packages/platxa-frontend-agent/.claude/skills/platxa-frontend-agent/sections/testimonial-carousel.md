# Testimonial Carousel Section

Carousel with quotes, avatars, names, and company info.

## Dependencies

```bash
pnpm add embla-carousel-react embla-carousel-autoplay
```

## Types

```typescript
interface Testimonial {
  id: string;
  quote: string;
  author: {
    name: string;
    title?: string;
    company?: string;
    avatar?: string;
  };
  rating?: number;
  logo?: string;
}
```

## Base Testimonial Card

```typescript
'use client';

import * as React from 'react';
import { Star, Quote } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const testimonialCardVariants = cva(
  'relative rounded-2xl p-6 md:p-8',
  {
    variants: {
      variant: {
        default: 'bg-card border',
        filled: 'bg-muted',
        gradient: 'bg-gradient-to-br from-primary/5 to-secondary/5 border',
        quote: 'bg-card border pl-12',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface TestimonialCardProps extends VariantProps<typeof testimonialCardVariants> {
  testimonial: Testimonial;
  className?: string;
}

function TestimonialCard({
  testimonial,
  variant,
  className,
}: TestimonialCardProps) {
  return (
    <div className={cn(testimonialCardVariants({ variant }), className)}>
      {/* Quote icon for quote variant */}
      {variant === 'quote' && (
        <Quote className="absolute left-4 top-6 h-6 w-6 text-primary/20" />
      )}

      {/* Rating */}
      {testimonial.rating && (
        <div className="flex gap-0.5 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-4 w-4',
                i < testimonial.rating!
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}

      {/* Quote */}
      <blockquote className="text-lg leading-relaxed">
        "{testimonial.quote}"
      </blockquote>

      {/* Author */}
      <div className="mt-6 flex items-center gap-4">
        {testimonial.author.avatar ? (
          <img
            src={testimonial.author.avatar}
            alt={testimonial.author.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
            {testimonial.author.name.charAt(0)}
          </div>
        )}
        <div>
          <div className="font-semibold">{testimonial.author.name}</div>
          {(testimonial.author.title || testimonial.author.company) && (
            <div className="text-sm text-muted-foreground">
              {testimonial.author.title}
              {testimonial.author.title && testimonial.author.company && ' at '}
              {testimonial.author.company}
            </div>
          )}
        </div>
        {testimonial.logo && (
          <img
            src={testimonial.logo}
            alt={testimonial.author.company}
            className="ml-auto h-8 opacity-50"
          />
        )}
      </div>
    </div>
  );
}
```

## Embla Carousel Implementation

```typescript
'use client';

import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
  variant?: 'default' | 'filled' | 'gradient' | 'quote';
  autoplay?: boolean;
  autoplayDelay?: number;
  showArrows?: boolean;
  showDots?: boolean;
  className?: string;
}

function TestimonialCarousel({
  testimonials,
  variant = 'default',
  autoplay = true,
  autoplayDelay = 5000,
  showArrows = true,
  showDots = true,
  className,
}: TestimonialCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'center' },
    autoplay ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })] : []
  );

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = React.useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className={cn('relative', className)}>
      {/* Carousel viewport */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="min-w-0 flex-[0_0_100%] px-4 md:flex-[0_0_80%] lg:flex-[0_0_60%]"
            >
              <TestimonialCard testimonial={testimonial} variant={variant} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {showArrows && (
        <>
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 z-10',
              'flex h-10 w-10 items-center justify-center rounded-full',
              'bg-background/80 backdrop-blur border shadow-sm',
              'hover:bg-background transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 z-10',
              'flex h-10 w-10 items-center justify-center rounded-full',
              'bg-background/80 backdrop-blur border shadow-sm',
              'hover:bg-background transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showDots && (
        <div className="mt-6 flex justify-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                'h-2 rounded-full transition-all',
                selectedIndex === index
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Testimonial Grid (No Carousel)

```typescript
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TestimonialGridProps {
  testimonials: Testimonial[];
  columns?: 2 | 3;
  variant?: 'default' | 'filled' | 'gradient' | 'quote';
  className?: string;
}

function TestimonialGrid({
  testimonials,
  columns = 3,
  variant = 'default',
  className,
}: TestimonialGridProps) {
  return (
    <div
      className={cn(
        'grid gap-6',
        columns === 2 && 'md:grid-cols-2',
        columns === 3 && 'md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {testimonials.map((testimonial, index) => (
        <motion.div
          key={testimonial.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          <TestimonialCard testimonial={testimonial} variant={variant} />
        </motion.div>
      ))}
    </div>
  );
}
```

## Masonry Testimonials

```typescript
function MasonryTestimonials({
  testimonials,
  variant = 'default',
}: {
  testimonials: Testimonial[];
  variant?: 'default' | 'filled' | 'gradient' | 'quote';
}) {
  // Split into columns
  const columns = React.useMemo(() => {
    const cols: Testimonial[][] = [[], [], []];
    testimonials.forEach((t, i) => cols[i % 3].push(t));
    return cols;
  }, [testimonials]);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {columns.map((col, colIndex) => (
        <div key={colIndex} className="space-y-6">
          {col.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: (colIndex * 0.1) + (index * 0.05) }}
              viewport={{ once: true }}
            >
              <TestimonialCard testimonial={testimonial} variant={variant} />
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Featured Testimonial

```typescript
function FeaturedTestimonial({
  testimonial,
  className,
}: {
  testimonial: Testimonial;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary p-8 md:p-12 text-white',
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative">
        {/* Large quote */}
        <Quote className="h-12 w-12 opacity-30 mb-6" />

        <blockquote className="text-2xl md:text-3xl font-medium leading-relaxed">
          "{testimonial.quote}"
        </blockquote>

        <div className="mt-8 flex items-center gap-4">
          {testimonial.author.avatar ? (
            <img
              src={testimonial.author.avatar}
              alt={testimonial.author.name}
              className="h-16 w-16 rounded-full border-2 border-white/30 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
              {testimonial.author.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-lg font-semibold">{testimonial.author.name}</div>
            <div className="text-white/70">
              {testimonial.author.title}
              {testimonial.author.company && ` at ${testimonial.author.company}`}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

## Testimonial Section with Header

```typescript
interface TestimonialSectionProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  testimonials: Testimonial[];
  layout?: 'carousel' | 'grid' | 'masonry' | 'featured';
  variant?: 'default' | 'filled' | 'gradient' | 'quote';
  columns?: 2 | 3;
}

function TestimonialSection({
  title = 'What our customers say',
  subtitle,
  badge,
  testimonials,
  layout = 'carousel',
  variant = 'default',
  columns = 3,
}: TestimonialSectionProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          {badge && (
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
              {badge}
            </span>
          )}
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content based on layout */}
        {layout === 'carousel' && (
          <TestimonialCarousel testimonials={testimonials} variant={variant} />
        )}
        {layout === 'grid' && (
          <TestimonialGrid testimonials={testimonials} variant={variant} columns={columns} />
        )}
        {layout === 'masonry' && (
          <MasonryTestimonials testimonials={testimonials} variant={variant} />
        )}
        {layout === 'featured' && testimonials[0] && (
          <div className="space-y-8">
            <FeaturedTestimonial testimonial={testimonials[0]} />
            {testimonials.length > 1 && (
              <TestimonialGrid
                testimonials={testimonials.slice(1)}
                variant={variant}
                columns={columns}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
```

## Logo Cloud with Testimonial

```typescript
function TestimonialWithLogos({
  testimonial,
  logos,
}: {
  testimonial: Testimonial;
  logos: Array<{ src: string; alt: string }>;
}) {
  return (
    <div className="text-center">
      {/* Featured testimonial */}
      <FeaturedTestimonial testimonial={testimonial} className="max-w-3xl mx-auto" />

      {/* Logo cloud */}
      <div className="mt-12">
        <p className="text-sm text-muted-foreground mb-6">
          Trusted by leading companies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {logos.map((logo, index) => (
            <img
              key={index}
              src={logo.src}
              alt={logo.alt}
              className="h-8 grayscale hover:grayscale-0 transition-all"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Usage Examples

```tsx
const testimonials: Testimonial[] = [
  {
    id: '1',
    quote: 'This product has transformed how we work. The team loves it!',
    author: {
      name: 'Sarah Chen',
      title: 'CEO',
      company: 'TechCorp',
      avatar: '/avatars/sarah.jpg',
    },
    rating: 5,
  },
  {
    id: '2',
    quote: 'Incredibly intuitive and powerful. Best decision we made.',
    author: {
      name: 'Michael Park',
      title: 'Head of Product',
      company: 'StartupXYZ',
      avatar: '/avatars/michael.jpg',
    },
    rating: 5,
  },
  // ... more testimonials
];

// Carousel layout
<TestimonialSection
  badge="Testimonials"
  title="Loved by thousands"
  testimonials={testimonials}
  layout="carousel"
/>

// Grid layout
<TestimonialSection
  testimonials={testimonials}
  layout="grid"
  columns={3}
  variant="filled"
/>

// Masonry layout
<TestimonialSection
  testimonials={testimonials}
  layout="masonry"
  variant="quote"
/>

// Featured + grid
<TestimonialSection
  testimonials={testimonials}
  layout="featured"
/>

// Standalone carousel
<TestimonialCarousel
  testimonials={testimonials}
  autoplay={true}
  autoplayDelay={4000}
  showArrows={true}
  showDots={true}
/>

// With logo cloud
<TestimonialWithLogos
  testimonial={testimonials[0]}
  logos={[
    { src: '/logos/google.svg', alt: 'Google' },
    { src: '/logos/meta.svg', alt: 'Meta' },
  ]}
/>
```

## Key Takeaways

1. **Embla Carousel**: Smooth touch-enabled carousel
2. **Autoplay**: Optional with configurable delay
3. **Layouts**: carousel, grid, masonry, featured
4. **Variants**: default, filled, gradient, quote
5. **Rating**: Optional 5-star display
6. **Avatar Fallback**: Initial letter when no image
7. **Logo Cloud**: Company logos with testimonial
