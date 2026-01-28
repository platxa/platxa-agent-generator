import { describe, it, expect, beforeEach } from "vitest";
import {
  resetEntryCounter,
  createMemory,
  recordPreference,
  recordRejection,
  recordFavorite,
  getPreference,
  getPreferencesByCategory,
  wasRejected,
  getRejections,
  getTopFavorites,
  getStrongPreferences,
  serializeMemory,
  deserializeMemory,
  mergeMemories,
} from "@/lib/agent-bridge/preference-memory";

beforeEach(() => {
  resetEntryCounter();
});

describe("Preference Memory", () => {
  describe("createMemory", () => {
    it("creates empty memory", () => {
      const mem = createMemory("session-1");
      expect(mem.preferences.size).toBe(0);
      expect(mem.rejections).toHaveLength(0);
      expect(mem.favorites.size).toBe(0);
      expect(mem.sessionId).toBe("session-1");
    });
  });

  describe("recordPreference", () => {
    it("records explicit preference with high confidence", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "color", "primary", "#3b82f6", "explicit");
      const pref = getPreference(mem, "color", "primary");
      expect(pref).not.toBeNull();
      expect(pref!.value).toBe("#3b82f6");
      expect(pref!.confidence).toBe(0.8);
      expect(pref!.source).toBe("explicit");
    });

    it("records inferred preference with lower confidence", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "font", "heading", "Playfair Display", "inferred");
      const pref = getPreference(mem, "font", "heading");
      expect(pref!.confidence).toBe(0.4);
      expect(pref!.source).toBe("inferred");
    });

    it("reinforces existing preference", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      const pref = getPreference(mem, "color", "primary");
      expect(pref!.reinforcementCount).toBe(3);
      expect(pref!.confidence).toBe(1.0); // 0.8 + 0.1 + 0.1, capped at 1
    });

    it("replaces preference when value changes", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      mem = recordPreference(mem, "color", "primary", "#ef4444");
      const pref = getPreference(mem, "color", "primary");
      expect(pref!.value).toBe("#ef4444");
      expect(pref!.reinforcementCount).toBe(1);
    });

    it("upgrades source from inferred to explicit on reinforce", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "font", "body", "Roboto", "inferred");
      mem = recordPreference(mem, "font", "body", "Roboto", "explicit");
      const pref = getPreference(mem, "font", "body");
      expect(pref!.source).toBe("explicit");
    });
  });

  describe("recordRejection", () => {
    it("records rejected option", () => {
      let mem = createMemory();
      mem = recordRejection(mem, "color", "primary", "#ff0000", "Too bright");
      expect(mem.rejections).toHaveLength(1);
      expect(mem.rejections[0].value).toBe("#ff0000");
      expect(mem.rejections[0].reason).toBe("Too bright");
    });

    it("wasRejected returns true for rejected values", () => {
      let mem = createMemory();
      mem = recordRejection(mem, "font", "heading", "Comic Sans MS");
      expect(wasRejected(mem, "font", "heading", "Comic Sans MS")).toBe(true);
      expect(wasRejected(mem, "font", "heading", "Roboto")).toBe(false);
    });

    it("getRejections filters by category", () => {
      let mem = createMemory();
      mem = recordRejection(mem, "color", "primary", "#ff0000");
      mem = recordRejection(mem, "font", "heading", "Comic Sans MS");
      mem = recordRejection(mem, "color", "accent", "#00ff00");
      expect(getRejections(mem, "color")).toHaveLength(2);
      expect(getRejections(mem, "font")).toHaveLength(1);
    });
  });

  describe("recordFavorite", () => {
    it("records new favorite", () => {
      let mem = createMemory();
      mem = recordFavorite(mem, "hero-split-layout", "layout", ["hero", "split"]);
      const favs = getTopFavorites(mem);
      expect(favs).toHaveLength(1);
      expect(favs[0].name).toBe("hero-split-layout");
      expect(favs[0].useCount).toBe(1);
      expect(favs[0].tags).toEqual(["hero", "split"]);
    });

    it("increments use count on repeat", () => {
      let mem = createMemory();
      mem = recordFavorite(mem, "card-grid", "component");
      mem = recordFavorite(mem, "card-grid", "component");
      mem = recordFavorite(mem, "card-grid", "component");
      const favs = getTopFavorites(mem);
      expect(favs[0].useCount).toBe(3);
    });

    it("merges tags on repeat", () => {
      let mem = createMemory();
      mem = recordFavorite(mem, "hero", "layout", ["full-width"]);
      mem = recordFavorite(mem, "hero", "layout", ["centered"]);
      const favs = getTopFavorites(mem);
      expect(favs[0].tags).toContain("full-width");
      expect(favs[0].tags).toContain("centered");
    });
  });

  describe("queries", () => {
    it("getPreferencesByCategory filters correctly", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      mem = recordPreference(mem, "color", "accent", "#f59e0b");
      mem = recordPreference(mem, "font", "heading", "Roboto");
      expect(getPreferencesByCategory(mem, "color")).toHaveLength(2);
      expect(getPreferencesByCategory(mem, "font")).toHaveLength(1);
    });

    it("getTopFavorites sorts by use count", () => {
      let mem = createMemory();
      mem = recordFavorite(mem, "a", "layout");
      mem = recordFavorite(mem, "b", "layout");
      mem = recordFavorite(mem, "b", "layout");
      mem = recordFavorite(mem, "c", "layout");
      mem = recordFavorite(mem, "c", "layout");
      mem = recordFavorite(mem, "c", "layout");
      const top = getTopFavorites(mem, 2);
      expect(top).toHaveLength(2);
      expect(top[0].name).toBe("c");
      expect(top[1].name).toBe("b");
    });

    it("getTopFavorites filters by category", () => {
      let mem = createMemory();
      mem = recordFavorite(mem, "hero", "layout");
      mem = recordFavorite(mem, "card", "component");
      expect(getTopFavorites(mem, 5, "layout")).toHaveLength(1);
    });

    it("getStrongPreferences filters by threshold", () => {
      let mem = createMemory();
      mem = recordPreference(mem, "color", "primary", "#3b82f6", "explicit"); // 0.8
      mem = recordPreference(mem, "font", "body", "Roboto", "inferred"); // 0.4
      expect(getStrongPreferences(mem, 0.7)).toHaveLength(1);
      expect(getStrongPreferences(mem, 0.3)).toHaveLength(2);
    });
  });

  describe("serialization", () => {
    it("round-trips through serialize/deserialize", () => {
      let mem = createMemory("s1");
      mem = recordPreference(mem, "color", "primary", "#3b82f6");
      mem = recordRejection(mem, "font", "heading", "Comic Sans MS");
      mem = recordFavorite(mem, "hero", "layout", ["split"]);

      const serialized = serializeMemory(mem);
      expect(serialized.version).toBe(1);
      expect(serialized.preferences).toHaveLength(1);
      expect(serialized.rejections).toHaveLength(1);
      expect(serialized.favorites).toHaveLength(1);

      const restored = deserializeMemory(serialized);
      expect(getPreference(restored, "color", "primary")!.value).toBe("#3b82f6");
      expect(wasRejected(restored, "font", "heading", "Comic Sans MS")).toBe(true);
      expect(getTopFavorites(restored)[0].name).toBe("hero");
    });
  });

  describe("mergeMemories", () => {
    it("merges preferences (later wins)", () => {
      let m1 = createMemory("s1");
      m1 = recordPreference(m1, "color", "primary", "#old");
      let m2 = createMemory("s2");
      m2 = recordPreference(m2, "color", "primary", "#new");

      const merged = mergeMemories(m1, m2);
      expect(getPreference(merged, "color", "primary")!.value).toBe("#new");
    });

    it("combines favorites use counts", () => {
      let m1 = createMemory("s1");
      m1 = recordFavorite(m1, "hero", "layout");
      m1 = recordFavorite(m1, "hero", "layout");
      let m2 = createMemory("s2");
      m2 = recordFavorite(m2, "hero", "layout");

      const merged = mergeMemories(m1, m2);
      expect(getTopFavorites(merged)[0].useCount).toBe(3);
    });

    it("deduplicates rejections", () => {
      let m1 = createMemory("s1");
      m1 = recordRejection(m1, "color", "primary", "#ff0000");
      let m2 = createMemory("s2");
      m2 = recordRejection(m2, "color", "primary", "#ff0000");
      m2 = recordRejection(m2, "color", "accent", "#00ff00");

      const merged = mergeMemories(m1, m2);
      expect(merged.rejections).toHaveLength(2);
    });
  });

  describe("immutability", () => {
    it("does not mutate original memory", () => {
      const mem = createMemory();
      const updated = recordPreference(mem, "color", "primary", "#3b82f6");
      expect(mem.preferences.size).toBe(0);
      expect(updated.preferences.size).toBe(1);
    });
  });
});
