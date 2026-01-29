# Implementation Plan: Odoo-Specific Skills

**Priority:** Tier 2 - High Value
**Status:** Planning
**Estimated Complexity:** Medium-High
**Dependencies:** platxa-skill-generator, platxa-website-studio

---

## Executive Summary

Create a comprehensive suite of Odoo-specific skills that encode deep domain expertise for theme development, snippet creation, internationalization, validation, and deployment. These skills will differentiate Platxa from generic AI website builders by providing Odoo-native code generation.

---

## Skills to Implement

| Skill ID | Name | Purpose | Priority |
|----------|------|---------|----------|
| `platxa-odoo-theme` | Odoo Theme Generator | Complete theme module generation | Critical |
| `platxa-odoo-snippet` | Snippet Builder | Custom website builder snippets | High |
| `platxa-odoo-validator` | QWeb Validator | Validate QWeb templates and manifests | High |
| `platxa-odoo-i18n` | Internationalization | Multi-language support | Medium |
| `platxa-odoo-ecommerce` | E-commerce Theming | Product templates and cart styling | Medium |
| `platxa-odoo-seo` | SEO Optimizer | Meta tags, structured data, performance | Medium |

---

## Skill 1: platxa-odoo-theme

### SKILL.md

```markdown
---
name: platxa-odoo-theme
description: Generate production-ready Odoo 18 website themes with QWeb templates, SCSS styling, and proper module structure. Supports industry-specific templates and Bootstrap 5 integration.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
metadata:
  version: "1.0.0"
  tags:
    - odoo
    - theme
    - website
    - qweb
    - scss
  odoo_versions:
    - "17.0"
    - "18.0"
---

# Platxa Odoo Theme Generator

Generate complete, production-ready Odoo website themes.

## Overview

This skill creates Odoo theme modules following official conventions:
- `__manifest__.py` with proper metadata
- QWeb templates with xpath inheritance
- SCSS variables and Bootstrap 5 integration
- Asset bundles and static files
- Industry-specific design patterns

## Prerequisites

- Target Odoo version (17.0 or 18.0)
- Theme name and display name
- Industry category (optional)
- Color palette (optional)

## Module Structure

```
theme_{name}/
├── __manifest__.py           # Module manifest
├── __init__.py               # Empty (theme modules)
├── views/
│   ├── templates.xml         # Main page templates
│   ├── layout.xml            # Header/footer customization
│   ├── snippets.xml          # Custom snippets (optional)
│   └── pages/
│       ├── homepage.xml      # Homepage template
│       ├── about.xml         # About page
│       └── contact.xml       # Contact page
├── static/
│   └── src/
│       ├── scss/
│       │   ├── primary_variables.scss  # Color/font variables
│       │   ├── bootstrap_overridden.scss
│       │   └── theme.scss              # Custom styles
│       ├── js/                         # Custom JavaScript
│       └── img/                        # Theme images
└── data/
    ├── pages.xml             # Page records
    └── menus.xml             # Menu items
```

## Manifest Template

```python
{
    'name': 'Theme Display Name',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'Modern website theme for [industry]',
    'description': '''
        Professional Odoo website theme featuring:
        - Responsive Bootstrap 5 design
        - Custom color scheme
        - Industry-specific sections
        - SEO optimized structure
    ''',
    'author': 'Your Company',
    'website': 'https://yourcompany.com',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'views/layout.xml',
        'views/templates.xml',
        'views/pages/homepage.xml',
        'data/pages.xml',
        'data/menus.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            ('prepend', 'theme_name/static/src/scss/primary_variables.scss'),
            'theme_name/static/src/scss/bootstrap_overridden.scss',
            'theme_name/static/src/scss/theme.scss',
        ],
    },
    'images': [
        'static/description/banner.png',
        'static/description/theme_screenshot.png',
    ],
    'application': False,
    'installable': True,
    'auto_install': False,
}
```

## QWeb Conventions

### Page Template Pattern

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Inherit website.layout for custom pages -->
    <template id="page_homepage" name="Homepage">
        <t t-call="website.layout">
            <t t-set="pageName" t-value="'homepage'"/>
            <div id="wrap" class="oe_structure">

                <!-- Hero Section -->
                <section class="s_banner pt96 pb96 o_cc o_cc1">
                    <div class="container">
                        <div class="row align-items-center">
                            <div class="col-lg-6">
                                <h1 class="display-4 fw-bold">Welcome</h1>
                                <p class="lead">Your tagline here</p>
                                <a href="/contact" class="btn btn-primary btn-lg">
                                    Get Started
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Features Section -->
                <section class="s_features pt64 pb64">
                    <!-- Content -->
                </section>

            </div>
        </t>
    </template>

    <!-- Register as website page -->
    <record id="page_homepage_page" model="website.page">
        <field name="name">Homepage</field>
        <field name="url">/</field>
        <field name="view_id" ref="page_homepage"/>
        <field name="website_indexed" eval="True"/>
        <field name="is_published" eval="True"/>
    </record>
</odoo>
```

