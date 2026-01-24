/**
 * Placeholder Image Generator
 *
 * Generates SVG placeholder images for Odoo website preview.
 * Provides realistic-looking placeholders for products, team, banners, etc.
 */

/**
 * Placeholder image configuration
 */
export interface PlaceholderConfig {
  width: number;
  height: number;
  text?: string;
  bgColor?: string;
  textColor?: string;
  icon?: string;
  type?: PlaceholderType;
}

export type PlaceholderType =
  | "product"
  | "team"
  | "banner"
  | "testimonial"
  | "logo"
  | "gallery"
  | "blog"
  | "generic";

/**
 * Default colors for different placeholder types
 */
const TYPE_COLORS: Record<PlaceholderType, { bg: string; text: string; icon: string }> = {
  product: { bg: "#f8f9fa", text: "#6c757d", icon: "🛍️" },
  team: { bg: "#e9ecef", text: "#495057", icon: "👤" },
  banner: { bg: "#dee2e6", text: "#495057", icon: "🖼️" },
  testimonial: { bg: "#e9ecef", text: "#6c757d", icon: "💬" },
  logo: { bg: "#f8f9fa", text: "#adb5bd", icon: "⬡" },
  gallery: { bg: "#ced4da", text: "#495057", icon: "🏞️" },
  blog: { bg: "#e9ecef", text: "#6c757d", icon: "📝" },
  generic: { bg: "#e9ecef", text: "#6c757d", icon: "📷" },
};

/**
 * Generate SVG placeholder image
 */
