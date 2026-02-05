/**
 * OdooMenuGenerator - Generates website.menu records and QWeb templates
 *
 * Creates Odoo-compatible navigation menu structures with proper XML-RPC
 * records and corresponding QWeb template snippets for website navigation.
 */

// ============================================================================
// Types
// ============================================================================

export interface MenuItem {
  id: string;
  name: string;
  url?: string;
  pageRef?: string; // Reference to website.page
  parentId?: string;
  sequence: number;
  isVisible: boolean;
  newWindow: boolean;
  children?: MenuItem[];
  cssClass?: string;
  icon?: string;
  megaMenu?: MegaMenuConfig;
}

export interface MegaMenuConfig {
  enabled: boolean;
  columns: MegaMenuColumn[];
  width?: 'full' | 'auto' | number;
  background?: string;
  showImages?: boolean;
}

export interface MegaMenuColumn {
  title?: string;
  items: MenuItem[];
  width?: number; // 1-12 grid columns
  featured?: FeaturedItem;
}

export interface FeaturedItem {
  title: string;
  description?: string;
  image?: string;
  url: string;
  buttonText?: string;
}

export interface MenuGeneratorOptions {
  websiteId: number;
  menuName?: string;
  rootMenuId?: number;
  generateQWeb?: boolean;
  qwebTemplateId?: string;
  includeFooterMenu?: boolean;
  mobileBreakpoint?: number;
  stickyHeader?: boolean;
  transparentHeader?: boolean;
}

export interface GeneratedMenu {
  records: OdooMenuRecord[];
  qweb: string;
  scss?: string;
  javascript?: string;
  metadata: MenuMetadata;
}

export interface OdooMenuRecord {
  id?: number;
  name: string;
  url: string;
  page_id?: number | false;
  parent_id?: number | false;
  sequence: number;
  website_id: number;
  is_visible: boolean;
  new_window: boolean;
  mega_menu_content?: string;
  mega_menu_classes?: string;
}

export interface MenuMetadata {
  totalItems: number;
  maxDepth: number;
  hasMegaMenus: boolean;
  hasExternalLinks: boolean;
  generatedAt: Date;
}

// ============================================================================
// OdooMenuGenerator Class
// ============================================================================

export class OdooMenuGenerator {
  private options: Required<MenuGeneratorOptions>;
  private idCounter: number = 1000;

  constructor(options: MenuGeneratorOptions) {
    this.options = {
      websiteId: options.websiteId,
      menuName: options.menuName || 'Main Menu',
      rootMenuId: options.rootMenuId || 0,
      generateQWeb: options.generateQWeb ?? true,
      qwebTemplateId: options.qwebTemplateId || 'website.main_menu',
      includeFooterMenu: options.includeFooterMenu ?? false,
      mobileBreakpoint: options.mobileBreakpoint || 992,
      stickyHeader: options.stickyHeader ?? false,
      transparentHeader: options.transparentHeader ?? false,
    };
  }

  /**
   * Generate menu records and QWeb from menu items
   */
  generate(items: MenuItem[]): GeneratedMenu {
    const records = this.generateRecords(items);
    const qweb = this.options.generateQWeb ? this.generateQWeb(items) : '';
    const scss = this.generateScss(items);
    const javascript = this.generateJavaScript(items);
    const metadata = this.calculateMetadata(items);

    return {
      records,
      qweb,
      scss,
      javascript,
      metadata,
    };
  }

  /**
   * Generate Odoo menu records
   */
  private generateRecords(
    items: MenuItem[],
    parentId?: number
  ): OdooMenuRecord[] {
    const records: OdooMenuRecord[] = [];

    for (const item of items) {
      const recordId = this.getNextId();

      const record: OdooMenuRecord = {
        id: recordId,
        name: item.name,
        url: this.resolveUrl(item),
        page_id: item.pageRef ? this.parsePageRef(item.pageRef) : false,
        parent_id: parentId || this.options.rootMenuId || false,
        sequence: item.sequence,
        website_id: this.options.websiteId,
        is_visible: item.isVisible,
        new_window: item.newWindow,
      };

      // Add mega menu content if configured
      if (item.megaMenu?.enabled) {
        record.mega_menu_content = this.generateMegaMenuContent(item.megaMenu);
        record.mega_menu_classes = 'o_mega_menu';
      }

      records.push(record);

      // Process children recursively
      if (item.children && item.children.length > 0) {
        const childRecords = this.generateRecords(item.children, recordId);
        records.push(...childRecords);
      }
    }

    return records;
  }

