import type { NextAuthConfig } from "next-auth";
import { getAuthSecret, isDemoMode } from "./env";

/**
 * Edge-compatible auth config for middleware
 *
 * This config contains ONLY the authorized callback and pages config.
 * It does NOT include providers or any Node.js-only dependencies (bcrypt, prisma).
 *
 * Why: Middleware runs on Edge Runtime which doesn't support Node.js APIs.
 * The full config with providers is used in API routes (Node.js runtime).
 */
export const authConfigEdge: NextAuthConfig = {
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Demo mode: bypass all authentication
      if (isDemoMode()) {
        return true;
      }

      const isLoggedIn = !!auth?.user;
      const isOnStudio = nextUrl.pathname === "/" || nextUrl.pathname.startsWith("/studio");
      const isOnAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/signup");
      const isOnApi = nextUrl.pathname.startsWith("/api");

      // Allow API routes (per-route protection added separately)
      if (isOnApi) {
        return true;
      }

      // Redirect logged-in users away from auth pages
      if (isOnAuth) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Protect studio pages
      if (isOnStudio) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      return true;
    },
  },
  providers: [], // Empty - providers are in full config for API routes
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: getAuthSecret(),
};
