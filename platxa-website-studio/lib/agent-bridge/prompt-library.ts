/**
 * Example Prompt Library for Common Use Cases
 *
 * Provides structured example prompts for theme creation, page addition,
 * and style modification to help users get started quickly.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Category of prompt examples.
 */
export type PromptCategory = 'theme' | 'page' | 'style' | 'component' | 'layout' | 'animation';

/**
 * Difficulty level of the prompt.
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A single example prompt.
 */
export interface ExamplePrompt {
  /** Unique prompt ID */
  id: string;
  /** Short title */
  title: string;
  /** Category */
  category: PromptCategory;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** The actual prompt text */
  prompt: string;
  /** Description of what this prompt achieves */
  description: string;
  /** Expected output or result */
  expectedResult: string;
  /** Tags for searching */
  tags: string[];
  /** Related prompts */
  relatedPrompts?: string[];
}

/**
 * A prompt template with placeholders.
 */
export interface PromptTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Category */
  category: PromptCategory;
  /** Template with {{placeholder}} markers */
  template: string;
  /** Placeholder descriptions */
  placeholders: { name: string; description: string; example: string }[];
  /** Usage instructions */
  instructions: string;
}

/**
 * Prompt library containing examples and templates.
 */
export interface PromptLibrary {
  /** Library version */
  version: string;
  /** Example prompts */
  examples: ExamplePrompt[];
  /** Prompt templates */
  templates: PromptTemplate[];
}

// =============================================================================
// Theme Creation Examples
// =============================================================================

/**
 * Example prompts for theme creation.
 */
export const themeCreationExamples: ExamplePrompt[] = [
  {
    id: 'theme-modern-minimal',
    title: 'Modern Minimal Theme',
    category: 'theme',
    difficulty: 'beginner',
    prompt: 'Create a modern minimal theme with a clean white background, subtle gray accents, and a vibrant blue primary color (#2563EB). Use Inter font for headings and system fonts for body text. Include generous whitespace and rounded corners on all components.',
    description: 'Creates a clean, modern theme suitable for SaaS applications and professional websites.',
    expectedResult: 'A complete theme with primary blue color, neutral grays, Inter typography, and consistent spacing.',
    tags: ['minimal', 'modern', 'clean', 'professional', 'saas'],
    relatedPrompts: ['theme-dark-mode', 'theme-corporate'],
  },
  {
    id: 'theme-dark-mode',
    title: 'Dark Mode Theme',
    category: 'theme',
    difficulty: 'beginner',
    prompt: 'Create a dark mode theme with a deep charcoal background (#1a1a2e), lighter card surfaces (#16213e), and an electric purple accent color (#e94560). Use high contrast text colors and subtle glow effects on interactive elements.',
    description: 'Creates an eye-friendly dark theme with vibrant accents.',
    expectedResult: 'A dark theme with proper contrast ratios, purple accents, and appropriate surface hierarchy.',
    tags: ['dark', 'night', 'purple', 'glow', 'contrast'],
    relatedPrompts: ['theme-modern-minimal', 'style-glassmorphism'],
  },
  {
    id: 'theme-corporate',
    title: 'Corporate Professional Theme',
    category: 'theme',
    difficulty: 'intermediate',
    prompt: 'Create a corporate professional theme with navy blue (#1e3a5f) as primary, gold (#d4af37) as accent, and warm gray (#f5f5f0) backgrounds. Use Playfair Display for headings and Source Sans Pro for body. Include formal borders and subtle shadows.',
    description: 'Creates a trustworthy, professional theme for corporate websites.',
    expectedResult: 'A sophisticated theme with navy/gold palette, serif headings, and formal styling.',
    tags: ['corporate', 'professional', 'navy', 'gold', 'formal'],
    relatedPrompts: ['theme-modern-minimal', 'page-about-company'],
  },
  {
    id: 'theme-playful-brand',
    title: 'Playful Brand Theme',
    category: 'theme',
    difficulty: 'intermediate',
    prompt: 'Create a playful, energetic theme with gradient backgrounds from pink (#ff6b6b) to orange (#feca57). Use rounded shapes, bouncy animations, and Poppins font throughout. Include emoji-friendly styling and fun hover effects.',
    description: 'Creates a fun, youthful theme for creative brands and startups.',
    expectedResult: 'A vibrant theme with gradient backgrounds, playful typography, and animated interactions.',
    tags: ['playful', 'fun', 'gradient', 'colorful', 'startup'],
    relatedPrompts: ['style-gradient-bg', 'theme-modern-minimal'],
  },
  {
    id: 'theme-ecommerce',
    title: 'E-commerce Theme',
    category: 'theme',
    difficulty: 'advanced',
    prompt: 'Create an e-commerce optimized theme with a clean white background, trust-building green (#22c55e) for CTAs, and attention-grabbing red (#ef4444) for sale badges. Include product card styling with hover zoom, price typography hierarchy, and cart icon styling.',
    description: 'Creates a conversion-optimized theme for online stores.',
    expectedResult: 'A complete e-commerce theme with product cards, CTA buttons, sale badges, and cart styling.',
    tags: ['ecommerce', 'shop', 'products', 'conversion', 'retail'],
    relatedPrompts: ['page-product-listing', 'style-button-variants'],
  },
  {
    id: 'theme-odoo-brand',
    title: 'Odoo Brand Aligned Theme',
    category: 'theme',
    difficulty: 'advanced',
    prompt: 'Create a theme that aligns with Odoo brand guidelines using purple (#714B67) as primary, with complementary colors from the Odoo palette. Ensure compatibility with Odoo module styling and maintain consistency with Odoo UI components.',
    description: 'Creates a theme that integrates seamlessly with Odoo applications.',
    expectedResult: 'An Odoo-compatible theme with proper brand colors and UI consistency.',
    tags: ['odoo', 'erp', 'purple', 'enterprise', 'integration'],
    relatedPrompts: ['theme-corporate', 'page-dashboard'],
  },
];

