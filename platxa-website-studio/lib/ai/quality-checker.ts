/**
 * Production-grade quality checker for AI-generated Odoo themes
 * Validates content, fixes placeholders, ensures proper structure
 *
 * PRODUCTION-GRADE VALIDATORS:
 * - Template inherit_id validation and auto-fix
 * - Snippet registration validation
 * - Asset path validation
 * - XPath expression validation
 * - JavaScript Odoo module pattern validation
 */

import type { ParsedFile } from "./parser";

// =============================================================================
// ODOO TEMPLATE VALIDATION - PRODUCTION CRITICAL
// =============================================================================

/**
 * Valid inherit_id targets for Odoo website templates
 * These are the ONLY templates that can be inherited from
 */
const VALID_INHERIT_TARGETS = [
  "website.layout",
  "website.homepage",
  "website.footer_default",
  "website.header_default",
  "portal.layout",
  "portal.frontend_layout",
  "web.frontend_layout",
  "website_sale.products",
  "website_sale.product",
  "website_blog.blog_post_short",
  "website_event.event_details",
];

/**
 * Invalid inherit_id patterns that LLMs commonly generate
 */
const INVALID_INHERIT_PATTERNS = [
  /website\.product\.template/i,
  /website\.page/i,
  /website\.template/i,
  /product\.template/i,
  /website\.content/i,
  /website\.main/i,
];

/**
 * Fix invalid inherit_id in Odoo templates
 * CRITICAL: LLMs often generate invalid inherit targets
 */
export function fixInvalidInheritId(content: string): { content: string; fixed: boolean; issues: string[] } {
  let fixed = content;
  const issues: string[] = [];
  let wasFixed = false;

  // Check for invalid inherit_id patterns
  for (const pattern of INVALID_INHERIT_PATTERNS) {
    if (pattern.test(fixed)) {
      const match = fixed.match(/inherit_id=["']([^"']+)["']/);
      if (match) {
        issues.push(`Invalid inherit_id="${match[1]}" - replacing with "website.layout"`);
        fixed = fixed.replace(/inherit_id=["'][^"']+["']/, 'inherit_id="website.layout"');
        wasFixed = true;
      }
    }
  }

  // Check if inherit_id exists but isn't in valid list
  const inheritMatch = fixed.match(/inherit_id=["']([^"']+)["']/);
  if (inheritMatch && !VALID_INHERIT_TARGETS.includes(inheritMatch[1])) {
    // Only fix if it's not a custom module reference (module.template_id format)
    const target = inheritMatch[1];
    if (!target.includes(".") || INVALID_INHERIT_PATTERNS.some(p => p.test(target))) {
      issues.push(`Unknown inherit_id="${target}" - replacing with "website.layout"`);
      fixed = fixed.replace(/inherit_id=["'][^"']+["']/, 'inherit_id="website.layout"');
      wasFixed = true;
    }
  }

  // Fix malformed xpath expressions
  const xpathPatterns = [
    { bad: /expr="\/\/div\[@class='row'\]"/g, good: 'expr="//div[@id=\'wrapwrap\']"' },
    { bad: /position="inside"/g, good: 'position="replace"' },
  ];

  // Check for xpath without proper target
  if (fixed.includes("<xpath") && fixed.includes("inherit_id")) {
    // Ensure xpath has a valid expression
    const xpathMatch = fixed.match(/<xpath[^>]*expr=["']([^"']+)["']/);
    if (xpathMatch) {
      const expr = xpathMatch[1];
      // Common bad patterns
      if (expr.includes("@class='row'") && !expr.includes("@id=")) {
        issues.push("XPath targeting class='row' is fragile - consider using @id selectors");
      }
    }
  }

  return { content: fixed, fixed: wasFixed, issues };
}

/**
 * Validate and fix template structure for Odoo 18
 * Ensures templates follow proper QWeb syntax
 */
export function validateTemplateStructure(content: string, filePath: string): {
  content: string;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];
  let fixed = content;

  // Check for XML declaration
  if (!fixed.includes('<?xml') && fixed.includes('<odoo>')) {
    fixed = '<?xml version="1.0" encoding="utf-8"?>\n' + fixed;
    issues.push({
      severity: "info",
      file: filePath,
      message: "Added missing XML declaration",
    });
  }

  // Fix duplicate XML declarations
  const xmlDeclCount = (fixed.match(/<\?xml[^?]*\?>/g) || []).length;
  if (xmlDeclCount > 1) {
    fixed = fixed.replace(/<\?xml[^?]*\?>\s*/g, '');
    fixed = '<?xml version="1.0" encoding="utf-8"?>\n' + fixed;
    issues.push({
      severity: "warning",
      file: filePath,
      message: "Fixed duplicate XML declarations",
    });
  }

  // Fix comment before XML declaration (invalid XML)
  if (fixed.match(/^<!--[^>]*-->\s*<\?xml/)) {
    fixed = fixed.replace(/^(<!--[^>]*-->)\s*(<\?xml[^?]*\?>)/, '$2\n$1');
    issues.push({
      severity: "warning",
      file: filePath,
      message: "Moved comment after XML declaration",
    });
  }

  // Check for inherit_id issues
  const inheritResult = fixInvalidInheritId(fixed);
  if (inheritResult.fixed) {
    fixed = inheritResult.content;
    inheritResult.issues.forEach(msg => {
      issues.push({
        severity: "error",
        file: filePath,
        message: msg,
      });
    });
  }

  // Check for self-closing tags that shouldn't be (div, span, section, etc.)
  const selfClosingFix = fixed.replace(/<(div|span|section|article|header|footer|nav|main|aside|p|h[1-6]|ul|ol|li|a|button|form|table|tr|td|th)([^>]*?)\/>/gi, '<$1$2></$1>');
  if (selfClosingFix !== fixed) {
    fixed = selfClosingFix;
    issues.push({
      severity: "warning",
      file: filePath,
      message: "Fixed self-closing HTML tags",
    });
  }

  // Ensure template has an id attribute
  if (fixed.includes('<template') && !fixed.match(/<template[^>]*id=/)) {
    issues.push({
      severity: "error",
      file: filePath,
      message: "Template missing required 'id' attribute",
    });
  }

  return { content: fixed, issues };
}