export function generatePlaceholderSVG(config: PlaceholderConfig): string {
  const {
    width,
    height,
    text,
    type = "generic",
  } = config;

  const colors = TYPE_COLORS[type];
  const bgColor = config.bgColor || colors.bg;
  const textColor = config.textColor || colors.text;
  const icon = config.icon || colors.icon;

  const displayText = text || `${width} × ${height}`;
  const fontSize = Math.min(width, height) / 8;
  const iconSize = Math.min(width, height) / 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect fill="${bgColor}" width="${width}" height="${height}"/>
    <rect fill="${bgColor}" width="${width}" height="${height}" stroke="#dee2e6" stroke-width="1" fill-opacity="0"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${iconSize}" fill="${textColor}">${icon}</text>
    <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${textColor}">${displayText}</text>
  </svg>`;
}

/**
 * Generate data URL for placeholder image
 */
export function generatePlaceholderDataURL(config: PlaceholderConfig): string {
  const svg = generatePlaceholderSVG(config);
  const base64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Common placeholder sizes
 */
export const PLACEHOLDER_SIZES = {
  // Product images
  productCard: { width: 300, height: 300, type: "product" as PlaceholderType },
  productThumb: { width: 100, height: 100, type: "product" as PlaceholderType },
  productFull: { width: 600, height: 600, type: "product" as PlaceholderType },

  // Team/avatar images
  avatar: { width: 100, height: 100, type: "team" as PlaceholderType },
  avatarLarge: { width: 200, height: 200, type: "team" as PlaceholderType },
  teamCard: { width: 300, height: 400, type: "team" as PlaceholderType },

  // Banner/hero images
  heroBanner: { width: 1920, height: 600, type: "banner" as PlaceholderType },
  bannerMedium: { width: 1200, height: 400, type: "banner" as PlaceholderType },
  bannerSmall: { width: 800, height: 300, type: "banner" as PlaceholderType },

  // Content images
  blogThumb: { width: 400, height: 250, type: "blog" as PlaceholderType },
  blogFeatured: { width: 800, height: 450, type: "blog" as PlaceholderType },
  gallery: { width: 400, height: 400, type: "gallery" as PlaceholderType },

  // Logo
  logo: { width: 200, height: 60, type: "logo" as PlaceholderType },
  logoSmall: { width: 120, height: 40, type: "logo" as PlaceholderType },

  // Generic
  square: { width: 300, height: 300, type: "generic" as PlaceholderType },
  landscape: { width: 400, height: 300, type: "generic" as PlaceholderType },
  portrait: { width: 300, height: 400, type: "generic" as PlaceholderType },
  wide: { width: 600, height: 200, type: "generic" as PlaceholderType },
};

/**
 * Generate placeholder for a specific use case
 */
export function getPlaceholder(
  sizeKey: keyof typeof PLACEHOLDER_SIZES,
  customText?: string
): string {
  const size = PLACEHOLDER_SIZES[sizeKey];
  return generatePlaceholderDataURL({
    ...size,
    text: customText,
  });
}

/**
 * URL patterns to replace with placeholders
 */
const IMAGE_URL_PATTERNS = [
  /\/web\/image\/product\/\d+/g,
  /\/web\/image\/employee\/\d+/g,
  /\/web\/image\/team\/\d+/g,
  /\/web\/image\/testimonial\/\d+/g,
  /\/web\/image\/website\/\w+/g,
  /\/web\/image\/blog\.post\/\d+/g,
  /\/web\/image\/res\.partner\/\d+/g,
];

/**
 * Determine placeholder type from URL
 */
function getPlaceholderTypeFromURL(url: string): PlaceholderType {
  if (url.includes("/product/")) return "product";
  if (url.includes("/employee/") || url.includes("/team/")) return "team";
  if (url.includes("/testimonial/") || url.includes("/partner/")) return "testimonial";
  if (url.includes("/blog")) return "blog";
  if (url.includes("/banner") || url.includes("/cover") || url.includes("/hero")) return "banner";
  return "generic";
}

/**
 * Determine appropriate size from context
 */
function getSizeFromContext(url: string, context?: string): PlaceholderConfig {
  const type = getPlaceholderTypeFromURL(url);

  // Check for size hints in context (class names, etc.)
  if (context) {
    if (context.includes("thumb") || context.includes("-sm")) {
      return { width: 100, height: 100, type };
    }
    if (context.includes("card-img-top") || context.includes("col-")) {
      return { width: 300, height: 200, type };
    }
    if (context.includes("rounded-circle") || context.includes("avatar")) {
      return { width: 100, height: 100, type };
    }
    if (context.includes("hero") || context.includes("cover") || context.includes("banner")) {
      return { width: 1200, height: 400, type };
    }
  }

  // Default sizes by type
  switch (type) {
    case "product":
      return { width: 300, height: 300, type };
    case "team":
    case "testimonial":
      return { width: 100, height: 100, type };
    case "banner":
      return { width: 1200, height: 400, type };
    case "blog":
      return { width: 400, height: 250, type };
    default:
      return { width: 300, height: 200, type };
  }
}

/**
 * Replace Odoo image URLs with placeholder data URLs
 */
export function replaceImagesWithPlaceholders(html: string): string {
  let result = html;

  // Extract image tags and their context
  const imgRegex = /<img[^>]*src="([^"]*\/web\/image\/[^"]*)"[^>]*>/g;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const srcUrl = match[1];

    // Get context from surrounding HTML
    const context = fullMatch;
    const config = getSizeFromContext(srcUrl, context);

    // Extract alt text if present
    const altMatch = fullMatch.match(/alt="([^"]*)"/);
    if (altMatch && altMatch[1]) {
      config.text = altMatch[1];
    }

    const placeholder = generatePlaceholderDataURL(config);
    result = result.replace(srcUrl, placeholder);
  }

  // Also handle background images in style attributes
  const bgRegex = /url\(['"]?(\/web\/image\/[^'")\s]+)['"]?\)/g;
  while ((match = bgRegex.exec(html)) !== null) {
    const srcUrl = match[1];
    const config = getSizeFromContext(srcUrl);
    const placeholder = generatePlaceholderDataURL(config);
    result = result.replace(srcUrl, placeholder);
  }

  return result;
}

/**
 * Generate a gradient placeholder (more visually interesting)
 */
export function generateGradientPlaceholder(config: PlaceholderConfig): string {
  const { width, height, type = "generic" } = config;

  const gradients: Record<PlaceholderType, string[]> = {
    product: ["#f093fb", "#f5576c"],
    team: ["#4facfe", "#00f2fe"],
    banner: ["#667eea", "#764ba2"],
    testimonial: ["#a8edea", "#fed6e3"],
    logo: ["#d299c2", "#fef9d7"],
    gallery: ["#89f7fe", "#66a6ff"],
    blog: ["#ffecd2", "#fcb69f"],
    generic: ["#a1c4fd", "#c2e9fb"],
  };

  const [color1, color2] = gradients[type];
  const colors = TYPE_COLORS[type];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect fill="url(#grad)" width="${width}" height="${height}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${Math.min(width, height) / 6}" fill="white" opacity="0.9">${colors.icon}</text>
  </svg>`;
}

/**
 * Generate gradient placeholder data URL
 */
export function generateGradientPlaceholderDataURL(config: PlaceholderConfig): string {
  const svg = generateGradientPlaceholder(config);
  const base64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Prebuilt placeholder URLs for common use cases
 */
export const PLACEHOLDER_URLS = {
  product: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.productCard),
  productThumb: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.productThumb),
  avatar: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.avatar),
  team: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.teamCard),
  banner: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.heroBanner),
  blog: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.blogThumb),
  gallery: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.gallery),
  logo: () => generatePlaceholderDataURL(PLACEHOLDER_SIZES.logo),
};
