/**
 * Abortable fetch hook — auto-cancels in-flight requests on unmount or manual abort.
 * Also exports a standalone helper for non-React contexts.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Standalone abortable request wrapper (works outside React).
 * Returns an object with the fetch promise and an abort function.
 */
export function createAbortableRequest(
  url: string | URL | Request,
  options?: RequestInit
): { promise: Promise<Response>; abort: () => void } {
  const controller = new AbortController();

  // Merge signals if caller provides one
  let signal: AbortSignal;
  if (options?.signal && typeof AbortSignal.any === "function") {
    signal = AbortSignal.any([controller.signal, options.signal]);
  } else {
    signal = controller.signal;
  }

  const promise = fetch(url, { ...options, signal });

  return {
    promise,
    abort: () => controller.abort(),
  };
}

/**
 * React hook providing auto-abortable fetch.
 * All in-flight requests are automatically cancelled on unmount.
 */
export function useAbortableFetch() {
  const controllersRef = useRef(new Set<AbortController>());
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort all pending requests
      for (const controller of controllersRef.current) {
        controller.abort();
      }
      controllersRef.current.clear();
    };
  }, []);

  const abortAll = useCallback(() => {
    for (const controller of controllersRef.current) {
      controller.abort();
    }
    controllersRef.current.clear();
  }, []);

  const abortableFetch = useCallback(
    async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      const controller = new AbortController();

      // Merge signals if caller provides one
      let signal: AbortSignal;
      if (options?.signal && typeof AbortSignal.any === "function") {
        signal = AbortSignal.any([controller.signal, options.signal]);
      } else {
        signal = controller.signal;
      }

      controllersRef.current.add(controller);

      try {
        const response = await fetch(url, { ...options, signal });
        return response;
      } finally {
        controllersRef.current.delete(controller);
      }
    },
    []
  );

  return {
    fetch: abortableFetch,
    abortAll,
    get pendingCount() {
      return controllersRef.current.size;
    },
  };
}
