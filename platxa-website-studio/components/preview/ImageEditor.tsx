"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Upload,
  Link,
  Sparkles,
  Crop,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  X,
  Check,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// =============================================================================
// Types
// =============================================================================

interface ImageEditorProps {
  /** Current image source (URL or data URI) */
  value: string;
  /** Called when image changes */
  onChange: (value: string) => void;
  /** Alt text for the image */
  alt?: string;
  /** Called when alt text changes */
  onAltChange?: (alt: string) => void;
  /** Element ID for tracking */
  elementId?: string;
  /** Whether editing is enabled */
  editable?: boolean;
  /** AI generation endpoint */
  aiGenerateEndpoint?: string;
  /** Upload endpoint */
  uploadEndpoint?: string;
  /** Max file size in bytes (default 5MB) */
  maxFileSize?: number;
  /** Accepted file types */
  acceptedTypes?: string[];
  /** Additional class name */
  className?: string;
  /** Style for the image container */
  style?: React.CSSProperties;
}

interface ImageTransform {
  /** Scale factor (1 = original size) */
  scale: number;
  /** X offset in pixels */
  offsetX: number;
  /** Y offset in pixels */
  offsetY: number;
  /** Rotation in degrees */
  rotation: number;
  /** Horizontal flip */
  flipH: boolean;
  /** Vertical flip */
  flipV: boolean;
}

interface CropArea {
  /** X position (0-1) */
  x: number;
  /** Y position (0-1) */
  y: number;
  /** Width (0-1) */
  width: number;
  /** Height (0-1) */
  height: number;
}

type EditorMode = "view" | "crop" | "transform";
type SourceTab = "upload" | "url" | "ai";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TRANSFORM: ImageTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

const DEFAULT_CROP: CropArea = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

// =============================================================================
// Helpers
// =============================================================================

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validate image URL */
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Load image and get dimensions */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/** Apply transforms and crop to canvas */
async function applyImageTransforms(
  src: string,
  transform: ImageTransform,
  crop: CropArea
): Promise<string> {
  const img = await loadImage(src);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  // Calculate crop dimensions
  const cropX = crop.x * img.width;
  const cropY = crop.y * img.height;
  const cropW = crop.width * img.width;
  const cropH = crop.height * img.height;

  // Set canvas size to cropped area scaled
  canvas.width = cropW * transform.scale;
  canvas.height = cropH * transform.scale;

  // Apply transforms
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // Draw cropped image
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropW,
    cropH,
    transform.offsetX,
    transform.offsetY,
    canvas.width,
    canvas.height
  );

  ctx.restore();

  return canvas.toDataURL("image/png");
}

// =============================================================================
// Sub-Components
// =============================================================================

interface ImageSourcePanelProps {
  onImageSelect: (src: string) => void;
  uploadEndpoint?: string;
  aiGenerateEndpoint?: string;
  maxFileSize: number;
  acceptedTypes: string[];
}

