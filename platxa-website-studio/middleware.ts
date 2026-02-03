import NextAuth from "next-auth";
import { authConfigEdge } from "@/lib/auth/config.edge";

/**
 * Edge-compatible middleware for authentication
 *
 * Uses authConfigEdge which contains only the authorized callback
 * and no Node.js-only dependencies (bcrypt, prisma).
 */
export default NextAuth(authConfigEdge).auth;

export const config = {
  // Match all routes except static files and API health checks
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
  ],
};
