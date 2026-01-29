# Footer Section

Footer with link columns, social icons, newsletter, and copyright.

## Dependencies

```bash
pnpm add lucide-react
```

## Types

```typescript
interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'github' | 'youtube' | 'discord' | 'tiktok';
  href: string;
  label?: string;
}

interface FooterConfig {
  logo?: React.ReactNode;
  description?: string;
  columns: FooterColumn[];
  socials?: SocialLink[];
  newsletter?: {
    title?: string;
    description?: string;
    placeholder?: string;
    buttonText?: string;
    onSubmit?: (email: string) => void;
  };
  copyright?: string;
  bottomLinks?: FooterLink[];
}
```

## Social Icons Map

```typescript
import {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  MessageCircle,
  Music2,
} from 'lucide-react';

const socialIcons: Record<SocialLink['platform'], React.ElementType> = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  github: Github,
  youtube: Youtube,
  discord: MessageCircle,
  tiktok: Music2,
};

function SocialIcon({ platform }: { platform: SocialLink['platform'] }) {
  const Icon = socialIcons[platform];
  return <Icon className="h-5 w-5" />;
}
```

## Base Footer Component

```typescript
'use client';

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps extends FooterConfig {
  variant?: 'default' | 'centered' | 'minimal' | 'dark';
  className?: string;
}

function Footer({
  logo,
  description,
  columns,
  socials,
  newsletter,
  copyright,
  bottomLinks,
  variant = 'default',
  className,
}: FooterProps) {
  const currentYear = new Date().getFullYear();
  const copyrightText = copyright || `© ${currentYear} Your Company. All rights reserved.`;

  return (
    <footer
      className={cn(
        'border-t',
        variant === 'dark' && 'bg-gray-900 text-gray-100 border-gray-800',
        className
      )}
    >
      <div className="container mx-auto px-4 py-12 md:py-16">
        {variant === 'centered' ? (
          <CenteredFooterContent
            logo={logo}
            description={description}
            columns={columns}
            socials={socials}
            newsletter={newsletter}
          />
        ) : variant === 'minimal' ? (
          <MinimalFooterContent
            logo={logo}
            socials={socials}
            bottomLinks={bottomLinks}
            copyright={copyrightText}
          />
        ) : (
          <DefaultFooterContent
            logo={logo}
            description={description}
            columns={columns}
            socials={socials}
            newsletter={newsletter}
          />
        )}
      </div>

      {/* Bottom bar */}
      {variant !== 'minimal' && (
        <div className={cn(
          'border-t py-6',
          variant === 'dark' ? 'border-gray-800' : 'border-border'
        )}>
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{copyrightText}</p>
            {bottomLinks && bottomLinks.length > 0 && (
              <nav className="flex gap-6">
                {bottomLinks.map((link) => (
                  <FooterLinkItem key={link.href} link={link} />
                ))}
              </nav>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
```

## Default Footer Layout

```typescript
function DefaultFooterContent({
  logo,
  description,
  columns,
  socials,
  newsletter,
}: Omit<FooterConfig, 'copyright' | 'bottomLinks'>) {
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Brand column */}
      <div className="lg:col-span-4">
        {logo && <div className="mb-4">{logo}</div>}
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
        {socials && socials.length > 0 && (
          <div className="mt-6 flex gap-4">
            {socials.map((social) => (
              <SocialLinkItem key={social.platform} social={social} />
            ))}
          </div>
        )}
      </div>

      {/* Link columns */}
      <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8">
        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="font-semibold mb-4">{column.title}</h3>
            <ul className="space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Newsletter */}
      {newsletter && (
        <div className="lg:col-span-3">
          <NewsletterForm {...newsletter} />
        </div>
      )}
    </div>
  );
}
```

## Centered Footer Layout

