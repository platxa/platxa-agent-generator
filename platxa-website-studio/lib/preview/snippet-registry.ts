/**
 * Odoo Website Builder Snippet Registry
 *
 * Provides pre-built snippet templates for realistic preview rendering.
 * These simulate common Odoo website builder components.
 */

export interface SnippetDefinition {
  id: string;
  name: string;
  category: "structure" | "features" | "content" | "dynamic";
  template: string;
  thumbnail?: string;
  description?: string;
}

/**
 * Common Odoo snippet templates
 */
export const SNIPPET_TEMPLATES: Record<string, SnippetDefinition> = {
  // Structure snippets
  s_banner: {
    id: "s_banner",
    name: "Banner",
    category: "structure",
    description: "Hero banner with title and call-to-action",
    template: `
      <section class="s_banner pt96 pb96 o_cc o_cc1" data-snippet="s_banner">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-lg-6">
              <h1 class="display-4 fw-bold o_default_snippet_text">Welcome to Our Website</h1>
              <p class="lead o_default_snippet_text">Create beautiful websites with Odoo's powerful website builder.</p>
              <a href="/contactus" class="btn btn-primary btn-lg mt-3">Get Started</a>
            </div>
            <div class="col-lg-6">
              <img src="/web/image/website/banner" class="img-fluid rounded shadow" alt="Banner Image"/>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_cover: {
    id: "s_cover",
    name: "Cover",
    category: "structure",
    description: "Full-width cover section with background",
    template: `
      <section class="s_cover pt160 pb160 o_cc o_cc2 text-center" data-snippet="s_cover" style="background-image: url('/web/image/website/cover');">
        <div class="container">
          <h1 class="display-3 text-white fw-bold o_default_snippet_text">Big Bold Statement</h1>
          <p class="lead text-white-75 o_default_snippet_text">Supporting text that elaborates on the statement</p>
          <a href="#" class="btn btn-light btn-lg mt-4">Learn More</a>
        </div>
      </section>
    `,
  },

  s_three_columns: {
    id: "s_three_columns",
    name: "Three Columns",
    category: "structure",
    description: "Three column layout for features",
    template: `
      <section class="s_three_columns pt64 pb64 o_cc o_cc1" data-snippet="s_three_columns">
        <div class="container">
          <div class="row text-center">
            <div class="col-lg-4 mb-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <i class="fa fa-3x fa-rocket text-primary mb-3"></i>
                  <h4 class="o_default_snippet_text">Fast Performance</h4>
                  <p class="text-muted o_default_snippet_text">Lightning-fast load times for the best user experience.</p>
                </div>
              </div>
            </div>
            <div class="col-lg-4 mb-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <i class="fa fa-3x fa-shield text-primary mb-3"></i>
                  <h4 class="o_default_snippet_text">Secure</h4>
                  <p class="text-muted o_default_snippet_text">Enterprise-grade security to protect your data.</p>
                </div>
              </div>
            </div>
            <div class="col-lg-4 mb-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <i class="fa fa-3x fa-expand-arrows-alt text-primary mb-3"></i>
                  <h4 class="o_default_snippet_text">Scalable</h4>
                  <p class="text-muted o_default_snippet_text">Grows with your business needs effortlessly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_text_image: {
    id: "s_text_image",
    name: "Text & Image",
    category: "structure",
    description: "Text content alongside an image",
    template: `
      <section class="s_text_image pt64 pb64 o_cc o_cc1" data-snippet="s_text_image">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-lg-6 mb-4 mb-lg-0">
              <h2 class="fw-bold o_default_snippet_text">About Our Company</h2>
              <p class="lead text-muted o_default_snippet_text">We are dedicated to delivering exceptional value to our customers.</p>
              <p class="o_default_snippet_text">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
              <a href="#" class="btn btn-outline-primary">Learn More</a>
            </div>
            <div class="col-lg-6">
              <img src="/web/image/website/about" class="img-fluid rounded shadow" alt="About Us"/>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  // Features snippets
  s_features: {
    id: "s_features",
    name: "Features Grid",
    category: "features",
    description: "Feature cards in a grid layout",
    template: `
      <section class="s_features pt64 pb64 o_cc o_cc3" data-snippet="s_features">
        <div class="container">
          <h2 class="text-center fw-bold mb-5 o_default_snippet_text">Our Features</h2>
          <div class="row g-4">
            <div class="col-md-6 col-lg-3">
              <div class="text-center">
                <div class="feature-icon bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                  <i class="fa fa-cog fa-2x"></i>
                </div>
                <h5 class="o_default_snippet_text">Easy Setup</h5>
                <p class="text-muted small o_default_snippet_text">Get started in minutes</p>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="text-center">
                <div class="feature-icon bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                  <i class="fa fa-bolt fa-2x"></i>
                </div>
                <h5 class="o_default_snippet_text">Fast Speed</h5>
                <p class="text-muted small o_default_snippet_text">Optimized for performance</p>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="text-center">
                <div class="feature-icon bg-info text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                  <i class="fa fa-lock fa-2x"></i>
                </div>
                <h5 class="o_default_snippet_text">Secure</h5>
                <p class="text-muted small o_default_snippet_text">Enterprise-grade security</p>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="text-center">
                <div class="feature-icon bg-warning text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                  <i class="fa fa-headset fa-2x"></i>
                </div>
                <h5 class="o_default_snippet_text">24/7 Support</h5>
                <p class="text-muted small o_default_snippet_text">Always here to help</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_numbers: {
    id: "s_numbers",
    name: "Statistics",
    category: "features",
    description: "Number counters for statistics",
    template: `
      <section class="s_numbers pt64 pb64 bg-primary text-white" data-snippet="s_numbers">
        <div class="container">
          <div class="row text-center">
            <div class="col-6 col-md-3 mb-4 mb-md-0">
              <h2 class="display-4 fw-bold">500+</h2>
              <p class="mb-0 o_default_snippet_text">Happy Clients</p>
            </div>
            <div class="col-6 col-md-3 mb-4 mb-md-0">
              <h2 class="display-4 fw-bold">1000+</h2>
              <p class="mb-0 o_default_snippet_text">Projects Done</p>
            </div>
            <div class="col-6 col-md-3">
              <h2 class="display-4 fw-bold">50+</h2>
              <p class="mb-0 o_default_snippet_text">Team Members</p>
            </div>
            <div class="col-6 col-md-3">
              <h2 class="display-4 fw-bold">99%</h2>
              <p class="mb-0 o_default_snippet_text">Satisfaction</p>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  // Content snippets
  s_testimonials: {
    id: "s_testimonials",
    name: "Testimonials",
    category: "content",
    description: "Customer testimonial cards",
    template: `
      <section class="s_testimonials pt64 pb64 o_cc o_cc4" data-snippet="s_testimonials">
        <div class="container">
          <h2 class="text-center fw-bold mb-5 o_default_snippet_text">What Our Clients Say</h2>
          <div class="row g-4">
            <div class="col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <div class="mb-3">
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                  </div>
                  <p class="o_default_snippet_text">"Excellent service and amazing results. Highly recommended for anyone looking to grow their business."</p>
                  <div class="d-flex align-items-center mt-3">
                    <img src="/web/image/testimonial/1" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                    <div>
                      <h6 class="mb-0 o_default_snippet_text">John Smith</h6>
                      <small class="text-muted o_default_snippet_text">CEO, Tech Corp</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <div class="mb-3">
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                  </div>
                  <p class="o_default_snippet_text">"The team went above and beyond our expectations. A truly professional experience from start to finish."</p>
                  <div class="d-flex align-items-center mt-3">
                    <img src="/web/image/testimonial/2" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                    <div>
                      <h6 class="mb-0 o_default_snippet_text">Jane Doe</h6>
                      <small class="text-muted o_default_snippet_text">Founder, Startup Inc</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4">
                  <div class="mb-3">
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star text-warning"></i>
                    <i class="fa fa-star-half-alt text-warning"></i>
                  </div>
                  <p class="o_default_snippet_text">"Great value for money and fantastic customer support. Would definitely work with them again."</p>
                  <div class="d-flex align-items-center mt-3">
                    <img src="/web/image/testimonial/3" class="rounded-circle me-3" width="48" height="48" alt="Client"/>
                    <div>
                      <h6 class="mb-0 o_default_snippet_text">Bob Wilson</h6>
                      <small class="text-muted o_default_snippet_text">Director, Enterprise Ltd</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_faq: {
    id: "s_faq",
    name: "FAQ",
    category: "content",
    description: "Frequently asked questions accordion",
    template: `
      <section class="s_faq pt64 pb64 o_cc o_cc1" data-snippet="s_faq">
        <div class="container">
          <h2 class="text-center fw-bold mb-5 o_default_snippet_text">Frequently Asked Questions</h2>
          <div class="accordion" id="faqAccordion">
            <div class="accordion-item border-0 mb-3 shadow-sm">
              <h2 class="accordion-header">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                  How do I get started?
                </button>
              </h2>
              <div id="faq1" class="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                <div class="accordion-body o_default_snippet_text">
                  Getting started is easy! Simply sign up for an account and follow our step-by-step onboarding process.
                </div>
              </div>
            </div>
            <div class="accordion-item border-0 mb-3 shadow-sm">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                  What payment methods do you accept?
                </button>
              </h2>
              <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body o_default_snippet_text">
                  We accept all major credit cards, PayPal, and bank transfers for enterprise clients.
                </div>
              </div>
            </div>
            <div class="accordion-item border-0 shadow-sm">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                  Can I cancel my subscription anytime?
                </button>
              </h2>
              <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                <div class="accordion-body o_default_snippet_text">
                  Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_team: {
    id: "s_team",
    name: "Team",
    category: "content",
    description: "Team member cards",
    template: `
      <section class="s_team pt64 pb64 o_cc o_cc1" data-snippet="s_team">
        <div class="container">
          <h2 class="text-center fw-bold mb-5 o_default_snippet_text">Meet Our Team</h2>
          <div class="row g-4">
            <div class="col-md-6 col-lg-3">
              <div class="card border-0 shadow-sm text-center">
                <img src="/web/image/team/1" class="card-img-top" alt="Team Member"/>
                <div class="card-body">
                  <h5 class="card-title o_default_snippet_text">Alice Johnson</h5>
                  <p class="text-muted o_default_snippet_text">CEO & Founder</p>
                  <div class="d-flex justify-content-center gap-2">
                    <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                    <a href="#" class="text-muted"><i class="fab fa-twitter"></i></a>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="card border-0 shadow-sm text-center">
                <img src="/web/image/team/2" class="card-img-top" alt="Team Member"/>
                <div class="card-body">
                  <h5 class="card-title o_default_snippet_text">Bob Smith</h5>
                  <p class="text-muted o_default_snippet_text">CTO</p>
                  <div class="d-flex justify-content-center gap-2">
                    <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                    <a href="#" class="text-muted"><i class="fab fa-github"></i></a>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="card border-0 shadow-sm text-center">
                <img src="/web/image/team/3" class="card-img-top" alt="Team Member"/>
                <div class="card-body">
                  <h5 class="card-title o_default_snippet_text">Carol Williams</h5>
                  <p class="text-muted o_default_snippet_text">Lead Designer</p>
                  <div class="d-flex justify-content-center gap-2">
                    <a href="#" class="text-muted"><i class="fab fa-dribbble"></i></a>
                    <a href="#" class="text-muted"><i class="fab fa-behance"></i></a>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-6 col-lg-3">
              <div class="card border-0 shadow-sm text-center">
                <img src="/web/image/team/4" class="card-img-top" alt="Team Member"/>
                <div class="card-body">
                  <h5 class="card-title o_default_snippet_text">David Brown</h5>
                  <p class="text-muted o_default_snippet_text">Marketing Lead</p>
                  <div class="d-flex justify-content-center gap-2">
                    <a href="#" class="text-muted"><i class="fab fa-linkedin"></i></a>
                    <a href="#" class="text-muted"><i class="fab fa-twitter"></i></a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  // Dynamic snippets (for e-commerce)
  s_products: {
    id: "s_products",
    name: "Products",
    category: "dynamic",
    description: "Dynamic product grid",
    template: `
      <section class="s_products pt64 pb64 o_cc o_cc1" data-snippet="s_products">
        <div class="container">
          <h2 class="text-center fw-bold mb-5 o_default_snippet_text">Our Products</h2>
          <div class="row g-4" t-foreach="products" t-as="product">
            <div class="col-md-6 col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <img t-att-src="product.image" class="card-img-top" t-att-alt="product.name"/>
                <div class="card-body">
                  <h5 class="card-title" t-esc="product.name"/>
                  <p class="text-muted" t-esc="product.description"/>
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="h5 mb-0 text-primary" t-esc="product.price"/>
                    <a href="#" class="btn btn-primary btn-sm">Add to Cart</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_pricing: {
    id: "s_pricing",
    name: "Pricing",
    category: "dynamic",
    description: "Pricing table with plans",
    template: `
      <section class="s_pricing pt64 pb64 o_cc o_cc3" data-snippet="s_pricing">
        <div class="container">
          <h2 class="text-center fw-bold mb-2 o_default_snippet_text">Pricing Plans</h2>
          <p class="text-center text-muted mb-5 o_default_snippet_text">Choose the plan that works for you</p>
          <div class="row g-4 justify-content-center">
            <div class="col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4 text-center">
                  <h5 class="text-muted text-uppercase mb-3">Starter</h5>
                  <h2 class="display-5 fw-bold mb-0">$9</h2>
                  <p class="text-muted">/month</p>
                  <ul class="list-unstyled my-4 text-start">
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>5 Users</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>10GB Storage</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>Email Support</li>
                  </ul>
                  <a href="#" class="btn btn-outline-primary w-100">Get Started</a>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="card h-100 border-primary shadow">
                <div class="card-header bg-primary text-white text-center py-2">
                  <small class="fw-bold">MOST POPULAR</small>
                </div>
                <div class="card-body p-4 text-center">
                  <h5 class="text-muted text-uppercase mb-3">Professional</h5>
                  <h2 class="display-5 fw-bold mb-0">$29</h2>
                  <p class="text-muted">/month</p>
                  <ul class="list-unstyled my-4 text-start">
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>25 Users</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>100GB Storage</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>Priority Support</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>API Access</li>
                  </ul>
                  <a href="#" class="btn btn-primary w-100">Get Started</a>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body p-4 text-center">
                  <h5 class="text-muted text-uppercase mb-3">Enterprise</h5>
                  <h2 class="display-5 fw-bold mb-0">$99</h2>
                  <p class="text-muted">/month</p>
                  <ul class="list-unstyled my-4 text-start">
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>Unlimited Users</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>1TB Storage</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>24/7 Support</li>
                    <li class="py-2"><i class="fa fa-check text-success me-2"></i>Custom Integrations</li>
                  </ul>
                  <a href="#" class="btn btn-outline-primary w-100">Contact Sales</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
  },

  s_cta: {
    id: "s_cta",
    name: "Call to Action",
    category: "content",
    description: "Call to action banner",
    template: `
      <section class="s_cta pt64 pb64 bg-primary text-white text-center" data-snippet="s_cta">
        <div class="container">
          <h2 class="fw-bold mb-3 o_default_snippet_text">Ready to Get Started?</h2>
          <p class="lead mb-4 o_default_snippet_text">Join thousands of satisfied customers today.</p>
          <a href="/contactus" class="btn btn-light btn-lg me-2">Contact Us</a>
          <a href="/shop" class="btn btn-outline-light btn-lg">Browse Products</a>
        </div>
      </section>
    `,
  },

  s_footer: {
    id: "s_footer",
    name: "Footer",
    category: "structure",
    description: "Website footer with links",
    template: `
      <footer class="s_footer pt64 pb32 bg-dark text-white" data-snippet="s_footer">
        <div class="container">
          <div class="row g-4">
            <div class="col-lg-4">
              <h5 class="fw-bold mb-3 o_default_snippet_text">Company Name</h5>
              <p class="text-white-50 o_default_snippet_text">Building the future, one innovation at a time.</p>
              <div class="d-flex gap-3 mt-3">
                <a href="#" class="text-white-50 hover-white"><i class="fab fa-facebook fa-lg"></i></a>
                <a href="#" class="text-white-50 hover-white"><i class="fab fa-twitter fa-lg"></i></a>
                <a href="#" class="text-white-50 hover-white"><i class="fab fa-linkedin fa-lg"></i></a>
                <a href="#" class="text-white-50 hover-white"><i class="fab fa-instagram fa-lg"></i></a>
              </div>
            </div>
            <div class="col-6 col-lg-2">
              <h6 class="fw-bold mb-3">Product</h6>
              <ul class="list-unstyled">
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Features</a></li>
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Pricing</a></li>
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">API</a></li>
              </ul>
            </div>
            <div class="col-6 col-lg-2">
              <h6 class="fw-bold mb-3">Company</h6>
              <ul class="list-unstyled">
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">About</a></li>
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Blog</a></li>
                <li class="mb-2"><a href="#" class="text-white-50 text-decoration-none">Careers</a></li>
              </ul>
            </div>
            <div class="col-lg-4">
              <h6 class="fw-bold mb-3">Contact</h6>
              <ul class="list-unstyled text-white-50">
                <li class="mb-2"><i class="fa fa-map-marker-alt me-2"></i>123 Business St, City</li>
                <li class="mb-2"><i class="fa fa-phone me-2"></i>+1 (555) 123-4567</li>
                <li class="mb-2"><i class="fa fa-envelope me-2"></i>info@company.com</li>
              </ul>
            </div>
          </div>
          <hr class="my-4 border-secondary"/>
          <div class="text-center text-white-50">
            <small>&copy; 2024 Company Name. All rights reserved.</small>
          </div>
        </div>
      </footer>
    `,
  },
};

/**
 * Get snippet by ID
 */
export function getSnippet(id: string): SnippetDefinition | undefined {
  return SNIPPET_TEMPLATES[id];
}

/**
 * Get all snippets in a category
 */
export function getSnippetsByCategory(category: SnippetDefinition["category"]): SnippetDefinition[] {
  return Object.values(SNIPPET_TEMPLATES).filter((s) => s.category === category);
}

/**
 * Get all available snippets
 */
export function getAllSnippets(): SnippetDefinition[] {
  return Object.values(SNIPPET_TEMPLATES);
}

/**
 * Check if a template contains a known snippet
 */
export function detectSnippets(html: string): string[] {
  const detected: string[] = [];

  for (const [id, snippet] of Object.entries(SNIPPET_TEMPLATES)) {
    if (html.includes(`class="${id}"`) || html.includes(`data-snippet="${id}"`)) {
      detected.push(id);
    }
  }

  return detected;
}

/**
 * Expand snippet placeholders in template
 */
export function expandSnippets(html: string): string {
  let result = html;

  // Replace snippet shortcodes like {{s_banner}} with full template
  const shortcodeRegex = /\{\{(s_\w+)\}\}/g;
  result = result.replace(shortcodeRegex, (match, snippetId) => {
    const snippet = SNIPPET_TEMPLATES[snippetId];
    return snippet ? snippet.template : match;
  });

  return result;
}