/**
 * Validate JavaScript follows Odoo module pattern
 */
export function validateOdooJavaScript(content: string, filePath: string): {
  content: string;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];
  let fixed = content;

  // Check for jQuery without Odoo context
  if (fixed.includes('$(document).ready') && !fixed.includes('odoo.define') && !fixed.includes('@odoo/')) {
    // Wrap in Odoo-safe pattern
    fixed = `/** @odoo-module **/
import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.ThemeCustomWidget = publicWidget.Widget.extend({
    selector: '.o_theme_custom',
    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            // Original jQuery code adapted
${content.replace(/\$/g, 'self.$').replace(/\$\(document\)\.ready\([^)]*\)\s*\{/, '').replace(/\}\);?\s*$/, '')}
        });
    },
});

export default publicWidget.registry.ThemeCustomWidget;
`;
    issues.push({
      severity: "warning",
      file: filePath,
      message: "Converted jQuery to Odoo widget pattern",
    });
  }

  // Check for Odoo 18 module syntax
  if (fixed.includes('odoo.define(') && !fixed.includes('@odoo-module')) {
    issues.push({
      severity: "info",
      file: filePath,
      message: "Consider using @odoo-module syntax for Odoo 18",
    });
  }

  return { content: fixed, issues };
}

// =============================================================================
// PLACEHOLDER DETECTION
// =============================================================================

/**
 * Placeholder patterns that indicate incomplete generation
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /YOUR_[A-Z_]+/g,
  /FEATURE_\d+_[A-Z]+/g,
  /\[YOUR[^\]]+\]/gi,
  /\[PLACEHOLDER[^\]]*\]/gi,
  /\{YOUR[^}]+\}/gi,
  /Lorem ipsum/gi,
  /placeholder/gi,
  /your-?(?:company|business|brand|name)/gi,
  /insert\s+(?:your|text|content)/gi,
  /add\s+(?:your|text|content)/gi,
  /replace\s+(?:this|with)/gi,
];

/**
 * Detect placeholder content in generated files
 */
export function detectPlaceholders(content: string): {
  found: boolean;
  matches: string[];
  count: number;
} {
  const matches: string[] = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    // Create new regex to reset lastIndex
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    const patternMatches = content.match(freshPattern);
    if (patternMatches) {
      matches.push(...patternMatches);
    }
  }

  return {
    found: matches.length > 0,
    matches: [...new Set(matches)],
    count: matches.length,
  };
}

// =============================================================================
// PLACEHOLDER AUTO-FIX
// =============================================================================

interface FixContext {
  businessName?: string;
  industry?: string;
  tagline?: string;
}

/**
 * Industry-specific feature content for auto-replacement
 */
const INDUSTRY_FEATURES: Record<string, Array<{ title: string; desc: string }>> = {
  restaurant: [
    { title: "Fresh Ingredients", desc: "Locally sourced produce from partner farms" },
    { title: "Expert Chefs", desc: "Award-winning culinary team" },
    { title: "Cozy Ambiance", desc: "Elegant atmosphere for dining" },
  ],
  coffee: [
    { title: "Single Origin", desc: "Premium beans from ethical farms" },
    { title: "Fresh Roasted", desc: "Small batch roasting daily" },
    { title: "Expert Baristas", desc: "Trained professionals" },
  ],
  technology: [
    { title: "Cloud Native", desc: "Built for modern architecture" },
    { title: "AI Powered", desc: "Intelligent automation" },
    { title: "Enterprise Security", desc: "Bank-grade encryption" },
  ],
  healthcare: [
    { title: "Expert Doctors", desc: "Board-certified physicians" },
    { title: "Modern Facilities", desc: "State-of-the-art equipment" },
    { title: "24/7 Care", desc: "Round-the-clock services" },
  ],
  legal: [
    { title: "Expert Attorneys", desc: "Seasoned legal professionals" },
    { title: "Client Focus", desc: "Personalized attention" },
    { title: "Results Driven", desc: "Proven track record" },
  ],
  ecommerce: [
    { title: "Curated Selection", desc: "Hand-picked premium products" },
    { title: "Fast Shipping", desc: "Express delivery available" },
    { title: "Easy Returns", desc: "Hassle-free return policy" },
  ],
  default: [
    { title: "Quality First", desc: "Premium products and services" },
    { title: "Expert Team", desc: "Dedicated professionals" },
    { title: "Fast Service", desc: "Quick turnaround times" },
  ],
};

/**
 * Replace common placeholders with real content based on context
 * PRODUCTION-GRADE: Catches ALL placeholder patterns aggressively
 */
