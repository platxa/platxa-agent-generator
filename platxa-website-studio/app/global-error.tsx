"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">
              Something went wrong!
            </h2>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p className="text-slate-500 text-sm mb-4">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
