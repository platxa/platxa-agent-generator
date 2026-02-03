import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Enable standalone output for Docker deployment
  output: "standalone",

  // Externalize server-side packages to prevent critical dependency warnings
  // This fixes: sass.dart.js dynamic require warnings
  // Also externalize yjs to prevent "already imported" warning during HMR
  serverExternalPackages: ["sass", "yjs", "y-protocols"],

  // Configure Monaco Editor webpack settings
  webpack: (config, { isServer }) => {
    // Handle Monaco Editor's web workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    // Monaco Editor worker configuration
    config.module.rules.push({
      test: /\.ttf$/,
      type: "asset/resource",
    });

    // Resolve @platxa/frontend-agent to the source package
    config.resolve.alias = {
      ...config.resolve.alias,
      "@platxa/frontend-agent": path.resolve(
        __dirname,
        "../packages/platxa-frontend-agent/src",
      ),
      // Deduplicate Yjs - ensure single instance across all imports
      // This fixes "Yjs was already imported" warning
      "yjs": path.resolve(__dirname, "node_modules/yjs"),
      "y-protocols": path.resolve(__dirname, "node_modules/y-protocols"),
    };

    // Suppress critical dependency warnings for packages with dynamic requires
    // These are safe - sass and theme-worker use dynamic requires internally
    config.module.exprContextCritical = false;

    return config;
  },

  // Experimental features for Next.js 15
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Headers for iframe embedding and CORS
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },

  // Environment variables exposed to the client
  env: {
    NEXT_PUBLIC_APP_NAME: "Platxa Website Studio",
    NEXT_PUBLIC_APP_VERSION: "0.1.0",
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Organization and project from environment
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in production
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  // Tree-shake Sentry logger statements to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