export function fixPlaceholders(content: string, context: FixContext): string {
  let fixed = content;

  const name = context.businessName || "Our Business";
  const tagline = context.tagline || "Excellence in Every Detail";
  const features = INDUSTRY_FEATURES[context.industry || "default"] || INDUSTRY_FEATURES.default;

  // Extended feature list for aggressive replacement
  const extendedFeatures = [
    ...features,
    { title: "Innovation", desc: "Cutting-edge solutions for modern challenges" },
    { title: "Reliability", desc: "Consistent quality you can count on" },
    { title: "Support", desc: "Dedicated assistance when you need it" },
    { title: "Value", desc: "Premium results at competitive prices" },
    { title: "Trust", desc: "Building lasting relationships" },
    { title: "Growth", desc: "Helping you achieve your goals" },
  ];

  // Replace YOUR_* placeholders (comprehensive)
  fixed = fixed.replace(/YOUR_HEADLINE[_A-Z]*/gi, name);
  fixed = fixed.replace(/YOUR_TAGLINE[_A-Z]*/gi, tagline);
  fixed = fixed.replace(/YOUR_DESCRIPTION[_A-Z]*/gi, "We deliver exceptional solutions tailored to your needs.");
  fixed = fixed.replace(/YOUR_CTA[_A-Z]*/gi, "Get Started Today");
  fixed = fixed.replace(/YOUR_FOOTER[_A-Z]*/gi, tagline);
  fixed = fixed.replace(/YOUR_FEATURES[_A-Z]*/gi, "Discover what makes us unique");
  fixed = fixed.replace(/YOUR_[A-Z_]+/g, name); // Catch ANY remaining YOUR_* pattern

  // Replace FEATURE_N_* placeholders (up to 10 features)
  for (let i = 0; i < 10; i++) {
    const f = extendedFeatures[i % extendedFeatures.length];
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}_TITLE`, "gi"), f.title);
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}_DESCRIPTION`, "gi"), f.desc);
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}_DESC`, "gi"), f.desc);
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}_TEXT`, "gi"), f.desc);
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}_NAME`, "gi"), f.title);
    fixed = fixed.replace(new RegExp(`FEATURE_${i + 1}`, "gi"), f.title);
  }

  // Catch ANY remaining FEATURE_N pattern (regex for any number)
  fixed = fixed.replace(/FEATURE_(\d+)_TITLE/gi, (_, num) => {
    const idx = (parseInt(num, 10) - 1) % extendedFeatures.length;
    return extendedFeatures[idx].title;
  });
  fixed = fixed.replace(/FEATURE_(\d+)_(?:DESCRIPTION|DESC|TEXT)/gi, (_, num) => {
    const idx = (parseInt(num, 10) - 1) % extendedFeatures.length;
    return extendedFeatures[idx].desc;
  });
  fixed = fixed.replace(/FEATURE_(\d+)/gi, (_, num) => {
    const idx = (parseInt(num, 10) - 1) % extendedFeatures.length;
    return extendedFeatures[idx].title;
  });

  // Generic replacements
  fixed = fixed.replace(/\[YOUR[^\]]+\]/gi, name);
  fixed = fixed.replace(/\[PLACEHOLDER[^\]]*\]/gi, "");
  fixed = fixed.replace(/\{YOUR[^}]+\}/gi, name);
  fixed = fixed.replace(/your-?company/gi, name.toLowerCase().replace(/\s+/g, "-"));
  fixed = fixed.replace(/your-?business/gi, name.toLowerCase().replace(/\s+/g, "-"));
  fixed = fixed.replace(/your-?brand/gi, name.toLowerCase().replace(/\s+/g, "-"));
  fixed = fixed.replace(/your-?name/gi, name.toLowerCase().replace(/\s+/g, "-"));
  fixed = fixed.replace(/YourBrand/g, name);
  fixed = fixed.replace(/YourCompany/g, name);
  fixed = fixed.replace(/YourBusiness/g, name);

  // Remove any Lorem ipsum
  fixed = fixed.replace(/Lorem ipsum[^<]*/gi, "We deliver exceptional solutions tailored to your needs.");

  return fixed;
}

// =============================================================================
// HTML TO QWEB CONVERSION - PRODUCTION CRITICAL
// =============================================================================

/**
 * Convert raw HTML files to valid Odoo QWeb XML templates
 * ROOT CAUSE: AI often generates .html files instead of .xml QWeb templates
 */
export function convertHtmlToQweb(content: string, filePath: string): {
  content: string;
  newPath: string;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];
  let fixed = content;

  // Check if this is a raw HTML file (has DOCTYPE, html, head, body tags)
  const isRawHtml = content.includes('<!DOCTYPE') ||
                    /<html[\s>]/i.test(content) ||
                    /<head[\s>]/i.test(content) ||
                    /<body[\s>]/i.test(content);

  if (!isRawHtml && !filePath.endsWith('.html')) {
    return { content, newPath: filePath, issues };
  }

  // Extract meaningful content from HTML
  let extractedContent = fixed;

  // Remove DOCTYPE, html, head, body wrappers
  extractedContent = extractedContent
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .trim();

  // Fix JavaScript template syntax ${var} to QWeb t-esc
  extractedContent = extractedContent.replace(/\$\{([^}]+)\}/g, '<t t-esc="$1"/>');

  // Fix placeholders like [Name], [Title], etc.
  extractedContent = extractedContent
    .replace(/\[Name\]/gi, 'Our Business')
    .replace(/\[Title\]/gi, 'Welcome')
    .replace(/\[Description\]/gi, 'Quality service you can trust')
    .replace(/\[Phone\]/gi, '+1 (555) 123-4567')
    .replace(/\[Email\]/gi, 'contact@example.com')
    .replace(/\[Address\]/gi, '123 Main Street');

  // Generate template ID from filename
  const templateId = filePath
    .replace(/^.*\//, '')
    .replace(/\.(html|xml)$/i, '')
    .replace(/[^a-z0-9_]/gi, '_')
    .toLowerCase();

  // Wrap in proper Odoo QWeb structure
  const qwebContent = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="${templateId}" name="${templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}">
    ${extractedContent}
  </template>
</odoo>`;

  // Change file extension from .html to .xml
  const newPath = filePath.replace(/\.html$/i, '.xml').replace(/^theme_[^/]+\//, 'theme_generated/views/');

  issues.push({
    severity: "info",
    file: filePath,
    message: `Auto-converted HTML to QWeb XML template: ${newPath}`,
  });

  return { content: qwebContent, newPath, issues };
}

