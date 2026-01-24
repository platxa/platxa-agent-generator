/**
 * Snippet Library
 *
 * Pre-built component library with categorized snippets
 * for rapid Odoo theme development.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SnippetCategory =
  | "hero"
  | "features"
  | "content"
  | "team"
  | "testimonials"
  | "pricing"
  | "contact"
  | "gallery"
  | "cta"
  | "footer"
  | "navigation"
  | "cards"
  | "stats";

export interface SnippetVariant {
  /** Variant ID */
  id: string;
  /** Variant name */
  name: string;
  /** Preview image URL */
  preview?: string;
  /** CSS modifiers */
  cssModifiers: string[];
}

export interface ComponentSnippet {
  /** Unique snippet ID */
  id: string;
  /** Display name */
  name: string;
  /** Category */
  category: SnippetCategory;
  /** Description */
  description: string;
  /** Tags for search */
  tags: string[];
  /** QWeb template */
  template: string;
  /** SCSS styles */
  styles: string;
  /** Available variants */
  variants: SnippetVariant[];
  /** Default options */
  options: SnippetOption[];
  /** Preview thumbnail */
  thumbnail?: string;
  /** Is premium/pro snippet */
  isPro?: boolean;
}

export interface SnippetOption {
  /** Option name */
  name: string;
  /** Option type */
  type: "color" | "text" | "image" | "select" | "toggle" | "range";
  /** Default value */
  default: string | number | boolean;
  /** Available choices for select type */
  choices?: Array<{ label: string; value: string }>;
  /** Min/max for range type */
  range?: { min: number; max: number; step: number };
  /** CSS variable to modify */
  cssVariable?: string;
}

// =============================================================================
// HERO SNIPPETS
// =============================================================================

