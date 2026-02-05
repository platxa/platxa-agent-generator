import { NextResponse } from "next/server";

/**
 * Route handler for /favicon.ico
 * Redirects to the SVG icon since browsers accept SVG favicons
 * This eliminates the 404 error for /favicon.ico requests
 */
export async function GET() {
  // Return the SVG icon directly as favicon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#6366f1"/>
  <path d="M8 10h6v2H10v8h4v-4h2v4a2 2 0 01-2 2H10a2 2 0 01-2-2V10z" fill="white"/>
  <path d="M18 10h4a2 2 0 012 2v2a2 2 0 01-2 2h-2v4h-2V10zm2 4h2v-2h-2v2z" fill="white"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