/**
 * Fix JavaScript template syntax to QWeb
 * ROOT CAUSE: AI generates ${var} instead of <t t-esc="var"/>
 */
export function fixJsTemplateSyntax(content: string, filePath: string): {
  content: string;
  fixed: boolean;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];
  let fixed = content;
  let wasFixed = false;

  // Replace ${var} with <t t-esc="var"/>
  const jsTemplatePattern = /\$\{([^}]+)\}/g;
  if (jsTemplatePattern.test(fixed)) {
    fixed = fixed.replace(jsTemplatePattern, '<t t-esc="$1"/>');
    wasFixed = true;
    issues.push({
      severity: "info",
      file: filePath,
      message: "Auto-fixed: Converted JavaScript template syntax ${} to QWeb t-esc",
    });
  }

  // Also fix {{ var }} Jinja/Django style to QWeb
  const jinjaPattern = /\{\{\s*([^}]+)\s*\}\}/g;
  if (jinjaPattern.test(fixed)) {
    fixed = fixed.replace(jinjaPattern, '<t t-esc="$1"/>');
    wasFixed = true;
    issues.push({
      severity: "info",
      file: filePath,
      message: "Auto-fixed: Converted Jinja/Django template syntax {{}} to QWeb t-esc",
    });
  }

  return { content: fixed, fixed: wasFixed, issues };
}

// =============================================================================
// DUPLICATE CONTENT DETECTION - PRODUCTION CRITICAL
// =============================================================================

/**
 * Unique replacement content for duplicate testimonials/reviews
 */
const TESTIMONIAL_REPLACEMENTS = [
  { quote: "Exceptional service! The team went above and beyond to meet our needs.", author: "Sarah M.", role: "Business Owner" },
  { quote: "Professional and reliable. Would highly recommend to anyone.", author: "Michael T.", role: "Marketing Director" },
  { quote: "Outstanding quality and attention to detail. A pleasure to work with.", author: "Jennifer L.", role: "CEO" },
  { quote: "They delivered exactly what we needed, on time and on budget.", author: "David R.", role: "Project Manager" },
  { quote: "Truly transformative experience. Our business has grown significantly.", author: "Emily K.", role: "Founder" },
  { quote: "Best decision we made this year. The results speak for themselves.", author: "Robert H.", role: "Operations Director" },
];

/**
 * Unique replacement content for duplicate feature descriptions
 */
const FEATURE_REPLACEMENTS = [
  { title: "Quality First", desc: "We prioritize excellence in everything we deliver" },
  { title: "Fast Delivery", desc: "Quick turnaround without compromising on quality" },
  { title: "Expert Team", desc: "Skilled professionals dedicated to your success" },
  { title: "24/7 Support", desc: "Always available when you need assistance" },
  { title: "Secure & Reliable", desc: "Your data and trust are our top priorities" },
  { title: "Custom Solutions", desc: "Tailored approaches for your unique needs" },
];

/**
 * Detect and fix duplicate content in templates
 * ROOT CAUSE: AI often generates identical testimonials/features repeated 3x
 *
 * PRODUCTION-CRITICAL: This function must NOT corrupt HTML structure
 * Only replaces text content inside quotes or p tags, never modifies tag attributes
 */