### Layout Customization Pattern

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Custom Header -->
    <template id="custom_header" inherit_id="website.layout" name="Custom Header">
        <xpath expr="//header" position="attributes">
            <attribute name="class" add="custom-header" separator=" "/>
        </xpath>
        <xpath expr="//header//nav" position="attributes">
            <attribute name="class" add="navbar-custom" separator=" "/>
        </xpath>
    </template>

    <!-- Custom Footer -->
    <template id="custom_footer" inherit_id="website.layout" name="Custom Footer">
        <xpath expr="//footer" position="replace">
            <footer class="o_footer">
                <div class="container py-5">
                    <div class="row">
                        <div class="col-lg-4">
                            <h5>Company Name</h5>
                            <p class="text-muted">Brief description</p>
                        </div>
                        <div class="col-lg-2">
                            <h6>Quick Links</h6>
                            <ul class="list-unstyled">
                                <li><a href="/">Home</a></li>
                                <li><a href="/about">About</a></li>
                            </ul>
                        </div>
                    </div>
                    <hr/>
                    <p class="text-muted text-center mb-0">
                        © <t t-esc="datetime.datetime.now().year"/> Company Name
                    </p>
                </div>
            </footer>
        </xpath>
    </template>
</odoo>
```

## SCSS Variables Template

```scss
// primary_variables.scss - Override Bootstrap before it loads

// Color Palette
$o-theme-color-palettes: (
    'custom-1': (
        'o-color-1': #8B35A8,  // Primary (Purple)
        'o-color-2': #6c757d,  // Secondary (Gray)
        'o-color-3': #2ECCC4,  // Accent (Teal)
        'o-color-4': #f8f9fa,  // Light Background
        'o-color-5': #212529,  // Dark/Text
    ),
);

// Typography
$o-theme-font-configs: (
    'custom-1': (
        'family': ('Inter', sans-serif),
        'family-heading': ('Inter', sans-serif),
    ),
);

// Bootstrap overrides
$primary: #8B35A8;
$secondary: #6c757d;
$success: #198754;
$info: #2ECCC4;

$font-family-sans-serif: 'Inter', system-ui, sans-serif;
$headings-font-weight: 700;

$border-radius: 0.5rem;
$border-radius-lg: 0.75rem;
$border-radius-pill: 50rem;

$box-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
$box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
$box-shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.125);
```

## Industry Templates

### Restaurant

```xml
<section class="s_restaurant_menu pt64 pb64">
    <div class="container">
        <h2 class="text-center mb-5">Our Menu</h2>
        <div class="row">
            <div class="col-md-6">
                <div class="menu-item d-flex justify-content-between mb-3">
                    <div>
                        <h5 class="mb-0">Dish Name</h5>
                        <p class="text-muted mb-0">Description</p>
                    </div>
                    <span class="price fw-bold">$12.99</span>
                </div>
            </div>
        </div>
    </div>
</section>
```

### Technology/SaaS

```xml
<section class="s_pricing pt64 pb64 bg-light">
    <div class="container">
        <h2 class="text-center mb-5">Pricing Plans</h2>
        <div class="row justify-content-center">
            <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center p-4">
                        <h5>Starter</h5>
                        <div class="display-4 fw-bold my-3">$9<small>/mo</small></div>
                        <ul class="list-unstyled">
                            <li>Feature 1</li>
                            <li>Feature 2</li>
                        </ul>
                        <a href="#" class="btn btn-outline-primary">Choose Plan</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
```

## Workflow

### Step 1: Gather Requirements

```bash
# Required inputs
THEME_NAME="theme_bakery"
DISPLAY_NAME="Sweet Dreams Bakery Theme"
INDUSTRY="restaurant"  # restaurant|technology|healthcare|legal|ecommerce|creative
ODOO_VERSION="18.0"

# Optional inputs
PRIMARY_COLOR="#8B4513"
SECONDARY_COLOR="#F5F0E8"
ACCENT_COLOR="#D2691E"
```

### Step 2: Generate Module Structure

1. Create `__manifest__.py` with proper metadata
2. Generate SCSS variables from color palette
3. Create base layout templates (header/footer)
4. Generate industry-specific page templates
5. Create page records and menu items
6. Add placeholder images

### Step 3: Validate Output

Run validation checks:
- XML syntax validation
- QWeb directive correctness
- SCSS compilation test
- Manifest field validation
- Asset path verification

### Step 4: Package for Deployment

```bash
# Create installable module
zip -r theme_bakery.zip theme_bakery/

