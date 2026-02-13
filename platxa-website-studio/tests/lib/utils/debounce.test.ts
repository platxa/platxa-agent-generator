import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "@/lib/utils/debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays execution by specified ms", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments through to the original function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("a", "b");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("only executes once after rapid calls settle", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced();
    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets delay on each call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(150);
    debounced(); // reset timer
    vi.advanceTimersByTime(150);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses the last call's arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("third");
  });

  describe("cancel()", () => {
    it("prevents pending execution", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      debounced.cancel();

      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });

    it("is safe to call when nothing is pending", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      expect(() => debounced.cancel()).not.toThrow();
    });
  });

  describe("flush()", () => {
    it("triggers execution immediately if pending", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 500);

      debounced("flushed");
      debounced.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("flushed");
    });

    it("does nothing if not pending", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced.flush();
      expect(fn).not.toHaveBeenCalled();
    });

    it("does not fire again after flush when timer expires", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      debounced.flush();
      vi.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("pending", () => {
    it("is false initially", () => {
      const debounced = debounce(vi.fn(), 100);
      expect(debounced.pending).toBe(false);
    });

    it("is true after a call", () => {
      const debounced = debounce(vi.fn(), 100);
      debounced();
      expect(debounced.pending).toBe(true);
    });

    it("is false after execution", () => {
      const debounced = debounce(vi.fn(), 100);
      debounced();
      vi.advanceTimersByTime(100);
      expect(debounced.pending).toBe(false);
    });

    it("is false after cancel", () => {
      const debounced = debounce(vi.fn(), 100);
      debounced();
      debounced.cancel();
      expect(debounced.pending).toBe(false);
    });
  });

  describe("maxWait option", () => {
    it("forces execution after maxWait even with continuous calls", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200, { maxWait: 500 });

      // Keep calling every 100ms, so the regular 200ms debounce never fires
      for (let i = 0; i < 10; i++) {
        debounced();
        vi.advanceTimersByTime(100);
      }

      // After 1000ms total, maxWait (500ms) should have fired at least once
      expect(fn).toHaveBeenCalled();
    });

    it("caps maximum delay to maxWait value", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 1000, { maxWait: 300 });

      debounced();
      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
