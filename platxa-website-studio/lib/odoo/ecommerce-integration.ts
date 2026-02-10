/**
 * OdooEcommerceIntegration - Product displays and cart functionality
 *
 * Generates Odoo-compatible e-commerce components integrated with website_sale,
 * including product listings, product cards, cart widgets, and checkout flows.
 */

// ============================================================================
// Types
// ============================================================================

export interface Product {
  id: number;
  name: string;
  description?: string;
  descriptionSale?: string;
  price: number;
  listPrice: number;
  comparePrice?: number;
  currency: string;
  currencySymbol: string;
  images: ProductImage[];
  categories: ProductCategory[];
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  stock: StockInfo;
  rating?: ProductRating;
  badges?: ProductBadge[];
  seoUrl?: string;
  isPublished: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  alt?: string;
  isPrimary: boolean;
  sequence: number;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  parentId?: number;
  sequence: number;
}

export interface ProductVariant {
  id: number;
  name: string;
  price: number;
  priceExtra: number;
  sku?: string;
  barcode?: string;
  stock: StockInfo;
  attributeValues: AttributeValue[];
  image?: ProductImage;
}

export interface ProductAttribute {
  id: number;
  name: string;
  displayType: 'radio' | 'select' | 'color' | 'pills';
  values: AttributeValue[];
}

export interface AttributeValue {
  id: number;
  name: string;
  htmlColor?: string;
  image?: string;
  priceExtra?: number;
}

export interface StockInfo {
  quantity: number;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'made_to_order';
  showQuantity: boolean;
  lowStockThreshold?: number;
}

export interface ProductRating {
  average: number;
  count: number;
  distribution?: Record<number, number>;
}

export interface ProductBadge {
  type: 'sale' | 'new' | 'bestseller' | 'limited' | 'custom';
  text: string;
  color?: string;
  backgroundColor?: string;
}

export interface CartItem {
  productId: number;
  variantId?: number;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  image?: string;
  attributes?: string[];
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency: string;
  currencySymbol: string;
  itemCount: number;
}

// ============================================================================
// Generation Options
// ============================================================================

export interface ProductListingOptions {
  websiteId: number;
  templateId?: string;
  layout: 'grid' | 'list' | 'masonry';
  columns: 2 | 3 | 4 | 6;
  showFilters: boolean;
  showSorting: boolean;
  showPagination: boolean;
  productsPerPage: number;
  showQuickView: boolean;
  showAddToCart: boolean;
  showWishlist: boolean;
  showCompare: boolean;
  showRating: boolean;
  showBadges: boolean;
  lazyLoadImages: boolean;
  infiniteScroll: boolean;
}

export interface ProductCardOptions {
  showImage: boolean;
  imageRatio: '1:1' | '4:3' | '3:4' | '16:9';
  showName: boolean;
  showPrice: boolean;
  showComparePrice: boolean;
  showDescription: boolean;
  descriptionLines: number;
  showRating: boolean;
  showBadges: boolean;
  showAddToCart: boolean;
  showQuickActions: boolean;
  hoverEffect: 'none' | 'zoom' | 'overlay' | 'slide';
}

export interface CartWidgetOptions {
  style: 'dropdown' | 'sidebar' | 'modal';
  showItemCount: boolean;
  showSubtotal: boolean;
  showItemImages: boolean;
  showQuantityControls: boolean;
  showRemoveButton: boolean;
  checkoutButtonStyle: 'primary' | 'accent';
  emptyCartMessage?: string;
}

export interface GeneratedEcommerce {
  qweb: string;
  scss: string;
  javascript: string;
  xmlData?: string;
  metadata: EcommerceMetadata;
}

export interface EcommerceMetadata {
  componentType: string;
  generatedAt: Date;
  options: ProductListingOptions | ProductCardOptions | CartWidgetOptions;
}

// ============================================================================
// OdooEcommerceIntegration Class
// ============================================================================

export class OdooEcommerceIntegration {
  private websiteId: number;

  constructor(websiteId: number) {
    this.websiteId = websiteId;
  }

  /**
   * Generate a product listing page
   */
  generateProductListing(options: Partial<ProductListingOptions> = {}): GeneratedEcommerce {
    const opts: ProductListingOptions = {
      websiteId: this.websiteId,
      templateId: `website_sale.products_${this.websiteId}`,
      layout: 'grid',
      columns: 4,
      showFilters: true,
      showSorting: true,
      showPagination: true,
      productsPerPage: 20,
      showQuickView: true,
      showAddToCart: true,
      showWishlist: true,
      showCompare: false,
      showRating: true,
      showBadges: true,
      lazyLoadImages: true,
      infiniteScroll: false,
      ...options,
    };

    return {
      qweb: this.generateProductListingQWeb(opts),
      scss: this.generateProductListingScss(opts),
      javascript: this.generateProductListingJs(opts),
      metadata: {
        componentType: 'product_listing',
        generatedAt: new Date(),
        options: opts,
      },
    };
  }