# Or copy to addons path
cp -r theme_bakery /mnt/extra-addons/
```

## Examples

### Example 1: Basic Theme Generation

**User**: "Create a theme for a bakery called Sweet Dreams with warm brown colors"

**Output**: Complete theme module with:
- Brown/cream color palette (#8B4513, #F5F0E8)
- Restaurant-style menu section
- Gallery for product photos
- Contact form with location map
- Custom header with logo area
- Footer with hours and social links

### Example 2: Tech Startup Theme

**User**: "Generate a modern SaaS theme with pricing and features sections"

**Output**: Complete theme module with:
- Blue/purple tech palette
- Hero with animated background
- Features grid with icons
- Pricing table (3 tiers)
- Testimonials carousel
- CTA sections
- Integration logos section

## Quality Checklist

Before delivering theme:

- [ ] `__manifest__.py` has all required fields
- [ ] All XML files have proper encoding declaration
- [ ] QWeb templates use correct inheritance patterns
- [ ] SCSS variables use Odoo theme variable format
- [ ] Asset paths are correct (no 404s)
- [ ] Pages are mobile-responsive
- [ ] Color contrast meets WCAG AA
- [ ] No hardcoded company-specific content
- [ ] Bootstrap classes used correctly
- [ ] Odoo color classes (o_cc) applied

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Styles not loading | Wrong asset path | Check `assets` in manifest |
| Template not found | Missing record | Add `<record>` for website.page |
| Inheritance error | Wrong xpath | Verify parent template structure |
| Colors not applying | Missing prepend | Use `('prepend', 'path')` for variables |
| 404 on static files | Wrong module name | Match path to actual module name |

## Related Skills

- `platxa-odoo-snippet` - Custom snippet creation
- `platxa-odoo-validator` - QWeb validation
- `platxa-odoo-i18n` - Translation support
```

---

## Skill 2: platxa-odoo-snippet

### SKILL.md

```markdown
---
name: platxa-odoo-snippet
description: Create custom Odoo website builder snippets with drag-drop support, inline editing, and snippet options. Supports building blocks for landing pages, e-commerce, and corporate sites.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
metadata:
  version: "1.0.0"
  tags:
    - odoo
    - snippet
    - website-builder
    - drag-drop
  odoo_versions:
    - "17.0"
    - "18.0"
---

# Platxa Odoo Snippet Builder

Create custom website builder snippets for Odoo.

## Overview

Odoo snippets are reusable building blocks that users can drag-drop in the website builder. This skill creates:
- Snippet HTML structure
- Snippet options (colors, layouts, etc.)
- Editor registration (groups, thumbnails)
- JavaScript for dynamic behavior
- SCSS for snippet styling

## Snippet Structure

```
theme_name/
├── views/
│   └── snippets/
│       ├── s_custom_hero.xml       # Snippet template
│       └── options.xml             # Snippet options
├── static/
│   └── src/
│       ├── snippets/
│       │   └── s_custom_hero/
│       │       ├── 000.xml         # Editor registration
│       │       ├── 000.scss        # Snippet styles
│       │       └── 000.js          # Optional JS
│       └── scss/
│           └── snippets.scss       # Compiled snippet styles
└── data/
    └── ir_asset.xml                # Asset registration
```

## Snippet Template Pattern

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Snippet Template -->
    <template id="s_custom_hero" name="Custom Hero">
        <section class="s_custom_hero pt96 pb96 o_cc o_cc1"
                 data-snippet="s_custom_hero"
                 data-name="Custom Hero">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-6 s_custom_hero_content">
                        <span class="badge bg-primary mb-3 o_default_snippet_text">
                            Welcome
                        </span>
                        <h1 class="display-4 fw-bold o_default_snippet_text">
                            Your Amazing Headline
                        </h1>
                        <p class="lead text-muted o_default_snippet_text">
                            Subheadline that explains your value proposition
                            in a clear and compelling way.
                        </p>
                        <div class="s_custom_hero_buttons mt-4">
                            <a href="#" class="btn btn-primary btn-lg me-2">
                                Get Started
                            </a>
                            <a href="#" class="btn btn-outline-secondary btn-lg">
                                Learn More
                            </a>
                        </div>
                    </div>
                    <div class="col-lg-6 s_custom_hero_image">
                        <img src="/web/image/website/1/image_1920"
                             class="img-fluid rounded-3 shadow-lg"
                             alt="Hero Image"
                             loading="lazy"/>
                    </div>
                </div>
            </div>
        </section>
    </template>

    <!-- Register in Website Builder -->
    <template id="s_custom_hero_snippet"
              inherit_id="website.snippets"
              name="Custom Hero Snippet">
        <xpath expr="//div[@id='snippet_structure']//t[@t-snippet]"
               position="before">
            <t t-snippet="theme_name.s_custom_hero"
               t-thumbnail="/theme_name/static/src/img/snippets/s_custom_hero.png"/>
        </xpath>
    </template>
</odoo>
```

## Snippet Options Pattern

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="s_custom_hero_options"
              inherit_id="website.snippet_options"
              name="Custom Hero Options">
        <xpath expr="." position="inside">

            <!-- Layout Options -->
            <div data-selector=".s_custom_hero"
                 data-js="CustomHeroLayout"
                 data-drop-in=".oe_structure, .o_layout"
                 data-drop-near="section">

                <!-- Image Position -->
                <we-select string="Image Position"
                           data-attribute-name="imagePosition">
                    <we-button data-select-class="">Right</we-button>
                    <we-button data-select-class="flex-row-reverse">Left</we-button>
                </we-select>

                <!-- Text Alignment -->
                <we-select string="Text Align"
                           data-attribute-name="textAlign">
                    <we-button data-select-class="text-start">Left</we-button>
                    <we-button data-select-class="text-center">Center</we-button>
                </we-select>

                <!-- Background Style -->
                <we-select string="Background"
                           data-apply-to=".s_custom_hero">
                    <we-button data-select-class="o_cc o_cc1">Light</we-button>
                    <we-button data-select-class="o_cc o_cc4">Dark</we-button>
                    <we-button data-select-class="bg-primary text-white">Primary</we-button>
                    <we-button data-select-class="bg-gradient-primary">Gradient</we-button>
                </we-select>

            </div>

            <!-- Button Options -->
            <div data-selector=".s_custom_hero .btn"
                 data-js="Button">
                <we-select string="Style" data-attribute-name="buttonStyle">
                    <we-button data-select-class="btn-primary">Primary</we-button>
                    <we-button data-select-class="btn-secondary">Secondary</we-button>
                    <we-button data-select-class="btn-outline-primary">Outline</we-button>
                </we-select>
                <we-select string="Size" data-attribute-name="buttonSize">
                    <we-button data-select-class="btn-sm">Small</we-button>
                    <we-button data-select-class="">Normal</we-button>
                    <we-button data-select-class="btn-lg">Large</we-button>
                </we-select>
            </div>

        </xpath>
    </template>