// =============================================================================
// Page Addition Examples
// =============================================================================

/**
 * Example prompts for page addition.
 */
export const pageAdditionExamples: ExamplePrompt[] = [
  {
    id: 'page-landing-hero',
    title: 'Landing Page with Hero',
    category: 'page',
    difficulty: 'beginner',
    prompt: 'Create a landing page with a full-screen hero section containing a large headline, subheadline, CTA button, and a hero image on the right. Below the hero, add a features section with 3 icon cards, followed by a testimonials section and a footer.',
    description: 'Creates a complete landing page with essential marketing sections.',
    expectedResult: 'A responsive landing page with hero, features, testimonials, and footer sections.',
    tags: ['landing', 'hero', 'marketing', 'cta', 'features'],
    relatedPrompts: ['page-pricing', 'style-button-variants'],
  },
  {
    id: 'page-about-company',
    title: 'About Company Page',
    category: 'page',
    difficulty: 'beginner',
    prompt: 'Create an About Us page with a company story section, mission statement, team member grid (4 members with photos and bios), company values with icons, and a timeline showing company history milestones.',
    description: 'Creates a comprehensive about page showcasing company information.',
    expectedResult: 'An about page with story, mission, team, values, and timeline sections.',
    tags: ['about', 'company', 'team', 'mission', 'history'],
    relatedPrompts: ['page-contact', 'page-landing-hero'],
  },
  {
    id: 'page-contact',
    title: 'Contact Page',
    category: 'page',
    difficulty: 'beginner',
    prompt: 'Create a contact page with a two-column layout: left side has contact form (name, email, subject, message), right side shows contact information (address, phone, email) with icons, office hours, and an embedded map placeholder.',
    description: 'Creates a functional contact page with form and information.',
    expectedResult: 'A contact page with form, contact details, hours, and map.',
    tags: ['contact', 'form', 'map', 'address', 'support'],
    relatedPrompts: ['page-about-company', 'style-form-inputs'],
  },
  {
    id: 'page-pricing',
    title: 'Pricing Page',
    category: 'page',
    difficulty: 'intermediate',
    prompt: 'Create a pricing page with a monthly/yearly toggle, 3 pricing tiers (Basic, Pro, Enterprise) as cards with features lists, recommended badge on the middle tier, FAQ accordion section below, and a CTA banner at the bottom.',
    description: 'Creates a conversion-optimized pricing page with tiers and FAQ.',
    expectedResult: 'A pricing page with toggle, three tier cards, FAQ, and final CTA.',
    tags: ['pricing', 'plans', 'subscription', 'faq', 'saas'],
    relatedPrompts: ['page-landing-hero', 'style-card-shadows'],
  },
  {
    id: 'page-blog-listing',
    title: 'Blog Listing Page',
    category: 'page',
    difficulty: 'intermediate',
    prompt: 'Create a blog listing page with a featured post hero at the top, category filter tabs, a grid of blog post cards (image, title, excerpt, author, date), sidebar with popular posts and newsletter signup, and pagination at the bottom.',
    description: 'Creates a complete blog index with filtering and navigation.',
    expectedResult: 'A blog listing with featured post, filters, card grid, sidebar, and pagination.',
    tags: ['blog', 'articles', 'posts', 'listing', 'content'],
    relatedPrompts: ['page-landing-hero', 'style-card-shadows'],
  },
  {
    id: 'page-dashboard',
    title: 'Admin Dashboard',
    category: 'page',
    difficulty: 'advanced',
    prompt: 'Create an admin dashboard with a sidebar navigation, top header with user menu, main content area containing: 4 stat cards (users, revenue, orders, growth), a line chart for trends, recent orders table, and activity feed sidebar.',
    description: 'Creates a comprehensive admin dashboard layout.',
    expectedResult: 'A dashboard with navigation, stats, charts, tables, and activity feed.',
    tags: ['dashboard', 'admin', 'analytics', 'charts', 'tables'],
    relatedPrompts: ['page-pricing', 'style-card-shadows'],
  },
  {
    id: 'page-product-listing',
    title: 'Product Listing Page',
    category: 'page',
    difficulty: 'advanced',
    prompt: 'Create an e-commerce product listing page with a left sidebar for filters (category, price range, brand, rating), top bar with sort dropdown and view toggle (grid/list), product grid with cards showing image, title, price, rating, and add to cart button, and infinite scroll or pagination.',
    description: 'Creates a filterable product catalog page.',
    expectedResult: 'A product listing with filters, sorting, view options, and product cards.',
    tags: ['products', 'catalog', 'ecommerce', 'filters', 'shopping'],
    relatedPrompts: ['page-dashboard', 'theme-ecommerce'],
  },
];

