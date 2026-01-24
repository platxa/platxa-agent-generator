/**
 * Asset Management System
 *
 * Handles images, fonts, and media assets for Odoo themes.
 * Provides upload, optimization, and organization capabilities.
 */

// =============================================================================
// TYPES
// =============================================================================

export type AssetType = "image" | "font" | "icon" | "video" | "document";

export interface Asset {
  /** Unique asset ID */
  id: string;
  /** Original filename */
  name: string;
  /** Asset type */
  type: AssetType;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Asset path in theme */
  path: string;
  /** Base64 data URL or blob URL */
  url: string;
  /** Width (for images) */
  width?: number;
  /** Height (for images) */
  height?: number;
  /** Upload timestamp */
  uploadedAt: Date;
  /** Optional tags for organization */
  tags: string[];
  /** Thumbnail URL (for images/videos) */
  thumbnail?: string;
}

export interface AssetFolder {
  /** Folder name */
  name: string;
  /** Full path */
  path: string;
  /** Child folders */
  children: AssetFolder[];
  /** Assets in this folder */
  assets: Asset[];
}

export interface ImageOptimizeOptions {
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Quality (0-1) */
  quality?: number;
  /** Output format */
  format?: "jpeg" | "png" | "webp";
}

export interface AssetUploadResult {
  success: boolean;
  asset?: Asset;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIME_TYPES: Record<string, AssetType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "image/x-icon": "icon",
  "image/vnd.microsoft.icon": "icon",
  "font/woff": "font",
  "font/woff2": "font",
  "font/ttf": "font",
  "font/otf": "font",
  "application/font-woff": "font",
  "application/font-woff2": "font",
  "video/mp4": "video",
  "video/webm": "video",
  "application/pdf": "document",
};

const ALLOWED_EXTENSIONS: Record<AssetType, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  icon: [".ico", ".svg", ".png"],
  font: [".woff", ".woff2", ".ttf", ".otf", ".eot"],
  video: [".mp4", ".webm", ".ogg"],
  document: [".pdf"],
};

const MAX_FILE_SIZES: Record<AssetType, number> = {
  image: 5 * 1024 * 1024, // 5MB
  icon: 1 * 1024 * 1024, // 1MB
  font: 2 * 1024 * 1024, // 2MB
  video: 50 * 1024 * 1024, // 50MB
  document: 10 * 1024 * 1024, // 10MB
};

// =============================================================================
// ASSET MANAGER
// =============================================================================

/**
 * Asset manager for handling theme media files
 */
export class AssetManager {
  private assets: Map<string, Asset> = new Map();
  private folders: Map<string, AssetFolder> = new Map();
  private themeName: string;

  constructor(themeName: string) {
    this.themeName = themeName;
    this.initDefaultFolders();
  }

  /**
   * Initialize default folder structure
   */
  private initDefaultFolders(): void {
    const defaultFolders = [
      "static/src/img",
      "static/src/img/backgrounds",
      "static/src/img/icons",
      "static/src/img/team",
      "static/src/img/products",
      "static/src/fonts",
      "static/description",
    ];

    for (const path of defaultFolders) {
      this.createFolder(path);
    }
  }

  /**
   * Create a folder (and all parent folders if needed)
   */
  createFolder(path: string): AssetFolder {
    const parts = path.split("/");

    // Ensure all parent folders exist first
    for (let i = 1; i <= parts.length; i++) {
      const subPath = parts.slice(0, i).join("/");
      const fullPath = `${this.themeName}/${subPath}`;

      if (!this.folders.has(fullPath)) {
        const name = parts[i - 1];
        const folder: AssetFolder = {
          name,
          path: fullPath,
          children: [],
          assets: [],
        };
        this.folders.set(fullPath, folder);

        // Link to parent
        if (i > 1) {
          const parentPath = `${this.themeName}/${parts.slice(0, i - 1).join("/")}`;
          const parent = this.folders.get(parentPath);
          if (parent && !parent.children.some((c) => typeof c === 'object' ? c.name === name : c === name)) {
            parent.children.push(folder);
          }
        }
      }
    }

    const fullPath = `${this.themeName}/${path}`;
    return this.folders.get(fullPath)!;
  }