function ImageSourcePanel({
  onImageSelect,
  uploadEndpoint,
  aiGenerateEndpoint,
  maxFileSize,
  acceptedTypes,
}: ImageSourcePanelProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("upload");
  const [urlInput, setUrlInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        setError(`Invalid file type. Accepted: ${acceptedTypes.join(", ")}`);
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        setError(`File too large. Max size: ${formatFileSize(maxFileSize)}`);
        return;
      }

      setIsLoading(true);

      try {
        if (uploadEndpoint) {
          // Upload to server
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch(uploadEndpoint, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error("Upload failed");
          const { url } = await response.json();
          onImageSelect(url);
        } else {
          // Convert to data URI
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUri = event.target?.result as string;
            onImageSelect(dataUri);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsLoading(false);
      }
    },
    [uploadEndpoint, maxFileSize, acceptedTypes, onImageSelect]
  );

  // Handle paste
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const fakeEvent = {
              target: { files: [file] },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleFileSelect(fakeEvent);
            return;
          }
        }
      }
    },
    [handleFileSelect]
  );

  // Handle URL submit
  const handleUrlSubmit = useCallback(() => {
    setError(null);
    if (!isValidImageUrl(urlInput)) {
      setError("Invalid image URL");
      return;
    }
    onImageSelect(urlInput);
    setUrlInput("");
  }, [urlInput, onImageSelect]);

  // Handle AI generation
  const handleAiGenerate = useCallback(async () => {
    if (!aiGenerateEndpoint || !aiPrompt.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(aiGenerateEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!response.ok) throw new Error("AI generation failed");
      const { url } = await response.json();
      onImageSelect(url);
      setAiPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setIsLoading(false);
    }
  }, [aiGenerateEndpoint, aiPrompt, onImageSelect]);

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SourceTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="text-xs gap-1">
            <Upload className="w-3 h-3" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1">
            <Link className="w-3 h-3" />
            URL
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="text-xs gap-1"
            disabled={!aiGenerateEndpoint}
          >
            <Sparkles className="w-3 h-3" />
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6",
              "flex flex-col items-center justify-center gap-2",
              "text-muted-foreground text-sm",
              "hover:border-primary hover:bg-primary/5 transition-colors",
              "cursor-pointer"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8" />
                <span>Click to upload or paste image</span>
                <span className="text-xs">
                  Max {formatFileSize(maxFileSize)}
                </span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />
        </TabsContent>

        <TabsContent value="url" className="mt-3 space-y-2">
          <Input
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          />
          <Button
            onClick={handleUrlSubmit}
            disabled={!urlInput || isLoading}
            className="w-full"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Load Image"
            )}
          </Button>
        </TabsContent>

        <TabsContent value="ai" className="mt-3 space-y-2">
          <Input
            placeholder="Describe the image you want..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
          />
          <Button
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim() || isLoading}
            className="w-full"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

interface CropControlsProps {
  crop: CropArea;
  onCropChange: (crop: CropArea) => void;
  onApply: () => void;
  onCancel: () => void;
}

