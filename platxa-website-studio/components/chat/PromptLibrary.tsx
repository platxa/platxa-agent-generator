'use client';

import React, { useState, useMemo, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type PromptCategory =
  | 'layout'
  | 'styling'
  | 'components'
  | 'content'
  | 'responsive'
  | 'animations'
  | 'seo'
  | 'accessibility'
  | 'performance'
  | 'custom';

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: PromptCategory;
  tags: string[];
  variables?: PromptVariable[];
  popularity?: number;
  isCustom?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PromptVariable {
  name: string;
  description: string;
  defaultValue?: string;
  type: 'text' | 'select' | 'color' | 'number';
  options?: string[];
  required?: boolean;
}

export interface PromptLibraryProps {
  onSelectPrompt: (prompt: string) => void;
  onInsertPrompt?: (prompt: string) => void;
  customPrompts?: PromptTemplate[];
  onSaveCustomPrompt?: (prompt: PromptTemplate) => void;
  onDeleteCustomPrompt?: (promptId: string) => void;
  recentPrompts?: string[];
  className?: string;
  defaultCategory?: PromptCategory;
  showRecent?: boolean;
  maxRecent?: number;
  compact?: boolean;
}

export interface CategoryInfo {
  id: PromptCategory;
  label: string;
  icon: string;
  description: string;
}

// ============================================================================
// Category Configuration
// ============================================================================

export const PROMPT_CATEGORIES: CategoryInfo[] = [
  {
    id: 'layout',
    label: 'Layout',
    icon: '📐',
    description: 'Page structure, grids, and positioning',
  },
  {
    id: 'styling',
    label: 'Styling',
    icon: '🎨',
    description: 'Colors, typography, and visual design',
  },
  {
    id: 'components',
    label: 'Components',
    icon: '🧩',
    description: 'UI elements and interactive widgets',
  },
  {
    id: 'content',
    label: 'Content',
    icon: '📝',
    description: 'Text, images, and media',
  },
  {
    id: 'responsive',
    label: 'Responsive',
    icon: '📱',
    description: 'Mobile and tablet adaptations',
  },
  {
    id: 'animations',
    label: 'Animations',
    icon: '✨',
    description: 'Transitions and motion effects',
  },
  {
    id: 'seo',
    label: 'SEO',
    icon: '🔍',
    description: 'Search optimization and metadata',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: '♿',
    description: 'A11y improvements and compliance',
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: '⚡',
    description: 'Speed and optimization',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '⭐',
    description: 'Your saved prompts',
  },
];

// ============================================================================
// Default Prompt Templates
// ============================================================================

export const DEFAULT_PROMPTS: PromptTemplate[] = [
  // Layout
  {
    id: 'layout-hero',
    title: 'Hero Section',
    description: 'Create a full-width hero section with headline and CTA',
    prompt: 'Create a hero section with a large headline, subtext, and a call-to-action button. Use a gradient background.',
    category: 'layout',
    tags: ['hero', 'landing', 'header'],
    popularity: 95,
  },
  {
    id: 'layout-grid',
    title: 'Feature Grid',
    description: 'Create a responsive grid of feature cards',
    prompt: 'Create a 3-column responsive grid of feature cards. Each card should have an icon, title, and description.',
    category: 'layout',
    tags: ['grid', 'features', 'cards'],
    variables: [
      { name: 'columns', description: 'Number of columns', type: 'select', options: ['2', '3', '4'], defaultValue: '3' },
    ],
    popularity: 88,
  },
  {
    id: 'layout-two-column',
    title: 'Two Column Layout',
    description: 'Split content into two columns',
    prompt: 'Create a two-column layout with text on the left and an image on the right. Make it stack on mobile.',
    category: 'layout',
    tags: ['columns', 'split', 'responsive'],
    popularity: 82,
  },
  {
    id: 'layout-footer',
    title: 'Footer with Links',
    description: 'Create a multi-column footer',
    prompt: 'Create a footer with 4 columns of links, a logo, and social media icons. Include a copyright notice.',
    category: 'layout',
    tags: ['footer', 'navigation', 'links'],
    popularity: 75,
  },
  {
    id: 'layout-sidebar',
    title: 'Sidebar Layout',
    description: 'Main content with fixed sidebar',
    prompt: 'Create a layout with a fixed sidebar navigation on the left and scrollable main content on the right.',
    category: 'layout',
    tags: ['sidebar', 'navigation', 'dashboard'],
    popularity: 70,
  },

  // Styling
  {
    id: 'styling-dark-mode',
    title: 'Dark Mode Theme',
    description: 'Apply dark mode styling',
    prompt: 'Convert this section to dark mode with a dark background, light text, and appropriate contrast.',
    category: 'styling',
    tags: ['dark', 'theme', 'colors'],
    popularity: 92,
  },
  {
    id: 'styling-gradient',
    title: 'Gradient Background',
    description: 'Add gradient backgrounds',
    prompt: 'Add a beautiful gradient background that transitions from {{startColor}} to {{endColor}}.',
    category: 'styling',
    tags: ['gradient', 'background', 'colors'],
    variables: [
      { name: 'startColor', description: 'Starting color', type: 'color', defaultValue: '#667eea' },
      { name: 'endColor', description: 'Ending color', type: 'color', defaultValue: '#764ba2' },
    ],
    popularity: 85,
  },
  {
    id: 'styling-shadows',
    title: 'Add Shadows',
    description: 'Apply box shadows for depth',
    prompt: 'Add subtle box shadows to the cards to give them depth and make them stand out from the background.',
    category: 'styling',
    tags: ['shadows', 'depth', '3d'],
    popularity: 78,
  },
  {
    id: 'styling-typography',
    title: 'Typography Update',
    description: 'Improve text styling',
    prompt: 'Update the typography to use a modern font pairing. Use a bold sans-serif for headings and readable serif for body.',
    category: 'styling',
    tags: ['fonts', 'text', 'typography'],
    popularity: 72,
  },
  {
    id: 'styling-glassmorphism',
    title: 'Glassmorphism Effect',
    description: 'Apply glass-like styling',
    prompt: 'Apply a glassmorphism effect with blur, transparency, and a subtle border. Use backdrop-filter.',
    category: 'styling',
    tags: ['glass', 'blur', 'modern'],
    popularity: 68,
  },

  // Components
  {
    id: 'components-navbar',
    title: 'Navigation Bar',
    description: 'Create a responsive navbar',
    prompt: 'Create a navigation bar with logo, menu links, and a hamburger menu for mobile. Make it sticky on scroll.',
    category: 'components',
    tags: ['navbar', 'navigation', 'menu'],
    popularity: 94,
  },
  {
    id: 'components-card',
    title: 'Card Component',
    description: 'Create a versatile card',
    prompt: 'Create a card component with image, title, description, tags, and action buttons. Add hover effects.',
    category: 'components',
    tags: ['card', 'ui', 'widget'],
    popularity: 90,
  },
  {
    id: 'components-form',
    title: 'Contact Form',
    description: 'Create a contact form',
    prompt: 'Create a contact form with name, email, subject, and message fields. Include validation and a submit button.',
    category: 'components',
    tags: ['form', 'contact', 'input'],
    popularity: 86,
  },
  {
    id: 'components-testimonial',
    title: 'Testimonial Slider',
    description: 'Create testimonial carousel',
    prompt: 'Create a testimonial section with customer quotes, photos, names, and company. Add navigation arrows.',
    category: 'components',
    tags: ['testimonial', 'slider', 'reviews'],
    popularity: 80,
  },
  {
    id: 'components-pricing',
    title: 'Pricing Table',
    description: 'Create pricing comparison',
    prompt: 'Create a pricing table with 3 tiers: Basic, Pro, and Enterprise. Highlight the recommended plan.',
    category: 'components',
    tags: ['pricing', 'table', 'comparison'],
    popularity: 76,
  },
  {
    id: 'components-modal',
    title: 'Modal Dialog',
    description: 'Create a modal popup',
    prompt: 'Create a modal dialog with overlay, close button, title, content area, and action buttons.',
    category: 'components',
    tags: ['modal', 'dialog', 'popup'],
    popularity: 74,
  },

  // Content
  {
    id: 'content-placeholder',
    title: 'Add Placeholder Content',
    description: 'Generate placeholder text and images',
    prompt: 'Add realistic placeholder content with proper headings, paragraphs, and placeholder images.',
    category: 'content',
    tags: ['placeholder', 'lorem', 'dummy'],
    popularity: 70,
  },
  {
    id: 'content-cta',
    title: 'Call to Action',
    description: 'Create a CTA section',
    prompt: 'Create a compelling call-to-action section with a headline, brief text, and prominent button.',
    category: 'content',
    tags: ['cta', 'conversion', 'button'],
    popularity: 84,
  },
  {
    id: 'content-faq',
    title: 'FAQ Section',
    description: 'Create expandable FAQ',
    prompt: 'Create an FAQ section with expandable accordion items. Include at least 5 common questions.',
    category: 'content',
    tags: ['faq', 'accordion', 'questions'],
    popularity: 72,
  },
  {
    id: 'content-stats',
    title: 'Statistics Section',
    description: 'Display key metrics',
    prompt: 'Create a statistics section showing 4 key metrics with large numbers, labels, and icons.',
    category: 'content',
    tags: ['stats', 'numbers', 'metrics'],
    popularity: 68,
  },

  // Responsive
  {
    id: 'responsive-mobile',
    title: 'Mobile Optimization',
    description: 'Optimize for mobile devices',
    prompt: 'Optimize this section for mobile devices. Adjust spacing, font sizes, and stack elements vertically.',
    category: 'responsive',
    tags: ['mobile', 'phone', 'touch'],
    popularity: 88,
  },
  {
    id: 'responsive-tablet',
    title: 'Tablet Layout',
    description: 'Adjust for tablet screens',
    prompt: 'Create a tablet-optimized layout that works well between 768px and 1024px screen widths.',
    category: 'responsive',
    tags: ['tablet', 'ipad', 'medium'],
    popularity: 65,
  },
  {
    id: 'responsive-breakpoints',
    title: 'Add Breakpoints',
    description: 'Create responsive breakpoints',
    prompt: 'Add responsive breakpoints for mobile (320px), tablet (768px), and desktop (1024px+).',
    category: 'responsive',
    tags: ['breakpoints', 'media', 'queries'],
    popularity: 75,
  },

  // Animations
  {
    id: 'animations-fade-in',
    title: 'Fade In Animation',
    description: 'Add fade-in on scroll',
    prompt: 'Add a smooth fade-in animation that triggers when elements scroll into view.',
    category: 'animations',
    tags: ['fade', 'scroll', 'reveal'],
    popularity: 82,
  },
  {
    id: 'animations-hover',
    title: 'Hover Effects',
    description: 'Add interactive hover states',
    prompt: 'Add smooth hover effects to buttons and cards. Include scale, shadow, and color transitions.',
    category: 'animations',
    tags: ['hover', 'transition', 'interactive'],
    popularity: 86,
  },
  {
    id: 'animations-loading',
    title: 'Loading Spinner',
    description: 'Create loading animation',
    prompt: 'Create a smooth loading spinner animation with a modern design.',
    category: 'animations',
    tags: ['loading', 'spinner', 'wait'],
    popularity: 70,
  },
  {
    id: 'animations-parallax',
    title: 'Parallax Effect',
    description: 'Add parallax scrolling',
    prompt: 'Add a parallax scrolling effect to the background image that moves slower than the content.',
    category: 'animations',
    tags: ['parallax', 'scroll', 'depth'],
    popularity: 65,
  },

  // SEO
  {
    id: 'seo-meta',
    title: 'Meta Tags',
    description: 'Add SEO meta tags',
    prompt: 'Add proper SEO meta tags including title, description, keywords, and Open Graph tags.',
    category: 'seo',
    tags: ['meta', 'tags', 'social'],
    popularity: 78,
  },
  {
    id: 'seo-headings',
    title: 'Heading Structure',
    description: 'Fix heading hierarchy',
    prompt: 'Review and fix the heading structure to ensure proper H1-H6 hierarchy for SEO.',
    category: 'seo',
    tags: ['headings', 'h1', 'structure'],
    popularity: 72,
  },
  {
    id: 'seo-schema',
    title: 'Schema Markup',
    description: 'Add structured data',
    prompt: 'Add JSON-LD schema markup for better search engine understanding of the content.',
    category: 'seo',
    tags: ['schema', 'json-ld', 'structured'],
    popularity: 60,
  },

  // Accessibility
  {
    id: 'a11y-contrast',
    title: 'Fix Contrast',
    description: 'Improve color contrast',
    prompt: 'Review and fix color contrast issues to meet WCAG AA standards (4.5:1 for text).',
    category: 'accessibility',
    tags: ['contrast', 'wcag', 'colors'],
    popularity: 76,
  },
  {
    id: 'a11y-alt-text',
    title: 'Add Alt Text',
    description: 'Add image descriptions',
    prompt: 'Add descriptive alt text to all images for screen reader users.',
    category: 'accessibility',
    tags: ['alt', 'images', 'screen-reader'],
    popularity: 80,
  },
  {
    id: 'a11y-keyboard',
    title: 'Keyboard Navigation',
    description: 'Improve keyboard access',
    prompt: 'Ensure all interactive elements are keyboard accessible with visible focus states.',
    category: 'accessibility',
    tags: ['keyboard', 'focus', 'navigation'],
    popularity: 70,
  },
  {
    id: 'a11y-aria',
    title: 'Add ARIA Labels',
    description: 'Improve screen reader support',
    prompt: 'Add appropriate ARIA labels, roles, and landmarks to improve screen reader navigation.',
    category: 'accessibility',
    tags: ['aria', 'labels', 'roles'],
    popularity: 65,
  },

  // Performance
  {
    id: 'perf-images',
    title: 'Optimize Images',
    description: 'Improve image loading',
    prompt: 'Optimize images with lazy loading, proper sizing, and modern formats (WebP).',
    category: 'performance',
    tags: ['images', 'lazy', 'webp'],
    popularity: 84,
  },
  {
    id: 'perf-fonts',
    title: 'Optimize Fonts',
    description: 'Improve font loading',
    prompt: 'Optimize font loading with font-display: swap and preload critical fonts.',
    category: 'performance',
    tags: ['fonts', 'preload', 'loading'],
    popularity: 68,
  },
  {
    id: 'perf-critical-css',
    title: 'Critical CSS',
    description: 'Inline critical styles',
    prompt: 'Identify and inline critical CSS for above-the-fold content to improve initial render.',
    category: 'performance',
    tags: ['css', 'critical', 'inline'],
    popularity: 55,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function interpolateVariables(
  prompt: string,
  variables: Record<string, string>
): string {
  let result = prompt;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function getCategoryIcon(categoryId: PromptCategory): string {
  return PROMPT_CATEGORIES.find((c) => c.id === categoryId)?.icon || '📌';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface CategoryTabsProps {
  categories: CategoryInfo[];
  selectedCategory: PromptCategory | 'all' | 'recent';
  onSelectCategory: (category: PromptCategory | 'all' | 'recent') => void;
  showRecent: boolean;
  compact?: boolean;
}

function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
  showRecent,
  compact,
}: CategoryTabsProps) {
  return (
    <div className={`prompt-library-tabs ${compact ? 'compact' : ''}`}>
      {showRecent && (
        <button
          className={`tab ${selectedCategory === 'recent' ? 'active' : ''}`}
          onClick={() => onSelectCategory('recent')}
        >
          🕐 Recent
        </button>
      )}
      <button
        className={`tab ${selectedCategory === 'all' ? 'active' : ''}`}
        onClick={() => onSelectCategory('all')}
      >
        📋 All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          className={`tab ${selectedCategory === category.id ? 'active' : ''}`}
          onClick={() => onSelectCategory(category.id)}
          title={category.description}
        >
          {category.icon} {!compact && category.label}
        </button>
      ))}
    </div>
  );
}