</odoo>
```

## JavaScript for Dynamic Snippets

```javascript
/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { registry } from "@web/core/registry";

// Snippet Widget
publicWidget.registry.CustomHero = publicWidget.Widget.extend({
    selector: '.s_custom_hero',
    events: {
        'click .s_custom_hero_play': '_onPlayClick',
    },

    /**
     * @override
     */
    start() {
        this._super(...arguments);
        this._setupAnimations();
        return Promise.resolve();
    },

    /**
     * Setup scroll animations
     */
    _setupAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('s_custom_hero_visible');
                }
            });
        }, { threshold: 0.1 });

        observer.observe(this.el);
    },

    /**
     * Handle play button click
     */
    _onPlayClick(ev) {
        ev.preventDefault();
        // Open video modal
    },
});

// Snippet Editor Option
const CustomHeroLayoutOption = {
    // Editor-side logic for live preview
};

registry.category("website_editor_option")
    .add("CustomHeroLayout", CustomHeroLayoutOption);
```

## Snippet Categories

| ID | Name | Use Case |
|----|------|----------|
| `snippet_structure` | Structure | Page layout (headers, footers, columns) |
| `snippet_content` | Content | Text, images, media |
| `snippet_feature` | Features | Grids, cards, lists |
| `snippet_dynamic_content` | Dynamic Content | Forms, maps, social |

## Common Snippet Types

### 1. Hero Sections
- Full-width banner
- Split hero (text + image)
- Video background
- Parallax hero

### 2. Feature Grids
- Icon + text cards
- Image + text alternating
- Stats/numbers
- Timeline

### 3. Testimonials
- Carousel
- Grid layout
- Quote blocks
- Video testimonials

### 4. Call-to-Action
- Banner CTA
- Inline CTA
- Floating CTA
- Exit-intent popup

### 5. Contact
- Contact form
- Map + info
- Team cards
- Social links

## Workflow

### Step 1: Define Snippet Requirements

```yaml
snippet_id: s_pricing_table
name: Pricing Table
category: snippet_feature
options:
  - columns: [2, 3, 4]
  - highlight: [none, featured, popular]
  - style: [cards, minimal, bordered]
responsive: true
animations: fade-up
```

### Step 2: Generate Files

1. Create snippet template XML
2. Add snippet options
3. Register in website builder
4. Create SCSS styles
5. Add JavaScript if needed
6. Create thumbnail image

### Step 3: Test in Builder

- Drag-drop functionality
- Option panel works
- Mobile responsive
- Inline editing
- Undo/redo support

## Examples

### Example 1: Pricing Table Snippet

**User**: "Create a pricing table snippet with 3 columns and featured highlighting"

**Output**:
- `views/snippets/s_pricing_table.xml`
- `views/snippets/options.xml` (with column/highlight options)
- `static/src/snippets/s_pricing_table/000.scss`
- Thumbnail for builder

### Example 2: Testimonial Carousel

**User**: "Create a testimonial carousel snippet with avatar, quote, and navigation"

**Output**:
- Carousel HTML structure
- Navigation arrows and dots
- Auto-play option
- Responsive breakpoints

## Quality Checklist

- [ ] Snippet has `data-snippet` and `data-name` attributes
- [ ] Registered in `website.snippets` template
- [ ] Has thumbnail image (recommended: 256x150px)
- [ ] Options use correct `data-selector`
- [ ] Mobile responsive
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Uses Odoo color classes (o_cc)
- [ ] Editable text has `o_default_snippet_text`
- [ ] Images have loading="lazy"
- [ ] JavaScript is modular (OWL/ES6)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Not appearing in builder | Wrong xpath | Check snippet_structure selector |
| Options not working | Wrong data-selector | Match exact class names |
| Styles not applying | Asset not loaded | Check ir.asset registration |
| JS errors | OWL version | Use @odoo-module for Odoo 18 |

## Related Skills

- `platxa-odoo-theme` - Complete theme generation
- `platxa-odoo-validator` - XML validation
```

---

## Skill 3: platxa-odoo-validator

### SKILL.md

