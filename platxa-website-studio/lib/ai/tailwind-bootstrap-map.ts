/**
 * Shared Tailwind CSS → Bootstrap 5 class mapping
 *
 * Odoo 18 uses Bootstrap 5. LLMs (especially small ones) frequently emit
 * Tailwind classes. This module provides a single source of truth for
 * converting them.
 */

// =============================================================================
// MAPPING TABLE
// =============================================================================

/**
 * Tailwind class → Bootstrap 5 equivalent.
 * Empty string means "remove the class" (no Bootstrap equivalent).
 */
export const TAILWIND_TO_BOOTSTRAP: Record<string, string> = {
  // ── Spacing (Tailwind arbitrary → Bootstrap 0-5 scale) ──────────────
  'p-0': 'p-0', 'p-1': 'p-1', 'p-2': 'p-2', 'p-3': 'p-3', 'p-4': 'p-4',
  'p-5': 'p-3', 'p-6': 'p-4', 'p-8': 'p-4', 'p-10': 'p-5', 'p-12': 'p-5', 'p-16': 'p-5', 'p-20': 'p-5',
  'px-0': 'px-0', 'px-1': 'px-1', 'px-2': 'px-2', 'px-3': 'px-3', 'px-4': 'px-4',
  'px-5': 'px-3', 'px-6': 'px-4', 'px-8': 'px-4', 'px-10': 'px-5', 'px-12': 'px-5', 'px-16': 'px-5',
  'py-0': 'py-0', 'py-1': 'py-1', 'py-2': 'py-2', 'py-3': 'py-3', 'py-4': 'py-4',
  'py-5': 'py-3', 'py-6': 'py-4', 'py-8': 'py-5', 'py-10': 'py-5', 'py-12': 'py-5', 'py-16': 'py-5', 'py-20': 'py-5',
  'pt-0': 'pt-0', 'pt-4': 'pt-3', 'pt-6': 'pt-4', 'pt-8': 'pt-5', 'pt-10': 'pt-5',
  'pb-0': 'pb-0', 'pb-4': 'pb-3', 'pb-6': 'pb-4', 'pb-8': 'pb-5', 'pb-10': 'pb-5',
  'pl-4': 'ps-3', 'pl-6': 'ps-4', 'pl-8': 'ps-5',
  'pr-4': 'pe-3', 'pr-6': 'pe-4', 'pr-8': 'pe-5',
  'm-0': 'm-0', 'm-1': 'm-1', 'm-2': 'm-2', 'm-4': 'm-3', 'm-6': 'm-4', 'm-8': 'm-5', 'm-auto': 'm-auto',
  'mx-auto': 'mx-auto', 'mx-4': 'mx-3', 'mx-6': 'mx-4', 'mx-8': 'mx-5',
  'my-4': 'my-3', 'my-6': 'my-4', 'my-8': 'my-5',
  'mt-0': 'mt-0', 'mt-1': 'mt-1', 'mt-2': 'mt-2', 'mt-4': 'mt-3', 'mt-6': 'mt-4', 'mt-8': 'mt-5', 'mt-10': 'mt-5',
  'mb-0': 'mb-0', 'mb-1': 'mb-1', 'mb-2': 'mb-2', 'mb-4': 'mb-3', 'mb-6': 'mb-4', 'mb-8': 'mb-5', 'mb-10': 'mb-5',
  'ml-4': 'ms-3', 'ml-auto': 'ms-auto',
  'mr-4': 'me-3', 'mr-auto': 'me-auto',
  'space-x-2': 'gap-2', 'space-x-4': 'gap-3', 'space-x-6': 'gap-4',
  'space-y-2': 'gap-2', 'space-y-4': 'gap-3', 'space-y-6': 'gap-4',
  'gap-1': 'gap-1', 'gap-2': 'gap-2', 'gap-3': 'gap-3', 'gap-4': 'gap-3',
  'gap-6': 'gap-4', 'gap-8': 'gap-4', 'gap-10': 'gap-4',

  // ── Layout / Sizing ──────────────────────────────────────────────────
  'w-full': 'w-100', 'w-1/2': 'w-50', 'w-1/3': 'w-auto', 'w-1/4': 'w-25',
  'w-auto': 'w-auto', 'w-screen': 'vw-100',
  'h-full': 'h-100', 'h-auto': 'h-auto', 'h-screen': 'min-vh-100',
  'min-h-screen': 'min-vh-100', 'min-h-full': 'min-vh-100',
  'max-w-sm': 'container', 'max-w-md': 'container', 'max-w-lg': 'container',
  'max-w-xl': 'container', 'max-w-2xl': 'container', 'max-w-3xl': 'container',
  'max-w-4xl': 'container', 'max-w-5xl': 'container', 'max-w-6xl': 'container',
  'max-w-7xl': 'container', 'max-w-full': 'w-100', 'max-w-none': '',
  'container': 'container',

  // ── Flexbox ──────────────────────────────────────────────────────────
  'flex': 'd-flex', 'inline-flex': 'd-inline-flex',
  'flex-row': 'flex-row', 'flex-col': 'flex-column',
  'flex-row-reverse': 'flex-row-reverse', 'flex-col-reverse': 'flex-column-reverse',
  'flex-wrap': 'flex-wrap', 'flex-nowrap': 'flex-nowrap', 'flex-wrap-reverse': 'flex-wrap-reverse',
  'flex-1': 'flex-fill', 'flex-auto': 'flex-fill', 'flex-none': 'flex-shrink-0',
  'flex-grow': 'flex-grow-1', 'flex-grow-0': 'flex-grow-0',
  'flex-shrink': 'flex-shrink-1', 'flex-shrink-0': 'flex-shrink-0',
  'items-start': 'align-items-start', 'items-end': 'align-items-end',
  'items-center': 'align-items-center', 'items-baseline': 'align-items-baseline',
  'items-stretch': 'align-items-stretch',
  'self-start': 'align-self-start', 'self-end': 'align-self-end',
  'self-center': 'align-self-center', 'self-stretch': 'align-self-stretch',
  'justify-start': 'justify-content-start', 'justify-end': 'justify-content-end',
  'justify-center': 'justify-content-center', 'justify-between': 'justify-content-between',
  'justify-around': 'justify-content-around', 'justify-evenly': 'justify-content-evenly',
  'order-first': 'order-first', 'order-last': 'order-last',
  'order-1': 'order-1', 'order-2': 'order-2', 'order-3': 'order-3',

  // ── Grid ─────────────────────────────────────────────────────────────
  'grid': 'd-grid', 'grid-cols-1': 'row',
  'grid-cols-2': 'row', 'grid-cols-3': 'row', 'grid-cols-4': 'row',
  'grid-cols-6': 'row', 'grid-cols-12': 'row',
  'col-span-1': 'col', 'col-span-2': 'col-2', 'col-span-3': 'col-3',
  'col-span-4': 'col-4', 'col-span-6': 'col-6', 'col-span-12': 'col-12',

  // ── Typography ───────────────────────────────────────────────────────
  'text-xs': 'small', 'text-sm': 'small', 'text-base': '', 'text-lg': 'fs-5',
  'text-xl': 'fs-4', 'text-2xl': 'fs-3', 'text-3xl': 'fs-2', 'text-4xl': 'fs-1',
  'text-5xl': 'display-4', 'text-6xl': 'display-3', 'text-7xl': 'display-2', 'text-8xl': 'display-1', 'text-9xl': 'display-1',
  'font-thin': 'fw-lighter', 'font-extralight': 'fw-lighter',
  'font-light': 'fw-light', 'font-normal': 'fw-normal',
  'font-medium': 'fw-medium', 'font-semibold': 'fw-semibold',
  'font-bold': 'fw-bold', 'font-extrabold': 'fw-bolder', 'font-black': 'fw-bolder',
  'italic': 'fst-italic', 'not-italic': 'fst-normal',
  'text-left': 'text-start', 'text-center': 'text-center', 'text-right': 'text-end',
  'text-justify': 'text-justify',
  'uppercase': 'text-uppercase', 'lowercase': 'text-lowercase', 'capitalize': 'text-capitalize', 'normal-case': '',
  'underline': 'text-decoration-underline', 'line-through': 'text-decoration-line-through', 'no-underline': 'text-decoration-none',
  'tracking-tighter': '', 'tracking-tight': '', 'tracking-normal': '', 'tracking-wide': '', 'tracking-wider': '', 'tracking-widest': '',
  'leading-none': 'lh-1', 'leading-tight': 'lh-sm', 'leading-snug': 'lh-sm',
  'leading-normal': 'lh-base', 'leading-relaxed': 'lh-lg', 'leading-loose': 'lh-lg',
  'truncate': 'text-truncate', 'whitespace-nowrap': 'text-nowrap',
  'break-words': 'text-break',

  // ── Colors (generic Tailwind utilities → Bootstrap utilities) ───────
  'text-white': 'text-white', 'text-black': 'text-dark',
  'text-gray-500': 'text-muted', 'text-gray-600': 'text-muted',
  'text-gray-700': 'text-secondary', 'text-gray-800': 'text-dark',
  'text-gray-900': 'text-dark', 'text-gray-400': 'text-muted',
  'text-gray-300': 'text-muted',
  'bg-white': 'bg-white', 'bg-black': 'bg-dark',
  'bg-gray-50': 'bg-light', 'bg-gray-100': 'bg-light', 'bg-gray-200': 'bg-light',
  'bg-gray-800': 'bg-dark', 'bg-gray-900': 'bg-dark',
  'bg-transparent': 'bg-transparent',

  // ── Background utilities ─────────────────────────────────────────────
  'bg-cover': '', 'bg-center': '', 'bg-no-repeat': '', 'bg-fixed': '',
  'bg-gradient-to-r': '', 'bg-gradient-to-l': '', 'bg-gradient-to-t': '', 'bg-gradient-to-b': '',

  // ── Borders ──────────────────────────────────────────────────────────
  'border': 'border', 'border-0': 'border-0',
  'border-t': 'border-top', 'border-b': 'border-bottom',
  'border-l': 'border-start', 'border-r': 'border-end',
  'border-gray-200': 'border-light', 'border-gray-300': '',
  'rounded': 'rounded', 'rounded-sm': 'rounded-1', 'rounded-md': 'rounded-2',
  'rounded-lg': 'rounded-3', 'rounded-xl': 'rounded-4', 'rounded-2xl': 'rounded-4',
  'rounded-3xl': 'rounded-5', 'rounded-full': 'rounded-circle', 'rounded-none': 'rounded-0',
  'rounded-t': 'rounded-top', 'rounded-b': 'rounded-bottom',
  'rounded-l': 'rounded-start', 'rounded-r': 'rounded-end',

  // ── Effects ──────────────────────────────────────────────────────────
  'shadow': 'shadow', 'shadow-sm': 'shadow-sm', 'shadow-md': 'shadow',
  'shadow-lg': 'shadow-lg', 'shadow-xl': 'shadow-lg', 'shadow-2xl': 'shadow-lg', 'shadow-none': 'shadow-none',
  'opacity-0': 'opacity-0', 'opacity-25': 'opacity-25', 'opacity-50': 'opacity-50',
  'opacity-75': 'opacity-75', 'opacity-100': 'opacity-100',

  // ── Display ──────────────────────────────────────────────────────────
  'block': 'd-block', 'inline-block': 'd-inline-block', 'inline': 'd-inline',
  'hidden': 'd-none', 'table': 'd-table',

  // ── Overflow ─────────────────────────────────────────────────────────
  'overflow-auto': 'overflow-auto', 'overflow-hidden': 'overflow-hidden',
  'overflow-visible': 'overflow-visible', 'overflow-scroll': 'overflow-scroll',
  'overflow-x-auto': 'overflow-auto', 'overflow-y-auto': 'overflow-auto',

  // ── Position ─────────────────────────────────────────────────────────
  'static': 'position-static', 'relative': 'position-relative',
  'absolute': 'position-absolute', 'fixed': 'position-fixed', 'sticky': 'position-sticky',
  'inset-0': 'top-0 start-0 bottom-0 end-0',
  'top-0': 'top-0', 'bottom-0': 'bottom-0',
  'left-0': 'start-0', 'right-0': 'end-0',
  'z-0': '', 'z-10': '', 'z-20': '', 'z-30': '', 'z-40': '', 'z-50': '',

  // ── Visibility ───────────────────────────────────────────────────────
  'visible': 'visible', 'invisible': 'invisible',
  'sr-only': 'visually-hidden',

  // ── Cursor ───────────────────────────────────────────────────────────
  'cursor-pointer': '', 'cursor-not-allowed': '', 'cursor-default': '',

  // ── User interaction ─────────────────────────────────────────────────
  'select-none': 'user-select-none', 'select-all': 'user-select-all',
  'pointer-events-none': 'pe-none', 'pointer-events-auto': 'pe-auto',

  // ── Object fit (images) ──────────────────────────────────────────────
  'object-cover': 'object-fit-cover', 'object-contain': 'object-fit-contain',
  'object-fill': 'object-fit-fill', 'object-none': 'object-fit-none',

  // ── Responsive containers ────────────────────────────────────────────
  'container-sm': 'container-sm', 'container-md': 'container-md',
  'container-lg': 'container-lg', 'container-xl': 'container-xl',

  // ── Aspect ratio ─────────────────────────────────────────────────────
  'aspect-video': 'ratio ratio-16x9', 'aspect-square': 'ratio ratio-1x1',

  // ── Transition (Tailwind-specific, no direct BS equivalent) ──────────
  'transition': '', 'transition-all': '', 'transition-colors': '',
  'transition-opacity': '', 'transition-shadow': '', 'transition-transform': '',
  'duration-100': '', 'duration-150': '', 'duration-200': '', 'duration-300': '', 'duration-500': '',
  'ease-in': '', 'ease-out': '', 'ease-in-out': '', 'ease-linear': '',

  // ── Transform (Tailwind-specific) ────────────────────────────────────
  'transform': '', 'rotate-45': '', 'rotate-90': '', 'rotate-180': '',
  'scale-50': '', 'scale-75': '', 'scale-100': '', 'scale-105': '', 'scale-110': '', 'scale-125': '', 'scale-150': '',
  'translate-x-0': '', 'translate-y-0': '',

  // ── Misc ─────────────────────────────────────────────────────────────
  'list-none': 'list-unstyled', 'list-disc': '',
  'antialiased': '', 'subpixel-antialiased': '',
  'ring-0': '', 'ring-1': '', 'ring-2': '', 'outline-none': '',
  'appearance-none': '',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Strip Tailwind responsive prefixes (sm:, md:, lg:, xl:, 2xl:).
 * Returns the base class.
 *
 * Example: "md:flex-col" → "flex-col"
 */
export function stripResponsivePrefixes(cls: string): string {
  return cls.replace(/^(sm|md|lg|xl|2xl):/, '');
}

// Pre-compiled regex for arbitrary value classes like `w-[200px]`, `text-[#333]`
const ARBITRARY_VALUE_RE = /^[a-z]+-\[.+\]$/;

// =============================================================================
// CONVERSION
// =============================================================================

/**
 * Convert Tailwind CSS classes to Bootstrap 5 equivalents in an HTML string.
 *
 * - Looks inside `class="..."` and `class='...'` attributes
 * - Strips responsive prefixes before looking up mappings
 * - Removes arbitrary value classes (e.g. `w-[200px]`)
 * - Preserves unknown classes as-is (may be Bootstrap or custom)
 * - Cleans up double spaces left by empty replacements
 *
 * Returns the HTML with classes converted.
 */
export function convertTailwindToBootstrap(html: string): string {
  let fixCount = 0;

  // Process class attributes (both " and ' delimiters)
  const result = html.replace(/class=(["'])([\s\S]*?)\1/g, (_match, quote, classes: string) => {
    const tokens = classes.split(/\s+/).filter(Boolean);
    const converted: string[] = [];

    for (const token of tokens) {
      // Strip responsive prefix for lookup
      const base = stripResponsivePrefixes(token);

      // Drop arbitrary value classes entirely
      if (ARBITRARY_VALUE_RE.test(base)) {
        fixCount++;
        continue;
      }

      // Look up in mapping table
      if (base in TAILWIND_TO_BOOTSTRAP) {
        const replacement = TAILWIND_TO_BOOTSTRAP[base];
        fixCount++;
        if (replacement !== '') {
          // Some replacements contain spaces (e.g. "ratio ratio-16x9")
          converted.push(replacement);
        }
        // Empty string means "remove" — we just don't push anything
      } else {
        // Not a known Tailwind class — keep as-is
        converted.push(token);
      }
    }

    return `class=${quote}${converted.join(' ')}${quote}`;
  });

  if (fixCount > 0) {
    console.log(`[TailwindMap] Converted ${fixCount} Tailwind classes to Bootstrap 5`);
  }

  return result;
}
