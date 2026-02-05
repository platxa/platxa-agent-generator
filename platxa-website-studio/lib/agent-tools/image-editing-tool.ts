/**
 * ImageEditingTool
 *
 * Agent tool for cropping, resizing, and basic image manipulation.
 * Uses Canvas API for browser-based image processing.
 *
 * Features:
 * - Crop images to specific regions
 * - Resize images (with aspect ratio options)
 * - Rotate and flip images
 * - Apply basic filters (brightness, contrast, blur, grayscale, etc.)
 * - Format conversion (PNG, JPEG, WebP)
 * - Batch processing support
 * - Quality optimization
 *
 * Feature #52: Agent Tool Expansion - ImageEditingTool
 */

// =============================================================================
// Types
// =============================================================================

/** Supported image formats */
export type ImageFormat = "png" | "jpeg" | "webp";

/** Crop region definition */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Resize options */
export interface ResizeOptions {
  width?: number;
  height?: number;
  /** Maintain aspect ratio */
  maintainAspectRatio?: boolean;
  /** Resize mode when maintaining aspect ratio */
  fit?: "contain" | "cover" | "fill";
}

/** Rotation options */
export interface RotationOptions {
  /** Degrees to rotate (90, 180, 270, or arbitrary) */
  degrees: number;
  /** Background color for arbitrary rotations */
  backgroundColor?: string;
}

/** Flip options */
export interface FlipOptions {
  horizontal?: boolean;
  vertical?: boolean;
}

/** Filter types */
export type FilterType =
  | "brightness"
  | "contrast"
  | "saturation"
  | "grayscale"
  | "sepia"
  | "blur"
  | "sharpen"
  | "invert"
  | "opacity";

/** Filter options */
export interface FilterOptions {
  type: FilterType;
  /** Value depends on filter type (0-200 for most, 0-100 for blur radius) */
  value: number;
}

/** Image edit operation */
export type ImageOperation =
  | { type: "crop"; region: CropRegion }
  | { type: "resize"; options: ResizeOptions }
  | { type: "rotate"; options: RotationOptions }
  | { type: "flip"; options: FlipOptions }
  | { type: "filter"; options: FilterOptions }
  | { type: "format"; format: ImageFormat; quality?: number };

/** Tool execution result */
export interface ImageEditResult {
  success: boolean;
  dataUrl?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  format?: ImageFormat;
  sizeBytes?: number;
  error?: string;
}

/** Tool configuration */
export interface ImageEditingToolConfig {
  /** Maximum image dimension (width or height) */
  maxDimension?: number;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Default output format */
  defaultFormat?: ImageFormat;
  /** Default JPEG/WebP quality (0-1) */
  defaultQuality?: number;
}

// =============================================================================
// Canvas Utilities
// =============================================================================

/**
 * Load an image from various sources
 */
async function loadImage(source: string | Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));

    if (source instanceof Blob || source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Create a canvas with optional dimensions
 */
function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  return { canvas, ctx };
}

/**
 * Convert canvas to blob
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat = "png",
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = `image/${format}`;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Convert canvas to data URL
 */
function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: ImageFormat = "png",
  quality = 0.92
): string {
  const mimeType = `image/${format}`;
  return canvas.toDataURL(mimeType, quality);
}

// =============================================================================
// Image Operations
// =============================================================================

/**
 * Crop an image
 */
function cropImage(
  img: HTMLImageElement,
  region: CropRegion
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const { canvas, ctx } = createCanvas(region.width, region.height);

  ctx.drawImage(
    img,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height
  );

  return { canvas, ctx };
}

/**
 * Resize an image
 */
function resizeImage(
  img: HTMLImageElement | HTMLCanvasElement,
  options: ResizeOptions
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const srcWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const srcHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;

  let targetWidth = options.width || srcWidth;
  let targetHeight = options.height || srcHeight;

  if (options.maintainAspectRatio !== false) {
    const aspectRatio = srcWidth / srcHeight;

    if (options.fit === "contain") {
      if (targetWidth / targetHeight > aspectRatio) {
        targetWidth = targetHeight * aspectRatio;
      } else {
        targetHeight = targetWidth / aspectRatio;
      }
    } else if (options.fit === "cover") {
      if (targetWidth / targetHeight < aspectRatio) {
        targetWidth = targetHeight * aspectRatio;
      } else {
        targetHeight = targetWidth / aspectRatio;
      }
    } else {
      // Default: scale to fit within bounds
      if (options.width && !options.height) {
        targetHeight = options.width / aspectRatio;
      } else if (options.height && !options.width) {
        targetWidth = options.height * aspectRatio;
      }
    }
  }

  const { canvas, ctx } = createCanvas(Math.round(targetWidth), Math.round(targetHeight));

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return { canvas, ctx };
}

