/**
 * Debounce utility with cancel/flush support and React hook
 */

import { useCallback, useEffect, useRef } from "react";

export interface DebounceOptions {
  /** Maximum time to wait before forcing execution (ms) */
  maxWait?: number;
}

export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  /** Cancel any pending execution */
  cancel(): void;
  /** Execute immediately if pending */
  flush(): void;
  /** Whether there is a pending execution */
  readonly pending: boolean;
}

/**
 * Creates a debounced version of a function that delays invocation
 * until `delay` ms have elapsed since the last call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options?: DebounceOptions
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let isPending = false;

  const { maxWait } = options || {};

  function execute() {
    if (lastArgs === null) return;
    const args = lastArgs;
    lastArgs = null;
    isPending = false;
    clearTimers();
    fn(...args);
  }

  function clearTimers() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId !== null) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
  }

  const debounced = function (...args: Parameters<T>) {
    lastArgs = args;
    isPending = true;

    // Reset the delay timer on each call
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(execute, delay);

    // Start maxWait timer only once per debounce cycle
    if (maxWait !== undefined && maxWaitTimeoutId === null) {
      maxWaitTimeoutId = setTimeout(execute, maxWait);
    }
  } as DebouncedFunction<T>;

  debounced.cancel = function () {
    lastArgs = null;
    isPending = false;
    clearTimers();
  };

  debounced.flush = function () {
    if (isPending) {
      execute();
    }
  };

  Object.defineProperty(debounced, "pending", {
    get() {
      return isPending;
    },
  });

  return debounced;
}

/**
 * React hook that returns a debounced callback.
 * Automatically cancels on unmount.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  deps: React.DependencyList = [],
  options?: DebounceOptions
): DebouncedFunction<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounced = useCallback(
    () => {
      const d = debounce(
        ((...args: unknown[]) => fnRef.current(...args)) as T,
        delay,
        options
      );
      return d;
    },
    // Re-create when delay or deps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delay, ...deps]
  )();

  // Store in ref so we can cancel on unmount
  const debouncedRef = useRef(debounced);
  debouncedRef.current = debounced;

  useEffect(() => {
    return () => {
      debouncedRef.current.cancel();
    };
  }, [debounced]);

  return debounced;
}