```markdown
---
name: platxa-odoo-validator
description: Validate Odoo QWeb templates, module manifests, and asset configurations. Checks XML syntax, QWeb directives, xpath expressions, and module dependencies.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
metadata:
  version: "1.0.0"
  tags:
    - odoo
    - validation
    - qweb
    - xml
    - linting
---

# Platxa Odoo Validator

Validate Odoo modules before deployment.

## Overview

This skill performs comprehensive validation of Odoo modules:
- XML syntax validation
- QWeb directive correctness
- Manifest field validation
- Asset path verification
- Security checks (XSS, CSRF)
- Dependency resolution

## Validation Checks

### 1. XML Syntax Validation

```bash
# Validate XML syntax
xmllint --noout views/*.xml

# Common errors:
# - Unclosed tags
# - Invalid entities
# - Encoding issues
# - Attribute quoting
```

### 2. QWeb Directive Validation

| Directive | Valid Usage | Common Errors |
|-----------|-------------|---------------|
| `t-if` | `t-if="condition"` | Missing quotes, invalid expression |
| `t-foreach` | `t-foreach="items" t-as="item"` | Missing t-as |
| `t-esc` | `t-esc="value"` | Using t-raw for user input (XSS) |
| `t-call` | `t-call="module.template"` | Non-existent template |
| `t-set` | `t-set="var" t-value="expr"` | Invalid t-value |

### 3. Xpath Validation

```python
# Valid xpath patterns
"//div[@id='wrap']"
"//header//nav"
"//xpath[@expr='...']"

# Invalid patterns (common mistakes)
"//div[@class=footer]"      # Missing quotes
"//div[id='wrap']"          # Missing @
"//xpath[expr='...']"       # Wrong attribute syntax
```

### 4. Manifest Validation

```python
# Required fields
REQUIRED_FIELDS = [
    'name',
    'version',
    'depends',
    'license',
]

# Recommended fields
RECOMMENDED_FIELDS = [
    'category',
    'summary',
    'author',
    'website',
]

# Version format: MAJOR.MINOR.PATCH (e.g., 18.0.1.0.0)
VERSION_REGEX = r'^\d+\.\d+\.\d+\.\d+\.\d+$'

# Valid licenses
VALID_LICENSES = [
    'LGPL-3', 'GPL-3', 'AGPL-3',
    'OEEL-1', 'OPL-1',
    'Other proprietary',
]
```

### 5. Asset Path Validation

```python
def validate_assets(manifest, module_path):
    """Verify all asset paths exist."""
    errors = []
    assets = manifest.get('assets', {})

    for bundle, paths in assets.items():
        for path in paths:
            # Handle tuple format ('prepend', 'path')
            if isinstance(path, (list, tuple)):
                path = path[1]

            # Remove module prefix
            if path.startswith(module_name + '/'):
                path = path[len(module_name) + 1:]

            full_path = module_path / path
            if not full_path.exists():
                errors.append(f"Missing asset: {path}")

    return errors
```

### 6. Security Validation

```python
SECURITY_RULES = {
    't-raw': {
        'severity': 'warning',
        'message': 't-raw can cause XSS if used with user input',
        'suggestion': 'Use t-esc for user-provided content',
    },
    'javascript:': {
        'severity': 'error',
        'message': 'Inline JavaScript URLs are insecure',
        'suggestion': 'Use event handlers instead',
    },
    'onclick=': {
        'severity': 'warning',
        'message': 'Inline event handlers are discouraged',
        'suggestion': 'Use JavaScript event listeners',
    },
}
```

## Validation Script

```python
#!/usr/bin/env python3
"""
Odoo Module Validator
Validates Odoo modules for common issues.
"""

import os
import re
import ast
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any

class OdooValidator:
    def __init__(self, module_path: str):
        self.module_path = Path(module_path)
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []

    def validate(self) -> Dict[str, Any]:
        """Run all validations."""
        self._validate_manifest()
        self._validate_xml_files()
        self._validate_assets()
        self._validate_security()

        return {
            'valid': len(self.errors) == 0,
            'errors': self.errors,
            'warnings': self.warnings,
            'summary': {
                'error_count': len(self.errors),
                'warning_count': len(self.warnings),
            }
        }

    def _validate_manifest(self):
        """Validate __manifest__.py."""
        manifest_path = self.module_path / '__manifest__.py'

        if not manifest_path.exists():
            self.errors.append({
                'type': 'manifest',
                'severity': 'error',
                'message': 'Missing __manifest__.py',
                'file': str(manifest_path),
            })
            return

        try:
            with open(manifest_path) as f:
                manifest = ast.literal_eval(f.read())

            # Check required fields
            for field in ['name', 'version', 'depends', 'license']:
                if field not in manifest:
                    self.errors.append({
                        'type': 'manifest',
                        'severity': 'error',
                        'message': f'Missing required field: {field}',
                        'file': str(manifest_path),
                    })

            # Validate version format
            version = manifest.get('version', '')
            if not re.match(r'^\d+\.\d+\.\d+\.\d+\.\d+$', version):
                self.warnings.append({
                    'type': 'manifest',
                    'severity': 'warning',
                    'message': f'Version "{version}" should follow format X.X.X.X.X',
                    'file': str(manifest_path),
                })

        except (SyntaxError, ValueError) as e:
            self.errors.append({
                'type': 'manifest',
                'severity': 'error',
                'message': f'Invalid Python syntax: {e}',
                'file': str(manifest_path),
            })

    def _validate_xml_files(self):
        """Validate all XML files."""
        for xml_file in self.module_path.glob('**/*.xml'):
            try:
                tree = ET.parse(xml_file)
                root = tree.getroot()

                # Validate QWeb directives
                self._validate_qweb(root, xml_file)

                # Validate xpath expressions
                self._validate_xpath(root, xml_file)

            except ET.ParseError as e:
                self.errors.append({
                    'type': 'xml',
                    'severity': 'error',
                    'message': f'XML parse error: {e}',
                    'file': str(xml_file),
                })

    def _validate_qweb(self, root: ET.Element, file_path: Path):
        """Validate QWeb directives."""
        # Check t-foreach without t-as
        for elem in root.iter():
            if 't-foreach' in elem.attrib and 't-as' not in elem.attrib:
                self.errors.append({
                    'type': 'qweb',
                    'severity': 'error',
                    'message': 't-foreach requires t-as attribute',
                    'file': str(file_path),
                    'element': elem.tag,
                })

    def _validate_xpath(self, root: ET.Element, file_path: Path):
        """Validate xpath expressions."""
        for xpath_elem in root.findall('.//xpath'):
            expr = xpath_elem.get('expr', '')

            # Check for common xpath mistakes
            if '[@class=' in expr and '[@class="' not in expr:
                self.errors.append({
                    'type': 'xpath',
                    'severity': 'error',
                    'message': f'Xpath attribute value must be quoted: {expr}',
                    'file': str(file_path),
                })

    def _validate_assets(self):
        """Validate asset paths exist."""
        manifest_path = self.module_path / '__manifest__.py'
        if not manifest_path.exists():
            return

        try:
            with open(manifest_path) as f:
                manifest = ast.literal_eval(f.read())

            module_name = self.module_path.name
            assets = manifest.get('assets', {})

            for bundle, paths in assets.items():
                for path in paths:
                    if isinstance(path, (list, tuple)):
                        path = path[1]

                    if path.startswith(module_name + '/'):
                        relative_path = path[len(module_name) + 1:]
                        full_path = self.module_path / relative_path

                        if not full_path.exists():
                            self.errors.append({
                                'type': 'asset',
                                'severity': 'error',
                                'message': f'Asset file not found: {path}',
                                'file': str(manifest_path),
                            })

        except Exception:
            pass  # Already reported in manifest validation

    def _validate_security(self):
        """Check for security issues."""
        for xml_file in self.module_path.glob('**/*.xml'):
            try:
                content = xml_file.read_text()

                # Check for t-raw usage
                if 't-raw=' in content:
                    self.warnings.append({
                        'type': 'security',
                        'severity': 'warning',
                        'message': 't-raw can cause XSS - ensure content is sanitized',
                        'file': str(xml_file),
                    })

                # Check for inline JavaScript
                if 'javascript:' in content.lower():
                    self.errors.append({
                        'type': 'security',
                        'severity': 'error',
                        'message': 'Inline JavaScript URLs are a security risk',
                        'file': str(xml_file),
                    })

            except Exception:
                pass