/**
 * Rotate an image
 */
function rotateImage(
  img: HTMLImageElement | HTMLCanvasElement,
  options: RotationOptions
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const srcWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const srcHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;

  const radians = (options.degrees * Math.PI) / 180;

  // Calculate new dimensions after rotation
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const newWidth = Math.round(srcWidth * cos + srcHeight * sin);
  const newHeight = Math.round(srcWidth * sin + srcHeight * cos);

  const { canvas, ctx } = createCanvas(newWidth, newHeight);

  // Fill background if specified
  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, newWidth, newHeight);
  }

  // Translate to center, rotate, and draw
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(img, -srcWidth / 2, -srcHeight / 2);

  return { canvas, ctx };
}

/**
 * Flip an image
 */
function flipImage(
  img: HTMLImageElement | HTMLCanvasElement,
  options: FlipOptions
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const srcWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const srcHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;

  const { canvas, ctx } = createCanvas(srcWidth, srcHeight);

  const scaleX = options.horizontal ? -1 : 1;
  const scaleY = options.vertical ? -1 : 1;

  ctx.translate(options.horizontal ? srcWidth : 0, options.vertical ? srcHeight : 0);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(img, 0, 0);

  return { canvas, ctx };
}

/**
 * Apply a filter to an image
 */
function applyFilter(
  img: HTMLImageElement | HTMLCanvasElement,
  options: FilterOptions
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const srcWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const srcHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;

  const { canvas, ctx } = createCanvas(srcWidth, srcHeight);

  // Build CSS filter string
  let filterString = "";

  switch (options.type) {
    case "brightness":
      filterString = `brightness(${options.value}%)`;
      break;
    case "contrast":
      filterString = `contrast(${options.value}%)`;
      break;
    case "saturation":
      filterString = `saturate(${options.value}%)`;
      break;
    case "grayscale":
      filterString = `grayscale(${Math.min(100, options.value)}%)`;
      break;
    case "sepia":
      filterString = `sepia(${Math.min(100, options.value)}%)`;
      break;
    case "blur":
      filterString = `blur(${options.value}px)`;
      break;
    case "invert":
      filterString = `invert(${Math.min(100, options.value)}%)`;
      break;
    case "opacity":
      filterString = `opacity(${Math.min(100, options.value)}%)`;
      break;
    case "sharpen":
      // Sharpen requires manual convolution (simplified here)
      filterString = `contrast(${100 + options.value * 0.5}%)`;
      break;
  }

  ctx.filter = filterString;
  ctx.drawImage(img, 0, 0);
  ctx.filter = "none";

  return { canvas, ctx };
}

// =============================================================================
// ImageEditingTool Class
// =============================================================================

/**
 * ImageEditingTool
 *
 * Agent tool for image manipulation operations
 */
export class ImageEditingTool {
  private config: ImageEditingToolConfig;

  constructor(config: ImageEditingToolConfig = {}) {
    this.config = {
      maxDimension: config.maxDimension || 4096,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      defaultFormat: config.defaultFormat || "png",
      defaultQuality: config.defaultQuality || 0.92,
    };
  }

