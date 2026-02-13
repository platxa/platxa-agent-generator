"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>

      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        An unexpected error occurred. Please try again.
      </p>

      {process.env.NODE_ENV === "development" && error?.message && (
        <div className="mb-6 p-4 bg-muted rounded-lg text-left max-w-lg w-full overflow-auto">
          <p className="text-sm font-mono text-destructive">{error.message}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <Button asChild>
          <a href="/">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </a>
        </Button>
      </div>
    </div>
  );
}
