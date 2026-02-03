import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getUserByEmail, createUser } from "./users";
import { hashCredential, verifyCredential } from "./password";
import { getAuthSecret } from "./env";

/**
 * NextAuth.js configuration for Platxa Website Studio
 * Supports email/password authentication with secure credential handling
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        credential: { label: "Credential", type: "password" },
        action: { label: "Action", type: "text" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.credential) {
          return null;
        }

        const email = credentials.email as string;
        const inputCredential = credentials.credential as string;
        const action = credentials.action as string;
        const name = credentials.name as string;

        if (action === "signup") {
          // Check if user exists
          const existingUser = getUserByEmail(email);
          if (existingUser) {
            throw new Error("User already exists");
          }

          // Create new user with hashed credential
          const secureHash = await hashCredential(inputCredential);
          const newUser = createUser({
            email,
            name: name || email.split("@")[0],
            hashedPassword: secureHash,
          });

          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          };
        }

        // Login flow
        const user = getUserByEmail(email);
        if (!user) {
          return null;
        }

        const isValid = await verifyCredential(inputCredential, user.hashedPassword);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: getAuthSecret(),
};