// =============================================================================
// Style Modification Examples
// =============================================================================

/**
 * Example prompts for style modifications.
 */
export const styleModificationExamples: ExamplePrompt[] = [
  {
    id: 'style-button-variants',
    title: 'Button Style Variants',
    category: 'style',
    difficulty: 'beginner',
    prompt: 'Create button style variants: primary (filled with brand color), secondary (outlined), ghost (text only with hover background), danger (red for destructive actions), and disabled state. Include hover, active, and focus states for each.',
    description: 'Creates a complete button component style system.',
    expectedResult: 'Button styles for primary, secondary, ghost, danger variants with all states.',
    tags: ['button', 'variants', 'states', 'interactive', 'components'],
    relatedPrompts: ['style-form-inputs', 'style-card-shadows'],
  },
  {
    id: 'style-card-shadows',
    title: 'Card Shadow System',
    category: 'style',
    difficulty: 'beginner',
    prompt: 'Create a card shadow system with 5 elevation levels: flat (no shadow), raised (subtle), floating (medium), overlay (prominent), and modal (heavy). Include smooth transitions between levels on hover.',
    description: 'Creates a consistent elevation system for cards and surfaces.',
    expectedResult: 'Five shadow elevation levels with hover transitions.',
    tags: ['shadow', 'elevation', 'cards', 'depth', 'surfaces'],
    relatedPrompts: ['style-glassmorphism', 'style-button-variants'],
  },
  {
    id: 'style-typography-scale',
    title: 'Typography Scale',
    category: 'style',
    difficulty: 'intermediate',
    prompt: 'Create a typography scale with: display (48px), h1 (36px), h2 (30px), h3 (24px), h4 (20px), body (16px), small (14px), and caption (12px). Include line heights, letter spacing, and font weights for each level.',
    description: 'Creates a harmonious type scale for consistent text styling.',
    expectedResult: 'Complete typography scale with sizes, line heights, and spacing.',
    tags: ['typography', 'fonts', 'headings', 'text', 'scale'],
    relatedPrompts: ['style-button-variants', 'theme-modern-minimal'],
  },
  {
    id: 'style-form-inputs',
    title: 'Form Input Styling',
    category: 'style',
    difficulty: 'intermediate',
    prompt: 'Style form inputs with: default state (gray border), focus state (brand color border with ring), error state (red border with error message), disabled state (grayed out), and filled state. Include labels, helper text, and icons styling.',
    description: 'Creates comprehensive form input styling with all states.',
    expectedResult: 'Form inputs with default, focus, error, disabled, and filled states.',
    tags: ['form', 'input', 'validation', 'states', 'fields'],
    relatedPrompts: ['style-button-variants', 'page-contact'],
  },
  {
    id: 'style-gradient-bg',
    title: 'Gradient Backgrounds',
    category: 'style',
    difficulty: 'intermediate',
    prompt: 'Create gradient background styles: linear gradient from top-left, radial gradient from center, mesh gradient effect, animated gradient that shifts colors, and a gradient overlay for images. Use the brand color palette.',
    description: 'Creates various gradient background effects.',
    expectedResult: 'Multiple gradient styles: linear, radial, mesh, animated, and overlay.',
    tags: ['gradient', 'background', 'colors', 'effects', 'visual'],
    relatedPrompts: ['theme-playful-brand', 'style-glassmorphism'],
  },
  {
    id: 'style-glassmorphism',
    title: 'Glassmorphism Effect',
    category: 'style',
    difficulty: 'advanced',
    prompt: 'Create a glassmorphism card style with: frosted glass background (backdrop-filter blur), semi-transparent white background, subtle border, and soft shadow. Ensure it works on both light and dark backgrounds.',
    description: 'Creates a modern frosted glass effect for cards.',
    expectedResult: 'Glassmorphism card with blur, transparency, border, and shadow.',
    tags: ['glass', 'blur', 'transparent', 'modern', 'effect'],
    relatedPrompts: ['style-card-shadows', 'theme-dark-mode'],
  },
  {
    id: 'style-responsive-spacing',
    title: 'Responsive Spacing System',
    category: 'style',
    difficulty: 'advanced',
    prompt: 'Create a responsive spacing system that scales from mobile to desktop: base unit 4px, with t-shirt sizes (xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px). Include responsive variants that increase spacing on larger screens.',
    description: 'Creates a scalable spacing system for consistent layouts.',
    expectedResult: 'Spacing scale with responsive variants for different screen sizes.',
    tags: ['spacing', 'responsive', 'layout', 'margins', 'padding'],
    relatedPrompts: ['style-typography-scale', 'style-card-shadows'],
  },
];

