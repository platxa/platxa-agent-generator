/**
 * Error Recovery Tests (Feature #24)
 *
 * Tests for graceful error handling when brand kit fails to load.
 * Verification criteria:
 * - App doesn't crash on load failure
 * - Fallback to default theme
 * - Error logged with details
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  loadBrandKit,
  getBrandError,
  isBrandError,
  getBrandLoadingStatus,
  resetBrandError,
  retryBrandLoad,
  getLastAttemptedPackage,
  canRetryBrandLoad,
  resetAllBrandState,
  getBrandLoadingState,
} from "../loader"

describe("Error Recovery (Feature #24)", () => {
  beforeEach(() => {
    // Full state reset before each test to ensure isolation
    resetAllBrandState()
  })

  describe("getBrandError", () => {
    it("should return null when no error", () => {
      expect(getBrandError()).toBeNull()
    })

    it("should return error message after failed load", async () => {
      // Attempt to load non-existent package
      await loadBrandKit("@nonexistent/brand-kit-that-does-not-exist")

      expect(getBrandError()).toBeTruthy()
      expect(typeof getBrandError()).toBe("string")
    })
  })

  describe("isBrandError", () => {
    it("should return false when no error", () => {
      expect(isBrandError()).toBe(false)
    })

    it("should return true after failed load", async () => {
      await loadBrandKit("@nonexistent/brand-kit-xyz")

      expect(isBrandError()).toBe(true)
    })
  })

  describe("getBrandLoadingStatus", () => {
    it("should return idle state initially", () => {
      const status = getBrandLoadingStatus()

      expect(status.state).toBe("idle")
      expect(status.isIdle).toBe(true)
      expect(status.isLoading).toBe(false)
      expect(status.isLoaded).toBe(false)
      expect(status.isError).toBe(false)
      expect(status.error).toBeNull()
    })

    it("should return error state after failed load", async () => {
      await loadBrandKit("@nonexistent/brand-xyz")

      const status = getBrandLoadingStatus()

      expect(status.state).toBe("error")
      expect(status.isError).toBe(true)
      expect(status.error).toBeTruthy()
    })
  })

  describe("resetBrandError", () => {
    it("should clear error state", async () => {
      // Create error state
      await loadBrandKit("@nonexistent/brand-abc")
      expect(isBrandError()).toBe(true)

      // Reset
      resetBrandError()

      expect(isBrandError()).toBe(false)
      expect(getBrandError()).toBeNull()
      expect(getBrandLoadingState()).toBe("idle")
    })

    it("should do nothing if not in error state", () => {
      expect(getBrandLoadingState()).toBe("idle")

      resetBrandError()

      expect(getBrandLoadingState()).toBe("idle")
    })
  })

  describe("getLastAttemptedPackage", () => {
    it("should return null initially", () => {
      expect(getLastAttemptedPackage()).toBeNull()
    })

    it("should return package name after load attempt", async () => {
      await loadBrandKit("@test/my-brand")

      expect(getLastAttemptedPackage()).toBe("@test/my-brand")
    })

    it("should update on each load attempt", async () => {
      await loadBrandKit("@test/first-brand")
      expect(getLastAttemptedPackage()).toBe("@test/first-brand")

      await loadBrandKit("@test/second-brand")
      expect(getLastAttemptedPackage()).toBe("@test/second-brand")
    })
  })

  describe("canRetryBrandLoad", () => {
    it("should return false initially", () => {
      expect(canRetryBrandLoad()).toBe(false)
    })

    it("should return true after failed load", async () => {
      await loadBrandKit("@nonexistent/retry-test")

      expect(canRetryBrandLoad()).toBe(true)
    })

    it("should return false after reset", async () => {
      await loadBrandKit("@nonexistent/retry-reset-test")
      expect(canRetryBrandLoad()).toBe(true)

      resetBrandError()

      expect(canRetryBrandLoad()).toBe(false)
    })
  })

  describe("retryBrandLoad", () => {
    it("should return null if no previous attempt", async () => {
      const result = await retryBrandLoad()

      expect(result).toBeNull()
    })

    it("should retry with last attempted package", async () => {
      // First attempt fails
      await loadBrandKit("@nonexistent/retry-package")
      expect(isBrandError()).toBe(true)

      // Retry (will also fail, but tests the mechanism)
      const result = await retryBrandLoad()

      expect(result).not.toBeNull()
      expect(result?.status).toBe("error")
    })

    it("should reset error state before retry", async () => {
      await loadBrandKit("@nonexistent/reset-before-retry")
      expect(isBrandError()).toBe(true)

      // During retry, error should be reset first
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

      await retryBrandLoad()

      spy.mockRestore()
    })
  })

  describe("Graceful Fallback", () => {
    it("should not throw on load failure", async () => {
      // Should not throw
      await expect(
        loadBrandKit("@nonexistent/no-throw-test")
      ).resolves.not.toThrow()
    })

    it("should return default theme config on failure", async () => {
      const result = await loadBrandKit("@nonexistent/fallback-theme")

      expect(result.status).toBe("error")
      expect(result.themeConfig).toBeDefined()
      expect(result.themeConfig.name).toBe("default")
    })

    it("should include error details in result", async () => {
      const result = await loadBrandKit("@nonexistent/error-details")

      expect(result.status).toBe("error")
      expect(result.error).toBeTruthy()
      expect(typeof result.error).toBe("string")
    })
  })

  describe("throwOnError option", () => {
    it("should throw when throwOnError is true", async () => {
      await expect(
        loadBrandKit("@nonexistent/throw-test", { throwOnError: true })
      ).rejects.toThrow()
    })

    it("should not throw when throwOnError is false", async () => {
      await expect(
        loadBrandKit("@nonexistent/no-throw", { throwOnError: false })
      ).resolves.not.toThrow()
    })
  })

  describe("Error Logging", () => {
    it("should log error to console on failure", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      await loadBrandKit("@nonexistent/log-test")

      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls.some(call =>
        call.some(arg => typeof arg === "string" && arg.includes("brand"))
      )).toBe(true)

      errorSpy.mockRestore()
    })
  })
})