  /**
   * Upload an asset from File object
   */
  async uploadFile(
    file: File,
    targetFolder: string = "static/src/img"
  ): Promise<AssetUploadResult> {
    try {
      // Validate file type
      const assetType = this.getAssetType(file.type, file.name);
      if (!assetType) {
        return {
          success: false,
          error: `Unsupported file type: ${file.type}`,
        };
      }

      // Validate file size
      const maxSize = MAX_FILE_SIZES[assetType];
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File too large. Maximum size for ${assetType}: ${this.formatSize(maxSize)}`,
        };
      }

      // Read file as data URL
      const dataUrl = await this.readFileAsDataUrl(file);

      // Get image dimensions if applicable
      let width: number | undefined;
      let height: number | undefined;
      if (assetType === "image" && !file.type.includes("svg")) {
        const dimensions = await this.getImageDimensions(dataUrl);
        width = dimensions.width;
        height = dimensions.height;
      }

      // Generate asset
      const asset: Asset = {
        id: this.generateId(),
        name: file.name,
        type: assetType,
        mimeType: file.type,
        size: file.size,
        path: `${this.themeName}/${targetFolder}/${file.name}`,
        url: dataUrl,
        width,
        height,
        uploadedAt: new Date(),
        tags: [],
        thumbnail: assetType === "image" ? dataUrl : undefined,
      };

      this.assets.set(asset.id, asset);

      // Add to folder
      const folderPath = `${this.themeName}/${targetFolder}`;
      const folder = this.folders.get(folderPath);
      if (folder) {
        folder.assets.push(asset);
      }

      return { success: true, asset };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Upload from base64 string
   */
  uploadBase64(
    base64: string,
    filename: string,
    mimeType: string,
    targetFolder: string = "static/src/img"
  ): AssetUploadResult {
    try {
      const assetType = this.getAssetType(mimeType, filename);
      if (!assetType) {
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}`,
        };
      }

      // Calculate size from base64
      const size = Math.ceil((base64.length * 3) / 4);

      const dataUrl = `data:${mimeType};base64,${base64}`;

      const asset: Asset = {
        id: this.generateId(),
        name: filename,
        type: assetType,
        mimeType,
        size,
        path: `${this.themeName}/${targetFolder}/${filename}`,
        url: dataUrl,
        uploadedAt: new Date(),
        tags: [],
        thumbnail: assetType === "image" ? dataUrl : undefined,
      };

      this.assets.set(asset.id, asset);

      const folderPath = `${this.themeName}/${targetFolder}`;
      const folder = this.folders.get(folderPath);
      if (folder) {
        folder.assets.push(asset);
      }

      return { success: true, asset };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Get asset by ID
   */
  getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  /**
   * Get asset by path
   */
  getAssetByPath(path: string): Asset | undefined {
    for (const asset of this.assets.values()) {
      if (asset.path === path) {
        return asset;
      }
    }
    return undefined;
  }