// =============================================================================
// Prompt Templates
// =============================================================================

/**
 * Reusable prompt templates with placeholders.
 */
export const promptTemplates: PromptTemplate[] = [
  {
    id: 'template-theme-basic',
    name: 'Basic Theme Creation',
    category: 'theme',
    template: 'Create a {{style}} theme with {{primary_color}} as the primary color, {{secondary_color}} as secondary, and {{background}} backgrounds. Use {{font}} for typography. The overall feel should be {{mood}}.',
    placeholders: [
      { name: 'style', description: 'Visual style', example: 'modern minimal' },
      { name: 'primary_color', description: 'Main brand color', example: '#2563EB' },
      { name: 'secondary_color', description: 'Accent color', example: '#10B981' },
      { name: 'background', description: 'Background style', example: 'clean white' },
      { name: 'font', description: 'Typography choice', example: 'Inter' },
      { name: 'mood', description: 'Emotional tone', example: 'professional and trustworthy' },
    ],
    instructions: 'Fill in each placeholder with your specific requirements. Be descriptive with colors (use hex codes) and mood.',
  },
  {
    id: 'template-page-section',
    name: 'Page Section Addition',
    category: 'page',
    template: 'Add a {{section_type}} section to the page with {{columns}} columns. Include {{elements}}. The section should have {{background}} background and {{spacing}} spacing.',
    placeholders: [
      { name: 'section_type', description: 'Type of section', example: 'features' },
      { name: 'columns', description: 'Number of columns', example: '3' },
      { name: 'elements', description: 'Content elements', example: 'icon, title, and description for each feature' },
      { name: 'background', description: 'Background style', example: 'light gray' },
      { name: 'spacing', description: 'Vertical spacing', example: 'generous' },
    ],
    instructions: 'Specify the section type and its content. Be explicit about the number of items and their structure.',
  },
  {
    id: 'template-component-style',
    name: 'Component Styling',
    category: 'style',
    template: 'Style the {{component}} component with {{border}} borders, {{shadow}} shadow, {{radius}} border radius, and {{padding}} padding. On hover, apply {{hover_effect}}.',
    placeholders: [
      { name: 'component', description: 'Component to style', example: 'card' },
      { name: 'border', description: 'Border style', example: '1px solid gray' },
      { name: 'shadow', description: 'Shadow intensity', example: 'subtle' },
      { name: 'radius', description: 'Corner rounding', example: '8px' },
      { name: 'padding', description: 'Internal spacing', example: '24px' },
      { name: 'hover_effect', description: 'Hover interaction', example: 'lift with increased shadow' },
    ],
    instructions: 'Describe the visual properties and interactive states for the component.',
  },
  {
    id: 'template-color-scheme',
    name: 'Color Scheme Generation',
    category: 'theme',
    template: 'Generate a {{scheme_type}} color scheme starting from {{base_color}}. Include {{num_colors}} colors for: primary, secondary, accent, success, warning, error, and {{num_neutrals}} neutral shades.',
    placeholders: [
      { name: 'scheme_type', description: 'Type of color harmony', example: 'complementary' },
      { name: 'base_color', description: 'Starting color', example: '#3B82F6' },
      { name: 'num_colors', description: 'Semantic colors count', example: '6' },
      { name: 'num_neutrals', description: 'Neutral shades count', example: '10' },
    ],
    instructions: 'Specify the color harmony type (complementary, analogous, triadic) and your base brand color.',
  },
];

