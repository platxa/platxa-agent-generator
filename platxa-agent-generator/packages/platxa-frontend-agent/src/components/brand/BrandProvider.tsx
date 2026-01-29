/**
 * BrandProvider Component (Feature #74)
 *
 * React context provider for brand-aware components.
 * Wraps your app at the root level to provide brand context to all children.
 *
 * @example Basic usage
 * ```tsx
 * import { BrandProvider } from "@platxa/frontend-agent"
 *
 * function App() {
 *   return (
 *     <BrandProvider>
 *       <YourApp />
 *     </BrandProvider>
 *   )
 * }
 * ```
 *
 * @example With brand package
 * ```tsx
 * <BrandProvider brandPackage="@acme/brand-kit">
 *   <YourApp />
 * </BrandProvider>
 * ```
 *
 * @example With loading and error states
 * ```tsx
 * <BrandProvider
 *   brandPackage="@acme/brand-kit"
 *   loading={<LoadingSpinner />}
 *   fallback={<ErrorMessage />}
 * >
 *   <YourApp />
 * </BrandProvider>
 * ```
 *
 * @module components/brand/BrandProvider
 */

import * as React from "react"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react"
import {
  loadBrandKit,
  clearBrandCache,
  subscribeToBrandChanges,
  getBrandStateSnapshot,
  isBrandLoading,
  isBrandError,
  type BrandProviderProps,
  type BrandContextValue,
  type UseBrandState,
} from "../../lib/react-agent/brand/loader"

// =============================================================================
// CONTEXT
// =============================================================================

/**
 * Brand context for providing brand state to components
 */
const BrandContext = createContext<BrandContextValue | null>(null)

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

/**
 * BrandProvider Component (Feature #74)
 *
 * Provides brand context to all child components. Handles loading,
 * error states, and brand switching.
 *
 * @param props - Provider props
 * @returns Provider wrapping children
 */
export function BrandProvider({
  children,
  brandPackage,
  loading,
  fallback,
  throwOnError = false,
}: BrandProviderProps): React.ReactElement {
  const [state, setState] = useState<UseBrandState>(getBrandStateSnapshot)
  const [error, setError] = useState<Error | null>(null)

  // Subscribe to brand state changes
  useEffect(() => {
    const unsubscribe = subscribeToBrandChanges(() => {
      setState(getBrandStateSnapshot())
    })
    return unsubscribe
  }, [])

  // Load brand package on mount or when it changes
  useEffect(() => {
    if (brandPackage) {
      setError(null)
      loadBrandKit(brandPackage).catch((err) => {
        const loadError = err instanceof Error ? err : new Error(String(err))
        setError(loadError)
        if (throwOnError) {
          throw loadError
        }
      })
    }
  }, [brandPackage, throwOnError])

  // Load brand function
  const loadBrand = useCallback(async (packageName: string) => {
    setError(null)
    try {
      await loadBrandKit(packageName)
    } catch (err) {
      const loadError = err instanceof Error ? err : new Error(String(err))
      setError(loadError)
      if (throwOnError) {
        throw loadError
      }
    }
  }, [throwOnError])

  // Clear brand function
  const clearBrand = useCallback(() => {
    clearBrandCache()
    setError(null)
  }, [])

  // Memoized context value
  const contextValue = useMemo<BrandContextValue>(() => ({
    ...state,
    loadBrand,
    clearBrand,
  }), [state, loadBrand, clearBrand])

  // Show loading state
  if (isBrandLoading() && loading) {
    return <>{loading}</>
  }

  // Show error state
  if ((isBrandError() || error) && fallback) {
    return <>{fallback}</>
  }

  return (
    <BrandContext.Provider value={contextValue}>
      {children}
    </BrandContext.Provider>
  )
}

BrandProvider.displayName = "BrandProvider"

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access brand context (Feature #74)
 *
 * Must be used within a BrandProvider.
 *
 * @returns Brand context value
 * @throws Error if used outside BrandProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { brandKit, isLoading, loadBrand } = useBrandContext()
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div style={{ color: brandKit?.semantics.light.primary }}>
 *       Branded content
 *     </div>
 *   )
 * }
 * ```
 */
export function useBrandContext(): BrandContextValue {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error(
      "useBrandContext must be used within a BrandProvider. " +
      "Wrap your app with <BrandProvider> at the root level."
    )
  }
  return context
}

/**
 * Hook to check if inside BrandProvider (Feature #74)
 *
 * Useful for components that optionally use brand context.
 *
 * @returns true if inside BrandProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasBrand = useHasBrandProvider()
 *
 *   if (hasBrand) {
 *     const { brandKit } = useBrandContext()
 *     // Use brand
 *   }
 *
 *   return <div>Works with or without brand</div>
 * }
 * ```
 */
export function useHasBrandProvider(): boolean {
  return useContext(BrandContext) !== null
}

/**
 * Hook to get brand kit or undefined (Feature #74)
 *
 * Safe version that doesn't throw outside BrandProvider.
 *
 * @returns Brand context or undefined
 */
export function useBrandContextSafe(): BrandContextValue | undefined {
  return useContext(BrandContext) ?? undefined
}

// =============================================================================
// EXPORTS
// =============================================================================

export { BrandContext }
export type { BrandProviderProps, BrandContextValue }
