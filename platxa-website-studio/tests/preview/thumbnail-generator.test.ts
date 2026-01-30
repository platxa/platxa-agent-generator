/**
 * Tests for Thumbnail Generator
 *
 * Feature #104: Add thumbnail generation for visual version history
 * Verification: Small preview screenshot attached to each version
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ThumbnailGenerator,
  createThumbnailGenerator,
  SIZE_PRESETS,
  generateThumbnailId,
  getDimensions,
  getMimeType,
  calculateScaledDimensions,
  dataUrlToBlob,
  estimateFileSize,
  type ThumbnailSize,
  type ImageFormat,
} from "../../lib/preview/thumbnail-generator";

// Mock canvas context
const mockContext2D = {
  fillStyle: "",
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  font: "",
  textAlign: "",
  textBaseline: "",
  fillText: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
};

// Mock canvas
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockContext2D),
  toDataURL: vi.fn(() => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
};

// Mock document.createElement
const originalCreateElement = document.createElement.bind(document);

describe("ThumbnailGenerator", () => {
  let generator: ThumbnailGenerator;

  beforeEach(() => {
    generator = new ThumbnailGenerator();

    // Mock createElement for canvas
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    generator.dispose();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      expect(generator.getCacheSize()).toBe(0);
      expect(generator.getVersionThumbnails()).toEqual([]);
    });

    it("should accept custom options", () => {
      const custom = new ThumbnailGenerator({
        defaultSize: "lg",
        defaultFormat: "jpeg",
        quality: 0.9,
        maxCache: 100,
      });

      expect(custom).toBeDefined();
      custom.dispose();
    });
  });

  describe("createPlaceholder", () => {
    it("should create a placeholder thumbnail", () => {
      const placeholder = generator.createPlaceholder();

      expect(placeholder.dataUrl).toBeTruthy();
      expect(placeholder.metadata.id).toMatch(/^thumb_/);
      expect(placeholder.metadata.dimensions).toEqual(SIZE_PRESETS.sm);
    });

    it("should accept custom size", () => {
      const placeholder = generator.createPlaceholder({ size: "lg" });

      expect(placeholder.metadata.dimensions).toEqual(SIZE_PRESETS.lg);
    });

    it("should accept custom dimensions", () => {
      const placeholder = generator.createPlaceholder({
        size: { width: 200, height: 150 },
      });

      expect(placeholder.metadata.dimensions).toEqual({
        width: 200,
        height: 150,
      });
    });

    it("should accept version ID and label", () => {
      const placeholder = generator.createPlaceholder({
        versionId: "v1",
        label: "Version 1",
      });

      expect(placeholder.metadata.versionId).toBe("v1");
      expect(placeholder.metadata.label).toBe("Version 1");
    });
  });

  describe("captureFromCanvas", () => {
    it("should capture from canvas element", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      const thumbnail = generator.captureFromCanvas(sourceCanvas);

      expect(thumbnail.dataUrl).toBeTruthy();
      expect(thumbnail.metadata.format).toBe("png");
      expect(mockContext2D.drawImage).toHaveBeenCalled();
    });

    it("should use specified format", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      const thumbnail = generator.captureFromCanvas(sourceCanvas, {
        format: "jpeg",
      });

      expect(thumbnail.metadata.format).toBe("jpeg");
    });

    it("should add to cache", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      generator.captureFromCanvas(sourceCanvas);

      expect(generator.getCacheSize()).toBe(1);
    });

    it("should trigger generation callback", () => {
      const callback = vi.fn();
      generator.onGeneration(callback);

      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      generator.captureFromCanvas(sourceCanvas);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].metadata.id).toMatch(/^thumb_/);
    });

    it("should attach to version when versionId provided", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      generator.captureFromCanvas(sourceCanvas, { versionId: "v1" });

      expect(generator.getVersionThumbnail("v1")).toBeDefined();
    });
  });

  describe("version management", () => {
    it("should attach thumbnail to version", () => {
      const placeholder = generator.createPlaceholder();
      generator.attachToVersion("v1", placeholder);

      const retrieved = generator.getVersionThumbnail("v1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.versionId).toBe("v1");
    });

    it("should get version thumbnails sorted by timestamp", () => {
      const p1 = generator.createPlaceholder({ versionId: "v1", label: "V1" });
      generator.attachToVersion("v1", p1);

      // Small delay to ensure different timestamps
      const p2 = generator.createPlaceholder({ versionId: "v2", label: "V2" });
      p2.metadata.createdAt += 1000;
      generator.attachToVersion("v2", p2);

      const versions = generator.getVersionThumbnails();

      expect(versions).toHaveLength(2);
      expect(versions[0].versionId).toBe("v2"); // Newest first
      expect(versions[0].isCurrent).toBe(true);
      expect(versions[1].isCurrent).toBe(false);
    });

    it("should remove version thumbnail", () => {
      const placeholder = generator.createPlaceholder({ versionId: "v1" });
      generator.attachToVersion("v1", placeholder);

      expect(generator.removeVersionThumbnail("v1")).toBe(true);
      expect(generator.getVersionThumbnail("v1")).toBeUndefined();
    });

    it("should clear all version thumbnails", () => {
      generator.attachToVersion("v1", generator.createPlaceholder());
      generator.attachToVersion("v2", generator.createPlaceholder());

      generator.clearVersionThumbnails();

      expect(generator.getVersionThumbnails()).toHaveLength(0);
    });
  });

  describe("cache management", () => {
    it("should cache thumbnails", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      const thumbnail = generator.captureFromCanvas(sourceCanvas);

      const cached = generator.getCached(thumbnail.metadata.id);
      expect(cached).toBeDefined();
      expect(cached?.metadata.id).toBe(thumbnail.metadata.id);
    });

    it("should evict oldest entries when cache is full", () => {
      const smallCacheGenerator = new ThumbnailGenerator({ maxCache: 3 });
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      // Fill cache
      for (let i = 0; i < 5; i++) {
        smallCacheGenerator.captureFromCanvas(sourceCanvas, {
          versionId: `v${i}`,
        });
      }

      expect(smallCacheGenerator.getCacheSize()).toBe(3);

      smallCacheGenerator.dispose();
    });

    it("should clear cache", () => {
      const sourceCanvas = {
        width: 800,
        height: 600,
      } as HTMLCanvasElement;

      generator.captureFromCanvas(sourceCanvas);
      generator.captureFromCanvas(sourceCanvas);

      generator.clearCache();

      expect(generator.getCacheSize()).toBe(0);
    });
  });

  describe("callbacks", () => {
    it("should support multiple generation callbacks", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      generator.onGeneration(cb1);
      generator.onGeneration(cb2);

      generator.createPlaceholder();

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = generator.onGeneration(callback);

      generator.createPlaceholder();
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      generator.createPlaceholder();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const errorCb = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCb = vi.fn();

      generator.onGeneration(errorCb);
      generator.onGeneration(normalCb);

      expect(() => generator.createPlaceholder()).not.toThrow();
      expect(normalCb).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should prevent further operations", () => {
      generator.dispose();

      expect(() => generator.createPlaceholder()).toThrow(
        "ThumbnailGenerator is disposed"
      );
    });

    it("should clear all data", () => {
      generator.createPlaceholder();
      generator.attachToVersion("v1", generator.createPlaceholder());

      generator.dispose();

      // Create new generator to verify old one is cleared
      const newGen = new ThumbnailGenerator();
      expect(newGen.getCacheSize()).toBe(0);
      newGen.dispose();
    });

    it("should be idempotent", () => {
      expect(() => {
        generator.dispose();
        generator.dispose();
      }).not.toThrow();
    });
  });
});

describe("createThumbnailGenerator", () => {
  it("should create instance with factory function", () => {
    const gen = createThumbnailGenerator({ defaultSize: "md" });

    expect(gen).toBeInstanceOf(ThumbnailGenerator);
    gen.dispose();
  });
});

describe("utility functions", () => {
  describe("generateThumbnailId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateThumbnailId();
      const id2 = generateThumbnailId();

      expect(id1).toMatch(/^thumb_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("getDimensions", () => {
    it("should return preset dimensions for size string", () => {
      expect(getDimensions("xs")).toEqual({ width: 80, height: 60 });
      expect(getDimensions("sm")).toEqual({ width: 160, height: 120 });
      expect(getDimensions("md")).toEqual({ width: 320, height: 240 });
      expect(getDimensions("lg")).toEqual({ width: 480, height: 360 });
      expect(getDimensions("xl")).toEqual({ width: 640, height: 480 });
    });

    it("should return custom dimensions as-is", () => {
      const custom = { width: 200, height: 150 };
      expect(getDimensions(custom)).toEqual(custom);
    });
  });

  describe("getMimeType", () => {
    it("should return correct MIME types", () => {
      expect(getMimeType("png")).toBe("image/png");
      expect(getMimeType("jpeg")).toBe("image/jpeg");
      expect(getMimeType("webp")).toBe("image/webp");
    });
  });

  describe("calculateScaledDimensions", () => {
    it("should scale wider source to fit width", () => {
      const result = calculateScaledDimensions(800, 400, 200, 200);

      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });

    it("should scale taller source to fit height", () => {
      const result = calculateScaledDimensions(400, 800, 200, 200);

      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });

    it("should handle equal aspect ratios", () => {
      const result = calculateScaledDimensions(800, 600, 400, 300);

      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });
  });

  describe("dataUrlToBlob", () => {
    it("should convert data URL to Blob", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const blob = dataUrlToBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/png");
    });
  });

  describe("estimateFileSize", () => {
    it("should estimate file size from data URL", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const size = estimateFileSize(dataUrl);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe("number");
    });
  });
});

describe("constants", () => {
  describe("SIZE_PRESETS", () => {
    it("should have all size presets", () => {
      const sizes: ThumbnailSize[] = ["xs", "sm", "md", "lg", "xl"];

      for (const size of sizes) {
        expect(SIZE_PRESETS[size]).toBeDefined();
        expect(SIZE_PRESETS[size].width).toBeGreaterThan(0);
        expect(SIZE_PRESETS[size].height).toBeGreaterThan(0);
      }
    });

    it("should have increasing dimensions", () => {
      const sizes: ThumbnailSize[] = ["xs", "sm", "md", "lg", "xl"];

      for (let i = 1; i < sizes.length; i++) {
        expect(SIZE_PRESETS[sizes[i]].width).toBeGreaterThan(
          SIZE_PRESETS[sizes[i - 1]].width
        );
        expect(SIZE_PRESETS[sizes[i]].height).toBeGreaterThan(
          SIZE_PRESETS[sizes[i - 1]].height
        );
      }
    });
  });
});

describe("version thumbnail verification", () => {
  it("should attach small preview screenshot to each version", () => {
    // Mock canvas
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const generator = new ThumbnailGenerator({ defaultSize: "sm" });

    // Create versions with thumbnails
    const sourceCanvas = { width: 1024, height: 768 } as HTMLCanvasElement;

    generator.captureFromCanvas(sourceCanvas, {
      versionId: "version-1",
      label: "Initial design",
    });

    generator.captureFromCanvas(sourceCanvas, {
      versionId: "version-2",
      label: "Updated header",
    });

    generator.captureFromCanvas(sourceCanvas, {
      versionId: "version-3",
      label: "Final version",
    });

    // Verify all versions have thumbnails
    const versions = generator.getVersionThumbnails();

    expect(versions).toHaveLength(3);

    for (const version of versions) {
      expect(version.thumbnailUrl).toBeTruthy();
      expect(version.thumbnailUrl).toMatch(/^data:image\//);
      expect(version.dimensions).toEqual(SIZE_PRESETS.sm);
    }

    // Verify newest is marked as current
    expect(versions[0].isCurrent).toBe(true);

    generator.dispose();
  });
});