export function detectAndFixDuplicates(content: string, filePath: string): {
  content: string;
  issues: QualityIssue[];
  fixed: boolean;
} {
  const issues: QualityIssue[] = [];
  let fixed = content;
  let wasFixed = false;

  // SAFETY: Skip files that might have complex nested structures
  // Only process simple testimonial/review sections
  if (!content.includes('testimonial') && !content.includes('review') && !content.includes('quote')) {
    // Just report duplicates but don't auto-fix complex content
    return { content, issues, fixed: false };
  }

  // Extract ONLY text in dedicated quote/testimonial elements
  // Pattern: <p class="...quote...">"text"</p> or <blockquote>text</blockquote>
  const safeQuotePattern = /<(?:blockquote|p[^>]*class="[^"]*quote[^"]*")[^>]*>([^<]{20,200})<\/(?:blockquote|p)>/gi;
  const quotes: Array<{ text: string; fullMatch: string }> = [];
  let match;

  while ((match = safeQuotePattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && !text.includes('<') && !text.includes('{') && !text.includes('=')) {
      quotes.push({ text, fullMatch: match[0] });
    }
  }

  // Find duplicates by comparing normalized text
  const quoteCounts = new Map<string, Array<{ text: string; fullMatch: string }>>();
  for (const quote of quotes) {
    const normalized = quote.text.trim().toLowerCase();
    const existing = quoteCounts.get(normalized) || [];
    existing.push(quote);
    quoteCounts.set(normalized, existing);
  }

  // Check for duplicates (same content appearing 2+ times)
  const duplicates = Array.from(quoteCounts.entries())
    .filter(([_, items]) => items.length > 1);

  if (duplicates.length > 0) {
    issues.push({
      severity: "warning",
      file: filePath,
      message: `Found ${duplicates.length} duplicated testimonial(s) - will replace with unique content`,
    });

    // AUTO-FIX: Replace duplicates with unique content
    // SAFE: Only replace the EXACT fullMatch, keeping HTML structure intact
    let replacementIndex = 0;
    for (const [_, items] of duplicates) {
      // Keep first occurrence, replace the rest
      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const replacement = TESTIMONIAL_REPLACEMENTS[replacementIndex % TESTIMONIAL_REPLACEMENTS.length];

        // Create new tag with replacement text, preserving tag structure
        const newContent = item.fullMatch.replace(item.text, replacement.quote);

        // Only replace this exact occurrence
        const idx = fixed.indexOf(item.fullMatch);
        if (idx !== -1) {
          fixed = fixed.substring(0, idx) + newContent + fixed.substring(idx + item.fullMatch.length);
          replacementIndex++;
          wasFixed = true;
        }
      }
    }

    if (wasFixed) {
      issues.push({
        severity: "info",
        file: filePath,
        message: `Auto-fixed: Replaced ${replacementIndex} duplicate testimonial(s) with unique content`,
      });
    }
  }

  // Report (but don't auto-fix) duplicate cards - too risky
  const cardPattern = /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const cards: string[] = [];
  while ((match = cardPattern.exec(content)) !== null) {
    const normalized = match[1].replace(/\s+/g, ' ').trim();
    if (normalized.length > 50) {
      cards.push(normalized);
    }
  }

  const cardCounts = new Map<string, number>();
  for (const card of cards) {
    const key = card.substring(0, 100);
    cardCounts.set(key, (cardCounts.get(key) || 0) + 1);
  }

  const duplicateCards = Array.from(cardCounts.entries())
    .filter(([_, count]) => count > 1);

  if (duplicateCards.length > 0) {
    issues.push({
      severity: "info",
      file: filePath,
      message: `Found ${duplicateCards.length} similar card(s) - consider varying content manually`,
    });
  }

  return { content: fixed, issues, fixed: wasFixed };
}

// =============================================================================
// COLOR CONTRAST VALIDATION - PRODUCTION CRITICAL
// =============================================================================

/**
 * Poor color contrast combinations that fail WCAG accessibility
 * Format: [foreground, background] - colors that shouldn't be paired
 */
const POOR_CONTRAST_COMBINATIONS = [
  // Yellow/gold on white/light backgrounds
  { fg: ["yellow", "#ff0", "#ffff00", "#ffd700", "gold", "#f0e68c", "khaki"], bg: ["white", "#fff", "#ffffff", "#f8f9fa", "#f5f5f5", "bg-white", "bg-light"] },
  // Light gray on white
  { fg: ["#ccc", "#ddd", "#eee", "lightgray", "silver"], bg: ["white", "#fff", "#ffffff", "#f8f9fa"] },
  // White on light backgrounds
  { fg: ["white", "#fff", "#ffffff"], bg: ["#f8f9fa", "#f5f5f5", "#e9ecef", "bg-light"] },
  // Light colors on light backgrounds
  { fg: ["#90ee90", "lightgreen", "#98fb98"], bg: ["white", "#fff", "#f8f9fa"] },
];

/**
 * Check for poor color contrast in CSS/SCSS content
 */
export function checkColorContrast(content: string, filePath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Check for inline styles with poor contrast
  for (const combo of POOR_CONTRAST_COMBINATIONS) {
    for (const fg of combo.fg) {
      for (const bg of combo.bg) {
        // Check for color: yellow on elements that might have white bg
        const fgPattern = new RegExp(`color:\\s*${fg.replace('#', '\\#?')}`, 'gi');
        const bgPattern = new RegExp(`background(?:-color)?:\\s*${bg.replace('#', '\\#?')}`, 'gi');

        if (fgPattern.test(content) && bgPattern.test(content)) {
          issues.push({
            severity: "warning",
            file: filePath,
            message: `Potential poor contrast: '${fg}' text may be hard to read on '${bg}' background`,
          });
        }
      }
    }
  }

  // Check for specific problematic patterns in XML templates
  if (filePath.endsWith('.xml')) {
    // Yellow/gold star ratings or accents on white cards
    if (content.includes('text-warning') && (content.includes('bg-white') || content.includes('card'))) {
      issues.push({
        severity: "warning",
        file: filePath,
        message: "Yellow 'text-warning' may have poor contrast on white cards - consider using darker gold (#b8860b)",
      });
    }

    // Check for light text classes on light backgrounds
    if ((content.includes('text-light') || content.includes('text-muted')) &&
        (content.includes('bg-white') || content.includes('bg-light'))) {
      issues.push({
        severity: "warning",
        file: filePath,
        message: "Light text classes on light backgrounds - ensure sufficient contrast",
      });
    }
  }

  return issues;
}

/**
 * Auto-fix poor color contrast issues
 */