  /**
   * Generate a product card component
   */
  generateProductCard(options: Partial<ProductCardOptions> = {}): GeneratedEcommerce {
    const opts: ProductCardOptions = {
      showImage: true,
      imageRatio: '1:1',
      showName: true,
      showPrice: true,
      showComparePrice: true,
      showDescription: false,
      descriptionLines: 2,
      showRating: true,
      showBadges: true,
      showAddToCart: true,
      showQuickActions: true,
      hoverEffect: 'zoom',
      ...options,
    };

    return {
      qweb: this.generateProductCardQWeb(opts),
      scss: this.generateProductCardScss(opts),
      javascript: this.generateProductCardJs(opts),
      metadata: {
        componentType: 'product_card',
        generatedAt: new Date(),
        options: opts,
      },
    };
  }

  /**
   * Generate a cart widget
   */
  generateCartWidget(options: Partial<CartWidgetOptions> = {}): GeneratedEcommerce {
    const opts: CartWidgetOptions = {
      style: 'dropdown',
      showItemCount: true,
      showSubtotal: true,
      showItemImages: true,
      showQuantityControls: true,
      showRemoveButton: true,
      checkoutButtonStyle: 'primary',
      emptyCartMessage: 'Your cart is empty',
      ...options,
    };

    return {
      qweb: this.generateCartWidgetQWeb(opts),
      scss: this.generateCartWidgetScss(opts),
      javascript: this.generateCartWidgetJs(opts),
      metadata: {
        componentType: 'cart_widget',
        generatedAt: new Date(),
        options: opts,
      },
    };
  }

