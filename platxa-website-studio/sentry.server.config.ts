import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Only enable when DSN is set
  enabled: !!process.env.SENTRY_DSN,

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ["error"],
    }),
  ],

  // Add context
  beforeSend(event) {
    // Don't send events in development unless DSN is explicitly set
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DSN) {
      return null;
    }
    return event;
  },
});
