/**
 * ImageGenerationTool - AI-powered image generation
 *
 * Provides image generation capabilities for the agent using:
 * - DALL-E (OpenAI)
 * - Stable Diffusion (via various APIs)
 *
 * Generated images can be uploaded to Odoo attachments.
 *
 * Feature #51: Agent Tool Expansion - ImageGenerationTool
 */

// =============================================================================
// Types
// =============================================================================

/** Supported image generation providers */
export type ImageProvider = "dalle" | "stable-diffusion";

/** Image size options */
export type ImageSize = "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";

/** Image style options */
export type ImageStyle = "vivid" | "natural" | "photorealistic" | "artistic" | "cartoon";

/** Image quality options */
export type ImageQuality = "standard" | "hd";

/** Generated image result */
export interface GeneratedImage {
  /** Unique image ID */
  id: string;
  /** Image URL (temporary) */
  url: string;
  /** Base64 encoded image data */
  base64?: string;
  /** Image format */
  format: "png" | "jpeg" | "webp";
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Original prompt used */
  prompt: string;
  /** Revised prompt (if modified by provider) */
  revisedPrompt?: string;
  /** Provider used */
  provider: ImageProvider;
  /** Generation timestamp */
  createdAt: Date;
}

/** Image generation request */
export interface ImageGenerationRequest {
  /** Text prompt describing the image */
  prompt: string;
  /** Number of images to generate */
  count?: number;
  /** Image size */
  size?: ImageSize;
  /** Image style */
  style?: ImageStyle;
  /** Image quality */
  quality?: ImageQuality;
  /** Preferred provider */
  provider?: ImageProvider;
  /** Additional generation parameters */
  options?: {
    /** Negative prompt (what to avoid) */
    negativePrompt?: string;
    /** Seed for reproducibility */
    seed?: number;
    /** Guidance scale (CFG) */
    guidanceScale?: number;
    /** Number of inference steps */
    steps?: number;
  };
}

/** Image generation response */
export interface ImageGenerationResponse {
  /** Whether generation was successful */
  success: boolean;
  /** Generated images */
  images: GeneratedImage[];
  /** Error message if failed */
  error?: string;
  /** Generation duration in ms */
  duration: number;
  /** Provider used */
  provider: ImageProvider;
  /** Tokens/credits used */
  usage?: {
    promptTokens?: number;
    totalCost?: number;
  };
}

/** Provider configuration */
export interface ImageProviderConfig {
  /** Provider name */
  name: ImageProvider;
  /** API endpoint */
  endpoint: string;
  /** Function to retrieve API key securely */
  getApiKey: () => string | undefined;
  /** Default model/version */
  defaultModel?: string;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
}

/** Odoo attachment upload options */
export interface OdooUploadOptions {
  /** Odoo instance URL */
  odooUrl: string;
  /** Database name */
  database: string;
  /** Function to get session ID */
  getSessionId: () => string | undefined;
  /** Target model (e.g., 'ir.attachment') */
  model?: string;
  /** Related record ID */
  resId?: number;
  /** Related model name */
  resModel?: string;
}

/** Tool schema for AI model */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SIZE: ImageSize = "1024x1024";
const DEFAULT_QUALITY: ImageQuality = "standard";
const DEFAULT_STYLE: ImageStyle = "vivid";

const DALLE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const SD_ENDPOINT = "https://api.stability.ai/v1/generation";

const DEFAULT_DALLE_MODEL = "dall-e-3";
const DEFAULT_SD_MODEL = "stable-diffusion-xl-1024-v1-0";
const DEFAULT_RATE_LIMIT = 10;

// =============================================================================
// ImageGenerationTool Class
// =============================================================================

/**
 * ImageGenerationTool provides AI image generation for agents.
 *
 * @example
 * ```typescript
 * const imageTool = new ImageGenerationTool({
 *   dalle: {
 *     name: "dalle",
 *     endpoint: DALLE_ENDPOINT,
 *     getApiKey: () => process.env.OPENAI_API_KEY,
 *   },
 * });
 *
 * const result = await imageTool.generate({
 *   prompt: "A modern website hero image with gradient background",
 *   size: "1792x1024",
 *   style: "vivid",
 * });
 * ```
 */
export class ImageGenerationTool {
  private providers: Map<ImageProvider, ImageProviderConfig> = new Map();
  private defaultProvider: ImageProvider = "dalle";
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private rateLimitWindow: number = 60000;