// =============================================================================
// Complete Library
// =============================================================================

/**
 * Complete prompt library.
 */
export const PROMPT_LIBRARY: PromptLibrary = {
  version: '1.0.0',
  examples: [
    ...themeCreationExamples,
    ...pageAdditionExamples,
    ...styleModificationExamples,
  ],
  templates: promptTemplates,
};

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Gets all example prompts.
 */
export function getAllExamples(): ExamplePrompt[] {
  return PROMPT_LIBRARY.examples;
}

/**
 * Gets an example by ID.
 */
export function getExampleById(id: string): ExamplePrompt | undefined {
  return PROMPT_LIBRARY.examples.find((e) => e.id === id);
}

/**
 * Gets examples by category.
 */
export function getExamplesByCategory(category: PromptCategory): ExamplePrompt[] {
  return PROMPT_LIBRARY.examples.filter((e) => e.category === category);
}

/**
 * Gets examples by difficulty level.
 */
export function getExamplesByDifficulty(difficulty: DifficultyLevel): ExamplePrompt[] {
  return PROMPT_LIBRARY.examples.filter((e) => e.difficulty === difficulty);
}

/**
 * Searches examples by tag.
 */
export function searchByTag(tag: string): ExamplePrompt[] {
  const lower = tag.toLowerCase();
  return PROMPT_LIBRARY.examples.filter((e) =>
    e.tags.some((t) => t.toLowerCase().includes(lower)),
  );
}

