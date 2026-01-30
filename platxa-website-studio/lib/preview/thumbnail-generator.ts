/**
 * ThumbnailGenerator — Thumbnail generation for visual version history.
 *
 * Feature #104: Add thumbnail generation for visual version history
 * Verification: Small preview screenshot attached to each version
 *
 * Generates thumbnail screenshots from iframe previews for version
 * history visualization and quick comparison.
 *
 * @module lib/preview/thumbnail-generator
 */

// =============================================================================
// Types
// =============================================================================

/** Thumbnail size preset */
export type ThumbnailSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Image format for thumbnails */
export type ImageFormat = "png" | "jpeg" | "webp";

/** Thumbnail dimensions */
export interface ThumbnailDimensions {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Thumbnail metadata */
export interface ThumbnailMetadata {
  /** Unique thumbnail ID */
  id: string;
  /** Version ID this thumbnail belongs to */
  versionId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Thumbnail dimensions */
  dimensions: ThumbnailDimensions;
  /** Image format */
  format: ImageFormat;
  /** File size in bytes (if available) */
  fileSize?: number;
  /** Source URL or identifier */
  source?: string;
  /** Optional label/description */
  label?: string;
}

/** Generated thumbnail result */
export interface Thumbnail {
  /** Thumbnail metadata */
  metadata: ThumbnailMetadata;
  /** Data URL of the thumbnail image */
  dataUrl: string;
  /** Blob of the thumbnail (if available) */
  blob?: Blob;
}

/** Version with thumbnail */
export interface VersionThumbnail {
  /** Version ID */
  versionId: string;
  /** Version label/name */
  label: string;
  /** Version timestamp */
  timestamp: number;
  /** Thumbnail data URL */
  thumbnailUrl: string;
  /** Thumbnail dimensions */
  dimensions: ThumbnailDimensions;
  /** Whether this is the current version */
  isCurrent: boolean;
}

/** Thumbnail generator options */
export interface ThumbnailGeneratorOptions {
  /** Default size preset (default: 'sm') */
  defaultSize?: ThumbnailSize;
  /** Default image format (default: 'png') */
  defaultFormat?: ImageFormat;
  /** JPEG/WebP quality 0-1 (default: 0.8) */
  quality?: number;
  /** Maximum thumbnails to cache (default: 50) */
  maxCache?: number;
  /** Enable background color (default: '#ffffff') */
  backgroundColor?: string;
  /** Capture delay in ms (default: 100) */
  captureDelay?: number;
}

/** Capture options for individual thumbnails */
export interface CaptureOptions {
  /** Size preset or custom dimensions */
  size?: ThumbnailSize | ThumbnailDimensions;
  /** Image format */
  format?: ImageFormat;
  /** Quality for JPEG/WebP */
  quality?: number;
  /** Version ID to associate */
  versionId?: string;
  /** Optional label */
  label?: string;
  /** Selector to capture (default: body) */
  selector?: string;
}

/** Thumbnail cache entry */
interface CacheEntry {
  thumbnail: Thumbnail;
  accessedAt: number;
}

/** Generation callback */
export type GenerationCallback = (thumbnail: Thumbnail) => void;

/** Error callback */
export type ErrorCallback = (error: Error, versionId?: string) => void;

// =============================================================================
// Constants
// =============================================================================

/** Size preset dimensions */
export const SIZE_PRESETS: Record<ThumbnailSize, ThumbnailDimensions> = {
  xs: { width: 80, height: 60 },
  sm: { width: 160, height: 120 },
  md: { width: 320, height: 240 },
  lg: { width: 480, height: 360 },
  xl: { width: 640, height: 480 },
};

/** Default generator options */
const DEFAULT_OPTIONS: Required<ThumbnailGeneratorOptions> = {
  defaultSize: "sm",
  defaultFormat: "png",
  quality: 0.8,
  maxCache: 50,
  backgroundColor: "#ffffff",
  captureDelay: 100,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique thumbnail ID.
 */
export function generateThumbnailId(): string {
  return `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Gets dimensions from size preset or custom dimensions.
 */
export function getDimensions(
  size: ThumbnailSize | ThumbnailDimensions
): ThumbnailDimensions {
  if (typeof size === "string") {
    return SIZE_PRESETS[size];
  }
  return size;
}

/**
 * Gets MIME type for image format.
 */
export function getMimeType(format: ImageFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

/**
 * Calculates aspect-ratio-preserving dimensions.
 */
export function calculateScaledDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): ThumbnailDimensions {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio > targetRatio) {
    // Source is wider, fit to width
    return {
      width: targetWidth,
      height: Math.round(targetWidth / sourceRatio),
    };
  } else {
    // Source is taller, fit to height
    return {
      width: Math.round(targetHeight * sourceRatio),
      height: targetHeight,
    };
  }
}

/**
 * Converts data URL to Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }

  return new Blob([u8arr], { type: mime });
}

/**
 * Estimates file size from data URL.
 */
export function estimateFileSize(dataUrl: string): number {
  // Base64 encoded data is ~4/3 the size of binary
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round((base64.length * 3) / 4);
}

// =============================================================================
// ThumbnailGenerator Class
// =============================================================================

/**
 * ThumbnailGenerator — Generates thumbnail screenshots for version history.
 *
 * @example
 * ```typescript
 * const generator = new ThumbnailGenerator({
 *   defaultSize: 'sm',
 *   defaultFormat: 'png',
 * });
 *
 * // Capture from iframe
 * const thumbnail = await generator.captureFromIframe(iframe, {
 *   versionId: 'v1',
 *   label: 'Initial version',
 * });
 *
 * // Get version thumbnails
 * const versions = generator.getVersionThumbnails();
 * ```
 */
export class ThumbnailGenerator {
  private options: Required<ThumbnailGeneratorOptions>;
  private cache = new Map<string, CacheEntry>();
  private versionThumbnails = new Map<string, Thumbnail>();
  private generationCallbacks = new Set<GenerationCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private disposed = false;

  constructor(options: ThumbnailGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ---------------------------------------------------------------------------
  // Capture Methods
  // ---------------------------------------------------------------------------

  /**
   * Captures a thumbnail from an iframe element.
   */
  async captureFromIframe(
    iframe: HTMLIFrameElement,
    captureOptions: CaptureOptions = {}
  ): Promise<Thumbnail> {
    if (this.disposed) {
      throw new Error("ThumbnailGenerator is disposed");
    }

    const dimensions = getDimensions(
      captureOptions.size ?? this.options.defaultSize
    );
    const format = captureOptions.format ?? this.options.defaultFormat;
    const quality = captureOptions.quality ?? this.options.quality;

    try {
      // Wait for capture delay
      await this.delay(this.options.captureDelay);

      // Get iframe document
      const iframeDoc =
        iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("Cannot access iframe document");
      }

      // Get element to capture
      const selector = captureOptions.selector ?? "body";
      const element = iframeDoc.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Create canvas and capture
      const dataUrl = await this.captureElementToDataUrl(
        element as HTMLElement,
        dimensions,
        format,
        quality
      );

      // Build thumbnail
      const thumbnail = this.buildThumbnail(
        dataUrl,
        dimensions,
        format,
        captureOptions
      );

      // Cache and store
      this.addToCache(thumbnail);
      if (captureOptions.versionId) {
        this.versionThumbnails.set(captureOptions.versionId, thumbnail);
      }

      // Notify callbacks
      this.notifyGeneration(thumbnail);

      return thumbnail;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyError(err, captureOptions.versionId);
      throw err;
    }
  }

  /**
   * Captures a thumbnail from an HTML string.
   */
  async captureFromHtml(
    html: string,
    captureOptions: CaptureOptions = {}
  ): Promise<Thumbnail> {
    if (this.disposed) {
      throw new Error("ThumbnailGenerator is disposed");
    }

    const dimensions = getDimensions(
      captureOptions.size ?? this.options.defaultSize
    );
    const format = captureOptions.format ?? this.options.defaultFormat;
    const quality = captureOptions.quality ?? this.options.quality;

    try {
      // Create temporary iframe
      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:absolute;left:-9999px;width:1024px;height:768px;border:none;";
      document.body.appendChild(iframe);

      try {
        // Write HTML to iframe
        const iframeDoc =
          iframe.contentDocument ?? iframe.contentWindow?.document;
        if (!iframeDoc) {
          throw new Error("Cannot access iframe document");
        }

        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // Wait for content to render
        await this.delay(this.options.captureDelay);

        // Capture
        const dataUrl = await this.captureElementToDataUrl(
          iframeDoc.body,
          dimensions,
          format,
          quality
        );

        const thumbnail = this.buildThumbnail(
          dataUrl,
          dimensions,
          format,
          captureOptions
        );

        this.addToCache(thumbnail);
        if (captureOptions.versionId) {
          this.versionThumbnails.set(captureOptions.versionId, thumbnail);
        }

        this.notifyGeneration(thumbnail);

        return thumbnail;
      } finally {
        document.body.removeChild(iframe);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyError(err, captureOptions.versionId);
      throw err;
    }
  }

  /**
   * Captures a thumbnail from a canvas element.
   */
  captureFromCanvas(
    canvas: HTMLCanvasElement,
    captureOptions: CaptureOptions = {}
  ): Thumbnail {
    if (this.disposed) {
      throw new Error("ThumbnailGenerator is disposed");
    }

    const dimensions = getDimensions(
      captureOptions.size ?? this.options.defaultSize
    );
    const format = captureOptions.format ?? this.options.defaultFormat;
    const quality = captureOptions.quality ?? this.options.quality;

    // Create scaled canvas
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = dimensions.width;
    scaledCanvas.height = dimensions.height;

    const ctx = scaledCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get canvas context");
    }

    // Fill background
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Calculate scaled dimensions preserving aspect ratio
    const scaled = calculateScaledDimensions(
      canvas.width,
      canvas.height,
      dimensions.width,
      dimensions.height
    );

    // Center the image
    const x = (dimensions.width - scaled.width) / 2;
    const y = (dimensions.height - scaled.height) / 2;

    ctx.drawImage(canvas, x, y, scaled.width, scaled.height);

    // Export
    const mimeType = getMimeType(format);
    const dataUrl = scaledCanvas.toDataURL(mimeType, quality);

    const thumbnail = this.buildThumbnail(
      dataUrl,
      dimensions,
      format,
      captureOptions
    );

    this.addToCache(thumbnail);
    if (captureOptions.versionId) {
      this.versionThumbnails.set(captureOptions.versionId, thumbnail);
    }

    this.notifyGeneration(thumbnail);

    return thumbnail;
  }

  /**
   * Creates a placeholder thumbnail.
   */
  createPlaceholder(
    captureOptions: CaptureOptions = {}
  ): Thumbnail {
    if (this.disposed) {
      throw new Error("ThumbnailGenerator is disposed");
    }

    const dimensions = getDimensions(
      captureOptions.size ?? this.options.defaultSize
    );
    const format = captureOptions.format ?? this.options.defaultFormat;

    // Create placeholder canvas
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get canvas context");
    }

    // Fill with gradient background
    const gradient = ctx.createLinearGradient(
      0,
      0,
      dimensions.width,
      dimensions.height
    );
    gradient.addColorStop(0, "#f3f4f6");
    gradient.addColorStop(1, "#e5e7eb");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Add placeholder icon
    ctx.fillStyle = "#9ca3af";
    ctx.font = `${Math.min(dimensions.width, dimensions.height) / 4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📷", dimensions.width / 2, dimensions.height / 2);

    const mimeType = getMimeType(format);
    const dataUrl = canvas.toDataURL(mimeType);

    const thumbnail = this.buildThumbnail(dataUrl, dimensions, format, captureOptions);

    // Add to cache and version thumbnails (consistent with other capture methods)
    this.addToCache(thumbnail);
    if (captureOptions.versionId) {
      this.versionThumbnails.set(captureOptions.versionId, thumbnail);
    }

    // Notify callbacks
    this.notifyGeneration(thumbnail);

    return thumbnail;
  }

  // ---------------------------------------------------------------------------
  // Version Management
  // ---------------------------------------------------------------------------

  /**
   * Attaches a thumbnail to a version.
   */
  attachToVersion(versionId: string, thumbnail: Thumbnail): void {
    if (this.disposed) return;

    thumbnail.metadata.versionId = versionId;
    this.versionThumbnails.set(versionId, thumbnail);
  }

  /**
   * Gets thumbnail for a version.
   */
  getVersionThumbnail(versionId: string): Thumbnail | undefined {
    return this.versionThumbnails.get(versionId);
  }

  /**
   * Gets all version thumbnails as display objects.
   */
  getVersionThumbnails(): VersionThumbnail[] {
    const result: VersionThumbnail[] = [];

    for (const [versionId, thumbnail] of this.versionThumbnails) {
      result.push({
        versionId,
        label: thumbnail.metadata.label ?? versionId,
        timestamp: thumbnail.metadata.createdAt,
        thumbnailUrl: thumbnail.dataUrl,
        dimensions: thumbnail.metadata.dimensions,
        isCurrent: false,
      });
    }

    // Sort by timestamp descending (newest first)
    result.sort((a, b) => b.timestamp - a.timestamp);

    // Mark first as current
    if (result.length > 0) {
      result[0].isCurrent = true;
    }

    return result;
  }

  /**
   * Removes thumbnail for a version.
   */
  removeVersionThumbnail(versionId: string): boolean {
    return this.versionThumbnails.delete(versionId);
  }

  /**
   * Clears all version thumbnails.
   */
  clearVersionThumbnails(): void {
    this.versionThumbnails.clear();
  }

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  /**
   * Gets a cached thumbnail by ID.
   */
  getCached(thumbnailId: string): Thumbnail | undefined {
    const entry = this.cache.get(thumbnailId);
    if (entry) {
      entry.accessedAt = Date.now();
      return entry.thumbnail;
    }
    return undefined;
  }

  /**
   * Gets cache size.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clears the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  private addToCache(thumbnail: Thumbnail): void {
    // Evict oldest entries if cache is full
    while (this.cache.size >= this.options.maxCache) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.accessedAt < oldestTime) {
          oldestTime = entry.accessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(thumbnail.metadata.id, {
      thumbnail,
      accessedAt: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private async captureElementToDataUrl(
    element: HTMLElement,
    dimensions: ThumbnailDimensions,
    format: ImageFormat,
    quality: number
  ): Promise<string> {
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get canvas context");
    }

    // Fill background
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Get element bounds
    const rect = element.getBoundingClientRect();
    const sourceWidth = rect.width || 1024;
    const sourceHeight = rect.height || 768;

    // Calculate scale
    const scaleX = dimensions.width / sourceWidth;
    const scaleY = dimensions.height / sourceHeight;
    const scale = Math.min(scaleX, scaleY);

    // Use html2canvas-like approach with SVG foreignObject
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}">
        <foreignObject width="100%" height="100%" transform="scale(${scale})">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${element.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    // Create image from SVG
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load SVG"));
        img.src = url;
      });

      ctx.drawImage(img, 0, 0);
    } finally {
      URL.revokeObjectURL(url);
    }

    // Export to data URL
    const mimeType = getMimeType(format);
    return canvas.toDataURL(mimeType, quality);
  }

  private buildThumbnail(
    dataUrl: string,
    dimensions: ThumbnailDimensions,
    format: ImageFormat,
    options: CaptureOptions
  ): Thumbnail {
    const metadata: ThumbnailMetadata = {
      id: generateThumbnailId(),
      versionId: options.versionId ?? "",
      createdAt: Date.now(),
      dimensions,
      format,
      fileSize: estimateFileSize(dataUrl),
      label: options.label,
    };

    return {
      metadata,
      dataUrl,
      blob: dataUrl ? dataUrlToBlob(dataUrl) : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a generation callback.
   */
  onGeneration(callback: GenerationCallback): () => void {
    this.generationCallbacks.add(callback);
    return () => this.generationCallbacks.delete(callback);
  }

  /**
   * Registers an error callback.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private notifyGeneration(thumbnail: Thumbnail): void {
    if (this.disposed) return;

    for (const callback of this.generationCallbacks) {
      try {
        callback(thumbnail);
      } catch (e) {
        console.error("ThumbnailGenerator generation callback error:", e);
      }
    }
  }

  private notifyError(error: Error, versionId?: string): void {
    if (this.disposed) return;

    for (const callback of this.errorCallbacks) {
      try {
        callback(error, versionId);
      } catch (e) {
        console.error("ThumbnailGenerator error callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the generator.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.cache.clear();
    this.versionThumbnails.clear();
    this.generationCallbacks.clear();
    this.errorCallbacks.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a ThumbnailGenerator instance.
 */
export function createThumbnailGenerator(
  options?: ThumbnailGeneratorOptions
): ThumbnailGenerator {
  return new ThumbnailGenerator(options);
}

// =============================================================================
// Export
// =============================================================================

export default ThumbnailGenerator;
