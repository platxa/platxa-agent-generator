/**
 * Catch-all route for /web/image/* requests.
 *
 * Odoo themes reference images like /web/image/website.s_cover_default_image.
 * These paths only resolve on an actual Odoo server. In the Next.js preview,
 * this route serves SVG placeholder images so nothing appears broken.
 */
import { NextRequest, NextResponse } from "next/server";

const PLACEHOLDER_COLORS: Record<string, { bg: string; icon: string }> = {
  cover:  { bg: "#667eea", icon: "🖼️" },
  banner: { bg: "#667eea", icon: "🖼️" },
  text_image: { bg: "#4facfe", icon: "📷" },
  three_columns: { bg: "#a78bfa", icon: "📷" },
  image_text: { bg: "#4facfe", icon: "📷" },
  default: { bg: "#94a3b8", icon: "📷" },
};

function detectType(path: string): { bg: string; icon: string } {
  for (const [key, colors] of Object.entries(PLACEHOLDER_COLORS)) {
    if (key !== "default" && path.includes(key)) return colors;
  }
  return PLACEHOLDER_COLORS.default;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = path.join("/");
  const { bg, icon } = detectType(fullPath);

  // Determine dimensions from path hints
  const isCover = fullPath.includes("cover") || fullPath.includes("banner");
  const width = isCover ? 1920 : 800;
  const height = isCover ? 600 : 500;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg};stop-opacity:0.8"/>
      <stop offset="100%" style="stop-color:${bg};stop-opacity:0.4"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g)" width="${width}" height="${height}"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.min(width, height) / 4}" fill="white" opacity="0.6">${icon}</text>
  <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="white" opacity="0.5">${width} × ${height}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