/**
 * Searches examples by keyword in title, description, or prompt.
 */
export function searchExamples(query: string): ExamplePrompt[] {
  const lower = query.toLowerCase();
  return PROMPT_LIBRARY.examples.filter((e) =>
    e.title.toLowerCase().includes(lower) ||
    e.description.toLowerCase().includes(lower) ||
    e.prompt.toLowerCase().includes(lower),
  );
}

/**
 * Gets related examples for a given example.
 */
export function getRelatedExamples(exampleId: string): ExamplePrompt[] {
  const example = getExampleById(exampleId);
  if (!example || !example.relatedPrompts) return [];
  return example.relatedPrompts
    .map((id) => getExampleById(id))
    .filter((e): e is ExamplePrompt => e !== undefined);
}

/**
 * Gets all templates.
 */
export function getAllTemplates(): PromptTemplate[] {
  return PROMPT_LIBRARY.templates;
}

/**
 * Gets a template by ID.
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_LIBRARY.templates.find((t) => t.id === id);
}

/**
 * Gets templates by category.
 */
export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return PROMPT_LIBRARY.templates.filter((t) => t.category === category);
}

// =============================================================================
// Template Functions
// =============================================================================

/**
 * Fills a template with provided values.
 */
export function fillTemplate(
  templateId: string,
  values: Record<string, string>,
): string | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  let result = template.template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Gets unfilled placeholders in a template.
 */
export function getUnfilledPlaceholders(
  templateId: string,
  values: Record<string, string>,
): string[] {
  const template = getTemplateById(templateId);
  if (!template) return [];

  return template.placeholders
    .filter((p) => !values[p.name])
    .map((p) => p.name);
}

/**
 * Validates that all required placeholders are filled.
 */