def main():
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: validate_odoo_module.py <module_path>")
        sys.exit(1)

    validator = OdooValidator(sys.argv[1])
    result = validator.validate()

    print(json.dumps(result, indent=2))
    sys.exit(0 if result['valid'] else 1)


if __name__ == '__main__':
    main()
```

## Workflow

### Step 1: Run Validation

```bash
# Validate single module
python validate_odoo_module.py /path/to/theme_name

# Validate all modules in directory
for module in /path/to/addons/*/; do
    python validate_odoo_module.py "$module"
done
```

### Step 2: Review Results

```json
{
  "valid": false,
  "errors": [
    {
      "type": "manifest",
      "severity": "error",
      "message": "Missing required field: license",
      "file": "/path/to/theme_name/__manifest__.py"
    }
  ],
  "warnings": [
    {
      "type": "security",
      "severity": "warning",
      "message": "t-raw can cause XSS - ensure content is sanitized",
      "file": "/path/to/theme_name/views/templates.xml"
    }
  ],
  "summary": {
    "error_count": 1,
    "warning_count": 1
  }
}
```

### Step 3: Fix Issues

Address errors before deployment, review warnings for potential issues.

## Examples

### Example 1: Validate Theme Module

**User**: "Validate theme_bakery module"

**Output**: Detailed validation report with errors and warnings.

### Example 2: Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

for module in $(git diff --cached --name-only | grep -E '^[^/]+/__manifest__.py$' | xargs dirname); do
    result=$(python validate_odoo_module.py "$module")
    if ! echo "$result" | jq -e '.valid' > /dev/null; then
        echo "Validation failed for $module:"
        echo "$result" | jq '.errors'
        exit 1
    fi
done
```

## Quality Checklist

- [ ] All XML files parse without errors
- [ ] No missing t-as for t-foreach
- [ ] All xpath expressions are valid
- [ ] Manifest has required fields
- [ ] Asset paths exist
- [ ] No obvious security issues
- [ ] SCSS compiles without errors

## Related Skills

- `platxa-odoo-theme` - Theme generation
- `platxa-odoo-snippet` - Snippet creation
```

---

## Skill 4: platxa-odoo-i18n

### SKILL.md

```markdown
---
name: platxa-odoo-i18n
description: Add internationalization support to Odoo themes and modules. Extract translatable strings, generate PO files, and configure multi-language websites.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
metadata:
  version: "1.0.0"
  tags:
    - odoo
    - i18n
    - translation
    - localization
    - multi-language
---

# Platxa Odoo Internationalization

Add multi-language support to Odoo modules.

## Overview

This skill handles:
- Extracting translatable strings from QWeb templates
- Generating PO/POT translation files
- Setting up multi-language websites
- RTL (right-to-left) language support
- Date/number formatting localization

## Translation Structure

```
theme_name/
├── i18n/
│   ├── theme_name.pot        # Template (source)
│   ├── es.po                 # Spanish
│   ├── fr.po                 # French
│   ├── de.po                 # German
│   └── ar.po                 # Arabic (RTL)
└── views/
    └── templates.xml         # With translatable strings
```

## Translatable String Patterns

### In QWeb Templates

```xml
<!-- Simple text translation -->
<span>Welcome to our website</span>

<!-- Attribute translation -->
<img alt="Company Logo" src="/logo.png"/>

<!-- Placeholder translation -->
<input placeholder="Enter your email"/>

<!-- Title translation -->
<a href="#" title="Learn more about us">About</a>
```

### Translation Extraction

```python
# Extract strings from XML
def extract_translatable(xml_content: str) -> List[str]:
    """Extract translatable strings from QWeb template."""
    strings = []
    tree = ET.fromstring(f'<root>{xml_content}</root>')

    for elem in tree.iter():
        # Text content (not in t-esc/t-raw)
        if elem.text and elem.text.strip():
            if not any(attr.startswith('t-') for attr in elem.attrib):
                strings.append(elem.text.strip())

        # Translatable attributes
        for attr in ['alt', 'title', 'placeholder', 'aria-label']:
            if attr in elem.attrib:
                strings.append(elem.attrib[attr])

    return strings
```

## PO File Format

```po
# theme_name.pot - Translation Template

#. module: theme_name
#: model:ir.ui.view,arch_db:theme_name.page_homepage
msgid "Welcome to our website"
msgstr ""

#. module: theme_name
#: model:ir.ui.view,arch_db:theme_name.page_homepage
msgid "Get Started"
msgstr ""

#. module: theme_name
#: model:ir.ui.view,arch_db:theme_name.page_about
msgid "About Us"
msgstr ""
```

## Spanish Translation Example (es.po)

```po
# Spanish translation for theme_name
# Copyright (C) 2024 Your Company
# This file is distributed under LGPL-3.
#
msgid ""
msgstr ""
"Project-Id-Version: theme_name 18.0.1.0.0\n"
"Report-Msgid-Bugs-To: \n"
"POT-Creation-Date: 2024-01-01 00:00+0000\n"
"PO-Revision-Date: 2024-01-15 12:00+0100\n"
"Last-Translator: Translator Name <email@example.com>\n"
"Language-Team: Spanish <es@li.org>\n"
"Language: es\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"

#. module: theme_name
#: model:ir.ui.view,arch_db:theme_name.page_homepage
msgid "Welcome to our website"
msgstr "Bienvenido a nuestro sitio web"

#. module: theme_name
#: model:ir.ui.view,arch_db:theme_name.page_homepage
msgid "Get Started"
msgstr "Comenzar"
```

## Multi-Language Website Setup

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Enable languages for website -->
    <function model="res.lang" name="_activate_lang">
        <value>es_ES</value>
    </function>
    <function model="res.lang" name="_activate_lang">
        <value>fr_FR</value>
    </function>

    <!-- Set website languages -->
    <record id="website.default_website" model="website">
        <field name="language_ids" eval="[(6, 0, [
            ref('base.lang_en'),
            ref('base.lang_es'),
            ref('base.lang_fr'),
        ])]"/>
        <field name="default_lang_id" ref="base.lang_en"/>
    </record>
</odoo>
```

## RTL Language Support

```scss
// RTL support in SCSS
[dir="rtl"] {
    .text-start { text-align: right !important; }
    .text-end { text-align: left !important; }
    .ms-auto { margin-left: 0 !important; margin-right: auto !important; }
    .me-auto { margin-right: 0 !important; margin-left: auto !important; }

    // Flip specific components
    .navbar-nav { flex-direction: row-reverse; }
    .dropdown-menu { text-align: right; }
}

// Arabic-specific styles
:lang(ar) {
    font-family: 'Noto Sans Arabic', sans-serif;
    line-height: 1.8;
}
```

## Workflow

### Step 1: Mark Strings for Translation

Ensure all user-facing text is translatable:

```xml
<!-- Good: Plain text is translatable -->
<h1>Welcome to our website</h1>

<!-- Good: Translatable attribute -->
<img alt="Company Logo" src="/logo.png"/>

<!-- Bad: Dynamic text without translation -->
<span t-esc="company_name"/>  <!-- This is data, not translated -->
```

### Step 2: Extract Strings

```bash
# Using Odoo's built-in extraction
./odoo-bin -c odoo.conf --modules=theme_name --i18n-export=/path/to/theme_name.pot

# Or using custom script
python extract_translations.py /path/to/theme_name
```

### Step 3: Translate

1. Send POT file to translators
2. Receive translated PO files
3. Place in `i18n/` directory

### Step 4: Load Translations

```bash
# Import translations
./odoo-bin -c odoo.conf -u theme_name --i18n-import=/path/to/es.po

# Or automatic on module update
./odoo-bin -c odoo.conf -u theme_name
```

## Examples

### Example 1: Generate POT File

**User**: "Extract translations from theme_bakery"

**Output**: `theme_bakery.pot` with all translatable strings.

### Example 2: Add Spanish Translation

**User**: "Add Spanish translation for theme_bakery"

**Output**: `es.po` file with Spanish translations.

## Quality Checklist

- [ ] All user-facing text is translatable
- [ ] POT file is up to date
- [ ] PO files have proper headers
- [ ] Plurals are handled correctly
- [ ] RTL languages are supported
- [ ] Date/number formats are localized
- [ ] Images have translatable alt text

## Related Skills

- `platxa-odoo-theme` - Theme generation
- `platxa-odoo-validator` - Validation
```

---

## File Structure for All Skills

```
platxa-skill-generator/
└── catalog/
    ├── platxa-odoo-theme/
    │   ├── SKILL.md
    │   ├── docs/
    │   │   ├── README.md
    │   │   ├── quick-start.md
    │   │   └── industry-templates.md
    │   ├── references/
    │   │   ├── manifest-fields.md
    │   │   ├── qweb-patterns.md
    │   │   └── scss-variables.md
    │   └── examples/
    │       ├── theme_restaurant/
    │       ├── theme_tech/
    │       └── theme_healthcare/
    │
    ├── platxa-odoo-snippet/
    │   ├── SKILL.md
    │   ├── docs/
    │   │   ├── README.md
    │   │   └── snippet-options.md
    │   ├── references/
    │   │   ├── snippet-categories.md
    │   │   └── javascript-patterns.md
    │   └── examples/
    │       ├── s_hero/
    │       ├── s_pricing/
    │       └── s_testimonials/
    │
    ├── platxa-odoo-validator/
    │   ├── SKILL.md
    │   ├── docs/
    │   │   └── README.md
    │   ├── scripts/
    │   │   └── validate_odoo_module.py
    │   └── references/
    │       ├── validation-rules.md
    │       └── security-checks.md
    │
    ├── platxa-odoo-i18n/
    │   ├── SKILL.md
    │   ├── docs/
    │   │   └── README.md
    │   ├── scripts/
    │   │   └── extract_translations.py
    │   └── references/
    │       ├── po-format.md
    │       └── rtl-support.md
    │
    ├── platxa-odoo-ecommerce/
    │   ├── SKILL.md
    │   └── docs/
    │       └── README.md
    │
    └── platxa-odoo-seo/
        ├── SKILL.md
        └── docs/
            └── README.md
```

---

## Integration with Existing System

### Register Skills in Claude Settings

```json
// .claude/settings.json (addition)
{
  "skills": {
    "platxa-odoo-theme": {
      "path": "platxa-skill-generator/catalog/platxa-odoo-theme",
      "autoload": true
    },
    "platxa-odoo-snippet": {
      "path": "platxa-skill-generator/catalog/platxa-odoo-snippet",
      "autoload": true
    },
    "platxa-odoo-validator": {
      "path": "platxa-skill-generator/catalog/platxa-odoo-validator",
      "autoload": true
    },
    "platxa-odoo-i18n": {
      "path": "platxa-skill-generator/catalog/platxa-odoo-i18n",
      "autoload": false
    }
  }
}
```

### Use in AI System Prompts

```typescript
// lib/ai/system-prompts.ts (addition)

export const SKILL_CONTEXT = `
## Available Odoo Skills

When generating Odoo code, follow these skill guidelines:

### Theme Generation (platxa-odoo-theme)
- Use proper manifest format for Odoo 18
- Follow SCSS variable naming conventions
- Apply industry-specific design patterns

### Snippet Creation (platxa-odoo-snippet)
- Register snippets in website.snippets
- Include snippet options for customization
- Use o_default_snippet_text for editable areas

### Validation (platxa-odoo-validator)
- Validate XML syntax before output
- Check xpath expressions are correct
- Verify asset paths exist

### Internationalization (platxa-odoo-i18n)
- Keep all user-facing text translatable
- Use proper PO file format
- Support RTL languages
`;
```

---

## Success Criteria

| Skill | Target | Measurement |
|-------|--------|-------------|
| platxa-odoo-theme | 95% valid themes | Validator pass rate |
| platxa-odoo-snippet | Works in builder | Manual testing |
| platxa-odoo-validator | Catches 90% issues | Known issue detection |
| platxa-odoo-i18n | Complete extraction | String coverage |

---

## Next Steps

1. Create skill directory structure
2. Write SKILL.md for each skill
3. Create reference documentation
4. Build example files
5. Write validation scripts
6. Test integration with website-studio
7. Update system prompts to use skills

---

*Plan created: 2026-01-23*
*Author: Claude Code Analysis*