```typescript
function CenteredFooterContent({
  logo,
  description,
  columns,
  socials,
  newsletter,
}: Omit<FooterConfig, 'copyright' | 'bottomLinks'>) {
  return (
    <div className="text-center">
      {/* Logo */}
      {logo && <div className="flex justify-center mb-4">{logo}</div>}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      )}

      {/* Newsletter */}
      {newsletter && (
        <div className="mt-8 max-w-md mx-auto">
          <NewsletterForm {...newsletter} />
        </div>
      )}

      {/* Link columns - horizontal on desktop */}
      {columns.length > 0 && (
        <nav className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-4">
          {columns.flatMap((column) =>
            column.links.map((link) => (
              <FooterLinkItem key={link.href} link={link} />
            ))
          )}
        </nav>
      )}

      {/* Social icons */}
      {socials && socials.length > 0 && (
        <div className="mt-8 flex justify-center gap-4">
          {socials.map((social) => (
            <SocialLinkItem key={social.platform} social={social} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Minimal Footer Layout

```typescript
function MinimalFooterContent({
  logo,
  socials,
  bottomLinks,
  copyright,
}: {
  logo?: React.ReactNode;
  socials?: SocialLink[];
  bottomLinks?: FooterLink[];
  copyright: string;
}) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Logo */}
      {logo && <div>{logo}</div>}

      {/* Links */}
      {bottomLinks && bottomLinks.length > 0 && (
        <nav className="flex flex-wrap justify-center gap-6">
          {bottomLinks.map((link) => (
            <FooterLinkItem key={link.href} link={link} />
          ))}
        </nav>
      )}

      {/* Social + copyright */}
      <div className="flex items-center gap-6">
        {socials && socials.length > 0 && (
          <div className="flex gap-3">
            {socials.map((social) => (
              <SocialLinkItem key={social.platform} social={social} size="sm" />
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{copyright}</p>
      </div>
    </div>
  );
}
```

## Footer Link Component

```typescript
function FooterLinkItem({ link }: { link: FooterLink }) {
  return (
    <a
      href={link.href}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
      className={cn(
        'text-sm text-muted-foreground hover:text-foreground transition-colors',
        'inline-flex items-center gap-1'
      )}
    >
      {link.label}
      {link.external && <ExternalLink className="h-3 w-3" />}
    </a>
  );
}
```

## Social Link Component

```typescript
function SocialLinkItem({
  social,
  size = 'default',
}: {
  social: SocialLink;
  size?: 'sm' | 'default';
}) {
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={social.label || `Follow us on ${social.platform}`}
      className={cn(
        'flex items-center justify-center rounded-full transition-colors',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
      )}
    >
      <SocialIcon platform={social.platform} />
    </a>
  );
}
```

## Newsletter Form

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface NewsletterFormProps {
  title?: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
  onSubmit?: (email: string) => void;
}

function NewsletterForm({
  title = 'Subscribe to our newsletter',
  description,
  placeholder = 'Enter your email',
  buttonText = 'Subscribe',
  onSubmit,
}: NewsletterFormProps) {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      await onSubmit?.(email);
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div>
      {title && <h3 className="font-semibold mb-2">{title}</h3>}
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          className={cn(
            'flex-1 rounded-lg border bg-background px-4 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={cn(
            'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {status === 'loading' ? '...' : buttonText}
        </button>
      </form>

      {status === 'success' && (
        <p className="mt-2 text-sm text-green-600">Thanks for subscribing!</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-600">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
```

## Multi-Level Footer

```typescript
interface MultiLevelFooterConfig extends FooterConfig {
  topBar?: {
    links: FooterLink[];
    cta?: { label: string; href: string };
  };
}

function MultiLevelFooter({
  topBar,
  ...footerProps
}: MultiLevelFooterConfig & { variant?: FooterProps['variant'] }) {
  return (
    <div>
      {/* Top bar */}
      {topBar && (
        <div className="border-t bg-muted/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <nav className="flex gap-6">
              {topBar.links.map((link) => (
                <FooterLinkItem key={link.href} link={link} />
              ))}
            </nav>
            {topBar.cta && (
              <a
                href={topBar.cta.href}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {topBar.cta.label}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main footer */}
      <Footer {...footerProps} />
    </div>
  );
}
```

## Usage Examples

```tsx
// Full footer configuration
const footerConfig: FooterConfig = {
  logo: <img src="/logo.svg" alt="Company" className="h-8" />,
  description: 'Building the future of web development with modern tools.',
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Changelog', href: '/changelog' },
        { label: 'Docs', href: '/docs', external: true },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Blog', href: '/blog' },
        { label: 'Careers', href: '/careers' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Cookies', href: '/cookies' },
      ],
    },
  ],
  socials: [
    { platform: 'twitter', href: 'https://twitter.com/company' },
    { platform: 'github', href: 'https://github.com/company' },
    { platform: 'linkedin', href: 'https://linkedin.com/company/company' },
    { platform: 'discord', href: 'https://discord.gg/company' },
  ],
  newsletter: {
    title: 'Stay updated',
    description: 'Get the latest news and updates.',
    onSubmit: async (email) => {
      await subscribeToNewsletter(email);
    },
  },
  bottomLinks: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Settings', href: '#cookies' },
  ],
};

// Default footer
<Footer {...footerConfig} />

// Centered footer
<Footer {...footerConfig} variant="centered" />

// Minimal footer
<Footer {...footerConfig} variant="minimal" />

// Dark footer
<Footer {...footerConfig} variant="dark" />

// Multi-level footer
<MultiLevelFooter
  topBar={{
    links: [
      { label: 'Support', href: '/support' },
      { label: 'Documentation', href: '/docs' },
    ],
    cta: { label: 'Get Started', href: '/signup' },
  }}
  {...footerConfig}
/>
```

## Key Takeaways

1. **Layouts**: default, centered, minimal, dark variants
2. **Columns**: Flexible link groupings
3. **Socials**: Built-in icons for major platforms
4. **Newsletter**: Inline form with status handling
5. **Copyright**: Auto-generated year or custom text
6. **Bottom Links**: Privacy, terms, cookie settings
7. **Multi-Level**: Optional top bar with CTA