interface PromptCardProps {
  template: PromptTemplate;
  onSelect: (prompt: string) => void;
  onInsert?: (prompt: string) => void;
  onDelete?: (promptId: string) => void;
  compact?: boolean;
}

function PromptCard({
  template,
  onSelect,
  onInsert,
  onDelete,
  compact,
}: PromptCardProps) {
  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    template.variables?.forEach((v) => {
      initial[v.name] = v.defaultValue || '';
    });
    return initial;
  });
  const [showVariables, setShowVariables] = useState(false);

  const finalPrompt = useMemo(() => {
    return interpolateVariables(template.prompt, variables);
  }, [template.prompt, variables]);

  const handleSelect = useCallback(() => {
    if (template.variables && template.variables.length > 0 && !showVariables) {
      setShowVariables(true);
    } else {
      onSelect(finalPrompt);
    }
  }, [template.variables, showVariables, onSelect, finalPrompt]);

  const handleInsert = useCallback(() => {
    onInsert?.(finalPrompt);
  }, [onInsert, finalPrompt]);

  return (
    <div className={`prompt-card ${compact ? 'compact' : ''}`}>
      <div className="prompt-card-header">
        <span className="prompt-card-icon">{getCategoryIcon(template.category)}</span>
        <h4 className="prompt-card-title">{template.title}</h4>
        {template.isCustom && onDelete && (
          <button
            className="prompt-card-delete"
            onClick={() => onDelete(template.id)}
            title="Delete custom prompt"
          >
            ✕
          </button>
        )}
      </div>

      {!compact && (
        <p className="prompt-card-description">{template.description}</p>
      )}

      {!compact && template.tags.length > 0 && (
        <div className="prompt-card-tags">
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="prompt-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {showVariables && template.variables && (
        <div className="prompt-card-variables">
          {template.variables.map((variable) => (
            <div key={variable.name} className="prompt-variable">
              <label>{variable.description}</label>
              {variable.type === 'select' ? (
                <select
                  value={variables[variable.name] || ''}
                  onChange={(e) =>
                    setVariables((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                >
                  {variable.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : variable.type === 'color' ? (
                <input
                  type="color"
                  value={variables[variable.name] || '#000000'}
                  onChange={(e) =>
                    setVariables((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                />
              ) : variable.type === 'number' ? (
                <input
                  type="number"
                  value={variables[variable.name] || ''}
                  onChange={(e) =>
                    setVariables((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                />
              ) : (
                <input
                  type="text"
                  value={variables[variable.name] || ''}
                  onChange={(e) =>
                    setVariables((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                  placeholder={variable.defaultValue}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="prompt-card-actions">
        <button className="prompt-card-btn primary" onClick={handleSelect}>
          {showVariables ? 'Use Prompt' : 'Select'}
        </button>
        {onInsert && (
          <button className="prompt-card-btn secondary" onClick={handleInsert}>
            Insert
          </button>
        )}
      </div>

      {!compact && (
        <div className="prompt-card-preview">
          <code>{finalPrompt.slice(0, 80)}...</code>
        </div>
      )}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="prompt-library-search">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search prompts...'}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  );
}

interface CreatePromptFormProps {
  onSave: (prompt: PromptTemplate) => void;
  onCancel: () => void;
}

function CreatePromptForm({ onSave, onCancel }: CreatePromptFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<PromptCategory>('custom');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    const newPrompt: PromptTemplate = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      prompt: prompt.trim(),
      category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      isCustom: true,
      createdAt: new Date(),
    };

    onSave(newPrompt);
  };

  return (
    <form className="create-prompt-form" onSubmit={handleSubmit}>
      <h3>Create Custom Prompt</h3>

      <div className="form-field">
        <label>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My custom prompt"
          required
        />
      </div>

      <div className="form-field">
        <label>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this prompt do?"
        />
      </div>

      <div className="form-field">
        <label>Prompt *</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt template..."
          rows={4}
          required
        />
      </div>

      <div className="form-field">
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)}>
          {PROMPT_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2, tag3"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save Prompt
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PromptLibrary({
  onSelectPrompt,
  onInsertPrompt,
  customPrompts = [],
  onSaveCustomPrompt,
  onDeleteCustomPrompt,
  recentPrompts = [],
  className = '',
  defaultCategory = 'layout',
  showRecent = true,
  maxRecent = 5,
  compact = false,
}: PromptLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all' | 'recent'>(
    showRecent && recentPrompts.length > 0 ? 'recent' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Combine default and custom prompts
  const allPrompts = useMemo(() => {
    return [...DEFAULT_PROMPTS, ...customPrompts];
  }, [customPrompts]);

  // Filter prompts based on category and search
  const filteredPrompts = useMemo(() => {
    let results = allPrompts;

    // Filter by category
    if (selectedCategory !== 'all' && selectedCategory !== 'recent') {
      results = results.filter((p) => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.prompt.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Sort by popularity
    return results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [allPrompts, selectedCategory, searchQuery]);

  // Recent prompts display
  const recentPromptItems = useMemo(() => {
    if (selectedCategory !== 'recent') return [];
    return recentPrompts.slice(0, maxRecent).map((prompt, index) => ({
      id: `recent-${index}`,
      title: `Recent: ${prompt.slice(0, 30)}...`,
      description: prompt,
      prompt,
      category: 'custom' as PromptCategory,
      tags: ['recent'],
    }));
  }, [selectedCategory, recentPrompts, maxRecent]);

  const handleSaveCustomPrompt = useCallback(
    (prompt: PromptTemplate) => {
      onSaveCustomPrompt?.(prompt);
      setShowCreateForm(false);
    },
    [onSaveCustomPrompt]
  );

  const displayPrompts = selectedCategory === 'recent' ? recentPromptItems : filteredPrompts;

  return (
    <div className={`prompt-library ${compact ? 'compact' : ''} ${className}`}>
      <div className="prompt-library-header">
        <h3>Prompt Library</h3>
        {onSaveCustomPrompt && (
          <button
            className="create-prompt-btn"
            onClick={() => setShowCreateForm(true)}
          >
            + Create
          </button>
        )}
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search prompts..."
      />

      <CategoryTabs
        categories={PROMPT_CATEGORIES}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        showRecent={showRecent && recentPrompts.length > 0}
        compact={compact}
      />

      {showCreateForm && onSaveCustomPrompt ? (
        <CreatePromptForm
          onSave={handleSaveCustomPrompt}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <div className="prompt-library-grid">
          {displayPrompts.length === 0 ? (
            <div className="prompt-library-empty">
              <p>No prompts found</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>Clear search</button>
              )}
            </div>
          ) : (
            displayPrompts.map((template) => (
              <PromptCard
                key={template.id}
                template={template}
                onSelect={onSelectPrompt}
                onInsert={onInsertPrompt}
                onDelete={template.isCustom ? onDeleteCustomPrompt : undefined}
                compact={compact}
              />
            ))
          )}
        </div>
      )}

      <style jsx>{`
        .prompt-library {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          background: var(--bg-primary, #fff);
          border-radius: 12px;
          max-height: 600px;
          overflow: hidden;
        }

        .prompt-library.compact {
          padding: 12px;
          gap: 12px;
        }

        .prompt-library-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .prompt-library-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .create-prompt-btn {
          padding: 6px 12px;
          font-size: 13px;
          background: var(--accent, #4f46e5);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .create-prompt-btn:hover {
          opacity: 0.9;
        }

        .prompt-library-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px;
        }

        .search-icon {
          font-size: 14px;
          opacity: 0.5;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          outline: none;
        }

        .search-clear {
          padding: 2px 6px;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
        }

        .search-clear:hover {
          opacity: 1;
        }

        .prompt-library-tabs {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .prompt-library-tabs.compact {
          flex-wrap: wrap;
        }

        .tab {
          padding: 6px 12px;
          font-size: 13px;
          background: var(--bg-secondary, #f5f5f5);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .tab:hover {
          background: var(--bg-tertiary, #e5e5e5);
        }

        .tab.active {
          background: var(--accent, #4f46e5);
          color: white;
        }

        .prompt-library-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .prompt-library.compact .prompt-library-grid {
          grid-template-columns: 1fr;
        }

        .prompt-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: var(--bg-secondary, #f9f9f9);
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .prompt-card:hover {
          border-color: var(--accent, #4f46e5);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .prompt-card.compact {
          padding: 8px 12px;
        }

        .prompt-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .prompt-card-icon {
          font-size: 16px;
        }

        .prompt-card-title {
          flex: 1;
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .prompt-card-delete {
          padding: 2px 6px;
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.4;
          font-size: 12px;
        }

        .prompt-card-delete:hover {
          opacity: 1;
          color: #ef4444;
        }

        .prompt-card-description {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary, #666);
          line-height: 1.4;
        }

        .prompt-card-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .prompt-card-tag {
          padding: 2px 6px;
          font-size: 11px;
          background: var(--bg-tertiary, #e5e5e5);
          border-radius: 4px;
          color: var(--text-secondary, #666);
        }

        .prompt-card-variables {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
          background: var(--bg-primary, #fff);
          border-radius: 6px;
        }

        .prompt-variable {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .prompt-variable label {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .prompt-variable input,
        .prompt-variable select {
          padding: 6px 8px;
          font-size: 13px;
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 4px;
          outline: none;
        }

        .prompt-variable input:focus,
        .prompt-variable select:focus {
          border-color: var(--accent, #4f46e5);
        }

        .prompt-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .prompt-card-btn {
          flex: 1;
          padding: 6px 12px;
          font-size: 13px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .prompt-card-btn.primary {
          background: var(--accent, #4f46e5);
          color: white;
        }

        .prompt-card-btn.primary:hover {
          opacity: 0.9;
        }

        .prompt-card-btn.secondary {
          background: var(--bg-tertiary, #e5e5e5);
          color: var(--text-primary, #333);
        }

        .prompt-card-btn.secondary:hover {
          background: var(--bg-quaternary, #d5d5d5);
        }

        .prompt-card-preview {
          padding: 6px 8px;
          background: var(--bg-primary, #fff);
          border-radius: 4px;
          font-size: 11px;
          color: var(--text-secondary, #888);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .prompt-card-preview code {
          font-family: monospace;
        }

        .prompt-library-empty {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: var(--text-secondary, #888);
        }

        .prompt-library-empty button {
          padding: 6px 12px;
          background: var(--bg-secondary, #f5f5f5);
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .create-prompt-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: var(--bg-secondary, #f9f9f9);
          border-radius: 8px;
        }

        .create-prompt-form h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-field label {
          font-size: 13px;
          font-weight: 500;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          padding: 8px 10px;
          font-size: 14px;
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 6px;
          outline: none;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: var(--accent, #4f46e5);
        }

        .form-field textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .btn-primary {
          padding: 8px 16px;
          background: var(--accent, #4f46e5);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-secondary {
          padding: 8px 16px;
          background: var(--bg-tertiary, #e5e5e5);
          color: var(--text-primary, #333);
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Hook for Managing Prompt Library State
// ============================================================================

export interface UsePromptLibraryOptions {
  storageKey?: string;
  defaultPrompts?: PromptTemplate[];
}

export interface UsePromptLibraryReturn {
  customPrompts: PromptTemplate[];
  recentPrompts: string[];
  addCustomPrompt: (prompt: PromptTemplate) => void;
  deleteCustomPrompt: (promptId: string) => void;
  addRecentPrompt: (prompt: string) => void;
  clearRecentPrompts: () => void;
  exportPrompts: () => string;
  importPrompts: (json: string) => void;
}

export function usePromptLibrary(
  options: UsePromptLibraryOptions = {}
): UsePromptLibraryReturn {
  const { storageKey = 'prompt-library', defaultPrompts = [] } = options;

  const [customPrompts, setCustomPrompts] = useState<PromptTemplate[]>(() => {
    if (typeof window === 'undefined') return defaultPrompts;
    try {
      const stored = localStorage.getItem(`${storageKey}-custom`);
      return stored ? JSON.parse(stored) : defaultPrompts;
    } catch {
      return defaultPrompts;
    }
  });

  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`${storageKey}-recent`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist custom prompts
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${storageKey}-custom`, JSON.stringify(customPrompts));
  }, [customPrompts, storageKey]);

  // Persist recent prompts
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${storageKey}-recent`, JSON.stringify(recentPrompts));
  }, [recentPrompts, storageKey]);

  const addCustomPrompt = useCallback((prompt: PromptTemplate) => {
    setCustomPrompts((prev) => [...prev, prompt]);
  }, []);

  const deleteCustomPrompt = useCallback((promptId: string) => {
    setCustomPrompts((prev) => prev.filter((p) => p.id !== promptId));
  }, []);

  const addRecentPrompt = useCallback((prompt: string) => {
    setRecentPrompts((prev) => {
      const filtered = prev.filter((p) => p !== prompt);
      return [prompt, ...filtered].slice(0, 20);
    });
  }, []);

  const clearRecentPrompts = useCallback(() => {
    setRecentPrompts([]);
  }, []);

  const exportPrompts = useCallback(() => {
    return JSON.stringify(customPrompts, null, 2);
  }, [customPrompts]);

  const importPrompts = useCallback((json: string) => {
    try {
      const imported = JSON.parse(json) as PromptTemplate[];
      setCustomPrompts((prev) => [...prev, ...imported]);
    } catch (e) {
      console.error('Failed to import prompts:', e);
    }
  }, []);

  return {
    customPrompts,
    recentPrompts,
    addCustomPrompt,
    deleteCustomPrompt,
    addRecentPrompt,
    clearRecentPrompts,
    exportPrompts,
    importPrompts,
  };
}

// ============================================================================
// Quick Prompt Helpers
// ============================================================================

export const QuickPrompts = {
  layout: {
    hero: () => DEFAULT_PROMPTS.find((p) => p.id === 'layout-hero')?.prompt || '',
    grid: (columns = '3') =>
      interpolateVariables(
        DEFAULT_PROMPTS.find((p) => p.id === 'layout-grid')?.prompt || '',
        { columns }
      ),
    footer: () => DEFAULT_PROMPTS.find((p) => p.id === 'layout-footer')?.prompt || '',
  },
  styling: {
    darkMode: () => DEFAULT_PROMPTS.find((p) => p.id === 'styling-dark-mode')?.prompt || '',
    gradient: (startColor = '#667eea', endColor = '#764ba2') =>
      interpolateVariables(
        DEFAULT_PROMPTS.find((p) => p.id === 'styling-gradient')?.prompt || '',
        { startColor, endColor }
      ),
  },
  components: {
    navbar: () => DEFAULT_PROMPTS.find((p) => p.id === 'components-navbar')?.prompt || '',
    card: () => DEFAULT_PROMPTS.find((p) => p.id === 'components-card')?.prompt || '',
    form: () => DEFAULT_PROMPTS.find((p) => p.id === 'components-form')?.prompt || '',
  },
};

export default PromptLibrary;