  /**
   * Edit an image with a series of operations
   */
  async edit(
    source: string | Blob | File,
    operations: ImageOperation[]
  ): Promise<ImageEditResult> {
    try {
      // Load source image
      const img = await loadImage(source);

      // Validate dimensions
      if (
        img.naturalWidth > this.config.maxDimension! ||
        img.naturalHeight > this.config.maxDimension!
      ) {
        return {
          success: false,
          error: `Image dimensions exceed maximum of ${this.config.maxDimension}px`,
        };
      }

      // Start with the loaded image
      let currentSource: HTMLImageElement | HTMLCanvasElement = img;
      let outputFormat = this.config.defaultFormat!;
      let outputQuality = this.config.defaultQuality!;

      // Apply each operation in sequence
      for (const op of operations) {
        switch (op.type) {
          case "crop":
            currentSource = cropImage(
              currentSource instanceof HTMLImageElement
                ? currentSource
                : await this.canvasToImage(currentSource),
              op.region
            ).canvas;
            break;

          case "resize":
            currentSource = resizeImage(currentSource, op.options).canvas;
            break;

          case "rotate":
            currentSource = rotateImage(currentSource, op.options).canvas;
            break;

          case "flip":
            currentSource = flipImage(currentSource, op.options).canvas;
            break;

          case "filter":
            currentSource = applyFilter(currentSource, op.options).canvas;
            break;

          case "format":
            outputFormat = op.format;
            if (op.quality !== undefined) {
              outputQuality = op.quality;
            }
            break;
        }
      }

      // Convert final result to canvas if needed
      const finalCanvas =
        currentSource instanceof HTMLCanvasElement
          ? currentSource
          : this.imageToCanvas(currentSource);

      // Generate output
      const dataUrl = canvasToDataUrl(finalCanvas, outputFormat, outputQuality);
      const blob = await canvasToBlob(finalCanvas, outputFormat, outputQuality);

      return {
        success: true,
        dataUrl,
        blob,
        width: finalCanvas.width,
        height: finalCanvas.height,
        format: outputFormat,
        sizeBytes: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Crop an image
   */
  async crop(source: string | Blob | File, region: CropRegion): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "crop", region }]);
  }

  /**
   * Resize an image
   */
  async resize(source: string | Blob | File, options: ResizeOptions): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "resize", options }]);
  }

  /**
   * Rotate an image
   */
  async rotate(source: string | Blob | File, degrees: number): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "rotate", options: { degrees } }]);
  }

  /**
   * Flip an image
   */
  async flip(
    source: string | Blob | File,
    horizontal = false,
    vertical = false
  ): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "flip", options: { horizontal, vertical } }]);
  }

  /**
   * Apply a filter to an image
   */
  async filter(
    source: string | Blob | File,
    filterType: FilterType,
    value: number
  ): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "filter", options: { type: filterType, value } }]);
  }

  /**
   * Convert image format
   */
  async convert(
    source: string | Blob | File,
    format: ImageFormat,
    quality?: number
  ): Promise<ImageEditResult> {
    return this.edit(source, [{ type: "format", format, quality }]);
  }

  /**
   * Get image information without modifying
   */
  async getInfo(
    source: string | Blob | File
  ): Promise<{ width: number; height: number; aspectRatio: number }> {
    const img = await loadImage(source);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight,
    };
  }

  /**
   * Create thumbnail
   */
  async createThumbnail(
    source: string | Blob | File,
    maxSize: number,
    format: ImageFormat = "jpeg"
  ): Promise<ImageEditResult> {
    const info = await this.getInfo(source);
    const scaleFactor = maxSize / Math.max(info.width, info.height);

    if (scaleFactor >= 1) {
      // Image is already smaller than max size
      return this.convert(source, format, 0.8);
    }

    return this.edit(source, [
      {
        type: "resize",
        options: {
          width: Math.round(info.width * scaleFactor),
          height: Math.round(info.height * scaleFactor),
          maintainAspectRatio: true,
        },
      },
      { type: "format", format, quality: 0.8 },
    ]);
  }

  /**
   * Convert canvas to image element
   */
  private async canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
    return loadImage(canvas.toDataURL());
  }

  /**
   * Convert image element to canvas
   */
  private imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    return canvas;
  }
}

// =============================================================================
// Factory & Agent Integration
// =============================================================================

/**
 * Create an ImageEditingTool instance
 */
export function createImageEditingTool(config?: ImageEditingToolConfig): ImageEditingTool {
  return new ImageEditingTool(config);
}

/**
 * Tool definition for agent integration
 */
export const imageEditingToolDefinition = {
  name: "image_editing",
  description:
    "Edit images with crop, resize, rotate, flip, and filter operations. Supports PNG, JPEG, and WebP formats.",
  parameters: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "Image source (URL, data URL, or file path)",
      },
      operations: {
        type: "array",
        description: "List of operations to apply in order",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["crop", "resize", "rotate", "flip", "filter", "format"],
            },
          },
        },
      },
    },
    required: ["source", "operations"],
  },
};

export default ImageEditingTool;
