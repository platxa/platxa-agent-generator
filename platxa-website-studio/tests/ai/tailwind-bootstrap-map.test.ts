import { describe, it, expect } from "vitest";
import {
  TAILWIND_TO_BOOTSTRAP,
  convertTailwindToBootstrap,
  stripResponsivePrefixes,
} from "@/lib/ai/tailwind-bootstrap-map";

// =============================================================================
// stripResponsivePrefixes
// =============================================================================

describe("stripResponsivePrefixes", () => {
  it("strips sm: prefix", () => {
    expect(stripResponsivePrefixes("sm:flex-col")).toBe("flex-col");
  });

  it("strips md: prefix", () => {
    expect(stripResponsivePrefixes("md:hidden")).toBe("hidden");
  });

  it("strips lg: prefix", () => {
    expect(stripResponsivePrefixes("lg:text-xl")).toBe("text-xl");
  });

  it("strips xl: prefix", () => {
    expect(stripResponsivePrefixes("xl:py-8")).toBe("py-8");
  });

  it("strips 2xl: prefix", () => {
    expect(stripResponsivePrefixes("2xl:container")).toBe("container");
  });

  it("leaves non-responsive classes unchanged", () => {
    expect(stripResponsivePrefixes("flex-col")).toBe("flex-col");
    expect(stripResponsivePrefixes("d-flex")).toBe("d-flex");
  });
});

// =============================================================================
// TAILWIND_TO_BOOTSTRAP mapping coverage
// =============================================================================

describe("TAILWIND_TO_BOOTSTRAP mapping", () => {
  it("has 200+ entries", () => {
    expect(Object.keys(TAILWIND_TO_BOOTSTRAP).length).toBeGreaterThanOrEqual(200);
  });

  it.each([
    // Spacing
    ["py-10", "py-5"], ["px-8", "px-4"], ["mt-10", "mt-5"], ["mb-8", "mb-5"],
    ["gap-6", "gap-4"], ["gap-8", "gap-4"],
    // Layout
    ["h-screen", "min-vh-100"], ["min-h-screen", "min-vh-100"],
    ["w-full", "w-100"], ["max-w-7xl", "container"],
    // Flexbox
    ["flex", "d-flex"], ["inline-flex", "d-inline-flex"],
    ["flex-col", "flex-column"], ["items-center", "align-items-center"],
    ["justify-center", "justify-content-center"], ["justify-between", "justify-content-between"],
    // Typography
    ["text-xl", "fs-4"], ["text-2xl", "fs-3"], ["text-sm", "small"],
    ["font-bold", "fw-bold"], ["font-semibold", "fw-semibold"],
    ["text-center", "text-center"], ["uppercase", "text-uppercase"],
    // Borders
    ["rounded-lg", "rounded-3"], ["rounded-full", "rounded-circle"],
    // Display
    ["hidden", "d-none"], ["block", "d-block"],
    // Position
    ["relative", "position-relative"], ["absolute", "position-absolute"],
    // Effects
    ["shadow-lg", "shadow-lg"], ["opacity-50", "opacity-50"],
    // Colors
    ["text-white", "text-white"], ["bg-gray-100", "bg-light"],
    // Visibility
    ["sr-only", "visually-hidden"],
  ])("maps '%s' → '%s'", (tw, bs) => {
    expect(TAILWIND_TO_BOOTSTRAP[tw]).toBe(bs);
  });

  it("maps cursor-pointer to empty string (remove)", () => {
    expect(TAILWIND_TO_BOOTSTRAP["cursor-pointer"]).toBe("");
  });

  it("maps bg-cover to empty string (no BS equivalent)", () => {
    expect(TAILWIND_TO_BOOTSTRAP["bg-cover"]).toBe("");
  });

  it("maps transition utilities to empty string", () => {
    expect(TAILWIND_TO_BOOTSTRAP["transition-all"]).toBe("");
    expect(TAILWIND_TO_BOOTSTRAP["duration-300"]).toBe("");
  });
});

// =============================================================================
// convertTailwindToBootstrap
// =============================================================================

describe("convertTailwindToBootstrap", () => {
  it("converts Tailwind classes in double-quoted class attributes", () => {
    const html = '<div class="flex items-center justify-between">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex align-items-center justify-content-between">');
  });

  it("converts Tailwind classes in single-quoted class attributes", () => {
    const html = "<div class='flex flex-col'>";
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe("<div class='d-flex flex-column'>");
  });

  it("preserves unknown classes (Bootstrap or custom)", () => {
    const html = '<div class="flex o_cc o_cc1 my-custom-class">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex o_cc o_cc1 my-custom-class">');
  });

  it("removes Tailwind classes that map to empty string", () => {
    const html = '<div class="bg-cover bg-center bg-no-repeat flex">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex">');
  });

  it("strips responsive prefixes and applies mapping", () => {
    const html = '<div class="md:flex-col lg:hidden">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="flex-column d-none">');
  });

  it("removes arbitrary value classes like w-[200px]", () => {
    const html = '<div class="flex w-[200px] text-[#333]">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex">');
  });

  it("handles multiple class attributes in one HTML string", () => {
    const html = '<div class="flex"><span class="font-bold text-xl">Hi</span></div>';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex"><span class="fw-bold fs-4">Hi</span></div>');
  });

  it("handles already-Bootstrap classes without modification", () => {
    const html = '<div class="d-flex align-items-center">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="d-flex align-items-center">');
  });

  it("returns HTML unchanged when no class attributes present", () => {
    const html = '<div id="test"><p>Hello</p></div>';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe(html);
  });

  it("handles empty class attribute", () => {
    const html = '<div class="">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="">');
  });

  it("handles multi-word replacement like aspect-video", () => {
    const html = '<div class="aspect-video">';
    const result = convertTailwindToBootstrap(html);
    expect(result).toBe('<div class="ratio ratio-16x9">');
  });
});