export function validateTemplateValues(
  templateId: string,
  values: Record<string, string>,
): { valid: boolean; missing: string[] } {
  const missing = getUnfilledPlaceholders(templateId, values);
  return {
    valid: missing.length === 0,
    missing,
  };
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats an example as markdown.
 */
export function formatExampleAsMarkdown(example: ExamplePrompt): string {
  const lines: string[] = [];

  lines.push(`## ${example.title}`);
  lines.push('');
  lines.push(`**Category:** ${example.category} | **Difficulty:** ${example.difficulty}`);
  lines.push('');
  lines.push('### Prompt');
  lines.push('```');
  lines.push(example.prompt);
  lines.push('```');
  lines.push('');
  lines.push('### Description');
  lines.push(example.description);
  lines.push('');
  lines.push('### Expected Result');
  lines.push(example.expectedResult);
  lines.push('');
  lines.push('### Tags');
  lines.push(example.tags.map((t) => `\`${t}\``).join(', '));

  if (example.relatedPrompts && example.relatedPrompts.length > 0) {
    lines.push('');
    lines.push('### Related');
    lines.push(example.relatedPrompts.join(', '));
  }

  return lines.join('\n');
}

/**
 * Formats a template as markdown.
 */
export function formatTemplateAsMarkdown(template: PromptTemplate): string {
  const lines: string[] = [];

  lines.push(`## ${template.name}`);
  lines.push('');
  lines.push(`**Category:** ${template.category}`);
  lines.push('');
  lines.push('### Template');
  lines.push('```');
  lines.push(template.template);
  lines.push('```');
  lines.push('');
  lines.push('### Placeholders');
  lines.push('');
  lines.push('| Name | Description | Example |');
  lines.push('|------|-------------|---------|');
  for (const p of template.placeholders) {
    lines.push(`| ${p.name} | ${p.description} | ${p.example} |`);
  }
  lines.push('');
  lines.push('### Instructions');
  lines.push(template.instructions);

  return lines.join('\n');
}

/**
 * Formats the entire library as markdown.
 */
export function formatLibraryAsMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Prompt Library');
  lines.push('');
  lines.push(`Version: ${PROMPT_LIBRARY.version}`);
  lines.push('');

  lines.push('## Table of Contents');
  lines.push('');
  lines.push('### Theme Creation');
  for (const ex of themeCreationExamples) {
    lines.push(`- [${ex.title}](#${ex.id})`);
  }
  lines.push('');
  lines.push('### Page Addition');
  for (const ex of pageAdditionExamples) {
    lines.push(`- [${ex.title}](#${ex.id})`);
  }
  lines.push('');
  lines.push('### Style Modification');
  for (const ex of styleModificationExamples) {
    lines.push(`- [${ex.title}](#${ex.id})`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('# Theme Creation Examples');
  lines.push('');
  for (const ex of themeCreationExamples) {
    lines.push(formatExampleAsMarkdown(ex));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('# Page Addition Examples');
  lines.push('');
  for (const ex of pageAdditionExamples) {
    lines.push(formatExampleAsMarkdown(ex));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('# Style Modification Examples');
  lines.push('');
  for (const ex of styleModificationExamples) {
    lines.push(formatExampleAsMarkdown(ex));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('# Templates');
  lines.push('');
  for (const tmpl of promptTemplates) {
    lines.push(formatTemplateAsMarkdown(tmpl));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats example as compact string.
 */
export function formatExampleCompact(example: ExamplePrompt): string {
  const difficultyIcon = {
    beginner: '🟢',
    intermediate: '🟡',
    advanced: '🔴',
  };
  return `${difficultyIcon[example.difficulty]} [${example.category}] ${example.title}`;
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Library statistics.
 */
export interface LibraryStats {
  /** Total examples */
  totalExamples: number;
  /** Examples by category */
  byCategory: Record<PromptCategory, number>;
  /** Examples by difficulty */
  byDifficulty: Record<DifficultyLevel, number>;
  /** Total templates */
  totalTemplates: number;
  /** All unique tags */
  allTags: string[];
}

/**
 * Computes library statistics.
 */
export function computeLibraryStats(): LibraryStats {
  const examples = getAllExamples();

  const byCategory: Record<PromptCategory, number> = {
    theme: 0,
    page: 0,
    style: 0,
    component: 0,
    layout: 0,
    animation: 0,
  };

  const byDifficulty: Record<DifficultyLevel, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  };

  const allTags = new Set<string>();

  for (const example of examples) {
    byCategory[example.category]++;
    byDifficulty[example.difficulty]++;
    for (const tag of example.tags) {
      allTags.add(tag);
    }
  }

  return {
    totalExamples: examples.length,
    byCategory,
    byDifficulty,
    totalTemplates: PROMPT_LIBRARY.templates.length,
    allTags: [...allTags].sort(),
  };
}

// =============================================================================
// Recommendation Functions
// =============================================================================

/**
 * Gets recommended examples for beginners.
 */
export function getBeginnerRecommendations(): ExamplePrompt[] {
  return getExamplesByDifficulty('beginner').slice(0, 5);
}

/**
 * Gets examples similar to a given example based on tags.
 */
export function getSimilarExamples(exampleId: string, limit: number = 3): ExamplePrompt[] {
  const example = getExampleById(exampleId);
  if (!example) return [];

  const others = getAllExamples().filter((e) => e.id !== exampleId);
  const scored = others.map((e) => ({
    example: e,
    score: e.tags.filter((t) => example.tags.includes(t)).length,
  }));

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.example);
}