  /**
   * Generate QWeb template for the menu
   */
  private generateQWeb(items: MenuItem[]): string {
    const headerClasses = [
      'o_header_standard',
      this.options.stickyHeader ? 'o_header_sticky' : '',
      this.options.transparentHeader ? 'o_header_transparent' : '',
    ].filter(Boolean).join(' ');

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="${this.escapeXml(this.options.qwebTemplateId)}" name="${this.escapeXml(this.options.menuName)}">
    <header class="${headerClasses}">
      <nav class="navbar navbar-expand-lg navbar-light o_navbar">
        <div class="container">
          <!-- Logo -->
          <a class="navbar-brand" href="/" t-attf-class="logo">
            <span t-field="website.logo" t-options="{'widget': 'image'}"/>
          </a>

          <!-- Mobile Toggle -->
          <button class="navbar-toggler" type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#navbarContent"
                  aria-controls="navbarContent"
                  aria-expanded="false"
                  aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"/>
          </button>

          <!-- Navigation Content -->
          <div class="collapse navbar-collapse" id="navbarContent">
            <ul class="navbar-nav ms-auto">
${this.generateMenuItemsQWeb(items, 14)}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  </template>

${this.generateMegaMenuTemplates(items)}
</odoo>`;
  }

  /**
   * Generate QWeb for menu items
   */
  private generateMenuItemsQWeb(items: MenuItem[], indent: number): string {
    const pad = ' '.repeat(indent);
    let qweb = '';

    for (const item of items) {
      const hasChildren = item.children && item.children.length > 0;
      const hasMegaMenu = item.megaMenu?.enabled;

      if (hasChildren || hasMegaMenu) {
        qweb += `${pad}<li class="nav-item dropdown${item.cssClass ? ' ' + this.escapeXml(item.cssClass) : ''}">
${pad}  <a class="nav-link dropdown-toggle" href="#" role="button"
${pad}     data-bs-toggle="dropdown" aria-expanded="false"${item.icon ? `>\n${pad}    <i class="${this.escapeXml(item.icon)}"></i> ` : '>'}
${pad}    ${this.escapeXml(item.name)}
${pad}  </a>
`;
        if (hasMegaMenu) {
          qweb += `${pad}  <div class="dropdown-menu o_mega_menu" role="menu">
${pad}    <t t-call="${this.escapeXml(this.options.qwebTemplateId)}_mega_${this.escapeXml(item.id)}"/>
${pad}  </div>
`;
        } else if (hasChildren) {
          qweb += `${pad}  <ul class="dropdown-menu">
${this.generateDropdownItemsQWeb(item.children!, indent + 4)}
${pad}  </ul>
`;
        }
        qweb += `${pad}</li>\n`;
      } else {
        const target = item.newWindow ? ' target="_blank" rel="noopener"' : '';
        qweb += `${pad}<li class="nav-item${item.cssClass ? ' ' + this.escapeXml(item.cssClass) : ''}">
${pad}  <a class="nav-link" href="${this.escapeXml(this.resolveUrl(item))}"${target}${item.icon ? `>\n${pad}    <i class="${this.escapeXml(item.icon)}"></i> ` : '>'}
${pad}    ${this.escapeXml(item.name)}
${pad}  </a>
${pad}</li>\n`;
      }
    }

    return qweb;
  }

  /**
   * Generate QWeb for dropdown items
   */
  private generateDropdownItemsQWeb(items: MenuItem[], indent: number): string {
    const pad = ' '.repeat(indent);
    let qweb = '';

    for (const item of items) {
      const hasChildren = item.children && item.children.length > 0;
      const target = item.newWindow ? ' target="_blank" rel="noopener"' : '';

      if (hasChildren) {
        qweb += `${pad}<li class="dropdown-submenu">
${pad}  <a class="dropdown-item dropdown-toggle" href="${this.escapeXml(this.resolveUrl(item))}"${target}>
${pad}    ${this.escapeXml(item.name)}
${pad}  </a>
${pad}  <ul class="dropdown-menu">
${this.generateDropdownItemsQWeb(item.children!, indent + 4)}
${pad}  </ul>
${pad}</li>\n`;
      } else {
        qweb += `${pad}<li>
${pad}  <a class="dropdown-item" href="${this.escapeXml(this.resolveUrl(item))}"${target}>
${pad}    ${this.escapeXml(item.name)}
${pad}  </a>
${pad}</li>\n`;
      }
    }

    return qweb;
  }

  /**
   * Generate mega menu templates
   */
  private generateMegaMenuTemplates(items: MenuItem[]): string {
    let templates = '';

    for (const item of items) {
      if (item.megaMenu?.enabled) {
        templates += this.generateMegaMenuTemplate(item);
      }

      if (item.children) {
        templates += this.generateMegaMenuTemplates(item.children);
      }
    }

    return templates;
  }

  /**
   * Generate a single mega menu template
   */
  private generateMegaMenuTemplate(item: MenuItem): string {
    const megaMenu = item.megaMenu!;
    const widthClass = megaMenu.width === 'full' ? 'w-100' : '';

    let columnsQweb = '';
    for (const column of megaMenu.columns) {
      const colWidth = column.width || Math.floor(12 / megaMenu.columns.length);
      columnsQweb += `      <div class="col-lg-${colWidth}">
`;
      if (column.title) {
        columnsQweb += `        <h6 class="mega-menu-title">${this.escapeXml(column.title)}</h6>
`;
      }
      columnsQweb += `        <ul class="list-unstyled mega-menu-list">
`;
      for (const subItem of column.items) {
        const target = subItem.newWindow ? ' target="_blank" rel="noopener"' : '';
        columnsQweb += `          <li>
            <a href="${this.escapeXml(this.resolveUrl(subItem))}"${target}>${this.escapeXml(subItem.name)}</a>
          </li>
`;
      }
      columnsQweb += `        </ul>
`;
      if (column.featured) {
        columnsQweb += this.generateFeaturedItemQweb(column.featured);
      }
      columnsQweb += `      </div>
`;
    }

    return `
  <template id="${this.escapeXml(this.options.qwebTemplateId)}_mega_${this.escapeXml(item.id)}" name="Mega Menu: ${this.escapeXml(item.name)}">
    <div class="container-fluid ${widthClass}"${megaMenu.background ? ` style="background: ${this.escapeXml(megaMenu.background)}"` : ''}>
      <div class="row">
${columnsQweb}      </div>
    </div>
  </template>
`;
  }

  /**
   * Generate featured item QWeb
   */
  private generateFeaturedItemQweb(featured: FeaturedItem): string {
    let qweb = `        <div class="mega-menu-featured mt-3 p-3 bg-light rounded">
`;
    if (featured.image) {
      qweb += `          <img src="${this.escapeXml(featured.image)}" class="img-fluid mb-2" alt="${this.escapeXml(featured.title)}"/>
`;
    }
    qweb += `          <h6>${this.escapeXml(featured.title)}</h6>
`;
    if (featured.description) {
      qweb += `          <p class="small text-muted">${this.escapeXml(featured.description)}</p>
`;
    }
    qweb += `          <a href="${this.escapeXml(featured.url)}" class="btn btn-primary btn-sm">
            ${this.escapeXml(featured.buttonText || 'Learn More')}
          </a>
        </div>
`;
    return qweb;
  }

  /**
   * Generate mega menu HTML content for Odoo record
   */
  private generateMegaMenuContent(megaMenu: MegaMenuConfig): string {
    let content = '<div class="container">\n  <div class="row">\n';

    for (const column of megaMenu.columns) {
      const colWidth = column.width || Math.floor(12 / megaMenu.columns.length);
      content += `    <div class="col-lg-${colWidth}">\n`;

      if (column.title) {
        content += `      <h6 class="fw-bold mb-3">${this.escapeHtml(column.title)}</h6>\n`;
      }

      content += '      <ul class="list-unstyled">\n';
      for (const item of column.items) {
        const target = item.newWindow ? ' target="_blank" rel="noopener"' : '';
        content += `        <li class="mb-2"><a href="${this.escapeHtml(this.resolveUrl(item))}"${target}>${this.escapeHtml(item.name)}</a></li>\n`;
      }
      content += '      </ul>\n';

      if (column.featured) {
        content += this.generateFeaturedItemHtml(column.featured);
      }

      content += '    </div>\n';
    }

    content += '  </div>\n</div>';
    return content;
  }

  /**
   * Generate featured item HTML
   */
  private generateFeaturedItemHtml(featured: FeaturedItem): string {
    let html = '      <div class="mt-4 p-3 bg-light rounded">\n';
    if (featured.image) {
      html += `        <img src="${this.escapeHtml(featured.image)}" class="img-fluid mb-2" alt="${this.escapeHtml(featured.title)}"/>\n`;
    }
    html += `        <h6 class="fw-bold">${this.escapeHtml(featured.title)}</h6>\n`;
    if (featured.description) {
      html += `        <p class="small text-muted">${this.escapeHtml(featured.description)}</p>\n`;
    }
    html += `        <a href="${this.escapeHtml(featured.url)}" class="btn btn-primary btn-sm">${this.escapeHtml(featured.buttonText || 'Learn More')}</a>\n`;
    html += '      </div>\n';
    return html;
  }

  /**
   * Generate SCSS for custom styling
   */
  private generateScss(items: MenuItem[]): string {
    const hasMegaMenu = this.hasMegaMenuItems(items);

    return `// Generated Menu Styles
// Website ID: ${this.options.websiteId}
// Generated: ${new Date().toISOString()}

.o_navbar {
  transition: all 0.3s ease;

  .navbar-brand {
    img {
      max-height: 50px;
      width: auto;
    }
  }

  .nav-link {
    padding: 0.75rem 1rem;
    font-weight: 500;
    transition: color 0.2s ease;

    &:hover {
      color: var(--o-color-primary);
    }
  }

  .dropdown-menu {
    border: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 0.5rem 0;

    .dropdown-item {
      padding: 0.5rem 1.25rem;

      &:hover {
        background-color: var(--o-color-primary-light, #f0f7ff);
        color: var(--o-color-primary);
      }
    }
  }

  // Dropdown submenu support
  .dropdown-submenu {
    position: relative;

    > .dropdown-menu {
      top: 0;
      left: 100%;
      margin-top: -0.5rem;
    }

    &:hover > .dropdown-menu {
      display: block;
    }
  }
}

${this.options.stickyHeader ? `
// Sticky Header
.o_header_sticky {
  position: sticky;
  top: 0;
  z-index: 1030;
  background: white;

  &.scrolled {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
}
` : ''}

${this.options.transparentHeader ? `
// Transparent Header
.o_header_transparent {
  position: absolute;
  width: 100%;
  background: transparent;

  .nav-link {
    color: white;

    &:hover {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  &.scrolled {
    position: fixed;
    background: white;

    .nav-link {
      color: inherit;
    }
  }
}
` : ''}

${hasMegaMenu ? `
// Mega Menu Styles
.o_mega_menu {
  width: 100%;
  padding: 1.5rem;

  .mega-menu-title {
    font-weight: 600;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--o-color-primary);
  }

  .mega-menu-list {
    li {
      margin-bottom: 0.5rem;

      a {
        color: inherit;
        text-decoration: none;
        transition: color 0.2s ease;

        &:hover {
          color: var(--o-color-primary);
        }
      }
    }
  }

  .mega-menu-featured {
    background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);

    img {
      border-radius: 4px;
    }
  }
}
` : ''}

// Mobile Styles
@media (max-width: ${this.options.mobileBreakpoint - 1}px) {
  .o_navbar {
    .navbar-collapse {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      margin-top: 0.5rem;
    }

    .nav-link {
      padding: 0.75rem 0;
      border-bottom: 1px solid #eee;
    }

    .dropdown-menu {
      position: static;
      box-shadow: none;
      padding-left: 1rem;
    }

    ${hasMegaMenu ? `
    .o_mega_menu {
      padding: 0.75rem;

      .row > div {
        margin-bottom: 1.5rem;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
    ` : ''}
  }
}
`;
  }

  /**
   * Generate JavaScript for menu interactions
   */
  private generateJavaScript(items: MenuItem[]): string {
    return `// Generated Menu JavaScript
// Website ID: ${this.options.websiteId}
// Generated: ${new Date().toISOString()}

odoo.define('website.menu_${this.options.websiteId}', function (require) {
  'use strict';

  const publicWidget = require('web.public.widget');

  publicWidget.registry.MainMenu${this.options.websiteId} = publicWidget.Widget.extend({
    selector: '.o_navbar',

    start: function () {
      this._super.apply(this, arguments);
      this._initStickyHeader();
      this._initDropdowns();
      this._initMobileMenu();
      return this._super.apply(this, arguments);
    },

    ${this.options.stickyHeader || this.options.transparentHeader ? `
    _initStickyHeader: function () {
      const header = this.$el.closest('header');
      const scrollThreshold = 50;

      $(window).on('scroll.menu', _.throttle(() => {
        if ($(window).scrollTop() > scrollThreshold) {
          header.addClass('scrolled');
        } else {
          header.removeClass('scrolled');
        }
      }, 100));
    },
    ` : `
    _initStickyHeader: function () {
      // Sticky header not enabled
    },
    `}

    _initDropdowns: function () {
      // Handle dropdown hover on desktop
      if (window.innerWidth >= ${this.options.mobileBreakpoint}) {
        this.$('.nav-item.dropdown').on('mouseenter', function () {
          $(this).find('.dropdown-menu').first().stop(true, true).slideDown(200);
        }).on('mouseleave', function () {
          $(this).find('.dropdown-menu').first().stop(true, true).slideUp(200);
        });
      }

      // Handle nested dropdowns
      this.$('.dropdown-submenu > a').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).next('.dropdown-menu').toggle();
      });
    },

    _initMobileMenu: function () {
      // Close mobile menu on link click
      this.$('.navbar-nav .nav-link:not(.dropdown-toggle)').on('click', () => {
        if (window.innerWidth < ${this.options.mobileBreakpoint}) {
          this.$('.navbar-collapse').collapse('hide');
        }
      });
    },

    destroy: function () {
      $(window).off('scroll.menu');
      this._super.apply(this, arguments);
    },
  });

  return publicWidget.registry.MainMenu${this.options.websiteId};
});
`;
  }

  /**
   * Calculate metadata about the menu
   */
  private calculateMetadata(items: MenuItem[]): MenuMetadata {
    let totalItems = 0;
    let maxDepth = 0;
    let hasMegaMenus = false;
    let hasExternalLinks = false;

    const traverse = (menuItems: MenuItem[], depth: number) => {
      for (const item of menuItems) {
        totalItems++;
        maxDepth = Math.max(maxDepth, depth);

        if (item.megaMenu?.enabled) {
          hasMegaMenus = true;
        }

        if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
          hasExternalLinks = true;
        }

        if (item.children && item.children.length > 0) {
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(items, 1);

    return {
      totalItems,
      maxDepth,
      hasMegaMenus,
      hasExternalLinks,
      generatedAt: new Date(),
    };
  }

  /**
   * Check if any items have mega menus
   */
  private hasMegaMenuItems(items: MenuItem[]): boolean {
    for (const item of items) {
      if (item.megaMenu?.enabled) return true;
      if (item.children && this.hasMegaMenuItems(item.children)) return true;
    }
    return false;
  }

  /**
   * Resolve URL from item
   */
  private resolveUrl(item: MenuItem): string {
    if (item.url) return item.url;
    if (item.pageRef) return `/page/${item.pageRef}`;
    return '#';
  }

  /**
   * Parse page reference to ID
   */
  private parsePageRef(pageRef: string): number | false {
    const match = pageRef.match(/^page_(\d+)$/);
    return match ? parseInt(match[1], 10) : false;
  }

  /**
   * Get next unique ID
   */
  private getNextId(): number {
    return this.idCounter++;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a simple menu from a flat list
 */
export function createSimpleMenu(
  items: Array<{ name: string; url: string; newWindow?: boolean }>,
  options: MenuGeneratorOptions
): GeneratedMenu {
  const generator = new OdooMenuGenerator(options);

  const menuItems: MenuItem[] = items.map((item, index) => ({
    id: `menu_${index}`,
    name: item.name,
    url: item.url,
    sequence: (index + 1) * 10,
    isVisible: true,
    newWindow: item.newWindow || false,
  }));

  return generator.generate(menuItems);
}

/**
 * Create a menu with dropdown support
 */
export function createDropdownMenu(
  structure: Array<{
    name: string;
    url?: string;
    children?: Array<{ name: string; url: string }>;
  }>,
  options: MenuGeneratorOptions
): GeneratedMenu {
  const generator = new OdooMenuGenerator(options);

  const menuItems: MenuItem[] = structure.map((item, index) => ({
    id: `menu_${index}`,
    name: item.name,
    url: item.url,
    sequence: (index + 1) * 10,
    isVisible: true,
    newWindow: false,
    children: item.children?.map((child, childIndex) => ({
      id: `menu_${index}_${childIndex}`,
      name: child.name,
      url: child.url,
      sequence: (childIndex + 1) * 10,
      isVisible: true,
      newWindow: false,
    })),
  }));

  return generator.generate(menuItems);
}

/**
 * Create menu items from website pages
 */
export function createMenuFromPages(
  pages: Array<{ id: number; name: string; url: string }>,
  options: MenuGeneratorOptions
): GeneratedMenu {
  const generator = new OdooMenuGenerator(options);

  const menuItems: MenuItem[] = pages.map((page, index) => ({
    id: `page_${page.id}`,
    name: page.name,
    pageRef: `page_${page.id}`,
    url: page.url,
    sequence: (index + 1) * 10,
    isVisible: true,
    newWindow: false,
  }));

  return generator.generate(menuItems);
}

// ============================================================================
// Menu Builder (Fluent API)
// ============================================================================

export class MenuBuilder {
  private items: MenuItem[] = [];
  private currentItem: MenuItem | null = null;
  private options: MenuGeneratorOptions;

  constructor(options: MenuGeneratorOptions) {
    this.options = options;
  }

  addItem(name: string, url?: string): this {
    this.currentItem = {
      id: `menu_${this.items.length}`,
      name,
      url,
      sequence: (this.items.length + 1) * 10,
      isVisible: true,
      newWindow: false,
    };
    this.items.push(this.currentItem);
    return this;
  }

  withIcon(icon: string): this {
    if (this.currentItem) {
      this.currentItem.icon = icon;
    }
    return this;
  }

  withCssClass(cssClass: string): this {
    if (this.currentItem) {
      this.currentItem.cssClass = cssClass;
    }
    return this;
  }

  openInNewWindow(): this {
    if (this.currentItem) {
      this.currentItem.newWindow = true;
    }
    return this;
  }

  hidden(): this {
    if (this.currentItem) {
      this.currentItem.isVisible = false;
    }
    return this;
  }

  addChild(name: string, url: string): this {
    if (this.currentItem) {
      if (!this.currentItem.children) {
        this.currentItem.children = [];
      }
      this.currentItem.children.push({
        id: `${this.currentItem.id}_${this.currentItem.children.length}`,
        name,
        url,
        sequence: (this.currentItem.children.length + 1) * 10,
        isVisible: true,
        newWindow: false,
      });
    }
    return this;
  }

  withMegaMenu(columns: MegaMenuColumn[]): this {
    if (this.currentItem) {
      this.currentItem.megaMenu = {
        enabled: true,
        columns,
      };
    }
    return this;
  }

  build(): GeneratedMenu {
    const generator = new OdooMenuGenerator(this.options);
    return generator.generate(this.items);
  }
}

/**
 * Create a new menu builder
 */
export function menuBuilder(options: MenuGeneratorOptions): MenuBuilder {
  return new MenuBuilder(options);
}

export default OdooMenuGenerator;
