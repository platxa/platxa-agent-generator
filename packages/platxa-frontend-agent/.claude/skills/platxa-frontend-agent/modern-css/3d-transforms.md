# 3D Transform Utilities

Perspective, rotation, and 3D transformation patterns for immersive UI effects.

## Overview

3D transforms enable:
1. Perspective depth effects
2. Card flip animations
3. 3D rotation on X, Y, Z axes
4. Tilt hover effects
5. Parallax scrolling

## Core CSS Properties

```css
/* Perspective (on parent) */
.perspective-container {
  perspective: 1000px;
  perspective-origin: center center;
}

/* Transform style (preserve children in 3D space) */
.transform-3d {
  transform-style: preserve-3d;
}

/* Backface visibility */
.backface-hidden {
  backface-visibility: hidden;
}

/* 3D rotations */
.rotate-x-45 { transform: rotateX(45deg); }
.rotate-y-45 { transform: rotateY(45deg); }
.rotate-z-45 { transform: rotateZ(45deg); }
```

## Tailwind Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      // Perspective utilities
      perspective: {
        'none': 'none',
        '500': '500px',
        '1000': '1000px',
        '1500': '1500px',
        '2000': '2000px',
      },
      // Rotate X utilities
      rotateX: {
        '0': '0deg',
        '12': '12deg',
        '45': '45deg',
        '90': '90deg',
        '180': '180deg',
      },
      // Rotate Y utilities
      rotateY: {
        '0': '0deg',
        '12': '12deg',
        '45': '45deg',
        '90': '90deg',
        '180': '180deg',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, theme }) => {
      // Perspective utilities
      const perspectiveUtilities = Object.entries(theme('perspective')).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`.perspective-${key}`]: { perspective: value },
        }),
        {}
      );

      // Rotate X utilities
      const rotateXUtilities = Object.entries(theme('rotateX')).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`.rotate-x-${key}`]: { transform: `rotateX(${value})` },
          [`.-rotate-x-${key}`]: { transform: `rotateX(-${value})` },
        }),
        {}
      );

      // Rotate Y utilities
      const rotateYUtilities = Object.entries(theme('rotateY')).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`.rotate-y-${key}`]: { transform: `rotateY(${value})` },
          [`.-rotate-y-${key}`]: { transform: `rotateY(-${value})` },
        }),
        {}
      );

      addUtilities({
        ...perspectiveUtilities,
        ...rotateXUtilities,
        ...rotateYUtilities,
        '.transform-style-3d': { transformStyle: 'preserve-3d' },
        '.transform-style-flat': { transformStyle: 'flat' },
        '.backface-visible': { backfaceVisibility: 'visible' },
        '.backface-hidden': { backfaceVisibility: 'hidden' },
        '.perspective-origin-center': { perspectiveOrigin: 'center' },
        '.perspective-origin-top': { perspectiveOrigin: 'top' },
        '.perspective-origin-bottom': { perspectiveOrigin: 'bottom' },
      });
    }),
  ],
};
```

## Card Flip Effect

### Basic Flip Card

```typescript
interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}

const FlipCard = ({ front, back, className }: FlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={cn('perspective-1000 cursor-pointer', className)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={cn(
          'relative h-full w-full transition-transform duration-500',
          'transform-style-3d',
          isFlipped && 'rotate-y-180'
        )}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden">
          {front}
        </div>

        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180">
          {back}
        </div>
      </div>
    </div>
  );
};
```

### CSS-Only Flip Card

```css
.flip-card {
  perspective: 1000px;
  width: 300px;
  height: 400px;
}

.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.flip-card:hover .flip-card-inner,
.flip-card:focus-within .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 0.5rem;
}

.flip-card-front {
  background: var(--card);
  color: var(--card-foreground);
}

.flip-card-back {
  background: var(--primary);
  color: var(--primary-foreground);
  transform: rotateY(180deg);
}
```

### Horizontal vs Vertical Flip

```typescript
interface DirectionalFlipCardProps extends FlipCardProps {
  direction?: 'horizontal' | 'vertical';
}

const DirectionalFlipCard = ({
  front,
  back,
  direction = 'horizontal',
  className,
}: DirectionalFlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const flipClass = direction === 'horizontal'
    ? 'rotate-y-180'
    : 'rotate-x-180';

  const backRotation = direction === 'horizontal'
    ? 'rotate-y-180'
    : 'rotate-x-180';

  return (
    <div
      className={cn('perspective-1000 cursor-pointer', className)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={cn(
          'relative h-full w-full transition-transform duration-500',
          'transform-style-3d',
          isFlipped && flipClass
        )}
      >
        <div className="absolute inset-0 backface-hidden rounded-lg border bg-card p-6">
          {front}
        </div>
        <div className={cn(
          'absolute inset-0 backface-hidden rounded-lg border bg-primary p-6 text-primary-foreground',
          backRotation
        )}>
          {back}
        </div>
      </div>
    </div>
  );
};
```

## 3D Tilt Effect

### Mouse-Following Tilt

```typescript
interface TiltCardProps {
  children: React.ReactNode;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  className?: string;
}

const TiltCard = ({
  children,
  maxTilt = 15,
  perspective = 1000,
  scale = 1.05,
  className,
}: TiltCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTransform(
      `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
    );
  };

  const handleMouseLeave = () => {
    setTransform('');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'transition-transform duration-200 ease-out',
        className
      )}
      style={{ transform }}
    >
      {children}
    </div>
  );
};
```

### Glare Effect

```typescript
const TiltCardWithGlare = ({ children, ...props }: TiltCardProps) => {
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePosition({ x, y });
  };

  return (
    <TiltCard {...props}>
      <div
        className="relative overflow-hidden rounded-lg"
        onMouseMove={handleMouseMove}
      >
        {children}
        {/* Glare overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-30"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, white 0%, transparent 50%)`,
          }}
        />
      </div>
    </TiltCard>
  );
};
```

## 3D Carousel

```typescript
interface CarouselItem {
  id: string;
  content: React.ReactNode;
}