  /**
   * Generate product listing QWeb template
   */
  private generateProductListingQWeb(opts: ProductListingOptions): string {
    const colClass = `col-${12 / opts.columns} col-md-${12 / Math.min(opts.columns, 3)} col-sm-6`;

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="${this.escapeXml(opts.templateId!)}" name="Product Listing">
    <t t-call="website.layout">
      <div id="wrap" class="o_wsale_products_page">
        <div class="container py-4">
          ${opts.showFilters || opts.showSorting ? `
          <!-- Filters and Sorting Bar -->
          <div class="row mb-4">
            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                ${opts.showFilters ? `
                <div class="o_wsale_filters">
                  <button class="btn btn-outline-secondary" data-bs-toggle="offcanvas" data-bs-target="#filterSidebar">
                    <i class="fa fa-filter me-2"/>Filters
                  </button>
                </div>
                ` : ''}
                ${opts.showSorting ? `
                <div class="o_wsale_sorting">
                  <select class="form-select" t-att-value="order">
                    <option value="website_sequence asc">Featured</option>
                    <option value="list_price asc">Price: Low to High</option>
                    <option value="list_price desc">Price: High to Low</option>
                    <option value="name asc">Name: A-Z</option>
                    <option value="create_date desc">Newest First</option>
                    <option value="rating desc">Best Rated</option>
                  </select>
                </div>
                ` : ''}
                <div class="o_wsale_results">
                  <span class="text-muted">
                    <t t-esc="pager['total']"/> products
                  </span>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Products Grid -->
          <div class="row o_wsale_products_grid o_wsale_layout_${opts.layout}">
            <t t-foreach="products" t-as="product">
              <div class="${colClass} mb-4">
                <t t-call="website_sale.product_card">
                  <t t-set="product" t-value="product"/>
                </t>
              </div>
            </t>
          </div>

          <!-- Empty State -->
          <t t-if="not products">
            <div class="text-center py-5">
              <i class="fa fa-search fa-3x text-muted mb-3"/>
              <h4>No products found</h4>
              <p class="text-muted">Try adjusting your filters or search terms</p>
              <a href="/shop" class="btn btn-primary">View All Products</a>
            </div>
          </t>

          ${opts.showPagination && !opts.infiniteScroll ? `
          <!-- Pagination -->
          <t t-if="pager['page_count'] > 1">
            <div class="d-flex justify-content-center mt-4">
              <t t-call="website.pager">
                <t t-set="classname">pagination-lg</t>
              </t>
            </div>
          </t>
          ` : ''}

          ${opts.infiniteScroll ? `
          <!-- Infinite Scroll Loader -->
          <div class="o_wsale_infinite_loader text-center py-4 d-none">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          ` : ''}
        </div>

        ${opts.showFilters ? `
        <!-- Filter Sidebar (Offcanvas) -->
        <div class="offcanvas offcanvas-start" tabindex="-1" id="filterSidebar">
          <div class="offcanvas-header">
            <h5 class="offcanvas-title">Filters</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"/>
          </div>
          <div class="offcanvas-body">
            <t t-call="website_sale.products_attributes">
              <t t-set="attributes" t-value="attributes"/>
            </t>
          </div>
          <div class="offcanvas-footer p-3 border-top">
            <button class="btn btn-outline-secondary w-100 mb-2" onclick="clearFilters()">
              Clear All
            </button>
            <button class="btn btn-primary w-100" data-bs-dismiss="offcanvas">
              Apply Filters
            </button>
          </div>
        </div>
        ` : ''}

        ${opts.showQuickView ? `
        <!-- Quick View Modal -->
        <div class="modal fade" id="quickViewModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header border-0">
                <button type="button" class="btn-close" data-bs-dismiss="modal"/>
              </div>
              <div class="modal-body" id="quickViewContent">
                <!-- Content loaded dynamically -->
              </div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    </t>
  </template>
</odoo>`;
  }

  /**
   * Generate product card QWeb template
   */
  private generateProductCardQWeb(opts: ProductCardOptions): string {
    const ratioClass = {
      '1:1': 'ratio-1x1',
      '4:3': 'ratio-4x3',
      '3:4': 'ratio-3x4',
      '16:9': 'ratio-16x9',
    }[opts.imageRatio];

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="website_sale.product_card" name="Product Card">
    <div class="o_wsale_product_card card h-100" t-att-data-product-id="product.id">
      ${opts.showBadges ? `
      <!-- Product Badges -->
      <div class="o_wsale_product_badges position-absolute top-0 start-0 p-2 z-1">
        <t t-if="product._is_new()">
          <span class="badge bg-success me-1">New</span>
        </t>
        <t t-if="product.compare_list_price and product.compare_list_price > product.list_price">
          <span class="badge bg-danger me-1">Sale</span>
        </t>
        <t t-if="product._is_bestseller()">
          <span class="badge bg-warning text-dark me-1">Bestseller</span>
        </t>
      </div>
      ` : ''}

      ${opts.showImage ? `
      <!-- Product Image -->
      <div class="o_wsale_product_image ratio ${ratioClass}">
        <a t-att-href="product.website_url">
          <img t-att-src="product.image_256 or '/web/image/product.template/%s/image_256' % product.id"
               t-att-alt="product.name"
               class="card-img-top object-fit-cover w-100 h-100"
               loading="lazy"/>
          ${opts.hoverEffect === 'overlay' ? `
          <div class="o_wsale_image_overlay">
            <span class="btn btn-light">View Details</span>
          </div>
          ` : ''}
        </a>
        ${opts.showQuickActions ? `
        <!-- Quick Actions -->
        <div class="o_wsale_quick_actions position-absolute bottom-0 end-0 p-2">
          <button class="btn btn-light btn-sm rounded-circle o_quick_view"
                  t-att-data-product-id="product.id" title="Quick View">
            <i class="fa fa-eye"/>
          </button>
          <button class="btn btn-light btn-sm rounded-circle o_add_wishlist ms-1"
                  t-att-data-product-id="product.id" title="Add to Wishlist">
            <i class="fa fa-heart-o"/>
          </button>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="card-body d-flex flex-column">
        ${opts.showName ? `
        <!-- Product Name -->
        <h5 class="card-title mb-2">
          <a t-att-href="product.website_url" class="text-decoration-none text-dark">
            <t t-esc="product.name"/>
          </a>
        </h5>
        ` : ''}

        ${opts.showRating ? `
        <!-- Product Rating -->
        <div class="o_wsale_product_rating mb-2" t-if="product.rating_count">
          <t t-call="portal_rating.rating_widget_stars_static">
            <t t-set="rating_avg" t-value="product.rating_avg"/>
          </t>
          <small class="text-muted ms-1">(<t t-esc="product.rating_count"/>)</small>
        </div>
        ` : ''}

        ${opts.showDescription ? `
        <!-- Product Description -->
        <p class="card-text text-muted small mb-2 o_wsale_product_description"
           style="-webkit-line-clamp: ${opts.descriptionLines};">
          <t t-esc="product.description_sale or product.description or ''"/>
        </p>
        ` : ''}

        <div class="mt-auto">
          ${opts.showPrice ? `
          <!-- Product Price -->
          <div class="o_wsale_product_price mb-2">
            ${opts.showComparePrice ? `
            <t t-if="product.compare_list_price and product.compare_list_price > product.list_price">
              <span class="text-muted text-decoration-line-through small me-2">
                <t t-esc="product.compare_list_price" t-options="{'widget': 'monetary', 'display_currency': website.currency_id}"/>
              </span>
            </t>
            ` : ''}
            <span class="h5 mb-0 text-primary fw-bold">
              <t t-esc="product.list_price" t-options="{'widget': 'monetary', 'display_currency': website.currency_id}"/>
            </span>
          </div>
          ` : ''}

          ${opts.showAddToCart ? `
          <!-- Add to Cart -->
          <form t-att-action="'/shop/cart/update'" method="post" class="o_wsale_add_to_cart_form">
            <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>
            <input type="hidden" name="product_id" t-att-value="product.product_variant_id.id"/>
            <t t-if="product.product_variant_count == 1 and not product.has_configurable_attributes">
              <button type="submit" class="btn btn-primary w-100">
                <i class="fa fa-shopping-cart me-2"/>Add to Cart
              </button>
            </t>
            <t t-else="">
              <a t-att-href="product.website_url" class="btn btn-outline-primary w-100">
                Select Options
              </a>
            </t>
          </form>
          ` : ''}
        </div>
      </div>
    </div>
  </template>
</odoo>`;
  }

  /**
   * Generate cart widget QWeb template
   */
  private generateCartWidgetQWeb(opts: CartWidgetOptions): string {
    const styleClasses = {
      dropdown: 'dropdown',
      sidebar: 'offcanvas-end',
      modal: 'modal fade',
    }[opts.style];

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="website_sale.cart_widget_${this.websiteId}" name="Cart Widget">
    <div class="o_wsale_cart_widget ${styleClasses}">
      <!-- Cart Toggle Button -->
      <button class="btn btn-link position-relative o_cart_toggle"
              ${opts.style === 'dropdown' ? 'data-bs-toggle="dropdown"' : ''}
              ${opts.style === 'sidebar' ? 'data-bs-toggle="offcanvas" data-bs-target="#cartSidebar"' : ''}
              ${opts.style === 'modal' ? 'data-bs-toggle="modal" data-bs-target="#cartModal"' : ''}>
        <i class="fa fa-shopping-cart fa-lg"/>
        ${opts.showItemCount ? `
        <span class="o_cart_count badge bg-primary rounded-pill position-absolute top-0 start-100 translate-middle"
              t-if="website_sale_order and website_sale_order.cart_quantity">
          <t t-esc="website_sale_order.cart_quantity"/>
        </span>
        ` : ''}
      </button>

      ${opts.style === 'dropdown' ? this.generateCartDropdown(opts) : ''}
      ${opts.style === 'sidebar' ? this.generateCartSidebar(opts) : ''}
      ${opts.style === 'modal' ? this.generateCartModal(opts) : ''}
    </div>
  </template>

  <!-- Cart Line Template -->
  <template id="website_sale.cart_line_${this.websiteId}" name="Cart Line">
    <div class="o_cart_line d-flex align-items-start py-3 border-bottom" t-att-data-line-id="line.id">
      ${opts.showItemImages ? `
      <div class="o_cart_line_image me-3" style="width: 60px;">
        <img t-att-src="'/web/image/product.product/%s/image_128' % line.product_id.id"
             t-att-alt="line.product_id.name"
             class="img-fluid rounded"/>
      </div>
      ` : ''}
      <div class="flex-grow-1">
        <h6 class="mb-1">
          <a t-att-href="line.product_id.website_url" class="text-decoration-none">
            <t t-esc="line.product_id.name"/>
          </a>
        </h6>
        <small class="text-muted" t-if="line.product_id.product_template_attribute_value_ids">
          <t t-esc="', '.join(line.product_id.product_template_attribute_value_ids.mapped('name'))"/>
        </small>
        <div class="d-flex align-items-center justify-content-between mt-2">
          ${opts.showQuantityControls ? `
          <div class="o_cart_quantity input-group input-group-sm" style="width: 100px;">
            <button class="btn btn-outline-secondary o_qty_minus" type="button">-</button>
            <input type="number" class="form-control text-center" t-att-value="int(line.product_uom_qty)" min="1"/>
            <button class="btn btn-outline-secondary o_qty_plus" type="button">+</button>
          </div>
          ` : `
          <span class="text-muted">Qty: <t t-esc="int(line.product_uom_qty)"/></span>
          `}
          <span class="fw-bold">
            <t t-esc="line.price_subtotal" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
          </span>
        </div>
      </div>
      ${opts.showRemoveButton ? `
      <button class="btn btn-link text-danger o_remove_line p-0 ms-2" t-att-data-line-id="line.id">
        <i class="fa fa-trash"/>
      </button>
      ` : ''}
    </div>
  </template>
</odoo>`;
  }

  /**
   * Generate cart dropdown HTML
   */
  private generateCartDropdown(opts: CartWidgetOptions): string {
    return `
      <!-- Cart Dropdown -->
      <div class="dropdown-menu dropdown-menu-end p-3" style="min-width: 320px; max-height: 400px; overflow-y: auto;">
        <t t-if="website_sale_order and website_sale_order.order_line">
          <div class="o_cart_lines">
            <t t-foreach="website_sale_order.order_line" t-as="line">
              <t t-call="website_sale.cart_line_${this.websiteId}"/>
            </t>
          </div>
          ${opts.showSubtotal ? `
          <div class="border-top pt-3 mt-2">
            <div class="d-flex justify-content-between mb-2">
              <span>Subtotal</span>
              <span class="fw-bold">
                <t t-esc="website_sale_order.amount_untaxed" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
              </span>
            </div>
          </div>
          ` : ''}
          <div class="d-grid gap-2 mt-3">
            <a href="/shop/cart" class="btn btn-outline-${opts.checkoutButtonStyle}">View Cart</a>
            <a href="/shop/checkout" class="btn btn-${opts.checkoutButtonStyle}">Checkout</a>
          </div>
        </t>
        <t t-else="">
          <div class="text-center py-4">
            <i class="fa fa-shopping-cart fa-2x text-muted mb-2"/>
            <p class="mb-0">${this.escapeXml(opts.emptyCartMessage || 'Your cart is empty')}</p>
            <a href="/shop" class="btn btn-primary mt-3">Start Shopping</a>
          </div>
        </t>
      </div>`;
  }

  /**
   * Generate cart sidebar HTML
   */
  private generateCartSidebar(opts: CartWidgetOptions): string {
    return `
      <!-- Cart Sidebar -->
      <div class="offcanvas offcanvas-end" tabindex="-1" id="cartSidebar">
        <div class="offcanvas-header border-bottom">
          <h5 class="offcanvas-title">
            <i class="fa fa-shopping-cart me-2"/>Shopping Cart
            <span class="badge bg-primary ms-2" t-if="website_sale_order">
              <t t-esc="website_sale_order.cart_quantity"/>
            </span>
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"/>
        </div>
        <div class="offcanvas-body">
          <t t-if="website_sale_order and website_sale_order.order_line">
            <div class="o_cart_lines">
              <t t-foreach="website_sale_order.order_line" t-as="line">
                <t t-call="website_sale.cart_line_${this.websiteId}"/>
              </t>
            </div>
          </t>
          <t t-else="">
            <div class="text-center py-5">
              <i class="fa fa-shopping-cart fa-3x text-muted mb-3"/>
              <h5>${this.escapeXml(opts.emptyCartMessage || 'Your cart is empty')}</h5>
              <a href="/shop" class="btn btn-primary mt-2">Start Shopping</a>
            </div>
          </t>
        </div>
        <div class="offcanvas-footer border-top p-3" t-if="website_sale_order and website_sale_order.order_line">
          ${opts.showSubtotal ? `
          <div class="d-flex justify-content-between mb-2">
            <span>Subtotal</span>
            <span class="fw-bold">
              <t t-esc="website_sale_order.amount_untaxed" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
            </span>
          </div>
          <div class="d-flex justify-content-between mb-3">
            <span>Tax</span>
            <span>
              <t t-esc="website_sale_order.amount_tax" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
            </span>
          </div>
          <div class="d-flex justify-content-between h5 mb-3">
            <span>Total</span>
            <span class="text-primary">
              <t t-esc="website_sale_order.amount_total" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
            </span>
          </div>
          ` : ''}
          <div class="d-grid gap-2">
            <a href="/shop/cart" class="btn btn-outline-secondary">View Cart</a>
            <a href="/shop/checkout" class="btn btn-${opts.checkoutButtonStyle} btn-lg">
              <i class="fa fa-lock me-2"/>Checkout
            </a>
          </div>
        </div>
      </div>`;
  }

  /**
   * Generate cart modal HTML
   */
  private generateCartModal(opts: CartWidgetOptions): string {
    return `
      <!-- Cart Modal -->
      <div class="modal fade" id="cartModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fa fa-shopping-cart me-2"/>Your Cart
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"/>
            </div>
            <div class="modal-body">
              <t t-if="website_sale_order and website_sale_order.order_line">
                <div class="o_cart_lines">
                  <t t-foreach="website_sale_order.order_line" t-as="line">
                    <t t-call="website_sale.cart_line_${this.websiteId}"/>
                  </t>
                </div>
              </t>
              <t t-else="">
                <div class="text-center py-5">
                  <i class="fa fa-shopping-cart fa-3x text-muted mb-3"/>
                  <h5>${this.escapeXml(opts.emptyCartMessage || 'Your cart is empty')}</h5>
                </div>
              </t>
            </div>
            <div class="modal-footer flex-column" t-if="website_sale_order and website_sale_order.order_line">
              ${opts.showSubtotal ? `
              <div class="w-100 d-flex justify-content-between h5 mb-0">
                <span>Total</span>
                <span class="text-primary">
                  <t t-esc="website_sale_order.amount_total" t-options="{'widget': 'monetary', 'display_currency': website_sale_order.currency_id}"/>
                </span>
              </div>
              ` : ''}
              <div class="w-100 d-flex gap-2 mt-3">
                <a href="/shop/cart" class="btn btn-outline-secondary flex-grow-1">View Cart</a>
                <a href="/shop/checkout" class="btn btn-${opts.checkoutButtonStyle} flex-grow-1">
                  Checkout
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /**
   * Generate product listing SCSS
   */
  private generateProductListingScss(opts: ProductListingOptions): string {
    return `// Product Listing Styles
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

.o_wsale_products_page {
  .o_wsale_filters {
    .btn {
      border-radius: 20px;
    }
  }

  .o_wsale_sorting {
    .form-select {
      min-width: 180px;
      border-radius: 20px;
    }
  }

  .o_wsale_products_grid {
    &.o_wsale_layout_masonry {
      column-count: ${opts.columns};
      column-gap: 1.5rem;

      > div {
        break-inside: avoid;
        margin-bottom: 1.5rem;
      }

      @media (max-width: 992px) {
        column-count: 2;
      }

      @media (max-width: 576px) {
        column-count: 1;
      }
    }
  }

  ${opts.infiniteScroll ? `
  .o_wsale_infinite_loader {
    &.loading {
      display: block !important;
    }
  }
  ` : ''}
}

// Filter Sidebar
#filterSidebar {
  .offcanvas-body {
    .o_wsale_attribute_panel {
      margin-bottom: 1.5rem;

      h6 {
        font-weight: 600;
        margin-bottom: 0.75rem;
      }

      .form-check {
        padding: 0.25rem 0;
      }
    }
  }
}

// Quick View Modal
#quickViewModal {
  .modal-body {
    max-height: 70vh;
    overflow-y: auto;
  }
}
`;
  }

  /**
   * Generate product card SCSS
   */
  private generateProductCardScss(opts: ProductCardOptions): string {
    return `// Product Card Styles
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

.o_wsale_product_card {
  transition: all 0.3s ease;
  border: 1px solid #eee;
  overflow: hidden;

  &:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    transform: translateY(-4px);

    ${opts.hoverEffect === 'zoom' ? `
    .o_wsale_product_image img {
      transform: scale(1.08);
    }
    ` : ''}

    ${opts.hoverEffect === 'overlay' ? `
    .o_wsale_image_overlay {
      opacity: 1;
    }
    ` : ''}

    .o_wsale_quick_actions {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .o_wsale_product_image {
    overflow: hidden;
    background: #f8f9fa;

    img {
      transition: transform 0.4s ease;
    }

    ${opts.hoverEffect === 'overlay' ? `
    .o_wsale_image_overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    ` : ''}
  }

  .o_wsale_product_badges {
    .badge {
      font-size: 0.7rem;
      padding: 0.4em 0.8em;
    }
  }

  .o_wsale_quick_actions {
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;

    .btn {
      width: 36px;
      height: 36px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  ${opts.showDescription ? `
  .o_wsale_product_description {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  ` : ''}

  .o_wsale_product_rating {
    .fa-star, .fa-star-half-o {
      color: #ffc107;
    }
    .fa-star-o {
      color: #ddd;
    }
  }

  .o_wsale_add_to_cart_form {
    .btn {
      border-radius: 25px;
      font-weight: 500;
    }
  }
}

// Aspect ratio helpers
.ratio-3x4 {
  --bs-aspect-ratio: 133.33%;
}
`;
  }

  /**
   * Generate cart widget SCSS
   */
  private generateCartWidgetScss(opts: CartWidgetOptions): string {
    return `// Cart Widget Styles
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

.o_wsale_cart_widget {
  .o_cart_toggle {
    color: inherit;
    position: relative;

    .o_cart_count {
      font-size: 0.65rem;
      min-width: 18px;
      height: 18px;
      line-height: 18px;
      padding: 0 5px;
    }

    &:hover {
      color: var(--o-color-primary);
    }
  }

  .o_cart_line {
    .o_cart_line_image {
      img {
        border: 1px solid #eee;
      }
    }

    .o_cart_quantity {
      .form-control {
        border-left: 0;
        border-right: 0;
      }
    }

    .o_remove_line {
      opacity: 0.5;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }
  }

  ${opts.style === 'dropdown' ? `
  .dropdown-menu {
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    border: none;
    border-radius: 12px;

    &::before {
      content: '';
      position: absolute;
      top: -8px;
      right: 20px;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid white;
    }
  }
  ` : ''}

  ${opts.style === 'sidebar' ? `
  #cartSidebar {
    width: 380px;

    @media (max-width: 576px) {
      width: 100%;
    }

    .offcanvas-footer {
      background: #f8f9fa;
    }
  }
  ` : ''}

  ${opts.style === 'modal' ? `
  #cartModal {
    .modal-content {
      border-radius: 16px;
      border: none;
    }

    .modal-footer {
      background: #f8f9fa;
      border-radius: 0 0 16px 16px;
    }
  }
  ` : ''}
}
`;
  }

  /**
   * Generate product listing JavaScript
   */
  private generateProductListingJs(opts: ProductListingOptions): string {
    return `// Product Listing JavaScript
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

odoo.define('website_sale.product_listing_${this.websiteId}', function (require) {
  'use strict';

  const publicWidget = require('web.public.widget');
  const core = require('web.core');

  publicWidget.registry.ProductListing${this.websiteId} = publicWidget.Widget.extend({
    selector: '.o_wsale_products_page',
    events: {
      'change .o_wsale_sorting select': '_onSortChange',
      ${opts.showQuickView ? "'click .o_quick_view': '_onQuickView'," : ''}
      ${opts.infiniteScroll ? "'scroll window': '_onScroll'," : ''}
    },

    start: function () {
      ${opts.lazyLoadImages ? "this._initLazyLoad();" : ''}
      ${opts.infiniteScroll ? "this._initInfiniteScroll();" : ''}
      return this._super.apply(this, arguments);
    },

    _onSortChange: function (ev) {
      const order = $(ev.currentTarget).val();
      const url = new URL(window.location.href);
      url.searchParams.set('order', order);
      window.location.href = url.toString();
    },

    ${opts.showQuickView ? `
    _onQuickView: function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const productId = $(ev.currentTarget).data('product-id');

      $.get('/shop/product/' + productId + '/quick_view').then((html) => {
        $('#quickViewContent').html(html);
        new bootstrap.Modal('#quickViewModal').show();
      });
    },
    ` : ''}

    ${opts.lazyLoadImages ? `
    _initLazyLoad: function () {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              observer.unobserve(img);
            }
          });
        });

        this.$('img.lazy').each(function () {
          observer.observe(this);
        });
      }
    },
    ` : ''}

    ${opts.infiniteScroll ? `
    _initInfiniteScroll: function () {
      this.loading = false;
      this.page = 1;
      this.hasMore = true;
    },

    _onScroll: function () {
      if (this.loading || !this.hasMore) return;

      const scrollPos = $(window).scrollTop() + $(window).height();
      const docHeight = $(document).height();

      if (scrollPos >= docHeight - 200) {
        this._loadMoreProducts();
      }
    },

    _loadMoreProducts: function () {
      this.loading = true;
      this.$('.o_wsale_infinite_loader').addClass('loading');

      const url = new URL(window.location.href);
      url.searchParams.set('page', ++this.page);

      $.get(url.toString()).then((html) => {
        const $products = $(html).find('.o_wsale_products_grid > div');
        if ($products.length) {
          this.$('.o_wsale_products_grid').append($products);
        } else {
          this.hasMore = false;
        }
        this.loading = false;
        this.$('.o_wsale_infinite_loader').removeClass('loading');
      });
    },
    ` : ''}
  });

  return publicWidget.registry.ProductListing${this.websiteId};
});
`;
  }

  /**
   * Generate product card JavaScript
   */
  private generateProductCardJs(opts: ProductCardOptions): string {
    return `// Product Card JavaScript
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

odoo.define('website_sale.product_card_${this.websiteId}', function (require) {
  'use strict';

  const publicWidget = require('web.public.widget');
  const wSaleUtils = require('website_sale.utils');

  publicWidget.registry.ProductCard${this.websiteId} = publicWidget.Widget.extend({
    selector: '.o_wsale_product_card',
    events: {
      'submit .o_wsale_add_to_cart_form': '_onAddToCart',
      'click .o_add_wishlist': '_onAddWishlist',
    },

    _onAddToCart: function (ev) {
      ev.preventDefault();
      const $form = $(ev.currentTarget);
      const productId = $form.find('input[name="product_id"]').val();

      this._addToCart(productId, 1).then(() => {
        wSaleUtils.animateClone($form, this.$('.o_cart_toggle'), 10, 10);
      });
    },

    _addToCart: function (productId, qty) {
      return this._rpc({
        route: '/shop/cart/update_json',
        params: {
          product_id: parseInt(productId),
          add_qty: qty,
        },
      }).then((data) => {
        wSaleUtils.updateCartNavBar(data);
        return data;
      });
    },

    _onAddWishlist: function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const productId = $(ev.currentTarget).data('product-id');

      this._rpc({
        route: '/shop/wishlist/add',
        params: { product_id: productId },
      }).then(() => {
        $(ev.currentTarget).find('i').removeClass('fa-heart-o').addClass('fa-heart text-danger');
      });
    },
  });

  return publicWidget.registry.ProductCard${this.websiteId};
});
`;
  }

  /**
   * Generate cart widget JavaScript
   */
  private generateCartWidgetJs(opts: CartWidgetOptions): string {
    return `// Cart Widget JavaScript
// Website ID: ${this.websiteId}
// Generated: ${new Date().toISOString()}

odoo.define('website_sale.cart_widget_${this.websiteId}', function (require) {
  'use strict';

  const publicWidget = require('web.public.widget');
  const wSaleUtils = require('website_sale.utils');

  publicWidget.registry.CartWidget${this.websiteId} = publicWidget.Widget.extend({
    selector: '.o_wsale_cart_widget',
    events: {
      'click .o_qty_minus': '_onQtyMinus',
      'click .o_qty_plus': '_onQtyPlus',
      'change .o_cart_quantity input': '_onQtyChange',
      'click .o_remove_line': '_onRemoveLine',
    },

    _onQtyMinus: function (ev) {
      const $input = $(ev.currentTarget).siblings('input');
      const qty = parseInt($input.val()) - 1;
      if (qty >= 1) {
        $input.val(qty).trigger('change');
      }
    },

    _onQtyPlus: function (ev) {
      const $input = $(ev.currentTarget).siblings('input');
      const qty = parseInt($input.val()) + 1;
      $input.val(qty).trigger('change');
    },

    _onQtyChange: function (ev) {
      const $line = $(ev.currentTarget).closest('.o_cart_line');
      const lineId = $line.data('line-id');
      const qty = parseInt($(ev.currentTarget).val());

      this._updateLine(lineId, qty);
    },

    _onRemoveLine: function (ev) {
      ev.preventDefault();
      const $line = $(ev.currentTarget).closest('.o_cart_line');
      const lineId = $(ev.currentTarget).data('line-id');

      $line.fadeOut(() => {
        this._updateLine(lineId, 0);
      });
    },

    _updateLine: function (lineId, qty) {
      return this._rpc({
        route: '/shop/cart/update_json',
        params: {
          line_id: lineId,
          set_qty: qty,
        },
      }).then((data) => {
        wSaleUtils.updateCartNavBar(data);
        if (data.cart_quantity === 0) {
          location.reload();
        }
      });
    },
  });

  return publicWidget.registry.CartWidget${this.websiteId};
});
`;
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
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a basic product listing
 */
export function createProductListing(
  websiteId: number,
  options?: Partial<ProductListingOptions>
): GeneratedEcommerce {
  const integration = new OdooEcommerceIntegration(websiteId);
  return integration.generateProductListing(options);
}

/**
 * Create a product card component
 */
export function createProductCard(
  websiteId: number,
  options?: Partial<ProductCardOptions>
): GeneratedEcommerce {
  const integration = new OdooEcommerceIntegration(websiteId);
  return integration.generateProductCard(options);
}

/**
 * Create a cart widget
 */
export function createCartWidget(
  websiteId: number,
  options?: Partial<CartWidgetOptions>
): GeneratedEcommerce {
  const integration = new OdooEcommerceIntegration(websiteId);
  return integration.generateCartWidget(options);
}

/**
 * Create a complete e-commerce bundle
 */
export function createEcommerceBundle(
  websiteId: number,
  options?: {
    listing?: Partial<ProductListingOptions>;
    card?: Partial<ProductCardOptions>;
    cart?: Partial<CartWidgetOptions>;
  }
): {
  listing: GeneratedEcommerce;
  card: GeneratedEcommerce;
  cart: GeneratedEcommerce;
} {
  const integration = new OdooEcommerceIntegration(websiteId);

  return {
    listing: integration.generateProductListing(options?.listing),
    card: integration.generateProductCard(options?.card),
    cart: integration.generateCartWidget(options?.cart),
  };
}

export default OdooEcommerceIntegration;
