import { describe, it, expect } from "vitest";
import {
  DEFAULT_GRID_CONFIG,
  BOOTSTRAP_BREAKPOINTS,
  createGridState,
  toggleOverlay,
  showOverlay,
  hideOverlay,
  setBreakpoint,
  toggleBaseline,
  setOpacity,
  setColumns,
  setGutter,
  generateGridCSS,
  generateGridHTML,
  getGridSummary,
  getBreakpointForWidth,
} from "@/lib/agent-bridge/grid-overlay";

describe("Grid Overlay", () => {
  describe("DEFAULT_GRID_CONFIG", () => {
    it("has 12 columns", () => {
      expect(DEFAULT_GRID_CONFIG.columns).toBe(12);
      expect(DEFAULT_GRID_CONFIG.gutterPx).toBe(30);
      expect(DEFAULT_GRID_CONFIG.containerMaxWidth).toBe(1140);
    });
  });

  describe("BOOTSTRAP_BREAKPOINTS", () => {
    it("has 6 breakpoints", () => {
      expect(BOOTSTRAP_BREAKPOINTS).toHaveLength(6);
      expect(BOOTSTRAP_BREAKPOINTS.map((b) => b.name)).toEqual([
        "xs", "sm", "md", "lg", "xl", "xxl",
      ]);
    });
  });

  describe("createGridState", () => {
    it("creates hidden state with defaults", () => {
      const state = createGridState();
      expect(state.visible).toBe(false);
      expect(state.config.columns).toBe(12);
      expect(state.activeBreakpoint).toBe("xl");
    });

    it("accepts custom config", () => {
      const state = createGridState({ columns: 6 });
      expect(state.config.columns).toBe(6);
      expect(state.config.gutterPx).toBe(30);
    });
  });

  describe("toggleOverlay", () => {
    it("toggles visibility", () => {
      const state = createGridState();
      expect(toggleOverlay(state).visible).toBe(true);
      expect(toggleOverlay(toggleOverlay(state)).visible).toBe(false);
    });

    it("does not mutate input", () => {
      const state = createGridState();
      toggleOverlay(state);
      expect(state.visible).toBe(false);
    });
  });

  describe("showOverlay / hideOverlay", () => {
    it("shows and hides", () => {
      expect(showOverlay(createGridState()).visible).toBe(true);
      expect(hideOverlay(showOverlay(createGridState())).visible).toBe(false);
    });
  });

  describe("setBreakpoint", () => {
    it("sets breakpoint and updates container width", () => {
      const state = setBreakpoint(createGridState(), "md");
      expect(state.activeBreakpoint).toBe("md");
      expect(state.config.containerMaxWidth).toBe(720);
    });

    it("returns same state for unknown breakpoint", () => {
      const state = createGridState();
      expect(setBreakpoint(state, "unknown")).toBe(state);
    });
  });

  describe("toggleBaseline", () => {
    it("toggles baseline visibility", () => {
      const state = createGridState();
      expect(state.showBaseline).toBe(false);
      expect(toggleBaseline(state).showBaseline).toBe(true);
    });
  });

  describe("setOpacity", () => {
    it("sets opacity clamped to 0-1", () => {
      expect(setOpacity(createGridState(), 0.5).opacity).toBe(0.5);
      expect(setOpacity(createGridState(), -1).opacity).toBe(0);
      expect(setOpacity(createGridState(), 2).opacity).toBe(1);
    });
  });

  describe("setColumns", () => {
    it("sets column count", () => {
      expect(setColumns(createGridState(), 6).config.columns).toBe(6);
    });

    it("clamps to minimum 1", () => {
      expect(setColumns(createGridState(), 0).config.columns).toBe(1);
    });
  });

  describe("setGutter", () => {
    it("sets gutter width", () => {
      expect(setGutter(createGridState(), 15).config.gutterPx).toBe(15);
    });

    it("clamps to minimum 0", () => {
      expect(setGutter(createGridState(), -5).config.gutterPx).toBe(0);
    });
  });

  describe("generateGridCSS", () => {
    it("returns empty when not visible", () => {
      expect(generateGridCSS(createGridState())).toBe("");
    });

    it("generates column CSS when visible", () => {
      const state = showOverlay(createGridState());
      const css = generateGridCSS(state);
      expect(css).toContain(".grid-overlay");
      expect(css).toContain(".grid-overlay__column");
      expect(css).toContain("pointer-events: none");
      expect(css).toContain("z-index: 9999");
    });

    it("includes container max-width", () => {
      const state = showOverlay(createGridState());
      const css = generateGridCSS(state);
      expect(css).toContain("max-width: 1140px");
    });

    it("uses fluid width when containerMaxWidth is 0", () => {
      const state = showOverlay(setBreakpoint(createGridState(), "xs"));
      const css = generateGridCSS(state);
      expect(css).toContain("width: 100%");
    });

    it("includes gutter spacing", () => {
      const state = showOverlay(createGridState());
      const css = generateGridCSS(state);
      expect(css).toContain("15px"); // gutterPx/2 = 30/2
    });

    it("includes baseline grid when enabled", () => {
      let state = showOverlay(createGridState({ baselineRowHeight: 24 }));
      state = toggleBaseline(state);
      const css = generateGridCSS(state);
      expect(css).toContain("grid-overlay__baseline");
      expect(css).toContain("repeating-linear-gradient");
      expect(css).toContain("24px");
    });

    it("omits baseline when disabled", () => {
      const state = showOverlay(createGridState());
      const css = generateGridCSS(state);
      expect(css).not.toContain("baseline");
    });

    it("applies opacity", () => {
      const state = setOpacity(showOverlay(createGridState()), 0.5);
      const css = generateGridCSS(state);
      expect(css).toContain("opacity: 0.5");
    });
  });

  describe("generateGridHTML", () => {
    it("returns empty when not visible", () => {
      expect(generateGridHTML(createGridState())).toBe("");
    });

    it("generates 12 column divs", () => {
      const state = showOverlay(createGridState());
      const html = generateGridHTML(state);
      expect(html).toContain('class="grid-overlay"');
      const colMatches = html.match(/grid-overlay__column/g);
      expect(colMatches).toHaveLength(12);
    });

    it("generates correct number for custom columns", () => {
      const state = showOverlay(setColumns(createGridState(), 6));
      const html = generateGridHTML(state);
      const colMatches = html.match(/grid-overlay__column/g);
      expect(colMatches).toHaveLength(6);
    });

    it("includes data-col attributes", () => {
      const state = showOverlay(createGridState());
      const html = generateGridHTML(state);
      expect(html).toContain('data-col="1"');
      expect(html).toContain('data-col="12"');
    });

    it("includes baseline div when enabled", () => {
      let state = showOverlay(createGridState({ baselineRowHeight: 24 }));
      state = toggleBaseline(state);
      const html = generateGridHTML(state);
      expect(html).toContain("grid-overlay__baseline");
    });
  });

  describe("getGridSummary", () => {
    it("returns summary object", () => {
      const state = showOverlay(createGridState());
      const summary = getGridSummary(state);
      expect(summary.visible).toBe(true);
      expect(summary.columns).toBe(12);
      expect(summary.gutterPx).toBe(30);
      expect(summary.breakpoint).toBe("xl");
    });
  });

  describe("getBreakpointForWidth", () => {
    it("returns xs for small widths", () => {
      expect(getBreakpointForWidth(320)).toBe("xs");
    });

    it("returns md for tablet widths", () => {
      expect(getBreakpointForWidth(800)).toBe("md");
    });

    it("returns xl for desktop widths", () => {
      expect(getBreakpointForWidth(1200)).toBe("xl");
    });

    it("returns xxl for large widths", () => {
      expect(getBreakpointForWidth(1500)).toBe("xxl");
    });
  });
});
