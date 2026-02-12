/**
 * Preference Store
 *
 * Zustand store for persisting user preference memory across sessions.
 * Tracks style preferences, rejected options, and favorite patterns.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getStrongPreferences,
  getTopFavorites,
  getRejections,
  deserializeMemory,
  type PreferenceCategory,
  type PreferenceEntry,
  type FavoritePattern,
  type RejectedOption,
  type SerializedMemory,
} from "@/lib/agent-bridge/preference-memory";

// =============================================================================
// State Interface
// =============================================================================

interface PreferenceState {
  // Serialized memory for persistence
  serializedMemory: SerializedMemory | null;

  // Actions
  /** Get strong preferences (high confidence) */
  getStrong: (threshold?: number) => PreferenceEntry[];

  /** Get top favorites */
  getFavorites: (n?: number, category?: PreferenceCategory) => FavoritePattern[];

  /** Get rejections by category */
  getRejectionsByCategory: (category: PreferenceCategory) => RejectedOption[];

  /** Build a prompt fragment from preferences */
  buildPreferencePrompt: () => string;

  /** Reset all preferences */
  reset: () => void;
}

// =============================================================================
// Store
// =============================================================================

const STORAGE_KEY = "platxa-preference-memory";

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set, get) => ({
      serializedMemory: null,

      getStrong: (threshold = 0.7) => {
        const current = get().serializedMemory;
        if (!current) return [];
        const memory = deserializeMemory(current);
        return getStrongPreferences(memory, threshold);
      },

      getFavorites: (n = 5, category) => {
        const current = get().serializedMemory;
        if (!current) return [];
        const memory = deserializeMemory(current);
        return getTopFavorites(memory, n, category);
      },

      getRejectionsByCategory: (category) => {
        const current = get().serializedMemory;
        if (!current) return [];
        const memory = deserializeMemory(current);
        return getRejections(memory, category);
      },

      buildPreferencePrompt: () => {
        const current = get().serializedMemory;
        if (!current) return "";

        const memory = deserializeMemory(current);
        const strong = getStrongPreferences(memory, 0.7);
        const favorites = getTopFavorites(memory, 3);
        const colorRejections = getRejections(memory, "color");
        const styleRejections = getRejections(memory, "style");

        if (strong.length === 0 && favorites.length === 0) {
          return "";
        }

        const lines: string[] = [
          "",
          "## User Preferences (from previous sessions)",
          "",
        ];

        // Group preferences by category
        const byCategory = new Map<PreferenceCategory, PreferenceEntry[]>();
        for (const pref of strong) {
          const existing = byCategory.get(pref.category) || [];
          existing.push(pref);
          byCategory.set(pref.category, existing);
        }

        if (byCategory.size > 0) {
          lines.push("**Style Preferences:**");
          for (const [category, prefs] of byCategory) {
            for (const pref of prefs) {
              lines.push(`- ${category}/${pref.key}: ${pref.value} (confidence: ${Math.round(pref.confidence * 100)}%)`);
            }
          }
          lines.push("");
        }

        if (favorites.length > 0) {
          lines.push("**Favorite Patterns:**");
          for (const fav of favorites) {
            lines.push(`- ${fav.name} (used ${fav.useCount}x)`);
          }
          lines.push("");
        }

        const allRejections = [...colorRejections, ...styleRejections].slice(0, 5);
        if (allRejections.length > 0) {
          lines.push("**Avoid These (previously rejected):**");
          for (const rej of allRejections) {
            const reasonPart = rej.reason ? ` — "${rej.reason}"` : "";
            lines.push(`- ${rej.category}/${rej.key}: ${rej.value}${reasonPart}`);
          }
          lines.push("");
        }

        lines.push("Use these preferences when generating designs. Honor rejections.");
        lines.push("");

        return lines.join("\n");
      },

      reset: () => {
        set({
          serializedMemory: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        serializedMemory: state.serializedMemory,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectHasPreferences = (state: PreferenceState) =>
  state.serializedMemory !== null &&
  (state.serializedMemory.preferences.length > 0 ||
    state.serializedMemory.favorites.length > 0);

export const selectPreferenceCount = (state: PreferenceState) =>
  state.serializedMemory?.preferences.length ?? 0;

export const selectFavoriteCount = (state: PreferenceState) =>
  state.serializedMemory?.favorites.length ?? 0;