  /**
   * Get all assets
   */
  getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Get assets by type
   */
  getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter((a) => a.type === type);
  }

  /**
   * Get assets by folder
   */
  getAssetsByFolder(folderPath: string): Asset[] {
    const fullPath = folderPath.startsWith(this.themeName)
      ? folderPath
      : `${this.themeName}/${folderPath}`;
    const folder = this.folders.get(fullPath);
    return folder?.assets || [];
  }

  /**
   * Delete an asset
   */
  deleteAsset(id: string): boolean {
    const asset = this.assets.get(id);
    if (!asset) return false;

    // Remove from folder
    for (const folder of this.folders.values()) {
      const index = folder.assets.findIndex((a) => a.id === id);
      if (index !== -1) {
        folder.assets.splice(index, 1);
        break;
      }
    }

    return this.assets.delete(id);
  }

  /**
   * Rename an asset
   */
  renameAsset(id: string, newName: string): boolean {
    const asset = this.assets.get(id);
    if (!asset) return false;

    // Update path
    const pathParts = asset.path.split("/");
    pathParts[pathParts.length - 1] = newName;
    asset.path = pathParts.join("/");
    asset.name = newName;

    return true;
  }

  /**
   * Add tags to asset
   */
  addTags(id: string, tags: string[]): boolean {
    const asset = this.assets.get(id);
    if (!asset) return false;

    for (const tag of tags) {
      if (!asset.tags.includes(tag)) {
        asset.tags.push(tag);
      }
    }

    return true;
  }

  /**
   * Search assets by name or tags
   */
  searchAssets(query: string): Asset[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.assets.values()).filter(
      (asset) =>
        asset.name.toLowerCase().includes(lowerQuery) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get folder structure
   */
  getFolderTree(): AssetFolder[] {
    const roots: AssetFolder[] = [];
    for (const folder of this.folders.values()) {
      if (folder.path.split("/").length === 2) {
        roots.push(folder);
      }
    }
    return roots;
  }

  /**
   * Export assets for theme generation
   */
  exportForTheme(): Array<{ path: string; content: string; type: "png" | "svg" }> {
    const exports: Array<{ path: string; content: string; type: "png" | "svg" }> = [];

    for (const asset of this.assets.values()) {
      if (asset.type === "image") {
        // Extract base64 content from data URL
        const base64Match = asset.url.match(/base64,(.+)$/);
        if (base64Match) {
          exports.push({
            path: asset.path,
            content: base64Match[1],
            type: asset.mimeType.includes("svg") ? "svg" : "png",
          });
        }
      }
    }

    return exports;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalAssets: number;
    totalSize: number;
    byType: Record<AssetType, { count: number; size: number }>;
  } {
    const stats = {
      totalAssets: this.assets.size,
      totalSize: 0,
      byType: {} as Record<AssetType, { count: number; size: number }>,
    };

    for (const asset of this.assets.values()) {
      stats.totalSize += asset.size;

      if (!stats.byType[asset.type]) {
        stats.byType[asset.type] = { count: 0, size: 0 };
      }
      stats.byType[asset.type].count++;
      stats.byType[asset.type].size += asset.size;
    }

    return stats;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private getAssetType(mimeType: string, filename: string): AssetType | null {
    // Check by MIME type first
    if (MIME_TYPES[mimeType]) {
      return MIME_TYPES[mimeType];
    }

    // Fallback to extension
    const ext = "." + filename.split(".").pop()?.toLowerCase();
    for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        return type as AssetType;
      }
    }

    return null;
  }

  private async readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  private async getImageDimensions(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        // Node.js environment - return default
        resolve({ width: 0, height: 0 });
        return;
      }

      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });
  }

  private generateId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// =============================================================================
// IMAGE UTILITIES
// =============================================================================

/**
 * Optimize an image (browser only)
 */
export async function optimizeImage(
  dataUrl: string,
  options: ImageOptimizeOptions = {}
): Promise<string> {
  if (typeof window === "undefined") {
    return dataUrl; // Can't optimize in Node.js without additional deps
  }

  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85, format = "webp" } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export
      const mimeType = `image/${format}`;
      resolve(canvas.toDataURL(mimeType, quality));
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

/**
 * Generate placeholder image data URL
 */
export function generatePlaceholder(
  width: number,
  height: number,
  text?: string,
  bgColor: string = "#e5e7eb",
  textColor: string = "#9ca3af"
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect fill="${bgColor}" width="${width}" height="${height}"/>
    <text fill="${textColor}" font-family="system-ui, sans-serif" font-size="${Math.min(width, height) / 8}"
          text-anchor="middle" x="${width / 2}" y="${height / 2}" dy=".35em">
      ${text || `${width}×${height}`}
    </text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
