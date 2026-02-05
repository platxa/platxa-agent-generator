/**
 * Agent Tools
 *
 * Tools available to the AI agent for executing tasks.
 */

export {
  WebSearchTool,
  createWebSearchTool,
  type SearchResult,
  type SearchResponse,
  type SearchOptions,
  type SearchProviderConfig,
  type WebSearchRequest,
  type ToolSchema,
} from "./web-search";

export {
  ImageGenerationTool,
  createImageGenerationTool,
  createDalleImageTool,
  createStableDiffusionImageTool,
  type ImageProvider,
  type ImageSize,
  type ImageStyle,
  type ImageQuality,
  type GeneratedImage,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
  type ImageProviderConfig,
  type OdooUploadOptions,
} from "./image-generation";
