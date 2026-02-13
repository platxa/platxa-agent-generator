import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAbortableRequest } from "@/lib/hooks/use-abortable-fetch";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock AbortSignal.any if it exists
const originalAbortSignalAny = globalThis.AbortSignal?.any;

describe("createAbortableRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
  });

  afterEach(() => {
    // Restore AbortSignal.any
    if (originalAbortSignalAny) {
      (AbortSignal as Record<string, unknown>).any = originalAbortSignalAny;
    }
  });

  it("wraps native fetch and returns a response", async () => {
    const { promise } = createAbortableRequest("http://example.com/api");
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledWith(
      "http://example.com/api",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(response.status).toBe(200);
  });

  it("abort() aborts the request", async () => {
    // Make fetch hang until aborted
    mockFetch.mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const { promise, abort } = createAbortableRequest("http://example.com");
    abort();

    await expect(promise).rejects.toThrow("aborted");
  });

  it("aborted request rejects with AbortError", async () => {
    mockFetch.mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const { promise, abort } = createAbortableRequest("http://example.com");
    abort();

    try {
      await promise;
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as DOMException).name).toBe("AbortError");
    }
  });

  it("passes through fetch options", async () => {
    const { promise } = createAbortableRequest("http://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"data":1}',
    });
    await promise;

    expect(mockFetch).toHaveBeenCalledWith(
      "http://example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"data":1}',
      })
    );
  });

  it("multiple independent requests can be created", async () => {
    const req1 = createAbortableRequest("http://example.com/1");
    const req2 = createAbortableRequest("http://example.com/2");

    await Promise.all([req1.promise, req2.promise]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("aborting one request does not affect others", async () => {
    let resolveReq1: ((value: Response) => void) | undefined;
    let rejectReq1: ((reason: unknown) => void) | undefined;

    mockFetch.mockImplementation((url: string, opts: RequestInit) => {
      if (url === "http://example.com/1") {
        return new Promise((resolve, reject) => {
          resolveReq1 = resolve;
          rejectReq1 = reject;
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(new Response("ok2"));
    });

    const req1 = createAbortableRequest("http://example.com/1");
    const req2 = createAbortableRequest("http://example.com/2");

    req1.abort();

    const res2 = await req2.promise;
    expect(res2).toBeTruthy();

    await expect(req1.promise).rejects.toThrow();
  });

  it("signal merging works when AbortSignal.any is available", async () => {
    // Mock AbortSignal.any
    const mockAny = vi.fn(([...signals]) => signals[0]);
    (AbortSignal as Record<string, unknown>).any = mockAny;

    const userController = new AbortController();
    createAbortableRequest("http://example.com", {
      signal: userController.signal,
    });

    expect(mockAny).toHaveBeenCalled();

    // Restore
    if (originalAbortSignalAny) {
      (AbortSignal as Record<string, unknown>).any = originalAbortSignalAny;
    } else {
      delete (AbortSignal as Record<string, unknown>).any;
    }
  });

  it("falls back to internal signal when AbortSignal.any is not available", async () => {
    // Remove AbortSignal.any temporarily
    const savedAny = (AbortSignal as Record<string, unknown>).any;
    delete (AbortSignal as Record<string, unknown>).any;

    const { promise } = createAbortableRequest("http://example.com", {
      signal: new AbortController().signal,
    });

    await promise;
    expect(mockFetch).toHaveBeenCalled();

    // Restore
    if (savedAny) {
      (AbortSignal as Record<string, unknown>).any = savedAny;
    }
  });
});