  constructor(providers: Partial<Record<ImageProvider, ImageProviderConfig>>) {
    if (providers.dalle) {
      this.providers.set("dalle", providers.dalle);
    }
    if (providers["stable-diffusion"]) {
      this.providers.set("stable-diffusion", providers["stable-diffusion"]);
    }

    // Set default provider to first available
    if (this.providers.size > 0) {
      const firstProvider = this.providers.keys().next().value;
      if (firstProvider) {
        this.defaultProvider = firstProvider;
      }
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the tool schema for AI model integration
   */
  getSchema(): ToolSchema {
    return {
      name: "generate_image",
      description:
        "Generate images using AI (DALL-E or Stable Diffusion). " +
        "Use this to create hero images, backgrounds, icons, illustrations, " +
        "and other visual assets for websites and applications.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "Detailed description of the image to generate. Be specific about " +
              "style, colors, composition, and mood.",
          },
          count: {
            type: "number",
            description: "Number of images to generate (1-4, default 1)",
          },
          size: {
            type: "string",
            enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
            description: "Image dimensions (default 1024x1024)",
          },
          style: {
            type: "string",
            enum: ["vivid", "natural", "photorealistic", "artistic", "cartoon"],
            description: "Visual style of the image",
          },
          quality: {
            type: "string",
            enum: ["standard", "hd"],
            description: "Image quality level",
          },
        },
        required: ["prompt"],
      },
    };
  }

  /**
   * Generate images from a text prompt
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const provider = request.provider || this.defaultProvider;
    const config = this.providers.get(provider);

    if (!config) {
      return {
        success: false,
        images: [],
        error: `Provider '${provider}' not configured`,
        duration: Date.now() - startTime,
        provider,
      };
    }

    // Check rate limit
    if (!this.checkRateLimit(config)) {
      return {
        success: false,
        images: [],
        error: "Rate limit exceeded. Please try again later.",
        duration: Date.now() - startTime,
        provider,
      };
    }

    try {
      const images =
        provider === "dalle"
          ? await this.generateWithDalle(request, config)
          : await this.generateWithStableDiffusion(request, config);

      return {
        success: true,
        images,
        duration: Date.now() - startTime,
        provider,
      };
    } catch (error) {
      return {
        success: false,
        images: [],
        error: error instanceof Error ? error.message : "Image generation failed",
        duration: Date.now() - startTime,
        provider,
      };
    }
  }

  /**
   * Invoke the tool (for AI agent integration)
   */
  async invoke(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return this.generate(request);
  }

  /**
   * Upload generated image to Odoo attachments
   */
  async uploadToOdoo(
    image: GeneratedImage,
    options: OdooUploadOptions
  ): Promise<{ success: boolean; attachmentId?: number; error?: string }> {
    const sessionId = options.getSessionId();
    if (!sessionId) {
      return { success: false, error: "No Odoo session" };
    }

    try {
      // Fetch image data if only URL provided
      let imageData = image.base64;
      if (!imageData && image.url) {
        const response = await fetch(image.url);
        const buffer = await response.arrayBuffer();
        imageData = Buffer.from(buffer).toString("base64");
      }

      if (!imageData) {
        return { success: false, error: "No image data available" };
      }

      // Create attachment in Odoo
      const attachmentData = {
        name: `generated_${image.id}.${image.format}`,
        type: "binary",
        datas: imageData,
        mimetype: `image/${image.format}`,
        res_model: options.resModel,
        res_id: options.resId,
      };

      const response = await fetch(
        `${options.odooUrl}/web/dataset/call_kw/${options.model || "ir.attachment"}/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionId}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
              model: options.model || "ir.attachment",
              method: "create",
              args: [attachmentData],
              kwargs: {},
            },
            id: Date.now(),
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return {
        success: true,
        attachmentId: result.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: ImageProvider): boolean {
    const config = this.providers.get(provider);
    return config ? !!config.getApiKey() : false;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ImageProvider[] {
    return Array.from(this.providers.keys()).filter((p) =>
      this.isProviderAvailable(p)
    );
  }

  // ==========================================================================
  // Provider Implementations
  // ==========================================================================

  /**
   * Generate images using DALL-E
   */
  private async generateWithDalle(
    request: ImageGenerationRequest,
    config: ImageProviderConfig
  ): Promise<GeneratedImage[]> {
    const apiKey = config.getApiKey();
    if (!apiKey) {
      throw new Error("DALL-E API key not configured");
    }

    const size = request.size || DEFAULT_SIZE;
    const quality = request.quality || DEFAULT_QUALITY;
    const style = request.style || DEFAULT_STYLE;

    // Map style to DALL-E format
    const dalleStyle = style === "natural" ? "natural" : "vivid";

    const body = {
      model: config.defaultModel || DEFAULT_DALLE_MODEL,
      prompt: request.prompt,
      n: Math.min(request.count || 1, 4),
      size: this.mapSizeForDalle(size),
      quality,
      style: dalleStyle,
      response_format: "url",
    };

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { error?: { message?: string } })?.error?.message ||
          `DALL-E API error: ${response.status}`
      );
    }

    const data = await response.json();
    const [width, height] = size.split("x").map(Number);

    return (data.data as Array<{ url: string; revised_prompt?: string }>).map(
      (item, index) => ({
        id: `dalle_${Date.now()}_${index}`,
        url: item.url,
        format: "png" as const,
        width,
        height,
        prompt: request.prompt,
        revisedPrompt: item.revised_prompt,
        provider: "dalle" as const,
        createdAt: new Date(),
      })
    );
  }

  /**
   * Generate images using Stable Diffusion
   */
  private async generateWithStableDiffusion(
    request: ImageGenerationRequest,
    config: ImageProviderConfig
  ): Promise<GeneratedImage[]> {
    const apiKey = config.getApiKey();
    if (!apiKey) {
      throw new Error("Stable Diffusion API key not configured");
    }

    const size = request.size || DEFAULT_SIZE;
    const [width, height] = size.split("x").map(Number);

    const body = {
      text_prompts: [
        { text: request.prompt, weight: 1 },
        ...(request.options?.negativePrompt
          ? [{ text: request.options.negativePrompt, weight: -1 }]
          : []),
      ],
      cfg_scale: request.options?.guidanceScale || 7,
      height,
      width,
      samples: request.count || 1,
      steps: request.options?.steps || 30,
      seed: request.options?.seed,
    };

    const engineId = config.defaultModel || DEFAULT_SD_MODEL;

    const response = await fetch(
      `${config.endpoint}/${engineId}/text-to-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { message?: string })?.message ||
          `Stable Diffusion API error: ${response.status}`
      );
    }

    const data = await response.json();

    return (data.artifacts as Array<{ base64: string; seed: number }>).map(
      (item, index) => ({
        id: `sd_${Date.now()}_${index}`,
        url: `data:image/png;base64,${item.base64}`,
        base64: item.base64,
        format: "png" as const,
        width,
        height,
        prompt: request.prompt,
        provider: "stable-diffusion" as const,
        createdAt: new Date(),
      })
    );
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Map size to DALL-E supported sizes
   */
  private mapSizeForDalle(size: ImageSize): string {
    const dalleSupported = ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"];
    return dalleSupported.includes(size) ? size : "1024x1024";
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(config: ImageProviderConfig): boolean {
    const now = Date.now();
    const limit = config.rateLimit || DEFAULT_RATE_LIMIT;

    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= limit) {
      return false;
    }

    this.requestCount++;
    return true;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Build a DALL-E provider config
 */
function buildDalleConfig(
  getApiKey: () => string | undefined,
  model?: string,
  rateLimit?: number
): ImageProviderConfig {
  return {
    name: "dalle",
    endpoint: DALLE_ENDPOINT,
    getApiKey,
    defaultModel: model ?? DEFAULT_DALLE_MODEL,
    rateLimit: rateLimit ?? DEFAULT_RATE_LIMIT,
  };
}

/**
 * Build a Stable Diffusion provider config
 */
function buildStableDiffusionConfig(
  getApiKey: () => string | undefined,
  model?: string,
  rateLimit?: number
): ImageProviderConfig {
  return {
    name: "stable-diffusion",
    endpoint: SD_ENDPOINT,
    getApiKey,
    defaultModel: model ?? DEFAULT_SD_MODEL,
    rateLimit: rateLimit ?? DEFAULT_RATE_LIMIT,
  };
}

/**
 * Create an ImageGenerationTool with DALL-E provider
 */
export function createDalleImageTool(
  getApiKey: () => string | undefined,
  options?: { model?: string; rateLimit?: number }
): ImageGenerationTool {
  const config = buildDalleConfig(getApiKey, options?.model, options?.rateLimit);
  return new ImageGenerationTool({ dalle: config });
}

/**
 * Create an ImageGenerationTool with Stable Diffusion provider
 */
export function createStableDiffusionImageTool(
  getApiKey: () => string | undefined,
  options?: { model?: string; rateLimit?: number }
): ImageGenerationTool {
  const config = buildStableDiffusionConfig(getApiKey, options?.model, options?.rateLimit);
  return new ImageGenerationTool({ "stable-diffusion": config });
}

/**
 * Create an ImageGenerationTool with multiple providers
 */
export function createImageGenerationTool(providers: {
  dalle?: { getApiKey: () => string | undefined; model?: string };
  stableDiffusion?: { getApiKey: () => string | undefined; model?: string };
}): ImageGenerationTool {
  const config: Partial<Record<ImageProvider, ImageProviderConfig>> = {};

  if (providers.dalle) {
    config.dalle = buildDalleConfig(providers.dalle.getApiKey, providers.dalle.model);
  }

  if (providers.stableDiffusion) {
    config["stable-diffusion"] = buildStableDiffusionConfig(
      providers.stableDiffusion.getApiKey,
      providers.stableDiffusion.model
    );
  }

  return new ImageGenerationTool(config);
}

export default ImageGenerationTool;