interface Carousel3DProps {
  items: CarouselItem[];
  radius?: number;
}

const Carousel3D = ({ items, radius = 300 }: Carousel3DProps) => {
  const [rotation, setRotation] = useState(0);
  const angleStep = 360 / items.length;

  const next = () => setRotation((r) => r - angleStep);
  const prev = () => setRotation((r) => r + angleStep);

  return (
    <div className="relative h-[400px] w-full perspective-1000">
      <div
        className="absolute left-1/2 top-1/2 transform-style-3d transition-transform duration-500"
        style={{
          transform: `translateX(-50%) translateY(-50%) rotateY(${rotation}deg)`,
        }}
      >
        {items.map((item, index) => {
          const angle = angleStep * index;
          return (
            <div
              key={item.id}
              className="absolute left-1/2 top-1/2 h-[250px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-4 shadow-lg"
              style={{
                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
              }}
            >
              {item.content}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-primary p-2"
      >
        <ChevronLeft className="h-6 w-6 text-primary-foreground" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-primary p-2"
      >
        <ChevronRight className="h-6 w-6 text-primary-foreground" />
      </button>
    </div>
  );
};
```

## 3D Button Press

```css
.button-3d {
  position: relative;
  transform-style: preserve-3d;
  transform: perspective(500px) translateZ(0);
  transition: transform 0.15s;
}

.button-3d::before {
  content: '';
  position: absolute;
  inset: 0;
  background: inherit;
  border-radius: inherit;
  transform: translateZ(-8px);
  filter: brightness(0.7);
}

.button-3d:hover {
  transform: perspective(500px) translateZ(4px);
}

.button-3d:active {
  transform: perspective(500px) translateZ(-4px);
}
```

```typescript
const Button3D = ({ children, className, ...props }: ButtonProps) => (
  <button
    className={cn(
      'relative rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground',
      'transform-style-3d',
      'transition-transform duration-150',
      'hover:translate-z-1 active:-translate-z-1',
      '[transform:perspective(500px)_translateZ(0)]',
      'hover:[transform:perspective(500px)_translateZ(4px)]',
      'active:[transform:perspective(500px)_translateZ(-4px)]',
      className
    )}
    {...props}
  >
    {/* Shadow layer */}
    <span
      className="absolute inset-0 -z-10 rounded-lg bg-primary brightness-75"
      style={{ transform: 'translateZ(-8px)' }}
    />
    {children}
  </button>
);
```

## Parallax Card

```typescript
interface ParallaxCardProps {
  image: string;
  title: string;
  description: string;
}

const ParallaxCard = ({ image, title, description }: ParallaxCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transforms, setTransforms] = useState({
    card: '',
    image: '',
    content: '',
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    setTransforms({
      card: `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`,
      image: `translateX(${x * -20}px) translateY(${y * -20}px) scale(1.1)`,
      content: `translateZ(50px)`,
    });
  };

  const handleMouseLeave = () => {
    setTransforms({ card: '', image: '', content: '' });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative h-[400px] w-[300px] cursor-pointer overflow-hidden rounded-xl transform-style-3d transition-transform duration-300"
      style={{ transform: transforms.card }}
    >
      {/* Background image with parallax */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{ transform: transforms.image }}
      >
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Content with depth */}
      <div
        className="absolute inset-x-0 bottom-0 p-6 transition-transform duration-300"
        style={{ transform: transforms.content }}
      >
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/80">{description}</p>
      </div>
    </div>
  );
};
```

## Cube Rotation

```typescript
const RotatingCube = ({ faces }: { faces: React.ReactNode[] }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((r) => ({ x: r.x + 0.5, y: r.y + 0.5 }));
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const size = 150;

  return (
    <div className="perspective-1000 h-[200px] w-[200px]">
      <div
        className="relative h-full w-full transform-style-3d"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
      >
        {/* Front */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `translateZ(${size / 2}px)`,
          }}
        >
          {faces[0]}
        </div>
        {/* Back */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `rotateY(180deg) translateZ(${size / 2}px)`,
          }}
        >
          {faces[1]}
        </div>
        {/* Left */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `rotateY(-90deg) translateZ(${size / 2}px)`,
          }}
        >
          {faces[2]}
        </div>
        {/* Right */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `rotateY(90deg) translateZ(${size / 2}px)`,
          }}
        >
          {faces[3]}
        </div>
        {/* Top */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `rotateX(90deg) translateZ(${size / 2}px)`,
          }}
        >
          {faces[4]}
        </div>
        {/* Bottom */}
        <div
          className="absolute flex items-center justify-center border bg-primary/80"
          style={{
            width: size,
            height: size,
            transform: `rotateX(-90deg) translateZ(${size / 2}px)`,
          }}
        >
          {faces[5]}
        </div>
      </div>
    </div>
  );
};
```

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .flip-card-inner,
  .tilt-card,
  .carousel-3d,
  .button-3d {
    transition: none;
    transform: none !important;
  }

  .flip-card:hover .flip-card-inner {
    transform: none;
  }
}
```

## Key Takeaways

1. **perspective**: Set on parent, defines 3D depth
2. **transform-style: preserve-3d**: Children exist in 3D space
3. **backface-visibility: hidden**: Hide back of rotated elements
4. **rotateX/Y/Z**: Rotate around specific axes
5. **translateZ**: Move element in/out of screen
6. **Tilt Effect**: Calculate rotation from mouse position
7. **Performance**: Use will-change sparingly, prefer transform
8. **Reduced Motion**: Always provide fallbacks