function CropControls({ crop, onCropChange, onApply, onCancel }: CropControlsProps) {
  const aspectRatios = [
    { label: "Free", value: null },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "16:9", value: 16 / 9 },
    { label: "3:2", value: 3 / 2 },
  ];

  const handleAspectRatio = (ratio: number | null) => {
    if (ratio === null) return;
    const newHeight = crop.width / ratio;
    onCropChange({ ...crop, height: Math.min(newHeight, 1 - crop.y) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {aspectRatios.map(({ label, value }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleAspectRatio(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">X Position</Label>
          <Slider
            value={[crop.x * 100]}
            onValueChange={([v]) => onCropChange({ ...crop, x: v / 100 })}
            max={100 - crop.width * 100}
            step={1}
          />
        </div>
        <div>
          <Label className="text-xs">Y Position</Label>
          <Slider
            value={[crop.y * 100]}
            onValueChange={([v]) => onCropChange({ ...crop, y: v / 100 })}
            max={100 - crop.height * 100}
            step={1}
          />
        </div>
        <div>
          <Label className="text-xs">Width</Label>
          <Slider
            value={[crop.width * 100]}
            onValueChange={([v]) => onCropChange({ ...crop, width: v / 100 })}
            min={10}
            max={100 - crop.x * 100}
            step={1}
          />
        </div>
        <div>
          <Label className="text-xs">Height</Label>
          <Slider
            value={[crop.height * 100]}
            onValueChange={([v]) => onCropChange({ ...crop, height: v / 100 })}
            min={10}
            max={100 - crop.y * 100}
            step={1}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onApply} className="flex-1">
          <Check className="w-4 h-4 mr-1" />
          Apply
        </Button>
      </div>
    </div>
  );
}

interface TransformControlsProps {
  transform: ImageTransform;
  onTransformChange: (transform: ImageTransform) => void;
  onReset: () => void;
}

function TransformControls({
  transform,
  onTransformChange,
  onReset,
}: TransformControlsProps) {
  return (
    <div className="space-y-3">
      {/* Scale */}
      <div>
        <div className="flex justify-between mb-1">
          <Label className="text-xs">Scale</Label>
          <span className="text-xs text-muted-foreground">
            {Math.round(transform.scale * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              onTransformChange({ ...transform, scale: Math.max(0.1, transform.scale - 0.1) })
            }
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Slider
            value={[transform.scale * 100]}
            onValueChange={([v]) => onTransformChange({ ...transform, scale: v / 100 })}
            min={10}
            max={200}
            step={5}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              onTransformChange({ ...transform, scale: Math.min(2, transform.scale + 0.1) })
            }
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <div className="flex justify-between mb-1">
          <Label className="text-xs">Rotation</Label>
          <span className="text-xs text-muted-foreground">{transform.rotation}°</span>
        </div>
        <Slider
          value={[transform.rotation]}
          onValueChange={([v]) => onTransformChange({ ...transform, rotation: v })}
          min={-180}
          max={180}
          step={1}
        />
      </div>

      {/* Flip buttons */}
      <div className="flex gap-2">
        <Button
          variant={transform.flipH ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => onTransformChange({ ...transform, flipH: !transform.flipH })}
        >
          <FlipHorizontal className="w-4 h-4 mr-1" />
          Flip H
        </Button>
        <Button
          variant={transform.flipV ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => onTransformChange({ ...transform, flipV: !transform.flipV })}
        >
          <FlipVertical className="w-4 h-4 mr-1" />
          Flip V
        </Button>
      </div>

      {/* Reset */}
      <Button variant="outline" size="sm" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-1" />
        Reset Transforms
      </Button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ImageEditor - Image editing with upload, URL, AI generation, and transforms
 *
 * Feature #24: Visual Edit Mode - Image editor
 *
 * @example
 * ```tsx
 * <ImageEditor
 *   value="/images/hero.jpg"
 *   onChange={(src) => updateImage(src)}
 *   alt="Hero image"
 *   onAltChange={(alt) => updateAlt(alt)}
 *   aiGenerateEndpoint="/api/ai/generate-image"
 *   editable
 * />
 * ```
 */
export function ImageEditor({
  value,
  onChange,
  alt = "",
  onAltChange,
  elementId = "",
  editable = true,
  aiGenerateEndpoint,
  uploadEndpoint,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
  style,
}: ImageEditorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("view");
  const [transform, setTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM);
  const [crop, setCrop] = useState<CropArea>(DEFAULT_CROP);
  const [altInput, setAltInput] = useState(alt);
  const [isApplying, setIsApplying] = useState(false);

  // Sync alt input with prop
  useEffect(() => {
    setAltInput(alt);
  }, [alt]);

  // Handle new image selection
  const handleImageSelect = useCallback(
    (src: string) => {
      onChange(src);
      setTransform(DEFAULT_TRANSFORM);
      setCrop(DEFAULT_CROP);
    },
    [onChange]
  );

  // Apply crop
  const handleApplyCrop = useCallback(async () => {
    if (!value) return;

    setIsApplying(true);
    try {
      const result = await applyImageTransforms(value, DEFAULT_TRANSFORM, crop);
      onChange(result);
      setCrop(DEFAULT_CROP);
      setMode("view");
    } catch (err) {
      console.error("Failed to apply crop:", err);
    } finally {
      setIsApplying(false);
    }
  }, [value, crop, onChange]);

  // Apply transforms
  const handleApplyTransforms = useCallback(async () => {
    if (!value) return;

    setIsApplying(true);
    try {
      const result = await applyImageTransforms(value, transform, DEFAULT_CROP);
      onChange(result);
      setTransform(DEFAULT_TRANSFORM);
    } catch (err) {
      console.error("Failed to apply transforms:", err);
    } finally {
      setIsApplying(false);
    }
  }, [value, transform, onChange]);

  // Handle alt text change
  const handleAltBlur = useCallback(() => {
    if (altInput !== alt) {
      onAltChange?.(altInput);
    }
  }, [altInput, alt, onAltChange]);

  // Preview transform style
  const previewStyle = useMemo((): React.CSSProperties => {
    if (mode !== "transform") return {};
    return {
      transform: `
        scale(${transform.scale})
        rotate(${transform.rotation}deg)
        scaleX(${transform.flipH ? -1 : 1})
        scaleY(${transform.flipV ? -1 : 1})
        translate(${transform.offsetX}px, ${transform.offsetY}px)
      `,
    };
  }, [mode, transform]);

  // Crop overlay style
  const cropOverlayStyle = useMemo((): React.CSSProperties => {
    if (mode !== "crop") return { display: "none" };
    return {
      position: "absolute",
      left: `${crop.x * 100}%`,
      top: `${crop.y * 100}%`,
      width: `${crop.width * 100}%`,
      height: `${crop.height * 100}%`,
      border: "2px dashed white",
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
      pointerEvents: "none",
    };
  }, [mode, crop]);

  const hasImage = !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative group cursor-pointer",
            "border rounded-lg overflow-hidden",
            editable && "hover:ring-2 hover:ring-primary",
            className
          )}
          style={style}
          data-element-id={elementId}
          data-editable={editable}
        >
          {hasImage ? (
            <>
              <img
                src={value}
                alt={alt}
                className="w-full h-full object-cover transition-transform"
                style={previewStyle}
              />
              <div style={cropOverlayStyle} />
              {editable && (
                <div
                  className={cn(
                    "absolute inset-0 bg-black/50 opacity-0",
                    "group-hover:opacity-100 transition-opacity",
                    "flex items-center justify-center"
                  )}
                >
                  <ImageIcon className="w-8 h-8 text-white" />
                </div>
              )}
            </>
          ) : (
            <div
              className={cn(
                "w-full h-32 flex flex-col items-center justify-center gap-2",
                "text-muted-foreground bg-muted/50"
              )}
            >
              <ImageIcon className="w-8 h-8" />
              <span className="text-sm">Click to add image</span>
            </div>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-4">
          {/* Image source selection */}
          {mode === "view" && (
            <ImageSourcePanel
              onImageSelect={handleImageSelect}
              uploadEndpoint={uploadEndpoint}
              aiGenerateEndpoint={aiGenerateEndpoint}
              maxFileSize={maxFileSize}
              acceptedTypes={acceptedTypes}
            />
          )}

          {/* Crop controls */}
          {mode === "crop" && (
            <CropControls
              crop={crop}
              onCropChange={setCrop}
              onApply={handleApplyCrop}
              onCancel={() => {
                setCrop(DEFAULT_CROP);
                setMode("view");
              }}
            />
          )}

          {/* Transform controls */}
          {mode === "transform" && (
            <>
              <TransformControls
                transform={transform}
                onTransformChange={setTransform}
                onReset={() => setTransform(DEFAULT_TRANSFORM)}
              />
              <Button
                onClick={handleApplyTransforms}
                disabled={isApplying}
                className="w-full"
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Apply Transforms"
                )}
              </Button>
            </>
          )}

          {/* Mode toggle buttons */}
          {hasImage && mode === "view" && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMode("crop")}
              >
                <Crop className="w-4 h-4 mr-1" />
                Crop
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMode("transform")}
              >
                <Move className="w-4 h-4 mr-1" />
                Transform
              </Button>
            </div>
          )}

          {/* Alt text input */}
          {hasImage && onAltChange && mode === "view" && (
            <div className="pt-2 border-t">
              <Label className="text-xs">Alt Text (accessibility)</Label>
              <Input
                value={altInput}
                onChange={(e) => setAltInput(e.target.value)}
                onBlur={handleAltBlur}
                placeholder="Describe this image..."
                className="mt-1"
              />
            </div>
          )}

          {/* Back button for sub-modes */}
          {mode !== "view" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("view")}
              className="w-full"
            >
              Back to Image Options
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Hook for managing image state
// =============================================================================

export interface UseImageEditorOptions {
  initialSrc?: string;
  initialAlt?: string;
  onSrcChange?: (src: string) => void;
  onAltChange?: (alt: string) => void;
}

export interface UseImageEditorReturn {
  src: string;
  alt: string;
  setSrc: (src: string) => void;
  setAlt: (alt: string) => void;
  clear: () => void;
}

/**
 * Hook for managing image editor state
 */
export function useImageEditor({
  initialSrc = "",
  initialAlt = "",
  onSrcChange,
  onAltChange,
}: UseImageEditorOptions = {}): UseImageEditorReturn {
  const [src, setSrcState] = useState(initialSrc);
  const [alt, setAltState] = useState(initialAlt);

  const setSrc = useCallback(
    (newSrc: string) => {
      setSrcState(newSrc);
      onSrcChange?.(newSrc);
    },
    [onSrcChange]
  );

  const setAlt = useCallback(
    (newAlt: string) => {
      setAltState(newAlt);
      onAltChange?.(newAlt);
    },
    [onAltChange]
  );

  const clear = useCallback(() => {
    setSrc("");
    setAlt("");
  }, [setSrc, setAlt]);

  return { src, alt, setSrc, setAlt, clear };
}

export default ImageEditor;