const heroSnippets: ComponentSnippet[] = [
  {
    id: "hero_centered",
    name: "Centered Hero",
    category: "hero",
    description: "Clean centered hero with headline, subtext, and CTA buttons",
    tags: ["hero", "centered", "minimal", "cta"],
    template: `<section class="s_hero s_hero_centered pt96 pb96" data-snippet="s_hero_centered">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-lg-8 text-center">
        <h1 class="display-3 fw-bold mb-4" data-oe-field="headline">
          Transform Your Business Today
        </h1>
        <p class="lead text-muted mb-5" data-oe-field="subheadline">
          Powerful solutions designed to help you grow, scale, and succeed in today's competitive market.
        </p>
        <div class="d-flex gap-3 justify-content-center flex-wrap">
          <a href="#" class="btn btn-primary btn-lg px-5">Get Started</a>
          <a href="#" class="btn btn-outline-secondary btn-lg px-5">Learn More</a>
        </div>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_hero_centered {
  background: var(--hero-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
  color: var(--hero-text, #ffffff);

  h1 {
    color: inherit;
  }

  .lead {
    color: rgba(255, 255, 255, 0.85);
  }

  .btn-primary {
    background: #ffffff;
    color: var(--o-color-1, #667eea);
    border: none;

    &:hover {
      background: rgba(255, 255, 255, 0.9);
    }
  }

  .btn-outline-secondary {
    border-color: rgba(255, 255, 255, 0.5);
    color: #ffffff;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #ffffff;
    }
  }
}`,
    variants: [
      { id: "default", name: "Gradient", cssModifiers: [] },
      { id: "solid", name: "Solid Color", cssModifiers: ["s_hero_solid"] },
      { id: "image", name: "Background Image", cssModifiers: ["s_hero_image"] },
      { id: "video", name: "Video Background", cssModifiers: ["s_hero_video"] },
    ],
    options: [
      {
        name: "Background Type",
        type: "select",
        default: "gradient",
        choices: [
          { label: "Gradient", value: "gradient" },
          { label: "Solid", value: "solid" },
          { label: "Image", value: "image" },
        ],
      },
      {
        name: "Text Alignment",
        type: "select",
        default: "center",
        choices: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
    ],
  },
  {
    id: "hero_split",
    name: "Split Hero",
    category: "hero",
    description: "Two-column hero with content on left and image on right",
    tags: ["hero", "split", "image", "modern"],
    template: `<section class="s_hero s_hero_split" data-snippet="s_hero_split">
  <div class="container py-5">
    <div class="row align-items-center g-5">
      <div class="col-lg-6">
        <span class="badge bg-primary-subtle text-primary mb-3">New Release</span>
        <h1 class="display-4 fw-bold mb-4" data-oe-field="headline">
          Build Something Amazing
        </h1>
        <p class="lead text-muted mb-4" data-oe-field="subheadline">
          Create stunning websites with our intuitive platform. No coding required.
        </p>
        <div class="d-flex gap-3 flex-wrap">
          <a href="#" class="btn btn-primary btn-lg">Start Free Trial</a>
          <a href="#" class="btn btn-link btn-lg text-decoration-none">
            Watch Demo <i class="fa fa-play-circle ms-1"></i>
          </a>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="position-relative">
          <img src="/web/image/website.s_hero_split_default_image"
               alt="Hero Image"
               class="img-fluid rounded-4 shadow-lg"
               data-oe-field="image"/>
        </div>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_hero_split {
  overflow: hidden;

  .badge {
    font-weight: 500;
    padding: 0.5em 1em;
  }

  img {
    transform: perspective(1000px) rotateY(-5deg);
    transition: transform 0.3s ease;

    &:hover {
      transform: perspective(1000px) rotateY(0deg);
    }
  }
}`,
    variants: [
      { id: "default", name: "Image Right", cssModifiers: [] },
      { id: "reversed", name: "Image Left", cssModifiers: ["flex-row-reverse"] },
    ],
    options: [
      { name: "Show Badge", type: "toggle", default: true },
      { name: "Image Style", type: "select", default: "shadow", choices: [
        { label: "Shadow", value: "shadow" },
        { label: "Border", value: "border" },
        { label: "None", value: "none" },
      ]},
    ],
  },
];

// =============================================================================
// FEATURE SNIPPETS
// =============================================================================

const featureSnippets: ComponentSnippet[] = [
  {
    id: "features_grid",
    name: "Features Grid",
    category: "features",
    description: "Grid of feature cards with icons",
    tags: ["features", "grid", "icons", "cards"],
    template: `<section class="s_features s_features_grid py-5" data-snippet="s_features_grid">
  <div class="container">
    <div class="text-center mb-5">
      <h2 class="display-5 fw-bold mb-3">Why Choose Us</h2>
      <p class="lead text-muted col-lg-8 mx-auto">
        Discover the features that make our platform stand out from the rest.
      </p>
    </div>
    <div class="row g-4">
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body p-4">
            <div class="feature-icon bg-primary bg-opacity-10 text-primary rounded-3 mb-3 p-3 d-inline-flex">
              <i class="fa fa-rocket fa-2x"></i>
            </div>
            <h5 class="card-title fw-bold">Lightning Fast</h5>
            <p class="card-text text-muted">
              Optimized for speed and performance. Your site loads in milliseconds.
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body p-4">
            <div class="feature-icon bg-success bg-opacity-10 text-success rounded-3 mb-3 p-3 d-inline-flex">
              <i class="fa fa-shield fa-2x"></i>
            </div>
            <h5 class="card-title fw-bold">Secure by Design</h5>
            <p class="card-text text-muted">
              Enterprise-grade security to protect your data and users.
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body p-4">
            <div class="feature-icon bg-info bg-opacity-10 text-info rounded-3 mb-3 p-3 d-inline-flex">
              <i class="fa fa-mobile fa-2x"></i>
            </div>
            <h5 class="card-title fw-bold">Mobile First</h5>
            <p class="card-text text-muted">
              Responsive design that looks perfect on any device.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_features_grid {
  .card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1) !important;
    }
  }

  .feature-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}`,
    variants: [
      { id: "default", name: "Cards", cssModifiers: [] },
      { id: "minimal", name: "Minimal", cssModifiers: ["s_features_minimal"] },
      { id: "bordered", name: "Bordered", cssModifiers: ["s_features_bordered"] },
    ],
    options: [
      { name: "Columns", type: "select", default: "3", choices: [
        { label: "2 Columns", value: "2" },
        { label: "3 Columns", value: "3" },
        { label: "4 Columns", value: "4" },
      ]},
      { name: "Show Icons", type: "toggle", default: true },
    ],
  },
  {
    id: "features_alternating",
    name: "Alternating Features",
    category: "features",
    description: "Features with alternating image and text layout",
    tags: ["features", "alternating", "zigzag", "images"],
    template: `<section class="s_features s_features_alternating py-5" data-snippet="s_features_alternating">
  <div class="container">
    <div class="row align-items-center g-5 mb-5">
      <div class="col-lg-6">
        <span class="text-primary fw-semibold">FEATURE ONE</span>
        <h3 class="display-6 fw-bold mt-2 mb-3">Powerful Analytics Dashboard</h3>
        <p class="text-muted mb-4">
          Get real-time insights into your business performance with our comprehensive analytics dashboard.
        </p>
        <ul class="list-unstyled">
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Real-time data updates</li>
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Custom report builder</li>
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Export to multiple formats</li>
        </ul>
      </div>
      <div class="col-lg-6">
        <img src="/web/image/website.s_features_image_1" alt="Feature" class="img-fluid rounded-4 shadow"/>
      </div>
    </div>
    <div class="row align-items-center g-5 flex-lg-row-reverse">
      <div class="col-lg-6">
        <span class="text-primary fw-semibold">FEATURE TWO</span>
        <h3 class="display-6 fw-bold mt-2 mb-3">Seamless Integrations</h3>
        <p class="text-muted mb-4">
          Connect with your favorite tools and services. We integrate with over 100+ popular platforms.
        </p>
        <ul class="list-unstyled">
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> One-click setup</li>
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> API access included</li>
          <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Custom webhooks</li>
        </ul>
      </div>
      <div class="col-lg-6">
        <img src="/web/image/website.s_features_image_2" alt="Feature" class="img-fluid rounded-4 shadow"/>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_features_alternating {
  img {
    transition: transform 0.3s ease;

    &:hover {
      transform: scale(1.02);
    }
  }

  ul li {
    font-size: 1.05rem;
  }
}`,
    variants: [
      { id: "default", name: "With Images", cssModifiers: [] },
      { id: "icons", name: "With Icons", cssModifiers: ["s_features_with_icons"] },
    ],
    options: [],
  },
];

// =============================================================================
// TESTIMONIAL SNIPPETS
// =============================================================================

const testimonialSnippets: ComponentSnippet[] = [
  {
    id: "testimonials_carousel",
    name: "Testimonial Carousel",
    category: "testimonials",
    description: "Rotating testimonial cards with customer quotes",
    tags: ["testimonials", "carousel", "quotes", "customers"],
    template: `<section class="s_testimonials s_testimonials_carousel py-5 bg-light" data-snippet="s_testimonials_carousel">
  <div class="container">
    <div class="text-center mb-5">
      <h2 class="display-5 fw-bold">What Our Customers Say</h2>
      <p class="text-muted">Trusted by thousands of businesses worldwide</p>
    </div>
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <div class="testimonial-card bg-white rounded-4 p-5 shadow-sm text-center">
          <div class="mb-4">
            <i class="fa fa-quote-left fa-3x text-primary opacity-25"></i>
          </div>
          <p class="lead mb-4">
            "This platform has transformed how we do business. The results speak for themselves -
            we've seen a 40% increase in conversions since switching."
          </p>
          <div class="d-flex align-items-center justify-content-center gap-3">
            <img src="/web/image/website.s_testimonial_avatar"
                 alt="Customer"
                 class="rounded-circle"
                 width="56"
                 height="56"/>
            <div class="text-start">
              <strong>Sarah Johnson</strong>
              <div class="text-muted small">CEO, TechStart Inc.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_testimonials_carousel {
  .testimonial-card {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 4px;
      background: var(--o-color-1);
      border-radius: 2px;
    }
  }

  .fa-quote-left {
    color: var(--o-color-1);
  }
}`,
    variants: [
      { id: "default", name: "Single", cssModifiers: [] },
      { id: "grid", name: "Grid", cssModifiers: ["s_testimonials_grid"] },
      { id: "cards", name: "Cards", cssModifiers: ["s_testimonials_cards"] },
    ],
    options: [
      { name: "Show Avatar", type: "toggle", default: true },
      { name: "Show Company", type: "toggle", default: true },
    ],
  },
];

// =============================================================================
// PRICING SNIPPETS
// =============================================================================

const pricingSnippets: ComponentSnippet[] = [
  {
    id: "pricing_cards",
    name: "Pricing Cards",
    category: "pricing",
    description: "Three-tier pricing table with feature comparison",
    tags: ["pricing", "plans", "subscription", "tiers"],
    template: `<section class="s_pricing s_pricing_cards py-5" data-snippet="s_pricing_cards">
  <div class="container">
    <div class="text-center mb-5">
      <h2 class="display-5 fw-bold">Simple, Transparent Pricing</h2>
      <p class="text-muted">No hidden fees. Cancel anytime.</p>
    </div>
    <div class="row g-4 justify-content-center">
      <div class="col-lg-4">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body p-4">
            <h5 class="text-muted fw-normal mb-3">Starter</h5>
            <div class="mb-4">
              <span class="display-4 fw-bold">$19</span>
              <span class="text-muted">/month</span>
            </div>
            <ul class="list-unstyled mb-4">
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> 5 Projects</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> 10GB Storage</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Email Support</li>
              <li class="mb-2 text-muted"><i class="fa fa-times me-2"></i> Advanced Analytics</li>
            </ul>
            <a href="#" class="btn btn-outline-primary w-100">Get Started</a>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card h-100 border-0 shadow-lg border-primary">
          <div class="card-body p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="text-primary fw-normal mb-0">Professional</h5>
              <span class="badge bg-primary">Popular</span>
            </div>
            <div class="mb-4">
              <span class="display-4 fw-bold">$49</span>
              <span class="text-muted">/month</span>
            </div>
            <ul class="list-unstyled mb-4">
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Unlimited Projects</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> 100GB Storage</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Priority Support</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Advanced Analytics</li>
            </ul>
            <a href="#" class="btn btn-primary w-100">Get Started</a>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body p-4">
            <h5 class="text-muted fw-normal mb-3">Enterprise</h5>
            <div class="mb-4">
              <span class="display-4 fw-bold">$99</span>
              <span class="text-muted">/month</span>
            </div>
            <ul class="list-unstyled mb-4">
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Everything in Pro</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Unlimited Storage</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Dedicated Support</li>
              <li class="mb-2"><i class="fa fa-check text-success me-2"></i> Custom Integrations</li>
            </ul>
            <a href="#" class="btn btn-outline-primary w-100">Contact Sales</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_pricing_cards {
  .card {
    transition: transform 0.2s ease;

    &:hover {
      transform: translateY(-8px);
    }

    &.border-primary {
      border-width: 2px !important;
    }
  }
}`,
    variants: [
      { id: "default", name: "3 Tiers", cssModifiers: [] },
      { id: "compact", name: "Compact", cssModifiers: ["s_pricing_compact"] },
      { id: "toggle", name: "With Toggle", cssModifiers: ["s_pricing_toggle"] },
    ],
    options: [
      { name: "Show Annual", type: "toggle", default: false },
      { name: "Highlight Tier", type: "select", default: "2", choices: [
        { label: "First", value: "1" },
        { label: "Second", value: "2" },
        { label: "Third", value: "3" },
      ]},
    ],
  },
];

// =============================================================================
// CTA SNIPPETS
// =============================================================================

const ctaSnippets: ComponentSnippet[] = [
  {
    id: "cta_banner",
    name: "CTA Banner",
    category: "cta",
    description: "Full-width call-to-action banner",
    tags: ["cta", "banner", "action", "conversion"],
    template: `<section class="s_cta s_cta_banner py-5 bg-primary text-white" data-snippet="s_cta_banner">
  <div class="container">
    <div class="row align-items-center">
      <div class="col-lg-8">
        <h2 class="display-6 fw-bold mb-2">Ready to Get Started?</h2>
        <p class="lead opacity-75 mb-0">
          Join thousands of satisfied customers and transform your business today.
        </p>
      </div>
      <div class="col-lg-4 text-lg-end mt-4 mt-lg-0">
        <a href="#" class="btn btn-light btn-lg px-5">Start Free Trial</a>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_cta_banner {
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  .btn-light {
    color: var(--o-color-1);
    font-weight: 600;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
}`,
    variants: [
      { id: "default", name: "Inline", cssModifiers: [] },
      { id: "stacked", name: "Stacked", cssModifiers: ["s_cta_stacked"] },
      { id: "gradient", name: "Gradient", cssModifiers: ["s_cta_gradient"] },
    ],
    options: [
      { name: "Background", type: "color", default: "#667eea", cssVariable: "--cta-bg" },
    ],
  },
];

// =============================================================================
// CONTACT SNIPPETS
// =============================================================================

const contactSnippets: ComponentSnippet[] = [
  {
    id: "contact_form",
    name: "Contact Form",
    category: "contact",
    description: "Contact form with info sidebar",
    tags: ["contact", "form", "email", "support"],
    template: `<section class="s_contact s_contact_form py-5" data-snippet="s_contact_form">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-5">
        <h2 class="display-6 fw-bold mb-4">Get in Touch</h2>
        <p class="text-muted mb-4">
          Have a question or want to work together? Fill out the form and we'll get back to you within 24 hours.
        </p>
        <div class="d-flex align-items-start mb-3">
          <div class="flex-shrink-0">
            <div class="bg-primary bg-opacity-10 text-primary rounded-3 p-3">
              <i class="fa fa-map-marker fa-lg"></i>
            </div>
          </div>
          <div class="ms-3">
            <h6 class="mb-1">Address</h6>
            <p class="text-muted mb-0">123 Business Ave, Suite 100<br/>New York, NY 10001</p>
          </div>
        </div>
        <div class="d-flex align-items-start mb-3">
          <div class="flex-shrink-0">
            <div class="bg-primary bg-opacity-10 text-primary rounded-3 p-3">
              <i class="fa fa-envelope fa-lg"></i>
            </div>
          </div>
          <div class="ms-3">
            <h6 class="mb-1">Email</h6>
            <p class="text-muted mb-0">hello@example.com</p>
          </div>
        </div>
        <div class="d-flex align-items-start">
          <div class="flex-shrink-0">
            <div class="bg-primary bg-opacity-10 text-primary rounded-3 p-3">
              <i class="fa fa-phone fa-lg"></i>
            </div>
          </div>
          <div class="ms-3">
            <h6 class="mb-1">Phone</h6>
            <p class="text-muted mb-0">+1 (555) 123-4567</p>
          </div>
        </div>
      </div>
      <div class="col-lg-7">
        <form class="bg-light rounded-4 p-4 p-lg-5">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">First Name</label>
              <input type="text" class="form-control form-control-lg" placeholder="John"/>
            </div>
            <div class="col-md-6">
              <label class="form-label">Last Name</label>
              <input type="text" class="form-control form-control-lg" placeholder="Doe"/>
            </div>
            <div class="col-12">
              <label class="form-label">Email</label>
              <input type="email" class="form-control form-control-lg" placeholder="john@example.com"/>
            </div>
            <div class="col-12">
              <label class="form-label">Subject</label>
              <select class="form-select form-select-lg">
                <option>General Inquiry</option>
                <option>Sales</option>
                <option>Support</option>
                <option>Partnership</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">Message</label>
              <textarea class="form-control form-control-lg" rows="4" placeholder="Your message..."></textarea>
            </div>
            <div class="col-12">
              <button type="submit" class="btn btn-primary btn-lg w-100">Send Message</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_contact_form {
  .form-control, .form-select {
    border: 2px solid #e5e7eb;

    &:focus {
      border-color: var(--o-color-1);
      box-shadow: 0 0 0 3px rgba(var(--o-color-1-rgb), 0.1);
    }
  }
}`,
    variants: [
      { id: "default", name: "With Sidebar", cssModifiers: [] },
      { id: "centered", name: "Centered", cssModifiers: ["s_contact_centered"] },
      { id: "minimal", name: "Minimal", cssModifiers: ["s_contact_minimal"] },
    ],
    options: [
      { name: "Show Map", type: "toggle", default: false },
      { name: "Form Style", type: "select", default: "card", choices: [
        { label: "Card", value: "card" },
        { label: "Flat", value: "flat" },
      ]},
    ],
  },
];

// =============================================================================
// FOOTER SNIPPETS
// =============================================================================

const footerSnippets: ComponentSnippet[] = [
  {
    id: "footer_columns",
    name: "Multi-Column Footer",
    category: "footer",
    description: "Footer with multiple link columns and newsletter",
    tags: ["footer", "columns", "newsletter", "links"],
    template: `<footer class="s_footer s_footer_columns bg-dark text-white py-5" data-snippet="s_footer_columns">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-4">
        <h5 class="fw-bold mb-3">Company Name</h5>
        <p class="text-white-50 mb-4">
          Building the future of web experiences. We help businesses create stunning digital presence.
        </p>
        <div class="d-flex gap-3">
          <a href="#" class="text-white-50 hover-white"><i class="fa fa-facebook fa-lg"></i></a>
          <a href="#" class="text-white-50 hover-white"><i class="fa fa-twitter fa-lg"></i></a>
          <a href="#" class="text-white-50 hover-white"><i class="fa fa-linkedin fa-lg"></i></a>
          <a href="#" class="text-white-50 hover-white"><i class="fa fa-instagram fa-lg"></i></a>
        </div>
      </div>
      <div class="col-6 col-lg-2">
        <h6 class="fw-bold mb-3">Product</h6>
        <ul class="list-unstyled">
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Features</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Pricing</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Integrations</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Changelog</a></li>
        </ul>
      </div>
      <div class="col-6 col-lg-2">
        <h6 class="fw-bold mb-3">Company</h6>
        <ul class="list-unstyled">
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">About</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Blog</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Careers</a></li>
          <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Contact</a></li>
        </ul>
      </div>
      <div class="col-lg-4">
        <h6 class="fw-bold mb-3">Subscribe to Newsletter</h6>
        <p class="text-white-50 mb-3">Get the latest updates and offers.</p>
        <form class="d-flex gap-2">
          <input type="email" class="form-control" placeholder="Enter your email"/>
          <button type="submit" class="btn btn-primary">Subscribe</button>
        </form>
      </div>
    </div>
    <hr class="my-4 opacity-25"/>
    <div class="row align-items-center">
      <div class="col-md-6 text-center text-md-start">
        <p class="text-white-50 mb-0 small">© 2024 Company Name. All rights reserved.</p>
      </div>
      <div class="col-md-6 text-center text-md-end mt-3 mt-md-0">
        <a href="#" class="text-white-50 text-decoration-none small me-3">Privacy Policy</a>
        <a href="#" class="text-white-50 text-decoration-none small">Terms of Service</a>
      </div>
    </div>
  </div>
</footer>`,
    styles: `.s_footer_columns {
  a {
    transition: color 0.2s ease;

    &:hover {
      color: #ffffff !important;
    }
  }

  .form-control {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    &:focus {
      background: rgba(255, 255, 255, 0.15);
      border-color: var(--o-color-1);
    }
  }
}`,
    variants: [
      { id: "default", name: "Dark", cssModifiers: [] },
      { id: "light", name: "Light", cssModifiers: ["bg-light", "text-dark"] },
      { id: "gradient", name: "Gradient", cssModifiers: ["s_footer_gradient"] },
    ],
    options: [
      { name: "Show Newsletter", type: "toggle", default: true },
      { name: "Show Social", type: "toggle", default: true },
    ],
  },
];

// =============================================================================
// STATS SNIPPETS
// =============================================================================

const statsSnippets: ComponentSnippet[] = [
  {
    id: "stats_counter",
    name: "Stats Counter",
    category: "stats",
    description: "Animated statistics counter section",
    tags: ["stats", "numbers", "counter", "metrics"],
    template: `<section class="s_stats s_stats_counter py-5 bg-primary text-white" data-snippet="s_stats_counter">
  <div class="container">
    <div class="row g-4 text-center">
      <div class="col-6 col-lg-3">
        <div class="display-4 fw-bold mb-2" data-counter="10000">10,000+</div>
        <p class="opacity-75 mb-0">Happy Customers</p>
      </div>
      <div class="col-6 col-lg-3">
        <div class="display-4 fw-bold mb-2" data-counter="500">500+</div>
        <p class="opacity-75 mb-0">Projects Delivered</p>
      </div>
      <div class="col-6 col-lg-3">
        <div class="display-4 fw-bold mb-2" data-counter="99">99%</div>
        <p class="opacity-75 mb-0">Satisfaction Rate</p>
      </div>
      <div class="col-6 col-lg-3">
        <div class="display-4 fw-bold mb-2" data-counter="24">24/7</div>
        <p class="opacity-75 mb-0">Support Available</p>
      </div>
    </div>
  </div>
</section>`,
    styles: `.s_stats_counter {
  position: relative;

  [data-counter] {
    font-variant-numeric: tabular-nums;
  }
}`,
    variants: [
      { id: "default", name: "Primary", cssModifiers: [] },
      { id: "dark", name: "Dark", cssModifiers: ["bg-dark"] },
      { id: "light", name: "Light", cssModifiers: ["bg-light", "text-dark"] },
    ],
    options: [
      { name: "Animate", type: "toggle", default: true },
      { name: "Background", type: "color", default: "#667eea", cssVariable: "--stats-bg" },
    ],
  },
];

// =============================================================================
// ALL SNIPPETS COMBINED
// =============================================================================

export const allSnippets: ComponentSnippet[] = [
  ...heroSnippets,
  ...featureSnippets,
  ...testimonialSnippets,
  ...pricingSnippets,
  ...ctaSnippets,
  ...contactSnippets,
  ...footerSnippets,
  ...statsSnippets,
];

// =============================================================================
// SNIPPET LIBRARY API
// =============================================================================

/**
 * Get all available snippets
 */
export function getAllSnippets(): ComponentSnippet[] {
  return allSnippets;
}

/**
 * Get snippets by category
 */
export function getSnippetsByCategory(category: SnippetCategory): ComponentSnippet[] {
  return allSnippets.filter((s) => s.category === category);
}

/**
 * Get a snippet by ID
 */
export function getSnippetById(id: string): ComponentSnippet | undefined {
  return allSnippets.find((s) => s.id === id);
}

/**
 * Search snippets by query
 */
export function searchSnippets(query: string): ComponentSnippet[] {
  const lowerQuery = query.toLowerCase();
  return allSnippets.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all categories
 */
export function getCategories(): Array<{ id: SnippetCategory; name: string; count: number }> {
  const categoryNames: Record<SnippetCategory, string> = {
    hero: "Hero Sections",
    features: "Features",
    content: "Content Blocks",
    team: "Team",
    testimonials: "Testimonials",
    pricing: "Pricing",
    contact: "Contact",
    gallery: "Gallery",
    cta: "Call to Action",
    footer: "Footers",
    navigation: "Navigation",
    cards: "Cards",
    stats: "Statistics",
  };

  const counts = new Map<SnippetCategory, number>();
  for (const snippet of allSnippets) {
    counts.set(snippet.category, (counts.get(snippet.category) || 0) + 1);
  }

  return (Object.keys(categoryNames) as SnippetCategory[])
    .filter((cat) => counts.has(cat))
    .map((id) => ({
      id,
      name: categoryNames[id],
      count: counts.get(id) || 0,
    }));
}

/**
 * Get snippet template with applied options
 */
export function applySnippetOptions(
  snippet: ComponentSnippet,
  options: Record<string, string | number | boolean>
): { template: string; styles: string } {
  let template = snippet.template;
  let styles = snippet.styles;

  // Apply CSS variable options
  for (const opt of snippet.options) {
    if (opt.cssVariable && options[opt.name] !== undefined) {
      styles = styles.replace(
        new RegExp(`var\\(${opt.cssVariable}[^)]*\\)`, "g"),
        String(options[opt.name])
      );
    }
  }

  return { template, styles };
}

/**
 * Generate snippet registration for Odoo
 */
export function generateSnippetRegistration(snippetIds: string[]): string {
  const snippets = snippetIds.map((id) => getSnippetById(id)).filter(Boolean) as ComponentSnippet[];

  const options = snippets.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
  }));

  return `odoo.define('theme_custom.snippets', function (require) {
'use strict';

var options = require('web_editor.snippets.options');

${snippets
  .map(
    (s) => `
// ${s.name}
options.registry.${s.id} = options.Class.extend({
    // Snippet options
});`
  )
  .join("\n")}

return {
    snippets: ${JSON.stringify(options, null, 2)}
};
});`;
}
