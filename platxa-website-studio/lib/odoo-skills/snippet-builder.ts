/**
 * Odoo Snippet Builder
 *
 * Production-grade snippet generation for Odoo website builder.
 * Creates custom snippets with options, styles, and JavaScript.
 */

import type {
  SnippetConfig,
  SnippetCategory,
  SnippetOption,
  GeneratedFile,
} from "./types";

// =============================================================================
// SNIPPET TEMPLATES
// =============================================================================

/**
 * Pre-built snippet templates organized by category
 */
export const SNIPPET_LIBRARY: Record<string, SnippetConfig> = {
  // -------------------------------------------------------------------------
  // Structure Snippets
  // -------------------------------------------------------------------------

  s_hero_centered: {
    id: "s_hero_centered",
    name: "Hero Centered",
    category: "structure",
    description: "Centered hero section with headline and CTA",
    template: `
<section class="s_hero_centered min-vh-75 d-flex align-items-center o_cc o_cc1">
    <div class="container text-center py-5">
        <span class="badge bg-primary bg-opacity-10 text-primary mb-3 px-3 py-2 rounded-pill o_default_snippet_text">
            Welcome
        </span>
        <h1 class="display-3 fw-bold mb-4 o_default_snippet_text">
            Your Headline Here
        </h1>
        <p class="lead text-muted mb-4 mx-auto o_default_snippet_text" style="max-width: 600px;">
            A compelling description that captures your value proposition
        </p>
        <div class="d-flex gap-3 justify-content-center flex-wrap">
            <a href="#" class="btn btn-primary btn-lg rounded-pill px-4">Get Started</a>
            <a href="#" class="btn btn-outline-secondary btn-lg rounded-pill px-4">Learn More</a>
        </div>
    </div>
</section>`,
    options: [
      { name: "height", label: "Height", type: "select", default: "min-vh-75", choices: [
        { value: "min-vh-50", label: "50%" },
        { value: "min-vh-75", label: "75%" },
        { value: "min-vh-100", label: "Full Screen" },
      ]},
      { name: "alignment", label: "Alignment", type: "select", default: "center", choices: [
        { value: "start", label: "Left" },
        { value: "center", label: "Center" },
        { value: "end", label: "Right" },
      ]},
    ],
  },

  s_hero_split: {
    id: "s_hero_split",
    name: "Hero Split",
    category: "structure",
    description: "Hero with text on one side and image on the other",
    template: `
<section class="s_hero_split pt96 pb96 o_cc o_cc1">
    <div class="container">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <h1 class="display-4 fw-bold mb-4 o_default_snippet_text">
                    Headline That Captures Attention
                </h1>
                <p class="lead text-muted mb-4 o_default_snippet_text">
                    Supporting text that elaborates on your main message and value proposition.
                </p>
                <div class="d-flex gap-3 flex-wrap">
                    <a href="#" class="btn btn-primary btn-lg rounded-pill px-4">Primary CTA</a>
                    <a href="#" class="btn btn-outline-primary btn-lg rounded-pill px-4">Secondary</a>
                </div>
            </div>
            <div class="col-lg-6">
                <img src="/web/image/website/hero" class="img-fluid rounded-3 shadow-lg" alt="Hero"/>
            </div>
        </div>
    </div>
</section>`,
    options: [
      { name: "imagePosition", label: "Image Position", type: "select", default: "right", choices: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]},
    ],
  },

  s_cover_parallax: {
    id: "s_cover_parallax",
    name: "Cover Parallax",
    category: "structure",
    description: "Full-width cover with parallax background",
    template: `
<section class="s_cover_parallax min-vh-75 d-flex align-items-center position-relative overflow-hidden o_cc o_cc5"
         style="background: url('/web/image/website/cover') center/cover fixed;">
    <div class="position-absolute top-0 start-0 w-100 h-100 bg-dark opacity-50"></div>
    <div class="container position-relative z-1 text-center text-white py-5">
        <h1 class="display-2 fw-bold mb-4 o_default_snippet_text">Bold Statement</h1>
        <p class="lead mb-4 opacity-75 o_default_snippet_text">Supporting message here</p>
        <a href="#" class="btn btn-light btn-lg rounded-pill px-5">Take Action</a>
    </div>
</section>`,
    options: [
      { name: "overlay", label: "Overlay Opacity", type: "range", default: 50, min: 0, max: 100, step: 10 },
    ],
  },

  // -------------------------------------------------------------------------
  // Content Snippets
  // -------------------------------------------------------------------------

  s_text_block: {
    id: "s_text_block",
    name: "Text Block",
    category: "content",
    description: "Simple text content section",
    template: `
<section class="s_text_block section-padding o_cc o_cc1">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <h2 class="fw-bold mb-4 o_default_snippet_text">Section Heading</h2>
                <p class="text-muted o_default_snippet_text">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                    tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                    quis nostrud exercitation ullamco laboris.
                </p>
                <p class="text-muted o_default_snippet_text">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
                    dolore eu fugiat nulla pariatur.
                </p>
            </div>
        </div>
    </div>
</section>`,
    options: [
      { name: "width", label: "Content Width", type: "select", default: "col-lg-8", choices: [
        { value: "col-lg-6", label: "Narrow" },
        { value: "col-lg-8", label: "Medium" },
        { value: "col-lg-10", label: "Wide" },
        { value: "col-12", label: "Full" },
      ]},
    ],
  },

  s_text_image: {
    id: "s_text_image",
    name: "Text & Image",
    category: "content",
    description: "Text content alongside an image",
    template: `
<section class="s_text_image section-padding o_cc o_cc1">
    <div class="container">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <h2 class="fw-bold mb-4 o_default_snippet_text">About Our Company</h2>
                <p class="lead text-muted mb-4 o_default_snippet_text">
                    We are dedicated to delivering exceptional value to our customers.
                </p>
                <p class="text-muted o_default_snippet_text">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                    tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <a href="#" class="btn btn-primary rounded-pill px-4 mt-3">Learn More</a>
            </div>
            <div class="col-lg-6">
                <div class="img-hover-zoom rounded-3 overflow-hidden shadow">
                    <img src="/web/image/website/about" class="img-fluid" alt="About"/>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [
      { name: "imagePosition", label: "Image Position", type: "select", default: "right", choices: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]},
    ],
  },

  // -------------------------------------------------------------------------
  // Feature Snippets
  // -------------------------------------------------------------------------

  s_features_grid: {
    id: "s_features_grid",
    name: "Features Grid",
    category: "features",
    description: "Feature cards in a responsive grid",
    template: `
<section class="s_features_grid section-padding o_cc o_cc3">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Our Features</h2>
            <p class="text-muted o_default_snippet_text">Discover what makes us different</p>
        </div>
        <div class="row g-4">
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm hover-lift">
                    <div class="card-body p-4 text-center">
                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                            <i class="fa fa-rocket fa-2x text-primary"></i>
                        </div>
                        <h5 class="fw-bold o_default_snippet_text">Fast Performance</h5>
                        <p class="text-muted mb-0 o_default_snippet_text">Lightning-fast load times for the best experience.</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm hover-lift">
                    <div class="card-body p-4 text-center">
                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                            <i class="fa fa-shield fa-2x text-primary"></i>
                        </div>
                        <h5 class="fw-bold o_default_snippet_text">Secure</h5>
                        <p class="text-muted mb-0 o_default_snippet_text">Enterprise-grade security to protect your data.</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm hover-lift">
                    <div class="card-body p-4 text-center">
                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                            <i class="fa fa-expand-arrows-alt fa-2x text-primary"></i>
                        </div>
                        <h5 class="fw-bold o_default_snippet_text">Scalable</h5>
                        <p class="text-muted mb-0 o_default_snippet_text">Grows with your business needs effortlessly.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [
      { name: "columns", label: "Columns", type: "select", default: "3", choices: [
        { value: "2", label: "2 Columns" },
        { value: "3", label: "3 Columns" },
        { value: "4", label: "4 Columns" },
      ]},
      { name: "iconStyle", label: "Icon Style", type: "select", default: "circle", choices: [
        { value: "circle", label: "Circle" },
        { value: "square", label: "Square" },
        { value: "none", label: "No Background" },
      ]},
    ],
  },

  s_features_list: {
    id: "s_features_list",
    name: "Features List",
    category: "features",
    description: "Horizontal feature list with icons",
    template: `
<section class="s_features_list section-padding o_cc o_cc1">
    <div class="container">
        <div class="row g-4 justify-content-center">
            <div class="col-md-6 col-lg-3 text-center">
                <i class="fa fa-bolt fa-3x text-primary mb-3"></i>
                <h5 class="fw-bold o_default_snippet_text">Fast</h5>
                <p class="text-muted small o_default_snippet_text">Lightning speed</p>
            </div>
            <div class="col-md-6 col-lg-3 text-center">
                <i class="fa fa-lock fa-3x text-primary mb-3"></i>
                <h5 class="fw-bold o_default_snippet_text">Secure</h5>
                <p class="text-muted small o_default_snippet_text">Bank-level security</p>
            </div>
            <div class="col-md-6 col-lg-3 text-center">
                <i class="fa fa-headset fa-3x text-primary mb-3"></i>
                <h5 class="fw-bold o_default_snippet_text">Support</h5>
                <p class="text-muted small o_default_snippet_text">24/7 assistance</p>
            </div>
            <div class="col-md-6 col-lg-3 text-center">
                <i class="fa fa-sync fa-3x text-primary mb-3"></i>
                <h5 class="fw-bold o_default_snippet_text">Updates</h5>
                <p class="text-muted small o_default_snippet_text">Always current</p>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  s_stats: {
    id: "s_stats",
    name: "Statistics",
    category: "features",
    description: "Number statistics counters",
    template: `
<section class="s_stats section-padding bg-primary text-white">
    <div class="container">
        <div class="row text-center g-4">
            <div class="col-6 col-md-3">
                <div class="display-4 fw-bold mb-2">500+</div>
                <p class="mb-0 opacity-75 o_default_snippet_text">Happy Clients</p>
            </div>
            <div class="col-6 col-md-3">
                <div class="display-4 fw-bold mb-2">1000+</div>
                <p class="mb-0 opacity-75 o_default_snippet_text">Projects Done</p>
            </div>
            <div class="col-6 col-md-3">
                <div class="display-4 fw-bold mb-2">50+</div>
                <p class="mb-0 opacity-75 o_default_snippet_text">Team Members</p>
            </div>
            <div class="col-6 col-md-3">
                <div class="display-4 fw-bold mb-2">99%</div>
                <p class="mb-0 opacity-75 o_default_snippet_text">Satisfaction</p>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Social Proof Snippets
  // -------------------------------------------------------------------------

  s_testimonials: {
    id: "s_testimonials",
    name: "Testimonials",
    category: "social",
    description: "Customer testimonial cards",
    template: `
<section class="s_testimonials section-padding o_cc o_cc1">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">What Our Clients Say</h2>
            <p class="text-muted o_default_snippet_text">Trusted by businesses worldwide</p>
        </div>
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body p-4">
                        <div class="mb-3 text-warning">
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                        </div>
                        <p class="mb-4 o_default_snippet_text">
                            "Excellent service and amazing results. Highly recommended
                            for anyone looking to grow their business."
                        </p>
                        <div class="d-flex align-items-center">
                            <img src="/web/image/testimonial/1" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                            <div>
                                <h6 class="mb-0 fw-bold o_default_snippet_text">John Smith</h6>
                                <small class="text-muted o_default_snippet_text">CEO, Tech Corp</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body p-4">
                        <div class="mb-3 text-warning">
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                        </div>
                        <p class="mb-4 o_default_snippet_text">
                            "The team went above and beyond. A truly professional
                            experience from start to finish."
                        </p>
                        <div class="d-flex align-items-center">
                            <img src="/web/image/testimonial/2" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                            <div>
                                <h6 class="mb-0 fw-bold o_default_snippet_text">Jane Doe</h6>
                                <small class="text-muted o_default_snippet_text">Founder, Startup Inc</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body p-4">
                        <div class="mb-3 text-warning">
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star"></i>
                            <i class="fa fa-star-half-alt"></i>
                        </div>
                        <p class="mb-4 o_default_snippet_text">
                            "Great value for money and fantastic support.
                            Would definitely work with them again."
                        </p>
                        <div class="d-flex align-items-center">
                            <img src="/web/image/testimonial/3" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                            <div>
                                <h6 class="mb-0 fw-bold o_default_snippet_text">Bob Wilson</h6>
                                <small class="text-muted o_default_snippet_text">Director, Enterprise Ltd</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [
      { name: "columns", label: "Columns", type: "select", default: "3", choices: [
        { value: "2", label: "2 Columns" },
        { value: "3", label: "3 Columns" },
      ]},
    ],
  },

  s_clients: {
    id: "s_clients",
    name: "Client Logos",
    category: "social",
    description: "Logo showcase for clients or partners",
    template: `
<section class="s_clients py-5 o_cc o_cc3">
    <div class="container">
        <p class="text-center text-muted mb-4 o_default_snippet_text">Trusted by leading companies</p>
        <div class="row align-items-center justify-content-center g-4">
            <div class="col-6 col-md-4 col-lg-2 text-center">
                <img src="/web/image/client/1" class="img-fluid opacity-50" style="max-height:40px;" alt="Client"/>
            </div>
            <div class="col-6 col-md-4 col-lg-2 text-center">
                <img src="/web/image/client/2" class="img-fluid opacity-50" style="max-height:40px;" alt="Client"/>
            </div>
            <div class="col-6 col-md-4 col-lg-2 text-center">
                <img src="/web/image/client/3" class="img-fluid opacity-50" style="max-height:40px;" alt="Client"/>
            </div>
            <div class="col-6 col-md-4 col-lg-2 text-center">
                <img src="/web/image/client/4" class="img-fluid opacity-50" style="max-height:40px;" alt="Client"/>
            </div>
            <div class="col-6 col-md-4 col-lg-2 text-center">
                <img src="/web/image/client/5" class="img-fluid opacity-50" style="max-height:40px;" alt="Client"/>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // CTA Snippets
  // -------------------------------------------------------------------------

  s_cta_box: {
    id: "s_cta_box",
    name: "CTA Box",
    category: "content",
    description: "Call-to-action with background",
    template: `
<section class="s_cta_box section-padding bg-primary text-white text-center">
    <div class="container py-4">
        <h2 class="fw-bold mb-3 o_default_snippet_text">Ready to Get Started?</h2>
        <p class="lead mb-4 opacity-75 o_default_snippet_text">Join thousands of satisfied customers today</p>
        <div class="d-flex gap-3 justify-content-center flex-wrap">
            <a href="/contactus" class="btn btn-light btn-lg rounded-pill px-5">Contact Us</a>
            <a href="/shop" class="btn btn-outline-light btn-lg rounded-pill px-5">Browse Products</a>
        </div>
    </div>
</section>`,
    options: [],
  },

  s_newsletter: {
    id: "s_newsletter",
    name: "Newsletter",
    category: "content",
    description: "Email newsletter signup form",
    template: `
<section class="s_newsletter section-padding o_cc o_cc3">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-6 text-center">
                <h3 class="fw-bold mb-3 o_default_snippet_text">Subscribe to Our Newsletter</h3>
                <p class="text-muted mb-4 o_default_snippet_text">Get the latest updates and offers directly in your inbox</p>
                <form class="d-flex gap-2 flex-column flex-sm-row">
                    <input type="email" class="form-control form-control-lg rounded-pill" placeholder="Enter your email"/>
                    <button type="submit" class="btn btn-primary btn-lg rounded-pill px-4 flex-shrink-0">Subscribe</button>
                </form>
                <small class="text-muted mt-3 d-block">We respect your privacy. Unsubscribe at any time.</small>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Pricing Snippets
  // -------------------------------------------------------------------------

  s_pricing: {
    id: "s_pricing",
    name: "Pricing Table",
    category: "dynamic",
    description: "Pricing plans comparison",
    template: `
<section class="s_pricing section-padding o_cc o_cc3">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Pricing Plans</h2>
            <p class="text-muted o_default_snippet_text">Choose the plan that works for you</p>
        </div>
        <div class="row g-4 justify-content-center">
            <div class="col-lg-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body p-4 text-center">
                        <h5 class="text-muted text-uppercase mb-3">Starter</h5>
                        <div class="display-5 fw-bold mb-0">$9</div>
                        <p class="text-muted">/month</p>
                        <ul class="list-unstyled my-4 text-start">
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>5 Users</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>10GB Storage</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>Email Support</li>
                        </ul>
                        <a href="#" class="btn btn-outline-primary w-100 rounded-pill">Get Started</a>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card h-100 border-primary shadow position-relative">
                    <div class="position-absolute top-0 start-50 translate-middle">
                        <span class="badge bg-primary px-3 py-2">POPULAR</span>
                    </div>
                    <div class="card-body p-4 text-center">
                        <h5 class="text-muted text-uppercase mb-3">Professional</h5>
                        <div class="display-5 fw-bold mb-0">$29</div>
                        <p class="text-muted">/month</p>
                        <ul class="list-unstyled my-4 text-start">
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>25 Users</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>100GB Storage</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>Priority Support</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>API Access</li>
                        </ul>
                        <a href="#" class="btn btn-primary w-100 rounded-pill">Get Started</a>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body p-4 text-center">
                        <h5 class="text-muted text-uppercase mb-3">Enterprise</h5>
                        <div class="display-5 fw-bold mb-0">$99</div>
                        <p class="text-muted">/month</p>
                        <ul class="list-unstyled my-4 text-start">
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>Unlimited Users</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>1TB Storage</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>24/7 Support</li>
                            <li class="py-2"><i class="fa fa-check text-success me-2"></i>Custom Integrations</li>
                        </ul>
                        <a href="#" class="btn btn-outline-primary w-100 rounded-pill">Contact Sales</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Team Snippets
  // -------------------------------------------------------------------------

  s_team: {
    id: "s_team",
    name: "Team Grid",
    category: "content",
    description: "Team member cards",
    template: `
<section class="s_team section-padding o_cc o_cc1">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Meet Our Team</h2>
            <p class="text-muted o_default_snippet_text">The people behind our success</p>
        </div>
        <div class="row g-4">
            <div class="col-md-6 col-lg-3">
                <div class="card border-0 shadow-sm text-center hover-lift">
                    <div class="img-hover-zoom">
                        <img src="/web/image/team/1" class="card-img-top" alt="Team Member"/>
                    </div>
                    <div class="card-body">
                        <h5 class="fw-bold mb-1 o_default_snippet_text">Alice Johnson</h5>
                        <p class="text-muted small mb-3 o_default_snippet_text">CEO & Founder</p>
                        <div class="d-flex justify-content-center gap-2">
                            <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                            <a href="#" class="text-muted"><i class="fab fa-twitter"></i></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card border-0 shadow-sm text-center hover-lift">
                    <div class="img-hover-zoom">
                        <img src="/web/image/team/2" class="card-img-top" alt="Team Member"/>
                    </div>
                    <div class="card-body">
                        <h5 class="fw-bold mb-1 o_default_snippet_text">Bob Smith</h5>
                        <p class="text-muted small mb-3 o_default_snippet_text">CTO</p>
                        <div class="d-flex justify-content-center gap-2">
                            <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                            <a href="#" class="text-muted"><i class="fab fa-github"></i></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card border-0 shadow-sm text-center hover-lift">
                    <div class="img-hover-zoom">
                        <img src="/web/image/team/3" class="card-img-top" alt="Team Member"/>
                    </div>
                    <div class="card-body">
                        <h5 class="fw-bold mb-1 o_default_snippet_text">Carol Williams</h5>
                        <p class="text-muted small mb-3 o_default_snippet_text">Lead Designer</p>
                        <div class="d-flex justify-content-center gap-2">
                            <a href="#" class="text-muted"><i class="fab fa-dribbble"></i></a>
                            <a href="#" class="text-muted"><i class="fab fa-behance"></i></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card border-0 shadow-sm text-center hover-lift">
                    <div class="img-hover-zoom">
                        <img src="/web/image/team/4" class="card-img-top" alt="Team Member"/>
                    </div>
                    <div class="card-body">
                        <h5 class="fw-bold mb-1 o_default_snippet_text">David Brown</h5>
                        <p class="text-muted small mb-3 o_default_snippet_text">Marketing Lead</p>
                        <div class="d-flex justify-content-center gap-2">
                            <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                            <a href="#" class="text-muted"><i class="fab fa-twitter"></i></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // FAQ Snippets
  // -------------------------------------------------------------------------

  s_faq: {
    id: "s_faq",
    name: "FAQ Accordion",
    category: "content",
    description: "Frequently asked questions",
    template: `
<section class="s_faq section-padding o_cc o_cc1">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Frequently Asked Questions</h2>
            <p class="text-muted o_default_snippet_text">Find answers to common questions</p>
        </div>
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="accordion" id="faqAccordion">
                    <div class="accordion-item border-0 mb-3 shadow-sm rounded-3 overflow-hidden">
                        <h2 class="accordion-header">
                            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                                How do I get started?
                            </button>
                        </h2>
                        <div id="faq1" class="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                            <div class="accordion-body o_default_snippet_text">
                                Getting started is easy! Simply sign up for an account and follow our step-by-step onboarding process. We'll guide you through everything you need to know.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item border-0 mb-3 shadow-sm rounded-3 overflow-hidden">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                                What payment methods do you accept?
                            </button>
                        </h2>
                        <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                            <div class="accordion-body o_default_snippet_text">
                                We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise clients.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item border-0 mb-3 shadow-sm rounded-3 overflow-hidden">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                                Can I cancel my subscription anytime?
                            </button>
                        </h2>
                        <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                            <div class="accordion-body o_default_snippet_text">
                                Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. Your access will continue until the end of your billing period.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Portfolio / Gallery Snippets
  // -------------------------------------------------------------------------

  s_portfolio_grid: {
    id: "s_portfolio_grid",
    name: "Portfolio Grid",
    category: "content",
    description: "Masonry-style portfolio gallery with category filters",
    template: `
<section class="s_portfolio_grid section-padding o_cc o_cc1" data-snippet="s_portfolio_grid">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Our Work</h2>
            <p class="text-muted o_default_snippet_text">Explore our latest projects</p>
        </div>
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600" alt="" class="img-fluid" loading="lazy"/>
                    <div class="card-body p-3">
                        <h5 class="card-title fw-bold o_default_snippet_text">Project Alpha</h5>
                        <p class="text-muted small o_default_snippet_text">Web Design</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=600" alt="" class="img-fluid" loading="lazy"/>
                    <div class="card-body p-3">
                        <h5 class="card-title fw-bold o_default_snippet_text">Project Beta</h5>
                        <p class="text-muted small o_default_snippet_text">Branding</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600" alt="" class="img-fluid" loading="lazy"/>
                    <div class="card-body p-3">
                        <h5 class="card-title fw-bold o_default_snippet_text">Project Gamma</h5>
                        <p class="text-muted small o_default_snippet_text">Development</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  s_gallery_carousel: {
    id: "s_gallery_carousel",
    name: "Gallery Carousel",
    category: "content",
    description: "Image carousel with navigation arrows",
    template: `
<section class="s_gallery_carousel section-padding o_cc o_cc1" data-snippet="s_gallery_carousel">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Gallery</h2>
        </div>
        <div id="galleryCarousel" class="carousel slide" data-bs-ride="carousel">
            <div class="carousel-inner rounded-3 overflow-hidden">
                <div class="carousel-item active">
                    <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200" alt="" class="d-block w-100 img-fluid" loading="lazy"/>
                </div>
                <div class="carousel-item">
                    <img src="https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200" alt="" class="d-block w-100 img-fluid" loading="lazy"/>
                </div>
                <div class="carousel-item">
                    <img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200" alt="" class="d-block w-100 img-fluid" loading="lazy"/>
                </div>
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#galleryCarousel" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#galleryCarousel" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
            </button>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Blog / Content Card Snippets
  // -------------------------------------------------------------------------

  s_blog_cards: {
    id: "s_blog_cards",
    name: "Blog Cards",
    category: "content",
    description: "Blog post cards with image, date, and excerpt",
    template: `
<section class="s_blog_cards section-padding o_cc o_cc1" data-snippet="s_blog_cards">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Latest Articles</h2>
            <p class="text-muted o_default_snippet_text">Stay up to date with our insights</p>
        </div>
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=600" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-4">
                        <span class="badge bg-primary bg-opacity-10 text-primary mb-2 o_default_snippet_text">Tips</span>
                        <h5 class="card-title fw-bold o_default_snippet_text">Getting Started Guide</h5>
                        <p class="text-muted small o_default_snippet_text">Everything you need to know to hit the ground running with our platform.</p>
                        <a href="#" class="text-primary text-decoration-none fw-semibold">Read More →</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-4">
                        <span class="badge bg-primary bg-opacity-10 text-primary mb-2 o_default_snippet_text">Strategy</span>
                        <h5 class="card-title fw-bold o_default_snippet_text">Best Practices for Growth</h5>
                        <p class="text-muted small o_default_snippet_text">Proven strategies that successful businesses use to scale efficiently.</p>
                        <a href="#" class="text-primary text-decoration-none fw-semibold">Read More →</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-4">
                        <span class="badge bg-primary bg-opacity-10 text-primary mb-2 o_default_snippet_text">News</span>
                        <h5 class="card-title fw-bold o_default_snippet_text">Product Update: New Features</h5>
                        <p class="text-muted small o_default_snippet_text">We just shipped exciting new features that our users have been requesting.</p>
                        <a href="#" class="text-primary text-decoration-none fw-semibold">Read More →</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Contact / Location Snippets
  // -------------------------------------------------------------------------

  s_contact_form: {
    id: "s_contact_form",
    name: "Contact Section",
    category: "content",
    description: "Contact information with map placeholder and details",
    template: `
<section class="s_contact_form section-padding o_cc o_cc1" data-snippet="s_contact_form">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Get In Touch</h2>
            <p class="text-muted o_default_snippet_text">We'd love to hear from you</p>
        </div>
        <div class="row g-4">
            <div class="col-md-4">
                <div class="text-center p-4">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px;">
                        <i class="fa fa-map-marker fa-lg text-primary"></i>
                    </div>
                    <h5 class="fw-bold o_default_snippet_text">Address</h5>
                    <p class="text-muted o_default_snippet_text">123 Business Street<br/>City, State 12345</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="text-center p-4">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px;">
                        <i class="fa fa-phone fa-lg text-primary"></i>
                    </div>
                    <h5 class="fw-bold o_default_snippet_text">Phone</h5>
                    <p class="text-muted o_default_snippet_text">+1 (555) 123-4567</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="text-center p-4">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px;">
                        <i class="fa fa-envelope fa-lg text-primary"></i>
                    </div>
                    <h5 class="fw-bold o_default_snippet_text">Email</h5>
                    <p class="text-muted o_default_snippet_text">hello@example.com</p>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Social Proof Snippets
  // -------------------------------------------------------------------------

  s_logos_bar: {
    id: "s_logos_bar",
    name: "Logo Bar",
    category: "social",
    description: "Row of partner/client logos",
    template: `
<section class="s_logos_bar py-4 o_cc o_cc2" data-snippet="s_logos_bar">
    <div class="container">
        <p class="text-center text-muted mb-4 o_default_snippet_text">Trusted by leading companies</p>
        <div class="row align-items-center justify-content-center g-4">
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 1</span>
            </div>
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 2</span>
            </div>
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 3</span>
            </div>
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 4</span>
            </div>
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 5</span>
            </div>
            <div class="col-4 col-md-2 text-center">
                <span class="text-muted fw-bold fs-5 o_default_snippet_text">Brand 6</span>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Process / Timeline Snippets
  // -------------------------------------------------------------------------

  s_process_steps: {
    id: "s_process_steps",
    name: "Process Steps",
    category: "features",
    description: "Numbered process/how-it-works steps",
    template: `
<section class="s_process_steps section-padding o_cc o_cc1" data-snippet="s_process_steps">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">How It Works</h2>
            <p class="text-muted o_default_snippet_text">Simple steps to get started</p>
        </div>
        <div class="row g-4">
            <div class="col-md-4 text-center">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 fw-bold fs-4" style="width: 60px; height: 60px;">1</div>
                <h5 class="fw-bold o_default_snippet_text">Sign Up</h5>
                <p class="text-muted o_default_snippet_text">Create your free account in minutes with just your email address.</p>
            </div>
            <div class="col-md-4 text-center">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 fw-bold fs-4" style="width: 60px; height: 60px;">2</div>
                <h5 class="fw-bold o_default_snippet_text">Configure</h5>
                <p class="text-muted o_default_snippet_text">Set up your preferences and customize the experience to your needs.</p>
            </div>
            <div class="col-md-4 text-center">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 fw-bold fs-4" style="width: 60px; height: 60px;">3</div>
                <h5 class="fw-bold o_default_snippet_text">Launch</h5>
                <p class="text-muted o_default_snippet_text">Go live and start seeing results from day one with our support.</p>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Banner / CTA Variants
  // -------------------------------------------------------------------------

  s_banner_split: {
    id: "s_banner_split",
    name: "Banner Split",
    category: "structure",
    description: "Split banner with text on one side and image on the other",
    template: `
<section class="s_banner_split o_cc o_cc1" data-snippet="s_banner_split">
    <div class="container py-5">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <span class="badge bg-primary bg-opacity-10 text-primary mb-3 px-3 py-2 rounded-pill o_default_snippet_text">About Us</span>
                <h2 class="display-5 fw-bold mb-4 o_default_snippet_text">We Build Solutions That Matter</h2>
                <p class="text-muted mb-4 o_default_snippet_text">Our team of experts is dedicated to delivering exceptional results. With years of experience and a passion for innovation, we help businesses transform their digital presence.</p>
                <a href="#" class="btn btn-primary rounded-pill px-4">Learn More</a>
            </div>
            <div class="col-lg-6">
                <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800" alt="" class="img-fluid rounded-3 shadow" loading="lazy"/>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  s_cta_banner: {
    id: "s_cta_banner",
    name: "CTA Banner",
    category: "structure",
    description: "Full-width call-to-action banner with background",
    template: `
<section class="s_cta_banner py-5 o_cc o_cc3" data-snippet="s_cta_banner">
    <div class="container text-center py-4">
        <h2 class="display-6 fw-bold mb-3 o_default_snippet_text">Ready to Get Started?</h2>
        <p class="lead mb-4 mx-auto o_default_snippet_text" style="max-width: 600px;">Join thousands of satisfied customers who have already transformed their business.</p>
        <div class="d-flex gap-3 justify-content-center flex-wrap">
            <a href="#" class="btn btn-light btn-lg rounded-pill px-4 fw-semibold">Start Free Trial</a>
            <a href="#" class="btn btn-outline-light btn-lg rounded-pill px-4">Contact Sales</a>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Footer Snippets
  // -------------------------------------------------------------------------

  s_footer_columns: {
    id: "s_footer_columns",
    name: "Footer Columns",
    category: "structure",
    description: "Multi-column footer with links and social icons",
    template: `
<section class="s_footer_columns pt-5 pb-3 o_cc o_cc4" data-snippet="s_footer_columns">
    <div class="container">
        <div class="row g-4 mb-4">
            <div class="col-lg-4">
                <h5 class="fw-bold mb-3 o_default_snippet_text">Company Name</h5>
                <p class="text-muted o_default_snippet_text">Delivering excellence since day one. We are committed to providing the best solutions for our clients.</p>
            </div>
            <div class="col-6 col-lg-2">
                <h6 class="fw-bold mb-3 o_default_snippet_text">Company</h6>
                <ul class="list-unstyled">
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">About</a></li>
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">Careers</a></li>
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">Press</a></li>
                </ul>
            </div>
            <div class="col-6 col-lg-2">
                <h6 class="fw-bold mb-3 o_default_snippet_text">Resources</h6>
                <ul class="list-unstyled">
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">Blog</a></li>
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">Help Center</a></li>
                    <li class="mb-2"><a href="#" class="text-muted text-decoration-none">Contact</a></li>
                </ul>
            </div>
            <div class="col-lg-4">
                <h6 class="fw-bold mb-3 o_default_snippet_text">Stay Connected</h6>
                <p class="text-muted o_default_snippet_text">Subscribe to our newsletter for updates.</p>
                <div class="d-flex gap-3 mt-3">
                    <a href="#" class="text-muted"><i class="fa fa-facebook fa-lg"></i></a>
                    <a href="#" class="text-muted"><i class="fa fa-twitter fa-lg"></i></a>
                    <a href="#" class="text-muted"><i class="fa fa-instagram fa-lg"></i></a>
                    <a href="#" class="text-muted"><i class="fa fa-linkedin fa-lg"></i></a>
                </div>
            </div>
        </div>
        <hr class="opacity-25"/>
        <p class="text-center text-muted small mb-0 o_default_snippet_text">&copy; 2026 Company Name. All rights reserved.</p>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Ecommerce Snippets
  // -------------------------------------------------------------------------

  s_product_cards: {
    id: "s_product_cards",
    name: "Product Cards",
    category: "ecommerce",
    description: "Product cards with image, price, and add-to-cart button",
    template: `
<section class="s_product_cards section-padding o_cc o_cc1" data-snippet="s_product_cards">
    <div class="container">
        <div class="section-title text-center mb-5">
            <h2 class="fw-bold o_default_snippet_text">Featured Products</h2>
            <p class="text-muted o_default_snippet_text">Discover our best sellers</p>
        </div>
        <div class="row g-4">
            <div class="col-6 col-md-3">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-3 text-center">
                        <h6 class="fw-bold o_default_snippet_text">Product Name</h6>
                        <p class="text-primary fw-bold mb-2 o_default_snippet_text">$49.99</p>
                        <a href="#" class="btn btn-sm btn-outline-primary rounded-pill">Add to Cart</a>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-3 text-center">
                        <h6 class="fw-bold o_default_snippet_text">Product Name</h6>
                        <p class="text-primary fw-bold mb-2 o_default_snippet_text">$79.99</p>
                        <a href="#" class="btn btn-sm btn-outline-primary rounded-pill">Add to Cart</a>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-3 text-center">
                        <h6 class="fw-bold o_default_snippet_text">Product Name</h6>
                        <p class="text-primary fw-bold mb-2 o_default_snippet_text">$34.99</p>
                        <a href="#" class="btn btn-sm btn-outline-primary rounded-pill">Add to Cart</a>
                    </div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                    <img src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400" alt="" class="card-img-top img-fluid" loading="lazy"/>
                    <div class="card-body p-3 text-center">
                        <h6 class="fw-bold o_default_snippet_text">Product Name</h6>
                        <p class="text-primary fw-bold mb-2 o_default_snippet_text">$59.99</p>
                        <a href="#" class="btn btn-sm btn-outline-primary rounded-pill">Add to Cart</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Map / Location Snippets
  // -------------------------------------------------------------------------

  s_map_section: {
    id: "s_map_section",
    name: "Map Section",
    category: "content",
    description: "Location section with embedded map and business hours",
    template: `
<section class="s_map_section section-padding o_cc o_cc1" data-snippet="s_map_section">
    <div class="container">
        <div class="row g-4">
            <div class="col-lg-6">
                <h2 class="fw-bold mb-4 o_default_snippet_text">Visit Us</h2>
                <div class="mb-4">
                    <h6 class="fw-bold o_default_snippet_text">Address</h6>
                    <p class="text-muted o_default_snippet_text">123 Main Street, Suite 100<br/>City, State 12345</p>
                </div>
                <div class="mb-4">
                    <h6 class="fw-bold o_default_snippet_text">Business Hours</h6>
                    <p class="text-muted o_default_snippet_text">Monday – Friday: 9:00 AM – 6:00 PM<br/>Saturday: 10:00 AM – 4:00 PM<br/>Sunday: Closed</p>
                </div>
                <div>
                    <h6 class="fw-bold o_default_snippet_text">Contact</h6>
                    <p class="text-muted o_default_snippet_text">Phone: +1 (555) 123-4567<br/>Email: info@example.com</p>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="bg-light rounded-3 d-flex align-items-center justify-content-center" style="min-height: 350px;">
                    <p class="text-muted o_default_snippet_text"><i class="fa fa-map-marker fa-2x mb-2 d-block"></i>Map will appear here</p>
                </div>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },

  // -------------------------------------------------------------------------
  // Counter / Number Snippets
  // -------------------------------------------------------------------------

  s_counters: {
    id: "s_counters",
    name: "Counter Section",
    category: "features",
    description: "Animated number counters for key metrics",
    template: `
<section class="s_counters py-5 o_cc o_cc3" data-snippet="s_counters">
    <div class="container">
        <div class="row text-center g-4">
            <div class="col-6 col-md-3">
                <h2 class="display-4 fw-bold o_default_snippet_text">500+</h2>
                <p class="text-muted fw-semibold o_default_snippet_text">Happy Clients</p>
            </div>
            <div class="col-6 col-md-3">
                <h2 class="display-4 fw-bold o_default_snippet_text">1200</h2>
                <p class="text-muted fw-semibold o_default_snippet_text">Projects Done</p>
            </div>
            <div class="col-6 col-md-3">
                <h2 class="display-4 fw-bold o_default_snippet_text">15+</h2>
                <p class="text-muted fw-semibold o_default_snippet_text">Years Experience</p>
            </div>
            <div class="col-6 col-md-3">
                <h2 class="display-4 fw-bold o_default_snippet_text">24/7</h2>
                <p class="text-muted fw-semibold o_default_snippet_text">Support Available</p>
            </div>
        </div>
    </div>
</section>`,
    options: [],
  },
};

// =============================================================================
// SNIPPET BUILDER FUNCTIONS
// =============================================================================

/**
 * Get snippet by ID
 */
export function getSnippetById(id: string): SnippetConfig | undefined {
  return SNIPPET_LIBRARY[id];
}

/**
 * Get snippets by category
 */
export function getSnippetsByCategory(category: SnippetCategory): SnippetConfig[] {
  return Object.values(SNIPPET_LIBRARY).filter((s) => s.category === category);
}

/**
 * Get all available snippets
 */
export function getAllSnippets(): SnippetConfig[] {
  return Object.values(SNIPPET_LIBRARY);
}

/**
 * Generate XML for a snippet
 */
export function generateSnippetXml(
  snippet: SnippetConfig,
  themeName: string
): string {
  return `
    <!-- ${snippet.name} Snippet -->
    <template id="${snippet.id}" name="${snippet.name}">
        ${snippet.template.trim()}
    </template>
`;
}

/**
 * Generate snippet options XML for website builder
 */
export function generateSnippetOptionsXml(
  snippet: SnippetConfig,
  themeName: string
): string {
  if (snippet.options.length === 0) return "";

  const optionsHtml = snippet.options.map((opt) => {
    switch (opt.type) {
      case "select":
        return `
                    <we-select string="${opt.label}" data-name="${opt.name}">
                        ${opt.choices?.map((c) => `
                        <we-button data-select-class="${c.value}">${c.label}</we-button>`).join("")}
                    </we-select>`;
      case "colorpicker":
        return `
                    <we-colorpicker string="${opt.label}" data-name="${opt.name}"/>`;
      case "toggle":
        return `
                    <we-checkbox string="${opt.label}" data-name="${opt.name}"/>`;
      default:
        return "";
    }
  }).join("");

  return `
    <template id="${snippet.id}_options" inherit_id="website.snippet_options">
        <xpath expr="." position="inside">
            <div data-js="SnippetOption" data-selector=".${snippet.id}">
                ${optionsHtml}
            </div>
        </xpath>
    </template>
`;
}

/**
 * Generate complete snippets.xml file for a theme
 */
export function generateSnippetsFile(
  snippets: SnippetConfig[],
  themeName: string
): GeneratedFile {
  const snippetXml = snippets.map((s) => generateSnippetXml(s, themeName)).join("\n");
  const optionsXml = snippets.map((s) => generateSnippetOptionsXml(s, themeName)).join("\n");

  const content = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- =====================================================================
         ${themeName} - Custom Snippets
         ===================================================================== -->

    <!-- Register snippets in website builder -->
    <template id="snippets" inherit_id="website.snippets" name="${themeName} Snippets">
        <xpath expr="//div[@id='snippet_structure']//t[@t-snippet][last()]" position="after">
${snippets.map((s) => `            <t t-snippet="${themeName}.${s.id}" t-thumbnail="/web/image/${themeName}/static/src/img/snippets/${s.id}.svg"/>`).join("\n")}
        </xpath>
    </template>

    <!-- Snippet Templates -->
${snippetXml}

    <!-- Snippet Options -->
${optionsXml}
</odoo>
`;

  return {
    path: `${themeName}/views/snippets.xml`,
    content,
    type: "xml",
  };
}

/**
 * Build a custom snippet from configuration
 */
export function buildSnippet(config: Partial<SnippetConfig>): SnippetConfig {
  const id = config.id || `s_custom_${Date.now()}`;

  return {
    id,
    name: config.name || "Custom Snippet",
    category: config.category || "content",
    description: config.description || "Custom snippet",
    template: config.template || "<section class=\"section-padding\"><div class=\"container\">Content here</div></section>",
    options: config.options || [],
    ...config,
  };
}

// =============================================================================
// SNIPPET BUILDER CLASS
// =============================================================================

/**
 * Snippet templates organized by category (alias for SNIPPET_LIBRARY)
 */
export const SNIPPET_TEMPLATES: Record<string, SnippetConfig[]> = (() => {
  const templates: Record<string, SnippetConfig[]> = {};
  Object.values(SNIPPET_LIBRARY).forEach((snippet) => {
    if (!templates[snippet.category]) {
      templates[snippet.category] = [];
    }
    templates[snippet.category].push(snippet);
  });
  return templates;
})();

/**
 * SnippetBuilder class for building theme snippets
 */
export class SnippetBuilder {
  private themeName: string;
  private snippets: Array<{
    category: SnippetCategory;
    snippetId: string;
    options?: Record<string, unknown>;
    snippet: SnippetConfig;
  }> = [];

  constructor(themeName: string) {
    this.themeName = themeName;
  }

  /**
   * Add a snippet to the builder
   */
  addSnippet(
    category: SnippetCategory,
    snippetId: string,
    options?: Record<string, unknown>
  ): this {
    const snippet = getSnippetById(snippetId) || buildSnippet({
      id: snippetId,
      category,
    });

    this.snippets.push({
      category,
      snippetId,
      options,
      snippet: {
        ...snippet,
        options: snippet.options.map((opt) => ({
          ...opt,
          default: options?.[opt.name] ?? opt.default,
        })),
      },
    });

    return this;
  }

  /**
   * Get all added snippets
   */
  getSnippets(): Array<{
    category: SnippetCategory;
    snippetId: string;
    options?: Record<string, unknown>;
    snippet: SnippetConfig;
  }> {
    return this.snippets;
  }

  /**
   * Generate snippets XML
   */
  generateSnippetsXml(): string {
    const snippetXml = this.snippets
      .map(({ snippet }) => generateSnippetXml(snippet, this.themeName))
      .join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
${snippetXml}
</odoo>`;
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    themeName: string;
    snippets: Array<{
      category: SnippetCategory;
      snippetId: string;
      options?: Record<string, unknown>;
    }>;
  } {
    return {
      themeName: this.themeName,
      snippets: this.snippets.map(({ category, snippetId, options }) => ({
        category,
        snippetId,
        options,
      })),
    };
  }
}