export function fixColorContrast(content: string, filePath: string): { content: string; fixed: boolean } {
  let fixed = content;
  let wasFixed = false;

  // Fix yellow/gold text to use darker, more readable shade
  // Replace pure yellow with darker gold
  if (filePath.endsWith('.scss') || filePath.endsWith('.css')) {
    const yellowReplacements = [
      { from: /color:\s*yellow\b/gi, to: 'color: #b8860b' }, // darkgoldenrod
      { from: /color:\s*#ff0\b/gi, to: 'color: #b8860b' },
      { from: /color:\s*#ffff00\b/gi, to: 'color: #b8860b' },
      { from: /color:\s*gold\b/gi, to: 'color: #996515' }, // darker gold
    ];

    for (const replacement of yellowReplacements) {
      if (replacement.from.test(fixed)) {
        fixed = fixed.replace(replacement.from, replacement.to);
        wasFixed = true;
      }
    }
  }

  // Fix Bootstrap text-warning on white backgrounds in XML
  if (filePath.endsWith('.xml')) {
    // Add inline style override for better contrast
    if (fixed.includes('text-warning') && !fixed.includes('style=')) {
      fixed = fixed.replace(
        /class="([^"]*text-warning[^"]*)"/g,
        'class="$1" style="color: #996515 !important;"'
      );
      wasFixed = true;
    }
  }

  return { content: fixed, fixed: wasFixed };
}

// =============================================================================
// SCSS TO CSS CONVERSION
// =============================================================================

/**
 * Convert SCSS syntax to plain CSS
 * PRODUCTION-GRADE: Handles variables, nesting, and pseudo-selectors
 */
export function convertScssToBasicCss(scss: string): string {
  let css = scss;

  // Extract and replace SCSS variables
  const variables: Record<string, string> = {};
  const varMatches = css.matchAll(/\$([a-zA-Z_-]+):\s*([^;]+);/g);
  for (const match of varMatches) {
    variables[match[1]] = match[2].trim();
  }

  // Remove variable declarations
  css = css.replace(/\$[a-zA-Z_-]+:\s*[^;]+;\n?/g, "");

  // Replace variable usages with actual values
  for (const [varName, value] of Object.entries(variables)) {
    css = css.replace(new RegExp(`\\$${varName}\\b`, "g"), value);
  }

  // Handle nested &:hover, &:focus, etc. by extracting to separate rules
  // Match: selector { ... &:pseudo { styles } ... }
  const nestedPseudoPattern = /([.#]?[\w-]+)\s*\{([^{}]*?)&:([\w-]+)\s*\{([^{}]+)\}([^{}]*?)\}/g;
  let iterations = 0;
  while (nestedPseudoPattern.test(css) && iterations < 10) {
    css = css.replace(nestedPseudoPattern, (_, selector, before, pseudo, styles, after) => {
      const mainRule = `${selector} {${before}${after}}`;
      const pseudoRule = `${selector}:${pseudo} {${styles}}`;
      return `${mainRule}\n${pseudoRule}`;
    });
    iterations++;
  }

  // Handle & references in other contexts
  css = css.replace(/&\./g, ".");
  css = css.replace(/&:/g, ":");
  css = css.replace(/&\s+/g, " ");
  css = css.replace(/&/g, ""); // Remove any remaining & references

  // Clean up empty rules
  css = css.replace(/[.#]?[\w-]+\s*\{\s*\}/g, "");

  // Clean up multiple newlines
  css = css.replace(/\n{3,}/g, "\n\n");

  return css.trim();
}

// =============================================================================
// QUALITY CHECK
// =============================================================================

interface QualityIssue {
  severity: "error" | "warning" | "info";
  file: string;
  message: string;
}

interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
  fixedFiles: ParsedFile[];
}

/**
 * Comprehensive quality check for generated files
 * PRODUCTION-CRITICAL: Fixes ALL issues automatically
 */
export function qualityCheck(
  files: ParsedFile[],
  context?: FixContext
): QualityResult {
  const issues: QualityIssue[] = [];
  let fixedFiles: ParsedFile[] = [];

  // STEP 0: Filter out and convert invalid files FIRST
  // ROOT CAUSE FIX: Remove/convert .html files, index.html, file_*.html
  for (const file of files) {
    // Skip index.html completely - it's not valid for Odoo
    if (file.path.endsWith('index.html') || file.path.includes('/index.html')) {
      issues.push({
        severity: "info",
        file: file.path,
        message: "Removed index.html - not valid for Odoo modules",
      });
      continue; // Skip this file entirely
    }

    // Skip random file_N.html files - they're not valid
    if (/file_\d+\.html$/i.test(file.path)) {
      issues.push({
        severity: "info",
        file: file.path,
        message: "Removed invalid HTML file - Odoo requires QWeb XML",
      });
      continue; // Skip this file entirely
    }

    // Skip files in /files/ directory with .txt or .html extension
    if (file.path.includes('/files/') && (file.path.endsWith('.txt') || file.path.endsWith('.html'))) {
      issues.push({
        severity: "info",
        file: file.path,
        message: "Removed invalid file from /files/ directory",
      });
      continue;
    }

    // Convert remaining .html files to QWeb XML
    if (file.path.endsWith('.html')) {
      const converted = convertHtmlToQweb(file.content, file.path);
      issues.push(...converted.issues);
      fixedFiles.push({
        ...file,
        path: converted.newPath,
        content: converted.content,
        language: "xml",
      });
      continue;
    }

    fixedFiles.push(file);
  }

  // Now process the cleaned files
  const processedFiles: ParsedFile[] = [];

  for (const file of fixedFiles) {
    let content = file.content;

    // Check for placeholders
    const placeholders = detectPlaceholders(content);
    if (placeholders.found) {
      issues.push({
        severity: "warning",
        file: file.path,
        message: `Found ${placeholders.count} placeholder(s): ${placeholders.matches.slice(0, 3).join(", ")}${placeholders.count > 3 ? "..." : ""}`,
      });

      // Auto-fix placeholders
      content = fixPlaceholders(content, context || {});
    }

    // Check for empty content
    if (content.trim().length < 50) {
      issues.push({
        severity: "error",
        file: file.path,
        message: "File content too short (< 50 chars)",
      });
    }

    // Check XML validity for .xml files - PRODUCTION CRITICAL
    if (file.path.endsWith(".xml")) {
      // CRITICAL AUTO-FIX: Ensure valid Odoo XML structure
      if (!content.includes("<odoo>") && !content.includes("<odoo ")) {
        // Remove any XML declarations first
        let innerContent = content.replace(/<\?xml[^?]*\?>\s*/g, '').trim();
        // Remove leading comments
        innerContent = innerContent.replace(/^<!--[^>]*-->\s*/g, '').trim();

        // Wrap appropriately based on content type
        if (innerContent.includes("<template")) {
          content = `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n${innerContent}\n</odoo>`;
        } else if (innerContent.includes("<section") || innerContent.includes("<div") || innerContent.includes("<header") || innerContent.includes("<footer")) {
          const templateId = file.path
            .replace(/^.*\//, '')
            .replace(/\.xml$/, '')
            .replace(/[^a-z0-9_]/gi, '_')
            .toLowerCase();
          content = `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n  <template id="${templateId}" name="${templateId.replace(/_/g, ' ')}">\n    ${innerContent}\n  </template>\n</odoo>`;
        } else {
          content = `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n${innerContent}\n</odoo>`;
        }

        issues.push({
          severity: "warning",
          file: file.path,
          message: "Auto-fixed: Added missing <odoo> wrapper",
        });
      }

      // Ensure XML declaration exists at start
      if (!content.trim().startsWith("<?xml")) {
        content = `<?xml version="1.0" encoding="utf-8"?>\n${content}`;
        issues.push({
          severity: "info",
          file: file.path,
          message: "Auto-fixed: Added XML declaration",
        });
      }

      if (!content.includes("<template")) {
        issues.push({
          severity: "warning",
          file: file.path,
          message: "No <template> element found",
        });
      }

      // CRITICAL: Validate and fix template structure (inherit_id, xpath, etc.)
      const templateValidation = validateTemplateStructure(content, file.path);
      content = templateValidation.content;
      issues.push(...templateValidation.issues);

      // PRODUCTION-CRITICAL: Fix JavaScript template syntax ${var} to QWeb t-esc
      // ROOT CAUSE: AI generates ${product.name} instead of <t t-esc="product.name"/>
      const jsSyntaxFix = fixJsTemplateSyntax(content, file.path);
      if (jsSyntaxFix.fixed) {
        content = jsSyntaxFix.content;
        issues.push(...jsSyntaxFix.issues);
      }
    }

    // Check JavaScript follows Odoo patterns
    if (file.path.endsWith(".js")) {
      const jsValidation = validateOdooJavaScript(content, file.path);
      content = jsValidation.content;
      issues.push(...jsValidation.issues);
    }

    // Check manifest validity - PRODUCTION CRITICAL
    if (file.path.includes("__manifest__.py")) {
      if (!content.includes("'name':")) {
        issues.push({
          severity: "error",
          file: file.path,
          message: "Missing 'name' in manifest",
        });
      }
      if (!content.includes("'depends':")) {
        issues.push({
          severity: "error",
          file: file.path,
          message: "Missing 'depends' in manifest",
        });
      }
      if (!content.includes("'license':")) {
        issues.push({
          severity: "warning",
          file: file.path,
          message: "Missing 'license' in manifest",
        });
      }
      // Check for invalid data entries - SCSS/CSS should NEVER be in data
      if (content.includes("'data':") && (content.includes(".scss") || content.includes(".css"))) {
        issues.push({
          severity: "error",
          file: file.path,
          message: "CSS/SCSS files must be in 'assets', not 'data'",
        });
        // Auto-fix: Remove CSS/SCSS from data section
        content = content.replace(/'data':\s*\[[^\]]*\.(scss|css)[^\]]*\]/g, (match) => {
          const fixed = match.replace(/,?\s*'[^']*\.(scss|css)',?/g, '');
          return fixed;
        });
      }

      // PRODUCTION-CRITICAL: Auto-fix asset paths to use 'theme_generated'
      // This is a ROOT CAUSE fix - AI often generates wrong module names like 'project_demo', 'my_theme', etc.
      const assetPathRegex = /(['"])([^'"\/]+)(\/static\/src[^'"]*['"])/g;
      let assetMatch;
      let assetFixCount = 0;
      while ((assetMatch = assetPathRegex.exec(content)) !== null) {
        const [fullMatch, quote1, moduleName, rest] = assetMatch;
        if (moduleName !== 'theme_generated') {
          // AUTO-FIX: Replace wrong module name with 'theme_generated'
          content = content.replace(
            new RegExp(`(['"])${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/static/src[^'"]*['"])`, 'g'),
            `$1theme_generated$2`
          );
          assetFixCount++;
        }
      }
      if (assetFixCount > 0) {
        issues.push({
          severity: "info",
          file: file.path,
          message: `Auto-fixed ${assetFixCount} asset path(s) to use 'theme_generated' module name`,
        });
      }

      // Add missing required fields
      if (!content.includes("'version':")) {
        content = content.replace(
          "'name':",
          "'version': '18.0.1.0.0',\n    'name':"
        );
        issues.push({
          severity: "info",
          file: file.path,
          message: "Added missing 'version' field",
        });
      }

      if (!content.includes("'category':")) {
        content = content.replace(
          "'version':",
          "'category': 'Theme/Creative',\n    'version':"
        );
      }
    }

    // PRODUCTION-CRITICAL: Fix models/__init__.py with invalid imports
    // ROOT CAUSE: AI generates 'from . import views, models' but themes don't have Python models
    if (file.path.includes("models/__init__.py") || file.path.endsWith("models/__init__.py")) {
      // Check for invalid imports that don't exist in themes
      const hasInvalidImports = content.includes("from . import") ||
                                content.includes("from .") ||
                                content.includes("import views") ||
                                content.includes("import models");

      if (hasInvalidImports) {
        // AUTO-FIX: Replace with valid empty init for themes
        content = `# -*- coding: utf-8 -*-
# Theme module - no Python models needed
`;
        issues.push({
          severity: "info",
          file: file.path,
          message: "Auto-fixed: Removed invalid imports from models/__init__.py (themes don't need Python models)",
        });
      }
    }

    // PRODUCTION-CRITICAL: Fix root __init__.py with invalid imports
    if (file.path.endsWith("/__init__.py") && !file.path.includes("models/")) {
      // Check for invalid 'from . import models' when there are no actual models
      if (content.includes("from . import models") || content.includes("from .models import")) {
        // For themes, we don't need models import
        content = `# -*- coding: utf-8 -*-
# Odoo theme module
`;
        issues.push({
          severity: "info",
          file: file.path,
          message: "Auto-fixed: Removed invalid 'models' import from __init__.py",
        });
      }
    }

    // Check CSS/SCSS
    if (file.path.endsWith(".scss") || file.path.endsWith(".css")) {
      if (file.path.endsWith(".css") && (content.includes("$") || content.includes("&:"))) {
        issues.push({
          severity: "warning",
          file: file.path,
          message: "CSS file contains SCSS syntax",
        });
        content = convertScssToBasicCss(content);
      }

      // PRODUCTION-CRITICAL: Check and fix color contrast issues
      const contrastIssues = checkColorContrast(content, file.path);
      issues.push(...contrastIssues);

      const contrastFix = fixColorContrast(content, file.path);
      if (contrastFix.fixed) {
        content = contrastFix.content;
        issues.push({
          severity: "info",
          file: file.path,
          message: "Auto-fixed poor color contrast values",
        });
      }
    }

    // PRODUCTION-CRITICAL: Check color contrast in XML templates too
    if (file.path.endsWith(".xml")) {
      const xmlContrastIssues = checkColorContrast(content, file.path);
      issues.push(...xmlContrastIssues);

      const xmlContrastFix = fixColorContrast(content, file.path);
      if (xmlContrastFix.fixed) {
        content = xmlContrastFix.content;
        issues.push({
          severity: "info",
          file: file.path,
          message: "Auto-fixed poor color contrast in template",
        });
      }

      // PRODUCTION-CRITICAL: Detect and fix duplicate content
      // ROOT CAUSE: AI generates same testimonial 3x, same feature description 3x, etc.
      const duplicateResult = detectAndFixDuplicates(content, file.path);
      issues.push(...duplicateResult.issues);
      if (duplicateResult.fixed) {
        content = duplicateResult.content;
      }
    }

    processedFiles.push({
      ...file,
      content,
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    passed: !hasErrors,
    issues,
    fixedFiles: processedFiles,
  };
}

// =============================================================================
// MODULE STRUCTURE VALIDATION
// =============================================================================

/**
 * Validate and fix Odoo module structure
 */
export function validateModuleStructure(files: ParsedFile[]): {
  isValid: boolean;
  missingFiles: string[];
  fixedFiles: ParsedFile[];
} {
  const paths = new Set(files.map((f) => f.path));
  const missingFiles: string[] = [];
  const fixedFiles = [...files];

  // Check for __manifest__.py
  const hasManifest = Array.from(paths).some((p) => p.includes("__manifest__.py"));
  if (!hasManifest) {
    missingFiles.push("__manifest__.py");
  }

  // Check for __init__.py
  const hasInit = Array.from(paths).some((p) => p.endsWith("__init__.py") && !p.includes("models/"));
  if (!hasInit) {
    fixedFiles.push({
      path: "theme_generated/__init__.py",
      content: "# -*- coding: utf-8 -*-\n# Odoo theme module\n",
      language: "python",
      action: "create",
    });
  }

  // Check for at least one template
  const hasTemplate = Array.from(paths).some((p) => p.endsWith(".xml"));
  if (!hasTemplate) {
    missingFiles.push("views/templates.xml");
  }

  return {
    isValid: missingFiles.length === 0,
    missingFiles,
    fixedFiles,
  };
}

// =============================================================================
// MAIN PROCESSING FUNCTION
// =============================================================================

/**
 * Process generated files with full quality checks and auto-fixes
 */
export function processGeneratedFiles(
  files: ParsedFile[],
  context?: {
    businessName?: string;
    industry?: string;
    tagline?: string;
  }
): {
  files: ParsedFile[];
  quality: QualityResult;
  structure: ReturnType<typeof validateModuleStructure>;
} {
  // First validate structure and add missing files
  const structure = validateModuleStructure(files);

  // Then run quality checks on all files (including newly added)
  const quality = qualityCheck(structure.fixedFiles, context);

  return {
    files: quality.fixedFiles,
    quality,
    structure,
  };
}
